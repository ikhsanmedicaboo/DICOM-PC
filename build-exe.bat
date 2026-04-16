@echo off
title Build DICOM Router - Assist.id
color 0A

echo ================================================================
echo   DICOM Router - Windows Executable Builder
echo   Powered by Assist.id
echo ================================================================
echo.

echo [1/4] Installing dependencies...
call npm install
if errorlevel 1 (
    echo.
    echo ERROR: Failed to install dependencies
    pause
    exit /b 1
)

echo.
echo [2/4] Installing pkg globally...
call npm install -g pkg@5.8.0
if errorlevel 1 (
    echo.
    echo WARNING: Could not install pkg globally, trying local...
    call npm install pkg@5.8.0 --save-dev
)

echo.
echo [3/4] Building executable...
call npm run build:full
if errorlevel 1 (
    echo.
    echo ERROR: Build failed
    pause
    exit /b 1
)

echo.
echo [4/4] Build completed!
echo.
echo ================================================================
echo   EXECUTABLE CREATED SUCCESSFULLY!
echo ================================================================
echo.
echo Output location: dist\DICOM-Router-Win7.exe
echo.
echo You can now distribute the entire "dist" folder
echo Users can run START_DICOM_ROUTER.bat to start the application
echo.
echo ================================================================
echo.

pause
