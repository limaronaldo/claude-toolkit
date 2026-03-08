# Changelog

All notable changes to claude-primer are documented here.

## [1.8.0] — 2026-03-08

### Added
- **`--check`** — validate if generated docs are up-to-date; exits with code 1 if stale (CI-friendly)
- **`--export`** — bundle generated docs into a tar.gz, zip, or combined markdown file
- **`--from-doc` URL support** — bootstrap from a remote document URL (fetches and parses)
- **Custom output formats** — `--format json` and `--format yaml` emit structured knowledge files
- **Workspace config inheritance** — `.claude-primer.toml` in parent directories applies as defaults to subdirectories
- **GitHub Action v2** — outputs `files-changed` and `plan-json`; `check-only` mode for CI validation
- **Pre-commit hook** — `claude-primer-check` hook for pre-commit framework
- **JetBrains plugin** — stub with Generate, Dry Run, Diff, and Check actions
- **Property-based tests** — 5 randomized test scenarios for core invariants
- **Benchmark script** — measures startup and generation timing across project sizes
- **Community files** — issue templates (bug report + feature request), CONTRIBUTING.md, CODE_OF_CONDUCT.md
- **README badges** — PyPI, npm, GitHub Release, License, Docker

## [1.7.0] — 2026-03-08

### Added
- **`--migrate`** — convert `.claude-setup.rc` (INI) to `.claude-primer.toml` (TOML); preserves project metadata (stacks, frameworks, deploy) in `[project]` section
- **`--init`** — interactively create `.claude-primer.toml` config file; `--yes` mode writes sensible defaults
- **`--update`** — self-update compiled binaries from GitHub releases with SHA256 verification; falls back to package manager advice for source installs
- **VS Code extension** — 5 commands (Generate, Dry Run, Show Diff, Init Config, Plan JSON); auto-resolves binary via PATH/npx/pipx
- **CI linting** — ruff (Python) and eslint (npm) checks on push/PR; pytest-cov with coverage artifact upload
- **Documentation** — new Commands and VS Code Extension guide pages

### Changed
- Author names updated to full legal names across all manifests and licenses

## [1.6.0] — 2026-03-08

### Added
- **`--diff` mode** — show unified diff of what would change without writing files; compare generated content against existing files
- **`.claude-primer.toml` config file** — persist CLI flag defaults in a `[flags]` section; CLI flags always override TOML values
- **npm test parity** — 138 npm tests (up from 110), covering confidence scoring, templates, watch mode, multi-agent output, plugins, telemetry, diff, and TOML config

### Fixed
- Release CI now skips npm/PyPI publish when version already exists (no more false 403 failures on re-runs)

## [1.5.1] — 2026-03-08

### Fixed
- `--watch-auto` no longer loops infinitely on its own generated files (re-snapshots mtimes after `run()`)
- Watch mode now passes `--agent`, `--format`, and `--plugin-dir` through to auto-regeneration
- Telemetry payload now includes real project metadata (stacks, frameworks, tier) instead of empty values
- E2E idempotency test checks for SKIP output instead of hash comparison (CLAUDE.md is self-referential)

## [1.5.0] — 2026-03-07

### Added
- **Plugin system** — `.claude-primer/plugins/` directory for custom generators; plugins receive full scan info and return `{filename, content}`; supports multi-file output; `--plugin-dir` flag for custom locations
- **Opt-in telemetry** — anonymous usage stats when `CLAUDE_PRIMER_TELEMETRY=1`; collects flags, stacks, timing only (no PII); `--telemetry-off` override; best-effort non-blocking POST
- **End-to-end integration tests** — CI job downloads built binaries and runs 6 scenarios: basic generation, --force idempotency, --plan-json shape, --agent codex, --dry-run, plugin system
- **Documentation site** — GitHub Pages at limaronaldo.github.io/claude-primer with guides for getting started, templates, watch mode, multi-agent, plugins, and CLI reference
- Full feature parity between Python and npm CLIs for plugins and telemetry

## [1.4.0] — 2026-03-07

### Added
- **Confidence-aware extraction** — `ScoredValue` dataclass tracks `(value, source, confidence)` for every extracted field; `--plan-json` now includes `confidence_scores`
- **Template system** — `.claude-primer/templates/` directory for section-level overrides with `{{variable}}` substitution; templates survive `--force` runs
- **Watch mode** — `--watch` flag monitors source files and regenerates docs on change; configurable with `--watch-interval` and `--watch-auto`
- **Multi-agent context output** — `--agent` flag generates context files for Cursor (`.cursor/rules/project.mdc`), Copilot (`.github/copilot-instructions.md`), Windsurf (`.windsurfrules`), Aider (`.aider/conventions.md`), and Codex (`AGENTS.md`); supports `--agent all`
- Full feature parity between Python and npm CLIs for all new capabilities

