# claude-toolkit

claude-toolkit is the meta-package that combines claude-primer and
mao-orchestrator behind a single CLI, giving you one install and one command
surface for all Claude Code tooling.

---

## Installation

```bash
# npm (global -- recommended)
npm install -g claude-toolkit

# npm (local dev dependency)
npm install --save-dev claude-toolkit
```

Installing claude-toolkit automatically installs both claude-primer and
mao-orchestrator as dependencies.

## CLI Commands

### `claude-toolkit init`

Bootstraps a project for use with Claude Code:

- Runs `claude-primer init` to generate `CLAUDE.md` and knowledge docs.
- Creates a default `.mao.yml` with sensible quality settings.
- Adds recommended entries to `.gitignore`.

```bash
claude-toolkit init
```

### `claude-toolkit doctor`

Checks that the local environment is properly configured:

- Verifies Node.js and npm versions.
- Confirms claude-primer and mao-orchestrator are reachable.
- Validates `.mao.yml` and `.primer.yml` schemas.
- Reports any missing git worktree prerequisites.

```bash
claude-toolkit doctor
```

### `claude-toolkit update`

Brings generated files up to date in one step:

- Re-runs primer to refresh `CLAUDE.md`.
- Updates pinned agent versions inside `.mao.yml`.
- Checks for newer claude-toolkit releases and prints upgrade instructions.

```bash
claude-toolkit update
```

## When to Use the Meta-Package

| Scenario | Recommended package |
|---|---|
| Only need CLAUDE.md generation | `claude-primer` |
| Only need multi-agent orchestration | `mao-orchestrator` |
| Want both with a unified CLI | `claude-toolkit` |

## Related

- [claude-primer](../primer/index.md) -- knowledge generation
- [mao-orchestrator](../mao/index.md) -- multi-agent orchestration
- [Home](../index.md)
