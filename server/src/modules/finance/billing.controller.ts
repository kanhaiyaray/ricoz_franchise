import type { NextFunction, Request, Response } from "express";
import type { UploadedFile } from "express-fileupload";
import { createHmac, timingSafeEqual } from "node:crypto";
import mongoose, { Types } from "mongoose";
import {
  FinanceCreditNote,
  FinanceElimination,
  FinanceInvoice,
  FinanceJournal,
  FinancePayment,
  FinanceSequence,
  FinanceSettings,
  SalesLead,
} from "../../models/index.js";
import { ApiError } from "../../utils/apiError.utils.js";
import { encryptApplicationData, decryptApplicationData } from "../../utils/application-encryption.utils.js";
import { sendEmail, sendHtmlEmail } from "../../utils/email.utils.js";
import {
  assertAdmin,
  requireFranchiseScope,
  resolveFranchiseScope,
} from "../../utils/franchise-scope.utils.js";
import type { FinanceListQuery } from "./finance.validation.js";

function actorId(req: Request) {
  if (!req.user?.id || !Types.ObjectId.isValid(req.user.id)) {
    throw new ApiError(401, "An authenticated session is required.");
  }
  return new Types.ObjectId(req.user.id);
}

function queryFromResponse(res: Response) {
  return (res.locals.query ?? {}) as FinanceListQuery;
}

async function scopedFilter(req: Request): Promise<Record<string, unknown>> {
  const franchiseId = await resolveFranchiseScope(req);
  return franchiseId ? { franchiseId } : {};
}

function escapedRegex(value: string) {
  return new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
}

function calculateInvoice(lineItems: Array<{
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate?: number;
}>) {
  const items = lineItems.map((item) => {
    const subtotal = item.quantity * item.unitPrice;
    const tax = subtotal * ((item.taxRate ?? 0) / 100);
    return { ...item, amount: Math.round((subtotal + tax) * 100) / 100 };
  });
  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const total = items.reduce((sum, item) => sum + item.amount, 0);
  return {
    lineItems: items,
    subtotal: Math.round(subtotal * 100) / 100,
    taxAmount: Math.round((total - subtotal) * 100) / 100,
    total: Math.round(total * 100) / 100,
  };
}

