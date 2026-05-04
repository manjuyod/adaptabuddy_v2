"use client";

import clsx from "clsx";
import { Eye, EyeOff } from "lucide-react";
import Image from "next/image";
import {
  type CSSProperties,
  type MouseEvent,
  useEffect,
  useId,
  useState
} from "react";
import { useFormState, useFormStatus } from "react-dom";
import { signInAction, signUpAction, type AuthFormState } from "@/modules/auth/actions";

const initialState: AuthFormState = { error: null, message: null };

type AuthTab = "signin" | "signup";

type LoginScreenProps = {
  initialTab?: AuthTab;
  redirectTo?: string;
};

const cormorantGaramondClassName = "font-serif";

const normalizeFormAction = (
  value: unknown
): string | ((payload: FormData) => void | Promise<void>) | undefined => {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "function") {
    return (payload: FormData) => (value as (next: FormData) => void | Promise<void>)(payload);
  }
  return undefined;
};

function AuthMessage({ error, message }: AuthFormState) {
  return (
    <p
      role={error ? "alert" : "status"}
      aria-live="polite"
      className={clsx(
        "min-h-[20px] text-[13px] leading-5 font-medium",
        error
          ? "text-rose-300"
          : message
            ? "text-[rgba(255,255,255,0.92)]"
            : "text-transparent"
      )}
    >
      {error ?? message ?? " "}
    </p>
  );
}

const actionButtonClassName =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgba(255,200,120,0.65)] disabled:opacity-[0.55]";

const actionRowStyle: CSSProperties = {
  width: "100%",
  maxWidth: "26rem",
  margin: "0 auto",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "14px"
};

const actionButtonStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  height: "2rem",
  padding: "0 8px",
  borderRadius: "10px",
  border: "none",
  background: "transparent",
  color: "#ffffff",
  fontSize: "0.74rem",
  fontWeight: 500,
  lineHeight: 1,
  letterSpacing: "0.01em",
  whiteSpace: "nowrap",
  transition: "all 220ms ease"
};

const actionButtonHoverHandlers = {
  onMouseEnter: (event: MouseEvent<HTMLButtonElement>) => {
    event.currentTarget.style.background = "rgba(255,200,120,0.14)";
    event.currentTarget.style.color = "rgba(255,230,190,0.98)";
    event.currentTarget.style.boxShadow = "0 0 12px rgba(255,190,110,0.28)";
  },
  onMouseLeave: (event: MouseEvent<HTMLButtonElement>) => {
    event.currentTarget.style.background = "transparent";
    event.currentTarget.style.color = "#ffffff";
    event.currentTarget.style.boxShadow = "none";
  }
};

function ActionSubmitButton({
  idleLabel,
  pendingLabel
}: {
  idleLabel: string;
  pendingLabel: string;
}) {
  const { pending } = useFormStatus();
  const submitButtonStyle: CSSProperties = {
    ...actionButtonStyle,
    transform: pending ? "translateY(-1px) scale(0.98)" : "translateY(0) scale(1)",
    boxShadow: pending ? "0 0 14px rgba(255,190,110,0.22)" : "none"
  };

  return (
    <button
      type="submit"
      disabled={pending}
      className={actionButtonClassName}
      style={submitButtonStyle}
      {...actionButtonHoverHandlers}
      aria-busy={pending}
    >
      {pending ? (
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="h-3 w-3 animate-spin rounded-full border border-[rgba(255,200,120,0.75)] border-t-transparent"
          />
          {pendingLabel}
        </span>
      ) : (
        idleLabel
      )}
    </button>
  );
}

const emailInputClassName =
  "auth-email-input block h-[3.618rem] w-full max-w-[26rem] border-0 border-b border-b-[rgba(255,255,255,0.18)] bg-transparent px-0 pb-0 font-[inherit] leading-tight tracking-[0.045em] text-white placeholder:text-white placeholder:opacity-100 hover:border-b-[rgba(255,200,120,0.45)] focus-visible:border-b-2 focus-visible:border-b-[rgba(255,200,120,0.7)] focus-visible:outline-0 transition-all duration-300 ease-out mx-auto";

const passwordInputClassName =
  "auth-email-input block h-[3.618rem] w-full max-w-[26rem] border-0 border-b border-b-[rgba(255,255,255,0.18)] bg-transparent px-0 pr-14 pb-0 font-[inherit] leading-tight tracking-[0.045em] text-white placeholder:text-white placeholder:opacity-100 hover:border-b-[rgba(255,200,120,0.45)] focus-visible:border-b-2 focus-visible:border-b-[rgba(255,200,120,0.7)] focus-visible:outline-0 transition-all duration-300 ease-out mx-auto";

