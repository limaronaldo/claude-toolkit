# Cost Discipline

Route tasks to the appropriate model based on the active quality level.

## Quality Levels

### Standard (default)

Optimize for cost — use the cheapest model that can solve each task.

- **Haiku (40-50%)**: boilerplate, CRUD, config files, type definitions, formatting, simple verification
- **Sonnet (40-45%)**: business logic, APIs, middleware, refactoring, code review, orchestration
- **Opus (5-15%)**: architecture, decomposition, security-critical code, novel algorithms, meta-reflection

### Quality (`--quality`)

Optimize for output quality — shift tasks up one model tier.

- **Sonnet (40-50%)**: boilerplate, CRUD, config files, type definitions, verification
- **Opus (50-60%)**: everything else — features, business logic, APIs, review, architecture

## Rules

### Standard level
- If more than 30% of tasks route to Opus, re-examine — likely over-scored
- Never use Opus for mechanical tasks (renaming, moving files, updating imports)
- Never use Opus for running tests or linting
- Sonnet is the default — only escalate to Opus when the task genuinely requires deep reasoning
- Haiku is preferred for any task that has a clear, deterministic procedure
- 3-5 Opus invocations per run is the budget

### Quality level
- Haiku is never used — minimum model is Sonnet
- Opus is the default for anything involving logic, not just deep reasoning
- Verification uses Sonnet instead of Haiku
- Code review uses Opus instead of Sonnet
- Up to 15 Opus invocations per run

### Both levels
- After orchestration, log the actual model distribution and compare to targets
- If the user specifies a level, use it; otherwise default to standard

## Cost Awareness

- 1 Opus call costs roughly 10x a Haiku call
- Standard: expected savings vs all-Opus: 60-70%
- Quality: expected savings vs all-Opus: 20-30%
