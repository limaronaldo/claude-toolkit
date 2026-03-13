# claude-primer

claude-primer generates `CLAUDE.md` and knowledge-architecture documents so
that Claude Code has full context about your project from the very first
interaction.

---

## Installation

```bash
# npm (global)
npm install -g claude-primer

# npm (local dev dependency)
npm install --save-dev claude-primer

# pip
pip install claude-primer
```

### Editor Extensions

- **VS Code** -- install `claude-primer` from the VS Code Marketplace.
- **JetBrains** -- install `claude-primer` from the JetBrains Plugin
  Marketplace.

Both extensions provide a command-palette action to regenerate docs in place.

## Key Features

- **CLAUDE.md generation** -- scans your repo and produces a structured
  `CLAUDE.md` that describes the codebase layout, conventions, and build
  commands.
- **Knowledge architecture docs** -- creates additional markdown files
  covering architecture decisions, dependency maps, and testing strategies.
- **Framework detection** -- automatically identifies package managers,
  frameworks, and CI setups to tailor the output.
- **Incremental updates** -- re-running primer only changes sections that
  are out of date, keeping your manual edits intact.
- **Multi-language support** -- works with JavaScript/TypeScript, Python,
  Go, Rust, Java, and more.

## Usage

```bash
# Generate CLAUDE.md in the current project
claude-primer init

# Regenerate only the architecture section
claude-primer update --section architecture

# Check that generated docs are up to date
claude-primer check
```

## Configuration

Place a `.primer.yml` (or `.primer.json`) at your project root to customise
output paths, excluded directories, and section order.

## Related

- [mao-orchestrator](../mao/index.md) -- multi-agent orchestration
- [claude-toolkit](../toolkit/index.md) -- unified CLI that bundles primer
- [Home](../index.md)
