#!/usr/bin/env node

/**
 * File System Monitor
 *
 * Watches configured sources for changes and can trigger immediate backups.
 * Usage: node scripts/monitor.js --source <sourceId>
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { Monitor } from '../lib/monitor.js';

const CONFIG_PATH = process.env.CONFIG_PATH || '/etc/clawbox-backup/config.json';

function printUsage() {
  console.log(`
Clawbox File Monitor

Usage:
  node scripts/monitor.js --source <sourceId> [--trigger-backup]

Options:
  --source, -s        Source ID to monitor (required)
  --trigger-backup    Trigger immediate backup on changes
  --help, -h          Show this help

Example:
  node scripts/monitor.js --source openclaw-workspace --trigger-backup
`);
}

async function main() {
  const args = process.argv.slice(2);
  let sourceId = '';
  let triggerBackup = false;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--source':
      case '-s':
        sourceId = args[++i];
        break;
      case '--trigger-backup':
        triggerBackup = true;
        break;
      case '--help':
      case '-h':
        printUsage();
        process.exit(0);
        break;
    }
  }

  if (!sourceId) {
    console.error('Error: --source is required');
    printUsage();
    process.exit(1);
  }

  // Load configuration
  if (!existsSync(CONFIG_PATH)) {
    console.error(`Configuration not found: ${CONFIG_PATH}`);
    process.exit(1);
  }

  const config = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'));
  const source = config.sources.find((s: any) => s.id === sourceId);

  if (!source) {
    console.error(`Source not found: ${sourceId}`);
    console.error('Available sources:', config.sources.map((s: any) => s.id).join(', '));
    process.exit(1);
  }

  const monitor = new Monitor();

  console.log(`Starting file monitor for: ${source.name}`);
  console.log(`Path: ${source.path}`);
  console.log(`Press Ctrl+C to stop\n`);

  await monitor.startMonitoring([source], (event, filePath) => {
    const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
    const icons: Record<string, string> = {
      add: '📄',
      change: '✏️',
      unlink: '🗑️',
    };
    console.log(`[${timestamp}] ${icons[event] || '📌'} ${event}: ${filePath}`);

    if (triggerBackup) {
      console.log(`   Triggering immediate backup for changed file...`);
      // In a real implementation, you'd trigger incremental backup
      // or queue the specific file for backup
    }
  });

  // Handle shutdown
  process.on('SIGINT', async () => {
    console.log('\nStopping monitor...');
    await monitor.stopMonitoring();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    await monitor.stopMonitoring();
    process.exit(0);
  });
}

main().catch(error => {
  console.error('Monitor error:', error);
  process.exit(1);
});