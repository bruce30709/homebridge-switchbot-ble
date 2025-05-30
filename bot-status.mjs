#!/usr/bin/env node
/**
 * SwitchBot Bot Status Query Tool
 * Get the current status of SwitchBot device
 */
import * as SwitchBotAPI from './switchbot-api-server.mjs';

// Get command line arguments
const args = process.argv.slice(2);
const deviceId = args[0];

if (!deviceId) {
    console.error('Error: No device ID provided');
    console.log('Usage: node bot-status.mjs <deviceID>');
    process.exit(1);
}

// Normalize MAC address format
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
        // First try to get device status via advertisement
        const normalizedDeviceId = normalizeMacAddress(deviceId);
        console.error(`Trying to get status of device ${normalizedDeviceId} ...`);

        const status = await SwitchBotAPI.getBotStatus(normalizedDeviceId, { duration: 5000 });

        if (status && !status.error) {
            // Return formatted status info
            const result = {
                deviceId: status.deviceId,
                type: status.type,
                mode: status.mode || 'unknown',
                // Note: The isOn logic here is inverted. In SwitchBot Bot devices, "OFF" means the button is not pressed (the switch may be ON). This is opposite to HomeKit logic, so we invert in index.js
                isOn: status.state === 'OFF',
                battery: status.battery
            };

            console.log(JSON.stringify(result, null, 2));
            return;
        }

        if (status && status.error) {
            console.error(`Failed to get status via advertisement: ${status.error}`);
        }

        // If advertisement fails, try to get status by scanning and connecting
        console.error('Trying to get status by scanning device...');

        // Scan devices
        const devices = await SwitchBotAPI.scanDevices({ duration: 3000 });
        const targetDevice = devices.find(d =>
            d.address.toLowerCase() === normalizedDeviceId.toLowerCase() ||
            (d.id && d.id.toLowerCase() === normalizedDeviceId.toLowerCase())
        );

        if (targetDevice) {
            console.error(`Found device: ${targetDevice.address}`);

            // If status info is already available from scan
            if (targetDevice.state) {
                const result = {
                    deviceId: targetDevice.address,
                    type: targetDevice.type || 'Bot',
                    mode: targetDevice.mode || 'unknown',
                    // Note: The isOn logic here is inverted. In SwitchBot Bot devices, "OFF" means the button is not pressed (the switch may be ON). This is opposite to HomeKit logic, so we invert in index.js
                    isOn: targetDevice.state === 'OFF',
                    battery: targetDevice.battery
                };

                // Only output JSON to stdout, other messages to stderr
                console.log(JSON.stringify(result, null, 2));
                return;
            }
        }

        // If all methods fail, return default (offline) status
        console.error(`Unable to get status of device ${normalizedDeviceId}`);
        const defaultResult = {
            deviceId: normalizedDeviceId,
            type: 'Bot',
            mode: 'unknown',
            isOn: false,
            error: 'Unable to get device status'
        };

        // Only output clean JSON result
        console.log(JSON.stringify(defaultResult, null, 2));
    } catch (error) {
        console.error(`Error occurred while getting status: ${error.message}`);
        // On error, return a basic JSON object to ensure consistent output format
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

// Execute status query
getDeviceStatus(deviceId).finally(() => {
    // Ensure the program exits after completion
    setTimeout(() => {
        process.exit(0);
    }, 1000);
}); 