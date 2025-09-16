#!/usr/bin/env node

/**
 * Cross-platform Bluetooth Troubleshooting Script for homebridge-switchbot-ble
 * This script helps diagnose and fix common Bluetooth issues on Windows, macOS, and Linux
 */

const os = require('os');
const { execSync } = require('child_process');

// Colors for output
const colors = {
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    reset: '\x1b[0m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function header(text) {
    console.log('\n' + '='.repeat(60));
    console.log(text);
    console.log('='.repeat(60));
}

function checkSystem() {
    const platform = os.platform();
    const arch = os.arch();
    
    header('Bluetooth Troubleshooting for homebridge-switchbot-ble');
    
    log(`Platform: ${platform}/${arch}`, 'blue');
    
    return platform;
}

function checkWindowsBluetooth() {
    log('\n1. Checking Windows Bluetooth Service...', 'blue');
    
    try {
        const serviceStatus = execSync('powershell "Get-Service -Name Bthserv | Select-Object Status"', { encoding: 'utf8' });
        if (serviceStatus.includes('Running')) {
            log('✓ Windows Bluetooth service is running', 'green');
        } else {
            log('✗ Windows Bluetooth service is not running', 'red');
            log('  Fix: Start Bluetooth service in Services (services.msc)', 'yellow');
        }
    } catch (err) {
        log('✗ Cannot check Bluetooth service', 'red');
        log('  Check Windows services and Device Manager', 'yellow');
    }
    
    log('\n2. Checking Bluetooth Hardware...', 'blue');
    try {
        const devices = execSync('powershell "Get-PnpDevice -Class Bluetooth | Where-Object {$_.Status -eq \\"OK\\"}"', { encoding: 'utf8' });
        if (devices.trim()) {
            log('✓ Bluetooth devices found', 'green');
        } else {
            log('⚠ No working Bluetooth devices found', 'yellow');
            log('  Check Device Manager for Bluetooth adapter issues', 'yellow');
        }
    } catch (err) {
        log('✗ Cannot enumerate Bluetooth devices', 'red');
        log('  Install/update Bluetooth drivers', 'yellow');
    }
    
    log('\n3. Checking Node.js...', 'blue');
    try {
        const nodeVersion = process.version;
        const majorVersion = parseInt(nodeVersion.split('.')[0].substring(1));
        log(`Node.js version: ${nodeVersion}`, 'blue');
        
        if (majorVersion >= 18) {
            log('✓ Node.js version is compatible', 'green');
        } else {
            log('⚠ Node.js version may be too old', 'yellow');
            log('  Recommended: Node.js v18 or later', 'yellow');
        }
    } catch (err) {
        log('✗ Cannot check Node.js version', 'red');
    }
}

function checkUnixBluetooth() {
    log('\n1. Checking Bluetooth Service...', 'blue');
    
    if (os.platform() === 'linux') {
        try {
            execSync('systemctl is-active bluetooth', { stdio: 'ignore' });
            log('✓ Bluetooth service is active', 'green');
        } catch (err) {
            log('✗ Bluetooth service is not active', 'red');
            log('  Fix: sudo systemctl enable bluetooth && sudo systemctl start bluetooth', 'yellow');
        }
    } else {
        log('⚠ Service check not applicable for macOS', 'yellow');
    }
    
    log('\n2. Checking Bluetooth Hardware...', 'blue');
    try {
        execSync('which hciconfig', { stdio: 'ignore' });
        log('✓ hciconfig command available', 'green');
        
        try {
            const hciOutput = execSync('hciconfig', { encoding: 'utf8' });
            if (hciOutput.includes('hci')) {
                log('✓ Bluetooth adapter found', 'green');
            } else {
                log('⚠ No Bluetooth adapters found', 'yellow');
                log('  Check hardware connection', 'yellow');
            }
        } catch (err) {
            log('⚠ Cannot access Bluetooth adapter', 'yellow');
            log('  May need sudo or permissions configuration', 'yellow');
        }
    } catch (err) {
        log('✗ hciconfig command not found', 'red');
        log('  Install: apt install bluez (Linux) or brew install bluez (macOS)', 'yellow');
    }
    
    log('\n3. Checking User Permissions...', 'blue');
    if (os.platform() === 'linux') {
        try {
            const user = process.env.USER || 'unknown';
            const groups = execSync(`groups ${user}`, { encoding: 'utf8' });
            
            if (groups.includes('bluetooth')) {
                log(`✓ User '${user}' is in bluetooth group`, 'green');
            } else {
                log(`✗ User '${user}' is not in bluetooth group`, 'red');
                log(`  Fix: sudo usermod -a -G bluetooth ${user}`, 'yellow');
                log('  Note: Log out and back in for changes to take effect', 'yellow');
            }
        } catch (err) {
            log('⚠ Cannot check user groups', 'yellow');
        }
    }
    
    log('\n4. Checking Node.js Capabilities...', 'blue');
    if (os.platform() === 'linux') {
        try {
            const nodePath = execSync('which node', { encoding: 'utf8' }).trim();
            try {
                const caps = execSync(`getcap ${nodePath}`, { encoding: 'utf8' });
                if (caps.includes('cap_net_raw')) {
                    log('✓ Node.js has Bluetooth capabilities', 'green');
                } else {
                    log('✗ Node.js missing Bluetooth capabilities', 'red');
                    log(`  Fix: sudo setcap cap_net_raw+eip ${nodePath}`, 'yellow');
                    log(`       sudo setcap cap_net_admin+eip ${nodePath}`, 'yellow');
                }
            } catch (err) {
                log('⚠ Cannot check Node.js capabilities', 'yellow');
                log('  getcap command not available', 'yellow');
            }
        } catch (err) {
            log('✗ Cannot find Node.js executable', 'red');
        }
    }
}

