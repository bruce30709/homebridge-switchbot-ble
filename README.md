# Homebridge SwitchBot BLE Plugin

<p align="center">
  <img src="https://raw.githubusercontent.com/homebridge/branding/master/logos/homebridge-color-round-stylized.png" height="150">
  <img src="https://user-images.githubusercontent.com/10909099/149812458-bbecef3b-8d39-449a-9552-7c6d3f9d7b9a.jpg" height="150">
</p>

<span align="center">

# homebridge-switchbot-ble

[![npm](https://img.shields.io/npm/v/homebridge-switchbot-ble.svg)](https://www.npmjs.com/package/homebridge-switchbot-ble)
[![npm](https://img.shields.io/npm/dt/homebridge-switchbot-ble.svg)](https://www.npmjs.com/package/homebridge-switchbot-ble)
[![verified-by-homebridge](https://badgen.net/badge/homebridge/verified/purple)](https://github.com/homebridge/homebridge/wiki/Verified-Plugins)

</span>

Homebridge plugin for SwitchBot devices using direct BLE (Bluetooth Low Energy) connections. Control your SwitchBot devices directly through HomeKit without requiring the SwitchBot Hub or cloud connection.

## Features
- You can also integrate this repo with the MCP server. See the repository: [SwitchBot-MCP-Integration](https://github.com/bruce30709/SwitchBot-MCP-Integration)
- Direct BLE Control: No SwitchBot Hub or internet connection required
- Fast Response: Direct Bluetooth connection means faster response times
- Multiple Modes: Supports both switch (on/off) and press (momentary) modes
- Child Bridge Support: Improved stability with isolated process
- Auto-off Function: Automatically turns off after configurable delay
- Detailed Logging: Debug mode for troubleshooting
- Multiple Device Support: Control multiple SwitchBot devices simultaneously
![image](https://github.com/user-attachments/assets/913cfd87-ab81-4ff2-9467-eff152fd4c43)

## Requirements

- Raspberry Pi, Mac, or Linux system with Bluetooth support
- Node.js v18 or later
- Homebridge v1.3.5 or later
- Bluetooth 4.0+ adapter with BLE support

## Installation

### Option 1: Install through Homebridge UI(Still under applying)

1. Open your Homebridge UI
2. Go to the "Plugins" tab
3. Search for "homebridge-switchbot-ble"
4. Click "Install"

### Option 2: Install via npm(Test it work)

```bash
npm install -g homebridge-switchbot-ble
```
### Option 3: Install manuallly(Test it work)

1. Copy the downloaded homebridge-switchbot-ble folder to the same path as the homebridge-XXX.

2. enter the homebridge-switchbot-ble folder and do
```bash
npm install
```

## Configuration

You can use this plugin in two modes:

### 1. Platform Mode (Recommended for Child Bridge)

Add this to the `platforms` section of your Homebridge `config.json`:

```json
"platforms": [
  {
    "platform": "SwitchbotBLE",
    "name": "SwitchBot",
    "devices": [
      {
        "name": "Living Room Light",
        "deviceId": "xx:xx:xx:xx:xx:xx",
        "mode": "switch",
        "debug": true,
        "autoOff": false
      },
      {
        "name": "Bedroom Light",
        "deviceId": "yy:yy:yy:yy:yy:yy",
        "mode": "switch",
        "autoOff": true,
        "autoOffDelay": 2
      }
    ],
    "_bridge": {
      "username": "0E:22:5D:E0:FE:F1",
      "port": 41087
    }
  }
]
```

### 2. Accessory Mode (Legacy)

Add this to the `accessories` section of your Homebridge `config.json`:

```json
"accessories": [
  {
    "accessory": "SwitchbotBLE",
    "name": "Living Room Light",
    "deviceId": "xx:xx:xx:xx:xx:xx",
    "mode": "switch",
    "debug": true
  }
]
```

## Configuration Options

| Parameter      | Type    | Default             | Description                                              |
|----------------|---------|---------------------|----------------------------------------------------------|
| `name`         | String  | "SwitchBot"         | Name of the accessory in HomeKit                         |
| `deviceId`     | String  | -                   | MAC address of the SwitchBot device (required)           |
| `mode`         | String  | "switch"            | "switch" for ON/OFF control, "press" for momentary press |
| `autoOff`      | Boolean | false               | Automatically turn off after delay                       |
| `autoOffDelay` | Number  | 1                   | Delay in seconds before auto-off                         |
| `debug`        | Boolean | false               | Enable detailed logging                                  |
| `configPath`   | String  | ~/.switchbot.config | Path to store device configuration                       |

## Finding Your SwitchBot's MAC Address

You can find your SwitchBot's MAC address using the built-in scan function:

```bash
cd ~/.homebridge
npx homebridge-switchbot-ble scan
```

Or run the following command:

```bash
node node_modules/homebridge-switchbot-ble/bot-cmd.mjs scan
```

This will scan for nearby SwitchBot devices and display their MAC addresses.

## Operational Modes

### Switch Mode (Recommended)

In `switch` mode, the device maintains its ON/OFF state like a regular switch. This works best for:
- Light switches that should stay ON or OFF
- Devices that need to be in a specific state

### Press Mode

In `press` mode, the device performs a momentary press regardless of the state change. This is for:
- Doorbell buttons
- Momentary switches
- Devices that should only receive a trigger, not maintain state

## Child Bridge Support

For best performance, use the platform version with Child Bridge. This provides:

1. Better Stability: Isolated process for Bluetooth operations
2. Reduced Interference: Separates BLE operations from other plugins
3. Independent Restart: Can restart without affecting other accessories

To enable Child Bridge, use the platform configuration with the `_bridge` parameter.

See the [Child Bridge Guide](FIX-CHILD-BRIDGE-GUIDE.md) for detailed setup instructions.

## Troubleshooting

### Devices Not Responding

1. Make sure your device is within Bluetooth range (usually 10-15 meters)
2. Verify the device ID (MAC address) is correct
3. Check that Bluetooth is enabled on your Homebridge server
4. Try restarting Homebridge using the included script

### Debug Mode

Enable debug mode by setting `"debug": true` in your device configuration. This will:
- Log all BLE commands and responses
- Create detailed logs for troubleshooting
- Show connection and command execution details

### Common Issues

| Problem                  | Solution                                                  |
|--------------------------|-----------------------------------------------------------|
| Device not found         | Verify MAC address and ensure device is in range          |
| Commands timeout         | Move Homebridge server closer to the device               |
| Child Bridge not working | See the [Child Bridge Guide](FIX-CHILD-BRIDGE-GUIDE.md)   |
| Slow response            | Check for Bluetooth interference or try Child Bridge mode |

### Clearing Cache

Run the included `restart-homebridge.bat` script (Windows) or restart Homebridge with the `-U` flag to clear the accessory cache:

```bash
homebridge -U /your/homebridge/path -I
```

## Logs and Debugging

This plugin creates detailed logs for troubleshooting in the `logs` directory. All log timestamps are now recorded in your system's local time (using new Date().toLocaleString()). When reporting an issue, please include these logs to help diagnose the problem.

## Contributing

Contributions are welcome! Feel free to open issues or pull requests.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Additional Resources

- [Homebridge Website](https://homebridge.io/)
- [SwitchBot Developer Page](https://github.com/OpenWonderLabs/SwitchBotAPI)
- [Node-SwitchBot Library](https://github.com/futomi/node-switchbot) 
