import { ApiError } from "../utils/apiError.utils.js";

const localOrigins =
  "http://localhost:3000,http://127.0.0.1:3000,http://localhost:3010,http://127.0.0.1:3010";

const configuredOrigins = (process.env.CLIENT_ORIGINS || localOrigins)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

// BUG FIX #38: ensure CLIENT_URL origin is also allowed for CORS.
if (process.env.CLIENT_URL) {
  try {
    const clientOrigin = new URL(process.env.CLIENT_URL).origin;
    if (!configuredOrigins.includes(clientOrigin)) {
      configuredOrigins.push(clientOrigin);
    }
  } catch {
    // resolveClientOrigin will raise a clear error if CLIENT_URL is malformed.
  }
}

export const allowedClientOrigins = new Set(configuredOrigins);

export function resolveClientOrigin(requestOrigin?: string) {
  if (
    process.env.NODE_ENV !== "production" &&
    requestOrigin &&
    allowedClientOrigins.has(requestOrigin)
  ) {
    return requestOrigin;
  }
  if (process.env.CLIENT_URL) {
    try {
      return new URL(process.env.CLIENT_URL).origin;
    } catch {
      throw new ApiError(500, "CLIENT_URL must be a valid absolute URL.");
    }
  }
  if (requestOrigin && allowedClientOrigins.has(requestOrigin)) {
    return requestOrigin;
  }
  if (process.env.NODE_ENV !== "production") {
    return "http://localhost:3000";
  }
  throw new ApiError(500, "CLIENT_URL is not configured.");
}
