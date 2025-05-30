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
    // Register only as a dynamic platform plugin
    api.registerPlatform('homebridge-switchbot-ble', 'SwitchbotBLE', SwitchbotPlatform);
};

class SwitchbotPlatform {
    constructor(log, config, api) {
        this.log = log;
        this.config = config || {};
        this.api = api;
        this.accessories = [];
        this.PLUGIN_NAME = 'homebridge-switchbot-ble';

        // Ensure devices are set
        this.devices = this.config.devices || [];

        this.log.info('SwitchBot BLE Platform initialized');
        logToFile('SwitchBot BLE Platform initialized', 'PLATFORM');
        this.log.debug(`Configured ${this.devices.length} SwitchBot devices`);
        logToFile(`Configured ${this.devices.length} SwitchBot devices`, 'DEBUG');

        // When Homebridge is fully launched, discover devices
        this.api.on('didFinishLaunching', () => {
            this.log.debug('Finished launching, discovering accessories...');
            logToFile('Finished launching, discovering accessories...', 'PLATFORM');
            this.discoverDevices();
        });
    }

    // Configure accessory restored from cache
    configureAccessory(accessory) {
        this.log.debug(`Restored accessory from cache: ${accessory.displayName}`);
        logToFile(`Restored accessory from cache: ${accessory.displayName}`, 'CACHE');

        // Set controller for restored accessory
        const deviceInfo = accessory.context.device;
        if (deviceInfo) {
            this.configureController(accessory);
            // Add accessory to tracking list
            this.accessories.push(accessory);
        }
    }

    // Set controller for accessory
    configureController(accessory) {
        const deviceInfo = accessory.context.device;
        if (!deviceInfo) {
            this.log.warn(`Accessory ${accessory.displayName} has no device info`);
            return;
        }

        // Create and set controller
        new SwitchbotController(this.log, deviceInfo, this.api, accessory);
    }

    // Discover and register devices
    discoverDevices() {
        this.log.info('Discovering accessories...');
        logToFile('Discovering accessories...', 'PLATFORM');

        // Check device list
        if (this.devices.length === 0) {
            this.log.warn('No devices configured. Check your config.json');
            logToFile('No devices configured. Check your config.json', 'WARNING');
            return;
        }

        // Track accessories to keep
        const foundAccessories = [];

        // For each device, create or update accessory
        for (const deviceConfig of this.devices) {
            // Ensure each device has unique name and deviceId
            if (!deviceConfig.name || !deviceConfig.deviceId) {
                this.log.warn('Device config missing required fields, skipping:', JSON.stringify(deviceConfig));
                logToFile(`Device config missing required fields, skipping: ${JSON.stringify(deviceConfig)}`, 'WARNING');
                continue;
            }

            // Create unique ID
            const uuid = this.api.hap.uuid.generate(deviceConfig.deviceId);

            // Check if accessory already exists
            let accessory = this.accessories.find(a => a.UUID === uuid);

            if (accessory) {
                // Existing accessory, update info
                this.log.info(`Updating existing device: ${deviceConfig.name} (${deviceConfig.deviceId})`);
                logToFile(`Updating existing device: ${deviceConfig.name} (${deviceConfig.deviceId})`, 'UPDATE');

                // Update accessory context
                accessory.context.device = deviceConfig;
                accessory.displayName = deviceConfig.name;

                // Reconfigure controller
                this.configureController(accessory);
            } else {
                // Create new accessory
                this.log.info(`Adding new device: ${deviceConfig.name} (${deviceConfig.deviceId})`);
                logToFile(`Adding new device: ${deviceConfig.name} (${deviceConfig.deviceId})`, 'ADD');

                // Create platform accessory
                accessory = new this.api.platformAccessory(deviceConfig.name, uuid);

                // Set accessory type and data
                accessory.category = this.api.hap.Categories.SWITCH;
                accessory.context.device = deviceConfig;

                // Configure controller
                this.configureController(accessory);

                // Register new accessory
                this.api.registerPlatformAccessories(this.PLUGIN_NAME, 'SwitchbotBLE', [accessory]);
            }

            // Add to found accessories list
            foundAccessories.push(accessory);
        }

        // Handle accessories to remove
        const accessoriesToRemove = this.accessories.filter(existingAccessory =>
            !foundAccessories.some(a => a.UUID === existingAccessory.UUID)
        );

        if (accessoriesToRemove.length > 0) {
            this.log.info(`Removing ${accessoriesToRemove.length} unused accessories`);
            logToFile(`Removing ${accessoriesToRemove.length} unused accessories`, 'REMOVE');
            this.api.unregisterPlatformAccessories(this.PLUGIN_NAME, 'SwitchbotBLE', accessoriesToRemove);
        }

        // Update tracked accessories list
        this.accessories = foundAccessories;

        this.log.info(`Successfully discovered and configured ${this.accessories.length} devices`);
        logToFile(`Successfully discovered and configured ${this.accessories.length} devices`, 'PLATFORM');
    }
}

