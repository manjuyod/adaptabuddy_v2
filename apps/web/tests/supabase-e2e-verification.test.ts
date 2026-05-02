import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  ChaosPlanResponseSchema,
  CompleteSessionResponseSchema,
  DEFAULT_OPT_INS,
  InitializeCycleResponseSchema,
  GenerateSessionResponseSchema,
  GuardrailResponseSchema,
  OptInUpdateResponseSchema,
  ProgressionRecommendResponseSchema,
  ResolveTemplateResponseSchema,
  type UserStats,
  VolumeAllocateResponseSchema,
} from "@adaptabuddy/contracts";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

const mockHeaderState = vi.hoisted(() => ({
  cookieJar: new Map<string, string>(),
  requestIp: "127.0.0.1",
}));

const explicitRunSupabaseE2EVerification = process.env.RUN_SUPABASE_E2E_VERIFICATION;

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get(name: string) {
      const value = mockHeaderState.cookieJar.get(name);
      if (!value) return undefined;
      return { name, value };
    },
    set(input: { name: string; value: string }) {
      mockHeaderState.cookieJar.set(input.name, input.value);
    },
    delete(input: { name: string }) {
      mockHeaderState.cookieJar.delete(input.name);
    },
  }),
  headers: async () => ({
    get(name: string) {
      if (name.toLowerCase() === "x-forwarded-for") {
        return mockHeaderState.requestIp;
      }
      return null;
    },
  }),
}));

type PostHandler = (request: Request) => Promise<Response>;
type GetHandler = (request: Request) => Promise<Response>;

type LoadedRoutes = {
  sessionsInitialize: PostHandler;
  sessionsGenerate: PostHandler;
  sessionsComplete: PostHandler;
  volumeAllocate: PostHandler;
  templatesResolve: PostHandler;
  chaosPlan: PostHandler;
  progressionRecommend: GetHandler;
  guardrailsEvaluate: PostHandler;
  optinsUpdate: PostHandler;
};

type LiveUser = {
  userId: string;
  email: string;
  password: string;
  routeCookies: Map<string, string>;
  client: SupabaseClient;
};

type MuscleGroupRow = {
  id: number;
  slug: string | null;
  name: string | null;
};

const normalizeEnvValue = (value: string | undefined) => {
  if (!value) return undefined;
  let trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    trimmed = trimmed.slice(1, -1).trim();
  }
  return trimmed || undefined;
};

const isTruthyFlag = (value: string | undefined) => {
  const normalized = normalizeEnvValue(value);
  if (!normalized) return false;
  return normalized === "1" || normalized.toLowerCase() === "true" || normalized.toLowerCase() === "yes";
};

const parseEnvLine = (line: string) => {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) return null;
  const eq = trimmed.indexOf("=");
  if (eq === -1) return null;
  const key = trimmed.slice(0, eq).trim();
  const value = normalizeEnvValue(trimmed.slice(eq + 1)) ?? "";
  if (!key) return null;
  return { key, value };
};

const applyEnvFileIfPresent = (filePath: string) => {
  if (!fs.existsSync(filePath)) return;
  const contents = fs.readFileSync(filePath, "utf8");
  for (const line of contents.split(/\r?\n/)) {
    const entry = parseEnvLine(line);
    if (!entry) continue;
    const existing = process.env[entry.key];
    if (existing !== undefined && existing !== "" && existing !== "null" && existing !== "undefined") continue;
    process.env[entry.key] = entry.value;
  }
};

const loadRepoRootDotenv = () => {
  const thisDir = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.resolve(thisDir, "..", "..", "..");
  applyEnvFileIfPresent(path.join(repoRoot, ".env.local"));
  applyEnvFileIfPresent(path.join(repoRoot, ".env"));
};

loadRepoRootDotenv();

