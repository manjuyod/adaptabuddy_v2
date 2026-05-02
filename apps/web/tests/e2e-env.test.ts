import { describe, expect, it } from "vitest";
import { resolvePlaywrightE2EEnv } from "./e2e/env";

const validEnv = {
  SUPABASE_URL: "https://vezfyhbrrpokheqipepa.supabase.co",
  SUPABASE_ANON_KEY: "anon-key",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
  SUPABASE_TEST_EMAIL: "playwright@test.com",
  SUPABASE_TEST_PASSWORD: "test-password",
  RUN_PLAYWRIGHT_E2E: "1",
} as const;

describe("playwright e2e env parser", () => {
  it("parses valid env values with defaults", () => {
    const parsed = resolvePlaywrightE2EEnv(validEnv);

    expect(parsed.supabaseUrl).toBe(validEnv.SUPABASE_URL);
    expect(parsed.anonKey).toBe(validEnv.SUPABASE_ANON_KEY);
    expect(parsed.serviceRoleKey).toBe(validEnv.SUPABASE_SERVICE_ROLE_KEY);
    expect(parsed.testEmail).toBe(validEnv.SUPABASE_TEST_EMAIL);
    expect(parsed.testPassword).toBe(validEnv.SUPABASE_TEST_PASSWORD);
    expect(parsed.runPlaywrightE2E).toBe(true);
  });

  it("throws a clear error when test credentials are missing", () => {
    expect(() =>
      resolvePlaywrightE2EEnv({
        SUPABASE_URL: validEnv.SUPABASE_URL,
        SUPABASE_ANON_KEY: validEnv.SUPABASE_ANON_KEY,
        SUPABASE_SERVICE_ROLE_KEY: validEnv.SUPABASE_SERVICE_ROLE_KEY,
        RUN_PLAYWRIGHT_E2E: validEnv.RUN_PLAYWRIGHT_E2E,
      }),
    ).toThrow(/SUPABASE_TEST_EMAIL/);
  });

  it("throws a clear error when a value shape is invalid", () => {
    expect(() =>
      resolvePlaywrightE2EEnv({
        ...validEnv,
        SUPABASE_TEST_EMAIL: "not-an-email",
      }),
    ).toThrow(/Invalid environment variable values/);
  });

  it("requires explicit live E2E opt-in", () => {
    expect(() =>
      resolvePlaywrightE2EEnv({
        ...validEnv,
        RUN_PLAYWRIGHT_E2E: undefined,
      }),
    ).toThrow(/RUN_PLAYWRIGHT_E2E/);
  });

  it("requires RUN_PLAYWRIGHT_E2E to be truthy", () => {
    expect(() =>
      resolvePlaywrightE2EEnv({
        ...validEnv,
        RUN_PLAYWRIGHT_E2E: "0",
      }),
    ).toThrow(/RUN_PLAYWRIGHT_E2E/);
  });

  it("rejects conflicting Supabase URL aliases", () => {
    expect(() =>
      resolvePlaywrightE2EEnv({
        ...validEnv,
        SUPABASE_URL: "https://vezfyhbrrpokheqipepa.supabase.co",
        NEXT_PUBLIC_SUPABASE_URL: "https://other-vezf.supabase.co",
      }),
    ).toThrow(/SUPABASE_URL.*NEXT_PUBLIC_SUPABASE_URL/);
  });

  it("accepts a single matching Supabase URL alias", () => {
    const parsed = resolvePlaywrightE2EEnv({
      ...validEnv,
      SUPABASE_URL: "https://vezfyhbrrpokheqipepa.supabase.co",
      NEXT_PUBLIC_SUPABASE_URL: "https://vezfyhbrrpokheqipepa.supabase.co",
    });

    expect(parsed.supabaseUrl).toBe("https://vezfyhbrrpokheqipepa.supabase.co");
  });

  it("accepts equivalent Supabase URL aliases with canonical origin differences", () => {
    const parsed = resolvePlaywrightE2EEnv({
      ...validEnv,
      SUPABASE_URL: "https://vezfyhbrrpokheqipepa.supabase.co",
      NEXT_PUBLIC_SUPABASE_URL: "https://vezfyhbrrpokheqipepa.supabase.co/",
    });

    expect(parsed.supabaseUrl).toBe("https://vezfyhbrrpokheqipepa.supabase.co");
  });

  it("rejects conflicting anon key aliases", () => {
    expect(() =>
      resolvePlaywrightE2EEnv({
        ...validEnv,
        SUPABASE_ANON_KEY: "anon-a",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-b",
      }),
    ).toThrow(/SUPABASE_ANON_KEY.*NEXT_PUBLIC_SUPABASE_ANON_KEY/);
  });

  it("accepts a single matching anon key alias", () => {
    const parsed = resolvePlaywrightE2EEnv({
      ...validEnv,
      SUPABASE_ANON_KEY: "anon-key",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
    });

    expect(parsed.anonKey).toBe("anon-key");
  });

  it("rejects conflicting service-role aliases", () => {
    expect(() =>
      resolvePlaywrightE2EEnv({
        ...validEnv,
        SUPABASE_SERVICE_ROLE_KEY: "service-a",
        SUPABASE_TARGET_SERVICE_ROLE_KEY: "service-b",
      }),
    ).toThrow(/SUPABASE_SERVICE_ROLE_KEY|SUPABASE_TARGET_SERVICE_ROLE_KEY/);
  });

  it("accepts a single matching service-role alias", () => {
    const parsed = resolvePlaywrightE2EEnv({
      ...validEnv,
      SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
      SUPABASE_TARGET_SERVICE_ROLE_KEY: "service-role-key",
    });

    expect(parsed.serviceRoleKey).toBe("service-role-key");
  });

  it("enforces expected Supabase project reference in URL", () => {
    expect(() =>
      resolvePlaywrightE2EEnv({
        ...validEnv,
        SUPABASE_URL: "https://not-this-project.supabase.co",
      }),
    ).toThrow(/vezfyhbrrpokheqipepa/);
  });

  it("rejects spoofed Supabase hostnames that only contain the project ref", () => {
    expect(() =>
      resolvePlaywrightE2EEnv({
        ...validEnv,
        SUPABASE_URL: "https://vezfyhbrrpokheqipepa.supabase.co.evil.example",
      }),
    ).toThrow(/vezfyhbrrpokheqipepa/);
  });

  it("requires the expected Supabase URL to use https", () => {
    expect(() =>
      resolvePlaywrightE2EEnv({
        ...validEnv,
        SUPABASE_URL: "http://vezfyhbrrpokheqipepa.supabase.co",
      }),
    ).toThrow(/https/);
  });
});
