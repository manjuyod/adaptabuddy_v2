import { VolumeAllocateRequestSchema } from "@adaptabuddy/contracts";
import { runAuthedRoute, parseJsonWithSchema } from "@/lib/api/routeHandler";
import { handleVolumeAllocate } from "@/modules/volume/service";

export async function POST(request: Request) {
  return runAuthedRoute(
    request,
    {
      route: "/api/v0/volume/allocate",
      action: "handleVolumeAllocate",
      rateLimit: {
        keyPrefix: "volume-allocate",
        limit: 20,
        windowMs: 60_000,
      },
      parseInput: (inputRequest) => parseJsonWithSchema(inputRequest, VolumeAllocateRequestSchema),
      execute: ({ userId, input }) => handleVolumeAllocate(userId, input),
    },
    undefined
  );
}
