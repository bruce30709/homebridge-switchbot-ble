#!/usr/bin/env node

/**
 * homebridge-switchbot-ble 安裝輔助腳本
 * 用於確保 Child Bridge 配置正確
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

// 顯示歡迎信息
console.log('\n\x1b[36m%s\x1b[0m', '🤖 SwitchBot BLE 安裝輔助工具');
console.log('\x1b[36m%s\x1b[0m', '============================');

// 檢查Node.js版本
const nodeVersion = process.version;
console.log(`Node.js 版本: ${nodeVersion}`);

// 確保 Node.js 版本符合要求
const versionMatch = nodeVersion.match(/^v(\d+)\./);
if (versionMatch && Number(versionMatch[1]) < 14) {
    console.error('\x1b[31m%s\x1b[0m', '⚠️ 警告: Node.js 版本應該 >= 14.x');
    console.log('請升級你的 Node.js 版本: https://nodejs.org/');
}

// 檢查操作系統
const platform = os.platform();
console.log(`操作系統: ${platform}`);

// 檢查管理員權限
let isAdmin = false;
try {
    if (platform === 'win32') {
        const output = execSync('powershell -command "([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)"').toString().trim();
        isAdmin = output === 'True';
    } else if (platform === 'linux' || platform === 'darwin') {
        const output = execSync('id -u').toString().trim();
        isAdmin = output === '0';
    }
    console.log(`管理員權限: ${isAdmin ? '是' : '否'}`);

    if (!isAdmin) {
        console.log('\x1b[33m%s\x1b[0m', '⚠️ 注意: 藍牙功能通常需要管理員權限才能正常工作');
    }
} catch (error) {
    console.error('檢查管理員權限時出錯:', error.message);
}

// 嘗試尋找 Homebridge 配置目錄
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

if (homeBridgeConfigPath) {
    console.log(`Homebridge 配置目錄: ${homeBridgeConfigPath}`);

    // 檢查配置文件
    const configPath = path.join(homeBridgeConfigPath, 'config.json');
    if (fs.existsSync(configPath)) {
        try {
            const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            const platforms = config.platforms || [];
            const switchbotPlatform = platforms.find(p => p.platform === 'SwitchbotBLE');

            if (switchbotPlatform) {
                console.log('\x1b[32m%s\x1b[0m', '✓ 在 config.json 中找到 SwitchBot BLE 平台配置');

                // 檢查設備配置
                const devices = switchbotPlatform.devices || [];
                console.log(`配置的設備數量: ${devices.length}`);

                if (devices.length > 0) {
                    console.log('\x1b[32m%s\x1b[0m', '✓ 設備配置看起來正確');
                } else {
                    console.log('\x1b[33m%s\x1b[0m', '⚠️ 警告: 未配置任何設備');
                    console.log('請在 config.json 中添加設備配置，或使用 Homebridge UI 進行設置');
                }
            } else {
                console.log('\x1b[33m%s\x1b[0m', '⚠️ 警告: 未在 config.json 中找到 SwitchBot BLE 平台配置');
                console.log('請參考以下範例配置:');
                console.log(`
{
    "platforms": [
        {
            "platform": "SwitchbotBLE",
            "name": "SwitchBot",
            "debug": true,
            "devices": [
                {
                    "name": "客廳開關",
                    "deviceId": "xx:xx:xx:xx:xx:xx",
                    "mode": "press"
                }
            ]
        }
    ]
}`);
            }
        } catch (error) {
            console.error('解析 config.json 時出錯:', error.message);
        }
    } else {
        console.log('\x1b[33m%s\x1b[0m', '⚠️ 警告: 未找到 config.json 文件');
    }

    // 檢查和清理緩存
    const accessoriesPath = path.join(homeBridgeConfigPath, 'accessories');
    if (fs.existsSync(accessoriesPath)) {
        console.log('\n清理 Homebridge 緩存可能有助於解決問題');
        console.log('停止 Homebridge 後，您可以手動刪除緩存文件:');
        console.log(`rm ${path.join(accessoriesPath, 'cachedAccessories')}`);
    }
} else {
    console.log('\x1b[33m%s\x1b[0m', '⚠️ 警告: 未找到 Homebridge 配置目錄');
}

// 開啟與關閉 Child Bridge 的說明
console.log('\n\x1b[36m%s\x1b[0m', '🔄 Child Bridge 相關說明:');
console.log('\x1b[36m%s\x1b[0m', '---------------------------');
console.log('1. Child Bridge 是獨立進程，可在 Homebridge UI 中單獨管理');
console.log('2. 如果 Child Bridge 無法啟動，請查看 Homebridge 日誌中的錯誤信息');
console.log('3. 確保在 package.json 中設置了 preferChildBridge: true');
console.log('4. 確保平台名稱為 "SwitchbotBLE"');
console.log('5. 嘗試重啟整個 Homebridge 服務');

// 藍牙相關說明
console.log('\n\x1b[36m%s\x1b[0m', '📱 藍牙相關說明:');
console.log('\x1b[36m%s\x1b[0m', '---------------');
console.log('1. 確保您的系統有可用的藍牙適配器');
console.log('2. 藍牙功能通常需要管理員權限');
console.log('3. 在 Windows 上可能需要先在設置中配對設備');
console.log('4. 設備應該在 1-2 米範圍內以確保穩定連接');
console.log('5. 使用提供的調試工具確認設備可被發現:');
console.log(`   node ${__dirname}/bot-cmd.mjs scan`);

console.log('\n\x1b[32m%s\x1b[0m', '✅ 安裝輔助工具執行完成!');
console.log('\x1b[32m%s\x1b[0m', '========================');
console.log('如有問題，請查看詳細文檔或提交 GitHub Issue\n'); 