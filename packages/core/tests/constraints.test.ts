import { describe, expect, it } from "vitest";
import { exerciseFixture } from "../src/domain/types";
import { applyConstraints } from "../src/engine/constraints";

describe("constraints engine", () => {
  it("filters exercises by available equipment and injuries", () => {
    const result = applyConstraints(exerciseFixture, {
      equipment: ["barbell", "bench", "rack"],
      injuries: ["shoulder_pain"],
    });

    expect(result.allowed.map((exercise) => exercise.id)).toEqual([
      "sq_barbell",
      "hinge_bw",
    ]);
    expect(result.rejected).toEqual(
      expect.arrayContaining([
        { id: "dl_barbell", reason: "missing_equipment:platform" },
        { id: "bp_barbell", reason: "injury_conflict:shoulder_pain" },
        { id: "pushup", reason: "injury_conflict:shoulder_pain" },
      ])
    );
  });

  it("is deterministic for identical inputs", () => {
    const constraints = {
      equipment: ["dumbbells", "bench"],
      injuries: ["knee_pain"],
    };

    const first = applyConstraints(exerciseFixture, constraints);
    const second = applyConstraints(exerciseFixture, constraints);

    expect(first).toEqual(second);
  });
});
