import type { NextFunction, Request, Response } from "express";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { Types } from "mongoose";
import {
  Employee,
  Franchise,
  FranchiseAudit,
  FRANCHISE_STATUSES,
  User,
  USER_ROLES,
} from "../../models/index.js";
import { ApiError } from "../../utils/apiError.utils.js";
import { hashToken } from "../../utils/tokens.js";
import { sendFranchiseInvitation } from "../../utils/email.utils.js";
import { resolveClientOrigin } from "../../config/client-origin.js";
import type {
  CreateFranchiseDto,
  AttachFranchiseUserDto,
  CreateFranchiseUserDto,
  ListFranchisesQuery,
  UpdateFranchiseDto,
  UpdateFranchiseUserDto,
} from "./franchise.validation.js";

const invitationLifetimeMs = 72 * 60 * 60 * 1000;

function getActorId(req: Request) {
  if (!req.user?.id || !Types.ObjectId.isValid(req.user.id)) {
    throw new ApiError(401, "A valid admin session is required.");
  }
  return new Types.ObjectId(req.user.id);
}

function getObjectId(value: string | string[] | undefined, label: string) {
  if (typeof value !== "string" || !Types.ObjectId.isValid(value)) {
    throw new ApiError(400, `Invalid ${label}.`);
  }
  return new Types.ObjectId(value);
}

function makeActivationLink(req: Request, token: string) {
  const link = new URL("/activate", resolveClientOrigin(req.get("origin")));
  link.searchParams.set("token", token);
  return link.toString();
}

async function writeAudit(
  franchiseId: Types.ObjectId,
  actorId: Types.ObjectId,
  action: string,
  details = "",
) {
  await FranchiseAudit.create({ franchiseId, actorId, action, details });
}

export const getDashboard = async (
  _req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    // BUG FIX #11a: `adminCreated` used to count every franchise because
    // `createdBy` is a required field on the schema. Derive it from the
    // audit log where the "Franchise created" action is only recorded on
    // the admin-creation path (vs "Franchise approved from application").
    const [
      totalFranchises,
      activeFranchises,
      pendingActivation,
      suspendedFranchises,
      adminCreatedIds,
      selfRegisteredAccounts,
      totalEmployees,
      recentFranchises,
      pendingFranchises,
    ] = await Promise.all([
      Franchise.countDocuments(),
      Franchise.countDocuments({ status: FRANCHISE_STATUSES.ACTIVE }),
      Franchise.countDocuments({ status: FRANCHISE_STATUSES.INVITED }),
      Franchise.countDocuments({ status: FRANCHISE_STATUSES.SUSPENDED }),
      FranchiseAudit.distinct("franchiseId", { action: "Franchise created" }),
      User.countDocuments({
        role: USER_ROLES.FRANCHISE,
        franchiseId: { $exists: false },
      }),
      // BUG FIX #11b: the employee directory uses the `Employee` model, not
      // `User` rows with role=employee.
      Employee.countDocuments(),
      Franchise.find()
        .sort({ createdAt: -1 })
        .limit(6)
        .select("name ownerName email status createdAt createdBy")
        .populate("createdBy", "name email")
        .lean(),
      Franchise.find({ status: FRANCHISE_STATUSES.INVITED })
        .sort({ createdAt: -1 })
        .limit(3)
        .select("name ownerName email status createdAt")
        .lean(),
    ]);

    return res.status(200).json({
      success: true,
      stats: {
        totalFranchises,
        activeFranchises,
        pendingActivation,
        suspendedFranchises,
        adminCreated: adminCreatedIds.length,
        selfRegisteredAccounts,
        totalEmployees,
        revenue: null,
        tickets: null,
        liveJobs: null,
      },
      recentFranchises,
      pendingFranchises,
    });
  } catch (error) {
    next(error);
  }
};

