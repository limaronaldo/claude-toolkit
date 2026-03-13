#!/usr/bin/env bash
set -euo pipefail

# Claude Toolkit installer — installs claude-primer + mao-orchestrator + claude-toolkit
# Usage: curl -fsSL https://raw.githubusercontent.com/limaronaldo/claude-toolkit/main/packages/claude-toolkit/install.sh | bash

echo ""
echo "  Claude Toolkit — Installing..."
echo ""

# Check Node.js
if ! command -v node &>/dev/null; then
  echo "  ✗ Node.js is required (>= 18). Install it from https://nodejs.org"
  exit 1
fi

NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
  echo "  ✗ Node.js >= 18 required (found v$(node -v))"
  exit 1
fi

# Install all three packages
echo "  Installing claude-primer..."
npm install -g claude-primer@latest

echo "  Installing mao-orchestrator..."
npm install -g mao-orchestrator@latest

echo "  Installing claude-toolkit..."
npm install -g claude-toolkit@latest

echo ""
echo "  ✓ Claude Toolkit installed successfully!"
echo ""
echo "  Quick start:"
echo "    cd your-project"
echo "    claude-toolkit init      # Prime + install MAO"
echo "    claude-toolkit doctor    # Verify setup"
echo ""
