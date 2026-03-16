# Contributing to MAO

Thanks for your interest in contributing to MAO (Multi-Agent Orchestrator).

## Development Setup

```bash
git clone https://github.com/limaronaldo/claude-toolkit.git
cd claude-toolkit
```

MAO is a collection of Markdown, JSON, and Bash files — no build step required.

## Project Structure

```
plugins/multi-agent-orchestrator/
  agents/         # 8 agent definitions (.md with YAML frontmatter)
  commands/       # 3 Claude Code slash commands
  skills/         # Skill definition with references, scripts, templates
npm/              # npm installer CLI
docs/site/        # Landing page (static HTML)
```

## How to Contribute

### Adding or Modifying Agents

Agent files live in `plugins/multi-agent-orchestrator/agents/`. Each agent is a Markdown file with YAML frontmatter defining:
- `name` — agent identifier (prefixed with `mao-`)
- `model` — default model tier (haiku/sonnet/opus)
- `tools` — available tools for the agent

### Modifying Commands

Commands are in `plugins/multi-agent-orchestrator/commands/`. These are Claude Code slash commands with `description` and `argument-hint` frontmatter.

### Testing Changes

1. Copy modified files to `~/.claude/commands/` or `.claude/commands/`
2. Start a Claude Code session and test the commands
3. Verify the 7-phase workflow completes correctly

### Submitting Changes

1. Fork the repository
2. Create a feature branch (`git checkout -b feat/my-change`)
3. Make your changes
4. Ensure CI passes (JSON valid, structure intact, shell scripts lint-clean)
5. Open a pull request with a clear description

## Code of Conduct

Be respectful, constructive, and inclusive.