// Controller class, used to configure platform accessories
class SwitchbotController {
    constructor(log, config, api, platformAccessory) {
        this.log = log;
        this.config = config;
        this.api = api;
        this.platformAccessory = platformAccessory;
        this.deviceId = config.deviceId;
        this.name = config.name;
        this.logPrefix = `[${this.name}] `;

        // Track state - default to OFF to avoid triggering commands on init
        this.currentState = false;

        // 添加状态检查相关配置
        this.enableStatusCheck = config.enableStatusCheck || false;
        this.statusCheckInterval = config.statusCheckInterval || 60; // seconds, default 60s
        this.statusCheckTimer = null; // 用于存储定时器句柄

        // Get service and characteristic references
        this.Service = this.api.hap.Service;
        this.Characteristic = this.api.hap.Characteristic;

        // Configure accessory services
        this.configureServices();

        // Try to get device state on initialization
        this.refreshDeviceState();

        this.log.debug(`${this.logPrefix}SwitchbotController initialized`);
        logToFile(`${this.logPrefix}SwitchbotController initialized`, 'CONTROLLER');

        // 如果启用了状态检查，开始定时检查
        if (this.enableStatusCheck && this.deviceId) {
            this.startStatusCheckTimer();
            this.log.info(`${this.logPrefix}Automatic status check enabled, interval: ${this.statusCheckInterval}s`);
            logToFile(`${this.logPrefix}Automatic status check enabled, interval: ${this.statusCheckInterval}s`);
        }

        // 当插件停止时清除定时器
        this.api.on('shutdown', () => {
            this.stopStatusCheckTimer();
            this.log.info(`${this.logPrefix}Plugin shutting down, stopped status check timer`);
            logToFile(`${this.logPrefix}Plugin shutting down, stopped status check timer`);
        });
    }

    configureServices() {
        // Add switch service
        this.switchService = this.platformAccessory.getService(this.Service.Switch) ||
            this.platformAccessory.addService(this.Service.Switch, this.name);

        // Configure switch characteristic
        this.switchService
            .getCharacteristic(this.Characteristic.On)
            .onGet(() => {
                this.log.debug(`${this.logPrefix}Get switch state: ${this.currentState ? 'ON' : 'OFF'}`);
                logToFile(`${this.logPrefix}Get switch state: ${this.currentState ? 'ON' : 'OFF'}`, 'STATE');
                // Return current tracked state
                return this.currentState;
            })
            .onSet(async (value) => {
                this.log.info(`${this.logPrefix}Set switch state to ${value ? 'ON' : 'OFF'}`);
                logToFile(`${this.logPrefix}Set switch state to ${value ? 'ON' : 'OFF'}`, 'STATE');

                // Update tracked state
                this.currentState = value;

                // Immediately return new state, do not wait for command to finish
                // This avoids "This plugin slows down Homebridge" warning

                // Execute command in background
                setImmediate(() => {
                    this.executeCommand(value).catch(error => {
                        this.log.error(`${this.logPrefix}Error executing command: ${error.message}`);
                        logToFile(`${this.logPrefix}Error executing command: ${error.message}`, 'ERROR');
                    });
                });
            });

        // Configure information service
        this.infoService = this.platformAccessory.getService(this.Service.AccessoryInformation) ||
            this.platformAccessory.addService(this.Service.AccessoryInformation);

        this.infoService
            .setCharacteristic(this.Characteristic.Manufacturer, 'SwitchBot')
            .setCharacteristic(this.Characteristic.Model, 'Bot')
            .setCharacteristic(this.Characteristic.SerialNumber, this.deviceId || 'Unknown')
            .setCharacteristic(this.Characteristic.FirmwareRevision, '1.0.0');
    }

