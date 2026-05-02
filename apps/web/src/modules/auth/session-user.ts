import { z } from "zod";
import { SessionUserSchema } from "./contracts";

export const AuthedUserSchema = SessionUserSchema.extend({
  email: z.string().email().optional()
});

export type AuthedUser = z.infer<typeof AuthedUserSchema>;

export const toAuthedUser = (input: unknown): AuthedUser | null => {
  const parsed = AuthedUserSchema.safeParse(input);
  return parsed.success ? parsed.data : null;
};
