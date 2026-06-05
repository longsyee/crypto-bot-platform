# PowerShell script to start all platform services
# Run as Administrator for best results

$ProjectRoot = "C:\Users\Renaenys\Desktop\BOT"
Set-Location $ProjectRoot

# Create logs directory if not exists
New-Item -ItemType Directory -Force -Path "$ProjectRoot\logs" | Out-Null

# Helper to start a service in a new window
function Start-ServiceWindow {
    param(
        [string]$Name,
        [string]$Cwd,
        [string]$Command
    )
    Write-Host "Starting $Name..." -ForegroundColor Cyan
    $process = Start-Process -FilePath "powershell.exe" `
        -ArgumentList "-NoExit", "-Command", "Set-Location '$Cwd'; $Command" `
        -PassThru
    Write-Host "  → PID $($process.Id)" -ForegroundColor DarkGray
    return $process
}

Write-Host "========================================" -ForegroundColor Green
Write-Host "  Crypto Bot Platform - Service Startup" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

# Start Wallet Service
Start-ServiceWindow -Name "Wallet Service" -Cwd "$ProjectRoot\apps\wallet" -Command "pnpm run dev"
Start-Sleep -Seconds 3

# Start API Server
Start-ServiceWindow -Name "API Server" -Cwd "$ProjectRoot\apps\api" -Command "pnpm run dev"
Start-Sleep -Seconds 3

# Start Worker (this will auto-resume running bots via reconcile())
Start-ServiceWindow -Name "Bot Worker" -Cwd "$ProjectRoot\apps\worker" -Command "pnpm run dev"
Start-Sleep -Seconds 3

# Start Web Frontend
Start-ServiceWindow -Name "Web Frontend" -Cwd "$ProjectRoot\apps\web" -Command "pnpm run dev"

Write-Host ""
Write-Host "All services started!" -ForegroundColor Green
Write-Host "Worker will auto-resume any bots with status='running' from the database." -ForegroundColor Yellow
Write-Host "Press Ctrl+C in each window to stop individual services." -ForegroundColor DarkGray
