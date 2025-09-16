const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

console.log(`[${new Date().toLocaleString()}] Running install.js...`);

// Check if running on Raspberry Pi
function isRaspberryPi() {
  try {
    const cpuInfo = fs.readFileSync('/proc/cpuinfo', 'utf8');
    return cpuInfo.includes('Raspberry Pi');
  } catch (err) {
    return false;
  }
}

// Check system compatibility
function checkSystemCompatibility() {
  const nodeVersion = process.version;
  const majorVersion = parseInt(nodeVersion.split('.')[0].substring(1));
  
  console.log(`[${new Date().toLocaleString()}] Node.js version: ${nodeVersion}`);
  
  if (majorVersion < 18) {
    console.warn(`[${new Date().toLocaleString()}] WARNING: Node.js v18+ is recommended. Current version: ${nodeVersion}`);
  }
  
  // Check memory on ARM devices
  if (os.arch().includes('arm')) {
    const totalMem = Math.round(os.totalmem() / 1024 / 1024); // MB
    console.log(`[${new Date().toLocaleString()}] Total memory: ${totalMem} MB`);
    
    if (totalMem < 512) {
      console.warn(`[${new Date().toLocaleString()}] WARNING: Low memory detected (${totalMem}MB). Installation may require additional swap space.`);
    }
  }
  
  if (isRaspberryPi()) {
    console.log(`[${new Date().toLocaleString()}] Raspberry Pi detected - applying optimizations`);
    applyRaspberryPiOptimizations();
  }
}

// Apply Raspberry Pi specific optimizations
function applyRaspberryPiOptimizations() {
  try {
    // Check if Bluetooth service is available
    try {
      execSync('systemctl is-active bluetooth', { stdio: 'ignore' });
      console.log(`[${new Date().toLocaleString()}] Bluetooth service is active`);
    } catch (err) {
      console.warn(`[${new Date().toLocaleString()}] WARNING: Bluetooth service not active. Run 'sudo systemctl enable bluetooth && sudo systemctl start bluetooth'`);
    }
    
    // Check Node.js capabilities for Bluetooth
    try {
      const nodePath = execSync('which node', { encoding: 'utf8' }).trim();
      execSync(`getcap ${nodePath}`, { stdio: 'ignore' });
      console.log(`[${new Date().toLocaleString()}] Node.js Bluetooth capabilities configured`);
    } catch (err) {
      console.warn(`[${new Date().toLocaleString()}] WARNING: Node.js may need Bluetooth capabilities. Run as root: 'sudo setcap cap_net_raw+eip \$(which node)'`);
    }
    
  } catch (error) {
    console.warn(`[${new Date().toLocaleString()}] Could not apply all Raspberry Pi optimizations: ${error.message}`);
  }
}

// Provide installation guidance
function provideInstallationGuidance() {
  console.log(`[${new Date().toLocaleString()}] Installation guidance:`);
  
  if (isRaspberryPi()) {
    console.log(`[${new Date().toLocaleString()}] - For comprehensive Raspberry Pi setup, see: docs/raspberry-pi-setup.md`);
    console.log(`[${new Date().toLocaleString()}] - Use automated setup script: scripts/raspberry-pi-setup.sh`);
  }
  
  console.log(`[${new Date().toLocaleString()}] - Run system compatibility check: node scripts/system-check.js`);
  console.log(`[${new Date().toLocaleString()}] - For troubleshooting, see: README.md#troubleshooting`);
}

const hbConfigPath = path.join(process.env.HOMEBRIDGE_CONFIG_UI || '', 'config.json');
const defaultConfig = {
  platforms: [
    {
      platform: 'SwitchBotBLE',
      name: 'SwitchBot BLE',
      devices: [],
    },
  ],
};

// Ensure config.json exists or warn the user
if (fs.existsSync(hbConfigPath)) {
  console.log(`[${new Date().toLocaleString()}] Found config.json at: ${hbConfigPath}`);
} else {
  console.warn(`[${new Date().toLocaleString()}] config.json not found. Skipping auto-fix.`);
}

// Optional: Fix common child bridge config issues
// You can extend this logic as needed
try {
  const userPath = process.env.HOME || process.env.USERPROFILE;
  const hbPath = path.join(userPath, '.homebridge');
  const cachedAccessoryPath = path.join(hbPath, 'accessories', 'cachedAccessories');

  // Clean up cachedAccessories if needed
  if (fs.existsSync(cachedAccessoryPath)) {
    fs.unlinkSync(cachedAccessoryPath);
    console.log(`[${new Date().toLocaleString()}] Removed stale cachedAccessories.`);
  }

  // Additional fixes can be added here
} catch (error) {
  console.error(`[${new Date().toLocaleString()}] Error during cleanup: ${error.message}`);
}

// Run system checks and optimizations
checkSystemCompatibility();
provideInstallationGuidance();

console.log(`[${new Date().toLocaleString()}] install.js completed.`);
