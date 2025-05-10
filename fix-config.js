#!/usr/bin/env node

/**
 * SwitchBot BLE Config Fix Utility
 * This tool will help users fix their Homebridge configuration for proper Child Bridge support
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const readline = require('readline');

// Get the Homebridge config path
const configPath = path.join(os.homedir(), '.homebridge', 'config.json');
const backupPath = path.join(os.homedir(), '.homebridge', `config.backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);

// Create readline interface
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// Logging function
function log(message) {
    console.log(`[SwitchBot Config Fix] ${message}`);
}

// Backup the config file
function backupConfig() {
    try {
        fs.copyFileSync(configPath, backupPath);
        log(`Config backup created at: ${backupPath}`);
        return true;
    } catch (err) {
        log(`Error creating backup: ${err.message}`);
        return false;
    }
}

// Read the config file
function readConfig() {
    try {
        const configContent = fs.readFileSync(configPath, 'utf8');
        return JSON.parse(configContent);
    } catch (err) {
        log(`Error reading config: ${err.message}`);
        return null;
    }
}

// Write the config file
function writeConfig(config) {
    try {
        fs.writeFileSync(configPath, JSON.stringify(config, null, 4), 'utf8');
        log('Config updated successfully');
        return true;
    } catch (err) {
        log(`Error writing config: ${err.message}`);
        return false;
    }
}

// Fix the config
function fixConfig(config) {
    if (!config) return null;

    let modified = false;

    // Check if we need to convert accessory mode configs to platform mode
    if (config.accessories && Array.isArray(config.accessories)) {
        // Find SwitchBot accessory configs
        const switchbotAccessories = config.accessories.filter(acc =>
            acc.accessory === 'SwitchbotBLE' ||
            acc.accessory === 'SwitchBotBLE' ||
            acc.accessory === 'SwitchbotSwitch' ||
            acc.accessory === 'SwitchBotSwitch');

        if (switchbotAccessories.length > 0) {
            log(`Found ${switchbotAccessories.length} SwitchBot accessories to convert`);

            // Get existing platform config or create a new one
            if (!config.platforms) {
                config.platforms = [];
            }

            let switchbotPlatform = config.platforms.find(p =>
                p.platform === 'SwitchbotBLE' ||
                p.platform === 'SwitchBotBLE' ||
                p.platform === 'switchbotBLE');

            if (!switchbotPlatform) {
                // Create new platform
                switchbotPlatform = {
                    platform: 'SwitchbotBLE',
                    name: 'SwitchBot',
                    debug: true,
                    devices: []
                };
                config.platforms.push(switchbotPlatform);
                log('Created new SwitchBot platform configuration');
            } else {
                // Fix the platform name to be consistent
                switchbotPlatform.platform = 'SwitchbotBLE';

                // Make sure 'devices' array exists
                if (!switchbotPlatform.devices) {
                    switchbotPlatform.devices = [];
                }

                // Ensure debug mode is on
                switchbotPlatform.debug = true;

                log('Updated existing SwitchBot platform configuration');
            }

            // Add Child Bridge configuration if it doesn't exist
            if (!switchbotPlatform._bridge) {
                switchbotPlatform._bridge = {
                    username: generateMacAddress(),
                    port: 41087
                };
                log('Added Child Bridge configuration');
            }

            // Convert accessories to platform devices
            for (const acc of switchbotAccessories) {
                // Check if this device already exists in platform
                const existingDevice = switchbotPlatform.devices.find(d =>
                    d.deviceId === acc.deviceId ||
                    d.name === acc.name);

                if (!existingDevice) {
                    // Create new device config
                    const deviceConfig = {
                        name: acc.name,
                        deviceId: acc.deviceId,
                        // Changed default to 'switch' instead of 'press'
                        mode: acc.mode === 'press' ? 'press' : 'switch',
                        autoOff: acc.autoOff || false,
                        autoOffDelay: acc.autoOffDelay || 1
                    };

                    switchbotPlatform.devices.push(deviceConfig);
                    log(`Added device "${acc.name}" to platform configuration`);
                }
            }

            // Remove old accessory configs
            config.accessories = config.accessories.filter(acc =>
                acc.accessory !== 'SwitchbotBLE' &&
                acc.accessory !== 'SwitchBotBLE' &&
                acc.accessory !== 'SwitchbotSwitch' &&
                acc.accessory !== 'SwitchBotSwitch');

            log('Removed old accessory configurations');
            modified = true;
        }
    }

    // Fix platform name if needed
    if (config.platforms && Array.isArray(config.platforms)) {
        for (const platform of config.platforms) {
            if (platform.platform === 'SwitchBotBLE' ||
                platform.platform === 'switchbotBLE') {
                platform.platform = 'SwitchbotBLE';
                log('Fixed platform name to "SwitchbotBLE"');
                modified = true;
            }

            // Ensure debug mode is on for better troubleshooting
            if (platform.platform === 'SwitchbotBLE' && platform.debug !== true) {
                platform.debug = true;
                log('Enabled debug mode for better troubleshooting');
                modified = true;
            }

            // Ensure devices array exists
            if (platform.platform === 'SwitchbotBLE' && !platform.devices) {
                platform.devices = [];
                log('Added empty devices array to platform');
                modified = true;
            }

            // Add Child Bridge config if it doesn't exist
            if (platform.platform === 'SwitchbotBLE' && !platform._bridge) {
                platform._bridge = {
                    username: generateMacAddress(),
                    port: 41087
                };
                log('Added Child Bridge configuration');
                modified = true;
            }
        }
    }

    return modified ? config : null;
}

// Generate a random MAC address for Child Bridge
function generateMacAddress() {
    const hexDigits = '0123456789ABCDEF';
    let mac = '';

    for (let i = 0; i < 6; i++) {
        if (i > 0) mac += ':';
        mac += hexDigits.charAt(Math.floor(Math.random() * 16));
        mac += hexDigits.charAt(Math.floor(Math.random() * 16));
    }

    return mac;
}

// Main function
async function main() {
    log('Starting SwitchBot BLE configuration fix utility');

    // Check if config file exists
    if (!fs.existsSync(configPath)) {
        log(`Config file not found at: ${configPath}`);
        rl.close();
        return;
    }

    // Ask for confirmation
    rl.question('This utility will modify your Homebridge config.json to fix SwitchBot BLE Child Bridge issues. Continue? (y/n): ', (answer) => {
        if (answer.toLowerCase() !== 'y') {
            log('Operation cancelled');
            rl.close();
            return;
        }

        // Backup the config
        if (!backupConfig()) {
            log('Failed to backup config, aborting');
            rl.close();
            return;
        }

        // Read the config
        const config = readConfig();
        if (!config) {
            log('Failed to read config, aborting');
            rl.close();
            return;
        }

        // Fix the config
        const fixedConfig = fixConfig(config);
        if (!fixedConfig) {
            log('No changes needed or failed to fix config');
            rl.close();
            return;
        }

        // Write the fixed config
        if (writeConfig(fixedConfig)) {
            log('');
            log('Configuration has been updated successfully!');
            log('Please restart Homebridge for changes to take effect.');
            log('You can use the restart-homebridge.bat script to restart and clear cache.');
            log('');
        } else {
            log('Failed to write config');
        }

        rl.close();
    });
}

// Run the main function
main(); 