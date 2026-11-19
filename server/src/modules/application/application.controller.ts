import type { NextFunction, Request, Response } from "express";
import type { UploadedFile } from "express-fileupload";
import mongoose, { Types } from "mongoose";
import { randomBytes } from "node:crypto";
import { basename } from "node:path";
import bcrypt from "bcryptjs";
import {
  APPLICATION_STATUSES,
  Franchise,
  FranchiseApplication,
  FranchiseAudit,
  USER_ROLES,
  User,
  type ApplicationDocument,
  type ApplicationDocumentKind,
} from "../../models/index.js";
import { ApiError } from "../../utils/apiError.utils.js";
import {
  decryptApplicationData,
  decryptApplicationText,
  encryptApplicationData,
} from "../../utils/application-encryption.utils.js";
import { hashToken } from "../../utils/tokens.js";
import { sendFranchiseInvitation } from "../../utils/email.utils.js";
import { resolveClientOrigin } from "../../config/client-origin.js";
import type {
  ApproveApplicationDto,
  ListApplicationsQuery,
  SubmitApplicationDto,
} from "./application.validation.js";

const invitationLifetimeMs = 72 * 60 * 60 * 1000;
const maxTotalUploadBytes = 40 * 1024 * 1024;
const applicationDocumentKinds: Array<{
  field: string;
  kind: ApplicationDocumentKind;
  maxBytes: number;
}> = [
  { field: "aadhaar-document", kind: "aadhaar", maxBytes: 10 * 1024 * 1024 },
  { field: "pan-document", kind: "pan", maxBytes: 10 * 1024 * 1024 },
  { field: "bank-statement", kind: "bank_statement", maxBytes: 20 * 1024 * 1024 },
];

function getGridFsBucket() {
  const db = mongoose.connection.db;
  if (!db) throw new ApiError(503, "Application document storage is unavailable.");
  return new mongoose.mongo.GridFSBucket(db, {
    bucketName: "franchise_application_documents",
  });
}

function getApplicationId(value: string | string[] | undefined) {
  if (typeof value !== "string" || !Types.ObjectId.isValid(value)) {
    throw new ApiError(400, "Invalid application ID.");
  }
  return new Types.ObjectId(value);
}

function getAdminId(req: Request) {
  if (!req.user?.id || !Types.ObjectId.isValid(req.user.id)) {
    throw new ApiError(401, "A valid admin session is required.");
  }
  return new Types.ObjectId(req.user.id);
}

function getUploadedFile(req: Request, field: string): UploadedFile {
  const value = req.files?.[field];
  if (!value || Array.isArray(value)) {
    throw new ApiError(400, `The ${field.replaceAll("-", " ")} file is required.`);
  }
  return value;
}

function hasValidSignature(file: UploadedFile) {
  const bytes = file.data;
  if (file.mimetype === "application/pdf") {
    return bytes.subarray(0, 5).toString("ascii") === "%PDF-";
  }
  if (file.mimetype === "image/jpeg") {
    return bytes.length >= 3 &&
      bytes[0] === 0xff &&
      bytes[1] === 0xd8 &&
      bytes[2] === 0xff;
  }
  if (file.mimetype === "image/png") {
    return bytes.subarray(0, 8).equals(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    );
  }
  return false;
}

function validateUploadedFile(
  file: UploadedFile,
  field: string,
  maxBytes: number,
) {
  if (file.truncated || file.size > maxBytes) {
    throw new ApiError(
      413,
      `${field.replaceAll("-", " ")} exceeds its maximum file size.`,
    );
  }
  if (!hasValidSignature(file)) {
    throw new ApiError(400, `${field.replaceAll("-", " ")} must be a valid PDF, JPG, or PNG file.`);
  }
}

