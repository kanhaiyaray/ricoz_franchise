import type { NextFunction, Request, Response } from "express";
import { randomInt } from "node:crypto";
import { Types } from "mongoose";
import {
  FinanceDeletionOtp,
  FinanceInvoice,
  FinancePayment,
  FinancePlan,
  User,
} from "../../models/index.js";
import { ApiError } from "../../utils/apiError.utils.js";
import { hashToken } from "../../utils/tokens.js";
import { sendHtmlEmail } from "../../utils/email.utils.js";
import {
  requireFranchiseScope,
  resolveFranchiseScope,
} from "../../utils/franchise-scope.utils.js";
import type { FinancePlanKind } from "./finance.validation.js";

function actorId(req: Request) {
  if (!req.user?.id) throw new ApiError(401, "An authenticated session is required.");
  return req.user.id;
}

function htmlEscape(value: string) {
  return value.replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]!));
}

function yearFromRequest(req: Request) {
  const raw = req.params.fiscalYearStart ?? req.query.fiscalYearStart;
  if (raw === undefined || raw === "") {
    const now = new Date();
    return now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  }
  const year = Number(raw);
  if (!Number.isInteger(year) || year < 2000 || year > 2200) {
    throw new ApiError(400, "Invalid fiscal year.");
  }
  return year;
}

function assignRowIds<T extends { id?: string }>(rows: T[] | undefined): T[] {
  if (!Array.isArray(rows)) return [];
  return rows.map((row) => ({
    ...row,
    id: row.id && row.id.trim().length > 0 ? row.id : new Types.ObjectId().toString(),
  }));
}

export const getPlan = (kind: FinancePlanKind) => async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const franchiseId = await requireFranchiseScope(req);
    const fiscalYearStart = yearFromRequest(req);
    const plan = await FinancePlan.findOne({
      franchiseId,
      kind,
      fiscalYearStart,
    }).lean();
    return res.status(200).json({
      success: true,
      plan,
      fiscalYearStart,
      data: plan?.data ?? null,
    });
  } catch (error) {
    next(error);
  }
};

export const savePlan = (kind: FinancePlanKind) => async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const franchiseId = await requireFranchiseScope(
      req,
      (req.body as { franchiseId?: string }).franchiseId,
    );
    const fiscalYearStart = yearFromRequest(req);

    const body = { ...(req.body as Record<string, unknown>) };
    if (kind === "revenue") {
      body.streams = assignRowIds(
        (body.streams as Array<{ id?: string }> | undefined) ?? [],
      );
    } else if (kind === "resource") {
      body.resources = assignRowIds(
        (body.resources as Array<{ id?: string }> | undefined) ?? [],
      );
    } else {
      body.costs = assignRowIds(
        (body.costs as Array<{ id?: string }> | undefined) ?? [],
      );
    }

    const plan = await FinancePlan.findOneAndUpdate(
      { franchiseId, kind, fiscalYearStart },
      {
        $set: {
          data: body,
          updatedBy: actorId(req),
        },
      },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
    ).lean();
    return res.status(200).json({
      success: true,
      plan,
      data: plan?.data ?? body,
    });
  } catch (error) {
    next(error);
  }
};

export const requestRevenueDeletionOtp = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const franchiseId = await requireFranchiseScope(req);
    const user = await User.findById(actorId(req)).select("email name");
    if (!user) throw new ApiError(401, "Authenticated user not found.");
    const otp = String(randomInt(100000, 1000000));
    await FinanceDeletionOtp.findOneAndUpdate(
      { userId: user._id, franchiseId },
      {
        $set: {
          tokenHash: hashToken(otp),
          expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        },
      },
      { upsert: true, new: true, runValidators: true },
    );
    // BUG FIX #4: send deletion code as rendered HTML, not escaped text.
    await sendHtmlEmail(
      user.email,
      "Confirm revenue stream deletion",
      `<div style="font-family: sans-serif; max-width: 480px; margin: auto;">
        <h2>Confirm revenue stream deletion</h2>
        <p>Hello ${htmlEscape(user.name)},</p>
        <p>Use this one-time code to confirm deletion:</p>
        <p style="font-size: 28px; font-weight: bold; letter-spacing: 4px;">${otp}</p>
        <p>This code expires in 10 minutes.</p>
      </div>`,
    );
    return res.status(200).json({
      success: true,
      message: `A deletion code was sent to ${user.email}.`,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteRevenueStreams = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const franchiseId = await requireFranchiseScope(req);
    const fiscalYearStart = yearFromRequest(req);
    const userId = actorId(req);
    const { otp, streamIds } = req.body as {
      otp: string;
      streamIds: string[];
    };
    const otpRecord = await FinanceDeletionOtp.findOne({
      userId,
      franchiseId,
      expiresAt: { $gt: new Date() },
    }).select("+tokenHash");
    if (!otpRecord || otpRecord.tokenHash !== hashToken(otp)) {
      throw new ApiError(400, "The deletion code is invalid or expired.");
    }

    const plan = await FinancePlan.findOne({
      franchiseId,
      kind: "revenue",
      fiscalYearStart,
    });
    if (!plan) throw new ApiError(404, "Revenue projection not found.");
    const data = plan.data as { streams?: Array<{ id?: string }> };
    const streams = data.streams ?? [];
    const ids = new Set(streamIds);
    const nextStreams = streams.filter((stream) => !stream.id || !ids.has(stream.id));
    const removed = streams.length - nextStreams.length;
    if (removed !== ids.size) {
      throw new ApiError(400, "One or more requested revenue streams were not found.");
    }
    plan.data = { ...data, streams: nextStreams };
    plan.updatedBy = new Types.ObjectId(userId);
    await plan.save();
    await FinanceDeletionOtp.deleteOne({ _id: otpRecord._id });
    return res.status(200).json({ success: true, deleted: removed });
  } catch (error) {
    next(error);
  }
};

