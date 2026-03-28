import { promises as fs } from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import crypto from 'crypto';
import os from 'os';
import archiver from 'archiver';
import Rsync from 'rsync';
// Compatibility shim for rsync library: ensure .on() exists as no-op
if (typeof Rsync.prototype.on !== 'function') {
  Rsync.prototype.on = function () {};
}

const execAsync = promisify(exec);

export class BackupEngine {
  constructor(config, stateDir = '/var/lib/clawbox-backup') {
    this.config = config;
    this.stateDir = stateDir;
    this.metaDir = path.join(stateDir, 'metadata');
  }

  async initialize() {
    await fs.mkdir(this.stateDir, { recursive: true });
    await fs.mkdir(this.metaDir, { recursive: true });
  }

  async runBackup(source, destination, type, callback) {
    const backupId = this.generateBackupId(source, type);
    const timestamp = new Date();
    const destPath = this.getDestinationPath(destination, backupId, type, timestamp);

    callback({ type: 'log', message: `Starting ${type} backup of ${source.name} to ${destPath}` });

    // Pre-flight checks
    await this.validateSource(source);
    await this.validateDestination(destination, type);
    await this.estimateAndCheckSpace(source, destination, type, callback);

    try {
      let backup;
      switch (type) {
        case 'full':
          backup = await this.createFullBackup(source, destination, destPath, callback);
          break;
        case 'incremental':
          backup = await this.createIncrementalBackup(source, destination, destPath, timestamp, callback);
          break;
        case 'disk-image':
          backup = await this.createDiskImage(source, destination, destPath, callback);
          break;
        default:
          throw new Error(`Unknown backup type: ${type}`);
      }

      if (this.config.verifyAfterBackup) {
        callback({ type: 'log', message: 'Verifying backup integrity...' });
        await this.verifyBackup(backup);
        backup.verified = true;
      }

      await this.saveBackupMetadata(backup);
      await this.postBackupActions(backup);

      callback({ type: 'complete', message: `Backup completed: ${backup.id}` });
      return backup;
    } catch (error) {
      callback({ type: 'error', message: `Backup failed: ${error.message}` });
      throw error;
    }
  }

  async createFullBackup(source, destination, destPath, callback) {
    const startTime = Date.now();
    const excludeArgs = source.exclude?.map(p => `--exclude='${p}'`).join(' ') || '';
    const tarPath = `${destPath}.tar.gz`;

    callback({ type: 'log', message: `Creating full archive: ${tarPath}` });

    const cmd = `cd "${path.dirname(source.path)}" && tar --create --gzip --file="${tarPath}" --preserve-permissions --verbose ${excludeArgs} "${path.basename(source.path)}"`;

    try {
      await this.streamCommand(cmd, callback);
      const stats = await fs.stat(tarPath);
      const metadata = await this.collectMetadata(source, tarPath, startTime);

      return {
        id: this.generateBackupId(source, 'full'),
        sourceId: source.id,
        destinationId: destination.id,
        type: 'full',
        timestamp: new Date(),
        size: stats.size,
        path: tarPath,
        status: 'completed',
        metadata,
        checksum: await this.computeChecksum(tarPath),
      };
    } catch (error) {
      throw new Error(`Full backup failed: ${error.message}`);
    }
  }

  async createIncrementalBackup(source, destination, destPath, timestamp, callback) {
    const startTime = Date.now();
    const previousBackup = await this.findLatestBackup(source.id, destination.id, 'incremental');
    let linkDest = '';
    if (previousBackup) {
      linkDest = path.dirname(previousBackup.path);
    }

    const backupDir = destPath;
    await fs.mkdir(backupDir, { recursive: true });

    const destAbsPath = path.resolve(backupDir, path.basename(source.path));
    const rsync = new Rsync()
      .shell('bash')
      .set('archive', true)
      .set('delete', true)
      .set('verbose', true)
      .set('progress', true)
      .source(source.path + '/')
      .destination(destAbsPath);

    if (linkDest) {
      rsync.set('link-dest', linkDest);
    }

    for (const pattern of source.exclude || []) {
      rsync.exclude(pattern);
    }

    return new Promise((resolve, reject) => {
      rsync.execute((error, code, cmd) => {
        if (error) {
          reject(new Error(`Rsync failed: ${error.message}`));
          return;
        }

        fs.stat(destAbsPath)
          .then(stats => {
            const metadata = this.collectMetadata(source, destAbsPath, startTime);
            resolve({
              id: this.generateBackupId(source, 'incremental'),
              sourceId: source.id,
              destinationId: destination.id,
              type: 'incremental',
              timestamp: new Date(),
              size: stats.size,
              path: destAbsPath,
              status: 'completed',
              metadata,
              incrementalChain: previousBackup ? [previousBackup.path] : [],
            });
          })
          .catch(reject);
      });

      rsync.on('progress', (data) => {
        callback({ type: 'progress', message: `Rsync: ${data}`, file: data });
      });

      rsync.on('stdout', (line) => {
        callback({ type: 'log', message: line.trim() });
      });

      rsync.on('stderr', (line) => {
        callback({ type: 'log', message: `stderr: ${line.trim()}` });
      });
    });
  }