async function storeEncryptedDocument(
  applicationId: Types.ObjectId,
  file: UploadedFile,
  kind: ApplicationDocumentKind,
): Promise<ApplicationDocument> {
  const encrypted = encryptApplicationData(file.data);
  const bucket = getGridFsBucket();
  const upload = bucket.openUploadStream(
    `${applicationId.toHexString()}-${kind}`,
    { metadata: { applicationId, kind } },
  );
  await new Promise<void>((resolve, reject) => {
    upload.once("error", reject);
    upload.once("finish", resolve);
    upload.end(Buffer.from(encrypted.ciphertext, "base64"));
  });

  const safeName = basename(file.name)
    .replace(/[\u0000-\u001f"\\/]/g, "_")
    .slice(0, 160);
  return {
    kind,
    gridFsId: upload.id,
    originalName: safeName || `${kind}.bin`,
    mimeType: file.mimetype,
    size: file.size,
    iv: encrypted.iv,
    authTag: encrypted.authTag,
  };
}

async function removeStoredDocuments(documents: ApplicationDocument[]) {
  if (documents.length === 0) return true;
  const bucket = getGridFsBucket();
  const results = await Promise.allSettled(
    documents.map((document) => bucket.delete(document.gridFsId)),
  );
  return results.every((result) => result.status === "fulfilled");
}

export const submitApplication = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const storedDocuments: ApplicationDocument[] = [];
  try {
    const input: SubmitApplicationDto = req.body;
    const files = applicationDocumentKinds.map(({ field, kind, maxBytes }) => {
      const file = getUploadedFile(req, field);
      validateUploadedFile(file, field, maxBytes);
      return { file, kind };
    });
    const totalSize = files.reduce((sum, { file }) => sum + file.size, 0);
    if (totalSize > maxTotalUploadBytes) {
      throw new ApiError(413, "Application documents exceed the combined 40MB limit.");
    }

    const applicationId = new Types.ObjectId();
    const encryptedData = {
      aadhaarNumber: encryptApplicationData(input.aadhaarNumber),
      panNumber: encryptApplicationData(input.panNumber),
      accountHolder: encryptApplicationData(input.accountHolder),
      bankName: encryptApplicationData(input.bankName),
      accountNumber: encryptApplicationData(input.accountNumber),
      ifscCode: encryptApplicationData(input.ifscCode),
      reason: encryptApplicationData(input.reason),
    };

    try {
      for (const { file, kind } of files) {
        storedDocuments.push(
          await storeEncryptedDocument(applicationId, file, kind),
        );
      }
      const application = await FranchiseApplication.create({
        _id: applicationId,
        fullName: input.fullName,
        mobile: input.mobile,
        email: input.email.toLowerCase(),
        city: input.city,
        state: input.state,
        occupation: input.occupation,
        investment: input.investment,
        termsAccepted: true,
        ...encryptedData,
        documents: storedDocuments,
        status: APPLICATION_STATUSES.PENDING,
      });
      return res.status(201).json({
        success: true,
        message: "Your franchise application has been submitted for review.",
        applicationId: application._id,
      });
    } catch (error) {
      const cleaned = await removeStoredDocuments(storedDocuments);
      if (!cleaned) {
        console.error("Failed to clean up an incomplete franchise application upload.");
        return next(
          new ApiError(
            500,
            "Application submission failed and uploaded documents could not be fully removed.",
          ),
        );
      }
      throw error;
    }
  } catch (error) {
    next(error);
  }
};

export const listApplications = async (
  _req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const query = res.locals.query as ListApplicationsQuery;
    const filter: Record<string, unknown> = {};
    if (query.status === APPLICATION_STATUSES.PENDING) {
      filter.status = {
        $in: [APPLICATION_STATUSES.PENDING, APPLICATION_STATUSES.APPROVING],
      };
    } else if (query.status) {
      filter.status = query.status;
    }
    if (query.q) {
      const escapedQuery = query.q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.$or = [
        { fullName: { $regex: escapedQuery, $options: "i" } },
        { email: { $regex: escapedQuery, $options: "i" } },
        { city: { $regex: escapedQuery, $options: "i" } },
        { state: { $regex: escapedQuery, $options: "i" } },
      ];
    }

    const [
      totalApplications,
      pendingReview,
      approvedPartners,
      rejectedApplications,
      applications,
    ] = await Promise.all([
      FranchiseApplication.countDocuments(),
      FranchiseApplication.countDocuments({
        status: {
          $in: [APPLICATION_STATUSES.PENDING, APPLICATION_STATUSES.APPROVING],
        },
      }),
      FranchiseApplication.countDocuments({
        status: APPLICATION_STATUSES.APPROVED,
      }),
      FranchiseApplication.countDocuments({
        status: APPLICATION_STATUSES.REJECTED,
      }),
      FranchiseApplication.find(filter)
        .sort({ createdAt: -1 })
        .limit(100)
        .select("fullName email mobile city state investment status createdAt")
        .lean(),
    ]);

    return res.status(200).json({
      success: true,
      stats: {
        totalApplications,
        pendingReview,
        approvedPartners,
        rejectedApplications,
      },
      applications,
    });
  } catch (error) {
    next(error);
  }
};

