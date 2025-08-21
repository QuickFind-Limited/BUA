Write-Host "CUA Clean App Restoration" -ForegroundColor Green
$dest = Read-Host "Enter destination (or press Enter for C:\restored-cua)"  
if ([string]::IsNullOrWhiteSpace($dest)) { $dest = "C:\restored-cua" }
Write-Host "Restoring to: $dest" -ForegroundColor Yellow
New-Item -ItemType Directory -Path $dest -Force | Out-Null
Copy-Item -Path "electron-app" -Destination "$dest\" -Recurse -Force
Set-Location "$dest\electron-app"
Write-Host "Installing dependencies..." -ForegroundColor Cyan
npm install --legacy-peer-deps
Write-Host "Installing Playwright..." -ForegroundColor Cyan
npx playwright install chromium
Write-Host "Building TypeScript..." -ForegroundColor Cyan
npm run build
if (!(Test-Path ".env")) {
    "ANTHROPIC_API_KEY=your-api-key-here" | Out-File ".env" -Encoding UTF8
    Write-Host "Created .env file - please add your API key" -ForegroundColor Yellow
}
Write-Host "`nComplete! Run:" -ForegroundColor Green
Write-Host "  cd $dest\electron-app" -ForegroundColor White
Write-Host "  npm run dev" -ForegroundColor White
