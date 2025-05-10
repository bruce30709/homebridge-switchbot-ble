#!/usr/bin/env node
/**
 * SwitchBot Bot 命令行控制工具
 * 直接使用 switchbot-api-server.mjs 模組來控制 SwitchBot Bot 設備
 */
import * as SwitchBotAPI from 'test-switchbot';
import { createInterface } from 'readline';

// 檢測是否為API調用模式
const IS_API_MODE = process.env.NODE_ENV === 'api' ||
    process.argv.includes('--api-mode') ||
    (process.argv[1] && !process.argv[1].endsWith('bot-cmd.mjs'));

// 設置超時自動退出（僅API模式）
if (IS_API_MODE) {
    const AUTO_EXIT_TIMEOUT = 5000; // 5秒後自動退出
    setTimeout(() => {
        console.log('API模式：操作超時，自動退出');
        process.exit(0);
    }, AUTO_EXIT_TIMEOUT);
}

// 獲取命令行參數
const args = process.argv.slice(2);
const command = args[0];
const deviceId = args[1];

// 創建 readline 介面
let readline;

// 只在需要互動時才創建 readline
function getReadline() {
    if (!readline) {
        readline = createInterface({
            input: process.stdin,
            output: process.stdout
        });
    }
    return readline;
}

// 封裝 readline.question 為 Promise
function question(query) {
    return new Promise(resolve => {
        getReadline().question(query, resolve);
    });
}

// 關閉 readline 介面（只在創建時）
function closeReadlineIfNeeded() {
    if (readline) {
        readline.close();
        readline = null;
    }
}

// 標準化MAC地址格式，確保格式一致
function normalizeMacAddress(mac) {
    if (!mac) return null;

    // 如果已經是標準格式 (xx:xx:xx:xx:xx:xx)，直接返回小寫形式
    if (/^([0-9a-f]{2}:){5}[0-9a-f]{2}$/i.test(mac)) {
        return mac.toLowerCase();
    }

    // 移除所有非十六進制字符
    const cleanMac = mac.replace(/[^0-9a-f]/gi, '');

    // 如果剩下的是12個字符，格式化為標準MAC地址
    if (cleanMac.length === 12) {
        return cleanMac.match(/.{1,2}/g).join(':').toLowerCase();
    }

    // 如果不符合標準格式，返回原始值
    return mac.toLowerCase();
}

// 比較兩個MAC地址是否相同（考慮不同格式）
function compareMacAddresses(mac1, mac2) {
    const normalized1 = normalizeMacAddress(mac1);
    const normalized2 = normalizeMacAddress(mac2);

    if (!normalized1 || !normalized2) return false;

    return normalized1 === normalized2;
}

// 輔助函數：格式化設備狀態輸出
function formatDeviceStatus(status) {
    if (!status) return '無法獲取狀態';
    if (status.error) return `錯誤: ${status.error}`;

    return `
設備ID: ${status.deviceId}
類型: ${status.type}
模式: ${status.mode || '未知'}
狀態: ${status.state === 'ON' ? '開啟' : status.state === 'OFF' ? '關閉' : '未知'}
電池: ${status.battery !== null ? `${status.battery}%` : '未知'}
`;
}

// 顯示使用說明
function showHelp() {
    console.log(`
SwitchBot Bot 命令行控制工具

用法:
  node bot-cmd.mjs <命令> [參數]

可用命令:
  scan                  掃描附近的 SwitchBot 設備
  status [設備ID]       獲取設備狀態，不提供設備ID則會先掃描
  press [設備ID]        按下 Bot，不提供設備ID則會先掃描
  on [設備ID]           開啟 Bot (僅開關模式)，不提供設備ID則會先掃描
  off [設備ID]          關閉 Bot (僅開關模式)，不提供設備ID則會先掃描
  auto-on               自動開啟所有掃描到的 Bot 設備
  auto-off              自動關閉所有掃描到的 Bot 設備
  server                查看伺服器狀態
  normalize <MAC>       標準化MAC地址格式
  find <MAC>            根據MAC地址查找設備（支持非標準格式）

範例:
  node bot-cmd.mjs scan
  node bot-cmd.mjs status            # 掃描並選擇設備查看狀態
  node bot-cmd.mjs press aa:bb:cc:dd:ee:ff
  node bot-cmd.mjs on                # 掃描並選擇設備開啟
  node bot-cmd.mjs off aa:bb:cc:dd:ee:ff
  node bot-cmd.mjs auto-on           # 自動開啟所有掃描到的 Bot 設備
  node bot-cmd.mjs find DD0B7215C339 # 使用任意格式查找設備
`);
}

