# Quick Reference Guide - Raspberry Pi Improvements

## New npm Scripts

| Command | Description |
|---------|-------------|
| `npm run system-check` | Check system compatibility and requirements |
| `npm run performance-test` | Analyze system performance and get optimization recommendations |
| `npm run bluetooth-troubleshoot` | Diagnose Bluetooth connectivity issues (cross-platform) |
| `npm run bluetooth-troubleshoot-unix` | Diagnose Bluetooth issues (Unix/Linux only) |
| `npm run health-check` | Complete system health check (compatibility only) |
| `npm run health-check-full` | Complete system health check (compatibility + dependencies) |
| `npm run rpi-setup` | Run automated Raspberry Pi setup (requires sudo) |

## Quick Setup Commands

### For Raspberry Pi (Automated)
```bash
curl -fsSL https://raw.githubusercontent.com/bruce30709/homebridge-switchbot-ble/main/scripts/raspberry-pi-setup.sh | sudo bash
```

### System Check Before Installation
```bash
curl -fsSL https://raw.githubusercontent.com/bruce30709/homebridge-switchbot-ble/main/scripts/system-check.js | node
```

## Troubleshooting Commands

### Check System Compatibility
```bash
npm run system-check
```

### Diagnose Bluetooth Issues
```bash
npm run bluetooth-troubleshoot
```

### Performance Analysis
```bash
npm run performance-test
```

## Key Files Added

| File | Purpose |
|------|---------|
| `docs/raspberry-pi-setup.md` | Comprehensive Raspberry Pi setup guide |
| `scripts/raspberry-pi-setup.sh` | Automated installation script (Linux/Raspberry Pi) |
| `scripts/system-check.js` | Cross-platform system compatibility checker |
| `scripts/bluetooth-troubleshoot.js` | Cross-platform Bluetooth diagnostic tool |
| `scripts/bluetooth-troubleshoot.sh` | Unix/Linux Bluetooth diagnostic tool |
| `scripts/performance-test.js` | Cross-platform performance analysis and optimization tool |
| `scripts/homebridge-switchbot.service` | Systemd service template |

## Raspberry Pi Optimizations Applied

### Automatic Optimizations
- Longer timeouts for ARM devices (5s connect, 3s command)
- Increased retry attempts (3x with 2s delay)
- Extended status check intervals (180s default for Pi)
- Memory usage monitoring and warnings

### Configuration Examples
```json
{
  "platform": "SwitchbotBLE",
  "devices": [{
    "statusCheckInterval": 180,
    "connectTimeout": 5000,
    "commandTimeout": 3000,
    "retryAttempts": 3
  }],
  "_bridge": {
    "username": "0E:22:5D:E0:FE:F1",
    "port": 41087
  }
}
```

## Support Matrix

| Platform | Support Level | Recommended Settings |
|----------|---------------|---------------------|
| **Raspberry Pi** |  |  |
| Pi 5 | ✅ Excellent | Default settings |
| Pi 4 | ✅ Excellent | Default settings |
| Pi 3B+ | ✅ Good | Extended timeouts |
| Pi 3B | ✅ Good | Extended timeouts |
| Pi Zero 2W | ⚠️ Limited | Extended timeouts, reduced concurrent operations |
| **Windows** |  |  |
| Windows 11 | ✅ Good | Default settings, ensure Bluetooth LE support |
| Windows 10 | ✅ Good | Default settings, may need driver updates |
| **macOS** |  |  |
| macOS 12+ | ✅ Good | Default settings |
| macOS 10.12-11 | ✅ Limited | May need Xcode CLI tools |
| **Linux** |  |  |
| Ubuntu 20.04+ | ✅ Excellent | Install bluez package |
| Debian 10+ | ✅ Excellent | Install bluez package |
| Other distros | ⚠️ Limited | Ensure systemd and bluez support |

## Performance Features

### System Detection
- Automatic Raspberry Pi model identification
- Memory and CPU performance assessment
- Bluetooth hardware validation
- Platform-specific optimizations

### Monitoring Tools
- Real-time performance metrics
- Memory usage tracking
- Disk I/O testing
- Bluetooth connectivity validation

## Security Improvements

- Updated node-switchbot dependency (3.5.0 → 3.6.0)
- Fixed 2 of 7 security vulnerabilities
- Enhanced permission handling for Bluetooth
- Improved error handling and logging