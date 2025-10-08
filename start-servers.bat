@echo off
setlocal enabledelayedexpansion

echo ============================================
echo   Project S42 Server Management Script
echo ============================================
echo.

echo Cleaning up existing processes...
echo Killing all Node.js processes...
taskkill /F /IM node.exe >nul 2>&1
taskkill /F /IM npm.cmd >nul 2>&1

echo Killing all Python processes...
taskkill /F /IM python.exe >nul 2>&1
taskkill /F /IM pythonw.exe >nul 2>&1

echo Cleaning up processes on ports 8000 and 3000...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8000 "') do taskkill /f /pid %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000 "') do taskkill /f /pid %%a >nul 2>&1

echo.
echo ============================================
echo   Starting Development Mode
echo   Frontend: http://localhost:3000
echo   Backend: http://localhost:8000
echo ============================================
echo.

echo Checking prerequisites...
python --version
if %errorlevel% neq 0 (
    echo ERROR: Python is not installed or not in PATH
    pause
    exit /b 1
)

node --version
if %errorlevel% neq 0 (
    echo ERROR: Node.js is not installed or not in PATH
    pause
    exit /b 1
)

echo.
echo Starting backend server on port 8000...
cd /d %~dp0backend
start "S42 Backend" cmd /k "python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"

timeout /t 3 /nobreak >nul

echo Starting frontend server on port 3000...
cd /d %~dp0frontend
start "S42 Frontend" cmd /k "npm run dev"

timeout /t 5 /nobreak >nul

echo.
echo ============================================
echo Development servers started!
echo Frontend: http://localhost:3000
echo Backend: http://localhost:8000
echo Backend API Docs: http://localhost:8000/docs
echo ============================================
echo.

pause



timeout /t 5 /nobreak >nul

if "%choice%"=="1" goto dev_modeecho.

echo.

echo ============================================if "%choice%"=="2" goto docker_mode

echo Development servers started!

echo Frontend: http://localhost:3000if "%choice%"=="3" goto install_servicesif "%choice%"=="1" goto dev_mode

echo Backend: http://localhost:8000

echo Backend API Docs: http://localhost:8000/docsif "%choice%"=="4" goto stop_servers

echo ============================================

goto endif "%choice%"=="5" goto check_statusREM Wait 2 seconds for input, default to option 1if "%choice%"=="2" goto docker_mode



:docker_mode

echo Starting Docker containers...

docker-compose down >nul 2>&1REM Invalid choice, default to dev modechoice /C 12345 /T 2 /D 1 /M "Enter your choice (1-5) [Auto-selecting 1 in 2 seconds]"if "%choice%"=="3" goto install_services

docker-compose up -d

echo Docker services started!echo Invalid choice. Defaulting to option 1 - Development Mode

goto end

set choice=1set choice=%ERRORLEVEL%if "%choice%"=="4" goto stop_servers

:stop_servers

echo Stopping all servers...goto dev_mode

for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000 "') do taskkill /f /pid %%a >nul 2>&1

for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8000 "') do taskkill /f /pid %%a >nul 2>&1if "%choice%"=="5" goto check_status

echo All servers stopped.

goto end:dev_mode



:check_statusecho.if "%choice%"=="1" goto dev_modeecho Invalid choice. Exiting...

echo Checking server status...

netstat -ano | findstr :3000 | findstr LISTENINGecho ========================================

netstat -ano | findstr :8000 | findstr LISTENING

goto endecho   Starting Development Modeif "%choice%"=="2" goto docker_modeexit /b 1



:endecho   Frontend: http://localhost:3000

echo.

pauseecho   Backend: http://localhost:8000if "%choice%"=="3" goto install_services


echo ========================================

echo.if "%choice%"=="4" goto stop_servers:dev_mode

goto check_prerequisites

if "%choice%"=="5" goto check_statusecho.

:docker_mode

echo.echo Invalid choice. Exiting...echo ========================================

echo ========================================

echo   Starting Docker Mode  exit /b 1echo   Starting Development Mode

echo   Frontend: http://localhost:3150

