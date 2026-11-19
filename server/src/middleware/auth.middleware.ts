import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import type { IUserPayload } from "../types/http/index.js";
import type { UserRole } from "../models/user.models.js";

export const auth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: "Authorization header is missing",
      });
    }

    const token = authHeader.split(" ")[1];
    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Bearer token is missing",
      });
    }

    const decode = jwt.verify(token, process.env.access_secret!);
    if (!decode) {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired session",
      });
    }

    req.user = decode as IUserPayload;
    next();
  } catch (error) {
    console.error("Auth middleware rejected a request:", error);
    return res.status(401).json({
      success: false,
      message: "Invalid or expired session",
    });
  }
};

export const requireRole = (...roles: UserRole[]) =>
  (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "You do not have access to this portal",
      });
    }
    next();
  };
