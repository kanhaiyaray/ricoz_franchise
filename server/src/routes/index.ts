import { Router } from "express";
import authRoutes from "../modules/auth/auth.routes.js";
import franchiseRoutes from "../modules/admin/franchise.routes.js";
import {
  adminApplicationRoutes,
  publicApplicationRoutes,
} from "../modules/application/application.routes.js";
import employeeRoutes from "../modules/admin/employee.routes.js";
import financeRoutes, {
  financeWebhookRouter,
} from "../modules/finance/finance.routes.js";
import salesRoutes, {
  salesWebhookRouter,
} from "../modules/sales/sales.routes.js";
import marketingRoutes, {
  marketingPublicIntegrations,
  marketingWebhookRouter,
} from "../modules/marketing/marketing.routes.js";

// Router
const router = Router();

router.use("/auth", authRoutes);
router.use("/admin/applications", adminApplicationRoutes);
router.use("/admin/employees", employeeRoutes);
router.use("/admin", franchiseRoutes);
router.use("/finance/billing/webhooks", financeWebhookRouter);
router.use("/sales/leads/imported/campaigns", salesWebhookRouter);
router.use("/marketing", marketingPublicIntegrations);
router.use("/marketing/social/webhook", marketingWebhookRouter);
router.use("/finance", financeRoutes);
router.use("/sales", salesRoutes);
router.use("/marketing", marketingRoutes);
router.use("/applications", publicApplicationRoutes);

// export router
export default router;
