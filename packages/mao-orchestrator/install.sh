#!/usr/bin/env bash
set -euo pipefail

# MAO — Multi-Agent Orchestrator installer
# Usage: curl -fsSL https://raw.githubusercontent.com/limaronaldo/claude-toolkit/main/packages/mao-orchestrator/install.sh | bash

MAO_HOME="${MAO_HOME:-$HOME/.mao}"
REPO="https://github.com/limaronaldo/claude-toolkit.git"
CLAUDE_DIR="${HOME}/.claude"

info()  { printf "  \033[32m✓\033[0m %s\n" "$1"; }
warn()  { printf "  \033[33m!\033[0m %s\n" "$1"; }
error() { printf "  \033[31m✗\033[0m %s\n" "$1"; }

main() {
    echo ""
    echo "  MAO — Multi-Agent Orchestrator"
    echo ""

    # Check git
    if ! command -v git &>/dev/null; then
        error "git is required but not found. Install git first."
        exit 1
    fi

    # Clone or update
    if [ -d "$MAO_HOME/.git" ]; then
        info "Updating existing installation at $MAO_HOME"
        cd "$MAO_HOME" && git pull --ff-only --quiet
    else
        if [ -d "$MAO_HOME" ]; then
            warn "Removing stale $MAO_HOME (not a git repo)"
            rm -rf "$MAO_HOME"
        fi
        info "Cloning MAO to $MAO_HOME"
        git clone --depth 1 --quiet "$REPO" "$MAO_HOME"
    fi

    PLUGIN="$MAO_HOME/plugins/multi-agent-orchestrator"

    # Create directories
    mkdir -p "$CLAUDE_DIR/commands" "$CLAUDE_DIR/agents" "$CLAUDE_DIR/skills"

    # Symlink commands
    for cmd in "$PLUGIN/commands/"*.md; do
        ln -sf "$cmd" "$CLAUDE_DIR/commands/$(basename "$cmd")"
    done
    info "3 commands → $CLAUDE_DIR/commands/"

    # Symlink agents
    for agent in "$PLUGIN/agents/"*.md; do
        ln -sf "$agent" "$CLAUDE_DIR/agents/$(basename "$agent")"
    done
    info "8 agents → $CLAUDE_DIR/agents/"

    # Symlink skill
    ln -sfn "$PLUGIN/skills/multi-agent-orchestrator" "$CLAUDE_DIR/skills/multi-agent-orchestrator"
    info "1 skill → $CLAUDE_DIR/skills/"

    echo ""
    echo "  Installed! Commands /mao, /mao-plan, /mao-status are now available globally."
    echo ""
    echo "  Update:    cd $MAO_HOME && git pull"
    echo "  Uninstall: rm -rf $MAO_HOME && rm ~/.claude/commands/mao*.md ~/.claude/agents/mao-*.md ~/.claude/skills/multi-agent-orchestrator"
    echo ""
}

main
