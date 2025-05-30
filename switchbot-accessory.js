const fs = require('fs');
const path = require('path');
const SwitchBotAPI = require('homebridge-switchbot-ble/switchbot-api-commonjs');
const { exec } = require('child_process');

let Service, Characteristic;

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
        const today = new Date().toLocaleDateString().replace(/\//g, '-');
        const logFile = path.join(LOG_DIR, `switchbot-api-${today}.log`);
        const timestamp = new Date().toLocaleString();
        const logPrefix = `[${timestamp}] [${level}]`;
        const logMessage = `${logPrefix} ${message}\n`;
        fs.appendFileSync(logFile, logMessage);
    } catch (err) {
        console.error('Failed to write to log file:', err.message);
    }
}

class SwitchbotAccessory {
    constructor(log, config, api) {
        this.log = log;
        this.config = config;
        this.api = api;

        // Configuration
        this.name = config.name || 'SwitchBot';
        this.mode = config.mode || 'switch'; // Changed default to 'switch' instead of 'press'
        this.deviceId = config.deviceId;
        this.configPath = config.configPath || path.join(process.env.HOME || process.env.USERPROFILE, '.switchbot.config');
        this.autoOff = config.autoOff || false;
        this.autoOffDelay = config.autoOffDelay || 1; // seconds
        this.debug = config.debug || false; // 增加debug選項

        // Track current state
        this.currentState = false; // Default to OFF

        // Child Bridge 相關配置
        this.logPrefix = `[${this.name}] `;

        // Get Service and Characteristic from the API
        Service = this.api.hap.Service;
        Characteristic = this.api.hap.Characteristic;

        // Load saved device ID from config file if not provided in config
        if (!this.deviceId) {
            try {
                if (fs.existsSync(this.configPath)) {
                    const savedConfig = JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
                    this.deviceId = savedConfig.deviceId;
                    this.log.info(`${this.logPrefix}Loaded device ID from config: ${this.deviceId}`);
                    logToFile(`${this.logPrefix}Loaded device ID from config: ${this.deviceId}`);
                }
            } catch (error) {
                this.log.error(`${this.logPrefix}Error loading config: ${error.message}`);
                logToFile(`${this.logPrefix}Error loading config: ${error.message}`, 'ERROR');
            }
        } else {
            // Save the device ID to config file
            try {
                fs.writeFileSync(this.configPath, JSON.stringify({ deviceId: this.deviceId }), 'utf8');
                this.log.info(`${this.logPrefix}Saved device ID to config: ${this.deviceId}`);
                logToFile(`${this.logPrefix}Saved device ID to config: ${this.deviceId}`);
            } catch (error) {
                this.log.error(`${this.logPrefix}Error saving config: ${error.message}`);
                logToFile(`${this.logPrefix}Error saving config: ${error.message}`, 'ERROR');
            }
        }

        // Create the switch service
        this.switchService = new Service.Switch(this.name);

        // Add the On characteristic
        this.switchService
            .getCharacteristic(Characteristic.On)
            .onGet(this.getState.bind(this))
            .onSet(this.setState.bind(this));

        this.informationService = new Service.AccessoryInformation()
            .setCharacteristic(Characteristic.Manufacturer, 'SwitchBot')
            .setCharacteristic(Characteristic.Model, 'Bot')
            .setCharacteristic(Characteristic.SerialNumber, this.deviceId || 'Unknown');

        this.log.info(`${this.logPrefix}SwitchBot initialized with device ID: ${this.deviceId || 'Not configured'}`);
        logToFile(`${this.logPrefix}SwitchBot initialized with device ID: ${this.deviceId || 'Not configured'}`);

        // Enhanced debug info
        if (this.debug) {
            this.log.info(`${this.logPrefix}Debug mode: ON`);
            logToFile(`${this.logPrefix}Debug mode: ON`);
            this.logDeviceDetails();
        }
    }

    // 增加詳細設備信息日誌
    logDeviceDetails() {
        this.log.debug(`${this.logPrefix}Configuration details:`);
        this.log.debug(`${this.logPrefix}  Name: ${this.name}`);
        this.log.debug(`${this.logPrefix}  Device ID: ${this.deviceId}`);
        this.log.debug(`${this.logPrefix}  Mode: ${this.mode}`);
        this.log.debug(`${this.logPrefix}  Auto Off: ${this.autoOff}`);
        this.log.debug(`${this.logPrefix}  Auto Off Delay: ${this.autoOffDelay}s`);
        this.log.debug(`${this.logPrefix}  Debug Mode: ${this.debug}`);
        this.log.debug(`${this.logPrefix}  Current State: ${this.currentState ? 'ON' : 'OFF'}`);

        // Also log to file
        logToFile(`${this.logPrefix}Configuration details:`);
        logToFile(`${this.logPrefix}  Name: ${this.name}`);
        logToFile(`${this.logPrefix}  Device ID: ${this.deviceId}`);
        logToFile(`${this.logPrefix}  Mode: ${this.mode}`);
        logToFile(`${this.logPrefix}  Auto Off: ${this.autoOff}`);
        logToFile(`${this.logPrefix}  Auto Off Delay: ${this.autoOffDelay}s`);
        logToFile(`${this.logPrefix}  Debug Mode: ${this.debug}`);
        logToFile(`${this.logPrefix}  Current State: ${this.currentState ? 'ON' : 'OFF'}`);
    }

