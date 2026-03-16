# Contributing to Claude Primer

Thanks for your interest in contributing!

## Development Setup

```bash
# Clone the repo
git clone https://github.com/limaronaldo/claude-toolkit.git
cd claude-toolkit/packages/claude-primer

# Python development
cd python
pip install -e .
pip install pytest pytest-cov ruff

# npm development
cd npm
npm install

# Run tests
python -m pytest tests/ -v          # Python (144 tests)
node --test tests/claude_primer.test.mjs  # npm (138 tests)
```

## Making Changes

1. Fork the repo and create a feature branch
2. Make your changes in both `python/claude_primer.py` and `npm/index.mjs` (feature parity is required)
3. Add tests for new functionality
4. Run `ruff check python/` and ensure no linting errors
5. Run both test suites and ensure all tests pass
6. Submit a pull request

## Code Style

- **Python**: Follows ruff defaults with 120-char line length
- **npm**: ESM modules, no external dependencies
- Both implementations must produce identical output for the same input

## Architecture

- `python/claude_primer.py` — Single-file Python CLI (source of truth)
- `npm/index.mjs` — Single-file Node.js CLI (feature parity)
- `vscode/` — VS Code extension (thin wrapper around CLI)
- `build/` — PyInstaller spec, package manager manifests
- `docs/site/` — GitHub Pages documentation

## Pull Request Guidelines

- Keep PRs focused on a single change
- Include tests for new features
- Update CHANGELOG.md for user-facing changes
- Both Python and npm tests must pass
