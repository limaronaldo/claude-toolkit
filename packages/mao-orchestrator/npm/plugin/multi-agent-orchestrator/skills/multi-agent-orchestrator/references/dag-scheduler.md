# DAG Scheduler Reference

## Core Algorithm

The scheduler runs a simple event loop over the task DAG:

```
FUNCTION schedule(task_graph):
    pending = all tasks
    running = empty set
    completed = empty set
    
    WHILE pending is not empty:
        # Find ready tasks (deps satisfied, not running)
        ready = [t for t in pending
                 if all(dep in completed for dep in t.deps)]
        
        # Apply resource limits
        available_slots = max_parallel - len(running)
        opus_slots = max_opus_concurrent - count(running, model=opus)
        
        # Select tasks to run (priority: highest complexity first)
        to_run = select(ready, available_slots, opus_slots)
        
        FOR task IN to_run:
            remove task from pending
            add task to running
            spawn_executor(task)
        
        # Wait for any completion
        completed_task = wait_for_any(running)
        remove completed_task from running
        add completed_task to completed
        
        # Handle result
        IF completed_task.failed:
            apply_retry_strategy(completed_task)
    
    RETURN completed
```

## Priority Strategy

When multiple tasks are ready, prioritize by:

1. **Critical path** — tasks that block the most downstream tasks
2. **Complexity** — higher complexity first (gets the hard work started early)
3. **Cost** — among equal priority, cheaper models first

To find the critical path: count how many tasks transitively depend on each task.
The task with the most transitive dependents is on the critical path.

## Resource Constraints

```json
{
  "max_parallel": 4,
  "max_opus_concurrent": 1,
  "max_haiku_concurrent": 4,
  "max_sonnet_concurrent": 3
}
```

Rationale:
- Claude Code has practical limits on concurrent subagents
- Opus is expensive and rate-limited — cap at 1 concurrent
- Haiku is cheap — use all available slots
- Sonnet is the workhorse — allow up to 3

## Deadlock Detection

Before scheduling, validate the DAG:

```
FUNCTION detect_cycle(task_graph):
    visited = empty set
    in_stack = empty set
    
    FOR each task:
        IF task not in visited:
            IF dfs_has_cycle(task, visited, in_stack):
                RETURN cycle_path
    
    RETURN no_cycle
```

If a cycle is detected, report to the user and abort.

## Wave Computation

For visualization, compute "waves" — groups of tasks that can run simultaneously:

```
Wave 1: tasks with no dependencies
Wave 2: tasks whose deps are all in Wave 1
Wave 3: tasks whose deps are all in Wave 1 or 2
...
```

This is useful for progress reporting but the scheduler doesn't need it —
it just runs anything whose deps are met.

## Handling Dynamic Tasks

The reviewer may create correction tasks (e.g., T3.1 fixing an issue found in T3).
These are added to the DAG dynamically:

1. Add the new task to the task graph
2. Set its deps to include the original task
3. Mark it as pending
4. The scheduler will pick it up in the next iteration

## Progress Reporting

For runs with 6+ tasks, report progress after each completion:

```
[4/12] ✅ T3 (auth middleware) — haiku, 45s
[5/12] ❌ T4 (token refresh) — sonnet, retry 1/2
[6/12] ✅ T4 (token refresh) — sonnet, 120s (retry succeeded)
```