    // Enhanced logging helper
    debugLog(message) {
        if (this.debug) {
            this.log.debug(`${this.logPrefix}${message}`);
            logToFile(`${this.logPrefix}${message}`, 'DEBUG');
        }
    }

    async getState() {
        this.log.debug(`${this.logPrefix}Getting current state: ${this.currentState ? 'ON' : 'OFF'}`);
        logToFile(`${this.logPrefix}Getting current state: ${this.currentState ? 'ON' : 'OFF'}`, 'DEBUG');

        if (this.debug) {
            try {
                const serverStatus = await SwitchBotAPI.getServerStatus();
                this.debugLog(`Server status: Platform=${serverStatus.platform}, Admin=${serverStatus.adminRights}`);

                // 嘗試獲取設備狀態
                this.debugLog(`Current tracked state for ${this.deviceId}: ${this.currentState ? 'ON' : 'OFF'}`);
            } catch (error) {
                this.debugLog(`Error getting status: ${error.message}`);
                logToFile(`${this.logPrefix}Error getting status: ${error.message}`, 'ERROR');
            }
        }

        // Return the tracked state
        return this.currentState;
    }

    async setState(value) {
        const timestamp = new Date().toLocaleString();
        this.log.info(`${this.logPrefix}[${timestamp}] Setting switch state to ${value ? 'ON' : 'OFF'}`);
        logToFile(`${this.logPrefix}[${timestamp}] Setting switch state to ${value ? 'ON' : 'OFF'}`);

        // 增加詳細調試日誌
        this.log.debug(`${this.logPrefix}DEBUG: setState called with value=${value}`);
        this.log.debug(`${this.logPrefix}DEBUG: Operation mode=${this.mode}, Device ID=${this.deviceId}`);
        logToFile(`${this.logPrefix}DEBUG: setState called with value=${value}`, 'DEBUG');
        logToFile(`${this.logPrefix}DEBUG: Operation mode=${this.mode}, Device ID=${this.deviceId}`, 'DEBUG');

        if (!this.deviceId) {
            this.log.error(`${this.logPrefix}No device ID configured`);
            logToFile(`${this.logPrefix}No device ID configured`, 'ERROR');
            // Always update the state even if we have an error, to prevent HomeKit timeouts
            this.currentState = value;
            return this.currentState;
        }

        this.debugLog(`Attempting to control device: ${this.deviceId}`);

        // Add a safety timeout to ensure we always return within Homebridge's expected timeframe
        const commandTimeout = 8000; // 8 seconds max execution time
        let timeoutId;

        try {
            // Create a promise that will reject after the timeout
            const timeoutPromise = new Promise((_, reject) => {
                timeoutId = setTimeout(() => {
                    reject(new Error('Command execution timed out'));
                }, commandTimeout);
            });

            // Create the actual command execution promise
            const executionPromise = (async () => {
                let result;
                let commandType = ''; // 用於記錄命令類型

                // 使用直接的命令來控制設備
                const cmdPath = path.join(__dirname, 'bot-cmd.mjs');

                if (this.mode === 'press') {
                    // In press mode, we always just press the button
                    this.log.info(`${this.logPrefix}Pressing button for device: ${this.deviceId}`);
                    commandType = 'press';
                    const cmdLine = `node "${cmdPath}" press ${this.deviceId}`;
                    this.log.info(`${this.logPrefix}Executing command: ${cmdLine}`);
                    logToFile(`${this.logPrefix}Pressing button for device: ${this.deviceId}`, 'COMMAND');
                    logToFile(`${this.logPrefix}Executing command: ${cmdLine}`, 'COMMAND');

                    result = await this.executeCommand(cmdLine);
                    this.log.debug(`${this.logPrefix}DEBUG: Press command completed`);
                    logToFile(`${this.logPrefix}DEBUG: Press command completed`, 'DEBUG');

                    // For press mode, we update the state temporarily to what was requested
                    this.currentState = value;

                } else if (this.mode === 'switch' || this.mode === 'on' || this.mode === 'off') {
                    // In switch mode, we turn on or off based on the requested state
                    if (value) {
                        this.log.info(`${this.logPrefix}Turning ON device: ${this.deviceId}`);
                        commandType = 'on';
                        const cmdLine = `node "${cmdPath}" on ${this.deviceId}`;
                        this.log.info(`${this.logPrefix}Executing command: ${cmdLine}`);
                        logToFile(`${this.logPrefix}Turning ON device: ${this.deviceId}`, 'COMMAND');
                        logToFile(`${this.logPrefix}Executing command: ${cmdLine}`, 'COMMAND');

                        result = await this.executeCommand(cmdLine);
                        this.log.debug(`${this.logPrefix}DEBUG: On command completed`);
                        logToFile(`${this.logPrefix}DEBUG: On command completed`, 'DEBUG');

                        // Update tracked state
                        this.currentState = true;
                        logToFile(`${this.logPrefix}State updated to: ON`, 'STATE');
                    } else {
                        this.log.info(`${this.logPrefix}Turning OFF device: ${this.deviceId}`);
                        commandType = 'off';
                        const cmdLine = `node "${cmdPath}" off ${this.deviceId}`;
                        this.log.info(`${this.logPrefix}Executing command: ${cmdLine}`);
                        logToFile(`${this.logPrefix}Turning OFF device: ${this.deviceId}`, 'COMMAND');
                        logToFile(`${this.logPrefix}Executing command: ${cmdLine}`, 'COMMAND');

                        result = await this.executeCommand(cmdLine);
                        this.log.debug(`${this.logPrefix}DEBUG: Off command completed`);
                        logToFile(`${this.logPrefix}DEBUG: Off command completed`, 'DEBUG');

                        // Update tracked state
                        this.currentState = false;
                        logToFile(`${this.logPrefix}State updated to: OFF`, 'STATE');
                    }
                } else {
                    // Default behavior for unknown modes
                    if (value) {
                        this.log.info(`${this.logPrefix}Default ON for device: ${this.deviceId}`);
                        commandType = 'on';
                        const cmdLine = `node "${cmdPath}" on ${this.deviceId}`;
                        this.log.info(`${this.logPrefix}Executing command: ${cmdLine}`);
                        logToFile(`${this.logPrefix}Default ON for device: ${this.deviceId}`, 'COMMAND');
                        logToFile(`${this.logPrefix}Executing command: ${cmdLine}`, 'COMMAND');

                        result = await this.executeCommand(cmdLine);
                        this.currentState = true;
                        logToFile(`${this.logPrefix}State updated to: ON`, 'STATE');
                    } else {
                        this.log.info(`${this.logPrefix}Default OFF for device: ${this.deviceId}`);
                        commandType = 'off';
                        const cmdLine = `node "${cmdPath}" off ${this.deviceId}`;
                        this.log.info(`${this.logPrefix}Executing command: ${cmdLine}`);
                        logToFile(`${this.logPrefix}Default OFF for device: ${this.deviceId}`, 'COMMAND');
                        logToFile(`${this.logPrefix}Executing command: ${cmdLine}`, 'COMMAND');

                        result = await this.executeCommand(cmdLine);
                        this.currentState = false;
                        logToFile(`${this.logPrefix}State updated to: OFF`, 'STATE');
                    }
                }

                // 增強的日誌輸出
                const completeTimestamp = new Date().toLocaleString();
                this.log.debug(`${this.logPrefix}[${completeTimestamp}] ${commandType} command completed`);
                this.log.debug(`${this.logPrefix}DEBUG: Command result: ${JSON.stringify(result)}`);
                this.log.debug(`${this.logPrefix}Updated state: ${this.currentState ? 'ON' : 'OFF'}`);
                logToFile(`${this.logPrefix}[${completeTimestamp}] ${commandType} command completed`, 'DEBUG');
                logToFile(`${this.logPrefix}DEBUG: Command result: ${JSON.stringify(result)}`, 'DEBUG');
                logToFile(`${this.logPrefix}Updated state: ${this.currentState ? 'ON' : 'OFF'}`, 'STATE');

                if (result && result.success) {
                    this.log.info(`${this.logPrefix}Command successfully sent to SwitchBot: ${commandType}`);
                    logToFile(`${this.logPrefix}Command successfully sent to SwitchBot: ${commandType}`, 'SUCCESS');
                } else if (result) {
                    this.log.warn(`${this.logPrefix}Command sent but reported issues: ${result.error || 'unknown error'}`);
                    logToFile(`${this.logPrefix}Command sent but reported issues: ${result.error || 'unknown error'}`, 'WARNING');
                }

                // For "press" mode or when autoOff is enabled, always return to OFF after a delay
                if ((this.mode === 'press' || this.autoOff) && value) {
                    this.log.debug(`${this.logPrefix}Auto-off scheduled in ${this.autoOffDelay} second(s)`);
                    logToFile(`${this.logPrefix}Auto-off scheduled in ${this.autoOffDelay} second(s)`, 'DEBUG');
                    setTimeout(() => {
                        const autoOffTimestamp = new Date().toLocaleString();
                        this.log.debug(`${this.logPrefix}[${autoOffTimestamp}] Auto-off triggered`);
                        logToFile(`${this.logPrefix}[${autoOffTimestamp}] Auto-off triggered`, 'DEBUG');
                        this.currentState = false; // Update tracked state
                        logToFile(`${this.logPrefix}State updated to: OFF (auto-off)`, 'STATE');
                        this.switchService.updateCharacteristic(this.Characteristic.On, false);
                    }, this.autoOffDelay * 1000);
                }

                return this.currentState; // Return the new state
            })();

            // Race the execution promise against the timeout
            const result = await Promise.race([executionPromise, timeoutPromise]);

            // Clear the timeout if execution finished before timeout
            clearTimeout(timeoutId);

            return result;
        } catch (err) {
            // Clear timeout if we got here through an error
            if (timeoutId) clearTimeout(timeoutId);

            // If we timeout or have another error, log it but return a valid state to prevent HomeKit timeout
            if (err.message === 'Command execution timed out') {
                this.log.error(`${this.logPrefix}Command execution timed out after ${commandTimeout}ms`);
                logToFile(`${this.logPrefix}Command execution timed out after ${commandTimeout}ms`, 'ERROR');
            } else {
                this.log.error(`${this.logPrefix}Error controlling device: ${err.message}`);
                this.log.debug(`${this.logPrefix}DEBUG: Error stack trace: ${err.stack}`);
                logToFile(`${this.logPrefix}Error controlling device: ${err.message}`, 'ERROR');
                logToFile(`${this.logPrefix}DEBUG: Error stack trace: ${err.stack}`, 'ERROR');
            }

            // Even if there's an error, we update and return the state that was requested
            // This ensures the UI remains responsive
            if (this.mode !== 'press') {
                this.currentState = value;
                logToFile(`${this.logPrefix}Forced state update despite error: ${value ? 'ON' : 'OFF'}`, 'STATE');
            }

            return this.currentState;
        }
    }

