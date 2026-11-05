$ErrorActionPreference='Stop'
$kentRoot=(Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$kentTools=Get-Content (Join-Path $env:USERPROFILE '.cache/kentyanimda-android/tools.json') -Raw|ConvertFrom-Json
$env:JAVA_HOME=$kentTools.javaHome;$env:ANDROID_HOME=$kentTools.sdkRoot;$env:ANDROID_SDK_ROOT=$kentTools.sdkRoot
$env:PATH="$($kentTools.javaHome)\bin;$env:PATH"
$env:KENT_SIGNING_KEY=Join-Path $env:USERPROFILE '.cache/kentyanimda-android/signing/kent-mobile-preview.keystore'
if(-not(Test-Path -LiteralPath $env:KENT_SIGNING_KEY)){throw 'Stable preview signing key is missing.'}
Push-Location -LiteralPath $kentRoot
try {
 $kentVersion=(Get-Content package.json -Raw|ConvertFrom-Json).version
 & npm.cmd run build;if($LASTEXITCODE -ne 0){throw 'Field UI build failed'}
 & npx.cmd cap sync android;if($LASTEXITCODE -ne 0){throw 'Field Android sync failed'}
 & .\android\gradlew.bat -p android ':app:assembleRelease' --no-daemon --max-workers=2 --console=plain '-Dorg.gradle.jvmargs=-Xmx3072m -XX:MaxMetaspaceSize=768m'
 if($LASTEXITCODE -ne 0){throw 'Field APK build failed'}
 New-Item -ItemType Directory -Force artifacts|Out-Null
 Copy-Item -LiteralPath 'android/app/build/outputs/apk/release/app-release.apk' -Destination "artifacts/KentBag-Saha-Android-$kentVersion.apk"
 $kentApi=(Get-Content ../mobil/production-service.json -Raw|ConvertFrom-Json).apiUrl
 & (Join-Path $PSScriptRoot 'verify-apk.ps1') -ExpectedApiUrl $kentApi
 if($LASTEXITCODE -ne 0){throw 'Field APK verification failed'}
 Get-FileHash -LiteralPath "artifacts/KentBag-Saha-Android-$kentVersion.apk" -Algorithm SHA256
} finally {Pop-Location}
