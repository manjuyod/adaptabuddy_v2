import { GenerateSessionRequestSchema } from "@adaptabuddy/contracts";
import { runAuthedRoute, parseJsonWithSchema } from "@/lib/api/routeHandler";
import { handleGenerateSession } from "@/modules/sessions/service";

export async function POST(request: Request) {
  return runAuthedRoute(
    request,
    {
      route: "/api/v0/sessions/generate",
      action: "handleGenerateSession",
      rateLimit: {
        keyPrefix: "generate-session",
        limit: 20,
        windowMs: 60_000,
      },
      parseInput: (inputRequest) => parseJsonWithSchema(inputRequest, GenerateSessionRequestSchema),
      execute: ({ userId, input }) => handleGenerateSession(userId, input),
    },
    undefined
  );
}
