#!/bin/bash

# Bluetooth Troubleshooting Script for homebridge-switchbot-ble
# This script helps diagnose and fix common Bluetooth issues on Raspberry Pi

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "=================================================================="
echo "Bluetooth Troubleshooting for homebridge-switchbot-ble"
echo "=================================================================="

# Check if running as root
if [[ $EUID -eq 0 ]]; then
    echo -e "${YELLOW}Warning: Running as root. Some tests may not reflect normal user permissions.${NC}"
fi

echo
echo "1. Checking Bluetooth Service Status..."
if systemctl is-active bluetooth >/dev/null 2>&1; then
    echo -e "${GREEN}✓ Bluetooth service is active${NC}"
else
    echo -e "${RED}✗ Bluetooth service is not active${NC}"
    echo "  Fix: sudo systemctl enable bluetooth && sudo systemctl start bluetooth"
fi

echo
echo "2. Checking Bluetooth Hardware..."
if command -v hciconfig >/dev/null 2>&1; then
    echo -e "${GREEN}✓ hciconfig command available${NC}"
    
    # List Bluetooth adapters
    adapters=$(hciconfig 2>/dev/null | grep -c "hci[0-9]" || echo "0")
    if [ "$adapters" -gt 0 ]; then
        echo -e "${GREEN}✓ Found $adapters Bluetooth adapter(s)${NC}"
        
        # Check adapter status
        for adapter in $(hciconfig 2>/dev/null | grep "hci[0-9]" | cut -d: -f1); do
            if hciconfig "$adapter" 2>/dev/null | grep -q "UP RUNNING"; then
                echo -e "${GREEN}  ✓ $adapter is UP and RUNNING${NC}"
            else
                echo -e "${YELLOW}  ⚠ $adapter is not running${NC}"
                echo "    Fix: sudo hciconfig $adapter up"
            fi
        done
    else
        echo -e "${RED}✗ No Bluetooth adapters found${NC}"
        echo "  Check: Ensure Bluetooth hardware is connected and enabled"
    fi
else
    echo -e "${RED}✗ hciconfig command not found${NC}"
    echo "  Fix: sudo apt install bluez"
fi

echo
echo "3. Checking User Permissions..."
current_user=${USER:-$(whoami)}
groups_output=$(groups "$current_user" 2>/dev/null || echo "")

if echo "$groups_output" | grep -q "bluetooth"; then
    echo -e "${GREEN}✓ User '$current_user' is in bluetooth group${NC}"
else
    echo -e "${RED}✗ User '$current_user' is not in bluetooth group${NC}"
    echo "  Fix: sudo usermod -a -G bluetooth $current_user"
    echo "  Note: You'll need to log out and back in for this to take effect"
fi

echo
echo "4. Checking Node.js Capabilities..."
if command -v node >/dev/null 2>&1; then
    node_path=$(which node)
    echo -e "${GREEN}✓ Node.js found at: $node_path${NC}"
    
    # Check capabilities
    if command -v getcap >/dev/null 2>&1; then
        caps=$(getcap "$node_path" 2>/dev/null || echo "none")
        if echo "$caps" | grep -q "cap_net_raw"; then
            echo -e "${GREEN}✓ Node.js has Bluetooth capabilities${NC}"
        else
            echo -e "${RED}✗ Node.js missing Bluetooth capabilities${NC}"
            echo "  Fix: sudo setcap cap_net_raw+eip $node_path"
            echo "       sudo setcap cap_net_admin+eip $node_path"
        fi
    else
        echo -e "${YELLOW}⚠ Cannot check capabilities (getcap not available)${NC}"
    fi
else
    echo -e "${RED}✗ Node.js not found${NC}"
    echo "  Fix: Install Node.js v18 or later"
fi

echo
echo "5. Checking UDEV Rules..."
udev_rule="/etc/udev/rules.d/99-bluetooth.rules"
if [ -f "$udev_rule" ]; then
    echo -e "${GREEN}✓ Bluetooth UDEV rule exists${NC}"
    
    # Check rule content
    if grep -q 'KERNEL=="hci\[0-9\]\*", GROUP="bluetooth", MODE="0664"' "$udev_rule"; then
        echo -e "${GREEN}✓ UDEV rule is correct${NC}"
    else
        echo -e "${YELLOW}⚠ UDEV rule exists but content may be incorrect${NC}"
        echo "  Content should be: KERNEL==\"hci[0-9]*\", GROUP=\"bluetooth\", MODE=\"0664\""
    fi
