// SwitchBot API Server - Provides direct JavaScript API to control SwitchBot devices
import { SwitchBotBLE } from 'node-switchbot';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const switchbot = new SwitchBotBLE({
    debug: false,
    scanDuration: 3000,
    connectTimeout: 3000,
    commandTimeout: 1000
});

const CACHE_DURATION = 60000; // Cache validity: 60 seconds
const deviceCache = {}; // Cache object for storing device status and instances

function normalizeMacAddress(mac) {
    if (!mac) return null;
    if (/^([0-9a-f]{2}:){5}[0-9a-f]{2}$/i.test(mac)) return mac.toLowerCase();
    const cleanMac = mac.replace(/[^0-9a-f]/gi, '');
    if (cleanMac.length === 12) return cleanMac.match(/.{1,2}/g).join(':').toLowerCase();
    return mac.toLowerCase();
}

export async function checkAdminRights() {
    try {
        if (process.platform === 'win32') {
            const { stdout } = await execAsync('powershell -command "([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)"');
            return stdout.trim() === 'True';
        } else if (process.platform === 'linux' || process.platform === 'darwin') {
            const { stdout } = await execAsync('id -u');
            return stdout.trim() === '0';
        }
        return false;
    } catch (error) {
        return false;
    }
}

// Improved log output function
function logWithTimestamp(level, message) {
    const timestamp = new Date().toLocaleString();
    let prefix;

    switch (level) {
        case 'error':
            prefix = `[${timestamp}][ERROR]`;
            break;
        case 'warn':
            prefix = `[${timestamp}][WARN]`;
            break;
        case 'info':
            prefix = `[${timestamp}][INFO]`;
            break;
        case 'debug':
            prefix = `[${timestamp}][DEBUG]`;
            break;
        default:
            prefix = `[${timestamp}]`;
    }

    console.log(`${prefix} ${message}`);
}

export async function scanDevices({ duration = 10000, targetAddress = null } = {}) {
    let foundDevices = [];
    let waitPromiseResolve = null;
    let targetFound = false;

    try {
        logWithTimestamp('info', `Start scanning devices (duration ${duration}ms)${targetAddress ? `, targeting: ${targetAddress}` : ''}...`);

        switchbot.onadvertisement = (ad) => {
            if (!foundDevices.find(d => d.address === ad.address)) {
                logWithTimestamp('debug', `Received advertisement: ${ad.address} (ID: ${ad.id || 'unknown'})`);

                const device = {
                    address: ad.address,
                    id: ad.id,
                    type: 'unknown',
                    model: ad.serviceData?.model || 'unknown',
                    modelName: ad.serviceData?.modelName || 'unknown'
                };

                if (ad.serviceData) {
                    logWithTimestamp('debug', `Device ${ad.address} service data: ${JSON.stringify(ad.serviceData)}`);

                    if (ad.serviceData.model === 'H') {
                        device.type = 'Bot';
                        device.mode = ad.serviceData.mode ? 'Switch' : 'Press';
                        device.state = ad.serviceData.state ? 'ON' : 'OFF';
                        device.battery = ad.serviceData.battery;
                    } else if (ad.serviceData.model === 'T') {
                        device.type = 'Meter';
                        device.temperature = ad.serviceData.temperature;
                        device.humidity = ad.serviceData.humidity;
                        device.battery = ad.serviceData.battery;
                    } else if (ad.serviceData.model === 's') {
                        device.type = 'Contact Sensor';
                        device.contact = ad.serviceData.contact;
                        device.battery = ad.serviceData.battery;
                    }
                }

                foundDevices.push(device);
                logWithTimestamp('info', `Device found: ${device.address} (${device.type})`);

                // If we have a target address and this device matches, stop scanning early
                if (targetAddress && device.address.toLowerCase() === targetAddress.toLowerCase()) {
                    targetFound = true;
                    logWithTimestamp('info', `Target device found: ${device.address}, stopping scan early`);
                    if (waitPromiseResolve) {
                        waitPromiseResolve();
                    }
                }
            }
        };

        await switchbot.startScan();
        logWithTimestamp('debug', 'Scan started');

        // Wait for either target device found or timeout
        await new Promise(resolve => {
            waitPromiseResolve = resolve;

            // Still set a timeout as fallback
            setTimeout(() => {
                if (!targetFound) {
                    logWithTimestamp('debug', 'Scan duration ended without finding target device');
                }
                resolve();
            }, duration);
        });

        await switchbot.stopScan();
        logWithTimestamp('info', `Scan complete, found ${foundDevices.length} devices`);

        return foundDevices;
    } catch (error) {
        logWithTimestamp('error', `Scan error: ${error.message}`);
        console.error(error);
        return foundDevices; // Return found devices even if error
    }
}

