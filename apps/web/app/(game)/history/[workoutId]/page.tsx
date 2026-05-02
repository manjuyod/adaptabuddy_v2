import Link from "next/link";
import type { Route } from "next";
import { notFound, redirect } from "next/navigation";
import { createSupabaseServerComponentClient } from "@/lib/supabase/next";
import { HistoryDetailRequestSchema } from "@adaptabuddy/contracts";
import { getWorkoutDetail } from "@/modules/history/service";
import { HistoryDetail } from "@/modules/history/components/HistoryDetail";

type Params = {
  workoutId: string;
};

type HistoryDetailPageProps = {
  params: Promise<Params>;
};

export default async function HistoryDetailPage({ params }: HistoryDetailPageProps) {
  const supabase = await createSupabaseServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const resolvedParams = await params;
  const parseResult = HistoryDetailRequestSchema.safeParse({
    workoutId: resolvedParams.workoutId,
  });

  if (!parseResult.success) {
    notFound();
  }

  const result = await getWorkoutDetail(user.id, parseResult.data.workoutId);
  if (result.status === "error" || !result.workout) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">History</p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-100">Workout Detail</h1>
        </div>
        <Link
          href={"/history" as Route}
          className="rounded-md border border-slate-700 px-3 py-2 text-xs text-slate-200 transition hover:border-slate-500"
        >
          Back to History
        </Link>
      </div>

      <HistoryDetail workout={result.workout} />
    </div>
  );
}

