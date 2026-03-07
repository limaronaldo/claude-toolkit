# Claude Primer

[![PyPI](https://img.shields.io/pypi/v/claude-primer)](https://pypi.org/project/claude-primer/)
[![npm](https://img.shields.io/npm/v/claude-primer)](https://www.npmjs.com/package/claude-primer)
[![CI](https://github.com/limaronaldo/claude-primer/actions/workflows/ci.yml/badge.svg)](https://github.com/limaronaldo/claude-primer/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

Prime your repo for Claude Code.

Scans your project's DNA and generates the knowledge architecture Claude Code needs to work effectively.

Like a real primer, it prepares the surface so everything after it adheres better: `claude-primer` grounds Claude Code sessions in real project context from the first command.

## Generated Content Highlights

- **Iron Laws** — bright-line rules that are never violated
- **Decision Heuristics** — 6 concrete rules for autonomous decision-making
- **Stuck Protocol** — explicit steps when 3+ approaches fail
- **Red Flags** — self-monitoring triggers to prevent common mistakes
- **Rationalization Table** — excuse-to-reality mapping to catch bad reasoning
- **HARD-GATE tags** — absolute non-negotiable rules
- **Tier-based governance** — process weight proportional to blast radius
- **Defense-in-Depth debugging** — 4-layer validation after bug fixes
- **Git worktree guidance** — parallel development patterns (for git repos)
- **AUTO-MAINTAINED marker** — QUICKSTART.md flagged for automatic upkeep
- **Idempotent regeneration** — `--force` skips unchanged files

## Install

Choose your preferred method — all run the same tool:

```bash
# Python (recommended)
pipx run claude-primer              # zero install, runs directly
uvx claude-primer                   # alternative zero install
pip install claude-primer           # global install

# Node.js
npx claude-primer                   # zero install via npm

# macOS
brew install limaronaldo/tap/claude-primer

# GitHub Actions
# - uses: limaronaldo/claude-primer-action@v1
```

## Usage

```bash
claude-primer                       # interactive setup in current directory
claude-primer /path/to/project      # specific directory
claude-primer --dry-run             # preview without writing
claude-primer --force               # overwrite changed files (skip unchanged)
claude-primer --force-all           # overwrite all files unconditionally
claude-primer --yes                 # non-interactive (accept defaults)
claude-primer --plan-json           # output project analysis as JSON
claude-primer --with-readme         # also generate README.md
claude-primer --with-ralph          # generate Ralph integration files
claude-primer --reconfigure         # re-run wizard (ignore saved config)
claude-primer --no-git-check        # skip git safety entirely
claude-primer --from-doc FILE       # bootstrap from PRD/spec document
claude-primer --clean-root          # move aux docs to .claude/docs/
claude-primer --git-mode stash      # auto-stash dirty changes
claude-primer --git-mode skip       # skip git safety
```

Flags can be combined for full automation:

```bash
claude-primer --force --yes         # overwrite changed files, no prompts
claude-primer --force-all --yes     # overwrite ALL files, no prompts
claude-primer --git-mode skip --yes # full automation, no git checks
```

## What It Does

1. **Scans** your project — detects language, framework, deploy targets, monorepo structure
2. **Classifies** project tier (T1-T4) based on blast radius
3. **Extracts** from existing documentation if present
4. **Generates** four files with context-aware content:
   - `CLAUDE.md` — project map, invariants, decision heuristics, verification standards
   - `STANDARDS.md` — governance rules, code quality gates, naming conventions
   - `QUICKSTART.md` — essential commands and quick fixes
   - `ERRORS_AND_LESSONS.md` — mistake catalog with rationalization table
5. **Verifies** generated files have correct structure
6. **Saves** wizard answers to `.claude-setup.rc` for future runs

## GitHub Action

```yaml
name: Prime for Claude Code
on:
  push:
    branches: [main]

jobs:
  primer:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: limaronaldo/claude-primer-action@v1
        with:
          force: true
          commit: true
```

See [claude-primer-action](https://github.com/limaronaldo/claude-primer-action) for full documentation.

## Ralph Integration

The `--with-ralph` flag creates an integration layer that eliminates duplication between Ralph (an autonomous coding agent) and the Claude Primer knowledge architecture. Instead of maintaining separate context files, Ralph reads directly from the same generated documents, with a thin prompt wrapper and symlinks to keep everything in sync.

Files created by `--with-ralph`:

- `.ralph/PROMPT.md` — Ralph-specific development instructions referencing the knowledge architecture
- `.ralph/AGENT.md` — symlink to `QUICKSTART.md` (single source of truth)
- `.ralph/fix_plan.md` — prioritized task list (Ralph-owned, never overwritten without `--force`)
- `.ralph/hooks/post-loop.sh` — post-loop hook that detects changes to knowledge files
- `.ralphrc` — stack-aware Ralph project configuration at the project root

## Supported Stacks

Python, Node.js/TypeScript, Rust, Go, Ruby, Java/Kotlin, PHP, .NET, Elixir, Swift, Dart/Flutter, Zig, Scala

## Supported Frameworks

Django, Flask, FastAPI, Next.js, React, Vue, Svelte, SvelteKit, Remix, Astro, Express, NestJS, Hono, Axum, Actix, Rocket, Gin, Fiber, Echo, Phoenix, Spring, Laravel, Flutter, and more.

## Repository Structure

```
claude-primer/
├── README.md          # this file
├── LICENSE
├── docs/              # project documentation
├── python/            # PyPI package (claude-primer)
│   ├── claude_primer.py
│   ├── pyproject.toml
│   └── tests/
└── npm/               # npm package (claude-primer)
    ├── index.mjs
    ├── package.json
    └── tests/
```

## Authors

- Ronaldo Lima
- Breno Lima

## License

MIT
