@echo off
setlocal
title Lord Radius - Identity Scanner Setup

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
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0identity-scanner-extension\install.ps1" -AppOrigin "%APP_ORIGIN%"
if errorlevel 1 (
  echo.
  echo Setup failed. Check that Python 3 is installed and try again.
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
