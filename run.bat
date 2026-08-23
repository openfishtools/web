@echo off
title CHROS Next Gen - Server + API
cd /d "%~dp0"

echo ==========================================
echo  CHROS Next Gen - Server + API
echo ==========================================
echo.

if not exist "%~dp0node_modules" (
    echo [Setup] Installing dependencies...
    call npm install
    echo.
)

echo [Server] Starting Next Gen API at http://localhost:3000...
echo [Browser] Opening in default browser...
start http://localhost:3000

node api/index.js

if errorlevel 1 (
    echo.
    echo [ERROR] Server stopped with error.
    pause
)