async function makeInvoiceNumber(franchiseId: Types.ObjectId) {
  const settings = await FinanceSettings.findOne({ franchiseId }).select("invoicePrefix currency");
  const sequence = await FinanceSequence.findOneAndUpdate(
    { franchiseId },
    { $inc: { nextInvoiceNumber: 1 } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  if (!sequence) throw new ApiError(500, "Unable to allocate an invoice number.");
  return {
    invoiceNumber: `${settings?.invoicePrefix || "INV"}-${String(sequence.nextInvoiceNumber).padStart(5, "0")}`,
    currency: settings?.currency || "INR",
  };
}

async function invoiceForUser(req: Request, invoiceId: unknown) {
  if (typeof invoiceId !== "string" || !Types.ObjectId.isValid(invoiceId)) {
    throw new ApiError(400, "Invalid invoice ID.");
  }
  const filter = await scopedFilter(req);
  const invoice = await FinanceInvoice.findOne({ _id: invoiceId, ...filter }).lean();
  if (!invoice) throw new ApiError(404, "Invoice not found.");
  return invoice;
}

async function paymentForUser(req: Request, paymentId: unknown) {
  if (typeof paymentId !== "string" || !Types.ObjectId.isValid(paymentId)) {
    throw new ApiError(400, "Invalid payment ID.");
  }
  const filter = await scopedFilter(req);
  const payment = await FinancePayment.findOne({ _id: paymentId, ...filter })
    .select("-proof.ciphertext -proof.iv -proof.authTag")
    .lean();
  if (!payment) throw new ApiError(404, "Payment not found.");
  return payment;
}

async function loadPaymentForAction(
  session: mongoose.ClientSession,
  req: Request,
  paymentId: unknown,
) {
  if (typeof paymentId !== "string" || !Types.ObjectId.isValid(paymentId)) {
    throw new ApiError(400, "Invalid payment ID.");
  }
  const filter = await scopedFilter(req);
  const payment = await FinancePayment.findOne({
    _id: paymentId,
    ...filter,
  }).session(session);
  if (!payment) throw new ApiError(404, "Payment not found.");
  return payment;
}

async function withTransaction<T>(
  action: (session: mongoose.ClientSession) => Promise<T>,
) {
  const session = await mongoose.startSession();
  try {
    let result!: T;
    await session.withTransaction(async () => {
      result = await action(session);
    });
    return result;
  } finally {
    await session.endSession();
  }
}

// BUG FIX #6: cancelled/draft invoices must never have paidAmount mutated.
async function applyPaymentToInvoice(
  payment: { invoiceId?: Types.ObjectId | null; amount: number },
  session: mongoose.ClientSession,
  direction: 1 | -1,
  amount = payment.amount,
) {
  if (!payment.invoiceId) return;
  const invoice = await FinanceInvoice.findById(payment.invoiceId).session(session);
  if (!invoice) throw new ApiError(404, "Linked invoice no longer exists.");
  if (invoice.status === "cancelled" || invoice.status === "draft") {
    throw new ApiError(
      409,
      `Cannot apply payment to a ${invoice.status} invoice.`,
    );
  }
  invoice.paidAmount = Math.max(0, invoice.paidAmount + direction * amount);
  invoice.status =
    invoice.paidAmount >= invoice.total
      ? "paid"
      : invoice.paidAmount > 0
        ? "partially_paid"
        : "issued";
  await invoice.save({ session });
}

export const getBillingDashboard = (consolidated = false) => async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    if (consolidated) assertAdmin(req);
    const filter = await scopedFilter(req);
    const [invoices, payments, recentInvoices] = await Promise.all([
      FinanceInvoice.find({ ...filter, status: { $ne: "cancelled" } })
        .select("total paidAmount status createdAt dueDate")
        .lean(),
      FinancePayment.find({ ...filter, status: { $in: ["verified", "partially_refunded", "refunded"] } })
        .select("amount refunds status createdAt")
        .lean(),
      FinanceInvoice.find(filter)
        .sort({ createdAt: -1 })
        .limit(8)
        .select("invoiceNumber customer.name total status createdAt dueDate franchiseId")
        .populate("franchiseId", "name")
        .lean(),
    ]);
    const paid = payments.reduce(
      (sum, payment) =>
        sum +
        payment.amount -
        (payment.refunds ?? []).reduce((refundSum, refund) => refundSum + refund.amount, 0),
      0,
    );
    const invoiceTotal = invoices.reduce((sum, invoice) => sum + invoice.total, 0);
    const outstanding = invoices.reduce(
      (sum, invoice) => sum + Math.max(0, invoice.total - invoice.paidAmount),
      0,
    );
    const now = new Date();
    const overdue = invoices.filter(
      (invoice) =>
        invoice.dueDate &&
        invoice.dueDate < now &&
        invoice.paidAmount < invoice.total &&
        !["draft", "cancelled"].includes(invoice.status),
    ).length;
    // BUG FIX #39: report source by whether a franchise filter is actually applied.
    const hasScope = Object.keys(filter).length > 0;
    return res.status(200).json({
      success: true,
      summary: {
        totalInvoiced: invoiceTotal,
        received: paid,
        outstanding,
        overdueInvoices: overdue,
        invoiceCount: invoices.length,
        paymentCount: payments.length,
      },
      recentInvoices,
      source: hasScope ? "selected_franchise" : "all_franchises",
    });
  } catch (error) {
    next(error);
  }
};

export const getFinanceSettings = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const franchiseId = await requireFranchiseScope(req);
    const settings = await FinanceSettings.findOne({ franchiseId }).lean();
    return res.status(200).json({ success: true, settings });
  } catch (error) {
    next(error);
  }
};

export const updateFinanceSettings = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    assertAdmin(req);
    const franchiseId = await requireFranchiseScope(
      req,
      (req.body as { franchiseId?: string }).franchiseId,
    );
    const settings = await FinanceSettings.findOneAndUpdate(
      { franchiseId },
      { $set: { ...req.body, updatedBy: actorId(req) } },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
    ).lean();
    return res.status(200).json({ success: true, settings });
  } catch (error) {
    next(error);
  }
};

export const listJournals = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { page = 1, limit = 20, from, to } = queryFromResponse(res);
    // BUG FIX #2: honour the admin's franchise scope so they don't see
    // journals from every franchise when X-Franchise-Id is selected.
    const filter: Record<string, unknown> = { ...(await scopedFilter(req)) };
    if (from || to) {
      filter.entryDate = {
        ...(from ? { $gte: from } : {}),
        ...(to ? { $lte: to } : {}),
      };
    }
    const [items, total] = await Promise.all([
      FinanceJournal.find(filter)
        .sort({ entryDate: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate("franchiseId", "name")
        .lean(),
      FinanceJournal.countDocuments(filter),
    ]);
    return res.status(200).json({ success: true, items, page, limit, total });
  } catch (error) {
    next(error);
  }
};

export const createJournal = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    assertAdmin(req);
    const franchiseId = await requireFranchiseScope(
      req,
      (req.body as { franchiseId?: string }).franchiseId,
    );
    const item = await FinanceJournal.create({
      ...req.body,
      franchiseId,
      createdBy: actorId(req),
    });
    return res.status(201).json({ success: true, item });
  } catch (error) {
    next(error);
  }
};

