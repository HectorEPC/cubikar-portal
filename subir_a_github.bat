@echo off
title Subir Cubikar Portal a GitHub
cls
echo ====================================================
echo           SUBIENDO CUBIKAR PORTAL A GITHUB
echo ====================================================
echo.
echo Conectando con https://github.com/HectorEPC/cubikar-portal ...
echo.
git push -u origin main
if %ERRORLEVEL% equ 0 (
    echo.
    echo ====================================================
    echo    EXITO: El portal se subio correctamente.
    echo ====================================================
    echo Cloudflare Pages actualizara automaticamente el despliegue en produccion.
) else (
    echo.
    echo ====================================================
    echo    Hubo un problema al subir. Revisa tu conexion
    echo    o verifica que el repositorio en GitHub exista.
    echo ====================================================
)
echo.
pause
