import type { NextFunction, Request, Response } from "express";
import { Types } from "mongoose";
import {
  MarketingBlog,
  MarketingCampaign,
  MarketingContent,
  MarketingSocialPost,
  MarketingTask,
  SalesLead,
  User,
} from "../../models/index.js";
import { ApiError } from "../../utils/apiError.utils.js";
import {
  assertAdmin,
  requireFranchiseScope,
  resolveFranchiseScope,
} from "../../utils/franchise-scope.utils.js";

type PageQuery = { q?: string; status?: string; page: number; limit: number };

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

function queryFrom(res: Response) {
  return res.locals.query as PageQuery;
}

function textFilter(query: PageQuery) {
  if (!query.q) return {};
  const regex = new RegExp(escapeRegex(query.q), "i");
  return { $or: [{ name: regex }, { title: regex }, { objective: regex }, { body: regex }] };
}

async function scopedFilter(req: Request) {
  const franchiseId = await resolveFranchiseScope(req);
  return franchiseId ? { franchiseId } : {};
}

async function getScopedCampaign(req: Request, id: string | string[] | undefined) {
  const filter: Record<string, unknown> = { _id: objectId(id, "campaign ID") };
  const scope = await resolveFranchiseScope(req);
  if (scope) filter.franchiseId = scope;
  const campaign = await MarketingCampaign.findOne(filter);
  if (!campaign) throw new ApiError(404, "Campaign not found in your accessible scope.");
  return campaign;
}

export const marketingDashboard = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const filter = await scopedFilter(req);
    const franchiseId = await resolveFranchiseScope(req);
    const taskFilter: Record<string, unknown> = { status: "open" };
    if (franchiseId) taskFilter.franchiseId = franchiseId;
    if (req.user?.role !== "admin") taskFilter.assignedTo = actorId(req);
    const [campaigns, content, openTasks, upcomingTasks, leadCount] = await Promise.all([
      MarketingCampaign.aggregate([
        { $match: filter },
        { $group: { _id: "$status", count: { $sum: 1 }, budget: { $sum: "$budget" }, spent: { $sum: "$spent" } } },
      ]),
      MarketingContent.countDocuments({ ...filter, status: "needs_review" }),
      MarketingTask.countDocuments(taskFilter),
      MarketingTask.find({
        ...taskFilter,
        dueAt: { $gte: new Date() },
      }).sort({ dueAt: 1 }).limit(8).lean(),
      SalesLead.countDocuments({
        ...filter,
        source: /marketing/i,
      }),
    ]);
    const statusCounts: Record<string, number> = {};
    let budget = 0;
    let spent = 0;
    for (const item of campaigns) {
      statusCounts[String(item._id)] = Number(item.count);
      budget += Number(item.budget ?? 0);
      spent += Number(item.spent ?? 0);
    }
    return res.status(200).json({
      success: true,
      metrics: {
        campaignCount: Object.values(statusCounts).reduce((sum, count) => sum + count, 0),
        activeCampaigns: statusCounts.active ?? 0,
        pendingApprovals: statusCounts.pending_review ?? 0,
        contentInReview: content,
        openTasks,
        budget,
        spent,
        handedOffLeads: leadCount,
      },
      campaignStatuses: statusCounts,
      upcomingTasks,
    });
  } catch (error) {
    next(error);
  }
};

export const listCampaigns = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const query = queryFrom(res);
    const { page, limit } = query;
    const filter: Record<string, unknown> = { ...(await scopedFilter(req)), ...textFilter(query) };
    if (query.status) filter.status = query.status;
    const [items, total] = await Promise.all([
      MarketingCampaign.find(filter).sort({ updatedAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      MarketingCampaign.countDocuments(filter),
    ]);
    return res.status(200).json({ success: true, items, total, page, limit });
  } catch (error) {
    next(error);
  }
};

