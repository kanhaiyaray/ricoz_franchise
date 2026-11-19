export type FranchiseStatus = "invited" | "active" | "suspended" | "terminated";
export type FranchiseRole = "franchise_admin" | "manager" | "staff";

export type FranchiseRecord = {
  _id: string;
  name: string;
  ownerName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  commissionRate: number;
  royaltyRate: number;
  monthlyTarget: number;
  maxStaff: number;
  maxTasks: number;
  territory: string;
  status: FranchiseStatus;
  createdAt: string;
  updatedAt: string;
  adminUserId: string;
  permissions: {
    viewNetworkRevenue: boolean;
    exportReports: boolean;
    addEmployeesWithoutApproval: boolean;
  };
};

export type FranchiseUser = {
  _id: string;
  name: string;
  email: string;
  role: "franchise";
  franchiseRole: FranchiseRole;
  accountStatus: "active" | "invited" | "disabled";
  createdAt?: string;
  lastSeen?: string;
};

export type FranchiseAuditLog = {
  _id: string;
  action: string;
  details: string;
  createdAt: string;
  actorId?: string | { name: string; email: string };
};

export type CreateFranchiseInput = Omit<
  FranchiseRecord,
  | "_id"
  | "status"
  | "createdAt"
  | "updatedAt"
  | "adminUserId"
  | "permissions"
> & {
  adminName: string;
  adminEmail: string;
  sendInvitation: boolean;
};

export type UpdateFranchiseInput = Partial<
  Pick<
    FranchiseRecord,
    | "name"
    | "ownerName"
    | "email"
    | "phone"
    | "address"
    | "city"
    | "state"
    | "pincode"
    | "commissionRate"
    | "royaltyRate"
    | "monthlyTarget"
    | "maxStaff"
    | "maxTasks"
    | "territory"
  >
> & {
  permissions?: Partial<FranchiseRecord["permissions"]>;
};

export type DashboardStats = {
  totalFranchises: number;
  activeFranchises: number;
  pendingActivation: number;
  suspendedFranchises: number;
  adminCreated: number;
  selfRegisteredAccounts: number;
  totalEmployees: number;
  revenue: number | null;
  tickets: number | null;
  liveJobs: number | null;
};

export type DashboardResponse = {
  success: true;
  stats: DashboardStats;
  recentFranchises: Array<
    Pick<
      FranchiseRecord,
      "_id" | "name" | "ownerName" | "email" | "status" | "createdAt"
    > & { createdBy?: { name?: string; email?: string } }
  >;
  pendingFranchises: Array<
    Pick<
      FranchiseRecord,
      "_id" | "name" | "ownerName" | "email" | "status" | "createdAt"
    >
  >;
};

export type FranchiseDetailResponse = {
  success: true;
  franchise: FranchiseRecord;
  users: FranchiseUser[];
  auditLogs: FranchiseAuditLog[];
  performance: {
    revenue: number | null;
    completedTasks: number | null;
    customerRating: number | null;
    slaCompliance: number | null;
    message: string;
  };
};
