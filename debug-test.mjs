#!/usr/bin/env node
/**
 * SwitchBot 控制調試腳本
 * 用於診斷沒有日誌輸出的問題
 */
import * as SwitchBotAPI from './switchbot-api-server.mjs';

// 設置更詳細的調試環境
process.env.DEBUG = 'noble,noble-device,switchbot,*';

// 顯示進度函數
function showProgress(message) {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`[${timestamp}] ${message}`);
}

// 標準化MAC地址格式
function normalizeMacAddress(mac) {
    if (!mac) return null;
    if (/^([0-9a-f]{2}:){5}[0-9a-f]{2}$/i.test(mac)) return mac.toLowerCase();
    const cleanMac = mac.replace(/[^0-9a-f]/gi, '');
    if (cleanMac.length === 12) return cleanMac.match(/.{1,2}/g).join(':').toLowerCase();
    return mac.toLowerCase();
}

async function testCommand(deviceId, command) {
    // 1. 掃描設備
    showProgress(`開始掃描設備 (尋找 ${deviceId})...`);
    const scanDuration = 5000; // 增加掃描時間
    const devices = await SwitchBotAPI.scanDevices({ duration: scanDuration });

    showProgress(`掃描完成，找到 ${devices.length} 個設備`);

    // 列出所有找到的設備詳細資訊
    devices.forEach((device, i) => {
        console.log(`\n設備 ${i + 1}:`);
        console.log(JSON.stringify(device, null, 2));
    });

    // 檢查是否找到目標設備
    const normalizedId = normalizeMacAddress(deviceId);
    const targetDevice = devices.find(d => normalizeMacAddress(d.address) === normalizedId);

    if (targetDevice) {
        showProgress(`找到目標設備: ${targetDevice.address} (${targetDevice.type})`);
    } else {
        showProgress(`警告: 未在掃描中找到目標設備 ${normalizedId}`);
        showProgress(`將嘗試直接使用提供的設備ID進行控制`);
    }

    // 2. 執行命令
    showProgress(`開始執行 ${command} 命令...`);
    let result;

    try {
        switch (command.toLowerCase()) {
            case 'on':
                result = await SwitchBotAPI.turnOnBot(deviceId);
                break;
            case 'off':
                result = await SwitchBotAPI.turnOffBot(deviceId);
                break;
            case 'press':
                result = await SwitchBotAPI.pressBot(deviceId);
                break;
            default:
                showProgress(`未知命令: ${command}`);
                return;
        }

        // 顯示控制結果
        showProgress('命令執行結果:');
        console.log(JSON.stringify(result, null, 2));

        if (result.commandSent) {
            showProgress(`✅ ${command} 命令已發送`);
        } else {
            showProgress(`❌ ${command} 命令發送失敗`);
        }
    } catch (error) {
        showProgress(`❌ 執行時發生錯誤: ${error.message}`);
        console.error(error);
    }

    // 等待一段時間確保命令處理完成
    showProgress('等待 2 秒確保命令處理完成...');
    await new Promise(resolve => setTimeout(resolve, 2000));
}

async function main() {
    // 獲取命令行參數
    const args = process.argv.slice(2);
    const command = args[0] || 'on';  // 預設為 'on' 命令
    const deviceId = args[1];         // 設備 ID

    if (!deviceId) {
        console.error('錯誤: 請提供設備ID');
        console.log('用法: node debug-test.mjs [on|off|press] [設備ID]');
        process.exit(1);
    }

    showProgress('=== SwitchBot 控制調試開始 ===');
    showProgress(`命令: ${command}`);
    showProgress(`設備ID: ${deviceId}`);

    // 檢查是否有管理員權限
    const serverStatus = await SwitchBotAPI.getServerStatus();
    showProgress(`平台: ${serverStatus.platform}`);
    showProgress(`管理員權限: ${serverStatus.adminRights ? '是' : '否'}`);
    showProgress(`${serverStatus.adminMessage}`);

    if (!serverStatus.adminRights) {
        showProgress('⚠️ 警告: 未以管理員權限運行，藍牙控制可能受限');
    }

    // 執行測試
    await testCommand(deviceId, command);

    showProgress('=== 調試完成 ===');
}

// 執行主程序
main().catch(error => {
    console.error('程序執行錯誤:', error);
    process.exit(1);
}); 