export const getFinancialSummary = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const franchiseId = await resolveFranchiseScope(req);
    const fiscalYearStart = yearFromRequest(req);
    const from = new Date(Date.UTC(fiscalYearStart, 3, 1));
    const to = new Date(Date.UTC(fiscalYearStart + 1, 3, 1));
    const invoiceQuery = FinanceInvoice.find()
      .where("createdAt").gte(from.getTime()).lt(to.getTime())
      .where("status").ne("cancelled")
      .select("total paidAmount status");
    // BUG FIX #18: include partially/fully refunded payments so revenue is not understated.
    const paymentQuery = FinancePayment.find()
      .where("createdAt").gte(from.getTime()).lt(to.getTime())
      .where("status", { $in: ["verified", "partially_refunded", "refunded"] })
      .select("amount refunds");
    const planQuery = FinancePlan.find({
      kind: { $in: ["revenue", "cost"] },
      fiscalYearStart,
    }).select("kind data");
    if (franchiseId) {
      invoiceQuery.where("franchiseId", franchiseId);
      paymentQuery.where("franchiseId", franchiseId);
      planQuery.where("franchiseId", franchiseId);
    }
    const [invoices, payments, plans] = await Promise.all([
      invoiceQuery.lean(),
      paymentQuery.lean(),
      planQuery.lean(),
    ]);

    const projectedRevenue = plans
      .filter((plan) => plan.kind === "revenue")
      .flatMap((plan) => (plan.data as { streams?: Array<{ monthlyAmounts?: number[]; probability?: number }> }).streams ?? [])
      .reduce(
        (sum, stream) =>
          sum +
          (stream.monthlyAmounts ?? []).reduce((total, amount) => total + amount, 0) *
            ((stream.probability ?? 100) / 100),
        0,
      );
    const plannedCosts = plans
      .filter((plan) => plan.kind === "cost")
      .flatMap((plan) => (plan.data as { costs?: Array<{ monthlyAmounts?: number[] }> }).costs ?? [])
      .reduce(
        (sum, cost) =>
          sum + (cost.monthlyAmounts ?? []).reduce((total, amount) => total + amount, 0),
        0,
      );
    const verifiedRevenue = payments.reduce(
      (sum, payment) =>
        sum +
        payment.amount -
        (payment.refunds ?? []).reduce((total, refund) => total + refund.amount, 0),
      0,
    );
    const outstanding = invoices.reduce(
      (sum, invoice) => sum + Math.max(invoice.total - invoice.paidAmount, 0),
      0,
    );
    return res.status(200).json({
      success: true,
      fiscalYearStart,
      period: { from, to: new Date(to.getTime() - 1) },
      actualRevenue: verifiedRevenue,
      invoicedRevenue: invoices.reduce((sum, invoice) => sum + invoice.total, 0),
      outstanding,
      projectedRevenue,
      plannedCosts,
      projectedNet: projectedRevenue - plannedCosts,
      hasSourceData: invoices.length > 0 || payments.length > 0 || plans.length > 0,
    });
  } catch (error) {
    next(error);
  }
};

export const getAiForecast = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const franchiseId = await requireFranchiseScope(req);
    const fiscalYearStart = yearFromRequest(req);
    const endpoint = process.env.AI_FORECAST_URL;
    const apiKey = process.env.AI_FORECAST_API_KEY;
    if (!endpoint || !apiKey) {
      throw new ApiError(
        503,
        "AI forecasting is unavailable. Configure AI_FORECAST_URL and AI_FORECAST_API_KEY to enable this service.",
      );
    }
    const [plans, invoices, payments] = await Promise.all([
      FinancePlan.find({ franchiseId, fiscalYearStart }).select("kind data").lean(),
      FinanceInvoice.find({ franchiseId }).select("createdAt total status").lean(),
      FinancePayment.find({ franchiseId, status: "verified" }).select("createdAt amount").lean(),
    ]);
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ fiscalYearStart, plans, invoices, payments }),
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) {
      throw new ApiError(502, `AI forecast provider returned HTTP ${response.status}.`);
    }
    const forecast: unknown = await response.json();
    return res.status(200).json({ success: true, forecast });
  } catch (error) {
    next(error);
  }
};
