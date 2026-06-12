// @vitest-environment jsdom

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LoginScreen } from "@/modules/auth/components/login-screen";

const loginScreenStyles = readFileSync(
  path.join(process.cwd(), "src/modules/auth/components/login-screen.module.css"),
  "utf8"
);

const authTitleSceneStyles = readFileSync(
  path.join(process.cwd(), "src/components/ui/auth-title-scene.module.css"),
  "utf8"
);

const sharedCommandStylesPath = path.join(
  process.cwd(),
  "src/components/ui/jrpg-command-menu.module.css"
);

const sharedCommandStyles = existsSync(sharedCommandStylesPath)
  ? readFileSync(sharedCommandStylesPath, "utf8")
  : "";

vi.mock("react-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-dom")>();

  return {
    ...actual,
    useFormState: () => {
      throw new Error("LoginScreen should not use deprecated react-dom useFormState");
    },
    useFormStatus: () => {
      throw new Error("LoginScreen should not use react-dom useFormStatus");
    },
  };
});

vi.mock("@/modules/auth/actions", () => ({
  signInAction: async () => ({ error: null, message: null }),
  signUpAction: async () => ({ error: null, message: null })
}));

vi.mock("next/image", () => ({
  default: ({
    src,
    alt,
    className,
    fill,
    priority,
    sizes,
    ...props
  }: {
    src: string;
    alt: string;
    className?: string;
    fill?: boolean;
    priority?: boolean;
    sizes?: string;
    [key: string]: unknown;
  }) => <img src={src} alt={alt} className={className} {...props} />
}));

vi.mock("next/font/google", () => ({
  Cormorant_Garamond: () => ({ className: "font-cormorant-garamond" })
}));

