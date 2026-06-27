import { describe, expect, it } from "vitest";
import { selectModelForRam } from "./model-profile.js";

const GB = 1024 ** 3;

describe("selectModelForRam", () => {
  it("32 GB → 14b", () => {
    expect(selectModelForRam(32 * GB).model).toBe("qwen2.5:14b");
  });
  it("16 GB → 7b (the recommended pin)", () => {
    const p = selectModelForRam(16 * GB);
    expect(p.model).toBe("qwen2.5:7b");
    expect(p.tier).toBe("16GB");
    expect(p.belowFloor).toBe(false);
  });
  it("8 GB → 3b floor", () => {
    expect(selectModelForRam(8 * GB).model).toBe("qwen2.5:3b");
  });
  it("4 GB → 3b but flagged below floor", () => {
    const p = selectModelForRam(4 * GB);
    expect(p.model).toBe("qwen2.5:3b");
    expect(p.belowFloor).toBe(true);
  });
});
