const path = require('path');
const { exec } = require('child_process');
const fs = require('fs');

// Create a log directory if it doesn't exist
const LOG_DIR = path.join(__dirname, 'logs');
if (!fs.existsSync(LOG_DIR)) {
    try {
        fs.mkdirSync(LOG_DIR);
    } catch (err) {
        console.error('Failed to create log directory:', err.message);
    }
}

// Log helper function
function logToFile(message, level = 'INFO') {
    try {
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
        const logFile = path.join(LOG_DIR, `switchbot-api-${today}.log`);
        const timestamp = new Date().toISOString();
        const logPrefix = `[${timestamp}] [${level}]`;
        const logMessage = `${logPrefix} ${message}\n`;
        fs.appendFileSync(logFile, logMessage);
    } catch (err) {
        console.error('Failed to write to log file:', err.message);
    }
}

module.exports = (api) => {
    // 仅注册为动态平台插件
    api.registerPlatform('homebridge-switchbot-ble', 'SwitchbotBLE', SwitchbotPlatform);
};

class SwitchbotPlatform {
    constructor(log, config, api) {
        this.log = log;
        this.config = config || {};
        this.api = api;
        this.accessories = [];
        this.PLUGIN_NAME = 'homebridge-switchbot-ble';

        // 确保设置了配件
        this.devices = this.config.devices || [];

        this.log.info('SwitchBot BLE Platform 初始化');
        logToFile('SwitchBot BLE Platform 初始化', 'PLATFORM');
        this.log.debug(`已設置 ${this.devices.length} 個 SwitchBot 設備`);
        logToFile(`已設置 ${this.devices.length} 個 SwitchBot 設備`, 'DEBUG');

        // 当 Homebridge 完全加载后发现设备
        this.api.on('didFinishLaunching', () => {
            this.log.debug('Finished launching, discovering accessories...');
            logToFile('Finished launching, discovering accessories...', 'PLATFORM');
            this.discoverDevices();
        });
    }

    // 配置从缓存中恢复的配件
    configureAccessory(accessory) {
        this.log.debug(`从缓存中恢复配件: ${accessory.displayName}`);
        logToFile(`从缓存中恢复配件: ${accessory.displayName}`, 'CACHE');

        // 为恢复的配件设置控制器
        const deviceInfo = accessory.context.device;
        if (deviceInfo) {
            this.configureController(accessory);
            // 将配件添加到追踪列表
            this.accessories.push(accessory);
        }
    }

    // 为配件设置控制器
    configureController(accessory) {
        const deviceInfo = accessory.context.device;
        if (!deviceInfo) {
            this.log.warn(`配件 ${accessory.displayName} 没有设备信息`);
            return;
        }

        // 创建并设置控制器
        new SwitchbotController(this.log, deviceInfo, this.api, accessory);
    }

