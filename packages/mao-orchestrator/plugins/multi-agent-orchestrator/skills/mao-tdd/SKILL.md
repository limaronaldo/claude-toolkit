---
name: mao-tdd
description: >
  Enforces test-driven development during task execution. Use before writing
  any implementation code — write the failing test first, watch it fail,
  then implement. Triggers on "implement", "build", "fix", "add feature",
  or any task that produces code changes. Also use when the user says
  "test first", "TDD", or "red green refactor".
argument-hint: "[feature or fix to implement]"
allowed-tools: Read, Write, Edit, Glob, Grep, Bash(*)
---

# MAO TDD — Test-Driven Development

Every code change follows the Red-Green-Refactor cycle. No exceptions without
explicit user permission.

## The Cycle

### RED — Write a Failing Test

Write the smallest test that demonstrates the desired behavior:

1. Identify what the code should do (one behavior per test)
2. Write a test that asserts that behavior
3. Run the test — it MUST fail
4. Verify it fails for the RIGHT reason (missing function, wrong return value — NOT syntax error or import failure)

If the test passes immediately, it proves nothing. Delete it and write a meaningful one.

### GREEN — Make It Pass

Write the simplest code that makes the test pass:

1. Implement only what the test requires — nothing more
2. Run the test — it MUST pass
3. Run the full test suite — no regressions

Resist the urge to add "while I'm here" improvements. That's the refactor step.

### REFACTOR — Clean Up

With green tests as your safety net:

1. Remove duplication
2. Improve naming
3. Extract helpers if genuinely needed (not speculatively)
4. Run tests after every change — stay green

## Anti-Patterns to Catch

These are violations. Stop and correct if you catch yourself doing any:

| Anti-Pattern | Why It's Wrong |
|---|---|
| Writing implementation before a test | You don't know if your test actually tests the right thing |
| Test passes on first run | The test is trivial or wrong — it proves nothing |
| Keeping exploratory code as "reference" | Biases the test toward the implementation, not the behavior |
| "Just this once" without tests | Technical debt compounds; the untested code will break later |
| Over-mocking | Tests pass but production breaks — mock only external boundaries |
| Testing implementation details | Tests become brittle; test behavior and public API, not internals |

## Verification Checklist

Before marking any task complete:

- [ ] Every new function/method has a corresponding test
- [ ] Each test was observed failing before implementation
- [ ] Failures were for expected reasons (not typos or missing imports)
- [ ] Minimal code was written to pass each test
- [ ] Full test suite passes with clean output
- [ ] Edge cases covered (empty input, boundaries, error paths)
- [ ] No mocks for things that can be tested directly

## Integration with MAO

When working as part of a MAO orchestration:

- **mao-implementer** agents follow this cycle for every task
- **mao-worker** agents follow it for non-trivial tasks (skip for pure config/boilerplate)
- **mao-verifier** agents run the full verification checklist
- The task is NOT done until the checklist passes

## Framework Detection

Auto-detect the test framework from the project:

| Stack | Test Command | Test Pattern |
|-------|-------------|--------------|
| Node + Jest | `npx jest` | `*.test.js`, `*.spec.js` |
| Node + Vitest | `npx vitest run` | `*.test.ts`, `*.spec.ts` |
| Node built-in | `node --test` | `*.test.mjs` |
| Python + pytest | `pytest` | `test_*.py` |
| Python + unittest | `python -m unittest` | `test_*.py` |
| Rust | `cargo test` | `#[test]` in source |
| Go | `go test ./...` | `*_test.go` |

Use whatever the project already uses. Don't introduce a new test framework.
