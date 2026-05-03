type CycleStepProps = {
  availableDaysPerWeek: number;
  macrocycleWeeks: number;
  onAvailableDaysChange: (value: number) => void;
  onMacrocycleWeeksChange: (value: number) => void;
};

export function CycleStep({
  availableDaysPerWeek,
  macrocycleWeeks,
  onAvailableDaysChange,
  onMacrocycleWeeksChange,
}: CycleStepProps) {
  return (
    <section className="space-y-4" data-testid="onboarding-step-cycle">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Step 4 of 6</p>
        <h2 className="mt-2 text-xl font-semibold text-slate-100">Cycle</h2>
        <p className="mt-1 text-sm text-slate-400">Set cadence and length for your starting block.</p>
      </div>

      <label className="space-y-2 block">
        <span className="text-xs uppercase tracking-[0.12em] text-slate-400">Available days per week</span>
        <input
          type="number"
          min={1}
          max={7}
          value={availableDaysPerWeek}
          onChange={(event) =>
            onAvailableDaysChange(Math.max(1, Math.min(7, Number(event.target.value))))
          }
          className="w-full rounded-md border border-slate-800 bg-slate-900/40 px-3 py-2 text-sm"
          data-testid="onboarding-available-days"
        />
      </label>

      <label className="space-y-2 block">
        <span className="text-xs uppercase tracking-[0.12em] text-slate-400">Macrocycle weeks</span>
        <input
          type="number"
          min={1}
          max={52}
          value={macrocycleWeeks}
          onChange={(event) =>
            onMacrocycleWeeksChange(Math.max(1, Math.min(52, Number(event.target.value))))
          }
          className="w-full rounded-md border border-slate-800 bg-slate-900/40 px-3 py-2 text-sm"
          data-testid="onboarding-macrocycle-weeks"
        />
      </label>
    </section>
  );
}
