import { createClient } from "@supabase/supabase-js";
import { serverEnv } from "../../../src/lib/env";
import { jsonResponse } from "../../../src/lib/api/routeHandler";
import { logServerEvent } from "../../../src/lib/observability/logger";
import { resolveRequestId } from "../../../src/lib/observability/requestId";

export const dynamic = "force-dynamic";

const getSupabaseStatus = async (requestId: string): Promise<"connected" | "error"> => {
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_TARGET_SERVICE_ROLE_KEY ??
    serverEnv.SUPABASE_ANON_KEY;

  const supabase = createClient(serverEnv.SUPABASE_URL, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false
    }
  });

  try {
    const { error } = await supabase.from("programs").select("id").limit(1);
    if (!error || error.code === "42501") {
      return "connected";
    }
    logServerEvent({
      route: "/api/health",
      action: "getSupabaseStatus",
      severity: "warn",
      reason: "dependency_error",
      requestId,
      statusCode: 200,
      details: { code: error.code, message: error.message },
    });
  } catch {
    logServerEvent({
      route: "/api/health",
      action: "getSupabaseStatus",
      severity: "error",
      reason: "dependency_error",
      requestId,
      statusCode: 200,
    });
    return "error";
  }

  return "error";
};

export async function GET(request: Request) {
  const requestId = resolveRequestId(request.headers.get("x-request-id"));
  const supabaseStatus = await getSupabaseStatus(requestId);
  const body = {
    status: "ok" as const,
    timestamp: new Date().toISOString(),
    supabase: supabaseStatus
  };

  logServerEvent({
    route: "/api/health",
    action: "GET",
    severity: supabaseStatus === "connected" ? "info" : "warn",
    reason: supabaseStatus === "connected" ? "request_completed" : "dependency_error",
    requestId,
    statusCode: 200,
    details: { supabase: supabaseStatus },
  });

  return jsonResponse(body, 200, requestId, { "Cache-Control": "no-store" });
}
