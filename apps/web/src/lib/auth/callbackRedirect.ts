import { ROUTES } from "@/lib/routes";

export const resolveSafeCallbackRedirect = (rawNext: string | null, requestUrl: string) => {
  const requestTarget = new URL(requestUrl);
  const fallback = new URL(ROUTES.start, requestTarget);

  if (!rawNext) return fallback;

  try {
    const candidate = new URL(rawNext, requestTarget);
    return candidate.origin === requestTarget.origin ? candidate : fallback;
  } catch {
    return fallback;
  }
};
