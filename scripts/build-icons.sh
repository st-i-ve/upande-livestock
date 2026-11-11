#!/usr/bin/env bash
# App icon, Android adaptive icon, splash and favicon from the Livestock cow
# mark in the upande_livestock backend repo (design/logo/, see its README).
#   scripts/build-icons.sh /path/to/apps/upande_livestock
# Needs rsvg-convert and ImageMagick. Changing these is a native change: the
# next release builds an APK.
set -euo pipefail
repo="${1:?usage: scripts/build-icons.sh <upande_livestock repo>}"
out="$(cd "$(dirname "$0")/.." && pwd)/assets/images"
tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT
INK="#45433f"

# The cow on her grass, in the mark's grey and in black (Android's monochrome layer).
sed "s/currentColor/$INK/" "$repo/design/logo/livestock_cow.svg" > "$tmp/cow.svg"
sed "s/currentColor/#000000/; s/#6a9a4c/#000000/" "$repo/design/logo/livestock_cow.svg" > "$tmp/cow-mono.svg"

# Store / iOS icon: white square (no transparency), the cow 76% wide.
rsvg-convert -w 780 "$tmp/cow.svg" -o "$tmp/cow-780.png"
convert -size 1024x1024 xc:white "$tmp/cow-780.png" -gravity center -compose over -composite \
  -alpha off "$out/livestock-icon.png"

# Android adaptive foreground: the launcher masks to the middle 66%, so the cow keeps to 58%.
rsvg-convert -w 600 "$tmp/cow.svg" -o "$tmp/cow-600.png"
convert -size 1024x1024 xc:none "$tmp/cow-600.png" -gravity center -compose over -composite \
  "$out/livestock-adaptive-foreground.png"
rsvg-convert -w 600 "$tmp/cow-mono.svg" -o "$tmp/cow-mono-600.png"
convert -size 1024x1024 xc:none "$tmp/cow-mono-600.png" -gravity center -compose over -composite \
  "$out/livestock-adaptive-monochrome.png"

# Splash and login fallback: the white disc with the cow (reads on light and dark).
rsvg-convert -w 1024 -h 1024 "$repo/design/logo/livestock_cow_mark.svg" -o "$out/livestock-splash.png"
rsvg-convert -w 48 -h 48 "$repo/design/logo/livestock_cow_mark.svg" -o "$out/favicon.png"
echo "wrote icon, adaptive icon, splash and favicon to $out"