function PasswordField({
  id,
  name,
  label,
  placeholder,
  autoComplete
}: {
  id: string;
  name: string;
  label: string;
  placeholder: string;
  autoComplete: string;
}) {
  const [revealed, setRevealed] = useState(false);

  return (
    <div className="relative">
      <input
        id={id}
        name={name}
        type={revealed ? "text" : "password"}
        required
        autoComplete={autoComplete}
        aria-label={label}
        className={passwordInputClassName}
        placeholder={placeholder}
        style={{
          backgroundColor: "transparent",
          color: "#ffffff",
          fontSize: "clamp(1.382rem, 0.98rem + 1.35vw, 2.236rem)",
          textAlign: "center"
        }}
      />
      <button
        type="button"
        onClick={() => setRevealed((value) => !value)}
        aria-label={revealed ? `Hide ${label}` : `Show ${label}`}
        className="absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-[rgba(255,255,255,0.55)] transition-all duration-300 hover:text-[rgba(255,200,120,0.85)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[rgba(255,200,120,0.55)]"
      >
        {revealed ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
      </button>
    </div>
  );
}

function InlineActionRow({
  activeTab,
  onToggle,
  submitLabel,
  pendingLabel
}: {
  activeTab: AuthTab;
  onToggle: (value: AuthTab) => void;
  submitLabel: string;
  pendingLabel: string;
}) {
  const toggleTarget = activeTab === "signin" ? "signup" : "signin";
  const toggleText = activeTab === "signin" ? "Sign Up" : "Sign In";

  return (
    <div style={actionRowStyle}>
      <button
        type="button"
        onClick={() => onToggle(toggleTarget)}
        aria-pressed={activeTab === "signup"}
        aria-label={activeTab === "signin" ? "Switch to sign up mode" : "Switch to sign in mode"}
        className={actionButtonClassName}
        style={actionButtonStyle}
        {...actionButtonHoverHandlers}
      >
        {toggleText}
      </button>
      <button
        type="button"
        className={actionButtonClassName}
        style={actionButtonStyle}
        {...actionButtonHoverHandlers}
        aria-label="OAuth options coming soon"
      >
        OAuth
      </button>
      <button
        type="button"
        className={actionButtonClassName}
        style={actionButtonStyle}
        {...actionButtonHoverHandlers}
        aria-label="Google sign in coming soon"
      >
        Google (coming soon)
      </button>
      <ActionSubmitButton idleLabel={submitLabel} pendingLabel={pendingLabel} />
    </div>
  );
}

function SignInForm({
  redirectTo,
  onToggleMode
}: {
  redirectTo?: string;
  onToggleMode: (value: AuthTab) => void;
}) {
  const [state, formAction] = useFormState(signInAction, initialState);

  return (
    <form action={normalizeFormAction(formAction)} className="space-y-2.5">
      <input type="hidden" name="redirectTo" value={redirectTo ?? ""} />

      <div>
        <input
          id="login-email"
          name="email"
          type="email"
          required
          autoComplete="email"
          aria-label="Email"
          className={emailInputClassName}
          placeholder="Email"
          style={{
            backgroundColor: "transparent",
            color: "#ffffff",
            fontSize: "clamp(1.382rem, 0.98rem + 1.35vw, 2.236rem)",
            textAlign: "center"
          }}
        />
      </div>

      <PasswordField
        id="login-password"
        name="password"
        label="Password"
        placeholder="Password"
        autoComplete="current-password"
      />

      <InlineActionRow
        activeTab="signin"
        onToggle={onToggleMode}
        submitLabel="Log In"
        pendingLabel="Logging in..."
      />

      <AuthMessage error={state.error} message={state.message} />
    </form>
  );
}

function SignUpForm({
  redirectTo,
  onToggleMode
}: {
  redirectTo?: string;
  onToggleMode: (value: AuthTab) => void;
}) {
  const [state, formAction] = useFormState(signUpAction, initialState);

  return (
    <form action={normalizeFormAction(formAction)} className="space-y-2.5">
      <input type="hidden" name="redirectTo" value={redirectTo ?? ""} />

      <div>
        <input
          id="signup-email"
          name="email"
          type="email"
          required
          autoComplete="email"
          aria-label="Email"
          className={emailInputClassName}
          placeholder="Email"
          style={{
            backgroundColor: "transparent",
            color: "#ffffff",
            fontSize: "clamp(1.382rem, 0.98rem + 1.35vw, 2.236rem)",
            textAlign: "center"
          }}
        />
      </div>

      <PasswordField
        id="signup-password"
        name="password"
        label="Password"
        placeholder="Create a password"
        autoComplete="new-password"
      />

      <PasswordField
        id="signup-confirm-password"
        name="confirmPassword"
        label="Confirm password"
        placeholder="Re-enter password"
        autoComplete="new-password"
      />

      <InlineActionRow
        activeTab="signup"
        onToggle={onToggleMode}
        submitLabel="Create Account"
        pendingLabel="Creating..."
      />

      <AuthMessage error={state.error} message={state.message} />
    </form>
  );
}

export function LoginScreen({ initialTab = "signin", redirectTo }: LoginScreenProps) {
  const [activeTab, setActiveTab] = useState<AuthTab>(initialTab);
  const [hasLoaded, setHasLoaded] = useState(false);
  const tabBaseId = useId().replace(/:/g, "");
  const signInPanelId = `${tabBaseId}-panel-signin`;
  const signUpPanelId = `${tabBaseId}-panel-signup`;

  const loginBackgroundSrc = "/backgrounds/login/login-bg.png";

  useEffect(() => {
    setHasLoaded(true);
  }, []);

  return (
    <main
      style={{
        position: "relative",
        minHeight: "100vh",
        overflow: "hidden",
        backgroundColor: "#0b1021"
      }}
    >
      <Image
        aria-hidden
        src={loginBackgroundSrc}
        alt=""
        fill
        priority
        sizes="100vw"
        style={{
          objectFit: "cover",
          zIndex: 0,
          pointerEvents: "none",
          userSelect: "none"
        }}
      />
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 1,
          background: "rgba(0, 0, 0, 0.25)"
        }}
      />
      <div
        style={{
          position: "relative",
          zIndex: 2,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "40px 16px"
        }}
      >
        <div
          aria-hidden
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            transform: "translate(-50%, -50%)",
            width: "min(720px, 92vw)",
            height: "min(560px, 78vh)",
            zIndex: 2,
            borderRadius: "24px",
            background:
              "radial-gradient(circle at center, rgba(0,0,0,0.28) 0%, rgba(0,0,0,0.10) 45%, rgba(0,0,0,0) 75%)"
          }}
        />
        <p
          className={cormorantGaramondClassName}
          style={{
            position: "absolute",
            top: "22%",
            left: "50%",
            transform: hasLoaded
              ? "translateX(-50%) translateY(0) scaleY(1.14)"
              : "translateX(-50%) translateY(10px) scaleY(1.14)",
            transformOrigin: "center",
            margin: 0,
            color: "#ffffff",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            fontFamily: "\"Cormorant Garamond\", Garamond, \"Times New Roman\", serif",
            fontSize: "clamp(2.618rem, 1.2rem + 4.236vw, 5.236rem)",
            lineHeight: 0.95,
            fontWeight: 300,
            fontStyle: "italic",
            textShadow: "0 2px 0 rgba(0,0,0,0.45), 0 10px 28px rgba(0,0,0,0.65)",
            mixBlendMode: "screen",
            opacity: hasLoaded ? 0.9 : 0,
            transition:
              "opacity 520ms ease-out, transform 700ms cubic-bezier(0.22, 1, 0.36, 1)",
            zIndex: 4
          }}
        >
          AdaptaBuddy
        </p>
        <section
          className={clsx(cormorantGaramondClassName, "p-6")}
          style={{
            width: "100%",
            maxWidth: "420px",
            minHeight: "20rem",
            marginTop: "clamp(2.5rem, 7vh, 4.5rem)",
            color: "rgba(255,255,255,0.92)",
            fontFamily: "\"Cormorant Garamond\", Garamond, \"Times New Roman\", serif",
            position: "relative",
            zIndex: 3,
            opacity: hasLoaded ? 1 : 0,
            transform: hasLoaded ? "translateY(0)" : "translateY(18px)",
            transition:
              "opacity 480ms ease-out 100ms, transform 680ms cubic-bezier(0.22, 1, 0.36, 1) 100ms"
          }}
        >
          <div
            id={signInPanelId}
            role="region"
            aria-label="Sign in form"
            hidden={activeTab !== "signin"}
            className={activeTab === "signin" ? "space-y-2.5" : undefined}
          >
            {activeTab === "signin" ? (
              <SignInForm redirectTo={redirectTo} onToggleMode={setActiveTab} />
            ) : null}
          </div>

          <div
            id={signUpPanelId}
            role="region"
            aria-label="Sign up form"
            hidden={activeTab !== "signup"}
            className={activeTab === "signup" ? "space-y-2.5" : undefined}
          >
            {activeTab === "signup" ? (
              <SignUpForm redirectTo={redirectTo} onToggleMode={setActiveTab} />
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}
