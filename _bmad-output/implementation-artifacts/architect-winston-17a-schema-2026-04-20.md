---
title: Architect Winston — Epic 17a Schema Impact (17a pilot scope only)
author: Architect Winston (acting) — invoked by PM John
date: 2026-04-20
scope: Epic 17a ONLY — PIS core tables, inference sidecar (minimal), identity audit log, canonicalizer perf envelope at BIR-pilot scale, PIS-only migration strategy
out_of_scope: Epic 2/5/7/8/14 retrofit (17b), sidecar pattern codification (17c), full audit-log retrofit (17c), back-migration of existing loans (17b), portfolio scale (17b)
parent_scp: scp-addendum-2-2026-04-20-DRAFT.md §2.1
length_budget: 400 lines max
---

# Architect Winston — Epic 17a Schema Impact

**Persona:** Architect Winston (acting)
**Scope constraint (strict):** 17a pilot scope ONLY. No retrofits to Epic 2/5/7/8 loans/submissions/certs tables. No sidecar pattern codification beyond what 17a needs. No full audit-log redesign beyond identity events.

---

## 0. Scope recap & decision frame

17a pilot must stand up a PersonIdentityService (PIS) against BIR Feb 2026 roster (248 staff) + BIR catalog (5,325 records). The schema footprint for 17a is deliberately **new tables only** — no back-migration of `loans.name` to `loans.person_id` (that is 17b). Everything in 17a can be reverted by dropping the new tables + archiving the sidecar JSON file; no existing data is rewritten.

**Design principle for 17a:** additive-only. No column changes to any table that existed before Addendum 2. Every integration point is a read from PIS, not a write into a legacy table.

---

## 1. PersonIdentityService (PIS) service architecture — 17a

### 1.1 Service shape

| Concern | 17a decision | Rationale |
|---|---|---|
| Deployment | In-process service in `apps/server` (no separate microservice) | Pilot scale (5,325 records) does not justify network hop; pnpm monorepo already in use. |
| API surface | REST under `/api/pis/*` + internal TypeScript API `@vlprs/shared/pis` | REST for cross-epic consumers later (17b); internal API for 17a callers. |
| Core methods | `resolve(name, mda, context?) → Verdict`, `merge(idA, idB, reason) → Decision`, `split(id, reason) → Decision`, `lookupById(oysgId) → Person \| null`, `search(name) → Person[]` | 5 verdict enumeration from Addendum 1 §17.4 preserved: `ANCHOR_EXACT`, `ANCHOR_CANONICAL`, `ANCHOR_FUZZY`, `NAMESAKE_AMBIGUOUS`, `UNANCHORED`. |
| Canonicalizer dep | Hard import from `@vlprs/shared/identity-canonicalize` (packaged from `scripts/legacy-report/utils/yoruba-name-normalize.ts`) | Story 17.4b delivers the shared package; 17.4 consumes. No alternative path. |
| Match algorithm | `canonicalize → exact FIRST`, `canonicalize → Lev ≤ 2 SECOND`. No raw Levenshtein. | Memo L1 mandate. Prevents 89+ false namesakes observed in session. |
| Namesake-frequency guard | `name_frequency` view; N ≥ 3 threshold before auto-merge on canonical-exact | Addendum 1 §17.4 requirement preserved. |
| Golden-fixture gate | Alatise / Lamidi / ADELEKE / CDU fixtures must pass in CI before 17.4 deploys | Agreement 24. Block-closed on divergence. |

### 1.2 Pilot-scale scope limit

**17a PIS operates on BIR only.** `person` table rows for 17a are sourced from BIR roster + BIR catalog only. Other MDAs (Agriculture, Works, Lands, etc.) remain name-keyed until 17b portfolio roll-out. This is enforced via a `pilot_scope` config flag in PIS: `pilotScope.mdas = ['BIR']`; resolve calls with other MDA contexts return `UNANCHORED` with `reason: 'out_of_pilot_scope'`.

