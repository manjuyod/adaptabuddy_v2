import { BetaFeedbackSubmitRequestSchema } from "@adaptabuddy/contracts";
import { runAuthedRoute, parseJsonWithSchema } from "@/lib/api/routeHandler";
import { submitBetaFeedback } from "@/modules/support/service";

export async function POST(request: Request) {
  return runAuthedRoute(
    request,
    {
      route: "/api/v0/support/feedback",
      action: "submitBetaFeedback",
      rateLimit: {
        keyPrefix: "support-feedback",
        limit: 40,
        windowMs: 60_000,
      },
      parseInput: (inputRequest) => parseJsonWithSchema(inputRequest, BetaFeedbackSubmitRequestSchema),
      execute: ({ userId, input, requestId }) => submitBetaFeedback(userId, input, requestId),
      mapServiceErrorStatus: () => 500,
    },
    undefined
  );
}
