import { HistoryDetailRequestSchema } from "@adaptabuddy/contracts";
import { runAuthedRoute, parseWithSchema } from "@/lib/api/routeHandler";
import { getWorkoutDetail } from "@/modules/history/service";

type RouteContext = {
  params: Promise<{ workoutId: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  return runAuthedRoute(
    request,
    {
      route: "/api/v0/history/[workoutId]",
      action: "getWorkoutDetail",
      rateLimit: {
        keyPrefix: "history-detail",
        limit: 30,
        windowMs: 60_000,
      },
      parseInput: async (_request, routeContext) => {
        const { workoutId } = await routeContext.params;
        return parseWithSchema({ workoutId }, HistoryDetailRequestSchema);
      },
      execute: ({ userId, input }) => getWorkoutDetail(userId, input.workoutId),
      mapServiceErrorStatus: (result) => {
        const isNotFound =
          (result as { errors?: string[] }).errors?.some((error) =>
            error.toLowerCase().includes("not found")
          ) ?? false;
        return isNotFound ? 404 : 400;
      },
    },
    context
  );
}