echo   Backend: http://localhost:8150echo   Frontend: http://localhost:3000

echo ========================================

echo.:dev_modeecho   Backend: http://localhost:8000

goto start_docker

echo.echo ========================================

:install_services

echo.echo ========================================echo.

echo ========================================

echo   Installing Windows Servicesecho   Starting Development Modegoto check_prerequisites

echo ========================================

echo.echo   Frontend: http://localhost:3000

goto setup_services

echo   Backend: http://localhost:8000:docker_mode

:stop_servers

goto cleanup_processesecho ========================================echo.



:check_statusecho.echo ========================================

goto status_check

goto check_prerequisitesecho   Starting Docker Mode  

:check_prerequisites

echo Checking prerequisites...echo   Frontend: http://localhost:3150



REM Check Python:docker_modeecho   Backend: http://localhost:8150

python --version >nul 2>&1

if errorlevel 1 (echo.echo ========================================

    echo ERROR: Python not installed or not in PATH

    pauseecho ========================================echo.

    exit /b 1

)echo   Starting Docker Mode  goto start_docker

python --version

echo   Frontend: http://localhost:3150

REM Check uvicorn

echo Checking uvicorn...echo   Backend: http://localhost:8150:install_services

python -m pip show uvicorn >nul 2>&1

if errorlevel 1 (echo ========================================echo.

    echo Installing uvicorn...

    python -m pip install uvicornecho.echo ========================================

)

echo Uvicorn is already available.goto start_dockerecho   Installing Windows Services



REM Check Node.jsecho ========================================

node --version >nul 2>&1

if errorlevel 1 (:install_servicesecho.

    echo ERROR: Node.js not installed or not in PATH

    pauseecho.@echo off

    exit /b 1

)echo ========================================setlocal enabledelayedexpansion

node --version

echo   Installing Windows Servicesecho =====================================

REM Install frontend dependencies if needed

cd /d %~dp0frontendecho ========================================echo ======= Project S42 Server Management Script =======

if not exist node_modules (

    echo Installing frontend dependencies...echo.echo =====================================

    npm install

    if errorlevel 1 (goto setup_servicesecho.

        echo ERROR: Failed to install frontend dependencies

        pauseecho Choose your deployment mode:

        exit /b 1

    ):stop_serversecho 1. Development Mode (NPM:3000 + FastAPI:8000)

)

goto cleanup_processesecho 2. Docker Mode (Frontend:3150 + Backend:8150)

echo All prerequisites OK.

goto start_dev_serversecho 3. Install as Windows Services



:start_dev_servers:check_statusecho 4. Stop all servers

REM Comprehensive port cleanup - kill specific processes using ports 8000 and 3000

echo Cleaning up processes on ports 8000 and 3000...goto status_checkecho 5. Check server status



REM Kill processes using port 8000echo.

for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8000 "') do (

    if "%%a" neq "" (:check_prerequisitesset /p choice="Enter your choice (1-5): "

        echo Stopping process on port 8000 (PID: %%a)

        taskkill /f /pid %%a >nul 2>&1echo Checking prerequisites...if "!choice!"=="" (

    )

)    timeout /t 2 >nul



REM Kill processes using port 3000REM Check Python    if "!choice!"=="" set choice=1

for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000 "') do (

    if "%%a" neq "" (python --version >nul 2>&1)

        echo Stopping process on port 3000 (PID: %%a)

        taskkill /f /pid %%a >nul 2>&1if errorlevel 1 (echo =====================================

    )

)    echo ERROR: Python not installed or not in PATHif "!choice!"=="1" goto dev



REM Wait a moment for processes to fully terminate    pauseif "!choice!"=="2" goto docker

timeout /t 2 /nobreak >nul

    exit /b 1if "!choice!"=="3" goto services

echo Starting backend server on port 8000...

cd /d %~dp0)if "!choice!"=="4" goto stop

start "S42 Backend (Dev)" cmd /k "python -m uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload"

python --versionif "!choice!"=="5" goto status

echo Starting frontend server on port 3000...

cd /d %~dp0frontendecho Invalid choice. Exiting.

