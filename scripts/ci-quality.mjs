import { spawn } from "node:child_process";

const commands = [
  ["npm", ["run", "typecheck"]],
  ["npm", ["run", "lint"]],
  ["npm", ["run", "test"]],
  ["npm", ["run", "build"]],
  ["npm", ["run", "test:engine"]],
];

const env = {
  ...process.env,
  RUN_SUPABASE_E2E_VERIFICATION: "0",
  RUN_SUPABASE_SMOKE: "0",
  RUN_SUPABASE_AUTH_SMOKE: "0",
  RUN_PLAYWRIGHT_E2E: "0",
};

const run = ([command, args]) =>
  new Promise((resolve) => {
    const child =
      process.platform === "win32"
        ? spawn(
            process.env.ComSpec ?? "cmd.exe",
            ["/d", "/s", "/c", [command, ...args].join(" ")],
            {
              env,
              stdio: "inherit",
            }
          )
        : spawn(command, args, {
            env,
            stdio: "inherit",
          });

    child.on("close", (code) => resolve(code ?? 1));
    child.on("error", () => resolve(1));
  });

for (const command of commands) {
  const code = await run(command);
  if (code !== 0) {
    process.exit(code);
  }
}