    // Execute command
    async executeCommand(value) {
        const cmdPath = path.join(__dirname, 'bot-cmd.mjs');
        const cmd = value ? 'on' : 'off';
        const fullCmd = `node "${cmdPath}" ${cmd} ${this.deviceId}`;

        this.log.info(`${this.logPrefix}Executing command: ${fullCmd}`);
        logToFile(`${this.logPrefix}Executing command: ${fullCmd}`, 'COMMAND');

        // Set max retry count
        const maxRetries = 5;
        let retryCount = 0;
        let lastError = null;

        // Refactor to use async/await and Promise for reliability
        return new Promise(async (resolve) => {
            // Wrap command execution as Promise
            const runCommand = () => {
                return new Promise((cmdResolve) => {
                    const retryPrefix = retryCount > 0 ? `[Retry ${retryCount}/${maxRetries}] ` : '';

                    if (retryCount > 0) {
                        this.log.info(`${this.logPrefix}${retryPrefix}Executing retry command`);
                        logToFile(`${this.logPrefix}${retryPrefix}Executing retry command`, 'RETRY');
                    }

                    exec(fullCmd, { timeout: 30000 }, (error, stdout, stderr) => {
                        if (stderr) {
                            this.log.debug(`${this.logPrefix}${retryPrefix}Command stderr: ${stderr}`);
                            logToFile(`${this.logPrefix}${retryPrefix}Command stderr: ${stderr}`, 'ERROR');
                        }

                        if (stdout) {
                            this.log.debug(`${this.logPrefix}${retryPrefix}Command stdout: ${stdout}`);
                            logToFile(`${this.logPrefix}${retryPrefix}Command stdout: ${stdout}`, 'DEBUG');
                        }

                        cmdResolve({ error, stdout, stderr });
                    });
                });
            };

            // Use loop instead of recursion for retries
            while (retryCount <= maxRetries) {
                const { error, stdout, stderr } = await runCommand();

                if (error) {
                    lastError = error;
                    this.log.error(`${this.logPrefix}Command execution error: ${error.message}`);
                    logToFile(`${this.logPrefix}Command execution error: ${error.message}`, 'ERROR');

                    if (error.stack) {
                        this.log.debug(`${this.logPrefix}Error stack: ${error.stack}`);
                        logToFile(`${this.logPrefix}Error stack: ${error.stack}`, 'DEBUG');
                    }

                    // Retry all errors, not limited to specific types
                    if (retryCount < maxRetries) {
                        retryCount++;
                        // Increase retry interval as retry count increases
                        const waitTime = 1000 * Math.pow(1.5, retryCount - 1);
                        this.log.warn(`${this.logPrefix}Command failed, will retry in ${waitTime}ms (attempt ${retryCount}/${maxRetries})`);
                        logToFile(`${this.logPrefix}Command failed, will retry in ${waitTime}ms (attempt ${retryCount}/${maxRetries})`, 'RETRY');

                        // Wait a while before next loop
                        await new Promise(wait => setTimeout(wait, waitTime));
                        continue;
                    } else {
                        // Max retry count reached
                        this.log.warn(`${this.logPrefix}Max retry count ${maxRetries} reached, but still treat as command success`);
                        logToFile(`${this.logPrefix}Max retry count ${maxRetries} reached, but still treat as command success`, 'WARNING');
                        break;
                    }
                } else {
                    // Command executed successfully
                    this.log.info(`${this.logPrefix}Command executed successfully`);
                    logToFile(`${this.logPrefix}Command executed successfully`, 'SUCCESS');
                    break;
                }
            }

            // Final state update and completion
            this.log.info(`${this.logPrefix}Final result: ${lastError ? 'Error but UI updated' : 'Success'}, state: ${this.currentState ? 'ON' : 'OFF'}`);
            logToFile(`${this.logPrefix}Final result: ${lastError ? 'Error but UI updated' : 'Success'}, state: ${this.currentState ? 'ON' : 'OFF'}`, 'FINAL');

            resolve(this.currentState);
        });
    }

