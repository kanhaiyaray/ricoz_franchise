import type { Request } from "express";
import { Types } from "mongoose";
import {
  Franchise,
  FRANCHISE_STATUSES,
  User,
  USER_ROLES,
} from "../models/index.js";
import { ApiError } from "./apiError.utils.js";

function objectId(value: unknown) {
  return typeof value === "string" && /^[a-f\d]{24}$/i.test(value)
    ? new Types.ObjectId(value)
    : null;
}

export async function resolveFranchiseScope(
  req: Request,
  requestedFranchiseId?: unknown,
) {
  if (!req.user?.id) throw new ApiError(401, "An authenticated session is required.");

  if (req.user.role === USER_ROLES.ADMIN) {
    const requested = requestedFranchiseId ?? req.get("x-franchise-id");
    if (requested === undefined || requested === null || requested === "") {
      return null;
    }
    const id = objectId(requested);
    if (!id) throw new ApiError(400, "Invalid franchise ID.");
    if (!(await Franchise.exists({ _id: id }))) {
      throw new ApiError(404, "Franchise not found.");
    }
    return id;
  }

  if (req.user.role !== USER_ROLES.FRANCHISE) {
    throw new ApiError(403, "You do not have access to this workspace.");
  }

  const user = await User.findById(req.user.id).select("franchiseId accountStatus");
  if (!user) throw new ApiError(403, "Your franchise account is unavailable.");
  // BUG FIX #59: legacy users created before `accountStatus` existed should
  // be treated as active (matches the login behaviour).
  const accountStatus = user.accountStatus ?? "active";
  if (accountStatus !== "active") {
    throw new ApiError(403, "Your franchise account is not active. Contact an administrator.");
  }
  if (!user.franchiseId) {
    throw new ApiError(
      403,
      "Your account is not assigned to a franchise yet. Ask an administrator to link your signup email to the correct franchise.",
    );
  }

  const franchise = await Franchise.findById(user.franchiseId).select("status");
  if (!franchise || franchise.status !== FRANCHISE_STATUSES.ACTIVE) {
    throw new ApiError(403, "Your franchise is not active.");
  }
  return user.franchiseId;
}

export async function requireFranchiseScope(
  req: Request,
  requestedFranchiseId?: unknown,
) {
  const franchiseId = await resolveFranchiseScope(req, requestedFranchiseId);
  if (!franchiseId) {
    throw new ApiError(400, "Select a franchise to complete this operation.");
  }
  return franchiseId;
}

export function assertAdmin(req: Request) {
  if (req.user?.role !== USER_ROLES.ADMIN) {
    throw new ApiError(403, "This action requires an administrator.");
  }
}
