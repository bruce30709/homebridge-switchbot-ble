#!/usr/bin/env node
/**
 * SwitchBot Bot Command Line Tool
 * Directly use switchbot-api-server.mjs module to control SwitchBot Bot devices
 */
import * as SwitchBotAPI from './switchbot-api-server.mjs';
import { createInterface } from 'readline';

// Detect if it's API call mode
const IS_API_MODE = process.env.NODE_ENV === 'api' ||
    process.argv.includes('--api-mode') ||
    (process.argv[1] && !process.argv[1].endsWith('bot-cmd.mjs'));

// Set auto exit timeout (only for API mode)
if (IS_API_MODE) {
    const AUTO_EXIT_TIMEOUT = 15000; // Auto exit after 15 seconds
    setTimeout(() => {
        console.log('API mode: operation timeout, auto exit');
        process.exit(0);
    }, AUTO_EXIT_TIMEOUT);
}

// Get command line parameters
const args = process.argv.slice(2);
const command = args[0];
const deviceId = args[1];

// Create readline interface
let readline;

// Create readline only when needed
function getReadline() {
    if (!readline) {
        readline = createInterface({
            input: process.stdin,
            output: process.stdout
        });
    }
    return readline;
}

// Wrap readline.question as Promise
function question(query) {
    return new Promise(resolve => {
        getReadline().question(query, resolve);
    });
}

// Close readline interface (only when created)
function closeReadlineIfNeeded() {
    if (readline) {
        readline.close();
        readline = null;
    }
}

// Normalize MAC address format, ensure consistency
function normalizeMacAddress(mac) {
    if (!mac) return null;

    // If already standard format (xx:xx:xx:xx:xx:xx), return lowercase
    if (/^([0-9a-f]{2}:){5}[0-9a-f]{2}$/i.test(mac)) {
        return mac.toLowerCase();
    }

    // Remove all non-hex characters
    const cleanMac = mac.replace(/[^0-9a-f]/gi, '');

    // If 12 characters left, format as standard MAC
    if (cleanMac.length === 12) {
        return cleanMac.match(/.{1,2}/g).join(':').toLowerCase();
    }

    // If not standard, return original
    return mac.toLowerCase();
}

// Compare two MAC addresses (considering different formats)
function compareMacAddresses(mac1, mac2) {
    const normalized1 = normalizeMacAddress(mac1);
    const normalized2 = normalizeMacAddress(mac2);

    if (!normalized1 || !normalized2) return false;

    return normalized1 === normalized2;
}

// Helper function: Format device status output
function formatDeviceStatus(status) {
    if (!status) return 'Unable to get status';
    if (status.error) return `Error: ${status.error}`;

    return `
Device ID: ${status.deviceId}
Type: ${status.type}
Mode: ${status.mode || 'Unknown'}
State: ${status.state === 'ON' ? 'On' : status.state === 'OFF' ? 'Off' : 'Unknown'}
Battery: ${status.battery !== null ? `${status.battery}%` : 'Unknown'}
`;
}

// Show usage instructions
function showHelp() {
    console.log(`
SwitchBot Bot Command Line Tool

Usage:
  node bot-cmd.mjs <command> [args]

Available commands:
  scan                  Scan for nearby SwitchBot devices
  status [deviceID]     Get device status; if not provided, will scan first
  press [deviceID]      Press Bot; if not provided, will scan first
  on [deviceID]         Turn on Bot (switch mode only); if not provided, will scan first
  off [deviceID]        Turn off Bot (switch mode only); if not provided, will scan first
  auto-on               Automatically turn on all scanned Bot devices
  auto-off              Automatically turn off all scanned Bot devices
  server                View server status
  normalize <MAC>       Normalize MAC address format
  find <MAC>            Find device by MAC address (supports non-standard format)

Examples:
  node bot-cmd.mjs scan
  node bot-cmd.mjs status            # Scan and select device to view status
  node bot-cmd.mjs press aa:bb:cc:dd:ee:ff
  node bot-cmd.mjs on                # Scan and select device to turn on
  node bot-cmd.mjs off aa:bb:cc:dd:ee:ff
  node bot-cmd.mjs auto-on           # Automatically turn on all scanned Bot devices
  node bot-cmd.mjs find DD0B7215C339 # Find device using any format
`);
}

