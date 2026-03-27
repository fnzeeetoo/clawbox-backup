# Clawbox Backup Deployment Guide

This guide covers setting up the backup engine on the clawbox host and deploying the web UI to Vercel.

## Part 1: Install Backup Engine on Clawbox (Host)

### Prerequisites
- Node.js 18+ (`node --version`)
- rsync (`sudo apt install rsync`)
- sudo access

### Installation

```bash
# Navigate to project directory
cd /home/clawbox/.openclaw/workspace/clawbox-backup

# Run the system installer (requires sudo)
sudo npm run install:system
```

This will:
- Create `/etc/clawbox-backup/config.json` with default configuration
- Create `/var/lib/clawbox-backup/` for state and metadata
- Copy application files to `/usr/lib/clawbox-backup/`
- Create systemd service `clawbox-backup`
- Enable and start the service

### Verify Installation

```bash
# Check service status
sudo systemctl status clawbox-backup

# View logs
sudo journalctl -u clawbox-backup -f

# Test API endpoint
curl http://localhost:18789/api/backups
```

### Configure Backups

The default config includes:
- Source: `/home/clawbox/.openclaw/workspace` (excludes node_modules, .cache, etc.)
- Destination: `/var/backups/clawbox`
- Schedules: Daily incremental (2 AM), Weekly full (3 AM Sunday)

Edit config as needed:

```bash
sudo nano /etc/clawbox-backup/config.json
```

After editing, restart the service:

```bash
sudo systemctl restart clawbox-backup
```

### Add USB Destinations

Plug in a USB drive, then either:
- Automatically detected (if mounted under /mnt/usb or /mnt/backup)
- Manually add to config with `mountPoint`

Or use the web UI to detect and configure.

## Part 2: Deploy Web UI to Vercel

### Option A: Deploy via Vercel CLI

```bash
# Install Vercel CLI globally (if not installed)
npm i -g vercel

# Login (use token if headless)
# Replace YOUR_VERCEL_TOKEN with your actual token from https://vercel.com/account/tokens
# vercel login --token YOUR_VERCEL_TOKEN
#
# Note: For better security, run `vercel login` interactively to authenticate via browser.

# Deploy
vercel --prod
```

Set environment variable during deploy:
```
BACKUP_API_URL=http://<clawbox-ip>:18789
```

Replace `<clawbox-ip>` with your clawbox's local IP address (e.g., 192.168.1.100).

### Option B: Deploy via Vercel Dashboard

1. Go to https://vercel.com/new
2. Import repository: `fnzeeetoo/clawbox-backup`
3. Add environment variable:
   - Name: `BACKUP_API_URL`
   - Value: `http://<clawbox-ip>:18789`
4. Click Deploy

### Post-Deploy

After deployment completes:
- Access the web UI at the provided Vercel URL
- Dashboard shows backup status
- Use Configure page to add sources, destinations, schedules
- Use Restore page to recover files

### Firewall / Network

Ensure clawbox allows inbound connections on port 18789 if Vercel-hosted UI needs to reach it directly. Alternatively, you can run the UI locally on clawbox (`npm run dev` and access via localhost) or set up SSH tunneling.

## Part 3: Create Planka Card (Manual)

If Planka API is accessible, run:

```bash
curl -X POST -H "Authorization: Bearer <planka_token>" \
  -H "Content-Type: application/json" \
  -d '{"listId":"1738755373025723596","name":"Clawbox Backup System","type":"project","boardId":"1738749831779714240","position":131072}' \
  https://fnzeee.homeip.net:3001/api/lists/1738755373025723596/cards
```

Or add manually in Planka UI under **Mission Control > Business Pipeline > Building**.

## Troubleshooting

### Engine fails to start
- Check config syntax: `sudo node /usr/lib/clawbox-backup/lib/api-server.js` (runs in foreground)
- Verify directories exist: `/var/lib/clawbox-backup/metadata`
- Check logs: `sudo journalctl -u clawbox-backup -n 50`

### Web UI cannot reach engine
- Ensure `BACKUP_API_URL` is set correctly in Vercel environment variables
- Verify clawbox is reachable from Vercel (public IP or via VPN/tailnet)
- Test from external: `curl http://<clawbox-ip>:18789/api/backups`

### Backup fails with disk space
- Check destination free space: `df -h`
- Adjust retention or backup scope

### USB not detected
- Ensure drive is mounted: `lsblk`
- Add mount point to config manually

## Security Notes

- The backup API has no authentication by default (runs on localhost only). If exposing externally, add reverse proxy with auth (nginx + basic auth or JWT).
- Backup files may contain sensitive data; encrypt if storing offsite.
- The systemd service runs as root; consider adding dedicated user if needed.

## Next Steps

- Configure email notifications (add webhook URL)
- Set up monitoring (Prometheus metrics endpoint planned)
- Add cloud destinations (Dropbox access token in config)
- Customize backup schedules as needed
- Test restore on non-critical data first

Enjoy your automated backups!