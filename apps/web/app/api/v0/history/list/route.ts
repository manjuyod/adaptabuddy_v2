import { HistoryListRequestSchema } from "@adaptabuddy/contracts";
import { runAuthedRoute, parseWithSchema } from "@/lib/api/routeHandler";
import { getWorkoutHistory } from "@/modules/history/service";

const pickSingle = (value: string | null) => (value === null ? undefined : value);

const parseInput = (request: Request) => {
  const { searchParams } = new URL(request.url);

  return parseWithSchema(
    {
      page: pickSingle(searchParams.get("page")),
      pageSize: pickSingle(searchParams.get("pageSize")),
      dateFrom: pickSingle(searchParams.get("dateFrom")),
      dateTo: pickSingle(searchParams.get("dateTo")),
    },
    HistoryListRequestSchema
  );
};

export async function GET(request: Request) {
  return runAuthedRoute(
    request,
    {
      route: "/api/v0/history/list",
      action: "getWorkoutHistory",
      rateLimit: {
        keyPrefix: "history-list",
        limit: 30,
        windowMs: 60_000,
      },
      parseInput: (inputRequest) => parseInput(inputRequest),
      execute: ({ userId, input }) => getWorkoutHistory(userId, input),
    },
    undefined
  );
}
