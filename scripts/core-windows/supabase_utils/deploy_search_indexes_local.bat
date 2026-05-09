@echo off
REM ============================================================================
REM Deploiement des indexes de recherche hybride - DB LOCALE (Supabase Docker)
REM ============================================================================
REM
REM Cible la stack Supabase locale (port 54322, password par defaut "postgres").
REM Pour la prod, utiliser deploy_search_indexes_remote.bat.
REM
REM Note : sur DB locale fraiche, CONCURRENTLY est inutile (pas de trafic
REM concurrent), mais on garde la meme procedure que la prod par coherence.
REM
REM PREREQUIS :
REM   1. supabase start (la stack Docker doit tourner)
REM   2. Migration 99024 ou prod_deploy_1_search_columns.sql applique
REM      (les colonnes search_vector doivent exister)
REM   3. psql installe (winget install PostgreSQL.PostgreSQL)
REM
REM CONFIGURATION (variables d'environnement, optionnelles) :
REM   SUPABASE_DB_PASSWORD  defaut "postgres" (Supabase local par defaut)
REM   SUPABASE_DB_HOST      defaut "127.0.0.1"
REM   SUPABASE_DB_PORT      defaut "54322"
REM   SUPABASE_DB_USER      defaut "postgres"
REM   SUPABASE_DB_NAME      defaut "postgres"
REM ============================================================================

setlocal

if "%SUPABASE_DB_PASSWORD%"=="" set "SUPABASE_DB_PASSWORD=postgres"
if "%SUPABASE_DB_HOST%"==""     set "SUPABASE_DB_HOST=127.0.0.1"
if "%SUPABASE_DB_PORT%"==""     set "SUPABASE_DB_PORT=54322"
if "%SUPABASE_DB_USER%"==""     set "SUPABASE_DB_USER=postgres"
if "%SUPABASE_DB_NAME%"==""     set "SUPABASE_DB_NAME=postgres"

set "DB_URL=postgresql://%SUPABASE_DB_USER%:%SUPABASE_DB_PASSWORD%@%SUPABASE_DB_HOST%:%SUPABASE_DB_PORT%/%SUPABASE_DB_NAME%"

where psql >nul 2>&1
if errorlevel 1 (
    echo [ERREUR] psql introuvable dans le PATH.
    echo Installer PostgreSQL : winget install PostgreSQL.PostgreSQL
    exit /b 1
)

echo.
echo === Deploiement des 4 indexes search hybride (LOCAL) ===
echo Cible : %SUPABASE_DB_USER%@%SUPABASE_DB_HOST%:%SUPABASE_DB_PORT%/%SUPABASE_DB_NAME%
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

endlocal
exit /b 0

:error
echo.
echo [ERREUR] Echec lors de la creation d'un index.
echo Verifier que la stack Supabase est demarree : supabase status
echo Si un index est reste INVALID :
echo   psql "%DB_URL%" -c "DROP INDEX CONCURRENTLY IF EXISTS idx_NOM;"
endlocal
exit /b 1
