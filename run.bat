@echo off
title CHROS Local Server
echo Starting CHROS Local Server (No Database Connection)...
python server.py
if %ERRORLEVEL% neq 0 (
    py server.py
)
pause
