#!/usr/bin/env pwsh
# =====================================================
#  santi.tools — release script
#  usage: .\release.ps1 [version]
#  example: .\release.ps1 0.2.0
#  if no version given, it prompts you
# =====================================================

param(
    [string]$Version
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# ── helpers ───────────────────────────────────────────────────────────────────

function Write-Step([string]$msg) {
    Write-Host ""
    Write-Host "  $msg" -ForegroundColor Magenta
}

function Write-Ok([string]$msg) {
    Write-Host "  ✓ $msg" -ForegroundColor Green
}

function Write-Warn([string]$msg) {
    Write-Host "  ! $msg" -ForegroundColor Yellow
}

function Write-Fail([string]$msg) {
    Write-Host ""
    Write-Host "  ✗ $msg" -ForegroundColor Red
    Write-Host ""
    exit 1
}

function Confirm-Continue([string]$prompt) {
    $ans = Read-Host "  $prompt [y/N]"
    if ($ans -notmatch '^[Yy]$') {
        Write-Host "  aborted." -ForegroundColor Gray
        exit 0
    }
}

# ── banner ────────────────────────────────────────────────────────────────────

Write-Host ""
Write-Host "  ┌─────────────────────────────────┐" -ForegroundColor DarkMagenta
Write-Host "  │       santi.tools release        │" -ForegroundColor Magenta
Write-Host "  └─────────────────────────────────┘" -ForegroundColor DarkMagenta
Write-Host ""

# ── check we're in the right place ───────────────────────────────────────────

if (-not (Test-Path "src-tauri/tauri.conf.json")) {
    Write-Fail "run this script from inside the cobalt-app directory"
}

# ── check dependencies ────────────────────────────────────────────────────────

Write-Step "checking dependencies..."

foreach ($cmd in @("git", "bun")) {
    if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) {
        Write-Fail "$cmd is not installed or not in PATH"
    }
    Write-Ok "$cmd found"
}

# check gh cli (optional but needed for release notes push)
$ghAvailable = $null -ne (Get-Command "gh" -ErrorAction SilentlyContinue)
if (-not $ghAvailable) {
    Write-Warn "gh CLI not found — will push tag only, GitHub Actions will handle the release"
    Write-Warn "install from: https://cli.github.com"
} else {
    Write-Ok "gh CLI found"
}

# ── get current version ───────────────────────────────────────────────────────

$tauriConf = Get-Content "src-tauri/tauri.conf.json" -Raw | ConvertFrom-Json
$currentVersion = $tauriConf.version
Write-Host ""
Write-Host "  current version: " -NoNewline -ForegroundColor Gray
Write-Host $currentVersion -ForegroundColor Cyan

# ── prompt for new version ────────────────────────────────────────────────────

if (-not $Version) {
    Write-Host ""
    $Version = Read-Host "  new version (leave blank to keep $currentVersion)"
    if (-not $Version) { $Version = $currentVersion }
}

# basic semver check
if ($Version -notmatch '^\d+\.\d+\.\d+$') {
    Write-Fail "version must be in format X.Y.Z (e.g. 0.2.0)"
}

Write-Host ""
Write-Host "  releasing: " -NoNewline -ForegroundColor Gray
Write-Host "v$Version" -ForegroundColor Magenta

# ── check git status ──────────────────────────────────────────────────────────

Write-Step "checking git status..."

# first verify it's actually a git repo
$null = git rev-parse --abbrev-ref HEAD 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Fail "not a git repository. run 'git init' first, then commit your files."
}

$branch = git rev-parse --abbrev-ref HEAD
Write-Ok "on branch: $branch"

$gitStatus = git status --porcelain 2>&1
if ($gitStatus) {
    Write-Host ""
    Write-Host "  uncommitted changes:" -ForegroundColor Yellow
    $gitStatus | ForEach-Object { Write-Host "    $_" -ForegroundColor DarkYellow }
    Write-Host ""
    Confirm-Continue "you have uncommitted changes. continue anyway?"
}

# ── parse CHANGELOG.md ────────────────────────────────────────────────────────

Write-Step "reading CHANGELOG.md..."

$changelogPath = "CHANGELOG.md"
$releaseNotes = ""

