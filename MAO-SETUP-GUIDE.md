# MAO Orchestrator — Setup & Usage Guide

> Step-by-step guide for AI assistants to install, configure, and use the
> Multi-Agent Orchestrator with Claude Code.

---

## 1. Prerequisites

- **Node.js** >= 18
- **Claude Code** installed and working (`claude` command available)
- **Git** initialized in your project (worktree-based parallelism requires git)

---

## 2. Installation

### Global install (recommended)

```bash
npx mao-orchestrator init --global
```

Creates symlinks in `~/.claude/` — MAO is available in every project without per-project setup.

### Local install (single project)

```bash
npx mao-orchestrator init
```

Copies files into `./.claude/` for the current project only. Also appends `.orchestrator/` to `.gitignore`.

### Verify

```bash
npx mao-orchestrator doctor   # 30+ checks: agents, commands, skills, hooks, rules, Node version
npx mao-orchestrator status   # shows global/local installation state
```

All doctor checks should pass. If any fail, re-run `init`.

---

## 3. What Gets Installed

| Category | Count | Location | Purpose |
|----------|-------|----------|---------|
| Agents | 8 | `.claude/agents/mao-*.md` | Specialized AI agents |
| Commands | 3 | `.claude/commands/mao*.md` | Slash commands for Claude Code |
| Skills | 5 | `.claude/skills/*/SKILL.md` | Composable capabilities |
| Hooks | 3 | `.claude/hooks/*.sh` | Automated quality gates |
| Rules | 3 | `.claude/rules/*.md` | Behavioral constraints |

### Agents

| Agent | Default Model | Role |
|-------|---------------|------|
| `mao-architect` | Opus | Decomposes problems into a task DAG |
| `mao-orchestrator` | Sonnet | Schedules tasks, manages worktrees, spawns agents |
| `mao-implementer` | Sonnet/Opus | Builds features (complexity 4+), strict TDD |
| `mao-worker` | Haiku | Boilerplate, config, CRUD (complexity 1-3) |
| `mao-verifier` | Haiku | Deterministic verification: test runner, type-check, lint |
| `mao-reviewer` | Sonnet | Cross-agent code review |
| `mao-reflector` | Opus | Meta-analysis (only for runs with 8+ tasks) |
| `mao-explorer` | Sonnet | Parallel solution search when tasks fail repeatedly |

### Commands

| Command | What it does |
|---------|-------------|
| `/mao <task>` | Full orchestration: plan + execute + verify + review + merge |
| `/mao-plan <task>` | Decompose into DAG without executing |
| `/mao-status` | Check progress of a running orchestration |

### Skills (composable)

| Skill | Purpose |
|-------|---------|
| `multi-agent-orchestrator` | Full 7-phase orchestration pipeline |
| `mao-plan` | Task decomposition only |
| `mao-worktree` | Git worktree lifecycle management |
| `mao-tdd` | RED-GREEN-REFACTOR state machine |
| `mao-review` | Structured code review protocol |

### Hooks

| Hook | When |
|------|------|
| `pre-commit-tdd.sh` | Before commit — ensures tests exist for changes |
| `post-task-review.sh` | After task completion — triggers code review |
| `pre-merge-verify.sh` | Before merge — final verification gate |

### Rules

| Rule | Enforces |
|------|----------|
| `cost-discipline.md` | Model tier budgets per quality level |
| `worktree-hygiene.md` | Clean worktree creation and teardown |
| `commit-format.md` | Conventional commit messages |

---

## 4. Usage

### Basic: run a task end-to-end

```
/mao Implement user authentication with JWT tokens, including login, logout, and token refresh endpoints
```

This triggers the full 7-phase workflow:

1. **Decompose** — Opus breaks the task into atomic sub-tasks with a DAG
2. **Schedule** — Creates git worktrees, assigns models based on complexity
3. **Execute** — Spawns parallel agents in isolated worktrees
4. **Verify** — Deterministic checks: test runner exit codes, type-check, lint
5. **Review** — Cross-agent code review
6. **Reflect** — Meta-analysis (skipped for runs with fewer than 8 tasks)
7. **Integrate** — Merges worktrees back in dependency order

