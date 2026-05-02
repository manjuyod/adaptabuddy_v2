"use server";

import type { Route } from "next";
import { redirect } from "next/navigation";
import { ROUTES } from "@/lib/routes";
import { resolveSafeRedirectTo } from "@/lib/auth/redirectTo";
import { createSupabaseServerActionClient } from "@/lib/supabase/next";
import { EmailPasswordSchema, SignUpWithPasswordSchema } from "./contracts";
import { logoutUserSession } from "./service";

export type AuthFormState = {
  error: string | null;
  message: string | null;
};

const initialState: AuthFormState = { error: null, message: null };

const getString = (formData: FormData, key: string) => {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
};

const resolvePostAuthRedirect = (formData: FormData) =>
  resolveSafeRedirectTo(getString(formData, "redirectTo")) ?? ROUTES.start;

export async function signInAction(_prevState: AuthFormState, formData: FormData) {
  const parsed = EmailPasswordSchema.safeParse({
    email: getString(formData, "email").trim(),
    password: getString(formData, "password")
  });

  if (!parsed.success) {
    return { ...initialState, error: "Enter a valid email and password." };
  }

  const supabase = await createSupabaseServerActionClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    return { ...initialState, error: error.message };
  }

  redirect(resolvePostAuthRedirect(formData) as Route);
}

export async function signUpAction(_prevState: AuthFormState, formData: FormData) {
  const parsed = SignUpWithPasswordSchema.safeParse({
    email: getString(formData, "email").trim(),
    password: getString(formData, "password"),
    confirmPassword: getString(formData, "confirmPassword")
  });

  if (!parsed.success) {
    const confirmIssue = parsed.error.issues.find((issue) => issue.path[0] === "confirmPassword");
    return {
      ...initialState,
      error: confirmIssue?.message ?? "Enter a valid email and matching passwords."
    };
  }

  const supabase = await createSupabaseServerActionClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password
  });

  if (error) {
    return { ...initialState, error: error.message };
  }

  if (!data.session) {
    return { ...initialState, message: "Check your email to confirm your account." };
  }

  redirect(resolvePostAuthRedirect(formData) as Route);
}

export async function signOutAction() {
  await logoutUserSession();
  redirect(ROUTES.auth.login);
}
