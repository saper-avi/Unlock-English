$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$Jadx = Get-Command jadx -ErrorAction SilentlyContinue
if (-not $Jadx) { throw "JADX is not installed. Install it from its official project and add it to PATH." }
$Output = Join-Path $Root "recovery/jadx"
if (Test-Path $Output) { throw "recovery/jadx already exists; refusing to overwrite it." }
New-Item -ItemType Directory -Path (Join-Path $Root "recovery") -Force | Out-Null
& $Jadx.Source -d $Output (Join-Path $Root "original/Unlock-English-0.1.0.apk")
if ($LASTEXITCODE -ne 0) { throw "JADX reported errors. Inspect its output before using the result." }
Write-Host "Inspect recovery/jadx. Decompiled output still needs review and build verification."