export const createCampaign = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const franchiseId = await requireFranchiseScope(req);
    const actor = actorId(req);
    const campaign = await MarketingCampaign.create({
      ...req.body,
      franchiseId,
      createdBy: actor,
      updatedBy: actor,
    });
    return res.status(201).json({ success: true, campaign });
  } catch (error) {
    next(error);
  }
};

export const updateCampaign = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const campaign = await getScopedCampaign(req, req.params.campaignId);
    if ("status" in req.body) {
      assertAdmin(req);
      const status = String(req.body.status);
      if (!["active", "completed"].includes(status)) {
        throw new ApiError(400, "Use campaign submission and review actions for approval statuses.");
      }
      campaign.status = status as "active" | "completed";
    }
    const { status: _status, ...fields } = req.body as Record<string, unknown>;
    Object.assign(campaign, fields, { updatedBy: actorId(req) });
    await campaign.save();
    return res.status(200).json({ success: true, campaign });
  } catch (error) {
    next(error);
  }
};

export const submitCampaign = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const campaign = await getScopedCampaign(req, req.params.campaignId);
    if (!["draft", "rejected"].includes(campaign.status)) {
      throw new ApiError(409, "Only draft or rejected campaigns can be submitted for review.");
    }
    campaign.status = "pending_review";
    campaign.reviewNote = "";
    campaign.updatedBy = actorId(req);
    await campaign.save();
    return res.status(200).json({ success: true, campaign });
  } catch (error) {
    next(error);
  }
};

export const reviewCampaign = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    assertAdmin(req);
    const campaign = await getScopedCampaign(req, req.params.campaignId);
    if (campaign.status !== "pending_review") {
      throw new ApiError(409, "Only campaigns awaiting review can be reviewed.");
    }
    const input = req.body as { decision: "approved" | "rejected"; reviewNote?: string };
    campaign.status = input.decision;
    campaign.reviewNote = input.reviewNote ?? "";
    campaign.reviewedBy = actorId(req);
    campaign.reviewedAt = new Date();
    campaign.updatedBy = actorId(req);
    await campaign.save();
    return res.status(200).json({ success: true, campaign });
  } catch (error) {
    next(error);
  }
};

export const listContent = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const query = queryFrom(res);
    const filter: Record<string, unknown> = { ...(await scopedFilter(req)), ...textFilter(query) };
    if (query.status) filter.status = query.status;
    const [items, total] = await Promise.all([
      MarketingContent.find(filter).sort({ scheduledAt: 1, updatedAt: -1 }).skip((query.page - 1) * query.limit).limit(query.limit).lean(),
      MarketingContent.countDocuments(filter),
    ]);
    return res.status(200).json({ success: true, items, total, page: query.page, limit: query.limit });
  } catch (error) {
    next(error);
  }
};

export const createContent = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    if (req.body.status === "published") assertAdmin(req);
    const franchiseId = await requireFranchiseScope(req);
    if (req.body.campaignId && !(await MarketingCampaign.exists({
      _id: objectId(req.body.campaignId, "campaign ID"),
      franchiseId,
    }))) {
      throw new ApiError(404, "Campaign not found in this franchise.");
    }
    const actor = actorId(req);
    const content = await MarketingContent.create({
      ...req.body,
      franchiseId,
      createdBy: actor,
      updatedBy: actor,
    });
    return res.status(201).json({ success: true, content });
  } catch (error) {
    next(error);
  }
};

export const updateContent = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    if (req.body.status === "published") assertAdmin(req);
    const filter: Record<string, unknown> = { _id: objectId(req.params.contentId, "content ID") };
    const scope = await resolveFranchiseScope(req);
    if (scope) filter.franchiseId = scope;
    if (req.body.campaignId && !(await MarketingCampaign.exists({
      _id: objectId(req.body.campaignId, "campaign ID"),
      ...(scope ? { franchiseId: scope } : {}),
    }))) {
      throw new ApiError(404, "Campaign not found in your accessible scope.");
    }
    const content = await MarketingContent.findOneAndUpdate(
      filter,
      { $set: { ...req.body, updatedBy: actorId(req) } },
      { new: true, runValidators: true },
    );
    if (!content) throw new ApiError(404, "Content not found in your accessible scope.");
    return res.status(200).json({ success: true, content });
  } catch (error) {
    next(error);
  }
};

