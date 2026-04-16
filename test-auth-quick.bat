@echo off
REM Quick Authentication Test - DICOM Router
REM Use this to quickly test if authentication is working

title DICOM Router - Quick Auth Test
color 0E

echo ================================================================
echo   DICOM Router - Authentication Quick Test
echo   Powered by Assist.id
echo ================================================================
echo.

set BASE_URL=http://localhost:3001
set HOSPITAL_ID=678484fe219a19629b962377
set API_KEY=Njc4NDg0ZmUyMTlhMTk2MjliOTYyMzc3OkJpc21pbGxhaFJhZGlvbG9neTEyMyE

REM Check if curl is available
where curl >nul 2>nul
if %errorlevel% neq 0 (
    echo ERROR: curl is not installed!
    echo.
    echo Curl is required for this test. Please install it or use Git Bash.
    echo.
    pause
    exit /b 1
)

REM Check if server is running
echo [Step 1] Checking if server is running on port 3001...
echo ----------------------------------------------------------------
netstat -an | findstr :3001 >nul 2>nul
if %errorlevel% neq 0 (
    echo.
    echo ❌ ERROR: Server is NOT running on port 3001!
    echo.
    echo Please start the server first:
    echo   - Run START_DICOM_ROUTER.bat
    echo   - Or run: npm start
    echo.
    pause
    exit /b 1
) else (
    echo ✓ Server is running on port 3001
)
echo.

REM Test health endpoint
echo [Step 2] Testing server health...
echo ----------------------------------------------------------------
curl -s -X GET %BASE_URL%/health >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ ERROR: Cannot connect to server!
    echo.
    pause
    exit /b 1
) else (
    echo ✓ Server is responding
)
echo.

REM Display credentials being used
echo [Step 3] Credentials being tested...
echo ----------------------------------------------------------------
echo Hospital ID: %HOSPITAL_ID%
echo API Key: %API_KEY:~0,20%... (truncated for security)
echo API URL: https://api-dicom-router.assist.id
echo.

REM Test authentication
echo [Step 4] Testing authentication with your credentials...
echo ----------------------------------------------------------------
echo.
echo Request:
echo   POST %BASE_URL%/api/auth/validate
echo   Content-Type: application/json
echo.
echo Response:

curl -s -w "\nHTTP Status: %%{http_code}\n" ^
  -X POST %BASE_URL%/api/auth/validate ^
  -H "Content-Type: application/json" ^
  -d "{\"hospital_id\":\"%HOSPITAL_ID%\",\"api_key\":\"%API_KEY%\"}"

echo.
echo ----------------------------------------------------------------
echo.

REM Check credentials in .env file
echo [Step 5] Verifying credentials in .env file...
echo ----------------------------------------------------------------
if exist .env (
    echo ✓ .env file exists
    echo.
    echo Current .env contents:
    type .env
    echo.
) else (
    echo ⚠ WARNING: .env file not found!
    echo.
    if exist .env.example (
        echo Creating .env from .env.example...
        copy .env.example .env
        echo.
        echo ✓ .env created. Please edit it with your credentials.
        notepad .env
    )
)
echo.

echo ================================================================
echo                    TEST COMPLETE
echo ================================================================
echo.
echo If you see "success": true above, authentication is working! ✓
echo If you see "success": false, check the following:
echo.
echo   1. Verify HOSPITAL_ID and API_KEY in .env file
echo   2. Check network connectivity to api-dicom-router.assist.id
echo   3. Verify credentials are correct (contact Assist.id support)
echo   4. Check storage/logs/app.log for detailed error messages
echo.
echo Support:
echo   Website: https://assist.id
echo   Phone: 082112222500
echo   Email: info@assist.id
echo.
echo ================================================================
echo.
pause
