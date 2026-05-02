import { runAuthedRoute } from "@/lib/api/routeHandler";
import { createSupabaseServerActionClient } from "@/lib/supabase/next";
import { getActiveCycleReporting } from "@/modules/reporting/service";

export async function GET(request: Request) {
  return runAuthedRoute(
    request,
    {
      route: "/api/v0/reporting/active-cycle",
      action: "getActiveCycleReporting",
      rateLimit: {
        keyPrefix: "reporting-active-cycle",
        limit: 30,
        windowMs: 60_000,
      },
      parseInput: () => ({ success: true, data: undefined }),
      execute: async ({ userId }) => {
        const supabase = await createSupabaseServerActionClient();
        return {
          status: "success" as const,
          reporting: await getActiveCycleReporting(supabase, userId),
        };
      },
    },
    undefined
  );
}
