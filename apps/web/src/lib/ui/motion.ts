import type { Transition } from "motion/react";

export const HD2D_MOTION_TRANSITIONS = {
  page: {
    duration: 0.28,
    ease: [0.2, 0.8, 0.2, 1],
  },
  panel: {
    duration: 0.2,
    ease: [0.16, 1, 0.3, 1],
  },
  menuFocus: {
    type: "spring",
    stiffness: 420,
    damping: 34,
    mass: 0.8,
  },
  loading: {
    duration: 1.2,
    ease: "easeInOut",
    repeat: Infinity,
  },
  tap: {
    duration: 0.08,
    ease: "easeOut",
  },
  seasonReveal: {
    duration: 0.32,
    ease: [0.2, 0.8, 0.2, 1],
  },
} as const satisfies Record<string, Transition>;

export type HD2DMotionTransitionName = keyof typeof HD2D_MOTION_TRANSITIONS;

export const HD2D_REDUCED_MOTION_TRANSITION = {
  duration: 0.01,
  ease: "linear",
} as const satisfies Transition;

export const getReducedMotionTransition = (
  _name: HD2DMotionTransitionName,
): Transition => HD2D_REDUCED_MOTION_TRANSITION;
