@echo off
REM clean-and-import.bat - Import avec nettoyage depuis 01/01/2026

REM Aller au répertoire racine du projet
cd /d "%~dp0..\..\..\.."

REM Appeler le script Node.js avec les paramètres
npx tsx scripts\data\imports\deploy\deliver-prod.js --import-start-date=01/01/2026

REM Vérifier le code de sortie
if !ERRORLEVEL! neq 0 (
  echo.
  echo [ERREUR] Import script failed (code !ERRORLEVEL!)
  pause
)

echo.
echo [OK] Import completed successfully
pause