"use client";

import { useEffect } from "react";

type DebugLayerProps = {
  rootTestId: string;
};

const debugEnabled =
  process.env.NODE_ENV === "development" && process.env.NEXT_PUBLIC_UI_DEBUG === "1";

export function DebugLayer({ rootTestId }: DebugLayerProps) {
  useEffect(() => {
    if (!debugEnabled) {
      return;
    }

    const handler = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) {
        return;
      }

      const root = target.closest(`[data-testid="${rootTestId}"]`);
      if (!root) {
        return;
      }

      const topmost = document.elementFromPoint(event.clientX, event.clientY) as HTMLElement | null;
      if (!topmost) {
        // eslint-disable-next-line no-console
        console.log("[ui-debug] elementFromPoint: null");
        return;
      }

      const descriptor = {
        tag: topmost.tagName.toLowerCase(),
        id: topmost.id || undefined,
        className: topmost.className || undefined,
        testId: topmost.getAttribute("data-testid") || undefined
      };

      // eslint-disable-next-line no-console
      console.log("[ui-debug] elementFromPoint", descriptor, topmost);
    };

    document.addEventListener("pointerdown", handler, true);
    return () => document.removeEventListener("pointerdown", handler, true);
  }, [rootTestId]);

  return null;
}
