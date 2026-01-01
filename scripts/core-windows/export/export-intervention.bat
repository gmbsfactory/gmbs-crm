@echo off
REM Script d'export des interventions au format CSV
REM
REM Usage:
REM   export.bat                                    (exporte toutes les interventions)
REM   export.bat 2024-01-01 2024-12-31             (exporte avec date de début et fin)
REM   export.bat 2024-01-01 2024-12-31 output.csv  (exporte vers un fichier spécifique)

cd ..\..\..

REM Vérifier si des arguments sont fournis
if "%~1"=="" (
    echo Export de toutes les interventions...
    node scripts/exports/export-interventions-csv.js
) else if "%~2"=="" (
    echo Erreur: Si vous spécifiez une date de début, vous devez aussi spécifier une date de fin
    echo Usage: export.bat [date-debut] [date-fin] [fichier-sortie]
    echo Exemple: export.bat 2024-01-01 2024-12-31
    pause
    exit /b 1
) else if "%~3"=="" (
    echo Export des interventions du %~1 au %~2...
    node scripts/exports/export-interventions-csv.js --start-date %~1 --end-date %~2
) else (
    echo Export des interventions du %~1 au %~2 vers %~3...
    node scripts/exports/export-interventions-csv.js --start-date %~1 --end-date %~2 --output %~3
)

pause
