# Worktree Hygiene

Keep git worktrees clean and isolated throughout the orchestration lifecycle.

## Setup Rules

- Always verify `.worktrees/` (or chosen directory) is in `.gitignore` before creating worktrees
- If not ignored, add it and commit before proceeding
- One agent per worktree — never share
- Run baseline tests in each worktree before starting work

## During Execution

- Agents only write to their own worktree branch (`mao/T{id}`)
- Read-only access to main branch
- No cross-worktree file references
- Commit frequently within the worktree branch

## Merge Protocol

- Merge worktrees sequentially in dependency order
- Run full test suite after each merge — stop if tests fail
- Resolve conflicts by understanding both agents' intent, not by discarding changes

## Cleanup

- After all merges complete and tests pass, remove all worktrees
- Prune stale worktree entries: `git worktree prune`
- Delete merged branches: `git branch -d mao/T{id}`
- Never leave orphaned worktrees — clean up even if orchestration fails partway

## Limits

- Maximum 4-6 concurrent worktrees
- Skip worktrees for single-file changes
- Skip worktrees for sequential-only task graphs (no parallelism benefit)