const shouldRun = isTruthyFlag(explicitRunSupabaseE2EVerification);
const maybeIt = shouldRun ? it : it.skip;
if (!shouldRun) {
  // eslint-disable-next-line no-console
  console.warn("[supabase-e2e-verification] skipped: RUN_SUPABASE_E2E_VERIFICATION is not set to 1/true/yes", {
    RUN_SUPABASE_E2E_VERIFICATION: explicitRunSupabaseE2EVerification ?? null,
  });
}

const resolveEnv = () => {
  const schema = z
    .object({
      serverUrl: z.string().url().optional(),
      clientUrl: z.string().url().optional(),
      serverAnonKey: z.string().min(1).optional(),
      clientAnonKey: z.string().min(1).optional(),
      serviceRoleKey: z.string().min(1).optional(),
      targetServiceRoleKey: z.string().min(1).optional(),
    })
    .refine((value) => value.serverUrl || value.clientUrl, {
      message: "Missing SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL",
    })
    .refine((value) => value.serverAnonKey || value.clientAnonKey, {
      message: "Missing SUPABASE_ANON_KEY / NEXT_PUBLIC_SUPABASE_ANON_KEY",
    })
    .refine((value) => value.serviceRoleKey || value.targetServiceRoleKey, {
      message:
        "Missing SUPABASE_SERVICE_ROLE_KEY / SUPABASE_TARGET_SERVICE_ROLE_KEY. Required for automated RLS verification user setup.",
    });

  const value = schema.parse({
    serverUrl: normalizeEnvValue(process.env.SUPABASE_URL),
    clientUrl: normalizeEnvValue(process.env.NEXT_PUBLIC_SUPABASE_URL),
    serverAnonKey: normalizeEnvValue(process.env.SUPABASE_ANON_KEY),
    clientAnonKey: normalizeEnvValue(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    serviceRoleKey: normalizeEnvValue(process.env.SUPABASE_SERVICE_ROLE_KEY),
    targetServiceRoleKey: normalizeEnvValue(process.env.SUPABASE_TARGET_SERVICE_ROLE_KEY),
  });

  return {
    url: value.serverUrl ?? value.clientUrl ?? "",
    anonKey: value.serverAnonKey ?? value.clientAnonKey ?? "",
    serviceRoleKey: value.targetServiceRoleKey ?? value.serviceRoleKey ?? "",
  };
};

const buildDefaultStats = (): UserStats => ({
  activeProgram: null,
  fatigue: {},
  mastery: {},
  capacities: {},
  progression: {
    totalWorkouts: 0,
    weeklyVolume: 0,
    lastWorkoutAt: null,
  },
  preferences: {
    fatigueLevel: "moderate",
    equipment: [],
    injuries: [],
    acknowledgedRisks: [],
    optIns: { ...DEFAULT_OPT_INS },
  },
});

const setRouteCookies = (cookies: Map<string, string> | null) => {
  mockHeaderState.cookieJar.clear();
  if (!cookies) return;
  for (const [key, value] of cookies.entries()) {
    mockHeaderState.cookieJar.set(key, value);
  }
};

const setRequestIp = (ip: string) => {
  mockHeaderState.requestIp = ip;
};

const parseJsonResponse = async (response: Response) => {
  const text = await response.text();
  if (!text) return null;
  return JSON.parse(text) as unknown;
};

const requestJson = (method: "POST" | "GET", url: string, body?: unknown) =>
  new Request(url, {
    method,
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

const loadRoutes = async (): Promise<LoadedRoutes> => {
  const [
    { POST: sessionsInitialize },
    { POST: sessionsGenerate },
    { POST: sessionsComplete },
    { POST: volumeAllocate },
    { POST: templatesResolve },
    { POST: chaosPlan },
    { GET: progressionRecommend },
    { POST: guardrailsEvaluate },
    { POST: optinsUpdate },
  ] = await Promise.all([
    import("../app/api/v0/sessions/initialize/route"),
    import("../app/api/v0/sessions/generate/route"),
    import("../app/api/v0/sessions/complete/route"),
    import("../app/api/v0/volume/allocate/route"),
    import("../app/api/v0/templates/resolve/route"),
    import("../app/api/v0/chaos/plan/route"),
    import("../app/api/v0/progression/recommend/route"),
    import("../app/api/v0/guardrails/evaluate/route"),
    import("../app/api/v0/optins/update/route"),
  ]);

  return {
    sessionsInitialize,
    sessionsGenerate,
    sessionsComplete,
    volumeAllocate,
    templatesResolve,
    chaosPlan,
    progressionRecommend,
    guardrailsEvaluate,
    optinsUpdate,
  };
};

const signInForRouteCookies = async (
  url: string,
  anonKey: string,
  email: string,
  password: string
) => {
  const cookieJar = new Map<string, string>();
  const routeClient = createServerClient(url, anonKey, {
    cookies: {
      get(name: string) {
        return cookieJar.get(name);
      },
      set(name: string, value: string) {
        cookieJar.set(name, value);
      },
      remove(name: string) {
        cookieJar.delete(name);
      },
    },
  });

  const { data, error } = await routeClient.auth.signInWithPassword({ email, password });
  if (error) {
    throw new Error(`Route-session sign in failed: ${error.message}`);
  }
  if (!data.user) {
    throw new Error("Route-session sign in did not return a user");
  }

  return {
    userId: data.user.id,
    cookieJar,
  };
};

const createSignedInClient = async (url: string, anonKey: string, email: string, password: string) => {
  const client = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) {
    throw new Error(`Client sign in failed: ${error.message}`);
  }
  if (!data.user) {
    throw new Error("Client sign in did not return a user");
  }
  return { client, userId: data.user.id };
};

const createLiveUser = async (
  adminClient: SupabaseClient,
  url: string,
  anonKey: string,
  label: string
): Promise<LiveUser> => {
  const suffix = `${Date.now()}${Math.floor(Math.random() * 10_000)}`;
  const email = `e2e${label}${suffix}@test.com`;
  const password = `E2ePass${suffix}!`;

  const { data, error } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error) {
    throw new Error(`Failed to create ${label} user: ${error.message}`);
  }
  if (!data.user?.id) {
    throw new Error(`Failed to create ${label} user: missing user id`);
  }

  const userId = data.user.id;
  const stats = buildDefaultStats();
  const { error: statsError } = await adminClient
    .from("users")
    .update({ stats_json: stats })
    .eq("id", userId);
  if (statsError) {
    throw new Error(`Failed to initialize stats_json for ${label} user: ${statsError.message}`);
  }

  const routeSession = await signInForRouteCookies(url, anonKey, email, password);
  const signedInClient = await createSignedInClient(url, anonKey, email, password);

  if (routeSession.userId !== userId || signedInClient.userId !== userId) {
    throw new Error(`Auth mismatch while provisioning ${label} user`);
  }

  return {
    userId,
    email,
    password,
    routeCookies: routeSession.cookieJar,
    client: signedInClient.client,
  };
};

const resolveLiveInjurySlug = async (client: SupabaseClient) => {
  const { data, error } = await client
    .from("muscle_groups")
    .select("id, slug, name")
    .order("slug", { ascending: true });

  if (error || !data || data.length === 0) {
    throw new Error(`Failed to load muscle groups for live initialize request: ${error?.message ?? "unknown"}`);
  }

  const rows = data as MuscleGroupRow[];
  const preferredSlugs = [
    "delts",
    "delts_anterior",
    "delts_lateral",
    "delts_posterior",
    "rotator_cuff",
    "upper",
  ];

  for (const slug of preferredSlugs) {
    if (rows.some((row) => row.slug === slug)) {
      return slug;
    }
  }

  const fallback = rows.find((row) => typeof row.slug === "string" && row.slug.length > 0)?.slug;
  if (!fallback) {
    throw new Error("Live muscle_groups table did not contain any usable slugs");
  }

  return fallback;
};

describe("supabase e2e verification", () => {
  maybeIt(
    "executes spec 01 against live Supabase for all v0 endpoints",
    async () => {
      const { url, anonKey, serviceRoleKey } = resolveEnv();
      const routes = await loadRoutes();
      const baseUrl = "http://localhost";
      const adminClient = createClient(url, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
      });

      let primary: LiveUser | null = null;
      let secondary: LiveUser | null = null;
      const createdUserIds: string[] = [];

      try {
        primary = await createLiveUser(adminClient, url, anonKey, "primary");
        secondary = await createLiveUser(adminClient, url, anonKey, "secondary");
        createdUserIds.push(primary.userId, secondary.userId);

        expect(primary.userId).toMatch(/[0-9a-f-]{36}/i);
        expect(secondary.userId).toMatch(/[0-9a-f-]{36}/i);

        const { data: dayData, error: dayError } = await primary.client
          .from("program_days")
          .select("id, program_id, day_index, name")
          .order("id", { ascending: true })
          .limit(1)
          .single();
        if (dayError || !dayData) {
          throw new Error(`Failed to load a program day for activation: ${dayError?.message ?? "unknown"}`);
        }

        const { data: programData, error: programError } = await primary.client
          .from("programs")
          .select("id, default_days_per_week")
          .eq("id", dayData.program_id)
          .single();
        if (programError || !programData) {
          throw new Error(`Failed to load program metadata for activation: ${programError?.message ?? "unknown"}`);
        }

        const injurySlug = await resolveLiveInjurySlug(adminClient);

        const initializeRequest = {
          classPresetId: "classless",
          goalBias: "strength",
          availableDaysPerWeek: programData.default_days_per_week ?? 3,
          fatiguePreference: "moderate" as const,
          injuryMuscleGroupSlugs: [injurySlug],
          macrocycleWeeks: 8,
          selectedPrograms: [{ programId: dayData.program_id, weight: 1 }],
        };

        setRouteCookies(primary.routeCookies);
        setRequestIp(`e2e-initialize-${Date.now()}`);
        const initializeResponse = await routes.sessionsInitialize(
          requestJson("POST", `${baseUrl}/api/v0/sessions/initialize`, initializeRequest)
        );
        const initializePayload = await parseJsonResponse(initializeResponse);
        expect(initializeResponse.status, JSON.stringify(initializePayload)).toBe(200);
        const initializeBody = InitializeCycleResponseSchema.parse(initializePayload);
        expect(initializeBody.status).toBe("success");
        if (initializeBody.status !== "success") {
          throw new Error("Initialize cycle did not return a success payload");
        }
        expect(initializeBody.primaryProgramId).toBe(String(dayData.program_id));

        const { data: profileRow, error: profileRowError } = await primary.client
          .from("engine_cycle_profiles")
          .select("id, user_id, class_choice, class_preset_id, resolved_class_archetype")
          .eq("user_id", primary.userId)
          .single();
        if (profileRowError || !profileRow) {
          throw new Error(`Failed to read normalized cycle profile: ${profileRowError?.message ?? "unknown"}`);
        }

        const { data: planRow, error: planRowError } = await primary.client
          .from("engine_cycle_plans")
          .select("id, profile_id, user_id, current_session_index, primary_program_id, class_preset_id, resolved_class_archetype")
          .eq("user_id", primary.userId)
          .single();
        if (planRowError || !planRow) {
          throw new Error(`Failed to read normalized cycle plan: ${planRowError?.message ?? "unknown"}`);
        }

        const { data: sessionRow, error: sessionRowError } = await primary.client
          .from("engine_cycle_sessions")
          .select("id, plan_id, user_id, session_index, program_day_id, program_day_name, session_seed, slot_payload, projected_fatigue_cost, class_archetype")
          .eq("plan_id", planRow.id)
          .eq("session_index", planRow.current_session_index)
          .single();
        if (sessionRowError || !sessionRow) {
          throw new Error(`Failed to read normalized cycle session: ${sessionRowError?.message ?? "unknown"}`);
        }

        const { data: gamificationRow, error: gamificationRowError } = await primary.client
          .from("engine_gamification_states")
          .select("id, plan_id, user_id, xp, level, adherence_streak, class_archetype")
          .eq("user_id", primary.userId)
          .single();
        if (gamificationRowError || !gamificationRow) {
          throw new Error(`Failed to read normalized gamification state: ${gamificationRowError?.message ?? "unknown"}`);
        }

        const { data: initializedStatsRow, error: initializedStatsError } = await primary.client
          .from("users")
          .select("stats_json")
          .eq("id", primary.userId)
          .single();
        if (initializedStatsError || !initializedStatsRow) {
          throw new Error(`Failed to read stats_json after initialize: ${initializedStatsError?.message ?? "unknown"}`);
        }
        const initializedStatsJson = initializedStatsRow.stats_json as UserStats;
        expect(initializedStatsJson.activeProgram?.programId).toBe(String(dayData.program_id));
        expect(planRow.profile_id).toBe(profileRow.id);
        expect(sessionRow.plan_id).toBe(planRow.id);
        expect(gamificationRow.plan_id).toBe(planRow.id);
        expect(profileRow.class_choice).toBe("hybrid");
        expect(profileRow.class_preset_id).toBe("classless");
        expect(profileRow.resolved_class_archetype).toBeNull();
        expect(planRow.class_preset_id).toBe("classless");
        expect(planRow.resolved_class_archetype).toBe("hybrid");
        expect(sessionRow.class_archetype).toBe("hybrid");
        expect(gamificationRow.class_archetype).toBe("hybrid");

        const statsBeforeCompletion = initializedStatsJson;

        setRouteCookies(primary.routeCookies);
        setRequestIp(`e2e-generate-${Date.now()}`);
        const generateResponse = await routes.sessionsGenerate(
          requestJson("POST", `${baseUrl}/api/v0/sessions/generate`, {
            programDayId: String(sessionRow.program_day_id),
            seed: "spec01-seed-a",
          })
        );
        const generatePayload = await parseJsonResponse(generateResponse);
        expect(generateResponse.status, JSON.stringify(generatePayload)).toBe(200);
        const generateBody = GenerateSessionResponseSchema.parse(generatePayload);
        expect(generateBody.status).toBe("success");
        expect((generateBody.session?.slots.length ?? 0) > 0).toBe(true);
        expect(generateBody.session?.programDayId).toBe(String(sessionRow.program_day_id));
        expect(generateBody.session?.seed).toBe(sessionRow.session_seed);

        const initialSession = generateBody.session;
        if (!initialSession || initialSession.slots.length === 0) {
          throw new Error("Generated session did not include any slots");
        }

        const startedAt = new Date(Date.now() - 45 * 60_000).toISOString();
        const completedAt = new Date().toISOString();
        const completedExercises = initialSession.slots.slice(0, Math.min(3, initialSession.slots.length)).map(
          (slot, index) => ({
            slotId: slot.slotId,
            exerciseId: slot.exerciseId,
            sets: [
              { setIndex: 0, weight: 60 + index * 5, reps: 8, rir: 2 },
              { setIndex: 1, weight: 60 + index * 5, reps: 8, rir: 2 },
            ],
          })
        );

        setRequestIp(`e2e-complete-${Date.now()}`);
        const completeResponse = await routes.sessionsComplete(
          requestJson("POST", `${baseUrl}/api/v0/sessions/complete`, {
            programDayId: String(dayData.id),
            seed: initialSession.seed,
            startedAt,
            completedAt,
            overallRpe: 7,
            exercises: completedExercises,
          })
        );
        const completePayload = await parseJsonResponse(completeResponse);
        expect(completeResponse.status, JSON.stringify(completePayload)).toBe(200);
        const completeBody = CompleteSessionResponseSchema.parse(completePayload);
        expect(completeBody.status).toBe("success");

        const { data: completedStatsRow, error: completedStatsError } = await primary.client
          .from("users")
          .select("stats_json")
          .eq("id", primary.userId)
          .single();
        if (completedStatsError || !completedStatsRow) {
          throw new Error(`Failed to read stats_json after completion: ${completedStatsError?.message ?? "unknown"}`);
        }
        const completedStats = completedStatsRow.stats_json as UserStats;
        expect(completedStats.progression.totalWorkouts).toBe(
          statsBeforeCompletion.progression.totalWorkouts + 1
        );

        const trackedExerciseKey = String(completedExercises[0].exerciseId);
        expect(completedStats.mastery[trackedExerciseKey]?.totalSets).toBeGreaterThan(0);
        expect(completedStats.capacities[trackedExerciseKey]?.estimated1RM).toBeGreaterThan(0);
        expect(Object.keys(completedStats.fatigue).length).toBeGreaterThan(0);

        const { data: refreshedPlanRow, error: refreshedPlanError } = await primary.client
          .from("engine_cycle_plans")
          .select("id, current_session_index")
          .eq("user_id", primary.userId)
          .eq("id", planRow.id)
          .single();
        if (refreshedPlanError || !refreshedPlanRow) {
          throw new Error(`Failed to read normalized plan after completion: ${refreshedPlanError?.message ?? "unknown"}`);
        }
        expect(refreshedPlanRow.current_session_index).toBe(planRow.current_session_index + 1);

        const { data: refreshedGamificationRow, error: refreshedGamificationError } = await primary.client
          .from("engine_gamification_states")
          .select("id, xp, adherence_streak")
          .eq("id", gamificationRow.id)
          .single();
        if (refreshedGamificationError || !refreshedGamificationRow) {
          throw new Error(`Failed to read normalized gamification after completion: ${refreshedGamificationError?.message ?? "unknown"}`);
        }
        expect(refreshedGamificationRow.xp).toBeGreaterThan(gamificationRow.xp);
        expect(refreshedGamificationRow.adherence_streak).toBe(gamificationRow.adherence_streak + 1);

        setRequestIp(`e2e-generate-2-${Date.now()}`);
        const secondGenerateResponse = await routes.sessionsGenerate(
          requestJson("POST", `${baseUrl}/api/v0/sessions/generate`, {
            programDayId: dayData.id,
            seed: "spec01-seed-a",
          })
        );
        const secondGeneratePayload = await parseJsonResponse(secondGenerateResponse);
        expect(secondGenerateResponse.status, JSON.stringify(secondGeneratePayload)).toBe(200);
        const secondGenerateBody = GenerateSessionResponseSchema.parse(secondGeneratePayload);
        expect(secondGenerateBody.status).toBe("success");
        expect((secondGenerateBody.session?.slots.length ?? 0) > 0).toBe(true);

        const secondSession = secondGenerateBody.session;
        if (!secondSession) {
          throw new Error("Second generated session missing");
        }
        expect(Object.keys(secondSession.projectedFatigueCost).length > 0).toBe(true);

        const fatigueMuscle = Object.keys(completedStats.fatigue)[0] ?? "chest";

        setRequestIp(`e2e-volume-${Date.now()}`);
        const volumeResponse = await routes.volumeAllocate(
          requestJson("POST", `${baseUrl}/api/v0/volume/allocate`, {
            totalSets: 14,
            musclePriorities: {
              [fatigueMuscle]: 1,
              back: 0.8,
            },
            trainingAge: "intermediate",
          })
        );
        expect(volumeResponse.status).toBe(200);
        const volumeBody = VolumeAllocateResponseSchema.parse(await parseJsonResponse(volumeResponse));
        expect(volumeBody.status).toBe("success");
        expect(volumeBody.allocation?.allocations[fatigueMuscle]).toBeDefined();

        setRequestIp(`e2e-template-${Date.now()}`);
        const templateResponse = await routes.templatesResolve(
          requestJson("POST", `${baseUrl}/api/v0/templates/resolve`, {
            templateId: dayData.program_id,
            weekNumber: 1,
            dayNumber: dayData.day_index,
          })
        );
        expect(templateResponse.status).toBe(200);
        const templateBody = ResolveTemplateResponseSchema.parse(await parseJsonResponse(templateResponse));
        expect(templateBody.status).toBe("success");
        expect((templateBody.sessionRequirement?.slots.length ?? 0) > 0).toBe(true);

        const { data: templates, error: templatesError } = await primary.client
          .from("programs")
          .select("id")
          .order("id", { ascending: true })
          .limit(2);
        if (templatesError || !templates || templates.length === 0) {
          throw new Error(`Failed to load templates for chaos planning: ${templatesError?.message ?? "unknown"}`);
        }

        const templateIds = templates.map((row) => row.id);
        const chaosDaysPerWeek = Math.min(2, Math.max(1, templateIds.length));

        setRequestIp(`e2e-chaos-${Date.now()}`);
        const chaosResponse = await routes.chaosPlan(
          requestJson("POST", `${baseUrl}/api/v0/chaos/plan`, {
            templateIds,
            weeks: 1,
            daysPerWeek: chaosDaysPerWeek,
            seed: "spec01-chaos-seed",
            mode: "rotate",
          })
        );
        expect(chaosResponse.status).toBe(200);
        const chaosBody = ChaosPlanResponseSchema.parse(await parseJsonResponse(chaosResponse));
        expect(chaosBody.status).toBe("success");
        expect((chaosBody.plan?.sessions.length ?? 0) > 0).toBe(true);

        const progressionUrl = new URL(`${baseUrl}/api/v0/progression/recommend`);
        progressionUrl.searchParams.append("exerciseIds", trackedExerciseKey);
        progressionUrl.searchParams.set("repsMin", "6");
        progressionUrl.searchParams.set("repsMax", "8");

        setRequestIp(`e2e-progression-${Date.now()}`);
        const progressionResponse = await routes.progressionRecommend(
          requestJson("GET", progressionUrl.toString())
        );
        expect(progressionResponse.status).toBe(200);
        const progressionBody = ProgressionRecommendResponseSchema.parse(await parseJsonResponse(progressionResponse));
        expect(progressionBody.status).toBe("success");
        expect((progressionBody.recommendations?.length ?? 0) > 0).toBe(true);

        setRequestIp(`e2e-guardrails-normal-${Date.now()}`);
        const guardrailsNormalResponse = await routes.guardrailsEvaluate(
          requestJson("POST", `${baseUrl}/api/v0/guardrails/evaluate`, {
            action: "session_generate",
            trainingAge: "intermediate",
          })
        );
        expect(guardrailsNormalResponse.status).toBe(200);
        const guardrailsNormalBody = GuardrailResponseSchema.parse(
          await parseJsonResponse(guardrailsNormalResponse)
        );
        expect(guardrailsNormalBody.status).toBe("success");

        setRequestIp(`e2e-guardrails-high-${Date.now()}`);
        const guardrailsHighResponse = await routes.guardrailsEvaluate(
          requestJson("POST", `${baseUrl}/api/v0/guardrails/evaluate`, {
            action: "volume_change",
            weeklyVolume: { [fatigueMuscle]: 40 },
            systemicFatigue: 95,
            trainingAge: "intermediate",
          })
        );
        expect(guardrailsHighResponse.status).toBe(200);
        const guardrailsHighBody = GuardrailResponseSchema.parse(await parseJsonResponse(guardrailsHighResponse));
        expect(guardrailsHighBody.status).toBe("success");
        expect(
          (guardrailsHighBody.evaluation?.warnings.length ?? 0) +
            (guardrailsHighBody.evaluation?.blockers.length ?? 0)
        ).toBeGreaterThan(0);

        setRequestIp(`e2e-optins-${Date.now()}`);
        const optinsResponse = await routes.optinsUpdate(
          requestJson("POST", `${baseUrl}/api/v0/optins/update`, {
            optIns: { ...DEFAULT_OPT_INS, allowExtremeVolume: true },
            acknowledgedRisks: ["spec01-e2e-risk"],
          })
        );
        expect(optinsResponse.status).toBe(200);
        const optinsBody = OptInUpdateResponseSchema.parse(await parseJsonResponse(optinsResponse));
        expect(optinsBody.status).toBe("success");
        expect(optinsBody.optIns?.allowExtremeVolume).toBe(true);

        const { data: optinsStatsRow, error: optinsStatsError } = await primary.client
          .from("users")
          .select("stats_json")
          .eq("id", primary.userId)
          .single();
        if (optinsStatsError || !optinsStatsRow) {
          throw new Error(`Failed to verify opt-in persistence: ${optinsStatsError?.message ?? "unknown"}`);
        }
        const optinsStats = optinsStatsRow.stats_json as UserStats;
        expect(optinsStats.preferences.optIns.allowExtremeVolume).toBe(true);
        expect(optinsStats.preferences.acknowledgedRisks).toContain("spec01-e2e-risk");

        const secondaryRead = await secondary.client
          .from("users")
          .select("id")
          .eq("id", primary.userId);
        expect(secondaryRead.error).toBeNull();
        expect(secondaryRead.data ?? []).toHaveLength(0);

        const secondaryTamperAttempt = await secondary.client
          .from("users")
          .update({ stats_json: buildDefaultStats() })
          .eq("id", primary.userId)
          .select("id");
        const blockedByRls =
          Boolean(secondaryTamperAttempt.error) ||
          (secondaryTamperAttempt.data?.length ?? 0) === 0;
        expect(blockedByRls).toBe(true);

        const { data: postRlsPrimaryRow, error: postRlsPrimaryError } = await primary.client
          .from("users")
          .select("stats_json")
          .eq("id", primary.userId)
          .single();
        if (postRlsPrimaryError || !postRlsPrimaryRow) {
          throw new Error(
            `Failed to verify primary user after RLS checks: ${postRlsPrimaryError?.message ?? "unknown"}`
          );
        }
        const postRlsPrimaryStats = postRlsPrimaryRow.stats_json as UserStats;
        expect(postRlsPrimaryStats.preferences.optIns.allowExtremeVolume).toBe(true);

        setRouteCookies(null);
        setRequestIp(`e2e-unauth-${Date.now()}`);
        const unauthorizedResponse = await routes.sessionsGenerate(
          requestJson("POST", `${baseUrl}/api/v0/sessions/generate`, {
            programDayId: dayData.id,
            seed: "spec01-unauth",
          })
        );
        expect(unauthorizedResponse.status).toBe(401);

        setRouteCookies(primary.routeCookies);
        setRequestIp(`e2e-invalid-${Date.now()}`);
        const invalidResponse = await routes.sessionsGenerate(
          requestJson("POST", `${baseUrl}/api/v0/sessions/generate`, {
            seed: "spec01-invalid",
          })
        );
        expect(invalidResponse.status).toBe(400);

        setRouteCookies(null);
        const rateLimitIp = `e2e-rate-limit-${Date.now()}`;
        let lastStatus = 0;
        for (let i = 0; i < 21; i += 1) {
          setRequestIp(rateLimitIp);
          const response = await routes.guardrailsEvaluate(
            requestJson("POST", `${baseUrl}/api/v0/guardrails/evaluate`, {})
          );
          lastStatus = response.status;
        }
        expect(lastStatus).toBe(429);
      } finally {
        setRouteCookies(null);
        if (primary) {
          await primary.client.auth.signOut();
        }
        if (secondary) {
          await secondary.client.auth.signOut();
        }
        for (const userId of createdUserIds) {
          await adminClient.from("users").delete().eq("id", userId);
          await adminClient.auth.admin.deleteUser(userId);
        }
      }
    },
    180_000
  );
});
