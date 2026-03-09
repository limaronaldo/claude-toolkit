# MAO Marketplace — Multi-Agent Orchestrator for Claude Code

Orchestrate multi-agent workflows with intelligent **Opus/Sonnet/Haiku model tiering**,
DAG-based task scheduling, git worktrees for parallelism, and self-correction loops.

## What It Does

Turns a single Claude Code session into a coordinated AI team:

- **Architect** (Opus) decomposes your problem into atomic tasks
- **Orchestrator** (Sonnet) schedules tasks as a DAG, manages worktrees
- **Workers** (Haiku) handle mechanical tasks at 1/15th the cost of Opus
- **Implementers** (Sonnet) build features and business logic
- **Verifiers** (Haiku) run automated test/lint/type-check pipelines
- **Reviewers** (Sonnet) do cross-agent code review
- **Reflector** (Opus) learns patterns for future optimization
- **Explorers** (Sonnet) search solution space when tasks fail

Result: **60-70% cost reduction** vs all-Opus, with quality maintained through
5 layers of self-correction (Reflexion, verification, peer review, escalation, exploration).

## Installation

### From GitHub Marketplace (Recommended)

```bash
# 1. Add the marketplace
/plugin marketplace add aiconnai/mao-marketplace

# 2. Install the plugin
/plugin install multi-agent-orchestrator@mao-marketplace
```

### Local Installation

```bash
# Clone the repo
git clone https://github.com/aiconnai/mao-marketplace.git

# Add as local marketplace
/plugin marketplace add ./mao-marketplace

# Install
/plugin install multi-agent-orchestrator@mao-marketplace
```

### Manual Installation (Copy Files)

```bash
# Copy agents to your project
cp -r mao-marketplace/plugins/multi-agent-orchestrator/agents/*.md .claude/agents/

# Copy the skill
mkdir -p .claude/skills
cp -r mao-marketplace/plugins/multi-agent-orchestrator/skills/multi-agent-orchestrator .claude/skills/
```

## Quick Start

After installation, just describe a complex task:

```
> Implement JWT authentication with refresh token rotation, rate limiting,
  and brute-force protection for the API
```

The MAO skill activates automatically for multi-file/multi-concern tasks.

Or invoke explicitly:

```
> Use the mao-architect to decompose: "Build a lead scoring system
  with real-time enrichment and fraud detection"
```

## Recommended Session Mode

```bash
claude --model opusplan
```

This uses Opus for planning/reflection and Sonnet for execution — matching
MAO's philosophy perfectly.

## Requirements

- Claude Code v1.0.33+ (for plugin support)
- Git (for worktree operations)
- A project with tests/lint configured (for verification pipeline)

## License

MIT