### Plan first, execute later

```
/mao-plan Add a caching layer to the API with Redis
```

Creates `.orchestrator/state/task-graph.json`. You can review, edit task models/deps/descriptions, then execute:

```
/mao Add a caching layer to the API with Redis
```

MAO detects the existing plan and uses it instead of re-planning.

### Monitor progress

```
/mao-status
```

Shows: task board, DAG waves, completion percentage, escalation log, active worktrees.

### Validate a task graph

```bash
npx mao-orchestrator validate .orchestrator/state/task-graph.json
```

Checks: valid JSON, required fields, dependency references, cycle detection.

---

## 5. Quality Levels

MAO has two quality levels controlling model assignment:

| Level | Flag | Haiku | Sonnet | Opus | Cost vs all-Opus |
|-------|------|-------|--------|------|------------------|
| **standard** | _(default)_ | 40-50% | 40-45% | 5-15% | **60-70% savings** |
| **quality** | `--quality` | 0% | 40-50% | 50-60% | **20-30% savings** |

### Model routing by complexity score

**Standard:**

| Score | Model | Typical tasks |
|-------|-------|---------------|
| 0-3 | Haiku | CRUD, boilerplate, config, type definitions, docs |
| 4-7 | Sonnet | Features, business logic, APIs, integration tests |
| 8-14 | Opus | Security-critical, complex algorithms, architecture |

**Quality:**

| Score | Model | Typical tasks |
|-------|-------|---------------|
| 0-3 | Sonnet | CRUD, boilerplate, config, type definitions, docs |
| 4-7 | Opus | Features, business logic, APIs, integration tests |
| 8-14 | Opus | Security-critical, complex algorithms, architecture |

### Override rules (agents with fixed roles)

| Role | Standard | Quality |
|------|----------|---------|
| Decomposition | Opus | Opus |
| Verification | Haiku | Sonnet |
| Review | Sonnet | Opus |
| Reflection | Opus | Opus |

### Budget constraints

| Constraint | Standard | Quality |
|------------|----------|---------|
| Max Opus invocations | 5 | 15 |
| Max Opus concurrent | 1 | 2 |
| Escalation budget | 3 | 5 |
| Max retries per task | 2 | 2 |
| Max parallel agents | 4 | 4 |

### Usage

```bash
# Standard (default)
/mao Implement user authentication

# Quality — use for security features, production releases, unfamiliar codebases
/mao --quality Implement user authentication

# Also works with plan-only
/mao-plan --quality Redesign the payment processing pipeline
```

---

## 6. How It Works

### Task Complexity Scoring

Each task gets a score from 0-14:

```
score = files_touched(x1) + new_logic(x3) + security_risk(x5) + concurrency(x5)
```

| Factor | Weight | Values |
|--------|--------|--------|
| `files_touched` | x1 | 0 = single file, 1 = 2-3 files, 2 = 4+ files |
| `new_logic` | x3 | 0 = none, 1 = some, 2 = significant |
| `security_risk` | x5 | 0 = none, 1 = auth/crypto/injection surface |
| `concurrency` | x5 | 0 = none, 1 = async/parallel/race conditions |

### DAG Waves

Tasks are grouped into waves. Tasks within a wave run in parallel:

```
Wave 1: T1, T2       (parallel — no dependencies)
Wave 2: T3, T4       (parallel — depend on Wave 1 tasks)
Wave 3: T5           (depends on Wave 2)
```

Each agent works in its own git worktree — your main branch stays clean until merge.

### TDD Enforcement

All implementation agents follow strict RED-GREEN-REFACTOR:

| Phase | Action | File permissions | Gate |
|-------|--------|-----------------|------|
| **RED** | Write ONE failing test | Test files only | Test MUST fail (exit code != 0) |
| **GREEN** | Write MINIMUM code to pass | Implementation files only | ALL tests MUST pass (exit code 0) |
| **REFACTOR** | Clean up without changing behavior | Both, but no API changes | ALL tests MUST still pass |

