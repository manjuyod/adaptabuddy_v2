import { ROUTES, isAuthPath } from "@/lib/routes";

export const PUBLIC_PATH_PREFIXES = ["/login", "/callback", "/api", "/offline"] as const;

export type GuardRedirect = {
  pathname: string;
  searchParams?: Record<string, string>;
};

export const getAuthGuardRedirect = (input: {
  pathname: string;
  search: string;
  isAuthenticated: boolean;
}): GuardRedirect | null => {
  if (isAuthPath(input.pathname)) {
    return input.isAuthenticated ? { pathname: ROUTES.start } : null;
  }

  const isPublic = PUBLIC_PATH_PREFIXES.some((path) => input.pathname.startsWith(path));
  if (isPublic) return null;

  if (!input.isAuthenticated) {
    return {
      pathname: ROUTES.auth.login,
      searchParams: {
        redirectTo: `${input.pathname}${input.search}`
      }
    };
  }

  return null;
};