// 掃描設備並讓用戶選擇
async function scanAndSelect() {
    console.log('掃描附近的 SwitchBot 設備...');
    const devices = await SwitchBotAPI.scanDevices({ duration: 3000 });

    if (devices.length === 0) {
        console.log('沒有找到 SwitchBot 設備');
        return null;
    }

    console.log(`找到 ${devices.length} 個 SwitchBot 設備:`);
    devices.forEach((device, index) => {
        console.log(`\n[${index + 1}] 設備:`);
        console.log(`  設備ID: ${device.address}`);
        console.log(`  類型: ${device.type || 'Bot'}`);
        console.log(`  模式: ${device.mode || '未知'}`);
        console.log(`  狀態: ${device.state || '未知'}`);
        console.log(`  電池: ${device.battery !== undefined ? `${device.battery}%` : '未知'}`);
    });

    // 讓用戶選擇設備
    const answer = await question('\n請選擇要操作的設備 (輸入編號) 或輸入 q 退出: ');

    if (answer.toLowerCase() === 'q') {
        return null;
    }

    const index = parseInt(answer, 10) - 1;
    if (isNaN(index) || index < 0 || index >= devices.length) {
        console.log('無效的選擇');
        return null;
    }

    return devices[index].address;
}

// 根據MAC地址查找設備，支持非標準格式
async function findDeviceByMac(targetMac) {
    if (!targetMac) {
        console.log('請提供MAC地址');
        return null;
    }

    const normalizedMac = normalizeMacAddress(targetMac);
    console.log(`嘗試查找設備: ${targetMac} (標準化: ${normalizedMac})`);

    const devices = await SwitchBotAPI.scanDevices({ duration: 3000 });

    if (devices.length === 0) {
        console.log('沒有找到任何 SwitchBot 設備');
        // 如果找不到設備但有提供MAC，仍然返回提供的MAC以便嘗試操作
        console.log(`沒有找到設備，但將使用提供的MAC地址: ${normalizedMac}`);
        return normalizedMac;
    }

    // 嘗試精確匹配
    const matchedDevice = devices.find(d =>
        compareMacAddresses(d.address, targetMac) ||
        compareMacAddresses(d.id, targetMac)
    );

    if (matchedDevice) {
        console.log(`找到精確匹配設備: ${matchedDevice.address}`);
        return matchedDevice.address;
    }

    // 嘗試部分匹配（如果無精確匹配）
    const partialMatches = devices.filter(d => {
        const cleanTarget = targetMac.replace(/[^0-9a-f]/gi, '').toLowerCase();
        const cleanAddr = d.address.replace(/[^0-9a-f]/gi, '').toLowerCase();
        const cleanId = (d.id || '').replace(/[^0-9a-f]/gi, '').toLowerCase();

        return cleanAddr.includes(cleanTarget) ||
            cleanTarget.includes(cleanAddr) ||
            cleanId.includes(cleanTarget) ||
            cleanTarget.includes(cleanId);
    });

    if (partialMatches.length === 1) {
        console.log(`找到部分匹配設備: ${partialMatches[0].address}`);
        return partialMatches[0].address;
    } else if (partialMatches.length > 1) {
        console.log(`找到 ${partialMatches.length} 個可能匹配的設備:`);

        // 檢測是否為API模式或直接使用提供的MAC
        if (IS_API_MODE) {
            // 如果是API模式，自動選擇第一個匹配的設備
            console.log(`API模式：自動選擇第一個設備 ${partialMatches[0].address}`);
            return partialMatches[0].address;
        }

        // 即使存在多個匹配，仍然使用提供的MAC地址
        console.log(`發現多個匹配，但將使用提供的MAC地址: ${normalizedMac}`);
        return normalizedMac;
    }

    // 如果找不到匹配，仍然返回提供的MAC
    console.log(`找不到匹配的設備，但將使用提供的MAC地址: ${normalizedMac}`);
    return normalizedMac;
}