else
    echo -e "${RED}✗ Bluetooth UDEV rule missing${NC}"
    echo "  Fix: echo 'KERNEL==\"hci[0-9]*\", GROUP=\"bluetooth\", MODE=\"0664\"' | sudo tee $udev_rule"
    echo "       sudo udevadm control --reload-rules && sudo udevadm trigger"
fi

echo
echo "6. Testing Bluetooth Scan..."
if command -v timeout >/dev/null 2>&1; then
    echo "Running 5-second Bluetooth scan test..."
    if timeout 5s hcitool lescan >/dev/null 2>&1; then
        echo -e "${GREEN}✓ Bluetooth LE scan works${NC}"
    else
        echo -e "${RED}✗ Bluetooth LE scan failed${NC}"
        echo "  This may indicate permission or hardware issues"
    fi
else
    echo -e "${YELLOW}⚠ Cannot test scan (timeout command not available)${NC}"
fi

echo
echo "7. Checking System Resources..."
# Memory check
total_mem=$(free -m | awk 'NR==2{print $2}')
free_mem=$(free -m | awk 'NR==2{print $7}')
echo "Memory: ${free_mem}MB free / ${total_mem}MB total"

if [ "$total_mem" -lt 512 ]; then
    echo -e "${RED}✗ Very low memory ($total_mem MB)${NC}"
    echo "  Consider using a device with more memory"
elif [ "$total_mem" -lt 1024 ]; then
    echo -e "${YELLOW}⚠ Low memory ($total_mem MB)${NC}"
    echo "  Monitor memory usage during operation"
else
    echo -e "${GREEN}✓ Sufficient memory${NC}"
fi

# Disk space check
if command -v df >/dev/null 2>&1; then
    available_mb=$(df / --output=avail --block-size=1M | tail -1 | tr -d ' ')
    echo "Disk space: ${available_mb}MB available"
    
    if [ "$available_mb" -lt 500 ]; then
        echo -e "${RED}✗ Very low disk space${NC}"
    elif [ "$available_mb" -lt 1000 ]; then
        echo -e "${YELLOW}⚠ Low disk space${NC}"
    else
        echo -e "${GREEN}✓ Sufficient disk space${NC}"
    fi
fi

echo
echo "8. Checking Package Dependencies..."
if command -v npm >/dev/null 2>&1; then
    echo -e "${GREEN}✓ npm is available${NC}"
    
    # Check if homebridge-switchbot-ble is installed
    if npm list -g homebridge-switchbot-ble >/dev/null 2>&1; then
        echo -e "${GREEN}✓ homebridge-switchbot-ble is installed globally${NC}"
    else
        echo -e "${YELLOW}⚠ homebridge-switchbot-ble not found globally${NC}"
        echo "  Install: npm install -g homebridge-switchbot-ble"
    fi
else
    echo -e "${RED}✗ npm not found${NC}"
fi

echo
echo "=================================================================="
echo "Troubleshooting Summary"
echo "=================================================================="

echo
echo -e "${BLUE}Common Solutions:${NC}"
echo "1. Restart Bluetooth service:"
echo "   sudo systemctl restart bluetooth"
echo
echo "2. Reset Node.js capabilities:"
echo "   sudo setcap -r \$(which node)"
echo "   sudo setcap cap_net_raw+eip \$(which node)"
echo "   sudo setcap cap_net_admin+eip \$(which node)"
echo
echo "3. Add user to bluetooth group:"
echo "   sudo usermod -a -G bluetooth \$USER"
echo "   # Then log out and back in"
echo
echo "4. Restart system (if hardware issues persist):"
echo "   sudo reboot"
echo
echo "5. Check plugin logs:"
echo "   tail -f ~/.homebridge/homebridge.log"

echo
echo -e "${BLUE}For more help:${NC}"
echo "- GitHub Issues: https://github.com/bruce30709/homebridge-switchbot-ble/issues"
echo "- Documentation: docs/raspberry-pi-setup.md"
echo "- Run system check: node scripts/system-check.js"

echo
echo "=================================================================="