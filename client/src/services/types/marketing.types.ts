export type MarketingCampaign = {
  _id: string;
  name: string;
  objective: string;
  channels: string[];
  budget: number;
  spent: number;
  startDate?: string;
  endDate?: string;
  status: "draft" | "pending_review" | "approved" | "rejected" | "active" | "completed";
  reviewNote: string;
  createdAt: string;
  updatedAt: string;
};

export type MarketingContent = {
  _id: string;
  campaignId?: string;
  title: string;
  type: "social" | "email" | "blog" | "video" | "design";
  channel: string;
  body: string;
  status: "draft" | "scheduled" | "published" | "needs_review" | "rejected";
  scheduledAt?: string;
  publishedAt?: string;
  createdAt: string;
};

export type MarketingBlog = {
  _id: string;
  title: string;
  slug: string;
  excerpt: string;
  body: string;
  status: "draft" | "published" | "archived";
  publishedAt?: string;
  createdAt: string;
};

export type MarketingTask = {
  _id: string;
  title: string;
  description: string;
  dueAt?: string;
  assignedTo: string | { _id: string; name: string };
  status: "open" | "completed";
  createdAt: string;
};

export type MarketingPage<T> = {
  success: true;
  items: T[];
  total: number;
  page: number;
  limit: number;
};
