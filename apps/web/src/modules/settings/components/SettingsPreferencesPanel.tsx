"use client";

import { useState } from "react";
import type {
  FatigueLevel,
  ThemePreference,
  UnitSystem,
} from "../contracts";

type SettingsPreferencesPanelProps = {
  initialFatigueLevel: FatigueLevel;
  initialEquipment: string[];
  initialInjuries: string[];
  initialUnitSystem?: UnitSystem | null;
  initialTheme?: ThemePreference | null;
};

const equipmentOptions = [
  { value: "barbell", label: "Barbell" },
  { value: "dumbbell", label: "Dumbbell" },
  { value: "cable", label: "Cable" },
  { value: "machine", label: "Machine" },
  { value: "bodyweight", label: "Bodyweight" },
  { value: "kettlebell", label: "Kettlebell" },
  { value: "bands", label: "Bands" },
  { value: "trap_bar", label: "Trap Bar" },
];

const fatigueOptions: {
  value: FatigueLevel;
  label: string;
  description: string;
}[] = [
  { value: "light", label: "Light", description: "Recovery focus" },
  { value: "moderate", label: "Moderate", description: "Balanced baseline" },
  { value: "hard", label: "Hard", description: "High stimulus bias" },
  { value: "brutal", label: "Brutal", description: "Maximum intensity" },
];

const normalizeTag = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9_-]/g, "");

