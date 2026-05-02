import { ResolveTemplateRequestSchema } from "@adaptabuddy/contracts";
import { runAuthedRoute, parseJsonWithSchema } from "@/lib/api/routeHandler";
import { handleResolveTemplate } from "@/modules/templates/service";

export async function POST(request: Request) {
  return runAuthedRoute(
    request,
    {
      route: "/api/v0/templates/resolve",
      action: "handleResolveTemplate",
      rateLimit: {
        keyPrefix: "resolve-template",
        limit: 20,
        windowMs: 60_000,
      },
      parseInput: (inputRequest) => parseJsonWithSchema(inputRequest, ResolveTemplateRequestSchema),
      execute: ({ userId, input }) => handleResolveTemplate(userId, input),
    },
    undefined
  );
}
