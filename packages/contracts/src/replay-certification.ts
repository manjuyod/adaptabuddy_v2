import { createHash } from "node:crypto";

export type ReplayOperation = "initialize_cycle" | "plan_session" | "complete_session" | "advance_cycle";

const ACCEPTED_CANONICALIZATION_VERSIONS = ["canon-replay-v1", "canon-v1"] as const;
const CANONICALIZATION_POLICY_VERSION = "canon-replay-v1";
const HASH_PREFIX = "sha256:";

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonArray | JsonObject;
type JsonArray = Array<JsonValue>;
type JsonObject = { [key: string]: JsonValue };

export type ReplayDeterminism = {
  seed: string;
  effectiveAt: string;
  ruleVersion: string;
  referenceHash: string;
  canonicalizationVersion: string;
};

export type ReplayInputManifest = {
  schemaVersion: string;
  operation: ReplayOperation;
  determinism: ReplayDeterminism;
  referenceSnapshot: JsonObject;
  stateSnapshot: JsonObject;
  policySnapshot: JsonObject;
  request: JsonValue;
  metadata: JsonValue;
};

export type ReplayOutputManifest = {
  schemaVersion: string;
  operation: ReplayOperation;
  result: JsonObject;
  statePatch: JsonObject;
  events: JsonArray;
  decisionLog: JsonArray;
  replayReceipt: JsonObject;
};

export type ReplayManifest = {
  fixtureId?: string;
  fixtureClass?: string;
  description?: string;
  certificationMetadata?: JsonObject;
  input: ReplayInputManifest;
  output: ReplayOutputManifest;
  expected: {
    inputHash: string;
    outputHash: string;
    referenceHash: string;
  };
};

export type ReplayNegativeFixture = {
  fixtureId: string;
  expectedFailureKind: ReplayFailureKind;
  input: ReplayInputManifest;
  description?: string;
};

export type ReplayCertificationBundle = {
  manifestVersion: string;
  canonicalizationVersion: string;
  hashAlgorithm: "sha256";
  hashFormat: "sha256:<lowercase-hex>";
  fixtures: ReplayManifest[];
  negativeFixtures?: ReplayNegativeFixture[];
};

export type ReplayManifestVerificationResult = {
  referenceHash: string;
  inputHash: string;
  outputHash: string;
};

export type ReplayFailureKind =
  | "unsupported_canonicalization_version"
  | "bundle_contract_mismatch"
  | "reference_hash_mismatch"
  | "invalid_numeric_material"
  | "metadata_only_stability_mismatch"
  | "hash_mismatch";

export abstract class ReplayCertificationFailure extends Error {
  public readonly kind: ReplayFailureKind;

  protected constructor(kind: ReplayFailureKind, message: string) {
    super(message);
    this.kind = kind;
  }
}

export class UnsupportedCanonicalizationVersionError extends ReplayCertificationFailure {
  public readonly provided: string;

  public constructor(provided: string) {
    super(
      "unsupported_canonicalization_version",
      `unsupported canonicalization version: ${provided}`
    );
    this.provided = provided;
  }
}

export class BundleContractMismatchError extends ReplayCertificationFailure {
  public readonly path: string;
  public readonly expected: string;
  public readonly actual: unknown;

  public constructor(path: string, expected: string, actual: unknown) {
    super(
      "bundle_contract_mismatch",
      `${path} mismatch: expected ${expected}, found ${String(actual)}`
    );
    this.path = path;
    this.expected = expected;
    this.actual = actual;
  }
}

export class ReferenceHashMismatchError extends ReplayCertificationFailure {
  public readonly expected: string;
  public readonly actual: string;

  public constructor(expected: string, actual: string) {
    super(
      "reference_hash_mismatch",
      `referenceHash mismatch: expected ${expected}, computed ${actual}`
    );
    this.expected = expected;
    this.actual = actual;
  }
}

export class InvalidNumericMaterialError extends ReplayCertificationFailure {
  public readonly path: string;
  public readonly value: unknown;

  public constructor(path: string, value: unknown, detail: string) {
    super("invalid_numeric_material", `${path}: ${detail}`);
    this.path = path;
    this.value = value;
  }
}

export class MetadataOnlyStabilityMismatchError extends ReplayCertificationFailure {
  public readonly baselineHash: string;
  public readonly variantHash: string;

