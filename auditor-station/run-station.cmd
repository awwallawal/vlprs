@echo off
REM Auditor Station — double-click to launch locally.
REM Requires: Node 22+, Ollama running, dependencies installed (pnpm install --ignore-workspace),
REM and a built catalog (pnpm build:catalog). See INSTALL.md / GOVERNANCE.md.
cd /d "%~dp0"
echo Starting the Auditor Station... (close this window to stop)
echo Open http://127.0.0.1:8717 in your browser once it says "listening".
echo.
call pnpm start
echo.
echo The station has stopped.
pause
