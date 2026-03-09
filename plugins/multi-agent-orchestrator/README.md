# Multi-Agent Orchestrator (MAO)

A Claude Code skill for orchestrating multi-agent workflows with intelligent model
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
# Copy agents to your project
cp agents/*.md .claude/agents/

# Copy skill
mkdir -p .claude/skills
cp -r skills/multi-agent-orchestrator .claude/skills/

# Add orchestrator to .gitignore
echo ".orchestrator/" >> .gitignore
```

## Recommended Model Configuration

For best results, start your Claude Code session with `opusplan`:

```bash
claude --model opusplan
```

This automatically uses Opus for planning and Sonnet for execution.

## Quick Test

After installation, test with:

```
> Use the mao-architect to decompose: "Create a REST API endpoint 
  for user registration with email validation and password hashing"
```

You should see the architect create a task-graph.json with 4-6 tasks,
most assigned to Haiku or Sonnet.

## Structure

```
multi-agent-orchestrator/
├── SKILL.md                    # Core skill definition
├── agents/                     # Custom agent definitions
│   ├── mao-architect.md        # Opus — problem decomposition
│   ├── mao-orchestrator.md     # Sonnet — coordination
│   ├── mao-implementer.md      # Sonnet — feature building
│   ├── mao-worker.md           # Haiku — mechanical tasks
│   ├── mao-verifier.md         # Haiku — test/lint pipeline
│   ├── mao-reviewer.md         # Sonnet — code review
│   ├── mao-reflector.md        # Opus — meta-analysis
│   └── mao-explorer.md         # Sonnet — parallel solution search
├── references/                 # Detailed docs (loaded as needed)
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

## Cost Expectations

For a typical complex feature (8-12 tasks):

| Model | % Tasks | Approx Cost Share |
|-------|---------|-------------------|
| Haiku | 40-50% | ~5% of total |
| Sonnet | 40-45% | ~40% of total |
| Opus | 5-15% | ~55% of total |

vs. all-Opus baseline: **~60-70% savings**

The savings come from routing mechanical work (migrations, CRUD, tests, docs)
to Haiku instead of using Opus for everything.
