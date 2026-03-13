# claude-primer installer for Windows
# Usage: irm https://raw.githubusercontent.com/limaronaldo/claude-primer/main/install.ps1 | iex

$ErrorActionPreference = "Stop"
$Repo = "limaronaldo/claude-primer"
$BinaryName = "claude-primer"
$InstallDir = "$env:USERPROFILE\.local\bin"

function Write-Info($msg)  { Write-Host "  > $msg" -ForegroundColor Green }
function Write-Warn($msg)  { Write-Host "  > $msg" -ForegroundColor Yellow }
function Write-Err($msg)   { Write-Host "  x $msg" -ForegroundColor Red; exit 1 }

Write-Host ""
Write-Host "  claude-primer installer"
Write-Host "  Prime your repo for Claude Code"
Write-Host ""

# Detect architecture
$Arch = if ([Environment]::Is64BitOperatingSystem) { "x86_64" } else { Write-Err "32-bit not supported" }
Write-Info "Platform: windows-$Arch"

# Get latest version
try {
    $Release = Invoke-RestMethod "https://api.github.com/repos/$Repo/releases/latest" -TimeoutSec 10
    $Version = $Release.tag_name
} catch {
    Write-Err "Failed to fetch latest version: $_"
}
Write-Info "Version: $Version"

# Download binary
$Artifact = "$BinaryName-windows-$Arch.exe"
$Url = "https://github.com/$Repo/releases/download/$Version/$Artifact"
$TmpFile = [System.IO.Path]::GetTempFileName() + ".exe"

Write-Info "Downloading..."
try {
    Invoke-WebRequest -Uri $Url -OutFile $TmpFile -UseBasicParsing -TimeoutSec 60
} catch {
    Write-Err "Download failed: $_"
}

# Verify checksum
$ChecksumsUrl = "https://github.com/$Repo/releases/download/$Version/checksums-sha256.txt"
try {
    $Checksums = (Invoke-WebRequest -Uri $ChecksumsUrl -UseBasicParsing -TimeoutSec 10).Content
    $ExpectedHash = ($Checksums -split "`n" | Where-Object { $_ -like "*$Artifact*" } | ForEach-Object { ($_ -split "\s+")[0] })

    if ($ExpectedHash) {
        $ActualHash = (Get-FileHash $TmpFile -Algorithm SHA256).Hash.ToLower()
        if ($ActualHash -eq $ExpectedHash) {
            Write-Info "Checksum verified: $($ActualHash.Substring(0, 16))..."
        } else {
            Remove-Item $TmpFile -Force
            Write-Err "Checksum mismatch!`n  Expected: $ExpectedHash`n  Got:      $ActualHash"
        }
    } else {
        Write-Warn "No checksum found for $Artifact"
    }
} catch {
    Write-Warn "Could not verify checksum: $_"
}

# Install
New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
$Dest = Join-Path $InstallDir "$BinaryName.exe"
Move-Item -Force $TmpFile $Dest
Write-Info "Installed to $Dest"

# Add to PATH
$UserPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($UserPath -notlike "*$InstallDir*") {
    [Environment]::SetEnvironmentVariable("Path", "$InstallDir;$UserPath", "User")
    Write-Info "Added $InstallDir to user PATH"
    Write-Warn "Restart your terminal for PATH changes to take effect"
}

# Verify
try {
    & $Dest --help | Out-Null
    Write-Info "Verified: binary runs correctly"
} catch {
    Write-Warn "Binary installed but --help failed"
}

Write-Host ""
Write-Info "Run:       claude-primer --help"
Write-Info "Uninstall: Remove-Item '$Dest'"
Write-Host ""
