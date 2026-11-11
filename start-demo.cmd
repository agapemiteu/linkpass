@echo off
rem Starts the LinkPass sandbox demo: checks the team06 app, opens a tunnel, opens the browser.
rem Needs docs\team06.yml (kubeconfig, not in git) and kubectl at %USERPROFILE%\bin\kubectl.exe.
cd /d "%~dp0"
set KUBECONFIG=%~dp0docs\team06.yml
set KUBECTL=%USERPROFILE%\bin\kubectl.exe

echo Checking the LinkPass app on the cluster...
"%KUBECTL%" get pods --request-timeout=20s
if errorlevel 1 (
  echo.
  echo Could not reach the cluster. Check your internet, wait a minute and run this again.
  pause
  exit /b 1
)

echo.
echo Opening http://localhost:8080 . Keep this window open during the demo.
start "" http://localhost:8080
:loop
"%KUBECTL%" port-forward svc/app 8080:80
echo Tunnel dropped, reconnecting...
timeout /t 2 >nul
goto loop
