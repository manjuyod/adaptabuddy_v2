type TableRow = Record<string, unknown>;
type TableStore = Record<string, TableRow[]>;
type MutationMode = "select" | "update" | "insert" | "delete";
type RpcError = { message: string; code?: string } | null;
type RpcHandlerResult = { data?: unknown; error?: RpcError };
type RpcHandler = (args: Record<string, unknown>, store: TableStore) => RpcHandlerResult | Promise<RpcHandlerResult>;
type MutationFailureConfig = Partial<Record<Exclude<MutationMode, "select">, RpcError>>;
type MutationGuard = (args: {
  table: string;
  mode: Exclude<MutationMode, "select">;
  payload: Record<string, unknown> | Record<string, unknown>[] | null;
  filters: Array<{ type: "eq" | "in"; column: string; value: unknown }>;
  store: TableStore;
}) => RpcError;
type MockSupabaseOptions = {
  queryFailures?: Record<string, RpcError>;
  rpcHandlers?: Record<string, RpcHandler>;
  mutationFailures?: Record<string, MutationFailureConfig>;
  mutationGuards?: Partial<Record<Exclude<MutationMode, "select">, MutationGuard>>;
};

type QueryResponse = {
  data: TableRow[] | TableRow | null;
  error: { message: string; code?: string } | null;
};

const createQueryResponse = (data: TableRow[] | TableRow | null): QueryResponse => ({
  data,
  error: null,
});

export const createMockSupabase = (store: TableStore, options: MockSupabaseOptions = {}) => {
  const queryFailures = options.queryFailures ?? {};
  const mutationFailures = options.mutationFailures ?? {};
  const mutationGuards = options.mutationGuards ?? {};

  return {
    from: (table: string) =>
      createQuery(table, store, queryFailures, mutationFailures, mutationGuards),
    rpc: async (fn: string, args: Record<string, unknown>) => {
      const handler = options.rpcHandlers?.[fn];
      if (!handler) {
        return {
          data: null,
          error: {
            code: "PGRST202",
            message: `Function not found: ${fn}`,
          },
        };
      }
      const result = await handler(args, store);
      return {
        data: result.data ?? null,
        error: result.error ?? null,
      };
    },
  };
};

