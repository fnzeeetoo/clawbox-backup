# Clawbox Backup & Restore

A comprehensive backup and restore solution for clawbox with web-based UI, scheduling, and multiple destination support.

## Features

### 📦 Backup Destinations
- **USB Device** - Plug-and-play backups to external drives
- **Local SSD** - File store on main system drive
- **Network Attached Storage (NAS)** - SMB/CIFS and NFS support
- **Cloud Services** - Dropbox integration (extensible for S3, Google Drive, etc.)

### 🔄 Backup Types
- **Full Backups** - Complete system/directory snapshots
- **Incremental Backups** - Only changed files using rsync algorithm
- ** Disk Images** - Block-level backups for bare-metal restore

### ⏰ Scheduling & Monitoring
- **Cron-based scheduling** - Flexible backup schedules (hourly, daily, weekly, monthly)
- **Live file system monitoring** - Real-time change detection with chokidar
- **Periodic scans** - Scheduled directory scans for changes

### 🌐 Web UI
- **Dashboard** - Overview of backup status, history, and storage utilization
- **Configuration** - Manage backup sources, destinations, and schedules
- **Restore Wizard** - Point-in-time restore with visual selection
- **Monitoring** - Real-time logs and progress indicators

### 📊 Smart Management
- **Backup naming** - Automatic date/timestamp naming (YYYY-MM-DD_HH-MM-SS)
- **Size estimation** - Pre-backup estimation with warnings
- **Disk space validation** - Checks available space before backup
- **Auto-curation** - Retention policies (keep last 30 days, keep indefinitely, custom rules)
- **Low space alerts** - Warnings when backup destination fills up

## Architecture

```
┌─────────────────┐    ┌─────────────────────────────────────────┐
│   Web Browser   │◄──►│         Next.js Web UI (Vercel)        │
│   (HTTPS)       │    │  - Configuration                       │
└─────────────────┘    │  - Monitoring                          │
                        │  - Restore Wizard                      │
                        └───────────────┬─────────────────────────┘
                                        │ API Calls (HTTP)
                                        ▼
┌─────────────────────────────────────────────────────────────┐
│                  Clawbox Host (Local)                      │
│  ┌──────────────────────────────────────────────────────┐  │
│  │            Backup Engine (Node.js)                    │  │
│  │  - Scheduler (node-cron)                             │  │
│  │  - File Monitor (chokidar)                           │  │
│  │  - Backup Executor                                   │  │
│  │    • Full (tar/rsync)                                │  │
│  │    • Incremental (rsync hardlinks)                   │  │
│  │    • Disk Images (dd/clonezilla-style)              │  │
│  │  - Storage Validator (disk space checks)            │  │
│  │  - Curator (retention policies)                     │  │
│  │  - Restore Engine                                   │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              Destinations                            │  │
│  │  • Local: /backup, /mnt/usb, /mnt/nas               │  │
│  │  • Cloud: Dropbox (via API)                         │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Installation

### 1. Deploy Web UI to Vercel
```bash
cd clawbox-backup
vercel --prod
```

Configure environment variables in Vercel:
```
BACKUP_API_URL=http://clawbox:18789
```

### 2. Install Backup Engine on Clawbox
```bash
# Clone repository
git clone https://github.com/fnzeeetoo/clawbox-backup.git
cd clawbox-backup

# Install dependencies
npm ci --only=production

# Run system installation (creates systemd service, config dirs)
npm run install:system

