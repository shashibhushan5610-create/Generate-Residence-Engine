@echo off
:: ============================================================
:: run.bat — Plot Configuration Dashboard Launcher
:: ArchitectOS · Architect-grade Layout Generation Software
:: ============================================================
:: Opens the Plot Configuration Dashboard in your default browser.
:: No installation required. Zero dependencies.
:: ============================================================

title ArchitectOS — Plot Configuration Dashboard

echo.
echo  ██████████████████████████████████████████████████
echo  ██                                              ██
echo  ██     ArchitectOS — Plot Config Dashboard      ██
echo  ██     Architect-grade UI Prototype v1.0.0      ██
echo  ██                                              ██
echo  ██████████████████████████████████████████████████
echo.
echo  Launching dashboard in your default browser...
echo  Location: %~dp0index.html
echo.

:: Ensure residential zoning rules wrapper is generated
echo  Setting up local rule files...
echo  window.RESIDENTIAL_ZONING_RULES = > "%~dp0residential_zoning_rules.js"
type "%~dp0residential_zoning_rules.json" >> "%~dp0residential_zoning_rules.js"

:: Get the absolute path to index.html
set "DASHBOARD=%~dp0index.html"

:: Open in browser explicitly to avoid Notepad
start msedge "%DASHBOARD%" || start chrome "%DASHBOARD%" || start "" "%DASHBOARD%"

echo  Dashboard opened successfully.
echo  Close this window at any time — the browser remains open.
echo.
pause
