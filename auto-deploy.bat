@echo off
echo Starting auto-deployment...

echo Pulling latest changes from GitHub...
git pull origin master

if %errorlevel% neq 0 (
    echo Failed to pull changes from GitHub
    pause
    exit /b 1
)

echo Stopping existing containers...
docker compose down

echo Building containers without cache...
docker compose build --no-cache

if %errorlevel% neq 0 (
    echo Failed to build containers
    pause
    exit /b 1
)

echo Starting containers...
docker compose up -d

if %errorlevel% neq 0 (
    echo Failed to start containers
    pause
    exit /b 1
)

echo Cleaning up old images...
docker image prune -f

echo Deployment completed successfully!
echo.
echo Services should be available at:
echo - Frontend: http://localhost:3150
echo - Backend API: http://localhost:8150/docs
echo.

docker compose ps

pause