# Raspberry Pi Setup Guide for homebridge-switchbot-ble

This guide provides detailed instructions for setting up homebridge-switchbot-ble on Raspberry Pi devices, including optimization for low-power ARM systems.

## System Requirements

### Supported Raspberry Pi Models
- Raspberry Pi 3 Model B/B+ (Recommended minimum)
- Raspberry Pi 4 Model B (Recommended)
- Raspberry Pi 5 (Latest, best performance)
- Raspberry Pi Zero 2 W (Limited performance, basic functionality only)

### Hardware Requirements
- Raspberry Pi with built-in Bluetooth (Pi 3+) or USB Bluetooth 4.0+ adapter
- MicroSD card (16GB+ recommended, Class 10)
- Stable power supply (Official Raspberry Pi power adapter recommended)
- Internet connection for initial setup

### Software Requirements
- Raspberry Pi OS (Bullseye or newer recommended)
- Node.js v18+ (will be installed automatically)
- Homebridge v1.3.5+

## Quick Setup (Automated)

For most users, use our automated setup script:

```bash
# Download and run the automated setup script
curl -fsSL https://raw.githubusercontent.com/bruce30709/homebridge-switchbot-ble/main/scripts/raspberry-pi-setup.sh | sudo bash

# Or download and review before running
wget https://raw.githubusercontent.com/bruce30709/homebridge-switchbot-ble/main/scripts/raspberry-pi-setup.sh
chmod +x raspberry-pi-setup.sh
sudo ./raspberry-pi-setup.sh
```

## Manual Setup

### 1. System Preparation

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install essential packages
sudo apt install -y curl git build-essential python3-dev libudev-dev

# Enable bluetooth service
sudo systemctl enable bluetooth
sudo systemctl start bluetooth
```

### 2. Node.js Installation

```bash
# Install Node.js (recommended version)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify installation
node --version
npm --version
```

### 3. Bluetooth Configuration

```bash
# Add user to bluetooth group
sudo usermod -a -G bluetooth $USER

# Configure Bluetooth permissions
sudo setcap cap_net_raw+eip $(eval readlink -f `which node`)
sudo setcap cap_net_admin+eip $(eval readlink -f `which node`)

# Create udev rule for Bluetooth access
echo 'KERNEL=="hci[0-9]*", GROUP="bluetooth", MODE="0664"' | sudo tee /etc/udev/rules.d/99-bluetooth.rules

# Reload udev rules
sudo udevadm control --reload-rules
sudo udevadm trigger
```

### 4. Performance Optimization

```bash
# Configure memory split (if using Pi without external graphics)
echo 'gpu_mem=16' | sudo tee -a /boot/config.txt

# Optimize Bluetooth settings
sudo tee -a /etc/bluetooth/main.conf > /dev/null <<EOF

# SwitchBot BLE optimizations
[General]
DiscoverableTimeout = 0
PairableTimeout = 0
AutoConnectTimeout = 60
FastConnectable = true

[Policy]
AutoEnable = true
EOF
```

## Troubleshooting

### Common Issues

#### 1. Bluetooth Permission Errors
```bash
# Check current user groups
groups $USER

# Add user to bluetooth group if missing
sudo usermod -a -G bluetooth $USER

# Re-login or restart for changes to take effect
```

#### 2. Node.js Capability Issues
```bash
# Reset Node.js capabilities
sudo setcap -r $(eval readlink -f `which node`)
sudo setcap cap_net_raw+eip $(eval readlink -f `which node`)
sudo setcap cap_net_admin+eip $(eval readlink -f `which node`)
```

#### 3. Memory Issues
```bash
# Check memory usage
free -h

# Check for memory leaks
ps aux | grep homebridge

# Restart homebridge service
sudo systemctl restart homebridge
```

For more detailed troubleshooting, see the main [README](../README.md#troubleshooting).