    // Try to get device state
    async refreshDeviceState() {
        this.log.info(`${this.logPrefix}Initializing device state fetch...`);
        logToFile(`${this.logPrefix}Initializing device state fetch...`, 'STATE');

        try {
            const cmdPath = path.join(__dirname, 'bot-status.mjs');
            const fullCmd = `node "${cmdPath}" ${this.deviceId}`;

            this.log.debug(`${this.logPrefix}Executing state query: ${fullCmd}`);
            logToFile(`${this.logPrefix}Executing state query: ${fullCmd}`, 'QUERY');

            // Try to get device state
            exec(fullCmd, { timeout: 10000 }, (error, stdout, stderr) => {
                if (error) {
                    this.log.warn(`${this.logPrefix}Failed to get device state: ${error.message}`);
                    logToFile(`${this.logPrefix}Failed to get device state: ${error.message}`, 'WARNING');
                    // Keep default state if failed to get state
                    return;
                }

                if (stdout) {
                    try {
                        // 尝试解析状态信息，提取JSON部分
                        this.log.debug(`${this.logPrefix}Device status query result: ${stdout}`);
                        logToFile(`${this.logPrefix}Device status query result: ${stdout}`, 'STATE');

                        // 使用更可靠的方法提取JSON
                        let statusData;
                        try {
                            // 首先尝试直接解析整个输出
                            statusData = JSON.parse(stdout.trim());
                        } catch (initialError) {
                            // 如果直接解析失败，尝试找到并提取JSON对象
                            const jsonMatch = stdout.match(/(\{[\s\S]*?\})/);
                            if (jsonMatch && jsonMatch[1]) {
                                try {
                                    statusData = JSON.parse(jsonMatch[1]);
                                } catch (nestedError) {
                                    // 如果仍然解析失败，记录详细错误
                                    this.log.error(`${this.logPrefix}Failed to parse extracted JSON: ${nestedError.message}`);
                                    logToFile(`${this.logPrefix}Failed to parse extracted JSON: ${nestedError.message}`, 'ERROR');
                                    logToFile(`${this.logPrefix}Extracted content: ${jsonMatch[1]}`, 'ERROR');
                                    throw nestedError;
                                }
                            } else {
                                this.log.error(`${this.logPrefix}No valid JSON object found in output`);
                                logToFile(`${this.logPrefix}No valid JSON object found in output`, 'ERROR');
                                throw new Error('No valid JSON object found');
                            }
                        }

                        if (statusData) {
                            // 安全地将对象转回字符串用于日志
                            let jsonString;
                            try {
                                jsonString = JSON.stringify(statusData);
                                this.log.info(`${this.logPrefix}Successfully parsed device status: ${jsonString}`);
                                logToFile(`${this.logPrefix}Successfully parsed device status: ${jsonString}`, 'STATE');
                            } catch (stringifyError) {
                                this.log.warn(`${this.logPrefix}Could not stringify parsed data: ${stringifyError.message}`);
                                logToFile(`${this.logPrefix}Could not stringify parsed data: ${stringifyError.message}`, 'WARNING');
                            }

                            // 获取设备当前状态
                            let deviceIsOn = false;
                            // 检查并处理多种可能的状态格式
                            if (statusData.hasOwnProperty('isOn')) {
                                // 直接使用isOn属性
                                deviceIsOn = statusData.isOn === true;
                                this.log.debug(`${this.logPrefix}Using isOn property: ${deviceIsOn}`);
                            } else if (statusData.hasOwnProperty('state')) {
                                // 如果state是布尔值
                                if (typeof statusData.state === 'boolean') {
                                    deviceIsOn = statusData.state;
                                    this.log.debug(`${this.logPrefix}Using state as boolean: ${deviceIsOn}`);
                                }
                                // 如果state是字符串
                                else if (typeof statusData.state === 'string') {
                                    deviceIsOn = (statusData.state === 'ON' || statusData.state === 'on');
                                    this.log.debug(`${this.logPrefix}Using state as string: ${statusData.state} -> ${deviceIsOn}`);
                                }
                            }
                            // 如果没有isOn或state但有mode，可能是设备特定格式
                            else if (statusData.hasOwnProperty('mode') && typeof statusData.mode === 'boolean') {
                                // 有些设备用mode表示开关状态
                                deviceIsOn = statusData.mode;
                                this.log.debug(`${this.logPrefix}Using mode as state: ${deviceIsOn}`);
                            }

                            // 记录解析结果
                            this.log.info(`${this.logPrefix}Parsed device state from data: ${deviceIsOn ? 'ON' : 'OFF'}`);
                            logToFile(`${this.logPrefix}Parsed device state from data: ${deviceIsOn ? 'ON' : 'OFF'}`, 'PARSE');

                            // Handle isOn property inversion
                            if (statusData.hasOwnProperty('isOn')) {
                                this.currentState = statusData.isOn === true;
                            } else if (statusData.state === 'ON' || statusData.state === 'on') {
                                this.currentState = true
                            } else if (statusData.state === 'OFF' || statusData.state === 'off') {
                                this.currentState = false
                            }

                            this.log.info(`${this.logPrefix}Initialized state set to: ${this.currentState ? 'ON' : 'OFF'}`);
                            logToFile(`${this.logPrefix}Initialized state set to: ${this.currentState ? 'ON' : 'OFF'}`, 'STATE');

                            // Update cached state for characteristics
                            this.updateCachedState();
                        } else {
                            throw new Error('No valid JSON data found');
                        }
                    } catch (parseError) {
                        this.log.error(`${this.logPrefix}Failed to parse device state: ${parseError.message}`);
                        logToFile(`${this.logPrefix}Failed to parse device state: ${parseError.message}`, 'ERROR');
                    }
                }
            });
        } catch (e) {
            this.log.error(`${this.logPrefix}Error refreshing device state: ${e.message}`);
            logToFile(`${this.logPrefix}Error refreshing device state: ${e.message}`, 'ERROR');
        }
    }

