@echo off
rem Starts the review service (port 8000) and the web app (http://localhost:3000). Run setup.cmd first.
cd /d "%~dp0"
if not exist "apps\web\.next\BUILD_ID" (echo No build found. Run setup.cmd first. & pause & exit /b 1)
echo Starting... open http://localhost:3000 once it is ready. Close this window to stop.
call pnpm start
pause
