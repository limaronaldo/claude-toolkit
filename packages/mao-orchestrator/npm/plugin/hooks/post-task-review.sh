#!/usr/bin/env bash
# MAO Hook: post-task review trigger
# After a MAO task completes, triggers the mao-review skill automatically.
# Reads .orchestrator/state/task-graph.json to find completed tasks needing review.

set -euo pipefail

GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m'

info() { printf "${GREEN}[mao-review]${NC} %s\n" "$1"; }
warn() { printf "${YELLOW}[mao-review]${NC} %s\n" "$1"; }

TASK_GRAPH=".orchestrator/state/task-graph.json"

if [ ! -f "$TASK_GRAPH" ]; then
  exit 0
fi

# Check for tasks marked "done" but not yet reviewed
if ! command -v jq >/dev/null 2>&1; then
  warn "jq not installed — cannot parse task graph for review triggers"
  exit 0
fi

DONE_UNREVIEWED=$(jq -r '
  .tasks | to_entries[]
  | select(.value.status == "done" and (.value.reviewed // false) == false)
  | .key
' "$TASK_GRAPH" 2>/dev/null || true)

if [ -z "$DONE_UNREVIEWED" ]; then
  exit 0
fi

COUNT=$(echo "$DONE_UNREVIEWED" | wc -l | tr -d ' ')
info "$COUNT task(s) completed and pending review:"
echo "$DONE_UNREVIEWED" | while read -r task_id; do
  TITLE=$(jq -r ".tasks[\"$task_id\"].title // \"$task_id\"" "$TASK_GRAPH" 2>/dev/null)
  info "  $task_id: $TITLE"
done

info ""
info "Run /mao-review to review completed tasks"
info "Or invoke the mao-reviewer agent for automated review"
