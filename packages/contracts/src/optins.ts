import { z } from "zod";

export const RecoveryOverrideSchema = z.enum(["normal", "enhanced", "compromised"]);

export type RecoveryOverride = z.infer<typeof RecoveryOverrideSchema>;

export const DEFAULT_OPT_INS = {
  allowExtremeVolume: false,
  volumeMultiplierCap: 1,
  specializationMode: false,
  specializedMuscles: [] as string[],
  allowDailyTraining: false,
  allowDoubleSession: false,
  chaosBlockEnabled: false,
  ignoreDeloadRecommendations: false,
  recoveryOverride: "normal" as const,
};

export const UserOptInSchema = z
  .object({
    allowExtremeVolume: z.boolean().default(DEFAULT_OPT_INS.allowExtremeVolume),
    volumeMultiplierCap: z
      .number()
      .min(1)
      .max(3)
      .default(DEFAULT_OPT_INS.volumeMultiplierCap),
    specializationMode: z.boolean().default(DEFAULT_OPT_INS.specializationMode),
    specializedMuscles: z.array(z.string()).default(DEFAULT_OPT_INS.specializedMuscles),
    allowDailyTraining: z.boolean().default(DEFAULT_OPT_INS.allowDailyTraining),
    allowDoubleSession: z.boolean().default(DEFAULT_OPT_INS.allowDoubleSession),
    chaosBlockEnabled: z.boolean().default(DEFAULT_OPT_INS.chaosBlockEnabled),
    ignoreDeloadRecommendations: z
      .boolean()
      .default(DEFAULT_OPT_INS.ignoreDeloadRecommendations),
    recoveryOverride: RecoveryOverrideSchema.default(DEFAULT_OPT_INS.recoveryOverride),
  })
  .default(DEFAULT_OPT_INS);

export type UserOptIn = z.infer<typeof UserOptInSchema>;

export const OptInUpdateRequestSchema = z
  .object({
    optIns: UserOptInSchema.optional(),
    acknowledgedRisks: z.array(z.string()).optional(),
  })
  .refine((data) => data.optIns || data.acknowledgedRisks, {
    message: "Provide optIns or acknowledgedRisks",
  });

export type OptInUpdateRequest = z.infer<typeof OptInUpdateRequestSchema>;

export const OptInUpdateResponseSchema = z.object({
  status: z.enum(["success", "error"]),
  optIns: UserOptInSchema.optional(),
  acknowledgedRisks: z.array(z.string()).optional(),
  errors: z.array(z.string()).optional(),
});

export type OptInUpdateResponse = z.infer<typeof OptInUpdateResponseSchema>;
