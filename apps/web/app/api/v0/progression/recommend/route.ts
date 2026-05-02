import { ProgressionRecommendRequestSchema } from "@adaptabuddy/contracts";
import { runAuthedRoute, parseWithSchema } from "@/lib/api/routeHandler";
import { handleProgressionRecommend } from "@/modules/progression/service";

const parseNumberParam = (value: string | null) => {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? undefined : parsed;
};

const parseInput = (request: Request) => {
  const { searchParams } = new URL(request.url);
  const exerciseIdsParam = searchParams.getAll("exerciseIds");
  const exerciseIds =
    exerciseIdsParam.length === 1 && exerciseIdsParam[0].includes(",")
      ? exerciseIdsParam[0]
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean)
      : exerciseIdsParam;

  return parseWithSchema(
    {
      exerciseIds,
      repsMin: parseNumberParam(searchParams.get("repsMin")),
      repsMax: parseNumberParam(searchParams.get("repsMax")),
    },
    ProgressionRecommendRequestSchema
  );
};

export async function GET(request: Request) {
  return runAuthedRoute(
    request,
    {
      route: "/api/v0/progression/recommend",
      action: "handleProgressionRecommend",
      rateLimit: {
        keyPrefix: "progression-recommend",
        limit: 30,
        windowMs: 60_000,
      },
      parseInput: (inputRequest) => parseInput(inputRequest),
      execute: ({ userId, input }) => handleProgressionRecommend(userId, input),
    },
    undefined
  );
}
