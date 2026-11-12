#!/usr/bin/env bash
# App icon, Android adaptive icon, splash and favicon: the Upande mark, exactly the Livestock
# desk tile at rest (the white disc and the Upande arrow; on the desk the cow scene plays on
# hover and the tile comes back to this mark). From the upande_livestock backend repo's
# design/logo/ (upande_mark_disc.svg, upande_arrow.svg; see its README).
#   scripts/build-icons.sh /path/to/apps/upande_livestock
# Needs rsvg-convert and ImageMagick. Changing these is a native change: the
# next release builds an APK.
set -euo pipefail
repo="${1:?usage: scripts/build-icons.sh <upande_livestock repo>}"
out="$(cd "$(dirname "$0")/.." && pwd)/assets/images"
tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT
disc="$repo/design/logo/upande_mark_disc.svg"

# The arrow alone in black, for Android's monochrome (themed) layer.
sed -E 's/fill="#[0-9a-fA-F]{6}"/fill="#000000"/g' "$repo/design/logo/upande_arrow.svg" > "$tmp/arrow-mono.svg"

# Store / iOS icon: the tile at rest on white (no transparency): the disc's thin rim and the arrow.
rsvg-convert -w 1024 -h 1024 -b white "$disc" -o "$tmp/disc.png"
convert "$tmp/disc.png" -alpha off "$out/livestock-icon.png"

# Android adaptive foreground: the launcher masks to the middle 66% (a circle on most phones),
# which stands in for the disc, so the 689 canvas is drawn 66% wide and the arrow keeps the
# size and place it has on the tile; the background layer is white (app.json).
rsvg-convert -w 676 -h 676 "$repo/design/logo/upande_arrow.svg" -o "$tmp/arrow-676.png"
convert -size 1024x1024 xc:none "$tmp/arrow-676.png" -gravity center -compose over -composite \
  "$out/livestock-adaptive-foreground.png"
rsvg-convert -w 676 -h 676 "$tmp/arrow-mono.svg" -o "$tmp/arrow-mono-676.png"
convert -size 1024x1024 xc:none "$tmp/arrow-mono-676.png" -gravity center -compose over -composite \
  "$out/livestock-adaptive-monochrome.png"

# Splash: the tile at rest, the white disc with the arrow (reads on light and dark).
rsvg-convert -w 1024 -h 1024 "$disc" -o "$out/livestock-splash.png"
# Favicon: the same mark, small.
rsvg-convert -w 48 -h 48 "$disc" -o "$out/favicon.png"
echo "wrote icon, adaptive icon, splash and favicon to $out"
