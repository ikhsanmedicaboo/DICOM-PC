@echo off
REM DICOM Router - Complete API Test Script for Windows
REM Tests all endpoints with your credentials

setlocal EnableDelayedExpansion

set BASE_URL=http://localhost:3001
set HOSPITAL_ID=678484fe219a19629b962377
set API_KEY=Njc4NDg0ZmUyMTlhMTk2MjliOTYyMzc3OkJpc21pbGxhaFJhZGlvbG9neTEyMyE

echo ================================================================
echo     DICOM Router - API Endpoint Test Suite
echo     Testing all endpoints with your credentials
echo ================================================================
echo.

REM Check if curl is available
where curl >nul 2>nul
if %errorlevel% neq 0 (
    echo ERROR: curl is not installed or not in PATH!
    echo.
    echo Please install curl or use Git Bash to run the .sh version
    pause
    exit /b 1
)

echo [0] Testing Health Check...
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
curl -X GET %BASE_URL%/health
echo.
echo.
timeout /t 1 >nul

echo [1] Getting Configuration...
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
curl -X GET %BASE_URL%/api/config
echo.
echo.
timeout /t 1 >nul

echo [2] Validating Credentials...
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
curl -X POST %BASE_URL%/api/auth/validate ^
  -H "Content-Type: application/json" ^
  -d "{\"hospital_id\":\"%HOSPITAL_ID%\",\"api_key\":\"%API_KEY%\"}"
echo.
echo.
timeout /t 1 >nul

echo [3] Testing Auto Login...
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
curl -X POST %BASE_URL%/api/auth/auto-login ^
  -H "Content-Type: application/json"
echo.
echo.
timeout /t 1 >nul

echo [4] Testing API Connection...
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
curl -X POST %BASE_URL%/api/validate/api ^
  -H "Content-Type: application/json"
echo.
echo.
timeout /t 1 >nul

echo [5] Validating Auth Configuration...
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
curl -X POST %BASE_URL%/api/validate/auth ^
  -H "Content-Type: application/json"
echo.
echo.
timeout /t 1 >nul

echo [6] Getting DICOM Status...
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
curl -X GET %BASE_URL%/api/dicom/status
echo.
echo.
timeout /t 1 >nul

echo [7] Starting DICOM Listener...
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
curl -X POST %BASE_URL%/api/dicom/start ^
  -H "Content-Type: application/json"
echo.
echo.
timeout /t 2 >nul

echo [8] Getting DICOM Status (After Start)...
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
curl -X GET %BASE_URL%/api/dicom/status
echo.
echo.
timeout /t 1 >nul

echo [9] Starting API Forwarder...
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
curl -X POST %BASE_URL%/api/validate/forwarder/start ^
  -H "Content-Type: application/json"
echo.
echo.
timeout /t 1 >nul

echo [10] Getting Overall System Status...
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
curl -X GET %BASE_URL%/api/status
echo.
echo.
timeout /t 1 >nul

echo [11] Getting Recent Transfers...
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
curl -X GET "%BASE_URL%/api/transfers?limit=10"
echo.
echo.
timeout /t 1 >nul

echo [12] Getting Recent Events...
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
curl -X GET "%BASE_URL%/api/events?limit=10"
echo.
echo.
timeout /t 1 >nul

echo [13] Getting Recent API Logs...
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
curl -X GET "%BASE_URL%/api/logs?limit=10"
echo.
echo.

echo ================================================================
echo                     TEST SUMMARY
echo ================================================================
echo.
echo All endpoints tested!
echo.
echo Next steps:
echo   1. Check if authentication passed (look for "success": true)
echo   2. Verify DICOM listener is running (status should show "running": true)
echo   3. Check system status endpoint for overall health
echo.
echo If you see error messages:
echo   - Check that the server is running on port 3001
echo   - Verify your credentials in .env file
echo   - Check storage/logs/app.log for detailed errors
echo.
echo To view detailed logs:
echo   type storage\logs\app.log
echo.
echo ================================================================
echo                     Test Complete!
echo ================================================================
echo.
pause
