import { OptInUpdateRequestSchema } from "@adaptabuddy/contracts";
import { runAuthedRoute, parseJsonWithSchema } from "@/lib/api/routeHandler";
import { handleOptInUpdate } from "@/modules/optins/service";

export async function POST(request: Request) {
  return runAuthedRoute(
    request,
    {
      route: "/api/v0/optins/update",
      action: "handleOptInUpdate",
      rateLimit: {
        keyPrefix: "optins-update",
        limit: 20,
        windowMs: 60_000,
      },
      parseInput: (inputRequest) => parseJsonWithSchema(inputRequest, OptInUpdateRequestSchema),
      execute: ({ userId, input }) => handleOptInUpdate(userId, input),
    },
    undefined
  );
}
