#Requires -Version 5.1
[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'

$Repo    = 'powdream/invoke-agent'
$BinName = 'invoke-agent'
$BaseUrl = "https://github.com/$Repo/releases/latest/download"

# --- Detect architecture ---
$Arch = $env:PROCESSOR_ARCHITECTURE
switch ($Arch) {
    'AMD64' { $Triple = 'x86_64-pc-windows-msvc' }
    'ARM64' { Write-Error "ARM64 Windows is not yet supported."; exit 1 }
    default { Write-Error "Unsupported architecture: $Arch"; exit 1 }
}

# --- Fetch latest version tag ---
$ApiUrl        = "https://api.github.com/repos/$Repo/releases/latest"
$ReleaseInfo   = Invoke-RestMethod -Uri $ApiUrl -UseBasicParsing
$LatestVersion = $ReleaseInfo.tag_name

if (-not $LatestVersion) {
    Write-Error "Failed to fetch latest version from GitHub."
    exit 1
}

$AssetName   = "$BinName-$LatestVersion-$Triple.zip"
$DownloadUrl = "$BaseUrl/$AssetName"
$ExeName     = "$BinName.exe"

Write-Host "Latest version : $LatestVersion"
Write-Host "Triple         : $Triple"
Write-Host "Asset          : $AssetName"

# --- Determine install destination ---
$ExistingCmd = Get-Command $BinName -ErrorAction SilentlyContinue

if ($ExistingCmd) {
    $Dest = $ExistingCmd.Source
    Write-Host "Existing install found at $Dest. Replacing in place."
} else {
    $InstallDir = Join-Path $env:LOCALAPPDATA 'invoke-agent\bin'
    if (-not (Test-Path $InstallDir)) {
        New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
    }
    $Dest = Join-Path $InstallDir $ExeName
    Write-Host "Installing to $Dest."
}

# --- Download and extract ---
$TmpDir = Join-Path $env:TEMP ([System.IO.Path]::GetRandomFileName())
New-Item -ItemType Directory -Path $TmpDir -Force | Out-Null

try {
    $ZipPath    = Join-Path $TmpDir 'artifact.zip'
    $ExtractDir = Join-Path $TmpDir 'extracted'

    Write-Host "Downloading $DownloadUrl ..."
    Invoke-WebRequest -Uri $DownloadUrl -OutFile $ZipPath -UseBasicParsing

    Write-Host "Extracting ..."
    Expand-Archive -Path $ZipPath -DestinationPath $ExtractDir -Force

    $ExtractedBin = Get-ChildItem -Path $ExtractDir -Recurse -Filter $ExeName |
                    Select-Object -First 1

    if (-not $ExtractedBin) {
        Write-Error "'$ExeName' not found in the downloaded archive."
        exit 1
    }

    Copy-Item -Path $ExtractedBin.FullName -Destination $Dest -Force
    Write-Host "Installed $BinName to $Dest."
} finally {
    Remove-Item -Recurse -Force $TmpDir -ErrorAction SilentlyContinue
}

# --- Update PATH if needed (only when installing fresh) ---
if (-not $ExistingCmd) {
    $InstallDir  = Split-Path $Dest -Parent
    $UserPath    = [Environment]::GetEnvironmentVariable('Path', 'User')
    $PathEntries = $UserPath -split ';' | Where-Object { $_ -ne '' }

    if ($PathEntries -contains $InstallDir) {
        Write-Host "$InstallDir is already in the user PATH."
    } else {
        $NewPath = ($PathEntries + $InstallDir) -join ';'
        [Environment]::SetEnvironmentVariable('Path', $NewPath, 'User')
        Write-Host "Added $InstallDir to the user PATH (effective in new shells)."
        $env:Path = "$env:Path;$InstallDir"
    }
}

# --- Verify ---
Write-Host ""
& $Dest --version
Write-Host "Installation complete."