param([switch]$SkipWebBuild)
$ErrorActionPreference='Stop'
$kentProject=(Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$kentToolsPath=Join-Path $env:USERPROFILE '.cache\kentyanimda-android\tools.json'
if(-not(Test-Path -LiteralPath $kentToolsPath)){throw 'Android toolchain is missing. See mobil/README.md for setup.'}
$kentTools=Get-Content -LiteralPath $kentToolsPath -Raw | ConvertFrom-Json
$env:JAVA_HOME=$kentTools.javaHome
$env:ANDROID_HOME=$kentTools.sdkRoot
$env:ANDROID_SDK_ROOT=$kentTools.sdkRoot
$env:PATH="$($kentTools.javaHome)\bin;$env:PATH"
$kentSigning=Join-Path $env:USERPROFILE '.cache\kentyanimda-android\signing'
New-Item -ItemType Directory -Force -Path $kentSigning | Out-Null
$env:KENT_SIGNING_KEY=Join-Path $kentSigning 'kent-mobile-preview.keystore'
if(-not(Test-Path -LiteralPath $env:KENT_SIGNING_KEY)){
  & "$env:JAVA_HOME\bin\keytool.exe" -genkeypair -keystore $env:KENT_SIGNING_KEY -storepass android -keypass android -alias kentyanimda-preview -dname 'CN=KentYanimda Internal Preview' -keyalg RSA -keysize 2048 -validity 10000
  if($LASTEXITCODE -ne 0){throw 'Preview signing key creation failed'}
}
Push-Location -LiteralPath $kentProject
try{
  if(-not $SkipWebBuild){& npm.cmd run build;if($LASTEXITCODE -ne 0){throw 'UI build failed'}}
  & npx.cmd cap sync android
  if($LASTEXITCODE -ne 0){throw 'Android sync failed'}
  & .\android\gradlew.bat -p android ':app:assembleRelease' --no-daemon --max-workers=2 --console=plain '-Dorg.gradle.jvmargs=-Xmx3072m -XX:MaxMetaspaceSize=768m'
  if($LASTEXITCODE -ne 0){throw 'APK build failed'}
  New-Item -ItemType Directory -Force -Path artifacts | Out-Null
  Copy-Item -LiteralPath 'android\app\build\outputs\apk\release\app-release.apk' -Destination 'artifacts\KentYanimda-Android-1.1.1.apk'
  & (Join-Path $PSScriptRoot 'verify-apk.ps1')
  if($LASTEXITCODE -ne 0){throw 'APK verification failed'}
  $kentApkPath=(Resolve-Path -LiteralPath 'artifacts\KentYanimda-Android-1.1.1.apk').Path
  $kentHasher=[System.Security.Cryptography.SHA256]::Create()
  try{[pscustomobject]@{Algorithm='SHA256';Hash=([BitConverter]::ToString($kentHasher.ComputeHash([System.IO.File]::ReadAllBytes($kentApkPath)))).Replace('-','');Path=$kentApkPath}}finally{$kentHasher.Dispose()}
}finally{Pop-Location}
