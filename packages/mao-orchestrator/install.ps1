# MAO — Multi-Agent Orchestrator installer for Windows
# Usage: irm https://raw.githubusercontent.com/aiconnai/mao-marketplace/main/install.ps1 | iex

$ErrorActionPreference = "Stop"

$MaoHome = if ($env:MAO_HOME) { $env:MAO_HOME } else { Join-Path $env:USERPROFILE ".mao" }
$Repo = "https://github.com/aiconnai/mao-marketplace.git"
$ClaudeDir = Join-Path $env:USERPROFILE ".claude"

function Info($msg)  { Write-Host "  ✓ $msg" -ForegroundColor Green }
function Warn($msg)  { Write-Host "  ! $msg" -ForegroundColor Yellow }
function Err($msg)   { Write-Host "  ✗ $msg" -ForegroundColor Red }

Write-Host ""
Write-Host "  MAO — Multi-Agent Orchestrator"
Write-Host ""

# Check git
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Err "git is required but not found. Install git first."
    exit 1
}

# Clone or update
if (Test-Path (Join-Path $MaoHome ".git")) {
    Info "Updating existing installation at $MaoHome"
    Push-Location $MaoHome
    git pull --ff-only --quiet
    Pop-Location
} else {
    if (Test-Path $MaoHome) {
        Warn "Removing stale $MaoHome (not a git repo)"
        Remove-Item -Recurse -Force $MaoHome
    }
    Info "Cloning MAO to $MaoHome"
    git clone --depth 1 --quiet $Repo $MaoHome
}

$Plugin = Join-Path $MaoHome "plugins\multi-agent-orchestrator"

# Create directories
$CommandsDir = Join-Path $ClaudeDir "commands"
$AgentsDir = Join-Path $ClaudeDir "agents"
$SkillsDir = Join-Path $ClaudeDir "skills"
New-Item -ItemType Directory -Force -Path $CommandsDir | Out-Null
New-Item -ItemType Directory -Force -Path $AgentsDir | Out-Null
New-Item -ItemType Directory -Force -Path $SkillsDir | Out-Null

# Copy commands
$cmds = Get-ChildItem (Join-Path $Plugin "commands") -Filter "*.md"
foreach ($cmd in $cmds) {
    Copy-Item $cmd.FullName (Join-Path $CommandsDir $cmd.Name) -Force
}
Info "$($cmds.Count) commands → $CommandsDir"

# Copy agents
$agents = Get-ChildItem (Join-Path $Plugin "agents") -Filter "*.md"
foreach ($agent in $agents) {
    Copy-Item $agent.FullName (Join-Path $AgentsDir $agent.Name) -Force
}
Info "$($agents.Count) agents → $AgentsDir"

# Copy skill
$SkillSrc = Join-Path $Plugin "skills\multi-agent-orchestrator"
$SkillDest = Join-Path $SkillsDir "multi-agent-orchestrator"
if (Test-Path $SkillDest) { Remove-Item -Recurse -Force $SkillDest }
Copy-Item -Recurse $SkillSrc $SkillDest
Info "1 skill → $SkillsDir"

Write-Host ""
Write-Host "  Installed! Commands /mao, /mao-plan, /mao-status are now available globally."
Write-Host ""
Write-Host "  Update:    cd $MaoHome; git pull"
Write-Host "  Uninstall: Remove-Item -Recurse $MaoHome; Remove-Item $CommandsDir\mao*.md; Remove-Item $AgentsDir\mao-*.md; Remove-Item -Recurse $SkillDest"
Write-Host ""
