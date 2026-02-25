@echo off
setlocal

set ROOT_DIR=%~dp0

echo [1/4] Setting up backend...
cd /d "%ROOT_DIR%backend"

if not exist ".venv" (
    echo   Creating virtual environment...
    python -m venv .venv
)

call .venv\Scripts\activate.bat
pip install -q -r requirements.txt

echo [2/4] Setting up frontend...
cd /d "%ROOT_DIR%frontend"

if not exist "node_modules" (
    echo   Installing dependencies...
    call npm install --silent
)

echo [3/4] Starting backend on :8000...
cd /d "%ROOT_DIR%backend"
call .venv\Scripts\activate.bat
start "RefBib Backend" cmd /c "uvicorn app.main:app --reload --port 8000"

timeout /t 3 /nobreak >nul

echo [4/4] Starting frontend on :3000...
cd /d "%ROOT_DIR%frontend"
start "RefBib Frontend" cmd /c "npm run dev"

timeout /t 3 /nobreak >nul

echo.
echo ============================================
echo   RefBib is ready!
echo   Frontend: http://localhost:3000
echo   Backend:  http://localhost:8000
echo ============================================
echo   Close the terminal windows to stop.
echo.

pause
