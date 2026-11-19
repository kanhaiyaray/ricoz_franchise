import { Router } from "express";
import fileUpload from "express-fileupload";
import { auth, requireRole } from "../../middleware/auth.middleware.js";
import { errorHandler } from "../../middleware/error_handler.middleware.js";
import { validateRequest } from "../../middleware/validate_request.middleware.js";
import { USER_ROLES } from "../../models/user.models.js";
import {
  archiveLead,
  assignLead,
  bulkUpdateImportedLeads,
  commentOnTask,
  completeLeadActivity,
  completeTask,
  createLead,
  createLeadActivity,
  createLeadPayment,
  createTask,
  deleteLeads,
  ensureLeadAccess,
  getLead,
  importLeads,
  listAccountabilityLeads,
  listAccountabilityTasks,
  listImportedLeads,
  listLeadInvoices,
  listLeads,
  listPipelines,
  listSalesCampaigns,
  previewLeadInvoice,
  requestLeadDeletionOtp,
  rescheduleLeadActivity,
  reviewTaskReport,
  salesAccess,
  salesAssistantChat,
  salesAssistantOverview,
  salesDashboard,
  salesReports,
  submitTaskReport,
  unavailableSalesIntegration,
  unavailableSalesWebhook,
  updateLead,
  updateLeadInvoice,
  updatePipeline,
  uploadLeadPaymentProof,
} from "./sales.controller.js";
import {
  salesActivityParamsSchema,
  salesActivityRescheduleSchema,
  salesActivitySchema,
  salesAccountabilityParamsSchema,
  salesAssignSchema,
  salesBulkUpdateSchema,
  salesCampaignParamsSchema,
  salesCommentSchema,
  salesDeleteSchema,
  salesDeletionOtpSchema,
  salesImportSchema,
  salesLeadCreateSchema,
  salesLeadInvoiceUpdateSchema,
  salesLeadPaymentSchema,
  salesLeadUpdateSchema,
  salesPipelineParamsSchema,
  salesPipelineUpdateSchema,
  salesQuerySchema,
  salesReviewSchema,
  salesReportSchema,
  salesTaskParamsSchema,
  salesTaskSchema,
} from "./sales.validation.js";
import { createInvoiceFromLead } from "../finance/billing.controller.js";
import { createLeadInvoiceSchema, leadParamsSchema } from "../finance/finance.validation.js";

const salesRouter = Router();
salesRouter.use(auth, requireRole(USER_ROLES.ADMIN, USER_ROLES.FRANCHISE));

salesRouter.get("/dashboard", salesDashboard, errorHandler);
salesRouter.get("/access", salesAccess, errorHandler);
salesRouter.get("/pipelines", listPipelines, errorHandler);
salesRouter.put(
  "/pipelines/:key",
  validateRequest(salesPipelineParamsSchema),
  validateRequest(salesPipelineUpdateSchema),
  updatePipeline,
  errorHandler,
);
salesRouter.get("/assistant/overview", salesAssistantOverview, errorHandler);
salesRouter.post("/assistant/chat", salesAssistantChat, errorHandler);

salesRouter.get("/leads", validateRequest(salesQuerySchema), listLeads, errorHandler);
salesRouter.post(
  "/leads",
  validateRequest(salesLeadCreateSchema),
  createLead,
  errorHandler,
);
salesRouter.post(
  "/leads/import",
  validateRequest(salesImportSchema),
  importLeads,
  errorHandler,
);
salesRouter.get(
  "/leads/imported",
  validateRequest(salesQuerySchema),
  listImportedLeads,
  errorHandler,
);
salesRouter.patch(
  "/leads/imported/bulk-update",
  validateRequest(salesBulkUpdateSchema),
  bulkUpdateImportedLeads,
  errorHandler,
);
salesRouter.get(
  "/leads/imported/whatsapp-accounts",
  unavailableSalesIntegration,
  errorHandler,
);
salesRouter.get(
  "/leads/imported/whatsapp-templates",
  unavailableSalesIntegration,
  errorHandler,
);
salesRouter.get(
  "/leads/imported/campaigns",
  listSalesCampaigns,
  errorHandler,
);
salesRouter.get(
  "/leads/imported/campaigns/:campaignId/recipients",
  validateRequest(salesCampaignParamsSchema),
  unavailableSalesIntegration,
  errorHandler,
);
salesRouter.post(
  "/leads/imported/campaigns",
  unavailableSalesIntegration,
  errorHandler,
);
salesRouter.post(
  "/leads/imported/campaigns/:campaignId/retry",
  validateRequest(salesCampaignParamsSchema),
  unavailableSalesIntegration,
  errorHandler,
);
salesRouter.post(
  "/leads/deletion-otp",
  validateRequest(salesDeletionOtpSchema),
  requestLeadDeletionOtp,
  errorHandler,
);
salesRouter.delete(
  "/leads",
  validateRequest(salesDeleteSchema),
  deleteLeads,
  errorHandler,
);