export const listFranchises = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const query = res.locals.query as ListFranchisesQuery;
    const filter: Record<string, unknown> = {};
    if (query.status) filter.status = query.status;
    if (query.q) {
      const escapedQuery = query.q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.$or = [
        { name: { $regex: escapedQuery, $options: "i" } },
        { ownerName: { $regex: escapedQuery, $options: "i" } },
        { email: { $regex: escapedQuery, $options: "i" } },
      ];
    }

    const franchises = await Franchise.find(filter)
      .sort({ createdAt: -1 })
      .limit(100)
      .populate("createdBy", "name email")
      .lean();

    return res.status(200).json({
      success: true,
      franchises,
      total: franchises.length,
    });
  } catch (error) {
    next(error);
  }
};

export const createFranchise = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  let createdUserId: Types.ObjectId | undefined;
  let createdFranchiseId: Types.ObjectId | undefined;
  let linkedExistingUserId: Types.ObjectId | undefined;
  let previousFranchiseRole: "franchise_admin" | "manager" | "staff" | undefined;

  try {
    const actorId = getActorId(req);
    const input: CreateFranchiseDto = req.body;
    const normalizedAdminEmail = input.adminEmail.toLowerCase();
    let user = await User.findOne({ email: normalizedAdminEmail });
    let invitationToken: string | undefined;
    if (user) {
      if (user.role !== USER_ROLES.FRANCHISE) {
        throw new ApiError(409, "The admin email belongs to a non-franchise account.");
      }
      if (user.franchiseId) {
        throw new ApiError(409, "The admin account is already linked to a franchise.");
      }
      if (user.accountStatus !== "active") {
        throw new ApiError(409, "Only an active, self-registered account can be linked. Use a new email to send an invitation.");
      }
      linkedExistingUserId = user._id;
      previousFranchiseRole = user.franchiseRole;
    } else {
      invitationToken = randomBytes(32).toString("hex");
      const randomPassword = randomBytes(32).toString("hex");
      user = await User.create({
        name: input.adminName,
        email: normalizedAdminEmail,
        password: await bcrypt.hash(randomPassword, 12),
        role: USER_ROLES.FRANCHISE,
        franchiseRole: "franchise_admin",
        accountStatus: "invited",
        inviteTokenHash: hashToken(invitationToken),
        inviteExpiresAt: new Date(Date.now() + invitationLifetimeMs),
      });
      createdUserId = user._id;
    }

    const franchise = await Franchise.create({
      name: input.name,
      ownerName: input.ownerName,
      email: input.email,
      phone: input.phone,
      address: input.address,
      city: input.city,
      state: input.state,
      pincode: input.pincode,
      commissionRate: input.commissionRate,
      royaltyRate: input.royaltyRate,
      monthlyTarget: input.monthlyTarget,
      maxStaff: input.maxStaff,
      maxTasks: input.maxTasks,
      territory: input.territory,
      status: FRANCHISE_STATUSES.INVITED,
      createdBy: actorId,
      adminUserId: user._id,
    });
    createdFranchiseId = franchise._id;

    user.franchiseId = franchise._id;
    user.franchiseRole = "franchise_admin";
    await user.save();
    await writeAudit(
      franchise._id,
      actorId,
      "Franchise created",
      linkedExistingUserId
        ? `Created by admin and linked existing account ${user.email}.`
        : `Created by admin${input.sendInvitation ? " with invitation" : ""}.`,
    );

    // BUG FIX #3a: track the real SMTP outcome instead of assuming success.
    let invitationSent = false;
    if (input.sendInvitation && invitationToken) {
      invitationSent = await sendFranchiseInvitation(
        user.email,
        user.name,
        makeActivationLink(req, invitationToken),
      );
    }

    return res.status(201).json({
      success: true,
      message: linkedExistingUserId
        ? "Franchise created and existing account linked. Activate the franchise to grant workspace access."
        : invitationSent
          ? "Franchise created and invitation sent."
          : "Franchise created. Send the administrator an invitation from the franchise users page.",
      invitationSent,
      existingAccountLinked: Boolean(linkedExistingUserId),
      franchise,
    });
  } catch (error) {
    const cleanupTasks: Promise<unknown>[] = [];
    if (createdFranchiseId) {
      cleanupTasks.push(
        FranchiseAudit.deleteMany({ franchiseId: createdFranchiseId }),
        Franchise.deleteOne({ _id: createdFranchiseId }),
      );
    }
    if (createdUserId) {
      cleanupTasks.push(User.deleteOne({ _id: createdUserId }));
    }
    if (linkedExistingUserId && createdFranchiseId) {
      const unset: Record<string, 1> = { franchiseId: 1 };
      const set: Record<string, unknown> = {};
      if (previousFranchiseRole) {
        set.franchiseRole = previousFranchiseRole;
      } else {
        unset.franchiseRole = 1;
      }
      cleanupTasks.push(
        User.updateOne(
          { _id: linkedExistingUserId, franchiseId: createdFranchiseId },
          {
            ...(Object.keys(set).length ? { $set: set } : {}),
            $unset: unset,
          },
        ),
      );
    }
    const cleanupResults = await Promise.allSettled(cleanupTasks);
    if (cleanupResults.some((result) => result.status === "rejected")) {
      console.error("Failed to fully roll back franchise creation.");
      return next(
        new ApiError(
          500,
          "Franchise creation failed and cleanup was incomplete. Check the franchise and user records.",
        ),
      );
    }
    next(error);
  }
};