  public constructor(baselineHash: string, variantHash: string) {
    super(
      "metadata_only_stability_mismatch",
      `metadata-only input stability failed: baseline ${baselineHash} vs variant ${variantHash}`
    );
    this.baselineHash = baselineHash;
    this.variantHash = variantHash;
  }
}

export class HashMismatchError extends ReplayCertificationFailure {
  public readonly path: "inputHash" | "outputHash" | "referenceHash";
  public readonly expected: string;
  public readonly actual: string;

  public constructor(path: "inputHash" | "outputHash" | "referenceHash", expected: string, actual: string) {
    super("hash_mismatch", `${path} mismatch: expected ${expected}, computed ${actual}`);
    this.path = path;
    this.expected = expected;
    this.actual = actual;
  }
}

const isObject = (value: unknown): value is JsonObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const assertSupportedCanonicalizationVersion = (value: string): void => {
  if (!ACCEPTED_CANONICALIZATION_VERSIONS.includes(value as never)) {
    throw new UnsupportedCanonicalizationVersionError(value);
  }
};

const validateNumericScale = (value: number, scale: number, path: string): void => {
  if (!Number.isFinite(value)) {
    throw new InvalidNumericMaterialError(path, value, "must be finite");
  }
  if (Object.is(value, -0)) {
    throw new InvalidNumericMaterialError(path, value, "negative zero is not allowed");
  }
  const scaled = value * scale;
  if (Math.abs(scaled - Math.round(scaled)) > 1e-9) {
    throw new InvalidNumericMaterialError(path, value, `must fit fixed-point scale factor ${scale}`);
  }
};

const validatePolicySnapshot = (policySnapshot: JsonObject): void => {
  const classArchetypeBias = policySnapshot["classArchetypeBias"];
  if (typeof classArchetypeBias !== "number") {
    throw new InvalidNumericMaterialError(
      "policySnapshot.classArchetypeBias",
      classArchetypeBias,
      "must be a number"
    );
  }
  validateNumericScale(classArchetypeBias, 10_000, "policySnapshot.classArchetypeBias");
  if (classArchetypeBias < 0 || classArchetypeBias > 0.15) {
    throw new InvalidNumericMaterialError(
      "policySnapshot.classArchetypeBias",
      classArchetypeBias,
      "must be between 0 and 0.15"
    );
  }

  const seededTieBreakBand = policySnapshot["seededTieBreakBand"];
  if (typeof seededTieBreakBand !== "number") {
    throw new InvalidNumericMaterialError(
      "policySnapshot.seededTieBreakBand",
      seededTieBreakBand,
      "must be a number"
    );
  }
  validateNumericScale(seededTieBreakBand, 100, "policySnapshot.seededTieBreakBand");
  if (seededTieBreakBand < 0 || seededTieBreakBand > 1) {
    throw new InvalidNumericMaterialError(
      "policySnapshot.seededTieBreakBand",
      seededTieBreakBand,
      "must be between 0 and 1"
    );
  }
};

const validateWeightPath = (
  current: unknown,
  remainingPath: string[],
  originalPath: string
): void => {
  if (remainingPath.length === 0) {
    if (typeof current !== "number") {
      throw new InvalidNumericMaterialError(originalPath, current, "must be a number");
    }
    validateNumericScale(current, 100, originalPath);
    if (current < 0) {
      throw new InvalidNumericMaterialError(
        originalPath,
        current,
        "must be non-negative"
      );
    }
    return;
  }

  const [head, ...tail] = remainingPath;
  if (head === "*") {
    if (Array.isArray(current)) {
      for (const item of current) {
        validateWeightPath(item, tail, originalPath);
      }
      return;
    }
    if (isObject(current)) {
      for (const value of Object.values(current)) {
        validateWeightPath(value, tail, originalPath);
      }
      return;
    }
    throw new InvalidNumericMaterialError(
      originalPath,
      current,
      "must be an array or object at wildcard segment"
    );
  }

  if (isObject(current)) {
    if (Object.prototype.hasOwnProperty.call(current, head)) {
      validateWeightPath(current[head], tail, originalPath);
    }
    return;
  }

  if (current !== undefined) {
    throw new InvalidNumericMaterialError(
      originalPath,
      current,
      "must be an object while traversing numeric material"
    );
  }
};

const validateStateSnapshotNumericPolicy = (stateSnapshot: JsonObject): void => {
  for (const path of [
    ["athleteProfile", "weight"],
    ["performanceState", "knownLifts", "*", "estimated1RM"],
    ["performanceState", "knownLifts", "*", "lastWeight"],
    ["progressionState", "records", "*", "previousPerformanceReference", "weight"],
  ]) {
    validateWeightPath(stateSnapshot, path, path.join("."));
  }
};

