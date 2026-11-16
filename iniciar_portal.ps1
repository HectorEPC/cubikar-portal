# Servidor HTTP local zero-configuración para el Portal Central Cubikar y Ecosistema
# Permite ejecutar módulos ES6 (type="module") sin restricciones CORS

$ErrorActionPreference = "Stop"

$port = 3000
$tcp = $null
$started = $false

while (-not $started -and $port -lt 3050) {
    try {
        $tcp = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $port)
        $tcp.Start()
        $started = $true
    } catch {
        $tcp = $null
        $port++
    }
}

if (-not $started) {
    Write-Host "No se pudo enlazar ningún puerto entre 3000 y 3050." -ForegroundColor Red
    pause
    Exit
}

$url = "http://localhost:$port/"
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "       PORTAL CENTRAL CUBIKAR - SERVIDOR LOCAL ACTIVO     " -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  URL Portal: $url" -ForegroundColor Yellow
Write-Host "  Cubikar Construcción: http://localhost:$port/ADM_CONST/index.html" -ForegroundColor DarkYellow
Write-Host "  Cubikar Arquitectura: http://localhost:$port/ADM_ARQ/index.html" -ForegroundColor Cyan
Write-Host "  Modo: Módulos ES6 estándar (type='module') con SSO local" -ForegroundColor Gray
Write-Host "  Presiona Ctrl+C en esta consola para detener el servidor." -ForegroundColor Gray
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ""

Start-Process $url

$mimeMap = @{
    ".html" = "text/html; charset=utf-8"
    ".htm"  = "text/html; charset=utf-8"
    ".js"   = "application/javascript; charset=utf-8"
    ".mjs"  = "application/javascript; charset=utf-8"
    ".css"  = "text/css; charset=utf-8"
    ".json" = "application/json; charset=utf-8"
    ".svg"  = "image/svg+xml"
    ".png"  = "image/png"
    ".jpg"  = "image/jpeg"
    ".jpeg" = "image/jpeg"
    ".gif"  = "image/gif"
    ".mp4"  = "video/mp4"
    ".webm" = "video/webm"
    ".ico"  = "image/x-icon"
    ".woff" = "font/woff"
    ".woff2"= "font/woff2"
    ".ttf"  = "font/ttf"
}

$baseDir = $PSScriptRoot
if ([string]::IsNullOrEmpty($baseDir)) {
    $baseDir = (Get-Location).Path
}
$parentDir = [System.IO.Path]::GetFullPath([System.IO.Path]::Combine($baseDir, ".."))

try {
    while ($true) {
        $client = $tcp.AcceptTcpClient()
        $client.ReceiveTimeout = 10000
        $client.SendTimeout = 10000

        try {
            $stream = $client.GetStream()
            $reader = New-Object System.IO.StreamReader($stream, [System.Text.Encoding]::ASCII)
            $line = $reader.ReadLine()

            if (-not [string]::IsNullOrEmpty($line)) {
                $parts = $line.Split(' ')
                if ($parts.Length -ge 2) {
                    $rawPath = $parts[1].Split('?')[0].TrimStart('/')
                    if ([string]::IsNullOrEmpty($rawPath)) {
                        $rawPath = "index.html"
                    }
                    
                    # Decodificar espacios y caracteres URL (%20, etc.)
                    $decodedPath = [System.Uri]::UnescapeDataString($rawPath)

                    # Si la ruta apunta a aplicaciones hermanas (ADM_CONST, ADM_ARQ o Cubikar)
                    if ($decodedPath.StartsWith("ADM_CONST", [System.StringComparison]::OrdinalIgnoreCase) -or 
                        $decodedPath.StartsWith("ADM_ARQ", [System.StringComparison]::OrdinalIgnoreCase) -or
                        $decodedPath.StartsWith("Cubikar", [System.StringComparison]::OrdinalIgnoreCase) -or
                        $decodedPath.StartsWith("Cubukar", [System.StringComparison]::OrdinalIgnoreCase)) {
                        $filePath = [System.IO.Path]::GetFullPath([System.IO.Path]::Combine($parentDir, $decodedPath))
                    } else {
                        $filePath = [System.IO.Path]::GetFullPath([System.IO.Path]::Combine($baseDir, $decodedPath))
                    }

                    # Protección y validación de archivo existente
                    if ($filePath.StartsWith($parentDir, [System.StringComparison]::OrdinalIgnoreCase) -and [System.IO.File]::Exists($filePath)) {
                        $bytes = [System.IO.File]::ReadAllBytes($filePath)
                        $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
                        $mime = if ($mimeMap.ContainsKey($ext)) { $mimeMap[$ext] } else { "application/octet-stream" }
                        
                        $header = "HTTP/1.1 200 OK`r`nContent-Type: $mime`r`nContent-Length: $($bytes.Length)`r`nAccept-Ranges: bytes`r`nAccess-Control-Allow-Origin: *`r`nCache-Control: no-cache, no-store, must-revalidate`r`nPragma: no-cache`r`nExpires: 0`r`nConnection: close`r`n`r`n"
                        $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($header)
                        $stream.Write($headerBytes, 0, $headerBytes.Length)
                        $stream.Write($bytes, 0, $bytes.Length)
                    } else {
                        $notFoundBody = [System.Text.Encoding]::UTF8.GetBytes("404 No encontrado: $decodedPath")
                        $header = "HTTP/1.1 404 Not Found`r`nContent-Type: text/plain; charset=utf-8`r`nContent-Length: $($notFoundBody.Length)`r`nConnection: close`r`n`r`n"
                        $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($header)
                        $stream.Write($headerBytes, 0, $headerBytes.Length)
                        $stream.Write($notFoundBody, 0, $notFoundBody.Length)
                    }
                }
            }

            $stream.Flush()
            $stream.Close()
        } catch {
            # Ignorar timeouts de conexiones especulativas de Chrome
        } finally {
            $client.Close()
        }
    }
} finally {
    if ($tcp -ne $null) {
        $tcp.Stop()
    }
}
