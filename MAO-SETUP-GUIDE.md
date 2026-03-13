# MAO Orchestrator — Setup & Usage Guide

> A step-by-step guide for AI assistants to install and use the Multi-Agent Orchestrator
> with Claude Code.

---

## 1. Installation

### Prerequisites

- **Node.js** >= 18
- **Claude Code** installed and working (`claude` command available)
- **Git** initialized in your project

### Install globally (recommended — works across all projects)

```bash
npx mao-orchestrator init --global
```

This creates symlinks in `~/.claude/` so MAO is available in every project.

### Install locally (current project only)

```bash
npx mao-orchestrator init
```

This copies files into `./.claude/` for the current project.

### Verify installation

```bash
npx mao-orchestrator doctor
```

Doctor runs 30 checks: plugin directory, all 8 agents, 3 commands, 5 skills, 3 hooks, 3 rules, and Node.js version. All checks should pass.

```bash
npx mao-orchestrator status
```

Shows whether MAO is installed globally, locally, or both.

### Add to .gitignore

The installer does this automatically, but verify `.orchestrator/` is in your `.gitignore`:

```
.orchestrator/
```

This directory holds runtime state (task graphs, artifacts) and should not be committed.

---

## 2. What Gets Installed

| Category | Count | Location |
|----------|-------|----------|
| Agents | 8 | `.claude/agents/mao-*.md` |
| Commands | 3 | `.claude/commands/mao*.md` |
| Skills | 5 | `.claude/skills/*/SKILL.md` |
| Hooks | 3 | `.claude/hooks/*.sh` |
| Rules | 3 | `.claude/rules/*.md` |

### Agents

| Agent | Model | Role |
|-------|-------|------|
| `mao-architect` | Opus | Decomposes problems into a task DAG |
| `mao-orchestrator` | Sonnet | Schedules tasks, manages worktrees, spawns agents |
| `mao-implementer` | Sonnet | Builds features (complexity 4-7), strict TDD |
| `mao-worker` | Haiku | Boilerplate, config, CRUD (complexity 1-3) |
| `mao-verifier` | Haiku | Runs type-check, tests, lint, format |
| `mao-reviewer` | Sonnet | Cross-agent code review |
| `mao-reflector` | Opus | Meta-analysis (runs with 8+ tasks only) |
| `mao-explorer` | Sonnet | Parallel solution search when tasks fail |

### Slash Commands

| Command | Purpose |
|---------|---------|
| `/mao <task>` | Full orchestration: plan + execute + verify + review + merge |
| `/mao-plan <task>` | Decompose task into DAG without executing |
| `/mao-status` | Check progress of a running orchestration |

### Skills (composable — can be used independently)

| Skill | Purpose |
|-------|---------|
| `multi-agent-orchestrator` | Full 7-phase orchestration |
| `mao-plan` | Task decomposition only |
| `mao-worktree` | Git worktree management |
| `mao-tdd` | Test-driven development state machine |
| `mao-review` | Structured code review |

### Hooks

| Hook | Trigger |
|------|---------|
| `pre-commit-tdd.sh` | Before commit — ensures tests exist for changes |
| `post-task-review.sh` | After task completion — triggers review |
| `pre-merge-verify.sh` | Before merge — final verification |

### Rules

| Rule | Enforces |
|------|----------|
| `cost-discipline.md` | Model tier usage and cost budgets |
| `worktree-hygiene.md` | Clean worktree lifecycle |
| `commit-format.md` | Conventional commit messages |

---

## 3. Usage

### Quality levels

MAO has two quality levels that control how models are assigned to tasks:

| Level | Flag | Description |
|-------|------|-------------|
| **standard** | _(default)_ | Cost-efficient — uses cheapest capable model per task |
| **quality** | `--quality` | Maximum quality — shifts all tasks up one model tier |

```bash
# Standard (default) — more haiku, cost-efficient
/mao Implement user authentication

# Quality — more opus and sonnet, higher quality output
/mao --quality Implement user authentication
```

The same flag works with `/mao-plan`:
```bash
/mao-plan --quality Redesign the payment processing pipeline
```

### Quick start — Full orchestration

In Claude Code, type:

```
/mao Implement user authentication with JWT tokens, including login, logout, and token refresh endpoints
```

This triggers the full 7-phase workflow:
1. **Decompose** — Opus breaks the task into atomic sub-tasks
2. **Schedule** — Creates git worktrees, assigns models
3. **Execute** — Spawns parallel agents in isolated worktrees
4. **Verify** — Type-check, tests, lint, format
5. **Review** — Cross-agent code review
6. **Reflect** — Meta-analysis (only for 8+ task runs)
7. **Integrate** — Merges worktrees in dependency order

### Plan first, then execute

If you want to review the plan before executing:

```
/mao-plan Add a caching layer to the API with Redis
```

This creates `.orchestrator/state/task-graph.json` with the decomposed tasks. You can:
- Review the plan
- Edit the task graph (change models, dependencies, descriptions)
- Then execute with `/mao` (it detects the existing plan)

### Check progress

While an orchestration is running:

```
/mao-status
```

Shows: task board, DAG waves, completion percentage, escalation log.

### Validate a task graph

```bash
npx mao-orchestrator validate .orchestrator/state/task-graph.json
```

Checks: valid JSON, all tasks have required fields, dependencies reference valid IDs, no cycles.

---

## 4. How It Works

### Task Complexity Scoring

Each task gets a complexity score based on:

```
score = files_touched(×1) + new_logic(×3) + security_risk(×5) + concurrency(×5)
```

**Standard level:**