Why: Memo §8 risk 3 — canonicalizer behaviour at Agriculture scale (11,425 records) is untested. 17a pilot contains the risk surface to 248 roster × 5,325 catalog.

---

## 2. Core schema (new tables only for 17a)

### 2.1 `person` — canonical identity record

```sql
CREATE TABLE person (
  person_id          TEXT PRIMARY KEY,              -- OYSG/NNNN form preserved as-is
  primary_name       TEXT NOT NULL,
  canonical_name     TEXT NOT NULL,                 -- canonicalize(primary_name) at insert
  name_variants      JSONB NOT NULL DEFAULT '[]',   -- [{variant, source, firstSeen}]
  raw_id_variants    JSONB NOT NULL DEFAULT '[]',   -- ["OYSG/0625", "OYSG 0625", "OYSG-0625"]
  mda_history        JSONB NOT NULL DEFAULT '[]',   -- [{mda, firstSeen, lastSeen, evidenceCount}]
  evidence_class     TEXT NOT NULL,                 -- 'payroll-roster' | 'catalog-monthly-return' | 'catalog-backfilled'
  source_trail       JSONB NOT NULL DEFAULT '[]',   -- [{file, sheet, row, tier, timestamp}]
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  pilot_scope_tag    TEXT NOT NULL DEFAULT 'BIR'    -- 17a lock; 17b removes this
);
CREATE INDEX person_canonical_name_idx ON person (canonical_name);
CREATE INDEX person_primary_name_idx ON person (primary_name);
CREATE INDEX person_name_variants_gin ON person USING GIN (name_variants);
```

**Notes:**
- `person_id` is the OYSG-assigned ID (e.g. `OYSG/4812`). PIS does not mint new IDs in 17a; if an unanchored record has no OYSG ID, it does not get a `person` row — it stays name-keyed in its origin catalog table. (Minting synthetic PIS IDs for unanchored records is a 17b decision.)
- `canonical_name` computed at insert via Story 17.4b canonicalizer.
- `raw_id_variants` stores the `OYSG/0625` vs `OYSG 0625` vs `OYSG-0625` variants Awwal's Lessons memo L3 + §10 item 2 calls out — preserves audit history without forcing normalisation at ingest.
- `pilot_scope_tag` is a 17a-specific escape hatch. 17b drops the column.

### 2.2 `name_frequency` — namesake-frequency guard

```sql
CREATE MATERIALIZED VIEW name_frequency AS
SELECT canonical_name, COUNT(DISTINCT person_id) AS person_count
FROM person
GROUP BY canonical_name;
CREATE UNIQUE INDEX name_frequency_canonical_idx ON name_frequency (canonical_name);
```

**Refresh strategy for 17a:** `REFRESH MATERIALIZED VIEW CONCURRENTLY` after every `person` insert/update. At pilot scale (1,536 rows), this is sub-second. **At portfolio scale (500K+) this will need incremental maintenance — deferred to 17b.**

### 2.3 `identity_decision` — audit log (identity events ONLY for 17a)

```sql
CREATE TABLE identity_decision (
  id                 BIGSERIAL PRIMARY KEY,
  decision_type      TEXT NOT NULL,                 -- 'auto_merge' | 'flag_for_review' | 'manual_override' | 'rejected' | 'namesake_disambiguation'
  person_id          TEXT REFERENCES person(person_id),
  secondary_person_id TEXT REFERENCES person(person_id),   -- for merges/splits
  verdict            TEXT NOT NULL,                 -- ANCHOR_EXACT | ANCHOR_CANONICAL | ANCHOR_FUZZY | NAMESAKE_AMBIGUOUS | UNANCHORED
  evidence_class     TEXT NOT NULL,
  source_trail       JSONB NOT NULL,
  reason             TEXT,                          -- free text for manual overrides
  reviewer           TEXT,                          -- user id for manual decisions
  decided_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  pilot_scope_tag    TEXT NOT NULL DEFAULT 'BIR'
);
CREATE INDEX identity_decision_person_idx ON identity_decision (person_id);
CREATE INDEX identity_decision_type_idx ON identity_decision (decision_type);
CREATE INDEX identity_decision_decided_at_idx ON identity_decision (decided_at);
```

