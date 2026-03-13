---
name: multi-agent-orchestrator
description: >
  Orchestrates multi-agent workflows with intelligent model tiering (Opus/Sonnet/Haiku),
  git worktrees for parallelism, DAG-based task scheduling, and self-correction loops.
  Use this skill whenever the user asks to implement a complex feature, build a system,
  refactor a large codebase, or any task that benefits from decomposition into parallel
  subtasks. Also trigger when the user mentions "multi-agent", "orchestrate", "parallelize",
  "decompose", "plan and execute", or wants to optimize Claude Code usage costs.
  Even if the user just says "implement X" where X is clearly multi-file or multi-concern,
  use this skill to decompose and coordinate efficiently.
argument-hint: "[task description]"
allowed-tools: Read, Write, Edit, Glob, Grep, Bash(*), Agent
---

# Multi-Agent Orchestrator

Transforms a Claude Code session into a coordinated multi-agent system. Opus understands
the problem, Sonnet orchestrates execution, and tasks route to the cheapest model that
can solve them — with self-correction loops ensuring quality.

## Core Philosophy

```
Opus UNDERSTANDS → Sonnet ORCHESTRATES → Haiku/Sonnet/Opus EXECUTE
```

### Quality Levels

MAO supports two quality levels that control model assignment:

- **`standard`** (default) — cost-efficient. Uses cheapest model per task.
  `/mao <task>` or `/mao-plan <task>`
- **`quality`** — maximum quality. Shifts all tasks up one model tier.
  `/mao --quality <task>` or `/mao-plan --quality <task>`

See `references/model-routing.md` for detailed routing tables per level.

## When to Use This Skill

- Feature implementation spanning 3+ files
- System design that needs architecture before code
- Large refactoring with multiple independent changes
- Any task where parallel execution saves time
- When cost optimization matters (avoiding Opus for simple work)

For simple 1-2 file changes, skip this skill — direct implementation is faster.

## Composable Skills

These skills work standalone OR as part of the full orchestration:

| Skill | Standalone use | Role in orchestration |
|-------|---------------|----------------------|
| `/mao-plan` | Decompose any task into a DAG | Phase 1 — Decompose |
| `/mao-worktree` | Set up isolated git worktrees | Phase 2 — Setup |
| `/mao-tdd` | Test-driven development cycle | Phase 3 — Execute |
| `/mao-review` | Structured code review | Phase 5 — Review |

## Hooks

Automate workflow enforcement. Install to `.claude/hooks/` or `.git/hooks/`:

| Hook | Trigger | What it does |
|------|---------|-------------|
| `pre-commit-tdd.sh` | Before commit | Verifies tests exist for staged source files, runs test suite |
| `post-task-review.sh` | After task completion | Flags completed tasks pending review |
| `pre-merge-verify.sh` | Before worktree merge | Runs type-check + lint + tests before allowing merge |

## Rules

Always-loaded guidelines (install to `.claude/rules/`):

| Rule | Enforces |
|------|----------|
| `cost-discipline.md` | 40-50% haiku, 40-45% sonnet, 5-15% opus; max 3-5 Opus calls per run |
| `worktree-hygiene.md` | .gitignore check, one agent per worktree, cleanup after merge |
| `commit-format.md` | Conventional commits with task ID scope, no co-authored-by |

## Reference Files

Read these as needed during execution. Don't load all upfront.

| Phase | File | When to Read |
|-------|------|--------------|
| Decomposition | `references/task-decomposition.md` | Breaking down user request |
| Scheduling | `references/dag-scheduler.md` | Planning execution order |
| Model Routing | `references/model-routing.md` | Assigning models to tasks |
| Self-Correction | `references/self-correction.md` | When verification fails |
| Worktrees | `references/worktree-ops.md` | Setting up parallel execution |
| TDD State | `references/tdd-whiteboard.md` | Context whiteboard for TDD cycles |
| Editing | `references/patch-protocol.md` | Minimal patch-based editing protocol |

## The Workflow

### Phase 1 — Decompose (Opus)

Read `references/task-decomposition.md` for detailed instructions.

Analyze user's request. Break into atomic tasks. Map dependencies as a DAG.
Score complexity. Define verification criteria. Output `.orchestrator/state/task-graph.json`.

DAG, not phases — tasks declare dependencies, scheduler runs anything whose deps are met.

### Phase 2 — Schedule & Setup (Sonnet)

Read `references/dag-scheduler.md` for the scheduling algorithm.

Validate DAG. Calculate max parallelism. Apply resource limits (max 4-6 agents).
Set up worktrees via `scripts/setup-worktrees.sh`. Initialize task board.

### Phase 3 — Execute (Haiku/Sonnet/Opus)

Each executor runs in its own worktree. Every executor self-reviews before
reporting done (Reflexion pattern). Commits changes to worktree branch.

### Phase 4 — Verify (Haiku)

Deterministic pipeline: type-check → tests → lint → format.
On failure: retry same agent → peer review → model escalation.
Read `references/self-correction.md` for retry strategies.

### Phase 5 — Review (Sonnet)

Cross-agent code review: security, performance, design, completeness.
Creates correction tasks if issues found — re-enters Phase 3.

### Phase 6 — Reflect (Opus)

Only for complex runs (8+ tasks). Meta-analysis: did we solve the real problem?
Updates `patterns.json` for future routing optimization.

### Phase 7 — Integrate

Merge worktrees sequentially via `scripts/merge-worktrees.sh`.
Test after each merge. Spawn resolver on conflicts. Clean up.

## Agent Roster

Install from `agents/` directory into `.claude/agents/` or `~/.claude/agents/`:

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

Prefix `mao-` avoids name collisions with other agent sets.

## Directory Structure

The orchestrator creates and manages:

```
.orchestrator/
├── state/
│   ├── task-graph.json      # DAG: tasks, deps, status, assignments
│   ├── patterns.json        # Learned model routing patterns
│   └── metrics.json         # Cost, latency, success rates per model
├── artifacts/
│   └── T1/                  # Per-task: patch, reasoning, test results
│       ├── patch.diff
│       ├── reasoning.md
│       └── test-results.json
└── messages/                # Inter-agent completion/error signals
```

## Cost Targets

### Standard level

| Model | % of Tasks | When |
|-------|-----------|------|
| Haiku | 40-50% | Boilerplate, CRUD, verification, formatting |
| Sonnet | 40-45% | Features, orchestration, review, refactoring |
| Opus | 5-15% | Decomposition, reflection, security, novel algorithms |

Expected savings vs all-Opus: **60-70%**. Max Opus invocations: 5.

### Quality level

| Model | % of Tasks | When |
|-------|-----------|------|
| Sonnet | 40-50% | Boilerplate, CRUD, config, verification |
| Opus | 50-60% | Features, review, orchestration, algorithms, architecture |

Expected savings vs all-Opus: **20-30%**. Max Opus invocations: 15.

## Constraints

### Standard level
- Max parallel agents: 4
- Max Opus concurrent: 1
- Max Opus invocations per run: 5
- Escalation budget: 3

### Quality level
- Max parallel agents: 4
- Max Opus concurrent: 2
- Max Opus invocations per run: 15
- Escalation budget: 5

### Both levels
- 1 agent = 1 worktree, never shared
- If `model:` field has issues, use `opusplan` mode as fallback

## Quick Start (Small Tasks)

For 3-5 task runs, skip the full ceremony:

1. Decompose into tasks with complexity scores
2. Route to models based on score
3. Set up worktrees for parallel tasks
4. Execute → verify → merge

Full 7-phase loop for 6+ task complex systems only.
