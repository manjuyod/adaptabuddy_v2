import { z } from "zod";
import { UnitSystemSchema } from "./preferences";
import {
  GoalBiasSchema,
  InjuryMuscleGroupSlugSchema,
  ProgramAdaptationInputsSchema,
  SelectableClassPresetIdSchema,
} from "./cycles";
export type { SelectableClassPresetId } from "./cycles";

export const OnboardingEquipmentSchema = z
  .array(z.string().trim().min(1).max(32))
  .min(1)
  .max(24);

export type OnboardingEquipment = z.infer<typeof OnboardingEquipmentSchema>;
export const OnboardingFatiguePreferenceSchema = z.enum([
  "low",
  "moderate",
  "high",
]);
export type OnboardingFatiguePreference = z.infer<
  typeof OnboardingFatiguePreferenceSchema
>;

export const OnboardingProgramSelectionSchema = z.object({
  programId: z.number().int().positive(),
  weight: z.number().gt(0).lte(100),
});

const requireUniqueSelectedProgramIds = (
  selectedPrograms: Array<{ programId: number }>,
  ctx: z.RefinementCtx,
) => {
  const seen = new Set<number>();
  for (const [index, selection] of selectedPrograms.entries()) {
    if (seen.has(selection.programId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["selectedPrograms", index, "programId"],
        message: "Program selections must be unique",
      });
      return;
    }
    seen.add(selection.programId);
  }
};

const OnboardingCycleInputShape = {
  classPresetId: SelectableClassPresetIdSchema,
  goalBias: GoalBiasSchema,
  availableDaysPerWeek: z.number().int().min(1).max(7),
  fatiguePreference: OnboardingFatiguePreferenceSchema,
  injuryMuscleGroupSlugs: z.array(InjuryMuscleGroupSlugSchema).max(24),
  macrocycleWeeks: z.number().int().min(1).max(52),
  selectedPrograms: z.array(OnboardingProgramSelectionSchema).min(1).max(12),
  challengeBaselines:
    ProgramAdaptationInputsSchema.shape.challengeBaselines.optional(),
  strengthBaselines: ProgramAdaptationInputsSchema.shape.strengthBaselines,
};

export const OnboardingCycleInputSchema = z
  .object(OnboardingCycleInputShape)
  .superRefine((value, ctx) => {
    requireUniqueSelectedProgramIds(value.selectedPrograms, ctx);
  });

export const CompleteOnboardingInputSchema = z
  .object({
    equipment: OnboardingEquipmentSchema,
    unitSystem: UnitSystemSchema,
    ...OnboardingCycleInputShape,
  })
  .strict()
  .superRefine((value, ctx) => {
    requireUniqueSelectedProgramIds(value.selectedPrograms, ctx);
  });

export type CompleteOnboardingInput = z.infer<
  typeof CompleteOnboardingInputSchema
>;

export const CompleteOnboardingResultSchema = z.object({
  status: z.enum(["success", "error"]),
  error: z.string().optional(),
});

export type CompleteOnboardingResult = z.infer<
  typeof CompleteOnboardingResultSchema
>;
