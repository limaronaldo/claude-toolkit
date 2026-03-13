---
name: mao-tdd
description: >
  Enforces strict test-driven development via a RED-GREEN-REFACTOR state machine
  with a context whiteboard and deterministic validation gates. Use before writing
  any implementation code — write the failing test first, watch it fail, then
  implement. Triggers on "implement", "build", "fix", "add feature", or any task
  that produces code changes. Also use when the user says "test first", "TDD",
  or "red green refactor".
argument-hint: "[feature or fix to implement]"
allowed-tools: Read, Write, Edit, Glob, Grep, Bash(*)
---

# MAO TDD — Test-Driven Development

Every code change follows the Red-Green-Refactor cycle as a strict state machine
with deterministic validation gates. No exceptions without explicit user permission.

## Architecture

TDD is a **loop**, not a linear DAG. The transition between states is governed by
the exit code of the deterministic test runner, not by LLM judgment.

```
  ┌─────────────────────────────────────────────────┐
  │                                                 │
  ▼                                                 │
┌───────┐    test FAILS     ┌───────┐    tests    ┌──────────┐
│  RED  │ ───────────────▶ │ GREEN │ ──────────▶ │ REFACTOR │
│       │  (right reason)   │       │   ALL PASS  │          │
└───────┘                   └───────┘             └──────────┘
  │ test                      │ test                │ tests
  │ PASSES                    │ FAILS               │ FAIL
  ▼                           ▼                     ▼
  REJECT:                     RETRY:                ROLLBACK:
  test is                     fix impl,             restore
  trivial or                  max 3                 GREEN
  wrong                       attempts              snapshot
```

### Key Design Principles

1. **Validation is deterministic, not probabilistic.** The test runner exit code
   routes the next step. No LLM decides whether tests passed.
2. **State transitions are gated.** You physically cannot advance to writing
   implementation until the system verifies a failing test exists.
3. **Errors are routing signals.** Compiler errors and test failures are state
   transitions, not fatal errors.
4. **Each agent sees a derived view, not full history.** The Coder sees the
   failing test and error trace, not the Tester's reasoning.

## Context Whiteboard

Instead of passing conversation history between phases, maintain a structured
state object. See `references/tdd-whiteboard.md` for the full specification.

### Whiteboard Summary

The whiteboard has four zones:

| Zone | Contents | Who Writes |
|------|----------|-----------|
| A: Contract | Feature spec, acceptance criteria, scope | Set once before RED |
| B: Evidence | Test exit code, compiler output, stack trace | Framework only |
| C: Intent | Behavioral hypothesis, impl strategy, cleanup objective | Current agent |
| D: Workspace | Snapshot ID, relevant files, protected files, patches | Framework |

**Core rule:** Preserve artifacts, not thoughts. The Coder does not need to know
what the Tester "thought." It needs the failing test, the error trace, and the
scope boundary.

### Six Questions Answered at All Times

1. What behavior is being added?
2. Which test currently expresses that behavior?
3. Why the current state is RED, GREEN, or REFACTOR?
4. What deterministic evidence supports that state?
5. What files are in scope?
6. What the next agent is allowed to change?

## State Machine

### STATE: RED — Write a Failing Test

**Goal:** Prove that the desired behavior is NOT yet implemented.

**Permissions:** Can modify test files only. Implementation is read-only.

1. Identify the NEXT SINGLE behavior to implement
2. Write ONE test that asserts that behavior
3. Run the test suite (deterministic gate)
4. **GATE: The new test MUST FAIL**
   - If it PASSES → test is trivial or wrong — delete it, write a meaningful one
   - If it fails for the WRONG reason (syntax, import) → fix the test, not the impl
   - If it fails for the RIGHT reason (missing function, wrong return) → proceed to GREEN

**Update whiteboard:**
- Zone A: Set `target_behavior` to the behavioral claim
- Zone C: Write `behavioral_hypothesis`
- Zone B: Record test runner output (framework does this)

**Output after RED:**
```
[TDD:RED] Test: {test name}
[TDD:RED] Command: {test command}
[TDD:RED] Exit code: {N}
[TDD:RED] Failure: {exact assertion or compiler error}
[TDD:RED] → Advancing to GREEN
```

**STOP HERE.** Do not write implementation code in the same response as the test.
Wait for the deterministic test execution result before proceeding.

### STATE: GREEN — Make It Pass

**Goal:** Write the MINIMUM code that makes the failing test pass.

**Permissions:** Can modify implementation files only. Tests are read-only.

