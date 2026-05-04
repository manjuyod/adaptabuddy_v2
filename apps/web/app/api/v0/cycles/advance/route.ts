import { AdvanceCycleRequestSchema } from "@adaptabuddy/contracts";
import { runAuthedRoute, parseJsonWithSchema } from "@/lib/api/routeHandler";
import { handleAdvanceCycle } from "@/modules/cycles/service";

export async function POST(request: Request) {
  return runAuthedRoute(
    request,
    {
      route: "/api/v0/cycles/advance",
      action: "handleAdvanceCycle",
      rateLimit: {
        keyPrefix: "advance-cycle",
        limit: 15,
        windowMs: 60_000,
      },
      parseInput: (inputRequest) => parseJsonWithSchema(inputRequest, AdvanceCycleRequestSchema),
      execute: ({ userId, input, requestId }) =>
        handleAdvanceCycle(userId, input, {
          requestId,
          route: "/api/v0/cycles/advance",
        }),
    },
    undefined
  );
}
