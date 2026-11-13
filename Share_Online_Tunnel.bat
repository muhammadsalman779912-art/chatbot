@echo off
title Share Salman Chat Bot Online
echo ===================================================
echo   Creating Free Public Tunnel for Salman Chat Bot...
echo ===================================================
echo.
echo If asked for a tunnel password, provide your IP address.
echo Finding your public IP...
curl.exe -s https://ipv4.icanhazip.com
echo.
echo Starting tunnel... Please share the generated URL with your friends!
echo.
npx --yes localtunnel --port 8000
pause

