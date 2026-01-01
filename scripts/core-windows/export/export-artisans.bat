@echo off
REM Script d'export des artisans au format CSV
REM
REM Usage:
REM   export-artisans.bat                          (exporte tous les artisans)
REM   export-artisans.bat --active-only            (exporte uniquement les artisans actifs)
REM   export-artisans.bat --output output.csv      (exporte vers un fichier spécifique)

cd ..\..\..

REM Vérifier si des arguments sont fournis
if "%~1"=="" (
    echo Export de tous les artisans...
    node scripts/exports/export-artisans-csv.js
) else (
    echo Export des artisans avec options...
    node scripts/exports/export-artisans-csv.js %*
)

pause
