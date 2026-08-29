#!/usr/bin/env bash
#
# Regenerate build/icon.icns, build/icon.ico and build/icon.png from the SVG
# sources in this folder. electron-builder reads those three by name out of
# `directories.buildResources` (build/), so run this after editing any source.
#
#   ./build-icons.sh
#
# Requires rsvg-convert (brew install librsvg) and python3. .icns additionally
# needs iconutil, which is macOS-only.

set -euo pipefail
cd "$(dirname "$0")"
DEST="$(cd .. && pwd)"

command -v rsvg-convert >/dev/null 2>&1 || {
  echo "error: rsvg-convert not found. Install it with: brew install librsvg" >&2; exit 1; }

tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT
render() { rsvg-convert -w "$2" -h "$2" "$1" -o "$3"; }

echo "==> icon.icns"
set="$tmp/icon.iconset"; mkdir -p "$set"
# 16pt and 32pt slots use the heavier art; 64px and up use the full art.
render icon-macos-small.svg   16 "$set/icon_16x16.png"
render icon-macos-small.svg   32 "$set/icon_16x16@2x.png"
render icon-macos-small.svg   32 "$set/icon_32x32.png"
render icon-macos.svg         64 "$set/icon_32x32@2x.png"
render icon-macos.svg        128 "$set/icon_128x128.png"
render icon-macos.svg        256 "$set/icon_128x128@2x.png"
render icon-macos.svg        256 "$set/icon_256x256.png"
render icon-macos.svg        512 "$set/icon_256x256@2x.png"
render icon-macos.svg        512 "$set/icon_512x512.png"
render icon-macos.svg       1024 "$set/icon_512x512@2x.png"
if command -v iconutil >/dev/null 2>&1; then
  iconutil -c icns "$set" -o "$DEST/icon.icns"
else
  echo "    skipped (iconutil is macOS-only)"
fi

echo "==> icon.ico"
for s in 16 24 32; do render icon-windows-small.svg "$s" "$tmp/w-$s.png"; done
for s in 48 64 128 256; do render icon-windows.svg "$s" "$tmp/w-$s.png"; done
python3 pack-ico.py "$DEST/icon.ico" "$tmp"/w-*.png

echo "==> icon.png"
render icon.svg 512 "$DEST/icon.png"

echo
echo "Done: $DEST/icon.icns, icon.ico, icon.png"
