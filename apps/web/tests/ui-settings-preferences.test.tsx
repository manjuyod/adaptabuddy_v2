// @vitest-environment jsdom

import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SettingsPreferencesPanel } from "@/modules/settings/components/SettingsPreferencesPanel";

const mockFetch = vi.fn();

beforeEach(() => {
  mockFetch.mockReset();
  global.fetch = mockFetch as unknown as typeof fetch;
});

describe("SettingsPreferencesPanel", () => {
  it("saves updated equipment, injuries, fatigue, and display settings", async () => {
    const user = userEvent.setup();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ status: "success" }),
    });

    render(
      <SettingsPreferencesPanel
        initialFatigueLevel="moderate"
        initialEquipment={[]}
        initialInjuries={[]}
        initialUnitSystem="kg"
        initialTheme="dark"
      />
    );

    await act(async () => {
      await user.click(screen.getByTestId("equipment-barbell"));
      await user.click(screen.getByTestId("fatigue-hard"));
      await user.click(screen.getByTestId("unit-lbs"));
      await user.click(screen.getByTestId("theme-system"));
      await user.type(screen.getByTestId("injury-input"), "Left Shoulder");
      await user.click(screen.getByTestId("injury-add"));
    });
    expect(screen.getByTestId("injury-remove-left-shoulder")).toBeTruthy();
    await act(async () => {
      await user.click(screen.getByTestId("preferences-save"));
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const body = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string);
    expect(body).toMatchObject({
      fatigueLevel: "hard",
      equipment: ["barbell"],
      injuries: ["left-shoulder"],
      display: {
        unitSystem: "lbs",
        theme: "system",
      },
    });
    expect(await screen.findByText(/preferences updated/i)).toBeTruthy();
  });
});
