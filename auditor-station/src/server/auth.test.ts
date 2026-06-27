import { describe, expect, it } from "vitest";
import { checkPin } from "./auth.js";

describe("checkPin", () => {
  it("is open when no PIN is configured", () => {
    expect(checkPin({}, undefined).ok).toBe(true);
    expect(checkPin({ pin: undefined }, "anything").ok).toBe(true);
  });

  it("allows a matching PIN", () => {
    expect(checkPin({ pin: "2468" }, "2468").ok).toBe(true);
  });

  it("rejects a wrong or missing PIN when one is set", () => {
    expect(checkPin({ pin: "2468" }, "0000").ok).toBe(false);
    expect(checkPin({ pin: "2468" }, undefined).ok).toBe(false);
    expect(checkPin({ pin: "2468" }, "").ok).toBe(false);
  });

  it("rejects a length-mismatched PIN without throwing (constant-time guard)", () => {
    expect(checkPin({ pin: "2468" }, "24").ok).toBe(false);
    expect(checkPin({ pin: "2468" }, "246800").ok).toBe(false);
  });
});
