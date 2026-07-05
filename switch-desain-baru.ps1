# Switch ke DESAIN BARU (premium dark mode)
Write-Host "Switching to DESAIN BARU (premium dark mode)..." -ForegroundColor Cyan
Copy-Item "stoxarea-frontend/src/app/globals.new.css" "stoxarea-frontend/src/app/globals.css" -Force
Write-Host "DONE! Restart npm run dev dan Hard Reload browser (Ctrl+Shift+R)" -ForegroundColor Green
