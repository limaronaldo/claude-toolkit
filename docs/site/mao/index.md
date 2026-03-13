# mao-orchestrator

MAO (Multi-Agent Orchestrator) coordinates eight specialised Claude Code
agents to break down, implement, test, and ship complex tasks safely.

---

## Installation

```bash
# npm (global)
npm install -g mao-orchestrator

# npm (local dev dependency)
npm install --save-dev mao-orchestrator
```

## Key Features

- **8 specialised agents** -- Planner, Architect, Implementer, Tester,
  Reviewer, Debugger, Integrator, and Documenter each handle a distinct
  phase of the development lifecycle.
- **DAG-based task scheduling** -- tasks are modelled as a directed acyclic
  graph so independent work streams run in parallel while dependencies are
  respected.
- **TDD enforcement** -- the orchestrator requires tests to be written
  before implementation and blocks merges when coverage thresholds are not
  met.
- **Git worktree isolation** -- each agent operates in its own git worktree,
  preventing conflicts and keeping the main branch clean until integration.
- **Quality levels** -- choose from `draft`, `standard`, or `strict` to
  control how much review, testing, and documentation is required before a
  task is marked complete.
- **Resumable runs** -- if a run is interrupted, MAO can pick up from the
  last completed node in the DAG.

## Usage

```bash
# Run the orchestrator on a task description
mao run "Add pagination to the /users endpoint"

# Run with strict quality level
mao run --quality strict "Refactor auth module"

# Show the task DAG without executing
mao plan "Add dark mode support"

# Resume an interrupted run
mao resume <run-id>
```

## Configuration

Create a `.mao.yml` at the project root to set default quality level, agent
timeouts, worktree directory, and branch naming conventions.

## How It Works

1. The **Planner** decomposes the task into sub-tasks.
2. The **Architect** designs the solution and produces a DAG.
3. Leaf nodes are assigned to **Implementer** and **Tester** agents.
4. The **Reviewer** checks each deliverable against quality criteria.
5. The **Integrator** merges worktrees and resolves conflicts.
6. The **Documenter** updates project docs (including `CLAUDE.md` via
   primer).
7. The **Debugger** is invoked on-demand when tests fail.

## Related

- [claude-primer](../primer/index.md) -- knowledge generation used by MAO
- [claude-toolkit](../toolkit/index.md) -- unified CLI that bundles MAO
- [Home](../index.md)
