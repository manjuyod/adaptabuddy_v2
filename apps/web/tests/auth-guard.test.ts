import { describe, expect, it } from "vitest";
import { ROUTES } from "../src/lib/routes";
import { getAuthGuardRedirect } from "../src/lib/auth/guard";

describe("auth guard", () => {
  it("redirects unauthenticated users from protected routes to /login", () => {
    const redirect = getAuthGuardRedirect({
      pathname: "/start",
      search: "",
      isAuthenticated: false
    });

    expect(redirect).toEqual({
      pathname: ROUTES.auth.login,
      searchParams: { redirectTo: "/start" }
    });
  });

  it("redirects unauthenticated users from /onboarding", () => {
    const redirect = getAuthGuardRedirect({
      pathname: "/onboarding",
      search: "",
      isAuthenticated: false,
    });

    expect(redirect).toEqual({
      pathname: ROUTES.auth.login,
      searchParams: { redirectTo: "/onboarding" },
    });
  });

  it("preserves search params in redirectTo", () => {
    const redirect = getAuthGuardRedirect({
      pathname: "/dashboard",
      search: "?view=weekly",
      isAuthenticated: false
    });

    expect(redirect).toEqual({
      pathname: ROUTES.auth.login,
      searchParams: { redirectTo: "/dashboard?view=weekly" }
    });
  });

  it("does not redirect unauthenticated users on login/auth routes", () => {
    expect(
      getAuthGuardRedirect({
        pathname: ROUTES.auth.login,
        search: "",
        isAuthenticated: false
      })
    ).toBeNull();

    expect(
      getAuthGuardRedirect({
        pathname: ROUTES.auth.signup,
        search: "",
        isAuthenticated: false
      })
    ).toBeNull();
  });

  it("does not redirect unauthenticated users on /offline", () => {
    const redirect = getAuthGuardRedirect({
      pathname: "/offline",
      search: "",
      isAuthenticated: false
    });

    expect(redirect).toBeNull();
  });

  it("does not redirect unauthenticated users on API routes", () => {
    const redirect = getAuthGuardRedirect({
      pathname: "/api/v0/sessions/generate",
      search: "",
      isAuthenticated: false,
    });

    expect(redirect).toBeNull();
  });

  it("redirects authenticated users away from legacy /auth/* routes to /start", () => {
    const redirect = getAuthGuardRedirect({
      pathname: "/auth/login",
      search: "",
      isAuthenticated: true
    });

    expect(redirect).toEqual({ pathname: ROUTES.start });
  });
});
