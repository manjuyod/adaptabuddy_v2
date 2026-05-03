import Link from "next/link";
import { redirect } from "next/navigation";
import { ROUTES } from "@/lib/routes";
import { SignOutButton } from "@/modules/auth/components/sign-out-button";
import { createSupabaseServerComponentClient } from "@/lib/supabase/next";
import type { UserStats } from "@adaptabuddy/contracts";
import { getDefaultUserStats } from "@/lib/db-transformers";
import { OptInSettingsPanel } from "@/modules/optins/components/OptInSettingsPanel";
import { SettingsPreferencesPanel } from "@/modules/settings/components/SettingsPreferencesPanel";
import { BetaFeedbackPanel } from "@/modules/support/components/BetaFeedbackPanel";

export default async function SettingsPage() {
  const isDev = process.env.NODE_ENV === "development";
  const supabase = await createSupabaseServerComponentClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: userData } = await supabase
    .from("users")
    .select("stats_json")
    .eq("id", user.id)
    .single();

  const defaultStats = getDefaultUserStats();
  const stats = (userData?.stats_json as UserStats) ?? defaultStats;
  const preferences = {
    ...defaultStats.preferences,
    ...stats.preferences,
    optIns: stats.preferences?.optIns ?? defaultStats.preferences.optIns,
    acknowledgedRisks:
      stats.preferences?.acknowledgedRisks ?? defaultStats.preferences.acknowledgedRisks,
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-800 bg-surface/80 p-6 shadow-lg">
        <p className="pixelated text-xs uppercase tracking-[0.35em] text-amber-200/80">Settings</p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-100">Settings & Preferences</h1>
        <p className="mt-2 text-sm text-slate-400">
          Configure equipment, injury constraints, fatigue profile, display defaults, and
          high-risk training overrides.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-xl border border-slate-800 bg-surface/80 p-6 shadow-lg">
          <SettingsPreferencesPanel
            initialFatigueLevel={preferences.fatigueLevel}
            initialEquipment={preferences.equipment}
            initialInjuries={preferences.injuries}
            initialUnitSystem={preferences.unitSystem}
            initialTheme={preferences.theme}
          />
        </div>
        <div className="rounded-xl border border-slate-800 bg-surface/80 p-6 shadow-lg">
          <OptInSettingsPanel
            initialOptIns={preferences.optIns}
            initialAcknowledgedRisks={preferences.acknowledgedRisks}
          />
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-surface/80 p-6 shadow-lg">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Account</p>
        <h2 className="mt-2 text-lg font-semibold text-slate-100">Session</h2>
        <p className="mt-2 text-sm text-slate-400">
          Signed in as <span className="font-medium text-slate-200">{user.email ?? "unknown"}</span>.
        </p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Link
            href={ROUTES.start}
            className="pixelated rounded-lg border border-amber-900 bg-gradient-to-b from-amber-400 to-amber-700 px-4 py-3 text-center text-sm font-semibold text-amber-50 shadow-[0_6px_0_#4a2b00] transition hover:-translate-y-0.5 hover:shadow-[0_8px_0_#4a2b00] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"
          >
            Back to Title
          </Link>
          <SignOutButton />
          {isDev ? (
            <Link
              href={ROUTES.debug}
              className="rounded-lg border border-amber-800/60 bg-slate-900/70 px-4 py-3 text-center text-sm font-semibold text-amber-100 transition hover:border-amber-500 hover:text-amber-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"
            >
              Debug
            </Link>
          ) : null}
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-surface/80 p-6 shadow-lg">
        <BetaFeedbackPanel />
      </div>
    </div>
  );
}

