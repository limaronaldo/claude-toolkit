---
project: claude-toolkit
stack: python, node, java
framework: none detected
tier: T3
generated_by: claude-primer v1.8.1
last_updated: 2026-03-16
---

# CLAUDE.md

<!-- Target: keep this file under 300 lines. Split detail into STANDARDS.md or local CLAUDE.md files. -->

This file provides guidance to Claude Code when working in this repository.

**Quick reference:** [QUICKSTART.md](QUICKSTART.md)
**Standards:** [STANDARDS.md](STANDARDS.md)
**Mistakes:** [ERRORS_AND_LESSONS.md](ERRORS_AND_LESSONS.md)

---

## Routing Rules

If the task is inside a subdirectory that has its own CLAUDE.md:
1. **Read the local CLAUDE.md first** — it is the primary source for that scope.
2. Use this root file only as general context.
3. If the local file conflicts with this file, **the local file wins**.

---

## Repository Overview

A monorepo containing tools for AI-assisted development with Claude Code.

**Tech stack:** python, node, java
**Frameworks:** none detected
**Suggested tier:** T3 (medium confidence) — review required
**Tier rationale:** code detected but no external-facing framework
**Deploy:** github_actions
**Monorepo:** yarn_workspaces
**Workspace dirs:** packages

### Directory Structure

```
claude-toolkit/
├── docs/
├── packages/
├── CLAUDE.md
├── README.md
├── STANDARDS.md
├── QUICKSTART.md
├── ERRORS_AND_LESSONS.md
├── CONTRIBUTING.md
```

---

## Environment

<!-- [inferred] -->
- **Python:** 3.11+ recommended
- **Node.js:** 18+ recommended
- **Java:** 17+ (LTS)

---

## Common Commands

<!-- [migrated] -->
```bash
pip install -r requirements.txt  # or: pip install -e .
npm install
pytest
npm test
npm run test                 # npm --workspaces test
npm run test:primer          # npm -w claude-primer test
npm run test:mao             # npm -w mao-orchestrator test
npm run test:toolkit         # npm -w claude-supertools test
mvn install  # or: gradle build
gradle test
git worktree list                 # see all active worktrees
```

---

## Testing

Test directories: packages/claude-primer/npm/tests, packages/claude-primer/python/tests, packages/claude-toolkit/npm/tests, packages/mao-orchestrator/npm/tests

```bash
pytest
npm test
gradle test
```

---

## Code Architecture

<!-- [placeholder] -->

### Patterns
<!-- Ex: MVC, Clean Architecture, Event-driven, Layered, etc. -->

### Key Modules
<!-- List the main modules/packages and their responsibilities -->

### Data Flow
<!-- Describe the primary data flow of the application -->

---

## Invariants

> **Iron Law:** Read before writing. Understand existing code before changing it.

- Validate external input at system boundaries
- Never silently swallow errors — log or propagate with context
- Prefer dry-run for operations with external side effects
- Document decisions that affect future tasks
- Read local CLAUDE.md before modifying scoped code

---

## Decision Heuristics

When in doubt, apply these in order:

1. **Reversible over perfect** — prefer actions you can undo over waiting for certainty
2. **Smallest viable change** — solve the immediate problem, nothing more
3. **Existing patterns over new abstractions** — follow what the codebase already does
4. **Explicit failure over silent success** — if unsure something worked, make it loud
5. **Data over debate** — run the test, check the log, read the error
6. **Ask over assume** — when a decision has consequences you cannot reverse, ask the user

---

## Verification Standard

> **Iron Law:** Evidence before claims, always.

- Run the actual command — don't assume success
- Fresh verification after every change — stale results are lies
- Independent verification — don't trust agent output without checking
- Verify at every layer the data passes through (defense-in-depth)

---

## Red Flags

If you catch yourself thinking any of these, **STOP and follow the process:**

- "This is just a quick fix" → Follow the full process anyway
- "I don't need to test this" → You definitely need to test this
- "It should work now" → RUN the verification
- "One more attempt should fix it" → 3+ failures = architectural problem, step back
- "Too simple to need a plan" → Simple changes break complex systems
- "I'll clean it up later" → Later never comes. Do it right now

