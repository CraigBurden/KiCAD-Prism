# React Doctor findings — KiCAD-Prism frontend

React Doctor v0.9.12, full scan of `frontend/`, run 2026-08-22. This document is the findings breakdown only; the remediation plan is separate.

## Current remediation status (2026-08-23)

A fresh complete React Doctor v0.9.12 scan analyzed all 244 frontend files with
no skipped checks. The dependency refresh baseline was 260 findings: 14 errors
and 246 warnings across 77 files. The first remediation batch now reports:

| | Before | Current | Change |
| --- | ---: | ---: | ---: |
| Errors | 14 | **0** | -14 |
| Warnings | 246 | **217** | -29 |
| Total findings | 260 | **217** | -43 |
| Affected files | 77 | **68** | -9 |

The current report contains no accessibility or security findings. It also has
no render-time ref mutations and no unguarded state writes after an `await` in
an effect. The remaining report is warning-only: 85 bug-pattern warnings, 76
performance warnings, and 56 maintainability warnings. Its largest structural
groups are prop-driven state adjustment (60), combined array iterations (30),
linear collection lookups (19), large components (18), and mixed component/non-
component exports (17).

This batch deliberately addressed correctness and accessibility before broad
component decomposition or mechanical performance rewrites. The detailed
2026-08-22 baseline below remains useful as the issue inventory; line numbers
and counts in that baseline are historical unless the current status above says
otherwise.

## How it was run

```bash
react-doctor ./frontend -y --no-telemetry --verbose
```

(run from a local install of `react-doctor@0.9.12`, not `npx` — see the environment note below)

- **Scope:** `frontend/` — the only React project in the repo. `kicad-prism-viewer/` is a plain-JS esbuild package and was not scanned.
- **Files analyzed:** 239 of 239 scanned. Lint, dead-code, and supply-chain checks all completed (`skippedChecks: []`).
- **Exclusions:** `frontend/doctor.config.ts` ignores everything under `public/` **except `public/ecad-viewer.js`**, which is maintained code vendored from our ecad-viewer fork:

  ```ts
  ignore: { files: ["public/!(ecad-viewer.js)", "public/*/**"] }
  ```

  Verified against the report: the only `public/` path with a finding is `public/ecad-viewer.js` (see RD-20).

> **Environment note.** A plain `npx react-doctor` run silently skips linting on this machine — the npx cache is missing the `@oxlint/binding-darwin-arm64` native binding, and the failure only shows up as `skippedChecks: ["lint"]` inside the JSON report. That run reported 7 findings instead of 303. Install `react-doctor` as a real dependency (or clear the npx cache) before trusting a run, and check `skippedChecks` in the JSON output.

## Summary

| | Count |
| --- | --- |
| Errors | 22 |
| Warnings | 281 |
| **Total findings** | **303** |
| Affected files | 84 |
| Distinct rules fired | 51 |
| Fixable issues below | 33 |

By category:

| Category | Findings |
| --- | --- |
| Bugs | 139 |
| Performance | 77 |
| Maintainability | 58 |
| Accessibility | 21 |
| Security | 8 |

### Where the findings live

Five files carry 107 of the 303 findings (35%). They are the same files that show up in RD-02, RD-04, RD-25, and RD-33 — fixing them structurally clears findings across several issues at once.

| File | Findings |
| --- | --- |
| `src/components/visualizer.tsx` | 25 |
| `src/components/workspace/library-bulk-edit-workspace.tsx` | 24 |
| `src/components/workspace/library-component-workspace.tsx` | 23 |
| `src/components/workspace/library-import-remediation-grid.tsx` | 19 |
| `src/components/design-comparison/comparison-presentation-shell.tsx` | 16 |
| `src/components/import-dialog.tsx` | 9 |
| `src/components/release-studio/ReleaseStudioPanel.tsx` | 9 |
| `src/pages/ProjectDetailPage.tsx` | 8 |
| `src/components/comment-form.tsx` | 7 |
| `src/components/command-palette.tsx` | 6 |
| `src/components/comment-panel.tsx` | 6 |
| `src/components/design-comparison/design-comparison-workspace.tsx` | 6 |

## Re-grading after verification (2026-08-22)

The priorities below grade by rule severity. An empirical verification pass (code reads
plus a StrictMode probe replicating the flagged updater pattern) re-graded the high-priority
rows; this table supersedes the per-issue priorities above.

| ID | Was | Now |
| --- | --- | --- |
| RD-01 | P0 | **P3** — every site is the deliberate latest-ref idiom; not breaking today. Revisit when migrating to React 19 `useEffectEvent`. |
| RD-02 | P0 | **P2-latent** — probe under StrictMode 18.3.1 ran the updater once (`updaterRuns=1, undoDepth=1`); no reproduction of corruption. Still worth the cheap mechanical hardening, but it is not an active defect. |
| RD-06 | 11 exposed | All sites read: only `assets-portal:140`, `documentation-browser:124`, and `auth-callback-page:13` lacked guards; the other 8 had AbortController/flag guards the rule cannot see. Fixed in Phase 1. |
| RD-07 | 2 sites | 1 — `settings-dialog:243` is a false positive (reset already sits in `finally`; the rule tripped on the abort guard). The remaining site is fixed in Phase 1. |
| RD-19 | P2/M | **False positive, closed.** Traced: `?next` only drives post-login in-app navigation (`login-page:28`, `auth-callback:50`), and both the stash path (`sameOriginNextPath`, `auth.ts:117`) and the consume path (`consumeStashedLoginNext`, `auth.ts:139`) independently enforce same-origin. An attacker-chosen `?next` can at most bounce a consenting user to another page of the same origin — no privileged action is reachable from it. |
| RD-20 | P2/S | False positive for our usage — the flagged helper generates element ids, not auth material. Fix upstream in the ecad-viewer fork or suppress scoped to this file. |
| RD-25 | 20 sites | Only `library-bulk-edit-workspace.tsx:477` plausibly matters at scale (CSV batch rows). The rest run over metadata arrays numbering in tens — won't-fix absent profile evidence. |
| RD-28 | P4/S | False positive — both functions return the URL to the caller (ownership transfer); revoking at the creation site would blank previews. The consumer (`shared.tsx`) owns revocation correctly. The rule cannot see across module boundaries. |