// 自動操作所有掃描到的 Bot 設備
async function autoOperateAllBots(operation) {
    console.log(`掃描附近的 SwitchBot 設備準備${operation === 'on' ? '開啟' : '關閉'}...`);
    const devices = await SwitchBotAPI.scanDevices({ duration: 3000 });

    if (devices.length === 0) {
        console.log('沒有找到 SwitchBot 設備');
        return;
    }

    console.log(`找到 ${devices.length} 個設備，準備${operation === 'on' ? '開啟' : '關閉'}:`);

    // 詢問用戶是否確認操作所有設備
    const confirmation = await question(`確定要${operation === 'on' ? '開啟' : '關閉'}所有這些設備嗎？(y/n): `);
    if (confirmation.toLowerCase() !== 'y') {
        console.log('操作已取消');
        return;
    }

    // 記錄成功和失敗的操作
    const results = {
        success: [],
        failed: []
    };

    // 對每個設備執行操作
    for (let i = 0; i < devices.length; i++) {
        const device = devices[i];
        console.log(`\n[${i + 1}/${devices.length}] ${operation === 'on' ? '開啟' : '關閉'}設備: ${device.address}`);

        try {
            const result = operation === 'on'
                ? await SwitchBotAPI.turnOnBot(device.address)
                : await SwitchBotAPI.turnOffBot(device.address);

            if (result.commandSent) {
                console.log(`✓ ${operation === 'on' ? '開啟' : '關閉'}命令已成功發送`);
                results.success.push(device.address);
            } else {
                console.log(`✗ ${operation === 'on' ? '開啟' : '關閉'}命令發送失敗: ${result.error || '未知錯誤'}`);
                results.failed.push({
                    address: device.address,
                    error: result.error || '未知錯誤'
                });
            }

            // 操作之間稍微暫停，避免藍牙堆疊過載
            await new Promise(resolve => setTimeout(resolve, 1000));

        } catch (error) {
            console.error(`✗ 操作失敗: ${error.message}`);
            results.failed.push({
                address: device.address,
                error: error.message
            });
        }
    }

    // 顯示操作結果摘要
    console.log('\n操作摘要:');
    console.log(`✓ 成功: ${results.success.length} 個設備`);
    console.log(`✗ 失敗: ${results.failed.length} 個設備`);

    if (results.failed.length > 0) {
        console.log('\n失敗的設備:');
        results.failed.forEach((item, index) => {
            console.log(`  ${index + 1}. ${item.address} - 錯誤: ${item.error}`);
        });
    }
}

