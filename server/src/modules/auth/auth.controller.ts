import type { NextFunction, Request, Response } from "express";
import type {
  LoginDto,
  RegisterDto,
  VerifyEmailDto,
} from "./auth.validation.js";
import { OTP, Session, User } from "../../models/index.js";
import { USER_ROLES } from "../../models/user.models.js";
import { ApiError } from "../../utils/apiError.utils.js";
import otpGenerator from "otp-generator";
import { sendEmail } from "../../utils/email.utils.js";
import bcrypt from "bcryptjs";
import {
  createAccessToken,
  createRefreshToken,
  hashToken,
} from "../../utils/tokens.js";

function assertEmailConfigured() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
    throw new ApiError(
      503,
      "Email verification is not configured. Contact the site administrator.",
    );
  }
}

export const sendOtp = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    assertEmailConfigured();
    const input: VerifyEmailDto = req.body;

    const isUser = await User.findOne({ email: input.email });
    if (!isUser) {
      const otp = otpGenerator.generate(6, {
        lowerCaseAlphabets: false,
        upperCaseAlphabets: false,
        specialChars: false,
        digits: true,
      });

      await OTP.findOneAndUpdate(
        { email: input.email },
        {
          $set: {
            otp,
            expiresAt: new Date(Date.now() + 10 * 60 * 1000),
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );

      await sendEmail(input.email, "Otp verification mail", otp);
    }

    return res.status(201).json({
      success: true,
      message: "If this email is eligible for registration, a verification code has been sent.",
    });
  } catch (error) {
    next(error);
  }
};

export const register = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const input: RegisterDto = req.body;

    const isUser = await User.findOne({ email: input.email });
    if (isUser) {
      throw new ApiError(
        400,
        "User already registered, please login to continue",
      );
    }

    const otpDoc = await OTP.findOne({
      email: input.email,
      expiresAt: { $gt: new Date() },
    });
    if (!otpDoc) {
      throw new ApiError(400, "Verification code expired or not found. Request a new code.");
    }
    if (otpDoc.otp !== input.otp) {
      throw new ApiError(400, "Invalid Otp");
    }

    if (input.password !== input.confirmPassword) {
      throw new ApiError(400, "Passwords do not match");
    }

    const hashedPassword = await bcrypt.hash(input.password, 10);
    const profile_pic = `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(input.name)}`;

    await User.create({
      name: input.name,
      email: input.email,
      password: hashedPassword,
      profile_pic,
      role: USER_ROLES.FRANCHISE,
    });
    await OTP.deleteOne({ _id: otpDoc._id });

    return res.status(201).json({
      success: true,
      message: "Successfully Registered",
    });
  } catch (error) {
    next(error);
  }
};

export const login = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const input: LoginDto = req.body;

    const isUser = await User.findOne({ email: input.email });
    if (!isUser) {
      throw new ApiError(401, "Invalid email or password for the selected portal");
    }

    const passwordMatches = await bcrypt.compare(input.password, isUser.password);
    const userRole = isUser.role ?? USER_ROLES.FRANCHISE;
    const accountStatus = isUser.accountStatus ?? "active";
    if (
      !passwordMatches ||
      userRole !== input.portal ||
      accountStatus !== "active"
    ) {
      throw new ApiError(401, "Invalid email or password for the selected portal");
    }

    const access_token = await createAccessToken(
      isUser._id,
      isUser.name,
      isUser.email,
      userRole,
    );
    const refresh_token = await createRefreshToken(
      isUser._id,
      isUser.name,
      isUser.email,
      userRole,
    );

    const hashed_refresh_token = hashToken(refresh_token);

    await Session.create({
      userId: isUser._id,
      name: isUser.name,
      email: isUser.email,
      tokenHash: hashed_refresh_token,
      role: userRole,
    });

    res.cookie("refresh_token", refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.status(200).json({
      success: true,
      message: "Logged in",
      access_token: access_token,
      user: {
        user_id: isUser._id,
        user_name: isUser.name,
        user_email: isUser.email,
        user_dp: isUser.profile_pic,
        user_about: isUser.about,
        user_role: userRole,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const refresh = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const refresh_token = req.cookies.refresh_token;
    if (!refresh_token) {
      throw new ApiError(400, "Refresh Token Not Found");
    }

    const hashed_Refresh_token = hashToken(refresh_token);

    const session = await Session.findOne({ tokenHash: hashed_Refresh_token });
    if (!session) {
      throw new ApiError(400, "Session not found");
    }

    const isUser = await User.findById(session.userId);
    if (!isUser) {
      throw new ApiError(400, "User not Found");
    }
    if ((isUser.accountStatus ?? "active") !== "active") {
      await Session.deleteOne({ tokenHash: hashed_Refresh_token });
      throw new ApiError(401, "This account is not active");
    }

    const new_access_token = await createAccessToken(
      isUser._id,
      isUser.name,
      isUser.email,
      isUser.role ?? USER_ROLES.FRANCHISE,
    );
    const new_refresh_token = await createRefreshToken(
      isUser._id,
      isUser.name,
      isUser.email,
      isUser.role ?? USER_ROLES.FRANCHISE,
    );

    const hash_new_ref_token = hashToken(new_refresh_token);

    await Session.create({
      userId: isUser._id,
      name: isUser.name,
      email: isUser.email,
      tokenHash: hash_new_ref_token,
      role: isUser.role ?? USER_ROLES.FRANCHISE,
    });

    // Bound the number of live sessions per user (FIFO).
    const staleSessions = await Session.find({ userId: isUser._id })
      .sort({ createdAt: -1 })
      .skip(10)
      .select("_id")
      .lean();
    if (staleSessions.length) {
      await Session.deleteMany({
        _id: { $in: staleSessions.map((s) => s._id) },
      });
    }

    res.cookie("refresh_token", new_refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.status(200).json({
      success: true,
      message: "Session refreshed",
      access_token: new_access_token,
      user: {
        user_id: isUser._id,
        user_name: isUser.name,
        user_email: isUser.email,
        user_dp: isUser.profile_pic,
        user_about: isUser.about,
        user_role: isUser.role ?? USER_ROLES.FRANCHISE,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const logout = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const refresh_token = req.cookies.refresh_token;
    if (refresh_token) {
      const hashedRefreshToken = hashToken(refresh_token);
      await Session.deleteOne({ tokenHash: hashedRefreshToken });
    }

    res.clearCookie("refresh_token", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
    });

    return res.status(200).json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error) {
    next(error);
  }
};
