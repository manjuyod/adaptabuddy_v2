import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_OPT_INS, type UserStats } from "@adaptabuddy/contracts";
import type { PlaywrightE2EEnv } from "./env";

type UserLookup = {
  id: string;
  email?: string | null;
};

type WorkoutLogLookup = {
  id: number;
  metadata: unknown;
  completed_at: string;
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
    unitSystem: "kg",
    theme: "dark",
  },
});

export const createAdminSupabaseClient = (env: PlaywrightE2EEnv) =>
  createClient(env.supabaseUrl, env.serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });

export const createAnonSupabaseClient = (env: PlaywrightE2EEnv) =>
  createClient(env.supabaseUrl, env.anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });

const signInForUserId = async (
  anonClient: SupabaseClient,
  email: string,
  password: string,
) => {
  const { data, error } = await anonClient.auth.signInWithPassword({ email, password });
  if (error || !data.user?.id) return null;
  await anonClient.auth.signOut();
  return data.user.id;
};

const findUserByEmail = async (adminClient: SupabaseClient, email: string) => {
  let page = 1;
  const perPage = 200;

  while (page <= 10) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage });
    if (error) {
      throw new Error(`Failed to list auth users: ${error.message}`);
    }

    const users = (data.users ?? []) as UserLookup[];
    const match = users.find((user) => user.email?.toLowerCase() === email.toLowerCase());
    if (match) return match;

    if (users.length < perPage) break;
    page += 1;
  }

  return null;
};

