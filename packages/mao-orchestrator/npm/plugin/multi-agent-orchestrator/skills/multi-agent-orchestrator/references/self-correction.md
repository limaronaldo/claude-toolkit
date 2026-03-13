# Self-Correction Reference

## Overview

The system uses five layers of self-correction, each progressively more expensive.
All correction is driven by deterministic evidence (exit codes, compiler output),
not LLM judgment about whether code "looks right."

```
Layer 1: Self-Review (free — agent checks own work)
Layer 2: Deterministic Verification (cheap — test runner, compiler, linter)
Layer 3: Peer Review (medium — Sonnet reviews another agent's code)
Layer 4: Model Escalation (expensive — retry with more powerful model)
Layer 5: Exploration (most expensive — 3 parallel attempts)
```

## Core Principle: Rebuild, Don't Resume

**Retry always means recompute from current truth, not continue from old thoughts.**

When a task fails and needs retry:
1. Read the current workspace state (files as they exist now)
2. Read the current whiteboard Zone B (latest deterministic evidence)
3. Build a fresh focused packet for the agent
4. Agent proposes new patches against the current snapshot

Never pass conversation history from the failed attempt. The agent should see:
- What the code looks like NOW
- What the error is NOW
- What the test expects

This prevents the most common retry failure mode: an agent repeating the same
mistake because it's reasoning from stale context.

## Layer 1: Reflexion (Self-Review)

Every executor runs a self-review before reporting "done":

```markdown
Before reporting completion, answer honestly:

1. Does the code solve the EXACT task specified?
   - Not more (scope creep)
   - Not less (incomplete)

2. Are edge cases handled?
   - What happens with empty input?
   - What happens with null/undefined?
   - What happens at boundary values?
   - What happens with malformed data?

3. Are errors handled meaningfully?
   - Not swallowed silently
   - Not generic "something went wrong"
   - Includes enough context to debug

4. Does it follow existing project patterns?
   - Naming conventions
   - Error handling style
   - Import organization
   - File structure

5. Are tests adequate?
   - Happy path covered
   - At least one error path covered
   - Edge case from point 2 tested

6. Were edits minimal and targeted?
   - No full-file rewrites
   - No changes outside scope
   - Preconditions verified before editing

If ANY answer is "no", fix it before reporting done.
```

This catches ~40% of issues before they reach verification.

## Layer 2: Deterministic Verification

The verifier runs a deterministic pipeline. Results are machine-verifiable facts,
not LLM opinions.

### Evidence Capture

On failure, the verifier captures to whiteboard Zone B:

```json
{
  "task_id": "T3",
  "test_command": "npm test",
  "exit_code": 1,
  "step": "tests",
  "error_type": "assertion_failure",
  "file": "src/auth/middleware.ts",
  "line": 42,
  "message": "Expected 401 but received 200 for expired token",
  "failing_assertion": "assert.equal(response.status, 401)",
  "stack_trace": "at Object.<anonymous> (tests/auth.test.ts:15)",
  "test_names_failed": ["expired token returns 401"]
}
```

### Feedback to Executor on Retry

When retrying, build a fresh focused packet from the whiteboard:

1. The failing test code (read from disk, not from memory)
2. The exact error evidence (Zone B)
3. The relevant implementation spans (re-read from current files)
4. Specific instruction: "Fix the token expiration check in middleware.ts:42"

Specific evidence produces much better fixes than "tests failed, please fix."

### Diagnosing Failure Type

Not all failures are coding errors. The framework should distinguish:

| Failure Type | Symptom | Action |
|---|---|---|
| Retrieval error | Patch targets wrong file/span | Re-run retrieval, not coder |
| Stale context | Patch preconditions fail | Rebuild context from current state |
| Overscoped edit | Patch touches unrelated files | Reject patch, ask for focused edit |
| Implementation error | Tests fail after clean apply | Route back to coder with evidence |

## Layer 3: Peer Review

The reviewer agent analyzes code that passed verification but may have design issues.

### Review Triggers Correction Tasks

```json
{
  "original_task": "T3",
  "correction_task": {
    "id": "T3.1",
    "name": "Add rate limiting to auth endpoint",
    "reason": "Auth endpoint has no rate limiting, vulnerable to brute force",
    "severity": "critical",
    "model": "sonnet",
    "verify": "Rate limit test passes, returns 429 after 5 attempts in 60s"
  }
}
```

Correction tasks are added to the DAG and scheduled normally.
Each correction task follows the full TDD cycle (RED→GREEN→REFACTOR).

## Layer 4: Model Escalation

When an agent fails after 2 retries at the same model tier:

```
Haiku failed 2x → Retry with Sonnet
  - Fresh context from current workspace state
  - Include deterministic evidence: "Previous attempts failed because: {Zone B evidence}"

Sonnet failed 2x → Retry with Opus
  - Fresh context from current workspace state
  - Include all evidence from both tiers
```

### Escalation Budget

Track escalations per run. Default budget: 3 (standard) or 5 (quality).

```json
{
  "escalation_budget": 3,
  "escalations_used": 1,
  "escalation_log": [
    {
      "task": "T4",
      "from": "haiku",
      "to": "sonnet",
      "reason": "Failed type inference on Rust generics",
      "evidence": "compiler error at src/parser.rs:142",
      "resolved": true
    }
  ]
}
```

When budget exhausted, stop escalating and report to user.

## Layer 5: Exploration (Tree-of-Thoughts)

Last resort for high-complexity tasks (score >= 8) that failed escalation.

### Trigger Conditions

ALL of these must be true:
- Task complexity score >= 8
- Task failed at Opus level
- Escalation budget allows it

### Process

1. Orchestrator spawns 3 explorer agents in parallel
2. Each gets the same task but a different strategy:
   - **Conservative**: safest, most conventional approach
   - **Alternative**: different algorithm or design pattern
   - **Minimal**: smallest change that could work
3. Each explorer gets:
   - Fresh context from current workspace
   - The full evidence trail from previous failures
   - Their assigned strategy as a constraint
4. Each implements independently in its own worktree
5. Each follows TDD (RED→GREEN→REFACTOR)
6. Reviewer evaluates all three and picks the best
7. Winning solution is merged, others are discarded

### Cost

Exploration costs ~3x a single Sonnet task. Use rarely.

## Pattern Learning

After each run, record what worked and what didn't:

```json
{
  "task_type": "description keyword",
  "model_attempted": "haiku",
  "succeeded": false,
  "escalated_to": "sonnet",
  "succeeded_after_escalation": true,
  "failure_evidence": "compiler error on complex generics",
  "recommendation": "Route similar tasks directly to sonnet"
}
```

After 3+ similar observations with consistent results,
add to `patterns.json` with confidence based on success rate.

## Whiteboard Checkpoints

Every state transition produces a checkpoint:

```
.orchestrator/artifacts/{task_id}/whiteboard-RED-1.json
.orchestrator/artifacts/{task_id}/whiteboard-GREEN-1.json
.orchestrator/artifacts/{task_id}/whiteboard-REFACTOR-1.json
```

On REFACTOR failure, restore `last_green_snapshot_id` automatically.
On retry, the agent sees the checkpoint, not the failed attempt.

This gives reversibility without requiring the agent to understand rollback.
The framework handles it.
