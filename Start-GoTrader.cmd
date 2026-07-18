@echo off
setlocal
cd /d "%~dp0"
if not exist ".gotrader" mkdir ".gotrader"
start "GoTrader Supervisor" /min cmd.exe /d /s /c "npm.cmd run gotrader:start >> .gotrader\gotrader-supervisor.log 2>&1"
exit /b 0
