# Claude Toolkit

A monorepo containing tools for AI-assisted development with Claude Code.

## Packages

| Package | Description | Install |
|---------|-------------|---------|
| [claude-primer](packages/claude-primer/) | Prime your repo for Claude Code with context-aware knowledge architecture | `npx claude-primer` / `pip install claude-primer` |
| [mao-orchestrator](packages/mao-orchestrator/) | Multi-Agent Orchestrator — intelligent model tiering, DAG scheduling, git worktrees | `npx mao-orchestrator init` |
| [claude-toolkit](packages/claude-toolkit/) | Unified CLI that combines Primer + MAO in one command | `npx claude-toolkit init` |

## Quick Start

### Option 1: Full Toolkit (Recommended)

```bash
npx claude-toolkit init
```

This runs Claude Primer to generate knowledge docs, then installs MAO agents, commands, and skills — one command to set up everything.

### Option 2: Individual Tools

```bash
# Just the knowledge architecture
npx claude-primer

# Just the multi-agent orchestrator
npx mao-orchestrator init --global
```

## How They Work Together

```
Claude Primer               MAO
┌──────────────┐     ┌──────────────────┐
│ Scans your   │     │ Decomposes tasks │
│ codebase     │────▶│ into DAG         │
│              │     │                  │
│ Generates:   │     │ Executes via:    │
│ • CLAUDE.md  │     │ • Opus (arch)    │
│ • STANDARDS  │     │ • Sonnet (impl)  │
│ • QUICKSTART │     │ • Haiku (mech)   │
│ • ERRORS     │     │                  │
│ • config.json│     │ Verifies, reviews│
└──────────────┘     │ and merges       │
                     └──────────────────┘
```

## Development

```bash
git clone https://github.com/limaronaldo/claude-toolkit.git
cd claude-toolkit
npm install

# Run all Node tests
npm test

# Run Python tests
cd packages/claude-primer/python
pip install pytest
pytest tests/ -v
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed development guidelines.

## License

MIT
