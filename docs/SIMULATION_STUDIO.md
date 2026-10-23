# Simulation Studio (experimental)

Simulation Studio runs board-level simulations on a project revision's
[design data](PROJECT_WORKFLOWS.md#design-data). The first analysis is **DC IR
drop**: given a power tree (sources, converters, rails and loads), it solves the
copper's voltage drop and current density and draws the result on the board.

It is experimental and **off by default**. Its contracts and engines live in the
separate `prism-sim-studio` project; Prism hosts the setup UI, the run queue and
the result viewer.

## Enable it

1. Build the image with the engines. `backend/sim-engines.lock.json` pins a
   `prism-sim-studio` release by tag and sha256 per platform. The release is
   private, so set `PRISM_SIM_RELEASE_TOKEN` in `.env` to a GitHub token that
   can read its releases; Compose passes it to the build as the BuildKit secret
   `prism_sim_release_token`, never into the image. Without it the image builds
   without engines and Simulation Studio cannot run ([Dependencies](DEPENDENCIES.md#native-rust-ownership)).
2. Set `PRISM_SIM_STUDIO_ENABLED=true` for the backend and the prism worker.
   While it is unset, every `/api/.../sim/a0/...` route answers 404 and the
   project navigation shows no Simulation Studio entry.

| Setting | Purpose |
| --- | --- |
| `PRISM_SIM_STUDIO_ENABLED` | turns the tab and its routes on (default `false`) |
| `PRISM_SIM_BIN_DIR` | where the engines are installed (default `/opt/prism-sim/bin`, where the image puts them) |
| `PRISM_SIM_ENGINE` | preferred engine id for a run (default `dc-drop-grid`) |
| `PRISM_SIM_CONCURRENCY` | simulation runs one worker executes at once (default 1) |
| `PRISM_SIM_TIMEOUT_SECONDS` | longest an engine may run (default 3600) |
| `PRISM_SIM_SUCCEEDED_RUNS_KEPT` | succeeded runs kept per setup, newest first (default 3); failed and cancelled runs are deleted except a setup's latest |
| `PRISM_SIM_MESHES_KEPT` | engine meshes kept per project for re-runs that change only values (default 4); a mesh is tens of megabytes on a large board |

## Use it

Open a project and choose **Simulation Studio**.

- **Setup.** Create a setup for a revision. Prism infers a starting power tree
  from the design; add or edit sources, converters (with efficiency), rails,
  loads (with current) and probes, and arrange them. Prism validates the setup
  and pre-flights it against the revision's board as you edit, and lists any
  problems.
- **Run.** **Run** queues a `sim_run` job on the prism worker. The revision's
  design data must be ready: a run on a revision whose data is still being
  prepared fails with a message to run again when it is ready.
- **Results.** The run's voltage and current overlays are drawn on the
  analytic board, with the run's setup and files kept beside it.

Viewers can read setups and results. Designers can create, edit and submit
setups. Edits are guarded by ETags, so two editors cannot overwrite each other.

### Script API

While the tab is open, `window.prismSimStudio` exposes the same operations as
the UI, with the signed-in session:

```js
const s = await prismSimStudio.newSetup("Max load", { seed: "inferred" });
await prismSimStudio.updateElement(s.setup_id, "load:u1-0v9", { values: { current_a: 3 } });
await prismSimStudio.validate(s.setup_id);
await prismSimStudio.preflight(s.setup_id);
await prismSimStudio.submit(s.setup_id);
```

Elements are named `kind:id` (`rail:3v3`, `converter:u3-3v3`, `load:u1-0v9`,
`source:j1-20v0`). `frontend/src/components/sim-studio/script-api.ts` documents
every call.

## Storage

Runs live under `KICAD_PROJECTS_ROOT/.kicad-prism/sim/`: `runs/<run id>/` holds
the run's input bundle (a hard link to the design bundle it ran on) and the
engine's output, and `meshes/<project>/` holds the engine meshes kept for
re-runs. The catalog worker's daily artifact maintenance applies the retention
settings above, and keeps doing so after the Studio is disabled while its runs
are on disk. Setups and run records are in the `workspace` schema (migrations
m120–m122 and m130).