    // Helper to execute commands directly using child_process with timeout
    executeCommand(cmd) {
        return new Promise((resolve, reject) => {
            this.log.debug(`${this.logPrefix}Executing command: ${cmd}`);
            logToFile(`${this.logPrefix}Executing command: ${cmd}`, 'COMMAND');

            // Set a timeout for the command execution (5 seconds)
            const cmdTimeout = setTimeout(() => {
                this.log.error(`${this.logPrefix}Command execution timed out: ${cmd}`);
                logToFile(`${this.logPrefix}Command execution timed out: ${cmd}`, 'ERROR');
                resolve({
                    success: false,
                    error: 'Command execution timed out',
                    timedOut: true
                });
            }, 5000);

            const childProcess = exec(cmd, { timeout: 5000 }, (error, stdout, stderr) => {
                // Clear the timeout as we got a response
                clearTimeout(cmdTimeout);

                if (stderr) {
                    this.log.debug(`${this.logPrefix}Command stderr: ${stderr.trim()}`);
                    logToFile(`${this.logPrefix}Command stderr: ${stderr.trim()}`, 'ERROR');
                }

                if (stdout) {
                    this.log.debug(`${this.logPrefix}Command stdout: ${stdout.trim()}`);
                    logToFile(`${this.logPrefix}Command stdout: ${stdout.trim()}`, 'DEBUG');
                }

                if (error) {
                    this.log.error(`${this.logPrefix}Command error: ${error.message}`);
                    logToFile(`${this.logPrefix}Command error: ${error.message}`, 'ERROR');
                    // We resolve anyway to handle errors gracefully
                    resolve({
                        success: false,
                        error: error.message,
                        stdout,
                        stderr
                    });
                } else {
                    logToFile(`${this.logPrefix}Command executed successfully`, 'SUCCESS');
                    resolve({
                        success: true,
                        stdout,
                        stderr
                    });
                }
            });

            // Add additional error handler for process errors
            childProcess.on('error', (err) => {
                clearTimeout(cmdTimeout);
                this.log.error(`${this.logPrefix}Process error: ${err.message}`);
                logToFile(`${this.logPrefix}Process error: ${err.message}`, 'ERROR');
                resolve({
                    success: false,
                    error: err.message,
                    processError: true
                });
            });
        });
    }

    getServices() {
        return [this.informationService, this.switchService];
    }
}

module.exports = SwitchbotAccessory; 