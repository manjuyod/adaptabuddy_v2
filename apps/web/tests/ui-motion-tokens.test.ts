import { describe, expect, it } from "vitest";

import {
  HD2D_MOTION_TRANSITIONS,
  getReducedMotionTransition,
} from "@/lib/ui/motion";

describe("HD-2D motion tokens", () => {
  it("keeps shared transitions short enough for core training actions", () => {
    expect(HD2D_MOTION_TRANSITIONS.page.duration).toBeLessThanOrEqual(0.32);
    expect(HD2D_MOTION_TRANSITIONS.panel.duration).toBeLessThanOrEqual(0.24);
    expect(HD2D_MOTION_TRANSITIONS.tap.duration).toBeLessThanOrEqual(0.12);
  });

  it("provides deterministic reduced-motion fallbacks without spring movement", () => {
    expect(getReducedMotionTransition("page")).toEqual({
      duration: 0.01,
      ease: "linear",
    });
    expect(getReducedMotionTransition("menuFocus")).toEqual({
      duration: 0.01,
      ease: "linear",
    });
  });
});
