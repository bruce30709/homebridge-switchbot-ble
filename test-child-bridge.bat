@echo off
setlocal

:: SwitchBot BLE Child Bridge 測試腳本 (Windows版)
:: 執行一系列測試命令來測試 Child Bridge 功能

echo ========================================================
echo    SwitchBot BLE Child Bridge 手動測試腳本 (Windows版)
echo ========================================================
echo.

:: 顯示系統資訊
echo [測試環境]:
echo - 操作系統: Windows
ver
echo - Node.js版本: 
node -v
echo.

:: 當前目錄
echo - 當前目錄: %CD%
echo.

:: 測試1: 檢查配置
echo [測試 1: 檢查配置]
echo 運行驗證腳本...
node verify-childbridge.js
if %ERRORLEVEL% EQU 0 (
    echo [OK] 驗證腳本執行成功
) else (
    echo [WARNING] 驗證腳本執行出現警告或錯誤
)
echo.

:: 測試2: 檢查模組載入
echo [測試 2: 檢查模組載入]
echo 嘗試載入index.js...
node -e "try { require('./index.js'); console.log('[OK] 模組載入成功'); } catch(e) { console.error('[ERROR] 模組載入失敗:', e.message); process.exit(1); }"
echo.

:: 測試3: 嘗試掃描藍牙設備
echo [測試 3: 嘗試掃描藍牙設備]
echo 執行掃描命令(僅測試命令是否可執行)...
node bot-cmd.mjs scan --timeout 3000
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] 掃描命令執行失敗
)
echo.

:: 測試4: 測試Child Bridge診斷工具
echo [測試 4: 執行Child Bridge診斷工具]
node childbridge-test.js
echo.

:: 測試5: 檢查Homebridge配置中的SwitchBot BLE平台
echo [測試 5: 檢查Homebridge配置]

:: 尋找Homebridge配置目錄
set HB_CONFIG_DIR=

:: 嘗試找到Homebridge配置目錄
if exist "%USERPROFILE%\.homebridge" (
    set HB_CONFIG_DIR=%USERPROFILE%\.homebridge
)

if "%HB_CONFIG_DIR%"=="" (
    echo [ERROR] 找不到Homebridge配置目錄
) else (
    echo Homebridge配置目錄: %HB_CONFIG_DIR%
    
    :: 檢查config.json
    set CONFIG_FILE=%HB_CONFIG_DIR%\config.json
    if exist "%CONFIG_FILE%" (
        echo 找到config.json
        
        :: 搜索SwitchbotBLE平台
        findstr "SwitchbotBLE" "%CONFIG_FILE%" >nul
        if %ERRORLEVEL% EQU 0 (
            echo [OK] 找到SwitchbotBLE平台配置
        ) else (
            echo [ERROR] 未找到SwitchbotBLE平台配置
            echo 請檢查config.json中的平台配置是否正確
        )
    ) else (
        echo [ERROR] 找不到config.json檔案
    )
    
    :: 檢查緩存
    set CACHED_FILE=%HB_CONFIG_DIR%\accessories\cachedAccessories
    if exist "%CACHED_FILE%" (
        echo 緩存檔案存在，可能需要清理
    )
)
echo.

:: 總結
echo [測試總結]
echo 如果上述測試顯示錯誤，請檢查:
echo 1. config.json中的平台名稱是否正確設置為'SwitchbotBLE'
echo 2. 清理Homebridge緩存並重新啟動服務
echo 3. 確保藍牙適配器正常工作
echo 4. 重新啟動Homebridge服務
echo.

echo 完整診斷:
echo 1. 運行 'npm run test-childbridge' 獲取詳細診斷
echo 2. 檢查Homebridge日誌中的錯誤信息
echo 3. 確保config.json中的設備ID格式正確
echo.

echo [測試完成]
echo ========================================================

:: 暫停讓用戶看到結果
pause 