### Fixed
- Intel macOS binary now builds on `macos-15-intel` runner (replaced deprecated `macos-13`)
- Stale `v1.2` version strings replaced with `__version__` constant across Python and npm
- `--force` no longer skips files when only template overrides changed (diff check moved after template merge)
- npm `--plan-json` now includes `confidence_scores` matching Python output

## [1.3.4] — 2026-03-07

### Fixed
- Windows: PyInstaller binary failed with `UnicodeEncodeError` on cp1252 consoles (box-drawing chars)
- Windows: PyInstaller binary failed with `Failed to load Python DLL` due to `strip=True` breaking DLLs
- Docker: multi-arch build failed because PyInstaller can't cross-compile; switched to python:3.12-slim
- macOS: dropped deprecated macos-13 (Intel) runner from CI matrix

### Changed
- Release workflow smoke test uses `$RUNNER_TEMP` instead of `/tmp` for Windows compatibility
- Release workflow sets `PYTHONUTF8=1` for Windows smoke tests

## [1.3.2] — 2026-03-07

### Fixed
- Python sdist build failed when README.md and LICENSE were symlinks pointing outside the package directory
- npm package was missing README.md and LICENSE (not included in `files` whitelist)

### Added
- Platform distribution infrastructure:
  - PyInstaller spec for standalone binary builds
  - GitHub Actions release workflow (5-platform binary matrix + checksums + auto-publish)
  - `install.sh` — curl|bash installer for Linux/macOS with SHA256 verification
  - `install.ps1` — PowerShell installer for Windows with SHA256 verification
  - Multi-stage Dockerfile for container distribution
  - Scoop bucket (`limaronaldo/scoop-bucket`) for Windows package management
  - winget manifest (prepared, pending first binary release)
  - Release template with download table and checklist

## [1.3.1] — 2026-03-07

### Fixed
- PyPI sdist path traversal error caused by `../README.md` references in pyproject.toml

### Changed
- Added PyPI, npm, CI, and License badges to README
- npm binary wrapper to handle `.mjs` extension rejection

## [1.3.0] — 2026-03-07

### Added
- `--from-doc FILE` — bootstrap knowledge architecture from a PRD, spec, or design document
- `--clean-root` — move auxiliary docs (STANDARDS.md, QUICKSTART.md, ERRORS_AND_LESSONS.md) to `.claude/docs/`
- `--git-mode stash|skip` — control git safety behavior without interactive prompts
- Monorepo intelligence — detect workspace roots, group subprojects, scope docs appropriately
- Command deduplication and ranking — extracted commands ordered by lifecycle phase, duplicates removed
- npm port (`npm/index.mjs`) — full JavaScript ESM port, zero dependencies
- GitHub Actions CI workflow for Python (3.10-3.13) and Node.js (18, 20, 22)
- Homebrew tap (`limaronaldo/tap/claude-primer`)
- GitHub Action (`limaronaldo/claude-primer-action@v1`)

### Changed
- Renamed from `superclaudeai` to `claude-primer` across PyPI, npm, GitHub
- Reorganized into monorepo: `python/` for PyPI package, `npm/` for npm package

## [1.2.0] — 2026-03-06

### Added
- `--with-ralph` — generate Ralph integration files (PROMPT.md, AGENT.md symlink, fix_plan.md, .ralphrc, hooks)
- RC persistence — wizard answers saved to `.claude-setup.rc` for subsequent runs
- Dual overwrite modes: `--force` (skip unchanged) and `--force-all` (overwrite everything)
- `--reconfigure` — re-run wizard ignoring saved config
- AUTO-MAINTAINED marker in QUICKSTART.md

## [1.1.0] — 2026-03-06

### Fixed
- Idempotency bug — `--force` now produces stable output on repeated runs
- Extraction no longer re-reads generated sections as "existing content"

### Changed
- Renamed PyPI package from `super-claude` to `superclaudeai`

## [1.0.0] — 2026-03-05

### Added
- Initial release
- Project scanning: language, framework, deploy target, monorepo detection
- Tier classification (T1-T4) based on blast radius
- Content extraction from existing documentation
- Four generated files: CLAUDE.md, STANDARDS.md, QUICKSTART.md, ERRORS_AND_LESSONS.md
- `--with-readme` — optional README.md generation
- `--dry-run` — preview without writing
- `--force` — overwrite existing files
- `--yes` — non-interactive mode
- `--no-git-check` — skip git safety
- `--plan-json` — machine-readable project analysis output
- Git safety: dirty working tree detection, selective commit, stash support
- Interactive wizard for project configuration
- File verification after generation
- 13 supported language stacks, 25+ frameworks
