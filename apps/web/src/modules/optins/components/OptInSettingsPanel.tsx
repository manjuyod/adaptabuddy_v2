"use client";

import { useState } from "react";
import type { UserOptIn } from "../contracts";
import { DEFAULT_OPT_INS } from "../contracts";

type OptInSettingsPanelProps = {
  initialOptIns: UserOptIn | null;
  initialAcknowledgedRisks: string[] | null;
};

type ToggleKey =
  | "allowExtremeVolume"
  | "specializationMode"
  | "allowDailyTraining"
  | "allowDoubleSession"
  | "chaosBlockEnabled"
  | "ignoreDeloadRecommendations";

const volumeOptions = [1, 1.5, 2, 2.5, 3];

const toggleDefinitions: {
  key: ToggleKey;
  label: string;
  description: string;
  risk: string;
  requiresConfirmation: boolean;
  testId: string;
}[] = [
  {
    key: "allowExtremeVolume",
    label: "Allow Extreme Volume",
    description: "Permit manual requests above 2x MRV.",
    risk: "High overuse risk and prolonged recovery debt.",
    requiresConfirmation: true,
    testId: "optin-allowExtremeVolume",
  },
  {
    key: "specializationMode",
    label: "Specialization Mode",
    description: "Bias planning toward selected muscle groups.",
    risk: "Can starve non-priority muscle volume.",
    requiresConfirmation: false,
    testId: "optin-specializationMode",
  },
  {
    key: "allowDailyTraining",
    label: "Allow Daily Training",
    description: "Allow repeated loading on the same muscle group.",
    risk: "Accumulated fatigue can outpace adaptation quickly.",
    requiresConfirmation: true,
    testId: "optin-allowDailyTraining",
  },
  {
    key: "allowDoubleSession",
    label: "Allow Double Sessions",
    description: "Allow two sessions in a single day.",
    risk: "Elevates systemic fatigue and sleep demand.",
    requiresConfirmation: true,
    testId: "optin-allowDoubleSession",
  },
  {
    key: "chaosBlockEnabled",
    label: "Chaos Block Enabled",
    description: "Permit aggressive template mixing.",
    risk: "Program coherence drops and progression tracking gets noisier.",
    requiresConfirmation: true,
    testId: "optin-chaosBlockEnabled",
  },
  {
    key: "ignoreDeloadRecommendations",
    label: "Ignore Deload Recommendations",
    description: "Suppress automatic deload nudges.",
    risk: "Raises risk of stagnation and injury under chronic fatigue.",
    requiresConfirmation: true,
    testId: "optin-ignoreDeloadRecommendations",
  },
];

