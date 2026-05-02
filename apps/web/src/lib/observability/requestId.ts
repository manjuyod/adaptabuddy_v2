import { randomUUID } from "crypto";
import type { NextResponse } from "next/server";

export const REQUEST_ID_HEADER = "x-request-id";

const normalizeRequestId = (value: string | null | undefined): string | null => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, 200);
};

export const resolveRequestId = (value: string | null | undefined): string => {
  return normalizeRequestId(value) ?? randomUUID();
};

export const attachRequestIdHeader = <T extends NextResponse>(
  response: T,
  requestId: string
): T => {
  response.headers.set(REQUEST_ID_HEADER, requestId);
  return response;
};
