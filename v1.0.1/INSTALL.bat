@echo off
REM BackupDrive - Installation pour Windows
REM ========================================

echo BackupDrive - Installation
echo.

REM Verifier Node.js
echo Verification de Node.js et npm...
node --version
npm --version
echo.

REM Nettoyer anciennes installations
echo Nettoyage des anciennes installations...
if exist node_modules rmdir /s /q node_modules
if exist package-lock.json del package-lock.json
echo.

REM Installer les dependances
echo Installation des dependances (peut prendre 2-3 minutes)...
echo.
npm install

REM Creer les dossiers
echo.
echo Creation des dossiers...
if not exist public mkdir public
if not exist src\assets mkdir src\assets

echo.
echo ===================================
echo Installation completee !
echo ===================================
echo.
echo Commandes disponibles :
echo.
echo Developpement :
echo   npm run dev          ^- Lance React + Electron
echo   npm run react-start  ^- Lance React seul (localhost:3000)
echo   npm run electron-dev ^- Lance Electron seul
echo.
echo Production :
echo   npm run react-build  ^- Build React
echo   npm run electron-build ^- Build executable
echo.
echo Pret a demarrer !
echo.
pause
