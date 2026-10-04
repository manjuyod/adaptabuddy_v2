import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";

const importerSource = new URL("./import-remote-data.mjs", import.meta.url);
const preCatalogMigration = "20261003091000_legacy_rpc_permissions.sql";
const localDbUrl =
  "postgresql://postgres:p&ss%25^word@127.0.0.1:54322/postgres";
const legacyDump = `
INSERT INTO "public"."exercises" ("id", "slug", "name", "movement_pattern", "equipment", "is_bodyweight", "aliases", "tags", "media", "contraindications", "is_active", "created_at") VALUES
  (1, 'push_up', 'Push-Up', 'horizontal_press', '[]', true, '[]', '[]', '{}', '[]', true, now());
`;

function createFixture({
  dump = legacyDump,
  includeMigration = true,
  includeSupabaseCli = true,
} = {}) {
  const fixture = mkdtempSync(join(tmpdir(), "adaptabuddy-import-order-"));
  const scripts = join(fixture, "scripts", "supabase");
  const supabase = join(fixture, "supabase");
  const migrations = join(supabase, "migrations");
  mkdirSync(scripts, { recursive: true });
  mkdirSync(migrations, { recursive: true });
  const script = join(scripts, "import-remote-data.mjs");
  const supabaseCli = join(
    fixture,
    "node_modules",
    "supabase",
    "dist",
    "supabase.js",
  );
  const callsFile = join(fixture, "calls.jsonl");
  const hook = join(fixture, "mock-processes.mjs");
  writeFileSync(script, readFileSync(importerSource));
  writeFileSync(join(supabase, "seed.remote.sql"), dump);
  if (includeMigration) {
    writeFileSync(join(migrations, preCatalogMigration), "-- fixture migration\n");
  }
  if (includeSupabaseCli) {
    mkdirSync(dirname(supabaseCli), { recursive: true });
    writeFileSync(supabaseCli, "// fixture Supabase CLI\n");
  }
  writeFileSync(
    hook,
    `
import childProcess from "node:child_process";
import { appendFileSync } from "node:fs";
import { syncBuiltinESMExports } from "node:module";
childProcess.spawnSync = (command, args = []) => {
  appendFileSync(process.env.MOCK_PROCESS_CALLS, JSON.stringify({ command, args }) + "\\n");
  const invocation = [command, ...args].join(" ");
  const status = process.env.MOCK_PROCESS_FAILURE && invocation.includes(process.env.MOCK_PROCESS_FAILURE) ? 23 : 0;
  return { pid: 1, output: [], stdout: null, stderr: null, status, signal: null, error: undefined };
};
syncBuiltinESMExports();
`,
  );
  return { fixture, script, callsFile, hook, supabaseCli };
}

function runFixture(fixture, extraEnv = {}) {
  return spawnSync(process.execPath, [fixture.script], {
    env: {
      ...process.env,
      LOCAL_SUPABASE_DB_URL: localDbUrl,
      MOCK_PROCESS_CALLS: fixture.callsFile,
      NODE_OPTIONS: `--import=${pathToFileURL(fixture.hook).href}`,
      ...extraEnv,
    },
    encoding: "utf8",
  });
}

