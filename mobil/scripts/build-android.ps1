param([switch]$SkipWebBuild, [string]$LanHost)
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
$kentNetworkPath=Join-Path $kentProject 'android\app\src\main\res\xml\kent_network_security.xml'
$kentNetworkDefault=Get-Content -LiteralPath $kentNetworkPath -Raw
$kentVersion=(Get-Content -LiteralPath 'package.json' -Raw | ConvertFrom-Json).version
$kentOldApi=$env:VITE_API_URL; $kentOldPilot=$env:VITE_LAN_PILOT; $kentOldHost=$env:KENT_LAN_HOST
try{
  if($LanHost){
    $kentParsedAddress=$null
    if(-not [Net.IPAddress]::TryParse($LanHost,[ref]$kentParsedAddress)){throw 'Invalid LAN address'}
    $kentOctets=$kentParsedAddress.GetAddressBytes()
    if($kentOctets.Length -ne 4 -or -not ($kentOctets[0] -eq 10 -or ($kentOctets[0] -eq 192 -and $kentOctets[1] -eq 168) -or ($kentOctets[0] -eq 172 -and $kentOctets[1] -ge 16 -and $kentOctets[1] -le 31))){throw 'LAN build requires a private IPv4 address'}
    $env:KENT_LAN_HOST=$kentParsedAddress.ToString(); $env:VITE_API_URL="http://$($env:KENT_LAN_HOST):3000"; $env:VITE_LAN_PILOT='true'
    Set-Content -LiteralPath $kentNetworkPath -Value "<?xml version=`"1.0`" encoding=`"utf-8`"?><network-security-config><base-config cleartextTrafficPermitted=`"false`"/><domain-config cleartextTrafficPermitted=`"true`"><domain includeSubdomains=`"false`">$($env:KENT_LAN_HOST)</domain></domain-config></network-security-config>"
  }else{
    $env:KENT_LAN_HOST=$null; $env:VITE_LAN_PILOT='false'; $env:VITE_API_URL=$env:VITE_PRODUCTION_API_URL
    Set-Content -LiteralPath $kentNetworkPath -Value '<?xml version="1.0" encoding="utf-8"?><network-security-config><base-config cleartextTrafficPermitted="false"/></network-security-config>'
  }
  if(-not $SkipWebBuild){& npm.cmd run build;if($LASTEXITCODE -ne 0){throw 'UI build failed'}}
  & npx.cmd cap sync android
  if($LASTEXITCODE -ne 0){throw 'Android sync failed'}
  & .\android\gradlew.bat -p android ':app:assembleRelease' --no-daemon --max-workers=2 --console=plain '-Dorg.gradle.jvmargs=-Xmx3072m -XX:MaxMetaspaceSize=768m'
  if($LASTEXITCODE -ne 0){throw 'APK build failed'}
  New-Item -ItemType Directory -Force -Path artifacts | Out-Null
  Copy-Item -LiteralPath 'android\app\build\outputs\apk\release\app-release.apk' -Destination "artifacts\KentYanimda-Android-$kentVersion.apk"
  & (Join-Path $PSScriptRoot 'verify-apk.ps1')
  if($LASTEXITCODE -ne 0){throw 'APK verification failed'}
  $kentApkPath=(Resolve-Path -LiteralPath "artifacts\KentYanimda-Android-$kentVersion.apk").Path
  $kentHasher=[System.Security.Cryptography.SHA256]::Create()
  try{[pscustomobject]@{Algorithm='SHA256';Hash=([BitConverter]::ToString($kentHasher.ComputeHash([System.IO.File]::ReadAllBytes($kentApkPath)))).Replace('-','');Path=$kentApkPath}}finally{$kentHasher.Dispose()}
}finally{
  Set-Content -LiteralPath $kentNetworkPath -Value $kentNetworkDefault -NoNewline
  $env:VITE_API_URL=$kentOldApi; $env:VITE_LAN_PILOT=$kentOldPilot; $env:KENT_LAN_HOST=$kentOldHost
  Pop-Location
}
