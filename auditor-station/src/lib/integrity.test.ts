import { existsSync, rmSync, writeFileSync, appendFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { sha256File, verifyManifest, writeManifest } from "./integrity.js";

const ART = join(tmpdir(), `auditor-station-integrity-art-${process.pid}.bin`);
const MAN = join(tmpdir(), `auditor-station-integrity-man-${process.pid}.sha256`);

afterEach(() => {
  for (const f of [ART, MAN]) if (existsSync(f)) rmSync(f, { force: true });
});

describe("integrity manifest", () => {
  it("verifies a matching artifact", () => {
    writeFileSync(ART, "hello catalog");
    writeManifest(ART, MAN);
    expect(verifyManifest(ART, MAN).ok).toBe(true);
  });

  it("refuses a tampered artifact", () => {
    writeFileSync(ART, "hello catalog");
    writeManifest(ART, MAN);
    appendFileSync(ART, "x"); // tamper after manifest
    const r = verifyManifest(ART, MAN);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("sha-mismatch");
  });

  it("reports artifact-missing when the artifact does not exist", () => {
    const r = verifyManifest(ART, MAN);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("artifact-missing");
  });

  it("allows when no manifest present (dev), flagged as no-manifest", () => {
    writeFileSync(ART, "x");
    const r = verifyManifest(ART, MAN);
    expect(r.ok).toBe(true);
    expect(r.reason).toBe("no-manifest");
  });

  it("sha256File is stable", () => {
    writeFileSync(ART, "abc");
    expect(sha256File(ART)).toBe(sha256File(ART));
  });
});
