"use client";

import Link from "next/link";
import Image from "next/image";
import { Cormorant_Garamond } from "next/font/google";
import { type CSSProperties, useEffect, useState } from "react";
import { NEW_GAME_ROUTE } from "@/lib/start-screen";

type TitleRoute = "/dashboard" | "/settings" | typeof NEW_GAME_ROUTE;

const cormorantGaramond = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap"
});

const menuButtons: Array<{ label: "New Game" | "Continue" | "Settings"; href: TitleRoute }> = [
  { label: "New Game", href: NEW_GAME_ROUTE },
  { label: "Continue", href: "/dashboard" },
  { label: "Settings", href: "/settings" }
];

const menuButtonBaseStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: "100%",
  minHeight: "3rem",
  padding: "0.75rem 1.25rem",
  borderRadius: "999px",
  border: "none",
  color: "#ffffff",
  fontSize: "0.98rem",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  textAlign: "center"
};

export type TitleMenuVariant = "start" | "continue";

export function TitleMenuScreen({ variant }: { variant: TitleMenuVariant }) {
  const [hasLoaded, setHasLoaded] = useState(false);
  const loginBackgroundSrc = "/backgrounds/login/login-bg.png";

  useEffect(() => {
    setHasLoaded(true);
  }, []);

  return (
    <main
      data-variant={variant}
      style={{
        position: "relative",
        minHeight: "100vh",
        overflow: "hidden",
        backgroundColor: "#0b1021"
      }}
    >
      <Image
        aria-hidden
        src={loginBackgroundSrc}
        alt=""
        fill
        priority
        sizes="100vw"
        style={{
          objectFit: "cover",
          zIndex: 0,
          pointerEvents: "none",
          userSelect: "none"
        }}
      />
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 1,
          background: "rgba(0, 0, 0, 0.25)"
        }}
      />

      <div
        style={{
          position: "relative",
          zIndex: 2,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "40px 16px"
        }}
      >
        <div
          aria-hidden
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            transform: "translate(-50%, -50%)",
            width: "min(720px, 92vw)",
            height: "min(560px, 78vh)",
            zIndex: 2,
            borderRadius: "24px",
            background:
              "radial-gradient(circle at center, rgba(0,0,0,0.28) 0%, rgba(0,0,0,0.10) 45%, rgba(0,0,0,0) 75%)"
          }}
        />

        <p
          className={cormorantGaramond.className}
          style={{
            position: "absolute",
            top: "22%",
            left: "50%",
            transform: hasLoaded
              ? "translateX(-50%) translateY(0) scaleY(1.14)"
              : "translateX(-50%) translateY(10px) scaleY(1.14)",
            transformOrigin: "center",
            margin: 0,
            color: "#ffffff",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            fontFamily: "\"Cormorant Garamond\", Garamond, \"Times New Roman\", serif",
            fontSize: "clamp(2.618rem, 1.2rem + 4.236vw, 5.236rem)",
            lineHeight: 0.95,
            fontWeight: 300,
            fontStyle: "italic",
            textShadow: "0 2px 0 rgba(0,0,0,0.45), 0 10px 28px rgba(0,0,0,0.65)",
            mixBlendMode: "screen",
            opacity: hasLoaded ? 0.9 : 0,
            transition:
              "opacity 520ms ease-out, transform 700ms cubic-bezier(0.22, 1, 0.36, 1)",
            zIndex: 4
          }}
        >
          AdaptaBuddy
        </p>

        <nav
          aria-label="Start menu"
          className={cormorantGaramond.className}
          style={{
            position: "absolute",
            left: "50%",
            top: "66%",
            transform: hasLoaded ? "translate(-50%, 0)" : "translate(-50%, 18px)",
            width: "min(22rem, 88vw)",
            zIndex: 4,
            display: "flex",
            flexDirection: "column",
            gap: "0.75rem",
            opacity: hasLoaded ? 1 : 0,
            transition:
              "opacity 460ms ease-out 120ms, transform 680ms cubic-bezier(0.22, 1, 0.36, 1) 120ms"
          }}
        >
          {menuButtons.map((button, index) => {
            const delayMs = 180 + index * 80;
            return (
              <Link
                key={button.label}
                href={button.href}
                className="bg-transparent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgba(255,200,120,0.75)] transition-[background-color,box-shadow] duration-300 hover:bg-[rgba(255,255,255,0.08)] hover:shadow-[0_0_14px_rgba(255,255,255,0.24)]"
                style={{
                  ...menuButtonBaseStyle,
                  opacity: hasLoaded ? 1 : 0,
                  transform: hasLoaded ? "translateY(0)" : "translateY(14px)",
                  transition: `opacity 420ms ease-out ${delayMs}ms, transform 560ms cubic-bezier(0.22, 1, 0.36, 1) ${delayMs}ms`
                }}
              >
                {button.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </main>
  );
}
