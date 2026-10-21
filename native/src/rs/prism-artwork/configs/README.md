# Artwork configs

`assembly.json` and `testpoints.json` are Release Studio's
`backend/app/release_studio/documents/pcb-svg.config.json` and
`pcb-svg.testpoints.config.json` with one change: `schema` is
`prism.artwork.config.a0` and the `_prism` author comment is dropped, because
the contract has no field for it (`native/src/tsp/prism/artwork-a0.tsp`).
Views, layer tokens, styles, `selector_overrides` and `global.canvas` are
otherwise identical, so a tuned drawing still tunes the same way.

They are checked against the generated `ArtworkConfigA0` schema by
`tests/contract.rs`. `prism-kicad artwork --config` reads either one; the
testpoint config's `selector_overrides` (`*` off, `TP*` on) now selects the
footprints the view draws, replacing Release Studio's filtered staging board
(ADR amendment C3 §2 item 6).
