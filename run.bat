@echo off
title CHROS Local Server + Cloudflare Tunnel

:: Check if cloudflared.exe exists in the current directory
if not exist "%~dp0cloudflared.exe" (
    echo ==========================================
    echo [Cloudflare] Downloading cloudflared.exe...
    echo ==========================================
    powershell -Command "Invoke-WebRequest -Uri 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe' -OutFile '%~dp0cloudflared.exe'"
    if not exist "%~dp0cloudflared.exe" (
        echo [ERROR] Failed to download cloudflared.exe automatically.
        echo Please download it manually or check your connection.
        pause
        exit /b
    )
    echo [Cloudflare] Download complete!
)

echo.
echo ==========================================
echo 📦 Checking and installing dependencies...
echo ==========================================
call npm install

echo.
echo ==========================================
echo 🚀 Starting CHROS Local Node.js Server...
echo ==========================================
start "CHROS Node.js Server" cmd /k "npm start"

echo.
echo ==========================================
echo 🌐 Launching Cloudflare Tunnel...
echo ==========================================
echo Please wait a moment for the tunnel link to generate.
echo Look for a line like: https://xxxx-xxxx.trycloudflare.com
echo ==========================================
echo.

"%~dp0cloudflared.exe" tunnel --url http://127.0.0.1:5000

pause
