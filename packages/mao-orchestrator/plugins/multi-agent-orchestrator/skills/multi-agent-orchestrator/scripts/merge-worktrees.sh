#!/bin/bash
# merge-worktrees.sh
# Merges completed worktree branches back into the main branch
# Usage: ./merge-worktrees.sh [--cleanup]

set -euo pipefail

CLEANUP="${1:-}"
REPO_ROOT=$(git rev-parse --show-toplevel)
MAIN_BRANCH=$(git branch --show-current)
TASK_GRAPH=".orchestrator/state/task-graph.json"

echo "=== Multi-Agent Orchestrator: Merge ==="
echo "Target branch: $MAIN_BRANCH"
echo ""

# Get list of worktrees (excluding main)
WORKTREES=$(git worktree list | grep -v "\[$MAIN_BRANCH\]" | grep "wt-" | awk '{print $1}')

if [ -z "$WORKTREES" ]; then
    echo "No worktrees to merge."
    exit 0
fi

MERGED=0
FAILED=0
CONFLICTS=""

for WT_PATH in $WORKTREES; do
    WT_NAME=$(basename "$WT_PATH")
    BRANCH=$(git -C "$WT_PATH" branch --show-current 2>/dev/null || echo "unknown")
    
    echo "--- Merging: $WT_NAME ($BRANCH) ---"
    
    # Check if there are changes to merge
    COMMITS=$(git log "$MAIN_BRANCH".."$BRANCH" --oneline 2>/dev/null | wc -l)
    if [ "$COMMITS" -eq 0 ]; then
        echo "  SKIP: No new commits in $BRANCH"
        continue
    fi
    
    echo "  Commits to merge: $COMMITS"
    
    # Attempt merge
    if git merge "$BRANCH" --no-ff -m "merge: $WT_NAME via multi-agent orchestrator" 2>/dev/null; then
        echo "  MERGED: $BRANCH → $MAIN_BRANCH"
        
        # Run tests after merge
        echo "  Running tests..."
        if command -v cargo &> /dev/null && [ -f "Cargo.toml" ]; then
            if cargo test 2>/dev/null; then
                echo "  TESTS: ✅ Pass"
            else
                echo "  TESTS: ❌ Fail after merge — may need manual intervention"
                FAILED=$((FAILED + 1))
            fi
        elif [ -f "package.json" ]; then
            if npm test 2>/dev/null; then
                echo "  TESTS: ✅ Pass"
            else
                echo "  TESTS: ❌ Fail after merge — may need manual intervention"
                FAILED=$((FAILED + 1))
            fi
        elif [ -f "pyproject.toml" ] || [ -f "setup.py" ]; then
            if python -m pytest 2>/dev/null; then
                echo "  TESTS: ✅ Pass"
            else
                echo "  TESTS: ❌ Fail after merge — may need manual intervention"
                FAILED=$((FAILED + 1))
            fi
        else
            echo "  TESTS: ⚠️ No test runner detected"
        fi
        
        MERGED=$((MERGED + 1))
    else
        echo "  CONFLICT: Merge conflict in $BRANCH"
        CONFLICTS="$CONFLICTS $WT_NAME"
        
        # Show conflicting files
        echo "  Conflicting files:"
        git diff --name-only --diff-filter=U 2>/dev/null | sed 's/^/    /'
        
        # Abort this merge
        git merge --abort 2>/dev/null
        FAILED=$((FAILED + 1))
    fi
    
    echo ""
done

# Cleanup if requested
if [ "$CLEANUP" = "--cleanup" ]; then
    echo "--- Cleanup ---"
    for WT_PATH in $WORKTREES; do
        WT_NAME=$(basename "$WT_PATH")
        BRANCH=$(git -C "$WT_PATH" branch --show-current 2>/dev/null || echo "")
        
        echo "  Removing worktree: $WT_NAME"
        git worktree remove "$WT_PATH" --force 2>/dev/null || true
        
        if [ -n "$BRANCH" ]; then
            echo "  Deleting branch: $BRANCH"
            git branch -D "$BRANCH" 2>/dev/null || true
        fi
    done
    
    git worktree prune
    echo "  Cleanup complete"
fi

echo ""
echo "=== Merge Summary ==="
echo "Merged: $MERGED"
echo "Failed: $FAILED"
if [ -n "$CONFLICTS" ]; then
    echo "Conflicts in:$CONFLICTS"
    echo ""
    echo "To resolve conflicts, spawn a Sonnet agent with the conflict context."
fi