export const getFranchise = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const franchiseId = getObjectId(req.params.id, "franchise ID");
    const franchise = await Franchise.findById(franchiseId)
      .populate("createdBy", "name email")
      .lean();
    if (!franchise) throw new ApiError(404, "Franchise not found.");

    const [users, auditLogs] = await Promise.all([
      User.find({ franchiseId })
        .select("name email role franchiseRole accountStatus createdAt lastSeen")
        .sort({ createdAt: 1 })
        .lean(),
      FranchiseAudit.find({ franchiseId })
        .sort({ createdAt: -1 })
        .limit(100)
        .populate("actorId", "name email")
        .lean(),
    ]);

    return res.status(200).json({
      success: true,
      franchise,
      users,
      auditLogs,
      performance: {
        revenue: null,
        completedTasks: null,
        customerRating: null,
        slaCompliance: null,
        message: "Operational performance data is not available yet.",
      },
    });
  } catch (error) {
    next(error);
  }
};

export const updateFranchise = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const actorId = getActorId(req);
    const franchiseId = getObjectId(req.params.id, "franchise ID");
    const input: UpdateFranchiseDto = req.body;
    const franchise = await Franchise.findById(franchiseId);
    if (!franchise) throw new ApiError(404, "Franchise not found.");
    if (franchise.status === FRANCHISE_STATUSES.TERMINATED) {
      throw new ApiError(409, "Terminated franchises cannot be edited.");
    }

    const { permissions, ...fields } = input;
    Object.assign(franchise, fields);
    if (permissions) {
      if (permissions.viewNetworkRevenue !== undefined) {
        franchise.set("permissions.viewNetworkRevenue", permissions.viewNetworkRevenue);
      }
      if (permissions.exportReports !== undefined) {
        franchise.set("permissions.exportReports", permissions.exportReports);
      }
      if (permissions.addEmployeesWithoutApproval !== undefined) {
        franchise.set(
          "permissions.addEmployeesWithoutApproval",
          permissions.addEmployeesWithoutApproval,
        );
      }
    }
    await franchise.save();
    await writeAudit(
      franchise._id,
      actorId,
      "Franchise details updated",
      Object.keys(input).join(", "),
    );

    return res.status(200).json({ success: true, franchise });
  } catch (error) {
    next(error);
  }
};

