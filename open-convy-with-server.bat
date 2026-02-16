@echo off
cd /d "%~dp0"
echo Starting Convy server...
start "Convy Server" cmd /k "cd /d %~dp0 && python -m http.server 8765"
timeout /t 3 /nobreak >nul
start "" "http://127.0.0.1:8765"
echo Convy opened. Keep the "Convy Server" window open.
