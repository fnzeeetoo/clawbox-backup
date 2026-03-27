# Testing Guide

After installation, verify the system works end-to-end.

## Prerequisites
- `npm run install:system` completed successfully
- Both services running: `clawbox-backup` and `clawbox-backup-ui`

## 1. Check Services

```bash
sudo systemctl status clawbox-backup
sudo systemctl status clawbox-backup-ui
```

Both should show `active (running)`.

## 2. Check API Health

```bash
curl -s http://localhost:18789/api/backups | python3 -m json.tool
```

Expected: JSON array (empty `[]` if no backups yet).

## 3. Access Web UI

Open in browser: **http://localhost:3000**

You should see the Clawbox Backup dashboard.

## 4. Create a Test Backup via UI

1. Go to **Configure** → **Sources**
   - Default source: `openclaw-workspace` (path: `/home/clawbox/.openclaw/workspace`)
2. Go to **Configure** → **Destinations**
   - Default: `local-backup` (path: `/var/backups/clawbox`)
3. Go to **Dashboard** → Click **Run Backup** (if you added a manual button) or wait for next scheduled run
   - Alternatively, trigger via CLI (see below)
4. Watch the backup appear in **Dashboard** → Recent Backups
5. Click on the backup card and verify **Restore** option is available

## 5. Trigger Manual Backup via CLI

```bash
sudo /usr/lib/clawbox-backup/scripts/backup-runner.js --source openclaw-workspace --destination local-backup --type full
```

Expected output: Progress logs, then "✅ Backup completed successfully".

Then refresh the UI dashboard; the new backup should appear.

## 6. Verify Backup File

```bash
ls -lh /var/backups/clawbox/
```

You should see a `.tar.gz` file (full backup) or directory (incremental).

## 7. Test Restore (to temporary location)

From the UI:
- Select the backup you just created
- Set restore target to `/tmp/restore-test`
- Click **Start Restore**

Then verify files:

```bash
ls /tmp/restore-test
```

You should see the restored contents.

## 8. Check Logs

```bash
# Engine logs
sudo journalctl -u clawbox-backup -f

# UI logs
sudo journalctl -u clawbox-backup-ui -f
```

Look for errors or unexpected behavior.

## 9. File Monitoring (Optional)

If you enabled monitoring in config, changes to watched directories should appear in engine logs.

Create a test file:

```bash
echo "test" >> /home/clawbox/.openclaw/workspace/test.txt
```

Within a few seconds, the engine logs should show a file change event.

## 10. Cleanup Test Restore

After verifying restore works:

```bash
sudo rm -rf /tmp/restore-test
sudo rm -rf /var/backups/clawbox/clawbox-backup-openclaw-workspace-full-*
# (adjust pattern to match your test backup names)
```

---

## Expected Network Behavior

- UI → API calls to `http://localhost:18789` (same host)
- No external network required except for optional cloud destinations (Dropbox)

## Troubleshooting

| Symptom | Check |
|---------|-------|
| UI not loading | `systemctl status clawbox-backup-ui`, port 3000 in use? |
| API errors | `systemctl status clawbox-backup`, check `/var/lib/clawbox-backup/metadata/` exists, config syntax |
| Backup fails (disk space) | `df -h` on destination (`/var/backups`) |
| Permissions errors | Service runs as root; should read source paths. If source is in `/home/clawbox`, ensure readable. |
| Restore fails | Destination path exists and is writable; sufficient space |

---

Run through these steps and report any issues. The system is designed to be self-healing; most errors are logged with actionable messages.