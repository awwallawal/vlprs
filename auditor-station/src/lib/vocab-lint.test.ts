import { describe, expect, it } from "vitest";
import { lintNonPunitive } from "./vocab-lint.js";

describe("lintNonPunitive", () => {
  it("rewrites banned terms to neutral equivalents", () => {
    const { clean, violations } = lintNonPunitive(
      "This anomaly and discrepancy were flagged as an over-deduction.",
    );
    expect(clean).toBe("This observation and variance were marked for review as an balance below zero.");
    expect(violations.map((v) => v.suggestion)).toEqual([
      "observation",
      "variance",
      "marked for review",
      "balance below zero",
    ]);
  });

  it("preserves leading capitalization", () => {
    expect(lintNonPunitive("Anomaly found.").clean).toBe("Observation found.");
  });

  it("handles plurals", () => {
    expect(lintNonPunitive("Several anomalies and discrepancies.").clean).toBe(
      "Several observations and variances.",
    );
  });

  it("leaves clean, non-punitive text untouched (no violations)", () => {
    const text = "This is an observation for review; the variance is small.";
    const { clean, violations } = lintNonPunitive(text);
    expect(clean).toBe(text);
    expect(violations).toHaveLength(0);
  });

  it("catches red-flag and over deduction variants", () => {
    expect(lintNonPunitive("a red flag").clean).toBe("a point(s) for review");
    expect(lintNonPunitive("an over deduction").clean).toBe("an balance below zero");
  });
});
