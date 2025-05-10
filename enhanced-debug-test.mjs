#!/usr/bin/env node
/**
 * SwitchBot 增強版控制調試腳本
 * 用於診斷沒有日誌輸出問題，使用增強版API
 */
import * as EnhancedAPI from './debug-enhanced-api.mjs';

// 設置更詳細的調試環境
process.env.DEBUG = 'noble,noble-device,switchbot,*';

// 命令行參數處理
function parseArguments() {
    const args = process.argv.slice(2);
    const options = {
        command: 'on', // 預設命令
        deviceId: null,
        retries: 3,    // 默認重試次數
        duration: 5000, // 默認掃描時間
        showHelp: false
    };

    for (let i = 0; i < args.length; i++) {
        const arg = args[i].toLowerCase();

        if (arg === '--help' || arg === '-h') {
            options.showHelp = true;
        } else if (arg === '--retries' || arg === '-r') {
            if (i + 1 < args.length) {
                const retries = parseInt(args[i + 1], 10);
                if (!isNaN(retries)) {
                    options.retries = retries;
                    i++;
                }
            }
        } else if (arg === '--duration' || arg === '-d') {
            if (i + 1 < args.length) {
                const duration = parseInt(args[i + 1], 10);
                if (!isNaN(duration)) {
                    options.duration = duration;
                    i++;
                }
            }
        } else if (['on', 'off', 'press'].includes(arg)) {
            options.command = arg;
        } else if (!options.deviceId) {
            // 假設是設備ID
            options.deviceId = args[i];
        }
    }

    return options;
}

// 顯示使用說明
function showHelp() {
    console.log(`
增強版 SwitchBot 控制調試工具

用法:
  node enhanced-debug-test.mjs [命令] [設備ID] [選項]

命令:
  on                   開啟設備 (預設)
  off                  關閉設備
  press                按下設備

必要參數:
  [設備ID]             設備MAC地址

選項:
  --retries, -r <次數> 設置重試次數 (預設: 3)
  --duration, -d <ms>  設置掃描持續時間 (預設: 5000ms)
  --help, -h           顯示此幫助

範例:
  node enhanced-debug-test.mjs on aa:bb:cc:dd:ee:ff
  node enhanced-debug-test.mjs off aa:bb:cc:dd:ee:ff -r 5
  node enhanced-debug-test.mjs press aa:bb:cc:dd:ee:ff -d 10000
`);
}

// 主要功能
async function main() {
    // 解析參數
    const options = parseArguments();

    // 顯示幫助
    if (options.showHelp || !options.deviceId) {
        showHelp();
        return;
    }

    console.log('=== 增強版 SwitchBot 控制調試開始 ===');
    console.log(`命令: ${options.command}`);
    console.log(`設備ID: ${options.deviceId}`);
    console.log(`重試次數: ${options.retries}`);
    console.log(`掃描時間: ${options.duration}ms`);

    // 檢查管理員權限
    const serverStatus = await EnhancedAPI.getServerStatus();
    console.log(`平台: ${serverStatus.platform}`);
    console.log(`Node版本: ${serverStatus.nodeVersion}`);
    console.log(`管理員權限: ${serverStatus.adminRights ? '是' : '否'}`);

    if (!serverStatus.adminRights) {
        console.log('⚠️ 警告: 未以管理員權限運行，藍牙控制可能受限');
        console.log('建議: 使用管理員權限重新運行此命令');
    }

    // 開始掃描程序 (總是先掃描一次以確認設備可見性)
    console.log('\n掃描設備...');
    const devices = await EnhancedAPI.scanDevices({
        duration: options.duration
    });

    if (devices.length === 0) {
        console.log('⚠️ 警告: 掃描未發現任何設備!');
    } else {
        console.log(`找到 ${devices.length} 個設備:`);

        devices.forEach((device, index) => {
            console.log(`\n設備 ${index + 1}:`);
            console.log(JSON.stringify(device, null, 2));
        });

        // 檢查目標設備是否在掃描結果中
        const targetDevice = devices.find(d =>
            d.address.toLowerCase() === options.deviceId.toLowerCase() ||
            (d.id && d.id.toLowerCase() === options.deviceId.toLowerCase())
        );

        if (targetDevice) {
            console.log(`\n✓ 目標設備 ${options.deviceId} 已找到!`);
            console.log(`設備類型: ${targetDevice.type}`);
            if (targetDevice.model) console.log(`設備型號: ${targetDevice.model}`);
            if (targetDevice.state) console.log(`設備狀態: ${targetDevice.state}`);
        } else {
            console.log(`\n⚠️ 警告: 目標設備 ${options.deviceId} 未在掃描中找到!`);
        }
    }

    // 執行命令
    console.log(`\n執行 ${options.command} 命令 (最多嘗試 ${options.retries + 1} 次)...`);

    // 執行命令並重試
    let success = false;
    let lastError = null;
    let result = null;

    for (let attempt = 0; attempt <= options.retries; attempt++) {
        if (attempt > 0) {
            console.log(`\n重試操作 (第 ${attempt} 次)...`);
            // 重試之間稍微等待一下
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        try {
            switch (options.command) {
                case 'on':
                    result = await EnhancedAPI.turnOnBot(options.deviceId);
                    break;
                case 'off':
                    result = await EnhancedAPI.turnOffBot(options.deviceId);
                    break;
                case 'press':
                    result = await EnhancedAPI.pressBot(options.deviceId);
                    break;
            }

            // 檢查實際執行結果
            if (result && result.actualResult === true) {
                console.log(`\n✓ 命令成功執行! (嘗試 ${attempt + 1}/${options.retries + 1})`);
                success = true;
                break;
            } else {
                const errorMsg = result && result.error ? result.error : '未知錯誤';
                console.log(`\n⚠️ 命令發送但執行未成功: ${errorMsg} (嘗試 ${attempt + 1}/${options.retries + 1})`);
                lastError = errorMsg;
            }
        } catch (error) {
            console.log(`\n✗ 執行出錯: ${error.message} (嘗試 ${attempt + 1}/${options.retries + 1})`);
            lastError = error.message;
        }
    }

    // 結果摘要
    console.log('\n執行結果摘要:');
    if (success) {
        console.log('✓ 操作成功完成!');
    } else {
        console.log(`✗ 所有嘗試均失敗。最後的錯誤: ${lastError}`);
    }

    if (result) {
        console.log('\n最後一次操作的詳細結果:');
        console.log(JSON.stringify(result, null, 2));
    }

    // 等待一段時間以確保所有日誌都被寫出
    console.log('\n等待最終結果處理...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log('\n=== 調試結束 ===');

    // 建議
    console.log('\n故障排除建議:');
    console.log('1. 確保您正在以管理員權限運行');
    console.log('2. 確保設備距離電腦夠近 (1-2米範圍內)');
    console.log('3. 如果在Windows上，嘗試先在藍牙設置中配對設備');
    console.log('4. 檢查設備電池電量');
    console.log('5. 嘗試使用不同的命令 (press/on/off)');
}

// 執行主程序
main().catch(error => {
    console.error('程序運行錯誤:', error);
    process.exit(1);
}); 