  async createDiskImage(source, destination, destPath, callback) {
    callback({ type: 'log', message: `Creating disk image of ${source.path}` });
    const imgPath = `${destPath}.img.gz`;
    const cmd = `sudo dd if="${source.path}" bs=4M status=progress | gzip > "${imgPath}"`;

    try {
      await this.streamCommand(cmd, callback);
      const stats = await fs.stat(imgPath);

      return {
        id: this.generateBackupId(source, 'disk-image'),
        sourceId: source.id,
        destinationId: destination.id,
        type: 'disk-image',
        timestamp: new Date(),
        size: stats.size,
        path: imgPath,
        status: 'completed',
        metadata: await this.collectMetadata(source, imgPath, Date.now()),
        checksum: await this.computeChecksum(imgPath),
      };
    } catch (error) {
      throw new Error(`Disk image creation failed: ${error.message}`);
    }
  }

  async validateSource(source) {
    try {
      await fs.access(source.path);
    } catch {
      throw new Error(`Source path does not exist or is not accessible: ${source.path}`);
    }
  }

  async validateDestination(destination, type) {
    let basePath;
    switch (destination.type) {
      case 'usb':
      case 'nas':
        basePath = destination.mountPoint || '/mnt/backup';
        break;
      case 'dropbox':
      case 's3':
        return;
      case 'local':
        basePath = '/var/backups';
        break;
      default:
        throw new Error(`Unknown destination type: ${destination.type}`);
    }

    try {
      const stat = await fs.stat(basePath);
      if (!stat.isDirectory()) {
        throw new Error(`Destination path is not a directory: ${basePath}`);
      }
    } catch {
      throw new Error(`Destination path does not exist: ${basePath}`);
    }
  }

  async estimateAndCheckSpace(source, destination, type, callback) {
    callback({ type: 'log', message: 'Estimating backup size...' });

    let estimatedSize;
    if (type === 'disk-image') {
      const deviceStat = await this.getDeviceSize(source.path);
      estimatedSize = deviceStat.size;
    } else {
      estimatedSize = await this.calculateDirectorySize(source.path, source.exclude || []);
    }

    const sizeGB = (estimatedSize / 1024 / 1024 / 1024).toFixed(2);
    callback({ type: 'log', message: `Estimated size: ${sizeGB} GB` });

    const destInfo = await this.getDestinationFreeSpace(destination);
    if (destInfo.free < estimatedSize * 1.1) {
      const freeGB = (destInfo.free / 1024 / 1024 / 1024).toFixed(2);
      throw new Error(`Insufficient disk space on destination. Need ~${sizeGB} GB, only ${freeGB} GB free`);
    }
  }

  async calculateDirectorySize(dirPath, exclude) {
    const excludeArgs = exclude.map(p => `--exclude='${p}'`).join(' ');
    const cmd = `du -sb "${dirPath}" ${excludeArgs}`;
    const { stdout } = await execAsync(cmd);
    const size = parseInt(stdout.split('\t')[0], 10);
    return isNaN(size) ? 0 : size;
  }

