# Guide: Using Claude Primer + MAO Together

This guide shows how to set up a project with **Claude Primer** (for AI-ready documentation)
and **MAO** (for multi-agent orchestration) working together.

Claude Primer generates the knowledge architecture that Claude Code needs to understand your
project. MAO uses that understanding to decompose and execute complex tasks with intelligent
model tiering. Together, they create a complete AI-assisted development workflow.

---

## Step 1 — Install Claude Primer

Choose one:

```bash
# PyPI
pip install claude-primer

# npm
npm install -g claude-primer

# Homebrew (macOS/Linux)
brew install limaronaldo/tap/claude-primer

# One-liner (no dependencies)
curl -fsSL https://raw.githubusercontent.com/limaronaldo/claude-toolkit/main/packages/claude-primer/install.sh | bash
```

## Step 2 — Prime Your Project

Navigate to your project root and run:

```bash
claude-primer
```

This scans your codebase and generates four documentation files:

| File | Purpose |
|------|---------|
| `CLAUDE.md` | Project map, invariants, decision heuristics, verification standards |
| `STANDARDS.md` | Governance rules, code quality gates, naming conventions |
| `QUICKSTART.md` | Essential commands and quick fixes |
| `ERRORS_AND_LESSONS.md` | Mistake catalog with rationalization table |

### Useful Flags

```bash
# Preview without writing
claude-primer --dry-run

# Non-interactive mode (accept defaults)
claude-primer --yes

# Force regeneration of all files
claude-primer --force-all

# Show what would change
claude-primer --diff

# Generate from a PRD or spec document
claude-primer --from-doc requirements.md

# Output project analysis as JSON
claude-primer --plan-json
```

### What Claude Primer Detects

- Project tier (T1-T4 based on blast radius)
- Languages and frameworks (13+ languages, 15+ frameworks)
- Build/test/lint commands
- Directory structure and conventions
- Iron Laws (project-specific invariants)
- Decision heuristics for common trade-offs

## Step 3 — Install MAO

### Option A: Plugin Marketplace

Inside a Claude Code session in your project:

```
/plugin marketplace add limaronaldo/claude-toolkit
/plugin install multi-agent-orchestrator@claude-toolkit
```

### Option B: Manual Installation

```bash
# From your project root:
mkdir -p .claude/agents .claude/skills

# Copy agents
cp -r /path/to/claude-toolkit/plugins/multi-agent-orchestrator/agents/*.md .claude/agents/

# Copy skill
cp -r /path/to/claude-toolkit/plugins/multi-agent-orchestrator/skills/multi-agent-orchestrator .claude/skills/

# Add orchestrator state to .gitignore
echo ".orchestrator/" >> .gitignore
```

## Step 4 — Add MAO Guidance to CLAUDE.md

Append the MAO section to the `CLAUDE.md` that Claude Primer generated. You can use the
provided template:

```bash
cat /path/to/claude-toolkit/plugins/multi-agent-orchestrator/skills/multi-agent-orchestrator/templates/CLAUDE-md-snippet.md >> CLAUDE.md
```

Or add manually:

```markdown
## Multi-Agent Orchestration

This project uses the Multi-Agent Orchestrator (MAO) for complex tasks.

### Model Tiering Rules
- NEVER use Opus for: CRUD, boilerplate, formatting, imports, docs
- ALWAYS use Opus for: decomposition, security logic, novel algorithms, reflection
- DEFAULT to Haiku for: migrations, config, type definitions, simple tests
- DEFAULT to Sonnet for: feature implementation, refactoring, code review

### Cost Discipline
- Haiku first, Sonnet if needed, Opus only when justified
- Max 5 Opus invocations per orchestration run
- Escalation budget: 3 per run

### Verification Pipeline
Every task must pass before merge:
1. Type check
2. Tests
3. Lint
4. Format
```

Edit the **Stack Reference** section to match your project's actual tech stack.

## Step 5 — Start a Session

```bash
claude --model opusplan
```

This uses Opus for planning and Sonnet for execution — matching MAO's philosophy.

---

## Workflow: Primer + MAO in Practice

### Initial Setup (once per project)

```
1. claude-primer              # Generate CLAUDE.md, STANDARDS.md, etc.
2. Install MAO                # Plugin or manual
3. Append MAO snippet         # Add to CLAUDE.md
4. claude --model opusplan    # Start session
```

### Daily Development

```
1. Describe your task in Claude Code
2. MAO auto-activates for complex tasks (3+ files)
3. Architect decomposes using context from CLAUDE.md
4. Tasks execute in parallel worktrees
5. Verification pipeline runs (using commands from QUICKSTART.md)
6. Code review + merge
```

### Keeping Docs Current

```bash
# After significant changes, regenerate primer docs
claude-primer --force-all

# Check if docs are up-to-date (useful in CI)
claude-primer --check
```

---

## How They Complement Each Other