start "S42 Frontend (Dev)" cmd /k "npm run dev -- --port 3000"

REM Check uvicornexit /b

echo Waiting for services to start...

timeout /t 5 /nobreak >nulecho Checking uvicorn...:dev



echo.python -m pip show uvicorn >nul 2>&1echo Starting Development Mode

echo ============================================

echo Development servers started!if errorlevel 1 (echo   Frontend: http://localhost:3000

echo Frontend: http://localhost:3000

echo Backend: http://localhost:8000    echo Installing uvicorn...echo   Backend: http://localhost:8000

echo Backend API Docs: http://localhost:8000/docs

echo ============================================    python -m pip install uvicornecho =====================================

goto end

)call "%~dp0auto-deploy.bat"

:start_docker

echo Checking Docker...echo Uvicorn is already available.exit /b

docker --version >nul 2>&1

if errorlevel 1 (:docker

    echo ERROR: Docker not installed. Download from https://docker.com/

    pauseREM Check Node.jsecho Starting Docker Mode

    exit /b 1

)node --version >nul 2>&1echo   Frontend: http://localhost:3150



REM Comprehensive cleanup for Docker portsif errorlevel 1 (echo   Backend: http://localhost:8150

echo Cleaning up processes on Docker ports 3150 and 8150...

for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3150 "') do (    echo ERROR: Node.js not installed or not in PATHecho =====================================

    if "%%a" neq "" (

        echo Stopping process on port 3150 (PID: %%a)    pausedocker-compose up --build

        taskkill /f /pid %%a >nul 2>&1

    )    exit /b 1exit /b

)

):services

for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8150 "') do (

    if "%%a" neq "" (node --versionecho Installing as Windows Services...

        echo Stopping process on port 8150 (PID: %%a)

        taskkill /f /pid %%a >nul 2>&1exit /b

    )

)REM Install frontend dependencies if needed:stop



echo Stopping existing containers...cd /d %~dp0frontendecho Stopping all servers...

docker-compose down >nul 2>&1