export const listEliminations = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const filter = await scopedFilter(req);
    const { page = 1, limit = 20, status } = queryFromResponse(res);
    if (status) filter.status = status;
    const [items, total] = await Promise.all([
      FinanceElimination.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate("franchiseId", "name")
        .populate("createdBy", "name email")
        .populate("decidedBy", "name email")
        .lean(),
      FinanceElimination.countDocuments(filter),
    ]);
    return res.status(200).json({ success: true, items, page, limit, total });
  } catch (error) {
    next(error);
  }
};

export const createElimination = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const franchiseId = await requireFranchiseScope(
      req,
      (req.body as { franchiseId?: string }).franchiseId,
    );
    const item = await FinanceElimination.create({
      ...req.body,
      franchiseId,
      createdBy: actorId(req),
    });
    return res.status(201).json({ success: true, item });
  } catch (error) {
    next(error);
  }
};

export const decideElimination = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    assertAdmin(req);
    const { eliminationId } = req.params;
    const filter = await scopedFilter(req);
    const item = await FinanceElimination.findOneAndUpdate(
      { _id: eliminationId, ...filter, status: "pending" },
      {
        $set: {
          status: req.body.decision,
          decisionNote: req.body.note,
          decidedBy: actorId(req),
          decidedAt: new Date(),
        },
      },
      { new: true, runValidators: true },
    );
    if (!item) throw new ApiError(404, "Pending elimination request not found.");
    return res.status(200).json({ success: true, item });
  } catch (error) {
    next(error);
  }
};

export const listCreditNotes = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const filter = await scopedFilter(req);
    const { page = 1, limit = 20 } = queryFromResponse(res);
    const [items, total] = await Promise.all([
      FinanceCreditNote.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate("invoiceId", "invoiceNumber customer.name")
        .populate("franchiseId", "name")
        .lean(),
      FinanceCreditNote.countDocuments(filter),
    ]);
    return res.status(200).json({ success: true, items, page, limit, total });
  } catch (error) {
    next(error);
  }
};

export const createCreditNote = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    assertAdmin(req);
    const { invoiceId } = req.params;
    // BUG FIX #21: incrementing creditedAmount and creating the credit note
    // must be atomic. Without a transaction an invoice can be left with
    // creditedAmount bumped even if credit note creation fails.
    const result = await withTransaction(async (session) => {
      const franchiseFilter = await scopedFilter(req);
      const invoice = await FinanceInvoice.findOne({
        _id: invoiceId,
        ...franchiseFilter,
      }).session(session);
      if (!invoice) throw new ApiError(404, "Invoice not found.");
      if (invoice.creditedAmount + req.body.amount > invoice.total) {
        throw new ApiError(400, "Credit note exceeds the uncredited invoice balance.");
      }
      invoice.creditedAmount += req.body.amount;
      await invoice.save({ session });
      const [item] = await FinanceCreditNote.create(
        [
          {
            ...req.body,
            franchiseId: invoice.franchiseId,
            invoiceId: invoice._id,
            number: `CN-${Date.now()}`,
            createdBy: actorId(req),
          },
        ],
        { session },
      );
      return { item, invoice };
    });
    return res.status(201).json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};

export const listInvoices = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const filter = await scopedFilter(req);
    const { q, status, page = 1, limit = 20 } = queryFromResponse(res);
    if (status) filter.status = status;
    if (q) {
      const regex = escapedRegex(q);
      filter.$or = [
        { invoiceNumber: regex },
        { "customer.name": regex },
        { "customer.email": regex },
      ];
    }
    const [items, total] = await Promise.all([
      FinanceInvoice.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .select("-__v")
        .populate("franchiseId", "name")
        .lean(),
      FinanceInvoice.countDocuments(filter),
    ]);
    return res.status(200).json({ success: true, items, page, limit, total });
  } catch (error) {
    next(error);
  }
};

export const getInvoice = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const invoice = await invoiceForUser(req, req.params.invoiceId);
    return res.status(200).json({ success: true, invoice });
  } catch (error) {
    next(error);
  }
};

async function createInvoice(
  req: Request,
  input: {
    franchiseId?: string;
    leadId?: string;
    customer: { name: string; email?: string; phone?: string; address?: string };
    lineItems: Array<{ description: string; quantity: number; unitPrice: number; taxRate?: number }>;
    dueDate?: Date;
    notes?: string;
  },
) {
  const franchiseId = await requireFranchiseScope(req, input.franchiseId);
  if (input.leadId) {
    const lead = await SalesLead.findOne({
      _id: input.leadId,
      franchiseId,
      archivedAt: { $exists: false },
    }).lean();
    if (!lead) throw new ApiError(404, "Lead not found in this franchise.");
  }
  const amounts = calculateInvoice(input.lineItems);
  const { invoiceNumber, currency } = await makeInvoiceNumber(franchiseId);
  // BUG FIX #7: do not manually roll back the invoice sequence on failure.
  // Under concurrency the rollback could reissue a number another request
  // already used, causing a unique-index violation later. Accepting gaps is
  // safer than risking duplicate invoice numbers.
  const invoice = await FinanceInvoice.create({
    franchiseId,
    ...(input.leadId ? { leadId: new Types.ObjectId(input.leadId) } : {}),
    invoiceNumber,
    customer: input.customer,
    ...amounts,
    currency,
    ...(input.dueDate ? { dueDate: input.dueDate } : {}),
    notes: input.notes ?? "",
    createdBy: actorId(req),
  });
  return invoice;
}

