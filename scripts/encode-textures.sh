#!/bin/sh
# Encode authored or scanned surface images to KTX2 (Basis Universal).
#   sh scripts/encode-textures.sh [source-dir] [output-dir]
# With no arguments it encodes public/textures/habitat in place, which is what
# `npm run textures` does after regenerating the assets/blender/build_habitat.py
# outputs. scripts/ground-textures.sh stages the scanned ground sets and calls
# this with their directory and public/textures/ground.
# Needs `basisu` (Homebrew: brew install basis_universal). Sources are PNG or JPG
# named <family>-color, -normal, -roughness or -arm. Colour maps are ETC1S in
# sRGB; roughness and ARM (ambient occlusion, roughness, metalness) are ETC1S
# linear; normals are UASTC linear so their vectors survive compression. All
# get a full mip chain.
set -eu
root="$(cd "$(dirname "$0")/.." && pwd)"
src="${1:-$root/public/textures/habitat}"
out="${2:-$src}"
mkdir -p "$out"
found=0
for image in "$src"/*.png "$src"/*.jpg; do
  [ -f "$image" ] || continue
  found=1
  name="$(basename "$image")"
  stem="${name%.*}"
  target="$out/$stem.ktx2"
  case "$stem" in
    *-color)           basisu -ktx2 -mipmap -q 200 -comp_level 2 -output_file "$target" "$image" >/dev/null ;;
    *-roughness|*-arm) basisu -ktx2 -mipmap -linear -q 160 -comp_level 2 -output_file "$target" "$image" >/dev/null ;;
    *-normal)          basisu -ktx2 -uastc -uastc_level 2 -uastc_rdo_l 0.75 -mipmap -linear -output_file "$target" "$image" >/dev/null ;;
    *) echo "unexpected texture $name" >&2; exit 1 ;;
  esac
  printf '%s -> %s (%s bytes)\n' "$name" "$target" "$(wc -c < "$target" | tr -d ' ')"
done
[ "$found" = 1 ] || { echo "no PNG or JPG sources in $src" >&2; exit 1; }