const validateRequestNumericPolicy = (input: ReplayInputManifest): void => {
  if (input.operation === "initialize_cycle") {
    validateInitializeCycleRequestNumericPolicy(input);
  }

  if (input.operation !== "complete_session") {
    return;
  }

  const request = input.request;
  if (!isObject(request)) {
    return;
  }
  const session = request.session;
  if (!isObject(session) || !Array.isArray(session.exercises)) {
    return;
  }
  for (const exercise of session.exercises) {
    if (!isObject(exercise)) continue;
    const sets = exercise.sets;
    if (!Array.isArray(sets)) continue;
    sets.forEach((set, setIndex) => {
      if (!isObject(set)) return;
      const weight = set.weight;
      if (weight === undefined) return;
      const path = `request.session.exercises[].sets[${setIndex}].weight`;
      if (typeof weight !== "number") {
        throw new InvalidNumericMaterialError(path, weight, "must be a number");
      }
      validateNumericScale(weight, 100, path);
      if (weight < 0) {
        throw new InvalidNumericMaterialError(path, weight, "must be non-negative");
      }
    });
  }
};

const validateInitializeCycleRequestNumericPolicy = (input: ReplayInputManifest): void => {
  const request = input.request;
  if (!isObject(request)) return;

  const selectedPrograms = request.selectedPrograms;
  if (!Array.isArray(selectedPrograms)) return;

  selectedPrograms.forEach((program, programIndex) => {
    if (!isObject(program)) return;

    const weight = program.weight;
    const weightPath = `request.selectedPrograms[${programIndex}].weight`;
    if (typeof weight !== "number") {
      throw new InvalidNumericMaterialError(weightPath, weight, "must be a number");
    }
    validateNumericScale(weight, 10_000, weightPath);
    if (weight <= 0 || weight > 1) {
      throw new InvalidNumericMaterialError(weightPath, weight, "must be > 0 and <= 1");
    }

    const days = program.days;
    if (!Array.isArray(days)) return;
    days.forEach((day, dayIndex) => {
      if (!isObject(day)) return;
      const slots = day.slots;
      if (!Array.isArray(slots)) return;
      slots.forEach((slot, slotIndex) => {
        if (!isObject(slot) || !isObject(slot.muscleTargets)) return;
        for (const [muscle, target] of Object.entries(slot.muscleTargets)) {
          const targetPath =
            `request.selectedPrograms[${programIndex}].days[${dayIndex}]` +
            `.slots[${slotIndex}].muscleTargets.${muscle}`;
          if (typeof target !== "number") {
            throw new InvalidNumericMaterialError(targetPath, target, "must be a number");
          }
          validateNumericScale(target, 10_000, targetPath);
          if (target < 0) {
            throw new InvalidNumericMaterialError(targetPath, target, "must be non-negative");
          }
        }
      });
    });
  });
};

const validateOutputNumericPolicy = (output: ReplayOutputManifest): void => {
  validateScoreBreakdown(output.result.scoreBreakdown, "output.result.scoreBreakdown");
  validateProgramBlend(output.result.programBlend, "output.result.programBlend");
  validateKnownNumericOutputMaterial(output.statePatch, "output.statePatch");
  validateKnownNumericOutputMaterial(output.events, "output.events");

  output.decisionLog.forEach((entry, index) => {
    if (!isObject(entry)) return;
    validateMaybeScore2(entry.computedValue, `output.decisionLog[${index}].computedValue`);
    if (isObject(entry.details)) {
      validateScoreBreakdown(
        entry.details.breakdown,
        `output.decisionLog[${index}].details.breakdown`
      );
      validateMaybeScore2(entry.details.bandWidth, `output.decisionLog[${index}].details.bandWidth`);
      validateMaybeScore2(entry.details.topScore, `output.decisionLog[${index}].details.topScore`);
    }
  });
};

const integerFieldNames = new Set([
  "xp",
  "level",
  "adherenceStreak",
  "completedSessionCount",
  "missedSessionCount",
  "consecutiveSuccessfulCompletions",
  "consecutiveStallOrRegressionCount",
  "swapRecommendationCount",
  "reps",
  "setIndex",
  "slotIndex",
  "dayIndex",
  "sessionIndex",
  "macroWeek",
  "mesocycleIndex",
  "microcycleIndex",
  "plannedDayOfWeek",
  "totalWeeks",
  "mesocycleCount",
  "currentMesocycleIndex",
  "currentMicrocycleIndex",
  "currentSessionIndex",
]);

