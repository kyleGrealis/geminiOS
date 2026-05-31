#!/usr/bin/env bash
# scripts/link-systemd.sh
# Links deploy/systemd/geminios.service into ~/.config/systemd/user/

set -euo pipefail

SYSTEMD_DIR="$HOME/.config/systemd/user"
mkdir -p "$SYSTEMD_DIR"

TARGET="$SYSTEMD_DIR/geminios.service"

if [ -e "$TARGET" ] || [ -L "$TARGET" ]; then
  echo "Trashing existing service file or symlink: $TARGET"
  trash-put "$TARGET"
fi

echo "Creating symlink to deploy/systemd/geminios.service..."
ln -s "$(pwd)/deploy/systemd/geminios.service" "$TARGET"

echo "Reloading systemd daemon..."
systemctl --user daemon-reload

echo "Done! You can start the service with: systemctl --user start geminios"
