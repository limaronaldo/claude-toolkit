# Contributing to Claude Primer

## Development Setup

```bash
git clone https://github.com/limaronaldo/claude-toolkit.git
cd claude-toolkit/packages/claude-primer
```

### Python

```bash
cd python
pip install pytest
python -m pytest tests/ -v          # run tests (107 tests)
python claude_primer.py --help      # run locally
```

### Node.js

```bash
cd npm
node --test tests/claude_primer.test.mjs    # run tests (110 tests)
node index.mjs --help                       # run locally
```

## Project Structure

```
claude-primer/
├── python/                 # PyPI package — source of truth
│   ├── claude_primer.py    # single-file CLI (~2900 lines, stdlib only)
│   ├── pyproject.toml
│   └── tests/
├── npm/                    # npm package — JavaScript port
│   ├── index.mjs           # single-file ESM CLI (~2900 lines, Node built-ins only)
│   ├── package.json
│   └── tests/
├── build/                  # build infrastructure
│   ├── pyinstaller.spec    # standalone binary spec
│   └── winget/             # winget manifest template
├── .github/workflows/
│   ├── ci.yml              # test matrix (Python 3.10-3.13, Node 18/20/22)
│   └── release.yml         # release pipeline (binaries + PyPI + npm + Docker)
├── Dockerfile              # multi-stage container build
├── install.sh              # Linux/macOS installer
└── install.ps1             # Windows installer
```

## Key Principles

- **Python is the source of truth.** The npm port mirrors the Python implementation. Changes should be made to Python first, then ported to JavaScript.
- **Zero dependencies.** Both implementations use only standard library / built-in modules. Do not add external dependencies.
- **Single file per implementation.** Each package is a single executable file. This keeps distribution simple and the codebase easy to navigate.

## Making Changes

1. Make your change in `python/claude_primer.py`
2. Run Python tests: `cd python && python -m pytest tests/ -v`
3. Port the change to `npm/index.mjs` if applicable
4. Run Node tests: `cd npm && node --test tests/claude_primer.test.mjs`
5. Update `CHANGELOG.md`

## Adding a New Stack or Framework

Detection happens in `scan_directory()` (~line 825 in `claude_primer.py`). To add a new stack:

1. Add file pattern detection in the stack scanning section
2. Add framework detection if applicable
3. Add the stack to `RALPH_TOOLS_BY_STACK` if Ralph integration is relevant
4. Add corresponding tests
5. Port to `index.mjs`

## Adding a New CLI Flag

1. Add to `argparse` in `main()` (~line 2896)
2. Thread through to `run()` (~line 2539)
3. Add RC persistence in `save_rc()` / `load_rc()` if the flag should be remembered
4. Add tests
5. Port to `index.mjs` `parseArgs()` function

## Tests

Both test suites should pass before submitting changes:

```bash
# Python (107 tests)
cd python && python -m pytest tests/ -v

# Node.js (110 tests)
cd npm && node --test tests/claude_primer.test.mjs
```

## Versioning

Version is declared in two places that must stay in sync:
- `python/pyproject.toml` — `version = "X.Y.Z"`
- `npm/package.json` — `"version": "X.Y.Z"`

Releases are triggered by creating a GitHub Release with tag `vX.Y.Z`.

## Code Style

- Python: no formatter enforced, but follow existing patterns (type hints on public functions, dataclasses for structured data)
- JavaScript: ESM modules, no semicolons in existing code — match the style you see
- Both: keep functions focused, prefer flat logic over deep nesting
