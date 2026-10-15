@echo off
setlocal
title Lord Radius - Identity Scanner Setup

set "INSTALL_SCRIPT=%~dp0identity-scanner-extension\install.ps1"
set "PROCESSOR_SCRIPT=%~dp0identity_barcode_processor.py"
if not exist "%INSTALL_SCRIPT%" goto :missing_files
if not exist "%PROCESSOR_SCRIPT%" goto :missing_files

echo Lord Radius identity scanner setup
echo.
echo Enter the exact site origin, for example https://radius.example.com
echo For local development, use http://localhost:3000
echo.
set "APP_ORIGIN="
set /p "APP_ORIGIN=Site origin: "

if not defined APP_ORIGIN (
  echo.
  echo No site origin was entered. Setup cancelled.
  pause
  exit /b 1
)

echo.
echo Installing the local capture bridge and Python requirements...
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -Command "try { & '%INSTALL_SCRIPT%' -AppOrigin '%APP_ORIGIN%'; exit 0 } catch { Write-Error $_; exit 1 }"
set "INSTALL_EXIT=%ERRORLEVEL%"
if not "%INSTALL_EXIT%"=="0" (
  echo.
  echo Setup failed. Check Python 3, internet access, and the scanner driver, then try again.
  pause
  exit /b 1
)

echo.
echo Setup completed. In Chrome, enable Developer mode and choose "Load unpacked".
echo Select: %LOCALAPPDATA%\LordRadius\IdentityCapture\extension
echo This Chrome step is required once for an unpacked extension.
start "" "chrome://extensions"
pause
endlocal
exit /b 0

:missing_files
echo.
echo Setup files are missing. Extract the entire ZIP archive first; do not run this BAT from inside the ZIP or RAR viewer.
pause
exit /b 1
