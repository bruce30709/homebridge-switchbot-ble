#!/usr/bin/env node

/**
 * Performance Test Script for homebridge-switchbot-ble
 * Tests system performance and provides optimization recommendations
 */

const os = require('os');
const fs = require('fs');
const { performance } = require('perf_hooks');
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

function isRaspberryPi() {
    try {
        if (os.platform() !== 'linux') return false;
        const cpuInfo = fs.readFileSync('/proc/cpuinfo', 'utf8');
        return cpuInfo.includes('Raspberry Pi');
    } catch (err) {
        return false;
    }
}

function testCPUPerformance() {
    console.log('\n=== CPU Performance Test ===');
    
    const start = performance.now();
    
    // Simple CPU-intensive task
    let result = 0;
    for (let i = 0; i < 1000000; i++) {
        result += Math.sqrt(i);
    }
    
    const end = performance.now();
    const cpuTime = end - start;
    
    log(`CPU test completed in ${cpuTime.toFixed(2)}ms`, 'blue');
    
    // Performance recommendations based on timing
    let recommendation = '';
    if (cpuTime > 500) {
        log('⚠ Slow CPU performance detected', 'yellow');
        recommendation = 'Consider optimizing settings for low-power device';
    } else if (cpuTime > 200) {
        log('✓ Moderate CPU performance', 'yellow');
        recommendation = 'Performance is adequate';
    } else {
        log('✓ Good CPU performance', 'green');
        recommendation = 'Excellent performance';
    }
    
    return { cpuTime, recommendation };
}

function testMemoryUsage() {
    console.log('\n=== Memory Usage Test ===');
    
    const totalMem = Math.round(os.totalmem() / 1024 / 1024); // MB
    const freeMem = Math.round(os.freemem() / 1024 / 1024); // MB
    const usedMem = totalMem - freeMem;
    const usagePercent = Math.round((usedMem / totalMem) * 100);
    
    log(`Total Memory: ${totalMem} MB`, 'blue');
    log(`Used Memory: ${usedMem} MB (${usagePercent}%)`, 'blue');
    log(`Free Memory: ${freeMem} MB`, 'blue');
    
    let status = 'good';
    let recommendation = '';
    
    if (totalMem < 512) {
        log('✗ Very low memory system', 'red');
        status = 'critical';
        recommendation = 'Increase swap space and optimize settings for low memory';
    } else if (totalMem < 1024) {
        log('⚠ Low memory system', 'yellow');
        status = 'warning';
        recommendation = 'Monitor memory usage and consider increasing swap';
    } else if (usagePercent > 80) {
        log('⚠ High memory usage', 'yellow');
        status = 'warning';
        recommendation = 'Monitor memory usage and close unnecessary applications';
    } else {
        log('✓ Good memory status', 'green');
        recommendation = 'Memory usage is healthy';
    }
    
    return { totalMem, freeMem, usagePercent, status, recommendation };
}

function testDiskIO() {
    console.log('\n=== Disk I/O Performance Test ===');
    
    // Use platform-appropriate temp directory
    const platform = os.platform();
    let testFile;
    if (platform === 'win32') {
        const tempDir = process.env.TEMP || process.env.TMP || 'C:\\temp';
        testFile = require('path').join(tempDir, 'homebridge-io-test.tmp');
    } else {
        testFile = '/tmp/homebridge-io-test.tmp';
    }
    
    const testData = Buffer.alloc(1024 * 1024, 'a'); // 1MB of data
    
    try {
        // Write test
        const writeStart = performance.now();
        fs.writeFileSync(testFile, testData);
        const writeEnd = performance.now();
        const writeTime = writeEnd - writeStart;
        
        // Read test
        const readStart = performance.now();
        const readData = fs.readFileSync(testFile);
        const readEnd = performance.now();
        const readTime = readEnd - readStart;
        
        // Cleanup
        fs.unlinkSync(testFile);
        
        log(`Write Speed: ${(1000 / writeTime).toFixed(2)} MB/s`, 'blue');
        log(`Read Speed: ${(1000 / readTime).toFixed(2)} MB/s`, 'blue');
        
        let recommendation = '';
        if (writeTime > 100 || readTime > 50) {
            log('⚠ Slow disk I/O detected', 'yellow');
            if (platform === 'win32') {
                recommendation = 'Consider using SSD storage or defragmenting disk';
            } else {
                recommendation = 'Consider using faster storage (SD card class 10+ for Pi)';
            }
        } else {
            log('✓ Good disk I/O performance', 'green');
            recommendation = 'Disk performance is adequate';
        }
        
        return { writeTime, readTime, recommendation };
        
    } catch (error) {
        log(`✗ Disk I/O test failed: ${error.message}`, 'red');
        return { writeTime: 0, readTime: 0, recommendation: 'Could not test disk performance' };
    }
}

