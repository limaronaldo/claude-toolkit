#!/bin/bash
# setup-worktrees.sh
# Creates git worktrees for parallel task execution
# Usage: ./setup-worktrees.sh <task-graph.json>

set -euo pipefail

TASK_GRAPH="${1:-.orchestrator/state/task-graph.json}"

if [ ! -f "$TASK_GRAPH" ]; then
    echo "ERROR: Task graph not found at $TASK_GRAPH"
    exit 1
fi

# Ensure we're in a git repo
if ! git rev-parse --is-inside-work-tree > /dev/null 2>&1; then
    echo "ERROR: Not inside a git repository"
    exit 1
fi

REPO_ROOT=$(git rev-parse --show-toplevel)
CURRENT_BRANCH=$(git branch --show-current)

echo "=== Multi-Agent Orchestrator: Worktree Setup ==="
echo "Repo: $REPO_ROOT"
echo "Base branch: $CURRENT_BRANCH"
echo ""

# Extract worktree names from task graph
# Uses jq if available, falls back to grep/sed
if command -v jq &> /dev/null; then
    WORKTREES=$(jq -r '.tasks[] | select(.worktree != null) | .worktree' "$TASK_GRAPH")
    BRANCHES=$(jq -r '.tasks[] | select(.worktree != null) | "feat/" + .id + "-" + (.name | gsub(" "; "-") | ascii_downcase)' "$TASK_GRAPH")
else
    WORKTREES=$(grep -o '"worktree": *"[^"]*"' "$TASK_GRAPH" | sed 's/"worktree": *"//;s/"//')
fi

# Create orchestrator directories
mkdir -p .orchestrator/state
mkdir -p .orchestrator/artifacts
mkdir -p .orchestrator/messages

# Initialize metrics if not exists
if [ ! -f ".orchestrator/state/metrics.json" ]; then
    echo '{"runs": [], "current_run": null}' > .orchestrator/state/metrics.json
fi

# Initialize patterns if not exists
if [ ! -f ".orchestrator/state/patterns.json" ]; then
    echo '{"patterns": []}' > .orchestrator/state/patterns.json
fi

# Create worktrees
CREATED=0
for WT in $WORKTREES; do
    WT_PATH="../$WT"
    BRANCH_NAME="feat/$WT"
    
    if [ -d "$WT_PATH" ]; then
        echo "SKIP: $WT (already exists)"
        continue
    fi
    
    echo "CREATE: $WT → branch $BRANCH_NAME"
    git worktree add "$WT_PATH" -b "$BRANCH_NAME" 2>/dev/null || {
        echo "  WARN: Branch $BRANCH_NAME exists, using it"
        git worktree add "$WT_PATH" "$BRANCH_NAME" 2>/dev/null || {
            echo "  ERROR: Could not create worktree for $WT"
            continue
        }
    }
    
    # Create artifact directory for each task
    TASK_ID=$(echo "$WT" | sed 's/wt-//')
    mkdir -p ".orchestrator/artifacts/$TASK_ID"
    
    CREATED=$((CREATED + 1))
done

echo ""
echo "=== Setup Complete ==="
echo "Created: $CREATED worktrees"
echo ""
git worktree list
