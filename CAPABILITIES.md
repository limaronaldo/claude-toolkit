# Claude Toolkit — Capabilities Reference

A monorepo of three Claude Code tools: **claude-primer** primes your repo with context docs, **mao-orchestrator** runs multi-agent workflows, and **claude-toolkit** combines both into a single CLI.

---

## Table of Contents

- [Quick Start](#quick-start)
- [claude-primer](#claude-primer)
- [mao-orchestrator](#mao-orchestrator)
  - [Commands](#commands)
  - [Skills](#skills)
  - [Agents](#agents)
  - [Rules](#rules)
  - [Hooks](#hooks)
- [claude-toolkit (meta-CLI)](#claude-toolkit-meta-cli)
- [Security Stack](#security-stack)
- [Workflow Recipes](#workflow-recipes)

---

## Quick Start

```bash
# Install everything (claude-primer + mao-orchestrator)
npm install -g claude-toolkit

# Or install individually
npm install -g claude-primer
npm install -g mao-orchestrator

# Prime your repo (generates CLAUDE.md, QUICKSTART.md, STANDARDS.md, etc.)
claude-primer .

# Install MAO plugin into current project
mao-orchestrator init

# Run a multi-agent orchestration
/mao build a user authentication system with JWT and refresh tokens
```

---

## claude-primer

**Version**: 1.9.0 | `npm install -g claude-primer` | `pip install claude-primer`

Generates a context-aware knowledge architecture for your repository. Analyzes your stack and writes structured Markdown files that give Claude Code deep project understanding before it writes a single line of code.

### What it generates

| File | Purpose |
|------|---------|
| `CLAUDE.md` | Primary context: stack, architecture, key patterns, Claude-specific guidance |
| `QUICKSTART.md` | Fast onboarding: how to run, test, and deploy the project |
| `STANDARDS.md` | Coding standards, conventions, and review checklist |
| `ERRORS_AND_LESSONS.md` | Known pitfalls, past mistakes, and hard-won lessons |
| `AGENTS.md` | (with `--agent` flag) Agent-specific instructions for Codex, Gemini, etc. |

### CLI Usage

```bash
# Basic — analyze and generate in current directory
claude-primer .

# Auto-accept all prompts (CI-friendly)
claude-primer . --yes

# Skip git status check
claude-primer . --yes --no-git-check

# Force overwrite existing files
claude-primer . --yes --force

# Dry run — show what would be generated without writing
claude-primer . --dry-run

# Output plan as JSON (for scripting)
claude-primer . --plan-json

# Generate agent-specific file (codex, gemini, etc.)
claude-primer . --agent codex

# Quality mode — deeper analysis, more context
claude-primer . --quality

# Check if generated docs are up-to-date (CI gate)
claude-primer --check --no-git-check --yes
```

### Configuration

**`.claude-primer.toml`** — runtime flags:
```toml
[flags]
with_readme = true
git_mode = "standard"   # standard | quality
```

**`.claude-setup.rc`** — project metadata:
```ini
[project]
description = My API service
stacks = node, typescript
frameworks = express, prisma
```

### VS Code Extension

Install from the VS Code marketplace: `limaronaldo.claude-primer`

Adds a **"Prime this repo"** command palette entry. Prompts for `withReadme` and `gitMode`, writes both `.claude-primer.toml` and `.claude-setup.rc`.

### Docker

```bash
docker pull ghcr.io/limaronaldo/claude-primer:latest
docker run --rm -v $(pwd):/repo ghcr.io/limaronaldo/claude-primer:latest /repo --yes
```

### Pre-commit Hook

```yaml
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/limaronaldo/claude-toolkit
    rev: primer-v1.9.0
    hooks:
      - id: claude-primer-check
```

---

## mao-orchestrator

**Version**: 1.3.0 | `npm install -g mao-orchestrator`

Multi-Agent Orchestrator for Claude Code. Installs a plugin that adds commands, agents, skills, hooks, and rules. Decomposes complex tasks into a DAG of atomic subtasks, assigns each to the right model tier (Haiku/Sonnet/Opus), and executes them with parallelism, verification, and self-correction loops.

### CLI Usage

```bash
# Install MAO plugin into current project
mao-orchestrator init
mao-orchestrator init --quality   # quality mode (deeper analysis)

# Uninstall plugin from current project
mao-orchestrator uninstall

# Validate a task graph JSON file
mao-orchestrator validate .orchestrator/state/task-graph.json

# Check installation health
mao-orchestrator doctor

# Show version
mao-orchestrator --version
```

---

## Commands

Installed into `.claude/commands/` by `mao-orchestrator init`. Invoked with `/` prefix in Claude Code.

### `/mao` — Full Orchestration

```
/mao <task description>
```

The complete workflow: decompose → confirm → execute → verify → review → integrate.

**Phases:**
1. **Decompose** — Analyze codebase, break task into atomic subtasks with DAG
2. **Confirm** — Show task table + wave plan, wait for approval
3. **Execute** — Process waves sequentially, tasks within a wave in parallel
4. **Verify** — Run verification command after each task; retry/escalate on failure
5. **Review** — Code review for tasks with complexity ≥ 5
6. **Integrate** — Merge worktree branches in dependency order, run full test suite

**Examples:**
```
/mao add user authentication with JWT and refresh tokens
/mao refactor the payment module to use the repository pattern
/mao migrate the database from MongoDB to PostgreSQL
```

### `/mao-plan` — Task Decomposition Only

```
/mao-plan <task description>
```

Produces a task graph (`task-graph.json`) without executing. Shows:
- Task table with ID, model, complexity score, dependencies, verification command
- Wave execution plan (which tasks run in parallel)
- Cost profile (model distribution, max parallelism)

### `/mao-status` — Check Progress

```
/mao-status
```

Displays current orchestration state from `.orchestrator/state/execution-log.json`: completed tasks, running tasks, failures, retry count.

### `/skills-directory` — Skill Codex

```
/skills-directory
/skills-directory security
/skills-directory testing
```

Browsable index of all available MAO skills with use-case guidance.

---

## Skills

Installed into `.claude/skills/` by `mao-orchestrator init`. Invoked with `/` prefix.

### Orchestration

| Skill | Command | Purpose |
|-------|---------|---------|
| Multi-Agent Orchestrator | `/multi-agent-orchestrator` | Full MAO workflow reference |
| MAO Plan | `/mao-plan` | Task decomposition into DAG |
| MAO Worktree | `/mao-worktree` | Git worktree isolation for parallel tasks |

### Development

| Skill | Command | Purpose |
|-------|---------|---------|
| MAO TDD | `/mao-tdd` | Strict Red-Green-Refactor state machine |
| MAO TDD Patterns | `/mao-tdd-patterns` | TDD best practices, mocking, coverage targets |
| MAO Coding Standards | `/mao-coding-standards` | TypeScript/React/Node.js conventions |
| MAO Eval Harness | `/mao-eval-harness` | Eval-driven development, pass@k metrics |

### Testing

| Skill | Command | Purpose |
|-------|---------|---------|
| MAO E2E | `/mao-e2e` | Playwright E2E, Page Object Model, CI integration |
| MAO Verify | `/mao-verify` | Verification pipeline: build → typecheck → lint → test → security → diff |

### Code Quality

| Skill | Command | Purpose |
|-------|---------|---------|
| MAO Review | `/mao-review` | 5-dimension code review that **fixes issues before presenting** |
| MAO Security | `/mao-security` | Static security checklist (every PR) |
| MAO Pentest | `/mao-pentest` | Dynamic pentesting via Shannon — proves exploits (pre-release) |

### Architecture

| Skill | Command | Purpose |
|-------|---------|---------|
| MAO API Design | `/mao-api-design` | REST API patterns: naming, pagination, versioning, rate limiting |
| MAO Backend | `/mao-backend` | Server-side architecture: repository, service, middleware patterns |

---

## Agents

Installed into `.claude/agents/` by `mao-orchestrator init`. Invoked automatically by the orchestrator or manually by name.

### Core Orchestration Agents

| Agent | Model | Role |
|-------|-------|------|
| `mao-orchestrator` | opus | Runs the full workflow: plan → execute → verify → review → integrate |
| `mao-architect` | opus | Decomposes tasks into DAG, assigns complexity scores and models |
| `mao-implementer` | sonnet | Implements code with TDD pledge (Red-Green-Refactor) |
| `mao-worker` | haiku/sonnet | Executes focused atomic tasks |
| `mao-verifier` | sonnet | Runs verification commands, reports pass/fail |
| `mao-reviewer` | sonnet | 5-dimension code review, **fixes MEDIUM/LOW issues in-place** |
| `mao-reflector` | sonnet | Self-correction: analyzes failures, adjusts approach |
| `mao-explorer` | sonnet | Spawns 3 parallel alternative strategies when blocked (last resort) |

### Specialist Review Agents

| Agent | Specialty |
|-------|-----------|
| `mao-security-reviewer` | OWASP Top 10, secrets detection, dependency auditing, injection patterns |
| `mao-database-reviewer` | PostgreSQL: EXPLAIN ANALYZE, RLS, N+1 detection, index optimization |
| `mao-e2e-tester` | Playwright E2E, artifact management (screenshots/traces), flaky test quarantine |
| `mao-go-reviewer` | Idiomatic Go, concurrency safety, goroutine leak detection, error wrapping |
| `mao-go-resolver` | Go build errors: go vet, staticcheck, golangci-lint, module issues |
| `mao-kotlin-reviewer` | Android/KMP/Compose, coroutines, clean architecture, lifecycle safety |
| `mao-kotlin-resolver` | Gradle/detekt/ktlint build errors, dependency conflicts |

### Complexity Scoring (used by mao-architect)

Complexity factors (0–2 each, max score 18):

| Factor | Weight | 0 | 1 | 2 |
|--------|--------|---|---|---|
| `files_touched` | ×1 | 1 file | 2–3 files | 4+ files |
| `new_logic` | ×3 | Copy/move | Adapt existing | New algorithm |
| `security_risk` | ×5 | No sensitive data | Touches auth/data | Auth core / crypto |
| `concurrency` | ×5 | Sequential only | Shared state | Distributed/async |

Model routing: score < 4 → haiku | 4–7 → sonnet | ≥ 8 → opus

---

## Rules

Installed into `.claude/rules/` — active in every Claude Code session.

| Rule | Enforces |
|------|---------|
| `coding-style` | Immutability, file size limits, error handling, input validation |
| `development-workflow` | Research-first, plan before code, TDD mandatory, commit after verify |
| `git-workflow` / `commit-format` | Conventional commits, PR workflow (full history analysis, diff command) |
| `security` | Pre-commit security checklist: no secrets, validate inputs, auth checks |
| `testing` | 80% coverage minimum, TDD Red-Green-Refactor enforcement |
| `cost-discipline` | Model tier selection, context window management, extended thinking config |
| `worktree-hygiene` | One task per worktree, clean up after merge, no cross-worktree edits |

---

## Hooks

Installed into `.claude/hooks/` — run automatically at workflow lifecycle events.

| Hook | Trigger | Action |
|------|---------|--------|
| `pre-commit-tdd.sh` | Before commit | Verifies tests pass; blocks commit if TDD state machine not GREEN |
| `post-task-review.sh` | After task completes | Triggers `mao-reviewer` agent if task complexity ≥ 5 |
| `pre-merge-verify.sh` | Before merging worktree | Runs full test suite + type-check; blocks merge on failure |

---

## claude-toolkit (meta-CLI)

**Version**: 1.1.0 | `npm install -g claude-toolkit`

Unified CLI combining claude-primer and mao-orchestrator. The single install for getting everything.

```bash
# Initialize a project — runs claude-primer then mao-orchestrator init
claude-toolkit init

# Run doctor — checks health of both tools
claude-toolkit doctor

# Update all installed components
claude-toolkit update

# Pass-through to individual CLIs
claude-toolkit primer [args]   # → claude-primer
claude-toolkit mao [args]      # → mao-orchestrator
```

---

## Security Stack

Two complementary layers that cover static analysis and dynamic proof-of-exploit:

```
Every PR      →  mao-security (static)        Fast, free, catches patterns
Pre-release   →  mao-pentest (Shannon)         ~$50/run, proves exploitability
```

### Static Layer (mao-security + mao-security-reviewer)
- Runs on every PR as part of `mao-review`
- Checks: secrets, injection, auth, XSS, CSRF, rate limiting, dependency CVEs
- Zero cost, runs in seconds

### Dynamic Layer (mao-pentest via Shannon)
- Runs against staging before major releases
- Executes real attacks across 50+ vulnerability types
- "No exploit = no report" — zero false positives
- Prerequisites: Docker + `npx skills add unicodeveloper/shannon`

```bash
/mao-pentest http://staging.example.com my-api
/shannon --scope=injection,xss http://localhost:3000 frontend
```

### Gaps to cover separately
- **Dependency CVEs**: `npm audit`, `pip-audit`, `trivy`
- **Container images**: `trivy image <name>`
- **Secrets in git history**: `trufflehog`, `gitleaks`
- **Infrastructure misconfiguration**: `checkov`, `tfsec`

---

## Workflow Recipes

### New Feature (standard)
```
1. claude-primer . --yes          # Prime repo context
2. /mao-plan <feature>            # Decompose → review task graph
3. /mao <feature>                 # Execute full workflow
```

### Pre-release Security Gate
```
1. /mao-security                  # Static review of all changes
2. Deploy to staging
3. /mao-pentest http://staging... # Prove exploitability
4. Fix confirmed findings
5. Tag release
```

### Legacy Codebase Onboarding
```
1. claude-primer . --quality --yes   # Deep analysis pass
2. mao-orchestrator init             # Install MAO plugin
3. /mao-review                       # Review existing code quality
4. /mao refactor <module>            # Targeted improvement
```

### Incremental TDD
```
1. /mao-tdd                          # Enter TDD state machine
2. Write failing test (RED)
3. /mao-implementer implement <task> # Implement to GREEN
4. /mao-review                       # Refactor pass with review
```

### Complex Parallel Feature
```
1. /mao-plan build auth + payments + notifications
   → Reviews DAG, checks model assignments, adjusts if needed
2. /mao build auth + payments + notifications
   → Wave 1: auth (opus) in parallel with schema migration (haiku)
   → Wave 2: payments (sonnet), notifications (haiku) — after auth done
   → Wave 3: integration tests + review
```

---

## Versioning & Tags

Independent versioning per package with tag-prefixed releases:

| Package | Tag prefix | Registry |
|---------|-----------|---------|
| claude-primer | `primer-v*` | npm + PyPI + GitHub Releases + Docker |
| mao-orchestrator | `mao-v*` | npm + GitHub Releases |
| claude-toolkit | `toolkit-v*` | npm |

Pushing a tag triggers the corresponding release workflow automatically.

```bash
git tag primer-v1.9.0 && git push origin primer-v1.9.0
```
