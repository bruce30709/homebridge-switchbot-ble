@echo off
echo ===================================
echo Homebridge SwitchBot BLE Restart Utility
echo ===================================
echo.

echo This script will:
echo 1. Stop Homebridge service
echo 2. Clear Homebridge accessories and cache
echo 3. Restart Homebridge service
echo.

set /p confirm=Are you sure you want to continue? (y/n): 

if /i "%confirm%" neq "y" (
    echo Operation cancelled.
    exit /b
)

echo.
echo Stopping Homebridge service...
net stop homebridge 2>nul
if %errorlevel% equ 0 (
    echo Homebridge service stopped successfully.
) else (
    echo Homebridge is not running as a service or couldn't be stopped.
    echo Attempting to kill any running homebridge processes...
    taskkill /f /im homebridge.exe 2>nul
)

echo.
echo Clearing Homebridge cache...
set HOMEBRIDGE_DIR=%USERPROFILE%\.homebridge
if exist "%HOMEBRIDGE_DIR%\accessories" (
    echo Backing up accessories...
    if not exist "%HOMEBRIDGE_DIR%\backups" mkdir "%HOMEBRIDGE_DIR%\backups"
    set backup_file=accessories_backup_%date:~-4,4%%date:~-7,2%%date:~-10,2%_%time:~0,2%%time:~3,2%%time:~6,2%.json
    set backup_file=%backup_file: =0%
    copy "%HOMEBRIDGE_DIR%\accessories\*" "%HOMEBRIDGE_DIR%\backups\%backup_file%" >nul
    
    echo Removing accessories cache...
    del /q "%HOMEBRIDGE_DIR%\accessories\*" 2>nul
    echo Cache cleared.
) else (
    echo Accessories directory not found at %HOMEBRIDGE_DIR%\accessories
)

echo.
echo Starting Homebridge service...
net start homebridge 2>nul
if %errorlevel% equ 0 (
    echo Homebridge service started successfully.
) else (
    echo Failed to start Homebridge as a service.
    echo Please start Homebridge manually.
)

echo.
echo Operation completed.
echo NOTE: If you're using a Child Bridge, it should restart automatically with the main Homebridge service.
echo If you encounter any issues, check the Homebridge logs for details.
echo.

pause 