// Full api-server.js with overwrite support in restore
// Replace /usr/lib/clawbox-backup/lib/api-server.js with this file

import express from 'express';
import cors from 'cors';
import { readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { readdir } from 'fs/promises';
import { join } from 'path';
import os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import { BackupEngine } from './backup-engine.js';
import { Scheduler } from './scheduler.js';
import { Monitor } from './monitor.js';
import { StorageManager } from './storage.js';

const execAsync = promisify(exec);
const app = express();
const PORT = process.env.PORT || 18790;

app.use(cors());
app.use(express.json());

// Global state
let engine;
let scheduler;
let monitor;
let storage;
let config;

// Load configuration
async function loadConfig() {
  const configPath = process.env.CONFIG_PATH || '/etc/clawbox-backup/config.json';
  if (!existsSync(configPath)) {
    throw new Error(`Configuration file not found: ${configPath}`);
  }
  const raw = await readFile(configPath, 'utf-8');
  return JSON.parse(raw);
}

// API Routes

app.get('/api/backups', async (req, res) => {
  try {
    const metaDir = '/var/lib/clawbox-backup/metadata';
    const files = await readdir(metaDir);
    const backups = [];

    for (const file of files.filter(f => f.endsWith('.json'))) {
      const content = await readFile(join(metaDir, file), 'utf-8');
      backups.push(JSON.parse(content));
    }

    res.json({ success: true, data: backups });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/backups/:id', async (req, res) => {
  try {
    const metaPath = `/var/lib/clawbox-backup/metadata/${req.params.id}.json`;
    if (!existsSync(metaPath)) {
      return res.status(404).json({ success: false, error: 'Backup not found' });
    }
    const content = await readFile(metaPath, 'utf-8');
    res.json({ success: true, data: JSON.parse(content) });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/backups', async (req, res) => {
  try {
    const { sourceId, destinationId, backupType = 'incremental' } = req.body;
    const source = config.sources.find(s => s.id === sourceId);
    const destination = config.destinations.find(d => d.id === destinationId);

    if (!source || !destination) {
      return res.status(400).json({ success: false, error: 'Invalid source or destination' });
    }

    const backup = await engine.runBackup(source, destination, backupType, (event) => {
      console.log(`[Backup] ${event.message}`);
    });

    res.json({ success: true, data: backup });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/backups/:id/restore', async (req, res) => {
  try {
    const { targetPath, overwrite = false } = req.body;
    const metaPath = `/var/lib/clawbox-backup/metadata/${req.params.id}.json`;

    if (!existsSync(metaPath)) {
      return res.status(404).json({ success: false, error: 'Backup not found' });
    }

    const meta = JSON.parse(await readFile(metaPath, 'utf-8'));
    const backup = { ...meta, timestamp: new Date(meta.timestamp) };

    await engine.restoreBackup(
      backup,
      targetPath || originalLocation(backup),
      { overwrite },
      (event) => {
        console.log(`[Restore] ${event.message}`);
      }
    );

    res.json({ success: true, message: 'Restore initiated' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ... [rest of the routes remain the same: schedules, destinations, sources, stats, logs, usb]

app.get('/api/schedules', (req, res) => {
  const schedules = scheduler.getAllSchedules();
  res.json({ success: true, data: schedules });
});

app.post('/api/schedules', async (req, res) => {
  try {
    const schedule = req.body;
    if (schedule.id) {
      scheduler.updateSchedule(schedule.id, schedule);
      res.json({ success: true, message: 'Schedule updated' });
    } else {
      schedule.id = `sched-${Date.now()}`;
      scheduler.addSchedule(schedule);
      res.json({ success: true, data: schedule, message: 'Schedule created' });
    }

    await saveConfig();
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/schedules/:id', async (req, res) => {
  const ok = scheduler.deleteSchedule(req.params.id);
  if (ok) {
    await saveConfig();
    res.json({ success: true, message: 'Schedule deleted' });
  } else {
    res.status(404).json({ success: false, error: 'Schedule not found' });
  }
});

app.get('/api/destinations', async (req, res) => {
  const results = [];
  for (const dest of config.destinations) {
    const normalized = {
      ...dest,
      retention: dest.retention || { policy: 'keep_last', days: 30 },
    };
    const test = await storage.testDestination(dest);
    results.push({ ...normalized, ...test });
  }
  res.json({ success: true, data: results });
});

app.post('/api/destinations', async (req, res) => {
  try {
    const dest = req.body;
    if (!dest.name || !dest.type || !dest.mountPoint) {
      return res.status(400).json({ success: false, error: 'Missing required fields: name, type, mountPoint' });
    }
    if (!dest.retention) {
      dest.retention = { policy: 'keep_last', days: 30 };
    }
    if (dest.type !== 'local' && !dest.path) {
      dest.path = 'clawbox-backups';
    }
    if (!dest.id) {
      dest.id = `dest-${Date.now()}`;
    }
    if (dest.id) {
      const index = config.destinations.findIndex(d => d.id === dest.id);
      if (index !== -1) {
        config.destinations[index] = dest;
      } else {
        config.destinations.push(dest);
      }
    } else {
      config.destinations.push(dest);
    }
    await saveConfig();
    res.json({ success: true, data: dest });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/destinations/:id', async (req, res) => {
  const id = req.params.id;
  const index = config.destinations.findIndex(d => d.id === id);
  if (index !== -1) {
    config.destinations.splice(index, 1);
    await saveConfig();
    res.json({ success: true, message: 'Destination deleted' });
  } else {
    res.status(404).json({ success: false, error: 'Destination not found' });
  }
});

app.get('/api/sources', (req, res) => {
  res.json({ success: true, data: config.sources });
});

app.post('/api/sources', async (req, res) => {
  try {
    const source = req.body;
    if (source.id) {
      const index = config.sources.findIndex(s => s.id === source.id);
      if (index !== -1) {
        config.sources[index] = source;
      } else {
        config.sources.push(source);
      }
    } else {
      source.id = `src-${Date.now()}`;
      config.sources.push(source);
    }
    await saveConfig();
    res.json({ success: true, data: source });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/sources/:id', async (req, res) => {
  const id = req.params.id;
  const index = config.sources.findIndex(s => s.id === id);
  if (index !== -1) {
    config.sources.splice(index, 1);
    await saveConfig();
    res.json({ success: true, message: 'Source deleted' });
  } else {
    res.status(404).json({ success: false, error: 'Source not found' });
  }
});

app.get('/api/stats', async (req, res) => {
  const stats = {
    system: await getSystemStats(),
    destinations: await getDestinationStats(),
    recentBackups: await getRecentBackups(10),
  };
  res.json({ success: true, data: stats });
});

app.get('/api/logs', async (req, res) => {
  try {
    const { stdout } = await execAsync('journalctl -u clawbox-backup --no-pager -n 200');
    const lines = stdout.split('\n').filter(l => l.trim());
    const logs = lines.map(line => {
      const match = line.match(/^([A-Za-z]{3} \d{2} \d{2}:\d{2}:\d{2}) \S+ \S+\[.*\]: (.*)/);
      if (match) {
        const [, timestampStr, message] = match;
        const timestamp = new Date(timestampStr).toISOString();
        let level = 'info';
        if (/error|Error/.test(message)) level = 'error';
        else if (/warn|Warn/.test(message)) level = 'warn';
        else if (/debug|Debug/.test(message)) level = 'debug';
        return { timestamp, level, message };
      }
      return { timestamp: new Date().toISOString(), level: 'info', message: line };
    });
    res.json({ success: true, data: logs });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/usb', async (req, res) => {
  try {
    const devices = await storage.detectUSBDevices();
    const partitions = devices.filter(d => /^\/dev\/[a-z]+[0-9]+$/.test(d.device));
    res.json({ success: true, data: partitions });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/usb/mount', async (req, res) => {
  try {
    const { device, label, fsType } = req.body;
    const mountPoint = await storage.mountUSB(device, { label, fsType });
    res.json({ success: true, data: { mountPoint } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Helper functions

async function getSystemStats() {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();

  return {
    uptime: os.uptime(),
    cpuLoad: os.loadavg(),
    memory: {
      total: totalMem,
      used: totalMem - freeMem,
      free: freeMem,
    },
  };
}

async function getDestinationStats() {
  const stats = [];
  for (const dest of config.destinations) {
    try {
      const metaDir = '/var/lib/clawbox-backup/metadata';
      const files = await readdir(metaDir);
      const destBackups = [];

      for (const file of files) {
        if (file.endsWith('.json')) {
          const content = await readFile(join(metaDir, file), 'utf-8');
          const meta = JSON.parse(content);
          if (meta.destinationId === dest.id) {
            destBackups.push(meta);
          }
        }
      }

      const totalSize = destBackups.reduce((sum, b) => sum + (b.size || 0), 0);
      const oldest = destBackups.length > 0 ? new Date(Math.min(...destBackups.map(b => new Date(b.timestamp).getTime()))) : null;
      const newest = destBackups.length > 0 ? new Date(Math.max(...destBackups.map(b => new Date(b.timestamp).getTime()))) : null;

      stats.push({
        destinationId: dest.id,
        totalBackups: destBackups.length,
        totalSize,
        oldestBackup: oldest,
        newestBackup: newest,
      });
    } catch (e) {
      // ignore errors
    }
  }
  return stats;
}

async function getRecentBackups(limit) {
  try {
    const metaDir = '/var/lib/clawbox-backup/metadata';
    const files = await readdir(metaDir);
    const backups = [];

    for (const file of files) {
      if (file.endsWith('.json')) {
        const content = await readFile(join(metaDir, file), 'utf-8');
        backups.push(JSON.parse(content));
      }
    }

    backups.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return backups.slice(0, limit);
  } catch {
    return [];
  }
}

function originalLocation(backup) {
  const source = config.sources.find(s => s.id === backup.sourceId);
  return source?.path || '/restore';
}

async function saveConfig() {
  const configPath = process.env.CONFIG_PATH || '/etc/clawbox-backup/config.json';
  const content = JSON.stringify(config, null, 2);
  await writeFile(configPath, content);
}

// Start server
async function start() {
  try {
    config = await loadConfig();
    engine = new BackupEngine(config);
    await engine.initialize();

    scheduler = new Scheduler(engine);
    scheduler.loadSchedules(config.schedules);

    monitor = new Monitor();
    if (config.monitoring?.enabled) {
      await monitor.startMonitoring(config.sources, (event, path) => {
        console.log(`File change: ${event} - ${path}`);
      });
    }

    storage = new StorageManager();

    app.listen(PORT, () => {
      console.log(`Clawbox Backup API listening on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start backup engine:', error);
    process.exit(1);
  }
}

start();

export { app as apiApp };