function checkMemoryAndResources() {
    log('\n5. Checking System Resources...', 'blue');
    
    const totalMem = Math.round(os.totalmem() / 1024 / 1024); // MB
    const freeMem = Math.round(os.freemem() / 1024 / 1024); // MB
    
    log(`Memory: ${freeMem}MB free / ${totalMem}MB total`, 'blue');
    
    if (totalMem < 512) {
        log('✗ Very low memory (< 512MB)', 'red');
        log('  Consider using a device with more memory', 'yellow');
    } else if (totalMem < 1024) {
        log('⚠ Low memory (< 1GB)', 'yellow');
        log('  Monitor memory usage during operation', 'yellow');
    } else {
        log('✓ Sufficient memory', 'green');
    }
}

function provideSolutions(platform) {
    header('Common Solutions');
    
    if (platform === 'win32') {
        log('\nWindows Solutions:', 'blue');
        log('1. Restart Bluetooth service:', 'yellow');
        log('   - Open Services (services.msc)', 'yellow');
        log('   - Find "Bluetooth Support Service"', 'yellow');
        log('   - Right-click and restart', 'yellow');
        log('', 'yellow');
        log('2. Update Bluetooth drivers:', 'yellow');
        log('   - Open Device Manager', 'yellow');
        log('   - Expand Bluetooth section', 'yellow');
        log('   - Right-click adapter and update driver', 'yellow');
        log('', 'yellow');
        log('3. Check Windows Bluetooth settings:', 'yellow');
        log('   - Settings > Devices > Bluetooth & other devices', 'yellow');
        log('   - Ensure Bluetooth is turned on', 'yellow');
    } else {
        log('\nUnix/Linux Solutions:', 'blue');
        log('1. Restart Bluetooth service:', 'yellow');
        log('   sudo systemctl restart bluetooth', 'yellow');
        log('', 'yellow');
        log('2. Reset Node.js capabilities:', 'yellow');
        log('   sudo setcap -r $(which node)', 'yellow');
        log('   sudo setcap cap_net_raw+eip $(which node)', 'yellow');
        log('   sudo setcap cap_net_admin+eip $(which node)', 'yellow');
        log('', 'yellow');
        log('3. Add user to bluetooth group:', 'yellow');
        log('   sudo usermod -a -G bluetooth $USER', 'yellow');
        log('   # Then log out and back in', 'yellow');
        log('', 'yellow');
        log('4. Restart system (if hardware issues persist):', 'yellow');
        log('   sudo reboot', 'yellow');
    }
    
    log('\nGeneral Solutions:', 'blue');
    log('5. Check plugin logs:', 'yellow');
    log('   tail -f ~/.homebridge/homebridge.log', 'yellow');
    log('', 'yellow');
    log('6. Run system compatibility check:', 'yellow');
    log('   npm run system-check', 'yellow');
    log('', 'yellow');
    log('7. For more help:', 'yellow');
    log('   - GitHub Issues: https://github.com/bruce30709/homebridge-switchbot-ble/issues', 'yellow');
    log('   - Documentation: docs/raspberry-pi-setup.md', 'yellow');
}

function main() {
    const platform = checkSystem();
    
    if (platform === 'win32') {
        checkWindowsBluetooth();
    } else {
        checkUnixBluetooth();
    }
    
    checkMemoryAndResources();
    provideSolutions(platform);
    
    header('Troubleshooting Complete');
}

if (require.main === module) {
    main();
}

module.exports = { main };