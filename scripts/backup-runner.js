#!/usr/bin/env node

/**
 * Manual Backup Runner
 *
 * Usage: node scripts/backup-runner.js --source <sourceId> --destination <destId> --type <full|incremental>
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { BackupEngine } from '../lib/backup-engine.js';

const CONFIG_PATH = process.env.CONFIG_PATH || '/etc/clawbox-backup/config.json';

function printUsage() {
  console.log(`
Clawbox Backup Runner

Usage:
  node scripts/backup-runner.js --source <sourceId> --destination <destId> [--type <full|incremental>] [--log-level <debug|info|warn|error>]

Options:
  --source, -s        Source ID from config (required)
  --destination, -d   Destination ID from config (required)
  --type, -t          Backup type: full or incremental (default: incremental)
  --log-level         Set logging level (default: info)
  --help, -h          Show this help

Example:
  node scripts/backup-runner.js --source openclaw-workspace --destination local-backup --type full
`);
}

async function main() {
  const args = process.argv.slice(2);
  const options: any = {};

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--source':
      case '-s':
        options.sourceId = args[++i];
        break;
      case '--destination':
      case '-d':
        options.destId = args[++i];
        break;
      case '--type':
      case '-t':
        options.type = args[++i];
        break;
      case '--log-level':
        options.logLevel = args[++i];
        break;
      case '--help':
      case '-h':
        printUsage();
        process.exit(0);
        break;
    }
  }

  if (!options.sourceId || !options.destId) {
    console.error('Error: --source and --destination are required');
    printUsage();
    process.exit(1);
  }

  if (!['full', 'incremental'].includes(options.type)) {
    options.type = 'incremental'; // default
  }

  // Load configuration
  if (!existsSync(CONFIG_PATH)) {
    console.error(`Configuration not found: ${CONFIG_PATH}`);
    console.error('Please install the system first with: npm run install:system');
    process.exit(1);
  }

  const config = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'));

  // Find source and destination
  const source = config.sources.find((s: any) => s.id === options.sourceId);
  const destination = config.destinations.find((d: any) => d.id === options.destId);

  if (!source) {
    console.error(`Source not found: ${options.sourceId}`);
    console.error('Available sources:', config.sources.map((s: any) => s.id).join(', '));
    process.exit(1);
  }

  if (!destination) {
    console.error(`Destination not found: ${options.destId}`);
    console.error('Available destinations:', config.destinations.map((d: any) => d.id).join(', '));
    process.exit(1);
  }

  // Create engine
  const engine = new BackupEngine(config);

  // Logging callback
  const logCallback = (event: any) => {
    const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
    const prefix = event.type === 'error' ? '❌' : event.type === 'complete' ? '✅' : 'ℹ️';
    console.log(`[${timestamp}] ${prefix} ${event.message}`);
    if (event.percent !== undefined) {
      console.log(`   Progress: ${event.percent.toFixed(1)}%`);
    }
  };

  // Run backup
  console.log(`Starting ${options.type} backup...`);
  console.log(`Source: ${source.name} (${source.path})`);
  console.log(`Destination: ${destination.name} (${destination.type})`);
  console.log('---');

  try {
    await engine.runBackup(source, destination, options.type, logCallback);
    console.log('\n✅ Backup completed successfully');
    process.exit(0);
  } catch (error: any) {
    console.error(`\n❌ Backup failed: ${error.message}`);
    process.exit(1);
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});