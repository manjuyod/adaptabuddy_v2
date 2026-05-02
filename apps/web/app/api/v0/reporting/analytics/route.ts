import { runAuthedRoute, parseWithSchema } from "@/lib/api/routeHandler";
import { createSupabaseServerActionClient } from "@/lib/supabase/next";
import { DeterministicAnalyticsRequestSchema } from "@/modules/reporting/contracts";
import { getDeterministicAnalyticsReadModel } from "@/modules/reporting/service";

const parseInput = (request: Request) => {
  const { searchParams } = new URL(request.url);
  return parseWithSchema(
    Object.fromEntries(searchParams.entries()),
    DeterministicAnalyticsRequestSchema
  );
};

export async function GET(request: Request) {
  return runAuthedRoute(
    request,
    {
      route: "/api/v0/reporting/analytics",
      action: "getDeterministicAnalyticsReadModel",
      rateLimit: {
        keyPrefix: "reporting-analytics",
        limit: 30,
        windowMs: 60_000,
      },
      parseInput: (inputRequest) => parseInput(inputRequest),
      execute: async ({ userId }) => {
        const supabase = await createSupabaseServerActionClient();
        const analytics = await getDeterministicAnalyticsReadModel(supabase, userId);
        return {
          status: "success" as const,
          availability: analytics ? ("available" as const) : ("unavailable" as const),
          analytics,
        };
      },
      extraHeaders: {
        "Cache-Control": "no-store",
      },
    },
    undefined
  );
}
