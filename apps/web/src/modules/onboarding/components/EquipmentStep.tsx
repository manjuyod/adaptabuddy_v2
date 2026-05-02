type EquipmentStepProps = {
  selectedEquipment: string[];
  onToggle: (equipment: string) => void;
  error: string | null;
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

export function EquipmentStep({ selectedEquipment, onToggle, error }: EquipmentStepProps) {
  return (
    <section className="space-y-4" data-testid="onboarding-step-equipment">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Step 1 of 4</p>
        <h2 className="mt-2 text-xl font-semibold text-slate-100">Available Equipment</h2>
        <p className="mt-1 text-sm text-slate-400">
          Choose all equipment you can reliably use for your workouts.
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {equipmentOptions.map((option) => {
          const selected = selectedEquipment.includes(option.value);
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onToggle(option.value)}
              className={`rounded-md border px-3 py-2 text-left text-sm transition ${
                selected
                  ? "border-amber-500 bg-amber-900/20 text-amber-100"
                  : "border-slate-800 bg-slate-900/40 text-slate-200 hover:border-slate-700"
              }`}
              data-testid={`onboarding-equipment-${option.value}`}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      {error ? (
        <p className="text-sm text-red-400" data-testid="onboarding-equipment-error">
          {error}
        </p>
      ) : null}
    </section>
  );
}

export { equipmentOptions };
