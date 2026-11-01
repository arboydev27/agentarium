#!/bin/sh
# Fetch the scanned ground sets and encode them to KTX2.
#   sh scripts/ground-textures.sh            # fetch what is missing, stage, encode
#   sh scripts/ground-textures.sh --encode   # no network: encode the sources on disk
# The sets are CC0 1K scans from Poly Haven (public/textures/LICENSE.md is the
# record). Each lands once in assets/textures/ground/<set-id>/ (gitignored) and
# is checked against the SHA-256 below before use; the sums were taken from
# files whose MD5 matched the Poly Haven API's published values on 2026-10-31.
# A set contributes a colour map (JPG), an OpenGL-convention normal map (16-bit
# PNG, so no JPEG noise reaches the UASTC encode) and an ARM map (JPG: ambient
# occlusion, roughness, metalness). They are staged as <layer>-color.jpg,
# <layer>-normal.png and <layer>-arm.jpg, which scripts/encode-textures.sh
# turns into public/textures/ground/<layer>-{color,normal,arm}.ktx2. The layer
# a set serves, its tile size and its mean colour live in src/world/groundSets.ts.
# Needs curl, shasum and basisu (Homebrew: brew install basis_universal).
set -eu
root="$(cd "$(dirname "$0")/.." && pwd)"
sources="$root/assets/textures/ground"
stage="$sources/.stage"
out="$root/public/textures/ground"
fetch=1
[ "${1:-}" = "--encode" ] && fetch=0

sha256() { shasum -a 256 "$1" | cut -d' ' -f1; }

# layer map set-id file sha256
manifest='
sand   color  sandy_gravel_02          sandy_gravel_02_diff_1k.jpg            c9d143db07db9a6be2eba285fae961d868520422ee5fa4d38d55da24f9968d51
sand   normal sandy_gravel_02          sandy_gravel_02_nor_gl_1k.png          63e9d88fb9f445a23de7bc1ff58a56c2db9af9114d7e3c0b37bf0d997273a6e8
sand   arm    sandy_gravel_02          sandy_gravel_02_arm_1k.jpg             c10a20b5736bf1785f12f1c6744d80450b98bf0ea8cb7128acb78df39688838f
gravel color  red_laterite_soil_stones red_laterite_soil_stones_diff_1k.jpg   949cd648409b30e2267d89066965605d22dba4ce73d601673e155046c41e1219
gravel normal red_laterite_soil_stones red_laterite_soil_stones_nor_gl_1k.png 7cc7f835a3242574e085bfd948234d025fe81714cfda110d57456a914bae66a9
gravel arm    red_laterite_soil_stones red_laterite_soil_stones_arm_1k.jpg    74e2cbc1caf978746153738e9fe7310a522376689ffc14966b3008b3cf603549
basalt color  rock_boulder_dry         rock_boulder_dry_diff_1k.jpg           20f653a42fb24f42aa40641663070d578678da49af18cc1049dbdd4ed8679f3c
basalt normal rock_boulder_dry         rock_boulder_dry_nor_gl_1k.png         7ae21a2702d613d9d3eedcfb8b42d212b69302c07e2c4fd94ecaa91d52e9345b
basalt arm    rock_boulder_dry         rock_boulder_dry_arm_1k.jpg            350d01c63afc01cd9bcb9bc47afdd24292198ff1c5fcef1c49281c1b85dc2872
'

rm -rf "$stage"
mkdir -p "$stage" "$out"
printf '%s\n' "$manifest" | while read -r layer map id file sum; do
  [ -n "$layer" ] || continue
  path="$sources/$id/$file"
  kind="${file##*.}"
  url="https://dl.polyhaven.org/file/ph-assets/Textures/$kind/1k/$id/$file"
  if [ ! -f "$path" ] || [ "$(sha256 "$path")" != "$sum" ]; then
    [ "$fetch" = 1 ] || { echo "missing or changed source: $path" >&2; exit 1; }
    mkdir -p "$sources/$id"
    echo "fetching $url"
    curl -fsSL --retry 3 -o "$path" "$url"
  fi
  [ "$(sha256 "$path")" = "$sum" ] || { echo "checksum mismatch: $path" >&2; exit 1; }
  cp "$path" "$stage/$layer-$map.$kind"
done
sh "$root/scripts/encode-textures.sh" "$stage" "$out"
rm -rf "$stage"
