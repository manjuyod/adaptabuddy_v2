import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";
import type { CookieOptions } from "@supabase/ssr";
import { rateLimit } from "@/lib/security/rateLimit";
import { getClient } from "@/lib/supabase/server";
import { applySecurityHeaders } from "@/lib/security/headers";
import { attachRequestIdHeader, resolveRequestId } from "@/lib/observability/requestId";
import { logServerEvent } from "@/lib/observability/logger";

type ParseSuccess<T> = { success: true; data: T };
type ParseFailure = { success: false; errors: string[]; status?: number };

export type ParseResult<T> = ParseSuccess<T> | ParseFailure;

export type SchemaLike<T> = {
  safeParse: (
    input: unknown
  ) =>
    | { success: true; data: T }
    | {
        success: false;
        error: {
          errors: Array<{ message: string }>;
        };
      };
};

const toIp = (value: string | null) => {
  if (!value) return "unknown";
  const first = value.split(",")[0]?.trim();
  return first && first.length > 0 ? first : "unknown";
};

const defaultRateLimitBody = { status: "error", errors: ["Rate limit exceeded"] };
const defaultUnauthorizedBody = { status: "error", errors: ["Unauthorized"] };
const defaultUnexpectedBody = { status: "error", errors: ["An unexpected error occurred"] };

const finalizeResponse = (
  response: NextResponse,
  requestId: string,
  extraHeaders?: Record<string, string>
) => {
  const secured = applySecurityHeaders(response);
  attachRequestIdHeader(secured, requestId);

  if (extraHeaders) {
    Object.entries(extraHeaders).forEach(([key, value]) => {
      secured.headers.set(key, value);
    });
  }

  return secured;
};

export const jsonResponse = (
  body: unknown,
  status: number,
  requestId: string,
  extraHeaders?: Record<string, string>
) => {
  const response = NextResponse.json(body, { status });
  return finalizeResponse(response, requestId, extraHeaders);
};

type AuthMode = "user" | "session";

type RouteExecutionArgs<TInput, TContext> = {
  input: TInput;
  userId: string;
  requestId: string;
  request: Request;
  context: TContext;
};

type RouteConfig<TInput, TResult, TContext> = {
  route: string;
  action: string;
  rateLimit: {
    keyPrefix: string;
    limit: number;
    windowMs: number;
  };
  parseInput: (request: Request, context: TContext) => Promise<ParseResult<TInput>> | ParseResult<TInput>;
  execute: (args: RouteExecutionArgs<TInput, TContext>) => Promise<TResult> | TResult;
  authMode?: AuthMode;
  requireAuth?: boolean;
  successStatus?: number;
  mapServiceErrorStatus?: (result: TResult) => number;
  isServiceError?: (result: TResult) => boolean;
  rateLimitBody?: unknown;
  unauthorizedBody?: unknown;
  validationErrorBody?: (errors: string[]) => unknown;
  unexpectedErrorBody?: unknown;
  serviceErrorBody?: (result: TResult) => unknown;
  successBody?: (result: TResult) => unknown;
  extraHeaders?: Record<string, string>;
};

const defaultServiceErrorDetector = <TResult,>(result: TResult) => {
  if (!result || typeof result !== "object") return false;
  const value = result as Record<string, unknown>;
  return value.status === "error";
};

const defaultValidationBody = (errors: string[]) => ({ status: "error", errors });

const normalizeCookieOptions = (options: CookieOptions) => {
  const normalized: Record<string, string | number | boolean | Date> = {};
  for (const [key, value] of Object.entries(options)) {
    if (value == null) continue;
    normalized[key] = value as string | number | boolean | Date;
  }
  return normalized;
};

