@echo off
title CashFlow Tracker
color 0F

echo.
echo  =====================================================
echo    CashFlow Tracker - starting up...
echo  =====================================================
echo.
echo  Your browser will open automatically in a few seconds.
echo.
echo  To stop the app:
echo    Close this window, OR press Ctrl + C.
echo.
echo  =====================================================
echo.

cd /d "C:\Users\husse\Downloads\Cashflow app"

REM Verify Node.js is installed
where node >nul 2>nul
if errorlevel 1 (
  color 0C
  echo.
  echo  ERROR: Node.js is not installed or not on your PATH.
  echo  Download it from https://nodejs.org and re-run this.
  echo.
  pause
  exit /b 1
)

REM First-time install (no node_modules yet)
if not exist "node_modules" (
  echo  First-time setup: installing dependencies...
  echo  This will take 30-60 seconds, then will not run again.
  echo.
  call npm.cmd install
  echo.
)

REM Open the browser in 5 seconds (gives Vite time to boot)
start "" /min cmd /c "timeout /t 5 /nobreak >nul && start http://localhost:5173"

REM Start the Vite dev server (foreground, so closing window stops the app)
call npm.cmd run dev

REM If we got here, the server stopped — pause briefly so user can read errors
echo.
echo  CashFlow Tracker has stopped.
timeout /t 3 /nobreak >nul
