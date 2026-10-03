"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";

const navigationItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/nutrition", label: "Nutrition" },
  { href: "/workout", label: "Workouts" },
  { href: "/history", label: "History" },
  { href: "/habits", label: "Habits" },
  { href: "/goals", label: "Goals" },
  { href: "/body-metrics", label: "Metrics" },
  { href: "/progress", label: "Progress" },
  { href: "/settings", label: "Settings" }
] as const;

const isRouteActive = (pathname: string, href: string) =>
  pathname === href || pathname.startsWith(`${href}/`);

const baseLinkClass =
  "rounded-lg border px-3 py-2 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300";

const getLinkClassName = (isActive: boolean) =>
  isActive
    ? `${baseLinkClass} border-emerald-500/70 bg-emerald-500/10 text-emerald-100`
    : `${baseLinkClass} border-slate-700 bg-slate-900/70 text-slate-300 hover:border-slate-500 hover:text-slate-100`;

export function NavigationBar() {
  const pathname = usePathname() ?? "";

  return (
    <>
      <nav
        aria-label="Primary navigation"
        className="sticky top-0 z-40 hidden border-b border-slate-800/80 bg-surface/90 backdrop-blur md:block"
        data-testid="primary-navigation-desktop"
      >
        <div className="mx-auto max-w-5xl px-6">
          <ul className="flex flex-wrap items-center gap-2 py-4">
            {navigationItems.map((item) => {
              const isActive = isRouteActive(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href as Route}
                    aria-current={isActive ? "page" : undefined}
                    data-active={isActive ? "true" : "false"}
                    className={getLinkClassName(isActive)}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </nav>

      <nav
        aria-label="Bottom navigation"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-800/80 bg-surface/95 px-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2 backdrop-blur md:hidden"
        data-testid="primary-navigation-mobile"
      >
        <ul className="mx-auto flex max-w-5xl gap-2 overflow-x-auto">
          {navigationItems.map((item) => {
            const isActive = isRouteActive(pathname, item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href as Route}
                  aria-current={isActive ? "page" : undefined}
                  data-active={isActive ? "true" : "false"}
                  className={`block min-w-20 rounded-lg border px-2 py-2 text-center text-xs font-medium transition ${
                    isActive
                      ? "border-emerald-500/70 bg-emerald-500/10 text-emerald-100"
                      : "border-slate-700 bg-slate-900/70 text-slate-300"
                  }`}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
