@echo off
chcp 65001 >nul
cd /d "%~dp0"
where py >nul 2>nul
if not errorlevel 1 (
  py -3 "%~dp0deploy-console.py"
  if errorlevel 1 pause
  exit /b
)
where python >nul 2>nul
if not errorlevel 1 (
  python "%~dp0deploy-console.py"
  if errorlevel 1 pause
  exit /b
)
echo Python 3 with Tcl/Tk is required. Install it, then reopen this launcher.
pause
