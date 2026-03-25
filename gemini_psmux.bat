@echo off
setlocal enabledelayedexpansion
set SESSION_NAME=gemini-cli

:: 1. Force kill any existing session to ensure a fresh start
echo [self-command] Cleaning up old sessions...
psmux kill-session -t %SESSION_NAME% 2>nul

:: 2. Find the script directory to keep paths relative
set "SCRIPT_DIR=%~dp0"

:: 3. Find the Gemini path
FOR /F "usebackq tokens=*" %%a IN (`pwsh -NoProfile -Command "(Get-Command gemini -ErrorAction SilentlyContinue).Source"`) DO SET "GEMINI_PATH=%%a"

:: 4. Find Pythonw (Windowless) for background workers
FOR /F "usebackq tokens=*" %%a IN (`where.exe pythonw 2^>nul`) DO SET "PY_EXE=%%a"
if "!PY_EXE!"=="" (
    FOR /F "usebackq tokens=*" %%a IN (`where.exe python 2^>nul`) DO SET "PY_EXE=%%a"
)

:: 5. Identify psmux socket
FOR /F "usebackq tokens=*" %%a IN (`psmux display-message -p "#{socket_path}" 2^>nul`) DO SET "PS_SOCKET=%%a"

:: Set environment variables for the extension
set "GEMINI_PYTHONW_PATH=!PY_EXE!"
set "GEMINI_PSMUX_SOCKET=!PS_SOCKET!"

if "%GEMINI_PATH%"=="" (
    echo [ERROR] gemini command not found in PATH.
    pause
    exit /b 1
)

:: --- Session Management ---

echo [self-command] Creating fresh psmux session: %SESSION_NAME%
:: Launch gemini in YOLO mode
psmux new-session -d -s %SESSION_NAME% -- pwsh -NoProfile -Command "& '!GEMINI_PATH!' -y"
psmux set-option -t %SESSION_NAME% history-limit 10000

echo [self-command] Attaching to: %SESSION_NAME%
psmux attach -t %SESSION_NAME%

:: --- Cleanup on Exit ---
:: This runs when you type 'exit' or the session finishes normally
echo [self-command] Killing session %SESSION_NAME%...
psmux kill-session -t %SESSION_NAME% 2>nul