**Why a new table (not an extension of existing `audit_log`):** 17a is additive-only. Extending `audit_log` means schema change on a legacy table, which triggers 17b-level review per §2.0 boundary. Identity decisions have distinct shape anyway (verdict + evidence_class + source_trail). **Unification with `audit_log` is a 17c concern** (when override UX lands via 17.4e).

---

## 3. Inference sidecar — minimal 17a shape

### 3.1 Decision: DB table, not JSONB column on an existing table

| Option | Pros | Cons | 17a decision |
|---|---|---|---|
| **A — JSONB column on existing table** | No new table | Requires schema change on legacy table (violates additive-only); couples inference lifecycle to host row | Rejected |
| **B — Separate `inference_sidecar` table** | Additive-only; clean rollback (drop table + delete JSON file); supports the BIR backfill JSON sidecar pattern already in use | One more table | **Selected** |
| **C — JSON file only (no DB)** | Zero schema impact | Not queryable at runtime for PIS resolve; loses transactional safety | Rejected |

### 3.2 Schema

```sql
CREATE TABLE inference_sidecar (
  id                 BIGSERIAL PRIMARY KEY,
  sidecar_version    TEXT NOT NULL,                 -- 'staff-id-backfill-2026-04-20'
  catalog_ref        JSONB NOT NULL,                -- {file, sheet, row, recordIdx}
  inference_type     TEXT NOT NULL,                 -- 'backfill' | 'pis_merge' | 'pis_split' | 'manual_override'
  evidence_class     TEXT NOT NULL,
  tier               TEXT,                          -- TIER-1 | TIER-2 | TIER-3 | TIER-4 | null
  source_trail       JSONB NOT NULL,
  inference_method   TEXT NOT NULL,                 -- 'canonical_exact' | 'fuzzy_lev2' | 'manual' | 'roster_seed'
  person_id          TEXT REFERENCES person(person_id),
  reviewer_decision  TEXT,                          -- 'accepted' | 'rejected' | 'superseded' | null (pending)
  superseded_by      BIGINT REFERENCES inference_sidecar(id),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  pilot_scope_tag    TEXT NOT NULL DEFAULT 'BIR'
);
CREATE INDEX inference_sidecar_person_idx ON inference_sidecar (person_id);
CREATE INDEX inference_sidecar_version_idx ON inference_sidecar (sidecar_version);
CREATE INDEX inference_sidecar_catalog_ref_gin ON inference_sidecar USING GIN (catalog_ref);
```

**Read pattern:** PIS resolve consults `person ∪ inference_sidecar` at query time. Concretely:
```ts
async resolve(name, mda) {
  const direct = await queryPerson(name, mda);       // exact or canonical
  const inferred = await querySidecar(name, mda);    // TIER-1/3 backfill hits
  return merge(direct, inferred);  // verdict precedence: ANCHOR_EXACT > ANCHOR_CANONICAL > ANCHOR_FUZZY
}
```

**Rollback:** mark sidecar row `reviewer_decision = 'superseded'` + set `superseded_by` pointer. Downstream reads filter out superseded rows. No data destruction.

**17a scope limit:** only `backfill` and `pis_merge`/`pis_split` inference_type rows. `manual_override` appears in the enum for forward compat but is not written in 17a (no 17.4e UX yet — 17c).

### 3.3 Sidecar-file ↔ DB-table reconciliation

