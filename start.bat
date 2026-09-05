@echo off
setlocal

set ROOT=%~dp0
set BACKEND=%ROOT%backend
set FRONTEND=%ROOT%FrontendRework
set PYTHON=python

echo.
echo  ========================================
echo   Troxa.ai MVP — Starting...
echo  ========================================
echo.

:: ── Backend kurulum ─────────────────────────────────────
if not exist "%BACKEND%\.env" (
    echo [SETUP] .env bulunamadi, .env.example kopyalaniyor...
    copy "%BACKEND%\.env.example" "%BACKEND%\.env" >nul
    echo [SETUP] .env olusturuldu. FAL_KEY eklemek icin:
    echo         %BACKEND%\.env
    echo.
)

if not exist "%BACKEND%\venv" (
    echo [SETUP] Virtual environment olusturuluyor...
    "%PYTHON%" -m venv "%BACKEND%\venv"
)

set VENV_PY=%BACKEND%\venv\Scripts\python.exe

echo [SETUP] Gereksinimler kontrol ediliyor...
"%VENV_PY%" -m pip install -r "%BACKEND%\requirements.txt" -q --disable-pip-version-check

echo [SETUP] Migration kontrol ediliyor...
"%VENV_PY%" "%BACKEND%\manage.py" migrate -v 0 2>nul

:: ── Frontend kurulum ─────────────────────────────────────
if not exist "%FRONTEND%\node_modules" (
    echo [SETUP] npm paketleri yukleniyor...
    cd /d "%FRONTEND%"
    call npm install --silent
)

:: ── Servisleri baslat ────────────────────────────────────
echo.
echo  Backend  → http://localhost:8000
echo  Frontend → http://localhost:3001
echo.

start "Troxa Backend :8000" cmd /k ""%VENV_PY%" "%BACKEND%\manage.py" runserver 0.0.0.0:8000"
timeout /t 2 /nobreak >nul
start "Troxa Frontend :3001" cmd /k "cd /d "%FRONTEND%" && npm run dev -- --host"

echo  Her iki servis baslatildi.
echo  Kapatmak icin her iki pencereyi de kapatin.
echo.
endlocal
