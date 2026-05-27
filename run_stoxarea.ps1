# Script untuk menjalankan Backend dan Frontend StoxArea secara bersamaan
# Jalankan dari folder STOXAREA: .\run_stoxarea.ps1

$ROOT = Split-Path -Parent $MyInvocation.MyCommand.Path
$BACKEND  = Join-Path $ROOT "stoxarea-backend"
$FRONTEND = Join-Path $ROOT "stoxarea-frontend"

Write-Host "=== STOXAREA LAUNCHER ===" -ForegroundColor Magenta
Write-Host "Root    : $ROOT"
Write-Host "Backend : $BACKEND"
Write-Host "Frontend: $FRONTEND"
Write-Host ""

# Validasi folder ada
if (-not (Test-Path $BACKEND)) {
    Write-Host "[ERROR] Folder stoxarea-backend tidak ditemukan!" -ForegroundColor Red
    exit 1
}
if (-not (Test-Path $FRONTEND)) {
    Write-Host "[ERROR] Folder stoxarea-frontend tidak ditemukan!" -ForegroundColor Red
    exit 1
}

Write-Host "--- Menjalankan Backend StoxArea (Uvicorn) ---" -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$BACKEND'; uvicorn app.main:app --reload --port 8000"

# Tunggu sebentar agar backend sempat start
Start-Sleep -Seconds 2

Write-Host "--- Menjalankan Frontend StoxArea (Next.js) ---" -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$FRONTEND'; npm run dev"

Write-Host ""
Write-Host "=== StoxArea sedang berjalan! ===" -ForegroundColor Yellow
Write-Host "Backend : http://localhost:8000"
Write-Host "Frontend: http://localhost:3000"
Write-Host "Swagger : http://localhost:8000/docs"
Write-Host ""
Write-Host "Tekan Ctrl+C untuk menghentikan launcher ini." -ForegroundColor Gray
Write-Host "(Window backend dan frontend tetap berjalan di terminal terpisah)"
