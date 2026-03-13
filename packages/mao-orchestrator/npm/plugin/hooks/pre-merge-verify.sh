#!/usr/bin/env bash
# MAO Hook: pre-merge verification
# Runs the full test suite before allowing worktree branch merges.
# Ensures no regressions are introduced when integrating agent work.

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m'

info() { printf "${GREEN}[mao-merge]${NC} %s\n" "$1"; }
warn() { printf "${YELLOW}[mao-merge]${NC} %s\n" "$1"; }
fail() { printf "${RED}[mao-merge]${NC} %s\n" "$1"; exit 1; }

# Detect test runner
detect_test_runner() {
  if [ -f "package.json" ]; then
    if grep -q '"test"' package.json 2>/dev/null; then
      echo "npm test"
    fi
  elif [ -f "pytest.ini" ] || [ -f "pyproject.toml" ] || [ -f "setup.cfg" ]; then
    echo "pytest"
  elif [ -f "Cargo.toml" ]; then
    echo "cargo test"
  elif [ -f "go.mod" ]; then
    echo "go test ./..."
  fi
}

# Check if this is a MAO worktree merge (branch starts with mao/)
MERGE_HEAD="${1:-}"
if [ -z "$MERGE_HEAD" ]; then
  # Try to detect from git merge state
  if [ -f ".git/MERGE_HEAD" ]; then
    MERGE_HEAD=$(git log -1 --format='%D' "$(cat .git/MERGE_HEAD)" 2>/dev/null | grep -o 'mao/[^ ,]*' || true)
  fi
fi

if [ -z "$MERGE_HEAD" ]; then
  exit 0
fi

info "Pre-merge verification for: $MERGE_HEAD"

# Check for worktree cleanup
ACTIVE_WORKTREES=$(git worktree list --porcelain 2>/dev/null | grep -c "^worktree " || echo "0")
if [ "$ACTIVE_WORKTREES" -gt 1 ]; then
  info "Active worktrees: $ACTIVE_WORKTREES"
fi

# Run type checking if available
if [ -f "tsconfig.json" ] && command -v npx >/dev/null 2>&1; then
  info "Running type check..."
  if npx tsc --noEmit >/dev/null 2>&1; then
    info "Type check passed"
  else
    fail "Type check failed — fix before merging"
  fi
fi

# Run linter if available
if [ -f ".eslintrc.json" ] || [ -f ".eslintrc.js" ] || [ -f "eslint.config.js" ]; then
  if command -v npx >/dev/null 2>&1; then
    info "Running linter..."
    if npx eslint . --quiet >/dev/null 2>&1; then
      info "Lint passed"
    else
      warn "Lint warnings found (non-blocking)"
    fi
  fi
fi

# Run tests
TEST_CMD=$(detect_test_runner)
if [ -n "${TEST_CMD:-}" ]; then
  info "Running tests: $TEST_CMD"
  if eval "$TEST_CMD" >/dev/null 2>&1; then
    info "All tests pass — safe to merge"
  else
    fail "Tests failed — do not merge"
  fi
else
  warn "No test runner detected — skipping test verification"
fi

info "Pre-merge verification complete"
