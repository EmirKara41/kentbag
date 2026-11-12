# Builds signed release APKs for the citizen and crew apps against the live API.
# Usage: powershell -File scripts/build-android.ps1 -ApiUrl https://kentbag2-api.vercel.app [-Push on]
param([Parameter(Mandatory = $true)][string]$ApiUrl, [string]$Push = "off")
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$tools = Get-Content (Join-Path $env:USERPROFILE '.cache/kentyanimda-android/tools.json') -Raw | ConvertFrom-Json
$env:JAVA_HOME = $tools.javaHome; $env:ANDROID_HOME = $tools.sdkRoot; $env:ANDROID_SDK_ROOT = $tools.sdkRoot
$env:PATH = "$($tools.javaHome)\bin;$env:PATH"
$env:KENT_SIGNING_KEY = Join-Path $env:USERPROFILE '.cache/kentyanimda-android/signing/kent-mobile-preview.keystore'
if (-not (Test-Path -LiteralPath $env:KENT_SIGNING_KEY)) { throw 'Signing key is missing.' }
$env:VITE_API_URL = $ApiUrl; $env:VITE_PUSH = $Push
New-Item -ItemType Directory -Force (Join-Path $root 'artifacts') | Out-Null
foreach ($app in @(@{ dir = 'citizen'; name = 'KentBag-Vatandas' }, @{ dir = 'crew'; name = 'KentBag-Ekip' })) {
  Push-Location (Join-Path $root $app.dir)
  try {
    $version = (Get-Content package.json -Raw | ConvertFrom-Json).version
    & npm.cmd run build; if ($LASTEXITCODE -ne 0) { throw "$($app.dir) web build failed" }
    & npx.cmd cap sync android; if ($LASTEXITCODE -ne 0) { throw "$($app.dir) sync failed" }
    & .\android\gradlew.bat -p android ':app:assembleRelease' --no-daemon --max-workers=2 --console=plain '-Dorg.gradle.jvmargs=-Xmx3072m'
    if ($LASTEXITCODE -ne 0) { throw "$($app.dir) APK build failed" }
    $target = Join-Path $root "artifacts/$($app.name)-$version.apk"
    Copy-Item -LiteralPath 'android/app/build/outputs/apk/release/app-release.apk' -Destination $target -Force
    Get-FileHash -LiteralPath $target -Algorithm SHA256 | Select-Object Hash, Path | Format-List
  } finally { Pop-Location }
}
