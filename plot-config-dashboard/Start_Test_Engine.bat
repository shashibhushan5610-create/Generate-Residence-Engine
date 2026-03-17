@echo off
title ArchitectOS Advanced Test Engine Setup
color 0B
echo ===================================================
echo     ArchitectOS - Advanced Test Engine Server
echo ===================================================
echo.
echo The Advanced Test Engine requires a local web server 
echo to load dynamic React components securely.
echo.
echo Scanning for available servers...

:: Try Python 3 first
python --version >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] Python found. Starting server on port 8000...
    timeout /t 2 /nobreak >nul
    start http://localhost:8000/test-advanced.html
    python -m http.server 8000
    exit
)

:: Try Node.js npx serve
npx -v >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] Node.js found. Starting server on port 3000...
    timeout /t 2 /nobreak >nul
    start http://localhost:3000/test-advanced.html
    npx serve .
    exit
)

:: Try PHP
php -v >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] PHP found. Starting server on port 8000...
    timeout /t 2 /nobreak >nul
    start http://localhost:8000/test-advanced.html
    php -S localhost:8000
    exit
)

color 0C
echo.
echo [ERROR] No suitable web server found! 
echo To view the Advanced Test Engine, you must have either:
echo   1. Python (python.org)
echo   2. Node.js (nodejs.org)
echo.
echo Please install one of these, restart your computer, and run this file again.
pause
