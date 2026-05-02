import { z } from "zod";

export const SessionUserSchema = z.object({
  id: z.string().min(1),
  email: z.string().email()
});

export type SessionUser = z.infer<typeof SessionUserSchema>;

export const EmailPasswordSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

export type EmailPassword = z.infer<typeof EmailPasswordSchema>;

export const SignUpWithPasswordSchema = EmailPasswordSchema.extend({
  confirmPassword: z.string().min(1)
}).refine((value) => value.password === value.confirmPassword, {
  message: "Passwords do not match.",
  path: ["confirmPassword"]
});

export type SignUpWithPassword = z.infer<typeof SignUpWithPasswordSchema>;