```
┌─────────────────────────────────────────────────────────────┐
│                     Your Project                            │
│                                                             │
│  ┌──────────────────────┐    ┌───────────────────────────┐  │
│  │   Claude Primer      │    │   MAO                     │  │
│  │                      │    │                           │  │
│  │  Generates:          │───▶│  Uses:                    │  │
│  │  • CLAUDE.md         │    │  • Project context        │  │
│  │  • STANDARDS.md      │    │  • Build/test commands    │  │
│  │  • QUICKSTART.md     │    │  • Code conventions       │  │
│  │  • ERRORS_AND_       │    │  • Known pitfalls         │  │
│  │    LESSONS.md        │    │  • Quality gates          │  │
│  │                      │    │                           │  │
│  │  Provides:           │    │  Provides:                │  │
│  │  • What the project  │    │  • How to execute complex │  │
│  │    IS                │    │    tasks efficiently      │  │
│  │  • Rules & standards │    │  • Parallel execution     │  │
│  │  • Quick commands    │    │  • Cost optimization      │  │
│  │  • Past mistakes     │    │  • Self-correction        │  │
│  └──────────────────────┘    └───────────────────────────┘  │
│                                                             │
│  Claude Primer = KNOWLEDGE    MAO = EXECUTION               │
└─────────────────────────────────────────────────────────────┘
```

**Claude Primer** answers: *"What is this project, what are its rules, and what went wrong before?"*

**MAO** answers: *"How do I break this task apart, who does what, and how do I verify quality?"*

### Specific Synergies

| Primer Output | How MAO Uses It |
|---------------|----------------|
| `CLAUDE.md` project map | Architect uses it to understand codebase structure during decomposition |
| `STANDARDS.md` quality gates | Verifier uses coding standards in the verification pipeline |
| `QUICKSTART.md` commands | Verifier/Worker use build/test/lint commands directly |
| `ERRORS_AND_LESSONS.md` | Architect avoids known pitfalls when designing task DAGs |
| Iron Laws | All agents respect project invariants during execution |
| Decision Heuristics | Architect uses them to make trade-off decisions in decomposition |

---

## Example: Full Workflow

### 1. Prime the project

```bash
cd my-app
claude-primer --yes
```

Output:
```
✓ Detected: TypeScript + Next.js + PostgreSQL (Tier 2)
✓ Generated CLAUDE.md (project map, 12 iron laws, 8 heuristics)
✓ Generated STANDARDS.md (ESLint + Prettier + strict TypeScript)
✓ Generated QUICKSTART.md (npm run dev, npm test, npm run lint)
✓ Generated ERRORS_AND_LESSONS.md (empty — fresh project)
```

### 2. Install MAO and start Claude Code

```bash
# In Claude Code session:
/plugin marketplace add limaronaldo/claude-toolkit
/plugin install multi-agent-orchestrator@claude-toolkit
```

### 3. Give a complex task

```
> Implement a complete user authentication system with:
  - Email/password registration with validation
  - JWT tokens with refresh token rotation
  - Rate limiting and brute-force protection
  - Password reset flow with email
  - Role-based access control middleware
```

### 4. MAO takes over

```
Phase 1 — Architect (Opus) reads CLAUDE.md, decomposes into 8 tasks:
  T1: Database schema for users/roles/tokens (Haiku, score: 2)
  T2: Auth service with bcrypt + JWT (Sonnet, score: 7)
  T3: Rate limiting middleware (Sonnet, score: 5)
  T4: Registration endpoint + validation (Sonnet, score: 4)
  T5: Login/logout endpoints (Sonnet, score: 4)
  T6: Refresh token rotation (Sonnet, score: 6)
  T7: Password reset + email (Sonnet, score: 5)
  T8: RBAC middleware (Sonnet, score: 7)

Phase 2 — Orchestrator sets up 4 worktrees (T1 first, then T2-T5 parallel)

Phase 3 — Workers/Implementers execute in parallel worktrees

Phase 4 — Verifier runs: tsc --noEmit → npm test → eslint → prettier
          (commands from QUICKSTART.md)

Phase 5 — Reviewer checks security patterns against STANDARDS.md

Phase 7 — Merge worktrees in order: T1 → T2 → T3 → T4 → T5 → T6 → T7 → T8
```

---

## CI Integration

Both tools support CI pipelines:

```yaml
# .github/workflows/primer-check.yml
name: Primer Check
on: [push, pull_request]
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: limaronaldo/claude-primer-action@v1
        with:
          mode: check
```

---

## Tips

1. **Run Primer first, MAO second** — MAO benefits from the context Primer generates
2. **Re-run Primer after major changes** — Keep `CLAUDE.md` current so MAO has accurate context
3. **Use `--check` in CI** — Catch stale documentation before it confuses MAO
4. **Use `opusplan` mode** — Best balance of planning quality and execution cost
5. **Start small** — Test MAO with a 3-5 task decomposition before tackling 10+ task projects
6. **Update ERRORS_AND_LESSONS.md** — When MAO makes mistakes, document them so future runs avoid them

---

## Links

- **Claude Primer**: https://github.com/limaronaldo/claude-toolkit/tree/main/packages/claude-primer
- **MAO Marketplace**: https://github.com/limaronaldo/claude-toolkit
