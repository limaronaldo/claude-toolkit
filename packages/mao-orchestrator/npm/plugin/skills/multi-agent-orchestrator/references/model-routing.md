# Model Routing Reference

## Quality Levels

MAO supports two quality levels that control how aggressively models are assigned:

### `standard` (default) — Cost-efficient

Optimizes for cost. Uses the cheapest model that can solve each task.

| Score | Model | Agent | Typical Tasks |
|-------|-------|-------|---------------|
| 0-3 | haiku | mao-worker | Migrations, CRUD, boilerplate, docs, config, formatting |
| 4-7 | sonnet | mao-implementer | Features, refactoring, integration, complex tests |
| 8-14 | opus | mao-implementer | Security logic, concurrency, novel algorithms, architecture |

**Target distribution:** 40-50% haiku, 40-45% sonnet, 5-15% opus
**Expected cost savings vs all-opus:** 60-70%

**Override rules:**
- Decomposition → Opus
- Verification → Haiku
- Review → Sonnet
- Reflection → Opus

### `quality` — Maximum quality

Optimizes for output quality. Shifts tasks up one model tier. Use when correctness matters
more than cost (security features, production releases, unfamiliar codebases).

| Score | Model | Agent | Typical Tasks |
|-------|-------|-------|---------------|
| 0-3 | sonnet | mao-implementer | Migrations, CRUD, boilerplate, docs, config |
| 4-7 | opus | mao-implementer | Features, refactoring, integration, complex tests |
| 8-14 | opus | mao-implementer | Security logic, concurrency, novel algorithms |

**Target distribution:** 0% haiku, 40-50% sonnet, 50-60% opus
**Expected cost savings vs all-opus:** 20-30%

**Override rules:**
- Decomposition → Opus
- Verification → Sonnet (upgraded from haiku)
- Review → Opus (upgraded from sonnet)
- Reflection → Opus

**Budget adjustments for `quality` level:**
```json
{
  "max_opus_invocations": 15,
  "max_opus_concurrent": 2,
  "escalation_budget": 5
}
```

### How to choose

| Situation | Level |
|-----------|-------|
| Routine features, familiar codebase | `standard` |
| Prototyping, boilerplate-heavy work | `standard` |
| Security-critical code | `quality` |
| Production release prep | `quality` |
| Unfamiliar or complex codebase | `quality` |
| High-stakes refactoring | `quality` |

## Complexity Scoring

Every task is scored to determine model assignment based on the active quality level.

### Scoring Formula

```
score = files_touched × 1
      + new_logic × 3
      + security_risk × 5
      + concurrency × 5
```

### Factor Definitions

| Factor | Value | Trigger |
|--------|-------|---------|
| `files_touched` | 1 | Task modifies 3+ files |
| `new_logic` | 3 | Task creates new algorithms, business rules, or decision trees (not CRUD) |
| `security_risk` | 5 | Task involves auth, encryption, access control, data sanitization, or PII |
| `concurrency` | 5 | Task involves race conditions, locks, async coordination, or shared state |

Each factor is binary (0 or 1). Maximum possible score: 14.

## Pattern-Based Routing

After multiple runs, the system learns patterns. Check `.orchestrator/state/patterns.json`
before applying the formula. If a pattern matches with confidence ≥ 0.7, use it:

```json
{
  "patterns": [
    {
      "task_type": "rust_lifetime_annotations",
      "recommended_model": "sonnet",
      "reason": "Haiku fails 80% of the time on complex lifetime bounds",
      "confidence": 0.8,
      "observations": 4
    }
  ]
}
```

Pattern matching is keyword-based: if the task name/description contains the
`task_type` string, apply the recommendation.

## Cost Awareness

### Relative Costs (approximate)

| Model | Input $/1M tokens | Output $/1M tokens | Relative |
|-------|-------------------|---------------------|----------|
| Haiku | $0.80 | $4.00 | 1x |
| Sonnet | $3.00 | $15.00 | ~3-4x |
| Opus | $15.00 | $75.00 | ~15-19x |

### Budget Constraints

Per-run limits to prevent cost explosions:

**Standard level:**
```json
{
  "max_opus_invocations": 5,
  "max_opus_concurrent": 1,
  "max_total_tasks": 20,
  "escalation_budget": 3
}
```

**Quality level:**
```json
{
  "max_opus_invocations": 15,
  "max_opus_concurrent": 2,
  "max_total_tasks": 20,
  "escalation_budget": 5
}
```

If opus limit is reached, fallback to sonnet for remaining opus-tier tasks.
Report this to the user so they're aware of the quality tradeoff.

## Escalation Chain

When a task fails verification:

```
Attempt 1: Same model, add error context
Attempt 2: Same model, peer review hint added
Attempt 3: Escalate to next model tier

haiku → sonnet → opus → exploration (3 parallel sonnet attempts)
```

Each escalation increments `escalation_budget`. When budget exhausted,
report failure to user instead of continuing to escalate.

## Decision Tree

### Standard Level
```
Is this task decomposition or reflection?
  YES → Opus
  NO ↓

Is this verification (tests, lint, type-check)?
  YES → Haiku
  NO ↓

Is this code review?
  YES → Sonnet
  NO ↓

Does a learned pattern match with confidence ≥ 0.7?
  YES → Use pattern's recommended model
  NO ↓

Compute complexity score:
  0-3 → Haiku (mao-worker)
  4-7 → Sonnet (mao-implementer)
  8+  → Opus (mao-implementer with opus override)
```

### Quality Level
```
Is this task decomposition or reflection?
  YES → Opus
  NO ↓

Is this verification (tests, lint, type-check)?
  YES → Sonnet
  NO ↓

Is this code review?
  YES → Opus
  NO ↓

Does a learned pattern match with confidence ≥ 0.7?
  YES → Use max(pattern's model, sonnet)
  NO ↓

Compute complexity score:
  0-3 → Sonnet (mao-implementer)
  4+  → Opus (mao-implementer)
```