// Scan devices and let user select
async function scanAndSelect() {
    console.log('Scanning for nearby SwitchBot devices... (max 3 seconds)');
    const devices = await SwitchBotAPI.scanDevices({ duration: 3000 });

    if (devices.length === 0) {
        console.log('No SwitchBot devices found');
        return null;
    }

    console.log(`Found ${devices.length} SwitchBot devices:`);
    devices.forEach((device, index) => {
        console.log(`\n[${index + 1}] Device:`);
        console.log(`  Device ID: ${device.address}`);
        console.log(`  Type: ${device.type || 'Bot'}`);
        console.log(`  Mode: ${device.mode || 'Unknown'}`);
        console.log(`  State: ${device.state || 'Unknown'}`);
        console.log(`  Battery: ${device.battery !== undefined ? `${device.battery}%` : 'Unknown'}`);
    });

    // Let user select device
    const answer = await question('\nPlease select the device to operate (enter number) or enter q to exit: ');

    if (answer.toLowerCase() === 'q') {
        return null;
    }

    const index = parseInt(answer, 10) - 1;
    if (isNaN(index) || index < 0 || index >= devices.length) {
        console.log('Invalid selection');
        return null;
    }

    return devices[index].address;
}

// Find device by MAC address, supports non-standard format
async function findDeviceByMac(targetMac) {
    if (!targetMac) {
        console.log('Please provide a MAC address');
        return null;
    }

    const normalizedMac = normalizeMacAddress(targetMac);
    console.log(`Trying to find device: ${targetMac} (normalized: ${normalizedMac})`);
    console.log('Scanning... (max 3 seconds, will finish early if device found)');

    // Use targeted scan to find device faster
    const devices = await SwitchBotAPI.scanDevices({
        duration: 3000,
        targetAddress: normalizedMac
    });

    if (devices.length === 0) {
        console.log('No SwitchBot devices found');
        // If not found but MAC provided, still return provided MAC for operation
        console.log(`No device found, will use provided MAC address: ${normalizedMac}`);
        return normalizedMac;
    }

    // Try exact match
    const matchedDevice = devices.find(d =>
        compareMacAddresses(d.address, targetMac) ||
        compareMacAddresses(d.id, targetMac)
    );

    if (matchedDevice) {
        console.log(`Found exact match: ${matchedDevice.address}`);
        return matchedDevice.address;
    }

    // Try partial match (if no exact match)
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
        console.log(`Found partial match: ${partialMatches[0].address}`);
        return partialMatches[0].address;
    } else if (partialMatches.length > 1) {
        console.log(`Found ${partialMatches.length} possible matches:`);

        // Check if API mode or just use provided MAC
        if (IS_API_MODE) {
            // In API mode, auto-select first match
            console.log(`API mode: auto-selecting first device ${partialMatches[0].address}`);
            return partialMatches[0].address;
        }

        // Even if multiple matches, still use provided MAC
        console.log(`Multiple matches found, will use provided MAC address: ${normalizedMac}`);
        return normalizedMac;
    }

    // If no match, still return provided MAC
    console.log(`No match found, will use provided MAC address: ${normalizedMac}`);
    return normalizedMac;
}

// Automatically operate all scanned Bot devices
async function autoOperateAllBots(operation) {
    console.log(`Scanning for nearby SwitchBot devices to ${operation === 'on' ? 'turn on' : 'turn off'}... (max 3 seconds)`);
    const devices = await SwitchBotAPI.scanDevices({ duration: 3000 });

    if (devices.length === 0) {
        console.log('No SwitchBot devices found');
        return;
    }

    console.log(`Found ${devices.length} devices, preparing to ${operation === 'on' ? 'turn on' : 'turn off'}:`);

    // Ask user to confirm operating all devices
    const confirmation = await question(`Are you sure you want to ${operation === 'on' ? 'turn on' : 'turn off'} all these devices? (y/n): `);
    if (confirmation.toLowerCase() !== 'y') {
        console.log('Operation cancelled');
        return;
    }

    // Record successful and failed operations
    const results = {
        success: [],
        failed: [],
        skipped: [] // For devices not in Switch mode
    };

    // Perform operation for each device
    for (let i = 0; i < devices.length; i++) {
        const device = devices[i];
        console.log(`\n[${i + 1}/${devices.length}] Checking device: ${device.address}`);

        // Check device mode first
        try {
            console.log('Checking device mode... (will finish early if device found)');
            const status = await SwitchBotAPI.getBotStatus(device.address);

            // Skip devices not in Switch mode
            if (status && status.mode !== 'Switch') {
                console.log(`⚠ Skipping device ${device.address}: Device is in ${status.mode || 'unknown'} mode, not Switch mode`);
                results.skipped.push({
                    address: device.address,
                    reason: `Device is in ${status.mode || 'unknown'} mode, not Switch mode`
                });
                continue;
            }

            console.log(`[${i + 1}/${devices.length}] ${operation === 'on' ? 'Turning on' : 'Turning off'} device: ${device.address}`);

            const result = operation === 'on'
                ? await SwitchBotAPI.turnOnBot(device.address)
                : await SwitchBotAPI.turnOffBot(device.address);

            if (result.commandSent) {
                console.log(`✓ ${operation === 'on' ? 'Turn on' : 'Turn off'} command sent successfully`);
                results.success.push(device.address);
            } else {
                console.log(`✗ ${operation === 'on' ? 'Turn on' : 'Turn off'} command send failed: ${result.error || 'Unknown error'}`);
                results.failed.push({
                    address: device.address,
                    error: result.error || 'Unknown error'
                });
            }

            // Pause between operations to avoid Bluetooth stack overload
            await new Promise(resolve => setTimeout(resolve, 1000));

        } catch (error) {
            console.error(`✗ Operation failed: ${error.message}`);
            results.failed.push({
                address: device.address,
                error: error.message
            });
        }
    }

    // Display operation result summary
    console.log('\nOperation summary:');
    console.log(`✓ Success: ${results.success.length} devices`);
    console.log(`✗ Failed: ${results.failed.length} devices`);
    console.log(`⚠ Skipped: ${results.skipped.length} devices (not in Switch mode)`);

    if (results.failed.length > 0) {
        console.log('\nFailed devices:');
        results.failed.forEach((item, index) => {
            console.log(`  ${index + 1}. ${item.address} - Error: ${item.error}`);
        });
    }

    if (results.skipped.length > 0) {
        console.log('\nSkipped devices (not in Switch mode):');
        results.skipped.forEach((item, index) => {
            console.log(`  ${index + 1}. ${item.address} - Reason: ${item.reason}`);
        });
    }
}