function readCalls(fixture) {
  return readFileSync(fixture.callsFile, "utf8")
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function invocation(call) {
  return [call.command, ...call.args].join(" ");
}

function removeFixture(fixture) {
  assert.equal(dirname(resolve(fixture.fixture)), resolve(tmpdir()));
  assert.ok(basename(fixture.fixture).startsWith("adaptabuddy-import-order-"));
  rmSync(fixture.fixture, { recursive: true, force: true });
}

test("import rejects nonlocal targets before reading a dump or invoking database tools", () => {
  const fixture = mkdtempSync(join(tmpdir(), "adaptabuddy-import-guard-"));
  const scripts = join(fixture, "scripts", "supabase");
  mkdirSync(scripts, { recursive: true });
  const script = join(scripts, "import-remote-data.mjs");
  writeFileSync(script, readFileSync(importerSource));
  try {
    for (const url of [
      "postgresql://postgres:secret@db.example.com/postgres",
      "postgresql://postgres:secret@127.0.0.1/postgres?host=db.example.com",
      "postgresql://postgres:secret@127.0.0.1/postgres?hostaddr=203.0.113.2",
      "https://127.0.0.1/postgres",
      "not a url",
    ]) {
      const result = spawnSync(process.execPath, [script], {
        env: { ...process.env, LOCAL_SUPABASE_DB_URL: url }, encoding: "utf8",
      });
      assert.equal(result.status, 1);
      assert.match(result.stderr, /LOCAL_SUPABASE_DB_URL must be a loopback PostgreSQL URL without query parameters/);
      assert.doesNotMatch(result.stderr, /secret/);
    }
    for (const host of ["127.0.0.1", "localhost", "[::1]"]) {
      const result = spawnSync(process.execPath, [script], {
        env: { ...process.env, LOCAL_SUPABASE_DB_URL: `postgresql://postgres:secret@${host}:54322/postgres` }, encoding: "utf8",
      });
      assert.equal(result.status, 1);
      assert.match(result.stderr, /Missing installed Supabase CLI/);
    }
  } finally {
    assert.equal(dirname(resolve(fixture)), resolve(tmpdir()));
    assert.ok(basename(fixture).startsWith("adaptabuddy-import-guard-"));
    rmSync(fixture, { recursive: true, force: true });
  }
});

test("legacy dump is replayed on the pre-catalog schema before migrations advance", () => {
  const fixture = createFixture();
  try {
    const result = runFixture(fixture);
    assert.equal(result.status, 0, result.stderr);
    const calls = readCalls(fixture);
    assert.equal(calls.length, 5);
    assert.equal(calls[0].command, process.execPath);
    assert.equal(calls[0].args[0], fixture.supabaseCli);
    assert.deepEqual(calls[0].args.slice(1), [
      "db",
      "reset",
      "--db-url",
      localDbUrl,
      "--version",
      "20261003091000",
      "--no-seed",
    ]);
    assert.match(invocation(calls[1]), /psql .* -c/);
    assert.match(invocation(calls[2]), /psql .* -f .*seed\.remote\.local\.sql/);
    assert.equal(calls[3].command, process.execPath);
    assert.deepEqual(calls[3].args, [
      fixture.supabaseCli,
      "migration",
      "up",
      "--db-url",
      localDbUrl,
    ]);
    assert.match(invocation(calls[4]), /psql .* -c/);
    assert.equal(calls.some((call) => /cmd(?:\.exe)?$/i.test(call.command)), false);
  } finally {
    removeFixture(fixture);
  }
});

test("a failed dump replay stops migration and verification commands", () => {
  const fixture = createFixture();
  try {
    const result = runFixture(fixture, { MOCK_PROCESS_FAILURE: "seed.remote.local.sql" });
    assert.equal(result.status, 23);
    const calls = readCalls(fixture);
    assert.equal(calls.length, 3);
    assert.equal(calls[0].command, process.execPath);
    assert.deepEqual(calls[0].args.slice(1, 3), ["db", "reset"]);
    assert.match(invocation(calls[1]), /psql .* -c/);
    assert.match(invocation(calls[2]), /psql .* -f .*seed\.remote\.local\.sql/);
    assert.equal(
      calls.some((call) => call.args[1] === "migration" && call.args[2] === "up"),
      false,
    );
  } finally {
    removeFixture(fixture);
  }
});

test("catalog-format dumps are rejected before any database command", () => {
  const fixture = createFixture({
    dump: `INSERT INTO "public"."exercises" ("id", "slug", "category", "tracking_mode") VALUES (1, 'push_up', 'strength', 'reps');\n`,
  });
  try {
    const result = runFixture(fixture);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /catalog-format exercise columns/);
    assert.equal(readFileSync(fixture.callsFile, { encoding: "utf8", flag: "a+" }), "");
  } finally {
    removeFixture(fixture);
  }
});

test("a missing pre-catalog migration fails before any database command", () => {
  const fixture = createFixture({ includeMigration: false });
  try {
    const result = runFixture(fixture);
    assert.equal(result.status, 1);
    assert.match(result.stderr, new RegExp(preCatalogMigration));
    assert.equal(readFileSync(fixture.callsFile, { encoding: "utf8", flag: "a+" }), "");
  } finally {
    removeFixture(fixture);
  }
});

test("a missing installed Supabase CLI fails before reset", () => {
  const fixture = createFixture({ includeSupabaseCli: false });
  try {
    const result = runFixture(fixture);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Missing installed Supabase CLI/);
    assert.equal(readFileSync(fixture.callsFile, { encoding: "utf8", flag: "a+" }), "");
  } finally {
    removeFixture(fixture);
  }
});
