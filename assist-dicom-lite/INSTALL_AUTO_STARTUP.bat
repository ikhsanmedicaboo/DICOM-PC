@echo off
title DICOM Router Lite - Auto-Startup Installer
color 0A

echo ================================================================
echo   DICOM Router Lite - Auto-Startup Installer
echo   Powered by Assist.id - PT. Jaga Anugrah Giat Asa
echo ================================================================
echo.

REM Get the directory where this batch file is located
set "SCRIPT_DIR=%~dp0"
set "VBS_FILE=%SCRIPT_DIR%DICOM-Router-Lite.vbs"
set "STARTUP_FOLDER=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"

echo Current directory: %SCRIPT_DIR%
echo.

REM Check if VBS file exists
if not exist "%VBS_FILE%" (
    echo ERROR: DICOM-Router-Lite.vbs not found!
    echo.
    echo Please make sure this script is in the same folder as:
    echo - DICOM-Router-Lite.vbs
    echo - DICOM-Router-Lite-Win7.exe
    echo.
    pause
    exit /b 1
)

echo VBS launcher found: DICOM-Router-Lite.vbs
echo Startup folder: %STARTUP_FOLDER%
echo.

REM Check if already installed
if exist "%STARTUP_FOLDER%\DICOM-Router-Lite.vbs" (
    echo Auto-startup is already installed!
    echo.
    choice /C YN /M "Do you want to reinstall it"
    if errorlevel 2 (
        echo Installation cancelled.
        echo.
        pause
        exit /b 0
    )
    echo.
    echo Removing old installation...
    del "%STARTUP_FOLDER%\DICOM-Router-Lite.vbs"
)

echo Installing auto-startup...
echo.

REM Copy VBS file to Startup folder
copy "%VBS_FILE%" "%STARTUP_FOLDER%\DICOM-Router-Lite.vbs" >nul

if %errorlevel% equ 0 (
    echo ================================================================
    echo   AUTO-STARTUP INSTALLED SUCCESSFULLY!
    echo ================================================================
    echo.
    echo DICOM Router Lite will now start automatically when you log in.
    echo.
    echo Details:
    echo - Startup file: %STARTUP_FOLDER%\DICOM-Router-Lite.vbs
    echo - Runs silently in background (no console window)
    echo - DICOM listener will auto-start on port 11112
    echo.
    echo IMPORTANT:
    echo - Make sure .env file is configured with your credentials
    echo - The application will validate credentials on startup
    echo.
    echo To disable auto-startup:
    echo - Run UNINSTALL_AUTO_STARTUP.bat
    echo - Or delete: %STARTUP_FOLDER%\DICOM-Router-Lite.vbs
    echo.
    echo ================================================================
) else (
    echo ================================================================
    echo   INSTALLATION FAILED!
    echo ================================================================
    echo.
    echo Error: Could not copy file to Startup folder
    echo.
    echo Possible causes:
    echo 1. Insufficient permissions (try running as Administrator)
    echo 2. Startup folder does not exist
    echo 3. Disk is write-protected
    echo.
    echo Please contact Assist.id support if this problem persists
    echo Phone: 082112222500 ^| Email: info@assist.id
    echo.
    echo ================================================================
)

echo.
pause
