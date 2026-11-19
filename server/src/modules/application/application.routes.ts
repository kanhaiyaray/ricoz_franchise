import { Router } from "express";
import fileUpload from "express-fileupload";
import { auth, requireRole } from "../../middleware/auth.middleware.js";
import { applicationRateLimiter } from "../../middleware/rate_limiter.middleware.js";
import { errorHandler } from "../../middleware/error_handler.middleware.js";
import { validateRequest } from "../../middleware/validate_request.middleware.js";
import { USER_ROLES } from "../../models/user.models.js";
import {
  approveApplication,
  downloadApplicationDocument,
  getApplication,
  listApplications,
  rejectApplication,
  submitApplication,
} from "./application.controller.js";
import {
  approveApplicationSchema,
  listApplicationsSchema,
  rejectApplicationSchema,
  submitApplicationSchema,
} from "./application.validation.js";

const publicRouter = Router();
const adminRouter = Router();
const parseApplicationDocuments = fileUpload({
  limits: {
    files: 3,
    fileSize: 20 * 1024 * 1024,
  },
  abortOnLimit: true,
  responseOnLimit: JSON.stringify({
    success: false,
    message: "Application documents exceed the maximum upload size.",
  }),
});

publicRouter.post(
  "/",
  applicationRateLimiter,
  parseApplicationDocuments,
  validateRequest(submitApplicationSchema),
  submitApplication,
  errorHandler,
);

adminRouter.use(auth, requireRole(USER_ROLES.ADMIN));
adminRouter.get(
  "/",
  validateRequest(listApplicationsSchema),
  listApplications,
  errorHandler,
);
adminRouter.get("/:id", getApplication, errorHandler);
adminRouter.get("/:id/documents/:kind", downloadApplicationDocument, errorHandler);
adminRouter.post(
  "/:id/reject",
  validateRequest(rejectApplicationSchema),
  rejectApplication,
  errorHandler,
);
adminRouter.post(
  "/:id/approve",
  validateRequest(approveApplicationSchema),
  approveApplication,
  errorHandler,
);

export { adminRouter as adminApplicationRoutes };
export { publicRouter as publicApplicationRoutes };
