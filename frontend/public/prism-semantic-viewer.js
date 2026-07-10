var Ks=`:host,
:root {
  color-scheme: dark;
  --shell: #09090b;
  --panel: #09090b;
  --panel-raised: #18181b;
  --control: #18181b;
  --control-hover: #27272a;
  --foreground: #fafafa;
  --muted: #a1a1aa;
  --border: #27272a;
  --primary: #3b82f6;
  --surface: #09090b;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

:host {
  display: block;
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  background: var(--shell);
  color: var(--foreground);
}

html,
body {
  width: 100%;
  height: 100%;
  min-height: 0;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  overflow: hidden;
  background: var(--shell);
  color: var(--foreground);
}

button,
input {
  font: inherit;
}

#app {
  display: grid;
  grid-template-columns: 48px minmax(0, 1fr) 376px;
  height: 100%;
  min-height: 0;
  background: var(--shell);
  color: var(--foreground);
  transition: grid-template-columns 180ms ease;
}

#app.panel-collapsed {
  grid-template-columns: 48px minmax(0, 1fr) 46px;
}

.workspace-rail {
  position: relative;
  z-index: 8;
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--border);
  background: var(--panel);
}

.workspace-tab {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 132px;
  padding: 0;
  border: 0;
  border-bottom: 1px solid var(--border);
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  font-size: 11px;
  font-weight: 700;
  writing-mode: vertical-rl;
  transform: rotate(180deg);
}

.workspace-tab:hover {
  background: var(--control);
  color: var(--foreground);
}

.workspace-tab.active {
  box-shadow: inset -2px 0 var(--primary);
  background: var(--panel-raised);
  color: var(--foreground);
}

.viewport-shell {
  position: relative;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  background: var(--surface);
}

#viewport {
  display: block;
  width: 100%;
  height: 100%;
}

#schematic-viewport {
  display: block;
  width: 100%;
  height: 100%;
  background: #0b0e13;
}

#schematic-dom-layer {
  position: absolute;
  inset: 0;
  z-index: 2;
  overflow: hidden;
  background: transparent;
  touch-action: none;
}

#schematic-flow-overlay {
  position: absolute;
  inset: 0;
  z-index: 3;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.svg-dom-page {
  position: absolute;
  left: 0;
  top: 0;
  transform-origin: 0 0;
  will-change: transform;
}

.svg-dom-page-svg {
  display: block;
  overflow: visible;
  background: #f4f1e7;
  box-shadow: 0 18px 58px rgba(0, 0, 0, 0.22);
}

.svg-dom-world-page {
  overflow: hidden;
  pointer-events: auto;
}

.svg-dom-world-page .svg-dom-page-svg {
  width: 100%;
  height: 100%;
  overflow: hidden;
  box-shadow: none;
}

#viewport[hidden],
#schematic-viewport[hidden],
#schematic-dom-layer[hidden],
#schematic-flow-overlay[hidden],
#bom-view[hidden] {
  display: none;
}

#bom-view {
  position: absolute;
  inset: 0;
  z-index: 2;
  overflow: hidden;
  background: var(--shell);
  color: var(--foreground);
}

.bom-workspace {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  height: 100%;
  min-height: 0;
}

.bom-toolbar {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 18px;
  padding: 18px 22px 14px;
  border-bottom: 1px solid var(--border);
  background: color-mix(in srgb, var(--panel) 88%, transparent);
  backdrop-filter: blur(14px);
}

.bom-toolbar h2 {
  margin: 2px 0 1px;
  color: var(--foreground);
  font-size: 20px;
  letter-spacing: 0;
}

.bom-toolbar span,
.bom-search span {
  color: var(--muted);
  font-size: 12px;
  font-weight: 650;
}

.bom-search {
  display: grid;
  gap: 6px;
  min-width: min(420px, 46vw);
}

.bom-search input {
  min-height: 38px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--control);
  color: var(--foreground);
  padding: 0 11px;
  outline: none;
}

.bom-search input:focus {
  border-color: rgba(59, 130, 246, 0.7);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.13);
}

.bom-content {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(320px, 24vw);
  min-height: 0;
}

.bom-content:not(:has(.bom-detail)) {
  grid-template-columns: minmax(0, 1fr);
}

.bom-table-wrap {
  min-width: 0;
  overflow: auto;
}

.bom-table {
  width: 100%;
  min-width: 1680px;
  border-collapse: separate;
  border-spacing: 0;
  color: var(--foreground);
  font-size: 12px;
}

.bom-table th {
  position: sticky;
  top: 0;
  z-index: 1;
  border-bottom: 1px solid var(--border);
  background: var(--panel-raised);
  color: var(--muted);
  padding: 9px 10px;
  text-align: left;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.bom-table td {
  max-width: 220px;
  border-bottom: 1px solid color-mix(in srgb, var(--border) 72%, transparent);
  padding: 9px 10px;
  vertical-align: top;
  white-space: normal;
  overflow-wrap: anywhere;
}

.bom-table tr {
  cursor: pointer;
}

.bom-table tr:hover td {
  background: color-mix(in srgb, var(--primary) 8%, transparent);
}

.bom-table tr.selected td {
  background: color-mix(in srgb, var(--primary) 15%, transparent);
}

.bom-reference-cell {
  min-width: 180px;
}

.bom-ref-chip {
  display: inline-flex;
  align-items: center;
  min-height: 22px;
  margin: 0 4px 4px 0;
  border: 1px solid color-mix(in srgb, var(--primary) 42%, var(--border));
  border-radius: 4px;
  background: color-mix(in srgb, var(--primary) 9%, var(--control));
  color: color-mix(in srgb, var(--primary) 45%, var(--foreground));
  padding: 2px 7px;
  cursor: pointer;
  font-size: 11px;
  font-weight: 750;
}

.bom-ref-chip:hover,
.bom-ref-chip.active {
  border-color: var(--primary);
  background: color-mix(in srgb, var(--primary) 24%, var(--control));
  color: var(--foreground);
}

.bom-ref-chip.detail {
  margin-bottom: 6px;
}

.bom-missing {
  color: #f59e0b;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.bom-detail {
  min-width: 0;
  overflow: auto;
  border-left: 1px solid var(--border);
  background: color-mix(in srgb, var(--panel-raised) 90%, transparent);
  padding: 18px;
}

.bom-detail-head {
  border-bottom: 1px solid var(--border);
  padding-bottom: 14px;
}

.bom-detail-head h3 {
  margin: 4px 0;
  color: var(--foreground);
  font-size: 18px;
  line-height: 1.25;
  overflow-wrap: anywhere;
}

.bom-detail-head span {
  color: var(--muted);
  font-size: 12px;
}

.bom-ref-list {
  padding: 14px 0 10px;
}

.bom-field-list {
  display: grid;
  gap: 9px;
  margin: 0;
}

.bom-field-list div {
  border-top: 1px solid color-mix(in srgb, var(--border) 74%, transparent);
  padding-top: 8px;
}

.bom-field-list dt {
  color: var(--muted);
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.bom-field-list dd {
  margin: 3px 0 0;
  color: var(--foreground);
  overflow-wrap: anywhere;
}

.bom-empty {
  color: var(--muted);
  font-size: 13px;
}

#panel-labels {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

#panel-labels span {
  position: absolute;
  padding: 4px 8px;
  border: 1px solid rgba(26, 36, 51, 0.14);
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.86);
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.08);
  color: #253047;
  font-size: 11px;
  font-weight: 650;
  backdrop-filter: blur(8px);
  transform: translate(10px, -50%);
  transition: left 60ms linear, top 60ms linear;
}

#axis-gizmo {
  position: absolute;
  left: 14px;
  bottom: 14px;
  width: 104px;
  height: 104px;
  cursor: pointer;
  border: 0;
  background: transparent;
  filter: drop-shadow(0 4px 8px rgba(15, 23, 42, 0.18));
}

#selection-card {
  position: absolute;
  z-index: 4;
  width: min(360px, calc(100% - 32px));
  border: 1px solid var(--border);
  border-radius: 3px;
  background: color-mix(in srgb, var(--panel-raised) 96%, transparent);
  box-shadow: 0 22px 58px rgba(0, 0, 0, 0.34);
  color: var(--foreground);
  font-family: Inter, "SF Pro Text", "Segoe UI", ui-sans-serif, system-ui, sans-serif;
  font-feature-settings: "tnum" 1, "ss01" 1;
  backdrop-filter: blur(16px);
}

#selection-card[hidden] {
  display: none;
}

.selection-card-head {
  display: grid;
  grid-template-columns: 4px auto minmax(0, 1fr) 24px;
  min-height: 48px;
  border-bottom: 1px solid var(--border);
  align-items: center;
  cursor: grab;
  user-select: none;
}

.selection-card-head:active {
  cursor: grabbing;
}

.selection-card-drag-handle {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--muted);
  padding: 6px;
  margin-left: 2px;
}

.selection-card-drag-handle svg {
  opacity: 0.5;
  transition: opacity 120ms ease;
}

.selection-card-head:hover .selection-card-drag-handle svg {
  opacity: 0.8;
  color: var(--foreground);
}

.selection-card-accent {
  width: 4px;
  height: 100%;
  background: #18ef52;
  box-shadow: 3px 0 14px rgba(24, 239, 82, 0.24);
}

.selection-card-title {
  display: grid;
  align-content: center;
  gap: 1px;
  min-width: 0;
  padding: 6px 10px;
}

.selection-card-title small,
.selection-section-title {
  color: var(--muted);
  font-size: 9px;
  font-weight: 750;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.selection-card-title strong {
  overflow: hidden;
  font-size: 14px;
  font-weight: 670;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.selection-card-close {
  width: 24px;
  height: 24px;
  margin: 6px 6px 0 0;
  padding: 0;
  border: 0;
  border-radius: 2px;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  font-size: 16px;
  line-height: 1;
}

.selection-card-close:hover {
  background: var(--control-hover);
  color: var(--foreground);
}

.selection-properties {
  display: flex;
  flex-direction: row;
  border-bottom: 1px solid var(--border);
}

.selection-property {
  flex: 1;
  min-width: 0;
  padding: 8px 12px;
  border-right: 1px solid var(--border);
}

.selection-property:last-child {
  border-right: 0;
}

.selection-property small {
  display: block;
  margin-bottom: 2px;
  color: var(--muted);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.selection-property strong {
  display: block;
  overflow: hidden;
  color: var(--foreground);
  font-size: 11px;
  font-weight: 620;
  text-overflow: clip;
  white-space: normal;
  overflow-wrap: anywhere;
}

.selection-section {
  padding: 8px 12px;
}

.selection-section-title {
  display: block;
  margin-bottom: 5px;
}

.selection-table {
  max-height: 152px;
  overflow: auto;
  border: 1px solid var(--border);
  background: var(--panel);
}

.selection-row {
  display: grid;
  grid-template-columns: minmax(48px, 0.7fr) minmax(42px, 0.55fr) minmax(0, 1.4fr);
  min-height: 26px;
  border-bottom: 1px solid var(--border);
}

.selection-row:last-child {
  border-bottom: 0;
}

.selection-row > span {
  overflow: hidden;
  padding: 5px 8px;
  border-right: 1px solid var(--border);
  color: var(--muted);
  font-size: 10px;
  text-overflow: clip;
  white-space: normal;
  overflow-wrap: anywhere;
}

.selection-row > span:last-child {
  border-right: 0;
}

.selection-row strong {
  color: var(--foreground);
  font-weight: 680;
}

.selection-empty {
  padding: 10px;
  color: var(--muted);
  font-size: 10px;
}

.selection-card-actions {
  display: flex;
  justify-content: flex-end;
  padding: 6px 12px;
  border-top: 1px solid var(--border);
  background: var(--panel);
}

.selection-card-actions button {
  min-height: 26px;
  padding: 0 8px;
  border: 1px solid var(--border);
  border-radius: 3px;
  background: var(--control);
  color: var(--foreground);
  cursor: pointer;
  font-size: 10px;
  font-weight: 650;
}

.selection-card-actions button:hover {
  border-color: var(--primary);
  background: var(--control-hover);
}

/* Net Dashboard styles */
.selection-net-dashboard {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px 12px;
}

.net-metric-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 5px;
}

.metric-card {
  display: flex;
  flex-direction: column;
  padding: 8px 10px;
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 3px;
}

.metric-card small {
  color: var(--muted);
  font-size: 8px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 2px;
}

.metric-card strong {
  font-size: 13px;
  color: var(--foreground);
  font-weight: 670;
}

.metric-card .unit {
  font-size: 9px;
  color: var(--muted);
  font-weight: normal;
}

.net-layers-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 4px;
}

.layer-badge {
  font-size: 9px;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 3px;
  background: var(--control-hover);
  color: var(--foreground);
  border: 1px solid var(--border);
}

.layer-badge.unknown {
  color: var(--muted);
  font-style: italic;
}

.pin-row-interactive {
  cursor: pointer;
  transition: background 100ms ease;
}

.pin-row-interactive:hover {
  background: color-mix(in srgb, var(--primary) 12%, transparent);
}

.refdes-col {
  color: var(--primary) !important;
}

.refdes-col:hover {
  text-decoration: underline;
}

.pin-col {
  font-weight: 600;
}

.compact-scroll::-webkit-scrollbar {
  width: 4px;
  height: 4px;
}

.compact-scroll::-webkit-scrollbar-thumb {
  background: var(--border);
  border-radius: 2px;
}

.compact-scroll::-webkit-scrollbar-thumb:hover {
  background: var(--muted);
}

.selection-card-actions button {
  margin-left: 6px;
}

.selection-card-actions button.active {
  background: var(--primary);
  color: white;
  border-color: var(--primary);
}

#fallback {
  position: absolute;
  inset: 16px;
  color: #171d28;
  font-size: 13px;
}

.panel {
  display: grid;
  grid-template-columns: 46px minmax(0, 1fr);
  min-width: 0;
  min-height: 0;
  border-left: 1px solid var(--border);
  background: var(--panel);
}

.panel-rail {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  border-right: 1px solid var(--border);
  background: var(--panel);
}

.rail-tab {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 94px;
  padding: 0;
  border: 0;
  border-bottom: 1px solid var(--border);
  background: transparent;
  color: #718096;
  cursor: pointer;
  font-size: 11px;
  font-weight: 650;
  letter-spacing: 0;
  writing-mode: vertical-rl;
  transform: rotate(180deg);
  transition: color 120ms ease, background 120ms ease;
}

.rail-tab:hover {
  background: var(--control);
  color: var(--foreground);
}

.rail-tab.active {
  box-shadow: inset -2px 0 var(--primary);
  background: var(--panel-raised);
  color: var(--foreground);
}

.panel-drawer {
  min-width: 0;
  overflow: auto;
  padding: 18px;
  opacity: 1;
  transition: opacity 100ms ease;
}

.panel-collapsed .panel-drawer {
  visibility: hidden;
  padding: 0;
  opacity: 0;
}

.panel header {
  margin-bottom: 18px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--border);
}

.eyebrow {
  margin: 0 0 5px;
  color: #60a5fa;
  font-size: 10px;
  font-weight: 750;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

h1,
h2 {
  margin: 0;
  letter-spacing: 0;
}

h1 {
  overflow: hidden;
  font-size: 18px;
  line-height: 1.25;
  text-overflow: ellipsis;
  white-space: nowrap;
}

h2 {
  font-size: 13px;
  font-weight: 700;
}

#status {
  margin: 7px 0 0;
  color: var(--muted);
  font-size: 12px;
}

.tab-panel {
  display: none;
}

.tab-panel.active {
  display: block;
}

.section-heading {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.section-heading span {
  color: var(--muted);
  font-size: 10px;
}

.mode-toolbar {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px;
  padding: 3px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--panel-raised);
}

.mode-toolbar button,
.layer-presets button,
.quick-actions button {
  min-width: 0;
  height: 32px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  transition: all 120ms ease;
}

.mode-toolbar button:hover,
.layer-presets button:hover,
.quick-actions button:hover {
  background: var(--control-hover);
  color: var(--foreground);
}

.mode-toolbar button.active,
.quick-actions button.active {
  background: var(--control-hover);
  border: 1px solid var(--border);
  color: var(--foreground);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
}

.layer-presets,
.quick-actions {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 4px;
  margin-top: 10px;
}

.layer-presets button,
.quick-actions button {
  border: 1px solid var(--border);
  background: var(--control);
  font-size: 11px;
}

.layer-list {
  display: grid;
  gap: 1px;
  margin-top: 12px;
}

.layer-row {
  display: grid;
  grid-template-columns: 16px 12px minmax(0, 1fr) auto;
  gap: 8px;
  align-items: center;
  min-height: 31px;
  padding: 0 7px;
  border-radius: 4px;
  color: #d9e0ea;
  font-size: 12px;
}

.layer-row:hover {
  background: #111b2a;
}

.layer-row input,
.toggle-row input {
  width: 14px;
  height: 14px;
  margin: 0;
  accent-color: var(--primary);
}

.layer-row small {
  color: #68758a;
  font-size: 10px;
  font-variant-numeric: tabular-nums;
}

.swatch {
  width: 11px;
  height: 11px;
  border: 1px solid rgba(255, 255, 255, 0.25);
  border-radius: 2px;
}

.control-field {
  display: grid;
  gap: 7px;
  margin-top: 12px;
}

.control-field > span {
  color: var(--muted);
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
}

.layer-select {
  width: 100%;
  height: 36px;
  padding: 0 10px;
  border: 1px solid var(--border);
  border-radius: 5px;
  outline: none;
  background: var(--control);
  color: var(--foreground);
  font-size: 12px;
}

.layer-select:focus {
  border-color: #3974be;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.13);
}

.search-results {
  display: grid;
  gap: 2px;
}

.search-results button {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
  width: 100%;
  min-height: 32px;
  padding: 6px 8px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--foreground);
  text-align: left;
  cursor: pointer;
}

.search-results button:hover {
  background: var(--control);
}

.search-results span {
  overflow: hidden;
  color: var(--muted);
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.camera-toolbar {
  margin-bottom: 14px;
}

.toggle-list {
  display: grid;
  gap: 2px;
  padding: 8px 0;
  border-top: 1px solid var(--border);
  border-bottom: 1px solid var(--border);
}

.toggle-row {
  display: grid;
  grid-template-columns: 16px minmax(0, 1fr);
  gap: 8px;
  align-items: center;
  min-height: 32px;
  color: #dce3ed;
  font-size: 12px;
}

.range-field {
  margin-top: 18px;
}

input[type="range"] {
  width: 100%;
  height: 4px;
  margin: 8px 0;
  accent-color: var(--primary);
}

pre {
  overflow: auto;
  max-height: calc(100vh - 170px);
  margin: 0;
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: 5px;
  background: #070c14;
  color: #dbe4f0;
  font-family: "SFMono-Regular", Consolas, monospace;
  font-size: 11px;
  line-height: 1.5;
  white-space: pre-wrap;
}

#diagnostics {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 8px 14px;
  margin: 0;
  font-size: 11px;
}

#diagnostics dt {
  color: var(--muted);
}

#diagnostics dd {
  margin: 0;
  color: #dbe4f0;
  text-align: right;
  font-variant-numeric: tabular-nums;
}

#schematic-labels {
  position: absolute;
  inset: 0;
  z-index: 3;
  pointer-events: none;
}

#schematic-labels[hidden] {
  display: none;
}

.schematic-page-label {
  position: absolute;
  display: grid;
  gap: 1px;
  min-width: 96px;
  max-width: 220px;
  padding: 5px 7px;
  border-left: 2px solid #4b8de8;
  background: rgba(8, 13, 22, 0.88);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.22);
  color: #edf3fb;
  font-size: 10px;
  transform: translateY(-100%);
  backdrop-filter: blur(8px);
}

.schematic-page-label strong {
  overflow: hidden;
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.schematic-page-label small {
  color: #8f9caf;
  font-size: 8px;
}

.page-list {
  display: grid;
  gap: 2px;
  margin-top: 12px;
}

.page-row {
  display: grid;
  grid-template-columns: 26px minmax(0, 1fr) auto;
  gap: 8px;
  align-items: center;
  min-height: 36px;
  padding: 0 8px;
  border: 1px solid transparent;
  border-radius: 3px;
  background: transparent;
  color: #dce3ee;
  cursor: pointer;
  text-align: left;
}

.page-row:hover {
  border-color: #28364a;
  background: #111a28;
}

.page-row.active {
  border-color: #346db6;
  background: #14243c;
}

.page-row > span:first-child {
  color: #6f7d92;
  font-size: 10px;
  font-variant-numeric: tabular-nums;
}

.page-row strong {
  overflow: hidden;
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.page-row small {
  color: #718096;
  font-size: 9px;
}

@media (max-width: 900px) {
  #app {
    grid-template-columns: 42px minmax(0, 1fr) 326px;
  }

  #app.panel-collapsed {
    grid-template-columns: 42px minmax(0, 1fr) 46px;
  }
}

/* Workspace specific panel rail controls */
.workspace-schematic [data-tab="view"] {
  display: none !important;
}

.workspace-schematic [data-tab="stackup"],
.workspace-bom [data-tab="stackup"] {
  display: none !important;
}

/* Stackup Workspace layout */
#app.workspace-stackup {
  grid-template-columns: 48px minmax(0, 1fr);
}

.workspace-stackup .panel {
  display: none !important;
}

#stackup-workspace-view {
  position: absolute;
  inset: 0;
  z-index: 2;
  overflow-y: auto;
  background: var(--shell);
  color: var(--foreground);
  padding: 24px 32px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

#stackup-workspace-view[hidden] {
  display: none !important;
}

.stackup-header {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.stackup-header-title {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.stackup-header-title h1 {
  font-size: 20px;
  font-weight: 700;
  margin: 0;
  color: var(--foreground);
}

.stackup-header-title p {
  font-size: 13px;
  color: var(--muted);
  margin: 0;
}

.stackup-summary-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.stackup-summary-card {
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.stackup-summary-card label {
  font-size: 9px;
  color: var(--muted);
  text-transform: uppercase;
  font-weight: 700;
  letter-spacing: 0.05em;
}

.stackup-summary-card span {
  font-size: 16px;
  font-weight: 650;
  color: var(--foreground);
}

.stackup-workspace-body {
  display: grid;
  grid-template-columns: minmax(520px, 1fr) minmax(360px, 44vw);
  gap: 28px;
  align-items: start;
  min-height: 0;
}

.stackup-diagram-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  align-items: center;
  justify-content: center;
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 6px;
  min-height: min(640px, calc(100vh - 260px));
  padding: 32px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.stackup-visual-svg {
  width: 100%;
  max-width: 760px;
  height: auto;
  overflow: visible;
}

.stackup-side-panel {
  display: flex;
  flex-direction: column;
  gap: 18px;
  min-width: 0;
}

.stackup-svg-layer {
  cursor: pointer;
  transition: opacity 120ms ease, filter 120ms ease;
}

.stackup-svg-layer:hover {
  filter: brightness(1.2) contrast(1.1);
  opacity: 0.95;
}

.stackup-svg-layer.active rect {
  stroke: var(--primary);
  stroke-width: 1.5px;
  filter: brightness(1.3);
}

.stackup-tables-container {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.stackup-table-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.stackup-section-title {
  color: var(--muted);
  font-size: 10px;
  font-weight: 750;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  margin-bottom: 2px;
}

.stackup-table-wrapper {
  overflow: auto;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--panel);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  max-height: min(360px, calc(100vh - 420px));
}

.stackup-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 11px;
  text-align: left;
}

.stackup-table th {
  position: sticky;
  top: 0;
  background: var(--control);
  color: var(--muted);
  font-weight: 700;
  padding: 8px 12px;
  border-bottom: 1px solid var(--border);
  text-transform: uppercase;
  font-size: 9px;
  letter-spacing: 0.05em;
  z-index: 1;
}

.stackup-table td {
  padding: 8px 12px;
  border-bottom: 1px solid var(--border);
  color: var(--foreground);
  vertical-align: middle;
}

.stackup-table tr:last-child td {
  border-bottom: 0;
}

.stackup-table tr.active td {
  background: rgba(59, 130, 246, 0.1);
  color: var(--primary);
}

.stackup-table tr:hover td {
  background: var(--control-hover);
}

.stackup-badge {
  display: inline-block;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 8px;
  font-weight: 700;
  text-transform: uppercase;
}

.stackup-badge.copper {
  background: rgba(224, 133, 36, 0.15);
  color: #f97316;
}

.stackup-badge.dielectric {
  background: rgba(169, 141, 92, 0.15);
  color: #ca8a04;
}

.stackup-badge.mask {
  background: rgba(47, 107, 79, 0.15);
  color: #10b981;
}

.stackup-badge.paste {
  background: rgba(203, 213, 225, 0.12);
  color: #cbd5e1;
}

.stackup-badge.silk {
  background: rgba(255, 255, 255, 0.1);
  color: var(--foreground);
}

@media (max-width: 1180px) {
  .stackup-workspace-body {
    grid-template-columns: 1fr;
  }

  .stackup-diagram-card {
    min-height: auto;
  }

  .stackup-table-wrapper {
    max-height: none;
  }
}

@media (max-width: 760px) {
  .stackup-summary-grid {
    grid-template-columns: 1fr;
  }
}
`;var ie=(e,t,a)=>Math.max(t,Math.min(a,e)),Dt=(e,t,a)=>e+(t-e)*a;function ta(e,t){return[e[0]+t[0],e[1]+t[1],e[2]+t[2]]}function Qr(e,t){return[e[0]-t[0],e[1]-t[1],e[2]-t[2]]}function Pt(e,t){return[e[0]*t,e[1]*t,e[2]*t]}function Zr(e){return Math.hypot(e[0],e[1],e[2])}function At(e){let t=Zr(e)||1;return Pt(e,1/t)}function ea(e,t){return[e[1]*t[2]-e[2]*t[1],e[2]*t[0]-e[0]*t[2],e[0]*t[1]-e[1]*t[0]]}function qa(e,t){return e[0]*t[0]+e[1]*t[1]+e[2]*t[2]}function Gs(e,t){let a=new Float32Array(16);for(let s=0;s<4;s+=1)for(let n=0;n<4;n+=1)a[s*4+n]=e[n]*t[s*4]+e[4+n]*t[s*4+1]+e[8+n]*t[s*4+2]+e[12+n]*t[s*4+3];return a}function Vs(e,t,a){let s=At(Qr(e,t)),n=At(ea(a,s)),r=ea(s,n);return new Float32Array([n[0],r[0],s[0],0,n[1],r[1],s[1],0,n[2],r[2],s[2],0,-qa(n,e),-qa(r,e),-qa(s,e),1])}function zs(e,t,a,s){let n=1/Math.tan(e/2);return new Float32Array([n/t,0,0,0,0,n,0,0,0,0,s/(a-s),-1,0,0,a*s/(a-s),0])}function Xs(e,t,a,s){return new Float32Array([2/e,0,0,0,0,2/t,0,0,0,0,1/(a-s),0,0,0,0,1])}function Ha(e){return[(e[0]+e[3])/2,(e[1]+e[4])/2,(e[2]+e[5])/2]}function Wa(e){return Math.max(.001,Math.hypot(e[3]-e[0],e[4]-e[1],e[5]-e[2])/2)}var aa=class{constructor(t){let a=Ha(t),s=Wa(t);this.focus=[...a],this.targetFocus=[...a],this.azimuth=-.62,this.targetAzimuth=this.azimuth,this.polar=.72,this.targetPolar=this.polar,this.distance=s*2.8,this.targetDistance=this.distance,this.orthoScale=s*2.15,this.targetOrthoScale=this.orthoScale,this.sceneRadius=s,this.fov=Math.PI/4}update(t){let a=1-Math.exp(-t*14);this.focus=this.focus.map((s,n)=>Dt(s,this.targetFocus[n],a)),this.azimuth=ei(this.azimuth,this.targetAzimuth,a),this.polar=Dt(this.polar,this.targetPolar,a),this.distance=Dt(this.distance,this.targetDistance,a),this.orthoScale=Dt(this.orthoScale,this.targetOrthoScale,a)}snap(){this.focus=[...this.targetFocus],this.azimuth=this.targetAzimuth,this.polar=this.targetPolar,this.distance=this.targetDistance,this.orthoScale=this.targetOrthoScale}basis(){let t=Math.sin(this.polar),a=Math.cos(this.polar),s=At([t*Math.sin(this.azimuth),-t*Math.cos(this.azimuth),a]),n=At([Math.cos(this.azimuth),Math.sin(this.azimuth),0]),r=At(ea(s,n));return{right:n,up:r,back:s}}matrix(t,a,s=!1,n=1){let r=Math.max(.01,t/Math.max(1,a)),{up:i,back:o}=this.basis(),c=ta(this.focus,Pt(o,this.distance)),b=Vs(c,this.focus,i),g=s?Xs(this.orthoScale*n*r,this.orthoScale*n,-this.sceneRadius*40,this.sceneRadius*40):zs(this.fov,r,Math.max(this.sceneRadius*5e-4,this.distance-this.sceneRadius*3.5),this.distance+this.sceneRadius*4.5);return Gs(g,b)}orbit(t,a){this.targetAzimuth-=t*.006,this.targetPolar=ie(this.targetPolar-a*.006,.015,Math.PI-.015)}pan(t,a,s,n=!1){let{right:r,up:i}=this.basis(),o=n?this.targetOrthoScale/Math.max(1,s):2*this.targetDistance*Math.tan(this.fov/2)/Math.max(1,s),c=ta(Pt(r,-t*o),Pt(i,a*o));this.targetFocus=ta(this.targetFocus,c)}dolly(t,a=!1){let s=Math.exp(t*.0032);a?this.targetOrthoScale=ie(this.targetOrthoScale*s,this.sceneRadius*.008,this.sceneRadius*24):this.targetDistance=ie(this.targetDistance*s,this.sceneRadius*.01,this.sceneRadius*48)}frame(t){if(!t)return;let a=Wa(t);this.targetFocus=Ha(t),this.targetDistance=Math.max(a*2.8,this.sceneRadius*.02),this.targetOrthoScale=Math.max(a*2.15,this.sceneRadius*.02)}setFocus(t){this.targetFocus=[...t]}setAxis(t,a=!1){t==="z"?(this.targetAzimuth=0,this.targetPolar=a?Math.PI-.015:.015):t==="x"?(this.targetAzimuth=a?-Math.PI/2:Math.PI/2,this.targetPolar=Math.PI/2):(this.targetAzimuth=a?0:Math.PI,this.targetPolar=Math.PI/2)}rotateZ(t=1){this.targetAzimuth+=t*Math.PI/2}flip(){this.targetPolar=Math.PI-this.targetPolar}};function ei(e,t,a){let s=Math.atan2(Math.sin(t-e),Math.cos(t-e));return e+s*a}var sa=class e{static async create(t,a,s={}){let n=await fetch(a,{cache:"default"});if(!n.ok)throw new Error(`Failed to load BoM ${a}: ${n.status}`);let r=await n.json();if(r.schema!=="prism.bom_a0")throw new Error(`Unsupported BoM schema: ${r.schema||"missing"}`);let i=new e(t,r,s);return i.render(),i}constructor(t,a,s){this.container=t,this.payload=a,this.callbacks=s,this.query="",this.selectedRowId="",this.selectedReference="",this.rowsById=new Map((a.rows||[]).map(n=>[n.id,n])),this.componentIndex=new Map(Object.entries(a.componentIndex||{}))}setSelectionByReference(t,a={}){let s=this.componentIndex.get(t);s&&(this.selectedReference=t,this.selectedRowId=s.rowId,this.renderContent(),a.scroll&&this.container.querySelector(`[data-row-id="${si(s.rowId)}"]`)?.scrollIntoView({block:"center",behavior:"smooth"}))}clearSelection(){this.selectedReference="",this.selectedRowId="",this.renderContent()}render(){let t=this.filteredRows();this.container.innerHTML=`
      <section class="bom-workspace">
        <header class="bom-toolbar">
          <div>
            <p class="eyebrow">Prism BoM A0</p>
            <h2>Bill of Materials</h2>
            <span data-bom-count>${t.length} of ${(this.payload.rows||[]).length} grouped rows \xB7 ${(this.payload.components||[]).length} components</span>
          </div>
          <label class="bom-search">
            <span>Search</span>
            <input id="bom-search" type="search" value="${Oe(this.query)}" placeholder="Reference, value, footprint, manufacturer..." />
          </label>
        </header>
        <div class="bom-content" data-bom-content>
          ${this.contentHtml(t,this.payload.displayColumns||[])}
        </div>
      </section>
    `,this.bind()}renderContent(){let t=this.container.querySelector("[data-bom-content]");if(!t){this.render();return}let a=this.filteredRows();t.innerHTML=this.contentHtml(a,this.payload.displayColumns||[]);let s=this.container.querySelector("[data-bom-count]");s&&(s.textContent=`${a.length} of ${(this.payload.rows||[]).length} grouped rows \xB7 ${(this.payload.components||[]).length} components`),this.bindContent(t)}contentHtml(t,a){let s=this.rowsById.get(this.selectedRowId);return`
      <div class="bom-table-wrap">
        <table class="bom-table">
          <thead>
            <tr>${a.map(n=>`<th>${Oe(n)}</th>`).join("")}</tr>
          </thead>
          <tbody>
            ${t.map(n=>this.rowHtml(n,a)).join("")}
          </tbody>
        </table>
      </div>
      ${s?`<aside class="bom-detail">${this.detailHtml(s)}</aside>`:""}
    `}filteredRows(){let t=this.query.trim().toLowerCase(),a=this.payload.rows||[];return t?a.filter(s=>JSON.stringify(s).toLowerCase().includes(t)):a}rowHtml(t,a){return`
      <tr class="${t.id===this.selectedRowId?"selected":""}" data-row-id="${Oe(t.id)}">
        ${a.map(n=>{let r=t.fields?.[n]||"";return n==="Reference"?`<td class="bom-reference-cell">${(t.references||[]).map(i=>`
              <button class="bom-ref-chip ${i===this.selectedReference?"active":""}" data-reference="${Oe(i)}">${Oe(i)}</button>
            `).join("")}</td>`:!r&&ai(n)?'<td><span class="bom-missing">Missing</span></td>':`<td title="${Oe(r)}">${Oe(r)}</td>`}).join("")}
      </tr>
    `}detailHtml(t){let a=ti(t,this.payload.displayColumns||[],this.payload.extraColumns||[]);return`
      <div class="bom-detail-head">
        <p class="eyebrow">Line item</p>
        <h3>${Oe((t.references||[]).join(", "))}</h3>
        <span>${t.qty} component${t.qty===1?"":"s"}${t.dnp?" \xB7 DNP":""}</span>
      </div>
      <div class="bom-ref-list">
        ${(t.references||[]).map(s=>`
          <button class="bom-ref-chip detail ${s===this.selectedReference?"active":""}" data-reference="${Oe(s)}">${Oe(s)}</button>
        `).join("")}
      </div>
      <dl class="bom-field-list">
        ${a.map(([s,n])=>`
          <div>
            <dt>${Oe(s)}</dt>
            <dd>${Oe(n)}</dd>
          </div>
        `).join("")}
      </dl>
    `}bind(){let t=this.container.querySelector("#bom-search");t?.addEventListener("input",()=>{this.query=t.value,this.renderContent()}),this.bindContent(this.container)}bindContent(t){t.querySelectorAll("[data-row-id]").forEach(a=>{a.addEventListener("click",s=>{s.target.closest("[data-reference]")||(this.selectedRowId=a.dataset.rowId,this.selectedReference="",this.renderContent())})}),t.querySelectorAll("[data-reference]").forEach(a=>{a.addEventListener("click",s=>{s.stopPropagation();let n=a.dataset.reference;this.setSelectionByReference(n),this.callbacks.onSelectReference?.(n)})})}};function ti(e,t,a){let s=[],n=new Set(["Reference","Qty"].map(Ja));for(let i of t){if(i==="Reference"||i==="Qty")continue;let o=e.fields?.[i]||"";o&&(s.push([i,o]),n.add(Ja(i)))}let r=e.canonicalFields||{};for(let i of a){let o=r[i]||"";if(!o)continue;let c=Ja(i);n.has(c)||(n.add(c),s.push([i,o]))}return s}function Ja(e){return String(e||"").toLowerCase().replace(/[\s_\-()[\]/]+/g,"")}function ai(e){return["Manufacturer Part Number","Vendor Part Number","Datasheet","Footprint","Value"].includes(e)}function Oe(e){return String(e??"").replace(/[&<>"']/g,t=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[t])}function si(e){return String(e).replace(/["\\]/g,"\\$&")}var qs=class{_listeners={};addEventListener(e,t){let a=this._listeners;return a[e]===void 0&&(a[e]=[]),a[e].indexOf(t)===-1&&a[e].push(t),this}removeEventListener(e,t){let a=this._listeners[e];if(a!==void 0){let s=a.indexOf(t);s!==-1&&a.splice(s,1)}return this}dispatchEvent(e){let t=this._listeners[e.type];if(t!==void 0){let a=t.slice(0);for(let s=0,n=a.length;s<n;s++)a[s].call(this,e)}return this}dispose(){for(let e in this._listeners)delete this._listeners[e]}},st=class{_disposed=!1;_name;_parent;_child;_attributes;constructor(e,t,a,s={}){if(this._name=e,this._parent=t,this._child=a,this._attributes=s,!t.isOnGraph(a))throw new Error("Cannot connect disconnected graphs.")}getName(){return this._name}getParent(){return this._parent}getChild(){return this._child}setChild(e){return this._child=e,this}getAttributes(){return this._attributes}dispose(){this._disposed||(this._parent._destroyRef(this),this._disposed=!0)}isDisposed(){return this._disposed}},Ya=class extends qs{_emptySet=new Set;_edges=new Set;_parentEdges=new Map;_childEdges=new Map;listEdges(){return Array.from(this._edges)}listParentEdges(e){return Array.from(this._childEdges.get(e)||this._emptySet)}listParents(e){let t=new Set;for(let a of this.listParentEdges(e))t.add(a.getParent());return Array.from(t)}listChildEdges(e){return Array.from(this._parentEdges.get(e)||this._emptySet)}listChildren(e){let t=new Set;for(let a of this.listChildEdges(e))t.add(a.getChild());return Array.from(t)}disconnectParents(e,t){for(let a of this.listParentEdges(e))(!t||t(a.getParent()))&&a.dispose();return this}_createEdge(e,t,a,s){let n=new st(e,t,a,s);this._edges.add(n);let r=n.getParent();this._parentEdges.has(r)||this._parentEdges.set(r,new Set),this._parentEdges.get(r).add(n);let i=n.getChild();return this._childEdges.has(i)||this._childEdges.set(i,new Set),this._childEdges.get(i).add(n),n}_destroyEdge(e){return this._edges.delete(e),this._parentEdges.get(e.getParent()).delete(e),this._childEdges.get(e.getChild()).delete(e),this}},pe=class{list=[];constructor(e){if(e)for(let t of e)this.list.push(t)}add(e){this.list.push(e)}remove(e){let t=this.list.indexOf(e);t>=0&&this.list.splice(t,1)}removeChild(e){let t=[];for(let a of this.list)a.getChild()===e&&t.push(a);for(let a of t)this.remove(a);return t}listRefsByChild(e){let t=[];for(let a of this.list)a.getChild()===e&&t.push(a);return t}values(){return this.list}},$=class{set=new Set;map=new Map;constructor(e){if(e)for(let t of e)this.add(t)}add(e){let t=e.getChild();this.removeChild(t),this.set.add(e),this.map.set(t,e)}remove(e){this.set.delete(e),this.map.delete(e.getChild())}removeChild(e){let t=this.map.get(e)||null;return t&&this.remove(t),t}getRefByChild(e){return this.map.get(e)||null}values(){return Array.from(this.set)}},le=class{map={};constructor(e){e&&Object.assign(this.map,e)}set(e,t){this.map[e]=t}delete(e){delete this.map[e]}get(e){return this.map[e]||null}keys(){return Object.keys(this.map)}values(){return Object.values(this.map)}},W=Symbol("attributes"),at=Symbol("immutableKeys"),Hs=class Ws extends qs{_disposed=!1;graph;[W];[at];constructor(t){super(),this.graph=t,this[at]=new Set,this[W]=this._createAttributes()}getDefaults(){return{}}_createAttributes(){let t=this.getDefaults(),a={};for(let s in t){let n=t[s];if(n instanceof Ws){let r=this.graph._createEdge(s,this,n);this[at].add(s),a[s]=r}else a[s]=n}return a}isOnGraph(t){return this.graph===t.graph}isDisposed(){return this._disposed}dispose(){this._disposed||(this.graph.listChildEdges(this).forEach(t=>t.dispose()),this.graph.disconnectParents(this),this._disposed=!0,this.dispatchEvent({type:"dispose"}))}detach(){return this.graph.disconnectParents(this),this}swap(t,a){for(let s in this[W]){let n=this[W][s];if(n instanceof st){let r=n;r.getChild()===t&&this.setRef(s,a,r.getAttributes())}else if(n instanceof pe)for(let r of n.listRefsByChild(t)){let i=r.getAttributes();this.removeRef(s,t),this.addRef(s,a,i)}else if(n instanceof $){let r=n.getRefByChild(t);if(r){let i=r.getAttributes();this.removeRef(s,t),this.addRef(s,a,i)}}else if(n instanceof le)for(let r of n.keys()){let i=n.get(r);i.getChild()===t&&this.setRefMap(s,r,a,i.getAttributes())}}return this}get(t){return this[W][t]}set(t,a){return this[W][t]=a,this.dispatchEvent({type:"change",attribute:t})}getRef(t){let a=this[W][t];return a?a.getChild():null}setRef(t,a,s){if(this[at].has(t))throw new Error(`Cannot overwrite immutable attribute, "${t}".`);let n=this[W][t];if(n&&n.dispose(),!a)return this;let r=this.graph._createEdge(t,this,a,s);return this[W][t]=r,this.dispatchEvent({type:"change",attribute:t})}listRefs(t){return this.assertRefList(t).values().map(a=>a.getChild())}addRef(t,a,s){let n=this.graph._createEdge(t,this,a,s);return this.assertRefList(t).add(n),this.dispatchEvent({type:"change",attribute:t})}removeRef(t,a){let s=this.assertRefList(t);if(s instanceof pe)for(let n of s.listRefsByChild(a))n.dispose();else{let n=s.getRefByChild(a);n&&n.dispose()}return this}assertRefList(t){let a=this[W][t];if(a instanceof pe||a instanceof $)return a;throw new Error(`Expected RefList or RefSet for attribute "${t}"`)}listRefMapKeys(t){return this.assertRefMap(t).keys()}listRefMapValues(t){return this.assertRefMap(t).values().map(a=>a.getChild())}getRefMap(t,a){let s=this.assertRefMap(t).get(a);return s?s.getChild():null}setRefMap(t,a,s,n){let r=this.assertRefMap(t),i=r.get(a);if(i&&i.dispose(),!s)return this;n=Object.assign(n||{},{key:a});let o=this.graph._createEdge(t,this,s,{...n,key:a});return r.set(a,o),this.dispatchEvent({type:"change",attribute:t,key:a})}assertRefMap(t){let a=this[W][t];if(a instanceof le)return a;throw new Error(`Expected RefMap for attribute "${t}"`)}dispatchEvent(t){return super.dispatchEvent({...t,target:this}),this.graph.dispatchEvent({...t,target:this,type:`node:${t.type}`}),this}_destroyRef(t){let a=t.getName();if(this[W][a]===t)this[W][a]=null,this[at].has(a)&&t.getChild().dispose();else if(this[W][a]instanceof pe)this[W][a].remove(t);else if(this[W][a]instanceof $)this[W][a].remove(t);else if(this[W][a]instanceof le){let s=this[W][a];for(let n of s.keys())s.get(n)===t&&s.delete(n)}else return;this.graph._destroyEdge(t),this.dispatchEvent({type:"change",attribute:a})}};var tn="v4.4.0",rt="@glb.bin",E=(function(e){return e.ACCESSOR="Accessor",e.ANIMATION="Animation",e.ANIMATION_CHANNEL="AnimationChannel",e.ANIMATION_SAMPLER="AnimationSampler",e.BUFFER="Buffer",e.CAMERA="Camera",e.MATERIAL="Material",e.MESH="Mesh",e.PRIMITIVE="Primitive",e.PRIMITIVE_TARGET="PrimitiveTarget",e.NODE="Node",e.ROOT="Root",e.SCENE="Scene",e.SKIN="Skin",e.TEXTURE="Texture",e.TEXTURE_INFO="TextureInfo",e})({}),an=(function(e){return e.INTERLEAVED="interleaved",e.SEPARATE="separate",e})({}),Ue=(function(e){return e.ARRAY_BUFFER="ARRAY_BUFFER",e.ELEMENT_ARRAY_BUFFER="ELEMENT_ARRAY_BUFFER",e.INVERSE_BIND_MATRICES="INVERSE_BIND_MATRICES",e.OTHER="OTHER",e.SPARSE="SPARSE",e})({}),Le=(function(e){return e[e.R=4096]="R",e[e.G=256]="G",e[e.B=16]="B",e[e.A=1]="A",e})({}),St=(function(e){return e.GLTF="GLTF",e.GLB="GLB",e})({}),ni=class extends Float32Array{constructor(){throw super(),new Error("Unsupported typed array instantiation.")}},ba={5120:Int8Array,5121:Uint8Array,5122:Int16Array,5123:Uint16Array,5125:Uint32Array,5131:typeof Float16Array<"u"?Float16Array:ni,5126:Float32Array,5130:Float64Array},L=class{static createBufferFromDataURI(e){if(typeof Buffer>"u"){let t=atob(e.split(",")[1]),a=new Uint8Array(t.length);for(let s=0;s<t.length;s++)a[s]=t.charCodeAt(s);return a}else{let t=e.split(",")[1],a=e.indexOf("base64")>=0;return Buffer.from(t,a?"base64":"utf8")}}static encodeText(e){return new TextEncoder().encode(e)}static decodeText(e){return new TextDecoder().decode(e)}static concat(e){let t=0;for(let n of e)t+=n.byteLength;let a=new Uint8Array(t),s=0;for(let n of e)a.set(n,s),s+=n.byteLength;return a}static pad(e,t=0){let a=this.padNumber(e.byteLength);if(a===e.byteLength)return e;let s=new Uint8Array(a);if(s.set(e),t!==0)for(let n=e.byteLength;n<a;n++)s[n]=t;return s}static padNumber(e){return Math.ceil(e/4)*4}static equals(e,t){if(e===t)return!0;if(e.byteLength!==t.byteLength)return!1;let a=e.byteLength;for(;a--;)if(e[a]!==t[a])return!1;return!0}static toView(e,t=0,a=1/0){return new Uint8Array(e.buffer,e.byteOffset+t,Math.min(e.byteLength,a))}static assertView(e){if(e&&!ArrayBuffer.isView(e))throw new Error(`Method requires Uint8Array parameter; received "${typeof e}".`);return e}};var ri=class{match(e){return e.length>=3&&e[0]===255&&e[1]===216&&e[2]===255}getSize(e){let t=new DataView(e.buffer,e.byteOffset+4),a,s;for(;t.byteLength;){if(a=t.getUint16(0,!1),oi(t,a),s=t.getUint8(a+1),s===192||s===193||s===194)return[t.getUint16(a+7,!1),t.getUint16(a+5,!1)];t=new DataView(e.buffer,t.byteOffset+a+2)}throw new TypeError("Invalid JPG, no size found")}getChannels(e){return 3}},ii=class sn{static PNG_FRIED_CHUNK_NAME="CgBI";match(t){return t.length>=8&&t[0]===137&&t[1]===80&&t[2]===78&&t[3]===71&&t[4]===13&&t[5]===10&&t[6]===26&&t[7]===10}getSize(t){let a=new DataView(t.buffer,t.byteOffset);return L.decodeText(t.slice(12,16))===sn.PNG_FRIED_CHUNK_NAME?[a.getUint32(32,!1),a.getUint32(36,!1)]:[a.getUint32(16,!1),a.getUint32(20,!1)]}getChannels(t){return 4}},Xe=class{static impls={"image/jpeg":new ri,"image/png":new ii};static registerFormat(e,t){this.impls[e]=t}static getMimeType(e){for(let t in this.impls)if(this.impls[t].match(e))return t;return null}static getSize(e,t){return this.impls[t]?this.impls[t].getSize(e):null}static getChannels(e,t){return this.impls[t]?this.impls[t].getChannels(e):null}static getVRAMByteLength(e,t){if(!this.impls[t])return null;if(this.impls[t].getVRAMByteLength)return this.impls[t].getVRAMByteLength(e);let a=0,s=4,n=this.getSize(e,t);if(!n)return null;for(;n[0]>1||n[1]>1;)a+=n[0]*n[1]*s,n[0]=Math.max(Math.floor(n[0]/2),1),n[1]=Math.max(Math.floor(n[1]/2),1);return a+=1*s,a}static mimeTypeToExtension(e){return e==="image/jpeg"?"jpg":e.split("/").pop()}static extensionToMimeType(e){return e==="jpg"?"image/jpeg":e?`image/${e}`:""}};function oi(e,t){if(t>e.byteLength)throw new TypeError("Corrupt JPG, exceeded buffer limits");if(e.getUint8(t)!==255)throw new TypeError("Invalid JPG, marker table corrupted");return e}var _t=class{static basename(e){let t=e.split(/[\\/]/).pop();return t.substring(0,t.lastIndexOf("."))}static extension(e){if(e.startsWith("data:image/")){let t=e.match(/data:(image\/\w+)/)[1];return Xe.mimeTypeToExtension(t)}else{if(e.startsWith("data:model/gltf+json"))return"gltf";if(e.startsWith("data:model/gltf-binary"))return"glb";if(e.startsWith("data:application/"))return"bin"}return e.split(/[\\/]/).pop().split(/[.]/).pop()}},Za=typeof Float32Array<"u"?Float32Array:Array;Math.PI/180;180/Math.PI;function ci(){var e=new Za(3);return Za!=Float32Array&&(e[0]=0,e[1]=0,e[2]=0),e}function $a(e){var t=e[0],a=e[1],s=e[2];return Math.sqrt(t*t+a*a+s*s)}function di(e,t,a){var s=t[0],n=t[1],r=t[2],i=a[3]*s+a[7]*n+a[11]*r+a[15];return i=i||1,e[0]=(a[0]*s+a[4]*n+a[8]*r+a[12])/i,e[1]=(a[1]*s+a[5]*n+a[9]*r+a[13])/i,e[2]=(a[2]*s+a[6]*n+a[10]*r+a[14])/i,e}(function(){var e=ci();return function(t,a,s,n,r,i){var o,c;for(a||(a=3),s||(s=0),n?c=Math.min(n*a+s,t.length):c=t.length,o=s;o<c;o+=a)e[0]=t[o],e[1]=t[o+1],e[2]=t[o+2],r(e,e,i),t[o]=e[0],t[o+1]=e[1],t[o+2]=e[2];return t}})();function nn(e){let t=rn(),a=e.propertyType===E.NODE?[e]:e.listChildren();for(let s of a)s.traverse(n=>{let r=n.getMesh();if(!r)return;let i=li(r,n.getWorldMatrix());i.min.every(isFinite)&&i.max.every(isFinite)&&(es(i.min,t),es(i.max,t))});return t}function li(e,t){let a=rn();for(let s of e.listPrimitives()){let n=s.getAttribute("POSITION"),r=s.getIndices();if(!n)continue;let i=[0,0,0],o=[0,0,0];for(let c=0,b=r?r.getCount():n.getCount();c<b;c++){let g=r?r.getScalar(c):c;i=n.getElement(g,i),o=di(o,i,t),es(o,a)}}return a}function es(e,t){for(let a=0;a<3;a++)t.min[a]=Math.min(e[a],t.min[a]),t.max[a]=Math.max(e[a],t.max[a])}function rn(){return{min:[1/0,1/0,1/0],max:[-1/0,-1/0,-1/0]}}var Js="https://null.example",Qa=class{static DEFAULT_INIT={};static PROTOCOL_REGEXP=/^[a-zA-Z]+:\/\//;static dirname(e){let t=e.lastIndexOf("/");return t===-1?"./":e.substring(0,t+1)}static basename(e){return _t.basename(new URL(e,Js).pathname)}static extension(e){return _t.extension(new URL(e,Js).pathname)}static resolve(e,t){if(!this.isRelativePath(t))return t;let a=e.split("/"),s=t.split("/");a.pop();for(let n=0;n<s.length;n++)s[n]!=="."&&(s[n]===".."?a.pop():a.push(s[n]));return a.join("/")}static isAbsoluteURL(e){return this.PROTOCOL_REGEXP.test(e)}static isRelativePath(e){return!/^(?:[a-zA-Z]+:)?\//.test(e)}};function Ys(e){return Object.prototype.toString.call(e)==="[object Object]"}function Rt(e){if(Ys(e)===!1)return!1;let t=e.constructor;if(t===void 0)return!0;let a=t.prototype;return!(Ys(a)===!1||Object.hasOwn(a,"isPrototypeOf")===!1)}var fi=(function(e){return e[e.SILENT=4]="SILENT",e[e.ERROR=3]="ERROR",e[e.WARN=2]="WARN",e[e.INFO=1]="INFO",e[e.DEBUG=0]="DEBUG",e})({}),ua=class Et{static Verbosity=fi;static DEFAULT_INSTANCE=new Et(Et.Verbosity.INFO);constructor(t){this.verbosity=t}debug(t){this.verbosity<=Et.Verbosity.DEBUG&&console.debug(t)}info(t){this.verbosity<=Et.Verbosity.INFO&&console.info(t)}warn(t){this.verbosity<=Et.Verbosity.WARN&&console.warn(t)}error(t){this.verbosity<=Et.Verbosity.ERROR&&console.error(t)}};function bi(e){var t=e[0],a=e[1],s=e[2],n=e[3],r=e[4],i=e[5],o=e[6],c=e[7],b=e[8],g=e[9],h=e[10],w=e[11],y=e[12],f=e[13],d=e[14],m=e[15],l=t*i-a*r,u=t*o-s*r,p=a*o-s*i,v=b*f-g*y,T=b*d-h*y,I=g*d-h*f,k=t*I-a*T+s*v,A=r*I-i*T+o*v,_=b*p-g*u+h*l,N=y*p-f*u+d*l;return c*k-n*A+m*_-w*N}function ui(e,t,a){var s=t[0],n=t[1],r=t[2],i=t[3],o=t[4],c=t[5],b=t[6],g=t[7],h=t[8],w=t[9],y=t[10],f=t[11],d=t[12],m=t[13],l=t[14],u=t[15],p=a[0],v=a[1],T=a[2],I=a[3];return e[0]=p*s+v*o+T*h+I*d,e[1]=p*n+v*c+T*w+I*m,e[2]=p*r+v*b+T*y+I*l,e[3]=p*i+v*g+T*f+I*u,p=a[4],v=a[5],T=a[6],I=a[7],e[4]=p*s+v*o+T*h+I*d,e[5]=p*n+v*c+T*w+I*m,e[6]=p*r+v*b+T*y+I*l,e[7]=p*i+v*g+T*f+I*u,p=a[8],v=a[9],T=a[10],I=a[11],e[8]=p*s+v*o+T*h+I*d,e[9]=p*n+v*c+T*w+I*m,e[10]=p*r+v*b+T*y+I*l,e[11]=p*i+v*g+T*f+I*u,p=a[12],v=a[13],T=a[14],I=a[15],e[12]=p*s+v*o+T*h+I*d,e[13]=p*n+v*c+T*w+I*m,e[14]=p*r+v*b+T*y+I*l,e[15]=p*i+v*g+T*f+I*u,e}function hi(e,t){var a=t[0],s=t[1],n=t[2],r=t[4],i=t[5],o=t[6],c=t[8],b=t[9],g=t[10];return e[0]=Math.sqrt(a*a+s*s+n*n),e[1]=Math.sqrt(r*r+i*i+o*o),e[2]=Math.sqrt(c*c+b*b+g*g),e}function gi(e,t){var a=new Za(3);hi(a,t);var s=1/a[0],n=1/a[1],r=1/a[2],i=t[0]*s,o=t[1]*n,c=t[2]*r,b=t[4]*s,g=t[5]*n,h=t[6]*r,w=t[8]*s,y=t[9]*n,f=t[10]*r,d=i+g+f,m=0;return d>0?(m=Math.sqrt(d+1)*2,e[3]=.25*m,e[0]=(h-y)/m,e[1]=(w-c)/m,e[2]=(o-b)/m):i>g&&i>f?(m=Math.sqrt(1+i-g-f)*2,e[3]=(h-y)/m,e[0]=.25*m,e[1]=(o+b)/m,e[2]=(w+c)/m):g>f?(m=Math.sqrt(1+g-i-f)*2,e[3]=(w-c)/m,e[0]=(o+b)/m,e[1]=.25*m,e[2]=(h+y)/m):(m=Math.sqrt(1+f-i-g)*2,e[3]=(o-b)/m,e[0]=(w+c)/m,e[1]=(h+y)/m,e[2]=.25*m),e}var te=class Ut{static identity(t){return t}static eq(t,a,s=1e-5){if(t.length!==a.length)return!1;for(let n=0;n<t.length;n++)if(Math.abs(t[n]-a[n])>s)return!1;return!0}static clamp(t,a,s){return t<a?a:t>s?s:t}static decodeNormalizedInt(t,a){switch(a){case 5126:return t;case 5123:return t/65535;case 5121:return t/255;case 5122:return Math.max(t/32767,-1);case 5120:return Math.max(t/127,-1);default:throw new Error("Invalid component type.")}}static encodeNormalizedInt(t,a){switch(a){case 5126:return t;case 5123:return Math.round(Ut.clamp(t,0,1)*65535);case 5121:return Math.round(Ut.clamp(t,0,1)*255);case 5122:return Math.round(Ut.clamp(t,-1,1)*32767);case 5120:return Math.round(Ut.clamp(t,-1,1)*127);default:throw new Error("Invalid component type.")}}static decompose(t,a,s,n){let r=$a([t[0],t[1],t[2]]),i=$a([t[4],t[5],t[6]]),o=$a([t[8],t[9],t[10]]);bi(t)<0&&(r=-r),a[0]=t[12],a[1]=t[13],a[2]=t[14];let c=t.slice(),b=1/r,g=1/i,h=1/o;c[0]*=b,c[1]*=b,c[2]*=b,c[4]*=g,c[5]*=g,c[6]*=g,c[8]*=h,c[9]*=h,c[10]*=h,gi(s,c),n[0]=r,n[1]=i,n[2]=o}static compose(t,a,s,n){let r=n,i=a[0],o=a[1],c=a[2],b=a[3],g=i+i,h=o+o,w=c+c,y=i*g,f=i*h,d=i*w,m=o*h,l=o*w,u=c*w,p=b*g,v=b*h,T=b*w,I=s[0],k=s[1],A=s[2];return r[0]=(1-(m+u))*I,r[1]=(f+T)*I,r[2]=(d-v)*I,r[3]=0,r[4]=(f-T)*k,r[5]=(1-(y+u))*k,r[6]=(l+p)*k,r[7]=0,r[8]=(d+v)*A,r[9]=(l-p)*A,r[10]=(1-(y+m))*A,r[11]=0,r[12]=t[0],r[13]=t[1],r[14]=t[2],r[15]=1,r}};function pi(e,t){if(!!e!=!!t)return!1;let a=e.getChild(),s=t.getChild();return a===s||a.equals(s)}function mi(e,t){if(!!e!=!!t)return!1;let a=e.values(),s=t.values();if(a.length!==s.length)return!1;for(let n=0;n<a.length;n++){let r=a[n],i=s[n];if(r.getChild()!==i.getChild()&&!r.getChild().equals(i.getChild()))return!1}return!0}function xi(e,t){if(!!e!=!!t)return!1;let a=e.keys(),s=t.keys();if(a.length!==s.length)return!1;for(let n of a){let r=e.get(n),i=t.get(n);if(!!r!=!!i)return!1;let o=r.getChild(),c=i.getChild();if(o!==c&&!o.equals(c))return!1}return!0}function on(e,t){if(e===t)return!0;if(!!e!=!!t||!e||!t||e.length!==t.length)return!1;for(let a=0;a<e.length;a++)if(e[a]!==t[a])return!1;return!0}function cn(e,t){if(e===t)return!0;if(!!e!=!!t)return!1;if(!Rt(e)||!Rt(t))return e===t;let a=e,s=t,n=0,r=0,i;for(i in a)n++;for(i in s)r++;if(n!==r)return!1;for(i in a){let o=a[i],c=s[i];if(la(o)&&la(c)){if(!on(o,c))return!1}else if(Rt(o)&&Rt(c)){if(!cn(o,c))return!1}else if(o!==c)return!1}return!0}function la(e){return Array.isArray(e)||ArrayBuffer.isView(e)}var yi="23456789abdegjkmnpqrvwxyzABDEGJKMNPQRVWXYZ",vi=999,wi=6,$s=new Set,Ti=function(){let e="";for(let t=0;t<wi;t++)e+=yi.charAt(Math.floor(Math.random()*42));return e},Ei=function(){for(let e=0;e<vi;e++){let t=Ti();if(!$s.has(t))return $s.add(t),t}return""},it=e=>e,Ri=new Set,ns=class extends Hs{constructor(e,t=""){super(e),this[W].name=t,this.init(),this.dispatchEvent({type:"create"})}getGraph(){return this.graph}getDefaults(){return Object.assign(super.getDefaults(),{name:"",extras:{}})}set(e,t){return Array.isArray(t)&&(t=t.slice()),super.set(e,t)}getName(){return this.get("name")}setName(e){return this.set("name",e)}getExtras(){return this.get("extras")}setExtras(e){return this.set("extras",e)}clone(){let e=this.constructor;return new e(this.graph).copy(this,it)}copy(e,t=it){for(let a in this[W]){let s=this[W][a];if(s instanceof st)this[at].has(a)||s.dispose();else if(s instanceof pe||s instanceof $)for(let n of s.values())n.dispose();else if(s instanceof le)for(let n of s.values())n.dispose()}for(let a in e[W]){let s=this[W][a],n=e[W][a];if(n instanceof st)this[at].has(a)?s.getChild().copy(t(n.getChild()),t):this.setRef(a,t(n.getChild()),n.getAttributes());else if(n instanceof $||n instanceof pe)for(let r of n.values())this.addRef(a,t(r.getChild()),r.getAttributes());else if(n instanceof le)for(let r of n.keys()){let i=n.get(r);this.setRefMap(a,r,t(i.getChild()),i.getAttributes())}else Rt(n)?this[W][a]=JSON.parse(JSON.stringify(n)):Array.isArray(n)||n instanceof ArrayBuffer||ArrayBuffer.isView(n)?this[W][a]=n.slice():this[W][a]=n}return this}equals(e,t=Ri){if(this===e)return!0;if(this.propertyType!==e.propertyType)return!1;for(let a in this[W]){if(t.has(a))continue;let s=this[W][a],n=e[W][a];if(s instanceof st||n instanceof st){if(!pi(s,n))return!1}else if(s instanceof $||n instanceof $||s instanceof pe||n instanceof pe){if(!mi(s,n))return!1}else if(s instanceof le||n instanceof le){if(!xi(s,n))return!1}else if(Rt(s)||Rt(n)){if(!cn(s,n))return!1}else if(la(s)||la(n)){if(!on(s,n))return!1}else if(s!==n)return!1}return!0}detach(){return this.graph.disconnectParents(this,e=>e.propertyType!=="Root"),this}listParents(){return this.graph.listParents(this)}},ye=class extends ns{getDefaults(){return Object.assign(super.getDefaults(),{extensions:new le})}getExtension(e){return this.getRefMap("extensions",e)}setExtension(e,t){return t&&t._validateParent(this),this.setRefMap("extensions",e,t)}listExtensions(){return this.listRefMapValues("extensions")}},D=class fe extends ye{static Type={SCALAR:"SCALAR",VEC2:"VEC2",VEC3:"VEC3",VEC4:"VEC4",MAT2:"MAT2",MAT3:"MAT3",MAT4:"MAT4"};static ComponentType={BYTE:5120,UNSIGNED_BYTE:5121,SHORT:5122,UNSIGNED_SHORT:5123,UNSIGNED_INT:5125,FLOAT:5126,FLOAT16:5131,FLOAT64:5130};init(){this.propertyType=E.ACCESSOR}getDefaults(){return Object.assign(super.getDefaults(),{array:null,type:fe.Type.SCALAR,componentType:fe.ComponentType.FLOAT,normalized:!1,sparse:!1,buffer:null})}static getElementSize(t){switch(t){case fe.Type.SCALAR:return 1;case fe.Type.VEC2:return 2;case fe.Type.VEC3:return 3;case fe.Type.VEC4:return 4;case fe.Type.MAT2:return 4;case fe.Type.MAT3:return 9;case fe.Type.MAT4:return 16;default:throw new Error("Unexpected type: "+t)}}static getComponentSize(t){switch(t){case fe.ComponentType.BYTE:case fe.ComponentType.UNSIGNED_BYTE:return 1;case fe.ComponentType.SHORT:case fe.ComponentType.UNSIGNED_SHORT:return 2;case fe.ComponentType.UNSIGNED_INT:case fe.ComponentType.FLOAT:return 4;case fe.ComponentType.FLOAT16:return 2;case fe.ComponentType.FLOAT64:return 8;default:throw new Error("Unexpected component type: "+t)}}getMinNormalized(t){let a=this.getNormalized(),s=this.getElementSize(),n=this.getComponentType();if(this.getMin(t),a)for(let r=0;r<s;r++)t[r]=te.decodeNormalizedInt(t[r],n);return t}getMin(t){let a=this.getArray(),s=this.getCount(),n=this.getElementSize();for(let r=0;r<n;r++)t[r]=1/0;for(let r=0;r<s*n;r+=n)for(let i=0;i<n;i++){let o=a[r+i];Number.isFinite(o)&&(t[i]=Math.min(t[i],o))}return t}getMaxNormalized(t){let a=this.getNormalized(),s=this.getElementSize(),n=this.getComponentType();if(this.getMax(t),a)for(let r=0;r<s;r++)t[r]=te.decodeNormalizedInt(t[r],n);return t}getMax(t){let a=this.get("array"),s=this.getCount(),n=this.getElementSize();for(let r=0;r<n;r++)t[r]=-1/0;for(let r=0;r<s*n;r+=n)for(let i=0;i<n;i++){let o=a[r+i];Number.isFinite(o)&&(t[i]=Math.max(t[i],o))}return t}getCount(){let t=this.get("array");return t?t.length/this.getElementSize():0}getType(){return this.get("type")}setType(t){return this.set("type",t)}getElementSize(){return fe.getElementSize(this.get("type"))}getComponentSize(){return this.get("array").BYTES_PER_ELEMENT}getComponentType(){return this.get("componentType")}getNormalized(){return this.get("normalized")}setNormalized(t){return this.set("normalized",t)}getScalar(t){let a=this.getElementSize(),s=this.getComponentType(),n=this.getArray();return this.getNormalized()?te.decodeNormalizedInt(n[t*a],s):n[t*a]}setScalar(t,a){let s=this.getElementSize(),n=this.getComponentType(),r=this.getArray();return this.getNormalized()?r[t*s]=te.encodeNormalizedInt(a,n):r[t*s]=a,this}getElement(t,a){let s=this.getNormalized(),n=this.getElementSize(),r=this.getComponentType(),i=this.getArray();for(let o=0;o<n;o++)s?a[o]=te.decodeNormalizedInt(i[t*n+o],r):a[o]=i[t*n+o];return a}setElement(t,a){let s=this.getNormalized(),n=this.getElementSize(),r=this.getComponentType(),i=this.getArray();for(let o=0;o<n;o++)s?i[t*n+o]=te.encodeNormalizedInt(a[o],r):i[t*n+o]=a[o];return this}getSparse(){return this.get("sparse")}setSparse(t){return this.set("sparse",t)}getBuffer(){return this.getRef("buffer")}setBuffer(t){return this.setRef("buffer",t)}getArray(){return this.get("array")}setArray(t){return this.set("componentType",t?Ii(t):fe.ComponentType.FLOAT),this.set("array",t),this}getByteLength(){let t=this.get("array");return t?t.byteLength:0}};function Ii(e){switch(e.constructor){case Float32Array:return D.ComponentType.FLOAT;case Uint32Array:return D.ComponentType.UNSIGNED_INT;case Uint16Array:return D.ComponentType.UNSIGNED_SHORT;case Uint8Array:return D.ComponentType.UNSIGNED_BYTE;case Int16Array:return D.ComponentType.SHORT;case Int8Array:return D.ComponentType.BYTE;case Float64Array:return D.ComponentType.FLOAT64}if(typeof Float16Array<"u"&&e.constructor===Float16Array)return D.ComponentType.FLOAT16;throw new Error("Unknown accessor componentType.")}var dn=class extends ye{init(){this.propertyType=E.ANIMATION}getDefaults(){return Object.assign(super.getDefaults(),{channels:new $,samplers:new $})}addChannel(e){return this.addRef("channels",e)}removeChannel(e){return this.removeRef("channels",e)}listChannels(){return this.listRefs("channels")}addSampler(e){return this.addRef("samplers",e)}removeSampler(e){return this.removeRef("samplers",e)}listSamplers(){return this.listRefs("samplers")}},rs=class extends ye{static TargetPath={TRANSLATION:"translation",ROTATION:"rotation",SCALE:"scale",WEIGHTS:"weights"};init(){this.propertyType=E.ANIMATION_CHANNEL}getDefaults(){return Object.assign(super.getDefaults(),{targetPath:null,targetNode:null,sampler:null})}getTargetPath(){return this.get("targetPath")}setTargetPath(e){return this.set("targetPath",e)}getTargetNode(){return this.getRef("targetNode")}setTargetNode(e){return this.setRef("targetNode",e)}getSampler(){return this.getRef("sampler")}setSampler(e){return this.setRef("sampler",e)}},ha=class ln extends ye{static Interpolation={LINEAR:"LINEAR",STEP:"STEP",CUBICSPLINE:"CUBICSPLINE"};init(){this.propertyType=E.ANIMATION_SAMPLER}getDefaultAttributes(){return Object.assign(super.getDefaults(),{interpolation:ln.Interpolation.LINEAR,input:null,output:null})}getInterpolation(){return this.get("interpolation")}setInterpolation(t){return this.set("interpolation",t)}getInput(){return this.getRef("input")}setInput(t){return this.setRef("input",t,{usage:Ue.OTHER})}getOutput(){return this.getRef("output")}setOutput(t){return this.setRef("output",t,{usage:Ue.OTHER})}},fn=class extends ye{init(){this.propertyType=E.BUFFER}getDefaults(){return Object.assign(super.getDefaults(),{uri:""})}getURI(){return this.get("uri")}setURI(e){return this.set("uri",e)}},ga=class bn extends ye{static Type={PERSPECTIVE:"perspective",ORTHOGRAPHIC:"orthographic"};init(){this.propertyType=E.CAMERA}getDefaults(){return Object.assign(super.getDefaults(),{type:bn.Type.PERSPECTIVE,znear:.1,zfar:100,aspectRatio:null,yfov:Math.PI*2*50/360,xmag:1,ymag:1})}getType(){return this.get("type")}setType(t){return this.set("type",t)}getZNear(){return this.get("znear")}setZNear(t){return this.set("znear",t)}getZFar(){return this.get("zfar")}setZFar(t){return this.set("zfar",t)}getAspectRatio(){return this.get("aspectRatio")}setAspectRatio(t){return this.set("aspectRatio",t)}getYFov(){return this.get("yfov")}setYFov(t){return this.set("yfov",t)}getXMag(){return this.get("xmag")}setXMag(t){return this.set("xmag",t)}getYMag(){return this.get("ymag")}setYMag(t){return this.set("ymag",t)}},z=class extends ns{static EXTENSION_NAME;_validateParent(e){if(!this.parentTypes.includes(e.propertyType))throw new Error(`Parent "${e.propertyType}" invalid for child "${this.propertyType}".`)}},ee=class ts extends ye{static WrapMode={CLAMP_TO_EDGE:33071,MIRRORED_REPEAT:33648,REPEAT:10497};static MagFilter={NEAREST:9728,LINEAR:9729};static MinFilter={NEAREST:9728,LINEAR:9729,NEAREST_MIPMAP_NEAREST:9984,LINEAR_MIPMAP_NEAREST:9985,NEAREST_MIPMAP_LINEAR:9986,LINEAR_MIPMAP_LINEAR:9987};init(){this.propertyType=E.TEXTURE_INFO}getDefaults(){return Object.assign(super.getDefaults(),{texCoord:0,magFilter:null,minFilter:null,wrapS:ts.WrapMode.REPEAT,wrapT:ts.WrapMode.REPEAT})}getTexCoord(){return this.get("texCoord")}setTexCoord(t){return this.set("texCoord",t)}getMagFilter(){return this.get("magFilter")}setMagFilter(t){return this.set("magFilter",t)}getMinFilter(){return this.get("minFilter")}setMinFilter(t){return this.set("minFilter",t)}getWrapS(){return this.get("wrapS")}setWrapS(t){return this.set("wrapS",t)}getWrapT(){return this.get("wrapT")}setWrapT(t){return this.set("wrapT",t)}},{R:na,G:ra,B:ia,A:ki}=Le,fa=class un extends ye{static AlphaMode={OPAQUE:"OPAQUE",MASK:"MASK",BLEND:"BLEND"};init(){this.propertyType=E.MATERIAL}getDefaults(){return Object.assign(super.getDefaults(),{alphaMode:un.AlphaMode.OPAQUE,alphaCutoff:.5,doubleSided:!1,baseColorFactor:[1,1,1,1],baseColorTexture:null,baseColorTextureInfo:new ee(this.graph,"baseColorTextureInfo"),emissiveFactor:[0,0,0],emissiveTexture:null,emissiveTextureInfo:new ee(this.graph,"emissiveTextureInfo"),normalScale:1,normalTexture:null,normalTextureInfo:new ee(this.graph,"normalTextureInfo"),occlusionStrength:1,occlusionTexture:null,occlusionTextureInfo:new ee(this.graph,"occlusionTextureInfo"),roughnessFactor:1,metallicFactor:1,metallicRoughnessTexture:null,metallicRoughnessTextureInfo:new ee(this.graph,"metallicRoughnessTextureInfo")})}getDoubleSided(){return this.get("doubleSided")}setDoubleSided(t){return this.set("doubleSided",t)}getAlpha(){return this.get("baseColorFactor")[3]}setAlpha(t){let a=this.get("baseColorFactor").slice();return a[3]=t,this.set("baseColorFactor",a)}getAlphaMode(){return this.get("alphaMode")}setAlphaMode(t){return this.set("alphaMode",t)}getAlphaCutoff(){return this.get("alphaCutoff")}setAlphaCutoff(t){return this.set("alphaCutoff",t)}getBaseColorFactor(){return this.get("baseColorFactor")}setBaseColorFactor(t){return this.set("baseColorFactor",t)}getBaseColorTexture(){return this.getRef("baseColorTexture")}getBaseColorTextureInfo(){return this.getRef("baseColorTexture")?this.getRef("baseColorTextureInfo"):null}setBaseColorTexture(t){return this.setRef("baseColorTexture",t,{channels:na|ra|ia|ki,isColor:!0})}getEmissiveFactor(){return this.get("emissiveFactor")}setEmissiveFactor(t){return this.set("emissiveFactor",t)}getEmissiveTexture(){return this.getRef("emissiveTexture")}getEmissiveTextureInfo(){return this.getRef("emissiveTexture")?this.getRef("emissiveTextureInfo"):null}setEmissiveTexture(t){return this.setRef("emissiveTexture",t,{channels:na|ra|ia,isColor:!0})}getNormalScale(){return this.get("normalScale")}setNormalScale(t){return this.set("normalScale",t)}getNormalTexture(){return this.getRef("normalTexture")}getNormalTextureInfo(){return this.getRef("normalTexture")?this.getRef("normalTextureInfo"):null}setNormalTexture(t){return this.setRef("normalTexture",t,{channels:na|ra|ia})}getOcclusionStrength(){return this.get("occlusionStrength")}setOcclusionStrength(t){return this.set("occlusionStrength",t)}getOcclusionTexture(){return this.getRef("occlusionTexture")}getOcclusionTextureInfo(){return this.getRef("occlusionTexture")?this.getRef("occlusionTextureInfo"):null}setOcclusionTexture(t){return this.setRef("occlusionTexture",t,{channels:na})}getRoughnessFactor(){return this.get("roughnessFactor")}setRoughnessFactor(t){return this.set("roughnessFactor",t)}getMetallicFactor(){return this.get("metallicFactor")}setMetallicFactor(t){return this.set("metallicFactor",t)}getMetallicRoughnessTexture(){return this.getRef("metallicRoughnessTexture")}getMetallicRoughnessTextureInfo(){return this.getRef("metallicRoughnessTexture")?this.getRef("metallicRoughnessTextureInfo"):null}setMetallicRoughnessTexture(t){return this.setRef("metallicRoughnessTexture",t,{channels:ra|ia})}},hn=class extends ye{init(){this.propertyType=E.MESH}getDefaults(){return Object.assign(super.getDefaults(),{weights:[],primitives:new $})}addPrimitive(e){return this.addRef("primitives",e)}removePrimitive(e){return this.removeRef("primitives",e)}listPrimitives(){return this.listRefs("primitives")}getWeights(){return this.get("weights")}setWeights(e){return this.set("weights",e)}},gn=class extends ye{init(){this.propertyType=E.NODE}getDefaults(){return Object.assign(super.getDefaults(),{translation:[0,0,0],rotation:[0,0,0,1],scale:[1,1,1],weights:[],camera:null,mesh:null,skin:null,children:new $})}copy(e,t=it){if(t===it)throw new Error("Node cannot be copied.");return super.copy(e,t)}getTranslation(){return this.get("translation")}getRotation(){return this.get("rotation")}getScale(){return this.get("scale")}setTranslation(e){return this.set("translation",e)}setRotation(e){return this.set("rotation",e)}setScale(e){return this.set("scale",e)}getMatrix(){return te.compose(this.get("translation"),this.get("rotation"),this.get("scale"),[])}setMatrix(e){let t=this.get("translation").slice(),a=this.get("rotation").slice(),s=this.get("scale").slice();return te.decompose(e,t,a,s),this.set("translation",t).set("rotation",a).set("scale",s)}getWorldTranslation(){let e=[0,0,0];return te.decompose(this.getWorldMatrix(),e,[0,0,0,1],[1,1,1]),e}getWorldRotation(){let e=[0,0,0,1];return te.decompose(this.getWorldMatrix(),[0,0,0],e,[1,1,1]),e}getWorldScale(){let e=[1,1,1];return te.decompose(this.getWorldMatrix(),[0,0,0],[0,0,0,1],e),e}getWorldMatrix(){let e=[];for(let s=this;s!=null;s=s.getParentNode())e.push(s);let t,a=e.pop().getMatrix();for(;t=e.pop();)ui(a,a,t.getMatrix());return a}addChild(e){let t=e.getParentNode();t&&t.removeChild(e);for(let a of e.listParents())a.propertyType===E.SCENE&&a.removeChild(e);return this.addRef("children",e)}removeChild(e){return this.removeRef("children",e)}listChildren(){return this.listRefs("children")}getParentNode(){for(let e of this.listParents())if(e.propertyType===E.NODE)return e;return null}getMesh(){return this.getRef("mesh")}setMesh(e){return this.setRef("mesh",e)}getCamera(){return this.getRef("camera")}setCamera(e){return this.setRef("camera",e)}getSkin(){return this.getRef("skin")}setSkin(e){return this.setRef("skin",e)}getWeights(){return this.get("weights")}setWeights(e){return this.set("weights",e)}traverse(e){e(this);for(let t of this.listChildren())t.traverse(e);return this}},Lt=class pn extends ye{static Mode={POINTS:0,LINES:1,LINE_LOOP:2,LINE_STRIP:3,TRIANGLES:4,TRIANGLE_STRIP:5,TRIANGLE_FAN:6};init(){this.propertyType=E.PRIMITIVE}getDefaults(){return Object.assign(super.getDefaults(),{mode:pn.Mode.TRIANGLES,material:null,indices:null,attributes:new le,targets:new $})}getIndices(){return this.getRef("indices")}setIndices(t){return this.setRef("indices",t,{usage:Ue.ELEMENT_ARRAY_BUFFER})}getAttribute(t){return this.getRefMap("attributes",t)}setAttribute(t,a){return this.setRefMap("attributes",t,a,{usage:Ue.ARRAY_BUFFER})}listAttributes(){return this.listRefMapValues("attributes")}listSemantics(){return this.listRefMapKeys("attributes")}getMaterial(){return this.getRef("material")}setMaterial(t){return this.setRef("material",t)}getMode(){return this.get("mode")}setMode(t){return this.set("mode",t)}listTargets(){return this.listRefs("targets")}addTarget(t){return this.addRef("targets",t)}removeTarget(t){return this.removeRef("targets",t)}},Mi=class extends ns{init(){this.propertyType=E.PRIMITIVE_TARGET}getDefaults(){return Object.assign(super.getDefaults(),{attributes:new le})}getAttribute(e){return this.getRefMap("attributes",e)}setAttribute(e,t){return this.setRefMap("attributes",e,t,{usage:Ue.ARRAY_BUFFER})}listAttributes(){return this.listRefMapValues("attributes")}listSemantics(){return this.listRefMapKeys("attributes")}},mn=class extends ye{init(){this.propertyType=E.SCENE}getDefaults(){return Object.assign(super.getDefaults(),{children:new $})}copy(e,t=it){if(t===it)throw new Error("Scene cannot be copied.");return super.copy(e,t)}addChild(e){let t=e.getParentNode();return t&&t.removeChild(e),this.addRef("children",e)}removeChild(e){return this.removeRef("children",e)}listChildren(){return this.listRefs("children")}traverse(e){for(let t of this.listChildren())t.traverse(e);return this}},xn=class extends ye{init(){this.propertyType=E.SKIN}getDefaults(){return Object.assign(super.getDefaults(),{skeleton:null,inverseBindMatrices:null,joints:new $})}getSkeleton(){return this.getRef("skeleton")}setSkeleton(e){return this.setRef("skeleton",e)}getInverseBindMatrices(){return this.getRef("inverseBindMatrices")}setInverseBindMatrices(e){return this.setRef("inverseBindMatrices",e,{usage:Ue.INVERSE_BIND_MATRICES})}addJoint(e){return this.addRef("joints",e)}removeJoint(e){return this.removeRef("joints",e)}listJoints(){return this.listRefs("joints")}},yn=class extends ye{init(){this.propertyType=E.TEXTURE}getDefaults(){return Object.assign(super.getDefaults(),{image:null,mimeType:"",uri:""})}getMimeType(){return this.get("mimeType")||Xe.extensionToMimeType(_t.extension(this.get("uri")))}setMimeType(e){return this.set("mimeType",e)}getURI(){return this.get("uri")}setURI(e){this.set("uri",e);let t=Xe.extensionToMimeType(_t.extension(e));return t&&this.set("mimeType",t),this}getImage(){return this.get("image")}setImage(e){return this.set("image",L.assertView(e))}getSize(){let e=this.get("image");return e?Xe.getSize(e,this.getMimeType()):null}},is=class extends ye{_extensions=new Set;init(){this.propertyType=E.ROOT}getDefaults(){return Object.assign(super.getDefaults(),{asset:{generator:`glTF-Transform ${tn}`,version:"2.0"},defaultScene:null,accessors:new $,animations:new $,buffers:new $,cameras:new $,materials:new $,meshes:new $,nodes:new $,scenes:new $,skins:new $,textures:new $})}constructor(e){super(e),e.addEventListener("node:create",t=>{this._addChildOfRoot(t.target)})}clone(){throw new Error("Root cannot be cloned.")}copy(e,t=it){if(t===it)throw new Error("Root cannot be copied.");this.set("asset",{...e.get("asset")}),this.setName(e.getName()),this.setExtras({...e.getExtras()}),this.setDefaultScene(e.getDefaultScene()?t(e.getDefaultScene()):null);for(let a of e.listRefMapKeys("extensions")){let s=e.getExtension(a);this.setExtension(a,t(s))}return this}_addChildOfRoot(e){return e instanceof mn?this.addRef("scenes",e):e instanceof gn?this.addRef("nodes",e):e instanceof ga?this.addRef("cameras",e):e instanceof xn?this.addRef("skins",e):e instanceof hn?this.addRef("meshes",e):e instanceof fa?this.addRef("materials",e):e instanceof yn?this.addRef("textures",e):e instanceof dn?this.addRef("animations",e):e instanceof D?this.addRef("accessors",e):e instanceof fn&&this.addRef("buffers",e),this}getAsset(){return this.get("asset")}listExtensionsUsed(){return Array.from(this._extensions)}listExtensionsRequired(){return this.listExtensionsUsed().filter(e=>e.isRequired())}_enableExtension(e){return this._extensions.add(e),this}_disableExtension(e){return this._extensions.delete(e),this}listScenes(){return this.listRefs("scenes")}setDefaultScene(e){return this.setRef("defaultScene",e)}getDefaultScene(){return this.getRef("defaultScene")}listNodes(){return this.listRefs("nodes")}listCameras(){return this.listRefs("cameras")}listSkins(){return this.listRefs("skins")}listMeshes(){return this.listRefs("meshes")}listMaterials(){return this.listRefs("materials")}listTextures(){return this.listRefs("textures")}listAnimations(){return this.listRefs("animations")}listAccessors(){return this.listRefs("accessors")}listBuffers(){return this.listRefs("buffers")}},Ai=class as{_graph=new Ya;_root=new is(this._graph);_logger=ua.DEFAULT_INSTANCE;static _GRAPH_DOCUMENTS=new WeakMap;static fromGraph(t){return as._GRAPH_DOCUMENTS.get(t)||null}constructor(){as._GRAPH_DOCUMENTS.set(this._graph,this)}getRoot(){return this._root}getGraph(){return this._graph}getLogger(){return this._logger}setLogger(t){return this._logger=t,this}clone(){throw new Error("Use 'cloneDocument(source)' from '@gltf-transform/functions'.")}merge(t){throw new Error("Use 'mergeDocuments(target, source)' from '@gltf-transform/functions'.")}async transform(...t){let a=t.map(s=>s.name);for(let s of t)await s(this,{stack:a});return this}hasExtension(t){return this.getRoot().listExtensionsUsed().some(a=>a.extensionName===t)}createExtension(t){let a=t.EXTENSION_NAME;return this.getRoot().listExtensionsUsed().find(s=>s.extensionName===a)||new t(this)}disposeExtension(t){let a=this.getRoot().listExtensionsUsed().find(s=>s.extensionName===t);a&&a.dispose()}createScene(t=""){return new mn(this._graph,t)}createNode(t=""){return new gn(this._graph,t)}createCamera(t=""){return new ga(this._graph,t)}createSkin(t=""){return new xn(this._graph,t)}createMesh(t=""){return new hn(this._graph,t)}createPrimitive(){return new Lt(this._graph)}createPrimitiveTarget(t=""){return new Mi(this._graph,t)}createMaterial(t=""){return new fa(this._graph,t)}createTexture(t=""){return new yn(this._graph,t)}createAnimation(t=""){return new dn(this._graph,t)}createAnimationChannel(t=""){return new rs(this._graph,t)}createAnimationSampler(t=""){return new ha(this._graph,t)}createAccessor(t="",a=null){return a||(a=this.getRoot().listBuffers()[0]),new D(this._graph,t).setBuffer(a)}createBuffer(t=""){return new fn(this._graph,t)}},Y=class{static EXTENSION_NAME;extensionName="";prereadTypes=[];prewriteTypes=[];readDependencies=[];writeDependencies=[];document;required=!1;properties=new Set;_listener;constructor(e){this.document=e,e.getRoot()._enableExtension(this),this._listener=a=>{let s=a,n=s.target;n instanceof z&&n.extensionName===this.extensionName&&(s.type==="node:create"&&this._addExtensionProperty(n),s.type==="node:dispose"&&this._removeExtensionProperty(n))};let t=e.getGraph();t.addEventListener("node:create",this._listener),t.addEventListener("node:dispose",this._listener)}dispose(){this.document.getRoot()._disableExtension(this);let e=this.document.getGraph();e.removeEventListener("node:create",this._listener),e.removeEventListener("node:dispose",this._listener);for(let t of this.properties)t.dispose()}static register(){}isRequired(){return this.required}setRequired(e){return this.required=e,this}listProperties(){return Array.from(this.properties)}_addExtensionProperty(e){return this.properties.add(e),this}_removeExtensionProperty(e){return this.properties.delete(e),this}install(e,t){return this}preread(e,t){return this}prewrite(e,t){return this}},Si=class{buffers=[];bufferViews=[];bufferViewBuffers=[];accessors=[];textures=[];textureInfos=new Map;materials=[];meshes=[];cameras=[];nodes=[];skins=[];animations=[];scenes=[];constructor(e){this.jsonDoc=e}setTextureInfo(e,t){this.textureInfos.set(e,t),t.texCoord!==void 0&&e.setTexCoord(t.texCoord),t.extras!==void 0&&e.setExtras(t.extras);let a=this.jsonDoc.json.textures[t.index];if(a.sampler===void 0)return;let s=this.jsonDoc.json.samplers[a.sampler];s.magFilter!==void 0&&e.setMagFilter(s.magFilter),s.minFilter!==void 0&&e.setMinFilter(s.minFilter),s.wrapS!==void 0&&e.setWrapS(s.wrapS),s.wrapT!==void 0&&e.setWrapT(s.wrapT)}},Qs={logger:ua.DEFAULT_INSTANCE,extensions:[],dependencies:{}},_i=new Set([E.BUFFER,E.TEXTURE,E.MATERIAL,E.MESH,E.PRIMITIVE,E.NODE,E.SCENE]),Ni=class{static read(e,t=Qs){let a={...Qs,...t},{json:s}=e,n=new Ai().setLogger(a.logger);this.validate(e,a);let r=new Si(e),i=s.asset,o=n.getRoot().getAsset();i.copyright&&(o.copyright=i.copyright),i.extras&&(o.extras=i.extras),s.extras!==void 0&&n.getRoot().setExtras({...s.extras});let c=s.extensionsUsed||[],b=s.extensionsRequired||[];a.extensions.sort((l,u)=>l.EXTENSION_NAME>u.EXTENSION_NAME?1:-1);for(let l of a.extensions)if(c.includes(l.EXTENSION_NAME)){let u=n.createExtension(l).setRequired(b.includes(l.EXTENSION_NAME)),p=u.prereadTypes.filter(v=>!_i.has(v));p.length&&a.logger.warn(`Preread hooks for some types (${p.join()}), requested by extension ${u.extensionName}, are unsupported. Please file an issue or a PR.`);for(let v of u.readDependencies)u.install(v,a.dependencies[v])}let g=s.buffers||[];n.getRoot().listExtensionsUsed().filter(l=>l.prereadTypes.includes(E.BUFFER)).forEach(l=>l.preread(r,E.BUFFER)),r.buffers=g.map(l=>{let u=n.createBuffer(l.name);return l.extras&&u.setExtras(l.extras),l.uri&&l.uri.indexOf("__")!==0&&u.setURI(l.uri),u}),r.bufferViewBuffers=(s.bufferViews||[]).map((l,u)=>{if(!r.bufferViews[u]){let p=e.json.buffers[l.buffer],v=p.uri?e.resources[p.uri]:e.resources[rt],T=l.byteOffset||0;r.bufferViews[u]=L.toView(v,T,l.byteLength)}return r.buffers[l.buffer]});let h=s.accessors||[];r.accessors=h.map(l=>{let u=r.bufferViewBuffers[l.bufferView],p=n.createAccessor(l.name,u).setType(l.type);return l.extras&&p.setExtras(l.extras),l.normalized!==void 0&&p.setNormalized(l.normalized),l.bufferView===void 0||p.setArray(ca(l,r)),p});let w=s.images||[],y=s.textures||[];n.getRoot().listExtensionsUsed().filter(l=>l.prereadTypes.includes(E.TEXTURE)).forEach(l=>l.preread(r,E.TEXTURE)),r.textures=w.map(l=>{let u=n.createTexture(l.name);if(l.extras&&u.setExtras(l.extras),l.bufferView!==void 0){let p=s.bufferViews[l.bufferView],v=e.json.buffers[p.buffer],T=v.uri?e.resources[v.uri]:e.resources[rt],I=p.byteOffset||0,k=p.byteLength,A=T.slice(I,I+k);u.setImage(A)}else l.uri!==void 0&&(u.setImage(e.resources[l.uri]),l.uri.indexOf("__")!==0&&u.setURI(l.uri));if(l.mimeType!==void 0)u.setMimeType(l.mimeType);else if(l.uri){let p=_t.extension(l.uri);u.setMimeType(Xe.extensionToMimeType(p))}return u}),n.getRoot().listExtensionsUsed().filter(l=>l.prereadTypes.includes(E.MATERIAL)).forEach(l=>l.preread(r,E.MATERIAL)),r.materials=(s.materials||[]).map(l=>{let u=n.createMaterial(l.name);l.extras&&u.setExtras(l.extras),l.alphaMode!==void 0&&u.setAlphaMode(l.alphaMode),l.alphaCutoff!==void 0&&u.setAlphaCutoff(l.alphaCutoff),l.doubleSided!==void 0&&u.setDoubleSided(l.doubleSided);let p=l.pbrMetallicRoughness||{};if(p.baseColorFactor!==void 0&&u.setBaseColorFactor(p.baseColorFactor),l.emissiveFactor!==void 0&&u.setEmissiveFactor(l.emissiveFactor),p.metallicFactor!==void 0&&u.setMetallicFactor(p.metallicFactor),p.roughnessFactor!==void 0&&u.setRoughnessFactor(p.roughnessFactor),p.baseColorTexture!==void 0){let v=p.baseColorTexture,T=r.textures[y[v.index].source];u.setBaseColorTexture(T),r.setTextureInfo(u.getBaseColorTextureInfo(),v)}if(l.emissiveTexture!==void 0){let v=l.emissiveTexture,T=r.textures[y[v.index].source];u.setEmissiveTexture(T),r.setTextureInfo(u.getEmissiveTextureInfo(),v)}if(l.normalTexture!==void 0){let v=l.normalTexture,T=r.textures[y[v.index].source];u.setNormalTexture(T),r.setTextureInfo(u.getNormalTextureInfo(),v),l.normalTexture.scale!==void 0&&u.setNormalScale(l.normalTexture.scale)}if(l.occlusionTexture!==void 0){let v=l.occlusionTexture,T=r.textures[y[v.index].source];u.setOcclusionTexture(T),r.setTextureInfo(u.getOcclusionTextureInfo(),v),l.occlusionTexture.strength!==void 0&&u.setOcclusionStrength(l.occlusionTexture.strength)}if(p.metallicRoughnessTexture!==void 0){let v=p.metallicRoughnessTexture,T=r.textures[y[v.index].source];u.setMetallicRoughnessTexture(T),r.setTextureInfo(u.getMetallicRoughnessTextureInfo(),v)}return u}),n.getRoot().listExtensionsUsed().filter(l=>l.prereadTypes.includes(E.MESH)).forEach(l=>l.preread(r,E.MESH));let f=s.meshes||[];n.getRoot().listExtensionsUsed().filter(l=>l.prereadTypes.includes(E.PRIMITIVE)).forEach(l=>l.preread(r,E.PRIMITIVE)),r.meshes=f.map(l=>{let u=n.createMesh(l.name);return l.extras&&u.setExtras(l.extras),l.weights!==void 0&&u.setWeights(l.weights),(l.primitives||[]).forEach(p=>{let v=n.createPrimitive();p.extras&&v.setExtras(p.extras),p.material!==void 0&&v.setMaterial(r.materials[p.material]),p.mode!==void 0&&v.setMode(p.mode);for(let[I,k]of Object.entries(p.attributes||{}))v.setAttribute(I,r.accessors[k]);p.indices!==void 0&&v.setIndices(r.accessors[p.indices]);let T=l.extras&&l.extras.targetNames||[];(p.targets||[]).forEach((I,k)=>{let A=T[k]||k.toString(),_=n.createPrimitiveTarget(A);for(let[N,F]of Object.entries(I))_.setAttribute(N,r.accessors[F]);v.addTarget(_)}),u.addPrimitive(v)}),u}),r.cameras=(s.cameras||[]).map(l=>{let u=n.createCamera(l.name).setType(l.type);if(l.extras&&u.setExtras(l.extras),l.type===ga.Type.PERSPECTIVE){let p=l.perspective;u.setYFov(p.yfov),u.setZNear(p.znear),p.zfar!==void 0&&u.setZFar(p.zfar),p.aspectRatio!==void 0&&u.setAspectRatio(p.aspectRatio)}else{let p=l.orthographic;u.setZNear(p.znear).setZFar(p.zfar).setXMag(p.xmag).setYMag(p.ymag)}return u});let d=s.nodes||[];n.getRoot().listExtensionsUsed().filter(l=>l.prereadTypes.includes(E.NODE)).forEach(l=>l.preread(r,E.NODE)),r.nodes=d.map(l=>{let u=n.createNode(l.name);if(l.extras&&u.setExtras(l.extras),l.translation!==void 0&&u.setTranslation(l.translation),l.rotation!==void 0&&u.setRotation(l.rotation),l.scale!==void 0&&u.setScale(l.scale),l.matrix!==void 0){let p=[0,0,0],v=[0,0,0,1],T=[1,1,1];te.decompose(l.matrix,p,v,T),u.setTranslation(p),u.setRotation(v),u.setScale(T)}return l.weights!==void 0&&u.setWeights(l.weights),u}),r.skins=(s.skins||[]).map(l=>{let u=n.createSkin(l.name);l.extras&&u.setExtras(l.extras),l.inverseBindMatrices!==void 0&&u.setInverseBindMatrices(r.accessors[l.inverseBindMatrices]),l.skeleton!==void 0&&u.setSkeleton(r.nodes[l.skeleton]);for(let p of l.joints)u.addJoint(r.nodes[p]);return u}),d.map((l,u)=>{let p=r.nodes[u];(l.children||[]).forEach(v=>p.addChild(r.nodes[v])),l.mesh!==void 0&&p.setMesh(r.meshes[l.mesh]),l.camera!==void 0&&p.setCamera(r.cameras[l.camera]),l.skin!==void 0&&p.setSkin(r.skins[l.skin])}),r.animations=(s.animations||[]).map(l=>{let u=n.createAnimation(l.name);l.extras&&u.setExtras(l.extras);let p=(l.samplers||[]).map(v=>{let T=n.createAnimationSampler().setInput(r.accessors[v.input]).setOutput(r.accessors[v.output]).setInterpolation(v.interpolation||ha.Interpolation.LINEAR);return v.extras&&T.setExtras(v.extras),u.addSampler(T),T});return(l.channels||[]).forEach(v=>{let T=n.createAnimationChannel().setSampler(p[v.sampler]).setTargetPath(v.target.path);v.target.node!==void 0&&T.setTargetNode(r.nodes[v.target.node]),v.extras&&T.setExtras(v.extras),u.addChannel(T)}),u});let m=s.scenes||[];return n.getRoot().listExtensionsUsed().filter(l=>l.prereadTypes.includes(E.SCENE)).forEach(l=>l.preread(r,E.SCENE)),r.scenes=m.map(l=>{let u=n.createScene(l.name);return l.extras&&u.setExtras(l.extras),(l.nodes||[]).map(p=>r.nodes[p]).forEach(p=>u.addChild(p)),u}),s.scene!==void 0&&n.getRoot().setDefaultScene(r.scenes[s.scene]),n.getRoot().listExtensionsUsed().forEach(l=>l.read(r)),h.forEach((l,u)=>{let p=r.accessors[u],v=!!l.sparse,T=!l.bufferView&&!p.getArray();(v||T)&&p.setSparse(!0).setArray(Fi(l,r))}),n}static validate(e,t){let a=e.json;if(a.asset.version!=="2.0")throw new Error(`Unsupported glTF version, "${a.asset.version}".`);if(a.extensionsRequired){for(let s of a.extensionsRequired)if(!t.extensions.find(n=>n.EXTENSION_NAME===s))throw new Error(`Missing required extension, "${s}".`)}if(a.extensionsUsed)for(let s of a.extensionsUsed)t.extensions.find(n=>n.EXTENSION_NAME===s)||t.logger.warn(`Missing optional extension, "${s}".`)}};function ji(e,t){let a=t.jsonDoc,s=t.bufferViews[e.bufferView],n=a.json.bufferViews[e.bufferView],r=ba[e.componentType],i=D.getElementSize(e.type),o=r.BYTES_PER_ELEMENT,c=e.byteOffset||0,b=new r(e.count*i),g=new DataView(s.buffer,s.byteOffset,s.byteLength),h=n.byteStride;for(let w=0;w<e.count;w++)for(let y=0;y<i;y++){let f=c+w*h+y*o,d;switch(e.componentType){case D.ComponentType.FLOAT:d=g.getFloat32(f,!0);break;case D.ComponentType.UNSIGNED_INT:d=g.getUint32(f,!0);break;case D.ComponentType.UNSIGNED_SHORT:d=g.getUint16(f,!0);break;case D.ComponentType.UNSIGNED_BYTE:d=g.getUint8(f);break;case D.ComponentType.SHORT:d=g.getInt16(f,!0);break;case D.ComponentType.BYTE:d=g.getInt8(f);break;case D.ComponentType.FLOAT16:d=g.getFloat16(f,!0);break;case D.ComponentType.FLOAT64:d=g.getFloat64(f,!0);break;default:throw new Error(`Unexpected componentType "${e.componentType}".`)}b[w*i+y]=d}return b}function ca(e,t){let a=t.jsonDoc,s=t.bufferViews[e.bufferView],n=a.json.bufferViews[e.bufferView],r=ba[e.componentType],i=D.getElementSize(e.type),o=r.BYTES_PER_ELEMENT,c=i*o;if(n.byteStride!==void 0&&n.byteStride!==c)return ji(e,t);let b=s.byteOffset+(e.byteOffset||0),g=e.count*i*o;return new r(s.buffer.slice(b,b+g))}function Fi(e,t){let a=ba[e.componentType],s=D.getElementSize(e.type),n;e.bufferView!==void 0?n=ca(e,t):n=new a(e.count*s);let r=e.sparse;if(!r)return n;let i=r.count,o={...e,...r.indices,count:i,type:"SCALAR"},c={...e,...r.values,count:i},b=ca(o,t),g=ca(c,t);for(let h=0;h<o.count;h++)for(let w=0;w<s;w++)n[b[h]*s+w]=g[h*s+w];return n}var da=(function(e){return e[e.ARRAY_BUFFER=34962]="ARRAY_BUFFER",e[e.ELEMENT_ARRAY_BUFFER=34963]="ELEMENT_ARRAY_BUFFER",e})(da||{}),nt=class{static BufferViewTarget=da;static BufferViewUsage=Ue;static USAGE_TO_TARGET={[Ue.ARRAY_BUFFER]:da.ARRAY_BUFFER,[Ue.ELEMENT_ARRAY_BUFFER]:da.ELEMENT_ARRAY_BUFFER};accessorIndexMap=new Map;animationIndexMap=new Map;bufferIndexMap=new Map;cameraIndexMap=new Map;skinIndexMap=new Map;materialIndexMap=new Map;meshIndexMap=new Map;nodeIndexMap=new Map;imageIndexMap=new Map;textureDefIndexMap=new Map;textureInfoDefMap=new Map;samplerDefIndexMap=new Map;sceneIndexMap=new Map;imageBufferViews=[];otherBufferViews=new Map;otherBufferViewsIndexMap=new Map;extensionData={};bufferURIGenerator;imageURIGenerator;logger;_accessorUsageMap=new Map;accessorUsageGroupedByParent=new Set(["ARRAY_BUFFER"]);accessorParents=new Map;constructor(e,t,a){this._doc=e,this.jsonDoc=t,this.options=a;let s=e.getRoot(),n=s.listBuffers().length,r=s.listTextures().length;this.bufferURIGenerator=new Zs(n>1,()=>a.basename||"buffer"),this.imageURIGenerator=new Zs(r>1,i=>Oi(e,i)||a.basename||"texture"),this.logger=e.getLogger()}createTextureInfoDef(e,t){let a={magFilter:t.getMagFilter()||void 0,minFilter:t.getMinFilter()||void 0,wrapS:t.getWrapS(),wrapT:t.getWrapT()},s=JSON.stringify(a);this.samplerDefIndexMap.has(s)||(this.samplerDefIndexMap.set(s,this.jsonDoc.json.samplers.length),this.jsonDoc.json.samplers.push(a));let n={source:this.imageIndexMap.get(e),sampler:this.samplerDefIndexMap.get(s)},r=JSON.stringify(n);this.textureDefIndexMap.has(r)||(this.textureDefIndexMap.set(r,this.jsonDoc.json.textures.length),this.jsonDoc.json.textures.push(n));let i={index:this.textureDefIndexMap.get(r)};return t.getTexCoord()!==0&&(i.texCoord=t.getTexCoord()),Object.keys(t.getExtras()).length>0&&(i.extras=t.getExtras()),this.textureInfoDefMap.set(t,i),i}createPropertyDef(e){let t={};return e.getName()&&(t.name=e.getName()),Object.keys(e.getExtras()).length>0&&(t.extras=e.getExtras()),t}createAccessorDef(e){let t=this.createPropertyDef(e);return t.type=e.getType(),t.componentType=e.getComponentType(),t.count=e.getCount(),this._doc.getGraph().listParentEdges(e).some(a=>a.getName()==="attributes"&&a.getAttributes().key==="POSITION"||a.getName()==="input")&&(t.max=e.getMax([]).map(Math.fround),t.min=e.getMin([]).map(Math.fround)),e.getNormalized()&&(t.normalized=e.getNormalized()),t}createImageData(e,t,a){if(this.options.format===St.GLB)this.imageBufferViews.push(t),e.bufferView=this.jsonDoc.json.bufferViews.length,this.jsonDoc.json.bufferViews.push({buffer:0,byteOffset:-1,byteLength:t.byteLength});else{let s=Xe.mimeTypeToExtension(a.getMimeType());e.uri=this.imageURIGenerator.createURI(a,s),this.assignResourceURI(e.uri,t,!1)}}assignResourceURI(e,t,a){let s=this.jsonDoc.resources;if(!(e in s)){s[e]=t;return}if(t===s[e]){this.logger.warn(`Duplicate resource URI, "${e}".`);return}let n=`Resource URI "${e}" already assigned to different data.`;if(!a){this.logger.warn(n);return}throw new Error(n)}getAccessorUsage(e){let t=this._accessorUsageMap.get(e);if(t)return t;if(e.getSparse())return Ue.SPARSE;for(let a of this._doc.getGraph().listParentEdges(e)){let{usage:s}=a.getAttributes();if(s)return s;a.getParent().propertyType!==E.ROOT&&this.logger.warn(`Missing attribute ".usage" on edge, "${a.getName()}".`)}return Ue.OTHER}addAccessorToUsageGroup(e,t){let a=this._accessorUsageMap.get(e);if(a&&a!==t)throw new Error(`Accessor with usage "${a}" cannot be reused as "${t}".`);return this._accessorUsageMap.set(e,t),this}},Zs=class{counter={};constructor(e,t){this.multiple=e,this.basename=t}createURI(e,t){if(e.getURI())return e.getURI();if(this.multiple){let a=this.basename(e);return this.counter[a]=this.counter[a]||1,`${a}_${this.counter[a]++}.${t}`}else return`${this.basename(e)}.${t}`}};function Oi(e,t){let a=e.getGraph().listParentEdges(t).find(s=>s.getParent()!==e.getRoot());return a?a.getName().replace(/texture$/i,""):""}var{BufferViewUsage:oa}=nt,{UNSIGNED_INT:Ci,UNSIGNED_SHORT:Bi,UNSIGNED_BYTE:Di}=D.ComponentType,Pi=new Set([E.ACCESSOR,E.BUFFER,E.MATERIAL,E.MESH]),Ui=class{static write(e,t){let a=e.getGraph(),s=e.getRoot(),n={asset:{generator:`glTF-Transform ${tn}`,...s.getAsset()},extras:{...s.getExtras()}},r={json:n,resources:{}},i=new nt(e,r,t),o=t.logger||ua.DEFAULT_INSTANCE,c=new Set(t.extensions.map(d=>d.EXTENSION_NAME)),b=e.getRoot().listExtensionsUsed().filter(d=>c.has(d.extensionName)).sort((d,m)=>d.extensionName>m.extensionName?1:-1),g=e.getRoot().listExtensionsRequired().filter(d=>c.has(d.extensionName)).sort((d,m)=>d.extensionName>m.extensionName?1:-1);b.length<e.getRoot().listExtensionsUsed().length&&o.warn("Some extensions were not registered for I/O, and will not be written.");for(let d of b){let m=d.prewriteTypes.filter(l=>!Pi.has(l));m.length&&o.warn(`Prewrite hooks for some types (${m.join()}), requested by extension ${d.extensionName}, are unsupported. Please file an issue or a PR.`);for(let l of d.writeDependencies)d.install(l,t.dependencies[l])}function h(d,m,l,u){let p=[],v=0;for(let I of d){let k=i.createAccessorDef(I);k.bufferView=n.bufferViews.length;let A=I.getArray(),_=L.pad(L.toView(A));k.byteOffset=v,v+=_.byteLength,p.push(_),i.accessorIndexMap.set(I,n.accessors.length),n.accessors.push(k)}let T={buffer:m,byteOffset:l,byteLength:L.concat(p).byteLength};return u&&(T.target=u),n.bufferViews.push(T),{buffers:p,byteLength:v}}function w(d,m,l){let u=d[0].getCount(),p=0;for(let A of d){let _=i.createAccessorDef(A);_.bufferView=n.bufferViews.length,_.byteOffset=p;let N=A.getElementSize(),F=A.getComponentSize();p+=L.padNumber(N*F),i.accessorIndexMap.set(A,n.accessors.length),n.accessors.push(_)}let v=u*p,T=new ArrayBuffer(v),I=new DataView(T);for(let A=0;A<u;A++){let _=0;for(let N of d){let F=N.getElementSize(),j=N.getComponentSize(),B=N.getComponentType(),P=N.getArray();for(let X=0;X<F;X++){let ae=A*p+_+X*j,se=P[A*F+X];switch(B){case D.ComponentType.FLOAT:I.setFloat32(ae,se,!0);break;case D.ComponentType.BYTE:I.setInt8(ae,se);break;case D.ComponentType.SHORT:I.setInt16(ae,se,!0);break;case D.ComponentType.UNSIGNED_BYTE:I.setUint8(ae,se);break;case D.ComponentType.UNSIGNED_SHORT:I.setUint16(ae,se,!0);break;case D.ComponentType.UNSIGNED_INT:I.setUint32(ae,se,!0);break;case D.ComponentType.FLOAT16:I.setFloat16(ae,se,!0);break;case D.ComponentType.FLOAT64:I.setFloat64(ae,se,!0);break;default:throw new Error("Unexpected component type: "+B)}}_+=L.padNumber(F*j)}}let k={buffer:m,byteOffset:l,byteLength:v,byteStride:p,target:nt.BufferViewTarget.ARRAY_BUFFER};return n.bufferViews.push(k),{byteLength:v,buffers:[new Uint8Array(T)]}}function y(d,m,l){let u=[],p=0,v=new Map,T=-1/0,I=!1;for(let B of d){let P=i.createAccessorDef(B);n.accessors.push(P),i.accessorIndexMap.set(B,n.accessors.length-1);let X=[],ae=[],se=[],Ne=new Array(B.getElementSize()).fill(0);for(let xe=0,R=B.getCount();xe<R;xe++)if(B.getElement(xe,se),!te.eq(se,Ne,0)){T=Math.max(xe,T),X.push(xe);for(let O=0;O<se.length;O++)ae.push(se[O])}let de=X.length,Ae={accessorDef:P,count:de};if(v.set(B,Ae),de===0)continue;de>B.getCount()/2&&(I=!0);let je=ba[B.getComponentType()];Ae.indices=X,Ae.values=new je(ae)}if(!Number.isFinite(T))return{buffers:u,byteLength:p};I&&o.warn("Some sparse accessors have >50% non-zero elements, which may increase file size.");let k=T<255?Uint8Array:T<65535?Uint16Array:Uint32Array,A=T<255?Di:T<65535?Bi:Ci,_={buffer:m,byteOffset:l+p,byteLength:0};for(let B of d){let P=v.get(B);if(P.count===0)continue;P.indicesByteOffset=_.byteLength;let X=L.pad(L.toView(new k(P.indices)));u.push(X),p+=X.byteLength,_.byteLength+=X.byteLength}n.bufferViews.push(_);let N=n.bufferViews.length-1,F={buffer:m,byteOffset:l+p,byteLength:0};for(let B of d){let P=v.get(B);if(P.count===0)continue;P.valuesByteOffset=F.byteLength;let X=L.pad(L.toView(P.values));u.push(X),p+=X.byteLength,F.byteLength+=X.byteLength}n.bufferViews.push(F);let j=n.bufferViews.length-1;for(let B of d){let P=v.get(B);P.count!==0&&(P.accessorDef.sparse={count:P.count,indices:{bufferView:N,byteOffset:P.indicesByteOffset,componentType:A},values:{bufferView:j,byteOffset:P.valuesByteOffset}})}return{buffers:u,byteLength:p}}if(n.accessors=[],n.bufferViews=[],n.samplers=[],n.textures=[],n.images=s.listTextures().map((d,m)=>{let l=i.createPropertyDef(d);d.getMimeType()&&(l.mimeType=d.getMimeType());let u=d.getImage();return u&&i.createImageData(l,u,d),i.imageIndexMap.set(d,m),l}),b.filter(d=>d.prewriteTypes.includes(E.ACCESSOR)).forEach(d=>d.prewrite(i,E.ACCESSOR)),s.listAccessors().forEach(d=>{let m=i.accessorUsageGroupedByParent,l=i.accessorParents;if(i.accessorIndexMap.has(d))return;let u=i.getAccessorUsage(d);if(i.addAccessorToUsageGroup(d,u),m.has(u)){let p=a.listParents(d).find(v=>v.propertyType!==E.ROOT);l.set(d,p)}}),b.filter(d=>d.prewriteTypes.includes(E.BUFFER)).forEach(d=>d.prewrite(i,E.BUFFER)),(s.listAccessors().length>0||i.otherBufferViews.size>0||s.listTextures().length>0&&t.format===St.GLB)&&s.listBuffers().length===0)throw new Error("Buffer required for Document resources, but none was found.");n.buffers=[],s.listBuffers().forEach((d,m)=>{let l=i.createPropertyDef(d),u=i.accessorUsageGroupedByParent,p=d.listParents().filter(N=>N instanceof D),v=new Set(p.map(N=>i.accessorParents.get(N))),T=new Map(Array.from(v).map((N,F)=>[N,F])),I={};for(let N of p){if(i.accessorIndexMap.has(N))continue;let F=i.getAccessorUsage(N),j=F;if(u.has(F)){let B=i.accessorParents.get(N);j+=`:${T.get(B)}`}I[j]||={usage:F,accessors:[]},I[j].accessors.push(N)}let k=[],A=n.buffers.length,_=0;for(let{usage:N,accessors:F}of Object.values(I))if(N===oa.ARRAY_BUFFER&&t.vertexLayout===an.INTERLEAVED){let j=w(F,A,_);_+=j.byteLength;for(let B of j.buffers)k.push(B)}else if(N===oa.ARRAY_BUFFER)for(let j of F){let B=w([j],A,_);_+=B.byteLength;for(let P of B.buffers)k.push(P)}else if(N===oa.SPARSE){let j=y(F,A,_);_+=j.byteLength;for(let B of j.buffers)k.push(B)}else if(N===oa.ELEMENT_ARRAY_BUFFER){let j=nt.BufferViewTarget.ELEMENT_ARRAY_BUFFER,B=h(F,A,_,j);_+=B.byteLength;for(let P of B.buffers)k.push(P)}else{let j=h(F,A,_);_+=j.byteLength;for(let B of j.buffers)k.push(B)}if(i.imageBufferViews.length&&m===0){for(let N=0;N<i.imageBufferViews.length;N++)if(n.bufferViews[n.images[N].bufferView].byteOffset=_,_+=i.imageBufferViews[N].byteLength,k.push(i.imageBufferViews[N]),_%8){let F=8-_%8;_+=F,k.push(new Uint8Array(F))}}if(i.otherBufferViews.has(d))for(let N of i.otherBufferViews.get(d))n.bufferViews.push({buffer:A,byteOffset:_,byteLength:N.byteLength}),i.otherBufferViewsIndexMap.set(N,n.bufferViews.length-1),_+=N.byteLength,k.push(N);if(_){let N;t.format===St.GLB?N=rt:(N=i.bufferURIGenerator.createURI(d,"bin"),l.uri=N),l.byteLength=_,i.assignResourceURI(N,L.concat(k),!0)}n.buffers.push(l),i.bufferIndexMap.set(d,m)}),s.listAccessors().find(d=>!d.getBuffer())&&o.warn("Skipped writing one or more Accessors: no Buffer assigned."),b.filter(d=>d.prewriteTypes.includes(E.MATERIAL)).forEach(d=>d.prewrite(i,E.MATERIAL)),n.materials=s.listMaterials().map((d,m)=>{let l=i.createPropertyDef(d);if(d.getAlphaMode()!==fa.AlphaMode.OPAQUE&&(l.alphaMode=d.getAlphaMode()),d.getAlphaMode()===fa.AlphaMode.MASK&&(l.alphaCutoff=d.getAlphaCutoff()),d.getDoubleSided()&&(l.doubleSided=!0),l.pbrMetallicRoughness={},te.eq(d.getBaseColorFactor(),[1,1,1,1])||(l.pbrMetallicRoughness.baseColorFactor=d.getBaseColorFactor()),te.eq(d.getEmissiveFactor(),[0,0,0])||(l.emissiveFactor=d.getEmissiveFactor()),d.getRoughnessFactor()!==1&&(l.pbrMetallicRoughness.roughnessFactor=d.getRoughnessFactor()),d.getMetallicFactor()!==1&&(l.pbrMetallicRoughness.metallicFactor=d.getMetallicFactor()),d.getBaseColorTexture()){let u=d.getBaseColorTexture(),p=d.getBaseColorTextureInfo();l.pbrMetallicRoughness.baseColorTexture=i.createTextureInfoDef(u,p)}if(d.getEmissiveTexture()){let u=d.getEmissiveTexture(),p=d.getEmissiveTextureInfo();l.emissiveTexture=i.createTextureInfoDef(u,p)}if(d.getNormalTexture()){let u=d.getNormalTexture(),p=d.getNormalTextureInfo(),v=i.createTextureInfoDef(u,p);d.getNormalScale()!==1&&(v.scale=d.getNormalScale()),l.normalTexture=v}if(d.getOcclusionTexture()){let u=d.getOcclusionTexture(),p=d.getOcclusionTextureInfo(),v=i.createTextureInfoDef(u,p);d.getOcclusionStrength()!==1&&(v.strength=d.getOcclusionStrength()),l.occlusionTexture=v}if(d.getMetallicRoughnessTexture()){let u=d.getMetallicRoughnessTexture(),p=d.getMetallicRoughnessTextureInfo();l.pbrMetallicRoughness.metallicRoughnessTexture=i.createTextureInfoDef(u,p)}return i.materialIndexMap.set(d,m),l}),b.filter(d=>d.prewriteTypes.includes(E.MESH)).forEach(d=>d.prewrite(i,E.MESH)),n.meshes=s.listMeshes().map((d,m)=>{let l=i.createPropertyDef(d),u=null;return l.primitives=d.listPrimitives().map(p=>{let v={attributes:{}};v.mode=p.getMode();let T=p.getMaterial();T&&(v.material=i.materialIndexMap.get(T)),Object.keys(p.getExtras()).length&&(v.extras=p.getExtras());let I=p.getIndices();I&&(v.indices=i.accessorIndexMap.get(I));for(let k of p.listSemantics())v.attributes[k]=i.accessorIndexMap.get(p.getAttribute(k));for(let k of p.listTargets()){let A={};for(let _ of k.listSemantics())A[_]=i.accessorIndexMap.get(k.getAttribute(_));v.targets=v.targets||[],v.targets.push(A)}return p.listTargets().length&&!u&&(u=p.listTargets().map(k=>k.getName())),v}),d.getWeights().length&&(l.weights=d.getWeights()),u&&(l.extras=l.extras||{},l.extras.targetNames=u),i.meshIndexMap.set(d,m),l}),n.cameras=s.listCameras().map((d,m)=>{let l=i.createPropertyDef(d);if(l.type=d.getType(),l.type===ga.Type.PERSPECTIVE){l.perspective={znear:d.getZNear(),zfar:d.getZFar(),yfov:d.getYFov()};let u=d.getAspectRatio();u!==null&&(l.perspective.aspectRatio=u)}else l.orthographic={znear:d.getZNear(),zfar:d.getZFar(),xmag:d.getXMag(),ymag:d.getYMag()};return i.cameraIndexMap.set(d,m),l}),n.nodes=s.listNodes().map((d,m)=>{let l=i.createPropertyDef(d);return te.eq(d.getTranslation(),[0,0,0])||(l.translation=d.getTranslation()),te.eq(d.getRotation(),[0,0,0,1])||(l.rotation=d.getRotation()),te.eq(d.getScale(),[1,1,1])||(l.scale=d.getScale()),d.getWeights().length&&(l.weights=d.getWeights()),i.nodeIndexMap.set(d,m),l}),n.skins=s.listSkins().map((d,m)=>{let l=i.createPropertyDef(d),u=d.getInverseBindMatrices();u&&(l.inverseBindMatrices=i.accessorIndexMap.get(u));let p=d.getSkeleton();return p&&(l.skeleton=i.nodeIndexMap.get(p)),l.joints=d.listJoints().map(v=>i.nodeIndexMap.get(v)),i.skinIndexMap.set(d,m),l}),s.listNodes().forEach((d,m)=>{let l=n.nodes[m],u=d.getMesh();u&&(l.mesh=i.meshIndexMap.get(u));let p=d.getCamera();p&&(l.camera=i.cameraIndexMap.get(p));let v=d.getSkin();v&&(l.skin=i.skinIndexMap.get(v)),d.listChildren().length>0&&(l.children=d.listChildren().map(T=>i.nodeIndexMap.get(T)))}),n.animations=s.listAnimations().map((d,m)=>{let l=i.createPropertyDef(d),u=new Map;return l.samplers=d.listSamplers().map((p,v)=>{let T=i.createPropertyDef(p);return T.input=i.accessorIndexMap.get(p.getInput()),T.output=i.accessorIndexMap.get(p.getOutput()),T.interpolation=p.getInterpolation(),u.set(p,v),T}),l.channels=d.listChannels().map(p=>{let v=i.createPropertyDef(p);return v.sampler=u.get(p.getSampler()),v.target={node:i.nodeIndexMap.get(p.getTargetNode()),path:p.getTargetPath()},v}),i.animationIndexMap.set(d,m),l}),n.scenes=s.listScenes().map((d,m)=>{let l=i.createPropertyDef(d);return l.nodes=d.listChildren().map(u=>i.nodeIndexMap.get(u)),i.sceneIndexMap.set(d,m),l});let f=s.getDefaultScene();return f&&(n.scene=s.listScenes().indexOf(f)),n.extensionsUsed=b.map(d=>d.extensionName),n.extensionsRequired=g.map(d=>d.extensionName),b.forEach(d=>d.write(i)),Li(n),r}};function Li(e){let t=[];for(let a in e){let s=e[a];(Array.isArray(s)&&s.length===0||s===null||s===""||s&&typeof s=="object"&&Object.keys(s).length===0)&&t.push(a)}for(let a of t)delete e[a]}var ss=(function(e){return e[e.JSON=1313821514]="JSON",e[e.BIN=5130562]="BIN",e})(ss||{}),Ki=class{_logger=ua.DEFAULT_INSTANCE;_extensions=new Set;_dependencies={};_vertexLayout=an.INTERLEAVED;_strictResources=!0;lastReadBytes=0;lastWriteBytes=0;setLogger(e){return this._logger=e,this}registerExtensions(e){for(let t of e)this._extensions.add(t),t.register();return this}registerDependencies(e){return Object.assign(this._dependencies,e),this}setVertexLayout(e){return this._vertexLayout=e,this}setStrictResources(e){return this._strictResources=e,this}async read(e){return await this.readJSON(await this.readAsJSON(e))}async readAsJSON(e){let t=await this.readURI(e,"view");this.lastReadBytes=t.byteLength;let a=en(t)?this._binaryToJSON(t):{json:JSON.parse(L.decodeText(t)),resources:{}};return await this._readResourcesExternal(a,this.dirname(e)),this._readResourcesInternal(a),a}async readJSON(e){return e=this._copyJSON(e),this._readResourcesInternal(e),Ni.read(e,{extensions:Array.from(this._extensions),dependencies:this._dependencies,logger:this._logger})}async binaryToJSON(e){let t=this._binaryToJSON(L.assertView(e));this._readResourcesInternal(t);let a=t.json;if(a.buffers&&a.buffers.some(s=>Gi(t,s)))throw new Error("Cannot resolve external buffers with binaryToJSON().");if(a.images&&a.images.some(s=>Vi(t,s)))throw new Error("Cannot resolve external images with binaryToJSON().");return t}async readBinary(e){return this.readJSON(await this.binaryToJSON(L.assertView(e)))}async writeJSON(e,t={}){if(t.format===St.GLB&&e.getRoot().listBuffers().length>1)throw new Error("GLB must have 0\u20131 buffers.");return Ui.write(e,{format:t.format||St.GLTF,basename:t.basename||"",logger:this._logger,vertexLayout:this._vertexLayout,dependencies:{...this._dependencies},extensions:Array.from(this._extensions)})}async writeBinary(e){let{json:t,resources:a}=await this.writeJSON(e,{format:St.GLB}),s=new Uint32Array([1179937895,2,12]),n=JSON.stringify(t),r=L.pad(L.encodeText(n),32),i=L.toView(new Uint32Array([r.byteLength,1313821514])),o=L.concat([i,r]);s[s.length-1]+=o.byteLength;let c=Object.values(a)[0];if(!c||!c.byteLength)return L.concat([L.toView(s),o]);let b=L.pad(c,0),g=L.toView(new Uint32Array([b.byteLength,5130562])),h=L.concat([g,b]);return s[s.length-1]+=h.byteLength,L.concat([L.toView(s),o,h])}async _readResourcesExternal(e,t){let a=e.json.images||[],s=e.json.buffers||[],n=[...a,...s].map(async r=>{let i=r.uri;if(!i||i.match(/data:/))return Promise.resolve();try{e.resources[i]=await this.readURI(this.resolve(t,i),"view"),this.lastReadBytes+=e.resources[i].byteLength}catch(o){if(!this._strictResources&&a.includes(r))this._logger.warn(`Failed to load image URI, "${i}". ${o}`),e.resources[i]=null;else throw o}});await Promise.all(n)}_readResourcesInternal(e){function t(a){if(a.uri){if(a.uri in e.resources){L.assertView(e.resources[a.uri]);return}if(a.uri.match(/data:/)){let s=`__${Ei()}.${_t.extension(a.uri)}`;e.resources[s]=L.createBufferFromDataURI(a.uri),a.uri=s}}}(e.json.images||[]).forEach(a=>{if(a.bufferView===void 0&&a.uri===void 0)throw new Error("Missing resource URI or buffer view.");t(a)}),(e.json.buffers||[]).forEach(t)}_copyJSON(e){let{images:t,buffers:a}=e.json;return e={json:{...e.json},resources:{...e.resources}},t&&(e.json.images=t.map(s=>({...s}))),a&&(e.json.buffers=a.map(s=>({...s}))),e}_binaryToJSON(e){if(!en(e))throw new Error("Invalid glTF 2.0 binary.");let t=new Uint32Array(e.buffer,e.byteOffset+12,2);if(t[1]!==ss.JSON)throw new Error("Missing required GLB JSON chunk.");let a=20,s=t[0],n=L.decodeText(L.toView(e,a,s)),r=JSON.parse(n),i=a+s;if(e.byteLength<=i)return{json:r,resources:{}};let o=new Uint32Array(e.buffer,e.byteOffset+i,2);if(o[1]!==ss.BIN)return{json:r,resources:{}};let c=o[0],b=L.toView(e,i+8,c);return{json:r,resources:{[rt]:b}}}};function Gi(e,t){return t.uri!==void 0&&!(t.uri in e.resources)}function Vi(e,t){return t.uri!==void 0&&!(t.uri in e.resources)&&t.bufferView===void 0}function en(e){if(e.byteLength<3*Uint32Array.BYTES_PER_ELEMENT)return!1;let t=new Uint32Array(e.buffer,e.byteOffset,3);return t[0]===1179937895&&t[1]===2}var vn=class extends Ki{_fetchConfig;constructor(e=Qa.DEFAULT_INIT){super(),this._fetchConfig=e}async readURI(e,t){let a=await fetch(e,this._fetchConfig);switch(t){case"view":return new Uint8Array(await a.arrayBuffer());case"text":return a.text()}}resolve(e,t){return Qa.resolve(e,t)}dirname(e){return Qa.dirname(e)}};function zi(){return{vkFormat:0,typeSize:1,pixelWidth:0,pixelHeight:0,pixelDepth:0,layerCount:0,faceCount:1,levelCount:0,supercompressionScheme:0,levels:[],dataFormatDescriptor:[{vendorId:0,descriptorType:0,versionNumber:2,colorModel:0,colorPrimaries:1,transferFunction:2,flags:0,texelBlockDimension:[0,0,0,0],bytesPlane:[0,0,0,0,0,0,0,0],samples:[]}],keyValue:{},globalData:null}}var It=class{constructor(t,a,s,n){this._dataView=void 0,this._littleEndian=void 0,this._offset=void 0,this._dataView=new DataView(t.buffer,t.byteOffset+a,s),this._littleEndian=n,this._offset=0}_nextUint8(){let t=this._dataView.getUint8(this._offset);return this._offset+=1,t}_nextUint16(){let t=this._dataView.getUint16(this._offset,this._littleEndian);return this._offset+=2,t}_nextUint32(){let t=this._dataView.getUint32(this._offset,this._littleEndian);return this._offset+=4,t}_nextUint64(){let t=this._dataView.getUint32(this._offset,this._littleEndian),a=this._dataView.getUint32(this._offset+4,this._littleEndian),s=t+2**32*a;return this._offset+=8,s}_nextInt32(){let t=this._dataView.getInt32(this._offset,this._littleEndian);return this._offset+=4,t}_nextUint8Array(t){let a=new Uint8Array(this._dataView.buffer,this._dataView.byteOffset+this._offset,t);return this._offset+=t,a}_skip(t){return this._offset+=t,this}_scan(t,a=0){let s=this._offset,n=0;for(;this._dataView.getUint8(this._offset)!==a&&n<t;)n++,this._offset++;return n<t&&this._offset++,new Uint8Array(this._dataView.buffer,this._dataView.byteOffset+s,n)}};var Gb=new Uint8Array([0]),ve=[171,75,84,88,32,50,48,187,13,10,26,10];function wn(e){return new TextDecoder().decode(e)}function pa(e){let t=new Uint8Array(e.buffer,e.byteOffset,ve.length);if(t[0]!==ve[0]||t[1]!==ve[1]||t[2]!==ve[2]||t[3]!==ve[3]||t[4]!==ve[4]||t[5]!==ve[5]||t[6]!==ve[6]||t[7]!==ve[7]||t[8]!==ve[8]||t[9]!==ve[9]||t[10]!==ve[10]||t[11]!==ve[11])throw new Error("Missing KTX 2.0 identifier.");let a=zi(),s=17*Uint32Array.BYTES_PER_ELEMENT,n=new It(e,ve.length,s,!0);a.vkFormat=n._nextUint32(),a.typeSize=n._nextUint32(),a.pixelWidth=n._nextUint32(),a.pixelHeight=n._nextUint32(),a.pixelDepth=n._nextUint32(),a.layerCount=n._nextUint32(),a.faceCount=n._nextUint32(),a.levelCount=n._nextUint32(),a.supercompressionScheme=n._nextUint32();let r=n._nextUint32(),i=n._nextUint32(),o=n._nextUint32(),c=n._nextUint32(),b=n._nextUint64(),g=n._nextUint64(),h=Math.max(a.levelCount,1)*3*8,w=new It(e,ve.length+s,h,!0);for(let re=0,he=Math.max(a.levelCount,1);re<he;re++)a.levels.push({levelData:new Uint8Array(e.buffer,e.byteOffset+w._nextUint64(),w._nextUint64()),uncompressedByteLength:w._nextUint64()});let y=new It(e,r,i,!0);y._skip(4);let f=y._nextUint16(),d=y._nextUint16(),m=y._nextUint16(),l=y._nextUint16(),u=y._nextUint8(),p=y._nextUint8(),v=y._nextUint8(),T=y._nextUint8(),I=[y._nextUint8(),y._nextUint8(),y._nextUint8(),y._nextUint8()],k=[y._nextUint8(),y._nextUint8(),y._nextUint8(),y._nextUint8(),y._nextUint8(),y._nextUint8(),y._nextUint8(),y._nextUint8()],_={vendorId:f,descriptorType:d,versionNumber:m,colorModel:u,colorPrimaries:p,transferFunction:v,flags:T,texelBlockDimension:I,bytesPlane:k,samples:[]},j=(l/4-6)/4;for(let re=0;re<j;re++){let he={bitOffset:y._nextUint16(),bitLength:y._nextUint8(),channelType:y._nextUint8(),samplePosition:[y._nextUint8(),y._nextUint8(),y._nextUint8(),y._nextUint8()],sampleLower:Number.NEGATIVE_INFINITY,sampleUpper:Number.POSITIVE_INFINITY};he.channelType&64?(he.sampleLower=y._nextInt32(),he.sampleUpper=y._nextInt32()):(he.sampleLower=y._nextUint32(),he.sampleUpper=y._nextUint32()),_.samples[re]=he}a.dataFormatDescriptor.length=0,a.dataFormatDescriptor.push(_);let B=new It(e,o,c,!0);for(;B._offset<c;){let re=B._nextUint32(),he=B._scan(re),tt=wn(he);if(a.keyValue[tt]=B._nextUint8Array(re-he.byteLength-1),tt.match(/^ktx/i)){let Bt=wn(a.keyValue[tt]);a.keyValue[tt]=Bt.substring(0,Bt.lastIndexOf("\0"))}let Zt=re%4?4-re%4:0;B._skip(Zt)}if(g<=0)return a;let P=new It(e,b,g,!0),X=P._nextUint16(),ae=P._nextUint16(),se=P._nextUint32(),Ne=P._nextUint32(),de=P._nextUint32(),Ae=P._nextUint32(),je=[];for(let re=0,he=Math.max(a.levelCount,1);re<he;re++)je.push({imageFlags:P._nextUint32(),rgbSliceByteOffset:P._nextUint32(),rgbSliceByteLength:P._nextUint32(),alphaSliceByteOffset:P._nextUint32(),alphaSliceByteLength:P._nextUint32()});let xe=b+P._offset,R=xe+se,O=R+Ne,V=O+de,ne=new Uint8Array(e.buffer,e.byteOffset+xe,se),He=new Uint8Array(e.buffer,e.byteOffset+R,Ne),et=new Uint8Array(e.buffer,e.byteOffset+O,de),We=new Uint8Array(e.buffer,e.byteOffset+V,Ae);return a.globalData={endpointCount:X,selectorCount:ae,imageDescs:je,endpointsData:ne,selectorsData:He,tablesData:et,extendedData:We},a}var ot="EXT_mesh_gpu_instancing",Ye="EXT_mesh_features",Re="EXT_meshopt_compression",U="EXT_structural_metadata",ma="EXT_texture_webp",xa="EXT_texture_avif",Yi="KHR_accessor_float16",$i="KHR_accessor_float64",oe="KHR_draco_mesh_compression",Je="KHR_lights_punctual",ct="KHR_materials_anisotropy",dt="KHR_materials_clearcoat",lt="KHR_materials_diffuse_transmission",ft="KHR_materials_dispersion",bt="KHR_materials_emissive_strength",ut="KHR_materials_ior",ht="KHR_materials_iridescence",gt="KHR_materials_pbrSpecularGlossiness",pt="KHR_materials_sheen",mt="KHR_materials_specular",xt="KHR_materials_transmission",Nt="KHR_materials_unlit",yt="KHR_materials_volume",Se="KHR_materials_variants",Tn="KHR_mesh_primitive_restart",En="KHR_mesh_quantization",vt="KHR_node_visibility",ya="KHR_texture_basisu",wt="KHR_texture_transform",Ke="KHR_xmp_json_ld",Qi=class extends z{static EXTENSION_NAME=Ye;init(){this.extensionName=Ye,this.propertyType="FeatureID",this.parentTypes=["Features"]}getDefaults(){return Object.assign(super.getDefaults(),{nullFeatureId:null,label:"",attribute:null,texture:null,propertyTable:null})}getFeatureCount(){return this.get("featureCount")}setFeatureCount(e){return this.set("featureCount",e)}getNullFeatureID(){return this.get("nullFeatureId")}setNullFeatureID(e){return this.set("nullFeatureId",e)}getLabel(){return this.get("label")}setLabel(e){return this.set("label",e)}getAttribute(){return this.get("attribute")}setAttribute(e){return this.set("attribute",e)}getTexture(){return this.getRef("texture")}setTexture(e){return this.setRef("texture",e)}getPropertyTable(){return this.getRef("propertyTable")}setPropertyTable(e){return this.setRef("propertyTable",e)}},Zi=class extends z{static EXTENSION_NAME=Ye;init(){this.extensionName=Ye,this.propertyType="FeatureIDTexture",this.parentTypes=["FeatureID"]}getDefaults(){let e=new ee(this.graph,"textureInfo");return e.setMinFilter(ee.MagFilter.NEAREST),e.setMagFilter(ee.MagFilter.NEAREST),Object.assign(super.getDefaults(),{channels:[0],texture:null,textureInfo:e})}getChannels(){return this.get("channels")}setChannels(e){return this.set("channels",e)}getTexture(){return this.getRef("texture")}setTexture(e){return this.setRef("texture",e)}getTextureInfo(){return this.getRef("texture")?this.getRef("textureInfo"):null}},eo=class extends z{static EXTENSION_NAME=Ye;init(){this.extensionName=Ye,this.propertyType="Features",this.parentTypes=[E.PRIMITIVE]}getDefaults(){return Object.assign(super.getDefaults(),{featureIds:new $([])})}listFeatureIDs(){return this.listRefs("featureIds")}addFeatureID(e){return this.addRef("featureIds",e)}removeFeatureID(e){return this.removeRef("featureIds",e)}},Kt=Ye,us=class extends Y{extensionName=Ye;static EXTENSION_NAME=Ye;createFeatures(){return new eo(this.document.getGraph())}createFeatureID(){return new Qi(this.document.getGraph())}createFeatureIDTexture(){return new Zi(this.document.getGraph())}read(e){return(e.jsonDoc.json.meshes||[]).forEach((t,a)=>{(t.primitives||[]).forEach((s,n)=>{this._readPrimitive(e,a,s,n)})}),this}_readPrimitive(e,t,a,s){if(!a.extensions||!a.extensions[Kt])return;let n=this.createFeatures(),r=a.extensions[Kt];for(let i of r.featureIds){let o=to(this.document,this,e,i);n.addFeatureID(o)}e.meshes[t].listPrimitives()[s].setExtension(Kt,n)}write(e){let t=e.jsonDoc.json.meshes;if(!t)return this;for(let a of this.document.getRoot().listMeshes()){let s=t[e.meshIndexMap.get(a)];a.listPrimitives().forEach((n,r)=>{let i=s.primitives[r];this._writePrimitive(e,n,i)})}return this}_writePrimitive(e,t,a){let s=t.getExtension(Kt);if(!s)return;let n={featureIds:[]};s.listFeatureIDs().forEach(r=>{n.featureIds.push(so(this.document,e,r))}),a.extensions=a.extensions||{},a.extensions[Kt]=n}};function to(e,t,a,s){let n=t.createFeatureID().setFeatureCount(s.featureCount);s.nullFeatureId!==void 0&&n.setNullFeatureID(s.nullFeatureId),s.label!==void 0&&n.setLabel(s.label),s.attribute!==void 0&&n.setAttribute(s.attribute);let r=s.texture;if(r!==void 0){let i=ao(t,a,r);n.setTexture(i)}if(s.propertyTable!==void 0){let i=e.getRoot().getExtension(U).listPropertyTables();n.setPropertyTable(i[s.propertyTable])}return n}function ao(e,t,a){let s=e.createFeatureIDTexture(),{json:n}=t.jsonDoc;if(a.channels&&s.setChannels(a.channels),a.index!==void 0){let r=n.textures[a.index].source;s.setTexture(t.textures[r]),t.setTextureInfo(s.getTextureInfo(),a)}return s}function so(e,t,a){let s=e.getRoot(),n={featureCount:a.getFeatureCount()};if(a.getNullFeatureID()!=null&&(n.nullFeatureId=a.getNullFeatureID()),a.getLabel()&&(n.label=a.getLabel()),a.getAttribute()!=null&&(n.attribute=a.getAttribute()),a.getTexture()){let r=a.getTexture(),i=r.getTexture(),o=r.getTextureInfo();n.texture=t.createTextureInfoDef(i,o);let c=r.getChannels();te.eq(c,[0])||(n.texture.channels=c)}if(a.getPropertyTable()){let r=s.getExtension(U),i=a.getPropertyTable();n.propertyTable=r.listPropertyTables().indexOf(i)}return n}var ds="INSTANCE_ATTRIBUTE",no=class extends z{static EXTENSION_NAME=ot;init(){this.extensionName=ot,this.propertyType="InstancedMesh",this.parentTypes=[E.NODE]}getDefaults(){return Object.assign(super.getDefaults(),{attributes:new le})}getAttribute(e){return this.getRefMap("attributes",e)}setAttribute(e,t){return this.setRefMap("attributes",e,t,{usage:ds})}listAttributes(){return this.listRefMapValues("attributes")}listSemantics(){return this.listRefMapKeys("attributes")}},ro=class extends Y{static EXTENSION_NAME=ot;extensionName=ot;prewriteTypes=[E.ACCESSOR];createInstancedMesh(){return new no(this.document.getGraph())}read(e){return(e.jsonDoc.json.nodes||[]).forEach((t,a)=>{if(!t.extensions||!t.extensions.EXT_mesh_gpu_instancing)return;let s=t.extensions[ot],n=this.createInstancedMesh();for(let r in s.attributes)n.setAttribute(r,e.accessors[s.attributes[r]]);e.nodes[a].setExtension(ot,n)}),this}prewrite(e){e.accessorUsageGroupedByParent.add(ds);for(let t of this.properties)for(let a of t.listAttributes())e.addAccessorToUsageGroup(a,ds);return this}write(e){let t=e.jsonDoc;return this.document.getRoot().listNodes().forEach(a=>{let s=a.getExtension(ot);if(s){let n=e.nodeIndexMap.get(a),r=t.json.nodes[n],i={attributes:{}};s.listSemantics().forEach(o=>{let c=s.getAttribute(o);i.attributes[o]=e.accessorIndexMap.get(c)}),r.extensions=r.extensions||{},r.extensions[ot]=i}}),this}},ls=(function(e){return e.QUANTIZE="quantize",e.FILTER="filter",e})({}),va=(function(e){return e.ATTRIBUTES="ATTRIBUTES",e.TRIANGLES="TRIANGLES",e.INDICES="INDICES",e})({}),be=(function(e){return e.NONE="NONE",e.OCTAHEDRAL="OCTAHEDRAL",e.QUATERNION="QUATERNION",e.EXPONENTIAL="EXPONENTIAL",e})({});function io(e){return!e.extensions||!e.extensions.EXT_meshopt_compression?!1:!!e.extensions[Re].fallback}var{BYTE:oo,SHORT:Rn,FLOAT:co}=D.ComponentType,{encodeNormalizedInt:In,decodeNormalizedInt:fs}=te;function lo(e,t,a,s){let{filter:n,bits:r}=s,i={array:e.getArray(),byteStride:e.getElementSize()*e.getComponentSize(),componentType:e.getComponentType(),normalized:e.getNormalized()};if(a!==va.ATTRIBUTES)return i;if(n!==be.NONE){let o=e.getNormalized()?fo(e):new Float32Array(i.array);switch(n){case be.EXPONENTIAL:i.byteStride=e.getElementSize()*4,i.componentType=co,i.normalized=!1,i.array=t.encodeFilterExp(o,e.getCount(),i.byteStride,r);break;case be.OCTAHEDRAL:i.byteStride=r>8?8:4,i.componentType=r>8?Rn:oo,i.normalized=!0,o=e.getElementSize()===3?uo(o):o,i.array=t.encodeFilterOct(o,e.getCount(),i.byteStride,r);break;case be.QUATERNION:i.byteStride=8,i.componentType=Rn,i.normalized=!0,i.array=t.encodeFilterQuat(o,e.getCount(),i.byteStride,r);break;default:throw new Error("Invalid filter.")}i.min=e.getMin([]),i.max=e.getMax([]),e.getNormalized()&&(i.min=i.min.map(c=>fs(c,e.getComponentType())),i.max=i.max.map(c=>fs(c,e.getComponentType()))),i.normalized&&(i.min=i.min.map(c=>In(c,i.componentType)),i.max=i.max.map(c=>In(c,i.componentType)))}else i.byteStride%4&&(i.array=bo(i.array,e.getElementSize()),i.byteStride=i.array.byteLength/e.getCount());return i}function fo(e){let t=e.getComponentType(),a=e.getArray(),s=new Float32Array(a.length);for(let n=0;n<a.length;n++)s[n]=fs(a[n],t);return s}function bo(e,t){let a=L.padNumber(e.BYTES_PER_ELEMENT*t)/e.BYTES_PER_ELEMENT,s=e.length/t,n=new e.constructor(s*a);for(let r=0;r*t<e.length;r++)for(let i=0;i<t;i++)n[r*a+i]=e[r*t+i];return n}function uo(e){let t=new Float32Array(e.length*4/3);for(let a=0,s=e.length/3;a<s;a++)t[a*4]=e[a*3],t[a*4+1]=e[a*3+1],t[a*4+2]=e[a*3+2];return t}function ho(e,t){return t===nt.BufferViewUsage.ELEMENT_ARRAY_BUFFER?e.listParents().some(a=>a instanceof Lt&&a.getMode()===Lt.Mode.TRIANGLES)?va.TRIANGLES:va.INDICES:va.ATTRIBUTES}function go(e,t){let a=t.getGraph().listParentEdges(e).filter(s=>!(s.getParent()instanceof is));for(let s of a){let n=s.getName(),r=s.getAttributes().key||"",i=s.getParent().propertyType===E.PRIMITIVE_TARGET;if(n==="indices")return{filter:be.NONE};if(n==="attributes"){if(r==="POSITION")return{filter:be.NONE};if(r==="TEXCOORD_0")return{filter:be.NONE};if(r.startsWith("JOINTS_"))return{filter:be.NONE};if(r.startsWith("WEIGHTS_"))return{filter:be.NONE};if(r==="NORMAL"||r==="TANGENT")return i?{filter:be.NONE}:{filter:be.OCTAHEDRAL,bits:8}}if(n==="output"){let o=Gn(e);return o==="rotation"?{filter:be.QUATERNION,bits:16}:o==="translation"?{filter:be.EXPONENTIAL,bits:12}:o==="scale"?{filter:be.EXPONENTIAL,bits:12}:{filter:be.NONE}}if(n==="input")return{filter:be.NONE};if(n==="inverseBindMatrices")return{filter:be.NONE}}return{filter:be.NONE}}function Gn(e){for(let t of e.listParents())if(t instanceof ha){for(let a of t.listParents())if(a instanceof rs)return a.getTargetPath()}return null}var kn={method:ls.QUANTIZE},hs=class extends Y{extensionName=Re;prereadTypes=[E.BUFFER,E.PRIMITIVE];prewriteTypes=[E.BUFFER,E.ACCESSOR];readDependencies=["meshopt.decoder"];writeDependencies=["meshopt.encoder"];static EXTENSION_NAME=Re;static EncoderMethod=ls;_decoder=null;_decoderFallbackBufferMap=new Map;_encoder=null;_encoderOptions=kn;_encoderFallbackBuffer=null;_encoderBufferViews={};_encoderBufferViewData={};_encoderBufferViewAccessors={};install(e,t){return e==="meshopt.decoder"&&(this._decoder=t),e==="meshopt.encoder"&&(this._encoder=t),this}setEncoderOptions(e){return this._encoderOptions={...kn,...e},this}preread(e,t){if(!this._decoder){if(!this.isRequired())return this;throw new Error(`[${Re}] Please install extension dependency, "meshopt.decoder".`)}if(!this._decoder.supported){if(!this.isRequired())return this;throw new Error(`[${Re}]: Missing WASM support.`)}return t===E.BUFFER?this._prereadBuffers(e):t===E.PRIMITIVE&&this._prereadPrimitives(e),this}_prereadBuffers(e){let t=e.jsonDoc;(t.json.bufferViews||[]).forEach((a,s)=>{if(!a.extensions||!a.extensions.EXT_meshopt_compression)return;let n=a.extensions[Re],r=n.byteOffset||0,i=n.byteLength||0,o=n.count,c=n.byteStride,b=new Uint8Array(o*c),g=t.json.buffers[n.buffer],h=g.uri?t.resources[g.uri]:t.resources[rt],w=L.toView(h,r,i);this._decoder.decodeGltfBuffer(b,o,c,w,n.mode,n.filter),e.bufferViews[s]=b})}_prereadPrimitives(e){let t=e.jsonDoc;(t.json.bufferViews||[]).forEach(a=>{if(!a.extensions||!a.extensions.EXT_meshopt_compression)return;let s=a.extensions[Re],n=e.buffers[s.buffer],r=e.buffers[a.buffer],i=t.json.buffers[a.buffer];io(i)&&this._decoderFallbackBufferMap.set(r,n)})}read(e){if(!this.isRequired())return this;for(let[t,a]of this._decoderFallbackBufferMap){for(let s of t.listParents())s instanceof D&&s.swap(t,a);t.dispose()}return this}prewrite(e,t){return t===E.ACCESSOR?this._prewriteAccessors(e):t===E.BUFFER&&this._prewriteBuffers(e),this}_prewriteAccessors(e){let t=e.jsonDoc.json,a=this._encoder,s=this._encoderOptions,n=this.document.getGraph(),r=this.document.createBuffer(),i=this.document.getRoot().listBuffers().indexOf(r),o=1,c=new Map,b=g=>{for(let h of n.listParents(g)){if(h.propertyType===E.ROOT)continue;let w=c.get(g);return w===void 0&&c.set(g,w=o++),w}return-1};this._encoderFallbackBuffer=r,this._encoderBufferViews={},this._encoderBufferViewData={},this._encoderBufferViewAccessors={};for(let g of this.document.getRoot().listAccessors()){if(Gn(g)==="weights"||g.getSparse())continue;let h=e.getAccessorUsage(g),w=e.accessorUsageGroupedByParent.has(h)?b(g):null,y=ho(g,h),f=s.method===ls.FILTER?go(g,this.document):{filter:be.NONE},d=lo(g,a,y,f),{array:m,byteStride:l}=d,u=g.getBuffer();if(!u)throw new Error(`${Re}: Missing buffer for accessor.`);let p=this.document.getRoot().listBuffers().indexOf(u),v=[h,w,y,f.filter,l,p].join(":"),T=this._encoderBufferViews[v],I=this._encoderBufferViewData[v],k=this._encoderBufferViewAccessors[v];(!T||!I)&&(k=this._encoderBufferViewAccessors[v]=[],I=this._encoderBufferViewData[v]=[],T=this._encoderBufferViews[v]={buffer:i,target:nt.USAGE_TO_TARGET[h],byteOffset:0,byteLength:0,byteStride:h===nt.BufferViewUsage.ARRAY_BUFFER?l:void 0,extensions:{[Re]:{buffer:p,byteOffset:0,byteLength:0,mode:y,filter:f.filter!==be.NONE?f.filter:void 0,byteStride:l,count:0}}});let A=e.createAccessorDef(g);A.componentType=d.componentType,A.normalized=d.normalized,A.byteOffset=T.byteLength,A.min&&d.min&&(A.min=d.min),A.max&&d.max&&(A.max=d.max),e.accessorIndexMap.set(g,t.accessors.length),t.accessors.push(A),k.push(A),I.push(new Uint8Array(m.buffer,m.byteOffset,m.byteLength)),T.byteLength+=m.byteLength,T.extensions.EXT_meshopt_compression.count+=g.getCount()}}_prewriteBuffers(e){let t=this._encoder;for(let a in this._encoderBufferViews){let s=this._encoderBufferViews[a],n=this._encoderBufferViewData[a],r=this.document.getRoot().listBuffers()[s.extensions[Re].buffer],i=e.otherBufferViews.get(r)||[],{count:o,byteStride:c,mode:b}=s.extensions[Re],g=L.concat(n),h=t.encodeGltfBuffer(g,o,c,b),w=L.pad(h);s.extensions[Re].byteLength=h.byteLength,n.length=0,n.push(w),i.push(w),e.otherBufferViews.set(r,i)}}write(e){let t=0;for(let r in this._encoderBufferViews){let i=this._encoderBufferViews[r],o=this._encoderBufferViewData[r][0],c=e.otherBufferViewsIndexMap.get(o),b=this._encoderBufferViewAccessors[r];for(let y of b)y.bufferView=c;let g=e.jsonDoc.json.bufferViews[c],h=g.byteOffset||0;Object.assign(g,i),g.byteOffset=t;let w=g.extensions[Re];w.byteOffset=h,t+=L.padNumber(i.byteLength)}let a=this._encoderFallbackBuffer,s=e.bufferIndexMap.get(a),n=e.jsonDoc.json.buffers[s];return n.byteLength=t,n.extensions={[Re]:{fallback:!0}},a.dispose(),this}},po=class extends z{static EXTENSION_NAME=U;init(){this.extensionName=U,this.propertyType="StructuralMetadata",this.parentTypes=[E.ROOT]}getDefaults(){return Object.assign(super.getDefaults(),{schema:null,schemaUri:"",propertyTables:new pe,propertyTextures:new pe,propertyAttributes:new pe})}getSchema(){return this.getRef("schema")}setSchema(e){return this.setRef("schema",e)}getSchemaUri(){return this.get("schemaUri")}setSchemaUri(e){return this.set("schemaUri",e)}listPropertyTables(){return this.listRefs("propertyTables")}addPropertyTable(e){return this.addRef("propertyTables",e)}removePropertyTable(e){return this.removeRef("propertyTables",e)}listPropertyTextures(){return this.listRefs("propertyTextures")}addPropertyTexture(e){return this.addRef("propertyTextures",e)}removePropertyTexture(e){return this.removeRef("propertyTextures",e)}listPropertyAttributes(){return this.listRefs("propertyAttributes")}addPropertyAttribute(e){return this.addRef("propertyAttributes",e)}removePropertyAttribute(e){return this.removeRef("propertyAttributes",e)}},mo=class extends z{static EXTENSION_NAME=U;init(){this.extensionName=U,this.propertyType="Schema",this.parentTypes=["StructuralMetadata"]}getDefaults(){return Object.assign(super.getDefaults(),{description:"",version:"",classes:new le,enums:new le})}getId(){return this.get("id")}setId(e){return this.set("id",e)}getDescription(){return this.get("description")}setDescription(e){return this.set("description",e)}getVersion(){return this.get("version")}setVersion(e){return this.set("version",e)}setClass(e,t){return this.setRefMap("classes",e,t)}getClass(e){return this.getRefMap("classes",e)}listClassKeys(){return this.listRefMapKeys("classes")}listClassValues(){return this.listRefMapValues("classes")}setEnum(e,t){return this.setRefMap("enums",e,t)}getEnum(e){return this.getRefMap("enums",e)}listEnumKeys(){return this.listRefMapKeys("enums")}listEnumValues(){return this.listRefMapValues("enums")}},xo=class extends z{static EXTENSION_NAME=U;init(){this.extensionName=U,this.propertyType="Class",this.parentTypes=["Schema"]}getDefaults(){return Object.assign(super.getDefaults(),{description:"",properties:new le})}getDescription(){return this.get("description")}setDescription(e){return this.set("description",e)}setProperty(e,t){return this.setRefMap("properties",e,t)}getProperty(e){return this.getRefMap("properties",e)}listPropertyKeys(){return this.listRefMapKeys("properties")}listPropertyValues(){return this.listRefMapValues("properties")}},yo=class extends z{static EXTENSION_NAME=U;init(){this.extensionName=U,this.propertyType="ClassProperty",this.parentTypes=["Class"]}getDefaults(){return Object.assign(super.getDefaults(),{description:"",componentType:null,enumType:null,array:null,count:null,normalized:null,offset:null,scale:null,max:null,min:null,required:null,noData:null,default:null})}getDescription(){return this.get("description")}setDescription(e){return this.set("description",e)}getType(){return this.get("type")}setType(e){return this.set("type",e)}getComponentType(){return this.get("componentType")}setComponentType(e){return this.set("componentType",e)}getEnumType(){return this.get("enumType")}setEnumType(e){return this.set("enumType",e)}getArray(){return this.get("array")}setArray(e){return this.set("array",e)}getCount(){return this.get("count")}setCount(e){return this.set("count",e)}getNormalized(){return this.get("normalized")}setNormalized(e){return this.set("normalized",e)}getOffset(){return this.get("offset")}setOffset(e){return this.set("offset",e)}getScale(){return this.get("scale")}setScale(e){return this.set("scale",e)}getMax(){return this.get("max")}setMax(e){return this.set("max",e)}getMin(){return this.get("min")}setMin(e){return this.set("min",e)}getRequired(){return this.get("required")}setRequired(e){return this.set("required",e)}getNoData(){return this.get("noData")}setNoData(e){return this.set("noData",e)}getDefault(){return this.get("default")}setDefault(e){return this.set("default",e)}},vo=class extends z{static EXTENSION_NAME=U;init(){this.extensionName=U,this.propertyType="Enum",this.parentTypes=["Schema"]}getDefaults(){return Object.assign(super.getDefaults(),{description:"",valueType:"UINT16",values:new pe})}getDescription(){return this.get("description")}setDescription(e){return this.set("description",e)}getValueType(){return this.get("valueType")}setValueType(e){return this.set("valueType",e)}listValues(){return this.listRefs("values")}addEnumValue(e){return this.addRef("values",e)}removeEnumValue(e){return this.removeRef("values",e)}},wo=class extends z{static EXTENSION_NAME=U;init(){this.extensionName=U,this.propertyType="EnumValue",this.parentTypes=["Enum"]}getDefaults(){return Object.assign(super.getDefaults(),{description:null})}getDescription(){return this.get("description")}setDescription(e){return this.set("description",e)}getValue(){return this.get("value")}setValue(e){return this.set("value",e)}},To=class extends z{static EXTENSION_NAME=U;init(){this.extensionName=U,this.propertyType="PropertyTable",this.parentTypes=["StructuralMetadata"]}getDefaults(){return Object.assign(super.getDefaults(),{properties:new le})}getClass(){return this.get("class")}setClass(e){return this.set("class",e)}getCount(){return this.get("count")}setCount(e){return this.set("count",e)}setProperty(e,t){return this.setRefMap("properties",e,t)}getProperty(e){return this.getRefMap("properties",e)}listPropertyKeys(){return this.listRefMapKeys("properties")}listPropertyValues(){return this.listRefMapValues("properties")}},Eo=class extends z{static EXTENSION_NAME=U;init(){this.extensionName=U,this.propertyType="PropertyTableProperty",this.parentTypes=["PropertyTable"]}getDefaults(){return Object.assign(super.getDefaults(),{arrayOffsets:null,stringOffsets:null,arrayOffsetType:null,stringOffsetType:null,offset:null,scale:null,max:null,min:null})}getValues(){return this.get("values")}setValues(e){return this.set("values",e)}getArrayOffsets(){return this.get("arrayOffsets")}setArrayOffsets(e){return this.set("arrayOffsets",e)}getStringOffsets(){return this.get("stringOffsets")}setStringOffsets(e){return this.set("stringOffsets",e)}getArrayOffsetType(){return this.get("arrayOffsetType")}setArrayOffsetType(e){return this.set("arrayOffsetType",e)}getStringOffsetType(){return this.get("stringOffsetType")}setStringOffsetType(e){return this.set("stringOffsetType",e)}getOffset(){return this.get("offset")}setOffset(e){return this.set("offset",e)}getScale(){return this.get("scale")}setScale(e){return this.set("scale",e)}getMax(){return this.get("max")}setMax(e){return this.set("max",e)}getMin(){return this.get("min")}setMin(e){return this.set("min",e)}},Ro=class extends z{static EXTENSION_NAME=U;init(){this.extensionName=U,this.propertyType="PropertyTexture",this.parentTypes=["StructuralMetadata"]}getDefaults(){return Object.assign(super.getDefaults(),{properties:new le})}getClass(){return this.get("class")}setClass(e){return this.set("class",e)}setProperty(e,t){return this.setRefMap("properties",e,t)}getProperty(e){return this.getRefMap("properties",e)}listPropertyKeys(){return this.listRefMapKeys("properties")}listPropertyValues(){return this.listRefMapValues("properties")}},Io=class extends z{static EXTENSION_NAME=U;init(){this.extensionName=U,this.propertyType="PropertyTextureProperty",this.parentTypes=["PropertyTexture"]}getDefaults(){let e=new ee(this.graph,"textureInfo");return e.setMinFilter(ee.MagFilter.NEAREST),e.setMagFilter(ee.MagFilter.NEAREST),Object.assign(super.getDefaults(),{channels:[0],texture:null,textureInfo:e,offset:null,scale:null,max:null,min:null})}getChannels(){return this.get("channels")}setChannels(e){return this.set("channels",e)}getTexture(){return this.getRef("texture")}setTexture(e){return this.setRef("texture",e)}getTextureInfo(){return this.getRef("texture")?this.getRef("textureInfo"):null}getOffset(){return this.get("offset")}setOffset(e){return this.set("offset",e)}getScale(){return this.get("scale")}setScale(e){return this.set("scale",e)}getMax(){return this.get("max")}setMax(e){return this.set("max",e)}getMin(){return this.get("min")}setMin(e){return this.set("min",e)}},ko=class extends z{static EXTENSION_NAME=U;init(){this.extensionName=U,this.propertyType="PropertyAttribute",this.parentTypes=["StructuralMetadata"]}getDefaults(){return Object.assign(super.getDefaults(),{properties:new le})}getClass(){return this.get("class")}setClass(e){return this.set("class",e)}setProperty(e,t){return this.setRefMap("properties",e,t)}getProperty(e){return this.getRefMap("properties",e)}listPropertyKeys(){return this.listRefMapKeys("properties")}listPropertyValues(){return this.listRefMapValues("properties")}},Mo=class extends z{static EXTENSION_NAME=U;init(){this.extensionName=U,this.propertyType="PropertyAttributeProperty",this.parentTypes=["PropertyAttribute"]}getDefaults(){return Object.assign(super.getDefaults(),{offset:null,scale:null,max:null,min:null})}getAttribute(){return this.get("attribute")}setAttribute(e){return this.set("attribute",e)}getOffset(){return this.get("offset")}setOffset(e){return this.set("offset",e)}getScale(){return this.get("scale")}setScale(e){return this.set("scale",e)}getMax(){return this.get("max")}setMax(e){return this.set("max",e)}getMin(){return this.get("min")}setMin(e){return this.set("min",e)}},Ao=class extends z{static EXTENSION_NAME=U;init(){this.extensionName=U,this.propertyType="NodeStructuralMetadata",this.parentTypes=[E.NODE]}getDefaults(){return Object.assign(super.getDefaults(),{class:"",properties:{}})}getClass(){return this.get("class")}setClass(e){return this.set("class",e)}getProperties(){return this.get("properties")}setProperties(e){return this.set("properties",e)}},So=class extends z{static EXTENSION_NAME=U;init(){this.extensionName=U,this.propertyType="MeshPrimitiveStructuralMetadata",this.parentTypes=[E.PRIMITIVE]}getDefaults(){return Object.assign(super.getDefaults(),{propertyTextures:new pe,propertyAttributes:new pe})}listPropertyTextures(){return this.listRefs("propertyTextures")}addPropertyTexture(e){return this.addRef("propertyTextures",e)}removePropertyTexture(e){return this.removeRef("propertyTextures",e)}listPropertyAttributes(){return this.listRefs("propertyAttributes")}addPropertyAttribute(e){return this.addRef("propertyAttributes",e)}removePropertyAttribute(e){return this.removeRef("propertyAttributes",e)}},_o=class extends Y{extensionName=U;static EXTENSION_NAME=U;prewriteTypes=[E.BUFFER];prereadTypes=[E.SCENE];createStructuralMetadata(){return new po(this.document.getGraph())}createSchema(){return new mo(this.document.getGraph())}createClass(){return new xo(this.document.getGraph())}createClassProperty(){return new yo(this.document.getGraph())}createEnum(){return new vo(this.document.getGraph())}createEnumValue(){return new wo(this.document.getGraph())}createPropertyTable(){return new To(this.document.getGraph())}createPropertyTableProperty(){return new Eo(this.document.getGraph())}createPropertyTexture(){return new Ro(this.document.getGraph())}createPropertyTextureProperty(){return new Io(this.document.getGraph())}createPropertyAttribute(){return new ko(this.document.getGraph())}createPropertyAttributeProperty(){return new Mo(this.document.getGraph())}createNodeStructuralMetadata(){return new Ao(this.document.getGraph())}createMeshPrimitiveStructuralMetadata(){return new So(this.document.getGraph())}read(e){return this}preread(e){let t=this.document.getRoot(),{json:a}=e.jsonDoc,s=a.extensions[U],n=No(this,e,s);return t.setExtension(U,n),(a.meshes||[]).forEach((r,i)=>{let o=e.meshes[i].listPrimitives();(r.primitives||[]).forEach((c,b)=>{let g=o[b];this._readPrimitive(n,g,c)})}),(a.nodes||[]).forEach((r,i)=>{this._readNode(e.nodes[i],r)}),this}_readPrimitive(e,t,a){if(!a.extensions||!a.extensions.EXT_structural_metadata)return;let s=this.createMeshPrimitiveStructuralMetadata(),n=a.extensions[U],r=e.listPropertyTextures(),i=n.propertyTextures||[];for(let b of i){let g=r[b];s.addPropertyTexture(g)}let o=e.listPropertyAttributes(),c=n.propertyAttributes||[];for(let b of c){let g=o[b];s.addPropertyAttribute(g)}t.setExtension(U,s)}_readNode(e,t){if(!t.extensions||!t.extensions.EXT_structural_metadata)return;let a=t.extensions[U],s=this.createNodeStructuralMetadata().setClass(a.class).setProperties(a.properties);e.setExtension(U,s)}write(e){let t=this.document.getRoot(),a=t.getExtension(U);if(!a)return this;let s=e.jsonDoc.json,n=Vo(e,a);s.extensions=s.extensions||{},s.extensions[U]=n;let r=t.listMeshes(),i=s.meshes;if(i)for(let b of r){let g=i[e.meshIndexMap.get(b)];b.listPrimitives().forEach((h,w)=>{let y=g.primitives[w];this._writePrimitive(a,h,y)})}let o=t.listNodes(),c=s.nodes;if(c)for(let b of o){let g=e.nodeIndexMap.get(b);this._writeNode(b,c[g])}return this}_writePrimitive(e,t,a){let s=t.getExtension(U);if(!s)return;let n=e.listPropertyTextures(),r=e.listPropertyAttributes(),i,o,c=s.listPropertyTextures();if(c.length>0){i=[];for(let h of c){let w=n.indexOf(h);if(w>=0)i.push(w);else throw new Error(`${U}: Invalid property texture in mesh primitive`)}}let b=s.listPropertyAttributes();if(b.length>0){o=[];for(let h of b){let w=r.indexOf(h);if(w>=0)o.push(w);else throw new Error(`${U}: Invalid property attribute in mesh primitive`)}}let g={propertyTextures:i,propertyAttributes:o};a.extensions=a.extensions||{},a.extensions[U]=g}_writeNode(e,t){let a=e.getExtension("EXT_structural_metadata");a&&(t.extensions=t.extensions||{},t.extensions[U]={class:a.getClass(),properties:a.getProperties()})}prewrite(e,t){return t===E.BUFFER&&this._prewriteBuffers(e),this}_prewriteBuffers(e){let t=this.document,a=t.getRoot().getExtension(U);e.jsonDoc.json.bufferViews||=[];for(let s of a.listPropertyTables())for(let n of s.listPropertyValues()){let r=tc(t,e);r.push(n.getValues());let i=n.getArrayOffsets();i&&r.push(i);let o=n.getStringOffsets();o&&r.push(o)}}};function No(e,t,a){let s=e.createStructuralMetadata();if(a.schema!==void 0){let o=jo(e,a.schema);s.setSchema(o)}else if(a.schemaUri){let o=a.schemaUri;s.setSchemaUri(o)}let n=a.propertyTextures||[];for(let o of n){let c=Do(e,t,o);s.addPropertyTexture(c)}let r=a.propertyTables||[];for(let o of r){let c=Uo(e,t,o);s.addPropertyTable(c)}let i=a.propertyAttributes||[];for(let o of i){let c=Ko(e,o);s.addPropertyAttribute(c)}return s}function jo(e,t){let a=e.createSchema().setId(t.id);t.name!==void 0&&a.setName(t.name),t.description!==void 0&&a.setDescription(t.description),t.version!==void 0&&a.setVersion(t.version);let s=t.classes||{};for(let r of Object.keys(s)){let i=s[r];a.setClass(r,Fo(e,i))}let n=t.enums||{};for(let r of Object.keys(n))a.setEnum(r,Co(e,n[r]));return a}function Fo(e,t){let a=e.createClass();t.name!==void 0&&a.setName(t.name),t.description!==void 0&&a.setDescription(t.description);let s=t.properties||{};for(let n of Object.keys(s)){let r=Oo(e,s[n]);a.setProperty(n,r)}return a}function Oo(e,t){let a=e.createClassProperty().setType(t.type);return t.name!==void 0&&a.setName(t.name),t.description!==void 0&&a.setDescription(t.description),t.componentType!==void 0&&a.setComponentType(t.componentType),t.enumType!==void 0&&a.setEnumType(t.enumType),t.array!==void 0&&a.setArray(t.array),t.count!==void 0&&a.setCount(t.count),t.normalized!==void 0&&a.setNormalized(t.normalized),t.offset!==void 0&&a.setOffset(t.offset),t.scale!==void 0&&a.setScale(t.scale),t.max!==void 0&&a.setMax(t.max),t.min!==void 0&&a.setMin(t.min),t.required!==void 0&&a.setRequired(t.required),t.noData!==void 0&&a.setNoData(t.noData),t.default!==void 0&&a.setDefault(t.default),a}function Co(e,t){let a=e.createEnum();t.name!==void 0&&a.setName(t.name),t.description!==void 0&&a.setDescription(t.description),t.valueType!==void 0&&a.setValueType(t.valueType);let s=t.values||{};for(let n of s)a.addEnumValue(Bo(e,n));return a}function Bo(e,t){let a=e.createEnumValue();return t.name!==void 0&&a.setName(t.name),t.description!==void 0&&a.setDescription(t.description),t.value!==void 0&&a.setValue(t.value),a}function Do(e,t,a){let s=e.createPropertyTexture();s.setClass(a.class),a.name!==void 0&&s.setName(a.name);let n=a.properties||{};for(let r of Object.keys(n)){let i=Po(e,t,n[r]);s.setProperty(r,i)}return s}function Po(e,t,a){let s=e.createPropertyTextureProperty(),n=t.jsonDoc.json.textures||[];a.channels&&s.setChannels(a.channels);let r=n[a.index].source;if(r!==void 0){let i=t.textures[r];s.setTexture(i);let o=s.getTextureInfo();o&&t.setTextureInfo(o,a)}return a.offset!==void 0&&s.setOffset(a.offset),a.scale!==void 0&&s.setScale(a.scale),a.max!==void 0&&s.setMax(a.max),a.min!==void 0&&s.setMin(a.min),s}function Uo(e,t,a){let s=e.createPropertyTable().setClass(a.class).setCount(a.count);a.name!==void 0&&s.setName(a.name);let n=a.properties||{};for(let r of Object.keys(n)){let i=Lo(e,t,n[r]);s.setProperty(r,i)}return s}function Lo(e,t,a){let s=e.createPropertyTableProperty(),n=os(t,a.values);if(s.setValues(n),a.arrayOffsets!==void 0){let r=os(t,a.arrayOffsets);s.setArrayOffsets(r)}if(a.stringOffsets!==void 0){let r=os(t,a.stringOffsets);s.setStringOffsets(r)}return a.arrayOffsetType!==void 0&&s.setArrayOffsetType(a.arrayOffsetType),a.stringOffsetType!==void 0&&s.setStringOffsetType(a.stringOffsetType),a.offset!==void 0&&s.setOffset(a.offset),a.scale!==void 0&&s.setScale(a.scale),a.max!==void 0&&s.setMax(a.max),a.min!==void 0&&s.setMin(a.min),s}function Ko(e,t){let a=e.createPropertyAttribute();a.setClass(t.class),t.name!==void 0&&a.setName(t.name);let s=t.properties||{};for(let n of Object.keys(s)){let r=Go(e,s[n]);a.setProperty(n,r)}return a}function Go(e,t){let a=e.createPropertyAttributeProperty();return a.setAttribute(t.attribute),t.offset!==void 0&&a.setOffset(t.offset),t.scale!==void 0&&a.setScale(t.scale),t.max!==void 0&&a.setMax(t.max),t.min!==void 0&&a.setMin(t.min),a}function Vo(e,t){let a={},s=t.getSchema();s&&(a.schema=zo(s));let n=t.getSchemaUri();n&&(a.schemaUri=n);let r=t.listPropertyTables();if(r.length>0){let c=[];for(let b of r){let g=Jo(e,b);c.push(g)}a.propertyTables=c}let i=t.listPropertyTextures();if(i.length>0){let c=[];for(let b of i){let g=Zo(e,b);c.push(g)}a.propertyTextures=c}let o=t.listPropertyAttributes();if(o.length>0){let c=[];for(let b of o){let g=$o(b);c.push(g)}a.propertyAttributes=c}return a}function zo(e){let t={id:e.getId()},a=e.listClassKeys();if(a.length>0){t.classes={};for(let n of a){let r=Xo(e.getClass(n));t.classes[n]=r}}let s=e.listEnumKeys();if(s.length>0){t.enums={};for(let n of s){let r=Ho(e.getEnum(n));t.enums[n]=r}}return e.getName()&&(t.name=e.getName()),e.getDescription()&&(t.description=e.getDescription()),e.getVersion()&&(t.version=e.getVersion()),t}function Xo(e){let t={},a=e.listPropertyKeys();if(a.length>0){t.properties={};for(let s of a){let n=e.getProperty(s);t.properties[s]=qo(n)}}return e.getName()&&(t.name=e.getName()),e.getDescription()&&(t.description=e.getDescription()),t}function qo(e){let t={type:e.getType()};return e.getArray()&&(t.array=e.getArray()),e.getNormalized()&&(t.normalized=e.getNormalized()),e.getRequired()&&(t.required=e.getRequired()),e.getName()&&(t.name=e.getName()),e.getDescription()&&(t.description=e.getDescription()),e.getComponentType()!=null&&(t.componentType=e.getComponentType()),e.getEnumType()!=null&&(t.enumType=e.getEnumType()),e.getCount()!=null&&(t.count=e.getCount()),e.getOffset()!=null&&(t.offset=e.getOffset()),e.getScale()!=null&&(t.scale=e.getScale()),e.getMax()!=null&&(t.max=e.getMax()),e.getMin()!=null&&(t.min=e.getMin()),e.getNoData()!=null&&(t.noData=e.getNoData()),e.getDefault()!=null&&(t.default=e.getDefault()),t}function Ho(e){let t={values:e.listValues().map(Wo)};return e.getName()&&(t.name=e.getName()),e.getDescription()&&(t.description=e.getDescription()),e.getValueType()!=="UINT16"&&(t.valueType=e.getValueType()),t}function Wo(e){let t={name:e.getName(),value:e.getValue()};return e.getDescription()&&(t.description=e.getDescription()),t}function Jo(e,t){let a={class:t.getClass(),count:t.getCount()};t.getName()&&(a.name=t.getName());let s=t.listPropertyKeys();if(s.length>0){a.properties={};for(let n of s){let r=Yo(e,t.getProperty(n));a.properties[n]=r}}return a}function Yo(e,t){let a=t.getValues(),s={values:e.otherBufferViewsIndexMap.get(a)};if(t.getArrayOffsets()){let n=t.getArrayOffsets();s.arrayOffsets=e.otherBufferViewsIndexMap.get(n)}if(t.getStringOffsets()){let n=t.getStringOffsets();s.stringOffsets=e.otherBufferViewsIndexMap.get(n)}return t.getArrayOffsetType()!=null&&(s.arrayOffsetType=t.getArrayOffsetType()),t.getStringOffsetType()!=null&&(s.stringOffsetType=t.getStringOffsetType()),t.getOffset()!=null&&(s.offset=t.getOffset()),t.getScale()!=null&&(s.scale=t.getScale()),t.getMax()!=null&&(s.max=t.getMax()),t.getMin()!=null&&(s.min=t.getMin()),s}function $o(e){let t={class:e.getClass()};e.getName()&&(t.name=e.getName());let a=e.listPropertyKeys();if(a.length>0){t.properties={};for(let s of a){let n=Qo(e.getProperty(s));t.properties[s]=n}}return t}function Qo(e){let t={attribute:e.getAttribute()};return e.getOffset()!=null&&(t.offset=e.getOffset()),e.getScale()!=null&&(t.scale=e.getScale()),e.getMax()!=null&&(t.max=e.getMax()),e.getMin()!=null&&(t.min=e.getMin()),t}function Zo(e,t){let a={class:t.getClass()};t.getName()&&(a.name=t.getName());let s=t.listPropertyKeys();if(s.length>0){a.properties={};for(let n of s){let r=ec(e,t.getProperty(n));a.properties[n]=r}}return a}function ec(e,t){let a=t.getTexture(),s=t.getTextureInfo(),n=t.getChannels(),r=e.createTextureInfoDef(a,s);return te.eq(n,[0])||(r.channels=n),t.getOffset()!=null&&(r.offset=t.getOffset()),t.getScale()!=null&&(r.scale=t.getScale()),t.getMax()!=null&&(r.max=t.getMax()),t.getMin()!=null&&(r.min=t.getMin()),r}function os(e,t){let a=e.jsonDoc,s=a.json.buffers||[],n=(a.json.bufferViews||[])[t],r=s[n.buffer],i=r.uri?a.resources[r.uri]:a.resources[rt],o=n.byteOffset||0,c=n.byteLength;return i.slice(o,o+c)}function tc(e,t){let a=e.getRoot().listBuffers()[0],s=t.otherBufferViews.get(a);return s||(s=[],t.otherBufferViews.set(a,s)),s}var ac=class{match(e){return e.length>=12&&L.decodeText(e.slice(4,12))==="ftypavif"}getSize(e){if(!this.match(e))return null;let t=new DataView(e.buffer,e.byteOffset,e.byteLength),a=Mn(t,0);if(!a)return null;let s=a.end;for(;a=Mn(t,s);)if(a.type==="meta")s=a.start+4;else if(a.type==="iprp"||a.type==="ipco")s=a.start;else{if(a.type==="ispe")return[t.getUint32(a.start+4),t.getUint32(a.start+8)];if(a.type==="mdat")break;s=a.end}return null}getChannels(e){return 4}},sc=class extends Y{extensionName=xa;prereadTypes=[E.TEXTURE];static EXTENSION_NAME=xa;static register(){Xe.registerFormat("image/avif",new ac)}preread(e){return(e.jsonDoc.json.textures||[]).forEach(t=>{t.extensions&&t.extensions.EXT_texture_avif&&(t.source=t.extensions[xa].source)}),this}read(e){return this}write(e){let t=e.jsonDoc;return this.document.getRoot().listTextures().forEach(a=>{if(a.getMimeType()==="image/avif"){let s=e.imageIndexMap.get(a);(t.json.textures||[]).forEach(n=>{n.source===s&&(n.extensions=n.extensions||{},n.extensions[xa]={source:n.source},delete n.source)})}}),this}};function Mn(e,t){if(e.byteLength<4+t)return null;let a=e.getUint32(t);return e.byteLength<a+t||a<8?null:{type:L.decodeText(new Uint8Array(e.buffer,e.byteOffset+t+4,4)),start:t+8,end:t+a}}var nc=class{match(e){return e.length>=12&&e[8]===87&&e[9]===69&&e[10]===66&&e[11]===80}getSize(e){let t=L.decodeText(e.slice(0,4)),a=L.decodeText(e.slice(8,12));if(t!=="RIFF"||a!=="WEBP")return null;let s=new DataView(e.buffer,e.byteOffset),n=12;for(;n<s.byteLength;){let r=L.decodeText(new Uint8Array([s.getUint8(n),s.getUint8(n+1),s.getUint8(n+2),s.getUint8(n+3)])),i=s.getUint32(n+4,!0);if(r==="VP8 ")return[s.getInt16(n+14,!0)&16383,s.getInt16(n+16,!0)&16383];if(r==="VP8L"){let o=s.getUint8(n+9),c=s.getUint8(n+10),b=s.getUint8(n+11),g=s.getUint8(n+12);return[1+((c&63)<<8|o),1+((g&15)<<10|b<<2|(c&192)>>6)]}n+=8+i+i%2}return null}getChannels(e){return 4}},rc=class extends Y{extensionName=ma;prereadTypes=[E.TEXTURE];static EXTENSION_NAME=ma;static register(){Xe.registerFormat("image/webp",new nc)}preread(e){return(e.jsonDoc.json.textures||[]).forEach(t=>{t.extensions&&t.extensions.EXT_texture_webp&&(t.source=t.extensions[ma].source)}),this}read(e){return this}write(e){let t=e.jsonDoc;return this.document.getRoot().listTextures().forEach(a=>{if(a.getMimeType()==="image/webp"){let s=e.imageIndexMap.get(a);(t.json.textures||[]).forEach(n=>{n.source===s&&(n.extensions=n.extensions||{},n.extensions[ma]={source:n.source},delete n.source)})}}),this}},An=Yi,ic=class extends Y{extensionName=An;static EXTENSION_NAME=An;read(e){return this}write(e){return this}},Sn=$i,oc=class extends Y{extensionName=Sn;static EXTENSION_NAME=Sn;read(e){return this}write(e){return this}},ue,Vn,zn;function cc(e,t){let a=new ue.DecoderBuffer;try{if(a.Init(t,t.length),e.GetEncodedGeometryType(a)!==ue.TRIANGULAR_MESH)throw new Error(`[${oe}] Unknown geometry type.`);let s=new ue.Mesh;if(!e.DecodeBufferToMesh(a,s).ok()||s.ptr===0)throw new Error(`[${oe}] Decoding failure.`);return s}finally{ue.destroy(a)}}function dc(e,t){let a=t.num_faces()*3,s,n;if(t.num_points()<=65534){let r=a*Uint16Array.BYTES_PER_ELEMENT;s=ue._malloc(r),e.GetTrianglesUInt16Array(t,r,s),n=new Uint16Array(ue.HEAPU16.buffer,s,a).slice()}else{let r=a*Uint32Array.BYTES_PER_ELEMENT;s=ue._malloc(r),e.GetTrianglesUInt32Array(t,r,s),n=new Uint32Array(ue.HEAPU32.buffer,s,a).slice()}return ue._free(s),n}function lc(e,t,a,s){let n=zn[s.componentType],r=Vn[s.componentType],i=a.num_components(),o=t.num_points()*i,c=o*r.BYTES_PER_ELEMENT,b=ue._malloc(c);e.GetAttributeDataArrayForAllPoints(t,a,n,c,b);let g=new r(ue.HEAPF32.buffer,b,o).slice();return ue._free(b),g}function fc(e){ue=e,Vn={[D.ComponentType.FLOAT]:Float32Array,[D.ComponentType.UNSIGNED_INT]:Uint32Array,[D.ComponentType.UNSIGNED_SHORT]:Uint16Array,[D.ComponentType.UNSIGNED_BYTE]:Uint8Array,[D.ComponentType.SHORT]:Int16Array,[D.ComponentType.BYTE]:Int8Array},zn={[D.ComponentType.FLOAT]:ue.DT_FLOAT32,[D.ComponentType.UNSIGNED_INT]:ue.DT_UINT32,[D.ComponentType.UNSIGNED_SHORT]:ue.DT_UINT16,[D.ComponentType.UNSIGNED_BYTE]:ue.DT_UINT8,[D.ComponentType.SHORT]:ue.DT_INT16,[D.ComponentType.BYTE]:ue.DT_INT8}}var Ce,gs=(function(e){return e[e.EDGEBREAKER=1]="EDGEBREAKER",e[e.SEQUENTIAL=0]="SEQUENTIAL",e})({}),Ge=(function(e){return e.POSITION="POSITION",e.NORMAL="NORMAL",e.COLOR="COLOR",e.TEX_COORD="TEX_COORD",e.GENERIC="GENERIC",e})(Ge||{}),Xn={[Ge.POSITION]:14,[Ge.NORMAL]:10,[Ge.COLOR]:8,[Ge.TEX_COORD]:12,[Ge.GENERIC]:12},_n={decodeSpeed:5,encodeSpeed:5,method:gs.EDGEBREAKER,quantizationBits:Xn,quantizationVolume:"mesh"};function bc(e){Ce=e}function uc(e,t=_n){let a={..._n,...t};a.quantizationBits={...Xn,...t.quantizationBits};let s=new Ce.MeshBuilder,n=new Ce.Mesh,r=new Ce.ExpertEncoder(n),i={},o=new Ce.DracoInt8Array,c=e.listTargets().length>0,b=!1;for(let d of e.listSemantics()){let m=e.getAttribute(d);if(m.getSparse()){b=!0;continue}let l=hc(d),u=gc(s,m.getComponentType(),n,Ce[l],m.getCount(),m.getElementSize(),m.getArray());if(u===-1)throw new Error(`Error compressing "${d}" attribute.`);if(i[d]=u,a.quantizationVolume==="mesh"||d!=="POSITION")r.SetAttributeQuantization(u,a.quantizationBits[l]);else if(typeof a.quantizationVolume=="object"){let{quantizationVolume:p}=a,v=Math.max(p.max[0]-p.min[0],p.max[1]-p.min[1],p.max[2]-p.min[2]);r.SetAttributeExplicitQuantization(u,a.quantizationBits[l],m.getElementSize(),p.min,v)}else throw new Error("Invalid quantization volume state.")}let g=e.getIndices();if(!g)throw new bs("Primitive must have indices.");s.AddFacesToMesh(n,g.getCount()/3,g.getArray()),r.SetSpeedOptions(a.encodeSpeed,a.decodeSpeed),r.SetTrackEncodedProperties(!0),a.method===gs.SEQUENTIAL||c||b?r.SetEncodingMethod(Ce.MESH_SEQUENTIAL_ENCODING):r.SetEncodingMethod(Ce.MESH_EDGEBREAKER_ENCODING);let h=r.EncodeToDracoBuffer(!(c||b),o);if(h<=0)throw new bs("Error applying Draco compression.");let w=new Uint8Array(h);for(let d=0;d<h;++d)w[d]=o.GetValue(d);let y=r.GetNumberOfEncodedPoints(),f=r.GetNumberOfEncodedFaces()*3;return Ce.destroy(o),Ce.destroy(n),Ce.destroy(s),Ce.destroy(r),{numVertices:y,numIndices:f,data:w,attributeIDs:i}}function hc(e){return e==="POSITION"?Ge.POSITION:e==="NORMAL"?Ge.NORMAL:e.startsWith("COLOR_")?Ge.COLOR:e.startsWith("TEXCOORD_")?Ge.TEX_COORD:Ge.GENERIC}function gc(e,t,a,s,n,r,i){switch(t){case D.ComponentType.UNSIGNED_BYTE:return e.AddUInt8Attribute(a,s,n,r,i);case D.ComponentType.BYTE:return e.AddInt8Attribute(a,s,n,r,i);case D.ComponentType.UNSIGNED_SHORT:return e.AddUInt16Attribute(a,s,n,r,i);case D.ComponentType.SHORT:return e.AddInt16Attribute(a,s,n,r,i);case D.ComponentType.UNSIGNED_INT:return e.AddUInt32Attribute(a,s,n,r,i);case D.ComponentType.FLOAT:return e.AddFloatAttribute(a,s,n,r,i);default:throw new Error(`Unexpected component type, "${t}".`)}}var bs=class extends Error{},pc=class extends Y{extensionName=oe;prereadTypes=[E.PRIMITIVE];prewriteTypes=[E.ACCESSOR];readDependencies=["draco3d.decoder"];writeDependencies=["draco3d.encoder"];static EXTENSION_NAME=oe;static EncoderMethod=gs;_decoderModule=null;_encoderModule=null;_encoderOptions={};install(e,t){return e==="draco3d.decoder"&&(this._decoderModule=t,fc(this._decoderModule)),e==="draco3d.encoder"&&(this._encoderModule=t,bc(this._encoderModule)),this}setEncoderOptions(e){return this._encoderOptions=e,this}preread(e){if(!this._decoderModule)throw new Error(`[${oe}] Please install extension dependency, "draco3d.decoder".`);let t=this.document.getLogger(),a=e.jsonDoc,s=new Map;try{let n=a.json.meshes||[];for(let r of n)for(let i of r.primitives){if(!i.extensions||!i.extensions.KHR_draco_mesh_compression)continue;let o=i.extensions[oe],[c,b]=s.get(o.bufferView)||[];if(!b||!c){let g=a.json.bufferViews[o.bufferView],h=a.json.buffers[g.buffer],w=h.uri?a.resources[h.uri]:a.resources[rt],y=g.byteOffset||0,f=g.byteLength,d=L.toView(w,y,f);c=new this._decoderModule.Decoder,b=cc(c,d),s.set(o.bufferView,[c,b]),t.debug(`[${oe}] Decompressed ${d.byteLength} bytes.`)}for(let g in o.attributes){let h=e.jsonDoc.json.accessors[i.attributes[g]],w=c.GetAttributeByUniqueId(b,o.attributes[g]),y=lc(c,b,w,h);e.accessors[i.attributes[g]].setArray(y)}i.indices!==void 0&&e.accessors[i.indices].setArray(dc(c,b))}}finally{for(let[n,r]of Array.from(s.values()))this._decoderModule.destroy(n),this._decoderModule.destroy(r)}return this}read(e){return this}prewrite(e,t){if(!this._encoderModule)throw new Error(`[${oe}] Please install extension dependency, "draco3d.encoder".`);let a=this.document.getLogger();a.debug(`[${oe}] Compression options: ${JSON.stringify(this._encoderOptions)}`);let s=mc(this.document),n=new Map,r="mesh";this._encoderOptions.quantizationVolume==="scene"&&(this.document.getRoot().listScenes().length!==1?a.warn(`[${oe}]: quantizationVolume=scene requires exactly 1 scene.`):r=nn(this.document.getRoot().listScenes().pop()));for(let i of Array.from(s.keys())){let o=s.get(i);if(!o)throw new Error("Unexpected primitive.");if(n.has(o)){n.set(o,n.get(o));continue}let c=i.getIndices(),b=e.jsonDoc.json.accessors,g;try{g=uc(i,{...this._encoderOptions,quantizationVolume:r})}catch(y){if(y instanceof bs){a.warn(`[${oe}]: ${y.message} Skipping primitive compression.`);continue}throw y}n.set(o,g);let h=e.createAccessorDef(c);h.count=g.numIndices,e.accessorIndexMap.set(c,b.length),b.push(h),g.numVertices>65534&&D.getComponentSize(h.componentType)<=2?h.componentType=D.ComponentType.UNSIGNED_INT:g.numVertices>254&&D.getComponentSize(h.componentType)<=1&&(h.componentType=D.ComponentType.UNSIGNED_SHORT);for(let y of i.listSemantics()){let f=i.getAttribute(y);if(g.attributeIDs[y]===void 0)continue;let d=e.createAccessorDef(f);d.count=g.numVertices,e.accessorIndexMap.set(f,b.length),b.push(d)}let w=i.getAttribute("POSITION").getBuffer()||this.document.getRoot().listBuffers()[0];e.otherBufferViews.has(w)||e.otherBufferViews.set(w,[]),e.otherBufferViews.get(w).push(g.data)}return a.debug(`[${oe}] Compressed ${s.size} primitives.`),e.extensionData[oe]={primitiveHashMap:s,primitiveEncodingMap:n},this}write(e){let t=e.extensionData[oe];for(let a of this.document.getRoot().listMeshes()){let s=e.jsonDoc.json.meshes[e.meshIndexMap.get(a)];for(let n=0;n<a.listPrimitives().length;n++){let r=a.listPrimitives()[n],i=s.primitives[n],o=t.primitiveHashMap.get(r);if(!o)continue;let c=t.primitiveEncodingMap.get(o);c&&(i.extensions=i.extensions||{},i.extensions[oe]={bufferView:e.otherBufferViewsIndexMap.get(c.data),attributes:c.attributeIDs})}}if(!t.primitiveHashMap.size){let a=e.jsonDoc.json;a.extensionsUsed=(a.extensionsUsed||[]).filter(s=>s!==oe),a.extensionsRequired=(a.extensionsRequired||[]).filter(s=>s!==oe)}return this}};function mc(e){let t=e.getLogger(),a=new Set,s=new Set,n=0,r=0;for(let h of e.getRoot().listMeshes())for(let w of h.listPrimitives())w.getIndices()?w.getMode()!==Lt.Mode.TRIANGLES?(s.add(w),r++):a.add(w):(s.add(w),n++);n>0&&t.warn(`[${oe}] Skipping Draco compression of ${n} non-indexed primitives.`),r>0&&t.warn(`[${oe}] Skipping Draco compression of ${r} non-TRIANGLES primitives.`);let i=e.getRoot().listAccessors(),o=new Map;for(let h=0;h<i.length;h++)o.set(i[h],h);let c=new Map,b=new Set,g=new Map;for(let h of Array.from(a)){let w=Nn(h,o);if(b.has(w)){g.set(h,w);continue}if(c.has(h.getIndices())){let y=h.getIndices(),f=y.clone();o.set(f,e.getRoot().listAccessors().length-1),h.swap(y,f)}for(let y of h.listAttributes())if(c.has(y)){let f=y.clone();o.set(f,e.getRoot().listAccessors().length-1),h.swap(y,f)}w=Nn(h,o),b.add(w),g.set(h,w),c.set(h.getIndices(),w);for(let y of h.listAttributes())c.set(y,w)}for(let h of Array.from(c.keys())){let w=new Set(h.listParents().map(y=>y.propertyType));if(w.size!==2||!w.has(E.PRIMITIVE)||!w.has(E.ROOT))throw new Error(`[${oe}] Compressed accessors must only be used as indices or vertex attributes.`)}for(let h of Array.from(a)){let w=g.get(h),y=h.getIndices();if(c.get(y)!==w||h.listAttributes().some(f=>c.get(f)!==w))throw new Error(`[${oe}] Draco primitives must share all, or no, accessors.`)}for(let h of Array.from(s)){let w=h.getIndices();if(c.has(w)||h.listAttributes().some(y=>c.has(y)))throw new Error(`[${oe}] Accessor cannot be shared by compressed and uncompressed primitives.`)}return g}function Nn(e,t){let a=[],s=e.getIndices();a.push(t.get(s));for(let n of e.listAttributes())a.push(t.get(n));return a.sort().join("|")}var jn=class qn extends z{static EXTENSION_NAME=Je;static Type={POINT:"point",SPOT:"spot",DIRECTIONAL:"directional"};init(){this.extensionName=Je,this.propertyType="Light",this.parentTypes=[E.NODE]}getDefaults(){return Object.assign(super.getDefaults(),{color:[1,1,1],intensity:1,type:qn.Type.POINT,range:null,innerConeAngle:0,outerConeAngle:Math.PI/4})}getColor(){return this.get("color")}setColor(t){return this.set("color",t)}getIntensity(){return this.get("intensity")}setIntensity(t){return this.set("intensity",t)}getType(){return this.get("type")}setType(t){return this.set("type",t)}getRange(){return this.get("range")}setRange(t){return this.set("range",t)}getInnerConeAngle(){return this.get("innerConeAngle")}setInnerConeAngle(t){return this.set("innerConeAngle",t)}getOuterConeAngle(){return this.get("outerConeAngle")}setOuterConeAngle(t){return this.set("outerConeAngle",t)}},xc=class extends Y{extensionName=Je;static EXTENSION_NAME=Je;createLight(e=""){return new jn(this.document.getGraph(),e)}read(e){let t=e.jsonDoc;if(!t.json.extensions||!t.json.extensions.KHR_lights_punctual)return this;let a=(t.json.extensions.KHR_lights_punctual.lights||[]).map(s=>{let n=this.createLight().setName(s.name||"").setType(s.type);return s.color!==void 0&&n.setColor(s.color),s.intensity!==void 0&&n.setIntensity(s.intensity),s.range!==void 0&&n.setRange(s.range),s.spot?.innerConeAngle!==void 0&&n.setInnerConeAngle(s.spot.innerConeAngle),s.spot?.outerConeAngle!==void 0&&n.setOuterConeAngle(s.spot.outerConeAngle),n});return t.json.nodes.forEach((s,n)=>{if(!s.extensions||!s.extensions.KHR_lights_punctual)return;let r=s.extensions[Je];e.nodes[n].setExtension(Je,a[r.light])}),this}write(e){let t=e.jsonDoc;if(this.properties.size===0)return this;let a=[],s=new Map;for(let n of this.properties){let r=n,i={type:r.getType()};te.eq(r.getColor(),[1,1,1])||(i.color=r.getColor()),r.getIntensity()!==1&&(i.intensity=r.getIntensity()),r.getRange()!=null&&(i.range=r.getRange()),r.getName()&&(i.name=r.getName()),r.getType()===jn.Type.SPOT&&(i.spot={innerConeAngle:r.getInnerConeAngle(),outerConeAngle:r.getOuterConeAngle()}),a.push(i),s.set(r,a.length-1)}return this.document.getRoot().listNodes().forEach(n=>{let r=n.getExtension(Je);if(r){let i=e.nodeIndexMap.get(n),o=t.json.nodes[i];o.extensions=o.extensions||{},o.extensions[Je]={light:s.get(r)}}}),t.json.extensions=t.json.extensions||{},t.json.extensions[Je]={lights:a},this}},{R:yc,G:vc,B:wc}=Le,Tc=class extends z{static EXTENSION_NAME=ct;init(){this.extensionName=ct,this.propertyType="Anisotropy",this.parentTypes=[E.MATERIAL]}getDefaults(){return Object.assign(super.getDefaults(),{anisotropyStrength:0,anisotropyRotation:0,anisotropyTexture:null,anisotropyTextureInfo:new ee(this.graph,"anisotropyTextureInfo")})}getAnisotropyStrength(){return this.get("anisotropyStrength")}setAnisotropyStrength(e){return this.set("anisotropyStrength",e)}getAnisotropyRotation(){return this.get("anisotropyRotation")}setAnisotropyRotation(e){return this.set("anisotropyRotation",e)}getAnisotropyTexture(){return this.getRef("anisotropyTexture")}getAnisotropyTextureInfo(){return this.getRef("anisotropyTexture")?this.getRef("anisotropyTextureInfo"):null}setAnisotropyTexture(e){return this.setRef("anisotropyTexture",e,{channels:yc|vc|wc})}},Ec=class extends Y{static EXTENSION_NAME=ct;extensionName=ct;prereadTypes=[E.MESH];prewriteTypes=[E.MESH];createAnisotropy(){return new Tc(this.document.getGraph())}read(e){return this}write(e){return this}preread(e){let t=e.jsonDoc,a=t.json.materials||[],s=t.json.textures||[];return a.forEach((n,r)=>{if(n.extensions&&n.extensions.KHR_materials_anisotropy){let i=this.createAnisotropy();e.materials[r].setExtension(ct,i);let o=n.extensions[ct];if(o.anisotropyStrength!==void 0&&i.setAnisotropyStrength(o.anisotropyStrength),o.anisotropyRotation!==void 0&&i.setAnisotropyRotation(o.anisotropyRotation),o.anisotropyTexture!==void 0){let c=o.anisotropyTexture,b=e.textures[s[c.index].source];i.setAnisotropyTexture(b),e.setTextureInfo(i.getAnisotropyTextureInfo(),c)}}}),this}prewrite(e){let t=e.jsonDoc;return this.document.getRoot().listMaterials().forEach(a=>{let s=a.getExtension(ct);if(s){let n=e.materialIndexMap.get(a),r=t.json.materials[n];r.extensions=r.extensions||{};let i=r.extensions[ct]={};if(s.getAnisotropyStrength()>0&&(i.anisotropyStrength=s.getAnisotropyStrength()),s.getAnisotropyRotation()!==0&&(i.anisotropyRotation=s.getAnisotropyRotation()),s.getAnisotropyTexture()){let o=s.getAnisotropyTexture(),c=s.getAnisotropyTextureInfo();i.anisotropyTexture=e.createTextureInfoDef(o,c)}}}),this}},{R:Fn,G:On,B:Rc}=Le,Ic=class extends z{static EXTENSION_NAME=dt;init(){this.extensionName=dt,this.propertyType="Clearcoat",this.parentTypes=[E.MATERIAL]}getDefaults(){return Object.assign(super.getDefaults(),{clearcoatFactor:0,clearcoatTexture:null,clearcoatTextureInfo:new ee(this.graph,"clearcoatTextureInfo"),clearcoatRoughnessFactor:0,clearcoatRoughnessTexture:null,clearcoatRoughnessTextureInfo:new ee(this.graph,"clearcoatRoughnessTextureInfo"),clearcoatNormalScale:1,clearcoatNormalTexture:null,clearcoatNormalTextureInfo:new ee(this.graph,"clearcoatNormalTextureInfo")})}getClearcoatFactor(){return this.get("clearcoatFactor")}setClearcoatFactor(e){return this.set("clearcoatFactor",e)}getClearcoatTexture(){return this.getRef("clearcoatTexture")}getClearcoatTextureInfo(){return this.getRef("clearcoatTexture")?this.getRef("clearcoatTextureInfo"):null}setClearcoatTexture(e){return this.setRef("clearcoatTexture",e,{channels:Fn})}getClearcoatRoughnessFactor(){return this.get("clearcoatRoughnessFactor")}setClearcoatRoughnessFactor(e){return this.set("clearcoatRoughnessFactor",e)}getClearcoatRoughnessTexture(){return this.getRef("clearcoatRoughnessTexture")}getClearcoatRoughnessTextureInfo(){return this.getRef("clearcoatRoughnessTexture")?this.getRef("clearcoatRoughnessTextureInfo"):null}setClearcoatRoughnessTexture(e){return this.setRef("clearcoatRoughnessTexture",e,{channels:On})}getClearcoatNormalScale(){return this.get("clearcoatNormalScale")}setClearcoatNormalScale(e){return this.set("clearcoatNormalScale",e)}getClearcoatNormalTexture(){return this.getRef("clearcoatNormalTexture")}getClearcoatNormalTextureInfo(){return this.getRef("clearcoatNormalTexture")?this.getRef("clearcoatNormalTextureInfo"):null}setClearcoatNormalTexture(e){return this.setRef("clearcoatNormalTexture",e,{channels:Fn|On|Rc})}},kc=class extends Y{static EXTENSION_NAME=dt;extensionName=dt;prereadTypes=[E.MESH];prewriteTypes=[E.MESH];createClearcoat(){return new Ic(this.document.getGraph())}read(e){return this}write(e){return this}preread(e){let t=e.jsonDoc,a=t.json.materials||[],s=t.json.textures||[];return a.forEach((n,r)=>{if(n.extensions&&n.extensions.KHR_materials_clearcoat){let i=this.createClearcoat();e.materials[r].setExtension(dt,i);let o=n.extensions[dt];if(o.clearcoatFactor!==void 0&&i.setClearcoatFactor(o.clearcoatFactor),o.clearcoatRoughnessFactor!==void 0&&i.setClearcoatRoughnessFactor(o.clearcoatRoughnessFactor),o.clearcoatTexture!==void 0){let c=o.clearcoatTexture,b=e.textures[s[c.index].source];i.setClearcoatTexture(b),e.setTextureInfo(i.getClearcoatTextureInfo(),c)}if(o.clearcoatRoughnessTexture!==void 0){let c=o.clearcoatRoughnessTexture,b=e.textures[s[c.index].source];i.setClearcoatRoughnessTexture(b),e.setTextureInfo(i.getClearcoatRoughnessTextureInfo(),c)}if(o.clearcoatNormalTexture!==void 0){let c=o.clearcoatNormalTexture,b=e.textures[s[c.index].source];i.setClearcoatNormalTexture(b),e.setTextureInfo(i.getClearcoatNormalTextureInfo(),c),c.scale!==void 0&&i.setClearcoatNormalScale(c.scale)}}}),this}prewrite(e){let t=e.jsonDoc;return this.document.getRoot().listMaterials().forEach(a=>{let s=a.getExtension(dt);if(s){let n=e.materialIndexMap.get(a),r=t.json.materials[n];r.extensions=r.extensions||{};let i=r.extensions[dt]={clearcoatFactor:s.getClearcoatFactor(),clearcoatRoughnessFactor:s.getClearcoatRoughnessFactor()};if(s.getClearcoatTexture()){let o=s.getClearcoatTexture(),c=s.getClearcoatTextureInfo();i.clearcoatTexture=e.createTextureInfoDef(o,c)}if(s.getClearcoatRoughnessTexture()){let o=s.getClearcoatRoughnessTexture(),c=s.getClearcoatRoughnessTextureInfo();i.clearcoatRoughnessTexture=e.createTextureInfoDef(o,c)}if(s.getClearcoatNormalTexture()){let o=s.getClearcoatNormalTexture(),c=s.getClearcoatNormalTextureInfo();i.clearcoatNormalTexture=e.createTextureInfoDef(o,c),s.getClearcoatNormalScale()!==1&&(i.clearcoatNormalTexture.scale=s.getClearcoatNormalScale())}}}),this}},{R:Mc,G:Ac,B:Sc,A:_c}=Le,Nc=class extends z{static EXTENSION_NAME=lt;init(){this.extensionName=lt,this.propertyType="DiffuseTransmission",this.parentTypes=[E.MATERIAL]}getDefaults(){return Object.assign(super.getDefaults(),{diffuseTransmissionFactor:0,diffuseTransmissionTexture:null,diffuseTransmissionTextureInfo:new ee(this.graph,"diffuseTransmissionTextureInfo"),diffuseTransmissionColorFactor:[1,1,1],diffuseTransmissionColorTexture:null,diffuseTransmissionColorTextureInfo:new ee(this.graph,"diffuseTransmissionColorTextureInfo")})}getDiffuseTransmissionFactor(){return this.get("diffuseTransmissionFactor")}setDiffuseTransmissionFactor(e){return this.set("diffuseTransmissionFactor",e)}getDiffuseTransmissionTexture(){return this.getRef("diffuseTransmissionTexture")}getDiffuseTransmissionTextureInfo(){return this.getRef("diffuseTransmissionTexture")?this.getRef("diffuseTransmissionTextureInfo"):null}setDiffuseTransmissionTexture(e){return this.setRef("diffuseTransmissionTexture",e,{channels:_c})}getDiffuseTransmissionColorFactor(){return this.get("diffuseTransmissionColorFactor")}setDiffuseTransmissionColorFactor(e){return this.set("diffuseTransmissionColorFactor",e)}getDiffuseTransmissionColorTexture(){return this.getRef("diffuseTransmissionColorTexture")}getDiffuseTransmissionColorTextureInfo(){return this.getRef("diffuseTransmissionColorTexture")?this.getRef("diffuseTransmissionColorTextureInfo"):null}setDiffuseTransmissionColorTexture(e){return this.setRef("diffuseTransmissionColorTexture",e,{channels:Mc|Ac|Sc})}},jc=class extends Y{extensionName=lt;static EXTENSION_NAME=lt;createDiffuseTransmission(){return new Nc(this.document.getGraph())}read(e){let t=e.jsonDoc,a=t.json.materials||[],s=t.json.textures||[];return a.forEach((n,r)=>{if(n.extensions&&n.extensions.KHR_materials_diffuse_transmission){let i=this.createDiffuseTransmission();e.materials[r].setExtension(lt,i);let o=n.extensions[lt];if(o.diffuseTransmissionFactor!==void 0&&i.setDiffuseTransmissionFactor(o.diffuseTransmissionFactor),o.diffuseTransmissionColorFactor!==void 0&&i.setDiffuseTransmissionColorFactor(o.diffuseTransmissionColorFactor),o.diffuseTransmissionTexture!==void 0){let c=o.diffuseTransmissionTexture,b=e.textures[s[c.index].source];i.setDiffuseTransmissionTexture(b),e.setTextureInfo(i.getDiffuseTransmissionTextureInfo(),c)}if(o.diffuseTransmissionColorTexture!==void 0){let c=o.diffuseTransmissionColorTexture,b=e.textures[s[c.index].source];i.setDiffuseTransmissionColorTexture(b),e.setTextureInfo(i.getDiffuseTransmissionColorTextureInfo(),c)}}}),this}write(e){let t=e.jsonDoc;for(let a of this.document.getRoot().listMaterials()){let s=a.getExtension(lt);if(!s)continue;let n=e.materialIndexMap.get(a),r=t.json.materials[n];r.extensions=r.extensions||{};let i=r.extensions[lt]={diffuseTransmissionFactor:s.getDiffuseTransmissionFactor(),diffuseTransmissionColorFactor:s.getDiffuseTransmissionColorFactor()};if(s.getDiffuseTransmissionTexture()){let o=s.getDiffuseTransmissionTexture(),c=s.getDiffuseTransmissionTextureInfo();i.diffuseTransmissionTexture=e.createTextureInfoDef(o,c)}if(s.getDiffuseTransmissionColorTexture()){let o=s.getDiffuseTransmissionColorTexture(),c=s.getDiffuseTransmissionColorTextureInfo();i.diffuseTransmissionColorTexture=e.createTextureInfoDef(o,c)}}return this}},Fc=class extends z{static EXTENSION_NAME=ft;init(){this.extensionName=ft,this.propertyType="Dispersion",this.parentTypes=[E.MATERIAL]}getDefaults(){return Object.assign(super.getDefaults(),{dispersion:0})}getDispersion(){return this.get("dispersion")}setDispersion(e){return this.set("dispersion",e)}},Oc=class extends Y{static EXTENSION_NAME=ft;extensionName=ft;prereadTypes=[E.MESH];prewriteTypes=[E.MESH];createDispersion(){return new Fc(this.document.getGraph())}read(e){return this}write(e){return this}preread(e){return(e.jsonDoc.json.materials||[]).forEach((t,a)=>{if(t.extensions&&t.extensions.KHR_materials_dispersion){let s=this.createDispersion();e.materials[a].setExtension(ft,s);let n=t.extensions[ft];n.dispersion!==void 0&&s.setDispersion(n.dispersion)}}),this}prewrite(e){let t=e.jsonDoc;return this.document.getRoot().listMaterials().forEach(a=>{let s=a.getExtension(ft);if(s){let n=e.materialIndexMap.get(a),r=t.json.materials[n];r.extensions=r.extensions||{},r.extensions[ft]={dispersion:s.getDispersion()}}}),this}},Cc=class extends z{static EXTENSION_NAME=bt;init(){this.extensionName=bt,this.propertyType="EmissiveStrength",this.parentTypes=[E.MATERIAL]}getDefaults(){return Object.assign(super.getDefaults(),{emissiveStrength:1})}getEmissiveStrength(){return this.get("emissiveStrength")}setEmissiveStrength(e){return this.set("emissiveStrength",e)}},Bc=class extends Y{static EXTENSION_NAME=bt;extensionName=bt;prereadTypes=[E.MESH];prewriteTypes=[E.MESH];createEmissiveStrength(){return new Cc(this.document.getGraph())}read(e){return this}write(e){return this}preread(e){return(e.jsonDoc.json.materials||[]).forEach((t,a)=>{if(t.extensions&&t.extensions.KHR_materials_emissive_strength){let s=this.createEmissiveStrength();e.materials[a].setExtension(bt,s);let n=t.extensions[bt];n.emissiveStrength!==void 0&&s.setEmissiveStrength(n.emissiveStrength)}}),this}prewrite(e){let t=e.jsonDoc;return this.document.getRoot().listMaterials().forEach(a=>{let s=a.getExtension(bt);if(s){let n=e.materialIndexMap.get(a),r=t.json.materials[n];r.extensions=r.extensions||{},r.extensions[bt]={emissiveStrength:s.getEmissiveStrength()}}}),this}},Dc=class extends z{static EXTENSION_NAME=ut;init(){this.extensionName=ut,this.propertyType="IOR",this.parentTypes=[E.MATERIAL]}getDefaults(){return Object.assign(super.getDefaults(),{ior:1.5})}getIOR(){return this.get("ior")}setIOR(e){return this.set("ior",e)}},Pc=class extends Y{static EXTENSION_NAME=ut;extensionName=ut;prereadTypes=[E.MESH];prewriteTypes=[E.MESH];createIOR(){return new Dc(this.document.getGraph())}read(e){return this}write(e){return this}preread(e){return(e.jsonDoc.json.materials||[]).forEach((t,a)=>{if(t.extensions&&t.extensions.KHR_materials_ior){let s=this.createIOR();e.materials[a].setExtension(ut,s);let n=t.extensions[ut];n.ior!==void 0&&s.setIOR(n.ior)}}),this}prewrite(e){let t=e.jsonDoc;return this.document.getRoot().listMaterials().forEach(a=>{let s=a.getExtension(ut);if(s){let n=e.materialIndexMap.get(a),r=t.json.materials[n];r.extensions=r.extensions||{},r.extensions[ut]={ior:s.getIOR()}}}),this}},{R:Uc,G:Lc}=Le,Kc=class extends z{static EXTENSION_NAME=ht;init(){this.extensionName=ht,this.propertyType="Iridescence",this.parentTypes=[E.MATERIAL]}getDefaults(){return Object.assign(super.getDefaults(),{iridescenceFactor:0,iridescenceTexture:null,iridescenceTextureInfo:new ee(this.graph,"iridescenceTextureInfo"),iridescenceIOR:1.3,iridescenceThicknessMinimum:100,iridescenceThicknessMaximum:400,iridescenceThicknessTexture:null,iridescenceThicknessTextureInfo:new ee(this.graph,"iridescenceThicknessTextureInfo")})}getIridescenceFactor(){return this.get("iridescenceFactor")}setIridescenceFactor(e){return this.set("iridescenceFactor",e)}getIridescenceTexture(){return this.getRef("iridescenceTexture")}getIridescenceTextureInfo(){return this.getRef("iridescenceTexture")?this.getRef("iridescenceTextureInfo"):null}setIridescenceTexture(e){return this.setRef("iridescenceTexture",e,{channels:Uc})}getIridescenceIOR(){return this.get("iridescenceIOR")}setIridescenceIOR(e){return this.set("iridescenceIOR",e)}getIridescenceThicknessMinimum(){return this.get("iridescenceThicknessMinimum")}setIridescenceThicknessMinimum(e){return this.set("iridescenceThicknessMinimum",e)}getIridescenceThicknessMaximum(){return this.get("iridescenceThicknessMaximum")}setIridescenceThicknessMaximum(e){return this.set("iridescenceThicknessMaximum",e)}getIridescenceThicknessTexture(){return this.getRef("iridescenceThicknessTexture")}getIridescenceThicknessTextureInfo(){return this.getRef("iridescenceThicknessTexture")?this.getRef("iridescenceThicknessTextureInfo"):null}setIridescenceThicknessTexture(e){return this.setRef("iridescenceThicknessTexture",e,{channels:Lc})}},Gc=class extends Y{static EXTENSION_NAME=ht;extensionName=ht;prereadTypes=[E.MESH];prewriteTypes=[E.MESH];createIridescence(){return new Kc(this.document.getGraph())}read(e){return this}write(e){return this}preread(e){let t=e.jsonDoc,a=t.json.materials||[],s=t.json.textures||[];return a.forEach((n,r)=>{if(n.extensions&&n.extensions.KHR_materials_iridescence){let i=this.createIridescence();e.materials[r].setExtension(ht,i);let o=n.extensions[ht];if(o.iridescenceFactor!==void 0&&i.setIridescenceFactor(o.iridescenceFactor),o.iridescenceIor!==void 0&&i.setIridescenceIOR(o.iridescenceIor),o.iridescenceThicknessMinimum!==void 0&&i.setIridescenceThicknessMinimum(o.iridescenceThicknessMinimum),o.iridescenceThicknessMaximum!==void 0&&i.setIridescenceThicknessMaximum(o.iridescenceThicknessMaximum),o.iridescenceTexture!==void 0){let c=o.iridescenceTexture,b=e.textures[s[c.index].source];i.setIridescenceTexture(b),e.setTextureInfo(i.getIridescenceTextureInfo(),c)}if(o.iridescenceThicknessTexture!==void 0){let c=o.iridescenceThicknessTexture,b=e.textures[s[c.index].source];i.setIridescenceThicknessTexture(b),e.setTextureInfo(i.getIridescenceThicknessTextureInfo(),c)}}}),this}prewrite(e){let t=e.jsonDoc;return this.document.getRoot().listMaterials().forEach(a=>{let s=a.getExtension(ht);if(s){let n=e.materialIndexMap.get(a),r=t.json.materials[n];r.extensions=r.extensions||{};let i=r.extensions[ht]={};if(s.getIridescenceFactor()>0&&(i.iridescenceFactor=s.getIridescenceFactor()),s.getIridescenceIOR()!==1.3&&(i.iridescenceIor=s.getIridescenceIOR()),s.getIridescenceThicknessMinimum()!==100&&(i.iridescenceThicknessMinimum=s.getIridescenceThicknessMinimum()),s.getIridescenceThicknessMaximum()!==400&&(i.iridescenceThicknessMaximum=s.getIridescenceThicknessMaximum()),s.getIridescenceTexture()){let o=s.getIridescenceTexture(),c=s.getIridescenceTextureInfo();i.iridescenceTexture=e.createTextureInfoDef(o,c)}if(s.getIridescenceThicknessTexture()){let o=s.getIridescenceThicknessTexture(),c=s.getIridescenceThicknessTextureInfo();i.iridescenceThicknessTexture=e.createTextureInfoDef(o,c)}}}),this}},{R:Cn,G:Bn,B:Dn,A:Pn}=Le,Vc=class extends z{static EXTENSION_NAME=gt;init(){this.extensionName=gt,this.propertyType="PBRSpecularGlossiness",this.parentTypes=[E.MATERIAL]}getDefaults(){return Object.assign(super.getDefaults(),{diffuseFactor:[1,1,1,1],diffuseTexture:null,diffuseTextureInfo:new ee(this.graph,"diffuseTextureInfo"),specularFactor:[1,1,1],glossinessFactor:1,specularGlossinessTexture:null,specularGlossinessTextureInfo:new ee(this.graph,"specularGlossinessTextureInfo")})}getDiffuseFactor(){return this.get("diffuseFactor")}setDiffuseFactor(e){return this.set("diffuseFactor",e)}getDiffuseTexture(){return this.getRef("diffuseTexture")}getDiffuseTextureInfo(){return this.getRef("diffuseTexture")?this.getRef("diffuseTextureInfo"):null}setDiffuseTexture(e){return this.setRef("diffuseTexture",e,{channels:Cn|Bn|Dn|Pn,isColor:!0})}getSpecularFactor(){return this.get("specularFactor")}setSpecularFactor(e){return this.set("specularFactor",e)}getGlossinessFactor(){return this.get("glossinessFactor")}setGlossinessFactor(e){return this.set("glossinessFactor",e)}getSpecularGlossinessTexture(){return this.getRef("specularGlossinessTexture")}getSpecularGlossinessTextureInfo(){return this.getRef("specularGlossinessTexture")?this.getRef("specularGlossinessTextureInfo"):null}setSpecularGlossinessTexture(e){return this.setRef("specularGlossinessTexture",e,{channels:Cn|Bn|Dn|Pn})}},zc=class extends Y{static EXTENSION_NAME=gt;extensionName=gt;prereadTypes=[E.MESH];prewriteTypes=[E.MESH];createPBRSpecularGlossiness(){return new Vc(this.document.getGraph())}read(e){return this}write(e){return this}preread(e){let t=e.jsonDoc,a=t.json.materials||[],s=t.json.textures||[];return a.forEach((n,r)=>{if(n.extensions&&n.extensions.KHR_materials_pbrSpecularGlossiness){let i=this.createPBRSpecularGlossiness();e.materials[r].setExtension(gt,i);let o=n.extensions[gt];if(o.diffuseFactor!==void 0&&i.setDiffuseFactor(o.diffuseFactor),o.specularFactor!==void 0&&i.setSpecularFactor(o.specularFactor),o.glossinessFactor!==void 0&&i.setGlossinessFactor(o.glossinessFactor),o.diffuseTexture!==void 0){let c=o.diffuseTexture,b=e.textures[s[c.index].source];i.setDiffuseTexture(b),e.setTextureInfo(i.getDiffuseTextureInfo(),c)}if(o.specularGlossinessTexture!==void 0){let c=o.specularGlossinessTexture,b=e.textures[s[c.index].source];i.setSpecularGlossinessTexture(b),e.setTextureInfo(i.getSpecularGlossinessTextureInfo(),c)}}}),this}prewrite(e){let t=e.jsonDoc;return this.document.getRoot().listMaterials().forEach(a=>{let s=a.getExtension(gt);if(s){let n=e.materialIndexMap.get(a),r=t.json.materials[n];r.extensions=r.extensions||{};let i=r.extensions[gt]={diffuseFactor:s.getDiffuseFactor(),specularFactor:s.getSpecularFactor(),glossinessFactor:s.getGlossinessFactor()};if(s.getDiffuseTexture()){let o=s.getDiffuseTexture(),c=s.getDiffuseTextureInfo();i.diffuseTexture=e.createTextureInfoDef(o,c)}if(s.getSpecularGlossinessTexture()){let o=s.getSpecularGlossinessTexture(),c=s.getSpecularGlossinessTextureInfo();i.specularGlossinessTexture=e.createTextureInfoDef(o,c)}}}),this}},{R:Xc,G:qc,B:Hc,A:Wc}=Le,Jc=class extends z{static EXTENSION_NAME=pt;init(){this.extensionName=pt,this.propertyType="Sheen",this.parentTypes=[E.MATERIAL]}getDefaults(){return Object.assign(super.getDefaults(),{sheenColorFactor:[0,0,0],sheenColorTexture:null,sheenColorTextureInfo:new ee(this.graph,"sheenColorTextureInfo"),sheenRoughnessFactor:0,sheenRoughnessTexture:null,sheenRoughnessTextureInfo:new ee(this.graph,"sheenRoughnessTextureInfo")})}getSheenColorFactor(){return this.get("sheenColorFactor")}setSheenColorFactor(e){return this.set("sheenColorFactor",e)}getSheenColorTexture(){return this.getRef("sheenColorTexture")}getSheenColorTextureInfo(){return this.getRef("sheenColorTexture")?this.getRef("sheenColorTextureInfo"):null}setSheenColorTexture(e){return this.setRef("sheenColorTexture",e,{channels:Xc|qc|Hc,isColor:!0})}getSheenRoughnessFactor(){return this.get("sheenRoughnessFactor")}setSheenRoughnessFactor(e){return this.set("sheenRoughnessFactor",e)}getSheenRoughnessTexture(){return this.getRef("sheenRoughnessTexture")}getSheenRoughnessTextureInfo(){return this.getRef("sheenRoughnessTexture")?this.getRef("sheenRoughnessTextureInfo"):null}setSheenRoughnessTexture(e){return this.setRef("sheenRoughnessTexture",e,{channels:Wc})}},Yc=class extends Y{static EXTENSION_NAME=pt;extensionName=pt;prereadTypes=[E.MESH];prewriteTypes=[E.MESH];createSheen(){return new Jc(this.document.getGraph())}read(e){return this}write(e){return this}preread(e){let t=e.jsonDoc,a=t.json.materials||[],s=t.json.textures||[];return a.forEach((n,r)=>{if(n.extensions&&n.extensions.KHR_materials_sheen){let i=this.createSheen();e.materials[r].setExtension(pt,i);let o=n.extensions[pt];if(o.sheenColorFactor!==void 0&&i.setSheenColorFactor(o.sheenColorFactor),o.sheenRoughnessFactor!==void 0&&i.setSheenRoughnessFactor(o.sheenRoughnessFactor),o.sheenColorTexture!==void 0){let c=o.sheenColorTexture,b=e.textures[s[c.index].source];i.setSheenColorTexture(b),e.setTextureInfo(i.getSheenColorTextureInfo(),c)}if(o.sheenRoughnessTexture!==void 0){let c=o.sheenRoughnessTexture,b=e.textures[s[c.index].source];i.setSheenRoughnessTexture(b),e.setTextureInfo(i.getSheenRoughnessTextureInfo(),c)}}}),this}prewrite(e){let t=e.jsonDoc;return this.document.getRoot().listMaterials().forEach(a=>{let s=a.getExtension(pt);if(s){let n=e.materialIndexMap.get(a),r=t.json.materials[n];r.extensions=r.extensions||{};let i=r.extensions[pt]={sheenColorFactor:s.getSheenColorFactor(),sheenRoughnessFactor:s.getSheenRoughnessFactor()};if(s.getSheenColorTexture()){let o=s.getSheenColorTexture(),c=s.getSheenColorTextureInfo();i.sheenColorTexture=e.createTextureInfoDef(o,c)}if(s.getSheenRoughnessTexture()){let o=s.getSheenRoughnessTexture(),c=s.getSheenRoughnessTextureInfo();i.sheenRoughnessTexture=e.createTextureInfoDef(o,c)}}}),this}},{R:$c,G:Qc,B:Zc,A:ed}=Le,td=class extends z{static EXTENSION_NAME=mt;init(){this.extensionName=mt,this.propertyType="Specular",this.parentTypes=[E.MATERIAL]}getDefaults(){return Object.assign(super.getDefaults(),{specularFactor:1,specularTexture:null,specularTextureInfo:new ee(this.graph,"specularTextureInfo"),specularColorFactor:[1,1,1],specularColorTexture:null,specularColorTextureInfo:new ee(this.graph,"specularColorTextureInfo")})}getSpecularFactor(){return this.get("specularFactor")}setSpecularFactor(e){return this.set("specularFactor",e)}getSpecularColorFactor(){return this.get("specularColorFactor")}setSpecularColorFactor(e){return this.set("specularColorFactor",e)}getSpecularTexture(){return this.getRef("specularTexture")}getSpecularTextureInfo(){return this.getRef("specularTexture")?this.getRef("specularTextureInfo"):null}setSpecularTexture(e){return this.setRef("specularTexture",e,{channels:ed})}getSpecularColorTexture(){return this.getRef("specularColorTexture")}getSpecularColorTextureInfo(){return this.getRef("specularColorTexture")?this.getRef("specularColorTextureInfo"):null}setSpecularColorTexture(e){return this.setRef("specularColorTexture",e,{channels:$c|Qc|Zc,isColor:!0})}},ad=class extends Y{static EXTENSION_NAME=mt;extensionName=mt;prereadTypes=[E.MESH];prewriteTypes=[E.MESH];createSpecular(){return new td(this.document.getGraph())}read(e){return this}write(e){return this}preread(e){let t=e.jsonDoc,a=t.json.materials||[],s=t.json.textures||[];return a.forEach((n,r)=>{if(n.extensions&&n.extensions.KHR_materials_specular){let i=this.createSpecular();e.materials[r].setExtension(mt,i);let o=n.extensions[mt];if(o.specularFactor!==void 0&&i.setSpecularFactor(o.specularFactor),o.specularColorFactor!==void 0&&i.setSpecularColorFactor(o.specularColorFactor),o.specularTexture!==void 0){let c=o.specularTexture,b=e.textures[s[c.index].source];i.setSpecularTexture(b),e.setTextureInfo(i.getSpecularTextureInfo(),c)}if(o.specularColorTexture!==void 0){let c=o.specularColorTexture,b=e.textures[s[c.index].source];i.setSpecularColorTexture(b),e.setTextureInfo(i.getSpecularColorTextureInfo(),c)}}}),this}prewrite(e){let t=e.jsonDoc;return this.document.getRoot().listMaterials().forEach(a=>{let s=a.getExtension(mt);if(s){let n=e.materialIndexMap.get(a),r=t.json.materials[n];r.extensions=r.extensions||{};let i=r.extensions[mt]={};if(s.getSpecularFactor()!==1&&(i.specularFactor=s.getSpecularFactor()),te.eq(s.getSpecularColorFactor(),[1,1,1])||(i.specularColorFactor=s.getSpecularColorFactor()),s.getSpecularTexture()){let o=s.getSpecularTexture(),c=s.getSpecularTextureInfo();i.specularTexture=e.createTextureInfoDef(o,c)}if(s.getSpecularColorTexture()){let o=s.getSpecularColorTexture(),c=s.getSpecularColorTextureInfo();i.specularColorTexture=e.createTextureInfoDef(o,c)}}}),this}},{R:sd}=Le,nd=class extends z{static EXTENSION_NAME=xt;init(){this.extensionName=xt,this.propertyType="Transmission",this.parentTypes=[E.MATERIAL]}getDefaults(){return Object.assign(super.getDefaults(),{transmissionFactor:0,transmissionTexture:null,transmissionTextureInfo:new ee(this.graph,"transmissionTextureInfo")})}getTransmissionFactor(){return this.get("transmissionFactor")}setTransmissionFactor(e){return this.set("transmissionFactor",e)}getTransmissionTexture(){return this.getRef("transmissionTexture")}getTransmissionTextureInfo(){return this.getRef("transmissionTexture")?this.getRef("transmissionTextureInfo"):null}setTransmissionTexture(e){return this.setRef("transmissionTexture",e,{channels:sd})}},rd=class extends Y{static EXTENSION_NAME=xt;extensionName=xt;prereadTypes=[E.MESH];prewriteTypes=[E.MESH];createTransmission(){return new nd(this.document.getGraph())}read(e){return this}write(e){return this}preread(e){let t=e.jsonDoc,a=t.json.materials||[],s=t.json.textures||[];return a.forEach((n,r)=>{if(n.extensions&&n.extensions.KHR_materials_transmission){let i=this.createTransmission();e.materials[r].setExtension(xt,i);let o=n.extensions[xt];if(o.transmissionFactor!==void 0&&i.setTransmissionFactor(o.transmissionFactor),o.transmissionTexture!==void 0){let c=o.transmissionTexture,b=e.textures[s[c.index].source];i.setTransmissionTexture(b),e.setTextureInfo(i.getTransmissionTextureInfo(),c)}}}),this}prewrite(e){let t=e.jsonDoc;return this.document.getRoot().listMaterials().forEach(a=>{let s=a.getExtension(xt);if(s){let n=e.materialIndexMap.get(a),r=t.json.materials[n];r.extensions=r.extensions||{};let i=r.extensions[xt]={transmissionFactor:s.getTransmissionFactor()};if(s.getTransmissionTexture()){let o=s.getTransmissionTexture(),c=s.getTransmissionTextureInfo();i.transmissionTexture=e.createTextureInfoDef(o,c)}}}),this}},id=class extends z{static EXTENSION_NAME=Nt;init(){this.extensionName=Nt,this.propertyType="Unlit",this.parentTypes=[E.MATERIAL]}},od=class extends Y{static EXTENSION_NAME=Nt;extensionName=Nt;prereadTypes=[E.MESH];prewriteTypes=[E.MESH];createUnlit(){return new id(this.document.getGraph())}read(e){return this}write(e){return this}preread(e){return(e.jsonDoc.json.materials||[]).forEach((t,a)=>{t.extensions&&t.extensions.KHR_materials_unlit&&e.materials[a].setExtension(Nt,this.createUnlit())}),this}prewrite(e){let t=e.jsonDoc;return this.document.getRoot().listMaterials().forEach(a=>{if(a.getExtension("KHR_materials_unlit")){let s=e.materialIndexMap.get(a),n=t.json.materials[s];n.extensions=n.extensions||{},n.extensions[Nt]={}}}),this}},cd=class extends z{static EXTENSION_NAME=Se;init(){this.extensionName=Se,this.propertyType="Mapping",this.parentTypes=["MappingList"]}getDefaults(){return Object.assign(super.getDefaults(),{material:null,variants:new $})}getMaterial(){return this.getRef("material")}setMaterial(e){return this.setRef("material",e)}addVariant(e){return this.addRef("variants",e)}removeVariant(e){return this.removeRef("variants",e)}listVariants(){return this.listRefs("variants")}},dd=class extends z{static EXTENSION_NAME=Se;init(){this.extensionName=Se,this.propertyType="MappingList",this.parentTypes=[E.PRIMITIVE]}getDefaults(){return Object.assign(super.getDefaults(),{mappings:new $})}addMapping(e){return this.addRef("mappings",e)}removeMapping(e){return this.removeRef("mappings",e)}listMappings(){return this.listRefs("mappings")}},Un=class extends z{static EXTENSION_NAME=Se;init(){this.extensionName=Se,this.propertyType="Variant",this.parentTypes=["MappingList"]}},ld=class extends Y{extensionName=Se;static EXTENSION_NAME=Se;createMappingList(){return new dd(this.document.getGraph())}createVariant(e=""){return new Un(this.document.getGraph(),e)}createMapping(){return new cd(this.document.getGraph())}listVariants(){return Array.from(this.properties).filter(e=>e instanceof Un)}read(e){let t=e.jsonDoc;if(!t.json.extensions||!t.json.extensions.KHR_materials_variants)return this;let a=(t.json.extensions.KHR_materials_variants.variants||[]).map(s=>this.createVariant().setName(s.name||""));return(t.json.meshes||[]).forEach((s,n)=>{let r=e.meshes[n];(s.primitives||[]).forEach((i,o)=>{if(!i.extensions||!i.extensions.KHR_materials_variants)return;let c=this.createMappingList(),b=i.extensions[Se];for(let g of b.mappings){let h=this.createMapping();g.material!==void 0&&h.setMaterial(e.materials[g.material]);for(let w of g.variants||[])h.addVariant(a[w]);c.addMapping(h)}r.listPrimitives()[o].setExtension(Se,c)})}),this}write(e){let t=e.jsonDoc,a=this.listVariants();if(!a.length)return this;let s=[],n=new Map;for(let r of a)n.set(r,s.length),s.push(e.createPropertyDef(r));for(let r of this.document.getRoot().listMeshes()){let i=e.meshIndexMap.get(r);r.listPrimitives().forEach((o,c)=>{let b=o.getExtension(Se);if(!b)return;let g=e.jsonDoc.json.meshes[i].primitives[c],h=b.listMappings().map(w=>{let y=e.createPropertyDef(w),f=w.getMaterial();return f&&(y.material=e.materialIndexMap.get(f)),y.variants=w.listVariants().map(d=>n.get(d)),y});g.extensions=g.extensions||{},g.extensions[Se]={mappings:h}})}return t.json.extensions=t.json.extensions||{},t.json.extensions[Se]={variants:s},this}},{G:fd}=Le,bd=class extends z{static EXTENSION_NAME=yt;init(){this.extensionName=yt,this.propertyType="Volume",this.parentTypes=[E.MATERIAL]}getDefaults(){return Object.assign(super.getDefaults(),{thicknessFactor:0,thicknessTexture:null,thicknessTextureInfo:new ee(this.graph,"thicknessTexture"),attenuationDistance:1/0,attenuationColor:[1,1,1]})}getThicknessFactor(){return this.get("thicknessFactor")}setThicknessFactor(e){return this.set("thicknessFactor",e)}getThicknessTexture(){return this.getRef("thicknessTexture")}getThicknessTextureInfo(){return this.getRef("thicknessTexture")?this.getRef("thicknessTextureInfo"):null}setThicknessTexture(e){return this.setRef("thicknessTexture",e,{channels:fd})}getAttenuationDistance(){return this.get("attenuationDistance")}setAttenuationDistance(e){return this.set("attenuationDistance",e)}getAttenuationColor(){return this.get("attenuationColor")}setAttenuationColor(e){return this.set("attenuationColor",e)}},ud=class extends Y{static EXTENSION_NAME=yt;extensionName=yt;prereadTypes=[E.MESH];prewriteTypes=[E.MESH];createVolume(){return new bd(this.document.getGraph())}read(e){return this}write(e){return this}preread(e){let t=e.jsonDoc,a=t.json.materials||[],s=t.json.textures||[];return a.forEach((n,r)=>{if(n.extensions&&n.extensions.KHR_materials_volume){let i=this.createVolume();e.materials[r].setExtension(yt,i);let o=n.extensions[yt];if(o.thicknessFactor!==void 0&&i.setThicknessFactor(o.thicknessFactor),o.attenuationDistance!==void 0&&i.setAttenuationDistance(o.attenuationDistance),o.attenuationColor!==void 0&&i.setAttenuationColor(o.attenuationColor),o.thicknessTexture!==void 0){let c=o.thicknessTexture,b=e.textures[s[c.index].source];i.setThicknessTexture(b),e.setTextureInfo(i.getThicknessTextureInfo(),c)}}}),this}prewrite(e){let t=e.jsonDoc;return this.document.getRoot().listMaterials().forEach(a=>{let s=a.getExtension(yt);if(s){let n=e.materialIndexMap.get(a),r=t.json.materials[n];r.extensions=r.extensions||{};let i=r.extensions[yt]={};if(s.getThicknessFactor()>0&&(i.thicknessFactor=s.getThicknessFactor()),Number.isFinite(s.getAttenuationDistance())&&(i.attenuationDistance=s.getAttenuationDistance()),te.eq(s.getAttenuationColor(),[1,1,1])||(i.attenuationColor=s.getAttenuationColor()),s.getThicknessTexture()){let o=s.getThicknessTexture(),c=s.getThicknessTextureInfo();i.thicknessTexture=e.createTextureInfoDef(o,c)}}}),this}},hd=class extends Y{extensionName=Tn;static EXTENSION_NAME=Tn;read(e){return this}write(e){return this}},ps=class extends Y{extensionName=En;static EXTENSION_NAME=En;read(e){return this}write(e){return this}},gd=class extends z{static EXTENSION_NAME=vt;init(){this.extensionName=vt,this.propertyType="Visibility",this.parentTypes=[E.NODE]}getDefaults(){return Object.assign(super.getDefaults(),{visible:!0})}getVisible(){return this.get("visible")}setVisible(e){return this.set("visible",e)}},pd=class extends Y{static EXTENSION_NAME=vt;extensionName=vt;createVisibility(){return new gd(this.document.getGraph())}read(e){return(e.jsonDoc.json.nodes||[]).forEach((t,a)=>{if(t.extensions&&t.extensions.KHR_node_visibility){let s=this.createVisibility();e.nodes[a].setExtension(vt,s);let n=t.extensions[vt];n.visible!==void 0&&s.setVisible(n.visible)}}),this}write(e){let t=e.jsonDoc;for(let a of this.document.getRoot().listNodes()){let s=a.getExtension(vt);if(!s)continue;let n=e.nodeIndexMap.get(a),r=t.json.nodes[n];r.extensions=r.extensions||{},r.extensions[vt]={visible:s.getVisible()}}return this}};function md(e){return e.vkFormat>0&&e.vkFormat<=123}function Ln(e){let t=e.vkFormat===1000066e3&&e.dataFormatDescriptor[0].colorModel===167;return e.vkFormat===0||t}var xd=class{match(e){return e[0]===171&&e[1]===75&&e[2]===84&&e[3]===88&&e[4]===32&&e[5]===50&&e[6]===48&&e[7]===187&&e[8]===13&&e[9]===10&&e[10]===26&&e[11]===10}getSize(e){let t=pa(e);return[t.pixelWidth,t.pixelHeight]}getChannels(e){let t=pa(e),a=t.dataFormatDescriptor[0];if(md(t))return a.samples.length;if(Ln(t))switch(a.colorModel){case 163:return a.samples.length===2&&(a.samples[1].channelType&15)===15?4:3;case 166:return(a.samples[0].channelType&15)===3?4:3;default:throw new Error(`Unexpected KTX2 colorModel, "${a.colorModel}".`)}throw new Error(`Unexpected KTX2 vkFormat, "${t.vkFormat}".`)}getVRAMByteLength(e){let t=pa(e),a=0;if(Ln(t)){let s=this.getChannels(e)>3;for(let n=0;n<t.levels.length;n++){let r=t.levels[n];if(r.uncompressedByteLength)a+=r.uncompressedByteLength;else{let i=Math.max(1,Math.floor(t.pixelWidth/Math.pow(2,n))),o=Math.max(1,Math.floor(t.pixelHeight/Math.pow(2,n))),c=s?16:8;a+=i/4*(o/4)*c}}}else for(let s of t.levels)t.supercompressionScheme===0?a+=s.levelData.byteLength:a+=s.uncompressedByteLength;return a}},yd=class extends Y{static EXTENSION_NAME=ya;extensionName=ya;prereadTypes=[E.TEXTURE];static register(){Xe.registerFormat("image/ktx2",new xd)}preread(e){return e.jsonDoc.json.textures&&e.jsonDoc.json.textures.forEach(t=>{t.extensions&&t.extensions.KHR_texture_basisu&&(t.source=t.extensions[ya].source)}),this}read(e){return this}write(e){let t=e.jsonDoc;return this.document.getRoot().listTextures().forEach(a=>{if(a.getMimeType()==="image/ktx2"){let s=e.imageIndexMap.get(a);t.json.textures.forEach(n=>{n.source===s&&(n.extensions=n.extensions||{},n.extensions[ya]={source:n.source},delete n.source)})}}),this}},vd=class extends z{static EXTENSION_NAME=wt;init(){this.extensionName=wt,this.propertyType="Transform",this.parentTypes=[E.TEXTURE_INFO]}getDefaults(){return Object.assign(super.getDefaults(),{offset:[0,0],rotation:0,scale:[1,1],texCoord:null})}getOffset(){return this.get("offset")}setOffset(e){return this.set("offset",e)}getRotation(){return this.get("rotation")}setRotation(e){return this.set("rotation",e)}getScale(){return this.get("scale")}setScale(e){return this.set("scale",e)}getTexCoord(){return this.get("texCoord")}setTexCoord(e){return this.set("texCoord",e)}},wd=class extends Y{extensionName=wt;static EXTENSION_NAME=wt;createTransform(){return new vd(this.document.getGraph())}read(e){for(let[t,a]of Array.from(e.textureInfos.entries())){if(!a.extensions||!a.extensions.KHR_texture_transform)continue;let s=this.createTransform(),n=a.extensions[wt];n.offset!==void 0&&s.setOffset(n.offset),n.rotation!==void 0&&s.setRotation(n.rotation),n.scale!==void 0&&s.setScale(n.scale),n.texCoord!==void 0&&s.setTexCoord(n.texCoord),t.setExtension(wt,s)}return this}write(e){let t=Array.from(e.textureInfoDefMap.entries());for(let[a,s]of t){let n=a.getExtension(wt);if(!n)continue;s.extensions=s.extensions||{};let r={},i=te.eq;i(n.getOffset(),[0,0])||(r.offset=n.getOffset()),n.getRotation()!==0&&(r.rotation=n.getRotation()),i(n.getScale(),[1,1])||(r.scale=n.getScale()),n.getTexCoord()!=null&&(r.texCoord=n.getTexCoord()),s.extensions[wt]=r}return this}},Td=[E.ROOT,E.SCENE,E.NODE,E.MESH,E.MATERIAL,E.TEXTURE,E.ANIMATION],Ed=class extends z{static EXTENSION_NAME=Ke;init(){this.extensionName=Ke,this.propertyType="Packet",this.parentTypes=Td}getDefaults(){return Object.assign(super.getDefaults(),{context:{},properties:{}})}getContext(){return this.get("context")}setContext(e){return this.set("context",{...e})}listProperties(){return Object.keys(this.get("properties"))}getProperty(e){let t=this.get("properties");return e in t?t[e]:null}setProperty(e,t){this._assertContext(e);let a={...this.get("properties")};return t?a[e]=t:delete a[e],this.set("properties",a)}toJSONLD(){let e=cs(this.get("context")),t=cs(this.get("properties"));return{"@context":e,...t}}fromJSONLD(e){e=cs(e);let t=e["@context"];return t&&this.set("context",t),delete e["@context"],this.set("properties",e)}_assertContext(e){if(!(e.split(":")[0]in this.get("context")))throw new Error(`${Ke}: Missing context for term, "${e}".`)}};function cs(e){return JSON.parse(JSON.stringify(e))}var Rd=class extends Y{extensionName=Ke;static EXTENSION_NAME=Ke;createPacket(){return new Ed(this.document.getGraph())}listPackets(){return Array.from(this.properties)}read(e){let t=e.jsonDoc.json.extensions?.[Ke];if(!t||!t.packets)return this;let a=e.jsonDoc.json,s=this.document.getRoot(),n=t.packets.map(o=>this.createPacket().fromJSONLD(o)),r=[[a.asset],a.scenes,a.nodes,a.meshes,a.materials,a.images,a.animations],i=[[s],s.listScenes(),s.listNodes(),s.listMeshes(),s.listMaterials(),s.listTextures(),s.listAnimations()];for(let o=0;o<r.length;o++){let c=r[o]||[];for(let b=0;b<c.length;b++){let g=c[b];if(g.extensions&&g.extensions.KHR_xmp_json_ld){let h=g.extensions[Ke];i[o][b].setExtension(Ke,n[h.packet])}}}return this}write(e){let{json:t}=e.jsonDoc,a=[];for(let s of this.properties){a.push(s.toJSONLD());for(let n of s.listParents()){let r;switch(n.propertyType){case E.ROOT:r=t.asset;break;case E.SCENE:r=t.scenes[e.sceneIndexMap.get(n)];break;case E.NODE:r=t.nodes[e.nodeIndexMap.get(n)];break;case E.MESH:r=t.meshes[e.meshIndexMap.get(n)];break;case E.MATERIAL:r=t.materials[e.materialIndexMap.get(n)];break;case E.TEXTURE:r=t.images[e.imageIndexMap.get(n)];break;case E.ANIMATION:r=t.animations[e.animationIndexMap.get(n)];break;default:r=null,this.document.getLogger().warn(`[${Ke}]: Unsupported parent property, "${n.propertyType}"`);break}r&&(r.extensions=r.extensions||{},r.extensions[Ke]={packet:a.length-1})}}return a.length>0&&(t.extensions=t.extensions||{},t.extensions[Ke]={packets:a}),this}},Id=[ic,oc,pc,xc,Ec,kc,jc,Oc,Bc,Pc,Gc,zc,ad,Yc,rd,od,ld,ud,hd,ps,pd,yd,wd,Rd],qb=[ro,us,hs,_o,sc,rc,...Id];var fh=(function(){var e="b9H79Tebbbe9ok9Geueu9Geub9Gbb9Gruuuuuuueu9Gvuuuuueu9Gduueu9Gluuuueu9Gvuuuuub9Gouuuuuub9Gluuuub9Giuuueui8AYdilveoveovrrwrrDDoDrbqqbelve9Weiiviebeoweuec;G:Qdkr:nlAo9TW9T9VV95dbH9F9F939H79T9F9J9H229F9Jt9VV7bb8F9TW79O9V9Wt9FW9U9J9V9KW9wWVtW949c919M9MWV9mW4W2be8A9TW79O9V9Wt9FW9U9J9V9KW9wWVtW949c919M9MWVbd8F9TW79O9V9Wt9FW9U9J9V9KW9wWVtW949c919M9MWV9c9V919U9KbiE9TW79O9V9Wt9FW9U9J9V9KW9wWVtW949wWV79P9V9UblY9TW79O9V9Wt9FW9U9J9V9KW69U9KW949c919M9MWVbv8E9TW79O9V9Wt9FW9U9J9V9KW69U9KW949c919M9MWV9c9V919U9Kbo8A9TW79O9V9Wt9FW9U9J9V9KW69U9KW949wWV79P9V9UbrE9TW79O9V9Wt9FW9U9J9V9KW69U9KW949tWG91W9U9JWbwa9TW79O9V9Wt9FW9U9J9V9KW69U9KW949tWG91W9U9JW9c9V919U9KbDL9TW79O9V9Wt9FW9U9J9V9KWS9P2tWV9p9JtbqK9TW79O9V9Wt9FW9U9J9V9KWS9P2tWV9r919HtbkL9TW79O9V9Wt9FW9U9J9V9KWS9P2tWVT949WbxE9TW79O9V9Wt9F9V9Wt9P9T9P96W9wWVtW94J9H9J9OWbsa9TW79O9V9Wt9F9V9Wt9P9T9P96W9wWVtW94J9H9J9OW9ttV9P9Wbza9TW79O9V9Wt9F9V9Wt9P9T9P96W9wWVtW94SWt9J9O9sW9T9H9WbHK9TW79O9V9Wt9F79W9Ht9P9H29t9VVt9sW9T9H9WbOl79IV9RbCDwebcekdKLqN9OYdbk:Bhdhud9:8Jjjjjbc;qw9Rgr8KjjjjbcbhwdnaeTmbabcbyd;C:kjjbaoaocb9iEgDc:GeV86bbarc;adfcbcjdz:wjjjb8AdnaiTmbarc;adfadalz:vjjjb8Akarc;abfalfcbcbcjdal9RalcFe0Ez:wjjjb8Aarc;abfarc;adfalz:vjjjb8AarcUf9cb83ibarc8Wf9cb83ibarcyf9cb83ibarcaf9cb83ibarcKf9cb83ibarczf9cb83ibar9cb83iwar9cb83ibcj;abal9Uc;WFbGcjdalca0Ehqdnaicd6mbavcd9imbaDTmbadcefhkaqci2gxal2hmarc;alfclfhParc;qlfceVhsarc;qofclVhzarc;qofcKfhHarc;qofczfhOcbhAincdhCcbhodnavci6mbaH9cb83ibaO9cb83ibar9cb83i;yoar9cb83i;qoadaAfgoybbhXcbhQincbhwcbhLdninaoalfhKaoybbgYaX7aLVhLawcP0meaKhoaYhXawcefgwaQfai6mbkkcbhXarc;qofhwincwh8AcwhEdnaLaX93gocFeGg3cs0mbclhEa3ci0mba3cb9hcethEkdnaocw4cFeGg3cs0mbclh8Aa3ci0mba3cb9hceth8Aka8AaEfh3awydbh5cwh8AcwhEdnaocz4cFeGg8Ecs0mbclhEa8Eci0mba8Ecb9hcethEka3a5fh3dnaocFFFFb0mbclh8AaocFFF8F0mbaocFFFr0ceth8Akawa3aEfa8AfBdbawclfhwaXcefgXcw9hmbkaKhoaYhXaQczfgQai6mbkcbhocehwazhLinawaoaLydbarc;qofaocdtfydb6EhoaLclfhLawcefgwcw9hmbkcihCkcbh3arc;qlfcbcjdz:wjjjb8Aarc;alfcwfcbBdbar9cb83i;alaoclth8Fadhaaqhhakh5inarc;qlfadcba3cufgoaoa30Eal2falz:vjjjb8Aaiahaiah6Ehgdnaqaia39Ra3aqfai6EgYcsfc9WGgoaY9nmbarc;qofaYfcbaoaY9Rz:wjjjb8Akada3al2fh8Jcbh8Kina8Ka8FVcl4hQarc;alfa8Kcdtfh8LaAh8Mcbh8Nina8NaAfhwdndndndndndna8KPldebidkasa8Mc98GgLfhoa5aLfh8Aarc;qlfawc98GgLfRbbhXcwhwinaoRbbawtaXVhXaocefhoawcwfgwca9hmbkaYTmla8Ncith8Ea8JaLfhEcbhKinaERbbhLcwhoa8AhwinawRbbaotaLVhLawcefhwaocwfgoca9hmbkarc;qofaKfaLaX7aQ93a8E486bba8Aalfh8AaEalfhEaLhXaKcefgKaY9hmbxlkkaYTmia8Mc9:Ghoa8NcitcwGhEarc;qlfawceVfRbbcwtarc;qlfawc9:GfRbbVhLarc;qofhwaghXinawa5aofRbbcwtaaaofRbbVg8AaL9RgLcetaLcztcz91cs47cFFiGaE486bbaoalfhoawcefhwa8AhLa3aXcufgX9hmbxikkaYTmda8Jawfhoarc;qlfawfRbbhLarc;qofhwaghXinawaoRbbg8AaL9RgLcetaLcKtcK91cr4786bbawcefhwaoalfhoa8AhLa3aXcufgX9hmbxdkkaYTmeka8LydbhEcbhKarc;qofhoincdhLcbhwinaLaoawfRbbcb9hfhLawcefgwcz9hmbkclhXcbhwinaXaoawfRbbcd0fhXawcefgwcz9hmbkcwh8Acbhwina8AaoawfRbbcP0fh8Aawcefgwcz9hmbkaLaXaLaX6Egwa8Aawa8A6Egwczawcz6EaEfhEaoczfhoaKczfgKaY6mbka8LaEBdbka8Mcefh8Ma8Ncefg8Ncl9hmbka8Kcefg8KaC9hmbkaaamfhaahaxfhha5amfh5a3axfg3ai6mbkcbhocehwaPhLinawaoaLydbarc;alfaocdtfydb6EhoaLclfhLawcefgXhwaCaX9hmbkaraAcd4fa8FcdVaoaocdSE86bbaAclfgAal6mbkkabaefh8Kabcefhoalcd4gecbaDEhkadcefhOarc;abfceVhHcbhmdndninaiam9nmearc;qofcbcjdz:wjjjb8Aa8Kao9Rak6mdadamal2gwfhxcbh8JaOawfhzaocbakz:wjjjbghakfh5aqaiam9Ramaqfai6Egscsfgocl4cifcd4hCaoc9WGg8LThPindndndndndndndndndndnaDTmbara8Jcd4fRbbgLciGPlbedlbkasTmdaxa8Jfhoarc;abfa8JfRbbhLarc;qofhwashXinawaoRbbg8AaL9RgLcetaLcKtcK91cr4786bbawcefhwaoalfhoa8AhLaXcufgXmbxikkasTmia8JcitcwGhEarc;abfa8JceVfRbbcwtarc;abfa8Jc9:GgofRbbVhLaxaofhoarc;qofhwashXinawao8Vbbg8AaL9RgLcetaLcztcz91cs47cFFiGaE486bbawcefhwaoalfhoa8AhLaXcufgXmbxdkkaHa8Jc98GgEfhoazaEfh8Aarc;abfaEfRbbhXcwhwinaoRbbawtaXVhXaocefhoawcwfgwca9hmbkasTmbaLcl4hYa8JcitcKGh3axaEfhEcbhKinaERbbhLcwhoa8AhwinawRbbaotaLVhLawcefhwaocwfgoca9hmbkarc;qofaKfaLaX7aY93a3486bba8Aalfh8AaEalfhEaLhXaKcefgKas9hmbkkaDmbcbhoxlka8LTmbcbhodninarc;qofaofgwcwf8Pibaw8Pib:e9qTmeaoczfgoa8L9pmdxbkkdnavmbcehoxikcbhEaChKaChYinarc;qofaEfgocwf8Pibhyao8Pibh8PcdhLcbhwinaLaoawfRbbcb9hfhLawcefgwcz9hmbkclhXcbhwinaXaoawfRbbcd0fhXawcefgwcz9hmbkcwh8Acbhwina8AaoawfRbbcP0fh8Aawcefgwcz9hmbkaLaXaLaX6Egoa8Aaoa8A6Egoczaocz6EaYfhYaocucbaya8P:e9cb9sEgwaoaw6EaKfhKaEczfgEa8L9pmdxbkkaha8Jcd4fgoaoRbbcda8JcetcoGtV86bbxikdnaKas6mbaYas6mbaha8Jcd4fgoaoRbbcia8JcetcoGtV86bba8Ka59Ras6mra5arc;qofasz:vjjjbasfh5xikaKaY9phokaha8Jcd4fgwawRbbaoa8JcetcoGtV86bbka8Ka59RaC6mla5cbaCz:wjjjbgAaCfhYdndna8LmbaPhoxekdna8KaY9RcK9pmbaPhoxekaocdtc:q1jjbfcj1jjbaDEg5ydxggcetc;:FFFeGh8Fcuh3cuagtcu7cFeGhacbh8Marc;qofhLinarc;qofa8MfhQczhEdndndnagPDbeeeeeeedekcucbaQcwf8PibaQ8Pib:e9cb9sEhExekcbhoa8FhEinaEaaaLaofRbb9nfhEaocefgocz9hmbkkcih8Ecbh8Ainczhwdndndna5a8AcdtfydbgKPDbeeeeeeedekcucbaQcwf8PibaQ8Pib:e9cb9sEhwxekaKcetc;:FFFeGhwcuaKtcu7cFeGhXcbhoinawaXaLaofRbb9nfhwaocefgocz9hmbkkdndnawaE6mbaKa39hmeawaE9hmea5a8EcdtfydbcwSmeka8Ah8EawhEka8Acefg8Aci9hmbkaAa8Mco4fgoaoRbba8Ea8Mci4coGtV86bbdndndna5a8Ecdtfydbg3PDdbbbbbbbebkdncwa39Tg8ETmbcua3tcu7hwdndna3ceSmbcbh8NaLhQinaQhoa8Eh8AcbhXinaoRbbgEawcFeGgKaEaK6EaXa3tVhXaocefhoa8Acufg8AmbkaYaX86bbaQa8EfhQaYcefhYa8Na8Efg8Ncz6mbxdkkcbh8NaLhQinaQhoa8Eh8AcbhXinaoRbbgEawcFeGgKaEaK6EaXcetVhXaocefhoa8Acufg8AmbkaYaX:T9cFe:d9c:c:qj:bw9:9c:q;c1:I1e:d9c:b:c:e1z9:9ca188bbaQa8EfhQaYcefhYa8Na8Efg8Ncz6mbkkcbhoinaYaLaofRbbgX86bbaYaXawcFeG9pfhYaocefgocz9hmbxikkdna3ceSmbinaYcb86bbaYcefhYxbkkinaYcb86bbaYcefhYxbkkaYaQ8Pbb83bbaYcwfaQcwf8Pbb83bbaYczfhYka8Mczfg8Ma8L9pgomeaLczfhLa8KaY9RcK9pmbkkaoTmlaYh5aYTmlka8Jcefg8Jal9hmbkarc;abfaxascufal2falz:vjjjb8Aasamfhma5hoa5mbkcbhwxdkdna8Kao9RakalfgwcKcaaDEgLawaL0EgX9pmbcbhwxdkdnawaL9pmbaocbaXaw9Rgwz:wjjjbawfhokaoarc;adfalz:vjjjbalfhodnaDTmbaoaraez:vjjjbaefhokaoab9Rhwxekcbhwkarc;qwf8Kjjjjbawk5babaeadaialcdcbyd;C:kjjbz:bjjjbk9reduaecd4gdaefgicaaica0Eabcj;abae9Uc;WFbGcjdaeca0Egifcufai9Uae2aiadfaicl4cifcd4f2fcefkmbcbabBd;C:kjjbk:Ese5u8Jjjjjbc;ae9Rgl8Kjjjjbcbhvdnaici9UgocHfae0mbabcbyd;m:kjjbgrc;GeV86bbalc;abfcFecjez:wjjjb8AalcUfgw9cu83ibalc8WfgD9cu83ibalcyfgq9cu83ibalcafgk9cu83ibalcKfgx9cu83ibalczfgm9cu83ibal9cu83iwal9cu83ibabaefc9WfhPabcefgsaofhednaiTmbcmcsarcb9kgzEhHcbhOcbhAcbhCcbhXcbhQindnaeaP9nmbcbhvxikaQcufhvadaCcdtfgLydbhKaLcwfydbhYaLclfydbh8AcbhEdndndninalc;abfavcsGcitfgoydlh3dndndnaoydbgoaK9hmba3a8ASmekdnaoa8A9hmba3aY9hmbaEcefhExekaoaY9hmea3aK9hmeaEcdfhEkaEc870mdaXcufhvaLaEciGcx2goc;i1jjbfydbcdtfydbh3aLaoc;e1jjbfydbcdtfydbh8AaLaoc;a1jjbfydbcdtfydbhKcbhodnindnalavcsGcdtfydba39hmbaohYxdkcuhYavcufhvaocefgocz9hmbkkaOa3aOSgvaYce9iaYaH9oVgoGfhOdndndncbcsavEaYaoEgvcs9hmbarce9imba3a3aAa3cefaASgvEgAcefSmecmcsavEhvkasavaEcdtc;WeGV86bbavcs9hmea3aA9Rgvcetavc8F917hvinaeavcFb0crtavcFbGV86bbaecefheavcje6hoavcr4hvaoTmbka3hAxvkcPhvasaEcdtcPV86bba3hAkavTmiavaH9omicdhocehEaQhYxlkavcufhvaEclfgEc;ab9hmbkkdnaLceaYaOSceta8AaOSEcx2gvc;a1jjbfydbcdtfydbgKTaLavc;e1jjbfydbcdtfydbg8AceSGaLavc;i1jjbfydbcdtfydbg3cdSGaOcb9hGazGg5ce9hmbaw9cu83ibaD9cu83ibaq9cu83ibak9cu83ibax9cu83ibam9cu83ibal9cu83iwal9cu83ibcbhOkcbhEaXcufgvhodnindnalaocsGcdtfydba8A9hmbaEhYxdkcuhYaocufhoaEcefgEcz9hmbkkcbhodnindnalavcsGcdtfydba39hmbaohExdkcuhEavcufhvaocefgocz9hmbkkaOaKaOSg8EfhLdndnaYcm0mbaYcefhYxekcbcsa8AaLSgvEhYaLavfhLkdndnaEcm0mbaEcefhExekcbcsa3aLSgvEhEaLavfhLkc9:cua8EEh8FcbhvaEaYcltVgacFeGhodndndninavc:W1jjbfRbbaoSmeavcefgvcz9hmbxdkka5aKaO9havcm0VVmbasavc;WeV86bbxekasa8F86bbaeaa86bbaecefhekdna8EmbaKaA9Rgvcetavc8F917hvinaeavcFb0gocrtavcFbGV86bbavcr4hvaecefheaombkaKhAkdnaYcs9hmba8AaA9Rgvcetavc8F917hvinaeavcFb0gocrtavcFbGV86bbavcr4hvaecefheaombka8AhAkdnaEcs9hmba3aA9Rgvcetavc8F917hvinaeavcFb0gocrtavcFbGV86bbavcr4hvaecefheaombka3hAkalaXcdtfaKBdbaXcefcsGhvdndnaYPzbeeeeeeeeeeeeeebekalavcdtfa8ABdbaXcdfcsGhvkdndnaEPzbeeeeeeeeeeeeeebekalavcdtfa3BdbavcefcsGhvkcihoalc;abfaQcitfgEaKBdlaEa8ABdbaQcefcsGhYcdhEavhXaLhOxekcdhoalaXcdtfa3BdbcehEaXcefcsGhXaQhYkalc;abfaYcitfgva8ABdlava3Bdbalc;abfaQaEfcsGcitfgva3BdlavaKBdbascefhsaQaofcsGhQaCcifgCai6mbkkdnaeaP9nmbcbhvxekcbhvinaeavfavc:W1jjbfRbb86bbavcefgvcz9hmbkaeab9Ravfhvkalc;aef8KjjjjbavkZeeucbhddninadcefgdc8F0meceadtae6mbkkadcrfcFeGcr9Uci2cdfabci9U2cHfkmbcbabBd;m:kjjbk:Adewu8Jjjjjbcz9Rhlcbhvdnaicvfae0mbcbhvabcbRb;m:kjjbc;qeV86bbal9cb83iwabcefhoabaefc98fhrdnaiTmbcbhwcbhDindnaoar6mbcbskadaDcdtfydbgqalcwfawaqav9Rgvavc8F91gv7av9Rc507gwcdtfgkydb9Rgvc8E91c9:Gavcdt7awVhvinaoavcFb0gecrtavcFbGV86bbavcr4hvaocefhoaembkakaqBdbaqhvaDcefgDai9hmbkkdnaoar9nmbcbskaocbBbbaoab9RclfhvkavkBeeucbhddninadcefgdc8F0meceadtae6mbkkadcwfcFeGcr9Uab2cvfk:bvli99dui99ludnaeTmbcuadcetcuftcu7:Zhvdndncuaicuftcu7:ZgoJbbbZMgr:lJbbb9p9DTmbar:Ohwxekcjjjj94hwkcbhicbhDinalclfIdbgrJbbbbJbbjZalIdbgq:lar:lMalcwfIdbgk:lMgr:varJbbbb9BEgrNhxaqarNhrdndnakJbbbb9GTmbaxhqxekJbbjZar:l:tgqaq:maxJbbbb9GEhqJbbjZax:l:tgxax:marJbbbb9GEhrkdndnalcxfIdbgxJbbj:;axJbbj:;9GEgkJbbjZakJbbjZ9FEavNJbbbZJbbb:;axJbbbb9GEMgx:lJbbb9p9DTmbax:Ohmxekcjjjj94hmkdndnaqJbbj:;aqJbbj:;9GEgxJbbjZaxJbbjZ9FEaoNJbbbZJbbb:;aqJbbbb9GEMgq:lJbbb9p9DTmbaq:OhPxekcjjjj94hPkdndnarJbbj:;arJbbj:;9GEgqJbbjZaqJbbjZ9FEaoNJbbbZJbbb:;arJbbbb9GEMgr:lJbbb9p9DTmbar:Ohsxekcjjjj94hskdndnadcl9hmbabaifgzas86bbazcifam86bbazcdfaw86bbazcefaP86bbxekabaDfgzas87ebazcofam87ebazclfaw87ebazcdfaP87ebkalczfhlaiclfhiaDcwfhDaecufgembkkk;hlld99eud99eudnaeTmbdndncuaicuftcu7:ZgvJbbbZMgo:lJbbb9p9DTmbao:Ohixekcjjjj94hikaic;8FiGhrinabcofcicdalclfIdb:lalIdb:l9EgialcwfIdb:lalaicdtfIdb:l9EEgialcxfIdb:lalaicdtfIdb:l9EEgiarV87ebdndnJbbj:;JbbjZalaicdtfIdbJbbbb9DEgoalaicd7cdtfIdbJ;Zl:1ZNNgwJbbj:;awJbbj:;9GEgDJbbjZaDJbbjZ9FEavNJbbbZJbbb:;awJbbbb9GEMgw:lJbbb9p9DTmbaw:Ohqxekcjjjj94hqkabcdfaq87ebdndnalaicefciGcdtfIdbJ;Zl:1ZNaoNgwJbbj:;awJbbj:;9GEgDJbbjZaDJbbjZ9FEavNJbbbZJbbb:;awJbbbb9GEMgw:lJbbb9p9DTmbaw:Ohqxekcjjjj94hqkabaq87ebdndnaoalaicufciGcdtfIdbJ;Zl:1ZNNgoJbbj:;aoJbbj:;9GEgwJbbjZawJbbjZ9FEavNJbbbZJbbb:;aoJbbbb9GEMgo:lJbbb9p9DTmbao:Ohixekcjjjj94hikabclfai87ebabcwfhbalczfhlaecufgembkkk;3viDue99eu8Jjjjjbcjd9Rgo8Kjjjjbadcd4hrdndndndnavcd9hmbadcl6meaohwarhDinawc:CuBdbawclfhwaDcufgDmbkaeTmiadcl6mdarcdthqalhkcbhxinaohwakhDarhminawawydbgPcbaDIdbgs:8cL4cFeGc:cufasJbbbb9BEgzaPaz9kEBdbaDclfhDawclfhwamcufgmmbkakaqfhkaxcefgxaeSmixbkkaeTmdxekaeTmekarcdthkavce9hhqadcl6hdcbhxindndndnaqmbadmdc:CuhDalhwarhminaDcbawIdbgs:8cL4cFeGc:cufasJbbbb9BEgPaDaP9kEhDawclfhwamcufgmmbxdkkc:CuhDdndnavPleddbdkadmdaohwalhmarhPinawcbamIdbgs:8cL4cFeGgzc;:bazc;:b0Ec:cufasJbbbb9BEBdbamclfhmawclfhwaPcufgPmbxdkkadmecbhwarhminaoawfcbalawfIdbgs:8cL4cFeGgPc8AaPc8A0Ec:cufasJbbbb9BEBdbawclfhwamcufgmmbkkadmbcbhwarhPinaDhmdnavceSmbaoawfydbhmkdndnalawfIdbgscjjj;8iamai9RcefgmcLt9R::NJbbbZJbbb:;asJbbbb9GEMgs:lJbbb9p9DTmbas:Ohzxekcjjjj94hzkabawfazcFFFrGamcKtVBdbawclfhwaPcufgPmbkkabakfhbalakfhlaxcefgxae9hmbkkaocjdf8Kjjjjbk;YqdXui998Jjjjjbc:qd9Rgv8Kjjjjbavc:Sefcbc;Kbz:wjjjb8AcbhodnadTmbcbhoaiTmbdndnabaeSmbaehrxekavcuadcdtgwadcFFFFi0Ecbyd;u:kjjbHjjjjbbgrBd:SeavceBd:mdaraeawz:vjjjb8Akavc:GefcwfcbBdbav9cb83i:Geavc:Gefaradaiavc:Sefz:ojjjbavyd:GehDadci9Ugqcbyd;u:kjjbHjjjjbbheavc:Sefavyd:mdgkcdtfaeBdbavakcefgwBd:mdaecbaqz:wjjjbhxavc:SefawcdtfcuaicdtaicFFFFi0Ecbyd;u:kjjbHjjjjbbgmBdbavakcdfgPBd:mdalc;ebfhsaDheamhwinawalIdbasaeydbgzcwazcw6EcdtfIdbMUdbaeclfheawclfhwaicufgimbkavc:SefaPcdtfcuaqcdtadcFFFF970Ecbyd;u:kjjbHjjjjbbgPBdbdnadci6mbarheaPhwaqhiinawamaeydbcdtfIdbamaeclfydbcdtfIdbMamaecwfydbcdtfIdbMUdbaecxfheawclfhwaicufgimbkkakcifhoalc;ebfhHavc;qbfhOavheavyd:KehAavyd:OehCcbhzcbhwcbhXcehQinaehLcihkarawci2gKcdtfgeydbhsaeclfydbhdabaXcx2fgicwfaecwfydbgYBdbaiclfadBdbaiasBdbaxawfce86bbaOaYBdwaOadBdlaOasBdbaPawcdtfcbBdbdnazTmbcihkaLhiinaOakcdtfaiydbgeBdbakaeaY9haeas9haead9hGGfhkaiclfhiazcufgzmbkkaXcefhXcbhzinaCaAarazaKfcdtfydbcdtgifydbcdtfgYheaDaifgdydbgshidnasTmbdninaeydbawSmeaeclfheaicufgiTmdxbkkaeaYascdtfc98fydbBdbadadydbcufBdbkazcefgzci9hmbkdndnakTmbcuhwJbbbbh8Acbhdavyd:KehYavyd:OehKindndnaDaOadcdtfydbcdtgzfydbgembadcefhdxekadcs0hiamazfgsIdbhEasalcbadcefgdaiEcdtfIdbaHaecwaecw6EcdtfIdbMg3Udba3aE:th3aecdthiaKaYazfydbcdtfheinaPaeydbgzcdtfgsa3asIdbMgEUdbaEa8Aa8AaE9DgsEh8AazawasEhwaeclfheaic98fgimbkkadak9hmbkawcu9hmekaQaq9pmdindnaxaQfRbbmbaQhwxdkaqaQcefgQ9hmbxikkakczakcz6EhzaOheaLhOawcu9hmbkkaocdtavc:Seffc98fhedninaoTmeaeydbcbyd;q:kjjbH:bjjjbbaec98fheaocufhoxbkkavc:qdf8Kjjjjbk;IlevucuaicdtgvaicFFFFi0Egocbyd;u:kjjbHjjjjbbhralalyd9GgwcdtfarBdbalawcefBd9GabarBdbaocbyd;u:kjjbHjjjjbbhralalyd9GgocdtfarBdbalaocefBd9GabarBdlcuadcdtadcFFFFi0Ecbyd;u:kjjbHjjjjbbhralalyd9GgocdtfarBdbalaocefBd9GabarBdwabydbcbavz:wjjjb8Aadci9UhDdnadTmbabydbhoaehladhrinaoalydbcdtfgvavydbcefBdbalclfhlarcufgrmbkkdnaiTmbabydbhlabydlhrcbhvaihoinaravBdbarclfhralydbavfhvalclfhlaocufgombkkdnadci6mbabydlhrabydwhvcbhlinaecwfydbhoaeclfydbhdaraeydbcdtfgwawydbgwcefBdbavawcdtfalBdbaradcdtfgdadydbgdcefBdbavadcdtfalBdbaraocdtfgoaoydbgocefBdbavaocdtfalBdbaecxfheaDalcefgl9hmbkkdnaiTmbabydlheabydbhlinaeaeydbalydb9RBdbalclfhlaeclfheaicufgimbkkkQbabaeadaic;K1jjbz:njjjbkQbabaeadaic;m:jjjbz:njjjbk9DeeuabcFeaicdtz:wjjjbhlcbhbdnadTmbindnalaeydbcdtfgiydbcu9hmbaiabBdbabcefhbkaeclfheadcufgdmbkkabk:Vvioud9:du8Jjjjjbc;Wa9Rgl8Kjjjjbcbhvalcxfcbc;Kbz:wjjjb8AalcuadcitgoadcFFFFe0Ecbyd;u:kjjbHjjjjbbgrBdxalceBd2araeadaicez:tjjjbalcuaoadcjjjjoGEcbyd;u:kjjbHjjjjbbgwBdzadcdthednadTmbabhiinaiavBdbaiclfhiadavcefgv9hmbkkawaefhDalabBdwalawBdl9cbhqindnadTmbaq9cq9:hkarhvaDhiadheinaiav8Pibak1:NcFrG87ebavcwfhvaicdfhiaecufgembkkalclfaq:NceGcdtfydbhxalclfaq9ce98gq:NceGcdtfydbhmalc;Wbfcbcjaz:wjjjb8AaDhvadhidnadTmbinalc;Wbfav8VebcdtfgeaeydbcefBdbavcdfhvaicufgimbkkcbhvcbhiinalc;WbfavfgeydbhoaeaiBdbaoaifhiavclfgvcja9hmbkadhvdndnadTmbinalc;WbfaDamydbgicetf8VebcdtfgeaeydbgecefBdbaxaecdtfaiBdbamclfhmavcufgvmbkaq9cv9smdcbhvinabawydbcdtfavBdbawclfhwadavcefgv9hmbxdkkaq9cv9smekkclhvdninavc98Smealcxfavfydbcbyd;q:kjjbH:bjjjbbavc98fhvxbkkalc;Waf8Kjjjjbk:Jwliuo99iud9:cbhv8Jjjjjbca9Rgoczfcwfcbyd:8:kjjbBdbaocb8Pd:0:kjjb83izaocwfcbyd;i:kjjbBdbaocb8Pd;a:kjjb83ibaicd4hrdndnadmbJFFuFhwJFFuuhDJFFuuhqJFFuFhkJFFuuhxJFFuFhmxekarcdthPaehsincbhiinaoczfaifgzasaifIdbgwazIdbgDaDaw9EEUdbaoaifgzawazIdbgDaDaw9DEUdbaiclfgicx9hmbkasaPfhsavcefgvad9hmbkaoIdKhDaoIdwhwaoIdChqaoIdlhkaoIdzhxaoIdbhmkdnadTmbJbbbbJbFu9hJbbbbamax:tgmamJbbbb9DEgmakaq:tgkakam9DEgkawaD:tgwawak9DEgw:vawJbbbb9BEhwdnalmbarcdthoindndnaeclfIdbaq:tawNJbbbZMgk:lJbbb9p9DTmbak:Ohixekcjjjj94hikai:S9cC:ghHdndnaeIdbax:tawNJbbbZMgk:lJbbb9p9DTmbak:Ohixekcjjjj94hikaHai:S:ehHdndnaecwfIdbaD:tawNJbbbZMgk:lJbbb9p9DTmbak:Ohixekcjjjj94hikabaHai:T9cy:g:e83ibaeaofheabcwfhbadcufgdmbxdkkarcdthoindndnaeIdbax:tawNJbbbZMgk:lJbbb9p9DTmbak:Ohixekcjjjj94hikai:SgH9ca:gaH9cz:g9cjjj;4s:d:eaH9cFe:d:e9cF:bj;4:pj;ar:d9c:bd9:9c:p;G:d;4j:E;ar:d9cH9:9c;d;H:W:y:m:g;d;Hb:d9cv9:9c;j:KM;j:KM;j:Kd:dhOdndnaeclfIdbaq:tawNJbbbZMgk:lJbbb9p9DTmbak:Ohixekcjjjj94hikai:SgH9ca:gaH9cz:g9cjjj;4s:d:eaH9cFe:d:e9cF:bj;4:pj;ar:d9c:bd9:9c:p;G:d;4j:E;ar:d9cH9:9c;d;H:W:y:m:g;d;Hb:d9cq9:9cM;j:KM;j:KM;jl:daO:ehOdndnaecwfIdbaD:tawNJbbbZMgk:lJbbb9p9DTmbak:Ohixekcjjjj94hikabaOai:SgH9ca:gaH9cz:g9cjjj;4s:d:eaH9cFe:d:e9cF:bj;4:pj;ar:d9c:bd9:9c:p;G:d;4j:E;ar:d9cH9:9c;d;H:W:y:m:g;d;Hb:d9cC9:9c:KM;j:KM;j:KMD:d:e83ibaeaofheabcwfhbadcufgdmbkkk9teiucbcbyd;y:kjjbgeabcifc98GfgbBd;y:kjjbdndnabZbcztgd9nmbcuhiabad9RcFFifcz4nbcuSmekaehikaik;teeeudndnaeabVciGTmbabhixekdndnadcz9pmbabhixekabhiinaiaeydbBdbaiaeydlBdlaiaeydwBdwaiaeydxBdxaeczfheaiczfhiadc9Wfgdcs0mbkkadcl6mbinaiaeydbBdbaeclfheaiclfhiadc98fgdci0mbkkdnadTmbinaiaeRbb86bbaicefhiaecefheadcufgdmbkkabk:3eedudndnabciGTmbabhixekaecFeGc:b:c:ew2hldndnadcz9pmbabhixekabhiinaialBdxaialBdwaialBdlaialBdbaiczfhiadc9Wfgdcs0mbkkadcl6mbinaialBdbaiclfhiadc98fgdci0mbkkdnadTmbinaiae86bbaicefhiadcufgdmbkkabk9teiucbcbyd;y:kjjbgeabcrfc94GfgbBd;y:kjjbdndnabZbcztgd9nmbcuhiabad9RcFFifcz4nbcuSmekaehikaik9:eiuZbhedndncbyd;y:kjjbgdaecztgi9nmbcuheadai9RcFFifcz4nbcuSmekadhekcbabae9Rcifc98Gcbyd;y:kjjbfgdBd;y:kjjbdnadZbcztge9nmbadae9RcFFifcz4nb8Akkk;Qddbcjwk;mdbbbbdbbblbbbwbbbbbbbebbbdbbblbbbwbbbbbbbbbbbbbbbb4:h9w9N94:P:gW:j9O:ye9Pbbbbbbebbbdbbbebbbdbbbbbbbdbbbbbbbebbbbbbb:l29hZ;69:9kZ;N;76Z;rg97Z;z;o9xZ8J;B85Z;:;u9yZ;b;k9HZ:2;Z9DZ9e:l9mZ59A8KZ:r;T3Z:A:zYZ79OHZ;j4::8::Y:D9V8:bbbb9s:49:Z8R:hBZ9M9M;M8:L;z;o8:;8:PG89q;x:J878R:hQ8::M:B;e87bbbbbbjZbbjZbbjZ:E;V;N8::Y:DsZ9i;H;68:xd;R8:;h0838:;W:NoZbbbb:WV9O8:uf888:9i;H;68:9c9G;L89;n;m9m89;D8Ko8:bbbbf:8tZ9m836ZS:2AZL;zPZZ818EZ9e:lxZ;U98F8:819E;68:FFuuFFuuFFuuFFuFFFuFFFuFbc;mqkzebbbebbbdbbb9G:vbb",t=new Uint8Array([32,0,65,2,1,106,34,33,3,128,11,4,13,64,6,253,10,7,15,116,127,5,8,12,40,16,19,54,20,9,27,255,113,17,42,67,24,23,146,148,18,14,22,45,70,69,56,114,101,21,25,63,75,136,108,28,118,29,73,115]);if(typeof WebAssembly!="object")return{supported:!1};var a,s=WebAssembly.instantiate(n(e),{}).then(function(y){a=y.instance,a.exports.__wasm_call_ctors(),a.exports.meshopt_encodeVertexVersion(0),a.exports.meshopt_encodeIndexVersion(1)});function n(y){for(var f=new Uint8Array(y.length),d=0;d<y.length;++d){var m=y.charCodeAt(d);f[d]=m>96?m-97:m>64?m-39:m+4}for(var l=0,d=0;d<y.length;++d)f[l++]=f[d]<60?t[f[d]]:(f[d]-60)*64+f[++d];return f.buffer.slice(0,l)}function r(y){if(!y)throw new Error("Assertion failed")}function i(y){return new Uint8Array(y.buffer,y.byteOffset,y.byteLength)}function o(y,f,d,m){var l=a.exports.sbrk,u=l(f.length*4),p=l(d*4),v=new Uint8Array(a.exports.memory.buffer),T=i(f);v.set(T,u),m&&m(u,u,f.length,d);var I=y(p,u,f.length,d);v=new Uint8Array(a.exports.memory.buffer);var k=new Uint32Array(d);new Uint8Array(k.buffer).set(v.subarray(p,p+d*4)),T.set(v.subarray(u,u+f.length*4)),l(u-l(0));for(var A=0;A<f.length;++A)f[A]=k[f[A]];return[k,I]}function c(y,f,d,m){var l=a.exports.sbrk,u=l(d*4),p=l(d*m),v=new Uint8Array(a.exports.memory.buffer);v.set(i(f),p),y(u,p,d,m),v=new Uint8Array(a.exports.memory.buffer);var T=new Uint32Array(d);return new Uint8Array(T.buffer).set(v.subarray(u,u+d*4)),l(u-l(0)),T}function b(y,f,d,m,l){var u=a.exports.sbrk,p=u(f),v=u(m*l),T=new Uint8Array(a.exports.memory.buffer);T.set(i(d),v);var I=y(p,f,v,m,l),k=new Uint8Array(I);return k.set(T.subarray(p,p+I)),u(p-u(0)),k}function g(y){for(var f=0,d=0;d<y.length;++d){var m=y[d];f=f<m?m:f}return f}function h(y,f){if(r(f==2||f==4),f==4)return new Uint32Array(y.buffer,y.byteOffset,y.byteLength/4);var d=new Uint16Array(y.buffer,y.byteOffset,y.byteLength/2);return new Uint32Array(d)}function w(y,f,d,m,l,u,p){var v=a.exports.sbrk,T=v(d*m),I=v(d*u),k=new Uint8Array(a.exports.memory.buffer);k.set(i(f),I),y(T,d,m,l,I,p);var A=new Uint8Array(d*m);return A.set(k.subarray(T,T+d*m)),v(T-v(0)),A}return{ready:s,supported:!0,reorderMesh:function(y,f,d){var m=f?d?a.exports.meshopt_optimizeVertexCacheStrip:a.exports.meshopt_optimizeVertexCache:void 0;return o(a.exports.meshopt_optimizeVertexFetchRemap,y,g(y)+1,m)},reorderPoints:function(y,f){return r(y instanceof Float32Array),r(y.length%f==0),r(f>=3),c(a.exports.meshopt_spatialSortRemap,y,y.length/f,f*4)},encodeVertexBuffer:function(y,f,d){r(d>0&&d<=256),r(d%4==0);var m=a.exports.meshopt_encodeVertexBufferBound(f,d);return b(a.exports.meshopt_encodeVertexBuffer,m,y,f,d)},encodeIndexBuffer:function(y,f,d){r(d==2||d==4),r(f%3==0);var m=h(y,d),l=a.exports.meshopt_encodeIndexBufferBound(f,g(m)+1);return b(a.exports.meshopt_encodeIndexBuffer,l,m,f,4)},encodeIndexSequence:function(y,f,d){r(d==2||d==4);var m=h(y,d),l=a.exports.meshopt_encodeIndexSequenceBound(f,g(m)+1);return b(a.exports.meshopt_encodeIndexSequence,l,m,f,4)},encodeGltfBuffer:function(y,f,d,m){var l={ATTRIBUTES:this.encodeVertexBuffer,TRIANGLES:this.encodeIndexBuffer,INDICES:this.encodeIndexSequence};return r(l[m]),l[m](y,f,d)},encodeFilterOct:function(y,f,d,m){return r(d==4||d==8),r(m>=1&&m<=16),w(a.exports.meshopt_encodeFilterOct,y,f,d,m,16)},encodeFilterQuat:function(y,f,d,m){return r(d==8),r(m>=4&&m<=16),w(a.exports.meshopt_encodeFilterQuat,y,f,d,m,16)},encodeFilterExp:function(y,f,d,m,l){r(d>0&&d%4==0),r(m>=1&&m<=24);var u={Separate:0,SharedVector:1,SharedComponent:2,Clamped:3};return w(a.exports.meshopt_encodeFilterExp,y,f,d,m,d,l?u[l]:1)}}})();var ms=(function(){var e="b9H79Tebbbe8Fv9Gbb9Gvuuuuueu9Giuuub9Geueu9Giuuueuikqbeeedddillviebeoweuec:W:Odkr;leDo9TW9T9VV95dbH9F9F939H79T9F9J9H229F9Jt9VV7bb8A9TW79O9V9Wt9F9KW9J9V9KW9wWVtW949c919M9MWVbeY9TW79O9V9Wt9F9KW9J9V9KW69U9KW949c919M9MWVbdE9TW79O9V9Wt9F9KW9J9V9KW69U9KW949tWG91W9U9JWbiL9TW79O9V9Wt9F9KW9J9V9KWS9P2tWV9p9JtblK9TW79O9V9Wt9F9KW9J9V9KWS9P2tWV9r919HtbvL9TW79O9V9Wt9F9KW9J9V9KWS9P2tWVT949Wbol79IV9Rbrq:S86qdbk;jYi5ud9:du8Jjjjjbcj;kb9Rgv8Kjjjjbc9:hodnalTmbcuhoaiRbbgrc;WeGc:Ge9hmbarcsGgwce0mbc9:hoalcufadcd4cbawEgDadfgrcKcaawEgqaraq0Egk6mbaicefhxcj;abad9Uc;WFbGcjdadca0EhmaialfgPar9Rgoadfhsavaoadz1jjjbgzceVhHcbhOdndninaeaO9nmeaPax9RaD6mdamaeaO9RaOamfgoae6EgAcsfglc9WGhCabaOad2fhXaAcethQaxaDfhiaOaeaoaeao6E9RhLalcl4cifcd4hKazcj;cbfaAfhYcbh8AazcjdfhEaHh3incbhodnawTmbaxa8Acd4fRbbhokaocFeGh5cbh8Eazcj;cbfhqinaih8Fdndndndna5a8Ecet4ciGgoc9:fPdebdkaPa8F9RaA6mrazcj;cbfa8EaA2fa8FaAz1jjjb8Aa8FaAfhixdkazcj;cbfa8EaA2fcbaAz:jjjjb8Aa8FhixekaPa8F9RaK6mva8FaKfhidnaCTmbaPai9RcK6mbaocdtc:q1jjbfcj1jjbawEhaczhrcbhlinargoc9Wfghaqfhrdndndndndndnaaa8Fahco4fRbbalcoG4ciGcdtfydbPDbedvivvvlvkar9cb83bbarcwf9cb83bbxlkarcbaiRbdai8Xbb9c:c:qj:bw9:9c:q;c1:I1e:d9c:b:c:e1z9:gg9cjjjjjz:dg8J9qE86bbaqaofgrcGfag9c8F1:NghcKtc8F91aicdfa8J9c8N1:Nfg8KRbbG86bbarcVfcba8KahcjeGcr4fghRbbag9cjjjjjl:dg8J9qE86bbarc7fcbaha8J9c8L1:NfghRbbag9cjjjjjd:dg8J9qE86bbarctfcbaha8J9c8K1:NfghRbbag9cjjjjje:dg8J9qE86bbarc91fcbaha8J9c8J1:NfghRbbag9cjjjj;ab:dg8J9qE86bbarc4fcbaha8J9cg1:NfghRbbag9cjjjja:dg8J9qE86bbarc93fcbaha8J9ch1:NfghRbbag9cjjjjz:dgg9qE86bbarc94fcbahag9ca1:NfghRbbai8Xbe9c:c:qj:bw9:9c:q;c1:I1e:d9c:b:c:e1z9:gg9cjjjjjz:dg8J9qE86bbarc95fag9c8F1:NgicKtc8F91aha8J9c8N1:NfghRbbG86bbarc96fcbahaicjeGcr4fgiRbbag9cjjjjjl:dg8J9qE86bbarc97fcbaia8J9c8L1:NfgiRbbag9cjjjjjd:dg8J9qE86bbarc98fcbaia8J9c8K1:NfgiRbbag9cjjjjje:dg8J9qE86bbarc99fcbaia8J9c8J1:NfgiRbbag9cjjjj;ab:dg8J9qE86bbarc9:fcbaia8J9cg1:NfgiRbbag9cjjjja:dg8J9qE86bbarcufcbaia8J9ch1:NfgiRbbag9cjjjjz:dgg9qE86bbaiag9ca1:NfhixikaraiRblaiRbbghco4g8Ka8KciSg8KE86bbaqaofgrcGfaiclfa8Kfg8KRbbahcl4ciGg8La8LciSg8LE86bbarcVfa8Ka8Lfg8KRbbahcd4ciGg8La8LciSg8LE86bbarc7fa8Ka8Lfg8KRbbahciGghahciSghE86bbarctfa8Kahfg8KRbbaiRbeghco4g8La8LciSg8LE86bbarc91fa8Ka8Lfg8KRbbahcl4ciGg8La8LciSg8LE86bbarc4fa8Ka8Lfg8KRbbahcd4ciGg8La8LciSg8LE86bbarc93fa8Ka8Lfg8KRbbahciGghahciSghE86bbarc94fa8Kahfg8KRbbaiRbdghco4g8La8LciSg8LE86bbarc95fa8Ka8Lfg8KRbbahcl4ciGg8La8LciSg8LE86bbarc96fa8Ka8Lfg8KRbbahcd4ciGg8La8LciSg8LE86bbarc97fa8Ka8Lfg8KRbbahciGghahciSghE86bbarc98fa8KahfghRbbaiRbigico4g8Ka8KciSg8KE86bbarc99faha8KfghRbbaicl4ciGg8Ka8KciSg8KE86bbarc9:faha8KfghRbbaicd4ciGg8Ka8KciSg8KE86bbarcufaha8KfgrRbbaiciGgiaiciSgiE86bbaraifhixdkaraiRbwaiRbbghcl4g8Ka8KcsSg8KE86bbaqaofgrcGfaicwfa8Kfg8KRbbahcsGghahcsSghE86bbarcVfa8KahfghRbbaiRbeg8Kcl4g8La8LcsSg8LE86bbarc7faha8LfghRbba8KcsGg8Ka8KcsSg8KE86bbarctfaha8KfghRbbaiRbdg8Kcl4g8La8LcsSg8LE86bbarc91faha8LfghRbba8KcsGg8Ka8KcsSg8KE86bbarc4faha8KfghRbbaiRbig8Kcl4g8La8LcsSg8LE86bbarc93faha8LfghRbba8KcsGg8Ka8KcsSg8KE86bbarc94faha8KfghRbbaiRblg8Kcl4g8La8LcsSg8LE86bbarc95faha8LfghRbba8KcsGg8Ka8KcsSg8KE86bbarc96faha8KfghRbbaiRbvg8Kcl4g8La8LcsSg8LE86bbarc97faha8LfghRbba8KcsGg8Ka8KcsSg8KE86bbarc98faha8KfghRbbaiRbog8Kcl4g8La8LcsSg8LE86bbarc99faha8LfghRbba8KcsGg8Ka8KcsSg8KE86bbarc9:faha8KfghRbbaiRbrgicl4g8Ka8KcsSg8KE86bbarcufaha8KfgrRbbaicsGgiaicsSgiE86bbaraifhixekarai8Pbb83bbarcwfaicwf8Pbb83bbaiczfhikdnaoaC9pmbalcdfhlaoczfhraPai9RcL0mekkaoaC6moaimexokaCmva8FTmvkaqaAfhqa8Ecefg8Ecl9hmbkdndndndnawTmbasa8Acd4fRbbgociGPlbedrbkaATmdaza8Afh8Fazcj;cbfhhcbh8EaEhaina8FRbbhraahocbhlinaoahalfRbbgqce4cbaqceG9R7arfgr86bbaoadfhoaAalcefgl9hmbkaacefhaa8Fcefh8FahaAfhha8Ecefg8Ecl9hmbxikkaATmeaza8Afhaazcj;cbfhhcbhoceh8EaYh8FinaEaofhlaa8Vbbhrcbhoinala8FaofRbbcwtahaofRbbgqVc;:FiGce4cbaqceG9R7arfgr87bbaladfhlaLaocefgofmbka8FaQfh8FcdhoaacdfhaahaQfhha8EceGhlcbh8EalmbxdkkaATmbcbaocl49Rh8Eaza8AfRbbhqcwhoa3hlinalRbbaotaqVhqalcefhlaocwfgoca9hmbkcbhhaEh8FaYhainazcj;cbfahfRbbhrcwhoaahlinalRbbaotarVhralaAfhlaocwfgoca9hmbkara8E93aq7hqcbhoa8Fhlinalaqao486bbalcefhlaocwfgoca9hmbka8Fadfh8FaacefhaahcefghaA9hmbkkaEclfhEa3clfh3a8Aclfg8Aad6mbkaXazcjdfaAad2z1jjjb8AazazcjdfaAcufad2fadz1jjjb8AaAaOfhOaihxaimbkc9:hoxdkcbc99aPax9RakSEhoxekc9:hokavcj;kbf8Kjjjjbaok:XseHu8Jjjjjbc;ae9Rgv8Kjjjjbc9:hodnaeci9UgrcHfal0mbcuhoaiRbbgwc;WeGc;Ge9hmbawcsGgDce0mbavc;abfcFecjez:jjjjb8AavcUf9cu83ibavc8Wf9cu83ibavcyf9cu83ibavcaf9cu83ibavcKf9cu83ibavczf9cu83ibav9cu83iwav9cu83ibaialfc9WfhqaicefgwarfhldnaeTmbcmcsaDceSEhkcbhxcbhmcbhrcbhicbhoindnalaq9nmbc9:hoxikdndnawRbbgDc;Ve0mbavc;abfaoaDcu7gPcl4fcsGcitfgsydlhzasydbhHdndnaDcsGgsak9pmbavaiaPfcsGcdtfydbaxasEhDaxasTgOfhxxekdndnascsSmbcehOasc987asamffcefhDxekalcefhDal8SbbgscFeGhPdndnascu9mmbaDhlxekalcvfhlaPcFbGhPcrhsdninaD8SbbgOcFbGastaPVhPaOcu9kmeaDcefhDascrfgsc8J9hmbxdkkaDcefhlkcehOaPce4cbaPceG9R7amfhDkaDhmkavc;abfaocitfgsaDBdbasazBdlavaicdtfaDBdbavc;abfaocefcsGcitfgsaHBdbasaDBdlaocdfhoaOaifhidnadcd9hmbabarcetfgsaH87ebasclfaD87ebascdfaz87ebxdkabarcdtfgsaHBdbascwfaDBdbasclfazBdbxekdnaDcpe0mbaxcefgOavaiaqaDcsGfRbbgscl49RcsGcdtfydbascz6gPEhDavaias9RcsGcdtfydbaOaPfgzascsGgOEhsaOThOdndnadcd9hmbabarcetfgHax87ebaHclfas87ebaHcdfaD87ebxekabarcdtfgHaxBdbaHcwfasBdbaHclfaDBdbkavaicdtfaxBdbavc;abfaocitfgHaDBdbaHaxBdlavaicefgicsGcdtfaDBdbavc;abfaocefcsGcitfgHasBdbaHaDBdlavaiaPfgicsGcdtfasBdbavc;abfaocdfcsGcitfgDaxBdbaDasBdlaocifhoaiaOfhiazaOfhxxekaxcbalRbbgHEgAaDc;:eSgDfhzaHcsGhCaHcl4hXdndnaHcs0mbazcefhOxekazhOavaiaX9RcsGcdtfydbhzkdndnaCmbaOcefhxxekaOhxavaiaH9RcsGcdtfydbhOkdndnaDTmbalcefhDxekalcdfhDal8SbegPcFeGhsdnaPcu9kmbalcofhAascFbGhscrhldninaD8SbbgPcFbGaltasVhsaPcu9kmeaDcefhDalcrfglc8J9hmbkaAhDxekaDcefhDkasce4cbasceG9R7amfgmhAkdndnaXcsSmbaDhsxekaDcefhsaD8SbbglcFeGhPdnalcu9kmbaDcvfhzaPcFbGhPcrhldninas8SbbgDcFbGaltaPVhPaDcu9kmeascefhsalcrfglc8J9hmbkazhsxekascefhskaPce4cbaPceG9R7amfgmhzkdndnaCcsSmbashlxekascefhlas8SbbgDcFeGhPdnaDcu9kmbascvfhOaPcFbGhPcrhDdninal8SbbgscFbGaDtaPVhPascu9kmealcefhlaDcrfgDc8J9hmbkaOhlxekalcefhlkaPce4cbaPceG9R7amfgmhOkdndnadcd9hmbabarcetfgDaA87ebaDclfaO87ebaDcdfaz87ebxekabarcdtfgDaABdbaDcwfaOBdbaDclfazBdbkavc;abfaocitfgDazBdbaDaABdlavaicdtfaABdbavc;abfaocefcsGcitfgDaOBdbaDazBdlavaicefgicsGcdtfazBdbavc;abfaocdfcsGcitfgDaABdbaDaOBdlavaiaHcz6aXcsSVfgicsGcdtfaOBdbaiaCTaCcsSVfhiaocifhokawcefhwaocsGhoaicsGhiarcifgrae6mbkkcbc99alaqSEhokavc;aef8Kjjjjbaok:clevu8Jjjjjbcz9Rhvdnaecvfal9nmbc9:skdnaiRbbc;:eGc;qeSmbcuskav9cb83iwaicefhoaialfc98fhrdnaeTmbdnadcdSmbcbhwindnaoar6mbc9:skaocefhlao8SbbgicFeGhddndnaicu9mmbalhoxekaocvfhoadcFbGhdcrhidninal8SbbgDcFbGaitadVhdaDcu9kmealcefhlaicrfgic8J9hmbxdkkalcefhokabawcdtfadc8Etc8F91adcd47avcwfadceGcdtVglydbfgiBdbalaiBdbawcefgwae9hmbxdkkcbhwindnaoar6mbc9:skaocefhlao8SbbgicFeGhddndnaicu9mmbalhoxekaocvfhoadcFbGhdcrhidninal8SbbgDcFbGaitadVhdaDcu9kmealcefhlaicrfgic8J9hmbxdkkalcefhokabawcetfadc8Etc8F91adcd47avcwfadceGcdtVglydbfgi87ebalaiBdbawcefgwae9hmbkkcbc99aoarSEk:Lvoeue99dud99eud99dndnadcl9hmbaeTmeindndnabcdfgd8Sbb:Yab8Sbbgi:Ygl:l:tabcefgv8Sbbgo:Ygr:l:tgwJbb;:9cawawNJbbbbawawJbbbb9GgDEgq:mgkaqaicb9iEalMgwawNakaqaocb9iEarMgqaqNMM:r:vglNJbbbZJbbb:;aDEMgr:lJbbb9p9DTmbar:Ohixekcjjjj94hikadai86bbdndnaqalNJbbbZJbbb:;aqJbbbb9GEMgq:lJbbb9p9DTmbaq:Ohdxekcjjjj94hdkavad86bbdndnawalNJbbbZJbbb:;awJbbbb9GEMgw:lJbbb9p9DTmbaw:Ohdxekcjjjj94hdkabad86bbabclfhbaecufgembxdkkaeTmbindndnabclfgd8Ueb:Yab8Uebgi:Ygl:l:tabcdfgv8Uebgo:Ygr:l:tgwJb;:FSawawNJbbbbawawJbbbb9GgDEgq:mgkaqaicb9iEalMgwawNakaqaocb9iEarMgqaqNMM:r:vglNJbbbZJbbb:;aDEMgr:lJbbb9p9DTmbar:Ohixekcjjjj94hikadai87ebdndnaqalNJbbbZJbbb:;aqJbbbb9GEMgq:lJbbb9p9DTmbaq:Ohdxekcjjjj94hdkavad87ebdndnawalNJbbbZJbbb:;awJbbbb9GEMgw:lJbbb9p9DTmbaw:Ohdxekcjjjj94hdkabad87ebabcwfhbaecufgembkkk;oiliui99iue99dnaeTmbcbhiabhlindndnJ;Zl81Zalcof8UebgvciV:Y:vgoal8Ueb:YNgrJb;:FSNJbbbZJbbb:;arJbbbb9GEMgw:lJbbb9p9DTmbaw:OhDxekcjjjj94hDkalclf8Uebhqalcdf8UebhkabaiavcefciGfcetfaD87ebdndnaoak:YNgwJb;:FSNJbbbZJbbb:;awJbbbb9GEMgx:lJbbb9p9DTmbax:OhDxekcjjjj94hDkabaiavciGfgkcd7cetfaD87ebdndnaoaq:YNgoJb;:FSNJbbbZJbbb:;aoJbbbb9GEMgx:lJbbb9p9DTmbax:OhDxekcjjjj94hDkabaiavcufciGfcetfaD87ebdndnJbbjZararN:tawawN:taoaoN:tgrJbbbbarJbbbb9GE:rJb;:FSNJbbbZMgr:lJbbb9p9DTmbar:Ohvxekcjjjj94hvkabakcetfav87ebalcwfhlaiclfhiaecufgembkkk9mbdnadcd4ae2gdTmbinababydbgecwtcw91:Yaece91cjjj98Gcjjj;8if::NUdbabclfhbadcufgdmbkkk9teiucbcbyd:K1jjbgeabcifc98GfgbBd:K1jjbdndnabZbcztgd9nmbcuhiabad9RcFFifcz4nbcuSmekaehikaik;teeeudndnaeabVciGTmbabhixekdndnadcz9pmbabhixekabhiinaiaeydbBdbaiaeydlBdlaiaeydwBdwaiaeydxBdxaeczfheaiczfhiadc9Wfgdcs0mbkkadcl6mbinaiaeydbBdbaeclfheaiclfhiadc98fgdci0mbkkdnadTmbinaiaeRbb86bbaicefhiaecefheadcufgdmbkkabk:3eedudndnabciGTmbabhixekaecFeGc:b:c:ew2hldndnadcz9pmbabhixekabhiinaialBdxaialBdwaialBdlaialBdbaiczfhiadc9Wfgdcs0mbkkadcl6mbinaialBdbaiclfhiadc98fgdci0mbkkdnadTmbinaiae86bbaicefhiadcufgdmbkkabkk81dbcjwk8Kbbbbdbbblbbbwbbbbbbbebbbdbbblbbbwbbbbc:Kwkl8WNbb",t="b9H79TebbbeKl9Gbb9Gvuuuuueu9Giuuub9Geueuikqbbebeedddilve9Weeeviebeoweuec:q:6dkr;leDo9TW9T9VV95dbH9F9F939H79T9F9J9H229F9Jt9VV7bb8A9TW79O9V9Wt9F9KW9J9V9KW9wWVtW949c919M9MWVbdY9TW79O9V9Wt9F9KW9J9V9KW69U9KW949c919M9MWVblE9TW79O9V9Wt9F9KW9J9V9KW69U9KW949tWG91W9U9JWbvL9TW79O9V9Wt9F9KW9J9V9KWS9P2tWV9p9JtboK9TW79O9V9Wt9F9KW9J9V9KWS9P2tWV9r919HtbrL9TW79O9V9Wt9F9KW9J9V9KWS9P2tWVT949Wbwl79IV9RbDq;G9Mqlbzik9:evu8Jjjjjbcz9Rhbcbheincbhdcbhiinabcwfadfaicjuaead4ceGglE86bbaialfhiadcefgdcw9hmbkaec:q:yjjbfai86bbaecitc:q1jjbfab8Piw83ibaecefgecjd9hmbkk:183lYud97dur978Jjjjjbcj;kb9Rgv8Kjjjjbc9:hodnalTmbcuhoaiRbbgrc;WeGc:Ge9hmbarcsGgwce0mbc9:hoalcufadcd4cbawEgDadfgrcKcaawEgqaraq0Egk6mbaicefhxavaialfgmar9Rgoad;8qbbcj;abad9Uc;WFbGcjdadca0EhPdndndnadTmbaoadfhscbhzinaeaz9nmdamax9RaD6miabazad2fhHaxaDfhOaPaeaz9RazaPfae6EgAcsfgocl4cifcd4hCavcj;cbfaoc9WGgXcetfhQavcj;cbfaXci2fhLavcj;cbfaXfhKcbhYaoc;ab6h8AincbhodnawTmbaxaYcd4fRbbhokaocFeGhEcbh3avcj;cbfh5indndndndnaEa3cet4ciGgoc9:fPdebdkamaO9RaX6mwavcj;cbfa3aX2faOaX;8qbbaOaAfhOxdkavcj;cbfa3aX2fcbaX;8kbxekamaO9RaC6moaoclVcbawEhraOaCfhocbhidna8Ambamao9Rc;Gb6mbcbhlina5alfhidndndndndndnaOalco4fRbbgqciGarfPDbedibledibkaipxbbbbbbbbbbbbbbbbpklbxlkaiaopbblaopbbbg8Eclp:mea8EpmbzeHdOiAlCvXoQrLg8Ecdp:mea8EpmbzeHdOiAlCvXoQrLpxiiiiiiiiiiiiiiiip9og8Fpxiiiiiiiiiiiiiiiip8Jg8Ep5b9cjF;8;4;W;G;ab9:9cU1:Ngacitc:q1jjbfpbibaac:q:yjjbfRbbgapsa8Ep5e9cjF;8;4;W;G;ab9:9cU1:Nghcitc:q1jjbfpbibp9UpmbedilvorzHOACXQLpPa8Fa8Ep9spklbaaaoclffahc:q:yjjbfRbbfhoxikaiaopbbwaopbbbg8Eclp:mea8EpmbzeHdOiAlCvXoQrLpxssssssssssssssssp9og8Fpxssssssssssssssssp8Jg8Ep5b9cjF;8;4;W;G;ab9:9cU1:Ngacitc:q1jjbfpbibaac:q:yjjbfRbbgapsa8Ep5e9cjF;8;4;W;G;ab9:9cU1:Nghcitc:q1jjbfpbibp9UpmbedilvorzHOACXQLpPa8Fa8Ep9spklbaaaocwffahc:q:yjjbfRbbfhoxdkaiaopbbbpklbaoczfhoxekaiaopbbdaoRbbgacitc:q1jjbfpbibaac:q:yjjbfRbbgapsaoRbeghcitc:q1jjbfpbibp9UpmbedilvorzHOACXQLpPpklbaaaocdffahc:q:yjjbfRbbfhokdndndndndndnaqcd4ciGarfPDbedibledibkaiczfpxbbbbbbbbbbbbbbbbpklbxlkaiczfaopbblaopbbbg8Eclp:mea8EpmbzeHdOiAlCvXoQrLg8Ecdp:mea8EpmbzeHdOiAlCvXoQrLpxiiiiiiiiiiiiiiiip9og8Fpxiiiiiiiiiiiiiiiip8Jg8Ep5b9cjF;8;4;W;G;ab9:9cU1:Ngacitc:q1jjbfpbibaac:q:yjjbfRbbgapsa8Ep5e9cjF;8;4;W;G;ab9:9cU1:Nghcitc:q1jjbfpbibp9UpmbedilvorzHOACXQLpPa8Fa8Ep9spklbaaaoclffahc:q:yjjbfRbbfhoxikaiczfaopbbwaopbbbg8Eclp:mea8EpmbzeHdOiAlCvXoQrLpxssssssssssssssssp9og8Fpxssssssssssssssssp8Jg8Ep5b9cjF;8;4;W;G;ab9:9cU1:Ngacitc:q1jjbfpbibaac:q:yjjbfRbbgapsa8Ep5e9cjF;8;4;W;G;ab9:9cU1:Nghcitc:q1jjbfpbibp9UpmbedilvorzHOACXQLpPa8Fa8Ep9spklbaaaocwffahc:q:yjjbfRbbfhoxdkaiczfaopbbbpklbaoczfhoxekaiczfaopbbdaoRbbgacitc:q1jjbfpbibaac:q:yjjbfRbbgapsaoRbeghcitc:q1jjbfpbibp9UpmbedilvorzHOACXQLpPpklbaaaocdffahc:q:yjjbfRbbfhokdndndndndndnaqcl4ciGarfPDbedibledibkaicafpxbbbbbbbbbbbbbbbbpklbxlkaicafaopbblaopbbbg8Eclp:mea8EpmbzeHdOiAlCvXoQrLg8Ecdp:mea8EpmbzeHdOiAlCvXoQrLpxiiiiiiiiiiiiiiiip9og8Fpxiiiiiiiiiiiiiiiip8Jg8Ep5b9cjF;8;4;W;G;ab9:9cU1:Ngacitc:q1jjbfpbibaac:q:yjjbfRbbgapsa8Ep5e9cjF;8;4;W;G;ab9:9cU1:Nghcitc:q1jjbfpbibp9UpmbedilvorzHOACXQLpPa8Fa8Ep9spklbaaaoclffahc:q:yjjbfRbbfhoxikaicafaopbbwaopbbbg8Eclp:mea8EpmbzeHdOiAlCvXoQrLpxssssssssssssssssp9og8Fpxssssssssssssssssp8Jg8Ep5b9cjF;8;4;W;G;ab9:9cU1:Ngacitc:q1jjbfpbibaac:q:yjjbfRbbgapsa8Ep5e9cjF;8;4;W;G;ab9:9cU1:Nghcitc:q1jjbfpbibp9UpmbedilvorzHOACXQLpPa8Fa8Ep9spklbaaaocwffahc:q:yjjbfRbbfhoxdkaicafaopbbbpklbaoczfhoxekaicafaopbbdaoRbbgacitc:q1jjbfpbibaac:q:yjjbfRbbgapsaoRbeghcitc:q1jjbfpbibp9UpmbedilvorzHOACXQLpPpklbaaaocdffahc:q:yjjbfRbbfhokdndndndndndnaqco4arfPDbedibledibkaic8Wfpxbbbbbbbbbbbbbbbbpklbxlkaic8Wfaopbblaopbbbg8Eclp:mea8EpmbzeHdOiAlCvXoQrLg8Ecdp:mea8EpmbzeHdOiAlCvXoQrLpxiiiiiiiiiiiiiiiip9og8Fpxiiiiiiiiiiiiiiiip8Jg8Ep5b9cjF;8;4;W;G;ab9:9cU1:Ngicitc:q1jjbfpbibaic:q:yjjbfRbbgipsa8Ep5e9cjF;8;4;W;G;ab9:9cU1:Ngqcitc:q1jjbfpbibp9UpmbedilvorzHOACXQLpPa8Fa8Ep9spklbaiaoclffaqc:q:yjjbfRbbfhoxikaic8Wfaopbbwaopbbbg8Eclp:mea8EpmbzeHdOiAlCvXoQrLpxssssssssssssssssp9og8Fpxssssssssssssssssp8Jg8Ep5b9cjF;8;4;W;G;ab9:9cU1:Ngicitc:q1jjbfpbibaic:q:yjjbfRbbgipsa8Ep5e9cjF;8;4;W;G;ab9:9cU1:Ngqcitc:q1jjbfpbibp9UpmbedilvorzHOACXQLpPa8Fa8Ep9spklbaiaocwffaqc:q:yjjbfRbbfhoxdkaic8Wfaopbbbpklbaoczfhoxekaic8WfaopbbdaoRbbgicitc:q1jjbfpbibaic:q:yjjbfRbbgipsaoRbegqcitc:q1jjbfpbibp9UpmbedilvorzHOACXQLpPpklbaiaocdffaqc:q:yjjbfRbbfhokalc;abfhialcjefaX0meaihlamao9Rc;Fb0mbkkdnaiaX9pmbaici4hlinamao9RcK6mwa5aifhqdndndndndndnaOaico4fRbbalcoG4ciGarfPDbedibledibkaqpxbbbbbbbbbbbbbbbbpkbbxlkaqaopbblaopbbbg8Eclp:mea8EpmbzeHdOiAlCvXoQrLg8Ecdp:mea8EpmbzeHdOiAlCvXoQrLpxiiiiiiiiiiiiiiiip9og8Fpxiiiiiiiiiiiiiiiip8Jg8Ep5b9cjF;8;4;W;G;ab9:9cU1:Ngacitc:q1jjbfpbibaac:q:yjjbfRbbgapsa8Ep5e9cjF;8;4;W;G;ab9:9cU1:Nghcitc:q1jjbfpbibp9UpmbedilvorzHOACXQLpPa8Fa8Ep9spkbbaaaoclffahc:q:yjjbfRbbfhoxikaqaopbbwaopbbbg8Eclp:mea8EpmbzeHdOiAlCvXoQrLpxssssssssssssssssp9og8Fpxssssssssssssssssp8Jg8Ep5b9cjF;8;4;W;G;ab9:9cU1:Ngacitc:q1jjbfpbibaac:q:yjjbfRbbgapsa8Ep5e9cjF;8;4;W;G;ab9:9cU1:Nghcitc:q1jjbfpbibp9UpmbedilvorzHOACXQLpPa8Fa8Ep9spkbbaaaocwffahc:q:yjjbfRbbfhoxdkaqaopbbbpkbbaoczfhoxekaqaopbbdaoRbbgacitc:q1jjbfpbibaac:q:yjjbfRbbgapsaoRbeghcitc:q1jjbfpbibp9UpmbedilvorzHOACXQLpPpkbbaaaocdffahc:q:yjjbfRbbfhokalcdfhlaiczfgiaX6mbkkaohOaoTmoka5aXfh5a3cefg3cl9hmbkdndndndnawTmbasaYcd4fRbbglciGPlbedwbkaXTmdavcjdfaYfhlavaYfpbdbhgcbhoinalavcj;cbfaofpblbg8JaKaofpblbg8KpmbzeHdOiAlCvXoQrLg8LaQaofpblbg8MaLaofpblbg8NpmbzeHdOiAlCvXoQrLgypmbezHdiOAlvCXorQLg8Ecep9Ta8Epxeeeeeeeeeeeeeeeeg8Fp9op9Hp9rg8Eagp9Uggp9Abbbaladfglaga8Ea8Epmlvorlvorlvorlvorp9Uggp9Abbbaladfglaga8Ea8EpmwDqkwDqkwDqkwDqkp9Uggp9Abbbaladfglaga8Ea8EpmxmPsxmPsxmPsxmPsp9Uggp9Abbbaladfglaga8LaypmwDKYqk8AExm35Ps8E8Fg8Ecep9Ta8Ea8Fp9op9Hp9rg8Ep9Uggp9Abbbaladfglaga8Ea8Epmlvorlvorlvorlvorp9Uggp9Abbbaladfglaga8Ea8EpmwDqkwDqkwDqkwDqkp9Uggp9Abbbaladfglaga8Ea8EpmxmPsxmPsxmPsxmPsp9Uggp9Abbbaladfglaga8Ja8KpmwKDYq8AkEx3m5P8Es8Fg8Ja8Ma8NpmwKDYq8AkEx3m5P8Es8Fg8KpmbezHdiOAlvCXorQLg8Ecep9Ta8Ea8Fp9op9Hp9rg8Ep9Uggp9Abbbaladfglaga8Ea8Epmlvorlvorlvorlvorp9Uggp9Abbbaladfglaga8Ea8EpmwDqkwDqkwDqkwDqkp9Uggp9Abbbaladfglaga8Ea8EpmxmPsxmPsxmPsxmPsp9Uggp9Abbbaladfglaga8Ja8KpmwDKYqk8AExm35Ps8E8Fg8Ecep9Ta8Ea8Fp9op9Hp9rg8Ep9Ug8Fp9Abbbaladfgla8Fa8Ea8Epmlvorlvorlvorlvorp9Ug8Fp9Abbbaladfgla8Fa8Ea8EpmwDqkwDqkwDqkwDqkp9Ug8Fp9Abbbaladfgla8Fa8Ea8EpmxmPsxmPsxmPsxmPsp9Uggp9AbbbaladfhlaoczfgoaX6mbxikkaXTmeavcjdfaYfhlavaYfpbdbhgcbhoinalavcj;cbfaofpblbg8JaKaofpblbg8KpmbzeHdOiAlCvXoQrLg8LaQaofpblbg8MaLaofpblbg8NpmbzeHdOiAlCvXoQrLgypmbezHdiOAlvCXorQLg8Ecep:nea8Epxebebebebebebebebg8Fp9op:bep9rg8Eagp:oeggp9Abbbaladfglaga8Ea8Epmlvorlvorlvorlvorp:oeggp9Abbbaladfglaga8Ea8EpmwDqkwDqkwDqkwDqkp:oeggp9Abbbaladfglaga8Ea8EpmxmPsxmPsxmPsxmPsp:oeggp9Abbbaladfglaga8LaypmwDKYqk8AExm35Ps8E8Fg8Ecep:nea8Ea8Fp9op:bep9rg8Ep:oeggp9Abbbaladfglaga8Ea8Epmlvorlvorlvorlvorp:oeggp9Abbbaladfglaga8Ea8EpmwDqkwDqkwDqkwDqkp:oeggp9Abbbaladfglaga8Ea8EpmxmPsxmPsxmPsxmPsp:oeggp9Abbbaladfglaga8Ja8KpmwKDYq8AkEx3m5P8Es8Fg8Ja8Ma8NpmwKDYq8AkEx3m5P8Es8Fg8KpmbezHdiOAlvCXorQLg8Ecep:nea8Ea8Fp9op:bep9rg8Ep:oeggp9Abbbaladfglaga8Ea8Epmlvorlvorlvorlvorp:oeggp9Abbbaladfglaga8Ea8EpmwDqkwDqkwDqkwDqkp:oeggp9Abbbaladfglaga8Ea8EpmxmPsxmPsxmPsxmPsp:oeggp9Abbbaladfglaga8Ja8KpmwDKYqk8AExm35Ps8E8Fg8Ecep:nea8Ea8Fp9op:bep9rg8Ep:oeg8Fp9Abbbaladfgla8Fa8Ea8Epmlvorlvorlvorlvorp:oeg8Fp9Abbbaladfgla8Fa8Ea8EpmwDqkwDqkwDqkwDqkp:oeg8Fp9Abbbaladfgla8Fa8Ea8EpmxmPsxmPsxmPsxmPsp:oeggp9AbbbaladfhlaoczfgoaX6mbxdkkaXTmbcbhocbalcl4gl9Rc8FGhiavcjdfaYfhravaYfpbdbh8Finaravcj;cbfaofpblbggaKaofpblbg8JpmbzeHdOiAlCvXoQrLg8KaQaofpblbg8LaLaofpblbg8MpmbzeHdOiAlCvXoQrLg8NpmbezHdiOAlvCXorQLg8Eaip:Rea8Ealp:Sep9qg8Ea8Fp9rg8Fp9Abbbaradfgra8Fa8Ea8Epmlvorlvorlvorlvorp9rg8Fp9Abbbaradfgra8Fa8Ea8EpmwDqkwDqkwDqkwDqkp9rg8Fp9Abbbaradfgra8Fa8Ea8EpmxmPsxmPsxmPsxmPsp9rg8Fp9Abbbaradfgra8Fa8Ka8NpmwDKYqk8AExm35Ps8E8Fg8Eaip:Rea8Ealp:Sep9qg8Ep9rg8Fp9Abbbaradfgra8Fa8Ea8Epmlvorlvorlvorlvorp9rg8Fp9Abbbaradfgra8Fa8Ea8EpmwDqkwDqkwDqkwDqkp9rg8Fp9Abbbaradfgra8Fa8Ea8EpmxmPsxmPsxmPsxmPsp9rg8Fp9Abbbaradfgra8Faga8JpmwKDYq8AkEx3m5P8Es8Fgga8La8MpmwKDYq8AkEx3m5P8Es8Fg8JpmbezHdiOAlvCXorQLg8Eaip:Rea8Ealp:Sep9qg8Ep9rg8Fp9Abbbaradfgra8Fa8Ea8Epmlvorlvorlvorlvorp9rg8Fp9Abbbaradfgra8Fa8Ea8EpmwDqkwDqkwDqkwDqkp9rg8Fp9Abbbaradfgra8Fa8Ea8EpmxmPsxmPsxmPsxmPsp9rg8Fp9Abbbaradfgra8Faga8JpmwDKYqk8AExm35Ps8E8Fg8Eaip:Rea8Ealp:Sep9qg8Ep9rg8Fp9Abbbaradfgra8Fa8Ea8Epmlvorlvorlvorlvorp9rg8Fp9Abbbaradfgra8Fa8Ea8EpmwDqkwDqkwDqkwDqkp9rg8Fp9Abbbaradfgra8Fa8Ea8EpmxmPsxmPsxmPsxmPsp9rg8Fp9AbbbaradfhraoczfgoaX6mbkkaYclfgYad6mbkaHavcjdfaAad2;8qbbavavcjdfaAcufad2fad;8qbbaAazfhzc9:hoaOhxaOmbxlkkaeTmbaDalfhrcbhocuhlinaralaD9RglfaD6mdaPaeao9RaoaPfae6Eaofgoae6mbkaial9Rhxkcbc99amax9RakSEhoxekc9:hokavcj;kbf8Kjjjjbaokwbz:bjjjbk:TseHu8Jjjjjbc;ae9Rgv8Kjjjjbc9:hodnaeci9UgrcHfal0mbcuhoaiRbbgwc;WeGc;Ge9hmbawcsGgDce0mbavc;abfcFecje;8kbavcUf9cu83ibavc8Wf9cu83ibavcyf9cu83ibavcaf9cu83ibavcKf9cu83ibavczf9cu83ibav9cu83iwav9cu83ibaialfc9WfhqaicefgwarfhldnaeTmbcmcsaDceSEhkcbhxcbhmcbhrcbhicbhoindnalaq9nmbc9:hoxikdndnawRbbgDc;Ve0mbavc;abfaoaDcu7gPcl4fcsGcitfgsydlhzasydbhHdndnaDcsGgsak9pmbavaiaPfcsGcdtfydbaxasEhDaxasTgOfhxxekdndnascsSmbcehOasc987asamffcefhDxekalcefhDal8SbbgscFeGhPdndnascu9mmbaDhlxekalcvfhlaPcFbGhPcrhsdninaD8SbbgOcFbGastaPVhPaOcu9kmeaDcefhDascrfgsc8J9hmbxdkkaDcefhlkcehOaPce4cbaPceG9R7amfhDkaDhmkavc;abfaocitfgsaDBdbasazBdlavaicdtfaDBdbavc;abfaocefcsGcitfgsaHBdbasaDBdlaocdfhoaOaifhidnadcd9hmbabarcetfgsaH87ebasclfaD87ebascdfaz87ebxdkabarcdtfgsaHBdbascwfaDBdbasclfazBdbxekdnaDcpe0mbaxcefgOavaiaqaDcsGfRbbgscl49RcsGcdtfydbascz6gPEhDavaias9RcsGcdtfydbaOaPfgzascsGgOEhsaOThOdndnadcd9hmbabarcetfgHax87ebaHclfas87ebaHcdfaD87ebxekabarcdtfgHaxBdbaHcwfasBdbaHclfaDBdbkavaicdtfaxBdbavc;abfaocitfgHaDBdbaHaxBdlavaicefgicsGcdtfaDBdbavc;abfaocefcsGcitfgHasBdbaHaDBdlavaiaPfgicsGcdtfasBdbavc;abfaocdfcsGcitfgDaxBdbaDasBdlaocifhoaiaOfhiazaOfhxxekaxcbalRbbgHEgAaDc;:eSgDfhzaHcsGhCaHcl4hXdndnaHcs0mbazcefhOxekazhOavaiaX9RcsGcdtfydbhzkdndnaCmbaOcefhxxekaOhxavaiaH9RcsGcdtfydbhOkdndnaDTmbalcefhDxekalcdfhDal8SbegPcFeGhsdnaPcu9kmbalcofhAascFbGhscrhldninaD8SbbgPcFbGaltasVhsaPcu9kmeaDcefhDalcrfglc8J9hmbkaAhDxekaDcefhDkasce4cbasceG9R7amfgmhAkdndnaXcsSmbaDhsxekaDcefhsaD8SbbglcFeGhPdnalcu9kmbaDcvfhzaPcFbGhPcrhldninas8SbbgDcFbGaltaPVhPaDcu9kmeascefhsalcrfglc8J9hmbkazhsxekascefhskaPce4cbaPceG9R7amfgmhzkdndnaCcsSmbashlxekascefhlas8SbbgDcFeGhPdnaDcu9kmbascvfhOaPcFbGhPcrhDdninal8SbbgscFbGaDtaPVhPascu9kmealcefhlaDcrfgDc8J9hmbkaOhlxekalcefhlkaPce4cbaPceG9R7amfgmhOkdndnadcd9hmbabarcetfgDaA87ebaDclfaO87ebaDcdfaz87ebxekabarcdtfgDaABdbaDcwfaOBdbaDclfazBdbkavc;abfaocitfgDazBdbaDaABdlavaicdtfaABdbavc;abfaocefcsGcitfgDaOBdbaDazBdlavaicefgicsGcdtfazBdbavc;abfaocdfcsGcitfgDaABdbaDaOBdlavaiaHcz6aXcsSVfgicsGcdtfaOBdbaiaCTaCcsSVfhiaocifhokawcefhwaocsGhoaicsGhiarcifgrae6mbkkcbc99alaqSEhokavc;aef8Kjjjjbaok:clevu8Jjjjjbcz9Rhvdnaecvfal9nmbc9:skdnaiRbbc;:eGc;qeSmbcuskav9cb83iwaicefhoaialfc98fhrdnaeTmbdnadcdSmbcbhwindnaoar6mbc9:skaocefhlao8SbbgicFeGhddndnaicu9mmbalhoxekaocvfhoadcFbGhdcrhidninal8SbbgDcFbGaitadVhdaDcu9kmealcefhlaicrfgic8J9hmbxdkkalcefhokabawcdtfadc8Etc8F91adcd47avcwfadceGcdtVglydbfgiBdbalaiBdbawcefgwae9hmbxdkkcbhwindnaoar6mbc9:skaocefhlao8SbbgicFeGhddndnaicu9mmbalhoxekaocvfhoadcFbGhdcrhidninal8SbbgDcFbGaitadVhdaDcu9kmealcefhlaicrfgic8J9hmbxdkkalcefhokabawcetfadc8Etc8F91adcd47avcwfadceGcdtVglydbfgi87ebalaiBdbawcefgwae9hmbkkcbc99aoarSEk:SPliuo97eue978Jjjjjbca9Rhiaec98Ghldndnadcl9hmbdnalTmbcbhvabhdinadadpbbbgocKp:RecKp:Sep;6egraocwp:RecKp:Sep;6earp;Geaoczp:RecKp:Sep;6egwp;Gep;Kep;LegDpxbbbbbbbbbbbbbbbbp:2egqarpxbbbjbbbjbbbjbbbjgkp9op9rp;Kegrpxbb;:9cbb;:9cbb;:9cbb;:9cararp;MeaDaDp;Meawaqawakp9op9rp;Kegrarp;Mep;Kep;Kep;Jep;Negwp;Mepxbbn0bbn0bbn0bbn0gqp;KepxFbbbFbbbFbbbFbbbp9oaopxbbbFbbbFbbbFbbbFp9op9qarawp;Meaqp;Kecwp:RepxbFbbbFbbbFbbbFbbp9op9qaDawp;Meaqp;Keczp:RepxbbFbbbFbbbFbbbFbp9op9qpkbbadczfhdavclfgval6mbkkalaeSmeaipxbbbbbbbbbbbbbbbbgqpklbaiabalcdtfgdaeciGglcdtgv;8qbbdnalTmbaiaipblbgocKp:RecKp:Sep;6egraocwp:RecKp:Sep;6earp;Geaoczp:RecKp:Sep;6egwp;Gep;Kep;LegDaqp:2egqarpxbbbjbbbjbbbjbbbjgkp9op9rp;Kegrpxbb;:9cbb;:9cbb;:9cbb;:9cararp;MeaDaDp;Meawaqawakp9op9rp;Kegrarp;Mep;Kep;Kep;Jep;Negwp;Mepxbbn0bbn0bbn0bbn0gqp;KepxFbbbFbbbFbbbFbbbp9oaopxbbbFbbbFbbbFbbbFp9op9qarawp;Meaqp;Kecwp:RepxbFbbbFbbbFbbbFbbp9op9qaDawp;Meaqp;Keczp:RepxbbFbbbFbbbFbbbFbp9op9qpklbkadaiav;8qbbskdnalTmbcbhvabhdinadczfgxaxpbbbgopxbbbbbbFFbbbbbbFFgkp9oadpbbbgDaopmbediwDqkzHOAKY8AEgwczp:Reczp:Sep;6egraDaopmlvorxmPsCXQL358E8FpxFubbFubbFubbFubbp9op;7eawczp:Sep;6egwp;Gearp;Gep;Kep;Legopxbbbbbbbbbbbbbbbbp:2egqarpxbbbjbbbjbbbjbbbjgmp9op9rp;Kegrpxb;:FSb;:FSb;:FSb;:FSararp;Meaoaop;Meawaqawamp9op9rp;Kegrarp;Mep;Kep;Kep;Jep;Negwp;Mepxbbn0bbn0bbn0bbn0gqp;KepxFFbbFFbbFFbbFFbbp9oaoawp;Meaqp;Keczp:Rep9qgoarawp;Meaqp;KepxFFbbFFbbFFbbFFbbp9ogrpmwDKYqk8AExm35Ps8E8Fp9qpkbbadaDakp9oaoarpmbezHdiOAlvCXorQLp9qpkbbadcafhdavclfgval6mbkkalaeSmbaiczfpxbbbbbbbbbbbbbbbbgopklbaiaopklbaiabalcitfgdaeciGglcitgv;8qbbdnalTmbaiaipblzgopxbbbbbbFFbbbbbbFFgkp9oaipblbgDaopmbediwDqkzHOAKY8AEgwczp:Reczp:Sep;6egraDaopmlvorxmPsCXQL358E8FpxFubbFubbFubbFubbp9op;7eawczp:Sep;6egwp;Gearp;Gep;Kep;Legopxbbbbbbbbbbbbbbbbp:2egqarpxbbbjbbbjbbbjbbbjgmp9op9rp;Kegrpxb;:FSb;:FSb;:FSb;:FSararp;Meaoaop;Meawaqawamp9op9rp;Kegrarp;Mep;Kep;Kep;Jep;Negwp;Mepxbbn0bbn0bbn0bbn0gqp;KepxFFbbFFbbFFbbFFbbp9oaoawp;Meaqp;Keczp:Rep9qgoarawp;Meaqp;KepxFFbbFFbbFFbbFFbbp9ogrpmwDKYqk8AExm35Ps8E8Fp9qpklzaiaDakp9oaoarpmbezHdiOAlvCXorQLp9qpklbkadaiav;8qbbkk:oDllue97euv978Jjjjjbc8W9Rhidnaec98GglTmbcbhvabhoinaiaopbbbgraoczfgwpbbbgDpmlvorxmPsCXQL358E8Fgqczp:Segkclp:RepklbaopxbbjZbbjZbbjZbbjZpx;Zl81Z;Zl81Z;Zl81Z;Zl81Zakpxibbbibbbibbbibbbp9qp;6ep;NegkaraDpmbediwDqkzHOAKY8AEgrczp:Reczp:Sep;6ep;MegDaDp;Meakarczp:Sep;6ep;Megxaxp;Meakaqczp:Reczp:Sep;6ep;Megqaqp;Mep;Kep;Kep;Lepxbbbbbbbbbbbbbbbbp:4ep;Jepxb;:FSb;:FSb;:FSb;:FSgkp;Mepxbbn0bbn0bbn0bbn0grp;KepxFFbbFFbbFFbbFFbbgmp9oaxakp;Mearp;Keczp:Rep9qgxaDakp;Mearp;Keamp9oaqakp;Mearp;Keczp:Rep9qgkpmbezHdiOAlvCXorQLgrp5baipblbpEb:T:j83ibaocwfarp5eaipblbpEe:T:j83ibawaxakpmwDKYqk8AExm35Ps8E8Fgkp5baipblbpEd:T:j83ibaocKfakp5eaipblbpEi:T:j83ibaocafhoavclfgval6mbkkdnalaeSmbaiczfpxbbbbbbbbbbbbbbbbgkpklbaiakpklbaiabalcitfgoaeciGgvcitgw;8qbbdnavTmbaiaipblbgraipblzgDpmlvorxmPsCXQL358E8Fgqczp:Segkclp:RepklaaipxbbjZbbjZbbjZbbjZpx;Zl81Z;Zl81Z;Zl81Z;Zl81Zakpxibbbibbbibbbibbbp9qp;6ep;NegkaraDpmbediwDqkzHOAKY8AEgrczp:Reczp:Sep;6ep;MegDaDp;Meakarczp:Sep;6ep;Megxaxp;Meakaqczp:Reczp:Sep;6ep;Megqaqp;Mep;Kep;Kep;Lepxbbbbbbbbbbbbbbbbp:4ep;Jepxb;:FSb;:FSb;:FSb;:FSgkp;Mepxbbn0bbn0bbn0bbn0grp;KepxFFbbFFbbFFbbFFbbgmp9oaxakp;Mearp;Keczp:Rep9qgxaDakp;Mearp;Keamp9oaqakp;Mearp;Keczp:Rep9qgkpmbezHdiOAlvCXorQLgrp5baipblapEb:T:j83ibaiarp5eaipblapEe:T:j83iwaiaxakpmwDKYqk8AExm35Ps8E8Fgkp5baipblapEd:T:j83izaiakp5eaipblapEi:T:j83iKkaoaiaw;8qbbkk;uddiue978Jjjjjbc;ab9Rhidnadcd4ae2glc98GgvTmbcbheabhdinadadpbbbgocwp:Recwp:Sep;6eaocep:SepxbbjFbbjFbbjFbbjFp9opxbbjZbbjZbbjZbbjZp:Uep;Mepkbbadczfhdaeclfgeav6mbkkdnavalSmbaic8WfpxbbbbbbbbbbbbbbbbgopklbaicafaopklbaiczfaopklbaiaopklbaiabavcdtfgdalciGgecdtgv;8qbbdnaeTmbaiaipblbgocwp:Recwp:Sep;6eaocep:SepxbbjFbbjFbbjFbbjFp9opxbbjZbbjZbbjZbbjZp:Uep;Mepklbkadaiav;8qbbkk9teiucbcbydj1jjbgeabcifc98GfgbBdj1jjbdndnabZbcztgd9nmbcuhiabad9RcFFifcz4nbcuSmekaehikaikkkebcjwklz:Dbb",a=new Uint8Array([0,97,115,109,1,0,0,0,1,4,1,96,0,0,3,3,2,0,0,5,3,1,0,1,12,1,0,10,22,2,12,0,65,0,65,0,65,0,252,10,0,0,11,7,0,65,0,253,15,26,11]),s=new Uint8Array([32,0,65,2,1,106,34,33,3,128,11,4,13,64,6,253,10,7,15,116,127,5,8,12,40,16,19,54,20,9,27,255,113,17,42,67,24,23,146,148,18,14,22,45,70,69,56,114,101,21,25,63,75,136,108,28,118,29,73,115]);if(typeof WebAssembly!="object")return{supported:!1};var n=WebAssembly.validate(a)?o(t):o(e),r,i=WebAssembly.instantiate(n,{}).then(function(l){r=l.instance,r.exports.__wasm_call_ctors()});function o(l){for(var u=new Uint8Array(l.length),p=0;p<l.length;++p){var v=l.charCodeAt(p);u[p]=v>96?v-97:v>64?v-39:v+4}for(var T=0,p=0;p<l.length;++p)u[T++]=u[p]<60?s[u[p]]:(u[p]-60)*64+u[++p];return u.buffer.slice(0,T)}function c(l,u,p,v,T,I,k){var A=l.exports.sbrk,_=v+3&-4,N=A(_*T),F=A(I.length),j=new Uint8Array(l.exports.memory.buffer);j.set(I,F);var B=u(N,v,T,F,I.length);if(B==0&&k&&k(N,_,T),p.set(j.subarray(N,N+v*T)),A(N-A(0)),B!=0)throw new Error("Malformed buffer data: "+B)}var b={NONE:"",OCTAHEDRAL:"meshopt_decodeFilterOct",QUATERNION:"meshopt_decodeFilterQuat",EXPONENTIAL:"meshopt_decodeFilterExp"},g={ATTRIBUTES:"meshopt_decodeVertexBuffer",TRIANGLES:"meshopt_decodeIndexBuffer",INDICES:"meshopt_decodeIndexSequence"},h=[],w=0;function y(l){var u={object:new Worker(l),pending:0,requests:{}};return u.object.onmessage=function(p){var v=p.data;u.pending-=v.count,u.requests[v.id][v.action](v.value),delete u.requests[v.id]},u}function f(l){for(var u="self.ready = WebAssembly.instantiate(new Uint8Array(["+new Uint8Array(n)+"]), {}).then(function(result) { result.instance.exports.__wasm_call_ctors(); return result.instance; });self.onmessage = "+m.name+";"+c.toString()+m.toString(),p=new Blob([u],{type:"text/javascript"}),v=URL.createObjectURL(p),T=h.length;T<l;++T)h[T]=y(v);for(var T=l;T<h.length;++T)h[T].object.postMessage({});h.length=l,URL.revokeObjectURL(v)}function d(l,u,p,v,T){for(var I=h[0],k=1;k<h.length;++k)h[k].pending<I.pending&&(I=h[k]);return new Promise(function(A,_){var N=new Uint8Array(p),F=++w;I.pending+=l,I.requests[F]={resolve:A,reject:_},I.object.postMessage({id:F,count:l,size:u,source:N,mode:v,filter:T},[N.buffer])})}function m(l){var u=l.data;if(!u.id)return self.close();self.ready.then(function(p){try{var v=new Uint8Array(u.count*u.size);c(p,p.exports[u.mode],v,u.count,u.size,u.source,p.exports[u.filter]),self.postMessage({id:u.id,count:u.count,action:"resolve",value:v},[v.buffer])}catch(T){self.postMessage({id:u.id,count:u.count,action:"reject",value:T})}})}return{ready:i,supported:!0,useWorkers:function(l){f(l)},decodeVertexBuffer:function(l,u,p,v,T){c(r,r.exports.meshopt_decodeVertexBuffer,l,u,p,v,r.exports[b[T]])},decodeIndexBuffer:function(l,u,p,v){c(r,r.exports.meshopt_decodeIndexBuffer,l,u,p,v)},decodeIndexSequence:function(l,u,p,v){c(r,r.exports.meshopt_decodeIndexSequence,l,u,p,v)},decodeGltfBuffer:function(l,u,p,v,T,I){c(r,r.exports[g[T]],l,u,p,v,r.exports[b[I]])},decodeGltfBufferAsync:function(l,u,p,v,T){return h.length>0?d(l,u,p,g[v],b[T]):i.then(function(){var I=new Uint8Array(l*u);return c(r,r.exports[g[v]],I,l,u,p,r.exports[b[T]]),I})}}})();var hh=(function(){var e="b9H79Tebbbetm9Geueu9Geub9Gbb9Gsuuuuuuuuuuuu99uueu9Gvuuuuub9Gruuuuuuub9Gvuuuuue999Gvuuuuueu9Gquuuuuuu99uueu9Gwuuuuuu99ueu9Giuuue999Gluuuueu9GiuuueuiOHdilvorlwiDqkbxxbelve9Weiiviebeoweuec:G:Pdkr:Tewo9TW9T9VV95dbH9F9F939H79T9F9J9H229F9Jt9VV7bbz9TW79O9V9Wt9F79P9T9W29P9M95br8E9TW79O9V9Wt9F79P9T9W29P9M959x9Pt9OcttV9P9I91tW7bwQ9TW79O9V9Wt9F79P9T9W29P9M959q9V9P9Ut7bDX9TW79O9V9Wt9F79P9T9W29P9M959t9J9H2Wbqa9TW79O9V9Wt9F9V9Wt9P9T9P96W9wWVtW94SWt9J9O9sW9T9H9Wbkl79IV9RbxDwebcekdzsq;B:xeHdbkM9Hi8Au8A99Au8Jjjjjbc;W;qb9Rgs8Kjjjjbcbhzascxfcbc;Kbz:ojjjb8AdnabaeSmbabaeadcdtz:njjjb8AkdndnamcdGmbascxfhHcbhOxekasalcrfci4gecbyd:m:jjjbHjjjjbbgABdxasceBd2aAcbaez:ojjjbhCcbhlcbhednadTmbcbhlabheadhAinaCaeydbgXci4fgQaQRbbgQceaXcrGgXtV86bbaQcu7aX4ceGalfhlaeclfheaAcufgAmbkcualcdtalcFFFFi0EhekascCfhHasaecbyd:m:jjjbHjjjjbbgOBdzascdBd2alcd4alfhXcehAinaAgecethAaeaX6mbkcdhzcbhLascuaecdtgAaecFFFFi0Ecbyd:m:jjjbHjjjjbbgXBdCasciBd2aXcFeaAz:ojjjbhKdnadTmbaecufhYcbh8AindndnaKabaLcdtfgEydbgQc:v;t;h;Ev2aYGgXcdtfgCydbgAcuSmbceheinaOaAcdtfydbaQSmdaXaefhAaecefheaKaAaYGgXcdtfgCydbgAcu9hmbkkaOa8AcdtfaQBdbaCa8ABdba8AhAa8Acefh8AkaEaABdbaLcefgLad9hmbkkaKcbyd1:jjjbH:bjjjbbascdBd2kcbh3aHcualcefgecdtaecFFFFi0Ecbyd:m:jjjbHjjjjbbg5Bdbasa5BdlasazceVgeBd2ascxfaecdtfcuadcitadcFFFFe0Ecbyd:m:jjjbHjjjjbbg8EBdbasa8EBdwasazcdfgeBd2asclfabadalcbz:cjjjbascxfaecdtfcualcdtgealcFFFFi0Eg8Fcbyd:m:jjjbHjjjjbbgABdbasazcifgXBd2ascxfaXcdtfa8Fcbyd:m:jjjbHjjjjbbgaBdbasazclVBd2aAaaaialavaOascxfz:djjjbalcbyd:m:jjjbHjjjjbbhCascxfasyd2ghcdtfaCBdbasahcefgXBd2ascxfaXcdtfa8Fcbyd:m:jjjbHjjjjbbgXBdbasahcdfgQBd2ascxfaQcdtfa8Fcbyd:m:jjjbHjjjjbbgQBdbasahcifggBd2aXcFeaez:ojjjbh8JaQcFeaez:ojjjbh8KdnalTmba8Ecwfh8Lindna5a3gQcefg3cdtfydbgKa5aQcdtgefydbgXSmbaKaX9Rhza8EaXcitfhHa8Kaefh8Ma8JaefhEcbhYindndnaHaYcitfydbg8AaQ9hmbaEaQBdba8MaQBdbxekdna5a8Acdtg8NfgeclfydbgXaeydbgeSmba8EaecitgKfydbaQSmeaXae9Rhyaecu7aXfhLa8LaKfhXcbheinaLaeSmeaecefheaXydbhKaXcwfhXaKaQ9hmbkaeay6meka8Ka8NfgeaQa8AaeydbcuSEBdbaEa8AaQaEydbcuSEBdbkaYcefgYaz9hmbkka3al9hmbkaAhXaahQa8KhKa8JhYcbheindndnaeaXydbg8A9hmbdnaeaQydbg8A9hmbaYydbh8AdnaKydbgLcu9hmba8Acu9hmbaCaefcb86bbxikaCaefhEdnaeaLSmbaea8ASmbaEce86bbxikaEcl86bbxdkdnaeaaa8AcdtgLfydb9hmbdnaKydbgEcuSmbaeaESmbaYydbgzcuSmbaeazSmba8KaLfydbgHcuSmbaHa8ASmba8JaLfydbgLcuSmbaLa8ASmbdnaAaEcdtfydbg8AaAaLcdtfydb9hmba8AaAazcdtfydbgLSmbaLaAaHcdtfydb9hmbaCaefcd86bbxlkaCaefcl86bbxikaCaefcl86bbxdkaCaefcl86bbxekaCaefaCa8AfRbb86bbkaXclfhXaQclfhQaKclfhKaYclfhYalaecefge9hmbkdnaqTmbdndnaOTmbaOheaAhXalhQindnaqaeydbfRbbTmbaCaXydbfcl86bbkaeclfheaXclfhXaQcufgQmbxdkkaAhealhXindnaqRbbTmbaCaeydbfcl86bbkaqcefhqaeclfheaXcufgXmbkkaAhealhQaChXindnaCaeydbfRbbcl9hmbaXcl86bbkaeclfheaXcefhXaQcufgQmbkkamceGTmbaChealhXindnaeRbbce9hmbaecl86bbkaecefheaXcufgXmbkkascxfagcdtfcualcx2alc;v:Q;v:Qe0Ecbyd:m:jjjbHjjjjbbg3BdbasahclfgHBd2a3aialavaOz:ejjjbh8PdndnaDmbcbhgcbh8Lxekcbh8LawhecbhXindnaeIdbJbbbb9ETmbasc;Wbfa8LcdtfaXBdba8Lcefh8LkaeclfheaDaXcefgX9hmbkascxfaHcdtfcua8Lal2gecdtaecFFFFi0Ecbyd:m:jjjbHjjjjbbggBdbasahcvfgHBd2alTmba8LTmbarcd4hEdnaOTmba8Lcdthzcbh8AaghLinaoaOa8AcdtfydbaE2cdtfhYasc;WbfheaLhXa8LhQinaXaYaeydbcdtgKfIdbawaKfIdbNUdbaeclfheaXclfhXaQcufgQmbkaLazfhLa8Acefg8Aal9hmbxdkka8Lcdthzcbh8AaghLinaoa8AaE2cdtfhYasc;WbfheaLhXa8LhQinaXaYaeydbcdtgKfIdbawaKfIdbNUdbaeclfheaXclfhXaQcufgQmbkaLazfhLa8Acefg8Aal9hmbkkascxfaHcdtfcualc8S2gealc;D;O;f8U0EgQcbyd:m:jjjbHjjjjbbgXBdbasaHcefgKBd2aXcbaez:ojjjbhqdndndna8LTmbascxfaKcdtfaQcbyd:m:jjjbHjjjjbbgvBdbasaHcdfgXBd2avcbaez:ojjjb8AascxfaXcdtfcua8Lal2gecltgXaecFFFFb0Ecbyd:m:jjjbHjjjjbbgiBdbasaHcifBd2aicbaXz:ojjjb8AadmexdkcbhvcbhiadTmekcbhYabhXindna3aXclfydbg8Acx2fgeIdba3aXydbgLcx2fgQIdbgI:tg8Ra3aXcwfydbgEcx2fgKIdlaQIdlg8S:tgRNaKIdbaI:tg8UaeIdla8S:tg8VN:tg8Wa8WNa8VaKIdwaQIdwg8X:tg8YNaRaeIdwa8X:tg8VN:tgRaRNa8Va8UNa8Ya8RN:tg8Ra8RNMM:rg8UJbbbb9ETmba8Wa8U:vh8Wa8Ra8U:vh8RaRa8U:vhRkaqaAaLcdtfydbc8S2fgeaRa8U:rg8UaRNNg8VaeIdbMUdbaea8Ra8Ua8RNg8ZNg8YaeIdlMUdlaea8Wa8Ua8WNg80Ng81aeIdwMUdwaea8ZaRNg8ZaeIdxMUdxaea80aRNgBaeIdzMUdzaea80a8RNg80aeIdCMUdCaeaRa8Ua8Wa8XNaRaINa8Sa8RNMM:mg8SNgINgRaeIdKMUdKaea8RaINg8RaeId3MUd3aea8WaINg8WaeIdaMUdaaeaIa8SNgIaeId8KMUd8Kaea8UaeIdyMUdyaqaAa8Acdtfydbc8S2fgea8VaeIdbMUdbaea8YaeIdlMUdlaea81aeIdwMUdwaea8ZaeIdxMUdxaeaBaeIdzMUdzaea80aeIdCMUdCaeaRaeIdKMUdKaea8RaeId3MUd3aea8WaeIdaMUdaaeaIaeId8KMUd8Kaea8UaeIdyMUdyaqaAaEcdtfydbc8S2fgea8VaeIdbMUdbaea8YaeIdlMUdlaea81aeIdwMUdwaea8ZaeIdxMUdxaeaBaeIdzMUdzaea80aeIdCMUdCaeaRaeIdKMUdKaea8RaeId3MUd3aea8WaeIdaMUdaaeaIaeId8KMUd8Kaea8UaeIdyMUdyaXcxfhXaYcifgYad6mbkcbhzabhLinabazcdtfh8AcbhXinaCa8AaXc;a1jjbfydbcdtfydbgQfRbbhedndnaCaLaXfydbgKfRbbgYc99fcFeGcpe0mbaec99fcFeGc;:e6mekdnaYcufcFeGce0mba8JaKcdtfydbaQ9hmekdnaecufcFeGce0mba8KaQcdtfydbaK9hmekdnaYcv2aefc:G1jjbfRbbTmbaAaQcdtfydbaAaKcdtfydb0mekJbbacJbbacJbbjZaecFeGceSEaYceSEh80dna3a8AaXc;e1jjbfydbcdtfydbcx2fgeIdwa3aKcx2fgYIdwg8S:tg8Wa3aQcx2fgEIdwa8S:tgRaRNaEIdbaYIdbg8X:tg8Ra8RNaEIdlaYIdlg8V:tg8Ua8UNMMgINa8WaRNaeIdba8X:tg81a8RNa8UaeIdla8V:tg8ZNMMg8YaRN:tg8Wa8WNa81aINa8Ya8RN:tgRaRNa8ZaINa8Ya8UN:tg8Ra8RNMM:rg8UJbbbb9ETmba8Wa8U:vh8Wa8Ra8U:vh8RaRa8U:vhRkaqaAaKcdtfydbc8S2fgeaRa80aI:rNg8UaRNNg8YaeIdbMUdbaea8Ra8Ua8RNg80Ng81aeIdlMUdlaea8Wa8Ua8WNgINg8ZaeIdwMUdwaea80aRNg80aeIdxMUdxaeaIaRNgBaeIdzMUdzaeaIa8RNg83aeIdCMUdCaeaRa8Ua8Wa8SNaRa8XNa8Va8RNMM:mg8SNgINgRaeIdKMUdKaea8RaINg8RaeId3MUd3aea8WaINg8WaeIdaMUdaaeaIa8SNgIaeId8KMUd8Kaea8UaeIdyMUdyaqaAaQcdtfydbc8S2fgea8YaeIdbMUdbaea81aeIdlMUdlaea8ZaeIdwMUdwaea80aeIdxMUdxaeaBaeIdzMUdzaea83aeIdCMUdCaeaRaeIdKMUdKaea8RaeId3MUd3aea8WaeIdaMUdaaeaIaeId8KMUd8Kaea8UaeIdyMUdykaXclfgXcx9hmbkaLcxfhLazcifgzad6mbka8LTmbcbhLinJbbbbh8Xa3abaLcdtfgeclfydbgEcx2fgXIdwa3aeydbgzcx2fgQIdwg8Z:tg8Ra8RNaXIdbaQIdbgB:tg8Wa8WNaXIdlaQIdlg83:tg8Ua8UNMMg80a3aecwfydbgHcx2fgeIdwa8Z:tgINa8Ra8RaINa8WaeIdbaB:tg8SNa8UaeIdla83:tg8VNMMgRN:tJbbbbJbbjZa80aIaINa8Sa8SNa8Va8VNMMg81NaRaRN:tg8Y:va8YJbbbb9BEg8YNhUa81a8RNaIaRN:ta8YNh85a80a8VNa8UaRN:ta8YNh86a81a8UNa8VaRN:ta8YNh87a80a8SNa8WaRN:ta8YNh88a81a8WNa8SaRN:ta8YNh89a8Wa8VNa8Sa8UN:tgRaRNa8UaINa8Va8RN:tgRaRNa8Ra8SNaIa8WN:tgRaRNMM:rJbbbZNhRagaza8L2gwcdtfhXagaHa8L2g8NcdtfhQagaEa8L2g5cdtfhKa8Z:mh8:a83:mhZaB:mhncbhYa8Lh8AJbbbbh8VJbbbbh8YJbbbbh80Jbbbbh81Jbbbbh8ZJbbbbhBJbbbbh83JbbbbhcJbbbbh9cinasc;WbfaYfgecwfaRa85aKIdbaXIdbgI:tg8UNaUaQIdbaI:tg8SNMg8RNUdbaeclfaRa87a8UNa86a8SNMg8WNUdbaeaRa89a8UNa88a8SNMg8UNUdbaecxfaRa8:a8RNaZa8WNaIana8UNMMMgINUdbaRa8Ra8WNNa81Mh81aRa8Ra8UNNa8ZMh8ZaRa8Wa8UNNaBMhBaRaIaINNa8XMh8XaRa8RaINNa8VMh8VaRa8WaINNa8YMh8YaRa8UaINNa80Mh80aRa8Ra8RNNa83Mh83aRa8Wa8WNNacMhcaRa8Ua8UNNa9cMh9caXclfhXaKclfhKaQclfhQaYczfhYa8Acufg8Ambkavazc8S2fgea9caeIdbMUdbaeacaeIdlMUdlaea83aeIdwMUdwaeaBaeIdxMUdxaea8ZaeIdzMUdzaea81aeIdCMUdCaea80aeIdKMUdKaea8YaeId3MUd3aea8VaeIdaMUdaaea8XaeId8KMUd8KaeaRaeIdyMUdyavaEc8S2fgea9caeIdbMUdbaeacaeIdlMUdlaea83aeIdwMUdwaeaBaeIdxMUdxaea8ZaeIdzMUdzaea81aeIdCMUdCaea80aeIdKMUdKaea8YaeId3MUd3aea8VaeIdaMUdaaea8XaeId8KMUd8KaeaRaeIdyMUdyavaHc8S2fgea9caeIdbMUdbaeacaeIdlMUdlaea83aeIdwMUdwaeaBaeIdxMUdxaea8ZaeIdzMUdzaea81aeIdCMUdCaea80aeIdKMUdKaea8YaeId3MUd3aea8VaeIdaMUdaaea8XaeId8KMUd8KaeaRaeIdyMUdyaiawcltfh8AcbhXa8LhKina8AaXfgeasc;WbfaXfgQIdbaeIdbMUdbaeclfgYaQclfIdbaYIdbMUdbaecwfgYaQcwfIdbaYIdbMUdbaecxfgeaQcxfIdbaeIdbMUdbaXczfhXaKcufgKmbkaia5cltfh8AcbhXa8LhKina8AaXfgeasc;WbfaXfgQIdbaeIdbMUdbaeclfgYaQclfIdbaYIdbMUdbaecwfgYaQcwfIdbaYIdbMUdbaecxfgeaQcxfIdbaeIdbMUdbaXczfhXaKcufgKmbkaia8Ncltfh8AcbhXa8LhKina8AaXfgeasc;WbfaXfgQIdbaeIdbMUdbaeclfgYaQclfIdbaYIdbMUdbaecwfgYaQcwfIdbaYIdbMUdbaecxfgeaQcxfIdbaeIdbMUdbaXczfhXaKcufgKmbkaLcifgLad6mbkkcbhQdndnamcwGgJmbJbbbbh8Vcbh9ecbhocbhhxekcbh9ea8Fcbyd:m:jjjbHjjjjbbhhascxfasyd2gecdtfahBdbasaecefgXBd2ascxfaXcdtfcuahalabadaAz:fjjjbgKcltaKcjjjjiGEcbyd:m:jjjbHjjjjbbgoBdbasaecdfBd2aoaKaha3alz:gjjjbJFFuuh8VaKTmbaoheaKhXinaeIdbgRa8Va8VaR9EEh8VaeclfheaXcufgXmbkaKh9ekasydlhTdnalTmbaTclfheaTydbhKaChXalhYcbhQincbaeydbg8AaK9RaXRbbcpeGEaQfhQaXcefhXaeclfhea8AhKaYcufgYmbkaQce4hQkcuadaQ9RcifgScx2aSc;v:Q;v:Qe0Ecbyd:m:jjjbHjjjjbbhDascxfasyd2g9hcdtfaDBdbasa9hcefgeBd2ascxfaecdtfcuaScdtaScFFFFi0Ecbyd:m:jjjbHjjjjbbgrBdbasa9hcdfgeBd2ascxfaecdtfa8Fcbyd:m:jjjbHjjjjbbgyBdbasa9hcifgeBd2ascxfaecdtfalcbyd:m:jjjbHjjjjbbg9iBdbasa9hclfg6Bd2axaxNa8PJbbjZamclGEgUaUN:vh9cJbbbbhcdnadak9nmbdnaSci6mba8Lclth9kaDcwfh0Jbbbbh83JbbbbhcinasclfabadalaAz:cjjjbabhzcbh8Ecbh8Finaba8FcdtfhHcbheindnaAazaefydbgQcdtgEfydbgYaAaHaec;q1jjbfydbcdtfydbgXcdtgwfydbg8ASmbaCaXfRbbgLcv2aCaQfRbbgKfc;G1jjbfRbbg5aKcv2aLfg8Nc;G1jjbfRbbg8MVcFeGTmbdna8AaY9nmba8Nc:G1jjbfRbbcFeGmekaKcufhYdnaKaL9hmbaYcFeGce0mba8JaEfydbaX9hmekdndnaKclSmbaLcl9hmekdnaYcFeGce0mba8JaEfydbaX9hmdkaLcufcFeGce0mba8KawfydbaQ9hmekaDa8Ecx2fgKaXaQa8McFeGgYEBdlaKaQaXaYEBdbaKaYa5Gcb9hBdwa8Ecefh8Ekaeclfgecx9hmbkdna8Fcifg8Fad9pmbazcxfhza8EcifaS9nmekka8ETmdcbhLinaqaAaDaLcx2fgKydbgYcdtgzfydbc8S2fgeIdwa3aKydlg8Acx2fgXIdwg8WNaeIdzaXIdbg8UNaeIdaMgRaRMMa8WNaeIdlaXIdlgINaeIdCa8WNaeId3MgRaRMMaINaeIdba8UNaeIdxaINaeIdKMgRaRMMa8UNaeId8KMMM:lhRJbbbbJbbjZaeIdyg8R:va8RJbbbb9BEh8RdndnaKydwgEmbJFFuuh8YxekJbbbbJbbjZaqaAa8Acdtfydbc8S2fgeIdyg8S:va8SJbbbb9BEaeIdwa3aYcx2fgXIdwg8SNaeIdzaXIdbg8XNaeIdaMg8Ya8YMMa8SNaeIdlaXIdlg8YNaeIdCa8SNaeId3Mg8Sa8SMMa8YNaeIdba8XNaeIdxa8YNaeIdKMg8Sa8SMMa8XNaeId8KMMM:lNh8Yka8RaRNh80dna8LTmbavaYc8S2fgQIdwa8WNaQIdza8UNaQIdaMgRaRMMa8WNaQIdlaINaQIdCa8WNaQId3MgRaRMMaINaQIdba8UNaQIdxaINaQIdKMgRaRMMa8UNaQId8KMMMhRaga8Aa8L2gHcdtfhXaiaYa8L2gwcltfheaQIdyh8Sa8LhQinaXIdbg8Ra8Ra8SNaecxfIdba8WaecwfIdbNa8UaeIdbNaIaeclfIdbNMMMg8Ra8RM:tNaRMhRaXclfhXaeczfheaQcufgQmbkdndnaEmbJbbbbh8Rxekava8Ac8S2fgQIdwa3aYcx2fgeIdwg8UNaQIdzaeIdbgINaQIdaMg8Ra8RMMa8UNaQIdlaeIdlg8SNaQIdCa8UNaQId3Mg8Ra8RMMa8SNaQIdbaINaQIdxa8SNaQIdKMg8Ra8RMMaINaQId8KMMMh8RagawcdtfhXaiaHcltfheaQIdyh8Xa8LhQinaXIdbg8Wa8Wa8XNaecxfIdba8UaecwfIdbNaIaeIdbNa8SaeclfIdbNMMMg8Wa8WM:tNa8RMh8RaXclfhXaeczfheaQcufgQmbka8R:lh8Rka80aR:lMh80a8Ya8RMh8YaCaYfRbbcd9hmbdna8Ka8Ja8Jazfydba8ASEaaazfydbgHcdtfydbgzcu9hmbaaa8AcdtfydbhzkavaHc8S2fgQIdwa3azcx2fgeIdwg8WNaQIdzaeIdbg8UNaQIdaMgRaRMMa8WNaQIdlaeIdlgINaQIdCa8WNaQId3MgRaRMMaINaQIdba8UNaQIdxaINaQIdKMgRaRMMa8UNaQId8KMMMhRagaza8L2gwcdtfhXaiaHa8L2g8NcltfheaQIdyh8Sa8LhQinaXIdbg8Ra8Ra8SNaecxfIdba8WaecwfIdbNa8UaeIdbNaIaeclfIdbNMMMg8Ra8RM:tNaRMhRaXclfhXaeczfheaQcufgQmbkdndnaEmbJbbbbh8Rxekavazc8S2fgQIdwa3aHcx2fgeIdwg8UNaQIdzaeIdbgINaQIdaMg8Ra8RMMa8UNaQIdlaeIdlg8SNaQIdCa8UNaQId3Mg8Ra8RMMa8SNaQIdbaINaQIdxa8SNaQIdKMg8Ra8RMMaINaQId8KMMMh8Raga8NcdtfhXaiawcltfheaQIdyh8Xa8LhQinaXIdbg8Wa8Wa8XNaecxfIdba8UaecwfIdbNaIaeIdbNa8SaeclfIdbNMMMg8Wa8WM:tNa8RMh8RaXclfhXaeczfheaQcufgQmbka8R:lh8Rka80aR:lMh80a8Ya8RMh8YkaKa80a8Ya80a8Y9FgeEUdwaKa8AaYaeaETVgeEBdlaKaYa8AaeEBdbaLcefgLa8E9hmbkasc;Wbfcbcj;qbz:ojjjb8Aa0hea8EhXinasc;WbfaeydbcA4cF8FGgQcFAaQcFA6EcdtfgQaQydbcefBdbaecxfheaXcufgXmbkcbhecbhXinasc;WbfaefgQydbhKaQaXBdbaKaXfhXaeclfgecj;qb9hmbkcbhea0hXinasc;WbfaXydbcA4cF8FGgQcFAaQcFA6EcdtfgQaQydbgQcefBdbaraQcdtfaeBdbaXcxfhXa8Eaecefge9hmbkadak9RgQci9Uh9mdnalTmbcbheayhXinaXaeBdbaXclfhXalaecefge9hmbkkcbh9na9icbalz:ojjjbh8FaQcO9Uh9oa9mce4h9pasydwh9qcbh8Mcbh5dninaDara5cdtfydbcx2fg8NIdwgRa9c9Emea8Ma9m9pmeJFFuuh8Rdna9pa8E9pmbaDara9pcdtfydbcx2fIdwJbb;aZNh8RkdnaRa8R9ETmbaRac9ETmba8Ma9o0mdkdna8FaAa8NydlgHcdtg9rfydbgKfg9sRbba8FaAa8Nydbgzcdtg9tfydbgefg9uRbbVmbaCazfRbbh9vdnaTaecdtfgXclfydbgQaXydbgXSmbaQaX9RhYa3aKcx2fhLa3aecx2fhEa9qaXcitfhecbhXcehwdnindnayaeydbcdtfydbgQaKSmbayaeclfydbcdtfydbg8AaKSmbaQa8ASmba3a8Acx2fg8AIdba3aQcx2fgQIdbg8W:tgRaEIdlaQIdlg8U:tg8XNaEIdba8W:tg8Ya8AIdla8U:tg8RN:tgIaRaLIdla8U:tg80NaLIdba8W:tg81a8RN:tg8UNa8RaEIdwaQIdwg8S:tg8ZNa8Xa8AIdwa8S:tg8WN:tg8Xa8RaLIdwa8S:tgBNa80a8WN:tg8RNa8Wa8YNa8ZaRN:tg8Sa8Wa81NaBaRN:tgRNMMaIaINa8Xa8XNa8Sa8SNMMa8Ua8UNa8Ra8RNaRaRNMMN:rJbbj8:N9FmdkaecwfheaXcefgXaY6hwaYaX9hmbkkawceGTmba9pcefh9pxekdndndndna9vc9:fPdebdkazheinayaecdtgefaHBdbaaaefydbgeaz9hmbxikkdna8Ka8Ja8Ja9tfydbaHSEaaa9tfydbgzcdtfydbgecu9hmbaaa9rfydbhekaya9tfaHBdbaehHkayazcdtfaHBdbka9uce86bba9sce86bba8NIdwgRacacaR9DEhca9ncefh9ncecda9vceSEa8Mfh8Mka5cefg5a8E9hmbkka9nTmddnalTmbcbh8AcbhEindnayaEcdtgefydbgQaESmbaAaQcdtfydbhzdnaEaAaefydb9hgHmbaqazc8S2fgeaqaEc8S2fgXIdbaeIdbMUdbaeaXIdlaeIdlMUdlaeaXIdwaeIdwMUdwaeaXIdxaeIdxMUdxaeaXIdzaeIdzMUdzaeaXIdCaeIdCMUdCaeaXIdKaeIdKMUdKaeaXId3aeId3MUd3aeaXIdaaeIdaMUdaaeaXId8KaeId8KMUd8KaeaXIdyaeIdyMUdyka8LTmbavaQc8S2fgeavaEc8S2gwfgXIdbaeIdbMUdbaeaXIdlaeIdlMUdlaeaXIdwaeIdwMUdwaeaXIdxaeIdxMUdxaeaXIdzaeIdzMUdzaeaXIdCaeIdCMUdCaeaXIdKaeIdKMUdKaeaXId3aeId3MUd3aeaXIdaaeIdaMUdaaeaXId8KaeId8KMUd8KaeaXIdyaeIdyMUdya9kaQ2hLaihXa8LhKinaXaLfgeaXa8AfgQIdbaeIdbMUdbaeclfgYaQclfIdbaYIdbMUdbaecwfgYaQcwfIdbaYIdbMUdbaecxfgeaQcxfIdbaeIdbMUdbaXczfhXaKcufgKmbkaHmbJbbbbJbbjZaqawfgeIdygR:vaRJbbbb9BEaeIdwa3azcx2fgXIdwgRNaeIdzaXIdbg8RNaeIdaMg8Wa8WMMaRNaeIdlaXIdlg8WNaeIdCaRNaeId3MgRaRMMa8WNaeIdba8RNaeIdxa8WNaeIdKMgRaRMMa8RNaeId8KMMM:lNgRa83a83aR9DEh83ka8Aa9kfh8AaEcefgEal9hmbkcbhXa8JheindnaeydbgQcuSmbdnaXayaQcdtgKfydbgQ9hmbcuhQa8JaKfydbgKcuSmbayaKcdtfydbhQkaeaQBdbkaeclfhealaXcefgX9hmbkcbhXa8KheindnaeydbgQcuSmbdnaXayaQcdtgKfydbgQ9hmbcuhQa8KaKfydbgKcuSmbayaKcdtfydbhQkaeaQBdbkaeclfhealaXcefgX9hmbkka83aca8LEh83cbhKabhecbhYindnayaeydbcdtfydbgXayaeclfydbcdtfydbgQSmbaXayaecwfydbcdtfydbg8ASmbaQa8ASmbabaKcdtfgLaXBdbaLcwfa8ABdbaLclfaQBdbaKcifhKkaecxfheaYcifgYad6mbkdndnaJTmbaKak9nmba8Va839FTmbcbhdabhecbhXindnaoahaeydbgQcdtfydbcdtfIdba839ETmbabadcdtfgYaQBdbaYclfaeclfydbBdbaYcwfaecwfydbBdbadcifhdkaecxfheaXcifgXaK6mbkJFFuuh8Va9eTmeaohea9ehXJFFuuhRinaeIdbg8RaRaRa8R9EEg8WaRa8Ra839EgQEhRa8Wa8VaQEh8VaeclfheaXcufgXmbxdkkaKhdkadak0mbxdkkasclfabadalaAz:cjjjbkdndnadak0mbadhXxekdnaJmbadhXxekdna8Va9c9FmbadhXxekina8VJbb;aZNgRa9caRa9c9DEh8WJbbbbhRdna9eTmbaohea9ehAinaeIdbg8RaRa8Ra8W9FEaRa8RaR9EEhRaeclfheaAcufgAmbkkcbhXabhecbhAindnaoahaeydbgQcdtfydbcdtfIdba8W9ETmbabaXcdtfgKaQBdbaKclfaeclfydbBdbaKcwfaecwfydbBdbaXcifhXkaecxfheaAcifgAad6mbkJFFuuh8Vdna9eTmbaohea9ehAJFFuuh8RinaeIdbg8Ua8Ra8Ra8U9EEgIa8Ra8Ua8W9EgQEh8RaIa8VaQEh8VaeclfheaAcufgAmbkkdnaXad9hmbadhXxdkaRacacaR9DEhcaXak9nmeaXhda8Va9c9FmbkkdnamcjjjjlGTmbaOmbaXTmbcbh8AabheinaCaeydbgKfRbbc3thLaecwfgEydbhAdndna8JaKcdtgHfydbaeclfgzydbgQSmbcbhYa8KaQcdtfydbaK9hmekcjjjj94hYkaeaLaYVaKVBdbaCaQfRbbc3thLdndna8JaQcdtfydbaASmbcbhYa8KaAcdtfydbaQ9hmekcjjjj94hYkazaLaYVaQVBdbaCaAfRbbc3thYdndna8JaAcdtfydbaKSmbcbhQa8KaHfydbaA9hmekcjjjj94hQkaEaYaQVaAVBdbaecxfhea8Acifg8AaX6mbkkdnaOTmbaXTmbaXheinabaOabydbcdtfydbBdbabclfhbaecufgembkkdnaPTmbaPaUac:rNUdbka9hcdtascxffcxfhednina6Tmeaeydbcbyd1:jjjbH:bjjjbbaec98fhea6cufh6xbkkasc;W;qbf8KjjjjbaXk;Yieouabydlhvabydbclfcbaicdtz:ojjjbhoadci9UhrdnadTmbdnalTmbaehwadhDinaoalawydbcdtfydbcdtfgqaqydbcefBdbawclfhwaDcufgDmbxdkkaehwadhDinaoawydbcdtfgqaqydbcefBdbawclfhwaDcufgDmbkkdnaiTmbcbhDaohwinawydbhqawaDBdbawclfhwaqaDfhDaicufgimbkkdnadci6mbinaecwfydbhwaeclfydbhDaeydbhidnalTmbalawcdtfydbhwalaDcdtfydbhDalaicdtfydbhikavaoaicdtfgqydbcitfaDBdbavaqydbcitfawBdlaqaqydbcefBdbavaoaDcdtfgqydbcitfawBdbavaqydbcitfaiBdlaqaqydbcefBdbavaoawcdtfgwydbcitfaiBdbavawydbcitfaDBdlawawydbcefBdbaecxfhearcufgrmbkkabydbcbBdbk:todDue99aicd4aifhrcehwinawgDcethwaDar6mbkcuaDcdtgraDcFFFFi0Ecbyd:m:jjjbHjjjjbbhwaoaoyd9GgqcefBd9GaoaqcdtfawBdbawcFearz:ojjjbhkdnaiTmbalcd4hlaDcufhxcbhminamhDdnavTmbavamcdtfydbhDkcbadaDal2cdtfgDydlgwawcjjjj94SEgwcH4aw7c:F:b:DD2cbaDydbgwawcjjjj94SEgwcH4aw7c;D;O:B8J27cbaDydwgDaDcjjjj94SEgDcH4aD7c:3F;N8N27axGhwamcdthPdndndnavTmbakawcdtfgrydbgDcuSmeadavaPfydbal2cdtfgsIdbhzcehqinaqhrdnadavaDcdtfydbal2cdtfgqIdbaz9CmbaqIdlasIdl9CmbaqIdwasIdw9BmlkarcefhqakawarfaxGgwcdtfgrydbgDcu9hmbxdkkakawcdtfgrydbgDcuSmbadamal2cdtfgsIdbhzcehqinaqhrdnadaDal2cdtfgqIdbaz9CmbaqIdlasIdl9CmbaqIdwasIdw9BmikarcefhqakawarfaxGgwcdtfgrydbgDcu9hmbkkaramBdbamhDkabaPfaDBdbamcefgmai9hmbkkakcbyd1:jjjbH:bjjjbbaoaoyd9GcufBd9GdnaeTmbaiTmbcbhDaehwinawaDBdbawclfhwaiaDcefgD9hmbkcbhDaehwindnaDabydbgrSmbawaearcdtfgrydbBdbaraDBdbkawclfhwabclfhbaiaDcefgD9hmbkkk;Qodvuv998Jjjjjbca9Rgvczfcwfcbyd11jjbBdbavcb8Pdj1jjb83izavcwfcbydN1jjbBdbavcb8Pd:m1jjb83ibdnadTmbaicd4hodnabmbdnalTmbcbhrinaealarcdtfydbao2cdtfhwcbhiinavczfaifgDawaifIdbgqaDIdbgkakaq9EEUdbavaifgDaqaDIdbgkakaq9DEUdbaiclfgicx9hmbkarcefgrad9hmbxikkaocdthrcbhwincbhiinavczfaifgDaeaifIdbgqaDIdbgkakaq9EEUdbavaifgDaqaDIdbgkakaq9DEUdbaiclfgicx9hmbkaearfheawcefgwad9hmbxdkkdnalTmbcbhrinabarcx2fgiaealarcdtfydbao2cdtfgwIdbUdbaiawIdlUdlaiawIdwUdwcbhiinavczfaifgDawaifIdbgqaDIdbgkakaq9EEUdbavaifgDaqaDIdbgkakaq9DEUdbaiclfgicx9hmbkarcefgrad9hmbxdkkaocdthlcbhraehwinabarcx2fgiaearao2cdtfgDIdbUdbaiaDIdlUdlaiaDIdwUdwcbhiinavczfaifgDawaifIdbgqaDIdbgkakaq9EEUdbavaifgDaqaDIdbgkakaq9DEUdbaiclfgicx9hmbkawalfhwarcefgrad9hmbkkJbbbbavIdbavIdzgk:tgqaqJbbbb9DEgqavIdlavIdCgx:tgmamaq9DEgqavIdwavIdKgm:tgPaPaq9DEhPdnabTmbadTmbJbbbbJbbjZaP:vaPJbbbb9BEhqinabaqabIdbak:tNUdbabclfgvaqavIdbax:tNUdbabcwfgvaqavIdbam:tNUdbabcxfhbadcufgdmbkkaPk:ZlewudnaeTmbcbhvabhoinaoavBdbaoclfhoaeavcefgv9hmbkkdnaiTmbcbhrinadarcdtfhwcbhDinalawaDcdtgvc;a1jjbfydbcdtfydbcdtfydbhodnabalawavfydbcdtfydbgqcdtfgkydbgvaqSmbinakabavgqcdtfgxydbgvBdbaxhkaqav9hmbkkdnabaocdtfgkydbgvaoSmbinakabavgocdtfgxydbgvBdbaxhkaoav9hmbkkdnaqaoSmbabaqaoaqao0Ecdtfaqaoaqao6EBdbkaDcefgDci9hmbkarcifgrai6mbkkdnaembcbskcbhxindnalaxcdtgvfydbax9hmbaxhodnabavfgDydbgvaxSmbaDhqinaqabavgocdtfgkydbgvBdbakhqaoav9hmbkkaDaoBdbkaxcefgxae9hmbkcbhvabhocbhkindndnavalydbgq9hmbdnavaoydbgq9hmbaoakBdbakcefhkxdkaoabaqcdtfydbBdbxekaoabaqcdtfydbBdbkaoclfhoalclfhlaeavcefgv9hmbkakk;Jiilud99duabcbaecltz:ojjjbhvdnalTmbadhoaihralhwinarcwfIdbhDarclfIdbhqavaoydbcltfgkarIdbakIdbMUdbakclfgxaqaxIdbMUdbakcwfgxaDaxIdbMUdbakcxfgkakIdbJbbjZMUdbaoclfhoarcxfhrawcufgwmbkkdnaeTmbavhraehkinarcxfgoIdbhDaocbBdbararIdbJbbbbJbbjZaD:vaDJbbbb9BEgDNUdbarclfgoaDaoIdbNUdbarcwfgoaDaoIdbNUdbarczfhrakcufgkmbkkdnalTmbinavadydbcltfgrcxfgkaicwfIdbarcwfIdb:tgDaDNaiIdbarIdb:tgDaDNaiclfIdbarclfIdb:tgDaDNMMgDakIdbgqaqaD9DEUdbadclfhdaicxfhialcufglmbkkdnaeTmbavcxfhrinabarIdbUdbarczfhrabclfhbaecufgembkkk8MbabaeadaialavcbcbcbcbcbaoarawaDz:bjjjbk8MbabaeadaialavaoarawaDaqakaxamaPz:bjjjbk:DCoDud99rue99iul998Jjjjjbc;Wb9Rgw8KjjjjbdndnarmbcbhDxekawcxfcbc;Kbz:ojjjb8Aawcuadcx2adc;v:Q;v:Qe0Ecbyd:m:jjjbHjjjjbbgqBdxawceBd2aqaeadaicbz:ejjjb8AawcuadcdtadcFFFFi0Egkcbyd:m:jjjbHjjjjbbgxBdzawcdBd2adcd4adfhmceheinaegicetheaiam6mbkcbhPawcuaicdtgsaicFFFFi0Ecbyd:m:jjjbHjjjjbbgzBdCawciBd2dndnar:ZgH:rJbbbZMgO:lJbbb9p9DTmbaO:Ohexekcjjjj94hekaicufhAc:bwhmcbhCadhXcbhQinaChLaeamgKcufaeaK9iEaPgDcefaeaD9kEhYdndnadTmbaYcuf:YhOaqhiaxheadhmindndnaiIdbaONJbbbZMg8A:lJbbb9p9DTmba8A:OhCxekcjjjj94hCkaCcCthCdndnaiclfIdbaONJbbbZMg8A:lJbbb9p9DTmba8A:OhExekcjjjj94hEkaEcqtaCVhCdndnaicwfIdbaONJbbbZMg8A:lJbbb9p9DTmba8A:OhExekcjjjj94hEkaeaCaEVBdbaicxfhiaeclfheamcufgmmbkazcFeasz:ojjjbh3cbh5cbhPindna3axaPcdtfydbgCcm4aC7c:v;t;h;Ev2gics4ai7aAGgmcdtfgEydbgecuSmbaeaCSmbcehiina3amaifaAGgmcdtfgEydbgecuSmeaicefhiaeaC9hmbkkaEaCBdba5aecuSfh5aPcefgPad9hmbxdkkazcFeasz:ojjjb8Acbh5kaDaYa5ar0giEhPaLa5aiEhCdna5arSmbaYaKaiEgmaP9Rcd9imbdndnaQcl0mbdnaX:ZgOaL:Zg8A:taY:Yg8EaD:Y:tg8Fa8EaK:Y:tgaa5:ZghaH:tNNNaOaH:taaNa8Aah:tNa8AaH:ta8FNahaO:tNM:va8EMJbbbZMgO:lJbbb9p9DTmbaO:Ohexdkcjjjj94hexekaPamfcd9Theka5aXaiEhXaQcefgQcs9hmekkdndnaCmbcihicbhDxekcbhiawakcbyd:m:jjjbHjjjjbbg5BdKawclBd2aPcuf:Yh8AdndnadTmbaqhiaxheadhmindndnaiIdba8ANJbbbZMgO:lJbbb9p9DTmbaO:OhCxekcjjjj94hCkaCcCthCdndnaiclfIdba8ANJbbbZMgO:lJbbb9p9DTmbaO:OhExekcjjjj94hEkaEcqtaCVhCdndnaicwfIdba8ANJbbbZMgO:lJbbb9p9DTmbaO:OhExekcjjjj94hEkaeaCaEVBdbaicxfhiaeclfheamcufgmmbkazcFeasz:ojjjbh3cbhDcbhYindndndna3axaYcdtgKfydbgCcm4aC7c:v;t;h;Ev2gics4ai7aAGgmcdtfgEydbgecuSmbcehiinaxaecdtgefydbaCSmdamaifheaicefhia3aeaAGgmcdtfgEydbgecu9hmbkkaEaYBdbaDhiaDcefhDxeka5aefydbhika5aKfaiBdbaYcefgYad9hmbkcuaDc32giaDc;j:KM;jb0EhexekazcFeasz:ojjjb8AcbhDcbhekawaecbyd:m:jjjbHjjjjbbgeBd3awcvBd2aecbaiz:ojjjbhEavcd4hKdnadTmbdnalTmbaKcdth3a5hCaqhealhmadhAinaEaCydbc32fgiaeIdbaiIdbMUdbaiaeclfIdbaiIdlMUdlaiaecwfIdbaiIdwMUdwaiamIdbaiIdxMUdxaiamclfIdbaiIdzMUdzaiamcwfIdbaiIdCMUdCaiaiIdKJbbjZMUdKaCclfhCaecxfheama3fhmaAcufgAmbxdkka5hmaqheadhCinaEamydbc32fgiaeIdbaiIdbMUdbaiaeclfIdbaiIdlMUdlaiaecwfIdbaiIdwMUdwaiaiIdxJbbbbMUdxaiaiIdzJbbbbMUdzaiaiIdCJbbbbMUdCaiaiIdKJbbjZMUdKamclfhmaecxfheaCcufgCmbkkdnaDTmbaEhiaDheinaiaiIdbJbbbbJbbjZaicKfIdbgO:vaOJbbbb9BEgONUdbaiclfgmaOamIdbNUdbaicwfgmaOamIdbNUdbaicxfgmaOamIdbNUdbaiczfgmaOamIdbNUdbaicCfgmaOamIdbNUdbaic3fhiaecufgembkkcbhCawcuaDcdtgYaDcFFFFi0Egicbyd:m:jjjbHjjjjbbgeBdaawcoBd2awaicbyd:m:jjjbHjjjjbbg3Bd8KaecFeaYz:ojjjbhxdnadTmbJbbjZJbbjZa8A:vaPceSEaoNgOaONh8AaKcdthPalheina8Aaec;81jjbalEgmIdwaEa5ydbgAc32fgiIdC:tgOaONamIdbaiIdx:tgOaONamIdlaiIdz:tgOaONMMNaqcwfIdbaiIdw:tgOaONaqIdbaiIdb:tgOaONaqclfIdbaiIdl:tgOaONMMMhOdndnaxaAcdtgifgmydbcuSmba3aifIdbaO9ETmekamaCBdba3aifaOUdbka5clfh5aqcxfhqaeaPfheadaCcefgC9hmbkkabaxaYz:njjjb8AcrhikaicdthiinaiTmeaic98fgiawcxffydbcbyd1:jjjbH:bjjjbbxbkkawc;Wbf8KjjjjbaDk:Ydidui99ducbhi8Jjjjjbca9Rglczfcwfcbyd11jjbBdbalcb8Pdj1jjb83izalcwfcbydN1jjbBdbalcb8Pd:m1jjb83ibdndnaembJbbjFhvJbbjFhoJbbjFhrxekadcd4cdthwincbhdinalczfadfgDabadfIdbgvaDIdbgoaoav9EEUdbaladfgDavaDIdbgoaoav9DEUdbadclfgdcx9hmbkabawfhbaicefgiae9hmbkalIdwalIdK:thralIdlalIdC:thoalIdbalIdz:thvkJbbbbavavJbbbb9DEgvaoaoav9DEgvararav9DEk9DeeuabcFeaicdtz:ojjjbhlcbhbdnadTmbindnalaeydbcdtfgiydbcu9hmbaiabBdbabcefhbkaeclfheadcufgdmbkkabk9teiucbcbyd:q:jjjbgeabcifc98GfgbBd:q:jjjbdndnabZbcztgd9nmbcuhiabad9RcFFifcz4nbcuSmekaehikaik;teeeudndnaeabVciGTmbabhixekdndnadcz9pmbabhixekabhiinaiaeydbBdbaiaeydlBdlaiaeydwBdwaiaeydxBdxaeczfheaiczfhiadc9Wfgdcs0mbkkadcl6mbinaiaeydbBdbaeclfheaiclfhiadc98fgdci0mbkkdnadTmbinaiaeRbb86bbaicefhiaecefheadcufgdmbkkabk:3eedudndnabciGTmbabhixekaecFeGc:b:c:ew2hldndnadcz9pmbabhixekabhiinaialBdxaialBdwaialBdlaialBdbaiczfhiadc9Wfgdcs0mbkkadcl6mbinaialBdbaiclfhiadc98fgdci0mbkkdnadTmbinaiae86bbaicefhiadcufgdmbkkabk9teiucbcbyd:q:jjjbgeabcrfc94GfgbBd:q:jjjbdndnabZbcztgd9nmbcuhiabad9RcFFifcz4nbcuSmekaehikaik9:eiuZbhedndncbyd:q:jjjbgdaecztgi9nmbcuheadai9RcFFifcz4nbcuSmekadhekcbabae9Rcifc98Gcbyd:q:jjjbfgdBd:q:jjjbdnadZbcztge9nmbadae9RcFFifcz4nb8Akkk:Iedbcjwk1eFFuuFFuuFFuuFFuFFFuFFFuFbbbbbbbbeeebeebebbeeebebbbbbebebbbbbbbbbebbbdbbbbbbbebbbebbbdbbbbbbbbbbbeeeeebebbebbebebbbeebbbbbbbbbbbbbbbbbbbbbc1Dkxebbbdbbb:GNbb",t=new Uint8Array([32,0,65,2,1,106,34,33,3,128,11,4,13,64,6,253,10,7,15,116,127,5,8,12,40,16,19,54,20,9,27,255,113,17,42,67,24,23,146,148,18,14,22,45,70,69,56,114,101,21,25,63,75,136,108,28,118,29,73,115]);if(typeof WebAssembly!="object")return{supported:!1};var a,s=WebAssembly.instantiate(n(e),{}).then(function(f){a=f.instance,a.exports.__wasm_call_ctors()});function n(f){for(var d=new Uint8Array(f.length),m=0;m<f.length;++m){var l=f.charCodeAt(m);d[m]=l>96?l-97:l>64?l-39:l+4}for(var u=0,m=0;m<f.length;++m)d[u++]=d[m]<60?t[d[m]]:(d[m]-60)*64+d[++m];return d.buffer.slice(0,u)}function r(f){if(!f)throw new Error("Assertion failed")}function i(f){return new Uint8Array(f.buffer,f.byteOffset,f.byteLength)}function o(f,d,m){var l=a.exports.sbrk,u=l(d.length*4),p=l(m*4),v=new Uint8Array(a.exports.memory.buffer),T=i(d);v.set(T,u);var I=f(p,u,d.length,m);v=new Uint8Array(a.exports.memory.buffer);var k=new Uint32Array(m);new Uint8Array(k.buffer).set(v.subarray(p,p+m*4)),T.set(v.subarray(u,u+d.length*4)),l(u-l(0));for(var A=0;A<d.length;++A)d[A]=k[d[A]];return[k,I]}function c(f){for(var d=0,m=0;m<f.length;++m){var l=f[m];d=d<l?l:d}return d}function b(f,d,m,l,u,p,v,T,I){var k=a.exports.sbrk,A=k(4),_=k(m*4),N=k(u*p),F=k(m*4),j=new Uint8Array(a.exports.memory.buffer);j.set(i(l),N),j.set(i(d),F);var B=f(_,F,m,N,u,p,v,T,I,A);j=new Uint8Array(a.exports.memory.buffer);var P=new Uint32Array(B);i(P).set(j.subarray(_,_+B*4));var X=new Float32Array(1);return i(X).set(j.subarray(A,A+4)),k(A-k(0)),[P,X[0]]}function g(f,d,m,l,u,p,v,T,I,k,A,_,N){var F=a.exports.sbrk,j=F(4),B=F(m*4),P=F(u*p),X=F(u*T),ae=F(I.length*4),se=F(m*4),Ne=k?F(u):0,de=new Uint8Array(a.exports.memory.buffer);de.set(i(l),P),de.set(i(v),X),de.set(i(I),ae),de.set(i(d),se),k&&de.set(i(k),Ne);var Ae=f(B,se,m,P,u,p,X,T,ae,I.length,Ne,A,_,N,j);de=new Uint8Array(a.exports.memory.buffer);var je=new Uint32Array(Ae);i(je).set(de.subarray(B,B+Ae*4));var xe=new Float32Array(1);return i(xe).set(de.subarray(j,j+4)),F(j-F(0)),[je,xe[0]]}function h(f,d,m,l){var u=a.exports.sbrk,p=u(m*l),v=new Uint8Array(a.exports.memory.buffer);v.set(i(d),p);var T=f(p,m,l);return u(p-u(0)),T}function w(f,d,m,l,u,p,v,T){var I=a.exports.sbrk,k=I(T*4),A=I(m*l),_=I(m*p),N=new Uint8Array(a.exports.memory.buffer);N.set(i(d),A),u&&N.set(i(u),_);var F=f(k,A,m,l,_,p,v,T);N=new Uint8Array(a.exports.memory.buffer);var j=new Uint32Array(F);return i(j).set(N.subarray(k,k+F*4)),I(k-I(0)),j}var y={LockBorder:1,Sparse:2,ErrorAbsolute:4,Prune:8,_InternalDebug:1<<30};return{ready:s,supported:!0,compactMesh:function(f){r(f instanceof Uint32Array||f instanceof Int32Array||f instanceof Uint16Array||f instanceof Int16Array),r(f.length%3==0);var d=f.BYTES_PER_ELEMENT==4?f:new Uint32Array(f);return o(a.exports.meshopt_optimizeVertexFetchRemap,d,c(f)+1)},simplify:function(f,d,m,l,u,p){r(f instanceof Uint32Array||f instanceof Int32Array||f instanceof Uint16Array||f instanceof Int16Array),r(f.length%3==0),r(d instanceof Float32Array),r(d.length%m==0),r(m>=3),r(l>=0&&l<=f.length),r(l%3==0),r(u>=0);for(var v=0,T=0;T<(p?p.length:0);++T)r(p[T]in y),v|=y[p[T]];var I=f.BYTES_PER_ELEMENT==4?f:new Uint32Array(f),k=b(a.exports.meshopt_simplify,I,f.length,d,d.length/m,m*4,l,u,v);return k[0]=f instanceof Uint32Array?k[0]:new f.constructor(k[0]),k},simplifyWithAttributes:function(f,d,m,l,u,p,v,T,I,k){r(f instanceof Uint32Array||f instanceof Int32Array||f instanceof Uint16Array||f instanceof Int16Array),r(f.length%3==0),r(d instanceof Float32Array),r(d.length%m==0),r(m>=3),r(l instanceof Float32Array),r(l.length%u==0),r(u>=0),r(v==null||v instanceof Uint8Array),r(v==null||v.length==d.length/m),r(T>=0&&T<=f.length),r(T%3==0),r(I>=0),r(Array.isArray(p)),r(u>=p.length),r(p.length<=32);for(var A=0;A<p.length;++A)r(p[A]>=0);for(var _=0,A=0;A<(k?k.length:0);++A)r(k[A]in y),_|=y[k[A]];var N=f.BYTES_PER_ELEMENT==4?f:new Uint32Array(f),F=g(a.exports.meshopt_simplifyWithAttributes,N,f.length,d,d.length/m,m*4,l,u*4,new Float32Array(p),v?new Uint8Array(v):null,T,I,_);return F[0]=f instanceof Uint32Array?F[0]:new f.constructor(F[0]),F},getScale:function(f,d){return r(f instanceof Float32Array),r(f.length%d==0),r(d>=3),h(a.exports.meshopt_simplifyScale,f,f.length/d,d*4)},simplifyPoints:function(f,d,m,l,u,p){return r(f instanceof Float32Array),r(f.length%d==0),r(d>=3),r(m>=0&&m<=f.length/d),l?(r(l instanceof Float32Array),r(l.length%u==0),r(u>=3),r(f.length/d==l.length/u),w(a.exports.meshopt_simplifyPoints,f,f.length/d,d*4,l,u*4,p,m)):w(a.exports.meshopt_simplifyPoints,f,f.length/d,d*4,void 0,0,0,m)}}})();var ph=(function(){var e="b9H79TebbbeVx9Geueu9Geub9Gbb9Giuuueu9Gmuuuuuuuuuuu9999eu9Gvuuuuueu9Gwuuuuuuuub9Gxuuuuuuuuuuuueu9Gkuuuuuuuuuu99eu9Gouuuuuub9Gruuuuuuub9GluuuubiOHdilvorwDqqkbiibeilve9Weiiviebeoweuec;G:Odkr:Yewo9TW9T9VV95dbH9F9F939H79T9F9J9H229F9Jt9VV7bb8A9TW79O9V9Wt9F9I919P29K9nW79O2Wt79c9V919U9KbeX9TW79O9V9Wt9F9I919P29K9nW79O2Wt7bo39TW79O9V9Wt9F9J9V9T9W91tWJ2917tWV9c9V919U9K7br39TW79O9V9Wt9F9J9V9T9W91tW9nW79O2Wt9c9V919U9K7bDL9TW79O9V9Wt9F9V9Wt9P9T9P96W9nW79O2Wtbql79IV9RbkDwebcekdsPq;Q9BHdbkIbabaec9:fgefcufae9Ugeabci9Uadfcufad9Ugbaeab0Ek:w8KDPue99eux99dui99euo99iu8Jjjjjbc:WD9Rgm8KjjjjbdndnalmbcbhPxekamc:Cwfcbc;Kbz:njjjb8Adndnalcb9imbaoal9nmbamcuaocdtaocFFFFi0Egscbyd;y1jjbHjjjjbbgzBd:CwamceBd;8wamascbyd;y1jjbHjjjjbbgHBd:GwamcdBd;8wamcualcdtalcFFFFi0Ecbyd;y1jjbHjjjjbbgOBd:KwamciBd;8waihsalhAinazasydbcdtfcbBdbasclfhsaAcufgAmbkaihsalhAinazasydbcdtfgCaCydbcefBdbasclfhsaAcufgAmbkaihsalhCcbhXindnazasydbcdtgQfgAydbcb9imbaHaQfaXBdbaAaAydbgQcjjjj94VBdbaQaXfhXkasclfhsaCcufgCmbkalci9UhLdnalci6mbcbhsaihAinaAcwfydbhCaAclfydbhXaHaAydbcdtfgQaQydbgQcefBdbaOaQcdtfasBdbaHaXcdtfgXaXydbgXcefBdbaOaXcdtfasBdbaHaCcdtfgCaCydbgCcefBdbaOaCcdtfasBdbaAcxfhAaLascefgs9hmbkkaihsalhAindnazasydbcdtgCfgXydbgQcu9kmbaXaQcFFFFrGgQBdbaHaCfgCaCydbaQ9RBdbkasclfhsaAcufgAmbxdkkamcuaocdtgsaocFFFFi0EgAcbyd;y1jjbHjjjjbbgzBd:CwamceBd;8wamaAcbyd;y1jjbHjjjjbbgHBd:GwamcdBd;8wamcualcdtalcFFFFi0Ecbyd;y1jjbHjjjjbbgOBd:KwamciBd;8wazcbasz:njjjbhXalci9UhLaihsalhAinaXasydbcdtfgCaCydbcefBdbasclfhsaAcufgAmbkdnaoTmbcbhsaHhAaXhCaohQinaAasBdbaAclfhAaCydbasfhsaCclfhCaQcufgQmbkkdnalci6mbcbhsaihAinaAcwfydbhCaAclfydbhQaHaAydbcdtfgKaKydbgKcefBdbaOaKcdtfasBdbaHaQcdtfgQaQydbgQcefBdbaOaQcdtfasBdbaHaCcdtfgCaCydbgCcefBdbaOaCcdtfasBdbaAcxfhAaLascefgs9hmbkkaoTmbcbhsaohAinaHasfgCaCydbaXasfydb9RBdbasclfhsaAcufgAmbkkamaLcbyd;y1jjbHjjjjbbgsBd:OwamclBd;8wascbaLz:njjjbhYamcuaLcK2alcjjjjd0Ecbyd;y1jjbHjjjjbbg8ABd:SwamcvBd;8wJbbbbhEdnalci6g3mbarcd4hKaihAa8AhsaLhrJbbbbh5inavaAclfydbaK2cdtfgCIdlh8EavaAydbaK2cdtfgXIdlhEavaAcwfydbaK2cdtfgQIdlh8FaCIdwhaaXIdwhhaQIdwhgasaCIdbg8JaXIdbg8KMaQIdbg8LMJbbnn:vUdbasclfaXIdlaCIdlMaQIdlMJbbnn:vUdbaQIdwh8MaCIdwh8NaXIdwhyascxfa8EaE:tg8Eagah:tggNa8FaE:tg8Faaah:tgaN:tgEJbbbbJbbjZa8Ja8K:tg8Ja8FNa8La8K:tg8Ka8EN:tghahNaEaENaaa8KNaga8JN:tgEaENMM:rg8K:va8KJbbbb9BEg8ENUdbasczfaEa8ENUdbascCfaha8ENUdbascwfa8Maya8NMMJbbnn:vUdba5a8KMh5aAcxfhAascKfhsarcufgrmbka5aL:Z:vJbbbZNhEkamcuaLcdtalcFFFF970Ecbyd;y1jjbHjjjjbbgCBd:WwamcoBd;8waEaq:ZNhEdna3mbcbhsaChAinaAasBdbaAclfhAaLascefgs9hmbkkaE:rhhcuh8PamcuaLcltalcFFFFd0Ecbyd;y1jjbHjjjjbbgIBd:0wamcrBd;8wcbaIa8AaCaLz:djjjb8AJFFuuhyJFFuuh8RJFFuuh8Sdnalci6gXmbJFFuuh8Sa8AhsaLhAJFFuuh8RJFFuuhyinascwfIdbgEayayaE9EEhyasclfIdbgEa8Ra8RaE9EEh8RasIdbgEa8Sa8SaE9EEh8SascKfhsaAcufgAmbkkahJbbbZNhgamaocetgscuaocu9kEcbyd;y1jjbHjjjjbbgABd:4waAcFeasz:njjjbhCdnaXmbcbhAJFFuuhEa8Ahscuh8PinascwfIdbay:tghahNasIdba8S:tghahNasclfIdba8R:tghahNMM:rghaEa8PcuSahaE9DVgXEhEaAa8PaXEh8PascKfhsaLaAcefgA9hmbkkamczfcbcjwz:njjjb8Aamcwf9cb83ibam9cb83ibagaxNhRJbbjZak:th8Ncbh8UJbbbbh8VJbbbbh8WJbbbbh8XJbbbbh8YJbbbbh8ZJbbbbh80cbh81cbhPinJbbbbhEdna8UTmbJbbjZa8U:Z:vhEkJbbbbhhdna80a80Na8Ya8YNa8Za8ZNMMg8KJbbbb9BmbJbbjZa8K:r:vhhka8XaENh5a8WaENh8Fa8VaENhaa8PhQdndndndndna8UaPVTmbamydwgBTmea80ahNh8Ja8ZahNh8La8YahNh8Maeamydbcdtfh83cbh3JFFuuhEcvhXcuhQindnaza83a3cdtfydbcdtgsfydbgvTmbaOaHasfydbcdtfhAindndnaCaiaAydbgKcx2fgsclfydbgrcetf8Vebcs4aCasydbgLcetf8Vebcs4faCascwfydbglcetf8Vebcs4fgombcbhsxekcehsazaLcdtfydbgLceSmbcehsazarcdtfydbgrceSmbcehsazalcdtfydbglceSmbdnarcdSaLcdSfalcdSfcd6mbaocefhsxekaocdfhskdnasaX9kmba8AaKcK2fgLIdwa5:thhaLIdla8F:th8KaLIdbaa:th8EdndnakJbbbb9DTmba8E:lg8Ea8K:lg8Ka8Ea8K9EEg8Kah:lgha8Kah9EEag:vJbbjZMhhxekahahNa8Ea8ENa8Ka8KNMM:rag:va8NNJbbjZMJ9VO:d86JbbjZaLIdCa8JNaLIdxa8MNa8LaLIdzNMMakN:tghahJ9VO:d869DENhhkaKaQasaX6ahaE9DVgLEhQasaXaLEhXahaEaLEhEkaAclfhAavcufgvmbkka3cefg3aB9hmbkkaQcu9hmekama5Ud:ODama8FUd:KDamaaUd:GDamcuBd:qDamcFFF;7rBdjDaIcba8AaYamc:GDfakJbbbb9Damc:qDfamcjDfz:ejjjbamyd:qDhQdndnaxJbbbb9ETmba8UaD6mbaQcuSmeceh3amIdjDaR9EmixdkaQcu9hmekdna8UTmbdnamydlgza8Uci2fgsciGTmbadasfcba8Uazcu7fciGcefz:njjjb8AkabaPcltfgzam8Pib83dbazcwfamcwf8Pib83dbaPcefhPkc3hzinazc98Smvamc:Cwfazfydbcbyd;u1jjbH:bjjjbbazc98fhzxbkkcbh3a8Uaq9pmbamydwaCaiaQcx2fgsydbcetf8Vebcs4aCascwfydbcetf8Vebcs4faCasclfydbcetf8Vebcs4ffaw9nmekcbhscbhAdna81TmbcbhAamczfhXinamczfaAcdtfaXydbgLBdbaXclfhXaAaYaLfRbbTfhAa81cufg81mbkkamydwhlamydbhXam9cu83i:GDam9cu83i:ODam9cu83i:qDam9cu83i:yDaAc;8eaAclfc:bd6Eh81inamcjDfasfcFFF;7rBdbasclfgscz9hmbka81cdthBdnalTmbaeaXcdtfhocbhrindnazaoarcdtfydbcdtgsfydbgvTmbaOaHasfydbcdtfhAcuhLcuhsinazaiaAydbgKcx2fgXclfydbcdtfydbazaXydbcdtfydbfazaXcwfydbcdtfydbfgXasaXas6gXEhsaKaLaXEhLaAclfhAavcufgvmbkaLcuSmba8AaLcK2fgAIdway:tgEaENaAIdba8S:tgEaENaAIdla8R:tgEaENMM:rhEcbhAindndnasamc:qDfaAfgvydbgX6mbasaX9hmeaEamcjDfaAfIdb9FTmekavasBdbamc:GDfaAfaLBdbamcjDfaAfaEUdbxdkaAclfgAcz9hmbkkarcefgral9hmbkkamczfaBfhLcbhscbhAindnamc:GDfasfydbgXcuSmbaLaAcdtfaXBdbaAcefhAkasclfgscz9hmbkaAa81fg81TmbJFFuuhhcuhKamczfhsa81hvcuhLina8AasydbgXcK2fgAIdway:tgEaENaAIdba8S:tgEaENaAIdla8R:tgEaENMM:rhEdndnazaiaXcx2fgAclfydbcdtfydbazaAydbcdtfydbfazaAcwfydbcdtfydbfgAaL6mbaAaL9hmeaEah9DTmekaEhhaAhLaXhKkasclfhsavcufgvmbkaKcuSmbaKhQkdnamaiaQcx2fgrydbarclfydbarcwfydbaCabaeadaPawaqa3z:fjjjbTmbaPcefhPJbbbbh8VJbbbbh8WJbbbbh8XJbbbbh8YJbbbbh8ZJbbbbh80kcbhXinaOaHaraXcdtfydbcdtgAfydbcdtfgKhsazaAfgvydbgLhAdnaLTmbdninasydbaQSmeasclfhsaAcufgATmdxbkkasaKaLcdtfc98fydbBdbavavydbcufBdbkaXcefgXci9hmbka8AaQcK2fgsIdbhEasIdlhhasIdwh8KasIdxh8EasIdzh5asIdCh8FaYaQfce86bba80a8FMh80a8Za5Mh8Za8Ya8EMh8Ya8Xa8KMh8Xa8WahMh8Wa8VaEMh8Vamydxh8Uxbkkamc:WDf8KjjjjbaPk;Vvivuv99lu8Jjjjjbca9Rgv8Kjjjjbdndnalcw0mbaiydbhoaeabcitfgralcdtcufBdlaraoBdbdnalcd6mbaiclfhoalcufhwarcxfhrinaoydbhDarcuBdbarc98faDBdbarcwfhraoclfhoawcufgwmbkkalabfhrxekcbhDavczfcwfcbBdbav9cb83izavcwfcbBdbav9cb83ibJbbjZhqJbbjZhkinadaiaDcdtfydbcK2fhwcbhrinavczfarfgoawarfIdbgxaoIdbgm:tgPakNamMgmUdbavarfgoaPaxam:tNaoIdbMUdbarclfgrcx9hmbkJbbjZaqJbbjZMgq:vhkaDcefgDal9hmbkcbhoadcbcecdavIdlgxavIdwgm9GEgravIdbgPam9GEaraPax9GEgscdtgrfhzavczfarfIdbhxaihralhwinaiaocdtfgDydbhHaDarydbgOBdbaraHBdbarclfhraoazaOcK2fIdbax9Dfhoawcufgwmbkaeabcitfhrdndnaocv6mbaoalc98f6mekaraiydbBdbaralcdtcufBdlaiclfhoalcufhwarcxfhrinaoydbhDarcuBdbarc98faDBdbarcwfhraoclfhoawcufgwmbkalabfhrxekaraxUdbararydlc98GasVBdlabcefaeadaiaoz:djjjbhwararydlciGawabcu7fcdtVBdlawaeadaiaocdtfalao9Rz:djjjbhrkavcaf8Kjjjjbark:;idiud99dndnabaecitfgwydlgDciGgqciSmbinabcbaDcd4gDalaqcdtfIdbawIdb:tgkJbbbb9FEgwaecefgefadaialavaoarz:ejjjbak:larIdb9FTmdabawaD7aefgecitfgwydlgDciGgqci9hmbkkabaecitfgeclfhbdnavmbcuhwindnaiaeydbgDfRbbmbadaDcK2fgqIdwalIdw:tgkakNaqIdbalIdb:tgkakNaqIdlalIdl:tgkakNMM:rgkarIdb9DTmbarakUdbaoaDBdbkaecwfheawcefgwabydbcd46mbxdkkcuhwindnaiaeydbgDfRbbmbadaDcK2fgqIdbalIdb:t:lgkaqIdlalIdl:t:lgxakax9EEgkaqIdwalIdw:t:lgxakax9EEgkarIdb9DTmbarakUdbaoaDBdbkaecwfheawcefgwabydbcd46mbkkk;llevudnabydwgxaladcetfgm8Vebcs4alaecetfgP8Vebgscs4falaicetfgz8Vebcs4ffaD0abydxaq9pVakVgDce9hmbavawcltfgxab8Pdb83dbaxcwfabcwfgx8Pdb83dbdnaxydbgqTmbaoabydbcdtfhxaqhsinalaxydbcetfcFFi87ebaxclfhxascufgsmbkkdnabydxglci2gsabydlgxfgkciGTmbarakfcbalaxcu7fciGcefz:njjjb8Aabydxci2hsabydlhxabydwhqkab9cb83dwababydbaqfBdbabascifc98GaxfBdlaP8Vebhscbhxkdnascztcz91cu9kmbabaxcefBdwaPax87ebaoabydbcdtfaxcdtfaeBdbkdnam8Uebcu9kmbababydwgxcefBdwamax87ebaoabydbcdtfaxcdtfadBdbkdnaz8Uebcu9kmbababydwgxcefBdwazax87ebaoabydbcdtfaxcdtfaiBdbkarabydlfabydxci2faPRbb86bbarabydlfabydxci2fcefamRbb86bbarabydlfabydxci2fcdfazRbb86bbababydxcefBdxaDk8LbabaeadaialavaoarawaDaDaqJbbbbz:cjjjbk;Nkovud99euv99eul998Jjjjjbc:W;ae9Rgo8KjjjjbdndnadTmbavcd4hrcbhwcbhDindnaiaeclfydbar2cdtfgvIdbaiaeydbar2cdtfgqIdbgk:tgxaiaecwfydbar2cdtfgmIdlaqIdlgP:tgsNamIdbak:tgzavIdlaP:tgPN:tgkakNaPamIdwaqIdwgH:tgONasavIdwaH:tgHN:tgPaPNaHazNaOaxN:tgxaxNMM:rgsJbbbb9Bmbaoc:W:qefawcx2fgAakas:vUdwaAaxas:vUdlaAaPas:vUdbaoc8Wfawc8K2fgAaq8Pdb83dbaAav8Pdb83dxaAam8Pdb83dKaAcwfaqcwfydbBdbaAcCfavcwfydbBdbaAcafamcwfydbBdbawcefhwkaecxfheaDcifgDad6mbkab9cb83dbabcyf9cb83dbabcaf9cb83dbabcKf9cb83dbabczf9cb83dbabcwf9cb83dbawTmeaocbBd8Sao9cb83iKao9cb83izaoczfaoc8Wfawci2cxaoc8Sfcbcrz1jjjbaoIdKhCaoIdChXaoIdzhQao9cb83iwao9cb83ibaoaoc:W:qefawcxaoc8Sfcbciz1jjjbJbbjZhkaoIdwgPJbbbbJbbjZaPaPNaoIdbgPaPNaoIdlgsasNMM:rgx:vaxJbbbb9BEgzNhxasazNhsaPazNhzaoc:W:qefheawhvinaecwfIdbaxNaeIdbazNasaeclfIdbNMMgPakaPak9DEhkaecxfheavcufgvmbkabaCUdwabaXUdlabaQUdbabaoId3UdxdndnakJ;n;m;m899FmbJbbbbhPaoc:W:qefheaoc8WfhvinaCavcwfIdb:taecwfIdbgHNaQavIdb:taeIdbgONaXavclfIdb:taeclfIdbgLNMMaxaHNazaONasaLNMM:vgHaPaHaP9EEhPavc8KfhvaecxfheawcufgwmbkabaxUd8KabasUdaabazUd3abaCaxaPN:tUdKabaXasaPN:tUdCabaQazaPN:tUdzabJbbjZakakN:t:rgkUdydndnaxJbbj:;axJbbj:;9GEgPJbbjZaPJbbjZ9FEJbb;:9cNJbbbZJbbb:;axJbbbb9GEMgP:lJbbb9p9DTmbaP:Ohexekcjjjj94hekabae86b8UdndnasJbbj:;asJbbj:;9GEgPJbbjZaPJbbjZ9FEJbb;:9cNJbbbZJbbb:;asJbbbb9GEMgP:lJbbb9p9DTmbaP:Ohvxekcjjjj94hvkabav86bRdndnazJbbj:;azJbbj:;9GEgPJbbjZaPJbbjZ9FEJbb;:9cNJbbbZJbbb:;azJbbbb9GEMgP:lJbbb9p9DTmbaP:Ohqxekcjjjj94hqkabaq86b8SdndnaecKtcK91:YJbb;:9c:vax:t:lavcKtcK91:YJbb;:9c:vas:t:laqcKtcK91:YJbb;:9c:vaz:t:lakMMMJbb;:9cNJbbjZMgk:lJbbb9p9DTmbak:Ohexekcjjjj94hekaecFbaecFb9iEhexekabcjjj;8iBdycFbhekabae86b8Vxekab9cb83dbabcyf9cb83dbabcaf9cb83dbabcKf9cb83dbabczf9cb83dbabcwf9cb83dbkaoc:W;aef8Kjjjjbk;Iwwvul99iud99eue99eul998Jjjjjbcje9Rgr8Kjjjjbavcd4hwaicd4hDdndnaoTmbarc;abfcbaocdtgvz:njjjb8Aarc;Gbfcbavz:njjjb8AarhvarcafhiaohqinavcFFF97BdbaicFFF;7rBdbaiclfhiavclfhvaqcufgqmbkdnadTmbcbhkinaeakaD2cdtfgvIdwhxavIdlhmavIdbhPalakaw2cdtfIdbhsarc;abfhzarhiarc;GbfhHarcafhqcj1jjbhvaohOinasavcwfIdbaxNavIdbaPNavclfIdbamNMMgAMhCakhXdnaAas:tgAaqIdbgQ9DgLmbaHydbhXkaHaXBdbakhXdnaCaiIdbgK9EmbazydbhXaKhCkazaXBdbaiaCUdbaqaAaQaLEUdbavcxfhvaqclfhqaHclfhHaiclfhiazclfhzaOcufgOmbkakcefgkad9hmbkkadThkJbbbbhCcbhXarc;abfhvarc;Gbfhicbhqinalavydbgzaw2cdtfIdbalaiydbgHaw2cdtfIdbaeazaD2cdtfgzIdwaeaHaD2cdtfgHIdw:tgsasNazIdbaHIdb:tgsasNazIdlaHIdl:tgsasNMM:rMMgsaCasaC9EgzEhCaqaXazEhXaiclfhiavclfhvaoaqcefgq9hmbkaCJbbbZNhKxekadThkcbhXJbbbbhKkJbbbbhCdnaearc;abfaXcdtgifydbgqaD2cdtfgvIdwaearc;GbfaifydbgzaD2cdtfgiIdwgm:tgsasNavIdbaiIdbgY:tgAaANavIdlaiIdlgP:tgQaQNMM:rgxJbbbb9ETmbaxalaqaw2cdtfIdbMalazaw2cdtfIdb:taxaxM:vhCkasaCNamMhmaQaCNaPMhPaAaCNaYMhYdnakmbaDcdthvawcdthiindnalIdbg8AaecwfIdbam:tgCaCNaeIdbaY:tgsasNaeclfIdbaP:tgAaANMM:rgQMgEaK9ETmbJbbbbhxdnaQJbbbb9ETmbaEaK:taQaQM:vhxkaxaCNamMhmaxaANaPMhPaxasNaYMhYa8AaKaQMMJbbbZNhKkaeavfhealaifhladcufgdmbkkabaKUdxabamUdwabaPUdlabaYUdbarcjef8Kjjjjbkjeeiu8Jjjjjbcj8W9Rgr8Kjjjjbaici2hwdnaiTmbawceawce0EhDarhiinaiaeadRbbcdtfydbBdbadcefhdaiclfhiaDcufgDmbkkabarawaladaoz:hjjjbarcj8Wf8Kjjjjbk:3lequ8JjjjjbcjP9Rgl8Kjjjjbcbhvalcjxfcbaiz:njjjb8AdndnadTmbcjehoaehrincuhwarhDcuhqavhkdninawakaoalcjxfaDcefRbbfRbb9RcFeGci6aoalcjxfaDRbbfRbb9RcFeGci6faoalcjxfaDcdfRbbfRbb9RcFeGci6fgxaq9mgmEhwdnammbaxce0mdkaxaqaxaq9kEhqaDcifhDadakcefgk9hmbkkaeawci2fgDcdfRbbhqaDcefRbbhxaDRbbhkaeavci2fgDcifaDawav9Rci2z:qjjjb8Aakalcjxffaocefgo86bbaxalcjxffao86bbaDcdfaq86bbaDcefax86bbaDak86bbaqalcjxffao86bbarcifhravcefgvad9hmbkalcFeaicetz:njjjbhoadci2gDceaDce0EhqcbhxindnaoaeRbbgkcetfgw8UebgDcu9kmbawax87ebaocjlfaxcdtfabakcdtfydbBdbaxhDaxcefhxkaeaD86bbaecefheaqcufgqmbkaxcdthDxekcbhDkabalcjlfaDz:mjjjb8AalcjPf8Kjjjjbk9teiucbcbyd;C1jjbgeabcifc98GfgbBd;C1jjbdndnabZbcztgd9nmbcuhiabad9RcFFifcz4nbcuSmekaehikaik;teeeudndnaeabVciGTmbabhixekdndnadcz9pmbabhixekabhiinaiaeydbBdbaiaeydlBdlaiaeydwBdwaiaeydxBdxaeczfheaiczfhiadc9Wfgdcs0mbkkadcl6mbinaiaeydbBdbaeclfheaiclfhiadc98fgdci0mbkkdnadTmbinaiaeRbb86bbaicefhiaecefheadcufgdmbkkabk:3eedudndnabciGTmbabhixekaecFeGc:b:c:ew2hldndnadcz9pmbabhixekabhiinaialBdxaialBdwaialBdlaialBdbaiczfhiadc9Wfgdcs0mbkkadcl6mbinaialBdbaiclfhiadc98fgdci0mbkkdnadTmbinaiae86bbaicefhiadcufgdmbkkabk9teiucbcbyd;C1jjbgeabcrfc94GfgbBd;C1jjbdndnabZbcztgd9nmbcuhiabad9RcFFifcz4nbcuSmekaehikaik9:eiuZbhedndncbyd;C1jjbgdaecztgi9nmbcuheadai9RcFFifcz4nbcuSmekadhekcbabae9Rcifc98Gcbyd;C1jjbfgdBd;C1jjbdnadZbcztge9nmbadae9RcFFifcz4nb8Akk:;Deludndndnadch9pmbabaeSmdaeabadfgi9Rcbadcet9R0mekabaead;8qbbxekaeab7ciGhldndndnabae9pmbdnalTmbadhvabhixikdnabciGmbadhvabhixdkadTmiabaeRbb86bbadcufhvdnabcefgiciGmbaecefhexdkavTmiabaeRbe86beadc9:fhvdnabcdfgiciGmbaecdfhexdkavTmiabaeRbd86bdadc99fhvdnabcifgiciGmbaecifhexdkavTmiabaeRbi86biabclfhiaeclfheadc98fhvxekdnalmbdnaiciGTmbadTmlabadcufgifglaeaifRbb86bbdnalciGmbaihdxekaiTmlabadc9:fgifglaeaifRbb86bbdnalciGmbaihdxekaiTmlabadc99fgifglaeaifRbb86bbdnalciGmbaihdxekaiTmlabadc98fgdfaeadfRbb86bbkadcl6mbdnadc98fgocd4cefciGgiTmbaec98fhlabc98fhvinavadfaladfydbBdbadc98fhdaicufgimbkkaocx6mbaec9Wfhvabc9WfhoinaoadfgicxfavadfglcxfydbBdbaicwfalcwfydbBdbaiclfalclfydbBdbaialydbBdbadc9Wfgdci0mbkkadTmdadhidnadciGglTmbaecufhvabcufhoadhiinaoaifavaifRbb86bbaicufhialcufglmbkkadcl6mdaec98fhlabc98fhvinavaifgecifalaifgdcifRbb86bbaecdfadcdfRbb86bbaecefadcefRbb86bbaeadRbb86bbaic98fgimbxikkavcl6mbdnavc98fglcd4cefcrGgdTmbavadcdt9RhvinaiaeydbBdbaeclfheaiclfhiadcufgdmbkkalc36mbinaiaeydbBdbaiaeydlBdlaiaeydwBdwaiaeydxBdxaiaeydzBdzaiaeydCBdCaiaeydKBdKaiaeyd3Bd3aecafheaicafhiavc9Gfgvci0mbkkavTmbdndnavcrGgdmbavhlxekavc94GhlinaiaeRbb86bbaicefhiaecefheadcufgdmbkkavcw6mbinaiaeRbb86bbaiaeRbe86beaiaeRbd86bdaiaeRbi86biaiaeRbl86blaiaeRbv86bvaiaeRbo86boaiaeRbr86braicwfhiaecwfhealc94fglmbkkabkk9Tdbcjwk9ubbjZbbbbbbbbbbbbbbjZbbbbbbbbbbbbbbjZ86;nAZ86;nAZ86;nAZ86;nA:;86;nAZ86;nAZ86;nAZ86;nA:;86;nAZ86;nAZ86;nAZ86;nA:;bc;uwkxebbbdbbb9GNbb",t=new Uint8Array([32,0,65,2,1,106,34,33,3,128,11,4,13,64,6,253,10,7,15,116,127,5,8,12,40,16,19,54,20,9,27,255,113,17,42,67,24,23,146,148,18,14,22,45,70,69,56,114,101,21,25,63,75,136,108,28,118,29,73,115]);if(typeof WebAssembly!="object")return{supported:!1};var a,s=WebAssembly.instantiate(n(e),{}).then(function(f){a=f.instance,a.exports.__wasm_call_ctors()});function n(f){for(var d=new Uint8Array(f.length),m=0;m<f.length;++m){var l=f.charCodeAt(m);d[m]=l>96?l-97:l>64?l-39:l+4}for(var u=0,m=0;m<f.length;++m)d[u++]=d[m]<60?t[d[m]]:(d[m]-60)*64+d[++m];return d.buffer.slice(0,u)}function r(f){if(!f)throw new Error("Assertion failed")}function i(f){return new Uint8Array(f.buffer,f.byteOffset,f.byteLength)}var o=48,c=16;function b(f,d){var m=f.meshlets[d*4+0],l=f.meshlets[d*4+1],u=f.meshlets[d*4+2],p=f.meshlets[d*4+3];return{vertices:f.vertices.subarray(m,m+u),triangles:f.triangles.subarray(l,l+p*3)}}function g(f,d,m,l,u,p,v){var T=a.exports.sbrk,I=a.exports.meshopt_buildMeshletsBound(f.length,u,p),k=T(I*c),A=T(I*u*4),_=T(I*p*3),N=T(f.byteLength),F=T(d.byteLength),j=new Uint8Array(a.exports.memory.buffer);j.set(i(f),N),j.set(i(d),F);var B=a.exports.meshopt_buildMeshlets(k,A,_,N,f.length,F,m,l,u,p,v);j=new Uint8Array(a.exports.memory.buffer);for(var P=j.subarray(k,k+B*c),X=new Uint32Array(P.buffer,P.byteOffset,P.byteLength/4).slice(),ae=0;ae<B;++ae){var se=X[ae*4+0],Ne=X[ae*4+1],m=X[ae*4+2],de=X[ae*4+3];a.exports.meshopt_optimizeMeshlet(A+se*4,_+Ne,de,m)}var Ae=X[(B-1)*4+0],je=X[(B-1)*4+1],xe=X[(B-1)*4+2],R=X[(B-1)*4+3],O=Ae+xe,V=je+(R*3+3&-4),ne={meshlets:X,vertices:new Uint32Array(j.buffer,A,O).slice(),triangles:new Uint8Array(j.buffer,_,V*3).slice(),meshletCount:B};return T(k-T(0)),ne}function h(f){var d=new Float32Array(a.exports.memory.buffer,f,o/4);return{centerX:d[0],centerY:d[1],centerZ:d[2],radius:d[3],coneApexX:d[4],coneApexY:d[5],coneApexZ:d[6],coneAxisX:d[7],coneAxisY:d[8],coneAxisZ:d[9],coneCutoff:d[10]}}function w(f,d,m,l){var u=a.exports.sbrk,p=[],v=u(d.byteLength),T=u(f.vertices.byteLength),I=u(f.triangles.byteLength),k=u(o),A=new Uint8Array(a.exports.memory.buffer);A.set(i(d),v),A.set(i(f.vertices),T),A.set(i(f.triangles),I);for(var _=0;_<f.meshletCount;++_){var N=f.meshlets[_*4+0],F=f.meshlets[_*4+0+1],j=f.meshlets[_*4+0+3];a.exports.meshopt_computeMeshletBounds(k,T+N*4,I+F,j,v,m,l),p.push(h(k))}return u(v-u(0)),p}function y(f,d,m,l){var u=a.exports.sbrk,p=u(o),v=u(f.byteLength),T=u(d.byteLength),I=new Uint8Array(a.exports.memory.buffer);I.set(i(f),v),I.set(i(d),T),a.exports.meshopt_computeClusterBounds(p,v,f.length,T,m,l);var k=h(p);return u(p-u(0)),k}return{ready:s,supported:!0,buildMeshlets:function(f,d,m,l,u,p){r(f.length%3==0),r(d instanceof Float32Array),r(d.length%m==0),r(m>=3),r(l<=256||l>0),r(u<=512),r(u%4==0),p=p||0;var v=f.BYTES_PER_ELEMENT==4?f:new Uint32Array(f);return g(v,d,d.length/m,m*4,l,u,p)},computeClusterBounds:function(f,d,m){r(f.length%3==0),r(f.length/3<=512),r(d instanceof Float32Array),r(d.length%m==0),r(m>=3);var l=f.BYTES_PER_ELEMENT==4?f:new Uint32Array(f);return y(l,d,d.length/m,m*4)},computeMeshletBounds:function(f,d,m){return r(f.meshletCount!=0),r(d instanceof Float32Array),r(d.length%m==0),r(m>=3),w(f,d,d.length/m,m*4)},extractMeshlet:function(f,d){return r(d>=0&&d<f.meshletCount),b(f,d)}}})();var kd=new vn().registerExtensions([us,hs,ps]).registerDependencies({"meshopt.decoder":ms});async function wa(e,t={}){await ms.ready;let a=await fetch(e,{cache:t.fetchCache||"default"});if(!a.ok)throw new Error(`Failed to load ${e}: ${a.status}`);let s=new Uint8Array(await a.arrayBuffer()),n=await kd.readBinary(s),r=[],i=t.componentFeatures||new Map;function o(c,b=""){let g=i.has(c.getName())?c.getName():b,h=c.getMesh();if(h){let w=c.getWorldMatrix();for(let y of h.listPrimitives()){let f=y.getAttribute("POSITION"),d=y.getAttribute("NORMAL"),m=y.getAttribute("_FEATURE_ID_0"),l=y.getAttribute("_FEATURE_ID_1"),u=y.getIndices()?.getArray();if(!f||!u)continue;let p=f.getCount(),v=new Float32Array(p*3),T=new Float32Array(p*3),I=new Uint32Array(p),k=new Uint32Array(p),A=[1/0,1/0,1/0,-1/0,-1/0,-1/0],_=[],N=i.get(g)?.featureId||t.defaultFeatureId||0;for(let j=0;j<p;j+=1)f.getElement(j,_),Md(v,j*3,_,w),A[0]=Math.min(A[0],v[j*3]),A[1]=Math.min(A[1],v[j*3+1]),A[2]=Math.min(A[2],v[j*3+2]),A[3]=Math.max(A[3],v[j*3]),A[4]=Math.max(A[4],v[j*3+1]),A[5]=Math.max(A[5],v[j*3+2]),d?(d.getElement(j,_),Ad(T,j*3,_,w)):T.set([0,0,1],j*3),I[j]=Number(m?.getScalar(j)||0),k[j]=Number(l?l.getScalar(j)||0:N);let F=y.getMaterial();r.push({position:v,normal:T,netId:I,objectFeatureId:k,indices:u,designator:g,nodeName:c.getName(),meshName:h.getName(),bounds:A,material:F?{name:F.getName(),baseColor:F.getBaseColorFactor(),metallic:F.getMetallicFactor(),roughness:F.getRoughnessFactor(),emissive:F.getEmissiveFactor()}:{baseColor:t.baseColor||[.55,.58,.64,1],metallic:.05,roughness:.72,emissive:[0,0,0]}})}}for(let w of c.listChildren())o(w,g)}for(let c of n.getRoot().listScenes())for(let b of c.listChildren())o(b);return{byteLength:s.byteLength,primitives:r}}function Md(e,t,a,s){let n=s[0]*a[0]+s[4]*a[1]+s[8]*a[2]+s[12],r=s[1]*a[0]+s[5]*a[1]+s[9]*a[2]+s[13],i=s[2]*a[0]+s[6]*a[1]+s[10]*a[2]+s[14];e[t]=n,e[t+1]=-i,e[t+2]=r}function Ad(e,t,a,s){let n=s[0]*a[0]+s[4]*a[1]+s[8]*a[2],r=s[1]*a[0]+s[5]*a[1]+s[9]*a[2],i=s[2]*a[0]+s[6]*a[1]+s[10]*a[2],o=Math.hypot(n,r,i)||1;e[t]=n/o,e[t+1]=-i/o,e[t+2]=r/o}var Sd=`
struct Globals {
  viewProjection: mat4x4f,
  activeNet: u32,
  selectedLayer: u32,
  time: f32,
  hasHighlight: f32,
  selectedFeature: u32,
  padding0: u32,
  padding1: u32,
  padding2: u32,
  lightDirection: vec4f,
};
struct Draw {
  color: vec4f,
  material: vec4f,
  offset: vec4f,
  flags: vec4f,
};
@group(0) @binding(0) var<uniform> globals: Globals;
@group(0) @binding(1) var<uniform> draw: Draw;

struct VertexInput {
  @location(0) position: vec3f,
  @location(1) normal: vec3f,
  @location(2) netId: u32,
  @location(3) objectId: u32,
  @location(4) layerId: u32,
  @location(5) materialId: u32,
};
struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) normal: vec3f,
  @location(1) @interpolate(flat) netId: u32,
  @location(2) @interpolate(flat) objectId: u32,
  @location(3) world: vec3f,
};
@vertex fn vs(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  output.world = input.position + draw.offset.xyz;
  output.position = globals.viewProjection * vec4f(output.world, 1.0);
  output.normal = normalize(input.normal);
  output.netId = input.netId;
  output.objectId = input.objectId;
  return output;
}
fn aces(color: vec3f) -> vec3f {
  let a = 2.51;
  let b = 0.03;
  let c = 2.43;
  let d = 0.59;
  let e = 0.14;
  return clamp((color * (a * color + b)) / (color * (c * color + d) + e), vec3f(0), vec3f(1));
}
@fragment fn fs(input: VertexOutput) -> @location(0) vec4f {
  let kind = u32(draw.flags.x);
  let copper = kind == 1u;
  let component = kind == 2u;
  let selected = globals.activeNet != 0u && input.netId == globals.activeNet;
  let selectedComponent = component && globals.selectedFeature != 0u && input.objectId == globals.selectedFeature;
  var base = draw.color.rgb;
  if (selected && copper) {
    if (draw.flags.z < 0.5) {
      let pulse = 0.88 + 0.12 * sin(globals.time * 3.2);
      base = vec3f(0.08, 1.0, 0.2) * pulse;
    }
  } else if (globals.hasHighlight > 0.5 && copper) {
    base = mix(base, vec3f(0.12, 0.14, 0.17), 0.58);
  }
  if (selectedComponent) {
    let pulse = 0.84 + 0.16 * sin(globals.time * 3.6);
    base = mix(base, vec3f(0.15, 0.72, 1.0) * pulse, 0.72);
  }
  if (draw.flags.z > 0.5 && copper && !selected) { discard; }
  let normal = normalize(input.normal);
  let light = normalize(globals.lightDirection.xyz);
  let diffuse = max(dot(normal, light), 0.0);
  let hemi = mix(0.28, 0.62, normal.z * 0.5 + 0.5);
  let roughness = clamp(draw.material.y, 0.05, 1.0);
  let metallic = clamp(draw.material.x, 0.0, 1.0);
  let specular = pow(max(dot(normal, normalize(light + vec3f(0.3, -0.4, 0.85))), 0.0), mix(96.0, 6.0, roughness));
  let shaded = base * (hemi + diffuse * 0.72) + mix(vec3f(0.04), base, metallic) * specular * 0.5;
  var lit = shaded;
  if (draw.flags.w > 0.5) {
    lit = base;
  }
  return vec4f(aces(lit), draw.flags.y);
}
`,_d=`
struct Globals {
  viewProjection: mat4x4f,
  activeNet: u32,
  selectedLayer: u32,
  time: f32,
  hasHighlight: f32,
  selectedFeature: u32,
  padding0: u32,
  padding1: u32,
  padding2: u32,
  lightDirection: vec4f,
};
struct Draw { color: vec4f, material: vec4f, offset: vec4f, flags: vec4f };
@group(0) @binding(0) var<uniform> globals: Globals;
@group(0) @binding(1) var<uniform> draw: Draw;
struct Input {
  @location(0) position: vec3f,
  @location(1) normal: vec3f,
  @location(2) netId: u32,
  @location(3) objectId: u32,
  @location(4) layerId: u32,
  @location(5) materialId: u32,
};
struct Output {
  @builtin(position) position: vec4f,
  @location(0) @interpolate(flat) objectId: u32,
};
@vertex fn vs(input: Input) -> Output {
  var output: Output;
  output.position = globals.viewProjection * vec4f(input.position + draw.offset.xyz, 1.0);
  output.objectId = input.objectId;
  return output;
}
@fragment fn fs(input: Output) -> @location(0) u32 { return input.objectId; }
`,Nd=`
struct Globals {
  viewProjection: mat4x4f,
  activeNet: u32,
  selectedLayer: u32,
  time: f32,
  hasHighlight: f32,
  selectedFeature: u32,
  padding0: u32,
  padding1: u32,
  padding2: u32,
  lightDirection: vec4f,
};
struct Draw { color: vec4f, material: vec4f, offset: vec4f, flags: vec4f };
@group(0) @binding(0) var<uniform> globals: Globals;
@group(0) @binding(1) var<uniform> draw: Draw;
@group(0) @binding(2) var<storage, read> layerOffsets: array<f32>;
struct Input {
  @location(0) unit: vec3f,
  @location(1) normal: vec3f,
  @location(2) radiusMix: f32,
  @location(3) dimensions: vec4f,
  @location(4) span: vec2f,
  @location(5) ids: vec4u,
};
struct Output {
  @builtin(position) position: vec4f,
  @location(0) normal: vec3f,
  @location(1) @interpolate(flat) netId: u32,
  @location(2) @interpolate(flat) objectId: u32,
  @location(3) @interpolate(flat) visible: u32,
};
@vertex fn vs(input: Input) -> Output {
  let radius = mix(input.dimensions.z, input.dimensions.w, input.radiusMix);
  let z0 = input.span.x + layerOffsets[input.ids.z];
  let z1 = input.span.y + layerOffsets[input.ids.w];
  let world = vec3f(
    input.dimensions.x + input.unit.x * radius,
    input.dimensions.y + input.unit.y * radius,
    mix(z0, z1, input.unit.z)
  );
  var output: Output;
  output.position = globals.viewProjection * vec4f(world, 1.0);
  output.normal = input.normal;
  output.netId = input.ids.x;
  output.objectId = input.ids.y;
  output.visible = 0u;
  if (globals.selectedLayer == 0u || (globals.selectedLayer >= input.ids.z && globals.selectedLayer <= input.ids.w)) {
    output.visible = 1u;
  }
  return output;
}
@fragment fn fs(input: Output) -> @location(0) vec4f {
  if (input.visible == 0u) { discard; }
  let selected = globals.activeNet != 0u && input.netId == globals.activeNet;
  var base = draw.color.rgb;
  if (selected) {
    if (draw.flags.z < 0.5) {
      base = vec3f(0.1, 1.0, 0.22) * (0.88 + 0.12 * sin(globals.time * 3.2));
    }
  } else if (globals.hasHighlight > 0.5) {
    base = mix(base, vec3f(0.12, 0.14, 0.17), 0.58);
  }
  if (draw.flags.z > 0.5 && !selected) { discard; }
  let light = normalize(globals.lightDirection.xyz);
  let lit = base * (0.38 + max(dot(normalize(input.normal), light), 0.0) * 0.72);
  return vec4f(lit, 1.0);
}
`,jd=`
struct Globals {
  viewProjection: mat4x4f,
  activeNet: u32,
  selectedLayer: u32,
  time: f32,
  hasHighlight: f32,
  selectedFeature: u32,
  padding0: u32,
  padding1: u32,
  padding2: u32,
  lightDirection: vec4f,
};
struct Draw { color: vec4f, material: vec4f, offset: vec4f, flags: vec4f };
@group(0) @binding(0) var<uniform> globals: Globals;
@group(0) @binding(1) var<uniform> draw: Draw;
@group(0) @binding(2) var<storage, read> layerOffsets: array<f32>;
struct Input {
  @location(0) unit: vec3f,
  @location(1) normal: vec3f,
  @location(2) radiusMix: f32,
  @location(3) dimensions: vec4f,
  @location(4) span: vec2f,
  @location(5) ids: vec4u,
};
struct Output {
  @builtin(position) position: vec4f,
  @location(0) @interpolate(flat) objectId: u32,
  @location(1) @interpolate(flat) visible: u32,
};
@vertex fn vs(input: Input) -> Output {
  let radius = mix(input.dimensions.z, input.dimensions.w, input.radiusMix);
  let world = vec3f(
    input.dimensions.x + input.unit.x * radius,
    input.dimensions.y + input.unit.y * radius,
    mix(input.span.x + layerOffsets[input.ids.z], input.span.y + layerOffsets[input.ids.w], input.unit.z)
  );
  var output: Output;
  output.position = globals.viewProjection * vec4f(world, 1.0);
  output.objectId = input.ids.y;
  output.visible = 0u;
  if (globals.selectedLayer == 0u || (globals.selectedLayer >= input.ids.z && globals.selectedLayer <= input.ids.w)) {
    output.visible = 1u;
  }
  return output;
}
@fragment fn fs(input: Output) -> @location(0) u32 {
  if (input.visible == 0u) { discard; }
  return input.objectId;
}
`,Ta=class e{static async create(t){if(!navigator.gpu)throw new Error("WebGPU is unavailable in this browser");let a=await navigator.gpu.requestAdapter({powerPreference:"high-performance"});if(!a)throw new Error("No WebGPU adapter is available");let s=await a.requestDevice();return new e(t,s)}constructor(t,a){this.canvas=t,this.device=a,a.addEventListener("uncapturederror",r=>{console.error(`Uncaptured WebGPU error: ${r.error?.message||r.error}`)}),a.lost.then(r=>{console.error(`WebGPU device lost: ${r.reason}`,r.message)}),this.context=t.getContext("webgpu"),this.format=navigator.gpu.getPreferredCanvasFormat(),this.context.configure({device:a,format:this.format,alphaMode:"opaque"}),this.entries=[],this.barrels=null,this.globalBuffer=a.createBuffer({size:112,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),this.layerOffsetBuffer=a.createBuffer({size:1024,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),this.bindGroupLayout=a.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}},{binding:1,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}},{binding:2,visibility:GPUShaderStage.VERTEX,buffer:{type:"read-only-storage"}}]});let s=a.createPipelineLayout({bindGroupLayouts:[this.bindGroupLayout]}),n=[{arrayStride:40,attributes:[{shaderLocation:0,offset:0,format:"float32x3"},{shaderLocation:1,offset:12,format:"float32x3"},{shaderLocation:2,offset:24,format:"uint32"},{shaderLocation:3,offset:28,format:"uint32"},{shaderLocation:4,offset:32,format:"uint32"},{shaderLocation:5,offset:36,format:"uint32"}]}];this.pipeline=this.makePipeline(s,Sd,this.format,n,"main"),this.pickPipeline=this.makePipeline(s,_d,"r32uint",n,"pick"),this.barrelPipeline=this.makeBarrelPipeline(s,Nd,this.format,"barrel"),this.barrelPickPipeline=this.makeBarrelPipeline(s,jd,"r32uint","barrel-pick"),this.depth=null,this.pickTexture=null,this.pickSerial=Promise.resolve(),this.bundleCache=new Map,this.globalScratch=new ArrayBuffer(112),this.globalScratchF32=new Float32Array(this.globalScratch),this.globalScratchView=new DataView(this.globalScratch),this.drawScratch=new Float32Array(256/4),this.barrelDrawScratch=new Float32Array(256/4),this.nextEntryId=1}makePipeline(t,a,s,n,r){let i=this.createShaderModule(a,r);return this.device.createRenderPipeline({layout:t,vertex:{module:i,entryPoint:"vs",buffers:n},fragment:{module:i,entryPoint:"fs",targets:[{format:s,blend:s==="r32uint"?void 0:{color:{srcFactor:"src-alpha",dstFactor:"one-minus-src-alpha"},alpha:{srcFactor:"one",dstFactor:"one-minus-src-alpha"}}}]},primitive:{topology:"triangle-list",cullMode:"none"},depthStencil:{format:"depth24plus",depthWriteEnabled:!0,depthCompare:"less"},multisample:{count:1}})}makeBarrelPipeline(t,a,s,n){let r=this.createShaderModule(a,n);return this.device.createRenderPipeline({layout:t,vertex:{module:r,entryPoint:"vs",buffers:[{arrayStride:28,attributes:[{shaderLocation:0,offset:0,format:"float32x3"},{shaderLocation:1,offset:12,format:"float32x3"},{shaderLocation:2,offset:24,format:"float32"}]},{arrayStride:40,stepMode:"instance",attributes:[{shaderLocation:3,offset:0,format:"float32x4"},{shaderLocation:4,offset:16,format:"float32x2"},{shaderLocation:5,offset:24,format:"uint32x4"}]}]},fragment:{module:r,entryPoint:"fs",targets:[{format:s,blend:s==="r32uint"?void 0:{color:{srcFactor:"src-alpha",dstFactor:"one-minus-src-alpha"},alpha:{srcFactor:"one",dstFactor:"one-minus-src-alpha"}}}]},primitive:{topology:"triangle-list",cullMode:"none"},depthStencil:{format:"depth24plus",depthWriteEnabled:!0,depthCompare:"less"}})}createShaderModule(t,a){let s=this.device.createShaderModule({label:`pcb-${a}`,code:t});return typeof s.getCompilationInfo=="function"&&s.getCompilationInfo().then(n=>{let r=[...n.messages||[]];if(r.length){console.groupCollapsed(`WebGPU shader compilation info: pcb-${a}`);for(let i of r)console[i.type==="error"?"error":"warn"](`${i.type} ${i.lineNum}:${i.linePos} ${i.message}`);console.groupEnd()}}),s}resize(){let t=Math.min(devicePixelRatio||1,2),a=Math.max(1,Math.floor(this.canvas.clientWidth*t)),s=Math.max(1,Math.floor(this.canvas.clientHeight*t));this.canvas.width===a&&this.canvas.height===s||(this.canvas.width=a,this.canvas.height=s,this.depth?.destroy(),this.pickTexture?.destroy(),this.depth=this.device.createTexture({size:[a,s],format:"depth24plus",usage:GPUTextureUsage.RENDER_ATTACHMENT}),this.pickTexture=this.device.createTexture({size:[a,s],format:"r32uint",usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.COPY_SRC}))}addPrimitive(t,a){let s=t.position.length/3,n=new ArrayBuffer(s*40),r=new Float32Array(n),i=new Uint32Array(n);for(let y=0;y<s;y+=1){let f=y*10,d=y*3;r[f]=t.position[d],r[f+1]=t.position[d+1],r[f+2]=t.position[d+2],r[f+3]=t.normal[d],r[f+4]=t.normal[d+1],r[f+5]=t.normal[d+2],i[f+6]=t.netId[y]||0,i[f+7]=t.objectFeatureId[y]||0,i[f+8]=a.layerId||0,i[f+9]=a.materialId||0}let o=this.device.createBuffer({size:n.byteLength,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST});this.device.queue.writeBuffer(o,0,n);let c=t.indices instanceof Uint32Array?t.indices:new Uint32Array(t.indices),b=this.device.createBuffer({size:c.byteLength,usage:GPUBufferUsage.INDEX|GPUBufferUsage.COPY_DST});this.device.queue.writeBuffer(b,0,c);let g=this.device.createBuffer({size:256,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),h=this.device.createBindGroup({layout:this.bindGroupLayout,entries:[{binding:0,resource:{buffer:this.globalBuffer}},{binding:1,resource:{buffer:g}},{binding:2,resource:{buffer:this.layerOffsetBuffer}}]}),w={...a,bounds:t.bounds||a.bounds||null,id:this.nextEntryId++,vertexBuffer:o,indexBuffer:b,indexCount:c.length,drawBuffer:g,bindGroup:h};return this.entries.push(w),this.bundleCache.clear(),w}removeEntries(t){if(!t?.length)return;let a=new Set(t.map(s=>s.id));for(let s of t)s.vertexBuffer?.destroy?.(),s.indexBuffer?.destroy?.(),s.drawBuffer?.destroy?.();this.entries=this.entries.filter(s=>!a.has(s.id)),this.bundleCache.clear()}dispose(){this.removeEntries(this.entries),this.barrels&&(this.barrels.vertexBuffer?.destroy?.(),this.barrels.indexBuffer?.destroy?.(),this.barrels.instanceBuffer?.destroy?.(),this.barrels.drawBuffer?.destroy?.(),this.barrels=null),this.depth?.destroy(),this.pickTexture?.destroy(),this.depth=null,this.pickTexture=null,this.bundleCache.clear()}setBarrels(t){if(!t?.length)return;let a=20,s=[],n=[];for(let f of[0,1]){let d=s.length/7;for(let m=0;m<a;m+=1){let l=Math.PI*2*m/a,u=Math.cos(l),p=Math.sin(l);for(let v of[0,1])s.push(u,p,v,f?-u:u,f?-p:p,0,f)}for(let m=0;m<a;m+=1){let l=(m+1)%a,u=d+m*2,p=d+l*2;n.push(u,p,p+1,u,p+1,u+1)}}let r=new Float32Array(s),i=new Uint16Array(n),o=new ArrayBuffer(t.length*40),c=new DataView(o);t.forEach((f,d)=>{let m=d*40;c.setFloat32(m,f.centerMm[0]/1e3,!0),c.setFloat32(m+4,-f.centerMm[1]/1e3,!0),c.setFloat32(m+8,Math.min(f.drillWidthMm,f.drillHeightMm)/2e3,!0),c.setFloat32(m+12,Math.max(f.outerWidthMm,f.outerHeightMm)/2e3,!0),c.setFloat32(m+16,f.startZMm/1e3,!0),c.setFloat32(m+20,f.endZMm/1e3,!0),c.setUint32(m+24,f.netId||0,!0),c.setUint32(m+28,f.objectFeatureId||0,!0),c.setUint32(m+32,f.startLayerId||0,!0),c.setUint32(m+36,f.endLayerId||0,!0)});let b=this.device.createBuffer({size:r.byteLength,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST}),g=this.device.createBuffer({size:i.byteLength,usage:GPUBufferUsage.INDEX|GPUBufferUsage.COPY_DST}),h=this.device.createBuffer({size:o.byteLength,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST});this.device.queue.writeBuffer(b,0,r),this.device.queue.writeBuffer(g,0,i),this.device.queue.writeBuffer(h,0,o);let w=this.device.createBuffer({size:256,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),y=this.device.createBindGroup({layout:this.bindGroupLayout,entries:[{binding:0,resource:{buffer:this.globalBuffer}},{binding:1,resource:{buffer:w}},{binding:2,resource:{buffer:this.layerOffsetBuffer}}]});this.barrels={records:t,vertexBuffer:b,indexBuffer:g,instanceBuffer:h,indexCount:i.length,instanceCount:t.length,drawBuffer:w,bindGroup:y}}render({panels:t,activeNetId:a,selectedFeatureId:s,time:n,layerOffsets:r,visibleLayers:i,showBoard:o,showComponents:c,componentOpacity:b,boardOpacity:g,isolateNet:h,compareMode:w=!1,compareOffsets:y=new Map,layerAlphas:f=null,visibleTileIds:d=null}){this.resize(),this.device.queue.writeBuffer(this.layerOffsetBuffer,0,r);let m=this.context.getCurrentTexture().createView();t.forEach((l,u)=>{let p=this.device.createCommandEncoder(),v=p.beginRenderPass({colorAttachments:[{view:m,clearValue:{r:.91,g:.93,b:.94,a:1},loadOp:u===0?"clear":"load",storeOp:"store"}],depthStencilAttachment:{view:this.depth.createView(),depthClearValue:1,depthLoadOp:"clear",depthStoreOp:"store"}}),T=Hn(l.viewport,this.canvas.width,this.canvas.height);v.setViewport(T.x,T.y,T.width,T.height,0,1),v.setScissorRect(T.x,T.y,T.width,T.height),this.writeGlobals(l.matrix,a,l.layerId,n,s);let I=this.entries.filter(k=>this.visible(k,l.layerId,i,o,c,b,w,d));for(let k of I)this.writeDraw(k,a,b,g,h,w,y.get(k.layerId),f?.get(k.layerId)??1);if(I.length>64)v.executeBundles([this.renderBundle(I,l.layerId)]);else{v.setPipeline(this.pipeline);for(let k of I)v.setBindGroup(0,k.bindGroup),v.setVertexBuffer(0,k.vertexBuffer),v.setIndexBuffer(k.indexBuffer,"uint32"),v.drawIndexed(k.indexCount)}!w&&this.barrels&&(l.layerId===0||i.has(l.layerId))&&(this.writeBarrelDraw(h),v.setPipeline(this.barrelPipeline),v.setBindGroup(0,this.barrels.bindGroup),v.setVertexBuffer(0,this.barrels.vertexBuffer),v.setVertexBuffer(1,this.barrels.instanceBuffer),v.setIndexBuffer(this.barrels.indexBuffer,"uint16"),v.drawIndexed(this.barrels.indexCount,this.barrels.instanceCount)),v.end(),this.device.queue.submit([p.finish()])})}visible(t,a,s,n,r,i,o=!1,c=null){return t.kind==="board"&&t.boardRole==="pad"||!o&&t.kind==="copper"&&c&&!c.has(t.tileId)?!1:o?t.kind==="copper"&&s.has(t.layerId):t.kind==="board"?a===0&&n:t.kind==="component"?a===0&&r&&i>.001:a?t.layerId===a:s.has(t.layerId)}writeGlobals(t,a,s,n,r=0){let i=this.globalScratch,o=this.globalScratchF32;o.fill(0),o.set(t,0);let c=this.globalScratchView;c.setUint32(64,a||0,!0),c.setUint32(68,s||0,!0),c.setFloat32(72,n,!0),c.setFloat32(76,a?1:0,!0),c.setUint32(80,r||0,!0),o.set([.35,-.5,.8,0],24),this.device.queue.writeBuffer(this.globalBuffer,0,i)}writeDraw(t,a,s,n=1,r=!1,i=!1,o=null,c=1){let b=this.drawScratch;b.fill(0);let g=t.kind==="copper"?t.color:t.material.baseColor;b.set(g,0),b.set([t.material.metallic||0,t.material.roughness??.72,0,0],4);let h=Od(t);b.set([o?.[0]||0,o?.[1]||0,(i?-(t.baseZ||0):t.layerOffset||0)+h,0],8);let w=Number.isFinite(g?.[3])?g[3]:1,y=t.kind==="component"?s:t.kind==="board"?n*Fd(t,w):c,f=t.kind==="copper"?1:t.kind==="component"?2:0;b.set([f,y,r?1:0,i?1:0],12),this.device.queue.writeBuffer(t.drawBuffer,0,b)}writeBarrelDraw(t=!1){let a=this.barrelDrawScratch;a.fill(0),a.set([.55,.35,.16,.78],0),a.set([.75,.32,0,0],4),a.set([1,1,t?1:0,0],12),this.device.queue.writeBuffer(this.barrels.drawBuffer,0,a)}renderBundle(t,a){let s=`${a}:${t.map(o=>o.id).join(",")}`,n=this.bundleCache.get(s);if(n)return n;let r=this.device.createRenderBundleEncoder({colorFormats:[this.format],depthStencilFormat:"depth24plus"});r.setPipeline(this.pipeline);for(let o of t)r.setBindGroup(0,o.bindGroup),r.setVertexBuffer(0,o.vertexBuffer),r.setIndexBuffer(o.indexBuffer,"uint32"),r.drawIndexed(o.indexCount);let i=r.finish();return this.bundleCache.set(s,i),this.bundleCache.size>32&&this.bundleCache.delete(this.bundleCache.keys().next().value),i}pick(t,a,s,n){let r=this.pickSerial.then(()=>this.performPick(t,a,s,n));return this.pickSerial=r.catch(()=>0),r}async performPick(t,a,s,n){this.resize();let r=Math.max(0,Math.min(this.canvas.width-1,Math.floor(a))),i=Math.max(0,Math.min(this.canvas.height-1,Math.floor(s)));this.writeGlobals(t.matrix,n.activeNetId,t.layerId,performance.now()/1e3,n.selectedFeatureId),this.device.queue.writeBuffer(this.layerOffsetBuffer,0,n.layerOffsets);let o=this.device.createCommandEncoder(),c=o.beginRenderPass({colorAttachments:[{view:this.pickTexture.createView(),clearValue:{r:0,g:0,b:0,a:0},loadOp:"clear",storeOp:"store"}],depthStencilAttachment:{view:this.depth.createView(),depthClearValue:1,depthLoadOp:"clear",depthStoreOp:"store"}}),b=Hn(t.viewport,this.canvas.width,this.canvas.height);c.setViewport(b.x,b.y,b.width,b.height,0,1),c.setScissorRect(b.x,b.y,b.width,b.height),c.setPipeline(this.pickPipeline);for(let h of this.entries)this.visible(h,t.layerId,n.visibleLayers,n.showBoard,n.showComponents,n.componentOpacity,n.compareMode,n.visibleTileIds)&&h.kind!=="board"&&(this.writeDraw(h,n.activeNetId,n.componentOpacity,n.boardOpacity,n.isolateNet,n.compareMode,n.compareOffsets?.get(h.layerId)),c.setBindGroup(0,h.bindGroup),c.setVertexBuffer(0,h.vertexBuffer),c.setIndexBuffer(h.indexBuffer,"uint32"),c.drawIndexed(h.indexCount));!n.compareMode&&this.barrels&&(this.writeBarrelDraw(n.isolateNet),c.setPipeline(this.barrelPickPipeline),c.setBindGroup(0,this.barrels.bindGroup),c.setVertexBuffer(0,this.barrels.vertexBuffer),c.setVertexBuffer(1,this.barrels.instanceBuffer),c.setIndexBuffer(this.barrels.indexBuffer,"uint16"),c.drawIndexed(this.barrels.indexCount,this.barrels.instanceCount)),c.end();let g=this.device.createBuffer({label:"pick-readback",size:256,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});o.copyTextureToBuffer({texture:this.pickTexture,origin:{x:r,y:i}},{buffer:g,bytesPerRow:256},{width:1,height:1}),this.device.queue.submit([o.finish()]);try{await g.mapAsync(GPUMapMode.READ);let h=new DataView(g.getMappedRange()).getUint32(0,!0);return g.unmap(),h}finally{g.mapState==="mapped"&&g.unmap(),g.destroy()}}};function Fd(e,t){return e.kind!=="board"||e.boardRole==="substrate"?1:e.boardRole==="soldermask"?Math.min(t,.72):e.boardRole==="silkscreen"?Math.min(t,.92):t}function Od(e){if(e.kind!=="board"||e.boardRole!=="soldermask"&&e.boardRole!=="silkscreen")return 0;let t=e.bounds,s=(t?(t[2]+t[5])*.5:0)<0?-1:1,n=e.boardRole==="silkscreen"?35e-6:18e-6;return s*n}function Hn(e,t,a){let s=Math.max(0,Math.min(t-1,Math.floor(e.x))),n=Math.max(0,Math.min(a-1,Math.floor(e.y)));return{x:s,y:n,width:Math.max(1,Math.min(t-s,Math.floor(e.width))),height:Math.max(1,Math.min(a-n,Math.floor(e.height)))}}var Cd=`
struct Globals {
  camera: vec4f,
  viewport: vec2f,
  activeNet: u32,
  _pad: u32,
};
struct Page {
  originSize: vec4f,
  flags: vec4f,
};
@group(0) @binding(0) var<uniform> globals: Globals;
@group(0) @binding(1) var<uniform> page: Page;
@group(0) @binding(2) var pageSampler: sampler;
@group(0) @binding(3) var pageTexture: texture_2d<f32>;

struct VertexOut {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
};

@vertex fn vs(@builtin(vertex_index) index: u32) -> VertexOut {
  var positions = array<vec2f, 6>(
    vec2f(0.0, 0.0), vec2f(1.0, 0.0), vec2f(0.0, 1.0),
    vec2f(0.0, 1.0), vec2f(1.0, 0.0), vec2f(1.0, 1.0)
  );
  let uv = positions[index];
  let world = page.originSize.xy + uv * page.originSize.zw;
  let halfViewport = globals.viewport * globals.camera.z * 0.5;
  let clip = vec2f(
    (world.x - globals.camera.x) / halfViewport.x,
    -(world.y - globals.camera.y) / halfViewport.y
  );
  var out: VertexOut;
  out.position = vec4f(clip, 0.0, 1.0);
  out.uv = uv;
  return out;
}

@fragment fn fs(input: VertexOut) -> @location(0) vec4f {
  let sampled = textureSample(pageTexture, pageSampler, input.uv);
  let edge = min(min(input.uv.x, 1.0 - input.uv.x), min(input.uv.y, 1.0 - input.uv.y));
  let selected = page.flags.x > 0.5;
  let containsNet = page.flags.y > 0.5;
  let hasActiveNet = page.flags.z > 0.5;
  let nativeDetail = page.flags.w > 0.5;
  if (edge < 0.006) {
    if (containsNet) { return vec4f(0.12, 0.92, 0.35, 1.0); }
    if (selected) { return vec4f(0.12, 0.45, 0.95, 1.0); }
    return vec4f(0.28, 0.32, 0.39, 1.0);
  }
  if (nativeDetail) {
    return vec4f(0.925, 0.918, 0.865, 1.0);
  }
  var dim = 1.0;
  if (hasActiveNet) {
    dim = 0.42;
    if (containsNet) {
      dim = 1.0;
    }
  }
  return vec4f(sampled.rgb * dim, 1.0);
}`,Bd=`
struct Globals {
  camera: vec4f,
  viewport: vec2f,
  activeNet: u32,
  _pad: u32,
};
@group(0) @binding(0) var<uniform> globals: Globals;
struct Out { @builtin(position) position: vec4f };
@vertex fn vs(@location(0) world: vec2f) -> Out {
  let halfViewport = globals.viewport * globals.camera.z * 0.5;
  let clip = vec2f(
    (world.x - globals.camera.x) / halfViewport.x,
    -(world.y - globals.camera.y) / halfViewport.y
  );
  var out: Out;
  out.position = vec4f(clip, 0.4, 1.0);
  return out;
}
@fragment fn fs() -> @location(0) vec4f {
  return vec4f(0.22, 0.48, 0.82, 0.82);
}`,Dd=`
struct Globals {
  camera: vec4f,
  viewport: vec2f,
  activeNet: u32,
  _pad: u32,
};
@group(0) @binding(0) var<uniform> globals: Globals;
struct Out { @builtin(position) position: vec4f };
@vertex fn vs(@location(0) world: vec2f) -> Out {
  let halfViewport = globals.viewport * globals.camera.z * 0.5;
  let clip = vec2f(
    (world.x - globals.camera.x) / halfViewport.x,
    -(world.y - globals.camera.y) / halfViewport.y
  );
  var out: Out;
  out.position = vec4f(clip, 0.2, 1.0);
  return out;
}
@fragment fn fs() -> @location(0) vec4f {
  return vec4f(0.08, 1.0, 0.27, 0.96);
}`,Pd=`
struct Globals {
  camera: vec4f,
  viewport: vec2f,
  activeNet: u32,
  _pad: u32,
};
@group(0) @binding(0) var<uniform> globals: Globals;
struct Out {
  @builtin(position) position: vec4f,
  @location(0) distance: f32,
  @location(1) kind: f32,
};
@vertex fn vs(@location(0) world: vec2f, @location(1) flow: vec2f) -> Out {
  let halfViewport = globals.viewport * globals.camera.z * 0.5;
  let clip = vec2f(
    (world.x - globals.camera.x) / halfViewport.x,
    -(world.y - globals.camera.y) / halfViewport.y
  );
  var out: Out;
  out.position = vec4f(clip, 0.05, 1.0);
  out.distance = flow.x;
  out.kind = flow.y;
  return out;
}
@fragment fn fs(input: Out) -> @location(0) vec4f {
  let selected = input.kind > 1.5;
  let intersheet = input.kind > 0.5 && !selected;
  var speed = 0.62;
  var period = 18.0;
  if (intersheet || selected) {
    speed = 0.88;
    period = 28.0;
  }
  let phase = fract(input.distance / period - globals.camera.w * speed);
  let dash = smoothstep(0.04, 0.13, phase) * (1.0 - smoothstep(0.38, 0.52, phase));
  let intraBase = vec3f(0.94, 0.48, 0.12);
  let intraDash = vec3f(1.0, 0.86, 0.24);
  let interBase = vec3f(0.10, 0.46, 0.92);
  let interDash = vec3f(0.42, 0.82, 1.0);
  let selectedBase = vec3f(0.08, 1.0, 0.34);
  let selectedDash = vec3f(0.86, 1.0, 0.72);
  var base = intraBase;
  var bright = intraDash;
  if (intersheet) {
    base = interBase;
    bright = interDash;
  }
  if (selected) {
    base = selectedBase;
    bright = selectedDash;
  }
  let color = base + (bright - base) * dash;
  var alpha = 0.24 + dash * 0.54;
  if (intersheet) {
    alpha = 0.30 + dash * 0.54;
  }
  if (selected) {
    alpha = 0.44 + dash * 0.50;
  }
  return vec4f(color, alpha);
}`,Ud=`
struct Globals {
  camera: vec4f,
  viewport: vec2f,
  activeNet: u32,
  _pad: u32,
};
@group(0) @binding(0) var<uniform> globals: Globals;
struct Out {
  @builtin(position) position: vec4f,
  @location(0) color: vec4f,
};
@vertex fn vs(@location(0) world: vec2f, @location(1) color: vec4f) -> Out {
  let halfViewport = globals.viewport * globals.camera.z * 0.5;
  let clip = vec2f(
    (world.x - globals.camera.x) / halfViewport.x,
    -(world.y - globals.camera.y) / halfViewport.y
  );
  var out: Out;
  out.position = vec4f(clip, 0.1, 1.0);
  out.color = color;
  return out;
}
@fragment fn fs(input: Out) -> @location(0) vec4f {
  return input.color;
}`,Ld=`
struct Globals {
  camera: vec4f,
  viewport: vec2f,
  activeNet: u32,
  _pad: u32,
};
struct ImageQuad {
  originSize: vec4f,
  flags: vec4f,
};
@group(0) @binding(0) var<uniform> globals: Globals;
@group(0) @binding(1) var<uniform> imageQuad: ImageQuad;
@group(0) @binding(2) var imageSampler: sampler;
@group(0) @binding(3) var imageTexture: texture_2d<f32>;

struct Out {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
};

@vertex fn vs(@builtin(vertex_index) index: u32) -> Out {
  var positions = array<vec2f, 6>(
    vec2f(0.0, 0.0), vec2f(1.0, 0.0), vec2f(0.0, 1.0),
    vec2f(0.0, 1.0), vec2f(1.0, 0.0), vec2f(1.0, 1.0)
  );
  let uv = positions[index];
  let world = imageQuad.originSize.xy + uv * imageQuad.originSize.zw;
  let halfViewport = globals.viewport * globals.camera.z * 0.5;
  let clip = vec2f(
    (world.x - globals.camera.x) / halfViewport.x,
    -(world.y - globals.camera.y) / halfViewport.y
  );
  var out: Out;
  out.position = vec4f(clip, 0.08, 1.0);
  out.uv = uv;
  return out;
}

@fragment fn fs(input: Out) -> @location(0) vec4f {
  return textureSample(imageTexture, imageSampler, input.uv);
}`,Kd=`
struct Globals {
  camera: vec4f,
  viewport: vec2f,
  activeNet: u32,
  _pad: u32,
};
@group(0) @binding(0) var<uniform> globals: Globals;
struct Out {
  @builtin(position) position: vec4f,
  @location(0) featureId: u32,
};
@vertex fn vs(@location(0) world: vec2f, @location(1) featureId: u32) -> Out {
  let halfViewport = globals.viewport * globals.camera.z * 0.5;
  let clip = vec2f(
    (world.x - globals.camera.x) / halfViewport.x,
    -(world.y - globals.camera.y) / halfViewport.y
  );
  var out: Out;
  out.position = vec4f(clip, 0.0, 1.0);
  out.featureId = featureId;
  return out;
}
@fragment fn fs(input: Out) -> @location(0) u32 {
  return input.featureId;
}`,Gd=6.2,Vd=4.6,zd=3.8,Ra=4*1024*1024,Xd=Math.floor(Ra/6),Wn=Xd*6,Ea=512*1024,Jn=512*1024,Yn=96,qd=96,Hd=18,$n=96*1024*1024,Wd=2,Ma=class e{static async create(t,a){if(!navigator.gpu)throw new Error("WebGPU is unavailable in this browser");let s=await navigator.gpu.requestAdapter({powerPreference:"high-performance"});if(!s)throw new Error("No WebGPU adapter is available");let n=await s.requestDevice(),r=await fetch(a,{cache:"default"});if(!r.ok)throw new Error(`Failed to load schematic manifest: ${r.status}`);let i=await r.json();if(!["prism.schematic_world_a0","prism.schematic_vector_a0"].includes(i.schema))throw new Error(`Unsupported schematic scene schema: ${i.schema}`);let o=i.featureTable||i.features,c=await fetch(new URL(o,a),{cache:"default"});if(!c.ok)throw new Error(`Failed to load schematic features: ${c.status}`);let b=Yd(await c.json());return new e(t,n,a,i,b)}constructor(t,a,s,n,r){this.canvas=t,this.device=a,this.manifestUrl=s,this.manifest=n,this.isNativeScene=n.schema==="prism.schematic_vector_a0",this.pages=n.pages||[],this.featuresByPage=r,this.featuresById=new Map;for(let y of Object.values(r))for(let f of y)this.featuresById.set(Number(f.id),f);this.context=t.getContext("webgpu"),this.format=navigator.gpu.getPreferredCanvasFormat(),this.context.configure({device:a,format:this.format,alphaMode:"opaque"}),this.flowCanvas=null,this.flowContext=null,this.globalBuffer=a.createBuffer({size:48,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),this.bindGroupLayout=a.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}},{binding:1,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}},{binding:2,visibility:GPUShaderStage.FRAGMENT,sampler:{type:"filtering"}},{binding:3,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:"float"}}]});let i=a.createShaderModule({code:Cd});this.pagePipeline=a.createRenderPipeline({layout:a.createPipelineLayout({bindGroupLayouts:[this.bindGroupLayout]}),vertex:{module:i,entryPoint:"vs"},fragment:{module:i,entryPoint:"fs",targets:[{format:this.format}]},primitive:{topology:"triangle-list"}}),this.edgeLayout=a.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}}]});let o=a.createShaderModule({code:Bd});this.edgePipeline=a.createRenderPipeline({layout:a.createPipelineLayout({bindGroupLayouts:[this.edgeLayout]}),vertex:{module:o,entryPoint:"vs",buffers:[{arrayStride:8,attributes:[{shaderLocation:0,offset:0,format:"float32x2"}]}]},fragment:{module:o,entryPoint:"fs",targets:[{format:this.format,blend:{color:{srcFactor:"src-alpha",dstFactor:"one-minus-src-alpha"},alpha:{srcFactor:"one",dstFactor:"one-minus-src-alpha"}}}]},primitive:{topology:"line-list"}}),this.edgeBindGroup=a.createBindGroup({layout:this.edgeLayout,entries:[{binding:0,resource:{buffer:this.globalBuffer}}]});let c=a.createShaderModule({code:Dd});this.highlightPipeline=a.createRenderPipeline({layout:a.createPipelineLayout({bindGroupLayouts:[this.edgeLayout]}),vertex:{module:c,entryPoint:"vs",buffers:[{arrayStride:8,attributes:[{shaderLocation:0,offset:0,format:"float32x2"}]}]},fragment:{module:c,entryPoint:"fs",targets:[{format:this.format,blend:{color:{srcFactor:"src-alpha",dstFactor:"one-minus-src-alpha"},alpha:{srcFactor:"one",dstFactor:"one-minus-src-alpha"}}}]},primitive:{topology:"line-list"}}),this.highlightBufferSize=4*1024*1024,this.highlightBuffer=a.createBuffer({size:this.highlightBufferSize,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST});let b=a.createShaderModule({code:Pd});this.netFlowPipeline=a.createRenderPipeline({layout:a.createPipelineLayout({bindGroupLayouts:[this.edgeLayout]}),vertex:{module:b,entryPoint:"vs",buffers:[{arrayStride:16,attributes:[{shaderLocation:0,offset:0,format:"float32x2"},{shaderLocation:1,offset:8,format:"float32x2"}]}]},fragment:{module:b,entryPoint:"fs",targets:[{format:this.format,blend:{color:{srcFactor:"src-alpha",dstFactor:"one-minus-src-alpha"},alpha:{srcFactor:"one",dstFactor:"one-minus-src-alpha"}}}]},primitive:{topology:"triangle-list"}}),this.netFlowBuffer=a.createBuffer({size:Jn*4,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST}),this.globalUniformScratch=new Float32Array(12),this.pageUniformScratch=new Float32Array(8),this.imageUniformScratch=new Float32Array(8),this.vectorScratch=new Float32Array(Ra),this.highlightScratch=new Float32Array(this.highlightBufferSize/4),this.netFlowScratch=new Float32Array(Jn),this.netTrackingCache=null,this.selectedIntrasheetLinkIndex=-1,this.truncatedHighlightCount=0,this.truncatedVectorCount=0,this.frameSerial=0,this.querySerial=0;let g=a.createShaderModule({code:Ud});this.vectorPipeline=a.createRenderPipeline({layout:a.createPipelineLayout({bindGroupLayouts:[this.edgeLayout]}),vertex:{module:g,entryPoint:"vs",buffers:[{arrayStride:24,attributes:[{shaderLocation:0,offset:0,format:"float32x2"},{shaderLocation:1,offset:8,format:"float32x4"}]}]},fragment:{module:g,entryPoint:"fs",targets:[{format:this.format,blend:{color:{srcFactor:"src-alpha",dstFactor:"one-minus-src-alpha"},alpha:{srcFactor:"one",dstFactor:"one-minus-src-alpha"}}}]},primitive:{topology:"triangle-list"}}),this.vectorBuffer=a.createBuffer({size:Ra*4,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST}),this.vectorBuffers=[this.vectorBuffer];let h=a.createShaderModule({code:Ld});this.imagePipeline=a.createRenderPipeline({layout:a.createPipelineLayout({bindGroupLayouts:[this.bindGroupLayout]}),vertex:{module:h,entryPoint:"vs"},fragment:{module:h,entryPoint:"fs",targets:[{format:this.format,blend:{color:{srcFactor:"src-alpha",dstFactor:"one-minus-src-alpha"},alpha:{srcFactor:"one",dstFactor:"one-minus-src-alpha"}}}]},primitive:{topology:"triangle-list"}});let w=a.createShaderModule({code:Kd});this.pickPipeline=a.createRenderPipeline({layout:a.createPipelineLayout({bindGroupLayouts:[this.edgeLayout]}),vertex:{module:w,entryPoint:"vs",buffers:[{arrayStride:12,attributes:[{shaderLocation:0,offset:0,format:"float32x2"},{shaderLocation:1,offset:8,format:"uint32"}]}]},fragment:{module:w,entryPoint:"fs",targets:[{format:"r32uint"}]},primitive:{topology:"triangle-list"}}),this.pickVertexBuffer=a.createBuffer({size:Ea*12,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST}),this.pickReadBuffer=a.createBuffer({size:256,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}),this.pickTexture=null,this.pickTextureSize=[0,0],this.pickPending=!1,this.vectorChunks=new Map,this.failedVectorChunks=new Map,this.nativeDetailState=new Map,this.domDetailPageIds=new Set,this.nativeDetailThresholds=new Map,this.residentVectorBytes=0,this.sampler=a.createSampler({magFilter:"linear",minFilter:"linear",mipmapFilter:"linear"}),this.placeholder=this.createSolidTexture([245,247,249,255]),this.pageResources=new Map,this.imageResources=new Map,this.loading=new Map,this.selectedPageId="",this.selectedFeatureId=0,this.activeNetUid="",this.showHierarchy=!0,this.downloadedBytes=0,this.world=n.worldBoundsMm,this.center=[(this.world.minX+this.world.maxX)/2,(this.world.minY+this.world.maxY)/2],this.scale=Math.max((this.world.maxX-this.world.minX)/900,(this.world.maxY-this.world.minY)/650,.1)*1.16,this.edgeBuffer=this.createEdgeBuffer();for(let y of this.pages)this.createPageResource(y)}createSolidTexture(t){let a=this.device.createTexture({size:[1,1],format:"rgba8unorm-srgb",usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST});return this.device.queue.writeTexture({texture:a},new Uint8Array(t),{bytesPerRow:4},[1,1]),a}createPageResource(t){let a=this.device.createBuffer({size:32,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),s={page:t,uniform:a,texture:this.placeholder,textureWidth:0,svgBlob:null,bindGroup:null};this.pageResources.set(t.id,s),this.updateBindGroup(s)}createImageResource(t){let a=this.device.createBuffer({size:32,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),s={path:t,uniform:a,texture:this.placeholder,loaded:!1,bindGroup:null};return this.imageResources.set(t,s),this.updateBindGroup(s),s}updateBindGroup(t){t.bindGroup=this.device.createBindGroup({layout:this.bindGroupLayout,entries:[{binding:0,resource:{buffer:this.globalBuffer}},{binding:1,resource:{buffer:t.uniform}},{binding:2,resource:this.sampler},{binding:3,resource:t.texture.createView()}]})}async loadImageTexture(t){let a=this.imageResources.get(t)||this.createImageResource(t);if(a.loaded)return a;let s=`image:${t}`;if(this.loading.has(s))return this.loading.get(s);let n=(async()=>{try{let r=await fetch(new URL(t,this.manifestUrl),{cache:"default"});if(!r.ok)throw new Error(`Failed to load schematic image ${t}: ${r.status}`);let i=await r.blob(),o=await createImageBitmap(i),c=this.device.createTexture({size:[o.width,o.height],format:"rgba8unorm-srgb",usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST|GPUTextureUsage.RENDER_ATTACHMENT});this.device.queue.copyExternalImageToTexture({source:o},{texture:c},[o.width,o.height]),o.close(),a.texture!==this.placeholder&&a.texture.destroy(),a.texture=c,a.loaded=!0,this.updateBindGroup(a)}finally{this.loading.delete(s)}return a})();return this.loading.set(s,n),n}createEdgeBuffer(){let t=new Map(this.pages.map(r=>[r.id,r])),a=[];for(let r of this.manifest.edges||[]){let i=t.get(r.source),o=t.get(r.target);!i||!o||a.push(i.worldX+i.widthMm/2,i.worldY+i.heightMm,o.worldX+o.widthMm/2,o.worldY)}let s=new Float32Array(a);if(!s.length)return null;let n=this.device.createBuffer({size:s.byteLength,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST});return this.device.queue.writeBuffer(n,0,s),{buffer:n,count:s.length/2}}resize(){let t=Math.min(devicePixelRatio||1,2),a=Math.max(1,Math.floor(this.canvas.clientWidth*t)),s=Math.max(1,Math.floor(this.canvas.clientHeight*t));(this.canvas.width!==a||this.canvas.height!==s)&&(this.canvas.width=a,this.canvas.height=s),this.flowCanvas&&(this.flowCanvas.width!==a||this.flowCanvas.height!==s)&&(this.flowCanvas.width=a,this.flowCanvas.height=s)}setFlowOverlayCanvas(t){t&&(this.flowCanvas=t,this.flowContext=t.getContext("webgpu"),this.flowContext.configure({device:this.device,format:this.format,alphaMode:"premultiplied"}))}writeGlobals(){let t=this.globalUniformScratch;t[0]=this.center[0],t[1]=this.center[1],t[2]=this.scale,t[3]=performance.now()*.001,t[4]=this.canvas.width,t[5]=this.canvas.height,this.device.queue.writeBuffer(this.globalBuffer,0,t)}pagePixelWidth(t){return t.widthMm/this.scale}pageSourcePixelsPerMm(t){let a=this.pagePixelWidth(t)/Math.max(1,t.sourceWidthMm||t.widthMm),s=t.heightMm/this.scale/Math.max(1,t.sourceHeightMm||t.heightMm);return Math.min(a,s)}pageNativeDetailThresholds(t){let a=this.nativeDetailThresholds.get(t.id);if(a)return a;let s=Math.max(1,t.sourceWidthMm||t.widthMm),n=Math.max(1,t.sourceHeightMm||t.heightMm),r=s*n,i=Math.max(0,t.featureCount||t.featureIds?.length||0)/Math.max(1,r),o=ie(1-i*72,.84,1.08),c=ie(Math.sqrt(Math.max(s,n)/Math.max(1,Math.min(s,n)))/1.18,.92,1.14),b=ie(Gd*o*c,5,7.4),g={enter:b,exit:ie(Math.min(b-1.2,Vd*o),3.8,b-.7),prefetch:ie(Math.min(b-2,zd*o),3,b-1)};return this.nativeDetailThresholds.set(t.id,g),g}pageWantsNativeDetail(t){if(!this.pageHasNativeDetail(t))return!1;let a=this.pageSourcePixelsPerMm(t),s=this.nativeDetailState.get(t.id)===!0,n=this.pageNativeDetailThresholds(t),r=s?n.exit:n.enter,i=a>=r;return i!==s&&this.nativeDetailState.set(t.id,i),i}pageNativeDetailReady(t){if(this.domDetailPageIds.has(t.id)||!this.pageWantsNativeDetail(t))return!1;let a=this.vectorChunks.get(t.id);return!a?.loaded||!a.segments?.length&&!a.fills?.length?!1:this.visibleNativeImagesReady(t,a)}visibleNativeImagesReady(t,a){if(!a?.images?.length)return!0;let s=this.sourceViewportBounds(t,4),n=!0;for(let r of a.images){if(!$e(r.bounds,s))continue;(this.imageResources.get(r.path)||this.createImageResource(r.path)).loaded||(n=!1,this.loadImageTexture(r.path).catch(()=>{}))}return n}visiblePages(){let t=this.canvas.width*this.scale/2,a=this.canvas.height*this.scale/2,s=this.center[0]-t,n=this.center[0]+t,r=this.center[1]-a,i=this.center[1]+a;return this.pages.filter(o=>o.worldX+o.widthMm>=s&&o.worldX<=n&&o.worldY+o.heightMm>=r&&o.worldY<=i)}worldViewportBounds(t=0){let a=this.canvas.width*this.scale/2,s=this.canvas.height*this.scale/2;return[this.center[0]-a-t,this.center[1]-s-t,this.center[0]+a+t,this.center[1]+s+t]}sourceViewportBounds(t,a=2.5){let s=this.worldViewportBounds(this.scale*8),n=(s[0]-t.worldX)/t.widthMm*t.sourceWidthMm-a,r=(s[1]-t.worldY)/t.heightMm*t.sourceHeightMm-a,i=(s[2]-t.worldX)/t.widthMm*t.sourceWidthMm+a,o=(s[3]-t.worldY)/t.heightMm*t.sourceHeightMm+a;return[Math.max(-a,Math.min(n,i)),Math.max(-a,Math.min(r,o)),Math.min(t.sourceWidthMm+a,Math.max(n,i)),Math.min(t.sourceHeightMm+a,Math.max(r,o))]}render(){this.frameSerial+=1,this.resize(),this.writeGlobals();let t=this.visiblePages(),a=this.device.createCommandEncoder(),s=a.beginRenderPass({colorAttachments:[{view:this.context.getCurrentTexture().createView(),clearValue:{r:.045,g:.055,b:.073,a:1},loadOp:"clear",storeOp:"store"}]});this.showHierarchy&&this.edgeBuffer&&(s.setPipeline(this.edgePipeline),s.setBindGroup(0,this.edgeBindGroup),s.setVertexBuffer(0,this.edgeBuffer.buffer),s.draw(this.edgeBuffer.count)),s.setPipeline(this.pagePipeline);for(let i of t){let o=this.pageResources.get(i.id),c=this.activeNetUid&&i.netUids.includes(this.activeNetUid),b=this.domDetailPageIds.has(i.id),g=!b&&this.pageNativeDetailReady(i),h=this.pageUniformScratch;h[0]=i.worldX,h[1]=i.worldY,h[2]=i.widthMm,h[3]=i.heightMm,h[4]=i.id===this.selectedPageId?1:0,h[5]=c?1:0,h[6]=this.activeNetUid?1:0,h[7]=g||b?1:0,this.device.queue.writeBuffer(o.uniform,0,h),s.setBindGroup(0,o.bindGroup),s.draw(6);let w=ie(Math.ceil(this.pagePixelWidth(i)*1.3/512)*512,512,6144);o.textureWidth<w*.82&&this.loadPageTexture(i,w).catch(()=>{})}this.scheduleVisibleVectorLoads(t),this.drawVisibleImages(s,t),this.drawVisibleVectors(s,t);let n=this.writeNetTrackingOverlay();n&&!this.flowContext&&(s.setPipeline(this.netFlowPipeline),s.setBindGroup(0,this.edgeBindGroup),s.setVertexBuffer(0,this.netFlowBuffer),s.draw(n));let r=this.writeNetHighlights(t);return r&&(s.setPipeline(this.highlightPipeline),s.setBindGroup(0,this.edgeBindGroup),s.setVertexBuffer(0,this.highlightBuffer),s.draw(r)),s.end(),this.device.queue.submit([a.finish()]),this.renderFlowOverlay(n),this.evictVectorChunks(t),t}renderFlowOverlay(t){if(!this.flowContext)return;let a=this.device.createCommandEncoder(),s=a.beginRenderPass({colorAttachments:[{view:this.flowContext.getCurrentTexture().createView(),clearValue:{r:0,g:0,b:0,a:0},loadOp:"clear",storeOp:"store"}]});t&&(s.setPipeline(this.netFlowPipeline),s.setBindGroup(0,this.edgeBindGroup),s.setVertexBuffer(0,this.netFlowBuffer),s.draw(t)),s.end(),this.device.queue.submit([a.finish()])}drawVisibleImages(t,a){if(!this.isNativeScene)return;let s=!1;for(let n of a){if(this.domDetailPageIds.has(n.id)||!this.pageNativeDetailReady(n))continue;let r=this.vectorChunks.get(n.id);if(!r?.images?.length)continue;let i=this.sourceViewportBounds(n,4);for(let o of r.images){if(!$e(o.bounds,i))continue;let c=this.imageResources.get(o.path)||this.createImageResource(o.path);c.loaded||this.loadImageTexture(o.path).catch(()=>{});let b=o.worldOrigin||this.sourceToWorld(n,[o.xMm,o.yMm]),g=o.worldSize||this.sourceSizeToWorld(n,o.widthMm,o.heightMm),h=this.imageUniformScratch;h[0]=b[0],h[1]=b[1],h[2]=g[0],h[3]=g[1],h[4]=0,h[5]=0,h[6]=0,h[7]=0,this.device.queue.writeBuffer(c.uniform,0,h),s||(t.setPipeline(this.imagePipeline),s=!0),t.setBindGroup(0,c.bindGroup),t.draw(6)}}}drawVisibleVectors(t,a){if(!this.isNativeScene)return 0;let s=this.vectorScratch,n=0,r=0,i=0,o=0,c=!1,b=()=>{if(!n)return;let h=this.vectorBuffers[o];h||(h=this.device.createBuffer({size:Ra*4,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST}),this.vectorBuffers.push(h)),this.device.queue.writeBuffer(h,0,s,0,n),c||(t.setPipeline(this.vectorPipeline),t.setBindGroup(0,this.edgeBindGroup),c=!0);let w=Math.floor(n/6);t.setVertexBuffer(0,h),t.draw(w),i+=w,o+=1,n=0},g=h=>h>Wn||h>s.length?(r+=1,!1):((n+h>Wn||n+h>s.length)&&b(),!0);for(let h of a){if(this.domDetailPageIds.has(h.id)||!this.pageHasNativeDetail(h))continue;let w=this.vectorChunks.get(h.id);if(!w?.segments?.length&&!w?.fills?.length||!this.pageNativeDetailReady(h))continue;w.lastUsedFrame=this.frameSerial;let y=this.sourceViewportBounds(h),f=Zn(w.spatial,y);for(let d of f.fills){if(!$e(d.bounds,y)||!g(18))continue;let m=this.featuresById.get(d.featureId),l=this.activeNetUid&&m?.netUid===this.activeNetUid,p=this.selectedFeatureId===d.featureId?[.24,.58,1,1]:l?[.06,1,.24,1]:this.activeNetUid&&zt(m)?sr(m,d.kind,d.color):ws(m,d.kind,d.color),v=d.worldPoints||d.points.map(T=>this.sourceToWorld(h,T));n=ul(s,n,v[0],v[1],v[2],p)}for(let d of f.segments){if(!$e(d.bounds,y))continue;let m=this.featuresById.get(d.featureId),l=this.activeNetUid&&m?.netUid===this.activeNetUid,u=this.selectedFeatureId===d.featureId,p=u?[.24,.58,1,1]:l?[.06,1,.24,1]:this.activeNetUid&&zt(m)?sr(m,d.kind,d.color):ws(m,d.kind,d.color),v=this.segmentWorldWidth(h,d,m,l||u);for(let T of this.visibleSegmentParts(h,d,m)){if(!g(36))continue;let I=T.worldA||this.sourceToWorld(h,T.a),k=T.worldB||this.sourceToWorld(h,T.b);n=bl(s,n,I,k,v,p)}}}return b(),this.truncatedVectorCount=r,this.vectorTruncated=r>0,this.lastVectorVertices=i,this.lastVectorChunks=o,i}pageHasNativeDetail(t){return this.isNativeScene?t?.nativeDetail?.enabled!==!1:!1}scheduleVisibleVectorLoads(t){if(!this.isNativeScene)return;let a=[...this.vectorChunks.values()].filter(r=>r?.promise&&!r.loaded).length,s=Math.max(0,Wd-a);if(!s)return;let n=t.filter(r=>!this.domDetailPageIds.has(r.id)).filter(r=>this.pageHasNativeDetail(r)&&this.pageSourcePixelsPerMm(r)>=this.pageNativeDetailThresholds(r).prefetch).filter(r=>!this.vectorChunks.get(r.id)?.loaded&&!this.vectorChunks.get(r.id)?.promise).sort((r,i)=>{let o=Math.hypot(r.worldX+r.widthMm/2-this.center[0],r.worldY+r.heightMm/2-this.center[1]),c=Math.hypot(i.worldX+i.widthMm/2-this.center[0],i.worldY+i.heightMm/2-this.center[1]);return o-c});for(let r of n)if(this.loadPageVectors(r).catch(()=>{}),s-=1,!s)break}featurePrimitiveBounds(t,a){let s=this.vectorChunks.get(t.id);if(!s?.segments?.length&&!s?.fills?.length)return null;let n=[],r=[];for(let i of s.segments||[])i.featureId===a&&(n.push(i.a[0],i.b[0]),r.push(i.a[1],i.b[1]));for(let i of s.fills||[])if(i.featureId===a)for(let o of i.points||[])n.push(o[0]),r.push(o[1]);return n.length?[Math.min(...n),Math.min(...r),Math.max(...n),Math.max(...r)]:null}symbolClipBounds(t){if(this._symbolClipBounds||(this._symbolClipBounds=new Map),this._symbolClipBounds.has(t.id))return this._symbolClipBounds.get(t.id);let a=(this.featuresByPage[t.id]||[]).filter(s=>s?.kind==="symbol_body"&&s.boundsMm&&!String(s.sourceId||"").includes(":overplot")).map(s=>{let n=this.featurePrimitiveBounds(t,s.id)||s.boundsMm;return[n[0]-.02,n[1]-.02,n[2]+.02,n[3]+.02]}).filter(s=>{let n=s[2]-s[0],r=s[3]-s[1];return Math.max(n,r)<=12&&n*r<=80});return this._symbolClipBounds.set(t.id,a),a}visibleSegmentParts(t,a,s){if(a._visibleParts)return a._visibleParts;let n=String(s?.kind||""),r=String(s?.semanticRole||"");if(n!=="wire"&&r!=="wire")return a._visibleParts=[a],a._visibleParts;let i=[a];for(let o of this.symbolClipBounds(t)){let c=[];for(let b of i)c.push(...pl(b,o));if(i=c,!i.length)break}for(let o of i)o.worldA=Ft(t,o.a),o.worldB=Ft(t,o.b);return a._visibleParts=i,a._visibleParts}netTrackingSegments(){if(!this.activeNetUid)return{netUid:"",anchorsByPage:new Map,segments:[],intrasheetSegments:[]};let t=Number(this.selectedFeatureId||0),a=String(this.selectedFeatureKey||""),s=String(this.selectedSourceId||"");if(this.netTrackingCache?.netUid===this.activeNetUid&&this.netTrackingCache?.selectedFeatureId===t&&this.netTrackingCache?.selectedFeatureKey===a&&this.netTrackingCache?.selectedSourceId===s)return this.netTrackingCache;this.selectedIntrasheetLinkIndex=-1;let n=new Map(this.pages.map(f=>[f.id,f])),r=this.manifest.netToPages?.[this.activeNetUid]||[],i=r.length?r.map(f=>n.get(f)).filter(Boolean):this.pages.filter(f=>f.netUids?.includes(this.activeNetUid)),o=new Map;for(let f of i.slice(0,qd)){let d=this.netTrackingAnchorsForPage(f);d.length&&o.set(f.id,d)}let c=[],b=[];for(let[f,d]of o){let m=tr(cl(d),"intrasheet",f);c.push(...m),b.push(...m)}let g=[...o.entries()].map(([f,d])=>dl(n.get(f),d,{featureId:t,stableKey:a,sourceId:s})).filter(Boolean);c.push(...tr(g,"intersheet",""));let h=b.map((f,d)=>({...f,intrasheetIndex:d})),w=0,y=c.map((f,d)=>{if(f.type!=="intrasheet")return{...f,id:d};let m=w;return w+=1,{...f,id:d,intrasheetIndex:m}});return this.netTrackingCache={netUid:this.activeNetUid,selectedFeatureId:t,selectedFeatureKey:a,selectedSourceId:s,anchorsByPage:o,segments:y,intrasheetSegments:h},this.selectedIntrasheetLinkIndex>=this.netTrackingCache.intrasheetSegments.length&&(this.selectedIntrasheetLinkIndex=-1),this.netTrackingCache}netTrackingAnchorsForPage(t){let a=this.featuresByPage[t.id]||[],s=[];for(let n of a){if(n.netUid!==this.activeNetUid||!n.boundsMm||!il(n))continue;let r=n.boundsMm,i=[(r[0]+r[2])/2,(r[1]+r[3])/2],o=this.sourceToWorld(t,i);s.push({pageId:t.id,featureId:Number(n.id||0),stableKey:String(n.stableKey||""),sourceId:String(n.sourceId||n.sourceUid||n.objectId||""),kind:n.kind||n.semanticRole||"",source:i,world:o,bounds:r,priority:ol(n)})}return s.sort((n,r)=>r.priority-n.priority||n.source[1]-r.source[1]||n.source[0]-r.source[0]),s}writeNetTrackingOverlay(){let t=this.netTrackingSegments();if(this.lastNetFlowSegments=t.segments.length,this.lastNetFlowIntrasheetSegments=t.intrasheetSegments.length,!t.segments.length)return this.lastNetFlowVertices=0,0;let a=this.worldViewportBounds(this.scale*96),s=this.netFlowScratch,n=0,r=0;for(let i of t.segments){if(!$e(ar(i),a))continue;let o=i.type==="intrasheet"&&i.intrasheetIndex===this.selectedIntrasheetLinkIndex,c=o?9.5:i.type==="intersheet"?8:4.8,b=o?2:i.type==="intersheet"?1:0,g=hl(s,n,i.a,i.b,c*this.scale,b,r,this.scale);if(g!==n&&(n=g,r+=Math.hypot(i.b[0]-i.a[0],i.b[1]-i.a[1])/Math.max(this.scale,1e-6),n+24>s.length))break}return n?(this.device.queue.writeBuffer(this.netFlowBuffer,0,s,0,n),this.lastNetFlowVertices=n/4,n/4):(this.lastNetFlowVertices=0,0)}cycleNetIntrasheetLink(t=1){let a=this.netTrackingSegments();if(!a.intrasheetSegments.length)return null;let s=a.intrasheetSegments.length;this.selectedIntrasheetLinkIndex=(this.selectedIntrasheetLinkIndex+t+s)%s;let n=a.intrasheetSegments[this.selectedIntrasheetLinkIndex];if(!n)return null;let r=ar(n,14*this.scale);return this.center=[(r[0]+r[2])/2,(r[1]+r[3])/2],this.scale=Math.max((r[2]-r[0])/Math.max(1,this.canvas.width*.36),(r[3]-r[1])/Math.max(1,this.canvas.height*.3),this.scale*.35,.025),{pageId:n.pageId,segment:n}}writeNetHighlights(t){if(!this.activeNetUid)return 0;let a=this.highlightScratch,s=0,n=0;for(let r of t){let i=this.sourceViewportBounds(r,5);for(let o of this.featuresByPage[r.id]||[]){if(o.netUid!==this.activeNetUid||!o.boundsMm||!$e(o.boundsMm,i))continue;let c=this.featureWorldBounds(r,o.boundsMm);if(s+16>a.length){n+=1;continue}a[s++]=c[0],a[s++]=c[1],a[s++]=c[2],a[s++]=c[1],a[s++]=c[2],a[s++]=c[1],a[s++]=c[2],a[s++]=c[3],a[s++]=c[2],a[s++]=c[3],a[s++]=c[0],a[s++]=c[3],a[s++]=c[0],a[s++]=c[3],a[s++]=c[0],a[s++]=c[1]}}return this.truncatedHighlightCount=n,s?(this.device.queue.writeBuffer(this.highlightBuffer,0,a,0,s),s/2):0}featureWorldBounds(t,a){return[t.worldX+a[0]/t.sourceWidthMm*t.widthMm,t.worldY+a[1]/t.sourceHeightMm*t.heightMm,t.worldX+a[2]/t.sourceWidthMm*t.widthMm,t.worldY+a[3]/t.sourceHeightMm*t.heightMm]}sourceToWorld(t,a){return[t.worldX+a[0]/t.sourceWidthMm*t.widthMm,t.worldY+a[1]/t.sourceHeightMm*t.heightMm]}sourceSizeToWorld(t,a,s){return[a/t.sourceWidthMm*t.widthMm,s/t.sourceHeightMm*t.heightMm]}async loadPageVectors(t){if(!this.pageHasNativeDetail(t)||!t.chunks?.lod2)return null;let a=this.vectorChunks.get(t.id);if(a?.loaded)return a;if(a?.promise)return a.promise;let s=(async()=>{try{let n=await fetch(new URL(t.chunks.lod2,this.manifestUrl));if(!n.ok)throw new Error(`Failed to load schematic vector chunk ${t.id}: ${n.status}`);let r=await n.json(),i=$d(r.primitives||[]);Qd(t,i);let c=JSON.stringify(r).length,b={loaded:!0,segments:i.segments,fills:i.fills,images:i.images,spatial:rl(i),unsupported:r.unsupported||[],bytes:c,lastUsedFrame:this.frameSerial};return this.vectorChunks.set(t.id,b),this.failedVectorChunks.delete(t.id),this.residentVectorBytes+=c,b}catch(n){let r=this.failedVectorChunks.get(t.id)||{count:0,message:""};throw this.failedVectorChunks.set(t.id,{count:r.count+1,message:n?.message||String(n)}),this.vectorChunks.delete(t.id),n}})();return this.vectorChunks.set(t.id,{loaded:!1,promise:s,segments:[]}),s}evictVectorChunks(t){if(this.residentVectorBytes<=$n)return;let a=new Set(t.map(n=>n.id)),s=[...this.vectorChunks.entries()].filter(([,n])=>n?.loaded).filter(([n])=>!a.has(n)&&n!==this.selectedPageId).sort((n,r)=>(n[1].lastUsedFrame||0)-(r[1].lastUsedFrame||0));for(let[n,r]of s)if(this.vectorChunks.delete(n),this.residentVectorBytes=Math.max(0,this.residentVectorBytes-(r.bytes||0)),this.residentVectorBytes<=$n*.82)break}stats(){let t=this.visiblePages(),a=t.map(n=>this.pageSourcePixelsPerMm(n)),s=t.map(n=>this.pageNativeDetailThresholds(n).enter);return{residentVectorBytes:this.residentVectorBytes,vectorChunks:[...this.vectorChunks.values()].filter(n=>n?.loaded).length,vectorLoads:[...this.vectorChunks.values()].filter(n=>n?.promise&&!n.loaded).length,failedVectorChunks:this.failedVectorChunks.size,vectorVertices:this.lastVectorVertices||0,vectorDrawChunks:this.lastVectorChunks||0,truncatedVectors:this.truncatedVectorCount||0,nativeDetailPages:[...this.nativeDetailState.values()].filter(Boolean).length,nativePxPerMm:Number((Math.max(0,...a)||0).toFixed(2)),nativeThresholdPxPerMm:Number((s.length?Math.min(...s):0).toFixed(2)),domDetailPages:this.domDetailPageIds.size,netFlowSegments:this.lastNetFlowSegments||0,netFlowIntrasheetSegments:this.lastNetFlowIntrasheetSegments||0,netFlowVertices:this.lastNetFlowVertices||0}}setDomDetailPageIds(t){this.domDetailPageIds=new Set(t||[])}async loadPageTexture(t,a){let s=`${t.id}:${a}`;if(this.loading.has(s))return this.loading.get(s);let n=this.pageResources.get(t.id);if(!n||n.textureWidth>=a)return;let r=(async()=>{if(!n.svgBlob){let c=await fetch(new URL(Jd(t),this.manifestUrl));if(!c.ok)throw new Error(`Failed to load schematic page ${t.name}: ${c.status}`);n.svgBlob=await c.blob(),this.downloadedBytes+=n.svgBlob.size}let i=n.svgBlob,o=URL.createObjectURL(i);try{let c=new Image;if(c.decoding="async",c.src=o,await c.decode(),n.textureWidth>=a)return;let b=Math.max(64,Math.round(a*t.heightMm/t.widthMm)),g=new OffscreenCanvas(a,b),h=g.getContext("2d",{alpha:!1});h.fillStyle="#ffffff",h.fillRect(0,0,a,b),h.drawImage(c,0,0,a,b);let w=await createImageBitmap(g),y=this.device.createTexture({size:[a,b],format:"rgba8unorm-srgb",usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST|GPUTextureUsage.RENDER_ATTACHMENT});this.device.queue.copyExternalImageToTexture({source:w},{texture:y},[a,b]),w.close(),n.texture!==this.placeholder&&n.texture.destroy(),n.texture=y,n.textureWidth=a,this.updateBindGroup(n)}finally{URL.revokeObjectURL(o),this.loading.delete(s)}})();return this.loading.set(s,r),r}preloadOverview(){let t=[...this.pages],a=async()=>{for(;t.length;){let s=t.shift();await this.loadPageTexture(s,512).catch(()=>{})}};return Promise.all(Array.from({length:Math.min(4,t.length)},a))}screenToWorld(t,a){let s=this.canvas.getBoundingClientRect(),n=(t-s.left)*this.canvas.width/s.width,r=(a-s.top)*this.canvas.height/s.height;return[this.center[0]+(n-this.canvas.width/2)*this.scale,this.center[1]+(r-this.canvas.height/2)*this.scale]}worldToScreen(t,a){let s=this.canvas.clientWidth/this.canvas.width,n=this.canvas.clientHeight/this.canvas.height;return[((t-this.center[0])/this.scale+this.canvas.width/2)*s,((a-this.center[1])/this.scale+this.canvas.height/2)*n]}hitPage(t,a){let[s,n]=this.screenToWorld(t,a);return[...this.pages].reverse().find(r=>s>=r.worldX&&s<=r.worldX+r.widthMm&&n>=r.worldY&&n<=r.worldY+r.heightMm)||null}async pickFeature(t,a){if(!this.isNativeScene)return this.hitFeature(t,a);let s=this.hitPage(t,a);if(!s)return null;if(!this.pageHasNativeDetail(s))return this.hitFeature(t,a);await this.loadPageVectors(s);let n=await this.gpuPickFeature(s,t,a);return n&&!Vt(n)?{page:s,feature:n,source:this.clientToSource(s,t,a),native:!0,gpu:!0}:this.hitFeature(t,a)}hitFeature(t,a){let s=this.hitPage(t,a);if(!s)return null;let[n,r]=this.clientToSource(s,t,a),i=Math.max(.45,5*this.scale*this.canvas.width/Math.max(1,this.canvas.clientWidth)*s.sourceWidthMm/s.widthMm),o=this.hitResidentVectorFeature(s,n,r,i);if(o)return{page:s,feature:o,source:[n,r],native:!0};let c=this.hitSymbolInterior(s,n,r);if(c)return{page:s,feature:c,source:[n,r],native:!0,interior:!0};let b=(this.featuresByPage[s.id]||[]).filter(g=>{if(Vt(g))return!1;let h=g.boundsMm;return h&&n>=h[0]-i&&n<=h[2]+i&&r>=h[1]-i&&r<=h[3]+i}).map(g=>({feature:g,priority:Gt(g),area:Math.max(1e-4,(g.boundsMm[2]-g.boundsMm[0])*(g.boundsMm[3]-g.boundsMm[1]))})).sort((g,h)=>h.priority-g.priority||g.area-h.area);return{page:s,feature:b[0]?.feature||null,source:[n,r]}}hitSymbolInterior(t,a,s){let n=null;for(let r of this.featuresByPage[t.id]||[]){let i=String(r?.kind||"");if(i!=="symbol_body"&&i!=="symbol_instance"||String(r?.sourceId||"").includes(":overplot"))continue;let o=r.boundsMm;if(!o||a<o[0]||a>o[2]||s<o[1]||s>o[3])continue;let c=Math.max(1e-4,(o[2]-o[0])*(o[3]-o[1])),b=(i==="symbol_body"?0:1e6)+c;(!n||b<n.score)&&(n={feature:r,score:b})}return n?.feature||null}clientToSource(t,a,s){let[n,r]=this.screenToWorld(a,s);return[(n-t.worldX)/t.widthMm*t.sourceWidthMm,(r-t.worldY)/t.heightMm*t.sourceHeightMm]}ensurePickTexture(){this.pickTexture&&this.pickTextureSize[0]===this.canvas.width&&this.pickTextureSize[1]===this.canvas.height||(this.pickTexture&&this.pickTexture.destroy(),this.pickTexture=this.device.createTexture({size:[this.canvas.width,this.canvas.height],format:"r32uint",usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.COPY_SRC}),this.pickTextureSize=[this.canvas.width,this.canvas.height])}writePickVectors(t){let a=new ArrayBuffer(Ea*12),s=new DataView(a),n=0,r=[];for(let i of t){let o=this.vectorChunks.get(i.id);if(!o?.segments?.length&&!o?.fills?.length&&!o?.images?.length)continue;let c=this._pickSourcePointByPage?.get(i.id),b=c?[c[0]-2.5,c[1]-2.5,c[0]+2.5,c[1]+2.5]:[0,0,i.sourceWidthMm,i.sourceHeightMm],g=Zn(o.spatial,b);for(let h of g.images){if(!$e(h.bounds,b))continue;let w=this.featuresById.get(h.featureId);!w||Vt(w)||r.push({page:i,image:h,feature:w,priority:Gt(w)-5})}for(let h of g.fills){if(!$e(h.bounds,b))continue;let w=this.featuresById.get(h.featureId);!w||Vt(w)||r.push({page:i,fill:h,feature:w,priority:Gt(w)-2})}for(let h of g.segments){if(!$e(h.bounds,b))continue;let w=this.featuresById.get(h.featureId);!w||Vt(w)||r.push({page:i,segment:h,feature:w,priority:Gt(w)})}}r.sort((i,o)=>i.priority-o.priority);for(let{page:i,segment:o,fill:c,image:b,feature:g}of r){if(n+6>Ea)break;if(b){let h=this.sourceToWorld(i,[b.xMm,b.yMm]),w=this.sourceToWorld(i,[b.xMm+b.widthMm,b.yMm]),y=this.sourceToWorld(i,[b.xMm,b.yMm+b.heightMm]),f=this.sourceToWorld(i,[b.xMm+b.widthMm,b.yMm+b.heightMm]);n=vs(s,n,h,w,y,b.featureId),n=vs(s,n,y,w,f,b.featureId)}else if(c){let h=c.worldPoints||c.points.map(w=>this.sourceToWorld(i,w));n=vs(s,n,h[0],h[1],h[2],c.featureId)}else{let h=Math.max(this.segmentWorldWidth(i,o,g,!1),this.scale*7);for(let w of this.visibleSegmentParts(i,o,g)){if(n+6>Ea)break;let y=w.worldA||this.sourceToWorld(i,w.a),f=w.worldB||this.sourceToWorld(i,w.b);n=ml(s,n,y,f,h,o.featureId)}}}return n?(this.device.queue.writeBuffer(this.pickVertexBuffer,0,a,0,n*12),n):0}async gpuPickFeature(t,a,s){if(this.pickPending)return null;let n=this.clientToSource(t,a,s);this._pickSourcePointByPage=new Map([[t.id,n]]);let r=this.writePickVectors([t]);if(this._pickSourcePointByPage=null,!r)return null;this.resize(),this.writeGlobals(),this.ensurePickTexture();let i=this.canvas.getBoundingClientRect(),o=Math.max(0,Math.min(this.canvas.width-1,Math.floor((a-i.left)*this.canvas.width/i.width))),c=Math.max(0,Math.min(this.canvas.height-1,Math.floor((s-i.top)*this.canvas.height/i.height))),b=this.device.createCommandEncoder(),g=b.beginRenderPass({colorAttachments:[{view:this.pickTexture.createView(),clearValue:{r:0,g:0,b:0,a:0},loadOp:"clear",storeOp:"store"}]});g.setPipeline(this.pickPipeline),g.setBindGroup(0,this.edgeBindGroup),g.setVertexBuffer(0,this.pickVertexBuffer),g.draw(r),g.end(),b.copyTextureToBuffer({texture:this.pickTexture,origin:{x:o,y:c}},{buffer:this.pickReadBuffer,bytesPerRow:256,rowsPerImage:1},{width:1,height:1,depthOrArrayLayers:1}),this.pickPending=!0,this.device.queue.submit([b.finish()]);try{await this.pickReadBuffer.mapAsync(GPUMapMode.READ);let h=new DataView(this.pickReadBuffer.getMappedRange()).getUint32(0,!0);return this.pickReadBuffer.unmap(),h&&this.featuresById.get(h)||null}finally{this.pickReadBuffer.mapState==="mapped"&&this.pickReadBuffer.unmap(),this.pickPending=!1}}hitResidentVectorFeature(t,a,s,n){if(!this.isNativeScene)return null;let r=this.vectorChunks.get(t.id);if(!r?.loaded)return null;let i=null;for(let o of r.segments){let c=this.featuresById.get(o.featureId),b=Math.max(n,(o.widthMm||0)*.5+n*.45);if(c)for(let g of this.visibleSegmentParts(t,o,c)){let h=gl([a,s],g.a,g.b);if(h>b)continue;let w=h-Gt(c)*.025+(zt(c)?0:8);(!i||w<i.score)&&(i={feature:c,score:w})}}return i?.feature||null}segmentWorldWidth(t,a,s,n){let r=(a.widthMm||.15)/Math.max(1,t.sourceWidthMm)*t.widthMm;return Math.max(r,this.scale*fl(s,a.kind,n))}pan(t,a){let s=this.canvas.width/Math.max(1,this.canvas.clientWidth);this.center[0]-=t*this.scale*s,this.center[1]-=a*this.scale*s}zoom(t,a,s){let n=this.screenToWorld(a,s);this.scale=ie(this.scale*Math.exp(t*.0015),.015,16);let r=this.screenToWorld(a,s);this.center[0]+=n[0]-r[0],this.center[1]+=n[1]-r[1]}framePage(t){t&&(this.resize(),this.center=[t.worldX+t.widthMm/2,t.worldY+t.heightMm/2],this.scale=Math.max(t.widthMm/Math.max(1,this.canvas.width*.88),t.heightMm/Math.max(1,this.canvas.height*.84)))}frameWorld(){this.resize(),this.center=[(this.world.minX+this.world.maxX)/2,(this.world.minY+this.world.maxY)/2],this.scale=Math.max((this.world.maxX-this.world.minX)/Math.max(1,this.canvas.width*.9),(this.world.maxY-this.world.minY)/Math.max(1,this.canvas.height*.88),.05)}};function Jd(e){return e.thumbnail?.path||e.svg}function Yd(e){if(e.schema==="prism.schematic_vector_a0.features"){let t=new Map((e.features||[]).map(s=>[Number(s.id),s])),a={};for(let[s,n]of Object.entries(e.pages||{}))a[s]=n.map(r=>t.get(Number(r))).filter(Boolean);return a}return e.pages||{}}function $d(e){let t=[],a=[],s=[];for(let n of e){let r=Number(n.featureId||0);if(!r)continue;if(n.kind==="plotimage"&&n.image?.path){let u=n.xMm||0,p=n.yMm||0,v=n.widthMm||0,T=n.heightMm||0;s.push({featureId:r,kind:n.kind,xMm:u,yMm:p,widthMm:v,heightMm:T,bounds:[u,p,u+v,p+T],path:n.image.path});continue}let i=String(n.semanticRole||""),o=n.radiusMm||n.diameterMm/2||0,c=String(n.fill||"").toUpperCase()==="FILLED_SHAPE",b=n.widthMm||n.pen_widthMm||(i==="junction"?.08:.15),g=String(n.lineStyle||n.line_style||"DEFAULT").toUpperCase(),h=n.color||n.strokeColor||n.style?.color||"",w=n.fillColor||n.color||n.style?.color||"",y=(u,p)=>sl(t,{featureId:r,kind:n.kind,widthMm:b,lineStyle:g,color:h},u,p),f=n.x1Mm,d=n.y1Mm,m=n.x2Mm,l=n.y2Mm;if(n.trianglesMm?.length){for(let u of n.trianglesMm)Array.isArray(u)&&u.length===3&&a.push({featureId:r,kind:n.kind,color:w,points:u,bounds:nr(u)});if(n.pointsMm?.length>=2){for(let u=1;u<n.pointsMm.length;u+=1)y(n.pointsMm[u-1],n.pointsMm[u]);er(n)&&y(n.pointsMm[n.pointsMm.length-1],n.pointsMm[0])}}else if(n.pointsMm?.length>=2){c&&n.pointsMm.length>=3&&al(a,r,n.kind,n.pointsMm,w);for(let u=1;u<n.pointsMm.length;u+=1)y(n.pointsMm[u-1],n.pointsMm[u]);er(n)&&y(n.pointsMm[n.pointsMm.length-1],n.pointsMm[0])}else if(n.polylinesMm?.length){for(let u of n.polylinesMm)if(!(!Array.isArray(u)||u.length<2))for(let p=1;p<u.length;p+=1)y(u[p-1],u[p])}else if(Number.isFinite(f)&&Number.isFinite(d)&&Number.isFinite(m)&&Number.isFinite(l))n.kind==="rect"?(c&&el(a,r,n.kind,[f,d,m,l],w),y([f,d],[m,d]),y([m,d],[m,l]),y([m,l],[f,l]),y([f,l],[f,d])):y([f,d],[m,l]);else if(Number.isFinite(n.cxMm)&&Number.isFinite(n.cyMm)){let u=n.radiusMm||n.diameterMm/2||.4;c&&tl(a,r,n.kind,[n.cxMm,n.cyMm],u,w),nl(t,{featureId:r,kind:n.kind,widthMm:b,lineStyle:g,color:h},[n.cxMm,n.cyMm],u)}else if(n.contoursMm?.length){for(let u of n.contoursMm)if(!(!Array.isArray(u)||u.length<2)){for(let p=1;p<u.length;p+=1)y(u[p-1],u[p]);y(u[u.length-1],u[0])}}else if(Number.isFinite(n.start_xMm)&&Number.isFinite(n.start_yMm)&&Number.isFinite(n.end_xMm)&&Number.isFinite(n.end_yMm))Number.isFinite(n.mid_xMm)&&Number.isFinite(n.mid_yMm)?(y([n.start_xMm,n.start_yMm],[n.mid_xMm,n.mid_yMm]),y([n.mid_xMm,n.mid_yMm],[n.end_xMm,n.end_yMm])):y([n.start_xMm,n.start_yMm],[n.end_xMm,n.end_yMm]);else if(Number.isFinite(n.start_xMm)&&Number.isFinite(n.start_yMm)&&Number.isFinite(n.mid_xMm)&&Number.isFinite(n.mid_yMm)&&Number.isFinite(n.end_xMm)&&Number.isFinite(n.end_yMm))y([n.start_xMm,n.start_yMm],[n.mid_xMm,n.mid_yMm]),y([n.mid_xMm,n.mid_yMm],[n.end_xMm,n.end_yMm]);else if(n.boundsMm&&n.kind!=="text"){let[u,p,v,T]=n.boundsMm;y([u,p],[v,p]),y([v,p],[v,T]),y([v,T],[u,T]),y([u,T],[u,p])}}return{segments:t,fills:a,images:s}}function Qd(e,t){for(let a of t.segments||[])a.worldA=Ft(e,a.a),a.worldB=Ft(e,a.b);for(let a of t.fills||[])a.worldPoints=a.points.map(s=>Ft(e,s));for(let a of t.images||[])a.worldOrigin=Ft(e,[a.xMm,a.yMm]),a.worldSize=Zd(e,a.widthMm,a.heightMm)}function Ft(e,t){return[e.worldX+t[0]/e.sourceWidthMm*e.widthMm,e.worldY+t[1]/e.sourceHeightMm*e.heightMm]}function Zd(e,t,a){return[t/e.sourceWidthMm*e.widthMm,a/e.sourceHeightMm*e.heightMm]}function el(e,t,a,s,n){let[r,i,o,c]=s;e.push({featureId:t,kind:a,color:n,points:[[r,i],[o,i],[r,c]],bounds:[r,i,o,c]},{featureId:t,kind:a,color:n,points:[[r,c],[o,i],[o,c]],bounds:[r,i,o,c]})}function tl(e,t,a,s,n,r){for(let o=0;o<36;o+=1){let c=o/36*Math.PI*2,b=(o+1)/36*Math.PI*2;e.push({featureId:t,kind:a,color:r,points:[s,[s[0]+Math.cos(c)*n,s[1]+Math.sin(c)*n],[s[0]+Math.cos(b)*n,s[1]+Math.sin(b)*n]],bounds:[s[0]-n,s[1]-n,s[0]+n,s[1]+n]})}}function al(e,t,a,s,n){let r=s[0],i=nr(s);for(let o=2;o<s.length;o+=1)e.push({featureId:t,kind:a,color:n,points:[r,s[o-1],s[o]],bounds:i})}function sl(e,t,a,s){let n=Qn(a,s,t.widthMm||.15),r=t.lineStyle||"DEFAULT";if(!["DASH","DASHED","DOT","DOTTED","DASHDOT","DASH_DOT"].includes(r)){e.push({...t,a,b:s,bounds:n});return}let i=s[0]-a[0],o=s[1]-a[1],c=Math.hypot(i,o);if(c<1e-6)return;let b=i/c,g=o/c,h=Math.max(t.widthMm*4,.45),w=r.includes("DOT")?[h*.8,h*.75,h*3,h*.75]:[h*3,h*1.5],y=0,f=0;for(;y<c;){let d=Math.min(w[f%w.length],c-y);if(f%2===0){let m=[a[0]+b*y,a[1]+g*y],l=[a[0]+b*(y+d),a[1]+g*(y+d)];e.push({...t,a:m,b:l,bounds:Qn(m,l,t.widthMm||.15)})}y+=d,f+=1}}function nl(e,t,a,s){for(let r=0;r<32;r+=1){let i=r/32*Math.PI*2,o=(r+1)/32*Math.PI*2;e.push({...t,a:[a[0]+Math.cos(i)*s,a[1]+Math.sin(i)*s],b:[a[0]+Math.cos(o)*s,a[1]+Math.sin(o)*s],bounds:[a[0]-s,a[1]-s,a[0]+s,a[1]+s]})}}function nr(e,t=0){let a=1/0,s=1/0,n=-1/0,r=-1/0;for(let i of e||[])a=Math.min(a,i[0]),s=Math.min(s,i[1]),n=Math.max(n,i[0]),r=Math.max(r,i[1]);return Number.isFinite(a)?[a-t,s-t,n+t,r+t]:[0,0,0,0]}function Qn(e,t,a=0){let s=Math.max(.05,a*.5);return[Math.min(e[0],t[0])-s,Math.min(e[1],t[1])-s,Math.max(e[0],t[0])+s,Math.max(e[1],t[1])+s]}function $e(e,t){return!e||!t?!0:e[0]<=t[2]&&e[2]>=t[0]&&e[1]<=t[3]&&e[3]>=t[1]}function rl(e){let t={cellSize:Hd,cells:new Map,segments:e.segments||[],fills:e.fills||[],images:e.images||[],queryId:0};for(let a of t.segments)xs(t,"segments",a);for(let a of t.fills)xs(t,"fills",a);for(let a of t.images)xs(t,"images",a);return t}function xs(e,t,a){let s=a.bounds;if(!s)return;let n=Math.floor(s[0]/e.cellSize),r=Math.floor(s[2]/e.cellSize),i=Math.floor(s[1]/e.cellSize),o=Math.floor(s[3]/e.cellSize);for(let c=i;c<=o;c+=1)for(let b=n;b<=r;b+=1){let g=`${b}:${c}`,h=e.cells.get(g);h||(h={segments:[],fills:[],images:[]},e.cells.set(g,h)),h[t].push(a)}}function Zn(e,t){if(!e)return{segments:[],fills:[],images:[]};e.queryId=(e.queryId||0)+1;let a=e.queryId,s={segments:[],fills:[],images:[]},n=Math.floor(t[0]/e.cellSize),r=Math.floor(t[2]/e.cellSize),i=Math.floor(t[1]/e.cellSize),o=Math.floor(t[3]/e.cellSize);for(let c=i;c<=o;c+=1)for(let b=n;b<=r;b+=1){let g=e.cells.get(`${b}:${c}`);g&&(ys(g.segments,s.segments,a,"segments"),ys(g.fills,s.fills,a,"fills"),ys(g.images,s.images,a,"images"))}return s}function ys(e,t,a,s){let n=`_${s}QueryId`;for(let r of e)r[n]!==a&&(r[n]=a,t.push(r))}function er(e){let t=String(e.kind||"");if(String(e.fill||"").toUpperCase()==="FILLED_SHAPE"||e.closed===!0||["polygon","fill"].includes(t))return!0;let s=e.pointsMm||[];if(s.length>=3){let n=s[0],r=s[s.length-1];return Math.hypot(n[0]-r[0],n[1]-r[1])<1e-6}return!1}function zt(e){return!!e?.netUid}function il(e){let t=String(e?.kind||""),a=String(e?.semanticRole||"");return t==="pin"||t==="pin_body"||t==="label"||t==="global_label"||t==="hierarchical_label"||t==="netclass_flag"||t==="power_symbol"||t==="power_port"||a==="label"||a==="global_label"||a==="hierarchical_label"}function ol(e){let t=String(e?.kind||""),a=String(e?.semanticRole||"");return t==="global_label"||a==="global_label"?130:t==="hierarchical_label"||a==="hierarchical_label"?125:t==="label"||a==="label"?118:t==="pin"||t==="pin_body"?106:t==="power_symbol"||t==="power_port"||t==="netclass_flag"?98:50}function cl(e){if(e.length<=Yn)return e;let t=e.slice(0,Yn);return t.sort((a,s)=>a.source[1]-s.source[1]||a.source[0]-s.source[0]),t}function dl(e,t,a={}){if(!e||!t?.length)return null;let s=a.featureId||a.stableKey||a.sourceId?t.find(b=>a.featureId&&Number(b.featureId||0)===Number(a.featureId)||a.stableKey&&b.stableKey===a.stableKey||a.sourceId&&b.sourceId===a.sourceId):null;if(s)return{...s,kind:"selected-net-occurrence",priority:200};let n=t.filter(b=>b.priority>=118).slice(0,16),r=n.length?n:t.slice(0,16),i=0,o=0;for(let b of r)i+=b.world[0],o+=b.world[1];let c=[i/r.length,o/r.length];return{pageId:e.id,featureId:r[0]?.featureId||0,kind:"page-net-occurrence",source:[0,0],world:c,bounds:[c[0],c[1],c[0],c[1]],priority:1}}function tr(e,t,a){if(!e||e.length<2)return[];let s=e.map(i=>({...i})).sort((i,o)=>i.world[1]-o.world[1]||i.world[0]-o.world[0]),n=[],r=s.shift();for(;s.length;){let i=0,o=1/0;for(let b=0;b<s.length;b+=1){let g=s[b],h=Math.hypot(g.world[0]-r.world[0],g.world[1]-r.world[1]);h<o&&(o=h,i=b)}let c=s.splice(i,1)[0];n.push({type:t,pageId:a||r.pageId||c.pageId||"",a:r.world,b:c.world,sourceFeatureIds:[r.featureId,c.featureId].filter(Boolean)}),r=c}return n}function ar(e,t=0){return[Math.min(e.a[0],e.b[0])-t,Math.min(e.a[1],e.b[1])-t,Math.max(e.a[0],e.b[0])+t,Math.max(e.a[1],e.b[1])+t]}function Gt(e){let t=String(e?.kind||""),s=String(e?.semanticRole||"")||t;return s==="pin_number"||s==="pin_name"?120:s==="pin_body"||t==="pin"?110:s==="symbol_reference"||s==="symbol_value"?92:t==="junction"||t==="no_connect"?88:t==="wire"||t==="bus"||t==="bus_entry"?78:s==="symbol_body"||t==="symbol_body"?45:t==="symbol_instance"||t==="symbol_overplot"?30:t==="text"||String(s).includes("text")?24:10}function Vt(e){let t=String(e?.kind||""),a=String(e?.semanticRole||"");if(t==="page"||t==="sheet_header")return!0;if(t==="graphic_rect"&&a==="graphic_rect"&&!e?.netUid&&!e?.componentUid){let s=e.boundsMm||[];return s[2]-s[0]>150&&s[3]-s[1]>120}return!1}function ll(e){if(!e||typeof e!="string")return null;let a=e.trim().match(/^#([0-9a-f]{6})([0-9a-f]{2})?$/i);if(!a)return null;let s=a[1],n=a[2]??"ff";return[parseInt(s.slice(0,2),16)/255,parseInt(s.slice(2,4),16)/255,parseInt(s.slice(4,6),16)/255,parseInt(n,16)/255]}function ws(e,t,a=""){let s=ll(a||e?.color||"");return e?.dnp&&["symbol_reference","symbol_value","symbol_text"].includes(String(e?.kind||""))?[.5,.52,.54,.56]:s||(e?.dnp?[.5,.52,.54,.56]:zt(e)?[.12,.56,.2,.96]:e?.kind==="pin_name"?[0,.28,.31,.96]:e?.kind==="pin_number"?[.45,.17,.16,.96]:e?.kind==="pin_body"?[.28,.18,.18,.88]:e?.kind==="symbol_body"||e?.kind==="symbol_instance"?[.42,.18,.18,.72]:e?.kind==="symbol_reference"||e?.kind==="symbol_value"?[.05,.13,.16,.94]:e?.kind==="text"||String(t||"").startsWith("text")?[.05,.13,.16,.94]:[.16,.17,.19,.7])}function sr(e,t,a=""){let s=ws(e,t,a);return[s[0]*.72,s[1]*.72,s[2]*.72,Math.min(s[3],.38)]}function fl(e,t,a){return a?5.5:["pin_name","pin_number"].includes(String(e?.kind||""))?1.5:e?.kind==="pin_body"?1.7:String(t||"").startsWith("text")?1.35:t==="bus"||e?.kind==="bus"?4.2:zt(e)?2.6:e?.kind==="symbol_body"||e?.kind==="symbol_instance"||e?.kind==="sheet"?1.5:1.25}function Ia(e,t,a,s){return e[t++]=a[0],e[t++]=a[1],e[t++]=s[0],e[t++]=s[1],e[t++]=s[2],e[t++]=s[3],t}function bl(e,t,a,s,n,r){let i=rr(a,s,n);if(!i)return t;for(let o of i)t=Ia(e,t,o,r);return t}function ul(e,t,a,s,n,r){return t=Ia(e,t,a,r),t=Ia(e,t,s,r),t=Ia(e,t,n,r),t}function jt(e,t,a,s,n){return e[t++]=a[0],e[t++]=a[1],e[t++]=s,e[t++]=n,t}function hl(e,t,a,s,n,r,i,o){let c=s[0]-a[0],b=s[1]-a[1],g=Math.hypot(c,b);if(g<1e-6||t+24>e.length)return t;let h=n*.5,w=c/g,f=-(b/g)*h,d=w*h,m=[a[0]+f,a[1]+d],l=[a[0]-f,a[1]-d],u=[s[0]+f,s[1]+d],p=[s[0]-f,s[1]-d],v=i+g/Math.max(o,1e-6);return t=jt(e,t,m,i,r),t=jt(e,t,l,i,r),t=jt(e,t,u,v,r),t=jt(e,t,u,v,r),t=jt(e,t,l,i,r),t=jt(e,t,p,v,r),t}function rr(e,t,a){let s=t[0]-e[0],n=t[1]-e[1],r=Math.hypot(s,n);if(r<1e-6)return null;let i=a*.5,o=s/r*i,c=n/r*i,b=-n/r*i,g=s/r*i,h=[e[0]-o,e[1]-c],w=[t[0]+o,t[1]+c],y=[h[0]+b,h[1]+g],f=[h[0]-b,h[1]-g],d=[w[0]+b,w[1]+g],m=[w[0]-b,w[1]-g];return[y,f,d,d,f,m]}function gl(e,t,a){let s=a[0]-t[0],n=a[1]-t[1],r=s*s+n*n||1,i=ie(((e[0]-t[0])*s+(e[1]-t[1])*n)/r,0,1),o=t[0]+s*i,c=t[1]+n*i;return Math.hypot(e[0]-o,e[1]-c)}function pl(e,t){let[a,s,n,r]=t,[i,o]=e.a,[c,b]=e.b,g=1e-6,h=(w,y)=>({...e,a:w,b:y});if(Math.abs(o-b)<=g){let w=o;if(w<s-g||w>r+g)return[e];let y=Math.min(i,c),f=Math.max(i,c),d=Math.max(y,a),m=Math.min(f,n);if(m<=d+g)return[e];let l=[],u=i<=c;if(y<d-g){let p=u?[y,w]:[d,w],v=u?[d,w]:[y,w];l.push(h(p,v))}if(m<f-g){let p=u?[m,w]:[f,w],v=u?[f,w]:[m,w];l.push(h(p,v))}return l}if(Math.abs(i-c)<=g){let w=i;if(w<a-g||w>n+g)return[e];let y=Math.min(o,b),f=Math.max(o,b),d=Math.max(y,s),m=Math.min(f,r);if(m<=d+g)return[e];let l=[],u=o<=b;if(y<d-g){let p=u?[w,y]:[w,d],v=u?[w,d]:[w,y];l.push(h(p,v))}if(m<f-g){let p=u?[w,m]:[w,f],v=u?[w,f]:[w,m];l.push(h(p,v))}return l}return[e]}function ka(e,t,a,s){let n=t*12;e.setFloat32(n,a[0],!0),e.setFloat32(n+4,a[1],!0),e.setUint32(n+8,s,!0)}function ml(e,t,a,s,n,r){let i=rr(a,s,n);if(!i)return t;for(let o of i)ka(e,t,o,r),t+=1;return t}function vs(e,t,a,s,n,r){return ka(e,t,a,r),ka(e,t+1,s,r),ka(e,t+2,n,r),t+3}var Xt="http://www.w3.org/2000/svg";var xl=new Set(["script","foreignobject","iframe","object","embed"]),yl=new Set(["href","xlink:href"]),vl=1,wl=18,Tl=8,_a=class e{static create(t,a,s,n,r={}){return new e(t,a,s,n,r)}constructor(t,a,s,n,r){this.host=t,this.manifestUrl=a,this.manifest=s,this.featuresByPage=n||{},this.callbacks=r,this.activePage=null,this.activeSvgUrl="",this.container=null,this.svg=null,this.overlay=null,this.mountedPages=new Map,this.loadingPages=new Map,this.svgCache=new Map,this.serial=0,this.maxMountedWorldPages=vl,this.maxCachedSvgPages=wl,this.worldHandlersInstalled=!1,this.worldDrag=null,this.view={scale:1,tx:0,ty:0},this.drag=null,this.selected=null,this.highlightedNetUid="",this.index=dr(),this.lastStats={mountedPages:0,domNodes:0,indexedFeatures:0,indexedNets:0,mountMs:0,coldMounts:0,warmMounts:0,highlightMs:0,selectionMs:0,cachedSvgPages:0,cachedSvgBytes:0,heapMb:null,fallbackReason:""}}get active(){return!!(this.container&&this.activePage)}get worldActive(){return this.mountedPages.size>0}stats(){return{...this.lastStats,activePage:this.activePage?.name||[...this.mountedPages.values()][0]?.page?.name||"-",mountedPages:this.active?1:this.mountedPages.size}}dispose(){this.unmountPage(),this.unmountWorldPages()}unmountPage(){this.container?.remove(),this.container=null,this.svg=null,this.overlay=null,this.activePage=null,this.activeSvgUrl="",this.index=dr(),this.host.hidden=!0}unmountWorldPages(){for(let t of this.mountedPages.values())t.container.remove();this.mountedPages.clear(),this.loadingPages.clear(),this.active||(this.host.hidden=!0)}async preloadPages(t){let a=performance.now(),s=await Promise.allSettled((t||[]).slice(0,Tl).map(n=>this.loadSvgTemplate(n)));this.lastStats.preloadedPages=s.filter(n=>n.status==="fulfilled"&&n.value).length,this.lastStats.preloadMs=performance.now()-a,this.updateCacheStats()}syncWorldPages(t,a,s={}){if(!a)return;this.installWorldHandlers(a);let n=(t||[]).slice(0,s.maxMountedPages||this.maxMountedWorldPages),r=new Set(n.map(i=>i.id));for(let[i,o]of this.mountedPages)r.has(i)||(o.container.remove(),this.mountedPages.delete(i));for(let i of n){let o=this.mountedPages.get(i.id);if(o)o.lastUsed=++this.serial,this.positionWorldEntry(o,a);else if(!this.loadingPages.has(i.id)){let c=this.mountWorldPage(i).then(b=>{b&&r.has(i.id)?this.positionWorldEntry(b,a):b?.container.remove()}).finally(()=>this.loadingPages.delete(i.id));this.loadingPages.set(i.id,c)}}this.pruneMountedWorldPages(r),this.host.hidden=n.length===0&&!this.active,this.setSelection(this.selected),this.setHighlightedNet(s.activeNetUid??this.highlightedNetUid),this.lastStats.mountedPages=this.mountedPages.size,this.updateCacheStats()}async mountWorldPage(t){let a=performance.now(),s=this.hasCachedSvg(t),n=await this.loadImportedSvg(t);if(!n)return null;let r=document.createElement("div");r.className="svg-dom-page svg-dom-world-page",r.dataset.pageId=t.id,r.append(n),this.host.append(r);let i=or(n),o=cr(n),c=ir(n,t,this.featuresByPage[t.id]||[]),b={page:t,container:r,svg:n,overlay:i,selectionOverlay:o,index:c,mountMs:performance.now()-a,lastUsed:++this.serial,warm:s};return this.mountedPages.set(t.id,b),this.lastStats={...this.lastStats,mountedPages:this.mountedPages.size,domNodes:[...this.mountedPages.values()].reduce((g,h)=>g+h.svg.querySelectorAll("*").length,0),indexedFeatures:[...this.mountedPages.values()].reduce((g,h)=>g+h.index.featureToElements.size,0),indexedNets:new Set([...this.mountedPages.values()].flatMap(g=>[...g.index.netToElements.keys()])).size,mountMs:b.mountMs,coldMounts:this.lastStats.coldMounts+(b.warm?0:1),warmMounts:this.lastStats.warmMounts+(b.warm?1:0),fallbackReason:""},this.updateCacheStats(),b}async loadImportedSvg(t){let a=await this.loadSvgTemplate(t);return a?a.cloneNode(!0):null}async loadSvgTemplate(t){let a=this.svgUrlForPage(t),s=this.svgCache.get(a);if(s?.template)return s.lastUsed=++this.serial,s.template;if(s?.promise)return s.promise;let n=performance.now(),r=(async()=>{let i=await fetch(a,{cache:"default"});if(!i.ok)return this.lastStats.fallbackReason=`Failed to load SVG page ${t.id}: ${i.status}`,this.callbacks.onFallback?.(this.lastStats.fallbackReason),null;let o=await i.text(),b=new DOMParser().parseFromString(o,"image/svg+xml"),g=b.documentElement;if(!g||g.localName.toLowerCase()!=="svg"||b.querySelector("parsererror"))return this.lastStats.fallbackReason=`Invalid SVG for page ${t.id}`,this.callbacks.onFallback?.(this.lastStats.fallbackReason),null;El(b,a,t.id);let h=document.importNode(g,!0);h.classList.add("svg-dom-page-svg"),Sl(h);let w=this.svgCache.get(a)||{};return Object.assign(w,{template:h,promise:null,pageId:t.id,byteLength:o.length*2,loadMs:performance.now()-n,lastUsed:++this.serial}),this.svgCache.set(a,w),this.pruneSvgCache(),this.updateCacheStats(),h})();return this.svgCache.set(a,{promise:r,pageId:t.id,byteLength:0,loadMs:0,lastUsed:++this.serial}),r}svgUrlForPage(t){return new URL(t.svg||t.thumbnail?.path,this.manifestUrl).toString()}positionWorldEntry(t,a){let{page:s,container:n}=t,[r,i]=a.worldToScreen(s.worldX,s.worldY),[o,c]=a.worldToScreen(s.worldX+s.widthMm,s.worldY+s.heightMm),b=Math.max(1,o-r),g=Math.max(1,c-i);n.style.transform=`translate3d(${r}px, ${i}px, 0)`,n.style.width=`${b}px`,n.style.height=`${g}px`}installWorldHandlers(t){if(this.worldHandlersInstalled)return;this.worldHandlersInstalled=!0;let a=this.host;a.oncontextmenu=s=>s.preventDefault(),a.onpointerdown=s=>{let n=s.button===0&&!s.shiftKey&&!!s.target.closest?.("text"),i=s.target.closest?.("[data-feature-key]")?null:this.featureAtEvent(s);this.worldDrag={pointerId:s.pointerId,startX:s.clientX,startY:s.clientY,lastX:s.clientX,lastY:s.clientY,button:s.button,moved:!1,pan:!n&&(s.button===0||s.button===1||s.shiftKey),allowTextSelection:n},n||a.setPointerCapture(s.pointerId)},a.onpointermove=s=>{if(!this.worldDrag||this.worldDrag.pointerId!==s.pointerId)return;let n=s.clientX-this.worldDrag.lastX,r=s.clientY-this.worldDrag.lastY;this.worldDrag.lastX=s.clientX,this.worldDrag.lastY=s.clientY,Math.hypot(s.clientX-this.worldDrag.startX,s.clientY-this.worldDrag.startY)>3&&(this.worldDrag.moved=!0),this.worldDrag.pan&&t.pan(n,r)},a.onpointerup=s=>{if(!this.worldDrag||this.worldDrag.pointerId!==s.pointerId)return;let n=this.worldDrag;if(this.worldDrag=null,n.allowTextSelection||a.releasePointerCapture(s.pointerId),n.button!==0||n.moved)return;let r=s.target.closest?.("[data-feature-key]");if(r)this.selectElement(r,s);else{let i=this.featureAtEvent(s);i?this.selectFeature(i.entry,i.feature,s):this.callbacks.onBlank?.()}},a.ondblclick=s=>{let n=s.target.closest?.("[data-feature-key]"),r=n?null:this.featureAtEvent(s),i=r?.entry||this.entryForPoint(s.clientX,s.clientY),o=n?this.selectionFromElement(n):r?this.selectionFromFeature(r.entry,r.feature):this.selected;lr(o)?this.callbacks.onOpenPage?.(o):o?.netUid?this.callbacks.onHighlightNet?.(o.netUid,o):!r&&i?.page&&this.callbacks.onOpenPage?.({kind:"page",pageId:i.page.id,page:i.page})},a.onwheel=s=>{s.preventDefault(),Math.abs(s.deltaX)>Math.abs(s.deltaY)*.65?t.pan(-s.deltaX,-s.deltaY):t.zoom(s.deltaY,s.clientX,s.clientY)}}async focusPage(t,a={}){if(!t)return!1;if(this.activePage?.id===t.id&&this.active)return a.frame!==!1&&this.fitPage(),!0;let s=performance.now(),n=await this.loadImportedSvg(t);if(!n)return!1;let r=document.createElement("div");return r.className="svg-dom-page",r.append(n),this.host.replaceChildren(r),this.host.hidden=!1,this.container=r,this.svg=n,this.activePage=t,this.activeSvgUrl=new URL(t.svg||t.thumbnail?.path,this.manifestUrl).toString(),this.overlay=or(n),this.selectionOverlay=cr(n),this.index=ir(n,t,this.featuresByPage[t.id]||[]),this.installPageHandlers(),this.fitPage(),this.setSelection(this.selected),this.setHighlightedNet(this.highlightedNetUid),this.lastStats={...this.lastStats,mountedPages:1,domNodes:n.querySelectorAll("*").length,indexedFeatures:this.index.featureToElements.size,indexedNets:this.index.netToElements.size,mountMs:performance.now()-s,fallbackReason:""},this.updateCacheStats(),!0}installPageHandlers(){let t=this.host;t.oncontextmenu=a=>a.preventDefault(),t.onpointerdown=a=>{if(!this.active)return;let s=a.button===0&&!a.shiftKey&&!!a.target.closest?.("text"),n=a.target.closest?.("[data-feature-key]"),r=n?null:this.featureAtEvent(a);this.drag={pointerId:a.pointerId,startX:a.clientX,startY:a.clientY,lastX:a.clientX,lastY:a.clientY,button:a.button,moved:!1,pan:!s&&(a.button===0||a.button===1||a.shiftKey),featureElement:n,allowTextSelection:s},s||t.setPointerCapture(a.pointerId)},t.onpointermove=a=>{if(!this.drag||this.drag.pointerId!==a.pointerId)return;let s=a.clientX-this.drag.lastX,n=a.clientY-this.drag.lastY;this.drag.lastX=a.clientX,this.drag.lastY=a.clientY,Math.hypot(a.clientX-this.drag.startX,a.clientY-this.drag.startY)>3&&(this.drag.moved=!0),this.drag.pan&&(this.view.tx+=s,this.view.ty+=n,this.applyTransform())},t.onpointerup=a=>{if(!this.drag||this.drag.pointerId!==a.pointerId)return;let s=this.drag;if(this.drag=null,s.allowTextSelection||t.releasePointerCapture(a.pointerId),s.button!==0||s.moved)return;let n=a.target.closest?.("[data-feature-key]");if(n)this.selectElement(n,a);else{let r=this.featureAtEvent(a);r?this.selectFeature(r.entry,r.feature,a):this.callbacks.onBlank?.()}},t.ondblclick=a=>{let s=a.target.closest?.("[data-feature-key]"),n=s?null:this.featureAtEvent(a),r=s?this.selectionFromElement(s):n?this.selectionFromFeature(n.entry,n.feature):this.selected;lr(r)?this.callbacks.onOpenPage?.(r):r?.netUid?this.callbacks.onHighlightNet?.(r.netUid,r):!n&&this.activePage&&this.callbacks.onOpenPage?.({kind:"page",pageId:this.activePage.id,page:this.activePage})},t.onwheel=a=>{if(a.preventDefault(),!this.active)return;if(Math.abs(a.deltaX)>Math.abs(a.deltaY)*.65){this.view.tx-=a.deltaX,this.view.ty-=a.deltaY,this.applyTransform();return}let s=this.host.getBoundingClientRect(),n=a.clientX-s.left,r=a.clientY-s.top,i=this.screenToSvg(n,r),o=Math.exp(-a.deltaY*.0016);this.view.scale=Aa(this.view.scale*o,.02,80),this.view.tx=n-i[0]*this.view.scale,this.view.ty=r-i[1]*this.view.scale,this.applyTransform()}}selectElement(t,a){let s=performance.now(),n=this.selectionFromElement(t);if(this.setSelection(n),a){let r=this.host.getBoundingClientRect();n.anchor={x:a.clientX-r.left,y:a.clientY-r.top}}this.callbacks.onSelect?.(n),this.lastStats.selectionMs=performance.now()-s}selectFeature(t,a,s){let n=performance.now(),r=this.selectionFromFeature(t,a);if(this.setSelection(r),s){let i=this.host.getBoundingClientRect();r.anchor={x:s.clientX-i.left,y:s.clientY-i.top}}this.callbacks.onSelect?.(r),this.lastStats.selectionMs=performance.now()-n}selectionFromElement(t){let a=t.dataset.featureKey||"",s=this.entryForElement(t),n=s.index.featureByKey.get(a)||{};return this.selectionFromFeature(s,n,t)}selectionFromFeature(t,a,s=null){let n=a?.stableKey||s?.dataset?.featureKey||"",r=t?.page||this.activePage,i=a?.kind||s?.dataset?.role||s?.dataset?.primitive||"feature",o=a?.netUid||s?.dataset?.netUid||"",c=a?.netName||s?.dataset?.netName||"";return i==="sheet"?{kind:"sheet",featureKey:n,sheetInstancePath:a?.sheetInstancePath||r?.sheetInstancePath||"",sourceId:a?.sourceId||s?.dataset?.sourceId||s?.dataset?.objectId||s?.dataset?.uuid||"",sheetName:a?.sheet_name||a?.sheetName||s?.dataset?.sheetName||a?.objectId||"",sheetFile:a?.sheet_file||a?.sheetFile||s?.dataset?.sheetFile||"",feature:a}:i==="pin"||i==="pin_body"||i==="pin_name"||i==="pin_number"||s?.dataset?.pin?{kind:"pin",featureKey:n,sheetInstancePath:a?.sheetInstancePath||r?.sheetInstancePath||"",sourceId:a?.sourceId||s?.dataset?.sourceId||s?.dataset?.objectId||s?.dataset?.uuid||"",symbolUuid:a?.symbolUuid||s?.dataset?.symbolUuid||"",reference:a?.reference||s?.dataset?.designator||s?.dataset?.component||s?.dataset?.ref||"",pinNumber:a?.pinNumber||s?.dataset?.pin||"",pinName:a?.pinName||"",netUid:o,netName:c,feature:a}:i==="symbol_body"||i==="symbol_instance"||i==="component"||s?.dataset?.ref?{kind:"component",featureKey:n,sheetInstancePath:a?.sheetInstancePath||r?.sheetInstancePath||"",sourceId:a?.sourceId||s?.dataset?.sourceId||s?.dataset?.objectId||s?.dataset?.uuid||"",symbolUuid:a?.symbolUuid||s?.dataset?.symbolUuid||"",reference:a?.reference||s?.dataset?.designator||s?.dataset?.component||s?.dataset?.ref||"",netUid:o,netName:c,feature:a}:{kind:o?"feature":i,featureKey:n,sheetInstancePath:a?.sheetInstancePath||r?.sheetInstancePath||"",sourceId:a?.sourceId||s?.dataset?.sourceId||s?.dataset?.objectId||s?.dataset?.uuid||"",role:i,netUid:o,netName:c,feature:a}}setSelection(t){this.selected=t||null;for(let s of this.host.querySelectorAll(".prism-svg-selected"))s.classList.remove("prism-svg-selected");for(let s of this.host.querySelectorAll("[data-prism-overlay='selection']"))s.replaceChildren();let a=t?.featureKey||"";if(a){for(let s of this.entries()){for(let n of s.index.featureToElements.get(a)||[])n.classList.add("prism-svg-selected");this.drawSelectionOverlay(s,t)}for(let s of this.index.featureToElements.get(a)||[])s.classList.add("prism-svg-selected");this.drawSelectionOverlay({page:this.activePage,index:this.index,selectionOverlay:this.selectionOverlay},t)}}setHighlightedNet(t){this.highlightedNetUid=t||"";let a=performance.now();for(let s of this.entries())this.updateEntryHighlight(s);if(!this.svg||!this.overlay){this.lastStats.highlightMs=performance.now()-a;return}this.updateEntryHighlight({svg:this.svg,overlay:this.overlay,index:this.index,page:this.activePage}),this.lastStats.highlightMs=performance.now()-a}updateEntryHighlight(t){if(!t?.svg||!t?.overlay||(t.overlay.replaceChildren(),!this.highlightedNetUid))return;let a=Sa(t.svg,t.page),s=document.createElementNS(Xt,"rect");s.setAttribute("x",String(a[0])),s.setAttribute("y",String(a[1])),s.setAttribute("width",String(a[2])),s.setAttribute("height",String(a[3])),s.setAttribute("class","prism-svg-net-dimmer"),t.overlay.append(s);let r=(t.index.netToElements.get(this.highlightedNetUid)||[]).slice(0,2200);for(let i of r){let o=_l(i);t.overlay.append(o)}}entries(){return[...this.mountedPages.values()]}entryForElement(t){let s=t.closest?.(".svg-dom-page")?.dataset.pageId||"";return this.mountedPages.get(s)||{page:this.activePage,index:this.index,svg:this.svg,overlay:this.overlay,selectionOverlay:this.selectionOverlay}}featureAtEvent(t){let a=this.entryForPoint(t.clientX,t.clientY);if(!a)return null;let s=this.clientToSvg(a,t.clientX,t.clientY);if(!s)return null;let n=Math.max(.18,5*jl(a)),i=a.index.features.filter(o=>(o?.domBoundsMm||o?.boundsMm)&&ur(o)).filter(o=>s[0]>=(o.domBoundsMm||o.boundsMm)[0]-n&&s[0]<=(o.domBoundsMm||o.boundsMm)[2]+n&&s[1]>=(o.domBoundsMm||o.boundsMm)[1]-n&&s[1]<=(o.domBoundsMm||o.boundsMm)[3]+n).map(o=>({feature:o,priority:Ol(o),area:Math.max(1e-4,((o.domBoundsMm||o.boundsMm)[2]-(o.domBoundsMm||o.boundsMm)[0])*((o.domBoundsMm||o.boundsMm)[3]-(o.domBoundsMm||o.boundsMm)[1]))})).sort((o,c)=>c.priority-o.priority||o.area-c.area)[0]?.feature;return i?{entry:a,feature:i,point:s}:null}entryForPoint(t,a){for(let s of[...this.entries()].reverse()){let n=s.container.getBoundingClientRect();if(t>=n.left&&t<=n.right&&a>=n.top&&a<=n.bottom)return s}if(this.container){let s=this.container.getBoundingClientRect();if(t>=s.left&&t<=s.right&&a>=s.top&&a<=s.bottom)return{page:this.activePage,container:this.container,svg:this.svg,index:this.index,selectionOverlay:this.selectionOverlay}}return null}clientToSvg(t,a,s){if(!t?.container||!t?.svg||!t?.page)return null;let n=t.container.getBoundingClientRect();if(!n.width||!n.height)return null;let r=Sa(t.svg,t.page);return[r[0]+(a-n.left)/n.width*r[2],r[1]+(s-n.top)/n.height*r[3]]}drawSelectionOverlay(t,a){if(!t?.selectionOverlay||!a?.featureKey)return;let s=t.index.featureByKey.get(a.featureKey),n=s?.domBoundsMm||s?.boundsMm;if(!n)return;let[r,i,o,c]=n,b=document.createElementNS(Xt,"rect");b.setAttribute("x",String(r)),b.setAttribute("y",String(i)),b.setAttribute("width",String(Math.max(.001,o-r))),b.setAttribute("height",String(Math.max(.001,c-i))),b.setAttribute("rx","0.65"),b.setAttribute("ry","0.65"),b.setAttribute("class","prism-svg-selection-box"),t.selectionOverlay.append(b)}fitPage(){if(!this.svg||!this.activePage)return;let t=Sa(this.svg,this.activePage),a=t[2]||this.activePage.sourceWidthMm||this.activePage.widthMm||1,s=t[3]||this.activePage.sourceHeightMm||this.activePage.heightMm||1,n=this.host.getBoundingClientRect(),r=Math.min(n.width/a,n.height/s)*.92;this.view.scale=Aa(r,.02,80),this.view.tx=(n.width-a*this.view.scale)/2-t[0]*this.view.scale,this.view.ty=(n.height-s*this.view.scale)/2-t[1]*this.view.scale,this.applyTransform()}frameSelection(t=this.selected){if(!t?.featureKey||!this.active){this.fitPage();return}let a=this.index.featureToElements.get(t.featureKey)||[],s=br(a);if(!s)return;let n=this.host.getBoundingClientRect(),r=Math.max(1,s[2]-s[0]),i=Math.max(1,s[3]-s[1]),o=Math.min(n.width/r,n.height/i)*.36;this.view.scale=Aa(o,.04,80),this.view.tx=n.width/2-(s[0]+s[2])/2*this.view.scale,this.view.ty=n.height/2-(s[1]+s[3])/2*this.view.scale,this.applyTransform()}pan(t,a){this.active&&(this.view.tx+=t,this.view.ty+=a,this.applyTransform())}zoom(t,a,s){if(!this.active)return;let n=this.host.getBoundingClientRect(),r=(a??n.left+n.width/2)-n.left,i=(s??n.top+n.height/2)-n.top,o=this.screenToSvg(r,i),c=Math.exp(-t*.0016);this.view.scale=Aa(this.view.scale*c,.02,80),this.view.tx=r-o[0]*this.view.scale,this.view.ty=i-o[1]*this.view.scale,this.applyTransform()}screenToSvg(t,a){return[(t-this.view.tx)/Math.max(1e-6,this.view.scale),(a-this.view.ty)/Math.max(1e-6,this.view.scale)]}applyTransform(){this.container&&(this.container.style.transform=`translate3d(${this.view.tx}px, ${this.view.ty}px, 0) scale(${this.view.scale})`)}hasCachedSvg(t){return!!this.svgCache.get(this.svgUrlForPage(t))?.template}pruneMountedWorldPages(t=new Set){if(this.mountedPages.size<=this.maxMountedWorldPages)return;let a=[...this.mountedPages.entries()].filter(([s])=>!t.has(s)).sort((s,n)=>(s[1].lastUsed||0)-(n[1].lastUsed||0));for(let[s,n]of a){if(this.mountedPages.size<=this.maxMountedWorldPages)break;n.container.remove(),this.mountedPages.delete(s)}}pruneSvgCache(){let t=[...this.svgCache.entries()].filter(([,n])=>n?.template);if(t.length<=this.maxCachedSvgPages)return;let a=new Set([...this.mountedPages.values()].map(n=>this.svgUrlForPage(n.page)));this.activePage&&a.add(this.svgUrlForPage(this.activePage));let s=t.filter(([n])=>!a.has(n)).sort((n,r)=>(n[1].lastUsed||0)-(r[1].lastUsed||0));for(let[n]of s){if([...this.svgCache.values()].filter(r=>r?.template).length<=this.maxCachedSvgPages)break;this.svgCache.delete(n)}}updateCacheStats(){let t=[...this.svgCache.values()].filter(s=>s?.template);this.lastStats.cachedSvgPages=t.length,this.lastStats.cachedSvgBytes=t.reduce((s,n)=>s+(n.byteLength||0),0);let a=performance?.memory;this.lastStats.heapMb=a?.usedJSHeapSize?a.usedJSHeapSize/1048576:null}};function El(e,t,a){for(let r of[...e.querySelectorAll("*")]){if(xl.has(r.localName.toLowerCase())){r.remove();continue}for(let i of[...r.attributes]){let o=i.name,c=o.toLowerCase(),b=i.value||"";if(c.startsWith("on")){r.removeAttribute(o);continue}if((c==="href"||c==="xlink:href"||c==="src")&&hr(b)){if((c==="href"||c==="xlink:href")&&r.localName.toLowerCase()==="image"&&Bl(b))continue;r.removeAttribute(o);continue}c==="style"&&r.setAttribute(o,Pl(b))}}let s=`prism-${Ts(a)}-`,n=new Map;for(let r of e.querySelectorAll("[id]")){let i=r.getAttribute("id"),o=`${s}${Ts(i)}`;n.set(i,o),r.setAttribute("id",o)}for(let r of e.querySelectorAll("*"))for(let i of[...r.attributes]){let o=i.name.toLowerCase(),c=i.value||"";yl.has(o)&&(c.startsWith("#")&&n.has(c.slice(1))?c=`#${n.get(c.slice(1))}`:Dl(c)&&(c=new URL(c,t).toString())),c=Ul(c,n),r.setAttribute(i.name,c)}}function ir(e,t,a){let s=new Map,n=new Map,r=new Map,i=[];for(let g of a){let h=kl(g,t);i.push(h),n.set(h.stableKey,h),r.set(Number(h.id||0),h);for(let w of Ml(h))s.has(w)||s.set(w,[]),s.get(w).push(h)}let o=new Map,c=new Map,b=new Map;for(let g of i)b.set(g.stableKey,g);for(let g of e.querySelectorAll("[data-uuid], [data-element-key], [data-primitive], [data-ref], [data-pin], [data-object-id], [data-designator], [data-component]")){let h=Rl(g,s,t);if(h&&!ur(h)||!h&&!Cl(g))continue;let w=Al(g,t),y=h?.stableKey||w,f=h?.netUid||"",d=h?.netName||"";g.classList.add("prism-feature"),g.dataset.featureKey=y,g.dataset.sourceId=h?.sourceId||g.dataset.uuid||g.dataset.elementKey||"",g.dataset.role=h?.kind||g.dataset.primitive||g.dataset.ref||"feature",h?.id&&(g.dataset.featureId=String(h.id)),f&&(g.dataset.netUid=f),d&&(g.dataset.netName=d),g.id||(g.id=`prism-feature-${Ts(y)}`),fr(o,y,g),b.set(y,h||{id:0,stableKey:y,kind:g.dataset.role,sourceId:g.dataset.sourceId,sheetInstancePath:t.sheetInstancePath||""}),f&&fr(c,f,g)}for(let[g,h]of o){let w=b.get(g),y=br(h);w&&y&&(w.domBoundsMm=Nl(w.boundsMm,y))}return{featureToElements:o,netToElements:c,featureByKey:b,byId:r,bySource:s,features:i}}function Rl(e,t,a){let n=[e.dataset.uuid,e.dataset.elementKey,e.dataset.sourceId,e.dataset.objectId,e.dataset.componentUid,e.dataset.componentUuid,e.dataset.ref&&`${e.dataset.ref}:${e.dataset.pin||""}`].filter(Boolean).flatMap(i=>t.get(i)||[]);if(!n.length)return null;let r=String(e.dataset.primitive||e.dataset.ref||e.dataset.pin||"").toLowerCase();return n.map(i=>({feature:i,score:Il(i,r,a)})).sort((i,o)=>o.score-i.score)[0].feature}function Il(e,t,a){let s=0,n=String(e.kind||"").toLowerCase();return e.sheetInstancePath===a.sheetInstancePath&&(s+=20),e.netUid&&(s+=4),t&&n.includes(t)&&(s+=8),t==="symbol"&&n==="symbol_body"&&(s+=12),(t==="label"||t==="port")&&(n.includes("label")||n.includes("port"))&&(s+=12),t==="sheet"&&n==="sheet"&&(s+=12),n!=="record"&&(s+=2),n.includes("pin")&&(s+=2),s}function kl(e,t){let a=e.sourceId||e.sourceUid||e.uuid||e.objectId||e.stableKey||"";return{...e,id:Number(e.id||0),sourceId:a,stableKey:e.stableKey||`${t.sheetInstancePath||t.id}|${a}|0|${e.kind||"feature"}|0`,sheetInstancePath:e.sheetInstancePath||t.sheetInstancePath||""}}function Ml(e){let t=new Set([e.sourceId,e.sourceUid,e.uuid,e.objectId,e.stableKey].filter(Boolean).map(String));return e.reference&&e.pinNumber&&t.add(`${e.reference}:${e.pinNumber}`),e.componentDesignator&&t.add(e.componentDesignator),e.reference&&t.add(e.reference),[...t]}function Al(e,t){let a=e.dataset.uuid||e.dataset.elementKey||e.dataset.objectId||e.dataset.ref||e.id||"svg",s=e.dataset.primitive||e.dataset.role||e.localName||"feature";return`${t.sheetInstancePath||t.id}|${a}|0|${s}|0`}function Sl(e){let t=document.createElementNS(Xt,"style");t.textContent=`
    .prism-feature { cursor: pointer; }
    .prism-svg-selected { outline: none; filter: drop-shadow(0 0 2.4px rgba(59,130,246,0.98)); }
    .prism-svg-selection-box {
      fill: rgba(59, 130, 246, 0.12);
      stroke: #3b82f6;
      stroke-width: 0.38mm;
      stroke-dasharray: 1.4 0.7;
      vector-effect: non-scaling-stroke;
      pointer-events: none;
    }
    .prism-svg-net-dimmer { fill: rgba(10, 14, 22, 0.055); pointer-events: none; }
    .prism-svg-net-overlay { pointer-events: none; }
    .prism-svg-net-overlay * {
      stroke: #18ef52 !important;
      fill: none !important;
      stroke-width: 0.34mm !important;
      vector-effect: non-scaling-stroke;
      opacity: 0.98;
    }
  `,e.prepend(t)}function or(e){let t=document.createElementNS(Xt,"g");return t.setAttribute("class","prism-svg-net-overlay"),t.setAttribute("data-prism-overlay","net-highlight"),e.append(t),t}function cr(e){let t=document.createElementNS(Xt,"g");return t.setAttribute("class","prism-svg-selection-overlay"),t.setAttribute("data-prism-overlay","selection"),t.style.pointerEvents="none",e.append(t),t}function _l(e){let t=e.cloneNode(!0);t.removeAttribute("id"),t.removeAttribute("data-feature-key"),t.removeAttribute("data-net-uid"),t.removeAttribute("data-net-name"),t.classList.add("prism-svg-net-overlay-clone");for(let a of[t,...Array.from(t.querySelectorAll?.("*")||[])])a instanceof SVGElement&&(a.removeAttribute("filter"),a.style.pointerEvents="none",a.style.stroke="#18ef52",a.style.fill="none",a.style.opacity="0.98",a.style.vectorEffect="non-scaling-stroke");return t}function br(e){let t=null;for(let a of e)if(a.getBBox)try{let s=a.getBBox(),n=[s.x,s.y,s.x+s.width,s.y+s.height];t=t?[Math.min(t[0],n[0]),Math.min(t[1],n[1]),Math.max(t[2],n[2]),Math.max(t[3],n[3])]:n}catch{}return t}function Nl(e,t){return e?t?[Math.min(e[0],t[0]),Math.min(e[1],t[1]),Math.max(e[2],t[2]),Math.max(e[3],t[3])]:e:t}function Sa(e,t){let a=e.getAttribute("viewBox");if(a){let s=a.trim().split(/[\s,]+/).map(Number);if(s.length===4&&s.every(Number.isFinite))return s}return[0,0,t.sourceWidthMm||t.widthMm||1,t.sourceHeightMm||t.heightMm||1]}function dr(){return{featureToElements:new Map,netToElements:new Map,featureByKey:new Map,byId:new Map,bySource:new Map,features:[]}}function jl(e){let t=e?.container?.getBoundingClientRect?.();if(!e?.svg||!e?.page||!t?.width||!t?.height)return .1;let a=Sa(e.svg,e.page);return Math.max(a[2]/t.width,a[3]/t.height)}function Fl(e){let t=String(e?.kind||"").toLowerCase(),a=String(e?.semanticRole||"").toLowerCase(),s=`${e?.sourceId||""} ${e?.objectId||""} ${e?.text||""}`.toLowerCase();return t.includes("page")||a.includes("page")||t.includes("background")||a.includes("background")||s.includes("background")||s.includes("sheet_header")||s.includes("sheet header")||s.includes("drawing-sheet")}function Ol(e){let t=String(e?.kind||e?.semanticRole||"").toLowerCase();return t.includes("pin")?90:t.includes("label")||t.includes("port")?78:t.includes("wire")||t.includes("bus")||t.includes("junction")?70:t.includes("symbol")||t.includes("component")?54:t.includes("image")?30:20}function ur(e){if(!e||Fl(e))return!1;let t=String(e.kind||e.semanticRole||"").toLowerCase();return["pin","label","port","wire","bus","junction","no_connect","symbol","component","sheet","image","text"].some(a=>t.includes(a))}function Cl(e){let t=`${e?.dataset?.primitive||""} ${e?.dataset?.ref||""} ${e?.dataset?.role||""} ${e?.dataset?.objectId||""} ${e?.dataset?.text||""}`.toLowerCase();return!t||t.includes("background")||t.includes("sheet_header")||t.includes("sheet header")||t.includes("drawing-sheet")?!1:["pin","label","port","wire","bus","junction","no_connect","symbol","component","sheet","image","text"].some(a=>t.includes(a))}function lr(e){return String(e?.kind||e?.feature?.kind||"").toLowerCase()==="sheet"}function fr(e,t,a){e.has(t)||e.set(t,[]),e.get(t).push(a)}function hr(e){let t=String(e||"").trim().toLowerCase();return!t||t.startsWith("#")?!1:t.startsWith("javascript:")||t.startsWith("data:")||t.startsWith("http://")||t.startsWith("https://")}function Bl(e){return/^data:image\/(?:png|jpe?g|gif|webp);base64,[a-z0-9+/=\s]+$/i.test(String(e||"").trim())}function Dl(e){let t=String(e||"").trim();return t&&!t.startsWith("#")&&!/^[a-z][a-z0-9+.-]*:/i.test(t)}function Pl(e){return String(e||"").replace(/url\(([^)]+)\)/gi,(t,a)=>{let s=a.trim().replace(/^['"]|['"]$/g,"");return hr(s)?"none":t})}function Ul(e,t){let a=String(e||"");return a=a.replace(/url\(#([^)]+)\)/g,(s,n)=>t.has(n)?`url(#${t.get(n)})`:s),a=a.replace(/^#(.+)$/,(s,n)=>t.has(n)?`#${t.get(n)}`:s),a}function Ts(e){return String(e||"").trim().replace(/[^a-zA-Z0-9_-]+/g,"-").replace(/^-+|-+$/g,"").slice(0,96)||"item"}function Aa(e,t,a){return Math.max(t,Math.min(a,e))}var Ll=512*1024*1024,Kl=.65,Gl=120,Vl=12,zl=48,Er=230,Xl=40,ql=4,Te=window.__TOPOLOGY__||{},De=window.__SEMANTIC_GEOMETRY__||{},ks=document,Tt,Z,Ie,Ms,As,Ss,Jt,Va,qe,Na,Ve,ge,Ee,ja,Ba,Da,we,J,za,Xa,Be,Q=e=>ks.querySelector(e),kt=e=>ks.querySelectorAll(e);function Hl(e=document){ks=e,Tt=Q("#app"),Z=Q("#viewport"),Ie=Q("#schematic-viewport"),Ms=Q("#schematic-dom-layer"),As=Q("#schematic-flow-overlay"),Ss=Q("#bom-view"),Jt=Q("#status"),Va=Q("#viewer-kind"),qe=Q("#selection")||{set textContent(t){}},Na=Q("#diagnostics")||{set innerHTML(t){}},Ve=Q("#layers"),ge=Q("#search-controls"),Ee=Q("#view-controls"),Be=Q("#stackup-workspace-view"),ja=Q("#fallback"),Ba=Q("#panel-labels"),Da=Q("#schematic-labels"),we=Q("#axis-gizmo"),J=Q("#selection-card"),za=Q("#primary-heading"),Xa=Q("#primary-description"),Tt.classList.add("workspace-pcb")}function Rr(){return{workspace:"pcb",mode:"3d",cameraTool:"orbit",compareLayers:new Set,desiredCompareLayers:new Set,visible3dLayers:new Set,activeNetId:0,selectedFeatureId:0,selectionAnchor:null,showBoard:!0,showComponents:!0,isolateNet:!1,separation:0,dragging:!1,dragMode:"orbit",lastX:0,lastY:0,pointerStartX:0,pointerStartY:0,loadedBytes:0,triangles:0,residentTileBytes:0,residentTileGpuBytes:0,residentTileTriangles:0,tileLoads:0,tileEvictions:0,tileSchedulerMs:0,lastTileScheduleAt:0,visibleTileIds:new Set,frameCpuMs:0,frameCpuP95Ms:0,frameIntervalMs:0,frameIntervalP95Ms:0,frameSamples:[],fps:0,frames:0,fpsAt:performance.now(),activeTab:"layers",selectedPageId:"",selectedSchematicFeature:null,schematicDragging:!1,schematicLastX:0,schematicLastY:0,schematicStartX:0,schematicStartY:0}}function Ir(){return{manifest:null,manifestUrl:"",layers:[],copperLayers:[],nets:[],features:new Map,tiles:new Map,loaded:new Set,loading:new Map,failed:new Map,residentTiles:new Map,componentFeatures:new Map,layerZOffsets:new Float32Array(256),layerZOffsetSignature:""}}function kr(){return{key:"",started:0,from:new Map,current:new Map}}function Mr(){return{phase:"idle",previous:new Set,target:new Set,previousOffsets:new Map,started:0}}function Ar(){return{manifest:null,manifestUrl:"",pages:[],byId:new Map,activeNetUid:"",visiblePages:[],fitted:!1,rendererMode:new URLSearchParams(location.search).get("schematicRenderer")||"svg-dom",domFallbackReason:""}}var x=Rr(),M=Ir(),me=kr(),K=Mr(),C=Ar(),Pa=[],ce,S,q,ze,H,Qe,Mt=new Map,Ht=performance.now(),Me=0,Fa=0,_s=null,Rs=!1,Ns=()=>!0,Ua=!0;!window.__PRISM_SEMANTIC_VIEWER_MANUAL_BOOT__&&document.getElementById("app")&&js().catch(e=>{console.error(e),Jt&&(Jt.textContent="Renderer failed"),ja&&(ja.hidden=!1,ja.textContent=e.stack||e.message||String(e))});function Wl(e){let t=new Map((e.components||[]).map(s=>[s.uid,s])),a={};for(let s of e.terminals||[]){let n=s.net_uid;if(!n)continue;let r=t.get(s.component_uid)||{},i={designator:s.designator||r.designator||"",pin:s.pin||"",value:r.value||"",pcb_pad_id:s.pcb_pad_id||""};a[n]||(a[n]={terminals:[]});let o=a[n].terminals;o.some(c=>c.designator===i.designator&&c.pin===i.pin)||o.push(i)}return a}function Jl(e){if(!e||!Te||!Te.physical_objects)return 0;let t=Te.physical_objects.find(s=>s.uid===e);if(!t||!t.source_ids||!t.source_ids.length)return 0;let a=t.source_ids[0];for(let[s,n]of M.features.entries())if(n.sourceUid===a)return s;return 0}function Sr(e){return!e||!Te||!Te.components?null:Te.components.find(t=>t.designator===e)}function qt(e,t){for(let a of Object.keys(e))delete e[a];Object.assign(e,t)}function _r(){Fa&&(cancelAnimationFrame(Fa),Fa=0),window.removeEventListener("keydown",Hr),ce?.dispose?.(),ce=null,S=null,q?.dispose?.(),q=null,ze=null,_s=null,Ns=()=>!0,Ua=!0}function Yl(){return Me+=1,_r(),qt(x,Rr()),qt(M,Ir()),qt(me,kr()),qt(K,Mr()),qt(C,Ar()),Pa=[],H=null,Qe=null,Mt=new Map,Ht=performance.now(),Me}function $l(e){e===Me&&(Me+=1,_r())}function Is(e){e===Me&&(Fa=requestAnimationFrame(t=>xf(t,e)))}function ke(e){return e===Me}async function js(e={}){let t=Yl();if(Te=e.topology||window.__TOPOLOGY__||{},Te&&!Te.net_details&&(Te.net_details=Wl(Te)),De=e.semanticGeometry||window.__SEMANTIC_GEOMETRY__||{},_s=typeof e.onSelectionChange=="function"?e.onSelectionChange:null,Ns=typeof e.isActive=="function"?e.isActive:()=>!0,Ua=e.workspaceScope!=="3d",Hl(e.root||document),!Tt||!Z)throw new Error("Semantic viewer shell is missing required DOM nodes");return await Zl(t),{setSelection(a){Rs=!0;try{if(!a)Ct();else if(a?.netName||a?.netUid){let s=M.nets.find(n=>a.netUid&&n.uid===a.netUid||a.netName&&n.name===a.netName);s&&La(Number(s.id),!0)}else a?.netId?La(Number(a.netId),!0):a?.featureId?Ot(Number(a.featureId),!0):a?.reference&&Ds(String(a.reference),!0)}finally{Rs=!1}},resize(){ce?.resize(),S?.resize(),x.workspace==="pcb"&&x.mode==="layer"&&Bs()},dispose(){$l(t)}}}function Fs(e){Rs||_s?.(e)}function Nr(e,t=null){return e?{kind:"net",sourceContext:"3D",netName:String(e.name||""),netUid:String(e.uid||"")||void 0,netCode:Number(e.id||0)||void 0,featureId:Number(t?.id||0)||void 0,uuid:String(t?.sourceUid||"")||void 0}:null}function Ql(e){if(!e)return null;let t=qr(e),a=String(e.padNumber||e.pin||e.pinNumber||""),s=M.nets.find(n=>Number(n.id)===Number(e.netId||0));if(t&&a)return{kind:"terminal",sourceContext:"3D",reference:t,pin:a,netUid:s?.uid,netName:s?.name,uuid:String(e.sourceUid||"")||void 0,featureId:Number(e.id||0)||void 0};if(t){let n=Sr(t);return{kind:"component",sourceContext:"3D",reference:t,componentUid:n?.uid,uuid:String(e.sourceUid||"")||void 0,featureId:Number(e.id||0)||void 0}}return Nr(s,e)}async function Zl(e){let t=De.assets?.scene_manifest||De.semantic_gltf?.path;if(!t)throw new Error("This bundle does not contain prism.semantic_gltf_a0");if(M.manifestUrl=new URL(t,location.href).toString(),M.manifest=await af(M.manifestUrl),!ke(e))return;if(M.manifest.schema!=="prism.semantic_gltf_a0")throw new Error(`Unsupported scene schema: ${M.manifest.schema}`);M.layers=M.manifest.layers||[],M.copperLayers=M.layers.filter(s=>s.role==="copper"||String(s.name).endsWith(".Cu")),M.nets=M.manifest.nets||[];for(let s of M.manifest.objectFeatures||[])M.features.set(Number(s.id),{...s,bounds:Os(s.boundsMm)});for(let s of M.manifest.components||[])M.componentFeatures.set(s.designator,s),M.features.set(Number(s.featureId),{...s,kind:"component",sourceUid:s.uid,netId:0,bounds:null});for(let s of M.manifest.tiles||[])M.tiles.set(s.id,s);let a=Fr();for(let s of a)x.compareLayers.add(s),x.desiredCompareLayers.add(s);for(let s of M.copperLayers)x.visible3dLayers.add(Number(s.id));if(ce=await Ta.create(Z),!ke(e)){ce?.dispose?.(),ce=null;return}H=new aa($t(M.manifest.bbox)),ce.setBarrels(M.manifest.barrels||[]),await gf(e),ke(e)&&(Ua&&(await ef(e),!ke(e)||(await tf(e),!ke(e)))||(Lr(),Df(),Ua&&(Kf(),Uf()),Nf(),Vf(),Jt.textContent="WebGPU semantic glTF active",pf(e),_e(performance.now(),{force:!0}),Is(e)))}async function ef(e=Me){let t=De.assets?.schematic_native_manifest||De.schematic_vector?.path||De.schematic_scene?.path,a=De.assets?.schematic_manifest||De.schematic_world?.path,s=Q("[data-workspace=schematic]");if(!t&&!a){s.disabled=!0,s.title="No schematic world assets are available";return}let n=[t,a].filter(Boolean),r=null;for(let o of n)try{C.manifestUrl=new URL(o,location.href).toString();let c=await Ma.create(Ie,C.manifestUrl);if(!ke(e))return;S=c,S.setFlowOverlayCanvas(As);break}catch(c){if(r=c,S=null,o===a)throw c}if(!S)throw r||new Error("Failed to load schematic viewer assets");C.manifest=S.manifest,C.pages=S.pages,C.byId=new Map(C.pages.map(o=>[o.id,o])),x.selectedPageId=C.pages[0]?.id||"",S.selectedPageId=x.selectedPageId,!["native","legacy","webgpu"].includes(String(C.rendererMode).toLowerCase())&&(q=_a.create(Ms,C.manifestUrl,C.manifest,S.featuresByPage,{onSelect:Af,onBlank:Qt,onHighlightNet:Gr,onOpenPage:kf,onFallback:o=>{C.domFallbackReason=o,console.warn(o)}}),q.preloadPages(C.pages)),S.preloadOverview()}async function tf(e=Me){let t=De.assets?.bom||De.bom?.path,a=Q("[data-workspace=bom]");if(!t){a&&(a.disabled=!0,a.title="No BoM artifact is available");return}try{let s=await sa.create(Ss,new URL(t,location.href).toString(),{onSelectReference:n=>Ds(n,!0)});if(!ke(e))return;ze=s}catch(s){if(!ke(e))return;console.warn(s),a&&(a.disabled=!0,a.title=s?.message||"BoM artifact could not be loaded")}}async function af(e){let t=await fetch(e,{cache:"default"});if(!t.ok)throw new Error(`Failed to load ${e}: ${t.status}`);return t.json()}async function sf(e,t=Me){if(!ke(t))return;let a=M.residentTiles.get(e.id);if(a){a.lastUsed=performance.now();return}if(M.failed.get(e.id))return;if(M.loading.has(e.id))return M.loading.get(e.id);let n=(async()=>{try{let r=await wa(new URL(e.path,M.manifestUrl).toString());if(!ke(t)||!ce)return;x.loadedBytes+=r.byteLength;let i=M.layers.find(h=>Number(h.id)===Number(e.layerId)),o=[],c=0,b=0;for(let h of r.primitives){let w=ce.addPrimitive(h,{kind:"copper",tileId:e.id,layerId:Number(e.layerId),color:Dr(i),baseZ:Number(i?.z_mm||0)/1e3,material:{baseColor:[1,1,1,1],metallic:.78,roughness:.32}});o.push(w),c+=h.indices.length/3,b+=nf(h)}let g={tile:e,entries:o,byteLength:r.byteLength,gpuBytes:b,triangles:c,lastUsed:performance.now(),pinned:!1};M.residentTiles.set(e.id,g),M.loaded.add(e.id),x.tileLoads+=1,x.residentTileBytes+=r.byteLength,x.residentTileGpuBytes+=b,x.residentTileTriangles+=c,x.triangles=x.residentTileTriangles,M.failed.delete(e.id)}catch(r){if(!ke(t))return;let i=M.failed.get(e.id)||{count:0,message:""};M.failed.set(e.id,{count:i.count+1,message:r?.message||String(r)}),i.count||console.warn(`Failed to load tile ${e.id}; suppressing retries until assets are regenerated`,r)}finally{ke(t)&&M.loading.delete(e.id)}})();return M.loading.set(e.id,n),n}function nf(e){return e.position.length/3*Xl+e.indices.length*ql}function rf(e){let t=M.residentTiles.get(e);t&&(ce.removeEntries(t.entries),M.residentTiles.delete(e),M.loaded.delete(e),x.residentTileBytes=Math.max(0,x.residentTileBytes-t.byteLength),x.residentTileGpuBytes=Math.max(0,x.residentTileGpuBytes-t.gpuBytes),x.residentTileTriangles=Math.max(0,x.residentTileTriangles-t.triangles),x.triangles=x.residentTileTriangles,x.tileEvictions+=1)}function _e(e=performance.now(),t={}){if(!ce||!H||x.workspace!=="pcb")return;let a=x.mode==="layer"&&K.phase==="preload";if(!t.force&&!a&&e-x.lastTileScheduleAt<Gl)return;let s=performance.now();x.lastTileScheduleAt=e;let n=of();x.visibleTileIds=n;let r=M.loading.size,o=Math.max(0,(a?zl:Vl)-r),c=[...n].map(g=>M.tiles.get(g)).filter(g=>g&&!M.residentTiles.has(g.id)&&!M.loading.has(g.id)&&!M.failed.has(g.id)).sort((g,h)=>gr(g)-gr(h)).slice(0,o),b=Me;for(let g of c)sf(g,b);for(let g of n){let h=M.residentTiles.get(g);h&&(h.lastUsed=e)}lf(n),x.tileSchedulerMs=performance.now()-s}function of(){let e=new Set,t=x.mode==="3d"?x.visible3dLayers:cf();if(!t.size||!Qe)return e;if(x.mode==="layer"){for(let s of M.tiles.values())t.has(Number(s.layerId))&&e.add(s.id);return e}let a=new Set;if(x.activeNetId)for(let s of M.tiles.values())t.has(Number(s.layerId))&&hf(s,x.activeNetId)&&a.add(s.id);for(let s of M.tiles.values()){if(!t.has(Number(s.layerId)))continue;let n=x.mode==="layer"?Mt.get(Number(s.layerId)):null;ff(s,Qe.matrix,n,Kl)&&e.add(s.id)}for(let s of a)e.add(s);return e}function cf(){return x.mode!=="layer"||K.phase==="idle"?x.compareLayers:Or(K.previous,K.target)}function jr(){return x.mode!=="layer"?x.visible3dLayers:K.phase==="reveal"?Or(K.previous,K.target):x.compareLayers}function Fr(){let e=M.copperLayers.map(t=>Number(t.id)).filter(Number.isFinite);return e.length?e.length===1?new Set([e[0]]):new Set([e[0],e[e.length-1]]):new Set}function df(){let e=x.desiredCompareLayers.size?x.desiredCompareLayers:x.compareLayers;return e.size?new Set([...e].map(Number)):Fr()}function Or(...e){let t=new Set;for(let a of e)for(let s of a||[])t.add(Number(s));return t}function lf(e){if(x.mode==="layer")return;let t=Ll;if(x.residentTileGpuBytes<=t)return;let a=[...M.residentTiles.values()].filter(s=>!e.has(s.tile.id)&&!M.loading.has(s.tile.id)).sort((s,n)=>s.lastUsed-n.lastUsed);for(let s of a){if(x.residentTileGpuBytes<=t)break;rf(s.tile.id)}}function ff(e,t,a=null,s=0){let n=Cr(e);if(!n)return!0;let r=Math.max(n[3]-n[0],n[4]-n[1])*s,i=[n[0]-r+(a?.[0]||0),n[1]-r+(a?.[1]||0),n[2]-.002,n[3]+r+(a?.[0]||0),n[4]+r+(a?.[1]||0),n[5]+.002];return bf(i,t)}function Cr(e){let t=e.boundsMm;if(!t||t.length!==4)return null;let a=M.layers.find(n=>Number(n.id)===Number(e.layerId)),s=Number(a?.z_mm||0)/1e3;return[t[0]/1e3,-t[3]/1e3,s-4e-4,t[2]/1e3,-t[1]/1e3,s+4e-4]}function bf(e,t){let a=[[e[0],e[1],e[2]],[e[3],e[1],e[2]],[e[0],e[4],e[2]],[e[3],e[4],e[2]],[e[0],e[1],e[5]],[e[3],e[1],e[5]],[e[0],e[4],e[5]],[e[3],e[4],e[5]]].map(n=>uf(t,n));return![n=>n[0]<-n[3],n=>n[0]>n[3],n=>n[1]<-n[3],n=>n[1]>n[3],n=>n[2]<0,n=>n[2]>n[3]].some(n=>a.every(n))}function uf(e,t){let a=t[0],s=t[1],n=t[2];return[e[0]*a+e[4]*s+e[8]*n+e[12],e[1]*a+e[5]*s+e[9]*n+e[13],e[2]*a+e[6]*s+e[10]*n+e[14],e[3]*a+e[7]*s+e[11]*n+e[15]]}function hf(e,t){return Array.isArray(e.netIds)&&e.netIds.some(a=>Number(a)===Number(t))}function gr(e){let t=Cr(e);if(!t||!H)return 0;let a=(t[0]+t[3])*.5-H.focus[0],s=(t[1]+t[4])*.5-H.focus[1];return a*a+s*s}async function gf(e=Me){let t=De.assets?.base_board_glb;if(!t)return;let a=await wa(new URL(t,location.href).toString(),{defaultFeatureId:0});if(!ke(e)||!ce)return;x.loadedBytes+=a.byteLength;let s=a.primitives.filter(n=>pr(n)!=="pad");for(let n of Br(s,pr))ce.addPrimitive(n,{kind:"board",boardRole:n.groupKey,layerId:0,material:n.material,color:n.material.baseColor})}function pr(e){let t=`${e.nodeName||""} ${e.meshName||""} ${e.material?.name||""}`.toLowerCase();return t.includes("_pad")||t.includes(".pad")||t.endsWith("pad")?"pad":t.includes("silkscreen")?"silkscreen":t.includes("soldermask")?"soldermask":"substrate"}async function pf(e=Me){let t=De.assets?.components_glb;if(!t)return;let a=await wa(new URL(t,location.href).toString(),{componentFeatures:M.componentFeatures});if(!(!ke(e)||!ce)){x.loadedBytes+=a.byteLength;for(let s of a.primitives){let n=M.componentFeatures.get(s.designator);n&&mf(n.featureId,s.position)}for(let s of Br(a.primitives))ce.addPrimitive(s,{kind:"component",layerId:0,material:s.material,color:s.material.baseColor})}}function Br(e,t=()=>""){let a=new Map;for(let s of e){let r=`${t(s)}:${JSON.stringify(s.material)}`;a.has(r)||a.set(r,[]),a.get(r).push(s)}return[...a.values()].map(s=>{let n=s.reduce((f,d)=>f+d.position.length/3,0),r=s.reduce((f,d)=>f+d.indices.length,0),i=new Float32Array(n*3),o=new Float32Array(n*3),c=new Uint32Array(n),b=new Uint32Array(n),g=new Uint32Array(r),h=0,w=0,y=[1/0,1/0,1/0,-1/0,-1/0,-1/0];for(let f of s){let d=f.position.length/3;i.set(f.position,h*3),o.set(f.normal,h*3),c.set(f.netId,h),b.set(f.objectFeatureId,h);for(let m=0;m<f.indices.length;m+=1)g[w+m]=Number(f.indices[m])+h;f.bounds&&(y[0]=Math.min(y[0],f.bounds[0]),y[1]=Math.min(y[1],f.bounds[1]),y[2]=Math.min(y[2],f.bounds[2]),y[3]=Math.max(y[3],f.bounds[3]),y[4]=Math.max(y[4],f.bounds[4]),y[5]=Math.max(y[5],f.bounds[5])),h+=d,w+=f.indices.length}return{position:i,normal:o,netId:c,objectFeatureId:b,indices:g,material:s[0].material,groupKey:t(s[0]),bounds:Number.isFinite(y[0])?y:null}})}function Os(e){return!e||e.length!==6?null:[e[0]/1e3,-e[4]/1e3,e[2]/1e3,e[3]/1e3,-e[1]/1e3,e[5]/1e3]}function $t(e){let t=e?.min||[0,0,0],a=e?.max||[.08,.0016,.05];return[t[0],-a[2],t[1],a[0],-t[2],a[1]]}function mf(e,t){let a=M.features.get(Number(e));if(!a||!t.length)return;let s=[1/0,1/0,1/0,-1/0,-1/0,-1/0];for(let n=0;n<t.length;n+=3)s[0]=Math.min(s[0],t[n]),s[1]=Math.min(s[1],t[n+1]),s[2]=Math.min(s[2],t[n+2]),s[3]=Math.max(s[3],t[n]),s[4]=Math.max(s[4],t[n+1]),s[5]=Math.max(s[5],t[n+2]);a.bounds=a.bounds?[Math.min(a.bounds[0],s[0]),Math.min(a.bounds[1],s[1]),Math.min(a.bounds[2],s[2]),Math.max(a.bounds[3],s[3]),Math.max(a.bounds[4],s[4]),Math.max(a.bounds[5],s[5])]:s}function Dr(e){if(typeof e?.color=="string"&&/^#[0-9a-fA-F]{6}$/.test(e.color))return[...mr(e.color),1];let t={"F.Cu":"#a9423c","B.Cu":"#315b9a","In1.Cu":"#477a55","In2.Cu":"#806244","In3.Cu":"#347c86","In4.Cu":"#685889","In5.Cu":"#92793e"},a=["#477a55","#806244","#347c86","#685889","#92793e","#82556e"],s=String(e?.name||""),n=Math.max(0,M.copperLayers.findIndex(r=>r.name===s)-1);return[...mr(t[s]||a[n%a.length]),1]}function mr(e){let t=e.replace("#","");return[0,2,4].map(a=>parseInt(t.slice(a,a+2),16)/255)}function xf(e,t=Me){if(t!==Me||!ce||!H)return;let a=performance.now(),s=Math.max(0,e-Ht);if(x.workspace==="schematic"&&S){Ht=e;let c=S.visiblePages(),b=q?vf(c):[];S.setDomDetailPageIds(b.map(g=>g.id)),C.visiblePages=S.render(),q?.syncWorldPages(b,S,{activeNetUid:C.activeNetUid}),Wr(),vr(s,performance.now()-a),Tr(e),Is(t);return}let n=Math.min(.05,(e-Ht)/1e3);Ht=e,H.update(n),ce.resize();let r=Pr();for(let c of ce.entries)c.layerOffset=r[c.layerId]||0;wf(e),Mt=Ur(e);let i=Ef(e);Qe={layerId:0,viewport:{x:0,y:0,width:Z.width,height:Z.height},matrix:H.matrix(Z.width,Z.height,x.mode==="layer")},_e(e);let o=x.mode==="3d"?x.visible3dLayers:jr();ce.render({panels:[Qe],activeNetId:x.activeNetId,selectedFeatureId:x.selectedFeatureId,time:e/1e3,layerOffsets:r,visibleLayers:o,showBoard:x.showBoard,showComponents:x.showComponents,componentOpacity:ie(1-x.separation/.1,0,1),boardOpacity:x.activeNetId?.34:1-x.separation*.72,isolateNet:x.isolateNet,compareMode:x.mode==="layer",compareOffsets:Mt,layerAlphas:i,visibleTileIds:x.mode==="3d"?x.visibleTileIds:null}),Gf(),zf(),vr(s,performance.now()-a),Tr(e),Is(t)}function yf(e){if(!S||!e)return{widthPx:0,heightPx:0,sourcePxPerMm:0,area:0};let t=S.pagePixelWidth(e),a=e.heightMm/Math.max(1e-6,S.scale),s=S.pageSourcePixelsPerMm(e);return{widthPx:t,heightPx:a,sourcePxPerMm:s,area:t*a}}function vf(e){if(!q||!S)return[];let t=e||[],a=Math.max(1,Ie.clientWidth*Ie.clientHeight);return t.map(r=>({page:r,...yf(r)})).filter(r=>r.widthPx>=760&&r.heightPx>=520&&r.area>=a*.36&&r.sourcePxPerMm>=1.25).sort((r,i)=>i.area-r.area).slice(0,1).map(r=>r.page)}function Pr(){let e=M.manifest.bbox,t=Math.hypot((e.max[0]-e.min[0])*1e3,(e.max[2]-e.min[2])*1e3),a=x.separation*x.separation*ie(t*.12,8,25)/1e3,s=`${x.separation}:${a}:${M.copperLayers.length}`;if(M.layerZOffsetSignature===s)return M.layerZOffsets;let n=M.layerZOffsets;n.fill(0);let r=(M.copperLayers.length-1)/2;return M.copperLayers.forEach((i,o)=>{n[Number(i.id)]=(r-o)*a}),M.layerZOffsetSignature=s,n}function Ur(e){if(x.mode!=="layer")return me.key="3d",me.current.clear(),new Map;let t=M.copperLayers.filter(m=>x.compareLayers.has(Number(m.id))),a=Math.max(1,t.length),s=Z.width/Math.max(1,Z.height),n=1;a===2?n=s>=1?2:1:a===3||a===4?n=2:a>4&&(n=Math.ceil(Math.sqrt(a*s)));let r=Math.ceil(a/n),i=$t(M.manifest.bbox),o=i[3]-i[0],c=i[4]-i[1],b=o*1.18,g=c*1.22,h=t.map((m,l)=>{let u=l%n,p=Math.floor(l/n);return{layer:m,layerId:Number(m.id),column:u,row:p,offset:[(u-(n-1)/2)*b,((r-1)/2-p)*g,0]}}),w=`${n}x${r}:${h.map(m=>m.layerId).join(",")}`;if(w!==me.key){me.key=w,me.started=e,me.from=new Map(me.current);let m=n*o+(n-1)*(b-o),l=r*c+(r-1)*(g-c);H.targetFocus=[(i[0]+i[3])/2,(i[1]+i[4])/2,(i[2]+i[5])/2],H.targetOrthoScale=Math.max(l,m/s)*1.08}let y=ie((e-me.started)/420,0,1),f=1-Math.pow(1-y,3),d=new Map;for(let m of h){let l=me.from.get(m.layerId)||[0,0,0],u=m.offset.map((p,v)=>l[v]+(p-l[v])*f);d.set(m.layerId,u),me.current.set(m.layerId,u)}if(K.phase==="reveal")for(let m of K.previous)d.has(Number(m))||d.set(Number(m),K.previousOffsets.get(Number(m))||[0,0,0]);for(let m of[...me.current.keys()])h.some(l=>l.layerId===m)||me.current.delete(m);return d}function Cs(e){let t=new Set([...e].map(Number));if(!(xr(t,x.desiredCompareLayers)&&K.phase!=="idle")){if(x.desiredCompareLayers=t,xr(t,x.compareLayers)){K.phase="idle",K.previous.clear(),K.target.clear();return}K.phase="preload",K.previous=new Set(x.compareLayers),K.target=new Set(t),K.previousOffsets=new Map(me.current),K.started=performance.now(),_e(K.started,{force:!0})}}function Bs({snap:e=!0}={}){x.mode="layer";let t=df();x.desiredCompareLayers=new Set(t),!x.compareLayers.size&&t.size&&(x.compareLayers=new Set(t)),K.phase="idle",K.previous.clear(),K.target.clear(),me.key="",H.setAxis("z",!1),ce?.resize(),Mt=Ur(performance.now()),e&&H.snap(),_e(performance.now(),{force:!0})}function wf(e){if(!(x.mode!=="layer"||K.phase==="idle")){if(K.phase==="preload"){if(!Tf(K.target)){_e(e,{force:!0});return}K.phase="reveal",K.started=e,K.previousOffsets=new Map(me.current),x.compareLayers=new Set(K.target),me.key="";return}K.phase==="reveal"&&e-K.started>=Er&&(x.compareLayers=new Set(K.target),K.phase="idle",K.previous.clear(),K.target.clear(),K.previousOffsets.clear(),_e(e,{force:!0}))}}function Tf(e){for(let t of M.tiles.values())if(e.has(Number(t.layerId))&&!M.residentTiles.has(t.id)&&!M.failed.has(t.id))return!1;return!0}function Ef(e){if(x.mode!=="layer"||K.phase!=="reveal")return null;let t=ie((e-K.started)/Er,0,1),a=t*t*(3-2*t),s=new Map;for(let n of K.previous)s.set(Number(n),K.target.has(Number(n))?1:1-a);for(let n of K.target)s.set(Number(n),K.previous.has(Number(n))?1:a);return s}function xr(e,t){if(e.size!==t.size)return!1;for(let a of e)if(!t.has(a))return!1;return!0}function Lr(){if(x.workspace==="schematic"){If();return}if(x.workspace==="bom"){Rf();return}x.workspace!=="stackup"&&(Va.textContent="Semantic GLTF A0",za.textContent="Layers",Xa.textContent="Visibility and compare",Q('[data-panel="search"] .section-heading span').textContent="Nets, components and pins",Q('[data-panel="view"] .section-heading span').textContent="Camera and stackup",Ve.innerHTML=`
    <div class="mode-toolbar">
      <button data-mode="layer">PCB</button>
      <button data-mode="3d">3D</button>
    </div>
    <div class="layer-presets">
      <button data-preset="all">All</button><button data-preset="none">None</button>
      <button data-preset="outer">Outer</button><button data-preset="inner">Inner</button>
    </div>
    <div class="layer-list"></div>`,ge.innerHTML=`
    <label class="control-field"><span>Search</span>
      <input id="entity-search" class="layer-select" type="search" placeholder="Net, component or pin">
      <div id="search-results" class="search-results"></div>
    </label>
    <div class="quick-actions">
      <button id="frame-selection">Frame</button>
      <button id="show-net-layers">Net layers</button>
      <button id="isolate-net" aria-keyshortcuts="I" title="Toggle isolated net view (I)">Isolate</button>
      <button id="clear-selection">Clear</button>
    </div>`,Ee.innerHTML=`
    <div class="camera-toolbar mode-toolbar">
      <button data-tool="orbit">Orbit</button><button data-tool="pan">Pan</button>
    </div>
    <div class="toggle-list">
      <label class="toggle-row"><input id="show-board" type="checkbox"><span>Board substrate</span></label>
      <label class="toggle-row"><input id="show-components" type="checkbox"><span>Components</span></label>
    </div>
    <label class="control-field range-field"><span>Stackup separation</span>
      <input id="separation" type="range" min="0" max="1" step="0.002">
    </label>`,Wt(),_f())}function Rf(){Va.textContent="BoM A0",za.textContent="Bill of Materials",Xa.textContent="Grouped procurement view",Q('[data-panel="search"] .section-heading span').textContent="Search inside the BoM table",Q('[data-panel="view"] .section-heading span').textContent="BoM actions";let e=ze?.payload?.counts||{};Ve.innerHTML=`
    <div class="selection-properties">
      <div class="selection-property"><small>Rows</small><strong>${e.rows||0}</strong></div>
      <div class="selection-property"><small>Components</small><strong>${e.components||0}</strong></div>
      <div class="selection-property"><small>DNP</small><strong>${e.dnpComponents||0}</strong></div>
    </div>
    <div class="selection-section">
      <span class="selection-section-title">Columns</span>
      <div class="selection-empty">Primary procurement and thermal columns are shown first. Additional symbol and footprint metadata is available in the row detail panel.</div>
    </div>`,ge.innerHTML=`
    <div class="selection-empty">Use the BoM search box in the main view. Reference chips update the shared PCB and schematic selection without changing workspaces.</div>
    <div class="quick-actions">
      <button id="clear-selection">Clear</button>
    </div>`,Ee.innerHTML=`
    <div class="selection-section">
      <span class="selection-section-title">Cross-probing</span>
      <div class="selection-table">
        <div class="selection-row"><span><strong>PCB/Schematic</strong></span><span>Select component</span><span>Highlights matching BoM row</span></div>
        <div class="selection-row"><span><strong>BoM reference</strong></span><span>Click chip</span><span>Holds component selection for PCB and schematic</span></div>
      </div>
    </div>`,ge.querySelector("#clear-selection")?.addEventListener("click",Ct)}function If(){Va.textContent=q?"Schematic SVG DOM":C.manifest?.schema==="prism.schematic_vector_a0"?"Schematic Vector A0":"Schematic World A0",za.textContent="Pages",Xa.textContent=`${C.pages.length} hierarchy instances`,Q('[data-panel="search"] .section-heading span').textContent="Pages, nets and components",Q('[data-panel="view"] .section-heading span').textContent="World navigation",Ve.innerHTML=`
    <div class="layer-presets">
      <button data-page-action="world">Fit world</button>
      <button data-page-action="parent">Parent</button>
      <button data-page-action="previous">Previous</button>
      <button data-page-action="next">Next</button>
    </div>
    <div class="page-list">${C.pages.map(e=>`
      <button class="page-row ${e.id===x.selectedPageId?"active":""}" data-page="${e.id}">
        <span>${e.sheetNumber}</span>
        <strong>${G(e.name)}</strong>
        <small>L${e.depth}</small>
      </button>`).join("")}</div>`,ge.innerHTML=`
    <label class="control-field"><span>Search</span>
      <input id="entity-search" class="layer-select" type="search" placeholder="Page, net or component">
      <div id="search-results" class="search-results"></div>
    </label>
    <div class="quick-actions">
      <button id="frame-selection">Frame</button>
      <button id="clear-selection">Clear</button>
    </div>`,Ee.innerHTML=`
    <div class="toggle-list">
      <label class="toggle-row"><input id="show-hierarchy" type="checkbox" checked><span>Hierarchy links</span></label>
    </div>
    <div class="selection-section">
      <span class="selection-section-title">Navigation</span>
      <div class="selection-table">
        <div class="selection-row"><span><strong>Home</strong></span><span>World</span><span>Frame every page</span></div>
        <div class="selection-row"><span><strong>[ / ]</strong></span><span>Pages</span><span>Previous or next instance</span></div>
        <div class="selection-row"><span><strong>Alt+Up</strong></span><span>Parent</span><span>Move up hierarchy</span></div>
      </div>
    </div>`,Ve.querySelectorAll("[data-page]").forEach(e=>{e.addEventListener("click",()=>Ze(e.dataset.page,!0))}),Ve.querySelectorAll("[data-page-action]").forEach(e=>{e.addEventListener("click",()=>Oa(e.dataset.pageAction))}),ge.querySelector("#entity-search").addEventListener("input",e=>{Mf(e.target.value)}),ge.querySelector("#frame-selection").addEventListener("click",Vr),ge.querySelector("#clear-selection").addEventListener("click",Qt),Ee.querySelector("#show-hierarchy").checked=S?.showHierarchy??!0,Ee.querySelector("#show-hierarchy").addEventListener("change",e=>{S.showHierarchy=e.target.checked})}function Ze(e,t){let a=C.byId.get(e);!a||!S||(x.selectedPageId=a.id,x.selectedSchematicFeature=null,S.selectedPageId=a.id,S.selectedFeatureId=0,qe.textContent=JSON.stringify(a,null,2),t&&S.framePage(a),Ve.querySelectorAll("[data-page]").forEach(s=>{s.classList.toggle("active",s.dataset.page===a.id)}))}function Oa(e){if(!S)return;if(e==="world"){S.frameWorld();return}let t=Math.max(0,C.pages.findIndex(s=>s.id===x.selectedPageId)),a=null;e==="previous"?a=C.pages[(t-1+C.pages.length)%C.pages.length]:e==="next"?a=C.pages[(t+1)%C.pages.length]:e==="parent"&&(a=C.byId.get(C.pages[t]?.parentId)),a&&Ze(a.id,!0)}function kf(e){if(!e||!S)return;if(Qt(),e.kind==="page"&&e.pageId){Ze(e.pageId,!0);return}if(e.kind!=="sheet")return;let t=C.pages.find(r=>r.sheetInstancePath===e.sheetInstancePath)||C.byId.get(x.selectedPageId),a=String(e.sheetFile||e.feature?.sheet_file||"").replace(/\\/g,"/"),s=String(e.sheetName||e.feature?.sheet_name||e.feature?.objectId||""),n=C.pages.find(r=>{if(t&&r.parentId&&r.parentId!==t.id)return!1;let i=String(r.sourcePath||"").replace(/\\/g,"/");return a&&i.endsWith(a)||s&&r.name===s})||C.pages.find(r=>{let i=String(r.sourcePath||"").replace(/\\/g,"/");return a&&i.endsWith(a)||s&&r.name===s});n&&Ze(n.id,!0)}function Mf(e){let t=ge.querySelector("#search-results"),a=e.trim().toLowerCase();if(!a){t.innerHTML="";return}let s=C.pages.filter(r=>`${r.name} ${r.sheetPath}`.toLowerCase().includes(a)).slice(0,8),n=M.nets.filter(r=>String(r.name).toLowerCase().includes(a)).slice(0,8);t.innerHTML=[...s.map(r=>`<button data-page="${r.id}"><b>${G(r.name)}</b><span>Page ${r.sheetNumber}</span></button>`),...n.map(r=>`<button data-schematic-net="${r.id}"><b>${G(r.name)}</b><span>${(C.manifest.netToPages?.[r.uid]||[]).length} pages</span></button>`)].join(""),t.querySelectorAll("[data-page]").forEach(r=>{r.addEventListener("click",()=>Ze(r.dataset.page,!0))}),t.querySelectorAll("[data-schematic-net]").forEach(r=>{r.addEventListener("click",()=>Kr(Number(r.dataset.schematicNet),!0))})}function Kr(e,t){let a=M.nets.find(n=>Number(n.id)===e);if(!a||!S)return;x.activeNetId=e,x.selectedFeatureId=0,x.selectedSchematicFeature=null,S.selectedFeatureId=0,S.selectedFeatureKey="",S.selectedSourceId="",C.activeNetUid=a.uid,S.activeNetUid=a.uid,q?.setHighlightedNet(a.uid),qe.textContent=JSON.stringify(a,null,2),Pe();let s=C.manifest.netToPages?.[a.uid]||[];t&&s.length&&Ze(s[0],!0)}function Gr(e,t=null){let a=M.nets.find(s=>s.uid===e);a&&(x.activeNetId=Number(a.id),C.activeNetUid=a.uid,S&&(S.activeNetUid=a.uid,S.selectedFeatureId=Number(t?.feature?.id||t?.featureId||0),S.selectedFeatureKey=t?.feature?.stableKey||t?.featureKey||"",S.selectedSourceId=t?.feature?.sourceId||t?.sourceId||""),q?.setHighlightedNet(a.uid),t&&(x.selectedSchematicFeature={...t,pageId:x.selectedPageId}),qe.textContent=JSON.stringify(t?{...t,net:a}:a,null,2),Pe())}function Qt(){x.activeNetId=0,x.selectedFeatureId=0,x.selectedSchematicFeature=null,C.activeNetUid="",S&&(S.activeNetUid="",S.selectedFeatureId=0,S.selectedFeatureKey="",S.selectedSourceId=""),q?.setSelection(null),q?.setHighlightedNet(""),qe.textContent="No object selected",Pe()}function Vr(){let e=C.byId.get(x.selectedPageId);e?S.framePage(e):S.frameWorld()}function Af(e){x.selectedPageId=e.sheetInstancePath&&C.pages.find(s=>s.sheetInstancePath===e.sheetInstancePath)?.id||x.selectedPageId,x.selectedFeatureId=0,x.selectedSchematicFeature={...e,pageId:x.selectedPageId},e.anchor&&(x.selectionAnchor=e.anchor),S&&(S.selectedPageId=x.selectedPageId,S.selectedFeatureId=Number(e.feature?.id||0));let t=e.netUid?M.nets.find(s=>s.uid===e.netUid):null,a=e.reference?M.componentFeatures.get(e.reference):null;a&&(x.selectedFeatureId=Number(a.featureId||0),ze?.setSelectionByReference(e.reference,{scroll:x.workspace==="bom"})),qe.textContent=JSON.stringify({...e,net:t,component:a},null,2),Pe()}function Sf(e){let{page:t,feature:a}=e;if(!a){x.selectedSchematicFeature=null,S.selectedFeatureId=0,Ze(t.id,!1),Pe();return}let s=Number(a.id||0);if(x.selectedPageId=t.id,S.selectedPageId=t.id,S.selectedFeatureId=s,x.selectedSchematicFeature={...a,pageId:t.id},x.selectionAnchor=null,a.netUid){let n=M.nets.find(r=>r.uid===a.netUid);if(n){Kr(Number(n.id),!1),x.selectedSchematicFeature={...a,pageId:t.id},S.selectedFeatureId=s;return}}if(a.reference){let n=M.componentFeatures.get(a.reference);if(n){Ot(Number(n.featureId),!1),x.selectedSchematicFeature={...a,pageId:t.id},S.selectedFeatureId=s;return}}x.activeNetId=0,x.selectedFeatureId=0,S.activeNetUid="",qe.textContent=JSON.stringify({page:t.name,...a},null,2),Pe()}function zr(){let e=x.isolateNet,t=ge?.querySelector?.("#isolate-net");t?.classList.toggle("active",e),t?.setAttribute("aria-pressed",String(e));let a=J?.querySelector?.("[data-action=isolate]");a?.classList.toggle("active",e),a?.setAttribute("aria-pressed",String(e));let s=Ee?.querySelector?.("#show-board");s&&(s.checked=x.showBoard)}function Yt(e){x.isolateNet=!!(e&&x.activeNetId),x.showBoard=!x.isolateNet,zr()}function Wt(){Ve.querySelectorAll("[data-mode]").forEach(a=>{a.classList.toggle("active",a.dataset.mode===x.mode)}),Ee.querySelectorAll("[data-tool]").forEach(a=>{a.classList.toggle("active",a.dataset.tool===x.cameraTool)}),Ee.querySelector("#show-board").checked=x.showBoard,Ee.querySelector("#show-components").checked=x.showComponents,Ee.querySelector("#separation").value=x.separation;let e=Ve.querySelector(".layer-list"),t=x.mode==="3d"?x.visible3dLayers:x.desiredCompareLayers;e.innerHTML=M.copperLayers.map((a,s)=>`
    <label class="layer-row">
      <input type="checkbox" data-layer="${a.id}" ${t.has(Number(a.id))?"checked":""}>
      <span class="swatch" style="background:${Hf(Dr(a))}"></span>
      <span>${a.name}</span><small>${s+1}</small>
    </label>`).join(""),e.querySelectorAll("[data-layer]").forEach(a=>a.addEventListener("change",()=>{let s=Number(a.dataset.layer);if(x.mode==="3d")a.checked?x.visible3dLayers.add(s):x.visible3dLayers.delete(s),_e(performance.now(),{force:!0});else{let n=new Set(x.desiredCompareLayers);a.checked?n.add(s):n.delete(s),Cs(n)}})),zr()}function _f(){Ve.querySelectorAll("[data-mode]").forEach(t=>t.addEventListener("click",()=>{t.dataset.mode==="layer"?Bs():(x.mode="3d",H.frame($t(M.manifest.bbox)),H.snap(),x.visibleTileIds=new Set,_e(performance.now(),{force:!0})),Wt()})),Ve.querySelectorAll("[data-preset]").forEach(t=>t.addEventListener("click",()=>{let a=x.mode==="3d"?x.visible3dLayers:new Set;a.clear();let s=t.dataset.preset;for(let[n,r]of M.copperLayers.entries())(s==="all"||s==="outer"&&(n===0||n===M.copperLayers.length-1)||s==="inner"&&n>0&&n<M.copperLayers.length-1)&&a.add(Number(r.id));x.mode==="3d"?_e(performance.now(),{force:!0}):Cs(a),Wt()})),Ee.querySelectorAll("[data-tool]").forEach(t=>t.addEventListener("click",()=>{x.cameraTool=t.dataset.tool,Wt()})),Ee.querySelector("#show-board").addEventListener("change",t=>{x.showBoard=t.target.checked,x.showBoard&&x.isolateNet&&Yt(!1)}),Ee.querySelector("#show-components").addEventListener("change",t=>{x.showComponents=t.target.checked}),Ee.querySelector("#separation").addEventListener("input",t=>{x.separation=Number(t.target.value)}),ge.querySelector("#clear-selection").addEventListener("click",Ct),ge.querySelector("#isolate-net").addEventListener("click",()=>{Yt(!x.isolateNet)}),ge.querySelector("#frame-selection").addEventListener("click",Ps),ge.querySelector("#show-net-layers").addEventListener("click",Xr);let e=ge.querySelector("#entity-search");e.addEventListener("input",()=>jf(e.value))}function Nf(){kt(".rail-tab").forEach(e=>e.addEventListener("click",()=>{let t=e.dataset.tab,a=x.activeTab===t&&!Tt.classList.contains("panel-collapsed");x.activeTab=t,Tt.classList.toggle("panel-collapsed",a),kt(".rail-tab").forEach(s=>{s.classList.toggle("active",!a&&s.dataset.tab===t)}),kt(".tab-panel").forEach(s=>{s.classList.toggle("active",!a&&s.dataset.panel===t)})}))}function Xr(){let e=M.nets.find(s=>Number(s.id)===x.activeNetId);if(!e)return;let t=new Set(e.metrics?.layers||[]),a=x.mode==="3d"?x.visible3dLayers:new Set;a.clear();for(let s of M.copperLayers)t.has(s.name)&&a.add(Number(s.id));x.mode==="3d"?_e(performance.now(),{force:!0}):Cs(a),Wt()}function jf(e){let t=ge.querySelector("#search-results"),a=e.trim().toLowerCase();if(!a){t.innerHTML="";return}let s=M.nets.filter(r=>String(r.name).toLowerCase().includes(a)).slice(0,8),n=[...M.componentFeatures.values()].filter(r=>`${r.designator} ${r.value} ${r.footprint}`.toLowerCase().includes(a)).slice(0,6);t.innerHTML=[...s.map(r=>`<button data-net="${r.id}"><b>${G(r.name)}</b><span>${G(r.netClass||"")}</span></button>`),...n.map(r=>`<button data-feature="${r.featureId}"><b>${G(r.designator)}</b><span>${G(r.value)}</span></button>`)].join(""),t.querySelectorAll("[data-net]").forEach(r=>{r.addEventListener("click",()=>La(Number(r.dataset.net),!0))}),t.querySelectorAll("[data-feature]").forEach(r=>{r.addEventListener("click",()=>Ot(Number(r.dataset.feature),!0))})}function La(e,t){t&&(x.selectionAnchor=null),x.activeNetId=e,x.selectedFeatureId=0;let a=M.nets.find(s=>Number(s.id)===e);x.workspace==="schematic"&&a&&S&&(C.activeNetUid=a.uid,S.activeNetUid=a.uid),qe.textContent=JSON.stringify(a||{},null,2),Pe(),t&&a?.boundsMm&&H.frame(Os(a.boundsMm)),_e(performance.now(),{force:!0}),Fs(Nr(a))}function Ot(e,t=!1){let a=M.features.get(e);t&&(x.selectionAnchor=null),x.selectedFeatureId=e,x.activeNetId=Number(a?.netId||0);let s=qr(a);s&&ze?.setSelectionByReference(s,{scroll:x.workspace==="bom"}),qe.textContent=a?JSON.stringify(a,null,2):"No object selected",Pe(),t&&a?.bounds&&H.frame(a.bounds),_e(performance.now(),{force:!0}),Fs(Ql(a))}function Ds(e,t=!1){let a=M.componentFeatures.get(e);if(ze?.setSelectionByReference(e,{scroll:x.workspace==="bom"}),!a?.featureId)return;Ot(Number(a.featureId),!1);let s=Ff(e);if(s){let{page:n,feature:r}=s;x.selectedPageId=n.id,x.selectedSchematicFeature={...r,pageId:n.id},S&&(S.selectedPageId=n.id,S.selectedFeatureId=Number(r.id||0)),q?.setSelection?.({kind:"component",featureKey:r.stableKey||"",sheetInstancePath:r.sheetInstancePath||n.sheetInstancePath||"",sourceId:r.sourceId||r.uuid||"",reference:e,feature:r,pageId:n.id}),t&&x.workspace==="schematic"&&(Ze(n.id,!0),q?.frameSelection?.())}if(t&&x.workspace==="pcb"){let n=M.features.get(Number(a.featureId));n?.bounds&&H.frame(n.bounds)}Pe()}function qr(e){return e?.designator||e?.reference||e?.componentDesignator||""}function Ff(e){if(!e||!S?.featuresByPage)return null;let t=C.byId.get(x.selectedPageId),a=[...t?[t]:[],...(C.pages||[]).filter(n=>n.id!==t?.id)],s=n=>{let r=String(n.kind||"").toLowerCase();return r==="component"||r==="symbol_body"||r==="symbol_instance"?0:r==="symbol_reference"?1:r.startsWith("pin")?2:3};for(let n of a){let r=(S.featuresByPage[n.id]||[]).filter(i=>String(i.reference||i.designator||i.componentDesignator||"")===e).sort((i,o)=>s(i)-s(o));if(r.length)return{page:n,feature:r[0]}}return null}function Ct(){x.activeNetId=0,x.selectedFeatureId=0,x.selectedSchematicFeature=null,x.selectionAnchor=null,Yt(!1),C.activeNetUid="",S&&(S.activeNetUid=""),q?.setSelection(null),q?.setHighlightedNet(""),qe.textContent="No object selected",ze?.clearSelection?.(),Pe(),Fs(null)}function Ca(e){return`<div class="selection-properties">${e.map(([t,a])=>`
    <div class="selection-property">
      <small>${G(t)}</small>
      <strong title="${G(String(a))}">${G(String(a))}</strong>
    </div>`).join("")}</div>`}function Ka(e,t,a){return`
    <div class="selection-card-head">
      <span class="selection-card-accent" style="background:${a}"></span>
      <div class="selection-card-drag-handle" title="Drag to move card">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
          <circle cx="2" cy="2" r="1"/>
          <circle cx="6" cy="2" r="1"/>
          <circle cx="10" cy="2" r="1"/>
          <circle cx="2" cy="6" r="1"/>
          <circle cx="6" cy="6" r="1"/>
          <circle cx="10" cy="6" r="1"/>
          <circle cx="2" cy="10" r="1"/>
          <circle cx="6" cy="10" r="1"/>
          <circle cx="10" cy="10" r="1"/>
        </svg>
      </div>
      <div class="selection-card-title"><small>${G(e)}</small><strong>${G(t)}</strong></div>
      <button class="selection-card-close" type="button" aria-label="Clear selection">&times;</button>
    </div>`}function Of(e){let a=(Te.net_details?.[e.uid]||{}).terminals||[],s=e.metrics||{},n=Number(s.traceLengthMm||0).toFixed(2),r=s.objectCounts?.via||0,i=a.length,c=/^(VCC|VDD|GND|3V3|5V|12V|VIN|POWER)/i.test(e.name)?"#10b981":"#8b5cf6",b=e.netClass||"Default",g=a.length?a.map(h=>`
      <div class="selection-row pin-row-interactive" data-ref="${G(h.designator)}" data-pin="${G(h.pin)}">
        <span class="refdes-col"><strong>${G(h.designator)}</strong></span>
        <span class="pin-col">Pin ${G(h.pin)}</span>
        <span class="val-col" title="${G(h.value||"")}">${G(h.value||"-")}</span>
      </div>`).join(""):'<div class="selection-empty">No connected pin metadata is available.</div>';return`
    ${Ka("Net",e.name,c)}
    <div class="selection-net-dashboard">
      <div class="net-metric-grid">
        <div class="metric-card">
          <small>Length</small>
          <strong>${n} <span class="unit">mm</span></strong>
        </div>
        <div class="metric-card">
          <small>Vias</small>
          <strong>${r}</strong>
        </div>
        <div class="metric-card">
          <small>Pins</small>
          <strong>${i}</strong>
        </div>
        <div class="metric-card">
          <small>Class</small>
          <strong title="${G(b)}">${G(b)}</strong>
        </div>
      </div>
      
      <div class="selection-section">
        <span class="selection-section-title">Layers</span>
        <div class="net-layers-badges">
          ${(s.layers||[]).length?s.layers.map(h=>`<span class="layer-badge">${G(h)}</span>`).join(""):'<span class="layer-badge unknown">None</span>'}
        </div>
      </div>

      <div class="selection-section">
        <span class="selection-section-title">Connected Pins</span>
        <div class="selection-table compact-scroll" style="max-height: 120px;">
          ${g}
        </div>
      </div>
    </div>`}function Cf(e,t=null){let a=Sr(e.designator),s=a?a.value:e.value||"Not specified",n=a?a.footprint:e.footprint||"Not specified",r=a?.parameters||{},i=r.Manufacturer||r.Mfr||"",o=r["Manufacturer Part Number"]||r.MPN||r["Part Number"]||"",c=r.kicad_dnp==="true"||r.DNP==="true"||r.kicad_in_bom==="false",b="";(i||o)&&(b=`
      <div class="selection-section">
        <span class="selection-section-title">Component details</span>
        <div class="selection-table">
          <div class="selection-row">
            <span><strong>Manufacturer</strong></span>
            <span title="${G(i)}">${G(i||"-")}</span>
          </div>
          <div class="selection-row">
            <span><strong>Part Number</strong></span>
            <span title="${G(o)}">${G(o||"-")}</span>
          </div>
        </div>
      </div>`);let g="";return t&&(g=`
      <div class="selection-section">
        <span class="selection-section-title">Selected Pin</span>
        <div class="selection-table">
          <div class="selection-row">
            <span><strong>Pin</strong></span>
            <span>Pin ${G(t.pinNumber||t.pin||"")}</span>
            <span title="${G(t.pinName||"")}">${G(t.pinName||"No name")}</span>
          </div>
          <div class="selection-row">
            <span><strong>Net</strong></span>
            <span class="net-ref-interactive" data-net-name="${G(t.netName||"")}">${G(t.netName||"Not connected")}</span>
          </div>
        </div>
      </div>`),`
    ${Ka("Component",e.designator||"Unknown","#3b82f6")}
    <div class="selection-component-dashboard">
      ${c?'<div class="dnp-banner" style="background:#b45309;color:#fff;font-size:9px;font-weight:750;text-align:center;padding:3px;margin-bottom:8px;border-radius:2px;text-transform:uppercase;letter-spacing:0.05em;">DNP (Do Not Populate)</div>':""}
      ${Ca([["Value",s],["Footprint",n.split(":").pop()||n]])}
      ${b}
      ${g}
    </div>`}function Bf(e,t){let a=String(e.kind||"").toLowerCase(),s=a.startsWith("pin");if(a==="component"||a.includes("symbol"))return`
      ${Ka("Component",e.reference||e.componentDesignator||"Unknown","#3b82f6")}
      ${Ca([["Value",e.value||e.componentValue||"Not specified"],["Footprint",e.componentFootprint||e.footprint||"Not specified"],["Library",e.libraryRef||"Not specified"],["UID",e.componentUid||e.uuid||e.sourceId||"Not resolved"]])}
      <div class="selection-section">
        <span class="selection-section-title">Schematic placement</span>
        ${Ca([["Page",t?.name||"Unknown"],["Sheet",e.sheetInstancePath||"/"]])}
      </div>`;let r=s?[["Symbol",e.reference||e.designator||"Unknown"],["Value",e.value||e.componentValue||"Not specified"],["Pin",`${e.pinNumber||"-"}${e.pinName?` ${e.pinName}`:""}`],["Net",e.netName||"Not connected"],["PCB Pad",e.pcbPadId||"Not resolved"],["Component UID",e.componentUid||"Not resolved"]]:[["Page",t?.name||"Unknown"],["Kind",e.kind.replaceAll("_"," ")],["Net",e.netName||"Not connected"]];return`
    ${Ka(e.kind.replaceAll("_"," "),e.pinName||e.reference||e.designator||e.text||e.netName||"Schematic object","#3b82f6")}
    ${Ca(r)}
    <div class="selection-section">
      <span class="selection-section-title">Source identity</span>
      <div class="selection-table">
        <div class="selection-row">
          <span><strong>${s?"Pin UUID":"UUID"}</strong></span>
          <span title="${G(e.uuid||e.sourceId||"")}">${G(e.uuid||e.sourceId||"-")}</span>
          <span title="${G(e.objectId||"")}">${G(e.objectId||"No object ID")}</span>
        </div>
        <div class="selection-row">
          <span><strong>Sheet</strong></span>
          <span>${G(t?.name||"Unknown")}</span>
          <span title="${G(e.sheetInstancePath||"")}">${G(e.sheetInstancePath||"/")}</span>
        </div>
      </div>
    </div>`}function Pe(){if(x.workspace==="bom"){J.hidden=!0,J.innerHTML="";return}let e=M.features.get(x.selectedFeatureId),t=e?.kind==="component"?e:null,a=x.workspace==="schematic"?x.selectedSchematicFeature:null,s=a?C.byId.get(a.pageId):null,n=x.activeNetId?M.nets.find(h=>Number(h.id)===x.activeNetId):null;if(!n&&a&&(a.netUid?n=M.nets.find(h=>h.uid===a.netUid):a.netName&&(n=M.nets.find(h=>h.name===a.netName))),!t&&a){let h=a.reference||a.componentDesignator||a.designator;h&&(t=M.componentFeatures.get(h)||{designator:h})}if(!t&&!n&&!a){J.hidden=!0,J.innerHTML="";return}let r="";if(n)r=Of(n);else if(t){let h=a?.kind?.startsWith("pin")?a:null;r=Cf(t,h)}else a&&(r=Bf(a,s));J.innerHTML=`
    ${r}
    <div class="selection-card-actions">
      ${n?`
        <button type="button" data-action="isolate" aria-keyshortcuts="I" title="Toggle isolated net view (I)" class="${x.isolateNet?"active":""}">Isolate</button>
        <button type="button" data-action="net-layers">Layers</button>
      `:""}
      <button type="button" data-action="frame">Frame selection</button>
    </div>`,J.hidden=!1;let i=x.workspace==="schematic"?Ie:Z,o=x.selectionAnchor,c=J.offsetWidth||360,b=J.offsetHeight||330;if(o){let h=Math.max(16,i.clientWidth-c-24),w=Math.max(16,i.clientHeight-b-24);J.style.left=`${ie(o.x+18,16,h)}px`,J.style.top=`${ie(o.y+18,16,w)}px`}else J.style.left="20px",J.style.top="20px";if(J.querySelector(".selection-card-close").addEventListener("click",Ct),J.querySelector("[data-action=frame]").addEventListener("click",Ps),n){let h=J.querySelector("[data-action=isolate]");h&&h.addEventListener("click",()=>{Yt(!x.isolateNet)});let w=J.querySelector("[data-action=net-layers]");w&&w.addEventListener("click",Xr),J.querySelectorAll(".pin-row-interactive").forEach(y=>{y.addEventListener("click",()=>{let f=y.dataset.ref,d=y.dataset.pin;if(!f)return;let u=((Te.net_details?.[n.uid]||{}).terminals||[]).find(v=>v.designator===f&&v.pin===d),p=u?Jl(u.pcb_pad_id):0;p?Ot(p,!0):Ds(f,!0)})})}let g=J.querySelector(".net-ref-interactive");g&&g.addEventListener("click",()=>{let h=g.dataset.netName;if(!h)return;let w=M.nets.find(y=>y.name===h);w&&La(Number(w.id),!0)})}function Ps(){if(x.workspace==="schematic"){Vr();return}let e=M.features.get(x.selectedFeatureId);if(e?.bounds){if(e.kind==="component"){let a=[(e.bounds[0]+e.bounds[3])*.5,(e.bounds[1]+e.bounds[4])*.5,(e.bounds[2]+e.bounds[5])*.5][2]<0,s=H.polar>Math.PI/2;a!==s&&H.setAxis("z",a)}H.frame(e.bounds)}else{let t=M.nets.find(a=>Number(a.id)===x.activeNetId);t?.boundsMm&&H.frame(Os(t.boundsMm))}}function Df(){Z.addEventListener("contextmenu",e=>e.preventDefault()),Z.addEventListener("pointerdown",e=>{x.dragging=!0,x.lastX=e.clientX,x.lastY=e.clientY,x.pointerStartX=e.clientX,x.pointerStartY=e.clientY,x.dragMode=x.mode==="layer"||x.cameraTool==="pan"||e.shiftKey||e.button!==0?"pan":"orbit",Z.setPointerCapture(e.pointerId)}),Z.addEventListener("pointermove",e=>{if(!x.dragging)return;let t=e.clientX-x.lastX,a=e.clientY-x.lastY;x.lastX=e.clientX,x.lastY=e.clientY,x.dragMode==="pan"?H.pan(t,a,Z.clientHeight,x.mode==="layer"):H.orbit(t,a)}),Z.addEventListener("pointerup",async e=>{x.dragging=!1,Z.releasePointerCapture(e.pointerId),Math.hypot(e.clientX-x.pointerStartX,e.clientY-x.pointerStartY)<3&&await yr(e)}),Z.addEventListener("dblclick",async e=>{await yr(e),Ps()}),Z.addEventListener("wheel",e=>{e.preventDefault(),Math.abs(e.deltaX)>Math.abs(e.deltaY)*.4?H.pan(-e.deltaX,0,Z.clientHeight,x.mode==="layer"):H.dolly(e.deltaY,x.mode==="layer")},{passive:!1}),window.addEventListener("keydown",Hr),Pf()}function Pf(){let e=!1,t,a,s=0,n=0;J.addEventListener("pointerdown",r=>{if(!r.target.closest(".selection-card-head")||r.target.closest(".selection-card-close"))return;e=!0,J.classList.add("dragging");let o=J.getBoundingClientRect();s=o.left,n=o.top,t=r.clientX,a=r.clientY,J.setPointerCapture(r.pointerId),r.stopPropagation()}),J.addEventListener("pointermove",r=>{if(!e)return;let i=r.clientX-t,o=r.clientY-a,c=x.workspace==="schematic"?Ie:Z,b=J.offsetWidth||360,g=J.offsetHeight||330,h=Math.max(16,c.clientWidth-b-24),w=Math.max(16,c.clientHeight-g-24),y=ie(s+i,16,h),f=ie(n+o,16,w);J.style.left=`${y}px`,J.style.top=`${f}px`,x.selectionAnchor={x:y-18,y:f-18},r.stopPropagation()}),J.addEventListener("pointerup",r=>{e&&(e=!1,J.classList.remove("dragging"),J.releasePointerCapture(r.pointerId),r.stopPropagation())})}function Uf(){kt("[data-workspace]").forEach(e=>{e.addEventListener("click",()=>Lf(e.dataset.workspace))})}function Lf(e){if(e==="schematic"&&!S||e==="bom"&&!ze)return;x.workspace=e,Tt.classList.remove("workspace-pcb","workspace-schematic","workspace-bom","workspace-stackup"),Tt.classList.add(`workspace-${e}`),(e==="schematic"&&(x.activeTab==="view"||x.activeTab==="inspect"||x.activeTab==="stats")||e==="bom"||e==="stackup")&&Ga("layers");let t=Q('.rail-tab[data-tab="layers"]');t&&(e==="schematic"?(t.textContent="Pages",t.title="Schematic pages"):e==="bom"?(t.textContent="Summary",t.title="BoM summary"):(t.textContent="Layers",t.title="Layers and compare"));let a=e==="schematic",s=e==="bom",n=e==="stackup";if(Z.hidden=a||s||n,Ie.hidden=!a,Ms.hidden=!a||!q,As.hidden=!a,Ss.hidden=!s,Be&&(Be.hidden=!n),we.hidden=a||s||n,Ba.hidden=a||s||n,Da.hidden=!a,kt("[data-workspace]").forEach(r=>{r.classList.toggle("active",r.dataset.workspace===e)}),Jt.textContent=s?"Semantic BoM active":a?q?"SVG DOM + WebGPU schematic world active":"WebGPU schematic world active":n?"Layer Stackup active":"WebGPU semantic glTF active",a&&!C.fitted&&(S.resize(),S.frameWorld(),C.fitted=!0),!a&&!s&&!n&&(ce?.resize(),x.mode==="layer"?Bs():_e(performance.now(),{force:!0})),n)try{Wf()}catch(r){console.error("Failed to render stackup workspace",r),Be&&(Be.innerHTML=`
          <div class="selection-empty" style="padding:40px;text-align:center;">
            Stackup view failed to render. ${G(r?.message||String(r))}
          </div>
        `)}Lr(),Pe()}function Kf(){Ie.addEventListener("pointerdown",e=>{q?.worldActive||q?.active||(x.schematicDragging=!0,x.schematicLastX=e.clientX,x.schematicLastY=e.clientY,x.schematicStartX=e.clientX,x.schematicStartY=e.clientY,Ie.setPointerCapture(e.pointerId))}),Ie.addEventListener("pointermove",e=>{if(q?.worldActive||q?.active||!x.schematicDragging||!S)return;let t=e.clientX-x.schematicLastX,a=e.clientY-x.schematicLastY;x.schematicLastX=e.clientX,x.schematicLastY=e.clientY,S.pan(t,a)}),Ie.addEventListener("pointerup",async e=>{if(!(q?.worldActive||q?.active)&&(x.schematicDragging=!1,Ie.releasePointerCapture(e.pointerId),Math.hypot(e.clientX-x.schematicStartX,e.clientY-x.schematicStartY)<3)){let t=await S.pickFeature(e.clientX,e.clientY);t?Sf(t):Qt()}}),Ie.addEventListener("dblclick",e=>{if(q?.worldActive||q?.active)return;let t=S.hitPage(e.clientX,e.clientY);t&&Ze(t.id,!0)}),Ie.addEventListener("wheel",e=>{q?.worldActive||q?.active||(e.preventDefault(),S.zoom(e.deltaY,e.clientX,e.clientY))},{passive:!1})}async function yr(e){if(!Qe)return;let t=Z.getBoundingClientRect(),a=(e.clientX-t.left)*Z.width/t.width,s=(e.clientY-t.top)*Z.height/t.height;x.selectionAnchor={x:e.clientX-t.left,y:e.clientY-t.top};let n=await ce.pick(Qe,a,s,{activeNetId:x.activeNetId,selectedFeatureId:x.selectedFeatureId,layerOffsets:Pr(),visibleLayers:x.mode==="3d"?x.visible3dLayers:x.compareLayers,showBoard:x.showBoard,showComponents:x.showComponents,componentOpacity:ie(1-x.separation/.1,0,1),boardOpacity:1-x.separation*.72,isolateNet:x.isolateNet,compareMode:x.mode==="layer",compareOffsets:Mt,visibleTileIds:x.mode==="3d"?x.visibleTileIds:null});n?Ot(n,!1):Ct()}function Hr(e){if(!Ns())return;if(e.target instanceof HTMLInputElement){e.key==="Escape"&&e.target.blur();return}let t=e.key.toLowerCase();if(x.workspace==="schematic"){if(t==="/")e.preventDefault(),Ga("search"),ge.querySelector("#entity-search")?.focus();else if(t==="escape")C.activeNetUid?(C.activeNetUid="",x.activeNetId=0,S.activeNetUid="",q?.setHighlightedNet(""),Pe()):Qt();else if(t==="~"||e.key==="~"){e.preventDefault();let a=x.selectedSchematicFeature?.netUid;a&&(C.activeNetUid===a?(C.activeNetUid="",x.activeNetId=0,S.activeNetUid="",q?.setHighlightedNet("")):Gr(a,x.selectedSchematicFeature))}else if(t==="home")S?.frameWorld();else if(t==="[")Oa("previous");else if(t==="]")Oa("next");else if(t==="n"){e.preventDefault();let a=S?.cycleNetIntrasheetLink(e.shiftKey?-1:1);a?.pageId&&(x.selectedPageId=a.pageId,S.selectedPageId=a.pageId,Wr())}else if(e.altKey&&t==="arrowup")Oa("parent");else if(e.key.startsWith("Arrow")){e.preventDefault();let a=e.key==="ArrowRight"?32:e.key==="ArrowLeft"?-32:0,s=e.key==="ArrowDown"?32:e.key==="ArrowUp"?-32:0;S?.pan(a,s)}return}if(t==="/")e.preventDefault(),Ga("search"),ge.querySelector("#entity-search").focus();else if(t==="escape")Ct();else if(t==="i"&&x.workspace==="pcb"&&x.activeNetId)e.preventDefault(),Yt(!x.isolateNet);else if(t==="home")H.frame($t(M.manifest.bbox));else if(["x","y","z"].includes(t))H.setAxis(t,e.shiftKey);else if(t==="f")H.flip();else if(t==="r")H.rotateZ(e.shiftKey?-1:1);else if(t===" "){e.preventDefault();let a=M.features.get(x.selectedFeatureId);a?.bounds&&H.setFocus([(a.bounds[0]+a.bounds[3])/2,(a.bounds[1]+a.bounds[4])/2,(a.bounds[2]+a.bounds[5])/2])}else if(e.key.startsWith("Arrow")){e.preventDefault();let a=e.key==="ArrowRight"?32:e.key==="ArrowLeft"?-32:0,s=e.key==="ArrowDown"?32:e.key==="ArrowUp"?-32:0;H.pan(a,s,Z.clientHeight,x.mode==="layer")}}function Ga(e){x.activeTab=e,Tt.classList.remove("panel-collapsed"),kt(".rail-tab").forEach(t=>{t.classList.toggle("active",t.dataset.tab===e)}),kt(".tab-panel").forEach(t=>{t.classList.toggle("active",t.dataset.panel===e)})}function Gf(){let e=we.getContext("2d");e.clearRect(0,0,we.width,we.height);let t=[we.width/2,we.height/2],a=H.basis(),s=[{axis:"x",label:"X",color:"#e23838",vector:[1,0,0]},{axis:"y",label:"Y",color:"#2dbd50",vector:[0,1,0]},{axis:"z",label:"Z",color:"#3157d5",vector:[0,0,1]}],n=[];for(let r of s)for(let i of[-1,1]){let o=r.vector.map(b=>b*i),c=[Es(o,a.right),-Es(o,a.up),Es(o,a.back)];n.push({...r,sign:i,depth:c[2],point:[t[0]+c[0]*34,t[1]+c[1]*34]})}for(let r of s){let i=n.find(o=>o.axis===r.axis&&o.sign===1);e.strokeStyle=r.color,e.lineWidth=2.4,e.beginPath(),e.moveTo(...t),e.lineTo(...i.point),e.stroke()}Pa=[];for(let r of n.sort((i,o)=>o.depth-i.depth)){let i=r.sign===1,o=i?13:9;e.beginPath(),e.arc(r.point[0],r.point[1],o,0,Math.PI*2),e.fillStyle=i?r.color:`${r.color}66`,e.fill(),e.lineWidth=2,e.strokeStyle=qf(r.color,i?.45:.58),e.stroke(),i&&(e.fillStyle="#07101c",e.font="700 13px system-ui",e.textAlign="center",e.textBaseline="middle",e.fillText(r.label,r.point[0],r.point[1]+.5)),Pa.push({...r,radius:o+5})}}function Vf(){!we||we.dataset.bound==="true"||(we.dataset.bound="true",we.addEventListener("click",e=>{let t=we.width/we.clientWidth,a=we.height/we.clientHeight,s=[e.offsetX*t,e.offsetY*a],n=Pa.map(r=>({item:r,distance:Math.hypot(s[0]-r.point[0],s[1]-r.point[1])})).filter(({item:r,distance:i})=>i<=r.radius).sort((r,i)=>r.distance-i.distance)[0]?.item;n&&H.setAxis(n.axis,n.sign<0)}))}function zf(){if(x.mode!=="layer"||!Qe){Ba.innerHTML="";return}let e=$t(M.manifest.bbox),t=jr();Ba.innerHTML=M.copperLayers.filter(a=>t.has(Number(a.id))).map(a=>{let s=Mt.get(Number(a.id))||[0,0,0],n=Xf([e[0]+s[0],e[4]+s[1],0],Qe.matrix,Z.clientWidth,Z.clientHeight);return!n||n[0]<-100||n[0]>Z.clientWidth+100||n[1]<-100||n[1]>Z.clientHeight+100?"":`<span style="left:${n[0]}px;top:${n[1]}px">${G(a.name)}</span>`}).join("")}function Wr(){if(x.workspace!=="schematic"||!S){Da.innerHTML="";return}Da.innerHTML=C.visiblePages.filter(e=>S.pagePixelWidth(e)>120).map(e=>{let[t,a]=S.worldToScreen(e.worldX+8*S.scale,e.worldY-6*S.scale),s=e.id===x.selectedPageId,r=C.activeNetUid&&e.netUids.includes(C.activeNetUid)?"#18ef52":s?"#3b82f6":"#4b8de8";return`<div class="schematic-page-label" style="left:${t}px;top:${a}px;border-left-color:${r}">
        <strong>${G(e.name)}</strong>
        <small>Page ${e.sheetNumber} &middot; ${e.featureCount.toLocaleString()} features</small>
      </div>`}).join("")}function Xf(e,t,a,s){let n=e[0],r=e[1],i=e[2],o=t[0]*n+t[4]*r+t[8]*i+t[12],c=t[1]*n+t[5]*r+t[9]*i+t[13],b=t[3]*n+t[7]*r+t[11]*i+t[15];return Math.abs(b)<1e-8?null:[(o/b*.5+.5)*a,(.5-c/b*.5)*s]}function Es(e,t){return e[0]*t[0]+e[1]*t[1]+e[2]*t[2]}function qf(e,t){let a=e.replace("#","");return`#${[0,2,4].map(s=>Math.round(parseInt(a.slice(s,s+2),16)*t).toString(16).padStart(2,"0")).join("")}`}function vr(e,t){x.frameSamples.push({intervalMs:e,cpuMs:t}),x.frameSamples.length>180&&x.frameSamples.shift()}function wr(e,t){if(!e.length)return 0;let a=[...e].sort((s,n)=>s-n);return a[Math.min(a.length-1,Math.floor((a.length-1)*t))]}function Tr(e){if(!Na||(x.frames+=1,e-x.fpsAt<=500))return;x.fps=x.frames*1e3/(e-x.fpsAt);let t=x.frameSamples;if(x.frameIntervalMs=t.length?t.reduce((r,i)=>r+i.intervalMs,0)/t.length:0,x.frameCpuMs=t.length?t.reduce((r,i)=>r+i.cpuMs,0)/t.length:0,x.frameIntervalP95Ms=wr(t.map(r=>r.intervalMs),.95),x.frameCpuP95Ms=wr(t.map(r=>r.cpuMs),.95),x.frames=0,x.fpsAt=e,x.workspace==="bom"){let r=ze?.payload?.counts||{},i=[["Renderer","BoM DOM table"],["Schema",ze?.payload?.schema||"-"],["Grouped rows",r.rows||0],["Components",r.components||0],["DNP components",r.dnpComponents||0],["Extra columns",ze?.payload?.extraColumns?.length||0],["Frame interval",`${x.frameIntervalMs.toFixed(2)} ms avg / ${x.frameIntervalP95Ms.toFixed(2)} p95`],["CPU frame",`${x.frameCpuMs.toFixed(2)} ms avg / ${x.frameCpuP95Ms.toFixed(2)} p95`],["FPS",x.fps.toFixed(1)]];Na.innerHTML=i.map(([o,c])=>`<dt>${o}</dt><dd>${c}</dd>`).join("");return}let a=x.workspace==="schematic"&&S?S.stats():null,s=x.workspace==="schematic"&&q?q.stats():null,n=x.workspace==="schematic"&&S?q?.active?[["Renderer","SVG DOM schematic detail"],["Pages",C.pages.length],["Mounted pages",s.mountedPages],["Active page",s.activePage],["DOM nodes",s.domNodes.toLocaleString()],["Indexed features",s.indexedFeatures.toLocaleString()],["Indexed nets",s.indexedNets.toLocaleString()],["SVG cache",`${s.cachedSvgPages} pages / ${(s.cachedSvgBytes/1048576).toFixed(1)} MB`],["Selection",`${s.selectionMs.toFixed(1)} ms`],["Active net",M.nets.find(r=>r.uid===C.activeNetUid)?.name||"-"],["Tracking links",`${a.netFlowSegments} total / ${a.netFlowIntrasheetSegments} local`],["Tracking verts",a.netFlowVertices.toLocaleString()],["Mount",`${s.mountMs.toFixed(1)} ms`],["Highlight",`${s.highlightMs.toFixed(1)} ms`],["Fallback",s.fallbackReason||"-"],["Frame interval",`${x.frameIntervalMs.toFixed(2)} ms avg / ${x.frameIntervalP95Ms.toFixed(2)} p95`],["CPU frame",`${x.frameCpuMs.toFixed(2)} ms avg / ${x.frameCpuP95Ms.toFixed(2)} p95`],["FPS",x.fps.toFixed(1)]]:[["Renderer",q?"SVG DOM + WebGPU world":"WebGPU schematic world"],["Pages",C.pages.length],["Visible pages",C.visiblePages.length],["DOM pages",s?s.mountedPages:0],["DOM nodes",s?s.domNodes.toLocaleString():"0"],["Indexed SVG features",s?s.indexedFeatures.toLocaleString():"0"],["SVG cache",s?`${s.cachedSvgPages} pages / ${(s.cachedSvgBytes/1048576).toFixed(1)} MB`:"0 pages"],["JS heap",s?.heapMb?`${s.heapMb.toFixed(1)} MB`:"-"],["Hierarchy links",C.manifest.edges?.length||0],["Selected page",C.byId.get(x.selectedPageId)?.name||"-"],["Active net",M.nets.find(r=>r.uid===C.activeNetUid)?.name||"-"],["Tracking links",`${a.netFlowSegments} total / ${a.netFlowIntrasheetSegments} local`],["Downloaded",`${(S.downloadedBytes/1048576).toFixed(1)} MB`],["Resident vectors",`${(a.residentVectorBytes/1048576).toFixed(1)} MB`],["Vector pages",`${a.vectorChunks} loaded / ${a.vectorLoads} loading`],["Vector draw",`${a.vectorVertices.toLocaleString()} verts / ${a.vectorDrawChunks} chunks`],["Native detail",`${a.nativeDetailPages} pages @ ${a.nativePxPerMm} / ${a.nativeThresholdPxPerMm} px/mm`],["Vector failures",a.failedVectorChunks],["Truncated",a.truncatedVectors],["Frame interval",`${x.frameIntervalMs.toFixed(2)} ms avg / ${x.frameIntervalP95Ms.toFixed(2)} p95`],["CPU frame",`${x.frameCpuMs.toFixed(2)} ms avg / ${x.frameCpuP95Ms.toFixed(2)} p95`],["FPS",x.fps.toFixed(1)]]:[["Renderer","WebGPU semantic glTF"],["Mode",x.mode==="3d"?"3D":"Layer Compare"],["Visible layers",x.mode==="3d"?x.visible3dLayers.size:x.compareLayers.size],["Resident tiles",M.loaded.size],["Loading tiles",M.loading.size],["Failed tiles",M.failed.size],["Triangles",Math.round(x.triangles).toLocaleString()],["Downloaded",`${(x.loadedBytes/1048576).toFixed(1)} MB`],["Resident GLB",`${(x.residentTileBytes/1048576).toFixed(1)} MB`],["Resident GPU",`${(x.residentTileGpuBytes/1048576).toFixed(1)} MB`],["Tile loads",x.tileLoads.toLocaleString()],["Tile evictions",x.tileEvictions.toLocaleString()],["Tile scheduler",`${x.tileSchedulerMs.toFixed(2)} ms`],["Active net",M.nets.find(r=>Number(r.id)===x.activeNetId)?.name||"-"],["Frame interval",`${x.frameIntervalMs.toFixed(2)} ms avg / ${x.frameIntervalP95Ms.toFixed(2)} p95`],["CPU frame",`${x.frameCpuMs.toFixed(2)} ms avg / ${x.frameCpuP95Ms.toFixed(2)} p95`],["FPS",x.fps.toFixed(1)]];Na.innerHTML=n.map(([r,i])=>`<dt>${r}</dt><dd>${i}</dd>`).join("")}function Hf(e){return`rgb(${e.slice(0,3).map(t=>Math.round(t*255)).join(" ")})`}function G(e){return String(e).replace(/[&<>"']/g,t=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[t])}function Wf(){if(!Be)return;let e=M.layers||[];if(!e.length){Be.innerHTML='<div class="selection-empty" style="padding:40px;text-align:center;">No stackup information available for this board.</div>';return}let t=e.filter(R=>["copper","dielectric","paste","silkscreen","soldermask"].includes(R.role)),a=Te.board?.stackup||{},s=R=>{if(R==null||R==="")return"None";let O=String(R);return G(O.includes(".")?O.split(".").pop():O)},n=(R,O=4)=>{let V=Number(R);return Number.isFinite(V)&&V>0?V.toFixed(O):"-"},r=(R,O=3)=>{let V=Number(R);return Number.isFinite(V)?V.toFixed(O):"-"},i=R=>{if(R==null||R==="")return"No";if(typeof R=="boolean")return R?"Yes":"No";let O=String(R).trim().toLowerCase(),V=O.includes(".")?O.split(".").pop():O;return["0","false","no","n","off","none"].includes(V)?"No":(["1","true","yes","y","on"].includes(V),"Yes")},o=0,c=0,b=0,g=0;t.forEach(R=>{g+=R.thickness_mm||0,R.role==="copper"?R.name.toLowerCase().includes("gnd")||R.name.toLowerCase().includes("pwr")||R.name.toLowerCase().includes("plane")?c++:o++:R.role==="dielectric"&&b++});let h=M.copperLayers||[],w=0,y=0,f=0,d=new Map(h.map((R,O)=>[Number(R.id),O])),m=new Map(h.map(R=>[Number(R.id),R])),l=new Set,u=new Set,p=(R,O)=>{if(R){if(u.has(R))return;u.add(R)}let V=(O||[]).map(re=>Number(re)).filter(re=>d.has(re)).sort((re,he)=>d.get(re)-d.get(he));if(V.length<2)return;let ne=V[0],He=V[V.length-1],et=d.get(ne),We=d.get(He);et===void 0||We===void 0||(et===0&&We===h.length-1?w++:et===0||We===h.length-1?y++:f++,l.add(JSON.stringify([m.get(ne)?.name,m.get(He)?.name])))};for(let R of M.manifest?.barrels||[])R.kind==="via"&&p(Number(R.objectFeatureId||0),R.layerIds||[R.startLayerId,R.endLayerId]);M.features.forEach(R=>{R.kind==="via"&&p(Number(R.id||0),R.layerIds||[])});let v=Array.from(l).map(R=>JSON.parse(R)),T=0,I=[],k=new Map(t.map((R,O)=>[R,O])),A=Jf(t),_=(R,O)=>{let V=A.get(R.name);if(V!==void 0)return V;let ne=Number(R.stack_index);return Number.isFinite(ne)?ne:O+1e5},N=[...t].sort((R,O)=>{let V=_(R,k.get(R)||0),ne=_(O,k.get(O)||0);return V!==ne?V-ne:(O.z_mm||0)-(R.z_mm||0)});N.forEach(R=>{let O=12;R.role==="dielectric"?O=Math.max(160,Math.min(360,(R.thickness_mm||.1)*140)):R.role==="copper"?O=22:R.role==="soldermask"&&(O=14),I.push({...R,svgY:T,svgHeight:O}),T+=O});let F=560,j=170,B=170,P="";I.forEach(R=>{let O=R.color||"#7f7f7f";R.role==="copper"?O=R.color||"#f97316":R.role==="dielectric"?O="#a98d5c":R.role==="paste"?O="#cbd5e1":R.role==="soldermask"?O="#1b4332":R.role==="silkscreen"&&(O="#e2e8f0");let V=h.findIndex(ne=>ne.name===R.name);P+=`
      <g class="stackup-svg-layer" data-layer-id="${R.id}" data-layer-name="${R.name}">
        <rect x="${j}" y="${R.svgY}" width="${B}" height="${R.svgHeight}" fill="${O}" opacity="0.85" rx="1"/>
        <text x="${j-8}" y="${R.svgY+R.svgHeight/2+3}" fill="var(--muted)" font-size="9px" text-anchor="end" font-weight="700">
          ${R.role==="copper"?V+1:""}
        </text>
        <text x="${j+B+10}" y="${R.svgY+R.svgHeight/2+3}" fill="var(--foreground)" font-size="9px">
          ${R.name}${R.thickness_mm?` (${R.thickness_mm.toFixed(3)} mm)`:""}
        </text>
      </g>
    `});let X="",ae=I.filter(R=>R.role==="copper");v.forEach((R,O)=>{let V=I.find(Fe=>Fe.name===R[0]),ne=I.find(Fe=>Fe.name===R[1]);if(!V||!ne)return;let He=V.svgY,et=ne.svgY+ne.svgHeight,We=j+25+O*22,re=h.findIndex(Fe=>Fe.name===R[0]),he=h.findIndex(Fe=>Fe.name===R[1]),tt=re===0&&he===h.length-1,Zt=!tt&&(re===0||he===h.length-1),Bt=tt?"#d97706":Zt?"#0ea5e9":"#a855f7";X+=`
      <g class="stackup-svg-via" title="${tt?"Thru":Zt?"Blind":"Buried"}: ${R[0]} \u2192 ${R[1]}">
        ${ae.map(Fe=>Fe.svgY>=V.svgY&&Fe.svgY<=ne.svgY?`<rect x="${We-5}" y="${Fe.svgY}" width="10" height="${Fe.svgHeight}" fill="${Bt}" rx="0.5" />`:"").join("")}
        <rect x="${We-2}" y="${He}" width="4" height="${et-He}" fill="${Bt}" opacity="0.95" />
        <rect x="${We-.75}" y="${He-1}" width="1.5" height="${et-He+2}" fill="var(--panel)" opacity="0.9" />
      </g>
    `});let se=`
    <svg class="stackup-visual-svg" viewBox="0 0 ${F} ${T+10}" width="${F}" height="${T+10}">
      ${P}
      ${X}
    </svg>
  `,Ne="";N.forEach(R=>{let O="silk";R.role==="copper"?O="copper":R.role==="dielectric"?O="dielectric":R.role==="paste"?O="paste":R.role==="soldermask"&&(O="mask");let V=R.role==="dielectric"?R.type==="core"?"Core":R.type==="prepreg"||(R.material||"").toLowerCase().includes("prepreg")?"Prepreg":"Core":"";Ne+=`
      <tr data-layer-id="${R.id}" data-layer-name="${R.name}">
        <td><strong>${R.name}</strong></td>
        <td><span class="stackup-badge ${O}">${R.role}</span></td>
        <td>${V||"-"}</td>
        <td>${R.material||"-"}</td>
        <td>${R.role==="dielectric"?n(R.epsilon_r,3):"-"}</td>
        <td>${R.role==="dielectric"?n(R.loss_tangent,4):"-"}</td>
        <td>${R.thickness_mm?R.thickness_mm.toFixed(4)+" mm":"-"}</td>
      </tr>
    `});let de="",Ae=Te.board?.net_classes||[];Ae.length?Ae.forEach(R=>{de+=`
        <tr>
          <td><strong>${R.name}</strong></td>
          <td>${r(R.track_width)}</td>
          <td>${r(R.clearance)}</td>
          <td>${r(R.diff_pair_width)}</td>
          <td>${r(R.diff_pair_gap)}</td>
          <td>${Number.isFinite(Number(R.via_diameter))?`${r(R.via_drill)}/${r(R.via_diameter)}`:"-"}</td>
        </tr>
      `}):de=`
      <tr>
        <td colspan="6" class="selection-empty" style="text-align: center;">No design rules or impedance classes defined.</td>
      </tr>
    `,Be.innerHTML=`
    <div class="stackup-header">
      <div class="stackup-header-title">
        <h1>Layer Stackup</h1>
        <p>Board cross-section profile, layer properties & design rules</p>
      </div>
    </div>

    <div class="stackup-workspace-body">
      <div class="stackup-diagram-card">
        <span class="stackup-section-title">Cross-Section Profile</span>
        ${se}
      </div>
      <aside class="stackup-side-panel">
      <div class="stackup-summary-grid">
        <div class="stackup-summary-card">
          <label>Total Thickness</label>
          <span>${g.toFixed(4)} mm</span>
        </div>
        <div class="stackup-summary-card">
          <label>Copper Layers</label>
          <span>${h.length} (${o} Sig / ${c} Plane)</span>
        </div>
        <div class="stackup-summary-card">
          <label>Dielectrics</label>
          <span>${b} Layers</span>
        </div>
        <div class="stackup-summary-card">
          <label>Thru Vias</label>
          <span>${w}</span>
        </div>
        <div class="stackup-summary-card">
          <label>Blind Vias</label>
          <span>${y}</span>
        </div>
        <div class="stackup-summary-card">
          <label>Buried Vias</label>
          <span>${f}</span>
        </div>
      </div>
      <span class="stackup-section-title">Fabrication</span>
      <div class="stackup-summary-grid">
        <div class="stackup-summary-card">
          <label>Copper Finish</label>
          <span>${s(a.copper_finish)}</span>
        </div>
        <div class="stackup-summary-card">
          <label>Edge Connector</label>
          <span>${i(a.edge_connector)}</span>
        </div>
        <div class="stackup-summary-card">
          <label>Castellated Holes</label>
          <span>${i(a.castellated_pads)}</span>
        </div>
        <div class="stackup-summary-card">
          <label>Edge Plating</label>
          <span>${i(a.edge_plating)}</span>
        </div>
      </div>
      <div class="stackup-tables-container">
        <div class="stackup-table-section">
          <span class="stackup-section-title">Layers Stackup</span>
          <div class="stackup-table-wrapper">
            <table class="stackup-table">
              <thead>
                <tr>
                  <th>Layer</th>
                  <th>Type</th>
                  <th>Subtype</th>
                  <th>Material</th>
                  <th>\u03B5r</th>
                  <th>tan \u03B4</th>
                  <th>Thickness</th>
                </tr>
              </thead>
              <tbody>
                ${Ne}
              </tbody>
            </table>
          </div>
        </div>

        <div class="stackup-table-section">
          <span class="stackup-section-title">Impedance Net Classes</span>
          <div class="stackup-table-wrapper">
            <table class="stackup-table">
              <thead>
                <tr>
                  <th>Class</th>
                  <th>Width</th>
                  <th>Clearance</th>
                  <th>Diff W</th>
                  <th>Diff Gap</th>
                  <th>Drill/Dia</th>
                </tr>
              </thead>
              <tbody>
                ${de}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      </aside>
    </div>
  `;let je=(R,O)=>{Be.querySelectorAll(".stackup-svg-layer").forEach(V=>{let ne=V.dataset.layerName===R;V.classList.toggle("active",ne&&O)}),Be.querySelectorAll(".stackup-table tbody tr").forEach(V=>{let ne=V.dataset.layerName===R;V.classList.toggle("active",ne&&O)})},xe=R=>{R.forEach(O=>{O.addEventListener("mouseenter",()=>{let V=O.dataset.layerName;je(V,!0)}),O.addEventListener("mouseleave",()=>{je(null,!1)})})};xe(Be.querySelectorAll(".stackup-svg-layer")),xe(Be.querySelectorAll(".stackup-table tbody tr"))}function Jf(e){let t=e.filter(n=>n.role==="dielectric");if(!(t.length===1&&t[0]?.name==="Board"))return new Map;let s=new Map;return["F.SilkS","F.Paste","F.Mask","F.Cu","Board","B.Cu","B.Mask","B.Paste","B.SilkS"].forEach((n,r)=>s.set(n,r)),s}var Yf="prism.visualizer_bundle.a0";function $f(e){let t=Jr(e||"Semantic Visualizer");return`
    <style>
      ${Ks}
      #app { grid-template-columns: minmax(0, 1fr) 376px; }
      #app.panel-collapsed { grid-template-columns: minmax(0, 1fr) 46px; }
      #selection-card { display: none !important; }
    </style>
    <main id="app">
      <section class="viewport-shell">
        <canvas id="viewport"></canvas>
        <div id="stackup-workspace-view" hidden></div>
        <div id="panel-labels"></div>
        <div id="selection-card" hidden></div>
        <canvas id="axis-gizmo" width="112" height="112" title="Click an axis to align the camera"></canvas>
        <div id="fallback" hidden></div>
      </section>
      <aside class="panel">
        <nav class="panel-rail" aria-label="Viewer tools">
          <button class="rail-tab active" data-tab="layers" title="Layers">Layers</button>
          <button class="rail-tab" data-tab="search" title="Search and selection">Find</button>
          <button class="rail-tab" data-tab="view" title="View controls">View</button>
        </nav>
        <div class="panel-drawer">
          <header>
            <p id="viewer-kind" class="eyebrow">Prism WebGPU 3D</p>
            <h1>${t}</h1>
            <p id="status">Booting renderer</p>
          </header>
          <section class="tab-panel active" data-panel="layers">
            <div class="section-heading"><h2 id="primary-heading">Layers</h2><span id="primary-description">Visibility and compare</span></div>
            <div id="layers"></div>
          </section>
          <section class="tab-panel" data-panel="search">
            <div class="section-heading"><h2>Find</h2><span>Nets, components and pins</span></div>
            <div id="search-controls"></div>
          </section>
          <section class="tab-panel" data-panel="view">
            <div class="section-heading"><h2>View</h2><span>Camera and stackup</span></div>
            <div id="view-controls"></div>
          </section>
        </div>
      </aside>
    </main>
  `}function Jr(e){return String(e).replace(/[&<>"']/g,t=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[t])}async function Us(e){let t=await fetch(e,{cache:"no-store"});if(!t.ok)throw new Error(`Failed to load ${e}: ${t.status}`);return t.json()}function Qf(e,t){if(!t)return e;let a=new URL(e);return a.searchParams.set("viewer",t),a.toString()}function Zf(e,t,a,s){let n=new URL(a.asset_base||"./",t),r=structuredClone(e||{}),i=o=>!o||typeof o!="string"?o:Qf(new URL(o,n).toString(),s);for(let o of["assets","semantic_gltf","schematic_world","schematic_vector","schematic_scene","bom"]){let c=r[o];if(!(!c||typeof c!="object"))for(let[b,g]of Object.entries(c))c[b]=i(g)}return r}async function eb(e){let t=new URL(e,document.baseURI).toString(),a=new URL(t).searchParams.get("viewer")||"",s=await Us(t);if(s.schema!==Yf)throw new Error(`Unsupported visualizer bundle schema: ${s.schema||"missing"}`);let n=new URL(s.topology||"topology.json",t),r=new URL(s.semantic_geometry||"semantic_geometry.json",t),[i,o]=await Promise.all([Us(n),Us(r)]);return{bundle:s,topology:i,semanticGeometry:Zf(o,t,s,a)}}var Ls=class extends HTMLElement{static get observedAttributes(){return["bundle-url"]}constructor(){super(),this.attachShadow({mode:"open"}),this.controller=null,this.abortController=null,this.pendingSelection=null}connectedCallback(){this.reload()}disconnectedCallback(){this.abortController?.abort(),this.controller?.dispose?.(),this.controller=null}attributeChangedCallback(){this.isConnected&&this.reload()}async reload(){let t=this.getAttribute("bundle-url");if(this.abortController?.abort(),this.abortController=new AbortController,this.controller?.dispose?.(),this.controller=null,!t){this.shadowRoot.innerHTML="<style>:host{display:block;height:100%;font:14px system-ui;color:#94a3b8}</style><div>Semantic bundle URL is missing.</div>";return}try{this.shadowRoot.innerHTML='<style>:host{display:block;height:100%;background:#020817;color:#e5e7eb;font:14px system-ui}</style><div style="display:grid;place-items:center;height:100%">Loading semantic visualizer...</div>';let{bundle:a,topology:s,semanticGeometry:n}=await eb(t);if(this.abortController.signal.aborted)return;this.shadowRoot.innerHTML=$f(a.project_name||s?.design?.name||"Semantic Visualizer"),this.controller=await js({root:this.shadowRoot,topology:s,semanticGeometry:n,workspaceScope:"3d",isActive:()=>this.getAttribute("active")==="true",onSelectionChange:r=>{this.dispatchEvent(new CustomEvent("prism-semantic-viewer:selectionchange",{bubbles:!0,composed:!0,detail:{selection:r}}))}}),this.controller?.setSelection?.(this.pendingSelection),this.dispatchEvent(new CustomEvent("prism-semantic-viewer:ready",{bubbles:!0}))}catch(a){console.error(a),this.shadowRoot.innerHTML=`
        <style>
          :host{display:block;height:100%;background:#020817;color:#e5e7eb;font:14px system-ui}
          .error{height:100%;display:grid;place-items:center;padding:24px}
          pre{max-width:100%;white-space:pre-wrap;color:#fecaca;background:#111827;border:1px solid #374151;padding:16px}
        </style>
        <div class="error"><pre>${Jr(a?.stack||a?.message||String(a))}</pre></div>
      `,this.dispatchEvent(new CustomEvent("prism-semantic-viewer:error",{bubbles:!0,detail:{error:a}}))}}setSelection(t){this.pendingSelection=t||null,this.controller?.setSelection?.(this.pendingSelection)}resize(){this.controller?.resize?.()}};function Yr(){customElements.get("prism-semantic-viewer")||customElements.define("prism-semantic-viewer",Ls)}window.__PRISM_SEMANTIC_VIEWER_MANUAL_BOOT__=!0;Yr();
