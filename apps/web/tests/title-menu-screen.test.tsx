// @vitest-environment jsdom

import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TitleMenuScreen } from "@/modules/title/components/title-menu-screen";

vi.mock("next/image", () => ({
  default: ({ src, alt, className }: { src: string; alt: string; className?: string }) => (
    <img src={src} alt={alt} className={className} />
  )
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
  it("renders continue/new game/settings links for continue variant", () => {
    render(<TitleMenuScreen variant="continue" />);

    const continueLinks = screen.getAllByRole("link", { name: "Continue" });
    expect(continueLinks.length).toBeGreaterThan(0);
    expect(continueLinks.every((link) => link.getAttribute("href") === "/dashboard")).toBe(true);

    const newGameLinks = screen.getAllByRole("link", { name: "New Game" });
    expect(newGameLinks.length).toBeGreaterThan(0);
    expect(newGameLinks.every((link) => link.getAttribute("href") === "/onboarding")).toBe(true);

    const settingsLinks = screen.getAllByRole("link", { name: "Settings" });
    expect(settingsLinks.length).toBeGreaterThan(0);
    expect(settingsLinks.every((link) => link.getAttribute("href") === "/settings")).toBe(true);
  });
});
