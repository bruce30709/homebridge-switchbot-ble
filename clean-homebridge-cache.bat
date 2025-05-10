@echo off
setlocal EnableDelayedExpansion

echo ========================================================
echo    Homebridge 緩存清理工具
echo ========================================================
echo.

echo 此腳本將清理 Homebridge 緩存並協助您重新啟動服務
echo 請確保您具有足夠的權限，最好以管理員身份運行
echo.

set HB_CONFIG_DIR=%USERPROFILE%\.homebridge
set CACHE_FILE=!HB_CONFIG_DIR!\accessories\cachedAccessories

if not exist "!HB_CONFIG_DIR!" (
    echo [錯誤] 找不到 Homebridge 配置目錄: !HB_CONFIG_DIR!
    goto :EXIT
)

echo 配置目錄: !HB_CONFIG_DIR!

if not exist "!CACHE_FILE!" (
    echo [警告] 找不到緩存文件: !CACHE_FILE!
    echo 緩存可能已經被清理或位於其他位置
    goto :RESTART_QUESTION
)

:CONFIRM_DELETE
echo.
echo 找到緩存文件: !CACHE_FILE!
set /p CONFIRM="是否要刪除緩存? (Y/N): "
if /i "!CONFIRM!" neq "Y" goto :RESTART_QUESTION

echo.
echo 正在刪除緩存文件...
del "!CACHE_FILE!"

if exist "!CACHE_FILE!" (
    echo [錯誤] 無法刪除緩存文件，請檢查您是否有足夠權限
    echo 請嘗試手動刪除: !CACHE_FILE!
) else (
    echo [成功] 緩存文件已刪除
)

:RESTART_QUESTION
echo.
echo 接下來，您需要重新啟動 Homebridge 服務
echo 根據您的安裝方式，有不同的重啟方法:
echo.
echo 1. 如果使用 Homebridge UI: 在網頁界面點擊重啟
echo 2. 如果是 Windows 服務: 使用服務管理器重啟
echo 3. 如果是手動運行: 關閉命令窗口並重新啟動

set /p RESTART="是否要繼續(已完成緩存清理)? (Y/N): "
if /i "!RESTART!" neq "Y" goto :EXIT

echo.
echo [提示] 緩存已清理，請按照下列方式之一重啟 Homebridge:
echo.
echo 方法1: 如果通過 hb-service 安裝，使用此命令:
echo       hb-service restart
echo.
echo 方法2: 如果通過 Homebridge UI 安裝，訪問:
echo       http://localhost:8581
echo       並點擊"重啟"按鈕
echo.
echo 方法3: 如果手動運行，請停止現有進程並重新執行:
echo       homebridge
echo.

:EXIT
echo.
echo 按任意鍵退出...
pause > nul 