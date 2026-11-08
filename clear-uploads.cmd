@echo off
rem Deletes every saved upload (all sessions). Stop the app first.
cd /d "%~dp0"
if exist ".uploads" rmdir /s /q ".uploads"
if exist "services\.uploads" rmdir /s /q "services\.uploads"
echo Saved uploads cleared.
pause
