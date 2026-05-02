import Image from "next/image";
import clsx from "clsx";
import type { ReactNode } from "react";
import { DebugLayer } from "./DebugLayer";

type ScreenFrameProps = {
  desktopSrc: string;
  mobileSrc: string;
  children?: ReactNode;
  className?: string;
  showArt?: boolean;
};

const debugEnabled =
  process.env.NODE_ENV === "development" && process.env.NEXT_PUBLIC_UI_DEBUG === "1";

export function ScreenFrame({
  desktopSrc,
  mobileSrc,
  children,
  className,
  showArt = true
}: ScreenFrameProps) {
  return (
    <div
      data-testid="screen-frame"
      className={clsx(
        [
          "relative flex min-h-screen min-h-[100svh] w-full items-center justify-center bg-slate-950 px-3",
          "pt-[calc(1.5rem+env(safe-area-inset-top))]",
          "pb-[calc(1.5rem+env(safe-area-inset-bottom))]"
        ],
        className
      )}
    >
      <div
        className={[
          "relative overflow-hidden rounded-2xl",
          "aspect-[2/3] md:aspect-[3/2]",
          "w-[min(100vw,calc(100svh*2/3))] md:w-[min(100vw,calc(100svh*3/2))]",
          "max-h-[100svh] max-w-[100vw]"
        ].join(" ")}
      >
        {showArt ? (
          <>
            <div className="absolute inset-0 pointer-events-none select-none md:hidden" aria-hidden="true">
              <div className="relative h-full w-full">
                <Image
                  src={mobileSrc}
                  alt=""
                  fill
                  sizes="(max-width: 767px) 100vw, 0px"
                  className="pointer-events-none select-none object-contain pixelated"
                />
              </div>
            </div>
            <div
              className="absolute inset-0 hidden pointer-events-none select-none md:block"
              aria-hidden="true"
            >
              <div className="relative h-full w-full">
                <Image
                  src={desktopSrc}
                  alt=""
                  fill
                  sizes="(min-width: 768px) 100vw, 0px"
                  className="pointer-events-none select-none object-contain pixelated"
                />
              </div>
            </div>
          </>
        ) : null}

        <div className="absolute inset-0 z-10">
          <div data-testid="screen-frame-foreground" className="relative z-10 h-full w-full">
            {children}
          </div>
        </div>
      </div>

      {debugEnabled ? <DebugLayer rootTestId="screen-frame" /> : null}
    </div>
  );
}
