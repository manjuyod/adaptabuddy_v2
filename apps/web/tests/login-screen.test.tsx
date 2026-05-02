// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LoginScreen } from "@/modules/auth/components/login-screen";

vi.mock("react-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-dom")>();

  return {
    ...actual,
    useFormState: () => [{ error: null, message: null }, vi.fn()],
    useFormStatus: () => ({ pending: false }),
  };
});

vi.mock("@/modules/auth/actions", () => ({
  signInAction: async () => ({ error: null, message: null }),
  signUpAction: async () => ({ error: null, message: null })
}));

vi.mock("next/image", () => ({
  default: ({ src, alt, className }: { src: string; alt: string; className?: string }) => (
    <img src={src} alt={alt} className={className} />
  )
}));

vi.mock("next/font/google", () => ({
  Cormorant_Garamond: () => ({ className: "font-cormorant-garamond" })
}));

describe("LoginScreen", () => {
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