    // Update cached state for characteristics
    updateCachedState() {
        try {
            // Update HomeKit cached state
            this.switchService.updateCharacteristic(this.Characteristic.On, this.currentState);
            this.log.debug(`${this.logPrefix}Update HomeKit cached state to: ${this.currentState ? 'ON' : 'OFF'}`);
            logToFile(`${this.logPrefix}Update HomeKit cached state to: ${this.currentState ? 'ON' : 'OFF'}`, 'CACHE');
        } catch (e) {
            this.log.error(`${this.logPrefix}Failed to update characteristic cached state: ${e.message}`);
            logToFile(`${this.logPrefix}Failed to update characteristic cached state: ${e.message}`, 'ERROR');
        }
    }

    // 添加启动定时器的函数
    startStatusCheckTimer() {
        // 清除已有的定时器
        if (this.statusCheckTimer) {
            clearInterval(this.statusCheckTimer);
        }

        this.log.info(`${this.logPrefix}Status check timer started with interval ${this.statusCheckInterval}s`);
        logToFile(`${this.logPrefix}Status check timer started with interval ${this.statusCheckInterval}s`);

        // 设置新定时器
        this.statusCheckTimer = setInterval(() => {
            this.checkDeviceStatus();
        }, this.statusCheckInterval * 1000);
    }

