# Model Routing Reference

## Complexity Scoring

Every task is scored to determine the cheapest model that can solve it.

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

### Routing Table

| Score | Model | Agent | Typical Tasks |
|-------|-------|-------|---------------|
| 0-3 | haiku | mao-worker | Migrations, CRUD, boilerplate, docs, config, formatting |
| 4-7 | sonnet | mao-implementer | Features, refactoring, integration, complex tests |
| 8-14 | opus | mao-implementer | Security logic, concurrency, novel algorithms, architecture |

### Override Rules

These override the score-based routing:

1. **Decomposition is always Opus** — understanding the problem deeply pays for itself
2. **Verification is always Haiku** — deterministic checks don't need reasoning
3. **Review is always Sonnet** — needs reasoning but not the deepest level
4. **Reflection is always Opus** — meta-analysis benefits from deep reasoning

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

```json
{
  "max_opus_invocations": 5,
  "max_total_tasks": 20,
  "escalation_budget": 3
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