const createQuery = (
  table: string,
  store: TableStore,
  queryFailures: Record<string, RpcError>,
  mutationFailures: Record<string, MutationFailureConfig>,
  mutationGuards: Partial<Record<Exclude<MutationMode, "select">, MutationGuard>>
) => {
  const filters: Array<{ type: "eq" | "in"; column: string; value: unknown }> = [];
  const orders: Array<{ column: string; ascending: boolean }> = [];
  let mode: MutationMode = "select";
  let updatePayload: Record<string, unknown> | null = null;
  let insertPayload: Record<string, unknown> | Record<string, unknown>[] | null = null;
  let limitCount: number | null = null;
  let returnInsertedRows = false;

  const applyFilters = (rows: TableRow[]) => {
    let result = [...rows];

    for (const filter of filters) {
      if (filter.type === "eq") {
        result = result.filter((row) => row[filter.column] === filter.value);
      } else if (filter.type === "in") {
        const values = Array.isArray(filter.value) ? filter.value : [];
        result = result.filter((row) => values.includes(row[filter.column]));
      }
    }

    return result;
  };

  const applyOrders = (rows: TableRow[]) => {
    const result = [...rows];

    for (const order of orders) {
      result.sort((a, b) => {
        const left = a[order.column];
        const right = b[order.column];
        if (left === right) return 0;
        if (left === undefined || left === null) return order.ascending ? -1 : 1;
        if (right === undefined || right === null) return order.ascending ? 1 : -1;
        if (left < right) return order.ascending ? -1 : 1;
        return order.ascending ? 1 : -1;
      });
    }

    return result;
  };

  const applyLimit = (rows: TableRow[]) => {
    if (limitCount === null) {
      return rows;
    }

    return rows.slice(0, limitCount);
  };

  const getNextNumericId = (rows: TableRow[]) => {
    const maxId = rows.reduce((currentMax, row) => {
      const id = row.id;
      if (typeof id !== "number" || !Number.isFinite(id)) {
        return currentMax;
      }
      return Math.max(currentMax, id);
    }, 0);

    return maxId + 1;
  };

  const exec = (): QueryResponse => {
    const rows = (store[table] ?? []) as TableRow[];
    const queryError = mode === "select" ? queryFailures[table] ?? null : null;
    const failureError =
      mode === "select" ? null : mutationFailures[table]?.[mode];
    if (queryError) {
      return {
        data: null,
        error: queryError,
      };
    }
    if (mode !== "select" && failureError) {
      return {
        data: null,
        error: failureError,
      };
    }

    if (mode !== "select") {
      const guardError = mutationGuards[mode]?.({
        table,
        mode,
        payload: insertPayload ?? updatePayload,
        filters,
        store,
      });
      if (guardError) {
        return {
          data: null,
          error: guardError,
        };
      }
    }

    if (mode === "insert" && insertPayload) {
      const payloadRows = Array.isArray(insertPayload) ? insertPayload : [insertPayload];
      const nextId = getNextNumericId(rows);
      const insertedRows = payloadRows.map((row, index) => {
        if (row.id !== undefined && row.id !== null) {
          return { ...row };
        }
        return {
          ...row,
          id: nextId + index,
        };
      });

      store[table] = [...rows, ...insertedRows];
      if (returnInsertedRows) {
        return createQueryResponse(
          insertedRows.length === 1 ? insertedRows[0] : insertedRows
        );
      }

      return createQueryResponse(null);
    }

    const filteredRows = applyFilters(rows);

    if (mode === "delete") {
      const targetRows = new Set(filteredRows);
      store[table] = rows.filter((row) => !targetRows.has(row));
      return createQueryResponse(filteredRows);
    }

    if (mode === "update" && updatePayload) {
      const targetRows = new Set(filteredRows);
      const updatedRows = filteredRows.map((row) => ({
        ...row,
        ...updatePayload,
      }));

      store[table] = rows.map((row) => {
        if (!targetRows.has(row)) return row;
        return {
          ...row,
          ...updatePayload,
        };
      });

      return createQueryResponse(updatedRows);
    }

    const orderedRows = applyOrders(filteredRows);
    const result = applyLimit(orderedRows);
    return createQueryResponse(result);
  };

  const query = {
    select: (_columns?: string) => {
      if (mode === "insert") {
        returnInsertedRows = true;
      }
      return query;
    },
    eq: (column: string, value: unknown) => {
      filters.push({ type: "eq", column, value });
      return query;
    },
    in: (column: string, value: unknown[]) => {
      filters.push({ type: "in", column, value });
      return query;
    },
    order: (column: string, options?: { ascending?: boolean }) => {
      orders.push({ column, ascending: options?.ascending ?? true });
      return query;
    },
    limit: (count: number) => {
      limitCount = Math.max(0, Math.floor(count));
      return query;
    },
    update: (payload: Record<string, unknown>) => {
      mode = "update";
      updatePayload = payload;
      return query;
    },
    insert: (payload: Record<string, unknown> | Record<string, unknown>[]) => {
      mode = "insert";
      insertPayload = payload;
      return query;
    },
    delete: () => {
      mode = "delete";
      return query;
    },
    single: async () => {
      const response = exec();
      if (Array.isArray(response.data)) {
        if (response.data.length !== 1) {
          return {
            data: null,
            error: {
              code: "PGRST116",
              message: "JSON object requested, multiple (or no) rows returned",
            },
          };
        }
        return createQueryResponse(response.data[0]);
      }
      return response;
    },
    maybeSingle: async () => {
      const response = exec();
      if (Array.isArray(response.data)) {
        if (response.data.length > 1) {
          return {
            data: null,
            error: {
              code: "PGRST116",
              message: "JSON object requested, multiple rows returned",
            },
          };
        }
        return createQueryResponse(response.data[0] ?? null);
      }
      return response;
    },
    then: (resolve: (value: QueryResponse) => void, reject: (reason?: unknown) => void) =>
      Promise.resolve(exec()).then(resolve, reject),
  };

  return query;
};
