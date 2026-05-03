// @vitest-environment jsdom

import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BetaFeedbackPanel } from "@/modules/support/components/BetaFeedbackPanel";

const mockFetch = vi.fn();

beforeEach(() => {
  mockFetch.mockReset();
  global.fetch = mockFetch as unknown as typeof fetch;
});

describe("BetaFeedbackPanel", () => {
  it("shows validation errors when required fields are missing", async () => {
    const user = userEvent.setup();

    render(<BetaFeedbackPanel />);

    await act(async () => {
      await user.click(screen.getByRole("button", { name: /submit feedback/i }));
    });

    expect(mockFetch).not.toHaveBeenCalled();
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("category");
    expect(alert.textContent).toContain("boundary area");
    expect(alert.textContent).toContain("severity");
    expect(alert.textContent).toContain("title");
    expect(alert.textContent).toContain("summary");
  });

  it("submits valid payload and shows success state with report id", async () => {
    const user = userEvent.setup();

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        status: "success",
        reportId: 12345,
      }),
    } as Response);

    render(<BetaFeedbackPanel />);

    await act(async () => {
      await user.selectOptions(screen.getByLabelText("Category"), "bug");
      await user.selectOptions(screen.getByLabelText("Boundary Area"), "app-shell");
      await user.selectOptions(screen.getByLabelText("Severity"), "high");
      await user.type(screen.getByLabelText("Title"), "Workout skip in beta");
      await user.type(screen.getByLabelText("Summary"), "Session failed to render summary block after login.");
      await user.click(screen.getByRole("button", { name: /submit feedback/i }));
    });

    const status = await screen.findByRole("status");
    expect(status.textContent).toContain("12345");
    expect(mockFetch).toHaveBeenCalledTimes(1);

    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/v0/support/feedback");
    expect(init.method).toBe("POST");
    expect(init.credentials).toBe("include");

    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({
      category: "bug",
      boundaryArea: "app-shell",
      severity: "high",
      title: "Workout skip in beta",
      summary: "Session failed to render summary block after login.",
      diagnosticConsent: false,
    });
    expect(body.currentRoute).toBeUndefined();
    expect(body.clientContext).toBeUndefined();
  });

  it("includes diagnostic client context only when consent is granted", async () => {
    const user = userEvent.setup();

    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 390,
    });
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      value: 720,
    });
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: false,
    });
    window.history.pushState({}, "", "/settings/test");

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        status: "success",
        reportId: 777,
      }),
    } as Response);

    render(<BetaFeedbackPanel />);

    await act(async () => {
      await user.selectOptions(screen.getByLabelText("Category"), "performance");
      await user.selectOptions(screen.getByLabelText("Boundary Area"), "telemetry-read-model");
      await user.selectOptions(screen.getByLabelText("Severity"), "high");
      await user.type(screen.getByLabelText("Title"), "Page jump issue");
      await user.type(screen.getByLabelText("Summary"), "Navigation link causes empty page.");
      await user.click(screen.getByTestId("beta-feedback-diagnostic-consent"));
      await user.click(screen.getByRole("button", { name: /submit feedback/i }));
    });

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);

    expect(body.diagnosticConsent).toBe(true);
    expect(body.currentRoute).toBe("/settings/test");
    expect(body.clientContext).toMatchObject({
      viewportWidth: 390,
      viewportHeight: 720,
      online: false,
      userAgent: window.navigator.userAgent,
    });
    expect(screen.getByRole("button", { name: /submitted/i }).hasAttribute("disabled")).toBe(true);
  });

  it("shows failure state when feedback request fails", async () => {
    const user = userEvent.setup();

    mockFetch.mockResolvedValue({
      ok: false,
      json: async () => ({
        status: "error",
        errors: ["service unavailable"],
      }),
    } as Response);

    render(<BetaFeedbackPanel />);

    await act(async () => {
      await user.selectOptions(screen.getByLabelText("Category"), "bug");
      await user.selectOptions(screen.getByLabelText("Boundary Area"), "unknown");
      await user.selectOptions(screen.getByLabelText("Severity"), "low");
      await user.type(screen.getByLabelText("Title"), "Test failure");
      await user.type(screen.getByLabelText("Summary"), "A simple test.");
      await user.click(screen.getByRole("button", { name: /submit feedback/i }));
    });

    expect((await screen.findByRole("alert")).textContent).toContain("service unavailable");
  });

  it("does not read localStorage or sessionStorage while submitting", async () => {
    const user = userEvent.setup();
    const localGetSpy = vi.spyOn(window.localStorage, "getItem");
    const sessionGetSpy = vi.spyOn(window.sessionStorage, "getItem");

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        status: "success",
        reportId: 987,
      }),
    } as Response);

    render(<BetaFeedbackPanel />);

    await act(async () => {
      await user.selectOptions(screen.getByLabelText("Category"), "workflow_pain");
      await user.selectOptions(screen.getByLabelText("Boundary Area"), "replay-debuggability");
      await user.selectOptions(screen.getByLabelText("Severity"), "medium");
      await user.type(screen.getByLabelText("Title"), "No storage read");
      await user.type(screen.getByLabelText("Summary"), "Ensure no browser auth storage is read.");
      await user.click(screen.getByRole("button", { name: /submit feedback/i }));
    });

    expect(localGetSpy).not.toHaveBeenCalled();
    expect(sessionGetSpy).not.toHaveBeenCalled();
  });
});
