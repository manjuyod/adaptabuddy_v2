"use client";

import * as React from "react";
import type {
  BetaFeedbackBoundaryArea,
  BetaFeedbackCategory,
  BetaFeedbackSeverity,
  BetaFeedbackSubmitResponse,
} from "@adaptabuddy/contracts";

type FormErrors = {
  category?: string;
  boundaryArea?: string;
  severity?: string;
  title?: string;
  summary?: string;
};

type FeedbackPayload = {
  category: BetaFeedbackCategory;
  boundaryArea: BetaFeedbackBoundaryArea;
  severity: BetaFeedbackSeverity;
  title: string;
  summary: string;
  currentRoute?: string;
  diagnosticConsent: boolean;
  clientContext?: {
    viewportWidth: number;
    viewportHeight: number;
    online: boolean;
    userAgent: string;
  };
};

const CATEGORY_OPTIONS: Array<{ value: BetaFeedbackCategory; label: string }> = [
  { value: "bug", label: "Bug" },
  { value: "workflow_pain", label: "Workflow pain" },
  { value: "confusing_copy", label: "Confusing copy" },
  { value: "performance", label: "Performance issue" },
  { value: "other", label: "Other" },
];

const BOUNDARY_OPTIONS: Array<{ value: BetaFeedbackBoundaryArea; label: string }> = [
  { value: "app-shell", label: "App shell" },
  { value: "adapter-contract", label: "Adapter contract" },
  { value: "persistence-rls", label: "Persistence / RLS" },
  { value: "telemetry-read-model", label: "Telemetry / read model" },
  { value: "replay-debuggability", label: "Replay / debuggability" },
  { value: "deterministic-engine-behavior", label: "Deterministic engine behavior" },
  { value: "product-copy", label: "Product copy" },
  { value: "unknown", label: "Unknown" },
];

const SEVERITY_OPTIONS: Array<{ value: BetaFeedbackSeverity; label: string }> = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
];

