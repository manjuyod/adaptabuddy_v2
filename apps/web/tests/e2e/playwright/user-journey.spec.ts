import { expect, test, type Page } from "@playwright/test";
import {
  loadRepoRootDotenv,
  resolvePlaywrightE2EEnv,
} from "../env";
import {
  createAdminSupabaseClient,
  createAnonSupabaseClient,
  ensureConfirmedTestUser,
  findWorkoutLogByNote,
  readTestUserStats,
  resetTestUserState,
  seedActiveProgramForUser,
  updateTestUserStats,
} from "../supabase-test-user";

loadRepoRootDotenv();

const env = resolvePlaywrightE2EEnv(process.env);
const adminClient = createAdminSupabaseClient(env);
const anonClient = createAnonSupabaseClient(env);

let testUserId = "";

const signInThroughUi = async (page: Page) => {
  await page.goto("/login");
  await page.locator("#login-email").fill(env.testEmail);
  await page.locator("#login-password").fill(env.testPassword);
  await page.getByRole("button", { name: /log in/i }).first().click();
  await expect(page).toHaveURL(/\/start$/);
};

const visibleButton = (page: Page, name: string | RegExp) =>
  page.locator("button:visible").filter({ hasText: name }).first();

const openWorkoutAndGenerate = async (page: Page) => {
  await page.goto("/workout");
  await page.getByRole("button", { name: "Generate Workout" }).first().click();

  const guardrailPanel = page.getByTestId("guardrail-panel");
  if (await guardrailPanel.isVisible({ timeout: 2_000 }).catch(() => false)) {
    const acknowledgments = guardrailPanel.locator('input[data-testid^="guardrail-ack-"]');
    const acknowledgmentCount = await acknowledgments.count();
    for (let index = 0; index < acknowledgmentCount; index += 1) {
      await acknowledgments.nth(index).check();
    }

    const proceed = page.getByTestId("guardrail-proceed");
    if (await proceed.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await proceed.click();
    }
  }

  await expect(visibleButton(page, "Start Workout")).toBeVisible({ timeout: 30_000 });
};

const generateAndStartWorkout = async (page: Page) => {
  await openWorkoutAndGenerate(page);
  await visibleButton(page, "Start Workout").click();
  await expect(page).toHaveURL(/\/workout\/log$/);
};

const completeFirstVisibleSet = async (page: Page, noteToken: string) => {
  await page.locator('input[placeholder="Weight (kg)"]').first().fill("60");
  await page.locator('input[placeholder="Reps"]').first().fill("8");
  await page.locator('input[placeholder="RIR"]').first().fill("2");
  await page.locator('textarea[placeholder*="How did the workout feel"]').fill(noteToken);
  await visibleButton(page, "Mark Done").click();
};

const expectAuthenticatedAnalytics = async (page: Page) => {
  const response = await page.request.get("/api/v0/reporting/analytics");
  expect(response.status()).toBe(200);
  expect(response.headers()["cache-control"] ?? "").toContain("no-store");

  const body = (await response.json()) as { status?: unknown };
  expect(body.status).toBe("success");
};

const hasObviousAuthMaterial = (entries: Array<{ key: string; value: string | null }>) =>
  entries.some(({ key, value }) => {
    const normalizedKey = key.toLowerCase();
    const normalizedValue = (value || "").toLowerCase();
    return (
      normalizedKey.includes("supabase") ||
      normalizedKey.includes("sb-") ||
      normalizedKey.includes("auth-token") ||
      normalizedValue.includes("supabase") ||
      normalizedValue.includes("access_token") ||
      normalizedValue.includes("refresh_token") ||
      normalizedValue.includes("provider_token")
    );
  });

const readStorageState = async (page: Page) => {
  return page.evaluate(() => {
    const collect = (storage: Storage) => {
      const entries = [];
      for (let index = 0; index < storage.length; index += 1) {
        const key = storage.key(index);
        if (!key) continue;
        entries.push({ key, value: storage.getItem(key) });
      }
      return entries;
    };

    return { local: collect(window.localStorage), session: collect(window.sessionStorage) };
  });
};

