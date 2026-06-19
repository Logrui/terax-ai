<#
.SYNOPSIS
    Full Windows installer build with Windows 11 top-level context menu support.

.DESCRIPTION
    1. Compiles terax_shell_ext.dll (COM IExplorerCommand handler).
    2. Packs AppxManifest.xml + icons + DLL into a sparse APPX package.
    3. Self-signs the APPX (creates a local cert on first run if needed).
    4. Runs pnpm tauri build, injecting the DLL and APPX as installer resources.

.REQUIREMENTS
    - Rust (stable, x86_64-pc-windows-msvc target)
    - Windows SDK (makeAppx.exe + signtool.exe) from https://developer.microsoft.com/windows/downloads/windows-sdk/
    - pnpm

.NOTES
    The self-signed cert is trusted for the CURRENT USER only. Other machines need
    the cert installed in their TrustedPeople store, or use a commercial Authenticode cert.

    To use a commercial cert instead, set $env:TERAX_SIGN_THUMBPRINT to its SHA1 thumbprint
    before running this script, e.g.:
        $env:TERAX_SIGN_THUMBPRINT = "AABBCCDDEEFF..."
        .\scripts\build-windows.ps1
#>

[CmdletBinding()]
param(
    [string]$Architecture = "x86_64",
    [switch]$SkipSigning,
    [switch]$SkipTauriBuild
)

$ErrorActionPreference = "Stop"
$PSNativeCommandUseErrorActionPreference = $true

$RepoRoot = (Resolve-Path "$PSScriptRoot\..").Path
$Target = "$Architecture-pc-windows-msvc"
$MainTargetDir = "$RepoRoot\src-tauri\target"
$CargoReleaseDir = "$MainTargetDir\$Target\release"
$ShellExtDir = "$RepoRoot\src-tauri\shell_ext"
$ShellExtDist = "$RepoRoot\src-tauri\shell_ext_dist"
$AppxManifest = "$RepoRoot\src-tauri\AppxManifest.xml"

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

function Find-SdkTool([string]$Name) {
    $cmd = Get-Command $Name -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }

    $sdkBin = "${env:ProgramFiles(x86)}\Windows Kits\10\bin"
    if (Test-Path $sdkBin) {
        $found = Get-ChildItem -Path $sdkBin -Recurse -Filter $Name -ErrorAction SilentlyContinue |
            Sort-Object FullName -Descending |
            Select-Object -First 1 -ExpandProperty FullName
        if ($found) { return $found }
    }
    return $null
}

function Require-SdkTool([string]$Name) {
    $path = Find-SdkTool $Name
    if (-not $path) {
        throw "$Name not found. Install the Windows SDK from https://developer.microsoft.com/windows/downloads/windows-sdk/"
    }
    return $path
}

# ---------------------------------------------------------------------------
# Step 1: Compile the COM shell extension DLL
# ---------------------------------------------------------------------------

Write-Host "`n[1/4] Compiling terax_shell_ext.dll ..." -ForegroundColor Cyan

Push-Location $ShellExtDir
try {
    # --target-dir redirects output to src-tauri/target so the DLL lands alongside terax.exe.
    cargo build --release --target $Target --target-dir $MainTargetDir
} finally {
    Pop-Location
}

$dllSrc = "$CargoReleaseDir\terax_shell_ext.dll"
if (-not (Test-Path $dllSrc)) {
    throw "Build succeeded but DLL not found at: $dllSrc"
}
Write-Host "      DLL: $dllSrc"

# ---------------------------------------------------------------------------
# Step 2: Stage files and pack APPX
# ---------------------------------------------------------------------------

Write-Host "`n[2/4] Packing APPX ..." -ForegroundColor Cyan

$makeAppx = Require-SdkTool "makeappx.exe"
Write-Host "      makeappx: $makeAppx"

# Clean and recreate staging dirs.
Remove-Item -Path $ShellExtDist -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path "$ShellExtDist\make_appx\resources" | Out-Null

# Copy manifest and icons into the APPX staging dir.
# Icons are packed inside the APPX; the DLL is external (lives in $INSTDIR).
Copy-Item $AppxManifest "$ShellExtDist\make_appx\AppxManifest.xml" -Force
Copy-Item "$RepoRoot\src-tauri\icons\Square150x150Logo.png" "$ShellExtDist\make_appx\resources\Square150x150Logo.png" -Force
Copy-Item "$RepoRoot\src-tauri\icons\Square44x44Logo.png"  "$ShellExtDist\make_appx\resources\Square44x44Logo.png"  -Force

# The DLL goes to $ShellExtDist root - Tauri installs it to $INSTDIR
# so the NSIS hook and ExternalLocation both resolve to the right path.
Copy-Item $dllSrc "$ShellExtDist\terax_shell_ext.dll" -Force

