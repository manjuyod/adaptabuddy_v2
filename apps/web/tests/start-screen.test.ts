import { describe, expect, it } from "vitest";
import { resolveStartScreen } from "../src/lib/start-screen";

describe("resolveStartScreen", () => {
  it("forces continue when preferred is continue", () => {
    expect(resolveStartScreen(false, "continue")).toBe("continue");
    expect(resolveStartScreen(true, "continue")).toBe("continue");
  });

  it("forces start when preferred is start", () => {
    expect(resolveStartScreen(false, "start")).toBe("start");
    expect(resolveStartScreen(true, "start")).toBe("start");
  });

  it("uses hasSave when preferred is auto", () => {
    expect(resolveStartScreen(false, "auto")).toBe("start");
    expect(resolveStartScreen(true, "auto")).toBe("continue");
  });
});

