# UI Change Request

## Where

- Route: `/project/:projectId?section=history&base=<sha>&compare=<sha>`.
- Components: History Design Comparison workspace, semantic composite canvas, difference hierarchy, BOM review.

## Before -> After

1. Replace the two-column legacy comparison canvas with one native semantic composite.
2. Keep unchanged compare content monochrome and subdued.
3. Render added source objects in the success treatment, removed base objects in the destructive treatment, and modified compare objects in the warning treatment.
4. Use exact native UUID-resolved graphics; use dashed/hatch overlays only for selected emphasis or parser/source-ID diagnostics.
5. Group changes into Components, Nets, Sheets/Board, and Graphics with secondary changes hidden by default.
6. Add searchable, multi-select status filters, previous/next navigation, source details, and unresolved-thread counts.
7. Add synchronized PCB layer controls and an ephemeral two-point measurement control.
8. Keep comparison state in the URL, including the focused item, secondary visibility, and visible PCB layers.
9. Rebuild BOM review around search, multi-select status filters, optional unchanged rows, detected-column selection, Base/Compare/Changes views, cell-level diffs, row details, and filtered CSV export.
10. Precompute item/group focus frames when comparison data arrives; item rows focus only their member while group headers focus the group union.
11. Replace independent page/overlay/focus effects with one latest-request-wins frame request per revision viewer.
12. Open the current sheet immediately, then show non-blocking changed-sheet preparation progress while the viewer warms retained scenes.

## Constraints

- No legacy visual modes or user-facing fallback selector.
- No generated SVG comparison images or DOM-positioned geometry overlays.
- No new runtime frontend dependencies; Vitest/Testing Library are test-only.
- All UI styling uses Prism semantic tokens in light and dark themes.
- Comparison must never mutate the Git checkout.
- Source changes must not be reloaded when filters, focus, layers, or measurement controls change.
- Warm selection must update the row immediately and must not clear the existing overlay between frames.

## Done-When Checklist

- [x] Native source-resolved additions, removals, and modifications paint in one composite canvas.
- [x] Secondary changes remain available but hidden by default.
- [x] Search, status filters, hierarchy navigation, focus, and URL restoration work.
- [x] PCB layers and measurement controls work without reloading sources.
- [x] BOM review supports filters, detected columns, source views, details, unchanged rows, and CSV export.
- [x] Frontend lint/build and viewer contract tests pass.
- [x] Item and group focus descriptors are precomputed and covered by frontend tests.
- [x] Warm selections use one atomic review-frame call per viewer with no duplicate `showPage` effect.
- [x] Changed schematic pages warm in the background with local progress feedback.
- [ ] Desktop and narrow layouts are usable in light and dark themes.
- [ ] JTYU-OBC production profiling meets the warm p95 target after the pinned viewer bundle is rebuilt.
