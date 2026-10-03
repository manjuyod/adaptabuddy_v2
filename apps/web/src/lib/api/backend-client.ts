import { createSupabaseServerComponentClient } from "@/lib/supabase/next";

const DEFAULT_API_BASE_URL = "http://127.0.0.1:3000";

export const backendApiBaseUrl =
  process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? DEFAULT_API_BASE_URL;

export async function fetchBackendApi<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const supabase = await createSupabaseServerComponentClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (!headers.has("Content-Type") && init.body) {
    headers.set("Content-Type", "application/json");
  }
  if (session?.access_token) {
    headers.set("Authorization", `Bearer ${session.access_token}`);
  }

  const response = await fetch(`${backendApiBaseUrl}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Rust API request failed: ${response.status} ${response.statusText}`);
  }

  return (await response.json()) as T;
}

export type BackendApiResult<T> =
  | { data: T; error: null }
  | { data: null; error: string };

export async function fetchBackendApiResult<T>(
  path: string,
  init: RequestInit = {},
): Promise<BackendApiResult<T>> {
  try {
    return { data: await fetchBackendApi<T>(path, init), error: null };
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error.message : "Rust API request failed",
    };
  }
}
