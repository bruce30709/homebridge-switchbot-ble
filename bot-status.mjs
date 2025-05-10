#!/usr/bin/env node
/**
 * SwitchBot Bot 状态查询工具
 * 获取SwitchBot设备的当前状态
 */
import * as SwitchBotAPI from './switchbot-api-server.mjs';

// 获取命令行参数
const args = process.argv.slice(2);
const deviceId = args[0];

if (!deviceId) {
    console.error('错误: 未提供设备ID');
    console.log('用法: node bot-status.mjs <设备ID>');
    process.exit(1);
}

// 标准化MAC地址格式
function normalizeMacAddress(mac) {
    if (!mac) return null;
    if (/^([0-9a-f]{2}:){5}[0-9a-f]{2}$/i.test(mac)) {
        return mac.toLowerCase();
    }
    const cleanMac = mac.replace(/[^0-9a-f]/gi, '');
    if (cleanMac.length === 12) {
        return cleanMac.match(/.{1,2}/g).join(':').toLowerCase();
    }
    return mac.toLowerCase();
}

async function getDeviceStatus(deviceId) {
    try {
        // 先使用广播方式获取设备状态
        const normalizedDeviceId = normalizeMacAddress(deviceId);
        console.error(`尝试获取设备 ${normalizedDeviceId} 的状态...`);

        const status = await SwitchBotAPI.getBotStatus(normalizedDeviceId, { duration: 5000 });

        if (status && !status.error) {
            // 返回格式化的状态信息
            const result = {
                deviceId: status.deviceId,
                type: status.type,
                mode: status.mode || 'unknown',
                // 注意: 这里的isOn状态逻辑是反的，请在使用时注意反转
                // 在SwitchBot Bot设备中，"OFF"表示按钮未被按下（即开关可能处于"开"状态）
                // 这与HomeKit的逻辑相反，所以在index.js中我们会进行取反处理
                isOn: status.state === 'OFF',
                battery: status.battery
            };

            console.log(JSON.stringify(result, null, 2));
            return;
        }

        if (status && status.error) {
            console.error(`通过广播获取状态失败: ${status.error}`);
        }

        // 如果广播方式失败，尝试通过扫描并连接获取状态
        console.error('尝试通过扫描设备获取状态...');

        // 扫描设备
        const devices = await SwitchBotAPI.scanDevices({ duration: 3000 });
        const targetDevice = devices.find(d =>
            d.address.toLowerCase() === normalizedDeviceId.toLowerCase() ||
            (d.id && d.id.toLowerCase() === normalizedDeviceId.toLowerCase())
        );

        if (targetDevice) {
            console.error(`找到设备: ${targetDevice.address}`);

            // 如果已经从扫描中获取了状态信息
            if (targetDevice.state) {
                const result = {
                    deviceId: targetDevice.address,
                    type: targetDevice.type || 'Bot',
                    mode: targetDevice.mode || 'unknown',
                    // 注意: 这里的isOn状态逻辑是反的，请在使用时注意反转
                    // 在SwitchBot Bot设备中，"OFF"表示按钮未被按下（即开关可能处于"开"状态）
                    isOn: targetDevice.state === 'OFF',
                    battery: targetDevice.battery
                };

                // 只输出JSON到标准输出，其他消息输出到错误输出
                console.log(JSON.stringify(result, null, 2));
                return;
            }
        }

        // 如果以上方法都失败，返回默认状态（离线）
        console.error(`无法获取设备 ${normalizedDeviceId} 的状态`);
        const defaultResult = {
            deviceId: normalizedDeviceId,
            type: 'Bot',
            mode: 'unknown',
            isOn: false,
            error: '无法获取设备状态'
        };

        // 只输出干净的JSON结果
        console.log(JSON.stringify(defaultResult, null, 2));
    } catch (error) {
        console.error(`获取状态时发生错误: ${error.message}`);
        // 出错时返回基本的JSON对象，确保输出格式一致
        const errorResult = {
            deviceId: deviceId,
            type: 'Bot',
            mode: 'unknown',
            isOn: false,
            error: error.message
        };

        console.log(JSON.stringify(errorResult, null, 2));
    }
}

// 执行状态查询
getDeviceStatus(deviceId).finally(() => {
    // 确保程序在完成后退出
    setTimeout(() => {
        process.exit(0);
    }, 1000);
}); 