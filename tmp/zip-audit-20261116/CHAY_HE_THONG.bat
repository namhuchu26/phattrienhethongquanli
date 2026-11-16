@echo off
chcp 65001 >nul
cd /d "%~dp0hrms"
where node >nul 2>nul
if errorlevel 1 (
  echo Can cai Node.js 24 hoac moi hon de chay he thong.
  pause
  exit /b 1
)
node -e "if(Number(process.versions.node.split('.')[0])<24)process.exit(1)"
if errorlevel 1 (
  echo Phien ban Node.js qua cu. Vui long dung Node.js 24 hoac moi hon.
  pause
  exit /b 1
)
echo.
echo HE THONG QUAN LY NHAN SU - NHOM 16
echo Mo trinh duyet tai: http://127.0.0.1:3000
echo Tai khoan: admin / Demo@12345
echo Dung he thong: Ctrl+C hoac dong cua so nay.
echo.
node server.mjs
pause
