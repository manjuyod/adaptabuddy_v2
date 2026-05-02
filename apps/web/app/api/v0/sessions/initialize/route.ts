import { InitializeCycleRequestSchema } from "@adaptabuddy/contracts";
import { runAuthedRoute, parseJsonWithSchema } from "@/lib/api/routeHandler";
import { handleInitializeCycle } from "@/modules/cycles/service";

export async function POST(request: Request) {
  return runAuthedRoute(
    request,
    {
      route: "/api/v0/sessions/initialize",
      action: "handleInitializeCycle",
      rateLimit: {
        keyPrefix: "initialize-cycle",
        limit: 10,
        windowMs: 60_000,
      },
      parseInput: (inputRequest) =>
        parseJsonWithSchema(inputRequest, InitializeCycleRequestSchema),
      execute: ({ userId, input }) => handleInitializeCycle(userId, input),
    },
    undefined
  );
}
