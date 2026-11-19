import type { NextFunction, Request, Response } from "express";
import { randomInt } from "node:crypto";
import { Types } from "mongoose";
import {
  FinanceInvoice,
  FinancePayment,
  SalesCampaign,
  SalesDeletionOtp,
  SalesLead,
  SalesPipeline,
  SalesTask,
  User,
} from "../../models/index.js";
import { ApiError } from "../../utils/apiError.utils.js";
import { hashToken } from "../../utils/tokens.js";
import { sendHtmlEmail } from "../../utils/email.utils.js";
import { uploadPaymentProof as uploadFinancePaymentProof } from "../finance/billing.controller.js";
import {
  assertAdmin,
  requireFranchiseScope,
  resolveFranchiseScope,
} from "../../utils/franchise-scope.utils.js";
import type {
  SalesLeadCreateInput,
  SalesListQuery,
} from "./sales.validation.js";

function actorId(req: Request) {
  if (!req.user?.id || !Types.ObjectId.isValid(req.user.id)) {
    throw new ApiError(401, "A valid authenticated session is required.");
  }
  return new Types.ObjectId(req.user.id);
}

function objectId(value: string | string[] | undefined, label: string) {
  if (typeof value !== "string" || !Types.ObjectId.isValid(value)) {
    throw new ApiError(400, `Invalid ${label}.`);
  }
  return new Types.ObjectId(value);
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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

function pagination(res: Response) {
  const query = res.locals.query as SalesListQuery;
  return { page: query.page, limit: query.limit, skip: (query.page - 1) * query.limit };
}

async function salesFilter(req: Request, query?: SalesListQuery) {
  const franchiseId = await resolveFranchiseScope(req);
  const filter: Record<string, unknown> = {};
  if (franchiseId) filter.franchiseId = franchiseId;
  if (req.user?.role !== "admin") filter.ownerId = actorId(req);
  if (query?.ownerId && req.user?.role === "admin") filter.ownerId = query.ownerId;
  if (query?.status) filter.status = query.status;
  if (query?.pipelineKey) filter.pipelineKey = query.pipelineKey;
  if (query?.stage) filter.stage = query.stage;
  if (query?.source) filter.source = query.source;
  if (query?.archived) filter.archivedAt = { $ne: null };
  else filter.archivedAt = null;
  if (query?.q) {
    const expression = new RegExp(escapeRegex(query.q), "i");
    filter.$or = [
      { name: expression },
      { email: expression },
      { phone: expression },
      { company: expression },
      { source: expression },
    ];
  }
  return filter;
}

async function getAccessibleLead(req: Request, leadId: string | string[] | undefined) {
  const id = objectId(leadId, "lead ID");
  const franchiseId = await resolveFranchiseScope(req);
  const filter: Record<string, unknown> = { _id: id };
  if (franchiseId) filter.franchiseId = franchiseId;
  if (req.user?.role !== "admin") filter.ownerId = actorId(req);
  const lead = await SalesLead.findOne(filter);
  if (!lead) throw new ApiError(404, "Lead not found in your accessible scope.");
  return lead;
}

export const ensureLeadAccess = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    res.locals.salesLead = await getAccessibleLead(req, req.params.leadId);
    next();
  } catch (error) {
    next(error);
  }
};

export const salesAccess = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = actorId(req);
    const user = await User.findById(userId).select("role franchiseRole franchiseId accountStatus");
    if (!user || user.accountStatus !== "active") {
      throw new ApiError(403, "Your account does not have access to Sales.");
    }
    return res.status(200).json({
      success: true,
      role: user.role,
      franchiseRole: user.franchiseRole ?? null,
      ownershipScope: user.role === "admin" ? "global" : "assigned",
      canAssign: user.role === "admin",
      canReview: user.role === "admin",
    });
  } catch (error) {
    next(error);
  }
};

