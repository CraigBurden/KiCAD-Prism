# `models/assembly-hlr.json` divergences (C3 chunk D)

Checked by `parity/hlr/compare_hlr.py` against today's Cruncher projections
(`goldens/<case>/assembly-hlr.today.json`, from `parity/hlr/capture_hlr.py`),
not by the runner.

## H1: detail edges follow the pinned Geometer runtime (2026.9.19)

- **Today:** Cruncher 2026.9.7 projects through wn-geometer **2026.9.7**.
- **Bundle:** `prism-kicad` runs the runtime the vendored `geometer-client`
  accepts, **2026.9.19** (amendment C3 §2 item 4, `hlr_procedure` in the
  generator id; first pinned at 2026.9.13 and upgraded to the latest release
  on 2026-10-21, with identical results on both).
- **Difference:** outline edges are identical. The 2026.9.13 and 2026.9.19 runtimes return
  different *detail* (visible internal) edges for some models: on `rs-usb-pd`
  35 of 36 footprints (for example the stock `R_0603_1608Metric.step`: 18
  detail segments against 66), on `rs-cynthion` 1 of the 2 projected
  footprints. Model bytes, poses and footprint statuses are equal.
- **Why the bundle is right:** the producer is not the cause. Today's Cruncher
  run on the pinned runtime gives exactly the member (every footprint,
  every edge set, max deviation 0 mm, with `KICAD6/9/10_3DMODEL_DIR` all
  given), which `compare_hlr.py` checks on every run. The runtime is pinned by
  the amendment, so today's 2026.9.7 output cannot be reproduced without
  un-pinning it.
- **Consumer:** the assembly artwork (chunk E) draws detail edges; part bodies
  look different where the runtime changed them. Covered by amendment C3's
  dossier divergence `rs-1` and the visual check of §4.
- **Fixtures:** `rs-usb-pd`, `rs-cynthion`.

## Model library variables

A footprint naming `${KICAD<major>_3DMODEL_DIR}` that no `--model-dir` gives
resolves through the newest stock library given, as kicad_monkey's model
search and KiCad do for a project saved by an older major. `rs-usb-pd`'s
passives name `${KICAD9_3DMODEL_DIR}`; the image provides only
`KICAD10_3DMODEL_DIR`. Not a divergence: today's Cruncher resolves them the
same way.
