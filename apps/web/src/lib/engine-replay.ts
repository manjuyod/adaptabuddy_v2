import { createHash } from "node:crypto";

export const CANON_REPLAY_CANONICALIZATION_VERSION = "canon-replay-v1";

const utf8KeyCompare = (left: string, right: string): number => {
  return Buffer.from(left, "utf8").compare(Buffer.from(right, "utf8"));
};

const canonicalizeNumber = (value: number): string => {
  if (!Number.isFinite(value)) {
    throw new Error("number must be finite");
  }

  if (Object.is(value, -0)) {
    throw new Error("number -0 is not canonical");
  }

  const text = String(value);
  if (text.includes("e") || text.includes("E") || text === "-0") {
    throw new Error("number is not canonical-serialized");
  }

  return text;
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return Object.prototype.toString.call(value) === "[object Object]";
};

const canonicalizeReplayValue = (value: unknown): string => {
  if (value === null) {
    return "null";
  }

  if (typeof value === "string") {
    return JSON.stringify(value);
  }

  if (typeof value === "number") {
    return canonicalizeNumber(value);
  }

  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }

  if (Array.isArray(value)) {
    return `[${value.map(canonicalizeReplayValue).join(",")}]`;
  }

  if (isRecord(value)) {
    const keys = Object.keys(value).sort(utf8KeyCompare);
    const entries = keys.map((key) => `${JSON.stringify(key)}:${canonicalizeReplayValue((value as Record<string, unknown>)[key])}`);
    return `{${entries.join(",")}}`;
  }

  throw new Error(`unsupported value for canonical replay serialization: ${typeof value}`);
};

export const serializeCanonicalReplayJson = (value: unknown): string => {
  return canonicalizeReplayValue(value);
};

export const computeCanonicalReplayReferenceHash = (
  referenceSnapshot: unknown
): string => {
  const canonical = serializeCanonicalReplayJson(referenceSnapshot);
  const digest = createHash("sha256").update(canonical).digest("hex");
  return `sha256:${digest}`;
};

