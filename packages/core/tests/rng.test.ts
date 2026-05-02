import { describe, expect, it } from "vitest";
import { createRng, deriveSeed } from "../src/engine/rng";

describe("rng engine", () => {
  it("produces the same sequence for the same seed", () => {
    const first = createRng(12345);
    const second = createRng(12345);

    const firstSequence = Array.from({ length: 5 }, () => first());
    const secondSequence = Array.from({ length: 5 }, () => second());

    expect(firstSequence).toEqual(secondSequence);
  });

  it("produces different sequences for different seeds", () => {
    const first = createRng(12345);
    const second = createRng(54321);

    const firstSequence = Array.from({ length: 5 }, () => first());
    const secondSequence = Array.from({ length: 5 }, () => second());

    expect(firstSequence).not.toEqual(secondSequence);
  });

  it("derives stable non-zero seeds from string input", () => {
    const seedA = deriveSeed("spec-02-seed");
    const seedB = deriveSeed("spec-02-seed");
    const different = deriveSeed("spec-02-seed-2");

    expect(seedA).toBe(seedB);
    expect(seedA).toBeGreaterThan(0);
    expect(seedA).not.toBe(different);
  });
});