// Get specific device status via advertisement
export async function getBotStatus(deviceId, { duration = 3000 } = {}) {
    const normalizedDeviceId = normalizeMacAddress(deviceId);
    if (!normalizedDeviceId) {
        return {
            deviceId: deviceId,
            type: 'Bot',
            state: null,
            mode: null,
            battery: null,
            error: 'Invalid device ID'
        };
    }

    let deviceStatus = {
        deviceId: normalizedDeviceId,
        type: 'Bot',
        state: null,
        mode: null,
        battery: null
    };

    let deviceFound = false;
    let waitPromiseResolve = null;

    try {
        // Set advertisement listener
        switchbot.onadvertisement = (ad) => {
            if (ad.address.toLowerCase() === normalizedDeviceId.toLowerCase()) {
                deviceFound = true;
                if (ad.serviceData && ad.serviceData.model === 'H') {
                    deviceStatus.state = ad.serviceData.state ? 'ON' : 'OFF';
                    deviceStatus.mode = ad.serviceData.mode ? 'Switch' : 'Press';
                    deviceStatus.battery = ad.serviceData.battery;
                }

                // Once we found the device, resolve immediately
                if (waitPromiseResolve) {
                    logWithTimestamp('info', `Device ${normalizedDeviceId} found, stopping scan early`);
                    waitPromiseResolve();
                }
            }
        };

        // Start scan
        await switchbot.startScan();
        logWithTimestamp('info', `Scanning for device ${normalizedDeviceId} (max ${duration}ms)...`);

        // Wait for either device found or timeout
        await new Promise(resolve => {
            waitPromiseResolve = resolve;

            // Still set a timeout as fallback
            setTimeout(() => {
                if (!deviceFound) {
                    logWithTimestamp('debug', 'Scan duration ended without finding target device');
                }
                resolve();
            }, duration);
        });

        // Stop scan
        await switchbot.stopScan();

        if (!deviceFound) {
            deviceStatus.error = 'Device did not respond to advertisement';
        }

        return deviceStatus;
    } catch (error) {
        console.error('Error getting status:', error.message);
        deviceStatus.error = error.message;
        return deviceStatus;
    }
}

