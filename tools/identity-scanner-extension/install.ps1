param(
  [Parameter(Mandatory = $true)]
  [string] $AppOrigin
)

$ErrorActionPreference = "Stop"
$ExtensionSource = $PSScriptRoot
$NativeHostSource = Join-Path $ExtensionSource "native_host.py"
$ProcessorSource = Join-Path (Split-Path $PSScriptRoot -Parent) "identity_barcode_processor.py"
$InstallRoot = Join-Path $env:LOCALAPPDATA "LordRadius\IdentityCapture"
$ExtensionInstall = Join-Path $InstallRoot "extension"
$HostExe = Join-Path $InstallRoot "RadiusLordIdentityHost.exe"
$HostName = "com.radiuslord.identity_capture"
$PublicKey = "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA5s5NMjiR+m9cKj2/sUNs1xtotnSSbenHc6C/bJ085lqAwp1lTWENzyyoQdZ8y8IdB6Cd5LsJ0maCBx9VmcSwlPbMteCpj0UK0u7NdOYQb8UqFbHWd9YEmYtDWKwktSvJ2jgnEoZizVc5XHzIH1BXcCGcqP5H+DnexyNZBwh/qhzJgcMf4TPSv53adyfmcbx36wMR1c6XJwbzi/6a5KYiGqMzpuQP1GImRYvHF5i7YT0V1L4S8+SGVQJe/rgqBtvSgoujuw39LiXt95dfzjh/vx1yiXJhAK9tPDPPFCByH9ARXgLt0+s7BV1HFctq5+X49B+Dx8MhQqX0/kBGlZdVswIDAQAB"

try { $origin = [Uri]::new($AppOrigin) } catch { throw "اكتب عنوان الموقع كاملًا، مثل https://radius.example.com" }
if ($origin.Scheme -notin @("https", "http") -or $origin.AbsolutePath -ne "/" -or $origin.Query -or $origin.Fragment) {
  throw "يجب أن يكون AppOrigin عنوان أصل الموقع فقط، مثل https://radius.example.com"
}
if ($origin.Scheme -eq "http" -and $origin.Host -notin @("localhost", "127.0.0.1")) {
  throw "يسمح HTTP للتجربة المحلية فقط؛ استخدم HTTPS للموقع المنشور."
}

$python = Get-Command python -ErrorAction SilentlyContinue
if (-not $python) { throw "ثبّت Python 3 أولًا ثم أعد تشغيل هذا الأمر." }

New-Item -ItemType Directory -Path $InstallRoot -Force | Out-Null
New-Item -ItemType Directory -Path $ExtensionInstall -Force | Out-Null
Copy-Item (Join-Path $ExtensionSource "manifest.json") $ExtensionInstall -Force
Copy-Item (Join-Path $ExtensionSource "background.js") $ExtensionInstall -Force
Copy-Item (Join-Path $ExtensionSource "content.js") $ExtensionInstall -Force
Copy-Item (Join-Path $ExtensionSource "config.js") $ExtensionInstall -Force
Copy-Item $NativeHostSource (Join-Path $InstallRoot "native_host.py") -Force
Copy-Item $ProcessorSource (Join-Path $InstallRoot "identity_barcode_processor.py") -Force

$manifestPath = Join-Path $ExtensionInstall "manifest.json"
$manifest = Get-Content $manifestPath -Raw | ConvertFrom-Json
$matchPattern = "$($origin.Scheme)://$($origin.Host)/*"
$manifest.content_scripts[0].matches = @($matchPattern)
$utf8NoBom = [System.Text.UTF8Encoding]::new($false)
[System.IO.File]::WriteAllText($manifestPath, ($manifest | ConvertTo-Json -Depth 10), $utf8NoBom)
Set-Content -Path (Join-Path $ExtensionInstall "config.js") -Value "const RADIUS_LORD_APP_ORIGIN = `"$($origin.GetLeftPart([UriPartial]::Authority))`";" -Encoding ascii

$keyBytes = [Convert]::FromBase64String($PublicKey)
$sha = [Security.Cryptography.SHA256]::Create()
$hash = $sha.ComputeHash($keyBytes)
$alphabet = "abcdefghijklmnop"
$extensionId = ""
for ($i = 0; $i -lt 16; $i++) {
  $extensionId += $alphabet[[int]($hash[$i] -shr 4)]
  $extensionId += $alphabet[[int]($hash[$i] -band 15)]
}

$venv = Join-Path $InstallRoot "venv"
if (-not (Test-Path (Join-Path $venv "Scripts\python.exe"))) {
  & $python.Source -m venv $venv
  if ($LASTEXITCODE -ne 0) { throw "تعذر إنشاء بيئة Python المحلية." }
}
$venvPython = Join-Path $venv "Scripts\python.exe"
& $venvPython -m pip install --disable-pip-version-check pyinstaller pywin32 pillow
if ($LASTEXITCODE -ne 0) { throw "تعذر تثبيت متطلبات جسر SNAPI." }
$buildDirectory = Join-Path $InstallRoot "build"
New-Item -ItemType Directory -Path $buildDirectory -Force | Out-Null
$buildExitCode = 1
Push-Location $InstallRoot
try {
  & $venvPython -m PyInstaller --noconfirm --clean --onefile --name RadiusLordIdentityHost --collect-all PIL `
    --hidden-import pythoncom --hidden-import pywintypes --hidden-import win32timezone `
    --hidden-import win32com.client `
    --distpath $InstallRoot --workpath $buildDirectory --specpath $buildDirectory `
    (Join-Path $InstallRoot "native_host.py")
  $buildExitCode = $LASTEXITCODE
} finally {
  Pop-Location
}
if ($buildExitCode -ne 0) { throw "تعذر بناء برنامج الربط المحلي." }

$hostManifest = @{
  name = $HostName
  description = "Lord Radius Z-3052 temporary identity image capture"
  path = $HostExe
  type = "stdio"
  allowed_origins = @("chrome-extension://$extensionId/")
} | ConvertTo-Json -Depth 5
$hostManifestPath = Join-Path $InstallRoot "native-host-manifest.json"
[System.IO.File]::WriteAllText($hostManifestPath, $hostManifest, $utf8NoBom)
$registryPath = "HKCU:\Software\Google\Chrome\NativeMessagingHosts\$HostName"
New-Item -Path $registryPath -Force | Out-Null
Set-Item -Path $registryPath -Value $hostManifestPath

Write-Host "اكتمل تثبيت جسر الالتقاط المحلي." -ForegroundColor Green
Write-Host "حمّل الإضافة غير المنشورة من هذا المجلد في Chrome: $ExtensionInstall"
Write-Host "معرّف الإضافة الثابت: $extensionId"
Write-Host "تأكد من تثبيت تعريف/SDK القارئ وضبطه على SNAPI مع Imaging Interface."