// Main program
async function main() {
    // Check command
    if (!command || command === 'help') {
        showHelp();
        return;
    }

    try {
        // Normalize device ID
        const normalizedDeviceId = deviceId ? normalizeMacAddress(deviceId) : null;
        if (normalizedDeviceId !== deviceId && deviceId) {
            console.log(`Original device ID: ${deviceId}`);
            console.log(`Normalized MAC address: ${normalizedDeviceId}`);
        }

        switch (command.toLowerCase()) {
            case 'scan':
                console.log('Scanning for nearby SwitchBot devices... (max 3 seconds)');
                const devices = await SwitchBotAPI.scanDevices({ duration: 3000 });

                if (devices.length === 0) {
                    console.log('No SwitchBot devices found');
                    closeReadlineIfNeeded();
                    process.exit(0);
                } else {
                    console.log(`Found ${devices.length} SwitchBot devices:`);
                    devices.forEach((device, index) => {
                        console.log(`\nDevice ${index + 1}:`);
                        console.log(`Device ID: ${device.address}`);
                        console.log(`Type: ${device.type || 'Bot'}`);
                        console.log(`Mode: ${device.mode || 'Unknown'}`);
                        console.log(`State: ${device.state || 'Unknown'}`);
                        console.log(`Battery: ${device.battery !== undefined ? `${device.battery}%` : 'Unknown'}`);
                    });
                    closeReadlineIfNeeded();
                    process.exit(0);
                }
                break;

            case 'find':
                if (!deviceId) {
                    console.log('Please provide the MAC address to search');
                    showHelp();
                    break;
                }

                const foundDevice = await findDeviceByMac(deviceId);
                if (foundDevice) {
                    console.log(`Device found! Normalized MAC address: ${foundDevice}`);
                    const status = await SwitchBotAPI.getBotStatus(foundDevice);
                    console.log(formatDeviceStatus(status));
                    setTimeout(() => { closeReadlineIfNeeded(); process.exit(0); }, 100);
                } else {
                    console.log('No matching device found');
                    closeReadlineIfNeeded();
                    process.exit(0);
                }
                break;

            case 'normalize':
                if (!deviceId) {
                    console.log('Please provide the MAC address to normalize');
                    break;
                }

                const normalizedMac = normalizeMacAddress(deviceId);
                console.log(`Original MAC: ${deviceId}`);
                console.log(`Normalized MAC: ${normalizedMac}`);
                break;

            case 'status': {
                let targetDeviceId = normalizedDeviceId;

                if (deviceId) {
                    targetDeviceId = await findDeviceByMac(deviceId);
                }

                // If no device ID provided, scan and select
                if (!targetDeviceId) {
                    targetDeviceId = await scanAndSelect();
                    if (!targetDeviceId) {
                        console.log('Operation cancelled');
                        closeReadlineIfNeeded();
                        process.exit(0);
                        break;
                    }
                }

                console.log(`Getting device ${targetDeviceId} status...`);
                console.log('Scanning... (max 3 seconds, will finish early if device found)');
                const status = await SwitchBotAPI.getBotStatus(targetDeviceId);
                console.log(formatDeviceStatus(status));
                closeReadlineIfNeeded();
                process.exit(0);
                break;
            }

            case 'press': {
                let targetDeviceId = normalizedDeviceId;

                if (deviceId) {
                    targetDeviceId = await findDeviceByMac(deviceId);
                }

                // If no device ID provided, scan and select
                if (!targetDeviceId) {
                    targetDeviceId = await scanAndSelect();
                    if (!targetDeviceId) {
                        console.log('Operation cancelled');
                        closeReadlineIfNeeded();
                        process.exit(0);
                        break;
                    }
                }

                console.log(`Pressing device ${targetDeviceId}...`);
                const pressResult = await SwitchBotAPI.pressBot(targetDeviceId);
                console.log('✓ Press command sent successfully');
                closeReadlineIfNeeded();
                process.exit(0);
                break;
            }

            case 'on': {
                let targetDeviceId = normalizedDeviceId;

                if (deviceId) {
                    targetDeviceId = await findDeviceByMac(deviceId);
                }

                // If no device ID provided, scan and select
                if (!targetDeviceId) {
                    targetDeviceId = await scanAndSelect();
                    if (!targetDeviceId) {
                        console.log('Operation cancelled');
                        closeReadlineIfNeeded();
                        process.exit(0);
                        break;
                    }
                }

                // Check device mode before turning on
                console.log(`Checking device ${targetDeviceId} mode...`);
                console.log('Scanning... (max 3 seconds, will finish early if device found)');
                const status = await SwitchBotAPI.getBotStatus(targetDeviceId);

                if (status && status.mode !== 'Switch') {
                    console.log(`⚠ Cannot turn on device: Device is in ${status.mode || 'unknown'} mode, not Switch mode`);
                    console.log(`For devices in Press mode, use 'press' command instead of 'on'`);
                    closeReadlineIfNeeded();
                    process.exit(1);
                    break;
                }

                console.log(`Turning on device ${targetDeviceId}...`);
                const onResult = await SwitchBotAPI.turnOnBot(targetDeviceId);
                console.log('✓ Turn on command sent successfully');
                closeReadlineIfNeeded();
                process.exit(0);
                break;
            }

            case 'off': {
                let targetDeviceId = normalizedDeviceId;

                if (deviceId) {
                    targetDeviceId = await findDeviceByMac(deviceId);
                }

                // If no device ID provided, scan and select
                if (!targetDeviceId) {
                    targetDeviceId = await scanAndSelect();
                    if (!targetDeviceId) {
                        console.log('Operation cancelled');
                        closeReadlineIfNeeded();
                        process.exit(0);
                        break;
                    }
                }

                // Check device mode before turning off
                console.log(`Checking device ${targetDeviceId} mode...`);
                console.log('Scanning... (max 3 seconds, will finish early if device found)');
                const status = await SwitchBotAPI.getBotStatus(targetDeviceId);

                if (status && status.mode !== 'Switch') {
                    console.log(`⚠ Cannot turn off device: Device is in ${status.mode || 'unknown'} mode, not Switch mode`);
                    console.log(`For devices in Press mode, use 'press' command instead of 'off'`);
                    closeReadlineIfNeeded();
                    process.exit(1);
                    break;
                }

                console.log(`Turning off device ${targetDeviceId}...`);
                const offResult = await SwitchBotAPI.turnOffBot(targetDeviceId);
                console.log('✓ Turn off command sent successfully');
                closeReadlineIfNeeded();
                process.exit(0);
                break;
            }

            case 'auto-on': {
                // Automatically turn on all scanned Bot devices
                await autoOperateAllBots('on');
                break;
            }

            case 'auto-off': {
                // Automatically turn off all scanned Bot devices
                await autoOperateAllBots('off');
                break;
            }

            case 'server':
                console.log('Getting server status...');
                const serverStatus = await SwitchBotAPI.getServerStatus();
                console.log(`
Platform: ${serverStatus.platform}
Node version: ${serverStatus.nodeVersion}
Uptime: ${serverStatus.uptime}
Admin rights: ${serverStatus.adminRights ? 'Yes' : 'No'}
${serverStatus.adminMessage}
`);
                break;

            default:
                console.error(`Unknown command: ${command}`);
                showHelp();
        }
    } catch (error) {
        console.error('Error executing command:', error.message);
    } finally {
        // Close readline interface
        closeReadlineIfNeeded();
    }
}

// Execute main program
main().catch(error => {
    console.error('Error executing program:', error);
    closeReadlineIfNeeded();
    process.exit(1);
});