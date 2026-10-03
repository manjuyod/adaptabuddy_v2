import { describe, expect, it, vi } from "vitest";

const redirectMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

describe("deprecated title routes", () => {
  it("/title/start redirects to health onboarding", async () => {
    redirectMock.mockClear();
    const { default: Page } = await import("../app/title/start/page");

    Page();

    expect(redirectMock).toHaveBeenCalledWith("/onboarding");
  });

  it("/title/continue redirects to the health dashboard", async () => {
    redirectMock.mockClear();
    const { default: Page } = await import("../app/title/continue/page");

    Page();

    expect(redirectMock).toHaveBeenCalledWith("/dashboard");
  });
});
