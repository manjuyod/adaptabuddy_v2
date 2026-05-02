import type { GenerateWorkoutRequest } from "@adaptabuddy/contracts";
import type { Exercise } from "../domain/types";

export type ConstraintRejection = { id: string; reason: string };

export const applyConstraints = (
  exercises: Exercise[],
  constraints: GenerateWorkoutRequest["constraints"]
) => {
  const allowed: Exercise[] = [];
  const rejected: ConstraintRejection[] = [];

  for (const exercise of exercises) {
    const hasEquipmentConstraint = Boolean(constraints?.equipment?.length);
    if (hasEquipmentConstraint) {
      const available = new Set(constraints?.equipment ?? []);
      const missing = exercise.equipment.filter((item) => !available.has(item));
      if (missing.length) {
        rejected.push({
          id: exercise.id,
          reason: `missing_equipment:${missing.join(",")}`
        });
        continue;
      }
    }

    if (constraints?.injuries?.length && exercise.contraindications?.length) {
      const injurySet = new Set(constraints.injuries);
      const conflicts = exercise.contraindications.filter((injury) => injurySet.has(injury));
      if (conflicts.length) {
        rejected.push({
          id: exercise.id,
          reason: `injury_conflict:${conflicts.join(",")}`
        });
        continue;
      }
    }

    allowed.push(exercise);
  }

  return { allowed, rejected };
};
