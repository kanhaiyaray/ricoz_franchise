import "dotenv/config";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { User, USER_ROLES } from "../models/user.models.js";

async function main() {
  const { MONGO_URI, ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;
  if (!MONGO_URI || !ADMIN_NAME || !ADMIN_EMAIL || !ADMIN_PASSWORD) {
    throw new Error(
      "Set MONGO_URI, ADMIN_NAME, ADMIN_EMAIL, and ADMIN_PASSWORD before provisioning an admin.",
    );
  }
  if (ADMIN_PASSWORD.length < 8) {
    throw new Error("ADMIN_PASSWORD must contain at least 8 characters.");
  }

  await mongoose.connect(MONGO_URI);
  try {
    const normalizedEmail = ADMIN_EMAIL.trim().toLowerCase();
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      if (existingUser.role === USER_ROLES.ADMIN) {
        console.info("The admin account is already provisioned.");
        return;
      }
      throw new Error(
        "An account with ADMIN_EMAIL already exists. Admin provisioning will not promote an existing account.",
      );
    }

    await User.create({
      name: ADMIN_NAME.trim(),
      email: normalizedEmail,
      password: await bcrypt.hash(ADMIN_PASSWORD, 12),
      role: USER_ROLES.ADMIN,
      profile_pic: `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(ADMIN_NAME.trim())}`,
    });
    console.info("Admin account provisioned successfully.");
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(
    "Admin provisioning failed:",
    error instanceof Error ? error.message : "Unknown error",
  );
  process.exitCode = 1;
});
