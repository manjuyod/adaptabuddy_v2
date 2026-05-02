const INTERNAL_BASE_URL = "https://adaptabuddy.local";

export const getFirstSearchParamValue = (value: string | string[] | undefined) => {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value[0];
  return undefined;
};

export const resolveSafeRedirectTo = (rawRedirectTo: string | null | undefined) => {
  const trimmed = rawRedirectTo?.trim();
  if (!trimmed || !trimmed.startsWith("/")) return null;

  try {
    const parsed = new URL(trimmed, INTERNAL_BASE_URL);
    if (parsed.origin !== INTERNAL_BASE_URL) return null;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return null;
  }
};
