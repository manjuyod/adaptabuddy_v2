"use client";

import clsx from "clsx";
import { Eye, EyeOff } from "lucide-react";
import Image from "next/image";
import {
  type CSSProperties,
  type FormEvent,
  useEffect,
  useId,
  useTransition,
  useState
} from "react";
import { AuthTitleScene } from "@/components/ui/auth-title-scene";
import commandStyles from "@/components/ui/jrpg-command-menu.module.css";
import { signInAction, signUpAction, type AuthFormState } from "@/modules/auth/actions";
import styles from "./login-screen.module.css";

const initialState: AuthFormState = { error: null, message: null };
const authTitleSrc = "/backgrounds/hd2d/auth/preview-v1/adaptabuddy-title-v2.png";

type AuthTab = "signin" | "signup";

type LoginScreenProps = {
  initialTab?: AuthTab;
  redirectTo?: string;
};

type AuthServerAction = (
  prevState: AuthFormState,
  formData: FormData
) => Promise<AuthFormState | void>;

function useAuthFormAction(action: AuthServerAction) {
  const [state, setState] = useState<AuthFormState>(initialState);
  const [pending, startTransition] = useTransition();

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = await action(initialState, formData);
      if (result) {
        setState(result);
      }
    });
  };

  return [state, handleSubmit, pending] as const;
}

function AuthMessage({ error, message }: AuthFormState) {
  return (
    <p
      role={error ? "alert" : "status"}
      aria-live="polite"
      className={clsx(
        styles.message,
        error
          ? styles.messageError
          : message
            ? styles.messageSuccess
            : styles.messageEmpty
      )}
    >
      {error ?? message ?? " "}
    </p>
  );
}

const actionButtonClassName =
  commandStyles.commandButton;

const actionRowStyle = {
  "--jrpg-command-width": "181px",
  "--jrpg-command-gap": "9px",
  "--jrpg-command-min-height": "2.15rem",
  "--jrpg-command-padding": "8px 13px",
  "--jrpg-command-font-size": "1.01rem",
  margin: "24px auto 0",
} as CSSProperties;

function ActionSubmitButton({
  idleLabel,
  pendingLabel,
  pending
}: {
  idleLabel: string;
  pendingLabel: string;
  pending: boolean;
}) {
  const submitButtonStyle: CSSProperties = {
    transform: pending ? "translateY(-1px) scale(0.98)" : "translateY(0) scale(1)",
    ...(pending ? { boxShadow: "0 0 14px rgba(255,190,110,0.22)" } : {})
  };

  return (
    <button
      type="submit"
      disabled={pending}
      className={actionButtonClassName}
      style={submitButtonStyle}
      aria-busy={pending}
      data-jrpg-command="true"
    >
      {pending ? (
        <span className={styles.pendingContent}>
          <span aria-hidden="true" className={styles.spinner} />
          {pendingLabel}
        </span>
      ) : (
        idleLabel
      )}
    </button>
  );
}

const emailInputClassName =
  styles.authInput;

const passwordInputClassName =
  `${styles.authInput} ${styles.passwordInput}`;

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
    <div className={clsx(styles.formField, styles.passwordField)}>
      <input
        id={id}
        name={name}
        type={revealed ? "text" : "password"}
        required
        autoComplete={autoComplete}
        aria-label={label}
        className={passwordInputClassName}
        placeholder={placeholder}
      />
      <button
        type="button"
        onClick={() => setRevealed((value) => !value)}
        aria-label={revealed ? `Hide ${label}` : `Show ${label}`}
        className={styles.passwordRevealButton}
      >
        {revealed ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
      </button>
    </div>
  );
}

function InlineActionRow({
  activeTab,
  onToggle,
  pending,
  submitLabel,
  pendingLabel
}: {
  activeTab: AuthTab;
  onToggle: (value: AuthTab) => void;
  pending: boolean;
  submitLabel: string;
  pendingLabel: string;
}) {
  const toggleTarget = activeTab === "signin" ? "signup" : "signin";
  const toggleText = activeTab === "signin" ? "Sign Up" : "Sign In";

  return (
    <div
      data-auth-menu-actions="v3"
      data-jrpg-command-menu="auth"
      className={commandStyles.commandMenu}
      style={actionRowStyle}
    >
      <ActionSubmitButton idleLabel={submitLabel} pendingLabel={pendingLabel} pending={pending} />
      <button
        type="button"
        onClick={() => onToggle(toggleTarget)}
        aria-pressed={activeTab === "signup"}
        aria-label={activeTab === "signin" ? "Switch to sign up mode" : "Switch to sign in mode"}
        className={actionButtonClassName}
        data-jrpg-command="true"
      >
        {toggleText}
      </button>
      <button
        type="button"
        className={actionButtonClassName}
        aria-label="OAuth options coming soon"
        data-jrpg-command="true"
      >
        OAuth
      </button>
      <button
        type="button"
        className={actionButtonClassName}
        aria-label="Google sign in coming soon"
        data-jrpg-command="true"
      >
        Google
      </button>
    </div>
  );
}

function AuthStackLogo() {
  return (
    <div data-auth-stack-logo="v3" className={styles.authStackLogo} aria-hidden="true">
      <Image
        src={authTitleSrc}
        alt=""
        width={680}
        height={282}
        priority
        sizes="(max-width: 720px) 88vw, 680px"
        className={styles.authStackLogoImage}
      />
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
  const [state, handleSubmit, pending] = useAuthFormAction(signInAction);

  return (
    <form onSubmit={handleSubmit} className={styles.authForm}>
      <input type="hidden" name="redirectTo" value={redirectTo ?? ""} />

      <div data-auth-control-stack="v3" className={styles.authControlStack}>
        <AuthStackLogo />

        <div className={styles.fieldStack}>
          <div className={styles.formField}>
            <input
              id="login-email"
              name="email"
              type="email"
              required
              autoComplete="email"
              aria-label="Email"
              className={emailInputClassName}
              placeholder="Email"
            />
          </div>

          <PasswordField
            id="login-password"
            name="password"
            label="Password"
            placeholder="Password"
            autoComplete="current-password"
          />
        </div>

        <InlineActionRow
          activeTab="signin"
          onToggle={onToggleMode}
          pending={pending}
          submitLabel="Log In"
          pendingLabel="Logging in..."
        />
      </div>

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
  const [state, handleSubmit, pending] = useAuthFormAction(signUpAction);

  return (
    <form onSubmit={handleSubmit} className={styles.authForm}>
      <input type="hidden" name="redirectTo" value={redirectTo ?? ""} />

      <div data-auth-control-stack="v3" className={styles.authControlStack}>
        <AuthStackLogo />

        <div className={styles.fieldStack}>
          <div className={styles.formField}>
            <input
              id="signup-email"
              name="email"
              type="email"
              required
              autoComplete="email"
              aria-label="Email"
              className={emailInputClassName}
              placeholder="Email"
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
        </div>

        <InlineActionRow
          activeTab="signup"
          onToggle={onToggleMode}
          pending={pending}
          submitLabel="Create Account"
          pendingLabel="Creating..."
        />
      </div>

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

  useEffect(() => {
    setHasLoaded(true);
  }, []);

  return (
    <AuthTitleScene showTitleAsset={false}>
        <section
          data-auth-menu="v3"
          className={styles.authMenu}
          style={{
            "--auth-menu-offset-y": hasLoaded ? "0px" : "18px",
            opacity: hasLoaded ? 1 : 0,
          } as CSSProperties}
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
    </AuthTitleScene>
  );
}
