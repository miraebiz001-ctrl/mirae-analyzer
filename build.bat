@echo off
chcp 65001 >nul
title 미래비즈온 AI분석툴 - EXE 빌드

echo.
echo ╔══════════════════════════════════════════╗
echo ║  미래비즈온 AI 타지역서비스 분석툴       ║
echo ║  Windows EXE 빌드 스크립트               ║
echo ╚══════════════════════════════════════════╝
echo.

:: Node.js 확인
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [오류] Node.js가 설치되어 있지 않습니다.
    echo https://nodejs.org 에서 LTS 버전을 설치해주세요.
    pause
    exit /b 1
)

echo [1/4] Node.js 버전: 
node --version
echo.

:: 의존성 설치
echo [2/4] 패키지 설치 중...
call npm install
if %errorlevel% neq 0 (
    echo [오류] 패키지 설치 실패
    pause
    exit /b 1
)
echo.

:: 로컬 테스트 여부
echo [3/4] 먼저 로컬에서 테스트하시겠습니까?
set /p TEST_YN="테스트 실행? (y/n): "
if /i "%TEST_YN%"=="y" (
    echo 앱을 실행합니다. 확인 후 창을 닫아주세요...
    call npx electron .
    echo.
)

:: EXE 빌드
echo [4/4] Windows EXE 빌드 시작...
echo (처음 빌드 시 Electron 바이너리 다운로드로 5~10분 소요)
echo.
call npm run build:win
if %errorlevel% neq 0 (
    echo [오류] 빌드 실패
    pause
    exit /b 1
)

echo.
echo ╔══════════════════════════════════════════╗
echo ║  ✅ 빌드 완료!                          ║
echo ║                                          ║
echo ║  dist 폴더에 설치파일이 생성되었습니다:  ║
echo ║  미래비즈온-AI분석툴-Setup-1.0.0-beta.exe║
echo ╚══════════════════════════════════════════╝
echo.

:: dist 폴더 열기
explorer dist

pause
