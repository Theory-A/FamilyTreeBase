#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: scripts/export-public.sh /absolute/path/to/public-copy"
  exit 1
fi

TARGET_DIR="$1"
SOURCE_DIR="$(pwd)"

mkdir -p "$TARGET_DIR"

rsync -av \
  --delete \
  --exclude='.git/' \
  --exclude='.next/' \
  --exclude='node_modules/' \
  --exclude='.env.local' \
  --exclude='public/backup.json' \
  --exclude='.DS_Store' \
  --exclude='*.log' \
  "$SOURCE_DIR/" "$TARGET_DIR/"

echo "Public export created at: $TARGET_DIR"
echo "Review excluded sensitive files before publishing."