export const salesDashboard = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const scope = await resolveFranchiseScope(req);
    const filter = await salesFilter(req, { page: 1, limit: 100, archived: false } as SalesListQuery);
    const taskFilter: Record<string, unknown> = { status: "open" };
    if (scope) taskFilter.franchiseId = scope;
    if (req.user?.role !== "admin") taskFilter.assignedTo = actorId(req);
    const leadFilter: Record<string, unknown> = { archivedAt: null };
    if (scope) leadFilter.franchiseId = scope;
    if (req.user?.role !== "admin") leadFilter.ownerId = actorId(req);
    // BUG FIX #37: use $elemMatch so dueAt and completedAt match the same
    // activity. Previously they could match different array elements.
    leadFilter.activities = {
      $elemMatch: {
        dueAt: { $gte: new Date() },
        completedAt: null,
      },
    };

    const [leadCounts, openTasks, upcoming] = await Promise.all([
      SalesLead.aggregate([
        { $match: filter },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
      SalesTask.countDocuments(taskFilter),
      SalesLead.find(leadFilter)
        .select("name company activities")
        .sort({ "activities.dueAt": 1 })
        .limit(8)
        .lean(),
    ]);
    const counts: Record<string, number> = Object.fromEntries(
      leadCounts.map((item) => [String(item._id), Number(item.count)]),
    );
    return res.status(200).json({
      success: true,
      metrics: {
        totalLeads: Object.values(counts).reduce((sum, value) => sum + Number(value), 0),
        openTasks,
        newLeads: counts.new ?? 0,
        qualified: counts.qualified ?? 0,
        won: counts.won ?? 0,
        lost: counts.lost ?? 0,
      },
      upcomingFollowUps: upcoming.flatMap((lead) =>
        lead.activities
          .filter((activity) => activity.dueAt && activity.dueAt >= new Date() && !activity.completedAt)
          .map((activity) => ({
            _id: activity._id,
            leadId: lead._id,
            leadName: lead.name,
            company: lead.company,
            subject: activity.subject,
            dueAt: activity.dueAt,
            type: activity.type,
          })),
      ).slice(0, 8),
    });
  } catch (error) {
    next(error);
  }
};

export const listLeads = async (
  _req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const query = res.locals.query as SalesListQuery;
    const { page, limit, skip } = pagination(res);
    const filter = await salesFilter(_req, query);
    const [items, total] = await Promise.all([
      SalesLead.find(filter)
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("ownerId", "name email")
        .lean(),
      SalesLead.countDocuments(filter),
    ]);
    return res.status(200).json({ success: true, items, total, page, limit });
  } catch (error) {
    next(error);
  }
};

export const createLead = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const franchiseId = await requireFranchiseScope(req);
    const input = req.body as SalesLeadCreateInput;
    const actor = actorId(req);
    const lead = await SalesLead.create({
      name: input.name,
      ...(input.email === undefined ? {} : { email: input.email }),
      ...(input.phone === undefined ? {} : { phone: input.phone }),
      ...(input.company === undefined ? {} : { company: input.company }),
      ...(input.source === undefined ? {} : { source: input.source }),
      ...(input.status === undefined ? {} : { status: input.status }),
      ...(input.pipelineKey === undefined ? {} : { pipelineKey: input.pipelineKey }),
      ...(input.stage === undefined ? {} : { stage: input.stage }),
      ...(input.notes === undefined ? {} : { notes: input.notes }),
      franchiseId,
      ownerId: actor,
      createdBy: actor,
      updatedBy: actor,
    });
    return res.status(201).json({ success: true, lead });
  } catch (error) {
    next(error);
  }
};

export const getLead = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    return res.status(200).json({ success: true, lead: res.locals.salesLead });
  } catch (error) {
    next(error);
  }
};

export const updateLead = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const lead = res.locals.salesLead as InstanceType<typeof SalesLead>;
    const updated = await SalesLead.findByIdAndUpdate(
      lead._id,
      { $set: { ...req.body, updatedBy: actorId(req) } },
      { new: true, runValidators: true },
    ).populate("ownerId", "name email");
    return res.status(200).json({ success: true, lead: updated });
  } catch (error) {
    next(error);
  }
};

