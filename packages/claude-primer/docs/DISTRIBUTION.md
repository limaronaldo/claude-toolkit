# Distribution Channels

claude-primer is distributed through 8 channels. Python source is the single source of truth — everything else is a wrapper or binary built from it.

## Channel Matrix

| Channel | Platform | Runtime Required | Auto-updated |
|---------|----------|-----------------|--------------|
| PyPI | All | Python 3.10+ | Manual bump |
| npm | All | Node.js 18+ | Manual bump |
| Homebrew | macOS | Python (via virtualenv) | Manual formula update |
| Standalone binary | Linux, macOS, Windows | None | Via installer or manual download |
| Docker | Linux, macOS | Docker | Via `latest` tag |
| Scoop | Windows | None | Via autoupdate |
| winget | Windows | None | Via wingetcreate |
| GitHub Action | CI/CD | None (runs in Ubuntu) | Via `@v1` tag |

## Release Workflow

Releases are triggered by publishing a GitHub Release with tag `vX.Y.Z`. The `.github/workflows/release.yml` workflow automatically:

1. **Builds 5 binaries** via PyInstaller matrix:
   - `claude-primer-linux-x86_64` (ubuntu-latest)
   - `claude-primer-linux-arm64` (ubuntu-24.04-arm)
   - `claude-primer-macos-arm64` (macos-14)
   - `claude-primer-macos-x86_64` (macos-13)
   - `claude-primer-windows-x86_64.exe` (windows-latest)

2. **Generates `checksums-sha256.txt`** from all binaries

3. **Uploads** all binaries + checksums to the GitHub Release

4. **Publishes to PyPI** via `twine upload`

5. **Publishes to npm** via `npm publish`

6. **Pushes Docker image** to `ghcr.io/limaronaldo/claude-primer` (multi-arch: amd64 + arm64)

### Required Secrets

| Secret | Purpose |
|--------|---------|
| `PYPI_TOKEN` | PyPI API token for publishing |
| `NPM_TOKEN` | npm automation token for publishing |
| `GITHUB_TOKEN` | Built-in, used for ghcr.io Docker push |

### Manual Steps After Release

- Update Homebrew formula SHA256 in `limaronaldo/homebrew-tap`
- Update Scoop manifest SHA256 in `limaronaldo/scoop-bucket`
- Submit winget update via `wingetcreate` (if applicable)

## Installer Scripts

### Linux / macOS (`install.sh`)

```bash
curl -fsSL https://raw.githubusercontent.com/limaronaldo/claude-toolkit/main/packages/claude-primer/install.sh | bash
```

Behavior:
- Detects OS and architecture via `uname`
- Downloads the correct binary from the latest GitHub Release
- Verifies SHA256 checksum against `checksums-sha256.txt`
- Installs to `~/.local/bin` (configurable via `CLAUDE_PRIMER_HOME`)
- Warns if install directory is not in PATH

Environment variables:
- `CLAUDE_PRIMER_HOME` — install directory (default: `~/.local/bin`)
- `CLAUDE_PRIMER_VERSION` — pin to specific version (default: latest)
- `CLAUDE_PRIMER_SKIP_CHECKSUM=1` — skip integrity check

### Windows (`install.ps1`)

```powershell
irm https://raw.githubusercontent.com/limaronaldo/claude-toolkit/main/packages/claude-primer/install.ps1 | iex
```

Behavior:
- Downloads Windows binary from latest GitHub Release
- Verifies SHA256 via `Get-FileHash`
- Installs to `%USERPROFILE%\.local\bin`
- Adds install directory to user PATH

## Docker

```bash
docker run --rm -v "$(pwd):/project" ghcr.io/limaronaldo/claude-primer --yes
```

The image is based on `debian:bookworm-slim` with git and ca-certificates installed. The binary is built via PyInstaller in a multi-stage build.

## Binary Viability (Phase 0 Results)

Validated on 2026-03-07:

| Metric | macOS arm64 | Target |
|--------|-------------|--------|
| Size | 6.8 MB | < 15 MB |
| Startup (warm) | ~1.8s | < 2s |
| Functionality | All files generated | Pass |

## External Repositories

| Repo | Purpose |
|------|---------|
| `limaronaldo/homebrew-tap` | Homebrew formula (`Formula/claude-primer.rb`) |
| `limaronaldo/scoop-bucket` | Scoop manifest (`bucket/claude-primer.json`) |
| `limaronaldo/claude-primer-action` | GitHub Action (composite action with `action.yml`) |