const kgCentFieldNames = new Set(["weight", "lastSuccessfulLoad", "estimated1RM", "lastWeight"]);
const ratio4FieldNames = new Set(["weight"]);

const validateKnownNumericOutputMaterial = (value: unknown, path: string): void => {
  if (Array.isArray(value)) {
    value.forEach((item, index) => validateKnownNumericOutputMaterial(item, `${path}[${index}]`));
    return;
  }

  if (!isObject(value)) return;

  for (const [key, child] of Object.entries(value)) {
    const childPath = `${path}.${key}`;
    if (typeof child === "number") {
      if (integerFieldNames.has(key)) {
        if (!Number.isInteger(child) || child < 0) {
          throw new InvalidNumericMaterialError(childPath, child, "must be a non-negative integer");
        }
        continue;
      }
      if (kgCentFieldNames.has(key)) {
        validateNumericScale(child, 100, childPath);
        continue;
      }
      if (path.endsWith(".programBlend") && ratio4FieldNames.has(key)) {
        validateNumericScale(child, 10_000, childPath);
        continue;
      }
      validateMaybeScore2(child, childPath);
      continue;
    }
    validateKnownNumericOutputMaterial(child, childPath);
  }
};

const validateMaybeScore2 = (value: unknown, path: string): void => {
  if (value === undefined || value === null) return;
  if (typeof value !== "number") {
    throw new InvalidNumericMaterialError(path, value, "must be a number");
  }
  validateNumericScale(value, 100, path);
};

const validateScoreBreakdown = (value: unknown, path: string): void => {
  if (!isObject(value)) return;
  for (const [key, score] of Object.entries(value)) {
    validateMaybeScore2(score, `${path}.${key}`);
  }
};

const validateProgramBlend = (value: unknown, path: string): void => {
  if (!Array.isArray(value)) return;
  value.forEach((entry, index) => {
    if (!isObject(entry)) return;
    const weight = entry.weight;
    if (typeof weight !== "number") {
      throw new InvalidNumericMaterialError(`${path}[${index}].weight`, weight, "must be a number");
    }
    validateNumericScale(weight, 10_000, `${path}[${index}].weight`);
  });
};

const sortObjectKeys = (value: JsonObject): JsonObject => {
  const keys = Object.keys(value).sort((left, right) => {
    const leftBytes = new TextEncoder().encode(left);
    const rightBytes = new TextEncoder().encode(right);
    const maxIndex = Math.min(leftBytes.length, rightBytes.length);
    for (let index = 0; index < maxIndex; index += 1) {
      if (leftBytes[index] !== rightBytes[index]) {
        return leftBytes[index] - rightBytes[index];
      }
    }
    return leftBytes.length - rightBytes.length;
  });

  const result: JsonObject = {};
  for (const key of keys) {
    const child = value[key];
    result[key] = child;
  }
  return result;
};

const canonicalJson = (value: unknown, path = "$"): string => {
  if (value === null) return "null";

  if (Array.isArray(value)) {
    return `[${value.map((item, index) => canonicalJson(item, `${path}[${index}]`)).join(",")}]`;
  }

  if (isObject(value)) {
    const sortedEntries = sortObjectKeys(value);
    return `{${Object.entries(sortedEntries)
      .map(([key, childValue]) => `${JSON.stringify(key)}:${canonicalJson(childValue, `${path}.${key}`)}`)
      .join(",")}}`;
  }

  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new InvalidNumericMaterialError(path, value, "must be finite");
    }
    if (Object.is(value, -0)) {
      throw new InvalidNumericMaterialError(path, value, "negative zero is invalid");
    }
    const rendered = value.toString();
    if (rendered.includes("e") || rendered.includes("E")) {
      throw new InvalidNumericMaterialError(path, value, "scientific notation is invalid");
    }
    return rendered;
  }

  throw new InvalidNumericMaterialError(path, value, "unsupported value type");
};

const hashValue = (value: unknown, path = "$"): string => {
  const bytes = canonicalJson(value, path);
  const digest = createHash("sha256").update(bytes, "utf8").digest("hex");
  return `${HASH_PREFIX}${digest}`;
};

const cloneValue = <T>(value: T): T => JSON.parse(JSON.stringify(value));

