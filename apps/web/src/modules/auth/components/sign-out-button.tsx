"use client";

import { useFormStatus } from "react-dom";
import { signOutAction } from "@/modules/auth/actions";

type SignOutButtonProps = {
  className?: string;
};

function SignOutSubmitButton({ className }: SignOutButtonProps) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={
        className ??
        "pixelated rounded-lg border border-amber-900 bg-gradient-to-b from-amber-400 to-amber-700 px-4 py-3 text-center text-sm font-semibold text-amber-50 shadow-[0_6px_0_#4a2b00] transition hover:-translate-y-0.5 hover:shadow-[0_8px_0_#4a2b00] disabled:translate-y-0 disabled:opacity-70 disabled:shadow-none"
      }
      aria-busy={pending}
    >
      {pending ? "Signing out..." : "Sign Out"}
    </button>
  );
}

export function SignOutButton({ className }: SignOutButtonProps) {
  return (
    <form action={signOutAction} className="inline-flex">
      <SignOutSubmitButton className={className} />
    </form>
  );
}
