# Windows Auto-Startup Setup Script
# Run this in PowerShell as Administrator to create a scheduled task
# that starts all platform services automatically when you log in.

$TaskName = "CryptoBotPlatform"
$ScriptPath = "C:\Users\Renaenys\Desktop\BOT\scripts\start-all.bat"
$Description = "Auto-start Crypto Bot Platform services (API, Worker, Wallet, Web)"

# Check if already exists
$existing = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($existing) {
    Write-Host "Task '$TaskName' already exists. Removing old version..." -ForegroundColor Yellow
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
}

# Create the scheduled task — runs at user logon
$Action = New-ScheduledTaskAction -Execute $ScriptPath
$Trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$Settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable
$Principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -RunLevel Highest

Register-ScheduledTask `
    -TaskName $TaskName `
    -Action $Action `
    -Trigger $Trigger `
    -Settings $Settings `
    -Principal $Principal `
    -Description $Description `
    -Force

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Auto-start task created successfully!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Task Name: $TaskName" -ForegroundColor Cyan
Write-Host "Trigger:   At logon ($env:USERNAME)" -ForegroundColor Cyan
Write-Host "Script:    $ScriptPath" -ForegroundColor Cyan
Write-Host ""
Write-Host "What happens after a power outage:" -ForegroundColor Yellow
Write-Host "  1. Windows boots" -ForegroundColor White
Write-Host "  2. You log in" -ForegroundColor White
Write-Host "  3. This task auto-runs start-all.bat" -ForegroundColor White
Write-Host "  4. Worker starts → scans DB for running bots" -ForegroundColor White
Write-Host "  5. All bots with status='running' auto-resume" -ForegroundColor White
Write-Host ""
Write-Host "To test now: run .\scripts\start-all.bat" -ForegroundColor DarkGray
Write-Host "To remove:   Unregister-ScheduledTask -TaskName '$TaskName' -Confirm:`$false" -ForegroundColor DarkGray
