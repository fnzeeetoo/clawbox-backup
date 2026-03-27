#!/usr/bin/env bash

# Rollback script for Clawbox Backup installation
# WARNING: This will remove installed components and stop services.
# Run with: sudo ./scripts/rollback.sh

set -e

readonly SCRIPT_NAME="$(basename "$0")"

usage() {
  echo "Usage: sudo $SCRIPT_NAME [--keep-data]"
  echo "  --keep-data   Preserve /var/lib/clawbox-backup (backup metadata) but remove services and configs"
  echo "  Without flags: full uninstall (services, files, config, state)"
  exit 1
}

KEEP_DATA=0

if [ "$#" -gt 0 ]; then
  case "$1" in
    --keep-data) KEEP_DATA=1 ;;
    -h|--help) usage ;;
    *) usage ;;
  esac
fi

echo "=== Clawbox Backup Rollback ==="
echo ""
echo "This will:"
echo "  1. Stop and disable services"
echo "  2. Remove systemd service files"
echo "  3. Remove installed files from /usr/lib/clawbox-backup"
echo "  4. Remove configuration from /etc/clawbox-backup"
if [ $KEEP_DATA -eq 0 ]; then
  echo "  5. Remove state from /var/lib/clawbox-backup"
else
  echo "  5. KEEP backup metadata in /var/lib/clawbox-backup"
fi
echo ""
read -p "Are you sure? (type 'yes' to confirm): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
  echo "Aborted."
  exit 1
fi

# Stop services
echo "Stopping services..."
systemctl stop clawbox-backup || true
systemctl stop clawbox-backup-ui || true

# Disable services
echo "Disabling services..."
systemctl disable clawbox-backup || true
systemctl disable clawbox-backup-ui || true

# Remove service files
echo "Removing systemd service files..."
rm -f /etc/systemd/system/clawbox-backup.service
rm -f /etc/systemd/system/clawbox-backup-ui.service
systemctl daemon-reload

# Remove installed files
echo "Removing /usr/lib/clawbox-backup..."
rm -rf /usr/lib/clawbox-backup

# Remove config
echo "Removing /etc/clawbox-backup..."
rm -rf /etc/clawbox-backup

# Remove state (unless --keep-data)
if [ $KEEP_DATA -eq 0 ]; then
  echo "Removing /var/lib/clawbox-backup..."
  rm -rf /var/lib/clawbox-backup
else
  echo "Preserving /var/lib/clawbox-backup (metadata retained)"
fi

echo ""
echo "Rollback complete."
echo "If you want to reinstall, run: sudo npm run install:system"