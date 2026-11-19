export type FranchiseApplicationStatus =
  | "pending_review"
  | "approving"
  | "approved"
  | "rejected";

export type ApplicationDocumentKind = "aadhaar" | "pan" | "bank_statement";

export type ApplicationDocument = {
  kind: ApplicationDocumentKind;
  originalName: string;
  mimeType: string;
  size: number;
};

export type FranchiseApplicationSummary = {
  _id: string;
  fullName: string;
  email: string;
  mobile: string;
  city: string;
  state: string;
  investment: string;
  status: FranchiseApplicationStatus;
  createdAt: string;
};

export type FranchiseApplicationDetail = FranchiseApplicationSummary & {
  occupation: string;
  reason: string;
  aadhaarNumber: string;
  panNumber: string;
  accountHolder: string;
  bankName: string;
  accountNumber: string;
  ifscCode: string;
  documents: ApplicationDocument[];
  rejectionReason?: string;
};

export type ApplicationsStats = {
  totalApplications: number;
  pendingReview: number;
  approvedPartners: number;
  rejectedApplications: number;
};

export type ApplicationsResponse = {
  success: true;
  stats: ApplicationsStats;
  applications: FranchiseApplicationSummary[];
};

export type ApplicationDetailResponse = {
  success: true;
  application: FranchiseApplicationDetail;
};

export type SubmitApplicationResponse = {
  success: true;
  message: string;
  applicationId: string;
};

export type ApproveApplicationInput = {
  franchiseName: string;
  adminName: string;
  adminEmail: string;
  address: string;
  pincode: string;
  commissionRate: number;
  royaltyRate: number;
  monthlyTarget: number;
  maxStaff: number;
  maxTasks: number;
  territory: string;
};
