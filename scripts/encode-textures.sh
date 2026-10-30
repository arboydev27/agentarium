#!/bin/sh
# Encode the authored surface PNGs to KTX2 (Basis Universal) next to their sources.
# Run after regenerating assets/blender/build_habitat.py outputs:
#   npm run textures
# Needs `basisu` (Homebrew: brew install basis_universal). Colour maps are
# ETC1S in sRGB; roughness is ETC1S linear; normals are UASTC linear so their
# vectors survive compression. All get a full mip chain.
set -eu
cd "$(dirname "$0")/../public/textures/habitat"
for png in *.png; do
  out="${png%.png}.ktx2"
  case "$png" in
    *-color.png)     basisu -ktx2 -mipmap -q 200 -comp_level 2 -output_file "$out" "$png" >/dev/null ;;
    *-roughness.png) basisu -ktx2 -mipmap -linear -q 160 -comp_level 2 -output_file "$out" "$png" >/dev/null ;;
    *-normal.png)    basisu -ktx2 -uastc -uastc_level 2 -uastc_rdo_l 0.75 -mipmap -linear -output_file "$out" "$png" >/dev/null ;;
    *) echo "unexpected texture $png" >&2; exit 1 ;;
  esac
  printf '%s -> %s (%s bytes)\n' "$png" "$out" "$(wc -c < "$out" | tr -d ' ')"
done
