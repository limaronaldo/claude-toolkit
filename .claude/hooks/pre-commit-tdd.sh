#!/usr/bin/env bash
# MAO Hook: pre-commit TDD verification
# Ensures test-driven development practices before allowing commits.
# Install: copy to .claude/hooks/ or .git/hooks/pre-commit

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m'

info() { printf "${GREEN}[mao-tdd]${NC} %s\n" "$1"; }
warn() { printf "${YELLOW}[mao-tdd]${NC} %s\n" "$1"; }
fail() { printf "${RED}[mao-tdd]${NC} %s\n" "$1"; exit 1; }

# Detect test runner
detect_test_runner() {
  if [ -f "package.json" ]; then
    if grep -q '"vitest"' package.json 2>/dev/null; then
      echo "npx vitest run"
    elif grep -q '"jest"' package.json 2>/dev/null; then
      echo "npx jest"
    elif grep -q '"test"' package.json 2>/dev/null; then
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

TEST_CMD=$(detect_test_runner)

if [ -z "${TEST_CMD:-}" ]; then
  warn "No test runner detected — skipping TDD check"
  exit 0
fi

# Check if there are staged test files alongside staged source files
STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACM)
STAGED_SRC=$(echo "$STAGED_FILES" | grep -vE '(test|spec|_test\.|\.test\.|\.spec\.)' | grep -E '\.(js|ts|mjs|py|rs|go|java|rb)$' || true)
STAGED_TESTS=$(echo "$STAGED_FILES" | grep -E '(test|spec|_test\.|\.test\.|\.spec\.)' || true)

if [ -n "$STAGED_SRC" ] && [ -z "$STAGED_TESTS" ]; then
  warn "Source files staged without corresponding test files"
  warn "TDD requires: write test first, then implementation"
  warn "Staged source files:"
  echo "$STAGED_SRC" | while read -r f; do warn "  $f"; done
  warn ""
  warn "Set MAO_SKIP_TDD=1 to bypass this check"
  if [ "${MAO_SKIP_TDD:-0}" = "1" ]; then
    warn "TDD check bypassed via MAO_SKIP_TDD=1"
    exit 0
  fi
  fail "Commit blocked: add tests for your changes"
fi

# Run the test suite
info "Running tests: $TEST_CMD"
if eval "$TEST_CMD" >/dev/null 2>&1; then
  info "All tests pass"
else
  fail "Tests failed — fix before committing"
fi
