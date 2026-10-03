import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";

// Credentials stay in the process environment; never print tokens or Auth bodies.
const base = new URL(process.env.LOCAL_SUPABASE_URL ?? "http://127.0.0.1:54321");
const database = new URL(process.env.LOCAL_SUPABASE_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres");
const loopback = ["127.0.0.1", "localhost", "[::1]"];
assert.ok(loopback.includes(base.hostname) && ["http:", "https:"].includes(base.protocol), "Auth tests require a loopback Supabase URL");
assert.ok(loopback.includes(database.hostname) && ["postgres:", "postgresql:"].includes(database.protocol) && !database.search && !database.hash, "Auth tests require a loopback PostgreSQL URL without connection overrides");
const anon = process.env.LOCAL_SUPABASE_ANON_KEY;
const admin = process.env.LOCAL_SUPABASE_SERVICE_ROLE_KEY;
assert.ok(anon && admin && process.env.LOCAL_SUPABASE_JWT_SECRET, "Set local Supabase test credentials as documented");

async function request(path, token, method = "GET", body) {
  const response = await fetch(new URL(path, base), {
    method,
    headers: { apikey: token === admin ? admin : anon, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    redirect: "error",
    signal: AbortSignal.timeout(10000),
  });
  const content = await response.text();
  return { status: response.status, data: content ? JSON.parse(content) : null };
}

const users = [];
async function createUser() {
  const email = `audit-${randomUUID()}@example.test`;
  const password = `${randomUUID()}Aa1!`;
  const created = await request("/auth/v1/admin/users", admin, "POST", { email, password, email_confirm: true });
  assert.equal(created.status, 200, "local Auth user creation failed");
  users.push(created.data.id);
  const signedIn = await request("/auth/v1/token?grant_type=password", anon, "POST", { email, password });
  assert.equal(signedIn.status, 200, "local password authentication failed");
  return signedIn.data;
}

let verificationError;
try {
  const owner = await createUser();
  const other = await createUser();
  const refreshed = await request("/auth/v1/token?grant_type=refresh_token", anon, "POST", { refresh_token: owner.refresh_token });
  assert.equal(refreshed.status, 200, "local session refresh failed");
  assert.equal(refreshed.data.user.id, owner.user.id, "refresh changed identity");
  const token = refreshed.data.access_token;
  const food = await request("/rest/v1/nutrition_food_logs", token, "POST", {
    user_id: owner.user.id, food_name: "Local integration fixture", calories: 123, protein_grams: null,
  });
  assert.equal(food.status, 201, "nullable macro insert failed");
  const path = `/rest/v1/nutrition_food_logs?user_id=eq.${owner.user.id}&select=id,calories`;
  const ownRows = await request(path, token);
  assert.equal(ownRows.status, 200);
  assert.equal(ownRows.data.length, 1, "owner food read failed");
  const foreignRows = await request(path, other.access_token);
  assert.equal(foreignRows.status, 200);
  assert.equal(foreignRows.data.length, 0, "RLS leaked another user's food");
  const forge = await request("/rest/v1/xp_events", token, "POST", { user_id: owner.user.id, amount: 999, reason: "forged" });
  assert.equal(forge.status, 403, "client could mint XP");
  const rateLimit = await request("/rest/v1/rpc/consume_rate_limit", token, "POST", { p_key: `audit-${randomUUID()}`, p_limit: 1, p_window_ms: 1000 });
  assert.equal(rateLimit.status, 403, "client could mutate server rate limits");
  const completion = await request("/rest/v1/rpc/complete_session_atomic", anon, "POST", {
    p_user_id: owner.user.id, p_program_id: null, p_program_day_id: null,
    p_completed_at: new Date().toISOString(), p_duration_seconds: 1, p_total_volume: 0,
    p_seed: null, p_metadata: {}, p_set_logs: [], p_stats_json: { forged: true },
  });
  assert.equal(completion.status, 401, "anonymous completion RPC was not rejected");
  const verified = spawnSync("cargo", ["test", "--manifest-path", "backend/Cargo.toml", "-p", "api-server", "--test", "supabase_auth", "--", "--include-ignored"], {
    cwd: fileURLToPath(new URL("../../", import.meta.url)),
    env: { ...process.env, LOCAL_SUPABASE_URL: base.href, LOCAL_SUPABASE_DB_URL: database.href, LOCAL_SUPABASE_TEST_TOKEN: token, LOCAL_SUPABASE_TEST_USER_ID: owner.user.id },
    stdio: "inherit",
    timeout: 180000,
  });
  assert.equal(verified.status, 0, "Rust rejected the actual Supabase session");
  if (process.env.LOCAL_RUST_API_URL) {
    const rustApi = new URL(process.env.LOCAL_RUST_API_URL);
    assert.ok(loopback.includes(rustApi.hostname) && ["http:", "https:"].includes(rustApi.protocol), "Rust HTTP verification requires a loopback URL");
    const response = await fetch(new URL("/api/v0/me/dashboard", rustApi), {
      headers: { Authorization: `Bearer ${token}` },
      redirect: "error",
      signal: AbortSignal.timeout(10000),
    });
    assert.equal(response.status, 200, "Rust HTTP dashboard rejected the actual Supabase token");
    const dashboard = await response.json();
    assert.equal(dashboard.user.id, owner.user.id);
    assert.equal(dashboard.today.calories_consumed, 123, "Rust HTTP server is not using the expected persistent database");
    console.log("Rust HTTP dashboard authentication and persistent storage passed.");
  }
  console.log("Local Supabase Auth/password/refresh, PostgREST RLS/privileges, and Rust dashboard integration passed.");
} catch (error) {
  verificationError = error;
  throw error;
} finally {
  let cleanupFailures = 0;
  for (const id of users) {
    try {
      const deleted = await request(`/auth/v1/admin/users/${id}`, admin, "DELETE");
      if (deleted.status !== 200) cleanupFailures += 1;
    } catch {
      cleanupFailures += 1;
    }
  }
  if (cleanupFailures) {
    const message = `Could not remove ${cleanupFailures} audit fixture user(s); check local Auth availability.`;
    if (verificationError) console.error(message);
    else throw new Error(message);
  } else {
    console.log(`Removed ${users.length} temporary Auth users and their data.`);
  }
}
