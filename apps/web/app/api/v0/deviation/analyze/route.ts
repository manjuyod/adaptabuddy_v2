import { DeviationAnalyzeRequestSchema } from "@adaptabuddy/contracts";
import { runAuthedRoute, parseJsonWithSchema } from "@/lib/api/routeHandler";
import { handleDeviationAnalyze } from "@/modules/deviation/service";

export async function POST(request: Request) {
  return runAuthedRoute(
    request,
    {
      route: "/api/v0/deviation/analyze",
      action: "handleDeviationAnalyze",
      rateLimit: {
        keyPrefix: "deviation-analyze",
        limit: 20,
        windowMs: 60_000,
      },
      parseInput: (inputRequest) => parseJsonWithSchema(inputRequest, DeviationAnalyzeRequestSchema),
      execute: ({ userId, input }) => handleDeviationAnalyze(userId, input),
    },
    undefined
  );
}
