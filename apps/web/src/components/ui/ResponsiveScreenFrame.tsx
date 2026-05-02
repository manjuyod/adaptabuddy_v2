"use client";

import Image from "next/image";
import clsx from "clsx";
import type { ReactNode } from "react";

type ResponsiveScreenFrameProps = {
  desktopSrc: string;
  mobileSrc: string;
  alt: string;
  priority?: boolean;
  className?: string;
  children?: ReactNode;
};

export function ResponsiveScreenFrame({
  desktopSrc,
  mobileSrc,
  alt,
  priority,
  className,
  children
}: ResponsiveScreenFrameProps) {
  /**
   * Implementation notes:
   * - We render both desktop + mobile images and switch visibility using CSS breakpoints.
   *   This is server-safe (no `window` reads), avoids hydration mismatch, and keeps sizing stable.
   * - Overlays should use percentage-based positioning so they scale with the art container.
   */
  return (
    <div
      className={clsx(
        "flex min-h-[100svh] w-full items-center justify-center bg-slate-950 px-3 py-6",
        className
      )}
    >
      <div
        className={[
          // Keep the art container fully visible without stretching.
          "relative overflow-hidden rounded-2xl",
          // Mobile art is portrait; desktop art is landscape.
          "aspect-[2/3] md:aspect-[3/2]",
          // Constrain by both viewport width + height (prevents mobile URL bar / keyboard issues).
          "w-[min(100vw,calc(100svh*2/3))] md:w-[min(100vw,calc(100svh*3/2))]",
          "max-h-[100svh] max-w-[100vw]"
        ].join(" ")}
      >
        <Image
          src={mobileSrc}
          alt={alt}
          fill
          priority={priority}
          sizes="(max-width: 767px) 100vw, 0px"
          className="pointer-events-none block select-none object-contain pixelated md:hidden"
        />
        <Image
          src={desktopSrc}
          alt={alt}
          fill
          priority={priority}
          sizes="(min-width: 768px) 100vw, 0px"
          className="pointer-events-none hidden select-none object-contain pixelated md:block"
        />

        <div className="absolute inset-0">{children}</div>
      </div>
    </div>
  );
}
