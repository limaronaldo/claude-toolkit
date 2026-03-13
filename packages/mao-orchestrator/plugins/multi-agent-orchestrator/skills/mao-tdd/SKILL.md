---
name: mao-tdd
description: >
  Enforces strict test-driven development via a RED-GREEN-REFACTOR state machine.
  Use before writing any implementation code — write the failing test first, watch
  it fail, then implement. Triggers on "implement", "build", "fix", "add feature",
  or any task that produces code changes. Also use when the user says
  "test first", "TDD", or "red green refactor".
argument-hint: "[feature or fix to implement]"
allowed-tools: Read, Write, Edit, Glob, Grep, Bash(*)
---

# MAO TDD — Test-Driven Development

Every code change follows the Red-Green-Refactor cycle as a strict state machine.
No exceptions without explicit user permission.

## State Machine

The TDD cycle is NOT a suggestion — it is a sequential state machine with mandatory
validation gates between each state. You MUST complete each state before advancing.

```
  ┌─────────────────────────────────────────────────┐
  │                                                 │
  ▼                                                 │
┌───────┐    test FAILS     ┌───────┐    tests    ┌──────────┐
│  RED  │ ───────────────▶ │ GREEN │ ──────────▶ │ REFACTOR │
│       │                   │       │   PASS      │          │
└───────┘                   └───────┘             └──────────┘
  │ test                      │ test                │ tests
  │ PASSES                    │ FAILS               │ FAIL
  ▼                           ▼                     ▼
  REJECT:                     RETRY:                ROLLBACK:
  test is                     fix impl,             revert to
  trivial or                  max 3                 GREEN code
  wrong                       attempts
```

### STATE: RED — Write a Failing Test

**Goal:** Prove that the desired behavior is NOT yet implemented.

1. Identify the NEXT SINGLE behavior to implement
2. Write ONE test that asserts that behavior
3. Run the test suite
4. **GATE: The new test MUST FAIL**
   - If it PASSES: the test is trivial or wrong — delete it, write a meaningful one
   - If it fails for the WRONG reason (syntax error, import failure): fix the test, not the implementation
   - If it fails for the RIGHT reason (missing function, wrong return value): proceed to GREEN

**Output after RED:**
```
[TDD:RED] Test: {test name}
[TDD:RED] Command: {test command}
[TDD:RED] Result: FAIL (expected)
[TDD:RED] Failure reason: {why it failed}
[TDD:RED] → Advancing to GREEN
```

**STOP HERE.** Do not write implementation code in the same response as the test.
Wait for the test execution result before proceeding.

### STATE: GREEN — Make It Pass

**Goal:** Write the MINIMUM code that makes the failing test pass.

1. Implement ONLY what the test requires — nothing more
2. No edge cases unless they have a failing test
3. No optimizations, no "while I'm here" improvements
4. Run the test suite
5. **GATE: ALL tests MUST PASS**
   - If the new test FAILS: fix the implementation (max 3 attempts, then escalate)
   - If an existing test REGRESSES: fix the regression before proceeding

**Output after GREEN:**
```
[TDD:GREEN] Implementation: {brief description}
[TDD:GREEN] Command: {test command}
[TDD:GREEN] Result: PASS (all {N} tests)
[TDD:GREEN] → Advancing to REFACTOR
```

### STATE: REFACTOR — Clean Up (with safety net)

**Goal:** Improve code quality WITHOUT changing behavior.

1. Remove duplication
2. Improve naming
3. Extract helpers only if genuinely needed (not speculatively)
4. Run tests after EVERY change — stay green
5. **GATE: ALL tests MUST STILL PASS**
   - If any test FAILS: immediately rollback to the GREEN code
   - Refactoring that breaks tests is not refactoring — it's a bug

**Output after REFACTOR:**
```
[TDD:REFACTOR] Changes: {what was cleaned up}
[TDD:REFACTOR] Command: {test command}
[TDD:REFACTOR] Result: PASS (all {N} tests)
[TDD:REFACTOR] → Cycle complete. Next behavior or done.
```

### REPEAT

Return to RED for the next behavior. Continue until all behaviors specified in
the task are covered.

## Violation Detection

These are state machine violations. STOP and correct immediately:

| Violation | State | Correction |
|---|---|---|
| Writing implementation before a test | Pre-RED | Delete implementation, go to RED |
| Test passes on first run | RED | Test is trivial/wrong — rewrite it |
| Writing more code than the test requires | GREEN | Remove excess, stay minimal |
| Adding features during refactor | REFACTOR | Revert, save for next RED cycle |
| Skipping refactor entirely | Post-GREEN | Always evaluate — even "nothing to refactor" is valid |
| Writing multiple tests before implementing | RED | One test at a time — one cycle at a time |
| Writing test AND implementation in same response | RED | STOP after test — wait for execution result |

## Anti-Patterns

| Anti-Pattern | Why It's Wrong |
|---|---|
| Writing implementation before a test | You don't know if your test actually tests the right thing |
| Test passes on first run | The test is trivial or wrong — it proves nothing |
| Keeping exploratory code as "reference" | Biases the test toward the implementation, not the behavior |
| "Just this once" without tests | Technical debt compounds; the untested code will break later |
| Over-mocking | Tests pass but production breaks — mock only external boundaries |
| Testing implementation details | Tests become brittle; test behavior and public API, not internals |
| Tests that mirror implementation | Tests should specify WHAT, not HOW — they're executable specs |

## Verification Checklist

Before marking any task complete:

- [ ] Every new function/method has a corresponding test
- [ ] Each test was observed failing before implementation (RED gate passed)
- [ ] Failures were for expected reasons (not typos or missing imports)
- [ ] Minimal code was written to pass each test (GREEN gate passed)
- [ ] Refactoring did not break any tests (REFACTOR gate passed)
- [ ] Full test suite passes with clean output
- [ ] Edge cases covered (empty input, boundaries, error paths)
- [ ] No mocks for things that can be tested directly
- [ ] TDD log output shows proper RED→GREEN→REFACTOR transitions

## Integration with MAO

When working as part of a MAO orchestration:

- **mao-implementer** agents MUST follow this state machine for every task
- **mao-worker** agents follow it for non-trivial tasks (skip for pure config/boilerplate)
- **mao-verifier** agents verify the TDD log output shows proper RED→GREEN→REFACTOR transitions
- The task is NOT done until the verification checklist passes
- The **pre-commit-tdd.sh** hook enforces test existence at commit time

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
