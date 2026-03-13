#!/usr/bin/env bash
set -euo pipefail

# claude-primer installer
# Usage: curl -fsSL https://raw.githubusercontent.com/limaronaldo/claude-primer/main/install.sh | bash
#
# Environment variables:
#   CLAUDE_PRIMER_HOME      Install directory (default: ~/.local/bin)
#   CLAUDE_PRIMER_VERSION   Specific version (default: latest)
#   CLAUDE_PRIMER_SKIP_CHECKSUM  Set to 1 to skip integrity check

REPO="limaronaldo/claude-primer"
INSTALL_DIR="${CLAUDE_PRIMER_HOME:-$HOME/.local/bin}"
BINARY_NAME="claude-primer"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()  { echo -e "${GREEN}▸${NC} $1"; }
warn()  { echo -e "${YELLOW}▸${NC} $1"; }
error() { echo -e "${RED}✗${NC} $1" >&2; exit 1; }

detect_platform() {
  local os arch
  case "$(uname -s)" in
    Linux*)   os="linux" ;;
    Darwin*)  os="macos" ;;
    MINGW*|CYGWIN*|MSYS*) os="windows" ;;
    *)        error "Unsupported OS: $(uname -s)" ;;
  esac
  case "$(uname -m)" in
    x86_64|amd64)  arch="x86_64" ;;
    arm64|aarch64) arch="arm64" ;;
    *)             error "Unsupported architecture: $(uname -m)" ;;
  esac
  echo "${os}-${arch}"
}

get_latest_version() {
  local url="https://api.github.com/repos/${REPO}/releases/latest"
  local response
  response=$(curl -fsSL --retry 3 --retry-delay 2 "$url" 2>/dev/null) || {
    error "Failed to fetch latest version. Check internet or try: CLAUDE_PRIMER_VERSION=v1.0.0 $0"
  }
  echo "$response" | grep -o '"tag_name":\s*"[^"]*"' | head -1 | grep -o 'v[^"]*' || {
    error "Could not parse version from GitHub API response."
  }
}

verify_checksum() {
  local binary_path="$1" expected_hash="$2"

  if [ "${CLAUDE_PRIMER_SKIP_CHECKSUM:-0}" = "1" ]; then
    warn "Checksum verification skipped (CLAUDE_PRIMER_SKIP_CHECKSUM=1)"
    return 0
  fi

  local actual_hash
  if command -v sha256sum &>/dev/null; then
    actual_hash=$(sha256sum "$binary_path" | cut -d' ' -f1)
  elif command -v shasum &>/dev/null; then
    actual_hash=$(shasum -a 256 "$binary_path" | cut -d' ' -f1)
  else
    warn "No sha256sum or shasum found — skipping checksum verification"
    return 0
  fi

  if [ "$actual_hash" = "$expected_hash" ]; then
    info "Checksum verified: ${actual_hash:0:16}..."
  else
    error "Checksum mismatch!\n  Expected: $expected_hash\n  Got:      $actual_hash\n  The download may be corrupted. Try again or report an issue."
  fi
}

main() {
  echo ""
  echo "  claude-primer installer"
  echo "  Prime your repo for Claude Code"
  echo ""

  local platform version artifact url
  platform=$(detect_platform)
  info "Platform: ${platform}"

  version="${CLAUDE_PRIMER_VERSION:-$(get_latest_version)}"
  info "Version: ${version}"

  artifact="${BINARY_NAME}-${platform}"
  url="https://github.com/${REPO}/releases/download/${version}/${artifact}"

  info "Downloading binary..."
  local tmp_binary
  tmp_binary=$(mktemp)
  curl -fsSL --retry 3 --retry-delay 2 "$url" -o "$tmp_binary" || {
    rm -f "$tmp_binary"
    error "Download failed: $url\nBinary may not exist for ${platform} at version ${version}."
  }

  local checksums_url="https://github.com/${REPO}/releases/download/${version}/checksums-sha256.txt"
  local expected_hash=""
  local tmp_checksums
  tmp_checksums=$(mktemp)

  if curl -fsSL "$checksums_url" -o "$tmp_checksums" 2>/dev/null; then
    expected_hash=$(grep "$artifact" "$tmp_checksums" | cut -d' ' -f1)
    rm -f "$tmp_checksums"
    if [ -n "$expected_hash" ]; then
      verify_checksum "$tmp_binary" "$expected_hash"
    else
      warn "No checksum found for ${artifact} in checksums file"
    fi
  else
    warn "Could not download checksums file — skipping verification"
    rm -f "$tmp_checksums"
  fi

  mkdir -p "$INSTALL_DIR"
  mv "$tmp_binary" "${INSTALL_DIR}/${BINARY_NAME}"
  chmod +x "${INSTALL_DIR}/${BINARY_NAME}"
  info "Installed to ${INSTALL_DIR}/${BINARY_NAME}"

  if ! echo "$PATH" | tr ':' '\n' | grep -qx "$INSTALL_DIR"; then
    warn "${INSTALL_DIR} is not in your PATH"
    echo ""
    echo "  Add to your shell config:"
    echo "    export PATH=\"${INSTALL_DIR}:\$PATH\""
    echo ""
  fi

  if "${INSTALL_DIR}/${BINARY_NAME}" --help &>/dev/null; then
    info "Verified: binary runs correctly"
  else
    warn "Binary installed but --help failed. Check your platform compatibility."
  fi

  echo ""
  info "Run:       claude-primer --help"
  info "Uninstall: rm ${INSTALL_DIR}/${BINARY_NAME}"
  echo ""
}

main "$@"
