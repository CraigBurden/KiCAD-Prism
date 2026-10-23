#!/bin/sh
# Write KiCad's reference outputs for the oracle board (KiCad 10.0.6 kicad-cli).
# Usage: export.sh <board dir> <out dir>
set -eu
board="$1/oracle.kicad_pcb"
out="$2"
mkdir -p "$out"
kicad-cli pcb export drill --format excellon --excellon-units mm --excellon-zeros-format decimal \
    --excellon-oval-format route --excellon-separate-th -o "$out/" "$board" >/dev/null
kicad-cli pcb export pos --format csv --units mm --side both -o "$out/pos.csv" "$board" >/dev/null
kicad-cli pcb export ipcd356 -o "$out/oracle.d356" "$board" >/dev/null
kicad-cli pcb export gerbers --layers F.Cu,In1.Cu,In2.Cu,B.Cu,Edge.Cuts \
    --no-x2 --no-netlist --no-protel-ext -o "$out/" "$board" >/dev/null
rm -f "$out"/*.gbrjob
ls "$out"
