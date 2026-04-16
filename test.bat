@echo off
echo ====================================
echo DICOM Router - Test Connections
echo ====================================
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ERROR: Node.js is not installed!
    pause
    exit /b 1
)

:menu
echo.
echo Select test to run:
echo.
echo 1. Test DICOM Listener Connection
echo 2. Test API Connection
echo 3. Test Both
echo 4. Exit
echo.
set /p choice="Enter your choice (1-4): "

if "%choice%"=="1" goto test_dicom
if "%choice%"=="2" goto test_api
if "%choice%"=="3" goto test_both
if "%choice%"=="4" goto end
goto menu

:test_dicom
echo.
echo Testing DICOM Listener...
echo ====================================
node tests\test-dicom-connection.js
pause
goto menu

:test_api
echo.
echo Testing API Connection...
echo ====================================
node tests\test-api-connection.js
pause
goto menu

:test_both
echo.
echo Testing DICOM Listener...
echo ====================================
node tests\test-dicom-connection.js
echo.
echo.
echo Testing API Connection...
echo ====================================
node tests\test-api-connection.js
pause
goto menu

:end
echo.
echo Goodbye!
exit /b 0