if not exist node_modules (taskkill /F /IM python.exe /T

REM Wait for cleanup to complete

timeout /t 2 /nobreak >nul    echo Installing frontend dependencies...taskkill /F /IM node.exe /T



echo Building and starting Docker containers...    npm installexit /b

docker-compose build

docker-compose up -d    if errorlevel 1 (:status



echo Waiting for containers to start...        echo ERROR: Failed to install frontend dependenciesecho Checking server status...

timeout /t 10 /nobreak >nul

        pausenetstat -ano | findstr :8000

echo.

echo ============================================        exit /b 1netstat -ano | findstr :3000

echo Docker services started!

echo Frontend: http://localhost:3150    )netstat -ano | findstr :8150

echo Backend: http://localhost:8150

echo Backend API Docs: http://localhost:8150/docs)netstat -ano | findstr :3150

echo ============================================

goto endexit /b



:setup_servicesecho All prerequisites OK.REM Install frontend dependencies if needed

echo.

echo Setting up Windows Services for Project S42...goto start_dev_serverscd /d %~dp0frontend

echo.

echo This will install NSSM (Non-Sucking Service Manager) and create services.if not exist node_modules (

echo.

set /p confirm="Continue? (y/n): ":start_dev_servers    echo Installing frontend dependencies...

if /i not "%confirm%"=="y" goto end

REM Comprehensive port cleanup - kill specific processes using ports 8000 and 3000    npm install

REM Download and install NSSM

if not exist "%~dp0tools\nssm.exe" (echo Cleaning up processes on ports 8000 and 3000...    if errorlevel 1 (

    echo Creating tools directory...

    mkdir "%~dp0tools" 2>nul        echo ERROR: Failed to install frontend dependencies

    echo.

    echo Please download NSSM from https://nssm.cc/downloadREM Kill processes using port 8000        pause

    echo Extract nssm.exe to: %~dp0tools\nssm.exe

    echo Then run this script again.for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8000 "') do (        exit /b 1

    pause

    goto end    if "%%a" neq "" (    )

)

        echo Stopping process on port 8000 (PID: %%a))

echo Installing S42 Backend Service...

"%~dp0tools\nssm.exe" install "S42Backend" python "%~dp0backend\app\main.py"        taskkill /f /pid %%a >nul 2>&1

"%~dp0tools\nssm.exe" set "S42Backend" AppDirectory "%~dp0"

"%~dp0tools\nssm.exe" set "S42Backend" AppParameters "-m uvicorn backend.app.main:app --host 0.0.0.0 --port 8000"    )echo All prerequisites OK.

"%~dp0tools\nssm.exe" set "S42Backend" DisplayName "Project S42 Backend Service"

"%~dp0tools\nssm.exe" set "S42Backend" Description "FastAPI backend for Project S42")goto start_dev_servers



echo Installing S42 Frontend Service...

"%~dp0tools\nssm.exe" install "S42Frontend" npm "run dev -- --port 3000"

"%~dp0tools\nssm.exe" set "S42Frontend" AppDirectory "%~dp0frontend"REM Kill processes using port 3000:start_dev_servers

"%~dp0tools\nssm.exe" set "S42Frontend" DisplayName "Project S42 Frontend Service"

"%~dp0tools\nssm.exe" set "S42Frontend" Description "Next.js frontend for Project S42"for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000 "') do (REM Comprehensive port cleanup - kill specific processes using ports 8000 and 3000



echo Starting services...    if "%%a" neq "" (echo Cleaning up processes on ports 8000 and 3000...

net start S42Backend

net start S42Frontend        echo Stopping process on port 3000 (PID: %%a)



echo.        taskkill /f /pid %%a >nul 2>&1REM Kill processes using port 8000

echo ============================================

echo Windows Services installed and started!    )for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8000 "') do (

echo Frontend: http://localhost:3000

echo Backend: http://localhost:8000)    if "%%a" neq "" (

echo.

echo To manage services:        echo Stopping process on port 8000 (PID: %%a)

echo - services.msc (Windows Services Manager)

echo - net start S42Backend / net start S42FrontendREM Additional cleanup for common process names (backup cleanup)        taskkill /f /pid %%a >nul 2>&1

echo - net stop S42Backend / net stop S42Frontend

echo ============================================taskkill /f /im uvicorn.exe >nul 2>&1    )

goto end

taskkill /f /im node.exe >nul 2>&1)

:cleanup_processes

echo Stopping all Project S42 processes...taskkill /f /im npm.cmd >nul 2>&1



REM Stop Windows Services if they existREM Kill processes using port 3000

net stop S42Backend >nul 2>&1

net stop S42Frontend >nul 2>&1REM Wait a moment for processes to fully terminatefor /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000 "') do (



REM Stop Docker containerstimeout /t 2 /nobreak >nul    if "%%a" neq "" (

docker-compose down >nul 2>&1

        echo Stopping process on port 3000 (PID: %%a)

REM Kill processes using specific ports (comprehensive cleanup)

echo Stopping processes on development ports (3000, 8000)...echo Starting backend server on port 8000...        taskkill /f /pid %%a >nul 2>&1

for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000 "') do (

    if "%%a" neq "" (cd /d %~dp0    )

        echo Stopping process on port 3000 (PID: %%a)

        taskkill /f /pid %%a >nul 2>&1start "S42 Backend (Dev)" cmd /k "python -m uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload")

    )

)



for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8000 "') do (echo Starting frontend server on port 3000...REM Additional cleanup for common process names (backup cleanup)

    if "%%a" neq "" (

        echo Stopping process on port 8000 (PID: %%a)cd /d %~dp0frontendtaskkill /f /im uvicorn.exe >nul 2>&1

        taskkill /f /pid %%a >nul 2>&1

    )start "S42 Frontend (Dev)" cmd /k "npm run dev -- --port 3000"taskkill /f /im node.exe >nul 2>&1

)

taskkill /f /im npm.cmd >nul 2>&1

echo Stopping processes on Docker ports (3150, 8150)...

