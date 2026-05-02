import { CompleteSessionRequestSchema } from "@adaptabuddy/contracts";
import { runAuthedRoute, parseJsonWithSchema } from "@/lib/api/routeHandler";
import { handleCompleteSession } from "@/modules/sessions/service";

export async function POST(request: Request) {
  return runAuthedRoute(
    request,
    {
      route: "/api/v0/sessions/complete",
      action: "handleCompleteSession",
      rateLimit: {
        keyPrefix: "complete-session",
        limit: 30,
        windowMs: 60_000,
      },
      parseInput: (inputRequest) => parseJsonWithSchema(inputRequest, CompleteSessionRequestSchema),
      execute: ({ userId, input, requestId, request: currentRequest }) =>
        handleCompleteSession(userId, input, {
          requestId,
          route: "/api/v0/sessions/complete",
          idempotencyKey: currentRequest.headers.get("idempotency-key"),
        }),
    },
    undefined
  );
}
