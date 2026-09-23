# ============================================
# FightHub — Lightweight PowerShell Web Server
# Serves FightHub files over HTTP using HttpListener
# ============================================

$port = 8000
$localPath = Get-Item .
$url = "http://localhost:$port/"

# Create Listener
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($url)

try {
    $listener.Start()
    Write-Host "=============================================" -ForegroundColor Green
    Write-Host " FightHub Local Web Server is Running!" -ForegroundColor Green
    Write-Host " Serving files from: $localPath" -ForegroundColor White
    Write-Host " Access the site at: $url" -ForegroundColor Cyan
    Write-Host " Press [Ctrl+C] to stop the server." -ForegroundColor Yellow
    Write-Host "=============================================" -ForegroundColor Green
    
    # Open browser automatically
    Start-Process $url

    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        # Get relative path of requested file
        $rawPath = $request.Url.LocalPath
        if ($rawPath -eq "/") {
            $rawPath = "/index.html"
        }

        # Decode path
        $rawPath = [uri]::UnescapeDataString($rawPath)
        $filePath = Join-Path $localPath $rawPath

        # Check if file exists
        if (Test-Path $filePath -PathType Leaf) {
            # Determine content type based on extension
            $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
            $contentType = "application/octet-stream"
            switch ($ext) {
                ".html" { $contentType = "text/html; charset=utf-8" }
                ".css"  { $contentType = "text/css; charset=utf-8" }
                ".js"   { $contentType = "application/javascript; charset=utf-8" }
                ".png"  { $contentType = "image/png" }
                ".jpg"  { $contentType = "image/jpeg" }
                ".jpeg" { $contentType = "image/jpeg" }
                ".gif"  { $contentType = "image/gif" }
                ".svg"  { $contentType = "image/svg+xml" }
                ".ico"  { $contentType = "image/x-icon" }
                ".json" { $contentType = "application/json; charset=utf-8" }
            }

            $response.ContentType = $contentType
            $bytes = [System.IO.File]::ReadAllBytes($filePath)
            $response.ContentLength64 = $bytes.Length
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
        } else {
            # File Not Found
            $response.StatusCode = 404
            $errBytes = [System.Text.Encoding]::UTF8.GetBytes("404 - File Not Found: $rawPath")
            $response.ContentType = "text/plain"
            $response.ContentLength64 = $errBytes.Length
            $response.OutputStream.Write($errBytes, 0, $errBytes.Length)
        }
        $response.Close()
    }
} catch {
    Write-Error $_
} finally {
    $listener.Stop()
}
