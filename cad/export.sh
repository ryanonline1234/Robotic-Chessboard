#!/usr/bin/env bash
# Exports every printed gantry part to cad/stl/<name>.stl, renders the
# pictures in docs/img/ (gantry-parts, assembly, assembly-top, section) and
# prints the assembly checks. Stops with an error if any check fails.
#
#   bash cad/export.sh                  the default build (idler_bore in params.scad)
#   IDLER_BORE=3 bash cad/export.sh     parts for separate 3 mm-bore idlers on M3 axles
#
# IDLER_BORE (3 or 5) is passed to every OpenSCAD run as -D idler_bore=...
# The files in the repo are the default 5 mm build (the belt kit's idlers on
# M5 axles). IDLER_BORE=3 overwrites cad/stl and the pictures; git checkout
# cad/stl docs/img puts them back. To export only the two parts that change,
# see "Using 3 mm idlers" in cad/README.md.
#
# Needs OpenSCAD 2021.01 or newer. Set OPENSCAD=/path/to/openscad if it is
# not on your PATH. On a Linux machine without a screen, run the whole
# script inside a virtual display: xvfb-run -a bash cad/export.sh
# Pictures are OpenSCAD previews (they keep the colours). The section takes
# a minute or two because it slices every part.
set -euo pipefail
cd "$(dirname "$0")"
OPENSCAD="${OPENSCAD:-openscad}"
IMG=../docs/img
mkdir -p stl "$IMG"

# -D idler_bore=... for every run, or nothing to keep the value in params.scad
bore=()
if [ -n "${IDLER_BORE:-}" ]; then
  case "$IDLER_BORE" in
    3 | 5) bore=(-D "idler_bore=$IDLER_BORE") ;;
    *)
      echo "IDLER_BORE must be 3 or 5, not '$IDLER_BORE'" >&2
      exit 1
      ;;
  esac
  echo "idler_bore = $IDLER_BORE"
fi
# (written this way so an empty list works with set -u in bash 3.2, as on macOS)
scad() {
  "$OPENSCAD" ${bore[@]+"${bore[@]}"} "$@"
}

parts=(y-rod-holder end-block-motor end-block-idler x-motor-mount carriage
  y-motor-mount y-idler-mount belt-clamp x-endstop-mount y-endstop-mount)
for p in "${parts[@]}"; do
  echo "stl  cad/stl/$p.stl"
  scad -q -o "stl/$p.stl" -D "part=\"$p\"" gantry-parts.scad
done

png() {
  local out=$1
  shift
  echo "png  docs/img/$out"
  scad -q -o "$IMG/$out" --colorscheme=Tomorrow "$@"
}

png gantry-parts.png --imgsize=1400,1000 --projection=o --camera=378,-314,517,125,130,0 \
  -D show_names=true gantry-parts.scad
png assembly.png --imgsize=1400,1000 --camera=-445,-700,700,285,235,0 \
  -D top_alpha=0.12 -D sheet_alpha=0.28 -D cell_x=6 -D cell_y=5 assembly.scad
png assembly-top.png --imgsize=1400,1180 --projection=o --camera=300,249.9,1360,300,250,0 \
  -D 'view="top"' -D labels=true -D 'walls="all"' -D top_alpha=0.12 -D sheet_alpha=0.45 \
  -D cell_x=0 -D cell_y=0 assembly.scad
png section.png --imgsize=1400,600 --projection=o --camera=291,28,27,0,28,27 \
  -D 'view="section"' -D labels=true -D top_alpha=1 -D cell_x=4 -D cell_y=3 assembly.scad

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
# (no -q here: it also silences the echo() output this step needs)
scad -o "$tmp/checks.echo" assembly.scad 2> "$tmp/log.txt"
if ! grep -q 'CHECK' "$tmp/checks.echo"; then
  echo "No check output from assembly.scad:" >&2
  cat "$tmp/checks.echo" "$tmp/log.txt" >&2
  exit 1
fi
grep -E 'CHECK|SIZE' "$tmp/checks.echo" | sed -e 's/^ECHO: "//' -e 's/"$//'
if grep -q 'FAIL' "$tmp/checks.echo"; then
  echo "A check failed." >&2
  exit 1
fi