const normalizeRecentCompletions = (stateSnapshot: JsonObject): JsonObject => {
  const normalized = cloneValue(stateSnapshot);
  if (!isObject(normalized)) return normalized;

  const recentCompletions = normalized.recentCompletions;
  if (!Array.isArray(recentCompletions)) return normalized;

  recentCompletions.sort((left, right) => {
    const leftExercise = isObject(left) ? `${left.exerciseId ?? ""}` : "";
    const rightExercise = isObject(right) ? `${right.exerciseId ?? ""}` : "";
    if (leftExercise !== rightExercise) {
      return leftExercise.localeCompare(rightExercise);
    }

    const leftCompletedAt = isObject(left) ? `${left.completedAt ?? ""}` : "";
    const rightCompletedAt = isObject(right) ? `${right.completedAt ?? ""}` : "";
    if (leftCompletedAt !== rightCompletedAt) {
      return leftCompletedAt.localeCompare(rightCompletedAt);
    }

    const leftQuality = isObject(left) ? `${left.quality ?? ""}` : "";
    const rightQuality = isObject(right) ? `${right.quality ?? ""}` : "";
    return leftQuality.localeCompare(rightQuality);
  });

  return normalized;
};

const stripCompleteSessionNotes = (input: ReplayInputManifest): JsonValue => {
  if (input.operation !== "complete_session") {
    return input.request;
  }

  const request = cloneValue(input.request);
  if (!isObject(request)) {
    return request;
  }

  const session = request.session;
  if (!isObject(session)) {
    return request;
  }

  const requestSession = session as JsonObject;
  delete requestSession.notes;
  if (Array.isArray(requestSession.exercises)) {
    for (const exercise of requestSession.exercises) {
      if (!isObject(exercise)) continue;
      if (Array.isArray(exercise.sets)) {
        for (const set of exercise.sets) {
          if (isObject(set)) {
            delete (set as JsonObject).notes;
          }
        }
      }
    }
  }

  return request;
};

const deriveReplayInputMaterial = (input: ReplayInputManifest): JsonObject => {
  const determinism: JsonObject = {
    ...cloneValue(input.determinism),
    canonicalizationVersion: CANONICALIZATION_POLICY_VERSION,
  };

  const request = stripCompleteSessionNotes(input);
  const stateSnapshot = normalizeRecentCompletions(input.stateSnapshot);

  return {
    schemaVersion: input.schemaVersion,
    operation: input.operation,
    determinism,
    referenceSnapshot: input.referenceSnapshot,
    stateSnapshot,
    policySnapshot: input.policySnapshot,
    request,
  };
};

const deriveReplayOutputMaterial = (output: ReplayOutputManifest): JsonObject => {
  return {
    schemaVersion: output.schemaVersion,
    operation: output.operation,
    result: cloneValue(output.result),
    statePatch: cloneValue(output.statePatch),
    events: cloneValue(output.events),
    decisionLog: cloneValue(output.decisionLog),
  };
};

const assertDeterministicNumericPolicy = (input: ReplayInputManifest): void => {
  validatePolicySnapshot(input.policySnapshot);
  validateStateSnapshotNumericPolicy(input.stateSnapshot);
  validateRequestNumericPolicy(input);
};

const hashReferenceSnapshot = (input: ReplayInputManifest): string =>
  hashValue(input.referenceSnapshot, "$.referenceSnapshot");

export const verifyReplayManifest = (manifest: ReplayManifest): ReplayManifestVerificationResult => {
  if (manifest.input.operation !== manifest.output.operation) {
    throw new BundleContractMismatchError(
      "operation",
      manifest.input.operation,
      manifest.output.operation
    );
  }

  assertSupportedCanonicalizationVersion(manifest.input.determinism.canonicalizationVersion);
  assertDeterministicNumericPolicy(manifest.input);
  validateOutputNumericPolicy(manifest.output);

  const referenceHash = hashReferenceSnapshot(manifest.input);
  if (referenceHash !== manifest.input.determinism.referenceHash) {
    throw new ReferenceHashMismatchError(manifest.input.determinism.referenceHash, referenceHash);
  }
  if (referenceHash !== manifest.expected.referenceHash) {
    throw new HashMismatchError("referenceHash", manifest.expected.referenceHash, referenceHash);
  }

  const inputHash = hashValue(deriveReplayInputMaterial(manifest.input), "$.derivedInputMaterial");
  if (inputHash !== manifest.expected.inputHash) {
    throw new HashMismatchError("inputHash", manifest.expected.inputHash, inputHash);
  }

  const outputHash = hashValue(deriveReplayOutputMaterial(manifest.output), "$.derivedOutputMaterial");
  if (outputHash !== manifest.expected.outputHash) {
    throw new HashMismatchError("outputHash", manifest.expected.outputHash, outputHash);
  }

  assertReplayReceiptMatches(manifest, {
    referenceHash,
    inputHash,
    outputHash,
  });

  return {
    referenceHash,
    inputHash,
    outputHash,
  };
};

