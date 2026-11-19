import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { ApiError } from "./apiError.utils.js";
import type { EncryptedApplicationValue } from "../models/application.models.js";

function getEncryptionKey() {
  const value = process.env.APPLICATION_DATA_ENCRYPTION_KEY;
  if (!value || !/^[\da-fA-F]{64}$/.test(value)) {
    throw new ApiError(
      503,
      "Application data encryption is not configured. Set APPLICATION_DATA_ENCRYPTION_KEY to a 32-byte hex key generated with `openssl rand -hex 32`.",
    );
  }
  return Buffer.from(value, "hex");
}

export function encryptApplicationData(value: string | Buffer) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const plaintext =
    typeof value === "string" ? Buffer.from(JSON.stringify(value), "utf8") : value;
  const ciphertext = Buffer.concat([
    cipher.update(plaintext),
    cipher.final(),
  ]);
  return {
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
  };
}

export function decryptApplicationData(
  value: EncryptedApplicationValue,
): Buffer {
  const key = getEncryptionKey();
  try {
    const decipher = createDecipheriv(
      "aes-256-gcm",
      key,
      Buffer.from(value.iv, "base64"),
    );
    decipher.setAuthTag(Buffer.from(value.authTag, "base64"));
    return Buffer.concat([
      decipher.update(Buffer.from(value.ciphertext, "base64")),
      decipher.final(),
    ]);
  } catch {
    throw new ApiError(
      500,
      "Unable to decrypt stored application data. Verify the application encryption key.",
    );
  }
}

export function decryptApplicationText(value: EncryptedApplicationValue) {
  const plaintext = decryptApplicationData(value).toString("utf8");
  let decoded: unknown;
  try {
    decoded = JSON.parse(plaintext);
  } catch {
    throw new ApiError(500, "Unable to decrypt stored application text.");
  }
  if (typeof decoded !== "string") {
    throw new ApiError(500, "Unable to decrypt stored application text.");
  }
  return decoded;
}
