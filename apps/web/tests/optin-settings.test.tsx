// @vitest-environment jsdom

import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OptInSettingsPanel } from "@/modules/optins/components/OptInSettingsPanel";
import { DEFAULT_OPT_INS } from "@adaptabuddy/contracts";

const mockFetch = vi.fn();

beforeEach(() => {
  mockFetch.mockReset();
  global.fetch = mockFetch as unknown as typeof fetch;
});

describe("OptInSettingsPanel", () => {
  it("requires confirmation before enabling risky opt-ins", async () => {
    const user = userEvent.setup();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ status: "success" }),
    });

    render(
      <OptInSettingsPanel
        initialOptIns={{ ...DEFAULT_OPT_INS }}
        initialAcknowledgedRisks={[]}
      />
    );

    const checkbox = screen.getByTestId("optin-allowExtremeVolume");
    await act(async () => {
      await user.click(checkbox);
    });
    expect(screen.getByTestId("optin-confirm-dialog")).toBeTruthy();
    await act(async () => {
      await user.click(screen.getByTestId("optin-confirm-enable"));
    });

    const saveButton = screen.getByTestId("optin-save");
    await act(async () => {
      await user.click(saveButton);
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const body = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string);
    expect(body.optIns.allowExtremeVolume).toBe(true);
    expect(await screen.findByText(/opt-ins updated successfully/i)).toBeTruthy();
  });
});