for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3150 "') do (echo Waiting for services to start...

    if "%%a" neq "" (

        echo Stopping process on port 3150 (PID: %%a)timeout /t 5 /nobreak >nulREM Wait a moment for processes to fully terminate

        taskkill /f /pid %%a >nul 2>&1

    )timeout /t 2 /nobreak >nul

)

echo.

for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8150 "') do (

    if "%%a" neq "" (echo ============================================echo Starting backend server on port 8000...

        echo Stopping process on port 8150 (PID: %%a)

        taskkill /f /pid %%a >nul 2>&1echo Development servers started!cd /d %~dp0backend\app

    )

)echo Frontend: http://localhost:3000start "S42 Backend (Dev)" cmd /k "uvicorn main:app --host 0.0.0.0 --port 8000 --reload"



echo All servers stopped.echo Backend: http://localhost:8000

goto end

echo Backend API Docs: http://localhost:8000/docsecho Starting frontend server on port 3000...

:status_check

echo Checking server status...echo ============================================cd /d %~dp0frontend

echo.

goto endstart "S42 Frontend (Dev)" cmd /k "npm run dev -- --port 3000"

echo Development Mode (ports 3000, 8000):

netstat -ano | findstr :3000 | findstr LISTENING >nul 2>&1

if errorlevel 1 (

    echo   Frontend (3000): NOT RUNNING:start_dockerecho Waiting for services to start...

) else (

    echo   Frontend (3000): RUNNINGecho Checking Docker...timeout /t 5 /nobreak >nul

)

docker --version >nul 2>&1

netstat -ano | findstr :8000 | findstr LISTENING >nul 2>&1

if errorlevel 1 (if errorlevel 1 (echo.

    echo   Backend (8000): NOT RUNNING

) else (    echo ERROR: Docker not installed. Download from https://docker.com/echo ============================================

    echo   Backend (8000): RUNNING

)    pauseecho Development servers started!



echo.    exit /b 1echo Frontend: http://localhost:3000

echo Docker Mode (ports 3150, 8150):

netstat -ano | findstr :3150 | findstr LISTENING >nul 2>&1)echo Backend: http://localhost:8000

if errorlevel 1 (

    echo   Frontend (3150): NOT RUNNINGecho Backend API Docs: http://localhost:8000/docs

) else (

    echo   Frontend (3150): RUNNINGREM Comprehensive cleanup for Docker portsecho ============================================

)

echo Cleaning up processes on Docker ports 3150 and 8150...goto end

netstat -ano | findstr :8150 | findstr LISTENING >nul 2>&1

if errorlevel 1 (for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3150 "') do (

    echo   Backend (8150): NOT RUNNING

) else (    if "%%a" neq "" (:start_docker

    echo   Backend (8150): RUNNING

)        echo Stopping process on port 3150 (PID: %%a)echo Checking Docker...



echo.        taskkill /f /pid %%a >nul 2>&1docker --version >nul 2>&1

echo Windows Services:

sc query S42Backend >nul 2>&1    )if errorlevel 1 (

if errorlevel 1 (

    echo   S42Backend Service: NOT INSTALLED)    echo ERROR: Docker not installed. Download from https://docker.com/

) else (

    sc query S42Backend | findstr "RUNNING" >nul 2>&1    pause

    if errorlevel 1 (

        echo   S42Backend Service: STOPPEDfor /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8150 "') do (    exit /b 1

    ) else (

        echo   S42Backend Service: RUNNING    if "%%a" neq "" ()

    )

)        echo Stopping process on port 8150 (PID: %%a)



sc query S42Frontend >nul 2>&1        taskkill /f /pid %%a >nul 2>&1REM Comprehensive cleanup for Docker ports

if errorlevel 1 (

    echo   S42Frontend Service: NOT INSTALLED    )echo Cleaning up processes on Docker ports 3150 and 8150...

) else (

    sc query S42Frontend | findstr "RUNNING" >nul 2>&1)for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3150 "') do (

    if errorlevel 1 (

        echo   S42Frontend Service: STOPPED    if "%%a" neq "" (

    ) else (

        echo   S42Frontend Service: RUNNINGecho Stopping existing containers...        echo Stopping process on port 3150 (PID: %%a)

    )

)docker-compose down >nul 2>&1        taskkill /f /pid %%a >nul 2>&1



