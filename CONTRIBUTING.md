# Contributing to Claude Toolkit

Thank you for your interest in contributing. This guide covers everything you need to get started.

## Repository Structure

This is an npm workspaces monorepo with three packages:

```
claude-toolkit/
  packages/
    claude-primer/        # Knowledge architecture generator
      npm/                # npm package (claude-primer)
      python/             # PyPI package (claude-primer)
      vscode/             # VS Code extension
      jetbrains/          # JetBrains plugin
    mao-orchestrator/     # Multi-agent orchestrator
      npm/                # npm package (mao-orchestrator)
    claude-toolkit/       # Unified CLI meta-package (claude-supertools)
      npm/                # npm package
```

## Prerequisites

- Node.js >= 18
- Python 3 (for claude-primer Python tests)
- Git

## Setup

```bash
git clone https://github.com/limaronaldo/claude-toolkit.git
cd claude-toolkit
npm install
```

This installs dependencies for all workspace packages.

## Running Tests

### All Node tests (from repo root)

```bash
npm test
```

This runs `node --test` across all workspaces using `node:test` and `node:assert/strict`.

### Individual workspace tests

```bash
npm run test:primer
npm run test:mao
npm run test:toolkit
```

### Python tests (claude-primer)

```bash
cd packages/claude-primer/python
python3 -m pytest
```

## Commit Conventions

This project uses [Conventional Commits](https://www.conventionalcommits.org/).

Format: `<type>(<scope>): <description>`

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `ci`, `perf`

Scopes: `primer`, `mao`, `toolkit`, or omit for repo-wide changes.

Examples:

```
feat(primer): add YAML output format
fix(mao): correct plugin resolution order
chore: update CI node matrix
docs(toolkit): clarify install instructions
```

Breaking changes: add `!` after the type/scope or include a `BREAKING CHANGE:` footer.

```
feat(primer)!: rename --output flag to --format
```

## Pull Request Process

1. Fork the repo and create a branch from `main`.
2. Make your changes. Keep PRs focused on a single concern.
3. Run the relevant tests and make sure they pass.
4. Write a clear PR title following conventional commit format.
5. Describe what changed and why in the PR body.
6. A maintainer will review your PR. Address any feedback, then it will be merged.

## Versioning and Releases

Each package is versioned independently. Version numbers live in:

| Package | Version source |
|---|---|
| claude-primer | `packages/claude-primer/npm/package.json` and `packages/claude-primer/python/pyproject.toml` |
| mao-orchestrator | `packages/mao-orchestrator/npm/package.json` |
| claude-toolkit | `packages/claude-toolkit/npm/package.json` |

Releases are triggered by pushing a prefixed Git tag:

- `primer-v*` -- publishes claude-primer
- `mao-v*` -- publishes mao-orchestrator
- `toolkit-v*` -- publishes claude-supertools

Do not bump version numbers in PRs unless you are preparing a release.

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).

---

Maintained by [aiconnai / limaronaldo](https://github.com/limaronaldo).
