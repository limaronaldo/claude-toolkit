---
name: mao-plan
description: >
  Decomposes complex tasks into a DAG of atomic subtasks with model routing
  and dependency mapping. Use when the user wants to plan a multi-file feature,
  refactor, or system build without executing it yet. Triggers on "plan",
  "break down", "decompose", "task graph", or when the user wants to
  understand the work before committing to execution.
argument-hint: "[task or feature to decompose]"
allowed-tools: Read, Glob, Grep, Bash(git log*), Bash(git diff*), Bash(wc*)
---

# MAO Plan — Task Decomposition

Analyze a user request and produce a dependency-aware task graph without executing anything.

## Process

### 1. Understand the Codebase

Before decomposing, scan:
- Project structure (languages, frameworks, entry points)
- Existing patterns (naming, architecture, testing conventions)
- Related code to the requested change

### 2. Identify Concerns

Separate the request into distinct concerns:
- Data layer changes
- Business logic
- API/interface changes
- Tests
- Configuration/infrastructure

### 3. Break Into Atomic Tasks

Each task must be:
- **Atomic**: one clear deliverable
- **Independent**: minimal shared state with other tasks
- **Verifiable**: has a concrete verification criterion
- **Right-sized**: 15-60 minutes of focused work

Anti-patterns to avoid:
- Tasks that touch the same file for different reasons (split them)
- "Update tests" as a separate task (tests belong with their implementation)
- Tasks without clear verification criteria
- Tasks that require another task's output to even start writing code

### 4. Score Complexity

Rate each task using weighted factors:

| Factor | Weight |
|--------|--------|
| files_touched | ×1 |
| new_logic | ×3 |
| security_risk | ×5 |
| concurrency | ×5 |

**Model routing by score:**
- **0-3** → Haiku (boilerplate, CRUD, config, formatting)
- **4-7** → Sonnet (features, refactoring, integration, review)
- **8+** → Opus (architecture, security-critical, novel algorithms)

**Cost discipline targets:**
- Haiku: 40-50% of tasks
- Sonnet: 40-45% of tasks
- Opus: 5-15% of tasks

Override: if >30% routes to Opus, re-examine — likely over-scored.

### 5. Map Dependencies

Build a DAG (directed acyclic graph):
- Each task lists `depends_on: [task_ids]`
- Group into waves — tasks in the same wave can run in parallel
- Verify no circular dependencies

### 6. Output Task Graph

Write to `.orchestrator/state/task-graph.json`:

```json
{
  "intent": "Brief description of what the user wants",
  "config": {
    "max_parallel": 4,
    "created_at": "ISO-8601"
  },
  "tasks": {
    "T1": {
      "title": "Short task title",
      "description": "What to do",
      "depends_on": [],
      "model": "haiku|sonnet|opus",
      "complexity": 3,
      "verify": "How to verify this task is done correctly",
      "status": "pending"
    }
  },
  "dag_waves": [["T1", "T2"], ["T3"]],
  "worktrees": {}
}
```

### 7. Present to User

Show:
1. Visual DAG (ASCII or table showing waves and dependencies)
2. Model distribution breakdown (% haiku / sonnet / opus)
3. Estimated parallelism (how many agents run concurrently)
4. Ask for approval before any execution

## Common Patterns

**API Feature**: schema migration → model → service → controller → tests
**Refactoring**: identify boundaries → extract interfaces → move implementations → update imports → verify
**Data Pipeline**: source connector → transform → sink → monitoring → integration test
**Frontend Feature**: types/models → API client → state management → components → E2E test