export const archiveLead = async (
  _req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const lead = res.locals.salesLead as InstanceType<typeof SalesLead>;
    lead.set("archivedAt", lead.archivedAt ? null : new Date());
    lead.updatedBy = actorId(_req);
    await lead.save();
    return res.status(200).json({ success: true, lead });
  } catch (error) {
    next(error);
  }
};

export const assignLead = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    assertAdmin(req);
    const lead = res.locals.salesLead as InstanceType<typeof SalesLead>;
    const ownerId = objectId((req.body as { ownerId: string }).ownerId, "owner ID");
    const owner = await User.findOne({
      _id: ownerId,
      role: "franchise",
      accountStatus: "active",
      franchiseId: lead.franchiseId,
    }).select("_id");
    if (!owner) throw new ApiError(400, "The selected owner must be an active user in the same franchise.");
    lead.ownerId = ownerId;
    lead.updatedBy = actorId(req);
    await lead.save();
    return res.status(200).json({ success: true, lead });
  } catch (error) {
    next(error);
  }
};

export const createLeadActivity = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const lead = res.locals.salesLead as InstanceType<typeof SalesLead>;
    lead.activities.push({ ...req.body, createdBy: actorId(req) });
    lead.updatedBy = actorId(req);
    await lead.save();
    return res.status(201).json({ success: true, activities: lead.activities });
  } catch (error) {
    next(error);
  }
};

async function mutateActivity(
  req: Request,
  res: Response,
  next: NextFunction,
  action: "complete" | "reschedule",
) {
  try {
    const lead = res.locals.salesLead as InstanceType<typeof SalesLead>;
    const activityId = objectId(req.params.activityId, "activity ID");
    const activity = lead.activities.id(activityId);
    if (!activity) throw new ApiError(404, "Activity not found.");
    if (action === "complete") activity.completedAt = new Date();
    else activity.dueAt = new Date((req.body as { dueAt: Date }).dueAt);
    lead.updatedBy = actorId(req);
    await lead.save();
    return res.status(200).json({ success: true, activity });
  } catch (error) {
    next(error);
  }
}

export const completeLeadActivity = (req: Request, res: Response, next: NextFunction) =>
  mutateActivity(req, res, next, "complete");
export const rescheduleLeadActivity = (req: Request, res: Response, next: NextFunction) =>
  mutateActivity(req, res, next, "reschedule");

export const importLeads = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const franchiseId = await requireFranchiseScope(req);
    const actor = actorId(req);
    const rows = (req.body as { leads: Array<Record<string, unknown>> }).leads;

    // BUG FIX #36: deduplicate both against the DB and within the same batch
    // so the same email cannot be imported twice in one request.
    const seenEmails = new Set<string>();
    const candidateEmails: string[] = [];
    for (const row of rows) {
      const email = String(row.email ?? "").toLowerCase();
      if (!email) continue;
      if (seenEmails.has(email)) continue;
      seenEmails.add(email);
      candidateEmails.push(email);
    }

    const existing = new Set(
      (await SalesLead.find({ franchiseId, email: { $in: candidateEmails } })
        .select("email")
        .lean()).map((lead) => lead.email),
    );

    const alreadyAccepted = new Set<string>();
    const input = rows
      .filter((row) => {
        const email = String(row.email ?? "").toLowerCase();
        if (!email) return true;
        if (existing.has(email)) return false;
        if (alreadyAccepted.has(email)) return false;
        alreadyAccepted.add(email);
        return true;
      })
      .map((row) => ({
        ...row,
        franchiseId,
        imported: true,
        ownerId: actor,
        createdBy: actor,
        updatedBy: actor,
      }));
    const items = input.length ? await SalesLead.insertMany(input, { ordered: true }) : [];
    return res.status(201).json({
      success: true,
      items,
      created: items.length,
      skippedDuplicates: rows.length - items.length,
    });
  } catch (error) {
    next(error);
  }
};

export const listImportedLeads = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const query = res.locals.query as SalesListQuery;
    const { page, limit, skip } = pagination(res);
    const filter = { ...(await salesFilter(req, query)), imported: true };
    const [items, total] = await Promise.all([
      SalesLead.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      SalesLead.countDocuments(filter),
    ]);
    return res.status(200).json({ success: true, items, total, page, limit });
  } catch (error) {
    next(error);
  }
};