export const getApplication = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const application = await FranchiseApplication.findById(
      getApplicationId(req.params.id),
    ).lean();
    if (!application) throw new ApiError(404, "Application not found.");

    return res.status(200).json({
      success: true,
      application: {
        _id: application._id,
        fullName: application.fullName,
        email: application.email,
        mobile: application.mobile,
        city: application.city,
        state: application.state,
        occupation: application.occupation,
        investment: application.investment,
        reason: decryptApplicationText(application.reason),
        aadhaarNumber: decryptApplicationText(application.aadhaarNumber),
        panNumber: decryptApplicationText(application.panNumber),
        accountHolder: decryptApplicationText(application.accountHolder),
        bankName: decryptApplicationText(application.bankName),
        accountNumber: decryptApplicationText(application.accountNumber),
        ifscCode: decryptApplicationText(application.ifscCode),
        documents: application.documents.map((document) => ({
          kind: document.kind,
          originalName: document.originalName,
          mimeType: document.mimeType,
          size: document.size,
        })),
        status: application.status,
        rejectionReason: application.rejectionReason,
        createdAt: application.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const downloadApplicationDocument = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const application = await FranchiseApplication.findById(
      getApplicationId(req.params.id),
    ).lean();
    if (!application) throw new ApiError(404, "Application not found.");
    const kind = req.params.kind;
    const document = application.documents.find((item) => item.kind === kind);
    if (!document) throw new ApiError(404, "Application document not found.");

    const bucket = getGridFsBucket();
    const gridFsFile = await bucket.find({ _id: document.gridFsId }).next();
    if (!gridFsFile) throw new ApiError(404, "Application document not found.");
    const encryptedChunks: Buffer[] = [];
    for await (const chunk of bucket.openDownloadStream(document.gridFsId)) {
      encryptedChunks.push(Buffer.from(chunk));
    }
    const content = decryptApplicationData({
      ciphertext: Buffer.concat(encryptedChunks).toString("base64"),
      iv: document.iv,
      authTag: document.authTag,
    });
    const downloadName = encodeURIComponent(document.originalName);
    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${downloadName}`);
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    return res.status(200).send(content);
  } catch (error) {
    next(error);
  }
};

export const rejectApplication = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const actorId = getAdminId(req);
    const applicationId = getApplicationId(req.params.id);
    const application = await FranchiseApplication.findOneAndUpdate(
      { _id: applicationId, status: APPLICATION_STATUSES.PENDING },
      {
        $set: {
          status: APPLICATION_STATUSES.REJECTED,
          reviewedBy: actorId,
          reviewedAt: new Date(),
          rejectionReason: req.body.reason,
        },
      },
      { new: true },
    );
    if (!application) {
      if (!(await FranchiseApplication.exists({ _id: applicationId }))) {
        throw new ApiError(404, "Application not found.");
      }
      throw new ApiError(409, "Only pending applications can be rejected.");
    }

    return res.status(200).json({
      success: true,
      message: "Application rejected.",
      applicationId: application._id,
    });
  } catch (error) {
    next(error);
  }
};

export const approveApplication = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  let applicationId: Types.ObjectId | undefined;
  let actorId: Types.ObjectId | undefined;
  let createdUserId: Types.ObjectId | undefined;
  let createdFranchiseId: Types.ObjectId | undefined;
  let approvalLocked = false;

  try {
    actorId = getAdminId(req);
    applicationId = getApplicationId(req.params.id);
    const input: ApproveApplicationDto = req.body;
    const application = await FranchiseApplication.findOneAndUpdate(
      { _id: applicationId, status: APPLICATION_STATUSES.PENDING },
      {
        $set: {
          status: APPLICATION_STATUSES.APPROVING,
          reviewedBy: actorId,
          reviewedAt: new Date(),
        },
      },
      { new: true },
    );
    if (!application) {
      if (!(await FranchiseApplication.exists({ _id: applicationId }))) {
        throw new ApiError(404, "Application not found.");
      }
      throw new ApiError(409, "Only pending applications can be approved.");
    }
    approvalLocked = true;

    const adminEmail = input.adminEmail.toLowerCase();
    if (await User.exists({ email: adminEmail })) {
      throw new ApiError(409, "An account with this franchise admin email already exists.");
    }

    const invitationToken = randomBytes(32).toString("hex");
    const randomPassword = randomBytes(32).toString("hex");
    const user = await User.create({
      name: input.adminName,
      email: adminEmail,
      password: await bcrypt.hash(randomPassword, 12),
      role: USER_ROLES.FRANCHISE,
      franchiseRole: "franchise_admin",
      accountStatus: "invited",
      inviteTokenHash: hashToken(invitationToken),
      inviteExpiresAt: new Date(Date.now() + invitationLifetimeMs),
    });
    createdUserId = user._id;

    const franchise = await Franchise.create({
      name: input.franchiseName,
      ownerName: application.fullName,
      email: application.email,
      phone: application.mobile,
      address: input.address,
      city: application.city,
      state: application.state,
      pincode: input.pincode,
      commissionRate: input.commissionRate,
      royaltyRate: input.royaltyRate,
      monthlyTarget: input.monthlyTarget,
      maxStaff: input.maxStaff,
      maxTasks: input.maxTasks,
      territory: input.territory,
      status: "invited",
      createdBy: actorId,
      adminUserId: user._id,
    });
    createdFranchiseId = franchise._id;

    user.franchiseId = franchise._id;
    await user.save();
    await FranchiseAudit.create({
      franchiseId: franchise._id,
      actorId,
      action: "Franchise approved from application",
      details: `Application ${application._id.toString()} approved.`,
    });

    // BUG FIX #3d: record the actual SMTP result instead of assuming success.
    const invitationSent = await sendFranchiseInvitation(
      user.email,
      user.name,
      new URL(
        `/activate?token=${encodeURIComponent(invitationToken)}`,
        resolveClientOrigin(req.get("origin")),
      ).toString(),
    );
    if (!invitationSent) {
      console.warn("Franchise approval invitation email failed for", user.email);
    }

    const approvedApplication = await FranchiseApplication.findOneAndUpdate(
      { _id: applicationId, status: APPLICATION_STATUSES.APPROVING },
      {
        $set: {
          status: APPLICATION_STATUSES.APPROVED,
          approvedFranchiseId: franchise._id,
          reviewedBy: actorId,
          reviewedAt: new Date(),
        },
      },
      { new: true },
    );
    if (!approvedApplication) {
      throw new ApiError(409, "The application changed while approval was being completed.");
    }

    return res.status(200).json({
      success: true,
      message: invitationSent
        ? "Application approved and franchise invitation sent."
        : "Application approved and franchise created, but the invitation email could not be sent. Resend it from the franchise users page.",
      applicationId: approvedApplication._id,
      franchiseId: franchise._id,
      invitationSent,
    });
  } catch (error) {
    if (approvalLocked && applicationId) {
      const cleanupTasks: Promise<unknown>[] = [];
      if (createdFranchiseId) {
        cleanupTasks.push(
          FranchiseAudit.deleteMany({ franchiseId: createdFranchiseId }),
          Franchise.deleteOne({ _id: createdFranchiseId }),
        );
      }
      if (createdUserId) cleanupTasks.push(User.deleteOne({ _id: createdUserId }));
      const cleanupResults = await Promise.allSettled(cleanupTasks);
      const reset = await FranchiseApplication.updateOne(
        { _id: applicationId, status: APPLICATION_STATUSES.APPROVING },
        {
          $set: { status: APPLICATION_STATUSES.PENDING },
          $unset: { reviewedBy: 1, reviewedAt: 1 },
        },
      );
      if (
        cleanupResults.some((result) => result.status === "rejected") ||
        reset.modifiedCount !== 1
      ) {
        console.error("Failed to fully roll back franchise application approval.");
        return next(
          new ApiError(
            500,
            "Application approval failed and cleanup was incomplete. Check the application, franchise, and user records.",
          ),
        );
      }
    }
    next(error);
  }
};