export function BetaFeedbackPanel() {
  const [category, setCategory] = React.useState<BetaFeedbackCategory | "">("");
  const [boundaryArea, setBoundaryArea] = React.useState<BetaFeedbackBoundaryArea | "">("");
  const [severity, setSeverity] = React.useState<BetaFeedbackSeverity | "">("");
  const [title, setTitle] = React.useState("");
  const [summary, setSummary] = React.useState("");
  const [diagnosticConsent, setDiagnosticConsent] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [formErrors, setFormErrors] = React.useState<FormErrors>({});
  const [status, setStatus] = React.useState<"idle" | "success" | "error">("idle");
  const [message, setMessage] = React.useState("");

  const resetSubmitState = () => {
    setFormErrors({});
    setMessage("");
    setStatus("idle");
  };

  const getClientContext = () => ({
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    online: navigator.onLine,
    userAgent: navigator.userAgent,
  });

  const validate = () => {
    const nextErrors: FormErrors = {};

    if (!category) {
      nextErrors.category = "Please select a category.";
    }

    if (!boundaryArea) {
      nextErrors.boundaryArea = "Please select a boundary area.";
    }

    if (!severity) {
      nextErrors.severity = "Please select a severity level.";
    }

    if (!title.trim()) {
      nextErrors.title = "Please provide a title.";
    }

    if (!summary.trim()) {
      nextErrors.summary = "Please provide a summary.";
    }

    setFormErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    resetSubmitState();

    if (!validate()) {
      setStatus("error");
      setMessage("");
      return;
    }

    setIsSubmitting(true);

    try {
      const payload: FeedbackPayload = {
        category,
        boundaryArea,
        severity,
        title: title.trim(),
        summary: summary.trim(),
        diagnosticConsent,
        ...(diagnosticConsent
          ? {
              currentRoute: window.location.pathname,
              clientContext: getClientContext(),
            }
          : {}),
      } as FeedbackPayload;

      const response = await fetch("/api/v0/support/feedback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as BetaFeedbackSubmitResponse;

      if (!response.ok || data.status === "error") {
        setStatus("error");
        setMessage(data.status === "error" ? data.errors.join(", ") : "Failed to submit feedback");
        return;
      }

      setStatus("success");
      setMessage(
        `Feedback submitted successfully. Report ID: ${data.reportId}`
      );
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Failed to submit feedback");
    } finally {
      setIsSubmitting(false);
    }
  };

  const hasErrors = Object.keys(formErrors).length > 0;

  return (
    <form className="space-y-4" onSubmit={handleSubmit} aria-label="Beta feedback form">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-amber-400">Beta Feedback</p>
        <h2 className="mt-2 text-lg font-semibold text-slate-100">Support Feedback</h2>
        <p className="mt-1 text-sm text-slate-400">
          Share reproducible issues, suggestions, or friction points while we collect private beta signal.
        </p>
      </div>

      <label className="flex flex-col gap-2 text-sm text-slate-200" htmlFor="beta-feedback-category">
        <span className="font-semibold">Category</span>
        <select
          id="beta-feedback-category"
          value={category}
          onChange={(event) => setCategory(event.target.value as BetaFeedbackCategory | "")}
          className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200"
          data-testid="beta-feedback-category"
        >
          <option value="">Select a category</option>
          {CATEGORY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-2 text-sm text-slate-200" htmlFor="beta-feedback-boundary-area">
        <span className="font-semibold">Boundary Area</span>
        <select
          id="beta-feedback-boundary-area"
          value={boundaryArea}
          onChange={(event) => setBoundaryArea(event.target.value as BetaFeedbackBoundaryArea | "")}
          className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200"
          data-testid="beta-feedback-boundary-area"
        >
          <option value="">Select a boundary area</option>
          {BOUNDARY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-2 text-sm text-slate-200" htmlFor="beta-feedback-severity">
        <span className="font-semibold">Severity</span>
        <select
          id="beta-feedback-severity"
          value={severity}
          onChange={(event) => setSeverity(event.target.value as BetaFeedbackSeverity | "")}
          className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200"
          data-testid="beta-feedback-severity"
        >
          <option value="">Select severity</option>
          {SEVERITY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-2 text-sm text-slate-200" htmlFor="beta-feedback-title">
        <span className="font-semibold">Title</span>
        <input
          id="beta-feedback-title"
          type="text"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Short title"
          className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200"
          data-testid="beta-feedback-title"
        />
      </label>

      <label className="flex flex-col gap-2 text-sm text-slate-200" htmlFor="beta-feedback-summary">
        <span className="font-semibold">Summary</span>
        <textarea
          id="beta-feedback-summary"
          value={summary}
          onChange={(event) => setSummary(event.target.value)}
          rows={5}
          placeholder="Describe the issue, including what you observed and when it occurred"
          className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200"
          data-testid="beta-feedback-summary"
        />
      </label>

      <label className="flex items-start gap-3 text-sm text-slate-200">
        <input
          type="checkbox"
          id="beta-feedback-diagnostic-consent"
          checked={diagnosticConsent}
          onChange={(event) => setDiagnosticConsent(event.target.checked)}
          className="mt-1 h-4 w-4 rounded border-slate-600 bg-slate-950"
          data-testid="beta-feedback-diagnostic-consent"
        />
        <span>
          <span className="block font-semibold">Share diagnostic context</span>
          <span className="text-xs text-slate-400">
            Includes current route, viewport size, online status, and userAgent.
          </span>
        </span>
      </label>

      {hasErrors ? (
        <div className="rounded-md border border-red-700 bg-red-950/30 p-3 text-sm text-red-200" role="alert">
          <p className="font-semibold">Please fix the following:</p>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            {formErrors.category ? <li>{formErrors.category}</li> : null}
            {formErrors.boundaryArea ? <li>{formErrors.boundaryArea}</li> : null}
            {formErrors.severity ? <li>{formErrors.severity}</li> : null}
            {formErrors.title ? <li>{formErrors.title}</li> : null}
            {formErrors.summary ? <li>{formErrors.summary}</li> : null}
          </ul>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={isSubmitting || status === "success"}
          className="rounded-md bg-amber-500 px-5 py-2 text-sm font-semibold text-slate-900 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-300"
          data-testid="beta-feedback-submit"
        >
          {isSubmitting ? "Submitting..." : status === "success" ? "Submitted" : "Submit Feedback"}
        </button>
        {message ? (
          <p
            className={`text-sm ${status === "error" ? "text-red-400" : "text-emerald-300"}`}
            role={status === "error" ? "alert" : "status"}
            data-testid="beta-feedback-message"
          >
            {message}
          </p>
        ) : null}
      </div>
    </form>
  );
}