---

## Stuck Protocol

If you have tried **3+ approaches** to the same problem without progress:

1. **Stop** — do not attempt another fix
2. **Document** the blocker: what you tried, what failed, what you suspect
3. **List** remaining untried approaches (if any)
4. **Skip** — move to the next task or ask the user for guidance

Spinning without progress is the most expensive failure mode. Detecting it early is critical.

---

## Key Decisions

<!-- [placeholder] -->
| Decision | Rationale | Status |
|----------|-----------|--------|
| <!-- e.g. Use PostgreSQL --> | <!-- why this choice --> | <!-- Active / Revisit / Superseded --> |

<!-- Track decisions that constrain future work. Remove rows when no longer relevant. -->

---

## Active Risks

<!-- [placeholder] -->
<!-- What is currently fragile, under migration, or operationally risky -->
<!-- Remove items as they are resolved -->

---

## Formatting Standards

<!-- [placeholder] -->
- Use consistent indentation (spaces or tabs, not mixed)
- Maximum line length: 100 characters
- Files end with a single newline
- No trailing whitespace
- Use descriptive variable and function names
- Keep functions focused — one responsibility per function
- Prefer explicit over implicit

---

## Pre-Task Protocol

### Announce at Start

Before writing any code, announce:

1. **What approach** you are using (fix, feature, refactor, etc.)
2. **Which files** you expect to modify
3. **What verification** you will run when done

### Checklist

Before starting any task:

<!-- [placeholder] -->
- [ ] Read ERRORS_AND_LESSONS.md for known pitfalls
- [ ] Check if a local CLAUDE.md exists in the working directory
- [ ] Understand the existing code before making changes
- [ ] Run tests after changes to verify nothing broke
- [ ] Keep changes minimal and focused on the task

### Post-Task

Before ending a session or completing a task:

- [ ] Update ERRORS_AND_LESSONS.md if you hit a non-obvious problem
- [ ] Record any decision that constrains future work in Key Decisions
- [ ] If work is incomplete, leave a clear note about what remains
- [ ] Run final verification to confirm nothing is broken

---

## Parallel Development

Use git worktrees for parallel tasks without branch-switching conflicts:

```bash
claude --worktree feature-name    # isolated worktree + Claude session
claude -w bugfix-123 --tmux       # worktree in tmux session
git worktree list                 # see all active worktrees
```

- Each worktree gets its own branch and working directory
- Worktrees share git history — no duplicate clones
- Focus independent tasks in parallel — avoid editing same files
- Cleanup is automatic when Claude session ends without changes

---

## AI-Assisted Development

### Model Routing

- **Haiku** (cheap): CRUD, boilerplate, migrations, config, docs, formatting
- **Sonnet** (mid): Features, refactoring, integration, code review, tests
- **Opus** (expensive): Architecture, security logic, concurrency, novel algorithms

### Cost Discipline

- Target: 40-50% Haiku, 40-45% Sonnet, 5-15% Opus
- Never use Opus for: CRUD, boilerplate, formatting, imports, docs
- Escalation: haiku → sonnet → opus (only on failure)

### When to Decompose

- Feature spans 3+ files → decompose into task DAG
- Multiple independent concerns → parallelize with worktrees
- Simple 1-2 file change → implement directly

### Verification Pipeline

Run in this order (stop at first failure):

```bash
python -m mypy .                         # type-check
python -m pytest                         # test
python -m ruff check .                   # lint
python -m ruff format --check .          # format
```

---

## Provenance

Content in this file was assembled from:

- `CLAUDE.md:commands`
- `README.md`
- `STANDARDS.md`

Sections containing `migrated` in a comment came from existing files — verify accuracy.
Sections containing `inferred` were detected from project structure — may need correction.
Sections containing `placeholder` need manual input.

---

## Document Information

**Last Updated:** 2026-03-16
**Generated by:** claude-primer v1.8.1
