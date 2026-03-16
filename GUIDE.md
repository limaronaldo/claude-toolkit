# MAO — Complete AI Reference Guide

> **Multi-Agent Orchestrator for Claude Code**
> This document teaches you everything MAO can do and how to use each capability — individually or combined.

---

## What is MAO?

MAO transforms a single Claude Code session into a coordinated multi-agent system. It decomposes complex tasks into a DAG of atomic subtasks, assigns each to the right model tier (Haiku/Sonnet/Opus), and executes them with parallelism, verification, and self-correction loops.

**Core principle**: Smaller agents with focused scope produce better code than one large agent trying to do everything.

---

## Table of Contents

1. [Quick Reference](#quick-reference)
2. [Commands](#commands)
3. [Skills](#skills)
4. [Agents](#agents)
5. [Rules](#rules)
6. [Hooks](#hooks)
7. [Combination Recipes](#combination-recipes)
8. [Model Routing](#model-routing)
9. [Directory Structure](#directory-structure)

---

## Quick Reference

| I want to... | Use |
|--------------|-----|
| Build a complex feature | `/mao <description>` |
| Plan without executing | `/mao-plan <description>` |
| Resume interrupted work | `/mao-resume` |
| Check orchestration progress | `/mao-status` |
| Find the right skill | `/skills-directory` |
| Review my code | `/mao-review` |
| Run TDD workflow | `/mao-tdd` |
| Verify everything passes | `/mao-verify` |
| Security audit (static) | `/mao-security` |
| Security audit (dynamic) | `/mao-pentest` |
| Design a REST API | `/mao-api-design` |
| Backend architecture help | `/mao-backend` |
| Enforce coding standards | `/mao-coding-standards` |
| Write E2E tests | `/mao-e2e` |
| Eval-driven development | `/mao-eval-harness` |
| TDD best practices | `/mao-tdd-patterns` |

---

## Commands

Commands are the entry points — they trigger workflows.

### `/mao` — Full Orchestration

The complete workflow in 7 phases:

```
/mao build a user authentication system with JWT and refresh tokens
```

**Phases:**
1. **Decompose** — Analyze codebase, break task into atomic subtasks, score complexity, build DAG
2. **Schedule** — Validate DAG, create git worktrees for parallel execution
3. **Execute** — Process waves sequentially; tasks within a wave run in parallel via sub-agents
4. **Verify** — Run verification pipeline: type-check → test → lint → format
5. **Review** — Code review for tasks with complexity ≥ 4 (security, performance, design, completeness)
6. **Reflect** — Meta-analysis for complex runs (8+ tasks): did the combined result solve the problem?
7. **Integrate** — Merge worktree branches in dependency order, run full test suite

**Self-correction chain** (on failure):
```
retry same model → peer assist → escalate tier → exploration (3 parallel strategies) → budget exhausted
```

**Constraints (standard mode):**
- Max 4 parallel agents, max 1 Opus concurrent
- Max 2 retries per task before escalation
- Max 15 tasks per run

### `/mao-plan` — Plan Without Executing

```
/mao-plan refactor the payment module to use repository pattern
```

Produces `.orchestrator/state/task-graph.json` with:
- Task table (ID, description, model, complexity, dependencies, verification command)
- Wave execution plan (which tasks run in parallel)
- Cost profile (model distribution, max parallelism)

Use this when you want to review the plan before committing to execution. Edit the JSON to adjust, then run `/mao` to execute.

### `/mao-resume` — Resume Interrupted Orchestration

```
/mao-resume
```

Reads `.orchestrator/state/task-graph.json` and categorizes tasks:
- **Done** → skip
- **Running** (interrupted) → reset to pending
- **Failed** → ask user: retry / skip / manual
- **Pending** → schedule when deps met
- **Blocked** → wait

Recreates worktrees if needed, validates the DAG, then resumes execution from where it left off.

### `/mao-status` — Check Progress

```
/mao-status
```

Shows: intent, progress (X/Y tasks), task board with status/model/attempts/errors, DAG waves, escalation log.

### `/skills-directory` — Discover Skills

```
/skills-directory
/skills-directory security
/skills-directory testing
```

Browsable index of all skills with one-line purpose summaries and "use when..." guidance.

---

## Skills

Skills are domain-specific knowledge packs. They teach Claude Code how to approach a specific class of problem.

### Development Skills

#### `/mao-tdd` — Test-Driven Development State Machine

Enforces strict RED → GREEN → REFACTOR cycle:

```
RED:      Write a failing test (implementation files are READ-ONLY)
GREEN:    Write minimum code to pass (test files are READ-ONLY)
REFACTOR: Clean up (all tests must stay GREEN)
```

Uses a **context whiteboard** to track state across the cycle. Each transition has a deterministic gate (test runner exit code). Never write implementation and test in the same step.

**Use when:** implementing features, fixing bugs, refactoring code.

#### `/mao-tdd-patterns` — TDD Best Practices

Reference patterns for testing: unit, integration, E2E. Covers mocking strategies, coverage targets (80% minimum), test organization, and common testing mistakes.

**Use when:** you need guidance on how to structure tests, not the TDD workflow itself.

#### `/mao-coding-standards` — Code Quality Standards

TypeScript/React/Node.js conventions: naming, immutability, KISS, DRY, YAGNI, file organization, type safety, performance, and code smell detection.

**Use when:** enforcing consistent code style across a project or team.

#### `/mao-eval-harness` — Eval-Driven Development

Formal evaluation framework treating evals as "unit tests of AI development":

```
/eval define <feature>    # Define eval criteria
/eval check <feature>     # Run evals
/eval report <feature>    # Generate report with pass@k metrics
```

Supports code-based graders, model-based graders, and human graders. Tracks reliability with pass@k (any of k attempts passes) and pass^k (all k attempts pass).

**Use when:** building AI-powered features that need reliability measurement.

### Testing Skills

#### `/mao-verify` — Verification Pipeline

Runs a deterministic quality gate:

```
Build → Type-check → Lint → Test Suite → Security Scan → Diff Review
```

Each step must pass before the next runs. Use as a pre-commit or pre-merge gate.

**Use when:** you want to verify everything passes before merging or deploying.

#### `/mao-e2e` — Playwright E2E Testing

Comprehensive Playwright patterns: Page Object Model, test structure, configuration, flaky test quarantine, artifact management (screenshots/traces/video), CI/CD integration.

**Use when:** writing or maintaining E2E test suites with Playwright.

### Code Quality Skills

#### `/mao-review` — Structured Code Review

Reviews across 5 dimensions, then **fixes issues before presenting**:

| Dimension | Checks |
|-----------|--------|
| **0. Maintainability** | Functions >30 lines, duplication, unnecessary abstractions, naming, dead code, `any` types |
| **1. Security** | Input validation, auth checks, injection, data exposure |
| **2. Performance** | N+1 queries, re-renders, unbounded result sets, blocking I/O |
| **3. Design** | Single responsibility, error handling level, coupling |
| **4. Completeness** | Verification criteria met, edge cases, error paths, tests |

**Fix protocol:**
- **Auto-fix** (MEDIUM/LOW): dead code, naming, duplicate logic, missing error handling
- **Report + fix** (HIGH): function decomposition, pattern inconsistency
- **Block** (CRITICAL): security vulnerabilities, data integrity risks, logic errors

**Verdicts:** `APPROVED` | `APPROVED_WITH_NOTES` | `CHANGES_REQUESTED`

#### `/mao-security` — Static Security Review

Comprehensive checklist run on every PR:

1. Secrets — no hardcoded tokens, keys, or passwords
2. Input validation — all user/external input validated at boundaries
3. SQL injection — parameterized queries only
4. Auth/Authz — protected routes verify authorization
5. XSS — no innerHTML with user input
6. CSRF — tokens on state-changing requests
7. Rate limiting — on auth endpoints and expensive operations
8. Data exposure — no sensitive data in logs or error messages
9. Dependencies — no known vulnerable versions
10. Error messages — no stack traces in production

**Use when:** adding authentication, handling user input, working with secrets, creating API endpoints.

#### `/mao-pentest` — Dynamic Penetration Testing

Autonomous pentesting via Shannon — executes real attacks in Docker containers:

```
/mao-pentest http://staging.example.com my-api
```

**Pipeline:** Pre-Recon → Recon → Analysis → Exploitation → Reporting

Covers 50+ vulnerability types across: Injection, XSS, SSRF, Broken Auth, Broken Authz, Cryptographic Failures, Security Misconfiguration, Vulnerable Components, Logging Failures.

**"No exploit = no report"** — zero false positives.

**Prerequisites:** Docker + `npx skills add unicodeveloper/shannon`

**Use when:** pre-release security validation against staging environment. Costs ~$50/run.

### Architecture Skills

#### `/mao-api-design` — REST API Design Patterns

Conventions for production APIs: resource naming, HTTP methods, status codes, pagination, filtering, sorting, authentication, rate limiting, versioning.

**Use when:** designing new REST APIs or refactoring existing ones for consistency.

#### `/mao-backend` — Backend Architecture Patterns

Server-side patterns for Node.js/Express/Next.js: repository pattern, service layer, middleware, database optimization (N+1 prevention, transactions), caching strategies, error handling, background jobs, logging.

**Use when:** building or refactoring backend services.

### Infrastructure Skills

#### `/mao-worktree` — Parallel Git Isolation

Manages git worktrees for concurrent agent execution:

```
Each agent gets:  .worktrees/T{id}/  →  branch: mao/T{id}
```

**Rules:**
- One agent per worktree, never share
- Merge sequentially in dependency order
- Run tests after each merge
- Max 4-6 concurrent worktrees
- Clean up after completion (even on failure)

**Use when:** running multiple agents on independent tasks simultaneously.

#### `/multi-agent-orchestrator` — Full MAO Reference

The complete reference skill covering all MAO concepts: philosophy, quality levels, agent roster, directory structure, cost targets, and the 7-phase workflow. This is the knowledge base that `/mao` draws from.

---

## Agents

Agents are specialized personas assigned to specific task types. MAO routes tasks to agents based on complexity score.

### Core Orchestration Agents

| Agent | Model | Role |
|-------|-------|------|
| **mao-architect** | opus | Decomposes tasks into DAG, scores complexity, assigns models. Max 15 tasks. Every task must have a runnable `verify` command. |
| **mao-orchestrator** | sonnet | Coordinates execution: validates DAGs, manages worktrees, spawns executors, handles failures, merges results. Max 4 parallel agents. |
| **mao-implementer** | sonnet | Implements medium-to-high complexity tasks (score 4-7) with strict TDD. RED→GREEN→REFACTOR with phase-locked file permissions. |
| **mao-worker** | haiku | Fast executor for mechanical tasks (score 0-3): CRUD, migrations, boilerplate, imports, config. Escalates anything touching auth/crypto/concurrency. |
| **mao-verifier** | haiku | Deterministic quality gate. Runs type-check, tests, lint. Uses exit codes as truth. Never modifies code. |
| **mao-reviewer** | sonnet | 5-dimension code review. Fixes MEDIUM/LOW in-place. Creates correction tasks for CRITICAL/HIGH. Runs `/simplify` as final pass. |
| **mao-reflector** | opus | Meta-analysis after complex runs (8+ tasks). Evaluates intent alignment, identifies model routing optimization patterns. |
| **mao-explorer** | sonnet | Last resort when all retries fail. Spawns 3 parallel instances with genuinely different strategies: conservative, alternative, minimal. |

### Specialist Review Agents

| Agent | Model | Specialty |
|-------|-------|-----------|
| **mao-security-reviewer** | sonnet | OWASP Top 10, secrets detection, dependency auditing, injection patterns. Runs `npm audit` and `eslint-plugin-security`. |
| **mao-database-reviewer** | sonnet | PostgreSQL: EXPLAIN ANALYZE, RLS, N+1 detection, index optimization, cursor pagination, batch inserts. Supabase best practices. |
| **mao-e2e-tester** | sonnet | Playwright E2E with Agent Browser preference. Page Object Model, artifact management, flaky test quarantine. |
| **mao-go-reviewer** | sonnet | Idiomatic Go, concurrency safety (goroutine leaks, race conditions), error wrapping, `go vet` + `staticcheck`. |
| **mao-go-resolver** | sonnet | Go build/vet/staticcheck error resolution. Surgical fixes, never adds `//nolint` without approval. |
| **mao-kotlin-reviewer** | sonnet | Android/KMP/Compose, coroutines (no GlobalScope), clean architecture, lifecycle safety. Reports only, no refactoring. |
| **mao-kotlin-resolver** | sonnet | Gradle/detekt/ktlint build errors, dependency conflicts. Runs `./gradlew build` after each fix. |

### When Agents Are Invoked

Agents are invoked automatically by MAO based on task context:

```
Task complexity 0-3  →  mao-worker (haiku)
Task complexity 4-7  →  mao-implementer (sonnet)
Task complexity 8+   →  mao-implementer (opus)

After implementation  →  mao-verifier
After verification    →  mao-reviewer (if complexity ≥ 4)
After all tasks       →  mao-reflector (if 8+ tasks)

On failure            →  retry → escalate → mao-explorer (3 parallel)

Database changes      →  mao-database-reviewer
Security-sensitive    →  mao-security-reviewer
Go code               →  mao-go-reviewer / mao-go-resolver
Kotlin code           →  mao-kotlin-reviewer / mao-kotlin-resolver
E2E tests             →  mao-e2e-tester
```

---

## Rules

Rules are always-on policies active in every Claude Code session. They enforce constraints without being explicitly invoked.

| Rule | What It Enforces |
|------|-----------------|
| **coding-style** | Immutability (new objects, never mutate). Files 200-400 lines (max 800). Functions <50 lines. No deep nesting >4 levels. Validate user input at boundaries. No hardcoded values. |
| **development-workflow** | Research first (GitHub → docs → Exa → registries). Plan before code. TDD mandatory. Code review after writing. |
| **testing** | 80% coverage minimum. TDD mandatory: RED → GREEN → REFACTOR. All test types (unit, integration, E2E). Fix implementation, not tests. |
| **security** | Pre-commit checklist: no secrets, input validation, SQL injection prevention, XSS prevention, CSRF protection, auth verification, rate limiting. STOP on security issues. |
| **commit-format** | Conventional commits: `type(scope): description`. Max 72 chars. Imperative mood. One logical change per commit. Task ID as scope during MAO runs. |
| **cost-discipline** | **Standard**: Haiku 40-50%, Sonnet 40-45%, Opus 5-15%. **Quality**: Sonnet 40-50%, Opus 50-60%. Max 3-5 Opus invocations (standard). Never Opus for mechanical tasks. |
| **worktree-hygiene** | One agent per worktree. Agents write only to their own branch (`mao/T{id}`). Merge in dependency order. Tests after each merge. Max 4-6 concurrent. Clean up always. |

---

## Hooks

Hooks run automatically at lifecycle events. They enforce quality gates without manual invocation.

| Hook | Trigger | What It Does |
|------|---------|-------------|
| **pre-commit-tdd.sh** | Before `git commit` | Detects test runner (vitest/jest/pytest/cargo/go). Checks staged source files have corresponding tests. Blocks commit if tests missing or failing. Bypass: `MAO_SKIP_TDD=1`. |
| **post-task-review.sh** | After MAO task completes | Reads task-graph.json, finds tasks with `status=done` and `reviewed=false`. Prompts to run `/mao-review`. |
| **pre-merge-verify.sh** | Before merging `mao/*` branch | Runs type-check (tsc), lint (eslint), and tests. Blocks merge if type-check or tests fail. Lint warnings don't block. |

---

## Combination Recipes

### New Feature (standard)

```
claude-primer . --yes            # 1. Prime repo context
/mao-plan <feature>              # 2. Decompose → review task graph
/mao <feature>                   # 3. Execute full workflow
```

MAO internally runs: decompose → execute → verify → review → integrate.

### New Feature (with TDD focus)

```
/mao-tdd                         # 1. Enter TDD state machine
# Write failing test (RED)
/mao-plan <feature>              # 2. Plan the implementation
/mao <feature>                   # 3. Execute (agents follow TDD)
/mao-review                      # 4. Final review pass
```

### Pre-release Security Gate

```
/mao-security                    # 1. Static review (free, seconds)
# Deploy to staging
/mao-pentest http://staging...   # 2. Dynamic proof-of-exploit (~$50)
# Fix confirmed findings
# Tag release
```

### Code Review After Manual Work

```
# After writing code manually...
/mao-review                      # Reviews diff, fixes MEDIUM/LOW, reports CRITICAL/HIGH
/mao-verify                      # Runs full verification pipeline
```

### Complex Parallel Feature

```
/mao-plan build auth + payments + notifications
# Review the DAG, adjust if needed
/mao build auth + payments + notifications
```

MAO produces:
```
Wave 1: auth (opus) ∥ schema migration (haiku)
Wave 2: payments (sonnet) ∥ notifications (haiku)  — after auth
Wave 3: integration tests + review
```

### Legacy Codebase Onboarding

```
claude-primer . --yes            # 1. Deep analysis
mao-orchestrator init            # 2. Install MAO plugin
/mao-review                      # 3. Review existing code quality
/mao refactor <module>           # 4. Targeted improvement
```

### API Design → Implementation

```
/mao-api-design                  # 1. Design REST API (naming, pagination, versioning)
/mao-backend                     # 2. Backend patterns (repository, service, middleware)
/mao-plan implement the API      # 3. Decompose into tasks
/mao implement the API           # 4. Execute with TDD
```

### E2E Testing Suite

```
/mao-e2e                         # 1. Learn Playwright patterns
/mao-plan add E2E tests for auth flow
/mao add E2E tests for auth flow # 2. Execute (uses mao-e2e-tester agent)
```

### Debugging a Failed Orchestration

```
/mao-status                      # 1. See what failed and why
# Fix the issue manually or...
/mao-resume                      # 2. Resume from where it stopped
```

### Full Quality Pipeline

```
/mao-coding-standards            # 1. Load coding conventions
/mao-tdd                         # 2. Enter TDD mode
# Implement with RED → GREEN → REFACTOR
/mao-review                      # 3. 5-dimension review with auto-fix
/mao-verify                      # 4. Full verification pipeline
/mao-security                    # 5. Security checklist
```

---

## Model Routing

MAO assigns models based on complexity scoring:

### Complexity Factors

| Factor | Weight | 0 | 1 | 2 |
|--------|--------|---|---|---|
| `files_touched` | ×1 | 1 file | 2–3 files | 4+ files |
| `new_logic` | ×3 | Copy/move | Adapt existing | New algorithm |
| `security_risk` | ×5 | No sensitive data | Touches auth/data | Auth core / crypto |
| `concurrency` | ×5 | Sequential only | Shared state | Distributed/async |

**Max score: 18**

### Routing Table

| Score | Model | Agent | Typical Tasks |
|-------|-------|-------|--------------|
| 0–3 | haiku | mao-worker | CRUD, migrations, boilerplate, config, imports, type definitions |
| 4–7 | sonnet | mao-implementer | Business logic, service layers, API endpoints, integrations |
| 8+ | opus | mao-implementer | Auth core, crypto, distributed systems, new algorithms |

### Cost Discipline

**Standard mode:**
- Haiku 40-50%, Sonnet 40-45%, Opus 5-15%
- Max 3-5 Opus invocations per run

**Quality mode:**
- Sonnet 40-50%, Opus 50-60%
- Up to 15 Opus invocations

**Never use Opus for:** renaming, imports, test scaffolding, config changes, boilerplate.

---

## Directory Structure

```
.orchestrator/
├── state/
│   ├── task-graph.json        # DAG of tasks with deps, models, verify commands
│   ├── execution-log.json     # Runtime log: status, duration, errors
│   ├── metrics.json           # Cost and performance metrics
│   └── STATE.md               # Human-readable state summary
└── artifacts/
    └── {task_id}/
        ├── review.json        # Code review results
        └── test-results.json  # Verification results

.claude/
├── agents/                    # 15 agent definitions
├── commands/                  # 5 command entry points
├── skills/                    # 14 skill knowledge packs
├── rules/                     # 7 always-on policies
└── hooks/                     # 3 lifecycle hooks

.worktrees/                    # Git worktrees for parallel execution
└── T{id}/                     # One per concurrent task
```

---

## Security Stack

Two complementary layers:

```
Every PR      →  /mao-security (static)     Free, seconds, catches patterns
Pre-release   →  /mao-pentest (Shannon)      ~$50/run, proves exploitability
```

**Gaps to cover separately:**
- Dependency CVEs: `npm audit`, `pip-audit`, `trivy`
- Container images: `trivy image <name>`
- Secrets in git history: `trufflehog`, `gitleaks`
- Infrastructure: `checkov`, `tfsec`

---

## Summary

MAO is a system of **5 commands**, **14 skills**, **15 agents**, **7 rules**, and **3 hooks** that work together to:

1. **Decompose** complex tasks into parallel-safe atomic units
2. **Route** each unit to the cheapest model that can handle it
3. **Execute** in parallel via isolated git worktrees
4. **Verify** with deterministic quality gates
5. **Review** with auto-fix before presenting to the user
6. **Self-correct** through retry, escalation, and exploration
7. **Integrate** safely with dependency-ordered merges

Start with `/mao-plan` to see the plan. Run `/mao` to execute it. Use `/mao-status` and `/mao-resume` to monitor and recover. Layer in `/mao-review`, `/mao-verify`, and `/mao-security` for quality assurance.