describe("LoginScreen", () => {
  it("renders the approved shared HD-2D scene assets", () => {
    const { container } = render(<LoginScreen />);

    expect(container.querySelector('[data-hd2d-scene="auth-title"]')).toBeTruthy();
    expect(container.querySelector('[data-auth-composition="v3"]')).toBeTruthy();
    expect(container.querySelector('img[src="/backgrounds/login/login-bg.png"]')).toBeNull();
    expect(container.querySelector('img[src="/backgrounds/hd2d/auth/preview-v1/depth-atmosphere-v3.png"]')).toBeTruthy();
    expect(container.querySelector('img[src="/backgrounds/hd2d/auth/preview-v1/town-depth-v1.png"]')).toBeTruthy();
    expect(container.querySelector('img[src="/backgrounds/hd2d/auth/preview-v1/town-side-buildings-v1.png"]')).toBeTruthy();
    expect(container.querySelector('img[src="/backgrounds/hd2d/auth/preview-v1/natural-environment-v1.png"]')).toBeTruthy();
    expect(container.querySelector('img[src="/backgrounds/hd2d/auth/preview-v1/foreground-stage-v1-trimmed.png"]')).toBeTruthy();
    expect(container.querySelector('img[src="/backgrounds/hd2d/auth/preview-v1/town-props-v1.png"]')).toBeTruthy();
    expect(container.querySelector('img[src="/backgrounds/hd2d/auth/preview-v1/adaptabuddy-title-v2.png"]')).toBeTruthy();
  });

  it("renders the V3 auth menu as a vertical JRPG command stack", () => {
    const { container } = render(<LoginScreen />);

    const actionMenu = container.querySelector('[data-auth-menu-actions="v3"]');
    expect(actionMenu).toBeTruthy();

    expect(
      within(actionMenu as HTMLElement)
        .getAllByRole("button")
        .map((button) => button.textContent)
    ).toEqual(["Log In", "Sign Up", "OAuth", "Google"]);
  });

  it("defines the shared JRPG command highlight interactions for pointer, keyboard, touch, and reduced motion", () => {
    expect(existsSync(sharedCommandStylesPath)).toBe(true);
    expect(sharedCommandStyles).toContain(".commandButton::before");
    expect(sharedCommandStyles).toContain(".commandButton::after");
    expect(sharedCommandStyles).toContain("@keyframes commandHighlightRipple");
    expect(sharedCommandStyles).toContain("@media (hover: hover)");
    expect(sharedCommandStyles).toContain(".commandButton:hover::before");
    expect(sharedCommandStyles).toContain(".commandButton:focus-visible::before");
    expect(sharedCommandStyles).toContain(".commandButton:active::before");
    expect(sharedCommandStyles).toContain("@media (prefers-reduced-motion: reduce)");
    expect(sharedCommandStyles).toContain("text-transform: uppercase;");
    expect(sharedCommandStyles).toContain("letter-spacing: var(--jrpg-command-letter-spacing, 0.08em);");
  });

  it("keeps password text centered by balancing reveal-button padding", () => {
    const passwordInputBlock = loginScreenStyles.match(/\.passwordInput\s*\{[^}]+\}/)?.[0] ?? "";

    expect(passwordInputBlock).toContain("padding-left: 36px;");
    expect(passwordInputBlock).toContain("padding-right: 36px;");
  });

  it("matches the V3 preview spacing from fields into the command stack", () => {
    const { container } = render(<LoginScreen />);
    const authFormBlock = loginScreenStyles.match(/\.authForm\s*\{[^}]+\}/)?.[0] ?? "";
    const actionMenu = container.querySelector('[data-auth-menu-actions="v3"]') as HTMLElement;

    expect(authFormBlock).toContain("gap: 0;");
    expect(actionMenu.style.marginTop).toBe("24px");
    expect(actionMenu.style.paddingTop).toBe("");
  });

  it("anchors visible sign-in controls as one stack independent of auth messages", () => {
    const { container } = render(<LoginScreen />);
    const authControlStackBlock =
      loginScreenStyles.match(/\.authControlStack\s*\{[^}]+\}/)?.[0] ?? "";
    const authStackLogoBlock =
      loginScreenStyles.match(/\.authStackLogo\s*\{[^}]+\}/)?.[0] ?? "";
    const fieldStackBlock = loginScreenStyles.match(/\.fieldStack\s*\{[^}]+\}/)?.[0] ?? "";
    const authInputBlock = loginScreenStyles.match(/\.authInput\s*\{[^}]+\}/)?.[0] ?? "";
    const messageBlock = loginScreenStyles.match(/\.message\s*\{[^}]+\}/)?.[0] ?? "";
    const stack = container.querySelector('[data-auth-control-stack="v3"]') as HTMLElement;
    const actionMenu = stack?.querySelector('[data-auth-menu-actions="v3"]') as HTMLElement;
    const logInButton = within(actionMenu).getByRole("button", { name: "Log In" });
    const actionButtons = within(actionMenu).getAllByRole("button");
    const titleImages = container.querySelectorAll(
      'img[src="/backgrounds/hd2d/auth/preview-v1/adaptabuddy-title-v2.png"]'
    );

    expect(stack).toBeTruthy();
    expect(
      stack.querySelector('img[src="/backgrounds/hd2d/auth/preview-v1/adaptabuddy-title-v2.png"]')
    ).toBeTruthy();
    expect(titleImages).toHaveLength(1);
    expect(within(stack).getByLabelText("Email")).toBeTruthy();
    expect(within(stack).getByLabelText("Password")).toBeTruthy();
    expect(
      within(actionMenu)
        .getAllByRole("button")
        .map((button) => button.textContent)
    ).toEqual(["Log In", "Sign Up", "OAuth", "Google"]);
    expect(stack.querySelector('[role="status"], [role="alert"]')).toBeNull();

    expect(authControlStackBlock).toContain("display: flex;");
    expect(authControlStackBlock).toContain("flex-direction: column;");
    expect(authStackLogoBlock).toContain("width: min(733px, 100%);");
    expect(authStackLogoBlock).toContain("margin-bottom: -24px;");
    expect(fieldStackBlock).toContain("width: min(420px, 100%);");
    expect(fieldStackBlock).toContain("gap: 9px;");
    expect(authInputBlock).toContain("height: 47px;");
    expect(authInputBlock).toContain("font-size: clamp(1.34rem, 1.11rem + 0.77vw, 1.56rem);");
    expect(loginScreenStyles).toContain("width: min(76vw, 100%);");
    expect(loginScreenStyles).toContain("height: 42px;");
    expect(loginScreenStyles).toContain("font-size: 23px;");
    expect(actionMenu.dataset.jrpgCommandMenu).toBe("auth");
    expect(actionMenu.style.getPropertyValue("--jrpg-command-width")).toBe("181px");
    expect(actionMenu.style.getPropertyValue("--jrpg-command-gap")).toBe("9px");
    expect(actionMenu.style.getPropertyValue("--jrpg-command-min-height")).toBe("2.15rem");
    expect(actionButtons.every((button) => button.dataset.jrpgCommand === "true")).toBe(true);
    expect(logInButton.style.width).toBe("");
    expect(logInButton.style.fontSize).toBe("");
    expect(logInButton.style.fontFamily).toBe("");
    expect(logInButton.style.letterSpacing).toBe("");
    expect(logInButton.style.borderLeftColor).toBe("");
    expect(logInButton.style.borderRightColor).toBe("");
    expect(logInButton.style.background).toBe("");
    expect(messageBlock).toContain("width: min(420px, 100%);");
    expect(messageBlock).toContain("position: absolute;");
  });

  it("clamps the wide desktop composition to the V3 preview stage", () => {
    const wideDesktopQuery = "@media (min-width: 1024px) and (min-aspect-ratio: 16 / 9)";

    expect(authTitleSceneStyles).toContain(wideDesktopQuery);
    expect(authTitleSceneStyles).toContain("width: min(124vw, 220.45svh);");
    expect(authTitleSceneStyles).toContain("width: min(96vw, 170.67svh);");
    expect(authTitleSceneStyles).toContain("bottom: -8%;");
    expect(loginScreenStyles).toContain(wideDesktopQuery);
    expect(loginScreenStyles).toContain("top: 42%;");
  });

  it("keeps the wide desktop house layer full-bleed on the right edge", () => {
    expect(authTitleSceneStyles).toContain("width: 112vw;");
  });

  it("renders sign in by default and accepts input", async () => {
    const user = userEvent.setup();
    render(<LoginScreen />);

    const modeToggle = screen.getByRole("button", { name: "Switch to sign up mode" });
    expect(modeToggle.getAttribute("aria-pressed")).toBe("false");

    const signInPanel = screen.getByRole("region", { name: "Sign in form" });
    const email = within(signInPanel).getByLabelText("Email") as HTMLInputElement;
    const password = within(signInPanel).getByLabelText("Password") as HTMLInputElement;

    await user.type(email, "demo@example.com");
    await user.type(password, "hunter2");

    expect(email.value).toBe("demo@example.com");
    expect(password.value).toBe("hunter2");
  });

  it("switches to sign up tab and carries redirectTo hidden field", async () => {
    render(<LoginScreen initialTab="signup" redirectTo="/dashboard?view=weekly" />);

    const modeToggle = screen.getByRole("button", { name: "Switch to sign in mode" });
    expect(modeToggle.getAttribute("aria-pressed")).toBe("true");

    const signUpPanel = screen.getByRole("region", { name: "Sign up form" });
    expect(within(signUpPanel).getByLabelText("Confirm password")).toBeTruthy();

    const hiddenRedirect = within(signUpPanel).getByDisplayValue("/dashboard?view=weekly");
    expect(hiddenRedirect.getAttribute("name")).toBe("redirectTo");
  });
});
