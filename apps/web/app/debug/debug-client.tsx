"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getBrowserClient } from "@/lib/supabase/client";
import { resolveStartScreen, type PreferredStartScreen } from "@/lib/start-screen";
import { ROUTES } from "@/lib/routes";

type DebugProfile = {
  has_save: boolean;
  preferred_start_screen: PreferredStartScreen;
};

const preferredOptions: PreferredStartScreen[] = ["auto", "start", "continue"];

export function DebugClient() {
  const router = useRouter();
  const supabase = useMemo(() => getBrowserClient(), []);
  const [pending, startTransition] = useTransition();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<DebugProfile | null>(null);

  const loadProfile = async () => {
    setLoading(true);
    setError(null);

    const { data: userResult, error: userError } = await supabase.auth.getUser();
    if (userError) {
      setError(userError.message);
      setLoading(false);
      return;
    }

    const user = userResult.user;
    if (!user) {
      router.push(ROUTES.auth.login);
      return;
    }

    setUserId(user.id);
    const { data, error: profileError } = await supabase
      .from("users")
      .select("has_save, preferred_start_screen")
      .eq("id", user.id)
      .single();

    if (profileError) {
      setError(profileError.message);
      setLoading(false);
      return;
    }

    setProfile(data as DebugProfile);
    setLoading(false);
  };

  useEffect(() => {
    void loadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleHasSave = () => {
    if (!userId || !profile) return;
    startTransition(async () => {
      setError(null);
      const nextHasSave = !profile.has_save;
      const { data, error: updateError } = await supabase
        .from("users")
        .update({ has_save: nextHasSave })
        .eq("id", userId)
        .select("has_save, preferred_start_screen")
        .single();

      if (updateError) {
        setError(updateError.message);
        return;
      }

      setProfile(data as DebugProfile);
    });
  };

  const setPreferredStart = (next: PreferredStartScreen) => {
    if (!userId || !profile) return;
    startTransition(async () => {
      setError(null);
      const { data, error: updateError } = await supabase
        .from("users")
        .update({ preferred_start_screen: next })
        .eq("id", userId)
        .select("has_save, preferred_start_screen")
        .single();

      if (updateError) {
        setError(updateError.message);
        return;
      }

      setProfile(data as DebugProfile);
    });
  };

  const computedRoute = profile ? resolveStartScreen(profile.has_save, profile.preferred_start_screen) : null;

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-6 py-12">
      <div className="rounded-3xl border border-amber-900/50 bg-slate-950/80 p-6 shadow-[0_16px_48px_rgba(0,0,0,0.45)] backdrop-blur">
        <p className="pixelated text-xs uppercase tracking-[0.3em] text-amber-200/80">Debug</p>
        <h1 className="mt-3 text-2xl font-semibold text-amber-50">Developer tools</h1>
        <p className="mt-2 text-sm text-amber-100/80">
          Toggle `has_save` and set `preferred_start_screen` to validate post-auth routing.
        </p>
      </div>

      <div className="mt-6 space-y-4 rounded-3xl border border-amber-900/40 bg-slate-950/70 p-6 shadow-[0_14px_42px_rgba(0,0,0,0.45)] backdrop-blur">
        {loading ? <p className="text-sm text-amber-100/80">Loading...</p> : null}
        {error ? <p className="text-sm text-rose-200">{error}</p> : null}

        {!loading && userId && profile ? (
          <div className="space-y-2 text-sm text-amber-100/80">
            <p>
              <span className="text-amber-200">User ID:</span> {userId}
            </p>
            <p>
              <span className="text-amber-200">has_save:</span> {profile.has_save ? "true" : "false"}
            </p>
            <p>
              <span className="text-amber-200">preferred_start_screen:</span> {profile.preferred_start_screen}
            </p>
            {computedRoute ? (
              <p>
                <span className="text-amber-200">Computed:</span> /title/{computedRoute}
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={toggleHasSave}
            disabled={pending || loading || !profile}
            className="pixelated rounded-lg border border-amber-900 bg-gradient-to-b from-amber-400 to-amber-700 px-4 py-3 text-center text-sm font-semibold text-amber-50 shadow-[0_6px_0_#4a2b00] transition hover:-translate-y-0.5 hover:shadow-[0_8px_0_#4a2b00] disabled:translate-y-0 disabled:opacity-70 disabled:shadow-none"
            aria-busy={pending}
          >
            {pending ? "Updating..." : profile?.has_save ? "Mark Empty" : "Mark Has Save"}
          </button>

          <button
            type="button"
            onClick={() => void loadProfile()}
            disabled={pending || loading}
            className="rounded-lg border border-amber-800/60 bg-slate-900/70 px-4 py-3 text-sm font-semibold text-amber-100 transition hover:border-amber-500 hover:text-amber-50 disabled:opacity-70"
          >
            Refresh
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {preferredOptions.map((option) => {
            const selected = option === profile?.preferred_start_screen;
            return (
              <button
                key={option}
                type="button"
                onClick={() => setPreferredStart(option)}
                disabled={pending || loading || !profile}
                className={[
                  "rounded-lg border px-3 py-2 text-sm font-semibold transition disabled:opacity-70",
                  selected
                    ? "border-amber-400 bg-amber-500/20 text-amber-50"
                    : "border-amber-800/60 bg-slate-900/60 text-amber-100 hover:border-amber-500 hover:text-amber-50"
                ].join(" ")}
              >
                {option}
              </button>
            );
          })}
        </div>

        {computedRoute ? (
          <div className="pt-2">
            <Link
              href={`/title/${computedRoute}`}
              className="text-sm font-semibold text-amber-200 underline decoration-amber-400/60 underline-offset-4 hover:text-amber-50"
            >
              Go to /title/{computedRoute}
            </Link>
          </div>
        ) : null}
      </div>
    </div>
  );
}
