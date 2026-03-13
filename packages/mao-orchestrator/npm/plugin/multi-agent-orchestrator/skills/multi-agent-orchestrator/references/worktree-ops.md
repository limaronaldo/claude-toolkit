# Git Worktree Operations Reference

## What Are Worktrees?

Git worktrees allow multiple working directories for the same repo. Each worktree
has its own branch, working directory, and index — but shares the same .git database.

This enables parallel agents to work on different branches simultaneously without
interfering with each other.

## Setup

### Create Worktrees for Parallel Tasks

```bash
# From the main repo directory
# Create a worktree for each parallel task

git worktree add ../wt-{task-name} -b feat/{task-name}

# Example for 3 parallel tasks:
git worktree add ../wt-auth-schema -b feat/auth-schema
git worktree add ../wt-auth-middleware -b feat/auth-middleware
git worktree add ../wt-auth-refresh -b feat/auth-refresh
```

### Verify Worktrees

```bash
git worktree list
# Should show:
# /path/to/repo        abc1234 [main]
# /path/to/wt-auth-schema  abc1234 [feat/auth-schema]
# /path/to/wt-auth-middleware  abc1234 [feat/auth-middleware]
```

## Rules

1. **One agent per worktree** — never let two agents write to the same worktree
2. **Read-only access to main** — agents can read from main repo for reference
3. **Branch per worktree** — each worktree has its own feature branch
4. **No cross-worktree writes** — agents must not modify other worktrees

## Agent Execution in Worktrees

Each agent receives:
- `worktree_path`: the directory to work in (e.g., `../wt-auth-schema`)
- All file operations happen relative to this path
- Tests and builds run from this directory

```bash
# Agent working in its worktree
cd ../wt-auth-schema

# Make changes
# ... (agent implements task)

# Commit
git add -A
git commit -m "feat(auth): create auth schema migration"
```

## Merge Protocol

After all tasks in a wave complete, merge sequentially:

```bash
# Back in main repo
cd /path/to/repo

# Merge in dependency order (most upstream first)
git merge feat/auth-schema --no-ff -m "Merge feat/auth-schema"

# Verify after each merge
npm test  # or cargo test, etc.

# If tests pass, continue with next branch
git merge feat/auth-middleware --no-ff -m "Merge feat/auth-middleware"

# If merge conflict:
#   1. Identify conflicting files
#   2. Spawn a Sonnet resolver agent with conflict context
#   3. Resolver fixes conflicts and commits
#   4. Verify tests again
```

## Conflict Resolution

When a merge fails:

```bash
# Get conflict details
git diff --name-only --diff-filter=U

# For each conflicted file, get the conflict markers
git diff --diff-filter=U
```

Provide this context to the resolver agent:
- Which files conflict
- The conflict markers (both sides)
- What each branch was trying to do (from task descriptions)

## Cleanup

After all merges complete:

```bash
# Remove all orchestrator worktrees
git worktree list | grep "wt-" | awk '{print $1}' | while read wt; do
    git worktree remove "$wt" --force
done

# Prune stale worktree records
git worktree prune

# Optionally delete feature branches
git branch | grep "feat/" | xargs git branch -d
```

## When NOT to Use Worktrees

- Sequential tasks that depend on each other — just work in main
- Tasks that modify the same files — make them sequential instead
- Tasks that share build artifacts — separate worktrees mean separate builds
- Single-task runs — unnecessary overhead

## Worktree Limits

- Keep to 4-6 concurrent worktrees (matches max_parallel_agents)
- Each worktree is a full copy of the working directory (disk space)
- Some tools (IDEs, file watchers) may get confused by multiple worktrees

## Worktree Map

The orchestrator maintains a map in `.orchestrator/state/task-graph.json`:

```json
{
  "worktrees": {
    "wt-auth-schema": {
      "task_id": "T1",
      "branch": "feat/auth-schema",
      "agent": "mao-worker",
      "status": "active"
    }
  }
}
```
