#!/usr/bin/env node

/**
 * System Installation Script for Clawbox Backup
 *
 * This script sets up the backup engine as a systemd service on the host machine.
 * Run with: sudo npm run install:system
 */

import { execSync } from 'child_process';
import { existsSync, mkdirSync, writeFileSync, chmodSync } from 'fs';
import { join } from 'path';

const CONFIG_DIR = '/etc/clawbox-backup';
const CONFIG_PATH = join(CONFIG_DIR, 'config.json');
const STATE_DIR = '/var/lib/clawbox-backup';
const SERVICE_PATH = '/etc/systemd/system/clawbox-backup.service';
const NODE_PATH = '/usr/bin/node'; // Adjust if node is elsewhere
const BACKUP_PORT = 18790;

// Default configuration
const DEFAULT_CONFIG = {
  sources: [
    {
      id: 'openclaw-workspace',
      name: 'OpenClaw Workspace',
      path: '/home/clawbox/.openclaw/workspace',
      type: 'directory',
      exclude: [
        '**/node_modules',
        '**/.cache',
        '**/tmp',
        '**/.git',
        '**/.npm',
      ],
    },
    {
      id: 'openclaw-config',
      name: 'OpenClaw Configuration',
      path: '/etc/openclaw',
      type: 'directory',
    },
  ],
  destinations: [
    {
      id: 'local-backup',
      name: 'Local SSD Backup Store',
      type: 'local',
      mountPoint: '/var/backups',
      path: 'clawbox',
      retention: {
        policy: 'keep_last',
        days: 30,
      },
    },
  ],
  schedules: [
    {
      id: 'daily-incremental',
      name: 'Daily Incremental',
      cron: '0 2 * * *', // 2 AM every day
      sourceId: 'openclaw-workspace',
      destinationId: 'local-backup',
      backupType: 'incremental',
      enabled: true,
    },
    {
      id: 'weekly-full',
      name: 'Weekly Full',
      cron: '0 3 * * 0', // 3 AM Sunday
      sourceId: 'openclaw-workspace',
      destinationId: 'local-backup',
      backupType: 'full',
      enabled: true,
    },
  ],
  globalRetention: {
    policy: 'keep_last',
    days: 90,
  },
  logLevel: 'info',
  monitoring: {
    enabled: true,
    watchMode: 'realtime',
    scanIntervalMinutes: 60,
  },
  webhookUrl: '', // optional
};

const SERVICE_CONTENT = `[Unit]
Description=Clawbox Backup Engine
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=root
WorkingDirectory=/usr/lib/clawbox-backup
Environment=NODE_ENV=production
Environment=CONFIG_PATH=${CONFIG_PATH}
Environment=PORT=${BACKUP_PORT}
ExecStart=${NODE_PATH} /usr/lib/clawbox-backup/lib/api-server.js
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
`;

const UI_SERVICE_CONTENT = `[Unit]
Description=Clawbox Backup UI
After=network-online.target clawbox-backup.service
Wants=network-online.target

[Service]
Type=simple
User=root
WorkingDirectory=/usr/lib/clawbox-backup
Environment=NODE_ENV=production
Environment=BACKUP_API_URL=http://localhost:${BACKUP_PORT}
ExecStart=${NODE_PATH} /usr/lib/clawbox-backup/.next/standalone/server.js
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
`;

function log(message, type = 'info') {
  const colors = {
    info: '\x1b[36m',   // Cyan
    success: '\x1b[32m', // Green
    warn: '\x1b[33m',   // Yellow
    error: '\x1b[31m',  // Red
    reset: '\x1b[0m',
  };
  console.log(`${colors[type]}${message}${colors.reset}`);
}

function checkPrerequisites() {
  if (process.getuid && process.getuid() !== 0) {
    log('This script must be run as root (use sudo)', 'error');
    process.exit(1);
  }

  // Check node
  try {
    const nodeVersion = execSync('node --version', { encoding: 'utf-8' }).trim();
    log(`✓ Node.js ${nodeVersion} found`, 'success');
  } catch {
    log('✗ Node.js not found. Install Node.js 18+ first.', 'error');
    process.exit(1);
  }

  // Check if rsync exists (for incremental backups)
  try {
    execSync('rsync --version', { stdio: 'ignore' });
    log('✓ rsync found', 'success');
  } catch {
    log('✗ rsync not found. Install rsync for incremental backups.', 'warn');
  }
}

function createDirectories() {
  log('Creating directories...', 'info');
  mkdirSync(CONFIG_DIR, { recursive: true });
  mkdirSync(STATE_DIR, { recursive: true });
  log('✓ Directories created', 'success');
}

function writeConfig() {
  log('Writing configuration...', 'info');

  if (existsSync(CONFIG_PATH)) {
    const backup = `${CONFIG_PATH}.backup-${Date.now()}`;
    log(`Config already exists, backing up to ${backup}`, 'warn');
    execSync(`cp "${CONFIG_PATH}" "${backup}"`);
  }

  writeFileSync(CONFIG_PATH, JSON.stringify(DEFAULT_CONFIG, null, 2));
  log(`✓ Configuration written to ${CONFIG_PATH}`, 'success');
}