if (-not (Test-Path $changelogPath)) {
    Write-Warn "CHANGELOG.md not found — release will have no notes"
} else {
    $lines = Get-Content $changelogPath
    $inSection = $false
    $sectionLines = [System.Collections.Generic.List[string]]::new()

    foreach ($line in $lines) {
        # match ## [X.Y.Z] or ## [X.Y.Z] - date
        if ($line -match "^## \[$Version\]") {
            $inSection = $true
            continue
        }
        # stop at the next ## heading
        if ($inSection -and $line -match "^## \[") {
            break
        }
        if ($inSection) {
            $sectionLines.Add($line)
        }
    }

    if ($sectionLines.Count -gt 0) {
        $releaseNotes = ($sectionLines | Where-Object { $_ -ne "" -or $sectionLines.IndexOf($_) -gt 0 }) -join "`n"
        $releaseNotes = $releaseNotes.Trim()
        Write-Ok "found changelog section for v$Version"
        Write-Host ""
        Write-Host "  ── release notes preview ──────────────────" -ForegroundColor DarkGray
        $releaseNotes -split "`n" | Select-Object -First 10 | ForEach-Object {
            Write-Host "  $_" -ForegroundColor Gray
        }
        if (($releaseNotes -split "`n").Count -gt 10) {
            Write-Host "  ... (truncated)" -ForegroundColor DarkGray
        }
        Write-Host "  ───────────────────────────────────────────" -ForegroundColor DarkGray
    } else {
        Write-Warn "no section found for [$Version] in CHANGELOG.md"
        Write-Warn "add a '## [$Version]' section to CHANGELOG.md for release notes"
    }
}

# ── bump versions ─────────────────────────────────────────────────────────────

Write-Step "bumping version to $Version..."

# tauri.conf.json
$tauriRaw = Get-Content "src-tauri/tauri.conf.json" -Raw
$tauriRaw = $tauriRaw -replace '"version"\s*:\s*"[^"]*"', "`"version`": `"$Version`""
Set-Content "src-tauri/tauri.conf.json" $tauriRaw -NoNewline
Write-Ok "src-tauri/tauri.conf.json"

