import { GuardrailRequestSchema } from "@adaptabuddy/contracts";
import { runAuthedRoute, parseJsonWithSchema } from "@/lib/api/routeHandler";
import { handleGuardrailEvaluate } from "@/modules/guardrails/service";

export async function POST(request: Request) {
  return runAuthedRoute(
    request,
    {
      route: "/api/v0/guardrails/evaluate",
      action: "handleGuardrailEvaluate",
      rateLimit: {
        keyPrefix: "guardrails-evaluate",
        limit: 20,
        windowMs: 60_000,
      },
      parseInput: (inputRequest) => parseJsonWithSchema(inputRequest, GuardrailRequestSchema),
      execute: ({ userId, input }) => handleGuardrailEvaluate(userId, input),
    },
    undefined
  );
}