function testBluetoothAvailability() {
    console.log('\n=== Bluetooth Availability Test ===');
    
    const platform = os.platform();
    
    if (platform === 'win32') {
        // Windows Bluetooth check
        try {
            const serviceStatus = execSync('powershell "Get-Service -Name Bthserv | Select-Object Status"', { encoding: 'utf8' });
            if (serviceStatus.includes('Running')) {
                log('✓ Windows Bluetooth service is running', 'green');
                
                try {
                    const devices = execSync('powershell "Get-PnpDevice -Class Bluetooth"', { encoding: 'utf8' });
                    if (devices.trim()) {
                        log('✓ Bluetooth devices found', 'green');
                        return { available: true, recommendation: 'Bluetooth hardware is ready' };
                    } else {
                        log('⚠ No Bluetooth devices found', 'yellow');
                        return { available: false, recommendation: 'Install Bluetooth drivers and check Device Manager' };
                    }
                } catch (err) {
                    log('⚠ Cannot enumerate Bluetooth devices', 'yellow');
                    return { available: false, recommendation: 'Check Device Manager for Bluetooth adapter' };
                }
            } else {
                log('✗ Windows Bluetooth service not running', 'red');
                return { available: false, recommendation: 'Start Bluetooth service in Windows services' };
            }
        } catch (err) {
            log('✗ Cannot check Windows Bluetooth', 'red');
            return { available: false, recommendation: 'Install Bluetooth support and drivers' };
        }
    } else {
        // Unix/Linux/macOS Bluetooth check
        try {
            // Test if hciconfig is available
            execSync('which hciconfig', { stdio: 'ignore' });
            log('✓ Bluetooth tools available', 'green');
            
            try {
                // Test if Bluetooth adapter is available
                const hciOutput = execSync('hciconfig', { encoding: 'utf8', stdio: 'pipe' });
                if (hciOutput.includes('hci')) {
                    log('✓ Bluetooth adapter found', 'green');
                    return { available: true, recommendation: 'Bluetooth hardware is ready' };
                } else {
                    log('⚠ No Bluetooth adapters found', 'yellow');
                    return { available: false, recommendation: 'Check Bluetooth hardware connection' };
                }
            } catch (err) {
                log('⚠ Cannot access Bluetooth adapter', 'yellow');
                return { available: false, recommendation: 'Check Bluetooth permissions and service status' };
            }
        } catch (err) {
            log('✗ Bluetooth tools not installed', 'red');
            const installCmd = platform === 'darwin' ? 'brew install bluez' : 'apt install bluez';
            return { available: false, recommendation: `Install bluez package: ${installCmd}` };
        }
    }
}

function getRaspberryPiModel() {
    if (!isRaspberryPi()) return null;
    
    try {
        const cpuInfo = fs.readFileSync('/proc/cpuinfo', 'utf8');
        const modelMatch = cpuInfo.match(/Model\s*:\s*(.+)/);
        const revisionMatch = cpuInfo.match(/Revision\s*:\s*(.+)/);
        
        if (modelMatch) {
            return modelMatch[1].trim();
        } else if (revisionMatch) {
            return `Raspberry Pi (Revision: ${revisionMatch[1].trim()})`;
        }
    } catch (err) {
        // Ignore error
    }
    
    return 'Raspberry Pi (Unknown model)';
}

