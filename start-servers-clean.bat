@echo off
setlocal enabledelayedexpansion

echo ============================================
echo   Project S42 Server Management Script
echo ============================================
echo.
echo Choose your deployment mode:
echo 1. Development Mode (NPM:3000 + FastAPI:8000)
echo 2. Docker Mode (Frontend:3150 + Backend:8150)
echo 3. Stop all servers
echo 4. Check server status
echo 5. Install as Windows Services
echo 6. Deploy to Production (Coolify)
echo.
set /p choice="Enter your choice (1-6): "

if "%choice%"=="" (
    echo Defaulting to option 1 - Development Mode
    timeout /t 2 >nul
    set choice=1
)

if "%choice%"=="1" goto dev_mode
if "%choice%"=="2" goto docker_mode
if "%choice%"=="3" goto stop_servers
if "%choice%"=="4" goto check_status
if "%choice%"=="5" goto install_services
if "%choice%"=="6" goto deploy_production
goto dev_mode

:dev_mode
echo.
echo ========================================
echo   Starting Development Mode
echo   Frontend: http://localhost:3000
echo   Backend: http://localhost:8000
echo ========================================
echo.
echo Checking prerequisites...
python --version
node --version
echo.

echo Cleaning up processes on ports 8000 and 3000...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8000 "') do taskkill /f /pid %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000 "') do taskkill /f /pid %%a >nul 2>&1

echo Starting backend server on port 8000...
cd /d %~dp0
start "S42 Backend" cmd /k "python -m uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload"

echo Starting frontend server on port 3000...
cd /d %~dp0frontend
start "S42 Frontend" cmd /k "npm run dev -- --port 3000"

echo.
echo ========================================
echo   Both servers started!
echo   Frontend: http://localhost:3000
echo   Backend: http://localhost:8000
echo   Press Ctrl+C in server windows to stop
echo ========================================
goto end

:docker_mode
echo.
echo ========================================
echo   Starting Docker Mode
echo   Frontend: http://localhost:3150
echo   Backend: http://localhost:8150
echo ========================================
echo.

cd /d %~dp0
echo Building and starting containers...
docker-compose up --build

goto end

:stop_servers
echo.
echo ========================================
echo   Stopping All Servers
echo ========================================
echo.

echo Stopping processes on ports 3000, 8000, 3150, 8150...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000 "') do taskkill /f /pid %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8000 "') do taskkill /f /pid %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3150 "') do taskkill /f /pid %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8150 "') do taskkill /f /pid %%a >nul 2>&1

echo Stopping Docker containers...
docker-compose down

echo.
echo All servers stopped.
goto end

:check_status
echo.
echo ========================================
echo   Server Status Check
echo ========================================
echo.

echo Checking port 3000 (Dev Frontend):
netstat -ano | findstr ":3000 " && echo   Status: RUNNING || echo   Status: STOPPED

echo.
echo Checking port 8000 (Dev Backend):
netstat -ano | findstr ":8000 " && echo   Status: RUNNING || echo   Status: STOPPED

echo.
echo Checking port 3150 (Docker Frontend):
netstat -ano | findstr ":3150 " && echo   Status: RUNNING || echo   Status: STOPPED

echo.
echo Checking port 8150 (Docker Backend):
netstat -ano | findstr ":8150 " && echo   Status: RUNNING || echo   Status: STOPPED

echo.
echo Docker containers:
docker-compose ps

goto end

:install_services
echo.
echo ========================================
echo   Install as Windows Services
echo ========================================
echo.
echo This feature requires NSSM (Non-Sucking Service Manager)
echo Download from: https://nssm.cc/download
echo.
echo After installing NSSM, you can create services with:
echo   nssm install S42Frontend "npm" "run dev"
echo   nssm install S42Backend "python" "-m uvicorn backend.app.main:app --host 0.0.0.0 --port 8000"
echo.
pause
goto end

:deploy_production
echo.
echo ========================================
echo   Deploy to Production (Coolify)
echo ========================================
echo.
echo This will trigger a production deployment to:
echo   - Frontend: https://s42.edbmotte.com
echo   - Backend: https://s42api.edbmotte.com
echo.
echo Deployment options:
echo 1. Deploy Frontend only
echo 2. Deploy Backend only
echo 3. Deploy Both (Frontend + Backend)
echo 4. Deploy with Force Rebuild (no cache)
echo 5. Cancel
echo.
set /p deploy_choice="Enter your choice (1-5): "

if "%deploy_choice%"=="1" goto deploy_frontend
if "%deploy_choice%"=="2" goto deploy_backend
if "%deploy_choice%"=="3" goto deploy_both
if "%deploy_choice%"=="4" goto deploy_force
if "%deploy_choice%"=="5" goto end
echo Invalid choice, cancelling...
goto end

:deploy_frontend
echo.
echo Deploying Frontend to production...
curl -X GET "https://coolify.edbmotte.com/api/v1/deploy?uuid=vok888ogsgos4g088kc4gwk4&force=false" ^
  -H "Authorization: Bearer 4|jqbzIGZUuYCoqqWq6thXY1RD0cCA4JJCpmKFLqHi518797ed"
echo.
echo Frontend deployment triggered!
echo Check status at: https://coolify.edbmotte.com
timeout /t 3
goto end

:deploy_backend
echo.
echo Deploying Backend to production...
curl -X GET "https://coolify.edbmotte.com/api/v1/deploy?uuid=YOUR_BACKEND_UUID&force=false" ^
  -H "Authorization: Bearer 4|jqbzIGZUuYCoqqWq6thXY1RD0cCA4JJCpmKFLqHi518797ed"
echo.
echo Backend deployment triggered!
echo Check status at: https://coolify.edbmotte.com
timeout /t 3
goto end

:deploy_both
echo.
echo Deploying Frontend...
curl -X GET "https://coolify.edbmotte.com/api/v1/deploy?uuid=vok888ogsgos4g088kc4gwk4&force=false" ^
  -H "Authorization: Bearer 4|jqbzIGZUuYCoqqWq6thXY1RD0cCA4JJCpmKFLqHi518797ed"
echo.
echo Waiting 5 seconds before deploying backend...
timeout /t 5
echo.
echo Deploying Backend...
curl -X GET "https://coolify.edbmotte.com/api/v1/deploy?uuid=YOUR_BACKEND_UUID&force=false" ^
  -H "Authorization: Bearer 4|jqbzIGZUuYCoqqWq6thXY1RD0cCA4JJCpmKFLqHi518797ed"
echo.
echo Both deployments triggered!
echo Check status at: https://coolify.edbmotte.com
timeout /t 3
goto end

:deploy_force
echo.
echo Deploying with Force Rebuild (no cache)...
echo.
echo Deploying Frontend (force)...
curl -X GET "https://coolify.edbmotte.com/api/v1/deploy?uuid=vok888ogsgos4g088kc4gwk4&force=true" ^
  -H "Authorization: Bearer 4|jqbzIGZUuYCoqqWq6thXY1RD0cCA4JJCpmKFLqHi518797ed"
echo.
echo Waiting 5 seconds before deploying backend...
timeout /t 5
echo.
echo Deploying Backend (force)...
curl -X GET "https://coolify.edbmotte.com/api/v1/deploy?uuid=YOUR_BACKEND_UUID&force=true" ^
  -H "Authorization: Bearer 4|jqbzIGZUuYCoqqWq6thXY1RD0cCA4JJCpmKFLqHi518797ed"
echo.
echo Force rebuild deployments triggered!
echo Check status at: https://coolify.edbmotte.com
timeout /t 3
goto end

:end
echo.
pause
