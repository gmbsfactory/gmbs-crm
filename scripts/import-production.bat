@echo off
REM scripts/import-production.bat
REM Script pour executer l'import sur la base de donnees de production
REM Usage: scripts\import-production.bat


echo "Mode PRODUCTION active"

cd %~dp0/.. 
REM Verifier que le fichier .env.production existe
if not exist ".env.production" (
    echo  %CD%
    echo %#dp0%
    echo "Fichier .env.production non trouve!"
    echo "Creez .env.production avec vos variables de production"
    pause
)

REM Charger les variables de production
echo "Chargement de .env.production..."
set NODE_ENV=production

REM Methode pour charger le fichier .env
REM Parse le fichier ligne par ligne et definit les variables d'environnement
for /f "usebackq tokens=1* delims==" %%a in (".env.production") do (
    set "line=%%a"
    REM Ignorer les lignes vides et les commentaires
    if not "!line!"=="" (
        if not "!line:~0,1!"=="#" (
            set "key=%%a"
            set "value=%%b"
            REM Supprimer les guillemets s'ils entourent la valeur
            if "!value:~0,1!"=="""" set "value=!value:~1!"
            if "!value:~-1!"=="""" set "value=!value:~0,-1!"
            if "!value:~0,1!"=="'" set "value=!value:~1!"
            if "!value:~-1!"=="'" set "value=!value:~0,-1!"
            REM Definir la variable d'environnement
            set "!key!=!value!"
        )
    )
)

REM Verifier les variables essentielles (avec ou sans NEXT_PUBLIC_)
if "%SUPABASE_URL%"=="" if "%NEXT_PUBLIC_SUPABASE_URL%"=="" (
    echo "Variable SUPABASE_URL ou NEXT_PUBLIC_SUPABASE_URL manquante dans .env.production"
    pause
)

if "%SUPABASE_SERVICE_ROLE_KEY%"=="" (
    echo "Variable SUPABASE_SERVICE_ROLE_KEY manquante dans .env.production"
    pause
)

REM Exporter les variables NEXT_PUBLIC_* si elles n'existent pas déjà
REM Cela permet d'utiliser SUPABASE_URL comme fallback pour NEXT_PUBLIC_SUPABASE_URL
REM IMPORTANT: env.ts lit NEXT_PUBLIC_SUPABASE_URL, pas SUPABASE_URL
if "%NEXT_PUBLIC_SUPABASE_URL%"=="" if not "%SUPABASE_URL%"=="" (
    set "NEXT_PUBLIC_SUPABASE_URL=%SUPABASE_URL%"
    echo "NEXT_PUBLIC_SUPABASE_URL defini depuis SUPABASE_URL"
)

if "%NEXT_PUBLIC_SUPABASE_ANON_KEY%"=="" if not "%SUPABASE_ANON_KEY%"=="" (
    set "NEXT_PUBLIC_SUPABASE_ANON_KEY=%SUPABASE_ANON_KEY%"
    echo "NEXT_PUBLIC_SUPABASE_ANON_KEY defini depuis SUPABASE_ANON_KEY"
)

REM Verifier que NEXT_PUBLIC_SUPABASE_URL est maintenant defini
if "%NEXT_PUBLIC_SUPABASE_URL%"=="" (
    echo "NEXT_PUBLIC_SUPABASE_URL non defini apres chargement"
    pause
)

echo Configuration chargee
if not "%SUPABASE_URL%"=="" (
    echo "SUPABASE_URL: %SUPABASE_URL%"
) else (
    echo "SUPABASE_URL: %NEXT_PUBLIC_SUPABASE_URL%"
)
echo "NEXT_PUBLIC_SUPABASE_URL: %NEXT_PUBLIC_SUPABASE_URL%"
echo ""

REM Verifier la connexion avant de continuer
echo "Test de connexion a la base de donnees..."
where npx >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    set NODE_ENV=production
    npx tsx scripts/imports/google-sheets-import-clean-v2.js --test-connection
    if !ERRORLEVEL! NEQ 0 (
        echo "Echec du test de connexion"
        pause
    )
) else (
    echo "npx non disponible, test de connexion ignore"
)

echo "Demarrage de l'import complet..."

REM Executer l'import avec NODE_ENV=production
REM Les variables NEXT_PUBLIC_* sont maintenant disponibles dans l'environnement
REM Note: --verbose est passe via npm pour avoir plus de details sur les erreurs
set NODE_ENV=production
echo "Import des artisans..."
npm run import:artisans
if !ERRORLEVEL! NEQ 0 (
    echo "Echec de l'import"
    pause
)
echo "Import des interventions..."
npm run import:interventions -- --date-start=01/01/2026 --date-end=01/04/2026
if !ERRORLEVEL! NEQ 0 (
    echo "Echec de l'import"
    pause
)

node scripts/recalculate-artisan-statuses.js
if !ERRORLEVEL! NEQ 0 (
    echo "Echec du recalcul des statuts"
    pause
)

echo ""
echo "Import termine avec succes!"

pause