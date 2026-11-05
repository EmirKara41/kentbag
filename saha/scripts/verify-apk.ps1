param([string]$ExpectedApiUrl)
$ErrorActionPreference='Stop'
$kentRoot=(Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$kentVersion=(Get-Content -LiteralPath (Join-Path $kentRoot 'package.json') -Raw | ConvertFrom-Json).version
$kentApk=Join-Path $kentRoot "artifacts\KentBag-Saha-Android-$kentVersion.apk"
Add-Type -AssemblyName System.IO.Compression.FileSystem
$kentZip=[System.IO.Compression.ZipFile]::OpenRead($kentApk)
try{
  $kentDist=(Resolve-Path (Join-Path $kentRoot 'dist')).Path
  foreach($kentFile in Get-ChildItem -LiteralPath $kentDist -Recurse -File){
    $kentRelative=$kentFile.FullName.Substring($kentDist.Length+1).Replace('\','/')
    $kentEntry=$kentZip.GetEntry('assets/public/'+$kentRelative)
    if(-not $kentEntry){throw "APK missing embedded UI: $kentRelative"}
    $kentStream=$kentEntry.Open();$kentSha=[System.Security.Cryptography.SHA256]::Create()
    try{
      $kentEmbedded=([BitConverter]::ToString($kentSha.ComputeHash($kentStream))).Replace('-','')
      $kentLocal=([BitConverter]::ToString($kentSha.ComputeHash([System.IO.File]::ReadAllBytes($kentFile.FullName)))).Replace('-','')
      if($kentEmbedded -ne $kentLocal){throw "APK contains outdated UI: $kentRelative"}
    }finally{$kentStream.Dispose();$kentSha.Dispose()}
  }
  $kentConfigEntry=$kentZip.GetEntry('assets/capacitor.config.json')
  $kentReader=[System.IO.StreamReader]::new($kentConfigEntry.Open())
  try{$kentConfig=$kentReader.ReadToEnd()|ConvertFrom-Json}finally{$kentReader.Dispose()}
  if($kentConfig.server.url){throw 'APK must not load its interface from an external server'}
  if($kentConfig.appId -ne 'com.kentbag.saha'){throw 'Unexpected Android application ID'}
  if($ExpectedApiUrl){
    $kentFoundApi=$false
    foreach($kentAsset in $kentZip.Entries|Where-Object {$_.FullName -like 'assets/public/assets/*.js'}){
      $kentAssetReader=[System.IO.StreamReader]::new($kentAsset.Open())
      try{$kentAssetText=$kentAssetReader.ReadToEnd()}finally{$kentAssetReader.Dispose()}
      if($kentAssetText.Contains($ExpectedApiUrl)){$kentFoundApi=$true}
    }
    if(-not $kentFoundApi){throw 'APK does not embed the expected API endpoint'}
    if($ExpectedApiUrl.StartsWith('https://') -and $kentConfig.android.allowMixedContent){throw 'Cloud APK must not allow mixed HTTP content'}
    Write-Output "Verified embedded API: $ExpectedApiUrl"
  }
}finally{$kentZip.Dispose()}
$kentTools=Get-Content (Join-Path $env:USERPROFILE '.cache\kentyanimda-android\tools.json') -Raw | ConvertFrom-Json
$env:JAVA_HOME=$kentTools.javaHome
& (Join-Path $kentTools.sdkRoot 'build-tools\36.0.0\apksigner.bat') verify --verbose $kentApk
if($LASTEXITCODE -ne 0){throw 'APK signature verification failed'}
& (Join-Path $kentTools.sdkRoot 'build-tools\36.0.0\aapt.exe') dump badging $kentApk | Select-String 'package:|sdkVersion:|targetSdkVersion:|application-label:|uses-permission:'
if($LASTEXITCODE -ne 0){throw 'APK manifest verification failed'}
Write-Output 'Verified: signed APK, embedded current UI, no hosted interface dependency.'
