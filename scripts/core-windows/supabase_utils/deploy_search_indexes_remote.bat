@echo off
REM ============================================================================
REM Deploiement des indexes de recherche hybride (CONCURRENTLY)
REM ============================================================================
REM
REM Cree les 4 indexes du buffer live de search_global, hors transaction,
REM sans bloquer les ecritures sur les tables.
REM
REM PREREQUIS :
REM   1. psql installe et accessible dans le PATH
REM      (winget install PostgreSQL.PostgreSQL)
REM   2. Le script `prod_deploy_1_search_columns.sql` deja applique
REM      (les colonnes search_vector doivent exister sur interventions/artisans)
REM
REM USAGE (3 modes au choix) :
REM
REM   A) Connection string complete en argument :
REM      %~nx0 "postgresql://postgres:PWD@db.PROJ.supabase.co:5432/postgres"
REM
REM   B) Variable d'env DATABASE_URL :
REM      set DATABASE_URL=postgresql://...
REM      %~nx0
REM
REM   C) Variables splittees (recommande pour eviter de pasted le password
REM      en clair dans l'historique shell) :
REM      set SUPABASE_DB_PASSWORD=...
REM      set SUPABASE_DB_HOST=db.PROJ.supabase.co
REM      %~nx0
REM
REM CONFIGURATION (mode C) :
REM   SUPABASE_DB_PASSWORD  (obligatoire en mode C)
REM   SUPABASE_DB_HOST      (obligatoire en mode C, ex: db.PROJ.supabase.co)
REM   SUPABASE_DB_PORT      defaut "5432"
REM   SUPABASE_DB_USER      defaut "postgres"
REM   SUPABASE_DB_NAME      defaut "postgres"
REM
REM Connection string : Supabase Dashboard ^> Project Settings ^> Database ^> URI
REM ============================================================================

setlocal enabledelayedexpansion

REM --- Auto-load .env.production (3 niveaux au-dessus du script) ---
echo [DEBUG] Script dir : %~dp0
set "ENV_FILE=%~dp0..\..\..\.env.production"
echo [DEBUG] ENV_FILE   : %ENV_FILE%
if exist "%ENV_FILE%" (
    echo [INFO] Chargement de .env.production...
    for /f "usebackq tokens=1,* delims==" %%A in ("%ENV_FILE%") do (
        set "_key=%%A"
        if not "!_key:~0,1!"=="#" if not "%%A"=="" (
            set "%%A=%%B"
        )
    )
) else (
    echo [AVERTISSEMENT] .env.production introuvable : %ENV_FILE%
)

if not "%~1"=="" (
    set "DB_URL=%~1"
) else if not "%DATABASE_URL%"=="" (
    set "DB_URL=%DATABASE_URL%"
) else if not "%SUPABASE_DB_PASSWORD%"=="" (
    if "%SUPABASE_DB_HOST%"=="" (
        echo [ERREUR] SUPABASE_DB_HOST manquant en mode variables splittees.
        pause
        exit /b 1
    )
    if "%SUPABASE_DB_PORT%"=="" set "SUPABASE_DB_PORT=5432"
    if "%SUPABASE_DB_USER%"=="" set "SUPABASE_DB_USER=postgres"
    if "%SUPABASE_DB_NAME%"=="" set "SUPABASE_DB_NAME=postgres"
    set "DB_URL=postgresql://%SUPABASE_DB_USER%:%SUPABASE_DB_PASSWORD%@%SUPABASE_DB_HOST%:%SUPABASE_DB_PORT%/%SUPABASE_DB_NAME%"
) else (
    echo [ERREUR] Connection manquante. 3 modes :
    echo   A^) %~nx0 "postgresql://..."
    echo   B^) set DATABASE_URL=postgresql://... ^&^& %~nx0
    echo   C^) set SUPABASE_DB_PASSWORD=...^&^& set SUPABASE_DB_HOST=...^&^& %~nx0
    pause
    exit /b 1
)

where psql >nul 2>&1
if errorlevel 1 (
    echo [ERREUR] psql introuvable dans le PATH.
    echo Installer PostgreSQL : winget install PostgreSQL.PostgreSQL
    pause
    exit /b 1
)

echo.
echo === Deploiement des 4 indexes search hybride ===
echo.

echo [1/4] idx_interventions_search_vector_live (GIN)...
psql "%DB_URL%" -v ON_ERROR_STOP=1 -c "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_interventions_search_vector_live ON public.interventions USING gin(search_vector);"
if errorlevel 1 goto :error

echo [2/4] idx_artisans_search_vector_live (GIN)...
psql "%DB_URL%" -v ON_ERROR_STOP=1 -c "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_artisans_search_vector_live ON public.artisans USING gin(search_vector);"
if errorlevel 1 goto :error

echo [3/4] idx_interventions_updated_at (B-tree partiel)...
psql "%DB_URL%" -v ON_ERROR_STOP=1 -c "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_interventions_updated_at ON public.interventions(updated_at DESC) WHERE is_active = true;"
if errorlevel 1 goto :error

echo [4/4] idx_artisans_updated_at (B-tree partiel)...
psql "%DB_URL%" -v ON_ERROR_STOP=1 -c "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_artisans_updated_at ON public.artisans(updated_at DESC) WHERE is_active = true;"
if errorlevel 1 goto :error

echo.
echo === OK : 4 indexes crees (ou deja presents) ===
echo.
echo Verification :
psql "%DB_URL%" -c "SELECT indexname FROM pg_indexes WHERE tablename IN ('interventions','artisans') AND (indexname LIKE 'idx_%%search_vector%%' OR indexname LIKE 'idx_%%updated_at%%') ORDER BY indexname;"

echo.
echo Detection d'eventuels indexes INVALID (echec en cours de build) :
psql "%DB_URL%" -c "SELECT c.relname FROM pg_index i JOIN pg_class c ON c.oid = i.indexrelid WHERE NOT i.indisvalid AND (c.relname LIKE 'idx_%%search_vector%%' OR c.relname LIKE 'idx_%%updated_at%%');"

endlocal
exit /b 0

:error
echo.
echo [ERREUR] Echec lors de la creation d'un index.
echo Si un index est reste en etat INVALID, le supprimer avec :
echo   psql "%%DB_URL%%" -c "DROP INDEX CONCURRENTLY IF EXISTS idx_NOM;"
echo puis relancer ce script.
pause
endlocal

pause
exit /b 1
