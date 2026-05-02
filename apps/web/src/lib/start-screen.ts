export type PreferredStartScreen = "auto" | "start" | "continue";
export type StartScreenRoute = "start" | "continue";
export const NEW_GAME_ROUTE = "/onboarding" as const;

export function resolveStartScreen(
  hasSave: boolean,
  preferred: PreferredStartScreen
): StartScreenRoute {
  if (preferred === "continue") return "continue";
  if (preferred === "start") return "start";
  return hasSave ? "continue" : "start";
}