    // 发现并注册设备
    discoverDevices() {
        this.log.info('Discovering accessories...');
        logToFile('Discovering accessories...', 'PLATFORM');

        // 检查配件列表
        if (this.devices.length === 0) {
            this.log.warn('No devices configured. Check your config.json');
            logToFile('No devices configured. Check your config.json', 'WARNING');
            return;
        }

        // 用于跟踪将要保留的配件
        const foundAccessories = [];

        // 为每个设备创建或更新配件
        for (const deviceConfig of this.devices) {
            // 确保每个设备有唯一的名称和设备ID
            if (!deviceConfig.name || !deviceConfig.deviceId) {
                this.log.warn('设备配置缺少必要字段，跳过:', JSON.stringify(deviceConfig));
                logToFile(`设备配置缺少必要字段，跳过: ${JSON.stringify(deviceConfig)}`, 'WARNING');
                continue;
            }

            // 创建唯一ID
            const uuid = this.api.hap.uuid.generate(deviceConfig.deviceId);

            // 检查是否已有此配件
            let accessory = this.accessories.find(a => a.UUID === uuid);

            if (accessory) {
                // 已有配件，更新信息
                this.log.info(`更新现有设备: ${deviceConfig.name} (${deviceConfig.deviceId})`);
                logToFile(`更新现有设备: ${deviceConfig.name} (${deviceConfig.deviceId})`, 'UPDATE');

                // 更新配件上下文
                accessory.context.device = deviceConfig;
                accessory.displayName = deviceConfig.name;

                // 重新配置控制器
                this.configureController(accessory);
            } else {
                // 创建新配件
                this.log.info(`添加新设备: ${deviceConfig.name} (${deviceConfig.deviceId})`);
                logToFile(`添加新设备: ${deviceConfig.name} (${deviceConfig.deviceId})`, 'ADD');

                // 创建平台配件
                accessory = new this.api.platformAccessory(deviceConfig.name, uuid);

                // 设置配件类型和数据
                accessory.category = this.api.hap.Categories.SWITCH;
                accessory.context.device = deviceConfig;

                // 配置控制器
                this.configureController(accessory);

                // 注册新配件
                this.api.registerPlatformAccessories(this.PLUGIN_NAME, 'SwitchbotBLE', [accessory]);
            }

            // 添加到已找到的配件列表
            foundAccessories.push(accessory);
        }

        // 处理需要移除的配件
        const accessoriesToRemove = this.accessories.filter(existingAccessory =>
            !foundAccessories.some(a => a.UUID === existingAccessory.UUID)
        );

        if (accessoriesToRemove.length > 0) {
            this.log.info(`移除 ${accessoriesToRemove.length} 个不再使用的配件`);
            logToFile(`移除 ${accessoriesToRemove.length} 个不再使用的配件`, 'REMOVE');
            this.api.unregisterPlatformAccessories(this.PLUGIN_NAME, 'SwitchbotBLE', accessoriesToRemove);
        }

        // 更新追踪的配件列表
        this.accessories = foundAccessories;

        this.log.info(`已成功发现和配置 ${this.accessories.length} 个设备`);
        logToFile(`已成功发现和配置 ${this.accessories.length} 个设备`, 'PLATFORM');
    }
}

// 控制器类，用於配置平台配件
class SwitchbotController {
    constructor(log, config, api, platformAccessory) {
        this.log = log;
        this.config = config;
        this.api = api;
        this.platformAccessory = platformAccessory;
        this.deviceId = config.deviceId;
        this.name = config.name;
        this.logPrefix = `[${this.name}] `;

        // 跟踪狀態 - 默认为关闭状态，避免初始化时错误触发命令
        this.currentState = false;

        // 獲取服務和特性引用
        this.Service = this.api.hap.Service;
        this.Characteristic = this.api.hap.Characteristic;

        // 配置配件服務
        this.configureServices();

        // 初始化时尝试获取设备状态
        this.refreshDeviceState();

        this.log.debug(`${this.logPrefix}SwitchbotController 初始化完成`);
        logToFile(`${this.logPrefix}SwitchbotController 初始化完成`, 'CONTROLLER');
    }

    configureServices() {
        // 添加開關服務
        this.switchService = this.platformAccessory.getService(this.Service.Switch) ||
            this.platformAccessory.addService(this.Service.Switch, this.name);

        // 配置開關特性
        this.switchService
            .getCharacteristic(this.Characteristic.On)
            .onGet(() => {
                this.log.debug(`${this.logPrefix}獲取開關狀態: ${this.currentState ? 'ON' : 'OFF'}`);
                logToFile(`${this.logPrefix}獲取開關狀態: ${this.currentState ? 'ON' : 'OFF'}`, 'STATE');
                // 返回當前跟踪的狀態
                return this.currentState;
            })
            .onSet(async (value) => {
                this.log.info(`${this.logPrefix}設置開關狀態為 ${value ? 'ON' : 'OFF'}`);
                logToFile(`${this.logPrefix}設置開關狀態為 ${value ? 'ON' : 'OFF'}`, 'STATE');

                // 更新跟踪的狀態
                this.currentState = value;

                // 立即返回新状态，不等待命令执行完成
                // 这样可以避免"This plugin slows down Homebridge"警告

                // 在后台执行命令
                setImmediate(() => {
                    this.executeCommand(value).catch(error => {
                        this.log.error(`${this.logPrefix}執行命令時發生錯誤: ${error.message}`);
                        logToFile(`${this.logPrefix}執行命令時發生錯誤: ${error.message}`, 'ERROR');
                    });
                });
            });

        // 配置信息服務
        this.infoService = this.platformAccessory.getService(this.Service.AccessoryInformation) ||
            this.platformAccessory.addService(this.Service.AccessoryInformation);

        this.infoService
            .setCharacteristic(this.Characteristic.Manufacturer, 'SwitchBot')
            .setCharacteristic(this.Characteristic.Model, 'Bot')
            .setCharacteristic(this.Characteristic.SerialNumber, this.deviceId || 'Unknown')
            .setCharacteristic(this.Characteristic.FirmwareRevision, '1.0.0');
    }