echo.    )

echo Docker containers:

docker ps --format "table {{.Names}}\t{{.Status}}" | findstr project_s42 2>nulREM Wait for cleanup to complete)

if errorlevel 1 (

    echo   No Docker containers runningtimeout /t 2 /nobreak >nul

)

goto endfor /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8150 "') do (



:endecho Building and starting Docker containers...    if "%%a" neq "" (

echo.

pausedocker-compose build        echo Stopping process on port 8150 (PID: %%a)


docker-compose up -d        taskkill /f /pid %%a >nul 2>&1

    )

echo Waiting for containers to start...)

timeout /t 10 /nobreak >nul

echo Stopping existing containers...

echo.docker-compose down >nul 2>&1

echo ============================================

echo Docker services started!REM Wait for cleanup to complete

echo Frontend: http://localhost:3150timeout /t 2 /nobreak >nul

echo Backend: http://localhost:8150

echo Backend API Docs: http://localhost:8150/docsecho Building and starting Docker containers...

echo ============================================docker-compose build

goto enddocker-compose up -d



:setup_servicesecho Waiting for containers to start...

echo.timeout /t 10 /nobreak >nul

echo Setting up Windows Services for Project S42...

echo.echo.

echo This will install NSSM (Non-Sucking Service Manager) and create services.echo ============================================

echo.echo Docker services started!

set /p confirm="Continue? (y/n): "echo Frontend: http://localhost:3150

if /i not "%confirm%"=="y" goto endecho Backend: http://localhost:8150

echo Backend API Docs: http://localhost:8150/docs

REM Download and install NSSMecho ============================================

if not exist "%~dp0tools\nssm.exe" (goto end

    echo Creating tools directory...

    mkdir "%~dp0tools" 2>nul:setup_services

    echo.echo.

    echo Please download NSSM from https://nssm.cc/downloadecho Setting up Windows Services for Project S42...

    echo Extract nssm.exe to: %~dp0tools\nssm.exeecho.

    echo Then run this script again.echo This will install NSSM (Non-Sucking Service Manager) and create services.

    pauseecho.

    goto endset /p confirm="Continue? (y/n): "

)if /i not "%confirm%"=="y" goto end



echo Installing S42 Backend Service...REM Download and install NSSM

"%~dp0tools\nssm.exe" install "S42Backend" python "%~dp0backend\app\main.py"if not exist "%~dp0tools\nssm.exe" (

"%~dp0tools\nssm.exe" set "S42Backend" AppDirectory "%~dp0backend\app"    echo Creating tools directory...

"%~dp0tools\nssm.exe" set "S42Backend" AppParameters "-m uvicorn main:app --host 0.0.0.0 --port 8000"    mkdir "%~dp0tools" 2>nul

"%~dp0tools\nssm.exe" set "S42Backend" DisplayName "Project S42 Backend Service"    echo.

"%~dp0tools\nssm.exe" set "S42Backend" Description "FastAPI backend for Project S42"    echo Please download NSSM from https://nssm.cc/download

    echo Extract nssm.exe to: %~dp0tools\nssm.exe

echo Installing S42 Frontend Service...    echo Then run this script again.

"%~dp0tools\nssm.exe" install "S42Frontend" npm "run dev -- --port 3000"    pause

"%~dp0tools\nssm.exe" set "S42Frontend" AppDirectory "%~dp0frontend"    goto end

"%~dp0tools\nssm.exe" set "S42Frontend" DisplayName "Project S42 Frontend Service")

"%~dp0tools\nssm.exe" set "S42Frontend" Description "Next.js frontend for Project S42"

echo Installing S42 Backend Service...

echo Starting services..."%~dp0tools\nssm.exe" install "S42Backend" python "%~dp0backend\app\main.py"

net start S42Backend"%~dp0tools\nssm.exe" set "S42Backend" AppDirectory "%~dp0backend\app"

