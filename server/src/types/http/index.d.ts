import "http";
import type { UserRole } from "../../models/user.models.js";

export interface IUserPayload {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

declare module "http" {
  interface IncomingMessage {
    user?: IUserPayload;
  }
}

declare module "express" {
  interface IncomingMessage {
    User?: IUserPayload;
  }
}
