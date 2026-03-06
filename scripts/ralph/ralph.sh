#!/bin/bash
# Ralph — autonomous Claude Code loop for Sistema Club
# Usage: bash scripts/ralph/ralph.sh [max_iterations]
# Requires: claude CLI, jq

set -e

TOOL="claude"
MAX_ITERATIONS=${1:-20}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PRD_FILE="$SCRIPT_DIR/prd.json"
PROGRESS_FILE="$SCRIPT_DIR/progress.txt"

# Initialize progress file if not exists
if [ ! -f "$PROGRESS_FILE" ]; then
  echo "# Ralph Progress Log" > "$PROGRESS_FILE"
  echo "Started: $(date)" >> "$PROGRESS_FILE"
  echo "---" >> "$PROGRESS_FILE"
fi

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║   Ralph — Sistema Club overnight sprint      ║"
echo "║   Tool: Claude Code  |  Max: $MAX_ITERATIONS iterations  ║"
echo "╚══════════════════════════════════════════════╝"
echo ""

for i in $(seq 1 $MAX_ITERATIONS); do
  echo ""
  echo "─────────────────────────────────────────────"
  echo "  Iteration $i / $MAX_ITERATIONS"
  echo "─────────────────────────────────────────────"

  # Run Claude Code with the ralph prompt
  OUTPUT=$(claude --dangerously-skip-permissions --print < "$SCRIPT_DIR/CLAUDE.md" 2>&1 | tee /dev/stderr) || true

  # Check for completion signal
  if echo "$OUTPUT" | grep -q "<promise>COMPLETE</promise>"; then
    echo ""
    echo "✓ Ralph completed all stories at iteration $i!"
    exit 0
  fi

  echo "Iteration $i done. Sleeping 3s..."
  sleep 3
done

echo ""
echo "Ralph reached max iterations ($MAX_ITERATIONS)."
echo "Check progress.txt for status."