export const bulkUpdateImportedLeads = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const input = req.body as { leadIds: string[]; [key: string]: unknown };
    const franchiseId = await resolveFranchiseScope(req);
    const filter: Record<string, unknown> = {
      _id: { $in: input.leadIds },
      imported: true,
    };
    if (franchiseId) filter.franchiseId = franchiseId;
    if (req.user?.role !== "admin") filter.ownerId = actorId(req);
    const update = Object.fromEntries(
      Object.entries(input).filter(([key]) => key !== "leadIds"),
    );
    const result = await SalesLead.updateMany(
      filter,
      { $set: { ...update, updatedBy: actorId(req) } },
      { runValidators: true },
    );
    if (result.matchedCount !== input.leadIds.length) {
      throw new ApiError(404, "Some imported leads were not found in your accessible scope.");
    }
    return res.status(200).json({ success: true, updated: result.modifiedCount });
  } catch (error) {
    next(error);
  }
};

export const requestLeadDeletionOtp = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    assertAdmin(req);
    const franchiseId = await requireFranchiseScope(req);
    const user = await User.findById(actorId(req)).select("email name");
    if (!user) throw new ApiError(401, "Authenticated user not found.");
    const otp = String(randomInt(100000, 1000000));
    await SalesDeletionOtp.findOneAndUpdate(
      { userId: user._id },
      {
        $set: {
          franchiseId,
          tokenHash: hashToken(otp),
          expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        },
      },
      { upsert: true, new: true, runValidators: true },
    );
    // BUG FIX #4: send the deletion code as rendered HTML rather than the
    // escaped text version previously used via sendEmail.
    await sendHtmlEmail(
      user.email,
      "Confirm sales lead deletion",
      `<div style="font-family: sans-serif; max-width: 480px; margin: auto;">
        <h2>Confirm sales lead deletion</h2>
        <p>Hello ${htmlEscape(user.name)},</p>
        <p>Use this one-time code to confirm deletion of the selected leads:</p>
        <p style="font-size: 28px; font-weight: bold; letter-spacing: 4px;">${otp}</p>
        <p>This code expires in 10 minutes.</p>
      </div>`,
    );
    return res.status(200).json({ success: true, message: `A deletion code was sent to ${user.email}.` });
  } catch (error) {
    next(error);
  }
};

export const deleteLeads = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    assertAdmin(req);
    const franchiseId = await requireFranchiseScope(req);
    const { leadIds, otp } = req.body as { leadIds: string[]; otp: string };
    const record = await SalesDeletionOtp.findOne({
      userId: actorId(req),
      franchiseId,
      expiresAt: { $gt: new Date() },
    }).select("+tokenHash");
    if (!record || record.tokenHash !== hashToken(otp)) {
      throw new ApiError(400, "The deletion code is invalid or expired.");
    }
    // BUG FIX #9: verify every lead exists before cascading any side effects,
    // so a typo in the ID list cannot leave invoices detached from a lead
    // that is still present.
    const objectIds = leadIds.map((id) => new Types.ObjectId(id));
    const foundIds = await SalesLead.find({
      _id: { $in: objectIds },
      franchiseId,
    }).select("_id").lean();
    if (foundIds.length !== leadIds.length) {
      const foundSet = new Set(foundIds.map((lead) => String(lead._id)));
      const missing = leadIds.filter((id) => !foundSet.has(id));
      throw new ApiError(
        404,
        `Some leads were not found in the selected franchise: ${missing.join(", ")}`,
      );
    }
    await Promise.all([
      SalesTask.deleteMany({ leadId: { $in: objectIds }, franchiseId }),
      FinanceInvoice.updateMany(
        { leadId: { $in: objectIds }, franchiseId },
        { $unset: { leadId: 1 } },
      ),
    ]);
    const result = await SalesLead.deleteMany({
      _id: { $in: objectIds },
      franchiseId,
    });
    await SalesDeletionOtp.deleteOne({ _id: record._id });
    return res.status(200).json({ success: true, deleted: result.deletedCount });
  } catch (error) {
    next(error);
  }
};

