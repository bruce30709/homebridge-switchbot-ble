#!/bin/bash

# Raspberry Pi Setup Script for homebridge-switchbot-ble
# This script automates the installation and configuration process

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING:${NC} $1"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR:${NC} $1"
}

info() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] INFO:${NC} $1"
}

# Check if running on Raspberry Pi
check_raspberry_pi() {
    if ! grep -q "Raspberry Pi" /proc/cpuinfo 2>/dev/null; then
        warn "This script is optimized for Raspberry Pi. Continuing anyway..."
    else
        log "Raspberry Pi detected"
    fi
}

# Check if running as root
check_root() {
    if [[ $EUID -ne 0 ]]; then
        error "This script must be run as root. Please use 'sudo ./raspberry-pi-setup.sh'"
        exit 1
    fi
}

# Detect system architecture
detect_architecture() {
    ARCH=$(uname -m)
    case $ARCH in
        armv6l) NODE_ARCH="armv6l" ;;
        armv7l) NODE_ARCH="armv7l" ;;
        aarch64) NODE_ARCH="arm64" ;;
        x86_64) NODE_ARCH="x64" ;;
        *) 
            error "Unsupported architecture: $ARCH"
            exit 1
            ;;
    esac
    info "Detected architecture: $ARCH (Node.js: $NODE_ARCH)"
}

# Check system resources
check_system_resources() {
    # Check available memory
    TOTAL_MEM=$(free -m | awk 'NR==2{print $2}')
    if [ "$TOTAL_MEM" -lt 512 ]; then
        warn "Low memory detected ($TOTAL_MEM MB). Installation may be slow."
        warn "Consider increasing swap space if compilation fails."
    fi
    
    # Check available disk space
    AVAILABLE_SPACE=$(df / | awk 'NR==2 {print $4}')
    if [ "$AVAILABLE_SPACE" -lt 1048576 ]; then  # 1GB in KB
        warn "Low disk space detected. Ensure you have at least 1GB free space."
    fi
    
    info "System resources check completed"
}

# Update system packages
update_system() {
    log "Updating system packages..."
    apt update
    apt upgrade -y
    
    log "Installing essential packages..."
    apt install -y curl git build-essential python3-dev libudev-dev bluetooth bluez libbluetooth-dev
    
    # Install additional tools for Raspberry Pi
    apt install -y htop nano dphys-swapfile
}

# Install Node.js
install_nodejs() {
    log "Installing Node.js..."
    
    # Check if Node.js is already installed
    if command -v node >/dev/null 2>&1; then
        NODE_VERSION=$(node --version)
        MAJOR_VERSION=$(echo $NODE_VERSION | cut -d'.' -f1 | sed 's/v//')
        
        if [ "$MAJOR_VERSION" -ge 18 ]; then
            info "Node.js $NODE_VERSION is already installed and meets requirements"
            return 0
        else
            warn "Node.js $NODE_VERSION is installed but version 18+ is required. Updating..."
        fi
    fi
    
    # Install Node.js 20 (LTS)
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt install -y nodejs
    
    # Verify installation
    NODE_VERSION=$(node --version)
    NPM_VERSION=$(npm --version)
    log "Node.js $NODE_VERSION installed successfully"
    log "npm $NPM_VERSION installed successfully"
}

