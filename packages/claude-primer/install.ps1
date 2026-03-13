# claude-primer installer for Windows
# Usage: irm https://raw.githubusercontent.com/limaronaldo/claude-toolkit/main/packages/claude-primer/install.ps1 | iex

$ErrorActionPreference = "Stop"

function Write-Info($msg)  { Write-Host "  > $msg" -ForegroundColor Green }
function Write-Warn($msg)  { Write-Host "  > $msg" -ForegroundColor Yellow }
function Write-Err($msg)   { Write-Host "  x $msg" -ForegroundColor Red; exit 1 }

Write-Host ""
Write-Host "  claude-primer installer"
Write-Host "  Prime your repo for Claude Code"
Write-Host ""

# Check Node.js
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Err "Node.js is required. Install it from https://nodejs.org"
}

$NodeVersion = (node --version) -replace '^v', ''
$Major = [int]($NodeVersion -split '\.')[0]
if ($Major -lt 18) {
    Write-Err "Node.js >= 18 required (found $NodeVersion)"
}
Write-Info "Node.js $NodeVersion"

# Check npm
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Err "npm is required but not found"
}

# Install
Write-Info "Installing claude-primer..."
npm install -g claude-primer
if ($LASTEXITCODE -ne 0) { Write-Err "npm install failed" }

# Verify
try {
    $Version = (claude-primer --version 2>$null)
    Write-Info "Installed claude-primer $Version"
} catch {
    Write-Warn "Installed but could not verify version"
}

Write-Host ""
Write-Info "Run:       claude-primer --help"
Write-Info "Uninstall: npm uninstall -g claude-primer"
Write-Host ""
