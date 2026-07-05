import { describe, expect, it } from "vitest";
import { INVARIANTS, MODEL, STATION, STATION_MODE } from "./station.js";

// SQ2-1 smoke: proves the standalone toolchain (tsc + vitest) runs after the folder is
// scaffolded — and locks in the Gate-0 pins so a later refactor can't silently drift them.
describe("station identity", () => {
  it("pins the Gate-0 default and fast models", () => {
    expect(MODEL.default).toBe("qwen2.5:7b");
    expect(MODEL.fast).toBe("qwen2.5:3b");
  });

  it("always operates as non-authoritative", () => {
    expect(STATION_MODE).toContain("non-authoritative");
    expect(STATION.mode).toBe(STATION_MODE);
  });

  it("declares all four invariants", () => {
    expect(INVARIANTS).toHaveLength(4);
    expect(INVARIANTS).toContain("pii-hygiene");
  });
});
