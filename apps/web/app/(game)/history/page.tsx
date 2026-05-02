import { redirect } from "next/navigation";
import { createSupabaseServerComponentClient } from "@/lib/supabase/next";
import { HistoryListRequestSchema } from "@adaptabuddy/contracts";
import { getWorkoutHistory } from "@/modules/history/service";
import { HistoryList } from "@/modules/history/components/HistoryList";

type SearchParamValue = string | string[] | undefined;
type SearchParams = Record<string, SearchParamValue>;

type HistoryPageProps = {
  searchParams?: Promise<SearchParams>;
};

const getFirst = (value: SearchParamValue) => (Array.isArray(value) ? value[0] : value);

export default async function HistoryPage({ searchParams }: HistoryPageProps) {
  const supabase = await createSupabaseServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const resolvedSearchParams = searchParams ? await searchParams : {};
  const parseResult = HistoryListRequestSchema.safeParse({
    page: getFirst(resolvedSearchParams.page),
    pageSize: getFirst(resolvedSearchParams.pageSize),
    dateFrom: getFirst(resolvedSearchParams.dateFrom),
    dateTo: getFirst(resolvedSearchParams.dateTo),
  });

  const request = parseResult.success
    ? parseResult.data
    : HistoryListRequestSchema.parse({ page: 1, pageSize: 10 });

  const result = await getWorkoutHistory(user.id, request);

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-800 bg-surface/80 p-6 shadow-lg">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">History</p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-100">Workout History</h1>
        <p className="text-sm text-slate-400">
          Review completed sessions with program, volume, and set summaries.
        </p>
      </div>

      {result.status === "error" ? (
        <div className="rounded-xl border border-red-900/60 bg-red-950/30 p-4">
          <p className="text-sm text-red-200">
            {result.errors?.join(", ") ?? "Failed to load workout history."}
          </p>
        </div>
      ) : (
        <HistoryList
          workouts={result.workouts ?? []}
          page={result.page ?? request.page}
          pageSize={result.pageSize ?? request.pageSize}
          total={result.total ?? 0}
          totalPages={result.totalPages ?? 0}
          dateFrom={request.dateFrom}
          dateTo={request.dateTo}
        />
      )}
    </div>
  );
}

