"use client";

import Link from "next/link";
import { type FormEvent, startTransition, useState } from "react";
import { ROUTES } from "@/lib/routes";
import { ScreenFrame } from "@/components/ui/ScreenFrame";
import { signUpAction, type AuthFormState } from "@/modules/auth/actions";

const initialState: AuthFormState = { error: null, message: null };

type Rect = { x: number; y: number; w: number; h: number };
type Size = { w: number; h: number };

const toPercent = (value: number, total: number) => `${(value / total) * 100}%`;

const rectStyle = (rect: Rect, size: Size) => ({
  left: toPercent(rect.x, size.w),
  top: toPercent(rect.y, size.h),
  width: toPercent(rect.w, size.w),
  height: toPercent(rect.h, size.h)
});

const desktopSize: Size = { w: 1536, h: 1024 };
const mobileSize: Size = { w: 1024, h: 1536 };

const desktopLayout = {
  email: { x: 500, y: 296, w: 534, h: 65 },
  password: { x: 500, y: 446, w: 534, h: 70 },
  confirmPassword: { x: 500, y: 595, w: 534, h: 68 },
  submit: { x: 567, y: 694, w: 401, h: 82 },
  loginLink: { x: 664, y: 824, w: 193, h: 120 },
  message: { x: 500, y: 663, w: 534, h: 32 }
} satisfies Record<string, Rect>;

const mobileLayout = {
  email: { x: 223, y: 387, w: 578, h: 82 },
  password: { x: 223, y: 567, w: 577, h: 82 },
  confirmPassword: { x: 223, y: 751, w: 577, h: 82 },
  submit: { x: 262, y: 867, w: 499, h: 103 },
  loginLink: { x: 336, y: 1132, w: 288, h: 62 },
  message: { x: 223, y: 835, w: 577, h: 36 }
} satisfies Record<string, Rect>;

function SignUpButton({
  pending,
  style
}: {
  pending: boolean;
  style: ReturnType<typeof rectStyle>;
}) {
  return (
    <button
      type="submit"
      disabled={pending}
      style={style}
      className="absolute rounded-lg bg-transparent text-transparent transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-300 disabled:opacity-70"
      aria-busy={pending}
    >
      {pending ? "Creating..." : "Create Account"}
    </button>
  );
}

