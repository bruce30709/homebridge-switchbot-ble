#!/usr/bin/env node

/**
 * SwitchBot BLE Child Bridge 診斷測試工具
 * 使用console.log直接測試Child Bridge功能
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec, execSync } = require('child_process');

// 輸出標頭
console.log('\n======================================================');
console.log('   SwitchBot BLE Child Bridge 診斷測試工具   ');
console.log('======================================================\n');

// 基本系統信息
console.log('【系統資訊】');
console.log(`操作系統: ${os.platform()} ${os.release()}`);
console.log(`Node.js版本: ${process.version}`);
console.log(`目前目錄: ${__dirname}`);
console.log(`用戶目錄: ${os.homedir()}`);
console.log('------------------------------------------------------\n');

// 檢查模組路徑
console.log('【模組路徑】');
console.log(`模組位置: ${path.resolve(__dirname)}`);
try {
    const modulePath = require.resolve('homebridge-switchbot-ble');
    console.log(`require解析路徑: ${modulePath}`);
} catch (e) {
    console.log(`require解析路徑失敗: ${e.message}`);
}
console.log('------------------------------------------------------\n');

// 檢查package.json
console.log('【Package.json 檢查】');
try {
    const packagePath = path.join(__dirname, 'package.json');
    console.log(`package.json路徑: ${packagePath}`);
    console.log(`檔案存在: ${fs.existsSync(packagePath)}`);

    if (fs.existsSync(packagePath)) {
        const packageContent = fs.readFileSync(packagePath, 'utf8');
        console.log(`檔案大小: ${packageContent.length} 字節`);

        const packageJson = JSON.parse(packageContent);
        console.log('解析成功，關鍵屬性:');
        console.log(`- name: ${packageJson.name}`);
        console.log(`- version: ${packageJson.version}`);
        console.log(`- main: ${packageJson.main}`);
        console.log(`- preferChildBridge: ${packageJson.preferChildBridge}`);

        if (!packageJson.preferChildBridge) {
            console.log('錯誤: preferChildBridge 未設定為 true');
        }

        if (!packageJson.keywords || !packageJson.keywords.includes('homebridge-platform')) {
            console.log('錯誤: 缺少 homebridge-platform 關鍵字');
        } else {
            console.log('- homebridge-platform 關鍵字存在');
        }
    }
} catch (e) {
    console.log(`檢查package.json時出錯: ${e.message}`);
    console.log(e.stack);
}
console.log('------------------------------------------------------\n');

// 檢查index.js
console.log('【Index.js 檢查】');
try {
    const indexPath = path.join(__dirname, 'index.js');
    console.log(`index.js路徑: ${indexPath}`);
    console.log(`檔案存在: ${fs.existsSync(indexPath)}`);

    if (fs.existsSync(indexPath)) {
        const indexContent = fs.readFileSync(indexPath, 'utf8');
        console.log(`檔案大小: ${indexContent.length} 字節`);

        console.log('關鍵函數檢查:');
        console.log(`- 包含registerAccessory: ${indexContent.includes('registerAccessory')}`);
        console.log(`- 包含registerPlatform: ${indexContent.includes('registerPlatform')}`);

        // 檢查平台名稱
        const platformNameMatch = indexContent.match(/registerPlatform\(['"]([^'"]+)['"]/);
        if (platformNameMatch) {
            const platformName = platformNameMatch[1];
            console.log(`- 平台名稱: ${platformName}`);

            if (platformName !== 'SwitchbotBLE') {
                console.log(`錯誤: 平台名稱不正確，當前為 ${platformName}，應為 SwitchbotBLE`);
            }
        } else {
            console.log('錯誤: 無法從代碼中提取平台名稱');
        }

        // 檢查平台類別
        const platformClassMatch = indexContent.match(/registerPlatform\([^,]+,\s*([A-Za-z0-9_]+)\)/);
        if (platformClassMatch) {
            const platformClass = platformClassMatch[1];
            console.log(`- 平台類別: ${platformClass}`);

            // 檢查類別是否定義
            if (!indexContent.includes(`class ${platformClass}`)) {
                console.log(`錯誤: 平台類 ${platformClass} 未在檔案中定義`);
            }
        } else {
            console.log('錯誤: 無法從代碼中提取平台類別名稱');
        }
    }
} catch (e) {
    console.log(`檢查index.js時出錯: ${e.message}`);
    console.log(e.stack);
}
console.log('------------------------------------------------------\n');

// 檢查 Homebridge 配置
console.log('【Homebridge 配置檢查】');
try {
    // 查找Homebridge配置目錄
    const possiblePaths = [
        path.join(os.homedir(), '.homebridge'),
        '/var/lib/homebridge',
        '/usr/local/lib/homebridge',
        '/opt/homebridge'
    ];

    let homeBridgeConfigPath = null;

    for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
            homeBridgeConfigPath = p;
            console.log(`找到Homebridge配置目錄: ${p}`);
            break;
        }
    }

    if (!homeBridgeConfigPath) {
        console.log('錯誤: 找不到Homebridge配置目錄');
    } else {
        const configPath = path.join(homeBridgeConfigPath, 'config.json');
        console.log(`config.json路徑: ${configPath}`);
        console.log(`檔案存在: ${fs.existsSync(configPath)}`);

        if (fs.existsSync(configPath)) {
            const configContent = fs.readFileSync(configPath, 'utf8');

            try {
                const config = JSON.parse(configContent);

                console.log('config.json 結構:');
                console.log(`- 包含bridge部分: ${!!config.bridge}`);
                console.log(`- 包含accessories部分: ${!!config.accessories}`);
                console.log(`- 包含platforms部分: ${!!config.platforms}`);

                if (config.platforms && Array.isArray(config.platforms)) {
                    console.log(`- platforms數量: ${config.platforms.length}`);

                    // 查找SwitchbotBLE平台
                    const switchbotPlatform = config.platforms.find(p =>
                        p.platform === 'SwitchbotBLE');

                    if (switchbotPlatform) {
                        console.log('找到SwitchbotBLE平台配置:');
                        console.log(`  - 名稱: ${switchbotPlatform.name}`);
                        console.log(`  - 調試模式: ${switchbotPlatform.debug}`);

                        const devices = switchbotPlatform.devices || [];
                        console.log(`  - 設備數量: ${devices.length}`);

                        if (devices.length > 0) {
                            console.log('  - 第一個設備:');
                            console.log(`    - 名稱: ${devices[0].name}`);
                            console.log(`    - 設備ID: ${devices[0].deviceId}`);
                            console.log(`    - 模式: ${devices[0].mode}`);
                        }
                    } else {
                        // 搜尋大小寫不同的可能平台名稱
                        const possibleSwitchbotPlatform = config.platforms.find(p =>
                            p.platform && p.platform.toLowerCase() === 'switchbotble');

                        if (possibleSwitchbotPlatform) {
                            console.log(`錯誤: 找到類似名稱的平台 "${possibleSwitchbotPlatform.platform}"，但大小寫不正確，應為 "SwitchbotBLE"`);
                        } else {
                            console.log('錯誤: config.json中未找到SwitchbotBLE平台配置');
                        }

                        // 列出所有平台名稱以便檢查
                        console.log('  已配置的平台:');
                        config.platforms.forEach(p => {
                            console.log(`  - ${p.platform}`);
                        });
                    }
                } else {
                    console.log('錯誤: config.json中沒有platforms部分或格式不正確');
                }

                // 檢查accessories部分是否包含Switchbot配置
                if (config.accessories && Array.isArray(config.accessories)) {
                    const switchbotAccessory = config.accessories.find(a =>
                        a.accessory === 'SwitchbotBLE' || a.accessory === 'SwitchbotSwitch');

                    if (switchbotAccessory) {
                        console.log('警告: 找到配件模式的Switchbot配置，這可能會與平台模式衝突');
                        console.log(`  - 配件類型: ${switchbotAccessory.accessory}`);
                        console.log(`  - 配件名稱: ${switchbotAccessory.name}`);
                    }
                }
            } catch (e) {
                console.log(`解析config.json時出錯: ${e.message}`);
                // 嘗試檢查格式問題
                console.log('檢查JSON格式...');
                try {
                    const jsonlint = require('jsonlint');
                    jsonlint.parse(configContent);
                    console.log('JSON格式有效，但解析中存在其他問題');
                } catch (lintError) {
                    console.log(`JSON格式無效: ${lintError.message}`);
                }
            }
        }

        // 檢查緩存
        const cachedAccessoriesPath = path.join(homeBridgeConfigPath, 'accessories', 'cachedAccessories');
        console.log(`\n緩存檢查:`);
        console.log(`緩存文件路徑: ${cachedAccessoriesPath}`);
        console.log(`緩存文件存在: ${fs.existsSync(cachedAccessoriesPath)}`);

        if (fs.existsSync(cachedAccessoriesPath)) {
            try {
                const cachedContent = fs.readFileSync(cachedAccessoriesPath, 'utf8');
                const cachedJson = JSON.parse(cachedContent);
                console.log(`緩存包含 ${cachedJson.length} 個配件`);

                // 查找SwitchBot相關配件
                const switchbotCached = cachedJson.filter(a =>
                    a.displayName && a.displayName.includes('SwitchBot') ||
                    a.context && a.context.deviceId);

                if (switchbotCached.length > 0) {
                    console.log(`找到 ${switchbotCached.length} 個SwitchBot相關緩存配件`);
                    console.log('建議清理緩存，重新啟動Homebridge');
                }
            } catch (e) {
                console.log(`解析緩存文件時出錯: ${e.message}`);
            }
        }
    }
} catch (e) {
    console.log(`檢查Homebridge配置時出錯: ${e.message}`);
    console.log(e.stack);
}
console.log('------------------------------------------------------\n');

// 嘗試動態加載index.js
console.log('【動態載入測試】');
try {
    const indexPath = path.join(__dirname, 'index.js');
    console.log(`嘗試動態載入: ${indexPath}`);

    // 創建模擬API對象
    const mockApi = {
        registerAccessory: (name, accessory) => {
            console.log(`- 成功註冊配件: ${name}`);
        },
        registerPlatform: (name, platform) => {
            console.log(`- 成功註冊平台: ${name}`);
        },
        hap: {
            Service: {},
            Characteristic: {}
        }
    };

    // 動態加載
    const indexModule = require(indexPath);

    if (typeof indexModule === 'function') {
        console.log('- index.js導出函數，嘗試調用');
        indexModule(mockApi);
        console.log('- 函數調用成功');
    } else {
        console.log(`錯誤: index.js導出的不是函數，而是 ${typeof indexModule}`);
    }
} catch (e) {
    console.log(`動態載入測試失敗: ${e.message}`);
    console.log(e.stack);
}
console.log('------------------------------------------------------\n');

// 嘗試運行基本命令
console.log('【基本命令測試】');
try {
    // 檢查Bot命令是否可執行
    const botCmdPath = path.join(__dirname, 'bot-cmd.mjs');
    console.log(`測試bot-cmd.mjs路徑: ${botCmdPath}`);
    console.log(`文件存在: ${fs.existsSync(botCmdPath)}`);

    if (fs.existsSync(botCmdPath)) {
        console.log('嘗試執行基本命令(僅測試，不進行實際掃描)...');
        const cmd = `node "${botCmdPath}" --help`;

        try {
            const output = execSync(cmd, { timeout: 5000 }).toString();
            console.log('命令執行成功');
            console.log(`輸出前50字符: ${output.substring(0, 50).replace(/\n/g, ' ')}...`);
        } catch (e) {
            console.log(`命令執行失敗: ${e.message}`);
        }
    }
} catch (e) {
    console.log(`基本命令測試失敗: ${e.message}`);
}
console.log('------------------------------------------------------\n');

// 最終診斷結果
console.log('【診斷總結】');
// 這部分能在前面診斷的基礎上提供總結建議
try {
    // Homebridge服務狀態檢查
    console.log('檢查Homebridge服務狀態...');
    let homebridgeRunning = false;

    try {
        // 不同系統有不同的命令
        const checkCmd = os.platform() === 'win32' ?
            'tasklist | findstr node' :
            'ps aux | grep homebridge | grep -v grep';

        const psOutput = execSync(checkCmd, { timeout: 3000 }).toString();
        homebridgeRunning = psOutput.includes('node') || psOutput.includes('homebridge');

        console.log(`Homebridge服務似乎${homebridgeRunning ? '正在運行' : '未運行'}`);
    } catch (e) {
        console.log('無法檢查Homebridge服務狀態');
    }

    // 提供總結建議
    console.log('\n可能的問題與解決方案:');

    if (!homebridgeRunning) {
        console.log('1. Homebridge服務未運行，請先啟動Homebridge服務');
    }

    console.log('2. 確保在config.json中使用正確的平台名稱: "SwitchbotBLE"');
    console.log('3. 清理Homebridge緩存後重新啟動服務');
    console.log('4. 確認藍牙適配器正常工作並且設備在範圍內');
    console.log('5. 檢查日誌中是否有相關錯誤信息');

    console.log('\n推薦操作順序:');
    console.log('1. 運行 "npm run verify" 檢查Child Bridge配置');
    console.log('2. 執行 "npm run fix-childbridge" 嘗試修復問題');
    console.log('3. 停止Homebridge服務，刪除緩存，然後重新啟動');
    console.log('4. 在config.json中確認平台配置正確且大小寫匹配');
    console.log('5. 如果仍有問題，手動重新安裝插件: npm uninstall -g homebridge-switchbot-ble && npm install -g homebridge-switchbot-ble');
} catch (e) {
    console.log(`生成診斷總結時出錯: ${e.message}`);
}

console.log('\n======================================================');
console.log('             診斷測試完成                   ');
console.log('======================================================\n'); 