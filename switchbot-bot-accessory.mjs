async turnOn() {
    this.log.info(`Turn ON command received for ${this.name}`);

    // Check device mode before attempting to turn on
    const status = await getBotStatus(this.deviceId);
    if (status.mode === 'Press') {
        this.log.warn(`Device ${this.name} is in Press mode, cannot use ON command properly. Please set it to Switch mode using the SwitchBot app.`);
        return;
    }

    // Send command
    await this.runCommand('turnOn');

    // Update status after command execution
    this.service.updateCharacteristic(this.platform.Characteristic.On, true);
}

async turnOff() {
    this.log.info(`Turn OFF command received for ${this.name}`);

    // Check device mode before attempting to turn off
    const status = await getBotStatus(this.deviceId);
    if (status.mode === 'Press') {
        this.log.warn(`Device ${this.name} is in Press mode, cannot use OFF command properly. Please set it to Switch mode using the SwitchBot app.`);
        return;
    }

    // Send command
    await this.runCommand('turnOff');

    // Update status after command execution
    this.service.updateCharacteristic(this.platform.Characteristic.On, false);
} 