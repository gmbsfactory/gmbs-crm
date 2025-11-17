# scripts/import-production.ps1
# Script pour exécuter l'import sur la base de données de production
# Usage: powershell -ExecutionPolicy Bypass -File scripts/import-production.ps1

$ErrorActionPreference = "Stop"  # Arrêter en cas d'erreur

Write-Host "🌐 Mode PRODUCTION activé" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# Vérifier que le fichier .env.production existe
if (-not (Test-Path ".env.production")) {
    Write-Host "❌ Fichier .env.production non trouvé!" -ForegroundColor Red
    Write-Host "💡 Créez .env.production avec vos variables de production" -ForegroundColor Yellow
    exit 1
}

# Charger les variables de production de manière sécurisée
Write-Host "📝 Chargement de .env.production..." -ForegroundColor Yellow
$env:NODE_ENV = "production"

# Méthode robuste pour charger le fichier .env
# Parse le fichier ligne par ligne et définit les variables d'environnement
Get-Content ".env.production" | ForEach-Object {
    $line = $_.Trim()
    # Ignorer les lignes vides et les commentaires
    if ($line -and -not $line.StartsWith("#")) {
        # Séparer la clé et la valeur (gère les valeurs avec espaces et caractères spéciaux)
        if ($line -match '^([^=]+)=(.*)$') {
            $key = $matches[1].Trim()
            $value = $matches[2].Trim()
            # Supprimer les guillemets s'ils entourent la valeur
            if ($value.StartsWith('"') -and $value.EndsWith('"')) {
                $value = $value.Substring(1, $value.Length - 2)
            }
            elseif ($value.StartsWith("'") -and $value.EndsWith("'")) {
                $value = $value.Substring(1, $value.Length - 2)
            }
            # Définir la variable d'environnement
            [Environment]::SetEnvironmentVariable($key, $value, "Process")
        }
    }
}

# Vérifier les variables essentielles (avec ou sans NEXT_PUBLIC_)
$supabaseUrl = [Environment]::GetEnvironmentVariable("SUPABASE_URL", "Process")
$nextPublicSupabaseUrl = [Environment]::GetEnvironmentVariable("NEXT_PUBLIC_SUPABASE_URL", "Process")

if ([string]::IsNullOrEmpty($supabaseUrl) -and [string]::IsNullOrEmpty($nextPublicSupabaseUrl)) {
    Write-Host "❌ Variable SUPABASE_URL ou NEXT_PUBLIC_SUPABASE_URL manquante dans .env.production" -ForegroundColor Red
    exit 1
}

$serviceRoleKey = [Environment]::GetEnvironmentVariable("SUPABASE_SERVICE_ROLE_KEY", "Process")
if ([string]::IsNullOrEmpty($serviceRoleKey)) {
    Write-Host "❌ Variable SUPABASE_SERVICE_ROLE_KEY manquante dans .env.production" -ForegroundColor Red
    exit 1
}

# Exporter les variables NEXT_PUBLIC_* si elles n'existent pas déjà
# Cela permet d'utiliser SUPABASE_URL comme fallback pour NEXT_PUBLIC_SUPABASE_URL
# IMPORTANT: env.ts lit NEXT_PUBLIC_SUPABASE_URL, pas SUPABASE_URL
if ([string]::IsNullOrEmpty($nextPublicSupabaseUrl) -and -not [string]::IsNullOrEmpty($supabaseUrl)) {
    [Environment]::SetEnvironmentVariable("NEXT_PUBLIC_SUPABASE_URL", $supabaseUrl, "Process")
    Write-Host "ℹ️  NEXT_PUBLIC_SUPABASE_URL défini depuis SUPABASE_URL" -ForegroundColor Green
}

$nextPublicAnonKey = [Environment]::GetEnvironmentVariable("NEXT_PUBLIC_SUPABASE_ANON_KEY", "Process")
$anonKey = [Environment]::GetEnvironmentVariable("SUPABASE_ANON_KEY", "Process")
if ([string]::IsNullOrEmpty($nextPublicAnonKey) -and -not [string]::IsNullOrEmpty($anonKey)) {
    [Environment]::SetEnvironmentVariable("NEXT_PUBLIC_SUPABASE_ANON_KEY", $anonKey, "Process")
    Write-Host "ℹ️  NEXT_PUBLIC_SUPABASE_ANON_KEY défini depuis SUPABASE_ANON_KEY" -ForegroundColor Green
}

# Vérifier que NEXT_PUBLIC_SUPABASE_URL est maintenant défini
$nextPublicSupabaseUrl = [Environment]::GetEnvironmentVariable("NEXT_PUBLIC_SUPABASE_URL", "Process")
if ([string]::IsNullOrEmpty($nextPublicSupabaseUrl)) {
    Write-Host "❌ NEXT_PUBLIC_SUPABASE_URL non défini après chargement" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Configuration chargée" -ForegroundColor Green
$displayUrl = if (-not [string]::IsNullOrEmpty($supabaseUrl)) { $supabaseUrl } else { $nextPublicSupabaseUrl }
Write-Host "📍 SUPABASE_URL: $displayUrl" -ForegroundColor Cyan
Write-Host "📍 NEXT_PUBLIC_SUPABASE_URL: $nextPublicSupabaseUrl" -ForegroundColor Cyan
Write-Host ""

# Vérifier la connexion avant de continuer
Write-Host "🔌 Test de connexion à la base de données..." -ForegroundColor Yellow
$npxPath = Get-Command npx -ErrorAction SilentlyContinue
if ($npxPath) {
    $env:NODE_ENV = "production"
    $testResult = & npx tsx scripts/imports/google-sheets-import-clean-v2.js --test-connection 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Échec du test de connexion" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "⚠️  npx non disponible, test de connexion ignoré" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "🚀 Démarrage de l'import complet..." -ForegroundColor Green
Write-Host ""

# Exécuter l'import avec NODE_ENV=production
# Les variables NEXT_PUBLIC_* sont maintenant disponibles dans l'environnement
# Note: --verbose est passé via npm pour avoir plus de détails sur les erreurs
$env:NODE_ENV = "production"
& npx tsx scripts/imports/google-sheets-import-clean-v2.js --verbose
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Échec de l'import" -ForegroundColor Red
    exit 1
}

& node scripts/recalculate-artisan-statuses.js
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Échec du recalcul des statuts" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "✅ Import terminé avec succès!" -ForegroundColor Green






