const fs = require('fs');
const path = require('path');

console.log(`[${new Date().toLocaleString()}] Running install.js...`);

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
  console.error(`[${new Date().toLocaleString()}] Error during install.js: ${error.message}`);
}

console.log(`[${new Date().toLocaleString()}] install.js completed.`);