The BIR backfill produced `staff-id-backfill-2026-04-20.json`. For 17a:
- JSON file is the **source artefact** (preserved unchanged for audit).
- DB `inference_sidecar` is the **queryable projection** — populated once from the JSON file at pilot activation.
- Re-running the backfill produces a new versioned JSON file; DB rows from the prior version stay but get `superseded_by` pointers.

Formal sidecar-pattern-as-story (17.x) codifies this across pipelines in 17c. For 17a the BIR sidecar follows the pattern by convention.

---

## 4. Canonicalizer performance envelope — BIR pilot scale

### 4.1 Workload shape

| Hot path | Invocation volume at pilot | Latency target | Approach |
|---|---|---|---|
| Ingest: canonicalize every roster + catalog name | 248 + 5,325 = 5,573 calls, one-shot at pilot activation | < 30s total | Direct regex chain, no caching |
| Resolve: canonicalize incoming query name | O(1) per request; rare during pilot | < 5ms p99 | In-process function call |
| Name-frequency MV refresh | After every person insert/update | < 1s | `REFRESH MATERIALIZED VIEW CONCURRENTLY` |

### 4.2 Performance budget

The session canonicalizer (`scripts/legacy-report/utils/yoruba-name-normalize.ts`) is a sequential regex chain. Measured informally during the test-report session: ~0.1ms per name on modern hardware. 5,573 names × 0.1ms = 0.6s. Well within budget.

**Caching hook required (per Story 17.4b AC5):**
```ts
const cache = new Map<string, CanonicalForm>();
export function canonicalize(name: string): CanonicalForm {
  if (cache.has(name)) return cache.get(name)!;
  const result = applyRules(name);
  cache.set(name, result);
  return result;
}
```
LRU-capped at 10K entries for 17a (covers full pilot corpus with room). Cache invalidation on rule change (tied to canonicalizer package version).

### 4.3 Portfolio-scale flag (for 17b)

At portfolio scale (91,955 catalog today, projected 500K+ with all rosters), regex chain with simple cache may need:
- Compiled DFA for hot rules.
- Memoization at process boundary (currently per-process; move to Redis if multi-process).
- Incremental `name_frequency` maintenance (trigger-based delta, not full refresh).

**Not in 17a scope.** Flagged for 17b architecture review when portfolio data surfaces.

### 4.4 Observability hook

Per Story 17.obs and 17.4b AC5:
```ts
metrics.histogram('pis.canonicalize.latency_ms', durationMs);
metrics.counter('pis.canonicalize.cache_hit').inc();
metrics.counter('pis.canonicalize.rule_applied', { rule: 'SH_SILENT_H' }).inc();
```
Exposed via Prometheus endpoint already wired for 17.obs dashboard tiles.

---

## 5. Migration strategy — 17a only

### 5.1 Migration scope

**For 17a, migrations are additive-only:**

1. `CREATE TABLE person` (§2.1)
2. `CREATE MATERIALIZED VIEW name_frequency` (§2.2)
3. `CREATE TABLE identity_decision` (§2.3)
4. `CREATE TABLE inference_sidecar` (§3.2)
5. Seed `person` from BIR Feb 2026 roster (248 rows).
6. Seed `inference_sidecar` from `staff-id-backfill-2026-04-20.json` (4,560 rows).
7. Initial `REFRESH MATERIALIZED VIEW name_frequency`.

Each migration is reversible via `DROP TABLE` / `DROP MATERIALIZED VIEW`. No existing tables touched.

### 5.2 What is explicitly NOT done in 17a

| Migration | Sub-epic | Why deferred |
|---|---|---|
| Add nullable `person_id` FK to `loans` | **17b** | Touches Epic 2 table; requires full retrofit plan + 3-phase staged migration (nullable → populated → non-nullable) |
| Add nullable `person_id` FK to `submissions`, `exceptions`, `certificates`, `events`, `approvals` | **17b** | Same — Epic 5/7/8/11 tables |
| Back-migrate existing 91,955 catalog records to `person_id` FK | **17b** | Out of pilot scope |
| Unify `identity_decision` with existing `audit_log` | **17c** | Pattern codification |
| `pilot_scope_tag` column removal | **17b** | Marker of 17a-only boundary; removed when portfolio roll-out begins |

