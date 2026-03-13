# Changelog

All notable changes to MAO will be documented in this file.

## [1.1.0] - 2026-03-08

### Added
- Landing page (GitHub Pages)
- CI/CD pipeline (JSON validation, structure checks, shell linting)
- Release workflow (npm publish + tar.gz assets)
- npm installer CLI (`npx mao-orchestrator init`)
- Bash installer (`curl | bash`)
- PowerShell installer (`irm | iex`)
- GitHub Action for task-graph validation
- `CHANGELOG.md`, `LICENSE`, `CONTRIBUTING.md`

## [1.0.0] - 2026-03-06

### Added
- Initial release: 8 agents, 3 slash commands, 1 skill
- Claude Code slash commands (`/mao`, `/mao-plan`, `/mao-status`)
- 7-phase workflow (Decompose, Schedule, Execute, Verify, Review, Reflect, Integrate)
- Model tiering (Opus/Sonnet/Haiku) with complexity scoring
- Git worktree isolation for parallel execution
- 5-layer self-correction protocol
- `USAGE.md` command usage guide
- `GUIDE.md` Claude Primer integration guide
