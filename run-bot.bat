@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"
title Aether Vault - Interactive Discord Bot
color 0B

echo ================================================================
echo           AETHER VAULT - INTERACTIVE DISCORD BOT
echo ================================================================
echo.

:: 1. Verify Node.js is installed
where node >nul 2>&1
if %errorlevel% neq 0 (
    color 0C
    echo [ERROR] Node.js is not found on your system!
    echo Please download and install Node.js from: https://nodejs.org/
    echo Once installed, restart this file.
    echo.
    pause
    exit /b 1
)

:: 2. Verify dependencies
if not exist node_modules (
    echo [INFO] Installing required dependencies: discord.js ...
    echo.
    call npm install
    if %errorlevel% neq 0 (
        color 0C
        echo.
        echo [ERROR] npm install failed. Please check your internet connection.
        echo.
        pause
        exit /b 1
    )
    echo.
    echo [SUCCESS] Dependencies installed successfully!
    echo.
)

:: 3. Run Bot with auto-restart on crash and pause on config error
:start
echo [INFO] Starting Aether Vault Discord Bot Service...
echo [INFO] Working directory: %CD%
echo.

node index.js
set EXITCODE=%errorlevel%

echo.
if %EXITCODE% neq 0 (
    color 0C
    echo ================================================================
    echo [NOTICE] Bot stopped with exit code: %EXITCODE%
    echo If your Bot Token is missing or invalid:
    echo 1. Open your browser: http://localhost/xxx/
    echo 2. Go to Settings -^> Discord Integration
    echo 3. Enter your Bot Token and click 'Save All Settings'
    echo ================================================================
    echo.
    echo Press any key to try running again, or close this window.
    pause
    color 0B
    goto start
)

echo [INFO] Bot service stopped normally.
pause
