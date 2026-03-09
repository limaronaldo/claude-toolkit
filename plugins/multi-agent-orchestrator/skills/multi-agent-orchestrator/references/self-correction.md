# Self-Correction Reference

## Overview

The system uses three layers of self-correction, each progressively more expensive:

```
Layer 1: Self-Review (free — agent checks own work)
Layer 2: Automated Verification (cheap — Haiku runs tests/lint)
Layer 3: Peer Review (medium — Sonnet reviews another agent's code)
Layer 4: Model Escalation (expensive — retry with more powerful model)
Layer 5: Exploration (most expensive — 3 parallel attempts)
```

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

If ANY answer is "no", fix it before reporting done.
```

This catches ~40% of issues before they reach verification.

## Layer 2: Automated Verification

The verifier agent runs a deterministic pipeline. On failure:

### Error Report Format

```json
{
  "task_id": "T3",
  "step": "tests",
  "error_type": "assertion_failure",
  "file": "src/auth/middleware.ts",
  "line": 42,
  "message": "Expected 401 but received 200 for expired token",
  "context": "The test sends a request with an expired JWT and expects rejection"
}
```

### Feedback to Executor

When retrying, provide the executor with:
1. The exact error (file, line, message)
2. The test that failed and what it expected
3. The specific instruction: "Fix the token expiration check in middleware.ts:42"

Specific feedback produces much better fixes than "tests failed, please fix".

## Layer 3: Peer Review

The reviewer agent analyzes code that passed verification but may have design issues:

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

## Layer 4: Model Escalation

When an agent fails after 2 retries at the same model tier:

```
Haiku failed 2x → Retry with Sonnet
  - Add all error context from failed attempts
  - Include: "Previous Haiku agent failed because: {reasons}"

Sonnet failed 2x → Retry with Opus
  - Add all error context
  - Include: "Both Haiku and Sonnet failed. Errors: {all_errors}"
```

### Escalation Budget

Track escalations per run. Default budget: 3.

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
      "resolved": true
    }
  ]
}
```

When budget exhausted, stop escalating and report to user.

## Layer 5: Exploration (Tree-of-Thoughts)

Last resort for high-complexity tasks (score ≥ 8) that failed escalation.

### Trigger Conditions

ALL of these must be true:
- Task complexity score ≥ 8
- Task failed at Opus level
- Escalation budget allows it

### Process

1. Orchestrator spawns 3 explorer agents in parallel
2. Each gets the same task but a different strategy:
   - **Conservative**: safest, most conventional approach
   - **Alternative**: different algorithm or design pattern
   - **Minimal**: smallest change that could work
3. Each explorer implements independently in its own worktree
4. Reviewer evaluates all three and picks the best
5. Winning solution is merged, others are discarded

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
  "recommendation": "Route similar tasks directly to sonnet"
}
```

After 3+ similar observations with consistent results,
add to `patterns.json` with confidence based on success rate.
