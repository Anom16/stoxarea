# Script untuk menjalankan Backend dan Frontend StoxArea secara bersamaan

Write-Host "--- Menjalankan Backend StoxArea (Uvicorn) ---" -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd stoxarea-backend; uvicorn app.main:app --reload --port 8000"

Write-Host "--- Menjalankan Frontend StoxArea (Next.js) ---" -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd stoxarea-frontend; npm run dev"

Write-Host "`nStoxArea sedang berjalan!" -ForegroundColor Yellow
Write-Host "Backend : http://localhost:8000"
Write-Host "Frontend: http://localhost:3000 (atau 3001)"
Write-Host "Swagger : http://localhost:8000/docs"
