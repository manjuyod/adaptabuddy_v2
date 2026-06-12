"use client";

import Link from "next/link";
import { type CSSProperties, useEffect, useState } from "react";
import { AuthTitleScene } from "@/components/ui/auth-title-scene";
import commandStyles from "@/components/ui/jrpg-command-menu.module.css";
import { NEW_GAME_ROUTE } from "@/lib/start-screen";

type TitleRoute = "/dashboard" | "/settings" | typeof NEW_GAME_ROUTE;

const menuButtons: Array<{ label: "New Game" | "Continue" | "Settings"; href: TitleRoute }> = [
  { label: "New Game", href: NEW_GAME_ROUTE },
  { label: "Continue", href: "/dashboard" },
  { label: "Settings", href: "/settings" }
];

export type TitleMenuVariant = "start" | "continue";

export function TitleMenuScreen({ variant }: { variant: TitleMenuVariant }) {
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    setHasLoaded(true);
  }, []);

  return (
    <AuthTitleScene variant={variant}>
        <nav
          aria-label="Start menu"
          data-jrpg-command-menu="title"
          className={commandStyles.commandMenu}
          style={{
            "--jrpg-command-width": "min(22rem, 88vw)",
            "--jrpg-command-gap": "0.75rem",
            "--jrpg-command-min-height": "3rem",
            "--jrpg-command-padding": "0.75rem 1.25rem",
            "--jrpg-command-font-size": "0.98rem",
            position: "absolute",
            left: "50%",
            top: "66%",
            transform: hasLoaded ? "translate(-50%, 0)" : "translate(-50%, 18px)",
            zIndex: 4,
            opacity: hasLoaded ? 1 : 0,
            transition:
              "opacity 460ms ease-out 120ms, transform 680ms cubic-bezier(0.22, 1, 0.36, 1) 120ms"
          } as CSSProperties}
        >
          {menuButtons.map((button, index) => {
            const delayMs = 180 + index * 80;
            return (
              <Link
                key={button.label}
                href={button.href}
                className={commandStyles.commandButton}
                data-jrpg-command="true"
                style={{
                  "--jrpg-command-delay": `${delayMs}ms`,
                  opacity: hasLoaded ? 1 : 0,
                  transform: hasLoaded ? "translateY(0)" : "translateY(14px)",
                } as CSSProperties}
              >
                {button.label}
              </Link>
            );
          })}
        </nav>
    </AuthTitleScene>
  );
}
