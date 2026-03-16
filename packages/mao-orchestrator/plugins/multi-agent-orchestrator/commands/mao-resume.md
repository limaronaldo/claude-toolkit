---
description: Resume a previously interrupted MAO orchestration run
---
# MAO Resume

Resume execution of an interrupted or paused multi-agent orchestration run.

## Instructions

### Step 1: Load State

Read the existing orchestration state:

```bash
cat .orchestrator/state/task-graph.json
```

If the file doesn't exist, report:
"No MAO run found in this project. Use `/mao <task>` to start a new run."

Also read STATE.md for human-readable context:
```bash
cat .orchestrator/state/STATE.md 2>/dev/null
```

### Step 2: Assess Current State

From task-graph.json, categorize all tasks:

- **Done**: status = "done" — skip these entirely
- **Failed**: status = "failed" — assess if retryable
- **Running**: status = "running" — these were interrupted mid-execution, reset to "pending"
- **Pending**: status = "pending" — ready to schedule when deps are met
- **Blocked**: status = "pending" but deps are not all "done" — wait

Present a status summary:

```
## Resuming: {intent}

Previously completed: {N} tasks
Interrupted (resetting to pending): {N} tasks
Remaining: {N} tasks
Failed (needs decision): {N} tasks

| ID | Task | Previous Status | Action |
|----|------|----------------|--------|
| T1 | ... | done | skip |
| T3 | ... | running | reset → pending |
| T4 | ... | failed (2 attempts) | retry? / skip? |
| T5 | ... | pending | schedule when T3 done |
```

### Step 3: Handle Failed Tasks

For each failed task, ask the user:
1. **Retry** — reset to pending, reset attempt counter
2. **Skip** — mark as "skipped", unblock dependents (dependents will run without this task's output)
3. **Manual** — user will fix it manually, mark as "done" after they confirm

### Step 4: Validate the DAG

After resetting interrupted tasks:
- Check that all deps for pending tasks reference tasks that are "done" or will be executed
- Check for any orphaned tasks (deps on "skipped" tasks)
- Verify worktrees still exist for parallel tasks, recreate if needed:
  ```bash
  git worktree list
  ```

### Step 5: Resume Execution

**⛔ Ask user to confirm before resuming execution.**

Show:
- Tasks that will run
- Estimated remaining waves
- Any worktrees that need recreation

On confirmation, proceed with the standard Phase 3 (Execute) loop from the main
`/mao` workflow. The scheduling algorithm naturally handles partially-complete DAGs —
it only runs tasks whose deps are all "done".

### Step 6: Update State

Update STATE.md to reflect the resumed run:
```markdown
## Resume Log
- Resumed at: {ISO timestamp}
- Tasks reset: {list}
- Tasks skipped: {list}
- Remaining: {N} tasks
```

## Edge Cases

- **Worktrees deleted**: Recreate them. The code is on the feature branch — check if the branch still exists:
  ```bash
  git branch | grep "feat/"
  ```
  If the branch exists, recreate the worktree pointing to it.

- **Main branch advanced**: If someone committed to main since the run started,
  pending tasks should still work (they create their own branches). But verify no
  conflicts exist with completed task branches before resuming.

- **Config changes**: If the user modified task-graph.json manually (added/removed tasks,
  changed models), respect those changes. Re-validate the DAG before executing.