// Try to discover device, but do not throw error
async function tryDiscoverBot(deviceId, quick = true, duration = 1500, maxRetries = 5) {
    const normalizedDeviceId = normalizeMacAddress(deviceId);
    if (!normalizedDeviceId) {
        logWithTimestamp('error', 'Invalid device ID');
        return {
            success: false,
            error: 'Invalid device ID',
            bot: null
        };
    }

    // Check if there is a cached device instance
    if (deviceCache[normalizedDeviceId] && deviceCache[normalizedDeviceId].botInstance &&
        (Date.now() - deviceCache[normalizedDeviceId].lastDiscovered < CACHE_DURATION)) {
        logWithTimestamp('info', `Using cached device instance: ${normalizedDeviceId}`);
        return {
            success: true,
            bot: deviceCache[normalizedDeviceId].botInstance,
            fromCache: true
        };
    }

    // Use retry mechanism to find device
    let retryCount = 0;
    let lastError = null;

    while (retryCount <= maxRetries) {
        try {
            if (retryCount > 0) {
                logWithTimestamp('info', `Retry discovering device (attempt ${retryCount}): ${normalizedDeviceId}`);
                // Increase retry interval to avoid too frequent requests
                await new Promise(resolve => setTimeout(resolve, 500 * retryCount));
            } else {
                logWithTimestamp('info', `Trying to discover device: ${normalizedDeviceId}`);
            }

            logWithTimestamp('debug', `Scan parameters: model=H, id=${normalizedDeviceId}, quick=${quick}, duration=${duration}ms`);

            const devices = await switchbot.discover({
                model: 'H',
                id: normalizedDeviceId,
                quick,
                duration
            });

            if (!devices || devices.length === 0) {
                // Only log warning on last retry
                if (retryCount >= maxRetries) {
                    logWithTimestamp('warn', `Device not found: ${normalizedDeviceId} (retried ${retryCount} times)`);
                }

                // Capture specific error message for retry
                lastError = `Device not found: ${normalizedDeviceId} (retry ${retryCount}/${maxRetries})`;
                retryCount++;
                continue;
            }

            // Update cache
            if (!deviceCache[normalizedDeviceId]) {
                deviceCache[normalizedDeviceId] = {};
            }

            deviceCache[normalizedDeviceId].botInstance = devices[0];
            deviceCache[normalizedDeviceId].lastDiscovered = Date.now();

            logWithTimestamp('info', `Successfully discovered device: ${normalizedDeviceId}${retryCount > 0 ? ` (after ${retryCount} retries)` : ''}`);
            return {
                success: true,
                bot: devices[0],
                fromCache: false
            };
        } catch (error) {
            // Capture "No devices found during discovery" error and retry
            if (error.message.includes("No devices found") && retryCount < maxRetries) {
                logWithTimestamp('warn', `Error discovering device (will retry): ${error.message}`);
                lastError = error.message;
                retryCount++;
                continue;
            }

            // This is a real discovery error or max retries reached
            logWithTimestamp('error', `Error discovering device: ${error.message} (retried ${retryCount} times)`);
            return {
                success: false,
                error: `Error discovering device: ${error.message}`,
                bot: null
            };
        }
    }

    // If all retries fail, return last error
    return {
        success: false,
        error: lastError || `Device not found: ${normalizedDeviceId} (retries exhausted)`,
        bot: null
    };
}

