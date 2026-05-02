export type LogSeverity = "info" | "warn" | "error";

export type LogReason =
  | "request_completed"
  | "validation_failed"
  | "unauthorized"
  | "rate_limited"
  | "service_error"
  | "unexpected_error"
  | "dependency_error";

export type ServerLogEvent = {
  route: string;
  action: string;
  severity: LogSeverity;
  reason: LogReason;
  requestId?: string | null;
  userId?: string | null;
  statusCode?: number;
  details?: Record<string, unknown>;
  error?: unknown;
};

const getErrorDetails = (error: unknown): Record<string, unknown> | undefined => {
  if (!error) return undefined;

  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  if (typeof error === "object") {
    return { value: error };
  }

  return { value: String(error) };
};

export const logServerEvent = (event: ServerLogEvent) => {
  const shouldEmitLogs =
    process.env.NODE_ENV !== "test" || process.env.ENABLE_TEST_RUNTIME_LOGS === "1";
  if (!shouldEmitLogs) {
    return;
  }

  const payload = {
    timestamp: new Date().toISOString(),
    route: event.route,
    action: event.action,
    severity: event.severity,
    reason: event.reason,
    requestId: event.requestId ?? null,
    userId: event.userId ?? null,
    statusCode: event.statusCode ?? null,
    details: event.details ?? null,
    error: getErrorDetails(event.error) ?? null,
  };

  const message = JSON.stringify(payload);
  if (event.severity === "error") {
    console.error(message);
    return;
  }

  if (event.severity === "warn") {
    console.warn(message);
    return;
  }

  // eslint-disable-next-line no-console
  console.log(message);
};
