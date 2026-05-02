import { describe, expect, it } from "vitest";
import {
  computeCanonicalReplayReferenceHash,
  serializeCanonicalReplayJson,
} from "../src/lib/engine-replay";

describe("engine replay canonicalization", () => {
  it("sorts object keys and emits the expected sha256 hash", () => {
    const value = {
      b: 2,
      a: 1,
    };

    expect(serializeCanonicalReplayJson(value)).toBe('{"a":1,"b":2}');
    expect(computeCanonicalReplayReferenceHash(value)).toBe(
      "sha256:43258cff783fe7036d8a43033f830adfc60ec037382473548ac742b888292777"
    );
  });

  it("rejects non-json replay material", () => {
    expect(() => serializeCanonicalReplayJson({ a: undefined })).toThrow(
      "unsupported value"
    );
    expect(() => serializeCanonicalReplayJson(-0)).toThrow("number -0");
  });
});
