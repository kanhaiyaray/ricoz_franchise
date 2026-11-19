import * as nodemailer from "nodemailer";
import dotenv from "dotenv";
import { ApiError } from "./apiError.utils.js";
dotenv.config();

function createTransporter() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  const port = Number(SMTP_PORT);
  if (
    !SMTP_HOST ||
    !SMTP_PORT ||
    !Number.isInteger(port) ||
    !SMTP_USER ||
    !SMTP_PASS
  ) {
    throw new ApiError(
      503,
      "Email verification is not configured. Contact the site administrator.",
    );
  }

  return {
    from: { name: "Ricoz Franchise", address: SMTP_USER },
    transporter: nodemailer.createTransport({
      host: SMTP_HOST,
      port,
      secure: port === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    }),
  };
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character]!;
  });
}

// BUG FIX #3: exported so invoice / other transactional emails can render
// arbitrary HTML instead of the OTP template.
export async function sendHtmlEmail(email: string, subject: string, html: string) {
  const { from, transporter } = createTransporter();
  try {
    await transporter.sendMail({ from, to: email, subject, html });
  } catch (error) {
    console.error("Failed to send email", error);
    throw error;
  }
}

export const sendEmail = async (email: string, title: string, body: string) => {
  const html = `
    <div style="font-family: sans-serif; max-width: 480px; margin: auto;">
      <h2>${escapeHtml(title)}</h2>
      <p>Your one-time code is:</p>
      <p style="font-size: 32px; font-weight: bold; letter-spacing: 6px;">${escapeHtml(body)}</p>
      <p>This code expires in 10 minutes. If you didn't request this, you can ignore this email.</p>
    </div>
  `;

  await sendHtmlEmail(email, title, html);
};

// BUG FIX #4: never throw on SMTP failure — return `false` instead so callers
// can report the outcome without rolling back the surrounding transaction.
// A failed invitation should not block franchise creation or approval.
export const sendFranchiseInvitation = async (
  email: string,
  name: string,
  activationUrl: string,
): Promise<boolean> => {
  const safeName = escapeHtml(name);
  const safeUrl = escapeHtml(activationUrl);
  const html = `
    <div style="font-family: sans-serif; max-width: 520px; margin: auto; color: #182131;">
      <h2>Welcome to the Ricoz Franchise Network</h2>
      <p>Hello ${safeName},</p>
      <p>Your franchise account is ready. Activate it and create a password using the secure link below.</p>
      <p><a href="${safeUrl}" style="display: inline-block; padding: 12px 20px; background: #8b1f1f; color: #fff; text-decoration: none; border-radius: 8px;">Activate account</a></p>
      <p>This invitation expires in 72 hours. If you were not expecting this email, you can ignore it.</p>
    </div>
  `;
  try {
    await sendHtmlEmail(email, "Activate your Ricoz franchise account", html);
    return true;
  } catch (error) {
    console.error("Failed to send franchise invitation email:", error);
    return false;
  }
};
