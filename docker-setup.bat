@echo off
echo ============================================
echo         S42 PROJECT DOCKER SETUP
echo ============================================
echo.

REM Check if Docker is installed and running
echo Checking Docker installation...
docker --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Docker is not installed or not running.
    echo Please install Docker Desktop from https://www.docker.com/products/docker-desktop/
    pause
    exit /b 1
)
echo Docker is installed.

REM Check if Docker daemon is running
echo Checking Docker daemon...
docker info >nul 2>&1
if errorlevel 1 (
    echo ERROR: Docker daemon is not running.
    echo Please start Docker Desktop and try again.
    pause
    exit /b 1
)
echo Docker daemon is running.

echo.
echo Building Docker containers...
echo This may take several minutes on first run.
echo.

REM Build and start containers
docker-compose down --remove-orphans
docker-compose build --no-cache
if errorlevel 1 (
    echo ERROR: Failed to build Docker containers.
    pause
    exit /b 1
)

echo.
echo Starting containers...
docker-compose up -d
if errorlevel 1 (
    echo ERROR: Failed to start Docker containers.
    pause
    exit /b 1
)

echo.
echo Waiting for services to start...
timeout /t 10 /nobreak >nul

echo.
echo ============================================
echo         CONTAINERS STARTED SUCCESSFULLY!
echo ============================================
echo.
echo Frontend: http://localhost:3100
echo Backend:  http://localhost:8100
echo Map Page: http://localhost:3100/map
echo.
echo To view logs: docker-compose logs -f
echo To stop:      docker-compose down
echo ============================================
echo.

REM Check container status
echo Container Status:
docker-compose ps

pause