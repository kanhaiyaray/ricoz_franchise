export type EmployeeStatus = "available" | "on_task" | "unavailable";

export type EmployeeCategory =
  | "DBA"
  | "DevOps"
  | "Network"
  | "Frontend"
  | "Cloud"
  | "Backend";

export type EmployeeRecord = {
  _id: string;
  name: string;
  designation: string;
  city: string;
  status: EmployeeStatus;
  skills: string[];
  rating: number;
  tasksCompleted: number;
  slaPercent: number;
  createdAt: string;
  updatedAt: string;
};

export type EmployeeStats = {
  availableNow: number;
  onActiveTask: number;
  totalRegistered: number;
  averageRating: number;
};

export type EmployeeInput = {
  name: string;
  designation: string;
  city: string;
  status: EmployeeStatus;
  skills: string[];
  rating: number;
};

export type EmployeeListResponse = {
  success: true;
  employees: EmployeeRecord[];
  stats: EmployeeStats;
};

export type EmployeeDetailResponse = {
  success: true;
  employee: EmployeeRecord;
};