const assertReplayReceiptMatches = (
  manifest: ReplayManifest,
  actual: ReplayManifestVerificationResult
): void => {
  const receipt = manifest.output.replayReceipt;
  for (const field of ["referenceHash", "inputHash", "outputHash"] as const) {
    if (receipt[field] !== actual[field]) {
      throw new BundleContractMismatchError(
        `output.replayReceipt.${field}`,
        actual[field],
        receipt[field]
      );
    }
    if (receipt[field] !== manifest.expected[field]) {
      throw new BundleContractMismatchError(
        `output.replayReceipt.${field}`,
        manifest.expected[field],
        receipt[field]
      );
    }
  }

  const expectedReceiptFields = {
    seedUsed: manifest.input.determinism.seed,
    effectiveAt: manifest.input.determinism.effectiveAt,
    implementationVersion: "engine-rs-mvp-0",
    policyVersion: "policy-2026-02",
  };

  for (const [field, expected] of Object.entries(expectedReceiptFields)) {
    const actualField = receipt[field];
    if (actualField !== expected) {
      throw new BundleContractMismatchError(
        `output.replayReceipt.${field}`,
        expected,
        actualField
      );
    }
  }
};

export const verifyMetadataOnlyStability = (
  baselineInput: ReplayInputManifest,
  metadataVariantInput: ReplayInputManifest
): { baselineInputHash: string; metadataVariantInputHash: string } => {
  const baselineInputHash = hashValue(
    deriveReplayInputMaterial(baselineInput),
    "$.derivedInputMaterial"
  );
  const metadataVariantInputHash = hashValue(
    deriveReplayInputMaterial(metadataVariantInput),
    "$.derivedInputMaterial"
  );

  if (baselineInputHash !== metadataVariantInputHash) {
    throw new MetadataOnlyStabilityMismatchError(baselineInputHash, metadataVariantInputHash);
  }

  return {
    baselineInputHash,
    metadataVariantInputHash,
  };
};

export const verifyReplayCertificationBundle = (
  bundle: ReplayCertificationBundle
): ReplayManifestVerificationResult[] => {
  if (bundle.manifestVersion !== "engine-28-replay-certification-v1") {
    throw new BundleContractMismatchError(
      "manifestVersion",
      "engine-28-replay-certification-v1",
      bundle.manifestVersion
    );
  }
  if (bundle.canonicalizationVersion !== CANONICALIZATION_POLICY_VERSION) {
    throw new UnsupportedCanonicalizationVersionError(bundle.canonicalizationVersion);
  }
  if (bundle.hashAlgorithm !== "sha256") {
    throw new BundleContractMismatchError("hashAlgorithm", "sha256", bundle.hashAlgorithm);
  }
  if (bundle.hashFormat !== "sha256:<lowercase-hex>") {
    throw new BundleContractMismatchError(
      "hashFormat",
      "sha256:<lowercase-hex>",
      bundle.hashFormat
    );
  }

  const negativeFixtureIds = (bundle.negativeFixtures ?? []).map((fixture) => fixture.fixtureId);
  const expectedNegativeFixtureIds = [
    "unsupported-canonicalization-version",
    "reference-hash-mismatch-rejection",
    "invalid-numeric-material",
  ];
  if (negativeFixtureIds.length !== expectedNegativeFixtureIds.length) {
    throw new BundleContractMismatchError(
      "negativeFixtures",
      expectedNegativeFixtureIds.join(","),
      negativeFixtureIds.join(",")
    );
  }
  for (const expectedId of expectedNegativeFixtureIds) {
    if (!negativeFixtureIds.includes(expectedId)) {
      throw new BundleContractMismatchError(
        "negativeFixtures",
        expectedNegativeFixtureIds.join(","),
        negativeFixtureIds.join(",")
      );
    }
  }

  return bundle.fixtures.map((fixture) => verifyReplayManifest(fixture));
};
