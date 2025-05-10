const SwitchbotAccessory = require('./switchbot-accessory');
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
    // 註冊為配件插件
    api.registerAccessory('SwitchbotBLE', SwitchbotAccessory);

    // 註冊為平台插件，用於Child Bridge支持
    api.registerPlatform('SwitchbotBLE', SwitchbotPlatform);
};

class SwitchbotPlatform {
    constructor(log, config, api) {
        this.log = log;
        this.config = config || {};
        this.api = api;
        this.accessories = [];
        this.PLUGIN_NAME = 'homebridge-switchbot-ble';

        // 確保設置了配件
        this.devices = this.config.devices || [];

        this.log.info('SwitchBot BLE Platform 初始化');
        logToFile('SwitchBot BLE Platform 初始化', 'PLATFORM');
        this.log.debug(`已設置 ${this.devices.length} 個 SwitchBot 設備`);
        logToFile(`已設置 ${this.devices.length} 個 SwitchBot 設備`, 'DEBUG');

        // 當 Homebridge 完全加載後註冊設備
        this.api.on('didFinishLaunching', () => {
            this.log.debug('Finished launching, configuring accessories...');
            logToFile('Finished launching, configuring accessories...', 'PLATFORM');
            this.configureAccessories();
        });
    }

    // 配置所有配件
    configureAccessories() {
        this.log.info('Configuring accessories...');
        logToFile('Configuring accessories...', 'PLATFORM');

        // 檢查配件列表
        if (this.devices.length === 0) {
            this.log.warn('No devices configured. Check your config.json');
            logToFile('No devices configured. Check your config.json', 'WARNING');
            return;
        }

        // 存儲需要發布的配件
        const externalAccessories = [];

        // 為每個設備創建配件
        for (const deviceConfig of this.devices) {
            // 確保每個設備有唯一的名稱和設備ID
            if (!deviceConfig.name || !deviceConfig.deviceId) {
                this.log.warn('設備配置缺少必要字段，跳過:', JSON.stringify(deviceConfig));
                logToFile(`設備配置缺少必要字段，跳過: ${JSON.stringify(deviceConfig)}`, 'WARNING');
                continue;
            }

            this.log.info(`添加設備: ${deviceConfig.name} (${deviceConfig.deviceId})`);
            logToFile(`添加設備: ${deviceConfig.name} (${deviceConfig.deviceId})`, 'DEVICE');

            // 創建唯一ID
            const uuid = this.api.hap.uuid.generate(deviceConfig.deviceId);

            // 創建平台配件
            const platformAccessory = new this.api.platformAccessory(deviceConfig.name, uuid);

            // 設置配件類型和數據
            platformAccessory.category = this.api.hap.Categories.SWITCH;
            platformAccessory.context.device = deviceConfig;

            // 用我們的 accessory 控制器配置平台配件
            const switchbotController = new SwitchbotController(this.log, deviceConfig, this.api, platformAccessory);

            // 添加到發布列表
            externalAccessories.push(platformAccessory);
            this.log.debug(`添加設備 ${deviceConfig.name} 到發布列表`);
            logToFile(`添加設備 ${deviceConfig.name} 到發布列表`, 'DEBUG');
        }

        // 發布外部配件
        if (externalAccessories.length > 0) {
            this.log.info(`將發布 ${externalAccessories.length} 個外部配件`);
            logToFile(`將發布 ${externalAccessories.length} 個外部配件`, 'PLATFORM');
            this.api.publishExternalAccessories(this.PLUGIN_NAME, externalAccessories);
            this.log.info(`已發布 ${externalAccessories.length} 個外部配件`);
            logToFile(`已發布 ${externalAccessories.length} 個外部配件`, 'PLATFORM');
        }

        this.log.info(`已成功配置 ${externalAccessories.length} 個設備`);
        logToFile(`已成功配置 ${externalAccessories.length} 個設備`, 'PLATFORM');
    }

    // 必要的方法（我們只處理外部配件，不支持緩存）
    configureAccessory(accessory) {
        this.log.debug(`從緩存中載入配件: ${accessory.displayName}`);
        logToFile(`從緩存中載入配件: ${accessory.displayName}`, 'CACHE');
        // 我們不保留緩存的配件，因為我們使用 publishExternalAccessories
    }
}

