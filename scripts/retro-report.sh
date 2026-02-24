#!/usr/bin/env bash
# retro-report.sh — Aggregate per-story commit stats for retrospectives
#
# Usage:
#   ./scripts/retro-report.sh <story-key-pattern>
#
# Examples:
#   ./scripts/retro-report.sh "2-"        # All Epic 2 stories
#   ./scripts/retro-report.sh "1-10"      # Story 1.10 only
#   ./scripts/retro-report.sh "1-"        # All Epic 1 stories
#
# Known limitations:
#   - Commits mentioning multiple story keys are counted under each matching story
#   - "Files" column counts total file-touches across commits, not unique files
#
# Output: Markdown table to stdout (pipe to file or copy to retro doc)

set -euo pipefail

PATTERN="${1:-}"

if [ -z "$PATTERN" ]; then
  echo "Usage: $0 <story-key-pattern>"
  echo ""
  echo "Examples:"
  echo "  $0 \"2-\"        # All Epic 2 stories"
  echo "  $0 \"1-10\"      # Story 1.10 only"
  echo "  $0 \"1-\"        # All Epic 1 stories"
  exit 1
fi

# Verify we're in a git repo
if ! git rev-parse --is-inside-work-tree > /dev/null 2>&1; then
  echo "Error: Not inside a git repository" >&2
  exit 1
fi

# Collect all commit hashes matching the pattern in commit messages
# Search across all branches for comprehensive coverage
COMMITS=$(git log --all --oneline --format="%H %s" | grep -i "$PATTERN" || true)

if [ -z "$COMMITS" ]; then
  echo "No commits found matching pattern: $PATTERN" >&2
  exit 2
fi

# Extract unique story keys from commit messages
# Story keys follow pattern: X-Y, X.Y, or X-Y-slug (e.g., "1-10", "1.10", "2-1-mda-registry")
# Anchored to small numbers (1-2 digits) to avoid matching version numbers or dates
# Normalize dots to dashes for consistent grouping
STORY_KEYS=$(echo "$COMMITS" | grep -oiE '\b[0-9]{1,2}[.-][0-9]{1,2}([.-][a-z][-a-z]*)?' | sed 's/\./-/g' | sort -t'-' -k1,1n -k2,2n | uniq)

if [ -z "$STORY_KEYS" ]; then
  # Fallback: treat all matching commits as one group
  STORY_KEYS="all-matching"
fi

# Print header
echo "# Retrospective Report — Pattern: \`$PATTERN\`"
echo ""
echo "Generated: $(date +%Y-%m-%d)"
echo ""
echo "| Story | Commits | File Touches | Additions | Deletions | Reverts | feat% | fix% |"
echo "|-------|---------|--------------|-----------|-----------|---------|-------|------|"

# Track totals
TOTAL_COMMITS=0
TOTAL_FILES=0
TOTAL_ADDITIONS=0
TOTAL_DELETIONS=0
TOTAL_REVERTS=0
TOTAL_FEAT=0
TOTAL_FIX=0

for KEY in $STORY_KEYS; do
  # Build a regex that matches both dot and dash variants (e.g., "1-10" matches "1.10" and "1-10")
  KEY_REGEX=$(echo "$KEY" | sed 's/-/[.-]/g')

  # Get commits for this story key
  STORY_COMMITS=$(echo "$COMMITS" | grep -iE "$KEY_REGEX" || true)

  if [ -z "$STORY_COMMITS" ]; then
    continue
  fi

  # Count commits
  COMMIT_COUNT=$(echo "$STORY_COMMITS" | wc -l | tr -d ' ')

  # Get commit hashes
  HASHES=$(echo "$STORY_COMMITS" | awk '{print $1}')

  # Count files, additions, deletions across all commits for this story
  FILES=0
  ADDITIONS=0
  DELETIONS=0

  for HASH in $HASHES; do
    STAT=$(git diff-tree --no-commit-id --numstat "$HASH" 2>/dev/null || true)
    if [ -n "$STAT" ]; then
      while IFS=$'\t' read -r ADD DEL FILE; do
        if [ "$ADD" != "-" ] && [ "$DEL" != "-" ]; then
          ADDITIONS=$((ADDITIONS + ADD))
          DELETIONS=$((DELETIONS + DEL))
        fi
        FILES=$((FILES + 1))
      done <<< "$STAT"
    fi
  done

  # Count reverts (grep -c outputs "0" with exit 1 on no match; || true suppresses the exit)
  REVERT_COUNT=$(echo "$STORY_COMMITS" | grep -ci "revert" || true)
  REVERT_COUNT=${REVERT_COUNT:-0}

  # Count feat and fix commits
  FEAT_COUNT=$(echo "$STORY_COMMITS" | grep -ciE "^[a-f0-9]+ (feat|refactor|docs|test):" || true)
  FEAT_COUNT=${FEAT_COUNT:-0}
  FIX_COUNT=$(echo "$STORY_COMMITS" | grep -ciE "^[a-f0-9]+ fix:" || true)
  FIX_COUNT=${FIX_COUNT:-0}

  # Calculate percentages (avoid division by zero)
  CLASSIFIABLE=$((FEAT_COUNT + FIX_COUNT))
  if [ "$CLASSIFIABLE" -gt 0 ]; then
    FEAT_PCT=$(( (FEAT_COUNT * 100) / CLASSIFIABLE ))
    FIX_PCT=$(( (FIX_COUNT * 100) / CLASSIFIABLE ))
  else
    FEAT_PCT=0
    FIX_PCT=0
  fi

  echo "| $KEY | $COMMIT_COUNT | $FILES | $ADDITIONS | $DELETIONS | $REVERT_COUNT | ${FEAT_PCT}% | ${FIX_PCT}% |"

  # Accumulate totals
  TOTAL_COMMITS=$((TOTAL_COMMITS + COMMIT_COUNT))
  TOTAL_FILES=$((TOTAL_FILES + FILES))
  TOTAL_ADDITIONS=$((TOTAL_ADDITIONS + ADDITIONS))
  TOTAL_DELETIONS=$((TOTAL_DELETIONS + DELETIONS))
  TOTAL_REVERTS=$((TOTAL_REVERTS + REVERT_COUNT))
  TOTAL_FEAT=$((TOTAL_FEAT + FEAT_COUNT))
  TOTAL_FIX=$((TOTAL_FIX + FIX_COUNT))
done

# Print totals row
TOTAL_CLASSIFIABLE=$((TOTAL_FEAT + TOTAL_FIX))
if [ "$TOTAL_CLASSIFIABLE" -gt 0 ]; then
  TOTAL_FEAT_PCT=$(( (TOTAL_FEAT * 100) / TOTAL_CLASSIFIABLE ))
  TOTAL_FIX_PCT=$(( (TOTAL_FIX * 100) / TOTAL_CLASSIFIABLE ))
else
  TOTAL_FEAT_PCT=0
  TOTAL_FIX_PCT=0
fi

echo "| **Total** | **$TOTAL_COMMITS** | **$TOTAL_FILES** | **$TOTAL_ADDITIONS** | **$TOTAL_DELETIONS** | **$TOTAL_REVERTS** | **${TOTAL_FEAT_PCT}%** | **${TOTAL_FIX_PCT}%** |"
