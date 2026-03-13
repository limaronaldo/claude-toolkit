# Multi-Agent Orchestrator (MAO)

A Claude Code plugin for orchestrating multi-agent workflows with intelligent model
tiering, git worktrees, and self-correction loops.

## Installation

### Via Plugin Marketplace (Recommended)

```bash
# Add marketplace and install
/plugin marketplace add aiconnai/mao-marketplace
/plugin install multi-agent-orchestrator@mao-marketplace
```

### Manual Installation

```bash
# From your project root:
mkdir -p .claude/agents .claude/skills

# Copy agents
cp agents/*.md .claude/agents/

# Copy skill
cp -r skills/multi-agent-orchestrator .claude/skills/

# Add orchestrator state to .gitignore
echo ".orchestrator/" >> .gitignore
```

## Recommended Model Configuration

```bash
claude --model opusplan
```

This automatically uses Opus for planning and Sonnet for execution.

## Usage

### Slash Commands (Recommended)

| Command | What It Does |
|---------|-------------|
| `/mao <task>` | Full orchestration — decompose, execute in parallel, verify, review, merge |
| `/mao-plan <task>` | Decomposition only — create the task DAG without executing |
| `/mao-status` | Check status of an in-progress or completed MAO run |

Install globally by symlinking `commands/*.md` to `~/.claude/commands/`.

### Automatic Activation

MAO also activates automatically for multi-file, multi-concern tasks:

```
> Implement JWT authentication with refresh token rotation, rate limiting,
  and brute-force protection for the API
```

### Explicit Agent Invocation

```
> Use the mao-architect to decompose: "Create a REST API endpoint
  for user registration with email validation and password hashing"
```

### What Happens Under the Hood

1. **Architect** (Opus) creates `.orchestrator/state/task-graph.json` — atomic tasks, DAG dependencies, complexity scores, model assignments
2. **Orchestrator** (Sonnet) validates the DAG, sets up git worktrees, spawns executor agents
3. **Workers/Implementers** (Haiku/Sonnet) execute tasks in parallel worktrees with self-review
4. **Verifier** (Haiku) runs type-check → tests → lint → format on each task
5. **Reviewer** (Sonnet) does cross-agent code review, may create correction tasks
6. **Reflector** (Opus) analyzes the run and updates routing patterns (8+ task runs only)
7. **Merge** — worktrees merged in dependency order, conflicts resolved, worktrees cleaned up

## Plugin Structure

```
multi-agent-orchestrator/
├── .claude-plugin/plugin.json  # Plugin manifest
├── README.md                   # This file
├── agents/                     # 8 agent definitions
│   ├── mao-architect.md        # Opus — problem decomposition
│   ├── mao-orchestrator.md     # Sonnet — coordination
│   ├── mao-implementer.md      # Sonnet — feature building
│   ├── mao-worker.md           # Haiku — mechanical tasks
│   ├── mao-verifier.md         # Haiku — test/lint pipeline
│   ├── mao-reviewer.md         # Sonnet — code review
│   ├── mao-reflector.md        # Opus — meta-analysis
│   └── mao-explorer.md         # Sonnet — parallel solution search
├── commands/                   # Claude Code slash commands
│   ├── mao.md                  # /mao — full orchestration
│   ├── mao-plan.md             # /mao-plan — decomposition only
│   └── mao-status.md           # /mao-status — run status
│
└── skills/
    └── multi-agent-orchestrator/
        ├── SKILL.md             # Core skill definition (7 phases)
        ├── references/          # Deep-dive docs (lazy-loaded as needed)
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

## Complexity Scoring & Model Routing

Tasks are scored and routed to the cheapest capable model:

```
score = files_touched × 1 + new_logic × 3 + security_risk × 5 + concurrency × 5
```

| Score | Model | Typical Tasks |
|-------|-------|---------------|
| 0-3 | Haiku | Migrations, CRUD, boilerplate, docs, config |
| 4-7 | Sonnet | Features, refactoring, integration, complex tests |
| 8-14 | Opus | Security logic, concurrency, novel algorithms |

## Self-Correction (5 Layers)

1. **Reflexion** — Agents self-review before reporting done (free)
2. **Verification** — Haiku runs deterministic test/lint pipeline (cheap)
3. **Peer Review** — Sonnet reviews code for design issues (medium)
4. **Escalation** — On 2 failures: haiku → sonnet → opus (expensive)
5. **Exploration** — 3 parallel Sonnet explorers with different strategies (last resort)

## Cost Expectations

For a typical complex feature (8-12 tasks):

| Model | % Tasks | Approx Cost Share |
|-------|---------|-------------------|
| Haiku | 40-50% | ~5% of total |
| Sonnet | 40-45% | ~40% of total |
| Opus | 5-15% | ~55% of total |

vs. all-Opus baseline: **~60-70% savings**

## Resource Limits

- Max parallel agents: 4-6
- Max Opus concurrent: 1 | Max Sonnet: 3 | Max Haiku: 4
- Max Opus invocations per run: 5
- Max retries per task: 2
- Escalation budget: 3 per run
- Max total tasks: 20

## CLAUDE.md Integration

After installation, optionally add MAO configuration to your project's `CLAUDE.md`
using the template at `templates/CLAUDE-md-snippet.md`.

## License

MIT