    // 執行命令
    async executeCommand(value) {
        const cmdPath = path.join(__dirname, 'bot-cmd.mjs');
        const cmd = value ? 'on' : 'off';
        const fullCmd = `node \"${cmdPath}\" ${cmd} ${this.deviceId}`;

        this.log.info(`${this.logPrefix}執行命令: ${fullCmd}`);
        logToFile(`${this.logPrefix}執行命令: ${fullCmd}`, 'COMMAND');

        // 設置最大重試次數
        const maxRetries = 5;
        let retryCount = 0;
        let lastError = null;

        // 重构为使用async/await和Promise来提高可靠性
        return new Promise(async (resolve) => {
            // 将命令执行包装成Promise
            const runCommand = () => {
                return new Promise((cmdResolve) => {
                    const retryPrefix = retryCount > 0 ? `[重試 ${retryCount}/${maxRetries}] ` : '';

                    if (retryCount > 0) {
                        this.log.info(`${this.logPrefix}${retryPrefix}執行重試命令`);
                        logToFile(`${this.logPrefix}${retryPrefix}執行重試命令`, 'RETRY');
                    }

                    exec(fullCmd, { timeout: 30000 }, (error, stdout, stderr) => {
                        if (stderr) {
                            this.log.debug(`${this.logPrefix}${retryPrefix}命令錯誤輸出: ${stderr}`);
                            logToFile(`${this.logPrefix}${retryPrefix}命令錯誤輸出: ${stderr}`, 'ERROR');
                        }

                        if (stdout) {
                            this.log.debug(`${this.logPrefix}${retryPrefix}命令標準輸出: ${stdout}`);
                            logToFile(`${this.logPrefix}${retryPrefix}命令標準輸出: ${stdout}`, 'DEBUG');
                        }

                        cmdResolve({ error, stdout, stderr });
                    });
                });
            };

            // 使用循环而不是递归来进行重试
            while (retryCount <= maxRetries) {
                const { error, stdout, stderr } = await runCommand();

                if (error) {
                    lastError = error;
                    this.log.error(`${this.logPrefix}命令執行錯誤: ${error.message}`);
                    logToFile(`${this.logPrefix}命令執行錯誤: ${error.message}`, 'ERROR');

                    if (error.stack) {
                        this.log.debug(`${this.logPrefix}错误堆栈: ${error.stack}`);
                        logToFile(`${this.logPrefix}错误堆栈: ${error.stack}`, 'DEBUG');
                    }

                    // 对所有错误都进行重试，不限于特定类型的错误
                    if (retryCount < maxRetries) {
                        retryCount++;
                        // 增加重试间隔时间，随着重试次数增加而增加
                        const waitTime = 1000 * Math.pow(1.5, retryCount - 1);
                        this.log.warn(`${this.logPrefix}命令失敗，將在 ${waitTime}ms 後進行第 ${retryCount}/${maxRetries} 次重試`);
                        logToFile(`${this.logPrefix}命令失敗，將在 ${waitTime}ms 後進行第 ${retryCount}/${maxRetries} 次重試`, 'RETRY');

                        // 等待一段时间后继续循环
                        await new Promise(wait => setTimeout(wait, waitTime));
                        continue;
                    } else {
                        // 達到最大重試次數
                        this.log.warn(`${this.logPrefix}達到最大重試次數 ${maxRetries}，但仍視為命令成功執行`);
                        logToFile(`${this.logPrefix}達到最大重試次數 ${maxRetries}，但仍視為命令成功執行`, 'WARNING');
                        break;
                    }
                } else {
                    // 命令执行成功
                    this.log.info(`${this.logPrefix}命令執行成功`);
                    logToFile(`${this.logPrefix}命令執行成功`, 'SUCCESS');
                    break;
                }
            }

            // 最终状态更新和完成处理
            this.log.info(`${this.logPrefix}最終處理結果: ${lastError ? '有錯誤但仍更新UI' : '成功'}, 狀態: ${this.currentState ? 'ON' : 'OFF'}`);
            logToFile(`${this.logPrefix}最終處理結果: ${lastError ? '有錯誤但仍更新UI' : '成功'}, 狀態: ${this.currentState ? 'ON' : 'OFF'}`, 'FINAL');

            resolve(this.currentState);
        });
    }