export const updateFranchiseStatus = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const actorId = getActorId(req);
    const franchiseId = getObjectId(req.params.id, "franchise ID");
    const { status } = req.body as { status: "active" | "suspended" | "terminated" };
    const franchise = await Franchise.findById(franchiseId);
    if (!franchise) throw new ApiError(404, "Franchise not found.");
    if (
      franchise.status === FRANCHISE_STATUSES.TERMINATED &&
      status !== FRANCHISE_STATUSES.TERMINATED
    ) {
      throw new ApiError(409, "Terminated franchises cannot be reactivated.");
    }

    const previousStatus = franchise.status;
    franchise.status = status;
    await franchise.save();

    if (status === FRANCHISE_STATUSES.SUSPENDED || status === FRANCHISE_STATUSES.TERMINATED) {
      await User.updateMany(
        { franchiseId, accountStatus: { $ne: "invited" } },
        { $set: { accountStatus: "disabled" } },
      );
    } else if (status === FRANCHISE_STATUSES.ACTIVE) {
      await User.updateMany(
        { franchiseId, accountStatus: "disabled" },
        { $set: { accountStatus: "active" } },
      );
    }

    await writeAudit(
      franchise._id,
      actorId,
      "Franchise status changed",
      `${previousStatus} -> ${status}`,
    );
    return res.status(200).json({ success: true, franchise });
  } catch (error) {
    next(error);
  }
};

export const addFranchiseUser = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  let createdUserId: Types.ObjectId | undefined;
  try {
    const actorId = getActorId(req);
    const franchiseId = getObjectId(req.params.id, "franchise ID");
    const input: CreateFranchiseUserDto = req.body;
    const franchise = await Franchise.findById(franchiseId);
    if (!franchise) throw new ApiError(404, "Franchise not found.");
    if (
      franchise.status === FRANCHISE_STATUSES.SUSPENDED ||
      franchise.status === FRANCHISE_STATUSES.TERMINATED
    ) {
      throw new ApiError(409, "Users cannot be added to an inactive franchise.");
    }
    if (await User.exists({ email: input.email })) {
      throw new ApiError(409, "An account with this email already exists.");
    }

    const token = randomBytes(32).toString("hex");
    const user = await User.create({
      name: input.name,
      email: input.email,
      password: await bcrypt.hash(randomBytes(32).toString("hex"), 12),
      role: USER_ROLES.FRANCHISE,
      franchiseRole: input.franchiseRole,
      accountStatus: "invited",
      franchiseId,
      inviteTokenHash: hashToken(token),
      inviteExpiresAt: new Date(Date.now() + invitationLifetimeMs),
    });
    createdUserId = user._id;

    // BUG FIX #3b: report the real SMTP outcome. Keep the invited user so
    // the admin can resend from the franchise users page if SMTP is broken.
    const invitationSent = await sendFranchiseInvitation(
      user.email,
      user.name,
      makeActivationLink(req, token),
    );
    await writeAudit(
      franchiseId,
      actorId,
      "Franchise user invited",
      `${user.email} (${input.franchiseRole})`,
    );

    return res.status(201).json({
      success: true,
      message: invitationSent
        ? "User invitation sent."
        : "User created but invitation email could not be sent. Retry from the franchise users page.",
      invitationSent,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        franchiseRole: user.franchiseRole,
        accountStatus: user.accountStatus,
      },
    });
  } catch (error) {
    if (createdUserId) {
      await User.deleteOne({ _id: createdUserId });
    }
    next(error);
  }
};

