@echo off
echo Stopping existing servers...

REM Kill any existing processes
taskkill /f /im uvicorn.exe >nul 2>&1
taskkill /f /im python.exe >nul 2>&1
taskkill /f /im node.exe >nul 2>&1

echo Starting backend server...
cd /d %~dp0backend\app
echo Current directory: %CD%
echo Starting backend...
start "Backend Server" python -c "import uvicorn; uvicorn.run('main:app', host='0.0.0.0', port=8000)"
if errorlevel 1 (
    echo ERROR: Failed to start backend server
    pause
    exit /b 1
)

echo Waiting for backend to start...
timeout /t 5 /nobreak >nul

echo Starting frontend server...
cd /d %~dp0frontend
echo Current directory: %CD%
echo Starting frontend...
start "Frontend Server" npm run dev
if errorlevel 1 (
    echo ERROR: Failed to start frontend server
    pause
    exit /b 1
)
timeout /t 5 /nobreak >nul
timeout /t 5 /nobreak >nul