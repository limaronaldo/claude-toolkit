# Claude Toolkit

Unified CLI that combines [Claude Primer](../claude-primer/) + [MAO Orchestrator](../mao-orchestrator/) for a complete AI-assisted development setup.

## Install

```bash
npm install -g claude-toolkit
```

## Quick Start

```bash
# Prime your project + install MAO in one command
claude-toolkit init

# Verify everything is set up
claude-toolkit doctor
```

## Commands

| Command | Description |
|---------|-------------|
| `claude-toolkit init [args]` | Run Claude Primer with `--mao` flag, then install MAO agents/commands/skills |
| `claude-toolkit doctor` | Verify all components are installed (CLAUDE.md, agents, skills, etc.) |
| `claude-toolkit update` | Update all tools to latest versions |
| `claude-toolkit primer [args]` | Passthrough to `claude-primer` |
| `claude-toolkit mao [args]` | Passthrough to `mao-orchestrator` |

## What It Does

`claude-toolkit init` runs two phases:

1. **Claude Primer** scans your codebase and generates:
   - `CLAUDE.md` — project map, invariants, decision heuristics
   - `STANDARDS.md` — governance rules, code quality gates
   - `QUICKSTART.md` — essential commands
   - `ERRORS_AND_LESSONS.md` — mistake catalog
   - `.claude/project-config.json` — machine-readable config for MAO

2. **MAO Orchestrator** installs:
   - 8 agents (architect, orchestrator, implementer, worker, verifier, reviewer, reflector, explorer)
   - 3 commands (`/mao`, `/mao-plan`, `/mao-status`)
   - 1 skill (multi-agent-orchestrator)

After setup, use `/mao <task>` in Claude Code to orchestrate complex multi-agent workflows.

## License

MIT
