# MAO Marketplace — Multi-Agent Orchestrator for Claude Code

Orchestrate multi-agent workflows with intelligent **Opus/Sonnet/Haiku model tiering**,
DAG-based task scheduling, git worktrees for parallelism, and self-correction loops.

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

### From GitHub (Recommended)

```bash
# 1. Add the marketplace
/plugin marketplace add aiconnai/mao-marketplace

# 2. Install the plugin
/plugin install multi-agent-orchestrator@mao-marketplace
```

### Local Installation

```bash
# Clone the repo
git clone https://github.com/aiconnai/mao-marketplace.git

# Add as local marketplace
/plugin marketplace add ./mao-marketplace

# Install
/plugin install multi-agent-orchestrator@mao-marketplace
```

### Manual Installation (Copy Files)

```bash
# From your project root:
mkdir -p .claude/agents .claude/skills

# Copy agents
cp -r /path/to/mao-marketplace/plugins/multi-agent-orchestrator/agents/*.md .claude/agents/

# Copy skill
cp -r /path/to/mao-marketplace/plugins/multi-agent-orchestrator/skills/multi-agent-orchestrator .claude/skills/

# Add orchestrator state to .gitignore
echo ".orchestrator/" >> .gitignore
```

---

## Quick Start

### Recommended Session Mode

```bash
claude --model opusplan
```

This uses Opus for planning/reflection and Sonnet for execution — matching
MAO's philosophy perfectly.

### Automatic Activation

Just describe a complex task. MAO activates automatically for multi-file/multi-concern work:

```
> Implement JWT authentication with refresh token rotation, rate limiting,
  and brute-force protection for the API
```

### Explicit Invocation

Invoke a specific agent directly:

```
> Use the mao-architect to decompose: "Build a user registration
  system with email validation and password hashing"
```

### Quick Test

After installation, verify it works:

```
> Use the mao-architect to decompose: "Create a REST API endpoint
  for user registration with email validation and password hashing"
```

You should see a `task-graph.json` with 4-6 tasks, most assigned to Haiku or Sonnet.

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
mao-marketplace/                          # Marketplace (distribution layer)
├── .claude-plugin/marketplace.json       # Registry: lists available plugins
├── README.md                             # This file
├── .gitignore
│
└── plugins/
    └── multi-agent-orchestrator/         # Plugin (installable unit)
        ├── .claude-plugin/plugin.json    # Plugin manifest
        ├── README.md                     # Plugin-specific docs
        ├── agents/                       # 8 agent definitions
        │   ├── mao-architect.md
        │   ├── mao-orchestrator.md
        │   ├── mao-implementer.md
        │   ├── mao-worker.md
        │   ├── mao-verifier.md
        │   ├── mao-reviewer.md
        │   ├── mao-reflector.md
        │   └── mao-explorer.md
        │
        └── skills/
            └── multi-agent-orchestrator/ # Skill (what Claude Code loads)
                ├── SKILL.md              # Core skill definition
                ├── references/           # Deep-dive docs (lazy-loaded)
                │   ├── task-decomposition.md
                │   ├── dag-scheduler.md
                │   ├── model-routing.md
                │   ├── self-correction.md
                │   └── worktree-ops.md
                ├── scripts/
                │   ├── setup-worktrees.sh
                │   └── merge-worktrees.sh
                └── templates/
                    ├── task-graph-template.json
                    └── CLAUDE-md-snippet.md
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

## Requirements

- Claude Code v1.0.33+ (for plugin support)
- Git (for worktree operations)
- A project with tests/lint configured (for the verification pipeline)

## License

MIT
