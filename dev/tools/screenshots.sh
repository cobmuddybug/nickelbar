#!/bin/bash
# Renders a screenshot of every game (with the dev harness's stand-in
# theme) into docs/screenshots/, then tiles them into gallery.png.
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
out="$ROOT/docs/screenshots"
mkdir -p "$out"
mapfile -t games < <(node -e "
const {load}=require('$ROOT/dev/tests/lib');load('engine/GamesCatalog.js').GAMES.forEach(g=>console.log(g.id))")
steps=$(printf 'w,%.0s' {1..45})
for g in "${games[@]}"; do
  "$ROOT/dev/tools/harness-run.sh" "$g" "$steps" "$out/$g.png" > /dev/null
  printf '.'
done
echo
# Crop off the harness chrome (title and help text), then tile.
files=()
for g in "${games[@]}"; do
  [ -f "$out/$g.png" ] || continue
  magick "$out/$g.png" -crop 608x600+16+48 +repage -resize 240x237 "$out/$g.thumb.png"
  files+=("$out/$g.thumb.png")
done
montage "${files[@]}" -tile 10x -geometry +4+4 -background '#101315' "$out/gallery.png"
rm -f "$out"/*.thumb.png
echo "wrote $out/gallery.png (${#files[@]} games)"
