import process from "node:process";

const resolveBaseUrl = () => {
  const input = process.argv[2] ?? process.env.SMOKE_BASE_URL;
  const fallbackPort = process.env.PORT ?? "3000";
  return (input ?? `http://127.0.0.1:${fallbackPort}`).replace(/\/+$/, "");
};

const validIsoTimestamp = (value) => {
  if (typeof value !== "string" || value.length === 0) {
    return false;
  }
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) {
    return false;
  }
  return new Date(value).toISOString() === value;
};

const validateHealthPayload = (payload) => {
  if (!payload || typeof payload !== "object") {
    return "health payload must be a JSON object";
  }

  const allowedKeys = new Set(["status", "timestamp", "supabase"]);
  const unexpectedKeys = Object.keys(payload).filter((key) => !allowedKeys.has(key));
  if (unexpectedKeys.length > 0) {
    return `health payload contains unexpected fields: ${unexpectedKeys.join(", ")}`;
  }

  if (payload.status !== "ok") {
    return `health.status must be \"ok\" (received ${JSON.stringify(payload.status)})`;
  }

  if (!validIsoTimestamp(payload.timestamp)) {
    return "health.timestamp must be a valid ISO timestamp";
  }

  if (!Object.prototype.hasOwnProperty.call(payload, "supabase")) {
    return "health.supabase field is missing";
  }

  if (payload.supabase !== "connected" && payload.supabase !== "error") {
    return `health.supabase must be \"connected\" or \"error\" (received ${JSON.stringify(payload.supabase)})`;
  }

  return null;
};

const toHealthEvidencePayload = (payload) => ({
  status: payload.status,
  timestamp: payload.timestamp,
  supabase: payload.supabase
});

const validateHealthHeaders = (response) => {
  const requestId = response.headers.get("x-request-id");
  if (!requestId || requestId.trim().length === 0) {
    return "health endpoint must include an x-request-id header";
  }

  const cacheControl = response.headers.get("cache-control");
  if (!cacheControl || !cacheControl.toLowerCase().includes("no-store")) {
    return "health endpoint must disable caching with Cache-Control: no-store";
  }

  return null;
};

const checks = [
  {
    name: "offline route",
    path: "/offline",
    method: "GET",
    expectedStatuses: [200]
  },
  {
    name: "health endpoint",
    path: "/api/health",
    method: "GET",
    expectedStatuses: [200],
    validateJson: validateHealthPayload
  },
  {
    name: "sessions generate method-boundary",
    path: "/api/v0/sessions/generate",
    method: "GET",
    expectedStatuses: [405]
  },
  {
    name: "sessions complete method-boundary",
    path: "/api/v0/sessions/complete",
    method: "GET",
    expectedStatuses: [405]
  },
  {
    name: "reporting analytics method-boundary",
    path: "/api/v0/reporting/analytics",
    method: "POST",
    expectedStatuses: [405]
  }
];

const runCheck = async (baseUrl, check) => {
  const url = `${baseUrl}${check.path}`;
  const response = await fetch(url, {
    method: check.method ?? "GET",
    redirect: "manual"
  });

  if (!check.expectedStatuses.includes(response.status)) {
    throw new Error(
      `${check.name} returned unexpected status ${response.status} at ${url} (expected ${check.expectedStatuses.join(", ")})`
    );
  }

  if (!check.validateJson) {
    return {
      name: check.name,
      status: response.status,
      url
    };
  }

  const payload = await response.json();
  const validationError = check.validateJson(payload);
  if (validationError) {
    throw new Error(`${check.name} payload invalid at ${url}: ${validationError}`);
  }

  const headerValidationError = validateHealthHeaders(response);
  if (headerValidationError) {
    throw new Error(`${check.name} contract invalid at ${url}: ${headerValidationError}`);
  }

  return {
    name: check.name,
    status: response.status,
    url,
    payload: toHealthEvidencePayload(payload)
  };
};

const main = async () => {
  const baseUrl = resolveBaseUrl();
  const results = [];

  for (const check of checks) {
    const result = await runCheck(baseUrl, check);
    results.push(result);
  }

  console.log(`[deploy-smoke] PASS ${baseUrl}`);
  for (const result of results) {
    console.log(`[deploy-smoke] ${result.name}: ${result.status} ${result.url}`);
    if (result.payload) {
      console.log(`[deploy-smoke] health payload: ${JSON.stringify(result.payload)}`);
    }
  }
};

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[deploy-smoke] FAIL ${message}`);
  process.exitCode = 1;
});
