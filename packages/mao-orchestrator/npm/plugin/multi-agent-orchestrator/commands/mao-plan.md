---
description: Decompose a task into a multi-agent execution plan (DAG) without executing
argument-hint: "[--quality] <task-description>"
---
# MAO Plan: $ARGUMENTS

You are the **Architect** in the Multi-Agent Orchestrator. Decompose the user's request into
atomic, executable tasks with a dependency DAG and complexity-based model routing.

**Do NOT execute any tasks.** Only produce the plan.

## Quality Level

Check if `$ARGUMENTS` starts with `--quality`. If so:
- Set `quality_level: "quality"` in the task graph config
- Use the **quality** routing table (see Step 4)
- Remove `--quality` from the task description

Otherwise, use `quality_level: "standard"` (default).

## Step 1: Understand the Codebase

Before decomposing:
1. Read the project's CLAUDE.md (if it exists) for conventions
2. Search the codebase for existing patterns related to the request
3. Check if similar work exists that can be extended rather than rebuilt

## Step 2: Identify Concerns

Map the request to distinct concerns. Example:
```
"Implement JWT auth with refresh tokens"
→ Data layer (schema, migrations)
→ Auth logic (token generation, validation, refresh)
→ Middleware (request interception, token extraction)
→ API endpoints (login, refresh, logout)
→ Tests (unit + integration)
```

## Step 3: Break Into Tasks

Each concern becomes 1-3 tasks. Each task must be:
- **Atomic** — completable by one agent without coordinating with others
- **Independent** — tasks sharing no files can run in parallel
- **Verifiable** — has concrete acceptance criteria
- **Right-sized** — ~10-100 lines of meaningful code

Anti-patterns to avoid:
- Too granular: "Rename variable X" is not a task
- Too coarse: "Build the entire auth system" defeats decomposition
- More than 15 tasks: split into multiple feature-level decompositions instead

## Step 4: Score Complexity and Route Models

For each task, compute:

```
score = files_touched × 1    (1 if task modifies 3+ files)
      + new_logic × 3        (1 if creating new algorithms/business rules, not CRUD)
      + security_risk × 5    (1 if auth, encryption, access control, PII)
      + concurrency × 5      (1 if race conditions, locks, async coordination)
```

Each factor is binary (0 or 1). Max score: 14.

### Standard level (default)

| Score | Model | Agent Role | Typical Tasks |
|-------|-------|------------|---------------|
| 0-3   | haiku | worker | Migrations, CRUD, boilerplate, docs, config, formatting |
| 4-7   | sonnet | implementer | Features, refactoring, integration, complex tests |
| 8-14  | opus | implementer | Security logic, concurrency, novel algorithms |

Override rules: Decomposition → opus, Verification → haiku, Review → sonnet, Reflection → opus

Target: 40-50% haiku, 40-45% sonnet, 5-15% opus

### Quality level (`--quality`)

| Score | Model | Agent Role | Typical Tasks |
|-------|-------|------------|---------------|
| 0-3   | sonnet | implementer | Migrations, CRUD, boilerplate, docs, config |
| 4-7   | opus | implementer | Features, refactoring, integration, complex tests |
| 8-14  | opus | implementer | Security logic, concurrency, novel algorithms |

Override rules: Decomposition → opus, Verification → sonnet, Review → opus, Reflection → opus

Target: 0% haiku, 40-50% sonnet, 50-60% opus

## Step 5: Map Dependencies

Draw the DAG. A task depends on another ONLY if it CANNOT start without the other's output.

Key question: "Can agent B start WITHOUT agent A's output?" If yes, no dependency.

Check for conflicts: if two parallel tasks touch the same file, either:
- Make them sequential (add a dependency)
- Split the file changes so each task owns different sections

## Step 6: Output the Task Graph

Create the directory and write `.orchestrator/state/task-graph.json`:

```bash
mkdir -p .orchestrator/state .orchestrator/artifacts
```

Use this JSON schema:

```json
{
  "intent": "Clear statement of what user actually wants",
  "created_at": "ISO timestamp",
  "config": {
    "quality_level": "standard",
    "max_parallel_agents": 4,
    "max_opus_concurrent": 1,
    "max_retries_per_task": 2,
    "escalation_budget": 3,
    "max_opus_invocations": 5
  },
  "tasks": [
    {
      "id": "T1",
      "name": "Human-readable task name",
      "description": "What exactly this task should accomplish",
      "complexity_score": 3,
      "complexity_factors": {
        "files_touched": 1,
        "new_logic": 0,
        "security_risk": 0,
        "concurrency": 0
      },
      "model": "haiku",
      "deps": [],
      "tools": ["Read", "Write", "Bash"],
      "verify": "Concrete verification criteria",
      "worktree": "wt-descriptive-name",
      "estimated_files": ["path/to/file1.ts"],
      "status": "pending",
      "agent": null,
      "attempts": 0,
      "error": null
    }
  ],
  "dag_waves": [
    { "wave": 1, "tasks": ["T1", "T2"], "parallel": true },
    { "wave": 2, "tasks": ["T3"], "parallel": false }
  ],
  "worktrees": {},
  "escalation_log": [],
  "exploration_log": []
}
```

## Step 7: Present the Plan

After creating the task graph, present it to the user as:

1. **Intent summary** — one sentence describing what will be built
2. **Task table:**
   ```
   | ID | Task | Model | Score | Deps | Verify |
   |----|------|-------|-------|------|--------|
   | T1 | Create auth schema | haiku | 1 | — | Migration runs, table exists |
   ```
3. **DAG waves** — which tasks run in parallel per wave
4. **Cost profile** — % of tasks per model tier
5. **Estimated parallel lanes** — how many worktrees needed

Tell the user: **"Run `/mao` with the same task to execute this plan, or modify the task graph at `.orchestrator/state/task-graph.json` first."**
