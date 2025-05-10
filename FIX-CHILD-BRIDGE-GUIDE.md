# SwitchBot BLE Child Bridge Fix Guide

This guide will help you fix common issues with the SwitchBot BLE plugin's Child Bridge functionality, especially when you're seeing problems with state tracking or commands not being executed properly.

## Common Issues

1. **Accessories not showing up in HomeKit**: This happens when the Child Bridge is not correctly configured.
2. **Commands not executing**: This occurs when the plugin can't find or communicate with your SwitchBot devices.
3. **States not updating**: This happens when the plugin isn't tracking the state of your devices correctly.
4. **Debug logs not showing**: This occurs when logging isn't configured properly or when commands aren't being executed.

## Fix #1: Ensure Correct Configuration

Make sure your Homebridge `config.json` is correctly set up for Child Bridge mode:

```json
"platforms": [
  {
    "platform": "SwitchbotBLE",
    "name": "SwitchBot",
    "debug": true,
    "devices": [
      {
        "name": "Living Room Light",
        "deviceId": "xx:xx:xx:xx:xx:xx",
        "mode": "switch"
      }
    ],
    "_bridge": {
      "username": "0E:22:5D:E0:FE:F1",
      "port": 41087
    }
  }
]
```

**Important details**:
- `platform` must be exactly "SwitchbotBLE" (capital BLE)
- Set `debug` to true for troubleshooting
- Use `switch` mode instead of `press` for better state tracking
- Include the `_bridge` section for Child Bridge functionality

## Fix #2: Remove Accessory Mode Configurations

If you have both accessory and platform configurations, it can cause conflicts. Remove any "SwitchbotBLE" entries from the `accessories` section of your config.json.

## Fix #3: Clear Homebridge Cache

Run the included `restart-homebridge.bat` script to clear cache and restart Homebridge:

1. Open a command prompt as administrator
2. Navigate to the plugin directory: `cd C:\Users\lksvs\AppData\Roaming\npm\node_modules\homebridge-switchbot-ble`
3. Run the restart script: `restart-homebridge.bat`

## Fix #4: Configure Proper State Tracking

The latest version of the plugin now properly tracks device states, but you need to:

1. Use `mode: "switch"` instead of `press` for devices you want to maintain state
2. Make sure you're using direct commands with the bot-cmd.mjs tool

## Fix #5: Manual Reset Process

If the above steps don't work, try this manual reset process:

1. Stop Homebridge
2. Delete the accessories cache:
   ```
   del %USERPROFILE%\.homebridge\accessories\*
   ```
3. Edit your config.json to make sure:
   - Only one instance of the SwitchBot plugin is configured
   - The platform name is correctly set to "SwitchbotBLE"
   - Debug mode is enabled
4. Restart Homebridge

## Fix #6: Check Device Connectivity

Test if your device can be reached with the command line tool:

```
node homebridge-switchbot-ble/bot-cmd.mjs scan
node homebridge-switchbot-ble/bot-cmd.mjs status xx:xx:xx:xx:xx:xx
```

## Fix #7: Update to Latest Version

Make sure you're running the latest version of the plugin:

```
npm update -g homebridge-switchbot-ble
```

## Debugging Commands

Here are some useful commands for debugging:

```bash
# Test turning on a device (replace xx:xx:xx:xx:xx:xx with your device MAC)
node homebridge-switchbot-ble/bot-cmd.mjs on xx:xx:xx:xx:xx:xx

# Test turning off a device
node homebridge-switchbot-ble/bot-cmd.mjs off xx:xx:xx:xx:xx:xx

# Check device status
node homebridge-switchbot-ble/bot-cmd.mjs status xx:xx:xx:xx:xx:xx
```

## Log Files

Check the log files for error messages:

1. Homebridge log: `%USERPROFILE%\.homebridge\homebridge.log`
2. Plugin log: `C:\Users\lksvs\AppData\Roaming\npm\node_modules\homebridge-switchbot-ble\logs\switchbot-api-YYYY-MM-DD.log`

## Technical Details: How the Fix Works

The updated plugin now uses the following techniques to fix the Child Bridge issues:

1. **State Tracking**: The plugin now maintains an internal state for each device.
2. **Direct Command Execution**: Commands are executed directly using the bot-cmd.mjs tool.
3. **Consistent Platform Name**: The platform name is now consistently "SwitchbotBLE".
4. **Enhanced Logging**: More detailed logs are generated to help with troubleshooting.
5. **Mode Standardization**: "switch" mode is now the recommended default instead of "press".

## Need More Help?

If you're still experiencing issues after trying all the steps above, please provide:

1. Your `config.json` file (remove any sensitive information)
2. The Homebridge logs when you try to control a device
3. The output of `node homebridge-switchbot-ble/bot-cmd.mjs scan`
4. Your operating system and Node.js version 