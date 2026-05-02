"use client";

import Image from "next/image";

type AuthShellProps = {
  desktopImageSrc: string;
  mobileImageSrc: string;
  desktopOverlay: React.ReactNode;
  mobileOverlay: React.ReactNode;
};

export function AuthShell({
  desktopImageSrc,
  mobileImageSrc,
  desktopOverlay,
  mobileOverlay
}: AuthShellProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-10">
      <div className="w-full max-w-5xl">
        <div className="ab-auth-desktop relative aspect-[3/2] w-full overflow-hidden rounded-2xl">
          <Image
            src={desktopImageSrc}
            alt=""
            fill
            priority
            sizes="(min-width: 768px) 1024px, 0px"
            className="pointer-events-none select-none object-cover pixelated"
          />
          {desktopOverlay}
        </div>

        <div className="ab-auth-mobile relative aspect-[2/3] w-full overflow-hidden rounded-2xl">
          <Image
            src={mobileImageSrc}
            alt=""
            fill
            priority
            sizes="(max-width: 767px) 100vw, 0px"
            className="pointer-events-none select-none object-cover pixelated"
          />
          {mobileOverlay}
        </div>
      </div>
    </div>
  );
}
