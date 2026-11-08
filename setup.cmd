@echo off
rem Installs dependencies (skips what is already installed) and builds the app for production.
cd /d "%~dp0"
where pnpm >nul 2>nul || (echo pnpm is not installed. Install Node 22.19+ and run: corepack enable & pause & exit /b 1)
where uv >nul 2>nul || (echo uv is not installed. See https://docs.astral.sh/uv/getting-started/installation/ & pause & exit /b 1)
echo Installing JavaScript packages...
call pnpm install || goto :fail
echo Installing Python packages...
call uv sync || goto :fail
echo Building...
call pnpm build || goto :fail
echo.
echo Done. Double-click start.cmd to run the app.
pause
exit /b 0
:fail
echo.
echo Setup failed. See the messages above.
pause
exit /b 1
