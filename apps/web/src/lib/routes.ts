export const ROUTES = {
  home: "/",
  start: "/start",
  onboarding: "/onboarding",
  auth: {
    root: "/auth",
    login: "/login",
    signup: "/auth/signup"
  },
  title: {
    start: "/title/start",
    continue: "/title/continue"
  },
  debug: "/debug"
} as const;

export const isAuthPath = (pathname: string) =>
  pathname === ROUTES.auth.root || pathname.startsWith(`${ROUTES.auth.root}/`);
