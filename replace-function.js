const fs = require('fs');
const file = 'lib/storage.js';

let content = fs.readFileSync(file, 'utf8');

// Find and replace the entire detectUSBDevices function
const newFunction = `  async detectUSBDevices() {
    const devices = [];
    const self = this;

    try {
      // Request explicit columns to ensure we get transport and mountpoint
      const { stdout } = await execAsync('lsblk -J -o NAME,TRAN,TYPE,MOUNTPOINT,SIZE,LABEL,RM,CHILDREN');
      const json = JSON.parse(stdout);
      const blockdevices = json.blockdevices || [];

      // Flatten the lsblk tree into a single array
      const all = [];
      (function flatten(arr) {
        for (const dev of arr) {
          all.push(dev);
          if (dev.children) flatten(dev.children);
        }
      })(blockdevices);

      // Find USB devices (tran=usb OR removable (rm=true) as fallback)
      for (const dev of all) {
        // Skip if not USB transport and not marked as removable
        if (dev.tran && dev.tran !== 'usb' && !dev.rm) continue;

        const name = dev.name;
        // Handle both mountpoint (string) and mountpoints (array)
        const mountPoint = dev.mountpoint || (dev.mountpoints && dev.mountpoints[0]);

        // For disks, if any child partition is mounted, include the disk with that mountpoint
        if (dev.type === 'disk' && dev.children) {
          const mountedChild = dev.children.find(c => c.mountpoint || (c.mountpoints && c.mountpoints[0]));
          if (mountedChild) {
            const childMount = mountedChild.mountpoint || (mountedChild.mountpoints && mountedChild.mountpoints[0]);
            devices.push({
              device: \`/dev/\${name}\`,
              mountPoint: childMount,
              label: dev.label || \`USB-\${name}\`,
              size: self.parseSize(dev.size),
              transport: dev.tran || 'usb',
            });
          }
        } else if (dev.type === 'part' && mountPoint) {
          // For partitions, only include if mounted
          devices.push({
            device: \`/dev/\${name}\`,
            mountPoint,
            label: dev.label || \`USB-\${name}\`,
            size: self.parseSize(dev.size),
            transport: dev.tran || 'usb',
          });
        }
      }
    } catch (error) {
      console.error('Error detecting USB devices:', error);
    }

    return devices;
  }`;

// Replace from "async detectUSBDevices() {" to the line before "async mountUSB"
content = content.replace(
  /  async detectUSBDevices\(\) \{[\s\S]*?(?=\n  async mountUSB\(|\n  async unmount\()/,
  newFunction
);

fs.writeFileSync(file, content);
console.log('Replacement complete');
