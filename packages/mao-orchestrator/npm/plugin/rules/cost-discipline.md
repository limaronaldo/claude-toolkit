# Cost Discipline

Always route tasks to the cheapest model capable of solving them.

## Model Routing Targets

- **Haiku (40-50%)**: boilerplate, CRUD, config files, type definitions, formatting, simple verification
- **Sonnet (40-45%)**: business logic, APIs, middleware, refactoring, code review, orchestration
- **Opus (5-15%)**: architecture, decomposition, security-critical code, novel algorithms, meta-reflection

## Rules

- If more than 30% of tasks route to Opus, re-examine — likely over-scored
- Never use Opus for mechanical tasks (renaming, moving files, updating imports)
- Never use Opus for running tests or linting
- Sonnet is the default — only escalate to Opus when the task genuinely requires deep reasoning
- Haiku is preferred for any task that has a clear, deterministic procedure
- After orchestration, log the actual model distribution and compare to targets

## Cost Awareness

- 1 Opus call costs roughly 10x a Haiku call
- 3-5 Opus invocations per orchestration run is the budget
- Expected savings vs all-Opus: 60-70%
- If the user hasn't asked for cost optimization, still follow these targets — it's the right default
