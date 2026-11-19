import { Router } from "express";
import {
  auth,
  requireRole,
} from "../../middleware/auth.middleware.js";
import { errorHandler } from "../../middleware/error_handler.middleware.js";
import { validateRequest } from "../../middleware/validate_request.middleware.js";
import { USER_ROLES } from "../../models/user.models.js";
import {
  addFranchiseUser,
  attachFranchiseUser,
  createFranchise,
  getDashboard,
  getFranchise,
  listFranchises,
  resendFranchiseInvitation,
  updateFranchise,
  updateFranchiseStatus,
  updateFranchiseUser,
} from "./franchise.controller.js";
import {
  createFranchiseSchema,
  attachFranchiseUserSchema,
  createFranchiseUserSchema,
  listFranchisesSchema,
  updateFranchiseSchema,
  updateFranchiseStatusSchema,
  updateFranchiseUserSchema,
} from "./franchise.validation.js";

const router = Router();
router.use(auth, requireRole(USER_ROLES.ADMIN));

router.get("/dashboard", getDashboard, errorHandler);
router.get(
  "/franchises",
  validateRequest(listFranchisesSchema),
  listFranchises,
  errorHandler,
);
router.post(
  "/franchises",
  validateRequest(createFranchiseSchema),
  createFranchise,
  errorHandler,
);
router.get("/franchises/:id", getFranchise, errorHandler);
router.patch(
  "/franchises/:id",
  validateRequest(updateFranchiseSchema),
  updateFranchise,
  errorHandler,
);
router.patch(
  "/franchises/:id/status",
  validateRequest(updateFranchiseStatusSchema),
  updateFranchiseStatus,
  errorHandler,
);
router.post(
  "/franchises/:id/users",
  validateRequest(createFranchiseUserSchema),
  addFranchiseUser,
  errorHandler,
);
router.post(
  "/franchises/:id/users/attach",
  validateRequest(attachFranchiseUserSchema),
  attachFranchiseUser,
  errorHandler,
);
router.patch(
  "/franchises/:id/users/:userId",
  validateRequest(updateFranchiseUserSchema),
  updateFranchiseUser,
  errorHandler,
);
router.post(
  "/franchises/:id/users/:userId/invite",
  resendFranchiseInvitation,
  errorHandler,
);

export default router;