export const listPipelines = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const franchiseId = await resolveFranchiseScope(req);
    const filter = franchiseId ? { franchiseId } : {};
    const items = await SalesPipeline.find(filter).sort({ name: 1 }).lean();
    return res.status(200).json({ success: true, items });
  } catch (error) {
    next(error);
  }
};

export const updatePipeline = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    assertAdmin(req);
    const franchiseId = await requireFranchiseScope(req);
    const key = String(req.params.key);
    const pipeline = await SalesPipeline.findOneAndUpdate(
      { franchiseId, key },
      { $set: { ...req.body, updatedBy: actorId(req) }, $setOnInsert: { franchiseId, key } },
      { new: true, upsert: true, runValidators: true },
    );
    return res.status(200).json({ success: true, pipeline });
  } catch (error) {
    next(error);
  }
};

export const salesReports = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const scope = await resolveFranchiseScope(req);
    const filter = await salesFilter(req, { page: 1, limit: 100, archived: false } as SalesListQuery);
    const taskFilter: Record<string, unknown> = { status: "completed" };
    if (scope) taskFilter.franchiseId = scope;
    if (req.user?.role !== "admin") taskFilter.assignedTo = actorId(req);
    const [byStatus, bySource, tasks] = await Promise.all([
      SalesLead.aggregate([
        { $match: filter },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
      SalesLead.aggregate([
        { $match: filter },
        { $group: { _id: "$source", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      SalesTask.countDocuments(taskFilter),
    ]);
    return res.status(200).json({ success: true, byStatus, bySource, completedTasks: tasks });
  } catch (error) {
    next(error);
  }
};

export const listAccountabilityTasks = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const query = res.locals.query as SalesListQuery;
    const { page, limit, skip } = pagination(res);
    const franchiseId = await resolveFranchiseScope(req);
    const filter: Record<string, unknown> = { accountability: true };
    if (franchiseId) filter.franchiseId = franchiseId;
    if (req.user?.role !== "admin") filter.assignedTo = actorId(req);
    if (query.status) filter.reviewStatus = query.status;
    const [items, total] = await Promise.all([
      SalesTask.find(filter).sort({ dueAt: 1, createdAt: -1 }).skip(skip).limit(limit)
        .populate("assignedTo", "name email").populate("leadId", "name company").lean(),
      SalesTask.countDocuments(filter),
    ]);
    return res.status(200).json({ success: true, items, total, page, limit });
  } catch (error) {
    next(error);
  }
};

export const listAccountabilityLeads = listLeads;

export const createTask = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const franchiseId = await requireFranchiseScope(req);
    const actor = actorId(req);
    const input = req.body as {
      title: string;
      assignedTo?: string;
      leadId?: string;
      accountability: boolean;
    };
    let assignedTo = actor;
    if (input.assignedTo && req.user?.role === "admin") {
      assignedTo = objectId(input.assignedTo, "assignee ID");
      if (!(await User.exists({ _id: assignedTo, franchiseId, accountStatus: "active" }))) {
        throw new ApiError(400, "The selected assignee must be active in this franchise.");
      }
    }
    if (input.leadId) {
      const lead = await getAccessibleLead(req, input.leadId);
      if (!lead.franchiseId.equals(franchiseId)) throw new ApiError(404, "Lead not found in this franchise.");
    }
    const task = await SalesTask.create({
      ...req.body,
      franchiseId,
      assignedTo,
      assignedBy: actor,
    });
    return res.status(201).json({ success: true, task });
  } catch (error) {
    next(error);
  }
};

export const completeTask = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const franchiseId = await resolveFranchiseScope(req);
    const filter: Record<string, unknown> = { _id: objectId(req.params.taskId, "task ID") };
    if (franchiseId) filter.franchiseId = franchiseId;
    if (req.user?.role !== "admin") filter.assignedTo = actorId(req);
    const task = await SalesTask.findOneAndUpdate(
      filter,
      { $set: { status: "completed", completedAt: new Date() } },
      { new: true },
    );
    if (!task) throw new ApiError(404, "Task not found in your accessible scope.");
    return res.status(200).json({ success: true, task });
  } catch (error) {
    next(error);
  }
};

