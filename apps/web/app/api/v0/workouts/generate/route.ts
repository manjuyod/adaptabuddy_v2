import { runAuthedRoute } from "@/lib/api/routeHandler";
import { handleGenerateWorkout } from "@/modules/workouts/service";

const LEGACY_HEADERS = {
  Deprecation: "true",
  Sunset: "Wed, 31 Dec 2026 23:59:59 GMT",
  Link: "</api/v0/sessions/generate>; rel=\"successor-version\"",
};

export async function POST(request: Request) {
  return runAuthedRoute(
    request,
    {
      route: "/api/v0/workouts/generate",
      action: "handleGenerateWorkout",
      rateLimit: {
        keyPrefix: "generate",
        limit: 20,
        windowMs: 60_000,
      },
      parseInput: async (inputRequest) => {
        const payload = await inputRequest.json().catch(() => ({}));
        return {
          success: true as const,
          data: payload,
        };
      },
      execute: ({ input }) => handleGenerateWorkout(input),
      rateLimitBody: { error: "Rate limit exceeded" },
      unauthorizedBody: { error: "Unauthorized" },
      unexpectedErrorBody: { error: "An unexpected error occurred" },
      extraHeaders: LEGACY_HEADERS,
    },
    undefined
  );
}
