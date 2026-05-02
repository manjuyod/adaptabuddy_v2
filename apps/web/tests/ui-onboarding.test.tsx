// @vitest-environment jsdom

import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ProgramCatalogItem } from "@/modules/programs/contracts";
import { completeOnboarding } from "@/modules/onboarding/actions";
import { ConfirmationStep } from "@/modules/onboarding/components/ConfirmationStep";
import { EquipmentStep } from "@/modules/onboarding/components/EquipmentStep";
import { OnboardingWizard } from "@/modules/onboarding/components/OnboardingWizard";
import { PreferencesStep } from "@/modules/onboarding/components/PreferencesStep";
import { ProgramStep } from "@/modules/onboarding/components/ProgramStep";

const mockRouter = {
  push: vi.fn(),
  refresh: vi.fn(),
};

vi.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
}));

vi.mock("@/modules/onboarding/actions", () => ({
  completeOnboarding: vi.fn(),
}));

const mockedCompleteOnboarding = vi.mocked(completeOnboarding);

const programs: ProgramCatalogItem[] = [
  {
    id: 1,
    slug: "upper-lower",
    name: "Upper Lower",
    description: "Balanced hypertrophy split",
    default_days_per_week: 4,
    min_days_per_week: 3,
    max_days_per_week: 5,
    is_active: true,
    muscleCoverage: [
      { muscle: "chest", score: 3.4 },
      { muscle: "back", score: 3.1 },
    ],
    days: [],
  },
];

describe("Spec 10 onboarding wizard", () => {
  beforeEach(() => {
    mockRouter.push.mockReset();
    mockRouter.refresh.mockReset();
    mockedCompleteOnboarding.mockReset();
    mockedCompleteOnboarding.mockResolvedValue({ status: "success" });
  });

  it("enforces step validation and completes onboarding", async () => {
    const user = userEvent.setup();
    render(<OnboardingWizard programs={programs} />);
    const click = async (testId: string) => {
      await act(async () => {
        await user.click(screen.getByTestId(testId));
      });
    };

    await click("onboarding-next");
    expect(screen.getByTestId("onboarding-equipment-error")).toBeTruthy();

    await click("onboarding-equipment-barbell");
    await click("onboarding-next");
    expect(await screen.findByTestId("onboarding-step-preferences")).toBeTruthy();

    await click("onboarding-fatigue-hard");
    await click("onboarding-unit-lbs");
    await click("onboarding-next");
    expect(await screen.findByTestId("onboarding-step-program")).toBeTruthy();

    await click("onboarding-next");
    expect(screen.getByTestId("onboarding-program-error")).toBeTruthy();

    await click("onboarding-program-1");
    await click("onboarding-next");
    expect(await screen.findByTestId("onboarding-step-confirmation")).toBeTruthy();
    expect(screen.getByText("Upper Lower")).toBeTruthy();
    expect(screen.getByText("Hard")).toBeTruthy();
    expect(screen.getByText("LBS")).toBeTruthy();

    await click("onboarding-start");

    expect(mockedCompleteOnboarding).toHaveBeenCalledWith({
      equipment: ["barbell"],
      fatigueLevel: "hard",
      unitSystem: "lbs",
      programId: 1,
    });
    expect(mockRouter.push).toHaveBeenCalledWith("/dashboard");
    expect(mockRouter.refresh).toHaveBeenCalled();
  });

  it("shows server action errors on confirmation step", async () => {
    const user = userEvent.setup();
    const click = async (testId: string) => {
      await act(async () => {
        await user.click(screen.getByTestId(testId));
      });
    };
    mockedCompleteOnboarding.mockResolvedValue({
      status: "error",
      error: "Failed to save onboarding choices.",
    });

    render(<OnboardingWizard programs={programs} />);

    await click("onboarding-equipment-barbell");
    await click("onboarding-next");
    await screen.findByTestId("onboarding-step-preferences");
    await click("onboarding-next");
    await screen.findByTestId("onboarding-step-program");
    await click("onboarding-program-1");
    await click("onboarding-next");
    await screen.findByTestId("onboarding-step-confirmation");
    await click("onboarding-start");

    expect(screen.getByTestId("onboarding-submit-error")).toBeTruthy();
    expect(mockRouter.push).not.toHaveBeenCalled();
  });
});

describe("Onboarding step components", () => {
  it("renders each step component shape", () => {
    render(
      <EquipmentStep selectedEquipment={["barbell"]} onToggle={() => {}} error={null} />,
    );
    expect(screen.getByTestId("onboarding-step-equipment")).toBeTruthy();

    render(
      <PreferencesStep
        fatigueLevel="moderate"
        unitSystem="kg"
        onFatigueChange={() => {}}
        onUnitChange={() => {}}
      />,
    );
    expect(screen.getByTestId("onboarding-step-preferences")).toBeTruthy();

    render(
      <ProgramStep
        programs={programs}
        selectedProgramId={1}
        onSelect={() => {}}
        error={null}
      />,
    );
    expect(screen.getByTestId("onboarding-step-program")).toBeTruthy();

    render(
      <ConfirmationStep
        equipment={["barbell"]}
        fatigueLevel="moderate"
        unitSystem="kg"
        programName="Upper Lower"
        submitError={null}
      />,
    );
    expect(screen.getByTestId("onboarding-step-confirmation")).toBeTruthy();
  });
});