Gates are **deterministic** — test runner exit codes decide state transitions, not LLM judgment.

### Context Whiteboard

Instead of passing growing conversation history between agents, MAO uses a structured **whiteboard** with four zones:

| Zone | Contents | Mutability |
|------|----------|-----------|
| **A: Contract** | Feature spec, acceptance criteria, scope boundary | Immutable after RED begins |
| **B: Evidence** | Test results, exit codes, compiler output, snapshots | Append-only |
| **C: Intent** | Current TDD phase, what the agent plans to do next | Mutable (agent-owned) |
| **D: Workspace** | File checksums, snapshot IDs, patch history | Updated by framework |

Each agent reads only the zones it needs and writes only the zones it owns. This prevents context bloat and stale state confusion.

### Patch Protocol

Agents propose **minimal, typed patch operations** instead of regenerating full files:

| Operation | What it does |
|-----------|-------------|
| `create_file` | Create a new file |
| `replace_block` | Replace lines between anchors |
| `insert_before_anchor` | Insert before a matched line |
| `insert_after_anchor` | Insert after a matched line |
| `delete_block` | Remove lines between anchors |

Each patch is tied to a specific workspace snapshot. The framework validates anchor context before applying, preventing stale edits.

### Self-Correction (5 layers)

When a task fails, MAO applies progressively more expensive correction:

| Layer | Strategy | Cost |
|-------|----------|------|
| 1. Self-Review | Agent checks own work against acceptance criteria | Free |
| 2. Deterministic Verification | Test runner, compiler, linter exit codes | Cheap |
| 3. Peer Review | Sonnet reviews another agent's code | Medium |
| 4. Model Escalation | Retry with more powerful model (haiku -> sonnet -> opus) | Expensive |
| 5. Exploration | 3 parallel Explorer agents try different strategies | Most expensive |

**Core principle: Rebuild, Don't Resume.** Retry always recomputes from the current workspace state, never from conversation history of the failed attempt.

---

## 7. Task Graph Schema

The task graph at `.orchestrator/state/task-graph.json`:

```json
{
  "intent": "What the user asked for",
  "created_at": "2026-03-13T12:00:00Z",
  "config": {
    "quality_level": "standard",
    "max_parallel_agents": 4,
    "max_opus_concurrent": 1,
    "max_retries_per_task": 2,
    "escalation_budget": 3,
    "max_opus_invocations": 5
  },
  "tasks": [
    {
      "id": "T1",
      "name": "Create user model",
      "description": "Define User schema with email, password hash, timestamps",
      "complexity_score": 2,
      "complexity_factors": {
        "files_touched": 0,
        "new_logic": 0,
        "security_risk": 0,
        "concurrency": 0
      },
      "model": "haiku",
      "deps": [],
      "tools": ["Read", "Write", "Bash"],
      "verify": "npm test -- --grep 'User model'",
      "worktree": "wt-user-model",
      "estimated_files": ["src/models/user.ts"],
      "status": "pending",
      "agent": null,
      "attempts": 0,
      "error": null
    },
    {
      "id": "T2",
      "name": "Implement login endpoint",
      "description": "POST /auth/login with email/password, returns JWT",
      "complexity_score": 5,
      "complexity_factors": {
        "files_touched": 1,
        "new_logic": 1,
        "security_risk": 0,
        "concurrency": 0
      },
      "model": "sonnet",
      "deps": ["T1"],
      "tools": ["Read", "Write", "Bash"],
      "verify": "npm test -- --grep 'login'",
      "worktree": "wt-login-endpoint",
      "estimated_files": ["src/routes/auth.ts", "src/middleware/jwt.ts"],
      "status": "pending",
      "agent": null,
      "attempts": 0,
      "error": null
    }
  ],
  "dag_waves": [
    { "wave": 1, "tasks": ["T1"], "parallel": true },
    { "wave": 2, "tasks": ["T2"], "parallel": true }
  ],
  "worktrees": {},
  "escalation_log": [],
  "exploration_log": []
}
```

### Editing the task graph

You can edit the task graph before execution:

