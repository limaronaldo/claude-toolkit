---
name: mao-worktree
description: >
  Sets up and manages isolated git worktrees for parallel agent work.
  Use when you need to run multiple agents on independent tasks simultaneously,
  or when any work benefits from branch isolation. Triggers on "worktree",
  "parallel", "isolate", or when dispatching concurrent agents.
argument-hint: "[number of worktrees or task names]"
allowed-tools: Read, Bash(git*), Bash(npm*), Bash(pip*), Bash(cargo*), Bash(go*), Bash(ls*), Bash(cat*)
---

# MAO Worktree — Parallel Isolation

Manage git worktrees for concurrent agent execution with safety checks.

## What Worktrees Solve

Multiple agents editing the same repo cause conflicts. Worktrees give each agent
its own working directory on a separate branch — same repo, no interference.

## Setup

### 1. Choose Directory

Priority order:
1. Check for existing `.worktrees/` or `worktrees/` directory
2. Check CLAUDE.md for worktree directory preference
3. Default to `.worktrees/` in project root

### 2. Safety Verification

**Before creating any worktree:**

```bash
# Verify the worktree directory is git-ignored
git check-ignore .worktrees/
```

If NOT ignored:
1. Add `.worktrees/` to `.gitignore`
2. Stage and commit the `.gitignore` change
3. Only then proceed with worktree creation

This prevents accidentally tracking worktree contents in the repo.

### 3. Create Worktrees

```bash
# Create worktree for task T1
git worktree add .worktrees/T1 -b mao/T1

# Verify it was created
git worktree list
```

### 4. Install Dependencies

Auto-detect project type and install:

| Detected | Command |
|----------|---------|
| `package.json` | `npm install` or `yarn install` |
| `requirements.txt` | `pip install -r requirements.txt` |
| `Cargo.toml` | `cargo build` |
| `go.mod` | `go mod download` |
| `pyproject.toml` | `pip install -e .` |

### 5. Baseline Verification

Run the project's test suite in the worktree:

```bash
cd .worktrees/T1
# Run tests appropriate for the project
npm test  # or pytest, cargo test, go test ./...
```

Report any pre-existing failures. Do NOT proceed if the baseline is broken
without explicit user permission.

## Rules During Execution

- **One agent per worktree** — never share a worktree between agents
- **Read-only access to main** — agents only write to their worktree branch
- **Branch per worktree** — all commits go to the `mao/T{id}` branch
- **No cross-worktree imports** — agents must not reference paths in other worktrees

## Merge Protocol

Merge worktrees sequentially in dependency order:

```bash
# From main branch
git merge mao/T1 --no-ff -m "Integrate T1: {task title}"

# Run tests after each merge
npm test

# Only proceed to next merge if tests pass
git merge mao/T2 --no-ff -m "Integrate T2: {task title}"
```

If merge conflicts occur:
1. Identify which agent's changes should take priority (based on task dependencies)
2. Resolve conflicts preserving both agents' intent
3. Run full test suite after resolution
4. If complex, spawn a dedicated resolver agent

## Cleanup

After all merges are complete and tests pass:

```bash
# Remove worktrees
git worktree remove .worktrees/T1
git worktree remove .worktrees/T2

# Prune stale entries
git worktree prune

# Delete merged branches
git branch -d mao/T1 mao/T2
```

## Limits

- **Max concurrent worktrees**: 4-6 (practical limit for Claude Code sessions)
- **When NOT to use**: single-file changes, sequential tasks, exploratory debugging
- **Disk overhead**: each worktree is a full working copy (minus `.git`)
