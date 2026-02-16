@echo off
cd /d "%~dp0"
where git >nul 2>&1
if errorlevel 1 (
  echo Git nerastas! Idiekite is https://git-scm.com/download/win
  echo Arba skaitykite GITHUB-UPLOAD-INSTRUCTIONS.md - kaip ikelti per svetaine.
  pause
  exit /b 1
)
echo Pushing Convy to GitHub...
if not exist .git git init
git add .
git status
git commit -m "Convy 2026-02-16 - Excel to i.SAF XML converter"
git branch -M main
git remote remove origin 2>nul
git remote add origin https://github.com/mrvitold/Convy.git
git push -u origin main
echo Done.
pause
