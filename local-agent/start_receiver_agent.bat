@echo off
setlocal EnableExtensions

REM NeuroSync Receiver Agent launcher. Keep the service local to this PC.
set "SCRIPT_DIR=%~dp0"
set "NS_AGENT_PORT=47831"
if not defined NS_ALLOWED_ORIGINS set "NS_ALLOWED_ORIGINS=https://neurosync-beikmn85.manus.space"

echo.
echo ========================================
echo  NeuroSync Receiver Agent
echo ========================================
echo.
echo Status: STARTING
echo Host: 127.0.0.1
echo Port: %NS_AGENT_PORT%
echo.
echo Health: http://127.0.0.1:%NS_AGENT_PORT%/health
echo GPU:    http://127.0.0.1:%NS_AGENT_PORT%/gpu
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo ERROR: Node.js 20 or newer was not found.
  echo Install Node.js from https://nodejs.org/ and run this file again.
  echo.
  pause
  exit /b 1
)

for /f "delims=" %%v in ('node --version') do echo Node.js: %%v
echo Detecting NVIDIA GPU through nvidia-smi...
echo.

node "%SCRIPT_DIR%receiver-agent.mjs"
set "EXIT_CODE=%ERRORLEVEL%"
echo.
echo NeuroSync Receiver Agent stopped with exit code %EXIT_CODE%.
echo Review the message above for the exact cause, then run this file again.
pause
exit /b %EXIT_CODE%
