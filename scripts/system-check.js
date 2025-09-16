#!/usr/bin/env node

/**
 * System Compatibility Checker for homebridge-switchbot-ble
 * Checks system requirements and provides recommendations
 */

const os = require('os');
const fs = require('fs');
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

function checkNodeVersion() {
    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.split('.')[0].substring(1));
    
    console.log('\n=== Node.js Version Check ===');
    log(`Current Node.js version: ${nodeVersion}`, 'blue');
    
    if (majorVersion >= 18) {
        log('✓ Node.js version meets requirements (v18+)', 'green');
        return true;
    } else {
        log('✗ Node.js version is too old. Please upgrade to v18 or later', 'red');
        log('  Install instructions: https://nodejs.org/en/download/', 'yellow');
        return false;
    }
}

function checkOperatingSystem() {
    console.log('\n=== Operating System Check ===');
    const platform = os.platform();
    const arch = os.arch();
    
    log(`Platform: ${platform}`, 'blue');
    log(`Architecture: ${arch}`, 'blue');
    
    let supported = false;
    let recommendations = [];
    
    switch (platform) {
        case 'linux':
            supported = true;
            log('✓ Linux is supported', 'green');
            
            // Check if it's Raspberry Pi
            try {
                const cpuInfo = fs.readFileSync('/proc/cpuinfo', 'utf8');
                if (cpuInfo.includes('Raspberry Pi')) {
                    log('✓ Raspberry Pi detected', 'green');
                    recommendations.push('Use the automated setup script: scripts/raspberry-pi-setup.sh');
                }
            } catch (err) {
                // Not a problem if we can't read /proc/cpuinfo
            }
            
            if (arch === 'arm' || arch === 'arm64') {
                recommendations.push('ARM architecture detected - ensure you have sufficient memory for compilation');
            }
            break;
            
        case 'darwin':
            supported = true;
            log('✓ macOS is supported', 'green');
            break;
            
        case 'win32':
            log('⚠ Windows support is limited', 'yellow');
            recommendations.push('Windows users may need additional Bluetooth drivers');
            recommendations.push('Consider using WSL2 for better compatibility');
            supported = true; // Partial support
            break;
            
        default:
            log(`✗ Platform ${platform} is not officially supported`, 'red');
            supported = false;
    }
    
    return { supported, recommendations };
}

function checkMemory() {
    console.log('\n=== Memory Check ===');
    const totalMem = Math.round(os.totalmem() / 1024 / 1024); // MB
    const freeMem = Math.round(os.freemem() / 1024 / 1024); // MB
    
    log(`Total memory: ${totalMem} MB`, 'blue');
    log(`Free memory: ${freeMem} MB`, 'blue');
    
    let status = true;
    const recommendations = [];
    
    if (totalMem < 512) {
        log('✗ Very low memory detected (< 512MB)', 'red');
        recommendations.push('Increase swap space before installation');
        recommendations.push('Consider using a device with more memory');
        status = false;
    } else if (totalMem < 1024) {
        log('⚠ Low memory detected (< 1GB)', 'yellow');
        recommendations.push('Monitor memory usage during operation');
        recommendations.push('Consider increasing swap space');
    } else {
        log('✓ Sufficient memory available', 'green');
    }
    
    return { status, recommendations };
}

