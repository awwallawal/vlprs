import { describe, expect, it } from "vitest";
import { shouldSkipPath } from "./package-bundle.js";

describe("package-bundle shouldSkipPath", () => {
  it("excludes node_modules, the secret, the plaintext db, logs, and tests", () => {
    for (const p of [
      "node_modules/x/index.js",
      ".env",
      "data/catalog.db", // plaintext db
      "audit/audit-log.jsonl",
      "src/lib/normalize.test.ts",
      "scripts/__fixtures__/catalog.sample.json",
    ]) {
      expect(shouldSkipPath(p)).toBe(true);
    }
  });

  it("includes code, web, vendor, docs, the encrypted catalog, and manifest", () => {
    for (const p of [
      "src/server/server.ts",
      "web/index.html",
      "vendor/loan-model.ts",
      "GOVERNANCE.md",
      ".env.example",
      "data/catalog.db.enc", // encrypted artifact ships
      "data/MANIFEST.sha256",
      "package.json",
    ]) {
      expect(shouldSkipPath(p)).toBe(false);
    }
  });
});