net start S42Frontend"%~dp0tools\nssm.exe" set "S42Backend" AppParameters "-m uvicorn main:app --host 0.0.0.0 --port 8000"

"%~dp0tools\nssm.exe" set "S42Backend" DisplayName "Project S42 Backend Service"

echo."%~dp0tools\nssm.exe" set "S42Backend" Description "FastAPI backend for Project S42"

echo ============================================

echo Windows Services installed and started!echo Installing S42 Frontend Service...

echo Frontend: http://localhost:3000"%~dp0tools\nssm.exe" install "S42Frontend" npm "run dev -- --port 3000"

echo Backend: http://localhost:8000"%~dp0tools\nssm.exe" set "S42Frontend" AppDirectory "%~dp0frontend"

echo."%~dp0tools\nssm.exe" set "S42Frontend" DisplayName "Project S42 Frontend Service"

echo To manage services:"%~dp0tools\nssm.exe" set "S42Frontend" Description "Next.js frontend for Project S42"

echo - services.msc (Windows Services Manager)

echo - net start S42Backend / net start S42Frontendecho Starting services...

echo - net stop S42Backend / net stop S42Frontendnet start S42Backend

echo ============================================net start S42Frontend

goto end

echo.

:cleanup_processesecho ============================================

echo Stopping all Project S42 processes...echo Windows Services installed and started!

echo Frontend: http://localhost:3000

REM Stop Windows Services if they existecho Backend: http://localhost:8000

net stop S42Backend >nul 2>&1echo.

net stop S42Frontend >nul 2>&1echo To manage services:

echo - services.msc (Windows Services Manager)

REM Stop Docker containersecho - net start S42Backend / net start S42Frontend

docker-compose down >nul 2>&1echo - net stop S42Backend / net stop S42Frontend

echo ============================================

REM Kill processes using specific ports (comprehensive cleanup)goto end

echo Stopping processes on development ports (3000, 8000)...

for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000 "') do (:cleanup_processes

    if "%%a" neq "" (echo Stopping all Project S42 processes...

        echo Stopping process on port 3000 (PID: %%a)

        taskkill /f /pid %%a >nul 2>&1REM Stop Windows Services if they exist

    )net stop S42Backend >nul 2>&1

)net stop S42Frontend >nul 2>&1



for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8000 "') do (REM Stop Docker containers

    if "%%a" neq "" (docker-compose down >nul 2>&1

        echo Stopping process on port 8000 (PID: %%a)

        taskkill /f /pid %%a >nul 2>&1REM Kill processes using specific ports (comprehensive cleanup)

    )echo Stopping processes on development ports (3000, 8000)...

)for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000 "') do (

    if "%%a" neq "" (

echo Stopping processes on Docker ports (3150, 8150)...        echo Stopping process on port 3000 (PID: %%a)

for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3150 "') do (        taskkill /f /pid %%a >nul 2>&1

    if "%%a" neq "" (    )

        echo Stopping process on port 3150 (PID: %%a))

        taskkill /f /pid %%a >nul 2>&1

    )for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8000 "') do (

)    if "%%a" neq "" (

        echo Stopping process on port 8000 (PID: %%a)

for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8150 "') do (        taskkill /f /pid %%a >nul 2>&1

    if "%%a" neq "" (    )

        echo Stopping process on port 8150 (PID: %%a))

        taskkill /f /pid %%a >nul 2>&1

    )echo Stopping processes on Docker ports (3150, 8150)...

)for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3150 "') do (

    if "%%a" neq "" (

REM Additional cleanup for common process names (backup cleanup)        echo Stopping process on port 3150 (PID: %%a)

taskkill /f /im uvicorn.exe >nul 2>&1        taskkill /f /pid %%a >nul 2>&1

taskkill /f /im node.exe >nul 2>&1    )

taskkill /f /im npm.cmd >nul 2>&1)



echo All servers stopped.for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8150 "') do (

goto end    if "%%a" neq "" (

        echo Stopping process on port 8150 (PID: %%a)

:status_check        taskkill /f /pid %%a >nul 2>&1

echo Checking server status...    )

echo.)