function checkBluetoothSupport() {
    console.log('\n=== Bluetooth Support Check ===');
    const recommendations = [];
    let hasBluetoothCommand = false;
    let hasBluetoothService = false;
    
    const platform = os.platform();
    
    if (platform === 'win32') {
        // Windows Bluetooth check
        try {
            // Check if Windows Bluetooth service is running
            const winBluetoothCheck = execSync('powershell "Get-Service -Name Bthserv | Select-Object Status"', { encoding: 'utf8', stdio: 'pipe' });
            if (winBluetoothCheck.includes('Running')) {
                log('✓ Windows Bluetooth service is running', 'green');
                hasBluetoothService = true;
            } else {
                log('⚠ Windows Bluetooth service is not running', 'yellow');
                recommendations.push('Start Windows Bluetooth service in Services or Device Manager');
            }
            
            // Check for Bluetooth devices
            try {
                const bluetoothDevices = execSync('powershell "Get-PnpDevice -Class Bluetooth"', { encoding: 'utf8', stdio: 'pipe' });
                if (bluetoothDevices.trim()) {
                    log('✓ Bluetooth devices detected', 'green');
                    hasBluetoothCommand = true;
                } else {
                    log('⚠ No Bluetooth devices found', 'yellow');
                    recommendations.push('Ensure Bluetooth adapter is installed and enabled');
                }
            } catch (err) {
                log('⚠ Cannot enumerate Bluetooth devices', 'yellow');
                recommendations.push('Check Device Manager for Bluetooth adapter status');
            }
        } catch (err) {
            log('✗ Cannot check Windows Bluetooth status', 'red');
            recommendations.push('Install Bluetooth drivers and enable Bluetooth in Windows settings');
        }
    } else {
        // Unix/Linux Bluetooth check
        try {
            // Check for hciconfig command
            execSync('which hciconfig', { stdio: 'ignore' });
            hasBluetoothCommand = true;
            log('✓ hciconfig command found', 'green');
            
            // Try to get Bluetooth adapter info
            try {
                const hciOutput = execSync('hciconfig', { encoding: 'utf8', stdio: 'pipe' });
                if (hciOutput.includes('hci')) {
                    log('✓ Bluetooth adapter detected', 'green');
                } else {
                    log('⚠ No Bluetooth adapters found', 'yellow');
                    recommendations.push('Ensure Bluetooth adapter is connected and enabled');
                }
            } catch (err) {
                log('⚠ Cannot access Bluetooth adapter (may need sudo)', 'yellow');
                recommendations.push('You may need to run as root or configure permissions');
            }
        } catch (err) {
            log('✗ hciconfig command not found', 'red');
            recommendations.push('Install bluez package: apt install bluez (Linux) or brew install bluez (macOS)');
        }
        
        // Check for Bluetooth service (Linux)
        if (platform === 'linux') {
            try {
                execSync('systemctl is-active bluetooth', { stdio: 'ignore' });
                hasBluetoothService = true;
                log('✓ Bluetooth service is active', 'green');
            } catch (err) {
                log('✗ Bluetooth service is not active', 'red');
                recommendations.push('Enable Bluetooth service: sudo systemctl enable bluetooth && sudo systemctl start bluetooth');
            }
        } else {
            // macOS or other Unix systems
            hasBluetoothService = true; // Assume service is available
        }
    }
    
    return { 
        status: hasBluetoothCommand && hasBluetoothService,
        recommendations 
    };
}

function checkHomebridge() {
    console.log('\n=== Homebridge Check ===');
    const recommendations = [];
    let homebridgeInstalled = false;
    
    try {
        const homebridgeVersion = execSync('homebridge --version', { encoding: 'utf8', stdio: 'pipe' }).trim();
        homebridgeInstalled = true;
        log(`✓ Homebridge installed: ${homebridgeVersion}`, 'green');
        
        // Check version requirement
        const versionMatch = homebridgeVersion.match(/(\d+)\.(\d+)\.(\d+)/);
        if (versionMatch) {
            const [, major, minor] = versionMatch;
            const version = parseFloat(`${major}.${minor}`);
            
            if (version >= 1.3) {
                log('✓ Homebridge version meets requirements (v1.3.5+)', 'green');
            } else {
                log('⚠ Homebridge version may be too old', 'yellow');
                recommendations.push('Update Homebridge to v1.3.5 or later');
            }
        }
    } catch (err) {
        log('✗ Homebridge not installed', 'red');
        recommendations.push('Install Homebridge: npm install -g homebridge');
    }
    
    return { status: homebridgeInstalled, recommendations };
}

