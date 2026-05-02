import { ChaosPlanRequestSchema } from "@adaptabuddy/contracts";
import { runAuthedRoute, parseJsonWithSchema } from "@/lib/api/routeHandler";
import { handleChaosPlan } from "@/modules/chaos/service";

export async function POST(request: Request) {
  return runAuthedRoute(
    request,
    {
      route: "/api/v0/chaos/plan",
      action: "handleChaosPlan",
      rateLimit: {
        keyPrefix: "chaos-plan",
        limit: 20,
        windowMs: 60_000,
      },
      parseInput: (inputRequest) => parseJsonWithSchema(inputRequest, ChaosPlanRequestSchema),
      execute: ({ userId, input }) => handleChaosPlan(userId, input),
    },
    undefined
  );
}
