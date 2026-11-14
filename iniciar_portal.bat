@echo off
chcp 65001 > nul
title Cubikar Portal Central (cubikar.com)
cd /d "%~dp0"
echo ==========================================================
echo    INICIANDO PORTAL CENTRAL CUBIKAR (cubikar.com)...
echo ==========================================================
echo Abriendo servidor local en http://localhost:3000/ ...
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0iniciar_portal.ps1"
if %errorlevel% neq 0 (
    echo.
    echo Ocurrio un problema al iniciar el servidor local.
    pause
)
pause