function checkDiskSpace() {
    console.log('\n=== Disk Space Check ===');
    const recommendations = [];
    
    try {
        let available = 0;
        const platform = os.platform();
        
        if (platform === 'linux') {
            const dfOutput = execSync('df / --output=avail --block-size=1M | tail -1', { encoding: 'utf8' });
            available = parseInt(dfOutput.trim());
        } else if (platform === 'darwin') {
            const dfOutput = execSync('df / | tail -1 | awk \'{print $4}\'', { encoding: 'utf8' });
            available = Math.round(parseInt(dfOutput.trim()) / 1024); // Convert from KB to MB
        } else if (platform === 'win32') {
            // Windows disk space check using PowerShell
            const psOutput = execSync('powershell "Get-WmiObject -Class Win32_LogicalDisk -Filter \\"DriveType=3\\" | Select-Object Size,FreeSpace | ConvertTo-Json"', { encoding: 'utf8' });
            try {
                const diskData = JSON.parse(psOutput);
                const mainDisk = Array.isArray(diskData) ? diskData[0] : diskData;
                available = Math.round(mainDisk.FreeSpace / 1024 / 1024); // Convert to MB
            } catch (parseErr) {
                // Fallback for Windows
                const wmic = execSync('wmic logicaldisk get size,freespace /format:csv', { encoding: 'utf8' });
                const lines = wmic.split('\n').filter(line => line.includes(','));
                if (lines.length > 1) {
                    const parts = lines[1].split(',');
                    available = Math.round(parseInt(parts[1]) / 1024 / 1024); // Convert to MB
                }
            }
        }
        
        log(`Available disk space: ${available} MB`, 'blue');
        
        if (available < 500) {
            log('✗ Very low disk space (< 500MB)', 'red');
            recommendations.push('Free up disk space before installation');
            return { status: false, recommendations };
        } else if (available < 1000) {
            log('⚠ Low disk space (< 1GB)', 'yellow');
            recommendations.push('Monitor disk space during installation');
        } else {
            log('✓ Sufficient disk space available', 'green');
        }
    } catch (err) {
        log('⚠ Could not check disk space', 'yellow');
        log(`Error: ${err.message}`, 'yellow');
    }
    
    return { status: true, recommendations };
}

function generateReport(checks) {
    console.log('\n=== Compatibility Report ===');
    
    const allPassed = checks.every(check => check.status);
    const criticalIssues = checks.filter(check => !check.status);
    
    if (allPassed) {
        log('✓ All compatibility checks passed!', 'green');
        log('Your system should work well with homebridge-switchbot-ble', 'green');
    } else {
        log(`✗ ${criticalIssues.length} critical issue(s) found`, 'red');
        log('Please address these issues before installation', 'yellow');
    }
    
    // Collect all recommendations
    const allRecommendations = checks.reduce((acc, check) => {
        return acc.concat(check.recommendations || []);
    }, []);
    
    if (allRecommendations.length > 0) {
        console.log('\n=== Recommendations ===');
        allRecommendations.forEach((rec, index) => {
            log(`${index + 1}. ${rec}`, 'yellow');
        });
    }
    
    // Platform-specific installation instructions
    console.log('\n=== Installation Instructions ===');
    const platform = os.platform();
    
    if (platform === 'linux') {
        try {
            const cpuInfo = fs.readFileSync('/proc/cpuinfo', 'utf8');
            if (cpuInfo.includes('Raspberry Pi')) {
                log('For Raspberry Pi, use the automated setup script:', 'blue');
                log('  curl -fsSL https://raw.githubusercontent.com/bruce30709/homebridge-switchbot-ble/main/scripts/raspberry-pi-setup.sh | sudo bash', 'green');
            } else {
                log('For Linux systems:', 'blue');
                log('  npm install -g homebridge-switchbot-ble', 'green');
            }
        } catch (err) {
            log('For Linux systems:', 'blue');
            log('  npm install -g homebridge-switchbot-ble', 'green');
        }
    } else {
        log('For your platform:', 'blue');
        log('  npm install -g homebridge-switchbot-ble', 'green');
    }
    
    return allPassed;
}

function main() {
    console.log('========================================');
    console.log('homebridge-switchbot-ble Compatibility Checker');
    console.log('========================================');
    
    const checks = [
        { name: 'Node.js', ...checkNodeVersion() },
        { name: 'Operating System', ...checkOperatingSystem() },
        { name: 'Memory', ...checkMemory() },
        { name: 'Bluetooth', ...checkBluetoothSupport() },
        { name: 'Homebridge', ...checkHomebridge() },
        { name: 'Disk Space', ...checkDiskSpace() }
    ];
    
    const compatible = generateReport(checks);
    
    console.log('\n========================================');
    process.exit(compatible ? 0 : 1);
}

if (require.main === module) {
    main();
}

module.exports = {
    checkNodeVersion,
    checkOperatingSystem,
    checkMemory,
    checkBluetoothSupport,
    checkHomebridge,
    checkDiskSpace
};