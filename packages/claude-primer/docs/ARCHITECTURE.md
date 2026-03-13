# Architecture

## Overview

claude-primer is a CLI tool that scans a project directory and generates knowledge architecture files for Claude Code. It ships as two independent single-file implementations (Python and JavaScript) with identical behavior.

## Source Files

| File | Lines | Purpose |
|------|-------|---------|
| `python/claude_primer.py` | ~2900 | Python CLI — source of truth |
| `npm/index.mjs` | ~2900 | JavaScript port — mirrors Python |

Both implementations use **zero external dependencies** (stdlib/built-ins only).

## Pipeline

```
main() → parse args
  → load_rc()           # load saved wizard answers from .claude-setup.rc
  → scan_directory()    # detect stacks, frameworks, deploy targets, monorepo
  → detect_project_tier()  # classify T1-T4 by blast radius
  → read_existing_content()  # extract from current docs if present
  → extract_from_document()  # --from-doc: parse PRD/spec
  → run_wizard()        # interactive config (skipped with --yes)
  → apply_rc()          # merge RC + wizard answers into info dict
  → run()               # orchestrate generation
    → run_git_safety()  # check dirty state, stash, etc.
    → generate_*()      # produce file contents (4-6 files)
    → write files       # with force/skip logic
    → setup_ralph()     # --with-ralph: Ralph integration files
    → _verify_generated()  # structural verification
    → save_rc()         # persist wizard answers
```

## Key Data Structures

### `info` dict
The central data structure passed through the entire pipeline. Built up incrementally by scanning, extraction, and wizard steps.

Key fields:
- `stacks` — list of detected languages (e.g., `["python", "node"]`)
- `frameworks` — list of detected frameworks (e.g., `["fastapi", "react"]`)
- `deploy_targets` — list of deploy signals (e.g., `["docker", "aws"]`)
- `monorepo` — dict with `is_monorepo`, `manager`, `workspaces`
- `tier` — dict with `tier` (1-4), `confidence`, `reasons`
- `existing` — extracted content from current docs
- `project_name`, `project_desc` — from wizard or inference

### `PlannedWrite` (dataclass)
```python
PlannedWrite(filename, exists, mode, reason)
```
Computed before any file I/O. Modes: `create`, `overwrite`, `skip`.

### `FileAction` (dataclass)
```python
FileAction(filename, action, reason)
```
Records what actually happened after writing.

### `RunResult` (dataclass)
```python
RunResult(actions: list[FileAction])
```
Return value of `run()`.

## Generator Functions

Each `generate_*` function takes the `info` dict and returns a complete markdown string. Content is annotated with provenance markers:

| Marker | Meaning |
|--------|---------|
| `[migrated]` | Came from existing project docs |
| `[inferred]` | Detected from project structure |
| `[placeholder]` | Needs manual input |

### Generated Files

| Function | Output | Purpose |
|----------|--------|---------|
| `generate_claude_md()` | CLAUDE.md | Project map, invariants, decision heuristics |
| `generate_standards_md()` | STANDARDS.md | Governance, code quality gates |
| `generate_quickstart_md()` | QUICKSTART.md | Commands, quick fixes |
| `generate_errors_md()` | ERRORS_AND_LESSONS.md | Mistake catalog |
| `generate_readme_md()` | README.md | Optional project README |
| `generate_ralph_prompt_md()` | .ralph/PROMPT.md | Ralph agent instructions |

## Git Safety

`run_git_safety()` checks the working tree state before writing. Three modes:
- `ask` — interactive prompt if dirty
- `stash` — auto-stash dirty changes
- `skip` — bypass all checks

## RC Persistence

Wizard answers are saved to `.claude-setup.rc` (JSON) so subsequent `--force` runs reuse them. The `load_rc()` → `apply_rc()` → `save_rc()` cycle keeps config stable across regenerations.

## Clean Root Mode

`--clean-root` moves auxiliary docs to `.claude/docs/`:
- `STANDARDS.md` → `.claude/docs/STANDARDS.md`
- `QUICKSTART.md` → `.claude/docs/QUICKSTART.md`
- `ERRORS_AND_LESSONS.md` → `.claude/docs/ERRORS_AND_LESSONS.md`

References within CLAUDE.md are adjusted via `_root_doc_refs()`. Ralph integration paths adjusted via `_ralph_doc_refs()`.

## Testing

| Suite | Location | Count | Runner |
|-------|----------|-------|--------|
| Python | `python/tests/test_claude_primer.py` | 107 | pytest |
| Node.js | `npm/tests/claude_primer.test.mjs` | 110 | node --test |

Test classes cover: stack detection, framework detection, tier detection, monorepo detection, git integration, generated content, Ralph integration, RC persistence, clean-root mode, force/skip behavior, from-doc extraction, command dedup, edge cases, and verification.
