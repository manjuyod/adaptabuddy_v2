import { z } from "zod";

export const GenerateWorkoutRequestSchema = z.object({
  seed: z.number().int().optional(),
  goals: z.array(z.string().min(1)).optional(),
  constraints: z
    .object({
      equipment: z.array(z.string().min(1)).optional(),
      injuries: z.array(z.string().min(1)).optional()
    })
    .optional()
});

const WorkoutItemSchema = z.object({
  exercise_id: z.string().min(1),
  name: z.string().min(1),
  sets: z.number().int().positive(),
  reps: z.string().min(1),
  rir: z.number().int().optional(),
  rest_sec: z.number().int().optional()
});

const WorkoutBlockSchema = z.object({
  name: z.string().min(1),
  items: z.array(WorkoutItemSchema).min(1)
});

export const GenerateWorkoutResponseSchema = z.object({
  status: z.enum(["ok", "no_solution"]),
  workout: z
    .object({
      workout_id: z.string().min(1),
      title: z.string().min(1),
      blocks: z.array(WorkoutBlockSchema).min(1)
    })
    .optional(),
  debug: z.object({
    seed: z.number().int(),
    selected_ids: z.array(z.string()),
    rejected: z.array(
      z.object({
        id: z.string(),
        reason: z.string()
      })
    )
  }),
  errors: z.array(z.string()).optional()
});

export type GenerateWorkoutRequest = z.infer<typeof GenerateWorkoutRequestSchema>;
export type WorkoutItem = z.infer<typeof WorkoutItemSchema>;
export type WorkoutBlock = z.infer<typeof WorkoutBlockSchema>;
export type GenerateWorkoutResponse = z.infer<typeof GenerateWorkoutResponseSchema>;
