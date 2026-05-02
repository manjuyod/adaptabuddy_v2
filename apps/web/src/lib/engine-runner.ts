import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

const resolveEngineManifestPath = () => {
  const repoRootCandidate = path.resolve(process.cwd(), "packages", "engine-rs", "Cargo.toml");
  if (existsSync(repoRootCandidate)) {
    return repoRootCandidate;
  }

  return path.resolve(process.cwd(), "..", "..", "packages", "engine-rs", "Cargo.toml");
};

export async function runEngineInput(input: unknown) {
  const manifestPath = resolveEngineManifestPath();
  const payload = JSON.stringify(input);

  const stdout = await new Promise<string>((resolve, reject) => {
    const child = spawn(
      "cargo",
      ["run", "--quiet", "--manifest-path", manifestPath, "--bin", "engine_runner"],
      {
        stdio: ["pipe", "pipe", "pipe"],
      }
    );

    let stdoutBuffer = "";
    let stderrBuffer = "";

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdoutBuffer += chunk;
    });
    child.stderr.on("data", (chunk: string) => {
      stderrBuffer += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(stderrBuffer.trim() || `engine runner exited with code ${code}`));
        return;
      }

      resolve(stdoutBuffer);
    });

    child.stdin.write(payload);
    child.stdin.end();
  });

  return JSON.parse(stdout);
}