    // 尝试获取设备状态
    async refreshDeviceState() {
        this.log.info(`${this.logPrefix}正在初始化獲取設備狀態...`);
        logToFile(`${this.logPrefix}正在初始化獲取設備狀態...`, 'STATE');

        try {
            const cmdPath = path.join(__dirname, 'bot-status.mjs');
            const fullCmd = `node \"${cmdPath}\" ${this.deviceId}`;

            this.log.debug(`${this.logPrefix}執行狀態查詢: ${fullCmd}`);
            logToFile(`${this.logPrefix}執行狀態查詢: ${fullCmd}`, 'QUERY');

            // 尝试获取设备状态
            exec(fullCmd, { timeout: 10000 }, (error, stdout, stderr) => {
                if (error) {
                    this.log.warn(`${this.logPrefix}獲取設備狀態失敗: ${error.message}`);
                    logToFile(`${this.logPrefix}獲取設備狀態失敗: ${error.message}`, 'WARNING');
                    // 状态获取失败时保持默认状态
                    return;
                }

                if (stdout) {
                    try {
                        // 尝试解析状态信息，提取JSON部分
                        this.log.debug(`${this.logPrefix}設備狀態查詢結果: ${stdout}`);
                        logToFile(`${this.logPrefix}設備狀態查詢結果: ${stdout}`, 'STATE');

                        // 使用正则表达式从输出中提取JSON部分
                        const jsonMatch = stdout.match(/(\{[\s\S]*\})/);
                        if (jsonMatch && jsonMatch[1]) {
                            // 找到了JSON部分
                            const jsonString = jsonMatch[1];
                            const statusData = JSON.parse(jsonString);

                            this.log.info(`${this.logPrefix}成功解析設備狀態: ${jsonString}`);
                            logToFile(`${this.logPrefix}成功解析設備狀態: ${jsonString}`, 'STATE');

                            // 处理isOn属性取反的情况
                            if (statusData.hasOwnProperty('isOn')) {
                                this.currentState = statusData.isOn === true;
                            } else if (statusData.state === 'ON' || statusData.state === 'on') {
                                this.currentState = true
                            } else if (statusData.state === 'OFF' || statusData.state === 'off') {
                                this.currentState = false
                            }

                            this.log.info(`${this.logPrefix}初始化狀態設置為: ${this.currentState ? 'ON' : 'OFF'}`);
                            logToFile(`${this.logPrefix}初始化狀態設置為: ${this.currentState ? 'ON' : 'OFF'}`, 'STATE');

                            // 更新特性的缓存状态
                            this.updateCachedState();
                        } else {
                            throw new Error('找不到有效的JSON數據');
                        }
                    } catch (parseError) {
                        this.log.error(`${this.logPrefix}解析設備狀態失敗: ${parseError.message}`);
                        logToFile(`${this.logPrefix}解析設備狀態失敗: ${parseError.message}`, 'ERROR');
                    }
                }
            });
        } catch (e) {
            this.log.error(`${this.logPrefix}刷新設備狀態時發生錯誤: ${e.message}`);
            logToFile(`${this.logPrefix}刷新設備狀態時發生錯誤: ${e.message}`, 'ERROR');
        }
    }

    // 更新特性的缓存状态
    updateCachedState() {
        try {
            // 更新HomeKit缓存中的状态
            this.switchService.updateCharacteristic(this.Characteristic.On, this.currentState);
            this.log.debug(`${this.logPrefix}更新HomeKit缓存状态为: ${this.currentState ? 'ON' : 'OFF'}`);
            logToFile(`${this.logPrefix}更新HomeKit缓存状态为: ${this.currentState ? 'ON' : 'OFF'}`, 'CACHE');
        } catch (e) {
            this.log.error(`${this.logPrefix}更新特性缓存状态失败: ${e.message}`);
            logToFile(`${this.logPrefix}更新特性缓存状态失败: ${e.message}`, 'ERROR');
        }
    }
} 