# Configure Bluetooth
configure_bluetooth() {
    log "Configuring Bluetooth..."
    
    # Enable and start Bluetooth service
    systemctl enable bluetooth
    systemctl start bluetooth
    
    # Add pi user to bluetooth group (if exists)
    if id "pi" &>/dev/null; then
        usermod -a -G bluetooth pi
        log "Added 'pi' user to bluetooth group"
    fi
    
    # Add current user to bluetooth group (if not root and not pi)
    if [ "$SUDO_USER" ] && [ "$SUDO_USER" != "pi" ]; then
        usermod -a -G bluetooth "$SUDO_USER"
        log "Added '$SUDO_USER' to bluetooth group"
    fi
    
    # Configure Node.js capabilities for Bluetooth access
    NODE_PATH=$(which node)
    setcap cap_net_raw+eip "$NODE_PATH"
    setcap cap_net_admin+eip "$NODE_PATH"
    log "Set Node.js Bluetooth capabilities"
    
    # Create udev rule for Bluetooth access
    cat > /etc/udev/rules.d/99-bluetooth.rules << 'EOF'
KERNEL=="hci[0-9]*", GROUP="bluetooth", MODE="0664"
EOF
    
    # Reload udev rules
    udevadm control --reload-rules
    udevadm trigger
    
    log "Bluetooth configuration completed"
}

# Optimize system for Raspberry Pi
optimize_raspberry_pi() {
    log "Applying Raspberry Pi optimizations..."
    
    # Configure memory split for headless operation
    if ! grep -q "gpu_mem=" /boot/config.txt; then
        echo "gpu_mem=16" >> /boot/config.txt
        log "Configured GPU memory split"
    fi
    
    # Enable Bluetooth kernel module
    if ! grep -q "dtparam=krnbt=on" /boot/config.txt; then
        echo "dtparam=krnbt=on" >> /boot/config.txt
        log "Enabled Bluetooth kernel module"
    fi
    
    # Optimize Bluetooth settings
    cat >> /etc/bluetooth/main.conf << 'EOF'

# SwitchBot BLE optimizations for Raspberry Pi
[General]
DiscoverableTimeout = 0
PairableTimeout = 0
AutoConnectTimeout = 60
FastConnectable = true

[Policy]
AutoEnable = true
EOF
    
    log "Applied Bluetooth optimizations"
    
    # Configure swap for compilation (if needed)
    if [ "$TOTAL_MEM" -lt 1024 ]; then
        log "Configuring swap for low-memory system..."
        dphys-swapfile swapoff || true
        sed -i 's/CONF_SWAPSIZE=.*/CONF_SWAPSIZE=1024/' /etc/dphys-swapfile
        dphys-swapfile setup
        dphys-swapfile swapon
        log "Increased swap to 1024MB"
    fi
}

# Install Homebridge and plugin
install_homebridge() {
    log "Installing Homebridge and homebridge-switchbot-ble..."
    
    # Install Homebridge globally
    npm install -g homebridge homebridge-config-ui-x
    
    # Install the plugin
    npm install -g homebridge-switchbot-ble
    
    log "Homebridge and plugin installed successfully"
}

# Create homebridge user and service
setup_homebridge_service() {
    log "Setting up Homebridge service..."
    
    # Create homebridge user if it doesn't exist
    if ! id "homebridge" &>/dev/null; then
        useradd --system homebridge
        log "Created homebridge user"
    fi
    
    # Create homebridge directory
    mkdir -p /var/lib/homebridge
    chown homebridge:homebridge /var/lib/homebridge
    
    # Add homebridge user to bluetooth group
    usermod -a -G bluetooth homebridge
    
    # Create systemd service
    cat > /etc/systemd/system/homebridge.service << 'EOF'
[Unit]
Description=Homebridge
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=homebridge
ExecStart=/usr/bin/homebridge -I -U /var/lib/homebridge
Restart=on-failure
RestartSec=10
KillMode=process
EnvironmentFile=-/etc/default/homebridge

[Install]
WantedBy=multi-user.target
EOF
    
    # Reload systemd and enable service
    systemctl daemon-reload
    systemctl enable homebridge
    
    log "Homebridge service created and enabled"
}