export const listBlogs = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const query = queryFrom(res);
    const filter: Record<string, unknown> = { ...(await scopedFilter(req)), ...textFilter(query) };
    if (query.status) filter.status = query.status;
    const [items, total] = await Promise.all([
      MarketingBlog.find(filter).sort({ updatedAt: -1 }).skip((query.page - 1) * query.limit).limit(query.limit).lean(),
      MarketingBlog.countDocuments(filter),
    ]);
    return res.status(200).json({ success: true, items, total, page: query.page, limit: query.limit });
  } catch (error) {
    next(error);
  }
};

export const listPublishedBlogs = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const scope = await resolveFranchiseScope(req);
    const query: Record<string, unknown> = { status: "published" };
    if (scope) query.franchiseId = scope;
    const items = await MarketingBlog.find(query).sort({ publishedAt: -1 }).limit(100).lean();
    return res.status(200).json({ success: true, items });
  } catch (error) {
    next(error);
  }
};

export const createBlog = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    if (req.body.status === "published") assertAdmin(req);
    const franchiseId = await requireFranchiseScope(req);
    const actor = actorId(req);
    const blog = await MarketingBlog.create({
      ...req.body,
      franchiseId,
      createdBy: actor,
      updatedBy: actor,
      ...(req.body.status === "published" ? { publishedAt: new Date() } : {}),
    });
    return res.status(201).json({ success: true, blog });
  } catch (error) {
    next(error);
  }
};

export const updateBlog = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    if (req.body.status === "published") assertAdmin(req);
    const filter: Record<string, unknown> = { _id: objectId(req.params.blogId, "blog ID") };
    const scope = await resolveFranchiseScope(req);
    if (scope) filter.franchiseId = scope;
    const fields = {
      ...req.body,
      updatedBy: actorId(req),
      ...(req.body.status === "published" ? { publishedAt: new Date() } : {}),
    };
    const blog = await MarketingBlog.findOneAndUpdate(
      filter,
      { $set: fields },
      { new: true, runValidators: true },
    );
    if (!blog) throw new ApiError(404, "Blog not found in your accessible scope.");
    return res.status(200).json({ success: true, blog });
  } catch (error) {
    next(error);
  }
};

export const listMarketingTasks = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const query = queryFrom(res);
    const filter: Record<string, unknown> = await scopedFilter(req);
    if (req.user?.role !== "admin") filter.assignedTo = actorId(req);
    if (query.status) filter.status = query.status;
    const [items, total] = await Promise.all([
      MarketingTask.find(filter).sort({ dueAt: 1, createdAt: -1 }).skip((query.page - 1) * query.limit).limit(query.limit).lean(),
      MarketingTask.countDocuments(filter),
    ]);
    return res.status(200).json({ success: true, items, total, page: query.page, limit: query.limit });
  } catch (error) {
    next(error);
  }
};

export const createMarketingTask = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const franchiseId = await requireFranchiseScope(req);
    const actor = actorId(req);
    let assignedTo = actor;
    if (req.body.assignedTo && req.user?.role === "admin") {
      assignedTo = objectId(req.body.assignedTo, "assignee ID");
      if (!(await User.exists({ _id: assignedTo, franchiseId, accountStatus: "active" }))) {
        throw new ApiError(400, "The selected assignee must be active in this franchise.");
      }
    }
    const task = await MarketingTask.create({
      ...req.body,
      franchiseId,
      assignedTo,
      createdBy: actor,
    });
    return res.status(201).json({ success: true, task });
  } catch (error) {
    next(error);
  }
};