export const createInvoiceHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const invoice = await createInvoice(req, req.body);
    return res.status(201).json({ success: true, invoice });
  } catch (error) {
    next(error);
  }
};

export const createInvoiceFromLead = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const leadId = req.params.leadId;
    if (typeof leadId !== "string" || !Types.ObjectId.isValid(leadId)) {
      throw new ApiError(400, "Invalid lead ID.");
    }
    const franchiseId = await requireFranchiseScope(req);
    const lead = await SalesLead.findOne({ _id: leadId, franchiseId }).lean();
    if (!lead) throw new ApiError(404, "Lead not found.");
    const invoice = await createInvoice(req, {
      franchiseId: franchiseId.toString(),
      leadId,
      customer: {
        name: lead.name,
        email: lead.email,
        phone: lead.phone,
        address: "",
      },
      ...req.body,
    });
    return res.status(201).json({ success: true, invoice });
  } catch (error) {
    next(error);
  }
};

export const updateInvoice = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const filter = await scopedFilter(req);
    const invoice = await FinanceInvoice.findOne({
      _id: req.params.invoiceId,
      ...filter,
    });
    if (!invoice) throw new ApiError(404, "Invoice not found.");
    if (invoice.status !== "draft") {
      throw new ApiError(409, "Only draft invoices can be edited.");
    }
    if (req.body.customer) invoice.customer = req.body.customer;
    if (req.body.lineItems) Object.assign(invoice, calculateInvoice(req.body.lineItems));
    // BUG FIX #40: null clears an existing due date.
    if (req.body.dueDate === null) {
      invoice.set("dueDate", undefined);
    } else if (req.body.dueDate) {
      invoice.dueDate = req.body.dueDate;
    }
    if (req.body.notes !== undefined) invoice.notes = req.body.notes;
    await invoice.save();
    return res.status(200).json({ success: true, invoice });
  } catch (error) {
    next(error);
  }
};

export const issueInvoice = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    assertAdmin(req);
    const filter = await scopedFilter(req);
    const invoice = await FinanceInvoice.findOneAndUpdate(
      { _id: req.params.invoiceId, ...filter, status: "draft" },
      { $set: { status: "issued", issuedAt: new Date() } },
      { new: true },
    );
    if (!invoice) throw new ApiError(409, "Invoice is not an editable draft.");
    return res.status(200).json({ success: true, invoice });
  } catch (error) {
    next(error);
  }
};

export const cancelInvoice = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    assertAdmin(req);
    const filter = await scopedFilter(req);
    const invoice = await FinanceInvoice.findOne({
      _id: req.params.invoiceId,
      ...filter,
    });
    if (!invoice) throw new ApiError(404, "Invoice not found.");
    if (invoice.paidAmount > 0 || invoice.status === "paid") {
      throw new ApiError(409, "An invoice with recorded payments cannot be cancelled.");
    }
    if (invoice.status === "cancelled") {
      throw new ApiError(409, "Invoice is already cancelled.");
    }
    invoice.status = "cancelled";
    invoice.cancelledAt = new Date();
    await invoice.save();
    return res.status(200).json({ success: true, invoice });
  } catch (error) {
    next(error);
  }
};

const PDF_TRANSLITERATION: Record<string, string> = {
  "\u20B9": "INR ",
  "\u2013": "-",
  "\u2014": "-",
  "\u2018": "'",
  "\u2019": "'",
  "\u201C": '"',
  "\u201D": '"',
  "\u2026": "...",
  "\u2022": "*",
  "\u00A9": "(c)",
  "\u00AE": "(r)",
  "\u2122": "(tm)",
};

function pdfText(value: string) {
  let out = value;
  for (const [from, to] of Object.entries(PDF_TRANSLITERATION)) {
    out = out.split(from).join(to);
  }
  return out
    .normalize("NFKD")
    .replace(/[^\x20-\x7e]/g, "?")
    .replace(/([\\()])/g, "\\$1")
    .slice(0, 500);
}

