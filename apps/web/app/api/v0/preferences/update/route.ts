import { PreferencesUpdateRequestSchema } from "@adaptabuddy/contracts";
import { runAuthedRoute, parseJsonWithSchema } from "@/lib/api/routeHandler";
import { handlePreferencesUpdate } from "@/modules/settings/service";

export async function POST(request: Request) {
  return runAuthedRoute(
    request,
    {
      route: "/api/v0/preferences/update",
      action: "handlePreferencesUpdate",
      rateLimit: {
        keyPrefix: "preferences-update",
        limit: 20,
        windowMs: 60_000,
      },
      parseInput: (inputRequest) => parseJsonWithSchema(inputRequest, PreferencesUpdateRequestSchema),
      execute: ({ userId, input }) => handlePreferencesUpdate(userId, input),
    },
    undefined
  );
}
