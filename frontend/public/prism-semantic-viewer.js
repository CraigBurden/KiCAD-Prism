function di(e){let t=`${e.nodeName||""} ${e.meshName||""} ${e.material?.name||""}`.toLowerCase();return t.includes("_pad")||t.includes(".pad")||t.endsWith("pad")?"pad":t.includes("silkscreen")?"silkscreen":t.includes("soldermask")?"soldermask":t.includes("paste")?"paste":"substrate"}function Vc(e){let t=String(e.material?.name||"").toLowerCase();if(t.endsWith("_bottom"))return"back";if(t.endsWith("_top"))return"front";let r=e.bounds;return r&&(r[2]+r[5])/2<0?"back":"front"}function ea(e,t=()=>""){let r=new Map;for(let a of e){let n=`${t(a)}:${JSON.stringify(a.material)}`;r.has(n)||r.set(n,[]),r.get(n).push(a)}return[...r.values()].map(a=>{let s=a.reduce((h,u)=>h+u.position.length/3,0),n=a.reduce((h,u)=>h+u.indices.length,0),i=new Float32Array(s*3),o=new Float32Array(s*3),c=new Uint32Array(s),l=new Uint32Array(s),f=new Uint32Array(n),d=0,p=0,b=[1/0,1/0,1/0,-1/0,-1/0,-1/0];for(let h of a){let u=h.position.length/3;i.set(h.position,d*3),o.set(h.normal,d*3),c.set(h.netId,d),l.set(h.objectFeatureId,d);for(let m=0;m<h.indices.length;m+=1)f[p+m]=Number(h.indices[m])+d;h.bounds&&(b[0]=Math.min(b[0],h.bounds[0]),b[1]=Math.min(b[1],h.bounds[1]),b[2]=Math.min(b[2],h.bounds[2]),b[3]=Math.max(b[3],h.bounds[3]),b[4]=Math.max(b[4],h.bounds[4]),b[5]=Math.max(b[5],h.bounds[5])),d+=u,p+=h.indices.length}return{position:i,normal:o,netId:c,objectFeatureId:l,indices:f,material:a[0].material,groupKey:t(a[0]),bounds:Number.isFinite(b[0])?b:null}})}function ta(e){return!e||e.length!==6?null:[e[0]/1e3,-e[4]/1e3,e[2]/1e3,e[3]/1e3,-e[1]/1e3,e[5]/1e3]}function ra(e){let t=e?.min||[0,0,0],r=e?.max||[.08,.0016,.05];return[t[0],-r[2],t[1],r[0],-t[2],r[1]]}function Tr(e){let t=e.filter(r=>Array.isArray(r)&&r.length===6);return t.length?t.reduce((r,a)=>[Math.min(r[0],a[0]),Math.min(r[1],a[1]),Math.min(r[2],a[2]),Math.max(r[3],a[3]),Math.max(r[4],a[4]),Math.max(r[5],a[5])],[...t[0]]):null}function Kc(e){let t=e.replace("#","");return[0,2,4].map(r=>parseInt(t.slice(r,r+2),16)/255)}var sg="#c83434",ng="#4d7fc4",is=["#7fc87f","#ce7d2c","#4fcbcb","#db628b","#a7a5c6","#28ccd9","#e8b2a7","#f2eda1","#8dcb81","#ed7c33","#5bc3eb","#f76f8e","#a7a5c6","#28ccd9","#e8b2a7","#f2eda1","#ed7c33","#5bc3eb","#f76f8e","#a7a5c6","#28ccd9","#e8b2a7","#f2eda1","#ed7c33","#5bc3eb","#f76f8e","#a7a5c6","#28ccd9","#e8b2a7","#f2eda1"];function ui(e,t=0){if(e==="F.Cu")return sg;if(e==="B.Cu")return ng;let r=/^In(\d+)\.Cu$/.exec(String(e||""))?.[1],a=r?Number(r)-1:t;return is[(a%is.length+is.length)%is.length]}function Hc(e,t){if(typeof e?.color=="string"&&/^#[0-9a-fA-F]{6}$/.test(e.color))return[...Kc(e.color),1];let r=String(e?.name||""),a=Math.max(0,t.findIndex(s=>s.name===r)-1);return[...Kc(ui(r,a)),1]}function qc(e,t){let r=t.map(a=>[Number(a.id),Number(a.z_mm||0)]);return r.length<3?!1:(r.sort((a,s)=>a[1]-s[1]),e!==r[0][0]&&e!==r[r.length-1][0])}var Zr=Object.freeze({gold:[.83,.69,.37,1],silver:[.74,.75,.77,1],copper:[.76,.47,.28,1]});function Wc(e){let t=String(e||"").toLowerCase();return/hasl|hal\b|tin|silver|lead/.test(t)?Zr.silver:/osp|bare|none/.test(t)?Zr.copper:Zr.gold}function Xc(e,t){let r=String(e?.name||"");return!!r&&(r===t[0]?.name||r===t[t.length-1]?.name)}function $c(e,t){let r=String(e.material?.name||"").endsWith("_bottom"),a=t.find(s=>s.name===(r?"B.Cu":"F.Cu"))||(r?t[t.length-1]:t[0]);return Number(a?.id||0)}var Jc="prism.viewer_3d.analytic.a0",hi={"F.SilkS":"#f2f2f2","B.SilkS":"#dddddd","F.Mask":"#316d4f","B.Mask":"#275840","F.Paste":"#c5cbd3","B.Paste":"#aeb7c2"},ig="#2f6b4f",og={green:"#316d4f",red:"#a5272a",blue:"#1f4f8a",yellow:"#c9a227",white:"#e6e6e6",black:"#1a1a1a",purple:"#5b2d7a"},cg={conductor:"copper",dielectric:"dielectric",solder_mask:"soldermask",silkscreen:"silkscreen",paste:"paste"},lg={copper:"copper",dielectric:"FR4",soldermask:"soldermask",silkscreen:"ink",paste:"paste"};function dg(e,t){let r=String(e?.maskColors?.[t]||"").trim();return/^#[0-9a-f]{6}$/i.test(r)?r:og[r.toLowerCase()]||(t==="back"?hi["B.Mask"]:hi["F.Mask"])}function ug(e,t=null){let r=[...e?.stack?.slices||[]].sort((c,l)=>c.order-l.order),a=c=>Number(c.thickness_nm||0)/1e6,n=r.reduce((c,l)=>c+a(l),0)/2,i=0,o=[];for(let c of r){let l=cg[c.role],f=a(c),d=n-f/2;if(n-=f,!l)continue;let p=String(c.kicad_layer||c.key),b=hi[p];l==="copper"&&(b=ui(p,p==="F.Cu"||p==="B.Cu"?0:i++)),l==="soldermask"&&(b=dg(t,c.side==="back"?"back":"front")),l==="dielectric"&&(b=c.color||ig),o.push({id:o.length+1,uid:`layer_${c.key}`,name:p,role:l,z_mm:+d.toFixed(6)||0,thickness_mm:+f.toFixed(6),material:c.material_name||lg[l],color:b||"#8a8a8a",visibility_group:l==="dielectric"?"board":l,stack_index:c.order,side:c.side||null,sliceKey:c.key})}return o}function fg(e){let t=e?.chunks||[],r=t.filter(s=>String(s.slice_key||"").startsWith("dielectric")),a=null;for(let s of r.length?r:t){let n=s.bounds;if(!n)continue;let i=[n.min_x_nm,n.min_y_nm,n.max_x_nm,n.max_y_nm].map(o=>Number(o)/1e6);a=a?[Math.min(a[0],i[0]),Math.min(a[1],i[1]),Math.max(a[2],i[2]),Math.max(a[3],i[3])]:i}return a}function Qc(e,t=null){let r=ug(e,t),a=[{id:0,uid:"",name:"",netClass:""}];for(let c of e?.nets||[])c?.name&&a.push({id:a.length,uid:String(c.key||c.name),name:String(c.name),netClass:String(c.net_class||""),aliases:[]});let s=(e?.components||[]).map((c,l)=>({id:l+1,featureId:0,uid:String(c.source_uid||""),designator:String(c.refdes||""),footprint:String(c.footprint||""),side:c.side||null,nodeIndex:null,meshNames:[]})),n=fg(e),i=Number(e?.stack?.board_thickness_nm||0)/1e6;return{schema:"prism.analytic_scene.a0",bbox:n?{min:[n[0]/1e3,-i/2e3,n[1]/1e3],max:[n[2]/1e3,i/2e3,n[3]/1e3]}:null,layers:r,copperLayerIds:r.filter(c=>c.role==="copper").map(c=>c.id),nets:a,objectFeatures:[],components:s,tiles:[],barrels:[]}}var fi={green:[.06,.16,.11,.83],red:[.52,.05,.05,.83],blue:[.05,.12,.42,.83],black:[.05,.05,.05,.85],white:[.9,.9,.9,.83],purple:[.3,.1,.4,.83],yellow:[.7,.62,.1,.83]},hg=[.62,.63,.65,1],bg=[.9,.9,.88,1],pg=e=>{let t=e/255;return t<=.04045?t/12.92:((t+.055)/1.055)**2.4};function Yc(e){let t=String(e||"").trim().toLowerCase(),r=/^#([0-9a-f]{6})([0-9a-f]{2})?$/.exec(t);if(r){let a=[0,2,4].map(n=>parseInt(r[1].slice(n,n+2),16)),s=r[2]?parseInt(r[2],16)/255:fi.green[3];return[...a.map(n=>+pg(n).toFixed(4)),+s.toFixed(4)]}return[...fi[t]||fi.green]}function Zc(e){let t=e?.maskColors?.front||"";return{soldermask:{front:Yc(t),back:Yc(e?.maskColors?.back||t)},paste:[...hg],silkscreen:[...bg]}}var el=`:host,
:root {
  color-scheme: dark;
  --shell: var(--prism-shell, #09090b);
  --panel: var(--prism-panel, #09090b);
  --panel-raised: var(--prism-panel-raised, #18181b);
  --control: var(--prism-control, #18181b);
  --control-hover: var(--prism-control-hover, #27272a);
  --foreground: var(--prism-foreground, #fafafa);
  --muted: var(--prism-muted, #a1a1aa);
  --border: var(--prism-border, #27272a);
  --primary: var(--prism-primary, #3b82f6);
  --primary-foreground: var(--prism-primary-foreground, var(--panel));
  --surface: var(--prism-shell, #09090b);
  --stackup-via-thru: color-mix(in srgb, var(--primary) 34%, var(--foreground));
  --stackup-via-blind: var(--primary);
  --stackup-via-buried: color-mix(in srgb, var(--primary) 58%, var(--muted));
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
  left: calc(var(--prism-viewport-inset-left, 0px) + 14px);
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

.panel-mode-header {
  padding-top: 1px;
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

.mode-toolbar button.active {
  background: var(--primary);
  border: 1px solid var(--primary);
  color: var(--primary-foreground);
  box-shadow: 0 1px 2px color-mix(in srgb, var(--primary) 30%, transparent);
}

.quick-actions button.active {
  background: var(--control-hover);
  border: 1px solid var(--border);
  color: var(--foreground);
  box-shadow: 0 1px 2px color-mix(in srgb, var(--shell) 60%, transparent);
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
  overflow: hidden;
  background: var(--shell);
  color: var(--foreground);
  padding: clamp(20px, 3vw, 40px);
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
  padding-bottom: 18px;
  border-bottom: 1px solid var(--border);
}

.stackup-header-title {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.stackup-header-title h1 {
  font-size: clamp(22px, 2vw, 30px);
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
  background: color-mix(in srgb, var(--panel-raised) 54%, var(--panel));
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
  align-items: stretch;
  flex: 1;
  min-height: 0;
}

.stackup-diagram-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  align-items: center;
  justify-content: flex-start;
  background: color-mix(in srgb, var(--panel-raised) 38%, var(--panel));
  border: 1px solid var(--border);
  border-radius: 6px;
  min-height: 0;
  height: 100%;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 32px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.stackup-visual-svg {
  width: 96%;
  max-width: 720px;
  height: auto;
  flex: none;
  overflow: visible;
}

.stackup-side-panel {
  display: flex;
  flex-direction: column;
  gap: 18px;
  min-width: 0;
  height: 100%;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding-right: 4px;
}

.stackup-via-legend {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 14px;
  color: var(--muted);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.stackup-via-legend span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.stackup-via-legend i {
  width: 9px;
  height: 9px;
  border-radius: 2px;
  background: var(--stackup-via-thru);
}

.stackup-via-legend i[data-via-type="blind"] {
  background: var(--stackup-via-blind);
}

.stackup-via-legend i[data-via-type="buried"] {
  background: var(--stackup-via-buried);
}

.stackup-svg-layer {
  cursor: pointer;
  transition: opacity 120ms ease, filter 120ms ease;
}

.stackup-svg-column-headings text {
  fill: var(--muted);
  font-size: 8px;
  font-weight: 750;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.stackup-layer-dimension,
.stackup-total-dimension path {
  fill: none;
  stroke: var(--muted);
  stroke-width: 1;
  vector-effect: non-scaling-stroke;
}

.stackup-total-dimension text {
  fill: var(--muted);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-anchor: middle;
  text-transform: uppercase;
}

.stackup-layer-name,
.stackup-layer-thickness,
.stackup-layer-metadata {
  transition: fill 120ms ease, font-weight 120ms ease;
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

.stackup-svg-layer.active .stackup-layer-dimension {
  stroke: var(--primary);
  stroke-width: 1.5px;
}

.stackup-svg-layer.active .stackup-layer-name,
.stackup-svg-layer.active .stackup-layer-thickness {
  fill: var(--primary);
  font-weight: 800;
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

.stackup-section-heading {
  min-height: 28px;
  display: flex;
  align-items: center;
  padding: 0 10px;
  border-left: 3px solid var(--primary);
  background: color-mix(in srgb, var(--primary) 9%, var(--panel));
  color: var(--foreground);
  font-size: 11px;
  letter-spacing: 0.1em;
}

.stackup-section-heading small {
  margin-left: auto;
  color: var(--muted);
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0;
  text-transform: none;
}

.stackup-table-wrapper {
  overflow: auto;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: color-mix(in srgb, var(--panel-raised) 26%, var(--panel));
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
  background: color-mix(in srgb, var(--primary) 10%, transparent);
  color: var(--primary);
}

.stackup-table tr:hover td {
  background: var(--control-hover);
}

.stackup-table tbody tr[data-layer-id] {
  cursor: crosshair;
}

.stackup-table tbody tr[data-layer-id]:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: -2px;
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
  #stackup-workspace-view {
    overflow-y: auto;
  }

  .stackup-workspace-body {
    grid-template-columns: 1fr;
    flex: none;
  }

  .stackup-diagram-card {
    min-height: auto;
    height: auto;
    overflow: visible;
  }

  .stackup-side-panel {
    height: auto;
    overflow: visible;
    padding-right: 0;
  }

  .stackup-table-wrapper {
    max-height: none;
  }
}

@media (max-width: 760px) {
  #stackup-workspace-view {
    padding: 16px;
  }

  .stackup-diagram-card {
    align-items: flex-start;
    overflow-x: auto;
  }

  .stackup-visual-svg,
  .stackup-via-legend {
    width: 680px;
    max-width: none;
  }

  .stackup-summary-grid {
    grid-template-columns: 1fr;
  }
}
`;var mg=/\/api\/projects\/([^/]+)\/webgpu-3d\/assets\/([^/]+)\/([^/]+)\/(.+)$/,yg="prism-bundle-cache-a0",bi="manifest.json";function pi(e){let t;try{t=new URL(e,"http://cache.invalid/")}catch{return null}let r=mg.exec(t.pathname);if(!r)return null;let[,a,s,n,i]=r.map(decodeURIComponent);if(i.split("/").some(c=>!c||c==="."||c===".."))return null;let o=t.searchParams.get("viewer")||"";return`${a}/${s}/${n}/${i}${o?`?viewer=${o}`:""}`}function os(e){return`a_${encodeURIComponent(e)}`}function xg(e,t,{maxAgeMs:r=2592e6,maxBytes:a=2147483648}={}){let s=new Set,n=[];for(let[o,c]of Object.entries(e))t-Number(c.lastUsed||0)<=r?n.push([o,c]):s.add(o);n.sort((o,c)=>Number(c[1].lastUsed)-Number(o[1].lastUsed));let i=0;for(let[o,c]of n)i+=Number(c.bytes||0),i>a&&s.add(o);return[...s]}var cs=class e{static open(t={}){return e.shared||(e.shared=new e(t)),e.shared}constructor({maxAgeMs:t=2592e6,maxBytes:r=2147483648}={}){this.maxAgeMs=t,this.maxBytes=r,this.stats={hits:0,misses:0,bypassed:0,cachedBytes:0,networkBytes:0,writeErrors:0},this.ready=this.init(),this.flushTimer=null}async init(){try{let t=globalThis.navigator?.storage;if(!t?.getDirectory)return null;let a=await(await t.getDirectory()).getDirectoryHandle(yg,{create:!0}),s=await a.getFileHandle(bi,{create:!0});if(typeof s.createWritable!="function")return null;let n={};try{let i=await(await s.getFile()).text();n=i?JSON.parse(i).entries||{}:{}}catch{n={}}return this.directory=a,this.entries=n,await this.prune(),globalThis.addEventListener?.("pagehide",()=>void this.flush()),a}catch{return null}}get enabled(){return!!this.directory}async fetchBytes(t,{store:r=!0,signal:a}={}){let s=pi(t);if(await this.ready,s&&this.directory){let c=await this.read(s);if(c)return this.stats.hits+=1,this.stats.cachedBytes+=c.byteLength,c;this.stats.misses+=1}else this.stats.bypassed+=1;let n=await fetch(t,{cache:"no-store",signal:a});if(!n.ok)throw new Error(`Failed to load ${t}: ${n.status}`);let i=await n.arrayBuffer(),o=Number(n.headers.get("content-length")||0);return this.stats.networkBytes+=i.byteLength,r&&s&&this.directory&&(!o||o===i.byteLength)&&this.write(s,i),i}async fetchJson(t,r={}){let a=await this.fetchBytes(t,r);return JSON.parse(new TextDecoder().decode(a))}async peekJson(t){let r=pi(t);if(await this.ready,!r||!this.directory)return null;let a=await this.read(r);return a?(this.stats.hits+=1,this.stats.cachedBytes+=a.byteLength,JSON.parse(new TextDecoder().decode(a))):null}async store(t,r){let a=pi(t);await this.ready,a&&this.directory&&await this.write(a,r)}async read(t){let r=this.entries[t];if(!r)return null;try{let a=await(await this.directory.getFileHandle(os(t))).getFile();return a.size!==r.bytes?null:(r.lastUsed=Date.now(),this.scheduleFlush(),await a.arrayBuffer())}catch{return delete this.entries[t],null}}async write(t,r){try{let s=await(await this.directory.getFileHandle(os(t),{create:!0})).createWritable();await s.write(r),await s.close(),this.entries[t]={bytes:r.byteLength,lastUsed:Date.now()},this.scheduleFlush()}catch{this.stats.writeErrors+=1}}async prune(t=Date.now()){if(!this.directory)return[];let r=xg(this.entries,t,{maxAgeMs:this.maxAgeMs,maxBytes:this.maxBytes});for(let s of r)delete this.entries[s],await this.directory.removeEntry(os(s)).catch(()=>{});let a=new Set(Object.keys(this.entries).map(os));for await(let s of this.directory.keys())s!==bi&&!a.has(s)&&await this.directory.removeEntry(s).catch(()=>{});return r.length&&await this.flush(),r}async clear(){await this.ready,this.directory&&(this.entries={},await this.prune(),await this.flush())}summary(){let t=Object.values(this.entries||{});return{enabled:this.enabled,files:t.length,bytes:t.reduce((r,a)=>r+Number(a.bytes||0),0),...this.stats}}scheduleFlush(){this.flushTimer||(this.flushTimer=setTimeout(()=>{this.flushTimer=null,this.flush()},1e3))}async flush(){if(this.directory)try{let r=await(await this.directory.getFileHandle(bi,{create:!0})).createWritable();await r.write(JSON.stringify({schema:"prism.bundle_cache_manifest.a0",entries:this.entries})),await r.close()}catch{this.stats.writeErrors+=1}}};function wg(e,t){if(!t)return e;let r=new URL(e);return r.searchParams.set("viewer",t),r.toString()}function gi(e,t,r,a){let s=new URL(r.asset_base||"./",t),n=structuredClone(e||{}),i=o=>!o||typeof o!="string"?o:wg(new URL(o,s).toString(),a);for(let o of["assets","semantic_gltf","schematic_world","schematic_vector","schematic_scene","bom"]){let c=n[o];if(!(!c||typeof c!="object"))for(let[l,f]of Object.entries(c))c[l]=i(f)}return n}function mi(e){return(e?.readiness?.stage||"semantic-ready")==="semantic-ready"&&(e?.readiness?.progress??100)>=100}var be=(e,t,r)=>Math.max(t,Math.min(r,e)),ds=(e,t,r)=>e+(t-e)*r;function Ne(e,t){return[e[0]+t[0],e[1]+t[1],e[2]+t[2]]}function vg(e,t){return[e[0]-t[0],e[1]-t[1],e[2]-t[2]]}function ve(e,t){return[e[0]*t,e[1]*t,e[2]*t]}function Mg(e){return Math.hypot(e[0],e[1],e[2])}function Je(e){let t=Mg(e)||1;return ve(e,1/t)}function Qe(e,t){return[e[1]*t[2]-e[2]*t[1],e[2]*t[0]-e[0]*t[2],e[0]*t[1]-e[1]*t[0]]}function it(e,t){return e[0]*t[0]+e[1]*t[1]+e[2]*t[2]}function tl(e,t){let r=t/2,a=Math.sin(r),s=Je(e);return[s[0]*a,s[1]*a,s[2]*a,Math.cos(r)]}function ls(e,t){return[e[3]*t[0]+e[0]*t[3]+e[1]*t[2]-e[2]*t[1],e[3]*t[1]-e[0]*t[2]+e[1]*t[3]+e[2]*t[0],e[3]*t[2]+e[0]*t[1]-e[1]*t[0]+e[2]*t[3],e[3]*t[3]-e[0]*t[0]-e[1]*t[1]-e[2]*t[2]]}function yi(e,t){let r=[t[0],t[1],t[2],0],a=[-e[0],-e[1],-e[2],e[3]];return ls(ls(e,r),a).slice(0,3)}function ir(e,t){let r=new Float32Array(16);for(let a=0;a<4;a+=1)for(let s=0;s<4;s+=1)r[a*4+s]=e[s]*t[a*4]+e[4+s]*t[a*4+1]+e[8+s]*t[a*4+2]+e[12+s]*t[a*4+3];return r}function us(e,t,r){let a=Je(vg(e,t)),s=Je(Qe(r,a)),n=Qe(a,s);return new Float32Array([s[0],n[0],a[0],0,s[1],n[1],a[1],0,s[2],n[2],a[2],0,-it(s,e),-it(n,e),-it(a,e),1])}function rl(e,t,r,a){let s=1/Math.tan(e/2);return new Float32Array([s/t,0,0,0,0,s,0,0,0,0,r/(a-r),-1,0,0,r*a/(a-r),0])}function fs(e,t,r,a){return new Float32Array([2/e,0,0,0,0,2/t,0,0,0,0,1/(a-r),0,0,0,1,1])}function xi(e){return[(e[0]+e[3])/2,(e[1]+e[4])/2,(e[2]+e[5])/2]}function Ct(e){return Math.max(.001,Math.hypot(e[3]-e[0],e[4]-e[1],e[5]-e[2])/2)}var aa=class{constructor(t){let r=xi(t),a=Ct(t);this.focus=[...r],this.targetFocus=[...r],this.azimuth=-.62,this.targetAzimuth=this.azimuth,this.polar=.72,this.targetPolar=this.polar,this.distance=a*2.8,this.targetDistance=this.distance,this.orthoScale=a*2.15,this.targetOrthoScale=this.orthoScale,this.sceneRadius=a,this.fov=Math.PI/4}update(t){let r=1-Math.exp(-t*14);this.focus=this.focus.map((a,s)=>ds(a,this.targetFocus[s],r)),this.azimuth=sl(this.azimuth,this.targetAzimuth,r),this.polar=sl(this.polar,this.targetPolar,r),this.distance=ds(this.distance,this.targetDistance,r),this.orthoScale=ds(this.orthoScale,this.targetOrthoScale,r)}snap(){this.focus=[...this.targetFocus],this.azimuth=this.targetAzimuth,this.polar=this.targetPolar,this.distance=this.targetDistance,this.orthoScale=this.targetOrthoScale}basis(){let t=Math.sin(this.polar),r=Math.cos(this.polar),a=Je([t*Math.sin(this.azimuth),-t*Math.cos(this.azimuth),r]),s=Je([Math.cos(this.azimuth),Math.sin(this.azimuth),0]),n=Je(Qe(a,s));return{right:s,up:n,back:a}}matrix(t,r,a=!1,s=1){let n=Math.max(.01,t/Math.max(1,r)),{up:i,back:o}=this.basis(),c=Ne(this.focus,ve(o,this.distance)),l=us(c,this.focus,i),f=a?fs(this.orthoScale*s*n,this.orthoScale*s,-this.sceneRadius*40,this.sceneRadius*40):rl(this.fov,n,Math.max(this.sceneRadius*5e-4,this.distance-this.sceneRadius*3.5),this.distance+this.sceneRadius*4.5);return ir(f,l)}targetMatrix(t,r,a=!1,s=0){let n=(l,f)=>f+(f-l)*s,i=[this.focus,this.azimuth,this.polar,this.distance,this.orthoScale];this.focus=this.focus.map((l,f)=>n(l,this.targetFocus[f]));let o=(l,f)=>f+Math.atan2(Math.sin(f-l),Math.cos(f-l))*s;this.azimuth=o(this.azimuth,this.targetAzimuth),this.polar=o(this.polar,this.targetPolar),this.distance=Math.max(this.sceneRadius*.001,n(this.distance,this.targetDistance)),this.orthoScale=Math.max(this.sceneRadius*.001,n(this.orthoScale,this.targetOrthoScale));let c=this.matrix(t,r,a);return[this.focus,this.azimuth,this.polar,this.distance,this.orthoScale]=i,c}moving(){let t=(r,a)=>Math.abs(r-a)<=Math.max(1e-9,Math.abs(a)*1e-4);return!(this.focus.every((r,a)=>t(r,this.targetFocus[a]))&&t(this.azimuth,this.targetAzimuth)&&t(this.polar,this.targetPolar)&&t(this.distance,this.targetDistance)&&t(this.orthoScale,this.targetOrthoScale))}orbit(t,r){let a=Math.sin(this.targetPolar)<0?-1:1;this.targetAzimuth-=a*t*.006,this.targetPolar=al(this.targetPolar-r*.006)}isBelow(){return Math.cos(this.targetPolar)<0}pan(t,r,a,s=!1){let{right:n,up:i}=this.basis(),o=s?this.targetOrthoScale/Math.max(1,a):2*this.targetDistance*Math.tan(this.fov/2)/Math.max(1,a),c=Ne(ve(n,-t*o),ve(i,r*o));this.targetFocus=Ne(this.targetFocus,c)}dolly(t,r=!1){let a=Math.exp(t*.0032);r?this.targetOrthoScale=be(this.targetOrthoScale*a,this.sceneRadius*.008,this.sceneRadius*24):this.targetDistance=be(this.targetDistance*a,this.sceneRadius*.01,this.sceneRadius*48)}frame(t){if(!t)return;let r=Ct(t);this.targetFocus=xi(t),this.targetDistance=Math.max(r*2.8,this.sceneRadius*.02),this.targetOrthoScale=Math.max(r*2.15,this.sceneRadius*.02)}setFocus(t){this.targetFocus=[...t]}setAxis(t,r=!1){t==="z"?(this.targetAzimuth=0,this.targetPolar=r?Math.PI-.015:.015):t==="x"?(this.targetAzimuth=r?-Math.PI/2:Math.PI/2,this.targetPolar=Math.PI/2):(this.targetAzimuth=r?0:Math.PI,this.targetPolar=Math.PI/2)}rotateZ(t=1){this.targetAzimuth+=t*Math.PI/2}flip(){this.targetPolar=al(Math.PI-this.targetPolar)}};function al(e){return Math.atan2(Math.sin(e),Math.cos(e))}function sl(e,t,r){let a=Math.atan2(Math.sin(t-e),Math.cos(t-e));return e+a*r}var hs=class e{static async create(t,r,a={}){let s=await fetch(r,{cache:"default"});if(!s.ok)throw new Error(`Failed to load BoM ${r}: ${s.status}`);let n=await s.json();if(n.schema!=="prism.bom_a0")throw new Error(`Unsupported BoM schema: ${n.schema||"missing"}`);let i=new e(t,n,a);return i.render(),i}constructor(t,r,a){this.container=t,this.payload=r,this.callbacks=a,this.query="",this.selectedRowId="",this.selectedReference="",this.rowsById=new Map((r.rows||[]).map(s=>[s.id,s])),this.componentIndex=new Map(Object.entries(r.componentIndex||{}))}setSelectionByReference(t,r={}){let a=this.componentIndex.get(t);a&&(this.selectedReference=t,this.selectedRowId=a.rowId,this.renderContent(),r.scroll&&this.container.querySelector(`[data-row-id="${Sg(a.rowId)}"]`)?.scrollIntoView({block:"center",behavior:"smooth"}))}clearSelection(){this.selectedReference="",this.selectedRowId="",this.renderContent()}render(){let t=this.filteredRows();this.container.innerHTML=`
      <section class="bom-workspace">
        <header class="bom-toolbar">
          <div>
            <p class="eyebrow">Prism BoM A0</p>
            <h2>Bill of Materials</h2>
            <span data-bom-count>${t.length} of ${(this.payload.rows||[]).length} grouped rows \xB7 ${(this.payload.components||[]).length} components</span>
          </div>
          <label class="bom-search">
            <span>Search</span>
            <input id="bom-search" type="search" value="${Ze(this.query)}" placeholder="Reference, value, footprint, manufacturer..." />
          </label>
        </header>
        <div class="bom-content" data-bom-content>
          ${this.contentHtml(t,this.payload.displayColumns||[])}
        </div>
      </section>
    `,this.bind()}renderContent(){let t=this.container.querySelector("[data-bom-content]");if(!t){this.render();return}let r=this.filteredRows();t.innerHTML=this.contentHtml(r,this.payload.displayColumns||[]);let a=this.container.querySelector("[data-bom-count]");a&&(a.textContent=`${r.length} of ${(this.payload.rows||[]).length} grouped rows \xB7 ${(this.payload.components||[]).length} components`),this.bindContent(t)}contentHtml(t,r){let a=this.rowsById.get(this.selectedRowId);return`
      <div class="bom-table-wrap">
        <table class="bom-table">
          <thead>
            <tr>${r.map(s=>`<th>${Ze(s)}</th>`).join("")}</tr>
          </thead>
          <tbody>
            ${t.map(s=>this.rowHtml(s,r)).join("")}
          </tbody>
        </table>
      </div>
      ${a?`<aside class="bom-detail">${this.detailHtml(a)}</aside>`:""}
    `}filteredRows(){let t=this.query.trim().toLowerCase(),r=this.payload.rows||[];return t?r.filter(a=>JSON.stringify(a).toLowerCase().includes(t)):r}rowHtml(t,r){return`
      <tr class="${t.id===this.selectedRowId?"selected":""}" data-row-id="${Ze(t.id)}">
        ${r.map(s=>{let n=t.fields?.[s]||"";return s==="Reference"?`<td class="bom-reference-cell">${(t.references||[]).map(i=>`
              <button class="bom-ref-chip ${i===this.selectedReference?"active":""}" data-reference="${Ze(i)}">${Ze(i)}</button>
            `).join("")}</td>`:!n&&Eg(s)?'<td><span class="bom-missing">Missing</span></td>':`<td title="${Ze(n)}">${Ze(n)}</td>`}).join("")}
      </tr>
    `}detailHtml(t){let r=kg(t,this.payload.displayColumns||[],this.payload.extraColumns||[]);return`
      <div class="bom-detail-head">
        <p class="eyebrow">Line item</p>
        <h3>${Ze((t.references||[]).join(", "))}</h3>
        <span>${t.qty} component${t.qty===1?"":"s"}${t.dnp?" \xB7 DNP":""}</span>
      </div>
      <div class="bom-ref-list">
        ${(t.references||[]).map(a=>`
          <button class="bom-ref-chip detail ${a===this.selectedReference?"active":""}" data-reference="${Ze(a)}">${Ze(a)}</button>
        `).join("")}
      </div>
      <dl class="bom-field-list">
        ${r.map(([a,s])=>`
          <div>
            <dt>${Ze(a)}</dt>
            <dd>${Ze(s)}</dd>
          </div>
        `).join("")}
      </dl>
    `}bind(){let t=this.container.querySelector("#bom-search");t?.addEventListener("input",()=>{this.query=t.value,this.renderContent()}),this.bindContent(this.container)}bindContent(t){t.querySelectorAll("[data-row-id]").forEach(r=>{r.addEventListener("click",a=>{a.target.closest("[data-reference]")||(this.selectedRowId=r.dataset.rowId,this.selectedReference="",this.renderContent())})}),t.querySelectorAll("[data-reference]").forEach(r=>{r.addEventListener("click",a=>{a.stopPropagation();let s=r.dataset.reference;this.setSelectionByReference(s),this.callbacks.onSelectReference?.(s)})})}};function kg(e,t,r){let a=[],s=new Set(["Reference","Qty"].map(wi));for(let i of t){if(i==="Reference"||i==="Qty")continue;let o=e.fields?.[i]||"";o&&(a.push([i,o]),s.add(wi(i)))}let n=e.canonicalFields||{};for(let i of r){let o=n[i]||"";if(!o)continue;let c=wi(i);s.has(c)||(s.add(c),a.push([i,o]))}return a}function wi(e){return String(e||"").toLowerCase().replace(/[\s_\-()[\]/]+/g,"")}function Eg(e){return["Manufacturer Part Number","Vendor Part Number","Datasheet","Footprint","Value"].includes(e)}function Ze(e){return String(e??"").replace(/[&<>"']/g,t=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[t])}function Sg(e){return String(e).replace(/["\\]/g,"\\$&")}function nl(e,t=new Map){let r=new Map;for(let s of e||[]){let n=String(s?.designator||"");if(!n)continue;let i=r.get(n)||{reference:n,featureIds:new Set,modelCount:0},o=Number(s?.featureId)||0;o>0&&i.featureIds.add(o),r.set(n,i)}for(let[s,n]of t||[]){let i=r.get(String(s));i&&(i.modelCount=Math.max(i.modelCount,Number(n)||0))}let a=new Map;for(let[s,n]of r)a.set(s,{reference:s,featureIds:[...n.featureIds].sort((i,o)=>i-o),ambiguous:n.featureIds.size>1||n.modelCount>1});return a}function il(e,t){let r=[...new Set((Array.isArray(e)?e:[]).map(c=>String(c||"")).filter(Boolean))],a=[],s=[],n=[],i=new Set,o=new Set;for(let c of r){let l=t.get(c);if(!l){n.push(c);continue}if(l.ambiguous){s.push(c);continue}a.push(c),o.add(c);for(let f of l.featureIds)i.add(f)}return{requested:r,applied:a,ambiguous:s,unknown:n,hiddenFeatureIds:i,hiddenReferences:o}}function bs(e,t){return!!e&&t.has(String(e))}var Tg={"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"};function H(e){return String(e??"").replace(/[&<>"']/g,t=>Tg[t])}var sa=`
fn netEmphasized(id: u32) -> bool {
  return id != 0u && id < arrayLength(&netMask) && netMask[id] != 0u;
}
`;function ps(e){let t=new Set;if(e==null)return t;for(let r of e){let a=Number(r);!Number.isInteger(a)||a<=0||a>4294967295||t.add(a)}return t}function ol(e,t=0){let r=0;for(let s of ps(e))r=Math.max(r,s);let a=64;for(;a<r+1;)a*=2;return Math.max(a,Math.floor(t)||0)}function cl(e,t){let r=Math.max(64,Math.floor(t)||0),a=new Uint32Array(r);a.fill(0);for(let s of ps(e))s<r&&(a[s]=1);return a}function or(e,t){return!Array.isArray(e)||!t?null:e.find(r=>r.name===t||Array.isArray(r.aliases)&&r.aliases.includes(t))||null}function ll(e,t){let r=new Set;if(!Array.isArray(e)||!Array.isArray(t))return r;for(let a of t){if(!a)continue;let s=a.netUid&&e.find(i=>i.uid===a.netUid)||a.netName&&or(e,a.netName),n=Number(s?.id);Number.isInteger(n)&&n>0&&r.add(n)}return r}var vi=Object.freeze([[.08,1,.2],[1,.72,.1],[.2,.75,1],[1,.3,.75],[.65,.45,1],[1,.45,.2],[.3,1,.85],[.95,.95,.3]]),dl=`
// 0: off; 1: the default colour; 0x01RRGGBB: that colour.
fn emphasisOf(occurrence: u32, id: u32) -> u32 {
  if (id == 0u) { return 0u; }
  if (globals.emphasisStride == 0u) { return select(0u, 1u, netEmphasized(id)); }
  if (id >= globals.emphasisStride || occurrence <= globals.occurrenceBase) { return 0u; }
  let slot = (occurrence - 1u - globals.occurrenceBase) * globals.emphasisStride + id;
  if (slot >= arrayLength(&netMask)) { return 0u; }
  return netMask[slot];
}
fn emphasisColor(mark: u32, fallback: vec3f) -> vec3f {
  if ((mark >> 24u) == 0u) { return fallback; }
  return vec3f(f32((mark >> 16u) & 255u), f32((mark >> 8u) & 255u), f32(mark & 255u)) / 255.0;
}
`;function ul(e){let t=null;return Array.isArray(e)&&e.length>=3&&e.slice(0,3).every(r=>Number.isFinite(Number(r)))?t=e.slice(0,3).map(r=>Math.round(Math.min(1,Math.max(0,Number(r)))*255)):typeof e=="string"&&/^#[0-9a-f]{6}$/i.test(e)&&(t=[1,3,5].map(r=>parseInt(e.slice(r,r+2),16))),t?(1<<24|t[0]<<16|t[1]<<8|t[2])>>>0:1}function fl(e){let t=1;for(let a of e)for(let s of a?.keys()||[])t=Math.max(t,s+1);let r=new Uint32Array(Math.max(64,e.length*t));return e.forEach((a,s)=>{for(let[n,i]of a||[])Number.isInteger(n)&&n>0&&(r[s*t+n]=i>>>0)}),{stride:t,data:r}}function Ag(e){return(typeof e.composedPath=="function"?e.composedPath():[])[0]??e.target??null}function hl(e){let t=Ag(e);if(!t||typeof t!="object")return!1;let r=typeof t.tagName=="string"?t.tagName.toUpperCase():"";return r==="INPUT"||r==="TEXTAREA"||r==="SELECT"||t.isContentEditable===!0}function bl(e){return!!(e.metaKey||e.ctrlKey)}var _g=4;function pl(e,t=_g){let r=new Map,a=[];for(let n of e){if(n.placements.length<t){for(let o of n.placements)a.push(Ig(n.primitive,o));continue}let i=`${n.placements.map(o=>o.node).join(",")}|${JSON.stringify(n.primitive.material)}`;r.has(i)||r.set(i,[]),r.get(i).push(n)}return{instanced:[...r.values()].map(n=>({primitive:Rg(n.map(i=>i.primitive)),placements:n[0].placements})),baked:ea(a)}}function Ig(e,t){let{rows:r,featureId:a,bounds:s}=t,n=e.position.length/3,i=new Float32Array(n*3),o=new Float32Array(n*3),c=new Uint32Array(n);for(let l=0;l<n;l+=1){let f=l*3,[d,p,b]=[e.position[f],e.position[f+1],e.position[f+2]],[h,u,m]=[e.normal[f],e.normal[f+1],e.normal[f+2]],g=0;for(let y=0;y<3;y+=1){let x=y*4;i[f+y]=r[x]*d+r[x+1]*p+r[x+2]*b+r[x+3],o[f+y]=r[x]*h+r[x+1]*u+r[x+2]*m,g+=o[f+y]**2}g=Math.sqrt(g)||1;for(let y=0;y<3;y+=1)o[f+y]/=g;c[l]=e.objectFeatureId[l]||a||0}return{position:i,normal:o,netId:e.netId,objectFeatureId:c,indices:e.indices,material:e.material,bounds:[...s]}}function Rg(e){if(e.length===1)return e[0];let t=e.reduce((d,p)=>d+p.position.length/3,0),r=e.reduce((d,p)=>d+p.indices.length,0),a=new Float32Array(t*3),s=new Float32Array(t*3),n=new Uint32Array(t),i=new Uint32Array(t),o=new Uint32Array(r),c=[1/0,1/0,1/0,-1/0,-1/0,-1/0],l=0,f=0;for(let d of e){a.set(d.position,l*3),s.set(d.normal,l*3),n.set(d.netId,l),i.set(d.objectFeatureId,l);for(let p=0;p<d.indices.length;p+=1)o[f+p]=d.indices[p]+l;for(let p=0;p<3;p+=1)c[p]=Math.min(c[p],d.bounds[p]),c[p+3]=Math.max(c[p+3],d.bounds[p+3]);l+=d.position.length/3,f+=d.indices.length}return{position:a,normal:s,netId:n,objectFeatureId:i,indices:o,material:e[0].material,bounds:c}}var gl=class{_listeners={};addEventListener(e,t){let r=this._listeners;return r[e]===void 0&&(r[e]=[]),r[e].indexOf(t)===-1&&r[e].push(t),this}removeEventListener(e,t){let r=this._listeners[e];if(r!==void 0){let a=r.indexOf(t);a!==-1&&r.splice(a,1)}return this}dispatchEvent(e){let t=this._listeners[e.type];if(t!==void 0){let r=t.slice(0);for(let a=0,s=r.length;a<s;a++)r[a].call(this,e)}return this}dispose(){for(let e in this._listeners)delete this._listeners[e]}},Ot=class{_disposed=!1;_name;_parent;_child;_attributes;constructor(e,t,r,a={}){if(this._name=e,this._parent=t,this._child=r,this._attributes=a,!t.isOnGraph(r))throw new Error("Cannot connect disconnected graphs.")}getName(){return this._name}getParent(){return this._parent}getChild(){return this._child}setChild(e){return this._child=e,this}getAttributes(){return this._attributes}dispose(){this._disposed||(this._parent._destroyRef(this),this._disposed=!0)}isDisposed(){return this._disposed}},Mi=class extends gl{_emptySet=new Set;_edges=new Set;_parentEdges=new Map;_childEdges=new Map;listEdges(){return Array.from(this._edges)}listParentEdges(e){return Array.from(this._childEdges.get(e)||this._emptySet)}listParents(e){let t=new Set;for(let r of this.listParentEdges(e))t.add(r.getParent());return Array.from(t)}listChildEdges(e){return Array.from(this._parentEdges.get(e)||this._emptySet)}listChildren(e){let t=new Set;for(let r of this.listChildEdges(e))t.add(r.getChild());return Array.from(t)}disconnectParents(e,t){for(let r of this.listParentEdges(e))(!t||t(r.getParent()))&&r.dispose();return this}_createEdge(e,t,r,a){let s=new Ot(e,t,r,a);this._edges.add(s);let n=s.getParent();this._parentEdges.has(n)||this._parentEdges.set(n,new Set),this._parentEdges.get(n).add(s);let i=s.getChild();return this._childEdges.has(i)||this._childEdges.set(i,new Set),this._childEdges.get(i).add(s),s}_destroyEdge(e){return this._edges.delete(e),this._parentEdges.get(e.getParent()).delete(e),this._childEdges.get(e.getChild()).delete(e),this}},Ce=class{list=[];constructor(e){if(e)for(let t of e)this.list.push(t)}add(e){this.list.push(e)}remove(e){let t=this.list.indexOf(e);t>=0&&this.list.splice(t,1)}removeChild(e){let t=[];for(let r of this.list)r.getChild()===e&&t.push(r);for(let r of t)this.remove(r);return t}listRefsByChild(e){let t=[];for(let r of this.list)r.getChild()===e&&t.push(r);return t}values(){return this.list}},le=class{set=new Set;map=new Map;constructor(e){if(e)for(let t of e)this.add(t)}add(e){let t=e.getChild();this.removeChild(t),this.set.add(e),this.map.set(t,e)}remove(e){this.set.delete(e),this.map.delete(e.getChild())}removeChild(e){let t=this.map.get(e)||null;return t&&this.remove(t),t}getRefByChild(e){return this.map.get(e)||null}values(){return Array.from(this.set)}},Me=class{map={};constructor(e){e&&Object.assign(this.map,e)}set(e,t){this.map[e]=t}delete(e){delete this.map[e]}get(e){return this.map[e]||null}keys(){return Object.keys(this.map)}values(){return Object.values(this.map)}},ae=Symbol("attributes"),Bt=Symbol("immutableKeys"),ml=class yl extends gl{_disposed=!1;graph;[ae];[Bt];constructor(t){super(),this.graph=t,this[Bt]=new Set,this[ae]=this._createAttributes()}getDefaults(){return{}}_createAttributes(){let t=this.getDefaults(),r={};for(let a in t){let s=t[a];if(s instanceof yl){let n=this.graph._createEdge(a,this,s);this[Bt].add(a),r[a]=n}else r[a]=s}return r}isOnGraph(t){return this.graph===t.graph}isDisposed(){return this._disposed}dispose(){this._disposed||(this.graph.listChildEdges(this).forEach(t=>t.dispose()),this.graph.disconnectParents(this),this._disposed=!0,this.dispatchEvent({type:"dispose"}))}detach(){return this.graph.disconnectParents(this),this}swap(t,r){for(let a in this[ae]){let s=this[ae][a];if(s instanceof Ot){let n=s;n.getChild()===t&&this.setRef(a,r,n.getAttributes())}else if(s instanceof Ce)for(let n of s.listRefsByChild(t)){let i=n.getAttributes();this.removeRef(a,t),this.addRef(a,r,i)}else if(s instanceof le){let n=s.getRefByChild(t);if(n){let i=n.getAttributes();this.removeRef(a,t),this.addRef(a,r,i)}}else if(s instanceof Me)for(let n of s.keys()){let i=s.get(n);i.getChild()===t&&this.setRefMap(a,n,r,i.getAttributes())}}return this}get(t){return this[ae][t]}set(t,r){return this[ae][t]=r,this.dispatchEvent({type:"change",attribute:t})}getRef(t){let r=this[ae][t];return r?r.getChild():null}setRef(t,r,a){if(this[Bt].has(t))throw new Error(`Cannot overwrite immutable attribute, "${t}".`);let s=this[ae][t];if(s&&s.dispose(),!r)return this;let n=this.graph._createEdge(t,this,r,a);return this[ae][t]=n,this.dispatchEvent({type:"change",attribute:t})}listRefs(t){return this.assertRefList(t).values().map(r=>r.getChild())}addRef(t,r,a){let s=this.graph._createEdge(t,this,r,a);return this.assertRefList(t).add(s),this.dispatchEvent({type:"change",attribute:t})}removeRef(t,r){let a=this.assertRefList(t);if(a instanceof Ce)for(let s of a.listRefsByChild(r))s.dispose();else{let s=a.getRefByChild(r);s&&s.dispose()}return this}assertRefList(t){let r=this[ae][t];if(r instanceof Ce||r instanceof le)return r;throw new Error(`Expected RefList or RefSet for attribute "${t}"`)}listRefMapKeys(t){return this.assertRefMap(t).keys()}listRefMapValues(t){return this.assertRefMap(t).values().map(r=>r.getChild())}getRefMap(t,r){let a=this.assertRefMap(t).get(r);return a?a.getChild():null}setRefMap(t,r,a,s){let n=this.assertRefMap(t),i=n.get(r);if(i&&i.dispose(),!a)return this;s=Object.assign(s||{},{key:r});let o=this.graph._createEdge(t,this,a,{...s,key:r});return n.set(r,o),this.dispatchEvent({type:"change",attribute:t,key:r})}assertRefMap(t){let r=this[ae][t];if(r instanceof Me)return r;throw new Error(`Expected RefMap for attribute "${t}"`)}dispatchEvent(t){return super.dispatchEvent({...t,target:this}),this.graph.dispatchEvent({...t,target:this,type:`node:${t.type}`}),this}_destroyRef(t){let r=t.getName();if(this[ae][r]===t)this[ae][r]=null,this[Bt].has(r)&&t.getChild().dispose();else if(this[ae][r]instanceof Ce)this[ae][r].remove(t);else if(this[ae][r]instanceof le)this[ae][r].remove(t);else if(this[ae][r]instanceof Me){let a=this[ae][r];for(let s of a.keys())a.get(s)===t&&a.delete(s)}else return;this.graph._destroyEdge(t),this.dispatchEvent({type:"change",attribute:r})}};var Sl="v4.4.2",Pt="@glb.bin",F=(function(e){return e.ACCESSOR="Accessor",e.ANIMATION="Animation",e.ANIMATION_CHANNEL="AnimationChannel",e.ANIMATION_SAMPLER="AnimationSampler",e.BUFFER="Buffer",e.CAMERA="Camera",e.MATERIAL="Material",e.MESH="Mesh",e.PRIMITIVE="Primitive",e.PRIMITIVE_TARGET="PrimitiveTarget",e.NODE="Node",e.ROOT="Root",e.SCENE="Scene",e.SKIN="Skin",e.TEXTURE="Texture",e.TEXTURE_INFO="TextureInfo",e})({});var Ng=(function(e){return e.ARRAY_BUFFER="ARRAY_BUFFER",e.ELEMENT_ARRAY_BUFFER="ELEMENT_ARRAY_BUFFER",e.INVERSE_BIND_MATRICES="INVERSE_BIND_MATRICES",e.OTHER="OTHER",e.SPARSE="SPARSE",e})({}),ot=(function(e){return e[e.R=4096]="R",e[e.G=256]="G",e[e.B=16]="B",e[e.A=1]="A",e})({});var Cg=class extends Float32Array{constructor(){throw super(),new Error("Unsupported typed array instantiation.")}},ks={5120:Int8Array,5121:Uint8Array,5122:Int16Array,5123:Uint16Array,5125:Uint32Array,5131:typeof Float16Array<"u"?Float16Array:Cg,5126:Float32Array,5130:Float64Array},X=class{static createBufferFromDataURI(e){if(typeof Buffer>"u"){let t=atob(e.split(",")[1]),r=new Uint8Array(t.length);for(let a=0;a<t.length;a++)r[a]=t.charCodeAt(a);return r}else{let t=e.split(",")[1],r=e.indexOf("base64")>=0;return Buffer.from(t,r?"base64":"utf8")}}static encodeText(e){return new TextEncoder().encode(e)}static decodeText(e){return new TextDecoder().decode(e)}static concat(e){let t=0;for(let s of e)t+=s.byteLength;let r=new Uint8Array(t),a=0;for(let s of e)r.set(s,a),a+=s.byteLength;return r}static pad(e,t=0){let r=this.padNumber(e.byteLength);if(r===e.byteLength)return e;let a=new Uint8Array(r);if(a.set(e),t!==0)for(let s=e.byteLength;s<r;s++)a[s]=t;return a}static padNumber(e){return Math.ceil(e/4)*4}static equals(e,t){if(e===t)return!0;if(e.byteLength!==t.byteLength)return!1;let r=e.byteLength;for(;r--;)if(e[r]!==t[r])return!1;return!0}static toView(e,t=0,r=1/0){return new Uint8Array(e.buffer,e.byteOffset+t,Math.min(e.byteLength,r))}static assertView(e){if(e&&!ArrayBuffer.isView(e))throw new Error(`Method requires Uint8Array parameter; received "${typeof e}".`);return e}};var Bg=class{match(e){return e.length>=3&&e[0]===255&&e[1]===216&&e[2]===255}getSize(e){let t=new DataView(e.buffer,e.byteOffset+4),r,a;for(;t.byteLength;){if(r=t.getUint16(0,!1),Fg(t,r),a=t.getUint8(r+1),a===192||a===193||a===194)return[t.getUint16(r+7,!1),t.getUint16(r+5,!1)];t=new DataView(e.buffer,t.byteOffset+r+2)}throw new TypeError("Invalid JPG, no size found")}getChannels(e){return 3}},Og=class Tl{static PNG_FRIED_CHUNK_NAME="CgBI";match(t){return t.length>=8&&t[0]===137&&t[1]===80&&t[2]===78&&t[3]===71&&t[4]===13&&t[5]===10&&t[6]===26&&t[7]===10}getSize(t){let r=new DataView(t.buffer,t.byteOffset);return X.decodeText(t.slice(12,16))===Tl.PNG_FRIED_CHUNK_NAME?[r.getUint32(32,!1),r.getUint32(36,!1)]:[r.getUint32(16,!1),r.getUint32(20,!1)]}getChannels(t){return 4}},ht=class{static impls={"image/jpeg":new Bg,"image/png":new Og};static registerFormat(e,t){this.impls[e]=t}static getMimeType(e){for(let t in this.impls)if(this.impls[t].match(e))return t;return null}static getSize(e,t){return this.impls[t]?this.impls[t].getSize(e):null}static getChannels(e,t){return this.impls[t]?this.impls[t].getChannels(e):null}static getVRAMByteLength(e,t){if(!this.impls[t])return null;if(this.impls[t].getVRAMByteLength)return this.impls[t].getVRAMByteLength(e);let r=0,a=4,s=this.getSize(e,t);if(!s)return null;for(;s[0]>1||s[1]>1;)r+=s[0]*s[1]*a,s[0]=Math.max(Math.floor(s[0]/2),1),s[1]=Math.max(Math.floor(s[1]/2),1);return r+=1*a,r}static mimeTypeToExtension(e){return e==="image/jpeg"?"jpg":e.split("/").pop()}static extensionToMimeType(e){return e==="jpg"?"image/jpeg":e?`image/${e}`:""}};function Fg(e,t){if(t>e.byteLength)throw new TypeError("Corrupt JPG, exceeded buffer limits");if(e.getUint8(t)!==255)throw new TypeError("Invalid JPG, marker table corrupted");return e}var Ar=class{static basename(e){let t=e.split(/[\\/]/).pop();return t.substring(0,t.lastIndexOf("."))}static extension(e){if(e.startsWith("data:image/")){let t=e.match(/data:(image\/\w+)/)[1];return ht.mimeTypeToExtension(t)}else{if(e.startsWith("data:model/gltf+json"))return"gltf";if(e.startsWith("data:model/gltf-binary"))return"glb";if(e.startsWith("data:application/"))return"bin"}return e.split(/[\\/]/).pop().split(/[.]/).pop()}},Si=typeof Float32Array<"u"?Float32Array:Array;Math.PI/180;180/Math.PI;function Pg(){var e=new Si(3);return Si!=Float32Array&&(e[0]=0,e[1]=0,e[2]=0),e}function ki(e){var t=e[0],r=e[1],a=e[2];return Math.sqrt(t*t+r*r+a*a)}function jg(e,t,r){var a=t[0],s=t[1],n=t[2],i=r[3]*a+r[7]*s+r[11]*n+r[15];return i=i||1,e[0]=(r[0]*a+r[4]*s+r[8]*n+r[12])/i,e[1]=(r[1]*a+r[5]*s+r[9]*n+r[13])/i,e[2]=(r[2]*a+r[6]*s+r[10]*n+r[14])/i,e}(function(){var e=Pg();return function(t,r,a,s,n,i){var o,c;for(r||(r=3),a||(a=0),s?c=Math.min(s*r+a,t.length):c=t.length,o=a;o<c;o+=r)e[0]=t[o],e[1]=t[o+1],e[2]=t[o+2],n(e,e,i),t[o]=e[0],t[o+1]=e[1],t[o+2]=e[2];return t}})();function Al(e){let t=_l(),r=e.propertyType==="Node"?[e]:e.listChildren();for(let a of r)a.traverse(s=>{let n=s.getMesh();if(!n)return;let i=Lg(n,s.getWorldMatrix());i.min.every(isFinite)&&i.max.every(isFinite)&&(Ti(i.min,t),Ti(i.max,t))});return t}function Lg(e,t){let r=_l();for(let a of e.listPrimitives()){let s=a.getAttribute("POSITION"),n=a.getIndices();if(!s)continue;let i=[0,0,0],o=[0,0,0];for(let c=0,l=n?n.getCount():s.getCount();c<l;c++){let f=n?n.getScalar(c):c;i=s.getElement(f,i),o=jg(o,i,t),Ti(o,r)}}return r}function Ti(e,t){for(let r=0;r<3;r++)t.min[r]=Math.min(e[r],t.min[r]),t.max[r]=Math.max(e[r],t.max[r])}function _l(){return{min:[1/0,1/0,1/0],max:[-1/0,-1/0,-1/0]}}var xl="https://null.example",Ei=class{static DEFAULT_INIT={};static PROTOCOL_REGEXP=/^[a-zA-Z]+:\/\//;static dirname(e){let t=e.lastIndexOf("/");return t===-1?"./":e.substring(0,t+1)}static basename(e){return Ar.basename(new URL(e,xl).pathname)}static extension(e){return Ar.extension(new URL(e,xl).pathname)}static resolve(e,t){if(!this.isRelativePath(t))return t;let r=e.split("/"),a=t.split("/");r.pop();for(let s=0;s<a.length;s++)a[s]!=="."&&(a[s]===".."?r.pop():r.push(a[s]));return r.join("/")}static isAbsoluteURL(e){return this.PROTOCOL_REGEXP.test(e)}static isRelativePath(e){return!/^(?:[a-zA-Z]+:)?\//.test(e)}};function wl(e){return Object.prototype.toString.call(e)==="[object Object]"}function cr(e){if(wl(e)===!1)return!1;let t=e.constructor;if(t===void 0)return!0;let r=t.prototype;return!(wl(r)===!1||Object.hasOwn(r,"isPrototypeOf")===!1)}var Dg=(function(e){return e[e.SILENT=4]="SILENT",e[e.ERROR=3]="ERROR",e[e.WARN=2]="WARN",e[e.INFO=1]="INFO",e[e.DEBUG=0]="DEBUG",e})({}),Es=class Il{verbosity;static Verbosity=Dg;static DEFAULT_INSTANCE=new Il(1);constructor(t){this.verbosity=t}debug(t){this.verbosity<=0&&console.debug(t)}info(t){this.verbosity<=1&&console.info(t)}warn(t){this.verbosity<=2&&console.warn(t)}error(t){this.verbosity<=3&&console.error(t)}};function Ug(e){var t=e[0],r=e[1],a=e[2],s=e[3],n=e[4],i=e[5],o=e[6],c=e[7],l=e[8],f=e[9],d=e[10],p=e[11],b=e[12],h=e[13],u=e[14],m=e[15],g=t*i-r*n,y=t*o-a*n,x=r*o-a*i,v=l*h-f*b,E=l*u-d*b,S=f*u-d*h,T=t*S-r*E+a*v,_=n*S-i*E+o*v,I=l*x-f*y+d*g,N=b*x-h*y+u*g;return c*T-s*_+m*I-p*N}function Gg(e,t,r){var a=t[0],s=t[1],n=t[2],i=t[3],o=t[4],c=t[5],l=t[6],f=t[7],d=t[8],p=t[9],b=t[10],h=t[11],u=t[12],m=t[13],g=t[14],y=t[15],x=r[0],v=r[1],E=r[2],S=r[3];return e[0]=x*a+v*o+E*d+S*u,e[1]=x*s+v*c+E*p+S*m,e[2]=x*n+v*l+E*b+S*g,e[3]=x*i+v*f+E*h+S*y,x=r[4],v=r[5],E=r[6],S=r[7],e[4]=x*a+v*o+E*d+S*u,e[5]=x*s+v*c+E*p+S*m,e[6]=x*n+v*l+E*b+S*g,e[7]=x*i+v*f+E*h+S*y,x=r[8],v=r[9],E=r[10],S=r[11],e[8]=x*a+v*o+E*d+S*u,e[9]=x*s+v*c+E*p+S*m,e[10]=x*n+v*l+E*b+S*g,e[11]=x*i+v*f+E*h+S*y,x=r[12],v=r[13],E=r[14],S=r[15],e[12]=x*a+v*o+E*d+S*u,e[13]=x*s+v*c+E*p+S*m,e[14]=x*n+v*l+E*b+S*g,e[15]=x*i+v*f+E*h+S*y,e}function zg(e,t){var r=t[0],a=t[1],s=t[2],n=t[4],i=t[5],o=t[6],c=t[8],l=t[9],f=t[10];return e[0]=Math.sqrt(r*r+a*a+s*s),e[1]=Math.sqrt(n*n+i*i+o*o),e[2]=Math.sqrt(c*c+l*l+f*f),e}function Kg(e,t){var r=new Si(3);zg(r,t);var a=1/r[0],s=1/r[1],n=1/r[2],i=t[0]*a,o=t[1]*s,c=t[2]*n,l=t[4]*a,f=t[5]*s,d=t[6]*n,p=t[8]*a,b=t[9]*s,h=t[10]*n,u=i+f+h,m=0;return u>0?(m=Math.sqrt(u+1)*2,e[3]=.25*m,e[0]=(d-b)/m,e[1]=(p-c)/m,e[2]=(o-l)/m):i>f&&i>h?(m=Math.sqrt(1+i-f-h)*2,e[3]=(d-b)/m,e[0]=.25*m,e[1]=(o+l)/m,e[2]=(p+c)/m):f>h?(m=Math.sqrt(1+f-i-h)*2,e[3]=(p-c)/m,e[0]=(o+l)/m,e[1]=.25*m,e[2]=(d+b)/m):(m=Math.sqrt(1+h-i-f)*2,e[3]=(o-l)/m,e[0]=(p+c)/m,e[1]=(d+b)/m,e[2]=.25*m),e}var pe=class na{static identity(t){return t}static eq(t,r,a=1e-5){if(t.length!==r.length)return!1;for(let s=0;s<t.length;s++)if(Math.abs(t[s]-r[s])>a)return!1;return!0}static clamp(t,r,a){return t<r?r:t>a?a:t}static decodeNormalizedInt(t,r){switch(r){case 5126:return t;case 5123:return t/65535;case 5121:return t/255;case 5122:return Math.max(t/32767,-1);case 5120:return Math.max(t/127,-1);default:throw new Error("Invalid component type.")}}static encodeNormalizedInt(t,r){switch(r){case 5126:return t;case 5123:return Math.round(na.clamp(t,0,1)*65535);case 5121:return Math.round(na.clamp(t,0,1)*255);case 5122:return Math.round(na.clamp(t,-1,1)*32767);case 5120:return Math.round(na.clamp(t,-1,1)*127);default:throw new Error("Invalid component type.")}}static decompose(t,r,a,s){let n=ki([t[0],t[1],t[2]]),i=ki([t[4],t[5],t[6]]),o=ki([t[8],t[9],t[10]]);Ug(t)<0&&(n=-n),r[0]=t[12],r[1]=t[13],r[2]=t[14];let c=t.slice(),l=1/n,f=1/i,d=1/o;c[0]*=l,c[1]*=l,c[2]*=l,c[4]*=f,c[5]*=f,c[6]*=f,c[8]*=d,c[9]*=d,c[10]*=d,Kg(a,c),s[0]=n,s[1]=i,s[2]=o}static compose(t,r,a,s){let n=s,i=r[0],o=r[1],c=r[2],l=r[3],f=i+i,d=o+o,p=c+c,b=i*f,h=i*d,u=i*p,m=o*d,g=o*p,y=c*p,x=l*f,v=l*d,E=l*p,S=a[0],T=a[1],_=a[2];return n[0]=(1-(m+y))*S,n[1]=(h+E)*S,n[2]=(u-v)*S,n[3]=0,n[4]=(h-E)*T,n[5]=(1-(b+y))*T,n[6]=(g+x)*T,n[7]=0,n[8]=(u+v)*_,n[9]=(g-x)*_,n[10]=(1-(b+m))*_,n[11]=0,n[12]=t[0],n[13]=t[1],n[14]=t[2],n[15]=1,n}};function Vg(e,t){if(!!e!=!!t)return!1;let r=e.getChild(),a=t.getChild();return r===a||r.equals(a)}function Hg(e,t){if(!!e!=!!t)return!1;let r=e.values(),a=t.values();if(r.length!==a.length)return!1;for(let s=0;s<r.length;s++){let n=r[s],i=a[s];if(n.getChild()!==i.getChild()&&!n.getChild().equals(i.getChild()))return!1}return!0}function qg(e,t){if(!!e!=!!t)return!1;let r=e.keys(),a=t.keys();if(r.length!==a.length)return!1;for(let s of r){let n=e.get(s),i=t.get(s);if(!!n!=!!i)return!1;let o=n.getChild(),c=i.getChild();if(o!==c&&!o.equals(c))return!1}return!0}function Rl(e,t){if(e===t)return!0;if(!!e!=!!t||!e||!t||e.length!==t.length)return!1;for(let r=0;r<e.length;r++)if(e[r]!==t[r])return!1;return!0}function Nl(e,t){if(e===t)return!0;if(!!e!=!!t)return!1;if(!cr(e)||!cr(t))return e===t;let r=e,a=t,s=0,n=0,i;for(i in r)s++;for(i in a)n++;if(s!==n)return!1;for(i in r){let o=r[i],c=a[i];if(vs(o)&&vs(c)){if(!Rl(o,c))return!1}else if(cr(o)&&cr(c)){if(!Nl(o,c))return!1}else if(o!==c)return!1}return!0}function vs(e){return Array.isArray(e)||ArrayBuffer.isView(e)}var Wg="23456789abdegjkmnpqrvwxyzABDEGJKMNPQRVWXYZ",Xg=999,$g=6,vl=new Set,Yg=function(){let e="";for(let t=0;t<$g;t++)e+=Wg.charAt(Math.floor(Math.random()*42));return e},Jg=function(){for(let e=0;e<Xg;e++){let t=Yg();if(!vl.has(t))return vl.add(t),t}return""},jt=e=>e,Qg=new Set,Ii=class extends ml{constructor(e,t=""){super(e),this[ae].name=t,this.init(),this.dispatchEvent({type:"create"})}getGraph(){return this.graph}getDefaults(){return Object.assign(super.getDefaults(),{name:"",extras:{}})}set(e,t){return Array.isArray(t)&&(t=t.slice()),super.set(e,t)}getName(){return this.get("name")}setName(e){return this.set("name",e)}getExtras(){return this.get("extras")}setExtras(e){return this.set("extras",e)}clone(){let e=this.constructor;return new e(this.graph).copy(this,jt)}copy(e,t=jt){for(let r in this[ae]){let a=this[ae][r];if(a instanceof Ot)this[Bt].has(r)||a.dispose();else if(a instanceof Ce||a instanceof le)for(let s of a.values())s.dispose();else if(a instanceof Me)for(let s of a.values())s.dispose()}for(let r in e[ae]){let a=this[ae][r],s=e[ae][r];if(s instanceof Ot)this[Bt].has(r)?a.getChild().copy(t(s.getChild()),t):this.setRef(r,t(s.getChild()),s.getAttributes());else if(s instanceof le||s instanceof Ce)for(let n of s.values())this.addRef(r,t(n.getChild()),n.getAttributes());else if(s instanceof Me)for(let n of s.keys()){let i=s.get(n);this.setRefMap(r,n,t(i.getChild()),i.getAttributes())}else cr(s)?this[ae][r]=JSON.parse(JSON.stringify(s)):Array.isArray(s)||s instanceof ArrayBuffer||ArrayBuffer.isView(s)?this[ae][r]=s.slice():this[ae][r]=s}return this}equals(e,t=Qg){if(this===e)return!0;if(this.propertyType!==e.propertyType)return!1;for(let r in this[ae]){if(t.has(r))continue;let a=this[ae][r],s=e[ae][r];if(a instanceof Ot||s instanceof Ot){if(!Vg(a,s))return!1}else if(a instanceof le||s instanceof le||a instanceof Ce||s instanceof Ce){if(!Hg(a,s))return!1}else if(a instanceof Me||s instanceof Me){if(!qg(a,s))return!1}else if(cr(a)||cr(s)){if(!Nl(a,s))return!1}else if(vs(a)||vs(s)){if(!Rl(a,s))return!1}else if(a!==s)return!1}return!0}detach(){return this.graph.disconnectParents(this,e=>e.propertyType!=="Root"),this}listParents(){return this.graph.listParents(this)}},Le=class extends Ii{getDefaults(){return Object.assign(super.getDefaults(),{extensions:new Me})}getExtension(e){return this.getRefMap("extensions",e)}setExtension(e,t){return t&&t._validateParent(this),this.setRefMap("extensions",e,t)}listExtensions(){return this.listRefMapValues("extensions")}},V=class ke extends Le{static Type={SCALAR:"SCALAR",VEC2:"VEC2",VEC3:"VEC3",VEC4:"VEC4",MAT2:"MAT2",MAT3:"MAT3",MAT4:"MAT4"};static ComponentType={BYTE:5120,UNSIGNED_BYTE:5121,SHORT:5122,UNSIGNED_SHORT:5123,UNSIGNED_INT:5125,FLOAT:5126,FLOAT16:5131,FLOAT64:5130};init(){this.propertyType="Accessor"}getDefaults(){return Object.assign(super.getDefaults(),{array:null,type:ke.Type.SCALAR,componentType:ke.ComponentType.FLOAT,normalized:!1,sparse:!1,buffer:null})}static getElementSize(t){switch(t){case ke.Type.SCALAR:return 1;case ke.Type.VEC2:return 2;case ke.Type.VEC3:return 3;case ke.Type.VEC4:return 4;case ke.Type.MAT2:return 4;case ke.Type.MAT3:return 9;case ke.Type.MAT4:return 16;default:throw new Error("Unexpected type: "+t)}}static getComponentSize(t){switch(t){case ke.ComponentType.BYTE:case ke.ComponentType.UNSIGNED_BYTE:return 1;case ke.ComponentType.SHORT:case ke.ComponentType.UNSIGNED_SHORT:return 2;case ke.ComponentType.UNSIGNED_INT:case ke.ComponentType.FLOAT:return 4;case ke.ComponentType.FLOAT16:return 2;case ke.ComponentType.FLOAT64:return 8;default:throw new Error("Unexpected component type: "+t)}}getMinNormalized(t){let r=this.getNormalized(),a=this.getElementSize(),s=this.getComponentType();if(this.getMin(t),r)for(let n=0;n<a;n++)t[n]=pe.decodeNormalizedInt(t[n],s);return t}getMin(t){let r=this.getArray(),a=this.getCount(),s=this.getElementSize();for(let n=0;n<s;n++)t[n]=1/0;for(let n=0;n<a*s;n+=s)for(let i=0;i<s;i++){let o=r[n+i];Number.isFinite(o)&&(t[i]=Math.min(t[i],o))}return t}getMaxNormalized(t){let r=this.getNormalized(),a=this.getElementSize(),s=this.getComponentType();if(this.getMax(t),r)for(let n=0;n<a;n++)t[n]=pe.decodeNormalizedInt(t[n],s);return t}getMax(t){let r=this.get("array"),a=this.getCount(),s=this.getElementSize();for(let n=0;n<s;n++)t[n]=-1/0;for(let n=0;n<a*s;n+=s)for(let i=0;i<s;i++){let o=r[n+i];Number.isFinite(o)&&(t[i]=Math.max(t[i],o))}return t}getCount(){let t=this.get("array");return t?t.length/this.getElementSize():0}getType(){return this.get("type")}setType(t){return this.set("type",t)}getElementSize(){return ke.getElementSize(this.get("type"))}getComponentSize(){return this.get("array").BYTES_PER_ELEMENT}getComponentType(){return this.get("componentType")}getNormalized(){return this.get("normalized")}setNormalized(t){return this.set("normalized",t)}getScalar(t){let r=this.getElementSize(),a=this.getComponentType(),s=this.getArray();return this.getNormalized()?pe.decodeNormalizedInt(s[t*r],a):s[t*r]}setScalar(t,r){let a=this.getElementSize(),s=this.getComponentType(),n=this.getArray();return this.getNormalized()?n[t*a]=pe.encodeNormalizedInt(r,s):n[t*a]=r,this}getElement(t,r){let a=this.getNormalized(),s=this.getElementSize(),n=this.getComponentType(),i=this.getArray();for(let o=0;o<s;o++)a?r[o]=pe.decodeNormalizedInt(i[t*s+o],n):r[o]=i[t*s+o];return r}setElement(t,r){let a=this.getNormalized(),s=this.getElementSize(),n=this.getComponentType(),i=this.getArray();for(let o=0;o<s;o++)a?i[t*s+o]=pe.encodeNormalizedInt(r[o],n):i[t*s+o]=r[o];return this}getSparse(){return this.get("sparse")}setSparse(t){return this.set("sparse",t)}getBuffer(){return this.getRef("buffer")}setBuffer(t){return this.setRef("buffer",t)}getArray(){return this.get("array")}setArray(t){return this.set("componentType",t?Zg(t):ke.ComponentType.FLOAT),this.set("array",t),this}getByteLength(){let t=this.get("array");return t?t.byteLength:0}};function Zg(e){switch(e.constructor){case Float32Array:return V.ComponentType.FLOAT;case Uint32Array:return V.ComponentType.UNSIGNED_INT;case Uint16Array:return V.ComponentType.UNSIGNED_SHORT;case Uint8Array:return V.ComponentType.UNSIGNED_BYTE;case Int16Array:return V.ComponentType.SHORT;case Int8Array:return V.ComponentType.BYTE;case Float64Array:return V.ComponentType.FLOAT64}if(typeof Float16Array<"u"&&e.constructor===Float16Array)return V.ComponentType.FLOAT16;throw new Error("Unknown accessor componentType.")}var Cl=class extends Le{init(){this.propertyType="Animation"}getDefaults(){return Object.assign(super.getDefaults(),{channels:new le,samplers:new le})}addChannel(e){return this.addRef("channels",e)}removeChannel(e){return this.removeRef("channels",e)}listChannels(){return this.listRefs("channels")}addSampler(e){return this.addRef("samplers",e)}removeSampler(e){return this.removeRef("samplers",e)}listSamplers(){return this.listRefs("samplers")}},Ri=class extends Le{static TargetPath={TRANSLATION:"translation",ROTATION:"rotation",SCALE:"scale",WEIGHTS:"weights"};init(){this.propertyType="AnimationChannel"}getDefaults(){return Object.assign(super.getDefaults(),{targetPath:null,targetNode:null,sampler:null})}getTargetPath(){return this.get("targetPath")}setTargetPath(e){return this.set("targetPath",e)}getTargetNode(){return this.getRef("targetNode")}setTargetNode(e){return this.setRef("targetNode",e)}getSampler(){return this.getRef("sampler")}setSampler(e){return this.setRef("sampler",e)}},Ss=class Bl extends Le{static Interpolation={LINEAR:"LINEAR",STEP:"STEP",CUBICSPLINE:"CUBICSPLINE"};init(){this.propertyType="AnimationSampler"}getDefaultAttributes(){return Object.assign(super.getDefaults(),{interpolation:Bl.Interpolation.LINEAR,input:null,output:null})}getInterpolation(){return this.get("interpolation")}setInterpolation(t){return this.set("interpolation",t)}getInput(){return this.getRef("input")}setInput(t){return this.setRef("input",t,{usage:"OTHER"})}getOutput(){return this.getRef("output")}setOutput(t){return this.setRef("output",t,{usage:"OTHER"})}},Ol=class extends Le{init(){this.propertyType="Buffer"}getDefaults(){return Object.assign(super.getDefaults(),{uri:""})}getURI(){return this.get("uri")}setURI(e){return this.set("uri",e)}},Ts=class Fl extends Le{static Type={PERSPECTIVE:"perspective",ORTHOGRAPHIC:"orthographic"};init(){this.propertyType="Camera"}getDefaults(){return Object.assign(super.getDefaults(),{type:Fl.Type.PERSPECTIVE,znear:.1,zfar:100,aspectRatio:null,yfov:Math.PI*2*50/360,xmag:1,ymag:1})}getType(){return this.get("type")}setType(t){return this.set("type",t)}getZNear(){return this.get("znear")}setZNear(t){return this.set("znear",t)}getZFar(){return this.get("zfar")}setZFar(t){return this.set("zfar",t)}getAspectRatio(){return this.get("aspectRatio")}setAspectRatio(t){return this.set("aspectRatio",t)}getYFov(){return this.get("yfov")}setYFov(t){return this.set("yfov",t)}getXMag(){return this.get("xmag")}setXMag(t){return this.set("xmag",t)}getYMag(){return this.get("ymag")}setYMag(t){return this.set("ymag",t)}},J=class extends Ii{static EXTENSION_NAME;_validateParent(e){if(!this.parentTypes.includes(e.propertyType))throw new Error(`Parent "${e.propertyType}" invalid for child "${this.propertyType}".`)}},ue=class Ai extends Le{static WrapMode={CLAMP_TO_EDGE:33071,MIRRORED_REPEAT:33648,REPEAT:10497};static MagFilter={NEAREST:9728,LINEAR:9729};static MinFilter={NEAREST:9728,LINEAR:9729,NEAREST_MIPMAP_NEAREST:9984,LINEAR_MIPMAP_NEAREST:9985,NEAREST_MIPMAP_LINEAR:9986,LINEAR_MIPMAP_LINEAR:9987};init(){this.propertyType="TextureInfo"}getDefaults(){return Object.assign(super.getDefaults(),{texCoord:0,magFilter:null,minFilter:null,wrapS:Ai.WrapMode.REPEAT,wrapT:Ai.WrapMode.REPEAT})}getTexCoord(){return this.get("texCoord")}setTexCoord(t){return this.set("texCoord",t)}getMagFilter(){return this.get("magFilter")}setMagFilter(t){return this.set("magFilter",t)}getMinFilter(){return this.get("minFilter")}setMinFilter(t){return this.set("minFilter",t)}getWrapS(){return this.get("wrapS")}setWrapS(t){return this.set("wrapS",t)}getWrapT(){return this.get("wrapT")}setWrapT(t){return this.set("wrapT",t)}},{R:gs,G:ms,B:ys,A:em}=ot,Ms=class Pl extends Le{static AlphaMode={OPAQUE:"OPAQUE",MASK:"MASK",BLEND:"BLEND"};init(){this.propertyType="Material"}getDefaults(){return Object.assign(super.getDefaults(),{alphaMode:Pl.AlphaMode.OPAQUE,alphaCutoff:.5,doubleSided:!1,baseColorFactor:[1,1,1,1],baseColorTexture:null,baseColorTextureInfo:new ue(this.graph,"baseColorTextureInfo"),emissiveFactor:[0,0,0],emissiveTexture:null,emissiveTextureInfo:new ue(this.graph,"emissiveTextureInfo"),normalScale:1,normalTexture:null,normalTextureInfo:new ue(this.graph,"normalTextureInfo"),occlusionStrength:1,occlusionTexture:null,occlusionTextureInfo:new ue(this.graph,"occlusionTextureInfo"),roughnessFactor:1,metallicFactor:1,metallicRoughnessTexture:null,metallicRoughnessTextureInfo:new ue(this.graph,"metallicRoughnessTextureInfo")})}getDoubleSided(){return this.get("doubleSided")}setDoubleSided(t){return this.set("doubleSided",t)}getAlpha(){return this.get("baseColorFactor")[3]}setAlpha(t){let r=this.get("baseColorFactor").slice();return r[3]=t,this.set("baseColorFactor",r)}getAlphaMode(){return this.get("alphaMode")}setAlphaMode(t){return this.set("alphaMode",t)}getAlphaCutoff(){return this.get("alphaCutoff")}setAlphaCutoff(t){return this.set("alphaCutoff",t)}getBaseColorFactor(){return this.get("baseColorFactor")}setBaseColorFactor(t){return this.set("baseColorFactor",t)}getBaseColorTexture(){return this.getRef("baseColorTexture")}getBaseColorTextureInfo(){return this.getRef("baseColorTexture")?this.getRef("baseColorTextureInfo"):null}setBaseColorTexture(t){return this.setRef("baseColorTexture",t,{channels:gs|ms|ys|em,isColor:!0})}getEmissiveFactor(){return this.get("emissiveFactor")}setEmissiveFactor(t){return this.set("emissiveFactor",t)}getEmissiveTexture(){return this.getRef("emissiveTexture")}getEmissiveTextureInfo(){return this.getRef("emissiveTexture")?this.getRef("emissiveTextureInfo"):null}setEmissiveTexture(t){return this.setRef("emissiveTexture",t,{channels:gs|ms|ys,isColor:!0})}getNormalScale(){return this.get("normalScale")}setNormalScale(t){return this.set("normalScale",t)}getNormalTexture(){return this.getRef("normalTexture")}getNormalTextureInfo(){return this.getRef("normalTexture")?this.getRef("normalTextureInfo"):null}setNormalTexture(t){return this.setRef("normalTexture",t,{channels:gs|ms|ys})}getOcclusionStrength(){return this.get("occlusionStrength")}setOcclusionStrength(t){return this.set("occlusionStrength",t)}getOcclusionTexture(){return this.getRef("occlusionTexture")}getOcclusionTextureInfo(){return this.getRef("occlusionTexture")?this.getRef("occlusionTextureInfo"):null}setOcclusionTexture(t){return this.setRef("occlusionTexture",t,{channels:gs})}getRoughnessFactor(){return this.get("roughnessFactor")}setRoughnessFactor(t){return this.set("roughnessFactor",t)}getMetallicFactor(){return this.get("metallicFactor")}setMetallicFactor(t){return this.set("metallicFactor",t)}getMetallicRoughnessTexture(){return this.getRef("metallicRoughnessTexture")}getMetallicRoughnessTextureInfo(){return this.getRef("metallicRoughnessTexture")?this.getRef("metallicRoughnessTextureInfo"):null}setMetallicRoughnessTexture(t){return this.setRef("metallicRoughnessTexture",t,{channels:ms|ys})}},jl=class extends Le{init(){this.propertyType="Mesh"}getDefaults(){return Object.assign(super.getDefaults(),{weights:[],primitives:new le})}addPrimitive(e){return this.addRef("primitives",e)}removePrimitive(e){return this.removeRef("primitives",e)}listPrimitives(){return this.listRefs("primitives")}getWeights(){return this.get("weights")}setWeights(e){return this.set("weights",e)}},Ll=class extends Le{init(){this.propertyType="Node"}getDefaults(){return Object.assign(super.getDefaults(),{translation:[0,0,0],rotation:[0,0,0,1],scale:[1,1,1],weights:[],camera:null,mesh:null,skin:null,children:new le})}copy(e,t=jt){if(t===jt)throw new Error("Node cannot be copied.");return super.copy(e,t)}getTranslation(){return this.get("translation")}getRotation(){return this.get("rotation")}getScale(){return this.get("scale")}setTranslation(e){return this.set("translation",e)}setRotation(e){return this.set("rotation",e)}setScale(e){return this.set("scale",e)}getMatrix(){return pe.compose(this.get("translation"),this.get("rotation"),this.get("scale"),[])}setMatrix(e){let t=this.get("translation").slice(),r=this.get("rotation").slice(),a=this.get("scale").slice();return pe.decompose(e,t,r,a),this.set("translation",t).set("rotation",r).set("scale",a)}getWorldTranslation(){let e=[0,0,0];return pe.decompose(this.getWorldMatrix(),e,[0,0,0,1],[1,1,1]),e}getWorldRotation(){let e=[0,0,0,1];return pe.decompose(this.getWorldMatrix(),[0,0,0],e,[1,1,1]),e}getWorldScale(){let e=[1,1,1];return pe.decompose(this.getWorldMatrix(),[0,0,0],[0,0,0,1],e),e}getWorldMatrix(){let e=[];for(let a=this;a!=null;a=a.getParentNode())e.push(a);let t,r=e.pop().getMatrix();for(;t=e.pop();)Gg(r,r,t.getMatrix());return r}addChild(e){let t=e.getParentNode();t&&t.removeChild(e);for(let r of e.listParents())r.propertyType==="Scene"&&r.removeChild(e);return this.addRef("children",e)}removeChild(e){return this.removeRef("children",e)}listChildren(){return this.listRefs("children")}getParentNode(){for(let e of this.listParents())if(e.propertyType==="Node")return e;return null}getMesh(){return this.getRef("mesh")}setMesh(e){return this.setRef("mesh",e)}getCamera(){return this.getRef("camera")}setCamera(e){return this.setRef("camera",e)}getSkin(){return this.getRef("skin")}setSkin(e){return this.setRef("skin",e)}getWeights(){return this.get("weights")}setWeights(e){return this.set("weights",e)}traverse(e){e(this);for(let t of this.listChildren())t.traverse(e);return this}},ia=class Dl extends Le{static Mode={POINTS:0,LINES:1,LINE_LOOP:2,LINE_STRIP:3,TRIANGLES:4,TRIANGLE_STRIP:5,TRIANGLE_FAN:6};init(){this.propertyType="Primitive"}getDefaults(){return Object.assign(super.getDefaults(),{mode:Dl.Mode.TRIANGLES,material:null,indices:null,attributes:new Me,targets:new le})}getIndices(){return this.getRef("indices")}setIndices(t){return this.setRef("indices",t,{usage:"ELEMENT_ARRAY_BUFFER"})}getAttribute(t){return this.getRefMap("attributes",t)}setAttribute(t,r){return this.setRefMap("attributes",t,r,{usage:"ARRAY_BUFFER"})}listAttributes(){return this.listRefMapValues("attributes")}listSemantics(){return this.listRefMapKeys("attributes")}getMaterial(){return this.getRef("material")}setMaterial(t){return this.setRef("material",t)}getMode(){return this.get("mode")}setMode(t){return this.set("mode",t)}listTargets(){return this.listRefs("targets")}addTarget(t){return this.addRef("targets",t)}removeTarget(t){return this.removeRef("targets",t)}},tm=class extends Ii{init(){this.propertyType="PrimitiveTarget"}getDefaults(){return Object.assign(super.getDefaults(),{attributes:new Me})}getAttribute(e){return this.getRefMap("attributes",e)}setAttribute(e,t){return this.setRefMap("attributes",e,t,{usage:"ARRAY_BUFFER"})}listAttributes(){return this.listRefMapValues("attributes")}listSemantics(){return this.listRefMapKeys("attributes")}},Ul=class extends Le{init(){this.propertyType="Scene"}getDefaults(){return Object.assign(super.getDefaults(),{children:new le})}copy(e,t=jt){if(t===jt)throw new Error("Scene cannot be copied.");return super.copy(e,t)}addChild(e){let t=e.getParentNode();return t&&t.removeChild(e),this.addRef("children",e)}removeChild(e){return this.removeRef("children",e)}listChildren(){return this.listRefs("children")}traverse(e){for(let t of this.listChildren())t.traverse(e);return this}},Gl=class extends Le{init(){this.propertyType="Skin"}getDefaults(){return Object.assign(super.getDefaults(),{skeleton:null,inverseBindMatrices:null,joints:new le})}getSkeleton(){return this.getRef("skeleton")}setSkeleton(e){return this.setRef("skeleton",e)}getInverseBindMatrices(){return this.getRef("inverseBindMatrices")}setInverseBindMatrices(e){return this.setRef("inverseBindMatrices",e,{usage:"INVERSE_BIND_MATRICES"})}addJoint(e){return this.addRef("joints",e)}removeJoint(e){return this.removeRef("joints",e)}listJoints(){return this.listRefs("joints")}},zl=class extends Le{init(){this.propertyType="Texture"}getDefaults(){return Object.assign(super.getDefaults(),{image:null,mimeType:"",uri:""})}getMimeType(){return this.get("mimeType")||ht.extensionToMimeType(Ar.extension(this.get("uri")))}setMimeType(e){return this.set("mimeType",e)}getURI(){return this.get("uri")}setURI(e){this.set("uri",e);let t=ht.extensionToMimeType(Ar.extension(e));return t&&this.set("mimeType",t),this}getImage(){return this.get("image")}setImage(e){return this.set("image",X.assertView(e))}getSize(){let e=this.get("image");return e?ht.getSize(e,this.getMimeType()):null}},Ni=class extends Le{_extensions=new Set;init(){this.propertyType="Root"}getDefaults(){return Object.assign(super.getDefaults(),{asset:{generator:`glTF-Transform ${Sl}`,version:"2.0"},defaultScene:null,accessors:new le,animations:new le,buffers:new le,cameras:new le,materials:new le,meshes:new le,nodes:new le,scenes:new le,skins:new le,textures:new le})}constructor(e){super(e),e.addEventListener("node:create",t=>{this._addChildOfRoot(t.target)})}clone(){throw new Error("Root cannot be cloned.")}copy(e,t=jt){if(t===jt)throw new Error("Root cannot be copied.");this.set("asset",{...e.get("asset")}),this.setName(e.getName()),this.setExtras({...e.getExtras()}),this.setDefaultScene(e.getDefaultScene()?t(e.getDefaultScene()):null);for(let r of e.listRefMapKeys("extensions")){let a=e.getExtension(r);this.setExtension(r,t(a))}return this}_addChildOfRoot(e){return e instanceof Ul?this.addRef("scenes",e):e instanceof Ll?this.addRef("nodes",e):e instanceof Ts?this.addRef("cameras",e):e instanceof Gl?this.addRef("skins",e):e instanceof jl?this.addRef("meshes",e):e instanceof Ms?this.addRef("materials",e):e instanceof zl?this.addRef("textures",e):e instanceof Cl?this.addRef("animations",e):e instanceof V?this.addRef("accessors",e):e instanceof Ol&&this.addRef("buffers",e),this}getAsset(){return this.get("asset")}listExtensionsUsed(){return Array.from(this._extensions)}listExtensionsRequired(){return this.listExtensionsUsed().filter(e=>e.isRequired())}_enableExtension(e){return this._extensions.add(e),this}_disableExtension(e){return this._extensions.delete(e),this}listScenes(){return this.listRefs("scenes")}setDefaultScene(e){return this.setRef("defaultScene",e)}getDefaultScene(){return this.getRef("defaultScene")}listNodes(){return this.listRefs("nodes")}listCameras(){return this.listRefs("cameras")}listSkins(){return this.listRefs("skins")}listMeshes(){return this.listRefs("meshes")}listMaterials(){return this.listRefs("materials")}listTextures(){return this.listRefs("textures")}listAnimations(){return this.listRefs("animations")}listAccessors(){return this.listRefs("accessors")}listBuffers(){return this.listRefs("buffers")}},rm=class _i{_graph=new Mi;_root=new Ni(this._graph);_logger=Es.DEFAULT_INSTANCE;static _GRAPH_DOCUMENTS=new WeakMap;static fromGraph(t){return _i._GRAPH_DOCUMENTS.get(t)||null}constructor(){_i._GRAPH_DOCUMENTS.set(this._graph,this)}getRoot(){return this._root}getGraph(){return this._graph}getLogger(){return this._logger}setLogger(t){return this._logger=t,this}clone(){throw new Error("Use 'cloneDocument(source)' from '@gltf-transform/functions'.")}merge(t){throw new Error("Use 'mergeDocuments(target, source)' from '@gltf-transform/functions'.")}async transform(...t){let r=t.map(a=>a.name);for(let a of t)await a(this,{stack:r});return this}hasExtension(t){return this.getRoot().listExtensionsUsed().some(r=>r.extensionName===t)}createExtension(t){let r=t.EXTENSION_NAME;return this.getRoot().listExtensionsUsed().find(a=>a.extensionName===r)||new t(this)}disposeExtension(t){let r=this.getRoot().listExtensionsUsed().find(a=>a.extensionName===t);r&&r.dispose()}createScene(t=""){return new Ul(this._graph,t)}createNode(t=""){return new Ll(this._graph,t)}createCamera(t=""){return new Ts(this._graph,t)}createSkin(t=""){return new Gl(this._graph,t)}createMesh(t=""){return new jl(this._graph,t)}createPrimitive(){return new ia(this._graph)}createPrimitiveTarget(t=""){return new tm(this._graph,t)}createMaterial(t=""){return new Ms(this._graph,t)}createTexture(t=""){return new zl(this._graph,t)}createAnimation(t=""){return new Cl(this._graph,t)}createAnimationChannel(t=""){return new Ri(this._graph,t)}createAnimationSampler(t=""){return new Ss(this._graph,t)}createAccessor(t="",r=null){return r||(r=this.getRoot().listBuffers()[0]),new V(this._graph,t).setBuffer(r)}createBuffer(t=""){return new Ol(this._graph,t)}},oe=class{static EXTENSION_NAME;extensionName="";prereadTypes=[];prewriteTypes=[];readDependencies=[];writeDependencies=[];document;required=!1;properties=new Set;_listener;constructor(e){this.document=e,e.getRoot()._enableExtension(this),this._listener=r=>{let a=r,s=a.target;s instanceof J&&s.extensionName===this.extensionName&&(a.type==="node:create"&&this._addExtensionProperty(s),a.type==="node:dispose"&&this._removeExtensionProperty(s))};let t=e.getGraph();t.addEventListener("node:create",this._listener),t.addEventListener("node:dispose",this._listener)}dispose(){this.document.getRoot()._disableExtension(this);let e=this.document.getGraph();e.removeEventListener("node:create",this._listener),e.removeEventListener("node:dispose",this._listener);for(let t of this.properties)t.dispose()}static register(){}isRequired(){return this.required}setRequired(e){return this.required=e,this}listProperties(){return Array.from(this.properties)}_addExtensionProperty(e){return this.properties.add(e),this}_removeExtensionProperty(e){return this.properties.delete(e),this}install(e,t){return this}preread(e,t){return this}prewrite(e,t){return this}},am=class{jsonDoc;buffers=[];bufferViews=[];bufferViewBuffers=[];accessors=[];textures=[];textureInfos=new Map;materials=[];meshes=[];cameras=[];nodes=[];skins=[];animations=[];scenes=[];constructor(e){this.jsonDoc=e}setTextureInfo(e,t){this.textureInfos.set(e,t),t.texCoord!==void 0&&e.setTexCoord(t.texCoord),t.extras!==void 0&&e.setExtras(t.extras);let r=this.jsonDoc.json.textures[t.index];if(r.sampler===void 0)return;let a=this.jsonDoc.json.samplers[r.sampler];a.magFilter!==void 0&&e.setMagFilter(a.magFilter),a.minFilter!==void 0&&e.setMinFilter(a.minFilter),a.wrapS!==void 0&&e.setWrapS(a.wrapS),a.wrapT!==void 0&&e.setWrapT(a.wrapT)}},Ml={logger:Es.DEFAULT_INSTANCE,extensions:[],dependencies:{}},sm=new Set(["Buffer","Texture","Material","Mesh","Primitive","Node","Scene"]),nm=class{static read(e,t=Ml){let r={...Ml,...t},{json:a}=e,s=new rm().setLogger(r.logger);this.validate(e,r);let n=new am(e),i=a.asset,o=s.getRoot().getAsset();i.copyright&&(o.copyright=i.copyright),i.extras&&(o.extras=i.extras),a.extras!==void 0&&s.getRoot().setExtras({...a.extras});let c=a.extensionsUsed||[],l=a.extensionsRequired||[];r.extensions.sort((g,y)=>g.EXTENSION_NAME>y.EXTENSION_NAME?1:-1);for(let g of r.extensions)if(c.includes(g.EXTENSION_NAME)){let y=s.createExtension(g).setRequired(l.includes(g.EXTENSION_NAME)),x=y.prereadTypes.filter(v=>!sm.has(v));x.length&&r.logger.warn(`Preread hooks for some types (${x.join()}), requested by extension ${y.extensionName}, are unsupported. Please file an issue or a PR.`);for(let v of y.readDependencies)y.install(v,r.dependencies[v])}let f=a.buffers||[];s.getRoot().listExtensionsUsed().filter(g=>g.prereadTypes.includes("Buffer")).forEach(g=>g.preread(n,"Buffer")),n.buffers=f.map(g=>{let y=s.createBuffer(g.name);return g.extras&&y.setExtras(g.extras),g.uri&&g.uri.indexOf("__")!==0&&y.setURI(g.uri),y}),n.bufferViewBuffers=(a.bufferViews||[]).map((g,y)=>{if(!n.bufferViews[y]){let x=e.json.buffers[g.buffer],v=x.uri?e.resources[x.uri]:e.resources[Pt],E=g.byteOffset||0;n.bufferViews[y]=X.toView(v,E,g.byteLength)}return n.buffers[g.buffer]});let d=a.accessors||[];n.accessors=d.map(g=>{let y=n.bufferViewBuffers[g.bufferView],x=s.createAccessor(g.name,y).setType(g.type);return g.extras&&x.setExtras(g.extras),g.normalized!==void 0&&x.setNormalized(g.normalized),g.bufferView===void 0||x.setArray(ws(g,n)),x});let p=a.images||[],b=a.textures||[];s.getRoot().listExtensionsUsed().filter(g=>g.prereadTypes.includes("Texture")).forEach(g=>g.preread(n,"Texture")),n.textures=p.map(g=>{let y=s.createTexture(g.name);if(g.extras&&y.setExtras(g.extras),g.bufferView!==void 0){let x=a.bufferViews[g.bufferView],v=e.json.buffers[x.buffer],E=v.uri?e.resources[v.uri]:e.resources[Pt],S=x.byteOffset||0,T=x.byteLength,_=E.slice(S,S+T);y.setImage(_)}else g.uri!==void 0&&(y.setImage(e.resources[g.uri]),g.uri.indexOf("__")!==0&&y.setURI(g.uri));if(g.mimeType!==void 0)y.setMimeType(g.mimeType);else if(g.uri){let x=Ar.extension(g.uri);y.setMimeType(ht.extensionToMimeType(x))}return y}),s.getRoot().listExtensionsUsed().filter(g=>g.prereadTypes.includes("Material")).forEach(g=>g.preread(n,"Material")),n.materials=(a.materials||[]).map(g=>{let y=s.createMaterial(g.name);g.extras&&y.setExtras(g.extras),g.alphaMode!==void 0&&y.setAlphaMode(g.alphaMode),g.alphaCutoff!==void 0&&y.setAlphaCutoff(g.alphaCutoff),g.doubleSided!==void 0&&y.setDoubleSided(g.doubleSided);let x=g.pbrMetallicRoughness||{};if(x.baseColorFactor!==void 0&&y.setBaseColorFactor(x.baseColorFactor),g.emissiveFactor!==void 0&&y.setEmissiveFactor(g.emissiveFactor),x.metallicFactor!==void 0&&y.setMetallicFactor(x.metallicFactor),x.roughnessFactor!==void 0&&y.setRoughnessFactor(x.roughnessFactor),x.baseColorTexture!==void 0){let v=x.baseColorTexture,E=n.textures[b[v.index].source];y.setBaseColorTexture(E),n.setTextureInfo(y.getBaseColorTextureInfo(),v)}if(g.emissiveTexture!==void 0){let v=g.emissiveTexture,E=n.textures[b[v.index].source];y.setEmissiveTexture(E),n.setTextureInfo(y.getEmissiveTextureInfo(),v)}if(g.normalTexture!==void 0){let v=g.normalTexture,E=n.textures[b[v.index].source];y.setNormalTexture(E),n.setTextureInfo(y.getNormalTextureInfo(),v),g.normalTexture.scale!==void 0&&y.setNormalScale(g.normalTexture.scale)}if(g.occlusionTexture!==void 0){let v=g.occlusionTexture,E=n.textures[b[v.index].source];y.setOcclusionTexture(E),n.setTextureInfo(y.getOcclusionTextureInfo(),v),g.occlusionTexture.strength!==void 0&&y.setOcclusionStrength(g.occlusionTexture.strength)}if(x.metallicRoughnessTexture!==void 0){let v=x.metallicRoughnessTexture,E=n.textures[b[v.index].source];y.setMetallicRoughnessTexture(E),n.setTextureInfo(y.getMetallicRoughnessTextureInfo(),v)}return y}),s.getRoot().listExtensionsUsed().filter(g=>g.prereadTypes.includes("Mesh")).forEach(g=>g.preread(n,"Mesh"));let h=a.meshes||[];s.getRoot().listExtensionsUsed().filter(g=>g.prereadTypes.includes("Primitive")).forEach(g=>g.preread(n,"Primitive")),n.meshes=h.map(g=>{let y=s.createMesh(g.name);return g.extras&&y.setExtras(g.extras),g.weights!==void 0&&y.setWeights(g.weights),(g.primitives||[]).forEach(x=>{let v=s.createPrimitive();x.extras&&v.setExtras(x.extras),x.material!==void 0&&v.setMaterial(n.materials[x.material]),x.mode!==void 0&&v.setMode(x.mode);for(let[S,T]of Object.entries(x.attributes||{}))v.setAttribute(S,n.accessors[T]);x.indices!==void 0&&v.setIndices(n.accessors[x.indices]);let E=g.extras&&g.extras.targetNames||[];(x.targets||[]).forEach((S,T)=>{let _=E[T]||T.toString(),I=s.createPrimitiveTarget(_);for(let[N,C]of Object.entries(S))I.setAttribute(N,n.accessors[C]);v.addTarget(I)}),y.addPrimitive(v)}),y}),n.cameras=(a.cameras||[]).map(g=>{let y=s.createCamera(g.name).setType(g.type);if(g.extras&&y.setExtras(g.extras),g.type===Ts.Type.PERSPECTIVE){let x=g.perspective;y.setYFov(x.yfov),y.setZNear(x.znear),x.zfar!==void 0&&y.setZFar(x.zfar),x.aspectRatio!==void 0&&y.setAspectRatio(x.aspectRatio)}else{let x=g.orthographic;y.setZNear(x.znear).setZFar(x.zfar).setXMag(x.xmag).setYMag(x.ymag)}return y});let u=a.nodes||[];s.getRoot().listExtensionsUsed().filter(g=>g.prereadTypes.includes("Node")).forEach(g=>g.preread(n,"Node")),n.nodes=u.map(g=>{let y=s.createNode(g.name);if(g.extras&&y.setExtras(g.extras),g.translation!==void 0&&y.setTranslation(g.translation),g.rotation!==void 0&&y.setRotation(g.rotation),g.scale!==void 0&&y.setScale(g.scale),g.matrix!==void 0){let x=[0,0,0],v=[0,0,0,1],E=[1,1,1];pe.decompose(g.matrix,x,v,E),y.setTranslation(x),y.setRotation(v),y.setScale(E)}return g.weights!==void 0&&y.setWeights(g.weights),y}),n.skins=(a.skins||[]).map(g=>{let y=s.createSkin(g.name);g.extras&&y.setExtras(g.extras),g.inverseBindMatrices!==void 0&&y.setInverseBindMatrices(n.accessors[g.inverseBindMatrices]),g.skeleton!==void 0&&y.setSkeleton(n.nodes[g.skeleton]);for(let x of g.joints)y.addJoint(n.nodes[x]);return y}),u.map((g,y)=>{let x=n.nodes[y];(g.children||[]).forEach(v=>x.addChild(n.nodes[v])),g.mesh!==void 0&&x.setMesh(n.meshes[g.mesh]),g.camera!==void 0&&x.setCamera(n.cameras[g.camera]),g.skin!==void 0&&x.setSkin(n.skins[g.skin])}),n.animations=(a.animations||[]).map(g=>{let y=s.createAnimation(g.name);g.extras&&y.setExtras(g.extras);let x=(g.samplers||[]).map(v=>{let E=s.createAnimationSampler().setInput(n.accessors[v.input]).setOutput(n.accessors[v.output]).setInterpolation(v.interpolation||Ss.Interpolation.LINEAR);return v.extras&&E.setExtras(v.extras),y.addSampler(E),E});return(g.channels||[]).forEach(v=>{let E=s.createAnimationChannel().setSampler(x[v.sampler]).setTargetPath(v.target.path);v.target.node!==void 0&&E.setTargetNode(n.nodes[v.target.node]),v.extras&&E.setExtras(v.extras),y.addChannel(E)}),y});let m=a.scenes||[];return s.getRoot().listExtensionsUsed().filter(g=>g.prereadTypes.includes("Scene")).forEach(g=>g.preread(n,"Scene")),n.scenes=m.map(g=>{let y=s.createScene(g.name);return g.extras&&y.setExtras(g.extras),(g.nodes||[]).map(x=>n.nodes[x]).forEach(x=>y.addChild(x)),y}),a.scene!==void 0&&s.getRoot().setDefaultScene(n.scenes[a.scene]),s.getRoot().listExtensionsUsed().forEach(g=>g.read(n)),d.forEach((g,y)=>{let x=n.accessors[y],v=!!g.sparse,E=!g.bufferView&&!x.getArray();(v||E)&&x.setSparse(!0).setArray(om(g,n))}),s}static validate(e,t){let r=e.json;if(r.asset.version!=="2.0")throw new Error(`Unsupported glTF version, "${r.asset.version}".`);if(r.extensionsRequired){for(let a of r.extensionsRequired)if(!t.extensions.find(s=>s.EXTENSION_NAME===a))throw new Error(`Missing required extension, "${a}".`)}if(r.extensionsUsed)for(let a of r.extensionsUsed)t.extensions.find(s=>s.EXTENSION_NAME===a)||t.logger.warn(`Missing optional extension, "${a}".`)}};function im(e,t){let r=t.jsonDoc,a=t.bufferViews[e.bufferView],s=r.json.bufferViews[e.bufferView],n=ks[e.componentType],i=V.getElementSize(e.type),o=n.BYTES_PER_ELEMENT,c=e.byteOffset||0,l=new n(e.count*i),f=new DataView(a.buffer,a.byteOffset,a.byteLength),d=s.byteStride;for(let p=0;p<e.count;p++)for(let b=0;b<i;b++){let h=c+p*d+b*o,u;switch(e.componentType){case V.ComponentType.FLOAT:u=f.getFloat32(h,!0);break;case V.ComponentType.UNSIGNED_INT:u=f.getUint32(h,!0);break;case V.ComponentType.UNSIGNED_SHORT:u=f.getUint16(h,!0);break;case V.ComponentType.UNSIGNED_BYTE:u=f.getUint8(h);break;case V.ComponentType.SHORT:u=f.getInt16(h,!0);break;case V.ComponentType.BYTE:u=f.getInt8(h);break;case V.ComponentType.FLOAT16:u=f.getFloat16(h,!0);break;case V.ComponentType.FLOAT64:u=f.getFloat64(h,!0);break;default:throw new Error(`Unexpected componentType "${e.componentType}".`)}l[p*i+b]=u}return l}function ws(e,t){let r=t.jsonDoc,a=t.bufferViews[e.bufferView],s=r.json.bufferViews[e.bufferView],n=ks[e.componentType],i=V.getElementSize(e.type),o=n.BYTES_PER_ELEMENT,c=i*o;if(s.byteStride!==void 0&&s.byteStride!==c)return im(e,t);let l=a.byteOffset+(e.byteOffset||0),f=e.count*i*o;return new n(a.buffer.slice(l,l+f))}function om(e,t){let r=ks[e.componentType],a=V.getElementSize(e.type),s;e.bufferView!==void 0?s=ws(e,t):s=new r(e.count*a);let n=e.sparse;if(!n)return s;let i=n.count,o={...e,...n.indices,count:i,type:"SCALAR"},c={...e,...n.values,count:i},l=ws(o,t),f=ws(c,t);for(let d=0;d<o.count;d++)for(let p=0;p<a;p++)s[l[d]*a+p]=f[d*a+p];return s}var Kl=(function(e){return e[e.ARRAY_BUFFER=34962]="ARRAY_BUFFER",e[e.ELEMENT_ARRAY_BUFFER=34963]="ELEMENT_ARRAY_BUFFER",e})(Kl||{}),Ft=class{_doc;jsonDoc;options;static BufferViewTarget=Kl;static BufferViewUsage=Ng;static USAGE_TO_TARGET={ARRAY_BUFFER:34962,ELEMENT_ARRAY_BUFFER:34963};accessorIndexMap=new Map;animationIndexMap=new Map;bufferIndexMap=new Map;cameraIndexMap=new Map;skinIndexMap=new Map;materialIndexMap=new Map;meshIndexMap=new Map;nodeIndexMap=new Map;imageIndexMap=new Map;textureDefIndexMap=new Map;textureInfoDefMap=new Map;samplerDefIndexMap=new Map;sceneIndexMap=new Map;imageBufferViews=[];otherBufferViews=new Map;otherBufferViewsIndexMap=new Map;extensionData={};bufferURIGenerator;imageURIGenerator;logger;_accessorUsageMap=new Map;accessorUsageGroupedByParent=new Set(["ARRAY_BUFFER"]);accessorParents=new Map;constructor(e,t,r){this._doc=e,this.jsonDoc=t,this.options=r;let a=e.getRoot(),s=a.listBuffers().length,n=a.listTextures().length;this.bufferURIGenerator=new kl(s>1,()=>r.basename||"buffer"),this.imageURIGenerator=new kl(n>1,i=>cm(e,i)||r.basename||"texture"),this.logger=e.getLogger()}createTextureInfoDef(e,t){let r={magFilter:t.getMagFilter()||void 0,minFilter:t.getMinFilter()||void 0,wrapS:t.getWrapS(),wrapT:t.getWrapT()},a=JSON.stringify(r);this.samplerDefIndexMap.has(a)||(this.samplerDefIndexMap.set(a,this.jsonDoc.json.samplers.length),this.jsonDoc.json.samplers.push(r));let s={source:this.imageIndexMap.get(e),sampler:this.samplerDefIndexMap.get(a)},n=JSON.stringify(s);this.textureDefIndexMap.has(n)||(this.textureDefIndexMap.set(n,this.jsonDoc.json.textures.length),this.jsonDoc.json.textures.push(s));let i={index:this.textureDefIndexMap.get(n)};return t.getTexCoord()!==0&&(i.texCoord=t.getTexCoord()),Object.keys(t.getExtras()).length>0&&(i.extras=t.getExtras()),this.textureInfoDefMap.set(t,i),i}createPropertyDef(e){let t={};return e.getName()&&(t.name=e.getName()),Object.keys(e.getExtras()).length>0&&(t.extras=e.getExtras()),t}createAccessorDef(e){let t=this.createPropertyDef(e);return t.type=e.getType(),t.componentType=e.getComponentType(),t.count=e.getCount(),this._doc.getGraph().listParentEdges(e).some(r=>r.getName()==="attributes"&&r.getAttributes().key==="POSITION"||r.getName()==="input")&&(t.max=e.getMax([]).map(Math.fround),t.min=e.getMin([]).map(Math.fround)),e.getNormalized()&&(t.normalized=e.getNormalized()),t}createImageData(e,t,r){if(this.options.format==="GLB")this.imageBufferViews.push(t),e.bufferView=this.jsonDoc.json.bufferViews.length,this.jsonDoc.json.bufferViews.push({buffer:0,byteOffset:-1,byteLength:t.byteLength});else{let a=ht.mimeTypeToExtension(r.getMimeType());e.uri=this.imageURIGenerator.createURI(r,a),this.assignResourceURI(e.uri,t,!1)}}assignResourceURI(e,t,r){let a=this.jsonDoc.resources;if(!(e in a)){a[e]=t;return}if(t===a[e]){this.logger.warn(`Duplicate resource URI, "${e}".`);return}let s=`Resource URI "${e}" already assigned to different data.`;if(!r){this.logger.warn(s);return}throw new Error(s)}getAccessorUsage(e){let t=this._accessorUsageMap.get(e);if(t)return t;if(e.getSparse())return"SPARSE";for(let r of this._doc.getGraph().listParentEdges(e)){let{usage:a}=r.getAttributes();if(a)return a;r.getParent().propertyType!=="Root"&&this.logger.warn(`Missing attribute ".usage" on edge, "${r.getName()}".`)}return"OTHER"}addAccessorToUsageGroup(e,t){let r=this._accessorUsageMap.get(e);if(r&&r!==t)throw new Error(`Accessor with usage "${r}" cannot be reused as "${t}".`);return this._accessorUsageMap.set(e,t),this}},kl=class{multiple;basename;counter={};constructor(e,t){this.multiple=e,this.basename=t}createURI(e,t){if(e.getURI())return e.getURI();if(this.multiple){let r=this.basename(e);return this.counter[r]=this.counter[r]||1,`${r}_${this.counter[r]++}.${t}`}else return`${this.basename(e)}.${t}`}};function cm(e,t){let r=e.getGraph().listParentEdges(t).find(a=>a.getParent()!==e.getRoot());return r?r.getName().replace(/texture$/i,""):""}var{BufferViewUsage:xs}=Ft,{UNSIGNED_INT:lm,UNSIGNED_SHORT:dm,UNSIGNED_BYTE:um}=V.ComponentType,fm=new Set(["Accessor","Buffer","Material","Mesh"]),hm=class{static write(e,t){let r=e.getGraph(),a=e.getRoot(),s={asset:{generator:`glTF-Transform ${Sl}`,...a.getAsset()},extras:{...a.getExtras()}},n={json:s,resources:{}},i=new Ft(e,n,t),o=t.logger||Es.DEFAULT_INSTANCE,c=new Set(t.extensions.map(u=>u.EXTENSION_NAME)),l=e.getRoot().listExtensionsUsed().filter(u=>c.has(u.extensionName)).sort((u,m)=>u.extensionName>m.extensionName?1:-1),f=e.getRoot().listExtensionsRequired().filter(u=>c.has(u.extensionName)).sort((u,m)=>u.extensionName>m.extensionName?1:-1);l.length<e.getRoot().listExtensionsUsed().length&&o.warn("Some extensions were not registered for I/O, and will not be written.");for(let u of l){let m=u.prewriteTypes.filter(g=>!fm.has(g));m.length&&o.warn(`Prewrite hooks for some types (${m.join()}), requested by extension ${u.extensionName}, are unsupported. Please file an issue or a PR.`);for(let g of u.writeDependencies)u.install(g,t.dependencies[g])}function d(u,m,g,y){let x=[],v=0;for(let S of u){let T=i.createAccessorDef(S);T.bufferView=s.bufferViews.length;let _=S.getArray(),I=X.pad(X.toView(_));T.byteOffset=v,v+=I.byteLength,x.push(I),i.accessorIndexMap.set(S,s.accessors.length),s.accessors.push(T)}let E={buffer:m,byteOffset:g,byteLength:X.concat(x).byteLength};return y&&(E.target=y),s.bufferViews.push(E),{buffers:x,byteLength:v}}function p(u,m,g){let y=u[0].getCount(),x=0;for(let _ of u){let I=i.createAccessorDef(_);I.bufferView=s.bufferViews.length,I.byteOffset=x;let N=_.getElementSize(),C=_.getComponentSize();x+=X.padNumber(N*C),i.accessorIndexMap.set(_,s.accessors.length),s.accessors.push(I)}let v=y*x,E=new ArrayBuffer(v),S=new DataView(E);for(let _=0;_<y;_++){let I=0;for(let N of u){let C=N.getElementSize(),B=N.getComponentSize(),R=N.getComponentType(),j=N.getArray();for(let q=0;q<C;q++){let Y=_*x+I+q*B,te=j[_*C+q];switch(R){case V.ComponentType.FLOAT:S.setFloat32(Y,te,!0);break;case V.ComponentType.BYTE:S.setInt8(Y,te);break;case V.ComponentType.SHORT:S.setInt16(Y,te,!0);break;case V.ComponentType.UNSIGNED_BYTE:S.setUint8(Y,te);break;case V.ComponentType.UNSIGNED_SHORT:S.setUint16(Y,te,!0);break;case V.ComponentType.UNSIGNED_INT:S.setUint32(Y,te,!0);break;case V.ComponentType.FLOAT16:S.setFloat16(Y,te,!0);break;case V.ComponentType.FLOAT64:S.setFloat64(Y,te,!0);break;default:throw new Error("Unexpected component type: "+R)}}I+=X.padNumber(C*B)}}let T={buffer:m,byteOffset:g,byteLength:v,byteStride:x,target:Ft.BufferViewTarget.ARRAY_BUFFER};return s.bufferViews.push(T),{byteLength:v,buffers:[new Uint8Array(E)]}}function b(u,m,g){let y=[],x=0,v=new Map,E=-1/0,S=!1;for(let R of u){let j=i.createAccessorDef(R);s.accessors.push(j),i.accessorIndexMap.set(R,s.accessors.length-1);let q=[],Y=[],te=[],we=new Array(R.getElementSize()).fill(0);for(let he=0,Re=R.getCount();he<Re;he++)if(R.getElement(he,te),!pe.eq(te,we,0)){E=Math.max(he,E),q.push(he);for(let je=0;je<te.length;je++)Y.push(te[je])}let ne=q.length,me={accessorDef:j,count:ne};if(v.set(R,me),ne===0)continue;ne>R.getCount()/2&&(S=!0);let Pe=ks[R.getComponentType()];me.indices=q,me.values=new Pe(Y)}if(!Number.isFinite(E))return{buffers:y,byteLength:x};S&&o.warn("Some sparse accessors have >50% non-zero elements, which may increase file size.");let T=E<255?Uint8Array:E<65535?Uint16Array:Uint32Array,_=E<255?um:E<65535?dm:lm,I={buffer:m,byteOffset:g+x,byteLength:0};for(let R of u){let j=v.get(R);if(j.count===0)continue;j.indicesByteOffset=I.byteLength;let q=X.pad(X.toView(new T(j.indices)));y.push(q),x+=q.byteLength,I.byteLength+=q.byteLength}s.bufferViews.push(I);let N=s.bufferViews.length-1,C={buffer:m,byteOffset:g+x,byteLength:0};for(let R of u){let j=v.get(R);if(j.count===0)continue;j.valuesByteOffset=C.byteLength;let q=X.pad(X.toView(j.values));y.push(q),x+=q.byteLength,C.byteLength+=q.byteLength}s.bufferViews.push(C);let B=s.bufferViews.length-1;for(let R of u){let j=v.get(R);j.count!==0&&(j.accessorDef.sparse={count:j.count,indices:{bufferView:N,byteOffset:j.indicesByteOffset,componentType:_},values:{bufferView:B,byteOffset:j.valuesByteOffset}})}return{buffers:y,byteLength:x}}if(s.accessors=[],s.bufferViews=[],s.samplers=[],s.textures=[],s.images=a.listTextures().map((u,m)=>{let g=i.createPropertyDef(u);u.getMimeType()&&(g.mimeType=u.getMimeType());let y=u.getImage();return y&&i.createImageData(g,y,u),i.imageIndexMap.set(u,m),g}),l.filter(u=>u.prewriteTypes.includes("Accessor")).forEach(u=>u.prewrite(i,"Accessor")),a.listAccessors().forEach(u=>{let m=i.accessorUsageGroupedByParent,g=i.accessorParents;if(i.accessorIndexMap.has(u))return;let y=i.getAccessorUsage(u);if(i.addAccessorToUsageGroup(u,y),m.has(y)){let x=r.listParents(u).find(v=>v.propertyType!=="Root");g.set(u,x)}}),l.filter(u=>u.prewriteTypes.includes("Buffer")).forEach(u=>u.prewrite(i,"Buffer")),(a.listAccessors().length>0||i.otherBufferViews.size>0||a.listTextures().length>0&&t.format==="GLB")&&a.listBuffers().length===0)throw new Error("Buffer required for Document resources, but none was found.");s.buffers=[],a.listBuffers().forEach((u,m)=>{let g=i.createPropertyDef(u),y=i.accessorUsageGroupedByParent,x=u.listParents().filter(N=>N instanceof V),v=new Set(x.map(N=>i.accessorParents.get(N))),E=new Map(Array.from(v).map((N,C)=>[N,C])),S={};for(let N of x){if(i.accessorIndexMap.has(N))continue;let C=i.getAccessorUsage(N),B=C;if(y.has(C)){let R=i.accessorParents.get(N);B+=`:${E.get(R)}`}S[B]||={usage:C,accessors:[]},S[B].accessors.push(N)}let T=[],_=s.buffers.length,I=0;for(let{usage:N,accessors:C}of Object.values(S))if(N===xs.ARRAY_BUFFER&&t.vertexLayout==="interleaved"){let B=p(C,_,I);I+=B.byteLength;for(let R of B.buffers)T.push(R)}else if(N===xs.ARRAY_BUFFER)for(let B of C){let R=p([B],_,I);I+=R.byteLength;for(let j of R.buffers)T.push(j)}else if(N===xs.SPARSE){let B=b(C,_,I);I+=B.byteLength;for(let R of B.buffers)T.push(R)}else if(N===xs.ELEMENT_ARRAY_BUFFER){let B=Ft.BufferViewTarget.ELEMENT_ARRAY_BUFFER,R=d(C,_,I,B);I+=R.byteLength;for(let j of R.buffers)T.push(j)}else{let B=d(C,_,I);I+=B.byteLength;for(let R of B.buffers)T.push(R)}if(i.imageBufferViews.length&&m===0){for(let N=0;N<i.imageBufferViews.length;N++)if(s.bufferViews[s.images[N].bufferView].byteOffset=I,I+=i.imageBufferViews[N].byteLength,T.push(i.imageBufferViews[N]),I%8){let C=8-I%8;I+=C,T.push(new Uint8Array(C))}}if(i.otherBufferViews.has(u))for(let N of i.otherBufferViews.get(u))s.bufferViews.push({buffer:_,byteOffset:I,byteLength:N.byteLength}),i.otherBufferViewsIndexMap.set(N,s.bufferViews.length-1),I+=N.byteLength,T.push(N);if(I){let N;t.format==="GLB"?N=Pt:(N=i.bufferURIGenerator.createURI(u,"bin"),g.uri=N),g.byteLength=I,i.assignResourceURI(N,X.concat(T),!0)}s.buffers.push(g),i.bufferIndexMap.set(u,m)}),a.listAccessors().find(u=>!u.getBuffer())&&o.warn("Skipped writing one or more Accessors: no Buffer assigned."),l.filter(u=>u.prewriteTypes.includes("Material")).forEach(u=>u.prewrite(i,"Material")),s.materials=a.listMaterials().map((u,m)=>{let g=i.createPropertyDef(u);if(u.getAlphaMode()!==Ms.AlphaMode.OPAQUE&&(g.alphaMode=u.getAlphaMode()),u.getAlphaMode()===Ms.AlphaMode.MASK&&(g.alphaCutoff=u.getAlphaCutoff()),u.getDoubleSided()&&(g.doubleSided=!0),g.pbrMetallicRoughness={},pe.eq(u.getBaseColorFactor(),[1,1,1,1])||(g.pbrMetallicRoughness.baseColorFactor=u.getBaseColorFactor()),pe.eq(u.getEmissiveFactor(),[0,0,0])||(g.emissiveFactor=u.getEmissiveFactor()),u.getRoughnessFactor()!==1&&(g.pbrMetallicRoughness.roughnessFactor=u.getRoughnessFactor()),u.getMetallicFactor()!==1&&(g.pbrMetallicRoughness.metallicFactor=u.getMetallicFactor()),u.getBaseColorTexture()){let y=u.getBaseColorTexture(),x=u.getBaseColorTextureInfo();g.pbrMetallicRoughness.baseColorTexture=i.createTextureInfoDef(y,x)}if(u.getEmissiveTexture()){let y=u.getEmissiveTexture(),x=u.getEmissiveTextureInfo();g.emissiveTexture=i.createTextureInfoDef(y,x)}if(u.getNormalTexture()){let y=u.getNormalTexture(),x=u.getNormalTextureInfo(),v=i.createTextureInfoDef(y,x);u.getNormalScale()!==1&&(v.scale=u.getNormalScale()),g.normalTexture=v}if(u.getOcclusionTexture()){let y=u.getOcclusionTexture(),x=u.getOcclusionTextureInfo(),v=i.createTextureInfoDef(y,x);u.getOcclusionStrength()!==1&&(v.strength=u.getOcclusionStrength()),g.occlusionTexture=v}if(u.getMetallicRoughnessTexture()){let y=u.getMetallicRoughnessTexture(),x=u.getMetallicRoughnessTextureInfo();g.pbrMetallicRoughness.metallicRoughnessTexture=i.createTextureInfoDef(y,x)}return i.materialIndexMap.set(u,m),g}),l.filter(u=>u.prewriteTypes.includes("Mesh")).forEach(u=>u.prewrite(i,"Mesh")),s.meshes=a.listMeshes().map((u,m)=>{let g=i.createPropertyDef(u),y=null;return g.primitives=u.listPrimitives().map(x=>{let v={attributes:{}};v.mode=x.getMode();let E=x.getMaterial();E&&(v.material=i.materialIndexMap.get(E)),Object.keys(x.getExtras()).length&&(v.extras=x.getExtras());let S=x.getIndices();S&&(v.indices=i.accessorIndexMap.get(S));for(let T of x.listSemantics())v.attributes[T]=i.accessorIndexMap.get(x.getAttribute(T));for(let T of x.listTargets()){let _={};for(let I of T.listSemantics())_[I]=i.accessorIndexMap.get(T.getAttribute(I));v.targets=v.targets||[],v.targets.push(_)}return x.listTargets().length&&!y&&(y=x.listTargets().map(T=>T.getName())),v}),u.getWeights().length&&(g.weights=u.getWeights()),y&&(g.extras=g.extras||{},g.extras.targetNames=y),i.meshIndexMap.set(u,m),g}),s.cameras=a.listCameras().map((u,m)=>{let g=i.createPropertyDef(u);if(g.type=u.getType(),g.type===Ts.Type.PERSPECTIVE){g.perspective={znear:u.getZNear(),zfar:u.getZFar(),yfov:u.getYFov()};let y=u.getAspectRatio();y!==null&&(g.perspective.aspectRatio=y)}else g.orthographic={znear:u.getZNear(),zfar:u.getZFar(),xmag:u.getXMag(),ymag:u.getYMag()};return i.cameraIndexMap.set(u,m),g}),s.nodes=a.listNodes().map((u,m)=>{let g=i.createPropertyDef(u);return pe.eq(u.getTranslation(),[0,0,0])||(g.translation=u.getTranslation()),pe.eq(u.getRotation(),[0,0,0,1])||(g.rotation=u.getRotation()),pe.eq(u.getScale(),[1,1,1])||(g.scale=u.getScale()),u.getWeights().length&&(g.weights=u.getWeights()),i.nodeIndexMap.set(u,m),g}),s.skins=a.listSkins().map((u,m)=>{let g=i.createPropertyDef(u),y=u.getInverseBindMatrices();y&&(g.inverseBindMatrices=i.accessorIndexMap.get(y));let x=u.getSkeleton();return x&&(g.skeleton=i.nodeIndexMap.get(x)),g.joints=u.listJoints().map(v=>i.nodeIndexMap.get(v)),i.skinIndexMap.set(u,m),g}),a.listNodes().forEach((u,m)=>{let g=s.nodes[m],y=u.getMesh();y&&(g.mesh=i.meshIndexMap.get(y));let x=u.getCamera();x&&(g.camera=i.cameraIndexMap.get(x));let v=u.getSkin();v&&(g.skin=i.skinIndexMap.get(v)),u.listChildren().length>0&&(g.children=u.listChildren().map(E=>i.nodeIndexMap.get(E)))}),s.animations=a.listAnimations().map((u,m)=>{let g=i.createPropertyDef(u),y=new Map;return g.samplers=u.listSamplers().map((x,v)=>{let E=i.createPropertyDef(x);return E.input=i.accessorIndexMap.get(x.getInput()),E.output=i.accessorIndexMap.get(x.getOutput()),E.interpolation=x.getInterpolation(),y.set(x,v),E}),g.channels=u.listChannels().map(x=>{let v=i.createPropertyDef(x);return v.sampler=y.get(x.getSampler()),v.target={node:i.nodeIndexMap.get(x.getTargetNode()),path:x.getTargetPath()},v}),i.animationIndexMap.set(u,m),g}),s.scenes=a.listScenes().map((u,m)=>{let g=i.createPropertyDef(u);return g.nodes=u.listChildren().map(y=>i.nodeIndexMap.get(y)),i.sceneIndexMap.set(u,m),g});let h=a.getDefaultScene();return h&&(s.scene=a.listScenes().indexOf(h)),s.extensionsUsed=l.map(u=>u.extensionName),s.extensionsRequired=f.map(u=>u.extensionName),l.forEach(u=>u.write(i)),bm(s),n}};function bm(e){let t=[];for(let r in e){let a=e[r];(Array.isArray(a)&&a.length===0||a===null||a===""||a&&typeof a=="object"&&Object.keys(a).length===0)&&t.push(r)}for(let r of t)delete e[r]}var pm=class{_logger=Es.DEFAULT_INSTANCE;_extensions=new Set;_dependencies={};_vertexLayout="interleaved";_strictResources=!0;lastReadBytes=0;lastWriteBytes=0;setLogger(e){return this._logger=e,this}registerExtensions(e){for(let t of e)this._extensions.add(t),t.register();return this}registerDependencies(e){return Object.assign(this._dependencies,e),this}setVertexLayout(e){return this._vertexLayout=e,this}setStrictResources(e){return this._strictResources=e,this}async read(e){return await this.readJSON(await this.readAsJSON(e))}async readAsJSON(e){let t=await this.readURI(e,"view");this.lastReadBytes=t.byteLength;let r=El(t)?this._binaryToJSON(t):{json:JSON.parse(X.decodeText(t)),resources:{}};return await this._readResourcesExternal(r,this.dirname(e)),this._readResourcesInternal(r),r}async readJSON(e){return e=this._copyJSON(e),this._readResourcesInternal(e),nm.read(e,{extensions:Array.from(this._extensions),dependencies:this._dependencies,logger:this._logger})}async binaryToJSON(e){let t=this._binaryToJSON(X.assertView(e));this._readResourcesInternal(t);let r=t.json;if(r.buffers&&r.buffers.some(a=>gm(t,a)))throw new Error("Cannot resolve external buffers with binaryToJSON().");if(r.images&&r.images.some(a=>mm(t,a)))throw new Error("Cannot resolve external images with binaryToJSON().");return t}async readBinary(e){return this.readJSON(await this.binaryToJSON(X.assertView(e)))}async writeJSON(e,t={}){if(t.format==="GLB"&&e.getRoot().listBuffers().length>1)throw new Error("GLB must have 0\u20131 buffers.");return hm.write(e,{format:t.format||"GLTF",basename:t.basename||"",logger:this._logger,vertexLayout:this._vertexLayout,dependencies:{...this._dependencies},extensions:Array.from(this._extensions)})}async writeBinary(e){let{json:t,resources:r}=await this.writeJSON(e,{format:"GLB"}),a=new Uint32Array([1179937895,2,12]),s=JSON.stringify(t),n=X.pad(X.encodeText(s),32),i=X.toView(new Uint32Array([n.byteLength,1313821514])),o=X.concat([i,n]);a[a.length-1]+=o.byteLength;let c=Object.values(r)[0];if(!c||!c.byteLength)return X.concat([X.toView(a),o]);let l=X.pad(c,0),f=X.toView(new Uint32Array([l.byteLength,5130562])),d=X.concat([f,l]);return a[a.length-1]+=d.byteLength,X.concat([X.toView(a),o,d])}async _readResourcesExternal(e,t){let r=e.json.images||[],a=e.json.buffers||[],s=[...r,...a].map(async n=>{let i=n.uri;if(!i||i.match(/data:/))return Promise.resolve();try{e.resources[i]=await this.readURI(this.resolve(t,i),"view"),this.lastReadBytes+=e.resources[i].byteLength}catch(o){if(!this._strictResources&&r.includes(n))this._logger.warn(`Failed to load image URI, "${i}". ${o}`),e.resources[i]=null;else throw o}});await Promise.all(s)}_readResourcesInternal(e){function t(r){if(r.uri){if(r.uri in e.resources){X.assertView(e.resources[r.uri]);return}if(r.uri.match(/data:/)){let a=`__${Jg()}.${Ar.extension(r.uri)}`;e.resources[a]=X.createBufferFromDataURI(r.uri),r.uri=a}}}(e.json.images||[]).forEach(r=>{if(r.bufferView===void 0&&r.uri===void 0)throw new Error("Missing resource URI or buffer view.");t(r)}),(e.json.buffers||[]).forEach(t)}_copyJSON(e){let{images:t,buffers:r}=e.json;return e={json:{...e.json},resources:{...e.resources}},t&&(e.json.images=t.map(a=>({...a}))),r&&(e.json.buffers=r.map(a=>({...a}))),e}_binaryToJSON(e){if(!El(e))throw new Error("Invalid glTF 2.0 binary.");let t=new Uint32Array(e.buffer,e.byteOffset+12,2);if(t[1]!==1313821514)throw new Error("Missing required GLB JSON chunk.");let r=20,a=t[0],s=X.decodeText(X.toView(e,r,a)),n=JSON.parse(s),i=r+a;if(e.byteLength<=i)return{json:n,resources:{}};let o=new Uint32Array(e.buffer,e.byteOffset+i,2);if(o[1]!==5130562)return{json:n,resources:{}};let c=o[0],l=X.toView(e,i+8,c);return{json:n,resources:{[Pt]:l}}}};function gm(e,t){return t.uri!==void 0&&!(t.uri in e.resources)}function mm(e,t){return t.uri!==void 0&&!(t.uri in e.resources)&&t.bufferView===void 0}function El(e){if(e.byteLength<3*Uint32Array.BYTES_PER_ELEMENT)return!1;let t=new Uint32Array(e.buffer,e.byteOffset,3);return t[0]===1179937895&&t[1]===2}var Vl=class extends pm{_fetchConfig;constructor(e=Ei.DEFAULT_INIT){super(),this._fetchConfig=e}async readURI(e,t){let r=await fetch(e,this._fetchConfig);switch(t){case"view":return new Uint8Array(await r.arrayBuffer());case"text":return r.text()}}resolve(e,t){return Ei.resolve(e,t)}dirname(e){return Ei.dirname(e)}};function ym(){return{vkFormat:0,typeSize:1,pixelWidth:0,pixelHeight:0,pixelDepth:0,layerCount:0,faceCount:1,levelCount:0,supercompressionScheme:0,levels:[],dataFormatDescriptor:[{vendorId:0,descriptorType:0,versionNumber:2,colorModel:0,colorPrimaries:1,transferFunction:2,flags:0,texelBlockDimension:[0,0,0,0],bytesPlane:[0,0,0,0,0,0,0,0],samples:[]}],keyValue:{},globalData:null}}var lr=class{constructor(t,r,a,s){this._dataView=void 0,this._littleEndian=void 0,this._offset=void 0,this._dataView=new DataView(t.buffer,t.byteOffset+r,a),this._littleEndian=s,this._offset=0}_nextUint8(){let t=this._dataView.getUint8(this._offset);return this._offset+=1,t}_nextUint16(){let t=this._dataView.getUint16(this._offset,this._littleEndian);return this._offset+=2,t}_nextUint32(){let t=this._dataView.getUint32(this._offset,this._littleEndian);return this._offset+=4,t}_nextUint64(){let t=this._dataView.getUint32(this._offset,this._littleEndian),r=this._dataView.getUint32(this._offset+4,this._littleEndian),a=t+2**32*r;return this._offset+=8,a}_nextInt32(){let t=this._dataView.getInt32(this._offset,this._littleEndian);return this._offset+=4,t}_nextUint8Array(t){let r=new Uint8Array(this._dataView.buffer,this._dataView.byteOffset+this._offset,t);return this._offset+=t,r}_skip(t){return this._offset+=t,this}_scan(t,r=0){let a=this._offset,s=0;for(;this._dataView.getUint8(this._offset)!==r&&s<t;)s++,this._offset++;return s<t&&this._offset++,new Uint8Array(this._dataView.buffer,this._dataView.byteOffset+a,s)}};var pS=new Uint8Array([0]),De=[171,75,84,88,32,50,48,187,13,10,26,10];function Hl(e){return new TextDecoder().decode(e)}function As(e){let t=new Uint8Array(e.buffer,e.byteOffset,De.length);if(t[0]!==De[0]||t[1]!==De[1]||t[2]!==De[2]||t[3]!==De[3]||t[4]!==De[4]||t[5]!==De[5]||t[6]!==De[6]||t[7]!==De[7]||t[8]!==De[8]||t[9]!==De[9]||t[10]!==De[10]||t[11]!==De[11])throw new Error("Missing KTX 2.0 identifier.");let r=ym(),a=17*Uint32Array.BYTES_PER_ELEMENT,s=new lr(e,De.length,a,!0);r.vkFormat=s._nextUint32(),r.typeSize=s._nextUint32(),r.pixelWidth=s._nextUint32(),r.pixelHeight=s._nextUint32(),r.pixelDepth=s._nextUint32(),r.layerCount=s._nextUint32(),r.faceCount=s._nextUint32(),r.levelCount=s._nextUint32(),r.supercompressionScheme=s._nextUint32();let n=s._nextUint32(),i=s._nextUint32(),o=s._nextUint32(),c=s._nextUint32(),l=s._nextUint64(),f=s._nextUint64(),d=Math.max(r.levelCount,1)*3*8,p=new lr(e,De.length+a,d,!0);for(let P=0,D=Math.max(r.levelCount,1);P<D;P++)r.levels.push({levelData:new Uint8Array(e.buffer,e.byteOffset+p._nextUint64(),p._nextUint64()),uncompressedByteLength:p._nextUint64()});let b=new lr(e,n,i,!0);b._skip(4);let h=b._nextUint16(),u=b._nextUint16(),m=b._nextUint16(),g=b._nextUint16(),y=b._nextUint8(),x=b._nextUint8(),v=b._nextUint8(),E=b._nextUint8(),S=[b._nextUint8(),b._nextUint8(),b._nextUint8(),b._nextUint8()],T=[b._nextUint8(),b._nextUint8(),b._nextUint8(),b._nextUint8(),b._nextUint8(),b._nextUint8(),b._nextUint8(),b._nextUint8()],I={vendorId:h,descriptorType:u,versionNumber:m,colorModel:y,colorPrimaries:x,transferFunction:v,flags:E,texelBlockDimension:S,bytesPlane:T,samples:[]},B=(g/4-6)/4;for(let P=0;P<B;P++){let D={bitOffset:b._nextUint16(),bitLength:b._nextUint8(),channelType:b._nextUint8(),samplePosition:[b._nextUint8(),b._nextUint8(),b._nextUint8(),b._nextUint8()],sampleLower:Number.NEGATIVE_INFINITY,sampleUpper:Number.POSITIVE_INFINITY};D.channelType&64?(D.sampleLower=b._nextInt32(),D.sampleUpper=b._nextInt32()):(D.sampleLower=b._nextUint32(),D.sampleUpper=b._nextUint32()),I.samples[P]=D}r.dataFormatDescriptor.length=0,r.dataFormatDescriptor.push(I);let R=new lr(e,o,c,!0);for(;R._offset<c;){let P=R._nextUint32(),D=R._scan(P),Q=Hl(D);if(r.keyValue[Q]=R._nextUint8Array(P-D.byteLength-1),Q.match(/^ktx/i)){let U=Hl(r.keyValue[Q]);r.keyValue[Q]=U.substring(0,U.lastIndexOf("\0"))}let fe=P%4?4-P%4:0;R._skip(fe)}if(f<=0)return r;let j=new lr(e,l,f,!0),q=j._nextUint16(),Y=j._nextUint16(),te=j._nextUint32(),we=j._nextUint32(),ne=j._nextUint32(),me=j._nextUint32(),Pe=[];for(let P=0,D=Math.max(r.levelCount,1);P<D;P++)Pe.push({imageFlags:j._nextUint32(),rgbSliceByteOffset:j._nextUint32(),rgbSliceByteLength:j._nextUint32(),alphaSliceByteOffset:j._nextUint32(),alphaSliceByteLength:j._nextUint32()});let he=l+j._offset,Re=he+te,je=Re+we,Ve=je+ne,ye=new Uint8Array(e.buffer,e.byteOffset+he,te),Er=new Uint8Array(e.buffer,e.byteOffset+Re,we),Sr=new Uint8Array(e.buffer,e.byteOffset+je,ne),A=new Uint8Array(e.buffer,e.byteOffset+Ve,me);return r.globalData={endpointCount:q,selectorCount:Y,imageDescs:Pe,endpointsData:ye,selectorsData:Er,tablesData:Sr,extendedData:A},r}var Lt="EXT_mesh_gpu_instancing",kt="EXT_mesh_features",He="EXT_meshopt_compression",W="EXT_structural_metadata",_s="EXT_texture_webp",Is="EXT_texture_avif",Em="KHR_accessor_float16",Sm="KHR_accessor_float64",xe="KHR_draco_mesh_compression",Mt="KHR_lights_punctual",Dt="KHR_materials_anisotropy",Ut="KHR_materials_clearcoat",Gt="KHR_materials_diffuse_transmission",zt="KHR_materials_dispersion",Kt="KHR_materials_emissive_strength",Vt="KHR_materials_ior",Ht="KHR_materials_iridescence",qt="KHR_materials_pbrSpecularGlossiness",Wt="KHR_materials_sheen",Xt="KHR_materials_specular",$t="KHR_materials_transmission",_r="KHR_materials_unlit",Yt="KHR_materials_volume",Xe="KHR_materials_variants",ql="KHR_mesh_primitive_restart",Wl="KHR_mesh_quantization",Jt="KHR_node_visibility",Rs="KHR_texture_basisu",Qt="KHR_texture_transform",ct="KHR_xmp_json_ld",Tm=class extends J{static EXTENSION_NAME=kt;init(){this.extensionName=kt,this.propertyType="FeatureID",this.parentTypes=["Features"]}getDefaults(){return Object.assign(super.getDefaults(),{nullFeatureId:null,label:"",attribute:null,texture:null,propertyTable:null})}getFeatureCount(){return this.get("featureCount")}setFeatureCount(e){return this.set("featureCount",e)}getNullFeatureID(){return this.get("nullFeatureId")}setNullFeatureID(e){return this.set("nullFeatureId",e)}getLabel(){return this.get("label")}setLabel(e){return this.set("label",e)}getAttribute(){return this.get("attribute")}setAttribute(e){return this.set("attribute",e)}getTexture(){return this.getRef("texture")}setTexture(e){return this.setRef("texture",e)}getPropertyTable(){return this.getRef("propertyTable")}setPropertyTable(e){return this.setRef("propertyTable",e)}},Am=class extends J{static EXTENSION_NAME=kt;init(){this.extensionName=kt,this.propertyType="FeatureIDTexture",this.parentTypes=["FeatureID"]}getDefaults(){let e=new ue(this.graph,"textureInfo");return e.setMinFilter(ue.MagFilter.NEAREST),e.setMagFilter(ue.MagFilter.NEAREST),Object.assign(super.getDefaults(),{channels:[0],texture:null,textureInfo:e})}getChannels(){return this.get("channels")}setChannels(e){return this.set("channels",e)}getTexture(){return this.getRef("texture")}setTexture(e){return this.setRef("texture",e)}getTextureInfo(){return this.getRef("texture")?this.getRef("textureInfo"):null}},_m=class extends J{static EXTENSION_NAME=kt;init(){this.extensionName=kt,this.propertyType="Features",this.parentTypes=[F.PRIMITIVE]}getDefaults(){return Object.assign(super.getDefaults(),{featureIds:new le([])})}listFeatureIDs(){return this.listRefs("featureIds")}addFeatureID(e){return this.addRef("featureIds",e)}removeFeatureID(e){return this.removeRef("featureIds",e)}},oa=kt,ji=class extends oe{extensionName=kt;static EXTENSION_NAME=kt;createFeatures(){return new _m(this.document.getGraph())}createFeatureID(){return new Tm(this.document.getGraph())}createFeatureIDTexture(){return new Am(this.document.getGraph())}read(e){return(e.jsonDoc.json.meshes||[]).forEach((t,r)=>{(t.primitives||[]).forEach((a,s)=>{this._readPrimitive(e,r,a,s)})}),this}_readPrimitive(e,t,r,a){if(!r.extensions||!r.extensions[oa])return;let s=this.createFeatures(),n=r.extensions[oa];for(let i of n.featureIds){let o=Im(this.document,this,e,i);s.addFeatureID(o)}e.meshes[t].listPrimitives()[a].setExtension(oa,s)}write(e){let t=e.jsonDoc.json.meshes;if(!t)return this;for(let r of this.document.getRoot().listMeshes()){let a=t[e.meshIndexMap.get(r)];r.listPrimitives().forEach((s,n)=>{let i=a.primitives[n];this._writePrimitive(e,s,i)})}return this}_writePrimitive(e,t,r){let a=t.getExtension(oa);if(!a)return;let s={featureIds:[]};a.listFeatureIDs().forEach(n=>{s.featureIds.push(Nm(this.document,e,n))}),r.extensions=r.extensions||{},r.extensions[oa]=s}};function Im(e,t,r,a){let s=t.createFeatureID().setFeatureCount(a.featureCount);a.nullFeatureId!==void 0&&s.setNullFeatureID(a.nullFeatureId),a.label!==void 0&&s.setLabel(a.label),a.attribute!==void 0&&s.setAttribute(a.attribute);let n=a.texture;if(n!==void 0){let i=Rm(t,r,n);s.setTexture(i)}if(a.propertyTable!==void 0){let i=e.getRoot().getExtension(W).listPropertyTables();s.setPropertyTable(i[a.propertyTable])}return s}function Rm(e,t,r){let a=e.createFeatureIDTexture(),{json:s}=t.jsonDoc;if(r.channels&&a.setChannels(r.channels),r.index!==void 0){let n=s.textures[r.index].source;a.setTexture(t.textures[n]),t.setTextureInfo(a.getTextureInfo(),r)}return a}function Nm(e,t,r){let a=e.getRoot(),s={featureCount:r.getFeatureCount()};if(r.getNullFeatureID()!=null&&(s.nullFeatureId=r.getNullFeatureID()),r.getLabel()&&(s.label=r.getLabel()),r.getAttribute()!=null&&(s.attribute=r.getAttribute()),r.getTexture()){let n=r.getTexture(),i=n.getTexture(),o=n.getTextureInfo();s.texture=t.createTextureInfoDef(i,o);let c=n.getChannels();pe.eq(c,[0])||(s.texture.channels=c)}if(r.getPropertyTable()){let n=a.getExtension(W),i=r.getPropertyTable();s.propertyTable=n.listPropertyTables().indexOf(i)}return s}var Oi="INSTANCE_ATTRIBUTE",Cm=class extends J{static EXTENSION_NAME=Lt;init(){this.extensionName=Lt,this.propertyType="InstancedMesh",this.parentTypes=[F.NODE]}getDefaults(){return Object.assign(super.getDefaults(),{attributes:new Me})}getAttribute(e){return this.getRefMap("attributes",e)}setAttribute(e,t){return this.setRefMap("attributes",e,t,{usage:Oi})}listAttributes(){return this.listRefMapValues("attributes")}listSemantics(){return this.listRefMapKeys("attributes")}},Bm=class extends oe{static EXTENSION_NAME=Lt;extensionName=Lt;prewriteTypes=[F.ACCESSOR];createInstancedMesh(){return new Cm(this.document.getGraph())}read(e){return(e.jsonDoc.json.nodes||[]).forEach((t,r)=>{if(!t.extensions||!t.extensions.EXT_mesh_gpu_instancing)return;let a=t.extensions[Lt],s=this.createInstancedMesh();for(let n in a.attributes)s.setAttribute(n,e.accessors[a.attributes[n]]);e.nodes[r].setExtension(Lt,s)}),this}prewrite(e){e.accessorUsageGroupedByParent.add(Oi);for(let t of this.properties)for(let r of t.listAttributes())e.addAccessorToUsageGroup(r,Oi);return this}write(e){let t=e.jsonDoc;return this.document.getRoot().listNodes().forEach(r=>{let a=r.getExtension(Lt);if(a){let s=e.nodeIndexMap.get(r),n=t.json.nodes[s],i={attributes:{}};a.listSemantics().forEach(o=>{let c=a.getAttribute(o);i.attributes[o]=e.accessorIndexMap.get(c)}),n.extensions=n.extensions||{},n.extensions[Lt]=i}}),this}},Om=(function(e){return e.QUANTIZE="quantize",e.FILTER="filter",e})({});function Fm(e){return!e.extensions||!e.extensions.EXT_meshopt_compression?!1:!!e.extensions[He].fallback}var{BYTE:Pm,SHORT:Xl,FLOAT:jm}=V.ComponentType,{encodeNormalizedInt:$l,decodeNormalizedInt:Fi}=pe;function Lm(e,t,r,a){let{filter:s,bits:n}=a,i={array:e.getArray(),byteStride:e.getElementSize()*e.getComponentSize(),componentType:e.getComponentType(),normalized:e.getNormalized()};if(r!=="ATTRIBUTES")return i;if(s!=="NONE"){let o=e.getNormalized()?Dm(e):new Float32Array(i.array);switch(s){case"EXPONENTIAL":i.byteStride=e.getElementSize()*4,i.componentType=jm,i.normalized=!1,i.array=t.encodeFilterExp(o,e.getCount(),i.byteStride,n);break;case"OCTAHEDRAL":i.byteStride=n>8?8:4,i.componentType=n>8?Xl:Pm,i.normalized=!0,o=e.getElementSize()===3?Gm(o):o,i.array=t.encodeFilterOct(o,e.getCount(),i.byteStride,n);break;case"QUATERNION":i.byteStride=8,i.componentType=Xl,i.normalized=!0,i.array=t.encodeFilterQuat(o,e.getCount(),i.byteStride,n);break;default:throw new Error("Invalid filter.")}i.min=e.getMin([]),i.max=e.getMax([]),e.getNormalized()&&(i.min=i.min.map(c=>Fi(c,e.getComponentType())),i.max=i.max.map(c=>Fi(c,e.getComponentType()))),i.normalized&&(i.min=i.min.map(c=>$l(c,i.componentType)),i.max=i.max.map(c=>$l(c,i.componentType)))}else i.byteStride%4&&(i.array=Um(i.array,e.getElementSize()),i.byteStride=i.array.byteLength/e.getCount());return i}function Dm(e){let t=e.getComponentType(),r=e.getArray(),a=new Float32Array(r.length);for(let s=0;s<r.length;s++)a[s]=Fi(r[s],t);return a}function Um(e,t){let r=X.padNumber(e.BYTES_PER_ELEMENT*t)/e.BYTES_PER_ELEMENT,a=e.length/t,s=new e.constructor(a*r);for(let n=0;n*t<e.length;n++)for(let i=0;i<t;i++)s[n*r+i]=e[n*t+i];return s}function Gm(e){let t=new Float32Array(e.length*4/3);for(let r=0,a=e.length/3;r<a;r++)t[r*4]=e[r*3],t[r*4+1]=e[r*3+1],t[r*4+2]=e[r*3+2];return t}function zm(e,t){return t===Ft.BufferViewUsage.ELEMENT_ARRAY_BUFFER?e.listParents().some(r=>r instanceof ia&&r.getMode()===ia.Mode.TRIANGLES)?"TRIANGLES":"INDICES":"ATTRIBUTES"}function Km(e,t){let r=t.getGraph().listParentEdges(e).filter(a=>!(a.getParent()instanceof Ni));for(let a of r){let s=a.getName(),n=a.getAttributes().key||"",i=a.getParent().propertyType===F.PRIMITIVE_TARGET;if(s==="indices")return{filter:"NONE"};if(s==="attributes"){if(n==="POSITION")return{filter:"NONE"};if(n==="TEXCOORD_0")return{filter:"NONE"};if(n.startsWith("JOINTS_"))return{filter:"NONE"};if(n.startsWith("WEIGHTS_"))return{filter:"NONE"};if(n==="NORMAL"||n==="TANGENT")return i?{filter:"NONE"}:{filter:"OCTAHEDRAL",bits:8}}if(s==="output"){let o=fd(e);return o==="rotation"?{filter:"QUATERNION",bits:16}:o==="translation"?{filter:"EXPONENTIAL",bits:12}:o==="scale"?{filter:"EXPONENTIAL",bits:12}:{filter:"NONE"}}if(s==="input")return{filter:"NONE"};if(s==="inverseBindMatrices")return{filter:"NONE"}}return{filter:"NONE"}}function fd(e){for(let t of e.listParents())if(t instanceof Ss){for(let r of t.listParents())if(r instanceof Ri)return r.getTargetPath()}return null}var Yl={method:"quantize"},Li=class extends oe{extensionName=He;prereadTypes=[F.BUFFER,F.PRIMITIVE];prewriteTypes=[F.BUFFER,F.ACCESSOR];readDependencies=["meshopt.decoder"];writeDependencies=["meshopt.encoder"];static EXTENSION_NAME=He;static EncoderMethod=Om;_decoder=null;_decoderFallbackBufferMap=new Map;_encoder=null;_encoderOptions=Yl;_encoderFallbackBuffer=null;_encoderBufferViews={};_encoderBufferViewData={};_encoderBufferViewAccessors={};install(e,t){return e==="meshopt.decoder"&&(this._decoder=t),e==="meshopt.encoder"&&(this._encoder=t),this}setEncoderOptions(e){return this._encoderOptions={...Yl,...e},this}preread(e,t){if(!this._decoder){if(!this.isRequired())return this;throw new Error(`[${He}] Please install extension dependency, "meshopt.decoder".`)}if(!this._decoder.supported){if(!this.isRequired())return this;throw new Error(`[${He}]: Missing WASM support.`)}return t===F.BUFFER?this._prereadBuffers(e):t===F.PRIMITIVE&&this._prereadPrimitives(e),this}_prereadBuffers(e){let t=e.jsonDoc;(t.json.bufferViews||[]).forEach((r,a)=>{if(!r.extensions||!r.extensions.EXT_meshopt_compression)return;let s=r.extensions[He],n=s.byteOffset||0,i=s.byteLength||0,o=s.count,c=s.byteStride,l=new Uint8Array(o*c),f=t.json.buffers[s.buffer],d=f.uri?t.resources[f.uri]:t.resources[Pt],p=X.toView(d,n,i);this._decoder.decodeGltfBuffer(l,o,c,p,s.mode,s.filter),e.bufferViews[a]=l})}_prereadPrimitives(e){let t=e.jsonDoc;(t.json.bufferViews||[]).forEach(r=>{if(!r.extensions||!r.extensions.EXT_meshopt_compression)return;let a=r.extensions[He],s=e.buffers[a.buffer],n=e.buffers[r.buffer],i=t.json.buffers[r.buffer];Fm(i)&&this._decoderFallbackBufferMap.set(n,s)})}read(e){if(!this.isRequired())return this;for(let[t,r]of this._decoderFallbackBufferMap){for(let a of t.listParents())a instanceof V&&a.swap(t,r);t.dispose()}return this}prewrite(e,t){return t===F.ACCESSOR?this._prewriteAccessors(e):t===F.BUFFER&&this._prewriteBuffers(e),this}_prewriteAccessors(e){let t=e.jsonDoc.json,r=this._encoder,a=this._encoderOptions,s=this.document.getGraph(),n=this.document.createBuffer(),i=this.document.getRoot().listBuffers().indexOf(n),o=1,c=new Map,l=f=>{for(let d of s.listParents(f)){if(d.propertyType===F.ROOT)continue;let p=c.get(f);return p===void 0&&c.set(f,p=o++),p}return-1};this._encoderFallbackBuffer=n,this._encoderBufferViews={},this._encoderBufferViewData={},this._encoderBufferViewAccessors={};for(let f of this.document.getRoot().listAccessors()){if(fd(f)==="weights"||f.getSparse())continue;let d=e.getAccessorUsage(f),p=e.accessorUsageGroupedByParent.has(d)?l(f):null,b=zm(f,d),h=a.method==="filter"?Km(f,this.document):{filter:"NONE"},u=Lm(f,r,b,h),{array:m,byteStride:g}=u,y=f.getBuffer();if(!y)throw new Error(`${He}: Missing buffer for accessor.`);let x=this.document.getRoot().listBuffers().indexOf(y),v=[d,p,b,h.filter,g,x].join(":"),E=this._encoderBufferViews[v],S=this._encoderBufferViewData[v],T=this._encoderBufferViewAccessors[v];(!E||!S)&&(T=this._encoderBufferViewAccessors[v]=[],S=this._encoderBufferViewData[v]=[],E=this._encoderBufferViews[v]={buffer:i,target:Ft.USAGE_TO_TARGET[d],byteOffset:0,byteLength:0,byteStride:d===Ft.BufferViewUsage.ARRAY_BUFFER?g:void 0,extensions:{[He]:{buffer:x,byteOffset:0,byteLength:0,mode:b,filter:h.filter!=="NONE"?h.filter:void 0,byteStride:g,count:0}}});let _=e.createAccessorDef(f);_.componentType=u.componentType,_.normalized=u.normalized,_.byteOffset=E.byteLength,_.min&&u.min&&(_.min=u.min),_.max&&u.max&&(_.max=u.max),e.accessorIndexMap.set(f,t.accessors.length),t.accessors.push(_),T.push(_),S.push(new Uint8Array(m.buffer,m.byteOffset,m.byteLength)),E.byteLength+=m.byteLength,E.extensions.EXT_meshopt_compression.count+=f.getCount()}}_prewriteBuffers(e){let t=this._encoder;for(let r in this._encoderBufferViews){let a=this._encoderBufferViews[r],s=this._encoderBufferViewData[r],n=this.document.getRoot().listBuffers()[a.extensions[He].buffer],i=e.otherBufferViews.get(n)||[],{count:o,byteStride:c,mode:l}=a.extensions[He],f=X.concat(s),d=t.encodeGltfBuffer(f,o,c,l),p=X.pad(d);a.extensions[He].byteLength=d.byteLength,s.length=0,s.push(p),i.push(p),e.otherBufferViews.set(n,i)}}write(e){let t=0;for(let n in this._encoderBufferViews){let i=this._encoderBufferViews[n],o=this._encoderBufferViewData[n][0],c=e.otherBufferViewsIndexMap.get(o),l=this._encoderBufferViewAccessors[n];for(let b of l)b.bufferView=c;let f=e.jsonDoc.json.bufferViews[c],d=f.byteOffset||0;Object.assign(f,i),f.byteOffset=t;let p=f.extensions[He];p.byteOffset=d,t+=X.padNumber(i.byteLength)}let r=this._encoderFallbackBuffer,a=e.bufferIndexMap.get(r),s=e.jsonDoc.json.buffers[a];return s.byteLength=t,s.extensions={[He]:{fallback:!0}},r.dispose(),this}},Vm=class extends J{static EXTENSION_NAME=W;init(){this.extensionName=W,this.propertyType="StructuralMetadata",this.parentTypes=[F.ROOT]}getDefaults(){return Object.assign(super.getDefaults(),{schema:null,schemaUri:"",propertyTables:new Ce,propertyTextures:new Ce,propertyAttributes:new Ce})}getSchema(){return this.getRef("schema")}setSchema(e){return this.setRef("schema",e)}getSchemaUri(){return this.get("schemaUri")}setSchemaUri(e){return this.set("schemaUri",e)}listPropertyTables(){return this.listRefs("propertyTables")}addPropertyTable(e){return this.addRef("propertyTables",e)}removePropertyTable(e){return this.removeRef("propertyTables",e)}listPropertyTextures(){return this.listRefs("propertyTextures")}addPropertyTexture(e){return this.addRef("propertyTextures",e)}removePropertyTexture(e){return this.removeRef("propertyTextures",e)}listPropertyAttributes(){return this.listRefs("propertyAttributes")}addPropertyAttribute(e){return this.addRef("propertyAttributes",e)}removePropertyAttribute(e){return this.removeRef("propertyAttributes",e)}},Hm=class extends J{static EXTENSION_NAME=W;init(){this.extensionName=W,this.propertyType="Schema",this.parentTypes=["StructuralMetadata"]}getDefaults(){return Object.assign(super.getDefaults(),{description:"",version:"",classes:new Me,enums:new Me})}getId(){return this.get("id")}setId(e){return this.set("id",e)}getDescription(){return this.get("description")}setDescription(e){return this.set("description",e)}getVersion(){return this.get("version")}setVersion(e){return this.set("version",e)}setClass(e,t){return this.setRefMap("classes",e,t)}getClass(e){return this.getRefMap("classes",e)}listClassKeys(){return this.listRefMapKeys("classes")}listClassValues(){return this.listRefMapValues("classes")}setEnum(e,t){return this.setRefMap("enums",e,t)}getEnum(e){return this.getRefMap("enums",e)}listEnumKeys(){return this.listRefMapKeys("enums")}listEnumValues(){return this.listRefMapValues("enums")}},qm=class extends J{static EXTENSION_NAME=W;init(){this.extensionName=W,this.propertyType="Class",this.parentTypes=["Schema"]}getDefaults(){return Object.assign(super.getDefaults(),{description:"",properties:new Me})}getDescription(){return this.get("description")}setDescription(e){return this.set("description",e)}setProperty(e,t){return this.setRefMap("properties",e,t)}getProperty(e){return this.getRefMap("properties",e)}listPropertyKeys(){return this.listRefMapKeys("properties")}listPropertyValues(){return this.listRefMapValues("properties")}},Wm=class extends J{static EXTENSION_NAME=W;init(){this.extensionName=W,this.propertyType="ClassProperty",this.parentTypes=["Class"]}getDefaults(){return Object.assign(super.getDefaults(),{description:"",componentType:null,enumType:null,array:null,count:null,normalized:null,offset:null,scale:null,max:null,min:null,required:null,noData:null,default:null})}getDescription(){return this.get("description")}setDescription(e){return this.set("description",e)}getType(){return this.get("type")}setType(e){return this.set("type",e)}getComponentType(){return this.get("componentType")}setComponentType(e){return this.set("componentType",e)}getEnumType(){return this.get("enumType")}setEnumType(e){return this.set("enumType",e)}getArray(){return this.get("array")}setArray(e){return this.set("array",e)}getCount(){return this.get("count")}setCount(e){return this.set("count",e)}getNormalized(){return this.get("normalized")}setNormalized(e){return this.set("normalized",e)}getOffset(){return this.get("offset")}setOffset(e){return this.set("offset",e)}getScale(){return this.get("scale")}setScale(e){return this.set("scale",e)}getMax(){return this.get("max")}setMax(e){return this.set("max",e)}getMin(){return this.get("min")}setMin(e){return this.set("min",e)}getRequired(){return this.get("required")}setRequired(e){return this.set("required",e)}getNoData(){return this.get("noData")}setNoData(e){return this.set("noData",e)}getDefault(){return this.get("default")}setDefault(e){return this.set("default",e)}},Xm=class extends J{static EXTENSION_NAME=W;init(){this.extensionName=W,this.propertyType="Enum",this.parentTypes=["Schema"]}getDefaults(){return Object.assign(super.getDefaults(),{description:"",valueType:"UINT16",values:new Ce})}getDescription(){return this.get("description")}setDescription(e){return this.set("description",e)}getValueType(){return this.get("valueType")}setValueType(e){return this.set("valueType",e)}listValues(){return this.listRefs("values")}addEnumValue(e){return this.addRef("values",e)}removeEnumValue(e){return this.removeRef("values",e)}},$m=class extends J{static EXTENSION_NAME=W;init(){this.extensionName=W,this.propertyType="EnumValue",this.parentTypes=["Enum"]}getDefaults(){return Object.assign(super.getDefaults(),{description:null})}getDescription(){return this.get("description")}setDescription(e){return this.set("description",e)}getValue(){return this.get("value")}setValue(e){return this.set("value",e)}},Ym=class extends J{static EXTENSION_NAME=W;init(){this.extensionName=W,this.propertyType="PropertyTable",this.parentTypes=["StructuralMetadata"]}getDefaults(){return Object.assign(super.getDefaults(),{properties:new Me})}getClass(){return this.get("class")}setClass(e){return this.set("class",e)}getCount(){return this.get("count")}setCount(e){return this.set("count",e)}setProperty(e,t){return this.setRefMap("properties",e,t)}getProperty(e){return this.getRefMap("properties",e)}listPropertyKeys(){return this.listRefMapKeys("properties")}listPropertyValues(){return this.listRefMapValues("properties")}},Jm=class extends J{static EXTENSION_NAME=W;init(){this.extensionName=W,this.propertyType="PropertyTableProperty",this.parentTypes=["PropertyTable"]}getDefaults(){return Object.assign(super.getDefaults(),{arrayOffsets:null,stringOffsets:null,arrayOffsetType:null,stringOffsetType:null,offset:null,scale:null,max:null,min:null})}getValues(){return this.get("values")}setValues(e){return this.set("values",e)}getArrayOffsets(){return this.get("arrayOffsets")}setArrayOffsets(e){return this.set("arrayOffsets",e)}getStringOffsets(){return this.get("stringOffsets")}setStringOffsets(e){return this.set("stringOffsets",e)}getArrayOffsetType(){return this.get("arrayOffsetType")}setArrayOffsetType(e){return this.set("arrayOffsetType",e)}getStringOffsetType(){return this.get("stringOffsetType")}setStringOffsetType(e){return this.set("stringOffsetType",e)}getOffset(){return this.get("offset")}setOffset(e){return this.set("offset",e)}getScale(){return this.get("scale")}setScale(e){return this.set("scale",e)}getMax(){return this.get("max")}setMax(e){return this.set("max",e)}getMin(){return this.get("min")}setMin(e){return this.set("min",e)}},Qm=class extends J{static EXTENSION_NAME=W;init(){this.extensionName=W,this.propertyType="PropertyTexture",this.parentTypes=["StructuralMetadata"]}getDefaults(){return Object.assign(super.getDefaults(),{properties:new Me})}getClass(){return this.get("class")}setClass(e){return this.set("class",e)}setProperty(e,t){return this.setRefMap("properties",e,t)}getProperty(e){return this.getRefMap("properties",e)}listPropertyKeys(){return this.listRefMapKeys("properties")}listPropertyValues(){return this.listRefMapValues("properties")}},Zm=class extends J{static EXTENSION_NAME=W;init(){this.extensionName=W,this.propertyType="PropertyTextureProperty",this.parentTypes=["PropertyTexture"]}getDefaults(){let e=new ue(this.graph,"textureInfo");return e.setMinFilter(ue.MagFilter.NEAREST),e.setMagFilter(ue.MagFilter.NEAREST),Object.assign(super.getDefaults(),{channels:[0],texture:null,textureInfo:e,offset:null,scale:null,max:null,min:null})}getChannels(){return this.get("channels")}setChannels(e){return this.set("channels",e)}getTexture(){return this.getRef("texture")}setTexture(e){return this.setRef("texture",e)}getTextureInfo(){return this.getRef("texture")?this.getRef("textureInfo"):null}getOffset(){return this.get("offset")}setOffset(e){return this.set("offset",e)}getScale(){return this.get("scale")}setScale(e){return this.set("scale",e)}getMax(){return this.get("max")}setMax(e){return this.set("max",e)}getMin(){return this.get("min")}setMin(e){return this.set("min",e)}},ey=class extends J{static EXTENSION_NAME=W;init(){this.extensionName=W,this.propertyType="PropertyAttribute",this.parentTypes=["StructuralMetadata"]}getDefaults(){return Object.assign(super.getDefaults(),{properties:new Me})}getClass(){return this.get("class")}setClass(e){return this.set("class",e)}setProperty(e,t){return this.setRefMap("properties",e,t)}getProperty(e){return this.getRefMap("properties",e)}listPropertyKeys(){return this.listRefMapKeys("properties")}listPropertyValues(){return this.listRefMapValues("properties")}},ty=class extends J{static EXTENSION_NAME=W;init(){this.extensionName=W,this.propertyType="PropertyAttributeProperty",this.parentTypes=["PropertyAttribute"]}getDefaults(){return Object.assign(super.getDefaults(),{offset:null,scale:null,max:null,min:null})}getAttribute(){return this.get("attribute")}setAttribute(e){return this.set("attribute",e)}getOffset(){return this.get("offset")}setOffset(e){return this.set("offset",e)}getScale(){return this.get("scale")}setScale(e){return this.set("scale",e)}getMax(){return this.get("max")}setMax(e){return this.set("max",e)}getMin(){return this.get("min")}setMin(e){return this.set("min",e)}},ry=class extends J{static EXTENSION_NAME=W;init(){this.extensionName=W,this.propertyType="NodeStructuralMetadata",this.parentTypes=[F.NODE]}getDefaults(){return Object.assign(super.getDefaults(),{class:"",properties:{}})}getClass(){return this.get("class")}setClass(e){return this.set("class",e)}getProperties(){return this.get("properties")}setProperties(e){return this.set("properties",e)}},ay=class extends J{static EXTENSION_NAME=W;init(){this.extensionName=W,this.propertyType="MeshPrimitiveStructuralMetadata",this.parentTypes=[F.PRIMITIVE]}getDefaults(){return Object.assign(super.getDefaults(),{propertyTextures:new Ce,propertyAttributes:new Ce})}listPropertyTextures(){return this.listRefs("propertyTextures")}addPropertyTexture(e){return this.addRef("propertyTextures",e)}removePropertyTexture(e){return this.removeRef("propertyTextures",e)}listPropertyAttributes(){return this.listRefs("propertyAttributes")}addPropertyAttribute(e){return this.addRef("propertyAttributes",e)}removePropertyAttribute(e){return this.removeRef("propertyAttributes",e)}},sy=class extends oe{extensionName=W;static EXTENSION_NAME=W;prewriteTypes=[F.BUFFER];prereadTypes=[F.SCENE];createStructuralMetadata(){return new Vm(this.document.getGraph())}createSchema(){return new Hm(this.document.getGraph())}createClass(){return new qm(this.document.getGraph())}createClassProperty(){return new Wm(this.document.getGraph())}createEnum(){return new Xm(this.document.getGraph())}createEnumValue(){return new $m(this.document.getGraph())}createPropertyTable(){return new Ym(this.document.getGraph())}createPropertyTableProperty(){return new Jm(this.document.getGraph())}createPropertyTexture(){return new Qm(this.document.getGraph())}createPropertyTextureProperty(){return new Zm(this.document.getGraph())}createPropertyAttribute(){return new ey(this.document.getGraph())}createPropertyAttributeProperty(){return new ty(this.document.getGraph())}createNodeStructuralMetadata(){return new ry(this.document.getGraph())}createMeshPrimitiveStructuralMetadata(){return new ay(this.document.getGraph())}read(e){return this}preread(e){let t=this.document.getRoot(),{json:r}=e.jsonDoc,a=r.extensions[W],s=ny(this,e,a);return t.setExtension(W,s),(r.meshes||[]).forEach((n,i)=>{let o=e.meshes[i].listPrimitives();(n.primitives||[]).forEach((c,l)=>{let f=o[l];this._readPrimitive(s,f,c)})}),(r.nodes||[]).forEach((n,i)=>{this._readNode(e.nodes[i],n)}),this}_readPrimitive(e,t,r){if(!r.extensions||!r.extensions.EXT_structural_metadata)return;let a=this.createMeshPrimitiveStructuralMetadata(),s=r.extensions[W],n=e.listPropertyTextures(),i=s.propertyTextures||[];for(let l of i){let f=n[l];a.addPropertyTexture(f)}let o=e.listPropertyAttributes(),c=s.propertyAttributes||[];for(let l of c){let f=o[l];a.addPropertyAttribute(f)}t.setExtension(W,a)}_readNode(e,t){if(!t.extensions||!t.extensions.EXT_structural_metadata)return;let r=t.extensions[W],a=this.createNodeStructuralMetadata().setClass(r.class).setProperties(r.properties);e.setExtension(W,a)}write(e){let t=this.document.getRoot(),r=t.getExtension(W);if(!r)return this;let a=e.jsonDoc.json,s=my(e,r);a.extensions=a.extensions||{},a.extensions[W]=s;let n=t.listMeshes(),i=a.meshes;if(i)for(let l of n){let f=i[e.meshIndexMap.get(l)];l.listPrimitives().forEach((d,p)=>{let b=f.primitives[p];this._writePrimitive(r,d,b)})}let o=t.listNodes(),c=a.nodes;if(c)for(let l of o){let f=e.nodeIndexMap.get(l);this._writeNode(l,c[f])}return this}_writePrimitive(e,t,r){let a=t.getExtension(W);if(!a)return;let s=e.listPropertyTextures(),n=e.listPropertyAttributes(),i,o,c=a.listPropertyTextures();if(c.length>0){i=[];for(let d of c){let p=s.indexOf(d);if(p>=0)i.push(p);else throw new Error(`${W}: Invalid property texture in mesh primitive`)}}let l=a.listPropertyAttributes();if(l.length>0){o=[];for(let d of l){let p=n.indexOf(d);if(p>=0)o.push(p);else throw new Error(`${W}: Invalid property attribute in mesh primitive`)}}let f={propertyTextures:i,propertyAttributes:o};r.extensions=r.extensions||{},r.extensions[W]=f}_writeNode(e,t){let r=e.getExtension("EXT_structural_metadata");r&&(t.extensions=t.extensions||{},t.extensions[W]={class:r.getClass(),properties:r.getProperties()})}prewrite(e,t){return t===F.BUFFER&&this._prewriteBuffers(e),this}_prewriteBuffers(e){let t=this.document,r=t.getRoot().getExtension(W);e.jsonDoc.json.bufferViews||=[];for(let a of r.listPropertyTables())for(let s of a.listPropertyValues()){let n=Iy(t,e);n.push(s.getValues());let i=s.getArrayOffsets();i&&n.push(i);let o=s.getStringOffsets();o&&n.push(o)}}};function ny(e,t,r){let a=e.createStructuralMetadata();if(r.schema!==void 0){let o=iy(e,r.schema);a.setSchema(o)}else if(r.schemaUri){let o=r.schemaUri;a.setSchemaUri(o)}let s=r.propertyTextures||[];for(let o of s){let c=uy(e,t,o);a.addPropertyTexture(c)}let n=r.propertyTables||[];for(let o of n){let c=hy(e,t,o);a.addPropertyTable(c)}let i=r.propertyAttributes||[];for(let o of i){let c=py(e,o);a.addPropertyAttribute(c)}return a}function iy(e,t){let r=e.createSchema().setId(t.id);t.name!==void 0&&r.setName(t.name),t.description!==void 0&&r.setDescription(t.description),t.version!==void 0&&r.setVersion(t.version);let a=t.classes||{};for(let n of Object.keys(a)){let i=a[n];r.setClass(n,oy(e,i))}let s=t.enums||{};for(let n of Object.keys(s))r.setEnum(n,ly(e,s[n]));return r}function oy(e,t){let r=e.createClass();t.name!==void 0&&r.setName(t.name),t.description!==void 0&&r.setDescription(t.description);let a=t.properties||{};for(let s of Object.keys(a)){let n=cy(e,a[s]);r.setProperty(s,n)}return r}function cy(e,t){let r=e.createClassProperty().setType(t.type);return t.name!==void 0&&r.setName(t.name),t.description!==void 0&&r.setDescription(t.description),t.componentType!==void 0&&r.setComponentType(t.componentType),t.enumType!==void 0&&r.setEnumType(t.enumType),t.array!==void 0&&r.setArray(t.array),t.count!==void 0&&r.setCount(t.count),t.normalized!==void 0&&r.setNormalized(t.normalized),t.offset!==void 0&&r.setOffset(t.offset),t.scale!==void 0&&r.setScale(t.scale),t.max!==void 0&&r.setMax(t.max),t.min!==void 0&&r.setMin(t.min),t.required!==void 0&&r.setRequired(t.required),t.noData!==void 0&&r.setNoData(t.noData),t.default!==void 0&&r.setDefault(t.default),r}function ly(e,t){let r=e.createEnum();t.name!==void 0&&r.setName(t.name),t.description!==void 0&&r.setDescription(t.description),t.valueType!==void 0&&r.setValueType(t.valueType);let a=t.values||{};for(let s of a)r.addEnumValue(dy(e,s));return r}function dy(e,t){let r=e.createEnumValue();return t.name!==void 0&&r.setName(t.name),t.description!==void 0&&r.setDescription(t.description),t.value!==void 0&&r.setValue(t.value),r}function uy(e,t,r){let a=e.createPropertyTexture();a.setClass(r.class),r.name!==void 0&&a.setName(r.name);let s=r.properties||{};for(let n of Object.keys(s)){let i=fy(e,t,s[n]);a.setProperty(n,i)}return a}function fy(e,t,r){let a=e.createPropertyTextureProperty(),s=t.jsonDoc.json.textures||[];r.channels&&a.setChannels(r.channels);let n=s[r.index].source;if(n!==void 0){let i=t.textures[n];a.setTexture(i);let o=a.getTextureInfo();o&&t.setTextureInfo(o,r)}return r.offset!==void 0&&a.setOffset(r.offset),r.scale!==void 0&&a.setScale(r.scale),r.max!==void 0&&a.setMax(r.max),r.min!==void 0&&a.setMin(r.min),a}function hy(e,t,r){let a=e.createPropertyTable().setClass(r.class).setCount(r.count);r.name!==void 0&&a.setName(r.name);let s=r.properties||{};for(let n of Object.keys(s)){let i=by(e,t,s[n]);a.setProperty(n,i)}return a}function by(e,t,r){let a=e.createPropertyTableProperty(),s=Ci(t,r.values);if(a.setValues(s),r.arrayOffsets!==void 0){let n=Ci(t,r.arrayOffsets);a.setArrayOffsets(n)}if(r.stringOffsets!==void 0){let n=Ci(t,r.stringOffsets);a.setStringOffsets(n)}return r.arrayOffsetType!==void 0&&a.setArrayOffsetType(r.arrayOffsetType),r.stringOffsetType!==void 0&&a.setStringOffsetType(r.stringOffsetType),r.offset!==void 0&&a.setOffset(r.offset),r.scale!==void 0&&a.setScale(r.scale),r.max!==void 0&&a.setMax(r.max),r.min!==void 0&&a.setMin(r.min),a}function py(e,t){let r=e.createPropertyAttribute();r.setClass(t.class),t.name!==void 0&&r.setName(t.name);let a=t.properties||{};for(let s of Object.keys(a)){let n=gy(e,a[s]);r.setProperty(s,n)}return r}function gy(e,t){let r=e.createPropertyAttributeProperty();return r.setAttribute(t.attribute),t.offset!==void 0&&r.setOffset(t.offset),t.scale!==void 0&&r.setScale(t.scale),t.max!==void 0&&r.setMax(t.max),t.min!==void 0&&r.setMin(t.min),r}function my(e,t){let r={},a=t.getSchema();a&&(r.schema=yy(a));let s=t.getSchemaUri();s&&(r.schemaUri=s);let n=t.listPropertyTables();if(n.length>0){let c=[];for(let l of n){let f=ky(e,l);c.push(f)}r.propertyTables=c}let i=t.listPropertyTextures();if(i.length>0){let c=[];for(let l of i){let f=Ay(e,l);c.push(f)}r.propertyTextures=c}let o=t.listPropertyAttributes();if(o.length>0){let c=[];for(let l of o){let f=Sy(l);c.push(f)}r.propertyAttributes=c}return r}function yy(e){let t={id:e.getId()},r=e.listClassKeys();if(r.length>0){t.classes={};for(let s of r){let n=xy(e.getClass(s));t.classes[s]=n}}let a=e.listEnumKeys();if(a.length>0){t.enums={};for(let s of a){let n=vy(e.getEnum(s));t.enums[s]=n}}return e.getName()&&(t.name=e.getName()),e.getDescription()&&(t.description=e.getDescription()),e.getVersion()&&(t.version=e.getVersion()),t}function xy(e){let t={},r=e.listPropertyKeys();if(r.length>0){t.properties={};for(let a of r){let s=e.getProperty(a);t.properties[a]=wy(s)}}return e.getName()&&(t.name=e.getName()),e.getDescription()&&(t.description=e.getDescription()),t}function wy(e){let t={type:e.getType()};return e.getArray()&&(t.array=e.getArray()),e.getNormalized()&&(t.normalized=e.getNormalized()),e.getRequired()&&(t.required=e.getRequired()),e.getName()&&(t.name=e.getName()),e.getDescription()&&(t.description=e.getDescription()),e.getComponentType()!=null&&(t.componentType=e.getComponentType()),e.getEnumType()!=null&&(t.enumType=e.getEnumType()),e.getCount()!=null&&(t.count=e.getCount()),e.getOffset()!=null&&(t.offset=e.getOffset()),e.getScale()!=null&&(t.scale=e.getScale()),e.getMax()!=null&&(t.max=e.getMax()),e.getMin()!=null&&(t.min=e.getMin()),e.getNoData()!=null&&(t.noData=e.getNoData()),e.getDefault()!=null&&(t.default=e.getDefault()),t}function vy(e){let t={values:e.listValues().map(My)};return e.getName()&&(t.name=e.getName()),e.getDescription()&&(t.description=e.getDescription()),e.getValueType()!=="UINT16"&&(t.valueType=e.getValueType()),t}function My(e){let t={name:e.getName(),value:e.getValue()};return e.getDescription()&&(t.description=e.getDescription()),t}function ky(e,t){let r={class:t.getClass(),count:t.getCount()};t.getName()&&(r.name=t.getName());let a=t.listPropertyKeys();if(a.length>0){r.properties={};for(let s of a){let n=Ey(e,t.getProperty(s));r.properties[s]=n}}return r}function Ey(e,t){let r=t.getValues(),a={values:e.otherBufferViewsIndexMap.get(r)};if(t.getArrayOffsets()){let s=t.getArrayOffsets();a.arrayOffsets=e.otherBufferViewsIndexMap.get(s)}if(t.getStringOffsets()){let s=t.getStringOffsets();a.stringOffsets=e.otherBufferViewsIndexMap.get(s)}return t.getArrayOffsetType()!=null&&(a.arrayOffsetType=t.getArrayOffsetType()),t.getStringOffsetType()!=null&&(a.stringOffsetType=t.getStringOffsetType()),t.getOffset()!=null&&(a.offset=t.getOffset()),t.getScale()!=null&&(a.scale=t.getScale()),t.getMax()!=null&&(a.max=t.getMax()),t.getMin()!=null&&(a.min=t.getMin()),a}function Sy(e){let t={class:e.getClass()};e.getName()&&(t.name=e.getName());let r=e.listPropertyKeys();if(r.length>0){t.properties={};for(let a of r){let s=Ty(e.getProperty(a));t.properties[a]=s}}return t}function Ty(e){let t={attribute:e.getAttribute()};return e.getOffset()!=null&&(t.offset=e.getOffset()),e.getScale()!=null&&(t.scale=e.getScale()),e.getMax()!=null&&(t.max=e.getMax()),e.getMin()!=null&&(t.min=e.getMin()),t}function Ay(e,t){let r={class:t.getClass()};t.getName()&&(r.name=t.getName());let a=t.listPropertyKeys();if(a.length>0){r.properties={};for(let s of a){let n=_y(e,t.getProperty(s));r.properties[s]=n}}return r}function _y(e,t){let r=t.getTexture(),a=t.getTextureInfo(),s=t.getChannels(),n=e.createTextureInfoDef(r,a);return pe.eq(s,[0])||(n.channels=s),t.getOffset()!=null&&(n.offset=t.getOffset()),t.getScale()!=null&&(n.scale=t.getScale()),t.getMax()!=null&&(n.max=t.getMax()),t.getMin()!=null&&(n.min=t.getMin()),n}function Ci(e,t){let r=e.jsonDoc,a=r.json.buffers||[],s=(r.json.bufferViews||[])[t],n=a[s.buffer],i=n.uri?r.resources[n.uri]:r.resources[Pt],o=s.byteOffset||0,c=s.byteLength;return i.slice(o,o+c)}function Iy(e,t){let r=e.getRoot().listBuffers()[0],a=t.otherBufferViews.get(r);return a||(a=[],t.otherBufferViews.set(r,a)),a}var Ry=class{match(e){return e.length>=12&&X.decodeText(e.slice(4,12))==="ftypavif"}getSize(e){if(!this.match(e))return null;let t=new DataView(e.buffer,e.byteOffset,e.byteLength),r=Jl(t,0);if(!r)return null;let a=r.end;for(;r=Jl(t,a);)if(r.type==="meta")a=r.start+4;else if(r.type==="iprp"||r.type==="ipco")a=r.start;else{if(r.type==="ispe")return[t.getUint32(r.start+4),t.getUint32(r.start+8)];if(r.type==="mdat")break;a=r.end}return null}getChannels(e){return 4}},Ny=class extends oe{extensionName=Is;prereadTypes=[F.TEXTURE];static EXTENSION_NAME=Is;static register(){ht.registerFormat("image/avif",new Ry)}preread(e){return(e.jsonDoc.json.textures||[]).forEach(t=>{t.extensions&&t.extensions.EXT_texture_avif&&(t.source=t.extensions[Is].source)}),this}read(e){return this}write(e){let t=e.jsonDoc;return this.document.getRoot().listTextures().forEach(r=>{if(r.getMimeType()==="image/avif"){let a=e.imageIndexMap.get(r);(t.json.textures||[]).forEach(s=>{s.source===a&&(s.extensions=s.extensions||{},s.extensions[Is]={source:s.source},delete s.source)})}}),this}};function Jl(e,t){if(e.byteLength<4+t)return null;let r=e.getUint32(t);return e.byteLength<r+t||r<8?null:{type:X.decodeText(new Uint8Array(e.buffer,e.byteOffset+t+4,4)),start:t+8,end:t+r}}var Cy=class{match(e){return e.length>=12&&e[8]===87&&e[9]===69&&e[10]===66&&e[11]===80}getSize(e){let t=X.decodeText(e.slice(0,4)),r=X.decodeText(e.slice(8,12));if(t!=="RIFF"||r!=="WEBP")return null;let a=new DataView(e.buffer,e.byteOffset),s=12;for(;s<a.byteLength;){let n=X.decodeText(new Uint8Array([a.getUint8(s),a.getUint8(s+1),a.getUint8(s+2),a.getUint8(s+3)])),i=a.getUint32(s+4,!0);if(n==="VP8 ")return[a.getInt16(s+14,!0)&16383,a.getInt16(s+16,!0)&16383];if(n==="VP8L"){let o=a.getUint8(s+9),c=a.getUint8(s+10),l=a.getUint8(s+11),f=a.getUint8(s+12);return[1+((c&63)<<8|o),1+((f&15)<<10|l<<2|(c&192)>>6)]}s+=8+i+i%2}return null}getChannels(e){return 4}},By=class extends oe{extensionName=_s;prereadTypes=[F.TEXTURE];static EXTENSION_NAME=_s;static register(){ht.registerFormat("image/webp",new Cy)}preread(e){return(e.jsonDoc.json.textures||[]).forEach(t=>{t.extensions&&t.extensions.EXT_texture_webp&&(t.source=t.extensions[_s].source)}),this}read(e){return this}write(e){let t=e.jsonDoc;return this.document.getRoot().listTextures().forEach(r=>{if(r.getMimeType()==="image/webp"){let a=e.imageIndexMap.get(r);(t.json.textures||[]).forEach(s=>{s.source===a&&(s.extensions=s.extensions||{},s.extensions[_s]={source:s.source},delete s.source)})}}),this}},Ql=Em,Oy=class extends oe{extensionName=Ql;static EXTENSION_NAME=Ql;read(e){return this}write(e){return this}},Zl=Sm,Fy=class extends oe{extensionName=Zl;static EXTENSION_NAME=Zl;read(e){return this}write(e){return this}},Ee,hd,bd;function Py(e,t){let r=new Ee.DecoderBuffer;try{if(r.Init(t,t.length),e.GetEncodedGeometryType(r)!==Ee.TRIANGULAR_MESH)throw new Error(`[${xe}] Unknown geometry type.`);let a=new Ee.Mesh;if(!e.DecodeBufferToMesh(r,a).ok()||a.ptr===0)throw new Error(`[${xe}] Decoding failure.`);return a}finally{Ee.destroy(r)}}function jy(e,t){let r=t.num_faces()*3,a,s;if(t.num_points()<=65534){let n=r*Uint16Array.BYTES_PER_ELEMENT;a=Ee._malloc(n),e.GetTrianglesUInt16Array(t,n,a),s=new Uint16Array(Ee.HEAPU16.buffer,a,r).slice()}else{let n=r*Uint32Array.BYTES_PER_ELEMENT;a=Ee._malloc(n),e.GetTrianglesUInt32Array(t,n,a),s=new Uint32Array(Ee.HEAPU32.buffer,a,r).slice()}return Ee._free(a),s}function Ly(e,t,r,a){let s=bd[a.componentType],n=hd[a.componentType],i=r.num_components(),o=t.num_points()*i,c=o*n.BYTES_PER_ELEMENT,l=Ee._malloc(c);e.GetAttributeDataArrayForAllPoints(t,r,s,c,l);let f=new n(Ee.HEAPF32.buffer,l,o).slice();return Ee._free(l),f}function Dy(e){Ee=e,hd={[V.ComponentType.FLOAT]:Float32Array,[V.ComponentType.UNSIGNED_INT]:Uint32Array,[V.ComponentType.UNSIGNED_SHORT]:Uint16Array,[V.ComponentType.UNSIGNED_BYTE]:Uint8Array,[V.ComponentType.SHORT]:Int16Array,[V.ComponentType.BYTE]:Int8Array},bd={[V.ComponentType.FLOAT]:Ee.DT_FLOAT32,[V.ComponentType.UNSIGNED_INT]:Ee.DT_UINT32,[V.ComponentType.UNSIGNED_SHORT]:Ee.DT_UINT16,[V.ComponentType.UNSIGNED_BYTE]:Ee.DT_UINT8,[V.ComponentType.SHORT]:Ee.DT_INT16,[V.ComponentType.BYTE]:Ee.DT_INT8}}var et,Uy=(function(e){return e[e.EDGEBREAKER=1]="EDGEBREAKER",e[e.SEQUENTIAL=0]="SEQUENTIAL",e})({}),pd={POSITION:14,NORMAL:10,COLOR:8,TEX_COORD:12,GENERIC:12},ed={decodeSpeed:5,encodeSpeed:5,method:1,quantizationBits:pd,quantizationVolume:"mesh"};function Gy(e){et=e}function zy(e,t=ed){let r={...ed,...t};r.quantizationBits={...pd,...t.quantizationBits};let a=new et.MeshBuilder,s=new et.Mesh,n=new et.ExpertEncoder(s),i={},o=new et.DracoInt8Array,c=e.listTargets().length>0,l=!1;for(let u of e.listSemantics()){let m=e.getAttribute(u);if(m.getSparse()){l=!0;continue}let g=Ky(u),y=Vy(a,m.getComponentType(),s,et[g],m.getCount(),m.getElementSize(),m.getArray());if(y===-1)throw new Error(`Error compressing "${u}" attribute.`);if(i[u]=y,r.quantizationVolume==="mesh"||u!=="POSITION")n.SetAttributeQuantization(y,r.quantizationBits[g]);else if(typeof r.quantizationVolume=="object"){let{quantizationVolume:x}=r,v=Math.max(x.max[0]-x.min[0],x.max[1]-x.min[1],x.max[2]-x.min[2]);n.SetAttributeExplicitQuantization(y,r.quantizationBits[g],m.getElementSize(),x.min,v)}else throw new Error("Invalid quantization volume state.")}let f=e.getIndices();if(!f)throw new Pi("Primitive must have indices.");a.AddFacesToMesh(s,f.getCount()/3,f.getArray()),n.SetSpeedOptions(r.encodeSpeed,r.decodeSpeed),n.SetTrackEncodedProperties(!0),r.method===0||c||l?n.SetEncodingMethod(et.MESH_SEQUENTIAL_ENCODING):n.SetEncodingMethod(et.MESH_EDGEBREAKER_ENCODING);let d=n.EncodeToDracoBuffer(!(c||l),o);if(d<=0)throw new Pi("Error applying Draco compression.");let p=new Uint8Array(d);for(let u=0;u<d;++u)p[u]=o.GetValue(u);let b=n.GetNumberOfEncodedPoints(),h=n.GetNumberOfEncodedFaces()*3;return et.destroy(o),et.destroy(s),et.destroy(a),et.destroy(n),{numVertices:b,numIndices:h,data:p,attributeIDs:i}}function Ky(e){return e==="POSITION"?"POSITION":e==="NORMAL"?"NORMAL":e.startsWith("COLOR_")?"COLOR":e.startsWith("TEXCOORD_")?"TEX_COORD":"GENERIC"}function Vy(e,t,r,a,s,n,i){switch(t){case V.ComponentType.UNSIGNED_BYTE:return e.AddUInt8Attribute(r,a,s,n,i);case V.ComponentType.BYTE:return e.AddInt8Attribute(r,a,s,n,i);case V.ComponentType.UNSIGNED_SHORT:return e.AddUInt16Attribute(r,a,s,n,i);case V.ComponentType.SHORT:return e.AddInt16Attribute(r,a,s,n,i);case V.ComponentType.UNSIGNED_INT:return e.AddUInt32Attribute(r,a,s,n,i);case V.ComponentType.FLOAT:return e.AddFloatAttribute(r,a,s,n,i);default:throw new Error(`Unexpected component type, "${t}".`)}}var Pi=class extends Error{},Hy=class extends oe{extensionName=xe;prereadTypes=[F.PRIMITIVE];prewriteTypes=[F.ACCESSOR];readDependencies=["draco3d.decoder"];writeDependencies=["draco3d.encoder"];static EXTENSION_NAME=xe;static EncoderMethod=Uy;_decoderModule=null;_encoderModule=null;_encoderOptions={};install(e,t){return e==="draco3d.decoder"&&(this._decoderModule=t,Dy(this._decoderModule)),e==="draco3d.encoder"&&(this._encoderModule=t,Gy(this._encoderModule)),this}setEncoderOptions(e){return this._encoderOptions=e,this}preread(e){if(!this._decoderModule)throw new Error(`[${xe}] Please install extension dependency, "draco3d.decoder".`);let t=this.document.getLogger(),r=e.jsonDoc,a=new Map;try{let s=r.json.meshes||[];for(let n of s)for(let i of n.primitives){if(!i.extensions||!i.extensions.KHR_draco_mesh_compression)continue;let o=i.extensions[xe],[c,l]=a.get(o.bufferView)||[];if(!l||!c){let f=r.json.bufferViews[o.bufferView],d=r.json.buffers[f.buffer],p=d.uri?r.resources[d.uri]:r.resources[Pt],b=f.byteOffset||0,h=f.byteLength,u=X.toView(p,b,h);c=new this._decoderModule.Decoder,l=Py(c,u),a.set(o.bufferView,[c,l]),t.debug(`[${xe}] Decompressed ${u.byteLength} bytes.`)}for(let f in o.attributes){let d=e.jsonDoc.json.accessors[i.attributes[f]],p=c.GetAttributeByUniqueId(l,o.attributes[f]),b=Ly(c,l,p,d);e.accessors[i.attributes[f]].setArray(b)}i.indices!==void 0&&e.accessors[i.indices].setArray(jy(c,l))}}finally{for(let[s,n]of Array.from(a.values()))this._decoderModule.destroy(s),this._decoderModule.destroy(n)}return this}read(e){return this}prewrite(e,t){if(!this._encoderModule)throw new Error(`[${xe}] Please install extension dependency, "draco3d.encoder".`);let r=this.document.getLogger();r.debug(`[${xe}] Compression options: ${JSON.stringify(this._encoderOptions)}`);let a=qy(this.document),s=new Map,n="mesh";this._encoderOptions.quantizationVolume==="scene"&&(this.document.getRoot().listScenes().length!==1?r.warn(`[${xe}]: quantizationVolume=scene requires exactly 1 scene.`):n=Al(this.document.getRoot().listScenes().pop()));for(let i of Array.from(a.keys())){let o=a.get(i);if(!o)throw new Error("Unexpected primitive.");if(s.has(o)){s.set(o,s.get(o));continue}let c=i.getIndices(),l=e.jsonDoc.json.accessors,f;try{f=zy(i,{...this._encoderOptions,quantizationVolume:n})}catch(b){if(b instanceof Pi){r.warn(`[${xe}]: ${b.message} Skipping primitive compression.`);continue}throw b}s.set(o,f);let d=e.createAccessorDef(c);d.count=f.numIndices,e.accessorIndexMap.set(c,l.length),l.push(d),f.numVertices>65534&&V.getComponentSize(d.componentType)<=2?d.componentType=V.ComponentType.UNSIGNED_INT:f.numVertices>254&&V.getComponentSize(d.componentType)<=1&&(d.componentType=V.ComponentType.UNSIGNED_SHORT);for(let b of i.listSemantics()){let h=i.getAttribute(b);if(f.attributeIDs[b]===void 0)continue;let u=e.createAccessorDef(h);u.count=f.numVertices,e.accessorIndexMap.set(h,l.length),l.push(u)}let p=i.getAttribute("POSITION").getBuffer()||this.document.getRoot().listBuffers()[0];e.otherBufferViews.has(p)||e.otherBufferViews.set(p,[]),e.otherBufferViews.get(p).push(f.data)}return r.debug(`[${xe}] Compressed ${a.size} primitives.`),e.extensionData[xe]={primitiveHashMap:a,primitiveEncodingMap:s},this}write(e){let t=e.extensionData[xe];for(let r of this.document.getRoot().listMeshes()){let a=e.jsonDoc.json.meshes[e.meshIndexMap.get(r)];for(let s=0;s<r.listPrimitives().length;s++){let n=r.listPrimitives()[s],i=a.primitives[s],o=t.primitiveHashMap.get(n);if(!o)continue;let c=t.primitiveEncodingMap.get(o);c&&(i.extensions=i.extensions||{},i.extensions[xe]={bufferView:e.otherBufferViewsIndexMap.get(c.data),attributes:c.attributeIDs})}}if(!t.primitiveHashMap.size){let r=e.jsonDoc.json;r.extensionsUsed=(r.extensionsUsed||[]).filter(a=>a!==xe),r.extensionsRequired=(r.extensionsRequired||[]).filter(a=>a!==xe)}return this}};function qy(e){let t=e.getLogger(),r=new Set,a=new Set,s=0,n=0;for(let d of e.getRoot().listMeshes())for(let p of d.listPrimitives())p.getIndices()?p.getMode()!==ia.Mode.TRIANGLES?(a.add(p),n++):r.add(p):(a.add(p),s++);s>0&&t.warn(`[${xe}] Skipping Draco compression of ${s} non-indexed primitives.`),n>0&&t.warn(`[${xe}] Skipping Draco compression of ${n} non-TRIANGLES primitives.`);let i=e.getRoot().listAccessors(),o=new Map;for(let d=0;d<i.length;d++)o.set(i[d],d);let c=new Map,l=new Set,f=new Map;for(let d of Array.from(r)){let p=td(d,o);if(l.has(p)){f.set(d,p);continue}if(c.has(d.getIndices())){let b=d.getIndices(),h=b.clone();o.set(h,e.getRoot().listAccessors().length-1),d.swap(b,h)}for(let b of d.listAttributes())if(c.has(b)){let h=b.clone();o.set(h,e.getRoot().listAccessors().length-1),d.swap(b,h)}p=td(d,o),l.add(p),f.set(d,p),c.set(d.getIndices(),p);for(let b of d.listAttributes())c.set(b,p)}for(let d of Array.from(c.keys())){let p=new Set(d.listParents().map(b=>b.propertyType));if(p.size!==2||!p.has(F.PRIMITIVE)||!p.has(F.ROOT))throw new Error(`[${xe}] Compressed accessors must only be used as indices or vertex attributes.`)}for(let d of Array.from(r)){let p=f.get(d),b=d.getIndices();if(c.get(b)!==p||d.listAttributes().some(h=>c.get(h)!==p))throw new Error(`[${xe}] Draco primitives must share all, or no, accessors.`)}for(let d of Array.from(a)){let p=d.getIndices();if(c.has(p)||d.listAttributes().some(b=>c.has(b)))throw new Error(`[${xe}] Accessor cannot be shared by compressed and uncompressed primitives.`)}return f}function td(e,t){let r=[],a=e.getIndices();r.push(t.get(a));for(let s of e.listAttributes())r.push(t.get(s));return r.sort().join("|")}var rd=class gd extends J{static EXTENSION_NAME=Mt;static Type={POINT:"point",SPOT:"spot",DIRECTIONAL:"directional"};init(){this.extensionName=Mt,this.propertyType="Light",this.parentTypes=[F.NODE]}getDefaults(){return Object.assign(super.getDefaults(),{color:[1,1,1],intensity:1,type:gd.Type.POINT,range:null,innerConeAngle:0,outerConeAngle:Math.PI/4})}getColor(){return this.get("color")}setColor(t){return this.set("color",t)}getIntensity(){return this.get("intensity")}setIntensity(t){return this.set("intensity",t)}getType(){return this.get("type")}setType(t){return this.set("type",t)}getRange(){return this.get("range")}setRange(t){return this.set("range",t)}getInnerConeAngle(){return this.get("innerConeAngle")}setInnerConeAngle(t){return this.set("innerConeAngle",t)}getOuterConeAngle(){return this.get("outerConeAngle")}setOuterConeAngle(t){return this.set("outerConeAngle",t)}},Wy=class extends oe{extensionName=Mt;static EXTENSION_NAME=Mt;createLight(e=""){return new rd(this.document.getGraph(),e)}read(e){let t=e.jsonDoc;if(!t.json.extensions||!t.json.extensions.KHR_lights_punctual)return this;let r=(t.json.extensions.KHR_lights_punctual.lights||[]).map(a=>{let s=this.createLight().setName(a.name||"").setType(a.type);return a.extras&&s.setExtras(a.extras),a.color!==void 0&&s.setColor(a.color),a.intensity!==void 0&&s.setIntensity(a.intensity),a.range!==void 0&&s.setRange(a.range),a.spot?.innerConeAngle!==void 0&&s.setInnerConeAngle(a.spot.innerConeAngle),a.spot?.outerConeAngle!==void 0&&s.setOuterConeAngle(a.spot.outerConeAngle),s});return t.json.nodes.forEach((a,s)=>{if(!a.extensions||!a.extensions.KHR_lights_punctual)return;let n=a.extensions[Mt];e.nodes[s].setExtension(Mt,r[n.light])}),this}write(e){let t=e.jsonDoc;if(this.properties.size===0)return this;let r=[],a=new Map;for(let s of this.properties){let n=s,i=e.createPropertyDef(s);i.type=n.getType(),pe.eq(n.getColor(),[1,1,1])||(i.color=n.getColor()),n.getIntensity()!==1&&(i.intensity=n.getIntensity()),n.getRange()!=null&&(i.range=n.getRange()),n.getName()&&(i.name=n.getName()),n.getType()===rd.Type.SPOT&&(i.spot={innerConeAngle:n.getInnerConeAngle(),outerConeAngle:n.getOuterConeAngle()}),r.push(i),a.set(n,r.length-1)}return this.document.getRoot().listNodes().forEach(s=>{let n=s.getExtension(Mt);if(n){let i=e.nodeIndexMap.get(s),o=t.json.nodes[i];o.extensions=o.extensions||{},o.extensions[Mt]={light:a.get(n)}}}),t.json.extensions=t.json.extensions||{},t.json.extensions[Mt]={lights:r},this}},{R:Xy,G:$y,B:Yy}=ot,Jy=class extends J{static EXTENSION_NAME=Dt;init(){this.extensionName=Dt,this.propertyType="Anisotropy",this.parentTypes=[F.MATERIAL]}getDefaults(){return Object.assign(super.getDefaults(),{anisotropyStrength:0,anisotropyRotation:0,anisotropyTexture:null,anisotropyTextureInfo:new ue(this.graph,"anisotropyTextureInfo")})}getAnisotropyStrength(){return this.get("anisotropyStrength")}setAnisotropyStrength(e){return this.set("anisotropyStrength",e)}getAnisotropyRotation(){return this.get("anisotropyRotation")}setAnisotropyRotation(e){return this.set("anisotropyRotation",e)}getAnisotropyTexture(){return this.getRef("anisotropyTexture")}getAnisotropyTextureInfo(){return this.getRef("anisotropyTexture")?this.getRef("anisotropyTextureInfo"):null}setAnisotropyTexture(e){return this.setRef("anisotropyTexture",e,{channels:Xy|$y|Yy})}},Qy=class extends oe{static EXTENSION_NAME=Dt;extensionName=Dt;prereadTypes=[F.MESH];prewriteTypes=[F.MESH];createAnisotropy(){return new Jy(this.document.getGraph())}read(e){return this}write(e){return this}preread(e){let t=e.jsonDoc,r=t.json.materials||[],a=t.json.textures||[];return r.forEach((s,n)=>{if(s.extensions&&s.extensions.KHR_materials_anisotropy){let i=this.createAnisotropy();e.materials[n].setExtension(Dt,i);let o=s.extensions[Dt];if(o.extras&&i.setExtras(o.extras),o.anisotropyStrength!==void 0&&i.setAnisotropyStrength(o.anisotropyStrength),o.anisotropyRotation!==void 0&&i.setAnisotropyRotation(o.anisotropyRotation),o.anisotropyTexture!==void 0){let c=o.anisotropyTexture,l=e.textures[a[c.index].source];i.setAnisotropyTexture(l),e.setTextureInfo(i.getAnisotropyTextureInfo(),c)}}}),this}prewrite(e){let t=e.jsonDoc;return this.document.getRoot().listMaterials().forEach(r=>{let a=r.getExtension(Dt);if(a){let s=e.materialIndexMap.get(r),n=t.json.materials[s],i=e.createPropertyDef(a);if(n.extensions=n.extensions||{},n.extensions[Dt]=i,a.getAnisotropyStrength()>0&&(i.anisotropyStrength=a.getAnisotropyStrength()),a.getAnisotropyRotation()!==0&&(i.anisotropyRotation=a.getAnisotropyRotation()),a.getAnisotropyTexture()){let o=a.getAnisotropyTexture(),c=a.getAnisotropyTextureInfo();i.anisotropyTexture=e.createTextureInfoDef(o,c)}}}),this}},{R:ad,G:sd,B:Zy}=ot,e0=class extends J{static EXTENSION_NAME=Ut;init(){this.extensionName=Ut,this.propertyType="Clearcoat",this.parentTypes=[F.MATERIAL]}getDefaults(){return Object.assign(super.getDefaults(),{clearcoatFactor:0,clearcoatTexture:null,clearcoatTextureInfo:new ue(this.graph,"clearcoatTextureInfo"),clearcoatRoughnessFactor:0,clearcoatRoughnessTexture:null,clearcoatRoughnessTextureInfo:new ue(this.graph,"clearcoatRoughnessTextureInfo"),clearcoatNormalScale:1,clearcoatNormalTexture:null,clearcoatNormalTextureInfo:new ue(this.graph,"clearcoatNormalTextureInfo")})}getClearcoatFactor(){return this.get("clearcoatFactor")}setClearcoatFactor(e){return this.set("clearcoatFactor",e)}getClearcoatTexture(){return this.getRef("clearcoatTexture")}getClearcoatTextureInfo(){return this.getRef("clearcoatTexture")?this.getRef("clearcoatTextureInfo"):null}setClearcoatTexture(e){return this.setRef("clearcoatTexture",e,{channels:ad})}getClearcoatRoughnessFactor(){return this.get("clearcoatRoughnessFactor")}setClearcoatRoughnessFactor(e){return this.set("clearcoatRoughnessFactor",e)}getClearcoatRoughnessTexture(){return this.getRef("clearcoatRoughnessTexture")}getClearcoatRoughnessTextureInfo(){return this.getRef("clearcoatRoughnessTexture")?this.getRef("clearcoatRoughnessTextureInfo"):null}setClearcoatRoughnessTexture(e){return this.setRef("clearcoatRoughnessTexture",e,{channels:sd})}getClearcoatNormalScale(){return this.get("clearcoatNormalScale")}setClearcoatNormalScale(e){return this.set("clearcoatNormalScale",e)}getClearcoatNormalTexture(){return this.getRef("clearcoatNormalTexture")}getClearcoatNormalTextureInfo(){return this.getRef("clearcoatNormalTexture")?this.getRef("clearcoatNormalTextureInfo"):null}setClearcoatNormalTexture(e){return this.setRef("clearcoatNormalTexture",e,{channels:ad|sd|Zy})}},t0=class extends oe{static EXTENSION_NAME=Ut;extensionName=Ut;prereadTypes=[F.MESH];prewriteTypes=[F.MESH];createClearcoat(){return new e0(this.document.getGraph())}read(e){return this}write(e){return this}preread(e){let t=e.jsonDoc,r=t.json.materials||[],a=t.json.textures||[];return r.forEach((s,n)=>{if(s.extensions&&s.extensions.KHR_materials_clearcoat){let i=this.createClearcoat();e.materials[n].setExtension(Ut,i);let o=s.extensions[Ut];if(o.extras&&i.setExtras(o.extras),o.clearcoatFactor!==void 0&&i.setClearcoatFactor(o.clearcoatFactor),o.clearcoatRoughnessFactor!==void 0&&i.setClearcoatRoughnessFactor(o.clearcoatRoughnessFactor),o.clearcoatTexture!==void 0){let c=o.clearcoatTexture,l=e.textures[a[c.index].source];i.setClearcoatTexture(l),e.setTextureInfo(i.getClearcoatTextureInfo(),c)}if(o.clearcoatRoughnessTexture!==void 0){let c=o.clearcoatRoughnessTexture,l=e.textures[a[c.index].source];i.setClearcoatRoughnessTexture(l),e.setTextureInfo(i.getClearcoatRoughnessTextureInfo(),c)}if(o.clearcoatNormalTexture!==void 0){let c=o.clearcoatNormalTexture,l=e.textures[a[c.index].source];i.setClearcoatNormalTexture(l),e.setTextureInfo(i.getClearcoatNormalTextureInfo(),c),c.scale!==void 0&&i.setClearcoatNormalScale(c.scale)}}}),this}prewrite(e){let t=e.jsonDoc;return this.document.getRoot().listMaterials().forEach(r=>{let a=r.getExtension(Ut);if(a){let s=e.materialIndexMap.get(r),n=t.json.materials[s],i=e.createPropertyDef(a);if(n.extensions=n.extensions||{},n.extensions[Ut]=i,i.clearcoatFactor=a.getClearcoatFactor(),i.clearcoatRoughnessFactor=a.getClearcoatRoughnessFactor(),a.getClearcoatTexture()){let o=a.getClearcoatTexture(),c=a.getClearcoatTextureInfo();i.clearcoatTexture=e.createTextureInfoDef(o,c)}if(a.getClearcoatRoughnessTexture()){let o=a.getClearcoatRoughnessTexture(),c=a.getClearcoatRoughnessTextureInfo();i.clearcoatRoughnessTexture=e.createTextureInfoDef(o,c)}if(a.getClearcoatNormalTexture()){let o=a.getClearcoatNormalTexture(),c=a.getClearcoatNormalTextureInfo();i.clearcoatNormalTexture=e.createTextureInfoDef(o,c),a.getClearcoatNormalScale()!==1&&(i.clearcoatNormalTexture.scale=a.getClearcoatNormalScale())}}}),this}},{R:r0,G:a0,B:s0,A:n0}=ot,i0=class extends J{static EXTENSION_NAME=Gt;init(){this.extensionName=Gt,this.propertyType="DiffuseTransmission",this.parentTypes=[F.MATERIAL]}getDefaults(){return Object.assign(super.getDefaults(),{diffuseTransmissionFactor:0,diffuseTransmissionTexture:null,diffuseTransmissionTextureInfo:new ue(this.graph,"diffuseTransmissionTextureInfo"),diffuseTransmissionColorFactor:[1,1,1],diffuseTransmissionColorTexture:null,diffuseTransmissionColorTextureInfo:new ue(this.graph,"diffuseTransmissionColorTextureInfo")})}getDiffuseTransmissionFactor(){return this.get("diffuseTransmissionFactor")}setDiffuseTransmissionFactor(e){return this.set("diffuseTransmissionFactor",e)}getDiffuseTransmissionTexture(){return this.getRef("diffuseTransmissionTexture")}getDiffuseTransmissionTextureInfo(){return this.getRef("diffuseTransmissionTexture")?this.getRef("diffuseTransmissionTextureInfo"):null}setDiffuseTransmissionTexture(e){return this.setRef("diffuseTransmissionTexture",e,{channels:n0})}getDiffuseTransmissionColorFactor(){return this.get("diffuseTransmissionColorFactor")}setDiffuseTransmissionColorFactor(e){return this.set("diffuseTransmissionColorFactor",e)}getDiffuseTransmissionColorTexture(){return this.getRef("diffuseTransmissionColorTexture")}getDiffuseTransmissionColorTextureInfo(){return this.getRef("diffuseTransmissionColorTexture")?this.getRef("diffuseTransmissionColorTextureInfo"):null}setDiffuseTransmissionColorTexture(e){return this.setRef("diffuseTransmissionColorTexture",e,{channels:r0|a0|s0})}},o0=class extends oe{extensionName=Gt;static EXTENSION_NAME=Gt;createDiffuseTransmission(){return new i0(this.document.getGraph())}read(e){let t=e.jsonDoc,r=t.json.materials||[],a=t.json.textures||[];return r.forEach((s,n)=>{if(s.extensions&&s.extensions.KHR_materials_diffuse_transmission){let i=this.createDiffuseTransmission();e.materials[n].setExtension(Gt,i);let o=s.extensions[Gt];if(o.extras&&i.setExtras(o.extras),o.diffuseTransmissionFactor!==void 0&&i.setDiffuseTransmissionFactor(o.diffuseTransmissionFactor),o.diffuseTransmissionColorFactor!==void 0&&i.setDiffuseTransmissionColorFactor(o.diffuseTransmissionColorFactor),o.diffuseTransmissionTexture!==void 0){let c=o.diffuseTransmissionTexture,l=e.textures[a[c.index].source];i.setDiffuseTransmissionTexture(l),e.setTextureInfo(i.getDiffuseTransmissionTextureInfo(),c)}if(o.diffuseTransmissionColorTexture!==void 0){let c=o.diffuseTransmissionColorTexture,l=e.textures[a[c.index].source];i.setDiffuseTransmissionColorTexture(l),e.setTextureInfo(i.getDiffuseTransmissionColorTextureInfo(),c)}}}),this}write(e){let t=e.jsonDoc;for(let r of this.document.getRoot().listMaterials()){let a=r.getExtension(Gt);if(!a)continue;let s=e.materialIndexMap.get(r),n=t.json.materials[s],i=e.createPropertyDef(a);if(n.extensions=n.extensions||{},n.extensions[Gt]=i,i.diffuseTransmissionFactor=a.getDiffuseTransmissionFactor(),i.diffuseTransmissionColorFactor=a.getDiffuseTransmissionColorFactor(),a.getDiffuseTransmissionTexture()){let o=a.getDiffuseTransmissionTexture(),c=a.getDiffuseTransmissionTextureInfo();i.diffuseTransmissionTexture=e.createTextureInfoDef(o,c)}if(a.getDiffuseTransmissionColorTexture()){let o=a.getDiffuseTransmissionColorTexture(),c=a.getDiffuseTransmissionColorTextureInfo();i.diffuseTransmissionColorTexture=e.createTextureInfoDef(o,c)}}return this}},c0=class extends J{static EXTENSION_NAME=zt;init(){this.extensionName=zt,this.propertyType="Dispersion",this.parentTypes=[F.MATERIAL]}getDefaults(){return Object.assign(super.getDefaults(),{dispersion:0})}getDispersion(){return this.get("dispersion")}setDispersion(e){return this.set("dispersion",e)}},l0=class extends oe{static EXTENSION_NAME=zt;extensionName=zt;prereadTypes=[F.MESH];prewriteTypes=[F.MESH];createDispersion(){return new c0(this.document.getGraph())}read(e){return this}write(e){return this}preread(e){return(e.jsonDoc.json.materials||[]).forEach((t,r)=>{if(t.extensions&&t.extensions.KHR_materials_dispersion){let a=this.createDispersion();e.materials[r].setExtension(zt,a);let s=t.extensions[zt];s.extras&&a.setExtras(s.extras),s.dispersion!==void 0&&a.setDispersion(s.dispersion)}}),this}prewrite(e){let t=e.jsonDoc;return this.document.getRoot().listMaterials().forEach(r=>{let a=r.getExtension(zt);if(a){let s=e.materialIndexMap.get(r),n=t.json.materials[s],i=e.createPropertyDef(a);n.extensions=n.extensions||{},n.extensions[zt]=i,i.dispersion=a.getDispersion()}}),this}},d0=class extends J{static EXTENSION_NAME=Kt;init(){this.extensionName=Kt,this.propertyType="EmissiveStrength",this.parentTypes=[F.MATERIAL]}getDefaults(){return Object.assign(super.getDefaults(),{emissiveStrength:1})}getEmissiveStrength(){return this.get("emissiveStrength")}setEmissiveStrength(e){return this.set("emissiveStrength",e)}},u0=class extends oe{static EXTENSION_NAME=Kt;extensionName=Kt;prereadTypes=[F.MESH];prewriteTypes=[F.MESH];createEmissiveStrength(){return new d0(this.document.getGraph())}read(e){return this}write(e){return this}preread(e){return(e.jsonDoc.json.materials||[]).forEach((t,r)=>{if(t.extensions&&t.extensions.KHR_materials_emissive_strength){let a=this.createEmissiveStrength();e.materials[r].setExtension(Kt,a);let s=t.extensions[Kt];s.extras&&a.setExtras(s.extras),s.emissiveStrength!==void 0&&a.setEmissiveStrength(s.emissiveStrength)}}),this}prewrite(e){let t=e.jsonDoc;return this.document.getRoot().listMaterials().forEach(r=>{let a=r.getExtension(Kt);if(a){let s=e.materialIndexMap.get(r),n=t.json.materials[s],i=e.createPropertyDef(a);n.extensions=n.extensions||{},n.extensions[Kt]=i,i.emissiveStrength=a.getEmissiveStrength()}}),this}},f0=class extends J{static EXTENSION_NAME=Vt;init(){this.extensionName=Vt,this.propertyType="IOR",this.parentTypes=[F.MATERIAL]}getDefaults(){return Object.assign(super.getDefaults(),{ior:1.5})}getIOR(){return this.get("ior")}setIOR(e){return this.set("ior",e)}},h0=class extends oe{static EXTENSION_NAME=Vt;extensionName=Vt;prereadTypes=[F.MESH];prewriteTypes=[F.MESH];createIOR(){return new f0(this.document.getGraph())}read(e){return this}write(e){return this}preread(e){return(e.jsonDoc.json.materials||[]).forEach((t,r)=>{if(t.extensions&&t.extensions.KHR_materials_ior){let a=this.createIOR();e.materials[r].setExtension(Vt,a);let s=t.extensions[Vt];s.extras&&a.setExtras(s.extras),s.ior!==void 0&&a.setIOR(s.ior)}}),this}prewrite(e){let t=e.jsonDoc;return this.document.getRoot().listMaterials().forEach(r=>{let a=r.getExtension(Vt);if(a){let s=e.materialIndexMap.get(r),n=t.json.materials[s],i=e.createPropertyDef(a);n.extensions=n.extensions||{},n.extensions[Vt]=i,i.ior=a.getIOR()}}),this}},{R:b0,G:p0}=ot,g0=class extends J{static EXTENSION_NAME=Ht;init(){this.extensionName=Ht,this.propertyType="Iridescence",this.parentTypes=[F.MATERIAL]}getDefaults(){return Object.assign(super.getDefaults(),{iridescenceFactor:0,iridescenceTexture:null,iridescenceTextureInfo:new ue(this.graph,"iridescenceTextureInfo"),iridescenceIOR:1.3,iridescenceThicknessMinimum:100,iridescenceThicknessMaximum:400,iridescenceThicknessTexture:null,iridescenceThicknessTextureInfo:new ue(this.graph,"iridescenceThicknessTextureInfo")})}getIridescenceFactor(){return this.get("iridescenceFactor")}setIridescenceFactor(e){return this.set("iridescenceFactor",e)}getIridescenceTexture(){return this.getRef("iridescenceTexture")}getIridescenceTextureInfo(){return this.getRef("iridescenceTexture")?this.getRef("iridescenceTextureInfo"):null}setIridescenceTexture(e){return this.setRef("iridescenceTexture",e,{channels:b0})}getIridescenceIOR(){return this.get("iridescenceIOR")}setIridescenceIOR(e){return this.set("iridescenceIOR",e)}getIridescenceThicknessMinimum(){return this.get("iridescenceThicknessMinimum")}setIridescenceThicknessMinimum(e){return this.set("iridescenceThicknessMinimum",e)}getIridescenceThicknessMaximum(){return this.get("iridescenceThicknessMaximum")}setIridescenceThicknessMaximum(e){return this.set("iridescenceThicknessMaximum",e)}getIridescenceThicknessTexture(){return this.getRef("iridescenceThicknessTexture")}getIridescenceThicknessTextureInfo(){return this.getRef("iridescenceThicknessTexture")?this.getRef("iridescenceThicknessTextureInfo"):null}setIridescenceThicknessTexture(e){return this.setRef("iridescenceThicknessTexture",e,{channels:p0})}},m0=class extends oe{static EXTENSION_NAME=Ht;extensionName=Ht;prereadTypes=[F.MESH];prewriteTypes=[F.MESH];createIridescence(){return new g0(this.document.getGraph())}read(e){return this}write(e){return this}preread(e){let t=e.jsonDoc,r=t.json.materials||[],a=t.json.textures||[];return r.forEach((s,n)=>{if(s.extensions&&s.extensions.KHR_materials_iridescence){let i=this.createIridescence();e.materials[n].setExtension(Ht,i);let o=s.extensions[Ht];if(o.extras&&i.setExtras(o.extras),o.iridescenceFactor!==void 0&&i.setIridescenceFactor(o.iridescenceFactor),o.iridescenceIor!==void 0&&i.setIridescenceIOR(o.iridescenceIor),o.iridescenceThicknessMinimum!==void 0&&i.setIridescenceThicknessMinimum(o.iridescenceThicknessMinimum),o.iridescenceThicknessMaximum!==void 0&&i.setIridescenceThicknessMaximum(o.iridescenceThicknessMaximum),o.iridescenceTexture!==void 0){let c=o.iridescenceTexture,l=e.textures[a[c.index].source];i.setIridescenceTexture(l),e.setTextureInfo(i.getIridescenceTextureInfo(),c)}if(o.iridescenceThicknessTexture!==void 0){let c=o.iridescenceThicknessTexture,l=e.textures[a[c.index].source];i.setIridescenceThicknessTexture(l),e.setTextureInfo(i.getIridescenceThicknessTextureInfo(),c)}}}),this}prewrite(e){let t=e.jsonDoc;return this.document.getRoot().listMaterials().forEach(r=>{let a=r.getExtension(Ht);if(a){let s=e.materialIndexMap.get(r),n=t.json.materials[s],i=e.createPropertyDef(a);if(n.extensions=n.extensions||{},n.extensions[Ht]=i,a.getIridescenceFactor()>0&&(i.iridescenceFactor=a.getIridescenceFactor()),a.getIridescenceIOR()!==1.3&&(i.iridescenceIor=a.getIridescenceIOR()),a.getIridescenceThicknessMinimum()!==100&&(i.iridescenceThicknessMinimum=a.getIridescenceThicknessMinimum()),a.getIridescenceThicknessMaximum()!==400&&(i.iridescenceThicknessMaximum=a.getIridescenceThicknessMaximum()),a.getIridescenceTexture()){let o=a.getIridescenceTexture(),c=a.getIridescenceTextureInfo();i.iridescenceTexture=e.createTextureInfoDef(o,c)}if(a.getIridescenceThicknessTexture()){let o=a.getIridescenceThicknessTexture(),c=a.getIridescenceThicknessTextureInfo();i.iridescenceThicknessTexture=e.createTextureInfoDef(o,c)}}}),this}},{R:nd,G:id,B:od,A:cd}=ot,y0=class extends J{static EXTENSION_NAME=qt;init(){this.extensionName=qt,this.propertyType="PBRSpecularGlossiness",this.parentTypes=[F.MATERIAL]}getDefaults(){return Object.assign(super.getDefaults(),{diffuseFactor:[1,1,1,1],diffuseTexture:null,diffuseTextureInfo:new ue(this.graph,"diffuseTextureInfo"),specularFactor:[1,1,1],glossinessFactor:1,specularGlossinessTexture:null,specularGlossinessTextureInfo:new ue(this.graph,"specularGlossinessTextureInfo")})}getDiffuseFactor(){return this.get("diffuseFactor")}setDiffuseFactor(e){return this.set("diffuseFactor",e)}getDiffuseTexture(){return this.getRef("diffuseTexture")}getDiffuseTextureInfo(){return this.getRef("diffuseTexture")?this.getRef("diffuseTextureInfo"):null}setDiffuseTexture(e){return this.setRef("diffuseTexture",e,{channels:nd|id|od|cd,isColor:!0})}getSpecularFactor(){return this.get("specularFactor")}setSpecularFactor(e){return this.set("specularFactor",e)}getGlossinessFactor(){return this.get("glossinessFactor")}setGlossinessFactor(e){return this.set("glossinessFactor",e)}getSpecularGlossinessTexture(){return this.getRef("specularGlossinessTexture")}getSpecularGlossinessTextureInfo(){return this.getRef("specularGlossinessTexture")?this.getRef("specularGlossinessTextureInfo"):null}setSpecularGlossinessTexture(e){return this.setRef("specularGlossinessTexture",e,{channels:nd|id|od|cd})}},x0=class extends oe{static EXTENSION_NAME=qt;extensionName=qt;prereadTypes=[F.MESH];prewriteTypes=[F.MESH];createPBRSpecularGlossiness(){return new y0(this.document.getGraph())}read(e){return this}write(e){return this}preread(e){let t=e.jsonDoc,r=t.json.materials||[],a=t.json.textures||[];return r.forEach((s,n)=>{if(s.extensions&&s.extensions.KHR_materials_pbrSpecularGlossiness){let i=this.createPBRSpecularGlossiness();e.materials[n].setExtension(qt,i);let o=s.extensions[qt];if(o.extras&&i.setExtras(o.extras),o.diffuseFactor!==void 0&&i.setDiffuseFactor(o.diffuseFactor),o.specularFactor!==void 0&&i.setSpecularFactor(o.specularFactor),o.glossinessFactor!==void 0&&i.setGlossinessFactor(o.glossinessFactor),o.diffuseTexture!==void 0){let c=o.diffuseTexture,l=e.textures[a[c.index].source];i.setDiffuseTexture(l),e.setTextureInfo(i.getDiffuseTextureInfo(),c)}if(o.specularGlossinessTexture!==void 0){let c=o.specularGlossinessTexture,l=e.textures[a[c.index].source];i.setSpecularGlossinessTexture(l),e.setTextureInfo(i.getSpecularGlossinessTextureInfo(),c)}}}),this}prewrite(e){let t=e.jsonDoc;return this.document.getRoot().listMaterials().forEach(r=>{let a=r.getExtension(qt);if(a){let s=e.materialIndexMap.get(r),n=t.json.materials[s],i=e.createPropertyDef(a);if(n.extensions=n.extensions||{},n.extensions[qt]=i,i.diffuseFactor=a.getDiffuseFactor(),i.specularFactor=a.getSpecularFactor(),i.glossinessFactor=a.getGlossinessFactor(),a.getDiffuseTexture()){let o=a.getDiffuseTexture(),c=a.getDiffuseTextureInfo();i.diffuseTexture=e.createTextureInfoDef(o,c)}if(a.getSpecularGlossinessTexture()){let o=a.getSpecularGlossinessTexture(),c=a.getSpecularGlossinessTextureInfo();i.specularGlossinessTexture=e.createTextureInfoDef(o,c)}}}),this}},{R:w0,G:v0,B:M0,A:k0}=ot,E0=class extends J{static EXTENSION_NAME=Wt;init(){this.extensionName=Wt,this.propertyType="Sheen",this.parentTypes=[F.MATERIAL]}getDefaults(){return Object.assign(super.getDefaults(),{sheenColorFactor:[0,0,0],sheenColorTexture:null,sheenColorTextureInfo:new ue(this.graph,"sheenColorTextureInfo"),sheenRoughnessFactor:0,sheenRoughnessTexture:null,sheenRoughnessTextureInfo:new ue(this.graph,"sheenRoughnessTextureInfo")})}getSheenColorFactor(){return this.get("sheenColorFactor")}setSheenColorFactor(e){return this.set("sheenColorFactor",e)}getSheenColorTexture(){return this.getRef("sheenColorTexture")}getSheenColorTextureInfo(){return this.getRef("sheenColorTexture")?this.getRef("sheenColorTextureInfo"):null}setSheenColorTexture(e){return this.setRef("sheenColorTexture",e,{channels:w0|v0|M0,isColor:!0})}getSheenRoughnessFactor(){return this.get("sheenRoughnessFactor")}setSheenRoughnessFactor(e){return this.set("sheenRoughnessFactor",e)}getSheenRoughnessTexture(){return this.getRef("sheenRoughnessTexture")}getSheenRoughnessTextureInfo(){return this.getRef("sheenRoughnessTexture")?this.getRef("sheenRoughnessTextureInfo"):null}setSheenRoughnessTexture(e){return this.setRef("sheenRoughnessTexture",e,{channels:k0})}},S0=class extends oe{static EXTENSION_NAME=Wt;extensionName=Wt;prereadTypes=[F.MESH];prewriteTypes=[F.MESH];createSheen(){return new E0(this.document.getGraph())}read(e){return this}write(e){return this}preread(e){let t=e.jsonDoc,r=t.json.materials||[],a=t.json.textures||[];return r.forEach((s,n)=>{if(s.extensions&&s.extensions.KHR_materials_sheen){let i=this.createSheen();e.materials[n].setExtension(Wt,i);let o=s.extensions[Wt];if(o.extras&&i.setExtras(o.extras),o.sheenColorFactor!==void 0&&i.setSheenColorFactor(o.sheenColorFactor),o.sheenRoughnessFactor!==void 0&&i.setSheenRoughnessFactor(o.sheenRoughnessFactor),o.sheenColorTexture!==void 0){let c=o.sheenColorTexture,l=e.textures[a[c.index].source];i.setSheenColorTexture(l),e.setTextureInfo(i.getSheenColorTextureInfo(),c)}if(o.sheenRoughnessTexture!==void 0){let c=o.sheenRoughnessTexture,l=e.textures[a[c.index].source];i.setSheenRoughnessTexture(l),e.setTextureInfo(i.getSheenRoughnessTextureInfo(),c)}}}),this}prewrite(e){let t=e.jsonDoc;return this.document.getRoot().listMaterials().forEach(r=>{let a=r.getExtension(Wt);if(a){let s=e.materialIndexMap.get(r),n=t.json.materials[s],i=e.createPropertyDef(a);if(n.extensions=n.extensions||{},n.extensions[Wt]=i,i.sheenColorFactor=a.getSheenColorFactor(),i.sheenRoughnessFactor=a.getSheenRoughnessFactor(),a.getSheenColorTexture()){let o=a.getSheenColorTexture(),c=a.getSheenColorTextureInfo();i.sheenColorTexture=e.createTextureInfoDef(o,c)}if(a.getSheenRoughnessTexture()){let o=a.getSheenRoughnessTexture(),c=a.getSheenRoughnessTextureInfo();i.sheenRoughnessTexture=e.createTextureInfoDef(o,c)}}}),this}},{R:T0,G:A0,B:_0,A:I0}=ot,R0=class extends J{static EXTENSION_NAME=Xt;init(){this.extensionName=Xt,this.propertyType="Specular",this.parentTypes=[F.MATERIAL]}getDefaults(){return Object.assign(super.getDefaults(),{specularFactor:1,specularTexture:null,specularTextureInfo:new ue(this.graph,"specularTextureInfo"),specularColorFactor:[1,1,1],specularColorTexture:null,specularColorTextureInfo:new ue(this.graph,"specularColorTextureInfo")})}getSpecularFactor(){return this.get("specularFactor")}setSpecularFactor(e){return this.set("specularFactor",e)}getSpecularColorFactor(){return this.get("specularColorFactor")}setSpecularColorFactor(e){return this.set("specularColorFactor",e)}getSpecularTexture(){return this.getRef("specularTexture")}getSpecularTextureInfo(){return this.getRef("specularTexture")?this.getRef("specularTextureInfo"):null}setSpecularTexture(e){return this.setRef("specularTexture",e,{channels:I0})}getSpecularColorTexture(){return this.getRef("specularColorTexture")}getSpecularColorTextureInfo(){return this.getRef("specularColorTexture")?this.getRef("specularColorTextureInfo"):null}setSpecularColorTexture(e){return this.setRef("specularColorTexture",e,{channels:T0|A0|_0,isColor:!0})}},N0=class extends oe{static EXTENSION_NAME=Xt;extensionName=Xt;prereadTypes=[F.MESH];prewriteTypes=[F.MESH];createSpecular(){return new R0(this.document.getGraph())}read(e){return this}write(e){return this}preread(e){let t=e.jsonDoc,r=t.json.materials||[],a=t.json.textures||[];return r.forEach((s,n)=>{if(s.extensions&&s.extensions.KHR_materials_specular){let i=this.createSpecular();e.materials[n].setExtension(Xt,i);let o=s.extensions[Xt];if(o.extras&&i.setExtras(o.extras),o.specularFactor!==void 0&&i.setSpecularFactor(o.specularFactor),o.specularColorFactor!==void 0&&i.setSpecularColorFactor(o.specularColorFactor),o.specularTexture!==void 0){let c=o.specularTexture,l=e.textures[a[c.index].source];i.setSpecularTexture(l),e.setTextureInfo(i.getSpecularTextureInfo(),c)}if(o.specularColorTexture!==void 0){let c=o.specularColorTexture,l=e.textures[a[c.index].source];i.setSpecularColorTexture(l),e.setTextureInfo(i.getSpecularColorTextureInfo(),c)}}}),this}prewrite(e){let t=e.jsonDoc;return this.document.getRoot().listMaterials().forEach(r=>{let a=r.getExtension(Xt);if(a){let s=e.materialIndexMap.get(r),n=t.json.materials[s],i=e.createPropertyDef(a);if(n.extensions=n.extensions||{},n.extensions[Xt]=i,a.getSpecularFactor()!==1&&(i.specularFactor=a.getSpecularFactor()),pe.eq(a.getSpecularColorFactor(),[1,1,1])||(i.specularColorFactor=a.getSpecularColorFactor()),a.getSpecularTexture()){let o=a.getSpecularTexture(),c=a.getSpecularTextureInfo();i.specularTexture=e.createTextureInfoDef(o,c)}if(a.getSpecularColorTexture()){let o=a.getSpecularColorTexture(),c=a.getSpecularColorTextureInfo();i.specularColorTexture=e.createTextureInfoDef(o,c)}}}),this}},{R:C0}=ot,B0=class extends J{static EXTENSION_NAME=$t;init(){this.extensionName=$t,this.propertyType="Transmission",this.parentTypes=[F.MATERIAL]}getDefaults(){return Object.assign(super.getDefaults(),{transmissionFactor:0,transmissionTexture:null,transmissionTextureInfo:new ue(this.graph,"transmissionTextureInfo")})}getTransmissionFactor(){return this.get("transmissionFactor")}setTransmissionFactor(e){return this.set("transmissionFactor",e)}getTransmissionTexture(){return this.getRef("transmissionTexture")}getTransmissionTextureInfo(){return this.getRef("transmissionTexture")?this.getRef("transmissionTextureInfo"):null}setTransmissionTexture(e){return this.setRef("transmissionTexture",e,{channels:C0})}},O0=class extends oe{static EXTENSION_NAME=$t;extensionName=$t;prereadTypes=[F.MESH];prewriteTypes=[F.MESH];createTransmission(){return new B0(this.document.getGraph())}read(e){return this}write(e){return this}preread(e){let t=e.jsonDoc,r=t.json.materials||[],a=t.json.textures||[];return r.forEach((s,n)=>{if(s.extensions&&s.extensions.KHR_materials_transmission){let i=this.createTransmission();e.materials[n].setExtension($t,i);let o=s.extensions[$t];if(o.extras&&i.setExtras(o.extras),o.transmissionFactor!==void 0&&i.setTransmissionFactor(o.transmissionFactor),o.transmissionTexture!==void 0){let c=o.transmissionTexture,l=e.textures[a[c.index].source];i.setTransmissionTexture(l),e.setTextureInfo(i.getTransmissionTextureInfo(),c)}}}),this}prewrite(e){let t=e.jsonDoc;return this.document.getRoot().listMaterials().forEach(r=>{let a=r.getExtension($t);if(a){let s=e.materialIndexMap.get(r),n=t.json.materials[s],i=e.createPropertyDef(a);if(n.extensions=n.extensions||{},n.extensions[$t]=i,i.transmissionFactor=a.getTransmissionFactor(),a.getTransmissionTexture()){let o=a.getTransmissionTexture(),c=a.getTransmissionTextureInfo();i.transmissionTexture=e.createTextureInfoDef(o,c)}}}),this}},F0=class extends J{static EXTENSION_NAME=_r;init(){this.extensionName=_r,this.propertyType="Unlit",this.parentTypes=[F.MATERIAL]}},P0=class extends oe{static EXTENSION_NAME=_r;extensionName=_r;prereadTypes=[F.MESH];prewriteTypes=[F.MESH];createUnlit(){return new F0(this.document.getGraph())}read(e){return this}write(e){return this}preread(e){return(e.jsonDoc.json.materials||[]).forEach((t,r)=>{t.extensions&&t.extensions.KHR_materials_unlit&&e.materials[r].setExtension(_r,this.createUnlit())}),this}prewrite(e){let t=e.jsonDoc;return this.document.getRoot().listMaterials().forEach(r=>{if(r.getExtension("KHR_materials_unlit")){let a=e.materialIndexMap.get(r),s=t.json.materials[a];s.extensions=s.extensions||{},s.extensions[_r]={}}}),this}},j0=class extends J{static EXTENSION_NAME=Xe;init(){this.extensionName=Xe,this.propertyType="Mapping",this.parentTypes=["MappingList"]}getDefaults(){return Object.assign(super.getDefaults(),{material:null,variants:new le})}getMaterial(){return this.getRef("material")}setMaterial(e){return this.setRef("material",e)}addVariant(e){return this.addRef("variants",e)}removeVariant(e){return this.removeRef("variants",e)}listVariants(){return this.listRefs("variants")}},L0=class extends J{static EXTENSION_NAME=Xe;init(){this.extensionName=Xe,this.propertyType="MappingList",this.parentTypes=[F.PRIMITIVE]}getDefaults(){return Object.assign(super.getDefaults(),{mappings:new le})}addMapping(e){return this.addRef("mappings",e)}removeMapping(e){return this.removeRef("mappings",e)}listMappings(){return this.listRefs("mappings")}},ld=class extends J{static EXTENSION_NAME=Xe;init(){this.extensionName=Xe,this.propertyType="Variant",this.parentTypes=["MappingList"]}},D0=class extends oe{extensionName=Xe;static EXTENSION_NAME=Xe;createMappingList(){return new L0(this.document.getGraph())}createVariant(e=""){return new ld(this.document.getGraph(),e)}createMapping(){return new j0(this.document.getGraph())}listVariants(){return Array.from(this.properties).filter(e=>e instanceof ld)}read(e){let t=e.jsonDoc;if(!t.json.extensions||!t.json.extensions.KHR_materials_variants)return this;let r=(t.json.extensions.KHR_materials_variants.variants||[]).map(a=>this.createVariant().setName(a.name||""));return(t.json.meshes||[]).forEach((a,s)=>{let n=e.meshes[s];(a.primitives||[]).forEach((i,o)=>{if(!i.extensions||!i.extensions.KHR_materials_variants)return;let c=this.createMappingList(),l=i.extensions[Xe];for(let f of l.mappings){let d=this.createMapping();f.material!==void 0&&d.setMaterial(e.materials[f.material]);for(let p of f.variants||[])d.addVariant(r[p]);c.addMapping(d)}n.listPrimitives()[o].setExtension(Xe,c)})}),this}write(e){let t=e.jsonDoc,r=this.listVariants();if(!r.length)return this;let a=[],s=new Map;for(let n of r)s.set(n,a.length),a.push(e.createPropertyDef(n));for(let n of this.document.getRoot().listMeshes()){let i=e.meshIndexMap.get(n);n.listPrimitives().forEach((o,c)=>{let l=o.getExtension(Xe);if(!l)return;let f=e.jsonDoc.json.meshes[i].primitives[c],d=l.listMappings().map(p=>{let b=e.createPropertyDef(p),h=p.getMaterial();return h&&(b.material=e.materialIndexMap.get(h)),b.variants=p.listVariants().map(u=>s.get(u)),b});f.extensions=f.extensions||{},f.extensions[Xe]={mappings:d}})}return t.json.extensions=t.json.extensions||{},t.json.extensions[Xe]={variants:a},this}},{G:U0}=ot,G0=class extends J{static EXTENSION_NAME=Yt;init(){this.extensionName=Yt,this.propertyType="Volume",this.parentTypes=[F.MATERIAL]}getDefaults(){return Object.assign(super.getDefaults(),{thicknessFactor:0,thicknessTexture:null,thicknessTextureInfo:new ue(this.graph,"thicknessTexture"),attenuationDistance:1/0,attenuationColor:[1,1,1]})}getThicknessFactor(){return this.get("thicknessFactor")}setThicknessFactor(e){return this.set("thicknessFactor",e)}getThicknessTexture(){return this.getRef("thicknessTexture")}getThicknessTextureInfo(){return this.getRef("thicknessTexture")?this.getRef("thicknessTextureInfo"):null}setThicknessTexture(e){return this.setRef("thicknessTexture",e,{channels:U0})}getAttenuationDistance(){return this.get("attenuationDistance")}setAttenuationDistance(e){return this.set("attenuationDistance",e)}getAttenuationColor(){return this.get("attenuationColor")}setAttenuationColor(e){return this.set("attenuationColor",e)}},z0=class extends oe{static EXTENSION_NAME=Yt;extensionName=Yt;prereadTypes=[F.MESH];prewriteTypes=[F.MESH];createVolume(){return new G0(this.document.getGraph())}read(e){return this}write(e){return this}preread(e){let t=e.jsonDoc,r=t.json.materials||[],a=t.json.textures||[];return r.forEach((s,n)=>{if(s.extensions&&s.extensions.KHR_materials_volume){let i=this.createVolume();e.materials[n].setExtension(Yt,i);let o=s.extensions[Yt];if(o.extras&&i.setExtras(o.extras),o.thicknessFactor!==void 0&&i.setThicknessFactor(o.thicknessFactor),o.attenuationDistance!==void 0&&i.setAttenuationDistance(o.attenuationDistance),o.attenuationColor!==void 0&&i.setAttenuationColor(o.attenuationColor),o.thicknessTexture!==void 0){let c=o.thicknessTexture,l=e.textures[a[c.index].source];i.setThicknessTexture(l),e.setTextureInfo(i.getThicknessTextureInfo(),c)}}}),this}prewrite(e){let t=e.jsonDoc;return this.document.getRoot().listMaterials().forEach(r=>{let a=r.getExtension(Yt);if(a){let s=e.materialIndexMap.get(r),n=t.json.materials[s],i=e.createPropertyDef(a);if(n.extensions=n.extensions||{},n.extensions[Yt]=i,a.getThicknessFactor()>0&&(i.thicknessFactor=a.getThicknessFactor()),Number.isFinite(a.getAttenuationDistance())&&(i.attenuationDistance=a.getAttenuationDistance()),pe.eq(a.getAttenuationColor(),[1,1,1])||(i.attenuationColor=a.getAttenuationColor()),a.getThicknessTexture()){let o=a.getThicknessTexture(),c=a.getThicknessTextureInfo();i.thicknessTexture=e.createTextureInfoDef(o,c)}}}),this}},K0=class extends oe{extensionName=ql;static EXTENSION_NAME=ql;read(e){return this}write(e){return this}},Di=class extends oe{extensionName=Wl;static EXTENSION_NAME=Wl;read(e){return this}write(e){return this}},V0=class extends J{static EXTENSION_NAME=Jt;init(){this.extensionName=Jt,this.propertyType="Visibility",this.parentTypes=[F.NODE]}getDefaults(){return Object.assign(super.getDefaults(),{visible:!0})}getVisible(){return this.get("visible")}setVisible(e){return this.set("visible",e)}},H0=class extends oe{static EXTENSION_NAME=Jt;extensionName=Jt;createVisibility(){return new V0(this.document.getGraph())}read(e){return(e.jsonDoc.json.nodes||[]).forEach((t,r)=>{if(t.extensions&&t.extensions.KHR_node_visibility){let a=this.createVisibility();e.nodes[r].setExtension(Jt,a);let s=t.extensions[Jt];s.visible!==void 0&&a.setVisible(s.visible)}}),this}write(e){let t=e.jsonDoc;for(let r of this.document.getRoot().listNodes()){let a=r.getExtension(Jt);if(!a)continue;let s=e.nodeIndexMap.get(r),n=t.json.nodes[s];n.extensions=n.extensions||{},n.extensions[Jt]={visible:a.getVisible()}}return this}};function q0(e){return e.vkFormat>0&&e.vkFormat<=123}function dd(e){let t=e.vkFormat===1000066e3&&e.dataFormatDescriptor[0].colorModel===167;return e.vkFormat===0||t}var W0=class{match(e){return e[0]===171&&e[1]===75&&e[2]===84&&e[3]===88&&e[4]===32&&e[5]===50&&e[6]===48&&e[7]===187&&e[8]===13&&e[9]===10&&e[10]===26&&e[11]===10}getSize(e){let t=As(e);return[t.pixelWidth,t.pixelHeight]}getChannels(e){let t=As(e),r=t.dataFormatDescriptor[0];if(q0(t))return r.samples.length;if(dd(t))switch(r.colorModel){case 163:return r.samples.length===2&&(r.samples[1].channelType&15)===15?4:3;case 166:return(r.samples[0].channelType&15)===3?4:3;default:throw new Error(`Unexpected KTX2 colorModel, "${r.colorModel}".`)}throw new Error(`Unexpected KTX2 vkFormat, "${t.vkFormat}".`)}getVRAMByteLength(e){let t=As(e),r=0;if(dd(t)){let a=this.getChannels(e)>3;for(let s=0;s<t.levels.length;s++){let n=t.levels[s];if(n.uncompressedByteLength)r+=n.uncompressedByteLength;else{let i=Math.max(1,Math.floor(t.pixelWidth/Math.pow(2,s))),o=Math.max(1,Math.floor(t.pixelHeight/Math.pow(2,s))),c=a?16:8;r+=i/4*(o/4)*c}}}else for(let a of t.levels)t.supercompressionScheme===0?r+=a.levelData.byteLength:r+=a.uncompressedByteLength;return r}},X0=class extends oe{static EXTENSION_NAME=Rs;extensionName=Rs;prereadTypes=[F.TEXTURE];static register(){ht.registerFormat("image/ktx2",new W0)}preread(e){return e.jsonDoc.json.textures&&e.jsonDoc.json.textures.forEach(t=>{t.extensions&&t.extensions.KHR_texture_basisu&&(t.source=t.extensions[Rs].source)}),this}read(e){return this}write(e){let t=e.jsonDoc;return this.document.getRoot().listTextures().forEach(r=>{if(r.getMimeType()==="image/ktx2"){let a=e.imageIndexMap.get(r);t.json.textures.forEach(s=>{s.source===a&&(s.extensions=s.extensions||{},s.extensions[Rs]={source:s.source},delete s.source)})}}),this}},$0=class extends J{static EXTENSION_NAME=Qt;init(){this.extensionName=Qt,this.propertyType="Transform",this.parentTypes=[F.TEXTURE_INFO]}getDefaults(){return Object.assign(super.getDefaults(),{offset:[0,0],rotation:0,scale:[1,1],texCoord:null})}getOffset(){return this.get("offset")}setOffset(e){return this.set("offset",e)}getRotation(){return this.get("rotation")}setRotation(e){return this.set("rotation",e)}getScale(){return this.get("scale")}setScale(e){return this.set("scale",e)}getTexCoord(){return this.get("texCoord")}setTexCoord(e){return this.set("texCoord",e)}},Y0=class extends oe{extensionName=Qt;static EXTENSION_NAME=Qt;createTransform(){return new $0(this.document.getGraph())}read(e){for(let[t,r]of Array.from(e.textureInfos.entries())){if(!r.extensions||!r.extensions.KHR_texture_transform)continue;let a=this.createTransform(),s=r.extensions[Qt];s.offset!==void 0&&a.setOffset(s.offset),s.rotation!==void 0&&a.setRotation(s.rotation),s.scale!==void 0&&a.setScale(s.scale),s.texCoord!==void 0&&a.setTexCoord(s.texCoord),t.setExtension(Qt,a)}return this}write(e){let t=Array.from(e.textureInfoDefMap.entries());for(let[r,a]of t){let s=r.getExtension(Qt);if(!s)continue;a.extensions=a.extensions||{};let n={},i=pe.eq;i(s.getOffset(),[0,0])||(n.offset=s.getOffset()),s.getRotation()!==0&&(n.rotation=s.getRotation()),i(s.getScale(),[1,1])||(n.scale=s.getScale()),s.getTexCoord()!=null&&(n.texCoord=s.getTexCoord()),a.extensions[Qt]=n}return this}},J0=[F.ROOT,F.SCENE,F.NODE,F.MESH,F.MATERIAL,F.TEXTURE,F.ANIMATION],Q0=class extends J{static EXTENSION_NAME=ct;init(){this.extensionName=ct,this.propertyType="Packet",this.parentTypes=J0}getDefaults(){return Object.assign(super.getDefaults(),{context:{},properties:{}})}getContext(){return this.get("context")}setContext(e){return this.set("context",{...e})}listProperties(){return Object.keys(this.get("properties"))}getProperty(e){let t=this.get("properties");return e in t?t[e]:null}setProperty(e,t){this._assertContext(e);let r={...this.get("properties")};return t?r[e]=t:delete r[e],this.set("properties",r)}toJSONLD(){return{"@context":Bi(this.get("context")),...Bi(this.get("properties"))}}fromJSONLD(e){e=Bi(e);let t=e["@context"];return t&&this.set("context",t),delete e["@context"],this.set("properties",e)}_assertContext(e){if(!(e.split(":")[0]in this.get("context")))throw new Error(`${ct}: Missing context for term, "${e}".`)}};function Bi(e){return JSON.parse(JSON.stringify(e))}var Z0=class extends oe{extensionName=ct;static EXTENSION_NAME=ct;createPacket(){return new Q0(this.document.getGraph())}listPackets(){return Array.from(this.properties)}read(e){let t=e.jsonDoc.json.extensions?.[ct];if(!t||!t.packets)return this;let r=e.jsonDoc.json,a=this.document.getRoot(),s=t.packets.map(o=>this.createPacket().fromJSONLD(o)),n=[[r.asset],r.scenes,r.nodes,r.meshes,r.materials,r.images,r.animations],i=[[a],a.listScenes(),a.listNodes(),a.listMeshes(),a.listMaterials(),a.listTextures(),a.listAnimations()];for(let o=0;o<n.length;o++){let c=n[o]||[];for(let l=0;l<c.length;l++){let f=c[l];if(f.extensions&&f.extensions.KHR_xmp_json_ld){let d=f.extensions[ct];i[o][l].setExtension(ct,s[d.packet])}}}return this}write(e){let{json:t}=e.jsonDoc,r=[];for(let a of this.properties){r.push(a.toJSONLD());for(let s of a.listParents()){let n;switch(s.propertyType){case F.ROOT:n=t.asset;break;case F.SCENE:n=t.scenes[e.sceneIndexMap.get(s)];break;case F.NODE:n=t.nodes[e.nodeIndexMap.get(s)];break;case F.MESH:n=t.meshes[e.meshIndexMap.get(s)];break;case F.MATERIAL:n=t.materials[e.materialIndexMap.get(s)];break;case F.TEXTURE:n=t.images[e.imageIndexMap.get(s)];break;case F.ANIMATION:n=t.animations[e.animationIndexMap.get(s)];break;default:n=null,this.document.getLogger().warn(`[${ct}]: Unsupported parent property, "${s.propertyType}"`);break}n&&(n.extensions=n.extensions||{},n.extensions[ct]={packet:r.length-1})}}return r.length>0&&(t.extensions=t.extensions||{},t.extensions[ct]={packets:r}),this}},ex=[Oy,Fy,Hy,Wy,Qy,t0,o0,l0,u0,h0,m0,x0,N0,S0,O0,P0,D0,z0,K0,Di,H0,X0,Y0,Z0],xS=[Bm,ji,Li,sy,Ny,By,...ex];var LT=(function(){var e="b9H79Tebbbe9ok9Geueu9Geub9Gbb9Gruuuuuuueu9Gvuuuuueu9Gduueu9Gluuuueu9Gvuuuuub9Gouuuuuub9Gluuuub9Giuuueui8AYdilveoveovrrwrrDDoDrbqqbelve9Weiiviebeoweuec;G:Qdkr:nlAo9TW9T9VV95dbH9F9F939H79T9F9J9H229F9Jt9VV7bb8F9TW79O9V9Wt9FW9U9J9V9KW9wWVtW949c919M9MWV9mW4W2be8A9TW79O9V9Wt9FW9U9J9V9KW9wWVtW949c919M9MWVbd8F9TW79O9V9Wt9FW9U9J9V9KW9wWVtW949c919M9MWV9c9V919U9KbiE9TW79O9V9Wt9FW9U9J9V9KW9wWVtW949wWV79P9V9UblY9TW79O9V9Wt9FW9U9J9V9KW69U9KW949c919M9MWVbv8E9TW79O9V9Wt9FW9U9J9V9KW69U9KW949c919M9MWV9c9V919U9Kbo8A9TW79O9V9Wt9FW9U9J9V9KW69U9KW949wWV79P9V9UbrE9TW79O9V9Wt9FW9U9J9V9KW69U9KW949tWG91W9U9JWbwa9TW79O9V9Wt9FW9U9J9V9KW69U9KW949tWG91W9U9JW9c9V919U9KbDL9TW79O9V9Wt9FW9U9J9V9KWS9P2tWV9p9JtbqK9TW79O9V9Wt9FW9U9J9V9KWS9P2tWV9r919HtbkL9TW79O9V9Wt9FW9U9J9V9KWS9P2tWVT949WbxE9TW79O9V9Wt9F9V9Wt9P9T9P96W9wWVtW94J9H9J9OWbsa9TW79O9V9Wt9F9V9Wt9P9T9P96W9wWVtW94J9H9J9OW9ttV9P9Wbza9TW79O9V9Wt9F9V9Wt9P9T9P96W9wWVtW94SWt9J9O9sW9T9H9WbHK9TW79O9V9Wt9F79W9Ht9P9H29t9VVt9sW9T9H9WbOl79IV9RbCDwebcekdKLqN9OYdbk:Bhdhud9:8Jjjjjbc;qw9Rgr8KjjjjbcbhwdnaeTmbabcbyd;C:kjjbaoaocb9iEgDc:GeV86bbarc;adfcbcjdz:wjjjb8AdnaiTmbarc;adfadalz:vjjjb8Akarc;abfalfcbcbcjdal9RalcFe0Ez:wjjjb8Aarc;abfarc;adfalz:vjjjb8AarcUf9cb83ibarc8Wf9cb83ibarcyf9cb83ibarcaf9cb83ibarcKf9cb83ibarczf9cb83ibar9cb83iwar9cb83ibcj;abal9Uc;WFbGcjdalca0Ehqdnaicd6mbavcd9imbaDTmbadcefhkaqci2gxal2hmarc;alfclfhParc;qlfceVhsarc;qofclVhzarc;qofcKfhHarc;qofczfhOcbhAincdhCcbhodnavci6mbaH9cb83ibaO9cb83ibar9cb83i;yoar9cb83i;qoadaAfgoybbhXcbhQincbhwcbhLdninaoalfhKaoybbgYaX7aLVhLawcP0meaKhoaYhXawcefgwaQfai6mbkkcbhXarc;qofhwincwh8AcwhEdnaLaX93gocFeGg3cs0mbclhEa3ci0mba3cb9hcethEkdnaocw4cFeGg3cs0mbclh8Aa3ci0mba3cb9hceth8Aka8AaEfh3awydbh5cwh8AcwhEdnaocz4cFeGg8Ecs0mbclhEa8Eci0mba8Ecb9hcethEka3a5fh3dnaocFFFFb0mbclh8AaocFFF8F0mbaocFFFr0ceth8Akawa3aEfa8AfBdbawclfhwaXcefgXcw9hmbkaKhoaYhXaQczfgQai6mbkcbhocehwazhLinawaoaLydbarc;qofaocdtfydb6EhoaLclfhLawcefgwcw9hmbkcihCkcbh3arc;qlfcbcjdz:wjjjb8Aarc;alfcwfcbBdbar9cb83i;alaoclth8Fadhaaqhhakh5inarc;qlfadcba3cufgoaoa30Eal2falz:vjjjb8Aaiahaiah6Ehgdnaqaia39Ra3aqfai6EgYcsfc9WGgoaY9nmbarc;qofaYfcbaoaY9Rz:wjjjb8Akada3al2fh8Jcbh8Kina8Ka8FVcl4hQarc;alfa8Kcdtfh8LaAh8Mcbh8Nina8NaAfhwdndndndndndna8KPldebidkasa8Mc98GgLfhoa5aLfh8Aarc;qlfawc98GgLfRbbhXcwhwinaoRbbawtaXVhXaocefhoawcwfgwca9hmbkaYTmla8Ncith8Ea8JaLfhEcbhKinaERbbhLcwhoa8AhwinawRbbaotaLVhLawcefhwaocwfgoca9hmbkarc;qofaKfaLaX7aQ93a8E486bba8Aalfh8AaEalfhEaLhXaKcefgKaY9hmbxlkkaYTmia8Mc9:Ghoa8NcitcwGhEarc;qlfawceVfRbbcwtarc;qlfawc9:GfRbbVhLarc;qofhwaghXinawa5aofRbbcwtaaaofRbbVg8AaL9RgLcetaLcztcz91cs47cFFiGaE486bbaoalfhoawcefhwa8AhLa3aXcufgX9hmbxikkaYTmda8Jawfhoarc;qlfawfRbbhLarc;qofhwaghXinawaoRbbg8AaL9RgLcetaLcKtcK91cr4786bbawcefhwaoalfhoa8AhLa3aXcufgX9hmbxdkkaYTmeka8LydbhEcbhKarc;qofhoincdhLcbhwinaLaoawfRbbcb9hfhLawcefgwcz9hmbkclhXcbhwinaXaoawfRbbcd0fhXawcefgwcz9hmbkcwh8Acbhwina8AaoawfRbbcP0fh8Aawcefgwcz9hmbkaLaXaLaX6Egwa8Aawa8A6Egwczawcz6EaEfhEaoczfhoaKczfgKaY6mbka8LaEBdbka8Mcefh8Ma8Ncefg8Ncl9hmbka8Kcefg8KaC9hmbkaaamfhaahaxfhha5amfh5a3axfg3ai6mbkcbhocehwaPhLinawaoaLydbarc;alfaocdtfydb6EhoaLclfhLawcefgXhwaCaX9hmbkaraAcd4fa8FcdVaoaocdSE86bbaAclfgAal6mbkkabaefh8Kabcefhoalcd4gecbaDEhkadcefhOarc;abfceVhHcbhmdndninaiam9nmearc;qofcbcjdz:wjjjb8Aa8Kao9Rak6mdadamal2gwfhxcbh8JaOawfhzaocbakz:wjjjbghakfh5aqaiam9Ramaqfai6Egscsfgocl4cifcd4hCaoc9WGg8LThPindndndndndndndndndndnaDTmbara8Jcd4fRbbgLciGPlbedlbkasTmdaxa8Jfhoarc;abfa8JfRbbhLarc;qofhwashXinawaoRbbg8AaL9RgLcetaLcKtcK91cr4786bbawcefhwaoalfhoa8AhLaXcufgXmbxikkasTmia8JcitcwGhEarc;abfa8JceVfRbbcwtarc;abfa8Jc9:GgofRbbVhLaxaofhoarc;qofhwashXinawao8Vbbg8AaL9RgLcetaLcztcz91cs47cFFiGaE486bbawcefhwaoalfhoa8AhLaXcufgXmbxdkkaHa8Jc98GgEfhoazaEfh8Aarc;abfaEfRbbhXcwhwinaoRbbawtaXVhXaocefhoawcwfgwca9hmbkasTmbaLcl4hYa8JcitcKGh3axaEfhEcbhKinaERbbhLcwhoa8AhwinawRbbaotaLVhLawcefhwaocwfgoca9hmbkarc;qofaKfaLaX7aY93a3486bba8Aalfh8AaEalfhEaLhXaKcefgKas9hmbkkaDmbcbhoxlka8LTmbcbhodninarc;qofaofgwcwf8Pibaw8Pib:e9qTmeaoczfgoa8L9pmdxbkkdnavmbcehoxikcbhEaChKaChYinarc;qofaEfgocwf8Pibhyao8Pibh8PcdhLcbhwinaLaoawfRbbcb9hfhLawcefgwcz9hmbkclhXcbhwinaXaoawfRbbcd0fhXawcefgwcz9hmbkcwh8Acbhwina8AaoawfRbbcP0fh8Aawcefgwcz9hmbkaLaXaLaX6Egoa8Aaoa8A6Egoczaocz6EaYfhYaocucbaya8P:e9cb9sEgwaoaw6EaKfhKaEczfgEa8L9pmdxbkkaha8Jcd4fgoaoRbbcda8JcetcoGtV86bbxikdnaKas6mbaYas6mbaha8Jcd4fgoaoRbbcia8JcetcoGtV86bba8Ka59Ras6mra5arc;qofasz:vjjjbasfh5xikaKaY9phokaha8Jcd4fgwawRbbaoa8JcetcoGtV86bbka8Ka59RaC6mla5cbaCz:wjjjbgAaCfhYdndna8LmbaPhoxekdna8KaY9RcK9pmbaPhoxekaocdtc:q1jjbfcj1jjbaDEg5ydxggcetc;:FFFeGh8Fcuh3cuagtcu7cFeGhacbh8Marc;qofhLinarc;qofa8MfhQczhEdndndnagPDbeeeeeeedekcucbaQcwf8PibaQ8Pib:e9cb9sEhExekcbhoa8FhEinaEaaaLaofRbb9nfhEaocefgocz9hmbkkcih8Ecbh8Ainczhwdndndna5a8AcdtfydbgKPDbeeeeeeedekcucbaQcwf8PibaQ8Pib:e9cb9sEhwxekaKcetc;:FFFeGhwcuaKtcu7cFeGhXcbhoinawaXaLaofRbb9nfhwaocefgocz9hmbkkdndnawaE6mbaKa39hmeawaE9hmea5a8EcdtfydbcwSmeka8Ah8EawhEka8Acefg8Aci9hmbkaAa8Mco4fgoaoRbba8Ea8Mci4coGtV86bbdndndna5a8Ecdtfydbg3PDdbbbbbbbebkdncwa39Tg8ETmbcua3tcu7hwdndna3ceSmbcbh8NaLhQinaQhoa8Eh8AcbhXinaoRbbgEawcFeGgKaEaK6EaXa3tVhXaocefhoa8Acufg8AmbkaYaX86bbaQa8EfhQaYcefhYa8Na8Efg8Ncz6mbxdkkcbh8NaLhQinaQhoa8Eh8AcbhXinaoRbbgEawcFeGgKaEaK6EaXcetVhXaocefhoa8Acufg8AmbkaYaX:T9cFe:d9c:c:qj:bw9:9c:q;c1:I1e:d9c:b:c:e1z9:9ca188bbaQa8EfhQaYcefhYa8Na8Efg8Ncz6mbkkcbhoinaYaLaofRbbgX86bbaYaXawcFeG9pfhYaocefgocz9hmbxikkdna3ceSmbinaYcb86bbaYcefhYxbkkinaYcb86bbaYcefhYxbkkaYaQ8Pbb83bbaYcwfaQcwf8Pbb83bbaYczfhYka8Mczfg8Ma8L9pgomeaLczfhLa8KaY9RcK9pmbkkaoTmlaYh5aYTmlka8Jcefg8Jal9hmbkarc;abfaxascufal2falz:vjjjb8Aasamfhma5hoa5mbkcbhwxdkdna8Kao9RakalfgwcKcaaDEgLawaL0EgX9pmbcbhwxdkdnawaL9pmbaocbaXaw9Rgwz:wjjjbawfhokaoarc;adfalz:vjjjbalfhodnaDTmbaoaraez:vjjjbaefhokaoab9Rhwxekcbhwkarc;qwf8Kjjjjbawk5babaeadaialcdcbyd;C:kjjbz:bjjjbk9reduaecd4gdaefgicaaica0Eabcj;abae9Uc;WFbGcjdaeca0Egifcufai9Uae2aiadfaicl4cifcd4f2fcefkmbcbabBd;C:kjjbk:Ese5u8Jjjjjbc;ae9Rgl8Kjjjjbcbhvdnaici9UgocHfae0mbabcbyd;m:kjjbgrc;GeV86bbalc;abfcFecjez:wjjjb8AalcUfgw9cu83ibalc8WfgD9cu83ibalcyfgq9cu83ibalcafgk9cu83ibalcKfgx9cu83ibalczfgm9cu83ibal9cu83iwal9cu83ibabaefc9WfhPabcefgsaofhednaiTmbcmcsarcb9kgzEhHcbhOcbhAcbhCcbhXcbhQindnaeaP9nmbcbhvxikaQcufhvadaCcdtfgLydbhKaLcwfydbhYaLclfydbh8AcbhEdndndninalc;abfavcsGcitfgoydlh3dndndnaoydbgoaK9hmba3a8ASmekdnaoa8A9hmba3aY9hmbaEcefhExekaoaY9hmea3aK9hmeaEcdfhEkaEc870mdaXcufhvaLaEciGcx2goc;i1jjbfydbcdtfydbh3aLaoc;e1jjbfydbcdtfydbh8AaLaoc;a1jjbfydbcdtfydbhKcbhodnindnalavcsGcdtfydba39hmbaohYxdkcuhYavcufhvaocefgocz9hmbkkaOa3aOSgvaYce9iaYaH9oVgoGfhOdndndncbcsavEaYaoEgvcs9hmbarce9imba3a3aAa3cefaASgvEgAcefSmecmcsavEhvkasavaEcdtc;WeGV86bbavcs9hmea3aA9Rgvcetavc8F917hvinaeavcFb0crtavcFbGV86bbaecefheavcje6hoavcr4hvaoTmbka3hAxvkcPhvasaEcdtcPV86bba3hAkavTmiavaH9omicdhocehEaQhYxlkavcufhvaEclfgEc;ab9hmbkkdnaLceaYaOSceta8AaOSEcx2gvc;a1jjbfydbcdtfydbgKTaLavc;e1jjbfydbcdtfydbg8AceSGaLavc;i1jjbfydbcdtfydbg3cdSGaOcb9hGazGg5ce9hmbaw9cu83ibaD9cu83ibaq9cu83ibak9cu83ibax9cu83ibam9cu83ibal9cu83iwal9cu83ibcbhOkcbhEaXcufgvhodnindnalaocsGcdtfydba8A9hmbaEhYxdkcuhYaocufhoaEcefgEcz9hmbkkcbhodnindnalavcsGcdtfydba39hmbaohExdkcuhEavcufhvaocefgocz9hmbkkaOaKaOSg8EfhLdndnaYcm0mbaYcefhYxekcbcsa8AaLSgvEhYaLavfhLkdndnaEcm0mbaEcefhExekcbcsa3aLSgvEhEaLavfhLkc9:cua8EEh8FcbhvaEaYcltVgacFeGhodndndninavc:W1jjbfRbbaoSmeavcefgvcz9hmbxdkka5aKaO9havcm0VVmbasavc;WeV86bbxekasa8F86bbaeaa86bbaecefhekdna8EmbaKaA9Rgvcetavc8F917hvinaeavcFb0gocrtavcFbGV86bbavcr4hvaecefheaombkaKhAkdnaYcs9hmba8AaA9Rgvcetavc8F917hvinaeavcFb0gocrtavcFbGV86bbavcr4hvaecefheaombka8AhAkdnaEcs9hmba3aA9Rgvcetavc8F917hvinaeavcFb0gocrtavcFbGV86bbavcr4hvaecefheaombka3hAkalaXcdtfaKBdbaXcefcsGhvdndnaYPzbeeeeeeeeeeeeeebekalavcdtfa8ABdbaXcdfcsGhvkdndnaEPzbeeeeeeeeeeeeeebekalavcdtfa3BdbavcefcsGhvkcihoalc;abfaQcitfgEaKBdlaEa8ABdbaQcefcsGhYcdhEavhXaLhOxekcdhoalaXcdtfa3BdbcehEaXcefcsGhXaQhYkalc;abfaYcitfgva8ABdlava3Bdbalc;abfaQaEfcsGcitfgva3BdlavaKBdbascefhsaQaofcsGhQaCcifgCai6mbkkdnaeaP9nmbcbhvxekcbhvinaeavfavc:W1jjbfRbb86bbavcefgvcz9hmbkaeab9Ravfhvkalc;aef8KjjjjbavkZeeucbhddninadcefgdc8F0meceadtae6mbkkadcrfcFeGcr9Uci2cdfabci9U2cHfkmbcbabBd;m:kjjbk:Adewu8Jjjjjbcz9Rhlcbhvdnaicvfae0mbcbhvabcbRb;m:kjjbc;qeV86bbal9cb83iwabcefhoabaefc98fhrdnaiTmbcbhwcbhDindnaoar6mbcbskadaDcdtfydbgqalcwfawaqav9Rgvavc8F91gv7av9Rc507gwcdtfgkydb9Rgvc8E91c9:Gavcdt7awVhvinaoavcFb0gecrtavcFbGV86bbavcr4hvaocefhoaembkakaqBdbaqhvaDcefgDai9hmbkkdnaoar9nmbcbskaocbBbbaoab9RclfhvkavkBeeucbhddninadcefgdc8F0meceadtae6mbkkadcwfcFeGcr9Uab2cvfk:bvli99dui99ludnaeTmbcuadcetcuftcu7:Zhvdndncuaicuftcu7:ZgoJbbbZMgr:lJbbb9p9DTmbar:Ohwxekcjjjj94hwkcbhicbhDinalclfIdbgrJbbbbJbbjZalIdbgq:lar:lMalcwfIdbgk:lMgr:varJbbbb9BEgrNhxaqarNhrdndnakJbbbb9GTmbaxhqxekJbbjZar:l:tgqaq:maxJbbbb9GEhqJbbjZax:l:tgxax:marJbbbb9GEhrkdndnalcxfIdbgxJbbj:;axJbbj:;9GEgkJbbjZakJbbjZ9FEavNJbbbZJbbb:;axJbbbb9GEMgx:lJbbb9p9DTmbax:Ohmxekcjjjj94hmkdndnaqJbbj:;aqJbbj:;9GEgxJbbjZaxJbbjZ9FEaoNJbbbZJbbb:;aqJbbbb9GEMgq:lJbbb9p9DTmbaq:OhPxekcjjjj94hPkdndnarJbbj:;arJbbj:;9GEgqJbbjZaqJbbjZ9FEaoNJbbbZJbbb:;arJbbbb9GEMgr:lJbbb9p9DTmbar:Ohsxekcjjjj94hskdndnadcl9hmbabaifgzas86bbazcifam86bbazcdfaw86bbazcefaP86bbxekabaDfgzas87ebazcofam87ebazclfaw87ebazcdfaP87ebkalczfhlaiclfhiaDcwfhDaecufgembkkk;hlld99eud99eudnaeTmbdndncuaicuftcu7:ZgvJbbbZMgo:lJbbb9p9DTmbao:Ohixekcjjjj94hikaic;8FiGhrinabcofcicdalclfIdb:lalIdb:l9EgialcwfIdb:lalaicdtfIdb:l9EEgialcxfIdb:lalaicdtfIdb:l9EEgiarV87ebdndnJbbj:;JbbjZalaicdtfIdbJbbbb9DEgoalaicd7cdtfIdbJ;Zl:1ZNNgwJbbj:;awJbbj:;9GEgDJbbjZaDJbbjZ9FEavNJbbbZJbbb:;awJbbbb9GEMgw:lJbbb9p9DTmbaw:Ohqxekcjjjj94hqkabcdfaq87ebdndnalaicefciGcdtfIdbJ;Zl:1ZNaoNgwJbbj:;awJbbj:;9GEgDJbbjZaDJbbjZ9FEavNJbbbZJbbb:;awJbbbb9GEMgw:lJbbb9p9DTmbaw:Ohqxekcjjjj94hqkabaq87ebdndnaoalaicufciGcdtfIdbJ;Zl:1ZNNgoJbbj:;aoJbbj:;9GEgwJbbjZawJbbjZ9FEavNJbbbZJbbb:;aoJbbbb9GEMgo:lJbbb9p9DTmbao:Ohixekcjjjj94hikabclfai87ebabcwfhbalczfhlaecufgembkkk;3viDue99eu8Jjjjjbcjd9Rgo8Kjjjjbadcd4hrdndndndnavcd9hmbadcl6meaohwarhDinawc:CuBdbawclfhwaDcufgDmbkaeTmiadcl6mdarcdthqalhkcbhxinaohwakhDarhminawawydbgPcbaDIdbgs:8cL4cFeGc:cufasJbbbb9BEgzaPaz9kEBdbaDclfhDawclfhwamcufgmmbkakaqfhkaxcefgxaeSmixbkkaeTmdxekaeTmekarcdthkavce9hhqadcl6hdcbhxindndndnaqmbadmdc:CuhDalhwarhminaDcbawIdbgs:8cL4cFeGc:cufasJbbbb9BEgPaDaP9kEhDawclfhwamcufgmmbxdkkc:CuhDdndnavPleddbdkadmdaohwalhmarhPinawcbamIdbgs:8cL4cFeGgzc;:bazc;:b0Ec:cufasJbbbb9BEBdbamclfhmawclfhwaPcufgPmbxdkkadmecbhwarhminaoawfcbalawfIdbgs:8cL4cFeGgPc8AaPc8A0Ec:cufasJbbbb9BEBdbawclfhwamcufgmmbkkadmbcbhwarhPinaDhmdnavceSmbaoawfydbhmkdndnalawfIdbgscjjj;8iamai9RcefgmcLt9R::NJbbbZJbbb:;asJbbbb9GEMgs:lJbbb9p9DTmbas:Ohzxekcjjjj94hzkabawfazcFFFrGamcKtVBdbawclfhwaPcufgPmbkkabakfhbalakfhlaxcefgxae9hmbkkaocjdf8Kjjjjbk;YqdXui998Jjjjjbc:qd9Rgv8Kjjjjbavc:Sefcbc;Kbz:wjjjb8AcbhodnadTmbcbhoaiTmbdndnabaeSmbaehrxekavcuadcdtgwadcFFFFi0Ecbyd;u:kjjbHjjjjbbgrBd:SeavceBd:mdaraeawz:vjjjb8Akavc:GefcwfcbBdbav9cb83i:Geavc:Gefaradaiavc:Sefz:ojjjbavyd:GehDadci9Ugqcbyd;u:kjjbHjjjjbbheavc:Sefavyd:mdgkcdtfaeBdbavakcefgwBd:mdaecbaqz:wjjjbhxavc:SefawcdtfcuaicdtaicFFFFi0Ecbyd;u:kjjbHjjjjbbgmBdbavakcdfgPBd:mdalc;ebfhsaDheamhwinawalIdbasaeydbgzcwazcw6EcdtfIdbMUdbaeclfheawclfhwaicufgimbkavc:SefaPcdtfcuaqcdtadcFFFF970Ecbyd;u:kjjbHjjjjbbgPBdbdnadci6mbarheaPhwaqhiinawamaeydbcdtfIdbamaeclfydbcdtfIdbMamaecwfydbcdtfIdbMUdbaecxfheawclfhwaicufgimbkkakcifhoalc;ebfhHavc;qbfhOavheavyd:KehAavyd:OehCcbhzcbhwcbhXcehQinaehLcihkarawci2gKcdtfgeydbhsaeclfydbhdabaXcx2fgicwfaecwfydbgYBdbaiclfadBdbaiasBdbaxawfce86bbaOaYBdwaOadBdlaOasBdbaPawcdtfcbBdbdnazTmbcihkaLhiinaOakcdtfaiydbgeBdbakaeaY9haeas9haead9hGGfhkaiclfhiazcufgzmbkkaXcefhXcbhzinaCaAarazaKfcdtfydbcdtgifydbcdtfgYheaDaifgdydbgshidnasTmbdninaeydbawSmeaeclfheaicufgiTmdxbkkaeaYascdtfc98fydbBdbadadydbcufBdbkazcefgzci9hmbkdndnakTmbcuhwJbbbbh8Acbhdavyd:KehYavyd:OehKindndnaDaOadcdtfydbcdtgzfydbgembadcefhdxekadcs0hiamazfgsIdbhEasalcbadcefgdaiEcdtfIdbaHaecwaecw6EcdtfIdbMg3Udba3aE:th3aecdthiaKaYazfydbcdtfheinaPaeydbgzcdtfgsa3asIdbMgEUdbaEa8Aa8AaE9DgsEh8AazawasEhwaeclfheaic98fgimbkkadak9hmbkawcu9hmekaQaq9pmdindnaxaQfRbbmbaQhwxdkaqaQcefgQ9hmbxikkakczakcz6EhzaOheaLhOawcu9hmbkkaocdtavc:Seffc98fhedninaoTmeaeydbcbyd;q:kjjbH:bjjjbbaec98fheaocufhoxbkkavc:qdf8Kjjjjbk;IlevucuaicdtgvaicFFFFi0Egocbyd;u:kjjbHjjjjbbhralalyd9GgwcdtfarBdbalawcefBd9GabarBdbaocbyd;u:kjjbHjjjjbbhralalyd9GgocdtfarBdbalaocefBd9GabarBdlcuadcdtadcFFFFi0Ecbyd;u:kjjbHjjjjbbhralalyd9GgocdtfarBdbalaocefBd9GabarBdwabydbcbavz:wjjjb8Aadci9UhDdnadTmbabydbhoaehladhrinaoalydbcdtfgvavydbcefBdbalclfhlarcufgrmbkkdnaiTmbabydbhlabydlhrcbhvaihoinaravBdbarclfhralydbavfhvalclfhlaocufgombkkdnadci6mbabydlhrabydwhvcbhlinaecwfydbhoaeclfydbhdaraeydbcdtfgwawydbgwcefBdbavawcdtfalBdbaradcdtfgdadydbgdcefBdbavadcdtfalBdbaraocdtfgoaoydbgocefBdbavaocdtfalBdbaecxfheaDalcefgl9hmbkkdnaiTmbabydlheabydbhlinaeaeydbalydb9RBdbalclfhlaeclfheaicufgimbkkkQbabaeadaic;K1jjbz:njjjbkQbabaeadaic;m:jjjbz:njjjbk9DeeuabcFeaicdtz:wjjjbhlcbhbdnadTmbindnalaeydbcdtfgiydbcu9hmbaiabBdbabcefhbkaeclfheadcufgdmbkkabk:Vvioud9:du8Jjjjjbc;Wa9Rgl8Kjjjjbcbhvalcxfcbc;Kbz:wjjjb8AalcuadcitgoadcFFFFe0Ecbyd;u:kjjbHjjjjbbgrBdxalceBd2araeadaicez:tjjjbalcuaoadcjjjjoGEcbyd;u:kjjbHjjjjbbgwBdzadcdthednadTmbabhiinaiavBdbaiclfhiadavcefgv9hmbkkawaefhDalabBdwalawBdl9cbhqindnadTmbaq9cq9:hkarhvaDhiadheinaiav8Pibak1:NcFrG87ebavcwfhvaicdfhiaecufgembkkalclfaq:NceGcdtfydbhxalclfaq9ce98gq:NceGcdtfydbhmalc;Wbfcbcjaz:wjjjb8AaDhvadhidnadTmbinalc;Wbfav8VebcdtfgeaeydbcefBdbavcdfhvaicufgimbkkcbhvcbhiinalc;WbfavfgeydbhoaeaiBdbaoaifhiavclfgvcja9hmbkadhvdndnadTmbinalc;WbfaDamydbgicetf8VebcdtfgeaeydbgecefBdbaxaecdtfaiBdbamclfhmavcufgvmbkaq9cv9smdcbhvinabawydbcdtfavBdbawclfhwadavcefgv9hmbxdkkaq9cv9smekkclhvdninavc98Smealcxfavfydbcbyd;q:kjjbH:bjjjbbavc98fhvxbkkalc;Waf8Kjjjjbk:Jwliuo99iud9:cbhv8Jjjjjbca9Rgoczfcwfcbyd:8:kjjbBdbaocb8Pd:0:kjjb83izaocwfcbyd;i:kjjbBdbaocb8Pd;a:kjjb83ibaicd4hrdndnadmbJFFuFhwJFFuuhDJFFuuhqJFFuFhkJFFuuhxJFFuFhmxekarcdthPaehsincbhiinaoczfaifgzasaifIdbgwazIdbgDaDaw9EEUdbaoaifgzawazIdbgDaDaw9DEUdbaiclfgicx9hmbkasaPfhsavcefgvad9hmbkaoIdKhDaoIdwhwaoIdChqaoIdlhkaoIdzhxaoIdbhmkdnadTmbJbbbbJbFu9hJbbbbamax:tgmamJbbbb9DEgmakaq:tgkakam9DEgkawaD:tgwawak9DEgw:vawJbbbb9BEhwdnalmbarcdthoindndnaeclfIdbaq:tawNJbbbZMgk:lJbbb9p9DTmbak:Ohixekcjjjj94hikai:S9cC:ghHdndnaeIdbax:tawNJbbbZMgk:lJbbb9p9DTmbak:Ohixekcjjjj94hikaHai:S:ehHdndnaecwfIdbaD:tawNJbbbZMgk:lJbbb9p9DTmbak:Ohixekcjjjj94hikabaHai:T9cy:g:e83ibaeaofheabcwfhbadcufgdmbxdkkarcdthoindndnaeIdbax:tawNJbbbZMgk:lJbbb9p9DTmbak:Ohixekcjjjj94hikai:SgH9ca:gaH9cz:g9cjjj;4s:d:eaH9cFe:d:e9cF:bj;4:pj;ar:d9c:bd9:9c:p;G:d;4j:E;ar:d9cH9:9c;d;H:W:y:m:g;d;Hb:d9cv9:9c;j:KM;j:KM;j:Kd:dhOdndnaeclfIdbaq:tawNJbbbZMgk:lJbbb9p9DTmbak:Ohixekcjjjj94hikai:SgH9ca:gaH9cz:g9cjjj;4s:d:eaH9cFe:d:e9cF:bj;4:pj;ar:d9c:bd9:9c:p;G:d;4j:E;ar:d9cH9:9c;d;H:W:y:m:g;d;Hb:d9cq9:9cM;j:KM;j:KM;jl:daO:ehOdndnaecwfIdbaD:tawNJbbbZMgk:lJbbb9p9DTmbak:Ohixekcjjjj94hikabaOai:SgH9ca:gaH9cz:g9cjjj;4s:d:eaH9cFe:d:e9cF:bj;4:pj;ar:d9c:bd9:9c:p;G:d;4j:E;ar:d9cH9:9c;d;H:W:y:m:g;d;Hb:d9cC9:9c:KM;j:KM;j:KMD:d:e83ibaeaofheabcwfhbadcufgdmbkkk9teiucbcbyd;y:kjjbgeabcifc98GfgbBd;y:kjjbdndnabZbcztgd9nmbcuhiabad9RcFFifcz4nbcuSmekaehikaik;teeeudndnaeabVciGTmbabhixekdndnadcz9pmbabhixekabhiinaiaeydbBdbaiaeydlBdlaiaeydwBdwaiaeydxBdxaeczfheaiczfhiadc9Wfgdcs0mbkkadcl6mbinaiaeydbBdbaeclfheaiclfhiadc98fgdci0mbkkdnadTmbinaiaeRbb86bbaicefhiaecefheadcufgdmbkkabk:3eedudndnabciGTmbabhixekaecFeGc:b:c:ew2hldndnadcz9pmbabhixekabhiinaialBdxaialBdwaialBdlaialBdbaiczfhiadc9Wfgdcs0mbkkadcl6mbinaialBdbaiclfhiadc98fgdci0mbkkdnadTmbinaiae86bbaicefhiadcufgdmbkkabk9teiucbcbyd;y:kjjbgeabcrfc94GfgbBd;y:kjjbdndnabZbcztgd9nmbcuhiabad9RcFFifcz4nbcuSmekaehikaik9:eiuZbhedndncbyd;y:kjjbgdaecztgi9nmbcuheadai9RcFFifcz4nbcuSmekadhekcbabae9Rcifc98Gcbyd;y:kjjbfgdBd;y:kjjbdnadZbcztge9nmbadae9RcFFifcz4nb8Akkk;Qddbcjwk;mdbbbbdbbblbbbwbbbbbbbebbbdbbblbbbwbbbbbbbbbbbbbbbb4:h9w9N94:P:gW:j9O:ye9Pbbbbbbebbbdbbbebbbdbbbbbbbdbbbbbbbebbbbbbb:l29hZ;69:9kZ;N;76Z;rg97Z;z;o9xZ8J;B85Z;:;u9yZ;b;k9HZ:2;Z9DZ9e:l9mZ59A8KZ:r;T3Z:A:zYZ79OHZ;j4::8::Y:D9V8:bbbb9s:49:Z8R:hBZ9M9M;M8:L;z;o8:;8:PG89q;x:J878R:hQ8::M:B;e87bbbbbbjZbbjZbbjZ:E;V;N8::Y:DsZ9i;H;68:xd;R8:;h0838:;W:NoZbbbb:WV9O8:uf888:9i;H;68:9c9G;L89;n;m9m89;D8Ko8:bbbbf:8tZ9m836ZS:2AZL;zPZZ818EZ9e:lxZ;U98F8:819E;68:FFuuFFuuFFuuFFuFFFuFFFuFbc;mqkzebbbebbbdbbb9G:vbb",t=new Uint8Array([32,0,65,2,1,106,34,33,3,128,11,4,13,64,6,253,10,7,15,116,127,5,8,12,40,16,19,54,20,9,27,255,113,17,42,67,24,23,146,148,18,14,22,45,70,69,56,114,101,21,25,63,75,136,108,28,118,29,73,115]);if(typeof WebAssembly!="object")return{supported:!1};var r,a=WebAssembly.instantiate(s(e),{}).then(function(b){r=b.instance,r.exports.__wasm_call_ctors(),r.exports.meshopt_encodeVertexVersion(0),r.exports.meshopt_encodeIndexVersion(1)});function s(b){for(var h=new Uint8Array(b.length),u=0;u<b.length;++u){var m=b.charCodeAt(u);h[u]=m>96?m-97:m>64?m-39:m+4}for(var g=0,u=0;u<b.length;++u)h[g++]=h[u]<60?t[h[u]]:(h[u]-60)*64+h[++u];return h.buffer.slice(0,g)}function n(b){if(!b)throw new Error("Assertion failed")}function i(b){return new Uint8Array(b.buffer,b.byteOffset,b.byteLength)}function o(b,h,u,m){var g=r.exports.sbrk,y=g(h.length*4),x=g(u*4),v=new Uint8Array(r.exports.memory.buffer),E=i(h);v.set(E,y),m&&m(y,y,h.length,u);var S=b(x,y,h.length,u);v=new Uint8Array(r.exports.memory.buffer);var T=new Uint32Array(u);new Uint8Array(T.buffer).set(v.subarray(x,x+u*4)),E.set(v.subarray(y,y+h.length*4)),g(y-g(0));for(var _=0;_<h.length;++_)h[_]=T[h[_]];return[T,S]}function c(b,h,u,m){var g=r.exports.sbrk,y=g(u*4),x=g(u*m),v=new Uint8Array(r.exports.memory.buffer);v.set(i(h),x),b(y,x,u,m),v=new Uint8Array(r.exports.memory.buffer);var E=new Uint32Array(u);return new Uint8Array(E.buffer).set(v.subarray(y,y+u*4)),g(y-g(0)),E}function l(b,h,u,m,g){var y=r.exports.sbrk,x=y(h),v=y(m*g),E=new Uint8Array(r.exports.memory.buffer);E.set(i(u),v);var S=b(x,h,v,m,g),T=new Uint8Array(S);return T.set(E.subarray(x,x+S)),y(x-y(0)),T}function f(b){for(var h=0,u=0;u<b.length;++u){var m=b[u];h=h<m?m:h}return h}function d(b,h){if(n(h==2||h==4),h==4)return new Uint32Array(b.buffer,b.byteOffset,b.byteLength/4);var u=new Uint16Array(b.buffer,b.byteOffset,b.byteLength/2);return new Uint32Array(u)}function p(b,h,u,m,g,y,x){var v=r.exports.sbrk,E=v(u*m),S=v(u*y),T=new Uint8Array(r.exports.memory.buffer);T.set(i(h),S),b(E,u,m,g,S,x);var _=new Uint8Array(u*m);return _.set(T.subarray(E,E+u*m)),v(E-v(0)),_}return{ready:a,supported:!0,reorderMesh:function(b,h,u){var m=h?u?r.exports.meshopt_optimizeVertexCacheStrip:r.exports.meshopt_optimizeVertexCache:void 0;return o(r.exports.meshopt_optimizeVertexFetchRemap,b,f(b)+1,m)},reorderPoints:function(b,h){return n(b instanceof Float32Array),n(b.length%h==0),n(h>=3),c(r.exports.meshopt_spatialSortRemap,b,b.length/h,h*4)},encodeVertexBuffer:function(b,h,u){n(u>0&&u<=256),n(u%4==0);var m=r.exports.meshopt_encodeVertexBufferBound(h,u);return l(r.exports.meshopt_encodeVertexBuffer,m,b,h,u)},encodeIndexBuffer:function(b,h,u){n(u==2||u==4),n(h%3==0);var m=d(b,u),g=r.exports.meshopt_encodeIndexBufferBound(h,f(m)+1);return l(r.exports.meshopt_encodeIndexBuffer,g,m,h,4)},encodeIndexSequence:function(b,h,u){n(u==2||u==4);var m=d(b,u),g=r.exports.meshopt_encodeIndexSequenceBound(h,f(m)+1);return l(r.exports.meshopt_encodeIndexSequence,g,m,h,4)},encodeGltfBuffer:function(b,h,u,m){var g={ATTRIBUTES:this.encodeVertexBuffer,TRIANGLES:this.encodeIndexBuffer,INDICES:this.encodeIndexSequence};return n(g[m]),g[m](b,h,u)},encodeFilterOct:function(b,h,u,m){return n(u==4||u==8),n(m>=1&&m<=16),p(r.exports.meshopt_encodeFilterOct,b,h,u,m,16)},encodeFilterQuat:function(b,h,u,m){return n(u==8),n(m>=4&&m<=16),p(r.exports.meshopt_encodeFilterQuat,b,h,u,m,16)},encodeFilterExp:function(b,h,u,m,g){n(u>0&&u%4==0),n(m>=1&&m<=24);var y={Separate:0,SharedVector:1,SharedComponent:2,Clamped:3};return p(r.exports.meshopt_encodeFilterExp,b,h,u,m,u,g?y[g]:1)}}})();var Ns=(function(){var e="b9H79Tebbbe8Fv9Gbb9Gvuuuuueu9Giuuub9Geueu9Giuuueuikqbeeedddillviebeoweuec:W:Odkr;leDo9TW9T9VV95dbH9F9F939H79T9F9J9H229F9Jt9VV7bb8A9TW79O9V9Wt9F9KW9J9V9KW9wWVtW949c919M9MWVbeY9TW79O9V9Wt9F9KW9J9V9KW69U9KW949c919M9MWVbdE9TW79O9V9Wt9F9KW9J9V9KW69U9KW949tWG91W9U9JWbiL9TW79O9V9Wt9F9KW9J9V9KWS9P2tWV9p9JtblK9TW79O9V9Wt9F9KW9J9V9KWS9P2tWV9r919HtbvL9TW79O9V9Wt9F9KW9J9V9KWS9P2tWVT949Wbol79IV9Rbrq:S86qdbk;jYi5ud9:du8Jjjjjbcj;kb9Rgv8Kjjjjbc9:hodnalTmbcuhoaiRbbgrc;WeGc:Ge9hmbarcsGgwce0mbc9:hoalcufadcd4cbawEgDadfgrcKcaawEgqaraq0Egk6mbaicefhxcj;abad9Uc;WFbGcjdadca0EhmaialfgPar9Rgoadfhsavaoadz1jjjbgzceVhHcbhOdndninaeaO9nmeaPax9RaD6mdamaeaO9RaOamfgoae6EgAcsfglc9WGhCabaOad2fhXaAcethQaxaDfhiaOaeaoaeao6E9RhLalcl4cifcd4hKazcj;cbfaAfhYcbh8AazcjdfhEaHh3incbhodnawTmbaxa8Acd4fRbbhokaocFeGh5cbh8Eazcj;cbfhqinaih8Fdndndndna5a8Ecet4ciGgoc9:fPdebdkaPa8F9RaA6mrazcj;cbfa8EaA2fa8FaAz1jjjb8Aa8FaAfhixdkazcj;cbfa8EaA2fcbaAz:jjjjb8Aa8FhixekaPa8F9RaK6mva8FaKfhidnaCTmbaPai9RcK6mbaocdtc:q1jjbfcj1jjbawEhaczhrcbhlinargoc9Wfghaqfhrdndndndndndnaaa8Fahco4fRbbalcoG4ciGcdtfydbPDbedvivvvlvkar9cb83bbarcwf9cb83bbxlkarcbaiRbdai8Xbb9c:c:qj:bw9:9c:q;c1:I1e:d9c:b:c:e1z9:gg9cjjjjjz:dg8J9qE86bbaqaofgrcGfag9c8F1:NghcKtc8F91aicdfa8J9c8N1:Nfg8KRbbG86bbarcVfcba8KahcjeGcr4fghRbbag9cjjjjjl:dg8J9qE86bbarc7fcbaha8J9c8L1:NfghRbbag9cjjjjjd:dg8J9qE86bbarctfcbaha8J9c8K1:NfghRbbag9cjjjjje:dg8J9qE86bbarc91fcbaha8J9c8J1:NfghRbbag9cjjjj;ab:dg8J9qE86bbarc4fcbaha8J9cg1:NfghRbbag9cjjjja:dg8J9qE86bbarc93fcbaha8J9ch1:NfghRbbag9cjjjjz:dgg9qE86bbarc94fcbahag9ca1:NfghRbbai8Xbe9c:c:qj:bw9:9c:q;c1:I1e:d9c:b:c:e1z9:gg9cjjjjjz:dg8J9qE86bbarc95fag9c8F1:NgicKtc8F91aha8J9c8N1:NfghRbbG86bbarc96fcbahaicjeGcr4fgiRbbag9cjjjjjl:dg8J9qE86bbarc97fcbaia8J9c8L1:NfgiRbbag9cjjjjjd:dg8J9qE86bbarc98fcbaia8J9c8K1:NfgiRbbag9cjjjjje:dg8J9qE86bbarc99fcbaia8J9c8J1:NfgiRbbag9cjjjj;ab:dg8J9qE86bbarc9:fcbaia8J9cg1:NfgiRbbag9cjjjja:dg8J9qE86bbarcufcbaia8J9ch1:NfgiRbbag9cjjjjz:dgg9qE86bbaiag9ca1:NfhixikaraiRblaiRbbghco4g8Ka8KciSg8KE86bbaqaofgrcGfaiclfa8Kfg8KRbbahcl4ciGg8La8LciSg8LE86bbarcVfa8Ka8Lfg8KRbbahcd4ciGg8La8LciSg8LE86bbarc7fa8Ka8Lfg8KRbbahciGghahciSghE86bbarctfa8Kahfg8KRbbaiRbeghco4g8La8LciSg8LE86bbarc91fa8Ka8Lfg8KRbbahcl4ciGg8La8LciSg8LE86bbarc4fa8Ka8Lfg8KRbbahcd4ciGg8La8LciSg8LE86bbarc93fa8Ka8Lfg8KRbbahciGghahciSghE86bbarc94fa8Kahfg8KRbbaiRbdghco4g8La8LciSg8LE86bbarc95fa8Ka8Lfg8KRbbahcl4ciGg8La8LciSg8LE86bbarc96fa8Ka8Lfg8KRbbahcd4ciGg8La8LciSg8LE86bbarc97fa8Ka8Lfg8KRbbahciGghahciSghE86bbarc98fa8KahfghRbbaiRbigico4g8Ka8KciSg8KE86bbarc99faha8KfghRbbaicl4ciGg8Ka8KciSg8KE86bbarc9:faha8KfghRbbaicd4ciGg8Ka8KciSg8KE86bbarcufaha8KfgrRbbaiciGgiaiciSgiE86bbaraifhixdkaraiRbwaiRbbghcl4g8Ka8KcsSg8KE86bbaqaofgrcGfaicwfa8Kfg8KRbbahcsGghahcsSghE86bbarcVfa8KahfghRbbaiRbeg8Kcl4g8La8LcsSg8LE86bbarc7faha8LfghRbba8KcsGg8Ka8KcsSg8KE86bbarctfaha8KfghRbbaiRbdg8Kcl4g8La8LcsSg8LE86bbarc91faha8LfghRbba8KcsGg8Ka8KcsSg8KE86bbarc4faha8KfghRbbaiRbig8Kcl4g8La8LcsSg8LE86bbarc93faha8LfghRbba8KcsGg8Ka8KcsSg8KE86bbarc94faha8KfghRbbaiRblg8Kcl4g8La8LcsSg8LE86bbarc95faha8LfghRbba8KcsGg8Ka8KcsSg8KE86bbarc96faha8KfghRbbaiRbvg8Kcl4g8La8LcsSg8LE86bbarc97faha8LfghRbba8KcsGg8Ka8KcsSg8KE86bbarc98faha8KfghRbbaiRbog8Kcl4g8La8LcsSg8LE86bbarc99faha8LfghRbba8KcsGg8Ka8KcsSg8KE86bbarc9:faha8KfghRbbaiRbrgicl4g8Ka8KcsSg8KE86bbarcufaha8KfgrRbbaicsGgiaicsSgiE86bbaraifhixekarai8Pbb83bbarcwfaicwf8Pbb83bbaiczfhikdnaoaC9pmbalcdfhlaoczfhraPai9RcL0mekkaoaC6moaimexokaCmva8FTmvkaqaAfhqa8Ecefg8Ecl9hmbkdndndndnawTmbasa8Acd4fRbbgociGPlbedrbkaATmdaza8Afh8Fazcj;cbfhhcbh8EaEhaina8FRbbhraahocbhlinaoahalfRbbgqce4cbaqceG9R7arfgr86bbaoadfhoaAalcefgl9hmbkaacefhaa8Fcefh8FahaAfhha8Ecefg8Ecl9hmbxikkaATmeaza8Afhaazcj;cbfhhcbhoceh8EaYh8FinaEaofhlaa8Vbbhrcbhoinala8FaofRbbcwtahaofRbbgqVc;:FiGce4cbaqceG9R7arfgr87bbaladfhlaLaocefgofmbka8FaQfh8FcdhoaacdfhaahaQfhha8EceGhlcbh8EalmbxdkkaATmbcbaocl49Rh8Eaza8AfRbbhqcwhoa3hlinalRbbaotaqVhqalcefhlaocwfgoca9hmbkcbhhaEh8FaYhainazcj;cbfahfRbbhrcwhoaahlinalRbbaotarVhralaAfhlaocwfgoca9hmbkara8E93aq7hqcbhoa8Fhlinalaqao486bbalcefhlaocwfgoca9hmbka8Fadfh8FaacefhaahcefghaA9hmbkkaEclfhEa3clfh3a8Aclfg8Aad6mbkaXazcjdfaAad2z1jjjb8AazazcjdfaAcufad2fadz1jjjb8AaAaOfhOaihxaimbkc9:hoxdkcbc99aPax9RakSEhoxekc9:hokavcj;kbf8Kjjjjbaok:XseHu8Jjjjjbc;ae9Rgv8Kjjjjbc9:hodnaeci9UgrcHfal0mbcuhoaiRbbgwc;WeGc;Ge9hmbawcsGgDce0mbavc;abfcFecjez:jjjjb8AavcUf9cu83ibavc8Wf9cu83ibavcyf9cu83ibavcaf9cu83ibavcKf9cu83ibavczf9cu83ibav9cu83iwav9cu83ibaialfc9WfhqaicefgwarfhldnaeTmbcmcsaDceSEhkcbhxcbhmcbhrcbhicbhoindnalaq9nmbc9:hoxikdndnawRbbgDc;Ve0mbavc;abfaoaDcu7gPcl4fcsGcitfgsydlhzasydbhHdndnaDcsGgsak9pmbavaiaPfcsGcdtfydbaxasEhDaxasTgOfhxxekdndnascsSmbcehOasc987asamffcefhDxekalcefhDal8SbbgscFeGhPdndnascu9mmbaDhlxekalcvfhlaPcFbGhPcrhsdninaD8SbbgOcFbGastaPVhPaOcu9kmeaDcefhDascrfgsc8J9hmbxdkkaDcefhlkcehOaPce4cbaPceG9R7amfhDkaDhmkavc;abfaocitfgsaDBdbasazBdlavaicdtfaDBdbavc;abfaocefcsGcitfgsaHBdbasaDBdlaocdfhoaOaifhidnadcd9hmbabarcetfgsaH87ebasclfaD87ebascdfaz87ebxdkabarcdtfgsaHBdbascwfaDBdbasclfazBdbxekdnaDcpe0mbaxcefgOavaiaqaDcsGfRbbgscl49RcsGcdtfydbascz6gPEhDavaias9RcsGcdtfydbaOaPfgzascsGgOEhsaOThOdndnadcd9hmbabarcetfgHax87ebaHclfas87ebaHcdfaD87ebxekabarcdtfgHaxBdbaHcwfasBdbaHclfaDBdbkavaicdtfaxBdbavc;abfaocitfgHaDBdbaHaxBdlavaicefgicsGcdtfaDBdbavc;abfaocefcsGcitfgHasBdbaHaDBdlavaiaPfgicsGcdtfasBdbavc;abfaocdfcsGcitfgDaxBdbaDasBdlaocifhoaiaOfhiazaOfhxxekaxcbalRbbgHEgAaDc;:eSgDfhzaHcsGhCaHcl4hXdndnaHcs0mbazcefhOxekazhOavaiaX9RcsGcdtfydbhzkdndnaCmbaOcefhxxekaOhxavaiaH9RcsGcdtfydbhOkdndnaDTmbalcefhDxekalcdfhDal8SbegPcFeGhsdnaPcu9kmbalcofhAascFbGhscrhldninaD8SbbgPcFbGaltasVhsaPcu9kmeaDcefhDalcrfglc8J9hmbkaAhDxekaDcefhDkasce4cbasceG9R7amfgmhAkdndnaXcsSmbaDhsxekaDcefhsaD8SbbglcFeGhPdnalcu9kmbaDcvfhzaPcFbGhPcrhldninas8SbbgDcFbGaltaPVhPaDcu9kmeascefhsalcrfglc8J9hmbkazhsxekascefhskaPce4cbaPceG9R7amfgmhzkdndnaCcsSmbashlxekascefhlas8SbbgDcFeGhPdnaDcu9kmbascvfhOaPcFbGhPcrhDdninal8SbbgscFbGaDtaPVhPascu9kmealcefhlaDcrfgDc8J9hmbkaOhlxekalcefhlkaPce4cbaPceG9R7amfgmhOkdndnadcd9hmbabarcetfgDaA87ebaDclfaO87ebaDcdfaz87ebxekabarcdtfgDaABdbaDcwfaOBdbaDclfazBdbkavc;abfaocitfgDazBdbaDaABdlavaicdtfaABdbavc;abfaocefcsGcitfgDaOBdbaDazBdlavaicefgicsGcdtfazBdbavc;abfaocdfcsGcitfgDaABdbaDaOBdlavaiaHcz6aXcsSVfgicsGcdtfaOBdbaiaCTaCcsSVfhiaocifhokawcefhwaocsGhoaicsGhiarcifgrae6mbkkcbc99alaqSEhokavc;aef8Kjjjjbaok:clevu8Jjjjjbcz9Rhvdnaecvfal9nmbc9:skdnaiRbbc;:eGc;qeSmbcuskav9cb83iwaicefhoaialfc98fhrdnaeTmbdnadcdSmbcbhwindnaoar6mbc9:skaocefhlao8SbbgicFeGhddndnaicu9mmbalhoxekaocvfhoadcFbGhdcrhidninal8SbbgDcFbGaitadVhdaDcu9kmealcefhlaicrfgic8J9hmbxdkkalcefhokabawcdtfadc8Etc8F91adcd47avcwfadceGcdtVglydbfgiBdbalaiBdbawcefgwae9hmbxdkkcbhwindnaoar6mbc9:skaocefhlao8SbbgicFeGhddndnaicu9mmbalhoxekaocvfhoadcFbGhdcrhidninal8SbbgDcFbGaitadVhdaDcu9kmealcefhlaicrfgic8J9hmbxdkkalcefhokabawcetfadc8Etc8F91adcd47avcwfadceGcdtVglydbfgi87ebalaiBdbawcefgwae9hmbkkcbc99aoarSEk:Lvoeue99dud99eud99dndnadcl9hmbaeTmeindndnabcdfgd8Sbb:Yab8Sbbgi:Ygl:l:tabcefgv8Sbbgo:Ygr:l:tgwJbb;:9cawawNJbbbbawawJbbbb9GgDEgq:mgkaqaicb9iEalMgwawNakaqaocb9iEarMgqaqNMM:r:vglNJbbbZJbbb:;aDEMgr:lJbbb9p9DTmbar:Ohixekcjjjj94hikadai86bbdndnaqalNJbbbZJbbb:;aqJbbbb9GEMgq:lJbbb9p9DTmbaq:Ohdxekcjjjj94hdkavad86bbdndnawalNJbbbZJbbb:;awJbbbb9GEMgw:lJbbb9p9DTmbaw:Ohdxekcjjjj94hdkabad86bbabclfhbaecufgembxdkkaeTmbindndnabclfgd8Ueb:Yab8Uebgi:Ygl:l:tabcdfgv8Uebgo:Ygr:l:tgwJb;:FSawawNJbbbbawawJbbbb9GgDEgq:mgkaqaicb9iEalMgwawNakaqaocb9iEarMgqaqNMM:r:vglNJbbbZJbbb:;aDEMgr:lJbbb9p9DTmbar:Ohixekcjjjj94hikadai87ebdndnaqalNJbbbZJbbb:;aqJbbbb9GEMgq:lJbbb9p9DTmbaq:Ohdxekcjjjj94hdkavad87ebdndnawalNJbbbZJbbb:;awJbbbb9GEMgw:lJbbb9p9DTmbaw:Ohdxekcjjjj94hdkabad87ebabcwfhbaecufgembkkk;oiliui99iue99dnaeTmbcbhiabhlindndnJ;Zl81Zalcof8UebgvciV:Y:vgoal8Ueb:YNgrJb;:FSNJbbbZJbbb:;arJbbbb9GEMgw:lJbbb9p9DTmbaw:OhDxekcjjjj94hDkalclf8Uebhqalcdf8UebhkabaiavcefciGfcetfaD87ebdndnaoak:YNgwJb;:FSNJbbbZJbbb:;awJbbbb9GEMgx:lJbbb9p9DTmbax:OhDxekcjjjj94hDkabaiavciGfgkcd7cetfaD87ebdndnaoaq:YNgoJb;:FSNJbbbZJbbb:;aoJbbbb9GEMgx:lJbbb9p9DTmbax:OhDxekcjjjj94hDkabaiavcufciGfcetfaD87ebdndnJbbjZararN:tawawN:taoaoN:tgrJbbbbarJbbbb9GE:rJb;:FSNJbbbZMgr:lJbbb9p9DTmbar:Ohvxekcjjjj94hvkabakcetfav87ebalcwfhlaiclfhiaecufgembkkk9mbdnadcd4ae2gdTmbinababydbgecwtcw91:Yaece91cjjj98Gcjjj;8if::NUdbabclfhbadcufgdmbkkk9teiucbcbyd:K1jjbgeabcifc98GfgbBd:K1jjbdndnabZbcztgd9nmbcuhiabad9RcFFifcz4nbcuSmekaehikaik;teeeudndnaeabVciGTmbabhixekdndnadcz9pmbabhixekabhiinaiaeydbBdbaiaeydlBdlaiaeydwBdwaiaeydxBdxaeczfheaiczfhiadc9Wfgdcs0mbkkadcl6mbinaiaeydbBdbaeclfheaiclfhiadc98fgdci0mbkkdnadTmbinaiaeRbb86bbaicefhiaecefheadcufgdmbkkabk:3eedudndnabciGTmbabhixekaecFeGc:b:c:ew2hldndnadcz9pmbabhixekabhiinaialBdxaialBdwaialBdlaialBdbaiczfhiadc9Wfgdcs0mbkkadcl6mbinaialBdbaiclfhiadc98fgdci0mbkkdnadTmbinaiae86bbaicefhiadcufgdmbkkabkk81dbcjwk8Kbbbbdbbblbbbwbbbbbbbebbbdbbblbbbwbbbbc:Kwkl8WNbb",t="b9H79TebbbeKl9Gbb9Gvuuuuueu9Giuuub9Geueuikqbbebeedddilve9Weeeviebeoweuec:q:6dkr;leDo9TW9T9VV95dbH9F9F939H79T9F9J9H229F9Jt9VV7bb8A9TW79O9V9Wt9F9KW9J9V9KW9wWVtW949c919M9MWVbdY9TW79O9V9Wt9F9KW9J9V9KW69U9KW949c919M9MWVblE9TW79O9V9Wt9F9KW9J9V9KW69U9KW949tWG91W9U9JWbvL9TW79O9V9Wt9F9KW9J9V9KWS9P2tWV9p9JtboK9TW79O9V9Wt9F9KW9J9V9KWS9P2tWV9r919HtbrL9TW79O9V9Wt9F9KW9J9V9KWS9P2tWVT949Wbwl79IV9RbDq;G9Mqlbzik9:evu8Jjjjjbcz9Rhbcbheincbhdcbhiinabcwfadfaicjuaead4ceGglE86bbaialfhiadcefgdcw9hmbkaec:q:yjjbfai86bbaecitc:q1jjbfab8Piw83ibaecefgecjd9hmbkk:183lYud97dur978Jjjjjbcj;kb9Rgv8Kjjjjbc9:hodnalTmbcuhoaiRbbgrc;WeGc:Ge9hmbarcsGgwce0mbc9:hoalcufadcd4cbawEgDadfgrcKcaawEgqaraq0Egk6mbaicefhxavaialfgmar9Rgoad;8qbbcj;abad9Uc;WFbGcjdadca0EhPdndndnadTmbaoadfhscbhzinaeaz9nmdamax9RaD6miabazad2fhHaxaDfhOaPaeaz9RazaPfae6EgAcsfgocl4cifcd4hCavcj;cbfaoc9WGgXcetfhQavcj;cbfaXci2fhLavcj;cbfaXfhKcbhYaoc;ab6h8AincbhodnawTmbaxaYcd4fRbbhokaocFeGhEcbh3avcj;cbfh5indndndndnaEa3cet4ciGgoc9:fPdebdkamaO9RaX6mwavcj;cbfa3aX2faOaX;8qbbaOaAfhOxdkavcj;cbfa3aX2fcbaX;8kbxekamaO9RaC6moaoclVcbawEhraOaCfhocbhidna8Ambamao9Rc;Gb6mbcbhlina5alfhidndndndndndnaOalco4fRbbgqciGarfPDbedibledibkaipxbbbbbbbbbbbbbbbbpklbxlkaiaopbblaopbbbg8Eclp:mea8EpmbzeHdOiAlCvXoQrLg8Ecdp:mea8EpmbzeHdOiAlCvXoQrLpxiiiiiiiiiiiiiiiip9og8Fpxiiiiiiiiiiiiiiiip8Jg8Ep5b9cjF;8;4;W;G;ab9:9cU1:Ngacitc:q1jjbfpbibaac:q:yjjbfRbbgapsa8Ep5e9cjF;8;4;W;G;ab9:9cU1:Nghcitc:q1jjbfpbibp9UpmbedilvorzHOACXQLpPa8Fa8Ep9spklbaaaoclffahc:q:yjjbfRbbfhoxikaiaopbbwaopbbbg8Eclp:mea8EpmbzeHdOiAlCvXoQrLpxssssssssssssssssp9og8Fpxssssssssssssssssp8Jg8Ep5b9cjF;8;4;W;G;ab9:9cU1:Ngacitc:q1jjbfpbibaac:q:yjjbfRbbgapsa8Ep5e9cjF;8;4;W;G;ab9:9cU1:Nghcitc:q1jjbfpbibp9UpmbedilvorzHOACXQLpPa8Fa8Ep9spklbaaaocwffahc:q:yjjbfRbbfhoxdkaiaopbbbpklbaoczfhoxekaiaopbbdaoRbbgacitc:q1jjbfpbibaac:q:yjjbfRbbgapsaoRbeghcitc:q1jjbfpbibp9UpmbedilvorzHOACXQLpPpklbaaaocdffahc:q:yjjbfRbbfhokdndndndndndnaqcd4ciGarfPDbedibledibkaiczfpxbbbbbbbbbbbbbbbbpklbxlkaiczfaopbblaopbbbg8Eclp:mea8EpmbzeHdOiAlCvXoQrLg8Ecdp:mea8EpmbzeHdOiAlCvXoQrLpxiiiiiiiiiiiiiiiip9og8Fpxiiiiiiiiiiiiiiiip8Jg8Ep5b9cjF;8;4;W;G;ab9:9cU1:Ngacitc:q1jjbfpbibaac:q:yjjbfRbbgapsa8Ep5e9cjF;8;4;W;G;ab9:9cU1:Nghcitc:q1jjbfpbibp9UpmbedilvorzHOACXQLpPa8Fa8Ep9spklbaaaoclffahc:q:yjjbfRbbfhoxikaiczfaopbbwaopbbbg8Eclp:mea8EpmbzeHdOiAlCvXoQrLpxssssssssssssssssp9og8Fpxssssssssssssssssp8Jg8Ep5b9cjF;8;4;W;G;ab9:9cU1:Ngacitc:q1jjbfpbibaac:q:yjjbfRbbgapsa8Ep5e9cjF;8;4;W;G;ab9:9cU1:Nghcitc:q1jjbfpbibp9UpmbedilvorzHOACXQLpPa8Fa8Ep9spklbaaaocwffahc:q:yjjbfRbbfhoxdkaiczfaopbbbpklbaoczfhoxekaiczfaopbbdaoRbbgacitc:q1jjbfpbibaac:q:yjjbfRbbgapsaoRbeghcitc:q1jjbfpbibp9UpmbedilvorzHOACXQLpPpklbaaaocdffahc:q:yjjbfRbbfhokdndndndndndnaqcl4ciGarfPDbedibledibkaicafpxbbbbbbbbbbbbbbbbpklbxlkaicafaopbblaopbbbg8Eclp:mea8EpmbzeHdOiAlCvXoQrLg8Ecdp:mea8EpmbzeHdOiAlCvXoQrLpxiiiiiiiiiiiiiiiip9og8Fpxiiiiiiiiiiiiiiiip8Jg8Ep5b9cjF;8;4;W;G;ab9:9cU1:Ngacitc:q1jjbfpbibaac:q:yjjbfRbbgapsa8Ep5e9cjF;8;4;W;G;ab9:9cU1:Nghcitc:q1jjbfpbibp9UpmbedilvorzHOACXQLpPa8Fa8Ep9spklbaaaoclffahc:q:yjjbfRbbfhoxikaicafaopbbwaopbbbg8Eclp:mea8EpmbzeHdOiAlCvXoQrLpxssssssssssssssssp9og8Fpxssssssssssssssssp8Jg8Ep5b9cjF;8;4;W;G;ab9:9cU1:Ngacitc:q1jjbfpbibaac:q:yjjbfRbbgapsa8Ep5e9cjF;8;4;W;G;ab9:9cU1:Nghcitc:q1jjbfpbibp9UpmbedilvorzHOACXQLpPa8Fa8Ep9spklbaaaocwffahc:q:yjjbfRbbfhoxdkaicafaopbbbpklbaoczfhoxekaicafaopbbdaoRbbgacitc:q1jjbfpbibaac:q:yjjbfRbbgapsaoRbeghcitc:q1jjbfpbibp9UpmbedilvorzHOACXQLpPpklbaaaocdffahc:q:yjjbfRbbfhokdndndndndndnaqco4arfPDbedibledibkaic8Wfpxbbbbbbbbbbbbbbbbpklbxlkaic8Wfaopbblaopbbbg8Eclp:mea8EpmbzeHdOiAlCvXoQrLg8Ecdp:mea8EpmbzeHdOiAlCvXoQrLpxiiiiiiiiiiiiiiiip9og8Fpxiiiiiiiiiiiiiiiip8Jg8Ep5b9cjF;8;4;W;G;ab9:9cU1:Ngicitc:q1jjbfpbibaic:q:yjjbfRbbgipsa8Ep5e9cjF;8;4;W;G;ab9:9cU1:Ngqcitc:q1jjbfpbibp9UpmbedilvorzHOACXQLpPa8Fa8Ep9spklbaiaoclffaqc:q:yjjbfRbbfhoxikaic8Wfaopbbwaopbbbg8Eclp:mea8EpmbzeHdOiAlCvXoQrLpxssssssssssssssssp9og8Fpxssssssssssssssssp8Jg8Ep5b9cjF;8;4;W;G;ab9:9cU1:Ngicitc:q1jjbfpbibaic:q:yjjbfRbbgipsa8Ep5e9cjF;8;4;W;G;ab9:9cU1:Ngqcitc:q1jjbfpbibp9UpmbedilvorzHOACXQLpPa8Fa8Ep9spklbaiaocwffaqc:q:yjjbfRbbfhoxdkaic8Wfaopbbbpklbaoczfhoxekaic8WfaopbbdaoRbbgicitc:q1jjbfpbibaic:q:yjjbfRbbgipsaoRbegqcitc:q1jjbfpbibp9UpmbedilvorzHOACXQLpPpklbaiaocdffaqc:q:yjjbfRbbfhokalc;abfhialcjefaX0meaihlamao9Rc;Fb0mbkkdnaiaX9pmbaici4hlinamao9RcK6mwa5aifhqdndndndndndnaOaico4fRbbalcoG4ciGarfPDbedibledibkaqpxbbbbbbbbbbbbbbbbpkbbxlkaqaopbblaopbbbg8Eclp:mea8EpmbzeHdOiAlCvXoQrLg8Ecdp:mea8EpmbzeHdOiAlCvXoQrLpxiiiiiiiiiiiiiiiip9og8Fpxiiiiiiiiiiiiiiiip8Jg8Ep5b9cjF;8;4;W;G;ab9:9cU1:Ngacitc:q1jjbfpbibaac:q:yjjbfRbbgapsa8Ep5e9cjF;8;4;W;G;ab9:9cU1:Nghcitc:q1jjbfpbibp9UpmbedilvorzHOACXQLpPa8Fa8Ep9spkbbaaaoclffahc:q:yjjbfRbbfhoxikaqaopbbwaopbbbg8Eclp:mea8EpmbzeHdOiAlCvXoQrLpxssssssssssssssssp9og8Fpxssssssssssssssssp8Jg8Ep5b9cjF;8;4;W;G;ab9:9cU1:Ngacitc:q1jjbfpbibaac:q:yjjbfRbbgapsa8Ep5e9cjF;8;4;W;G;ab9:9cU1:Nghcitc:q1jjbfpbibp9UpmbedilvorzHOACXQLpPa8Fa8Ep9spkbbaaaocwffahc:q:yjjbfRbbfhoxdkaqaopbbbpkbbaoczfhoxekaqaopbbdaoRbbgacitc:q1jjbfpbibaac:q:yjjbfRbbgapsaoRbeghcitc:q1jjbfpbibp9UpmbedilvorzHOACXQLpPpkbbaaaocdffahc:q:yjjbfRbbfhokalcdfhlaiczfgiaX6mbkkaohOaoTmoka5aXfh5a3cefg3cl9hmbkdndndndnawTmbasaYcd4fRbbglciGPlbedwbkaXTmdavcjdfaYfhlavaYfpbdbhgcbhoinalavcj;cbfaofpblbg8JaKaofpblbg8KpmbzeHdOiAlCvXoQrLg8LaQaofpblbg8MaLaofpblbg8NpmbzeHdOiAlCvXoQrLgypmbezHdiOAlvCXorQLg8Ecep9Ta8Epxeeeeeeeeeeeeeeeeg8Fp9op9Hp9rg8Eagp9Uggp9Abbbaladfglaga8Ea8Epmlvorlvorlvorlvorp9Uggp9Abbbaladfglaga8Ea8EpmwDqkwDqkwDqkwDqkp9Uggp9Abbbaladfglaga8Ea8EpmxmPsxmPsxmPsxmPsp9Uggp9Abbbaladfglaga8LaypmwDKYqk8AExm35Ps8E8Fg8Ecep9Ta8Ea8Fp9op9Hp9rg8Ep9Uggp9Abbbaladfglaga8Ea8Epmlvorlvorlvorlvorp9Uggp9Abbbaladfglaga8Ea8EpmwDqkwDqkwDqkwDqkp9Uggp9Abbbaladfglaga8Ea8EpmxmPsxmPsxmPsxmPsp9Uggp9Abbbaladfglaga8Ja8KpmwKDYq8AkEx3m5P8Es8Fg8Ja8Ma8NpmwKDYq8AkEx3m5P8Es8Fg8KpmbezHdiOAlvCXorQLg8Ecep9Ta8Ea8Fp9op9Hp9rg8Ep9Uggp9Abbbaladfglaga8Ea8Epmlvorlvorlvorlvorp9Uggp9Abbbaladfglaga8Ea8EpmwDqkwDqkwDqkwDqkp9Uggp9Abbbaladfglaga8Ea8EpmxmPsxmPsxmPsxmPsp9Uggp9Abbbaladfglaga8Ja8KpmwDKYqk8AExm35Ps8E8Fg8Ecep9Ta8Ea8Fp9op9Hp9rg8Ep9Ug8Fp9Abbbaladfgla8Fa8Ea8Epmlvorlvorlvorlvorp9Ug8Fp9Abbbaladfgla8Fa8Ea8EpmwDqkwDqkwDqkwDqkp9Ug8Fp9Abbbaladfgla8Fa8Ea8EpmxmPsxmPsxmPsxmPsp9Uggp9AbbbaladfhlaoczfgoaX6mbxikkaXTmeavcjdfaYfhlavaYfpbdbhgcbhoinalavcj;cbfaofpblbg8JaKaofpblbg8KpmbzeHdOiAlCvXoQrLg8LaQaofpblbg8MaLaofpblbg8NpmbzeHdOiAlCvXoQrLgypmbezHdiOAlvCXorQLg8Ecep:nea8Epxebebebebebebebebg8Fp9op:bep9rg8Eagp:oeggp9Abbbaladfglaga8Ea8Epmlvorlvorlvorlvorp:oeggp9Abbbaladfglaga8Ea8EpmwDqkwDqkwDqkwDqkp:oeggp9Abbbaladfglaga8Ea8EpmxmPsxmPsxmPsxmPsp:oeggp9Abbbaladfglaga8LaypmwDKYqk8AExm35Ps8E8Fg8Ecep:nea8Ea8Fp9op:bep9rg8Ep:oeggp9Abbbaladfglaga8Ea8Epmlvorlvorlvorlvorp:oeggp9Abbbaladfglaga8Ea8EpmwDqkwDqkwDqkwDqkp:oeggp9Abbbaladfglaga8Ea8EpmxmPsxmPsxmPsxmPsp:oeggp9Abbbaladfglaga8Ja8KpmwKDYq8AkEx3m5P8Es8Fg8Ja8Ma8NpmwKDYq8AkEx3m5P8Es8Fg8KpmbezHdiOAlvCXorQLg8Ecep:nea8Ea8Fp9op:bep9rg8Ep:oeggp9Abbbaladfglaga8Ea8Epmlvorlvorlvorlvorp:oeggp9Abbbaladfglaga8Ea8EpmwDqkwDqkwDqkwDqkp:oeggp9Abbbaladfglaga8Ea8EpmxmPsxmPsxmPsxmPsp:oeggp9Abbbaladfglaga8Ja8KpmwDKYqk8AExm35Ps8E8Fg8Ecep:nea8Ea8Fp9op:bep9rg8Ep:oeg8Fp9Abbbaladfgla8Fa8Ea8Epmlvorlvorlvorlvorp:oeg8Fp9Abbbaladfgla8Fa8Ea8EpmwDqkwDqkwDqkwDqkp:oeg8Fp9Abbbaladfgla8Fa8Ea8EpmxmPsxmPsxmPsxmPsp:oeggp9AbbbaladfhlaoczfgoaX6mbxdkkaXTmbcbhocbalcl4gl9Rc8FGhiavcjdfaYfhravaYfpbdbh8Finaravcj;cbfaofpblbggaKaofpblbg8JpmbzeHdOiAlCvXoQrLg8KaQaofpblbg8LaLaofpblbg8MpmbzeHdOiAlCvXoQrLg8NpmbezHdiOAlvCXorQLg8Eaip:Rea8Ealp:Sep9qg8Ea8Fp9rg8Fp9Abbbaradfgra8Fa8Ea8Epmlvorlvorlvorlvorp9rg8Fp9Abbbaradfgra8Fa8Ea8EpmwDqkwDqkwDqkwDqkp9rg8Fp9Abbbaradfgra8Fa8Ea8EpmxmPsxmPsxmPsxmPsp9rg8Fp9Abbbaradfgra8Fa8Ka8NpmwDKYqk8AExm35Ps8E8Fg8Eaip:Rea8Ealp:Sep9qg8Ep9rg8Fp9Abbbaradfgra8Fa8Ea8Epmlvorlvorlvorlvorp9rg8Fp9Abbbaradfgra8Fa8Ea8EpmwDqkwDqkwDqkwDqkp9rg8Fp9Abbbaradfgra8Fa8Ea8EpmxmPsxmPsxmPsxmPsp9rg8Fp9Abbbaradfgra8Faga8JpmwKDYq8AkEx3m5P8Es8Fgga8La8MpmwKDYq8AkEx3m5P8Es8Fg8JpmbezHdiOAlvCXorQLg8Eaip:Rea8Ealp:Sep9qg8Ep9rg8Fp9Abbbaradfgra8Fa8Ea8Epmlvorlvorlvorlvorp9rg8Fp9Abbbaradfgra8Fa8Ea8EpmwDqkwDqkwDqkwDqkp9rg8Fp9Abbbaradfgra8Fa8Ea8EpmxmPsxmPsxmPsxmPsp9rg8Fp9Abbbaradfgra8Faga8JpmwDKYqk8AExm35Ps8E8Fg8Eaip:Rea8Ealp:Sep9qg8Ep9rg8Fp9Abbbaradfgra8Fa8Ea8Epmlvorlvorlvorlvorp9rg8Fp9Abbbaradfgra8Fa8Ea8EpmwDqkwDqkwDqkwDqkp9rg8Fp9Abbbaradfgra8Fa8Ea8EpmxmPsxmPsxmPsxmPsp9rg8Fp9AbbbaradfhraoczfgoaX6mbkkaYclfgYad6mbkaHavcjdfaAad2;8qbbavavcjdfaAcufad2fad;8qbbaAazfhzc9:hoaOhxaOmbxlkkaeTmbaDalfhrcbhocuhlinaralaD9RglfaD6mdaPaeao9RaoaPfae6Eaofgoae6mbkaial9Rhxkcbc99amax9RakSEhoxekc9:hokavcj;kbf8Kjjjjbaokwbz:bjjjbk:TseHu8Jjjjjbc;ae9Rgv8Kjjjjbc9:hodnaeci9UgrcHfal0mbcuhoaiRbbgwc;WeGc;Ge9hmbawcsGgDce0mbavc;abfcFecje;8kbavcUf9cu83ibavc8Wf9cu83ibavcyf9cu83ibavcaf9cu83ibavcKf9cu83ibavczf9cu83ibav9cu83iwav9cu83ibaialfc9WfhqaicefgwarfhldnaeTmbcmcsaDceSEhkcbhxcbhmcbhrcbhicbhoindnalaq9nmbc9:hoxikdndnawRbbgDc;Ve0mbavc;abfaoaDcu7gPcl4fcsGcitfgsydlhzasydbhHdndnaDcsGgsak9pmbavaiaPfcsGcdtfydbaxasEhDaxasTgOfhxxekdndnascsSmbcehOasc987asamffcefhDxekalcefhDal8SbbgscFeGhPdndnascu9mmbaDhlxekalcvfhlaPcFbGhPcrhsdninaD8SbbgOcFbGastaPVhPaOcu9kmeaDcefhDascrfgsc8J9hmbxdkkaDcefhlkcehOaPce4cbaPceG9R7amfhDkaDhmkavc;abfaocitfgsaDBdbasazBdlavaicdtfaDBdbavc;abfaocefcsGcitfgsaHBdbasaDBdlaocdfhoaOaifhidnadcd9hmbabarcetfgsaH87ebasclfaD87ebascdfaz87ebxdkabarcdtfgsaHBdbascwfaDBdbasclfazBdbxekdnaDcpe0mbaxcefgOavaiaqaDcsGfRbbgscl49RcsGcdtfydbascz6gPEhDavaias9RcsGcdtfydbaOaPfgzascsGgOEhsaOThOdndnadcd9hmbabarcetfgHax87ebaHclfas87ebaHcdfaD87ebxekabarcdtfgHaxBdbaHcwfasBdbaHclfaDBdbkavaicdtfaxBdbavc;abfaocitfgHaDBdbaHaxBdlavaicefgicsGcdtfaDBdbavc;abfaocefcsGcitfgHasBdbaHaDBdlavaiaPfgicsGcdtfasBdbavc;abfaocdfcsGcitfgDaxBdbaDasBdlaocifhoaiaOfhiazaOfhxxekaxcbalRbbgHEgAaDc;:eSgDfhzaHcsGhCaHcl4hXdndnaHcs0mbazcefhOxekazhOavaiaX9RcsGcdtfydbhzkdndnaCmbaOcefhxxekaOhxavaiaH9RcsGcdtfydbhOkdndnaDTmbalcefhDxekalcdfhDal8SbegPcFeGhsdnaPcu9kmbalcofhAascFbGhscrhldninaD8SbbgPcFbGaltasVhsaPcu9kmeaDcefhDalcrfglc8J9hmbkaAhDxekaDcefhDkasce4cbasceG9R7amfgmhAkdndnaXcsSmbaDhsxekaDcefhsaD8SbbglcFeGhPdnalcu9kmbaDcvfhzaPcFbGhPcrhldninas8SbbgDcFbGaltaPVhPaDcu9kmeascefhsalcrfglc8J9hmbkazhsxekascefhskaPce4cbaPceG9R7amfgmhzkdndnaCcsSmbashlxekascefhlas8SbbgDcFeGhPdnaDcu9kmbascvfhOaPcFbGhPcrhDdninal8SbbgscFbGaDtaPVhPascu9kmealcefhlaDcrfgDc8J9hmbkaOhlxekalcefhlkaPce4cbaPceG9R7amfgmhOkdndnadcd9hmbabarcetfgDaA87ebaDclfaO87ebaDcdfaz87ebxekabarcdtfgDaABdbaDcwfaOBdbaDclfazBdbkavc;abfaocitfgDazBdbaDaABdlavaicdtfaABdbavc;abfaocefcsGcitfgDaOBdbaDazBdlavaicefgicsGcdtfazBdbavc;abfaocdfcsGcitfgDaABdbaDaOBdlavaiaHcz6aXcsSVfgicsGcdtfaOBdbaiaCTaCcsSVfhiaocifhokawcefhwaocsGhoaicsGhiarcifgrae6mbkkcbc99alaqSEhokavc;aef8Kjjjjbaok:clevu8Jjjjjbcz9Rhvdnaecvfal9nmbc9:skdnaiRbbc;:eGc;qeSmbcuskav9cb83iwaicefhoaialfc98fhrdnaeTmbdnadcdSmbcbhwindnaoar6mbc9:skaocefhlao8SbbgicFeGhddndnaicu9mmbalhoxekaocvfhoadcFbGhdcrhidninal8SbbgDcFbGaitadVhdaDcu9kmealcefhlaicrfgic8J9hmbxdkkalcefhokabawcdtfadc8Etc8F91adcd47avcwfadceGcdtVglydbfgiBdbalaiBdbawcefgwae9hmbxdkkcbhwindnaoar6mbc9:skaocefhlao8SbbgicFeGhddndnaicu9mmbalhoxekaocvfhoadcFbGhdcrhidninal8SbbgDcFbGaitadVhdaDcu9kmealcefhlaicrfgic8J9hmbxdkkalcefhokabawcetfadc8Etc8F91adcd47avcwfadceGcdtVglydbfgi87ebalaiBdbawcefgwae9hmbkkcbc99aoarSEk:SPliuo97eue978Jjjjjbca9Rhiaec98Ghldndnadcl9hmbdnalTmbcbhvabhdinadadpbbbgocKp:RecKp:Sep;6egraocwp:RecKp:Sep;6earp;Geaoczp:RecKp:Sep;6egwp;Gep;Kep;LegDpxbbbbbbbbbbbbbbbbp:2egqarpxbbbjbbbjbbbjbbbjgkp9op9rp;Kegrpxbb;:9cbb;:9cbb;:9cbb;:9cararp;MeaDaDp;Meawaqawakp9op9rp;Kegrarp;Mep;Kep;Kep;Jep;Negwp;Mepxbbn0bbn0bbn0bbn0gqp;KepxFbbbFbbbFbbbFbbbp9oaopxbbbFbbbFbbbFbbbFp9op9qarawp;Meaqp;Kecwp:RepxbFbbbFbbbFbbbFbbp9op9qaDawp;Meaqp;Keczp:RepxbbFbbbFbbbFbbbFbp9op9qpkbbadczfhdavclfgval6mbkkalaeSmeaipxbbbbbbbbbbbbbbbbgqpklbaiabalcdtfgdaeciGglcdtgv;8qbbdnalTmbaiaipblbgocKp:RecKp:Sep;6egraocwp:RecKp:Sep;6earp;Geaoczp:RecKp:Sep;6egwp;Gep;Kep;LegDaqp:2egqarpxbbbjbbbjbbbjbbbjgkp9op9rp;Kegrpxbb;:9cbb;:9cbb;:9cbb;:9cararp;MeaDaDp;Meawaqawakp9op9rp;Kegrarp;Mep;Kep;Kep;Jep;Negwp;Mepxbbn0bbn0bbn0bbn0gqp;KepxFbbbFbbbFbbbFbbbp9oaopxbbbFbbbFbbbFbbbFp9op9qarawp;Meaqp;Kecwp:RepxbFbbbFbbbFbbbFbbp9op9qaDawp;Meaqp;Keczp:RepxbbFbbbFbbbFbbbFbp9op9qpklbkadaiav;8qbbskdnalTmbcbhvabhdinadczfgxaxpbbbgopxbbbbbbFFbbbbbbFFgkp9oadpbbbgDaopmbediwDqkzHOAKY8AEgwczp:Reczp:Sep;6egraDaopmlvorxmPsCXQL358E8FpxFubbFubbFubbFubbp9op;7eawczp:Sep;6egwp;Gearp;Gep;Kep;Legopxbbbbbbbbbbbbbbbbp:2egqarpxbbbjbbbjbbbjbbbjgmp9op9rp;Kegrpxb;:FSb;:FSb;:FSb;:FSararp;Meaoaop;Meawaqawamp9op9rp;Kegrarp;Mep;Kep;Kep;Jep;Negwp;Mepxbbn0bbn0bbn0bbn0gqp;KepxFFbbFFbbFFbbFFbbp9oaoawp;Meaqp;Keczp:Rep9qgoarawp;Meaqp;KepxFFbbFFbbFFbbFFbbp9ogrpmwDKYqk8AExm35Ps8E8Fp9qpkbbadaDakp9oaoarpmbezHdiOAlvCXorQLp9qpkbbadcafhdavclfgval6mbkkalaeSmbaiczfpxbbbbbbbbbbbbbbbbgopklbaiaopklbaiabalcitfgdaeciGglcitgv;8qbbdnalTmbaiaipblzgopxbbbbbbFFbbbbbbFFgkp9oaipblbgDaopmbediwDqkzHOAKY8AEgwczp:Reczp:Sep;6egraDaopmlvorxmPsCXQL358E8FpxFubbFubbFubbFubbp9op;7eawczp:Sep;6egwp;Gearp;Gep;Kep;Legopxbbbbbbbbbbbbbbbbp:2egqarpxbbbjbbbjbbbjbbbjgmp9op9rp;Kegrpxb;:FSb;:FSb;:FSb;:FSararp;Meaoaop;Meawaqawamp9op9rp;Kegrarp;Mep;Kep;Kep;Jep;Negwp;Mepxbbn0bbn0bbn0bbn0gqp;KepxFFbbFFbbFFbbFFbbp9oaoawp;Meaqp;Keczp:Rep9qgoarawp;Meaqp;KepxFFbbFFbbFFbbFFbbp9ogrpmwDKYqk8AExm35Ps8E8Fp9qpklzaiaDakp9oaoarpmbezHdiOAlvCXorQLp9qpklbkadaiav;8qbbkk:oDllue97euv978Jjjjjbc8W9Rhidnaec98GglTmbcbhvabhoinaiaopbbbgraoczfgwpbbbgDpmlvorxmPsCXQL358E8Fgqczp:Segkclp:RepklbaopxbbjZbbjZbbjZbbjZpx;Zl81Z;Zl81Z;Zl81Z;Zl81Zakpxibbbibbbibbbibbbp9qp;6ep;NegkaraDpmbediwDqkzHOAKY8AEgrczp:Reczp:Sep;6ep;MegDaDp;Meakarczp:Sep;6ep;Megxaxp;Meakaqczp:Reczp:Sep;6ep;Megqaqp;Mep;Kep;Kep;Lepxbbbbbbbbbbbbbbbbp:4ep;Jepxb;:FSb;:FSb;:FSb;:FSgkp;Mepxbbn0bbn0bbn0bbn0grp;KepxFFbbFFbbFFbbFFbbgmp9oaxakp;Mearp;Keczp:Rep9qgxaDakp;Mearp;Keamp9oaqakp;Mearp;Keczp:Rep9qgkpmbezHdiOAlvCXorQLgrp5baipblbpEb:T:j83ibaocwfarp5eaipblbpEe:T:j83ibawaxakpmwDKYqk8AExm35Ps8E8Fgkp5baipblbpEd:T:j83ibaocKfakp5eaipblbpEi:T:j83ibaocafhoavclfgval6mbkkdnalaeSmbaiczfpxbbbbbbbbbbbbbbbbgkpklbaiakpklbaiabalcitfgoaeciGgvcitgw;8qbbdnavTmbaiaipblbgraipblzgDpmlvorxmPsCXQL358E8Fgqczp:Segkclp:RepklaaipxbbjZbbjZbbjZbbjZpx;Zl81Z;Zl81Z;Zl81Z;Zl81Zakpxibbbibbbibbbibbbp9qp;6ep;NegkaraDpmbediwDqkzHOAKY8AEgrczp:Reczp:Sep;6ep;MegDaDp;Meakarczp:Sep;6ep;Megxaxp;Meakaqczp:Reczp:Sep;6ep;Megqaqp;Mep;Kep;Kep;Lepxbbbbbbbbbbbbbbbbp:4ep;Jepxb;:FSb;:FSb;:FSb;:FSgkp;Mepxbbn0bbn0bbn0bbn0grp;KepxFFbbFFbbFFbbFFbbgmp9oaxakp;Mearp;Keczp:Rep9qgxaDakp;Mearp;Keamp9oaqakp;Mearp;Keczp:Rep9qgkpmbezHdiOAlvCXorQLgrp5baipblapEb:T:j83ibaiarp5eaipblapEe:T:j83iwaiaxakpmwDKYqk8AExm35Ps8E8Fgkp5baipblapEd:T:j83izaiakp5eaipblapEi:T:j83iKkaoaiaw;8qbbkk;uddiue978Jjjjjbc;ab9Rhidnadcd4ae2glc98GgvTmbcbheabhdinadadpbbbgocwp:Recwp:Sep;6eaocep:SepxbbjFbbjFbbjFbbjFp9opxbbjZbbjZbbjZbbjZp:Uep;Mepkbbadczfhdaeclfgeav6mbkkdnavalSmbaic8WfpxbbbbbbbbbbbbbbbbgopklbaicafaopklbaiczfaopklbaiaopklbaiabavcdtfgdalciGgecdtgv;8qbbdnaeTmbaiaipblbgocwp:Recwp:Sep;6eaocep:SepxbbjFbbjFbbjFbbjFp9opxbbjZbbjZbbjZbbjZp:Uep;Mepklbkadaiav;8qbbkk9teiucbcbydj1jjbgeabcifc98GfgbBdj1jjbdndnabZbcztgd9nmbcuhiabad9RcFFifcz4nbcuSmekaehikaikkkebcjwklz:Dbb",r=new Uint8Array([0,97,115,109,1,0,0,0,1,4,1,96,0,0,3,3,2,0,0,5,3,1,0,1,12,1,0,10,22,2,12,0,65,0,65,0,65,0,252,10,0,0,11,7,0,65,0,253,15,26,11]),a=new Uint8Array([32,0,65,2,1,106,34,33,3,128,11,4,13,64,6,253,10,7,15,116,127,5,8,12,40,16,19,54,20,9,27,255,113,17,42,67,24,23,146,148,18,14,22,45,70,69,56,114,101,21,25,63,75,136,108,28,118,29,73,115]);if(typeof WebAssembly!="object")return{supported:!1};var s=WebAssembly.validate(r)?o(t):o(e),n,i=WebAssembly.instantiate(s,{}).then(function(g){n=g.instance,n.exports.__wasm_call_ctors()});function o(g){for(var y=new Uint8Array(g.length),x=0;x<g.length;++x){var v=g.charCodeAt(x);y[x]=v>96?v-97:v>64?v-39:v+4}for(var E=0,x=0;x<g.length;++x)y[E++]=y[x]<60?a[y[x]]:(y[x]-60)*64+y[++x];return y.buffer.slice(0,E)}function c(g,y,x,v,E,S,T){var _=g.exports.sbrk,I=v+3&-4,N=_(I*E),C=_(S.length),B=new Uint8Array(g.exports.memory.buffer);B.set(S,C);var R=y(N,v,E,C,S.length);if(R==0&&T&&T(N,I,E),x.set(B.subarray(N,N+v*E)),_(N-_(0)),R!=0)throw new Error("Malformed buffer data: "+R)}var l={NONE:"",OCTAHEDRAL:"meshopt_decodeFilterOct",QUATERNION:"meshopt_decodeFilterQuat",EXPONENTIAL:"meshopt_decodeFilterExp"},f={ATTRIBUTES:"meshopt_decodeVertexBuffer",TRIANGLES:"meshopt_decodeIndexBuffer",INDICES:"meshopt_decodeIndexSequence"},d=[],p=0;function b(g){var y={object:new Worker(g),pending:0,requests:{}};return y.object.onmessage=function(x){var v=x.data;y.pending-=v.count,y.requests[v.id][v.action](v.value),delete y.requests[v.id]},y}function h(g){for(var y="self.ready = WebAssembly.instantiate(new Uint8Array(["+new Uint8Array(s)+"]), {}).then(function(result) { result.instance.exports.__wasm_call_ctors(); return result.instance; });self.onmessage = "+m.name+";"+c.toString()+m.toString(),x=new Blob([y],{type:"text/javascript"}),v=URL.createObjectURL(x),E=d.length;E<g;++E)d[E]=b(v);for(var E=g;E<d.length;++E)d[E].object.postMessage({});d.length=g,URL.revokeObjectURL(v)}function u(g,y,x,v,E){for(var S=d[0],T=1;T<d.length;++T)d[T].pending<S.pending&&(S=d[T]);return new Promise(function(_,I){var N=new Uint8Array(x),C=++p;S.pending+=g,S.requests[C]={resolve:_,reject:I},S.object.postMessage({id:C,count:g,size:y,source:N,mode:v,filter:E},[N.buffer])})}function m(g){var y=g.data;if(!y.id)return self.close();self.ready.then(function(x){try{var v=new Uint8Array(y.count*y.size);c(x,x.exports[y.mode],v,y.count,y.size,y.source,x.exports[y.filter]),self.postMessage({id:y.id,count:y.count,action:"resolve",value:v},[v.buffer])}catch(E){self.postMessage({id:y.id,count:y.count,action:"reject",value:E})}})}return{ready:i,supported:!0,useWorkers:function(g){h(g)},decodeVertexBuffer:function(g,y,x,v,E){c(n,n.exports.meshopt_decodeVertexBuffer,g,y,x,v,n.exports[l[E]])},decodeIndexBuffer:function(g,y,x,v){c(n,n.exports.meshopt_decodeIndexBuffer,g,y,x,v)},decodeIndexSequence:function(g,y,x,v){c(n,n.exports.meshopt_decodeIndexSequence,g,y,x,v)},decodeGltfBuffer:function(g,y,x,v,E,S){c(n,n.exports[f[E]],g,y,x,v,n.exports[l[S]])},decodeGltfBufferAsync:function(g,y,x,v,E){return d.length>0?u(g,y,x,f[v],l[E]):i.then(function(){var S=new Uint8Array(g*y);return c(n,n.exports[f[v]],S,g,y,x,n.exports[l[E]]),S})}}})();var GT=(function(){var e="b9H79Tebbbetm9Geueu9Geub9Gbb9Gsuuuuuuuuuuuu99uueu9Gvuuuuub9Gruuuuuuub9Gvuuuuue999Gvuuuuueu9Gquuuuuuu99uueu9Gwuuuuuu99ueu9Giuuue999Gluuuueu9GiuuueuiOHdilvorlwiDqkbxxbelve9Weiiviebeoweuec:G:Pdkr:Tewo9TW9T9VV95dbH9F9F939H79T9F9J9H229F9Jt9VV7bbz9TW79O9V9Wt9F79P9T9W29P9M95br8E9TW79O9V9Wt9F79P9T9W29P9M959x9Pt9OcttV9P9I91tW7bwQ9TW79O9V9Wt9F79P9T9W29P9M959q9V9P9Ut7bDX9TW79O9V9Wt9F79P9T9W29P9M959t9J9H2Wbqa9TW79O9V9Wt9F9V9Wt9P9T9P96W9wWVtW94SWt9J9O9sW9T9H9Wbkl79IV9RbxDwebcekdzsq;B:xeHdbkM9Hi8Au8A99Au8Jjjjjbc;W;qb9Rgs8Kjjjjbcbhzascxfcbc;Kbz:ojjjb8AdnabaeSmbabaeadcdtz:njjjb8AkdndnamcdGmbascxfhHcbhOxekasalcrfci4gecbyd:m:jjjbHjjjjbbgABdxasceBd2aAcbaez:ojjjbhCcbhlcbhednadTmbcbhlabheadhAinaCaeydbgXci4fgQaQRbbgQceaXcrGgXtV86bbaQcu7aX4ceGalfhlaeclfheaAcufgAmbkcualcdtalcFFFFi0EhekascCfhHasaecbyd:m:jjjbHjjjjbbgOBdzascdBd2alcd4alfhXcehAinaAgecethAaeaX6mbkcdhzcbhLascuaecdtgAaecFFFFi0Ecbyd:m:jjjbHjjjjbbgXBdCasciBd2aXcFeaAz:ojjjbhKdnadTmbaecufhYcbh8AindndnaKabaLcdtfgEydbgQc:v;t;h;Ev2aYGgXcdtfgCydbgAcuSmbceheinaOaAcdtfydbaQSmdaXaefhAaecefheaKaAaYGgXcdtfgCydbgAcu9hmbkkaOa8AcdtfaQBdbaCa8ABdba8AhAa8Acefh8AkaEaABdbaLcefgLad9hmbkkaKcbyd1:jjjbH:bjjjbbascdBd2kcbh3aHcualcefgecdtaecFFFFi0Ecbyd:m:jjjbHjjjjbbg5Bdbasa5BdlasazceVgeBd2ascxfaecdtfcuadcitadcFFFFe0Ecbyd:m:jjjbHjjjjbbg8EBdbasa8EBdwasazcdfgeBd2asclfabadalcbz:cjjjbascxfaecdtfcualcdtgealcFFFFi0Eg8Fcbyd:m:jjjbHjjjjbbgABdbasazcifgXBd2ascxfaXcdtfa8Fcbyd:m:jjjbHjjjjbbgaBdbasazclVBd2aAaaaialavaOascxfz:djjjbalcbyd:m:jjjbHjjjjbbhCascxfasyd2ghcdtfaCBdbasahcefgXBd2ascxfaXcdtfa8Fcbyd:m:jjjbHjjjjbbgXBdbasahcdfgQBd2ascxfaQcdtfa8Fcbyd:m:jjjbHjjjjbbgQBdbasahcifggBd2aXcFeaez:ojjjbh8JaQcFeaez:ojjjbh8KdnalTmba8Ecwfh8Lindna5a3gQcefg3cdtfydbgKa5aQcdtgefydbgXSmbaKaX9Rhza8EaXcitfhHa8Kaefh8Ma8JaefhEcbhYindndnaHaYcitfydbg8AaQ9hmbaEaQBdba8MaQBdbxekdna5a8Acdtg8NfgeclfydbgXaeydbgeSmba8EaecitgKfydbaQSmeaXae9Rhyaecu7aXfhLa8LaKfhXcbheinaLaeSmeaecefheaXydbhKaXcwfhXaKaQ9hmbkaeay6meka8Ka8NfgeaQa8AaeydbcuSEBdbaEa8AaQaEydbcuSEBdbkaYcefgYaz9hmbkka3al9hmbkaAhXaahQa8KhKa8JhYcbheindndnaeaXydbg8A9hmbdnaeaQydbg8A9hmbaYydbh8AdnaKydbgLcu9hmba8Acu9hmbaCaefcb86bbxikaCaefhEdnaeaLSmbaea8ASmbaEce86bbxikaEcl86bbxdkdnaeaaa8AcdtgLfydb9hmbdnaKydbgEcuSmbaeaESmbaYydbgzcuSmbaeazSmba8KaLfydbgHcuSmbaHa8ASmba8JaLfydbgLcuSmbaLa8ASmbdnaAaEcdtfydbg8AaAaLcdtfydb9hmba8AaAazcdtfydbgLSmbaLaAaHcdtfydb9hmbaCaefcd86bbxlkaCaefcl86bbxikaCaefcl86bbxdkaCaefcl86bbxekaCaefaCa8AfRbb86bbkaXclfhXaQclfhQaKclfhKaYclfhYalaecefge9hmbkdnaqTmbdndnaOTmbaOheaAhXalhQindnaqaeydbfRbbTmbaCaXydbfcl86bbkaeclfheaXclfhXaQcufgQmbxdkkaAhealhXindnaqRbbTmbaCaeydbfcl86bbkaqcefhqaeclfheaXcufgXmbkkaAhealhQaChXindnaCaeydbfRbbcl9hmbaXcl86bbkaeclfheaXcefhXaQcufgQmbkkamceGTmbaChealhXindnaeRbbce9hmbaecl86bbkaecefheaXcufgXmbkkascxfagcdtfcualcx2alc;v:Q;v:Qe0Ecbyd:m:jjjbHjjjjbbg3BdbasahclfgHBd2a3aialavaOz:ejjjbh8PdndnaDmbcbhgcbh8Lxekcbh8LawhecbhXindnaeIdbJbbbb9ETmbasc;Wbfa8LcdtfaXBdba8Lcefh8LkaeclfheaDaXcefgX9hmbkascxfaHcdtfcua8Lal2gecdtaecFFFFi0Ecbyd:m:jjjbHjjjjbbggBdbasahcvfgHBd2alTmba8LTmbarcd4hEdnaOTmba8Lcdthzcbh8AaghLinaoaOa8AcdtfydbaE2cdtfhYasc;WbfheaLhXa8LhQinaXaYaeydbcdtgKfIdbawaKfIdbNUdbaeclfheaXclfhXaQcufgQmbkaLazfhLa8Acefg8Aal9hmbxdkka8Lcdthzcbh8AaghLinaoa8AaE2cdtfhYasc;WbfheaLhXa8LhQinaXaYaeydbcdtgKfIdbawaKfIdbNUdbaeclfheaXclfhXaQcufgQmbkaLazfhLa8Acefg8Aal9hmbkkascxfaHcdtfcualc8S2gealc;D;O;f8U0EgQcbyd:m:jjjbHjjjjbbgXBdbasaHcefgKBd2aXcbaez:ojjjbhqdndndna8LTmbascxfaKcdtfaQcbyd:m:jjjbHjjjjbbgvBdbasaHcdfgXBd2avcbaez:ojjjb8AascxfaXcdtfcua8Lal2gecltgXaecFFFFb0Ecbyd:m:jjjbHjjjjbbgiBdbasaHcifBd2aicbaXz:ojjjb8AadmexdkcbhvcbhiadTmekcbhYabhXindna3aXclfydbg8Acx2fgeIdba3aXydbgLcx2fgQIdbgI:tg8Ra3aXcwfydbgEcx2fgKIdlaQIdlg8S:tgRNaKIdbaI:tg8UaeIdla8S:tg8VN:tg8Wa8WNa8VaKIdwaQIdwg8X:tg8YNaRaeIdwa8X:tg8VN:tgRaRNa8Va8UNa8Ya8RN:tg8Ra8RNMM:rg8UJbbbb9ETmba8Wa8U:vh8Wa8Ra8U:vh8RaRa8U:vhRkaqaAaLcdtfydbc8S2fgeaRa8U:rg8UaRNNg8VaeIdbMUdbaea8Ra8Ua8RNg8ZNg8YaeIdlMUdlaea8Wa8Ua8WNg80Ng81aeIdwMUdwaea8ZaRNg8ZaeIdxMUdxaea80aRNgBaeIdzMUdzaea80a8RNg80aeIdCMUdCaeaRa8Ua8Wa8XNaRaINa8Sa8RNMM:mg8SNgINgRaeIdKMUdKaea8RaINg8RaeId3MUd3aea8WaINg8WaeIdaMUdaaeaIa8SNgIaeId8KMUd8Kaea8UaeIdyMUdyaqaAa8Acdtfydbc8S2fgea8VaeIdbMUdbaea8YaeIdlMUdlaea81aeIdwMUdwaea8ZaeIdxMUdxaeaBaeIdzMUdzaea80aeIdCMUdCaeaRaeIdKMUdKaea8RaeId3MUd3aea8WaeIdaMUdaaeaIaeId8KMUd8Kaea8UaeIdyMUdyaqaAaEcdtfydbc8S2fgea8VaeIdbMUdbaea8YaeIdlMUdlaea81aeIdwMUdwaea8ZaeIdxMUdxaeaBaeIdzMUdzaea80aeIdCMUdCaeaRaeIdKMUdKaea8RaeId3MUd3aea8WaeIdaMUdaaeaIaeId8KMUd8Kaea8UaeIdyMUdyaXcxfhXaYcifgYad6mbkcbhzabhLinabazcdtfh8AcbhXinaCa8AaXc;a1jjbfydbcdtfydbgQfRbbhedndnaCaLaXfydbgKfRbbgYc99fcFeGcpe0mbaec99fcFeGc;:e6mekdnaYcufcFeGce0mba8JaKcdtfydbaQ9hmekdnaecufcFeGce0mba8KaQcdtfydbaK9hmekdnaYcv2aefc:G1jjbfRbbTmbaAaQcdtfydbaAaKcdtfydb0mekJbbacJbbacJbbjZaecFeGceSEaYceSEh80dna3a8AaXc;e1jjbfydbcdtfydbcx2fgeIdwa3aKcx2fgYIdwg8S:tg8Wa3aQcx2fgEIdwa8S:tgRaRNaEIdbaYIdbg8X:tg8Ra8RNaEIdlaYIdlg8V:tg8Ua8UNMMgINa8WaRNaeIdba8X:tg81a8RNa8UaeIdla8V:tg8ZNMMg8YaRN:tg8Wa8WNa81aINa8Ya8RN:tgRaRNa8ZaINa8Ya8UN:tg8Ra8RNMM:rg8UJbbbb9ETmba8Wa8U:vh8Wa8Ra8U:vh8RaRa8U:vhRkaqaAaKcdtfydbc8S2fgeaRa80aI:rNg8UaRNNg8YaeIdbMUdbaea8Ra8Ua8RNg80Ng81aeIdlMUdlaea8Wa8Ua8WNgINg8ZaeIdwMUdwaea80aRNg80aeIdxMUdxaeaIaRNgBaeIdzMUdzaeaIa8RNg83aeIdCMUdCaeaRa8Ua8Wa8SNaRa8XNa8Va8RNMM:mg8SNgINgRaeIdKMUdKaea8RaINg8RaeId3MUd3aea8WaINg8WaeIdaMUdaaeaIa8SNgIaeId8KMUd8Kaea8UaeIdyMUdyaqaAaQcdtfydbc8S2fgea8YaeIdbMUdbaea81aeIdlMUdlaea8ZaeIdwMUdwaea80aeIdxMUdxaeaBaeIdzMUdzaea83aeIdCMUdCaeaRaeIdKMUdKaea8RaeId3MUd3aea8WaeIdaMUdaaeaIaeId8KMUd8Kaea8UaeIdyMUdykaXclfgXcx9hmbkaLcxfhLazcifgzad6mbka8LTmbcbhLinJbbbbh8Xa3abaLcdtfgeclfydbgEcx2fgXIdwa3aeydbgzcx2fgQIdwg8Z:tg8Ra8RNaXIdbaQIdbgB:tg8Wa8WNaXIdlaQIdlg83:tg8Ua8UNMMg80a3aecwfydbgHcx2fgeIdwa8Z:tgINa8Ra8RaINa8WaeIdbaB:tg8SNa8UaeIdla83:tg8VNMMgRN:tJbbbbJbbjZa80aIaINa8Sa8SNa8Va8VNMMg81NaRaRN:tg8Y:va8YJbbbb9BEg8YNhUa81a8RNaIaRN:ta8YNh85a80a8VNa8UaRN:ta8YNh86a81a8UNa8VaRN:ta8YNh87a80a8SNa8WaRN:ta8YNh88a81a8WNa8SaRN:ta8YNh89a8Wa8VNa8Sa8UN:tgRaRNa8UaINa8Va8RN:tgRaRNa8Ra8SNaIa8WN:tgRaRNMM:rJbbbZNhRagaza8L2gwcdtfhXagaHa8L2g8NcdtfhQagaEa8L2g5cdtfhKa8Z:mh8:a83:mhZaB:mhncbhYa8Lh8AJbbbbh8VJbbbbh8YJbbbbh80Jbbbbh81Jbbbbh8ZJbbbbhBJbbbbh83JbbbbhcJbbbbh9cinasc;WbfaYfgecwfaRa85aKIdbaXIdbgI:tg8UNaUaQIdbaI:tg8SNMg8RNUdbaeclfaRa87a8UNa86a8SNMg8WNUdbaeaRa89a8UNa88a8SNMg8UNUdbaecxfaRa8:a8RNaZa8WNaIana8UNMMMgINUdbaRa8Ra8WNNa81Mh81aRa8Ra8UNNa8ZMh8ZaRa8Wa8UNNaBMhBaRaIaINNa8XMh8XaRa8RaINNa8VMh8VaRa8WaINNa8YMh8YaRa8UaINNa80Mh80aRa8Ra8RNNa83Mh83aRa8Wa8WNNacMhcaRa8Ua8UNNa9cMh9caXclfhXaKclfhKaQclfhQaYczfhYa8Acufg8Ambkavazc8S2fgea9caeIdbMUdbaeacaeIdlMUdlaea83aeIdwMUdwaeaBaeIdxMUdxaea8ZaeIdzMUdzaea81aeIdCMUdCaea80aeIdKMUdKaea8YaeId3MUd3aea8VaeIdaMUdaaea8XaeId8KMUd8KaeaRaeIdyMUdyavaEc8S2fgea9caeIdbMUdbaeacaeIdlMUdlaea83aeIdwMUdwaeaBaeIdxMUdxaea8ZaeIdzMUdzaea81aeIdCMUdCaea80aeIdKMUdKaea8YaeId3MUd3aea8VaeIdaMUdaaea8XaeId8KMUd8KaeaRaeIdyMUdyavaHc8S2fgea9caeIdbMUdbaeacaeIdlMUdlaea83aeIdwMUdwaeaBaeIdxMUdxaea8ZaeIdzMUdzaea81aeIdCMUdCaea80aeIdKMUdKaea8YaeId3MUd3aea8VaeIdaMUdaaea8XaeId8KMUd8KaeaRaeIdyMUdyaiawcltfh8AcbhXa8LhKina8AaXfgeasc;WbfaXfgQIdbaeIdbMUdbaeclfgYaQclfIdbaYIdbMUdbaecwfgYaQcwfIdbaYIdbMUdbaecxfgeaQcxfIdbaeIdbMUdbaXczfhXaKcufgKmbkaia5cltfh8AcbhXa8LhKina8AaXfgeasc;WbfaXfgQIdbaeIdbMUdbaeclfgYaQclfIdbaYIdbMUdbaecwfgYaQcwfIdbaYIdbMUdbaecxfgeaQcxfIdbaeIdbMUdbaXczfhXaKcufgKmbkaia8Ncltfh8AcbhXa8LhKina8AaXfgeasc;WbfaXfgQIdbaeIdbMUdbaeclfgYaQclfIdbaYIdbMUdbaecwfgYaQcwfIdbaYIdbMUdbaecxfgeaQcxfIdbaeIdbMUdbaXczfhXaKcufgKmbkaLcifgLad6mbkkcbhQdndnamcwGgJmbJbbbbh8Vcbh9ecbhocbhhxekcbh9ea8Fcbyd:m:jjjbHjjjjbbhhascxfasyd2gecdtfahBdbasaecefgXBd2ascxfaXcdtfcuahalabadaAz:fjjjbgKcltaKcjjjjiGEcbyd:m:jjjbHjjjjbbgoBdbasaecdfBd2aoaKaha3alz:gjjjbJFFuuh8VaKTmbaoheaKhXinaeIdbgRa8Va8VaR9EEh8VaeclfheaXcufgXmbkaKh9ekasydlhTdnalTmbaTclfheaTydbhKaChXalhYcbhQincbaeydbg8AaK9RaXRbbcpeGEaQfhQaXcefhXaeclfhea8AhKaYcufgYmbkaQce4hQkcuadaQ9RcifgScx2aSc;v:Q;v:Qe0Ecbyd:m:jjjbHjjjjbbhDascxfasyd2g9hcdtfaDBdbasa9hcefgeBd2ascxfaecdtfcuaScdtaScFFFFi0Ecbyd:m:jjjbHjjjjbbgrBdbasa9hcdfgeBd2ascxfaecdtfa8Fcbyd:m:jjjbHjjjjbbgyBdbasa9hcifgeBd2ascxfaecdtfalcbyd:m:jjjbHjjjjbbg9iBdbasa9hclfg6Bd2axaxNa8PJbbjZamclGEgUaUN:vh9cJbbbbhcdnadak9nmbdnaSci6mba8Lclth9kaDcwfh0Jbbbbh83JbbbbhcinasclfabadalaAz:cjjjbabhzcbh8Ecbh8Finaba8FcdtfhHcbheindnaAazaefydbgQcdtgEfydbgYaAaHaec;q1jjbfydbcdtfydbgXcdtgwfydbg8ASmbaCaXfRbbgLcv2aCaQfRbbgKfc;G1jjbfRbbg5aKcv2aLfg8Nc;G1jjbfRbbg8MVcFeGTmbdna8AaY9nmba8Nc:G1jjbfRbbcFeGmekaKcufhYdnaKaL9hmbaYcFeGce0mba8JaEfydbaX9hmekdndnaKclSmbaLcl9hmekdnaYcFeGce0mba8JaEfydbaX9hmdkaLcufcFeGce0mba8KawfydbaQ9hmekaDa8Ecx2fgKaXaQa8McFeGgYEBdlaKaQaXaYEBdbaKaYa5Gcb9hBdwa8Ecefh8Ekaeclfgecx9hmbkdna8Fcifg8Fad9pmbazcxfhza8EcifaS9nmekka8ETmdcbhLinaqaAaDaLcx2fgKydbgYcdtgzfydbc8S2fgeIdwa3aKydlg8Acx2fgXIdwg8WNaeIdzaXIdbg8UNaeIdaMgRaRMMa8WNaeIdlaXIdlgINaeIdCa8WNaeId3MgRaRMMaINaeIdba8UNaeIdxaINaeIdKMgRaRMMa8UNaeId8KMMM:lhRJbbbbJbbjZaeIdyg8R:va8RJbbbb9BEh8RdndnaKydwgEmbJFFuuh8YxekJbbbbJbbjZaqaAa8Acdtfydbc8S2fgeIdyg8S:va8SJbbbb9BEaeIdwa3aYcx2fgXIdwg8SNaeIdzaXIdbg8XNaeIdaMg8Ya8YMMa8SNaeIdlaXIdlg8YNaeIdCa8SNaeId3Mg8Sa8SMMa8YNaeIdba8XNaeIdxa8YNaeIdKMg8Sa8SMMa8XNaeId8KMMM:lNh8Yka8RaRNh80dna8LTmbavaYc8S2fgQIdwa8WNaQIdza8UNaQIdaMgRaRMMa8WNaQIdlaINaQIdCa8WNaQId3MgRaRMMaINaQIdba8UNaQIdxaINaQIdKMgRaRMMa8UNaQId8KMMMhRaga8Aa8L2gHcdtfhXaiaYa8L2gwcltfheaQIdyh8Sa8LhQinaXIdbg8Ra8Ra8SNaecxfIdba8WaecwfIdbNa8UaeIdbNaIaeclfIdbNMMMg8Ra8RM:tNaRMhRaXclfhXaeczfheaQcufgQmbkdndnaEmbJbbbbh8Rxekava8Ac8S2fgQIdwa3aYcx2fgeIdwg8UNaQIdzaeIdbgINaQIdaMg8Ra8RMMa8UNaQIdlaeIdlg8SNaQIdCa8UNaQId3Mg8Ra8RMMa8SNaQIdbaINaQIdxa8SNaQIdKMg8Ra8RMMaINaQId8KMMMh8RagawcdtfhXaiaHcltfheaQIdyh8Xa8LhQinaXIdbg8Wa8Wa8XNaecxfIdba8UaecwfIdbNaIaeIdbNa8SaeclfIdbNMMMg8Wa8WM:tNa8RMh8RaXclfhXaeczfheaQcufgQmbka8R:lh8Rka80aR:lMh80a8Ya8RMh8YaCaYfRbbcd9hmbdna8Ka8Ja8Jazfydba8ASEaaazfydbgHcdtfydbgzcu9hmbaaa8AcdtfydbhzkavaHc8S2fgQIdwa3azcx2fgeIdwg8WNaQIdzaeIdbg8UNaQIdaMgRaRMMa8WNaQIdlaeIdlgINaQIdCa8WNaQId3MgRaRMMaINaQIdba8UNaQIdxaINaQIdKMgRaRMMa8UNaQId8KMMMhRagaza8L2gwcdtfhXaiaHa8L2g8NcltfheaQIdyh8Sa8LhQinaXIdbg8Ra8Ra8SNaecxfIdba8WaecwfIdbNa8UaeIdbNaIaeclfIdbNMMMg8Ra8RM:tNaRMhRaXclfhXaeczfheaQcufgQmbkdndnaEmbJbbbbh8Rxekavazc8S2fgQIdwa3aHcx2fgeIdwg8UNaQIdzaeIdbgINaQIdaMg8Ra8RMMa8UNaQIdlaeIdlg8SNaQIdCa8UNaQId3Mg8Ra8RMMa8SNaQIdbaINaQIdxa8SNaQIdKMg8Ra8RMMaINaQId8KMMMh8Raga8NcdtfhXaiawcltfheaQIdyh8Xa8LhQinaXIdbg8Wa8Wa8XNaecxfIdba8UaecwfIdbNaIaeIdbNa8SaeclfIdbNMMMg8Wa8WM:tNa8RMh8RaXclfhXaeczfheaQcufgQmbka8R:lh8Rka80aR:lMh80a8Ya8RMh8YkaKa80a8Ya80a8Y9FgeEUdwaKa8AaYaeaETVgeEBdlaKaYa8AaeEBdbaLcefgLa8E9hmbkasc;Wbfcbcj;qbz:ojjjb8Aa0hea8EhXinasc;WbfaeydbcA4cF8FGgQcFAaQcFA6EcdtfgQaQydbcefBdbaecxfheaXcufgXmbkcbhecbhXinasc;WbfaefgQydbhKaQaXBdbaKaXfhXaeclfgecj;qb9hmbkcbhea0hXinasc;WbfaXydbcA4cF8FGgQcFAaQcFA6EcdtfgQaQydbgQcefBdbaraQcdtfaeBdbaXcxfhXa8Eaecefge9hmbkadak9RgQci9Uh9mdnalTmbcbheayhXinaXaeBdbaXclfhXalaecefge9hmbkkcbh9na9icbalz:ojjjbh8FaQcO9Uh9oa9mce4h9pasydwh9qcbh8Mcbh5dninaDara5cdtfydbcx2fg8NIdwgRa9c9Emea8Ma9m9pmeJFFuuh8Rdna9pa8E9pmbaDara9pcdtfydbcx2fIdwJbb;aZNh8RkdnaRa8R9ETmbaRac9ETmba8Ma9o0mdkdna8FaAa8NydlgHcdtg9rfydbgKfg9sRbba8FaAa8Nydbgzcdtg9tfydbgefg9uRbbVmbaCazfRbbh9vdnaTaecdtfgXclfydbgQaXydbgXSmbaQaX9RhYa3aKcx2fhLa3aecx2fhEa9qaXcitfhecbhXcehwdnindnayaeydbcdtfydbgQaKSmbayaeclfydbcdtfydbg8AaKSmbaQa8ASmba3a8Acx2fg8AIdba3aQcx2fgQIdbg8W:tgRaEIdlaQIdlg8U:tg8XNaEIdba8W:tg8Ya8AIdla8U:tg8RN:tgIaRaLIdla8U:tg80NaLIdba8W:tg81a8RN:tg8UNa8RaEIdwaQIdwg8S:tg8ZNa8Xa8AIdwa8S:tg8WN:tg8Xa8RaLIdwa8S:tgBNa80a8WN:tg8RNa8Wa8YNa8ZaRN:tg8Sa8Wa81NaBaRN:tgRNMMaIaINa8Xa8XNa8Sa8SNMMa8Ua8UNa8Ra8RNaRaRNMMN:rJbbj8:N9FmdkaecwfheaXcefgXaY6hwaYaX9hmbkkawceGTmba9pcefh9pxekdndndndna9vc9:fPdebdkazheinayaecdtgefaHBdbaaaefydbgeaz9hmbxikkdna8Ka8Ja8Ja9tfydbaHSEaaa9tfydbgzcdtfydbgecu9hmbaaa9rfydbhekaya9tfaHBdbaehHkayazcdtfaHBdbka9uce86bba9sce86bba8NIdwgRacacaR9DEhca9ncefh9ncecda9vceSEa8Mfh8Mka5cefg5a8E9hmbkka9nTmddnalTmbcbh8AcbhEindnayaEcdtgefydbgQaESmbaAaQcdtfydbhzdnaEaAaefydb9hgHmbaqazc8S2fgeaqaEc8S2fgXIdbaeIdbMUdbaeaXIdlaeIdlMUdlaeaXIdwaeIdwMUdwaeaXIdxaeIdxMUdxaeaXIdzaeIdzMUdzaeaXIdCaeIdCMUdCaeaXIdKaeIdKMUdKaeaXId3aeId3MUd3aeaXIdaaeIdaMUdaaeaXId8KaeId8KMUd8KaeaXIdyaeIdyMUdyka8LTmbavaQc8S2fgeavaEc8S2gwfgXIdbaeIdbMUdbaeaXIdlaeIdlMUdlaeaXIdwaeIdwMUdwaeaXIdxaeIdxMUdxaeaXIdzaeIdzMUdzaeaXIdCaeIdCMUdCaeaXIdKaeIdKMUdKaeaXId3aeId3MUd3aeaXIdaaeIdaMUdaaeaXId8KaeId8KMUd8KaeaXIdyaeIdyMUdya9kaQ2hLaihXa8LhKinaXaLfgeaXa8AfgQIdbaeIdbMUdbaeclfgYaQclfIdbaYIdbMUdbaecwfgYaQcwfIdbaYIdbMUdbaecxfgeaQcxfIdbaeIdbMUdbaXczfhXaKcufgKmbkaHmbJbbbbJbbjZaqawfgeIdygR:vaRJbbbb9BEaeIdwa3azcx2fgXIdwgRNaeIdzaXIdbg8RNaeIdaMg8Wa8WMMaRNaeIdlaXIdlg8WNaeIdCaRNaeId3MgRaRMMa8WNaeIdba8RNaeIdxa8WNaeIdKMgRaRMMa8RNaeId8KMMM:lNgRa83a83aR9DEh83ka8Aa9kfh8AaEcefgEal9hmbkcbhXa8JheindnaeydbgQcuSmbdnaXayaQcdtgKfydbgQ9hmbcuhQa8JaKfydbgKcuSmbayaKcdtfydbhQkaeaQBdbkaeclfhealaXcefgX9hmbkcbhXa8KheindnaeydbgQcuSmbdnaXayaQcdtgKfydbgQ9hmbcuhQa8KaKfydbgKcuSmbayaKcdtfydbhQkaeaQBdbkaeclfhealaXcefgX9hmbkka83aca8LEh83cbhKabhecbhYindnayaeydbcdtfydbgXayaeclfydbcdtfydbgQSmbaXayaecwfydbcdtfydbg8ASmbaQa8ASmbabaKcdtfgLaXBdbaLcwfa8ABdbaLclfaQBdbaKcifhKkaecxfheaYcifgYad6mbkdndnaJTmbaKak9nmba8Va839FTmbcbhdabhecbhXindnaoahaeydbgQcdtfydbcdtfIdba839ETmbabadcdtfgYaQBdbaYclfaeclfydbBdbaYcwfaecwfydbBdbadcifhdkaecxfheaXcifgXaK6mbkJFFuuh8Va9eTmeaohea9ehXJFFuuhRinaeIdbg8RaRaRa8R9EEg8WaRa8Ra839EgQEhRa8Wa8VaQEh8VaeclfheaXcufgXmbxdkkaKhdkadak0mbxdkkasclfabadalaAz:cjjjbkdndnadak0mbadhXxekdnaJmbadhXxekdna8Va9c9FmbadhXxekina8VJbb;aZNgRa9caRa9c9DEh8WJbbbbhRdna9eTmbaohea9ehAinaeIdbg8RaRa8Ra8W9FEaRa8RaR9EEhRaeclfheaAcufgAmbkkcbhXabhecbhAindnaoahaeydbgQcdtfydbcdtfIdba8W9ETmbabaXcdtfgKaQBdbaKclfaeclfydbBdbaKcwfaecwfydbBdbaXcifhXkaecxfheaAcifgAad6mbkJFFuuh8Vdna9eTmbaohea9ehAJFFuuh8RinaeIdbg8Ua8Ra8Ra8U9EEgIa8Ra8Ua8W9EgQEh8RaIa8VaQEh8VaeclfheaAcufgAmbkkdnaXad9hmbadhXxdkaRacacaR9DEhcaXak9nmeaXhda8Va9c9FmbkkdnamcjjjjlGTmbaOmbaXTmbcbh8AabheinaCaeydbgKfRbbc3thLaecwfgEydbhAdndna8JaKcdtgHfydbaeclfgzydbgQSmbcbhYa8KaQcdtfydbaK9hmekcjjjj94hYkaeaLaYVaKVBdbaCaQfRbbc3thLdndna8JaQcdtfydbaASmbcbhYa8KaAcdtfydbaQ9hmekcjjjj94hYkazaLaYVaQVBdbaCaAfRbbc3thYdndna8JaAcdtfydbaKSmbcbhQa8KaHfydbaA9hmekcjjjj94hQkaEaYaQVaAVBdbaecxfhea8Acifg8AaX6mbkkdnaOTmbaXTmbaXheinabaOabydbcdtfydbBdbabclfhbaecufgembkkdnaPTmbaPaUac:rNUdbka9hcdtascxffcxfhednina6Tmeaeydbcbyd1:jjjbH:bjjjbbaec98fhea6cufh6xbkkasc;W;qbf8KjjjjbaXk;Yieouabydlhvabydbclfcbaicdtz:ojjjbhoadci9UhrdnadTmbdnalTmbaehwadhDinaoalawydbcdtfydbcdtfgqaqydbcefBdbawclfhwaDcufgDmbxdkkaehwadhDinaoawydbcdtfgqaqydbcefBdbawclfhwaDcufgDmbkkdnaiTmbcbhDaohwinawydbhqawaDBdbawclfhwaqaDfhDaicufgimbkkdnadci6mbinaecwfydbhwaeclfydbhDaeydbhidnalTmbalawcdtfydbhwalaDcdtfydbhDalaicdtfydbhikavaoaicdtfgqydbcitfaDBdbavaqydbcitfawBdlaqaqydbcefBdbavaoaDcdtfgqydbcitfawBdbavaqydbcitfaiBdlaqaqydbcefBdbavaoawcdtfgwydbcitfaiBdbavawydbcitfaDBdlawawydbcefBdbaecxfhearcufgrmbkkabydbcbBdbk:todDue99aicd4aifhrcehwinawgDcethwaDar6mbkcuaDcdtgraDcFFFFi0Ecbyd:m:jjjbHjjjjbbhwaoaoyd9GgqcefBd9GaoaqcdtfawBdbawcFearz:ojjjbhkdnaiTmbalcd4hlaDcufhxcbhminamhDdnavTmbavamcdtfydbhDkcbadaDal2cdtfgDydlgwawcjjjj94SEgwcH4aw7c:F:b:DD2cbaDydbgwawcjjjj94SEgwcH4aw7c;D;O:B8J27cbaDydwgDaDcjjjj94SEgDcH4aD7c:3F;N8N27axGhwamcdthPdndndnavTmbakawcdtfgrydbgDcuSmeadavaPfydbal2cdtfgsIdbhzcehqinaqhrdnadavaDcdtfydbal2cdtfgqIdbaz9CmbaqIdlasIdl9CmbaqIdwasIdw9BmlkarcefhqakawarfaxGgwcdtfgrydbgDcu9hmbxdkkakawcdtfgrydbgDcuSmbadamal2cdtfgsIdbhzcehqinaqhrdnadaDal2cdtfgqIdbaz9CmbaqIdlasIdl9CmbaqIdwasIdw9BmikarcefhqakawarfaxGgwcdtfgrydbgDcu9hmbkkaramBdbamhDkabaPfaDBdbamcefgmai9hmbkkakcbyd1:jjjbH:bjjjbbaoaoyd9GcufBd9GdnaeTmbaiTmbcbhDaehwinawaDBdbawclfhwaiaDcefgD9hmbkcbhDaehwindnaDabydbgrSmbawaearcdtfgrydbBdbaraDBdbkawclfhwabclfhbaiaDcefgD9hmbkkk;Qodvuv998Jjjjjbca9Rgvczfcwfcbyd11jjbBdbavcb8Pdj1jjb83izavcwfcbydN1jjbBdbavcb8Pd:m1jjb83ibdnadTmbaicd4hodnabmbdnalTmbcbhrinaealarcdtfydbao2cdtfhwcbhiinavczfaifgDawaifIdbgqaDIdbgkakaq9EEUdbavaifgDaqaDIdbgkakaq9DEUdbaiclfgicx9hmbkarcefgrad9hmbxikkaocdthrcbhwincbhiinavczfaifgDaeaifIdbgqaDIdbgkakaq9EEUdbavaifgDaqaDIdbgkakaq9DEUdbaiclfgicx9hmbkaearfheawcefgwad9hmbxdkkdnalTmbcbhrinabarcx2fgiaealarcdtfydbao2cdtfgwIdbUdbaiawIdlUdlaiawIdwUdwcbhiinavczfaifgDawaifIdbgqaDIdbgkakaq9EEUdbavaifgDaqaDIdbgkakaq9DEUdbaiclfgicx9hmbkarcefgrad9hmbxdkkaocdthlcbhraehwinabarcx2fgiaearao2cdtfgDIdbUdbaiaDIdlUdlaiaDIdwUdwcbhiinavczfaifgDawaifIdbgqaDIdbgkakaq9EEUdbavaifgDaqaDIdbgkakaq9DEUdbaiclfgicx9hmbkawalfhwarcefgrad9hmbkkJbbbbavIdbavIdzgk:tgqaqJbbbb9DEgqavIdlavIdCgx:tgmamaq9DEgqavIdwavIdKgm:tgPaPaq9DEhPdnabTmbadTmbJbbbbJbbjZaP:vaPJbbbb9BEhqinabaqabIdbak:tNUdbabclfgvaqavIdbax:tNUdbabcwfgvaqavIdbam:tNUdbabcxfhbadcufgdmbkkaPk:ZlewudnaeTmbcbhvabhoinaoavBdbaoclfhoaeavcefgv9hmbkkdnaiTmbcbhrinadarcdtfhwcbhDinalawaDcdtgvc;a1jjbfydbcdtfydbcdtfydbhodnabalawavfydbcdtfydbgqcdtfgkydbgvaqSmbinakabavgqcdtfgxydbgvBdbaxhkaqav9hmbkkdnabaocdtfgkydbgvaoSmbinakabavgocdtfgxydbgvBdbaxhkaoav9hmbkkdnaqaoSmbabaqaoaqao0Ecdtfaqaoaqao6EBdbkaDcefgDci9hmbkarcifgrai6mbkkdnaembcbskcbhxindnalaxcdtgvfydbax9hmbaxhodnabavfgDydbgvaxSmbaDhqinaqabavgocdtfgkydbgvBdbakhqaoav9hmbkkaDaoBdbkaxcefgxae9hmbkcbhvabhocbhkindndnavalydbgq9hmbdnavaoydbgq9hmbaoakBdbakcefhkxdkaoabaqcdtfydbBdbxekaoabaqcdtfydbBdbkaoclfhoalclfhlaeavcefgv9hmbkakk;Jiilud99duabcbaecltz:ojjjbhvdnalTmbadhoaihralhwinarcwfIdbhDarclfIdbhqavaoydbcltfgkarIdbakIdbMUdbakclfgxaqaxIdbMUdbakcwfgxaDaxIdbMUdbakcxfgkakIdbJbbjZMUdbaoclfhoarcxfhrawcufgwmbkkdnaeTmbavhraehkinarcxfgoIdbhDaocbBdbararIdbJbbbbJbbjZaD:vaDJbbbb9BEgDNUdbarclfgoaDaoIdbNUdbarcwfgoaDaoIdbNUdbarczfhrakcufgkmbkkdnalTmbinavadydbcltfgrcxfgkaicwfIdbarcwfIdb:tgDaDNaiIdbarIdb:tgDaDNaiclfIdbarclfIdb:tgDaDNMMgDakIdbgqaqaD9DEUdbadclfhdaicxfhialcufglmbkkdnaeTmbavcxfhrinabarIdbUdbarczfhrabclfhbaecufgembkkk8MbabaeadaialavcbcbcbcbcbaoarawaDz:bjjjbk8MbabaeadaialavaoarawaDaqakaxamaPz:bjjjbk:DCoDud99rue99iul998Jjjjjbc;Wb9Rgw8KjjjjbdndnarmbcbhDxekawcxfcbc;Kbz:ojjjb8Aawcuadcx2adc;v:Q;v:Qe0Ecbyd:m:jjjbHjjjjbbgqBdxawceBd2aqaeadaicbz:ejjjb8AawcuadcdtadcFFFFi0Egkcbyd:m:jjjbHjjjjbbgxBdzawcdBd2adcd4adfhmceheinaegicetheaiam6mbkcbhPawcuaicdtgsaicFFFFi0Ecbyd:m:jjjbHjjjjbbgzBdCawciBd2dndnar:ZgH:rJbbbZMgO:lJbbb9p9DTmbaO:Ohexekcjjjj94hekaicufhAc:bwhmcbhCadhXcbhQinaChLaeamgKcufaeaK9iEaPgDcefaeaD9kEhYdndnadTmbaYcuf:YhOaqhiaxheadhmindndnaiIdbaONJbbbZMg8A:lJbbb9p9DTmba8A:OhCxekcjjjj94hCkaCcCthCdndnaiclfIdbaONJbbbZMg8A:lJbbb9p9DTmba8A:OhExekcjjjj94hEkaEcqtaCVhCdndnaicwfIdbaONJbbbZMg8A:lJbbb9p9DTmba8A:OhExekcjjjj94hEkaeaCaEVBdbaicxfhiaeclfheamcufgmmbkazcFeasz:ojjjbh3cbh5cbhPindna3axaPcdtfydbgCcm4aC7c:v;t;h;Ev2gics4ai7aAGgmcdtfgEydbgecuSmbaeaCSmbcehiina3amaifaAGgmcdtfgEydbgecuSmeaicefhiaeaC9hmbkkaEaCBdba5aecuSfh5aPcefgPad9hmbxdkkazcFeasz:ojjjb8Acbh5kaDaYa5ar0giEhPaLa5aiEhCdna5arSmbaYaKaiEgmaP9Rcd9imbdndnaQcl0mbdnaX:ZgOaL:Zg8A:taY:Yg8EaD:Y:tg8Fa8EaK:Y:tgaa5:ZghaH:tNNNaOaH:taaNa8Aah:tNa8AaH:ta8FNahaO:tNM:va8EMJbbbZMgO:lJbbb9p9DTmbaO:Ohexdkcjjjj94hexekaPamfcd9Theka5aXaiEhXaQcefgQcs9hmekkdndnaCmbcihicbhDxekcbhiawakcbyd:m:jjjbHjjjjbbg5BdKawclBd2aPcuf:Yh8AdndnadTmbaqhiaxheadhmindndnaiIdba8ANJbbbZMgO:lJbbb9p9DTmbaO:OhCxekcjjjj94hCkaCcCthCdndnaiclfIdba8ANJbbbZMgO:lJbbb9p9DTmbaO:OhExekcjjjj94hEkaEcqtaCVhCdndnaicwfIdba8ANJbbbZMgO:lJbbb9p9DTmbaO:OhExekcjjjj94hEkaeaCaEVBdbaicxfhiaeclfheamcufgmmbkazcFeasz:ojjjbh3cbhDcbhYindndndna3axaYcdtgKfydbgCcm4aC7c:v;t;h;Ev2gics4ai7aAGgmcdtfgEydbgecuSmbcehiinaxaecdtgefydbaCSmdamaifheaicefhia3aeaAGgmcdtfgEydbgecu9hmbkkaEaYBdbaDhiaDcefhDxeka5aefydbhika5aKfaiBdbaYcefgYad9hmbkcuaDc32giaDc;j:KM;jb0EhexekazcFeasz:ojjjb8AcbhDcbhekawaecbyd:m:jjjbHjjjjbbgeBd3awcvBd2aecbaiz:ojjjbhEavcd4hKdnadTmbdnalTmbaKcdth3a5hCaqhealhmadhAinaEaCydbc32fgiaeIdbaiIdbMUdbaiaeclfIdbaiIdlMUdlaiaecwfIdbaiIdwMUdwaiamIdbaiIdxMUdxaiamclfIdbaiIdzMUdzaiamcwfIdbaiIdCMUdCaiaiIdKJbbjZMUdKaCclfhCaecxfheama3fhmaAcufgAmbxdkka5hmaqheadhCinaEamydbc32fgiaeIdbaiIdbMUdbaiaeclfIdbaiIdlMUdlaiaecwfIdbaiIdwMUdwaiaiIdxJbbbbMUdxaiaiIdzJbbbbMUdzaiaiIdCJbbbbMUdCaiaiIdKJbbjZMUdKamclfhmaecxfheaCcufgCmbkkdnaDTmbaEhiaDheinaiaiIdbJbbbbJbbjZaicKfIdbgO:vaOJbbbb9BEgONUdbaiclfgmaOamIdbNUdbaicwfgmaOamIdbNUdbaicxfgmaOamIdbNUdbaiczfgmaOamIdbNUdbaicCfgmaOamIdbNUdbaic3fhiaecufgembkkcbhCawcuaDcdtgYaDcFFFFi0Egicbyd:m:jjjbHjjjjbbgeBdaawcoBd2awaicbyd:m:jjjbHjjjjbbg3Bd8KaecFeaYz:ojjjbhxdnadTmbJbbjZJbbjZa8A:vaPceSEaoNgOaONh8AaKcdthPalheina8Aaec;81jjbalEgmIdwaEa5ydbgAc32fgiIdC:tgOaONamIdbaiIdx:tgOaONamIdlaiIdz:tgOaONMMNaqcwfIdbaiIdw:tgOaONaqIdbaiIdb:tgOaONaqclfIdbaiIdl:tgOaONMMMhOdndnaxaAcdtgifgmydbcuSmba3aifIdbaO9ETmekamaCBdba3aifaOUdbka5clfh5aqcxfhqaeaPfheadaCcefgC9hmbkkabaxaYz:njjjb8AcrhikaicdthiinaiTmeaic98fgiawcxffydbcbyd1:jjjbH:bjjjbbxbkkawc;Wbf8KjjjjbaDk:Ydidui99ducbhi8Jjjjjbca9Rglczfcwfcbyd11jjbBdbalcb8Pdj1jjb83izalcwfcbydN1jjbBdbalcb8Pd:m1jjb83ibdndnaembJbbjFhvJbbjFhoJbbjFhrxekadcd4cdthwincbhdinalczfadfgDabadfIdbgvaDIdbgoaoav9EEUdbaladfgDavaDIdbgoaoav9DEUdbadclfgdcx9hmbkabawfhbaicefgiae9hmbkalIdwalIdK:thralIdlalIdC:thoalIdbalIdz:thvkJbbbbavavJbbbb9DEgvaoaoav9DEgvararav9DEk9DeeuabcFeaicdtz:ojjjbhlcbhbdnadTmbindnalaeydbcdtfgiydbcu9hmbaiabBdbabcefhbkaeclfheadcufgdmbkkabk9teiucbcbyd:q:jjjbgeabcifc98GfgbBd:q:jjjbdndnabZbcztgd9nmbcuhiabad9RcFFifcz4nbcuSmekaehikaik;teeeudndnaeabVciGTmbabhixekdndnadcz9pmbabhixekabhiinaiaeydbBdbaiaeydlBdlaiaeydwBdwaiaeydxBdxaeczfheaiczfhiadc9Wfgdcs0mbkkadcl6mbinaiaeydbBdbaeclfheaiclfhiadc98fgdci0mbkkdnadTmbinaiaeRbb86bbaicefhiaecefheadcufgdmbkkabk:3eedudndnabciGTmbabhixekaecFeGc:b:c:ew2hldndnadcz9pmbabhixekabhiinaialBdxaialBdwaialBdlaialBdbaiczfhiadc9Wfgdcs0mbkkadcl6mbinaialBdbaiclfhiadc98fgdci0mbkkdnadTmbinaiae86bbaicefhiadcufgdmbkkabk9teiucbcbyd:q:jjjbgeabcrfc94GfgbBd:q:jjjbdndnabZbcztgd9nmbcuhiabad9RcFFifcz4nbcuSmekaehikaik9:eiuZbhedndncbyd:q:jjjbgdaecztgi9nmbcuheadai9RcFFifcz4nbcuSmekadhekcbabae9Rcifc98Gcbyd:q:jjjbfgdBd:q:jjjbdnadZbcztge9nmbadae9RcFFifcz4nb8Akkk:Iedbcjwk1eFFuuFFuuFFuuFFuFFFuFFFuFbbbbbbbbeeebeebebbeeebebbbbbebebbbbbbbbbebbbdbbbbbbbebbbebbbdbbbbbbbbbbbeeeeebebbebbebebbbeebbbbbbbbbbbbbbbbbbbbbc1Dkxebbbdbbb:GNbb",t=new Uint8Array([32,0,65,2,1,106,34,33,3,128,11,4,13,64,6,253,10,7,15,116,127,5,8,12,40,16,19,54,20,9,27,255,113,17,42,67,24,23,146,148,18,14,22,45,70,69,56,114,101,21,25,63,75,136,108,28,118,29,73,115]);if(typeof WebAssembly!="object")return{supported:!1};var r,a=WebAssembly.instantiate(s(e),{}).then(function(h){r=h.instance,r.exports.__wasm_call_ctors()});function s(h){for(var u=new Uint8Array(h.length),m=0;m<h.length;++m){var g=h.charCodeAt(m);u[m]=g>96?g-97:g>64?g-39:g+4}for(var y=0,m=0;m<h.length;++m)u[y++]=u[m]<60?t[u[m]]:(u[m]-60)*64+u[++m];return u.buffer.slice(0,y)}function n(h){if(!h)throw new Error("Assertion failed")}function i(h){return new Uint8Array(h.buffer,h.byteOffset,h.byteLength)}function o(h,u,m){var g=r.exports.sbrk,y=g(u.length*4),x=g(m*4),v=new Uint8Array(r.exports.memory.buffer),E=i(u);v.set(E,y);var S=h(x,y,u.length,m);v=new Uint8Array(r.exports.memory.buffer);var T=new Uint32Array(m);new Uint8Array(T.buffer).set(v.subarray(x,x+m*4)),E.set(v.subarray(y,y+u.length*4)),g(y-g(0));for(var _=0;_<u.length;++_)u[_]=T[u[_]];return[T,S]}function c(h){for(var u=0,m=0;m<h.length;++m){var g=h[m];u=u<g?g:u}return u}function l(h,u,m,g,y,x,v,E,S){var T=r.exports.sbrk,_=T(4),I=T(m*4),N=T(y*x),C=T(m*4),B=new Uint8Array(r.exports.memory.buffer);B.set(i(g),N),B.set(i(u),C);var R=h(I,C,m,N,y,x,v,E,S,_);B=new Uint8Array(r.exports.memory.buffer);var j=new Uint32Array(R);i(j).set(B.subarray(I,I+R*4));var q=new Float32Array(1);return i(q).set(B.subarray(_,_+4)),T(_-T(0)),[j,q[0]]}function f(h,u,m,g,y,x,v,E,S,T,_,I,N){var C=r.exports.sbrk,B=C(4),R=C(m*4),j=C(y*x),q=C(y*E),Y=C(S.length*4),te=C(m*4),we=T?C(y):0,ne=new Uint8Array(r.exports.memory.buffer);ne.set(i(g),j),ne.set(i(v),q),ne.set(i(S),Y),ne.set(i(u),te),T&&ne.set(i(T),we);var me=h(R,te,m,j,y,x,q,E,Y,S.length,we,_,I,N,B);ne=new Uint8Array(r.exports.memory.buffer);var Pe=new Uint32Array(me);i(Pe).set(ne.subarray(R,R+me*4));var he=new Float32Array(1);return i(he).set(ne.subarray(B,B+4)),C(B-C(0)),[Pe,he[0]]}function d(h,u,m,g){var y=r.exports.sbrk,x=y(m*g),v=new Uint8Array(r.exports.memory.buffer);v.set(i(u),x);var E=h(x,m,g);return y(x-y(0)),E}function p(h,u,m,g,y,x,v,E){var S=r.exports.sbrk,T=S(E*4),_=S(m*g),I=S(m*x),N=new Uint8Array(r.exports.memory.buffer);N.set(i(u),_),y&&N.set(i(y),I);var C=h(T,_,m,g,I,x,v,E);N=new Uint8Array(r.exports.memory.buffer);var B=new Uint32Array(C);return i(B).set(N.subarray(T,T+C*4)),S(T-S(0)),B}var b={LockBorder:1,Sparse:2,ErrorAbsolute:4,Prune:8,_InternalDebug:1<<30};return{ready:a,supported:!0,compactMesh:function(h){n(h instanceof Uint32Array||h instanceof Int32Array||h instanceof Uint16Array||h instanceof Int16Array),n(h.length%3==0);var u=h.BYTES_PER_ELEMENT==4?h:new Uint32Array(h);return o(r.exports.meshopt_optimizeVertexFetchRemap,u,c(h)+1)},simplify:function(h,u,m,g,y,x){n(h instanceof Uint32Array||h instanceof Int32Array||h instanceof Uint16Array||h instanceof Int16Array),n(h.length%3==0),n(u instanceof Float32Array),n(u.length%m==0),n(m>=3),n(g>=0&&g<=h.length),n(g%3==0),n(y>=0);for(var v=0,E=0;E<(x?x.length:0);++E)n(x[E]in b),v|=b[x[E]];var S=h.BYTES_PER_ELEMENT==4?h:new Uint32Array(h),T=l(r.exports.meshopt_simplify,S,h.length,u,u.length/m,m*4,g,y,v);return T[0]=h instanceof Uint32Array?T[0]:new h.constructor(T[0]),T},simplifyWithAttributes:function(h,u,m,g,y,x,v,E,S,T){n(h instanceof Uint32Array||h instanceof Int32Array||h instanceof Uint16Array||h instanceof Int16Array),n(h.length%3==0),n(u instanceof Float32Array),n(u.length%m==0),n(m>=3),n(g instanceof Float32Array),n(g.length%y==0),n(y>=0),n(v==null||v instanceof Uint8Array),n(v==null||v.length==u.length/m),n(E>=0&&E<=h.length),n(E%3==0),n(S>=0),n(Array.isArray(x)),n(y>=x.length),n(x.length<=32);for(var _=0;_<x.length;++_)n(x[_]>=0);for(var I=0,_=0;_<(T?T.length:0);++_)n(T[_]in b),I|=b[T[_]];var N=h.BYTES_PER_ELEMENT==4?h:new Uint32Array(h),C=f(r.exports.meshopt_simplifyWithAttributes,N,h.length,u,u.length/m,m*4,g,y*4,new Float32Array(x),v?new Uint8Array(v):null,E,S,I);return C[0]=h instanceof Uint32Array?C[0]:new h.constructor(C[0]),C},getScale:function(h,u){return n(h instanceof Float32Array),n(h.length%u==0),n(u>=3),d(r.exports.meshopt_simplifyScale,h,h.length/u,u*4)},simplifyPoints:function(h,u,m,g,y,x){return n(h instanceof Float32Array),n(h.length%u==0),n(u>=3),n(m>=0&&m<=h.length/u),g?(n(g instanceof Float32Array),n(g.length%y==0),n(y>=3),n(h.length/u==g.length/y),p(r.exports.meshopt_simplifyPoints,h,h.length/u,u*4,g,y*4,x,m)):p(r.exports.meshopt_simplifyPoints,h,h.length/u,u*4,void 0,0,0,m)}}})();var KT=(function(){var e="b9H79TebbbeVx9Geueu9Geub9Gbb9Giuuueu9Gmuuuuuuuuuuu9999eu9Gvuuuuueu9Gwuuuuuuuub9Gxuuuuuuuuuuuueu9Gkuuuuuuuuuu99eu9Gouuuuuub9Gruuuuuuub9GluuuubiOHdilvorwDqqkbiibeilve9Weiiviebeoweuec;G:Odkr:Yewo9TW9T9VV95dbH9F9F939H79T9F9J9H229F9Jt9VV7bb8A9TW79O9V9Wt9F9I919P29K9nW79O2Wt79c9V919U9KbeX9TW79O9V9Wt9F9I919P29K9nW79O2Wt7bo39TW79O9V9Wt9F9J9V9T9W91tWJ2917tWV9c9V919U9K7br39TW79O9V9Wt9F9J9V9T9W91tW9nW79O2Wt9c9V919U9K7bDL9TW79O9V9Wt9F9V9Wt9P9T9P96W9nW79O2Wtbql79IV9RbkDwebcekdsPq;Q9BHdbkIbabaec9:fgefcufae9Ugeabci9Uadfcufad9Ugbaeab0Ek:w8KDPue99eux99dui99euo99iu8Jjjjjbc:WD9Rgm8KjjjjbdndnalmbcbhPxekamc:Cwfcbc;Kbz:njjjb8Adndnalcb9imbaoal9nmbamcuaocdtaocFFFFi0Egscbyd;y1jjbHjjjjbbgzBd:CwamceBd;8wamascbyd;y1jjbHjjjjbbgHBd:GwamcdBd;8wamcualcdtalcFFFFi0Ecbyd;y1jjbHjjjjbbgOBd:KwamciBd;8waihsalhAinazasydbcdtfcbBdbasclfhsaAcufgAmbkaihsalhAinazasydbcdtfgCaCydbcefBdbasclfhsaAcufgAmbkaihsalhCcbhXindnazasydbcdtgQfgAydbcb9imbaHaQfaXBdbaAaAydbgQcjjjj94VBdbaQaXfhXkasclfhsaCcufgCmbkalci9UhLdnalci6mbcbhsaihAinaAcwfydbhCaAclfydbhXaHaAydbcdtfgQaQydbgQcefBdbaOaQcdtfasBdbaHaXcdtfgXaXydbgXcefBdbaOaXcdtfasBdbaHaCcdtfgCaCydbgCcefBdbaOaCcdtfasBdbaAcxfhAaLascefgs9hmbkkaihsalhAindnazasydbcdtgCfgXydbgQcu9kmbaXaQcFFFFrGgQBdbaHaCfgCaCydbaQ9RBdbkasclfhsaAcufgAmbxdkkamcuaocdtgsaocFFFFi0EgAcbyd;y1jjbHjjjjbbgzBd:CwamceBd;8wamaAcbyd;y1jjbHjjjjbbgHBd:GwamcdBd;8wamcualcdtalcFFFFi0Ecbyd;y1jjbHjjjjbbgOBd:KwamciBd;8wazcbasz:njjjbhXalci9UhLaihsalhAinaXasydbcdtfgCaCydbcefBdbasclfhsaAcufgAmbkdnaoTmbcbhsaHhAaXhCaohQinaAasBdbaAclfhAaCydbasfhsaCclfhCaQcufgQmbkkdnalci6mbcbhsaihAinaAcwfydbhCaAclfydbhQaHaAydbcdtfgKaKydbgKcefBdbaOaKcdtfasBdbaHaQcdtfgQaQydbgQcefBdbaOaQcdtfasBdbaHaCcdtfgCaCydbgCcefBdbaOaCcdtfasBdbaAcxfhAaLascefgs9hmbkkaoTmbcbhsaohAinaHasfgCaCydbaXasfydb9RBdbasclfhsaAcufgAmbkkamaLcbyd;y1jjbHjjjjbbgsBd:OwamclBd;8wascbaLz:njjjbhYamcuaLcK2alcjjjjd0Ecbyd;y1jjbHjjjjbbg8ABd:SwamcvBd;8wJbbbbhEdnalci6g3mbarcd4hKaihAa8AhsaLhrJbbbbh5inavaAclfydbaK2cdtfgCIdlh8EavaAydbaK2cdtfgXIdlhEavaAcwfydbaK2cdtfgQIdlh8FaCIdwhaaXIdwhhaQIdwhgasaCIdbg8JaXIdbg8KMaQIdbg8LMJbbnn:vUdbasclfaXIdlaCIdlMaQIdlMJbbnn:vUdbaQIdwh8MaCIdwh8NaXIdwhyascxfa8EaE:tg8Eagah:tggNa8FaE:tg8Faaah:tgaN:tgEJbbbbJbbjZa8Ja8K:tg8Ja8FNa8La8K:tg8Ka8EN:tghahNaEaENaaa8KNaga8JN:tgEaENMM:rg8K:va8KJbbbb9BEg8ENUdbasczfaEa8ENUdbascCfaha8ENUdbascwfa8Maya8NMMJbbnn:vUdba5a8KMh5aAcxfhAascKfhsarcufgrmbka5aL:Z:vJbbbZNhEkamcuaLcdtalcFFFF970Ecbyd;y1jjbHjjjjbbgCBd:WwamcoBd;8waEaq:ZNhEdna3mbcbhsaChAinaAasBdbaAclfhAaLascefgs9hmbkkaE:rhhcuh8PamcuaLcltalcFFFFd0Ecbyd;y1jjbHjjjjbbgIBd:0wamcrBd;8wcbaIa8AaCaLz:djjjb8AJFFuuhyJFFuuh8RJFFuuh8Sdnalci6gXmbJFFuuh8Sa8AhsaLhAJFFuuh8RJFFuuhyinascwfIdbgEayayaE9EEhyasclfIdbgEa8Ra8RaE9EEh8RasIdbgEa8Sa8SaE9EEh8SascKfhsaAcufgAmbkkahJbbbZNhgamaocetgscuaocu9kEcbyd;y1jjbHjjjjbbgABd:4waAcFeasz:njjjbhCdnaXmbcbhAJFFuuhEa8Ahscuh8PinascwfIdbay:tghahNasIdba8S:tghahNasclfIdba8R:tghahNMM:rghaEa8PcuSahaE9DVgXEhEaAa8PaXEh8PascKfhsaLaAcefgA9hmbkkamczfcbcjwz:njjjb8Aamcwf9cb83ibam9cb83ibagaxNhRJbbjZak:th8Ncbh8UJbbbbh8VJbbbbh8WJbbbbh8XJbbbbh8YJbbbbh8ZJbbbbh80cbh81cbhPinJbbbbhEdna8UTmbJbbjZa8U:Z:vhEkJbbbbhhdna80a80Na8Ya8YNa8Za8ZNMMg8KJbbbb9BmbJbbjZa8K:r:vhhka8XaENh5a8WaENh8Fa8VaENhaa8PhQdndndndndna8UaPVTmbamydwgBTmea80ahNh8Ja8ZahNh8La8YahNh8Maeamydbcdtfh83cbh3JFFuuhEcvhXcuhQindnaza83a3cdtfydbcdtgsfydbgvTmbaOaHasfydbcdtfhAindndnaCaiaAydbgKcx2fgsclfydbgrcetf8Vebcs4aCasydbgLcetf8Vebcs4faCascwfydbglcetf8Vebcs4fgombcbhsxekcehsazaLcdtfydbgLceSmbcehsazarcdtfydbgrceSmbcehsazalcdtfydbglceSmbdnarcdSaLcdSfalcdSfcd6mbaocefhsxekaocdfhskdnasaX9kmba8AaKcK2fgLIdwa5:thhaLIdla8F:th8KaLIdbaa:th8EdndnakJbbbb9DTmba8E:lg8Ea8K:lg8Ka8Ea8K9EEg8Kah:lgha8Kah9EEag:vJbbjZMhhxekahahNa8Ea8ENa8Ka8KNMM:rag:va8NNJbbjZMJ9VO:d86JbbjZaLIdCa8JNaLIdxa8MNa8LaLIdzNMMakN:tghahJ9VO:d869DENhhkaKaQasaX6ahaE9DVgLEhQasaXaLEhXahaEaLEhEkaAclfhAavcufgvmbkka3cefg3aB9hmbkkaQcu9hmekama5Ud:ODama8FUd:KDamaaUd:GDamcuBd:qDamcFFF;7rBdjDaIcba8AaYamc:GDfakJbbbb9Damc:qDfamcjDfz:ejjjbamyd:qDhQdndnaxJbbbb9ETmba8UaD6mbaQcuSmeceh3amIdjDaR9EmixdkaQcu9hmekdna8UTmbdnamydlgza8Uci2fgsciGTmbadasfcba8Uazcu7fciGcefz:njjjb8AkabaPcltfgzam8Pib83dbazcwfamcwf8Pib83dbaPcefhPkc3hzinazc98Smvamc:Cwfazfydbcbyd;u1jjbH:bjjjbbazc98fhzxbkkcbh3a8Uaq9pmbamydwaCaiaQcx2fgsydbcetf8Vebcs4aCascwfydbcetf8Vebcs4faCasclfydbcetf8Vebcs4ffaw9nmekcbhscbhAdna81TmbcbhAamczfhXinamczfaAcdtfaXydbgLBdbaXclfhXaAaYaLfRbbTfhAa81cufg81mbkkamydwhlamydbhXam9cu83i:GDam9cu83i:ODam9cu83i:qDam9cu83i:yDaAc;8eaAclfc:bd6Eh81inamcjDfasfcFFF;7rBdbasclfgscz9hmbka81cdthBdnalTmbaeaXcdtfhocbhrindnazaoarcdtfydbcdtgsfydbgvTmbaOaHasfydbcdtfhAcuhLcuhsinazaiaAydbgKcx2fgXclfydbcdtfydbazaXydbcdtfydbfazaXcwfydbcdtfydbfgXasaXas6gXEhsaKaLaXEhLaAclfhAavcufgvmbkaLcuSmba8AaLcK2fgAIdway:tgEaENaAIdba8S:tgEaENaAIdla8R:tgEaENMM:rhEcbhAindndnasamc:qDfaAfgvydbgX6mbasaX9hmeaEamcjDfaAfIdb9FTmekavasBdbamc:GDfaAfaLBdbamcjDfaAfaEUdbxdkaAclfgAcz9hmbkkarcefgral9hmbkkamczfaBfhLcbhscbhAindnamc:GDfasfydbgXcuSmbaLaAcdtfaXBdbaAcefhAkasclfgscz9hmbkaAa81fg81TmbJFFuuhhcuhKamczfhsa81hvcuhLina8AasydbgXcK2fgAIdway:tgEaENaAIdba8S:tgEaENaAIdla8R:tgEaENMM:rhEdndnazaiaXcx2fgAclfydbcdtfydbazaAydbcdtfydbfazaAcwfydbcdtfydbfgAaL6mbaAaL9hmeaEah9DTmekaEhhaAhLaXhKkasclfhsavcufgvmbkaKcuSmbaKhQkdnamaiaQcx2fgrydbarclfydbarcwfydbaCabaeadaPawaqa3z:fjjjbTmbaPcefhPJbbbbh8VJbbbbh8WJbbbbh8XJbbbbh8YJbbbbh8ZJbbbbh80kcbhXinaOaHaraXcdtfydbcdtgAfydbcdtfgKhsazaAfgvydbgLhAdnaLTmbdninasydbaQSmeasclfhsaAcufgATmdxbkkasaKaLcdtfc98fydbBdbavavydbcufBdbkaXcefgXci9hmbka8AaQcK2fgsIdbhEasIdlhhasIdwh8KasIdxh8EasIdzh5asIdCh8FaYaQfce86bba80a8FMh80a8Za5Mh8Za8Ya8EMh8Ya8Xa8KMh8Xa8WahMh8Wa8VaEMh8Vamydxh8Uxbkkamc:WDf8KjjjjbaPk;Vvivuv99lu8Jjjjjbca9Rgv8Kjjjjbdndnalcw0mbaiydbhoaeabcitfgralcdtcufBdlaraoBdbdnalcd6mbaiclfhoalcufhwarcxfhrinaoydbhDarcuBdbarc98faDBdbarcwfhraoclfhoawcufgwmbkkalabfhrxekcbhDavczfcwfcbBdbav9cb83izavcwfcbBdbav9cb83ibJbbjZhqJbbjZhkinadaiaDcdtfydbcK2fhwcbhrinavczfarfgoawarfIdbgxaoIdbgm:tgPakNamMgmUdbavarfgoaPaxam:tNaoIdbMUdbarclfgrcx9hmbkJbbjZaqJbbjZMgq:vhkaDcefgDal9hmbkcbhoadcbcecdavIdlgxavIdwgm9GEgravIdbgPam9GEaraPax9GEgscdtgrfhzavczfarfIdbhxaihralhwinaiaocdtfgDydbhHaDarydbgOBdbaraHBdbarclfhraoazaOcK2fIdbax9Dfhoawcufgwmbkaeabcitfhrdndnaocv6mbaoalc98f6mekaraiydbBdbaralcdtcufBdlaiclfhoalcufhwarcxfhrinaoydbhDarcuBdbarc98faDBdbarcwfhraoclfhoawcufgwmbkalabfhrxekaraxUdbararydlc98GasVBdlabcefaeadaiaoz:djjjbhwararydlciGawabcu7fcdtVBdlawaeadaiaocdtfalao9Rz:djjjbhrkavcaf8Kjjjjbark:;idiud99dndnabaecitfgwydlgDciGgqciSmbinabcbaDcd4gDalaqcdtfIdbawIdb:tgkJbbbb9FEgwaecefgefadaialavaoarz:ejjjbak:larIdb9FTmdabawaD7aefgecitfgwydlgDciGgqci9hmbkkabaecitfgeclfhbdnavmbcuhwindnaiaeydbgDfRbbmbadaDcK2fgqIdwalIdw:tgkakNaqIdbalIdb:tgkakNaqIdlalIdl:tgkakNMM:rgkarIdb9DTmbarakUdbaoaDBdbkaecwfheawcefgwabydbcd46mbxdkkcuhwindnaiaeydbgDfRbbmbadaDcK2fgqIdbalIdb:t:lgkaqIdlalIdl:t:lgxakax9EEgkaqIdwalIdw:t:lgxakax9EEgkarIdb9DTmbarakUdbaoaDBdbkaecwfheawcefgwabydbcd46mbkkk;llevudnabydwgxaladcetfgm8Vebcs4alaecetfgP8Vebgscs4falaicetfgz8Vebcs4ffaD0abydxaq9pVakVgDce9hmbavawcltfgxab8Pdb83dbaxcwfabcwfgx8Pdb83dbdnaxydbgqTmbaoabydbcdtfhxaqhsinalaxydbcetfcFFi87ebaxclfhxascufgsmbkkdnabydxglci2gsabydlgxfgkciGTmbarakfcbalaxcu7fciGcefz:njjjb8Aabydxci2hsabydlhxabydwhqkab9cb83dwababydbaqfBdbabascifc98GaxfBdlaP8Vebhscbhxkdnascztcz91cu9kmbabaxcefBdwaPax87ebaoabydbcdtfaxcdtfaeBdbkdnam8Uebcu9kmbababydwgxcefBdwamax87ebaoabydbcdtfaxcdtfadBdbkdnaz8Uebcu9kmbababydwgxcefBdwazax87ebaoabydbcdtfaxcdtfaiBdbkarabydlfabydxci2faPRbb86bbarabydlfabydxci2fcefamRbb86bbarabydlfabydxci2fcdfazRbb86bbababydxcefBdxaDk8LbabaeadaialavaoarawaDaDaqJbbbbz:cjjjbk;Nkovud99euv99eul998Jjjjjbc:W;ae9Rgo8KjjjjbdndnadTmbavcd4hrcbhwcbhDindnaiaeclfydbar2cdtfgvIdbaiaeydbar2cdtfgqIdbgk:tgxaiaecwfydbar2cdtfgmIdlaqIdlgP:tgsNamIdbak:tgzavIdlaP:tgPN:tgkakNaPamIdwaqIdwgH:tgONasavIdwaH:tgHN:tgPaPNaHazNaOaxN:tgxaxNMM:rgsJbbbb9Bmbaoc:W:qefawcx2fgAakas:vUdwaAaxas:vUdlaAaPas:vUdbaoc8Wfawc8K2fgAaq8Pdb83dbaAav8Pdb83dxaAam8Pdb83dKaAcwfaqcwfydbBdbaAcCfavcwfydbBdbaAcafamcwfydbBdbawcefhwkaecxfheaDcifgDad6mbkab9cb83dbabcyf9cb83dbabcaf9cb83dbabcKf9cb83dbabczf9cb83dbabcwf9cb83dbawTmeaocbBd8Sao9cb83iKao9cb83izaoczfaoc8Wfawci2cxaoc8Sfcbcrz1jjjbaoIdKhCaoIdChXaoIdzhQao9cb83iwao9cb83ibaoaoc:W:qefawcxaoc8Sfcbciz1jjjbJbbjZhkaoIdwgPJbbbbJbbjZaPaPNaoIdbgPaPNaoIdlgsasNMM:rgx:vaxJbbbb9BEgzNhxasazNhsaPazNhzaoc:W:qefheawhvinaecwfIdbaxNaeIdbazNasaeclfIdbNMMgPakaPak9DEhkaecxfheavcufgvmbkabaCUdwabaXUdlabaQUdbabaoId3UdxdndnakJ;n;m;m899FmbJbbbbhPaoc:W:qefheaoc8WfhvinaCavcwfIdb:taecwfIdbgHNaQavIdb:taeIdbgONaXavclfIdb:taeclfIdbgLNMMaxaHNazaONasaLNMM:vgHaPaHaP9EEhPavc8KfhvaecxfheawcufgwmbkabaxUd8KabasUdaabazUd3abaCaxaPN:tUdKabaXasaPN:tUdCabaQazaPN:tUdzabJbbjZakakN:t:rgkUdydndnaxJbbj:;axJbbj:;9GEgPJbbjZaPJbbjZ9FEJbb;:9cNJbbbZJbbb:;axJbbbb9GEMgP:lJbbb9p9DTmbaP:Ohexekcjjjj94hekabae86b8UdndnasJbbj:;asJbbj:;9GEgPJbbjZaPJbbjZ9FEJbb;:9cNJbbbZJbbb:;asJbbbb9GEMgP:lJbbb9p9DTmbaP:Ohvxekcjjjj94hvkabav86bRdndnazJbbj:;azJbbj:;9GEgPJbbjZaPJbbjZ9FEJbb;:9cNJbbbZJbbb:;azJbbbb9GEMgP:lJbbb9p9DTmbaP:Ohqxekcjjjj94hqkabaq86b8SdndnaecKtcK91:YJbb;:9c:vax:t:lavcKtcK91:YJbb;:9c:vas:t:laqcKtcK91:YJbb;:9c:vaz:t:lakMMMJbb;:9cNJbbjZMgk:lJbbb9p9DTmbak:Ohexekcjjjj94hekaecFbaecFb9iEhexekabcjjj;8iBdycFbhekabae86b8Vxekab9cb83dbabcyf9cb83dbabcaf9cb83dbabcKf9cb83dbabczf9cb83dbabcwf9cb83dbkaoc:W;aef8Kjjjjbk;Iwwvul99iud99eue99eul998Jjjjjbcje9Rgr8Kjjjjbavcd4hwaicd4hDdndnaoTmbarc;abfcbaocdtgvz:njjjb8Aarc;Gbfcbavz:njjjb8AarhvarcafhiaohqinavcFFF97BdbaicFFF;7rBdbaiclfhiavclfhvaqcufgqmbkdnadTmbcbhkinaeakaD2cdtfgvIdwhxavIdlhmavIdbhPalakaw2cdtfIdbhsarc;abfhzarhiarc;GbfhHarcafhqcj1jjbhvaohOinasavcwfIdbaxNavIdbaPNavclfIdbamNMMgAMhCakhXdnaAas:tgAaqIdbgQ9DgLmbaHydbhXkaHaXBdbakhXdnaCaiIdbgK9EmbazydbhXaKhCkazaXBdbaiaCUdbaqaAaQaLEUdbavcxfhvaqclfhqaHclfhHaiclfhiazclfhzaOcufgOmbkakcefgkad9hmbkkadThkJbbbbhCcbhXarc;abfhvarc;Gbfhicbhqinalavydbgzaw2cdtfIdbalaiydbgHaw2cdtfIdbaeazaD2cdtfgzIdwaeaHaD2cdtfgHIdw:tgsasNazIdbaHIdb:tgsasNazIdlaHIdl:tgsasNMM:rMMgsaCasaC9EgzEhCaqaXazEhXaiclfhiavclfhvaoaqcefgq9hmbkaCJbbbZNhKxekadThkcbhXJbbbbhKkJbbbbhCdnaearc;abfaXcdtgifydbgqaD2cdtfgvIdwaearc;GbfaifydbgzaD2cdtfgiIdwgm:tgsasNavIdbaiIdbgY:tgAaANavIdlaiIdlgP:tgQaQNMM:rgxJbbbb9ETmbaxalaqaw2cdtfIdbMalazaw2cdtfIdb:taxaxM:vhCkasaCNamMhmaQaCNaPMhPaAaCNaYMhYdnakmbaDcdthvawcdthiindnalIdbg8AaecwfIdbam:tgCaCNaeIdbaY:tgsasNaeclfIdbaP:tgAaANMM:rgQMgEaK9ETmbJbbbbhxdnaQJbbbb9ETmbaEaK:taQaQM:vhxkaxaCNamMhmaxaANaPMhPaxasNaYMhYa8AaKaQMMJbbbZNhKkaeavfhealaifhladcufgdmbkkabaKUdxabamUdwabaPUdlabaYUdbarcjef8Kjjjjbkjeeiu8Jjjjjbcj8W9Rgr8Kjjjjbaici2hwdnaiTmbawceawce0EhDarhiinaiaeadRbbcdtfydbBdbadcefhdaiclfhiaDcufgDmbkkabarawaladaoz:hjjjbarcj8Wf8Kjjjjbk:3lequ8JjjjjbcjP9Rgl8Kjjjjbcbhvalcjxfcbaiz:njjjb8AdndnadTmbcjehoaehrincuhwarhDcuhqavhkdninawakaoalcjxfaDcefRbbfRbb9RcFeGci6aoalcjxfaDRbbfRbb9RcFeGci6faoalcjxfaDcdfRbbfRbb9RcFeGci6fgxaq9mgmEhwdnammbaxce0mdkaxaqaxaq9kEhqaDcifhDadakcefgk9hmbkkaeawci2fgDcdfRbbhqaDcefRbbhxaDRbbhkaeavci2fgDcifaDawav9Rci2z:qjjjb8Aakalcjxffaocefgo86bbaxalcjxffao86bbaDcdfaq86bbaDcefax86bbaDak86bbaqalcjxffao86bbarcifhravcefgvad9hmbkalcFeaicetz:njjjbhoadci2gDceaDce0EhqcbhxindnaoaeRbbgkcetfgw8UebgDcu9kmbawax87ebaocjlfaxcdtfabakcdtfydbBdbaxhDaxcefhxkaeaD86bbaecefheaqcufgqmbkaxcdthDxekcbhDkabalcjlfaDz:mjjjb8AalcjPf8Kjjjjbk9teiucbcbyd;C1jjbgeabcifc98GfgbBd;C1jjbdndnabZbcztgd9nmbcuhiabad9RcFFifcz4nbcuSmekaehikaik;teeeudndnaeabVciGTmbabhixekdndnadcz9pmbabhixekabhiinaiaeydbBdbaiaeydlBdlaiaeydwBdwaiaeydxBdxaeczfheaiczfhiadc9Wfgdcs0mbkkadcl6mbinaiaeydbBdbaeclfheaiclfhiadc98fgdci0mbkkdnadTmbinaiaeRbb86bbaicefhiaecefheadcufgdmbkkabk:3eedudndnabciGTmbabhixekaecFeGc:b:c:ew2hldndnadcz9pmbabhixekabhiinaialBdxaialBdwaialBdlaialBdbaiczfhiadc9Wfgdcs0mbkkadcl6mbinaialBdbaiclfhiadc98fgdci0mbkkdnadTmbinaiae86bbaicefhiadcufgdmbkkabk9teiucbcbyd;C1jjbgeabcrfc94GfgbBd;C1jjbdndnabZbcztgd9nmbcuhiabad9RcFFifcz4nbcuSmekaehikaik9:eiuZbhedndncbyd;C1jjbgdaecztgi9nmbcuheadai9RcFFifcz4nbcuSmekadhekcbabae9Rcifc98Gcbyd;C1jjbfgdBd;C1jjbdnadZbcztge9nmbadae9RcFFifcz4nb8Akk:;Deludndndnadch9pmbabaeSmdaeabadfgi9Rcbadcet9R0mekabaead;8qbbxekaeab7ciGhldndndnabae9pmbdnalTmbadhvabhixikdnabciGmbadhvabhixdkadTmiabaeRbb86bbadcufhvdnabcefgiciGmbaecefhexdkavTmiabaeRbe86beadc9:fhvdnabcdfgiciGmbaecdfhexdkavTmiabaeRbd86bdadc99fhvdnabcifgiciGmbaecifhexdkavTmiabaeRbi86biabclfhiaeclfheadc98fhvxekdnalmbdnaiciGTmbadTmlabadcufgifglaeaifRbb86bbdnalciGmbaihdxekaiTmlabadc9:fgifglaeaifRbb86bbdnalciGmbaihdxekaiTmlabadc99fgifglaeaifRbb86bbdnalciGmbaihdxekaiTmlabadc98fgdfaeadfRbb86bbkadcl6mbdnadc98fgocd4cefciGgiTmbaec98fhlabc98fhvinavadfaladfydbBdbadc98fhdaicufgimbkkaocx6mbaec9Wfhvabc9WfhoinaoadfgicxfavadfglcxfydbBdbaicwfalcwfydbBdbaiclfalclfydbBdbaialydbBdbadc9Wfgdci0mbkkadTmdadhidnadciGglTmbaecufhvabcufhoadhiinaoaifavaifRbb86bbaicufhialcufglmbkkadcl6mdaec98fhlabc98fhvinavaifgecifalaifgdcifRbb86bbaecdfadcdfRbb86bbaecefadcefRbb86bbaeadRbb86bbaic98fgimbxikkavcl6mbdnavc98fglcd4cefcrGgdTmbavadcdt9RhvinaiaeydbBdbaeclfheaiclfhiadcufgdmbkkalc36mbinaiaeydbBdbaiaeydlBdlaiaeydwBdwaiaeydxBdxaiaeydzBdzaiaeydCBdCaiaeydKBdKaiaeyd3Bd3aecafheaicafhiavc9Gfgvci0mbkkavTmbdndnavcrGgdmbavhlxekavc94GhlinaiaeRbb86bbaicefhiaecefheadcufgdmbkkavcw6mbinaiaeRbb86bbaiaeRbe86beaiaeRbd86bdaiaeRbi86biaiaeRbl86blaiaeRbv86bvaiaeRbo86boaiaeRbr86braicwfhiaecwfhealc94fglmbkkabkk9Tdbcjwk9ubbjZbbbbbbbbbbbbbbjZbbbbbbbbbbbbbbjZ86;nAZ86;nAZ86;nAZ86;nA:;86;nAZ86;nAZ86;nAZ86;nA:;86;nAZ86;nAZ86;nAZ86;nA:;bc;uwkxebbbdbbb9GNbb",t=new Uint8Array([32,0,65,2,1,106,34,33,3,128,11,4,13,64,6,253,10,7,15,116,127,5,8,12,40,16,19,54,20,9,27,255,113,17,42,67,24,23,146,148,18,14,22,45,70,69,56,114,101,21,25,63,75,136,108,28,118,29,73,115]);if(typeof WebAssembly!="object")return{supported:!1};var r,a=WebAssembly.instantiate(s(e),{}).then(function(h){r=h.instance,r.exports.__wasm_call_ctors()});function s(h){for(var u=new Uint8Array(h.length),m=0;m<h.length;++m){var g=h.charCodeAt(m);u[m]=g>96?g-97:g>64?g-39:g+4}for(var y=0,m=0;m<h.length;++m)u[y++]=u[m]<60?t[u[m]]:(u[m]-60)*64+u[++m];return u.buffer.slice(0,y)}function n(h){if(!h)throw new Error("Assertion failed")}function i(h){return new Uint8Array(h.buffer,h.byteOffset,h.byteLength)}var o=48,c=16;function l(h,u){var m=h.meshlets[u*4+0],g=h.meshlets[u*4+1],y=h.meshlets[u*4+2],x=h.meshlets[u*4+3];return{vertices:h.vertices.subarray(m,m+y),triangles:h.triangles.subarray(g,g+x*3)}}function f(h,u,m,g,y,x,v){var E=r.exports.sbrk,S=r.exports.meshopt_buildMeshletsBound(h.length,y,x),T=E(S*c),_=E(S*y*4),I=E(S*x*3),N=E(h.byteLength),C=E(u.byteLength),B=new Uint8Array(r.exports.memory.buffer);B.set(i(h),N),B.set(i(u),C);var R=r.exports.meshopt_buildMeshlets(T,_,I,N,h.length,C,m,g,y,x,v);B=new Uint8Array(r.exports.memory.buffer);for(var j=B.subarray(T,T+R*c),q=new Uint32Array(j.buffer,j.byteOffset,j.byteLength/4).slice(),Y=0;Y<R;++Y){var te=q[Y*4+0],we=q[Y*4+1],m=q[Y*4+2],ne=q[Y*4+3];r.exports.meshopt_optimizeMeshlet(_+te*4,I+we,ne,m)}var me=q[(R-1)*4+0],Pe=q[(R-1)*4+1],he=q[(R-1)*4+2],Re=q[(R-1)*4+3],je=me+he,Ve=Pe+(Re*3+3&-4),ye={meshlets:q,vertices:new Uint32Array(B.buffer,_,je).slice(),triangles:new Uint8Array(B.buffer,I,Ve*3).slice(),meshletCount:R};return E(T-E(0)),ye}function d(h){var u=new Float32Array(r.exports.memory.buffer,h,o/4);return{centerX:u[0],centerY:u[1],centerZ:u[2],radius:u[3],coneApexX:u[4],coneApexY:u[5],coneApexZ:u[6],coneAxisX:u[7],coneAxisY:u[8],coneAxisZ:u[9],coneCutoff:u[10]}}function p(h,u,m,g){var y=r.exports.sbrk,x=[],v=y(u.byteLength),E=y(h.vertices.byteLength),S=y(h.triangles.byteLength),T=y(o),_=new Uint8Array(r.exports.memory.buffer);_.set(i(u),v),_.set(i(h.vertices),E),_.set(i(h.triangles),S);for(var I=0;I<h.meshletCount;++I){var N=h.meshlets[I*4+0],C=h.meshlets[I*4+0+1],B=h.meshlets[I*4+0+3];r.exports.meshopt_computeMeshletBounds(T,E+N*4,S+C,B,v,m,g),x.push(d(T))}return y(v-y(0)),x}function b(h,u,m,g){var y=r.exports.sbrk,x=y(o),v=y(h.byteLength),E=y(u.byteLength),S=new Uint8Array(r.exports.memory.buffer);S.set(i(h),v),S.set(i(u),E),r.exports.meshopt_computeClusterBounds(x,v,h.length,E,m,g);var T=d(x);return y(x-y(0)),T}return{ready:a,supported:!0,buildMeshlets:function(h,u,m,g,y,x){n(h.length%3==0),n(u instanceof Float32Array),n(u.length%m==0),n(m>=3),n(g<=256||g>0),n(y<=512),n(y%4==0),x=x||0;var v=h.BYTES_PER_ELEMENT==4?h:new Uint32Array(h);return f(v,u,u.length/m,m*4,g,y,x)},computeClusterBounds:function(h,u,m){n(h.length%3==0),n(h.length/3<=512),n(u instanceof Float32Array),n(u.length%m==0),n(m>=3);var g=h.BYTES_PER_ELEMENT==4?h:new Uint32Array(h);return b(g,u,u.length/m,m*4)},computeMeshletBounds:function(h,u,m){return n(h.meshletCount!=0),n(u instanceof Float32Array),n(u.length%m==0),n(m>=3),p(h,u,u.length/m,m*4)},extractMeshlet:function(h,u){return n(u>=0&&u<h.meshletCount),l(h,u)}}})();var md=new Vl().registerExtensions([ji,Li,Di]).registerDependencies({"meshopt.decoder":Ns});async function la(e,t={}){await Ns.ready;let r;if(t.fetchBytes)r=new Uint8Array(await t.fetchBytes(e));else{let c=await fetch(e,{cache:t.fetchCache||"no-store"});if(!c.ok)throw new Error(`Failed to load ${e}: ${c.status}`);r=new Uint8Array(await c.arrayBuffer())}let a=await md.readBinary(r),s=[],n=t.componentFeatures||new Map,i=new Map;function o(c,l=""){let f=n.has(c.getName());f&&i.set(c.getName(),(i.get(c.getName())||0)+1);let d=f?c.getName():l,p=c.getMesh();if(p){let b=c.getWorldMatrix();for(let h of p.listPrimitives()){let u=h.getAttribute("POSITION"),m=h.getAttribute("NORMAL"),g=h.getAttribute("_FEATURE_ID_0"),y=h.getAttribute("_FEATURE_ID_1"),x=h.getIndices()?.getArray();if(!u||!x)continue;let v=u.getCount(),E=new Float32Array(v*3),S=new Float32Array(v*3),T=new Uint32Array(v),_=new Uint32Array(v),I=[1/0,1/0,1/0,-1/0,-1/0,-1/0],N=[],C=n.get(d)?.featureId||t.defaultFeatureId||0;for(let R=0;R<v;R+=1)u.getElement(R,N),tx(E,R*3,N,b),I[0]=Math.min(I[0],E[R*3]),I[1]=Math.min(I[1],E[R*3+1]),I[2]=Math.min(I[2],E[R*3+2]),I[3]=Math.max(I[3],E[R*3]),I[4]=Math.max(I[4],E[R*3+1]),I[5]=Math.max(I[5],E[R*3+2]),m?(m.getElement(R,N),rx(S,R*3,N,b)):S.set([0,0,1],R*3),T[R]=Number(g?.getScalar(R)||0),_[R]=Number(y?y.getScalar(R)||0:C);let B=h.getMaterial();s.push({position:E,normal:S,netId:T,objectFeatureId:_,indices:x,designator:d,nodeName:c.getName(),meshName:p.getName(),bounds:I,material:B?{name:B.getName(),baseColor:B.getBaseColorFactor(),metallic:B.getMetallicFactor(),roughness:B.getRoughnessFactor(),emissive:B.getEmissiveFactor()}:{baseColor:t.baseColor||[.55,.58,.64,1],metallic:.05,roughness:.72,emissive:[0,0,0]}})}}for(let b of c.listChildren())o(b,d)}for(let c of a.getRoot().listScenes())for(let l of c.listChildren())o(l);return{byteLength:r.byteLength,primitives:s,componentNodeCounts:i}}function tx(e,t,r,a){let s=a[0]*r[0]+a[4]*r[1]+a[8]*r[2]+a[12],n=a[1]*r[0]+a[5]*r[1]+a[9]*r[2]+a[13],i=a[2]*r[0]+a[6]*r[1]+a[10]*r[2]+a[14];e[t]=s,e[t+1]=-i,e[t+2]=n}function rx(e,t,r,a){let s=a[0]*r[0]+a[4]*r[1]+a[8]*r[2],n=a[1]*r[0]+a[5]*r[1]+a[9]*r[2],i=a[2]*r[0]+a[6]*r[1]+a[10]*r[2],o=Math.hypot(s,n,i)||1;e[t]=s/o,e[t+1]=-i/o,e[t+2]=n/o}async function yd(e,t={}){await Ns.ready;let r;if(t.fetchBytes)r=new Uint8Array(await t.fetchBytes(e));else{let d=await fetch(e,{cache:t.fetchCache||"no-store"});if(!d.ok)throw new Error(`Failed to load ${e}: ${d.status}`);r=new Uint8Array(await d.arrayBuffer())}let a=await md.readBinary(r),s=t.componentFeatures||new Map,n=new Map,i=new Map,o=new Map,c=0;function l(d){if(o.has(d))return o.get(d);let p=d.getAttribute("POSITION"),b=d.getIndices()?.getArray();if(!p||!b)return o.set(d,null),null;let h=d.getAttribute("NORMAL"),u=d.getAttribute("_FEATURE_ID_0"),m=d.getAttribute("_FEATURE_ID_1"),g=p.getCount(),y=new Float32Array(g*3),x=new Float32Array(g*3),v=new Uint32Array(g),E=new Uint32Array(g),S=[];for(let C=0;C<g;C+=1)p.getElement(C,S),y.set(S.slice(0,3),C*3),h?(h.getElement(C,S),x.set(S.slice(0,3),C*3)):x.set([0,1,0],C*3),v[C]=Number(u?.getScalar(C)||0),E[C]=Number(m?.getScalar(C)||0);let T=nx(d.getMaterial(),t),_=[ca(y),ca(x),ca(v),ca(E),ca(b),g,b.length,JSON.stringify(T)].join(":"),I=i.get(_),N=I;return(!I||!ix(I.primitive,y,x,v,E,b))&&(N={primitive:{position:y,normal:x,netId:v,objectFeatureId:E,indices:Uint32Array.from(b),material:T,bounds:null},placements:[]},i.set(I?`${_}:${i.size}`:_,N)),o.set(d,N),N}function f(d,p=""){let b=s.has(d.getName());b&&n.set(d.getName(),(n.get(d.getName())||0)+1);let h=b?d.getName():p,u=d.getMesh();if(u){let m=ax(d.getWorldMatrix()),g=Number(s.get(h)?.featureId||t.defaultFeatureId||0),y=c++;for(let x of u.listPrimitives()){let v=l(x);if(!v)continue;let E=sx(v.primitive.position,m);v.placements.push({rows:m,featureId:g,designator:h,bounds:E,node:y});let S=v.primitive.bounds;v.primitive.bounds=S?[Math.min(S[0],E[0]),Math.min(S[1],E[1]),Math.min(S[2],E[2]),Math.max(S[3],E[3]),Math.max(S[4],E[4]),Math.max(S[5],E[5])]:[...E]}}for(let m of d.listChildren())f(m,h)}for(let d of a.getRoot().listScenes())for(let p of d.listChildren())f(p);return{byteLength:r.byteLength,models:[...i.values()],componentNodeCounts:n}}function ax(e){return[e[0],e[4],e[8],e[12],-e[2],-e[6],-e[10],-e[14],e[1],e[5],e[9],e[13]]}function sx(e,t){let r=[1/0,1/0,1/0,-1/0,-1/0,-1/0];for(let a=0;a<e.length;a+=3){let s=e[a],n=e[a+1],i=e[a+2];for(let o=0;o<3;o+=1){let c=o*4,l=t[c]*s+t[c+1]*n+t[c+2]*i+t[c+3];l<r[o]&&(r[o]=l),l>r[o+3]&&(r[o+3]=l)}}return r}function nx(e,t){return e?{name:e.getName(),baseColor:e.getBaseColorFactor(),metallic:e.getMetallicFactor(),roughness:e.getRoughnessFactor(),emissive:e.getEmissiveFactor()}:{baseColor:t.baseColor||[.55,.58,.64,1],metallic:.05,roughness:.72,emissive:[0,0,0]}}function ca(e){let t=e.BYTES_PER_ELEMENT===4?new Uint32Array(e.buffer,e.byteOffset,e.length):e,r=2166136261;for(let a=0;a<t.length;a+=1)r^=t[a],r=Math.imul(r,16777619)>>>0;return r.toString(36)}function ix(e,t,r,a,s,n){let i=(o,c)=>o.length===c.length&&o.every((l,f)=>l===c[f]);return i(e.position,t)&&i(e.normal,r)&&i(e.netId,a)&&i(e.objectFeatureId,s)&&i(e.indices,n)}var dr=Object.freeze({mm:1,fineMm:.1,deg:15,fineDeg:1}),Ui=Object.freeze([[1,0,0],[0,1,0],[0,0,1]]);function xd(e){return Math.round(e*1e9)/1e9+0}function Zt(e){let t=Math.hypot(...e.rotation)||1,r=e.rotation.map(s=>s/t),a=[r[3],r[0],r[1],r[2]].find(s=>Math.abs(s)>1e-12)??1;return{translationMm:e.translationMm.map(xd),rotation:r.map(s=>xd(a<0?-s:s))}}function ox(e){let[t,r,a,s]=e.rotation,[n,i,o]=e.translationMm;return[1-2*(r*r+a*a),2*(t*r+a*s),2*(t*a-r*s),0,2*(t*r-a*s),1-2*(t*t+a*a),2*(r*a+t*s),0,2*(t*a+r*s),2*(r*a-t*s),1-2*(t*t+r*r),0,n,i,o,1]}function wd(e,t){let r=new Array(16);for(let a=0;a<4;a+=1)for(let s=0;s<4;s+=1)r[a*4+s]=e[s]*t[a*4]+e[4+s]*t[a*4+1]+e[8+s]*t[a*4+2]+e[12+s]*t[a*4+3];return r}function cx(e){let t=[e[0],e[4],e[8],0,e[1],e[5],e[9],0,e[2],e[6],e[10],0,0,0,0,1];for(let r=0;r<3;r+=1)t[12+r]=-(t[r]*e[12]+t[4+r]*e[13]+t[8+r]*e[14]);return t}function Cs(e,t){return t>0?Math.round(e/t)*t:e}function Gi(e,t){let r=t[0]**2+t[1]**2;return r<1e-9?0:(e[0]*t[0]+e[1]*t[1])/r}function vd(e,t,r){let a=Math.atan2(t[1]-e[1],t[0]-e[0]),n=Math.atan2(r[1]-e[1],r[0]-e[0])-a;for(;n>Math.PI;)n-=2*Math.PI;for(;n<-Math.PI;)n+=2*Math.PI;return n}function Md(e,t,r){return it(e,t)>=0?-r:r}function kd(e){return Ui.map(t=>yi(e.rotation,t))}function Ed(e,t,r){return{translationMm:e.translationMm.map((a,s)=>a+t[s]*r),rotation:[...e.rotation]}}function Sd(e,t,r,a){let s=tl(t,r),n=e.translationMm.map((o,c)=>o-a[c]);return{translationMm:yi(s,n).map((o,c)=>o+a[c]),rotation:ls(s,e.rotation)}}function Td(e,t){if(t==null)return null;let r=`/${String(t).split("/")[1]||""}`;return(e?.occurrences||[]).find(a=>a.path===r&&a.depth===1)??null}function Ad(e,t,r){let a=e.occurrences.find(o=>o.path===t);if(!a||a.depth!==1)return e;let s=ox(r),n=wd(s,cx(a.worldMatrix)),i=`${t}/`;return{...e,occurrences:e.occurrences.map(o=>o.path===t?{...o,pose:{...Zt(r),source:"manual"},worldMatrix:s}:o.path.startsWith(i)?{...o,worldMatrix:wd(n,o.worldMatrix)}:o)}}function _d(e){let t=Math.abs(e[0])<.9?[1,0,0]:[0,1,0];return Je(Qe(e,t))}var lx=Object.freeze([0,1,1,0]),da=`
struct Occurrence {
  model: mat4x4f,
  normal: mat4x4f,
  hiddenLayers: vec4u,
  explode: vec4f,
};
@group(0) @binding(2) var<storage, read> layerOffsets: array<f32>;
@group(0) @binding(5) var<storage, read> occurrences: array<Occurrence>;
// The cull pass (SB2-25) lists the occurrences to draw, interleaved by level of
// detail: slot * 4 + list. Components draw for LIST_FULL; copper, barrels,
// silkscreen and paste for LIST_BOARD (full or board); substrate and mask for
// LIST_BODY (full, board or body); the stand-in box for LIST_BOX.
@group(0) @binding(7) var<storage, read> visibleOccurrences: array<u32>;
const LIST_FULL = 0u;
const LIST_BOARD = 1u;
const LIST_BODY = 2u;
const LIST_BOX = 3u;
fn listedOccurrence(list: u32, instance: u32) -> u32 { return visibleOccurrences[instance * 4u + list]; }
// draw.offset.w is the draw's layer id + 1 for copper and paste (0: no layer).
// A draw this occurrence's separation removes: components once exploded, paste whenever separated.
fn explodeHides(occurrence: Occurrence, kind: f32, layerPlusOne: f32) -> bool {
  let explode = occurrence.explode;
  if (explode.w < 0.5) { return false; }
  if (kind > 1.5 && kind < 2.5 && explode.y < 0.5) { return true; }
  return kind < 0.5 && layerPlusOne > 0.5 && explode.x > 0.0;
}
// How far this occurrence lifts a copper or paste draw's layer (0: the draw's own offset stands).
fn explodeLift(occurrence: Occurrence, layerPlusOne: f32) -> f32 {
  if (occurrence.explode.w < 0.5 || layerPlusOne < 0.5) { return 0.0; }
  return layerOffsets[u32(layerPlusOne + 0.5) - 1u] * occurrence.explode.x;
}
fn layerHiddenAt(occurrence: Occurrence, layerPlusOne: f32) -> bool {
  if (layerPlusOne < 0.5) { return false; }
  let layer = u32(layerPlusOne + 0.5) - 1u;
  if (layer >= 128u) { return false; }
  return (occurrence.hiddenLayers[layer / 32u] & (1u << (layer % 32u))) != 0u;
}
`,tt=Object.freeze([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);function dx(e){let t=e?.matrix??e;if(!t||typeof t.length!="number"||t.length!==16)throw new TypeError("An occurrence matrix must have 16 numbers (column-major)");let r=Array.from(t,Number);if(!r.every(Number.isFinite))throw new TypeError("An occurrence matrix must be finite");if(r[3]!==0||r[7]!==0||r[11]!==0||r[15]!==1)throw new TypeError("An occurrence matrix must be affine (last row 0 0 0 1)");return r}function ux(e){let[t,r,a,,s,n,i,,o,c,l]=e,f=n*l-c*i,d=c*a-r*l,p=r*i-n*a,b=o*i-s*l,h=t*l-o*a,u=s*a-t*i,m=s*c-o*n,g=o*r-t*c,y=t*n-s*r,x=t*f+s*d+o*p;if(x===0)throw new TypeError("An occurrence matrix must be invertible");let v=x<0?-1:1;return[v*f,v*b,v*m,0,v*d,v*h,v*g,0,v*p,v*u,v*y,0,0,0,0,1]}function fx(e){let t=new Uint32Array(4);for(let r of e||[]){let a=Number(r);!Number.isInteger(a)||a<0||a>=128||(t[a>>>5]|=1<<(a&31)>>>0)}return t}function Bs(e,t=[],r=[]){let a=new Float32Array(Math.max(1,e.length)*40),s=new Uint32Array(a.buffer);return e.forEach((n,i)=>{let o=i*40;a.set(n,o),a.set(ux(n),o+16),t[i]&&s.set(fx(t[i]),o+32),a.set(r[i]||lx,o+36)}),a}function Os(e,t){let[r,a,s]=t;return[e[0]*r+e[4]*a+e[8]*s+e[12],e[1]*r+e[5]*a+e[9]*s+e[13],e[2]*r+e[6]*a+e[10]*s+e[14]]}function Et(e,t){if(!t)return null;let r=[1/0,1/0,1/0,-1/0,-1/0,-1/0];for(let a=0;a<8;a+=1){let s=Os(e,[t[a&1?3:0],t[a&2?4:1],t[a&4?5:2]]);for(let n=0;n<3;n+=1)r[n]=Math.min(r[n],s[n]),r[n+3]=Math.max(r[n+3],s[n])}return r}function Fs(e){return e.every((t,r)=>t===tt[r])}var hx=0,bx=4294901759;function Id(e,t){let r=e>>>0,a=t>>>0;return r===hx?{kind:"none",occurrenceIndex:-1,featureId:0}:{kind:a?"feature":"board",occurrenceIndex:r-1,featureId:a}}function Rd(e){let t=Array.from(e);if(t.length>bx)throw new RangeError("Too many occurrences for the pick target");let r=t.map(dx),a=o=>o&&!Array.isArray(o)&&!ArrayBuffer.isView(o),s=t.map((o,c)=>a(o)&&o.key!=null?String(o.key):String(c));if(new Set(s).size!==s.length)throw new TypeError("Occurrence keys must be unique");let n=t.map(o=>a(o)&&o.hiddenLayers?[...o.hiddenLayers].map(Number):[]),i=t.map(o=>a(o)&&o.explode?[...o.explode].map(Number):null);return{matrices:r,keys:s,hiddenLayers:n,explode:i}}function ua(e,t,r){let[a,s,n]=t,i=e[0]*a+e[4]*s+e[8]*n+e[12],o=e[1]*a+e[5]*s+e[9]*n+e[13],c=e[2]*a+e[6]*s+e[10]*n+e[14],l=e[3]*a+e[7]*s+e[11]*n+e[15];return!(l>0)||c<0||c>l?null:{x:r.x+(i/l*.5+.5)*r.width,y:r.y+(.5-o/l*.5)*r.height}}var Ps=0;var Nd=3,zi=4,rA=Object.freeze(["full","board","body","box"]),lt=Object.freeze({fullPx:140,boardPx:70,boxPx:18,keep:.8});function Ir(e={}){let t=(i,o)=>Number.isFinite(Number(e[i]))?Math.max(0,Number(e[i])):o,r=t("boxPx",lt.boxPx),a=Math.max(r,t("boardPx",lt.boardPx)),s=Math.max(a,t("fullPx",lt.fullPx)),n=Math.min(1,Math.max(.05,t("keep",lt.keep)));return{fullPx:s,boardPx:a,boxPx:r,keep:n}}function Cd(e){let t=c=>[e[c],e[4+c],e[8+c],e[12+c]],[r,a,s,n]=[t(0),t(1),t(2),t(3)],i=(c,l)=>c.map((f,d)=>f+l[d]),o=(c,l)=>c.map((f,d)=>f-l[d]);return[i(n,r),o(n,r),i(n,a),o(n,a),s,o(n,s)]}var fa=class{constructor(t,r,a,s=16777216){this.device=t,this.usage=r|Bd.COPY_SRC|Bd.COPY_DST,this.label=a,this.chunkBytes=s,this.chunks=[],this.usedBytes=0,this.generation=0,this.repacks=0}alloc(t){let a={buffer:null,offset:0,size:Math.max(4,Math.ceil(t/4)*4),chunk:null};return this.place(a,null),a}place(t,r){let{size:a}=t,s=null;if(a<=this.chunkBytes/2)for(let o of this.chunks)o===r||o.dedicated||o.free.forEach((c,l)=>{c.size>=a&&(!s||c.size<s.range.size)&&(s={chunk:o,index:l,range:c})});let n,i;if(s)({chunk:n}=s),i=s.range.offset,s.range.size===a?n.free.splice(s.index,1):n.free[s.index]={offset:i+a,size:s.range.size-a};else{let o=a>this.chunkBytes/2,c=o?a:this.chunkBytes;n={buffer:this.device.createBuffer({label:`${this.label}-${this.chunks.length}`,size:c,usage:this.usage}),size:c,free:c>a?[{offset:a,size:c-a}]:[],used:0,live:new Set,dedicated:o},this.chunks.push(n),i=0}n.used+=a,n.live.add(t),this.usedBytes+=a,Object.assign(t,{buffer:n.buffer,offset:i,chunk:n})}write(t,r){this.device.queue.writeBuffer(t.buffer,t.offset,r)}free(t){let{chunk:r}=t;if(!(!r||!r.live.has(t))){if(this.release(r,t),t.chunk=null,!r.live.size){this.drop(r);return}!r.dedicated&&r.used<r.size*.5&&this.chunks.length>1&&this.repack(r)}}release(t,r){t.used-=r.size,t.live.delete(r),this.usedBytes-=r.size;let a=t.free,s=a.findIndex(n=>n.offset>r.offset);s<0&&(s=a.length),a.splice(s,0,{offset:r.offset,size:r.size}),s+1<a.length&&a[s].offset+a[s].size===a[s+1].offset&&(a[s].size+=a[s+1].size,a.splice(s+1,1)),s>0&&a[s-1].offset+a[s-1].size===a[s].offset&&(a[s-1].size+=a[s].size,a.splice(s,1))}drop(t){t.buffer.destroy?.(),this.chunks.splice(this.chunks.indexOf(t),1)}repack(t){let r=this.device.createCommandEncoder({label:`${this.label}-repack`});for(let a of[...t.live]){let s={buffer:a.buffer,offset:a.offset};this.release(t,a),this.place(a,t),r.copyBufferToBuffer(s.buffer,s.offset,a.buffer,a.offset,a.size)}this.device.queue.submit([r.finish()]),this.drop(t),this.generation+=1,this.repacks+=1}reservedBytes(){return this.chunks.reduce((t,r)=>t+r.size,0)}destroy(){for(let t of this.chunks)t.buffer.destroy?.();this.chunks=[],this.usedBytes=0}},Bd=globalThis.GPUBufferUsage||{COPY_SRC:4,COPY_DST:8};var Ki=Object.freeze(["decl","vs-out","vs-end","fs-begin","fs-return"]),px={decl:"decl","vs-out":"vsOut","vs-end":"vsEnd","fs-begin":"fsBegin"},gx=/^[ \t]*\/\/ @feature:[a-z-]+\n/gm;function de(e){if(!Ki.includes(e))throw new Error(`Unknown shader hook ${e}`);return`// @feature:${e}
`}function Be(e){return e.replace(gx,"")}function Vi(e){return ha(e).map(t=>t.name).join("+")}function ha(e=[]){let t=new Set;for(let r of e){if(!r?.name||!/^[a-z][a-z0-9-]*$/.test(r.name))throw new Error(`Bad shader feature name ${r?.name}`);if(t.has(r.name))throw new Error(`Shader feature ${r.name} given twice`);t.add(r.name)}return[...e].sort((r,a)=>r.name<a.name?-1:r.name>a.name?1:0)}function mx(e,t="shader"){for(let r of Ki){let a=Hi(e,r).length;if(a!==1)throw new Error(`${t}: hook ${r} appears ${a} times, expected once`)}Fd(e,t)}function Od(e,t=[],r={}){let a=ha(t);if(!a.length)return Be(e);let s=`${r.family||"shader"}${r.instanced?" (instanced)":""}`;mx(e,s);let n=e;for(let i of Ki){if(i==="fs-return"){let{start:d,end:p,indent:b,expression:h}=Fd(n,s),u=a.reduce((m,g)=>g.fsReturn?g.fsReturn(m,r):m,h);n=`${n.slice(0,d)}${b}return ${u};
${n.slice(p)}`;continue}let o=px[i],c=a.map(d=>d[o]?.(r)).filter(Boolean),[l]=Hi(n,i),f=c.map(d=>d.endsWith(`
`)?d:`${d}
`).join("");n=`${n.slice(0,l.index)}${f}${n.slice(l.index+l[0].length)}`}return Be(n)}function Hi(e,t){return[...e.matchAll(new RegExp(`^[ \\t]*// @feature:${t}\\n`,"gm"))]}function Fd(e,t){let[r]=Hi(e,"fs-return"),a=r.index+r[0].length,s=e.slice(a).match(/^([ \t]*)return (.+);\n/);if(!s)throw new Error(`${t}: hook fs-return is not followed by a return line`);return{start:r.index,end:a+s[0].length,indent:s[1],expression:s[2]}}var qi=`
fn featureHidden(id: u32) -> bool {
  return id < arrayLength(&hiddenMask) && hiddenMask[id] == 0u;
}
`;function js(e){let t=new Set;if(e==null)return t;for(let r of e){let a=Number(r);!Number.isInteger(a)||a<=0||a>4294967295||t.add(a)}return t}function Pd(e,t=0){let r=0;for(let n of js(e))r=Math.max(r,n);let a=64,s=r+1;for(;a<s;)a*=2;return Math.max(a,Math.floor(t)||0)}function jd(e,t){let r=Math.max(64,Math.floor(t)||0),a=new Uint32Array(r);a.fill(1);for(let s of js(e))s<r&&(a[s]=0);return a}function yx(e){let t=Number(e.drillWidthMm)||0,r=Number(e.drillHeightMm)||t,a=Math.min(t,r),s=Math.min(Number(e.outerWidthMm)||0,Number(e.outerHeightMm)||0),n=Number.isFinite(e.platingThicknessMm)?e.platingThicknessMm:Math.max(0,(s-a)/2),i=(Number(e.rotationDeg)||0)*Math.PI/180+(r>t?Math.PI/2:0);return{x:e.centerMm[0]/1e3,y:-e.centerMm[1]/1e3,drillRadius:a/2e3,outerRadius:(a/2+n)/1e3,halfLength:Math.abs(t-r)/2e3,angle:Math.abs(t-r)>0?-i:0,startZ:e.startZMm/1e3,endZ:e.endZMm/1e3,netId:e.netId||0,objectId:e.objectFeatureId||0,startLayerId:e.startLayerId||0,endLayerId:e.endLayerId||0}}function $i(e,t){let r=new Map((t||[]).map(a=>[Number(a.id),Number(a.thickness_mm)||0]));return(e||[]).map(a=>{let s=i=>Math.max(0,(r.get(Number(i))||0)/2-.001),n=a.startZMm>=a.endZMm?1:-1;return{...a,startZMm:a.startZMm+n*s(a.startLayerId),endZMm:a.endZMm-n*s(a.endLayerId)}})}var ba=0,Wi=16,Xi=24,pa=32,Ld=48,Dd=Object.freeze({arrayStride:Ld,stepMode:"instance",attributes:Object.freeze([Object.freeze({shaderLocation:3,offset:ba,format:"float32x4"}),Object.freeze({shaderLocation:4,offset:Wi,format:"float32x2"}),Object.freeze({shaderLocation:6,offset:Xi,format:"float32x2"}),Object.freeze({shaderLocation:5,offset:pa,format:"uint32x4"})])}),Yi=48,Ls=`struct Input {
  @location(0) unit: vec3f,
  @location(1) normal: vec3f,
  @location(2) radiusMix: f32,
  @location(3) dimensions: vec4f,
  @location(4) span: vec2f,
  @location(5) ids: vec4u,
  @location(6) shape: vec2f,
};`,Ud=`struct Barrel {
  dimensions: vec4f,
  span: vec2f,
  shape: vec2f,
  ids: vec4u,
};
@group(0) @binding(6) var<storage, read> barrels: array<Barrel>;`;function Gd(e,t,r){let a=new ArrayBuffer(Math.max(r,e.length)*t),s=new DataView(a);return e.forEach((n,i)=>{let o=i*t,c=yx(n);s.setFloat32(o+ba,c.x,!0),s.setFloat32(o+ba+4,c.y,!0),s.setFloat32(o+ba+8,c.drillRadius,!0),s.setFloat32(o+ba+12,c.outerRadius,!0),s.setFloat32(o+Wi,c.startZ,!0),s.setFloat32(o+Wi+4,c.endZ,!0),s.setFloat32(o+Xi,c.halfLength,!0),s.setFloat32(o+Xi+4,c.angle,!0),s.setUint32(o+pa,c.netId,!0),s.setUint32(o+pa+4,c.objectId,!0),s.setUint32(o+pa+8,c.startLayerId,!0),s.setUint32(o+pa+12,c.endLayerId,!0)}),a}function zd(e){return Gd(e,Ld,0)}function Kd(e){return Gd(e,Yi,1)}var Ji=e=>`
struct Palette {
  ramps: array<vec4f, 512>,
  outline: vec4f,
};
@group(0) @binding(${e}) var<uniform> palette: Palette;
fn ramp(t: f32, which: u32) -> vec3f {
  let x = clamp(t, 0.0, 1.0) * 255.0;
  let i = u32(floor(x));
  let j = min(i + 1u, 255u);
  return mix(palette.ramps[which * 256u + i].rgb, palette.ramps[which * 256u + j].rgb, x - floor(x));
}
fn fieldColor(t: f32) -> vec3f {
  return ramp(t, 0u);
}
`,Vd=`
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
struct Slice {
  color: vec4f,
  z: f32,
  overlay: u32,
  fieldOn: u32,
  // 1: copper off the lit nets is not drawn (net isolation, or inner copper
  // shown only where lit); 2: the layer is copper (it glows with its nets).
  netMode: u32,
  fieldOrigin: vec2f,
  // Cell pitch along board X and Y (mm); a grid's two pitches may differ.
  fieldPitch: vec2f,
  fieldSize: vec2u,
  padding2: vec2u,
  range: vec2f,
  padding3: vec2f,
  clearBounds: vec4f,
  // The layer's material: metallic, roughness, the face normal's z, and 1
  // for copper (which dims while a net is lit).
  material: vec4f,
  // The slab's bottom and top heights (world metres, exploded offset in).
  slab: vec2f,
  // How many of the slice's shapes subtract (they come first).
  subtracts: u32,
  // Millimetres the shapes grow by (a conformal coat's footprint), else 0.
  dilate: f32,
  // The camera in homogeneous world coordinates: a point (w = 1) for a
  // perspective view, the view direction (w = 0) for an orthographic one.
  eye: vec4f,
  // The board clip (V2a): the board body's top face, top-down, in board
  // millimetres. clipOn is 0 for the board body itself and when there is none.
  clipOrigin: vec2f,
  clipPitch: vec2f,
  clipSize: vec2u,
  clipOn: u32,
  clipPad: u32,
};
@group(0) @binding(0) var<uniform> globals: Globals;
@group(0) @binding(1) var<uniform> slice: Slice;
@group(0) @binding(2) var<storage, read> shapes: array<u32>;
@group(0) @binding(3) var<storage, read> covers: array<u32>;
@group(0) @binding(4) var<storage, read> values: array<f32>;
@group(0) @binding(5) var field: texture_2d<f32>;
@group(0) @binding(6) var<storage, read> nets: array<u32>;
@group(0) @binding(7) var<storage, read> netMask: array<u32>;
@group(0) @binding(8) var<storage, read> edges: array<u32>;
// Per add shape a (first, count) range of hole records, then the records.
@group(0) @binding(9) var<storage, read> cuts: array<u32>;
@group(0) @binding(11) var boardClip: texture_2d<u32>;

// KiCad's 3D view draws nothing beyond the board's outline: copper, mask,
// paste or silkscreen there (text off the edge, a fab table) is discarded. A
// texel next to the board counts as board, so edge and drill features stay.
fn outsideBoard(board: vec2f) -> bool {
  if (slice.clipOn == 0u) { return false; }
  let cell = vec2i(floor((board - slice.clipOrigin) / slice.clipPitch));
  let size = vec2i(slice.clipSize);
  for (var dy = -1; dy <= 1; dy++) {
    for (var dx = -1; dx <= 1; dx++) {
      let at = cell + vec2i(dx, dy);
      if (all(at >= vec2i(0)) && all(at < size) && textureLoad(boardClip, at, 0).x != 0u) { return false; }
    }
  }
  return true;
}
fn worldOutsideBoard(world: vec3f) -> bool { return outsideBoard(vec2f(world.x * 1000.0, -world.y * 1000.0)); }

const SHAPE_WORDS = 20u;
const COVER_WORDS = 6u;
const EDGE_WORDS = 7u;
const EDGE_SKIRT = 1073741824u;
const PICK_TAG = ${2147483648}u;
const TAU = 6.283185307179586;

const ABSENT = 3e38;
fn present(value: f32) -> bool { return value < 1e38; }
fn word(record: u32, index: u32) -> u32 { return shapes[record * SHAPE_WORDS + index]; }
fn fword(record: u32, index: u32) -> f32 { return bitcast<f32>(word(record, index)); }
fn coverWord(record: u32, index: u32) -> u32 { return covers[record * COVER_WORDS + index]; }

// Two triangles over the unit square.
fn corner(index: u32) -> vec2f {
  var corners = array<vec2f, 6>(vec2f(0.0, 0.0), vec2f(1.0, 0.0), vec2f(0.0, 1.0),
    vec2f(0.0, 1.0), vec2f(1.0, 0.0), vec2f(1.0, 1.0));
  return corners[index];
}

// Board millimetres (KiCad frame, Y down) to clip space; the viewer's world
// is metres with Y up.
fn clip(board: vec2f) -> vec4f {
  return globals.viewProjection * vec4f(board.x * 0.001, -board.y * 0.001, slice.z, 1.0);
}

fn sdBox(p: vec2f, half: vec2f) -> f32 {
  let d = abs(p) - half;
  return length(max(d, vec2f(0.0))) + min(max(d.x, d.y), 0.0);
}

fn sdSegment(p: vec2f, a: vec2f, b: vec2f) -> f32 {
  let pa = p - a;
  let ba = b - a;
  let h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-12), 0.0, 1.0);
  return length(pa - ba * h);
}

fn sdFlatSegment(p: vec2f, a: vec2f, b: vec2f, half: f32) -> f32 {
  let span = b - a;
  let len = length(span);
  let along = span / max(len, 1e-12);
  let q = p - (a + b) * 0.5;
  return sdBox(vec2f(dot(q, along), dot(q, vec2f(-along.y, along.x))), vec2f(len * 0.5, half));
}

// KiCad pad corners: top left 1, top right 2, bottom left 4, bottom right 8 (Y down).
fn sdPadBox(p: vec2f, half: vec2f, radius: f32, chamfer: f32, corners: u32) -> f32 {
  let left = p.x < 0.0;
  let top = p.y < 0.0;
  let bit = select(select(8u, 4u, left), select(2u, 1u, left), top);
  let a = abs(p);
  if ((corners & bit) != 0u && chamfer > 0.0) {
    let cut = (a.x + a.y - (half.x + half.y - chamfer)) * 0.7071067811865476;
    return max(sdBox(p, half), cut);
  }
  let r = min(radius, min(half.x, half.y));
  let d = a - half + vec2f(r);
  return length(max(d, vec2f(0.0))) + min(max(d.x, d.y), 0.0) - r;
}

fn sdQuad(p: vec2f, v: array<vec2f, 4>) -> f32 {
  var d = dot(p - v[0], p - v[0]);
  var s = 1.0;
  for (var i = 0u; i < 4u; i = i + 1u) {
    let j = (i + 3u) % 4u;
    let e = v[j] - v[i];
    let w = p - v[i];
    let b = w - e * clamp(dot(w, e) / dot(e, e), 0.0, 1.0);
    d = min(d, dot(b, b));
    let c = vec3<bool>((p.y >= v[i].y), (p.y < v[j].y), (e.x * w.y > e.y * w.x));
    if (all(c) || all(!c)) { s = -s; }
  }
  return s * sqrt(d);
}

fn sdArc(p: vec2f, center: vec2f, radius: f32, start: f32, sweep: f32, half: f32) -> f32 {
  let q = p - center;
  let angle = atan2(q.y, q.x);
  var t = select(start - angle, angle - start, sweep >= 0.0);
  t = t - TAU * floor(t / TAU);
  if (t <= abs(sweep)) {
    return abs(length(q) - radius) - half;
  }
  let a = center + radius * vec2f(cos(start), sin(start));
  let b = center + radius * vec2f(cos(start + sweep), sin(start + sweep));
  return min(length(p - a), length(p - b)) - half;
}

fn shapeDistance(r: u32, p: vec2f) -> f32 {
  let kind = word(r, 0u);
  let a = vec2f(fword(r, 14u), fword(r, 15u));
  let b = vec2f(fword(r, 16u), fword(r, 17u));
  let c = fword(r, 18u);
  let d = fword(r, 19u);
  var distance = 1e30;
  switch kind {
    case 1u: {
      let length_ = length(p - a);
      distance = length_ - b.x;
      if (b.y > 0.0) { distance = max(distance, b.y - length_); }
    }
    case 2u: {
      distance = sdPadBox(p - a, b, c, d, (word(r, 2u) >> 8u) & 15u);
    }
    case 3u: {
      let q = p - a;
      let v = array<vec2f, 4>(
        vec2f(-b.x + d, -b.y - c), vec2f(b.x - d, -b.y + c),
        vec2f(b.x + d, b.y - c), vec2f(-b.x - d, b.y + c));
      distance = sdQuad(q, v);
    }
    case 4u: { distance = sdSegment(p, a, b) - c; }
    case 5u: { distance = sdFlatSegment(p, a, b, c); }
    case 6u: { distance = sdArc(p, a, b.x, b.y, c, d); }
    default: {}
  }
  return distance - fword(r, 3u);
}

${Ji(10)}
fn normalized(value: f32) -> f32 {
  let span = slice.range.y - slice.range.x;
  return select(0.5, (value - slice.range.x) / span, abs(span) > 1e-30);
}

fn fieldAt(texel: vec2i) -> f32 {
  let size = vec2i(slice.fieldSize);
  if (any(texel < vec2i(0)) || any(texel >= size)) { return ABSENT; }
  return textureLoad(field, texel, 0).r;
}

// Bilinear inside the raster; nearest where a neighbour holds no value.
fn sampleField(board: vec2f) -> f32 {
  let uv = (board - slice.fieldOrigin) / slice.fieldPitch - vec2f(0.5);
  let base = vec2i(floor(uv));
  let f = fract(uv);
  let s00 = fieldAt(base);
  let s10 = fieldAt(base + vec2i(1, 0));
  let s01 = fieldAt(base + vec2i(0, 1));
  let s11 = fieldAt(base + vec2i(1, 1));
  if (present(s00) && present(s10) && present(s01) && present(s11)) {
    return mix(mix(s00, s10, f.x), mix(s01, s11, f.x), f.y);
  }
  return fieldAt(vec2i(floor(uv + vec2f(0.5))));
}

fn aces(color: vec3f) -> vec3f {
  return clamp((color * (2.51 * color + 0.03)) / (color * (2.43 * color + 0.59) + 0.14), vec3f(0.0), vec3f(1.0));
}

fn netOf(operation: u32) -> u32 {
  return select(0u, nets[operation], operation < arrayLength(&nets));
}
// A net is lit when it is the active one or emphasised (the mesh's rule).
fn netLit(net: u32) -> bool {
  let emphasised = net != 0u && net < arrayLength(&netMask) && netMask[net] != 0u;
  return emphasised || (globals.activeNet != 0u && net == globals.activeNet);
}
fn copperSlice() -> bool { return (slice.netMode & 2u) != 0u; }
// Whether this operation's copper is hidden because its net is not lit.
fn netHidden(operation: u32) -> bool {
  return copperSlice() && (slice.netMode & 1u) != 0u && !netLit(netOf(operation));
}

fn faceNormal() -> vec3f { return vec3f(0.0, 0.0, slice.material.z); }

fn shade(operation: u32, board: vec2f) -> vec4f {
  return shadeNormal(operation, board, faceNormal());
}

// As \`shade\`, for a surface of world normal \`normal\` (a slab's side wall).
fn shadeNormal(operation: u32, board: vec2f, normal: vec3f) -> vec4f {
  // A result overlay outranks the lit-net glow: an isolated net shows its values.
  if (slice.overlay == 1u) {
    let value = values[operation];
    if (present(value)) { return vec4f(fieldColor(normalized(value)), 1.0); }
  } else if (slice.overlay == 2u && slice.fieldOn == 1u) {
    let value = sampleField(board);
    if (present(value)) { return vec4f(fieldColor(normalized(value)), 1.0); }
  }
  if (copperSlice() && netLit(netOf(operation))) {
    // A lit net glows, pulsing, as the mesh copper does.
    let pulse = 0.88 + 0.12 * sin(globals.time * 3.2);
    return vec4f(aces(lightNormal(vec3f(0.08, 1.0, 0.2) * pulse, normal)), 1.0);
  }
  return vec4f(aces(litNormal(slice.color.rgb, normal)), slice.color.a);
}

// The base copper lighting (renderer.js) for a flat face of normal (0, 0, z),
// so analytic copper reads exactly as the mesh copper it replaces.
fn lit(base: vec3f) -> vec3f {
  return litNormal(base, faceNormal());
}

fn litNormal(base: vec3f, normal: vec3f) -> vec3f {
  var tinted = base;
  // Copper (material.w = 1) dims while a net is lit, as the mesh copper does.
  if (globals.hasHighlight > 0.5 && slice.material.w > 0.5) { tinted = mix(base, vec3f(0.12, 0.14, 0.17), 0.58); }
  return lightNormal(tinted, normal);
}

// The copper lighting for world normal \`normal\`. A layer facing down (its
// material.z -1) is lit from below, as the mesh lights its bottom faces.
fn lightNormal(tinted: vec3f, normal: vec3f) -> vec3f {
  let up = slice.material.z;
  let side = vec3f(1.0, 1.0, up);
  let light = normalize(globals.lightDirection.xyz * side);
  let diffuse = max(dot(normal, light), 0.0);
  let hemi = 0.62;
  let roughness = clamp(slice.material.y, 0.05, 1.0);
  let metallic = clamp(slice.material.x, 0.0, 1.0);
  let specular = pow(max(dot(normal, normalize(light + vec3f(0.3, -0.4, 0.85) * side)), 0.0), mix(96.0, 6.0, roughness));
  return tinted * (hemi + diffuse * 0.72) + mix(vec3f(0.04), tinted, metallic) * specular * 0.5;
}

struct ShapeOut {
  @builtin(position) position: vec4f,
  @location(0) local: vec2f,
  @location(1) board: vec2f,
  @location(2) @interpolate(flat) record: u32,
};

@vertex fn vs_shape(@builtin(vertex_index) vertex: u32, @builtin(instance_index) record: u32) -> ShapeOut {
  let lo = vec2f(fword(record, 10u), fword(record, 11u));
  let hi = vec2f(fword(record, 12u), fword(record, 13u));
  let local = mix(lo, hi, corner(vertex));
  let linear = mat2x2f(fword(record, 4u), fword(record, 6u), fword(record, 5u), fword(record, 7u));
  let board = linear * local + vec2f(fword(record, 8u), fword(record, 9u));
  var out: ShapeOut;
  out.position = clip(board);
  out.local = local;
  out.board = board;
  out.record = record;
  return out;
}

// Samples per pixel of the colour pass (1 or 4).
override SAMPLES: u32 = 1u;

// The samples of this pixel inside the shape: the shape at each of WebGPU's
// standard 4x sample positions (offsets from the pixel's centre), so its
// edges anti-alias with exact coverage. Stencil and depth follow the same
// samples. A pixel clear of the edge is all in or all out.
fn coverage(record: u32, local: vec2f) -> u32 {
  let dx = dpdx(local);
  let dy = dpdy(local);
  let centre = shapeDistance(record, local) - slice.dilate;
  if (SAMPLES == 1u) { return select(1u, 0u, centre > 0.0); }
  let all = (1u << SAMPLES) - 1u;
  if (abs(centre) > length(dx) + length(dy)) { return select(all, 0u, centre > 0.0); }
  var offsets = array<vec2f, 4>(vec2f(-0.125, -0.375), vec2f(0.375, -0.125), vec2f(-0.375, 0.125), vec2f(0.125, 0.375));
  var mask = 0u;
  for (var i = 0u; i < 4u; i += 1u) {
    if (shapeDistance(record, local + dx * offsets[i].x + dy * offsets[i].y) - slice.dilate <= 0.0) { mask |= 1u << i; }
  }
  return mask;
}

struct Covered {
  @location(0) color: vec4f,
  @builtin(sample_mask) mask: u32,
};

@fragment fn fs_shape(input: ShapeOut) -> Covered {
  let mask = coverage(input.record, input.local);
  if (mask == 0u || netHidden(word(input.record, 1u)) || outsideBoard(input.board)) { discard; }
  return Covered(shade(word(input.record, 1u), input.board), mask);
}

@fragment fn fs_shape_pick(input: ShapeOut) -> @location(0) vec4u {
  if (shapeDistance(input.record, input.local) > 0.0 || netHidden(word(input.record, 1u)) || outsideBoard(input.board)) { discard; }
  return vec4u(PICK_TAG, word(input.record, 1u) + 1u, 0u, 0u);
}

@fragment fn fs_shape_mask(input: ShapeOut) -> Covered {
  let mask = coverage(input.record, input.local);
  if (mask == 0u || outsideBoard(input.board)) { discard; }
  return Covered(vec4f(0.0), mask);
}

@fragment fn fs_shape_mask_pick(input: ShapeOut) -> @location(0) vec4u {
  if (shapeDistance(input.record, input.local) > 0.0) { discard; }
  return vec4u(0u);
}

struct PlainOut {
  @builtin(position) position: vec4f,
};

@vertex fn vs_fan(@location(0) board: vec2f) -> PlainOut {
  var out: PlainOut;
  out.position = clip(board);
  return out;
}

@vertex fn vs_clear(@builtin(vertex_index) vertex: u32) -> PlainOut {
  var out: PlainOut;
  out.position = clip(mix(slice.clearBounds.xy, slice.clearBounds.zw, corner(vertex)));
  return out;
}

@fragment fn fs_plain_mask() -> @location(0) vec4f { return vec4f(0.0); }

// Solder mask, coloured over the slice where it was laid down (stencil bit
// 5): plain, or lighter over outer copper (bit 0), as the mesh mask reads.
@fragment fn fs_tint_plain() -> @location(0) vec4f {
  return vec4f(aces(lit(slice.color.rgb)), slice.color.a);
}
@fragment fn fs_tint_covered() -> @location(0) vec4f {
  let base = min(slice.color.rgb * 1.6 + vec3f(0.03, 0.05, 0.02), vec3f(1.0));
  return vec4f(aces(lit(base)), min(1.0, slice.color.a * 1.2));
}
@fragment fn fs_plain_mask_pick() -> @location(0) vec4u { return vec4u(0u); }

struct CoverOut {
  @builtin(position) position: vec4f,
  @location(0) board: vec2f,
  @location(1) @interpolate(flat) operation: u32,
};

@vertex fn vs_cover(@builtin(vertex_index) vertex: u32, @builtin(instance_index) record: u32) -> CoverOut {
  let lo = vec2f(bitcast<f32>(coverWord(record, 2u)), bitcast<f32>(coverWord(record, 3u)));
  let hi = vec2f(bitcast<f32>(coverWord(record, 4u)), bitcast<f32>(coverWord(record, 5u)));
  let board = mix(lo, hi, corner(vertex));
  var out: CoverOut;
  out.position = clip(board);
  out.board = board;
  out.operation = coverWord(record, 0u);
  return out;
}

@fragment fn fs_cover(input: CoverOut) -> @location(0) vec4f {
  if (netHidden(input.operation) || outsideBoard(input.board)) { discard; }
  return shade(input.operation, input.board);
}

// A cover's stencil-only pass for the board layers (mask, paste, silkscreen),
// clipped to the board as their colour passes are; the stencil clears use fs_plain_mask.
@fragment fn fs_cover_mask(input: CoverOut) -> @location(0) vec4f {
  if (outsideBoard(input.board)) { discard; }
  return vec4f(0.0);
}

@fragment fn fs_cover_pick(input: CoverOut) -> @location(0) vec4u {
  if (netHidden(input.operation) || outsideBoard(input.board)) { discard; }
  return vec4u(PICK_TAG, input.operation + 1u, 0u, 0u);
}

// Side walls of a slab (copper of its stackup thickness), from wall edges
// extruded through it. A region's walls are its contour edges. A shape's
// wall is exact: its edges are a skirt just outside its outline (the
// lowering's outline polygon), and each sample's view ray, entering the
// skirt, marches on to the shape's true outline by its distance, keeping
// that hit with its depth. Only the thin band along outlines is shaded.

fn shapeLinear(record: u32) -> mat2x2f {
  return mat2x2f(fword(record, 4u), fword(record, 6u), fword(record, 5u), fword(record, 7u));
}

fn boardToWorld(board: vec2f, z: f32) -> vec3f { return vec3f(board.x * 0.001, -board.y * 0.001, z); }

// The unit view ray through a world point, from the eye.
fn viewDirection(world: vec3f) -> vec3f {
  var direction = slice.eye.xyz;
  if (abs(slice.eye.w) > 1e-12) { direction = world - slice.eye.xyz / slice.eye.w; }
  return normalize(direction);
}

struct WallHit {
  hit: bool,
  board: vec2f,
  z: f32,
  normal: vec3f,
};

// The view ray through \`world\` (a point on the shape's skirt, where the ray
// enters it) within the slab, in the shape's local frame: board millimetres,
// s millimetres along the ray from \`world\` on to where it leaves the slab.
struct WallRay {
  ok: bool,
  at: vec3f,
  dir: vec3f,
  local0: vec2f,
  localDir: vec2f,
  speed: f32,
  s0: f32,
  s1: f32,
};

fn wallRay(record: u32, world: vec3f) -> WallRay {
  return wallRayFrom(record, world, false);
}

// As \`wallRay\`, or when \`whole\` over the ray's whole run through the slab
// (a mask's step: the point is only where the ray met the step's trigger).
fn wallRayFrom(record: u32, world: vec3f, whole: bool) -> WallRay {
  var ray: WallRay;
  ray.ok = false;
  let linear = shapeLinear(record);
  let inverse = mat2x2f(linear[1][1], -linear[0][1], -linear[1][0], linear[0][0]) * (1.0 / determinant(linear));
  let d3 = viewDirection(world);
  // Millimetres throughout: board (y down) in xy, height in z.
  ray.dir = vec3f(d3.x, -d3.y, d3.z);
  ray.at = vec3f(world.x * 1000.0, -world.y * 1000.0, world.z * 1000.0);
  // Walls stop a hair inside the slab, so where one meets a face (a track's
  // wall inside a pour) the face always wins the depth test.
  let inset = (slice.slab.y - slice.slab.x) * 1000.0 * WALL_INSET;
  var zb = slice.slab.x * 1000.0 + inset;
  var zt = slice.slab.y * 1000.0 - inset;
  // A step reaches a hair past the mask's outer face instead, so no seam
  // opens between it and the mask over copper.
  if (whole) {
    if (slice.material.z < 0.0) { zb -= 2.0 * inset; } else { zt += 2.0 * inset; }
  }
  ray.s0 = -1e9;
  ray.s1 = 1e9;
  if (abs(ray.dir.z) > 1e-9) {
    let a = (zb - ray.at.z) / ray.dir.z;
    let b = (zt - ray.at.z) / ray.dir.z;
    ray.s0 = min(a, b);
    ray.s1 = max(a, b);
  } else if (ray.at.z < zb || ray.at.z > zt) {
    return ray;
  }
  let reach = length(vec2f(fword(record, 12u), fword(record, 13u)) - vec2f(fword(record, 10u), fword(record, 11u))) + 1.0;
  ray.s0 = max(ray.s0, select(0.0, -reach * 4.0, whole));
  ray.s1 = min(ray.s1, reach * 4.0);
  ray.local0 = inverse * (ray.at.xy - vec2f(fword(record, 8u), fword(record, 9u)));
  ray.localDir = inverse * ray.dir.xy;
  ray.speed = length(ray.localDir);
  ray.ok = ray.s0 < ray.s1;
  return ray;
}

// The ray against the shape's side walls, marched by the shape's distance
// (a bound on how far the ray can go without meeting its outline).
fn marchWall(record: u32, ray: WallRay) -> WallHit {
  var result: WallHit;
  result.hit = false;
  if (!ray.ok || ray.speed < 1e-7) { return result; }
  var s = ray.s0;
  // A dilated shape (a mask step) is its outline grown by \`slice.dilate\`.
  var distance = shapeDistance(record, ray.local0 + ray.localDir * s) - slice.dilate;
  // Starting inside the shape: the ray came through a face, not a wall.
  if (distance <= 0.0) { return result; }
  for (var i = 0u; i < 48u; i += 1u) {
    s += distance / ray.speed;
    if (s > ray.s1) { return result; }
    distance = shapeDistance(record, ray.local0 + ray.localDir * s) - slice.dilate;
    if (distance < 1e-4) { break; }
  }
  if (distance >= 1e-4) { return result; }
  let local = ray.local0 + ray.localDir * s;
  let board = ray.at.xy + ray.dir.xy * s;
  let add = (record - slice.subtracts) * 2u;
  if (inHole(cuts[add], cuts[add + 1u], board)) { return result; }
  let e = 1e-3;
  let gradient = vec2f(
    shapeDistance(record, local + vec2f(e, 0.0)) - shapeDistance(record, local - vec2f(e, 0.0)),
    shapeDistance(record, local + vec2f(0.0, e)) - shapeDistance(record, local - vec2f(0.0, e)));
  let normalBoard = normalize(shapeLinear(record) * gradient);
  result.hit = true;
  result.board = board;
  result.z = (ray.at.z + ray.dir.z * s) * 0.001;
  result.normal = vec3f(normalBoard.x, -normalBoard.y, 0.0);
  return result;
}

const WALL_INSET = 0.02;

// Whether a board point lies in one of the holes \`cuts[first..first + count]\`
// names: there the slab is drilled away, its walls with it.
fn inHole(first: u32, count: u32, board: vec2f) -> bool {
  for (var i = 0u; i < count; i += 1u) {
    let hole = cuts[first + i];
    let linear = shapeLinear(hole);
    let inverse = mat2x2f(linear[1][1], -linear[0][1], -linear[1][0], linear[0][0]) * (1.0 / determinant(linear));
    if (shapeDistance(hole, inverse * (board - vec2f(fword(hole, 8u), fword(hole, 9u)))) < 0.0) { return true; }
  }
  return false;
}

fn worldDepth(world: vec3f) -> f32 {
  let clipped = globals.viewProjection * vec4f(world, 1.0);
  return clipped.z / clipped.w;
}

struct WallColor {
  @location(0) color: vec4f,
  @builtin(frag_depth) depth: f32,
};
struct WallPick {
  @location(0) pick: vec4u,
  @builtin(frag_depth) depth: f32,
};

fn edgeEnd(edge: u32, end: u32) -> vec2f {
  let base = edge * EDGE_WORDS + end * 2u;
  return vec2f(bitcast<f32>(edges[base]), bitcast<f32>(edges[base + 1u]));
}

// An edge's outward normal in the world: edges run with their material on
// the left (as the lowering writes them), and board y is the world's -y.
fn edgeOutward(edge: u32) -> vec3f {
  let along = edgeEnd(edge, 1u) - edgeEnd(edge, 0u);
  return normalize(vec3f(along.y, along.x, 0.0));
}

// An edge's wall quad, inset a hair from the slab's faces; or nothing when
// the wall faces away from the eye (only its outward side shows: the
// material, or for a skirt the rest of the shape's wall, lies behind it).
fn wallCorner(vertex: u32, edge: u32) -> vec3f {
  let c = corner(vertex);
  let board = mix(edgeEnd(edge, 0u), edgeEnd(edge, 1u), c.x);
  let inset = (slice.slab.y - slice.slab.x) * WALL_INSET;
  return boardToWorld(board, mix(slice.slab.x + inset, slice.slab.y - inset, c.y));
}

fn facesEye(edge: u32) -> bool {
  let middle = boardToWorld(0.5 * (edgeEnd(edge, 0u) + edgeEnd(edge, 1u)), 0.5 * (slice.slab.x + slice.slab.y));
  return dot(edgeOutward(edge), viewDirection(middle)) < 0.0;
}

// Off the clip volume: a culled wall's quad draws nothing.
const CULLED = vec4f(0.0, 0.0, 2.0, 1.0);

struct EdgeOut {
  @builtin(position) position: vec4f,
  @location(0) world: vec3f,
  @location(1) @interpolate(flat) edge: u32,
};

@vertex fn vs_region_wall(@builtin(vertex_index) vertex: u32, @builtin(instance_index) edge: u32) -> EdgeOut {
  let world = wallCorner(vertex, edge);
  var out: EdgeOut;
  out.position = select(CULLED, globals.viewProjection * vec4f(world, 1.0), facesEye(edge));
  out.world = world;
  out.edge = edge;
  return out;
}

fn edgeCut(edge: u32, world: vec3f) -> bool {
  let base = edge * EDGE_WORDS;
  return inHole(edges[base + 5u], edges[base + 6u], vec2f(world.x * 1000.0, -world.y * 1000.0));
}

// A region's wall is its edge's own quad: shaded once per pixel, at its
// own depth.
@fragment fn fs_region_wall(input: EdgeOut) -> @location(0) vec4f {
  let operation = edges[input.edge * EDGE_WORDS + 4u];
  if (netHidden(operation) || edgeCut(input.edge, input.world) || worldOutsideBoard(input.world)) { discard; }
  let board = vec2f(input.world.x * 1000.0, -input.world.y * 1000.0);
  return shadeNormal(operation, board, edgeOutward(input.edge));
}

@fragment fn fs_region_wall_pick(input: EdgeOut) -> @location(0) vec4u {
  let operation = edges[input.edge * EDGE_WORDS + 4u];
  if (netHidden(operation) || edgeCut(input.edge, input.world) || worldOutsideBoard(input.world)) { discard; }
  return vec4u(PICK_TAG, operation + 1u, 0u, 0u);
}

struct SkirtOut {
  @builtin(position) position: vec4f,
  // Shaded once per pixel: the skirt spans the wall's height, so its own
  // coverage anti-aliases the wall's top and bottom edges, and the inset
  // keeps the face in front where the two meet.
  @location(0) world: vec3f,
  @location(1) @interpolate(flat) record: u32,
};

// How far in from its skirt a shape's ring reaches, millimetres: past the
// outline's least tolerance (kicad_monkey's OUTLINE_TOLERANCE_MM, 4 um).
const RING_MM = 0.01;

// A skirt edge draws two quads (twelve vertices): the skirt itself, and a
// ring on the slab face toward the eye, reaching in over the gap between
// skirt and outline. A ray through that gap meets the wall without crossing
// the skirt (steep views), so the ring starts its march instead.
fn skirtCorner(vertex: u32, edge: u32) -> vec3f {
  if (vertex < 6u) { return wallCorner(vertex, edge); }
  let c = corner(vertex - 6u);
  let a = edgeEnd(edge, 0u);
  let b = edgeEnd(edge, 1u);
  let along = normalize(b - a);
  // The material lies on the edge's left.
  let inward = vec2f(-along.y, along.x) * RING_MM * c.y;
  let board = mix(a, b, c.x) + inward;
  let inset = (slice.slab.y - slice.slab.x) * WALL_INSET;
  let middle = 0.5 * (slice.slab.x + slice.slab.y);
  // A perspective eye is a point; an orthographic one the view direction.
  var above = (slice.eye.z < 0.0);
  if (abs(slice.eye.w) > 1e-12) { above = (slice.eye.z / slice.eye.w > middle); }
  return boardToWorld(board, select(slice.slab.x + inset, slice.slab.y - inset, above));
}

@vertex fn vs_skirt(@builtin(vertex_index) vertex: u32, @builtin(instance_index) edge: u32) -> SkirtOut {
  let world = skirtCorner(vertex, edge);
  var out: SkirtOut;
  out.position = select(CULLED, globals.viewProjection * vec4f(world, 1.0), facesEye(edge));
  out.world = world;
  out.record = slice.subtracts + (edges[edge * EDGE_WORDS + 4u] & ~EDGE_SKIRT);
  return out;
}

// A shape's wall: the ray entering its skirt marches on to its outline.
@fragment fn fs_skirt(input: SkirtOut) -> WallColor {
  let operation = word(input.record, 1u);
  if (netHidden(operation) || worldOutsideBoard(input.world)) { discard; }
  let hit = marchWall(input.record, wallRay(input.record, input.world));
  if (!hit.hit) { discard; }
  var out: WallColor;
  out.color = shadeNormal(operation, hit.board, hit.normal);
  out.depth = worldDepth(boardToWorld(hit.board, hit.z));
  return out;
}

// The conformal mask's step: where the mask rises from laminate onto copper,
// a face just off the copper's outline (by slice.dilate), from the laminate
// to the mask's outer face (the foot twin's slab), opaque (a coat seen edge
// on), and only outside the mask's openings (the foot twin's cuts list
// those). A shape's step is found by marching its distance less the
// clearance over the ray's run through the slab, triggered by its skirt and
// by a ring on the inner face reaching out past the step; a region's step
// is its edges pushed out.
fn coatColor(normal: vec3f) -> vec4f {
  let base = min(slice.color.rgb * 1.6 + vec3f(0.03, 0.05, 0.02), vec3f(1.0));
  return vec4f(aces(litNormal(base, normal)), 1.0);
}

// The face the mask lies on over laminate: the slab's inner one.
fn innerFace() -> f32 {
  let inset = (slice.slab.y - slice.slab.x) * WALL_INSET;
  return select(slice.slab.x + inset, slice.slab.y - inset, slice.material.z < 0.0);
}

fn stepCorner(vertex: u32, edge: u32) -> vec3f {
  if (vertex < 6u) { return wallCorner(vertex, edge); }
  let c = corner(vertex - 6u);
  let a = edgeEnd(edge, 0u);
  let b = edgeEnd(edge, 1u);
  let along = normalize(b - a);
  // Out from the material (on the edge's left), past the step.
  let outward = vec2f(along.y, -along.x) * (slice.dilate + RING_MM) * c.y;
  return boardToWorld(mix(a, b, c.x) + outward, innerFace());
}

// A step's quads reach a hair past the mask's outer face (see wallRayFrom).
fn stepReach(world: vec3f) -> vec3f {
  let inset = (slice.slab.y - slice.slab.x) * WALL_INSET;
  let outer = select(slice.slab.y - inset, slice.slab.x + inset, slice.material.z < 0.0);
  let past = select(slice.slab.y + inset, slice.slab.x - inset, slice.material.z < 0.0);
  return select(world, vec3f(world.xy, past), abs(world.z - outer) < inset * 0.5);
}

@vertex fn vs_step(@builtin(vertex_index) vertex: u32, @builtin(instance_index) edge: u32) -> SkirtOut {
  let world = stepReach(stepCorner(vertex, edge));
  var out: SkirtOut;
  out.position = select(CULLED, globals.viewProjection * vec4f(world, 1.0), facesEye(edge));
  out.world = world;
  out.record = slice.subtracts + (edges[edge * EDGE_WORDS + 4u] & ~EDGE_SKIRT);
  return out;
}

@fragment fn fs_step(input: SkirtOut) -> WallColor {
  if (worldOutsideBoard(input.world)) { discard; }
  let hit = marchWall(input.record, wallRayFrom(input.record, input.world, true));
  if (!hit.hit) { discard; }
  var out: WallColor;
  out.color = coatColor(hit.normal);
  out.depth = worldDepth(boardToWorld(hit.board, hit.z));
  return out;
}

@vertex fn vs_region_step(@builtin(vertex_index) vertex: u32, @builtin(instance_index) edge: u32) -> EdgeOut {
  var world = stepReach(wallCorner(vertex, edge));
  let along = normalize(edgeEnd(edge, 1u) - edgeEnd(edge, 0u));
  // Out from the material by the step's clearance (board y down is the
  // world's -y), as a shape's step is by its distance.
  world += vec3f(along.y, along.x, 0.0) * slice.dilate * 0.001;
  var out: EdgeOut;
  out.position = select(CULLED, globals.viewProjection * vec4f(world, 1.0), facesEye(edge));
  out.world = world;
  out.edge = edge;
  return out;
}

@fragment fn fs_region_step(input: EdgeOut) -> @location(0) vec4f {
  if (edgeCut(input.edge, input.world) || worldOutsideBoard(input.world)) { discard; }
  return coatColor(edgeOutward(input.edge));
}

@fragment fn fs_skirt_pick(input: SkirtOut) -> WallPick {
  let operation = word(input.record, 1u);
  if (netHidden(operation) || worldOutsideBoard(input.world)) { discard; }
  let hit = marchWall(input.record, wallRay(input.record, input.world));
  if (!hit.hit) { discard; }
  var out: WallPick;
  out.pick = vec4u(PICK_TAG, operation + 1u, 0u, 0u);
  out.depth = worldDepth(boardToWorld(hit.board, hit.z));
  return out;
}
`,xx={compare:"always",passOp:"keep"},Ds=Object.freeze({shapeMask:{face:{compare:"always",passOp:"replace"},read:255,write:128,reference:128,color:!1,depth:!1},fan:{face:{compare:"always",passOp:"invert"},read:255,write:64,reference:0,color:!1,depth:!1},coverSubtract:{face:{compare:"not-equal",passOp:"replace",failOp:"keep"},read:64,write:192,reference:128,color:!1,depth:!1},shapeAdd:{face:{compare:"greater",passOp:"replace"},read:160,write:33,reference:32,color:!0,depth:!0},coverMark:{face:{compare:"equal",passOp:"replace",failOp:"keep"},read:192,write:1,reference:65,color:!1,depth:!1,depthTest:!0},coverAdd:{face:{compare:"equal",passOp:"invert",failOp:"keep",depthFailOp:"keep"},read:224,write:96,reference:64,color:!0,depth:!0},coverClear:{face:{compare:"always",passOp:"zero"},read:255,write:64,reference:0,color:!1,depth:!1},shapeLay:{face:{compare:"greater",passOp:"replace"},read:160,write:32,reference:32,color:!1,depth:!1,depthTest:!0},coverLay:{face:{compare:"equal",passOp:"invert",failOp:"keep",depthFailOp:"keep"},read:224,write:96,reference:64,color:!1,depth:!1,depthTest:!0},shapeBlend:{face:{compare:"greater",passOp:"replace"},read:160,write:32,reference:32,color:!0,depth:!0},coverBlend:{face:{compare:"equal",passOp:"invert",failOp:"keep",depthFailOp:"keep"},read:224,write:96,reference:64,color:!0,depth:!0},tintCovered:{face:{compare:"equal",passOp:"keep"},read:33,write:0,reference:33,color:!0,depth:!0},tintPlain:{face:{compare:"equal",passOp:"keep"},read:33,write:0,reference:32,color:!0,depth:!0},footShape:{face:{compare:"always",passOp:"replace"},read:0,write:2,reference:2,color:!1,depth:!1},footCover:{face:{compare:"equal",passOp:"replace",failOp:"keep"},read:64,write:2,reference:66,color:!1,depth:!1},tintHigh:{face:{compare:"equal",passOp:"replace"},read:34,write:4,reference:38,color:!0,depth:!0},tintLow:{face:{compare:"equal",passOp:"replace"},read:34,write:4,reference:36,color:!0,depth:!0},clearLay:{face:{compare:"always",passOp:"zero"},read:0,write:224,reference:0,color:!1,depth:!1},shapeOnFoot:{face:{compare:"equal",passOp:"invert"},read:166,write:32,reference:6,color:!0,depth:!0},shapeOffFoot:{face:{compare:"equal",passOp:"invert"},read:166,write:32,reference:4,color:!0,depth:!0},coverOnFoot:{face:{compare:"equal",passOp:"invert",failOp:"keep",depthFailOp:"keep"},read:230,write:96,reference:70,color:!0,depth:!0},coverOffFoot:{face:{compare:"equal",passOp:"invert",failOp:"keep",depthFailOp:"keep"},read:230,write:96,reference:68,color:!0,depth:!0},clearFoot:{face:{compare:"always",passOp:"zero"},read:0,write:6,reference:0,color:!1,depth:!1},coat:{face:{compare:"equal",passOp:"keep",failOp:"keep",depthFailOp:"keep"},read:2,write:0,reference:0,color:!0,depth:!0},solid:{face:xx,read:0,write:0,reference:0,color:!0,depth:!0},clear:{face:{compare:"always",passOp:"zero"},read:255,write:224,reference:0,color:!1,depth:!1}});var Hd=64,Qi=112,qd=48,Wd=`
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
struct View {
  eye: vec4f,
  color: vec4f,
  wallColor: vec4f,
  overlay: u32,
  isolate: u32,
  // 1 while the board (substrate) is shown: bare drill walls belong to it.
  board: u32,
  padding2: u32,
  range: vec2f,
  padding3: vec2f,
  // The board's side walls (laminate, or plating on a plated edge).
  edgeColor: vec4f,
  // What covers or plugs a via from one side: the solder mask's colour.
  coverColor: vec4f,
};
struct Barrel {
  shape: vec4f,
  size: vec4f,
  // Operation, top layer, bottom layer, flags (BARREL_FLAGS).
  ids: vec4u,
  // A castellated hole's board edge: the board is where dot(xy, edge.xy) <= edge.z.
  edge: vec4f,
};
@group(0) @binding(0) var<uniform> globals: Globals;
@group(0) @binding(1) var<uniform> view: View;
@group(0) @binding(2) var<storage, read> barrels: array<Barrel>;
@group(0) @binding(3) var<storage, read> values: array<f32>;
@group(0) @binding(4) var<storage, read> layerOffsets: array<f32>;
@group(0) @binding(5) var<storage, read> nets: array<u32>;
@group(0) @binding(6) var<storage, read> netMask: array<u32>;

const PICK_TAG = ${2147483648}u;
const FAR = 1e30;
fn netLit(operation: u32) -> bool {
  let net = select(0u, nets[operation], operation < arrayLength(&nets));
  let emphasised = net != 0u && net < arrayLength(&netMask) && netMask[net] != 0u;
  return emphasised || (globals.activeNet != 0u && net == globals.activeNet);
}
fn present(value: f32) -> bool { return value < 1e38; }
${Ji(7)}
fn normalized(value: f32) -> f32 {
  let span = view.range.y - view.range.x;
  return select(0.5, (value - view.range.x) / span, abs(span) > 1e-30);
}

// The barrel's top and bottom z, with the layers' exploded offsets.
fn span(b: Barrel) -> vec2f {
  return vec2f(b.size.z + layerOffsets[b.ids.y], b.size.w + layerOffsets[b.ids.z]);
}
fn turn(v: vec2f, angle: f32) -> vec2f {
  let c = cos(angle);
  let s = sin(angle);
  return vec2f(v.x * c - v.y * s, v.x * s + v.y * c);
}

// Twelve triangles of the unit cube.
fn cubeCorner(vertex: u32) -> vec3f {
  var faces = array<u32, 36>(0u, 1u, 3u, 0u, 3u, 2u, 4u, 6u, 7u, 4u, 7u, 5u, 0u, 4u, 5u, 0u, 5u, 1u,
    2u, 3u, 7u, 2u, 7u, 6u, 0u, 2u, 6u, 0u, 6u, 4u, 1u, 5u, 7u, 1u, 7u, 3u);
  let corner = faces[vertex];
  return vec3f(f32(corner & 1u), f32((corner >> 1u) & 1u), f32((corner >> 2u) & 1u));
}

struct BarrelOut {
  @builtin(position) position: vec4f,
  // Per sample: each sample casts its own ray, so the tube's silhouette and
  // depth anti-alias exactly.
  @location(0) @interpolate(perspective, sample) world: vec3f,
  @location(1) @interpolate(flat) barrel: u32,
};

@vertex fn vs_barrel(@builtin(vertex_index) vertex: u32, @builtin(instance_index) index: u32) -> BarrelOut {
  let b = barrels[index];
  let corner = cubeCorner(vertex);
  // A little over the tube, so its silhouette never touches the box's edges.
  let half = vec2f(b.shape.z + b.size.x, b.size.x) * 1.01 + vec2f(1e-7);
  let z = span(b);
  let lift = 1e-7 * sign(z.x - z.y + 1e-12);
  let world = vec3f(
    b.shape.xy + turn((corner.xy * 2.0 - 1.0) * half, b.shape.w),
    mix(z.y - lift, z.x + lift, corner.z)
  );
  var out: BarrelOut;
  out.position = globals.viewProjection * vec4f(world, 1.0);
  out.world = world;
  out.barrel = index;
  return out;
}

// Where a ray (origin o, direction d, in the tube's frame) is inside the
// infinite prism over a stadium of half length \`half\` and radius r: the union
// of two disks and a rectangle, convex, so its hit is one interval.
fn prism(o: vec2f, d: vec2f, half: f32, r: f32) -> vec2f {
  let dd = dot(d, d);
  if (dd < 1e-24) {
    let q = vec2f(max(abs(o.x) - half, 0.0), o.y);
    return select(vec2f(FAR, -FAR), vec2f(-FAR, FAR), dot(q, q) <= r * r);
  }
  var lo = FAR;
  var hi = -FAR;
  for (var end = 0u; end < 2u; end += 1u) {
    let oc = o - vec2f(select(-half, half, end == 1u), 0.0);
    let b = dot(oc, d);
    let disc = b * b - dd * (dot(oc, oc) - r * r);
    if (disc >= 0.0) {
      let root = sqrt(disc);
      lo = min(lo, (-b - root) / dd);
      hi = max(hi, (-b + root) / dd);
    }
  }
  if (half > 0.0) {
    var enter = -FAR;
    var exit = FAR;
    let bounds = vec2f(half, r);
    for (var axis = 0u; axis < 2u; axis += 1u) {
      if (abs(d[axis]) < 1e-24) {
        if (abs(o[axis]) > bounds[axis]) { enter = FAR; exit = -FAR; }
      } else {
        let a = (-bounds[axis] - o[axis]) / d[axis];
        let c = (bounds[axis] - o[axis]) / d[axis];
        enter = max(enter, min(a, c));
        exit = min(exit, max(a, c));
      }
    }
    if (enter <= exit) {
      lo = min(lo, enter);
      hi = max(hi, exit);
    }
  }
  return vec2f(lo, hi);
}

// A point of the tube's frame (xy) in the world.
fn toWorld(b: Barrel, p: vec2f) -> vec2f {
  return b.shape.xy + turn(p, b.shape.w);
}

fn segmentDistance(p: vec2f, half: f32) -> f32 {
  return length(vec2f(p.x - clamp(p.x, -half, half), p.y));
}
fn outward(p: vec2f, half: f32) -> vec2f {
  return normalize(vec2f(p.x - clamp(p.x, -half, half), p.y) + vec2f(0.0, 1e-30));
}

const UNPLATED = 2u;
const COVERED_FRONT = 16u;
const COVERED_BACK = 32u;
const PLUGGED_FRONT = 64u;
const PLUGGED_BACK = 128u;
const FILLED = 256u;
const CAPPED = 512u;
// How far into the bore a plug's face lies, as a share of the barrel.
const PLUG_RECESS = 0.2;
// Via fill and plug resin: a cured epoxy's warm grey.
const RESIN = vec3f(0.46, 0.43, 0.36);

// What a ray meets: the plating, a cap's copper, resin, or a cover.
const MEETS_PLATING = 0u;
const MEETS_RESIN = 1u;
const MEETS_COVER = 2u;

struct Surface {
  t: f32,
  normal: vec3f,
  meets: u32,
};

// Whether a world point lies on the board's side of a castellated hole's edge.
fn onBoard(b: Barrel, world: vec2f) -> bool {
  return dot(world, b.edge.xy) <= b.edge.z;
}

// The nearest tube surface along the fragment's view ray, or t = FAR.
fn surface(input: BarrelOut) -> Surface {
  let b = barrels[input.barrel];
  var dir: vec3f;
  var near = -FAR;
  if (abs(view.eye.w) > 1e-12) {
    // From the camera through this point: the camera sits at t = -1.
    dir = input.world - view.eye.xyz / view.eye.w;
    near = -1.0 + 1e-6;
  } else {
    dir = view.eye.xyz;
  }
  // The tube's frame: centred, its long axis along x.
  let o = vec3f(turn(input.world.xy - b.shape.xy, -b.shape.w), input.world.z);
  let d = vec3f(turn(dir.xy, -b.shape.w), dir.z);
  let z = span(b);
  let top = max(z.x, z.y);
  let bottom = min(z.x, z.y);
  let half = b.shape.z;
  let outer = b.size.x;
  let inner = max(outer - b.size.y, outer * 0.5);
  var best = Surface(FAR, vec3f(0.0, 0.0, 1.0), MEETS_PLATING);
  let flags = b.ids.w;
  // A castellated hole is cut by the board's edge: only its board side stands.
  let walls = array<vec2f, 2>(prism(o.xy, d.xy, half, outer), prism(o.xy, d.xy, half, inner));
  // The outer wall where the ray enters it; the plating's inner wall where it leaves the bore.
  for (var wall = 0u; wall < 2u; wall += 1u) {
    let t = select(walls[0].x, walls[1].y, wall == 1u);
    let p = o + d * t;
    if (abs(t) < FAR && t > near && t < best.t && p.z <= top && p.z >= bottom && onBoard(b, toWorld(b, p.xy))) {
      let n = outward(p.xy, half) * select(1.0, -1.0, wall == 1u);
      best = Surface(t, vec3f(n, 0.0), MEETS_PLATING);
    }
  }
  if (abs(d.z) > 1e-24) {
    // The caps: the ring between the bore and the drill at each end.
    for (var end = 0u; end < 2u; end += 1u) {
      let plane = select(bottom, top, end == 1u);
      let t = (plane - o.z) / d.z;
      let p = o + d * t;
      let reach = segmentDistance(p.xy, half);
      if (t > near && t < best.t && reach <= outer && reach >= inner && onBoard(b, toWorld(b, p.xy))) {
        best = Surface(t, vec3f(0.0, 0.0, select(-1.0, 1.0, end == 1u)), MEETS_PLATING);
      }
    }
    // Across the bore (IPC-4761): a copper cap over a filled via, else
    // resin flush with each end when filled, or recessed from a plugged
    // side; a cover over the end of a covered side.
    let recess = (top - bottom) * PLUG_RECESS;
    for (var end = 0u; end < 2u; end += 1u) {
      let front = end == 1u;
      let covered = (flags & select(COVERED_BACK, COVERED_FRONT, front)) != 0u;
      let plugged = (flags & select(PLUGGED_BACK, PLUGGED_FRONT, front)) != 0u;
      let filled = (flags & FILLED) != 0u;
      let capped = (flags & CAPPED) != 0u;
      if (!(covered || plugged || filled || capped)) { continue; }
      let face = select(bottom, top, front);
      var plane = face;
      var meets = MEETS_RESIN;
      if (capped) { meets = MEETS_PLATING; }
      else if (covered) { meets = MEETS_COVER; }
      else if (!filled) { plane = face + select(recess, -recess, front); }
      let t = (plane - o.z) / d.z;
      let p = o + d * t;
      if (t > near && t < best.t && segmentDistance(p.xy, half) < inner && onBoard(b, toWorld(b, p.xy))) {
        best = Surface(t, vec3f(0.0, 0.0, select(-1.0, 1.0, front)), meets);
      }
    }
  }
  if (best.t < FAR) {
    best.normal = vec3f(turn(best.normal.xy, b.shape.w), best.normal.z);
  }
  return best;
}

fn hitDepth(input: BarrelOut, t: f32) -> f32 {
  let b = barrels[input.barrel];
  var dir = view.eye.xyz;
  if (abs(view.eye.w) > 1e-12) { dir = input.world - view.eye.xyz / view.eye.w; }
  let clip = globals.viewProjection * vec4f(input.world + dir * t, 1.0);
  return clip.z / clip.w;
}

struct ColorOut {
  @location(0) color: vec4f,
  @builtin(frag_depth) depth: f32,
};
struct PickOut {
  @location(0) pick: vec4u,
  @builtin(frag_depth) depth: f32,
};

@fragment fn fs_barrel(input: BarrelOut) -> ColorOut {
  let hit = surface(input);
  if (hit.t >= FAR) { discard; }
  let b = barrels[input.barrel];
  var out: ColorOut;
  out.depth = hitDepth(input, hit.t);
  let value = values[b.ids.x];
  // An unplated hole is a bare drill wall in the substrate's colour, shown with the board.
  if ((b.ids.w & UNPLATED) != 0u) {
    if (view.board == 0u) { discard; }
    let light = normalize(globals.lightDirection.xyz);
    out.color = vec4f(view.wallColor.rgb * (0.62 + max(dot(hit.normal, light), 0.0) * 0.72), 1.0);
    return out;
  }
  let lit = netLit(b.ids.x);
  // Net isolation draws only the lit nets' barrels.
  if (view.isolate == 1u && !lit) { discard; }
  if (view.overlay == 1u && present(value)) {
    out.color = vec4f(fieldColor(normalized(value)), 1.0);
    return out;
  }
  let light = normalize(globals.lightDirection.xyz);
  // Resin and covers are not the net's copper: they keep their own colour.
  if (hit.meets != MEETS_PLATING) {
    let surfaceColor = select(RESIN, view.coverColor.rgb, hit.meets == MEETS_COVER);
    out.color = vec4f(surfaceColor * (0.62 + max(dot(hit.normal, light), 0.0) * 0.72), 1.0);
    return out;
  }
  var base = view.color.rgb;
  if (lit) {
    base = vec3f(0.1, 1.0, 0.22) * (0.88 + 0.12 * sin(globals.time * 3.2));
  } else if (globals.hasHighlight > 0.5) {
    base = mix(base, vec3f(0.12, 0.14, 0.17), 0.58);
  }
  out.color = vec4f(base * (0.38 + max(dot(hit.normal, light), 0.0) * 0.72), 1.0);
  return out;
}

@fragment fn fs_barrel_pick(input: BarrelOut) -> PickOut {
  let hit = surface(input);
  let b = barrels[input.barrel];
  if (hit.t >= FAR || (view.isolate == 1u && !netLit(b.ids.x)) || ((b.ids.w & UNPLATED) != 0u && view.board == 0u)) { discard; }
  var out: PickOut;
  out.depth = hitDepth(input, hit.t);
  out.pick = vec4u(PICK_TAG, b.ids.x + 1u, 0u, 0u);
  return out;
}
`,Xd=`
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
struct View {
  eye: vec4f,
  color: vec4f,
  wallColor: vec4f,
  overlay: u32,
  isolate: u32,
  // 1 while the board (substrate) is shown: bare drill walls belong to it.
  board: u32,
  // 1 while the board is solid and unseparated: the copper levels' bands show.
  solid: u32,
  range: vec2f,
  padding3: vec2f,
  edgeColor: vec4f,
  coverColor: vec4f,
};
struct Wall {
  ends: vec4f,
  span: vec4f,
  ids: vec4u,
};
@group(0) @binding(0) var<uniform> globals: Globals;
@group(0) @binding(1) var<uniform> view: View;
@group(0) @binding(2) var<storage, read> walls: array<Wall>;
@group(0) @binding(4) var<storage, read> layerOffsets: array<f32>;

struct WallOut {
  @builtin(position) position: vec4f,
  @location(0) world: vec3f,
  @location(1) @interpolate(flat) normal: vec3f,
};

@vertex fn vs_wall(@builtin(vertex_index) vertex: u32, @builtin(instance_index) index: u32) -> WallOut {
  let wall = walls[index];
  var corners = array<vec2f, 6>(vec2f(0.0, 0.0), vec2f(1.0, 0.0), vec2f(1.0, 1.0),
    vec2f(0.0, 0.0), vec2f(1.0, 1.0), vec2f(0.0, 1.0));
  let corner = corners[vertex];
  let offset = 0.5 * (layerOffsets[wall.ids.x] + layerOffsets[wall.ids.y]);
  // A copper level's band (ids.z 1) shows only on a solid board.
  let shown = wall.ids.z == 0u || view.solid == 1u;
  let world = vec3f(mix(wall.ends.xy, wall.ends.zw, corner.x), mix(wall.span.y, wall.span.x, corner.y) + offset);
  let along = wall.ends.zw - wall.ends.xy;
  var out: WallOut;
  out.position = select(vec4f(0.0, 0.0, 2.0, 1.0), globals.viewProjection * vec4f(world, 1.0), shown);
  out.world = world;
  out.normal = vec3f(normalize(vec2f(along.y, -along.x) + vec2f(1e-30, 0.0)), 0.0);
  return out;
}

fn aces(color: vec3f) -> vec3f {
  return clamp((color * (2.51 * color + 0.03)) / (color * (2.43 * color + 0.59) + 0.14), vec3f(0.0), vec3f(1.0));
}

@fragment fn fs_wall(input: WallOut) -> @location(0) vec4f {
  var toward = -view.eye.xyz;
  if (abs(view.eye.w) > 1e-12) { toward = view.eye.xyz / view.eye.w - input.world; }
  let normal = select(-input.normal, input.normal, dot(input.normal, toward) >= 0.0);
  let light = normalize(globals.lightDirection.xyz);
  // Lit and tone mapped as the slabs' faces are (lightNormal's ambient), so
  // an edge turned from the light still reads as laminate, not black.
  let base = view.edgeColor.rgb * (0.62 + max(dot(normal, light), 0.0) * 0.72);
  return vec4f(aces(base), view.wallColor.a);
}
`;var $d=`
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
struct Arrow {
  base: vec4f,
  dir: vec4f,
  ids: vec4u,
};
@group(0) @binding(0) var<uniform> globals: Globals;
@group(0) @binding(1) var<storage, read> arrows: array<Arrow>;
@group(0) @binding(2) var<storage, read> layerOffsets: array<f32>;
// 1 for each layer whose copper this frame drew: arrows show only on it.
@group(0) @binding(4) var<storage, read> drawnLayers: array<u32>;
${Ji(3)}

struct ArrowOut {
  @builtin(position) position: vec4f,
  @location(0) @interpolate(flat) outline: u32,
  @location(1) @interpolate(flat) share: f32,
};


@vertex fn vs_arrow(@builtin(vertex_index) vertex: u32, @builtin(instance_index) instance: u32) -> ArrowOut {
  let count = arrayLength(&arrows);
  let outline = instance < count;
  let arrow = arrows[instance % count];
  let length = arrow.dir.z;
  let half = arrow.base.w;
  let head = min(0.45 * length, 4.0 * half);
  let neck = length - head;
  // Shaft quad, then head triangle; x along the arrow from its tail, y across.
  var shape = array<vec2f, 9>(
    vec2f(0.0, -half), vec2f(neck, -half), vec2f(neck, half),
    vec2f(0.0, -half), vec2f(neck, half), vec2f(0.0, half),
    vec2f(neck, -2.4 * half), vec2f(length, 0.0), vec2f(neck, 2.4 * half));
  var local = shape[vertex] - vec2f(0.5 * length, 0.0);
  if (outline) {
    // Grown about the arrow's centre by a fixed rim.
    let rim = 0.9 * half;
    local = local * vec2f((length + 2.0 * rim) / max(length, 1e-12), (half + rim) / max(half, 1e-12));
  }
  let along = arrow.dir.xy;
  let across = vec2f(-along.y, along.x);
  let offset = 0.5 * (layerOffsets[arrow.ids.x] + layerOffsets[arrow.ids.y]);
  let point = arrow.base.xy + along * local.x + across * local.y;
  var out: ArrowOut;
  out.position = globals.viewProjection * vec4f(point, arrow.base.z + offset, 1.0);
  if (drawnLayers[arrow.ids.x] == 0u) { out.position = vec4f(0.0, 0.0, 2.0, 1.0); }
  out.outline = select(0u, 1u, outline);
  out.share = clamp(arrow.dir.w, 0.0, 1.0);
  return out;
}

@fragment fn fs_arrow(input: ArrowOut) -> @location(0) vec4f {
  return select(vec4f(ramp(input.share, 1u), 1.0), palette.outline, input.outline == 1u);
}
`;var ro=20,bt=256,Yd=112,er="rg32uint",Rr=bt/4,kx=256,Jd={compare:"always",passOp:"zero"},Ex={compare:"always",passOp:"replace"},Sx={compare:"not-equal",passOp:"keep"},Tx={compare:"equal",passOp:"keep"},tu="fn dequant(p: vec3f) -> vec3f { return draw.quantMin.xyz + p * draw.quantSize.xyz; }",ru=32,au=`  let plating = input.dimensions.w - input.dimensions.z;
  let rim = select(1.0, ${(1/Math.cos(Math.PI/ru)).toFixed(6)}, input.radiusMix > 1.5);
  let radius = mix(max(input.dimensions.z - plating, input.dimensions.z * 0.5), input.dimensions.z, min(input.radiusMix, 1.0)) * rim;
  let turn = vec2f(cos(input.shape.y), sin(input.shape.y));
  let local = vec2f(input.unit.x * radius + select(-input.shape.x, input.shape.x, input.unit.x >= 0.0), input.unit.y * radius);
  let planar = vec2f(local.x * turn.x - local.y * turn.y, local.x * turn.y + local.y * turn.x);
  let turnedNormal = vec3f(input.normal.x * turn.x - input.normal.y * turn.y, input.normal.x * turn.y + input.normal.y * turn.x, input.normal.z);
`,Gs=`
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
  placement: vec4u,
  quantMin: vec4f,
  quantSize: vec4f,
};
@group(0) @binding(0) var<uniform> globals: Globals;
@group(0) @binding(1) var<uniform> draw: Draw;
${tu}
@group(0) @binding(3) var<storage, read> hiddenMask: array<u32>;
@group(0) @binding(4) var<storage, read> netMask: array<u32>;
${qi}
${sa}
// Set on the pipeline that draws the solder mask over copper.
override COVERED: bool = false;

${de("decl")}struct VertexInput {
  @location(0) position: vec3f,
  @location(1) normal: vec3f,
  @location(2) netId: u32,
  @location(3) objectId: u32,
};
struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) normal: vec3f,
  @location(1) @interpolate(flat) netId: u32,
  @location(2) @interpolate(flat) objectId: u32,
${de("vs-out")}  @location(3) world: vec3f,
};
@vertex fn vs(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  output.world = dequant(input.position) + draw.offset.xyz;
  output.position = globals.viewProjection * vec4f(output.world, 1.0);
  output.normal = normalize(input.normal);
  output.netId = input.netId;
  output.objectId = input.objectId;
${de("vs-end")}  return output;
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
${de("fs-begin")}  let kind = u32(draw.flags.x);
  let copper = kind == 1u;
  let component = kind == 2u;
  if (component && featureHidden(input.objectId)) { discard; }
  let selected = netEmphasized(input.netId) || (globals.activeNet != 0u && input.netId == globals.activeNet);
  let selectedComponent = component && globals.selectedFeature != 0u && input.objectId == globals.selectedFeature;
  var base = draw.color.rgb;
  if (COVERED) {
    // Mask over copper reads lighter, as in KiCad.
    base = min(base * 1.6 + vec3f(0.03, 0.05, 0.02), vec3f(1.0));
  }
  if (selected && copper) {
    // flags.z: 0 draws all copper, 1 isolates (lit copper keeps its colour), 2 is inner copper
    // that shows only where lit (SB2-85) and pulses like the outer layers.
    if (draw.flags.z < 0.5 || draw.flags.z > 1.5) {
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
  // Light each side of the board from its own side, as KiCad does, so the
  // bottom reads as clearly as the top.
  let side = vec3f(1.0, 1.0, select(1.0, -1.0, normal.z < 0.0));
  let light = normalize(globals.lightDirection.xyz * side);
  let diffuse = max(dot(normal, light), 0.0);
  let hemi = mix(0.28, 0.62, abs(normal.z) * 0.5 + 0.5);
  let roughness = clamp(draw.material.y, 0.05, 1.0);
  let metallic = clamp(draw.material.x, 0.0, 1.0);
  let specular = pow(max(dot(normal, normalize(light + vec3f(0.3, -0.4, 0.85) * side)), 0.0), mix(96.0, 6.0, roughness));
  let shaded = base * (hemi + diffuse * 0.72) + mix(vec3f(0.04), base, metallic) * specular * 0.5;
  var lit = shaded;
  if (draw.flags.w > 0.5) {
    lit = base;
  }
  var alpha = draw.flags.y;
  // Translucent placeholders (material.z = full component opacity) turn solid when selected.
  if (selectedComponent) { alpha = max(alpha, draw.material.z * 0.9); }
  if (COVERED) { alpha = min(1.0, alpha * 1.2); }
${de("fs-return")}  return vec4f(aces(lit), alpha);
}
`,Ax=Be(Gs),zs=`
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
struct Draw { color: vec4f, material: vec4f, offset: vec4f, flags: vec4f, placement: vec4u, quantMin: vec4f, quantSize: vec4f };
@group(0) @binding(0) var<uniform> globals: Globals;
@group(0) @binding(1) var<uniform> draw: Draw;
${tu}
@group(0) @binding(3) var<storage, read> hiddenMask: array<u32>;
@group(0) @binding(4) var<storage, read> netMask: array<u32>;
${qi}
${sa}
${de("decl")}struct Input {
  @location(0) position: vec3f,
  @location(1) normal: vec3f,
  @location(2) netId: u32,
  @location(3) objectId: u32,
};
struct Output {
  @builtin(position) position: vec4f,
  @location(2) @interpolate(flat) netId: u32,
${de("vs-out")}  @location(0) @interpolate(flat) objectId: u32,
};
@vertex fn vs(input: Input) -> Output {
  var output: Output;
  output.position = globals.viewProjection * vec4f(dequant(input.position) + draw.offset.xyz, 1.0);
  output.objectId = input.objectId;
  output.netId = input.netId;
${de("vs-end")}  return output;
}
@fragment fn fs(input: Output) -> @location(0) vec2u {
${de("fs-begin")}  if (u32(draw.flags.x) == 2u && featureHidden(input.objectId)) { discard; }
  // Isolated (flags.z), unlit copper is not drawn, so it is not there to pick (SB2-31e).
  let lit = netEmphasized(input.netId) || (globals.activeNet != 0u && input.netId == globals.activeNet);
  if (u32(draw.flags.x) == 1u && draw.flags.z > 0.5 && !lit) { discard; }
${de("fs-return")}  return vec2u(1u, input.objectId);
}
`,_x=Be(zs),so=`
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
@group(0) @binding(4) var<storage, read> netMask: array<u32>;
${sa}
${de("decl")}${Ls}
struct Output {
  @builtin(position) position: vec4f,
  @location(0) normal: vec3f,
  @location(1) @interpolate(flat) netId: u32,
  @location(2) @interpolate(flat) objectId: u32,
${de("vs-out")}  @location(3) @interpolate(flat) visible: u32,
};
@vertex fn vs(input: Input) -> Output {
${au}  let z0 = input.span.x + layerOffsets[input.ids.z];
  let z1 = input.span.y + layerOffsets[input.ids.w];
  let world = vec3f(
    input.dimensions.x + planar.x,
    input.dimensions.y + planar.y,
    mix(z0, z1, input.unit.z)
  );
  var output: Output;
  output.position = globals.viewProjection * vec4f(world, 1.0);
  output.normal = turnedNormal;
  output.netId = input.ids.x;
  output.objectId = input.ids.y;
  output.visible = 0u;
  if (globals.selectedLayer == 0u || (globals.selectedLayer >= input.ids.z && globals.selectedLayer <= input.ids.w)) {
    output.visible = 1u;
  }
${de("vs-end")}  return output;
}
@fragment fn fs(input: Output) -> @location(0) vec4f {
${de("fs-begin")}  if (input.visible == 0u) { discard; }
  let selected = netEmphasized(input.netId) || (globals.activeNet != 0u && input.netId == globals.activeNet);
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
${de("fs-return")}  return vec4f(lit, 1.0);
}
`,Ix=Be(so),no=`
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
@group(0) @binding(4) var<storage, read> netMask: array<u32>;
${sa}
${de("decl")}${Ls}
struct Output {
  @builtin(position) position: vec4f,
  @location(3) @interpolate(flat) netId: u32,
  @location(0) @interpolate(flat) objectId: u32,
${de("vs-out")}  @location(1) @interpolate(flat) visible: u32,
};
@vertex fn vs(input: Input) -> Output {
${au}  let world = vec3f(
    input.dimensions.x + planar.x,
    input.dimensions.y + planar.y,
    mix(input.span.x + layerOffsets[input.ids.z], input.span.y + layerOffsets[input.ids.w], input.unit.z)
  );
  var output: Output;
  output.position = globals.viewProjection * vec4f(world, 1.0);
  output.objectId = input.ids.y;
  output.netId = input.ids.x;
  output.visible = 0u;
  if (globals.selectedLayer == 0u || (globals.selectedLayer >= input.ids.z && globals.selectedLayer <= input.ids.w)) {
    output.visible = 1u;
  }
${de("vs-end")}  return output;
}
@fragment fn fs(input: Output) -> @location(0) vec2u {
${de("fs-begin")}  if (input.visible == 0u) { discard; }
  let lit = netEmphasized(input.netId) || (globals.activeNet != 0u && input.netId == globals.activeNet);
  if (draw.flags.z > 0.5 && !lit) { discard; }
${de("fs-return")}  return vec2u(1u, input.objectId);
}
`,Rx=Be(no);function ur(e,t){return t.reduce((r,[a,s])=>{if(r.split(a).length!==2)throw new Error(`Shader variant anchor not found once: ${a.slice(0,60)}`);return r.replace(a,()=>s)},e)}var io=[`  padding0: u32,
  padding1: u32,`,`  selectedOccurrence: u32,
  occurrenceBase: u32,`],Ks=[["  padding2: u32,","  emphasisStride: u32,"],["fn netEmphasized(id: u32) -> bool {",`${dl}fn netEmphasized(id: u32) -> bool {`]],su="  let lit = netEmphasized(input.netId) || (globals.activeNet != 0u && input.netId == globals.activeNet);",nu=`  let lit = emphasisOf(input.occurrence, input.netId) != 0u
    || (input.occurrence == globals.selectedOccurrence && globals.activeNet != 0u && input.netId == globals.activeNet);`,oo=ur(Gs,[io,[`  @location(3) world: vec3f,
};`,`  @location(3) world: vec3f,
  @location(4) @interpolate(flat) occurrence: u32,
  // Mask and silkscreen opacity of this occurrence's own stackup separation (SB2-31f).
  @location(5) @interpolate(flat) fade: f32,
};`],[`@vertex fn vs(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  output.world = dequant(input.position) + draw.offset.xyz;
  output.position = globals.viewProjection * vec4f(output.world, 1.0);
  output.normal = normalize(input.normal);`,`${da}
@vertex fn vs(input: VertexInput, @builtin(instance_index) instance: u32) -> VertexOutput {
  // Full-detail draws (components; inner copper behind an opaque board) list only
  // occurrences at full detail (draw.material.w = LIST_FULL); copper and the
  // like list full or board, substrate and mask full, board or body.
  let index = listedOccurrence(u32(draw.material.w + 0.5), instance);
  let occurrence = occurrences[index];
  var output: VertexOutput;
  let lift = vec3f(0.0, 0.0, explodeLift(occurrence, draw.offset.w));
  output.world = (occurrence.model * vec4f(dequant(input.position) + draw.offset.xyz + lift, 1.0)).xyz;
  output.position = globals.viewProjection * vec4f(output.world, 1.0);
  output.normal = normalize((occurrence.normal * vec4f(input.normal, 0.0)).xyz);
  output.occurrence = index + 1u + globals.occurrenceBase;
  output.fade = select(1.0, occurrence.explode.z, occurrence.explode.w > 0.5 && draw.flags.x < 0.5);
  // A layer this copy hides (SB2-31e), or a draw its separation removes (SB2-31f), collapses outside the clip volume.
  if (layerHiddenAt(occurrence, draw.offset.w) || explodeHides(occurrence, draw.flags.x, draw.offset.w)) {
    output.position = vec4f(0.0, 0.0, 2.0, 1.0);
  }`],[`  let selected = netEmphasized(input.netId) || (globals.activeNet != 0u && input.netId == globals.activeNet);
  let selectedComponent = component && globals.selectedFeature != 0u && input.objectId == globals.selectedFeature;`,`  // The inspected selection lights its own copy; host-highlighted nets light every copy.
  let here = input.occurrence == globals.selectedOccurrence;
  let mark = emphasisOf(input.occurrence, input.netId);
  let selected = mark != 0u || (here && globals.activeNet != 0u && input.netId == globals.activeNet);
  let selectedComponent = here && component && globals.selectedFeature != 0u && input.objectId == globals.selectedFeature;`],...Ks,["      base = vec3f(0.08, 1.0, 0.2) * pulse;","      base = emphasisColor(mark, vec3f(0.08, 1.0, 0.2)) * pulse;"],["  var alpha = draw.flags.y;","  var alpha = draw.flags.y * input.fade;"]]),iu=Be(oo),co=ur(zs,[io,[`  @location(0) @interpolate(flat) objectId: u32,
};`,`  @location(0) @interpolate(flat) objectId: u32,
  @location(1) @interpolate(flat) occurrence: u32,
};`],[`@vertex fn vs(input: Input) -> Output {
  var output: Output;
  output.position = globals.viewProjection * vec4f(dequant(input.position) + draw.offset.xyz, 1.0);`,`${da}
@vertex fn vs(input: Input, @builtin(instance_index) instance: u32) -> Output {
  let index = listedOccurrence(u32(draw.material.w + 0.5), instance);
  let occurrence = occurrences[index];
  let lift = vec3f(0.0, 0.0, explodeLift(occurrence, draw.offset.w));
  let world = (occurrence.model * vec4f(dequant(input.position) + draw.offset.xyz + lift, 1.0)).xyz;
  var output: Output;
  output.position = globals.viewProjection * vec4f(world, 1.0);
  output.occurrence = index + 1u + globals.occurrenceBase;
  if (layerHiddenAt(occurrence, draw.offset.w) || explodeHides(occurrence, draw.flags.x, draw.offset.w)) {
    output.position = vec4f(0.0, 0.0, 2.0, 1.0);
  }`],[`${de("fs-return")}  return vec2u(1u, input.objectId);`,`  let kind = u32(draw.flags.x);
${de("fs-return")}  return vec2u(input.occurrence, select(input.objectId, 0u, kind == 0u));`],...Ks,[su,nu]]),ou=Be(co),Nx=`struct Placement { r0: vec4f, r1: vec4f, r2: vec4f, ids: vec4u };
@group(0) @binding(8) var<storage, read> placements: array<Placement>;
fn place(p: Placement, v: vec3f) -> vec3f {
  return vec3f(dot(p.r0.xyz, v) + p.r0.w, dot(p.r1.xyz, v) + p.r1.w, dot(p.r2.xyz, v) + p.r2.w);
}
fn turn(p: Placement, n: vec3f) -> vec3f {
  return vec3f(dot(p.r0.xyz, n), dot(p.r1.xyz, n), dot(p.r2.xyz, n));
}`,Qd="@group(0) @binding(1) var<uniform> draw: Draw;",Vs=[Qd,`${Qd}
${Nx}`],Hs=["  output.objectId = input.objectId;","  output.objectId = select(placement.ids.x, input.objectId, input.objectId != 0u);"],cu=["  let index = listedOccurrence(u32(draw.material.w + 0.5), instance);",`  let placement = placements[draw.placement.x + instance % draw.placement.y];
  let index = listedOccurrence(u32(draw.material.w + 0.5), instance / draw.placement.y);`],lu=ur(Gs,[Vs,[`@vertex fn vs(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  output.world = dequant(input.position) + draw.offset.xyz;`,`@vertex fn vs(input: VertexInput, @builtin(instance_index) instance: u32) -> VertexOutput {
  let placement = placements[draw.placement.x + instance];
  var output: VertexOutput;
  output.world = place(placement, dequant(input.position)) + draw.offset.xyz;`],["  output.normal = normalize(input.normal);","  output.normal = normalize(turn(placement, input.normal));"],Hs]),du=ur(oo,[Vs,cu,["occurrence.model * vec4f(dequant(input.position) + draw.offset.xyz + lift, 1.0)","occurrence.model * vec4f(place(placement, dequant(input.position)) + draw.offset.xyz + lift, 1.0)"],["(occurrence.normal * vec4f(input.normal, 0.0))","(occurrence.normal * vec4f(turn(placement, input.normal), 0.0))"],Hs]),uu=ur(zs,[Vs,[`@vertex fn vs(input: Input) -> Output {
  var output: Output;
  output.position = globals.viewProjection * vec4f(dequant(input.position) + draw.offset.xyz, 1.0);`,`@vertex fn vs(input: Input, @builtin(instance_index) instance: u32) -> Output {
  let placement = placements[draw.placement.x + instance];
  var output: Output;
  output.position = globals.viewProjection * vec4f(place(placement, dequant(input.position)) + draw.offset.xyz, 1.0);`],Hs]),fu=ur(co,[Vs,cu,["occurrence.model * vec4f(dequant(input.position) + draw.offset.xyz + lift, 1.0)","occurrence.model * vec4f(place(placement, dequant(input.position)) + draw.offset.xyz + lift, 1.0)"],Hs]),hu=Be(lu),bu=Be(du),pu=Be(uu),gu=Be(fu),Zi=64,Cx=6,Bx=`${Ud}
${da}
struct Input {
  @location(0) unit: vec3f,
  @location(1) normal: vec3f,
  @location(2) radiusMix: f32,
};`;function mu(e,t,r=[]){return ur(e,[io,[`@group(0) @binding(2) var<storage, read> layerOffsets: array<f32>;
`,""],[Ls,Bx],["@vertex fn vs(input: Input) -> Output {",`struct Record {
  unit: vec3f,
  normal: vec3f,
  radiusMix: f32,
  dimensions: vec4f,
  span: vec2f,
  shape: vec2f,
  ids: vec4u,
};
@vertex fn vs(vertex: Input, @builtin(instance_index) instance: u32) -> Output {
  let count = arrayLength(&barrels);
  let barrel = barrels[instance % count];
  let index = listedOccurrence(LIST_BOARD, instance / count);
  let occurrence = occurrences[index];
  // An occurrence that explodes itself (SB2-31f) scales the renderer's per-layer steps by its own gap.
  let spread = select(1.0, occurrence.explode.x, occurrence.explode.w > 0.5);
  let input = Record(vertex.unit, vertex.normal, vertex.radiusMix, barrel.dimensions, barrel.span, barrel.shape, barrel.ids);`],[t,t.replace("vec4f(world, 1.0)","vec4f((occurrence.model * vec4f(world, 1.0)).xyz, 1.0)")],["  output.objectId = input.ids.y;",`  output.objectId = input.ids.y;
  output.occurrence = index + 1u + globals.occurrenceBase;`],...r])}var yu=mu(so,`  output.position = globals.viewProjection * vec4f(world, 1.0);
  output.normal = turnedNormal;`,[[`  let z0 = input.span.x + layerOffsets[input.ids.z];
  let z1 = input.span.y + layerOffsets[input.ids.w];`,`  let z0 = input.span.x + layerOffsets[input.ids.z] * spread;
  let z1 = input.span.y + layerOffsets[input.ids.w] * spread;`],[`  output.normal = turnedNormal;
  output.netId`,`  output.normal = (occurrence.normal * vec4f(turnedNormal, 0.0)).xyz;
  output.netId`],[`  @location(3) @interpolate(flat) visible: u32,
};`,`  @location(3) @interpolate(flat) visible: u32,
  @location(4) @interpolate(flat) occurrence: u32,
};`],["  let selected = netEmphasized(input.netId) || (globals.activeNet != 0u && input.netId == globals.activeNet);",`  let mark = emphasisOf(input.occurrence, input.netId);
  let selected = mark != 0u
    || (input.occurrence == globals.selectedOccurrence && globals.activeNet != 0u && input.netId == globals.activeNet);`],...Ks,["      base = vec3f(0.1, 1.0, 0.22) * (","      base = emphasisColor(mark, vec3f(0.1, 1.0, 0.22)) * ("]]),xu=mu(no,`  output.position = globals.viewProjection * vec4f(world, 1.0);
  output.objectId`,[["mix(input.span.x + layerOffsets[input.ids.z], input.span.y + layerOffsets[input.ids.w], input.unit.z)","mix(input.span.x + layerOffsets[input.ids.z] * spread, input.span.y + layerOffsets[input.ids.w] * spread, input.unit.z)"],[`  @location(1) @interpolate(flat) visible: u32,
};`,`  @location(1) @interpolate(flat) visible: u32,
  @location(2) @interpolate(flat) occurrence: u32,
};`],["  return vec2u(1u, input.objectId);","  return vec2u(input.occurrence, input.objectId);"],...Ks,[su,nu]]),wu=Be(yu),vu=Be(xu),Mu=`
struct Globals {
  viewProjection: mat4x4f,
  activeNet: u32,
  selectedLayer: u32,
  time: f32,
  hasHighlight: f32,
  selectedFeature: u32,
  selectedOccurrence: u32,
  occurrenceBase: u32,
  padding2: u32,
  lightDirection: vec4f,
};
struct Draw { color: vec4f, material: vec4f, offset: vec4f, flags: vec4f };
@group(0) @binding(0) var<uniform> globals: Globals;
@group(0) @binding(1) var<uniform> draw: Draw;
${da}
${de("decl")}struct Input {
  @location(0) corner: vec3f,
  @location(1) normal: vec3f,
};
struct Output {
  @builtin(position) position: vec4f,
  @location(0) normal: vec3f,
${de("vs-out")}  @location(1) @interpolate(flat) occurrence: u32,
};
@vertex fn vs(input: Input, @builtin(instance_index) instance: u32) -> Output {
  let index = listedOccurrence(LIST_BOX, instance);
  let occurrence = occurrences[index];
  let local = draw.offset.xyz + input.corner * draw.material.xyz;
  var output: Output;
  output.position = globals.viewProjection * vec4f((occurrence.model * vec4f(local, 1.0)).xyz, 1.0);
  output.normal = (occurrence.normal * vec4f(input.normal, 0.0)).xyz;
  output.occurrence = index + 1u + globals.occurrenceBase;
${de("vs-end")}  return output;
}
`,ku=`${Mu}
@fragment fn fs(input: Output) -> @location(0) vec4f {
${de("fs-begin")}  let light = normalize(globals.lightDirection.xyz);
${de("fs-return")}  return vec4f(draw.color.rgb * (0.45 + max(dot(normalize(input.normal), light), 0.0) * 0.55), 1.0);
}
`,Eu=Be(ku),Su=`${Mu}
@fragment fn fs(input: Output) -> @location(0) vec2u {
${de("fs-begin")}${de("fs-return")}  return vec2u(input.occurrence, 0u);
}
`,Tu=Be(Su),lo=`
struct Occurrence {
  model: mat4x4f,
  normal: mat4x4f,
  hiddenLayers: vec4u,
  explode: vec4f,
};
struct Cull {
  planes: array<vec4f, 6>,
  eye: vec4f,
  boundsMin: vec4f,
  boundsMax: vec4f,
  lod: vec4f,
  info: vec4u,
  extra: vec4u,
};
@group(0) @binding(0) var<uniform> cull: Cull;
@group(0) @binding(1) var<storage, read> occurrences: array<Occurrence>;
@group(0) @binding(2) var<storage, read_write> lods: array<u32>;
@group(0) @binding(3) var<storage, read_write> lists: array<u32>;
@group(0) @binding(4) var<storage, read_write> counters: array<atomic<u32>, 4>;
@group(0) @binding(5) var<storage, read_write> args: array<u32>;
@group(0) @binding(6) var<storage, read> classes: array<u32>;

fn chooseLod(previous: u32, pixels: f32) -> u32 {
  var limits = array<f32, 3>(cull.lod.y, bitcast<f32>(cull.extra.y), cull.lod.z);
  let keep = cull.lod.w;
  var lod = 3u;
  if (pixels >= limits[2]) { lod = 2u; }
  if (pixels >= limits[1]) { lod = 1u; }
  if (pixels >= limits[0]) { lod = 0u; }
  for (var level = 0u; level < lod; level += 1u) {
    if (previous <= level && pixels >= limits[level] * keep) { return level; }
  }
  return lod;
}

@compute @workgroup_size(64) fn classify(@builtin(global_invocation_id) id: vec3u) {
  let i = id.x;
  if (i >= cull.info.x) { return; }
  let model = occurrences[i].model;
  var lo = vec3f(3.0e38);
  var hi = vec3f(-3.0e38);
  for (var corner = 0u; corner < 8u; corner += 1u) {
    let local = vec3f(
      select(cull.boundsMin.x, cull.boundsMax.x, (corner & 1u) != 0u),
      select(cull.boundsMin.y, cull.boundsMax.y, (corner & 2u) != 0u),
      select(cull.boundsMin.z, cull.boundsMax.z, (corner & 4u) != 0u));
    let point = (model * vec4f(local, 1.0)).xyz;
    lo = min(lo, point);
    hi = max(hi, point);
  }
  var inside = true;
  for (var k = 0u; k < 6u; k += 1u) {
    let plane = cull.planes[k];
    let far = select(lo, hi, plane.xyz >= vec3f(0.0));
    if (dot(plane.xyz, far) + plane.w < 0.0) { inside = false; }
  }
  var lod = 3u;
  if (inside) {
    let center = (lo + hi) * 0.5;
    let radius = length(hi - lo) * 0.5;
    // Perspective: pixels per unit at unit distance over the distance; orthographic: per unit.
    let distance = select(1.0, max(length(center - cull.eye.xyz), 1.0e-6), cull.eye.w > 0.5);
    lod = chooseLod(lods[i], radius * cull.lod.x / distance);
    if (cull.info.z != 0u) { lod = cull.info.z - 1u; }
    if (i + 1u == cull.info.y) { lod = 0u; }
  }
  lods[i] = lod;
  if (lod == 0u) { lists[atomicAdd(&counters[0], 1u) * 4u] = i; }
  if (lod <= 1u) { lists[atomicAdd(&counters[1], 1u) * 4u + 1u] = i; }
  if (lod <= 2u) { lists[atomicAdd(&counters[2], 1u) * 4u + 2u] = i; }
  if (lod == 3u) { lists[atomicAdd(&counters[3], 1u) * 4u + 3u] = i; }
}

@compute @workgroup_size(64) fn writeArgs(@builtin(global_invocation_id) id: vec3u) {
  let slot = id.x;
  if (slot >= cull.info.w) { return; }
  let full = atomicLoad(&counters[0]);
  let board = atomicLoad(&counters[1]);
  let body = atomicLoad(&counters[2]);
  let box = atomicLoad(&counters[3]);
  let kind = classes[slot];
  var count = 0u;
  if (kind == 0u) { count = board; }
  else if (kind == 1u) { count = full; }
  else if (kind == 2u) { count = board * cull.extra.x; }
  else if (kind == 3u) { count = box; }
  else if (kind == 5u) { count = body; }
  else if ((kind & 7u) == 6u) { count = full * (kind >> 3u); }
  args[slot * 5u + 1u] = count;
}
`,Zd=[{arrayStride:24,attributes:[{shaderLocation:0,offset:0,format:"float32x3"},{shaderLocation:1,offset:12,format:"float32x3"}]}],gA=Object.freeze({main:iu,pick:ou,barrel:wu,barrelPick:vu,box:Eu,boxPick:Tu,cull:lo,component:hu,componentInstanced:bu,componentPick:pu,componentPickInstanced:gu}),Au=Object.freeze({main:{output:"color",single:Gs,instanced:oo,world:["output.world","output.world"]},pick:{output:"pick",single:zs,instanced:co,world:["(dequant(input.position) + draw.offset.xyz)","world"]},barrel:{output:"color",single:so,instanced:yu,world:["world","(occurrence.model * vec4f(world, 1.0)).xyz"]},barrelPick:{output:"pick",single:no,instanced:xu,world:["world","(occurrence.model * vec4f(world, 1.0)).xyz"]},component:{output:"color",single:lu,instanced:du,world:["output.world","output.world"]},componentPick:{output:"pick",single:uu,instanced:fu,world:["(place(placement, dequant(input.position)) + draw.offset.xyz)","world"]},box:{output:"color",single:null,instanced:ku,world:[null,"(occurrence.model * vec4f(local, 1.0)).xyz"]},boxPick:{output:"pick",single:null,instanced:Su,world:[null,"(occurrence.model * vec4f(local, 1.0)).xyz"]}}),mA=Object.freeze(Object.keys(Au));function eo(e,t,r=[]){let a=Au[e],s=a?.[t?"instanced":"single"];if(!s)throw new Error(`No ${t?"instanced":"one-board"} ${e} shader`);return Od(s,r,{family:e,instanced:t,output:a.output,world:a.world[t?1:0]})}var yA=Object.freeze({main:Ax,pick:_x,barrel:Ix,barrelPick:Rx,mainInstanced:iu,pickInstanced:ou,barrelInstanced:wu,barrelPickInstanced:vu,component:hu,componentInstanced:bu,componentPick:pu,componentPickInstanced:gu,box:Eu,boxPick:Tu,cull:lo}),tr=class e{static async create(t,{sampleCount:r=4}={}){if(!navigator.gpu)throw new Error("WebGPU is unavailable in this browser");let a=await navigator.gpu.requestAdapter({powerPreference:"high-performance"});if(!a)throw new Error("No WebGPU adapter is available");let s=a.features.has("depth32float-stencil8"),n=await a.requestDevice(s?{requiredFeatures:["depth32float-stencil8"]}:void 0);return new e(t,n,{stencil:s,sampleCount:r})}constructor(t,r,{shareFrom:a=null,stencil:s=!1,sampleCount:n=1}={}){if(this.canvas=t,this.device=r,this.shareFrom=a,this.stencil=a?a.stencil:!!s,this.sampleCount=a?a.sampleCount:n===4?4:1,this.depthFormat=this.stencil?"depth32float-stencil8":"depth32float",this.version=0,this.barrelColor=[.55,.35,.16,.78],this.alwaysInstanced=!!a,this.occurrenceBase=0,a?(this.context=a.context,this.format=a.format):(r.addEventListener("uncapturederror",i=>{console.error(`Uncaptured WebGPU error: ${i.error?.message||i.error}`)}),r.lost.then(i=>{i.reason!=="destroyed"&&console.error(`WebGPU device lost: ${i.reason}`,i.message)}),this.context=t.getContext("webgpu"),this.format=navigator.gpu.getPreferredCanvasFormat(),this.context.configure({device:r,format:this.format,alphaMode:"opaque"})),this.entries=[],this.barrels=null,this.drawSlotCapacity=kx,this.drawSlotBuffer=this.createDrawSlotBuffer(this.drawSlotCapacity),this.drawStaging=new Float32Array(this.drawSlotCapacity*Rr),this.freeDrawSlots=[],this.nextDrawSlot=0,this.globalBuffer=r.createBuffer({size:Yd,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),this.layerOffsetBuffer=r.createBuffer({size:1024,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),this.occurrenceMatrices=[[...tt]],this.occurrenceKeys=["0"],this.occurrenceHiddenLayers=[[]],this.occurrenceExplode=[null],this.identityOnly=!0,this.occurrenceCapacity=1,this.occurrenceBuffer=this.createOccurrenceBuffer(this.occurrenceCapacity),this.device.queue.writeBuffer(this.occurrenceBuffer,0,Bs(this.occurrenceMatrices)),this.barrelRecordBuffer=r.createBuffer({label:"barrel-records",size:Yi,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),this.placementBuffer=r.createBuffer({label:"component-placements",size:Zi,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),this.componentPipelineSets=new Map,this.instancedPipelines=null,this.shaderFeatures=[],this.shaderFeatureKey="",this.featurePipelineSets=new Map,this.pipelineSetKinds=new WeakMap,this.listBuffer=this.createListBuffer(this.occurrenceCapacity),this.slotCapacity=0,this.slotArgs=new Uint32Array(0),this.slotClasses=new Uint32Array(0),this.freeSlots=[],this.nextSlot=2,this.argsBuffer=null,this.classesBuffer=null,this.growSlots(256),this.setSlot(0,0,4),this.setSlot(1,0,4),this.cull=null,this.box=null,this.boardBounds=null,this.selectedOccurrence=-1,this.lodOverride=null,this.lodThresholds={...lt},this.innerCopperAtFull=!0,this.innerCopperMode="all",this.cullCounts={full:0,board:0,body:0,box:0,culled:0},this.frameStats={triangles:0,draws:0},this.boxColor=[.24,.36,.28,1],a)for(let i of["bindGroupLayout","pipelineLayout","vertexBuffers","pipeline","pickPipeline","barrelPipeline","barrelPickPipeline","singlePipelines"])this[i]=a[i];else this.createSinglePipelines();this.depth=null,this.colorTarget=null,this.pickDepth=null,this.pickTexture=null,this.insetColor=null,this.pickSerial=Promise.resolve(),this.bundleCache=new Map,this.globalScratch=new ArrayBuffer(Yd),this.globalScratchF32=new Float32Array(this.globalScratch),this.globalScratchView=new DataView(this.globalScratch),this.barrelDrawScratch=new Float32Array(bt/4),this.nextEntryId=1,this.hiddenFeatureIds=new Set,this.showPlaceholders=!0,this.hiddenBoardLayers=new Set,this.featureMaskCapacity=64,this.featureMaskBuffer=this.createFeatureMaskBuffer(this.featureMaskCapacity),this.uploadFeatureMask(),this.emphasizedNetIds=new Set,this.occurrenceEmphasis=null,this.emphasisStride=0,this.dimCopper=!1,this.netMaskCapacity=64,this.netMaskBuffer=this.createNetMaskBuffer(this.netMaskCapacity),this.uploadNetMask(),a&&this.setOccurrences([])}createSinglePipelines(){let t=this.device;this.bindGroupLayout=t.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}},{binding:1,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}},{binding:2,visibility:GPUShaderStage.VERTEX,buffer:{type:"read-only-storage"}},{binding:3,visibility:GPUShaderStage.FRAGMENT,buffer:{type:"read-only-storage"}},{binding:4,visibility:GPUShaderStage.FRAGMENT,buffer:{type:"read-only-storage"}},{binding:5,visibility:GPUShaderStage.VERTEX,buffer:{type:"read-only-storage"}},{binding:6,visibility:GPUShaderStage.VERTEX,buffer:{type:"read-only-storage"}},{binding:7,visibility:GPUShaderStage.VERTEX,buffer:{type:"read-only-storage"}},{binding:8,visibility:GPUShaderStage.VERTEX,buffer:{type:"read-only-storage"}}]});let r=t.createPipelineLayout({bindGroupLayouts:[this.bindGroupLayout]});this.pipelineLayout=r;let a=this.vertexBuffers=[{arrayStride:ro,attributes:[{shaderLocation:0,offset:0,format:"unorm16x4"},{shaderLocation:1,offset:8,format:"snorm8x4"},{shaderLocation:2,offset:12,format:"uint32"},{shaderLocation:3,offset:16,format:"uint32"}]}];this.singlePipelines=this.makePipelineSet(!1,[]),this.pipeline=this.singlePipelines.main,this.pickPipeline=this.singlePipelines.pick,this.barrelPipeline=this.singlePipelines.barrel,this.barrelPickPipeline=this.singlePipelines.barrelPick}makeMainPipelines(t,r){let a=this.pipelineLayout,s=this.vertexBuffers,n=(c,l)=>this.makePipeline(a,t,this.format,s,`${c}${r}`,l),i=n("main",{stencil:Jd}),o=n("main-blend");return{main:i,mark:this.stencil?n("main-mark",{stencil:Ex}):i,blend:o,translucent:n("main-translucent",{depthWrite:!1,cullMode:"back"}),mask:this.stencil?n("mask",{stencil:Sx}):o,maskCovered:this.stencil?n("mask-covered",{stencil:Tx,constants:{COVERED:1}}):null}}createOccurrenceBuffer(t){return this.device.createBuffer({label:"occurrences",size:t*160,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST})}createListBuffer(t){return this.device.createBuffer({label:"visible-occurrences",size:t*4*Uint32Array.BYTES_PER_ELEMENT,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST})}growSlots(t){let r=new Uint32Array(t*5);r.set(this.slotArgs);let a=new Uint32Array(t).fill(4);a.set(this.slotClasses),this.slotArgs=r,this.slotClasses=a,this.slotCapacity=t,this.argsBuffer?.destroy?.(),this.classesBuffer?.destroy?.(),this.argsBuffer=this.device.createBuffer({label:"indirect-args",size:r.byteLength,usage:GPUBufferUsage.INDIRECT|GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),this.classesBuffer=this.device.createBuffer({label:"draw-classes",size:a.byteLength,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),this.device.queue.writeBuffer(this.argsBuffer,0,r),this.device.queue.writeBuffer(this.classesBuffer,0,a),this.cull&&(this.cull.bindGroup=this.makeCullBindGroup()),this.bundleCache?.clear()}setSlot(t,r,a){this.slotArgs.fill(0,t*5,t*5+5),this.slotArgs[t*5]=r,this.slotClasses[t]=a,this.device.queue.writeBuffer(this.argsBuffer,t*20,this.slotArgs,t*5,5),this.device.queue.writeBuffer(this.classesBuffer,t*4,this.slotClasses,t,1)}allocSlot(t,r){let a=this.freeSlots.length?this.freeSlots.pop():this.nextSlot++;return a>=this.slotCapacity&&this.growSlots(this.slotCapacity*2),this.setSlot(a,t,r),a}get occurrenceCount(){return this.occurrenceMatrices.length}setOccurrences(t){let{matrices:r,keys:a,hiddenLayers:s,explode:n}=Rd(t??[tt]);this.occurrenceMatrices=r,this.occurrenceKeys=a,this.occurrenceHiddenLayers=s,this.occurrenceExplode=n,this.identityOnly=!this.alwaysInstanced&&r.length===1&&Fs(r[0]),this.identityOnly||this.ensureInstancedPipelines(),r.length>this.occurrenceCapacity&&(this.occurrenceBuffer?.destroy?.(),this.listBuffer?.destroy?.(),this.occurrenceCapacity=Math.max(r.length,this.occurrenceCapacity*2),this.occurrenceBuffer=this.createOccurrenceBuffer(this.occurrenceCapacity),this.listBuffer=this.createListBuffer(this.occurrenceCapacity),this.cull&&(this.cull.lods.destroy(),this.cull.lods=this.createLodBuffer(this.occurrenceCapacity)),this.rebindAll()),r.length&&this.device.queue.writeBuffer(this.occurrenceBuffer,0,Bs(r,s,n)),this.cull&&this.device.queue.writeBuffer(this.cull.lods,0,new Uint32Array(this.occurrenceCapacity).fill(zi)),this.selectedOccurrence>=r.length&&(this.selectedOccurrence=-1),this.bundleCache.clear(),this.invalidate()}setOccurrenceHiddenLayers(t){this.occurrenceHiddenLayers=this.occurrenceMatrices.map((r,a)=>[...t?.[a]||[]].map(Number)),this.writeOccurrenceRecords()}setOccurrenceExplode(t){this.occurrenceExplode=this.occurrenceMatrices.map((r,a)=>t?.[a]?[...t[a]].map(Number):null),this.writeOccurrenceRecords()}writeOccurrenceRecords(){this.occurrenceMatrices.length&&this.device.queue.writeBuffer(this.occurrenceBuffer,0,Bs(this.occurrenceMatrices,this.occurrenceHiddenLayers,this.occurrenceExplode)),this.invalidate()}setInnerCopperMode(t){this.setInnerCopperAtFull(!1),this.innerCopperMode!==t&&(this.innerCopperMode=t,this.invalidate())}setInnerCopperAtFull(t){if(this.innerCopperAtFull!==t){this.innerCopperAtFull=t;for(let r of this.entries)r.innerCopper&&(r.drawClass=eu(r,t),this.setSlot(r.slot,r.indexCount,r.drawClass));this.invalidate()}}setBoardBounds(t){this.boardBounds=t?[...t]:null,this.invalidate()}setLodThresholds(t){this.lodThresholds=Ir({...this.lodThresholds,...t}),this.invalidate()}setAnalytic(t){this.analytic&&this.analytic!==t&&this.analytic.destroy(),this.analytic=t||null,this.bundleCache.clear(),this.invalidate()}setLodOverride(t){this.lodOverride=t==null?null:Number(t),this.invalidate()}createLodBuffer(t){return this.device.createBuffer({label:"occurrence-lods",size:t*Uint32Array.BYTES_PER_ELEMENT,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST})}createCull(){let t=this.device,r=this.shareFrom?.cull,a=i=>({visibility:GPUShaderStage.COMPUTE,buffer:{type:i}}),s=r?.layout||t.createBindGroupLayout({label:"cull",entries:[{binding:0,visibility:GPUShaderStage.COMPUTE,buffer:{type:"uniform"}},{binding:1,...a("read-only-storage")},{binding:2,...a("storage")},{binding:3,...a("storage")},{binding:4,...a("storage")},{binding:5,...a("storage")},{binding:6,...a("read-only-storage")}]}),n=r&&{layout:s,classify:r.classify,writeArgs:r.writeArgs};if(!n){let i=this.createShaderModule(lo,"cull"),o=t.createPipelineLayout({bindGroupLayouts:[s]});n={layout:s,classify:t.createComputePipeline({layout:o,compute:{module:i,entryPoint:"classify"}}),writeArgs:t.createComputePipeline({layout:o,compute:{module:i,entryPoint:"writeArgs"}})}}this.cull={...n,uniform:t.createBuffer({label:"cull-params",size:192,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),lods:this.createLodBuffer(this.occurrenceCapacity),counters:t.createBuffer({label:"cull-counters",size:16,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST}),readback:t.createBuffer({label:"cull-readback",size:16,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}),scratch:new ArrayBuffer(192),reading:!1,readAt:0,bindGroup:null},t.queue.writeBuffer(this.cull.lods,0,new Uint32Array(this.occurrenceCapacity).fill(zi)),this.cull.bindGroup=this.makeCullBindGroup()}makeCullBindGroup(){return this.device.createBindGroup({layout:this.cull.layout,entries:[{binding:0,resource:{buffer:this.cull.uniform}},{binding:1,resource:{buffer:this.occurrenceBuffer}},{binding:2,resource:{buffer:this.cull.lods}},{binding:3,resource:{buffer:this.listBuffer}},{binding:4,resource:{buffer:this.cull.counters}},{binding:5,resource:{buffer:this.argsBuffer}},{binding:6,resource:{buffer:this.classesBuffer}}]})}createBox(){let t=[[[1,0,0],[[1,0,0],[1,1,0],[1,1,1],[1,0,1]]],[[-1,0,0],[[0,0,0],[0,0,1],[0,1,1],[0,1,0]]],[[0,1,0],[[0,1,0],[0,1,1],[1,1,1],[1,1,0]]],[[0,-1,0],[[0,0,0],[1,0,0],[1,0,1],[0,0,1]]],[[0,0,1],[[0,0,1],[1,0,1],[1,1,1],[0,1,1]]],[[0,0,-1],[[0,0,0],[0,1,0],[1,1,0],[1,0,0]]]],r=[],a=[];t.forEach(([l,f],d)=>{for(let b of f)r.push(...b,...l);let p=d*4;a.push(p,p+1,p+2,p,p+2,p+3)});let s=new Float32Array(r),n=new Uint16Array(a),i=this.device.createBuffer({label:"box-vertices",size:s.byteLength,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST}),o=this.device.createBuffer({label:"box-indices",size:n.byteLength,usage:GPUBufferUsage.INDEX|GPUBufferUsage.COPY_DST});this.device.queue.writeBuffer(i,0,s),this.device.queue.writeBuffer(o,0,n);let c=this.device.createBuffer({size:bt,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});this.box={vertexBuffer:i,indexBuffer:o,indexCount:n.length,drawBuffer:c,bindGroup:this.makeBindGroup(c),scratch:new Float32Array(bt/4)},this.setSlot(1,n.length,3)}writeBoxDraw(){let t=this.box.scratch,[r,a,s,n,i,o]=this.boardBounds;t.fill(0),t.set(this.boxColor,0),t.set([n-r,i-a,o-s,0],4),t.set([r,a,s,0],8),this.device.queue.writeBuffer(this.box.drawBuffer,0,t)}encodeCull(t,r){let a=this.cull,s=new Float32Array(a.scratch),n=new Uint32Array(a.scratch);s.fill(0),Cd(r.matrix).forEach((u,m)=>s.set(u,m*4));let i=r.lod;i&&s.set([...i.eye,i.orthographic?0:1],24);let o=this.boardBounds||[-1e6,-1e6,-1e6,1e6,1e6,1e6];s.set([o[0],o[1],o[2],0,o[3],o[4],o[5],0],28);let{fullPx:c,boardPx:l,boxPx:f,keep:d}=this.lodThresholds;s.set([i?.pixelScale||0,c,f,d],36);let p=this.lodOverride!=null?this.lodOverride+1:!i||!this.boardBounds?Ps+1:0;n.set([this.occurrenceMatrices.length,this.selectedOccurrence+1,p,this.nextSlot],40),n[44]=this.barrels?.instanceCount||0,s[45]=l,this.device.queue.writeBuffer(a.uniform,0,a.scratch),t.clearBuffer(a.counters);let b=t.beginComputePass({label:"cull"});b.setBindGroup(0,a.bindGroup),b.setPipeline(a.classify),b.dispatchWorkgroups(Math.ceil(this.occurrenceMatrices.length/64)),b.setPipeline(a.writeArgs),b.dispatchWorkgroups(Math.ceil(this.nextSlot/64)),b.end();let h=performance.now();return!a.reading&&h-a.readAt>250?(t.copyBufferToBuffer(a.counters,0,a.readback,0,16),a.readAt=h,!0):!1}readCullCounts(){let t=this.cull;t.reading=!0;let r=this.occurrenceMatrices.length;t.readback.mapAsync(GPUMapMode.READ).then(()=>{let[a,s,n,i]=new Uint32Array(t.readback.getMappedRange().slice(0));t.readback.unmap(),this.cullCounts={full:a,board:s-a,body:n-s,box:i,culled:Math.max(0,r-n-i)}}).catch(()=>{}).finally(()=>{t.reading=!1})}countFor(t){if(this.identityOnly)return t===2?this.barrels?.instanceCount||0:t===3?0:1;let{full:r,board:a,body:s,box:n}=this.cullCounts;return t===5?r+a+s:t===0?r+a:t===1?r:t===2?(r+a)*(this.barrels?.instanceCount||0):n}gpuMemoryBytes(){let t=0;for(let r of this.entries)t+=(r.vertexAllocation?.size||0)+(r.indexAllocation?.size||0);this.shareFrom||(t+=this.arenaSlackBytes());for(let r of[this.barrels?.vertexBuffer,this.barrels?.indexBuffer,this.barrels?.instanceBuffer,this.barrelRecordBuffer,this.occurrenceBuffer,this.listBuffer,this.argsBuffer,this.classesBuffer,this.featureMaskBuffer,this.netMaskBuffer,this.cull?.lods])t+=r?.size||0;return t+=this.analytic?.gpuMemoryBytes()||0,t+=this.canvas.width*this.canvas.height*12,t}gpuMemoryBreakdown(){let t={},r=0,a=0;for(let c of this.entries){let l=c.vertexAllocation?.size||0,f=c.indexAllocation?.size||0;r+=l,a+=f;let d=c.kind==="copper"?`copper:${c.layerId??"?"}`:c.boardRole?`${c.kind}:${c.boardRole}`:c.kind||"other";t[d]=(t[d]||0)+l+f}let s=[this.barrels?.vertexBuffer,this.barrels?.indexBuffer,this.barrels?.instanceBuffer,this.barrelRecordBuffer].reduce((c,l)=>c+(l?.size||0),0),n=[this.occurrenceBuffer,this.listBuffer,this.argsBuffer,this.classesBuffer,this.featureMaskBuffer,this.netMaskBuffer,this.cull?.lods].reduce((c,l)=>c+(l?.size||0),0),i=this.shareFrom?null:this.arenaStats(),o=this.analytic?.gpuMemoryBytes()||0;return{vertex:r,index:a,geometry:t,barrels:s,occurrences:n,analytic:o,targets:this.canvas.width*this.canvas.height*12,entries:this.entries.length,arena:i}}ensureInstancedPipelines(){if(!this.instancedPipelines){if(this.shareFrom){this.shareFrom.ensureInstancedPipelines(),this.instancedPipelines=this.shareFrom.instancedPipelines,this.createBox(),this.createCull();return}this.instancedPipelines=this.makePipelineSet(!0,[]),this.createBox(),this.createCull()}}makePipelineSet(t,r){let a=this.pipelineLayout,s=Vi(r),n=l=>eo(l,t,r),i=s?`+${s}`:"",o=`${t?"-instanced":""}${i}`,c={...this.makeMainPipelines(n("main"),o),pick:this.makePipeline(a,n("pick"),er,this.vertexBuffers,`pick${o}`),barrel:this.makeBarrelPipeline(a,n("barrel"),this.format,`barrel${o}`,!t),barrelPick:this.makeBarrelPipeline(a,n("barrelPick"),er,`barrel-pick${o}`,!t)};return t&&(c.box=this.makePipeline(a,n("box"),this.format,Zd,`box${i}`),c.boxPick=this.makePipeline(a,n("boxPick"),er,Zd,`box-pick${i}`)),this.pipelineSetKinds.set(c,{instanced:t,features:ha(r),key:s}),c}setShaderFeatures(t=[]){let r=ha(t),a=Vi(r);a!==this.shaderFeatureKey&&(this.shaderFeatures=r,this.shaderFeatureKey=a,this.bundleCache.clear(),this.invalidate())}pipelinesFor(t){let r=this.shareFrom||this;if(t&&this.ensureInstancedPipelines(),!this.shaderFeatureKey)return t?r.instancedPipelines:r.singlePipelines;let a=`${t?"instanced":"single"}|${this.shaderFeatureKey}`,s=r.featurePipelineSets.get(a);return s||(s=r.makePipelineSet(t,this.shaderFeatures),r.featurePipelineSets.set(a,s)),s}drawSet(){return this.identityOnly?{pipelines:this.pipelinesFor(!1),indirect:!1,barrelInstances:this.barrels?.instanceCount||0}:{pipelines:this.pipelinesFor(!0),indirect:!0,barrelInstances:0}}drawEntry(t,r,a){t.setBindGroup(0,r.bindGroup);let s=r.vertexAllocation,n=r.indexAllocation;t.setVertexBuffer(0,s.buffer,s.offset,s.size),t.setIndexBuffer(n.buffer,r.indexFormat,n.offset,n.size),a?t.drawIndexedIndirect(this.argsBuffer,r.slot*20):t.drawIndexed(r.indexCount,r.placementCount||1)}drawBarrels(t,r,a,s){t.setPipeline(r),t.setBindGroup(0,this.barrels.bindGroup),t.setVertexBuffer(0,this.barrels.vertexBuffer),t.setVertexBuffer(1,this.barrels.instanceBuffer),t.setIndexBuffer(this.barrels.indexBuffer,"uint16"),a?t.drawIndexedIndirect(this.argsBuffer,0):t.drawIndexed(this.barrels.indexCount,s)}drawBox(t,r){!this.box||!this.boardBounds||(this.writeBoxDraw(),t.setPipeline(r),t.setBindGroup(0,this.box.bindGroup),t.setVertexBuffer(0,this.box.vertexBuffer),t.setIndexBuffer(this.box.indexBuffer,"uint16"),t.drawIndexedIndirect(this.argsBuffer,20))}createNetMaskBuffer(t){return this.device.createBuffer({label:"net-emphasis-mask",size:t*Uint32Array.BYTES_PER_ELEMENT,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST})}uploadNetMask(){let t;if(this.occurrenceEmphasis&&!this.identityOnly){let a=fl(this.occurrenceEmphasis);this.emphasisStride=a.stride,t=a.data}else this.emphasisStride=0,t=cl(this.emphasizedNetIds,this.netMaskCapacity);if(t.length>this.netMaskCapacity){this.netMaskBuffer?.destroy?.();let a=this.netMaskCapacity;for(;a<t.length;)a*=2;this.netMaskCapacity=a,this.netMaskBuffer=this.createNetMaskBuffer(a),this.rebindAll()}let r=new Uint32Array(this.netMaskCapacity);r.set(t),this.device.queue.writeBuffer(this.netMaskBuffer,0,r)}setOccurrenceEmphasis(t,{dimCopper:r=!1}={}){let a=Array.isArray(t)&&t.some(s=>s&&s.size);this.occurrenceEmphasis=a?t.map(s=>s&&s.size?new Map(s):null):null,this.dimCopper=!!r,this.uploadNetMask(),this.invalidate()}get netHighlightActive(){return!!(this.emphasizedNetIds.size||this.occurrenceEmphasis||this.dimCopper)}setEmphasizedNetIds(t){this.emphasizedNetIds=ps(t),this.occurrenceEmphasis=null;let r=ol(this.emphasizedNetIds,this.netMaskCapacity);r!==this.netMaskCapacity&&(this.netMaskBuffer?.destroy?.(),this.netMaskCapacity=r,this.netMaskBuffer=this.createNetMaskBuffer(r),this.rebindAll()),this.uploadNetMask(),this.invalidate()}rebindAll(){for(let t of this.entries)t.bindGroup=this.makeBindGroup(this.drawSlotBuffer,t.drawSlot*bt);this.barrels&&(this.barrels.bindGroup=this.makeBindGroup(this.barrels.drawBuffer)),this.box&&(this.box.bindGroup=this.makeBindGroup(this.box.drawBuffer)),this.cull&&(this.cull.bindGroup=this.makeCullBindGroup()),this.bundleCache.clear()}createFeatureMaskBuffer(t){return this.device.createBuffer({label:"feature-visibility-mask",size:t*Uint32Array.BYTES_PER_ELEMENT,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST})}createDrawSlotBuffer(t){return this.device.createBuffer({label:"draw-uniforms",size:t*bt,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST})}allocateDrawSlot(){if(this.freeDrawSlots.length)return this.freeDrawSlots.pop();if(this.nextDrawSlot>=this.drawSlotCapacity){let t=this.drawSlotCapacity*2,r=new Float32Array(t*Rr);r.set(this.drawStaging),this.drawSlotBuffer.destroy?.(),this.drawSlotCapacity=t,this.drawSlotBuffer=this.createDrawSlotBuffer(t),this.drawStaging=r,this.rebindAll()}return this.nextDrawSlot++}flushDraws(t){if(!t.length)return;let r=1/0,a=-1;for(let s of t)r=Math.min(r,s.drawSlot),a=Math.max(a,s.drawSlot);this.device.queue.writeBuffer(this.drawSlotBuffer,r*bt,this.drawStaging,r*Rr,(a-r+1)*Rr)}invalidate(){this.version+=1}setBarrelColor(t){this.barrelColor=[...t],this.invalidate()}makeBindGroup(t,r=0){return this.device.createBindGroup({layout:this.bindGroupLayout,entries:[{binding:0,resource:{buffer:this.globalBuffer}},{binding:1,resource:{buffer:t,offset:r,size:bt}},{binding:2,resource:{buffer:this.layerOffsetBuffer}},{binding:3,resource:{buffer:this.featureMaskBuffer}},{binding:4,resource:{buffer:this.netMaskBuffer}},{binding:5,resource:{buffer:this.occurrenceBuffer}},{binding:6,resource:{buffer:this.barrelRecordBuffer}},{binding:7,resource:{buffer:this.listBuffer}},{binding:8,resource:{buffer:this.placementBuffer}}]})}uploadFeatureMask(){let t=jd(this.hiddenFeatureIds,this.featureMaskCapacity);this.device.queue.writeBuffer(this.featureMaskBuffer,0,t)}setHiddenFeatureIds(t){this.hiddenFeatureIds=js(t);let r=Pd(this.hiddenFeatureIds,this.featureMaskCapacity);r!==this.featureMaskCapacity&&(this.featureMaskBuffer?.destroy?.(),this.featureMaskCapacity=r,this.featureMaskBuffer=this.createFeatureMaskBuffer(r),this.rebindAll()),this.uploadFeatureMask(),this.bundleCache.clear(),this.invalidate()}depthStencilState(t=null,r=!0){let a={format:this.depthFormat,depthWriteEnabled:r,depthCompare:"greater"};return this.stencil&&t&&(a.stencilFront=t,a.stencilBack=t),a}makePipeline(t,r,a,s,n,i={}){let o=this.createShaderModule(r,n);return this.device.createRenderPipeline({layout:t,vertex:{module:o,entryPoint:"vs",buffers:s},fragment:{module:o,entryPoint:"fs",...i.constants?{constants:i.constants}:{},targets:[{format:a,blend:a===er?void 0:{color:{srcFactor:"src-alpha",dstFactor:"one-minus-src-alpha"},alpha:{srcFactor:"one",dstFactor:"one-minus-src-alpha"}}}]},primitive:{topology:"triangle-list",cullMode:i.cullMode??"none"},depthStencil:this.depthStencilState(i.stencil,i.depthWrite??!0),multisample:{count:this.samplesFor(a)}})}makeBarrelPipeline(t,r,a,s,n=!0){let i=this.createShaderModule(r,s);return this.device.createRenderPipeline({layout:t,vertex:{module:i,entryPoint:"vs",buffers:[{arrayStride:28,attributes:[{shaderLocation:0,offset:0,format:"float32x3"},{shaderLocation:1,offset:12,format:"float32x3"},{shaderLocation:2,offset:24,format:"float32"}]},...n?[Dd]:[]]},fragment:{module:i,entryPoint:"fs",targets:[{format:a,blend:a===er?void 0:{color:{srcFactor:"src-alpha",dstFactor:"one-minus-src-alpha"},alpha:{srcFactor:"one",dstFactor:"one-minus-src-alpha"}}}]},primitive:{topology:"triangle-list",cullMode:"none"},depthStencil:this.depthStencilState(),multisample:{count:this.samplesFor(a)}})}samplesFor(t){return t===er?1:this.sampleCount}createShaderModule(t,r){let a=this.device.createShaderModule({label:`pcb-${r}`,code:t});return typeof a.getCompilationInfo=="function"&&a.getCompilationInfo().then(s=>{let n=[...s.messages||[]];if(n.length){console.groupCollapsed(`WebGPU shader compilation info: pcb-${r}`);for(let i of n)console[i.type==="error"?"error":"warn"](`${i.type} ${i.lineNum}:${i.linePos} ${i.message}`);console.groupEnd()}}),a}resize(){let t=Math.min(devicePixelRatio||1,2),r=Math.max(1,Math.floor(this.canvas.clientWidth*t)),a=Math.max(1,Math.floor(this.canvas.clientHeight*t));if(this.canvas.width===r&&this.canvas.height===a)return;this.canvas.width=r,this.canvas.height=a,this.depth?.destroy(),this.colorTarget?.destroy(),this.pickDepth?.destroy(),this.pickTexture?.destroy();let s=this.sampleCount;this.depth=this.device.createTexture({label:"depth",size:[r,a],format:this.depthFormat,sampleCount:s,usage:GPUTextureUsage.RENDER_ATTACHMENT}),this.colorTarget=s>1?this.device.createTexture({label:"color-msaa",size:[r,a],format:this.format,sampleCount:s,usage:GPUTextureUsage.RENDER_ATTACHMENT}):null,this.pickDepth=s>1?this.device.createTexture({label:"pick-depth",size:[r,a],format:this.depthFormat,usage:GPUTextureUsage.RENDER_ATTACHMENT}):this.depth,this.pickTexture=this.device.createTexture({size:[r,a],format:er,usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.COPY_SRC})}addPrimitive(t,r){let a=t.position.length/3,s=new ArrayBuffer(a*ro),n=new Uint32Array(s),i=new Uint16Array(s),o=new Int8Array(s),c=Fx(t.position);for(let y=0;y<a;y+=1){let x=y*5,v=y*3;Px(i,x*2,t.position,v,c),jx(o,(x+2)*4,t.normal,v),n[x+3]=t.netId[y]||0,n[x+4]=t.objectFeatureId[y]||0}let l=this.arenas(),f=l.vertex.alloc(s.byteLength);l.vertex.write(f,s);let{indices:d,format:p}=Lx(t.indices,a),b=l.index.alloc(d.byteLength);l.index.write(b,d);let h=this.allocateDrawSlot(),u=this.makeBindGroup(this.drawSlotBuffer,h*bt),m=eu(r,this.innerCopperAtFull),g={...r,drawClass:m,slot:this.allocSlot(t.indices.length,r.placements?Cx|r.placements<<3:m),placementCount:r.placements||0,placementBase:0,bounds:t.bounds||r.bounds||null,id:this.nextEntryId++,vertexAllocation:f,indexAllocation:b,quantMin:c.min,quantSize:c.size,indexFormat:p,indexCount:t.indices.length,drawSlot:h,bindGroup:u};return this.entries.push(g),this.bundleCache.clear(),this.invalidate(),g}arenas(){let t=this.shareFrom||this;return t.geometryArenas??={vertex:new fa(t.device,GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST,"geometry-vertices"),index:new fa(t.device,GPUBufferUsage.INDEX|GPUBufferUsage.COPY_DST,"geometry-indices")},t.geometryArenas}arenaSlackBytes(){let t=this.geometryArenas;return t?t.vertex.reservedBytes()-t.vertex.usedBytes+t.index.reservedBytes()-t.index.usedBytes:0}arenaStats(){let t=this.geometryArenas;if(!t)return{chunks:0,reserved:0,used:0};let r=a=>a.chunks.reduce((s,n)=>s+n.free.filter(i=>i.offset+i.size<n.size).reduce((i,o)=>i+o.size,0),0);return{chunks:t.vertex.chunks.length+t.index.chunks.length,reserved:t.vertex.reservedBytes()+t.index.reservedBytes(),used:t.vertex.usedBytes+t.index.usedBytes,holes:r(t.vertex)+r(t.index)}}componentPipelines(t){let r=this.shareFrom||this,a=r.componentPipelineSets.get(t);if(!a){let{instanced:s,features:n,key:i}=r.pipelineSetKinds.get(t),o=r.pipelineLayout,c=r.vertexBuffers,l=eo("component",s,n),f=eo("componentPick",s,n),d=`${s?"-instanced":""}${i?`+${i}`:""}`;a={main:r.makePipeline(o,l,r.format,c,`component${d}`,{stencil:Jd}),blend:r.makePipeline(o,l,r.format,c,`component-blend${d}`),pick:r.makePipeline(o,f,er,c,`component-pick${d}`)},r.componentPipelineSets.set(t,a)}return a}addInstancedPrimitives(t){let r=t.map(({primitive:a,placements:s,metadata:n})=>{let i=this.addPrimitive(a,{...n,placements:s.length});return i.placementRecords=s,i});return this.writePlacements(),r}writePlacements(){let t=this.entries.filter(o=>o.placementRecords),r=t.reduce((o,c)=>o+c.placementRecords.length,0),a=new ArrayBuffer(Math.max(1,r)*Zi),s=new Float32Array(a),n=new Uint32Array(a),i=0;for(let o of t){o.placementBase=i;for(let c of o.placementRecords){let l=i*(Zi/4);s.set(c.rows,l),n[l+12]=c.featureId||0,i+=1}}this.placementBuffer.size<a.byteLength&&(this.placementBuffer.destroy?.(),this.placementBuffer=this.device.createBuffer({label:"component-placements",size:a.byteLength,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),this.rebindAll()),this.device.queue.writeBuffer(this.placementBuffer,0,a),this.invalidate()}removeEntries(t){if(!t?.length)return;let r=new Set(t.map(a=>a.id));for(let a of t){let s=this.arenas();a.vertexAllocation&&s.vertex.free(a.vertexAllocation),a.indexAllocation&&s.index.free(a.indexAllocation),this.freeDrawSlots.push(a.drawSlot),a.slot!=null&&(this.setSlot(a.slot,0,4),this.freeSlots.push(a.slot))}this.entries=this.entries.filter(a=>!r.has(a.id)),t.some(a=>a.placementRecords)&&this.writePlacements(),this.bundleCache.clear(),this.invalidate()}dispose(){this.removeEntries(this.entries),this.shareFrom||(this.geometryArenas?.vertex.destroy(),this.geometryArenas?.index.destroy(),this.geometryArenas=null),this.barrels&&(this.barrels.vertexBuffer?.destroy?.(),this.barrels.indexBuffer?.destroy?.(),this.barrels.instanceBuffer?.destroy?.(),this.barrels.drawBuffer?.destroy?.(),this.barrels=null),this.depth?.destroy(),this.colorTarget?.destroy(),this.pickDepth!==this.depth&&this.pickDepth?.destroy(),this.insetColor?.texture.destroy(),this.pickTexture?.destroy(),this.featureMaskBuffer?.destroy?.(),this.occurrenceBuffer?.destroy?.(),this.barrelRecordBuffer?.destroy?.(),this.listBuffer?.destroy?.(),this.argsBuffer?.destroy?.(),this.classesBuffer?.destroy?.();for(let t of[this.box?.vertexBuffer,this.box?.indexBuffer,this.box?.drawBuffer,this.cull?.uniform,this.cull?.lods,this.cull?.counters,this.cull?.readback])t?.destroy?.();this.box=null,this.cull=null,this.drawSlotBuffer?.destroy?.(),this.depth=null,this.colorTarget=null,this.pickDepth=null,this.insetColor=null,this.pickTexture=null,this.featureMaskBuffer=null,this.bundleCache.clear()}setBarrels(t){if(!t?.length)return;let r=ru,a=[],s=[],n=(u,m,g)=>{let y=a.length/7;for(let x=0;x<r;x+=1){let v=Math.PI*2*(x+.5)/r,E=Math.cos(v),S=Math.sin(v),[T,_,I]=g(E,S);a.push(E,S,m,T,_,I,u)}return y},i=(u,m)=>{for(let g=0;g<r;g+=1){let y=(g+1)%r;s.push(u+g,u+y,m+y,u+g,m+y,m+g)}};for(let u of[0,1]){let m=u?(g,y)=>[-g,-y,0]:(g,y)=>[g,y,0];i(n(u,0,m),n(u,1,m))}for(let[u,m]of[[0,1],[1,-1]]){let g=()=>[0,0,m];i(n(0,u,g),n(2,u,g))}let o=new Float32Array(a),c=new Uint16Array(s),l=zd(t),f=this.device.createBuffer({size:o.byteLength,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST}),d=this.device.createBuffer({size:c.byteLength,usage:GPUBufferUsage.INDEX|GPUBufferUsage.COPY_DST}),p=this.device.createBuffer({size:l.byteLength,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST});this.device.queue.writeBuffer(f,0,o),this.device.queue.writeBuffer(d,0,c),this.device.queue.writeBuffer(p,0,l);let b=Kd(t);this.barrelRecordBuffer?.destroy?.(),this.barrelRecordBuffer=this.device.createBuffer({label:"barrel-records",size:b.byteLength,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),this.device.queue.writeBuffer(this.barrelRecordBuffer,0,b);let h=this.device.createBuffer({size:bt,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});this.barrels={records:t,vertexBuffer:f,indexBuffer:d,instanceBuffer:p,indexCount:c.length,instanceCount:t.length,drawBuffer:h,bindGroup:null},this.setSlot(0,c.length,2),this.rebindAll(),this.invalidate()}render(t){let{panels:r,layerOffsets:a}=t;this.resize(),this.device.queue.writeBuffer(this.layerOffsetBuffer,0,a);let s=this.context.getCurrentTexture().createView(),n=0,i=0;r.forEach((o,c)=>{let l=this.device.createCommandEncoder(),f=!this.identityOnly&&this.encodeCull(l,o),d=l.beginRenderPass({colorAttachments:[this.colorAttachment(s,c===0,c===r.length-1)],depthStencilAttachment:this.depthAttachment()}),p=to(o.viewport,this.canvas.width,this.canvas.height);d.setViewport(p.x,p.y,p.width,p.height,0,1),d.setScissorRect(p.x,p.y,p.width,p.height);let b=this.encodeDraws(d,o,t);n+=b.triangles,i+=b.draws,d.end(),this.device.queue.submit([l.finish()]),f&&this.readCullCounts()}),this.frameStats={triangles:Math.round(n),draws:i}}renderInto(t,r,a){if(!this.identityOnly)throw new Error("renderInto: one-board renderer only");let s=this.device.createCommandEncoder({label:"inset"}),n={view:t.depthView,depthClearValue:0,depthLoadOp:"clear",depthStoreOp:"discard"};this.stencil&&Object.assign(n,{stencilClearValue:0,stencilLoadOp:"clear",stencilStoreOp:"discard"});let i=s.beginRenderPass({colorAttachments:[this.colorAttachment(t.colorView,!0,!0,this.insetColorView(t.width,t.height))],depthStencilAttachment:n}),o=to(r.viewport,t.width,t.height);i.setViewport(o.x,o.y,o.width,o.height,0,1),i.setScissorRect(o.x,o.y,o.width,o.height);let c=this.encodeDraws(i,r,a);return i.end(),this.device.queue.submit([s.finish()]),c}encodeDraws(t,r,{activeNetId:a,selectedFeatureId:s,time:n,visibleLayers:i,showBoard:o,showComponents:c,showPaste:l=!0,componentOpacity:f,boardOpacity:d,isolateNet:p,compareMode:b=!1,compareOffsets:h=new Map,layerAlphas:u=null,visibleTileIds:m=null,layerOffsets:g=null}){let y=0,x=0,v=null;if(this.stencil&&t.setStencilReference(1),this.writeGlobals(r.matrix,a,r.layerId,n,s),this.relief?.ready&&!b)return{triangles:this.relief.vertexCount/3,draws:this.relief.encode(t,r.matrix)};let{pipelines:E,indirect:S,barrelInstances:T}=this.drawSet(),_=!l||!!(a||this.netHighlightActive),I=this.entries.filter(B=>this.visible(B,r.layerId,i,o,c,f,b,m)&&!(_&&B.boardRole==="paste")&&!(B.side&&this.hiddenBoardLayers?.has(`${B.boardRole}:${B.side}`))),N=I.filter(B=>!Us(B)).sort((B,R)=>+!!B.stencilMark-+!!R.stencilMark),C=I.filter(B=>Us(B)).sort((B,R)=>Us(B)-Us(R));for(let B of I)this.writeDraw(B,a,f,d,p,b,h.get(B.layerId),u?.get(B.layerId)??1);this.flushDraws(I),N.length>64?t.executeBundles([this.renderBundle(N,r.layerId)]):this.drawEntries(t,N,E,S);for(let B of I)y+=B.indexCount/3*this.countFor(B.drawClass)*(B.placementCount||1);return x+=I.length,this.analytic&&!b&&(v={matrix:r.matrix,showBoard:o,boardOpacity:d,hidePaste:_,isolateNet:p,panelLayer:r.layerId,assemblyOpacity:l?1:f,hiddenBoardLayers:this.hiddenBoardLayers},x+=this.analytic.encodeInto(t,g,r.layerId?new Set([r.layerId]):i,!1,v),x+=this.analytic.encodeBarrels(t,g,r.matrix),x+=this.analytic.encodeArrows(t)),!b&&this.barrels&&!this.analytic?.hasBarrels()&&(r.layerId===0||i.has(r.layerId))&&(this.writeBarrelDraw(p),this.drawBarrels(t,E.barrel,S,T),y+=this.barrels.indexCount/3*this.countFor(2),x+=1),S&&!b&&(this.drawBox(t,E.box),y+=12*this.countFor(3),x+=1),v&&(x+=this.analytic.encodeBlended(t,g,r.layerId?new Set([r.layerId]):i,v)),this.drawBlended(t,C,E,S),{triangles:y,draws:x}}colorAttachment(t,r=!0,a=!0,s=this.colorTarget?.createView()){let n={view:t,clearValue:{r:.91,g:.93,b:.94,a:1},loadOp:r?"clear":"load",storeOp:"store"};return this.sampleCount===1?n:{...n,view:s,resolveTarget:t,storeOp:a?"discard":"store"}}insetColorView(t,r){if(this.sampleCount!==1){if(this.insetColor?.width!==t||this.insetColor?.height!==r){this.insetColor?.texture.destroy();let a=this.device.createTexture({label:"inset-msaa",size:[t,r],format:this.format,sampleCount:this.sampleCount,usage:GPUTextureUsage.RENDER_ATTACHMENT});this.insetColor={texture:a,view:a.createView(),width:t,height:r}}return this.insetColor.view}}depthAttachment(t=!1){let r={view:(t?this.pickDepth:this.depth).createView(),depthClearValue:0,depthLoadOp:"clear",depthStoreOp:"discard"};return this.stencil&&Object.assign(r,{stencilClearValue:0,stencilLoadOp:"clear",stencilStoreOp:"discard"}),r}drawEntries(t,r,a,s){let n=null;for(let i of r){let o=i.placementCount?this.componentPipelines(a).main:i.stencilMark?a.mark:a.main;o!==n&&(t.setPipeline(o),n=o),this.drawEntry(t,i,s)}}drawBlended(t,r,a,s){for(let n of r)if(n.boardRole==="soldermask"&&n.kind==="board")t.setPipeline(a.mask),this.drawEntry(t,n,s),a.maskCovered&&(t.setPipeline(a.maskCovered),this.drawEntry(t,n,s));else{let i=n.translucent?a.translucent??a.blend:a.blend;t.setPipeline(n.placementCount?this.componentPipelines(a).blend:i),this.drawEntry(t,n,s)}}setPlaceholdersVisible(t){this.showPlaceholders=!!t,this.invalidate()}setHiddenBoardLayers(t){this.hiddenBoardLayers=new Set(t||[]),this.invalidate()}visible(t,r,a,s,n,i,o=!1,c=null){return t.placeholder&&!this.showPlaceholders?!1:o?t.kind==="copper"&&a.has(t.layerId):t.kind==="copper"&&this.analytic?.coversLayer(t.layerId)||t.kind==="board"&&this.analytic?.coversRole(t.boardRole)||t.kind==="board"&&t.boardRole==="pad"||t.kind==="copper"&&c&&!c.has(t.tileId)||t.innerCopper&&this.innerCopperMode==="none"?!1:t.boardRole==="paste"?r===0&&a.has(t.layerId):t.kind==="board"?r===0&&s:t.kind==="component"?r===0&&n&&i>.001:r?t.layerId===r:a.has(t.layerId)}writeGlobals(t,r,a,s,n=0){let i=this.globalScratch,o=this.globalScratchF32;o.fill(0),o.set(t,0);let c=this.globalScratchView;c.setUint32(64,r||0,!0),c.setUint32(68,a||0,!0),c.setFloat32(72,s,!0),c.setFloat32(76,r||this.netHighlightActive?1:0,!0),c.setUint32(80,n||0,!0),c.setUint32(84,this.selectedOccurrence>=0?this.selectedOccurrence+1+this.occurrenceBase:0,!0),c.setUint32(88,this.occurrenceBase,!0),c.setUint32(92,this.emphasisStride,!0),o.set([.35,-.5,.8,0],24),this.device.queue.writeBuffer(this.globalBuffer,0,i)}writeDraw(t,r,a,s=1,n=!1,i=!1,o=null,c=1){let l=this.drawStaging.subarray(t.drawSlot*Rr,(t.drawSlot+1)*Rr);l.fill(0);let f=t.color||t.material.baseColor;l.set(f,0),l.set([t.material.metallic||0,t.material.roughness??.72,t.opacityScale!=null?a:0,Ox[t.drawClass]??1],4);let d=Ux(t);l.set([o?.[0]||0,o?.[1]||0,(i?-(t.baseZ||0):t.layerOffset||0)+d,t.kind==="copper"||t.boardRole==="paste"?Number(t.layerId||0)+1:0],8);let p=Number.isFinite(f?.[3])?f[3]:1,b=t.kind==="component"?a*(t.opacityScale??1):t.kind==="board"&&t.boardRole!=="paste"?s*Dx(t,p):c,h=t.kind==="copper"?1:t.kind==="component"?2:0,u=n?1:t.innerCopper&&this.innerCopperMode==="lit"?2:0;if(l.set([h,b,u,i?1:0],12),t.placementCount){let m=new Uint32Array(l.buffer,l.byteOffset+64,2);m[0]=t.placementBase,m[1]=t.placementCount}l.set(t.quantMin,20),l.set(t.quantSize,24)}writeBarrelDraw(t=!1){let r=this.barrelDrawScratch;r.fill(0),r.set(this.barrelColor,0),r.set([.75,.32,0,0],4),r.set([1,1,t?1:0,0],12),this.device.queue.writeBuffer(this.barrels.drawBuffer,0,r)}renderBundle(t,r){let{pipelines:a,indirect:s}=this.drawSet(),{vertex:n,index:i}=this.arenas(),o=`${r}:${s?"indirect":"single"}:${this.shaderFeatureKey}:${n.generation}.${i.generation}:${t.map(d=>d.id).join(",")}`,c=this.bundleCache.get(o);if(c)return c;let l=this.device.createRenderBundleEncoder({colorFormats:[this.format],depthStencilFormat:this.depthFormat,sampleCount:this.sampleCount});this.drawEntries(l,t,a,s);let f=l.finish();return this.bundleCache.set(o,f),this.bundleCache.size>32&&this.bundleCache.delete(this.bundleCache.keys().next().value),f}pick(t,r,a,s){let n=this.pickSerial.then(()=>this.performPick(t,r,a,s));return this.pickSerial=n.catch(()=>0),n}async performPick(t,r,a,s){this.resize();let n=Math.max(0,Math.min(this.canvas.width-1,Math.floor(r))),i=Math.max(0,Math.min(this.canvas.height-1,Math.floor(a)));this.device.queue.writeBuffer(this.layerOffsetBuffer,0,s.layerOffsets);let o=this.device.createCommandEncoder(),c=o.beginRenderPass({colorAttachments:[{view:this.pickTexture.createView(),clearValue:{r:0,g:0,b:0,a:0},loadOp:"clear",storeOp:"store"}],depthStencilAttachment:this.depthAttachment(!0)}),l=to(t.viewport,this.canvas.width,this.canvas.height);return c.setViewport(l.x,l.y,l.width,l.height,0,1),c.setScissorRect(l.x,l.y,l.width,l.height),this.encodePick(c,t,s),c.end(),this.readPick(o,n,i)}encodePick(t,r,a){if(this.relief?.ready&&!a.compareMode)return;this.writeGlobals(r.matrix,a.activeNetId,r.layerId,performance.now()/1e3,a.selectedFeatureId);let{pipelines:s,indirect:n,barrelInstances:i}=this.drawSet();t.setPipeline(s.pick);let o=[];for(let c of this.entries)this.visible(c,r.layerId,a.visibleLayers,a.showBoard,a.showComponents,a.componentOpacity,a.compareMode,a.visibleTileIds)&&(c.kind==="board"&&(this.identityOnly||c.boardRole!=="substrate")||(this.writeDraw(c,a.activeNetId,a.componentOpacity,a.boardOpacity,a.isolateNet,a.compareMode,a.compareOffsets?.get(c.layerId)),o.push(c)));this.flushDraws(o);for(let c of o)t.setPipeline(c.placementCount?this.componentPipelines(s).pick:s.pick),this.drawEntry(t,c,n);if(!a.compareMode&&this.barrels&&!this.analytic?.hasBarrels()&&(this.writeBarrelDraw(a.isolateNet),this.drawBarrels(t,s.barrelPick,n,i)),n&&!a.compareMode&&this.drawBox(t,s.boxPick),this.analytic&&!a.compareMode){let c=r.layerId?new Set([r.layerId]):a.visibleLayers;this.analytic.encodeInto(t,a.layerOffsets,c,!0,{matrix:r.matrix,panelLayer:r.layerId,isolateNet:a.isolateNet,showBoard:a.showBoard}),this.analytic.encodeBarrels(t,a.layerOffsets,r.matrix,!0)}}async readPick(t,r,a){let s=this.device.createBuffer({label:"pick-readback",size:256,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});t.copyTextureToBuffer({texture:this.pickTexture,origin:{x:r,y:a}},{buffer:s,bytesPerRow:256},{width:1,height:1}),this.device.queue.submit([t.finish()]);try{await s.mapAsync(GPUMapMode.READ);let n=new DataView(s.getMappedRange()),i=n.getUint32(0,!0),o=n.getUint32(4,!0);if(s.unmap(),this.analytic&&i&2147483648&&o)return{kind:"analytic",occurrenceIndex:-1,featureId:0,operationIndex:o-1,occurrenceKey:null};let c=Id(i,o);return{...c,occurrenceKey:c.occurrenceIndex>=0?this.occurrenceKeys[c.occurrenceIndex]??null:null}}finally{s.mapState==="mapped"&&s.unmap(),s.destroy()}}},Ox=Object.freeze({0:1,1:0,5:2});function Fx(e){let t=[1/0,1/0,1/0],r=[-1/0,-1/0,-1/0];for(let a=0;a<e.length;a+=3)for(let s=0;s<3;s+=1){let n=e[a+s];n<t[s]&&(t[s]=n),n>r[s]&&(r[s]=n)}return Number.isFinite(t[0])?{min:t,size:t.map((a,s)=>r[s]>a?r[s]-a:1)}:{min:[0,0,0],size:[1,1,1]}}function Px(e,t,r,a,s){for(let n=0;n<3;n+=1){let i=(r[a+n]-s.min[n])/s.size[n];e[t+n]=Math.max(0,Math.min(65535,Math.round(i*65535)))}e[t+3]=0}function jx(e,t,r,a){for(let s=0;s<3;s+=1){let n=Number(r[a+s])||0;e[t+s]=Math.max(-127,Math.min(127,Math.round(n*127)))}e[t+3]=0}function Lx(e,t){if(t<=65536){let r=new Uint16Array(e.length+(e.length&1));return r.set(e),{indices:r,format:"uint16"}}return{indices:e instanceof Uint32Array?e:new Uint32Array(e),format:"uint32"}}function _u(e,t){return e*ro+(e<=65536?(t+(t&1))*2:t*4)}function eu(e,t){return e.kind==="component"||e.innerCopper&&t?1:e.kind==="board"&&(e.boardRole==="substrate"||e.boardRole==="soldermask")?5:0}function Us(e){return e.translucent?3:e.kind!=="board"?0:e.boardRole==="soldermask"?1:e.boardRole==="silkscreen"?2:0}function Dx(e,t){return e.kind!=="board"||e.boardRole==="substrate"?1:e.boardRole==="soldermask"?Math.min(t,.72):e.boardRole==="silkscreen"?Math.min(t,.92):t}function Ux(e){if(e.kind!=="board"||e.boardRole!=="soldermask"&&e.boardRole!=="silkscreen")return 0;let t=e.bounds,a=(t?(t[2]+t[5])*.5:0)<0?-1:1,s=e.boardRole==="silkscreen"?35e-6:18e-6;return a*s}function to(e,t,r){let a=Math.max(0,Math.min(t-1,Math.floor(e.x))),s=Math.max(0,Math.min(r-1,Math.floor(e.y)));return{x:a,y:s,width:Math.max(1,Math.min(t-a,Math.floor(e.width))),height:Math.max(1,Math.min(r-s,Math.floor(e.height)))}}function Iu(e){return e*12+2}function Ru(e){let t=[],r=0,a=0,s=0;for(let b=0;b<e.length;b+=1){let h=Math.floor(e[b].samplesMm.length/3);h<2||(t.push(b),r+=h,a+=Iu(h),s+=(h-1)*12*6+72)}let n=new Float32Array(Math.max(r,1)*4),i=new ArrayBuffer(Math.max(t.length,1)*32),o=new Uint32Array(i),c=new Float32Array(i),l=new Uint32Array(Math.max(s,3)),f=0,d=0,p=0;return t.forEach((b,h)=>{let u=e[b],m=Math.floor(u.samplesMm.length/3);for(let x=0;x<m;x+=1)n[(f+x)*4]=u.samplesMm[x*3]*.001,n[(f+x)*4+1]=u.samplesMm[x*3+1]*.001,n[(f+x)*4+2]=u.samplesMm[x*3+2]*.001;o[h*8]=f,o[h*8+1]=m,o[h*8+2]=d,o[h*8+3]=h,c[h*8+4]=u.radiusMm*.001;let g=(x,v)=>d+x*12+v%12;for(let x=0;x+1<m;x+=1)for(let v=0;v<12;v+=1)l.set([g(x,v),g(x+1,v),g(x+1,v+1),g(x,v),g(x+1,v+1),g(x,v+1)],p),p+=6;let y=d+m*12;for(let x=0;x<12;x+=1)l.set([y,g(0,x+1),g(0,x)],p),l.set([y+1,g(m-1,x),g(m-1,x+1)],p+3),p+=6;f+=m,d+=Iu(m)}),{samples:n,segments:o,indices:l,kept:t,sampleCount:r,vertexCount:a,indexCount:s}}var zx=`
struct Segment { start: u32, count: u32, vertexStart: u32, color: u32, radius: f32, p0: u32, p1: u32, p2: u32 };
struct Vertex { position: vec4f, normal: vec4f };
`,Kx=`${zx}
const RING: u32 = ${12}u;
const TAU: f32 = 6.283185307179586;
@group(0) @binding(0) var<storage, read> samples: array<vec4f>;
@group(0) @binding(1) var<storage, read> segments: array<Segment>;
@group(0) @binding(2) var<storage, read_write> frames: array<vec4f>;
@group(0) @binding(3) var<storage, read_write> vertices: array<Vertex>;
@group(0) @binding(4) var<uniform> counts: vec4u; // segments, samples, vertices

fn safeNormalize(v: vec3f) -> vec3f {
  let length = sqrt(dot(v, v));
  return select(vec3f(0.0, 0.0, 1.0), v / length, length > 1e-12);
}
fn point(s: Segment, i: u32) -> vec3f { return samples[s.start + i].xyz; }
fn tangent(s: Segment, i: u32) -> vec3f {
  let a = point(s, select(i - 1u, 0u, i == 0u));
  let b = point(s, min(i + 1u, s.count - 1u));
  return safeNormalize(b - a);
}
fn perpendicularTo(t: vec3f) -> vec3f {
  let a = abs(t);
  var axis = vec3f(0.0, 0.0, 1.0);
  if (a.x <= a.y && a.x <= a.z) { axis = vec3f(1.0, 0.0, 0.0); } else if (a.y <= a.z) { axis = vec3f(0.0, 1.0, 0.0); }
  return safeNormalize(cross(t, axis));
}

@compute @workgroup_size(64) fn framesMain(@builtin(global_invocation_id) id: vec3u) {
  if (id.x >= counts.x) { return; }
  let s = segments[id.x];
  var r = perpendicularTo(tangent(s, 0u));
  frames[s.start] = vec4f(r, 0.0);
  for (var i = 0u; i + 1u < s.count; i++) {
    let v1 = point(s, i + 1u) - point(s, i);
    let c1 = dot(v1, v1);
    if (c1 >= 1e-24) {
      let rL = r - (2.0 / c1) * dot(v1, r) * v1;
      let tL = tangent(s, i) - (2.0 / c1) * dot(v1, tangent(s, i)) * v1;
      let v2 = tangent(s, i + 1u) - tL;
      let c2 = dot(v2, v2);
      r = safeNormalize(select(rL - (2.0 / c2) * dot(v2, rL) * v2, rL, c2 < 1e-24));
    }
    frames[s.start + i + 1u] = vec4f(r, 0.0);
  }
}

fn segmentOf(vertex: u32) -> u32 {
  var low = 0u;
  var high = counts.x - 1u;
  loop {
    if (low >= high) { break; }
    let middle = (low + high + 1u) / 2u;
    if (segments[middle].vertexStart <= vertex) { low = middle; } else { high = middle - 1u; }
  }
  return low;
}

@compute @workgroup_size(64) fn ringsMain(@builtin(global_invocation_id) id: vec3u) {
  if (id.x >= counts.z) { return; }
  let index = segmentOf(id.x);
  let s = segments[index];
  let local = id.x - s.vertexStart;
  let ringVertices = s.count * RING;
  var position: vec3f;
  var normal: vec3f;
  if (local < ringVertices) {
    let i = local / RING;
    let angle = TAU * f32(local % RING) / f32(RING);
    let t = tangent(s, i);
    let r = frames[s.start + i].xyz;
    normal = cos(angle) * r + sin(angle) * cross(t, r);
    position = point(s, i) + s.radius * normal;
  } else if (local == ringVertices) {
    normal = -tangent(s, 0u);
    position = point(s, 0u);
  } else {
    normal = tangent(s, s.count - 1u);
    position = point(s, s.count - 1u);
  }
  vertices[id.x] = Vertex(vec4f(position, bitcast<f32>(s.color)), vec4f(normal, 0.0));
}
`,Vx=`
struct Globals { viewProjection: mat4x4f, light: vec4f, time: vec4f };
@group(0) @binding(0) var<uniform> globals: Globals;
@group(0) @binding(1) var<storage, read> colors: array<vec4f>; // rgb, mode: 0 idle, 1 lit, 2 dim

struct Out {
  @builtin(position) position: vec4f,
  @location(0) normal: vec3f,
  @location(1) @interpolate(flat) color: u32,
};
@vertex fn vs(@location(0) position: vec4f, @location(1) normal: vec4f) -> Out {
  var out: Out;
  out.position = globals.viewProjection * vec4f(position.xyz, 1.0);
  out.normal = normal.xyz;
  out.color = bitcast<u32>(position.w);
  return out;
}
@fragment fn fs(input: Out) -> @location(0) vec4f {
  let entry = colors[input.color];
  let mode = u32(entry.a + 0.5);
  var base = entry.rgb;
  if (mode == 1u) { base = base * (0.9 + 0.1 * sin(globals.time.x * 3.2)); }
  if (mode == 2u) { base = mix(base, vec3f(0.62, 0.64, 0.67), 0.7); }
  let n = normalize(input.normal);
  let diffuse = max(dot(n, normalize(globals.light.xyz)), 0.0);
  let hemi = mix(0.35, 0.7, n.z * 0.5 + 0.5);
  let lit = base * (hemi + 0.6 * diffuse);
  return vec4f(select(lit, max(lit, base * 0.95), mode == 1u), 1.0);
}
`,Nu=96,qs=class{constructor(t){this.host=t,this.device=t.device,this.counts={segments:0,samples:0,vertices:0,indices:0},this.dirty=!1,this.kept=[];let r=this.device,a=r.createShaderModule({label:"harness-tubes-compute",code:Kx});this.computeLayout=r.createBindGroupLayout({label:"harness-tubes-compute",entries:[{binding:0,visibility:GPUShaderStage.COMPUTE,buffer:{type:"read-only-storage"}},{binding:1,visibility:GPUShaderStage.COMPUTE,buffer:{type:"read-only-storage"}},{binding:2,visibility:GPUShaderStage.COMPUTE,buffer:{type:"storage"}},{binding:3,visibility:GPUShaderStage.COMPUTE,buffer:{type:"storage"}},{binding:4,visibility:GPUShaderStage.COMPUTE,buffer:{type:"uniform"}}]});let s=r.createPipelineLayout({bindGroupLayouts:[this.computeLayout]});this.framesPipeline=r.createComputePipeline({layout:s,compute:{module:a,entryPoint:"framesMain"}}),this.ringsPipeline=r.createComputePipeline({layout:s,compute:{module:a,entryPoint:"ringsMain"}});let n=r.createShaderModule({label:"harness-tubes-draw",code:Vx});this.drawLayout=r.createBindGroupLayout({label:"harness-tubes-draw",entries:[{binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}},{binding:1,visibility:GPUShaderStage.FRAGMENT,buffer:{type:"read-only-storage"}}]}),this.drawPipeline=r.createRenderPipeline({label:"harness-tubes",layout:r.createPipelineLayout({bindGroupLayouts:[this.drawLayout]}),vertex:{module:n,entryPoint:"vs",buffers:[{arrayStride:32,attributes:[{shaderLocation:0,offset:0,format:"float32x4"},{shaderLocation:1,offset:16,format:"float32x4"}]}]},fragment:{module:n,entryPoint:"fs",targets:[{format:t.format}]},primitive:{topology:"triangle-list",cullMode:"none"},depthStencil:t.depthStencilState(),multisample:{count:t.sampleCount}}),this.globals=r.createBuffer({label:"harness-tubes-globals",size:Nu,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),this.countBuffer=r.createBuffer({label:"harness-tubes-counts",size:16,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),this.buffers={},this.capacity={samples:0,segments:0,vertices:0,indices:0},this.globalScratch=new Float32Array(Nu/4)}ensure(t,r,a){let s=this.buffers[t];return s&&s.size>=r?!1:(s?.destroy(),this.buffers[t]=this.device.createBuffer({label:`harness-tubes-${t}`,size:Math.max(256,Math.ceil(r*1.5/4)*4),usage:a}),!0)}setTubes(t,r){let a=Ru(t);if(this.kept=a.kept.map(o=>t[o]),this.counts={segments:a.kept.length,samples:a.sampleCount,vertices:a.vertexCount,indices:a.indexCount},!this.counts.segments){this.dirty=!1;return}let s=GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST,n=!1;n=this.ensure("samples",a.samples.byteLength,s)||n,n=this.ensure("segments",a.segments.byteLength,s)||n,n=this.ensure("frames",a.samples.byteLength,GPUBufferUsage.STORAGE)||n,n=this.ensure("vertices",this.counts.vertices*32,GPUBufferUsage.STORAGE|GPUBufferUsage.VERTEX)||n,this.ensure("indices",a.indices.byteLength,GPUBufferUsage.INDEX|GPUBufferUsage.COPY_DST);let i=this.device.queue;i.writeBuffer(this.buffers.samples,0,a.samples),i.writeBuffer(this.buffers.segments,0,a.segments),i.writeBuffer(this.buffers.indices,0,a.indices),i.writeBuffer(this.countBuffer,0,new Uint32Array([this.counts.segments,this.counts.samples,this.counts.vertices,0])),(n||!this.computeGroup)&&(this.computeGroup=this.device.createBindGroup({layout:this.computeLayout,entries:["samples","segments","frames","vertices"].map((o,c)=>({binding:c,resource:{buffer:this.buffers[o]}})).concat([{binding:4,resource:{buffer:this.countBuffer}}])})),this.setColors(r),this.dirty=!0}setColors(t){if(!this.counts.segments)return;let r=new Float32Array(this.counts.segments*4);this.kept.forEach((a,s)=>{let{rgb:n,mode:i}=t(a);r.set([n[0],n[1],n[2],i],s*4)}),(this.ensure("colors",r.byteLength,GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST)||!this.drawGroup||this.drawGroupColors!==this.buffers.colors)&&(this.drawGroup=this.device.createBindGroup({layout:this.drawLayout,entries:[{binding:0,resource:{buffer:this.globals}},{binding:1,resource:{buffer:this.buffers.colors}}]}),this.drawGroupColors=this.buffers.colors),this.device.queue.writeBuffer(this.buffers.colors,0,r)}encodeCompute(t){if(!this.dirty||!this.counts.segments)return;let r=t.beginComputePass({label:"harness-tubes"});r.setBindGroup(0,this.computeGroup),r.setPipeline(this.framesPipeline),r.dispatchWorkgroups(Math.ceil(this.counts.segments/64)),r.setPipeline(this.ringsPipeline),r.dispatchWorkgroups(Math.ceil(this.counts.vertices/64)),r.end(),this.dirty=!1}draw(t,r,a=0){if(!this.counts.segments)return 0;let s=this.globalScratch;return s.fill(0),s.set(r,0),s.set([.35,-.45,.82,0],16),s[20]=a,this.device.queue.writeBuffer(this.globals,0,s),t.setPipeline(this.drawPipeline),t.setBindGroup(0,this.drawGroup),t.setVertexBuffer(0,this.buffers.vertices),t.setIndexBuffer(this.buffers.indices,"uint32"),t.drawIndexed(this.counts.indices),this.counts.indices/3}gpuMemoryBytes(){return Object.values(this.buffers).reduce((t,r)=>t+r.size,0)}dispose(){for(let t of Object.values(this.buffers))t.destroy();this.globals.destroy(),this.countBuffer.destroy(),this.buffers={}}};var Hx=[0,0,0,1,1,1],Ws=class e{static async create(t){return new e(await tr.create(t))}constructor(t){this.host=t,this.canvas=t.canvas,this.device=t.device,t.alwaysInstanced=!0,t.setOccurrences([]),this.assets=new Map,this.order=[],this.frameStats={triangles:0,draws:0},this.lodThresholds={...lt},this.tubes=null,this.tubeVersion=0}setTubes(t,r){!t.length&&!this.tubes||(this.tubes??=new qs(this.host),this.tubes.setTubes(t,r),this.tubeVersion+=1)}setTubeColors(t){this.tubes?.setColors(t),this.tubeVersion+=1}asset(t){let r=this.assets.get(t);return r||(r=new tr(this.canvas,this.device,{shareFrom:this.host}),r.setLodThresholds(this.lodThresholds),this.assets.set(t,r)),r}standIn(t,r){let a=this.asset(t);return a.standIn||(a.standIn=!0,a.setBoardBounds(Hx),a.setLodOverride(Nd)),a.boxColor=[...r],a}removeAsset(t){let r=this.assets.get(t);r&&(r.dispose(),this.assets.delete(t))}get renderers(){return this.order.map(t=>this.assets.get(t)).filter(Boolean)}setOccurrences(t){this.order=[...t.keys()].filter(a=>this.assets.has(a));for(let[a,s]of this.assets)t.has(a)||s.setOccurrences([]);for(let a of this.order)this.assets.get(a).setOccurrences(t.get(a));let r=0;for(let a of this.renderers)a.occurrenceBase=r,r+=a.occurrenceCount;this.occurrenceCount=r}locate(t){for(let r of this.renderers){let a=t-r.occurrenceBase;if(a>=0&&a<r.occurrenceCount)return{renderer:r,local:a}}return null}keyOf(t){let r=this.locate(t);return r?r.renderer.occurrenceKeys[r.local]??null:null}setSelectedOccurrence(t){let r=t>=0?this.locate(t):null;for(let a of this.renderers)a.selectedOccurrence=!a.standIn&&r?.renderer===a?r.local:-1}resize(){this.host.resize()}render(t,r){let a=this.host;a.resize();let s=this.renderers.filter(d=>d.occurrenceCount>0),n=new Map(s.map(d=>[d,r(d)]));for(let[d,p]of n)Cu(d,p);let i=this.device.createCommandEncoder(),o=s.filter(d=>d.encodeCull(i,t));this.tubes?.encodeCompute(i);let c=i.beginRenderPass({colorAttachments:[a.colorAttachment(a.context.getCurrentTexture().createView())],depthStencilAttachment:a.depthAttachment()});Bu(c,t.viewport,this.canvas);let l=0,f=0;for(let d of s){let p=d.encodeDraws(c,t,n.get(d));l+=p.triangles,f+=p.draws}this.tubes?.counts.segments&&(l+=this.tubes.draw(c,t.matrix,performance.now()/1e3),f+=1),c.end(),this.device.queue.submit([i.finish()]);for(let d of o)d.readCullCounts();this.frameStats={triangles:Math.round(l),draws:f}}pick(t,r,a,s){let n=this.host.pickSerial.then(()=>this.performPick(t,r,a,s));return this.host.pickSerial=n.catch(()=>0),n}async performPick(t,r,a,s){let n=this.host;n.resize();let i=Math.max(0,Math.min(this.canvas.width-1,Math.floor(r))),o=Math.max(0,Math.min(this.canvas.height-1,Math.floor(a))),c=this.device.createCommandEncoder(),l=c.beginRenderPass({colorAttachments:[{view:n.pickTexture.createView(),clearValue:{r:0,g:0,b:0,a:0},loadOp:"clear",storeOp:"store"}],depthStencilAttachment:n.depthAttachment(!0)});Bu(l,t.viewport,this.canvas);for(let p of this.renderers){if(p.occurrenceCount===0)continue;let b=s(p);Cu(p,b),p.encodePick(l,t,b)}l.end();let f=await n.readPick(c,i,o),d=f.occurrenceIndex>=0?this.locate(f.occurrenceIndex):null;return{...f,occurrenceKey:d?d.renderer.occurrenceKeys[d.local]??null:null,renderer:d?.renderer||null,standIn:!!d?.renderer?.standIn}}gpuMemoryBytes(){let t=0;for(let r of this.renderers)t+=r.gpuMemoryBytes();return t+=this.tubes?.gpuMemoryBytes()||0,t+=this.host.arenaSlackBytes(),t-Math.max(0,this.renderers.length-1)*this.canvas.width*this.canvas.height*12}gpuMemoryBreakdown(){let t={};for(let[r,a]of this.assets){let s=a.gpuMemoryBreakdown();delete s.targets,t[r]=s}return{assets:t,tubes:this.tubes?.gpuMemoryBytes()||0,targets:this.canvas.width*this.canvas.height*12,arena:this.host.arenaStats()}}setLodThresholds(t){this.lodThresholds=Ir({...this.lodThresholds,...t});for(let r of this.assets.values())r.setLodThresholds(this.lodThresholds);return{...this.lodThresholds}}cullCounts(){let t={full:0,board:0,body:0,box:0,culled:0};for(let r of this.renderers)if(r.occurrenceCount)for(let a of Object.keys(t))t[a]+=r.cullCounts[a]||0;return t}dispose(){for(let t of[...this.assets.keys()])this.removeAsset(t);this.tubes?.dispose(),this.tubes=null,this.host.dispose(),this.host.context?.unconfigure?.(),this.device.destroy?.()}};function Cu(e,t){t?.layerOffsets&&e.device.queue.writeBuffer(e.layerOffsetBuffer,0,t.layerOffsets)}function Bu(e,t,r){let a=Math.max(0,Math.min(r.width-1,Math.floor(t.x))),s=Math.max(0,Math.min(r.height-1,Math.floor(t.y))),n=Math.max(1,Math.min(r.width-a,Math.floor(t.width))),i=Math.max(1,Math.min(r.height-s,Math.floor(t.height)));e.setViewport(a,s,n,i,0,1),e.setScissorRect(a,s,n,i)}var qx=`
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
}`,Wx=`
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
}`,Xx=`
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
}`,$x=`
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
}`,Yx=`
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
}`,Jx=`
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
}`,Qx=`
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
}`,Zx=6.2,ew=4.6,tw=3.8,$s=4*1024*1024,rw=Math.floor($s/6),Ou=rw*6,Xs=512*1024,Fu=512*1024,Pu=96,aw=96,sw=18,ju=96*1024*1024,nw=2,Qs=class e{static async create(t,r){if(!navigator.gpu)throw new Error("WebGPU is unavailable in this browser");let a=await navigator.gpu.requestAdapter({powerPreference:"high-performance"});if(!a)throw new Error("No WebGPU adapter is available");let s=await a.requestDevice(),n=await fetch(r,{cache:"default"});if(!n.ok)throw new Error(`Failed to load schematic manifest: ${n.status}`);let i=await n.json();if(!["prism.schematic_world_a0","prism.schematic_vector_a0"].includes(i.schema))throw new Error(`Unsupported schematic scene schema: ${i.schema}`);let o=i.featureTable||i.features,c=await fetch(new URL(o,r),{cache:"default"});if(!c.ok)throw new Error(`Failed to load schematic features: ${c.status}`);let l=ow(await c.json());return new e(t,s,r,i,l)}constructor(t,r,a,s,n){this.canvas=t,this.device=r,this.manifestUrl=a,this.manifest=s,this.isNativeScene=s.schema==="prism.schematic_vector_a0",this.pages=s.pages||[],this.featuresByPage=n,this.featuresById=new Map;for(let b of Object.values(n))for(let h of b)this.featuresById.set(Number(h.id),h);this.context=t.getContext("webgpu"),this.format=navigator.gpu.getPreferredCanvasFormat(),this.context.configure({device:r,format:this.format,alphaMode:"opaque"}),this.flowCanvas=null,this.flowContext=null,this.globalBuffer=r.createBuffer({size:48,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),this.bindGroupLayout=r.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}},{binding:1,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}},{binding:2,visibility:GPUShaderStage.FRAGMENT,sampler:{type:"filtering"}},{binding:3,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:"float"}}]});let i=r.createShaderModule({code:qx});this.pagePipeline=r.createRenderPipeline({layout:r.createPipelineLayout({bindGroupLayouts:[this.bindGroupLayout]}),vertex:{module:i,entryPoint:"vs"},fragment:{module:i,entryPoint:"fs",targets:[{format:this.format}]},primitive:{topology:"triangle-list"}}),this.edgeLayout=r.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}}]});let o=r.createShaderModule({code:Wx});this.edgePipeline=r.createRenderPipeline({layout:r.createPipelineLayout({bindGroupLayouts:[this.edgeLayout]}),vertex:{module:o,entryPoint:"vs",buffers:[{arrayStride:8,attributes:[{shaderLocation:0,offset:0,format:"float32x2"}]}]},fragment:{module:o,entryPoint:"fs",targets:[{format:this.format,blend:{color:{srcFactor:"src-alpha",dstFactor:"one-minus-src-alpha"},alpha:{srcFactor:"one",dstFactor:"one-minus-src-alpha"}}}]},primitive:{topology:"line-list"}}),this.edgeBindGroup=r.createBindGroup({layout:this.edgeLayout,entries:[{binding:0,resource:{buffer:this.globalBuffer}}]});let c=r.createShaderModule({code:Xx});this.highlightPipeline=r.createRenderPipeline({layout:r.createPipelineLayout({bindGroupLayouts:[this.edgeLayout]}),vertex:{module:c,entryPoint:"vs",buffers:[{arrayStride:8,attributes:[{shaderLocation:0,offset:0,format:"float32x2"}]}]},fragment:{module:c,entryPoint:"fs",targets:[{format:this.format,blend:{color:{srcFactor:"src-alpha",dstFactor:"one-minus-src-alpha"},alpha:{srcFactor:"one",dstFactor:"one-minus-src-alpha"}}}]},primitive:{topology:"line-list"}}),this.highlightBufferSize=4*1024*1024,this.highlightBuffer=r.createBuffer({size:this.highlightBufferSize,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST});let l=r.createShaderModule({code:$x});this.netFlowPipeline=r.createRenderPipeline({layout:r.createPipelineLayout({bindGroupLayouts:[this.edgeLayout]}),vertex:{module:l,entryPoint:"vs",buffers:[{arrayStride:16,attributes:[{shaderLocation:0,offset:0,format:"float32x2"},{shaderLocation:1,offset:8,format:"float32x2"}]}]},fragment:{module:l,entryPoint:"fs",targets:[{format:this.format,blend:{color:{srcFactor:"src-alpha",dstFactor:"one-minus-src-alpha"},alpha:{srcFactor:"one",dstFactor:"one-minus-src-alpha"}}}]},primitive:{topology:"triangle-list"}}),this.netFlowBuffer=r.createBuffer({size:Fu*4,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST}),this.globalUniformScratch=new Float32Array(12),this.pageUniformScratch=new Float32Array(8),this.imageUniformScratch=new Float32Array(8),this.vectorScratch=new Float32Array($s),this.highlightScratch=new Float32Array(this.highlightBufferSize/4),this.netFlowScratch=new Float32Array(Fu),this.netTrackingCache=null,this.selectedIntrasheetLinkIndex=-1,this.truncatedHighlightCount=0,this.truncatedVectorCount=0,this.frameSerial=0,this.querySerial=0;let f=r.createShaderModule({code:Yx});this.vectorPipeline=r.createRenderPipeline({layout:r.createPipelineLayout({bindGroupLayouts:[this.edgeLayout]}),vertex:{module:f,entryPoint:"vs",buffers:[{arrayStride:24,attributes:[{shaderLocation:0,offset:0,format:"float32x2"},{shaderLocation:1,offset:8,format:"float32x4"}]}]},fragment:{module:f,entryPoint:"fs",targets:[{format:this.format,blend:{color:{srcFactor:"src-alpha",dstFactor:"one-minus-src-alpha"},alpha:{srcFactor:"one",dstFactor:"one-minus-src-alpha"}}}]},primitive:{topology:"triangle-list"}}),this.vectorBuffer=r.createBuffer({size:$s*4,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST}),this.vectorBuffers=[this.vectorBuffer];let d=r.createShaderModule({code:Jx});this.imagePipeline=r.createRenderPipeline({layout:r.createPipelineLayout({bindGroupLayouts:[this.bindGroupLayout]}),vertex:{module:d,entryPoint:"vs"},fragment:{module:d,entryPoint:"fs",targets:[{format:this.format,blend:{color:{srcFactor:"src-alpha",dstFactor:"one-minus-src-alpha"},alpha:{srcFactor:"one",dstFactor:"one-minus-src-alpha"}}}]},primitive:{topology:"triangle-list"}});let p=r.createShaderModule({code:Qx});this.pickPipeline=r.createRenderPipeline({layout:r.createPipelineLayout({bindGroupLayouts:[this.edgeLayout]}),vertex:{module:p,entryPoint:"vs",buffers:[{arrayStride:12,attributes:[{shaderLocation:0,offset:0,format:"float32x2"},{shaderLocation:1,offset:8,format:"uint32"}]}]},fragment:{module:p,entryPoint:"fs",targets:[{format:"r32uint"}]},primitive:{topology:"triangle-list"}}),this.pickVertexBuffer=r.createBuffer({size:Xs*12,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST}),this.pickReadBuffer=r.createBuffer({size:256,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}),this.pickTexture=null,this.pickTextureSize=[0,0],this.pickPending=!1,this.vectorChunks=new Map,this.failedVectorChunks=new Map,this.nativeDetailState=new Map,this.domDetailPageIds=new Set,this.nativeDetailThresholds=new Map,this.residentVectorBytes=0,this.sampler=r.createSampler({magFilter:"linear",minFilter:"linear",mipmapFilter:"linear"}),this.placeholder=this.createSolidTexture([245,247,249,255]),this.pageResources=new Map,this.imageResources=new Map,this.loading=new Map,this.selectedPageId="",this.selectedFeatureId=0,this.activeNetUid="",this.showHierarchy=!0,this.downloadedBytes=0,this.world=s.worldBoundsMm,this.center=[(this.world.minX+this.world.maxX)/2,(this.world.minY+this.world.maxY)/2],this.scale=Math.max((this.world.maxX-this.world.minX)/900,(this.world.maxY-this.world.minY)/650,.1)*1.16,this.edgeBuffer=this.createEdgeBuffer();for(let b of this.pages)this.createPageResource(b)}createSolidTexture(t){let r=this.device.createTexture({size:[1,1],format:"rgba8unorm-srgb",usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST});return this.device.queue.writeTexture({texture:r},new Uint8Array(t),{bytesPerRow:4},[1,1]),r}createPageResource(t){let r=this.device.createBuffer({size:32,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),a={page:t,uniform:r,texture:this.placeholder,textureWidth:0,svgBlob:null,bindGroup:null};this.pageResources.set(t.id,a),this.updateBindGroup(a)}createImageResource(t){let r=this.device.createBuffer({size:32,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),a={path:t,uniform:r,texture:this.placeholder,loaded:!1,bindGroup:null};return this.imageResources.set(t,a),this.updateBindGroup(a),a}updateBindGroup(t){t.bindGroup=this.device.createBindGroup({layout:this.bindGroupLayout,entries:[{binding:0,resource:{buffer:this.globalBuffer}},{binding:1,resource:{buffer:t.uniform}},{binding:2,resource:this.sampler},{binding:3,resource:t.texture.createView()}]})}async loadImageTexture(t){let r=this.imageResources.get(t)||this.createImageResource(t);if(r.loaded)return r;let a=`image:${t}`;if(this.loading.has(a))return this.loading.get(a);let s=(async()=>{try{let n=await fetch(new URL(t,this.manifestUrl),{cache:"default"});if(!n.ok)throw new Error(`Failed to load schematic image ${t}: ${n.status}`);let i=await n.blob(),o=await createImageBitmap(i),c=this.device.createTexture({size:[o.width,o.height],format:"rgba8unorm-srgb",usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST|GPUTextureUsage.RENDER_ATTACHMENT});this.device.queue.copyExternalImageToTexture({source:o},{texture:c},[o.width,o.height]),o.close(),r.texture!==this.placeholder&&r.texture.destroy(),r.texture=c,r.loaded=!0,this.updateBindGroup(r)}finally{this.loading.delete(a)}return r})();return this.loading.set(a,s),s}createEdgeBuffer(){let t=new Map(this.pages.map(n=>[n.id,n])),r=[];for(let n of this.manifest.edges||[]){let i=t.get(n.source),o=t.get(n.target);!i||!o||r.push(i.worldX+i.widthMm/2,i.worldY+i.heightMm,o.worldX+o.widthMm/2,o.worldY)}let a=new Float32Array(r);if(!a.length)return null;let s=this.device.createBuffer({size:a.byteLength,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST});return this.device.queue.writeBuffer(s,0,a),{buffer:s,count:a.length/2}}resize(){let t=Math.min(devicePixelRatio||1,2),r=Math.max(1,Math.floor(this.canvas.clientWidth*t)),a=Math.max(1,Math.floor(this.canvas.clientHeight*t));(this.canvas.width!==r||this.canvas.height!==a)&&(this.canvas.width=r,this.canvas.height=a),this.flowCanvas&&(this.flowCanvas.width!==r||this.flowCanvas.height!==a)&&(this.flowCanvas.width=r,this.flowCanvas.height=a)}setFlowOverlayCanvas(t){t&&(this.flowCanvas=t,this.flowContext=t.getContext("webgpu"),this.flowContext.configure({device:this.device,format:this.format,alphaMode:"premultiplied"}))}writeGlobals(){let t=this.globalUniformScratch;t[0]=this.center[0],t[1]=this.center[1],t[2]=this.scale,t[3]=performance.now()*.001,t[4]=this.canvas.width,t[5]=this.canvas.height,this.device.queue.writeBuffer(this.globalBuffer,0,t)}pagePixelWidth(t){return t.widthMm/this.scale}pageSourcePixelsPerMm(t){let r=this.pagePixelWidth(t)/Math.max(1,t.sourceWidthMm||t.widthMm),a=t.heightMm/this.scale/Math.max(1,t.sourceHeightMm||t.heightMm);return Math.min(r,a)}pageNativeDetailThresholds(t){let r=this.nativeDetailThresholds.get(t.id);if(r)return r;let a=Math.max(1,t.sourceWidthMm||t.widthMm),s=Math.max(1,t.sourceHeightMm||t.heightMm),n=a*s,i=Math.max(0,t.featureCount||t.featureIds?.length||0)/Math.max(1,n),o=be(1-i*72,.84,1.08),c=be(Math.sqrt(Math.max(a,s)/Math.max(1,Math.min(a,s)))/1.18,.92,1.14),l=be(Zx*o*c,5,7.4),f={enter:l,exit:be(Math.min(l-1.2,ew*o),3.8,l-.7),prefetch:be(Math.min(l-2,tw*o),3,l-1)};return this.nativeDetailThresholds.set(t.id,f),f}pageWantsNativeDetail(t){if(!this.pageHasNativeDetail(t))return!1;let r=this.pageSourcePixelsPerMm(t),a=this.nativeDetailState.get(t.id)===!0,s=this.pageNativeDetailThresholds(t),n=a?s.exit:s.enter,i=r>=n;return i!==a&&this.nativeDetailState.set(t.id,i),i}pageNativeDetailReady(t){if(this.domDetailPageIds.has(t.id)||!this.pageWantsNativeDetail(t))return!1;let r=this.vectorChunks.get(t.id);return!r?.loaded||!r.segments?.length&&!r.fills?.length?!1:this.visibleNativeImagesReady(t,r)}visibleNativeImagesReady(t,r){if(!r?.images?.length)return!0;let a=this.sourceViewportBounds(t,4),s=!0;for(let n of r.images){if(!St(n.bounds,a))continue;(this.imageResources.get(n.path)||this.createImageResource(n.path)).loaded||(s=!1,this.loadImageTexture(n.path).catch(()=>{}))}return s}visiblePages(){let t=this.canvas.width*this.scale/2,r=this.canvas.height*this.scale/2,a=this.center[0]-t,s=this.center[0]+t,n=this.center[1]-r,i=this.center[1]+r;return this.pages.filter(o=>o.worldX+o.widthMm>=a&&o.worldX<=s&&o.worldY+o.heightMm>=n&&o.worldY<=i)}worldViewportBounds(t=0){let r=this.canvas.width*this.scale/2,a=this.canvas.height*this.scale/2;return[this.center[0]-r-t,this.center[1]-a-t,this.center[0]+r+t,this.center[1]+a+t]}sourceViewportBounds(t,r=2.5){let a=this.worldViewportBounds(this.scale*8),s=(a[0]-t.worldX)/t.widthMm*t.sourceWidthMm-r,n=(a[1]-t.worldY)/t.heightMm*t.sourceHeightMm-r,i=(a[2]-t.worldX)/t.widthMm*t.sourceWidthMm+r,o=(a[3]-t.worldY)/t.heightMm*t.sourceHeightMm+r;return[Math.max(-r,Math.min(s,i)),Math.max(-r,Math.min(n,o)),Math.min(t.sourceWidthMm+r,Math.max(s,i)),Math.min(t.sourceHeightMm+r,Math.max(n,o))]}render(){this.frameSerial+=1,this.resize(),this.writeGlobals();let t=this.visiblePages(),r=this.device.createCommandEncoder(),a=r.beginRenderPass({colorAttachments:[{view:this.context.getCurrentTexture().createView(),clearValue:{r:.045,g:.055,b:.073,a:1},loadOp:"clear",storeOp:"store"}]});this.showHierarchy&&this.edgeBuffer&&(a.setPipeline(this.edgePipeline),a.setBindGroup(0,this.edgeBindGroup),a.setVertexBuffer(0,this.edgeBuffer.buffer),a.draw(this.edgeBuffer.count)),a.setPipeline(this.pagePipeline);for(let i of t){let o=this.pageResources.get(i.id),c=this.activeNetUid&&i.netUids.includes(this.activeNetUid),l=this.domDetailPageIds.has(i.id),f=!l&&this.pageNativeDetailReady(i),d=this.pageUniformScratch;d[0]=i.worldX,d[1]=i.worldY,d[2]=i.widthMm,d[3]=i.heightMm,d[4]=i.id===this.selectedPageId?1:0,d[5]=c?1:0,d[6]=this.activeNetUid?1:0,d[7]=f||l?1:0,this.device.queue.writeBuffer(o.uniform,0,d),a.setBindGroup(0,o.bindGroup),a.draw(6);let p=be(Math.ceil(this.pagePixelWidth(i)*1.3/512)*512,512,6144);o.textureWidth<p*.82&&this.loadPageTexture(i,p).catch(()=>{})}this.scheduleVisibleVectorLoads(t),this.drawVisibleImages(a,t),this.drawVisibleVectors(a,t);let s=this.writeNetTrackingOverlay();s&&!this.flowContext&&(a.setPipeline(this.netFlowPipeline),a.setBindGroup(0,this.edgeBindGroup),a.setVertexBuffer(0,this.netFlowBuffer),a.draw(s));let n=this.writeNetHighlights(t);return n&&(a.setPipeline(this.highlightPipeline),a.setBindGroup(0,this.edgeBindGroup),a.setVertexBuffer(0,this.highlightBuffer),a.draw(n)),a.end(),this.device.queue.submit([r.finish()]),this.renderFlowOverlay(s),this.evictVectorChunks(t),t}renderFlowOverlay(t){if(!this.flowContext)return;let r=this.device.createCommandEncoder(),a=r.beginRenderPass({colorAttachments:[{view:this.flowContext.getCurrentTexture().createView(),clearValue:{r:0,g:0,b:0,a:0},loadOp:"clear",storeOp:"store"}]});t&&(a.setPipeline(this.netFlowPipeline),a.setBindGroup(0,this.edgeBindGroup),a.setVertexBuffer(0,this.netFlowBuffer),a.draw(t)),a.end(),this.device.queue.submit([r.finish()])}drawVisibleImages(t,r){if(!this.isNativeScene)return;let a=!1;for(let s of r){if(this.domDetailPageIds.has(s.id)||!this.pageNativeDetailReady(s))continue;let n=this.vectorChunks.get(s.id);if(!n?.images?.length)continue;let i=this.sourceViewportBounds(s,4);for(let o of n.images){if(!St(o.bounds,i))continue;let c=this.imageResources.get(o.path)||this.createImageResource(o.path);c.loaded||this.loadImageTexture(o.path).catch(()=>{});let l=o.worldOrigin||this.sourceToWorld(s,[o.xMm,o.yMm]),f=o.worldSize||this.sourceSizeToWorld(s,o.widthMm,o.heightMm),d=this.imageUniformScratch;d[0]=l[0],d[1]=l[1],d[2]=f[0],d[3]=f[1],d[4]=0,d[5]=0,d[6]=0,d[7]=0,this.device.queue.writeBuffer(c.uniform,0,d),a||(t.setPipeline(this.imagePipeline),a=!0),t.setBindGroup(0,c.bindGroup),t.draw(6)}}}drawVisibleVectors(t,r){if(!this.isNativeScene)return 0;let a=this.vectorScratch,s=0,n=0,i=0,o=0,c=!1,l=()=>{if(!s)return;let d=this.vectorBuffers[o];d||(d=this.device.createBuffer({size:$s*4,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST}),this.vectorBuffers.push(d)),this.device.queue.writeBuffer(d,0,a,0,s),c||(t.setPipeline(this.vectorPipeline),t.setBindGroup(0,this.edgeBindGroup),c=!0);let p=Math.floor(s/6);t.setVertexBuffer(0,d),t.draw(p),i+=p,o+=1,s=0},f=d=>d>Ou||d>a.length?(n+=1,!1):((s+d>Ou||s+d>a.length)&&l(),!0);for(let d of r){if(this.domDetailPageIds.has(d.id)||!this.pageHasNativeDetail(d))continue;let p=this.vectorChunks.get(d.id);if(!p?.segments?.length&&!p?.fills?.length||!this.pageNativeDetailReady(d))continue;p.lastUsedFrame=this.frameSerial;let b=this.sourceViewportBounds(d),h=Du(p.spatial,b);for(let u of h.fills){if(!St(u.bounds,b)||!f(18))continue;let m=this.featuresById.get(u.featureId),g=this.activeNetUid&&m?.netUid===this.activeNetUid,x=this.selectedFeatureId===u.featureId?[.24,.58,1,1]:g?[.06,1,.24,1]:this.activeNetUid&&ya(m)?Ku(m,u.kind,u.color):bo(m,u.kind,u.color),v=u.worldPoints||u.points.map(E=>this.sourceToWorld(d,E));s=Ew(a,s,v[0],v[1],v[2],x)}for(let u of h.segments){if(!St(u.bounds,b))continue;let m=this.featuresById.get(u.featureId),g=this.activeNetUid&&m?.netUid===this.activeNetUid,y=this.selectedFeatureId===u.featureId,x=y?[.24,.58,1,1]:g?[.06,1,.24,1]:this.activeNetUid&&ya(m)?Ku(m,u.kind,u.color):bo(m,u.kind,u.color),v=this.segmentWorldWidth(d,u,m,g||y);for(let E of this.visibleSegmentParts(d,u,m)){if(!f(36))continue;let S=E.worldA||this.sourceToWorld(d,E.a),T=E.worldB||this.sourceToWorld(d,E.b);s=kw(a,s,S,T,v,x)}}}return l(),this.truncatedVectorCount=n,this.vectorTruncated=n>0,this.lastVectorVertices=i,this.lastVectorChunks=o,i}pageHasNativeDetail(t){return this.isNativeScene?t?.nativeDetail?.enabled!==!1:!1}scheduleVisibleVectorLoads(t){if(!this.isNativeScene)return;let r=[...this.vectorChunks.values()].filter(n=>n?.promise&&!n.loaded).length,a=Math.max(0,nw-r);if(!a)return;let s=t.filter(n=>!this.domDetailPageIds.has(n.id)).filter(n=>this.pageHasNativeDetail(n)&&this.pageSourcePixelsPerMm(n)>=this.pageNativeDetailThresholds(n).prefetch).filter(n=>!this.vectorChunks.get(n.id)?.loaded&&!this.vectorChunks.get(n.id)?.promise).sort((n,i)=>{let o=Math.hypot(n.worldX+n.widthMm/2-this.center[0],n.worldY+n.heightMm/2-this.center[1]),c=Math.hypot(i.worldX+i.widthMm/2-this.center[0],i.worldY+i.heightMm/2-this.center[1]);return o-c});for(let n of s)if(this.loadPageVectors(n).catch(()=>{}),a-=1,!a)break}featurePrimitiveBounds(t,r){let a=this.vectorChunks.get(t.id);if(!a?.segments?.length&&!a?.fills?.length)return null;let s=[],n=[];for(let i of a.segments||[])i.featureId===r&&(s.push(i.a[0],i.b[0]),n.push(i.a[1],i.b[1]));for(let i of a.fills||[])if(i.featureId===r)for(let o of i.points||[])s.push(o[0]),n.push(o[1]);return s.length?[Math.min(...s),Math.min(...n),Math.max(...s),Math.max(...n)]:null}symbolClipBounds(t){if(this._symbolClipBounds||(this._symbolClipBounds=new Map),this._symbolClipBounds.has(t.id))return this._symbolClipBounds.get(t.id);let r=(this.featuresByPage[t.id]||[]).filter(a=>a?.kind==="symbol_body"&&a.boundsMm&&!String(a.sourceId||"").includes(":overplot")).map(a=>{let s=this.featurePrimitiveBounds(t,a.id)||a.boundsMm;return[s[0]-.02,s[1]-.02,s[2]+.02,s[3]+.02]}).filter(a=>{let s=a[2]-a[0],n=a[3]-a[1];return Math.max(s,n)<=12&&s*n<=80});return this._symbolClipBounds.set(t.id,r),r}visibleSegmentParts(t,r,a){if(r._visibleParts)return r._visibleParts;let s=String(a?.kind||""),n=String(a?.semanticRole||"");if(s!=="wire"&&n!=="wire")return r._visibleParts=[r],r._visibleParts;let i=[r];for(let o of this.symbolClipBounds(t)){let c=[];for(let l of i)c.push(...Aw(l,o));if(i=c,!i.length)break}for(let o of i)o.worldA=Cr(t,o.a),o.worldB=Cr(t,o.b);return r._visibleParts=i,r._visibleParts}netTrackingSegments(){if(!this.activeNetUid)return{netUid:"",anchorsByPage:new Map,segments:[],intrasheetSegments:[]};let t=Number(this.selectedFeatureId||0),r=String(this.selectedFeatureKey||""),a=String(this.selectedSourceId||"");if(this.netTrackingCache?.netUid===this.activeNetUid&&this.netTrackingCache?.selectedFeatureId===t&&this.netTrackingCache?.selectedFeatureKey===r&&this.netTrackingCache?.selectedSourceId===a)return this.netTrackingCache;this.selectedIntrasheetLinkIndex=-1;let s=new Map(this.pages.map(h=>[h.id,h])),n=this.manifest.netToPages?.[this.activeNetUid]||[],i=n.length?n.map(h=>s.get(h)).filter(Boolean):this.pages.filter(h=>h.netUids?.includes(this.activeNetUid)),o=new Map;for(let h of i.slice(0,aw)){let u=this.netTrackingAnchorsForPage(h);u.length&&o.set(h.id,u)}let c=[],l=[];for(let[h,u]of o){let m=Gu(xw(u),"intrasheet",h);c.push(...m),l.push(...m)}let f=[...o.entries()].map(([h,u])=>ww(s.get(h),u,{featureId:t,stableKey:r,sourceId:a})).filter(Boolean);c.push(...Gu(f,"intersheet",""));let d=l.map((h,u)=>({...h,intrasheetIndex:u})),p=0,b=c.map((h,u)=>{if(h.type!=="intrasheet")return{...h,id:u};let m=p;return p+=1,{...h,id:u,intrasheetIndex:m}});return this.netTrackingCache={netUid:this.activeNetUid,selectedFeatureId:t,selectedFeatureKey:r,selectedSourceId:a,anchorsByPage:o,segments:b,intrasheetSegments:d},this.selectedIntrasheetLinkIndex>=this.netTrackingCache.intrasheetSegments.length&&(this.selectedIntrasheetLinkIndex=-1),this.netTrackingCache}netTrackingAnchorsForPage(t){let r=this.featuresByPage[t.id]||[],a=[];for(let s of r){if(s.netUid!==this.activeNetUid||!s.boundsMm||!mw(s))continue;let n=s.boundsMm,i=[(n[0]+n[2])/2,(n[1]+n[3])/2],o=this.sourceToWorld(t,i);a.push({pageId:t.id,featureId:Number(s.id||0),stableKey:String(s.stableKey||""),sourceId:String(s.sourceId||s.sourceUid||s.objectId||""),kind:s.kind||s.semanticRole||"",source:i,world:o,bounds:n,priority:yw(s)})}return a.sort((s,n)=>n.priority-s.priority||s.source[1]-n.source[1]||s.source[0]-n.source[0]),a}writeNetTrackingOverlay(){let t=this.netTrackingSegments();if(this.lastNetFlowSegments=t.segments.length,this.lastNetFlowIntrasheetSegments=t.intrasheetSegments.length,!t.segments.length)return this.lastNetFlowVertices=0,0;let r=this.worldViewportBounds(this.scale*96),a=this.netFlowScratch,s=0,n=0;for(let i of t.segments){if(!St(zu(i),r))continue;let o=i.type==="intrasheet"&&i.intrasheetIndex===this.selectedIntrasheetLinkIndex,c=o?9.5:i.type==="intersheet"?8:4.8,l=o?2:i.type==="intersheet"?1:0,f=Sw(a,s,i.a,i.b,c*this.scale,l,n,this.scale);if(f!==s&&(s=f,n+=Math.hypot(i.b[0]-i.a[0],i.b[1]-i.a[1])/Math.max(this.scale,1e-6),s+24>a.length))break}return s?(this.device.queue.writeBuffer(this.netFlowBuffer,0,a,0,s),this.lastNetFlowVertices=s/4,s/4):(this.lastNetFlowVertices=0,0)}cycleNetIntrasheetLink(t=1){let r=this.netTrackingSegments();if(!r.intrasheetSegments.length)return null;let a=r.intrasheetSegments.length;this.selectedIntrasheetLinkIndex=(this.selectedIntrasheetLinkIndex+t+a)%a;let s=r.intrasheetSegments[this.selectedIntrasheetLinkIndex];if(!s)return null;let n=zu(s,14*this.scale);return this.center=[(n[0]+n[2])/2,(n[1]+n[3])/2],this.scale=Math.max((n[2]-n[0])/Math.max(1,this.canvas.width*.36),(n[3]-n[1])/Math.max(1,this.canvas.height*.3),this.scale*.35,.025),{pageId:s.pageId,segment:s}}writeNetHighlights(t){if(!this.activeNetUid)return 0;let r=this.highlightScratch,a=0,s=0;for(let n of t){let i=this.sourceViewportBounds(n,5);for(let o of this.featuresByPage[n.id]||[]){if(o.netUid!==this.activeNetUid||!o.boundsMm||!St(o.boundsMm,i))continue;let c=this.featureWorldBounds(n,o.boundsMm);if(a+16>r.length){s+=1;continue}r[a++]=c[0],r[a++]=c[1],r[a++]=c[2],r[a++]=c[1],r[a++]=c[2],r[a++]=c[1],r[a++]=c[2],r[a++]=c[3],r[a++]=c[2],r[a++]=c[3],r[a++]=c[0],r[a++]=c[3],r[a++]=c[0],r[a++]=c[3],r[a++]=c[0],r[a++]=c[1]}}return this.truncatedHighlightCount=s,a?(this.device.queue.writeBuffer(this.highlightBuffer,0,r,0,a),a/2):0}featureWorldBounds(t,r){return[t.worldX+r[0]/t.sourceWidthMm*t.widthMm,t.worldY+r[1]/t.sourceHeightMm*t.heightMm,t.worldX+r[2]/t.sourceWidthMm*t.widthMm,t.worldY+r[3]/t.sourceHeightMm*t.heightMm]}sourceToWorld(t,r){return[t.worldX+r[0]/t.sourceWidthMm*t.widthMm,t.worldY+r[1]/t.sourceHeightMm*t.heightMm]}sourceSizeToWorld(t,r,a){return[r/t.sourceWidthMm*t.widthMm,a/t.sourceHeightMm*t.heightMm]}async loadPageVectors(t){if(!this.pageHasNativeDetail(t)||!t.chunks?.lod2)return null;let r=this.vectorChunks.get(t.id);if(r?.loaded)return r;if(r?.promise)return r.promise;let a=(async()=>{try{let s=await fetch(new URL(t.chunks.lod2,this.manifestUrl));if(!s.ok)throw new Error(`Failed to load schematic vector chunk ${t.id}: ${s.status}`);let n=await s.json(),i=cw(n.primitives||[]);lw(t,i);let c=JSON.stringify(n).length,l={loaded:!0,segments:i.segments,fills:i.fills,images:i.images,spatial:gw(i),unsupported:n.unsupported||[],bytes:c,lastUsedFrame:this.frameSerial};return this.vectorChunks.set(t.id,l),this.failedVectorChunks.delete(t.id),this.residentVectorBytes+=c,l}catch(s){let n=this.failedVectorChunks.get(t.id)||{count:0,message:""};throw this.failedVectorChunks.set(t.id,{count:n.count+1,message:s?.message||String(s)}),this.vectorChunks.delete(t.id),s}})();return this.vectorChunks.set(t.id,{loaded:!1,promise:a,segments:[]}),a}evictVectorChunks(t){if(this.residentVectorBytes<=ju)return;let r=new Set(t.map(s=>s.id)),a=[...this.vectorChunks.entries()].filter(([,s])=>s?.loaded).filter(([s])=>!r.has(s)&&s!==this.selectedPageId).sort((s,n)=>(s[1].lastUsedFrame||0)-(n[1].lastUsedFrame||0));for(let[s,n]of a)if(this.vectorChunks.delete(s),this.residentVectorBytes=Math.max(0,this.residentVectorBytes-(n.bytes||0)),this.residentVectorBytes<=ju*.82)break}stats(){let t=this.visiblePages(),r=t.map(s=>this.pageSourcePixelsPerMm(s)),a=t.map(s=>this.pageNativeDetailThresholds(s).enter);return{residentVectorBytes:this.residentVectorBytes,vectorChunks:[...this.vectorChunks.values()].filter(s=>s?.loaded).length,vectorLoads:[...this.vectorChunks.values()].filter(s=>s?.promise&&!s.loaded).length,failedVectorChunks:this.failedVectorChunks.size,vectorVertices:this.lastVectorVertices||0,vectorDrawChunks:this.lastVectorChunks||0,truncatedVectors:this.truncatedVectorCount||0,nativeDetailPages:[...this.nativeDetailState.values()].filter(Boolean).length,nativePxPerMm:Number((Math.max(0,...r)||0).toFixed(2)),nativeThresholdPxPerMm:Number((a.length?Math.min(...a):0).toFixed(2)),domDetailPages:this.domDetailPageIds.size,netFlowSegments:this.lastNetFlowSegments||0,netFlowIntrasheetSegments:this.lastNetFlowIntrasheetSegments||0,netFlowVertices:this.lastNetFlowVertices||0}}setDomDetailPageIds(t){this.domDetailPageIds=new Set(t||[])}async loadPageTexture(t,r){let a=`${t.id}:${r}`;if(this.loading.has(a))return this.loading.get(a);let s=this.pageResources.get(t.id);if(!s||s.textureWidth>=r)return;let n=(async()=>{if(!s.svgBlob){let c=await fetch(new URL(iw(t),this.manifestUrl));if(!c.ok)throw new Error(`Failed to load schematic page ${t.name}: ${c.status}`);s.svgBlob=await c.blob(),this.downloadedBytes+=s.svgBlob.size}let i=s.svgBlob,o=URL.createObjectURL(i);try{let c=new Image;if(c.decoding="async",c.src=o,await c.decode(),s.textureWidth>=r)return;let l=Math.max(64,Math.round(r*t.heightMm/t.widthMm)),f=new OffscreenCanvas(r,l),d=f.getContext("2d",{alpha:!1});d.fillStyle="#ffffff",d.fillRect(0,0,r,l),d.drawImage(c,0,0,r,l);let p=await createImageBitmap(f),b=this.device.createTexture({size:[r,l],format:"rgba8unorm-srgb",usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST|GPUTextureUsage.RENDER_ATTACHMENT});this.device.queue.copyExternalImageToTexture({source:p},{texture:b},[r,l]),p.close(),s.texture!==this.placeholder&&s.texture.destroy(),s.texture=b,s.textureWidth=r,this.updateBindGroup(s)}finally{URL.revokeObjectURL(o),this.loading.delete(a)}})();return this.loading.set(a,n),n}preloadOverview(){let t=[...this.pages],r=async()=>{for(;t.length;){let a=t.shift();await this.loadPageTexture(a,512).catch(()=>{})}};return Promise.all(Array.from({length:Math.min(4,t.length)},r))}screenToWorld(t,r){let a=this.canvas.getBoundingClientRect(),s=(t-a.left)*this.canvas.width/a.width,n=(r-a.top)*this.canvas.height/a.height;return[this.center[0]+(s-this.canvas.width/2)*this.scale,this.center[1]+(n-this.canvas.height/2)*this.scale]}worldToScreen(t,r){let a=this.canvas.clientWidth/this.canvas.width,s=this.canvas.clientHeight/this.canvas.height;return[((t-this.center[0])/this.scale+this.canvas.width/2)*a,((r-this.center[1])/this.scale+this.canvas.height/2)*s]}hitPage(t,r){let[a,s]=this.screenToWorld(t,r);return[...this.pages].reverse().find(n=>a>=n.worldX&&a<=n.worldX+n.widthMm&&s>=n.worldY&&s<=n.worldY+n.heightMm)||null}async pickFeature(t,r){if(!this.isNativeScene)return this.hitFeature(t,r);let a=this.hitPage(t,r);if(!a)return null;if(!this.pageHasNativeDetail(a))return this.hitFeature(t,r);await this.loadPageVectors(a);let s=await this.gpuPickFeature(a,t,r);return s&&!ma(s)?{page:a,feature:s,source:this.clientToSource(a,t,r),native:!0,gpu:!0}:this.hitFeature(t,r)}hitFeature(t,r){let a=this.hitPage(t,r);if(!a)return null;let[s,n]=this.clientToSource(a,t,r),i=Math.max(.45,5*this.scale*this.canvas.width/Math.max(1,this.canvas.clientWidth)*a.sourceWidthMm/a.widthMm),o=this.hitResidentVectorFeature(a,s,n,i);if(o)return{page:a,feature:o,source:[s,n],native:!0};let c=this.hitSymbolInterior(a,s,n);if(c)return{page:a,feature:c,source:[s,n],native:!0,interior:!0};let l=(this.featuresByPage[a.id]||[]).filter(f=>{if(ma(f))return!1;let d=f.boundsMm;return d&&s>=d[0]-i&&s<=d[2]+i&&n>=d[1]-i&&n<=d[3]+i}).map(f=>({feature:f,priority:ga(f),area:Math.max(1e-4,(f.boundsMm[2]-f.boundsMm[0])*(f.boundsMm[3]-f.boundsMm[1]))})).sort((f,d)=>d.priority-f.priority||f.area-d.area);return{page:a,feature:l[0]?.feature||null,source:[s,n]}}hitSymbolInterior(t,r,a){let s=null;for(let n of this.featuresByPage[t.id]||[]){let i=String(n?.kind||"");if(i!=="symbol_body"&&i!=="symbol_instance"||String(n?.sourceId||"").includes(":overplot"))continue;let o=n.boundsMm;if(!o||r<o[0]||r>o[2]||a<o[1]||a>o[3])continue;let c=Math.max(1e-4,(o[2]-o[0])*(o[3]-o[1])),l=(i==="symbol_body"?0:1e6)+c;(!s||l<s.score)&&(s={feature:n,score:l})}return s?.feature||null}clientToSource(t,r,a){let[s,n]=this.screenToWorld(r,a);return[(s-t.worldX)/t.widthMm*t.sourceWidthMm,(n-t.worldY)/t.heightMm*t.sourceHeightMm]}ensurePickTexture(){this.pickTexture&&this.pickTextureSize[0]===this.canvas.width&&this.pickTextureSize[1]===this.canvas.height||(this.pickTexture&&this.pickTexture.destroy(),this.pickTexture=this.device.createTexture({size:[this.canvas.width,this.canvas.height],format:"r32uint",usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.COPY_SRC}),this.pickTextureSize=[this.canvas.width,this.canvas.height])}writePickVectors(t){let r=new ArrayBuffer(Xs*12),a=new DataView(r),s=0,n=[];for(let i of t){let o=this.vectorChunks.get(i.id);if(!o?.segments?.length&&!o?.fills?.length&&!o?.images?.length)continue;let c=this._pickSourcePointByPage?.get(i.id),l=c?[c[0]-2.5,c[1]-2.5,c[0]+2.5,c[1]+2.5]:[0,0,i.sourceWidthMm,i.sourceHeightMm],f=Du(o.spatial,l);for(let d of f.images){if(!St(d.bounds,l))continue;let p=this.featuresById.get(d.featureId);!p||ma(p)||n.push({page:i,image:d,feature:p,priority:ga(p)-5})}for(let d of f.fills){if(!St(d.bounds,l))continue;let p=this.featuresById.get(d.featureId);!p||ma(p)||n.push({page:i,fill:d,feature:p,priority:ga(p)-2})}for(let d of f.segments){if(!St(d.bounds,l))continue;let p=this.featuresById.get(d.featureId);!p||ma(p)||n.push({page:i,segment:d,feature:p,priority:ga(p)})}}n.sort((i,o)=>i.priority-o.priority);for(let{page:i,segment:o,fill:c,image:l,feature:f}of n){if(s+6>Xs)break;if(l){let d=this.sourceToWorld(i,[l.xMm,l.yMm]),p=this.sourceToWorld(i,[l.xMm+l.widthMm,l.yMm]),b=this.sourceToWorld(i,[l.xMm,l.yMm+l.heightMm]),h=this.sourceToWorld(i,[l.xMm+l.widthMm,l.yMm+l.heightMm]);s=ho(a,s,d,p,b,l.featureId),s=ho(a,s,b,p,h,l.featureId)}else if(c){let d=c.worldPoints||c.points.map(p=>this.sourceToWorld(i,p));s=ho(a,s,d[0],d[1],d[2],c.featureId)}else{let d=Math.max(this.segmentWorldWidth(i,o,f,!1),this.scale*7);for(let p of this.visibleSegmentParts(i,o,f)){if(s+6>Xs)break;let b=p.worldA||this.sourceToWorld(i,p.a),h=p.worldB||this.sourceToWorld(i,p.b);s=_w(a,s,b,h,d,o.featureId)}}}return s?(this.device.queue.writeBuffer(this.pickVertexBuffer,0,r,0,s*12),s):0}async gpuPickFeature(t,r,a){if(this.pickPending)return null;let s=this.clientToSource(t,r,a);this._pickSourcePointByPage=new Map([[t.id,s]]);let n=this.writePickVectors([t]);if(this._pickSourcePointByPage=null,!n)return null;this.resize(),this.writeGlobals(),this.ensurePickTexture();let i=this.canvas.getBoundingClientRect(),o=Math.max(0,Math.min(this.canvas.width-1,Math.floor((r-i.left)*this.canvas.width/i.width))),c=Math.max(0,Math.min(this.canvas.height-1,Math.floor((a-i.top)*this.canvas.height/i.height))),l=this.device.createCommandEncoder(),f=l.beginRenderPass({colorAttachments:[{view:this.pickTexture.createView(),clearValue:{r:0,g:0,b:0,a:0},loadOp:"clear",storeOp:"store"}]});f.setPipeline(this.pickPipeline),f.setBindGroup(0,this.edgeBindGroup),f.setVertexBuffer(0,this.pickVertexBuffer),f.draw(n),f.end(),l.copyTextureToBuffer({texture:this.pickTexture,origin:{x:o,y:c}},{buffer:this.pickReadBuffer,bytesPerRow:256,rowsPerImage:1},{width:1,height:1,depthOrArrayLayers:1}),this.pickPending=!0,this.device.queue.submit([l.finish()]);try{await this.pickReadBuffer.mapAsync(GPUMapMode.READ);let d=new DataView(this.pickReadBuffer.getMappedRange()).getUint32(0,!0);return this.pickReadBuffer.unmap(),d&&this.featuresById.get(d)||null}finally{this.pickReadBuffer.mapState==="mapped"&&this.pickReadBuffer.unmap(),this.pickPending=!1}}hitResidentVectorFeature(t,r,a,s){if(!this.isNativeScene)return null;let n=this.vectorChunks.get(t.id);if(!n?.loaded)return null;let i=null;for(let o of n.segments){let c=this.featuresById.get(o.featureId),l=Math.max(s,(o.widthMm||0)*.5+s*.45);if(c)for(let f of this.visibleSegmentParts(t,o,c)){let d=Tw([r,a],f.a,f.b);if(d>l)continue;let p=d-ga(c)*.025+(ya(c)?0:8);(!i||p<i.score)&&(i={feature:c,score:p})}}return i?.feature||null}segmentWorldWidth(t,r,a,s){let n=(r.widthMm||.15)/Math.max(1,t.sourceWidthMm)*t.widthMm;return Math.max(n,this.scale*Mw(a,r.kind,s))}pan(t,r){let a=this.canvas.width/Math.max(1,this.canvas.clientWidth);this.center[0]-=t*this.scale*a,this.center[1]-=r*this.scale*a}zoom(t,r,a){let s=this.screenToWorld(r,a);this.scale=be(this.scale*Math.exp(t*.0015),.015,16);let n=this.screenToWorld(r,a);this.center[0]+=s[0]-n[0],this.center[1]+=s[1]-n[1]}framePage(t){t&&(this.resize(),this.center=[t.worldX+t.widthMm/2,t.worldY+t.heightMm/2],this.scale=Math.max(t.widthMm/Math.max(1,this.canvas.width*.88),t.heightMm/Math.max(1,this.canvas.height*.84)))}frameWorld(){this.resize(),this.center=[(this.world.minX+this.world.maxX)/2,(this.world.minY+this.world.maxY)/2],this.scale=Math.max((this.world.maxX-this.world.minX)/Math.max(1,this.canvas.width*.9),(this.world.maxY-this.world.minY)/Math.max(1,this.canvas.height*.88),.05)}};function iw(e){return e.thumbnail?.path||e.svg}function ow(e){if(e.schema==="prism.schematic_vector_a0.features"){let t=new Map((e.features||[]).map(a=>[Number(a.id),a])),r={};for(let[a,s]of Object.entries(e.pages||{}))r[a]=s.map(n=>t.get(Number(n))).filter(Boolean);return r}return e.pages||{}}function cw(e){let t=[],r=[],a=[];for(let s of e){let n=Number(s.featureId||0);if(!n)continue;if(s.kind==="plotimage"&&s.image?.path){let y=s.xMm||0,x=s.yMm||0,v=s.widthMm||0,E=s.heightMm||0;a.push({featureId:n,kind:s.kind,xMm:y,yMm:x,widthMm:v,heightMm:E,bounds:[y,x,y+v,x+E],path:s.image.path});continue}let i=String(s.semanticRole||""),o=s.radiusMm||s.diameterMm/2||0,c=String(s.fill||"").toUpperCase()==="FILLED_SHAPE",l=s.widthMm||s.pen_widthMm||(i==="junction"?.08:.15),f=String(s.lineStyle||s.line_style||"DEFAULT").toUpperCase(),d=s.color||s.strokeColor||s.style?.color||"",p=s.fillColor||s.color||s.style?.color||"",b=(y,x)=>bw(t,{featureId:n,kind:s.kind,widthMm:l,lineStyle:f,color:d},y,x),h=s.x1Mm,u=s.y1Mm,m=s.x2Mm,g=s.y2Mm;if(s.trianglesMm?.length){for(let y of s.trianglesMm)Array.isArray(y)&&y.length===3&&r.push({featureId:n,kind:s.kind,color:p,points:y,bounds:Vu(y)});if(s.pointsMm?.length>=2){for(let y=1;y<s.pointsMm.length;y+=1)b(s.pointsMm[y-1],s.pointsMm[y]);Uu(s)&&b(s.pointsMm[s.pointsMm.length-1],s.pointsMm[0])}}else if(s.pointsMm?.length>=2){c&&s.pointsMm.length>=3&&hw(r,n,s.kind,s.pointsMm,p);for(let y=1;y<s.pointsMm.length;y+=1)b(s.pointsMm[y-1],s.pointsMm[y]);Uu(s)&&b(s.pointsMm[s.pointsMm.length-1],s.pointsMm[0])}else if(s.polylinesMm?.length){for(let y of s.polylinesMm)if(!(!Array.isArray(y)||y.length<2))for(let x=1;x<y.length;x+=1)b(y[x-1],y[x])}else if(Number.isFinite(h)&&Number.isFinite(u)&&Number.isFinite(m)&&Number.isFinite(g))s.kind==="rect"?(c&&uw(r,n,s.kind,[h,u,m,g],p),b([h,u],[m,u]),b([m,u],[m,g]),b([m,g],[h,g]),b([h,g],[h,u])):b([h,u],[m,g]);else if(Number.isFinite(s.cxMm)&&Number.isFinite(s.cyMm)){let y=s.radiusMm||s.diameterMm/2||.4;c&&fw(r,n,s.kind,[s.cxMm,s.cyMm],y,p),pw(t,{featureId:n,kind:s.kind,widthMm:l,lineStyle:f,color:d},[s.cxMm,s.cyMm],y)}else if(s.contoursMm?.length){for(let y of s.contoursMm)if(!(!Array.isArray(y)||y.length<2)){for(let x=1;x<y.length;x+=1)b(y[x-1],y[x]);b(y[y.length-1],y[0])}}else if(Number.isFinite(s.start_xMm)&&Number.isFinite(s.start_yMm)&&Number.isFinite(s.end_xMm)&&Number.isFinite(s.end_yMm))Number.isFinite(s.mid_xMm)&&Number.isFinite(s.mid_yMm)?(b([s.start_xMm,s.start_yMm],[s.mid_xMm,s.mid_yMm]),b([s.mid_xMm,s.mid_yMm],[s.end_xMm,s.end_yMm])):b([s.start_xMm,s.start_yMm],[s.end_xMm,s.end_yMm]);else if(Number.isFinite(s.start_xMm)&&Number.isFinite(s.start_yMm)&&Number.isFinite(s.mid_xMm)&&Number.isFinite(s.mid_yMm)&&Number.isFinite(s.end_xMm)&&Number.isFinite(s.end_yMm))b([s.start_xMm,s.start_yMm],[s.mid_xMm,s.mid_yMm]),b([s.mid_xMm,s.mid_yMm],[s.end_xMm,s.end_yMm]);else if(s.boundsMm&&s.kind!=="text"){let[y,x,v,E]=s.boundsMm;b([y,x],[v,x]),b([v,x],[v,E]),b([v,E],[y,E]),b([y,E],[y,x])}}return{segments:t,fills:r,images:a}}function lw(e,t){for(let r of t.segments||[])r.worldA=Cr(e,r.a),r.worldB=Cr(e,r.b);for(let r of t.fills||[])r.worldPoints=r.points.map(a=>Cr(e,a));for(let r of t.images||[])r.worldOrigin=Cr(e,[r.xMm,r.yMm]),r.worldSize=dw(e,r.widthMm,r.heightMm)}function Cr(e,t){return[e.worldX+t[0]/e.sourceWidthMm*e.widthMm,e.worldY+t[1]/e.sourceHeightMm*e.heightMm]}function dw(e,t,r){return[t/e.sourceWidthMm*e.widthMm,r/e.sourceHeightMm*e.heightMm]}function uw(e,t,r,a,s){let[n,i,o,c]=a;e.push({featureId:t,kind:r,color:s,points:[[n,i],[o,i],[n,c]],bounds:[n,i,o,c]},{featureId:t,kind:r,color:s,points:[[n,c],[o,i],[o,c]],bounds:[n,i,o,c]})}function fw(e,t,r,a,s,n){for(let o=0;o<36;o+=1){let c=o/36*Math.PI*2,l=(o+1)/36*Math.PI*2;e.push({featureId:t,kind:r,color:n,points:[a,[a[0]+Math.cos(c)*s,a[1]+Math.sin(c)*s],[a[0]+Math.cos(l)*s,a[1]+Math.sin(l)*s]],bounds:[a[0]-s,a[1]-s,a[0]+s,a[1]+s]})}}function hw(e,t,r,a,s){let n=a[0],i=Vu(a);for(let o=2;o<a.length;o+=1)e.push({featureId:t,kind:r,color:s,points:[n,a[o-1],a[o]],bounds:i})}function bw(e,t,r,a){let s=Lu(r,a,t.widthMm||.15),n=t.lineStyle||"DEFAULT";if(!["DASH","DASHED","DOT","DOTTED","DASHDOT","DASH_DOT"].includes(n)){e.push({...t,a:r,b:a,bounds:s});return}let i=a[0]-r[0],o=a[1]-r[1],c=Math.hypot(i,o);if(c<1e-6)return;let l=i/c,f=o/c,d=Math.max(t.widthMm*4,.45),p=n.includes("DOT")?[d*.8,d*.75,d*3,d*.75]:[d*3,d*1.5],b=0,h=0;for(;b<c;){let u=Math.min(p[h%p.length],c-b);if(h%2===0){let m=[r[0]+l*b,r[1]+f*b],g=[r[0]+l*(b+u),r[1]+f*(b+u)];e.push({...t,a:m,b:g,bounds:Lu(m,g,t.widthMm||.15)})}b+=u,h+=1}}function pw(e,t,r,a){for(let n=0;n<32;n+=1){let i=n/32*Math.PI*2,o=(n+1)/32*Math.PI*2;e.push({...t,a:[r[0]+Math.cos(i)*a,r[1]+Math.sin(i)*a],b:[r[0]+Math.cos(o)*a,r[1]+Math.sin(o)*a],bounds:[r[0]-a,r[1]-a,r[0]+a,r[1]+a]})}}function Vu(e,t=0){let r=1/0,a=1/0,s=-1/0,n=-1/0;for(let i of e||[])r=Math.min(r,i[0]),a=Math.min(a,i[1]),s=Math.max(s,i[0]),n=Math.max(n,i[1]);return Number.isFinite(r)?[r-t,a-t,s+t,n+t]:[0,0,0,0]}function Lu(e,t,r=0){let a=Math.max(.05,r*.5);return[Math.min(e[0],t[0])-a,Math.min(e[1],t[1])-a,Math.max(e[0],t[0])+a,Math.max(e[1],t[1])+a]}function St(e,t){return!e||!t?!0:e[0]<=t[2]&&e[2]>=t[0]&&e[1]<=t[3]&&e[3]>=t[1]}function gw(e){let t={cellSize:sw,cells:new Map,segments:e.segments||[],fills:e.fills||[],images:e.images||[],queryId:0};for(let r of t.segments)uo(t,"segments",r);for(let r of t.fills)uo(t,"fills",r);for(let r of t.images)uo(t,"images",r);return t}function uo(e,t,r){let a=r.bounds;if(!a)return;let s=Math.floor(a[0]/e.cellSize),n=Math.floor(a[2]/e.cellSize),i=Math.floor(a[1]/e.cellSize),o=Math.floor(a[3]/e.cellSize);for(let c=i;c<=o;c+=1)for(let l=s;l<=n;l+=1){let f=`${l}:${c}`,d=e.cells.get(f);d||(d={segments:[],fills:[],images:[]},e.cells.set(f,d)),d[t].push(r)}}function Du(e,t){if(!e)return{segments:[],fills:[],images:[]};e.queryId=(e.queryId||0)+1;let r=e.queryId,a={segments:[],fills:[],images:[]},s=Math.floor(t[0]/e.cellSize),n=Math.floor(t[2]/e.cellSize),i=Math.floor(t[1]/e.cellSize),o=Math.floor(t[3]/e.cellSize);for(let c=i;c<=o;c+=1)for(let l=s;l<=n;l+=1){let f=e.cells.get(`${l}:${c}`);f&&(fo(f.segments,a.segments,r,"segments"),fo(f.fills,a.fills,r,"fills"),fo(f.images,a.images,r,"images"))}return a}function fo(e,t,r,a){let s=`_${a}QueryId`;for(let n of e)n[s]!==r&&(n[s]=r,t.push(n))}function Uu(e){let t=String(e.kind||"");if(String(e.fill||"").toUpperCase()==="FILLED_SHAPE"||e.closed===!0||["polygon","fill"].includes(t))return!0;let a=e.pointsMm||[];if(a.length>=3){let s=a[0],n=a[a.length-1];return Math.hypot(s[0]-n[0],s[1]-n[1])<1e-6}return!1}function ya(e){return!!e?.netUid}function mw(e){let t=String(e?.kind||""),r=String(e?.semanticRole||"");return t==="pin"||t==="pin_body"||t==="label"||t==="global_label"||t==="hierarchical_label"||t==="netclass_flag"||t==="power_symbol"||t==="power_port"||r==="label"||r==="global_label"||r==="hierarchical_label"}function yw(e){let t=String(e?.kind||""),r=String(e?.semanticRole||"");return t==="global_label"||r==="global_label"?130:t==="hierarchical_label"||r==="hierarchical_label"?125:t==="label"||r==="label"?118:t==="pin"||t==="pin_body"?106:t==="power_symbol"||t==="power_port"||t==="netclass_flag"?98:50}function xw(e){if(e.length<=Pu)return e;let t=e.slice(0,Pu);return t.sort((r,a)=>r.source[1]-a.source[1]||r.source[0]-a.source[0]),t}function ww(e,t,r={}){if(!e||!t?.length)return null;let a=r.featureId||r.stableKey||r.sourceId?t.find(l=>r.featureId&&Number(l.featureId||0)===Number(r.featureId)||r.stableKey&&l.stableKey===r.stableKey||r.sourceId&&l.sourceId===r.sourceId):null;if(a)return{...a,kind:"selected-net-occurrence",priority:200};let s=t.filter(l=>l.priority>=118).slice(0,16),n=s.length?s:t.slice(0,16),i=0,o=0;for(let l of n)i+=l.world[0],o+=l.world[1];let c=[i/n.length,o/n.length];return{pageId:e.id,featureId:n[0]?.featureId||0,kind:"page-net-occurrence",source:[0,0],world:c,bounds:[c[0],c[1],c[0],c[1]],priority:1}}function Gu(e,t,r){if(!e||e.length<2)return[];let a=e.map(i=>({...i})).sort((i,o)=>i.world[1]-o.world[1]||i.world[0]-o.world[0]),s=[],n=a.shift();for(;a.length;){let i=0,o=1/0;for(let l=0;l<a.length;l+=1){let f=a[l],d=Math.hypot(f.world[0]-n.world[0],f.world[1]-n.world[1]);d<o&&(o=d,i=l)}let c=a.splice(i,1)[0];s.push({type:t,pageId:r||n.pageId||c.pageId||"",a:n.world,b:c.world,sourceFeatureIds:[n.featureId,c.featureId].filter(Boolean)}),n=c}return s}function zu(e,t=0){return[Math.min(e.a[0],e.b[0])-t,Math.min(e.a[1],e.b[1])-t,Math.max(e.a[0],e.b[0])+t,Math.max(e.a[1],e.b[1])+t]}function ga(e){let t=String(e?.kind||""),a=String(e?.semanticRole||"")||t;return a==="pin_number"||a==="pin_name"?120:a==="pin_body"||t==="pin"?110:a==="symbol_reference"||a==="symbol_value"?92:t==="junction"||t==="no_connect"?88:t==="wire"||t==="bus"||t==="bus_entry"?78:a==="symbol_body"||t==="symbol_body"?45:t==="symbol_instance"||t==="symbol_overplot"?30:t==="text"||String(a).includes("text")?24:10}function ma(e){let t=String(e?.kind||""),r=String(e?.semanticRole||"");if(t==="page"||t==="sheet_header")return!0;if(t==="graphic_rect"&&r==="graphic_rect"&&!e?.netUid&&!e?.componentUid){let a=e.boundsMm||[];return a[2]-a[0]>150&&a[3]-a[1]>120}return!1}function vw(e){if(!e||typeof e!="string")return null;let r=e.trim().match(/^#([0-9a-f]{6})([0-9a-f]{2})?$/i);if(!r)return null;let a=r[1],s=r[2]??"ff";return[parseInt(a.slice(0,2),16)/255,parseInt(a.slice(2,4),16)/255,parseInt(a.slice(4,6),16)/255,parseInt(s,16)/255]}function bo(e,t,r=""){let a=vw(r||e?.color||"");return e?.kind==="dnp_marker"?a||[.86,.04,.05,.85]:e?.dnp&&["symbol_reference","symbol_value","symbol_text"].includes(String(e?.kind||""))?[.5,.52,.54,.56]:a||(e?.dnp?[.5,.52,.54,.56]:ya(e)?[.12,.56,.2,.96]:e?.kind==="pin_name"?[0,.28,.31,.96]:e?.kind==="pin_number"?[.45,.17,.16,.96]:e?.kind==="pin_body"?[.28,.18,.18,.88]:e?.kind==="symbol_body"||e?.kind==="symbol_instance"?[.42,.18,.18,.72]:e?.kind==="symbol_reference"||e?.kind==="symbol_value"?[.05,.13,.16,.94]:e?.kind==="text"||String(t||"").startsWith("text")?[.05,.13,.16,.94]:[.16,.17,.19,.7])}function Ku(e,t,r=""){let a=bo(e,t,r);return[a[0]*.72,a[1]*.72,a[2]*.72,Math.min(a[3],.38)]}function Mw(e,t,r){return r?5.5:e?.kind==="dnp_marker"?3:["pin_name","pin_number"].includes(String(e?.kind||""))?1.5:e?.kind==="pin_body"?1.7:String(t||"").startsWith("text")?1.35:t==="bus"||e?.kind==="bus"?4.2:ya(e)?2.6:e?.kind==="symbol_body"||e?.kind==="symbol_instance"||e?.kind==="sheet"?1.5:1.25}function Ys(e,t,r,a){return e[t++]=r[0],e[t++]=r[1],e[t++]=a[0],e[t++]=a[1],e[t++]=a[2],e[t++]=a[3],t}function kw(e,t,r,a,s,n){let i=Hu(r,a,s);if(!i)return t;for(let o of i)t=Ys(e,t,o,n);return t}function Ew(e,t,r,a,s,n){return t=Ys(e,t,r,n),t=Ys(e,t,a,n),t=Ys(e,t,s,n),t}function Nr(e,t,r,a,s){return e[t++]=r[0],e[t++]=r[1],e[t++]=a,e[t++]=s,t}function Sw(e,t,r,a,s,n,i,o){let c=a[0]-r[0],l=a[1]-r[1],f=Math.hypot(c,l);if(f<1e-6||t+24>e.length)return t;let d=s*.5,p=c/f,h=-(l/f)*d,u=p*d,m=[r[0]+h,r[1]+u],g=[r[0]-h,r[1]-u],y=[a[0]+h,a[1]+u],x=[a[0]-h,a[1]-u],v=i+f/Math.max(o,1e-6);return t=Nr(e,t,m,i,n),t=Nr(e,t,g,i,n),t=Nr(e,t,y,v,n),t=Nr(e,t,y,v,n),t=Nr(e,t,g,i,n),t=Nr(e,t,x,v,n),t}function Hu(e,t,r){let a=t[0]-e[0],s=t[1]-e[1],n=Math.hypot(a,s);if(n<1e-6)return null;let i=r*.5,o=a/n*i,c=s/n*i,l=-s/n*i,f=a/n*i,d=[e[0]-o,e[1]-c],p=[t[0]+o,t[1]+c],b=[d[0]+l,d[1]+f],h=[d[0]-l,d[1]-f],u=[p[0]+l,p[1]+f],m=[p[0]-l,p[1]-f];return[b,h,u,u,h,m]}function Tw(e,t,r){let a=r[0]-t[0],s=r[1]-t[1],n=a*a+s*s||1,i=be(((e[0]-t[0])*a+(e[1]-t[1])*s)/n,0,1),o=t[0]+a*i,c=t[1]+s*i;return Math.hypot(e[0]-o,e[1]-c)}function Aw(e,t){let[r,a,s,n]=t,[i,o]=e.a,[c,l]=e.b,f=1e-6,d=(p,b)=>({...e,a:p,b});if(Math.abs(o-l)<=f){let p=o;if(p<a-f||p>n+f)return[e];let b=Math.min(i,c),h=Math.max(i,c),u=Math.max(b,r),m=Math.min(h,s);if(m<=u+f)return[e];let g=[],y=i<=c;if(b<u-f){let x=y?[b,p]:[u,p],v=y?[u,p]:[b,p];g.push(d(x,v))}if(m<h-f){let x=y?[m,p]:[h,p],v=y?[h,p]:[m,p];g.push(d(x,v))}return g}if(Math.abs(i-c)<=f){let p=i;if(p<r-f||p>s+f)return[e];let b=Math.min(o,l),h=Math.max(o,l),u=Math.max(b,a),m=Math.min(h,n);if(m<=u+f)return[e];let g=[],y=o<=l;if(b<u-f){let x=y?[p,b]:[p,u],v=y?[p,u]:[p,b];g.push(d(x,v))}if(m<h-f){let x=y?[p,m]:[p,h],v=y?[p,h]:[p,m];g.push(d(x,v))}return g}return[e]}function Js(e,t,r,a){let s=t*12;e.setFloat32(s,r[0],!0),e.setFloat32(s+4,r[1],!0),e.setUint32(s+8,a,!0)}function _w(e,t,r,a,s,n){let i=Hu(r,a,s);if(!i)return t;for(let o of i)Js(e,t,o,n),t+=1;return t}function ho(e,t,r,a,s,n){return Js(e,t,r,n),Js(e,t+1,a,n),Js(e,t+2,s,n),t+3}function Iw(e,t){let r=Array.isArray(e?.layerIds)?e.layerIds:[];if(r.length<2&&e?.startLayerId!=null&&e?.endLayerId!=null&&(r=[e.startLayerId,e.endLayerId]),r.length<2&&e?.layerMask!=null)try{let a=BigInt(String(e.layerMask));r=t.filter((s,n)=>(a&1n<<BigInt(n))!==0n).map(s=>s.id)}catch{r=[]}return r}function Rw(e){let t=e?.objectFeatureId??e?.id;if(t!=null&&Number.isFinite(Number(t))&&Number(t)!==0)return`feature:${Number(t)}`;let r=String(e?.sourceUid||"");return r?`source:${r}`:""}function qu(e,t){let r=new Map(e.map((o,c)=>[Number(o.id),c])),a=new Map(e.map(o=>[Number(o.id),o])),s=new Map,n=new Set,i={thru:0,blind:0,buried:0};for(let o of t){let c=Rw(o);if(c){if(n.has(c))continue;n.add(c)}let l=[...new Set(Iw(o,e).map(Number))].filter(x=>r.has(x)).sort((x,v)=>r.get(x)-r.get(v));if(l.length<2)continue;let f=l[0],d=l[l.length-1],p=r.get(f),b=r.get(d),h=p===0,u=b===e.length-1,m=h&&u?"thru":h||u?"blind":"buried";i[m]+=1;let g=`${f}:${d}:${m}`,y=s.get(g);if(y){y.count+=1;continue}s.set(g,{startId:f,endId:d,startName:a.get(f)?.name||String(f),endName:a.get(d)?.name||String(d),startIndex:p,endIndex:b,type:m,count:1})}return{counts:i,spans:[...s.values()]}}var xa="http://www.w3.org/2000/svg";var Nw=new Set(["script","foreignobject","iframe","object","embed"]),Cw=new Set(["href","xlink:href"]),Bw=1,Ow=18,Fw=8,tn=class e{static create(t,r,a,s,n={}){return new e(t,r,a,s,n)}constructor(t,r,a,s,n){this.host=t,this.manifestUrl=r,this.manifest=a,this.featuresByPage=s||{},this.callbacks=n,this.activePage=null,this.activeSvgUrl="",this.container=null,this.svg=null,this.overlay=null,this.mountedPages=new Map,this.loadingPages=new Map,this.svgCache=new Map,this.serial=0,this.maxMountedWorldPages=Bw,this.maxCachedSvgPages=Ow,this.worldHandlersInstalled=!1,this.worldDrag=null,this.view={scale:1,tx:0,ty:0},this.drag=null,this.selected=null,this.highlightedNetUid="",this.index=Yu(),this.lastStats={mountedPages:0,domNodes:0,indexedFeatures:0,indexedNets:0,mountMs:0,coldMounts:0,warmMounts:0,highlightMs:0,selectionMs:0,cachedSvgPages:0,cachedSvgBytes:0,heapMb:null,fallbackReason:""}}get active(){return!!(this.container&&this.activePage)}get worldActive(){return this.mountedPages.size>0}stats(){return{...this.lastStats,activePage:this.activePage?.name||[...this.mountedPages.values()][0]?.page?.name||"-",mountedPages:this.active?1:this.mountedPages.size}}dispose(){this.unmountPage(),this.unmountWorldPages()}unmountPage(){this.container?.remove(),this.container=null,this.svg=null,this.overlay=null,this.activePage=null,this.activeSvgUrl="",this.index=Yu(),this.host.hidden=!0}unmountWorldPages(){for(let t of this.mountedPages.values())t.container.remove();this.mountedPages.clear(),this.loadingPages.clear(),this.active||(this.host.hidden=!0)}async preloadPages(t){let r=performance.now(),a=await Promise.allSettled((t||[]).slice(0,Fw).map(s=>this.loadSvgTemplate(s)));this.lastStats.preloadedPages=a.filter(s=>s.status==="fulfilled"&&s.value).length,this.lastStats.preloadMs=performance.now()-r,this.updateCacheStats()}syncWorldPages(t,r,a={}){if(!r)return;this.installWorldHandlers(r);let s=(t||[]).slice(0,a.maxMountedPages||this.maxMountedWorldPages),n=new Set(s.map(i=>i.id));for(let[i,o]of this.mountedPages)n.has(i)||(o.container.remove(),this.mountedPages.delete(i));for(let i of s){let o=this.mountedPages.get(i.id);if(o)o.lastUsed=++this.serial,this.positionWorldEntry(o,r);else if(!this.loadingPages.has(i.id)){let c=this.mountWorldPage(i).then(l=>{l&&n.has(i.id)?this.positionWorldEntry(l,r):l?.container.remove()}).finally(()=>this.loadingPages.delete(i.id));this.loadingPages.set(i.id,c)}}this.pruneMountedWorldPages(n),this.host.hidden=s.length===0&&!this.active,this.setSelection(this.selected),this.setHighlightedNet(a.activeNetUid??this.highlightedNetUid),this.lastStats.mountedPages=this.mountedPages.size,this.updateCacheStats()}async mountWorldPage(t){let r=performance.now(),a=this.hasCachedSvg(t),s=await this.loadImportedSvg(t);if(!s)return null;let n=document.createElement("div");n.className="svg-dom-page svg-dom-world-page",n.dataset.pageId=t.id,n.append(s),this.host.append(n);let i=Xu(s),o=$u(s),c=Wu(s,t,this.featuresByPage[t.id]||[]),l={page:t,container:n,svg:s,overlay:i,selectionOverlay:o,index:c,mountMs:performance.now()-r,lastUsed:++this.serial,warm:a};return this.mountedPages.set(t.id,l),this.lastStats={...this.lastStats,mountedPages:this.mountedPages.size,domNodes:[...this.mountedPages.values()].reduce((f,d)=>f+d.svg.querySelectorAll("*").length,0),indexedFeatures:[...this.mountedPages.values()].reduce((f,d)=>f+d.index.featureToElements.size,0),indexedNets:new Set([...this.mountedPages.values()].flatMap(f=>[...f.index.netToElements.keys()])).size,mountMs:l.mountMs,coldMounts:this.lastStats.coldMounts+(l.warm?0:1),warmMounts:this.lastStats.warmMounts+(l.warm?1:0),fallbackReason:""},this.updateCacheStats(),l}async loadImportedSvg(t){let r=await this.loadSvgTemplate(t);return r?r.cloneNode(!0):null}async loadSvgTemplate(t){let r=this.svgUrlForPage(t),a=this.svgCache.get(r);if(a?.template)return a.lastUsed=++this.serial,a.template;if(a?.promise)return a.promise;let s=performance.now(),n=(async()=>{let i=await fetch(r,{cache:"default"});if(!i.ok)return this.lastStats.fallbackReason=`Failed to load SVG page ${t.id}: ${i.status}`,this.callbacks.onFallback?.(this.lastStats.fallbackReason),null;let o=await i.text(),l=new DOMParser().parseFromString(o,"image/svg+xml"),f=l.documentElement;if(!f||f.localName.toLowerCase()!=="svg"||l.querySelector("parsererror"))return this.lastStats.fallbackReason=`Invalid SVG for page ${t.id}`,this.callbacks.onFallback?.(this.lastStats.fallbackReason),null;Pw(l,r,t.id);let d=document.importNode(f,!0);d.classList.add("svg-dom-page-svg"),zw(d);let p=this.svgCache.get(r)||{};return Object.assign(p,{template:d,promise:null,pageId:t.id,byteLength:o.length*2,loadMs:performance.now()-s,lastUsed:++this.serial}),this.svgCache.set(r,p),this.pruneSvgCache(),this.updateCacheStats(),d})();return this.svgCache.set(r,{promise:n,pageId:t.id,byteLength:0,loadMs:0,lastUsed:++this.serial}),n}svgUrlForPage(t){return new URL(t.svg||t.thumbnail?.path,this.manifestUrl).toString()}positionWorldEntry(t,r){let{page:a,container:s}=t,[n,i]=r.worldToScreen(a.worldX,a.worldY),[o,c]=r.worldToScreen(a.worldX+a.widthMm,a.worldY+a.heightMm),l=Math.max(1,o-n),f=Math.max(1,c-i);s.style.transform=`translate3d(${n}px, ${i}px, 0)`,s.style.width=`${l}px`,s.style.height=`${f}px`}installWorldHandlers(t){if(this.worldHandlersInstalled)return;this.worldHandlersInstalled=!0;let r=this.host;r.oncontextmenu=a=>a.preventDefault(),r.onpointerdown=a=>{let s=a.button===0&&!a.shiftKey&&!!a.target.closest?.("text"),i=a.target.closest?.("[data-feature-key]")?null:this.featureAtEvent(a);this.worldDrag={pointerId:a.pointerId,startX:a.clientX,startY:a.clientY,lastX:a.clientX,lastY:a.clientY,button:a.button,moved:!1,pan:!s&&(a.button===0||a.button===1||a.shiftKey),allowTextSelection:s},s||r.setPointerCapture(a.pointerId)},r.onpointermove=a=>{if(!this.worldDrag||this.worldDrag.pointerId!==a.pointerId)return;let s=a.clientX-this.worldDrag.lastX,n=a.clientY-this.worldDrag.lastY;this.worldDrag.lastX=a.clientX,this.worldDrag.lastY=a.clientY,Math.hypot(a.clientX-this.worldDrag.startX,a.clientY-this.worldDrag.startY)>3&&(this.worldDrag.moved=!0),this.worldDrag.pan&&t.pan(s,n)},r.onpointerup=a=>{if(!this.worldDrag||this.worldDrag.pointerId!==a.pointerId)return;let s=this.worldDrag;if(this.worldDrag=null,s.allowTextSelection||r.releasePointerCapture(a.pointerId),s.button!==0||s.moved)return;let n=a.target.closest?.("[data-feature-key]");if(n)this.selectElement(n,a);else{let i=this.featureAtEvent(a);i?this.selectFeature(i.entry,i.feature,a):this.callbacks.onBlank?.()}},r.ondblclick=a=>{let s=a.target.closest?.("[data-feature-key]"),n=s?null:this.featureAtEvent(a),i=n?.entry||this.entryForPoint(a.clientX,a.clientY),o=s?this.selectionFromElement(s):n?this.selectionFromFeature(n.entry,n.feature):this.selected;Ju(o)?this.callbacks.onOpenPage?.(o):o?.netUid?this.callbacks.onHighlightNet?.(o.netUid,o):!n&&i?.page&&this.callbacks.onOpenPage?.({kind:"page",pageId:i.page.id,page:i.page})},r.onwheel=a=>{a.preventDefault(),Math.abs(a.deltaX)>Math.abs(a.deltaY)*.65?t.pan(-a.deltaX,-a.deltaY):t.zoom(a.deltaY,a.clientX,a.clientY)}}async focusPage(t,r={}){if(!t)return!1;if(this.activePage?.id===t.id&&this.active)return r.frame!==!1&&this.fitPage(),!0;let a=performance.now(),s=await this.loadImportedSvg(t);if(!s)return!1;let n=document.createElement("div");return n.className="svg-dom-page",n.append(s),this.host.replaceChildren(n),this.host.hidden=!1,this.container=n,this.svg=s,this.activePage=t,this.activeSvgUrl=new URL(t.svg||t.thumbnail?.path,this.manifestUrl).toString(),this.overlay=Xu(s),this.selectionOverlay=$u(s),this.index=Wu(s,t,this.featuresByPage[t.id]||[]),this.installPageHandlers(),this.fitPage(),this.setSelection(this.selected),this.setHighlightedNet(this.highlightedNetUid),this.lastStats={...this.lastStats,mountedPages:1,domNodes:s.querySelectorAll("*").length,indexedFeatures:this.index.featureToElements.size,indexedNets:this.index.netToElements.size,mountMs:performance.now()-a,fallbackReason:""},this.updateCacheStats(),!0}installPageHandlers(){let t=this.host;t.oncontextmenu=r=>r.preventDefault(),t.onpointerdown=r=>{if(!this.active)return;let a=r.button===0&&!r.shiftKey&&!!r.target.closest?.("text"),s=r.target.closest?.("[data-feature-key]"),n=s?null:this.featureAtEvent(r);this.drag={pointerId:r.pointerId,startX:r.clientX,startY:r.clientY,lastX:r.clientX,lastY:r.clientY,button:r.button,moved:!1,pan:!a&&(r.button===0||r.button===1||r.shiftKey),featureElement:s,allowTextSelection:a},a||t.setPointerCapture(r.pointerId)},t.onpointermove=r=>{if(!this.drag||this.drag.pointerId!==r.pointerId)return;let a=r.clientX-this.drag.lastX,s=r.clientY-this.drag.lastY;this.drag.lastX=r.clientX,this.drag.lastY=r.clientY,Math.hypot(r.clientX-this.drag.startX,r.clientY-this.drag.startY)>3&&(this.drag.moved=!0),this.drag.pan&&(this.view.tx+=a,this.view.ty+=s,this.applyTransform())},t.onpointerup=r=>{if(!this.drag||this.drag.pointerId!==r.pointerId)return;let a=this.drag;if(this.drag=null,a.allowTextSelection||t.releasePointerCapture(r.pointerId),a.button!==0||a.moved)return;let s=r.target.closest?.("[data-feature-key]");if(s)this.selectElement(s,r);else{let n=this.featureAtEvent(r);n?this.selectFeature(n.entry,n.feature,r):this.callbacks.onBlank?.()}},t.ondblclick=r=>{let a=r.target.closest?.("[data-feature-key]"),s=a?null:this.featureAtEvent(r),n=a?this.selectionFromElement(a):s?this.selectionFromFeature(s.entry,s.feature):this.selected;Ju(n)?this.callbacks.onOpenPage?.(n):n?.netUid?this.callbacks.onHighlightNet?.(n.netUid,n):!s&&this.activePage&&this.callbacks.onOpenPage?.({kind:"page",pageId:this.activePage.id,page:this.activePage})},t.onwheel=r=>{if(r.preventDefault(),!this.active)return;if(Math.abs(r.deltaX)>Math.abs(r.deltaY)*.65){this.view.tx-=r.deltaX,this.view.ty-=r.deltaY,this.applyTransform();return}let a=this.host.getBoundingClientRect(),s=r.clientX-a.left,n=r.clientY-a.top,i=this.screenToSvg(s,n),o=Math.exp(-r.deltaY*.0016);this.view.scale=Zs(this.view.scale*o,.02,80),this.view.tx=s-i[0]*this.view.scale,this.view.ty=n-i[1]*this.view.scale,this.applyTransform()}}selectElement(t,r){let a=performance.now(),s=this.selectionFromElement(t);if(this.setSelection(s),r){let n=this.host.getBoundingClientRect();s.anchor={x:r.clientX-n.left,y:r.clientY-n.top}}this.callbacks.onSelect?.(s),this.lastStats.selectionMs=performance.now()-a}selectFeature(t,r,a){let s=performance.now(),n=this.selectionFromFeature(t,r);if(this.setSelection(n),a){let i=this.host.getBoundingClientRect();n.anchor={x:a.clientX-i.left,y:a.clientY-i.top}}this.callbacks.onSelect?.(n),this.lastStats.selectionMs=performance.now()-s}selectionFromElement(t){let r=t.dataset.featureKey||"",a=this.entryForElement(t),s=a.index.featureByKey.get(r)||{};return this.selectionFromFeature(a,s,t)}selectionFromFeature(t,r,a=null){let s=r?.stableKey||a?.dataset?.featureKey||"",n=t?.page||this.activePage,i=r?.kind||a?.dataset?.role||a?.dataset?.primitive||"feature",o=r?.netUid||a?.dataset?.netUid||"",c=r?.netName||a?.dataset?.netName||"";return i==="sheet"?{kind:"sheet",featureKey:s,sheetInstancePath:r?.sheetInstancePath||n?.sheetInstancePath||"",sourceId:r?.sourceId||a?.dataset?.sourceId||a?.dataset?.objectId||a?.dataset?.uuid||"",sheetName:r?.sheet_name||r?.sheetName||a?.dataset?.sheetName||r?.objectId||"",sheetFile:r?.sheet_file||r?.sheetFile||a?.dataset?.sheetFile||"",feature:r}:i==="pin"||i==="pin_body"||i==="pin_name"||i==="pin_number"||a?.dataset?.pin?{kind:"pin",featureKey:s,sheetInstancePath:r?.sheetInstancePath||n?.sheetInstancePath||"",sourceId:r?.sourceId||a?.dataset?.sourceId||a?.dataset?.objectId||a?.dataset?.uuid||"",symbolUuid:r?.symbolUuid||a?.dataset?.symbolUuid||"",reference:r?.reference||a?.dataset?.designator||a?.dataset?.component||a?.dataset?.ref||"",pinNumber:r?.pinNumber||a?.dataset?.pin||"",pinName:r?.pinName||"",netUid:o,netName:c,feature:r}:i==="symbol_body"||i==="symbol_instance"||i==="component"||a?.dataset?.ref?{kind:"component",featureKey:s,sheetInstancePath:r?.sheetInstancePath||n?.sheetInstancePath||"",sourceId:r?.sourceId||a?.dataset?.sourceId||a?.dataset?.objectId||a?.dataset?.uuid||"",symbolUuid:r?.symbolUuid||a?.dataset?.symbolUuid||"",reference:r?.reference||a?.dataset?.designator||a?.dataset?.component||a?.dataset?.ref||"",netUid:o,netName:c,feature:r}:{kind:o?"feature":i,featureKey:s,sheetInstancePath:r?.sheetInstancePath||n?.sheetInstancePath||"",sourceId:r?.sourceId||a?.dataset?.sourceId||a?.dataset?.objectId||a?.dataset?.uuid||"",role:i,netUid:o,netName:c,feature:r}}setSelection(t){this.selected=t||null;for(let a of this.host.querySelectorAll(".prism-svg-selected"))a.classList.remove("prism-svg-selected");for(let a of this.host.querySelectorAll("[data-prism-overlay='selection']"))a.replaceChildren();let r=t?.featureKey||"";if(r){for(let a of this.entries()){for(let s of a.index.featureToElements.get(r)||[])s.classList.add("prism-svg-selected");this.drawSelectionOverlay(a,t)}for(let a of this.index.featureToElements.get(r)||[])a.classList.add("prism-svg-selected");this.drawSelectionOverlay({page:this.activePage,index:this.index,selectionOverlay:this.selectionOverlay},t)}}setHighlightedNet(t){this.highlightedNetUid=t||"";let r=performance.now();for(let a of this.entries())this.updateEntryHighlight(a);if(!this.svg||!this.overlay){this.lastStats.highlightMs=performance.now()-r;return}this.updateEntryHighlight({svg:this.svg,overlay:this.overlay,index:this.index,page:this.activePage}),this.lastStats.highlightMs=performance.now()-r}updateEntryHighlight(t){if(!t?.svg||!t?.overlay||(t.overlay.replaceChildren(),!this.highlightedNetUid))return;let r=en(t.svg,t.page),a=document.createElementNS(xa,"rect");a.setAttribute("x",String(r[0])),a.setAttribute("y",String(r[1])),a.setAttribute("width",String(r[2])),a.setAttribute("height",String(r[3])),a.setAttribute("class","prism-svg-net-dimmer"),t.overlay.append(a);let n=(t.index.netToElements.get(this.highlightedNetUid)||[]).slice(0,2200);for(let i of n){let o=Kw(i);t.overlay.append(o)}}entries(){return[...this.mountedPages.values()]}entryForElement(t){let a=t.closest?.(".svg-dom-page")?.dataset.pageId||"";return this.mountedPages.get(a)||{page:this.activePage,index:this.index,svg:this.svg,overlay:this.overlay,selectionOverlay:this.selectionOverlay}}featureAtEvent(t){let r=this.entryForPoint(t.clientX,t.clientY);if(!r)return null;let a=this.clientToSvg(r,t.clientX,t.clientY);if(!a)return null;let s=Math.max(.18,5*Hw(r)),i=r.index.features.filter(o=>(o?.domBoundsMm||o?.boundsMm)&&ef(o)).filter(o=>a[0]>=(o.domBoundsMm||o.boundsMm)[0]-s&&a[0]<=(o.domBoundsMm||o.boundsMm)[2]+s&&a[1]>=(o.domBoundsMm||o.boundsMm)[1]-s&&a[1]<=(o.domBoundsMm||o.boundsMm)[3]+s).map(o=>({feature:o,priority:Ww(o),area:Math.max(1e-4,((o.domBoundsMm||o.boundsMm)[2]-(o.domBoundsMm||o.boundsMm)[0])*((o.domBoundsMm||o.boundsMm)[3]-(o.domBoundsMm||o.boundsMm)[1]))})).sort((o,c)=>c.priority-o.priority||o.area-c.area)[0]?.feature;return i?{entry:r,feature:i,point:a}:null}entryForPoint(t,r){for(let a of[...this.entries()].reverse()){let s=a.container.getBoundingClientRect();if(t>=s.left&&t<=s.right&&r>=s.top&&r<=s.bottom)return a}if(this.container){let a=this.container.getBoundingClientRect();if(t>=a.left&&t<=a.right&&r>=a.top&&r<=a.bottom)return{page:this.activePage,container:this.container,svg:this.svg,index:this.index,selectionOverlay:this.selectionOverlay}}return null}clientToSvg(t,r,a){if(!t?.container||!t?.svg||!t?.page)return null;let s=t.container.getBoundingClientRect();if(!s.width||!s.height)return null;let n=en(t.svg,t.page);return[n[0]+(r-s.left)/s.width*n[2],n[1]+(a-s.top)/s.height*n[3]]}drawSelectionOverlay(t,r){if(!t?.selectionOverlay||!r?.featureKey)return;let a=t.index.featureByKey.get(r.featureKey),s=a?.domBoundsMm||a?.boundsMm;if(!s)return;let[n,i,o,c]=s,l=document.createElementNS(xa,"rect");l.setAttribute("x",String(n)),l.setAttribute("y",String(i)),l.setAttribute("width",String(Math.max(.001,o-n))),l.setAttribute("height",String(Math.max(.001,c-i))),l.setAttribute("rx","0.65"),l.setAttribute("ry","0.65"),l.setAttribute("class","prism-svg-selection-box"),t.selectionOverlay.append(l)}fitPage(){if(!this.svg||!this.activePage)return;let t=en(this.svg,this.activePage),r=t[2]||this.activePage.sourceWidthMm||this.activePage.widthMm||1,a=t[3]||this.activePage.sourceHeightMm||this.activePage.heightMm||1,s=this.host.getBoundingClientRect(),n=Math.min(s.width/r,s.height/a)*.92;this.view.scale=Zs(n,.02,80),this.view.tx=(s.width-r*this.view.scale)/2-t[0]*this.view.scale,this.view.ty=(s.height-a*this.view.scale)/2-t[1]*this.view.scale,this.applyTransform()}frameSelection(t=this.selected){if(!t?.featureKey||!this.active){this.fitPage();return}let r=this.index.featureToElements.get(t.featureKey)||[],a=Zu(r);if(!a)return;let s=this.host.getBoundingClientRect(),n=Math.max(1,a[2]-a[0]),i=Math.max(1,a[3]-a[1]),o=Math.min(s.width/n,s.height/i)*.36;this.view.scale=Zs(o,.04,80),this.view.tx=s.width/2-(a[0]+a[2])/2*this.view.scale,this.view.ty=s.height/2-(a[1]+a[3])/2*this.view.scale,this.applyTransform()}pan(t,r){this.active&&(this.view.tx+=t,this.view.ty+=r,this.applyTransform())}zoom(t,r,a){if(!this.active)return;let s=this.host.getBoundingClientRect(),n=(r??s.left+s.width/2)-s.left,i=(a??s.top+s.height/2)-s.top,o=this.screenToSvg(n,i),c=Math.exp(-t*.0016);this.view.scale=Zs(this.view.scale*c,.02,80),this.view.tx=n-o[0]*this.view.scale,this.view.ty=i-o[1]*this.view.scale,this.applyTransform()}screenToSvg(t,r){return[(t-this.view.tx)/Math.max(1e-6,this.view.scale),(r-this.view.ty)/Math.max(1e-6,this.view.scale)]}applyTransform(){this.container&&(this.container.style.transform=`translate3d(${this.view.tx}px, ${this.view.ty}px, 0) scale(${this.view.scale})`)}hasCachedSvg(t){return!!this.svgCache.get(this.svgUrlForPage(t))?.template}pruneMountedWorldPages(t=new Set){if(this.mountedPages.size<=this.maxMountedWorldPages)return;let r=[...this.mountedPages.entries()].filter(([a])=>!t.has(a)).sort((a,s)=>(a[1].lastUsed||0)-(s[1].lastUsed||0));for(let[a,s]of r){if(this.mountedPages.size<=this.maxMountedWorldPages)break;s.container.remove(),this.mountedPages.delete(a)}}pruneSvgCache(){let t=[...this.svgCache.entries()].filter(([,s])=>s?.template);if(t.length<=this.maxCachedSvgPages)return;let r=new Set([...this.mountedPages.values()].map(s=>this.svgUrlForPage(s.page)));this.activePage&&r.add(this.svgUrlForPage(this.activePage));let a=t.filter(([s])=>!r.has(s)).sort((s,n)=>(s[1].lastUsed||0)-(n[1].lastUsed||0));for(let[s]of a){if([...this.svgCache.values()].filter(n=>n?.template).length<=this.maxCachedSvgPages)break;this.svgCache.delete(s)}}updateCacheStats(){let t=[...this.svgCache.values()].filter(a=>a?.template);this.lastStats.cachedSvgPages=t.length,this.lastStats.cachedSvgBytes=t.reduce((a,s)=>a+(s.byteLength||0),0);let r=performance?.memory;this.lastStats.heapMb=r?.usedJSHeapSize?r.usedJSHeapSize/1048576:null}};function Pw(e,t,r){for(let n of[...e.querySelectorAll("*")]){if(Nw.has(n.localName.toLowerCase())){n.remove();continue}for(let i of[...n.attributes]){let o=i.name,c=o.toLowerCase(),l=i.value||"";if(c.startsWith("on")){n.removeAttribute(o);continue}if((c==="href"||c==="xlink:href"||c==="src")&&tf(l)){if((c==="href"||c==="xlink:href")&&n.localName.toLowerCase()==="image"&&$w(l))continue;n.removeAttribute(o);continue}c==="style"&&n.setAttribute(o,Jw(l))}}let a=`prism-${po(r)}-`,s=new Map;for(let n of e.querySelectorAll("[id]")){let i=n.getAttribute("id"),o=`${a}${po(i)}`;s.set(i,o),n.setAttribute("id",o)}for(let n of e.querySelectorAll("*"))for(let i of[...n.attributes]){let o=i.name.toLowerCase(),c=i.value||"";Cw.has(o)&&(c.startsWith("#")&&s.has(c.slice(1))?c=`#${s.get(c.slice(1))}`:Yw(c)&&(c=new URL(c,t).toString())),c=Qw(c,s),n.setAttribute(i.name,c)}}function Wu(e,t,r){let a=new Map,s=new Map,n=new Map,i=[];for(let f of r){let d=Dw(f,t);i.push(d),s.set(d.stableKey,d),n.set(Number(d.id||0),d);for(let p of Uw(d))a.has(p)||a.set(p,[]),a.get(p).push(d)}let o=new Map,c=new Map,l=new Map;for(let f of i)l.set(f.stableKey,f);for(let f of e.querySelectorAll("[data-uuid], [data-element-key], [data-primitive], [data-ref], [data-pin], [data-object-id], [data-designator], [data-component]")){let d=jw(f,a,t);if(d&&!ef(d)||!d&&!Xw(f))continue;let p=Gw(f,t),b=d?.stableKey||p,h=d?.netUid||"",u=d?.netName||"";f.classList.add("prism-feature"),f.dataset.featureKey=b,f.dataset.sourceId=d?.sourceId||f.dataset.uuid||f.dataset.elementKey||"",f.dataset.role=d?.kind||f.dataset.primitive||f.dataset.ref||"feature",d?.id&&(f.dataset.featureId=String(d.id)),h&&(f.dataset.netUid=h),u&&(f.dataset.netName=u),f.id||(f.id=`prism-feature-${po(b)}`),Qu(o,b,f),l.set(b,d||{id:0,stableKey:b,kind:f.dataset.role,sourceId:f.dataset.sourceId,sheetInstancePath:t.sheetInstancePath||""}),h&&Qu(c,h,f)}for(let[f,d]of o){let p=l.get(f),b=Zu(d);p&&b&&(p.domBoundsMm=Vw(p.boundsMm,b))}return{featureToElements:o,netToElements:c,featureByKey:l,byId:n,bySource:a,features:i}}function jw(e,t,r){let s=[e.dataset.uuid,e.dataset.elementKey,e.dataset.sourceId,e.dataset.objectId,e.dataset.componentUid,e.dataset.componentUuid,e.dataset.ref&&`${e.dataset.ref}:${e.dataset.pin||""}`].filter(Boolean).flatMap(i=>t.get(i)||[]);if(!s.length)return null;let n=String(e.dataset.primitive||e.dataset.ref||e.dataset.pin||"").toLowerCase();return s.map(i=>({feature:i,score:Lw(i,n,r)})).sort((i,o)=>o.score-i.score)[0].feature}function Lw(e,t,r){let a=0,s=String(e.kind||"").toLowerCase();return e.sheetInstancePath===r.sheetInstancePath&&(a+=20),e.netUid&&(a+=4),t&&s.includes(t)&&(a+=8),t==="symbol"&&s==="symbol_body"&&(a+=12),(t==="label"||t==="port")&&(s.includes("label")||s.includes("port"))&&(a+=12),t==="sheet"&&s==="sheet"&&(a+=12),s!=="record"&&(a+=2),s.includes("pin")&&(a+=2),a}function Dw(e,t){let r=e.sourceId||e.sourceUid||e.uuid||e.objectId||e.stableKey||"";return{...e,id:Number(e.id||0),sourceId:r,stableKey:e.stableKey||`${t.sheetInstancePath||t.id}|${r}|0|${e.kind||"feature"}|0`,sheetInstancePath:e.sheetInstancePath||t.sheetInstancePath||""}}function Uw(e){let t=new Set([e.sourceId,e.sourceUid,e.uuid,e.objectId,e.stableKey].filter(Boolean).map(String));return e.reference&&e.pinNumber&&t.add(`${e.reference}:${e.pinNumber}`),e.componentDesignator&&t.add(e.componentDesignator),e.reference&&t.add(e.reference),[...t]}function Gw(e,t){let r=e.dataset.uuid||e.dataset.elementKey||e.dataset.objectId||e.dataset.ref||e.id||"svg",a=e.dataset.primitive||e.dataset.role||e.localName||"feature";return`${t.sheetInstancePath||t.id}|${r}|0|${a}|0`}function zw(e){let t=document.createElementNS(xa,"style");t.textContent=`
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
  `,e.prepend(t)}function Xu(e){let t=document.createElementNS(xa,"g");return t.setAttribute("class","prism-svg-net-overlay"),t.setAttribute("data-prism-overlay","net-highlight"),e.append(t),t}function $u(e){let t=document.createElementNS(xa,"g");return t.setAttribute("class","prism-svg-selection-overlay"),t.setAttribute("data-prism-overlay","selection"),t.style.pointerEvents="none",e.append(t),t}function Kw(e){let t=e.cloneNode(!0);t.removeAttribute("id"),t.removeAttribute("data-feature-key"),t.removeAttribute("data-net-uid"),t.removeAttribute("data-net-name"),t.classList.add("prism-svg-net-overlay-clone");for(let r of[t,...Array.from(t.querySelectorAll?.("*")||[])])r instanceof SVGElement&&(r.removeAttribute("filter"),r.style.pointerEvents="none",r.style.stroke="#18ef52",r.style.fill="none",r.style.opacity="0.98",r.style.vectorEffect="non-scaling-stroke");return t}function Zu(e){let t=null;for(let r of e)if(r.getBBox)try{let a=r.getBBox(),s=[a.x,a.y,a.x+a.width,a.y+a.height];t=t?[Math.min(t[0],s[0]),Math.min(t[1],s[1]),Math.max(t[2],s[2]),Math.max(t[3],s[3])]:s}catch{}return t}function Vw(e,t){return e?t?[Math.min(e[0],t[0]),Math.min(e[1],t[1]),Math.max(e[2],t[2]),Math.max(e[3],t[3])]:e:t}function en(e,t){let r=e.getAttribute("viewBox");if(r){let a=r.trim().split(/[\s,]+/).map(Number);if(a.length===4&&a.every(Number.isFinite))return a}return[0,0,t.sourceWidthMm||t.widthMm||1,t.sourceHeightMm||t.heightMm||1]}function Yu(){return{featureToElements:new Map,netToElements:new Map,featureByKey:new Map,byId:new Map,bySource:new Map,features:[]}}function Hw(e){let t=e?.container?.getBoundingClientRect?.();if(!e?.svg||!e?.page||!t?.width||!t?.height)return .1;let r=en(e.svg,e.page);return Math.max(r[2]/t.width,r[3]/t.height)}function qw(e){let t=String(e?.kind||"").toLowerCase(),r=String(e?.semanticRole||"").toLowerCase(),a=`${e?.sourceId||""} ${e?.objectId||""} ${e?.text||""}`.toLowerCase();return t.includes("page")||r.includes("page")||t.includes("background")||r.includes("background")||a.includes("background")||a.includes("sheet_header")||a.includes("sheet header")||a.includes("drawing-sheet")}function Ww(e){let t=String(e?.kind||e?.semanticRole||"").toLowerCase();return t.includes("pin")?90:t.includes("label")||t.includes("port")?78:t.includes("wire")||t.includes("bus")||t.includes("junction")?70:t.includes("symbol")||t.includes("component")?54:t.includes("image")?30:20}function ef(e){if(!e||qw(e))return!1;let t=String(e.kind||e.semanticRole||"").toLowerCase();return["pin","label","port","wire","bus","junction","no_connect","symbol","component","sheet","image","text"].some(r=>t.includes(r))}function Xw(e){let t=`${e?.dataset?.primitive||""} ${e?.dataset?.ref||""} ${e?.dataset?.role||""} ${e?.dataset?.objectId||""} ${e?.dataset?.text||""}`.toLowerCase();return!t||t.includes("background")||t.includes("sheet_header")||t.includes("sheet header")||t.includes("drawing-sheet")?!1:["pin","label","port","wire","bus","junction","no_connect","symbol","component","sheet","image","text"].some(r=>t.includes(r))}function Ju(e){return String(e?.kind||e?.feature?.kind||"").toLowerCase()==="sheet"}function Qu(e,t,r){e.has(t)||e.set(t,[]),e.get(t).push(r)}function tf(e){let t=String(e||"").trim().toLowerCase();return!t||t.startsWith("#")?!1:t.startsWith("javascript:")||t.startsWith("data:")||t.startsWith("http://")||t.startsWith("https://")}function $w(e){return/^data:image\/(?:png|jpe?g|gif|webp);base64,[a-z0-9+/=\s]+$/i.test(String(e||"").trim())}function Yw(e){let t=String(e||"").trim();return t&&!t.startsWith("#")&&!/^[a-z][a-z0-9+.-]*:/i.test(t)}function Jw(e){return String(e||"").replace(/url\(([^)]+)\)/gi,(t,r)=>{let a=r.trim().replace(/^['"]|['"]$/g,"");return tf(a)?"none":t})}function Qw(e,t){let r=String(e||"");return r=r.replace(/url\(#([^)]+)\)/g,(a,s)=>t.has(s)?`url(#${t.get(s)})`:a),r=r.replace(/^#(.+)$/,(a,s)=>t.has(s)?`#${t.get(s)}`:a),r}function po(e){return String(e||"").trim().replace(/[^a-zA-Z0-9_-]+/g,"-").replace(/^-+|-+$/g,"").slice(0,96)||"item"}function Zs(e,t,r){return Math.max(t,Math.min(r,e))}function Tt(e){return`${e.level||""}/${e.id}`}function rf(e){let t=e.ends||[],r=e.wires||[];return t.length<2?[]:t.length===2?[{key:`${t[0].id}~${t[1].id}`,a:t[0].id,b:t[1].id,wires:new Set(r.map(a=>a.id))}]:t.map(a=>({key:`hub~${a.id}`,a:"hub",b:a.id,wires:new Set(r.filter(s=>s.from===a.id||s.to===a.id).map(s=>s.id))}))}function Zw(e,t){return!t||t.harness!==e.id?!1:!e.level||!t.occurrence||t.occurrence.startsWith(`${e.level}/`)}function af(e,t){let r=new Map;for(let a of e||[]){let s=new Map,n=new Set((a.wires||[]).map(i=>i.id));for(let i of t||[])for(let o of i.wires||[])n.has(o.wire)&&Zw(a,o)&&!s.has(o.wire)&&s.set(o.wire,i.color);s.size&&r.set(Tt(a),s)}return r}function sf(e,t){if(!t)return null;for(let r of e.wires)if(t.has(r))return t.get(r);return null}function nf(e,t){let r=new Map;if(!t)return r;for(let a of e.wires||[]){let s=t.get(a.id);s&&(r.has(a.from)||r.set(a.from,s),r.has(a.to)||r.set(a.to,s))}return r}function of(e){let t=e.filter(Boolean);return t.length<2?null:[0,1,2].map(r=>t.reduce((a,s)=>a+s[r],0)/t.length)}var rr="auto",ev=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];function Br(e,t){return e.level?t(e.level):ev}function go(e,t){return[0,1,2].map(r=>e[r]*t[0]+e[4+r]*t[1]+e[8+r]*t[2]+e[12+r])}function wa(e,t){let r=[t[0]-e[12],t[1]-e[13],t[2]-e[14]];return[0,1,2].map(a=>e[a*4]*r[0]+e[a*4+1]*r[1]+e[a*4+2]*r[2])}function mo(e,t,r){return t?e.map(a=>{if(r(a)!==t.harness)return a;let s=a.nodes??[];if(t.insert)return{...a,nodes:[...s,t.insert]};let n=t.id===rr?[{id:rr,kind:"breakout",positionMm:t.positionMm,pinned:!1,order:-1,ends:[],between:null},...s]:s.map(i=>i.id===t.id?{...i,positionMm:t.positionMm,pinned:i.kind==="waypoint"?!0:i.pinned}:i);return{...a,nodes:n}}):e}var cf="__bend__";function lf(e,{kind:t,segment:r,atMm:a,positionMm:s,toWorldMm:n}){if(t==="breakout"){let m=e.filter(g=>g.kind==="breakout").reduce((g,y)=>Math.max(g,y.order??0),-1);return{id:cf,kind:"breakout",positionMm:s,pinned:!1,order:m+1,ends:[],between:null}}let i=r.samplesMm.flat(),o=m=>{let g=0,y=1/0;for(let x=0;x+2<i.length;x+=3){let v=Math.hypot(i[x]-m[0],i[x+1]-m[1],i[x+2]-m[2]);v<y&&([g,y]=[x/3,v])}return g},c=m=>[...m].sort().join("|"),l=e.filter(m=>m.kind==="waypoint"&&m.between&&c(m.between)===c([r.from,r.to])).sort((m,g)=>(m.order??0)-(g.order??0)),f=l[0]?.between??[r.from,r.to],d=f[0]===r.from?1:-1,p=m=>d*o(m),b=p(a),h=l.filter(m=>p(n(m.positionMm))<b).length,u=l.length?h===0?(l[0].order??0)-1:h===l.length?(l[l.length-1].order??0)+1:((l[h-1].order??0)+(l[h].order??0))/2:0;return{id:cf,kind:"waypoint",positionMm:s,pinned:!0,order:u,ends:[],between:[...f]}}function df(e,t,r){let a=(e.nodes??[]).map(n=>({id:n.id,kind:n.kind,pinned:!!n.pinned,worldMm:go(r,n.positionMm)})),s=t.find(n=>n.to===rr);return s&&a.push({id:rr,kind:"breakout",pinned:!1,auto:!0,worldMm:s.samplesMm.slice(-3)}),a}function tv(e,t,r){let a=t[0]-e[0],s=t[1]-e[1],n=a*a+s*s,i=n>0?Math.max(0,Math.min(1,((r[0]-e[0])*a+(r[1]-e[1])*s)/n)):0;return{t:i,distance:Math.hypot(e[0]+i*a-r[0],e[1]+i*s-r[1])}}function uf(e,t,r,a,s=5){let n=null;return e.forEach((i,o)=>{let c=i.samplesMm,l=Math.floor(c.length/3),f=l?r([c[0],c[1],c[2]]):null;for(let d=0;d+1<l;d+=1){let p=[c[d*3+3],c[d*3+4],c[d*3+5]],b=r(p);if(f&&b){let{t:h,distance:u}=tv(f,b,t),m=[0,1,2].map(y=>c[d*3+y]+h*(p[y]-c[d*3+y])),g=s+i.radiusMm*a(m);u<=g&&(!n||u<n.distancePx)&&(n={index:o,sample:d,t:h,pointMm:m,distancePx:u})}f=b}}),n}function ff(e,t,r,a,{right:s,up:n}){if(!(a>0))return[...e];let i=t/a,o=-r/a;return e.map((c,l)=>c+s[l]*i+n[l]*o)}function hf(e,t,r=3){return Math.hypot(t[0]-e[0],t[1]-e[1])>=r}function gf(e,t,r,a){let{right:s,up:n,back:i}=e.basis(),o=Math.tan(e.fov/2),c=Ne(e.focus,ve(i,e.distance)),l=Je(Ne(Ne(ve(i,-1),ve(s,t*o*a)),ve(n,r*o)));return{origin:c,direction:l}}function mf(e,t,r){let a=yf(Array.from(e,Number));if(!a)return null;let s=l=>{let f=[0,1,2,3].map(d=>a[d]*t+a[4+d]*r+a[8+d]*l+a[12+d]);return f.slice(0,3).map(d=>d/f[3])},n=s(1),o=s(0).map((l,f)=>l-n[f]),c=Math.hypot(...o);return c>0?{origin:n,direction:o.map(l=>l/c)}:null}function yf(e){let t=new Array(16);t[0]=e[5]*e[10]*e[15]-e[5]*e[11]*e[14]-e[9]*e[6]*e[15]+e[9]*e[7]*e[14]+e[13]*e[6]*e[11]-e[13]*e[7]*e[10],t[4]=-e[4]*e[10]*e[15]+e[4]*e[11]*e[14]+e[8]*e[6]*e[15]-e[8]*e[7]*e[14]-e[12]*e[6]*e[11]+e[12]*e[7]*e[10],t[8]=e[4]*e[9]*e[15]-e[4]*e[11]*e[13]-e[8]*e[5]*e[15]+e[8]*e[7]*e[13]+e[12]*e[5]*e[11]-e[12]*e[7]*e[9],t[12]=-e[4]*e[9]*e[14]+e[4]*e[10]*e[13]+e[8]*e[5]*e[14]-e[8]*e[6]*e[13]-e[12]*e[5]*e[10]+e[12]*e[6]*e[9],t[1]=-e[1]*e[10]*e[15]+e[1]*e[11]*e[14]+e[9]*e[2]*e[15]-e[9]*e[3]*e[14]-e[13]*e[2]*e[11]+e[13]*e[3]*e[10],t[5]=e[0]*e[10]*e[15]-e[0]*e[11]*e[14]-e[8]*e[2]*e[15]+e[8]*e[3]*e[14]+e[12]*e[2]*e[11]-e[12]*e[3]*e[10],t[9]=-e[0]*e[9]*e[15]+e[0]*e[11]*e[13]+e[8]*e[1]*e[15]-e[8]*e[3]*e[13]-e[12]*e[1]*e[11]+e[12]*e[3]*e[9],t[13]=e[0]*e[9]*e[14]-e[0]*e[10]*e[13]-e[8]*e[1]*e[14]+e[8]*e[2]*e[13]+e[12]*e[1]*e[10]-e[12]*e[2]*e[9],t[2]=e[1]*e[6]*e[15]-e[1]*e[7]*e[14]-e[5]*e[2]*e[15]+e[5]*e[3]*e[14]+e[13]*e[2]*e[7]-e[13]*e[3]*e[6],t[6]=-e[0]*e[6]*e[15]+e[0]*e[7]*e[14]+e[4]*e[2]*e[15]-e[4]*e[3]*e[14]-e[12]*e[2]*e[7]+e[12]*e[3]*e[6],t[10]=e[0]*e[5]*e[15]-e[0]*e[7]*e[13]-e[4]*e[1]*e[15]+e[4]*e[3]*e[13]+e[12]*e[1]*e[7]-e[12]*e[3]*e[5],t[14]=-e[0]*e[5]*e[14]+e[0]*e[6]*e[13]+e[4]*e[1]*e[14]-e[4]*e[2]*e[13]-e[12]*e[1]*e[6]+e[12]*e[2]*e[5],t[3]=-e[1]*e[6]*e[11]+e[1]*e[7]*e[10]+e[5]*e[2]*e[11]-e[5]*e[3]*e[10]-e[9]*e[2]*e[7]+e[9]*e[3]*e[6],t[7]=e[0]*e[6]*e[11]-e[0]*e[7]*e[10]-e[4]*e[2]*e[11]+e[4]*e[3]*e[10]+e[8]*e[2]*e[7]-e[8]*e[3]*e[6],t[11]=-e[0]*e[5]*e[11]+e[0]*e[7]*e[9]+e[4]*e[1]*e[11]-e[4]*e[3]*e[9]-e[8]*e[1]*e[7]+e[8]*e[3]*e[5],t[15]=e[0]*e[5]*e[10]-e[0]*e[6]*e[9]-e[4]*e[1]*e[10]+e[4]*e[2]*e[9]+e[8]*e[1]*e[6]-e[8]*e[2]*e[5];let r=e[0]*t[0]+e[1]*t[4]+e[2]*t[8]+e[3]*t[12];return Math.abs(r)<1e-30?null:t.map(a=>a/r)}function bf(e,t){return[0,1,2].map(r=>e[r]*t[0]+e[4+r]*t[1]+e[8+r]*t[2]+e[12+r])}function pf(e,t){return[0,1,2].map(r=>e[r]*t[0]+e[4+r]*t[1]+e[8+r]*t[2])}function rv(e,t,r){let a=-1/0,s=1/0;for(let n=0;n<3;n+=1){if(Math.abs(t[n])<1e-15){if(e[n]<r[n]||e[n]>r[n+3])return!1;continue}let i=(r[n]-e[n])/t[n],o=(r[n+3]-e[n])/t[n];a=Math.max(a,Math.min(i,o)),s=Math.min(s,Math.max(i,o))}return s>=Math.max(a,0)}function av(e,t,r){let a=null;for(let s of e){if(s.bounds&&!rv(t,r,s.bounds))continue;let n=s.position,i=s.indices,o=i?i.length:n.length/3;for(let c=0;c+2<o;c+=3){let l=(i?i[c]:c)*3,f=(i?i[c+1]:c+1)*3,d=(i?i[c+2]:c+2)*3,p=[n[f]-n[l],n[f+1]-n[l+1],n[f+2]-n[l+2]],b=[n[d]-n[l],n[d+1]-n[l+1],n[d+2]-n[l+2]],h=Qe(r,b),u=it(p,h);if(Math.abs(u)<1e-18)continue;let m=[t[0]-n[l],t[1]-n[l+1],t[2]-n[l+2]],g=it(m,h)/u;if(g<0||g>1)continue;let y=Qe(m,p),x=it(r,y)/u;if(x<0||g+x>1)continue;let v=it(b,y)/u;v>1e-12&&(!a||v<a.t)&&(a={t:v,normal:Qe(p,b)})}}return a}function xf(e,t){let r=null;for(let a of e){let s=yf(a.matrix);if(!s)continue;let n=bf(s,t.origin),i=pf(s,t.direction),o=av(a.primitives,n,i);if(!o)continue;let c=bf(a.matrix,Ne(n,ve(i,o.t))),l=Math.hypot(...c.map((p,b)=>p-t.origin[b]));if(r&&l>=r.distance)continue;let f=[s[0],s[4],s[8],0,s[1],s[5],s[9],0,s[2],s[6],s[10],0,0,0,0,1],d=Je(pf(f,o.normal));it(d,t.direction)>0&&(d=ve(d,-1)),r={key:a.key,point:c,normal:d,distance:l}}return r?{key:r.key,point:r.point,normal:r.normal}:null}var Oe={bootMm:10,housingDepthMm:8,breakoutLiftMm:10,chordErrorMm:.2,catmullRomAlpha:.5,minBendRadiusFactor:6,bendRelaxIterations:8,packingFactor:1.2,ringSegments:12,breakoutBlendMm:5,lengthAllowance:.1,lengthMismatchTolerance:.15,boardCollisionMarginMm:1,defaultGaugeAwg:"24"},yo={24:1.143,22:1.3208,20:1.524,18:1.8034,16:2.0066,14:2.3622,12:2.8956,10:3.5306,8:5.0546,6:6.35,4:7.9248,2:9.8552,1:10.9474,0:12.1666,"00":13.8684};function wf(e){let t=e==null?null:String(e).trim().toUpperCase().replace(/AWG$/,"").trim();return t!==null&&t in yo?{odMm:yo[t],assumed:!1}:{odMm:yo[Oe.defaultGaugeAwg],assumed:!0}}var rn=(Math.sqrt(5)-1)/2,sv=60;function nv(e,t,r){let a=0;for(let s=0;s<3;s+=1){let n=e[s]<t[s]?t[s]-e[s]:e[s]>r[s]?e[s]-r[s]:0;a+=n*n}return a}function iv(e,t,r,a){let s=b=>nv([0,1,2].map(h=>e[h]+b*(t[h]-e[h])),r,a),n=0,i=1,o=i-rn*(i-n),c=n+rn*(i-n),l=s(o),f=s(c);for(let b=0;b<sv;b+=1)l<=f?([i,c,f]=[c,o,l],o=i-rn*(i-n),l=s(o)):([n,o,l]=[o,c,f],c=n+rn*(i-n),f=s(c));let[d,p]=l<=f?[o,l]:[c,f];for(let b of[0,1]){let h=s(b);h<p&&([d,p]=[b,h])}return[Math.sqrt(p),d]}function ov(e,t){let r=[t[0]-e[12],t[1]-e[13],t[2]-e[14]];return[0,1,2].map(a=>e[a*4]*r[0]+e[a*4+1]*r[1]+e[a*4+2]*r[2])}function cv(e,t){let[r,a]=[e[t],e[t+1]],s=0;for(let n=0;n<3;n+=1)s+=(a[n]-r[n])*(a[n]-r[n]);return Math.sqrt(s)}function vf(e,t){let r=e.length-1,a=0;for(let s=0;s<r;s+=1){let n=t?s:r-1-s;if(a>=Oe.bootMm)return s;a+=cv(e,n)}return r}function Mf(e,t){let r=Oe.boardCollisionMarginMm,a=t.map(n=>({board:n,lo:[0,1,2].map(i=>n.minMm[i]-r),hi:[0,1,2].map(i=>n.maxMm[i]+r)})),s=[];for(let n of e.curves){let i=n.diameterMm/2,o=n.samplesMm;if(i<=0||o.length<2)continue;let c=o.length-1,l=new Map,f=(b,h,u)=>{let m=l.get(b)??new Set;for(let g=h;g<u;g+=1)m.add(g);l.set(b,m)},d=e.ends[n.from];d&&f(d.occurrence,0,vf(o,!0));let p=e.ends[n.to];p&&f(p.occurrence,c-vf(o,!1),c);for(let{board:b,lo:h,hi:u}of a){let m=o.map(v=>ov(b.matrix,v)),g=l.get(b.id),y=[],x=null;for(let v=0;v<c;v+=1){if(g?.has(v))continue;let[E,S]=iv(m[v],m[v+1],h,u);E<i&&(y.push(v),(!x||E<x[0])&&(x=[E,v,S]))}if(x){let[v,E,S]=x,[T,_]=[o[E],o[E+1]];s.push({segmentId:n.segmentId,board:b.id,distanceMm:v,radiusMm:i,atMm:[0,1,2].map(I=>T[I]+S*(_[I]-T[I])),spans:y})}}}return s}var lv=/_vertical(_|$)/i,dv=/_(horizontal|rightangle|right_angle|angled)(_|$)|_RA(_|$)/i,Ef=e=>e*Math.PI/180;function kf(e){let t=e.replace(/[0-9]+$/,""),r=e.slice(t.length);return[t,r?Number.parseInt(r,10):-1,e]}function uv(e,t){let[r,a,s]=kf(e),[n,i,o]=kf(t);return r!==n?r<n?-1:1:a!==i?a-i:s<o?-1:s>o?1:0}function wo(e,t){let r=Ef(e.rotationDeg),a=t[0]-e.positionMm[0],s=t[1]-e.positionMm[1];return[a*Math.cos(r)+s*Math.sin(r),-a*Math.sin(r)+s*Math.cos(r)]}function Sf(e,t){let r=Ef(e.rotationDeg);return[t[0]*Math.cos(r)-t[1]*Math.sin(r),t[0]*Math.sin(r)+t[1]*Math.cos(r),0]}function fv(e){return new Set(e.pads.map(t=>`${t.positionMm[0]},${t.positionMm[1]}`)).size}function Tf(e){let t=e.pads.filter(r=>r.pad);return t.length?t:e.pads}function Af(e){let t=Tf(e),r=t.length;return[t.reduce((a,s)=>a+s.positionMm[0],0)/r,t.reduce((a,s)=>a+s.positionMm[1],0)/r]}function hv(e,t){let r=Math.atan2(t,e)*180/Math.PI,a=bv(r/90)*90;return Math.abs(r-a)>20?null:{0:"+x",90:"+y",180:"-x","-180":"-x","-90":"-y"}[String(a===0?0:a)]}function bv(e){let t=Math.floor(e),r=e-t;return r>.5?t+1:r<.5||t%2===0?t:t+1}function pv(e){let t=(u,m,...g)=>({axis:m==="low"?null:u,confidence:m,reasons:g});if(!e||fv(e)<2)return t(null,"low","too_few_pads");let r=e.side==="top"?"top":"bottom",a=e.footprintName??"",s=lv.test(a),n=dv.test(a),i=e.courtyard;if(!i)return s?t(r,"medium","name_vertical","no_courtyard"):t(null,"low","no_courtyard");let o=e.pads.map(u=>wo(e,u.positionMm)),c=o.map(([u])=>u),l=o.map(([,u])=>u),f=[c.reduce((u,m)=>u+m,0)/c.length,l.reduce((u,m)=>u+m,0)/l.length],d=[(i.minMm[0]+i.maxMm[0])/2,(i.minMm[1]+i.maxMm[1])/2],p=Math.min(...c)-1<=d[0]&&d[0]<=Math.max(...c)+1&&Math.min(...l)-1<=d[1]&&d[1]<=Math.max(...l)+1,b=[d[0]-f[0],d[1]-f[1]],h=!p&&Math.hypot(...b)>=.5?hv(...b):null;return s?p?t(r,"high","name_vertical","body_over_pads"):t(null,"low","name_vertical","name_conflicts_geometry"):n?h?t(h,"high","name_right_angle","body_off_pads"):t(null,"low","name_right_angle","name_conflicts_geometry"):p?t(r,"medium","body_over_pads"):h?t(h,"medium","body_off_pads"):t(null,"low","body_ambiguous")}function an(e){let t=Math.sqrt(e.reduce((r,a)=>r+a*a,0));return e.map(r=>r/t)}var gv=(e,t)=>[e[1]*t[2]-e[2]*t[1],e[2]*t[0]-e[0]*t[2],e[0]*t[1]-e[1]*t[0]],xo=(e,t)=>e.reduce((r,a,s)=>r+a*t[s],0);function mv(e){let t=e.pads.filter(a=>a.pad),r=t.find(a=>a.pad==="1");return r||(t.length?[...t].sort((a,s)=>uv(a.pad,s.pad))[0]:e.pads[0])}function yv(e){let[t,r]=Af(e),a=Tf(e),s=a.length,n=0,i=0,o=0;for(let b of a)n+=(b.positionMm[0]-t)**2,i+=(b.positionMm[1]-r)**2,o+=(b.positionMm[0]-t)*(b.positionMm[1]-r);n/=s,i/=s,o/=s;let c=(n+i)/2,l=n*i-o*o,f=Math.sqrt(Math.max(c*c-l,0)),d=c+f,p=c-f;return d<=1e-12||d-p<=.05*d?Sf(e,[1,0]):Math.abs(o)>1e-12?an([d-i,o,0]):n>=i?[1,0,0]:[0,1,0]}function xv(e,t){if(t==="top")return[0,0,1];if(t==="bottom")return[0,0,-1];let r=t[0]==="-"?-1:1;return an(Sf(e,t[1]==="x"?[r,0]:[0,r]))}function vo(e,t,r){let[a,s,n]=e,[i,o,c]=t,[l,f,d]=r,p=a+o+d,b;if(p>0){let u=Math.sqrt(p+1)*2;b=[(c-f)/u,(l-n)/u,(s-i)/u,.25*u]}else if(a>o&&a>d){let u=Math.sqrt(1+a-o-d)*2;b=[.25*u,(i+s)/u,(l+n)/u,(c-f)/u]}else if(o>d){let u=Math.sqrt(1+o-a-d)*2;b=[(i+s)/u,.25*u,(f+c)/u,(l-n)/u]}else{let u=Math.sqrt(1+d-a-o)*2;b=[(l+n)/u,(f+c)/u,.25*u,(s-i)/u]}return b=an(b),([b[3],b[0],b[1],b[2]].find(u=>Math.abs(u)>1e-12)??1)<0?b.map(u=>-u):b}function va(e,t,r){if(!e||e.pads.length===0)return null;let a=r?r.axis:pv(e).axis;if(!a)return null;let s=r?((r.quarterTurns??0)%4+4)%4:0,[n,i]=Af(e),o=(t??0)/2,c=[n,i,e.side==="top"?o:-o],l=xv(e,a),f=yv(e),d=xo(f,l),p=[f[0]-d*l[0],f[1]-d*l[1],f[2]-d*l[2]];Math.sqrt(xo(p,p))<1e-9&&(p=[-l[1],l[0],0]),p=an(p);let b=mv(e).positionMm;xo([b[0]-n,b[1]-i,0],p)>1e-9&&(p=p.map(u=>-u));let h=gv(l,p);for(let u=0;u<s;u+=1)[p,h]=[h,p.map(m=>-m)];return{axis:a,quarterTurns:s,originMm:c,xAxis:p,yAxis:h,zAxis:l,rotation:vo(p,h,l)}}function Se(e){return Math.round(e*1e9)/1e9+0}function sn(e){let t=Math.hypot(...e)||1,r=e.map(s=>s/t),a=[r[3],r[0],r[1],r[2]].find(s=>Math.abs(s)>1e-12)??1;return r.map(s=>Se(a<0?-s:s))}function Ma(e,t){let[r,a,s,n]=e,i=a*t[2]-s*t[1],o=s*t[0]-r*t[2],c=r*t[1]-a*t[0];return[t[0]+2*(n*i+a*c-s*o),t[1]+2*(n*o+s*i-r*c),t[2]+2*(n*c+r*o-a*i)]}function wv(e,t){let[r,a,s,n]=e,[i,o,c,l]=t;return[n*i+r*l+a*c-s*o,n*o-r*c+a*l+s*i,n*c+r*o-a*i+s*l,n*l-r*i-a*o-s*c]}function pt(e,t){let r=Ma(e.rotation,t.translationMm);return{translationMm:e.translationMm.map((a,s)=>Se(a+r[s])),rotation:sn(wv(e.rotation,t.rotation))}}function Mo(e){let[t,r,a,s]=e.rotation,[n,i,o]=e.translationMm;return[1-2*(r*r+a*a),2*(t*r+a*s),2*(t*a-r*s),0,2*(t*r-a*s),1-2*(t*t+a*a),2*(r*a+t*s),0,2*(t*a+r*s),2*(r*a-t*s),1-2*(t*t+r*r),0,n,i,o,1].map(Se)}var _f=5;var nn=Math.SQRT1_2,VA=[[0,0,0,1],[0,0,nn,nn],[0,0,1,0],[0,0,nn,-nn]];function vv(e,t){let r=[0,1,2].map(a=>t[a]-e.originMm[a]);return[e.xAxis,e.yAxis,e.zAxis].map(a=>r[0]*a[0]+r[1]*a[1]+r[2]*a[2])}function on(e,t,r){let a,s;if(r)a=[...r.minMm],s=[...r.maxMm];else if(e.courtyard)a=[...e.courtyard.minMm,0],s=[...e.courtyard.maxMm,_f];else{let d=e.pads.map(p=>wo(e,p.positionMm));a=[Math.min(...d.map(p=>p[0])),Math.min(...d.map(p=>p[1])),0],s=[Math.max(...d.map(p=>p[0])),Math.max(...d.map(p=>p[1])),_f]}let n=e.rotationDeg*Math.PI/180,[i,o]=e.positionMm,c=(t??0)/2,l=e.side==="top",f=[];for(let d=0;d<8;d+=1){let[p,b,h]=[0,1,2].map(u=>(d>>u&1?s:a)[u]);f.push([i+p*Math.cos(n)-b*Math.sin(n),o+p*Math.sin(n)+b*Math.cos(n),l?c+h:-c-h])}return f}function cn(e,t){let r=t.map(a=>vv(e,a));return[[0,1,2].map(a=>Math.min(...r.map(s=>s[a]))),[0,1,2].map(a=>Math.max(...r.map(s=>s[a])))]}var ln=Math.SQRT1_2,Mv=[[0,0,0,1],[0,0,ln,ln],[0,0,1,0],[0,0,ln,-ln]],kv=[1,0,0,0],dn=[0,0,0,1],Ev=(e,t)=>{let r=t*Math.PI/360;return[e[0]*Math.sin(r),e[1]*Math.sin(r),e[2]*Math.sin(r),Math.cos(r)]};function ko(e){if(!e)return{pose:{translationMm:[0,0,0],rotation:dn},scale:1};let[t,r,a]=(e.rotationDeg??[0,0,0]).map(Number),s=dn;for(let[i,o]of[[[0,0,1],a],[[0,1,0],r],[[1,0,0],t]])s=pt({translationMm:[0,0,0],rotation:s},{translationMm:[0,0,0],rotation:Ev(i,o)}).rotation;return{pose:{translationMm:(e.offsetMm??[0,0,0]).map(Number),rotation:sn(s)},scale:Number(e.scale??1)||1}}function Sv(e){let t=e?.boundsMm;if(!t)return{exit:[0,0,-Oe.housingDepthMm],depth:Oe.housingDepthMm,modeled:!1};let{pose:r,scale:a}=ko(e.alignment),s=[];for(let c=0;c<8;c+=1){let l=[0,1,2].map(d=>(c>>d&1?t.maxMm:t.minMm)[d]*a),f=Ma(r.rotation,l);s.push([0,1,2].map(d=>f[d]+r.translationMm[d]))}let n=[0,1,2].map(c=>Math.min(...s.map(l=>l[c]))),i=[0,1,2].map(c=>Math.max(...s.map(l=>l[c]))),o=Math.min(n[2],0);return{exit:[(n[0]+i[0])/2,(n[1]+i[1])/2,o],depth:-o+0,modeled:!0}}function Tv(e,t=0,r){let a=Mv[(t%4+4)%4],s=pt({translationMm:[0,0,0],rotation:kv},{translationMm:[0,0,0],rotation:a}),n=pt(e,s),{exit:i,depth:o,modeled:c}=Sv(r),l=pt(n,{translationMm:i,rotation:dn}).translationMm,f=Ma(n.rotation,[0,0,-1]),d=[0,1,2].map(p=>l[p]+Oe.bootMm*f[p]);return{pose:n,exitMm:l.map(Se),outward:f.map(Se),legMm:d.map(Se),depthMm:Se(o),modeled:c}}function If(e,t,r,a,s=0,n,i){let o=va(t,r,a);if(!o||!t)return null;let c=Math.max(cn(o,on(t,r,i))[1][2],0),l=pt(e,{translationMm:o.originMm,rotation:o.rotation});return l=pt(l,{translationMm:[0,0,c],rotation:dn}),{...Tv(l,s,n),matingPlaneMm:Se(c)}}function Eo(e,t){let r=new Array(16).fill(0);for(let a=0;a<4;a+=1)for(let s=0;s<4;s+=1){let n=0;for(let i=0;i<4;i+=1)n+=e[i*4+s]*t[a*4+i];r[a*4+s]=n}return r}var Av=(e,t)=>[t[0]-e[0],0,0,0,0,t[1]-e[1],0,0,0,0,t[2]-e[2],0,e[0],e[1],e[2],1];function _v(e,t){let r=e.connector,a=r?va(r.geometry,r.thicknessMm,r.stored):null;if(!r||!a)return null;let[s,n]=cn(a,on(r.geometry,r.thicknessMm));return[[s[0],-n[1],-t],[n[0],-s[1],0]]}function Rf(e,t){let r=`${e.level||""}/${e.id}`,a=[];for(let s of[...e.ends].sort((n,i)=>n.ordinal-i.ordinal)){let n=t.ends[s.id];if(!n)continue;let i=Mo(n.pose),o={key:`${r}/${s.id}`,harness:r,end:s.id};if(s.housing?.boundsMm){let{pose:l,scale:f}=ko(s.housing.alignment),d=Eo(Mo(l),[f,0,0,0,0,f,0,0,0,0,f,0,0,0,0,1]);a.push({...o,matrix:Eo(i,d),model:s.housing});continue}let c=_v(s,n.depthMm);c&&a.push({...o,matrix:Eo(i,Av(...c)),model:null})}return a}var Iv=12,Rv=2,Nv=1e-9,Fr=(e,t)=>[e[0]-t[0],e[1]-t[1],e[2]-t[2]],At=(e,t)=>Math.sqrt((e[0]-t[0])**2+(e[1]-t[1])**2+(e[2]-t[2])**2);function Or(e,t,r,a,s){if(a===r)return[e[0],e[1],e[2]];let n=(a-s)/(a-r),i=(s-r)/(a-r);return[n*e[0]+i*t[0],n*e[1]+i*t[1],n*e[2]+i*t[2]]}function Cv(e,t,r,a){let s=Oe.catmullRomAlpha,n=0,i=n+At(e,t)**s,o=i+At(t,r)**s,c=o+At(r,a)**s;return l=>{let f=i+l*(o-i),d=Or(e,t,n,i,f),p=Or(t,r,i,o,f),b=Or(r,a,o,c,f),h=Or(d,p,n,o,f),u=Or(p,b,i,c,f);return Or(h,u,i,o,f)}}function Bv(e,t,r){let a=Fr(r,t),s=Fr(e,t),n=Math.sqrt(a[0]*a[0]+a[1]*a[1]+a[2]*a[2]);if(n<1e-12)return At(e,t);let i=[a[1]*s[2]-a[2]*s[1],a[2]*s[0]-a[0]*s[2],a[0]*s[1]-a[1]*s[0]];return Math.sqrt(i[0]*i[0]+i[1]*i[1]+i[2]*i[2])/n}function Nf(e){let t=o=>[o[0],o[1],o[2]];if(e.length<2)return{samples:e.map(t),spans:e.map(()=>0)};let r=e[0],a=e[e.length-1],s=[Fr([2*r[0],2*r[1],2*r[2]],e[1]),...e,Fr([2*a[0],2*a[1],2*a[2]],e[e.length-2])],n=[t(r)],i=[0];for(let o=0;o<e.length-1;o+=1){let c=Cv(s[o],s[o+1],s[o+2],s[o+3]),l=(f,d,p,b,h)=>{let u=(f+d)/2,m=c(u);h<Rv||h<Iv&&Bv(m,p,b)>Oe.chordErrorMm?(l(f,u,p,m,h+1),l(u,d,m,b,h+1)):(n.push(b),i.push(o))};l(0,1,t(e[o]),t(e[o+1]),0)}return{samples:n,spans:i}}function Ov(e,t,r){let a=At(e,t),s=At(t,r),n=At(r,e),i=Fr(t,e),o=Fr(r,e),c=[i[1]*o[2]-i[2]*o[1],i[2]*o[0]-i[0]*o[2],i[0]*o[1]-i[1]*o[0]],l=Math.sqrt(c[0]*c[0]+c[1]*c[1]+c[2]*c[2]);return l<1e-12?Number.POSITIVE_INFINITY:a*s*n/(2*l)}function Cf(e){let t=Number.POSITIVE_INFINITY,r=-1;for(let a=1;a<e.length-1;a+=1){let s=Ov(e[a-1],e[a],e[a+1]);s<t&&(t=s,r=a)}return{radius:t,at:r}}function Fv(e,t,r){let a=[],s=[];e.forEach((p,b)=>{if(a.length&&At(a[a.length-1],p)<Nv){s[s.length-1]=s[s.length-1]&&t[b];return}a.push([p[0],p[1],p[2]]),s.push(!!t[b])});let n=Oe.minBendRadiusFactor*r,{samples:i,spans:o}=Nf(a),{radius:c,at:l}=Cf(i);for(let p=0;p<Oe.bendRelaxIterations&&!(c>=n||l<0);p+=1){let b=o[l],h=[];for(let y=1;y<a.length-1;y+=1)s[y]&&h.push(y);if(!h.length)break;let u=y=>Math.min(Math.abs(y-b),Math.abs(y-(b+1))),m=h[0];for(let y of h)u(y)<u(m)&&(m=y);let g=[0,1,2].map(y=>(a[m-1][y]+a[m+1][y])/2);a[m]=[0,1,2].map(y=>(a[m][y]+g[y])/2),{samples:i,spans:o}=Nf(a),{radius:c,at:l}=Cf(i)}let f=0;for(let p=0;p+1<i.length;p+=1)f+=At(i[p],i[p+1]);let d=p=>p.map(Se);return{controlMm:a.map(d),samplesMm:i.map(d),lengthMm:Se(f),minRadiusMm:Number.isFinite(c)?Se(c):null,minRadiusAllowedMm:Se(n),tightBend:l>=0&&c<n?{atMm:d(i[l]),radiusMm:Se(c)}:null}}function Pv(e){let t=Oe.bootMm/2,{exitMm:r,outward:a,legMm:s}=e;return[[r[0],r[1],r[2]],[r[0]+t*a[0],r[1]+t*a[1],r[2]+t*a[2]],[s[0],s[1],s[2]],[s[0]+t*a[0],s[1]+t*a[1],s[2]+t*a[2]]]}function Bf(e,t,r={},a={}){let s=new Map(t.nodes.map(n=>[n.id,n.positionMm]));return t.segments.map(n=>{let i=b=>b in e?Pv(e[b]):[[...s.get(b)]],o=i(n.from),c=i(n.to),l=(r[n.id]??[]).map(b=>[b[0],b[1],b[2]]),f=[...o,...l,...c.reverse()],d=a[n.id]??[],p=[...o.map(()=>!1),...l.map((b,h)=>!d[h]),...c.map(()=>!1)];return{segmentId:n.id,...Fv(f,p,n.diameterMm)}})}var Of=e=>[e[0],e[1],e[2]];function Ff(e,t){return e.filter(r=>r.kind===t).sort((r,a)=>r.order-a.order||(r.id<a.id?-1:r.id>a.id?1:0))}function Pf(e){return Ff(e,"breakout").map(t=>({id:t.id,positionMm:Of(t.positionMm),ends:[...t.ends??[]]}))}function jf(e,t){let r=(i,o)=>i<o?`${i}
${o}`:`${o}
${i}`,a=new Map;for(let i of Ff(t,"waypoint")){let[o,c]=i.between??[],l=r(o,c),f=a.get(l);f?f.push(i):a.set(l,[i])}let s={waypoints:{},pinned:{},unused:[]},n=new Set;for(let i of e.segments){let o=r(i.from,i.to),c=a.get(o);c&&(n.add(o),c[0].between?.[0]!==i.from&&(c=[...c].reverse()),s.waypoints[i.id]=c.map(l=>Of(l.positionMm)),s.pinned[i.id]=c.map(l=>!!l.pinned))}for(let[i,o]of a)n.has(i)||s.unused.push(...o.map(c=>c.id));return s.unused.sort(),s}var Lf=(e,t)=>Math.hypot(e[0]-t[0],e[1]-t[1],e[2]-t[2]);function jv(e){if(!e.length)return{diameterMm:0,assumedGauge:!1};let t=0,r=!1;for(let a of e){let{odMm:s,assumed:n}=wf(a.gaugeAwg);t+=s*s,r=r||n}return{diameterMm:Se(Oe.packingFactor*Math.sqrt(t)),assumedGauge:r}}function Lv(e,t){let r=e.map(o=>Math.max(t.get(o.id)??0,0));r.every(o=>o===0)&&(r=e.map(()=>1));let a=r.reduce((o,c)=>o+c,0),s=[0,1,2].map(o=>e.reduce((c,l,f)=>c+r[f]*l.legMm[o],0)/a),n=[0,1,2].map(o=>e.reduce((c,l)=>c+l.outward[o],0)/e.length),i=Math.hypot(...n);return i<1e-9?s:[0,1,2].map(o=>s[o]+Oe.breakoutLiftMm*n[o]/i)}function Df(e,t,r=[]){let a=new Map(e.map(b=>[b.id,b])),s=[],n=[];for(let b of t)a.has(b.from.end)&&a.has(b.to.end)?s.push(b):n.push(b.id);let i=new Map;for(let b of s)for(let h of[b.from.end,b.to.end])i.set(h,(i.get(h)??0)+1);let o=b=>b.map(Se),c=e.map(b=>({id:b.id,kind:"end",positionMm:o(b.legMm)})),l=[];if(r.length){for(let h of r)c.push({id:h.id,kind:"breakout",positionMm:o(h.positionMm)});let b=new Map;for(let h of r)for(let u of h.ends??[])a.has(u)&&!b.has(u)&&b.set(u,h.id);for(let h of e){let u=b.get(h.id);if(u===void 0){let m=r[0];for(let g of r)Lf(g.positionMm,h.legMm)<Lf(m.positionMm,h.legMm)&&(m=g);u=m.id}l.push([h.id,u])}for(let h=0;h+1<r.length;h+=1)l.push([r[h].id,r[h+1].id])}else if(e.length===2)l.push([e[0].id,e[1].id]);else if(e.length>2){c.push({id:"auto",kind:"breakout",positionMm:o(Lv(e,i))});for(let b of e)l.push([b.id,"auto"])}let f=new Map(c.map(b=>[b.id,[]]));for(let[b,h]of l)f.get(b).push(h),f.get(h).push(b);let d=(b,h)=>{let u=new Set([b]),m=[b];for(;m.length;){let g=m.pop();for(let y of f.get(g))g===h[0]&&y===h[1]||g===h[1]&&y===h[0]||u.has(y)||(u.add(y),m.push(y))}return u},p=l.map(([b,h])=>{let u=d(b,[b,h]),m=s.filter(g=>u.has(g.from.end)!==u.has(g.to.end));return{id:`${b}~${h}`,from:b,to:h,wires:m.map(g=>g.id),...jv(m)}});return{nodes:c,segments:p,unplaced:n}}var Dv=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];function So(e){return{translationMm:[e[12],e[13],e[14]],rotation:vo([e[0],e[1],e[2]],[e[4],e[5],e[6]],[e[8],e[9],e[10]])}}function Uv(e,t){return[0,1,2].map(r=>e[r]*t[0]+e[4+r]*t[1]+e[8+r]*t[2]+e[12+r])}function Uf(e,t){let r={};for(let d of[...e.ends].sort((p,b)=>p.ordinal-b.ordinal)){let p=d.occurrence?t(d.occurrence):null;if(!p||!d.connector||!d.occurrence)continue;let b=d.connector.inOccurrence?pt(So(p),d.connector.inOccurrence):So(p),h=If(b,d.connector.geometry,d.connector.thicknessMm,d.connector.stored,0,d.housing);h&&(r[d.id]={...h,occurrence:d.occurrence})}if(Object.keys(r).length<2)return null;let a=Object.entries(r).map(([d,p])=>({id:d,legMm:p.legMm,outward:p.outward})),s=e.wires.map(d=>({id:d.id,from:{end:d.from},to:{end:d.to},gaugeAwg:d.gaugeAwg??null})),n=e.level?t(e.level):Dv,i=n?(e.nodes??[]).map(d=>({...d,positionMm:Uv(n,d.positionMm)})):[],o=Df(a,s,Pf(i)),c=jf(o,i),l=new Map(o.segments.map(d=>[d.id,d])),f=Bf(r,o,c.waypoints,c.pinned).map(d=>{let p=l.get(d.segmentId);return{...d,from:p.from,to:p.to,wires:[...p.wires],diameterMm:p.diameterMm,assumedGauge:p.assumedGauge}});return{ends:r,tree:o,curves:f,unused:c.unused,unplaced:o.unplaced,wires:e.wires.map(d=>({id:d.id,from:d.from,to:d.to}))}}function Gf(e,t,r=[]){let a=[],s=[];for(let n of e){let i=Uf(n,t);if(!i)continue;s.push(...Rf(n,i));let o=new Map;for(let c of r.length?Mf(i,r):[])o.set(c.segmentId,[...o.get(c.segmentId)??[],c.board]);for(let c of i.curves)c.diameterMm<=0||a.push({harness:`${n.level||""}/${n.id}`,segmentId:c.segmentId,from:c.from,to:c.to,samplesMm:c.samplesMm.flat(),radiusMm:c.diameterMm/2,wires:c.wires,tightBend:c.tightBend!==null,assumedGauge:c.assumedGauge,collides:o.get(c.segmentId)??[]})}return{tubes:a,housings:s}}var un=Object.freeze({restricted:{color:[.55,.57,.6,1],label:"Restricted"},loading:{color:[.7,.76,.82,1],label:"Loading\u2026"},building:{color:[.62,.72,.84,1],label:"Building 3D view\u2026"},missing:{color:[.78,.76,.7,1],label:"No 3D view"},failed:{color:[.86,.6,.56,1],label:"3D view failed"},unknown:{color:[.78,.76,.7,1],label:""}}),zf=Object.freeze([.001,0,0,0,0,.001,0,0,0,0,.001,0,0,0,0,1]);function ka(e,t){let r=new Array(16);for(let a=0;a<4;a+=1)for(let s=0;s<4;s+=1)r[a*4+s]=e[s]*t[a*4]+e[4+s]*t[a*4+1]+e[8+s]*t[a*4+2]+e[12+s]*t[a*4+3];return r}function Gv([e,t,r]){return[1,0,0,0,0,1,0,0,0,0,1,0,e,t,r,1]}function zv([e,t,r]){return[e,0,0,0,0,t,0,0,0,0,r,0,0,0,0,1]}function fn(e,t){return ka(zf,ka(e,t))}function Ea(e,t){let r=t.minMm,a=t.maxMm.map((s,n)=>Math.max(s-r[n],.2));return ka(zf,ka(e,ka(Gv(r),zv(a))))}function Kf(e,t,r){return e.restricted?"restricted":!e.assetId||!t?"missing":r==="loaded"?null:r==="failed"?"failed":t.status==="ready"?t.bundleUrl&&t.bundleToBoard?"loading":"building":un[t.status]?t.status:"unknown"}function To(e){return!!(e&&e.status==="ready"&&e.bundleUrl&&e.bundleToBoard)}function Vf(e,t){return!e||e.bundleUrl!==t.bundleUrl||e.loadState==="failed"?"create":e.loadState==="waiting"&&To(t)?"load":"keep"}function Hf(e){return(e?.occurrences||[]).filter(t=>t.kind==="board"||t.restricted||t.model||t.box)}function qf(e){return`box:${e.map(t=>Number(t).toFixed(3)).join(",")}`}function Wf(e){if(!e.length)return!1;let t=0;for(let r of e)if(!r.standIn)t+=1;else if(r.standIn==="loading")return!1;return t>0}function $f(e,t,r=0){return[e/1e3,-t/1e3,r]}function Kv({rotation:e=0,mirror:t=!1,tilt:r=0}){let a=t?[-1,0,0]:[1,0,0],s=[0,1,0],n=t?[0,0,-1]:[0,0,1],i=Math.cos(e),o=Math.sin(e),c=a.map((h,u)=>i*h+o*s[u]),l=s.map((h,u)=>-o*a[u]+i*h),f=Math.cos(r),d=Math.sin(r),p=n.map((h,u)=>f*h-d*l[u]),b=l.map((h,u)=>d*n[u]+f*h);return{right:c,up:b,back:p}}function _o(e,t,r,a,s=0){let{up:n,back:i}=Kv(e),o=$f(e.center[0],e.center[1],s),c=a*3,l=o.map((p,b)=>p+i[b]*c),f=1/(e.zoom*1e3),d=fs(t*f,r*f,-a*40,a*40);return ir(d,us(l,o,n))}function Vv(e,t,r,a){let[s,n,i]=a,o=e[0]*s+e[4]*n+e[8]*i+e[12],c=e[1]*s+e[5]*n+e[9]*i+e[13],l=e[3]*s+e[7]*n+e[11]*i+e[15];return l>0?[(o/l+1)/2*t,(1-c/l)/2*r]:null}function Sa(e){let t=e[0]*1e3,r=e[3]*1e3,a=-e[4]*1e3,s=-e[1]*1e3;return{box:{x:t,y:a,w:r-t,h:s-a},bottom:e[2]+e[5]<0}}function Io(e,t){return e?t?e[2]:e[5]:0}function Yf(e,t,r,a,s){let n=Ct(e),i=_o(t,r,a,n,t.focusZ??0);return Vv(i,r,a,$f(s[0],s[1],t.focusZ??0))}var Hv=([e,t,r,a])=>({x:Math.min(e,r),y:Math.min(t,a),w:Math.abs(r-e),h:Math.abs(a-t)}),Ao=e=>[e.x+e.w/2,e.y+e.h/2],Xf=new WeakMap;function qv(e,t){let r=Xf.get(e);if(r)return r;let a=new Map,s=new Map;for(let c of e.features.values()){if(c.sourceUid&&a.set(String(c.sourceUid),c),c.kind!=="pad")continue;let l=/^(.*):pad:\d+:(.+)$/.exec(String(c.sourceUid||""));if(!l)continue;let f=`${l[1]}\0${l[2]}`;s.has(f)||s.set(f,[]),s.get(f).push(c)}let n=new Map;for(let c of t?.physical_objects||[])c.kind==="footprint_body"&&c.designator&&c.bbox_mm?.length===4&&n.set(c.designator,c);let i=new Map((t?.physical_objects||[]).map(c=>[c.uid,c])),o={bySource:a,padsByFootprintPin:s,bodies:n,objects:i};return Xf.set(e,o),o}function Jf({scene:e,topology:t},r,a){let s=String(r),n=e.componentFeatures.get(s);if(!n)return null;let i=qv(e,t),o=e.features.get(Number(n.featureId)),c=i.bodies.get(s),l=o?.bounds?Sa(o.bounds).box:c?Hv(c.bbox_mm.map(Number)):null,f=o?.bounds?Sa(o.bounds).bottom:String(c?.layer||"").startsWith("B."),d=null;if(a!=null&&a!==""){let b=(t?.terminals||[]).find(u=>u.designator===s&&String(u.pin)===String(a)),h=b?.pcb_pad_id?i.objects.get(b.pcb_pad_id):null;if(d=h?.source_ids?.[0]&&i.bySource.get(String(h.source_ids[0]))||null,!d){let u=i.padsByFootprintPin.get(`${n.footprint}\0${a}`)||[],m=l?Ao(l):null,g=1/0;for(let y of u){let x=Ao(Sa(y.bounds).box),v=m?Math.hypot(x[0]-m[0],x[1]-m[1]):0;v<g&&([g,d]=[v,y])}}}let p=d?.bounds?Sa(d.bounds).box:null;return!l&&p&&(l=p,f=Sa(d.bounds).bottom),l?{reference:s,pin:d?String(a):null,focus:l,anchor:Ao(p||l),anchorBox:p,bottom:f,surfaceZ:Io(e.runtimeBounds,f)}:null}var hn=class{#e=new Map;constructor(t=3e3){this.ttlMs=t}get size(){return this.#e.size}record(t,r,a){this.#e.set(t,{matrix:r,at:a})}release(t){this.#e.delete(t)}clear(){this.#e.clear()}active(t){let r=[];for(let[a,s]of this.#e)t-s.at>this.ttlMs?this.#e.delete(a):r.push(s.matrix);return r}};var mn=1.5*1024*1024*1024;function Ro(e){let t=Number(e);return Number.isFinite(t)&&t>0?t:mn}function Qf(e,t){if(t.netName||t.netUid){let r=t.netUid&&e.find(a=>a.uid===t.netUid)||t.netName&&or(e,t.netName);return r?{kind:"net",id:Number(r.id)}:{kind:"unresolved"}}return t.netId?{kind:"net",id:Number(t.netId)}:t.featureId?{kind:"feature",id:Number(t.featureId)}:t.reference?{kind:"component",reference:String(t.reference)}:{kind:"board"}}function Zf(e,t){if(t.kind==="net")e.selectNet(t.id,!0);else if(t.kind==="feature")e.selectFeature(t.id,!0);else if(t.kind==="component")e.selectComponent(t.reference,!0);else return!1;return!0}function eh(e,t){return t&&!e?"enter":!t&&e?"leave":null}function Wv(e){return(Array.isArray(e)?e:[]).map((t,r)=>{let a=ul(t?.color??vi[r%vi.length]);return{key:String(t?.key??r),mark:a,color:`#${(a&16777215).toString(16).padStart(6,"0")}`,members:(Array.isArray(t?.members)?t.members:[]).filter(s=>s&&typeof s.occurrence=="string"&&typeof s.net=="string"),wires:(Array.isArray(t?.wires)?t.wires:[]).filter(s=>s&&typeof s.harness=="string"&&typeof s.wire=="string")}})}function No(){return{selection:null,gpuBudget:null}}var Xv=Object.freeze(["setSelection","resize","getViewState","setLayerVisible","applyLayerPreset","setShowBoard","setShowComponents","setShowPlaceholders","setRealisticColors","setBoardLayerVisible","setSeparation","showNetLayers","setNetIsolation","setStatsOverlay","getStats","setLodOverride","setGpuBudget","pickAt","projectComponent","projectPoint"]),bn=class{#e=null;constructor(t=No()){this.shared=t}get port(){return this.#e}attach(t){if(!t)throw new TypeError("A mode controller attaches to a mounted scene port");this.detach(),this.#e=t,this.replay(t)}detach(){let t=this.#e;this.#e=null,this.release(),t?.dispose?.()}replay(){}release(){}setSelection(t){this.shared.selection=t||null;let r=this.#e;r&&r.quietly(()=>this.applySelection(r,this.shared.selection))}setGpuBudget(t){this.shared.gpuBudget=t,this.#e?.setGpuBudget(Ro(t))}resize(){this.#e?.resize()}getViewState(){return this.#e?.getViewState()??null}setLayerVisible(t,r,a=null){this.#e?.setLayerVisible(t,r,a)}applyLayerPreset(t,r=null){this.#e?.applyLayerPreset(t,r)}setShowBoard(t){this.#e?.setShowBoard(t)}setShowComponents(t){this.#e?.setShowComponents(t)}setShowPlaceholders(t){this.#e?.setShowPlaceholders(t)}setRealisticColors(t){this.#e?.setRealisticColors(t)}setBoardLayerVisible(t,r,a){this.#e?.setBoardLayerVisible(t,r,a)}setSeparation(t,r=null){this.#e?.setSeparation(t,r)}showNetLayers(){this.#e?.showNetLayers()}setNetIsolation(t){this.#e?.setNetIsolation(t)}setStatsOverlay(t){this.#e?.setStatsOverlay(t)}getStats(){return this.#e?.stats()??null}setLodOverride(t){this.#e?.setLodOverride(t)}pickAt(t,r){return Promise.resolve(this.#e?.pickAt(t,r)??null)}projectComponent(t,r){return this.#e?.projectComponent(t,r)??null}projectPoint(t,r){return this.#e?.projectPoint(t,r)??null}},$v=Object.freeze(["setHighlightedNets","setHiddenComponents","getComponentReferences","setViewMode","renderInset","insetReady","insetSurfaceZ","releaseInset","insetTarget","projectInset","onSceneChange","insetStats","insetSettings","gpuIdle","loadAnalyticPack","setAnalyticOverlay","setAnalyticVectors","setAnalyticStyle","analyticColormaps","setAnalyticRelief","setClickSelect","analyticProbe","analyticAt","analyticStats","unloadAnalyticPack"]),pn=class extends bn{#e=[];#r=null;#a="pcb";#s=new Set;#n=null;#t=null;#o=!0;#i=null;attach(t,{workspace:r="pcb"}={}){this.#a=r,super.attach(t)}replay(t){this.#n=t.onSceneChange?.(()=>this.#l())??null,this.#l(),t.setWorkspace(this.#a),this.#r&&t.setHiddenComponents(this.#r),this.shared.gpuBudget!=null&&t.setGpuBudget(Ro(this.shared.gpuBudget)),this.shared.selection&&t.quietly(()=>this.applySelection(t,this.shared.selection)),this.#e.length&&this.#c(t,this.#e),this.#t&&this.#d(t,this.#t),this.#o||t.setClickSelect(!1)}async#d(t,r){await t.loadAnalyticPack(r.bytes,r.options),r.overlay&&t.setAnalyticOverlay(r.overlay),this.#i&&t.setAnalyticRelief(this.#i),r.style&&t.setAnalyticStyle(r.style),r.vectors&&t.setAnalyticVectors(r.vectors)}release(){this.#n?.(),this.#n=null}applySelection(t,r){r?.occurrence!=null&&t.selectOccurrence(r.occurrence),r?Zf(t,Qf(t.nets(),r)):t.clearSelection()}setWorkspace(t){this.#a=t,this.port?.setWorkspace(t)}setHighlightedNets(t){this.#e=Array.isArray(t)?[...t]:[];let r=this.port;r&&this.#c(r,this.#e)}#c(t,r){let a=ll(t.nets(),r),s=t.anyEmphasis();t.setHighlightedNetIds(a);let n=t.anyEmphasis(),i=eh(s,n);i==="enter"?t.showNetProbe():i==="leave"&&t.restoreVisibility(),t.isolating()&&n&&t.isolateLitNets(),t.refreshResidency()}setHiddenComponents(t){this.#r=Array.isArray(t)?[...t]:[],this.port?.setHiddenComponents(this.#r)}getComponentReferences(){return this.port?.getComponentReferences()??[]}setViewMode(t){this.port?.setViewMode(t)}renderInset(t,r,a){return!!this.port?.renderInset(t,r,a)}insetReady(){return!!this.port?.insetReady()}insetSurfaceZ(t){let r=this.port;return r?Io(r.insetBoard().scene.runtimeBounds,!!t):0}releaseInset(t){this.port?.releaseInset(String(t))}insetTarget(t,r){let a=this.port;return a?Jf(a.insetBoard(),t,r):null}projectInset(t,r,a,s){let n=this.port;return n?Yf(n.insetBoard().scene.runtimeBounds,t,r,a,s):null}onSceneChange(t){return this.#s.add(t),()=>this.#s.delete(t)}#l(){for(let t of this.#s)t()}insetStats(){return this.port?.insetStats()??null}insetSettings(t){return this.port?.insetSettings(t)??null}gpuIdle(){return this.port?.gpuIdle()??Promise.resolve()}async loadAnalyticPack(t,r={}){let a=t instanceof Uint8Array?t:new Uint8Array(t);return this.#t={bytes:a,options:r,overlay:null,vectors:null,style:this.#t?.style??null},this.port?this.port.loadAnalyticPack(a,r):null}setAnalyticOverlay(t){return this.#t&&(this.#t.overlay=t),this.port?.setAnalyticOverlay(t)??null}setAnalyticVectors(t){return this.#t&&(this.#t.vectors=t),this.port?.setAnalyticVectors(t)??null}setAnalyticStyle(t){return this.#t&&(this.#t.style={...this.#t.style||{},...t}),this.port?.setAnalyticStyle(t)??null}analyticColormaps(){return this.port?.analyticColormaps()??null}setAnalyticRelief(t){return this.#i=t||null,this.port?.setAnalyticRelief(this.#i)??null}setClickSelect(t){this.#o=t!==!1,this.port?.setClickSelect(this.#o)}analyticProbe(t,r){return this.port?.analyticProbe(t,r)??null}analyticAt(t,r){return this.port?.analyticAt(t,r)??Promise.resolve(null)}analyticStats(){return this.port?.analyticStats()??null}unloadAnalyticPack(){this.#t=null,this.port?.unloadAnalyticPack()}},Yv=Object.freeze(["setSystemScene","setNetEmphasis","frameNetEmphasis","frameAll","frameBoard","frameParts","setMoveMode","setRouteMode","setMoveSpace","previewPose","cancelMove","getMoveState","targetHarnessNode","selectHarness","previewHarnessNode","cancelHarnessNode","getHarnessState","setLabelsVisible","setHarnessesVisible","setHelpVisible","isHelpVisible","setLodThresholds","pickSurfaceAt","focusMoveTarget","viewAxis"]),gn=class extends bn{#e=null;#r=null;#a=null;#s=!1;attach(t,{moveAllowed:r=!1}={}){this.#s=!!r,super.attach(t)}replay(t){this.shared.gpuBudget!=null&&t.setGpuBudget(Ro(this.shared.gpuBudget)),this.#e&&t.setSystemScene(this.#e),this.#r&&this.#n(t,this.#r),t.setMoveAllowed(this.#s),this.#a!=null&&t.setLabelsVisible(this.#a)}applySelection(t,r){if(!r){t.clearSelection();return}if(t.focusPlacement(r.occurrence)!=="board")return;let a=Qf(t.nets(),r);a.kind==="board"?t.selectBoardContext():Zf(t,a)}setSystemScene(t){this.#e=t||null,t&&this.port?.setSystemScene(t)}setNetEmphasis(t){this.#r=Array.isArray(t)?t:[];let r=this.port;return r?this.#n(r,this.#r):[]}#n(t,r){let a=t.anyEmphasis(),s=t.setEmphasisSets(Wv(r));if(!s)return[];let n=t.anyEmphasis(),i=eh(a,n);return i==="enter"?t.showNetProbe():i==="leave"&&(t.isolating()&&t.setNetIsolation(!1),t.restoreVisibility()),t.isolating()&&n&&t.isolateLitNets(),s}frameNetEmphasis(t=null,r=null){return this.port?.frameNetEmphasis(t,r)??!1}frameAll(){this.port?.frameAll()}frameBoard(t){return this.port?.frameBoard(t)??!1}frameParts(t){return this.port?.frameParts(t)??!1}setMoveAllowed(t){this.#s=!!t,this.port?.setMoveAllowed(this.#s)}setMoveMode(t,r){this.port?.setMoveMode(t,r)}setRouteMode(t){this.port?.setMoveMode(t,{route:!0})}setMoveSpace(t){this.port?.setMoveSpace(t)}previewPose(t){this.port?.previewPose(t)}cancelMove(){this.port?.cancelMove()}getMoveState(){return this.port?.getMoveState()??null}targetHarnessNode(t){this.port?.targetHarnessNode(t)}selectHarness(t){return this.port?.selectHarness(t)??!1}previewHarnessNode(t){this.port?.previewHarnessNode(t)}cancelHarnessNode(){this.port?.cancelHarnessNode()}getHarnessState(){return this.port?.getHarnessState()??null}setLabelsVisible(t){this.#a=!!t,this.port?.setLabelsVisible(this.#a)}setHarnessesVisible(t){this.port?.setHarnessesVisible(!!t)}setHelpVisible(t){this.port?.setHelpVisible(t)}isHelpVisible(){return!!this.port?.isHelpVisible()}setLodThresholds(t){return this.port?.setLodThresholds(t)??null}pickSurfaceAt(t,r){return this.port?.pickSurfaceAt(t,r)??null}focusMoveTarget(t){return!!this.port?.focusMoveTarget(t)}viewAxis(t,r=!1){this.port?.viewAxis(t,r)}};function th(e){let t=(r,a)=>{for(let s of r)Object.defineProperty(e,s,{configurable:!0,writable:!0,value(...n){return a(this)[s](...n)}})};t(Xv,r=>r.activeMode),t($v,r=>r.modes.board),t(Yv,r=>r.modes.system)}var Bo=Object.freeze({viridis:["#440154","#482878","#3e4989","#31688e","#26828e","#1f9e89","#35b779","#6ece58","#b5de2b","#fde725"],inferno:["#000004","#1b0c41","#4a0c6b","#781c6d","#a52c60","#cf4446","#ed6925","#fb9b06","#f7d13d","#fcffa4"],magma:["#000004","#180f3d","#440f76","#721f81","#9e2f7f","#cd4071","#f1605d","#fd9668","#feca8d","#fcfdbf"],plasma:["#0d0887","#46039f","#7201a8","#9c179e","#bd3786","#d8576b","#ed7953","#fb9f3a","#fdca26","#f0f921"],cividis:["#00224e","#123570","#3b496c","#575d6d","#707173","#8a8678","#a59c74","#c3b369","#e1cc55","#fee838"],turbo:["#30123b","#4662d7","#36aaf9","#1ae4b6","#72fe5e","#c8ef34","#faba39","#f66b19","#ca2a04","#7a0403"],coolwarm:["#3b4cc0","#6788ee","#9abbff","#c9d7f0","#edd1c2","#f7a889","#e26952","#b40426"],ember:["#e0e3ed","#ff9e1f","#db141a"],ice:["#f4f7fb","#9ecae1","#2171b5","#08306b"],white:["#fafaf5","#fafaf5"],greys:["#f7f7f7","#bdbdbd","#737373","#252525"]}),Pr=256,Ta=Object.freeze({fieldColormap:"viridis",arrowColormap:"ember",arrowDensity:70,arrowWidth:.07,arrowMinLength:.3,arrowOutline:[.05,.05,.07,.85]});function rh(e){let t=String(e).replace(/^#/,"");if(!/^[0-9a-fA-F]{6}$/.test(t))throw new TypeError(`colour ${e} is not #rrggbb`);return[0,2,4].map(r=>Number.parseInt(t.slice(r,r+2),16)/255)}function Co(e){if(Array.isArray(e)){if(e.length<2)throw new TypeError("a colormap needs two or more stops");return e.forEach(rh),[...e]}let t=Bo[e];if(!t)throw new TypeError(`unknown colormap ${e}`);return[...t]}function Oo(e,t=Pr){let r=Co(e).map(rh),a=new Float32Array(t*4);for(let s=0;s<t;s++){let n=s/(t-1)*(r.length-1),i=Math.min(r.length-2,Math.floor(n)),o=n-i;for(let c=0;c<3;c++)a[s*4+c]=r[i][c]*(1-o)+r[i+1][c]*o;a[s*4+3]=1}return a}function Fo(e={},t=Ta){let r={...t,...e||{}};Co(r.fieldColormap),Co(r.arrowColormap);let a=(s,n)=>{if(!(Number(r[s])>0&&Number(r[s])<=n))throw new RangeError(`${s} must be in (0, ${n}]`);r[s]=Number(r[s])};if(a("arrowDensity",400),a("arrowWidth",.5),a("arrowMinLength",1),!Array.isArray(r.arrowOutline)||r.arrowOutline.length!==4)throw new TypeError("arrowOutline is [r, g, b, a]");return r}var jr=class{__destroy_into_raw(){let t=this.__wbg_ptr;return this.__wbg_ptr=0,ah.unregister(this),t}free(){let t=this.__destroy_into_raw();K.__wbg_analyticpack_free(t,0)}barrelRecords(){let t=K.analyticpack_barrelRecords(this.__wbg_ptr);return Ca.__wrap(t)}bindingJson(t){let r,a;try{let i=K.analyticpack_bindingJson(this.__wbg_ptr,t);var s=i[0],n=i[1];if(i[3])throw s=0,n=0,yn(i[2]);return r=s,a=n,Oa(s,n)}finally{K.__wbindgen_free(r,a,1)}}headerJson(){let t,r;try{let n=K.analyticpack_headerJson(this.__wbg_ptr);var a=n[0],s=n[1];if(n[3])throw a=0,s=0,yn(n[2]);return t=a,r=s,Oa(a,s)}finally{K.__wbindgen_free(t,r,1)}}lowerSlice(t,r){let a=t1(t,K.__wbindgen_malloc,K.__wbindgen_realloc),s=Fa,n=K.analyticpack_lowerSlice(this.__wbg_ptr,a,s,r);if(n[2])throw yn(n[1]);return Ba.__wrap(n[0])}constructor(t){let r=e1(t,K.__wbindgen_malloc),a=Fa,s=K.analyticpack_new(r,a);if(s[2])throw yn(s[1]);return this.__wbg_ptr=s[0],ah.register(this,this.__wbg_ptr,this),this}operationNetIndices(t){let r=K.analyticpack_operationNetIndices(this.__wbg_ptr,t);var a=gt(r[0],r[1]).slice();return K.__wbindgen_free(r[0],r[1]*4,4),a}};Symbol.dispose&&(jr.prototype[Symbol.dispose]=jr.prototype.free);var Ca=class e{static __wrap(t){let r=Object.create(e.prototype);return r.__wbg_ptr=t,sh.register(r,r.__wbg_ptr,r),r}__destroy_into_raw(){let t=this.__wbg_ptr;return this.__wbg_ptr=0,sh.unregister(this),t}free(){let t=this.__destroy_into_raw();K.__wbg_barrelrecords_free(t,0)}floats(){let t=K.barrelrecords_floats(this.__wbg_ptr);var r=xn(t[0],t[1]).slice();return K.__wbindgen_free(t[0],t[1]*4,4),r}skipped(){return K.barrelrecords_skipped(this.__wbg_ptr)>>>0}words(){let t=K.barrelrecords_words(this.__wbg_ptr);var r=gt(t[0],t[1]).slice();return K.__wbindgen_free(t[0],t[1]*4,4),r}};Symbol.dispose&&(Ca.prototype[Symbol.dispose]=Ca.prototype.free);var Ba=class e{static __wrap(t){let r=Object.create(e.prototype);return r.__wbg_ptr=t,nh.register(r,r.__wbg_ptr,r),r}__destroy_into_raw(){let t=this.__wbg_ptr;return this.__wbg_ptr=0,nh.unregister(this),t}free(){let t=this.__destroy_into_raw();K.__wbg_loweredslicerecords_free(t,0)}batches(){let t=K.loweredslicerecords_batches(this.__wbg_ptr);var r=gt(t[0],t[1]).slice();return K.__wbindgen_free(t[0],t[1]*4,4),r}contourEdgeOperations(){let t=K.loweredslicerecords_contourEdgeOperations(this.__wbg_ptr);var r=gt(t[0],t[1]).slice();return K.__wbindgen_free(t[0],t[1]*4,4),r}contourEdges(){let t=K.loweredslicerecords_contourEdges(this.__wbg_ptr);var r=xn(t[0],t[1]).slice();return K.__wbindgen_free(t[0],t[1]*4,4),r}covers(){let t=K.loweredslicerecords_covers(this.__wbg_ptr);var r=gt(t[0],t[1]).slice();return K.__wbindgen_free(t[0],t[1]*4,4),r}cutIndices(){let t=K.loweredslicerecords_cutIndices(this.__wbg_ptr);var r=gt(t[0],t[1]).slice();return K.__wbindgen_free(t[0],t[1]*4,4),r}edgeCuts(){let t=K.loweredslicerecords_edgeCuts(this.__wbg_ptr);var r=gt(t[0],t[1]).slice();return K.__wbindgen_free(t[0],t[1]*4,4),r}fanVertices(){let t=K.loweredslicerecords_fanVertices(this.__wbg_ptr);var r=xn(t[0],t[1]).slice();return K.__wbindgen_free(t[0],t[1]*4,4),r}outlineEdges(){let t=K.loweredslicerecords_outlineEdges(this.__wbg_ptr);var r=xn(t[0],t[1]).slice();return K.__wbindgen_free(t[0],t[1]*4,4),r}outlineShapes(){let t=K.loweredslicerecords_outlineShapes(this.__wbg_ptr);var r=gt(t[0],t[1]).slice();return K.__wbindgen_free(t[0],t[1]*4,4),r}shapeCuts(){let t=K.loweredslicerecords_shapeCuts(this.__wbg_ptr);var r=gt(t[0],t[1]).slice();return K.__wbindgen_free(t[0],t[1]*4,4),r}shapes(){let t=K.loweredslicerecords_shapes(this.__wbg_ptr);var r=gt(t[0],t[1]).slice();return K.__wbindgen_free(t[0],t[1]*4,4),r}statsJson(){let t,r;try{let a=K.loweredslicerecords_statsJson(this.__wbg_ptr);return t=a[0],r=a[1],Oa(a[0],a[1])}finally{K.__wbindgen_free(t,r,1)}}subtractShapes(){return K.loweredslicerecords_subtractShapes(this.__wbg_ptr)>>>0}};Symbol.dispose&&(Ba.prototype[Symbol.dispose]=Ba.prototype.free);function Jv(){return{__proto__:null,"./prism_kicad_analytic_bg.js":{__proto__:null,__wbg___wbindgen_throw_bb96b2010945f0bc:function(t,r){throw new Error(Oa(t,r))},__wbindgen_cast_0000000000000001:function(t,r){return Oa(t,r)},__wbindgen_init_externref_table:function(){let t=K.__wbindgen_externrefs,r=t.grow(4);t.set(0,void 0),t.set(r+0,void 0),t.set(r+1,null),t.set(r+2,!0),t.set(r+3,!1)}}}}var ah=typeof FinalizationRegistry>"u"?{register:()=>{},unregister:()=>{}}:new FinalizationRegistry(e=>K.__wbg_analyticpack_free(e,1)),sh=typeof FinalizationRegistry>"u"?{register:()=>{},unregister:()=>{}}:new FinalizationRegistry(e=>K.__wbg_barrelrecords_free(e,1)),nh=typeof FinalizationRegistry>"u"?{register:()=>{},unregister:()=>{}}:new FinalizationRegistry(e=>K.__wbg_loweredslicerecords_free(e,1));function xn(e,t){return e=e>>>0,Qv().subarray(e/4,e/4+t)}function gt(e,t){return e=e>>>0,Zv().subarray(e/4,e/4+t)}var Aa=null;function Qv(){return(Aa===null||Aa.byteLength===0)&&(Aa=new Float32Array(K.memory.buffer)),Aa}function Oa(e,t){return a1(e>>>0,t)}var _a=null;function Zv(){return(_a===null||_a.byteLength===0)&&(_a=new Uint32Array(K.memory.buffer)),_a}var Ia=null;function Ra(){return(Ia===null||Ia.byteLength===0)&&(Ia=new Uint8Array(K.memory.buffer)),Ia}function e1(e,t){let r=t(e.length*1,1)>>>0;return Ra().set(e,r/1),Fa=e.length,r}function t1(e,t,r){if(r===void 0){let o=Na.encode(e),c=t(o.length,1)>>>0;return Ra().subarray(c,c+o.length).set(o),Fa=o.length,c}let a=e.length,s=t(a,1)>>>0,n=Ra(),i=0;for(;i<a;i++){let o=e.charCodeAt(i);if(o>127)break;n[s+i]=o}if(i!==a){i!==0&&(e=e.slice(i)),s=r(s,a,a=i+e.length*3,1)>>>0;let o=Ra().subarray(s+i,s+a),c=Na.encodeInto(e,o);i+=c.written,s=r(s,a,i,1)>>>0}return Fa=i,s}function yn(e){let t=K.__wbindgen_externrefs.get(e);return K.__externref_table_dealloc(e),t}var wn=new TextDecoder("utf-8",{ignoreBOM:!0,fatal:!0});wn.decode();var r1=2146435072,Po=0;function a1(e,t){return Po+=t,Po>=r1&&(wn=new TextDecoder("utf-8",{ignoreBOM:!0,fatal:!0}),wn.decode(),Po=t),wn.decode(Ra().subarray(e,e+t))}var Na=new TextEncoder;"encodeInto"in Na||(Na.encodeInto=function(e,t){let r=Na.encode(e);return t.set(r),{read:e.length,written:r.length}});var Fa=0,s1,n1,K;function i1(e,t){return n1=e,K=e.exports,s1=t,Aa=null,_a=null,Ia=null,K.__wbindgen_start(),K}async function o1(e,t){if(typeof Response=="function"&&e instanceof Response){if(!e.ok)throw new Error(`failed to fetch Wasm: ${e.status} ${e.statusText} fetching '${e.url}'`);if(typeof WebAssembly.instantiateStreaming=="function")try{return await WebAssembly.instantiateStreaming(e,t)}catch(s){if(r(e.type)&&e.headers.get("Content-Type")!=="application/wasm")console.warn("`WebAssembly.instantiateStreaming` failed because your server does not serve Wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n",s);else throw s}let a=await e.arrayBuffer();return await WebAssembly.instantiate(a,t)}else{let a=await WebAssembly.instantiate(e,t);return a instanceof WebAssembly.Instance?{instance:a,module:e}:a}function r(a){switch(a){case"basic":case"cors":case"default":return!0}return!1}}async function ih(e){if(K!==void 0)return K;e!==void 0&&(Object.getPrototypeOf(e)===Object.prototype?{module_or_path:e}=e:console.warn("using deprecated parameters for the initialization function; pass a single object instead")),e===void 0&&(e=new URL("prism_kicad_analytic_bg.wasm",import.meta.url));let t=Jv();(typeof e=="string"||typeof Request=="function"&&e instanceof Request||typeof URL=="function"&&e instanceof URL)&&(e=fetch(e));let{instance:r,module:a}=await o1(await e,t);return i1(r,a)}var oh={schema:"prism.vendored_wasm.a0",purpose:"Reads materialization packs (kicad_monkey.materialization.a0) in the browser and lowers their slices for the analytic renderer.",source:{repository:"this repository",crate:"prism-kicad-wasm",native_src_rs_tree:"5b03b10ee0e1b0c9d2449fbb47596a4065a1785d",license:"MIT"},build:{target:"wasm32-unknown-unknown",profile:"release",features:["materialization"],wasm_bindgen:"0.2.127",rustc:"rustc 1.98.0 (88d9e12ae 2026-08-18)",command:"node scripts/build-analytic-wasm.mjs"},files:{"prism_kicad_analytic.js":"c93b31ad6ad5e7bc4ef2b0e658e1f514c81a9124dfc6a42db5ea1c5fa96d5fd9","prism_kicad_analytic_bg.wasm":"8fcc4ad15c6f41bc1358b9d739faf9264a06758edf7e587afc11db6b38a3b85d"}};var ch="prism-kicad-analytic.wasm",l1="kicad_monkey.materialization.a0",fr=1e3,jo=null;function Lr(){return String(oh.files?.["prism_kicad_analytic_bg.wasm"]||"").slice(0,16)}function fh(){let e=Lr();try{return new URL(`${ch}?v=${e}`,import.meta.url)}catch{return`/${ch}?v=${e}`}}function d1(e=fh()){return jo??=ih({module_or_path:e}).catch(t=>{throw jo=null,t}),jo}function u1(e,t,r=fr){let a=e.lowerSlice(t,r);try{return{shapes:new Uint32Array(a.shapes()),subtractShapes:a.subtractShapes(),fanVertices:new Float32Array(a.fanVertices()),covers:new Uint32Array(a.covers()),batches:new Uint32Array(a.batches()),contourEdges:new Float32Array(a.contourEdges()),contourEdgeOperations:new Uint32Array(a.contourEdgeOperations()),shapeCuts:new Uint32Array(a.shapeCuts()),edgeCuts:new Uint32Array(a.edgeCuts()),cutIndices:new Uint32Array(a.cutIndices()),outlineEdges:new Float32Array(a.outlineEdges()),outlineShapes:new Uint32Array(a.outlineShapes()),stats:JSON.parse(a.statsJson())}}finally{a.free()}}function Mn(){return String(fh())}async function Pa(e,{wasm:t}={}){await d1(t);let r=new jr(e instanceof Uint8Array?e:new Uint8Array(e)),a=JSON.parse(r.headerJson());if(a.schema!==l1)throw new Error(`unsupported materialization schema ${a.schema}`);return{header:a,lowerSlice(s,n=fr){return u1(r,s,n)},barrels(){let s=r.barrelRecords();try{return{floats:new Float32Array(s.floats()),words:new Uint32Array(s.words()),skipped:s.skipped()}}finally{s.free()}},binding(s){return JSON.parse(r.bindingJson(s))},netIndices(){return new Uint32Array(r.operationNetIndices(Dr(a)))},free(){r.free()}}}function Dr(e){return(e.chunks||[]).reduce((t,r)=>t+Number(r.operation_count||0),0)}function f1(e,t){let r=null;for(let a of e.chunks||[]){if(a.slice_key!==t)continue;let s=a.bounds,n=[s.min_x_nm,s.min_y_nm,s.max_x_nm,s.max_y_nm].map(i=>i/1e6);r=r?[Math.min(r[0],n[0]),Math.min(r[1],n[1]),Math.max(r[2],n[2]),Math.max(r[3],n[3])]:n}return r}var h1={conductor:"copper",solder_mask:"mask",silkscreen:"silk",paste:"paste",dielectric:"dielectric"},hh=1e-6,bh=2e-6,lh=1e-7,dh={"fr4 natural":[109,116,75],"ptfe natural":[252,252,250],polyimide:[205,130,0],"phenolic natural":[92,17,6],aluminum:[213,213,213]};function b1(e){let t=String(e||"").trim(),r=/^#([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(t);return[...(r?[0,2,4].map(s=>parseInt(r[1].slice(s,s+2),16)):dh[t.toLowerCase()]||dh["fr4 natural"]).map(s=>s/255),1]}function ph(e,t,r=0){let a=new Map((t||[]).map(u=>[String(u.name),u])),s=[...e.stack?.slices||[]].sort((u,m)=>u.order-m.order),n=s.filter(u=>u.role==="conductor"),i=u=>Number(a.get(String(u?.kicad_layer||""))?.id||0),o=i(n[0]),c=i(n[n.length-1]),l=[],f=[];for(let u of s){let m=h1[u.role],g=a.get(String(u.kicad_layer||"")),y=f1(e,u.key);if(!m||!g||!y){m&&f.push(u.key);continue}let x=Number(g.z_mm||0)/1e3+r,v=(Number(g.thickness_mm)||Number(u.thickness_nm||0)/1e6)/2e3,E=u.side==="back"||m!=="dielectric"&&m!=="copper"&&x<r,S={key:u.key,role:m,layerId:Number(g.id),side:u.side||null,bounds:y};if(m==="dielectric"){S.color=b1(g.color);let T=[...n].reverse().find(C=>C.order<u.order),_=n.find(C=>C.order>u.order),I=[i(T)||i(_),i(_)||i(T)],N={zTop:x+v,zBottom:x-v};l.push({...S,...N,face:"top",z:x+v-lh,faceDown:!1,outer:!1,offsetLayers:I}),l.push({...S,...N,face:"bottom",z:x-v+lh,faceDown:!0,outer:!1,offsetLayers:I})}else if(m==="copper"){let T=n.indexOf(u),_=T===n.length-1&&n.length>1,I=T===0||_,N={...S,bottom:_,outer:I,zTop:x+v,zBottom:x-v,offsetLayers:[Number(g.id),Number(g.id)]};l.push({...N,face:"top",z:x+v,faceDown:!1,mark:I&&!_,walls:!_}),l.push({...N,face:"bottom",z:x-v,faceDown:!0,mark:_,walls:_})}else{let T=m==="silk"?bh:m==="paste"?hh:0,_=E?c:o;l.push({...S,z:E?x-v-T:x+v+T,faceDown:E,outer:!1,thickness:v*2,offsetLayers:[_,_]})}}p1(l);let d=l.filter(u=>u.role==="dielectric"),p=d.filter(u=>!u.faceDown).sort((u,m)=>m.z-u.z)[0],b=d.filter(u=>u.faceDown).sort((u,m)=>u.z-m.z)[0];for(let u of d)u.skin=u===p||u===b;let h={dielectric:0,copper:1,mask:2,paste:3,silk:4};return l.sort((u,m)=>h[u.role]-h[m.role]),{planned:l,unmatched:f}}function p1(e){for(let t of e){if(t.role!=="mask"&&t.role!=="silk"&&t.role!=="paste")continue;let r=e.find(c=>c.role==="copper"&&c.mark&&c.faceDown===t.faceDown);if(!r)continue;let a=t.faceDown?-1:1,s=t.faceDown?r.zTop:r.zBottom,n=t.faceDown?r.zBottom:r.zTop,o=e.find(c=>c.role==="mask"&&c.faceDown===t.faceDown)?.thickness||0;t.role==="mask"?(t.coat=o,t.zLow=s+a*o):t.role==="silk"?t.zLow=s+a*(o+bh):t.z=n+a*hh}}function Go(e,t){let r=new Float32Array(Math.max(1,t)).fill(Number.NaN);if(ArrayBuffer.isView(e)||Array.isArray(e))for(let a=0;a<Math.min(t,e.length);a+=1)r[a]=Number(e[a]);else for(let[a,s]of Object.entries(e||{})){let n=Number(a);Number.isInteger(n)&&n>=0&&n<t&&(r[n]=Number(s))}return r}function Ur(e){let t=1/0,r=-1/0;for(let a of e)Number.isFinite(a)&&(t=Math.min(t,a),r=Math.max(r,a));return Number.isFinite(t)?[t,r]:[0,1]}function kn(e){let t=new Map,r=1e3;for(let a of e.slices||[]){if(!(a.nx>0&&a.ny>0)||a.values.length!==a.nx*a.ny)throw new Error(`grid field slice ${a.slice_key} has ${a.values.length} values for ${a.nx} x ${a.ny} cells`);t.set(a.slice_key,{originMm:[(e.origin_x_m+a.ix0*e.dx_m)*r,(e.origin_y_m+a.iy0*e.dy_m)*r],pitchMm:[e.dx_m*r,e.dy_m*r],width:a.nx,height:a.ny,values:a.values})}return t}function gh(e){let t=new Map;for(let a of e||[])t.has(a.slice_key)||t.set(a.slice_key,[]),t.get(a.slice_key).push(a);let r=new Map;for(let[a,s]of t){let n=Number(s[0].pitch_nm);if(!(n>0)||s.some(p=>Number(p.pitch_nm)!==n))throw new Error(`field tiles of ${a} must share one positive pitch`);let i=Math.min(...s.map(p=>p.origin_nm[0])),o=Math.min(...s.map(p=>p.origin_nm[1])),c=(p,b)=>{let h=(p-b)/n;if(!Number.isInteger(h))throw new Error(`field tile of ${a} is off its pitch grid`);return h},l=Math.max(...s.map(p=>c(p.origin_nm[0],i)+p.width)),f=Math.max(...s.map(p=>c(p.origin_nm[1],o)+p.height)),d=new Float32Array(l*f).fill(Number.NaN);for(let p of s){let b=c(p.origin_nm[0],i),h=c(p.origin_nm[1],o);for(let u=0;u<p.height;u+=1)d.set(p.values.subarray?p.values.subarray(u*p.width,(u+1)*p.width):p.values.slice(u*p.width,(u+1)*p.width),(h+u)*l+b)}r.set(a,{originMm:[i/1e6,o/1e6],pitchMm:n/1e6,width:l,height:f,values:d})}return r}var Lo=8,vn=8,uh=4294967295,g1=Object.freeze({unplated:2,tentedFront:4,tentedBack:8,coveredFront:16,coveredBack:32,pluggedFront:64,pluggedBack:128,filled:256,capped:512,castellated:1024}),Do=16;function m1(e,t,r){let a=null;for(let s=0;e&&s+3<e.length;s+=4){let n=[e[s],e[s+1]],i=[e[s+2],e[s+3]],o=[i[0]-n[0],i[1]-n[1]],c=o[0]*o[0]+o[1]*o[1];if(c<=0)continue;let l=Math.max(0,Math.min(1,((t[0]-n[0])*o[0]+(t[1]-n[1])*o[1])/c)),f=Math.hypot(t[0]-n[0]-l*o[0],t[1]-n[1]-l*o[1]);if(f>r||a&&f>=a.distance)continue;let d=Math.sqrt(c),p=[o[1]/d,o[0]/d];a={distance:f,normal:p,offset:(p[0]*n[0]-p[1]*n[1])/1e3}}return a&&{normal:a.normal,offset:a.offset}}function mh(e,t,r,a=null){let s=(e.stack?.slices||[]).filter(b=>b.role==="conductor").sort((b,h)=>b.order-h.order),n=new Map((r||[]).filter(b=>b.role===void 0||b.role==="copper").map(b=>[b.key,b])),i=b=>{let h=n.get(b.key);if(!h)return null;if(h.zTop!==void 0)return{top:h.zTop,bottom:h.zBottom,layerId:h.layerId};let u=Number(b.thickness_nm||0)/1e9;return h.bottom?{top:h.z+u,bottom:h.z,layerId:h.layerId}:{top:h.z,bottom:h.z-u,layerId:h.layerId}},o=Math.floor(t.floats.length/Lo),c=new ArrayBuffer(o*Do*4),l=new Float32Array(c),f=new Uint32Array(c),d=0,p=t.skipped||0;for(let b=0;b<o;b+=1){let h=t.floats.subarray(b*Lo,(b+1)*Lo),u=t.words.subarray(b*vn,(b+1)*vn),[m,g]=[Math.min(u[1],u[2]),Math.max(u[1],u[2])],y=s.filter(T=>T.order>=m&&T.order<=g&&(u[3]===uh||T.order>u[3])&&(u[4]===uh||T.order<u[4])),x=y.length?i(y[0]):null,v=y.length?i(y[y.length-1]):null;if(!x||!v){p+=1;continue}let E=d*Do;l.set([h[0]/1e3,-h[1]/1e3,h[2]/1e3,-h[3],h[4]/1e3,h[5]/1e3,x.top,v.bottom],E),f.set([u[0],x.layerId,v.layerId,u[5]],E+8);let S=u[5]&g1.castellated?m1(a,[h[0],h[1]],h[4]+h[2]):null;l.set(S?[S.normal[0],S.normal[1],S.offset,0]:[0,0,1,0],E+12),d+=1}return{data:c.slice(0,d*Do*4),count:d,skipped:p}}var Uo=12,y1=0,x1=1;function yh(e,t,r,a=0){let s=(r||[]).filter(b=>b.role==="soldermask").map(b=>Number(b.z_mm)/1e3+a+Math.sign(Number(b.z_mm))*Number(b.thickness_mm||0)/2e3),n=s.length?Math.max(...s):null,i=s.length?Math.min(...s):null,o=e.filter(b=>b.role==="dielectric"&&b.face==="top"&&t.get(b.key)?.contourEdges?.length),c=[],l=(b,h,u,m,g,y)=>{let x=t.get(b.key).contourEdges;for(let v=0;v+3<x.length;v+=4)c.push([x[v],x[v+1],x[v+2],x[v+3],h,u,m,g,y])};for(let b of o)l(b,b.zTop,b.zBottom,b.offsetLayers[0],b.offsetLayers[1],y1);for(let b of e.filter(h=>h.role==="copper"&&h.face==="top")){let h=v=>Math.min(Math.abs(v.zBottom-b.zTop),Math.abs(v.zTop-b.zBottom)),u=[...o].sort((v,E)=>h(v)-h(E))[0];if(!u)continue;let m=b.outer&&!b.bottom,g=b.outer&&b.bottom,y=m&&n!=null?Math.max(n,b.zTop):b.zTop,x=g&&i!=null?Math.min(i,b.zBottom):b.zBottom;l(u,y,x,b.layerId,b.layerId,x1)}let f=new ArrayBuffer(c.length*Uo*4),d=new Float32Array(f),p=new Uint32Array(f);return c.forEach(([b,h,u,m,g,y,x,v,E],S)=>{d.set([b/1e3,-h/1e3,u/1e3,-m/1e3,g,y,0,0],S*Uo),p.set([x,v,E,0],S*Uo+8)}),{data:f,count:c.length}}function xh(e,t){let r=new Map;for(let o of t||[])for(let c of o?.aliases||[])r.has(String(c))||r.set(String(c),Number(o.id));for(let o of t||[])o?.name&&r.set(String(o.name),Number(o.id));let a=e.header.nets||[];if(typeof e.netIndices=="function"){let o=new Uint32Array(a.length+1);a.forEach((f,d)=>{o[d+1]=r.get(f.name??f.key)||r.get(f.key)||0});let c=e.netIndices(),l=new Uint32Array(c.length);for(let f=0;f<c.length;f+=1)l[f]=o[c[f]];return l}let s=new Map(a.map(o=>[o.key,o.name])),n=Dr(e.header),i=new Uint32Array(n);for(let o=0;o<n;o+=1){let c=e.binding(o)?.net_key;c&&(i[o]=r.get(s.get(c)??c)||0)}return i}var wh={Uint32Array,Float32Array},ja=".board";function vh(e,t,r){return{header:e,barrelFloats:t.floats,barrelWords:t.words,barrelSkipped:t.skipped,netIndices:r}}function Mh(e,t,r,a){return`analytic-lowered-a1/${e}/${t}/${r}/${a}`}function w1(e){let t=[],r=[];for(let[f,d]of Object.entries(e)){if(!ArrayBuffer.isView(d))continue;let p=d.constructor.name;if(!wh[p])throw new TypeError(`cannot cache a ${p} (${f})`);t.push({name:f,kind:p,length:d.length}),r.push(new Uint8Array(d.buffer,d.byteOffset,d.byteLength))}let a=Object.fromEntries(Object.entries(e).filter(([,f])=>!ArrayBuffer.isView(f))),s=new TextEncoder().encode(JSON.stringify({fields:t,rest:a})),n=Math.ceil(s.length/4)*4,i=8+n+r.reduce((f,d)=>f+Math.ceil(d.length/4)*4,0),o=new Uint8Array(i),c=new DataView(o.buffer);c.setUint32(0,1280527440,!0),c.setUint32(4,s.length,!0),o.set(s,8);let l=8+n;for(let f of r)o.set(f,l),l+=Math.ceil(f.length/4)*4;return o}function En(e){let t=e instanceof Uint8Array?e:new Uint8Array(e);if(t.length<8)return null;let r=new DataView(t.buffer,t.byteOffset,t.byteLength);if(r.getUint32(0,!0)!==1280527440)return null;let a=r.getUint32(4,!0),s;try{s=JSON.parse(new TextDecoder().decode(t.subarray(8,8+a)))}catch{return null}let n={...s.rest},i=8+Math.ceil(a/4)*4;for(let{name:o,kind:c,length:l}of s.fields){let f=wh[c];if(!f)return null;let d=l*f.BYTES_PER_ELEMENT;if(i+d>t.length||(t.byteOffset+i)%f.BYTES_PER_ELEMENT)return null;n[o]=new f(t.buffer,t.byteOffset+i,l),i+=Math.ceil(d/4)*4}return n}async function La(e,{cacheKey:t,wasmKey:r,toleranceNm:a},s){let n=new Map;return!e?.read||!t||await Promise.all(s.map(async i=>{try{let o=await e.read(Mh(t,r,a,i)),c=o?En(o):null;c&&n.set(i,c)}catch{}})),n}function zo(e,{cacheKey:t,wasmKey:r,toleranceNm:a},s){return!e?.write||!t?Promise.resolve():Promise.all([...s].map(([n,i])=>e.write(Mh(t,r,a,n),i instanceof Uint8Array?i:w1(i)).catch(()=>{}))).then(()=>{})}function kh(e,t,r){return`analytic-lowered-a1/${e}/${t}/${r}/.complete`}async function Eh(e,{cacheKey:t,wasmKey:r,toleranceNm:a}){if(!e?.read||!t)return!1;try{return!!await e.read(kh(t,r,a))}catch{return!1}}async function Sh(e,{cacheKey:t,wasmKey:r,toleranceNm:a},s=Promise.resolve()){!e?.write||!t||(await s,await e.write(kh(t,r,a),new Uint8Array([1])).catch(()=>{}))}var v1="prism-semantic-viewer-lower.js",Sn=3;function M1(){if(typeof Worker>"u")return null;try{let e=new URL(import.meta.url),t=e.searchParams.get("v");return new URL(`${v1}${t?`?v=${t}`:""}`,e)}catch{return null}}function Tn(e,t=globalThis.navigator?.hardwareConcurrency||4){return Math.max(1,Math.min(Sn,Math.max(1,t-1),e))}function k1(e,t,r){let a=Array.from({length:Math.max(1,r)},()=>({keys:[],load:0})),s=new Map(e.map((i,o)=>[i,o])),n=[...e].sort((i,o)=>(t.get(o)||1)-(t.get(i)||1)||s.get(i)-s.get(o));for(let i of n){let o=a.reduce((c,l)=>l.load<c.load?l:c,a[0]);o.keys.push(i),o.load+=t.get(i)||1}return a.filter(i=>i.keys.length).map(i=>i.keys.sort((o,c)=>s.get(o)-s.get(c)))}function Th(e){let t=new Map;for(let r of e?.chunks||[])t.set(r.slice_key,(t.get(r.slice_key)||0)+Number(r.operation_count||0));return t}var Ko=new Map;function E1(e){if(!Ko.has(e)){let t=typeof WebAssembly?.compileStreaming=="function"&&typeof fetch=="function"?WebAssembly.compileStreaming(fetch(e)).catch(()=>null):Promise.resolve(null);Ko.set(e,t)}return Ko.get(e)}var Da=class e{static start(t,r,a=Tn(Sn)){let s=M1();if(!s||typeof r!="string")return null;let n=[],i=E1(r);for(let o=0;o<a;o+=1){let c;try{c=new Worker(s,{type:"module",name:`analytic-lower-${o}`})}catch{break}let l={worker:c,pending:new Map,alive:!0};c.onmessage=({data:d})=>{let p=l.pending.get(d.id);l.pending.delete(d.id),p?.(d)},c.onerror=d=>{d.preventDefault?.(),l.alive=!1;for(let p of l.pending.values())p({error:"worker failed"});l.pending.clear()},l.opened=new Promise(d=>l.pending.set(0,p=>d(p.error?null:p.header)));let f=(t instanceof Uint8Array?t:new Uint8Array(t)).slice();i.then(d=>c.postMessage({type:"open",bytes:f.buffer,wasmUrl:r,wasmModule:d},[f.buffer])),n.push(l)}return n.length?new e(n):null}constructor(t){this.members=t,this.nextId=1}async header(){for(let t of this.members){let r=await t.opened;if(r&&t.alive)return r}return null}async host(){for(let t of this.members)if(await t.opened&&t.alive)return t;return null}async ask(t,r={},a=[],s=null){let n=s||await this.host();if(!n)throw new Error("no lowering worker has the pack open");return new Promise((i,o)=>{let c=this.nextId++;n.pending.set(c,l=>l.error?o(new Error(l.error)):i(l)),n.worker.postMessage({type:t,id:c,...r},a)})}async steps(t){let r=[];for(let n of this.members)await n.opened&&n.alive&&r.push(n);let a=(n,i)=>Object.fromEntries(i.map(o=>[o,ArrayBuffer.isView(n[o])?n[o].slice():n[o]])),s=["shapes","subtractShapes","contourEdges","contourEdgeOperations","outlineEdges","outlineShapes"];return Promise.all(t.map(([n,i],o)=>r.length?this.ask("step",{copper:a(n,s),mask:a(i,["shapes","subtractShapes"])},[],r[o%r.length]).then(c=>c.step,()=>null):null))}async release(){let t=await this.host();for(let r of this.members)r!==t&&r.worker.terminate();this.members=t?[t]:[]}async lower(t,r,a=new Map){if(!t.length)return new Map;let s=await Promise.all(this.members.map(l=>l.opened)),n=this.members.filter((l,f)=>s[f]&&l.alive);if(!n.length)return null;let i=k1(t,a,n.length),o=await Promise.all(i.map((l,f)=>new Promise(d=>{let p=n[f],b=this.nextId++;p.pending.set(b,h=>d(h.error?null:new Map(Object.entries(h.lowered)))),p.worker.postMessage({type:"lower",id:b,keys:l,toleranceNm:r})})));if(o.every(l=>l===null))return null;let c=new Map;for(let l of o)for(let[f,d]of l||[])c.set(f,d);return c}close(){for(let t of this.members)t.worker.terminate();this.members=[]}};async function Ah(e){let t=await e.header();if(!t)return null;let r=Dr(t);return{header:t,hosted:!0,async barrels(){return(await e.ask("barrels")).barrels},async netIndices(){return(await e.ask("netIndices",{count:r})).indices},async binding(a){return(await e.ask("binding",{index:a})).binding},free(){e.close()}}}function _h(e,t){return{header:e.header,hosted:!0,async barrels(){return{floats:e.barrelFloats,words:e.barrelWords,skipped:e.barrelSkipped}},async netIndices(){return e.netIndices},async binding(r){if(!t)throw new Error("no worker holds the pack");return(await t.ask("binding",{index:r})).binding},free(){t?.close()}}}async function Ih(e,t,r,a,{weights:s=new Map,workers:n}={}){if(!t.length)return new Map;let i=Da.start(e,a,n??Tn(t.length));if(!i)return null;try{return await i.lower(t,r,s)}finally{i.close()}}function Rh(e,t){let r=new Float32Array(e.buffer,e.byteOffset+t*20*4,20),[a,s,n,i,o,c]=[r[4],r[5],r[6],r[7],r[8],r[9]],l=[1/0,1/0,-1/0,-1/0];for(let[f,d]of[[r[10],r[11]],[r[12],r[11]],[r[10],r[13]],[r[12],r[13]]]){let p=a*f+s*d+o,b=n*f+i*d+c;l[0]=Math.min(l[0],p),l[1]=Math.min(l[1],b),l[2]=Math.max(l[2],p),l[3]=Math.max(l[3],b)}return l}function Nh(e){let t=e.contourEdges||new Float32Array(0),r=e.contourEdgeOperations||new Uint32Array(0),a=e.shapeCuts||new Uint32Array(0),s=e.edgeCuts||new Uint32Array(0),n=e.cutIndices||new Uint32Array(0),i=a.length,o=new Uint32Array(Math.max(1,i+n.length));for(let m=0;m<i;m+=2)o[m]=a[m]+i,o[m+1]=a[m+1];o.set(n,i);let c=e.outlineEdges||new Float32Array(0),l=e.outlineShapes||new Uint32Array(0),f=Math.min(t.length/4,r.length),d=new Uint32Array(Math.max(1,f+l.length)*7),p=new Uint32Array(t.buffer,t.byteOffset,t.length),b=0;for(let m=0;m<f;m+=1){if(r[m]&2147483648)continue;let g=b*7;d[g]=p[m*4],d[g+1]=p[m*4+1],d[g+2]=p[m*4+2],d[g+3]=p[m*4+3],d[g+4]=r[m],d[g+5]=(s[m*2]??0)+i,d[g+6]=s[m*2+1]??0,b+=1}let h=b,u=new Uint32Array(c.buffer,c.byteOffset,c.length);for(let m=0;m<l.length;m+=1){let g=b*7;d[g]=u[m*4],d[g+1]=u[m*4+1],d[g+2]=u[m*4+2],d[g+3]=u[m*4+3],d[g+4]=(1073741824|l[m])>>>0,b+=1}return{edgeWords:d,cutWords:o,regionEdges:h,skirtEdges:b-h}}function Ch(e){return e.edgeWords?e:Object.assign(e,Nh(e))}function Bh(e,t,r=.05){let a=t.shapes.subarray(0,t.subtractShapes*20),s=e.shapes.length/20,n=new Uint32Array(e.shapes.length+a.length);n.set(e.shapes),n.set(a,e.shapes.length);let i=a.length/20,o=new Float64Array(i*4),[c,l,f,d]=[1/0,1/0,-1/0,-1/0];for(let R=0;R<i;R+=1){let j=Rh(a,R);o.set(j,R*4),c=Math.min(c,j[0]),l=Math.min(l,j[1]),f=Math.max(f,j[2]),d=Math.max(d,j[3])}let[p,b]=[Math.floor(c),Math.floor(l)],h=i?Math.floor(f)-p+1:0,u=i?Math.floor(d)-b+1:0,m=(R,j,q)=>Math.min(q-1,Math.max(0,Math.floor(R)-j)),g=new Uint32Array(h*u+1),y=(R,j)=>{let[q,Y]=[m(o[R*4],p,h),m(o[R*4+2],p,h)],[te,we]=[m(o[R*4+1],b,u),m(o[R*4+3],b,u)];for(let ne=q;ne<=Y;ne+=1)for(let me=te;me<=we;me+=1)j(ne*u+me)};for(let R=0;R<i;R+=1)y(R,j=>{g[j+1]+=1});for(let R=0;R<h*u;R+=1)g[R+1]+=g[R];let x=new Uint32Array(g[h*u]),v=g.slice(0,h*u);for(let R=0;R<i;R+=1)y(R,j=>{x[v[j]++]=R});let E=[],S=[],T=new Uint32Array(i),_=0,I=(R,j,q,Y)=>{let te=E.length;if(_+=1,i&&Math.floor(q)>=p&&Math.floor(R)<=p+h-1&&Math.floor(Y)>=b&&Math.floor(j)<=b+u-1){let[we,ne]=[m(R,p,h),m(q,p,h)],[me,Pe]=[m(j,b,u),m(Y,b,u)];for(let he=we;he<=ne;he+=1)for(let Re=me;Re<=Pe;Re+=1){let je=he*u+Re;for(let Ve=g[je];Ve<g[je+1];Ve+=1){let ye=x[Ve];T[ye]!==_&&(T[ye]=_,o[ye*4]<=q&&R<=o[ye*4+2]&&o[ye*4+1]<=Y&&j<=o[ye*4+3]&&E.push(s+ye))}}}S.push(te,E.length-te)};for(let R=e.subtractShapes;R<s;R+=1){let j=Rh(e.shapes,R);I(j[0]-r,j[1]-r,j[2]+r,j[3]+r)}let N=s-e.subtractShapes,C=e.contourEdges||new Float32Array(0);for(let R=0;R+3<C.length;R+=4)I(Math.min(C[R],C[R+2])-r,Math.min(C[R+1],C[R+3])-r,Math.max(C[R],C[R+2])+r,Math.max(C[R+1],C[R+3])+r);let B=Nh({...e,shapeCuts:new Uint32Array(S.slice(0,N*2)),edgeCuts:new Uint32Array(S.slice(N*2)),cutIndices:new Uint32Array(E)});return{shapes:n,...B}}function Oh(e){let t=[];for(let r of e){if(r.role!=="mask"||r.zLow===void 0)continue;let a=e.find(s=>s.role==="copper"&&s.mark&&s.faceDown===r.faceDown);a&&t.push([r,a])}return t}function Ho(e,t){return`step:${e.key}:${t.key}`}var $o={color:{srcFactor:"src-alpha",dstFactor:"one-minus-src-alpha"},alpha:{srcFactor:"one",dstFactor:"one-minus-src-alpha"}};function Wo(e){let t=Float32Array.from(e);for(let r=0;r<t.length;r+=1)Number.isFinite(t[r])||(t[r]=3e38);return t}var _1=5e-4,I1={mask:"soldermask",silk:"silkscreen",paste:"paste"};function R1(e,t){let r=I1[t.role];return!!(e?.size&&r)&&e.has(C1(r,t.faceDown?"back":"front"))}function N1(e,t){let r=t?.soldermask?.front;return!e.soldermask&&r?.length>=3&&(e.soldermask={color:r,metallic:0,roughness:.6}),!e.paste&&t?.paste?.length>=3&&(e.paste={color:t.paste,metallic:0,roughness:.45}),!e.silkscreen&&t?.silkscreen?.length>=3&&(e.silkscreen={color:t.silkscreen,metallic:0,roughness:.8}),e}function C1(e,t){return`${e}:${t}`}var Uh=.3,Gh=new WeakMap,zh=new WeakMap;function Vh(e){let t=Gh.get(e);return t||(t={layout:e.createBindGroupLayout({label:"analytic",entries:[{binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}},{binding:1,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}},{binding:2,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:"read-only-storage"}},{binding:3,visibility:GPUShaderStage.VERTEX,buffer:{type:"read-only-storage"}},{binding:4,visibility:GPUShaderStage.FRAGMENT,buffer:{type:"read-only-storage"}},{binding:5,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:"unfilterable-float"}},{binding:6,visibility:GPUShaderStage.FRAGMENT,buffer:{type:"read-only-storage"}},{binding:7,visibility:GPUShaderStage.FRAGMENT,buffer:{type:"read-only-storage"}},{binding:8,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:"read-only-storage"}},{binding:9,visibility:GPUShaderStage.FRAGMENT,buffer:{type:"read-only-storage"}},{binding:10,visibility:GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}},{binding:11,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:"uint"}}]}),module:e.createShaderModule({label:"analytic",code:Vd})},Gh.set(e,t)),t}function Kh(e){let t=Vh(e.device);return{device:e.device,depthFormat:e.depthFormat,stencil:e.stencil,samples:e.sampleCount||1,layout:t.layout,module:t.module}}function Yo(e){return`${e.format}|${e.sampleCount||1}|${e.depthFormat}|${e.stencil?1:0}`}function Jo(e){let t=zh.get(e);return t||(t=new Map,zh.set(e,t)),t}function B1(e){return Jo(e.device).get(Yo(e))?.ready||null}function O1(e,t){let r=Jo(e.device),a=Yo(e);return r.get(a)?.ready||r.set(a,{ready:t,promise:Promise.resolve(t)}),t}function Xo(e,t,r,a){let s=e.device.createPipelineLayout({bindGroupLayouts:[e.layout]}),n=(o,c,l,f,d=[],p=!1,b="none")=>{let h=Ds[f],u={format:e.depthFormat,depthWriteEnabled:h.depth,depthCompare:h.depth||h.depthTest?"greater":"always"};return e.stencil&&Object.assign(u,{stencilFront:h.face,stencilBack:h.face,stencilReadMask:h.read,stencilWriteMask:h.write}),a({label:`analytic-${o}${r?"-pick":""}`,layout:s,vertex:{module:e.module,entryPoint:c,buffers:d},fragment:{module:e.module,entryPoint:r?`${l}_pick`:l,...r?{}:{constants:{SAMPLES:e.samples}},targets:[{format:t,writeMask:h.color?GPUColorWrite.ALL:0,...p&&!r?{blend:$o}:{}}]},primitive:{topology:"triangle-list",cullMode:b},depthStencil:u,multisample:{count:r?1:e.samples}})},i=[{arrayStride:8,attributes:[{shaderLocation:0,offset:0,format:"float32x2"}]}];return{shapeMask:n("shape-mask","vs_shape","fs_shape_mask","shapeMask"),shapeAdd:n("shape","vs_shape","fs_shape","shapeAdd"),fan:n("fan","vs_fan","fs_plain_mask","fan",i),coverSubtract:n("cover-subtract","vs_cover","fs_plain_mask","coverSubtract"),coverMark:n("cover-mark","vs_cover","fs_plain_mask","coverMark"),coverAdd:n("cover","vs_cover","fs_cover","coverAdd"),coverClear:n("cover-clear","vs_cover","fs_plain_mask","coverClear"),clear:n("clear","vs_clear","fs_plain_mask","clear"),regionWall:n("region-wall","vs_region_wall","fs_region_wall","solid"),skirt:n("skirt","vs_skirt","fs_skirt","solid"),...r?{}:{shapeLay:n("shape-lay","vs_shape","fs_shape_mask","shapeLay"),coverLay:n("cover-lay","vs_cover","fs_cover_mask","coverLay"),shapeBlend:n("shape-blend","vs_shape","fs_shape","shapeBlend",[],!0),coverBlend:n("cover-blend","vs_cover","fs_cover","coverBlend",[],!0),tintCovered:n("tint-covered","vs_clear","fs_tint_covered","tintCovered",[],!0),tintPlain:n("tint-plain","vs_clear","fs_tint_plain","tintPlain",[],!0),footShape:n("foot-shape","vs_shape","fs_shape_mask","footShape"),footCover:n("foot-cover","vs_cover","fs_cover_mask","footCover"),tintHigh:n("tint-high","vs_clear","fs_tint_covered","tintHigh",[],!0),tintLow:n("tint-low","vs_clear","fs_tint_plain","tintLow",[],!0),regionStep:n("region-step","vs_region_step","fs_region_step","coat"),step:n("step","vs_step","fs_step","coat"),clearLay:n("clear-lay","vs_clear","fs_plain_mask","clearLay"),clearFoot:n("clear-foot","vs_clear","fs_plain_mask","clearFoot"),shapeOnFoot:n("shape-on-foot","vs_shape","fs_shape","shapeOnFoot",[],!0),shapeOffFoot:n("shape-off-foot","vs_shape","fs_shape","shapeOffFoot",[],!0),coverOnFoot:n("cover-on-foot","vs_cover","fs_cover","coverOnFoot",[],!0),coverOffFoot:n("cover-off-foot","vs_cover","fs_cover","coverOffFoot",[],!0)}}}var br=class{constructor(t){this.renderer=t,this.device=t.device,this.stencil=t.stencil,this.samples=t.sampleCount||1,this.slices=[],this.skin=null,this.eye=null,this.viewMatrix=null,this.extent=null,this.overlay={mode:0,range:[0,1]};let r=Vh(this.device);this.layout=r.layout,this.module=r.module,this.boardClip=null,this.emptyClip=this.device.createTexture({label:"analytic-clip-none",size:[1,1],format:"r8uint",usage:GPUTextureUsage.TEXTURE_BINDING}),this.palette=this.device.createBuffer({label:"analytic-palette",size:8208,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),this.style=Fo(Ta),this.writePalette(),this.pipelines=B1(t)||O1(t,{color:this.makePipelines(t.format,!1),pick:this.makePipelines("rg32uint",!0)}),this.emptyValues=this.buffer(new Float32Array([3e38]),GPUBufferUsage.STORAGE,"analytic-values-empty"),this.valuesBuffer=this.emptyValues,this.emptyField=this.fieldTexture(1,1,new Float32Array([3e38])),this.uniformScratch=new ArrayBuffer(256),this.netsBuffer=this.buffer(new Uint32Array(1),GPUBufferUsage.STORAGE,"analytic-nets"),this.makeBarrelPipelines(),this.makeArrowPipeline()}makeArrowPipeline(){this.arrowLayout=this.device.createBindGroupLayout({label:"analytic-arrows",entries:[{binding:0,visibility:GPUShaderStage.VERTEX,buffer:{type:"uniform"}},{binding:1,visibility:GPUShaderStage.VERTEX,buffer:{type:"read-only-storage"}},{binding:2,visibility:GPUShaderStage.VERTEX,buffer:{type:"read-only-storage"}},{binding:3,visibility:GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}},{binding:4,visibility:GPUShaderStage.VERTEX,buffer:{type:"read-only-storage"}}]}),this.drawnLayers=new Uint32Array(256),this.drawnLayersBuffer=this.buffer(this.drawnLayers,GPUBufferUsage.STORAGE,"analytic-drawn-layers");let t=this.device.createShaderModule({label:"analytic-arrows",code:$d});this.arrowPipeline=this.device.createRenderPipeline({label:"analytic-arrow",layout:this.device.createPipelineLayout({bindGroupLayouts:[this.arrowLayout]}),vertex:{module:t,entryPoint:"vs_arrow"},fragment:{module:t,entryPoint:"fs_arrow",targets:[{format:this.renderer.format,blend:$o}]},primitive:{topology:"triangle-list",cullMode:"none"},depthStencil:{format:this.renderer.depthFormat,depthWriteEnabled:!1,depthCompare:"greater-equal"},multisample:{count:this.samples}}),this.arrows=null}writePalette(){let t=new Float32Array(8208/4);t.set(Oo(this.style.fieldColormap,Pr),0),t.set(Oo(this.style.arrowColormap,Pr),Pr*4),t.set(this.style.arrowOutline,2*Pr*4),this.device.queue.writeBuffer(this.palette,0,t),this.renderer.invalidate?.()}setStyle(t){return this.style=Fo(t,this.style),this.writePalette(),this.style}setArrows(t){this.arrows?.buffer.destroy(),this.arrows=t?.count?{buffer:this.buffer(new Uint8Array(t.data),GPUBufferUsage.STORAGE,"analytic-arrows"),count:t.count}:null,this.arrows&&(this.arrows.bindGroup=this.device.createBindGroup({layout:this.arrowLayout,entries:[{binding:0,resource:{buffer:this.renderer.globalBuffer}},{binding:1,resource:{buffer:this.arrows.buffer}},{binding:2,resource:{buffer:this.layerOffsets}},{binding:3,resource:{buffer:this.palette}},{binding:4,resource:{buffer:this.drawnLayersBuffer}}]})),this.renderer.invalidate?.()}encodeArrows(t){return this.arrows?(this.device.queue.writeBuffer(this.drawnLayersBuffer,0,this.drawnLayers),t.setPipeline(this.arrowPipeline),t.setBindGroup(0,this.arrows.bindGroup),t.draw(9,2*this.arrows.count),1):0}makeBarrelPipelines(){let t=GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT;this.barrelLayout=this.device.createBindGroupLayout({label:"analytic-barrels",entries:[{binding:0,visibility:t,buffer:{type:"uniform"}},{binding:1,visibility:t,buffer:{type:"uniform"}},{binding:2,visibility:t,buffer:{type:"read-only-storage"}},{binding:3,visibility:GPUShaderStage.FRAGMENT,buffer:{type:"read-only-storage"}},{binding:4,visibility:t,buffer:{type:"read-only-storage"}},{binding:5,visibility:GPUShaderStage.FRAGMENT,buffer:{type:"read-only-storage"}},{binding:6,visibility:GPUShaderStage.FRAGMENT,buffer:{type:"read-only-storage"}},{binding:7,visibility:GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}}]});let r=this.device.createShaderModule({label:"analytic-barrels",code:Wd}),a=this.device.createPipelineLayout({bindGroupLayouts:[this.barrelLayout]}),s=(o,c)=>this.device.createRenderPipeline({label:`analytic-barrel${c?"-pick":""}`,layout:a,vertex:{module:r,entryPoint:"vs_barrel"},fragment:{module:r,entryPoint:c?"fs_barrel_pick":"fs_barrel",targets:[{format:o}]},primitive:{topology:"triangle-list",cullMode:"back"},depthStencil:{format:this.renderer.depthFormat,depthWriteEnabled:!0,depthCompare:"greater"},multisample:{count:c?1:this.samples}});this.barrelPipelines={color:s(this.renderer.format,!1),pick:s("rg32uint",!0)},this.barrelView=this.device.createBuffer({label:"analytic-barrel-view",size:Qi,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),this.layerOffsets=this.device.createBuffer({label:"analytic-layer-offsets",size:256*4,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),this.viewScratch=new ArrayBuffer(Qi),this.barrels=null;let n=this.device.createShaderModule({label:"analytic-walls",code:Xd}),i=o=>this.device.createRenderPipeline({label:`analytic-wall${o?"-blend":""}`,layout:a,vertex:{module:n,entryPoint:"vs_wall"},fragment:{module:n,entryPoint:"fs_wall",targets:[{format:this.renderer.format,...o?{blend:$o}:{}}]},primitive:{topology:"triangle-list",cullMode:"none"},depthStencil:{format:this.renderer.depthFormat,depthWriteEnabled:!0,depthCompare:"greater"},multisample:{count:this.samples}});this.wallPipelines={opaque:i(!1),blend:i(!0)},this.walls=null}setWalls({data:t,count:r}){this.walls?.buffer.destroy(),this.walls=r?{buffer:this.buffer(new Uint8Array(t),GPUBufferUsage.STORAGE,"analytic-walls"),count:r,bindGroup:null}:null,this.walls&&(this.walls.bindGroup=this.wallBindGroup()),this.renderer.invalidate?.()}wallBindGroup(){return this.device.createBindGroup({layout:this.barrelLayout,entries:[{binding:0,resource:{buffer:this.renderer.globalBuffer}},{binding:1,resource:{buffer:this.barrelView}},{binding:2,resource:{buffer:this.walls.buffer}},{binding:3,resource:{buffer:this.valuesBuffer}},{binding:4,resource:{buffer:this.layerOffsets}},{binding:5,resource:{buffer:this.netsBuffer}},{binding:6,resource:{buffer:this.renderer.netMaskBuffer}},{binding:7,resource:{buffer:this.palette}}]})}encodeWalls(t,r){return this.walls?(t.setPipeline(r?this.wallPipelines.blend:this.wallPipelines.opaque),t.setBindGroup(0,this.walls.bindGroup),t.draw(6,this.walls.count),1):0}writeView(t,r,a={}){let s=new Float32Array(256);r&&s.set(r.subarray?r.subarray(0,256):r.slice(0,256)),this.device.queue.writeBuffer(this.layerOffsets,0,s);let n=new Float32Array(this.viewScratch),i=new Uint32Array(this.viewScratch);n.fill(0),this.eye=F1(t),this.viewMatrix=t,n.set(this.eye,0),n.set(this.renderer.barrelColor||[.55,.35,.16,1],4);let o=this.laminateColor()||this.boardLooks().substrate?.color||[.3,.32,.25,1],c=(a.boardOpacity??1)*(.15+.85*(a.assemblyOpacity??1));n.set([...o.slice(0,3),c],8);let l=this.overlay.mode===1||this.overlay.mode===2&&this.valuesBuffer!==this.emptyValues;i[12]=l?1:0,i[13]=a.isolateNet?1:0,i[14]=this.boardShown(a)?1:0,i[15]=this.boardShown(a)&&(a.boardOpacity??1)>=.999&&this.renderer.innerCopperMode!=="all"?1:0,n.set(this.overlay.range,16),n.set(this.edgePlated?[...(this.renderer.barrelColor||[.55,.35,.16]).slice(0,3),c]:[...o.slice(0,3),c],20),n.set([...(this.boardLooks().soldermask?.color||[.06,.16,.11]).slice(0,3),1],24),this.device.queue.writeBuffer(this.barrelView,0,this.viewScratch)}setBarrels({data:t,count:r,skipped:a=0}){this.barrels?.buffer.destroy(),this.barrels=r?{buffer:this.buffer(new Uint8Array(t),GPUBufferUsage.STORAGE,"analytic-barrels"),count:r,skipped:a,bindGroup:null}:null,this.barrels&&(this.barrels.bindGroup=this.barrelBindGroup()),this.renderer.invalidate?.()}hasBarrels(){return!!this.barrels}barrelBindGroup(){return this.device.createBindGroup({layout:this.barrelLayout,entries:[{binding:0,resource:{buffer:this.renderer.globalBuffer}},{binding:1,resource:{buffer:this.barrelView}},{binding:2,resource:{buffer:this.barrels.buffer}},{binding:3,resource:{buffer:this.valuesBuffer}},{binding:4,resource:{buffer:this.layerOffsets}},{binding:5,resource:{buffer:this.netsBuffer}},{binding:6,resource:{buffer:this.renderer.netMaskBuffer}},{binding:7,resource:{buffer:this.palette}}]})}encodeBarrels(t,r,a,s=!1){return this.barrels?(a&&this.writeView(a,r,this.context),t.setPipeline(s?this.barrelPipelines.pick:this.barrelPipelines.color),t.setBindGroup(0,this.barrels.bindGroup),t.draw(36,this.barrels.count),1):0}buffer(t,r,a){let s=Math.max(16,Math.ceil(t.byteLength/4)*4),n=this.device.createBuffer({label:a,size:s,usage:r|GPUBufferUsage.COPY_DST});return t.byteLength&&this.device.queue.writeBuffer(n,0,t),n}fieldTexture(t,r,a){let s=this.device.createTexture({label:"analytic-field",size:[t,r],format:"r32float",usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST});return this.device.queue.writeTexture({texture:s},a,{bytesPerRow:t*4},[t,r]),s}makePipelines(t,r){return Xo(Kh(this.renderer),t,r,a=>this.device.createRenderPipeline(a))}static prewarm(t){let r=Yo(t),a=Jo(t.device),s=a.get(r);if(s)return s.promise;let n=Kh(t),i=l=>t.device.createRenderPipelineAsync(l),o=async l=>Object.fromEntries(await Promise.all(Object.entries(l).map(async([f,d])=>[f,await d]))),c={ready:null,promise:null};return c.promise=Promise.all([o(Xo(n,t.format,!1,i)),o(Xo(n,"rg32uint",!0,i))]).then(([l,f])=>(c.ready={color:l,pick:f},c.ready)).catch(()=>(a.delete(r),null)),a.set(r,c),c.promise}setSlices(t){this.releaseSlices();let r=new Map;this.slices=t.map(o=>this.uploadSlice(o,r)),this.makeTwins();let a=t.map(o=>o.z),s=t.flatMap(o=>[o.bounds[0],o.bounds[2]]),n=t.flatMap(o=>[o.bounds[1],o.bounds[3]]);this.extent=t.length?[[Math.min(...s)/1e3,-Math.max(...n)/1e3,Math.min(...a)],[Math.max(...s)/1e3,-Math.min(...n)/1e3,Math.max(...a)]]:null;let i=t.filter(o=>o.skin);this.skin=i.length===2?{top:Math.max(...i.map(o=>o.z)),bottom:Math.min(...i.map(o=>o.z))}:null,this.renderer.invalidate?.()}makeTwins(){this.twinBuffers?.forEach(r=>r.destroy()),this.twinBuffers=[];let t=(r,a)=>{let s={...r,...a,uniform:this.device.createBuffer({label:`analytic-twin-${r.key}`,size:256,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),field:null};return s.bindGroup=this.bindGroup(s),s};this.twins=new Map;for(let r of this.slices){if(r.zLow===void 0||r.role!=="mask"&&r.role!=="silk")continue;let a={low:t(r,{z:r.zLow})},s=r.role==="mask"&&this.slices.find(n=>n.role==="copper"&&n.mark&&n.faceDown===r.faceDown);if(s){let n=this.uploadOpenings(s,r,r.step),i=r.faceDown?s.zTop:s.zBottom;a.foot=t(s,{role:"footprint",z:r.z,dilate:_1,mark:!1,walls:!1,zTop:Math.max(r.z,i),zBottom:Math.min(r.z,i),...n})}this.twins.set(r,a)}}uploadOpenings(t,r,a=null){let s=a||Bh(t.lowered,r.lowered),n=this.uploadEdges(s,`${t.key}-step`),i=this.buffer(s.shapes,GPUBufferUsage.STORAGE,`analytic-step-shapes-${t.key}`);return this.twinBuffers.push(i,n.edges,n.cuts),{...n,shapes:i}}uploadSlice(t,r=new Map){let{lowered:a}=t,s=GPUBufferUsage.STORAGE;r.has(a)||r.set(a,{shapes:this.buffer(a.shapes,s,`analytic-shapes-${t.key}`),covers:this.buffer(a.covers,s,`analytic-covers-${t.key}`),fans:a.fanVertices.length?this.buffer(a.fanVertices,GPUBufferUsage.VERTEX,`analytic-fans-${t.key}`):null,...this.uploadEdges(a,t.key)});let n={...t,...r.get(a),uniform:this.device.createBuffer({label:`analytic-slice-${t.key}`,size:256,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),shapeCount:a.shapes.length/20,subtractShapes:a.subtractShapes,batches:[],field:null};for(let i=0;i<a.batches.length;i+=5){let[o,c,l,f,d]=a.batches.subarray(i,i+5);n.batches.push({subtract:o===1,firstVertex:c,vertexCount:l,firstCover:f,coverCount:d})}return n.bindGroup=this.bindGroup(n),n}uploadEdges(t,r){let{edgeWords:a,cutWords:s,regionEdges:n,skirtEdges:i}=Ch(t);return{edges:this.buffer(a,GPUBufferUsage.STORAGE,`analytic-edges-${r}`),regionEdges:n,skirtEdges:i,cuts:this.buffer(s,GPUBufferUsage.STORAGE,`analytic-cuts-${r}`)}}bindGroup(t){return this.device.createBindGroup({layout:this.layout,entries:[{binding:0,resource:{buffer:this.renderer.globalBuffer}},{binding:1,resource:{buffer:t.uniform}},{binding:2,resource:{buffer:t.shapes}},{binding:3,resource:{buffer:t.covers}},{binding:4,resource:{buffer:this.valuesBuffer}},{binding:5,resource:(t.field?.texture||this.emptyField).createView()},{binding:6,resource:{buffer:this.netsBuffer}},{binding:7,resource:{buffer:this.renderer.netMaskBuffer}},{binding:8,resource:{buffer:t.edges}},{binding:9,resource:{buffer:t.cuts}},{binding:10,resource:{buffer:this.palette}},{binding:11,resource:(this.boardClip?.texture||this.emptyClip).createView()}]})}setBoardClipMask(t){if(!t)return this.setBoardClip(null),null;let{data:r,width:a,height:s}=t,n=Math.ceil(a/256)*256,i=n===a?r:new Uint8Array(n*s);if(i!==r)for(let c=0;c<s;c+=1)i.set(r.subarray(c*a,(c+1)*a),c*n);let o=this.device.createTexture({label:"analytic-clip",size:[a,s],format:"r8uint",usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST});return this.device.queue.writeTexture({texture:o},i,{bytesPerRow:n},[a,s]),this.setBoardClip({texture:o,originMm:t.originMm,pitchMm:t.pitchMm,width:a,height:s}),this.boardClip}setBoardClip(t){this.boardClip&&this.boardClip!==t&&this.boardClip.texture.destroy(),this.boardClip=t;for(let r of this.slices)r.bindGroup=this.bindGroup(r);this.renderer.invalidate?.()}coversLayer(t){return this.slices.some(r=>r.role!==void 0?r.role==="copper"&&r.layerId===Number(t):r.layerId===Number(t))}coversRole(t){let r={substrate:"dielectric",soldermask:"mask",silkscreen:"silk",paste:"paste"}[t];return!!r&&this.slices.some(a=>a.role===r)}setOperationValues(t,r){this.clearOverlay(),this.valuesBuffer=this.buffer(Wo(t),GPUBufferUsage.STORAGE,"analytic-values"),this.overlay={mode:1,range:r},this.rebind()}setFieldRasters(t,r,a=null){this.clearOverlay(),a&&(this.valuesBuffer=this.buffer(Wo(a),GPUBufferUsage.STORAGE,"analytic-values"));for(let s of this.slices){let n=t.get(s.key);n&&(s.field={...n,texture:this.fieldTexture(n.width,n.height,Wo(n.values))})}this.overlay={mode:2,range:r},this.rebind()}clearOverlay(){this.valuesBuffer!==this.emptyValues&&this.valuesBuffer.destroy(),this.valuesBuffer=this.emptyValues;for(let t of this.slices)t.field?.texture.destroy(),t.field=null;this.overlay={mode:0,range:[0,1]},this.rebind()}setOperationNets(t){this.netsBuffer.destroy(),this.netsBuffer=this.buffer(t.length?t:new Uint32Array(1),GPUBufferUsage.STORAGE,"analytic-nets"),this.rebind()}rebind(){this.boundNetMask=this.renderer.netMaskBuffer;for(let t of this.slices)t.bindGroup=this.bindGroup(t);for(let t of this.twins?.values()||[])for(let r of Object.values(t))r.bindGroup=this.bindGroup(r);this.barrels&&(this.barrels.bindGroup=this.barrelBindGroup()),this.walls&&(this.walls.bindGroup=this.wallBindGroup()),this.renderer.invalidate?.()}writeSlice(t,r,a=null){let s=new Float32Array(this.uniformScratch),n=new Uint32Array(this.uniformScratch);s.fill(0),s.set(a?.color||t.color,0);let[i,o]=t.offsetLayers||[t.layerId,t.layerId];s[4]=t.z+.5*((r?.[i]||0)+(r?.[o]||0));let c=t.role===void 0||t.role==="copper";n[5]=c?this.overlay.mode:0;let f=(this.context||{}).isolateNet||!t.outer&&this.renderer.innerCopperMode==="lit";n[7]=c?2|(f?1:0):0;let d=c?t.field:null;if(n[6]=d?1:0,d){s.set(d.originMm,8);let[b,h]=Array.isArray(d.pitchMm)?d.pitchMm:[d.pitchMm,d.pitchMm];s[10]=b,s[11]=h,n[12]=d.width,n[13]=d.height}if(s.set(this.overlay.range,16),s.set(t.bounds,20),s.set([a?.metallic??0,a?.roughness??.72,t.faceDown??t.bottom?-1:1,c?1:0],24),t.zTop!==void 0){let b=s[4]-t.z;s.set([t.zBottom+b,t.zTop+b],28)}n[30]=t.subtractShapes||0,s[31]=t.dilate||0,this.eye&&s.set(this.eye,32);let p=t.role!=="dielectric"?this.boardClip:null;p&&(s.set(p.originMm,36),s[38]=p.pitchMm,s[39]=p.pitchMm,n[40]=p.width,n[41]=p.height,n[42]=1),this.device.queue.writeBuffer(t.uniform,0,this.uniformScratch)}copperLooks(){let t=new Map;for(let r of this.renderer.entries||[]){let a=Number(r.layerId);if(r.kind!=="copper"||t.has(a))continue;let s=r.color||r.material?.baseColor;t.set(a,{color:s&&s.length<4?[...s,1]:s,metallic:r.material?.metallic||0,roughness:r.material?.roughness??.72})}for(let[r,a]of this.renderer.copperColors||[])t.has(r)||t.set(r,{color:a.length<4?[...a,1]:a,metallic:0,roughness:.72});return t}boardLooks(){let t={};for(let r of this.renderer.entries||[]){if(r.kind!=="board"||t[r.boardRole])continue;let a=r.color||r.material?.baseColor;t[r.boardRole]={color:a&&a.length<4?[...a,1]:a,metallic:r.material?.metallic||0,roughness:r.material?.roughness??.72}}return N1(t,this.renderer.stackupLooks)}laminateColor(){return this.slices.find(t=>t.role==="dielectric"&&t.color)?.color||null}lookFor(t,r,a,s){if(t.role===void 0||t.role==="copper")return r.get(t.layerId);let n=s.boardOpacity??1,i=(c,l)=>{let f=a[c];if(!f)return null;let d=f.color||[1,1,1,1];return{...f,color:[d[0],d[1],d[2],l(Number.isFinite(d[3])?d[3]:1)]}};if(t.role==="dielectric"){let c=n*(.15+.85*(s.assemblyOpacity??1));return t.color?{...a.substrate||{metallic:0,roughness:.72},color:[...t.color.slice(0,3),c]}:i("substrate",()=>c)}let o=s.assemblyOpacity??1;return t.role==="mask"?i("soldermask",c=>Math.min(c,.72)*n*o):t.role==="silk"?i("silkscreen",c=>Math.min(c,.92)*n*o):i("paste",c=>c)}encodeInto(t,r,a,s=!1,n={}){this.context=n,this.renderer.netMaskBuffer!==this.boundNetMask&&this.rebind(),n.matrix&&this.writeView(n.matrix,r,n);let i=s?this.pipelines.pick:this.pipelines.color,o=this.copperLooks(),c=this.boardLooks(),f=this.boardShown(n)&&(n.boardOpacity??1)>=.999,d=0;s||this.drawnLayers.fill(0);for(let p of this.slices){let b=p.role===void 0||p.role==="copper";(b?a&&!a.has(p.layerId):s||p.role!=="dielectric"||!f)||b&&!p.outer&&p.role!==void 0&&this.renderer.innerCopperMode==="none"||p.role==="dielectric"&&!p.skin&&this.renderer.innerCopperMode!=="all"||this.behindBoard(p,n)||(this.encodeSlice(t,i,p,"opaque",r,this.lookFor(p,o,c,n)),!s&&b&&p.face===(p.bottom?"bottom":"top")&&(this.drawnLayers[p.layerId]=1),d+=1)}return f&&!s&&(d+=this.encodeWalls(t,!1)),this.stencil&&t.setStencilReference(1),d}boardShown(t){return(t.showBoard??!0)&&!t.panelLayer}behindBoard(t,r){if(!this.skin||!this.eye||this.renderer.innerCopperMode==="all"||!this.boardShown(r)||(r.boardOpacity??1)<.999)return!1;let[,,a,s]=this.eye,n=s?a>this.skin.top:a<0,i=s?a<this.skin.bottom:a>0;return t.faceDown?n:i}encodeBlended(t,r,a,s={}){if(!this.stencil)return 0;this.context=s;let n=this.copperLooks(),i=this.boardLooks(),o=this.boardShown(s),c=o&&(s.boardOpacity??1)<.999,l=0,f=(h,u)=>{this.behindBoard(h,s)||(this.encodeSlice(t,this.pipelines.color,h,u,r,this.lookFor(h,n,i,s)),l+=1)};for(let h of this.slices)c&&h.role==="dielectric"&&f(h,"blend");c&&(l+=this.encodeWalls(t,!0));let d=o&&(s.assemblyOpacity??1)>.01,p=h=>!R1(s.hiddenBoardLayers,h),b=new Set;for(let h of this.slices){if(h.role!=="mask"||!d||!p(h)||this.behindBoard(h,s))continue;let u=this.twins.get(h);if(!u?.foot){f(h,"mask");continue}let m=this.slices.filter(g=>g.role==="silk"&&g.faceDown===h.faceDown&&p(g)&&!this.behindBoard(g,s));for(let g of m)b.add(g);l+=this.encodeConformal(t,h,u,m,r,g=>this.lookFor(g,n,i,s))}for(let h of this.slices)h.role==="paste"&&p(h)&&!s.hidePaste&&!s.panelLayer&&(!a||a.has(h.offsetLayers?.[0]))&&f(h,"blend");for(let h of this.slices)h.role==="silk"&&d&&p(h)&&!b.has(h)&&f(h,"blend");return t.setStencilReference(1),l}encodeSlice(t,r,a,s,n,i){this.writeSlice(a,n,i),t.setBindGroup(0,a.bindGroup),this.stencil?this.encodeStencilled(t,r,a,s):this.encodeAddsOnly(t,r,a),s==="opaque"&&a.walls&&this.encodeSlabWalls(t,r,a)}wallPixels(t){let r=this.viewMatrix,a=this.renderer.canvas;if(!r||!this.extent||!a)return 1/0;let[s,n]=this.extent,i=[];for(let l of[s[0],n[0]])for(let f of[s[1],n[1]])for(let d of[s[2],n[2]])i.push([l,f,d]);this.eye?.[3]&&i.push(this.eye.slice(0,3).map((l,f)=>Math.min(n[f],Math.max(s[f],l/this.eye[3]))));let o=([l,f,d])=>{let p=[0,1,2,3].map(b=>r[b]*l+r[4+b]*f+r[8+b]*d+r[12+b]);return p[3]>1e-9?[p[0]/p[3],p[1]/p[3]]:null},c=0;for(let l of i){let f=o(l),d=o([l[0],l[1],l[2]+t]);if(!f||!d)return 1/0;c=Math.max(c,Math.hypot((d[0]-f[0])*a.width/2,(d[1]-f[1])*a.height/2))}return c}encodeSlabWalls(t,r,a){this.stencil&&t.setStencilReference(0),a.regionEdges&&(t.setPipeline(r.regionWall),t.draw(6,a.regionEdges,0,0)),a.skirtEdges&&this.wallPixels(a.zTop-a.zBottom)>=Uh&&(t.setPipeline(r.skirt),t.draw(12,a.skirtEdges,0,a.regionEdges))}encodeAddsOnly(t,r,a){let s=a.shapeCount-a.subtractShapes;s&&(t.setPipeline(r.shapeAdd),t.draw(6,s,0,a.subtractShapes))}encodeStencilled(t,r,a,s="opaque"){let n=(i,o=Ds[i].reference)=>{t.setPipeline(r[i]),t.setStencilReference(o)};this.encodeFill(t,a,n,s),s==="mask"&&(n("tintCovered"),t.draw(6),n("tintPlain"),t.draw(6)),n("clear"),t.draw(6)}encodeFill(t,r,a,s){let n=s==="footprint";r.subtractShapes&&!n&&(a("shapeMask"),t.draw(6,r.subtractShapes,0,0)),n||this.encodeBatches(t,r,!0,a,s);let i=r.shapeCount-r.subtractShapes;i&&(s==="opaque"?a("shapeAdd",r.mark?33:32):a({mask:"shapeLay",blend:"shapeBlend",footprint:"footShape",onFoot:"shapeOnFoot",offFoot:"shapeOffFoot"}[s]),t.draw(6,i,0,r.subtractShapes)),this.encodeBatches(t,r,!1,a,s)}encodeConformal(t,r,{low:a,foot:s},n,i,o){let c=this.pipelines.color,l=b=>Ds[b==="step"||b==="regionStep"?"coat":b],f=(b,h=l(b).reference)=>{t.setPipeline(c[b]),t.setStencilReference(h)},d=(b,h)=>{this.writeSlice(b,i,h),t.setBindGroup(0,b.bindGroup)},p=o(r);d(s,p),this.encodeFill(t,s,f,"footprint"),d(r,p),this.encodeFill(t,r,f,"mask"),f("tintHigh"),t.draw(6),t.setBindGroup(0,s.bindGroup),s.regionEdges&&(f("regionStep"),t.draw(6,s.regionEdges,0,0)),s.skirtEdges&&this.wallPixels(s.zTop-s.zBottom)>=Uh&&(f("step"),t.draw(12,s.skirtEdges,0,s.regionEdges)),t.setBindGroup(0,r.bindGroup),f("clearLay"),t.draw(6),d(a,p),this.encodeFill(t,a,f,"mask"),f("tintLow"),t.draw(6),f("clearLay"),t.draw(6);for(let b of n){let h=o(b);d(b,h),this.encodeFill(t,b,f,"onFoot"),f("clear"),t.draw(6);let u=this.twins.get(b)?.low;u&&(d(u,h),this.encodeFill(t,u,f,"offFoot"),f("clear"),t.draw(6))}return t.setBindGroup(0,r.bindGroup),f("clearFoot"),t.draw(6),t.setStencilReference(1),1+n.length}encodeBatches(t,r,a,s,n="opaque"){let i=r.batches.findLast(o=>!o.subtract);for(let o of r.batches){if(o.subtract!==a||!r.fans)continue;s("fan"),t.setVertexBuffer(0,r.fans),t.draw(o.vertexCount,1,o.firstVertex,0),!a&&n==="opaque"&&(r.mark||r.role==="dielectric")&&(s("coverMark",r.mark?65:64),t.draw(6,o.coverCount,0,o.firstCover));let c={opaque:"coverAdd",blend:"coverBlend",mask:"coverLay",footprint:"footCover",onFoot:"coverOnFoot",offFoot:"coverOffFoot"}[n];s(a?"coverSubtract":c),t.draw(6,o.coverCount,0,o.firstCover),!a&&(o!==i||n==="footprint")&&(s("coverClear"),t.draw(6,o.coverCount,0,o.firstCover))}}gpuMemoryBytes(){let t=this.valuesBuffer===this.emptyValues?0:this.valuesBuffer.size;this.barrels&&(t+=this.barrels.count*Hd),this.walls&&(t+=this.walls.count*qd);let r=new Set;for(let a of this.slices){for(let s of[a.shapes,a.covers,a.fans,a.uniform,a.edges,a.cuts])s&&r.add(s);a.field&&(t+=a.field.width*a.field.height*4)}for(let a of r)t+=a.size;return t}stats(){return{slices:this.slices.map(t=>({key:t.key,role:t.role||"copper",face:t.face,layerId:t.layerId,z:t.z,shapes:t.shapeCount,subtractShapes:t.subtractShapes,regionBatches:t.batches.length,fanVertices:t.lowered.fanVertices.length/2,covers:t.lowered.covers.length/6,approximations:t.lowered.stats})),overlay:this.overlay.mode,barrels:this.barrels?{count:this.barrels.count,skipped:this.barrels.skipped}:null,walls:this.walls?.count||0,gpuMemoryBytes:this.gpuMemoryBytes(),degraded:!this.stencil}}releaseSlices(){for(let r of this.twins?.values()||[])for(let a of Object.values(r))a.uniform.destroy();this.twinBuffers?.forEach(r=>r.destroy()),this.twinBuffers=[],this.twins=new Map;let t=new Set;for(let r of this.slices){for(let a of[r.shapes,r.covers,r.fans,r.uniform,r.edges,r.cuts])a&&t.add(a);r.field?.texture.destroy()}for(let r of t)r.destroy();this.slices=[]}destroy(){this.releaseSlices(),this.barrels?.buffer.destroy(),this.walls?.buffer.destroy(),this.arrows?.buffer.destroy(),this.drawnLayersBuffer.destroy(),this.palette.destroy(),this.netsBuffer.destroy(),this.barrelView.destroy(),this.layerOffsets.destroy(),this.valuesBuffer!==this.emptyValues&&this.valuesBuffer.destroy(),this.emptyValues.destroy(),this.emptyField.destroy(),this.boardClip?.texture.destroy(),this.emptyClip.destroy()}};function F1(e){let t=P1(Array.from(e,Number));if(!t)return[0,0,-1,0];let r=l=>[0,1,2,3].map(f=>t[f]*l[0]+t[4+f]*l[1]+t[8+f]*l[2]+t[12+f]*l[3]),a=r([0,0,1,0]),s=Math.hypot(a[0],a[1],a[2]);if(Math.abs(a[3])>1e-9*Math.max(s,1e-30))return[a[0]/a[3],a[1]/a[3],a[2]/a[3],1];let n=r([0,0,1,1]),i=r([0,0,0,1]),o=[0,1,2].map(l=>i[l]/i[3]-n[l]/n[3]),c=Math.hypot(...o)||1;return[...o.map(l=>l/c),0]}function P1(e){let t=new Array(16);t[0]=e[5]*e[10]*e[15]-e[5]*e[11]*e[14]-e[9]*e[6]*e[15]+e[9]*e[7]*e[14]+e[13]*e[6]*e[11]-e[13]*e[7]*e[10],t[4]=-e[4]*e[10]*e[15]+e[4]*e[11]*e[14]+e[8]*e[6]*e[15]-e[8]*e[7]*e[14]-e[12]*e[6]*e[11]+e[12]*e[7]*e[10],t[8]=e[4]*e[9]*e[15]-e[4]*e[11]*e[13]-e[8]*e[5]*e[15]+e[8]*e[7]*e[13]+e[12]*e[5]*e[11]-e[12]*e[7]*e[9],t[12]=-e[4]*e[9]*e[14]+e[4]*e[10]*e[13]+e[8]*e[5]*e[14]-e[8]*e[6]*e[13]-e[12]*e[5]*e[10]+e[12]*e[6]*e[9],t[1]=-e[1]*e[10]*e[15]+e[1]*e[11]*e[14]+e[9]*e[2]*e[15]-e[9]*e[3]*e[14]-e[13]*e[2]*e[11]+e[13]*e[3]*e[10],t[5]=e[0]*e[10]*e[15]-e[0]*e[11]*e[14]-e[8]*e[2]*e[15]+e[8]*e[3]*e[14]+e[12]*e[2]*e[11]-e[12]*e[3]*e[10],t[9]=-e[0]*e[9]*e[15]+e[0]*e[11]*e[13]+e[8]*e[1]*e[15]-e[8]*e[3]*e[13]-e[12]*e[1]*e[11]+e[12]*e[3]*e[9],t[13]=e[0]*e[9]*e[14]-e[0]*e[10]*e[13]-e[8]*e[1]*e[14]+e[8]*e[2]*e[13]+e[12]*e[1]*e[10]-e[12]*e[2]*e[9],t[2]=e[1]*e[6]*e[15]-e[1]*e[7]*e[14]-e[5]*e[2]*e[15]+e[5]*e[3]*e[14]+e[13]*e[2]*e[7]-e[13]*e[3]*e[6],t[6]=-e[0]*e[6]*e[15]+e[0]*e[7]*e[14]+e[4]*e[2]*e[15]-e[4]*e[3]*e[14]-e[12]*e[2]*e[7]+e[12]*e[3]*e[6],t[10]=e[0]*e[5]*e[15]-e[0]*e[7]*e[13]-e[4]*e[1]*e[15]+e[4]*e[3]*e[13]+e[12]*e[1]*e[7]-e[12]*e[3]*e[5],t[14]=-e[0]*e[5]*e[14]+e[0]*e[6]*e[13]+e[4]*e[1]*e[14]-e[4]*e[2]*e[13]-e[12]*e[1]*e[6]+e[12]*e[2]*e[5],t[3]=-e[1]*e[6]*e[11]+e[1]*e[7]*e[10]+e[5]*e[2]*e[11]-e[5]*e[3]*e[10]-e[9]*e[2]*e[7]+e[9]*e[3]*e[6],t[7]=e[0]*e[6]*e[11]-e[0]*e[7]*e[10]-e[4]*e[2]*e[11]+e[4]*e[3]*e[10]+e[8]*e[2]*e[7]-e[8]*e[3]*e[6],t[11]=-e[0]*e[5]*e[11]+e[0]*e[7]*e[9]+e[4]*e[1]*e[11]-e[4]*e[3]*e[9]-e[8]*e[1]*e[7]+e[8]*e[3]*e[5],t[15]=e[0]*e[5]*e[10]-e[0]*e[6]*e[9]-e[4]*e[1]*e[10]+e[4]*e[2]*e[9]+e[8]*e[1]*e[6]-e[8]*e[2]*e[5];let r=e[0]*t[0]+e[1]*t[4]+e[2]*t[8]+e[3]*t[12];return r?t.map(a=>a/r):null}function Hh(e,t=1536){if(!e||e.length<12)return null;let[r,a,s,n]=[1/0,1/0,-1/0,-1/0];for(let b=0;b+3<e.length;b+=4)r=Math.min(r,e[b],e[b+2]),s=Math.max(s,e[b],e[b+2]),a=Math.min(a,e[b+1],e[b+3]),n=Math.max(n,e[b+1],e[b+3]);let i=1;[r,a,s,n]=[r-i,a-i,s+i,n+i];let o=Math.max(Math.max(s-r,n-a)/t,.02),c=Math.max(1,Math.ceil((s-r)/o)),l=Math.max(1,Math.ceil((n-a)/o)),f=new Uint8Array(c*l),d=Array.from({length:l},()=>[]);for(let b=0;b+3<e.length;b+=4){let[h,u,m,g]=[e[b],e[b+1],e[b+2],e[b+3]];if(u===g)continue;let y=Math.max(0,Math.ceil((Math.min(u,g)-a)/o-.5)),x=Math.min(l-1,Math.floor((Math.max(u,g)-a)/o-.5));for(let v=y;v<=x;v+=1)d[v].push(b)}let p=[];for(let b=0;b<l;b+=1){let h=a+(b+.5)*o;p.length=0;for(let u of d[b]){let[m,g,y,x]=[e[u],e[u+1],e[u+2],e[u+3]];g<=h!=x<=h&&p.push(m+(h-g)/(x-g)*(y-m))}p.sort((u,m)=>u-m);for(let u=0;u+1<p.length;u+=2){let m=Math.max(0,Math.ceil((p[u]-r)/o-.5)),g=Math.min(c-1,Math.floor((p[u+1]-r)/o-.5));g>=m&&f.fill(1,b*c+m,b*c+g+1)}}return{data:f,width:c,height:l,originMm:[r,a],pitchMm:o}}function j1(e,t,r=0){let a=new Map((t||[]).map(s=>[Number(s.id),s]));for(let s of e||[]){let n=a.get(Number(s.layerId));if(s.kind!=="copper"||!n||!s.quantMin||!s.quantSize)continue;let i=s.quantSize[2]===1;return s.quantMin[2]+(i?0:s.quantSize[2]/2)-Number(n.z_mm||0)/1e3}return Number(r||0)/1e3}async function Zo({renderer:e,layers:t,colorFor:r,bytes:a,wasm:s,toleranceNm:n,nets:i=[],features:o=[],boardZOffsetMm:c=0,pack:l=null,cache:f=null,pool:d=null,netIds:p=null}){let b={},h=performance.now(),u=U=>{let ie=performance.now();b[U]=Math.round(ie-h),h=ie},m=l||await Pa(a,{wasm:s}),g=m.lowerSlice?m:null,y=async()=>g??=await Pa(a,{wasm:s});u("open");let x=j1(e.entries,t,c),{planned:v,unmatched:E}=ph(m.header,t,x),S=new Map(t.map(U=>[Number(U.id),U])),T=performance.now(),_=[...new Set(v.map(U=>U.key))],I=n??fr,N=new Map,C=f?{cacheKey:f.cacheKey,wasmKey:Lr(),toleranceNm:I}:null;if(C){let U=_.filter(ie=>!N.has(ie));for(let[ie,nt]of await La(f.store,C,U))N.set(ie,nt);b.cached=_.filter(ie=>N.has(ie)).length}let B=_.filter(U=>!N.has(U)),R=Th(m.header),j=B.length?d?await d.lower(B,I,R):await Ih(a,B,I,s??Mn(),{weights:R}):new Map;b.lowerIn=B.length?j?"workers":"main":"none";let q=new Map;for(let U of B){let ie=j?.get(U);q.set(U,ie||(await y()).lowerSlice(U,n)),N.set(U,ie?En(ie):q.get(U))}let Y=v.map(U=>({...U,color:U.role==="copper"?r(S.get(U.layerId)):U.color||[1,1,1,1],lowered:N.get(U.key)})),te=Oh(Y),we=te.map(([U,ie])=>Ho(U,ie)),ne=C?await La(f.store,C,we):new Map,me=te.filter((U,ie)=>!ne.has(we[ie])),Pe=me.length&&d?await d.steps(me.map(([U,ie])=>[ie.lowered,U.lowered])):[],he=new Map;me.forEach(([U,ie],nt)=>{Pe[nt]&&he.set(Ho(U,ie),Pe[nt])}),te.forEach(([U],ie)=>{let nt=he.get(we[ie]);U.step=ne.get(we[ie])||nt&&En(nt)||null}),b.steps=`${ne.size} cached, ${he.size} in workers, ${te.length-ne.size-he.size} here`;let Re=new Map([...q,...he]),je=C&&Re.size?zo(f.store,C,Re):Promise.resolve(),Ve=performance.now()-T;u("lower"),await br.prewarm(e);let ye=new br(e);ye.setSlices(Y),u("slices");let Er=Y.find(U=>U.role==="dielectric"&&U.lowered?.contourEdges?.length)?.lowered.contourEdges,Sr=Hh(Er),A=await m.barrels();ye.setBarrels(mh(m.header,A,Y,Er)),ye.setBoardClipMask(Sr),u("barrels");let P=new Set;for(let U=0;U<A.words.length;U+=vn)P.add(A.words[U]);ye.edgePlated=!!m.header.stack?.edge_plating,ye.setWalls(yh(Y,N,t,x)),u("walls");let D=p?null:await m.netIndices?.(),Q=p||xh(D?{header:m.header,netIndices:()=>D}:m,i);if(ye.setOperationNets(Q),u("nets"),C){let U=D?zo(f.store,C,new Map([[ja,vh(m.header,A,D)]])):Promise.resolve();Sh(f.store,C,Promise.all([je,U]))}let fe=new Map;for(let U of o||[])U?.sourceUid&&(fe.has(U.sourceUid)||fe.set(U.sourceUid,[]),fe.get(U.sourceUid).push(U));return u("features"),g&&g!==m&&g.free(),{pack:m,analytic:ye,unmatched:E,lowerMs:Ve,timings:b,zOffset:x,operations:Dr(m.header),overlay:null,netIds:Q,featuresBySource:fe,barrelOperations:P,lowered:N}}async function ec(e,t){let r=(await e.pack.binding(t))?.source_uid,a=r?e.featuresBySource?.get(r)||[]:[],s=e.netIds?.[t]||0,n=a.find(i=>Number(i.netId)===s)||a[0];return n?Number(n.id):0}function Xh(e,t){if(!t)return e.analytic.clearOverlay(),e.overlay=null,null;if(t.kind==="operation_values"){let r=Go(t.values,e.operations),a=t.range||Ur(r);e.analytic.setOperationValues(r,a),e.overlay={...t,values:r,range:a}}else if(t.kind==="field_tiles"){let r=gh(t.tiles),a=t.range||Ur([...r.values()].flatMap(s=>[...Ur(s.values)]));e.analytic.setFieldRasters(r,a),e.overlay={...t,range:a,slices:[...r.keys()]}}else if(t.kind==="field_grid"){let r=kn(t.grid),a=t.range||Ur([...r.values()].flatMap(n=>[...Ur(n.values)])),s=t.values?Go(t.values,e.operations):null;e.analytic.setFieldRasters(r,a,s),e.overlay={kind:t.kind,quantity:t.quantity,units:t.units,range:a,slices:[...r.keys()],barrels:s,net:t.grid?.net??null}}else throw new TypeError(`unknown analytic overlay kind ${t.kind}`);return{kind:t.kind,range:e.overlay.range}}function Qo(e,t,r=!1){let[a,s]=Array.isArray(e.pitchMm)?e.pitchMm:[e.pitchMm,e.pitchMm],n=(t[0]-e.originMm[0])/a-.5,i=(t[1]-e.originMm[1])/s-.5,o=(m,g)=>m<0||g<0||m>=e.width||g>=e.height?NaN:e.values[g*e.width+m],[c,l]=[Math.floor(n),Math.floor(i)],[f,d]=[n-c,i-l],p=o(c,l),b=o(c+1,l),h=o(c,l+1),u=o(c+1,l+1);return[p,b,h,u].every(Number.isFinite)?(p*(1-f)+b*f)*(1-d)+(h*(1-f)+u*f)*d:r?NaN:o(Math.floor(n+.5),Math.floor(i+.5))}function L1(e,t,r){let[a,s]=Array.isArray(e.pitchMm)?e.pitchMm:[e.pitchMm,e.pitchMm],n=(t[0]-e.originMm[0])/a-.5,i=(t[1]-e.originMm[1])/s-.5,o=NaN,c=1/0;for(let l=Math.floor(i)-r+1;l<=Math.floor(i)+r;l+=1)for(let f=Math.floor(n)-r+1;f<=Math.floor(n)+r;f+=1){if(f<0||l<0||f>=e.width||l>=e.height)continue;let d=e.values[l*e.width+f],p=(f-n)**2+(l-i)**2;Number.isFinite(d)&&p<c&&([o,c]=[d,p])}return o}function $h(e){let t=new Map;for(let r of e.analytic.slices){if(!r.field||!(r.role===void 0||r.role==="copper"))continue;let a=t.get(r.layerId);(!a||r.z>a.z)&&t.set(r.layerId,r)}return[...t.values()].map(r=>({slice:r,key:r.key,layerId:r.layerId,cells:r.field.values.reduce((a,s)=>a+(Number.isFinite(s)?1:0),0)}))}function Yh(e,t){if(!t)return 0;let r=(e||[]).find(a=>a?.name===t)||(e||[]).find(a=>(a?.aliases||[]).includes(t));return r&&Number(r.id)||0}var qh=48,D1=70,Wh=2e-6,U1=.95;function G1(e,t,r,{spacingMm:a=null,floor:s=.001,density:n=D1,width:i=.07,minLength:o=.3}={}){let c=e.filter(x=>x.role==="copper"&&t.has(x.key)&&r.has(x.key)&&x.face===(x.bottom?"bottom":"top"));if(!c.length)return{data:new ArrayBuffer(0),count:0,spacingMm:0,max:0,reference:0};let l=c.reduce((x,v)=>[Math.min(x[0],v.bounds[0]),Math.min(x[1],v.bounds[1]),Math.max(x[2],v.bounds[2]),Math.max(x[3],v.bounds[3])],[1/0,1/0,-1/0,-1/0]),f=a||Math.max(l[2]-l[0],l[3]-l[1])/n,d=[];for(let x of c){let[v,E]=[t.get(x.key),r.get(x.key)],[S,T,_,I]=x.bounds;for(let N=l[0]+Math.ceil((S-l[0])/f)*f+f/2;N<=_;N+=f)for(let C=l[1]+Math.ceil((T-l[1])/f)*f+f/2;C<=I;C+=f){let B=Qo(v,[N,C],!0),R=Qo(E,[N,C],!0),j=Math.hypot(B,R);j>0&&d.push({face:x,x:N,y:C,jx:B,jy:R,size:j})}}let p=d.map(x=>x.size).sort((x,v)=>x-v),b=p.length?p[p.length-1]:0,h=p.length?p[Math.min(p.length-1,Math.floor(U1*p.length))]:0,u=d.filter(x=>x.size>=s*h),m=new ArrayBuffer(u.length*qh),g=new Float32Array(m),y=new Uint32Array(m);return u.forEach((x,v)=>{let E=v*(qh/4),[S,T]=x.face.offsetLayers||[x.face.layerId,x.face.layerId],_=x.face.bottom?-Wh:Wh,I=Math.min(1,x.size/h),N=.9*f*(o+(1-o)*Math.sqrt(I))/1e3;g.set([x.x/1e3,-x.y/1e3,x.face.z+_,i*f/1e3,x.jx/x.size,-x.jy/x.size,N,I],E),y.set([S,T,0,0],E+8)}),{data:m,count:u.length,spacingMm:f,max:b,reference:h}}function tc(e,t){if(!t)return e.analytic.setArrows(null),e.vectors=null,e.vectorInput=null,null;let r=e.analytic.style,a=G1(e.analytic.slices,kn(t.x),kn(t.y),{density:r.arrowDensity,width:r.arrowWidth,minLength:r.arrowMinLength});return e.analytic.setArrows(a),e.vectorInput=t,e.vectors={quantity:t.quantity,units:t.units,max:a.max,reference:a.reference,spacingMm:a.spacingMm},{count:a.count,max:a.max,reference:a.reference,spacingMm:a.spacingMm}}function Jh(e,t){let r=e.analytic.style,a=e.analytic.setStyle(t);return["arrowDensity","arrowWidth","arrowMinLength"].some(n=>r[n]!==a[n])&&e.vectorInput&&tc(e,e.vectorInput),a}function Qh(e,t){for(let r of e?.chunks||[]){let a=Number(r.first_operation_index);if(t>=a&&t<a+Number(r.operation_count||0))return r.slice_key}return null}function An(e,t,r,a=null,s=null,n=0){let i=null;for(let o of e.analytic.slices){if(!o.field||Math.abs(t.direction[2])<1e-12||a&&o.key!==a||s&&!s.has(Number(o.layerId)))continue;let[c,l]=o.offsetLayers||[o.layerId,o.layerId],f=o.z+.5*((r?.[c]||0)+(r?.[l]||0)),d=(f-t.origin[2])/t.direction[2];if(!a&&!(d>0)||i&&d>=i.t)continue;let p=[t.origin[0]+d*t.direction[0],t.origin[1]+d*t.direction[1],f],b=[p[0]*1e3,-p[1]*1e3],h=Qo(o.field,b);!Number.isFinite(h)&&n>0&&(h=L1(o.field,b,n)),Number.isFinite(h)&&(i={t:d,value:h,sliceKey:o.key,boardMm:b,world:p})}return i&&{value:i.value,sliceKey:i.sliceKey,boardMm:i.boardMm,world:i.world}}async function rc(e,t,r=null){let a=e.overlay,s=a?.kind==="operation_values"?a.values[t]:a?.barrels?.[t],n=a?.kind!=="operation_values"&&Number.isFinite(s)&&(!e.barrelOperations||e.barrelOperations.has(t)),i=a?.kind==="operation_values"||n?s:r?.value;return n&&(r={...r,sliceKey:"via barrel"}),{operationIndex:t,featureId:await ec(e,t)||null,binding:await e.pack.binding(t),...Number.isFinite(i)?{value:i,quantity:a.quantity,units:a.units}:{},...r?{sliceKey:r.sliceKey,boardMm:r.boardMm,world:r.world}:{}}}var z1=2048,K1=.22,Zh=2,eb=1024,tb=160;function V1(e,t,r){let a=Float32Array.from(e,o=>Number.isFinite(o)?o:NaN),s=new Int32Array(t*r),n=0,i=0;for(let o=0;o<a.length;o+=1)Number.isFinite(a[o])&&(s[i++]=o);for(;n<i;){let o=s[n++],c=o%t,l=(o-c)/t;for(let[f,d]of[[c-1,l],[c+1,l],[c,l-1],[c,l+1]]){if(f<0||d<0||f>=t||d>=r)continue;let p=d*t+f;Number.isFinite(a[p])||(a[p]=a[o],s[i++]=p)}}return a}function H1(e,t,r){let[a,s,n,i]=e,o=(n-a)/1e3,c=(i-s)/1e3,l=(a+n)/2e3,f=-(s+i)/2e3,d=r-t||1;return new Float32Array([2/o,0,0,0,0,2/c,0,0,0,0,1/d,0,-2*l/o,-2*f/c,-t/d,1])}function q1(e,t=z1){let r=e[2]-e[0],a=e[3]-e[1],s=t/Math.max(r,a,1e-9);return[Math.max(1,Math.round(r*s)),Math.max(1,Math.round(a*s))]}var W1=`
const PICK_TAG = ${2147483648}u;
struct Chosen { net: u32, pad0: u32, pad1: u32, pad2: u32 };
@group(0) @binding(0) var picked: texture_2d<u32>;
@group(0) @binding(1) var<storage, read> nets: array<u32>;
@group(0) @binding(2) var<uniform> chosen: Chosen;

@vertex fn vs_full(@builtin(vertex_index) vertex: u32) -> @builtin(position) vec4f {
  let p = vec2f(f32((vertex << 1u) & 2u), f32(vertex & 2u));
  return vec4f(p * 2.0 - 1.0, 0.0, 1.0);
}

@fragment fn fs_net(@builtin(position) position: vec4f) -> @location(0) vec4f {
  let hit = textureLoad(picked, vec2u(position.xy), 0);
  if ((hit.x & PICK_TAG) == 0u || hit.y == 0u) { return vec4f(0.0); }
  let operation = hit.y - 1u;
  if (chosen.net != 0u) {
    let net = select(0u, nets[operation], operation < arrayLength(&nets));
    if (net != chosen.net) { return vec4f(0.0); }
  }
  return vec4f(1.0);
}
`,X1=`
struct Relief {
  viewProjection: mat4x4f,
  // Board millimetres the grid and the mask span: x0, y0, x1, y1.
  bounds: vec4f,
  // The raster: origin (mm), pitch (mm).
  fieldOrigin: vec2f,
  fieldPitch: vec2f,
  fieldSize: vec2u,
  grid: vec2u,
  // Value range, base height (m), full height (m).
  range: vec2f,
  base: f32,
  height: f32,
  light: vec4f,
};
@group(0) @binding(0) var<uniform> relief: Relief;
@group(0) @binding(1) var field: texture_2d<f32>;
@group(0) @binding(2) var mask: texture_2d<f32>;
@group(0) @binding(3) var maskSampler: sampler;

const ABSENT = 3e38;
fn present(value: f32) -> bool { return value < 1e38; }

PALETTE

fn cell(i: i32, j: i32) -> f32 {
  let size = vec2i(relief.fieldSize);
  if (i < 0 || j < 0 || i >= size.x || j >= size.y) { return ABSENT; }
  return textureLoad(field, vec2i(i, j), 0).r;
}

// The raster at a board point (mm): bilinear where all four cells hold a
// value, else the nearest that does, else absent.
fn sampleField(board: vec2f) -> f32 {
  let uv = (board - relief.fieldOrigin) / relief.fieldPitch - vec2f(0.5);
  let base = vec2i(floor(uv));
  let f = uv - floor(uv);
  let s00 = cell(base.x, base.y);
  let s10 = cell(base.x + 1, base.y);
  let s01 = cell(base.x, base.y + 1);
  let s11 = cell(base.x + 1, base.y + 1);
  if (present(s00) && present(s10) && present(s01) && present(s11)) {
    return mix(mix(s00, s10, f.x), mix(s01, s11, f.x), f.y);
  }
  let nearest = vec2i(floor(uv + vec2f(0.5)));
  return cell(nearest.x, nearest.y);
}

fn share(value: f32) -> f32 {
  return clamp((value - relief.range.x) / max(relief.range.y - relief.range.x, 1e-30), 0.0, 1.0);
}

fn lift(board: vec2f) -> f32 {
  let value = sampleField(board);
  return relief.base + select(0.0, share(value) * relief.height, present(value));
}

struct ReliefOut {
  @builtin(position) position: vec4f,
  @location(0) board: vec2f,
  @location(1) normal: vec3f,
};

@vertex fn vs_relief(@builtin(vertex_index) vertex: u32) -> ReliefOut {
  var corners = array<vec2u, 6>(vec2u(0u, 0u), vec2u(1u, 0u), vec2u(0u, 1u), vec2u(0u, 1u), vec2u(1u, 0u), vec2u(1u, 1u));
  let quad = vertex / 6u;
  let cells = relief.grid - vec2u(1u);
  let at = vec2u(quad % cells.x, quad / cells.x) + corners[vertex % 6u];
  let t = vec2f(at) / vec2f(cells);
  let board = mix(relief.bounds.xy, relief.bounds.zw, t);
  let z = lift(board);
  // The slope from neighbouring grid points (world metres; board y runs down).
  let step = (relief.bounds.zw - relief.bounds.xy) / vec2f(cells);
  let dx = (lift(board + vec2f(step.x, 0.0)) - lift(board - vec2f(step.x, 0.0))) / (0.002 * step.x);
  let dy = (lift(board + vec2f(0.0, step.y)) - lift(board - vec2f(0.0, step.y))) / (0.002 * step.y);
  var out: ReliefOut;
  out.position = relief.viewProjection * vec4f(board.x * 0.001, -board.y * 0.001, z, 1.0);
  out.board = board;
  out.normal = normalize(vec3f(-dx, dy, 1.0));
  return out;
}

@fragment fn fs_relief(input: ReliefOut) -> @location(0) vec4f {
  let uv = (input.board - relief.bounds.xy) / (relief.bounds.zw - relief.bounds.xy);
  if (textureSampleLevel(mask, maskSampler, uv, 0.0).r < 0.5) { discard; }
  let value = sampleField(input.board);
  if (!present(value)) { discard; }
  let normal = normalize(input.normal);
  let diffuse = max(dot(normal, normalize(relief.light.xyz)), 0.0);
  let color = fieldColor(share(value)) * (0.72 + 0.38 * diffuse);
  return vec4f(min(color, vec3f(1.0)), 1.0);
}
`,$1=`
struct Palette {
  ramps: array<vec4f, 512>,
  outline: vec4f,
};
@group(0) @binding(4) var<uniform> palette: Palette;
fn ramp(t: f32, which: u32) -> vec3f {
  let x = clamp(t, 0.0, 1.0) * 255.0;
  let i = u32(floor(x));
  let j = min(i + 1u, 255u);
  return mix(palette.ramps[which * 256u + i].rgb, palette.ramps[which * 256u + j].rgb, x - floor(x));
}
fn fieldColor(t: f32) -> vec3f {
  return ramp(t, 0u);
}
`,_n=class{constructor(t){this.analytic=t,this.renderer=t.renderer,this.device=t.device,this.uniform=this.device.createBuffer({label:"relief",size:tb,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),this.scratch=new ArrayBuffer(tb),this.sampler=this.device.createSampler({magFilter:"linear",minFilter:"linear"}),this.layer=null,this.vertexCount=0}get ready(){return this.vertexCount>0}pipeline(){if(this.reliefPipeline)return this.reliefPipeline;let t=this.device.createShaderModule({label:"relief",code:X1.replace("PALETTE",$1)});return this.reliefPipeline=this.device.createRenderPipeline({label:"relief",layout:"auto",vertex:{module:t,entryPoint:"vs_relief"},fragment:{module:t,entryPoint:"fs_relief",targets:[{format:this.renderer.format}]},primitive:{topology:"triangle-list",cullMode:"none"},depthStencil:{format:this.renderer.depthFormat,depthWriteEnabled:!0,depthCompare:"greater"},multisample:{count:this.renderer.sampleCount||1}}),this.reliefPipeline}netPipeline(){if(this.netMaskPipeline)return this.netMaskPipeline;let t=this.device.createShaderModule({label:"relief-net-mask",code:W1});return this.netMaskPipeline=this.device.createRenderPipeline({label:"relief-net-mask",layout:"auto",vertex:{module:t,entryPoint:"vs_full"},fragment:{module:t,entryPoint:"fs_net",targets:[{format:"r8unorm"}]},primitive:{topology:"triangle-list"}}),this.netMaskPipeline}build(t,{range:r,netId:a=0,heightShare:s=K1}={}){this.release();let n=t?.field;if(!n)return!1;let i=this.boundsOf(t),[o,c]=q1(i),l=this.renderMask(t.layerId,i,o,c);this.mask=this.filterMask(l,o,c,a),l.destroy();let f=V1(n.values,n.width,n.height),d=Float32Array.from(f,m=>Number.isFinite(m)?m:3e38);this.field=this.device.createTexture({label:"relief-field",size:[n.width,n.height],format:"r32float",usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST}),this.device.queue.writeTexture({texture:this.field},d,{bytesPerRow:n.width*4},[n.width,n.height]);let[p,b]=Array.isArray(n.pitchMm)?n.pitchMm:[n.pitchMm,n.pitchMm],h=Math.max(i[2]-i[0],i[3]-i[1])/1e3,u=[Math.min(eb,Math.max(2,Math.ceil((i[2]-i[0])/p*Zh)+1)),Math.min(eb,Math.max(2,Math.ceil((i[3]-i[1])/b*Zh)+1))];return this.layer=t.layerId,this.sliceKey=t.key,this.boundsMm=i,this.base=t.z,this.height=h*s,this.grid=u,this.vertexCount=(u[0]-1)*(u[1]-1)*6,this.params={field:n,pitch:[p,b],range:r||[0,1]},this.bindGroup=this.device.createBindGroup({layout:this.pipeline().getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:this.uniform}},{binding:1,resource:this.field.createView()},{binding:2,resource:this.mask.createView()},{binding:3,resource:this.sampler},{binding:4,resource:{buffer:this.analytic.palette}}]}),this.renderer.invalidate?.(),!0}boundsOf(t){let r=this.analytic.slices.filter(n=>n.layerId===t.layerId&&(n.role===void 0||n.role==="copper")),a=(r.length?r:[t]).map(n=>n.bounds),s=.05;return[Math.min(...a.map(n=>n[0]))-s,Math.min(...a.map(n=>n[1]))-s,Math.max(...a.map(n=>n[2]))+s,Math.max(...a.map(n=>n[3]))+s]}renderMask(t,r,a,s){let{analytic:n,renderer:i,device:o}=this,c=n.extent,l=(c?.[0][2]??-.01)-.001,f=(c?.[1][2]??.01)+.001,d=H1(r,l,f),p=o.createTexture({label:"relief-pick",size:[a,s],format:"rg32uint",usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.TEXTURE_BINDING}),b=o.createTexture({label:"relief-pick-depth",size:[a,s],format:i.depthFormat,usage:GPUTextureUsage.RENDER_ATTACHMENT}),h={view:b.createView(),depthClearValue:0,depthLoadOp:"clear",depthStoreOp:"discard"};i.stencil&&Object.assign(h,{stencilClearValue:0,stencilLoadOp:"clear",stencilStoreOp:"discard"});let u=o.createCommandEncoder(),m=u.beginRenderPass({colorAttachments:[{view:p.createView(),clearValue:{r:0,g:0,b:0,a:0},loadOp:"clear",storeOp:"store"}],depthStencilAttachment:h}),g=i.innerCopperMode;i.innerCopperMode="all";try{i.writeGlobals(d,0,0,0,0),i.stencil&&m.setStencilReference(1),n.encodeInto(m,null,new Set([t]),!0,{matrix:d,showBoard:!1})}finally{i.innerCopperMode=g}return m.end(),o.queue.submit([u.finish()]),b.destroy(),p}filterMask(t,r,a,s){let{device:n}=this,i=n.createTexture({label:"relief-mask",size:[r,a],format:"r8unorm",usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.TEXTURE_BINDING}),o=n.createBuffer({label:"relief-net",size:16,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});n.queue.writeBuffer(o,0,new Uint32Array([s>>>0,0,0,0]));let c=this.netPipeline(),l=n.createBindGroup({layout:c.getBindGroupLayout(0),entries:[{binding:0,resource:t.createView()},{binding:1,resource:{buffer:this.analytic.netsBuffer}},{binding:2,resource:{buffer:o}}]}),f=n.createCommandEncoder(),d=f.beginRenderPass({colorAttachments:[{view:i.createView(),clearValue:{r:0,g:0,b:0,a:0},loadOp:"clear",storeOp:"store"}]});return d.setPipeline(c),d.setBindGroup(0,l),d.draw(3),d.end(),n.queue.submit([f.finish()]),o.destroy(),i}encode(t,r){if(!this.ready)return 0;let a=new Float32Array(this.scratch),s=new Uint32Array(this.scratch);return a.set(r,0),a.set(this.boundsMm,16),a.set(this.params.field.originMm,20),a.set(this.params.pitch,22),s[24]=this.params.field.width,s[25]=this.params.field.height,s[26]=this.grid[0],s[27]=this.grid[1],a.set(this.params.range,28),a[30]=this.base,a[31]=this.height,a.set([.35,.45,.82,0],32),this.device.queue.writeBuffer(this.uniform,0,this.scratch),t.setPipeline(this.pipeline()),t.setBindGroup(0,this.bindGroup),t.draw(this.vertexCount),1}worldBounds(){if(!this.ready)return null;let[t,r,a,s]=this.boundsMm;return[t/1e3,-s/1e3,this.base,a/1e3,-r/1e3,this.base+this.height]}release(){this.mask?.destroy(),this.field?.destroy(),this.mask=null,this.field=null,this.bindGroup=null,this.vertexCount=0,this.layer=null}destroy(){this.release(),this.uniform.destroy()}};var rb=512*1024*1024,Y1=.65,J1=1.5,Q1=15e3,Z1=120,eM=12,tM=48,wb=230,mc=document,It,L,Ge,Pn,jn,Ln,Vr,Yn,wt,Rn,Va,yt,dt,Te,We,Nn,Dn,Ha,Ue,se,Jn,Qn,qe,Gr,yr,rt,_t,Un,zr,Z=e=>mc.querySelector(e),mr=e=>mc.querySelectorAll(e);function vb(e=document){mc=e,It=Z("#app"),L=Z("#viewport"),Ge=Z("#schematic-viewport"),Pn=Z("#schematic-dom-layer"),jn=Z("#schematic-flow-overlay"),Ln=Z("#bom-view"),Vr=Z("#status")||{set textContent(t){}},Yn=Z("#viewer-kind")||{set textContent(t){}},wt=Z("#selection")||{set textContent(t){}},Rn=Z("#diagnostics")||{set innerHTML(t){}},Va=Z("#scene-stats"),yt=Z("#lod-tuning"),dt=Z("#layers"),Te=Z("#search-controls"),We=Z("#view-controls"),qe=Z("#stackup-workspace-view"),Nn=Z("#fallback"),Dn=Z("#panel-labels"),Ha=Z("#schematic-labels"),Ue=Z("#axis-gizmo"),se=Z("#selection-card"),Jn=Z("#primary-heading"),Qn=Z("#primary-description"),Gr=Z("#mode-switch"),yr=Z("#system-labels"),rt=Z("#move-gizmo"),_t=Z("#system-help"),Un=Z("#system-harnesses"),zr=Z("#harness-nodes"),zr?.addEventListener("pointermove",t=>pp(t)),zr?.addEventListener("pointerup",t=>gp(t)),It.classList.add("workspace-pcb")}var rM=["soldermask","silkscreen","paste"],aM=Object.freeze([{role:"soldermask",side:"front",name:"F.Mask"},{role:"soldermask",side:"back",name:"B.Mask"},{role:"silkscreen",side:"front",name:"F.SilkS"},{role:"silkscreen",side:"back",name:"B.SilkS"},{role:"paste",side:"front",name:"F.Paste"},{role:"paste",side:"back",name:"B.Paste"}]),sM={soldermask:"#1f6b45",silkscreen:"#f2f2f2",paste:"#a0a3a8"};function Mb(){return{workspace:"pcb",clickSelect:!0,mode:"3d",activeNetId:0,selectedFeatureId:0,selectedOccurrence:0,selectionAnchor:null,showBoard:!0,showComponents:!0,showPlaceholders:!0,realisticColors:!0,hiddenBoardLayers:[],isolateNet:!1,savedShowBoard:!0,savedShowComponents:!0,preIsolationShowBoard:null,separation:0,dragging:!1,dragMode:"orbit",lastX:0,lastY:0,pointerStartX:0,pointerStartY:0,frameCpuMs:0,frameCpuP95Ms:0,frameIntervalMs:0,frameIntervalP95Ms:0,frameSamples:[],fps:0,frames:0,fpsAt:performance.now(),activeTab:"layers",selectedPageId:"",selectedSchematicFeature:null,schematicDragging:!1,schematicLastX:0,schematicLastY:0,schematicStartX:0,schematicStartY:0}}function Qa(e={}){return{key:e.key??"board",topology:e.topology||window.__TOPOLOGY__||{},semanticGeometry:e.semanticGeometry||window.__SEMANTIC_GEOMETRY__||{},viewerReadiness:e.readiness||{stage:"semantic-ready",progress:100},assetCache:e.assetCache||null,deferComponents:!!e.deferComponents,scene:nM(),renderer:null,compareLayers:new Set,desiredCompareLayers:new Set,visible3dLayers:new Set,preIsolation3dLayers:null,preIsolationCompareLayers:null,highlightedNetIds:new Set,hiddenComponents:new Set,hiddenComponentRequest:null,loadedBytes:0,triangles:0,residentTileBytes:0,residentTileGpuBytes:0,residentTileTriangles:0,tileLoads:0,tileEvictions:0,tileSchedulerMs:0,lastTileScheduleAt:0,visibleTileIds:new Set,gpuBytes:0}}function nM(){return{manifest:null,manifestUrl:"",layers:[],copperLayers:[],nets:[],features:new Map,tiles:new Map,loaded:new Set,loading:new Map,failed:new Map,residentTiles:new Map,componentFeatures:new Map,componentModelCounts:new Map,componentTier:"idle",componentEntries:[],componentsWantedAt:0,componentEvictions:0,runtimeBounds:null,layerZOffsets:new Float32Array(256),layerZOffsetSignature:""}}function kb(){return{key:"",started:0,from:new Map,current:new Map}}function Eb(){return{phase:"idle",previous:new Set,target:new Set,previousOffsets:new Map,started:0}}function Sb(){return{manifest:null,manifestUrl:"",pages:[],byId:new Map,activeNetUid:"",visiblePages:[],fitted:!1,rendererMode:new URLSearchParams(location.search).get("schematicRenderer")||"svg-dom",domFallbackReason:""}}var M=Mb(),k=Qa(),w=null,Fe=kb(),$=Eb(),G=Sb(),Gn=[],iM=5e3,oM=5e3,O,re,ut,z,ee,xr=new Map,ar=performance.now(),Ae=0,Cn=0,Za=null,zn=null,Kn=null,ac=!1,Ye=!1,Zn=()=>!0,qa=!0;!window.__PRISM_SEMANTIC_VIEWER_MANUAL_BOOT__&&document.getElementById("app")&&xc().catch(e=>{console.error(e),Vr&&(Vr.textContent="Renderer failed"),Nn&&(Nn.hidden=!1,Nn.textContent=e.stack||e.message||String(e))});function Tb(e){let t=new Map((e.components||[]).map(a=>[a.uid,a])),r={};for(let a of e.terminals||[]){let s=a.net_uid;if(!s)continue;let n=t.get(a.component_uid)||{},i={designator:a.designator||n.designator||"",pin:a.pin||"",value:n.value||"",pcb_pad_id:a.pcb_pad_id||"",pcb_pad_source_uid:a.pcb_pad_source_uid||""};r[s]||(r[s]={terminals:[]});let o=r[s].terminals;o.some(c=>c.designator===i.designator&&c.pin===i.pin)||o.push(i)}return r}function cM(e,t=k){if(!e||!t.scene?.features)return 0;let r=e.pcb_pad_source_uid||"";if(!r&&e.pcb_pad_id&&(r=(t.topology?.physical_objects||[]).find(s=>s.uid===e.pcb_pad_id)?.source_ids?.[0]||""),!r)return 0;for(let[a,s]of t.scene.features.entries())if(s.sourceUid===r&&s.kind==="pad")return a;return 0}function yc(e,t=k){return!e||!t.topology||!t.topology.components?null:t.topology.components.find(r=>r.designator===e)}function In(e,t){for(let r of Object.keys(e))delete e[r];Object.assign(e,t)}function Ab(){if(Cn&&(cancelAnimationFrame(Cn),Cn=0),window.removeEventListener("keydown",qp),w){for(let e of w.boards.values())e.abort?.abort();w.scene.dispose(),w=null}else ic(),k.renderer?.dispose?.();k.renderer=null,O=null,re?.dispose?.(),re=null,ut=null,Za=null,Zn=()=>!0,qa=!0}function _b(){return Ae+=1,Ab(),In(M,Mb()),k=Qa(),In(Fe,kb()),In($,Eb()),In(G,Sb()),Gn=[],z=null,ee=null,xr=new Map,ar=performance.now(),Ae}function Ib(e){e===Ae&&(Ae+=1,Ab())}function Wa(e){e===Ae&&(Cn=requestAnimationFrame(t=>_k(t,e)))}function ge(e){return e===Ae}async function xc(e={}){let t=_b(),r={};if(k.topology=e.topology||window.__TOPOLOGY__||{},k.topology&&!k.topology.net_details&&(k.topology.net_details=Tb(k.topology)),k.semanticGeometry=e.semanticGeometry||window.__SEMANTIC_GEOMETRY__||{},k.viewerReadiness=e.readiness||k.semanticGeometry.readiness||{stage:"semantic-ready",progress:100},Za=typeof e.onSelectionChange=="function"?e.onSelectionChange:null,Kn=typeof e.onContextMenu=="function"?e.onContextMenu:null,zn=typeof e.onViewStateChange=="function"?e.onViewStateChange:null,Zn=typeof e.isActive=="function"?e.isActive:()=>!0,qa=e.workspaceScope!=="3d",k.assetCache=e.assetCache||null,M.gpuBudgetBytes=mn,vb(e.root||document),!It||!L)throw new Error("Semantic viewer shell is missing required DOM nodes");return await bM(t,r,e.onPerformanceEvent),{performance:r,...Rb(),selectOccurrence:hM,setHighlightedNetIds(a){k.highlightedNetIds=a,k.renderer?.setEmphasizedNetIds(a)},refreshResidency(){_e(performance.now(),{force:!0})},resize(){k.renderer?.resize(),O?.resize(),M.workspace==="pcb"&&M.mode==="layer"&&Oc()},setWorkspace(a){let s=a==="stackup"?"stackup":"pcb";M.workspace!==s&&Gp(s)},setHiddenComponents:Dp,getComponentReferences(){return[...k.scene.componentFeatures.keys()]},async loadAnalyticPack(a,s={}){if(!k.renderer)return null;let n=performance.now();ic();let i=Math.round(performance.now()-n),o=++za,c=await Zo({renderer:k.renderer,layers:k.scene.layers,colorFor:f=>{let d=Ya(f,k);return d.length>=4?d.slice(0,4):[...d,1]},bytes:a,wasm:s.wasm,toleranceNm:s.toleranceNm,nets:k.scene.manifest?.nets,features:k.scene.manifest?.objectFeatures,boardZOffsetMm:k.scene.manifest?.boardZOffsetMm});if(o!==za||!k.renderer)return c.analytic.destroy(),c.pack.free(),null;let l=performance.now();return k.renderer.setAnalytic(c.analytic),c.timings.attach=Math.round(performance.now()-l),k.analytic=c,k.analytic.timings={release:i,...k.analytic.timings},ab()},setAnalyticOverlay(a){if(!k.analytic)return null;let s=Xh(k.analytic,a);return k.reliefOptions&&sb(!1),s},setAnalyticRelief(a){return k.reliefOptions=a||null,sb(!0)},setAnalyticVectors(a){return k.analytic?tc(k.analytic,a):null},setAnalyticStyle(a){return k.analytic?Jh(k.analytic,a):null},analyticColormaps(){return{colormaps:Bo,defaults:Ta}},setClickSelect(a){M.clickSelect=a!==!1},analyticProbe(a,s){if(!k.analytic?.overlay||k.analytic.overlay.kind==="operation_values")return null;let n=gb(a,s);if(!n)return null;let i=M.mode==="3d"?k.visible3dLayers:null,o=An(k.analytic,n,Wn(),null,i,1);if(!o)return null;let{quantity:c,units:l}=k.analytic.overlay;return{value:o.value,quantity:c,units:l,sliceKey:o.sliceKey,boardMm:o.boardMm,world:o.world,marker:pb(o.world)}},async analyticAt(a,s){if(!k.analytic)return null;let n=await Vp(a,s);if(n?.kind!=="analytic")return null;let i=gb(a,s);if(!i||k.analytic.overlay?.kind==="operation_values")return rc(k.analytic,n.operationIndex);let o=Wn(),c=Qh(k.analytic.pack.header,n.operationIndex),l=c&&An(k.analytic,i,o,c)||An(k.analytic,i,o),f=await rc(k.analytic,n.operationIndex,l);return l?{...f,marker:pb(l.world)}:f},analyticStats:ab,unloadAnalyticPack(){za+=1,ic()},setLodOverride(a){k.renderer?.setLodOverride(a)},projectComponent(a){return Hp(k,a,s=>gr(s,tt))},projectPoint(a){return gr(a,tt)},setViewMode:Np,renderInset:Rk,insetReady:Sp,releaseInset(a){Ja.release(a)},insetBoard:()=>({scene:k.scene,topology:k.topology}),onSceneChange(a){return qn.add(a),()=>qn.delete(a)},insetStats(){return{...Bn,views:Ja.size,targets:[ce.width,ce.height]}},insetSettings(a){return Object.assign(bc,a||{}),{...bc}},gpuIdle(){return k.renderer?.device.queue.onSubmittedWorkDone()??Promise.resolve()},dispose(){fM(),Ib(t)}}}function ab(){let e=k.analytic;return e?{operations:e.operations,lowerMs:e.lowerMs,timings:e.timings,zOffset:e.zOffset,unmatched:e.unmatched,...e.analytic.stats()}:null}function sb(e){let t=k.renderer;if(!t)return null;let r=k.reliefOptions,a=k.analytic?.overlay;if(!r||!a||a.kind==="operation_values"){let i=t.relief?.ready;return t.relief?.release(),i&&e&&z.frame(nr()),t.invalidate?.(),null}let s=$h(k.analytic).sort((i,o)=>o.cells-i.cells),n=s.find(i=>i.key===r.sliceKey)||s[0];return n?(t.relief??=new _n(k.analytic.analytic),t.relief.build(n.slice,{range:a.range,netId:Yh(k.scene.manifest?.nets,a.net),heightShare:r.heightShare}),e&&z.frame(t.relief.worldBounds()),t.invalidate?.(),{sliceKey:n.key,slices:s.map(i=>({key:i.key,layerId:i.layerId,cells:i.cells}))}):(t.relief?.release(),t.invalidate?.(),{sliceKey:null,slices:[]})}var za=0;async function lM(e,t=k){let r=$a(t);if(r)return new Uint8Array(await r(e));let a=await fetch(e,{cache:"default"});if(!a.ok)throw new Error(`Failed to load ${e}: ${a.status}`);return new Uint8Array(await a.arrayBuffer())}async function dM(e,t,r){let a=e.semanticGeometry.assets||{};if(!a.analytic_pack)throw new Error("The analytic bundle names no pack");let s=performance.now(),[n,i]=await Promise.all([lM(a.analytic_pack,e),a.stackup?jb(a.stackup,e).catch(()=>null):null]);if(r.analytic_pack_fetch_ms=performance.now()-s,r.analytic_pack_bytes=n.byteLength,e.loadedBytes+=n.byteLength,!ge(t))return!1;let o=e.semanticGeometry.cache_key||"",c=e.assetCache&&o?await Eh(e.assetCache,{cacheKey:o,wasmKey:Lr(),toleranceNm:fr}):!1;r.analytic_lowering_cached=c;let l=Da.start(n,Mn(),c?1:Tn(Sn));s=performance.now();let f=c?(await La(e.assetCache,{cacheKey:o,wasmKey:Lr(),toleranceNm:fr},[ja])).get(ja):null,d=f&&_h(f,l)||l&&await Ah(l)||await Pa(n);return r.analytic_pack_from_cache=!!f,r.analytic_pack_open_ms=performance.now()-s,r.analytic_pack_hosted=!!d.hosted,ge(t)?(e.analyticSource={bytes:n,pack:d,stackup:i,pool:l},e.scene.manifest=Qc(d.header,i),!0):(d.free(),l?.close(),!1)}async function uM(e,t,r){let a=t.analyticSource,s=++za;t.renderer.stackupLooks=Zc(a.stackup);let n=t.semanticGeometry.cache_key||"",i={renderer:t.renderer,layers:t.scene.layers,colorFor:l=>{let f=Ya(l,t);return f.length>=4?f.slice(0,4):[...f,1]},bytes:a.bytes,pack:a.pack,nets:t.scene.nets,cache:t.assetCache&&n?{store:t.assetCache,cacheKey:n}:null,pool:a.pool},o=performance.now(),c=await Zo(i);return a.pool&&c.pack.hosted?a.pool.release():a.pool?.close(),a.pool=null,s!==za||!ge(e)||!t.renderer?(c.analytic.destroy(),c.pack.free(),null):(t.renderer.setAnalytic(c.analytic),t.analytic=c,r.analytic_board_ms=performance.now()-o,r.analytic_board=c.timings,ra(t.scene.manifest.bbox))}function ic(){k.renderer?.relief?.destroy(),k.renderer&&(k.renderer.relief=null),k.renderer?.setAnalytic(null),k.analytic?.pack.free(),k.analytic=null}function Rb(){return{nets:()=>k.scene.nets,quietly(e){Ye=!0;try{e()}finally{Ye=!1}},selectNet:Lc,selectFeature:kr,selectComponent:Dc,clearSelection:ze,anyEmphasis:Yr,showNetProbe:vc,restoreVisibility:Fb,isolating:()=>M.isolateNet,isolateLitNets:Xr,setNetIsolation:Qr,setGpuBudget(e){M.gpuBudgetBytes=e;for(let t of w?w.boards.values():[k])t.tiersCheckedAt=0},setStatsOverlay:$b,stats:Xb,pickAt(e,t){return Vp(e,t)},getViewState:Nb,setLayerVisible:Cp,applyLayerPreset:Bp,setShowBoard:Op,setShowComponents:Fp,setShowPlaceholders:qk,setRealisticColors:$k,setBoardLayerVisible:Xk,setSeparation:Pp,showNetLayers:jc}}function fM(){ce.depth?.destroy(),Object.assign(ce,{canvas:null,context:null,depth:null,depthView:null,width:0,height:0}),Ja.clear(),qn.clear(),Kr=null}function Nt(){!zn||ac||(ac=!0,queueMicrotask(()=>{ac=!1,zn?.(Nb())}))}function Nb(){let e=M.mode==="3d"?k.visible3dLayers:k.desiredCompareLayers;return{mode:M.mode,layers:k.scene.copperLayers.map(t=>({id:Number(t.id),name:String(t.name),color:ci(oi(t)),visible:e.has(Number(t.id))})),boardLayers:Wk(),showBoard:M.showBoard,showComponents:M.showComponents,showPlaceholders:M.showPlaceholders,realisticColors:M.realisticColors,separation:w?w.separation.get(Xa())||0:M.separation,isolateNet:M.isolateNet,hasNet:!!M.activeNetId||Yr(),...w?{boards:$M(),selectedBoard:Xa()}:{}}}function ei(e){if(w?.move.enabled&&ts(),Ye)return;let t=k.renderer&&!k.renderer.identityOnly?k.renderer.occurrenceKeys[M.selectedOccurrence]:null;Za?.(e&&t!=null?{...e,occurrence:t}:e)}function hM(e){let t=k.renderer?.occurrenceKeys.indexOf(String(e))??-1;t>=0&&(M.selectedOccurrence=t)}function wc(e){if(!e||!k.renderer||k.renderer.identityOnly)return e;let t=k.renderer.occurrenceMatrices[M.selectedOccurrence];return t?Et(t,e):e}function Cb(e,t=null){return e?{kind:"net",sourceContext:"3D",netName:String(e.name||""),netUid:String(e.uid||"")||void 0,netCode:Number(e.id||0)||void 0,featureId:Number(t?.id||0)||void 0,uuid:String(t?.sourceUid||"")||void 0}:null}function Bb(e,t=k){if(!e)return null;let r=$r(e),a=String(e.padNumber||e.pin||e.pinNumber||""),s=t.scene.nets.find(n=>Number(n.id)===Number(e.netId||0));if(r&&a)return{kind:"terminal",sourceContext:"3D",reference:r,pin:a,netUid:s?.uid,netName:s?.name,netCode:s?Number(s.id):void 0,uuid:String(e.sourceUid||"")||void 0,featureId:Number(e.id||0)||void 0};if(r){let n=yc(r,t);return{kind:"component",sourceContext:"3D",reference:r,componentUid:n?.uid,uuid:String(e.sourceUid||"")||void 0,featureId:Number(e.id||0)||void 0}}return Cb(s,e)}function Ob(){M.showBoard=!0,M.showComponents=!0,Mr(),typeof Ke=="function"&&Ke()}function Yr(){return Hr().size>0||!!w?.emphasisSets.length}function Hr(){let e=new Set(k.highlightedNetIds);return M.activeNetId&&e.add(Number(M.activeNetId)),e}function vc(){(M.showBoard||M.showComponents)&&(M.savedShowBoard=M.showBoard,M.savedShowComponents=M.showComponents),M.showBoard=!1,M.showComponents=!1,Mr(),typeof Ke=="function"&&Ke()}function Fb(){M.showBoard=M.savedShowBoard!==!1,M.showComponents=M.savedShowComponents!==!1,Mr(),typeof Ke=="function"&&Ke()}async function Pb(e,t,r={}){let a=e.semanticGeometry.assets?.scene_manifest||e.semanticGeometry.semantic_gltf?.path,s=performance.now();if(e.semanticGeometry.analytic){if(!await dM(e,t,r))return!1}else if(a){if(e.scene.manifestUrl=new URL(a,location.href).toString(),e.scene.manifest=await jb(e.scene.manifestUrl,e),r.scene_manifest_fetch_parse_ms=performance.now()-s,!ge(t))return!1;if(e.scene.manifest.schema!=="prism.semantic_gltf_a0")throw new Error(`Unsupported scene schema: ${e.scene.manifest.schema}`)}else e.scene.manifest={schema:"prism.semantic_gltf_partial.a0",bbox:null,layers:[],nets:[],objectFeatures:[],components:[],tiles:[],barrels:[]},r.scene_manifest_fetch_parse_ms=0;s=performance.now(),e.scene.layers=e.scene.manifest.layers||[],e.scene.copperLayers=e.scene.layers.filter(i=>i.role==="copper"||String(i.name).endsWith(".Cu")),e.scene.nets=e.scene.manifest.nets||[];for(let i of e.scene.manifest.objectFeatures||[])e.scene.features.set(Number(i.id),{...i,bounds:ta(i.boundsMm)});for(let i of e.scene.manifest.components||[])e.scene.componentFeatures.set(i.designator,i),e.scene.features.set(Number(i.featureId),{...i,kind:"component",sourceUid:i.uid,netId:0,bounds:null});for(let i of e.scene.manifest.tiles||[])e.scene.tiles.set(i.id,i);r.scene_manifest_index_ms=performance.now()-s;let n=Gb(e);for(let i of n)e.compareLayers.add(i),e.desiredCompareLayers.add(i);for(let i of e.scene.copperLayers)e.visible3dLayers.add(Number(i.id));return!0}async function bM(e,t={},r=null){let a=performance.now(),s=k.semanticGeometry.analytic?tr.create(L).then(c=>(br.prewarm(c),c)):null;if(!await Pb(k,e,t)){s&&s.then(c=>c?.dispose?.()).catch(()=>{});return}let n=performance.now();if(k.renderer=s?await s:await tr.create(L),t.webgpu_renderer_create_ms=performance.now()-n,!ge(e)){k.renderer?.dispose?.(),k.renderer=null;return}k.renderer.setBarrels($i(k.scene.manifest.barrels,k.scene.manifest.layers)),ss(),n=performance.now();let i=k.analyticSource?await uM(e,k,t):await qb(e);if(t.board_fetch_parse_upload_ms=performance.now()-n,!ge(e)||(k.scene.runtimeBounds=i||ra(k.scene.manifest.bbox),z=new aa(k.scene.runtimeBounds),qa&&(await pM(e),!ge(e)||(await gM(e),!ge(e)))))return;n=performance.now(),Fc(),Up(),qa&&(sE(),aE()),jp(),Xp(),t.controls_and_bindings_ms=performance.now()-n;let o={"board-ready":"Board ready \xB7 components and semantic layers are still generating","components-ready":"Board and components ready \xB7 semantic layers are still generating","semantic-ready":"WebGPU semantic glTF active"};if(Vr.textContent=o[k.viewerReadiness.stage]||"Loading 3D assets",k.semanticGeometry.assets?.components_glb&&!k.deferComponents){let c=performance.now(),l=xp(e);k.analytic&&await l.catch(()=>{}),l.then(()=>{ge(e)&&(hc(i),r?.({schema:"prism.semantic_viewer_performance.a0",milestone:"components-loaded",readiness_stage:k.viewerReadiness.stage,elapsed_ms:performance.now()-c,bytes_loaded:k.loadedBytes}))})}else hc(i);_e(performance.now(),{force:!0}),Wa(e),n=performance.now(),await new Promise(c=>requestAnimationFrame(c)),t.first_frame_wait_ms=performance.now()-n,t.boot_total_ms=performance.now()-a}async function pM(e=Ae){let t=k.semanticGeometry.assets?.schematic_native_manifest||k.semanticGeometry.schematic_vector?.path||k.semanticGeometry.schematic_scene?.path,r=k.semanticGeometry.assets?.schematic_manifest||k.semanticGeometry.schematic_world?.path,a=Z("[data-workspace=schematic]");if(!t&&!r){a.disabled=!0,a.title="No schematic world assets are available";return}let s=[t,r].filter(Boolean),n=null;for(let o of s)try{G.manifestUrl=new URL(o,location.href).toString();let c=await Qs.create(Ge,G.manifestUrl);if(!ge(e))return;O=c,O.setFlowOverlayCanvas(jn);break}catch(c){if(n=c,O=null,o===r)throw c}if(!O)throw n||new Error("Failed to load schematic viewer assets");G.manifest=O.manifest,G.pages=O.pages,G.byId=new Map(G.pages.map(o=>[o.id,o])),M.selectedPageId=G.pages[0]?.id||"",O.selectedPageId=M.selectedPageId,!["native","legacy","webgpu"].includes(String(G.rendererMode).toLowerCase())&&(re=tn.create(Pn,G.manifestUrl,G.manifest,O.featuresByPage,{onSelect:Kk,onBlank:as,onHighlightNet:Ip,onOpenPage:Gk,onFallback:o=>{G.domFallbackReason=o,console.warn(o)}}),re.preloadPages(G.pages)),O.preloadOverview()}async function gM(e=Ae){let t=k.semanticGeometry.assets?.bom||k.semanticGeometry.bom?.path,r=Z("[data-workspace=bom]");if(!t){r&&(r.disabled=!0,r.title="No BoM artifact is available");return}try{let a=await hs.create(Ln,new URL(t,location.href).toString(),{onSelectReference:s=>Dc(s,!0)});if(!ge(e))return;ut=a}catch(a){if(!ge(e))return;console.warn(a),r&&(r.disabled=!0,r.title=a?.message||"BoM artifact could not be loaded")}}async function jb(e,t=k){if(t.assetCache)return t.assetCache.fetchJson(String(e));let r=await fetch(e,{cache:"default"});if(!r.ok)throw new Error(`Failed to load ${e}: ${r.status}`);return r.json()}function mM(){return!w||w.timing.boardsDrawnAt!=null?!0:![...w.boards.values()].some(e=>e.loadState==="loading"||e.loadState==="waiting")}var yM=24*1024*1024,pr={bytes:0,waiting:null};async function Lb(e){for(;;){if(pr.bytes===0||pr.bytes+e<=yM){pr.bytes+=e,pr.waiting??=new Promise(t=>requestAnimationFrame(()=>{pr.bytes=0,pr.waiting=null,t()}));return}await pr.waiting}}async function xM(e,t=Ae,r=k){if(!ge(t))return;let a=r.scene.residentTiles.get(e.id);if(a){a.lastUsed=performance.now();return}if(r.scene.failed.get(e.id))return;if(r.scene.loading.has(e.id))return r.scene.loading.get(e.id);let n=(async()=>{try{let i=await la(new URL(e.path,r.scene.manifestUrl).toString(),{fetchBytes:$a(r),fetchCache:"no-store"});if(!ge(t)||!r.renderer||(await Lb(i.primitives.reduce((p,b)=>p+oc(b),0)),!ge(t)||!r.renderer))return;r.loadedBytes+=i.byteLength;let o=r.scene.layers.find(p=>Number(p.id)===Number(e.layerId)),c=[],l=0,f=0;for(let p of i.primitives){let b=r.renderer.addPrimitive(p,{kind:"copper",tileId:e.id,layerId:Number(e.layerId),innerCopper:ti(Number(e.layerId),r),color:Ya(o,r),stencilMark:Mp(o,r),baseZ:Number(o?.z_mm||0)/1e3,material:{baseColor:[1,1,1,1],metallic:.78,roughness:.32}});c.push(b),l+=p.indices.length/3,f+=oc(p)}let d={tile:e,entries:c,byteLength:i.byteLength,gpuBytes:f,triangles:l,lastUsed:performance.now(),pinned:!1};r.scene.residentTiles.set(e.id,d),r.scene.loaded.add(e.id),r.tileLoads+=1,r.residentTileBytes+=i.byteLength,r.residentTileGpuBytes+=f,r.residentTileTriangles+=l,r.triangles=r.residentTileTriangles,r.scene.failed.delete(e.id)}catch(i){if(!ge(t))return;let o=r.scene.failed.get(e.id)||{count:0,message:""};r.scene.failed.set(e.id,{count:o.count+1,message:i?.message||String(i)}),o.count||console.warn(`Failed to load tile ${e.id}; suppressing retries until assets are regenerated`,i)}finally{ge(t)&&r.scene.loading.delete(e.id)}})();return r.scene.loading.set(e.id,n),n}function oc(e){return _u(e.position.length/3,e.indices.length)}function Mc(e,t=k){let r=t.scene.residentTiles.get(e);r&&(t.renderer.removeEntries(r.entries),t.scene.residentTiles.delete(e),t.scene.loaded.delete(e),t.residentTileBytes=Math.max(0,t.residentTileBytes-r.byteLength),t.residentTileGpuBytes=Math.max(0,t.residentTileGpuBytes-r.gpuBytes),t.residentTileTriangles=Math.max(0,t.residentTileTriangles-r.triangles),t.triangles=t.residentTileTriangles,t.tileEvictions+=1)}function _e(e=performance.now(),t={},r=k){if(!r.renderer||!z||M.workspace!=="pcb")return;let a=M.mode==="layer"&&$.phase==="preload";if(!t.force&&!a&&e-r.lastTileScheduleAt<Z1)return;let s=performance.now();r.lastTileScheduleAt=e;let n=wM(r);r.visibleTileIds=n;let i=r.scene.loading.size,c=Math.max(0,(a?tM:eM)-i),l=[...n].map(d=>r.scene.tiles.get(d)).filter(d=>d&&!r.scene.residentTiles.has(d.id)&&!r.scene.loading.has(d.id)&&!r.scene.failed.has(d.id)).sort((d,p)=>ib(d,r)-ib(p,r)).slice(0,c),f=Ae;for(let d of l)xM(d,f,r);for(let d of n){let p=r.scene.residentTiles.get(d);p&&(p.lastUsed=e)}Kb(n,void 0,r),kM(n,e,r),MM(n,e,r),r.tileSchedulerMs=performance.now()-s}function wM(e=k){let t=new Set,r=M.mode==="3d"?e.visible3dLayers:EM();if(!r.size||!ee)return t;if(M.mode==="layer"){for(let c of e.scene.tiles.values())r.has(Number(c.layerId))&&t.add(c.id);return t}let a=new Set,s=Tc(e);if(s.size){for(let c of e.scene.tiles.values())if(r.has(Number(c.layerId))){for(let l of s)if(Hb(c,l)){a.add(c.id);break}}}let n=kc(e),i=[ee.matrix,...vM(),...e===k?Ja.active(performance.now()):[]],o=0;for(let c of e.scene.tiles.values()){if(!r.has(Number(c.layerId))||n&&ti(Number(c.layerId),e))continue;let l=M.mode==="layer"?xr.get(Number(c.layerId)):null;i.some(f=>Vn(c,f,l,Y1,e))&&t.add(c.id),!e.scene.residentTiles.has(c.id)&&Vn(c,ee.matrix,l,0,e)&&(o+=1)}for(let c of a)t.add(c);return e.visibleTileMisses=o,t}function vM(){if(!z?.moving?.()||M.mode==="layer")return[];let e=performance.now();return Ga.at===e||(Ga.at=e,Ga.views=[0,1].map(t=>z.targetMatrix(L.width,L.height,!1,t))),Ga.views}var Ga={at:-1,views:[]};function MM(e,t,r){if(M.mode==="layer"||!ee)return;let a=kc(r);for(let s of[...r.scene.residentTiles.values()]){if(e.has(s.tile.id)||r.scene.loading.has(s.tile.id))continue;let n=Number(s.tile.layerId);if(r.visible3dLayers.has(n)&&!(a&&ti(n,r))&&Vn(s.tile,ee.matrix,null,J1,r)){s.lastUsed=t;continue}t-s.lastUsed>Q1&&Mc(s.tile.id,r)}}function Db(e,t){return e?"all":t?"lit":"none"}function kc(e){return!!e.renderer&&e.renderer.innerCopperMode!=="all"}function kM(e,t,r){if(kc(r))for(let a of[...r.scene.residentTiles.values()])e.has(a.tile.id)||r.scene.loading.has(a.tile.id)||ti(Number(a.tile.layerId),r)&&t-a.lastUsed>oM&&Mc(a.tile.id,r)}function EM(){return M.mode!=="layer"||$.phase==="idle"?k.compareLayers:zb($.previous,$.target)}function Ub(){return M.mode!=="layer"?k.visible3dLayers:$.phase==="reveal"?zb($.previous,$.target):k.compareLayers}function Gb(e=k){let t=e.scene.copperLayers.map(r=>Number(r.id)).filter(Number.isFinite);return t.length?t.length===1?new Set([t[0]]):new Set([t[0],t[t.length-1]]):new Set}function SM(){let e=k.desiredCompareLayers.size?k.desiredCompareLayers:k.compareLayers;return e.size?new Set([...e].map(Number)):Gb()}function zb(...e){let t=new Set;for(let r of e)for(let a of r||[])t.add(Number(a));return t}function Kb(e,t=rb,r=k){if(M.mode==="layer")return;let a=Math.min(rb,t);if(r.residentTileGpuBytes<=a)return;let s=[...r.scene.residentTiles.values()].filter(n=>!e.has(n.tile.id)&&!r.scene.loading.has(n.tile.id)).sort((n,i)=>n.lastUsed-i.lastUsed);for(let n of s){if(r.residentTileGpuBytes<=a)break;Mc(n.tile.id,r)}}function Vn(e,t,r=null,a=0,s=k){let n=Vb(e,s);if(!n)return!0;let i=Math.max(n[3]-n[0],n[4]-n[1])*a,o=[n[0]-i+(r?.[0]||0),n[1]-i+(r?.[1]||0),n[2]-.002,n[3]+i+(r?.[0]||0),n[4]+i+(r?.[1]||0),n[5]+.002],c=s.renderer?.occurrenceMatrices;return!c||c.length===1&&Fs(c[0])?nb(o,t):c.some(l=>nb(o,ir(t,l)))}function Vb(e,t=k){let r=e.boundsMm;if(!r||r.length!==4)return null;let a=t.scene.layers.find(n=>Number(n.id)===Number(e.layerId)),s=Number(a?.z_mm||0)/1e3;return[r[0]/1e3,-r[3]/1e3,s-4e-4,r[2]/1e3,-r[1]/1e3,s+4e-4]}function nb(e,t){let r=[[e[0],e[1],e[2]],[e[3],e[1],e[2]],[e[0],e[4],e[2]],[e[3],e[4],e[2]],[e[0],e[1],e[5]],[e[3],e[1],e[5]],[e[0],e[4],e[5]],[e[3],e[4],e[5]]].map(s=>TM(t,s));return![s=>s[0]<-s[3],s=>s[0]>s[3],s=>s[1]<-s[3],s=>s[1]>s[3],s=>s[2]<0,s=>s[2]>s[3]].some(s=>r.every(s))}function TM(e,t){let r=t[0],a=t[1],s=t[2];return[e[0]*r+e[4]*a+e[8]*s+e[12],e[1]*r+e[5]*a+e[9]*s+e[13],e[2]*r+e[6]*a+e[10]*s+e[14],e[3]*r+e[7]*a+e[11]*s+e[15]]}function Hb(e,t){return Array.isArray(e.netIds)&&e.netIds.some(r=>Number(r)===Number(t))}function ib(e,t=k){let r=Vb(e,t);if(!r||!z)return 0;let a=(r[0]+r[3])*.5-z.focus[0],s=(r[1]+r[4])*.5-z.focus[1];return a*a+s*s}async function qb(e=Ae,t=k){let r=t.semanticGeometry.assets?.base_board_glb;if(!r)return null;let a=t.semanticGeometry.assets?.soldermask_glb,[s,n]=await Promise.all([la(new URL(r,location.href).toString(),{defaultFeatureId:0,fetchBytes:$a(t)}),a?la(new URL(a,location.href).toString(),{defaultFeatureId:0,fetchBytes:$a(t)}).catch(o=>(console.warn("[prism-semantic-viewer] solder mask failed to load",o),null)):null]);if(!ge(e)||!t.renderer)return null;t.renderer.stackupLooks=t.semanticGeometry.board_looks||null,t.loadedBytes+=s.byteLength,n&&(t.loadedBytes+=n.byteLength);let i=[...s.primitives.filter(o=>{let c=di(o);return c!=="pad"&&!(n&&c==="soldermask")}),...n?.primitives||[]];for(let o of ea(i,di)){let c=rM.includes(o.groupKey);t.renderer.addPrimitive(o,{kind:"board",boardRole:o.groupKey,...c?{side:Vc(o)}:{},layerId:o.groupKey==="paste"?Mk(o,t):0,material:o.material,color:o.material.baseColor})}return t.renderer.setHiddenBoardLayers(M.hiddenBoardLayers),Tr(i.map(o=>o.bounds))}function nr(e=k){return e.scene.runtimeBounds||ra(e.scene.manifest?.bbox)}function ti(e,t=k){return qc(e,t.scene.copperLayers)}function Wb(e,t){let{back:r}=z.basis();return{eye:Ne(z.focus,ve(r,z.distance)),orthographic:t,pixelScale:t?e/Math.max(1e-9,z.orthoScale):e/2/Math.tan(z.fov/2)}}function Xb(){if(w)return AM();let e=k.renderer?.cullCounts||{full:0,board:0,body:0,box:0,culled:0},t=!k.renderer||k.renderer.identityOnly;return{occurrences:k.renderer?.occurrenceMatrices.length||0,lod:t?{full:1,board:0,body:0,box:0,culled:0}:{...e},triangles:k.renderer?.frameStats.triangles||0,draws:k.renderer?.frameStats.draws||0,gpuMemoryBytes:k.renderer?.gpuMemoryBytes()||0,gpuBreakdown:k.renderer?.gpuMemoryBreakdown()||null,gpuBudgetBytes:M.gpuBudgetBytes,componentTier:k.scene.componentTier,componentEvictions:k.scene.componentEvictions,tileEvictions:k.tileEvictions,visibleTileMisses:k.visibleTileMisses||0,cache:k.assetCache?k.assetCache.summary():{enabled:!1},frameIntervalMs:M.frameIntervalMs,frameIntervalP95Ms:M.frameIntervalP95Ms,frameCpuMs:M.frameCpuMs,frameCpuP95Ms:M.frameCpuP95Ms,fps:M.fps}}function AM(){let e=at(),t=e.map(r=>r.scene.componentTier);return{occurrences:w.scene.occurrenceCount||0,lod:w.scene.cullCounts(),triangles:w.scene.frameStats.triangles,draws:w.scene.frameStats.draws,gpuMemoryBytes:w.scene.gpuMemoryBytes(),gpuBreakdown:w.scene.gpuMemoryBreakdown(),gpuBudgetBytes:M.gpuBudgetBytes,componentTier:`${t.filter(r=>r==="loaded").length}/${e.length} loaded`,componentEvictions:e.reduce((r,a)=>r+a.scene.componentEvictions,0),tileEvictions:e.reduce((r,a)=>r+a.tileEvictions,0),visibleTileMisses:e.reduce((r,a)=>r+(a.visibleTileMisses||0),0),componentMisses:e.filter(r=>r.renderer.cullCounts.full>0&&r.scene.componentTier!=="loaded"&&r.semanticGeometry.assets?.components_glb).length,cache:e.find(r=>r.assetCache)?.assetCache.summary()||{enabled:!1},frameIntervalMs:M.frameIntervalMs,frameIntervalP95Ms:M.frameIntervalP95Ms,frameCpuMs:M.frameCpuMs,frameCpuP95Ms:M.frameCpuP95Ms,fps:M.fps,firstFrame:w.timing.boardsDrawnAt==null?null:{sinceSceneMs:w.timing.boardsDrawnAt-w.timing.descriptorAt,sinceNavigationMs:w.timing.boardsDrawnAt}}}function $b(e){M.showStats=!!e,Va&&(Va.hidden=!M.showStats),yt&&(yt.hidden=!(M.showStats&&w)),M.showStats&&w&&NM(),Yb()}var cc="prism.systemScene.lodThresholds",_M=Object.freeze([{key:"fullPx",label:"Parts",max:600},{key:"boardPx",label:"Copper",max:400},{key:"boxPx",label:"Box below",max:120}]);function IM(){try{let e=JSON.parse(globalThis.localStorage?.getItem(cc)||"null");if(e&&typeof e=="object")return Ir(e)}catch{}return{...lt}}function RM(e){try{e?globalThis.localStorage?.setItem(cc,JSON.stringify(e)):globalThis.localStorage?.removeItem(cc)}catch{}}function lc(e){if(!w)return null;let t=e==null?{...lt}:{...w.scene.lodThresholds,...e},r=w.scene.setLodThresholds(t);return RM(e==null?null:r),dc(),r}function NM(){if(!yt||yt.childElementCount)return dc();let e=document.createElement("h2");e.textContent="Detail thresholds (CSS px)",yt.append(e);for(let r of _M){let a=document.createElement("label"),s=document.createElement("span");s.textContent=r.label;let n=document.createElement("input");Object.assign(n,{type:"range",min:"0",max:String(r.max),step:"1"}),n.dataset.key=r.key;let i=document.createElement("output");n.addEventListener("input",()=>lc({[r.key]:Number(n.value)})),a.append(s,n,i),yt.append(a)}let t=document.createElement("button");t.type="button",t.textContent="Defaults",t.addEventListener("click",()=>lc(null)),yt.append(t),dc()}function dc(){if(!yt||!w)return;let e=w.scene.lodThresholds;for(let t of yt.querySelectorAll("input[data-key]"))t.value=String(e[t.dataset.key]),t.nextElementSibling.value=String(Math.round(e[t.dataset.key]))}function Yb(){if(!Va||!M.showStats)return;let e=Xb(),{full:t,board:r,body:a,box:s,culled:n}=e.lod,i=[["Occurrences",`${e.occurrences} (${t+r+a+s} visible)`],["Detail",`${t} full \xB7 ${r} board \xB7 ${a} body \xB7 ${s} box \xB7 ${n} culled`],["Triangles",e.triangles.toLocaleString()],["Draws",e.draws.toLocaleString()],["GPU memory",`${(e.gpuMemoryBytes/1048576).toFixed(1)} / ${(e.gpuBudgetBytes/1048576).toFixed(0)} MB`],["Components",`${e.componentTier}${e.componentEvictions?` \xB7 ${e.componentEvictions} evicted`:""}`],["Cache",e.cache.enabled?`${e.cache.hits} hits \xB7 ${e.cache.misses} misses \xB7 ${(e.cache.bytes/1048576).toFixed(0)} MB`:"off"],["Frame",`${e.frameIntervalMs.toFixed(1)} ms \xB7 p95 ${e.frameIntervalP95Ms.toFixed(1)}`],["CPU",`${e.frameCpuMs.toFixed(2)} ms \xB7 p95 ${e.frameCpuP95Ms.toFixed(2)}`],["FPS",e.fps.toFixed(0)]];Va.innerHTML=i.map(([o,c])=>`<dt>${o}</dt><dd>${c}</dd>`).join("")}var CM="prism.system_scene.a0";function at(){return w?[...w.boards.values()].filter(e=>e.renderer&&e.loadState==="loaded"):[]}async function Jb(e={}){let t=_b();if(Za=typeof e.onSelectionChange=="function"?e.onSelectionChange:null,Kn=typeof e.onContextMenu=="function"?e.onContextMenu:null,zn=typeof e.onViewStateChange=="function"?e.onViewStateChange:null,Zn=typeof e.isActive=="function"?e.isActive:()=>!0,qa=!1,M.gpuBudgetBytes=mn,vb(e.root||document),!It||!L)throw new Error("Semantic viewer shell is missing required DOM nodes");if(typeof e.loadBundle!="function")throw new Error("A system scene needs a bundle loader");let r=await Ws.create(L);return ge(t)?(r.setLodThresholds(IM()),w={scene:r,loadBundle:e.loadBundle,onEmphasis:typeof e.onEmphasis=="function"?e.onEmphasis:null,onMove:typeof e.onMove=="function"?e.onMove:null,onHarness:typeof e.onHarness=="function"?e.onHarness:null,baseDescriptor:null,descriptor:null,move:ek(),gizmo:null,standInKey:null,showLabels:!0,harnesses:[],harnessLit:new Map,showHarnesses:!0,harnessDrawn:null,tubes:[],tubedHarnesses:new Set,harnessPick:null,worlds:new Map,nodePreview:null,housingModels:new Map,timing:{descriptorAt:null,boardsDrawnAt:null},boards:new Map,groups:new Map,placed:[],placements:new Map,hiddenLayers:new Map,separation:new Map,bounds:null,framed:!1,snapped:!1,boardSelected:!1,inputs:new Map,emphasisSets:[],emphasisBounds:new Map,emphasisReport:null},k=Qa({key:""}),z=new aa([-.1,-.1,-.01,.1,.1,.01]),Fc(),Up(),jp(),Xp(),Vr.textContent="System scene",Wa(t),{...Rb(),focusPlacement:KM,selectBoardContext:zc,setEmphasisSets:YM,setSystemScene:BM,frameNetEmphasis:JM,frameAll(){w?.bounds&&z.frame(w.bounds)},setMoveAllowed:tk,setMoveMode:Hn,setMoveSpace:fp,previewPose:rk,cancelMove:Nc,getMoveState:()=>w?up():null,targetHarnessNode:ii,selectHarness:gk,previewHarnessNode:mk,cancelHarnessNode:yp,getHarnessState:()=>w?mp():null,setLabelsVisible(a){w&&(w.showLabels=!!a,yr&&(yr.hidden=!w.showLabels))},setHelpVisible:bp,isHelpVisible:()=>!!(_t&&!_t.hidden),setHarnessesVisible(a){w&&(w.showHarnesses=!!a,w.harnessDrawn=null,qr({relabel:!1}))},frameBoard(a){let s=w?.placements.get(String(a));return s&&z.frame(s.worldBounds),!!s},frameParts:QM,resize(){w?.scene.resize()},setLodOverride(a){for(let s of at())s.renderer.setLodOverride(a)},setLodThresholds:lc,pickSurfaceAt:iE,focusMoveTarget:oE,viewAxis(a,s=!1){!w||!["x","y","z"].includes(a)||(z.setAxis(a,!!s),w.bounds&&z.frame(w.bounds))},projectPoint(a,s){return lb(a,s)},projectComponent(a,s){let n=w?.placements.get(String(s));return n?.board?Hp(n.board,a,i=>lb(i,s)):null},dispose(){Ib(t)}}):(r.dispose(),null)}function BM(e){if(!w)return;if(e?.schema!==CM)throw new Error(`Unsupported system scene schema: ${e?.schema||"missing"}`);w.baseDescriptor=e,w.timing.descriptorAt??=performance.now();let t=w.move.target?e.occurrences.find(a=>a.path===w.move.target):null;t?!w.move.drag&&lp(w.move.preview,t.pose)&&(w.move.preview=null):(w.move.drag=null,w.move.preview=null,w.move.target=null),w.descriptor=dp(),w.harnesses=Array.isArray(e.harnesses)?e.harnesses:[],w.harnessDrawn=null;let r=new Set;for(let a of e.assets||[]){r.add(a.assetId);let s=w.boards.get(a.assetId),n=Vf(s,a);if(n!=="create"){s.asset=a,n==="load"&&cb(s,Ae);continue}s&&ob(a.assetId);let i=Qa({key:a.assetId,topology:{},semanticGeometry:{},deferComponents:!0});Object.assign(i,{asset:a,bundleUrl:a.bundleUrl,loadState:"waiting",abort:null}),w.boards.set(a.assetId,i),To(a)&&cb(i,Ae)}for(let a of[...w.boards.keys()])r.has(a)||ob(a);qr(),yk(),w.move.enabled&&(ts({quiet:!0}),vt("sync"))}function ob(e){let t=w.boards.get(e);t?.abort?.abort(),w.boards.delete(e),w.scene.removeAsset(e),t&&(t.renderer=null),k===t&&Ec()}async function cb(e,t){e.loadState="loading",e.abort=new AbortController;let r=()=>ge(t)&&w?.boards.get(e.key)===e&&!e.abort.signal.aborted;try{let a=await w.loadBundle(e.bundleUrl,e.abort.signal);if(!r()||(e.topology=a.topology||{},e.topology.net_details||(e.topology.net_details=Tb(e.topology)),e.semanticGeometry=a.semanticGeometry||{},e.viewerReadiness=a.readiness||e.semanticGeometry.readiness||{stage:"semantic-ready",progress:100},e.assetCache=a.assetCache||null,!await Pb(e,t)||!r()))return;e.renderer=w.scene.asset(e.key),e.renderer.setBarrels($i(e.scene.manifest.barrels,e.scene.manifest.layers)),ss(e);let s=await qb(t,e);if(!r())return;e.scene.runtimeBounds=s||ra(e.scene.manifest.bbox),e.renderer.setBoardBounds(e.scene.runtimeBounds),e.loadState="loaded",qr()}catch(a){if(!r())return;console.warn(`[prism-semantic-viewer] system board ${e.key} failed to load`,a),e.loadState="failed",e.error=a?.message||String(a),w.scene.removeAsset(e.key),e.renderer=null,k===e&&Ec(),qr()}}function qr({relabel:e=!0}={}){let t=w?.descriptor;if(!t)return;w.harnessDrawn=null;let r=Xa(),a=new Map((t.assets||[]).map(c=>[c.assetId,c])),s=new Map,n=[];for(let c of Hf(t)){let l=c.assetId?a.get(c.assetId):null,f=c.assetId?w.boards.get(c.assetId):null,d=c.kind!=="board"&&!c.restricted?jM(c):null;if(d){s.has(d.rendererId)||s.set(d.rendererId,[]),s.get(d.rendererId).push({matrix:d.matrix,key:c.path,hiddenLayers:[],explode:null}),n.push({occurrence:c,rendererId:d.rendererId,board:null,matrix:d.matrix,worldBounds:d.worldBounds,standIn:null,own:d.kind,primitives:d.primitives});continue}if(c.model||c.box)continue;let p=Kf(c,l,f?.loadState),b,h,u;if(!p)b=f.key,h=fn(c.worldMatrix,l.bundleToBoard),u=Et(h,f.scene.runtimeBounds);else{if(!c.boundsMm)continue;b=`stand-in:${p}`,w.scene.standIn(b,un[p].color),h=Ea(c.worldMatrix,c.boundsMm),u=Et(h,[0,0,0,1,1,1])}s.has(b)||s.set(b,[]),s.get(b).push({matrix:h,key:c.path,hiddenLayers:p?[]:[...w.hiddenLayers.get(c.path)||[]],explode:p?null:op(f,w.separation.get(c.path)||0)}),n.push({occurrence:c,rendererId:b,board:p?null:f,matrix:h,worldBounds:u,standIn:p})}let i=Zb();LM(s,i.housings);for(let c of w.scene.assets.keys())s.has(c)||s.set(c,[]);w.scene.setOccurrences(s),w.groups=s;let o=w.placements;if(w.placed=n,w.placements=new Map(n.map(c=>[c.occurrence.path,c])),e||!o)wk();else for(let c of n)c.label=o.get(c.occurrence.path)?.label;w.bounds=Tr(n.map(c=>c.worldBounds)),w.bounds&&(z.sceneRadius=Ct(w.bounds),w.framed||(z.frame(w.bounds),w.snapped||z.snap(),w.snapped=!0,n.some(c=>c.standIn==="loading")||(w.framed=!0)));for(let c of at())ri(c);r!=null&&(w.placements.get(r)?.board===k?M.selectedOccurrence=k.renderer.occurrenceKeys.indexOf(r):Ec()),xt(i),cp(),Nt()}var Qb=[.17,.18,.2],OM=[.24,.39,.87],FM=[.9,.28,.3];function Zb(){if(w.worlds=new Map(w.descriptor.occurrences.map(e=>[e.path,e.worldMatrix])),!w.showHarnesses||!w.harnesses.length)return{tubes:[],housings:[]};try{let e=w.descriptor.occurrences.filter(t=>t.kind==="board"&&t.boundsMm).map(t=>({id:t.path,matrix:t.worldMatrix,...t.boundsMm}));return Gf(mo(w.harnesses,w.nodePreview,Tt),Jr,e)}catch(e){return console.warn("[prism-semantic-viewer] harness geometry failed",e),{tubes:[],housings:[]}}}function xt(e=null){if(!w?.descriptor)return;let t=(e??Zb()).tubes;w.tubes=t,w.tubedHarnesses=new Set(t.map(r=>r.harness)),w.scene.setTubes(t,ap)}var uc=[.42,.45,.5,1],ep=Object.freeze([1e3,0,0,0,0,0,-1e3,0,0,1e3,0,0,0,0,0,1]);function PM(e){return{...ip(e),showBoard:!1,showComponents:!0}}function tp(e,t){return e.housing?PM(t):ip(t)}function jM(e){if(e.model?.glbKey){let t=ir(e.worldMatrix,e.model.matrixMm||tt),r=w.housingModels.get(e.model.glbKey);if(r||rp(e.model.glbKey),r?.state==="ready"){let a=fn(t,ep);return{kind:"model",rendererId:`housing:${e.model.glbKey}`,matrix:a,worldBounds:Et(a,r.bounds),primitives:r.primitives}}if(e.model.boundsMm){w.scene.standIn("housing:proxy",uc);let a=Ea(t,e.model.boundsMm);return{kind:"model",rendererId:"housing:proxy",matrix:a,worldBounds:Et(a,[0,0,0,1,1,1])}}}if(e.box?.boundsMm){let t=e.box.rgba||uc,r=qf(t);w.scene.standIn(r,t);let a=Ea(e.worldMatrix,e.box.boundsMm);return{kind:"box",rendererId:r,matrix:a,worldBounds:Et(a,[0,0,0,1,1,1])}}return null}function LM(e,t){let r=(a,s)=>{e.has(a)||e.set(a,[]),e.get(a).push({...s,hiddenLayers:[],explode:null})};for(let a of t){let s=`housing:${a.key}`,n=a.model?w.housingModels.get(a.model.glbKey):null;if(a.model&&!n&&rp(a.model.glbKey),n?.state==="ready"){r(`housing:${a.model.glbKey}`,{key:s,matrix:fn(a.matrix,ep)});continue}w.scene.standIn("housing:proxy",uc);let i=a.model?a.model.boundsMm:{minMm:[0,0,0],maxMm:[1,1,1]};r("housing:proxy",{key:s,matrix:Ea(a.matrix,i)})}}async function rp(e){w.housingModels.set(e,{state:"loading"});let t=Ae;try{let r=await la(new URL(`/api/catalog/models/${encodeURIComponent(e)}.glb`,location.href).toString(),{fetchCache:"force-cache"});if(!ge(t)||!w)return;let a=w.scene.asset(`housing:${e}`);a.housing=!0,a.setLodOverride(Ps);let s=[1/0,1/0,1/0,-1/0,-1/0,-1/0];for(let n of r.primitives){for(let i=0;i<3;i+=1)s[i]=Math.min(s[i],n.bounds[i]),s[i+3]=Math.max(s[i+3],n.bounds[i+3]);a.addPrimitive(n,{kind:"component",layerId:0,material:n.material,color:n.material.baseColor})}r.primitives.length&&a.setBoardBounds(s),w.housingModels.set(e,{state:"ready",bounds:s,primitives:r.primitives})}catch(r){console.warn("[prism-semantic-viewer] housing model failed",e,r),w&&w.housingModels.set(e,{state:"failed"})}w?.descriptor&&qr({relabel:!1})}function Jr(e){return w.worlds.get(e)??null}function ap(e){let t=w.harnessLit.get(e.harness),r=t?e.wires.map(a=>t.get(a)).find(Boolean):null;return r?{rgb:DM(r),mode:1}:e.collides.length?{rgb:FM,mode:0}:w.harnessPick?.key===e.harness?{rgb:OM,mode:0}:{rgb:Qb,mode:w.emphasisSets.length?2:0}}function DM(e){let t=/^#?([0-9a-f]{6})$/i.exec(String(e));if(!t)return Qb;let r=Number.parseInt(t[1],16);return[(r>>16&255)/255,(r>>8&255)/255,(r&255)/255]}function Xa(){return!w||!k.renderer||!sp()?null:k.renderer.occurrenceKeys[M.selectedOccurrence]??null}function sp(){return!!(M.selectedFeatureId||M.activeNetId||w?.boardSelected)}function np(e){if(k===e)return;let t=Ye;Ye=!0;try{ze()}finally{Ye=t}k=e,Ke()}function Ec(){ze(),k=Qa({key:""}),Ke()}function UM(e,t){let r=performance.now(),a=Math.max(0,e-ar),s=Math.min(.05,(e-ar)/1e3);ar=e,z.update(s),w.scene.resize(),ee={layerId:0,viewport:{x:0,y:0,width:L.width,height:L.height},matrix:z.matrix(L.width,L.height,!1),lod:Wb(L.height/Math.min(devicePixelRatio||1,2),!1)};let n=Yr(),i=new Map;for(let o of at()){let c=qM(o);o.scene.copperRealism!==Wr()&&ss(o),o.renderer.setInnerCopperMode(Db(!M.showBoard||WM(o),Tc(o).size>0)),o.renderer.dimCopper=n,_e(e,{},o);let l=o===k;i.set(o.renderer,{activeNetId:l?M.activeNetId:0,selectedFeatureId:l?M.selectedFeatureId:0,time:e/1e3,layerOffsets:c,visibleLayers:o.visible3dLayers,showBoard:M.showBoard,showComponents:M.showComponents,showPaste:!0,componentOpacity:1,boardOpacity:n?.34:1,isolateNet:M.isolateNet,compareMode:!1,compareOffsets:new Map,layerAlphas:null,visibleTileIds:o.visibleTileIds})}w.inputs=i,w.scene.setSelectedOccurrence(k.renderer&&sp()?k.renderer.occurrenceBase+M.selectedOccurrence:-1),Bk(e,i,n)&&(w.scene.render(ee,o=>i.get(o)||tp(o,e)),Wp(),vk()),fk(),xk(),sk(),w.timing.boardsDrawnAt==null&&Wf(w.placed)&&(w.timing.boardsDrawnAt=performance.now());for(let o of at())wp(e,o);pc(a,performance.now()-r),gc(e),Wa(t)}function ip(e){return{activeNetId:0,selectedFeatureId:0,time:e/1e3,visibleLayers:new Set,showBoard:!0,showComponents:!1,componentOpacity:1,boardOpacity:1,isolateNet:!1}}function GM(e,t){let r=performance.now();return w.scene.pick(ee,e,t,a=>w.inputs.get(a)||tp(a,r))}function zM(e){let t=typeof e.occurrenceKey=="string"&&e.occurrenceKey.startsWith("housing:")?e.occurrenceKey.slice(8):null;if(t){let s=t.lastIndexOf("/"),[n,i]=[t.slice(0,s),t.slice(s+1)],o=w.tubes.find(c=>c.harness===n&&(c.from===i||c.to===i));o?wr({key:n,segmentId:o.segmentId,pointMm:null}):ze();return}let r=e.occurrenceKey!=null?w.placements.get(e.occurrenceKey):null;if(!r)return ze();if(r.standIn||r.own)return Sc(r);let a=r.board;if(M.isolateNet&&!VM(a,r.occurrence.path,e.featureId))return ze();np(a),M.selectedOccurrence=a.renderer.occurrenceKeys.indexOf(r.occurrence.path),e.featureId&&!w.move.enabled?kr(e.featureId,!0):zc()}function KM(e){let t=e!=null?w?.placements.get(String(e)):null;return t?t.standIn||t.own?(Sc(t),"stand-in"):(np(t.board),M.selectedOccurrence=k.renderer.occurrenceKeys.indexOf(t.occurrence.path),"board"):null}function Sc(e){let t=Ye;Ye=!0;try{ze()}finally{Ye=t}w.standInKey=e.occurrence.path,w.move.enabled&&ts(),Ye||Za?.({kind:"board",sourceContext:"3D",occurrence:e.occurrence.path,standIn:e.standIn})}function VM(e,t,r){let a=Number(e.scene.features.get(Number(r))?.netId)||0;if(!a)return!1;let s=e.renderer.occurrenceKeys.indexOf(t);return s<0?!1:e.renderer.occurrenceEmphasis?.[s]?.has(a)?!0:e===k&&s===M.selectedOccurrence&&a===Number(M.activeNetId)}function lb(e,t){let r=w?.placements.get(String(t));return r?gr(e,r.matrix):null}function Tc(e=k){if(!w)return Hr();let t=new Set(e===k?Hr():[]);for(let r of e.renderer?.occurrenceEmphasis||[])if(r)for(let a of r.keys())t.add(Number(a));return t}function ri(e){let t=w.groups.get(e.key)||[],r=new Set;for(let a of e.scene.copperLayers){let s=Number(a.id);t.some(n=>!w.hiddenLayers.get(n.key)?.has(s))&&r.add(s)}if(M.isolateNet){let a=new Set;for(let s of Tc(e))for(let n of Pc(s,e))a.add(n);e.visible3dLayers=new Set([...r].filter(s=>a.has(s)))}else e.visible3dLayers=r;_e(performance.now(),{force:!0},e)}function Ac(e,t){let r=e??(w.groups.get(k.key)||[]).map(a=>a.key);for(let a of r){let s=new Set(w.hiddenLayers.get(String(a))||[]);t(s,w.placements.get(String(a))?.board),w.hiddenLayers.set(String(a),s)}for(let a of at()){let s=w.groups.get(a.key)||[];for(let n of s)n.hiddenLayers=[...w.hiddenLayers.get(n.key)||[]];a.renderer.setOccurrenceHiddenLayers(s.map(n=>n.hiddenLayers)),ri(a)}Ke(),Nt()}function HM(){let e=Xa();if(e==null||!M.activeNetId)return;let t=Pc(M.activeNetId,k);t.size&&Ac([e],r=>{r.clear();for(let a of k.scene.copperLayers)t.has(Number(a.id))||r.add(Number(a.id))})}function qM(e){if(e.scene.layerSteps)return e.scene.layerSteps;let t=new Float32Array(256),r=(e.scene.copperLayers.length-1)/2;return e.scene.copperLayers.forEach((a,s)=>{t[Number(a.id)]=r-s}),e.scene.layerSteps=t,t}function op(e,t){let r=e?.scene.runtimeBounds,a=r?Math.hypot((r[3]-r[0])*1e3,(r[4]-r[1])*1e3):0;return[t*t*be(a*.12,8,25)/1e3,t<.0999?1:0,1-t*.72,1]}function WM(e){return(w.groups.get(e.key)||[]).some(t=>(w.separation.get(t.key)||0)>.001)}function XM(e,t){let r=t!=null?[String(t)]:(w.groups.get(k.key)||[]).map(a=>a.key);for(let a of r)w.separation.set(a,e);for(let a of at()){let s=w.groups.get(a.key)||[];a.renderer.setOccurrenceExplode(s.map(n=>op(a,w.separation.get(n.key)||0)))}Nt()}function $M(){return w.placed.filter(e=>!e.own).map(e=>{let t=w.hiddenLayers.get(e.occurrence.path)||new Set,r=e.board;return{key:e.occurrence.path,name:e.occurrence.displayPath||e.occurrence.path,standIn:e.standIn||null,separation:w.separation.get(e.occurrence.path)||0,layers:r?r.scene.copperLayers.map(a=>({id:Number(a.id),name:String(a.name),color:ci(oi(a,r)),visible:!t.has(Number(a.id))})):[]}})}function YM(e){return w?(w.emphasisSets=e,cp()):null}function cp(){if(!w)return[];let e=new Map;for(let[n,i]of w.groups)e.set(n,i.map(()=>null));let t=new Map;for(let n of w.groups.values())n.forEach((i,o)=>t.set(i.key,o));w.emphasisBounds=new Map;let r=w.emphasisSets.map(n=>{let i={key:n.key,color:n.color,lit:0,unresolved:[]},o=[];w.emphasisBounds.set(n.key,o);for(let c of n.members){let l=w.placements.get(c.occurrence),f=l?.board;if(!f&&l?.own){i.lit+=1,l.worldBounds&&o.push({occurrence:c.occurrence,box:l.worldBounds});continue}if(!f){let m=l?l.standIn==="loading"||l.standIn==="building"?"loading":l.standIn==="restricted"?"restricted":"not-drawn":"not-drawn";i.unresolved.push({occurrence:c.occurrence,net:c.net,reason:m});continue}let d=or(f.scene.nets,c.net),p=Number(d?.id)||0;if(!p){i.unresolved.push({occurrence:c.occurrence,net:c.net,reason:"unknown-net"});continue}let b=e.get(f.key),h=t.get(c.occurrence);if(!b||h==null)continue;b[h]=b[h]||new Map,b[h].has(p)||b[h].set(p,n.mark),i.lit+=1;let u=ta(d.boundsMm);u&&o.push({occurrence:c.occurrence,box:Et(l.matrix,u)})}return i});w.harnessLit=af(w.harnesses,w.emphasisSets),w.harnessDrawn=null,w.scene.setTubeColors(ap);for(let n of r){n.wires=0;for(let i of w.harnessLit.values())for(let o of i.values())o===n.color&&(n.wires+=1)}let a=w.emphasisSets.length>0;for(let n of at())n.renderer.setOccurrenceEmphasis(a&&e.get(n.key)||null,{dimCopper:a});if(M.isolateNet)for(let n of at())ri(n);let s=JSON.stringify(r)!==JSON.stringify(w.emphasisReport);return w.emphasisReport=r,s&&w.onEmphasis?.(r),r}function JM(e=null,t=null){let r=[];for(let[s,n]of w?.emphasisBounds||[])if(!(e!=null&&s!==String(e)))for(let i of n)(t==null||i.occurrence===t)&&r.push(i.box);let a=Tr(r);return a?(z.frame(a),!0):!1}function QM(e){let t=[];for(let a of Array.isArray(e)?e:[]){let s=w?.placements.get(String(a?.occurrence));if(s&&!a?.reference){s.worldBounds&&t.push(s.worldBounds);continue}let n=s?.board?.scene.componentFeatures.get(String(a?.reference)),i=n?s.board.scene.features.get(Number(n.featureId))?.bounds:null;i&&t.push(Et(s.matrix,i))}let r=Tr(t);return r?(z.frame(r),!0):!1}var _c=.001,ZM=90,db=["#e5484d","#30a46c","#3e63dd"],sc=["X","Y","Z"];function lp(e,t){if(!e||!t)return!1;let r=Zt(e),a=Zt(t),s=[...r.translationMm,...r.rotation],n=[...a.translationMm,...a.rotation];return s.every((i,o)=>Math.abs(i-n[o])<1e-6)}function ek(){return{allowed:!1,enabled:!1,route:!1,space:"world",target:null,preview:null,drag:null,node:null}}function dp(){let e=w.baseDescriptor;return!e||!w.move.target||!w.move.preview?e:Ad(e,w.move.target,w.move.preview)}function es(){w.baseDescriptor&&(w.descriptor=dp(),qr({relabel:!1}))}function Ic(){let e=w.move.target;return e?w.baseDescriptor?.occurrences.find(t=>t.path===e)??null:null}function up(){let e=w.move,t=Ic();return{allowed:e.allowed,enabled:e.enabled,route:e.route,space:e.space,dragging:!!e.drag,target:t?{occurrence:t.path,instanceId:t.instanceId,displayPath:t.displayPath,kind:t.kind,restricted:!!t.restricted,pose:Zt(e.preview??t.pose),source:e.preview?"manual":t.pose?.source??"default",unsaved:!!e.preview}:null}}function vt(e){w.onMove?.({phase:e,...up()})}function tk(e){w.move.allowed=!!e,!w.move.allowed&&w.move.enabled&&Hn(!1)}function Hn(e,{route:t=!1}={}){let r=!!e&&w.move.allowed,a=r&&!!t;r===w.move.enabled&&a===w.move.route||(w.move.route=a,a&&fc(),r||(fc(),w.move.node&&(w.move.node=null,w.nodePreview&&(w.nodePreview=null,xt()),Ie("target"))),w.move.enabled=r,r&&ts({quiet:!0}),vt("mode"))}function fp(e){w.move.space=e==="local"?"local":"world",vt("mode")}function Rc(){return w.standInKey??Xa()}function ts({quiet:e=!1}={}){if(!w)return;let t=Rc(),r=w.move.enabled&&!w.move.route&&t!=null?Td(w.baseDescriptor,t):null,a=r&&r.move!==!1?r.path:null;a!==w.move.target&&(fc(),w.move.target=a,e||vt("target"))}function fc(){let e=!!w.move.preview;w.move.drag=null,w.move.preview=null,w.move.target=null,e&&es()}function rk(e){w?.move.target&&(w.move.preview=e?Zt(e):null,es(),vt("preview"))}function Nc(){!w||!w.move.preview&&!w.move.drag||(w.move.drag=null,w.move.preview=null,es(),vt("cancel"))}function ak(){let e=`${w.move.target}/`,t=Tr(w.placed.filter(r=>r.occurrence.path===w.move.target||r.occurrence.path.startsWith(e)).map(r=>r.worldBounds));return t?[0,1,2].map(r=>(t[r]+t[r+3])/2/_c):null}function sr(e){let t=ua(ee.matrix,ve(e,_c),ee.viewport);if(!t)return null;let r=L.getBoundingClientRect();return[t.x*r.width/L.width,t.y*r.height/L.height]}function sk(){let e=rt;if(!e)return;let t=w.move.enabled&&ee?ni():null,r=t?null:Ic(),a=r&&typeof r.move=="object"?r.move:null,s=a?w.move.preview??r.pose:null,n=t?t.worldMm:w.move.enabled&&r&&ee?a?.pivot==="origin"?[...s.translationMm]:ak():null,i=n?sr(n):null;if(!i){e.toggleAttribute("hidden",!0),w.gizmo=null;return}e.toggleAttribute("hidden",!1),e.firstChild||nk(e);let{right:o,back:c}=z.basis(),l=sr(Ne(n,o)),f=l?Math.hypot(l[0]-i[0],l[1]-i[1]):0;if(!(f>1e-6)){e.toggleAttribute("hidden",!0);return}let d=ZM/f,p=r?w.move.preview??r.pose:null,b=p&&(a||w.move.space==="local")?kd(p):Ui,h=[];b.forEach((m,g)=>{let y=sr(Ne(n,ve(m,d))),x=e.querySelector(`[data-part="t${g}"]`),v=y&&Math.hypot(y[0]-i[0],y[1]-i[1])>12&&(!a||(a.translate||[]).includes(g));if(x.style.display=v?"":"none",v){let I=x.querySelector("line");I.setAttribute("x1",i[0]),I.setAttribute("y1",i[1]),I.setAttribute("x2",y[0]),I.setAttribute("y2",y[1]),x.querySelector("circle").setAttribute("cx",y[0]),x.querySelector("circle").setAttribute("cy",y[1]),x.querySelector("text").setAttribute("x",y[0]+9),x.querySelector("text").setAttribute("y",y[1]-7)}let E=_d(m),S=Qe(m,E),T=[];for(let I=0;I<=64;I+=1){let N=I/64*Math.PI*2,C=sr(Ne(n,ve(Ne(ve(E,Math.cos(N)),ve(S,Math.sin(N))),d*.7)));C&&T.push(`${C[0].toFixed(1)},${C[1].toFixed(1)}`)}let _=e.querySelector(`[data-part="r${g}"]`);_.setAttribute("points",T.join(" ")),_.style.display=t||a&&!(a.rotate||[]).includes(g)?"none":"",h.push({axis:m,pxPerMm:y?[(y[0]-i[0])/d,(y[1]-i[1])/d]:[0,0]})});let u=e.querySelector('[data-part="pivot"]');u.setAttribute("cx",i[0]),u.setAttribute("cy",i[1]),w.gizmo={center:i,pivot:n,handles:h,back:c,limits:a}}function nk(e){let t="http://www.w3.org/2000/svg",r=(a,s)=>{let n=document.createElementNS(t,a);for(let[i,o]of Object.entries(s))n.setAttribute(i,o);return n};db.forEach((a,s)=>{let n=r("polyline",{"data-part":`r${s}`,class:"ring",stroke:a,fill:"none"}),i=r("title",{});i.textContent=`Rotate about ${sc[s]}`,n.append(i),e.append(n)}),db.forEach((a,s)=>{let n=r("g",{"data-part":`t${s}`,class:"arrow",stroke:a,fill:a}),i=r("title",{});i.textContent=`Move along ${sc[s]}`;let o=r("text",{stroke:"none"});o.textContent=sc[s],n.append(i,r("line",{}),r("circle",{r:6}),o),e.append(n)}),e.append(r("circle",{"data-part":"pivot",r:4,class:"pivot"})),e.append(r("text",{"data-part":"readout",class:"readout"})),e.addEventListener("pointerdown",ik),e.addEventListener("pointermove",ok),e.addEventListener("pointerup",ck),e.addEventListener("dblclick",a=>{!w?.move.node||w.move.node===rr||(a.preventDefault(),a.stopPropagation(),Ie("delete"))}),e.addEventListener("pointercancel",()=>hp())}function ik(e){let t=e.target.closest?.("[data-part]")?.dataset.part;if(!w||!t||!w.gizmo||!/^[tr][012]$/.test(t))return;e.preventDefault(),e.stopPropagation();let r=rt.getBoundingClientRect(),a=ni();if(a){if(t[0]!=="t")return;w.move.drag={kind:"node",handle:w.gizmo.handles[Number(t[1])],start:[e.clientX-r.left,e.clientY-r.top],startMm:a.worldMm,startPreview:w.nodePreview,matrix:Br(vr(),Jr),changed:!1};try{rt.setPointerCapture(e.pointerId)}catch{}return}let s=Ic(),n=w.gizmo.limits;if(!(n&&!((t[0]==="t"?n.translate:n.rotate)||[]).includes(Number(t[1])))){w.move.drag={kind:t[0]==="t"?"translate":"rotate",snapDeg:n?.rotateSnapDeg??null,handle:w.gizmo.handles[Number(t[1])],start:[e.clientX-r.left,e.clientY-r.top],startPose:Zt(w.move.preview??s.pose),hadPreview:!!w.move.preview,center:w.gizmo.center,pivot:w.gizmo.pivot,back:w.gizmo.back,changed:!1};try{rt.setPointerCapture(e.pointerId)}catch{}}}function ok(e){let t=w?.move.drag;if(!t)return;let r=rt.getBoundingClientRect(),a=[e.clientX-r.left,e.clientY-r.top],s=e.shiftKey;if(t.kind==="node"){let o=Cs(Gi([a[0]-t.start[0],a[1]-t.start[1]],t.handle.pxPerMm),s?dr.fineMm:dr.mm),c=Ne(t.startMm,ve(t.handle.axis,o));t.changed=t.changed||o!==0,w.nodePreview={harness:w.harnessPick.key,id:w.move.node,positionMm:t.matrix?wa(t.matrix,c):c},ub(`${o>=0?"+":""}${o.toFixed(s?1:0)} mm`,a),xt(),Ie("preview");return}let n,i;if(t.kind==="translate"){let o=Cs(Gi([a[0]-t.start[0],a[1]-t.start[1]],t.handle.pxPerMm),s?dr.fineMm:dr.mm);n=Ed(t.startPose,t.handle.axis,o),i=`${o>=0?"+":""}${o.toFixed(s?1:0)} mm`}else{let o=Md(t.handle.axis,t.back,vd(t.center,t.start,a))*180/Math.PI,c=Cs(o,t.snapDeg??(s?dr.fineDeg:dr.deg));n=Sd(t.startPose,t.handle.axis,c*Math.PI/180,t.pivot),i=`${c>=0?"+":""}${c.toFixed(0)}\xB0`}t.changed=t.changed||!lp(n,t.startPose),w.move.preview=Zt(n),ub(i,a),es(),vt("preview")}function ub(e,t){let r=rt.querySelector('[data-part="readout"]');r.textContent=e,r.setAttribute("x",t[0]+14),r.setAttribute("y",t[1]-10)}function ck(e){let t=w?.move.drag;if(t){if(rt.hasPointerCapture?.(e.pointerId)&&rt.releasePointerCapture(e.pointerId),w.move.drag=null,rt.querySelector('[data-part="readout"]').textContent="",t.kind==="node"){t.changed&&Ie("commit");return}t.changed?vt("commit"):t.hadPreview||Nc()}}function hp(){let e=w?.move.drag;return e?e.kind==="route"||e.kind==="handle"?(w.move.drag=null,e.changed&&(w.nodePreview=e.kind==="handle"?e.startPreview:null,xt(),Ie("cancel")),!0):(w.move.drag=null,e.kind==="node"?(rt.querySelector('[data-part="readout"]').textContent="",w.nodePreview=e.startPreview,xt(),Ie("cancel"),!0):(w.move.preview=e.hadPreview?e.startPose:null,rt.querySelector('[data-part="readout"]').textContent="",es(),vt("cancel"),!0)):!1}function lk(e,t){let r=w.move;if(t==="escape"){if(_t&&!_t.hidden)_t.hidden=!0;else if(!hp()){if(!yp())if(r.node)ii(null);else if(r.preview)Nc();else if(w.harnessPick)wr(null);else if(r.enabled)Hn(!1);else return!1}return!0}if(t==="m"&&r.allowed)Hn(!r.enabled);else if(t==="l"&&r.enabled)fp(r.space==="world"?"local":"world");else if(t==="enter"&&r.node&&w.nodePreview&&!r.drag)Ie("commit");else if(t==="enter"&&r.preview&&!r.drag)vt("commit");else if((t==="delete"||t==="backspace")&&r.node&&r.node!==rr&&!r.drag)Ie("delete");else if(e.key==="?")bp(!!_t?.hidden);else if(t==="a")z.frame(w.bounds||nr());else return!1;return!0}function bp(e){_t&&(_t.hidden=!e)}var Ka="http://www.w3.org/2000/svg";function dk(e){let t=e.occurrence?w.placements.get(e.occurrence):null;if(!t)return null;let r=e.reference&&t.board?t.board.scene.componentFeatures.get(e.reference):null,a=r?t.board.scene.features.get(Number(r.featureId))?.bounds:null;if(a)return Os(t.matrix,[0,1,2].map(n=>(a[n]+a[n+3])/2));let s=t.worldBounds;return s?[0,1,2].map(n=>(s[n]+s[n+3])/2):null}function uk(){let e=w.emphasisSets.length>0,t=[],r=[];for(let a of w.showHarnesses?w.harnesses:[]){let s=w.harnessLit.get(Tt(a)),n=nf(a,s),i=new Map(a.ends.map(c=>[c.id,dk(c)]));i.set("hub",a.ends.length>2?of([...i.values()]):null);let o=a.name||"Harness";for(let c of w.tubedHarnesses.has(Tt(a))?[]:rf(a)){let l=sf(c,s),f=document.createElementNS(Ka,"line");f.setAttribute("class",`segment${l?" lit":e?" dim":""}`),l&&Object.assign(f.style,{stroke:l,color:l});let d=document.createElementNS(Ka,"title");d.textContent=`${o}: ${c.wires.size} wire${c.wires.size===1?"":"s"}`,f.append(d),r.push(f),t.push({node:f,kind:"line",a:i.get(c.a),b:i.get(c.b)})}for(let c of a.ends){let l=n.get(c.id),f=document.createElementNS(Ka,"circle");f.setAttribute("class",`end${l?" lit":e?" dim":""}`),f.setAttribute("r",l?"6":"4"),l&&(f.style.fill=l),r.push(f),t.push({node:f,kind:"dot",a:i.get(c.id)})}}Un.replaceChildren(...r),w.harnessDrawn={items:t,matrix:null}}function fk(){if(!Un||!ee)return;w.harnessDrawn||uk();let e=w.harnessDrawn;Un.toggleAttribute("hidden",!e.items.length);let t=ee.matrix.join(",");if(e.matrix===t)return;e.matrix=t;let r=L.getBoundingClientRect(),a=r.width/Math.max(1,L.width),s=r.height/Math.max(1,L.height),n=i=>{let o=i?ua(ee.matrix,i,ee.viewport):null;return o?[o.x*a,o.y*s]:null};for(let i of e.items){let o=n(i.a),c=i.kind==="line"?n(i.b):null,l=i.kind==="line"?!!(o&&c):!!o;i.node.style.display=l?"":"none",l&&(i.kind==="line"?(i.node.setAttribute("x1",o[0].toFixed(1)),i.node.setAttribute("y1",o[1].toFixed(1)),i.node.setAttribute("x2",c[0].toFixed(1)),i.node.setAttribute("y2",c[1].toFixed(1))):(i.node.setAttribute("cx",o[0].toFixed(1)),i.node.setAttribute("cy",o[1].toFixed(1))))}}function Cc(e){let{right:t}=z.basis(),r=sr(e),a=sr(Ne(e,t));return r&&a?Math.hypot(a[0]-r[0],a[1]-r[1]):0}function Bc(e){if(!w?.tubes.length||!ee)return null;let t=L.getBoundingClientRect(),r=uf(w.tubes,[e.clientX-t.left,e.clientY-t.top],sr,Cc,w.move.route?10:5);return r?{tube:w.tubes[r.index],pointMm:r.pointMm}:null}function hk(e){let t=Bc(e);return t?(wr({key:t.tube.harness,segmentId:t.tube.segmentId,pointMm:t.pointMm}),!0):(wr(null),!1)}function bk(e){if(!w?.move.enabled||!w.move.route||e.button!==0||e.shiftKey)return!1;let t=Bc(e),r=t?w.harnesses.find(a=>Tt(a)===t.tube.harness):null;return!t||!ai(r)?!1:(wr({key:t.tube.harness,segmentId:t.tube.segmentId,pointMm:t.pointMm}),w.move.drag={kind:"route",start:[e.clientX,e.clientY],startMm:t.pointMm,nowMm:t.pointMm,pxPerMm:Cc(t.pointMm),basis:z.basis(),breakout:e.altKey,changed:!1,matrix:Br(r,Jr),capture:L,harness:r,segment:{from:t.tube.from,to:t.tube.to,samplesMm:t.tube.samplesMm}},L.setPointerCapture(e.pointerId),!0)}function pk(e,t){ii(t);let r=ni();if(r){w.move.drag={kind:"handle",start:[e.clientX,e.clientY],startMm:r.worldMm,nowMm:r.worldMm,pxPerMm:Cc(r.worldMm),basis:z.basis(),changed:!1,startPreview:w.nodePreview,matrix:Br(vr(),Jr),capture:zr};try{zr.setPointerCapture(e.pointerId)}catch{}}}function pp(e){let t=w?.move.drag;if(!t||t.kind!=="route"&&t.kind!=="handle")return!1;let r=[e.clientX,e.clientY];if(!t.changed&&!hf(t.start,r))return!0;t.changed=!0,t.nowMm=ff(t.startMm,r[0]-t.start[0],r[1]-t.start[1],t.pxPerMm,t.basis);let a=t.matrix?wa(t.matrix,t.nowMm):[...t.nowMm];return t.kind==="handle"?w.nodePreview={harness:w.harnessPick.key,id:w.move.node,positionMm:a}:w.nodePreview={harness:w.harnessPick.key,insert:lf(t.harness.nodes??[],{kind:t.breakout?"breakout":"waypoint",segment:t.segment,atMm:t.startMm,positionMm:a,toWorldMm:s=>t.matrix?go(t.matrix,s):s})},xt(),Ie("preview"),!0}function gp(e){let t=w?.move.drag;if(!t||t.kind!=="route"&&t.kind!=="handle")return!1;if(t.capture?.hasPointerCapture?.(e.pointerId)&&t.capture.releasePointerCapture(e.pointerId),w.move.drag=null,!t.changed)return!0;if(t.kind==="handle")return Ie("commit"),!0;let r=a=>t.matrix?wa(t.matrix,a):[...a];return Ie("route-drag",{atMm:r(t.startMm),positionMm:r(t.nowMm),breakout:t.breakout}),!0}function gk(e){if(!w)return!1;if(e==null)return wr(null),!0;let t=Tt({level:"",id:String(e)});if(w.harnessPick?.key===t)return!0;let r=w.tubes.find(s=>s.harness===t);if(!r)return!1;let a=Math.floor(r.samplesMm.length/6)*3;return wr({key:t,segmentId:r.segmentId,pointMm:r.samplesMm.slice(a,a+3)}),!0}function wr(e){if(!e&&!w.harnessPick)return;e&&(ze(),ts({quiet:!0}));let t=e&&w.harnessPick?.key===e.key;w.harnessPick=e,t||(w.move.node=null,w.nodePreview=null),xt(),Ie("select")}function vr(){let e=w?.harnessPick;return e?w.harnesses.find(t=>Tt(t)===e.key)??null:null}function ai(e){return!!e&&!e.level&&w.move.allowed}function si(){let e=vr();if(!e)return[];let t=mo([e],w.nodePreview,Tt)[0],r=w.tubes.filter(a=>a.harness===w.harnessPick.key);return df(t,r,Br(e,Jr)??[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1])}function ni(){return w.move.node?si().find(e=>e.id===w.move.node)??null:null}function mp(){let e=vr();if(!e)return{harness:null,segment:null,pointMm:null,autoMm:null,node:null,editable:!1};let t=Br(e,Jr),r=f=>t?wa(t,f):[...f],a=w.harnessPick,s=w.tubes.find(f=>f.harness===a.key&&f.segmentId===a.segmentId),n=[];for(let f=0;s&&f+2<s.samplesMm.length;f+=3)n.push(r(s.samplesMm.slice(f,f+3)));let o=si().find(f=>f.auto),c=ni(),l=!!(c&&w.nodePreview?.id===c.id);return{harness:{id:e.id,level:e.level??null,name:e.name||""},segment:s?{id:s.segmentId,from:s.from,to:s.to,samplesMm:n}:null,pointMm:a.pointMm?r(a.pointMm):null,autoMm:o?r(o.worldMm):null,node:c?{id:c.id,kind:c.kind,auto:!!c.auto,pinned:c.pinned,positionMm:l?[...w.nodePreview.positionMm]:r(c.worldMm),unsaved:l}:null,editable:ai(e)}}function Ie(e,t={}){w.onHarness?.({phase:e,...mp(),...t})}function ii(e){if(!w)return;let t=e&&ai(vr())&&w.move.enabled?String(e):null;t!==w.move.node&&(w.move.node=t,w.move.drag=null,w.nodePreview&&w.nodePreview.id!==t&&(w.nodePreview=null,xt()),Ie("target"))}function mk(e){!w?.move.node||!w.harnessPick||(w.nodePreview=e?{harness:w.harnessPick.key,id:w.move.node,positionMm:[...e]}:null,xt(),Ie("preview"))}function yp(){return w?.nodePreview?(w.nodePreview=null,w.move.drag=null,xt(),Ie("cancel"),!0):!1}function yk(){if(!vr()){w.harnessPick&&(w.harnessPick=null,w.move.node=null,w.nodePreview=null,Ie("select"));return}w.move.drag||(w.nodePreview=null),w.move.node&&!si().some(a=>a.id===w.move.node)&&(w.move.node=null);let t=w.harnessPick,r=w.tubes.filter(a=>a.harness===t.key);if(t.pointMm&&r.length&&!r.some(a=>a.segmentId===t.segmentId)){let a=s=>{let n=1/0;for(let i=0;i+2<s.samplesMm.length;i+=3)n=Math.min(n,Math.hypot(s.samplesMm[i]-t.pointMm[0],s.samplesMm[i+1]-t.pointMm[1],s.samplesMm[i+2]-t.pointMm[2]));return n};t.segmentId=r.reduce((s,n)=>a(n)<a(s)?n:s).segmentId}Ie("sync")}function xk(){let e=zr;if(!e)return;let t=w.move.enabled&&ee?vr():null,r=ai(t)?si():[];if(e.toggleAttribute("hidden",!r.length),!r.length){e.firstChild&&e.replaceChildren();return}let a=new Map([...e.children].map(n=>[n.dataset.node,n])),s=new Set;for(let n of r){let i=sr(n.worldMm),o=a.get(n.id);if(!o){o=document.createElementNS(Ka,"circle"),o.dataset.node=n.id;let c=document.createElementNS(Ka,"title");o.append(c),o.addEventListener("pointerdown",l=>{l.preventDefault(),l.stopPropagation(),pk(l,o.dataset.node)}),o.addEventListener("dblclick",l=>{l.preventDefault(),l.stopPropagation(),ii(o.dataset.node),w.move.node&&w.move.node!==rr&&Ie("delete")}),e.append(o)}s.add(n.id),o.setAttribute("class",`node ${n.kind}${n.auto?" auto":""}${n.pinned?" pinned":""}${n.id===w.move.node?" target":""}`),o.setAttribute("r",n.kind==="breakout"?"7":"5.5"),o.querySelector("title").textContent=n.auto?"Automatic breakout: drag to place it":n.kind==="breakout"?"Breakout":n.pinned?"Pinned waypoint":"Waypoint",o.style.display=i?"":"none",i&&(o.setAttribute("cx",i[0].toFixed(1)),o.setAttribute("cy",i[1].toFixed(1)))}for(let[n,i]of a)s.has(n)||i.remove()}function wk(){yr&&(w.labelsDrawn=null,yr.replaceChildren(...w.placed.map(e=>{let t=document.createElement("div");t.className=`scene-label${e.standIn?` stand-in ${e.standIn}`:""}`;let r=document.createElement("strong");r.textContent=e.occurrence.displayPath||e.occurrence.labels?.join(" / ")||e.occurrence.path,t.append(r);let a=e.standIn?un[e.standIn]?.label:"";if(a){let s=document.createElement("span");s.textContent=a,t.append(s)}return e.label=t,t})))}function vk(){if(!yr||!ee)return;if(yr.hidden=!w.showLabels,!w.showLabels){w.labelsDrawn=null;return}let e=L.getBoundingClientRect(),t=Rc(),r=`${t}|${e.width}x${e.height}|${Array.prototype.join.call(ee.matrix,",")}`;if(w.labelsDrawn?.placed===w.placed&&w.labelsDrawn.key===r)return;w.labelsDrawn={placed:w.placed,key:r};let a=e.width/Math.max(1,L.width),s=e.height/Math.max(1,L.height);for(let n of w.placed){if(!n.label)continue;let[i,o,,c,l,f]=n.worldBounds,d=ua(ee.matrix,[(i+c)/2,(o+l)/2,f],ee.viewport),p=d&&d.x>=0&&d.y>=0&&d.x<=L.width&&d.y<=L.height;n.label.hidden=!p,p&&(n.label.style.transform=`translate(${(d.x*a).toFixed(1)}px, ${(d.y*s).toFixed(1)}px) translate(-50%, -100%)`),n.label.classList.toggle("selected",t===n.occurrence.path)}}function Mk(e,t=k){return $c(e,t.scene.copperLayers)}async function xp(e=Ae,t=k){let r=t.semanticGeometry.assets?.components_glb;if(!r||t.scene.componentTier!=="idle")return;t.scene.componentTier="loading";let a;try{a=await yd(new URL(r,location.href).toString(),{componentFeatures:t.scene.componentFeatures,fetchBytes:$a(t)})}catch(i){throw ge(e)&&(t.scene.componentTier="idle"),i}if(!ge(e)||!t.renderer)return;let s=pl(a.models);if(await Lb([...s.instanced.map(i=>i.primitive),...s.baked].reduce((i,o)=>i+oc(o),0)),!ge(e)||!t.renderer)return;t.scene.componentTier="loaded",t.loadedBytes+=a.byteLength;for(let i of a.models)for(let o of i.placements){let c=t.scene.componentFeatures.get(o.designator);c&&Sk(c.featureId,o.bounds,t)}w&&(w.harnessDrawn=null,w.labelsDrawn=null);for(let[i,o]of a.componentNodeCounts||[])t.scene.componentModelCounts.set(i,o);t.hiddenComponentRequest&&Dp(t.hiddenComponentRequest);let n=i=>({kind:"component",layerId:0,material:i.material,color:i.material.baseColor});t.scene.componentEntries=[...t.renderer.addInstancedPrimitives(s.instanced.map(i=>({primitive:i.primitive,placements:i.placements,metadata:n(i.primitive)}))),...s.baked.map(i=>t.renderer.addPrimitive(i,n(i)))]}function $a(e=k){return e.assetCache?t=>e.assetCache.fetchBytes(t):void 0}function wp(e,t=k){if(!t.renderer||e-(t.tiersCheckedAt||0)<250)return;t.tiersCheckedAt=e;let r=t.renderer.cullCounts,a=mM()&&r.board+r.body>0,s=t.renderer.identityOnly&&!t.deferComponents||!t.renderer.identityOnly&&(r.full>0||a);s&&(t.scene.componentsWantedAt=e),s&&t.scene.componentTier==="idle"&&t.semanticGeometry.assets?.components_glb&&xp(Ae,t).then(()=>{w&&t.renderer&&t.scene.componentTier==="loaded"&&hc(t.scene.runtimeBounds,t)}).catch(i=>console.warn("Failed to load components",i));let n=()=>w?w.scene.gpuMemoryBytes():t.renderer.gpuMemoryBytes();t.gpuBytes=n(),!(t.gpuBytes<=M.gpuBudgetBytes)&&(t.scene.componentTier==="loaded"&&e-t.scene.componentsWantedAt>iM&&(t.renderer.removeEntries(t.scene.componentEntries),t.scene.componentEntries=[],t.scene.componentTier="idle",t.scene.componentEvictions+=1,t.gpuBytes=n()),t.gpuBytes>M.gpuBudgetBytes&&Kb(t.visibleTileIds||new Set,Math.max(0,t.residentTileGpuBytes-(t.gpuBytes-M.gpuBudgetBytes)),t))}var fb=4e-4,hb=5e-5,kk={baseColor:[.62,.7,.8,1],metallic:0,roughness:.8,emissive:[0,0,0]};function hc(e,t=k){if(!t.renderer)return;let r=new Map;for(let i of t.topology.physical_objects||[])i.kind==="footprint_body"&&i.designator&&i.bbox_mm?.length===4&&r.set(i.designator,i);let a=(e?.[5]??8e-4)+hb,s=(e?.[2]??-8e-4)-hb,n=[];for(let i of t.scene.componentFeatures.values()){let o=Number(i.featureId),c=t.scene.features.get(o),l=r.get(i.designator);if(!c||c.bounds||!l)continue;let[f,d,p,b]=l.bbox_mm.map(Number),h=String(l.layer||"").startsWith("B."),u=[f/1e3,-b/1e3,h?s-fb:a,p/1e3,-d/1e3,h?s:a+fb];c.bounds=u,c.placeholder=!0,n.push(Ek(u,o))}if(n.length)for(let i of ea(n))t.renderer.addPrimitive(i,{kind:"component",layerId:0,material:i.material,color:i.material.baseColor,opacityScale:.3,translucent:!0,placeholder:!0})}function Ek([e,t,r,a,s,n],i){let o=[[[0,0,1],[[e,t,n],[a,t,n],[a,s,n],[e,s,n]]],[[0,0,-1],[[e,s,r],[a,s,r],[a,t,r],[e,t,r]]],[[1,0,0],[[a,t,r],[a,s,r],[a,s,n],[a,t,n]]],[[-1,0,0],[[e,s,r],[e,t,r],[e,t,n],[e,s,n]]],[[0,1,0],[[a,s,r],[e,s,r],[e,s,n],[a,s,n]]],[[0,-1,0],[[e,t,r],[a,t,r],[a,t,n],[e,t,n]]]],c=new Float32Array(72),l=new Float32Array(72),f=new Uint32Array(36);return o.forEach(([d,p],b)=>{p.forEach((u,m)=>{c.set(u,(b*4+m)*3),l.set(d,(b*4+m)*3)});let h=b*4;f.set([h,h+1,h+2,h,h+2,h+3],b*6)}),{position:c,normal:l,netId:new Uint32Array(24),objectFeatureId:new Uint32Array(24).fill(i),indices:f,material:kk,bounds:[e,t,r,a,s,n]}}function Sk(e,t,r=k){let a=r.scene.features.get(Number(e));if(!a||!t.length)return;let s=[1/0,1/0,1/0,-1/0,-1/0,-1/0];for(let n=0;n<t.length;n+=3)s[0]=Math.min(s[0],t[n]),s[1]=Math.min(s[1],t[n+1]),s[2]=Math.min(s[2],t[n+2]),s[3]=Math.max(s[3],t[n]),s[4]=Math.max(s[4],t[n+1]),s[5]=Math.max(s[5],t[n+2]);a.bounds=a.bounds?[Math.min(a.bounds[0],s[0]),Math.min(a.bounds[1],s[1]),Math.min(a.bounds[2],s[2]),Math.max(a.bounds[3],s[3]),Math.max(a.bounds[4],s[4]),Math.max(a.bounds[5],s[5])]:s}function oi(e,t=k){return Hc(e,t.scene.copperLayers)}var Tk=[.55,.35,.16,.78];function vp(e=k){return Wc(e.topology?.board?.stackup?.copper_finish)}function Mp(e,t=k){return Xc(e,t.scene.copperLayers)}var Ak=.25;function Wr(){return!M.realisticColors||M.mode==="layer"||!M.showBoard?0:1-be(M.separation/Ak,0,1)}function Ya(e,t=k){let r=Mp(e,t)?vp(t):Zr.copper;return kp(oi(e,t),r,Wr())}function kp(e,t,r){return e.map((a,s)=>a+(t[s]-a)*r)}function _k(e,t=Ae){if(t===Ae&&w&&z){UM(e,t);return}if(t!==Ae||!k.renderer||!z)return;let r=performance.now(),a=Math.max(0,e-ar);if(M.workspace==="schematic"&&O){ar=e;let l=O.visiblePages(),f=re?Fk(l):[];O.setDomDetailPageIds(f.map(d=>d.id)),G.visiblePages=O.render(),re?.syncWorldPages(f,O,{activeNetUid:G.activeNetUid}),$p(),pc(a,performance.now()-r),gc(e),Wa(t);return}let s=Math.min(.05,(e-ar)/1e3);ar=e,z.update(s),k.renderer.resize();let n=Wn();k.scene.copperRealism!==Wr()&&ss();for(let l of k.renderer.entries)l.layerOffset=n[l.layerId]||0;Pk(e),xr=Ap(e);let i=Lk(e);ee={layerId:0,viewport:{x:0,y:0,width:L.width,height:L.height},matrix:z.matrix(L.width,L.height,M.mode==="layer"),lod:Wb(L.height,M.mode==="layer")},k.renderer.selectedOccurrence=M.selectedFeatureId||M.activeNetId?M.selectedOccurrence:-1,k.renderer.setInnerCopperMode(Db(!M.showBoard||M.separation>.001,Hr().size>0)),_e(e);let o=M.mode==="3d"?k.visible3dLayers:Ub(),c={panels:[ee],activeNetId:M.activeNetId,selectedFeatureId:M.selectedFeatureId,time:e/1e3,layerOffsets:n,visibleLayers:o,showBoard:M.showBoard,showComponents:M.showComponents,showPaste:M.separation===0,componentOpacity:be(1-M.separation/.1,0,1),boardOpacity:Hr().size?.34:1-M.separation*.72,isolateNet:M.isolateNet,compareMode:M.mode==="layer",compareOffsets:xr,layerAlphas:i,visibleTileIds:M.mode==="3d"?k.visibleTileIds:null};if(Kr=c,Nk(e,c)){k.renderer.render(c),Wp(),lE();for(let l of qn)l()}wp(e),pc(a,performance.now()-r),gc(e),Wa(t)}var Ep=1e3,mt={key:"",matrix:new Float32Array(16),tiles:null,at:0},Kr=null,ce={canvas:null,context:null,depth:null,depthView:null,width:0,height:0},Ja=new hn(3e3),qn=new Set,Bn={frames:0,cpuMs:0,gpuMs:0,lastTriangles:0},bc={cullTiles:!0};function Ik(e,t){let r=k.renderer;ce.canvas||(ce.canvas=document.createElement("canvas"),ce.context=ce.canvas.getContext("webgpu")),!(ce.width>=e&&ce.height>=t&&ce.depth)&&(ce.width=Math.max(ce.width,e),ce.height=Math.max(ce.height,t),ce.canvas.width=ce.width,ce.canvas.height=ce.height,ce.context.configure({device:r.device,format:r.format,alphaMode:"opaque"}),ce.depth?.destroy(),ce.depth=r.device.createTexture({label:"inset-depth",size:[ce.width,ce.height],format:r.depthFormat,sampleCount:r.sampleCount,usage:GPUTextureUsage.RENDER_ATTACHMENT}),ce.depthView=ce.depth.createView())}function Sp(){return!!(!w&&k.renderer&&Kr&&M.workspace==="pcb")}function Rk(e,t,r="inset"){if(!Sp())return!1;let a=e.clientWidth,s=e.clientHeight;if(!a||!s)return!1;let n=performance.now(),i=Math.min(devicePixelRatio||1,2),o=Math.round(a*i),c=Math.round(s*i);Ik(o,c);let l=Ct(k.scene.runtimeBounds),f=_o(t,a,s,l,t.focusZ??0);Ja.record(r,f,n);let d={layerId:0,viewport:{x:0,y:0,width:o,height:c},matrix:f,lod:Kr.panels[0].lod},p=Kr.visibleTileIds;if(p&&bc.cullTiles){let u=new Set;for(let m of p){let g=k.scene.tiles.get(m);g&&Vn(g,f,null,0,k)&&u.add(m)}p=u}let b=k.renderer.renderInto({colorView:ce.context.getCurrentTexture().createView(),depthView:ce.depthView,width:ce.width,height:ce.height},d,{...Kr,panels:[d],visibleTileIds:p});return e.width!==o&&(e.width=o),e.height!==c&&(e.height=c),e.getContext("2d").drawImage(ce.canvas,0,0,o,c,0,0,o,c),Bn.frames+=1,Bn.cpuMs+=performance.now()-n,Bn.lastTriangles=b.triangles,!0}function Nk(e,t){let r=t.panels[0].matrix,a=!1;for(let o=0;o<16;o+=1)if(r[o]!==mt.matrix[o]){a=!0;break}if(a)return mt.matrix.set(r),mt.key="",mt.at=e,!0;let s=[L.width,L.height,k.renderer.version,k.renderer.selectedOccurrence,M.workspace,M.mode,t.activeNetId,t.selectedFeatureId,t.showBoard,t.showComponents,t.showPaste,t.componentOpacity,t.boardOpacity,t.isolateNet,k.scene.layerZOffsetSignature,[...t.visibleLayers].join(","),[...t.compareOffsets].map(([o,c])=>`${o}:${c}`).join(";"),t.layerAlphas?[...t.layerAlphas].join(";"):""].join("|");return!!(t.activeNetId||t.selectedFeatureId||k.renderer.emphasizedNetIds.size)||s!==mt.key||!Tp(t.visibleTileIds,mt.tiles)||e-mt.at>Ep?(mt.key=s,mt.tiles=t.visibleTileIds,mt.at=e,!0):!1}var Ck=1e3/30-2,$e={scene:null,key:"",matrix:new Float32Array(16),tiles:new Map,at:0};function Bk(e,t,r){let a=ee.matrix,s=!1;for(let p=0;p<16;p+=1)if(a[p]!==$e.matrix[p]){s=!0;break}if($e.scene!==w.scene&&($e.scene=w.scene,s=!0),s)return $e.matrix.set(a),$e.key="",$e.at=e,!0;let n=[L.width,L.height,M.showBoard,M.showComponents,M.isolateNet,M.activeNetId,M.selectedFeatureId,M.selectedOccurrence,w.showLabels,r,Wr(),Rc(),w.scene.tubeVersion];for(let p of w.scene.renderers){let b=t.get(p);n.push(p.version,p.occurrenceCount,p.selectedOccurrence,p.dimCopper,p.standIn?p.boxColor.join(","):"",b?[...b.visibleLayers].join(","):"",b?.layerOffsets?Array.prototype.join.call(b.layerOffsets,","):"")}let i=n.join("|"),o=!1;for(let[p,b]of t)Tp(b.visibleTileIds,$e.tiles.get(p))||(o=!0);let c=!!(r||M.activeNetId||M.selectedFeatureId),l=o||i!==$e.key,f=c&&e-$e.at>=Ck;return l||f||e-$e.at>Ep?($e.key=i,$e.tiles=new Map([...t].map(([p,b])=>[p,b.visibleTileIds])),$e.at=e,!0):!1}function Tp(e,t){if(!e||!t)return e===t;if(e.size!==t.size)return!1;for(let r of e)if(!t.has(r))return!1;return!0}function Ok(e){if(!O||!e)return{widthPx:0,heightPx:0,sourcePxPerMm:0,area:0};let t=O.pagePixelWidth(e),r=e.heightMm/Math.max(1e-6,O.scale),a=O.pageSourcePixelsPerMm(e);return{widthPx:t,heightPx:r,sourcePxPerMm:a,area:t*r}}function Fk(e){if(!re||!O)return[];let t=e||[],r=Math.max(1,Ge.clientWidth*Ge.clientHeight);return t.map(n=>({page:n,...Ok(n)})).filter(n=>n.widthPx>=760&&n.heightPx>=520&&n.area>=r*.36&&n.sourcePxPerMm>=1.25).sort((n,i)=>i.area-n.area).slice(0,1).map(n=>n.page)}function Wn(e=k){let t=nr(e),r=Math.hypot((t[3]-t[0])*1e3,(t[4]-t[1])*1e3),a=M.separation*M.separation*be(r*.12,8,25)/1e3,s=`${M.separation}:${a}:${e.scene.copperLayers.length}`;if(e.scene.layerZOffsetSignature===s)return e.scene.layerZOffsets;let n=e.scene.layerZOffsets;n.fill(0);let i=(e.scene.copperLayers.length-1)/2;return e.scene.copperLayers.forEach((o,c)=>{n[Number(o.id)]=(i-c)*a}),e.scene.layerZOffsetSignature=s,n}function Ap(e){if(M.mode!=="layer")return Fe.key="3d",Fe.current.clear(),new Map;let t=k.scene.copperLayers.filter(m=>k.compareLayers.has(Number(m.id))),r=Math.max(1,t.length),a=L.width/Math.max(1,L.height),s=1;r===2?s=a>=1?2:1:r===3||r===4?s=2:r>4&&(s=Math.ceil(Math.sqrt(r*a)));let n=Math.ceil(r/s),i=nr(),o=i[3]-i[0],c=i[4]-i[1],l=o*1.18,f=c*1.22,d=t.map((m,g)=>{let y=g%s,x=Math.floor(g/s);return{layer:m,layerId:Number(m.id),column:y,row:x,offset:[(y-(s-1)/2)*l,((n-1)/2-x)*f,0]}}),p=`${s}x${n}:${d.map(m=>m.layerId).join(",")}`;if(p!==Fe.key){Fe.key=p,Fe.started=e,Fe.from=new Map(Fe.current);let m=s*o+(s-1)*(l-o),g=n*c+(n-1)*(f-c);z.targetFocus=[(i[0]+i[3])/2,(i[1]+i[4])/2,(i[2]+i[5])/2],z.targetOrthoScale=Math.max(g,m/a)*1.08}let b=be((e-Fe.started)/420,0,1),h=1-Math.pow(1-b,3),u=new Map;for(let m of d){let g=Fe.from.get(m.layerId)||[0,0,0],y=m.offset.map((x,v)=>g[v]+(x-g[v])*h);u.set(m.layerId,y),Fe.current.set(m.layerId,y)}if($.phase==="reveal")for(let m of $.previous)u.has(Number(m))||u.set(Number(m),$.previousOffsets.get(Number(m))||[0,0,0]);for(let m of[...Fe.current.keys()])d.some(g=>g.layerId===m)||Fe.current.delete(m);return u}function rs(e){let t=new Set([...e].map(Number));if(!(bb(t,k.desiredCompareLayers)&&$.phase!=="idle")){if(k.desiredCompareLayers=t,bb(t,k.compareLayers)){$.phase="idle",$.previous.clear(),$.target.clear();return}$.phase="preload",$.previous=new Set(k.compareLayers),$.target=new Set(t),$.previousOffsets=new Map(Fe.current),$.started=performance.now(),_e($.started,{force:!0})}}function Oc({snap:e=!0}={}){M.mode="layer";let t=SM();k.desiredCompareLayers=new Set(t),!k.compareLayers.size&&t.size&&(k.compareLayers=new Set(t)),$.phase="idle",$.previous.clear(),$.target.clear(),Fe.key="",z.setAxis("z",!1),k.renderer?.resize(),xr=Ap(performance.now()),e&&z.snap(),_e(performance.now(),{force:!0})}function Pk(e){if(!(M.mode!=="layer"||$.phase==="idle")){if($.phase==="preload"){if(!jk($.target)){_e(e,{force:!0});return}$.phase="reveal",$.started=e,$.previousOffsets=new Map(Fe.current),k.compareLayers=new Set($.target),Fe.key="";return}$.phase==="reveal"&&e-$.started>=wb&&(k.compareLayers=new Set($.target),$.phase="idle",$.previous.clear(),$.target.clear(),$.previousOffsets.clear(),_e(e,{force:!0}))}}function jk(e,t=k){for(let r of t.scene.tiles.values())if(e.has(Number(r.layerId))&&!t.scene.residentTiles.has(r.id)&&!t.scene.failed.has(r.id))return!1;return!0}function Lk(e){if(M.mode!=="layer"||$.phase!=="reveal")return null;let t=be((e-$.started)/wb,0,1),r=t*t*(3-2*t),a=new Map;for(let s of $.previous)a.set(Number(s),$.target.has(Number(s))?1:1-r);for(let s of $.target)a.set(Number(s),$.previous.has(Number(s))?1:r);return a}function bb(e,t){if(e.size!==t.size)return!1;for(let r of e)if(!t.has(r))return!1;return!0}function Fc(){if(M.workspace==="schematic"){Uk();return}if(M.workspace==="bom"){Dk();return}if(M.workspace==="stackup")return;Yn.textContent=k.viewerReadiness.stage==="semantic-ready"?"Semantic GLTF A0":"Prism staged 3D",Jn.textContent="Layers",Qn.textContent="Visibility and compare",Z('[data-panel="search"] .section-heading span').textContent="Nets, components and pins",Z('[data-panel="view"] .section-heading span').textContent="Camera and stackup";let e=`
    <div class="mode-toolbar">
      <button data-mode="layer">PCB</button>
      <button data-mode="3d">3D</button>
    </div>`;Gr&&(Gr.innerHTML=e),dt.innerHTML=`
    ${Gr?"":e}
    <div class="layer-presets">
      <button data-preset="all">All</button><button data-preset="none">None</button>
      <button data-preset="outer">Outer</button><button data-preset="inner">Inner</button>
    </div>
    <div class="layer-list"></div>`,Te.innerHTML=`
    <label class="control-field"><span>Search</span>
      <input id="entity-search" class="layer-select" type="search" placeholder="Net, component or pin">
      <div id="search-results" class="search-results"></div>
    </label>
    <div class="quick-actions">
      <button id="frame-selection">Frame</button>
      <button id="show-net-layers">Net layers</button>
      <button id="isolate-net" aria-keyshortcuts="I" title="Toggle isolated net view (I)">Isolate</button>
      <button id="clear-selection">Clear</button>
    </div>`,We.innerHTML=`
    <div class="toggle-list">
      <label class="toggle-row"><input id="show-board" type="checkbox"><span>Board substrate</span></label>
      <label class="toggle-row"><input id="show-components" type="checkbox"><span>Components</span></label>
    </div>
    <label class="control-field range-field"><span>Stackup separation</span>
      <input id="separation" type="range" min="0" max="1" step="0.002">
    </label>`,Ke(),Yk()}function Dk(){Yn.textContent="BoM A0",Jn.textContent="Bill of Materials",Qn.textContent="Grouped procurement view",Z('[data-panel="search"] .section-heading span').textContent="Search inside the BoM table",Z('[data-panel="view"] .section-heading span').textContent="BoM actions";let e=ut?.payload?.counts||{};dt.innerHTML=`
    <div class="selection-properties">
      <div class="selection-property"><small>Rows</small><strong>${e.rows||0}</strong></div>
      <div class="selection-property"><small>Components</small><strong>${e.components||0}</strong></div>
      <div class="selection-property"><small>DNP</small><strong>${e.dnpComponents||0}</strong></div>
    </div>
    <div class="selection-section">
      <span class="selection-section-title">Columns</span>
      <div class="selection-empty">Primary procurement and thermal columns are shown first. Additional symbol and footprint metadata is available in the row detail panel.</div>
    </div>`,Te.innerHTML=`
    <div class="selection-empty">Use the BoM search box in the main view. Reference chips update the shared PCB and schematic selection without changing workspaces.</div>
    <div class="quick-actions">
      <button id="clear-selection">Clear</button>
    </div>`,We.innerHTML=`
    <div class="selection-section">
      <span class="selection-section-title">Cross-probing</span>
      <div class="selection-table">
        <div class="selection-row"><span><strong>PCB/Schematic</strong></span><span>Select component</span><span>Highlights matching BoM row</span></div>
        <div class="selection-row"><span><strong>BoM reference</strong></span><span>Click chip</span><span>Holds component selection for PCB and schematic</span></div>
      </div>
    </div>`,Te.querySelector("#clear-selection")?.addEventListener("click",ze)}function Uk(){Yn.textContent=re?"Schematic SVG DOM":G.manifest?.schema==="prism.schematic_vector_a0"?"Schematic Vector A0":"Schematic World A0",Jn.textContent="Pages",Qn.textContent=`${G.pages.length} hierarchy instances`,Z('[data-panel="search"] .section-heading span').textContent="Pages, nets and components",Z('[data-panel="view"] .section-heading span').textContent="World navigation",dt.innerHTML=`
    <div class="layer-presets">
      <button data-page-action="world">Fit world</button>
      <button data-page-action="parent">Parent</button>
      <button data-page-action="previous">Previous</button>
      <button data-page-action="next">Next</button>
    </div>
    <div class="page-list">${G.pages.map(e=>`
      <button class="page-row ${e.id===M.selectedPageId?"active":""}" data-page="${e.id}">
        <span>${e.sheetNumber}</span>
        <strong>${H(e.name)}</strong>
        <small>L${e.depth}</small>
      </button>`).join("")}</div>`,Te.innerHTML=`
    <label class="control-field"><span>Search</span>
      <input id="entity-search" class="layer-select" type="search" placeholder="Page, net or component">
      <div id="search-results" class="search-results"></div>
    </label>
    <div class="quick-actions">
      <button id="frame-selection">Frame</button>
      <button id="clear-selection">Clear</button>
    </div>`,We.innerHTML=`
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
    </div>`,dt.querySelectorAll("[data-page]").forEach(e=>{e.addEventListener("click",()=>Rt(e.dataset.page,!0))}),dt.querySelectorAll("[data-page-action]").forEach(e=>{e.addEventListener("click",()=>On(e.dataset.pageAction))}),Te.querySelector("#entity-search").addEventListener("input",e=>{zk(e.target.value)}),Te.querySelector("#frame-selection").addEventListener("click",Rp),Te.querySelector("#clear-selection").addEventListener("click",as),We.querySelector("#show-hierarchy").checked=O?.showHierarchy??!0,We.querySelector("#show-hierarchy").addEventListener("change",e=>{O.showHierarchy=e.target.checked})}function Rt(e,t){let r=G.byId.get(e);!r||!O||(M.selectedPageId=r.id,M.selectedSchematicFeature=null,O.selectedPageId=r.id,O.selectedFeatureId=0,wt.textContent=JSON.stringify(r,null,2),t&&O.framePage(r),dt.querySelectorAll("[data-page]").forEach(a=>{a.classList.toggle("active",a.dataset.page===r.id)}))}function On(e){if(!O)return;if(e==="world"){O.frameWorld();return}let t=Math.max(0,G.pages.findIndex(a=>a.id===M.selectedPageId)),r=null;e==="previous"?r=G.pages[(t-1+G.pages.length)%G.pages.length]:e==="next"?r=G.pages[(t+1)%G.pages.length]:e==="parent"&&(r=G.byId.get(G.pages[t]?.parentId)),r&&Rt(r.id,!0)}function Gk(e){if(!e||!O)return;if(as(),e.kind==="page"&&e.pageId){Rt(e.pageId,!0);return}if(e.kind!=="sheet")return;let t=G.pages.find(n=>n.sheetInstancePath===e.sheetInstancePath)||G.byId.get(M.selectedPageId),r=String(e.sheetFile||e.feature?.sheet_file||"").replace(/\\/g,"/"),a=String(e.sheetName||e.feature?.sheet_name||e.feature?.objectId||""),s=G.pages.find(n=>{if(t&&n.parentId&&n.parentId!==t.id)return!1;let i=String(n.sourcePath||"").replace(/\\/g,"/");return r&&i.endsWith(r)||a&&n.name===a})||G.pages.find(n=>{let i=String(n.sourcePath||"").replace(/\\/g,"/");return r&&i.endsWith(r)||a&&n.name===a});s&&Rt(s.id,!0)}function zk(e){let t=Te.querySelector("#search-results"),r=e.trim().toLowerCase();if(!r){t.innerHTML="";return}let a=G.pages.filter(n=>`${n.name} ${n.sheetPath}`.toLowerCase().includes(r)).slice(0,8),s=k.scene.nets.filter(n=>String(n.name).toLowerCase().includes(r)).slice(0,8);t.innerHTML=[...a.map(n=>`<button data-page="${n.id}"><b>${H(n.name)}</b><span>Page ${n.sheetNumber}</span></button>`),...s.map(n=>`<button data-schematic-net="${n.id}"><b>${H(n.name)}</b><span>${(G.manifest.netToPages?.[n.uid]||[]).length} pages</span></button>`)].join(""),t.querySelectorAll("[data-page]").forEach(n=>{n.addEventListener("click",()=>Rt(n.dataset.page,!0))}),t.querySelectorAll("[data-schematic-net]").forEach(n=>{n.addEventListener("click",()=>_p(Number(n.dataset.schematicNet),!0))})}function _p(e,t){let r=k.scene.nets.find(s=>Number(s.id)===e);if(!r||!O)return;M.activeNetId=e,M.selectedFeatureId=0,M.selectedSchematicFeature=null,O.selectedFeatureId=0,O.selectedFeatureKey="",O.selectedSourceId="",G.activeNetUid=r.uid,O.activeNetUid=r.uid,re?.setHighlightedNet(r.uid),wt.textContent=JSON.stringify(r,null,2),st();let a=G.manifest.netToPages?.[r.uid]||[];t&&a.length&&Rt(a[0],!0)}function Ip(e,t=null){let r=k.scene.nets.find(a=>a.uid===e);r&&(M.activeNetId=Number(r.id),G.activeNetUid=r.uid,O&&(O.activeNetUid=r.uid,O.selectedFeatureId=Number(t?.feature?.id||t?.featureId||0),O.selectedFeatureKey=t?.feature?.stableKey||t?.featureKey||"",O.selectedSourceId=t?.feature?.sourceId||t?.sourceId||""),re?.setHighlightedNet(r.uid),t&&(M.selectedSchematicFeature={...t,pageId:M.selectedPageId}),wt.textContent=JSON.stringify(t?{...t,net:r}:r,null,2),st())}function as(){M.activeNetId=0,M.selectedFeatureId=0,M.selectedSchematicFeature=null,G.activeNetUid="",O&&(O.activeNetUid="",O.selectedFeatureId=0,O.selectedFeatureKey="",O.selectedSourceId=""),re?.setSelection(null),re?.setHighlightedNet(""),wt.textContent="No object selected",st()}function Rp(){let e=G.byId.get(M.selectedPageId);e?O.framePage(e):O.frameWorld()}function Kk(e){M.selectedPageId=e.sheetInstancePath&&G.pages.find(a=>a.sheetInstancePath===e.sheetInstancePath)?.id||M.selectedPageId,M.selectedFeatureId=0,M.selectedSchematicFeature={...e,pageId:M.selectedPageId},e.anchor&&(M.selectionAnchor=e.anchor),O&&(O.selectedPageId=M.selectedPageId,O.selectedFeatureId=Number(e.feature?.id||0));let t=e.netUid?k.scene.nets.find(a=>a.uid===e.netUid):null,r=e.reference?k.scene.componentFeatures.get(e.reference):null;r&&(M.selectedFeatureId=Number(r.featureId||0),ut?.setSelectionByReference(e.reference,{scroll:M.workspace==="bom"})),wt.textContent=JSON.stringify({...e,net:t,component:r},null,2),st()}function Vk(e){let{page:t,feature:r}=e;if(!r){M.selectedSchematicFeature=null,O.selectedFeatureId=0,Rt(t.id,!1),st();return}let a=Number(r.id||0);if(M.selectedPageId=t.id,O.selectedPageId=t.id,O.selectedFeatureId=a,M.selectedSchematicFeature={...r,pageId:t.id},M.selectionAnchor=null,r.netUid){let s=k.scene.nets.find(n=>n.uid===r.netUid);if(s){_p(Number(s.id),!1),M.selectedSchematicFeature={...r,pageId:t.id},O.selectedFeatureId=a;return}}if(r.reference){let s=k.scene.componentFeatures.get(r.reference);if(s){kr(Number(s.featureId),!1),M.selectedSchematicFeature={...r,pageId:t.id},O.selectedFeatureId=a;return}}M.activeNetId=0,M.selectedFeatureId=0,O.activeNetUid="",wt.textContent=JSON.stringify({page:t.name,...r},null,2),st()}function Mr(){let e=M.isolateNet,t=Te?.querySelector?.("#isolate-net");t?.classList.toggle("active",e),t?.setAttribute("aria-pressed",String(e));let r=se?.querySelector?.("[data-action=isolate]");r?.classList.toggle("active",e),r?.setAttribute("aria-pressed",String(e));let a=We?.querySelector?.("#show-board");a&&(a.checked=M.showBoard);let s=We?.querySelector?.("#show-components");s&&(s.checked=M.showComponents),Nt()}function Hk(){let e=new Set;for(let t of Hr())for(let r of Pc(t))e.add(r);return e}function Pc(e,t=k){let r=new Set,a=t.scene.nets.find(n=>Number(n.id)===Number(e)),s=new Set(t.scene.copperLayers.map(n=>Number(n.id)));for(let n of Object.keys(a?.layerBoundsMm||{})){let i=Number(n);s.has(i)&&r.add(i)}if(!r.size){let n=new Map(t.scene.copperLayers.map(i=>[i.name,Number(i.id)]));for(let i of a?.metrics?.layers||[]){let o=n.get(i);o!=null&&r.add(o)}}if(r.size)return r;for(let n of t.scene.tiles.values())Hb(n,e)&&r.add(Number(n.layerId));return r}function Xr(){if(w){for(let t of at())ri(t);return}let e=Hk();e.size&&(k.visible3dLayers=new Set(e),M.mode==="layer"?rs(e):(k.compareLayers=new Set(e),k.desiredCompareLayers=new Set(e)),_e(performance.now(),{force:!0}))}function Qr(e){let t=!!(e&&Yr()),r=M.isolateNet;if(t&&!M.isolateNet&&!w&&(k.preIsolation3dLayers=new Set(k.visible3dLayers),k.preIsolationCompareLayers=new Set(k.desiredCompareLayers.size?k.desiredCompareLayers:k.compareLayers)),M.isolateNet=t,w)Xr();else if(M.isolateNet)Xr();else if(k.preIsolation3dLayers||k.preIsolationCompareLayers){if(k.preIsolation3dLayers&&(k.visible3dLayers=new Set(k.preIsolation3dLayers)),k.preIsolationCompareLayers){let a=new Set(k.preIsolationCompareLayers);M.mode==="layer"?rs(a):(k.compareLayers=a,k.desiredCompareLayers=new Set(a))}k.preIsolation3dLayers=null,k.preIsolationCompareLayers=null,_e(performance.now(),{force:!0})}t&&!r?(M.preIsolationShowBoard=M.showBoard,M.showBoard=!1):!t&&r&&(typeof M.preIsolationShowBoard=="boolean"&&(M.showBoard=M.preIsolationShowBoard),M.preIsolationShowBoard=null),Mr(),Ke()}function Ke(){(Gr||dt).querySelectorAll("[data-mode]").forEach(r=>{let a=r.dataset.mode===M.mode;r.classList.toggle("active",a),r.setAttribute("aria-pressed",String(a))}),We.querySelector("#show-board").checked=M.showBoard,We.querySelector("#show-components").checked=M.showComponents,We.querySelector("#separation").value=M.separation;let e=dt.querySelector(".layer-list"),t=M.mode==="3d"?k.visible3dLayers:k.desiredCompareLayers;e.innerHTML=k.scene.copperLayers.map((r,a)=>`
    <label class="layer-row">
      <input type="checkbox" data-layer="${r.id}" ${t.has(Number(r.id))?"checked":""}>
      <span class="swatch" style="background:${ci(oi(r))}"></span>
      <span>${H(r.name)}</span><small>${a+1}</small>
    </label>`).join(""),e.querySelectorAll("[data-layer]").forEach(r=>r.addEventListener("change",()=>{Cp(Number(r.dataset.layer),r.checked)})),Mr()}function Np(e){e==="layer"?Oc():(M.mode="3d",z.frame(nr()),z.snap(),k.visibleTileIds=new Set,_e(performance.now(),{force:!0})),Ke()}function Cp(e,t,r=null){if(w){let a=Number(e);Ac(r==null?null:[r],s=>t?s.delete(a):s.add(a));return}if(M.mode==="3d")t?k.visible3dLayers.add(e):k.visible3dLayers.delete(e),_e(performance.now(),{force:!0});else{let a=new Set(k.desiredCompareLayers);t?a.add(e):a.delete(e),rs(a)}Ke()}function Bp(e,t=null){if(w){Ac(t==null?null:[t],(a,s)=>{let n=s?.scene.copperLayers||[];a.clear(),n.forEach((i,o)=>{e==="all"||e==="outer"&&(o===0||o===n.length-1)||e==="inner"&&o>0&&o<n.length-1||a.add(Number(i.id))})});return}let r=M.mode==="3d"?k.visible3dLayers:new Set;r.clear();for(let[a,s]of k.scene.copperLayers.entries())(e==="all"||e==="outer"&&(a===0||a===k.scene.copperLayers.length-1)||e==="inner"&&a>0&&a<k.scene.copperLayers.length-1)&&r.add(Number(s.id));M.mode==="3d"?_e(performance.now(),{force:!0}):rs(r),Ke()}function Op(e){M.showBoard=!!e,M.savedShowBoard=M.showBoard,M.showBoard&&M.isolateNet?Qr(!1):Mr()}function Fp(e){M.showComponents=!!e,M.savedShowComponents=M.showComponents,Mr()}function qk(e){M.showPlaceholders=!!e;for(let t of w?at():[k])t.renderer?.setPlaceholdersVisible(M.showPlaceholders);Nt()}function Wk(){let e=new Set((k.scene?.layers||[]).map(a=>String(a.name))),t=new Set(M.hiddenBoardLayers),r=a=>{let s=(k.renderer?.entries||[]).find(i=>i.kind==="board"&&i.boardRole===a),n=s?.color||s?.material?.baseColor;return n?ci(n):sM[a]};return aM.filter(a=>!e.size||e.has(a.name)).map(a=>({...a,color:r(a.role),visible:!t.has(`${a.role}:${a.side}`)}))}function Xk(e,t,r){let a=`${e}:${t}`,s=new Set(M.hiddenBoardLayers);r?s.delete(a):s.add(a),M.hiddenBoardLayers=[...s];for(let n of w?at():[k])n.renderer?.setHiddenBoardLayers(M.hiddenBoardLayers);Nt()}function $k(e){M.realisticColors=!!e,ss(),Nt()}function ss(e=k){if(!e.renderer)return;let t=new Map(e.scene.layers.map(r=>[Number(r.id),r]));for(let r of e.renderer.entries)r.kind==="copper"&&(r.color=Ya(t.get(Number(r.layerId)),e));e.renderer.copperColors=new Map([...t].map(([r,a])=>[r,Ya(a,e)])),e.renderer.invalidate?.(),e.renderer.setBarrelColor(kp(Tk,[...vp(e).slice(0,3),.78],Wr())),e.scene.copperRealism=Wr()}function Pp(e,t=null){if(w){XM(be(Number(e)||0,0,1),t);return}M.separation=be(Number(e)||0,0,1),Nt()}function Yk(){(Gr||dt).querySelectorAll("[data-mode]").forEach(t=>t.addEventListener("click",()=>{Np(t.dataset.mode)})),dt.querySelectorAll("[data-preset]").forEach(t=>t.addEventListener("click",()=>{Bp(t.dataset.preset)})),We.querySelector("#show-board").addEventListener("change",t=>{Op(t.target.checked)}),We.querySelector("#show-components").addEventListener("change",t=>{Fp(t.target.checked)}),We.querySelector("#separation").addEventListener("input",t=>{Pp(t.target.value)}),Te.querySelector("#clear-selection").addEventListener("click",ze),Te.querySelector("#isolate-net").addEventListener("click",()=>{Qr(!M.isolateNet)}),Te.querySelector("#frame-selection").addEventListener("click",Gc),Te.querySelector("#show-net-layers").addEventListener("click",jc);let e=Te.querySelector("#entity-search");e.addEventListener("input",()=>Lp(e.value))}function jp(){mr(".rail-tab").forEach(e=>e.addEventListener("click",()=>{let t=e.dataset.tab,r=M.activeTab===t&&!It.classList.contains("panel-collapsed");M.activeTab=t,It.classList.toggle("panel-collapsed",r),mr(".rail-tab").forEach(a=>{a.classList.toggle("active",!r&&a.dataset.tab===t)}),mr(".tab-panel").forEach(a=>{a.classList.toggle("active",!r&&a.dataset.panel===t)})}))}function jc(){if(w){HM();return}let e=k.scene.nets.find(a=>Number(a.id)===M.activeNetId);if(!e)return;let t=new Set(e.metrics?.layers||[]),r=M.mode==="3d"?k.visible3dLayers:new Set;r.clear();for(let a of k.scene.copperLayers)t.has(a.name)&&r.add(Number(a.id));M.mode==="3d"?_e(performance.now(),{force:!0}):rs(r),Ke()}function Lp(e){let t=Te.querySelector("#search-results"),r=e.trim().toLowerCase();if(!r){t.innerHTML="";return}let a=k.scene.nets.filter(n=>String(n.name).toLowerCase().includes(r)).slice(0,8),s=[...k.scene.componentFeatures.values()].filter(n=>!k.hiddenComponents.has(String(n.designator||""))&&`${n.designator} ${n.value} ${n.footprint}`.toLowerCase().includes(r)).slice(0,6);t.innerHTML=[...a.map(n=>`<button data-net="${n.id}"><b>${H(n.name)}</b><span>${H(n.netClass||"")}</span></button>`),...s.map(n=>`<button data-feature="${n.featureId}"><b>${H(n.designator)}</b><span>${H(n.value)}</span></button>`)].join(""),t.querySelectorAll("[data-net]").forEach(n=>{n.addEventListener("click",()=>Lc(Number(n.dataset.net),!0))}),t.querySelectorAll("[data-feature]").forEach(n=>{n.addEventListener("click",()=>kr(Number(n.dataset.feature),!0))})}function Lc(e,t){t&&(M.selectionAnchor=null),M.activeNetId=e,M.selectedFeatureId=0;let r=k.scene.nets.find(a=>Number(a.id)===e);M.workspace==="schematic"&&r&&O&&(G.activeNetUid=r.uid,O.activeNetUid=r.uid),vc(),wt.textContent=JSON.stringify(r||{},null,2),st(),M.isolateNet&&Xr(),t&&r?.boundsMm&&z.frame(wc(ta(r.boundsMm))),_e(performance.now(),{force:!0}),ei(Cb(r))}function kr(e,t=!1){let r=k.scene.features.get(e);if(r?.kind==="component"&&bs($r(r),k.hiddenComponents))return;t&&(M.selectionAnchor=null),M.selectedFeatureId=e,M.activeNetId=Number(r?.netId||0);let a=$r(r);a&&ut?.setSelectionByReference(a,{scroll:M.workspace==="bom"});let s=Bb(r);s?.kind==="net"?vc():Ob(),wt.textContent=r?JSON.stringify(r,null,2):"No object selected",st(),M.isolateNet&&M.activeNetId&&Xr(),t&&r?.bounds&&Uc(r),_e(performance.now(),{force:!0}),ei(s)}function Dc(e,t=!1){if(bs(e,k.hiddenComponents))return;let r=k.scene.componentFeatures.get(e);if(ut?.setSelectionByReference(e,{scroll:M.workspace==="bom"}),!r?.featureId)return;Ob(),kr(Number(r.featureId),!1);let a=Qk(e);if(a){let{page:s,feature:n}=a;M.selectedPageId=s.id,M.selectedSchematicFeature={...n,pageId:s.id},O&&(O.selectedPageId=s.id,O.selectedFeatureId=Number(n.id||0)),re?.setSelection?.({kind:"component",featureKey:n.stableKey||"",sheetInstancePath:n.sheetInstancePath||s.sheetInstancePath||"",sourceId:n.sourceId||n.uuid||"",reference:e,feature:n,pageId:s.id}),t&&M.workspace==="schematic"&&(Rt(s.id,!0),re?.frameSelection?.())}if(t&&M.workspace==="pcb"){let s=k.scene.features.get(Number(r.featureId));s?.bounds&&Uc(s,!0)}st()}function $r(e){return e?.designator||e?.reference||e?.componentDesignator||""}function Jk(e=k){return nl(e.scene.manifest?.components||[],e.scene.componentModelCounts)}function Dp(e){k.hiddenComponentRequest=e;let t=il(e,Jk());k.hiddenComponents=t.hiddenReferences,k.renderer?.setHiddenFeatureIds(t.hiddenFeatureIds),t.ambiguous.length&&console.warn(`[prism-semantic-viewer] keeping ambiguous components visible: ${t.ambiguous.join(", ")}`),t.unknown.length&&console.warn(`[prism-semantic-viewer] ignoring unknown components: ${t.unknown.join(", ")}`);let r=$r(k.scene.features.get(M.selectedFeatureId));bs(r,k.hiddenComponents)&&ze();let a=Te.querySelector("input");return a?.value&&Lp(a.value),t}function Uc(e,t=!1){if(!e?.bounds)return;let r=wc(e.bounds);if(t||e.kind==="component"||!!$r(e)){let n=(r[2]+r[5])*.5<0,i=z.isBelow();n!==i&&z.setAxis("z",n)}z.frame(r)}function Qk(e){if(!e||!O?.featuresByPage)return null;let t=G.byId.get(M.selectedPageId),r=[...t?[t]:[],...(G.pages||[]).filter(s=>s.id!==t?.id)],a=s=>{let n=String(s.kind||"").toLowerCase();return n==="component"||n==="symbol_body"||n==="symbol_instance"?0:n==="symbol_reference"?1:n.startsWith("pin")?2:3};for(let s of r){let n=(O.featuresByPage[s.id]||[]).filter(i=>String(i.reference||i.designator||i.componentDesignator||"")===e).sort((i,o)=>a(i)-a(o));if(n.length)return{page:s,feature:n[0]}}return null}function ze(){M.activeNetId=0,M.selectedFeatureId=0,w&&(w.boardSelected=!1,w.standInKey=null),M.selectedSchematicFeature=null,M.selectionAnchor=null;let e=Yr(),t=M.isolateNet;t&&!e?Qr(!1):e?t&&Xr():M.isolateNet=!1,e||Fb(),G.activeNetUid="",O&&(O.activeNetUid=""),re?.setSelection(null),re?.setHighlightedNet(""),wt.textContent="No object selected",ut?.clearSelection?.(),st(),ei(null)}function Fn(e){return`<div class="selection-properties">${e.map(([t,r])=>`
    <div class="selection-property">
      <small>${H(t)}</small>
      <strong title="${H(String(r))}">${H(String(r))}</strong>
    </div>`).join("")}</div>`}function Xn(e,t,r){return`
    <div class="selection-card-head">
      <span class="selection-card-accent" style="background:${r}"></span>
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
      <div class="selection-card-title"><small>${H(e)}</small><strong>${H(t)}</strong></div>
      <button class="selection-card-close" type="button" aria-label="Clear selection">&times;</button>
    </div>`}function Zk(e){let r=(k.topology.net_details?.[e.uid]||{}).terminals||[],a=e.metrics||{},s=Number(a.traceLengthMm||0).toFixed(2),n=a.objectCounts?.via||0,i=r.length,c=/^(VCC|VDD|GND|3V3|5V|12V|VIN|POWER)/i.test(e.name)?"#10b981":"#8b5cf6",l=e.netClass||"Default",f=r.length?r.map(d=>`
      <div class="selection-row pin-row-interactive" data-ref="${H(d.designator)}" data-pin="${H(d.pin)}">
        <span class="refdes-col"><strong>${H(d.designator)}</strong></span>
        <span class="pin-col">Pin ${H(d.pin)}</span>
        <span class="val-col" title="${H(d.value||"")}">${H(d.value||"-")}</span>
      </div>`).join(""):'<div class="selection-empty">No connected pin metadata is available.</div>';return`
    ${Xn("Net",e.name,c)}
    <div class="selection-net-dashboard">
      <div class="net-metric-grid">
        <div class="metric-card">
          <small>Length</small>
          <strong>${s} <span class="unit">mm</span></strong>
        </div>
        <div class="metric-card">
          <small>Vias</small>
          <strong>${n}</strong>
        </div>
        <div class="metric-card">
          <small>Pins</small>
          <strong>${i}</strong>
        </div>
        <div class="metric-card">
          <small>Class</small>
          <strong title="${H(l)}">${H(l)}</strong>
        </div>
      </div>
      
      <div class="selection-section">
        <span class="selection-section-title">Layers</span>
        <div class="net-layers-badges">
          ${(a.layers||[]).length?a.layers.map(d=>`<span class="layer-badge">${H(d)}</span>`).join(""):'<span class="layer-badge unknown">None</span>'}
        </div>
      </div>

      <div class="selection-section">
        <span class="selection-section-title">Connected Pins</span>
        <div class="selection-table compact-scroll" style="max-height: 120px;">
          ${f}
        </div>
      </div>
    </div>`}function eE(e,t=null){let r=yc(e.designator),a=r?r.value:e.value||"Not specified",s=r?r.footprint:e.footprint||"Not specified",n=r?.parameters||{},i=n.Manufacturer||n.Mfr||"",o=n["Manufacturer Part Number"]||n.MPN||n["Part Number"]||"",c=n.kicad_dnp==="true"||n.DNP==="true"||n.kicad_in_bom==="false",l="";(i||o)&&(l=`
      <div class="selection-section">
        <span class="selection-section-title">Component details</span>
        <div class="selection-table">
          <div class="selection-row">
            <span><strong>Manufacturer</strong></span>
            <span title="${H(i)}">${H(i||"-")}</span>
          </div>
          <div class="selection-row">
            <span><strong>Part Number</strong></span>
            <span title="${H(o)}">${H(o||"-")}</span>
          </div>
        </div>
      </div>`);let f="";return t&&(f=`
      <div class="selection-section">
        <span class="selection-section-title">Selected Pin</span>
        <div class="selection-table">
          <div class="selection-row">
            <span><strong>Pin</strong></span>
            <span>Pin ${H(t.pinNumber||t.pin||"")}</span>
            <span title="${H(t.pinName||"")}">${H(t.pinName||"No name")}</span>
          </div>
          <div class="selection-row">
            <span><strong>Net</strong></span>
            <span class="net-ref-interactive" data-net-name="${H(t.netName||"")}">${H(t.netName||"Not connected")}</span>
          </div>
        </div>
      </div>`),`
    ${Xn("Component",e.designator||"Unknown","#3b82f6")}
    <div class="selection-component-dashboard">
      ${c?'<div class="dnp-banner" style="background:#b45309;color:#fff;font-size:9px;font-weight:750;text-align:center;padding:3px;margin-bottom:8px;border-radius:2px;text-transform:uppercase;letter-spacing:0.05em;">DNP (Do Not Populate)</div>':""}
      ${Fn([["Value",a],["Footprint",s.split(":").pop()||s]])}
      ${l}
      ${f}
    </div>`}function tE(e,t){let r=String(e.kind||"").toLowerCase(),a=r.startsWith("pin");if(r==="component"||r.includes("symbol"))return`
      ${Xn("Component",e.reference||e.componentDesignator||"Unknown","#3b82f6")}
      ${Fn([["Value",e.value||e.componentValue||"Not specified"],["Footprint",e.componentFootprint||e.footprint||"Not specified"],["Library",e.libraryRef||"Not specified"],["UID",e.componentUid||e.uuid||e.sourceId||"Not resolved"]])}
      <div class="selection-section">
        <span class="selection-section-title">Schematic placement</span>
        ${Fn([["Page",t?.name||"Unknown"],["Sheet",e.sheetInstancePath||"/"]])}
      </div>`;let n=a?[["Symbol",e.reference||e.designator||"Unknown"],["Value",e.value||e.componentValue||"Not specified"],["Pin",`${e.pinNumber||"-"}${e.pinName?` ${e.pinName}`:""}`],["Net",e.netName||"Not connected"],["PCB Pad",e.pcbPadId||"Not resolved"],["Component UID",e.componentUid||"Not resolved"]]:[["Page",t?.name||"Unknown"],["Kind",e.kind.replaceAll("_"," ")],["Net",e.netName||"Not connected"]];return`
    ${Xn(e.kind.replaceAll("_"," "),e.pinName||e.reference||e.designator||e.text||e.netName||"Schematic object","#3b82f6")}
    ${Fn(n)}
    <div class="selection-section">
      <span class="selection-section-title">Source identity</span>
      <div class="selection-table">
        <div class="selection-row">
          <span><strong>${a?"Pin UUID":"UUID"}</strong></span>
          <span title="${H(e.uuid||e.sourceId||"")}">${H(e.uuid||e.sourceId||"-")}</span>
          <span title="${H(e.objectId||"")}">${H(e.objectId||"No object ID")}</span>
        </div>
        <div class="selection-row">
          <span><strong>Sheet</strong></span>
          <span>${H(t?.name||"Unknown")}</span>
          <span title="${H(e.sheetInstancePath||"")}">${H(e.sheetInstancePath||"/")}</span>
        </div>
      </div>
    </div>`}function st(){if(Nt(),M.workspace==="bom"){se.hidden=!0,se.innerHTML="";return}let e=k.scene.features.get(M.selectedFeatureId),t=e?.kind==="component"?e:null,r=M.workspace==="schematic"?M.selectedSchematicFeature:null,a=r?G.byId.get(r.pageId):null,s=M.activeNetId?k.scene.nets.find(d=>Number(d.id)===M.activeNetId):null;if(!s&&r&&(r.netUid?s=k.scene.nets.find(d=>d.uid===r.netUid):r.netName&&(s=or(k.scene.nets,r.netName))),!t&&r){let d=r.reference||r.componentDesignator||r.designator;d&&(t=k.scene.componentFeatures.get(d)||{designator:d})}if(!t&&!s&&!r){se.hidden=!0,se.innerHTML="";return}let n="";if(s)n=Zk(s);else if(t){let d=r?.kind?.startsWith("pin")?r:null;n=eE(t,d)}else r&&(n=tE(r,a));se.innerHTML=`
    ${n}
    <div class="selection-card-actions">
      ${s?`
        <button type="button" data-action="isolate" aria-keyshortcuts="I" title="Toggle isolated net view (I)" class="${M.isolateNet?"active":""}">Isolate</button>
        <button type="button" data-action="net-layers">Layers</button>
      `:""}
      <button type="button" data-action="frame">Frame selection</button>
    </div>`,se.hidden=!1;let i=M.workspace==="schematic"?Ge:L,o=M.selectionAnchor,c=se.offsetWidth||360,l=se.offsetHeight||330;if(o){let d=Math.max(16,i.clientWidth-c-24),p=Math.max(16,i.clientHeight-l-24);se.style.left=`${be(o.x+18,16,d)}px`,se.style.top=`${be(o.y+18,16,p)}px`}else se.style.left="20px",se.style.top="20px";if(se.querySelector(".selection-card-close").addEventListener("click",ze),se.querySelector("[data-action=frame]").addEventListener("click",Gc),s){let d=se.querySelector("[data-action=isolate]");d&&d.addEventListener("click",()=>{Qr(!M.isolateNet)});let p=se.querySelector("[data-action=net-layers]");p&&p.addEventListener("click",jc),se.querySelectorAll(".pin-row-interactive").forEach(b=>{b.addEventListener("click",()=>{let h=b.dataset.ref,u=b.dataset.pin;if(!h)return;let y=((k.topology.net_details?.[s.uid]||{}).terminals||[]).find(v=>v.designator===h&&v.pin===u),x=cM(y);x?kr(x,!0):Dc(h,!0)})})}let f=se.querySelector(".net-ref-interactive");f&&f.addEventListener("click",()=>{let d=f.dataset.netName;if(!d)return;let p=or(k.scene.nets,d);p&&Lc(Number(p.id),!0)})}function Gc(){if(M.workspace==="schematic"){Rp();return}let e=k.scene.features.get(M.selectedFeatureId);if(e?.bounds)Uc(e);else{let t=k.scene.nets.find(r=>Number(r.id)===M.activeNetId);t?.boundsMm&&z.frame(wc(ta(t.boundsMm)))}}function Up(){L.addEventListener("contextmenu",e=>e.preventDefault()),L.addEventListener("pointerdown",e=>{w&&(w.framed=!0),!(w&&bk(e))&&(M.dragging=!0,M.lastX=e.clientX,M.lastY=e.clientY,M.pointerStartX=e.clientX,M.pointerStartY=e.clientY,M.dragMode=M.mode==="layer"||e.shiftKey||e.button!==0?"pan":"orbit",L.setPointerCapture(e.pointerId))}),L.addEventListener("pointermove",e=>{if(w&&pp(e)||(w?.move.route&&!M.dragging&&(L.style.cursor=Bc(e)?"crosshair":""),!M.dragging))return;let t=e.clientX-M.lastX,r=e.clientY-M.lastY;M.lastX=e.clientX,M.lastY=e.clientY,M.dragMode==="pan"?z.pan(t,r,L.clientHeight,M.mode==="layer"):z.orbit(t,r)}),L.addEventListener("pointerup",async e=>{w&&gp(e)||(M.dragging=!1,L.releasePointerCapture(e.pointerId),!(Math.hypot(e.clientX-M.pointerStartX,e.clientY-M.pointerStartY)>=3)&&M.clickSelect&&(e.button===0?await yb(e):e.button===2&&await nE(e)))}),L.addEventListener("dblclick",async e=>{M.clickSelect&&(await yb(e),Gc())}),L.addEventListener("wheel",e=>{w&&(w.framed=!0),e.preventDefault(),Math.abs(e.deltaX)>Math.abs(e.deltaY)*.4?z.pan(-e.deltaX,0,L.clientHeight,M.mode==="layer"):z.dolly(e.deltaY,M.mode==="layer")},{passive:!1}),window.addEventListener("keydown",qp),rE()}function rE(){let e=!1,t,r,a=0,s=0;se.addEventListener("pointerdown",n=>{if(!n.target.closest(".selection-card-head")||n.target.closest(".selection-card-close"))return;e=!0,se.classList.add("dragging");let o=se.getBoundingClientRect();a=o.left,s=o.top,t=n.clientX,r=n.clientY,se.setPointerCapture(n.pointerId),n.stopPropagation()}),se.addEventListener("pointermove",n=>{if(!e)return;let i=n.clientX-t,o=n.clientY-r,c=M.workspace==="schematic"?Ge:L,l=se.offsetWidth||360,f=se.offsetHeight||330,d=Math.max(16,c.clientWidth-l-24),p=Math.max(16,c.clientHeight-f-24),b=be(a+i,16,d),h=be(s+o,16,p);se.style.left=`${b}px`,se.style.top=`${h}px`,M.selectionAnchor={x:b-18,y:h-18},n.stopPropagation()}),se.addEventListener("pointerup",n=>{e&&(e=!1,se.classList.remove("dragging"),se.releasePointerCapture(n.pointerId),n.stopPropagation())})}function aE(){mr("[data-workspace]").forEach(e=>{e.addEventListener("click",()=>Gp(e.dataset.workspace))})}function Gp(e){if(e==="schematic"&&!O||e==="bom"&&!ut)return;M.workspace=e,It.classList.remove("workspace-pcb","workspace-schematic","workspace-bom","workspace-stackup"),It.classList.add(`workspace-${e}`),(e==="schematic"&&(M.activeTab==="view"||M.activeTab==="inspect"||M.activeTab==="stats")||e==="bom"||e==="stackup")&&$n("layers");let t=Z('.rail-tab[data-tab="layers"]');t&&(e==="schematic"?(t.textContent="Pages",t.title="Schematic pages"):e==="bom"?(t.textContent="Summary",t.title="BoM summary"):(t.textContent="Layers",t.title="Layers and compare"));let r=e==="schematic",a=e==="bom",s=e==="stackup";if(L.hidden=r||a||s,Ge&&(Ge.hidden=!r),Pn&&(Pn.hidden=!r||!re),jn&&(jn.hidden=!r),Ln&&(Ln.hidden=!a),qe&&(qe.hidden=!s),Ue.hidden=r||a||s,Dn.hidden=r||a||s,Ha&&(Ha.hidden=!r),mr("[data-workspace]").forEach(n=>{n.classList.toggle("active",n.dataset.workspace===e)}),Vr.textContent=a?"Semantic BoM active":r?re?"SVG DOM + WebGPU schematic world active":"WebGPU schematic world active":s?"Layer Stackup active":"WebGPU semantic glTF active",r&&!G.fitted&&(O.resize(),O.frameWorld(),G.fitted=!0),!r&&!a&&!s&&(k.renderer?.resize(),M.mode==="layer"?Oc():_e(performance.now(),{force:!0})),s)try{fE()}catch(n){console.error("Failed to render stackup workspace",n),qe&&(qe.innerHTML=`
          <div class="selection-empty" style="padding:40px;text-align:center;">
            Stackup view failed to render. ${H(n?.message||String(n))}
          </div>
        `)}Fc(),st()}function sE(){Ge.addEventListener("pointerdown",e=>{re?.worldActive||re?.active||(M.schematicDragging=!0,M.schematicLastX=e.clientX,M.schematicLastY=e.clientY,M.schematicStartX=e.clientX,M.schematicStartY=e.clientY,Ge.setPointerCapture(e.pointerId))}),Ge.addEventListener("pointermove",e=>{if(re?.worldActive||re?.active||!M.schematicDragging||!O)return;let t=e.clientX-M.schematicLastX,r=e.clientY-M.schematicLastY;M.schematicLastX=e.clientX,M.schematicLastY=e.clientY,O.pan(t,r)}),Ge.addEventListener("pointerup",async e=>{if(!(re?.worldActive||re?.active)&&(M.schematicDragging=!1,Ge.releasePointerCapture(e.pointerId),Math.hypot(e.clientX-M.schematicStartX,e.clientY-M.schematicStartY)<3)){let t=await O.pickFeature(e.clientX,e.clientY);t?Vk(t):as()}}),Ge.addEventListener("dblclick",e=>{if(re?.worldActive||re?.active)return;let t=O.hitPage(e.clientX,e.clientY);t&&Rt(t.id,!0)}),Ge.addEventListener("wheel",e=>{re?.worldActive||re?.active||(e.preventDefault(),O.zoom(e.deltaY,e.clientX,e.clientY))},{passive:!1})}function pb(e,t=11,r=32){let a=gr(e,tt),s=gr([e[0]+1e-4,e[1],e[2]],tt),n=gr([e[0],e[1]+1e-4,e[2]],tt);if(!a||!s||!n)return null;let i=Math.max(Math.hypot(s.x-a.x,s.y-a.y),Math.hypot(n.x-a.x,n.y-a.y))/1e-4;if(!(i>0))return null;let o=t/i,c=[];for(let l=0;l<r;l++){let f=2*Math.PI*l/r,d=gr([e[0]+o*Math.cos(f),e[1]+o*Math.sin(f),e[2]],tt);if(!d)return null;c.push(d)}return{centre:a,ring:c}}function gb(e,t){if(!ee||!L)return null;let r=L.getBoundingClientRect(),a=(e-r.left)/r.width*2-1,s=1-(t-r.top)/r.height*2;return mf(ee.matrix,a,s)}var mb=0;async function yb(e){if(!ee)return;let t=++mb,r=L.getBoundingClientRect();if(M.selectionAnchor={x:e.clientX-r.left,y:e.clientY-r.top},w&&hk(e))return;let a=await zp(e);if(t===mb){if(w){zM(a);return}(a.kind==="feature"||a.kind==="board")&&(M.selectedOccurrence=a.occurrenceIndex),a.featureId?kr(a.featureId,!0):a.kind==="board"&&!k.renderer.identityOnly?zc():ze()}}async function nE(e){if(!ee||!Kn)return;let t=await zp(e),r=w?w.placements.get(t.occurrenceKey)?.board:k;if(!r)return;let a=r.scene.features.get(t.featureId),s=$r(a),n=s?yc(s,r):null;Kn({clientX:e.clientX,clientY:e.clientY,reference:s||void 0,value:String(n?.value||a?.value||"")||void 0})}function iE(e,t){if(!w||!L)return null;let r=L.getBoundingClientRect(),a=(e-r.left)/r.width*2-1,s=1-(t-r.top)/r.height*2,n=gf(z,a,s,r.width/Math.max(r.height,1)),i=w.placed.filter(c=>c.primitives&&c.occurrence.pickSurface).map(c=>({key:c.occurrence.path,matrix:c.matrix,primitives:c.primitives})),o=xf(i,n);return o?{occurrence:o.key,pointMm:o.point.map(c=>c/_c),normal:o.normal,toCamera:n.direction.map(c=>-c)}:null}function oE(e){let t=e!=null?w?.placements.get(String(e)):null;return t?(Sc(t),!0):!1}function zp(e){let t=L.getBoundingClientRect();return Kp((e.clientX-t.left)*L.width/t.width,(e.clientY-t.top)*L.height/t.height)}async function Kp(e,t){if(w)return GM(e,t);let r=await cE(e,t);return r?.kind==="analytic"&&k.analytic?{...r,featureId:await ec(k.analytic,r.operationIndex)||null}:r}function cE(e,t){return k.renderer.pick(ee,e,t,{activeNetId:M.activeNetId,selectedFeatureId:M.selectedFeatureId,layerOffsets:Wn(),visibleLayers:M.mode==="3d"?k.visible3dLayers:k.compareLayers,showBoard:M.showBoard,showComponents:M.showComponents,componentOpacity:be(1-M.separation/.1,0,1),boardOpacity:1-M.separation*.72,isolateNet:M.isolateNet,compareMode:M.mode==="layer",compareOffsets:xr,visibleTileIds:M.mode==="3d"?k.visibleTileIds:null})}async function Vp(e,t){if(!ee||!(w||k.renderer))return null;let r=L.getBoundingClientRect(),a=await Kp((e-r.left)*L.width/r.width,(t-r.top)*L.height/r.height),s=w?w.placements.get(a.occurrenceKey)?.board:k,n=a.featureId&&s?Bb(s.scene.features.get(a.featureId),s):null;return{...a,renderer:void 0,selection:n}}function zc(){let e=M.selectedOccurrence,t=Ye;Ye=!0;try{ze()}finally{Ye=t}M.selectedOccurrence=e,w&&(w.boardSelected=!0),ei({kind:"board",sourceContext:"3D"})}function Hp(e,t,r){let a=e.scene.componentFeatures.get(String(t)),s=a?e.scene.features.get(Number(a.featureId))?.bounds:null;if(!s)return null;let n=s[2]+s[5]>=0;return r([(s[0]+s[3])/2,(s[1]+s[4])/2,n?s[5]:s[2]])}function gr(e,t){if(!ee)return null;let r=ua(ee.matrix,Os(t,e),ee.viewport);if(!r)return null;let a=L.getBoundingClientRect();return{x:a.left+r.x*a.width/L.width,y:a.top+r.y*a.height/L.height}}function qp(e){if(!Zn())return;if(hl(e)){e.key==="Escape"&&e.target instanceof HTMLInputElement&&e.target.blur();return}if(bl(e))return;let t=e.key.toLowerCase();if(M.workspace==="schematic"){if(t==="/")e.preventDefault(),$n("search"),Te.querySelector("#entity-search")?.focus();else if(t==="escape")G.activeNetUid?(G.activeNetUid="",M.activeNetId=0,O.activeNetUid="",re?.setHighlightedNet(""),st()):as();else if(t==="~"||e.key==="~"){e.preventDefault();let r=M.selectedSchematicFeature?.netUid;r&&(G.activeNetUid===r?(G.activeNetUid="",M.activeNetId=0,O.activeNetUid="",re?.setHighlightedNet("")):Ip(r,M.selectedSchematicFeature))}else if(t==="home")O?.frameWorld();else if(t==="[")On("previous");else if(t==="]")On("next");else if(t==="n"){e.preventDefault();let r=O?.cycleNetIntrasheetLink(e.shiftKey?-1:1);r?.pageId&&(M.selectedPageId=r.pageId,O.selectedPageId=r.pageId,$p())}else if(e.altKey&&t==="arrowup")On("parent");else if(e.key.startsWith("Arrow")){e.preventDefault();let r=e.key==="ArrowRight"?32:e.key==="ArrowLeft"?-32:0,a=e.key==="ArrowDown"?32:e.key==="ArrowUp"?-32:0;O?.pan(r,a)}return}if(w&&lk(e,t)){e.preventDefault();return}if(t==="/")e.preventDefault(),$n("search"),Te.querySelector("#entity-search").focus();else if(t==="escape")ze();else if(t==="i"&&M.workspace==="pcb"&&Yr())e.preventDefault(),Qr(!M.isolateNet);else if(t==="home")z.frame(w&&w.bounds||nr());else if(t==="`")$b(!M.showStats);else if(["x","y","z"].includes(t))z.setAxis(t,e.shiftKey);else if(t==="f")z.flip();else if(t==="r")z.rotateZ(e.shiftKey?-1:1);else if(t===" "){e.preventDefault();let r=k.scene.features.get(M.selectedFeatureId);r?.bounds&&z.setFocus([(r.bounds[0]+r.bounds[3])/2,(r.bounds[1]+r.bounds[4])/2,(r.bounds[2]+r.bounds[5])/2])}else if(e.key.startsWith("Arrow")){e.preventDefault();let r=e.key==="ArrowRight"?32:e.key==="ArrowLeft"?-32:0,a=e.key==="ArrowDown"?32:e.key==="ArrowUp"?-32:0;z.pan(r,a,L.clientHeight,M.mode==="layer")}}function $n(e){M.activeTab=e,It.classList.remove("panel-collapsed"),mr(".rail-tab").forEach(t=>{t.classList.toggle("active",t.dataset.tab===e)}),mr(".tab-panel").forEach(t=>{t.classList.toggle("active",t.dataset.panel===e)})}function Wp(){let e=Ue.getContext("2d");e.clearRect(0,0,Ue.width,Ue.height);let t=[Ue.width/2,Ue.height/2],r=z.basis(),a=[{axis:"x",label:"X",color:"#e23838",vector:[1,0,0]},{axis:"y",label:"Y",color:"#2dbd50",vector:[0,1,0]},{axis:"z",label:"Z",color:"#3157d5",vector:[0,0,1]}],s=[];for(let n of a)for(let i of[-1,1]){let o=n.vector.map(l=>l*i),c=[nc(o,r.right),-nc(o,r.up),nc(o,r.back)];s.push({...n,sign:i,depth:c[2],point:[t[0]+c[0]*34,t[1]+c[1]*34]})}for(let n of a){let i=s.find(o=>o.axis===n.axis&&o.sign===1);e.strokeStyle=n.color,e.lineWidth=2.4,e.beginPath(),e.moveTo(...t),e.lineTo(...i.point),e.stroke()}Gn=[];for(let n of s.sort((i,o)=>o.depth-i.depth)){let i=n.sign===1,o=i?13:9;e.beginPath(),e.arc(n.point[0],n.point[1],o,0,Math.PI*2),e.fillStyle=i?n.color:`${n.color}66`,e.fill(),e.lineWidth=2,e.strokeStyle=uE(n.color,i?.45:.58),e.stroke(),i&&(e.fillStyle="#07101c",e.font="700 13px system-ui",e.textAlign="center",e.textBaseline="middle",e.fillText(n.label,n.point[0],n.point[1]+.5)),Gn.push({...n,radius:o+5})}}function Xp(){!Ue||Ue.dataset.bound==="true"||(Ue.dataset.bound="true",Ue.addEventListener("click",e=>{let t=Ue.width/Ue.clientWidth,r=Ue.height/Ue.clientHeight,a=[e.offsetX*t,e.offsetY*r],s=Gn.map(n=>({item:n,distance:Math.hypot(a[0]-n.point[0],a[1]-n.point[1])})).filter(({item:n,distance:i})=>i<=n.radius).sort((n,i)=>n.distance-i.distance)[0]?.item;s&&z.setAxis(s.axis,s.sign<0)}))}function lE(){if(M.mode!=="layer"||!ee){Dn.innerHTML="";return}let e=nr(),t=Ub();Dn.innerHTML=k.scene.copperLayers.filter(r=>t.has(Number(r.id))).map(r=>{let a=xr.get(Number(r.id))||[0,0,0],s=dE([e[0]+a[0],e[4]+a[1],0],ee.matrix,L.clientWidth,L.clientHeight);return!s||s[0]<-100||s[0]>L.clientWidth+100||s[1]<-100||s[1]>L.clientHeight+100?"":`<span style="left:${s[0]}px;top:${s[1]}px">${H(r.name)}</span>`}).join("")}function $p(){if(M.workspace!=="schematic"||!O){Ha.innerHTML="";return}Ha.innerHTML=G.visiblePages.filter(e=>O.pagePixelWidth(e)>120).map(e=>{let[t,r]=O.worldToScreen(e.worldX+8*O.scale,e.worldY-6*O.scale),a=e.id===M.selectedPageId,n=G.activeNetUid&&e.netUids.includes(G.activeNetUid)?"#18ef52":a?"#3b82f6":"#4b8de8";return`<div class="schematic-page-label" style="left:${t}px;top:${r}px;border-left-color:${n}">
        <strong>${H(e.name)}</strong>
        <small>Page ${e.sheetNumber} &middot; ${e.featureCount.toLocaleString()} features</small>
      </div>`}).join("")}function dE(e,t,r,a){let s=e[0],n=e[1],i=e[2],o=t[0]*s+t[4]*n+t[8]*i+t[12],c=t[1]*s+t[5]*n+t[9]*i+t[13],l=t[3]*s+t[7]*n+t[11]*i+t[15];return Math.abs(l)<1e-8?null:[(o/l*.5+.5)*r,(.5-c/l*.5)*a]}function nc(e,t){return e[0]*t[0]+e[1]*t[1]+e[2]*t[2]}function uE(e,t){let r=e.replace("#","");return`#${[0,2,4].map(a=>Math.round(parseInt(r.slice(a,a+2),16)*t).toString(16).padStart(2,"0")).join("")}`}function pc(e,t){M.frameSamples.push({intervalMs:e,cpuMs:t}),M.frameSamples.length>180&&M.frameSamples.shift()}function xb(e,t){if(!e.length)return 0;let r=[...e].sort((a,s)=>a-s);return r[Math.min(r.length-1,Math.floor((r.length-1)*t))]}function gc(e){if(!Rn||(M.frames+=1,e-M.fpsAt<=500))return;M.fps=M.frames*1e3/(e-M.fpsAt);let t=M.frameSamples;if(M.frameIntervalMs=t.length?t.reduce((n,i)=>n+i.intervalMs,0)/t.length:0,M.frameCpuMs=t.length?t.reduce((n,i)=>n+i.cpuMs,0)/t.length:0,M.frameIntervalP95Ms=xb(t.map(n=>n.intervalMs),.95),M.frameCpuP95Ms=xb(t.map(n=>n.cpuMs),.95),M.frames=0,M.fpsAt=e,Yb(),M.workspace==="bom"){let n=ut?.payload?.counts||{},i=[["Renderer","BoM DOM table"],["Schema",ut?.payload?.schema||"-"],["Grouped rows",n.rows||0],["Components",n.components||0],["DNP components",n.dnpComponents||0],["Extra columns",ut?.payload?.extraColumns?.length||0],["Frame interval",`${M.frameIntervalMs.toFixed(2)} ms avg / ${M.frameIntervalP95Ms.toFixed(2)} p95`],["CPU frame",`${M.frameCpuMs.toFixed(2)} ms avg / ${M.frameCpuP95Ms.toFixed(2)} p95`],["FPS",M.fps.toFixed(1)]];Rn.innerHTML=i.map(([o,c])=>`<dt>${o}</dt><dd>${c}</dd>`).join("");return}let r=M.workspace==="schematic"&&O?O.stats():null,a=M.workspace==="schematic"&&re?re.stats():null,s=M.workspace==="schematic"&&O?re?.active?[["Renderer","SVG DOM schematic detail"],["Pages",G.pages.length],["Mounted pages",a.mountedPages],["Active page",a.activePage],["DOM nodes",a.domNodes.toLocaleString()],["Indexed features",a.indexedFeatures.toLocaleString()],["Indexed nets",a.indexedNets.toLocaleString()],["SVG cache",`${a.cachedSvgPages} pages / ${(a.cachedSvgBytes/1048576).toFixed(1)} MB`],["Selection",`${a.selectionMs.toFixed(1)} ms`],["Active net",k.scene.nets.find(n=>n.uid===G.activeNetUid)?.name||"-"],["Tracking links",`${r.netFlowSegments} total / ${r.netFlowIntrasheetSegments} local`],["Tracking verts",r.netFlowVertices.toLocaleString()],["Mount",`${a.mountMs.toFixed(1)} ms`],["Highlight",`${a.highlightMs.toFixed(1)} ms`],["Fallback",a.fallbackReason||"-"],["Frame interval",`${M.frameIntervalMs.toFixed(2)} ms avg / ${M.frameIntervalP95Ms.toFixed(2)} p95`],["CPU frame",`${M.frameCpuMs.toFixed(2)} ms avg / ${M.frameCpuP95Ms.toFixed(2)} p95`],["FPS",M.fps.toFixed(1)]]:[["Renderer",re?"SVG DOM + WebGPU world":"WebGPU schematic world"],["Pages",G.pages.length],["Visible pages",G.visiblePages.length],["DOM pages",a?a.mountedPages:0],["DOM nodes",a?a.domNodes.toLocaleString():"0"],["Indexed SVG features",a?a.indexedFeatures.toLocaleString():"0"],["SVG cache",a?`${a.cachedSvgPages} pages / ${(a.cachedSvgBytes/1048576).toFixed(1)} MB`:"0 pages"],["JS heap",a?.heapMb?`${a.heapMb.toFixed(1)} MB`:"-"],["Hierarchy links",G.manifest.edges?.length||0],["Selected page",G.byId.get(M.selectedPageId)?.name||"-"],["Active net",k.scene.nets.find(n=>n.uid===G.activeNetUid)?.name||"-"],["Tracking links",`${r.netFlowSegments} total / ${r.netFlowIntrasheetSegments} local`],["Downloaded",`${(O.downloadedBytes/1048576).toFixed(1)} MB`],["Resident vectors",`${(r.residentVectorBytes/1048576).toFixed(1)} MB`],["Vector pages",`${r.vectorChunks} loaded / ${r.vectorLoads} loading`],["Vector draw",`${r.vectorVertices.toLocaleString()} verts / ${r.vectorDrawChunks} chunks`],["Native detail",`${r.nativeDetailPages} pages @ ${r.nativePxPerMm} / ${r.nativeThresholdPxPerMm} px/mm`],["Vector failures",r.failedVectorChunks],["Truncated",r.truncatedVectors],["Frame interval",`${M.frameIntervalMs.toFixed(2)} ms avg / ${M.frameIntervalP95Ms.toFixed(2)} p95`],["CPU frame",`${M.frameCpuMs.toFixed(2)} ms avg / ${M.frameCpuP95Ms.toFixed(2)} p95`],["FPS",M.fps.toFixed(1)]]:[["Renderer","WebGPU semantic glTF"],["Mode",M.mode==="3d"?"3D":"Layer Compare"],["Visible layers",M.mode==="3d"?k.visible3dLayers.size:k.compareLayers.size],["Resident tiles",k.scene.loaded.size],["Loading tiles",k.scene.loading.size],["Failed tiles",k.scene.failed.size],["Triangles",Math.round(k.triangles).toLocaleString()],["Downloaded",`${(k.loadedBytes/1048576).toFixed(1)} MB`],["Resident GLB",`${(k.residentTileBytes/1048576).toFixed(1)} MB`],["Resident GPU",`${(k.residentTileGpuBytes/1048576).toFixed(1)} MB`],["Tile loads",k.tileLoads.toLocaleString()],["Tile evictions",k.tileEvictions.toLocaleString()],["Tile scheduler",`${k.tileSchedulerMs.toFixed(2)} ms`],["Active net",k.scene.nets.find(n=>Number(n.id)===M.activeNetId)?.name||"-"],["Frame interval",`${M.frameIntervalMs.toFixed(2)} ms avg / ${M.frameIntervalP95Ms.toFixed(2)} p95`],["CPU frame",`${M.frameCpuMs.toFixed(2)} ms avg / ${M.frameCpuP95Ms.toFixed(2)} p95`],["FPS",M.fps.toFixed(1)]];Rn.innerHTML=s.map(([n,i])=>`<dt>${n}</dt><dd>${i}</dd>`).join("")}function ci(e){return`rgb(${e.slice(0,3).map(t=>Math.round(t*255)).join(" ")})`}function fE(){if(!qe)return;let e=k.scene.layers||[];if(!e.length){qe.innerHTML='<div class="selection-empty" style="padding:40px;text-align:center;">No stackup information available for this board.</div>';return}let t=e.filter(A=>["copper","dielectric","paste","silkscreen","soldermask"].includes(A.role)),r=k.topology.board?.stackup||{},a=A=>{if(A==null||A==="")return"None";let P=String(A);return H(P.includes(".")?P.split(".").pop():P)},s=(A,P=4)=>{let D=Number(A);return Number.isFinite(D)&&D>0?D.toFixed(P):"-"},n=(A,P=3)=>{let D=Number(A);return Number.isFinite(D)?D.toFixed(P):"-"},i=A=>{if(A==null||A==="")return"No";if(typeof A=="boolean")return A?"Yes":"No";let P=String(A).trim().toLowerCase(),D=P.includes(".")?P.split(".").pop():P;return["0","false","no","n","off","none"].includes(D)?"No":(["1","true","yes","y","on"].includes(D),"Yes")},o=A=>({copper:"Copper",dielectric:"Dielectric",paste:"Paste",silkscreen:"Silkscreen",soldermask:"Solder mask"})[A]||String(A||"Layer"),c=A=>A.role!=="dielectric"?"":A.type==="core"?"Core":A.type==="prepreg"||(A.material||"").toLowerCase().includes("prepreg")?"Prepreg":"Core",l=(A,P=4)=>{let D=Number(A.thickness_mm);return Number.isFinite(D)&&D>0?`${D.toFixed(P)} mm`:"Not specified"},f=A=>{let P=o(A.role),D=String(A.material||"").trim(),Q=D&&D.toLowerCase()!==String(A.role||"").toLowerCase();if(A.role==="dielectric"){let fe=[Q?D:"",s(A.epsilon_r,3)!=="-"?`\u03B5r ${s(A.epsilon_r,3)}`:"",s(A.loss_tangent,4)!=="-"?`tan \u03B4 ${s(A.loss_tangent,4)}`:""].filter(Boolean).join(" \xB7 ");return{primary:`${A.name} \xB7 ${c(A)}`,secondary:fe}}return{primary:[A.name,P,Q?D:""].filter(Boolean).join(" \xB7 "),secondary:""}},d=0,p=0,b=0,h=0;t.forEach(A=>{h+=A.thickness_mm||0,A.role==="copper"?A.name.toLowerCase().includes("gnd")||A.name.toLowerCase().includes("pwr")||A.name.toLowerCase().includes("plane")?p++:d++:A.role==="dielectric"&&b++});let u=k.scene.copperLayers||[],m=0,g=0,y=0,x=[...(k.scene.manifest?.barrels||[]).filter(A=>A.kind==="via"),...[...k.scene.features.values()].filter(A=>A.kind==="via")],v=qu(u,x);m=v.counts.thru,g=v.counts.blind,y=v.counts.buried;let E=v.spans,S=30,T=S,_=[],I=new Map(t.map((A,P)=>[A,P])),N=hE(t),C=(A,P)=>{let D=N.get(A.name);if(D!==void 0)return D;let Q=Number(A.stack_index);return Number.isFinite(Q)?Q:P+1e5},B=[...t].sort((A,P)=>{let D=C(A,I.get(A)||0),Q=C(P,I.get(P)||0);return D!==Q?D-Q:(P.z_mm||0)-(A.z_mm||0)});B.forEach(A=>{let P=12;A.role==="dielectric"?P=Math.max(160,Math.min(360,(A.thickness_mm||.1)*140)):A.role==="copper"?P=22:A.role==="soldermask"&&(P=14),_.push({...A,svgY:T,svgHeight:P}),T+=P});let R=800,j=130,q=240,Y=j+q+16,te=Y+84,we="";_.forEach(A=>{let P=A.color||"#7f7f7f";A.role==="copper"?P=A.color||"#f97316":A.role==="dielectric"?P="#a98d5c":A.role==="paste"?P="#cbd5e1":A.role==="soldermask"?P="#1b4332":A.role==="silkscreen"&&(P="#e2e8f0");let D=u.findIndex(ag=>ag.name===A.name),Q=f(A),fe=A.svgY+A.svgHeight/2,U=!!Q.secondary&&A.svgHeight>=38,ie=U?fe-5:fe+3,nt=H(A.id),ns=H(A.name),ft=Number.isFinite(Number(A.thickness_mm))&&Number(A.thickness_mm)>0,tg=H(ft?l(A):"\u2014"),rg=H([Q.primary,Q.secondary,`Thickness ${l(A)}`].filter(Boolean).join("; "));we+=`
      <g class="stackup-svg-layer" data-layer-id="${nt}" data-layer-name="${ns}">
        <title>${rg}</title>
        <rect x="${j}" y="${A.svgY}" width="${q}" height="${A.svgHeight}" fill="${P}" opacity="0.85" rx="1"/>
        <text x="${j-8}" y="${A.svgY+A.svgHeight/2+3}" fill="var(--muted)" font-size="9px" text-anchor="end" font-weight="700">
          ${A.role==="copper"?D+1:""}
        </text>
        <path class="stackup-layer-dimension" d="M ${Y+6} ${A.svgY+1} H ${Y} V ${A.svgY+A.svgHeight-1} H ${Y+6}" />
        <text class="stackup-layer-thickness" x="${Y+10}" y="${fe+3}" fill="var(--muted)" font-size="8.5px" font-weight="650">
          ${tg}
        </text>
        <text class="stackup-layer-name" x="${te}" y="${ie}" fill="var(--foreground)" font-size="9px" font-weight="650">
          ${H(Q.primary)}
        </text>
        ${U?`<text class="stackup-layer-metadata" x="${te}" y="${fe+10}" fill="var(--muted)" font-size="8px">${H(Q.secondary)}</text>`:""}
      </g>
    `});let ne="",me=_.filter(A=>A.role==="copper");E.forEach((A,P)=>{let D=_.find(ft=>ft.name===A.startName),Q=_.find(ft=>ft.name===A.endName);if(!D||!Q)return;let fe=D.svgY,U=Q.svgY+Q.svgHeight,ie=j+(P+1)*q/(E.length+1),nt=A.type==="thru"?"Thru":A.type==="blind"?"Blind":"Buried",ns=`var(--stackup-via-${A.type})`;ne+=`
      <g class="stackup-svg-via" data-via-type="${A.type}">
        <title>${nt}: ${A.startName} \u2192 ${A.endName}</title>
        ${me.map(ft=>ft.svgY>=D.svgY&&ft.svgY<=Q.svgY?`<rect x="${ie-5}" y="${ft.svgY}" width="10" height="${ft.svgHeight}" fill="${ns}" rx="0.5" />`:"").join("")}
        <rect x="${ie-2}" y="${fe}" width="4" height="${U-fe}" fill="${ns}" opacity="0.95" />
        <rect x="${ie-.75}" y="${fe-1}" width="1.5" height="${U-fe+2}" fill="var(--panel)" opacity="0.9" />
      </g>
    `});let Pe=`
    <svg class="stackup-visual-svg" viewBox="0 0 ${R} ${T+10}" width="${R}" height="${T+10}">
      <g class="stackup-svg-column-headings" aria-hidden="true">
        <text x="${Y+10}" y="15">Thickness</text>
        <text x="${te}" y="15">Layer / material properties</text>
      </g>
      <g class="stackup-total-dimension" aria-label="Total board thickness ${h.toFixed(4)} millimetres">
        <path d="M 76 ${S} H 68 V ${T} H 76" />
        <text x="68" y="15">Total ${h.toFixed(4)} mm</text>
      </g>
      ${we}
      ${ne}
    </svg>
    <div class="stackup-via-legend" aria-label="Via span legend">
      <span><i data-via-type="thru"></i>Thru</span>
      <span><i data-via-type="blind"></i>Blind</span>
      <span><i data-via-type="buried"></i>Buried</span>
    </div>
  `,he="";B.forEach(A=>{let P="silk";A.role==="copper"?P="copper":A.role==="dielectric"?P="dielectric":A.role==="paste"?P="paste":A.role==="soldermask"&&(P="mask");let D=c(A),Q=H(A.id),fe=H(A.name),U=f(A);he+=`
      <tr data-layer-id="${Q}" data-layer-name="${fe}" tabindex="0" aria-label="${H(`${U.primary}; thickness ${l(A)}`)}">
        <td><strong>${fe}</strong></td>
        <td><span class="stackup-badge ${P}">${A.role}</span></td>
        <td>${D||"-"}</td>
        <td>${H(A.material||"-")}</td>
        <td>${A.role==="dielectric"?s(A.epsilon_r,3):"-"}</td>
        <td>${A.role==="dielectric"?s(A.loss_tangent,4):"-"}</td>
        <td>${A.thickness_mm?A.thickness_mm.toFixed(4)+" mm":"-"}</td>
      </tr>
    `});let Re="",je=k.topology.board?.net_classes||[],Ve=A=>{let P=n(A);return P==="-"?P:`${P} mm`};je.length?je.forEach(A=>{Re+=`
        <tr>
          <td><strong>${A.name}</strong></td>
          <td>${Ve(A.track_width)}</td>
          <td>${Ve(A.clearance)}</td>
          <td>${Ve(A.diff_pair_width)}</td>
          <td>${Ve(A.diff_pair_gap)}</td>
          <td>${Number.isFinite(Number(A.via_diameter))?`${n(A.via_drill)}/${n(A.via_diameter)} mm`:"-"}</td>
        </tr>
      `}):Re=`
      <tr>
        <td colspan="6" class="selection-empty" style="text-align: center;">No design rules or impedance classes defined.</td>
      </tr>
    `,qe.innerHTML=`
    <div class="stackup-header">
      <div class="stackup-header-title">
        <h1>Layer Stackup</h1>
        <p>Board cross-section profile, layer properties & design rules</p>
      </div>
    </div>

    <div class="stackup-workspace-body">
      <div class="stackup-diagram-card">
        <span class="stackup-section-title">Cross-Section Profile</span>
        ${Pe}
      </div>
      <aside class="stackup-side-panel">
      <div class="stackup-summary-grid">
        <div class="stackup-summary-card">
          <label>Total Thickness</label>
          <span>${h.toFixed(4)} mm</span>
        </div>
        <div class="stackup-summary-card">
          <label>Copper Layers</label>
          <span>${u.length} (${d} Sig / ${p} Plane)</span>
        </div>
        <div class="stackup-summary-card">
          <label>Dielectrics</label>
          <span>${b} Layers</span>
        </div>
        <div class="stackup-summary-card">
          <label>Thru Vias</label>
          <span>${m}</span>
        </div>
        <div class="stackup-summary-card">
          <label>Blind Vias</label>
          <span>${g}</span>
        </div>
        <div class="stackup-summary-card">
          <label>Buried Vias</label>
          <span>${y}</span>
        </div>
      </div>
      <span class="stackup-section-title stackup-section-heading">Fabrication</span>
      <div class="stackup-summary-grid">
        <div class="stackup-summary-card">
          <label>Copper Finish</label>
          <span>${a(r.copper_finish)}</span>
        </div>
        <div class="stackup-summary-card">
          <label>Edge Connector</label>
          <span>${i(r.edge_connector)}</span>
        </div>
        <div class="stackup-summary-card">
          <label>Castellated Holes</label>
          <span>${i(r.castellated_pads)}</span>
        </div>
        <div class="stackup-summary-card">
          <label>Edge Plating</label>
          <span>${i(r.edge_plating)}</span>
        </div>
      </div>
      <div class="stackup-tables-container">
        <div class="stackup-table-section">
          <div class="stackup-section-title stackup-section-heading">
            <span>Layers Stackup</span>
            <small>Hover or focus a row to locate it</small>
          </div>
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
                ${he}
              </tbody>
            </table>
          </div>
        </div>

        <div class="stackup-table-section">
          <span class="stackup-section-title stackup-section-heading">Impedance Net Classes</span>
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
                ${Re}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      </aside>
    </div>
  `;let ye=(A,P)=>{qe.querySelectorAll(".stackup-svg-layer").forEach(D=>{let Q=D.dataset.layerId===A;D.classList.toggle("active",Q&&P)}),qe.querySelectorAll(".stackup-table tbody tr[data-layer-id]").forEach(D=>{let Q=D.dataset.layerId===A;D.classList.toggle("active",Q&&P)})},Er=A=>{let P=qe.querySelector(".stackup-diagram-card"),D=qe.querySelector(`.stackup-svg-layer[data-layer-id="${CSS.escape(A)}"]`);if(!P||!D||P.scrollHeight<=P.clientHeight)return;let Q=P.getBoundingClientRect(),fe=D.getBoundingClientRect(),U=P.scrollTop+fe.top-Q.top-(P.clientHeight-fe.height)/2,ie=window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;P.scrollTo({top:Math.max(0,U),behavior:ie?"auto":"smooth"})},Sr=(A,{revealDiagram:P=!1}={})=>{A.forEach(D=>{let Q=()=>{let U=D.dataset.layerId;ye(U,!0),P&&Er(U)},fe=()=>ye(null,!1);D.addEventListener("mouseenter",Q),D.addEventListener("mouseleave",fe),P&&(D.addEventListener("focus",Q),D.addEventListener("blur",fe))})};Sr(qe.querySelectorAll(".stackup-svg-layer")),Sr(qe.querySelectorAll(".stackup-table tbody tr[data-layer-id]"),{revealDiagram:!0})}function hE(e){let t=e.filter(s=>s.role==="dielectric");if(!(t.length===1&&t[0]?.name==="Board"))return new Map;let a=new Map;return["F.SilkS","F.Paste","F.Mask","F.Cu","Board","B.Cu","B.Mask","B.Paste","B.SilkS"].forEach((s,n)=>a.set(s,n)),a}function Yp(){let e=null;return{begin(){return e?.abort(),e=new AbortController,e},owns(t){return t!==null&&t===e&&!t.signal.aborted},cancel(){e?.abort(),e=null}}}async function Jp(e,t,{owner:r,bundleUrl:a,loadBundle:s,now:n=()=>performance.now()}){let i=n(),o={},{signal:c}=t,l=()=>r.owns(t)&&e.isConnected;try{e.renderLoading();let f=n(),{bundle:d,topology:p,semanticGeometry:b,assetCache:h}=await s(a,o,c);if(o.bundle_group_total_ms=n()-f,!l())return;e.renderShell();let u=n(),m=await e.mountViewer({topology:p,semanticGeometry:b,readiness:d.readiness,assetCache:h,signal:c});if(!l()){m?.dispose?.();return}e.publishController(m),o.mount_and_first_frame_ms=n()-u,Object.assign(o,m?.performance||{}),o.reload_to_visible_ms=n()-i,e.emitReady({schema:"prism.semantic_viewer_performance.a0",milestone:"board-visible",readiness_stage:d.readiness?.stage||"semantic-ready",readiness_progress:d.readiness?.progress??100,timings:o})}catch(f){if(!l())return;e.renderError(f),e.emitError(f)}}var bE="prism.visualizer_bundle.a0";function pE(){return`
    <style>
      ${el}
      #app { grid-template-columns: minmax(0, 1fr) 376px; }
      #app.panel-collapsed { grid-template-columns: minmax(0, 1fr) 46px; }
      #app.workspace-stackup { grid-template-columns: minmax(0, 1fr); }
      #selection-card { display: none !important; }
      #scene-stats {
        position: absolute; top: 12px; right: 12px; z-index: 4; margin: 0; padding: 8px 10px;
        display: grid; grid-template-columns: auto auto; gap: 2px 12px;
        background: rgb(15 20 28 / 0.82); color: #dbe4f0; border-radius: 6px;
        font: 11px/1.4 "SFMono-Regular", Consolas, monospace; font-variant-numeric: tabular-nums;
        pointer-events: none;
      }
      #scene-stats[hidden] { display: none; }
      #scene-stats dt { color: #8a97a8; }
      #scene-stats dd { margin: 0; text-align: right; }
      /* SB2-30a: level-of-detail thresholds, beside the stats in mode="system". */
      #lod-tuning {
        position: absolute; right: 12px; bottom: 12px; z-index: 4; width: 230px; padding: 8px 10px;
        background: rgb(15 20 28 / 0.86); color: #dbe4f0; border-radius: 6px;
        font: 11px/1.4 system-ui, -apple-system, "Segoe UI", sans-serif;
      }
      #lod-tuning[hidden] { display: none; }
      #lod-tuning h2 { margin: 0 0 6px; font-size: 11px; font-weight: 600; }
      #lod-tuning label { display: grid; grid-template-columns: 64px 1fr 30px; align-items: center; gap: 6px; }
      #lod-tuning input { width: 100%; margin: 0; }
      #lod-tuning output { text-align: right; font: 11px "SFMono-Regular", Consolas, monospace; font-variant-numeric: tabular-nums; }
      #lod-tuning button {
        margin-top: 6px; font: inherit; color: inherit; background: rgb(255 255 255 / 0.12);
        border: 0; border-radius: 4px; padding: 2px 8px; cursor: pointer;
      }
      /* System mode (SB2-31f): board labels, the move gizmo and the key list. */
      #system-labels { position: absolute; inset: 0; z-index: 2; pointer-events: none; overflow: hidden; }
      /* SB2-34: proxy harnesses, straight segments between connectors until M5's geometry. */
      #system-harnesses { position: absolute; inset: 0; width: 100%; height: 100%; z-index: 1; pointer-events: none; overflow: hidden; }
      #system-harnesses[hidden] { display: none; }
      #system-harnesses .segment { stroke: #1e293b; stroke-width: 2.5; stroke-dasharray: 7 5; stroke-linecap: round; filter: drop-shadow(0 0 1.5px rgb(255 255 255 / 0.9)); }
      #system-harnesses .segment.dim { opacity: 0.25; }
      #system-harnesses .segment.lit { stroke-width: 4.5; stroke-dasharray: none; opacity: 1; filter: drop-shadow(0 0 4px currentColor); }
      #system-harnesses .end { fill: #f8fafc; stroke: #1e293b; stroke-width: 2; }
      #system-harnesses .end.dim { opacity: 0.3; }
      #system-harnesses .end.lit { stroke: #fff; animation: harness-glow 1.9s ease-in-out infinite; }
      @keyframes harness-glow { 50% { opacity: 0.65; } }
      #system-labels[hidden] { display: none; }
      .scene-label {
        position: absolute; left: 0; top: 0; display: flex; flex-direction: column; align-items: center;
        padding: 2px 7px; border-radius: 5px; background: rgb(15 20 28 / 0.72); color: #f1f5f9;
        font: 500 11px/1.35 system-ui, -apple-system, "Segoe UI", sans-serif; white-space: nowrap; margin-top: -6px;
      }
      .scene-label[hidden] { display: none; }
      .scene-label span { font-weight: 400; color: #cbd5e1; font-size: 10px; }
      .scene-label.stand-in { background: rgb(71 85 105 / 0.78); }
      .scene-label.restricted { background: rgb(55 65 81 / 0.85); }
      .scene-label.failed { background: rgb(153 27 27 / 0.8); }
      .scene-label.selected { background: rgb(37 99 235 / 0.92); }
      /* SB2-45b: the picked harness's breakouts and waypoints in move mode, under the gizmo. */
      #harness-nodes { position: absolute; inset: 0; z-index: 2; width: 100%; height: 100%; overflow: visible; pointer-events: none; }
      #harness-nodes[hidden] { display: none; }
      #harness-nodes .node { fill: #f8fafc; stroke: #3e63dd; stroke-width: 2.5; pointer-events: visiblePainted; cursor: pointer; }
      #harness-nodes .node.breakout { fill: #3e63dd; stroke: #fff; }
      #harness-nodes .node.auto { fill: none; stroke: #3e63dd; stroke-dasharray: 3 2; }
      #harness-nodes .node { cursor: grab; }
      #harness-nodes .node.pinned { fill: #0f172a; }
      #harness-nodes .node.target { stroke: #f59e0b; stroke-width: 3.5; }
      #harness-nodes .node:hover { stroke-width: 4; }
      #move-gizmo { position: absolute; inset: 0; z-index: 3; width: 100%; height: 100%; overflow: visible; pointer-events: none; }
      #move-gizmo[hidden] { display: none; }
      #move-gizmo .ring { stroke-width: 2.5; opacity: 0.75; pointer-events: stroke; cursor: grab; }
      #move-gizmo .ring:hover { stroke-width: 5; opacity: 1; }
      #move-gizmo .arrow { pointer-events: visiblePainted; cursor: grab; }
      #move-gizmo .arrow line { stroke-width: 4; stroke-linecap: round; }
      #move-gizmo .arrow:hover line { stroke-width: 6; }
      #move-gizmo .arrow text { font: 700 11px system-ui, -apple-system, "Segoe UI", sans-serif; paint-order: stroke; }
      #move-gizmo .pivot { fill: #0f172a; stroke: #fff; stroke-width: 1.5; }
      #move-gizmo .readout { font: 600 12px system-ui, -apple-system, "Segoe UI", sans-serif; fill: #0f172a;
        paint-order: stroke; stroke: #fff; stroke-width: 3px; }
      #system-help { position: absolute; right: 12px; bottom: 12px; z-index: 4; margin: 0; padding: 10px 12px; max-width: 340px;
        display: grid; grid-template-columns: auto 1fr; gap: 3px 12px;
        background: rgb(15 20 28 / 0.9); color: #e2e8f0; border-radius: 8px;
        font: 12px/1.45 system-ui, -apple-system, "Segoe UI", sans-serif; }
      #system-help[hidden] { display: none; }
      #system-help h2 { grid-column: 1 / -1; margin: 0 0 4px; font-size: 12px; font-weight: 600; }
      #system-help kbd { font: 600 11px "SFMono-Regular", Consolas, monospace; color: #fff; }
      #system-help dd { margin: 0; color: #cbd5e1; }
      /* The host renders the PCB controls itself (see getViewState). */
      :host([hide-panel]) #app,
      :host([hide-panel]) #app.panel-collapsed { grid-template-columns: minmax(0, 1fr); }
      :host([hide-panel]) .panel { display: none !important; }
    </style>
    <main id="app">
      <section class="viewport-shell">
        <canvas id="viewport"></canvas>
        <div id="stackup-workspace-view" hidden></div>
        <div id="panel-labels"></div>
        <div id="selection-card" hidden></div>
        <canvas id="axis-gizmo" width="112" height="112" title="Click an axis to align the camera"></canvas>
        <dl id="scene-stats" hidden></dl>
        <div id="lod-tuning" role="group" aria-label="Level of detail thresholds" hidden></div>
        <svg id="system-harnesses" hidden aria-hidden="true"></svg>
        <div id="system-labels" hidden></div>
        <svg id="harness-nodes" hidden aria-hidden="true"></svg>
        <svg id="move-gizmo" hidden aria-hidden="true"></svg>
        <dl id="system-help" hidden aria-label="Keyboard shortcuts">
          <h2>Keyboard</h2>
          <dt><kbd>Home</kbd> <kbd>A</kbd></dt><dd>Frame every board</dd>
          <dt><kbd>Double-click</kbd></dt><dd>Select and frame</dd>
          <dt><kbd>X</kbd> <kbd>Y</kbd> <kbd>Z</kbd></dt><dd>Look along an axis (Shift: from the other side)</dd>
          <dt><kbd>F</kbd> <kbd>R</kbd></dt><dd>Flip the view, turn it a quarter</dd>
          <dt><kbd>I</kbd></dt><dd>Isolate the lit nets' copper, or back</dd>
          <dt><kbd>M</kbd></dt><dd>Move mode on or off (editors)</dd>
          <dt><kbd>L</kbd></dt><dd>Gizmo axes: world or the board's own</dd>
          <dt><kbd>Shift</kbd></dt><dd>While dragging: 0.1 mm and 1\xB0 steps (else 1 mm, 15\xB0)</dd>
          <dt><kbd>Enter</kbd></dt><dd>Save the shown position</dd>
          <dt><kbd>Esc</kbd></dt><dd>Undo the drag, leave move mode, or clear the selection</dd>
          <dt><kbd>\`</kbd></dt><dd>Scene stats</dd>
          <dt><kbd>?</kbd></dt><dd>This list</dd>
        </dl>
        <div id="fallback" hidden></div>
      </section>
      <aside class="panel">
        <nav class="panel-rail" aria-label="Viewer tools">
          <button class="rail-tab active" data-tab="layers" title="Layers">Layers</button>
          <button class="rail-tab" data-tab="search" title="Search and selection">Find</button>
          <button class="rail-tab" data-tab="view" title="View controls">View</button>
        </nav>
        <div class="panel-drawer">
          <header class="panel-mode-header">
            <div id="mode-switch"></div>
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
  `}function gE(e){return String(e).replace(/[&<>"']/g,t=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[t])}async function Qp(e,t=null,r="fetch",a=void 0){let s=performance.now(),n=await fetch(e,{cache:"no-store",signal:a});if(!n.ok)throw new Error(`Failed to load ${e}: ${n.status}`);let i=await n.json();return t&&(t[`${r}_fetch_parse_ms`]=performance.now()-s,t[`${r}_content_length`]=Number(n.headers.get("content-length")||0)),i}async function Zp(e,t,r){let a=new URL(e,document.baseURI).toString(),s=new URL(a).searchParams.get("viewer")||"",n=cs.open(),i=await n.peekJson(a).catch(()=>null),o=!!i;i||(i=await Qp(a,t,"bundle",r),mi(i)&&n.store(a,new TextEncoder().encode(JSON.stringify(i)))),t&&(t.bundle_from_cache=o);let c=mi(i)&&n.enabled?n:null;if(i.schema===Jc){let h={analytic:!0,cache_key:i.cache_key||"",readiness:i.readiness,assets:i.assets||{}};return{bundle:i,topology:{},semanticGeometry:gi(h,a,i,s),assetCache:c}}if(i.schema!==bE)throw new Error(`Unsupported visualizer bundle schema: ${i.schema||"missing"}`);let l=new URL(i.topology||"topology.json",a),f=new URL(i.semantic_geometry||"semantic_geometry.json",a),d=(h,u)=>c?c.fetchJson(h.toString(),{signal:r}):Qp(h,t,u,r),[p,b]=await Promise.all([d(l,"topology"),d(f,"semantic_geometry")]);return{bundle:i,topology:p,semanticGeometry:gi(b,a,i,s),assetCache:c}}var li=class extends HTMLElement{static get observedAttributes(){return["bundle-url","workspace","mode","move-allowed"]}constructor(){super(),this.attachShadow({mode:"open"}),this.reloadOwner=Yp(),this.reloadQueued=!1,this.reloadSource=null;let t=No();this.modes=Object.freeze({board:new pn(t),system:new gn(t)}),this.mounted=null}get activeMode(){return this.mounted??(this.systemMode?this.modes.system:this.modes.board)}detachModes(){this.modes.board.detach(),this.modes.system.detach(),this.mounted=null}connectedCallback(){this.queueReload()}disconnectedCallback(){this.reloadOwner.cancel(),this.detachModes(),this.reloadSource=null}attributeChangedCallback(t,r,a){if(!(!this.isConnected||r===a)){if(t==="workspace"){this.modes.board.setWorkspace(this.workspace);return}if(t==="move-allowed"){this.modes.system.setMoveAllowed(a==="true");return}this.queueReload()}}get workspace(){return this.getAttribute("workspace")==="stackup"?"stackup":"pcb"}get systemMode(){return this.getAttribute("mode")==="system"}queueReload(){let t=this.systemMode?"system":this.getAttribute("bundle-url");!t||t===this.reloadSource||(this.reloadSource=t,!this.reloadQueued&&(this.reloadQueued=!0,queueMicrotask(()=>{this.reloadQueued=!1,this.isConnected&&this.reload()})))}async reload(){let t=this.getAttribute("bundle-url"),r=this.reloadOwner.begin();if(this.detachModes(),this.systemMode){await this.reloadSystem(r);return}if(!t){this.shadowRoot.innerHTML="<style>:host{display:block;height:100%;font:14px system-ui;color:#94a3b8}</style><div>Semantic bundle URL is missing.</div>";return}await Jp(this,r,{owner:this.reloadOwner,bundleUrl:t,loadBundle:Zp})}async reloadSystem(t){let{signal:r}=t,a=()=>this.reloadOwner.owns(t)&&this.isConnected;try{this.renderShell();let s=await Jb({root:this.shadowRoot,loadBundle:(i,o)=>Zp(i,null,o),isActive:()=>this.getAttribute("active")==="true",onSelectionChange:i=>{r.aborted||this.emit("selectionchange",{selection:i})},onContextMenu:i=>{r.aborted||this.emit("contextmenu",i)},onViewStateChange:i=>{r.aborted||this.emitViewState(i)},onEmphasis:i=>{r.aborted||this.emit("emphasis",{results:i})},onMove:i=>{r.aborted||this.emit("move",i)},onHarness:i=>{r.aborted||this.emit("harness",i)}});if(!a()){s?.dispose?.();return}this.mounted=this.modes.system,this.mounted.attach(s,{moveAllowed:this.getAttribute("move-allowed")==="true"});let n=this.getViewState();n&&this.emitViewState(n),this.emitReady({schema:"prism.semantic_viewer_performance.a0",milestone:"system-mounted"})}catch(s){if(!a())return;this.renderError(s),this.emitError(s)}}emit(t,r){this.dispatchEvent(new CustomEvent(`prism-semantic-viewer:${t}`,{bubbles:!0,composed:!0,detail:r}))}renderLoading(){this.shadowRoot.innerHTML='<style>:host{display:block;height:100%;background:#020817;color:#e5e7eb;font:14px system-ui}</style><div style="display:grid;place-items:center;height:100%">Loading semantic visualizer...</div>'}renderShell(){this.shadowRoot.innerHTML=pE()}renderError(t){console.error(t),this.shadowRoot.innerHTML=`
      <style>
        :host{display:block;height:100%;background:#020817;color:#e5e7eb;font:14px system-ui}
        .error{height:100%;display:grid;place-items:center;padding:24px}
        pre{max-width:100%;white-space:pre-wrap;color:#fecaca;background:#111827;border:1px solid #374151;padding:16px}
      </style>
      <div class="error"><pre>${gE(t?.stack||t?.message||String(t))}</pre></div>
    `}mountViewer({topology:t,semanticGeometry:r,readiness:a,assetCache:s=null,signal:n}){return xc({root:this.shadowRoot,topology:t,semanticGeometry:r,readiness:a,workspaceScope:"3d",assetCache:s,isActive:()=>this.getAttribute("active")==="true",onSelectionChange:i=>{n.aborted||this.dispatchEvent(new CustomEvent("prism-semantic-viewer:selectionchange",{bubbles:!0,composed:!0,detail:{selection:i}}))},onContextMenu:i=>{n.aborted||this.dispatchEvent(new CustomEvent("prism-semantic-viewer:contextmenu",{bubbles:!0,composed:!0,detail:i}))},onViewStateChange:i=>{n.aborted||this.emitViewState(i)},onPerformanceEvent:i=>{n.aborted||(console.info("[prism-3d-perf]",i),this.dispatchEvent(new CustomEvent("prism-semantic-viewer:performance",{bubbles:!0,composed:!0,detail:i})))}})}publishController(t){this.mounted=this.modes.board,this.mounted.attach(t,{workspace:this.workspace});let r=this.getViewState();r&&this.emitViewState(r)}emitViewState(t){this.dispatchEvent(new CustomEvent("prism-semantic-viewer:viewstatechange",{bubbles:!0,composed:!0,detail:t}))}emitReady(t){console.info("[prism-3d-perf]",t),this.dispatchEvent(new CustomEvent("prism-semantic-viewer:ready",{bubbles:!0,composed:!0,detail:t}))}emitError(t){this.dispatchEvent(new CustomEvent("prism-semantic-viewer:error",{bubbles:!0,detail:{error:t}}))}};th(li.prototype);function eg(){customElements.get("prism-semantic-viewer")||customElements.define("prism-semantic-viewer",li)}window.__PRISM_SEMANTIC_VIEWER_MANUAL_BOOT__=!0;eg();