# Create basic configuration
create_basic_config() {
    log "Creating basic Homebridge configuration..."
    
    # Generate random MAC addresses for bridge
    BRIDGE_MAC=$(printf "CC:22:3D:%02X:%02X:%02X" $((RANDOM%256)) $((RANDOM%256)) $((RANDOM%256)))
    CHILD_MAC=$(printf "0E:22:5D:%02X:%02X:%02X" $((RANDOM%256)) $((RANDOM%256)) $((RANDOM%256)))
    
    cat > /var/lib/homebridge/config.json << EOF
{
    "bridge": {
        "name": "Homebridge",
        "username": "$BRIDGE_MAC",
        "port": 51826,
        "pin": "031-45-154"
    },
    "accessories": [],
    "platforms": [
        {
            "name": "Config",
            "port": 8581,
            "platform": "config"
        },
        {
            "platform": "SwitchbotBLE",
            "name": "SwitchBot",
            "devices": [],
            "_bridge": {
                "username": "$CHILD_MAC",
                "port": 41087
            }
        }
    ]
}
EOF
    
    chown homebridge:homebridge /var/lib/homebridge/config.json
    log "Basic configuration created"
}

# Create utility scripts
create_utility_scripts() {
    log "Creating utility scripts..."
    
    # System information script
    cat > /usr/local/bin/homebridge-sysinfo.sh << 'EOF'
#!/bin/bash
echo "=== System Information ==="
uname -a
cat /etc/os-release
echo
echo "=== Hardware Information ==="
cat /proc/cpuinfo | grep -E "model name|Hardware|Revision"
free -h
echo
echo "=== Bluetooth Information ==="
hciconfig -a
systemctl status bluetooth --no-pager
echo
echo "=== Node.js Information ==="
node --version
npm --version
npm list -g homebridge homebridge-switchbot-ble
echo
echo "=== Service Status ==="
systemctl status homebridge --no-pager
EOF
    
    chmod +x /usr/local/bin/homebridge-sysinfo.sh
    
    # Backup script
    cat > /usr/local/bin/backup-homebridge.sh << 'EOF'
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p /var/lib/homebridge/backups
cp /var/lib/homebridge/config.json /var/lib/homebridge/backups/config_$DATE.json
find /var/lib/homebridge/backups -name "config_*.json" -mtime +7 -delete
echo "Homebridge configuration backed up"
EOF
    
    chmod +x /usr/local/bin/backup-homebridge.sh
    
    log "Utility scripts created"
}

# Display final instructions
display_final_instructions() {
    echo
    echo "=================================================================="
    echo -e "${GREEN}Installation completed successfully!${NC}"
    echo "=================================================================="
    echo
    echo -e "${BLUE}Next steps:${NC}"
    echo "1. Reboot your Raspberry Pi to apply all changes:"
    echo "   sudo reboot"
    echo
    echo "2. After reboot, start Homebridge:"
    echo "   sudo systemctl start homebridge"
    echo
    echo "3. Access Homebridge Config UI at:"
    echo "   http://$(hostname -I | awk '{print $1}'):8581"
    echo
    echo "4. Add your SwitchBot devices to the configuration"
    echo
    echo -e "${BLUE}Useful commands:${NC}"
    echo "- Check service status: sudo systemctl status homebridge"
    echo "- View logs: sudo journalctl -u homebridge -f"
    echo "- System info: sudo homebridge-sysinfo.sh"
    echo "- Backup config: sudo backup-homebridge.sh"
    echo
    echo -e "${BLUE}Documentation:${NC}"
    echo "- Setup guide: docs/raspberry-pi-setup.md"
    echo "- Main README: README.md"
    echo
    echo -e "${YELLOW}Note: You may need to reboot for all Bluetooth changes to take effect.${NC}"
    echo "=================================================================="
}

# Main installation process
main() {
    echo "=================================================================="
    echo "Raspberry Pi Setup for homebridge-switchbot-ble"
    echo "=================================================================="
    
    check_root
    check_raspberry_pi
    detect_architecture
    check_system_resources
    
    log "Starting installation process..."
    
    update_system
    install_nodejs
    configure_bluetooth
    optimize_raspberry_pi
    install_homebridge
    setup_homebridge_service
    create_basic_config
    create_utility_scripts
    
    display_final_instructions
}

# Run main function
main "$@"