export function OptInSettingsPanel({
  initialOptIns,
  initialAcknowledgedRisks,
}: OptInSettingsPanelProps) {
  const [optIns, setOptIns] = useState<UserOptIn>(
    initialOptIns ?? { ...DEFAULT_OPT_INS }
  );
  const [acknowledgedRisks] = useState<string[]>(initialAcknowledgedRisks ?? []);
  const [status, setStatus] = useState<"idle" | "saving" | "success" | "error">(
    "idle"
  );
  const [message, setMessage] = useState<string | null>(null);
  const [pendingConfirmation, setPendingConfirmation] = useState<{
    key: ToggleKey;
    label: string;
    risk: string;
  } | null>(null);

  const updateOptIn = <K extends keyof UserOptIn>(key: K, value: UserOptIn[K]) => {
    setOptIns((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleToggle = (definition: (typeof toggleDefinitions)[number], nextValue: boolean) => {
    if (nextValue && definition.requiresConfirmation && !optIns[definition.key]) {
      setPendingConfirmation({
        key: definition.key,
        label: definition.label,
        risk: definition.risk,
      });
      return;
    }

    updateOptIn(definition.key, nextValue);
  };

  const handleSave = async () => {
    setStatus("saving");
    setMessage(null);

    try {
      const response = await fetch("/api/v0/optins/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          optIns,
          acknowledgedRisks,
        }),
      });

      const data = (await response.json()) as {
        status: "success" | "error";
        errors?: string[];
      };

      if (!response.ok || data.status === "error") {
        setStatus("error");
        setMessage(data.errors?.join(", ") ?? "Failed to save opt-ins");
        return;
      }

      setStatus("success");
      setMessage("Opt-ins updated successfully.");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Failed to save opt-ins");
    }
  };

  const handleMusclesChange = (value: string) => {
    const parsed = value
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
    updateOptIn("specializedMuscles", parsed);
  };

  return (
    <div className="space-y-4" data-testid="optin-settings">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-amber-300">Guardrail Opt-Ins</p>
        <h2 className="mt-2 text-lg font-semibold text-slate-100">Training Overrides</h2>
        <p className="mt-1 text-sm text-slate-400">
          These switches unlock higher-risk training scenarios. Leave them off unless you
          intentionally want to override the guardrails.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {toggleDefinitions.map((definition) => (
          <label
            key={definition.key}
            className="flex items-start justify-between gap-4 rounded-lg border border-slate-800 bg-slate-900/40 p-4 text-sm text-slate-200"
          >
            <span>
              <span className="block font-semibold">{definition.label}</span>
              <span className="text-xs text-slate-400">{definition.description}</span>
              <span className="mt-1 block text-xs text-amber-300/80">
                Risk: {definition.risk}
              </span>
            </span>
            <input
              type="checkbox"
              checked={optIns[definition.key]}
              onChange={(event) => handleToggle(definition, event.target.checked)}
              className="mt-1 h-4 w-4 rounded border-slate-500 bg-slate-900 text-amber-400 focus:ring-amber-400"
              data-testid={definition.testId}
            />
          </label>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="flex flex-col gap-2 rounded-lg border border-slate-800 bg-slate-900/40 p-4 text-sm text-slate-200">
          <span className="font-semibold">Volume Multiplier Cap</span>
          <select
            value={optIns.volumeMultiplierCap}
            onChange={(event) =>
              updateOptIn("volumeMultiplierCap", Number(event.target.value))
            }
            className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200"
            data-testid="optin-volumeMultiplierCap"
          >
            {volumeOptions.map((option) => (
              <option key={option} value={option}>
                {option.toFixed(1)}x
              </option>
            ))}
          </select>
          <span className="text-xs text-slate-400">
            Max multiplier accepted for manual volume escalation.
          </span>
        </label>

        <label className="flex flex-col gap-2 rounded-lg border border-slate-800 bg-slate-900/40 p-4 text-sm text-slate-200">
          <span className="font-semibold">Recovery Override</span>
          <select
            value={optIns.recoveryOverride}
            onChange={(event) =>
              updateOptIn("recoveryOverride", event.target.value as UserOptIn["recoveryOverride"])
            }
            className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200"
            data-testid="optin-recoveryOverride"
          >
            <option value="normal">Normal</option>
            <option value="enhanced">Enhanced</option>
            <option value="compromised">Compromised</option>
          </select>
          <span className="text-xs text-slate-400">
            Adjust guardrail sensitivity to expected recovery quality.
          </span>
        </label>
      </div>

      <label className="flex flex-col gap-2 rounded-lg border border-slate-800 bg-slate-900/40 p-4 text-sm text-slate-200">
        <span className="font-semibold">Specialized Muscles</span>
        <input
          type="text"
          value={optIns.specializedMuscles.join(", ")}
          onChange={(event) => handleMusclesChange(event.target.value)}
          placeholder="chest, back, quads"
          className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200"
          data-testid="optin-specializedMuscles"
        />
        <span className="text-xs text-slate-400">
          Comma-separated muscle group slugs for specialization focus.
        </span>
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={status === "saving"}
          className="rounded-md bg-amber-500 px-5 py-2 text-sm font-semibold text-slate-900 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-300"
          data-testid="optin-save"
        >
          {status === "saving" ? "Saving..." : "Save Opt-Ins"}
        </button>
        {message && (
          <span
            className={`text-sm ${status === "error" ? "text-red-400" : "text-emerald-400"}`}
          >
            {message}
          </span>
        )}
      </div>

      {pendingConfirmation ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4"
          role="dialog"
          aria-modal="true"
          data-testid="optin-confirm-dialog"
        >
          <div className="w-full max-w-md rounded-xl border border-amber-600/60 bg-slate-900 p-5 shadow-xl">
            <p className="text-xs uppercase tracking-[0.15em] text-amber-300">Risk Confirmation</p>
            <h3 className="mt-2 text-lg font-semibold text-slate-100">
              Enable {pendingConfirmation.label}?
            </h3>
            <p className="mt-2 text-sm text-slate-300">{pendingConfirmation.risk}</p>
            <p className="mt-2 text-xs text-slate-400">
              Confirm only if you intentionally accept the training tradeoffs.
            </p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  updateOptIn(pendingConfirmation.key, true);
                  setPendingConfirmation(null);
                }}
                className="rounded-md bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-amber-400"
                data-testid="optin-confirm-enable"
              >
                Enable Anyway
              </button>
              <button
                type="button"
                onClick={() => setPendingConfirmation(null)}
                className="rounded-md border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-500"
                data-testid="optin-cancel-enable"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