export function SettingsPreferencesPanel({
  initialFatigueLevel,
  initialEquipment,
  initialInjuries,
  initialUnitSystem,
  initialTheme,
}: SettingsPreferencesPanelProps) {
  const [fatigueLevel, setFatigueLevel] = useState<FatigueLevel>(initialFatigueLevel);
  const [equipment, setEquipment] = useState<string[]>(initialEquipment ?? []);
  const [injuries, setInjuries] = useState<string[]>(initialInjuries ?? []);
  const [injuryInput, setInjuryInput] = useState("");
  const [unitSystem, setUnitSystem] = useState<UnitSystem>(initialUnitSystem ?? "kg");
  const [theme, setTheme] = useState<ThemePreference>(initialTheme ?? "dark");
  const [status, setStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  const toggleEquipment = (value: string) => {
    setEquipment((previous) =>
      previous.includes(value)
        ? previous.filter((entry) => entry !== value)
        : [...previous, value]
    );
  };

  const addInjury = () => {
    const nextInjury = normalizeTag(injuryInput);
    if (!nextInjury) {
      setInjuryInput("");
      return;
    }

    setInjuries((previous) =>
      previous.includes(nextInjury) ? previous : [...previous, nextInjury]
    );
    setInjuryInput("");
  };

  const removeInjury = (value: string) => {
    setInjuries((previous) => previous.filter((entry) => entry !== value));
  };

  const handleSave = async () => {
    setStatus("saving");
    setMessage(null);

    try {
      const response = await fetch("/api/v0/preferences/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fatigueLevel,
          equipment,
          injuries,
          display: {
            unitSystem,
            theme,
          },
        }),
      });

      const data = (await response.json()) as {
        status: "success" | "error";
        errors?: string[];
      };

      if (!response.ok || data.status === "error") {
        setStatus("error");
        setMessage(data.errors?.join(", ") ?? "Failed to save preferences");
        return;
      }

      setStatus("success");
      setMessage("Preferences updated.");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Failed to save preferences");
    }
  };

  return (
    <div className="space-y-6" data-testid="settings-preferences">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Training Preferences</p>
        <h2 className="mt-2 text-lg font-semibold text-slate-100">Equipment, Recovery, and Display</h2>
        <p className="mt-1 text-sm text-slate-400">
          Tune session generation and defaults for how recommendations are presented.
        </p>
      </div>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-[0.15em] text-slate-300">Equipment</h3>
        <p className="text-xs text-slate-500">
          Pick all equipment you reliably have access to.
        </p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {equipmentOptions.map((option) => (
            <label
              key={option.value}
              className="flex items-center gap-2 rounded-md border border-slate-800 bg-slate-900/40 px-3 py-2 text-sm text-slate-200"
            >
              <input
                type="checkbox"
                checked={equipment.includes(option.value)}
                onChange={() => toggleEquipment(option.value)}
                className="h-4 w-4 rounded border-slate-600 bg-slate-950 text-amber-400 focus:ring-amber-400"
                data-testid={`equipment-${option.value}`}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-[0.15em] text-slate-300">Injuries</h3>
        <p className="text-xs text-slate-500">
          Add current limitations as tags (example: shoulder_impingement).
        </p>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            addInjury();
          }}
          className="flex gap-2"
        >
          <input
            type="text"
            value={injuryInput}
            onChange={(event) => setInjuryInput(event.target.value)}
            placeholder="Add injury tag"
            className="min-w-0 flex-1 rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200"
            data-testid="injury-input"
          />
          <button
            type="submit"
            className="rounded-md border border-slate-700 bg-slate-900/80 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-500"
            data-testid="injury-add"
          >
            Add
          </button>
        </form>
        {injuries.length === 0 ? (
          <p className="text-xs text-slate-500">No injury tags declared.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {injuries.map((injury) => (
              <button
                key={injury}
                type="button"
                onClick={() => removeInjury(injury)}
                className="rounded-full border border-amber-700/70 bg-amber-900/20 px-3 py-1 text-xs text-amber-100 transition hover:border-amber-500"
                data-testid={`injury-remove-${injury}`}
              >
                {injury} x
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-[0.15em] text-slate-300">Fatigue Level</h3>
        <div className="grid gap-2 sm:grid-cols-2">
          {fatigueOptions.map((option) => {
            const isActive = fatigueLevel === option.value;
            return (
              <label
                key={option.value}
                className={`rounded-md border px-3 py-2 text-sm transition ${
                  isActive
                    ? "border-amber-500 bg-amber-900/20 text-amber-100"
                    : "border-slate-800 bg-slate-900/40 text-slate-200"
                }`}
              >
                <input
                  type="radio"
                  name="fatigue-level"
                  value={option.value}
                  checked={isActive}
                  onChange={() => setFatigueLevel(option.value)}
                  className="sr-only"
                  data-testid={`fatigue-${option.value}`}
                />
                <span className="block font-semibold">{option.label}</span>
                <span className="text-xs text-slate-400">{option.description}</span>
              </label>
            );
          })}
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-[0.15em] text-slate-300">Display Preferences</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 rounded-md border border-slate-800 bg-slate-900/40 p-3">
            <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Units</p>
            <div className="grid grid-cols-2 gap-2">
              {(["kg", "lbs"] as const).map((value) => (
                <label
                  key={value}
                  className={`rounded-md border px-2 py-2 text-center text-xs font-semibold uppercase tracking-[0.08em] ${
                    unitSystem === value
                      ? "border-emerald-500 bg-emerald-900/20 text-emerald-100"
                      : "border-slate-700 text-slate-300"
                  }`}
                >
                  <input
                    type="radio"
                    name="unit-system"
                    value={value}
                    checked={unitSystem === value}
                    onChange={() => setUnitSystem(value)}
                    className="sr-only"
                    data-testid={`unit-${value}`}
                  />
                  {value}
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-2 rounded-md border border-slate-800 bg-slate-900/40 p-3">
            <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Theme</p>
            <div className="grid grid-cols-3 gap-2">
              {(["dark", "light", "system"] as const).map((value) => (
                <label
                  key={value}
                  className={`rounded-md border px-2 py-2 text-center text-xs font-semibold uppercase tracking-[0.08em] ${
                    theme === value
                      ? "border-indigo-500 bg-indigo-900/20 text-indigo-100"
                      : "border-slate-700 text-slate-300"
                  }`}
                >
                  <input
                    type="radio"
                    name="theme"
                    value={value}
                    checked={theme === value}
                    onChange={() => setTheme(value)}
                    className="sr-only"
                    data-testid={`theme-${value}`}
                  />
                  {value}
                </label>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={status === "saving"}
          className="rounded-md bg-emerald-500 px-5 py-2 text-sm font-semibold text-slate-900 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-300"
          data-testid="preferences-save"
        >
          {status === "saving" ? "Saving..." : "Save Preferences"}
        </button>
        {message ? (
          <span className={`text-sm ${status === "error" ? "text-red-400" : "text-emerald-300"}`}>
            {message}
          </span>
        ) : null}
      </div>
    </div>
  );
}
