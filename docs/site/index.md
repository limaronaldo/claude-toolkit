# Claude Toolkit Documentation

Claude Toolkit is a monorepo providing tools for AI-assisted software
development with Claude Code. It ships three packages that can be used
independently or together.

---

## Packages

### [claude-primer](primer/index.md)

Generates `CLAUDE.md` files and knowledge-architecture documents so Claude
Code understands your project from the first prompt. Available as a CLI, an
npm package, a pip package, and editor extensions for VS Code and JetBrains.

### [mao-orchestrator](mao/index.md)

Multi-Agent Orchestrator (MAO) that coordinates eight specialised agents
through DAG-based task scheduling. Enforces TDD, isolates work in git
worktrees, and supports configurable quality levels.

### [claude-toolkit](toolkit/index.md)

Meta-package that combines claude-primer and mao-orchestrator behind a
single CLI. Provides `init`, `doctor`, and `update` commands for quick
project setup and maintenance.

---

## Quick Start

```bash
# Install the meta-package (includes primer + mao)
npm install -g claude-toolkit
```

```bash
# Or install individual packages
npm install -g claude-primer
npm install -g mao-orchestrator
```

## Repository Layout

```
claude-toolkit/
  packages/
    claude-primer/      # Knowledge generation
    mao-orchestrator/   # Multi-agent orchestration
    claude-toolkit/     # Unified CLI meta-package
  docs/
    site/               # This documentation
```

## Links

- [Getting Started with Primer](primer/index.md)
- [Getting Started with MAO](mao/index.md)
- [Meta-Package CLI Reference](toolkit/index.md)

---

## Contributing

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for development guidelines and
the monorepo workflow.

## License

This project is open source. See [LICENSE](../../LICENSE) for details.
