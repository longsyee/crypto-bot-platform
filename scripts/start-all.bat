@echo off
echo ==========================================
echo   Crypto Bot Platform - Service Startup
echo ==========================================
echo.

set ROOT=C:\Users\Renaenys\Desktop\BOT

:: Start Wallet Service
echo [1/4] Starting Wallet Service...
start "Wallet Service" powershell -NoExit -Command "Set-Location '%ROOT%\apps\wallet'; pnpm run dev"
timeout /t 3 /nobreak >nul

:: Start API Server
echo [2/4] Starting API Server...
start "API Server" powershell -NoExit -Command "Set-Location '%ROOT%\apps\api'; pnpm run dev"
timeout /t 3 /nobreak >nul

:: Start Worker (auto-resumes running bots!)
echo [3/4] Starting Bot Worker...
start "Bot Worker" powershell -NoExit -Command "Set-Location '%ROOT%\apps\worker'; pnpm run dev"
timeout /t 3 /nobreak >nul

:: Start Web Frontend
echo [4/4] Starting Web Frontend...
start "Web Frontend" powershell -NoExit -Command "Set-Location '%ROOT%\apps\web'; pnpm run dev"

echo.
echo ==========================================
echo   All services started successfully!
echo ==========================================
echo.
echo NOTE: The worker automatically scans the database
echo for bots with status=running and resumes them.
echo.
pause