salesRouter.get(
  "/accountability/tasks",
  validateRequest(salesQuerySchema),
  listAccountabilityTasks,
  errorHandler,
);
salesRouter.post(
  "/accountability/tasks",
  validateRequest(salesTaskSchema),
  createTask,
  errorHandler,
);
salesRouter.get(
  "/accountability/leads",
  validateRequest(salesQuerySchema),
  listAccountabilityLeads,
  errorHandler,
);
salesRouter.post(
  "/accountability/tasks/:id/reports",
  validateRequest(salesAccountabilityParamsSchema),
  validateRequest(salesReportSchema),
  submitTaskReport,
  errorHandler,
);
salesRouter.patch(
  "/accountability/tasks/:id/review",
  validateRequest(salesAccountabilityParamsSchema),
  validateRequest(salesReviewSchema),
  reviewTaskReport,
  errorHandler,
);
salesRouter.post(
  "/accountability/tasks/:id/comments",
  validateRequest(salesAccountabilityParamsSchema),
  validateRequest(salesCommentSchema),
  commentOnTask,
  errorHandler,
);

salesRouter.post("/tasks", validateRequest(salesTaskSchema), createTask, errorHandler);
salesRouter.patch(
  "/tasks/:taskId/complete",
  validateRequest(salesTaskParamsSchema),
  completeTask,
  errorHandler,
);
salesRouter.get("/reports", validateRequest(salesQuerySchema), salesReports, errorHandler);

salesRouter.use("/leads/:leadId", ensureLeadAccess);
salesRouter.get("/leads/:leadId", getLead, errorHandler);
salesRouter.patch(
  "/leads/:leadId",
  validateRequest(salesLeadUpdateSchema),
  updateLead,
  errorHandler,
);
salesRouter.patch("/leads/:leadId/archive", archiveLead, errorHandler);
salesRouter.post(
  "/leads/:leadId/assign",
  validateRequest(salesAssignSchema),
  assignLead,
  errorHandler,
);
salesRouter.post(
  "/leads/:leadId/activities",
  validateRequest(salesActivitySchema),
  createLeadActivity,
  errorHandler,
);
salesRouter.patch(
  "/leads/:leadId/activities/:activityId/complete",
  validateRequest(salesActivityParamsSchema),
  completeLeadActivity,
  errorHandler,
);
salesRouter.patch(
  "/leads/:leadId/activities/:activityId/reschedule",
  validateRequest(salesActivityParamsSchema),
  validateRequest(salesActivityRescheduleSchema),
  rescheduleLeadActivity,
  errorHandler,
);
salesRouter.get("/leads/:leadId/invoices", listLeadInvoices, errorHandler);
salesRouter.post(
  "/leads/:leadId/invoice/preview",
  validateRequest(leadParamsSchema),
  validateRequest(createLeadInvoiceSchema),
  previewLeadInvoice,
  errorHandler,
);
salesRouter.post(
  "/leads/:leadId/invoice",
  validateRequest(leadParamsSchema),
  validateRequest(createLeadInvoiceSchema),
  createInvoiceFromLead,
  errorHandler,
);
salesRouter.patch(
  "/leads/:leadId/invoice",
  validateRequest(salesLeadInvoiceUpdateSchema),
  updateLeadInvoice,
  errorHandler,
);
salesRouter.post(
  "/leads/:leadId/payments",
  validateRequest(salesLeadPaymentSchema),
  createLeadPayment,
  errorHandler,
);
salesRouter.post(
  "/leads/:leadId/payments/proof",
  fileUpload({
    limits: { files: 1, fileSize: 10 * 1024 * 1024 },
    abortOnLimit: true,
    responseOnLimit: JSON.stringify({
      success: false,
      message: "Payment proof exceeds the 10 MB limit.",
    }),
  }),
  uploadLeadPaymentProof,
  errorHandler,
);

const salesWebhookRouter = Router();
salesWebhookRouter.post("/email-status", unavailableSalesWebhook, errorHandler);

export { salesWebhookRouter };
export default salesRouter;