# Configure first backup set via web UI
# The backup engine will automatically register with the web UI
```

### 3. Systemd Service
The installer creates:
- `/etc/systemd/system/clawbox-backup.service`
- `/etc/clawbox-backup/config.json` (main configuration)
- `/var/lib/clawbox-backup/` (state, logs, metadata)

```bash
sudo systemctl enable clawbox-backup
sudo systemctl start clawbox-backup
sudo systemctl status clawbox-backup
```

## Configuration

### Backup Sources
Define directories or disks to backup:
```json
{
  "sources": [
    {
      "id": "user-data",
      "path": "/home/clawbox",
      "type": "directory",
      "exclude": ["**/node_modules", "**/.cache", "**/tmp"]
    },
    {
      "id": "openclaw-config",
      "path": "/etc/openclaw",
      "type": "directory"
    }
  ]
}
```

### Backup Destinations
```json
{
  "destinations": [
    {
      "id": "usb-backup",
      "type": "usb",
      "mountPoint": "/mnt/usb",
      "path": "clawbox-backups",
      "retention": {
        "policy": "keep_last",
        "days": 30
      }
    },
    {
      "id": "dropbox-cloud",
      "type": "dropbox",
      "accessToken": "YOUR_DROPBOX_TOKEN",
      "folder": "/Apps/ClawboxBackup",
      "retention": {
        "policy": "keep_indefinitely"
      }
    }
  ]
}
```

### Schedules
```json
{
  "schedules": [
    {
      "id": "daily-incremental",
      "cron": "0 2 * * *",  // 2 AM daily
      "backupType": "incremental",
      "sourceId": "user-data",
      "destinationId": "usb-backup"
    },
    {
      "id": "weekly-full",
      "cron": "0 3 * * 0",  // 3 AM Sunday
      "backupType": "full",
      "sourceId": "user-data",
      "destinationId": "usb-backup"
    }
  ]
}
```

## Using the Web UI

### Dashboard
- View backup history and status
- See storage utilization across destinations
- Monitor running/queued backups

### Configuration Panel
- Add/edit backup sources
- Configure destinations (USB, NAS, cloud)
- Set schedules with cron expressions
- Define retention policies

### Restore Wizard
1. Select backup to restore from (date/time, destination)
2. Choose restore target (original location or custom path)
3. Preview file list (optional)
4. Execute restore with progress monitoring

### Monitoring
- Real-time log streaming
- Backup duration and size statistics
- Error alerts and notifications

## Backup Formats

### Full Backup (tar)
- Creates compressed tar archive: `clawbox-backup-user-data-2026-03-27_02-00-00.tar.gz`
- Metadata stored in companion JSON file

### Incremental Backup (rsync hardlinks)
- Uses `rsync --link-dest` to create hardlink trees
- Only changed files consume additional space
- Can roll forward/backward through incremental chain

### Disk Image (dd + compression)
- Block-level copy of entire disk/partition
- Suitable for bare-metal restore
- Requires dedicated tooling for restore

## File Naming Convention

```
{backup-set-id}-{backup-type}-{datetime}.{ext}
Examples:
  user-data-full-2026-03-27_02-00-00.tar.gz
  user-data-incremental-2026-03-27_03-00-00/
  system-disk-image-2026-03-27_04-00-00.img.gz
```

## Retention Policies

- **keep_last (N days)** - Keep the most recent N days of backups
- **keep_indefinitely** - Never auto-delete
- **keep_count (N)** - Keep exactly N most recent backups
- **custom script** - Hook for custom curation logic

## API Reference

The backup engine exposes a REST API on port 18789 (or configured):

- `GET /api/backups` - List all backups
- `GET /api/backups/:id` - Get backup details
- `POST /api/backups` - Trigger manual backup
- `POST /api/backups/:id/restore` - Initiate restore
- `GET /api/schedules` - List schedules
- `POST /api/schedules` - Create/update schedule
- `GET /api/destinations` - List and test destinations
- `GET /api/stats` - Storage utilization and statistics
- `WS /ws/logs` - Real-time log streaming

## Security Considerations

- All API endpoints should be behind authentication (JWT or API key)
- Backup files may contain sensitive data - encrypt at rest if storing offsite
- Dropbox tokens should have minimal required permissions
- Systemd service runs as dedicated `clawbox-backup` user
- Configuration files readable only by service user

## Troubleshooting

### Permission Denied on Backup Source
Ensure the backup service user has read access to all source paths.

### Insufficient Disk Space on Destination
The engine performs a dry-run estimation first. Increase destination capacity or reduce backup scope.

### USB Drive Not Detected
Check mount point: `lsblk` and `mount`. The service watches for USB insertion and auto-mounts configured drives.

### NAS Unreachable
Verify network connectivity and credentials. Test manually with `smbclient` or `mount.cifs`.

### Failed Incremental Chain
If an incremental backup fails, the next full backup will automatically reset the chain.

## Development

```bash
# Install dependencies
npm ci

# Run development server
npm run dev

# Build for production
npm run build

# Run tests
npm test

# Run backup manually (outside scheduler)
npm run backup:run -- --source user-data --destination usb-backup --type incremental

# Monitor file changes (test)
npm run monitor:run -- --source /home/clawbox
```

## Project Structure

```
clawbox-backup/
├── pages/
│   ├── api/                  # Next.js API routes (proxy to local engine or direct)
│   ├── dashboard.tsx         # Main dashboard
│   ├── configure.tsx         # Configuration panels
│   ├── restore.tsx           # Restore wizard
│   └── monitoring.tsx        # Logs and stats
├── components/
│   ├── BackupCard.tsx
│   ├── ScheduleForm.tsx
│   ├── DestinationForm.tsx
│   └── RestoreWizard.tsx
├── lib/
│   ├── backup-engine.ts      # Core backup logic (rsync, tar, etc.)
│   ├── scheduler.ts          # Cron-based scheduling
│   ├── monitor.ts            # File system monitoring
│   ├── storage.ts            # Destination abstractions (USB, NAS, cloud)
│   ├── curator.ts            # Retention and cleanup
│   └── api-client.ts         # Communication with web UI
├── scripts/
│   ├── backup-runner.js      # Standalone backup execution
│   ├── monitor.js            # Standalone file monitor
│   └── install-system.js     # System installation
├── types/
│   └── index.ts              # TypeScript definitions
├── public/
│   └── icons/
├── .env.example
├── next.config.js
├── tailwind.config.js
├── tsconfig.json
└── package.json
```

## License

MIT