**Input:** The Coder receives a focused packet (derived view), NOT full history:
- The failing test code
- The exact error trace (Zone B evidence)
- The relevant implementation spans (not full files)
- The scope boundary

1. Implement ONLY what the test requires — nothing more
2. No edge cases unless they have a failing test
3. No optimizations, no "while I'm here" improvements
4. Propose minimal patches (see `references/patch-protocol.md`)
5. Run the test suite (deterministic gate)
6. **GATE: ALL tests MUST PASS**
   - If the new test FAILS → fix implementation (max 3 attempts, then escalate)
   - If an existing test REGRESSES → fix the regression before proceeding
   - On retry: rebuild from current state, do not continue from old thoughts

**Update whiteboard:**
- Zone C: Write `implementation_strategy`
- Zone B: Record test runner output (framework does this)
- Zone D: Record `last_green_snapshot_id` when all tests pass

**Output after GREEN:**
```
[TDD:GREEN] Implementation: {brief description}
[TDD:GREEN] Command: {test command}
[TDD:GREEN] Exit code: 0
[TDD:GREEN] Result: PASS (all {N} tests)
[TDD:GREEN] Snapshot: {snapshot_id}
[TDD:GREEN] → Advancing to REFACTOR
```

### STATE: REFACTOR — Clean Up (with safety net)

**Goal:** Improve code quality WITHOUT changing behavior.

**Permissions:** Can modify implementation files. Tests and public API are frozen.

**Input:** The Refactor agent sees:
- The passing code checkpoint
- Style and quality goals
- Hard statement: "public behavior is frozen"
- Nothing from previous failed attempts

1. Remove duplication
2. Improve naming
3. Extract helpers only if genuinely needed (not speculatively)
4. Propose minimal patches — one cleanup at a time
5. Run tests after EVERY change — stay green
6. **GATE: ALL tests MUST STILL PASS**
   - If any test FAILS → immediately restore `last_green_snapshot_id`
   - Refactoring that breaks tests is not refactoring — it's a bug

**Update whiteboard:**
- Zone C: Write `cleanup_objective` and `invariants_promised`
- Zone B: Record test runner output (framework does this)

**Output after REFACTOR:**
```
[TDD:REFACTOR] Changes: {what was cleaned up}
[TDD:REFACTOR] Command: {test command}
[TDD:REFACTOR] Exit code: 0
[TDD:REFACTOR] Result: PASS (all {N} tests)
[TDD:REFACTOR] → Cycle complete. Next behavior or done.
```

### REPEAT

Return to RED for the next behavior. Continue until all behaviors specified in
the task are covered.

## Deterministic Gates

Validation is NEVER an LLM inference step. It is a zero-cost compiler/test-runner
execution with binary outcome.

| Gate | Trigger | Pass | Fail |
|------|---------|------|------|
| RED gate | Test runner after writing test | Test fails for right reason → GREEN | Test passes → rewrite test |
| GREEN gate | Test runner after writing impl | All tests pass → REFACTOR | Any test fails → retry (max 3) |
| REFACTOR gate | Test runner after cleanup | All tests pass → keep changes | Any test fails → rollback to GREEN snapshot |

The test runner's exit code is the routing signal. The framework reads it and
routes to the next state. No LLM judges whether "it looks like it passed."

## Patch-Based Editing

Agents propose minimal, typed edits instead of regenerating full files.
See `references/patch-protocol.md` for the full specification.

Key rules:
- Read only relevant spans, not entire files
- Propose targeted edits using Edit tool (old_string → new_string)
- State preconditions in reasoning
- Verify after each edit

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
| Agent modifying files outside its phase permissions | Any | Reject patch, stay in current state |
| Retrying from stale context | GREEN | Rebuild from current workspace state |

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
| Passing full files to agents | Wastes tokens, causes accidental edits, obscures the target |
| Using LLM to judge test results | Introduces hallucination risk; use exit codes |
| Retrying from conversation history | Stale context causes repeated failures; rebuild from current truth |

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
- [ ] Whiteboard checkpoints exist for each state transition

## Integration with MAO

When working as part of a MAO orchestration:

- **mao-implementer** agents MUST follow this state machine for every task
- **mao-worker** agents follow it for non-trivial tasks (skip for pure config/boilerplate)
- **mao-verifier** runs deterministic gates — it does NOT use LLM reasoning to judge results
- The task is NOT done until the verification checklist passes
- The **pre-commit-tdd.sh** hook enforces test existence at commit time
- Whiteboard state is stored in `.orchestrator/artifacts/{task_id}/whiteboard.json`

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