export async function runAuthedRoute<TInput, TResult, TContext = undefined>(
  request: Request,
  config: RouteConfig<TInput, TResult, TContext>,
  context: TContext
): Promise<NextResponse> {
  const headerStore = await headers();
  const requestId = resolveRequestId(headerStore.get("x-request-id"));
  const ip = toIp(headerStore.get("x-forwarded-for"));
  const limitKey = `${config.rateLimit.keyPrefix}:${ip}`;

  const limit = await rateLimit(limitKey, config.rateLimit.limit, config.rateLimit.windowMs);
  if (!limit.success) {
    logServerEvent({
      route: config.route,
      action: config.action,
      severity: "warn",
      reason: "rate_limited",
      requestId,
      statusCode: 429,
      details: {
        limitKey,
        remaining: limit.remaining,
        resetAt: new Date(limit.resetAt).toISOString(),
        source: limit.source,
      },
    });

    return jsonResponse(
      config.rateLimitBody ?? defaultRateLimitBody,
      429,
      requestId,
      config.extraHeaders
    );
  }

  const cookieStore = await cookies();
  const supabase = getClient({
    get: (name: string) => cookieStore.get(name),
    set: (name: string, value: string, options: CookieOptions) =>
      cookieStore.set({ name, value, ...normalizeCookieOptions(options) }),
    delete: (name: string, options: CookieOptions) =>
      cookieStore.delete({ name, ...normalizeCookieOptions(options) }),
  });

  let userId: string | null = null;
  if (config.requireAuth ?? true) {
    if (config.authMode === "session") {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      userId = session?.user?.id ?? null;
    } else {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        logServerEvent({
          route: config.route,
          action: config.action,
          severity: "warn",
          reason: "unauthorized",
          requestId,
          statusCode: 401,
        });

        return jsonResponse(
          config.unauthorizedBody ?? defaultUnauthorizedBody,
          401,
          requestId,
          config.extraHeaders
        );
      }

      userId = user.id;
    }

    if (!userId) {
      logServerEvent({
        route: config.route,
        action: config.action,
        severity: "warn",
        reason: "unauthorized",
        requestId,
        statusCode: 401,
      });

      return jsonResponse(
        config.unauthorizedBody ?? defaultUnauthorizedBody,
        401,
        requestId,
        config.extraHeaders
      );
    }
  }

  const parseResult = await config.parseInput(request, context);
  if (!parseResult.success) {
    const status = parseResult.status ?? 400;
    logServerEvent({
      route: config.route,
      action: config.action,
      severity: "warn",
      reason: "validation_failed",
      requestId,
      userId,
      statusCode: status,
      details: {
        errors: parseResult.errors,
      },
    });

    return jsonResponse(
      config.validationErrorBody?.(parseResult.errors) ?? defaultValidationBody(parseResult.errors),
      status,
      requestId,
      config.extraHeaders
    );
  }

  try {
    const result = await config.execute({
      input: parseResult.data,
      userId: userId ?? "",
      requestId,
      request,
      context,
    });

    const isServiceError = config.isServiceError?.(result) ?? defaultServiceErrorDetector(result);

    if (isServiceError) {
      const status = config.mapServiceErrorStatus?.(result) ?? 400;
      logServerEvent({
        route: config.route,
        action: config.action,
        severity: "warn",
        reason: "service_error",
        requestId,
        userId,
        statusCode: status,
      });

      return jsonResponse(
        config.serviceErrorBody?.(result) ?? result,
        status,
        requestId,
        config.extraHeaders
      );
    }

    const successStatus = config.successStatus ?? 200;
    logServerEvent({
      route: config.route,
      action: config.action,
      severity: "info",
      reason: "request_completed",
      requestId,
      userId,
      statusCode: successStatus,
    });

    return jsonResponse(
      config.successBody?.(result) ?? result,
      successStatus,
      requestId,
      config.extraHeaders
    );
  } catch (error) {
    logServerEvent({
      route: config.route,
      action: config.action,
      severity: "error",
      reason: "unexpected_error",
      requestId,
      userId,
      statusCode: 500,
      error,
    });

    return jsonResponse(
      config.unexpectedErrorBody ?? defaultUnexpectedBody,
      500,
      requestId,
      config.extraHeaders
    );
  }
}

export async function parseJsonWithSchema<T>(
  request: Request,
  schema: SchemaLike<T>
): Promise<ParseResult<T>> {
  const body = await request.json().catch(() => ({}));
  return parseWithSchema(body, schema);
}

export function parseWithSchema<T>(input: unknown, schema: SchemaLike<T>): ParseResult<T> {
  const parseResult = schema.safeParse(input);
  if (!parseResult.success) {
    return {
      success: false,
      errors: parseResult.error.errors.map((error) => error.message),
    };
  }

  return {
    success: true,
    data: parseResult.data,
  };
}
