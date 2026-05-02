import { z } from "zod";

export const FatigueLevelSchema = z.enum(["light", "moderate", "hard", "brutal"]);
export type FatigueLevel = z.infer<typeof FatigueLevelSchema>;

export const UnitSystemSchema = z.enum(["kg", "lbs"]);
export type UnitSystem = z.infer<typeof UnitSystemSchema>;

export const ThemePreferenceSchema = z.enum(["dark", "light", "system"]);
export type ThemePreference = z.infer<typeof ThemePreferenceSchema>;

export const DisplayPreferencesSchema = z.object({
  unitSystem: UnitSystemSchema.default("kg"),
  theme: ThemePreferenceSchema.default("dark"),
});

export type DisplayPreferences = z.infer<typeof DisplayPreferencesSchema>;

export const PreferencesUpdateRequestSchema = z
  .object({
    fatigueLevel: FatigueLevelSchema.optional(),
    equipment: z.array(z.string().trim().min(1).max(32)).max(24).optional(),
    injuries: z.array(z.string().trim().min(1).max(64)).max(24).optional(),
    display: DisplayPreferencesSchema.partial().optional(),
  })
  .refine(
    (data) =>
      data.fatigueLevel !== undefined ||
      data.equipment !== undefined ||
      data.injuries !== undefined ||
      data.display !== undefined,
    {
      message:
        "Provide at least one of fatigueLevel, equipment, injuries, or display preferences",
    }
  );

export type PreferencesUpdateRequest = z.infer<typeof PreferencesUpdateRequestSchema>;

export const PreferencesUpdateResponseSchema = z.object({
  status: z.enum(["success", "error"]),
  preferences: z
    .object({
      fatigueLevel: FatigueLevelSchema,
      equipment: z.array(z.string()),
      injuries: z.array(z.string()),
      unitSystem: UnitSystemSchema.optional(),
      theme: ThemePreferenceSchema.optional(),
    })
    .optional(),
  errors: z.array(z.string()).optional(),
});

export type PreferencesUpdateResponse = z.infer<typeof PreferencesUpdateResponseSchema>;