- **Change `model`** — bump a haiku task to sonnet if you think it's under-provisioned
- **Change `deps`** — reorder execution by adjusting dependency arrays
- **Change `description` / `verify`** — refine what the agent should do and how to check it
- **Remove tasks** — delete tasks you don't want
- **Add tasks** — insert new task objects (ensure unique `id`, valid `deps`)
- **Change `quality_level`** in config — switch between standard and quality routing

---

## 8. Artifacts

After execution, results are in `.orchestrator/`:

```
.orchestrator/
├── state/
│   └── task-graph.json          # Plan with updated statuses
└── artifacts/
    ├── T1/
    │   ├── reasoning.md         # Agent's approach and decisions
    │   ├── patch.diff           # Code changes applied
    │   └── test-results.json    # Verification output with exit codes
    ├── T2/
    │   ├── reasoning.md
    │   ├── patch.diff
    │   ├── test-results.json
    │   └── review.json          # Code review findings
    └── reflection.md            # Meta-analysis (8+ task runs only)
```

This directory is git-ignored and holds runtime state only. Delete it to start fresh.

---

## 9. Troubleshooting

| Problem | Solution |
|---------|----------|
| `doctor` reports missing files | Re-run `npx mao-orchestrator init` (or `init --global`) |
| Task stuck in `pending` | Check `.orchestrator/artifacts/<task-id>/reasoning.md` for agent output |
| Wrong model assigned | Edit `task-graph.json` before execution, change the task's `model` field |
| Tests pass but verification fails | Check `test-results.json` — verification uses exit codes, not output parsing |
| Worktree merge conflicts | Resolve manually, then re-run `/mao-status` to continue |
| `escalation_budget` exhausted | Increase in `config` or use `--quality` for higher default budget (5 vs 3) |
| Context too large for agent | MAO uses whiteboard + patches to minimize context; check if `estimated_files` is too broad |

### Reset state

```bash
rm -rf .orchestrator/    # delete all plans, artifacts, and state
```

Then re-run `/mao` to start fresh.

---

## 10. Uninstall

```bash
npx mao-orchestrator uninstall   # removes from current project's .claude/
```

For global uninstall, remove symlinks manually from `~/.claude/`.

---

## 11. Example Session

```
# 1. Start Claude Code
claude

# 2. Plan the feature (review before executing)
> /mao-plan Add pagination to the /api/products endpoint with cursor-based navigation

# Output: task table with IDs, models, scores, deps
# Output: DAG wave visualization
# File created: .orchestrator/state/task-graph.json

# 3. (Optional) Review and edit the plan
# - Open .orchestrator/state/task-graph.json
# - Adjust models, deps, descriptions as needed

# 4. Execute
> /mao Add pagination to the /api/products endpoint with cursor-based navigation

# MAO detects existing plan, confirms, then:
# - Creates worktrees per task
# - Spawns agents in parallel (within wave constraints)
# - Each agent: RED (failing test) → GREEN (minimum code) → REFACTOR
# - Verifier checks each task (exit codes, not LLM judgment)
# - Reviewer does cross-agent review
# - Merges worktrees in dependency order

# 5. Monitor (in another Claude Code session or while waiting)
> /mao-status

# 6. Review results
> git log --oneline -10
> git diff main
```

### Quick version (skip planning)

```
> /mao Add rate limiting middleware to all API routes
```

MAO plans and executes in one command. Use this for straightforward tasks.

### Quality mode

```
> /mao --quality Implement OAuth2 authorization code flow with PKCE
```

Use `--quality` when correctness matters more than cost: security features, production releases, unfamiliar codebases.

---

## 12. Tips

- **Plan first** for complex tasks (`/mao-plan`) — review the DAG before committing to execution
- **Use quality mode** for security, auth, crypto, and production-critical features
- **Edit task graphs** if you disagree with model assignments or task boundaries
- **Check artifacts** (`reasoning.md`, `test-results.json`) when something fails
- **Run `doctor`** after updating MAO to verify plugin integrity
- **Delete `.orchestrator/`** to reset all state and start fresh
- **Each agent gets its own worktree** — your main branch stays clean until the final merge phase
