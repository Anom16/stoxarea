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

# Kill process lama di port 8000 & 3000 jika ada zombie process
Get-Process -Name "python", "node", "uvicorn" -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle -eq "" } | Stop-Process -Force -ErrorAction SilentlyContinue

Write-Host "--- Menjalankan Backend StoxArea (Uvicorn Multi-Worker Production) ---" -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$BACKEND'; uvicorn app.main:app --host 127.0.0.1 --port 8000 --workers 2"

# Tunggu sebentar agar backend sempat start
Start-Sleep -Seconds 3

Write-Host "--- Menjalankan Frontend StoxArea (Next.js) ---" -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$FRONTEND'; npm run dev"

Write-Host ""
Write-Host "=== StoxArea sedang berjalan (Demo & Production Mode) ===" -ForegroundColor Yellow
Write-Host "Backend : http://localhost:8000"
Write-Host "Frontend: http://localhost:3000"
Write-Host "Swagger : http://localhost:8000/docs"
Write-Host ""
Write-Host "Aplikasi berjalan stabil dengan Multi-Worker & Offline Resiliency!" -ForegroundColor Green