export const attachFranchiseUser = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const actorId = getActorId(req);
    const franchiseId = getObjectId(req.params.id, "franchise ID");
    const { email, franchiseRole } = req.body as AttachFranchiseUserDto;
    const franchise = await Franchise.findById(franchiseId);
    if (!franchise) throw new ApiError(404, "Franchise not found.");
    if (
      franchise.status === FRANCHISE_STATUSES.SUSPENDED ||
      franchise.status === FRANCHISE_STATUSES.TERMINATED
    ) {
      throw new ApiError(409, "Users cannot be linked to an inactive franchise.");
    }

    const user = await User.findOneAndUpdate(
      {
        email: email.toLowerCase(),
        role: USER_ROLES.FRANCHISE,
        accountStatus: "active",
        $or: [
          { franchiseId: { $exists: false } },
          { franchiseId: null },
        ],
      },
      { $set: { franchiseId, franchiseRole } },
      { new: true },
    ).select("name email role franchiseRole accountStatus");
    if (!user) {
      const existing = await User.findOne({ email: email.toLowerCase() })
        .select("role franchiseId accountStatus")
        .lean();
      if (!existing) throw new ApiError(404, "No account exists with this email.");
      if (existing.role !== USER_ROLES.FRANCHISE) {
        throw new ApiError(409, "This email belongs to a non-franchise account.");
      }
      if (existing.franchiseId) {
        throw new ApiError(409, "This account is already linked to a franchise.");
      }
      throw new ApiError(409, "This account is not active and cannot be linked.");
    }

    if (franchiseRole === "franchise_admin") {
      franchise.adminUserId = user._id;
      await franchise.save();
    }
    await writeAudit(
      franchiseId,
      actorId,
      "Self-registered franchise account linked",
      `${user.email} (${franchiseRole})`,
    );

    return res.status(200).json({
      success: true,
      message: "Existing account linked to the franchise.",
      user,
    });
  } catch (error) {
    next(error);
  }
};

export const updateFranchiseUser = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const actorId = getActorId(req);
    const franchiseId = getObjectId(req.params.id, "franchise ID");
    const userId = getObjectId(req.params.userId, "user ID");
    const input: UpdateFranchiseUserDto = req.body;
    const franchise = await Franchise.findById(franchiseId).select("status");
    if (!franchise) throw new ApiError(404, "Franchise not found.");
    if (
      franchise.status === FRANCHISE_STATUSES.SUSPENDED ||
      franchise.status === FRANCHISE_STATUSES.TERMINATED
    ) {
      throw new ApiError(409, "Users cannot be edited for an inactive franchise.");
    }
    const user = await User.findOne({
      _id: userId,
      franchiseId,
      role: USER_ROLES.FRANCHISE,
    });
    if (!user) throw new ApiError(404, "Franchise user not found.");
    Object.assign(user, input);
    await user.save();
    await writeAudit(
      franchiseId,
      actorId,
      "Franchise user updated",
      `${user.email}: ${Object.keys(input).join(", ")}`,
    );
    return res.status(200).json({
      success: true,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        franchiseRole: user.franchiseRole,
        accountStatus: user.accountStatus,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const resendFranchiseInvitation = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const actorId = getActorId(req);
    const franchiseId = getObjectId(req.params.id, "franchise ID");
    const userId = getObjectId(req.params.userId, "user ID");
    const franchise = await Franchise.findById(franchiseId);
    if (!franchise) throw new ApiError(404, "Franchise not found.");
    if (
      franchise.status === FRANCHISE_STATUSES.SUSPENDED ||
      franchise.status === FRANCHISE_STATUSES.TERMINATED
    ) {
      throw new ApiError(409, "Invitations cannot be sent for an inactive franchise.");
    }

    const user = await User.findOne({
      _id: userId,
      franchiseId,
      role: USER_ROLES.FRANCHISE,
    }).select("+inviteTokenHash +inviteExpiresAt");
    if (!user) throw new ApiError(404, "Franchise user not found.");

    const token = randomBytes(32).toString("hex");
    user.accountStatus = "invited";
    user.set("inviteTokenHash", hashToken(token));
    user.set("inviteExpiresAt", new Date(Date.now() + invitationLifetimeMs));
    await user.save();

    // BUG FIX #3c: surface SMTP failure as a real 502 instead of claiming success.
    const invitationSent = await sendFranchiseInvitation(
      user.email,
      user.name,
      makeActivationLink(req, token),
    );
    await writeAudit(
      franchiseId,
      actorId,
      "Franchise invitation sent",
      `${user.email} (delivered=${invitationSent})`,
    );
    if (!invitationSent) {
      return res.status(502).json({
        success: false,
        message: "Invitation email could not be sent. Configure SMTP and retry.",
      });
    }

    return res.status(200).json({
      success: true,
      message: `Invitation sent to ${user.email}.`,
    });
  } catch (error) {
    next(error);
  }
};