const ensurePublicUserRow = async (adminClient: SupabaseClient, userId: string) => {
  const { data, error } = await adminClient
    .from("users")
    .select("id")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to verify user profile row: ${error.message}`);
  }

  if (data?.id) return;

  const { error: insertError } = await adminClient.from("users").insert({ id: userId });
  if (insertError) {
    throw new Error(`Failed to create user profile row: ${insertError.message}`);
  }
};

export const ensureConfirmedTestUser = async (
  adminClient: SupabaseClient,
  anonClient: SupabaseClient,
  email: string,
  password: string,
) => {
  const existingSignInUserId = await signInForUserId(anonClient, email, password);
  if (existingSignInUserId) {
    await ensurePublicUserRow(adminClient, existingSignInUserId);
    return existingSignInUserId;
  }

  const existingAuthUser = await findUserByEmail(adminClient, email);
  if (!existingAuthUser) {
    const { data, error } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (error || !data.user?.id) {
      throw new Error(`Failed to create test auth user: ${error?.message ?? "unknown error"}`);
    }
  } else {
    const { error } = await adminClient.auth.admin.updateUserById(existingAuthUser.id, {
      password,
      email_confirm: true,
    });

    if (error) {
      throw new Error(`Failed to update test auth user: ${error.message}`);
    }
  }

  const verifiedUserId = await signInForUserId(anonClient, email, password);
  if (!verifiedUserId) {
    throw new Error("Failed to authenticate with SUPABASE_TEST_EMAIL and SUPABASE_TEST_PASSWORD");
  }

  await ensurePublicUserRow(adminClient, verifiedUserId);
  return verifiedUserId;
};

export const clearWorkoutHistoryForUser = async (
  adminClient: SupabaseClient,
  userId: string,
) => {
  const { data: workoutRows, error: workoutSelectError } = await adminClient
    .from("workout_logs")
    .select("id")
    .eq("user_id", userId);

  if (workoutSelectError) {
    throw new Error(`Failed to query workout logs: ${workoutSelectError.message}`);
  }

  const workoutIds = (workoutRows ?? [])
    .map((row) => Number((row as { id?: unknown }).id))
    .filter((id) => Number.isInteger(id) && id > 0);

  if (workoutIds.length > 0) {
    const { error: setDeleteError } = await adminClient
      .from("set_logs")
      .delete()
      .in("workout_log_id", workoutIds);

    if (setDeleteError) {
      throw new Error(`Failed to clear set logs: ${setDeleteError.message}`);
    }
  }

  const { error: workoutDeleteError } = await adminClient
    .from("workout_logs")
    .delete()
    .eq("user_id", userId);

  if (workoutDeleteError) {
    throw new Error(`Failed to clear workout logs: ${workoutDeleteError.message}`);
  }
};

export const clearNormalizedCycleStateForUser = async (
  adminClient: SupabaseClient,
  userId: string,
) => {
  const deleteFrom = async (table: string) => {
    const { error } = await adminClient.from(table).delete().eq("user_id", userId);
    if (error) {
      throw new Error(`Failed to clear ${table}: ${error.message}`);
    }
  };

  await deleteFrom("engine_session_traces");
  await deleteFrom("engine_progression_states");
  await deleteFrom("engine_gamification_states");
  await deleteFrom("engine_cycle_sessions");
  await deleteFrom("engine_cycle_plans");
  await deleteFrom("engine_cycle_profiles");
};

export const resetTestUserState = async (
  adminClient: SupabaseClient,
  userId: string,
) => {
  await clearWorkoutHistoryForUser(adminClient, userId);
  await clearNormalizedCycleStateForUser(adminClient, userId);

  const { error } = await adminClient
    .from("users")
    .update({
      has_save: false,
      preferred_start_screen: "auto",
      last_start_choice: null,
      stats_json: buildDefaultStats(),
    })
    .eq("id", userId);

  if (error) {
    throw new Error(`Failed to reset test user state: ${error.message}`);
  }
};

export const readTestUserStats = async (
  adminClient: SupabaseClient,
  userId: string,
) => {
  const { data, error } = await adminClient
    .from("users")
    .select("stats_json")
    .eq("id", userId)
    .single();

  if (error) {
    throw new Error(`Failed to read test user stats_json: ${error.message}`);
  }

  return (data?.stats_json as UserStats | null) ?? buildDefaultStats();
};

export const updateTestUserStats = async (
  adminClient: SupabaseClient,
  userId: string,
  updater: (stats: UserStats) => UserStats,
) => {
  const currentStats = await readTestUserStats(adminClient, userId);
  const nextStats = updater(currentStats);

  const { error } = await adminClient
    .from("users")
    .update({ stats_json: nextStats })
    .eq("id", userId);

  if (error) {
    throw new Error(`Failed to update test user stats_json: ${error.message}`);
  }

  return nextStats;
};

export const seedActiveProgramForUser = async (
  adminClient: SupabaseClient,
  userId: string,
) => {
  const { data: dayRow, error: dayError } = await adminClient
    .from("program_days")
    .select("id, program_id, day_index")
    .order("id", { ascending: true })
    .limit(1)
    .single();

  if (dayError || !dayRow) {
    throw new Error(`Failed to resolve program day for test user: ${dayError?.message ?? "unknown"}`);
  }

  const { data: programRow, error: programError } = await adminClient
    .from("programs")
    .select("id, default_days_per_week")
    .eq("id", dayRow.program_id)
    .single();

  if (programError || !programRow) {
    throw new Error(
      `Failed to resolve program metadata for test user: ${programError?.message ?? "unknown"}`
    );
  }

  const { data: userRow, error: userError } = await adminClient
    .from("users")
    .select("stats_json")
    .eq("id", userId)
    .single();

  if (userError) {
    throw new Error(`Failed to read user stats before activation: ${userError.message}`);
  }

  const existingStats = (userRow?.stats_json as UserStats | null) ?? buildDefaultStats();
  const nextStats: UserStats = {
    ...existingStats,
    activeProgram: {
      programId: String(programRow.id),
      startedAt: new Date().toISOString(),
      currentDayIndex: dayRow.day_index,
      currentMicrocycle: 1,
      daysPerWeek: programRow.default_days_per_week,
    },
  };

  const { error: updateError } = await adminClient
    .from("users")
    .update({ has_save: true, stats_json: nextStats })
    .eq("id", userId);

  if (updateError) {
    throw new Error(`Failed to seed active program for test user: ${updateError.message}`);
  }
};

export const findWorkoutLogByNote = async (
  adminClient: SupabaseClient,
  userId: string,
  noteToken: string,
) => {
  const { data, error } = await adminClient
    .from("workout_logs")
    .select("id, metadata, completed_at")
    .eq("user_id", userId)
    .order("completed_at", { ascending: false })
    .limit(20);

  if (error) {
    throw new Error(`Failed to query workout logs for note token: ${error.message}`);
  }

  const rows = (data ?? []) as WorkoutLogLookup[];
  return (
    rows.find((row) => {
      if (!row.metadata || typeof row.metadata !== "object") return false;
      return (row.metadata as Record<string, unknown>).notes === noteToken;
    }) ?? null
  );
};
