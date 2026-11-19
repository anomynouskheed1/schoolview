$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "========================================" -ForegroundColor Blue
Write-Host "       SCHOOLVIEW WEBCAM PUBLISHER"
Write-Host "========================================" -ForegroundColor Blue
Write-Host ""

# Project paths
$projectRoot = "C:\dev\schoolview"
$apiEnvFile = Join-Path $projectRoot "apps\api\.env"

# Verify FFmpeg
if (-not (Get-Command ffmpeg -ErrorAction SilentlyContinue)) {
    Write-Host "ERROR: FFmpeg was not found." -ForegroundColor Red
    exit 1
}

# Read publishing secret without displaying it
if (-not (Test-Path $apiEnvFile)) {
    Write-Host "ERROR: API environment file not found." -ForegroundColor Red
    exit 1
}

$secretLine = Get-Content $apiEnvFile |
    Where-Object { $_ -match '^STREAM_PUBLISH_SECRET=' } |
    Select-Object -First 1

if (-not $secretLine) {
    Write-Host "ERROR: STREAM_PUBLISH_SECRET is missing from apps/api/.env." -ForegroundColor Red
    exit 1
}

$secret = ($secretLine -replace '^STREAM_PUBLISH_SECRET=', '').Trim().Trim('"').Trim("'")

if ($secret.Length -lt 32 -or $secret -match '^REPLACE_WITH') {
    Write-Host "ERROR: Configure a real publishing secret of at least 32 characters." -ForegroundColor Red
    exit 1
}

# Encode credentials for the RTSP URL
$encodedSecret = [uri]::EscapeDataString($secret)

# MediaMTX publishing address
$streamUrl = "rtsp://schoolview-publisher:$encodedSecret@127.0.0.1:8554/sunrise-test-001"

Write-Host "Camera: Integrated Camera" -ForegroundColor Cyan
Write-Host "School: Sunrise School" -ForegroundColor Cyan
Write-Host "Stream: sunrise-test-001" -ForegroundColor Cyan
Write-Host ""
Write-Host "Starting webcam capture..." -ForegroundColor Green
Write-Host "Press Q in the FFmpeg window to stop publishing." -ForegroundColor Yellow
Write-Host ""

# Capture webcam and publish using RTSP
& ffmpeg `
    -hide_banner `
    -f dshow `
    -framerate 20 `
    -video_size 1280x720 `
    -i "video=Integrated Camera" `
    -an `
    -c:v libx264 `
    -preset ultrafast `
    -tune zerolatency `
    -pix_fmt yuv420p `
    -g 40 `
    -f rtsp `
    -rtsp_transport tcp `
    $streamUrl

Write-Host ""
Write-Host "Webcam publishing stopped." -ForegroundColor Yellow