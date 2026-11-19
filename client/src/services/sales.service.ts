import axios from "axios";
import api from "./axios";
import type {
  SalesLead,
  SalesLeadInput,
  SalesPipeline,
  SalesResponseList,
  SalesTask,
} from "./types/sales.types";

function errorFrom(error: unknown) {
  if (axios.isAxiosError<{ message?: string }>(error) && error.response) {
    return new Error(error.response.data?.message ?? `The Sales API returned HTTP ${error.response.status}.`);
  }
  return error instanceof Error ? error : new Error("Sales request failed.");
}

function request<T>(action: () => Promise<T>): Promise<T> {
  return action().catch((error: unknown) => {
    throw errorFrom(error);
  });
}

export const SalesService = {
  dashboard() {
    return request(async () => (await api.get("/sales/dashboard")).data);
  },
  access() {
    return request(async () => (await api.get("/sales/access")).data);
  },
  pipelines() {
    return request(async () => (await api.get<{ items: SalesPipeline[] }>("/sales/pipelines")).data);
  },
  savePipeline(key: string, input: { name: string; stages: string[] }) {
    return request(async () => (await api.put(`/sales/pipelines/${key}`, input)).data);
  },
  leads(params: Record<string, string | number | undefined> = {}) {
    return request(async () => (await api.get<SalesResponseList<SalesLead>>("/sales/leads", { params })).data);
  },
  lead(id: string) {
    return request(async () => (await api.get<{ lead: SalesLead }>(`/sales/leads/${id}`)).data);
  },
  createLead(input: SalesLeadInput) {
    return request(async () => (await api.post<{ lead: SalesLead }>("/sales/leads", input)).data);
  },
  updateLead(id: string, input: Partial<SalesLeadInput>) {
    return request(async () => (await api.patch<{ lead: SalesLead }>(`/sales/leads/${id}`, input)).data);
  },
  archiveLead(id: string) {
    return request(async () => (await api.patch(`/sales/leads/${id}/archive`)).data);
  },
  assignLead(id: string, ownerId: string) {
    return request(async () => (await api.post(`/sales/leads/${id}/assign`, { ownerId })).data);
  },
  createActivity(id: string, input: { type: string; subject: string; note?: string; dueAt?: string }) {
    return request(async () => (await api.post(`/sales/leads/${id}/activities`, input)).data);
  },
  completeActivity(leadId: string, activityId: string) {
    return request(async () => (await api.patch(`/sales/leads/${leadId}/activities/${activityId}/complete`)).data);
  },
  rescheduleActivity(leadId: string, activityId: string, dueAt: string) {
    return request(async () => (await api.patch(`/sales/leads/${leadId}/activities/${activityId}/reschedule`, { dueAt })).data);
  },
  importLeads(leads: Array<Record<string, unknown>>) {
    return request(async () => (await api.post("/sales/leads/import", { leads })).data);
  },
  imported(params: Record<string, string | number | undefined> = {}) {
    return request(async () => (await api.get<SalesResponseList<SalesLead>>("/sales/leads/imported", { params })).data);
  },
  bulkUpdateImported(input: Record<string, unknown>) {
    return request(async () => (await api.patch("/sales/leads/imported/bulk-update", input)).data);
  },
  requestDeletionOtp(leadIds: string[]) {
    return request(async () => (await api.post("/sales/leads/deletion-otp", { leadIds })).data);
  },
  deleteLeads(leadIds: string[], otp: string) {
    return request(async () => (await api.delete("/sales/leads", { data: { leadIds, otp } })).data);
  },
  accountabilityTasks(params: Record<string, string | number | undefined> = {}) {
    return request(async () => (await api.get<SalesResponseList<SalesTask>>("/sales/accountability/tasks", { params })).data);
  },
  accountabilityLeads(params: Record<string, string | number | undefined> = {}) {
    return request(async () => (await api.get<SalesResponseList<SalesLead>>("/sales/accountability/leads", { params })).data);
  },
  createTask(input: Record<string, unknown>) {
    return request(async () => (await api.post<{ task: SalesTask }>("/sales/tasks", input)).data);
  },
  completeTask(id: string) {
    return request(async () => (await api.patch(`/sales/tasks/${id}/complete`)).data);
  },
  submitReport(id: string, report: string) {
    return request(async () => (await api.post(`/sales/accountability/tasks/${id}/reports`, { report })).data);
  },
  reviewTask(id: string, reviewStatus: "approved" | "rejected", reviewNote: string) {
    return request(async () => (await api.patch(`/sales/accountability/tasks/${id}/review`, { reviewStatus, reviewNote })).data);
  },
  commentTask(id: string, text: string) {
    return request(async () => (await api.post(`/sales/accountability/tasks/${id}/comments`, { text })).data);
  },
  reports() {
    return request(async () => (await api.get("/sales/reports")).data);
  },
  assistantOverview() {
    return request(async () => (await api.get("/sales/assistant/overview")).data);
  },
  assistantChat(message: string) {
    return request(async () => (await api.post("/sales/assistant/chat", { message })).data);
  },
  invoices(leadId: string) {
    return request(async () => (await api.get(`/sales/leads/${leadId}/invoices`)).data);
  },
  previewInvoice(leadId: string, input: Record<string, unknown>) {
    return request(async () => (await api.post(`/sales/leads/${leadId}/invoice/preview`, input)).data);
  },
  createInvoice(leadId: string, input: Record<string, unknown>) {
    return request(async () => (await api.post(`/sales/leads/${leadId}/invoice`, input)).data);
  },
  updateInvoice(leadId: string, input: Record<string, unknown>) {
    return request(async () => (await api.patch(`/sales/leads/${leadId}/invoice`, input)).data);
  },
  createPayment(leadId: string, input: Record<string, unknown>) {
    return request(async () => (await api.post(`/sales/leads/${leadId}/payments`, input)).data);
  },
  uploadPaymentProof(leadId: string, paymentId: string, file: File) {
    const form = new FormData();
    form.set("paymentId", paymentId);
    form.set("proof", file);
    return request(async () => (await api.post(`/sales/leads/${leadId}/payments/proof`, form)).data);
  },
  integration<T>(path: string) {
    return request(async () => (await api.get<T>(path)).data);
  },
};
