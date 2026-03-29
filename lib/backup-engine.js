import fs from 'fs';
import { createReadStream, createWriteStream } from 'fs';
import { readFile, writeFile, rm, mkdir } from 'fs/promises';
import { join, dirname, basename } from 'path';
import { pipeline } from 'stream/promises';
import os from 'os';
import { exec, spawn } from 'child_process';
import archiver from 'archiver';
import Rsync from 'rsync';
import { v4 as uuid } from 'uuid';

export class BackupEngine {
  constructor(config) {
    this.config = config;
  }

  async initialize() {
    const metaDir = '/var/lib/clawbox-backup/metadata';
    if (!fs.existsSync(metaDir)) {
      await mkdir(metaDir, { recursive: true });
    }
  }

  async runBackup(source, destination, type, callback) {
    const backupId = uuid();
    const timestamp = new Date().toISOString();
    const backupDir = join(destination.mountPoint, 'backups');
    await mkdir(backupDir, { recursive: true });
    const backupPath = join(backupDir, `${source.name}-${type}-${timestamp.replace(/[:.]/g, '-')}.tar.gz`);

    callback({ type: 'log', message: `Starting ${type} backup of ${source.name} to ${destination.name}` });

    try {
      if (type === 'full' || type === 'incremental') {
        if (source.type === 'directory') {
          await this.archiveDirectory(source.path, backupPath, callback);
        } else if (source.type === 'command') {
          await this.backupFromCommand(source, backupPath, callback);
        }
      }

      const stats = fs.statSync(backupPath);
      const size = stats.size;

      const metadata = {
        id: backupId,
        sourceId: source.id,
        sourcePath: source.path,
        destinationId: destination.id,
        destinationPath: destination.mountPoint,
        type,
        status: 'completed',
        startedAt: timestamp,
        completedAt: new Date().toISOString(),
        path: backupPath,
        size,
      };

      const metaPath = `/var/lib/clawbox-backup/metadata/${backupId}.json`;
      await writeFile(metaPath, JSON.stringify(metadata, null, 2));

      await this.applyRetentionPolicy(destination);

      callback({ type: 'complete', message: `Backup completed: ${backupId}` });
      return metadata;
    } catch (error) {
      console.error('Backup error stack:', error.stack || error);
      callback({ type: 'error', message: `Backup failed: ${error.message}` });
      throw error;
    }
  }

  async archiveDirectory(sourcePath, destPath, callback) {
    return new Promise((resolve, reject) => {
      const archive = archiver('tar', {
        gzip: true,
        gzipOptions: { level: 6 }
      });
      const output = createWriteStream(destPath);
      // Archive with top-level directory name (basename of sourcePath)
      const sourceBasename = basename(sourcePath);
      archive.pipe(output);
      archive.directory(sourcePath, sourceBasename);
      archive.on('warning', (err) => {
        if (err.code === 'ENOENT') {
          // Ignore ENOENT errors
        } else {
          callback({ type: 'log', message: `Archive warning: ${err.message}` });
        }
      });
      archive.on('end', () => {
        resolve();
      });
      archive.finalize();
    });
  }

  async backupFromCommand(source, destPath, callback) {
    return new Promise((resolve, reject) => {
      const cmd = source.command;
      exec(cmd, (error, stdout, stderr) => {
        if (error) {
          reject(new Error(`Command failed: ${stderr || error.message}`));
          return;
        }
        resolve();
      });
    });
  }

  async streamCommand(cmd, callback) {
    return new Promise((resolve, reject) => {
      const shell = process.platform === 'win32' ? 'cmd.exe' : '/bin/bash';
      const args = process.platform === 'win32' ? ['/s', '/c', cmd] : ['-c', cmd];
      const child = spawn(shell, args, { stdio: 'pipe' });

      child.stdout.on('data', (data) => {
        const lines = data.toString().split('\n').filter(l => l.trim());
        lines.forEach(line => callback({ type: 'log', message: line }));
      });

      child.stderr.on('data', (data) => {
        callback({ type: 'log', message: data.toString().trim() });
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Command exited with code ${code}`));
        }
      });

      child.on('error', (error) => {
        callback({ type: 'error', message: error.message });
        reject(error);
      });
    });
  }

  async streamRsync(rsync, callback) {
    return new Promise((resolve, reject) => {
      rsync.on('progress', (data) => {
        if (data.receivedBytes && data.totalBytes) {
          const percent = Math.round((data.receivedBytes / data.totalBytes) * 100);
          callback({ type: 'log', message: `Rsync: ${percent}%` });
        }
      });

      rsync.on('error', (error) => {
        callback({ type: 'error', message: `Rsync error: ${error.message}` });
        reject(error);
      });

      rsync.on('exit', (code, stdout, stderr) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Rsync exited with code ${code}: ${stderr}`));
        }
      });

      rsync.execute(() => {
        // Callback required by rsync library; actual handling via events
      });
    });
  }

  async applyRetentionPolicy(destination) {
    try {
      const metaDir = '/var/lib/clawbox-backup/metadata';
      if (!fs.existsSync(metaDir)) return;

      const files = await fs.readdir(metaDir);
      const backups = [];

      for (const file of files) {
        if (file.endsWith('.json')) {
          try {
            const content = await readFile(join(metaDir, file), 'utf-8');
            const meta = JSON.parse(content);
            if (meta.destinationId === destination.id) {
              backups.push(meta);
            }
          } catch (e) {
            // Skip invalid metadata files
          }
        }
      }

      if (backups.length === 0) return;

      backups.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      const retention = destination.retention || { policy: 'keep_last', days: 30 };
      let toDelete = [];

      if (retention.policy === 'keep_last') {
        const keep = retention.count || Math.floor((retention.days || 30) / 7) || 4;
        toDelete = backups.slice(keep);
      } else if (retention.policy === 'keep_daily') {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - (retention.days || 30));
        toDelete = backups.filter(b => new Date(b.timestamp) < cutoff);
      }

      for (const backup of toDelete) {
        try {
          if (fs.existsSync(backup.path)) {
            await rm(backup.path, { recursive: true, force: true });
          }
          const metaPath = join(metaDir, `${backup.id}.json`);
          if (fs.existsSync(metaPath)) {
            await rm(metaPath);
          }
          console.log(`Deleted old backup: ${backup.id}`);
        } catch (error) {
          console.error(`Failed to delete backup ${backup.id}:`, error);
        }
      }
    } catch (error) {
      console.error('Retention policy error:', error);
    }
  }

  async restoreBackup(backup, targetPath, options = {}, callback) {
    const { overwrite = false } = options;
    callback({ type: 'log', message: `Starting restore from ${backup.id} to ${targetPath}` });

    try {
      const sourceBasename = basename(backup.metadata?.sourcePath || backup.id);
      const fullTarget = join(targetPath, sourceBasename);

      if (overwrite && fs.existsSync(fullTarget)) {
        callback({ type: 'log', message: `Removing existing directory: ${fullTarget}` });
        await rm(fullTarget, { recursive: true, force: true });
      }

      await mkdir(targetPath, { recursive: true });

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

  getBackupPath(source, destination, type, backupId) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${source.name}-${type}-${timestamp}.tar.gz`;
    return join(destination.mountPoint, 'backups', filename);
  }
}