echo Development Mode (ports 3000, 8000):REM Additional cleanup for common process names (backup cleanup)

netstat -ano | findstr :3000 | findstr LISTENING >nul 2>&1taskkill /f /im uvicorn.exe >nul 2>&1

if errorlevel 1 (taskkill /f /im node.exe >nul 2>&1

    echo   Frontend (3000): NOT RUNNINGtaskkill /f /im npm.cmd >nul 2>&1

) else (

    echo   Frontend (3000): RUNNINGecho All servers stopped.

)goto end



netstat -ano | findstr :8000 | findstr LISTENING >nul 2>&1:status_check

if errorlevel 1 (echo Checking server status...

    echo   Backend (8000): NOT RUNNINGecho.

) else (

    echo   Backend (8000): RUNNINGecho Development Mode (ports 3000, 8000):

)netstat -ano | findstr :3000 | findstr LISTENING >nul 2>&1

if errorlevel 1 (

echo.    echo   Frontend (3000): NOT RUNNING

echo Docker Mode (ports 3150, 8150):) else (

netstat -ano | findstr :3150 | findstr LISTENING >nul 2>&1    echo   Frontend (3000): RUNNING

if errorlevel 1 ()

    echo   Frontend (3150): NOT RUNNING

) else (netstat -ano | findstr :8000 | findstr LISTENING >nul 2>&1

    echo   Frontend (3150): RUNNINGif errorlevel 1 (

)    echo   Backend (8000): NOT RUNNING

) else (

netstat -ano | findstr :8150 | findstr LISTENING >nul 2>&1    echo   Backend (8000): RUNNING

if errorlevel 1 ()

    echo   Backend (8150): NOT RUNNING

) else (echo.

    echo   Backend (8150): RUNNINGecho Docker Mode (ports 3150, 8150):

)netstat -ano | findstr :3150 | findstr LISTENING >nul 2>&1

if errorlevel 1 (

echo.    echo   Frontend (3150): NOT RUNNING

echo Windows Services:) else (

sc query S42Backend >nul 2>&1    echo   Frontend (3150): RUNNING

if errorlevel 1 ()

    echo   S42Backend Service: NOT INSTALLED

) else (netstat -ano | findstr :8150 | findstr LISTENING >nul 2>&1

    sc query S42Backend | findstr "RUNNING" >nul 2>&1if errorlevel 1 (

    if errorlevel 1 (    echo   Backend (8150): NOT RUNNING

        echo   S42Backend Service: STOPPED) else (

    ) else (    echo   Backend (8150): RUNNING

        echo   S42Backend Service: RUNNING)

    )

)echo.

echo Windows Services:

sc query S42Frontend >nul 2>&1sc query S42Backend >nul 2>&1

if errorlevel 1 (if errorlevel 1 (

    echo   S42Frontend Service: NOT INSTALLED    echo   S42Backend Service: NOT INSTALLED

) else () else (

    sc query S42Frontend | findstr "RUNNING" >nul 2>&1    sc query S42Backend | findstr "RUNNING" >nul 2>&1

    if errorlevel 1 (    if errorlevel 1 (

        echo   S42Frontend Service: STOPPED        echo   S42Backend Service: STOPPED

    ) else (    ) else (

        echo   S42Frontend Service: RUNNING        echo   S42Backend Service: RUNNING

    )    )

))



echo.sc query S42Frontend >nul 2>&1

echo Docker containers:if errorlevel 1 (

docker ps --format "table {{.Names}}\t{{.Status}}" | findstr project_s42 2>nul    echo   S42Frontend Service: NOT INSTALLED

if errorlevel 1 () else (

    echo   No Docker containers running    sc query S42Frontend | findstr "RUNNING" >nul 2>&1

)    if errorlevel 1 (

goto end        echo   S42Frontend Service: STOPPED

    ) else (

:end        echo   S42Frontend Service: RUNNING

echo.    )

)

echo.
echo Docker containers:
docker ps --format "table {{.Names}}\t{{.Status}}" | findstr project_s42 2>nul
if errorlevel 1 (
    echo   No Docker containers running
)

:end
echo.