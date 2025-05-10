#!/usr/bin/env node

/**
 * SwitchBot BLE Child Bridge 驗證工具
 * 用於檢查 Child Bridge 配置是否正確並提供故障排除步驟
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

// 顯示歡迎信息
console.log('\n\x1b[36m%s\x1b[0m', '🔍 SwitchBot BLE Child Bridge 驗證工具');
console.log('\x1b[36m%s\x1b[0m', '====================================');

// 檢查 package.json
let packageJson;
try {
    packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
    console.log('\x1b[32m%s\x1b[0m', '✓ package.json 檢查通過');

    if (packageJson.preferChildBridge === true) {
        console.log('\x1b[32m%s\x1b[0m', '✓ preferChildBridge 設置正確');
    } else {
        console.log('\x1b[33m%s\x1b[0m', '⚠️ preferChildBridge 未設置為 true');
        console.log('   解決方法: 在 package.json 中添加: "preferChildBridge": true');
    }

    // 檢查是否包含 homebridge-platform 關鍵字
    const hasHomebridgePlatform = packageJson.keywords && packageJson.keywords.includes('homebridge-platform');
    if (hasHomebridgePlatform) {
        console.log('\x1b[32m%s\x1b[0m', '✓ 包含 homebridge-platform 關鍵字');
    } else {
        console.log('\x1b[33m%s\x1b[0m', '⚠️ 缺少 homebridge-platform 關鍵字');
        console.log('   解決方法: 在 package.json 的 keywords 中添加 "homebridge-platform"');
    }
} catch (error) {
    console.error('\x1b[31m%s\x1b[0m', '✗ 讀取 package.json 失敗:', error.message);
}

// 檢查 index.js
let platformRegistered = false;
try {
    const indexContent = fs.readFileSync(path.join(__dirname, 'index.js'), 'utf8');
    if (indexContent.includes('registerPlatform')) {
        console.log('\x1b[32m%s\x1b[0m', '✓ index.js 中註冊了平台');
        platformRegistered = true;

        // 檢查平台名稱一致性
        const platformNameMatch = indexContent.match(/registerPlatform\(['"](.*?)['"],/);
        if (platformNameMatch) {
            const platformName = platformNameMatch[1];
            console.log(`  平台名稱: ${platformName}`);

            if (platformName !== 'SwitchbotBLE') {
                console.log('\x1b[33m%s\x1b[0m', `⚠️ 平台名稱可能不一致，應為 'SwitchbotBLE'`);
            }
        }
    } else {
        console.log('\x1b[31m%s\x1b[0m', '✗ index.js 中未註冊平台，Child Bridge 將無法正常工作');
        console.log('   解決方法: 確保在 index.js 中使用 api.registerPlatform 註冊平台');
    }
} catch (error) {
    console.error('\x1b[31m%s\x1b[0m', '✗ 讀取 index.js 失敗:', error.message);
}

// 尋找 Homebridge 配置目錄
let homeBridgeConfigPath = '';
const possiblePaths = [
    path.join(os.homedir(), '.homebridge'),
    path.join('/var/lib/homebridge'),
    path.join('/usr/local/lib/homebridge'),
    path.join('/opt/homebridge')
];

for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
        homeBridgeConfigPath = p;
        break;
    }
}

// 檢查 Homebridge 配置文件
if (homeBridgeConfigPath) {
    console.log(`\nHomebridge 配置目錄: ${homeBridgeConfigPath}`);
    const configPath = path.join(homeBridgeConfigPath, 'config.json');
    if (fs.existsSync(configPath)) {
        try {
            const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            const platforms = config.platforms || [];
            const switchbotPlatform = platforms.find(p => p.platform === 'SwitchbotBLE');

            if (switchbotPlatform) {
                console.log('\x1b[32m%s\x1b[0m', '✓ 在 config.json 中找到 SwitchBot BLE 平台配置');
                console.log('\n配置內容:');
                console.log(JSON.stringify(switchbotPlatform, null, 2));

                if (switchbotPlatform.debug === true) {
                    console.log('\x1b[32m%s\x1b[0m', '✓ 調試模式已啟用');
                } else {
                    console.log('\x1b[33m%s\x1b[0m', '⚠️ 調試模式未啟用，開啟可能有助於診斷問題');
                    console.log('   解決方法: 在配置中添加 "debug": true');
                }

                // 檢查設備配置
                const devices = switchbotPlatform.devices || [];
                if (devices.length > 0) {
                    console.log('\x1b[32m%s\x1b[0m', `✓ 已配置 ${devices.length} 個設備`);
                } else {
                    console.log('\x1b[33m%s\x1b[0m', '⚠️ 未配置任何設備');
                }
            } else {
                console.log('\x1b[31m%s\x1b[0m', '✗ 在 config.json 中未找到 SwitchBot BLE 平台配置');
                console.log('\n您需要在 config.json 的 platforms 部分添加以下配置:');
                console.log(`
{
    "platform": "SwitchbotBLE",
    "name": "SwitchBot",
    "debug": true,
    "devices": [
        {
            "name": "客廳開關",
            "deviceId": "aa:bb:cc:dd:ee:ff",
            "mode": "press"
        }
    ]
}
`);
            }

            // 檢查是否啟用了 INSECURE MODE
            const bridgeConfig = config.bridge || {};
            if (bridgeConfig.insecureRequests === 1) {
                console.log('\x1b[32m%s\x1b[0m', '✓ 已啟用不安全模式 (insecureRequests=1)');
            } else {
                console.log('\x1b[33m%s\x1b[0m', '⚠️ 未啟用不安全模式，可能導致某些設備無法正常工作');
                console.log('   解決方法: 在配置的 bridge 部分添加 "insecureRequests": 1');
            }

        } catch (error) {
            console.error('\x1b[31m%s\x1b[0m', '✗ 解析 config.json 失敗:', error.message);
        }
    } else {
        console.log('\x1b[33m%s\x1b[0m', '⚠️ 未找到 config.json 文件');
    }
} else {
    console.log('\x1b[33m%s\x1b[0m', '⚠️ 未找到 Homebridge 配置目錄');
}

// 輔助命令：檢查插件安裝
let pluginStatus = {};
try {
    console.log('\n檢查插件安裝狀態...');
    const npmList = execSync('npm list -g homebridge-switchbot-ble', { timeout: 5000 }).toString();

    if (npmList.includes('homebridge-switchbot-ble@')) {
        console.log('\x1b[32m%s\x1b[0m', '✓ 插件已全局安裝');
        // 提取版本
        const versionMatch = npmList.match(/homebridge-switchbot-ble@([\d\.]+)/);
        if (versionMatch) {
            pluginStatus.version = versionMatch[1];
            console.log(`  已安裝版本: ${pluginStatus.version}`);
        }
    } else {
        console.log('\x1b[33m%s\x1b[0m', '⚠️ 插件未全局安裝，可能導致 Child Bridge 無法正常工作');
        console.log('   解決方法: 運行 npm install -g homebridge-switchbot-ble');
    }
} catch (error) {
    console.log('\x1b[33m%s\x1b[0m', '⚠️ 無法檢查插件安裝狀態');
}

// 故障排除提示
console.log('\n\x1b[36m%s\x1b[0m', '📋 Child Bridge 故障排除步驟:');
console.log('\x1b[36m%s\x1b[0m', '--------------------------------');
console.log('1. 確保 package.json 中有 "preferChildBridge": true');
console.log('2. 確保插件註冊了平台 (api.registerPlatform)');
console.log('3. 確保平台名稱一致 (SwitchbotBLE)');
console.log('4. 確保在 config.json 中添加了平台配置');
console.log('5. 刪除 Homebridge 的配件緩存');
console.log('   (停止 Homebridge 後刪除 ~/.homebridge/accessories/cachedAccessories)');
console.log('6. 重新安裝插件: npm uninstall -g homebridge-switchbot-ble && npm install -g homebridge-switchbot-ble');
console.log('7. 重啟 Homebridge 服務');

// 藍牙檢查
console.log('\n\x1b[36m%s\x1b[0m', '📡 藍牙檢查:');
console.log('\x1b[36m%s\x1b[0m', '-----------');
try {
    const testCmd = os.platform() === 'win32' ?
        'Get-PnpDevice -Class Bluetooth' :
        'hciconfig';

    const btTest = execSync(testCmd, { timeout: 5000 }).toString();

    if (btTest.includes('hci') || btTest.includes('Bluetooth')) {
        console.log('\x1b[32m%s\x1b[0m', '✓ 藍牙適配器已檢測到');
    } else {
        console.log('\x1b[33m%s\x1b[0m', '⚠️ 未檢測到藍牙適配器');
    }
} catch (error) {
    console.log('\x1b[33m%s\x1b[0m', '⚠️ 無法檢查藍牙狀態');
    console.log('   請確保藍牙適配器已連接並啟用');
}

console.log('\n\x1b[32m%s\x1b[0m', '✅ 驗證完成');
console.log('如有問題，請參考上述建議進行修復\n'); 