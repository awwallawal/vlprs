@echo off
REM Auditor Station — double-click to verify this copied bundle is intact (no install needed).
cd /d "%~dp0"
powershell -ExecutionPolicy Bypass -File "%~dp0scripts\verify-bundle.ps1"
echo.
pause
