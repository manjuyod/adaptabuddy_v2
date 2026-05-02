// @vitest-environment jsdom

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { ServiceWorkerRegistration } from "../src/components/ServiceWorkerRegistration";
import OfflinePage from "../app/offline/page";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

describe("spec 11 PWA support", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    delete process.env.NEXT_PUBLIC_ENABLE_SW;
  });

  it("has a valid manifest with required fields and icon files", () => {
    const manifestPath = path.join(appRoot, "public", "manifest.json");
    expect(fs.existsSync(manifestPath)).toBe(true);

    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as {
      name: string;
      short_name: string;
      display: string;
      start_url: string;
      theme_color: string;
      background_color: string;
      icons: Array<{ src: string; sizes: string; type: string }>;
    };

    expect(manifest.name).toBe("AdaptaBuddy");
    expect(manifest.short_name).toBe("AdaptaBuddy");
    expect(manifest.display).toBe("standalone");
    expect(manifest.start_url).toBe("/");
    expect(manifest.theme_color).toBe("#0b1021");
    expect(manifest.background_color).toBe("#0b1021");

    expect(manifest.icons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }),
        expect.objectContaining({ src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" })
      ])
    );

    for (const icon of manifest.icons) {
      const iconPath = path.join(appRoot, "public", icon.src.replace(/^\//, ""));
      expect(fs.existsSync(iconPath)).toBe(true);
    }
  });

  it("registers the service worker when explicitly enabled", async () => {
    process.env.NEXT_PUBLIC_ENABLE_SW = "1";

    const waitingWorker = { postMessage: vi.fn() };
    const register = vi.fn().mockResolvedValue({
      waiting: waitingWorker,
      installing: null,
      addEventListener: vi.fn()
    });

    Object.defineProperty(window.navigator, "serviceWorker", {
      configurable: true,
      value: {
        controller: {},
        register,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn()
      }
    });

    render(React.createElement(ServiceWorkerRegistration));

    await waitFor(() => expect(register).toHaveBeenCalledWith("/sw.js", { scope: "/" }));
    expect(waitingWorker.postMessage).toHaveBeenCalledWith({ type: "SKIP_WAITING" });
  });

  it("renders the offline fallback page with retry affordance", () => {
    render(React.createElement(OfflinePage));

    expect(screen.getByRole("heading", { name: "You are offline" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Retry connection" })).toBeTruthy();
  });
});
