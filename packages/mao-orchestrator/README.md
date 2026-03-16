# MAO — Multi-Agent Orchestrator for Claude Code

[![CI](https://github.com/limaronaldo/claude-toolkit/actions/workflows/ci.yml/badge.svg)](https://github.com/limaronaldo/claude-toolkit/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/mao-orchestrator)](https://www.npmjs.com/package/mao-orchestrator)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Orchestrate multi-agent workflows with intelligent **Opus/Sonnet/Haiku model tiering**,
DAG-based task scheduling, git worktrees for parallelism, and self-correction loops.

**Built for Claude Code.** MAO uses Claude-exclusive features (sub-agent spawning, model routing, slash commands) that don't exist in other AI coding agents.

## What It Does

Turns a single Claude Code session into a coordinated AI team:

```
Opus UNDERSTANDS → Sonnet ORCHESTRATES → Haiku/Sonnet/Opus EXECUTE
```

- **Architect** (Opus) decomposes your problem into atomic tasks
- **Orchestrator** (Sonnet) schedules tasks as a DAG, manages worktrees
- **Workers** (Haiku) handle mechanical tasks at 1/15th the cost of Opus
- **Implementers** (Sonnet) build features and business logic
- **Verifiers** (Haiku) run automated test/lint/type-check pipelines
- **Reviewers** (Sonnet) do cross-agent code review
- **Reflector** (Opus) learns patterns for future optimization
- **Explorers** (Sonnet) search solution space when tasks fail

Result: **60-70% cost reduction** vs all-Opus, with quality maintained through
5 layers of self-correction.

---

## Installation

### npx (Recommended)

```bash
# Install to current project
npx mao-orchestrator init

# Install globally (all Claude Code sessions)
npx mao-orchestrator init --global
```

### curl | bash (No Node Required)

```bash
curl -fsSL https://raw.githubusercontent.com/limaronaldo/claude-toolkit/main/packages/mao-orchestrator/install.sh | bash
```

### PowerShell (Windows)

```powershell
irm https://raw.githubusercontent.com/limaronaldo/claude-toolkit/main/packages/mao-orchestrator/install.ps1 | iex
```

### Claude Code Plugin

```bash
/plugin marketplace add limaronaldo/claude-toolkit
/plugin install multi-agent-orchestrator@claude-toolkit
```

### Manual

```bash
git clone https://github.com/limaronaldo/claude-toolkit.git
cp -r claude-toolkit/packages/mao-orchestrator/plugins/multi-agent-orchestrator/commands/*.md ~/.claude/commands/
cp -r claude-toolkit/packages/mao-orchestrator/plugins/multi-agent-orchestrator/agents/*.md ~/.claude/agents/
echo ".orchestrator/" >> .gitignore
```

---

## Quick Start

### Slash Commands

MAO provides three slash commands for Claude Code:

| Command | What It Does |
|---------|-------------|
| `/mao <task>` | Full orchestration — decompose, execute in parallel, verify, review, merge |
| `/mao-plan <task>` | Decomposition only — create the task DAG without executing |
| `/mao-status` | Check status of an in-progress or completed MAO run |

**Examples:**

```
> /mao-plan Implement JWT auth with refresh tokens, rate limiting, and brute-force protection
# → Creates task-graph.json with 5-8 tasks, shows DAG, waits for approval

> /mao Implement JWT auth with refresh tokens, rate limiting, and brute-force protection
# → Plans, confirms with you, then executes the full 7-phase workflow

> /mao-status
# → Shows task board, progress, failures, and metrics
```

### Recommended Session Mode

```bash
claude --model opusplan
```

This uses Opus for planning/reflection and Sonnet for execution — matching
MAO's philosophy perfectly.

### Agent Invocation (Alternative)

You can also invoke agents directly without slash commands:

```
> Use the mao-architect to decompose: "Build a user registration
  system with email validation and password hashing"
```

---

## Architecture

### 7-Phase Workflow

| Phase | Agent | Model | What Happens |
|-------|-------|-------|--------------|
| 1. Decompose | `mao-architect` | Opus | Break request into atomic tasks, map as DAG, score complexity |
| 2. Schedule & Setup | `mao-orchestrator` | Sonnet | Validate DAG, create git worktrees, initialize task board |
| 3. Execute | `mao-worker` / `mao-implementer` | Haiku/Sonnet | Tasks run in parallel worktrees with self-review |
| 4. Verify | `mao-verifier` | Haiku | type-check → tests → lint → format pipeline |
| 5. Review | `mao-reviewer` | Sonnet | Cross-agent code review (security, performance, design) |
| 6. Reflect | `mao-reflector` | Opus | Meta-analysis, pattern learning (8+ task runs only) |
| 7. Integrate | `mao-orchestrator` | Sonnet | Merge worktrees in dependency order, resolve conflicts, cleanup |

For simple 3-5 task runs, phases 5-6 are optional. Full 7-phase loop for 6+ task complex systems.

### Agent Roster

| Agent | Model | Role | Tools |
|-------|-------|------|-------|
| `mao-architect` | Opus | Decompose problems, design task DAGs | Read, Grep, Glob, WebSearch |
| `mao-orchestrator` | Sonnet | Schedule, coordinate, manage state | Read, Write, Edit, Bash, Glob, Grep |
| `mao-implementer` | Sonnet | Build features, business logic | Read, Write, Edit, Bash, Glob, Grep |
| `mao-worker` | Haiku | CRUD, boilerplate, migrations, docs | Read, Write, Edit, Bash |
| `mao-verifier` | Haiku | Run test/lint/type-check pipelines | Read, Bash, Grep |
| `mao-reviewer` | Sonnet | Cross-agent code review | Read, Grep, Glob, Bash |
| `mao-reflector` | Opus | Meta-analysis, pattern learning | Read, Grep, Glob |
| `mao-explorer` | Sonnet | Parallel solution search for hard failures | Read, Write, Edit, Bash, Glob, Grep |

All agents are prefixed with `mao-` to avoid name collisions.

### Model Routing

Tasks are scored for complexity and routed to the cheapest capable model:

```
score = files_touched(0-1) × 1
      + new_logic(0-1)     × 3
      + security_risk(0-1) × 5
      + concurrency(0-1)   × 5
```

| Score | Model | Typical Tasks |
|-------|-------|---------------|
| 0-3 | Haiku | Migrations, CRUD, boilerplate, docs, config, formatting |
| 4-7 | Sonnet | Features, refactoring, integration, complex tests |
| 8-14 | Opus | Security logic, concurrency, novel algorithms, architecture |

**Override rules** (always apply regardless of score):
- Decomposition → always Opus
- Verification → always Haiku
- Review → always Sonnet
- Reflection → always Opus

### Self-Correction (5 Layers)

| Layer | Cost | Strategy |
|-------|------|----------|
| 1. Reflexion | Free | Agents self-review before reporting done |
| 2. Verification | Cheap | Haiku runs deterministic test/lint pipeline |
| 3. Peer Review | Medium | Sonnet reviews code for design issues |
| 4. Escalation | Expensive | On 2 failures: haiku → sonnet → opus |
| 5. Exploration | Most Expensive | 3 parallel Sonnet explorers with different strategies |

Escalation budget: 3 per run. When exhausted, report failure to user.

### Git Worktree Isolation

Each parallel task runs in its own git worktree:

```bash
git worktree add ../wt-{task-name} -b feat/{task-name}
```

**Rules:**
- 1 agent = 1 worktree (never shared)
- Max 4-6 concurrent worktrees
- Merge in dependency order (most upstream first)
- Test after each merge
- Spawn Sonnet resolver on conflicts
- Clean up worktrees after final merge

---

## State & Artifacts

MAO creates an `.orchestrator/` directory in your project root:

```
.orchestrator/
├── state/
│   ├── task-graph.json      # DAG: tasks, deps, status, model assignments
│   ├── patterns.json        # Learned routing patterns (confidence-based)
│   └── metrics.json         # Cost, latency, success rates per model
├── artifacts/
│   ├── T1/
│   │   ├── patch.diff       # Actual code changes
│   │   ├── reasoning.md     # Agent's approach explanation
│   │   ├── test-results.json # Verification output
│   │   └── review.json      # Code review findings
│   └── reflection.md        # Meta-analysis (complex runs only)
└── messages/                # Inter-agent completion/error signals
```

Add `.orchestrator/` to your `.gitignore`.

---

## Cost Expectations

For a typical complex feature (8-12 tasks):

| Model | % of Tasks | Approx Cost Share |
|-------|-----------|-------------------|
| Haiku | 40-50% | ~5% of total |
| Sonnet | 40-45% | ~40% of total |
| Opus | 5-15% | ~55% of total |

vs. all-Opus baseline: **~60-70% savings**

### Resource Constraints

| Constraint | Limit |
|-----------|-------|
| Max parallel agents | 4-6 |
| Max Opus concurrent | 1 |
| Max Sonnet concurrent | 3 |
| Max Haiku concurrent | 4 |
| Max Opus invocations per run | 5 |
| Max retries per task | 2 |
| Escalation budget per run | 3 |
| Max total tasks | 20 |

---

## When to Use MAO

**Use for:**
- Feature implementation spanning 3+ files
- System design requiring architecture before code
- Large refactoring with multiple independent changes
- Any task benefiting from parallel execution
- Complex tasks where cost optimization matters

**Skip for:**
- Simple 1-2 file changes
- Sequential-only dependencies (no parallelism benefit)
- Tasks where all changes touch the same files

---

## Project Structure

```
mao-orchestrator/
├── .github/workflows/              # CI/CD
│   ├── ci.yml                      # Lint, validate JSON, check structure
│   ├── release.yml                 # Publish npm + attach tar.gz
│   └── docs.yml                    # Deploy landing page
├── docs/site/                      # Landing page (GitHub Pages)
├── npm/                            # npm installer CLI
│   ├── package.json                # mao-orchestrator package
│   └── index.mjs                   # Installer: init, status, uninstall, validate
├── install.sh                      # Bash installer (curl | bash)
├── install.ps1                     # PowerShell installer (irm | iex)
├── action.yml                      # GitHub Action for task-graph validation
├── CHANGELOG.md
├── CONTRIBUTING.md
├── LICENSE
│
└── plugins/
    └── multi-agent-orchestrator/   # Plugin (installable unit)
        ├── agents/                 # 8 agent definitions
        ├── commands/               # 3 Claude Code slash commands
        └── skills/
            └── multi-agent-orchestrator/
                ├── SKILL.md        # Core skill definition
                ├── references/     # Deep-dive docs (lazy-loaded)
                ├── scripts/        # Worktree setup/merge scripts
                └── templates/      # Task graph template, CLAUDE.md snippet
```

---

## CLAUDE.md Integration

After installing, optionally add MAO guidance to your project's `CLAUDE.md`.
A template is provided at `templates/CLAUDE-md-snippet.md`. Key sections:

- Model tiering rules
- Cost discipline constraints
- Git worktree conventions
- Verification pipeline order
- Self-correction behavior

---

## CI Integration

Validate task-graph.json files in your CI pipeline:

```yaml
# .github/workflows/validate-mao.yml
- uses: limaronaldo/claude-toolkit@v1
  with:
    task-graph: .orchestrator/state/task-graph.json
```

Or use the CLI:

```bash
npx mao-orchestrator validate .orchestrator/state/task-graph.json
```

---

## Requirements

- Claude Code (MAO uses Claude-exclusive features)
- Git (for worktree operations)
- A project with tests/lint configured (for the verification pipeline)

## Links

- [Landing Page](https://github.com/limaronaldo/claude-toolkit)
- [Usage Guide](USAGE.md)
- [Contributing](CONTRIBUTING.md)
- [Changelog](CHANGELOG.md)

## License

[MIT](LICENSE)
