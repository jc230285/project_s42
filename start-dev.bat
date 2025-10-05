@echo off
echo Starting Project S42 Development Servers...
echo.

echo [1/2] Starting Backend (FastAPI on port 8000)...
start "S42 Backend" cmd /k "cd backend && python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"
timeout /t 3 >nul

echo [2/2] Starting Frontend (Next.js on port 3000)...
start "S42 Frontend" cmd /k "cd frontend && npm run dev"

echo.
echo ============================================
echo Servers starting...
echo Frontend: http://localhost:3000
echo Backend:  http://localhost:8000
echo ============================================
