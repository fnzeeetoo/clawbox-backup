import { exec } from 'child_process';
import { promisify } from 'util';
import { promises as fs } from 'fs';
import path from 'path';

const execAsync = promisify(exec);

export class StorageManager {
  constructor() {
    this.mountedDrives = new Map();
  }

  async detectUSBDevices() {
    const devices = [];

    const { stdout } = await execAsync('lsblk -J -o NAME,LABEL,SIZE,TYPE,MOUNTPOINT');
    const data = JSON.parse(stdout);

    for (const device of data.blockdevices) {
      if (device.type === 'disk' || device.type === 'part') {
        const devName = `/dev/${device.name}`;
        const mountPoint = device.mountpoint || null;
        const label = device.label || `USB-${device.name}`;

        if (device.name.startsWith('sd') || device.name.startsWith('nvme')) {
          devices.push({
            device: devName,
            mountPoint,
            label,
            size: this.parseSize(device.size),
          });
        }
      }
    }

    return devices;
  }

  async mountUSB(device, options = {}) {
    const mountDir = `/mnt/${options.label || path.basename(device)}`;
    await fs.mkdir(mountDir, { recursive: true });

    let cmd = `mount "${device}" "${mountDir}"`;
    if (options.fsType) {
      cmd = `mount -t ${options.fsType} "${device}" "${mountDir}"`;
    }

    try {
      await execAsync(cmd);
      this.mountedDrives.set(device, mountDir);
      console.log(`Mounted ${device} at ${mountDir}`);
      return mountDir;
    } catch (error) {
      throw new Error(`Failed to mount ${device}: ${error.message}`);
    }
  }

  async unmount(deviceOrMountPoint) {
    let target = deviceOrMountPoint;
    if (!deviceOrMountPoint.startsWith('/')) {
      target = `/dev/${deviceOrMountPoint}`;
    }

    if (this.mountedDrives.has(target)) {
      target = this.mountedDrives.get(target);
    }

    try {
      await execAsync(`umount "${target}"`);
      this.mountedDrives.forEach((mp, dev) => {
        if (mp === target) {
          this.mountedDrives.delete(dev);
        }
      });
      console.log(`Unmounted ${target}`);
    } catch (error) {
      throw new Error(`Failed to unmount ${target}: ${error.message}`);
    }
  }

  async testDestination(destination) {
    try {
      let checkPath;

      switch (destination.type) {
        case 'usb':
          checkPath = destination.mountPoint || '/mnt/backup';
          break;
        case 'nas':
          checkPath = destination.mountPoint || '/mnt/nas';
          break;
        case 'local':
          checkPath = '/var/backups';
          break;
        case 'dropbox':
          return await this.testDropbox(destination);
        default:
          checkPath = '/';
      }

      await fs.access(checkPath, fs.constants.W_OK);
      const { free } = await this.getFreeSpace(checkPath);

      return { connected: true, freeSpace: free, message: 'OK' };
    } catch (error) {
      return { connected: false, freeSpace: 0, message: error.message };
    }
  }

  async getFreeSpace(dirPath) {
    const cmd = `df -B1 "${dirPath}" | tail -1 | awk '{print $2, $4, $3}'`;
    const { stdout } = await execAsync(cmd);
    const [total, free, used] = stdout.trim().split(/\s+/).map(Number);

    return { total, free, used: isNaN(used) ? 0 : used };
  }

  async testDropbox(destination) {
    if (!destination.accessToken) {
      return { connected: false, freeSpace: 0, message: 'Missing access token' };
    }

    try {
      const response = await fetch('https://api.dropboxapi.com/2/users/get_current_account', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${destination.accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        return { connected: false, freeSpace: 0, message: `HTTP ${response.status}: ${response.statusText}` };
      }

      const account = await response.json();
      return { connected: true, freeSpace: 0, message: `Connected to Dropbox as ${account.email}` };
    } catch (error) {
      return { connected: false, freeSpace: 0, message: error.message };
    }
  }

  async mountNAS(destination) {
    const server = destination.bucket;
    const share = destination.path || 'backup';

    if (!destination.mountPoint) {
      destination.mountPoint = `/mnt/nas-${server.replace(/[^a-zA-Z0-9]/g, '-')}`;
    }

    await fs.mkdir(destination.mountPoint, { recursive: true });

    try {
      await execAsync(`mount -t nfs ${server}:${share} "${destination.mountPoint}"`);
      return destination.mountPoint;
    } catch {
      try {
        const opts = `credentials=/etc/clawbox-backup/nas-credentials-${server}.conf,iocharset=utf8`;
        await execAsync(`mount -t cifs //${server}/${share} "${destination.mountPoint}" -o ${opts}`);
        return destination.mountPoint;
      } catch (smbError) {
        throw new Error(`Failed to mount NAS (NFS/SMB): ${smbError.message}`);
      }
    }
  }

  async uploadToDropbox(destination, localPath, remotePath) {
    if (!destination.accessToken) {
      throw new Error('No Dropbox access token configured');
    }

    const fileContent = await fs.readFile(localPath);
    const response = await fetch('https://content.dropboxapi.com/2/files/upload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${destination.accessToken}`,
        'Content-Type': 'application/octet-stream',
        'Dropbox-API-Arg': JSON.stringify({
          path: `/${destination.folder || 'backups'}${remotePath}`,
          mode: 'add',
          autorename: false,
          mute: false,
        }),
      },
      body: fileContent,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Dropbox upload failed: ${response.status} ${error}`);
    }
  }

  parseSize(sizeStr) {
    const match = sizeStr.match(/^(\d+(?:\.\d+)?)([KMGT])?$/);
    if (!match) return 0;

    const value = parseFloat(match[1]);
    const unit = (match[2] || 'B').toUpperCase();

    const multipliers = {
      B: 1,
      K: 1024,
      M: 1024 ** 2,
      G: 1024 ** 3,
      T: 1024 ** 4,
    };

    return Math.floor(value * (multipliers[unit] || 1));
  }

  async autoDetectDestinations() {
    const detected = [];
    const commonMounts = ['/mnt/usb', '/mnt/backup', '/mnt/nas', '/media/usb'];
    for (const mount of commonMounts) {
      try {
        await fs.access(mount);
        const stat = await fs.stat(mount);
        if (stat.isDirectory()) {
          detected.push({
            type: 'usb',
            mountPoint: mount,
            name: `Auto-detected ${path.basename(mount)}`,
            path: 'clawbox-backups',
            retention: { policy: 'keep_last', days: 30 },
          });
        }
      } catch {
        // Not present
      }
    }
    return detected;
  }
}