# Release Studio CLI recordings

These JSON files are deterministic, scrubbed test inputs for environments that
do not have `kicad-cli`. They describe the focused board/schematic and jobset
commands used by R0. `<fixture>` and `<output>` are placeholders; recordings
never contain a machine path, timestamp, secret, or generated output directory.

The records are normalized around successful KiCad `10.0.4` invocations. A
live test still executes the real command through the shared test seam when the
pinned Release Studio executor is present.

`synthetic-build/` is a schema-2 recording made by
`app.services.kicad_tool_replay.RecordingTool`: every kicad-cli run of a whole
bundle-mode Release Studio build of the synthetic fixture, with the files each
run wrote stored by SHA-256 under `blobs/`. Paths are `<closure>` and
`<staging>` placeholders. The build reads
`fixtures/release-studio/synthetic/models.prism` (the fixture's committed
design bundle; the board and schematic come from it, extracted under
`<closure>/_bundle`). `ReplayTool` answers from it, which is how
`backend/tests/test_release_studio_replay_build.py` runs a build without KiCad.
It was recorded with the kicad-cli named in its `tool.version`; re-record after
changing a catalogue or artwork argument:

```bash
cd backend && python -m tests.test_release_studio_replay_build --record
```
