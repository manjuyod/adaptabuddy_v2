import { createSupabaseServerActionClient } from "@/lib/supabase/next";
import type {
  BetaFeedbackClientContext,
  BetaFeedbackSubmitRequest,
  BetaFeedbackSubmitResponse,
} from "./contracts";

type BetaFeedbackRow = {
  id: number;
  current_route: string | null;
  request_id: string | null;
  replay_reference: Record<string, unknown>;
  client_context: Record<string, unknown>;
};

const sanitizeClientContext = (
  value: BetaFeedbackClientContext | undefined | null
): Record<string, unknown> => {
  if (value === undefined || value === null) {
    return {};
  }

  const sanitized: Record<string, unknown> = {};
  if (typeof value.viewportWidth === "number") {
    sanitized.viewportWidth = value.viewportWidth;
  }
  if (typeof value.viewportHeight === "number") {
    sanitized.viewportHeight = value.viewportHeight;
  }
  if (typeof value.online === "boolean") {
    sanitized.online = value.online;
  }
  if (typeof value.userAgent === "string") {
    sanitized.userAgent = value.userAgent;
  }

  return sanitized;
};

const normalizeReplayReference = (
  value: Record<string, unknown> | undefined
): Record<string, unknown> => {
  if (value === undefined) {
    return {};
  }
  return value;
};

export async function submitBetaFeedback(
  userId: string,
  input: BetaFeedbackSubmitRequest,
  requestId: string
): Promise<BetaFeedbackSubmitResponse> {
  const supabase = await createSupabaseServerActionClient();

  const shouldPersistContext = input.diagnosticConsent === true;
  const normalizedReplayReference = shouldPersistContext
    ? normalizeReplayReference(input.replayReference)
    : {};
  const sanitizedContext = shouldPersistContext
    ? sanitizeClientContext(input.clientContext)
    : {};

  const { data, error } = await supabase
    .from("beta_feedback_reports")
    .insert({
      user_id: userId,
      category: input.category,
      boundary_area: input.boundaryArea,
      severity: input.severity,
      title: input.title,
      summary: input.summary,
      status: "open",
      current_route: shouldPersistContext ? input.currentRoute ?? null : null,
      request_id: requestId,
      replay_reference: normalizedReplayReference,
      client_context: sanitizedContext,
    })
    .select("id, current_route, request_id, replay_reference, client_context")
    .single();

  if (error || !data) {
    return {
      status: "error",
      errors: ["Failed to submit feedback"],
    };
  }

  const row = data as BetaFeedbackRow;
  return {
    status: "success",
    reportId: row.id,
  };
}