$appxOut = "$ShellExtDist\terax_shell_ext.appx"
& $makeAppx pack /d "$ShellExtDist\make_appx" /p $appxOut /nv
Write-Host "      APPX: $appxOut"

# ---------------------------------------------------------------------------
# Step 3: Sign the APPX
# ---------------------------------------------------------------------------

if (-not $SkipSigning) {
    Write-Host "`n[3/4] Signing APPX ..." -ForegroundColor Cyan

    $signtool = Find-SdkTool "signtool.exe"
    if (-not $signtool) {
        Write-Warning "signtool.exe not found - APPX will be unsigned. Add-AppxPackage will require Developer Mode."
        Write-Warning "Install the Windows SDK or use -SkipSigning to suppress this warning."
    } else {
        # Use explicit thumbprint if provided, otherwise find or create the self-signed cert.
        $thumbprint = $env:TERAX_SIGN_THUMBPRINT
        if (-not $thumbprint) {
            $cert = Get-ChildItem Cert:\CurrentUser\My |
                Where-Object { $_.Subject -eq "CN=Terax" -and $_.HasPrivateKey } |
                Sort-Object NotBefore -Descending |
                Select-Object -First 1

            if (-not $cert) {
                Write-Host "      Creating self-signed certificate (CN=Terax) ..."
                $cert = New-SelfSignedCertificate `
                    -Subject "CN=Terax" `
                    -CertStoreLocation "Cert:\CurrentUser\My" `
                    -Type CodeSigningCert `
                    -NotAfter (Get-Date).AddYears(10)
            }
            $thumbprint = $cert.Thumbprint

            # Always export cert to shell_ext_dist so the NSIS installer can bundle and
            # trust it on target machines (perMachine mode = admin rights at install time).
            Export-Certificate -Cert $cert -FilePath "$ShellExtDist\terax_cert.cer" -Type CERT | Out-Null
            Write-Host "      Certificate exported to shell_ext_dist\terax_cert.cer"
            Write-Host "      NOTE: Replace with a commercial cert for public distribution."
        }

        Write-Host "      Thumbprint: $thumbprint"
        & $signtool sign /fd SHA256 /sha1 $thumbprint $appxOut
        Write-Host "      APPX signed."
    }
} else {
    Write-Host "`n[3/4] Signing skipped (-SkipSigning)." -ForegroundColor Yellow
}

# ---------------------------------------------------------------------------
# Step 4: Build the Tauri installer
# ---------------------------------------------------------------------------

if (-not $SkipTauriBuild) {
    Write-Host "`n[4/4] Building Tauri installer ..." -ForegroundColor Cyan

    Push-Location $RepoRoot
    try {
        # Merge tauri.windows.conf.json to add the DLL + APPX as installer resources.
        # Exit code 1 is expected when TAURI_SIGNING_PRIVATE_KEY is not set (updater
        # artifact signing warning) — the actual bundles are still produced successfully.
        pnpm tauri build --config "src-tauri/tauri.windows.conf.json"
        if ($LASTEXITCODE -ne 0) {
            $nsis = "$RepoRoot\src-tauri\target\release\bundle\nsis\Terax_0.7.3_x64-setup.exe"
            if (-not (Test-Path $nsis)) {
                throw "pnpm tauri build failed (exit $LASTEXITCODE) and no NSIS bundle was produced."
            }
            Write-Warning "pnpm tauri build exited $LASTEXITCODE (likely missing TAURI_SIGNING_PRIVATE_KEY - updater signing only). Bundles were produced."
        }
    } finally {
        Pop-Location
    }

    $exeOut = "$RepoRoot\src-tauri\target\release\bundle\nsis\Terax_0.7.3_x64-setup.exe"
    $msiOut = "$RepoRoot\src-tauri\target\release\bundle\msi\Terax_0.7.3_x64_en-US.msi"

    # Read version from tauri.conf.json and produce a friendly custom-named copy.
    $version = (Get-Content "$RepoRoot\src-tauri\tauri.conf.json" | ConvertFrom-Json).version
    $exeCustom = "$RepoRoot\src-tauri\target\release\bundle\nsis\Terax_Custom_$version.exe"
    if (Test-Path $exeOut) {
        Copy-Item $exeOut $exeCustom -Force
    }

    Write-Host "`nDone. Installers:" -ForegroundColor Green
    if (Test-Path $exeCustom) { Write-Host "  NSIS: $exeCustom" }
    if (Test-Path $msiOut)    { Write-Host "  MSI:  $msiOut" }
} else {
    Write-Host "`n[4/4] Tauri build skipped (-SkipTauriBuild)." -ForegroundColor Yellow
    Write-Host "Shell ext artifacts ready in: $ShellExtDist"
}