export const completeMarketingTask = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const filter: Record<string, unknown> = { _id: objectId(req.params.taskId, "task ID") };
    const scope = await resolveFranchiseScope(req);
    if (scope) filter.franchiseId = scope;
    if (req.user?.role !== "admin") filter.assignedTo = actorId(req);
    const task = await MarketingTask.findOneAndUpdate(
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

export const listSalesOwners = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const scope = await resolveFranchiseScope(req);
    const filter: Record<string, unknown> = { role: "franchise", accountStatus: "active" };
    if (scope) filter.franchiseId = scope;
    const items = await User.find(filter).select("name email franchiseId").sort({ name: 1 }).lean();
    return res.status(200).json({ success: true, items });
  } catch (error) {
    next(error);
  }
};

export const handoffLead = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    assertAdmin(req);
    const franchiseId = await requireFranchiseScope(req);
    const ownerId = objectId(req.body.ownerId, "sales owner ID");
    if (!(await User.exists({ _id: ownerId, franchiseId, role: "franchise", accountStatus: "active" }))) {
      throw new ApiError(400, "Select an active Sales owner in the same franchise.");
    }
    const actor = actorId(req);
    const lead = await SalesLead.create({
      name: req.body.name,
      ...(req.body.email === undefined ? {} : { email: req.body.email }),
      ...(req.body.phone === undefined ? {} : { phone: req.body.phone }),
      ...(req.body.company === undefined ? {} : { company: req.body.company }),
      source: req.body.source ?? "marketing",
      ...(req.body.notes === undefined ? {} : { notes: req.body.notes }),
      franchiseId,
      ownerId,
      createdBy: actor,
      updatedBy: actor,
    });
    return res.status(201).json({ success: true, lead });
  } catch (error) {
    next(error);
  }
};

export const listSocialAccounts = async (
  _req: Request,
  res: Response,
) => res.status(200).json({
  success: true,
  available: false,
  accounts: [],
  message: "No social provider adapter or account credentials are configured.",
});

export const listSocialPosts = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const query = queryFrom(res);
    const filter: Record<string, unknown> = { ...(await scopedFilter(req)) };
    if (query.status) filter.status = query.status;
    const [items, total] = await Promise.all([
      MarketingSocialPost.find(filter).sort({ scheduledAt: 1, createdAt: -1 }).skip((query.page - 1) * query.limit).limit(query.limit).lean(),
      MarketingSocialPost.countDocuments(filter),
    ]);
    return res.status(200).json({
      success: true,
      items,
      total,
      page: query.page,
      limit: query.limit,
      publishingAvailable: false,
      message: "Only locally saved drafts are shown. Connect a configured provider to publish.",
    });
  } catch (error) {
    next(error);
  }
};

export const createSocialPostDraft = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const franchiseId = await requireFranchiseScope(req);
    if (req.body.contentId && !(await MarketingContent.exists({
      _id: objectId(req.body.contentId, "content ID"),
      franchiseId,
    }))) {
      throw new ApiError(404, "Content item not found in this franchise.");
    }
    const post = await MarketingSocialPost.create({
      ...req.body,
      franchiseId,
      status: "draft",
      createdBy: actorId(req),
    });
    return res.status(201).json({
      success: true,
      published: false,
      post,
      message: "Draft saved locally. No external post was published.",
    });
  } catch (error) {
    next(error);
  }
};

export const unavailableMarketingIntegration = (
  _req: Request,
  _res: Response,
  next: NextFunction,
) => next(new ApiError(503, "This Marketing integration is unavailable. Configure the required provider credentials and callback/webhook adapter first."));

export const markSocialConversationRead = unavailableMarketingIntegration;
export const replyToSocialConversation = unavailableMarketingIntegration;
export const deleteSocialAccount = unavailableMarketingIntegration;
export const connectSocialAccount = unavailableMarketingIntegration;
export const listSocialInbox = unavailableMarketingIntegration;
export const listSocialLeads = unavailableMarketingIntegration;
export const metaWebhook = unavailableMarketingIntegration;
