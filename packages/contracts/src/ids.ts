import { z } from "zod";

export const NumericIdStringSchema = z.string().regex(/^\d+$/);

export const EntityIdSchema = z.union([
  z.number().int().positive(),
  z.string().uuid(),
  NumericIdStringSchema,
]);

export type EntityId = z.infer<typeof EntityIdSchema>;