function copyFiles() {
  log('Copying application files...', 'info');

  const cwd = process.cwd();
  const possiblePaths = [
    join(cwd, '..', '..'),
    cwd,
    '/usr/lib/clawbox-backup',
  ];

  let installPath = '';
  for (const p of possiblePaths) {
    if (existsSync(join(p, 'package.json'))) {
      installPath = p;
      break;
    }
  }

  if (!installPath) {
    log('Could not find project root. Are you running from the project directory?', 'error');
    process.exit(1);
  }

  const targetDir = '/usr/lib/clawbox-backup';
  mkdirSync(targetDir, { recursive: true });

  // Copy all source files (lib, pages, public, styles, etc.)
  execSync(`cp -r "${installPath}/"* "${targetDir}/"`);

  log(`✓ Files copied to ${targetDir}`, 'success');
}

function writeServiceFile() {
  log('Writing systemd services...', 'info');

  // Backup engine service
  if (existsSync(SERVICE_PATH)) {
    const backup = `${SERVICE_PATH}.backup-${Date.now()}`;
    log(`Service already exists, backing up to ${backup}`, 'warn');
    execSync(`cp "${SERVICE_PATH}" "${backup}"`);
  }
  writeFileSync(SERVICE_PATH, SERVICE_CONTENT);
  log(`✓ Backup engine service written to ${SERVICE_PATH}`, 'success');

  // UI service
  const UI_SERVICE_PATH = '/etc/systemd/system/clawbox-backup-ui.service';
  if (existsSync(UI_SERVICE_PATH)) {
    const backup = `${UI_SERVICE_PATH}.backup-${Date.now()}`;
    log(`UI service already exists, backing up to ${backup}`, 'warn');
    execSync(`cp "${UI_SERVICE_PATH}" "${backup}"`);
  }
  writeFileSync(UI_SERVICE_PATH, UI_SERVICE_CONTENT);
  log(`✓ UI service written to ${UI_SERVICE_PATH}`, 'success');
}

function reloadSystemd() {
  log('Reloading systemd...', 'info');
  execSync('systemctl daemon-reload');
  log('✓ systemd reloaded', 'success');
}

function enableAndStart() {
  log('Enabling and starting services...', 'info');
  execSync('systemctl enable clawbox-backup');
  execSync('systemctl enable clawbox-backup-ui');
  execSync('systemctl start clawbox-backup');
  // Build and start UI
  log('Building Next.js UI...', 'info');
  try {
    // Use npm install (not ci) since we may not have a lockfile in /usr/lib/clawbox-backup
    execSync('npm install --production', { cwd: '/usr/lib/clawbox-backup', stdio: 'inherit' });
    execSync('npm run build', { cwd: '/usr/lib/clawbox-backup', stdio: 'inherit', env: { ...process.env, BACKUP_API_URL: `http://localhost:${BACKUP_PORT}` } });
    log('✓ UI build complete', 'success');
    log('Copying static assets for standalone UI...', 'info');
    execSync('mkdir -p /usr/lib/clawbox-backup/.next/standalone/.next && cp -r /usr/lib/clawbox-backup/.next/static /usr/lib/clawbox-backup/.next/standalone/.next/', { stdio: 'inherit' });
    log('✓ Static assets copied', 'success');
  } catch (buildErr) {
    log('⚠ UI build failed, UI service may not start: ' + buildErr.message, 'warn');
  }
  execSync('systemctl start clawbox-backup-ui');
  log('✓ Services enabled and started', 'success');
}

function printStatus() {
  log('Checking service status...', 'info');
  try {
    const status = execSync('systemctl status clawbox-backup --no-pager', {
      encoding: 'utf-8',
    });
    console.log(status);
  } catch (error) {
    log('Service status check failed: ' + error.message, 'error');
  }
}

function printNextSteps() {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║         CLAWBOX BACKUP INSTALLATION COMPLETE                ║
╠══════════════════════════════════════════════════════════════╣
║                                                            ║
║  ✓ Backup engine API running on port ${BACKUP_PORT}                ║
║  ✓ Web UI running on port 3000 (localhost)               ║
║                                                            ║
║  Next steps:                                               ║
║                                                            ║
║  1. Verify configuration:                                  ║
║     sudo nano ${CONFIG_PATH}                                ║
║                                                            ║
║  2. Check service status:                                  ║
║     sudo systemctl status clawbox-backup                   ║
║     sudo systemctl status clawbox-backup-ui                ║
║                                                            ║
║  3. Access the web UI:                                     ║
║     Open http://localhost:3000 in your browser             ║
║     (Or http://<clawbox-ip>:3000 from another device)     ║
║                                                            ║
║  4. Test a backup via the UI or manually:                 ║
║     sudo npm run backup:run -- --source openclaw-workspace \\║
║       --destination local-backup --type full               ║
║                                                            ║
║  5. Adjust schedules and sources via the web UI           ║
║                                                            ║
║  Logs:                                                     ║
║     sudo journalctl -u clawbox-backup -f                  ║
║     sudo journalctl -u clawbox-backup-ui -f               ║
║                                                            ║
╚══════════════════════════════════════════════════════════════╝
  `);
}

function main() {
  console.log('\n=== Clawbox Backup System Installation ===\n');

  checkPrerequisites();
  createDirectories();
  writeConfig();
  copyFiles();
  writeServiceFile();
  reloadSystemd();
  enableAndStart();

  log('\nWaiting for service to start...', 'info');
  setTimeout(() => {
    printStatus();
    printNextSteps();
  }, 2000);
}

main();