async function accessibleTask(req: Request, taskId: string | string[] | undefined) {
  const filter: Record<string, unknown> = { _id: objectId(taskId, "task ID") };
  const franchiseId = await resolveFranchiseScope(req);
  if (franchiseId) filter.franchiseId = franchiseId;
  if (req.user?.role !== "admin") filter.assignedTo = actorId(req);
  const task = await SalesTask.findOne(filter);
  if (!task) throw new ApiError(404, "Task not found in your accessible scope.");
  return task;
}

export const submitTaskReport = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const task = await accessibleTask(req, req.params.id);
    task.report = (req.body as { report: string }).report;
    task.reviewStatus = "pending";
    task.reviewNote = "";
    await task.save();
    return res.status(200).json({ success: true, task });
  } catch (error) {
    next(error);
  }
};

export const reviewTaskReport = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    assertAdmin(req);
    const task = await accessibleTask(req, req.params.id);
    const input = req.body as { reviewStatus: "approved" | "rejected"; reviewNote?: string };
    task.reviewStatus = input.reviewStatus;
    task.reviewNote = input.reviewNote ?? "";
    await task.save();
    return res.status(200).json({ success: true, task });
  } catch (error) {
    next(error);
  }
};

export const commentOnTask = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const task = await accessibleTask(req, req.params.id);
    task.comments.push({ userId: actorId(req), text: (req.body as { text: string }).text });
    await task.save();
    return res.status(201).json({ success: true, comments: task.comments });
  } catch (error) {
    next(error);
  }
};

export const salesAssistantOverview = async (
  _req: Request,
  res: Response,
) => res.status(200).json({
  success: true,
  available: false,
  message: "Sales AI is not configured. Configure a supported assistant provider before using chat.",
});

export const salesAssistantChat = async (
  _req: Request,
  _res: Response,
  next: NextFunction,
) => next(new ApiError(503, "Sales AI chat is unavailable until an assistant provider is configured."));

export const unavailableSalesIntegration = (
  _req: Request,
  _res: Response,
  next: NextFunction,
) => next(new ApiError(503, "Sales messaging is unavailable. Configure a supported email or WhatsApp provider before using this feature."));

export const unavailableSalesWebhook = (
  _req: Request,
  _res: Response,
  next: NextFunction,
) => next(new ApiError(503, "Sales email-status webhook is unavailable because no provider integration is configured."));

export const listLeadInvoices = async (
  _req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const lead = res.locals.salesLead as InstanceType<typeof SalesLead>;
    const items = await FinanceInvoice.find({ leadId: lead._id, franchiseId: lead.franchiseId })
      .sort({ createdAt: -1 })
      .lean();
    return res.status(200).json({ success: true, items });
  } catch (error) {
    next(error);
  }
};

