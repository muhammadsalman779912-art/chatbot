@echo off
title Salman Chat Bot
echo ===================================================
echo   Starting Salman Chat Bot...
echo ===================================================
start "" "http://localhost:8000"
python server.py --port 8000
pause