# Cargo.toml — only the [package] version, not dependency versions
$cargoLines = Get-Content "src-tauri/Cargo.toml"
$inPackage = $false
$newCargoLines = foreach ($line in $cargoLines) {
    if ($line -match '^\[package\]') { $inPackage = $true }
    elseif ($line -match '^\[') { $inPackage = $false }

    if ($inPackage -and $line -match '^version\s*=\s*"[^"]*"') {
        "version = `"$Version`""
    } else {
        $line
    }
}
Set-Content "src-tauri/Cargo.toml" $newCargoLines
Write-Ok "src-tauri/Cargo.toml"

# ── confirm before committing ─────────────────────────────────────────────────

Write-Host ""
Confirm-Continue "commit, tag v$Version, and push to GitHub?"

# ── git commit + tag ──────────────────────────────────────────────────────────

Write-Step "committing version bump..."

git add -A

$status = git status --porcelain
if ($status) {
    git commit -m "chore: release v$Version"
    if ($LASTEXITCODE -ne 0) { Write-Fail "git commit failed" }
    Write-Ok "committed"
} else {
    Write-Ok "no new changes to commit"
}

git tag "v$Version"
if ($LASTEXITCODE -ne 0) { Write-Fail "git tag failed — tag may already exist" }
Write-Ok "tagged v$Version"

Write-Step "pushing to origin..."
git push origin $branch
if ($LASTEXITCODE -ne 0) { Write-Fail "git push failed — is the remote set? run: git remote add origin https://github.com/Snowy-NOPING/santi.tools.git" }
git push origin "v$Version"
if ($LASTEXITCODE -ne 0) { Write-Fail "git push tag failed" }
Write-Ok "pushed branch and tag"

# ── optionally build locally ──────────────────────────────────────────────────

$ansBuild = Read-Host "  do you want to build the installer locally right now? [y/N]"
$doLocalBuild = $ansBuild -match '^[Yy]$'

$installerPath = ""
if ($doLocalBuild) {
    Write-Step "building tauri app..."
    bun tauri build
    if ($LASTEXITCODE -ne 0) { Write-Fail "tauri build failed" }

    Write-Step "generating artwork..."
    Add-Type -AssemblyName System.Drawing
    $bmp = New-Object System.Drawing.Bitmap(164, 314)
    $g   = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.Clear([System.Drawing.Color]::FromArgb(10, 10, 10))
    $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        [System.Drawing.Point]::new(0,0), [System.Drawing.Point]::new(164,200),
        [System.Drawing.Color]::FromArgb(90,212,160,255),
        [System.Drawing.Color]::FromArgb(0,10,10,10))
    $g.FillRectangle($brush, 0, 0, 164, 220)
    $f1 = New-Object System.Drawing.Font("Segoe UI", 15, [System.Drawing.FontStyle]::Bold)
    $f2 = New-Object System.Drawing.Font("Segoe UI", 15, [System.Drawing.FontStyle]::Regular)
    $g.DrawString("santi",  $f1, (New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(212,160,255))), 14, 262)
    $g.DrawString(".tools", $f2, (New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(136,136,136))), 68, 262)
    $g.Dispose()
    $bmp.Save("installer/wizard-image.bmp", [System.Drawing.Imaging.ImageFormat]::Bmp)
    $bmp.Dispose()

    $b2 = New-Object System.Drawing.Bitmap(55, 55)
    $g2 = [System.Drawing.Graphics]::FromImage($b2)
    $g2.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g2.Clear([System.Drawing.Color]::FromArgb(10,10,10))
    $br2 = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        [System.Drawing.Point]::new(0,0), [System.Drawing.Point]::new(55,55),
        [System.Drawing.Color]::FromArgb(212,160,255),
        [System.Drawing.Color]::FromArgb(124,92,191))
    $g2.FillEllipse($br2, 4, 4, 47, 47)
    $f3 = New-Object System.Drawing.Font("Segoe UI", 20, [System.Drawing.FontStyle]::Bold)
    $g2.DrawString("s", $f3, (New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(10,10,10))), 12, 10)
    $g2.Dispose()
    $b2.Save("installer/wizard-small.bmp", [System.Drawing.Imaging.ImageFormat]::Bmp)
    $b2.Dispose()
    Write-Ok "artwork generated"

    Write-Step "compiling custom installer..."
    $nsisExe = Get-ChildItem -Recurse "src-tauri\target\release\bundle\nsis" -Filter "*-setup.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $nsisExe) { Write-Fail "could not find tauri NSIS installer" }

    New-Item -ItemType Directory -Force -Path dist | Out-Null
    & "C:\Program Files (x86)\Inno Setup 6\ISCC.exe" "/DAppVersion=$Version" "/DNsisExe=$($nsisExe.FullName)" "/Odist" "/Fsanti.tools-$Version-setup" "installer\installer.iss"
    if ($LASTEXITCODE -ne 0) { Write-Fail "Inno Setup compilation failed" }

    $installerPath = "dist\santi.tools-$Version-setup.exe"
    Write-Ok "built: $installerPath"
}

# ── optionally create GitHub release via gh CLI ───────────────────────────────

if ($ghAvailable -and $releaseNotes) {
    Write-Step "creating GitHub release via gh CLI..."

    $tempFile = [System.IO.Path]::GetTempFileName() + ".md"
    Set-Content $tempFile $releaseNotes

    if ($doLocalBuild) {
        gh release create "v$Version" $installerPath `
            --repo "Snowy-NOPING/santi.tools" `
            --title "santi.tools v$Version" `
            --notes-file $tempFile `
            --draft=false
        Write-Ok "release created and $installerPath uploaded!"
    } else {
        gh release create "v$Version" `
            --repo "Snowy-NOPING/santi.tools" `
            --title "santi.tools v$Version" `
            --notes-file $tempFile `
            --draft
        Write-Ok "draft release created — GitHub Actions will build and attach the installer, then publish it"
    }

    Remove-Item $tempFile
} elseif ($ghAvailable) {
    Write-Step "creating GitHub release via gh CLI..."

    if ($doLocalBuild) {
        gh release create "v$Version" $installerPath `
            --repo "Snowy-NOPING/santi.tools" `
            --title "santi.tools v$Version" `
            --generate-notes `
            --draft=false
        Write-Ok "release created and $installerPath uploaded!"
    } else {
        gh release create "v$Version" `
            --repo "Snowy-NOPING/santi.tools" `
            --title "santi.tools v$Version" `
            --generate-notes `
            --draft
        Write-Ok "draft release created — GitHub Actions will build and attach the installer, then publish it"
    }
} else {
    Write-Host ""
    if ($doLocalBuild) {
        Write-Host "  gh CLI not found. You'll need to manually upload $installerPath to GitHub Releases." -ForegroundColor Yellow
    } else {
        Write-Host "  GitHub Actions will build and publish the release automatically." -ForegroundColor Gray
    }
    Write-Host "  track it at: https://github.com/Snowy-NOPING/santi.tools/actions" -ForegroundColor Cyan
}

# ── done ──────────────────────────────────────────────────────────────────────

Write-Host ""
Write-Host "  ┌─────────────────────────────────────────────────────┐" -ForegroundColor DarkGreen
Write-Host "  │  v$Version released!                                    " -NoNewline -ForegroundColor Green
Write-Host "│" -ForegroundColor DarkGreen
Write-Host "  │  actions: https://github.com/Snowy-NOPING/santi.tools/actions  │" -ForegroundColor DarkGreen
Write-Host "  └─────────────────────────────────────────────────────┘" -ForegroundColor DarkGreen
Write-Host ""
