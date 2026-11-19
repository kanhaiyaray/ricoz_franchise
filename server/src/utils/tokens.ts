import jwt from "jsonwebtoken";
import type mongoose from "mongoose";
import crypto from "crypto";
import "dotenv/config";
import type { UserRole } from "../models/user.models.js";

export async function createAccessToken(
  id: mongoose.Types.ObjectId,
  name: string,
  email: string,
  role: UserRole,
): Promise<string> {
  const access_token = jwt.sign(
    { id: id.toString(), name, email, role },
    process.env.access_secret!,
    { expiresIn: "10m" },
  );
  return access_token;
}

export async function createRefreshToken(
  id: mongoose.Types.ObjectId,
  name: string,
  email: string,
  role: UserRole,
): Promise<string> {
  const payload = { id: id.toString(), name, email, role };
  const refresh_token = jwt.sign(payload, process.env.refresh_secret!, {
    expiresIn: "7d",
  });
  return refresh_token;
}

export function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}
