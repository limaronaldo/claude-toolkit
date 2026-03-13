# MAO — Multi-Agent Orchestrator for Claude Code

Orchestrate multi-agent workflows with intelligent **Opus/Sonnet/Haiku model tiering**,
DAG-based task scheduling, git worktrees for parallelism, and self-correction loops.

```
Opus UNDERSTANDS → Sonnet ORCHESTRATES → Haiku/Sonnet/Opus EXECUTE
```

**Result:** 60-70% cost reduction vs all-Opus, with quality maintained through 5 layers of self-correction.

## Install

```bash
# Install to current project
npx mao-orchestrator init

# Install globally (all Claude Code sessions)
npx mao-orchestrator init --global
```

## Commands

Once installed, use these slash commands in Claude Code:

| Command | What It Does |
|---------|-------------|
| `/mao <task>` | Full orchestration — decompose, execute in parallel, verify, review, merge |
| `/mao-plan <task>` | Decomposition only — create the task DAG without executing |
| `/mao-status` | Check status of an in-progress or completed MAO run |

## CLI

```bash
mao-orchestrator init            # Copy agents, commands, skills to .claude/
mao-orchestrator init --global   # Symlink to ~/.claude/ for global use
mao-orchestrator status          # Show what's installed and version
mao-orchestrator uninstall       # Remove MAO files from .claude/
mao-orchestrator validate <path> # Validate a task-graph.json
```

## Agent Roster

| Agent | Model | Role |
|-------|-------|------|
| `mao-architect` | Opus | Decompose problems, design task DAGs |
| `mao-orchestrator` | Sonnet | Schedule, coordinate, manage state |
| `mao-implementer` | Sonnet | Build features, business logic |
| `mao-worker` | Haiku | CRUD, boilerplate, migrations, docs |
| `mao-verifier` | Haiku | Run test/lint/type-check pipelines |
| `mao-reviewer` | Sonnet | Cross-agent code review |
| `mao-reflector` | Opus | Meta-analysis, pattern learning |
| `mao-explorer` | Sonnet | Parallel solution search for hard failures |

## Requirements

- [Claude Code](https://claude.ai/code) (MAO uses Claude-exclusive features)
- Git (for worktree operations)

## Links

- [Landing Page](https://aiconnai.github.io/mao-marketplace/)
- [GitHub](https://github.com/aiconnai/mao-marketplace)

## License

[MIT](https://github.com/aiconnai/mao-marketplace/blob/main/LICENSE)
