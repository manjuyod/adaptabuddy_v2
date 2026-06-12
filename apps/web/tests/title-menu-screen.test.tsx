// @vitest-environment jsdom

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TitleMenuScreen } from "@/modules/title/components/title-menu-screen";

const sharedCommandStylesPath = path.join(
  process.cwd(),
  "src/components/ui/jrpg-command-menu.module.css"
);

const sharedCommandStyles = existsSync(sharedCommandStylesPath)
  ? readFileSync(sharedCommandStylesPath, "utf8")
  : "";

vi.mock("next/image", () => ({
  default: ({
    src,
    alt,
    className,
    fill,
    priority,
    sizes,
    ...props
  }: {
    src: string;
    alt: string;
    className?: string;
    fill?: boolean;
    priority?: boolean;
    sizes?: string;
    [key: string]: unknown;
  }) => <img src={src} alt={alt} className={className} {...props} />
}));

vi.mock("next/font/google", () => ({
  Cormorant_Garamond: () => ({ className: "font-cormorant-garamond" })
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  )
}));

describe("TitleMenuScreen", () => {
  it("renders the approved shared HD-2D scene assets", () => {
    const { container } = render(<TitleMenuScreen variant="start" />);

    expect(container.querySelector('[data-hd2d-scene="auth-title"]')).toBeTruthy();
    expect(container.querySelector('img[src="/backgrounds/hd2d/auth/preview-v1/depth-atmosphere-v3.png"]')).toBeTruthy();
    expect(container.querySelector('img[src="/backgrounds/hd2d/auth/preview-v1/town-depth-v1.png"]')).toBeTruthy();
    expect(container.querySelector('img[src="/backgrounds/hd2d/auth/preview-v1/town-side-buildings-v1.png"]')).toBeTruthy();
    expect(container.querySelector('img[src="/backgrounds/hd2d/auth/preview-v1/town-props-v1.png"]')).toBeTruthy();
    expect(container.querySelector('img[src="/backgrounds/hd2d/auth/preview-v1/adaptabuddy-title-v2.png"]')).toBeTruthy();
  });

  it("renders continue/new game/settings links for continue variant", () => {
    const { container } = render(<TitleMenuScreen variant="continue" />);
    const menu = container.querySelector('[data-jrpg-command-menu="title"]') as HTMLElement;

    const continueLinks = screen.getAllByRole("link", { name: "Continue" });
    expect(continueLinks.length).toBeGreaterThan(0);
    expect(continueLinks.every((link) => link.getAttribute("href") === "/dashboard")).toBe(true);

    const newGameLinks = screen.getAllByRole("link", { name: "New Game" });
    expect(newGameLinks.length).toBeGreaterThan(0);
    expect(newGameLinks.every((link) => link.getAttribute("href") === "/onboarding")).toBe(true);

    const settingsLinks = screen.getAllByRole("link", { name: "Settings" });
    expect(settingsLinks.length).toBeGreaterThan(0);
    expect(settingsLinks.every((link) => link.getAttribute("href") === "/settings")).toBe(true);

    expect(menu).toBeTruthy();
    expect(menu.style.getPropertyValue("--jrpg-command-width")).toBe("min(22rem, 88vw)");
    expect(menu.style.getPropertyValue("--jrpg-command-gap")).toBe("0.75rem");
    expect(menu.style.getPropertyValue("--jrpg-command-min-height")).toBe("3rem");
    expect(continueLinks.every((link) => link.dataset.jrpgCommand === "true")).toBe(true);
    expect(continueLinks.every((link) => link.style.borderRadius === "")).toBe(true);
    expect(continueLinks.every((link) => link.style.fontSize === "")).toBe(true);
    expect(continueLinks.every((link) => link.style.textTransform === "")).toBe(true);
  });

  it("uses the shared bracket-frame command styling instead of title-only pill formatting", () => {
    expect(existsSync(sharedCommandStylesPath)).toBe(true);
    expect(sharedCommandStyles).toContain(".commandMenu");
    expect(sharedCommandStyles).toContain(".commandButton");
    expect(sharedCommandStyles).toContain("border-radius: 0;");
    expect(sharedCommandStyles).toContain("text-transform: uppercase;");
    expect(sharedCommandStyles).toContain(".commandButton::before");
    expect(sharedCommandStyles).toContain(".commandButton::after");
  });
});