function createInvoicePdf(invoice: Awaited<ReturnType<typeof invoiceForUser>>) {
  const lines = [
    `INVOICE ${invoice.invoiceNumber}`,
    `Customer: ${invoice.customer?.name || "-"}`,
    `Email: ${invoice.customer?.email || "-"}`,
    `Status: ${invoice.status}`,
    `Due date: ${invoice.dueDate ? new Date(invoice.dueDate).toISOString().slice(0, 10) : "-"}`,
    "",
    "Description | Qty | Unit Price | Amount",
    ...invoice.lineItems.map(
      (item: { description: string; quantity: number; unitPrice: number; amount: number }) =>
        `${item.description} | ${item.quantity} | ${item.unitPrice.toFixed(2)} | ${item.amount.toFixed(2)}`,
    ),
    "",
    `Subtotal: ${invoice.currency} ${invoice.subtotal.toFixed(2)}`,
    `Tax: ${invoice.currency} ${invoice.taxAmount.toFixed(2)}`,
    `Total: ${invoice.currency} ${invoice.total.toFixed(2)}`,
    `Paid: ${invoice.currency} ${invoice.paidAmount.toFixed(2)}`,
  ];
  const commands = [
    "BT",
    "/F1 11 Tf",
    "50 790 Td",
    ...lines.flatMap((line, index) => [
      index === 0 ? `(${pdfText(line)}) Tj` : "0 -18 Td",
      ...(index === 0 ? [] : [`(${pdfText(line)}) Tj`]),
    ]),
    "ET",
  ].join("\n");
  const content = `<< /Length ${Buffer.byteLength(commands, "ascii")} >>\nstream\n${commands}\nendstream`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    content,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let document = "%PDF-1.4\n";
  const offsets = [0];
  for (const [index, object] of objects.entries()) {
    offsets.push(Buffer.byteLength(document, "ascii"));
    document += `${index + 1} 0 obj\n${object}\nendobj\n`;
  }
  const xrefOffset = Buffer.byteLength(document, "ascii");
  document += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  document += offsets
    .slice(1)
    .map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`)
    .join("");
  document += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(document, "ascii");
}

export const downloadInvoicePdf = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const invoice = await invoiceForUser(req, req.params.invoiceId);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${invoice.invoiceNumber.replace(/[^a-zA-Z0-9_-]/g, "_")}.pdf"`,
    );
    res.setHeader("Cache-Control", "private, no-store");
    return res.status(200).send(createInvoicePdf(invoice));
  } catch (error) {
    next(error);
  }
};

export const emailInvoice = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const invoice = await invoiceForUser(req, req.params.invoiceId);
    const email =
      (req.body as { email?: string }).email || invoice.customer?.email;
    if (!email) throw new ApiError(400, "Invoice customer has no email address.");
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
      throw new ApiError(503, "Invoice email is unavailable. Configure the SMTP provider.");
    }
    await sendHtmlEmail(
      email,
      `Invoice ${invoice.invoiceNumber}`,
      `<p>Please find invoice <strong>${invoice.invoiceNumber}</strong>.</p><p>Total: ${invoice.currency} ${invoice.total.toFixed(2)}</p><p>Outstanding: ${invoice.currency} ${Math.max(0, invoice.total - invoice.paidAmount).toFixed(2)}</p>`,
    );
    return res.status(200).json({ success: true, sentTo: email });
  } catch (error) {
    next(error);
  }
};

export const createInvoicePaymentLink = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const invoice = await invoiceForUser(req, req.params.invoiceId);
    // BUG FIX #20: payment links must not be issued for draft or cancelled
    // invoices — those are not ready to collect money.
    if (!["issued", "partially_paid", "overdue"].includes(invoice.status)) {
      throw new ApiError(409, "Payment links are available only for issued or partially paid invoices.");
    }
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      throw new ApiError(503, "Payment links are unavailable. Configure Razorpay credentials.");
    }
    const outstanding = Math.max(0, invoice.total - invoice.paidAmount);
    if (!outstanding) throw new ApiError(409, "Invoice has no outstanding balance.");
    const auth = Buffer.from(
      `${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`,
    ).toString("base64");
    const response = await fetch("https://api.razorpay.com/v1/payment_links", {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: Math.round(outstanding * 100),
        currency: invoice.currency,
        description: `Invoice ${invoice.invoiceNumber}`,
        customer: {
          name: invoice.customer?.name,
          email: invoice.customer?.email,
          contact: invoice.customer?.phone,
        },
        notes: { invoiceId: invoice._id.toString() },
      }),
      signal: AbortSignal.timeout(15000),
    });
    const result = (await response.json()) as { id?: string; short_url?: string; error?: { description?: string } };
    if (!response.ok || !result.id || !result.short_url) {
      throw new ApiError(502, result.error?.description ?? "Razorpay could not create a payment link.");
    }
    await FinanceInvoice.updateOne(
      { _id: invoice._id },
      { $set: { paymentLinkId: result.id, paymentLinkUrl: result.short_url } },
    );
    return res.status(200).json({
      success: true,
      paymentLink: result.short_url,
      provider: "razorpay",
    });
  } catch (error) {
    next(error);
  }
};

