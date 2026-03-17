@echo off
color 0A
echo --------------------------------------------------------
echo Recreating residential_zoning_rules.js from JSON data...
echo --------------------------------------------------------
echo.
echo window.RESIDENTIAL_ZONING_RULES = > "%~dp0residential_zoning_rules.js"
type "%~dp0residential_zoning_rules.json" >> "%~dp0residential_zoning_rules.js"
echo.
echo Successfully recreated residential_zoning_rules.js!
echo You can now refresh the browser dashboard.
echo.
pause
