@echo off
echo ====================================
echo DICOM Router - SatuSehat Integration
echo ====================================
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ERROR: Node.js is not installed!
    echo.
    echo Please install Node.js v12.22.12 from:
    echo https://nodejs.org/download/release/v12.22.12/
    echo.
    pause
    exit /b 1
)

REM Display Node.js version
echo Node.js version:
node --version
echo.

REM Check if .env file exists
if not exist .env (
    echo WARNING: .env file not found!
    echo.
    echo Creating .env from .env.example...
    copy .env.example .env
    echo.
    echo Please edit .env file with your configuration before continuing.
    echo.
    notepad .env
    echo.
    echo Press any key to continue after saving .env...
    pause >nul
)

REM Check if node_modules exists
if not exist node_modules (
    echo Installing dependencies...
    echo This may take a few minutes on first run...
    echo.
    call npm install
    if %errorlevel% neq 0 (
        echo.
        echo ERROR: Failed to install dependencies!
        echo Please check the error messages above.
        pause
        exit /b 1
    )
)

REM Create storage directories if they don't exist
if not exist storage\dicom mkdir storage\dicom
if not exist storage\logs mkdir storage\logs

echo.
echo ====================================
echo Starting DICOM Router...
echo ====================================
echo.
echo Web Dashboard will be available at:
echo http://localhost:3000
echo.
echo Press Ctrl+C to stop the server
echo ====================================
echo.

REM Start the application
node backend\server.js

REM If server stops, pause to show error
pause
