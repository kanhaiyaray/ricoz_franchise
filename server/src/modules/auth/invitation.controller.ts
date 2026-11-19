import type { NextFunction, Request, Response } from "express";
import bcrypt from "bcryptjs";
import { Franchise, FranchiseAudit, User } from "../../models/index.js";
import { ApiError } from "../../utils/apiError.utils.js";
import { hashToken } from "../../utils/tokens.js";
import type { AcceptInvitationDto } from "./invitation.validation.js";

export const acceptInvitation = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const input: AcceptInvitationDto = req.body;
    const user = await User.findOne({
      inviteTokenHash: hashToken(input.token),
      inviteExpiresAt: { $gt: new Date() },
      accountStatus: "invited",
    }).select("+inviteTokenHash +inviteExpiresAt");

    if (!user) {
      throw new ApiError(400, "This invitation is invalid or has expired.");
    }

    const franchise = user.franchiseId
      ? await Franchise.findById(user.franchiseId)
      : null;
    if (
      !franchise ||
      franchise.status === "suspended" ||
      franchise.status === "terminated"
    ) {
      throw new ApiError(403, "This franchise cannot be activated right now.");
    }

    user.password = await bcrypt.hash(input.password, 12);
    user.accountStatus = "active";
    user.set("inviteTokenHash", undefined);
    user.set("inviteExpiresAt", undefined);
    await user.save();

    if (franchise.status === "invited") {
      franchise.status = "active";
      await franchise.save();
    }

    await FranchiseAudit.create({
      franchiseId: franchise._id,
      actorId: user._id,
      action: "Franchise account activated",
      details: "The primary franchise administrator activated their account.",
    });

    return res.status(200).json({
      success: true,
      message: "Account activated. You can now sign in.",
    });
  } catch (error) {
    next(error);
  }
};