Post-Phase-1 live count: **297** findings with `skippedChecks: []` (from the 303 baseline).
Residuals in remediated files are owned by Phases 2–4 of `.scratch/react-doctor-remediation/plan.md`.

## Issues

Priorities: **P0** correctness errors · **P1** bugs and React anti-patterns · **P2** security · **P3** accessibility · **P4** performance · **P5** maintainability. Effort is a rough per-issue estimate: **S** under an hour, **M** a few hours, **L** a day or more.

| ID | Pri | Issue | Findings | Files | Effort |
| --- | --- | --- | --- | --- | --- |
| [RD-01](#rd-01) | P0 | Refs mutated during render | 14 | 9 | M |
| [RD-02](#rd-02) | P0 | Side effects inside state updater functions | 13 | 2 | M |
| [RD-03](#rd-03) | P0 | Effects that subscribe or start timers without cleanup | 2 | 2 | S |
| [RD-04](#rd-04) | P1 | State adjusted in an effect when a prop changes | 60 | 18 | L |
| [RD-05](#rd-05) | P1 | All state reset in an effect on a prop change | 6 | 6 | S |
| [RD-06](#rd-06) | P1 | State written after `await` in an effect without a cancellation guard | 11 | 8 | M |
| [RD-07](#rd-07) | P1 | Loading flags reset outside `finally` | 2 | 2 | S |
| [RD-08](#rd-08) | P1 | Unchecked `fetch` response body | 1 | 1 | S |
| [RD-09](#rd-09) | P1 | Array index used as a React `key` | 7 | 7 | S |
| [RD-10](#rd-10) | P1 | State mutated in place | 1 | 1 | S |
| [RD-11](#rd-11) | P1 | Props copied or mirrored into state | 3 | 3 | S |
| [RD-12](#rd-12) | P1 | Child components pushing data up through effects | 10 | 5 | M |
| [RD-13](#rd-13) | P1 | Data fetching directly inside `useEffect` | 3 | 3 | M |
| [RD-14](#rd-14) | P1 | Pointer capture with no cancellation path | 1 | 1 | S |
| [RD-15](#rd-15) | P1 | Related `useState` calls that should be one reducer | 4 | 4 | M |
| [RD-16](#rd-16) | P1 | Independent awaits run sequentially | 1 | 1 | S |
| [RD-17](#rd-17) | P2 | `window.open` without `noopener` | 3 | 2 | S |
| [RD-18](#rd-18) | P2 | `<iframe>` without a `sandbox` attribute | 3 | 2 | S |
| [RD-19](#rd-19) | P2 | Privileged action pre-filled from the URL | 1 | 1 | M |
| [RD-20](#rd-20) | P2 | Weak randomness in a security-shaped context (vendored `ecad-viewer.js`) | 1 | 1 | S |
| [RD-21](#rd-21) | P3 | Interactive controls without accessible labels | 9 | 7 | S |
| [RD-22](#rd-22) | P3 | Click handlers unreachable by keyboard | 9 | 4 | M |
| [RD-23](#rd-23) | P3 | `autoFocus` and hand-rolled modals | 3 | 3 | S |
| [RD-24](#rd-24) | P4 | Array chains that iterate the same list twice | 35 | 21 | M |
| [RD-25](#rd-25) | P4 | Linear lookups inside loops | 20 | 6 | M |
| [RD-26](#rd-26) | P4 | Values rebuilt every render that should be hoisted | 19 | 14 | M |
| [RD-27](#rd-27) | P4 | State that only handlers read should be a ref | 5 | 4 | S |
| [RD-28](#rd-28) | P4 | Object URLs never revoked | 2 | 1 | S |
| [RD-29](#rd-29) | P4 | `transition-all` on animated elements | 4 | 3 | S |
| [RD-30](#rd-30) | P4 | `JSON.parse(JSON.stringify(x))` deep clone | 1 | 1 | S |
| [RD-31](#rd-31) | P5 | Dead code: unused files, exports, and dependencies | 14 | 13 | S |
| [RD-32](#rd-32) | P5 | Non-component exports in component files | 17 | 14 | M |
| [RD-33](#rd-33) | P5 | Components over 300 lines | 18 | 18 | L |

### RD-01

**Refs mutated during render** — P0 · error · 14 findings in 9 files · effort M

Rules: `react-doctor/no-ref-current-in-render`

**Why it matters.** Render must be pure. React 18 StrictMode double-invokes render and React can discard render work, so a write to `ref.current` during render can leak state from a render that never commits — or be applied twice. This is the largest cluster of hard errors in the scan.

**Fix.** Move each `ref.current = ...` write into an event handler, a `useEffect`, or a null-guarded lazy-init (`if (ref.current === null) ref.current = ...`), which stays supported. `ReleaseStudioPanel.tsx` has four sites and should be done first.

<details><summary>Affected sites</summary>

- `src/components/design-comparison/comparison-presentation-shell.tsx` — L297
- `src/components/ecad-viewer-controls.tsx` — L76
- `src/components/release-studio/ReleaseStudioPanel.tsx` — L97, L130, L134, L146
- `src/components/ui/hold-to-confirm-button.tsx` — L60
- `src/components/viewer-overlay-rail.tsx` — L108
- `src/components/webgpu-3d-tab.tsx` — L122
- `src/components/workspace/async-search-picker.tsx` — L88, L90
- `src/components/workspace/library-component-workspace.tsx` — L1384, L1386
- `src/hooks/use-hotkeys.ts` — L39

</details>

### RD-02

**Side effects inside state updater functions** — P0 · error/warning · 13 findings in 2 files · effort M

Rules: `react-doctor/no-impure-state-updater`, `react-doctor/no-side-effect-in-state-updater-function`

**Why it matters.** React may invoke a `setState(prev => ...)` callback more than once. Any toast, persistence, ref write, or captured-stack mutation inside it can run twice or observe inconsistent external state. Concentrated almost entirely in the library import remediation grid.

**Fix.** Make every updater callback pure and return only the next state. Compute the next state first, then perform the side effect in the event handler that queued the update. `library-import-remediation-grid.tsx` accounts for 11 of the 13 sites — fixing that one file clears most of this issue.

<details><summary>Affected sites</summary>

`react-doctor/no-impure-state-updater` (6)

- `src/components/workspace/library-bulk-edit-workspace.tsx` — L362
- `src/components/workspace/library-import-remediation-grid.tsx` — L287, L297, L300, L309, L312

`react-doctor/no-side-effect-in-state-updater-function` (7)

- `src/components/workspace/library-bulk-edit-workspace.tsx` — L362
- `src/components/workspace/library-import-remediation-grid.tsx` — L290, L291, L300, L301, L312, L313

</details>

### RD-03

**Effects that subscribe or start timers without cleanup** — P0 · error · 2 findings in 2 files · effort S

Rules: `react-doctor/effect-needs-cleanup`

**Why it matters.** An `addEventListener` (or timer/observer/socket) created in `useEffect` without a returned cleanup leaks after unmount and keeps firing against a dead component.

**Fix.** Return a cleanup function that undoes every allocation the effect makes: `return () => target.removeEventListener(name, handler)`.

<details><summary>Affected sites</summary>

- `src/components/design-comparison/comparison-presentation-shell.tsx` — L1111
- `src/components/design-comparison/use-design-compare-job.ts` — L85

</details>

### RD-04

**State adjusted in an effect when a prop changes** — P1 · warning · 60 findings in 18 files · effort L

Rules: `react-doctor/no-adjust-state-on-prop-change`

**Why it matters.** The single biggest cluster: 60 findings, but React Doctor collapses them into 9 fix groups (one per file) — one restructuring per component clears the whole file. Each effect writes state in response to a prop change, so users see the stale value for a frame before the effect catches up.

**Fix.** Derive the value during render, or reset the component with a `key` prop, or update the related state in the event handler that changes the prop. Do not add a "previous prop" state variable — that keeps the duplication. Sequence by group size: `visualizer.tsx` (16), `library-component-workspace.tsx` (13), `comparison-presentation-shell.tsx` (5), `command-palette.tsx` (4), then the 3-and-under files.

<details><summary>Affected sites</summary>

- `src/components/command-palette.tsx` — L121, L122, L123, L288
- `src/components/comment-form.tsx` — L72, L75, L76
- `src/components/design-comparison/comparison-presentation-shell.tsx` — L519, L523, L524, L528, L1043
- `src/components/design-comparison/design-comparison-workspace.tsx` — L519, L520
- `src/components/design-comparison/differences-pane.tsx` — L383
- `src/components/design-comparison/fabrication-panel.tsx` — L311
- `src/components/design-search-field.tsx` — L119
- `src/components/history-viewer.tsx` — L597, L598, L599
- `src/components/visualizer.tsx` — L657, L658, L661, L663, L664, L665, L666, L668 (+8 more)
- `src/components/workspace.tsx` — L187, L191, L196
- `src/components/workspace/create-folder-dialog.tsx` — L27
- `src/components/workspace/library-asset-link-picker.tsx` — L50
- `src/components/workspace/library-component-workspace.tsx` — L1821, L1822, L1823, L1824, L1825, L1826, L1827, L1829 (+5 more)
- `src/components/workspace/library-folder-discovery-dialog.tsx` — L38
- `src/components/workspace/library-import-remediation-dialog.tsx` — L56
- `src/components/workspace/library-import-remediation-grid.tsx` — L278
- `src/components/workspace/move-project-dialog.tsx` — L93, L101
- `src/panel/screens/PartDetailScreen.tsx` — L519

</details>

### RD-05

**All state reset in an effect on a prop change** — P1 · warning · 6 findings in 6 files · effort S

Rules: `react-doctor/no-reset-all-state-on-prop-change`

**Why it matters.** Same class as RD-04 but with a much cheaper fix: the effect clears every state value when a prop changes, so stale state is visible for one render.

**Fix.** Pass the prop as `key` on the component so React remounts it and resets state for you, and delete the effect.

<details><summary>Affected sites</summary>

- `src/components/comment-form.tsx` — L70
- `src/components/release-studio/steps/ObserveBuildStep.tsx` — L223
- `src/components/workspace/create-folder-dialog.tsx` — L25
- `src/components/workspace/library-component-workspace.tsx` — L763
- `src/components/workspace/library-preview-inspector.tsx` — L99
- `src/panel/screens/PartDetailScreen.tsx` — L518

</details>

### RD-06

**State written after `await` in an effect without a cancellation guard** — P1 · warning · 11 findings in 8 files · effort M

Rules: `react-doctor/no-set-state-after-await-in-effect`

**Why it matters.** When the effect re-runs before the previous async call settles, the two responses can resolve out of order and the older one wins — a classic stale-data race in viewer/project screens that switch targets quickly.

**Fix.** Add an `ignore`/`cancelled` flag captured per effect run and checked before every setter, or return a cleanup that aborts the request (`AbortController`).

<details><summary>Affected sites</summary>

- `src/components/assets-portal.tsx` — L140
- `src/components/auth-callback-page.tsx` — L13
- `src/components/design-comparison/revision-sources.ts` — L65
- `src/components/design-comparison/use-comparison-comments.ts` — L18
- `src/components/design-comparison/use-design-compare-job.ts` — L44
- `src/components/documentation-browser.tsx` — L124
- `src/components/visualizer.tsx` — L436, L544, L619
- `src/pages/ProjectDetailPage.tsx` — L223, L259

</details>

### RD-07

**Loading flags reset outside `finally`** — P1 · warning · 2 findings in 2 files · effort S

Rules: `react-doctor/no-loading-flag-reset-outside-finally`

**Why it matters.** The reset only runs on the success path, so a rejected request leaves a spinner spinning or a button disabled forever.

**Fix.** Move the reset into a `finally` block (or mirror it in every `catch`).

<details><summary>Affected sites</summary>

- `src/components/design-comparison/comparison-discussion-rail.tsx` — L103
- `src/components/settings-dialog.tsx` — L243

</details>

### RD-08

**Unchecked `fetch` response body** — P1 · warning · 1 finding in 1 file · effort S

Rules: `react-doctor/no-fetch-response-used-without-status-check`

**Why it matters.** `fetch` resolves on 4xx/5xx, so reading the body without checking `response.ok` parses an error payload as if it were success.

**Fix.** Check `response.ok` / `response.status` before `.json()`/`.text()`/`.blob()`, or handle the API error payload deliberately.

<details><summary>Affected sites</summary>

- `src/components/release-studio/shared.tsx` — L129

</details>

### RD-09

**Array index used as a React `key`** — P1 · warning · 7 findings in 7 files · effort S

Rules: `react-doctor/no-array-index-as-key`

**Why it matters.** When a list reorders or filters, index keys make React reuse the wrong DOM node — in comment threads and remediation dialogs this means users can see and submit the wrong row.

**Fix.** Key by a stable id from the item (`item.id`, `item.slug`). Where the data genuinely has no id, derive a stable composite key.

<details><summary>Affected sites</summary>

- `src/components/comment-card.tsx` — L118
- `src/components/comment-panel.tsx` — L277
- `src/components/design-comparison/comparison-discussion-rail.tsx` — L180
- `src/components/keyboard-shortcuts-dialog.tsx` — L54
- `src/components/ui/field.tsx` — L192
- `src/components/workspace/library-import-remediation-dialog.tsx` — L116
- `src/pages/ProjectDetailPage.tsx` — L835

</details>

### RD-10

**State mutated in place** — P1 · warning · 1 finding in 1 file · effort S

Rules: `react-doctor/no-direct-state-mutation`

**Why it matters.** React compares by identity, so an in-place mutation can be skipped entirely and the update lost.

**Fix.** Call the setter with a new value (`setItems([...items, x])`, `items.toSorted(...)`, etc.).

<details><summary>Affected sites</summary>

- `src/components/design-comparison/comparison-presentation-shell.tsx` — L768

</details>

### RD-11

**Props copied or mirrored into state** — P1 · warning · 3 findings in 3 files · effort S

Rules: `react-doctor/no-derived-useState`, `react-doctor/no-mirror-prop-effect`

**Why it matters.** `useState(prop)` copies the prop once, so later prop changes leave a stale value on screen; the effect-mirroring variant shows the old value on first render.

**Fix.** Read the prop directly during render, or compute the value inline. Delete both the `useState` and the syncing `useEffect`.

<details><summary>Affected sites</summary>

`react-doctor/no-derived-useState` (2)

- `src/components/session-expired-banner.tsx` — L53
- `src/components/workspace/library-component-workspace.tsx` — L429

`react-doctor/no-mirror-prop-effect` (1)

- `src/components/workspace/library-bulk-edit-workspace.tsx` — L83

</details>

### RD-12

**Child components pushing data up through effects** — P1 · warning · 10 findings in 5 files · effort M

Rules: `react-doctor/no-pass-data-to-parent`, `react-doctor/no-pass-live-state-to-parent`, `react-doctor/no-prop-callback-in-effect`, `react-doctor/no-effect-chain`

**Why it matters.** Each of these costs an extra render pass per interaction and makes the data flow hard to follow. `use-comparison-url-state.ts` alone has 5 sites, so the comparison URL-state hook is the natural unit of work.

**Fix.** Lift the state to the parent (or return it from the hook) instead of handing it back through a prop callback in an effect; for shared state across siblings, use a Provider. Collapse effect chains by computing during render and writing related state in the originating event handler.

<details><summary>Affected sites</summary>

`react-doctor/no-pass-data-to-parent` (5)

- `src/components/design-comparison/use-comparison-url-state.ts` — L62, L63, L68, L71, L74

`react-doctor/no-pass-live-state-to-parent` (2)

- `src/components/design-comparison/comparison-presentation-shell.tsx` — L267
- `src/components/release-studio/ReleaseStudioPanel.tsx` — L269

`react-doctor/no-prop-callback-in-effect` (2)

- `src/components/design-comparison/comparison-presentation-shell.tsx` — L267
- `src/components/ecad-viewer-controls.tsx` — L142

`react-doctor/no-effect-chain` (1)

- `src/components/workspace.tsx` — L186

</details>

### RD-13

**Data fetching directly inside `useEffect`** — P1 · warning · 3 findings in 3 files · effort M

Rules: `react-doctor/no-fetch-in-effect`

**Why it matters.** Raw `fetch` in an effect can race, double-fire under StrictMode, and leak. Related to RD-06 but the fix is structural rather than a guard flag.

**Fix.** Route these through the existing data-fetching layer (or add one) so cancellation, dedupe, and error handling live in one place.

<details><summary>Affected sites</summary>

- `src/components/assets-portal.tsx` — L140
- `src/components/documentation-browser.tsx` — L124
- `src/components/release-studio/shared.tsx` — L113

</details>

### RD-14

**Pointer capture with no cancellation path** — P1 · warning · 1 finding in 1 file · effort S

Rules: `react-doctor/pointer-capture-needs-cancel-handler`

**Why it matters.** The drag cleans up only on pointer-up, so an interruption (scroll, app switch, orientation change) leaves the drag stuck active.

**Fix.** Handle `onPointerCancel` / `onLostPointerCapture` with the same cleanup as pointer-up.

<details><summary>Affected sites</summary>

- `src/components/workspace/library-component-workspace.tsx` — L685

</details>

### RD-15

**Related `useState` calls that should be one reducer** — P1 · warning · 4 findings in 4 files · effort M

Rules: `react-doctor/prefer-useReducer`

**Why it matters.** Advisory, not a defect: four components update 5+ separate state values in one place, which is where inconsistent intermediate states come from.

**Fix.** Group state that always changes together into `useReducer` so one action describes the whole transition. Worth doing opportunistically while fixing RD-04 in the same files.

<details><summary>Affected sites</summary>

- `src/components/path-config-dialog.tsx` — L91
- `src/components/release-studio/ReleaseStudioPanel.tsx` — L80
- `src/components/visualizer.tsx` — L289
- `src/components/workspace/library-component-workspace.tsx` — L1744

</details>

### RD-16

**Independent awaits run sequentially** — P1 · warning · 1 finding in 1 file · effort S

Rules: `react-doctor/server-sequential-independent-await`

**Why it matters.** The second `await` does not use the first result, so the load takes twice as long as it needs to.

**Fix.** Wrap the two calls in `Promise.all([...])`.

<details><summary>Affected sites</summary>

- `src/components/design-comparison/comparison-result-loader.ts` — L52

</details>

### RD-17

**`window.open` without `noopener`** — P2 · warning · 3 findings in 2 files · effort S

Rules: `react-doctor/window-open-without-noopener`

**Why it matters.** The opened page can redirect the parent tab through `window.opener` (reverse tabnabbing). These are asset/doc links, which can point at user-supplied URLs.

**Fix.** Pass `'noopener'` in the third features argument, plus `'noreferrer'` where the destination should not receive the referrer.

<details><summary>Affected sites</summary>

- `src/components/assets-portal.tsx` — L169, L175
- `src/components/documentation-browser.tsx` — L159

</details>

### RD-18

**`<iframe>` without a `sandbox` attribute** — P2 · warning · 3 findings in 2 files · effort S

Rules: `react-doctor/iframe-missing-sandbox`

**Why it matters.** An unsandboxed iframe gives the embedded page full access to the host origin. These frames render build/manufacturing output and viewer content.

**Fix.** Add `sandbox=""` and re-add only the capabilities each frame actually needs (`allow-scripts allow-same-origin` is the combination to avoid together).

<details><summary>Affected sites</summary>

- `src/components/release-studio/shared.tsx` — L71, L180
- `src/components/visualizer.tsx` — L1404

</details>

### RD-19

**Privileged action pre-filled from the URL** — P2 · warning · 1 finding in 1 file · effort M

Rules: `react-doctor/url-prefilled-privileged-action`

**Why it matters.** `src/lib/auth.ts` reads sensitive action state from the URL, which lets an attacker-crafted link pre-fill an invite, role, redirect, or share flow.

**Fix.** Validate URL-sourced auth parameters server-side and require explicit user confirmation before acting on them. Confirm what the parameter actually drives before changing behaviour.

<details><summary>Affected sites</summary>

- `src/lib/auth.ts` — L113

</details>

### RD-20

**Weak randomness in a security-shaped context (vendored `ecad-viewer.js`)** — P2 · warning · 1 finding in 1 file · effort S

Rules: `react-doctor/insecure-crypto-risk`

**Why it matters.** The only remaining finding under `public/`, and the reason that file is kept in scope: it lives in the bundle built from our ecad-viewer fork, so it is fixable upstream rather than here.

**Fix.** Checked against the bundle: the site is a `generateUUID()` helper built from `Math.floor(Math.random() * Number.MAX_SAFE_INTEGER)`. It generates element ids, not auth material, so this is a **false positive** for our usage. Two options — suppress it via `ignore.overrides` scoped to `public/ecad-viewer.js`, or switch the upstream helper in the ecad-viewer fork to `crypto.randomUUID()` and rebuild the bundle. Either way, never hand-edit `public/ecad-viewer.js`; it is generated output.

<details><summary>Affected sites</summary>

- `public/ecad-viewer.js` — L1416

</details>

### RD-21

**Interactive controls without accessible labels** — P3 · warning · 9 findings in 7 files · effort S

Rules: `react-doctor/control-has-associated-label`, `react-doctor/no-placeholder-only-field`

**Why it matters.** Icon-only buttons and placeholder-only fields give screen reader users nothing to go on; placeholders also vanish as soon as the user types.

**Fix.** Add visible text, `aria-label`, or `aria-labelledby` to each control, and a real associated `<label>` to each field (keep the placeholder as a format hint).

<details><summary>Affected sites</summary>

`react-doctor/control-has-associated-label` (6)

- `src/components/assets-portal.tsx` — L59
- `src/components/documentation-browser.tsx` — L40
- `src/components/settings-dialog.tsx` — L748, L784
- `src/components/workspace/library-bulk-edit-workspace.tsx` — L122, L134

`react-doctor/no-placeholder-only-field` (3)

- `src/components/comment-card.tsx` — L128
- `src/components/comment-form.tsx` — L236
- `src/components/comment-panel.tsx` — L292

</details>

### RD-22

**Click handlers unreachable by keyboard** — P3 · warning · 9 findings in 4 files · effort M

Rules: `react-doctor/click-events-have-key-events`, `react-doctor/no-static-element-interactions`, `react-doctor/html-no-nested-interactive`

**Why it matters.** `onClick` on a `<div>`/`<span>` with no role and no key handler is invisible to keyboard and screen reader users. The nested-interactive case also breaks focus order.

**Fix.** Prefer a real `<button>`/`<a>`. Where the layout forbids it, add `role`, `tabIndex={0}`, and a matching key handler; move nested focusable elements out of their interactive ancestor.

<details><summary>Affected sites</summary>

`react-doctor/click-events-have-key-events` (4)

- `src/components/comment-panel.tsx` — L171, L264
- `src/components/sidebar-tree.tsx` — L27
- `src/components/workspace/library-asset-link-picker.tsx` — L92

`react-doctor/no-static-element-interactions` (4)

- `src/components/comment-panel.tsx` — L171, L264
- `src/components/sidebar-tree.tsx` — L27
- `src/components/workspace/library-bulk-edit-workspace.tsx` — L97

`react-doctor/html-no-nested-interactive` (1)

- `src/components/workspace/library-asset-link-picker.tsx` — L92

</details>

### RD-23

**`autoFocus` and hand-rolled modals** — P3 · warning · 3 findings in 3 files · effort S

Rules: `react-doctor/no-autofocus`, `react-doctor/prefer-html-dialog`

**Why it matters.** `autoFocus` yanks focus on mount and disorients assistive-tech users; a `role="dialog"` wrapper re-implements semantics the native `<dialog>` gives for free.

**Fix.** Drop `autoFocus` (or move focus deliberately after an explicit user action) and migrate the custom modal to `<dialog>` + `showModal()`.

<details><summary>Affected sites</summary>

`react-doctor/no-autofocus` (2)

- `src/components/command-palette.tsx` — L337
- `src/components/comment-form.tsx` — L238

`react-doctor/prefer-html-dialog` (1)

- `src/components/comment-card.tsx` — L74

</details>

### RD-24

**Array chains that iterate the same list twice** — P4 · warning · 35 findings in 21 files · effort M

Rules: `react-doctor/js-combine-iterations`, `react-doctor/js-flatmap-filter`

**Why it matters.** 35 findings, mostly in the design-comparison pipeline and the library workspaces — the code paths that run over the largest lists (BOM rows, diff sets, import candidates).

**Fix.** Collapse `.filter().map()` into a single `for...of`/`.reduce()` pass, and `.map().filter(Boolean)` into `.flatMap()`. Prioritise the comparison modules, where list sizes scale with design size.

<details><summary>Affected sites</summary>

`react-doctor/js-combine-iterations` (30)

- `src/components/design-comparison/comparison-change-facts.ts` — L213
- `src/components/design-comparison/comparison-presentation-shell.tsx` — L497, L840, L1069, L1180, L1196
- `src/components/design-comparison/comparison-property-model.ts` — L165, L445
- `src/components/design-comparison/comparison-review-noise.ts` — L145, L153
- `src/components/design-comparison/comparison-review-policy.ts` — L431
- `src/components/design-comparison/comparison-review-queue.ts` — L113
- `src/components/design-comparison/comparison-selection-bridge.ts` — L30
- `src/components/design-comparison/design-comparison-workspace.tsx` — L271
- `src/components/design-comparison/differences-pane.tsx` — L414
- `src/components/design-comparison/revision-sources.ts` — L89, L177
- `src/components/import-dialog.tsx` — L491
- `src/components/release-studio/steps/ManufacturingStep.tsx` — L228
- `src/components/selection-inspector.tsx` — L467
- `src/components/visualizer.tsx` — L591
- `src/components/workspace/library-bulk-edit-workspace.tsx` — L298, L477, L503
- `src/components/workspace/library-catalog-workspace.tsx` — L473
- `src/components/workspace/library-folder-discovery-dialog.tsx` — L26
- `src/components/workspace/library-import-center.tsx` — L274
- `src/components/workspace/library-import-remediation-grid.tsx` — L422, L455
- `src/pages/ProjectDetailPage.tsx` — L473

`react-doctor/js-flatmap-filter` (5)

- `src/components/design-comparison/comparison-review-policy.ts` — L431
- `src/components/design-comparison/comparison-review-queue.ts` — L186
- `src/lib/design-search.ts` — L143, L233, L240

</details>

### RD-25

**Linear lookups inside loops** — P4 · warning · 20 findings in 6 files · effort M

Rules: `react-doctor/js-set-map-lookups`, `react-doctor/js-index-maps`

**Why it matters.** `array.includes()` / `array.find()` inside a loop makes the work quadratic. 14 of the 20 sites are in `library-bulk-edit-workspace.tsx`, which is exactly the screen users point at large libraries.

**Fix.** Build a `Set` or `Map` once before the loop and look up against it. `library-bulk-edit-workspace.tsx` is a single focused change that clears most of this issue.

<details><summary>Affected sites</summary>

`react-doctor/js-set-map-lookups` (19)

- `src/components/engineering-bom-table.tsx` — L150
- `src/components/import-dialog.tsx` — L493, L687
- `src/components/release-studio/steps/ManufacturingStep.tsx` — L147
- `src/components/workspace/library-bulk-edit-workspace.tsx` — L227, L300, L301, L341, L342, L348, L477, L516 (+1 more)
- `src/components/workspace/library-import-center.tsx` — L265

`react-doctor/js-index-maps` (1)

- `src/components/design-comparison/comparison-property-panel.tsx` — L153

</details>

### RD-26

**Values rebuilt every render that should be hoisted** — P4 · warning · 19 findings in 14 files · effort M

Rules: `react-doctor/js-hoist-intl`, `react-doctor/prefer-module-scope-pure-function`, `react-doctor/prefer-module-scope-static-value`, `react-doctor/rerender-lazy-state-init`, `react-doctor/rerender-lazy-ref-init`, `react-doctor/rerender-memo-with-default-value`

**Why it matters.** `Intl` formatters, pure helpers, static arrays, and eager `useState`/`useRef` initialisers all get rebuilt on every render and hand memoized children brand-new identities, defeating memoization downstream.

**Fix.** Move pure helpers and static values to module scope, hoist `Intl.*` formatters (or `useMemo` them), pass initialisers as functions (`useState(() => find())`), and replace inline `[]`/`{}` default props with module-level constants.

<details><summary>Affected sites</summary>

`react-doctor/js-hoist-intl` (4)

- `src/components/workspace/library-catalog-workspace.tsx` — L133
- `src/components/workspace/library-component-workspace.tsx` — L216
- `src/components/workspace/library-release-queue.tsx` — L59
- `src/panel/screens/PartDetailScreen.tsx` — L676

`react-doctor/prefer-module-scope-pure-function` (5)

- `src/components/import-dialog.tsx` — L439
- `src/components/login-page.tsx` — L165
- `src/components/project-card.tsx` — L61
- `src/components/workspace.tsx` — L93
- `src/pages/ProjectDetailPage.tsx` — L117

`react-doctor/prefer-module-scope-static-value` (4)

- `src/components/workspace/library-component-workspace.tsx` — L1469, L1632
- `src/components/workspace/library-import-center.tsx` — L120
- `src/pages/ProjectDetailPage.tsx` — L351

`react-doctor/rerender-lazy-state-init` (2)

- `src/components/release-studio/steps/ObserveBuildStep.tsx` — L44, L50

`react-doctor/rerender-lazy-ref-init` (2)

- `src/components/visualizer.tsx` — L185
- `src/components/webgpu-3d-tab.tsx` — L121

`react-doctor/rerender-memo-with-default-value` (2)

- `src/components/comment-form.tsx` — L61
- `src/components/release-studio/steps/ObserveBuildStep.tsx` — L20

</details>

### RD-27

**State that only handlers read should be a ref** — P4 · warning · 5 findings in 4 files · effort S

Rules: `react-doctor/rerender-state-only-in-handlers`

**Why it matters.** Each update re-renders the component for a value that is never rendered.

**Fix.** Swap `useState` for `useRef` where the value is only written and read in handlers.

<details><summary>Affected sites</summary>

- `src/components/import-dialog.tsx` — L136
- `src/components/login-page.tsx` — L55
- `src/components/release-studio/ReleaseStudioPanel.tsx` — L121, L147
- `src/components/visualizer.tsx` — L365

</details>

### RD-28

**Object URLs never revoked** — P4 · warning · 2 findings in 1 file · effort S

Rules: `react-doctor/no-create-object-url-without-revoke`

**Why it matters.** `URL.createObjectURL` pins the Blob for the document lifetime. In release-studio download paths that means every artifact the user downloads stays in memory until reload.

**Fix.** Keep the URL and call `URL.revokeObjectURL(url)` after the download completes or in effect cleanup.

<details><summary>Affected sites</summary>

- `src/components/release-studio/api.ts` — L46, L243

</details>

### RD-29

**`transition-all` on animated elements** — P4 · warning · 4 findings in 3 files · effort S

Rules: `react-doctor/no-transition-all`

**Why it matters.** It animates every changing property, including layout-triggering ones and instant ones like focus rings, which is where the jank comes from.

**Fix.** Name the properties: `transition-colors`, `transition-opacity`, `transition-transform`.

<details><summary>Affected sites</summary>

- `src/components/design-comparison/design-comparison-workspace.tsx` — L996
- `src/components/import-dialog.tsx` — L594, L785
- `src/pages/ProjectDetailPage.tsx` — L855

</details>

### RD-30

**`JSON.parse(JSON.stringify(x))` deep clone** — P4 · warning · 1 finding in 1 file · effort S

Rules: `react-doctor/no-json-parse-stringify-clone`

**Why it matters.** Slow on large objects, and it silently drops `undefined`, functions, `Date`/`Map`/`Set`, and cycles — a real correctness risk in the KiCad bridge payloads.

**Fix.** Use `structuredClone(value)`.

<details><summary>Affected sites</summary>

- `src/panel/lib/kicad-bridge.ts` — L190

</details>

### RD-31

**Dead code: unused files, exports, and dependencies** — P5 · warning · 14 findings in 13 files · effort S

Rules: `deslop/unused-file`, `deslop/unused-export`, `deslop/unused-dependency`

**Why it matters.** 14 findings that are pure subtraction. Note that four of the six unused files are shadcn-style `src/components/ui/*` primitives — those are scaffolding, so decide once whether the repo keeps unused primitives on purpose.

**Fix.** Delete `src/components/example.tsx` and `src/components/sidebar-tree.tsx` outright; decide a policy for the unused `ui/` primitives; drop the `export` keyword on the six unused exports; remove the two unused dependencies (`jwt-decode`, `tw-animate-css`) from `package.json` after confirming nothing loads them dynamically — `tw-animate-css` in particular may be referenced from CSS rather than JS.

<details><summary>Affected sites</summary>

`deslop/unused-file` (6)

- `src/components/example.tsx` — L0
- `src/components/sidebar-tree.tsx` — L0
- `src/components/ui/alert-dialog.tsx` — L0
- `src/components/ui/combobox.tsx` — L0
- `src/components/ui/field.tsx` — L0
- `src/components/ui/input-group.tsx` — L0

`deslop/unused-export` (6)

- `src/components/design-comparison/comparison-review-report.ts` — L57
- `src/components/design-comparison/comparison-selection-bridge.ts` — L51
- `src/components/release-studio/flow.ts` — L30
- `src/lib/diff-grouping.ts` — L191
- `src/lib/prism-selection.ts` — L188
- `src/panel/lib/kicad-bridge.ts` — L146

`deslop/unused-dependency` (2)

- `package.json` — L0

</details>

### RD-32

**Non-component exports in component files** — P5 · warning · 17 findings in 14 files · effort M

Rules: `react-doctor/only-export-components`

**Why it matters.** Fast Refresh cannot preserve component state when a module also exports non-components, so every edit to these files full-reloads the app. It is a developer-experience cost, not a user-facing bug.

**Fix.** Move helpers, constants, and variants into sibling modules (`*.constants.ts`, `*.utils.ts`) and re-export from there. Do the `ui/` primitives (`badge`, `button`, `tabs`) as one batch since they follow the same shadcn variant pattern.

<details><summary>Affected sites</summary>

- `src/components/command-palette.tsx` — L71
- `src/components/comment-severity-badge.tsx` — L13
- `src/components/design-comparison/bom-panel.tsx` — L38
- `src/components/design-comparison/change-status.tsx` — L27
- `src/components/design-comparison/design-comparison-workspace.tsx` — L93
- `src/components/engineering-bom-table.tsx` — L13
- `src/components/import-dialog.tsx` — L41
- `src/components/release-studio/shared.tsx` — L19
- `src/components/ui/badge.tsx` — L48
- `src/components/ui/button.tsx` — L66
- `src/components/ui/permission-hint.tsx` — L33
- `src/components/ui/tabs.tsx` — L95
- `src/components/viewer-overlay-rail.tsx` — L26
- `src/components/workspace/library-import-remediation-grid.tsx` — L125, L140, L178, L186

</details>

### RD-33

**Components over 300 lines** — P5 · warning · 18 findings in 18 files · effort L

Rules: `react-doctor/no-giant-component`

**Why it matters.** 18 components exceed the threshold, topping out at `library-component-workspace.tsx` (~2.5k lines). This is the structural reason so many other findings cluster in the same handful of files.

**Fix.** Do not treat this as its own task. Split each file as a byproduct of the RD-02/RD-04 work in that same file, and re-scan afterwards to see which of the 18 actually remain.

<details><summary>Affected sites</summary>

- `src/components/design-comparison/comparison-presentation-shell.tsx` — L227
- `src/components/design-comparison/design-comparison-workspace.tsx` — L107
- `src/components/design-comparison/fabrication-panel.tsx` — L259
- `src/components/history-viewer.tsx` — L474
- `src/components/import-dialog.tsx` — L127
- `src/components/path-config-dialog.tsx` — L91
- `src/components/release-studio/ReleaseStudioPanel.tsx` — L75
- `src/components/settings-dialog.tsx` — L213
- `src/components/visualizer.tsx` — L289
- `src/components/webgpu-3d-tab.tsx` — L107
- `src/components/workspace.tsx` — L56
- `src/components/workspace/library-bulk-edit-workspace.tsx` — L242
- `src/components/workspace/library-catalog-workspace.tsx` — L279
- `src/components/workspace/library-component-workspace.tsx` — L1734
- `src/components/workspace/library-import-center.tsx` — L93
- `src/components/workspace/library-import-remediation-grid.tsx` — L212
- `src/pages/ProjectDetailPage.tsx` — L95
- `src/panel/screens/PartDetailScreen.tsx` — L82

</details>

## Not turned into issues

- Nothing was suppressed or downgraded during this scan beyond the `public/` exclusion above.
- React Doctor tags 27 of the 51 fired rules as `test-noise`, meaning they are commonly noisy in test files. No test-file findings appear in this report — every site is production source.
- The score API and share URL were disabled (`--no-telemetry`), so this report has no React Doctor score attached.

## Reproducing

```bash
cd frontend && npm i -D react-doctor
npx react-doctor . -y --no-telemetry --verbose
```

For a machine-readable report: add `--json --json-out report.json`, then check `projects[0].skippedChecks` is empty before reading the diagnostics.

## Zero-findings pass (2026-08-23)

The comparison-url branch cleared every remaining live finding. 64 were
fixed in code: the URL state hook now owns the comparison state (no mirror
effects), the comparison shell publishes pcb layers at the point of change,
scope-carrying values replaced three reset effects, filter/map chains were
folded into single passes, includes-in-loop lookups became Set lookups, five
write-only useStates became refs, and dead exports (`categorise`,
`categoryFor`) were deleted.

The remaining 29 are recorded inline at their anchors with
`react-doctor-disable-next-line` comments:

- **no-giant-component (18)** — the components' state and rendering are
  mutually coupled; splitting them is a per-component task, not this pass.
- **no-pass-live-state/data-to-parent (5)** — the shell publishes device
  state owned by the ecad viewer; the effect only registers listeners and
  snapshots the initial state.
- **no-adjust-state-on-prop-change (1)** — the cross-domain selection
  re-anchor; remapping the selection to the counterpart on tab change is
  the effect's entire job.
- **js-set-map-lookups (1)** — the receiver is a joined string haystack;
  a Set would break substring matching.
- **prefer-useReducer (4)** — the state groups belong to separate concerns
  (form draft, fetch results, busy flags; and in the comparison shell the
  viewer handles, session lifecycle, selection reporting and rail geometry);
  one reducer would couple them.

`react-doctor-baseline.json` is now `{ errors: 0, warnings: 0 }`, so the CI
gate fails on any new finding.
