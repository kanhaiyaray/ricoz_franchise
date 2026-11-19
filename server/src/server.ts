import express, { type Request, type Response } from "express";
import "dotenv/config";
import cors from "cors";

import appRoutes from "./routes/index.js";
import { connectDB } from "./config/mongodb.js";
import cookieParser from "cookie-parser";
import { allowedClientOrigins } from "./config/client-origin.js";
import { errorHandler } from "./middleware/error_handler.middleware.js";

const app = express();
const PORT = process.env.PORT || 10000;

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedClientOrigins.has(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error("Request origin is not allowed by CORS"));
    },
    credentials: true,
  }),
);

app.use(
  "/api/v1/finance/billing/webhooks",
  express.raw({ type: "application/json", limit: "1mb" }),
);
// BUG FIX #35: sales lead import can exceed the default 100kb JSON limit.
app.use(express.json({ limit: "5mb" }));
app.use(cookieParser());

app.get("/health", (req: Request, res: Response) => {
  return res.json({ success: true, message: "ok" });
});

app.use("/api/v1", appRoutes);

// BUG FIX #25: catch errors that escape route-level handlers (e.g. CORS).
app.use(errorHandler);

async function main() {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

main();