export const listPayments = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const filter = await scopedFilter(req);
    const { q, status, page = 1, limit = 20 } = queryFromResponse(res);
    if (status) filter.status = status;
    if (q) {
      const regex = escapedRegex(q);
      filter.$or = [{ reference: regex }, { method: regex }];
    }
    const [items, total] = await Promise.all([
      FinancePayment.find(filter)
        .select("-proof.ciphertext -proof.iv -proof.authTag")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate("invoiceId", "invoiceNumber customer.name")
        .populate("franchiseId", "name")
        .lean(),
      FinancePayment.countDocuments(filter),
    ]);
    return res.status(200).json({ success: true, items, page, limit, total });
  } catch (error) {
    next(error);
  }
};

export const getPayment = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const payment = await paymentForUser(req, req.params.paymentId);
    return res.status(200).json({ success: true, payment });
  } catch (error) {
    next(error);
  }
};

export const createPayment = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const input = req.body as {
      franchiseId?: string;
      invoiceId?: string;
      amount: number;
      method: "bank_transfer" | "cash" | "razorpay" | "other";
      reference: string;
      note: string;
    };
    const invoice = input.invoiceId
      ? await invoiceForUser(req, input.invoiceId)
      : null;
    if (invoice) {
      if (invoice.status === "cancelled" || invoice.status === "draft") {
        throw new ApiError(409, "Payments can only be recorded for issued invoices.");
      }
      if (input.amount > invoice.total - invoice.paidAmount) {
        throw new ApiError(400, "Payment exceeds the outstanding invoice balance.");
      }
    }
    const franchiseId =
      invoice?.franchiseId ??
      (await requireFranchiseScope(req, input.franchiseId));
    const payment = await FinancePayment.create({
      amount: input.amount,
      method: input.method,
      reference: input.reference,
      note: input.note,
      franchiseId,
      ...(invoice ? { invoiceId: invoice._id } : {}),
      createdBy: actorId(req),
    });
    return res.status(201).json({ success: true, payment });
  } catch (error) {
    next(error);
  }
};

function uploadedProof(req: Request): UploadedFile {
  const fileValue = req.files?.proof;
  const file = Array.isArray(fileValue) ? fileValue[0] : fileValue;
  if (!file || typeof file === "string") {
    throw new ApiError(400, "Upload a payment proof file.");
  }
  const validMime = ["application/pdf", "image/jpeg", "image/png"].includes(file.mimetype);
  const validSignature =
    (file.mimetype === "application/pdf" && file.data.subarray(0, 5).toString() === "%PDF-") ||
    (file.mimetype === "image/png" && file.data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) ||
    (file.mimetype === "image/jpeg" && file.data[0] === 0xff && file.data[1] === 0xd8 && file.data[2] === 0xff);
  if (!validMime || !validSignature) {
    throw new ApiError(400, "Payment proof must be a valid PDF, PNG, or JPEG file.");
  }
  return file;
}

export const uploadPaymentProof = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const paymentId = req.body.paymentId;
    if (typeof paymentId !== "string" || !Types.ObjectId.isValid(paymentId)) {
      throw new ApiError(400, "Invalid payment ID.");
    }
    const payment = await FinancePayment.findOne({
      _id: paymentId,
      ...(await scopedFilter(req)),
    });
    if (!payment) throw new ApiError(404, "Payment not found.");
    if (payment.status !== "pending") {
      throw new ApiError(409, "Proof can only be attached to a pending payment.");
    }
    const file = uploadedProof(req);
    const encrypted = encryptApplicationData(file.data);
    payment.proof = {
      fileName: file.name.replace(/[^\w.-]/g, "_").slice(0, 180),
      mimeType: file.mimetype,
      ...encrypted,
      uploadedAt: new Date(),
      uploadedBy: actorId(req),
    };
    await payment.save();
    return res.status(200).json({
      success: true,
      proof: {
        fileName: payment.proof.fileName,
        mimeType: payment.proof.mimeType,
        uploadedAt: payment.proof.uploadedAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const downloadPaymentProof = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const payment = await FinancePayment.findOne({
      _id: req.params.paymentId,
      ...(await scopedFilter(req)),
    }).select("+proof.ciphertext +proof.iv +proof.authTag");
    if (!payment?.proof?.ciphertext || !payment.proof.iv || !payment.proof.authTag) {
      throw new ApiError(404, "Payment proof not found.");
    }
    const data = decryptApplicationData({
      ciphertext: payment.proof.ciphertext,
      iv: payment.proof.iv,
      authTag: payment.proof.authTag,
    });
    res.setHeader("Content-Type", payment.proof.mimeType || "application/octet-stream");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${payment.proof.fileName || "payment-proof"}"`,
    );
    res.setHeader("Cache-Control", "private, no-store");
    return res.status(200).send(data);
  } catch (error) {
    next(error);
  }
};

