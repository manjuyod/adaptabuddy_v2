import {
  GenerateWorkoutRequestSchema,
  GenerateWorkoutResponseSchema,
  type GenerateWorkoutRequest,
  type GenerateWorkoutResponse
} from "./contracts";
import { generateWorkout } from "@adaptabuddy/core";

const chooseSeed = () => Math.floor(Date.now() % 1_000_000_000);

const toContractFailure = (seed: number, message: string): GenerateWorkoutResponse => ({
  status: "no_solution",
  debug: { seed, selected_ids: [], rejected: [] },
  errors: [message]
});

export const handleGenerateWorkout = (input: unknown): GenerateWorkoutResponse => {
  const parsedRequest = GenerateWorkoutRequestSchema.safeParse(input);
  if (!parsedRequest.success) {
    const seed = chooseSeed();
    return toContractFailure(seed, "Request payload failed validation.");
  }

  const request: GenerateWorkoutRequest = {
    ...parsedRequest.data,
    seed: parsedRequest.data.seed ?? chooseSeed()
  };

  const result = generateWorkout(request);
  const parsedResponse = GenerateWorkoutResponseSchema.safeParse(result);
  if (!parsedResponse.success) {
    return toContractFailure(request.seed!, "Engine returned an invalid shape.");
  }

  return parsedResponse.data;
};
