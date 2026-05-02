// @vitest-environment jsdom

import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ResponsiveScreenFrame } from "@/components/ui/ResponsiveScreenFrame";

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

describe("ResponsiveScreenFrame", () => {
  it("renders both images with breakpoint visibility classes", () => {
    render(<ResponsiveScreenFrame desktopSrc="/desktop.png" mobileSrc="/mobile.png" alt="Frame art" />);

    const images = screen.getAllByAltText("Frame art");
    expect(images).toHaveLength(2);

    const desktopImage = images.find((img) => img.className.includes("md:block"));
    const mobileImage = images.find((img) => img.className.includes("md:hidden"));

    expect(desktopImage?.className).toContain("hidden");
    expect(desktopImage?.getAttribute("src")).toBe("/desktop.png");
    expect(mobileImage?.className).toContain("block");
    expect(mobileImage?.getAttribute("src")).toBe("/mobile.png");
  });
});

