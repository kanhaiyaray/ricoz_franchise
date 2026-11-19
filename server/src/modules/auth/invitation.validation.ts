import { z } from "zod";
import { acceptInvitationSchema } from "./auth.validation.js";

export type AcceptInvitationDto =
  z.infer<typeof acceptInvitationSchema>["body"];
