import { describe, expect, it } from "vitest";
import { ROUTES } from "../src/lib/routes";
import { resolveSafeCallbackRedirect } from "../src/lib/auth/callbackRedirect";

describe("callback redirect guard", () => {
  it("falls back to start when next is missing", () => {
    const resolved = resolveSafeCallbackRedirect(null, "https://app.example.com/callback");

    expect(resolved.pathname).toBe(ROUTES.start);
  });

  it("allows same-origin relative redirects", () => {
    const resolved = resolveSafeCallbackRedirect(
      "/workout/log?from=callback",
      "https://app.example.com/callback"
    );

    expect(resolved.origin).toBe("https://app.example.com");
    expect(`${resolved.pathname}${resolved.search}`).toBe("/workout/log?from=callback");
  });

  it("rejects absolute external redirects", () => {
    const resolved = resolveSafeCallbackRedirect(
      "https://evil.example/phish",
      "https://app.example.com/callback"
    );

    expect(resolved.pathname).toBe(ROUTES.start);
    expect(resolved.origin).toBe("https://app.example.com");
  });

  it("rejects scheme-relative external redirects", () => {
    const resolved = resolveSafeCallbackRedirect(
      "//evil.example/phish",
      "https://app.example.com/callback"
    );

    expect(resolved.pathname).toBe(ROUTES.start);
    expect(resolved.origin).toBe("https://app.example.com");
  });
});
