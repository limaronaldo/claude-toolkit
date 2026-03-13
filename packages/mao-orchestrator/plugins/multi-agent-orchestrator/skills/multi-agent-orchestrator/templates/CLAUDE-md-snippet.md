# Multi-Agent Orchestrator — CLAUDE.md Snippet
# Add the content below to your project's CLAUDE.md file.

## Multi-Agent Orchestration

This project uses the Multi-Agent Orchestrator (MAO) for complex tasks.

### When to Use MAO
- Feature implementation spanning 3+ files
- System design requiring architecture before code
- Large refactoring with independent changes
- Any task benefiting from parallel execution

### Agent Naming Convention
All MAO agents are prefixed with `mao-` to avoid collisions:
`mao-architect`, `mao-orchestrator`, `mao-implementer`, `mao-worker`,
`mao-verifier`, `mao-reviewer`, `mao-reflector`, `mao-explorer`

### Model Tiering Rules
- NEVER use Opus for: CRUD, boilerplate, formatting, imports, docs
- ALWAYS use Opus for: decomposition, security logic, novel algorithms, reflection
- DEFAULT to Haiku for: migrations, config, type definitions, simple tests
- DEFAULT to Sonnet for: feature implementation, refactoring, code review

### Cost Discipline
- Haiku first, Sonnet if needed, Opus only when justified
- Max 5 Opus invocations per orchestration run
- Escalation budget: 3 per run (haiku→sonnet or sonnet→opus)
- If approaching limits, inform the user

### Git Worktree Rules
- 1 agent = 1 worktree, never shared
- Merge in dependency order after all tasks complete
- Clean up worktrees after merge
- Worktree names: `wt-{descriptive-name}`

### Orchestration Directory
MAO creates `.orchestrator/` in the project root:
- `state/` — task graph, patterns, metrics
- `artifacts/` — per-task diffs, reasoning, test results
- `messages/` — inter-agent completion/error signals

### Stack Reference
- Customize this section for your project's tech stack

### Verification Pipeline
Every task must pass before merge:
1. Type check (cargo check / tsc --noEmit / mypy)
2. Tests (cargo test / npm test / pytest)
3. Lint (clippy / eslint / ruff)
4. Format (cargo fmt / prettier / ruff format)

### Self-Correction
- Agents self-review before reporting done (Reflexion pattern)
- Failed verification → retry with error context
- 2 failures → escalate model tier
- Critical review findings → generate correction tasks
