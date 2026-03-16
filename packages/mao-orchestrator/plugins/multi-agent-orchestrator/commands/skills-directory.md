# Skills Directory — Skill Codex

Browse and discover all available MAO skills. Use this when you're unsure which skill to activate for a task.

## Usage

```
/skills-directory
/skills-directory security
/skills-directory testing
```

## All Available Skills

### Orchestration & Workflow

| Skill | Command | Use when... |
|-------|---------|-------------|
| **Multi-Agent Orchestrator** | `/multi-agent-orchestrator` | Running a full MAO workflow — decompose, assign agents, execute, verify, integrate |
| **MAO Plan** | `/mao-plan` | Decomposing a task into a DAG of atomic sub-tasks without executing |
| **MAO Status** | `/mao-status` | Checking progress of a running orchestration |
| **MAO Worktree** | `/mao-worktree` | Managing git worktrees for parallel task isolation |

### Development Practices

| Skill | Command | Use when... |
|-------|---------|-------------|
| **MAO TDD** | `/mao-tdd` | Driving implementation with strict Red-Green-Refactor state machine |
| **MAO TDD Patterns** | `/mao-tdd-patterns` | Learning TDD best practices, mocking strategies, coverage targets |
| **MAO Coding Standards** | `/mao-coding-standards` | Enforcing TypeScript/React/Node.js coding conventions across a task |
| **MAO Eval Harness** | `/mao-eval-harness` | Eval-driven development — define evals before coding, track pass@k metrics |

### Testing

| Skill | Command | Use when... |
|-------|---------|-------------|
| **MAO E2E** | `/mao-e2e` | Writing Playwright E2E tests with Page Object Model, artifact handling, CI integration |
| **MAO Verify** | `/mao-verify` | Running a full verification pipeline: build → type-check → lint → test → security → diff |

### Code Quality & Review

| Skill | Command | Use when... |
|-------|---------|-------------|
| **MAO Review** | `/mao-review` | Peer review of implemented changes — correctness, conventions, security, edge cases |
| **MAO Security** | `/mao-security` | Static security review: secrets, injection, auth, rate limiting, OWASP Top 10 (every PR) |
| **MAO Pentest** | `/mao-pentest` | Dynamic security testing via Shannon — confirms exploitability with real attacks on staging (pre-release) |

### Architecture & Design

| Skill | Command | Use when... |
|-------|---------|-------------|
| **MAO API Design** | `/mao-api-design` | Designing REST APIs: resource naming, pagination, versioning, rate limiting |
| **MAO Backend** | `/mao-backend` | Server-side architecture: repository pattern, service layer, caching, background jobs |

## Quick Lookup by Task

**"I need to write a new feature"**
→ `/mao-plan` → `/mao-tdd` → `/mao-review`

**"I need to secure my code"**
→ `/mao-security` (static review, every PR) + `mao-security-reviewer` agent
→ `/mao-pentest` (dynamic proof-of-exploit, pre-release staging only)

**"I need to design a REST API"**
→ `/mao-api-design`

**"I need to add E2E tests"**
→ `/mao-e2e`

**"I need to verify everything is correct before merging"**
→ `/mao-verify`

**"I need to orchestrate a complex multi-file task"**
→ `/multi-agent-orchestrator` (full MAO workflow)

**"I need backend architecture guidance"**
→ `/mao-backend`

**"I need to enforce coding standards"**
→ `/mao-coding-standards`

## Available Specialist Agents

These agents are invoked automatically by MAO but can also be referenced directly:

| Agent | Specialty |
|-------|-----------|
| `mao-orchestrator` | Orchestrates the full workflow |
| `mao-architect` | Task decomposition and DAG planning |
| `mao-implementer` | Code implementation with TDD pledge |
| `mao-worker` | Focused atomic task execution |
| `mao-verifier` | Post-implementation verification |
| `mao-reviewer` | Code review and quality gate |
| `mao-reflector` | Self-correction and retry logic |
| `mao-explorer` | Explores alternative approaches (last resort) |
| `mao-security-reviewer` | OWASP Top 10, secrets, dependency auditing |
| `mao-database-reviewer` | PostgreSQL optimization, RLS, N+1 detection |
| `mao-e2e-tester` | Playwright E2E with artifact management |
| `mao-go-resolver` | Go build/vet/staticcheck error resolution |
| `mao-go-reviewer` | Idiomatic Go, concurrency, goroutine safety |
| `mao-kotlin-reviewer` | Android/KMP/Compose, coroutines, clean arch |
| `mao-kotlin-resolver` | Gradle/detekt/ktlint build error resolution |