test.describe("Pre-beta live Supabase browser breaker suite", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    testUserId = await ensureConfirmedTestUser(
      adminClient,
      anonClient,
      env.testEmail,
      env.testPassword,
    );
  });

  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
    await resetTestUserState(adminClient, testUserId);
  });

  test.afterAll(async () => {
    if (testUserId) {
      await resetTestUserState(adminClient, testUserId);
    }
  });

  test("desktop @desktop: enforces auth boundaries and keeps the signed-in cookie session", async ({
    page,
  }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login\?redirectTo=%2Fdashboard$/);

    await page.locator("#login-email").fill(env.testEmail);
    await page.locator("#login-password").fill("invalid-password-for-test-only");
    await page.getByRole("button", { name: /log in/i }).first().click();
    await expect(page).toHaveURL(/\/login/);
    await expect(
      page.getByRole("region", { name: "Sign in form" }).locator('p[role="alert"]'),
    ).toContainText(/invalid login credentials/i);

    await signInThroughUi(page);
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: "Training Overview" })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("heading", { name: "Training Overview" })).toBeVisible();

    const storage = await readStorageState(page);
    expect(hasObviousAuthMaterial(storage.local)).toBe(false);
    expect(hasObviousAuthMaterial(storage.session)).toBe(false);

    await expectAuthenticatedAnalytics(page);
  });

  test("desktop @desktop: validates onboarding and saves a first training profile", async ({
    page,
  }) => {
    await signInThroughUi(page);
    await page.getByRole("link", { name: "New Game" }).first().click();
    await expect(page).toHaveURL(/\/onboarding$/);

    await page.getByTestId("onboarding-next").click();
    await expect(page.getByTestId("onboarding-step-gear")).toBeVisible();
    await page.getByTestId("onboarding-next").click();
    await expect(page.getByTestId("onboarding-equipment-error")).toContainText(
      /choose at least one/i,
    );

    await page.getByTestId("onboarding-equipment-barbell").click();
    await page.getByTestId("onboarding-equipment-dumbbell").click();
    await page.getByTestId("onboarding-next").click();
    await page.getByTestId("onboarding-step-recovery");
    await page.getByTestId("onboarding-fatigue-high").click();
    await page.getByTestId("onboarding-unit-lbs").click();
    await page.getByTestId("onboarding-next").click();
    await page.getByTestId("onboarding-next").click();
    await page.locator('[data-testid^="onboarding-program-input-"]').first().fill("80");
    const challengeBaselineInput = page
      .locator('[data-testid^="onboarding-challenge-baseline-"]')
      .first();
    if (await challengeBaselineInput.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await challengeBaselineInput.fill("25");
    }
    await page.getByTestId("onboarding-next").click();
    await expect(page.getByTestId("onboarding-step-confirmation")).toBeVisible();
    await page.getByTestId("onboarding-start").click();

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole("heading", { name: "Training Overview" })).toBeVisible();

    const stats = await readTestUserStats(adminClient, testUserId);
    expect(stats.preferences.equipment).toEqual(expect.arrayContaining(["barbell", "dumbbell"]));
    expect(stats.preferences.fatigueLevel).toBe("hard");
    expect(stats.preferences.unitSystem).toBe("lbs");

    const activePlanRows = await adminClient
      .from("engine_cycle_plans")
      .select("id")
      .eq("user_id", testUserId)
      .eq("is_active", true);
    expect(activePlanRows.error).toBeNull();
    expect((activePlanRows.data ?? []).length).toBeGreaterThan(0);

    const profileRows = await adminClient
      .from("engine_cycle_profiles")
      .select("id")
      .eq("user_id", testUserId);
    expect(profileRows.error).toBeNull();
    expect((profileRows.data ?? []).length).toBeGreaterThan(0);

    const mixRows = await adminClient
      .from("engine_cycle_program_mix")
      .select("id, selection_weight")
      .eq("user_id", testUserId);
    expect(mixRows.error).toBeNull();
    const mixPayload = mixRows.data ?? [];
    expect(mixPayload.length).toBeGreaterThan(0);
    expect(
      mixPayload.every(
        (row) => typeof row.selection_weight === "number" && row.selection_weight <= 1 && row.selection_weight >= 0,
      ),
    ).toBe(true);
    const weightSum = mixPayload.reduce(
      (sum, row) => sum + Number(row.selection_weight ?? 0),
      0,
    );
    expect(weightSum).toBeGreaterThanOrEqual(0.9999);
    expect(weightSum).toBeLessThanOrEqual(1.0001);
  });

  test("desktop @desktop: persists settings changes through Supabase and reload", async ({
    page,
  }) => {
    await signInThroughUi(page);
    await page.goto("/settings");

    await page.getByTestId("equipment-barbell").check();
    await page.getByTestId("equipment-cable").check();
    await page.getByTestId("injury-input").fill("Shoulder Impingement!");
    await page.getByTestId("injury-add").click();
    await page.getByTestId("fatigue-hard").check({ force: true });
    await page.getByTestId("unit-lbs").check({ force: true });
    await page.getByTestId("theme-light").check({ force: true });
    await page.getByTestId("preferences-save").click();
    await expect(page.getByText("Preferences updated.")).toBeVisible();

    await page.reload();
    await expect(page.getByTestId("equipment-barbell")).toBeChecked();
    await expect(page.getByTestId("equipment-cable")).toBeChecked();
    await expect(page.getByTestId("fatigue-hard")).toBeChecked();
    await expect(page.getByTestId("unit-lbs")).toBeChecked();
    await expect(page.getByTestId("theme-light")).toBeChecked();
    await expect(page.getByTestId("injury-remove-shoulder-impingement")).toBeVisible();

    const stats = await readTestUserStats(adminClient, testUserId);
    expect(stats.preferences.equipment).toEqual(expect.arrayContaining(["barbell", "cable"]));
    expect(stats.preferences.injuries).toContain("shoulder-impingement");
    expect(stats.preferences.fatigueLevel).toBe("hard");
    expect(stats.preferences.unitSystem).toBe("lbs");
    expect(stats.preferences.theme).toBe("light");
  });

  test("desktop @desktop: recovers missing workout session state and handles guardrail warnings", async ({
    page,
  }) => {
    await signInThroughUi(page);
    await seedActiveProgramForUser(adminClient, testUserId);
    await page.goto("/workout/log");
    await expect(page).toHaveURL(/\/workout$/);
    await expect(page.getByRole("button", { name: "Generate Workout" }).first()).toBeVisible();

    await updateTestUserStats(adminClient, testUserId, (stats) => ({
      ...stats,
      fatigue: {
        ...stats.fatigue,
        systemic: {
          current: 85,
          lastUpdated: new Date().toISOString(),
        },
      },
    }));
    await page.reload();
    await page.getByRole("button", { name: "Generate Workout" }).first().click();
    await expect(page.getByTestId("guardrail-panel")).toBeVisible();
    await expect(page.getByText("Acknowledge required warnings to continue.")).toBeVisible();
    await expect(page.getByTestId("guardrail-proceed")).toHaveCount(0);

    await page.getByTestId("guardrail-ack-high-systemic-fatigue").check();
    await page.getByTestId("guardrail-proceed").click();
    await expect(visibleButton(page, "Start Workout")).toBeVisible({ timeout: 30_000 });
  });

  test("desktop @desktop: proves guardrail blockers through the live authenticated API", async ({
    page,
  }) => {
    await signInThroughUi(page);
    await updateTestUserStats(adminClient, testUserId, (stats) => ({
      ...stats,
      preferences: {
        ...stats.preferences,
        injuries: ["shoulder"],
      },
    }));

    const response = await page.request.post("/api/v0/guardrails/evaluate", {
      data: {
        action: "session_generate",
        trainingAge: "intermediate",
        trainingThroughInjury: true,
      },
    });
    expect(response.status()).toBe(200);

    const body = (await response.json()) as {
      status?: string;
      evaluation?: { blockers?: Array<{ id?: string; title?: string }> };
    };
    expect(body.status).toBe("success");
    expect(body.evaluation?.blockers ?? []).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: "injury-override" })]),
    );
  });

  test("desktop @desktop: completes a workout once and verifies dashboard, history, and analytics", async ({
    page,
  }) => {
    const noteToken = `playwright-breaker-${Date.now()}`;
    let completeRequestCount = 0;
    page.on("request", (request) => {
      if (
        request.method() === "POST" &&
        request.url().includes("/api/v0/sessions/complete")
      ) {
        completeRequestCount += 1;
      }
    });

    await signInThroughUi(page);
    await seedActiveProgramForUser(adminClient, testUserId);
    await generateAndStartWorkout(page);
    await page.reload();
    await expect(page.getByText("Logging")).toBeVisible();

    await completeFirstVisibleSet(page, noteToken);
    await visibleButton(page, "Complete Workout").dblclick();
    await expect(page.getByText("Workout Complete!")).toBeVisible({ timeout: 30_000 });
    expect(completeRequestCount).toBe(1);

    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: "Training Overview" })).toBeVisible();
    await expect(page.getByText(/Completed sessions|Total workouts/)).toBeVisible();

    await page.goto("/history");
    const historyLink = page.locator('a[href^="/history/"]').first();
    await expect(historyLink).toBeVisible();
    await historyLink.click();
    await expect(page).toHaveURL(/\/history\/\d+$/);
    await expect(page.getByText("Workout Summary")).toBeVisible();

    const persistedLog = await findWorkoutLogByNote(adminClient, testUserId, noteToken);
    expect(persistedLog).not.toBeNull();
    await expectAuthenticatedAnalytics(page);
  });

  test("mobile @mobile: repeats core navigation and workout logging smoke", async ({ page }) => {
    const noteToken = `playwright-mobile-${Date.now()}`;
    await signInThroughUi(page);
    await seedActiveProgramForUser(adminClient, testUserId);

    await page.goto("/dashboard");
    await expect(page.getByTestId("primary-navigation-mobile")).toBeVisible();
    await page.getByTestId("primary-navigation-mobile").getByRole("link", { name: "Workout" }).click();
    await expect(page).toHaveURL(/\/workout$/);

    await openWorkoutAndGenerate(page);
    await visibleButton(page, "Start Workout").click();
    await expect(page).toHaveURL(/\/workout\/log$/);

    await completeFirstVisibleSet(page, noteToken);
    await visibleButton(page, "Complete Workout").click();
    await expect(page.getByText("Workout Complete!")).toBeVisible({ timeout: 30_000 });

    const persistedLog = await findWorkoutLogByNote(adminClient, testUserId, noteToken);
    expect(persistedLog).not.toBeNull();
  });
});