export function SignupScreen() {
  const [state, setState] = useState<AuthFormState>(initialState);
  const [clientError, setClientError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    const formData = new FormData(event.currentTarget);

    const password =
      (event.currentTarget.elements.namedItem("password") as HTMLInputElement | null)?.value ?? "";
    const confirm =
      (event.currentTarget.elements.namedItem("confirmPassword") as HTMLInputElement | null)?.value ?? "";

    if (password !== confirm) {
      event.preventDefault();
      setClientError("Passwords do not match.");
      return;
    }

    event.preventDefault();
    setClientError(null);
    setPending(true);
    startTransition(() => {
      void signUpAction(state, formData)
        .then((nextState) => {
          if (nextState) {
            setState(nextState);
          }
        })
        .finally(() => {
          setPending(false);
        });
    });
  };

  const overlay = (
    <form
      onSubmit={handleSubmit}
      onChange={() => setClientError(null)}
      className="absolute inset-0 z-10 hidden md:block"
    >
      <label htmlFor="email" className="sr-only">
        Email
      </label>
      <input
        id="email"
        name="email"
        type="email"
        required
        autoComplete="email"
        style={rectStyle(desktopLayout.email, desktopSize)}
        className="absolute rounded-md bg-transparent pl-14 pr-4 text-lg font-semibold text-amber-50 placeholder:text-amber-100/60 caret-amber-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-300"
        placeholder="example@email.com"
      />

      <label htmlFor="password" className="sr-only">
        Password
      </label>
      <input
        id="password"
        name="password"
        type="password"
        required
        autoComplete="new-password"
        style={rectStyle(desktopLayout.password, desktopSize)}
        className="absolute rounded-md bg-transparent px-4 text-lg font-semibold text-amber-50 placeholder:text-amber-100/60 caret-amber-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-300"
        placeholder="••••••••"
      />

      <label htmlFor="confirmPassword" className="sr-only">
        Confirm password
      </label>
      <input
        id="confirmPassword"
        name="confirmPassword"
        type="password"
        required
        autoComplete="new-password"
        style={rectStyle(desktopLayout.confirmPassword, desktopSize)}
        className="absolute rounded-md bg-transparent px-4 text-lg font-semibold text-amber-50 placeholder:text-amber-100/60 caret-amber-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-300"
        placeholder="••••••••"
      />

      {clientError || state.error || state.message ? (
        <p
          style={rectStyle(desktopLayout.message, desktopSize)}
          className={[
            "absolute flex items-center justify-center px-3 text-center text-sm font-semibold",
            clientError || state.error ? "text-rose-200" : "text-emerald-200"
          ].join(" ")}
        >
          {clientError ?? state.error ?? state.message}
        </p>
      ) : null}

      <SignUpButton pending={pending} style={rectStyle(desktopLayout.submit, desktopSize)} />

      <Link
        href={ROUTES.auth.login}
        style={rectStyle(desktopLayout.loginLink, desktopSize)}
        className="absolute block rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-300"
      >
        <span className="sr-only">Sign in</span>
      </Link>
    </form>
  );

  const mobileOverlay = (
    <form
      onSubmit={handleSubmit}
      onChange={() => setClientError(null)}
      className="absolute inset-0 z-10 md:hidden"
    >
      <label htmlFor="email-mobile" className="sr-only">
        Email
      </label>
      <input
        id="email-mobile"
        name="email"
        type="email"
        required
        autoComplete="email"
        style={rectStyle(mobileLayout.email, mobileSize)}
        className="absolute rounded-md bg-transparent pl-14 pr-4 text-xl font-semibold text-amber-50 placeholder:text-amber-100/60 caret-amber-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-300"
        placeholder="example@email.com"
      />

      <label htmlFor="password-mobile" className="sr-only">
        Password
      </label>
      <input
        id="password-mobile"
        name="password"
        type="password"
        required
        autoComplete="new-password"
        style={rectStyle(mobileLayout.password, mobileSize)}
        className="absolute rounded-md bg-transparent px-4 text-xl font-semibold text-amber-50 placeholder:text-amber-100/60 caret-amber-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-300"
        placeholder="••••••••"
      />

      <label htmlFor="confirmPassword-mobile" className="sr-only">
        Confirm password
      </label>
      <input
        id="confirmPassword-mobile"
        name="confirmPassword"
        type="password"
        required
        autoComplete="new-password"
        style={rectStyle(mobileLayout.confirmPassword, mobileSize)}
        className="absolute rounded-md bg-transparent px-4 text-xl font-semibold text-amber-50 placeholder:text-amber-100/60 caret-amber-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-300"
        placeholder="••••••••"
      />

      {clientError || state.error || state.message ? (
        <p
          style={rectStyle(mobileLayout.message, mobileSize)}
          className={[
            "absolute flex items-center justify-center px-4 text-center text-base font-semibold",
            clientError || state.error ? "text-rose-200" : "text-emerald-200"
          ].join(" ")}
        >
          {clientError ?? state.error ?? state.message}
        </p>
      ) : null}

      <SignUpButton pending={pending} style={rectStyle(mobileLayout.submit, mobileSize)} />

      <Link
        href={ROUTES.auth.login}
        style={rectStyle(mobileLayout.loginLink, mobileSize)}
        className="absolute block rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-300"
      >
        <span className="sr-only">Sign in</span>
      </Link>
    </form>
  );

  return (
    <ScreenFrame
      desktopSrc="/ui/signup/static_images/signup_screen_full.png"
      mobileSrc="/ui/signup/static_images/signup_screen_mobile.png"
      showArt={false}
    >
      {overlay}
      {mobileOverlay}
    </ScreenFrame>
  );
}