export const verifyPayment = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    assertAdmin(req);
    const result = await withTransaction(async (session) => {
      const payment = await loadPaymentForAction(session, req, req.params.paymentId);
      if (payment.status !== "pending") {
        throw new ApiError(409, "Only pending payments can be verified.");
      }
      payment.status = "verified";
      payment.verifiedBy = actorId(req);
      payment.verifiedAt = new Date();
      await payment.save({ session });
      await applyPaymentToInvoice(payment, session, 1);
      return payment;
    });
    return res.status(200).json({ success: true, payment: result });
  } catch (error) {
    next(error);
  }
};

export const rejectPayment = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    assertAdmin(req);
    const payment = await FinancePayment.findOneAndUpdate(
      {
        _id: req.params.paymentId,
        ...(await scopedFilter(req)),
        status: "pending",
      },
      { $set: { status: "rejected", rejectionReason: req.body.reason } },
      { new: true },
    );
    if (!payment) throw new ApiError(409, "Only pending payments can be rejected.");
    return res.status(200).json({ success: true, payment });
  } catch (error) {
    next(error);
  }
};

export const reversePayment = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    assertAdmin(req);
    const result = await withTransaction(async (session) => {
      const payment = await loadPaymentForAction(session, req, req.params.paymentId);
      if (payment.status !== "verified") {
        throw new ApiError(409, "Only verified payments can be reversed.");
      }
      payment.reversals.push({
        reason: req.body.reason,
        createdBy: actorId(req),
        createdAt: new Date(),
      });
      payment.status = "reversed";
      await payment.save({ session });
      await applyPaymentToInvoice(payment, session, -1);
      return payment;
    });
    return res.status(200).json({
      success: true,
      message: "Payment reversal recorded in the ledger.",
      payment: result,
    });
  } catch (error) {
    next(error);
  }
};

async function refundWithProvider(payment: {
  method: string;
  providerPaymentId?: string | null;
}, amount: number) {
  if (payment.method !== "razorpay") return "";
  if (!payment.providerPaymentId || !process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    throw new ApiError(503, "Razorpay refund is unavailable for this payment. Verify provider credentials and payment reference.");
  }
  const auth = Buffer.from(
    `${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`,
  ).toString("base64");
  const response = await fetch(
    `https://api.razorpay.com/v1/payments/${encodeURIComponent(payment.providerPaymentId)}/refund`,
    {
      method: "POST",
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
      body: JSON.stringify({ amount: Math.round(amount * 100) }),
      signal: AbortSignal.timeout(15000),
    },
  );
  const result = (await response.json()) as { id?: string; error?: { description?: string } };
  if (!response.ok || !result.id) {
    throw new ApiError(502, result.error?.description ?? "Razorpay could not process the refund.");
  }
  return result.id;
}

export const refundPayment = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    assertAdmin(req);
    const existing = await FinancePayment.findOne({
      _id: req.params.paymentId,
      ...(await scopedFilter(req)),
    }).lean();
    if (!existing) throw new ApiError(404, "Payment not found.");
    const refunded = (existing.refunds ?? []).reduce((sum, refund) => sum + refund.amount, 0);
    if (!["verified", "partially_refunded"].includes(existing.status)) {
      throw new ApiError(409, "Only verified payments can be refunded.");
    }
    if (req.body.amount > existing.amount - refunded) {
      throw new ApiError(400, "Refund exceeds the remaining refundable amount.");
    }
    // BUG FIX #5: the provider call happens before the DB transaction by
    // design (Razorpay needs the external ID). If the DB transaction fails
    // afterwards, log clearly so the refund can be reconciled manually — an
    // orphaned provider refund must never disappear silently.
    const providerRefundId = await refundWithProvider(existing, req.body.amount);
    let result;
    try {
      result = await withTransaction(async (session) => {
        const payment = await loadPaymentForAction(session, req, req.params.paymentId);
        const totalRefunded =
          (payment.refunds ?? []).reduce((sum, refund) => sum + refund.amount, 0) +
          req.body.amount;
        if (totalRefunded > payment.amount) {
          throw new ApiError(409, "Payment balance changed. Refresh and retry.");
        }
        payment.refunds.push({
          amount: req.body.amount,
          reason: req.body.reason,
          reference: providerRefundId || req.body.reference,
          createdBy: actorId(req),
          createdAt: new Date(),
        });
        payment.status =
          totalRefunded >= payment.amount ? "refunded" : "partially_refunded";
        await payment.save({ session });
        await applyPaymentToInvoice(payment, session, -1, req.body.amount);
        return payment;
      });
    } catch (transactionError) {
      if (providerRefundId) {
        console.error(
          "PROVIDER REFUND ORPHANED - manual reconciliation required",
          JSON.stringify({
            paymentId: String(req.params.paymentId),
            providerRefundId,
            amount: req.body.amount,
            reason: req.body.reason,
          }),
        );
      }
      throw transactionError;
    }
    return res.status(200).json({ success: true, payment: result });
  } catch (error) {
    next(error);
  }
};

