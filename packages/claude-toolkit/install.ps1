# Claude Toolkit installer for Windows
# Usage: irm https://raw.githubusercontent.com/limaronaldo/claude-toolkit/main/packages/claude-toolkit/install.ps1 | iex

Write-Host ""
Write-Host "  Claude Toolkit - Installing..."
Write-Host ""

# Check Node.js
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "  X Node.js is required (>= 18). Install it from https://nodejs.org" -ForegroundColor Red
    exit 1
}

$nodeVersion = (node -v) -replace 'v', '' -split '\.' | Select-Object -First 1
if ([int]$nodeVersion -lt 18) {
    Write-Host "  X Node.js >= 18 required (found v$(node -v))" -ForegroundColor Red
    exit 1
}

# Install all three packages
Write-Host "  Installing claude-primer..."
npm install -g claude-primer@latest

Write-Host "  Installing mao-orchestrator..."
npm install -g mao-orchestrator@latest

Write-Host "  Installing claude-toolkit..."
npm install -g claude-toolkit@latest

Write-Host ""
Write-Host "  V Claude Toolkit installed successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "  Quick start:"
Write-Host "    cd your-project"
Write-Host "    claude-toolkit init      # Prime + install MAO"
Write-Host "    claude-toolkit doctor    # Verify setup"
Write-Host ""
