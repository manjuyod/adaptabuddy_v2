import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { execFile } from "node:child_process";
import { once } from "node:events";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const scriptPath = fileURLToPath(new URL("../scripts/verify-deploy-smoke.mjs", import.meta.url));

type HealthResponseOptions = {
  cacheControl?: string;
  includeRequestId?: boolean;
  extraHealthFields?: Record<string, unknown>;
  betaRouteStatuses?: {
    generate?: number;
    complete?: number;
    reporting?: number;
  };
};

const createSmokeServer = (options: HealthResponseOptions = {}) => {
  const server = createServer((request: IncomingMessage, response: ServerResponse) => {
    if (request.url === "/offline") {
      response.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
      response.end("offline");
      return;
    }

    if (request.url === "/api/health") {
      const headers: Record<string, string> = {
        "content-type": "application/json; charset=utf-8",
        "cache-control": options.cacheControl ?? "no-store",
      };

      if (options.includeRequestId ?? true) {
        headers["x-request-id"] = "deploy-smoke-health-1";
      }

      response.writeHead(200, headers);
      response.end(
        JSON.stringify({
          status: "ok",
          timestamp: "2026-04-22T12:00:00.000Z",
          supabase: "connected",
          ...options.extraHealthFields,
        })
      );
      return;
    }

    if (request.url === "/api/v0/sessions/generate") {
      if (request.method !== "POST") {
        response.writeHead(options.betaRouteStatuses?.generate ?? 405, {
          "content-type": "text/plain; charset=utf-8",
        });
        response.end("method not allowed");
        return;
      }

      response.writeHead(options.betaRouteStatuses?.generate ?? 401, {
        "content-type": "application/json; charset=utf-8",
      });
      response.end(JSON.stringify({ status: "error", errors: ["Unauthorized"] }));
      return;
    }

    if (request.url === "/api/v0/sessions/complete") {
      if (request.method !== "POST") {
        response.writeHead(options.betaRouteStatuses?.complete ?? 405, {
          "content-type": "text/plain; charset=utf-8",
        });
        response.end("method not allowed");
        return;
      }

      response.writeHead(options.betaRouteStatuses?.complete ?? 401, {
        "content-type": "application/json; charset=utf-8",
      });
      response.end(JSON.stringify({ status: "error", errors: ["Unauthorized"] }));
      return;
    }

    if (request.url === "/api/v0/reporting/analytics") {
      if (request.method !== "GET") {
        response.writeHead(options.betaRouteStatuses?.reporting ?? 405, {
          "content-type": "text/plain; charset=utf-8",
        });
        response.end("method not allowed");
        return;
      }

      response.writeHead(options.betaRouteStatuses?.reporting ?? 401, {
        "content-type": "application/json; charset=utf-8",
      });
      response.end(JSON.stringify({ status: "error", errors: ["Unauthorized"] }));
      return;
    }

    response.writeHead(404);
    response.end("not found");
  });

  return server;
};

const startServer = async (options: HealthResponseOptions = {}) => {
  const server = createSmokeServer(options);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to resolve smoke test server address");
  }

  return {
    server,
    baseUrl: `http://127.0.0.1:${address.port}`,
  };
};

const runSmokeVerifier = async (baseUrl: string) =>
  execFileAsync(process.execPath, [scriptPath, baseUrl], {
    env: process.env,
  });

const closeServer = async (server: ReturnType<typeof createSmokeServer>) => {
  if (!server.listening) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
};

describe("deploy smoke verifier", () => {
  it("passes when offline and health checks satisfy the release contract", async () => {
    const { server, baseUrl } = await startServer();

    try {
      const result = await runSmokeVerifier(baseUrl);

      expect(result.stdout).toContain(`[deploy-smoke] PASS ${baseUrl}`);
      expect(result.stdout).toContain("[deploy-smoke] offline route: 200");
      expect(result.stdout).toContain("[deploy-smoke] health endpoint: 200");
      expect(result.stdout).toContain("[deploy-smoke] sessions generate method-boundary: 405");
      expect(result.stdout).toContain("[deploy-smoke] sessions complete method-boundary: 405");
      expect(result.stdout).toContain("[deploy-smoke] reporting analytics method-boundary: 405");
    } finally {
      await closeServer(server);
    }
  });

  it("fails when the session generation method boundary is not enforced", async () => {
    const { server, baseUrl } = await startServer({ betaRouteStatuses: { generate: 200 } });

    try {
      await expect(runSmokeVerifier(baseUrl)).rejects.toMatchObject({
        stderr: expect.stringContaining("sessions generate method-boundary returned unexpected status 200"),
      });
    } finally {
      await closeServer(server);
    }
  });

  it("fails when the session completion method boundary is not enforced", async () => {
    const { server, baseUrl } = await startServer({ betaRouteStatuses: { complete: 200 } });

    try {
      await expect(runSmokeVerifier(baseUrl)).rejects.toMatchObject({
        stderr: expect.stringContaining("sessions complete method-boundary returned unexpected status 200"),
      });
    } finally {
      await closeServer(server);
    }
  });

  it("fails when the reporting analytics method boundary is not enforced", async () => {
    const { server, baseUrl } = await startServer({ betaRouteStatuses: { reporting: 200 } });

    try {
      await expect(runSmokeVerifier(baseUrl)).rejects.toMatchObject({
        stderr: expect.stringContaining("reporting analytics method-boundary returned unexpected status 200"),
      });
    } finally {
      await closeServer(server);
    }
  });

  it("fails when the health endpoint omits the x-request-id header", async () => {
    const { server, baseUrl } = await startServer({ includeRequestId: false });

    try {
      await expect(runSmokeVerifier(baseUrl)).rejects.toMatchObject({
        stderr: expect.stringContaining("health endpoint must include an x-request-id header"),
      });
    } finally {
      await closeServer(server);
    }
  });

  it("fails when the health endpoint allows caching", async () => {
    const { server, baseUrl } = await startServer({ cacheControl: "public, max-age=60" });

    try {
      await expect(runSmokeVerifier(baseUrl)).rejects.toMatchObject({
        stderr: expect.stringContaining("health endpoint must disable caching with Cache-Control: no-store"),
      });
    } finally {
      await closeServer(server);
    }
  });

  it("fails when the health endpoint includes unexpected payload fields", async () => {
    const { server, baseUrl } = await startServer({
      extraHealthFields: { serviceRoleKey: "must-not-be-logged" },
    });

    try {
      await expect(runSmokeVerifier(baseUrl)).rejects.toMatchObject({
        stderr: expect.stringContaining("health payload contains unexpected fields: serviceRoleKey"),
      });
    } finally {
      await closeServer(server);
    }
  });
});
