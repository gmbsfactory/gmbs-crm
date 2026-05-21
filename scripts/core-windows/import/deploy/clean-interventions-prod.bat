@echo off
REM clean-interventions-prod.bat - Supprime les interventions (+ owner & tenants) en production
REM Les artisans sont preserves. Usage: double-cliquer sur ce fichier.

setlocal enabledelayedexpansion

echo.
echo ===============================================================
echo   GMBS CRM — Nettoyage des interventions (Production)
echo ===============================================================
echo.
echo [INFO] Cette operation supprime les interventions, owners et tenants.
echo [INFO] Les artisans NE seront PAS supprimes.
echo.

REM Aller au repertoire racine du projet
cd /d "%~dp0..\..\..\.."
set NODE_ENV=production

REM Appeler le script de nettoyage cible
npx tsx scripts\data\imports\deploy\cleanup-interventions.js

REM Verifier le code de sortie
if !ERRORLEVEL! neq 0 (
  echo.
  echo [ERREUR] Le script de nettoyage a echoue (code !ERRORLEVEL!)
  echo.
  pause
  exit /b !ERRORLEVEL!
)

echo.
echo ===============================================================
echo   ✓ Nettoyage termine. Vous pouvez maintenant importer le CSV.
echo ===============================================================
echo.
pause
