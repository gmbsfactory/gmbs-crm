# Script de démarrage principal
# Appelle start_project.ps1 avec le project root comme argument
# Ce script peut être exporté et réutilisé pour d'autres projets

param(
    [string]$ProjectRoot = $PSScriptRoot
)

# S'assurer qu'on est dans le répertoire du script (équivalent de cd %~dp0 en batch)
# Permet de fonctionner correctement depuis un raccourci sur le bureau
# Change le répertoire de travail pour que la fenêtre PowerShell soit dans le bon dossier
$ProjectRootPath = Resolve-Path $PSScriptRoot -ErrorAction SilentlyContinue
if ($ProjectRootPath) {
    Set-Location $ProjectRootPath
    # Afficher le répertoire actuel pour confirmation
    Write-Host "Répertoire de travail: $(Get-Location)" -ForegroundColor Gray
}

# Chemin vers le script start_project.ps1
$startProjectScript = Join-Path $PSScriptRoot "scripts\core-windows\start_project.ps1"

# Vérifier que le script existe
if (-not (Test-Path $startProjectScript)) {
    Write-Host "Erreur: start_project.ps1 introuvable à $startProjectScript" -ForegroundColor Red
    exit 1
}

# Appeler start_project.ps1 avec le project root
Write-Host "Démarrage du projet depuis: $ProjectRoot" -ForegroundColor Cyan
& $startProjectScript -ProjectRoot $ProjectRoot