### 5.3 Rollback procedure for 17a pilot

If 17a pilot needs to be rolled back:
1. Disable PIS API endpoint (feature flag `PIS_ENABLED = false`).
2. `DROP MATERIALIZED VIEW name_frequency;`
3. `DROP TABLE inference_sidecar; DROP TABLE identity_decision; DROP TABLE person;`
4. Archive `staff-id-backfill-2026-04-20.json` (do not delete — audit history).
5. No downstream tables touched; no data loss.

**Runbook lives with the migration files.** Drizzle migrations in `apps/server/src/db/migrations/`.

### 5.4 Drizzle migration generation order

Per the project memory's critical rule ("never re-run `drizzle-kit generate` for an already-applied migration"):
- Each of the 4 new tables = 1 new migration file each (not a single consolidated migration — easier to roll back individually).
- Generate in order: `person` → `name_frequency` (depends on person) → `identity_decision` (FK to person) → `inference_sidecar` (FK to person).
- Do not amend the existing migration 0006 index incident pattern. Additive only.

---

## 6. Integration seams (17a → 17b contract)

Contract tests Winston recommends for the 17a → 17b seam (so 17b retrofit doesn't require re-architecting 17a tables):

| Seam | Contract test |
|---|---|
| `person.person_id` format | Must be `OYSG/\d+` pattern; 17b FK migrations assume this regex |
| `person` primary key stability | PIS must not re-mint OYSG IDs (no synthetic IDs in 17a) |
| `inference_sidecar.catalog_ref` shape | `{file, sheet, row, recordIdx}` — 17b Epic 2 retrofit reads this shape |
| PIS `resolve()` idempotency | Same input → same verdict across calls within a rule-version |
| `pilot_scope_tag` filter | 17a APIs always filter by pilot scope; 17b migration strips the column cleanly |

---

## 7. Open questions Winston defers back to PM John

1. **Deputy AG sign-off** on `DEPUTY_AG_BRIEF_2026-04-20.md` is the gate for migration 1–7. Winston cannot run migrations before authorisation.
2. **Native-Yoruba-speaker review of canonicalizer** (Story 17.4b AC4 gate). Winston's schema is non-blocking on this, but PIS activation is blocked until review concludes. Schedule coordination is PM/PO concern.
3. **Drizzle migration hash-tracking discipline** — project memory flags this as a known incident risk. Winston commits to generating each of the 4 migrations separately, never re-generating.
4. **Feature flag infrastructure** — `PIS_ENABLED` flag for rollback (§5.3). Does existing feature-flag infrastructure from prior epics cover this, or do we need a new mechanism? PM to confirm scope.

---

## 8. Summary: 5 biggest schema decisions

1. **PIS is additive-only in 17a.** No `person_id` FK on legacy tables. All integration via read-from-PIS.
2. **Inference sidecar is a new table (not JSONB on legacy table).** Preserves additive discipline; supports JSON-file-as-source-of-truth pattern.
3. **Identity decisions get their own audit table** (`identity_decision`), not extending legacy `audit_log`. Unification deferred to 17c.
4. **Pilot scope flag (`pilot_scope_tag = 'BIR'`) is a first-class column** on `person`, `identity_decision`, `inference_sidecar`. Removed during 17b portfolio roll-out. Hard-enforces the pilot scope boundary at the data layer.
5. **Canonicalizer is in-process + cached.** Pilot scale does not need Redis / DFA compilation; 17b decides when portfolio scale arrives.

---

*End of Winston deliverable. Handoff: PM John integrates into SCP §2.1; UX Sally invoked next with this schema as input.*