// 控制器類，用於配置平台配件
class SwitchbotController {
    constructor(log, config, api, platformAccessory) {
        this.log = log;
        this.config = config;
        this.api = api;
        this.platformAccessory = platformAccessory;
        this.deviceId = config.deviceId;
        this.name = config.name;
        this.logPrefix = `[${this.name}] `;

        // 跟踪狀態
        this.currentState = false;

        // 獲取服務和特性引用
        this.Service = this.api.hap.Service;
        this.Characteristic = this.api.hap.Characteristic;

        // 配置配件服務
        this.configureServices();

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
            .onSet((value) => {
                this.log.info(`${this.logPrefix}設置開關狀態為 ${value ? 'ON' : 'OFF'}`);
                logToFile(`${this.logPrefix}設置開關狀態為 ${value ? 'ON' : 'OFF'}`, 'STATE');

                // 更新跟踪的狀態
                this.currentState = value;

                // 直接執行命令
                return this.executeCommand(value);
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
        const maxRetries = 3;
        let retryCount = 0;
        let lastError = null;

        return new Promise((resolve) => {
            const attemptCommand = () => {
                // 添加重試計數到日誌
                const retryPrefix = retryCount > 0 ? `[重試 ${retryCount}/${maxRetries}] ` : '';
                if (retryCount > 0) {
                    this.log.info(`${this.logPrefix}${retryPrefix}重新嘗試執行命令: ${fullCmd}`);
                    logToFile(`${this.logPrefix}${retryPrefix}重新嘗試執行命令: ${fullCmd}`, 'RETRY');
                }

                exec(fullCmd, { timeout: 15000 }, (error, stdout, stderr) => {
                    if (stderr) {
                        this.log.debug(`${this.logPrefix}${retryPrefix}命令錯誤輸出: ${stderr}`);
                        logToFile(`${this.logPrefix}${retryPrefix}命令錯誤輸出: ${stderr}`, 'ERROR');
                    }

                    if (stdout) {
                        this.log.debug(`${this.logPrefix}${retryPrefix}命令標準輸出: ${stdout}`);
                        logToFile(`${this.logPrefix}${retryPrefix}命令標準輸出: ${stdout}`, 'DEBUG');
                    }

                    if (error) {
                        lastError = error;
                        this.log.error(`${this.logPrefix}${retryPrefix}命令執行錯誤: ${error.message}`);
                        logToFile(`${this.logPrefix}${retryPrefix}命令執行錯誤: ${error.message}`, 'ERROR');

                        // 檢查是否為 "deviceCache is not defined" 錯誤並重試
                        if ((error.message.includes("deviceCache is not defined") ||
                            error.message.includes("No devices found") ||
                            error.message.includes("Failed to execute") ||
                            error.message.includes("Timeout")) &&
                            retryCount < maxRetries) {

                            retryCount++;
                            this.log.info(`${this.logPrefix}將在 1 秒後進行第 ${retryCount} 次重試...`);
                            logToFile(`${this.logPrefix}將在 1 秒後進行第 ${retryCount} 次重試...`, 'RETRY');

                            // 在重試前稍微等待，避免立即重試可能導致的連續失敗
                            setTimeout(attemptCommand, 1000 * retryCount);
                            return;
                        } else {
                            // 已達最大重試次數或不是可重試的錯誤，但仍視為成功（更新 UI 狀態）
                            if (retryCount >= maxRetries) {
                                this.log.warn(`${this.logPrefix}達到最大重試次數 ${maxRetries}，但仍視為命令成功執行`);
                                logToFile(`${this.logPrefix}達到最大重試次數 ${maxRetries}，但仍視為命令成功執行`, 'WARNING');
                            } else {
                                this.log.warn(`${this.logPrefix}錯誤不可重試，但仍視為命令成功執行: ${error.message}`);
                                logToFile(`${this.logPrefix}錯誤不可重試，但仍視為命令成功執行: ${error.message}`, 'WARNING');
                            }
                        }
                    } else {
                        this.log.debug(`${this.logPrefix}${retryPrefix}命令執行成功`);
                        logToFile(`${this.logPrefix}${retryPrefix}命令執行成功`, 'SUCCESS');
                    }

                    // 成功後更新狀態
                    this.log.info(`${this.logPrefix}命令完成，當前狀態: ${this.currentState ? 'ON' : 'OFF'}`);
                    logToFile(`${this.logPrefix}命令完成，當前狀態: ${this.currentState ? 'ON' : 'OFF'}`, 'STATE');

                    resolve(this.currentState);
                });
            };

            // 開始第一次嘗試
            attemptCommand();
        });
    }
} 