@echo off
setlocal EnableExtensions EnableDelayedExpansion
chcp 936 >nul
REM PresentationMagicTool Build Script

echo Starting PresentationMagicTool build...

REM Check dependencies
echo Checking dependencies...

REM Check CMake
cmake --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Error: CMake not found
    echo Please download and install CMake from https://cmake.org/download/
    pause
    exit /b 1
)

REM Check compiler (MinGW g++ preferred). If not found, try MSVC (cl.exe)
set "GENERATOR=MinGW Makefiles"
g++ --version >nul 2>&1
if %errorlevel% neq 0 (
    where cl.exe >nul 2>&1
    if %errorlevel% neq 0 (
        echo Error: No C++ compiler found
        echo Please install MinGW-w64 or Visual Studio Build Tools.
        pause
        exit /b 1
    ) else (
    set "GENERATOR=Visual Studio 17 2022"
    echo Detected MSVC ^(cl.exe^). Using "%GENERATOR%".
    )
) else (
    echo Detected MinGW g++. Using "%GENERATOR%".
)

echo Dependencies check completed

REM Create build directory
echo Creating build directory...
if not exist build mkdir build
pushd build

REM Configure CMake
echo Configuring CMake...
cmake .. -G "%GENERATOR%" -DCMAKE_BUILD_TYPE=Release

if %errorlevel% neq 0 (
    echo CMake configuration failed!
    pause
    exit /b 1
)

REM Build
echo Starting compilation...
set "JOBS=%NUMBER_OF_PROCESSORS%"
if "%GENERATOR%"=="MinGW Makefiles" (
    cmake --build . --config Release -- -j %JOBS%
) else (
    cmake --build . --config Release -- /m
)

if %errorlevel% equ 0 (
    echo Build successful!
    echo Executable location: ..\bin\PresentationMagicTool.exe
    echo.
    echo To run the application:
    echo    ..\bin\PresentationMagicTool.exe
    if /i "%1"=="run" (
        echo.
        echo Launching application...
        start "PresentationMagicTool" "..\bin\PresentationMagicTool.exe"
    )
    echo.
    echo Features:
    echo - Windows GUI interface with buttons and controls
    echo - File loading and typewriter effect
    echo - Syntax highlighting support
    echo - Multiple file formats support
) else (
    echo Build failed!
    popd
    pause
    exit /b 1
)
popd
if /i not "%1"=="run" pause