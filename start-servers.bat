@echo off
echo Checking prerequisites...

REM Check Python
python --version
if errorlevel 1 (
    echo ERROR: Python not installed. Download from https://www.python.org/
    pause
    exit /b 1
)

REM Check uvicorn
echo Checking uvicorn...
python -c "import uvicorn"
echo Uvicorn check result: %errorlevel%
if errorlevel 1 (
    echo Installing Python dependencies...
    cd /d %~dp0backend
    pip install -r requirements.txt
    if errorlevel 1 (
        echo ERROR: Failed to install Python dependencies
        pause
        exit /b 1
    )
) else (
    echo Uvicorn is already available.
)

REM Check Node.js
node --version
if errorlevel 1 (
    echo ERROR: Node.js not installed. Download from https://nodejs.org/
    pause
    exit /b 1
)

REM Install frontend dependencies if needed
cd /d %~dp0frontend
echo CD to frontend done
if not exist node_modules (
    echo Installing frontend dependencies...
    npm install
    if errorlevel 1 (
        echo ERROR: Failed to install frontend dependencies
        pause
        exit /b 1
    )
)
echo Node modules check done
REM Check ports and close if in use
echo Checking and closing processes on ports 8000 and 3000...
echo Attempting to close any processes on port 8000...
taskkill /f /im uvicorn.exe >nul 2>&1
taskkill /f /im python.exe >nul 2>&1
echo Attempting to close any processes on port 3000...
taskkill /f /im node.exe >nul 2>&1
taskkill /f /im npm.cmd >nul 2>&1
echo Port check and cleanup done

echo All prerequisites OK.

echo Starting backend server...
cd /d %~dp0backend\app
echo Current directory: %CD%
echo Starting backend...
start "Backend Server" cmd /k "uvicorn main:app --host 0.0.0.0 --port 8150"
echo Backend start command issued.

echo Starting frontend server...
cd /d %~dp0frontend
echo Current directory: %CD%
echo Starting frontend...
start "Frontend Server" cmd /k "npm run dev"
echo Frontend start command issued.


echo Waiting for backend to start on port 8000...
timeout /t 3 /nobreak >nul
echo Checking backend status...
netstat -ano | findstr :8000 | findstr LISTENING >nul 2>&1
if errorlevel 1 (
    echo Backend may still be starting... Check the Backend Server window.
) else (
    echo Backend is running on port 8000.
)

echo Waiting for frontend to start on port 3000...
timeout /t 3 /nobreak >nul
echo Checking frontend status...
netstat -ano | findstr :3000 | findstr LISTENING >nul 2>&1
if errorlevel 1 (
    echo Frontend may still be starting... Check the Frontend Server window.
) else (
    echo Frontend is running on port 3000.
)

echo.
echo ============================================
echo Servers started successfully!
echo Backend: http://localhost:8000 (Backend Server window)
echo Frontend: http://localhost:3000 (Frontend Server window)
echo ============================================
echo Each server is running in its own command window.