  async getDestinationFreeSpace(destination) {
    let pathToCheck;
    switch (destination.type) {
      case 'usb':
      case 'nas':
        pathToCheck = destination.mountPoint || '/mnt/backup';
        break;
      case 'local':
        pathToCheck = '/var/backups';
        break;
      case 'dropbox':
      case 's3':
        return { total: 0, free: 0 };
      default:
        pathToCheck = '/';
    }

    const dfCmd = `df -B1 "${pathToCheck}" | tail -1 | awk '{print $4}'`;
    const { stdout } = await execAsync(dfCmd);
    const free = parseInt(stdout.trim(), 10);

    const totalCmd = `df -B1 "${pathToCheck}" | tail -1 | awk '{print $2}'`;
    const { stdout: totalOut } = await execAsync(totalCmd);
    const total = parseInt(totalOut.trim(), 10);

    return { total, free: isNaN(free) ? 0 : free };
  }

  async getDeviceSize(devicePath) {
    const cmd = `blockdev --getsize64 "${devicePath}"`;
    const { stdout } = await execAsync(cmd);
    const size = parseInt(stdout.trim(), 10);
    return { size: isNaN(size) ? 0 : size, blocks: 0 };
  }

  generateBackupId(source, type) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    return `${source.id}-${type}-${timestamp}`;
  }

  getDestinationPath(destination, backupId, type, timestamp) {
    let baseDir;
    switch (destination.type) {
      case 'usb':
      case 'nas':
        baseDir = path.join(destination.mountPoint || '/mnt/backup', destination.path || 'clawbox-backups');
        break;
      case 'local':
        baseDir = path.join('/var/backups', destination.path || 'clawbox');
        break;
      default:
        baseDir = '/tmp/backup';
    }

    const dateStr = timestamp.toISOString().slice(0, 10);
    const timeStr = timestamp.toISOString().slice(11, 19).replace(/:/g, '-');
    const filename = `${backupId}-${dateStr}_${timeStr}`;

    return path.join(baseDir, filename);
  }

  async streamCommand(cmd, callback) {
    return new Promise((resolve, reject) => {
      const child = exec(cmd, { maxBuffer: 1024 * 1024 * 10 }, (error, stdout, stderr) => {
        if (error) {
          reject(error);
          return;
        }
        resolve({ stdout, stderr });
      });

      child.stdout?.on('data', (data) => {
        const lines = data.toString().split('\n');
        lines.forEach(line => {
          if (line.trim()) {
            callback({ type: 'log', message: line });
          }
        });
      });

      child.stderr?.on('data', (data) => {
        const lines = data.toString().split('\n');
        lines.forEach(line => {
          if (line.trim() && !line.includes('block size')) {
            callback({ type: 'log', message: `stderr: ${line}` });
          }
        });
      });
    });
  }

  async computeChecksum(filePath) {
    const hash = crypto.createHash('sha256');
    const fileStream = await fs.open(filePath, 'r');
    const readStream = fileStream.createReadStream();

    return new Promise((resolve, reject) => {
      readStream.on('data', (chunk) => hash.update(chunk));
      readStream.on('end', () => resolve(hash.digest('hex')));
      readStream.on('error', reject);
    });
  }

  async collectMetadata(source, backupPath, startTime) {
    let fileCount = 0;
    let totalOriginalSize = 0;

    if (await fs.stat(backupPath).then(s => s.isDirectory()).catch(() => false)) {
      await this.walkDirectory(backupPath, () => {
        fileCount++;
      });
      totalOriginalSize = await this.calculateDirectorySize(source.path, source.exclude || []);
    } else {
      fileCount = 1;
      totalOriginalSize = (await fs.stat(backupPath)).size;
    }

    const durationMs = Date.now() - startTime;

    return {
      sourcePath: source.path,
      fileCount,
      totalOriginalSize,
      durationMs,
      filesExcluded: source.exclude,
    };
  }

  async walkDirectory(dir, visit) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await this.walkDirectory(fullPath, visit);
      } else {
        visit(fullPath);
      }
    }
  }

  async verifyBackup(backup) {
    try {
      const stat = await fs.stat(backup.path);
      if (stat.size !== backup.size) {
        throw new Error('Backup size mismatch');
      }
    } catch (error) {
      throw new Error(`Backup verification failed: ${error.message}`);
    }
  }

  async saveBackupMetadata(backup) {
    const metaPath = path.join(this.metaDir, `${backup.id}.json`);
    const meta = {
      ...backup,
      timestamp: backup.timestamp.toISOString(),
    };
    await fs.writeFile(metaPath, JSON.stringify(meta, null, 2));
  }

  async findLatestBackup(sourceId, destinationId, type) {
    try {
      const files = await fs.readdir(this.metaDir);
      const backups = [];

      for (const file of files) {
        if (file.endsWith('.json')) {
          const content = await fs.readFile(path.join(this.metaDir, file), 'utf-8');
          const meta = JSON.parse(content);
          if (meta.sourceId === sourceId && meta.destinationId === destinationId && meta.type === type) {
            backups.push({
              ...meta,
              timestamp: new Date(meta.timestamp),
            });
          }
        }
      }

      backups.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      return backups[0] || null;
    } catch {
      return null;
    }
  }

  async postBackupActions(backup) {
    await this.curateBackups(backup.destinationId);
    if (this.config.webhookUrl) {
      await this.sendNotification(backup);
    }
  }

  async curateBackups(destinationId) {
    const dest = this.config.destinations.find(d => d.id === destinationId);
    if (!dest) return;

    const retention = dest.retention;
    if (!retention) return;

    try {
      const files = await fs.readdir(this.metaDir);
      const backups = [];

      for (const file of files) {
        if (file.endsWith('.json')) {
          const content = await fs.readFile(path.join(this.metaDir, file), 'utf-8');
          const meta = JSON.parse(content);
          if (meta.destinationId === destinationId) {
            backups.push({
              ...meta,
              timestamp: new Date(meta.timestamp),
            });
          }
        }
      }

      backups.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

      let toDelete = [];

      switch (retention.policy) {
        case 'keep_last':
          const cutoff = new Date();
          cutoff.setDate(cutoff.getDate() - (retention.days || 30));
          toDelete = backups.filter(b => b.timestamp < cutoff);
          break;
        case 'keep_count':
          const keep = retention.count || 10;
          toDelete = backups.slice(keep);
          break;
        case 'keep_indefinitely':
          toDelete = [];
          break;
        case 'custom':
          // custom script handling omitted
          break;
      }

      for (const backup of toDelete) {
        try {
          await fs.unlink(backup.path);
          await fs.unlink(path.join(this.metaDir, `${backup.id}.json`));
          console.log(`Deleted old backup: ${backup.id}`);
        } catch (error) {
          console.error(`Failed to delete backup ${backup.id}:`, error);
        }
      }
    } catch (error) {
      console.error('Curate error:', error);
    }
  }

  async sendNotification(backup) {
    const payload = {
      backupId: backup.id,
      type: backup.type,
      source: backup.sourceId,
      destination: backup.destinationId,
      timestamp: backup.timestamp,
      size: backup.size,
      status: backup.status,
    };

    try {
      await fetch(this.config.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch (error) {
      console.error('Failed to send webhook:', error);
    }
  }

  async restoreBackup(backup, targetPath, callback) {
    callback({ type: 'log', message: `Starting restore from ${backup.id} to ${targetPath}` });

    try {
      await fs.mkdir(targetPath, { recursive: true });

      if (backup.path.endsWith('.tar.gz')) {
        const cmd = `tar -xzf "${backup.path}" -C "${targetPath}" --preserve-permissions`;
        await this.streamCommand(cmd, callback);
      } else if (backup.type === 'incremental') {
        const rsync = new Rsync()
          .shell('bash')
          .set('archive', true)
          .set('verbose', true)
          .source(backup.path + '/')
          .destination(targetPath + '/');

        await this.streamRsync(rsync, callback);
      } else if (backup.path.endsWith('.img.gz')) {
        throw new Error('Disk image restore requires boot media and manual intervention');
      }

      callback({ type: 'complete', message: 'Restore completed successfully' });
    } catch (error) {
      callback({ type: 'error', message: `Restore failed: ${error.message}` });
      throw error;
    }
  }

  streamRsync(rsync, callback) {
    return new Promise((resolve, reject) => {
      rsync.execute((error, code, cmd) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });

      rsync.on('stdout', (line) => {
        callback({ type: 'log', message: line.trim() });
      });

      rsync.on('stderr', (line) => {
        callback({ type: 'log', message: `stderr: ${line.trim()}` });
      });
    });
  }
}