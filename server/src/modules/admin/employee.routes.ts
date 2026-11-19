import { Router } from "express";
import { auth, requireRole } from "../../middleware/auth.middleware.js";
import { errorHandler } from "../../middleware/error_handler.middleware.js";
import { validateRequest } from "../../middleware/validate_request.middleware.js";
import { USER_ROLES } from "../../models/user.models.js";
import {
  createEmployee,
  deleteEmployee,
  getEmployee,
  listEmployees,
  updateEmployee,
} from "./employee.controller.js";
import {
  createEmployeeSchema,
  employeeParamsSchema,
  listEmployeesSchema,
  updateEmployeeSchema,
} from "./employee.validation.js";

const router = Router();
router.use(auth, requireRole(USER_ROLES.ADMIN));

router.get(
  "/",
  validateRequest(listEmployeesSchema),
  listEmployees,
  errorHandler,
);
router.post(
  "/",
  validateRequest(createEmployeeSchema),
  createEmployee,
  errorHandler,
);
router.get(
  "/:id",
  validateRequest(employeeParamsSchema),
  getEmployee,
  errorHandler,
);
router.patch(
  "/:id",
  validateRequest(employeeParamsSchema),
  validateRequest(updateEmployeeSchema),
  updateEmployee,
  errorHandler,
);
router.delete(
  "/:id",
  validateRequest(employeeParamsSchema),
  deleteEmployee,
  errorHandler,
);

export default router;
