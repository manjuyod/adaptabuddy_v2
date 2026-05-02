// @vitest-environment jsdom

import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ScreenFrame } from "@/components/ui/ScreenFrame";

vi.mock("next/image", () => ({
  default: ({
    src,
    alt,
    className
  }: {
    src: string;
    alt: string;
    className?: string;
  }) => <img src={src} alt={alt} className={className} />
}));

describe("ScreenFrame", () => {
  it("marks decorative layers as non-interactive and keeps foreground above", () => {
    const { container } = render(
      <ScreenFrame desktopSrc="/desktop.png" mobileSrc="/mobile.png">
        <form>
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" />
        </form>
      </ScreenFrame>
    );

    const wrapper = screen.getByTestId("screen-frame");
    const foreground = screen.getByTestId("screen-frame-foreground");

    expect(wrapper.className).toContain("relative");
    expect(foreground.className).toContain("relative");
    expect(foreground.className).toContain("z-10");

    const images = Array.from(container.querySelectorAll("img"));
    expect(images.length).toBeGreaterThanOrEqual(2);
    images.forEach((img) => {
      expect(img.className).toContain("pointer-events-none");
      expect(img.className).toContain("select-none");
    });
  });
});
