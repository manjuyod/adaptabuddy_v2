import { defineConfig, devices } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  PLAYWRIGHT_PROJECT_NAMES,
  loadRepoRootDotenv,
  resolvePlaywrightE2EEnv,
} from "./tests/e2e/env";

loadRepoRootDotenv();
resolvePlaywrightE2EEnv(process.env);

const configDir = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PLAYWRIGHT_WEB_PORT ?? "4173");
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./tests/e2e/playwright",
  timeout: 120_000,
  expect: {
    timeout: 15_000,
  },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "list",
  use: {
    baseURL,
    headless: true,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: PLAYWRIGHT_PROJECT_NAMES.desktop,
      grep: /@desktop/,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 900 },
      },
    },
    {
      name: PLAYWRIGHT_PROJECT_NAMES.mobile,
      grep: /@mobile/,
      use: {
        ...devices["Pixel 5"],
      },
    },
  ],
  webServer: {
    command: `npm run dev -- --port ${port}`,
    url: baseURL,
    reuseExistingServer: true,
    timeout: 120_000,
    cwd: configDir,
    env: {
      ...process.env,
      PORT: String(port),
    },
  },
});
