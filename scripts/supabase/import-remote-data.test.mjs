import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import test from "node:test";

test("import rejects nonlocal targets before reading a dump or invoking database tools", () => {
  const fixture = mkdtempSync(join(tmpdir(), "adaptabuddy-import-guard-"));
  const scripts = join(fixture, "scripts", "supabase");
  mkdirSync(scripts, { recursive: true });
  const script = join(scripts, "import-remote-data.mjs");
  writeFileSync(script, readFileSync(new URL("./import-remote-data.mjs", import.meta.url)));
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
      assert.match(result.stderr, /Missing supabase\/seed.remote.sql/);
    }
  } finally {
    assert.equal(dirname(resolve(fixture)), resolve(tmpdir()));
    assert.ok(basename(fixture).startsWith("adaptabuddy-import-guard-"));
    rmSync(fixture, { recursive: true, force: true });
  }
});
