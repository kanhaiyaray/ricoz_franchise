import axios from "axios";
import api from "./axios";
import type {
  CostPlanRow,
  FinanceInvoice,
  FinanceInvoiceInput,
  FinanceList,
  FinancePayment,
  FinancePaymentInput,
  FinancePlanResponse,
  FinancePlanKind,
  FinanceSummaryResponse,
  BillingDashboardResponse,
  ResourcePlanRow,
  RevenueStream,
} from "./types/finance.types";

function getError(error: unknown) {
  if (axios.isAxiosError<{ message?: string }>(error) && error.response) {
    return new Error(
      error.response.data?.message ??
        `The Finance API returned HTTP ${error.response.status}.`,
    );
  }
  return error instanceof Error ? error : new Error("Finance request failed.");
}

function request<T>(action: () => Promise<T>) {
  return action().catch((error: unknown) => {
    throw getError(error);
  });
}

export const FinanceService = {
  dashboard(consolidated = false): Promise<BillingDashboardResponse> {
    return request(
      async () =>
        (
          await api.get(
            consolidated
              ? "/finance/billing/dashboard/consolidated"
              : "/finance/billing/dashboard",
          )
        ).data as BillingDashboardResponse,
    );
  },
  summary(fiscalYearStart: number): Promise<FinanceSummaryResponse> {
    return request(
      async () =>
        (
          await api.get("/finance/financial-summary/" + fiscalYearStart)
        ).data as FinanceSummaryResponse,
    );
  },
  plan(kind: FinancePlanKind, fiscalYearStart: number): Promise<FinancePlanResponse> {
    return request(
      async () =>
        (
          await api.get<FinancePlanResponse>(
            `/finance/${kind === "revenue" ? "revenue-projections" : kind === "resource" ? "resource-planning" : "cost-planning"}/${fiscalYearStart}`,
          )
        ).data,
    );
  },
  savePlan(
    kind: FinancePlanKind,
    fiscalYearStart: number,
    data:
      | { streams: RevenueStream[] }
      | { resources: ResourcePlanRow[] }
      | { costs: CostPlanRow[] },
  ) {
    const path =
      kind === "revenue"
        ? "revenue-projections"
        : kind === "resource"
          ? "resource-planning"
          : "cost-planning";
    return request(
      async () =>
        (await api.put(`/finance/${path}/${fiscalYearStart}`, data)).data,
    );
  },
  requestRevenueDeletionOtp(fiscalYearStart: number) {
    return request(
      async () =>
        (
          await api.post(
            `/finance/revenue-projections/${fiscalYearStart}/deletion-otp`,
          )
        ).data,
    );
  },
  deleteRevenueStreams(
    fiscalYearStart: number,
    streamIds: string[],
    otp: string,
  ) {
    return request(
      async () =>
        (
          await api.delete(
            `/finance/revenue-projections/${fiscalYearStart}/streams`,
            { data: { streamIds, otp } },
          )
        ).data,
    );
  },
  aiForecast(fiscalYearStart: number) {
    return request(
      async () =>
        (await api.get(`/finance/ai-forecast/${fiscalYearStart}`)).data,
    );
  },
  billingDashboard(consolidated = false) {
    return request(
      async () =>
        (
          await api.get(
            consolidated
              ? "/finance/billing/dashboard/consolidated"
              : "/finance/billing/dashboard",
          )
        ).data,
    );
  },
  settings() {
    return request(async () => (await api.get("/finance/billing/settings")).data);
  },
  saveSettings(input: Record<string, unknown>) {
    return request(
      async () =>
        (await api.put("/finance/billing/settings", input)).data,
    );
  },
  journals(params: Record<string, string | number | undefined> = {}) {
    return request(
      async () =>
        (
          await api.get("/finance/accounting/journals", { params })
        ).data,
    );
  },
  createJournal(input: Record<string, unknown>) {
    return request(
      async () =>
        (await api.post("/finance/accounting/journals", input)).data,
    );
  },
  eliminations(params: Record<string, string | number | undefined> = {}) {
    return request(
      async () =>
        (
          await api.get("/finance/accounting/eliminations", { params })
        ).data,
    );
  },
  createElimination(input: Record<string, unknown>) {
    return request(
      async () =>
        (await api.post("/finance/accounting/eliminations", input)).data,
    );
  },
  decideElimination(id: string, decision: "approved" | "rejected", note: string) {
    return request(
      async () =>
        (
          await api.post(
            `/finance/accounting/eliminations/${id}/decision`,
            { decision, note },
          )
        ).data,
    );
  },
  creditNotes(params: Record<string, string | number | undefined> = {}) {
    return request(
      async () =>
        (await api.get("/finance/billing/credit-notes", { params })).data,
    );
  },
  createCreditNote(invoiceId: string, input: { reason: string; amount: number }) {
    return request(
      async () =>
        (
          await api.post(
            `/finance/billing/invoices/${invoiceId}/credit-notes`,
            input,
          )
        ).data,
    );
  },
  invoices(
    params: Record<string, string | number | undefined> = {},
  ): Promise<FinanceList<FinanceInvoice>> {
    return request(
      async () =>
        (
          await api.get<FinanceList<FinanceInvoice>>(
            "/finance/billing/invoices",
            { params },
          )
        ).data,
    );
  },
  invoice(id: string) {
    return request(
      async () =>
        (
          await api.get<{ success: true; invoice: FinanceInvoice }>(
            `/finance/billing/invoices/${id}`,
          )
        ).data,
    );
  },
  createInvoice(input: FinanceInvoiceInput) {
    return request(
      async () =>
        (
          await api.post<{ success: true; invoice: FinanceInvoice }>(
            "/finance/billing/invoices",
            input,
          )
        ).data,
    );
  },
  updateInvoice(id: string, input: Partial<FinanceInvoiceInput>) {
    return request(
      async () =>
        (
          await api.patch(
            `/finance/billing/invoices/${id}`,
            input,
          )
        ).data,
    );
  },
  invoiceAction(id: string, action: "issue" | "cancel") {
    return request(
      async () =>
        (await api.post(`/finance/billing/invoices/${id}/${action}`)).data,
    );
  },
  emailInvoice(id: string, email?: string) {
    return request(
      async () =>
        (
          await api.post(`/finance/billing/invoices/${id}/email`, { email })
        ).data,
    );
  },
  createPaymentLink(id: string) {
    return request(
      async () =>
        (
          await api.post(
            `/finance/billing/invoices/${id}/payment-link`,
          )
        ).data,
    );
  },
  invoicePdf(id: string) {
    return request(
      async () =>
        (
          await api.get<Blob>(`/finance/billing/invoices/${id}/pdf`, {
            responseType: "blob",
          })
        ).data,
    );
  },
  payments(
    params: Record<string, string | number | undefined> = {},
  ): Promise<FinanceList<FinancePayment>> {
    return request(
      async () =>
        (
          await api.get<FinanceList<FinancePayment>>(
            "/finance/billing/payments",
            { params },
          )
        ).data,
    );
  },
  payment(id: string) {
    return request(
      async () =>
        (
          await api.get<{ success: true; payment: FinancePayment }>(
            `/finance/billing/payments/${id}`,
          )
        ).data,
    );
  },
  createPayment(input: FinancePaymentInput) {
    return request(
      async () =>
        (
          await api.post<{ success: true; payment: FinancePayment }>(
            "/finance/billing/payments",
            input,
          )
        ).data,
    );
  },
  uploadPaymentProof(paymentId: string, proof: File) {
    const form = new FormData();
    form.set("paymentId", paymentId);
    form.set("proof", proof);
    return request(
      async () =>
        (
          await api.post(
            "/finance/billing/payments/proof",
            form,
          )
        ).data,
    );
  },
  paymentProof(id: string) {
    return request(
      async () =>
        (
          await api.get<Blob>(
            `/finance/billing/payments/${id}/proof`,
            { responseType: "blob" },
          )
        ).data,
    );
  },
  paymentAction(
    id: string,
    action: "verify" | "reject" | "reversals" | "refunds",
    input: Record<string, unknown> = {},
  ) {
    return request(
      async () =>
        (
          await api.post(
            `/finance/billing/payments/${id}/${action}`,
            input,
          )
        ).data,
    );
  },
  refunds(params: Record<string, string | number | undefined> = {}) {
    return request(
      async () =>
        (await api.get("/finance/billing/refunds", { params })).data,
    );
  },
};
