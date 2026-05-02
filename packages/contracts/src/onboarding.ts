import { z } from "zod";
import { FatigueLevelSchema, UnitSystemSchema } from "./preferences";

export const OnboardingEquipmentSchema = z
  .array(z.string().trim().min(1).max(32))
  .min(1)
  .max(24);

export type OnboardingEquipment = z.infer<typeof OnboardingEquipmentSchema>;

export const CompleteOnboardingInputSchema = z.object({
  equipment: OnboardingEquipmentSchema,
  fatigueLevel: FatigueLevelSchema,
  unitSystem: UnitSystemSchema,
  programId: z.number().int().positive(),
});

export type CompleteOnboardingInput = z.infer<typeof CompleteOnboardingInputSchema>;

export const CompleteOnboardingResultSchema = z.object({
  status: z.enum(["success", "error"]),
  error: z.string().optional(),
});

export type CompleteOnboardingResult = z.infer<typeof CompleteOnboardingResultSchema>;
