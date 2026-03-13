# Evolution Plan for claude-primer

Reference document for incremental evolution. Ordered by trust: correctness first, architecture second, features third.

**Current version:** 1.3.4
**Test coverage:** 127 Python tests, 110 Node.js tests

---

## Phase 1 — Fix correctness risks ✅

### 1.1 Skip git safety when no overwrite will happen
- **Status:** DONE — PlannedWrite computes write plan before git safety

### 1.2 Clean dry run for missing targets
- **Status:** DONE — missing directory = empty repo preview

### 1.3 Scan before git safety
- **Status:** DONE — scan completes before any git mutation

### 1.4 Selective commit safety
- **Status:** DONE — `git_selective_commit()` uses `--only` flag

### 1.5 Nested git detection
- **Status:** DONE — uses `rev-parse --is-inside-work-tree`

---

## Phase 2 — Explicit pipeline and write plan ✅

### 2.1 PlannedWrite dataclass
- **Status:** DONE — `PlannedWrite(filename, exists, mode, reason)` drives all decisions

### 2.2 Provenance markers
- **Status:** DONE — `migrated`, `inferred`, `placeholder` markers via `_mark()`

---

## Phase 3 — Project tier detection ✅

### 3.1 detect_project_tier()
- **Status:** DONE — returns `{tier, confidence, reasons}`, T1-T4 classification

---

## Phase 4 — CLAUDE.md as repository map ✅

### 4.1-4.3 Section reorder, invariants, active risks
- **Status:** DONE — full restructure with routing rules, architecture, commands, invariants

---

## Phase 5 — STANDARDS.md as governance file ✅

### 5.1-5.2 Governance structure and core principles
- **Status:** DONE — tier-based governance, quality gates, documentation rules

---

## Phase 6 — Confidence-aware extraction ✅

### 6.1 Add confidence to extracted sections
- **Model:** `ScoredValue(value, source, confidence)` dataclass
- **Rule:** Structured existing > strong extracted > stack inference > placeholder
- **Status:** DONE — `ScoredValue` dataclass, confidence scoring in `scan_directory()`, exposed in `--plan-json`, `_prov()` combined marker

### Known issue: extraction idempotency
- Running `--force` repeatedly can accumulate migrated content
- Root cause: extraction re-reads generated sections as "existing content"
- Mitigation: `--force` now produces stable output (fixed in v1.1.0)

---

## Phase 7 — Command extraction quality ✅

### 7.1 Deduplicate and rank commands
- **Status:** DONE — `dedup_and_rank_commands()` orders by lifecycle phase, rejects path-specific commands

---

## Phase 8 — Machine-readable output ✅

### 8.1 --plan-json flag
- **Status:** DONE — `plan_json()` outputs stacks, frameworks, monorepo, tier, write plan

---

## Phase 9 — Monorepo intelligence ✅

### 9.1 Better scoping
- **Status:** DONE — workspace detection, subproject grouping, scoped docs

---

## Phase 10 — Tests ✅

### 10.1 Regression suite
- **Status:** DONE — 127 Python tests across 23 test classes

### 10.2 Golden output tests
- **Status:** DONE — covered in TestGeneratedContent + TestStackDetection

---

## Phase 11 — Template system ✅

### 11.1 User-provided templates
- **Status:** DONE — `.claude-primer/templates/` directory, `--template-dir` flag
- Section-level overrides matched by `## Header` name
- `{{variable}}` substitution: project_name, tech_stack, frameworks, tier, deploy, date, description

---

## Phase 12 — Watch mode ✅

### 12.1 Poll-based file watcher
- **Status:** DONE — `--watch`, `--watch-interval`, `--watch-auto` flags
- Monitors config files (package.json, pyproject.toml, etc.) via `os.stat()` polling
- Diff summary shows stack/framework/sub-project changes
- Graceful Ctrl+C shutdown

---

## Phase 13 — Multi-agent context ✅

### 13.1 Multi-agent output
- **Status:** DONE — `--agent` flag: claude, cursor, copilot, windsurf, aider, codex, all
- `--format` flag: markdown, yaml, json
- Agent-specific output files: `.cursor/rules/project.mdc`, `.github/copilot-instructions.md`, `.windsurfrules`, `.aider/conventions.md`, `AGENTS.md`

---

## Future Phases

---

## Operating Rule

Prefer small defaults, deterministic output, honest inference, conservative migration, tier-based process weight, and explicit safety boundaries. Reject verbosity, fake certainty, heavy defaults, and surprising behavior.

---

**Created:** 2026-03-05
**Updated:** 2026-03-07
