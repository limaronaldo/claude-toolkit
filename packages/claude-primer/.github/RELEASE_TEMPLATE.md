## Downloads

| Platform | File |
|----------|------|
| Linux x86_64 | `claude-primer-linux-x86_64` |
| Linux ARM64 | `claude-primer-linux-arm64` |
| macOS Apple Silicon | `claude-primer-macos-arm64` |
| macOS Intel | `claude-primer-macos-x86_64` |
| Windows x64 | `claude-primer-windows-x86_64.exe` |

**Integrity:** Verify downloads with `checksums-sha256.txt` attached to this release.

## Install

```bash
# One command (no dependencies)
curl -fsSL https://raw.githubusercontent.com/limaronaldo/claude-toolkit/main/packages/claude-primer/install.sh | bash

# Package managers
pipx run claude-primer          # Python
npx claude-primer               # Node.js
brew install limaronaldo/tap/claude-primer  # macOS
scoop install claude-primer     # Windows

# Docker
docker run --rm -v "$(pwd):/project" ghcr.io/limaronaldo/claude-primer
```

## Release Checklist

- [ ] Version bumped in `python/pyproject.toml` and `npm/package.json`
- [ ] Tag created: `vX.Y.Z`
- [ ] GitHub Release published (triggers CI)
- [ ] Verify: PyPI package published
- [ ] Verify: npm package published
- [ ] Verify: Docker image pushed to ghcr.io
- [ ] Verify: All 5 binaries + checksums attached
- [ ] Update Homebrew formula SHA256
- [ ] Update Scoop manifest SHA256
