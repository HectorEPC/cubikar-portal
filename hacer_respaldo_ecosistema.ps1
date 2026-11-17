# ==============================================================================
# SCRIPT DE RESPALDO MAESTRO UNIFICADO - ECOSISTEMA CUBIKAR
# Respaldos de: cubikar.app (Portal), const.cubikar.app (Construcción) y arq.cubikar.app (Arquitectura)
# ==============================================================================
$ProgressPreference = 'SilentlyContinue'
$baseDir = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $baseDir) { $baseDir = Get-Location }

# Si se ejecuta desde la carpeta Cubikar, subir un nivel
if ((Split-Path -Leaf $baseDir) -eq "Cubikar") {
    $baseDir = Split-Path -Parent $baseDir
}

$cubikarDir   = Join-Path $baseDir "Cubikar"
$constDir     = Join-Path $baseDir "ADM_CONST"
$arqDir       = Join-Path $baseDir "ADM_ARQ"
$respaldarDir = Join-Path $baseDir "Respaldar"

if (-not (Test-Path $respaldarDir)) {
    New-Item -ItemType Directory -Path $respaldarDir | Out-Null
}

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$zipName = "Cubikar_ECOSISTEMA_COMPLETO_$timestamp.zip"
$zipPath = Join-Path $respaldarDir $zipName

Write-Host "`n========================================================" -ForegroundColor Cyan
Write-Host " INICIANDO RESPALDO MAESTRO DEL ECOSISTEMA CUBIKAR" -ForegroundColor Cyan
Write-Host "========================================================`n" -ForegroundColor Cyan

# 1. Puntos de control Git
Write-Host "[1/3] Sincronizando etiquetas Git (tag backup-$timestamp)..." -ForegroundColor Yellow
$repos = @(
    @{ Name = "Portal Central"; Path = $cubikarDir },
    @{ Name = "Construccion";   Path = $constDir },
    @{ Name = "Arquitectura";   Path = $arqDir }
)

foreach ($r in $repos) {
    if (Test-Path (Join-Path $r.Path ".git")) {
        Push-Location $r.Path
        git tag "backup-$timestamp" 2>$null
        $commit = git log -n 1 --oneline
        Write-Host "  -> $($r.Name): $commit" -ForegroundColor Green
        Pop-Location
    }
}

# 2. Comprimir usando .NET para máxima velocidad
Write-Host "`n[2/3] Generando archivo ZIP maestro consolidado..." -ForegroundColor Yellow
Add-Type -AssemblyName System.IO.Compression.FileSystem

$tempZipFolder = Join-Path $env:TEMP "cubikar_backup_$timestamp"
if (Test-Path $tempZipFolder) { Remove-Item -Recurse -Force $tempZipFolder }
New-Item -ItemType Directory -Path $tempZipFolder | Out-Null

# Copiar carpetas excluyendo .git y respaldos
$exclude = @(".git", "respaldos", "_respaldos", "node_modules")

function Copy-Filtered($src, $dest) {
    Get-ChildItem -Path $src -Exclude $exclude | ForEach-Object {
        Copy-Item -Path $_.FullName -Destination $dest -Recurse -Force -Exclude $exclude
    }
}

New-Item -ItemType Directory -Path (Join-Path $tempZipFolder "01_Cubikar_Portal") | Out-Null
Copy-Filtered $cubikarDir (Join-Path $tempZipFolder "01_Cubikar_Portal")

New-Item -ItemType Directory -Path (Join-Path $tempZipFolder "02_Cubikar_Construccion") | Out-Null
Copy-Filtered $constDir (Join-Path $tempZipFolder "02_Cubikar_Construccion")

New-Item -ItemType Directory -Path (Join-Path $tempZipFolder "03_Cubikar_Arquitectura") | Out-Null
Copy-Filtered $arqDir (Join-Path $tempZipFolder "03_Cubikar_Arquitectura")

[System.IO.Compression.ZipFile]::CreateFromDirectory($tempZipFolder, $zipPath, [System.IO.Compression.CompressionLevel]::Optimal, $false)
Remove-Item -Recurse -Force $tempZipFolder

# 3. Copia directa
$zipDirect = Join-Path $respaldarDir "Cubikar_ECOSISTEMA_COMPLETO_ultimo.zip"
Copy-Item -Path $zipPath -Destination $zipDirect -Force

$sizeMB = [math]::Round((Get-Item $zipPath).Length / 1MB, 2)

Write-Host "`n[3/3] Respaldo finalizado con exito!" -ForegroundColor Green
Write-Host "  Archivo con fecha: $zipName ($sizeMB MB)" -ForegroundColor White
Write-Host "  Copia directa:     Cubikar_ECOSISTEMA_COMPLETO_ultimo.zip" -ForegroundColor White
Write-Host "  Ubicacion:         $respaldarDir`n" -ForegroundColor Cyan
