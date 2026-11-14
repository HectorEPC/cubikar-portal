# Script de Respaldo Automatizado para Cubikar
$ProgressPreference = 'SilentlyContinue'
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$projectRoot = $PSScriptRoot
if (-not $projectRoot) { $projectRoot = Get-Location }

$backupDir = Join-Path $projectRoot "_respaldos"
if (-not (Test-Path $backupDir)) {
    New-Item -ItemType Directory -Path $backupDir | Out-Null
}

$zipName = "Cubikar_Respaldo_$timestamp.zip"
$zipPath = Join-Path $backupDir $zipName

Write-Host "Iniciando respaldo de Cubikar..." -ForegroundColor Cyan

# 1. Crear respaldo comprimido ZIP
$items = Get-ChildItem -Path $projectRoot -Exclude "_respaldos", ".git"
Compress-Archive -Path $items -DestinationPath $zipPath -Force

$zipItem = Get-Item $zipPath
$sizeMB = [math]::Round($zipItem.Length / 1MB, 2)
Write-Host "-> Archivo ZIP generado: $zipName ($sizeMB MB)" -ForegroundColor Green

# 2. Registrar punto de control en Git si existe repositorio
if (Test-Path (Join-Path $projectRoot ".git")) {
    Push-Location $projectRoot
    git add .
    $commitMsg = "Respaldo automático - $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
    git commit -m $commitMsg 2>$null
    git tag "backup-$timestamp" 2>$null
    Pop-Location
    Write-Host "-> Punto de control Git registrado: backup-$timestamp" -ForegroundColor Green
}

Write-Host "`nRespaldo completado con exito en: $backupDir" -ForegroundColor Yellow
