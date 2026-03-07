# Evolution Plan for `claude_setup.py`

Reference document for incremental evolution. Ordered by trust: correctness first, architecture second, features third.

---

## Phase 1 — Fix correctness risks

### 1.1 Skip git safety when no overwrite will happen
- **Function:** `run()`
- **Rule:** If every target file will be skipped (exists + no `--force`) or created (doesn't exist), skip git prompts entirely
- **Status:** TODO

### 1.2 Clean dry run for missing targets
- **Function:** `run()`
- **Rule:** Missing directory in dry run = empty repo preview, no warnings
- **Status:** Already handled

### 1.3 Scan before git safety
- **Function:** `run()`
- **Rule:** Repository scanning and content extraction must complete before any git mutation
- **Status:** Already correct (scan at ~1434, git safety at ~1450)

### 1.4 Selective commit safety
- **Function:** `git_selective_commit()`
- **Rule:** Must never commit unrelated staged work
- **Status:** Already correct (uses `--only` flag)

### 1.5 Nested git detection
- **Function:** `git_check()`
- **Rule:** Subdirectories inside a git repo must be recognized
- **Status:** Already correct (uses `rev-parse --is-inside-work-tree`)

---

## Phase 2 — Explicit pipeline and write plan

### 2.1 Introduce PlannedWrite
- **New dataclass:** `PlannedWrite(filename, exists, mode, reason)`
- **Rule:** Compute full write plan before generation. Use it for git safety, dry run, and summary
- **Functions:** `run()`

### 2.2 Standardize provenance to 3 markers
- **Markers:** `migrated`, `inferred`, `placeholder`
- **Functions:** All `generate_*` functions, `_mark()`
- **Rule:** Every non-trivial generated section gets exactly one marker

---

## Phase 3 — Project tier detection

### 3.1 Implement detect_project_tier()
- **New function:** Returns `{tier, confidence, reasons}`
- **Logic:** T1 (multi-phase external writes) → T2 (external reads/writes) → T3 (local only) → T4 (docs/reference)
- **Output:** Shown in CLAUDE.md as suggestion with rationale

---

## Phase 4 — CLAUDE.md as repository map

### 4.1 Reorder sections for fast orientation
1. Project identity (name, tier, stack, frameworks)
2. Routing rules
3. Architecture summary (compact)
4. Essential commands
5. Invariants
6. Active risks
7. Formatting standards
8. Pre-task checklist
9. Provenance

### 4.2 Add Invariants section
- 5 durable rules: validate boundaries, no silent errors, prefer dry-run, document decisions, read local CLAUDE.md

### 4.3 Add Active Risks section
- Current fragilities, migrations, operational risks
- Placeholder when nothing detected

---

## Phase 5 — STANDARDS.md as governance file

### 5.1 Restructure around 4 questions
1. What principles govern work here? → Core Principles
2. What process weight applies by tier? → Tiers + Required Gates
3. When is documentation required? → Documentation Relevance Rule
4. How are exceptions recorded? → Exception Rule

### 5.2 Core Principles
- Evidence over opinion
- Parse at the boundary
- Errors carry context
- Idempotency where it matters
- Document decisions that affect future work
- Use the least powerful tool that solves the problem
- Each rule must protect more than it costs

---

## Phase 6 — Confidence-aware extraction

### 6.1 Add confidence to extracted sections
- **Model:** `{value, source, confidence}` where confidence is high/medium/low
- **Rule:** Structured existing > strong extracted > stack inference > placeholder
- **Functions:** `read_existing_content()`, all generators

---

## Phase 7 — Command extraction quality

### 7.1 Deduplicate and rank commands
- Order: setup → run → test → lint → build → migrate → deploy
- Reject path-specific, one-off, branch-specific commands
- **Functions:** `read_existing_content()`, `generate_quickstart_md()`

---

## Phase 8 — Machine-readable output

### 8.1 Add --plan-json flag
- Compute everything, write nothing
- Output: stacks, frameworks, monorepo, tier, write plan, git recommendation
- Derived from same internal plan as dry run
- **Status:** DONE — `plan_json()` function + argparse integration

---

## Phase 9 — Monorepo intelligence

### 9.1 Better scoping
- Identify workspace roots
- Group subprojects by workspace directory
- Root docs stay high level
- Local CLAUDE.md templates behind flag

---

## Phase 10 — Tests

### 10.1 Regression suite
- Dirty repo with doc changes
- Nested repo path
- Dry run on missing target
- Skip vs force behavior
- Existing CLAUDE.md / STANDARDS.md
- Duplicate heading extraction
- **Status:** DONE — `test_claude_setup.py` (45 tests: 44 pass, 1 xfail)

### 10.2 Golden output tests
- Empty repo, Python repo, Node repo, monorepo
- **Status:** DONE — covered in TestGeneratedContent + TestStackDetection classes

### Known issue: extraction idempotency
- Running `--force` repeatedly accumulates migrated content (routing rules, formatting)
- Root cause: extraction re-reads generated sections as "existing content"
- Fix target: Phase 6 (confidence-aware extraction)

---

## Operating Rule

Prefer small defaults, deterministic output, honest inference, conservative migration, tier-based process weight, and explicit safety boundaries. Reject verbosity, fake certainty, heavy defaults, and surprising behavior.

---

**Created:** 2026-03-07
