import { Document, Schema, Types, model } from "mongoose";

export interface IFranchiseAudit extends Document {
  _id: Types.ObjectId;
  franchiseId: Types.ObjectId;
  actorId: Types.ObjectId;
  action: string;
  details: string;
  createdAt: Date;
}

const franchiseAuditSchema = new Schema<IFranchiseAudit>(
  {
    franchiseId: {
      type: Schema.Types.ObjectId,
      ref: "Franchise",
      required: true,
    },
    actorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    action: { type: String, required: true, trim: true },
    details: { type: String, default: "", trim: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

franchiseAuditSchema.index({ franchiseId: 1, createdAt: -1 });

export const FranchiseAudit = model<IFranchiseAudit>(
  "FranchiseAudit",
  franchiseAuditSchema,
);