function generateOptimizationRecommendations(results) {
    console.log('\n=== Optimization Recommendations ===');
    
    const recommendations = [];
    
    // CPU optimizations
    if (results.cpu.cpuTime > 300) {
        recommendations.push('CPU Performance:');
        recommendations.push('  - Use longer timeouts for device operations');
        recommendations.push('  - Reduce status check frequency');
        recommendations.push('  - Consider using child bridge mode for isolation');
    }
    
    // Memory optimizations
    if (results.memory.totalMem < 1024 || results.memory.usagePercent > 70) {
        recommendations.push('Memory Optimization:');
        recommendations.push('  - Increase swap space');
        recommendations.push('  - Use longer intervals between device checks');
        recommendations.push('  - Monitor for memory leaks');
        if (isRaspberryPi()) {
            recommendations.push('  - Set gpu_mem=16 in /boot/config.txt');
        }
    }
    
    // Bluetooth optimizations
    if (!results.bluetooth.available) {
        recommendations.push('Bluetooth Setup:');
        recommendations.push('  - Install bluetooth packages: sudo apt install bluez');
        recommendations.push('  - Enable bluetooth service: sudo systemctl enable bluetooth');
        recommendations.push('  - Configure Node.js capabilities for Bluetooth access');
    }
    
    // Raspberry Pi specific
    if (isRaspberryPi()) {
        recommendations.push('Raspberry Pi Specific:');
        recommendations.push('  - Use official power supply');
        recommendations.push('  - Use Class 10+ SD card');
        recommendations.push('  - Configure Bluetooth optimizations in /etc/bluetooth/main.conf');
        recommendations.push('  - Consider using ethernet instead of WiFi for stability');
    }
    
    // Configuration recommendations
    recommendations.push('Plugin Configuration:');
    recommendations.push('  - Use appropriate statusCheckInterval (120-300s for Pi)');
    recommendations.push('  - Set longer connectTimeout (5000ms) and commandTimeout (3000ms)');
    recommendations.push('  - Enable debug mode only when troubleshooting');
    recommendations.push('  - Use child bridge mode for better isolation');
    
    if (recommendations.length === 0) {
        log('✓ System is well optimized! No specific recommendations.', 'green');
    } else {
        recommendations.forEach(rec => {
            if (rec.endsWith(':')) {
                log(rec, 'blue');
            } else {
                log(rec, 'yellow');
            }
        });
    }
}

function generateConfigurationExample(results) {
    console.log('\n=== Recommended Configuration ===');
    
    // Base timeouts
    let statusCheckInterval = 60;
    let connectTimeout = 3000;
    let commandTimeout = 1000;
    
    // Adjust based on performance
    if (results.cpu.cpuTime > 300 || results.memory.totalMem < 1024) {
        statusCheckInterval = 180;
        connectTimeout = 5000;
        commandTimeout = 3000;
    }
    
    if (isRaspberryPi()) {
        statusCheckInterval = Math.max(statusCheckInterval, 120);
        connectTimeout = Math.max(connectTimeout, 4000);
        commandTimeout = Math.max(commandTimeout, 2000);
    }
    
    const config = {
        platform: "SwitchbotBLE",
        name: "SwitchBot",
        devices: [
            {
                name: "Example Device",
                deviceId: "xx:xx:xx:xx:xx:xx",
                mode: "switch",
                debug: false,
                enableStatusCheck: true,
                statusCheckInterval: statusCheckInterval,
                connectTimeout: connectTimeout,
                commandTimeout: commandTimeout,
                retryAttempts: 3,
                retryDelay: 2000
            }
        ]
    };
    
    if (results.memory.totalMem < 1024 || isRaspberryPi()) {
        config._bridge = {
            username: "0E:22:5D:E0:FE:F1",
            port: 41087
        };
    }
    
    console.log(JSON.stringify(config, null, 2));
}

function main() {
    console.log('========================================');
    console.log('homebridge-switchbot-ble Performance Test');
    console.log('========================================');
    
    // System information
    const platform = os.platform();
    const arch = os.arch();
    const isRPi = isRaspberryPi();
    const model = getRaspberryPiModel();
    
    log(`Platform: ${platform}/${arch}`, 'blue');
    if (isRPi && model) {
        log(`Hardware: ${model}`, 'blue');
    }
    
    // Run tests
    const results = {
        cpu: testCPUPerformance(),
        memory: testMemoryUsage(),
        disk: testDiskIO(),
        bluetooth: testBluetoothAvailability()
    };
    
    // Generate recommendations
    generateOptimizationRecommendations(results);
    generateConfigurationExample(results);
    
    console.log('\n========================================');
    console.log('Performance test completed!');
    console.log('========================================');
    
    // Exit with appropriate code
    const hasIssues = results.memory.status === 'critical' || !results.bluetooth.available;
    process.exit(hasIssues ? 1 : 0);
}

if (require.main === module) {
    main();
}

module.exports = {
    testCPUPerformance,
    testMemoryUsage,
    testDiskIO,
    testBluetoothAvailability,
    isRaspberryPi
};