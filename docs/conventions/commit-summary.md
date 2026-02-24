# Commit Summary Convention

Every completed story file **must** include a `## Commit Summary` section in the Dev Agent Record before being marked as `done`.

## Format

```markdown
### Commit Summary

| Metric | Value |
|--------|-------|
| Total commits | N |
| Files touched | N new, N modified |
| Revert count | N |
| **Narrative** | One-sentence summary of development arc |
```

## Field Definitions

| Field | Description |
|-------|-------------|
| **Total commits** | Count of all commits attributable to this story (feat, fix, refactor, docs, merge, revert) |
| **Files touched** | Count of distinct files created (new) and modified, excluding auto-generated files (lock files, build output) |
| **Revert count** | Number of revert commits — indicates rework or production incidents |
| **Narrative** | One sentence describing the development arc — what was built, any notable challenges or pivots |

## When to Write

- Fill the Commit Summary section when the story transitions to `done` status
- The dev agent or developer should populate it as part of the completion workflow
- For retrospectives, the `retro-report.sh` script aggregates these automatically

## Example (Story 1.10: Drizzle Versioned Migrations)

```markdown
### Commit Summary

| Metric | Value |
|--------|-------|
| Total commits | 4 |
| Files touched | 8 new, 3 modified |
| Revert count | 0 |
| **Narrative** | Implemented Drizzle versioned migration baseline with SHA-256 hash verification, then hotfixed a production crash caused by schema drift (baseline targeting `public` instead of `drizzle` schema) |
```

## Commit Message Prefixes

Stories use conventional commit prefixes for classification:

| Prefix | Meaning | Counted as |
|--------|---------|------------|
| `feat:` | New feature or capability | Feature work |
| `fix:` | Bug fix | Fix work |
| `refactor:` | Code restructuring (no behaviour change) | Feature work |
| `docs:` | Documentation only | Feature work |
| `test:` | Test additions or changes | Feature work |
| `merge:` | Merge commit | Neither (excluded from %) |
| `revert:` | Reverting a previous commit | Increments revert count |
