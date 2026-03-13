# MAO — Multi-Agent Orchestrator installer for Windows
# Usage: irm https://raw.githubusercontent.com/limaronaldo/claude-toolkit/main/packages/mao-orchestrator/install.ps1 | iex

$ErrorActionPreference = "Stop"

function Info($msg)  { Write-Host "  > $msg" -ForegroundColor Green }
function Warn($msg)  { Write-Host "  ! $msg" -ForegroundColor Yellow }
function Err($msg)   { Write-Host "  x $msg" -ForegroundColor Red; exit 1 }

Write-Host ""
Write-Host "  MAO — Multi-Agent Orchestrator"
Write-Host ""

# Check Node.js
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Err "Node.js is required. Install it from https://nodejs.org"
}

$NodeVersion = (node --version) -replace '^v', ''
$Major = [int]($NodeVersion -split '\.')[0]
if ($Major -lt 18) {
    Err "Node.js >= 18 required (found $NodeVersion)"
}
Info "Node.js $NodeVersion"

# Check npm
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Err "npm is required but not found"
}

# Install
Info "Installing mao-orchestrator..."
npm install -g mao-orchestrator
if ($LASTEXITCODE -ne 0) { Err "npm install failed" }

# Verify
try {
    $Version = (mao-orchestrator --version 2>$null)
    Info "Installed mao-orchestrator $Version"
} catch {
    Warn "Installed but could not verify version"
}

# Install globally
Info "Installing MAO agents, commands, and skills..."
mao-orchestrator init --global
if ($LASTEXITCODE -ne 0) { Warn "Init failed — run manually: mao-orchestrator init --global" }

Write-Host ""
Info "Installed! Commands /mao, /mao-plan, /mao-status are now available globally."
Write-Host ""
Info "Update:    npm update -g mao-orchestrator"
Info "Uninstall: mao-orchestrator uninstall; npm uninstall -g mao-orchestrator"
Write-Host ""
