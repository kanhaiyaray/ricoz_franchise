import { Router } from "express";
import { auth, requireRole } from "../../middleware/auth.middleware.js";
import { errorHandler } from "../../middleware/error_handler.middleware.js";
import { validateRequest } from "../../middleware/validate_request.middleware.js";
import { USER_ROLES } from "../../models/user.models.js";
import {
  campaignParamsSchema,
  campaignReviewSchema,
  blogParamsSchema,
  contentParamsSchema,
  conversationParamsSchema,
  createBlogSchema,
  createCampaignSchema,
  createContentSchema,
  createMarketingTaskSchema,
  createSocialPostSchema,
  leadHandoffSchema,
  marketingQuerySchema,
  providerParamsSchema,
  socialAccountParamsSchema,
  socialReplySchema,
  taskParamsSchema,
  updateBlogSchema,
  updateCampaignSchema,
  updateContentSchema,
} from "./marketing.validation.js";
import {
  completeMarketingTask,
  connectSocialAccount,
  createBlog,
  createCampaign,
  createContent,
  createMarketingTask,
  createSocialPostDraft,
  deleteSocialAccount,
  handoffLead,
  listBlogs,
  listCampaigns,
  listContent,
  listMarketingTasks,
  listPublishedBlogs,
  listSalesOwners,
  listSocialAccounts,
  listSocialInbox,
  listSocialLeads,
  listSocialPosts,
  markSocialConversationRead,
  marketingDashboard,
  metaWebhook,
  replyToSocialConversation,
  reviewCampaign,
  submitCampaign,
  unavailableMarketingIntegration,
  updateBlog,
  updateCampaign,
  updateContent,
} from "./marketing.controller.js";

const marketingRouter = Router();
marketingRouter.use(auth, requireRole(USER_ROLES.ADMIN, USER_ROLES.FRANCHISE));

marketingRouter.get("/dashboard", marketingDashboard, errorHandler);

marketingRouter.get("/campaigns", validateRequest(marketingQuerySchema), listCampaigns, errorHandler);
marketingRouter.post(
  "/campaigns",
  validateRequest(createCampaignSchema),
  createCampaign,
  errorHandler,
);
marketingRouter.patch(
  "/campaigns/:campaignId",
  validateRequest(campaignParamsSchema),
  validateRequest(updateCampaignSchema),
  updateCampaign,
  errorHandler,
);
marketingRouter.patch(
  "/campaigns/:campaignId/submit",
  validateRequest(campaignParamsSchema),
  submitCampaign,
  errorHandler,
);
marketingRouter.patch(
  "/campaigns/:campaignId/review",
  validateRequest(campaignParamsSchema),
  validateRequest(campaignReviewSchema),
  reviewCampaign,
  errorHandler,
);

marketingRouter.get("/content", validateRequest(marketingQuerySchema), listContent, errorHandler);
marketingRouter.post(
  "/content",
  validateRequest(createContentSchema),
  createContent,
  errorHandler,
);
marketingRouter.patch(
  "/content/:contentId",
  validateRequest(contentParamsSchema),
  validateRequest(updateContentSchema),
  updateContent,
  errorHandler,
);

marketingRouter.get("/blogs/published", validateRequest(marketingQuerySchema), listPublishedBlogs, errorHandler);
marketingRouter.get("/blogs", validateRequest(marketingQuerySchema), listBlogs, errorHandler);
marketingRouter.post("/blogs", validateRequest(createBlogSchema), createBlog, errorHandler);
marketingRouter.patch(
  "/blogs/:blogId",
  validateRequest(blogParamsSchema),
  validateRequest(updateBlogSchema),
  updateBlog,
  errorHandler,
);

marketingRouter.get("/tasks", validateRequest(marketingQuerySchema), listMarketingTasks, errorHandler);
marketingRouter.post(
  "/tasks",
  validateRequest(createMarketingTaskSchema),
  createMarketingTask,
  errorHandler,
);
marketingRouter.patch(
  "/tasks/:taskId/complete",
  validateRequest(taskParamsSchema),
  completeMarketingTask,
  errorHandler,
);

marketingRouter.get("/leads/sales-owners", listSalesOwners, errorHandler);
marketingRouter.post(
  "/leads/handoff",
  validateRequest(leadHandoffSchema),
  handoffLead,
  errorHandler,
);

marketingRouter.get("/social/accounts", listSocialAccounts, errorHandler);
marketingRouter.post(
  "/social/connect/:provider",
  validateRequest(providerParamsSchema),
  connectSocialAccount,
  errorHandler,
);
marketingRouter.delete(
  "/social/accounts/:accountId",
  validateRequest(socialAccountParamsSchema),
  deleteSocialAccount,
  errorHandler,
);
marketingRouter.get("/social/posts", validateRequest(marketingQuerySchema), listSocialPosts, errorHandler);
marketingRouter.post(
  "/social/posts",
  validateRequest(createSocialPostSchema),
  createSocialPostDraft,
  errorHandler,
);
marketingRouter.get("/social/inbox", listSocialInbox, errorHandler);
marketingRouter.patch(
  "/social/inbox/:conversationId/read",
  validateRequest(conversationParamsSchema),
  markSocialConversationRead,
  errorHandler,
);
marketingRouter.post(
  "/social/inbox/:conversationId/reply",
  validateRequest(conversationParamsSchema),
  validateRequest(socialReplySchema),
  replyToSocialConversation,
  errorHandler,
);
marketingRouter.get("/social/leads", listSocialLeads, errorHandler);

const marketingPublicIntegrations = Router();
marketingPublicIntegrations.get(
  "/social/oauth/callback/:provider",
  validateRequest(providerParamsSchema),
  unavailableMarketingIntegration,
  errorHandler,
);
const marketingWebhookRouter = Router();
marketingWebhookRouter.get("/meta", metaWebhook, errorHandler);
marketingWebhookRouter.post("/meta", metaWebhook, errorHandler);

export {
  marketingPublicIntegrations,
  marketingWebhookRouter,
};
export default marketingRouter;
