@echo off
setlocal
cd /d "%~dp0"
call npm.cmd run gotrader:stop
if errorlevel 1 pause