export const previewLeadInvoice = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const lead = res.locals.salesLead as InstanceType<typeof SalesLead>;
    const { lineItems } = req.body as { lineItems: Array<{ description: string; quantity: number; unitPrice: number; taxRate: number }> };
    const items = lineItems.map((item) => {
      const subtotal = item.quantity * item.unitPrice;
      return { ...item, amount: subtotal + subtotal * item.taxRate / 100 };
    });
    const subtotal = lineItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
    const taxAmount = lineItems.reduce((sum, item) => sum + item.quantity * item.unitPrice * item.taxRate / 100, 0);
    return res.status(200).json({
      success: true,
      preview: {
        lead: { _id: lead._id, name: lead.name, email: lead.email, phone: lead.phone, company: lead.company },
        lineItems: items,
        subtotal,
        taxAmount,
        total: subtotal + taxAmount,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const updateLeadInvoice = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const lead = res.locals.salesLead as InstanceType<typeof SalesLead>;
    const input = req.body as { invoiceId?: string; [key: string]: unknown };
    const filter: Record<string, unknown> = {
      leadId: lead._id,
      franchiseId: lead.franchiseId,
      status: "draft",
    };
    if (input.invoiceId) filter._id = objectId(input.invoiceId, "invoice ID");
    const invoice = await FinanceInvoice.findOne(filter).sort({ createdAt: -1 });
    if (!invoice) throw new ApiError(404, "No editable draft invoice exists for this lead.");
    const { invoiceId: _invoiceId, ...changes } = input;
    if (changes.lineItems) {
      const lineItems = changes.lineItems as Array<{ description: string; quantity: number; unitPrice: number; taxRate: number }>;
      invoice.set("lineItems", lineItems.map((item) => ({
        ...item,
        amount: item.quantity * item.unitPrice * (1 + item.taxRate / 100),
      })));
      invoice.subtotal = lineItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
      invoice.taxAmount = lineItems.reduce((sum, item) => sum + item.quantity * item.unitPrice * item.taxRate / 100, 0);
      invoice.total = invoice.subtotal + invoice.taxAmount;
    }
    if (changes.customer) invoice.set("customer", { ...invoice.customer, ...(changes.customer as typeof invoice.customer) });
    if (changes.dueDate) invoice.dueDate = new Date(changes.dueDate as string);
    if (changes.notes !== undefined) invoice.notes = String(changes.notes);
    await invoice.save();
    return res.status(200).json({ success: true, invoice });
  } catch (error) {
    next(error);
  }
};

export const createLeadPayment = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const lead = res.locals.salesLead as InstanceType<typeof SalesLead>;
    const input = req.body as {
      invoiceId?: string;
      amount: number;
      method: "bank_transfer" | "cash" | "razorpay" | "other";
      reference: string;
      note: string;
    };
    let invoice: InstanceType<typeof FinanceInvoice> | null = null;
    if (input.invoiceId) {
      invoice = await FinanceInvoice.findOne({
        _id: objectId(input.invoiceId, "invoice ID"),
        leadId: lead._id,
        franchiseId: lead.franchiseId,
      });
      if (!invoice) throw new ApiError(404, "Invoice not found for this lead.");
      // BUG FIX #8: match the guards used by the Finance createPayment path.
      if (invoice.status === "cancelled" || invoice.status === "draft") {
        throw new ApiError(409, "Payments can only be recorded for issued invoices.");
      }
      const outstanding = Math.max(0, invoice.total - invoice.paidAmount);
      if (input.amount > outstanding) {
        throw new ApiError(400, "Payment exceeds the outstanding invoice balance.");
      }
    }
    const payment = await FinancePayment.create({
      franchiseId: lead.franchiseId,
      ...(invoice ? { invoiceId: invoice._id } : {}),
      amount: input.amount,
      method: input.method,
      reference: input.reference,
      note: input.note,
      currency: invoice?.currency ?? "INR",
      createdBy: actorId(req),
    });
    return res.status(201).json({ success: true, payment });
  } catch (error) {
    next(error);
  }
};

export const uploadLeadPaymentProof = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const lead = res.locals.salesLead as InstanceType<typeof SalesLead>;
    const paymentId = objectId((req.body as { paymentId?: string }).paymentId, "payment ID");
    const payment = await FinancePayment.findOne({
      _id: paymentId,
      franchiseId: lead.franchiseId,
    }).select("invoiceId");
    if (!payment?.invoiceId || !(await FinanceInvoice.exists({
      _id: payment.invoiceId,
      leadId: lead._id,
      franchiseId: lead.franchiseId,
    }))) {
      throw new ApiError(404, "Payment not found for this lead.");
    }
    await uploadFinancePaymentProof(req, res, next);
  } catch (error) {
    next(error);
  }
};

export const listSalesCampaigns = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const franchiseId = await resolveFranchiseScope(req);
    const filter = franchiseId ? { franchiseId } : {};
    const items = await SalesCampaign.find(filter).sort({ createdAt: -1 }).lean();
    return res.status(200).json({ success: true, items });
  } catch (error) {
    next(error);
  }
};