export const listRefunds = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const filter = await scopedFilter(req);
    const payments = await FinancePayment.find({
      ...filter,
      refunds: { $exists: true, $ne: [] },
    })
      .select("franchiseId invoiceId refunds")
      .populate("invoiceId", "invoiceNumber customer.name")
      .populate("franchiseId", "name")
      .lean();
    const items = payments.flatMap((payment) =>
      (payment.refunds ?? []).map((refund) => ({
        ...refund,
        paymentId: payment._id,
        invoice: payment.invoiceId,
        franchise: payment.franchiseId,
      })),
    );
    return res.status(200).json({ success: true, items });
  } catch (error) {
    next(error);
  }
};

export const listEliminationsAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    assertAdmin(req);
    const filter = await scopedFilter(req);
    const { page = 1, limit = 20 } = queryFromResponse(res);
    const [items, total] = await Promise.all([
      FinanceElimination.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      FinanceElimination.countDocuments(filter),
    ]);
    return res.status(200).json({ success: true, items, page, limit, total });
  } catch (error) {
    next(error);
  }
};

export const razorpayWebhook = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!secret) {
      throw new ApiError(503, "Razorpay webhooks are unavailable. Configure RAZORPAY_WEBHOOK_SECRET.");
    }
    if (!Buffer.isBuffer(req.body)) {
      throw new ApiError(400, "Webhook body must be raw JSON bytes.");
    }
    const signature = req.get("x-razorpay-signature");
    if (!signature) throw new ApiError(401, "Missing Razorpay webhook signature.");
    const expected = createHmac("sha256", secret).update(req.body).digest();
    let supplied: Buffer;
    try {
      supplied = Buffer.from(signature, "hex");
    } catch {
      throw new ApiError(401, "Invalid webhook signature.");
    }
    if (supplied.length !== expected.length || !timingSafeEqual(expected, supplied)) {
      throw new ApiError(401, "Invalid webhook signature.");
    }
    const payload = JSON.parse(req.body.toString("utf8")) as {
      event?: string;
      payload?: {
        payment_link?: { entity?: { notes?: { invoiceId?: string } } };
        payment?: { entity?: { id?: string; amount?: number; currency?: string; status?: string } };
      };
    };
    if (payload.event === "payment_link.paid") {
      const link = payload.payload?.payment_link?.entity;
      const paymentEvent = payload.payload?.payment?.entity;
      const invoiceId = link?.notes?.invoiceId;
      if (!invoiceId || !Types.ObjectId.isValid(invoiceId) || !paymentEvent?.id) {
        throw new ApiError(400, "Webhook does not contain a valid invoice payment.");
      }
      if (paymentEvent.status !== "captured") {
        return res.status(200).json({
          success: true,
          received: true,
          skipped: "payment not captured yet",
        });
      }
      const invoice = await FinanceInvoice.findById(invoiceId);
      if (!invoice) throw new ApiError(404, "Webhook invoice not found.");
      // BUG FIX #19a: cancelled invoices must not be mutated by webhooks.
      if (invoice.status === "cancelled") {
        console.warn("Ignoring Razorpay webhook for cancelled invoice", invoiceId);
        return res.status(200).json({ success: true, received: true, skipped: "invoice cancelled" });
      }
      const duplicate = await FinancePayment.exists({
        providerPaymentId: paymentEvent.id,
      });
      if (!duplicate) {
        const amount = (paymentEvent.amount ?? 0) / 100;
        const outstanding = Math.max(0, invoice.total - invoice.paidAmount);
        if (amount > outstanding) {
          // BUG FIX #19b: cap at the outstanding balance instead of letting
          // paidAmount exceed total (which would leave the invoice in a
          // "paid" state with a phantom surplus).
          console.warn("Webhook payment exceeds outstanding balance", {
            invoiceId,
            amount,
            outstanding,
          });
        }
        const applied = Math.min(amount, outstanding);
        const payment = await FinancePayment.create({
          franchiseId: invoice.franchiseId,
          invoiceId: invoice._id,
          amount: applied,
          currency: paymentEvent.currency || invoice.currency,
          method: "razorpay",
          status: "verified",
          reference: paymentEvent.id,
          providerPaymentId: paymentEvent.id,
          verifiedAt: new Date(),
          createdBy: invoice.createdBy,
        });
        invoice.paidAmount = Math.min(invoice.total, invoice.paidAmount + payment.amount);
        invoice.status = invoice.paidAmount >= invoice.total ? "paid" : "partially_paid";
        await invoice.save();
      }
    }
    return res.status(200).json({ success: true, received: true });
  } catch (error) {
    next(error);
  }
};