    // 停止定时器
    stopStatusCheckTimer() {
        if (this.statusCheckTimer) {
            clearInterval(this.statusCheckTimer);
            this.statusCheckTimer = null;
            this.log.info(`${this.logPrefix}Status check timer stopped`);
            logToFile(`${this.logPrefix}Status check timer stopped`);
        }
    }

    // 设备状态检查函数
    async checkDeviceStatus() {
        if (!this.deviceId) {
            return;
        }

        const timestamp = new Date().toISOString();
        this.log.info(`${this.logPrefix}[${timestamp}] Running scheduled status check for device: ${this.deviceId}`);
        logToFile(`${this.logPrefix}Running scheduled status check for device: ${this.deviceId}`);

        try {
            const cmdPath = path.join(__dirname, 'bot-status.mjs');
            const fullCmd = `node "${cmdPath}" ${this.deviceId}`;

            this.log.debug(`${this.logPrefix}Executing state query: ${fullCmd}`);
            logToFile(`${this.logPrefix}Executing state query: ${fullCmd}`, 'QUERY');

            // 尝试获取设备状态
            exec(fullCmd, { timeout: 10000 }, (error, stdout, stderr) => {
                if (error) {
                    this.log.warn(`${this.logPrefix}Failed to get device state: ${error.message}`);
                    logToFile(`${this.logPrefix}Failed to get device state: ${error.message}`, 'WARNING');
                    return;
                }

                if (stdout) {
                    try {
                        // 尝试解析状态信息，提取JSON部分
                        this.log.debug(`${this.logPrefix}Device status query result: ${stdout}`);
                        logToFile(`${this.logPrefix}Device status query result: ${stdout}`, 'STATE');

                        // 使用更可靠的方法提取JSON
                        let statusData;
                        try {
                            // 首先尝试直接解析整个输出
                            statusData = JSON.parse(stdout.trim());
                        } catch (initialError) {
                            // 如果直接解析失败，尝试找到并提取JSON对象
                            const jsonMatch = stdout.match(/(\{[\s\S]*?\})/);
                            if (jsonMatch && jsonMatch[1]) {
                                try {
                                    statusData = JSON.parse(jsonMatch[1]);
                                } catch (nestedError) {
                                    // 如果仍然解析失败，记录详细错误
                                    this.log.error(`${this.logPrefix}Failed to parse extracted JSON: ${nestedError.message}`);
                                    logToFile(`${this.logPrefix}Failed to parse extracted JSON: ${nestedError.message}`, 'ERROR');
                                    logToFile(`${this.logPrefix}Extracted content: ${jsonMatch[1]}`, 'ERROR');
                                    throw nestedError;
                                }
                            } else {
                                this.log.error(`${this.logPrefix}No valid JSON object found in output`);
                                logToFile(`${this.logPrefix}No valid JSON object found in output`, 'ERROR');
                                throw new Error('No valid JSON object found');
                            }
                        }

                        if (statusData) {
                            // 安全地将对象转回字符串用于日志
                            let jsonString;
                            try {
                                jsonString = JSON.stringify(statusData);
                                this.log.info(`${this.logPrefix}Successfully parsed device status: ${jsonString}`);
                                logToFile(`${this.logPrefix}Successfully parsed device status: ${jsonString}`, 'STATE');
                            } catch (stringifyError) {
                                this.log.warn(`${this.logPrefix}Could not stringify parsed data: ${stringifyError.message}`);
                                logToFile(`${this.logPrefix}Could not stringify parsed data: ${stringifyError.message}`, 'WARNING');
                            }

                            // 获取设备当前状态
                            let deviceIsOn = false;
                            // 检查并处理多种可能的状态格式
                            if (statusData.hasOwnProperty('isOn')) {
                                // 直接使用isOn属性
                                deviceIsOn = statusData.isOn === true;
                                this.log.debug(`${this.logPrefix}Using isOn property: ${deviceIsOn}`);
                            } else if (statusData.hasOwnProperty('state')) {
                                // 如果state是布尔值
                                if (typeof statusData.state === 'boolean') {
                                    deviceIsOn = statusData.state;
                                    this.log.debug(`${this.logPrefix}Using state as boolean: ${deviceIsOn}`);
                                }
                                // 如果state是字符串
                                else if (typeof statusData.state === 'string') {
                                    deviceIsOn = (statusData.state === 'ON' || statusData.state === 'on');
                                    this.log.debug(`${this.logPrefix}Using state as string: ${statusData.state} -> ${deviceIsOn}`);
                                }
                            }
                            // 如果没有isOn或state但有mode，可能是设备特定格式
                            else if (statusData.hasOwnProperty('mode') && typeof statusData.mode === 'boolean') {
                                // 有些设备用mode表示开关状态
                                deviceIsOn = statusData.mode;
                                this.log.debug(`${this.logPrefix}Using mode as state: ${deviceIsOn}`);
                            }

                            // 记录解析结果
                            this.log.info(`${this.logPrefix}Parsed device state from data: ${deviceIsOn ? 'ON' : 'OFF'}`);
                            logToFile(`${this.logPrefix}Parsed device state from data: ${deviceIsOn ? 'ON' : 'OFF'}`, 'PARSE');

                            // 记录当前状态
                            this.log.debug(`${this.logPrefix}Current device state: ${deviceIsOn ? 'ON' : 'OFF'}, HomeKit state: ${this.currentState ? 'ON' : 'OFF'}`);
                            logToFile(`${this.logPrefix}Current device state: ${deviceIsOn ? 'ON' : 'OFF'}, HomeKit state: ${this.currentState ? 'ON' : 'OFF'}`, 'DEBUG');

                            // 如果状态不同，更新HomeKit
                            if (this.currentState !== deviceIsOn) {
                                this.log.info(`${this.logPrefix}Device state changed externally: ${deviceIsOn ? 'ON' : 'OFF'}`);
                                logToFile(`${this.logPrefix}Device state changed externally: ${deviceIsOn ? 'ON' : 'OFF'}`, 'STATE');

                                // 更新本地状态
                                this.currentState = deviceIsOn;

                                // 更新HomeKit界面
                                this.switchService.updateCharacteristic(this.Characteristic.On, deviceIsOn);

                                this.log.info(`${this.logPrefix}Updated HomeKit state to match device: ${deviceIsOn ? 'ON' : 'OFF'}`);
                                logToFile(`${this.logPrefix}Updated HomeKit state to match device: ${deviceIsOn ? 'ON' : 'OFF'}`, 'STATE');
                            } else {
                                // 状态未变化，记录稳定状态
                                this.log.debug(`${this.logPrefix}Device state unchanged, remains: ${deviceIsOn ? 'ON' : 'OFF'}`);
                                logToFile(`${this.logPrefix}Device state unchanged, remains: ${deviceIsOn ? 'ON' : 'OFF'}`, 'STATE');
                            }

                            // 记录额外设备信息（如果有）
                            if (statusData.battery) {
                                this.log.debug(`${this.logPrefix}Device battery: ${statusData.battery}%`);
                                logToFile(`${this.logPrefix}Device battery: ${statusData.battery}%`, 'INFO');
                            }
                        } else {
                            throw new Error('No valid JSON data found');
                        }
                    } catch (parseError) {
                        this.log.error(`${this.logPrefix}Failed to parse device state: ${parseError.message}`);
                        logToFile(`${this.logPrefix}Failed to parse device state: ${parseError.message}`, 'ERROR');
                    }
                }
            });
        } catch (e) {
            this.log.error(`${this.logPrefix}Error checking device status: ${e.message}`);
            logToFile(`${this.logPrefix}Error checking device status: ${e.message}`, 'ERROR');
        }
    }
} 