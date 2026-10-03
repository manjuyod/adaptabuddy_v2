import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "..", "..");
const remoteDump = resolve(repoRoot, "supabase", "seed.remote.sql");
const localReplayDump = resolve(repoRoot, "supabase", "seed.remote.local.sql");
const localDbUrl =
  process.env.LOCAL_SUPABASE_DB_URL ??
  "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

// psql accepts connection overrides such as ?host=remote even when the URL's
// hostname is local. Reject them before the reset/truncate/import can run.
let localTarget;
try {
  localTarget = new URL(localDbUrl);
} catch {
  localTarget = undefined;
}
if (
  !localTarget ||
  !["postgres:", "postgresql:"].includes(localTarget.protocol) ||
  !["127.0.0.1", "localhost", "[::1]"].includes(localTarget.hostname.toLowerCase()) ||
  localTarget.search ||
  localTarget.hash
) {
  console.error(
    "LOCAL_SUPABASE_DB_URL must be a loopback PostgreSQL URL without query parameters.",
  );
  process.exit(1);
}

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    stdio: "inherit",
    shell: false,
  });

  if (result.error) {
    console.error(`Failed to run ${command}: ${result.error.message}`);
    process.exit(1);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function runNpx(args) {
  if (process.platform === "win32") {
    run("cmd.exe", ["/d", "/s", "/c", "npx", ...args]);
    return;
  }

  run("npx", args);
}

if (!existsSync(remoteDump)) {
  console.error(
    "Missing supabase/seed.remote.sql. Run `npm run supabase:pull:data` first.",
  );
  process.exit(1);
}

const replaySql = readFileSync(remoteDump, "utf8")
  .split(/\r?\n/)
  .filter((line) => !line.includes('"auth"."refresh_tokens_id_seq"'))
  .join("\n");

writeFileSync(localReplayDump, replaySql, "utf8");

runNpx(["supabase", "db", "reset", "--local"]);

const truncateSql = `
truncate table
  auth.identities,
  auth.mfa_amr_claims,
  auth.refresh_tokens,
  auth.sessions,
  auth.users,
  public.beta_feedback_reports,
  public.classes,
  public.exercise_muscle_map,
  public.exercises,
  public.muscle_groups,
  public.program_days,
  public.program_slots,
  public.programs,
  public.rate_limit_counters,
  public.users
cascade;
`;

run("psql", ["-v", "ON_ERROR_STOP=1", "-c", truncateSql, localDbUrl]);
run("psql", ["-v", "ON_ERROR_STOP=1", "-f", localReplayDump, localDbUrl]);

const countSql = `
select table_name, row_count
from (
  values
    ('auth.users', (select count(*)::bigint from auth.users)),
    ('auth.sessions', (select count(*)::bigint from auth.sessions)),
    ('auth.refresh_tokens', (select count(*)::bigint from auth.refresh_tokens)),
    ('public.users', (select count(*)::bigint from public.users)),
    ('public.programs', (select count(*)::bigint from public.programs)),
    ('public.program_days', (select count(*)::bigint from public.program_days)),
    ('public.program_slots', (select count(*)::bigint from public.program_slots)),
    ('public.exercises', (select count(*)::bigint from public.exercises)),
    ('public.muscle_groups', (select count(*)::bigint from public.muscle_groups)),
    ('public.exercise_muscle_map', (select count(*)::bigint from public.exercise_muscle_map)),
    ('public.beta_feedback_reports', (select count(*)::bigint from public.beta_feedback_reports)),
    ('public.health_events', (select count(*)::bigint from public.health_events))
) as counts(table_name, row_count)
order by table_name;
`;

run("psql", ["-v", "ON_ERROR_STOP=1", "-c", countSql, localDbUrl]);
