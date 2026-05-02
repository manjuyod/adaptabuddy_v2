import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const outputPath = "packages/engine-rs/fixtures/replay-certification/engine_28_manifest.json";

const fixtureSpecs = [
  [
    "initialize-cycle-baseline",
    "initialize-cycle-baseline",
    "Baseline initialize_cycle replay fixture with ratio and kg fixed-point material.",
  ],
  [
    "plan-baseline",
    "plan-session-baseline-empty-events",
    "Baseline plan_session fixture; output events is an empty array and remains replay material.",
  ],
  [
    "plan-no-solution",
    "plan-session-deterministic-rejection",
    "Plan-session deterministic rejection fixture.",
  ],
  [
    "plan-injury-blocked",
    "numeric-boundary-case",
    "Valid numeric boundary fixture using classArchetypeBias at 0.15.",
  ],
  ["complete-baseline", "complete-session-baseline", "Baseline complete_session fixture."],
  [
    "complete-note-only-variant",
    "complete-session-note-only-non-material",
    "Complete-session variant that changes free-text notes and metadata only.",
  ],
];

const clone = (value) => JSON.parse(JSON.stringify(value));

const runFixture = (name) => {
  const stdout = execFileSync(
    "cargo",
    [
      "run",
      "--quiet",
      "--manifest-path",
      "packages/engine-rs/Cargo.toml",
      "--bin",
      "inspect_engine",
      "--",
      name,
    ],
    { encoding: "utf8" }
  );

  const inputMarker = "INPUT\n";
  const outputMarker = "\nOUTPUT\n";
  const inputStart = stdout.indexOf(inputMarker);
  const outputStart = stdout.indexOf(outputMarker);
  if (inputStart < 0 || outputStart < 0) {
    throw new Error(`Unexpected inspect_engine output for ${name}`);
  }

  return {
    input: JSON.parse(stdout.slice(inputStart + inputMarker.length, outputStart)),
    output: JSON.parse(stdout.slice(outputStart + outputMarker.length)),
  };
};

const buildManifestFixture = ([fixtureId, fixtureClass, description]) => {
  const { input, output } = runFixture(fixtureId);

  return {
    fixtureId,
    fixtureClass,
    description,
    certificationMetadata: {
      materialScope: "canonical replay material and public output hash certification",
      fullOperationParity:
        "provided by Rust execution output; verifier certifies canonical material and hashes only",
      replayMaterialExcludes:
        input.operation === "complete_session"
          ? ["metadata", "request.session.notes", "request.session.exercises[].sets[].notes"]
          : ["metadata"],
    },
    input,
    output,
    expected: {
      referenceHash: input.determinism.referenceHash,
      inputHash: output.replayReceipt.inputHash,
      outputHash: output.replayReceipt.outputHash,
    },
  };
};

const fixtures = fixtureSpecs.map(buildManifestFixture);
const planBaseline = clone(fixtures.find((fixture) => fixture.fixtureId === "plan-baseline").input);

const invalidCanonicalizationInput = clone(planBaseline);
invalidCanonicalizationInput.determinism.canonicalizationVersion = "canon-replay-v99";

const referenceMismatchInput = clone(planBaseline);
referenceMismatchInput.determinism.referenceHash =
  "sha256:0000000000000000000000000000000000000000000000000000000000000000";

const invalidNumericInput = clone(
  fixtures.find((fixture) => fixture.fixtureId === "complete-baseline").input
);
invalidNumericInput.request.session.exercises[0].sets[0].weight = 100.001;

const bundle = {
  manifestVersion: "engine-28-replay-certification-v1",
  canonicalizationVersion: "canon-replay-v1",
  hashAlgorithm: "sha256",
  hashFormat: "sha256:<lowercase-hex>",
  generatedFrom: {
    rustCrate: "packages/engine-rs",
    command:
      "cargo run --quiet --manifest-path packages/engine-rs/Cargo.toml --bin inspect_engine -- <fixture-name>",
    generatedAt: "1970-01-01T00:00:00.000Z",
  },
  certificationScope: {
    certifies: [
      "canonical referenceHash derivation",
      "canonical inputHash derivation",
      "canonical outputHash derivation with replayReceipt excluded",
      "metadata and complete-session note exclusion from replay input material",
      "typed failure classification for canonicalization and numeric policy failures",
    ],
    doesNotCertify: [
      "independent full operation reimplementation",
      "heuristic decision parity outside the checked Rust public outputs",
    ],
  },
  fixtures,
  negativeFixtures: [
    {
      fixtureId: "unsupported-canonicalization-version",
      expectedFailureKind: "unsupported_canonicalization_version",
      description: "Input uses an unsupported canonicalization policy selector.",
      input: invalidCanonicalizationInput,
    },
    {
      fixtureId: "reference-hash-mismatch-rejection",
      expectedFailureKind: "reference_hash_mismatch",
      description:
        "Input carries a referenceHash that does not match canonical referenceSnapshot bytes.",
      input: referenceMismatchInput,
    },
    {
      fixtureId: "invalid-numeric-material",
      expectedFailureKind: "invalid_numeric_material",
      description: "Input includes a kg-cent replay value with excess precision.",
      input: invalidNumericInput,
    },
  ],
};

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(bundle, null, 2)}\n`);
console.log(`wrote ${outputPath}`);
