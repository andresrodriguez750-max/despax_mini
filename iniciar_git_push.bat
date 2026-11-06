@echo off
title Git Push - Despax Mini
cd /d "%~dp0"
echo ====================================================================
echo  Subiendo despax_mini a GitHub:
echo  https://github.com/andresrodriguez750-max/despax_mini.git
echo ====================================================================
"C:\Users\Alumno\AppData\Local\GitHubDesktop\app-3.6.10\resources\app\git\cmd\git.exe" push -u origin main
echo.
if %ERRORLEVEL% EQU 0 (
    echo [EXITO] Los cambios fueron subidos correctamente a GitHub.
) else (
    echo [AVISO] Si te pide autenticacion, completa el inicio de sesion en el navegador o usa GitHub Desktop.
)
echo ====================================================================
pause
