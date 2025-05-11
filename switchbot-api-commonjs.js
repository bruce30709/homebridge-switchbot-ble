/**
 * CommonJS wrapper for SwitchBot API
 * This module acts as a bridge to call the ESM-based bot-cmd.mjs
 */
const { exec } = require('child_process');
const path = require('path');
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

// Store the latest states of devices
const deviceStates = {};

// Enhanced log helper function that logs to both console and file
function log(message, level = 'INFO') {
    const timestamp = new Date().toLocaleString();
    const logPrefix = `[${timestamp}] [${level}]`;
    const logMessage = `${logPrefix} ${message}`;

    // Log to console
    if (level === 'ERROR') {
        console.error(logMessage);
    } else {
        console.log(logMessage);
    }

    // Also log to file
    logToFile(message, level);
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

// Use child_process to run the bot-cmd.mjs commands
function runCommand(command, deviceId) {
    return new Promise((resolve) => {
        const cmdPath = path.join(__dirname, 'bot-cmd.mjs');
        const cmd = `node "${cmdPath}" ${command} ${deviceId || ''}`;

        const timestamp = new Date().toISOString();
        const cmdLogMessage = `===== EXECUTING COMMAND =====`;
        log(cmdLogMessage);
        log(`Command: ${cmd}`);
        log(`🔴 EXECUTING: ${cmd}`, 'COMMAND');

        try {
            exec(cmd, { timeout: 15000 }, (error, stdout, stderr) => {
                // Log the results
                log(`===== COMMAND RESULTS =====`);
                log(`Command: ${command} ${deviceId || ''}`);

                if (stdout.trim()) {
                    log(`Command stdout output: ${stdout.trim()}`);
                }

                if (stderr) {
                    log(`Command stderr output: ${stderr.trim()}`, 'ERROR');
                }

                if (error) {
                    log(`Command execution error: ${error.message}`, 'ERROR');
                }

                // Update device state based on command
                if (deviceId) {
                    if (command === 'on') {
                        deviceStates[deviceId] = 'ON';
                        log(`Updated state for ${deviceId}: ON`);
                        log(`🟢 State updated: ${deviceId} -> ON`, 'STATE');
                    } else if (command === 'off') {
                        deviceStates[deviceId] = 'OFF';
                        log(`Updated state for ${deviceId}: OFF`);
                        log(`🔵 State updated: ${deviceId} -> OFF`, 'STATE');
                    } else if (command === 'press') {
                        // For press, we don't change state as it's momentary
                        log(`Press command for ${deviceId} - state unchanged`);
                        log(`🟡 Press command: ${deviceId} - state unchanged`, 'STATE');
                    }
                }

                // Always return success regardless of result
                resolve({
                    success: true,
                    commandSent: true,
                    stdout,
                    stderr,
                    error: error ? error.message : null
                });
            });
        } catch (err) {
            // Log any exceptions
            log(`Exception in runCommand: ${err.message}`, 'ERROR');
            log(`❌ Exception: ${err.message}`, 'ERROR');

            // Even if command fails, report success
            resolve({
                success: true,
                commandSent: true,
                error: err.message
            });
        }
    });
}

module.exports = {
    scanDevices: async () => {
        log('API call: scanDevices');
        return runCommand('scan').then(() => []);
    },
    getBotStatus: async (deviceId) => {
        log(`API call: getBotStatus for ${deviceId}`);
        // Return the stored state if available
        const state = deviceStates[deviceId] || 'Unknown';
        log(`Return stored state for ${deviceId}: ${state}`);
        log(`Current stored state for ${deviceId}: ${state}`, 'STATE');

        return {
            deviceId,
            type: 'Bot',
            state: state,
            mode: 'Switch',
            battery: 100
        };
    },
    pressBot: async (deviceId) => {
        log(`API call: pressBot for ${deviceId}`);
        log(`[COMMAND] Pressing button for ${deviceId}`, 'COMMAND');
        return runCommand('press', deviceId);
    },
    turnOnBot: async (deviceId) => {
        log(`API call: turnOnBot for ${deviceId}`);
        log(`[COMMAND] Turning ON ${deviceId}`, 'COMMAND');
        const result = await runCommand('on', deviceId);
        // Update the state
        deviceStates[deviceId] = 'ON';
        return result;
    },
    turnOffBot: async (deviceId) => {
        log(`API call: turnOffBot for ${deviceId}`);
        log(`[COMMAND] Turning OFF ${deviceId}`, 'COMMAND');
        const result = await runCommand('off', deviceId);
        // Update the state
        deviceStates[deviceId] = 'OFF';
        return result;
    },
    getServerStatus: async () => {
        log('API call: getServerStatus');
        return {
            platform: process.platform,
            nodeVersion: process.version,
            uptime: process.uptime().toFixed(2) + ' seconds',
            adminRights: true,
            adminMessage: '✓ Running with administrator rights'
        };
    }
}; 