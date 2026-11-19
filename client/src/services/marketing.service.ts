import axios from "axios";
import api from "./axios";
import type {
  MarketingBlog,
  MarketingCampaign,
  MarketingContent,
  MarketingPage,
  MarketingTask,
} from "./types/marketing.types";

function errorFrom(error: unknown) {
  if (axios.isAxiosError<{ message?: string }>(error) && error.response) {
    return new Error(error.response.data?.message ?? `The Marketing API returned HTTP ${error.response.status}.`);
  }
  return error instanceof Error ? error : new Error("Marketing request failed.");
}

function request<T>(action: () => Promise<T>): Promise<T> {
  return action().catch((error: unknown) => {
    throw errorFrom(error);
  });
}

export const MarketingService = {
  dashboard() {
    return request(async () => (await api.get("/marketing/dashboard")).data);
  },
  campaigns(params: Record<string, string | number | undefined> = {}) {
    return request(async () => (await api.get<MarketingPage<MarketingCampaign>>("/marketing/campaigns", { params })).data);
  },
  createCampaign(input: Record<string, unknown>) {
    return request(async () => (await api.post("/marketing/campaigns", input)).data);
  },
  updateCampaign(id: string, input: Record<string, unknown>) {
    return request(async () => (await api.patch(`/marketing/campaigns/${id}`, input)).data);
  },
  submitCampaign(id: string) {
    return request(async () => (await api.patch(`/marketing/campaigns/${id}/submit`)).data);
  },
  reviewCampaign(id: string, decision: "approved" | "rejected", reviewNote: string) {
    return request(async () => (await api.patch(`/marketing/campaigns/${id}/review`, { decision, reviewNote })).data);
  },
  content(params: Record<string, string | number | undefined> = {}) {
    return request(async () => (await api.get<MarketingPage<MarketingContent>>("/marketing/content", { params })).data);
  },
  createContent(input: Record<string, unknown>) {
    return request(async () => (await api.post("/marketing/content", input)).data);
  },
  updateContent(id: string, input: Record<string, unknown>) {
    return request(async () => (await api.patch(`/marketing/content/${id}`, input)).data);
  },
  blogs(params: Record<string, string | number | undefined> = {}) {
    return request(async () => (await api.get<MarketingPage<MarketingBlog>>("/marketing/blogs", { params })).data);
  },
  publishedBlogs() {
    return request(async () => (await api.get("/marketing/blogs/published")).data);
  },
  createBlog(input: Record<string, unknown>) {
    return request(async () => (await api.post("/marketing/blogs", input)).data);
  },
  updateBlog(id: string, input: Record<string, unknown>) {
    return request(async () => (await api.patch(`/marketing/blogs/${id}`, input)).data);
  },
  tasks(params: Record<string, string | number | undefined> = {}) {
    return request(async () => (await api.get<MarketingPage<MarketingTask>>("/marketing/tasks", { params })).data);
  },
  createTask(input: Record<string, unknown>) {
    return request(async () => (await api.post("/marketing/tasks", input)).data);
  },
  completeTask(id: string) {
    return request(async () => (await api.patch(`/marketing/tasks/${id}/complete`)).data);
  },
  salesOwners() {
    return request(async () => (await api.get("/marketing/leads/sales-owners")).data);
  },
  handoff(input: Record<string, unknown>) {
    return request(async () => (await api.post("/marketing/leads/handoff", input)).data);
  },
  socialAccounts() {
    return request(async () => (await api.get("/marketing/social/accounts")).data);
  },
  connect(provider: string) {
    return request(async () => (await api.post(`/marketing/social/connect/${provider}`)).data);
  },
  socialPosts(params: Record<string, string | number | undefined> = {}) {
    return request(async () => (await api.get("/marketing/social/posts", { params })).data);
  },
  createSocialPost(input: Record<string, unknown>) {
    return request(async () => (await api.post("/marketing/social/posts", input)).data);
  },
  socialInbox() {
    return request(async () => (await api.get("/marketing/social/inbox")).data);
  },
  integration<T>(path: string) {
    return request(async () => (await api.get<T>(path)).data);
  },
};
