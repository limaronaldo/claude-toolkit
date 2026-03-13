# Contributing to Claude Toolkit

This is a monorepo containing three packages. Each has its own conventions.

## Repository Structure

```
claude-toolkit/
├── packages/
│   ├── claude-primer/      # Knowledge architecture generator
│   │   ├── npm/            # npm package (claude-primer)
│   │   └── python/         # PyPI package (claude-primer)
│   ├── mao-orchestrator/   # Multi-agent orchestrator
│   │   ├── npm/            # npm package (mao-orchestrator)
│   │   └── plugins/        # Agent/command/skill definitions
│   └── claude-toolkit/     # Unified CLI meta-package
│       └── npm/            # npm package (claude-toolkit)
├── docs/site/              # Unified documentation site
└── .github/workflows/      # CI/CD pipelines
```

## Development Setup

```bash
git clone https://github.com/limaronaldo/claude-toolkit.git
cd claude-toolkit
npm install                 # installs all workspaces
```

### Claude Primer

See [packages/claude-primer/CONTRIBUTING.md](packages/claude-primer/CONTRIBUTING.md) for Primer-specific guidelines.

Key principles:
- **Python is the source of truth.** Port changes from Python to JavaScript.
- **Zero dependencies.** Both implementations use only stdlib/built-ins.
- **Single file per implementation.**

```bash
# Python tests
cd packages/claude-primer/python
pip install pytest
pytest tests/ -v

# Node tests
cd packages/claude-primer/npm
node --test tests/claude_primer.test.mjs
```

### MAO Orchestrator

See [packages/mao-orchestrator/CONTRIBUTING.md](packages/mao-orchestrator/CONTRIBUTING.md) for MAO-specific guidelines.

MAO is a collection of Markdown, JSON, and Bash files — no build step required.

```bash
# Test by copying to ~/.claude/ and running commands in Claude Code
npx mao-orchestrator init
```

### Claude Toolkit (meta-package)

```bash
cd packages/claude-toolkit/npm
node --test tests/
```

## Running All Tests

```bash
# All Node tests across workspaces
npm test

# Python tests (separate)
cd packages/claude-primer/python && pytest tests/ -v
```

## Versioning

Each package is versioned independently:
- `claude-primer`: `packages/claude-primer/npm/package.json` + `packages/claude-primer/python/pyproject.toml`
- `mao-orchestrator`: `packages/mao-orchestrator/npm/package.json`
- `claude-toolkit`: `packages/claude-toolkit/npm/package.json`

Releases are triggered by prefixed tags: `primer-v*`, `mao-v*`, `toolkit-v*`.

## Submitting Changes

1. Fork and create a feature branch
2. Make your changes
3. Run relevant tests
4. Open a pull request with a clear description
