import { describe, expect, it } from "vitest";
import { toAuthedUser } from "../src/modules/auth/session-user";

describe("toAuthedUser", () => {
  it("accepts an id with optional email", () => {
    expect(toAuthedUser({ id: "abc", email: "test@test.com" })).toEqual({
      id: "abc",
      email: "test@test.com"
    });

    expect(toAuthedUser({ id: "abc" })).toEqual({ id: "abc" });
  });

  it("rejects invalid input", () => {
    expect(toAuthedUser(null)).toBeNull();
    expect(toAuthedUser({})).toBeNull();
    expect(toAuthedUser({ id: "" })).toBeNull();
    expect(toAuthedUser({ id: "abc", email: "not-an-email" })).toBeNull();
  });
});

