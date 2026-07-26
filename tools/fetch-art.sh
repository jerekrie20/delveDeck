#!/usr/bin/env bash
# One-time asset tool: download finished PixelLab results into public/.
#
# Generated assets auto-delete after a few hours, so anything approved gets
# pulled down promptly. Usage:
#
#   tools/fetch-art.sh <kind> <dest-dir> <name>:<id> [<name>:<id> ...]
#
# <kind> is "images" for create_image results (card art, backdrops) or
# "map-objects" for create_map_object results (portraits, icons) — they live on
# different endpoints.
#
#   tools/fetch-art.sh images public/cards strike:3c16808b-...
#
# The one thing you must not break: verify each file really is a PNG before it
# lands in public/ — a silent HTML error page written to strike.png would only
# show up as a broken image in the client.
set -euo pipefail

kind="$1"; shift
dest="$1"; shift
mkdir -p "$dest"

case "$kind" in
  images|map-objects) ;;
  *) echo "kind must be 'images' or 'map-objects', got '$kind'" >&2; exit 2 ;;
esac

for pair in "$@"; do
  name="${pair%%:*}"
  id="${pair#*:}"
  out="$dest/$name.png"
  code=$(curl -sL -o "$out" -w '%{http_code}' \
    "https://api.pixellab.ai/mcp/$kind/$id/download")
  if [ "$code" != "200" ]; then
    echo "FAIL $name: HTTP $code" >&2
    rm -f "$out"
    exit 1
  fi
  if [ "$(head -c 4 "$out" | od -An -tx1 | tr -d ' \n')" != "89504e47" ]; then
    echo "FAIL $name: not a PNG" >&2
    rm -f "$out"
    exit 1
  fi
  echo "ok $name  $(wc -c < "$out") bytes"
done
