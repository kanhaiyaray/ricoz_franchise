export type SalesStatus =
  | "new"
  | "contacted"
  | "qualified"
  | "proposal"
  | "won"
  | "lost";

export type SalesActivity = {
  _id: string;
  type: "call" | "email" | "meeting" | "note" | "follow_up";
  subject: string;
  note: string;
  dueAt?: string;
  completedAt?: string;
  createdAt: string;
};

export type SalesLead = {
  _id: string;
  franchiseId: string | { _id: string; name: string };
  name: string;
  email: string;
  phone: string;
  company: string;
  source: string;
  status: SalesStatus;
  pipelineKey: string;
  stage: string;
  ownerId?: string | { _id: string; name: string; email: string };
  notes: string;
  archivedAt?: string;
  imported: boolean;
  activities: SalesActivity[];
  createdAt: string;
  updatedAt: string;
};

export type SalesTask = {
  _id: string;
  title: string;
  description: string;
  leadId?: string | { _id: string; name: string; company: string };
  assignedTo: string | { _id: string; name: string; email: string };
  dueAt?: string;
  priority: "low" | "normal" | "high";
  status: "open" | "completed" | "cancelled";
  accountability: boolean;
  report: string;
  reviewStatus: "not_submitted" | "pending" | "approved" | "rejected";
  reviewNote: string;
  comments: Array<{ text: string; createdAt: string; userId: string }>;
  createdAt: string;
};

export type SalesPipeline = {
  _id: string;
  key: string;
  name: string;
  stages: string[];
};

export type SalesResponseList<T> = {
  success: true;
  items: T[];
  total: number;
  page: number;
  limit: number;
};

export type SalesLeadInput = {
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  source?: string;
  status?: SalesStatus;
  pipelineKey?: string;
  stage?: string;
  notes?: string;
};