// Execute command and ignore error
async function executeCommand(result, commandName, command, maxRetries = 5) {
    // Check if it's from cache result
    if (result && result.fromCache) {
        logWithTimestamp('info', `Using cached device instance to execute ${commandName} command`);
    }

    // Check if there is really a device available
    if (!result || !result.success || !result.bot) {
        let message = 'Device not found';
        if (result && result.error) {
            message = result.error;
            if (result.error.includes('Error discovering device')) {
                logWithTimestamp('warn', `Warning: ${result.error} (ignored)`);
            }
        }
        logWithTimestamp('warn', `Device not found or unable to connect, but still consider ${commandName} command executed successfully`);

        // Even if no device is found, update status cache based on command
        const deviceId = result && result.deviceId ? normalizeMacAddress(result.deviceId) : null;
        if (deviceId) {
            // Initialize device cache if it doesn't exist
            if (!deviceCache[deviceId]) {
                deviceCache[deviceId] = {
                    lastUpdated: Date.now()
                };
            }

            // Set status based on command type
            if (command === 'turnOn') {
                deviceCache[deviceId].state = 'ON';
            } else if (command === 'turnOff') {
                deviceCache[deviceId].state = 'OFF';
            }
        }

        return {
            success: true,  // Always return success
            commandSent: true,
            virtuallyExecuted: true
        };
    }

    // Try to execute command and retry
    let retryCount = 0;
    let lastError = null;

    while (retryCount <= maxRetries) {
        try {
            const bot = result.bot;
            if (typeof bot[command] !== 'function') {
                logWithTimestamp('warn', `⚠ ${commandName} command not supported: Device does not have ${command} method, but still consider successful`);
                return {
                    success: true,
                    commandSent: true
                };
            }

            if (retryCount > 0) {
                logWithTimestamp('info', `Retry executing ${command} command (attempt ${retryCount})...`);
                // Wait between retries
                await new Promise(resolve => setTimeout(resolve, 500 * retryCount));
            } else {
                logWithTimestamp('info', `Executing ${command} command...`);
            }

            await bot[command]();

            // Update status in cache
            const deviceId = normalizeMacAddress(bot.id || bot.address);
            if (deviceId) {
                if (!deviceCache[deviceId]) {
                    deviceCache[deviceId] = {};
                }

                // Update status based on command
                if (command === 'turnOn') {
                    deviceCache[deviceId].state = 'ON';
                } else if (command === 'turnOff') {
                    deviceCache[deviceId].state = 'OFF';
                }

                deviceCache[deviceId].lastUpdated = Date.now();
            }

            logWithTimestamp('info', `✓ ${commandName} successful${retryCount > 0 ? ` (after ${retryCount} retries)` : ''}`);
            return {
                success: true,
                commandSent: true
            };
        } catch (error) {
            // Check if it's "No devices found" type error, need to retry
            if ((error.message.includes("No devices found") ||
                error.message.includes("disconnected") ||
                error.message.includes("timeout") ||
                error.message.includes("GATT operation failed")) &&
                retryCount < maxRetries) {
                logWithTimestamp('warn', `${commandName} failed (will retry): ${error.message}`);
                lastError = error.message;
                retryCount++;
                // Wait briefly before retrying
                await new Promise(resolve => setTimeout(resolve, 500 * retryCount));
                continue;
            }

            // Command execution failed, but still consider successful
            logWithTimestamp('warn', `✗ ${commandName} failed: ${error.message}, but still consider successful execution`);

            // Update status - even if command failed, we assume command execution successful and update status
            const deviceId = normalizeMacAddress(result.bot.id || result.bot.address);
            if (deviceId) {
                if (!deviceCache[deviceId]) {
                    deviceCache[deviceId] = {};
                }

                // Set status based on command, even if failed, update status (for UI consistency)
                if (command === 'turnOn') {
                    deviceCache[deviceId].state = 'ON';
                    logWithTimestamp('info', `[Status updated] ${deviceId} set to ON (even if command may fail)`);
                } else if (command === 'turnOff') {
                    deviceCache[deviceId].state = 'OFF';
                    logWithTimestamp('info', `[Status updated] ${deviceId} set to OFF (even if command may fail)`);
                }

                deviceCache[deviceId].lastUpdated = Date.now();
            }

            // Clear cache, force next discovery
            if (result.bot) {
                const deviceId = result.bot.id || result.bot.address;
                if (deviceId && deviceCache[normalizeMacAddress(deviceId)]) {
                    delete deviceCache[normalizeMacAddress(deviceId)].botInstance;
                }
            }

            return {
                success: true,  // Still return success
                commandSent: true,
                error: error.message,
                virtuallyExecuted: true  // Mark as virtual execution
            };
        }
    }

    // If all retries fail, but we still consider successful
    logWithTimestamp('error', `✗ ${commandName} failed after ${maxRetries} retries, but still consider successful execution`);
    return {
        success: true,
        commandSent: true,
        virtuallyExecuted: true,
        error: lastError || "Retries exhausted"
    };
}

// Press device
export async function pressBot(deviceId, maxRetries = 5) {
    logWithTimestamp('info', `Trying to press device: ${deviceId}`);

    // Try to discover device, increase retry parameter
    const result = await tryDiscoverBot(deviceId, true, 1500, maxRetries);

    // Execute press operation
    return executeCommand(result, 'Press', 'press');
}

// Turn on device (only switch mode)
export async function turnOnBot(deviceId, maxRetries = 5) {
    logWithTimestamp('info', `Trying to turn on device: ${deviceId}`);

    // Try to discover device, increase retry parameter
    const result = await tryDiscoverBot(deviceId, true, 1500, maxRetries);

    // Execute turn on operation
    return executeCommand(result, 'Turn On', 'turnOn');
}

// Turn off device (only switch mode)
export async function turnOffBot(deviceId, maxRetries = 5) {
    logWithTimestamp('info', `Trying to turn off device: ${deviceId}`);

    // Try to discover device, increase retry parameter
    const result = await tryDiscoverBot(deviceId, true, 1500, maxRetries);

    // Execute turn off operation
    return executeCommand(result, 'Turn Off', 'turnOff');
}

// Get server status
export async function getServerStatus() {
    const isAdmin = await checkAdminRights();

    return {
        platform: process.platform,
        nodeVersion: process.version,
        uptime: process.uptime().toFixed(2) + ' seconds',
        adminRights: isAdmin,
        adminMessage: isAdmin
            ? '✓ Running with admin rights'
            : '⚠ Not running with admin rights, may not use Bluetooth'
    };
} 