# Switch ke DESAIN LAMA (kotak-kotak / original)
Write-Host "Switching to DESAIN LAMA (kotak-kotak)..." -ForegroundColor Yellow
Copy-Item "stoxarea-frontend/src/app/globals.old.css" "stoxarea-frontend/src/app/globals.css" -Force
Write-Host "DONE! Restart npm run dev dan Hard Reload browser (Ctrl+Shift+R)" -ForegroundColor Green