| Score | Model | Use Case |
|-------|-------|----------|
| 0-3 | Haiku | CRUD, boilerplate, config files, type definitions |
| 4-7 | Sonnet | Features, business logic, APIs, tests |
| 8-14 | Opus | Security-critical, complex algorithms, architecture |

**Quality level:**

| Score | Model | Use Case |
|-------|-------|----------|
| 0-3 | Sonnet | CRUD, boilerplate, config files, type definitions |
| 4-7 | Opus | Features, business logic, APIs, tests |
| 8-14 | Opus | Security-critical, complex algorithms, architecture |

### DAG Waves

Tasks are grouped into waves. Tasks within a wave run in parallel:

```
Wave 1: T1, T2 (parallel — no dependencies)
Wave 2: T3, T4 (parallel — depend on Wave 1)
Wave 3: T5 (depends on Wave 2)
```

Max 4 parallel agents. Max 1 Opus agent at a time.

### Self-Correction

When a task fails:
1. **Retry 1** — Same model + error context
2. **Retry 2** — Peer review suggestions added
3. **Retry 3** — Model escalation (haiku → sonnet → opus)
4. **Last resort** — 3 parallel Explorer agents try different strategies

Max 2 retries per task. Max 3 escalations per run.

### TDD Enforcement

All implementation agents follow strict RED-GREEN-REFACTOR:

1. **RED** — Write ONE failing test. Run it. It MUST fail. Stop.
2. **GREEN** — Write MINIMUM code to pass. Run ALL tests. They MUST pass.
3. **REFACTOR** — Clean up without changing behavior. Tests MUST still pass.
4. **REPEAT** for the next behavior.

The `pre-commit-tdd.sh` hook enforces test existence at commit time.

### Cost Profile

**Standard level (default):**
- 40-50% Haiku tasks (~5% of total cost)
- 40-45% Sonnet tasks (~40% of total cost)
- 5-15% Opus tasks (~55% of total cost)
- Expected savings vs all-Opus: **60-70%**

**Quality level (`--quality`):**
- 0% Haiku tasks
- 40-50% Sonnet tasks (~15% of total cost)
- 50-60% Opus tasks (~85% of total cost)
- Expected savings vs all-Opus: **20-30%**

---

## 5. Task Graph Schema

The task graph at `.orchestrator/state/task-graph.json` has this structure:

```json
{
  "version": 1,
  "intent": "What the user asked for",
  "created_at": "2026-03-13T12:00:00Z",
  "config": {
    "max_parallel_agents": 4,
    "max_opus_concurrent": 1,
    "max_retries_per_task": 2,
    "escalation_budget": 3
  },
  "tasks": [
    {
      "id": "T1",
      "name": "Create user model",
      "description": "Define User schema with email, password hash, timestamps",
      "complexity_score": 2,
      "model": "haiku",
      "deps": [],
      "verify": "npm test -- --grep 'User model'",
      "estimated_files": ["src/models/user.ts"],
      "status": "pending"
    },
    {
      "id": "T2",
      "name": "Implement login endpoint",
      "description": "POST /auth/login with email/password, returns JWT",
      "complexity_score": 5,
      "model": "sonnet",
      "deps": ["T1"],
      "verify": "npm test -- --grep 'login'",
      "estimated_files": ["src/routes/auth.ts", "src/middleware/jwt.ts"],
      "status": "pending"
    }
  ],
  "dag_waves": [
    { "wave": 1, "tasks": ["T1"] },
    { "wave": 2, "tasks": ["T2"] }
  ]
}
```

### Editing the task graph

You can manually edit the task graph before execution to:
- Change a task's `model` (e.g., bump a haiku task to sonnet)
- Adjust `deps` to change execution order
- Modify `description` or `verify` criteria
- Remove tasks you don't want
- Add tasks

---

## 6. Artifacts

After execution, find results in `.orchestrator/artifacts/`:

```
.orchestrator/
├── state/
│   └── task-graph.json          # Plan with updated statuses
└── artifacts/
    ├── T1/
    │   ├── reasoning.md         # Agent's approach and decisions
    │   ├── patch.diff           # Code changes
    │   └── test-results.json    # Verification output
    ├── T2/
    │   ├── reasoning.md
    │   ├── patch.diff
    │   ├── test-results.json
    │   └── review.json          # Code review findings
    └── reflection.md            # Meta-analysis (complex runs only)
```

---

## 7. Uninstall

Remove from current project:

```bash
npx mao-orchestrator uninstall
```

This removes all MAO files from `.claude/` but does not touch your code.

---

## 8. Example Session

```
# Step 1: Start Claude Code
claude

# Step 2: Plan a feature
> /mao-plan Add pagination to the /api/products endpoint with cursor-based navigation

# Review the output table and DAG waves
# Optionally edit .orchestrator/state/task-graph.json

# Step 3: Execute
> /mao Add pagination to the /api/products endpoint with cursor-based navigation

# Claude confirms the plan and asks to proceed
# Agents execute in parallel across git worktrees
# Each agent follows TDD (write test → implement → refactor)
# Verifier checks each task
# Reviewer does cross-agent code review
# Results are merged in dependency order

# Step 4: Check progress (if needed)
> /mao-status

# Step 5: Done — review the merged code
> git log --oneline -10
> git diff main
```

---

## 9. Tips

- **Start with `/mao-plan`** for complex tasks so you can review before executing
- **Use `/mao` directly** for straightforward tasks — it plans and executes in one go
- **Edit the task graph** if you disagree with model assignments or task boundaries
- **Run `doctor`** after updates to verify everything is intact
- **Check `.orchestrator/artifacts/`** for reasoning logs if something went wrong
- **The orchestrator skips the Reflect phase** for runs with fewer than 8 tasks (saves Opus cost)
- **Each agent works in its own git worktree** — your main branch stays clean until merge
