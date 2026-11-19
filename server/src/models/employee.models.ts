import { Document, Schema, Types, model } from "mongoose";

export const EMPLOYEE_STATUSES = {
  AVAILABLE: "available",
  ON_TASK: "on_task",
  UNAVAILABLE: "unavailable",
} as const;

export type EmployeeStatus =
  (typeof EMPLOYEE_STATUSES)[keyof typeof EMPLOYEE_STATUSES];

export interface IEmployee extends Document {
  _id: Types.ObjectId;
  name: string;
  designation: string;
  city: string;
  status: EmployeeStatus;
  skills: string[];
  rating: number;
  tasksCompleted: number;
  slaPercent: number;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const employeeSchema = new Schema<IEmployee>(
  {
    name: { type: String, required: true, trim: true },
    designation: { type: String, required: true, trim: true },
    city: { type: String, default: "", trim: true },
    status: {
      type: String,
      enum: Object.values(EMPLOYEE_STATUSES),
      default: EMPLOYEE_STATUSES.AVAILABLE,
      required: true,
    },
    skills: { type: [String], default: [] },
    rating: { type: Number, min: 1, max: 5, required: true },
    tasksCompleted: { type: Number, min: 0, default: 0 },
    slaPercent: { type: Number, min: 0, max: 100, default: 0 },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);

employeeSchema.index({ status: 1, name: 1 });
employeeSchema.index({ skills: 1 });

export const Employee = model<IEmployee>("Employee", employeeSchema);
