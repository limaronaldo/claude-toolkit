# MAO — Command Usage Guide

## `/mao-plan <task>` — Plan only

Decomposes your task into a DAG of atomic tasks without executing anything. Use this to preview what MAO would do.

```
/mao-plan Implement JWT auth with refresh tokens and rate limiting
```

**What happens:**
1. Reads your codebase for existing patterns
2. Breaks the request into atomic tasks (e.g., T1: schema, T2: token logic, T3: middleware...)
3. Scores each task's complexity and assigns a model (haiku/sonnet/opus)
4. Maps dependencies as a DAG
5. Writes `.orchestrator/state/task-graph.json`
6. Shows you a task table + DAG waves + cost profile

**Example output:**

| ID | Task               | Model  | Score | Deps  | Verify                      |
|----|--------------------|--------|-------|-------|-----------------------------|
| T1 | Auth schema        | haiku  | 1     | —     | Migration runs, table exists |
| T2 | Token generation   | sonnet | 8     | T1    | JWT signs and validates      |
| T3 | Auth middleware     | sonnet | 4     | T1    | Rejects expired tokens       |
| T4 | Rate limiter       | sonnet | 4     | —     | 429 after threshold          |
| T5 | API endpoints      | sonnet | 5     | T2,T3 | Login returns valid JWT      |

```
Wave 1: T1, T4 (parallel)
Wave 2: T2, T3 (parallel)
Wave 3: T5
```

Nothing executes. You can edit `task-graph.json` manually before running `/mao`.

---

## `/mao <task>` — Full orchestration

Plans **and** executes the entire 7-phase workflow.

```
/mao Implement JWT auth with refresh tokens and rate limiting
```

**What happens:**
1. **Decompose** — same as `/mao-plan` (creates the DAG)
2. **Confirm** — shows you the plan and **waits for your approval**
3. **Setup** — creates git worktrees for parallel tasks
4. **Execute** — spawns sub-agents (haiku/sonnet/opus) in parallel worktrees
5. **Verify** — runs type-check/tests/lint on each task
6. **Review** — code review on non-trivial tasks; may create correction tasks
7. **Integrate** — merges worktrees in dependency order, cleans up

If the task is simple (1-2 files), it skips MAO and just does it directly.

**Progress output:**
```
[1/5] T1 (auth schema) — haiku, done
[2/5] T4 (rate limiter) — sonnet, done
[3/5] T2 (token generation) — sonnet, done
[4/5] T3 (auth middleware) — sonnet, retry 1/2
[5/5] T5 (API endpoints) — sonnet, done
```

If a task fails: retries same model → escalates (haiku→sonnet→opus) → explores parallel strategies as last resort.

**Tip:** If you already ran `/mao-plan` and have a `task-graph.json`, `/mao` will detect it. Edit the plan first, then run `/mao` to execute.

---

## `/mao-status` — Check run progress

No arguments. Run it anytime during or after a `/mao` execution.

```
/mao-status
```

**Shows:**
- Overall progress (e.g., "4/8 tasks complete")
- Task board with status per task (pending/running/done/failed)
- Escalation log (if any model bumps happened)
- Error summaries for failed tasks
- Metrics (model distribution, retries)

If no `.orchestrator/` directory exists, it tells you there's no active run.

---

## Typical workflow

```
/mao-plan <your task>          # 1. Preview the plan
                                # 2. Optionally edit task-graph.json
/mao <your task>               # 3. Execute (confirms before running)
/mao-status                    # 4. Check progress mid-run
```

Or go straight to `/mao <task>` — it plans, asks for confirmation, then executes.
