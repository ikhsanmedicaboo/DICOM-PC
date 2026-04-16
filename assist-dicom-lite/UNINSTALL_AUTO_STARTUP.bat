@echo off
title DICOM Router Lite - Auto-Startup Uninstaller
color 0C

echo ================================================================
echo   DICOM Router Lite - Auto-Startup Uninstaller
echo   Powered by Assist.id - PT. Jaga Anugrah Giat Asa
echo ================================================================
echo.

set "STARTUP_FOLDER=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "STARTUP_FILE=%STARTUP_FOLDER%\DICOM-Router-Lite.vbs"

echo Startup folder: %STARTUP_FOLDER%
echo.

REM Check if installed
if not exist "%STARTUP_FILE%" (
    echo Auto-startup is NOT currently installed.
    echo.
    echo Nothing to uninstall.
    echo.
    pause
    exit /b 0
)

echo Auto-startup is currently installed.
echo File: %STARTUP_FILE%
echo.

choice /C YN /M "Are you sure you want to remove auto-startup"
if errorlevel 2 (
    echo.
    echo Uninstall cancelled.
    echo.
    pause
    exit /b 0
)

echo.
echo Removing auto-startup...

del "%STARTUP_FILE%"

if %errorlevel% equ 0 (
    echo.
    echo ================================================================
    echo   AUTO-STARTUP REMOVED SUCCESSFULLY!
    echo ================================================================
    echo.
    echo DICOM Router Lite will no longer start automatically.
    echo.
    echo To start manually:
    echo - Double-click START_LITE.bat (interactive mode)
    echo - Double-click DICOM-Router-Lite.vbs (silent mode)
    echo.
    echo To reinstall auto-startup:
    echo - Run INSTALL_AUTO_STARTUP.bat
    echo.
    echo ================================================================
) else (
    echo.
    echo ================================================================
    echo   UNINSTALL FAILED!
    echo ================================================================
    echo.
    echo Error: Could not delete startup file
    echo.
    echo Possible causes:
    echo 1. Insufficient permissions (try running as Administrator)
    echo 2. File is in use (close DICOM Router Lite first)
    echo.
    echo Manual removal:
    echo 1. Press Win+R
    echo 2. Type: shell:startup
    echo 3. Press Enter
    echo 4. Delete: DICOM-Router-Lite.vbs
    echo.
    echo ================================================================
)

echo.
pause
