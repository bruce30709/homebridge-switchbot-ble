#!/bin/bash

# SwitchBot BLE Child Bridge 測試腳本
# 執行一系列測試命令來測試 Child Bridge 功能

echo "========================================================"
echo "   SwitchBot BLE Child Bridge 手動測試腳本"
echo "========================================================"
echo

# 定義顏色代碼
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}測試環境:${NC}"
echo "- 操作系統: $(uname -a)"
echo "- Node.js版本: $(node -v)"

# 當前目錄
CURRENT_DIR=$(pwd)
echo "- 當前目錄: $CURRENT_DIR"
echo

# 測試1: 檢查配置
echo -e "${BLUE}測試 1: 檢查配置${NC}"
echo "運行驗證腳本..."
node verify-childbridge.js
if [ $? -eq 0 ]; then
    echo -e "${GREEN}驗證腳本執行成功${NC}"
else
    echo -e "${YELLOW}驗證腳本執行出現警告或錯誤${NC}"
fi
echo

# 測試2: 檢查模組載入
echo -e "${BLUE}測試 2: 檢查模組載入${NC}"
echo "嘗試載入index.js..."
NODE_OUTPUT=$(node -e "try { require('./index.js'); console.log('模組載入成功'); } catch(e) { console.error('模組載入失敗:', e.message); process.exit(1); }")
if [ $? -eq 0 ]; then
    echo -e "${GREEN}$NODE_OUTPUT${NC}"
else
    echo -e "${RED}$NODE_OUTPUT${NC}"
fi
echo

# 測試3: 嘗試掃描藍牙設備
echo -e "${BLUE}測試 3: 嘗試掃描藍牙設備${NC}"
echo "執行掃描命令(僅測試命令是否可執行)..."
node bot-cmd.mjs scan --timeout 3000 || echo -e "${RED}掃描命令執行失敗${NC}"
echo

# 測試4: 測試Child Bridge診斷工具
echo -e "${BLUE}測試 4: 執行Child Bridge診斷工具${NC}"
node childbridge-test.js
echo

# 測試5: 檢查Homebridge配置中的SwitchBot BLE平台
echo -e "${BLUE}測試 5: 檢查Homebridge配置${NC}"

# 尋找Homebridge配置目錄
HB_CONFIG_DIR=""
POSSIBLE_PATHS=(
    "$HOME/.homebridge"
    "/var/lib/homebridge"
    "/usr/local/lib/homebridge"
    "/opt/homebridge"
)

for path in "${POSSIBLE_PATHS[@]}"; do
    if [ -d "$path" ]; then
        HB_CONFIG_DIR="$path"
        break
    fi
done

if [ -z "$HB_CONFIG_DIR" ]; then
    echo -e "${RED}找不到Homebridge配置目錄${NC}"
else
    echo "Homebridge配置目錄: $HB_CONFIG_DIR"
    
    # 檢查config.json
    CONFIG_FILE="$HB_CONFIG_DIR/config.json"
    if [ -f "$CONFIG_FILE" ]; then
        echo "找到config.json"
        
        # 搜索SwitchbotBLE平台
        if grep -q "SwitchbotBLE" "$CONFIG_FILE"; then
            echo -e "${GREEN}找到SwitchbotBLE平台配置${NC}"
        else
            echo -e "${RED}未找到SwitchbotBLE平台配置${NC}"
            echo "請檢查config.json中的平台配置是否正確"
        fi
    else
        echo -e "${RED}找不到config.json檔案${NC}"
    fi
    
    # 檢查緩存
    CACHED_FILE="$HB_CONFIG_DIR/accessories/cachedAccessories"
    if [ -f "$CACHED_FILE" ]; then
        echo "緩存檔案存在，可能需要清理"
    fi
fi
echo

# 總結
echo -e "${BLUE}測試總結${NC}"
echo "如果上述測試顯示錯誤，請檢查:"
echo "1. config.json中的平台名稱是否正確設置為'SwitchbotBLE'"
echo "2. 清理Homebridge緩存並重新啟動服務"
echo "3. 確保藍牙適配器正常工作"
echo "4. 執行 'sudo systemctl restart homebridge' 或重新啟動Homebridge服務"
echo

echo "完整診斷:"
echo "1. 運行 'npm run test-childbridge' 獲取詳細診斷"
echo "2. 檢查Homebridge日誌中的錯誤信息"
echo "3. 確保config.json中的設備ID格式正確"
echo

echo -e "${GREEN}測試完成${NC}"
echo "========================================================" 