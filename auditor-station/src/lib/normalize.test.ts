import { describe, expect, it } from "vitest";
import { canonicalize, canonicalKey, normalizeName, sameCanonical } from "./normalize.js";

// Canaries lock the vendored normalizers to their SQ-1 behaviour. If these break after a
// `pnpm sync:parent` drift, the vendored copy diverged from the engine — investigate.
describe("normalizeName (light)", () => {
  it("uppercases, strips title + parenthetical, collapses spaces", () => {
    expect(normalizeName("  mrs.  Alatishe   Folashade (LATE) ")).toBe("ALATISHE FOLASHADE");
  });
  it("strips trailing punctuation", () => {
    expect(normalizeName("ADELOWO JOHN TOLA.")).toBe("ADELOWO JOHN TOLA");
  });
  it("handles empty/null-ish input", () => {
    expect(normalizeName("")).toBe("");
  });
});

describe("canonicalize (Yoruba variant-collapsing)", () => {
  it("collapses silent-H: ALATISHE === ALATISE", () => {
    expect(sameCanonical("ALATISHE FOLASHADE", "ALATISE FOLASADE")).toBe(true);
  });
  it("collapses OLUWA contraction: OLUWASEGUN === OLUSEGUN", () => {
    expect(sameCanonical("OLUWASEGUN", "OLUSEGUN")).toBe(true);
  });
  it("collapses double letters: OGUNDEELE === OGUNDELE", () => {
    expect(sameCanonical("OGUNDEELE", "OGUNDELE")).toBe(true);
  });
  it("strips titles before comparing", () => {
    expect(canonicalize("CHIEF ADEYEMI")).toBe(canonicalize("ADEYEMI"));
  });
  it("does NOT merge clearly different names", () => {
    expect(sameCanonical("ADELEKE BUKOLA", "BANKOLE OLAYEMI")).toBe(false);
  });
});

describe("canonicalKey (composed search key)", () => {
  it("strips title + parenthetical BEFORE collapsing variants", () => {
    // raw canonicalize alone would leave a stray 'LATE'; the composed key does not.
    expect(canonicalKey("MRS. ALATISHE FOLASHADE (LATE)")).toBe(canonicalKey("ALATISE FOLASADE"));
  });
});