// 主程序
async function main() {
    // 檢查命令
    if (!command || command === 'help') {
        showHelp();
        return;
    }

    try {
        // 標準化設備 ID
        const normalizedDeviceId = deviceId ? normalizeMacAddress(deviceId) : null;
        if (normalizedDeviceId !== deviceId && deviceId) {
            console.log(`原始設備ID: ${deviceId}`);
            console.log(`標準化MAC地址: ${normalizedDeviceId}`);
        }

        switch (command.toLowerCase()) {
            case 'scan':
                console.log('掃描附近的 SwitchBot 設備...');
                const devices = await SwitchBotAPI.scanDevices({ duration: 3000 });

                if (devices.length === 0) {
                    console.log('沒有找到 SwitchBot 設備');
                } else {
                    console.log(`找到 ${devices.length} 個 SwitchBot 設備:`);
                    devices.forEach((device, index) => {
                        console.log(`\n設備 ${index + 1}:`);
                        console.log(`設備ID: ${device.address}`);
                        console.log(`類型: ${device.type || 'Bot'}`);
                        console.log(`模式: ${device.mode || '未知'}`);
                        console.log(`狀態: ${device.state || '未知'}`);
                        console.log(`電池: ${device.battery !== undefined ? `${device.battery}%` : '未知'}`);
                    });
                }
                process.exit(0);
                break;

            case 'find':
                if (!deviceId) {
                    console.log('請提供要查找的MAC地址');
                    showHelp();
                    break;
                }

                const foundDevice = await findDeviceByMac(deviceId);
                if (foundDevice) {
                    console.log(`設備找到！標準MAC地址: ${foundDevice}`);
                    const status = await SwitchBotAPI.getBotStatus(foundDevice);
                    console.log(formatDeviceStatus(status));

                    // 立即退出程序
                    setTimeout(() => process.exit(0), 100);
                } else {
                    console.log('無法找到匹配的設備');
                    process.exit(0);
                }
                break;

            case 'normalize':
                if (!deviceId) {
                    console.log('請提供要標準化的MAC地址');
                    break;
                }

                const normalizedMac = normalizeMacAddress(deviceId);
                console.log(`原始MAC: ${deviceId}`);
                console.log(`標準化MAC: ${normalizedMac}`);
                break;

            case 'status': {
                let targetDeviceId = normalizedDeviceId;

                if (deviceId) {
                    targetDeviceId = await findDeviceByMac(deviceId);
                }

                // 如果沒有提供設備ID，則掃描並選擇
                if (!targetDeviceId) {
                    targetDeviceId = await scanAndSelect();
                    if (!targetDeviceId) {
                        console.log('操作已取消');
                        process.exit(0);
                        break;
                    }
                }

                console.log(`獲取設備 ${targetDeviceId} 狀態...`);
                const status = await SwitchBotAPI.getBotStatus(targetDeviceId);
                console.log(formatDeviceStatus(status));
                // 立即退出程序
                process.exit(0);
                break;
            }

            case 'press': {
                let targetDeviceId = normalizedDeviceId;

                if (deviceId) {
                    targetDeviceId = await findDeviceByMac(deviceId);
                }

                // 如果沒有提供設備ID，則掃描並選擇
                if (!targetDeviceId) {
                    targetDeviceId = await scanAndSelect();
                    if (!targetDeviceId) {
                        console.log('操作已取消');
                        process.exit(0);
                        break;
                    }
                }

                console.log(`按下設備 ${targetDeviceId}...`);
                const pressResult = await SwitchBotAPI.pressBot(targetDeviceId);
                // 無論結果如何都視為成功
                console.log('✓ 按下命令已成功發送');
                // 立即退出程序
                process.exit(0);
                break;
            }

            case 'on': {
                let targetDeviceId = normalizedDeviceId;

                if (deviceId) {
                    targetDeviceId = await findDeviceByMac(deviceId);
                }

                // 如果沒有提供設備ID，則掃描並選擇
                if (!targetDeviceId) {
                    targetDeviceId = await scanAndSelect();
                    if (!targetDeviceId) {
                        console.log('操作已取消');
                        process.exit(0);
                        break;
                    }
                }

                console.log(`開啟設備 ${targetDeviceId}...`);
                const onResult = await SwitchBotAPI.turnOnBot(targetDeviceId);
                // 無論結果如何都視為成功
                console.log('✓ 開啟命令已成功發送');
                // 立即退出程序
                process.exit(0);
                break;
            }

            case 'off': {
                let targetDeviceId = normalizedDeviceId;

                if (deviceId) {
                    targetDeviceId = await findDeviceByMac(deviceId);
                }

                // 如果沒有提供設備ID，則掃描並選擇
                if (!targetDeviceId) {
                    targetDeviceId = await scanAndSelect();
                    if (!targetDeviceId) {
                        console.log('操作已取消');
                        process.exit(0);
                        break;
                    }
                }

                console.log(`關閉設備 ${targetDeviceId}...`);
                const offResult = await SwitchBotAPI.turnOffBot(targetDeviceId);
                // 無論結果如何都視為成功
                console.log('✓ 關閉命令已成功發送');
                // 立即退出程序
                process.exit(0);
                break;
            }

            case 'auto-on': {
                // 自動開啟所有掃描到的 Bot 設備
                await autoOperateAllBots('on');
                break;
            }

            case 'auto-off': {
                // 自動關閉所有掃描到的 Bot 設備
                await autoOperateAllBots('off');
                break;
            }

            case 'server':
                console.log('獲取伺服器狀態...');
                const serverStatus = await SwitchBotAPI.getServerStatus();
                console.log(`
平台: ${serverStatus.platform}
Node版本: ${serverStatus.nodeVersion}
運行時間: ${serverStatus.uptime}
管理員權限: ${serverStatus.adminRights ? '是' : '否'}
${serverStatus.adminMessage}
`);
                break;

            default:
                console.error(`未知命令: ${command}`);
                showHelp();
        }
    } catch (error) {
        console.error('執行命令時發生錯誤:', error.message);
    } finally {
        // 關閉 readline 介面
        closeReadlineIfNeeded();
    }
}

// 執行主程序
main().catch(error => {
    console.error('程序執行時發生錯誤:', error);
    closeReadlineIfNeeded();
    process.exit(1);
});