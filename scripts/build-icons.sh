#!/usr/bin/env bash
# The app icon, Android adaptive foreground and splash are SCP's own Upande logo files,
# copied as they are (assets/images/upande_logo.png, the arrow on white, and
# upande_logo_no_bg.png, the arrow alone), so every Upande app shows the same icon.
# This script makes the rest from the upande_livestock backend repo's design/logo/:
# Android's monochrome (themed) layer, the arrow alone in black; and the favicon.
#   scripts/build-icons.sh /path/to/apps/upande_livestock
# Needs rsvg-convert and ImageMagick. Changing these is a native change: the
# next release builds an APK.
set -euo pipefail
repo="${1:?usage: scripts/build-icons.sh <upande_livestock repo>}"
out="$(cd "$(dirname "$0")/.." && pwd)/assets/images"
tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT

sed -E 's/fill="#[0-9a-fA-F]{6}"/fill="#000000"/g' "$repo/design/logo/upande_arrow.svg" > "$tmp/arrow-mono.svg"
rsvg-convert -w 676 -h 676 "$tmp/arrow-mono.svg" -o "$tmp/arrow-mono-676.png"
convert -size 1024x1024 xc:none "$tmp/arrow-mono-676.png" -gravity center -compose over -composite \
  "$out/livestock-adaptive-monochrome.png"
convert "$out/upande_logo_no_bg.png" -resize 48x48 "$out/favicon.png"
echo "wrote the monochrome icon and favicon to $out"
