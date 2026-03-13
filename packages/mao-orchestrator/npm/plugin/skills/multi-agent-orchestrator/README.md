# multi-agent-orchestrator skill

A Claude Code skill that transforms a session into a coordinated multi-agent system. Opus understands the problem, Sonnet orchestrates execution, and tasks route to the cheapest model that can solve them — with self-correction loops ensuring quality.

## Install

```bash
# Via mao-orchestrator (recommended — installs agents + commands + skill)
npx mao-orchestrator init

# Manual — copy skill to your Claude skills directory
cp -r . ~/.claude/skills/multi-agent-orchestrator/
```

## How it works

```
Opus UNDERSTANDS → Sonnet ORCHESTRATES → Haiku/Sonnet/Opus EXECUTE
```

| Phase | Model | What happens |
|-------|-------|-------------|
| Decompose | Opus | Break request into DAG of atomic tasks |
| Schedule | Sonnet | Validate DAG, calculate parallelism, set up worktrees |
| Execute | Haiku/Sonnet/Opus | Each task runs in its own git worktree |
| Verify | Haiku | type-check → tests → lint → format |
| Review | Sonnet | Cross-agent code review |
| Reflect | Opus | Meta-analysis (complex runs only) |
| Integrate | Sonnet | Merge worktrees sequentially |

## When Claude triggers this skill

- User says "implement X" where X spans 3+ files
- User mentions: "multi-agent", "orchestrate", "parallelize", "decompose"
- User wants cost optimization (avoids all-Opus runs)

Skip this skill for 1-2 file changes — direct implementation is faster.

## Cost targets

| Model | % of tasks |
|-------|-----------|
| Haiku | 40-50% |
| Sonnet | 40-45% |
| Opus | 5-15% |

**Expected savings vs all-Opus: 60-70%**

## Agents included

| Agent | Model | Role |
|-------|-------|------|
| `mao-architect` | opus | Decompose problems, design task DAGs |
| `mao-orchestrator` | sonnet | Schedule, coordinate, manage state |
| `mao-implementer` | sonnet | Build features, implement business logic |
| `mao-worker` | haiku | Mechanical tasks: CRUD, boilerplate, migrations |
| `mao-verifier` | haiku | Run test/lint/type-check pipelines |
| `mao-reviewer` | sonnet | Cross-agent code review |
| `mao-reflector` | opus | Meta-analysis, pattern learning |
| `mao-explorer` | sonnet | Parallel solution search for hard failures |

## Reference files

| File | Purpose |
|------|---------|
| `references/task-decomposition.md` | DAG decomposition instructions |
| `references/dag-scheduler.md` | Scheduling algorithm |
| `references/model-routing.md` | Model assignment rules |
| `references/self-correction.md` | Retry and escalation strategies |
| `references/worktree-ops.md` | Git worktree setup and teardown |

## Part of

[limaronaldo/claude-toolkit](https://github.com/limaronaldo/claude-toolkit) — monorepo containing Claude Primer + MAO Orchestrator + claude-supertools CLI.
