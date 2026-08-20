@echo off
setlocal EnableExtensions

title GoTrader Local Launcher
cd /d "%~dp0"

set "GOTRADER_ROOT=%CD%"
set "GOTRADER_URL=http://127.0.0.1:5173/dashboard"
set "GOTRADER_LOG=%GOTRADER_ROOT%\.gotrader\gotrader-supervisor.log"
set "GOTRADER_ACTION=%~1"
if not defined GOTRADER_ACTION set "GOTRADER_ACTION=start"

if /I "%GOTRADER_ACTION%"=="status" goto STATUS
if /I "%GOTRADER_ACTION%"=="stop" goto STOP
if /I "%GOTRADER_ACTION%"=="restart" goto RESTART
if /I not "%GOTRADER_ACTION%"=="start" goto USAGE

:START
echo.
echo ============================================================
echo  GoTrader - starting local research systems
echo ============================================================
echo  Root: %GOTRADER_ROOT%
echo  App:  %GOTRADER_URL%
echo.

if not exist "%GOTRADER_ROOT%\package.json" (
  echo ERROR: package.json was not found in:
  echo %GOTRADER_ROOT%
  goto FAILED
)

where node.exe >nul 2>&1
if errorlevel 1 (
  echo ERROR: Node.js is not installed or is not available on PATH.
  echo Install Node.js LTS, reopen PowerShell, and run this file again.
  goto FAILED
)

where npm.cmd >nul 2>&1
if errorlevel 1 (
  echo ERROR: npm.cmd is not available on PATH.
  echo Reinstall Node.js LTS, reopen PowerShell, and run this file again.
  goto FAILED
)

if not exist "%GOTRADER_ROOT%\.gotrader" mkdir "%GOTRADER_ROOT%\.gotrader"

if not exist "%GOTRADER_ROOT%\node_modules\.bin\vite.cmd" (
  echo Node dependencies are missing. Installing the locked dependency set...
  if exist "%GOTRADER_ROOT%\package-lock.json" (
    call npm.cmd ci
  ) else (
    call npm.cmd install
  )
  if errorlevel 1 (
    echo ERROR: Node dependency installation failed.
    goto FAILED
  )
)

rem Reuse a healthy existing stack without opening a second supervisor process
rem against the same redirected log file.
powershell.exe -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -Command "try { $response = Invoke-WebRequest -UseBasicParsing -Uri '%GOTRADER_URL%' -TimeoutSec 2; if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) { exit 0 }; exit 1 } catch { exit 1 }" >nul 2>&1
if not errorlevel 1 (
  echo Existing GoTrader app detected. Reusing the healthy local stack.
  goto READY
)

echo [%DATE% %TIME%] Launcher requested start.>>"%GOTRADER_LOG%"
echo Starting MT5 read-only upstream, wrapper, LLM bridge, Vite app, and supervisor...

rem The launcher opens the browser after the app health check, so the
rem background supervisor must not open a duplicate browser window.
set "GOTRADER_OPEN_BROWSER=false"
start "GoTrader Supervisor" /min cmd.exe /d /s /c "npm.cmd run gotrader:start >> .gotrader\gotrader-supervisor.log 2>&1"

set /a GOTRADER_WAIT_COUNT=0
:WAIT_FOR_APP
powershell.exe -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -Command "try { $response = Invoke-WebRequest -UseBasicParsing -Uri '%GOTRADER_URL%' -TimeoutSec 2; if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) { exit 0 }; exit 1 } catch { exit 1 }" >nul 2>&1
if not errorlevel 1 goto READY

set /a GOTRADER_WAIT_COUNT+=1
if %GOTRADER_WAIT_COUNT% GEQ 60 goto START_TIMEOUT

if %GOTRADER_WAIT_COUNT% EQU 1 echo Waiting for GoTrader services...
if %GOTRADER_WAIT_COUNT% EQU 15 echo Still starting. MT5 and Python initialization can take a little longer...
if %GOTRADER_WAIT_COUNT% EQU 30 echo Checking service recovery and startup logs...
powershell.exe -NoLogo -NoProfile -NonInteractive -Command "Start-Sleep -Seconds 1" >nul 2>&1
goto WAIT_FOR_APP

:READY
echo.
echo GoTrader is available.
call npm.cmd run gotrader:status
echo.
echo Opening %GOTRADER_URL%
start "" "%GOTRADER_URL%"
echo.
echo Startup log: %GOTRADER_LOG%
echo To stop tracked services later, run:
echo   START-GOTRADER.CMD stop
powershell.exe -NoLogo -NoProfile -NonInteractive -Command "Start-Sleep -Seconds 1" >nul 2>&1
exit /b 0

:START_TIMEOUT
echo.
echo ERROR: GoTrader did not become available on port 5173 within 60 seconds.
echo.
call npm.cmd run gotrader:status
echo.
echo Supervisor log: %GOTRADER_LOG%
if exist "%GOTRADER_LOG%" (
  echo.
  echo Last supervisor log lines:
  powershell.exe -NoLogo -NoProfile -NonInteractive -Command "Get-Content -LiteralPath '%GOTRADER_LOG%' -Tail 30"
)
goto FAILED

:STATUS
cd /d "%GOTRADER_ROOT%"
call npm.cmd run gotrader:status
exit /b %ERRORLEVEL%

:STOP
cd /d "%GOTRADER_ROOT%"
echo Stopping GoTrader tracked local services...
call npm.cmd run gotrader:stop
exit /b %ERRORLEVEL%

:RESTART
cd /d "%GOTRADER_ROOT%"
echo Restarting GoTrader tracked local services...
call npm.cmd run gotrader:stop
if errorlevel 1 (
  echo WARNING: Stop reported an error. Startup will still attempt fail-safe recovery.
)
set "GOTRADER_ACTION=start"
goto START

:USAGE
echo Usage:
echo   START-GOTRADER.CMD
echo   START-GOTRADER.CMD start
echo   START-GOTRADER.CMD status
echo   START-GOTRADER.CMD restart
echo   START-GOTRADER.CMD stop
exit /b 2

:FAILED
echo.
echo GoTrader startup did not complete.
echo Review the message above and:
echo   %GOTRADER_LOG%
echo.
pause
exit /b 1
