@echo off
REM clean-and-import-prod.bat - Version production avec pause
REM Usage: double-cliquer sur ce fichier pour lancer le déploiement

setlocal enabledelayedexpansion

echo.
echo ===============================================================
echo   GMBS CRM — Déploiement Production
echo ===============================================================
echo.
echo [INFO] Démarrage du processus d'import...
echo [INFO] Date de départ : 01/01/2026
echo.

REM Aller au répertoire racine du projet
cd /d "%~dp0..\..\..\.."
set NODE_ENV=production

REM Appeler le script Node.js avec les paramètres
npx tsx scripts\data\imports\deploy\deliver-prod.js --import-start-date=01/01/2026

REM Vérifier le code de sortie
if !ERRORLEVEL! neq 0 (
  echo.
  echo [ERREUR] Le script d'import a échoué (code !ERRORLEVEL!)
  echo.
  pause
  exit /b !ERRORLEVEL!
)

echo.
echo ===============================================================
echo   ✓ Opération terminée avec succès
echo ===============================================================
echo.
pause
