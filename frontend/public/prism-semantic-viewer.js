function gi(t){let e=`${t.nodeName||""} ${t.meshName||""} ${t.material?.name||""}`.toLowerCase();return e.includes("_pad")||e.includes(".pad")||e.endsWith("pad")?"pad":e.includes("silkscreen")?"silkscreen":e.includes("soldermask")?"soldermask":e.includes("paste")?"paste":"substrate"}function Yc(t){let e=String(t.material?.name||"").toLowerCase();if(e.endsWith("_bottom"))return"back";if(e.endsWith("_top"))return"front";let r=t.bounds;return r&&(r[2]+r[5])/2<0?"back":"front"}function aa(t,e=()=>""){let r=new Map;for(let a of t){let n=`${e(a)}:${JSON.stringify(a.material)}`;r.has(n)||r.set(n,[]),r.get(n).push(a)}return[...r.values()].map(a=>{let s=a.reduce((h,u)=>h+u.position.length/3,0),n=a.reduce((h,u)=>h+u.indices.length,0),i=new Float32Array(s*3),o=new Float32Array(s*3),c=new Uint32Array(s),l=new Uint32Array(s),f=new Uint32Array(n),d=0,p=0,b=[1/0,1/0,1/0,-1/0,-1/0,-1/0];for(let h of a){let u=h.position.length/3;i.set(h.position,d*3),o.set(h.normal,d*3),c.set(h.netId,d),l.set(h.objectFeatureId,d);for(let m=0;m<h.indices.length;m+=1)f[p+m]=Number(h.indices[m])+d;h.bounds&&(b[0]=Math.min(b[0],h.bounds[0]),b[1]=Math.min(b[1],h.bounds[1]),b[2]=Math.min(b[2],h.bounds[2]),b[3]=Math.max(b[3],h.bounds[3]),b[4]=Math.max(b[4],h.bounds[4]),b[5]=Math.max(b[5],h.bounds[5])),d+=u,p+=h.indices.length}return{position:i,normal:o,netId:c,objectFeatureId:l,indices:f,material:a[0].material,groupKey:e(a[0]),bounds:Number.isFinite(b[0])?b:null}})}function sa(t){return!t||t.length!==6?null:[t[0]/1e3,-t[4]/1e3,t[2]/1e3,t[3]/1e3,-t[1]/1e3,t[5]/1e3]}function na(t){let e=t?.min||[0,0,0],r=t?.max||[.08,.0016,.05];return[e[0],-r[2],e[1],r[0],-e[2],r[1]]}function _r(t){let e=t.filter(r=>Array.isArray(r)&&r.length===6);return e.length?e.reduce((r,a)=>[Math.min(r[0],a[0]),Math.min(r[1],a[1]),Math.min(r[2],a[2]),Math.max(r[3],a[3]),Math.max(r[4],a[4]),Math.max(r[5],a[5])],[...e[0]]):null}function $c(t){let e=t.replace("#","");return[0,2,4].map(r=>parseInt(e.slice(r,r+2),16)/255)}var ug="#c83434",fg="#4d7fc4",cs=["#7fc87f","#ce7d2c","#4fcbcb","#db628b","#a7a5c6","#28ccd9","#e8b2a7","#f2eda1","#8dcb81","#ed7c33","#5bc3eb","#f76f8e","#a7a5c6","#28ccd9","#e8b2a7","#f2eda1","#ed7c33","#5bc3eb","#f76f8e","#a7a5c6","#28ccd9","#e8b2a7","#f2eda1","#ed7c33","#5bc3eb","#f76f8e","#a7a5c6","#28ccd9","#e8b2a7","#f2eda1"];function mi(t,e=0){if(t==="F.Cu")return ug;if(t==="B.Cu")return fg;let r=/^In(\d+)\.Cu$/.exec(String(t||""))?.[1],a=r?Number(r)-1:e;return cs[(a%cs.length+cs.length)%cs.length]}function Jc(t,e){if(typeof t?.color=="string"&&/^#[0-9a-fA-F]{6}$/.test(t.color))return[...$c(t.color),1];let r=String(t?.name||""),a=Math.max(0,e.findIndex(s=>s.name===r)-1);return[...$c(mi(r,a)),1]}function Qc(t,e){let r=e.map(a=>[Number(a.id),Number(a.z_mm||0)]);return r.length<3?!1:(r.sort((a,s)=>a[1]-s[1]),t!==r[0][0]&&t!==r[r.length-1][0])}var ra=Object.freeze({gold:[.83,.69,.37,1],silver:[.74,.75,.77,1],copper:[.76,.47,.28,1]});function Zc(t){let e=String(t||"").toLowerCase();return/hasl|hal\b|tin|silver|lead/.test(e)?ra.silver:/osp|bare|none/.test(e)?ra.copper:ra.gold}function el(t,e){let r=String(t?.name||"");return!!r&&(r===e[0]?.name||r===e[e.length-1]?.name)}function tl(t,e){let r=String(t.material?.name||"").endsWith("_bottom"),a=e.find(s=>s.name===(r?"B.Cu":"F.Cu"))||(r?e[e.length-1]:e[0]);return Number(a?.id||0)}var al="prism.viewer_3d.analytic.a0",xi={"F.SilkS":"#f2f2f2","B.SilkS":"#dddddd","F.Mask":"#316d4f","B.Mask":"#275840","F.Paste":"#c5cbd3","B.Paste":"#aeb7c2"},hg="#2f6b4f",bg={green:"#316d4f",red:"#a5272a",blue:"#1f4f8a",yellow:"#c9a227",white:"#e6e6e6",black:"#1a1a1a",purple:"#5b2d7a"},pg={conductor:"copper",dielectric:"dielectric",solder_mask:"soldermask",silkscreen:"silkscreen",paste:"paste"},gg={copper:"copper",dielectric:"FR4",soldermask:"soldermask",silkscreen:"ink",paste:"paste"};function mg(t,e){let r=String(t?.maskColors?.[e]||"").trim();return/^#[0-9a-f]{6}$/i.test(r)?r:bg[r.toLowerCase()]||(e==="back"?xi["B.Mask"]:xi["F.Mask"])}function yg(t,e=null){let r=[...t?.stack?.slices||[]].sort((c,l)=>c.order-l.order),a=c=>Number(c.thickness_nm||0)/1e6,n=r.reduce((c,l)=>c+a(l),0)/2,i=0,o=[];for(let c of r){let l=pg[c.role],f=a(c),d=n-f/2;if(n-=f,!l)continue;let p=String(c.kicad_layer||c.key),b=xi[p];l==="copper"&&(b=mi(p,p==="F.Cu"||p==="B.Cu"?0:i++)),l==="soldermask"&&(b=mg(e,c.side==="back"?"back":"front")),l==="dielectric"&&(b=c.color||hg),o.push({id:o.length+1,uid:`layer_${c.key}`,name:p,role:l,z_mm:+d.toFixed(6)||0,thickness_mm:+f.toFixed(6),material:c.material_name||gg[l],color:b||"#8a8a8a",visibility_group:l==="dielectric"?"board":l,stack_index:c.order,side:c.side||null,sliceKey:c.key})}return o}function xg(t){let e=t?.chunks||[],r=e.filter(s=>String(s.slice_key||"").startsWith("dielectric")),a=null;for(let s of r.length?r:e){let n=s.bounds;if(!n)continue;let i=[n.min_x_nm,n.min_y_nm,n.max_x_nm,n.max_y_nm].map(o=>Number(o)/1e6);a=a?[Math.min(a[0],i[0]),Math.min(a[1],i[1]),Math.max(a[2],i[2]),Math.max(a[3],i[3])]:i}return a}function sl(t,e=null){let r=yg(t,e),a=[{id:0,uid:"",name:"",netClass:""}];for(let c of t?.nets||[])c?.name&&a.push({id:a.length,uid:String(c.key||c.name),name:String(c.name),netClass:String(c.net_class||""),aliases:[]});let s=(t?.components||[]).map((c,l)=>({id:l+1,featureId:0,uid:String(c.source_uid||""),designator:String(c.refdes||""),footprint:String(c.footprint||""),side:c.side||null,nodeIndex:null,meshNames:[]})),n=xg(t),i=Number(t?.stack?.board_thickness_nm||0)/1e6;return{schema:"prism.analytic_scene.a0",bbox:n?{min:[n[0]/1e3,-i/2e3,n[1]/1e3],max:[n[2]/1e3,i/2e3,n[3]/1e3]}:null,layers:r,copperLayerIds:r.filter(c=>c.role==="copper").map(c=>c.id),nets:a,objectFeatures:[],components:s,tiles:[],barrels:[]}}var yi={green:[.06,.16,.11,.83],red:[.52,.05,.05,.83],blue:[.05,.12,.42,.83],black:[.05,.05,.05,.85],white:[.9,.9,.9,.83],purple:[.3,.1,.4,.83],yellow:[.7,.62,.1,.83]},wg=[.62,.63,.65,1],vg=[.9,.9,.88,1],Mg=t=>{let e=t/255;return e<=.04045?e/12.92:((e+.055)/1.055)**2.4};function rl(t){let e=String(t||"").trim().toLowerCase(),r=/^#([0-9a-f]{6})([0-9a-f]{2})?$/.exec(e);if(r){let a=[0,2,4].map(n=>parseInt(r[1].slice(n,n+2),16)),s=r[2]?parseInt(r[2],16)/255:yi.green[3];return[...a.map(n=>+Mg(n).toFixed(4)),+s.toFixed(4)]}return[...yi[e]||yi.green]}function nl(t){let e=t?.maskColors?.front||"";return{soldermask:{front:rl(e),back:rl(t?.maskColors?.back||e)},paste:[...wg],silkscreen:[...vg]}}var il=`:host,
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
`;var Eg=/\/api\/projects\/([^/]+)\/webgpu-3d\/assets\/([^/]+)\/([^/]+)\/(.+)$/,Sg="prism-bundle-cache-a0";var wi="manifest.json",ol=720*60*60*1e3,cl=2*1024*1024*1024;function vi(t){let e;try{e=new URL(t,"http://cache.invalid/")}catch{return null}let r=Eg.exec(e.pathname);if(!r)return null;let[,a,s,n,i]=r.map(decodeURIComponent);if(i.split("/").some(c=>!c||c==="."||c===".."))return null;let o=e.searchParams.get("viewer")||"";return`${a}/${s}/${n}/${i}${o?`?viewer=${o}`:""}`}function ls(t){return`a_${encodeURIComponent(t)}`}function Tg(t,e,{maxAgeMs:r=ol,maxBytes:a=cl}={}){let s=new Set,n=[];for(let[o,c]of Object.entries(t))e-Number(c.lastUsed||0)<=r?n.push([o,c]):s.add(o);n.sort((o,c)=>Number(c[1].lastUsed)-Number(o[1].lastUsed));let i=0;for(let[o,c]of n)i+=Number(c.bytes||0),i>a&&s.add(o);return[...s]}var ds=class t{static open(e={}){return t.shared||(t.shared=new t(e)),t.shared}constructor({maxAgeMs:e=ol,maxBytes:r=cl}={}){this.maxAgeMs=e,this.maxBytes=r,this.stats={hits:0,misses:0,bypassed:0,cachedBytes:0,networkBytes:0,writeErrors:0},this.ready=this.init(),this.flushTimer=null}async init(){try{let e=globalThis.navigator?.storage;if(!e?.getDirectory)return null;let a=await(await e.getDirectory()).getDirectoryHandle(Sg,{create:!0}),s=await a.getFileHandle(wi,{create:!0});if(typeof s.createWritable!="function")return null;let n={};try{let i=await(await s.getFile()).text();n=i?JSON.parse(i).entries||{}:{}}catch{n={}}return this.directory=a,this.entries=n,await this.prune(),globalThis.addEventListener?.("pagehide",()=>void this.flush()),a}catch{return null}}get enabled(){return!!this.directory}async fetchBytes(e,{store:r=!0,signal:a}={}){let s=vi(e);if(await this.ready,s&&this.directory){let c=await this.read(s);if(c)return this.stats.hits+=1,this.stats.cachedBytes+=c.byteLength,c;this.stats.misses+=1}else this.stats.bypassed+=1;let n=await fetch(e,{cache:"no-store",signal:a});if(!n.ok)throw new Error(`Failed to load ${e}: ${n.status}`);let i=await n.arrayBuffer(),o=Number(n.headers.get("content-length")||0);return this.stats.networkBytes+=i.byteLength,r&&s&&this.directory&&(!o||o===i.byteLength)&&this.write(s,i),i}async fetchJson(e,r={}){let a=await this.fetchBytes(e,r);return JSON.parse(new TextDecoder().decode(a))}async peekJson(e){let r=vi(e);if(await this.ready,!r||!this.directory)return null;let a=await this.read(r);return a?(this.stats.hits+=1,this.stats.cachedBytes+=a.byteLength,JSON.parse(new TextDecoder().decode(a))):null}async store(e,r){let a=vi(e);await this.ready,a&&this.directory&&await this.write(a,r)}async read(e){let r=this.entries[e];if(!r)return null;try{let a=await(await this.directory.getFileHandle(ls(e))).getFile();return a.size!==r.bytes?null:(r.lastUsed=Date.now(),this.scheduleFlush(),await a.arrayBuffer())}catch{return delete this.entries[e],null}}async write(e,r){try{let s=await(await this.directory.getFileHandle(ls(e),{create:!0})).createWritable();await s.write(r),await s.close(),this.entries[e]={bytes:r.byteLength,lastUsed:Date.now()},this.scheduleFlush()}catch{this.stats.writeErrors+=1}}adopt(e,r){this.directory&&(this.entries[e]={bytes:r,lastUsed:Date.now()},this.scheduleFlush())}async prune(e=Date.now()){if(!this.directory)return[];let r=Tg(this.entries,e,{maxAgeMs:this.maxAgeMs,maxBytes:this.maxBytes});for(let s of r)delete this.entries[s],await this.directory.removeEntry(ls(s)).catch(()=>{});let a=new Set(Object.keys(this.entries).map(ls));for await(let s of this.directory.keys())s!==wi&&!a.has(s)&&await this.directory.removeEntry(s).catch(()=>{});return r.length&&await this.flush(),r}async clear(){await this.ready,this.directory&&(this.entries={},await this.prune(),await this.flush())}summary(){let e=Object.values(this.entries||{});return{enabled:this.enabled,files:e.length,bytes:e.reduce((r,a)=>r+Number(a.bytes||0),0),...this.stats}}scheduleFlush(){this.flushTimer||(this.flushTimer=setTimeout(()=>{this.flushTimer=null,this.flush()},1e3))}async flush(){if(this.directory)try{let r=await(await this.directory.getFileHandle(wi,{create:!0})).createWritable();await r.write(JSON.stringify({schema:"prism.bundle_cache_manifest.a0",entries:this.entries})),await r.close()}catch{this.stats.writeErrors+=1}}};function Ag(t,e){if(!e)return t;let r=new URL(t);return r.searchParams.set("viewer",e),r.toString()}function Mi(t,e,r,a){let s=new URL(r.asset_base||"./",e),n=structuredClone(t||{}),i=o=>!o||typeof o!="string"?o:Ag(new URL(o,s).toString(),a);for(let o of["assets","semantic_gltf","schematic_world","schematic_vector","schematic_scene","bom"]){let c=n[o];if(!(!c||typeof c!="object"))for(let[l,f]of Object.entries(c))c[l]=i(f)}return n}function ki(t){return(t?.readiness?.stage||"semantic-ready")==="semantic-ready"&&(t?.readiness?.progress??100)>=100}var fe=(t,e,r)=>Math.max(e,Math.min(r,t)),fs=(t,e,r)=>t+(e-t)*r;function Oe(t,e){return[t[0]+e[0],t[1]+e[1],t[2]+e[2]]}function _g(t,e){return[t[0]-e[0],t[1]-e[1],t[2]-e[2]]}function Me(t,e){return[t[0]*e,t[1]*e,t[2]*e]}function Ig(t){return Math.hypot(t[0],t[1],t[2])}function Qe(t){let e=Ig(t)||1;return Me(t,1/e)}function Ze(t,e){return[t[1]*e[2]-t[2]*e[1],t[2]*e[0]-t[0]*e[2],t[0]*e[1]-t[1]*e[0]]}function ot(t,e){return t[0]*e[0]+t[1]*e[1]+t[2]*e[2]}function ll(t,e){let r=e/2,a=Math.sin(r),s=Qe(t);return[s[0]*a,s[1]*a,s[2]*a,Math.cos(r)]}function us(t,e){return[t[3]*e[0]+t[0]*e[3]+t[1]*e[2]-t[2]*e[1],t[3]*e[1]-t[0]*e[2]+t[1]*e[3]+t[2]*e[0],t[3]*e[2]+t[0]*e[1]-t[1]*e[0]+t[2]*e[3],t[3]*e[3]-t[0]*e[0]-t[1]*e[1]-t[2]*e[2]]}function Ei(t,e){let r=[e[0],e[1],e[2],0],a=[-t[0],-t[1],-t[2],t[3]];return us(us(t,r),a).slice(0,3)}function cr(t,e){let r=new Float32Array(16);for(let a=0;a<4;a+=1)for(let s=0;s<4;s+=1)r[a*4+s]=t[s]*e[a*4]+t[4+s]*e[a*4+1]+t[8+s]*e[a*4+2]+t[12+s]*e[a*4+3];return r}function hs(t,e,r){let a=Qe(_g(t,e)),s=Qe(Ze(r,a)),n=Ze(a,s);return new Float32Array([s[0],n[0],a[0],0,s[1],n[1],a[1],0,s[2],n[2],a[2],0,-ot(s,t),-ot(n,t),-ot(a,t),1])}function dl(t,e,r,a){let s=1/Math.tan(t/2);return new Float32Array([s/e,0,0,0,0,s,0,0,0,0,r/(a-r),-1,0,0,r*a/(a-r),0])}function bs(t,e,r,a){return new Float32Array([2/t,0,0,0,0,2/e,0,0,0,0,1/(a-r),0,0,0,1,1])}function Si(t){return[(t[0]+t[3])/2,(t[1]+t[4])/2,(t[2]+t[5])/2]}function Ot(t){return Math.max(.001,Math.hypot(t[3]-t[0],t[4]-t[1],t[5]-t[2])/2)}var ia=class{constructor(e){let r=Si(e),a=Ot(e);this.focus=[...r],this.targetFocus=[...r],this.azimuth=-.62,this.targetAzimuth=this.azimuth,this.polar=.72,this.targetPolar=this.polar,this.distance=a*2.8,this.targetDistance=this.distance,this.orthoScale=a*2.15,this.targetOrthoScale=this.orthoScale,this.sceneRadius=a,this.fov=Math.PI/4}update(e){let r=1-Math.exp(-e*14);this.focus=this.focus.map((a,s)=>fs(a,this.targetFocus[s],r)),this.azimuth=fl(this.azimuth,this.targetAzimuth,r),this.polar=fl(this.polar,this.targetPolar,r),this.distance=fs(this.distance,this.targetDistance,r),this.orthoScale=fs(this.orthoScale,this.targetOrthoScale,r)}snap(){this.focus=[...this.targetFocus],this.azimuth=this.targetAzimuth,this.polar=this.targetPolar,this.distance=this.targetDistance,this.orthoScale=this.targetOrthoScale}basis(){let e=Math.sin(this.polar),r=Math.cos(this.polar),a=Qe([e*Math.sin(this.azimuth),-e*Math.cos(this.azimuth),r]),s=Qe([Math.cos(this.azimuth),Math.sin(this.azimuth),0]),n=Qe(Ze(a,s));return{right:s,up:n,back:a}}matrix(e,r,a=!1,s=1){let n=Math.max(.01,e/Math.max(1,r)),{up:i,back:o}=this.basis(),c=Oe(this.focus,Me(o,this.distance)),l=hs(c,this.focus,i),f=a?bs(this.orthoScale*s*n,this.orthoScale*s,-this.sceneRadius*40,this.sceneRadius*40):dl(this.fov,n,Math.max(this.sceneRadius*5e-4,this.distance-this.sceneRadius*3.5),this.distance+this.sceneRadius*4.5);return cr(f,l)}targetMatrix(e,r,a=!1,s=0){let n=(l,f)=>f+(f-l)*s,i=[this.focus,this.azimuth,this.polar,this.distance,this.orthoScale];this.focus=this.focus.map((l,f)=>n(l,this.targetFocus[f]));let o=(l,f)=>f+Math.atan2(Math.sin(f-l),Math.cos(f-l))*s;this.azimuth=o(this.azimuth,this.targetAzimuth),this.polar=o(this.polar,this.targetPolar),this.distance=Math.max(this.sceneRadius*.001,n(this.distance,this.targetDistance)),this.orthoScale=Math.max(this.sceneRadius*.001,n(this.orthoScale,this.targetOrthoScale));let c=this.matrix(e,r,a);return[this.focus,this.azimuth,this.polar,this.distance,this.orthoScale]=i,c}moving(){let e=(r,a)=>Math.abs(r-a)<=Math.max(1e-9,Math.abs(a)*1e-4);return!(this.focus.every((r,a)=>e(r,this.targetFocus[a]))&&e(this.azimuth,this.targetAzimuth)&&e(this.polar,this.targetPolar)&&e(this.distance,this.targetDistance)&&e(this.orthoScale,this.targetOrthoScale))}orbit(e,r){let a=Math.sin(this.targetPolar)<0?-1:1;this.targetAzimuth-=a*e*.006,this.targetPolar=ul(this.targetPolar-r*.006)}isBelow(){return Math.cos(this.targetPolar)<0}pan(e,r,a,s=!1){let{right:n,up:i}=this.basis(),o=s?this.targetOrthoScale/Math.max(1,a):2*this.targetDistance*Math.tan(this.fov/2)/Math.max(1,a),c=Oe(Me(n,-e*o),Me(i,r*o));this.targetFocus=Oe(this.targetFocus,c)}dolly(e,r=!1){let a=Math.exp(e*.0032);r?this.targetOrthoScale=fe(this.targetOrthoScale*a,this.sceneRadius*.008,this.sceneRadius*24):this.targetDistance=fe(this.targetDistance*a,this.sceneRadius*.01,this.sceneRadius*48)}frame(e){if(!e)return;let r=Ot(e);this.targetFocus=Si(e),this.targetDistance=Math.max(r*2.8,this.sceneRadius*.02),this.targetOrthoScale=Math.max(r*2.15,this.sceneRadius*.02)}setFocus(e){this.targetFocus=[...e]}setAxis(e,r=!1){e==="z"?(this.targetAzimuth=0,this.targetPolar=r?Math.PI-.015:.015):e==="x"?(this.targetAzimuth=r?-Math.PI/2:Math.PI/2,this.targetPolar=Math.PI/2):(this.targetAzimuth=r?0:Math.PI,this.targetPolar=Math.PI/2)}rotateZ(e=1){this.targetAzimuth+=e*Math.PI/2}flip(){this.targetPolar=ul(Math.PI-this.targetPolar)}};function ul(t){return Math.atan2(Math.sin(t),Math.cos(t))}function fl(t,e,r){let a=Math.atan2(Math.sin(e-t),Math.cos(e-t));return t+a*r}var ps=class t{static async create(e,r,a={}){let s=await fetch(r,{cache:"default"});if(!s.ok)throw new Error(`Failed to load BoM ${r}: ${s.status}`);let n=await s.json();if(n.schema!=="prism.bom_a0")throw new Error(`Unsupported BoM schema: ${n.schema||"missing"}`);let i=new t(e,n,a);return i.render(),i}constructor(e,r,a){this.container=e,this.payload=r,this.callbacks=a,this.query="",this.selectedRowId="",this.selectedReference="",this.rowsById=new Map((r.rows||[]).map(s=>[s.id,s])),this.componentIndex=new Map(Object.entries(r.componentIndex||{}))}setSelectionByReference(e,r={}){let a=this.componentIndex.get(e);a&&(this.selectedReference=e,this.selectedRowId=a.rowId,this.renderContent(),r.scroll&&this.container.querySelector(`[data-row-id="${Cg(a.rowId)}"]`)?.scrollIntoView({block:"center",behavior:"smooth"}))}clearSelection(){this.selectedReference="",this.selectedRowId="",this.renderContent()}render(){let e=this.filteredRows();this.container.innerHTML=`
      <section class="bom-workspace">
        <header class="bom-toolbar">
          <div>
            <p class="eyebrow">Prism BoM A0</p>
            <h2>Bill of Materials</h2>
            <span data-bom-count>${e.length} of ${(this.payload.rows||[]).length} grouped rows \xB7 ${(this.payload.components||[]).length} components</span>
          </div>
          <label class="bom-search">
            <span>Search</span>
            <input id="bom-search" type="search" value="${et(this.query)}" placeholder="Reference, value, footprint, manufacturer..." />
          </label>
        </header>
        <div class="bom-content" data-bom-content>
          ${this.contentHtml(e,this.payload.displayColumns||[])}
        </div>
      </section>
    `,this.bind()}renderContent(){let e=this.container.querySelector("[data-bom-content]");if(!e){this.render();return}let r=this.filteredRows();e.innerHTML=this.contentHtml(r,this.payload.displayColumns||[]);let a=this.container.querySelector("[data-bom-count]");a&&(a.textContent=`${r.length} of ${(this.payload.rows||[]).length} grouped rows \xB7 ${(this.payload.components||[]).length} components`),this.bindContent(e)}contentHtml(e,r){let a=this.rowsById.get(this.selectedRowId);return`
      <div class="bom-table-wrap">
        <table class="bom-table">
          <thead>
            <tr>${r.map(s=>`<th>${et(s)}</th>`).join("")}</tr>
          </thead>
          <tbody>
            ${e.map(s=>this.rowHtml(s,r)).join("")}
          </tbody>
        </table>
      </div>
      ${a?`<aside class="bom-detail">${this.detailHtml(a)}</aside>`:""}
    `}filteredRows(){let e=this.query.trim().toLowerCase(),r=this.payload.rows||[];return e?r.filter(a=>JSON.stringify(a).toLowerCase().includes(e)):r}rowHtml(e,r){return`
      <tr class="${e.id===this.selectedRowId?"selected":""}" data-row-id="${et(e.id)}">
        ${r.map(s=>{let n=e.fields?.[s]||"";return s==="Reference"?`<td class="bom-reference-cell">${(e.references||[]).map(i=>`
              <button class="bom-ref-chip ${i===this.selectedReference?"active":""}" data-reference="${et(i)}">${et(i)}</button>
            `).join("")}</td>`:!n&&Ng(s)?'<td><span class="bom-missing">Missing</span></td>':`<td title="${et(n)}">${et(n)}</td>`}).join("")}
      </tr>
    `}detailHtml(e){let r=Rg(e,this.payload.displayColumns||[],this.payload.extraColumns||[]);return`
      <div class="bom-detail-head">
        <p class="eyebrow">Line item</p>
        <h3>${et((e.references||[]).join(", "))}</h3>
        <span>${e.qty} component${e.qty===1?"":"s"}${e.dnp?" \xB7 DNP":""}</span>
      </div>
      <div class="bom-ref-list">
        ${(e.references||[]).map(a=>`
          <button class="bom-ref-chip detail ${a===this.selectedReference?"active":""}" data-reference="${et(a)}">${et(a)}</button>
        `).join("")}
      </div>
      <dl class="bom-field-list">
        ${r.map(([a,s])=>`
          <div>
            <dt>${et(a)}</dt>
            <dd>${et(s)}</dd>
          </div>
        `).join("")}
      </dl>
    `}bind(){let e=this.container.querySelector("#bom-search");e?.addEventListener("input",()=>{this.query=e.value,this.renderContent()}),this.bindContent(this.container)}bindContent(e){e.querySelectorAll("[data-row-id]").forEach(r=>{r.addEventListener("click",a=>{a.target.closest("[data-reference]")||(this.selectedRowId=r.dataset.rowId,this.selectedReference="",this.renderContent())})}),e.querySelectorAll("[data-reference]").forEach(r=>{r.addEventListener("click",a=>{a.stopPropagation();let s=r.dataset.reference;this.setSelectionByReference(s),this.callbacks.onSelectReference?.(s)})})}};function Rg(t,e,r){let a=[],s=new Set(["Reference","Qty"].map(Ti));for(let i of e){if(i==="Reference"||i==="Qty")continue;let o=t.fields?.[i]||"";o&&(a.push([i,o]),s.add(Ti(i)))}let n=t.canonicalFields||{};for(let i of r){let o=n[i]||"";if(!o)continue;let c=Ti(i);s.has(c)||(s.add(c),a.push([i,o]))}return a}function Ti(t){return String(t||"").toLowerCase().replace(/[\s_\-()[\]/]+/g,"")}function Ng(t){return["Manufacturer Part Number","Vendor Part Number","Datasheet","Footprint","Value"].includes(t)}function et(t){return String(t??"").replace(/[&<>"']/g,e=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[e])}function Cg(t){return String(t).replace(/["\\]/g,"\\$&")}function hl(t,e=new Map){let r=new Map;for(let s of t||[]){let n=String(s?.designator||"");if(!n)continue;let i=r.get(n)||{reference:n,featureIds:new Set,modelCount:0},o=Number(s?.featureId)||0;o>0&&i.featureIds.add(o),r.set(n,i)}for(let[s,n]of e||[]){let i=r.get(String(s));i&&(i.modelCount=Math.max(i.modelCount,Number(n)||0))}let a=new Map;for(let[s,n]of r)a.set(s,{reference:s,featureIds:[...n.featureIds].sort((i,o)=>i-o),ambiguous:n.featureIds.size>1||n.modelCount>1});return a}function bl(t,e){let r=[...new Set((Array.isArray(t)?t:[]).map(c=>String(c||"")).filter(Boolean))],a=[],s=[],n=[],i=new Set,o=new Set;for(let c of r){let l=e.get(c);if(!l){n.push(c);continue}if(l.ambiguous){s.push(c);continue}a.push(c),o.add(c);for(let f of l.featureIds)i.add(f)}return{requested:r,applied:a,ambiguous:s,unknown:n,hiddenFeatureIds:i,hiddenReferences:o}}function gs(t,e){return!!t&&e.has(String(t))}var Bg={"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"};function H(t){return String(t??"").replace(/[&<>"']/g,e=>Bg[e])}var oa=`
fn netEmphasized(id: u32) -> bool {
  return id != 0u && id < arrayLength(&netMask) && netMask[id] != 0u;
}
`;function ms(t){let e=new Set;if(t==null)return e;for(let r of t){let a=Number(r);!Number.isInteger(a)||a<=0||a>4294967295||e.add(a)}return e}function pl(t,e=0){let r=0;for(let s of ms(t))r=Math.max(r,s);let a=64;for(;a<r+1;)a*=2;return Math.max(a,Math.floor(e)||0)}function gl(t,e){let r=Math.max(64,Math.floor(e)||0),a=new Uint32Array(r);a.fill(0);for(let s of ms(t))s<r&&(a[s]=1);return a}function lr(t,e){return!Array.isArray(t)||!e?null:t.find(r=>r.name===e||Array.isArray(r.aliases)&&r.aliases.includes(e))||null}function ml(t,e){let r=new Set;if(!Array.isArray(t)||!Array.isArray(e))return r;for(let a of e){if(!a)continue;let s=a.netUid&&t.find(i=>i.uid===a.netUid)||a.netName&&lr(t,a.netName),n=Number(s?.id);Number.isInteger(n)&&n>0&&r.add(n)}return r}var Ai=Object.freeze([[.08,1,.2],[1,.72,.1],[.2,.75,1],[1,.3,.75],[.65,.45,1],[1,.45,.2],[.3,1,.85],[.95,.95,.3]]),yl=`
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
`;function xl(t){let e=null;return Array.isArray(t)&&t.length>=3&&t.slice(0,3).every(r=>Number.isFinite(Number(r)))?e=t.slice(0,3).map(r=>Math.round(Math.min(1,Math.max(0,Number(r)))*255)):typeof t=="string"&&/^#[0-9a-f]{6}$/i.test(t)&&(e=[1,3,5].map(r=>parseInt(t.slice(r,r+2),16))),e?(1<<24|e[0]<<16|e[1]<<8|e[2])>>>0:1}function wl(t){let e=1;for(let a of t)for(let s of a?.keys()||[])e=Math.max(e,s+1);let r=new Uint32Array(Math.max(64,t.length*e));return t.forEach((a,s)=>{for(let[n,i]of a||[])Number.isInteger(n)&&n>0&&(r[s*e+n]=i>>>0)}),{stride:e,data:r}}function Og(t){return(typeof t.composedPath=="function"?t.composedPath():[])[0]??t.target??null}function vl(t){let e=Og(t);if(!e||typeof e!="object")return!1;let r=typeof e.tagName=="string"?e.tagName.toUpperCase():"";return r==="INPUT"||r==="TEXTAREA"||r==="SELECT"||e.isContentEditable===!0}function Ml(t){return!!(t.metaKey||t.ctrlKey)}var Fg=4;function kl(t,e=Fg){let r=new Map,a=[];for(let n of t){if(n.placements.length<e){for(let o of n.placements)a.push(Pg(n.primitive,o));continue}let i=`${n.placements.map(o=>o.node).join(",")}|${JSON.stringify(n.primitive.material)}`;r.has(i)||r.set(i,[]),r.get(i).push(n)}return{instanced:[...r.values()].map(n=>({primitive:jg(n.map(i=>i.primitive)),placements:n[0].placements})),baked:aa(a)}}function Pg(t,e){let{rows:r,featureId:a,bounds:s}=e,n=t.position.length/3,i=new Float32Array(n*3),o=new Float32Array(n*3),c=new Uint32Array(n);for(let l=0;l<n;l+=1){let f=l*3,[d,p,b]=[t.position[f],t.position[f+1],t.position[f+2]],[h,u,m]=[t.normal[f],t.normal[f+1],t.normal[f+2]],g=0;for(let y=0;y<3;y+=1){let x=y*4;i[f+y]=r[x]*d+r[x+1]*p+r[x+2]*b+r[x+3],o[f+y]=r[x]*h+r[x+1]*u+r[x+2]*m,g+=o[f+y]**2}g=Math.sqrt(g)||1;for(let y=0;y<3;y+=1)o[f+y]/=g;c[l]=t.objectFeatureId[l]||a||0}return{position:i,normal:o,netId:t.netId,objectFeatureId:c,indices:t.indices,material:t.material,bounds:[...s]}}function jg(t){if(t.length===1)return t[0];let e=t.reduce((d,p)=>d+p.position.length/3,0),r=t.reduce((d,p)=>d+p.indices.length,0),a=new Float32Array(e*3),s=new Float32Array(e*3),n=new Uint32Array(e),i=new Uint32Array(e),o=new Uint32Array(r),c=[1/0,1/0,1/0,-1/0,-1/0,-1/0],l=0,f=0;for(let d of t){a.set(d.position,l*3),s.set(d.normal,l*3),n.set(d.netId,l),i.set(d.objectFeatureId,l);for(let p=0;p<d.indices.length;p+=1)o[f+p]=d.indices[p]+l;for(let p=0;p<3;p+=1)c[p]=Math.min(c[p],d.bounds[p]),c[p+3]=Math.max(c[p+3],d.bounds[p+3]);l+=d.position.length/3,f+=d.indices.length}return{position:a,normal:s,netId:n,objectFeatureId:i,indices:o,material:t[0].material,bounds:c}}var El=class{_listeners={};addEventListener(t,e){let r=this._listeners;return r[t]===void 0&&(r[t]=[]),r[t].indexOf(e)===-1&&r[t].push(e),this}removeEventListener(t,e){let r=this._listeners[t];if(r!==void 0){let a=r.indexOf(e);a!==-1&&r.splice(a,1)}return this}dispatchEvent(t){let e=this._listeners[t.type];if(e!==void 0){let r=e.slice(0);for(let a=0,s=r.length;a<s;a++)r[a].call(this,t)}return this}dispose(){for(let t in this._listeners)delete this._listeners[t]}},Pt=class{_disposed=!1;_name;_parent;_child;_attributes;constructor(t,e,r,a={}){if(this._name=t,this._parent=e,this._child=r,this._attributes=a,!e.isOnGraph(r))throw new Error("Cannot connect disconnected graphs.")}getName(){return this._name}getParent(){return this._parent}getChild(){return this._child}setChild(t){return this._child=t,this}getAttributes(){return this._attributes}dispose(){this._disposed||(this._parent._destroyRef(this),this._disposed=!0)}isDisposed(){return this._disposed}},_i=class extends El{_emptySet=new Set;_edges=new Set;_parentEdges=new Map;_childEdges=new Map;listEdges(){return Array.from(this._edges)}listParentEdges(t){return Array.from(this._childEdges.get(t)||this._emptySet)}listParents(t){let e=new Set;for(let r of this.listParentEdges(t))e.add(r.getParent());return Array.from(e)}listChildEdges(t){return Array.from(this._parentEdges.get(t)||this._emptySet)}listChildren(t){let e=new Set;for(let r of this.listChildEdges(t))e.add(r.getChild());return Array.from(e)}disconnectParents(t,e){for(let r of this.listParentEdges(t))(!e||e(r.getParent()))&&r.dispose();return this}_createEdge(t,e,r,a){let s=new Pt(t,e,r,a);this._edges.add(s);let n=s.getParent();this._parentEdges.has(n)||this._parentEdges.set(n,new Set),this._parentEdges.get(n).add(s);let i=s.getChild();return this._childEdges.has(i)||this._childEdges.set(i,new Set),this._childEdges.get(i).add(s),s}_destroyEdge(t){return this._edges.delete(t),this._parentEdges.get(t.getParent()).delete(t),this._childEdges.get(t.getChild()).delete(t),this}},Fe=class{list=[];constructor(t){if(t)for(let e of t)this.list.push(e)}add(t){this.list.push(t)}remove(t){let e=this.list.indexOf(t);e>=0&&this.list.splice(e,1)}removeChild(t){let e=[];for(let r of this.list)r.getChild()===t&&e.push(r);for(let r of e)this.remove(r);return e}listRefsByChild(t){let e=[];for(let r of this.list)r.getChild()===t&&e.push(r);return e}values(){return this.list}},le=class{set=new Set;map=new Map;constructor(t){if(t)for(let e of t)this.add(e)}add(t){let e=t.getChild();this.removeChild(e),this.set.add(t),this.map.set(e,t)}remove(t){this.set.delete(t),this.map.delete(t.getChild())}removeChild(t){let e=this.map.get(t)||null;return e&&this.remove(e),e}getRefByChild(t){return this.map.get(t)||null}values(){return Array.from(this.set)}},ke=class{map={};constructor(t){t&&Object.assign(this.map,t)}set(t,e){this.map[t]=e}delete(t){delete this.map[t]}get(t){return this.map[t]||null}keys(){return Object.keys(this.map)}values(){return Object.values(this.map)}},ae=Symbol("attributes"),Ft=Symbol("immutableKeys"),Sl=class Tl extends El{_disposed=!1;graph;[ae];[Ft];constructor(e){super(),this.graph=e,this[Ft]=new Set,this[ae]=this._createAttributes()}getDefaults(){return{}}_createAttributes(){let e=this.getDefaults(),r={};for(let a in e){let s=e[a];if(s instanceof Tl){let n=this.graph._createEdge(a,this,s);this[Ft].add(a),r[a]=n}else r[a]=s}return r}isOnGraph(e){return this.graph===e.graph}isDisposed(){return this._disposed}dispose(){this._disposed||(this.graph.listChildEdges(this).forEach(e=>e.dispose()),this.graph.disconnectParents(this),this._disposed=!0,this.dispatchEvent({type:"dispose"}))}detach(){return this.graph.disconnectParents(this),this}swap(e,r){for(let a in this[ae]){let s=this[ae][a];if(s instanceof Pt){let n=s;n.getChild()===e&&this.setRef(a,r,n.getAttributes())}else if(s instanceof Fe)for(let n of s.listRefsByChild(e)){let i=n.getAttributes();this.removeRef(a,e),this.addRef(a,r,i)}else if(s instanceof le){let n=s.getRefByChild(e);if(n){let i=n.getAttributes();this.removeRef(a,e),this.addRef(a,r,i)}}else if(s instanceof ke)for(let n of s.keys()){let i=s.get(n);i.getChild()===e&&this.setRefMap(a,n,r,i.getAttributes())}}return this}get(e){return this[ae][e]}set(e,r){return this[ae][e]=r,this.dispatchEvent({type:"change",attribute:e})}getRef(e){let r=this[ae][e];return r?r.getChild():null}setRef(e,r,a){if(this[Ft].has(e))throw new Error(`Cannot overwrite immutable attribute, "${e}".`);let s=this[ae][e];if(s&&s.dispose(),!r)return this;let n=this.graph._createEdge(e,this,r,a);return this[ae][e]=n,this.dispatchEvent({type:"change",attribute:e})}listRefs(e){return this.assertRefList(e).values().map(r=>r.getChild())}addRef(e,r,a){let s=this.graph._createEdge(e,this,r,a);return this.assertRefList(e).add(s),this.dispatchEvent({type:"change",attribute:e})}removeRef(e,r){let a=this.assertRefList(e);if(a instanceof Fe)for(let s of a.listRefsByChild(r))s.dispose();else{let s=a.getRefByChild(r);s&&s.dispose()}return this}assertRefList(e){let r=this[ae][e];if(r instanceof Fe||r instanceof le)return r;throw new Error(`Expected RefList or RefSet for attribute "${e}"`)}listRefMapKeys(e){return this.assertRefMap(e).keys()}listRefMapValues(e){return this.assertRefMap(e).values().map(r=>r.getChild())}getRefMap(e,r){let a=this.assertRefMap(e).get(r);return a?a.getChild():null}setRefMap(e,r,a,s){let n=this.assertRefMap(e),i=n.get(r);if(i&&i.dispose(),!a)return this;s=Object.assign(s||{},{key:r});let o=this.graph._createEdge(e,this,a,{...s,key:r});return n.set(r,o),this.dispatchEvent({type:"change",attribute:e,key:r})}assertRefMap(e){let r=this[ae][e];if(r instanceof ke)return r;throw new Error(`Expected RefMap for attribute "${e}"`)}dispatchEvent(e){return super.dispatchEvent({...e,target:this}),this.graph.dispatchEvent({...e,target:this,type:`node:${e.type}`}),this}_destroyRef(e){let r=e.getName();if(this[ae][r]===e)this[ae][r]=null,this[Ft].has(r)&&e.getChild().dispose();else if(this[ae][r]instanceof Fe)this[ae][r].remove(e);else if(this[ae][r]instanceof le)this[ae][r].remove(e);else if(this[ae][r]instanceof ke){let a=this[ae][r];for(let s of a.keys())a.get(s)===e&&a.delete(s)}else return;this.graph._destroyEdge(e),this.dispatchEvent({type:"change",attribute:r})}};var Bl="v4.4.2",Lt="@glb.bin",F=(function(t){return t.ACCESSOR="Accessor",t.ANIMATION="Animation",t.ANIMATION_CHANNEL="AnimationChannel",t.ANIMATION_SAMPLER="AnimationSampler",t.BUFFER="Buffer",t.CAMERA="Camera",t.MATERIAL="Material",t.MESH="Mesh",t.PRIMITIVE="Primitive",t.PRIMITIVE_TARGET="PrimitiveTarget",t.NODE="Node",t.ROOT="Root",t.SCENE="Scene",t.SKIN="Skin",t.TEXTURE="Texture",t.TEXTURE_INFO="TextureInfo",t})({});var Lg=(function(t){return t.ARRAY_BUFFER="ARRAY_BUFFER",t.ELEMENT_ARRAY_BUFFER="ELEMENT_ARRAY_BUFFER",t.INVERSE_BIND_MATRICES="INVERSE_BIND_MATRICES",t.OTHER="OTHER",t.SPARSE="SPARSE",t})({}),ct=(function(t){return t[t.R=4096]="R",t[t.G=256]="G",t[t.B=16]="B",t[t.A=1]="A",t})({});var Dg=class extends Float32Array{constructor(){throw super(),new Error("Unsupported typed array instantiation.")}},Ss={5120:Int8Array,5121:Uint8Array,5122:Int16Array,5123:Uint16Array,5125:Uint32Array,5131:typeof Float16Array<"u"?Float16Array:Dg,5126:Float32Array,5130:Float64Array},X=class{static createBufferFromDataURI(t){if(typeof Buffer>"u"){let e=atob(t.split(",")[1]),r=new Uint8Array(e.length);for(let a=0;a<e.length;a++)r[a]=e.charCodeAt(a);return r}else{let e=t.split(",")[1],r=t.indexOf("base64")>=0;return Buffer.from(e,r?"base64":"utf8")}}static encodeText(t){return new TextEncoder().encode(t)}static decodeText(t){return new TextDecoder().decode(t)}static concat(t){let e=0;for(let s of t)e+=s.byteLength;let r=new Uint8Array(e),a=0;for(let s of t)r.set(s,a),a+=s.byteLength;return r}static pad(t,e=0){let r=this.padNumber(t.byteLength);if(r===t.byteLength)return t;let a=new Uint8Array(r);if(a.set(t),e!==0)for(let s=t.byteLength;s<r;s++)a[s]=e;return a}static padNumber(t){return Math.ceil(t/4)*4}static equals(t,e){if(t===e)return!0;if(t.byteLength!==e.byteLength)return!1;let r=t.byteLength;for(;r--;)if(t[r]!==e[r])return!1;return!0}static toView(t,e=0,r=1/0){return new Uint8Array(t.buffer,t.byteOffset+e,Math.min(t.byteLength,r))}static assertView(t){if(t&&!ArrayBuffer.isView(t))throw new Error(`Method requires Uint8Array parameter; received "${typeof t}".`);return t}};var Ug=class{match(t){return t.length>=3&&t[0]===255&&t[1]===216&&t[2]===255}getSize(t){let e=new DataView(t.buffer,t.byteOffset+4),r,a;for(;e.byteLength;){if(r=e.getUint16(0,!1),Gg(e,r),a=e.getUint8(r+1),a===192||a===193||a===194)return[e.getUint16(r+7,!1),e.getUint16(r+5,!1)];e=new DataView(t.buffer,e.byteOffset+r+2)}throw new TypeError("Invalid JPG, no size found")}getChannels(t){return 3}},zg=class Ol{static PNG_FRIED_CHUNK_NAME="CgBI";match(e){return e.length>=8&&e[0]===137&&e[1]===80&&e[2]===78&&e[3]===71&&e[4]===13&&e[5]===10&&e[6]===26&&e[7]===10}getSize(e){let r=new DataView(e.buffer,e.byteOffset);return X.decodeText(e.slice(12,16))===Ol.PNG_FRIED_CHUNK_NAME?[r.getUint32(32,!1),r.getUint32(36,!1)]:[r.getUint32(16,!1),r.getUint32(20,!1)]}getChannels(e){return 4}},bt=class{static impls={"image/jpeg":new Ug,"image/png":new zg};static registerFormat(t,e){this.impls[t]=e}static getMimeType(t){for(let e in this.impls)if(this.impls[e].match(t))return e;return null}static getSize(t,e){return this.impls[e]?this.impls[e].getSize(t):null}static getChannels(t,e){return this.impls[e]?this.impls[e].getChannels(t):null}static getVRAMByteLength(t,e){if(!this.impls[e])return null;if(this.impls[e].getVRAMByteLength)return this.impls[e].getVRAMByteLength(t);let r=0,a=4,s=this.getSize(t,e);if(!s)return null;for(;s[0]>1||s[1]>1;)r+=s[0]*s[1]*a,s[0]=Math.max(Math.floor(s[0]/2),1),s[1]=Math.max(Math.floor(s[1]/2),1);return r+=1*a,r}static mimeTypeToExtension(t){return t==="image/jpeg"?"jpg":t.split("/").pop()}static extensionToMimeType(t){return t==="jpg"?"image/jpeg":t?`image/${t}`:""}};function Gg(t,e){if(e>t.byteLength)throw new TypeError("Corrupt JPG, exceeded buffer limits");if(t.getUint8(e)!==255)throw new TypeError("Invalid JPG, marker table corrupted");return t}var Ir=class{static basename(t){let e=t.split(/[\\/]/).pop();return e.substring(0,e.lastIndexOf("."))}static extension(t){if(t.startsWith("data:image/")){let e=t.match(/data:(image\/\w+)/)[1];return bt.mimeTypeToExtension(e)}else{if(t.startsWith("data:model/gltf+json"))return"gltf";if(t.startsWith("data:model/gltf-binary"))return"glb";if(t.startsWith("data:application/"))return"bin"}return t.split(/[\\/]/).pop().split(/[.]/).pop()}},Ni=typeof Float32Array<"u"?Float32Array:Array;Math.PI/180;180/Math.PI;function Kg(){var t=new Ni(3);return Ni!=Float32Array&&(t[0]=0,t[1]=0,t[2]=0),t}function Ii(t){var e=t[0],r=t[1],a=t[2];return Math.sqrt(e*e+r*r+a*a)}function Vg(t,e,r){var a=e[0],s=e[1],n=e[2],i=r[3]*a+r[7]*s+r[11]*n+r[15];return i=i||1,t[0]=(r[0]*a+r[4]*s+r[8]*n+r[12])/i,t[1]=(r[1]*a+r[5]*s+r[9]*n+r[13])/i,t[2]=(r[2]*a+r[6]*s+r[10]*n+r[14])/i,t}(function(){var t=Kg();return function(e,r,a,s,n,i){var o,c;for(r||(r=3),a||(a=0),s?c=Math.min(s*r+a,e.length):c=e.length,o=a;o<c;o+=r)t[0]=e[o],t[1]=e[o+1],t[2]=e[o+2],n(t,t,i),e[o]=t[0],e[o+1]=t[1],e[o+2]=t[2];return e}})();function Fl(t){let e=Pl(),r=t.propertyType==="Node"?[t]:t.listChildren();for(let a of r)a.traverse(s=>{let n=s.getMesh();if(!n)return;let i=Hg(n,s.getWorldMatrix());i.min.every(isFinite)&&i.max.every(isFinite)&&(Ci(i.min,e),Ci(i.max,e))});return e}function Hg(t,e){let r=Pl();for(let a of t.listPrimitives()){let s=a.getAttribute("POSITION"),n=a.getIndices();if(!s)continue;let i=[0,0,0],o=[0,0,0];for(let c=0,l=n?n.getCount():s.getCount();c<l;c++){let f=n?n.getScalar(c):c;i=s.getElement(f,i),o=Vg(o,i,e),Ci(o,r)}}return r}function Ci(t,e){for(let r=0;r<3;r++)e.min[r]=Math.min(t[r],e.min[r]),e.max[r]=Math.max(t[r],e.max[r])}function Pl(){return{min:[1/0,1/0,1/0],max:[-1/0,-1/0,-1/0]}}var Al="https://null.example",Ri=class{static DEFAULT_INIT={};static PROTOCOL_REGEXP=/^[a-zA-Z]+:\/\//;static dirname(t){let e=t.lastIndexOf("/");return e===-1?"./":t.substring(0,e+1)}static basename(t){return Ir.basename(new URL(t,Al).pathname)}static extension(t){return Ir.extension(new URL(t,Al).pathname)}static resolve(t,e){if(!this.isRelativePath(e))return e;let r=t.split("/"),a=e.split("/");r.pop();for(let s=0;s<a.length;s++)a[s]!=="."&&(a[s]===".."?r.pop():r.push(a[s]));return r.join("/")}static isAbsoluteURL(t){return this.PROTOCOL_REGEXP.test(t)}static isRelativePath(t){return!/^(?:[a-zA-Z]+:)?\//.test(t)}};function _l(t){return Object.prototype.toString.call(t)==="[object Object]"}function dr(t){if(_l(t)===!1)return!1;let e=t.constructor;if(e===void 0)return!0;let r=e.prototype;return!(_l(r)===!1||Object.hasOwn(r,"isPrototypeOf")===!1)}var qg=(function(t){return t[t.SILENT=4]="SILENT",t[t.ERROR=3]="ERROR",t[t.WARN=2]="WARN",t[t.INFO=1]="INFO",t[t.DEBUG=0]="DEBUG",t})({}),Ts=class jl{verbosity;static Verbosity=qg;static DEFAULT_INSTANCE=new jl(1);constructor(e){this.verbosity=e}debug(e){this.verbosity<=0&&console.debug(e)}info(e){this.verbosity<=1&&console.info(e)}warn(e){this.verbosity<=2&&console.warn(e)}error(e){this.verbosity<=3&&console.error(e)}};function Wg(t){var e=t[0],r=t[1],a=t[2],s=t[3],n=t[4],i=t[5],o=t[6],c=t[7],l=t[8],f=t[9],d=t[10],p=t[11],b=t[12],h=t[13],u=t[14],m=t[15],g=e*i-r*n,y=e*o-a*n,x=r*o-a*i,v=l*h-f*b,E=l*u-d*b,S=f*u-d*h,T=e*S-r*E+a*v,_=n*S-i*E+o*v,I=l*x-f*y+d*g,N=b*x-h*y+u*g;return c*T-s*_+m*I-p*N}function Xg(t,e,r){var a=e[0],s=e[1],n=e[2],i=e[3],o=e[4],c=e[5],l=e[6],f=e[7],d=e[8],p=e[9],b=e[10],h=e[11],u=e[12],m=e[13],g=e[14],y=e[15],x=r[0],v=r[1],E=r[2],S=r[3];return t[0]=x*a+v*o+E*d+S*u,t[1]=x*s+v*c+E*p+S*m,t[2]=x*n+v*l+E*b+S*g,t[3]=x*i+v*f+E*h+S*y,x=r[4],v=r[5],E=r[6],S=r[7],t[4]=x*a+v*o+E*d+S*u,t[5]=x*s+v*c+E*p+S*m,t[6]=x*n+v*l+E*b+S*g,t[7]=x*i+v*f+E*h+S*y,x=r[8],v=r[9],E=r[10],S=r[11],t[8]=x*a+v*o+E*d+S*u,t[9]=x*s+v*c+E*p+S*m,t[10]=x*n+v*l+E*b+S*g,t[11]=x*i+v*f+E*h+S*y,x=r[12],v=r[13],E=r[14],S=r[15],t[12]=x*a+v*o+E*d+S*u,t[13]=x*s+v*c+E*p+S*m,t[14]=x*n+v*l+E*b+S*g,t[15]=x*i+v*f+E*h+S*y,t}function $g(t,e){var r=e[0],a=e[1],s=e[2],n=e[4],i=e[5],o=e[6],c=e[8],l=e[9],f=e[10];return t[0]=Math.sqrt(r*r+a*a+s*s),t[1]=Math.sqrt(n*n+i*i+o*o),t[2]=Math.sqrt(c*c+l*l+f*f),t}function Yg(t,e){var r=new Ni(3);$g(r,e);var a=1/r[0],s=1/r[1],n=1/r[2],i=e[0]*a,o=e[1]*s,c=e[2]*n,l=e[4]*a,f=e[5]*s,d=e[6]*n,p=e[8]*a,b=e[9]*s,h=e[10]*n,u=i+f+h,m=0;return u>0?(m=Math.sqrt(u+1)*2,t[3]=.25*m,t[0]=(d-b)/m,t[1]=(p-c)/m,t[2]=(o-l)/m):i>f&&i>h?(m=Math.sqrt(1+i-f-h)*2,t[3]=(d-b)/m,t[0]=.25*m,t[1]=(o+l)/m,t[2]=(p+c)/m):f>h?(m=Math.sqrt(1+f-i-h)*2,t[3]=(p-c)/m,t[0]=(o+l)/m,t[1]=.25*m,t[2]=(d+b)/m):(m=Math.sqrt(1+h-i-f)*2,t[3]=(o-l)/m,t[0]=(p+c)/m,t[1]=(d+b)/m,t[2]=.25*m),t}var he=class ca{static identity(e){return e}static eq(e,r,a=1e-5){if(e.length!==r.length)return!1;for(let s=0;s<e.length;s++)if(Math.abs(e[s]-r[s])>a)return!1;return!0}static clamp(e,r,a){return e<r?r:e>a?a:e}static decodeNormalizedInt(e,r){switch(r){case 5126:return e;case 5123:return e/65535;case 5121:return e/255;case 5122:return Math.max(e/32767,-1);case 5120:return Math.max(e/127,-1);default:throw new Error("Invalid component type.")}}static encodeNormalizedInt(e,r){switch(r){case 5126:return e;case 5123:return Math.round(ca.clamp(e,0,1)*65535);case 5121:return Math.round(ca.clamp(e,0,1)*255);case 5122:return Math.round(ca.clamp(e,-1,1)*32767);case 5120:return Math.round(ca.clamp(e,-1,1)*127);default:throw new Error("Invalid component type.")}}static decompose(e,r,a,s){let n=Ii([e[0],e[1],e[2]]),i=Ii([e[4],e[5],e[6]]),o=Ii([e[8],e[9],e[10]]);Wg(e)<0&&(n=-n),r[0]=e[12],r[1]=e[13],r[2]=e[14];let c=e.slice(),l=1/n,f=1/i,d=1/o;c[0]*=l,c[1]*=l,c[2]*=l,c[4]*=f,c[5]*=f,c[6]*=f,c[8]*=d,c[9]*=d,c[10]*=d,Yg(a,c),s[0]=n,s[1]=i,s[2]=o}static compose(e,r,a,s){let n=s,i=r[0],o=r[1],c=r[2],l=r[3],f=i+i,d=o+o,p=c+c,b=i*f,h=i*d,u=i*p,m=o*d,g=o*p,y=c*p,x=l*f,v=l*d,E=l*p,S=a[0],T=a[1],_=a[2];return n[0]=(1-(m+y))*S,n[1]=(h+E)*S,n[2]=(u-v)*S,n[3]=0,n[4]=(h-E)*T,n[5]=(1-(b+y))*T,n[6]=(g+x)*T,n[7]=0,n[8]=(u+v)*_,n[9]=(g-x)*_,n[10]=(1-(b+m))*_,n[11]=0,n[12]=e[0],n[13]=e[1],n[14]=e[2],n[15]=1,n}};function Jg(t,e){if(!!t!=!!e)return!1;let r=t.getChild(),a=e.getChild();return r===a||r.equals(a)}function Qg(t,e){if(!!t!=!!e)return!1;let r=t.values(),a=e.values();if(r.length!==a.length)return!1;for(let s=0;s<r.length;s++){let n=r[s],i=a[s];if(n.getChild()!==i.getChild()&&!n.getChild().equals(i.getChild()))return!1}return!0}function Zg(t,e){if(!!t!=!!e)return!1;let r=t.keys(),a=e.keys();if(r.length!==a.length)return!1;for(let s of r){let n=t.get(s),i=e.get(s);if(!!n!=!!i)return!1;let o=n.getChild(),c=i.getChild();if(o!==c&&!o.equals(c))return!1}return!0}function Ll(t,e){if(t===e)return!0;if(!!t!=!!e||!t||!e||t.length!==e.length)return!1;for(let r=0;r<t.length;r++)if(t[r]!==e[r])return!1;return!0}function Dl(t,e){if(t===e)return!0;if(!!t!=!!e)return!1;if(!dr(t)||!dr(e))return t===e;let r=t,a=e,s=0,n=0,i;for(i in r)s++;for(i in a)n++;if(s!==n)return!1;for(i in r){let o=r[i],c=a[i];if(ks(o)&&ks(c)){if(!Ll(o,c))return!1}else if(dr(o)&&dr(c)){if(!Dl(o,c))return!1}else if(o!==c)return!1}return!0}function ks(t){return Array.isArray(t)||ArrayBuffer.isView(t)}var em="23456789abdegjkmnpqrvwxyzABDEGJKMNPQRVWXYZ",tm=999,rm=6,Il=new Set,am=function(){let t="";for(let e=0;e<rm;e++)t+=em.charAt(Math.floor(Math.random()*42));return t},sm=function(){for(let t=0;t<tm;t++){let e=am();if(!Il.has(e))return Il.add(e),e}return""},Dt=t=>t,nm=new Set,Fi=class extends Sl{constructor(t,e=""){super(t),this[ae].name=e,this.init(),this.dispatchEvent({type:"create"})}getGraph(){return this.graph}getDefaults(){return Object.assign(super.getDefaults(),{name:"",extras:{}})}set(t,e){return Array.isArray(e)&&(e=e.slice()),super.set(t,e)}getName(){return this.get("name")}setName(t){return this.set("name",t)}getExtras(){return this.get("extras")}setExtras(t){return this.set("extras",t)}clone(){let t=this.constructor;return new t(this.graph).copy(this,Dt)}copy(t,e=Dt){for(let r in this[ae]){let a=this[ae][r];if(a instanceof Pt)this[Ft].has(r)||a.dispose();else if(a instanceof Fe||a instanceof le)for(let s of a.values())s.dispose();else if(a instanceof ke)for(let s of a.values())s.dispose()}for(let r in t[ae]){let a=this[ae][r],s=t[ae][r];if(s instanceof Pt)this[Ft].has(r)?a.getChild().copy(e(s.getChild()),e):this.setRef(r,e(s.getChild()),s.getAttributes());else if(s instanceof le||s instanceof Fe)for(let n of s.values())this.addRef(r,e(n.getChild()),n.getAttributes());else if(s instanceof ke)for(let n of s.keys()){let i=s.get(n);this.setRefMap(r,n,e(i.getChild()),i.getAttributes())}else dr(s)?this[ae][r]=JSON.parse(JSON.stringify(s)):Array.isArray(s)||s instanceof ArrayBuffer||ArrayBuffer.isView(s)?this[ae][r]=s.slice():this[ae][r]=s}return this}equals(t,e=nm){if(this===t)return!0;if(this.propertyType!==t.propertyType)return!1;for(let r in this[ae]){if(e.has(r))continue;let a=this[ae][r],s=t[ae][r];if(a instanceof Pt||s instanceof Pt){if(!Jg(a,s))return!1}else if(a instanceof le||s instanceof le||a instanceof Fe||s instanceof Fe){if(!Qg(a,s))return!1}else if(a instanceof ke||s instanceof ke){if(!Zg(a,s))return!1}else if(dr(a)||dr(s)){if(!Dl(a,s))return!1}else if(ks(a)||ks(s)){if(!Ll(a,s))return!1}else if(a!==s)return!1}return!0}detach(){return this.graph.disconnectParents(this,t=>t.propertyType!=="Root"),this}listParents(){return this.graph.listParents(this)}},Ue=class extends Fi{getDefaults(){return Object.assign(super.getDefaults(),{extensions:new ke})}getExtension(t){return this.getRefMap("extensions",t)}setExtension(t,e){return e&&e._validateParent(this),this.setRefMap("extensions",t,e)}listExtensions(){return this.listRefMapValues("extensions")}},V=class Ee extends Ue{static Type={SCALAR:"SCALAR",VEC2:"VEC2",VEC3:"VEC3",VEC4:"VEC4",MAT2:"MAT2",MAT3:"MAT3",MAT4:"MAT4"};static ComponentType={BYTE:5120,UNSIGNED_BYTE:5121,SHORT:5122,UNSIGNED_SHORT:5123,UNSIGNED_INT:5125,FLOAT:5126,FLOAT16:5131,FLOAT64:5130};init(){this.propertyType="Accessor"}getDefaults(){return Object.assign(super.getDefaults(),{array:null,type:Ee.Type.SCALAR,componentType:Ee.ComponentType.FLOAT,normalized:!1,sparse:!1,buffer:null})}static getElementSize(e){switch(e){case Ee.Type.SCALAR:return 1;case Ee.Type.VEC2:return 2;case Ee.Type.VEC3:return 3;case Ee.Type.VEC4:return 4;case Ee.Type.MAT2:return 4;case Ee.Type.MAT3:return 9;case Ee.Type.MAT4:return 16;default:throw new Error("Unexpected type: "+e)}}static getComponentSize(e){switch(e){case Ee.ComponentType.BYTE:case Ee.ComponentType.UNSIGNED_BYTE:return 1;case Ee.ComponentType.SHORT:case Ee.ComponentType.UNSIGNED_SHORT:return 2;case Ee.ComponentType.UNSIGNED_INT:case Ee.ComponentType.FLOAT:return 4;case Ee.ComponentType.FLOAT16:return 2;case Ee.ComponentType.FLOAT64:return 8;default:throw new Error("Unexpected component type: "+e)}}getMinNormalized(e){let r=this.getNormalized(),a=this.getElementSize(),s=this.getComponentType();if(this.getMin(e),r)for(let n=0;n<a;n++)e[n]=he.decodeNormalizedInt(e[n],s);return e}getMin(e){let r=this.getArray(),a=this.getCount(),s=this.getElementSize();for(let n=0;n<s;n++)e[n]=1/0;for(let n=0;n<a*s;n+=s)for(let i=0;i<s;i++){let o=r[n+i];Number.isFinite(o)&&(e[i]=Math.min(e[i],o))}return e}getMaxNormalized(e){let r=this.getNormalized(),a=this.getElementSize(),s=this.getComponentType();if(this.getMax(e),r)for(let n=0;n<a;n++)e[n]=he.decodeNormalizedInt(e[n],s);return e}getMax(e){let r=this.get("array"),a=this.getCount(),s=this.getElementSize();for(let n=0;n<s;n++)e[n]=-1/0;for(let n=0;n<a*s;n+=s)for(let i=0;i<s;i++){let o=r[n+i];Number.isFinite(o)&&(e[i]=Math.max(e[i],o))}return e}getCount(){let e=this.get("array");return e?e.length/this.getElementSize():0}getType(){return this.get("type")}setType(e){return this.set("type",e)}getElementSize(){return Ee.getElementSize(this.get("type"))}getComponentSize(){return this.get("array").BYTES_PER_ELEMENT}getComponentType(){return this.get("componentType")}getNormalized(){return this.get("normalized")}setNormalized(e){return this.set("normalized",e)}getScalar(e){let r=this.getElementSize(),a=this.getComponentType(),s=this.getArray();return this.getNormalized()?he.decodeNormalizedInt(s[e*r],a):s[e*r]}setScalar(e,r){let a=this.getElementSize(),s=this.getComponentType(),n=this.getArray();return this.getNormalized()?n[e*a]=he.encodeNormalizedInt(r,s):n[e*a]=r,this}getElement(e,r){let a=this.getNormalized(),s=this.getElementSize(),n=this.getComponentType(),i=this.getArray();for(let o=0;o<s;o++)a?r[o]=he.decodeNormalizedInt(i[e*s+o],n):r[o]=i[e*s+o];return r}setElement(e,r){let a=this.getNormalized(),s=this.getElementSize(),n=this.getComponentType(),i=this.getArray();for(let o=0;o<s;o++)a?i[e*s+o]=he.encodeNormalizedInt(r[o],n):i[e*s+o]=r[o];return this}getSparse(){return this.get("sparse")}setSparse(e){return this.set("sparse",e)}getBuffer(){return this.getRef("buffer")}setBuffer(e){return this.setRef("buffer",e)}getArray(){return this.get("array")}setArray(e){return this.set("componentType",e?im(e):Ee.ComponentType.FLOAT),this.set("array",e),this}getByteLength(){let e=this.get("array");return e?e.byteLength:0}};function im(t){switch(t.constructor){case Float32Array:return V.ComponentType.FLOAT;case Uint32Array:return V.ComponentType.UNSIGNED_INT;case Uint16Array:return V.ComponentType.UNSIGNED_SHORT;case Uint8Array:return V.ComponentType.UNSIGNED_BYTE;case Int16Array:return V.ComponentType.SHORT;case Int8Array:return V.ComponentType.BYTE;case Float64Array:return V.ComponentType.FLOAT64}if(typeof Float16Array<"u"&&t.constructor===Float16Array)return V.ComponentType.FLOAT16;throw new Error("Unknown accessor componentType.")}var Ul=class extends Ue{init(){this.propertyType="Animation"}getDefaults(){return Object.assign(super.getDefaults(),{channels:new le,samplers:new le})}addChannel(t){return this.addRef("channels",t)}removeChannel(t){return this.removeRef("channels",t)}listChannels(){return this.listRefs("channels")}addSampler(t){return this.addRef("samplers",t)}removeSampler(t){return this.removeRef("samplers",t)}listSamplers(){return this.listRefs("samplers")}},Pi=class extends Ue{static TargetPath={TRANSLATION:"translation",ROTATION:"rotation",SCALE:"scale",WEIGHTS:"weights"};init(){this.propertyType="AnimationChannel"}getDefaults(){return Object.assign(super.getDefaults(),{targetPath:null,targetNode:null,sampler:null})}getTargetPath(){return this.get("targetPath")}setTargetPath(t){return this.set("targetPath",t)}getTargetNode(){return this.getRef("targetNode")}setTargetNode(t){return this.setRef("targetNode",t)}getSampler(){return this.getRef("sampler")}setSampler(t){return this.setRef("sampler",t)}},As=class zl extends Ue{static Interpolation={LINEAR:"LINEAR",STEP:"STEP",CUBICSPLINE:"CUBICSPLINE"};init(){this.propertyType="AnimationSampler"}getDefaultAttributes(){return Object.assign(super.getDefaults(),{interpolation:zl.Interpolation.LINEAR,input:null,output:null})}getInterpolation(){return this.get("interpolation")}setInterpolation(e){return this.set("interpolation",e)}getInput(){return this.getRef("input")}setInput(e){return this.setRef("input",e,{usage:"OTHER"})}getOutput(){return this.getRef("output")}setOutput(e){return this.setRef("output",e,{usage:"OTHER"})}},Gl=class extends Ue{init(){this.propertyType="Buffer"}getDefaults(){return Object.assign(super.getDefaults(),{uri:""})}getURI(){return this.get("uri")}setURI(t){return this.set("uri",t)}},_s=class Kl extends Ue{static Type={PERSPECTIVE:"perspective",ORTHOGRAPHIC:"orthographic"};init(){this.propertyType="Camera"}getDefaults(){return Object.assign(super.getDefaults(),{type:Kl.Type.PERSPECTIVE,znear:.1,zfar:100,aspectRatio:null,yfov:Math.PI*2*50/360,xmag:1,ymag:1})}getType(){return this.get("type")}setType(e){return this.set("type",e)}getZNear(){return this.get("znear")}setZNear(e){return this.set("znear",e)}getZFar(){return this.get("zfar")}setZFar(e){return this.set("zfar",e)}getAspectRatio(){return this.get("aspectRatio")}setAspectRatio(e){return this.set("aspectRatio",e)}getYFov(){return this.get("yfov")}setYFov(e){return this.set("yfov",e)}getXMag(){return this.get("xmag")}setXMag(e){return this.set("xmag",e)}getYMag(){return this.get("ymag")}setYMag(e){return this.set("ymag",e)}},Q=class extends Fi{static EXTENSION_NAME;_validateParent(t){if(!this.parentTypes.includes(t.propertyType))throw new Error(`Parent "${t.propertyType}" invalid for child "${this.propertyType}".`)}},ue=class Bi extends Ue{static WrapMode={CLAMP_TO_EDGE:33071,MIRRORED_REPEAT:33648,REPEAT:10497};static MagFilter={NEAREST:9728,LINEAR:9729};static MinFilter={NEAREST:9728,LINEAR:9729,NEAREST_MIPMAP_NEAREST:9984,LINEAR_MIPMAP_NEAREST:9985,NEAREST_MIPMAP_LINEAR:9986,LINEAR_MIPMAP_LINEAR:9987};init(){this.propertyType="TextureInfo"}getDefaults(){return Object.assign(super.getDefaults(),{texCoord:0,magFilter:null,minFilter:null,wrapS:Bi.WrapMode.REPEAT,wrapT:Bi.WrapMode.REPEAT})}getTexCoord(){return this.get("texCoord")}setTexCoord(e){return this.set("texCoord",e)}getMagFilter(){return this.get("magFilter")}setMagFilter(e){return this.set("magFilter",e)}getMinFilter(){return this.get("minFilter")}setMinFilter(e){return this.set("minFilter",e)}getWrapS(){return this.get("wrapS")}setWrapS(e){return this.set("wrapS",e)}getWrapT(){return this.get("wrapT")}setWrapT(e){return this.set("wrapT",e)}},{R:ys,G:xs,B:ws,A:om}=ct,Es=class Vl extends Ue{static AlphaMode={OPAQUE:"OPAQUE",MASK:"MASK",BLEND:"BLEND"};init(){this.propertyType="Material"}getDefaults(){return Object.assign(super.getDefaults(),{alphaMode:Vl.AlphaMode.OPAQUE,alphaCutoff:.5,doubleSided:!1,baseColorFactor:[1,1,1,1],baseColorTexture:null,baseColorTextureInfo:new ue(this.graph,"baseColorTextureInfo"),emissiveFactor:[0,0,0],emissiveTexture:null,emissiveTextureInfo:new ue(this.graph,"emissiveTextureInfo"),normalScale:1,normalTexture:null,normalTextureInfo:new ue(this.graph,"normalTextureInfo"),occlusionStrength:1,occlusionTexture:null,occlusionTextureInfo:new ue(this.graph,"occlusionTextureInfo"),roughnessFactor:1,metallicFactor:1,metallicRoughnessTexture:null,metallicRoughnessTextureInfo:new ue(this.graph,"metallicRoughnessTextureInfo")})}getDoubleSided(){return this.get("doubleSided")}setDoubleSided(e){return this.set("doubleSided",e)}getAlpha(){return this.get("baseColorFactor")[3]}setAlpha(e){let r=this.get("baseColorFactor").slice();return r[3]=e,this.set("baseColorFactor",r)}getAlphaMode(){return this.get("alphaMode")}setAlphaMode(e){return this.set("alphaMode",e)}getAlphaCutoff(){return this.get("alphaCutoff")}setAlphaCutoff(e){return this.set("alphaCutoff",e)}getBaseColorFactor(){return this.get("baseColorFactor")}setBaseColorFactor(e){return this.set("baseColorFactor",e)}getBaseColorTexture(){return this.getRef("baseColorTexture")}getBaseColorTextureInfo(){return this.getRef("baseColorTexture")?this.getRef("baseColorTextureInfo"):null}setBaseColorTexture(e){return this.setRef("baseColorTexture",e,{channels:ys|xs|ws|om,isColor:!0})}getEmissiveFactor(){return this.get("emissiveFactor")}setEmissiveFactor(e){return this.set("emissiveFactor",e)}getEmissiveTexture(){return this.getRef("emissiveTexture")}getEmissiveTextureInfo(){return this.getRef("emissiveTexture")?this.getRef("emissiveTextureInfo"):null}setEmissiveTexture(e){return this.setRef("emissiveTexture",e,{channels:ys|xs|ws,isColor:!0})}getNormalScale(){return this.get("normalScale")}setNormalScale(e){return this.set("normalScale",e)}getNormalTexture(){return this.getRef("normalTexture")}getNormalTextureInfo(){return this.getRef("normalTexture")?this.getRef("normalTextureInfo"):null}setNormalTexture(e){return this.setRef("normalTexture",e,{channels:ys|xs|ws})}getOcclusionStrength(){return this.get("occlusionStrength")}setOcclusionStrength(e){return this.set("occlusionStrength",e)}getOcclusionTexture(){return this.getRef("occlusionTexture")}getOcclusionTextureInfo(){return this.getRef("occlusionTexture")?this.getRef("occlusionTextureInfo"):null}setOcclusionTexture(e){return this.setRef("occlusionTexture",e,{channels:ys})}getRoughnessFactor(){return this.get("roughnessFactor")}setRoughnessFactor(e){return this.set("roughnessFactor",e)}getMetallicFactor(){return this.get("metallicFactor")}setMetallicFactor(e){return this.set("metallicFactor",e)}getMetallicRoughnessTexture(){return this.getRef("metallicRoughnessTexture")}getMetallicRoughnessTextureInfo(){return this.getRef("metallicRoughnessTexture")?this.getRef("metallicRoughnessTextureInfo"):null}setMetallicRoughnessTexture(e){return this.setRef("metallicRoughnessTexture",e,{channels:xs|ws})}},Hl=class extends Ue{init(){this.propertyType="Mesh"}getDefaults(){return Object.assign(super.getDefaults(),{weights:[],primitives:new le})}addPrimitive(t){return this.addRef("primitives",t)}removePrimitive(t){return this.removeRef("primitives",t)}listPrimitives(){return this.listRefs("primitives")}getWeights(){return this.get("weights")}setWeights(t){return this.set("weights",t)}},ql=class extends Ue{init(){this.propertyType="Node"}getDefaults(){return Object.assign(super.getDefaults(),{translation:[0,0,0],rotation:[0,0,0,1],scale:[1,1,1],weights:[],camera:null,mesh:null,skin:null,children:new le})}copy(t,e=Dt){if(e===Dt)throw new Error("Node cannot be copied.");return super.copy(t,e)}getTranslation(){return this.get("translation")}getRotation(){return this.get("rotation")}getScale(){return this.get("scale")}setTranslation(t){return this.set("translation",t)}setRotation(t){return this.set("rotation",t)}setScale(t){return this.set("scale",t)}getMatrix(){return he.compose(this.get("translation"),this.get("rotation"),this.get("scale"),[])}setMatrix(t){let e=this.get("translation").slice(),r=this.get("rotation").slice(),a=this.get("scale").slice();return he.decompose(t,e,r,a),this.set("translation",e).set("rotation",r).set("scale",a)}getWorldTranslation(){let t=[0,0,0];return he.decompose(this.getWorldMatrix(),t,[0,0,0,1],[1,1,1]),t}getWorldRotation(){let t=[0,0,0,1];return he.decompose(this.getWorldMatrix(),[0,0,0],t,[1,1,1]),t}getWorldScale(){let t=[1,1,1];return he.decompose(this.getWorldMatrix(),[0,0,0],[0,0,0,1],t),t}getWorldMatrix(){let t=[];for(let a=this;a!=null;a=a.getParentNode())t.push(a);let e,r=t.pop().getMatrix();for(;e=t.pop();)Xg(r,r,e.getMatrix());return r}addChild(t){let e=t.getParentNode();e&&e.removeChild(t);for(let r of t.listParents())r.propertyType==="Scene"&&r.removeChild(t);return this.addRef("children",t)}removeChild(t){return this.removeRef("children",t)}listChildren(){return this.listRefs("children")}getParentNode(){for(let t of this.listParents())if(t.propertyType==="Node")return t;return null}getMesh(){return this.getRef("mesh")}setMesh(t){return this.setRef("mesh",t)}getCamera(){return this.getRef("camera")}setCamera(t){return this.setRef("camera",t)}getSkin(){return this.getRef("skin")}setSkin(t){return this.setRef("skin",t)}getWeights(){return this.get("weights")}setWeights(t){return this.set("weights",t)}traverse(t){t(this);for(let e of this.listChildren())e.traverse(t);return this}},la=class Wl extends Ue{static Mode={POINTS:0,LINES:1,LINE_LOOP:2,LINE_STRIP:3,TRIANGLES:4,TRIANGLE_STRIP:5,TRIANGLE_FAN:6};init(){this.propertyType="Primitive"}getDefaults(){return Object.assign(super.getDefaults(),{mode:Wl.Mode.TRIANGLES,material:null,indices:null,attributes:new ke,targets:new le})}getIndices(){return this.getRef("indices")}setIndices(e){return this.setRef("indices",e,{usage:"ELEMENT_ARRAY_BUFFER"})}getAttribute(e){return this.getRefMap("attributes",e)}setAttribute(e,r){return this.setRefMap("attributes",e,r,{usage:"ARRAY_BUFFER"})}listAttributes(){return this.listRefMapValues("attributes")}listSemantics(){return this.listRefMapKeys("attributes")}getMaterial(){return this.getRef("material")}setMaterial(e){return this.setRef("material",e)}getMode(){return this.get("mode")}setMode(e){return this.set("mode",e)}listTargets(){return this.listRefs("targets")}addTarget(e){return this.addRef("targets",e)}removeTarget(e){return this.removeRef("targets",e)}},cm=class extends Fi{init(){this.propertyType="PrimitiveTarget"}getDefaults(){return Object.assign(super.getDefaults(),{attributes:new ke})}getAttribute(t){return this.getRefMap("attributes",t)}setAttribute(t,e){return this.setRefMap("attributes",t,e,{usage:"ARRAY_BUFFER"})}listAttributes(){return this.listRefMapValues("attributes")}listSemantics(){return this.listRefMapKeys("attributes")}},Xl=class extends Ue{init(){this.propertyType="Scene"}getDefaults(){return Object.assign(super.getDefaults(),{children:new le})}copy(t,e=Dt){if(e===Dt)throw new Error("Scene cannot be copied.");return super.copy(t,e)}addChild(t){let e=t.getParentNode();return e&&e.removeChild(t),this.addRef("children",t)}removeChild(t){return this.removeRef("children",t)}listChildren(){return this.listRefs("children")}traverse(t){for(let e of this.listChildren())e.traverse(t);return this}},$l=class extends Ue{init(){this.propertyType="Skin"}getDefaults(){return Object.assign(super.getDefaults(),{skeleton:null,inverseBindMatrices:null,joints:new le})}getSkeleton(){return this.getRef("skeleton")}setSkeleton(t){return this.setRef("skeleton",t)}getInverseBindMatrices(){return this.getRef("inverseBindMatrices")}setInverseBindMatrices(t){return this.setRef("inverseBindMatrices",t,{usage:"INVERSE_BIND_MATRICES"})}addJoint(t){return this.addRef("joints",t)}removeJoint(t){return this.removeRef("joints",t)}listJoints(){return this.listRefs("joints")}},Yl=class extends Ue{init(){this.propertyType="Texture"}getDefaults(){return Object.assign(super.getDefaults(),{image:null,mimeType:"",uri:""})}getMimeType(){return this.get("mimeType")||bt.extensionToMimeType(Ir.extension(this.get("uri")))}setMimeType(t){return this.set("mimeType",t)}getURI(){return this.get("uri")}setURI(t){this.set("uri",t);let e=bt.extensionToMimeType(Ir.extension(t));return e&&this.set("mimeType",e),this}getImage(){return this.get("image")}setImage(t){return this.set("image",X.assertView(t))}getSize(){let t=this.get("image");return t?bt.getSize(t,this.getMimeType()):null}},ji=class extends Ue{_extensions=new Set;init(){this.propertyType="Root"}getDefaults(){return Object.assign(super.getDefaults(),{asset:{generator:`glTF-Transform ${Bl}`,version:"2.0"},defaultScene:null,accessors:new le,animations:new le,buffers:new le,cameras:new le,materials:new le,meshes:new le,nodes:new le,scenes:new le,skins:new le,textures:new le})}constructor(t){super(t),t.addEventListener("node:create",e=>{this._addChildOfRoot(e.target)})}clone(){throw new Error("Root cannot be cloned.")}copy(t,e=Dt){if(e===Dt)throw new Error("Root cannot be copied.");this.set("asset",{...t.get("asset")}),this.setName(t.getName()),this.setExtras({...t.getExtras()}),this.setDefaultScene(t.getDefaultScene()?e(t.getDefaultScene()):null);for(let r of t.listRefMapKeys("extensions")){let a=t.getExtension(r);this.setExtension(r,e(a))}return this}_addChildOfRoot(t){return t instanceof Xl?this.addRef("scenes",t):t instanceof ql?this.addRef("nodes",t):t instanceof _s?this.addRef("cameras",t):t instanceof $l?this.addRef("skins",t):t instanceof Hl?this.addRef("meshes",t):t instanceof Es?this.addRef("materials",t):t instanceof Yl?this.addRef("textures",t):t instanceof Ul?this.addRef("animations",t):t instanceof V?this.addRef("accessors",t):t instanceof Gl&&this.addRef("buffers",t),this}getAsset(){return this.get("asset")}listExtensionsUsed(){return Array.from(this._extensions)}listExtensionsRequired(){return this.listExtensionsUsed().filter(t=>t.isRequired())}_enableExtension(t){return this._extensions.add(t),this}_disableExtension(t){return this._extensions.delete(t),this}listScenes(){return this.listRefs("scenes")}setDefaultScene(t){return this.setRef("defaultScene",t)}getDefaultScene(){return this.getRef("defaultScene")}listNodes(){return this.listRefs("nodes")}listCameras(){return this.listRefs("cameras")}listSkins(){return this.listRefs("skins")}listMeshes(){return this.listRefs("meshes")}listMaterials(){return this.listRefs("materials")}listTextures(){return this.listRefs("textures")}listAnimations(){return this.listRefs("animations")}listAccessors(){return this.listRefs("accessors")}listBuffers(){return this.listRefs("buffers")}},lm=class Oi{_graph=new _i;_root=new ji(this._graph);_logger=Ts.DEFAULT_INSTANCE;static _GRAPH_DOCUMENTS=new WeakMap;static fromGraph(e){return Oi._GRAPH_DOCUMENTS.get(e)||null}constructor(){Oi._GRAPH_DOCUMENTS.set(this._graph,this)}getRoot(){return this._root}getGraph(){return this._graph}getLogger(){return this._logger}setLogger(e){return this._logger=e,this}clone(){throw new Error("Use 'cloneDocument(source)' from '@gltf-transform/functions'.")}merge(e){throw new Error("Use 'mergeDocuments(target, source)' from '@gltf-transform/functions'.")}async transform(...e){let r=e.map(a=>a.name);for(let a of e)await a(this,{stack:r});return this}hasExtension(e){return this.getRoot().listExtensionsUsed().some(r=>r.extensionName===e)}createExtension(e){let r=e.EXTENSION_NAME;return this.getRoot().listExtensionsUsed().find(a=>a.extensionName===r)||new e(this)}disposeExtension(e){let r=this.getRoot().listExtensionsUsed().find(a=>a.extensionName===e);r&&r.dispose()}createScene(e=""){return new Xl(this._graph,e)}createNode(e=""){return new ql(this._graph,e)}createCamera(e=""){return new _s(this._graph,e)}createSkin(e=""){return new $l(this._graph,e)}createMesh(e=""){return new Hl(this._graph,e)}createPrimitive(){return new la(this._graph)}createPrimitiveTarget(e=""){return new cm(this._graph,e)}createMaterial(e=""){return new Es(this._graph,e)}createTexture(e=""){return new Yl(this._graph,e)}createAnimation(e=""){return new Ul(this._graph,e)}createAnimationChannel(e=""){return new Pi(this._graph,e)}createAnimationSampler(e=""){return new As(this._graph,e)}createAccessor(e="",r=null){return r||(r=this.getRoot().listBuffers()[0]),new V(this._graph,e).setBuffer(r)}createBuffer(e=""){return new Gl(this._graph,e)}},oe=class{static EXTENSION_NAME;extensionName="";prereadTypes=[];prewriteTypes=[];readDependencies=[];writeDependencies=[];document;required=!1;properties=new Set;_listener;constructor(t){this.document=t,t.getRoot()._enableExtension(this),this._listener=r=>{let a=r,s=a.target;s instanceof Q&&s.extensionName===this.extensionName&&(a.type==="node:create"&&this._addExtensionProperty(s),a.type==="node:dispose"&&this._removeExtensionProperty(s))};let e=t.getGraph();e.addEventListener("node:create",this._listener),e.addEventListener("node:dispose",this._listener)}dispose(){this.document.getRoot()._disableExtension(this);let t=this.document.getGraph();t.removeEventListener("node:create",this._listener),t.removeEventListener("node:dispose",this._listener);for(let e of this.properties)e.dispose()}static register(){}isRequired(){return this.required}setRequired(t){return this.required=t,this}listProperties(){return Array.from(this.properties)}_addExtensionProperty(t){return this.properties.add(t),this}_removeExtensionProperty(t){return this.properties.delete(t),this}install(t,e){return this}preread(t,e){return this}prewrite(t,e){return this}},dm=class{jsonDoc;buffers=[];bufferViews=[];bufferViewBuffers=[];accessors=[];textures=[];textureInfos=new Map;materials=[];meshes=[];cameras=[];nodes=[];skins=[];animations=[];scenes=[];constructor(t){this.jsonDoc=t}setTextureInfo(t,e){this.textureInfos.set(t,e),e.texCoord!==void 0&&t.setTexCoord(e.texCoord),e.extras!==void 0&&t.setExtras(e.extras);let r=this.jsonDoc.json.textures[e.index];if(r.sampler===void 0)return;let a=this.jsonDoc.json.samplers[r.sampler];a.magFilter!==void 0&&t.setMagFilter(a.magFilter),a.minFilter!==void 0&&t.setMinFilter(a.minFilter),a.wrapS!==void 0&&t.setWrapS(a.wrapS),a.wrapT!==void 0&&t.setWrapT(a.wrapT)}},Rl={logger:Ts.DEFAULT_INSTANCE,extensions:[],dependencies:{}},um=new Set(["Buffer","Texture","Material","Mesh","Primitive","Node","Scene"]),fm=class{static read(t,e=Rl){let r={...Rl,...e},{json:a}=t,s=new lm().setLogger(r.logger);this.validate(t,r);let n=new dm(t),i=a.asset,o=s.getRoot().getAsset();i.copyright&&(o.copyright=i.copyright),i.extras&&(o.extras=i.extras),a.extras!==void 0&&s.getRoot().setExtras({...a.extras});let c=a.extensionsUsed||[],l=a.extensionsRequired||[];r.extensions.sort((g,y)=>g.EXTENSION_NAME>y.EXTENSION_NAME?1:-1);for(let g of r.extensions)if(c.includes(g.EXTENSION_NAME)){let y=s.createExtension(g).setRequired(l.includes(g.EXTENSION_NAME)),x=y.prereadTypes.filter(v=>!um.has(v));x.length&&r.logger.warn(`Preread hooks for some types (${x.join()}), requested by extension ${y.extensionName}, are unsupported. Please file an issue or a PR.`);for(let v of y.readDependencies)y.install(v,r.dependencies[v])}let f=a.buffers||[];s.getRoot().listExtensionsUsed().filter(g=>g.prereadTypes.includes("Buffer")).forEach(g=>g.preread(n,"Buffer")),n.buffers=f.map(g=>{let y=s.createBuffer(g.name);return g.extras&&y.setExtras(g.extras),g.uri&&g.uri.indexOf("__")!==0&&y.setURI(g.uri),y}),n.bufferViewBuffers=(a.bufferViews||[]).map((g,y)=>{if(!n.bufferViews[y]){let x=t.json.buffers[g.buffer],v=x.uri?t.resources[x.uri]:t.resources[Lt],E=g.byteOffset||0;n.bufferViews[y]=X.toView(v,E,g.byteLength)}return n.buffers[g.buffer]});let d=a.accessors||[];n.accessors=d.map(g=>{let y=n.bufferViewBuffers[g.bufferView],x=s.createAccessor(g.name,y).setType(g.type);return g.extras&&x.setExtras(g.extras),g.normalized!==void 0&&x.setNormalized(g.normalized),g.bufferView===void 0||x.setArray(Ms(g,n)),x});let p=a.images||[],b=a.textures||[];s.getRoot().listExtensionsUsed().filter(g=>g.prereadTypes.includes("Texture")).forEach(g=>g.preread(n,"Texture")),n.textures=p.map(g=>{let y=s.createTexture(g.name);if(g.extras&&y.setExtras(g.extras),g.bufferView!==void 0){let x=a.bufferViews[g.bufferView],v=t.json.buffers[x.buffer],E=v.uri?t.resources[v.uri]:t.resources[Lt],S=x.byteOffset||0,T=x.byteLength,_=E.slice(S,S+T);y.setImage(_)}else g.uri!==void 0&&(y.setImage(t.resources[g.uri]),g.uri.indexOf("__")!==0&&y.setURI(g.uri));if(g.mimeType!==void 0)y.setMimeType(g.mimeType);else if(g.uri){let x=Ir.extension(g.uri);y.setMimeType(bt.extensionToMimeType(x))}return y}),s.getRoot().listExtensionsUsed().filter(g=>g.prereadTypes.includes("Material")).forEach(g=>g.preread(n,"Material")),n.materials=(a.materials||[]).map(g=>{let y=s.createMaterial(g.name);g.extras&&y.setExtras(g.extras),g.alphaMode!==void 0&&y.setAlphaMode(g.alphaMode),g.alphaCutoff!==void 0&&y.setAlphaCutoff(g.alphaCutoff),g.doubleSided!==void 0&&y.setDoubleSided(g.doubleSided);let x=g.pbrMetallicRoughness||{};if(x.baseColorFactor!==void 0&&y.setBaseColorFactor(x.baseColorFactor),g.emissiveFactor!==void 0&&y.setEmissiveFactor(g.emissiveFactor),x.metallicFactor!==void 0&&y.setMetallicFactor(x.metallicFactor),x.roughnessFactor!==void 0&&y.setRoughnessFactor(x.roughnessFactor),x.baseColorTexture!==void 0){let v=x.baseColorTexture,E=n.textures[b[v.index].source];y.setBaseColorTexture(E),n.setTextureInfo(y.getBaseColorTextureInfo(),v)}if(g.emissiveTexture!==void 0){let v=g.emissiveTexture,E=n.textures[b[v.index].source];y.setEmissiveTexture(E),n.setTextureInfo(y.getEmissiveTextureInfo(),v)}if(g.normalTexture!==void 0){let v=g.normalTexture,E=n.textures[b[v.index].source];y.setNormalTexture(E),n.setTextureInfo(y.getNormalTextureInfo(),v),g.normalTexture.scale!==void 0&&y.setNormalScale(g.normalTexture.scale)}if(g.occlusionTexture!==void 0){let v=g.occlusionTexture,E=n.textures[b[v.index].source];y.setOcclusionTexture(E),n.setTextureInfo(y.getOcclusionTextureInfo(),v),g.occlusionTexture.strength!==void 0&&y.setOcclusionStrength(g.occlusionTexture.strength)}if(x.metallicRoughnessTexture!==void 0){let v=x.metallicRoughnessTexture,E=n.textures[b[v.index].source];y.setMetallicRoughnessTexture(E),n.setTextureInfo(y.getMetallicRoughnessTextureInfo(),v)}return y}),s.getRoot().listExtensionsUsed().filter(g=>g.prereadTypes.includes("Mesh")).forEach(g=>g.preread(n,"Mesh"));let h=a.meshes||[];s.getRoot().listExtensionsUsed().filter(g=>g.prereadTypes.includes("Primitive")).forEach(g=>g.preread(n,"Primitive")),n.meshes=h.map(g=>{let y=s.createMesh(g.name);return g.extras&&y.setExtras(g.extras),g.weights!==void 0&&y.setWeights(g.weights),(g.primitives||[]).forEach(x=>{let v=s.createPrimitive();x.extras&&v.setExtras(x.extras),x.material!==void 0&&v.setMaterial(n.materials[x.material]),x.mode!==void 0&&v.setMode(x.mode);for(let[S,T]of Object.entries(x.attributes||{}))v.setAttribute(S,n.accessors[T]);x.indices!==void 0&&v.setIndices(n.accessors[x.indices]);let E=g.extras&&g.extras.targetNames||[];(x.targets||[]).forEach((S,T)=>{let _=E[T]||T.toString(),I=s.createPrimitiveTarget(_);for(let[N,C]of Object.entries(S))I.setAttribute(N,n.accessors[C]);v.addTarget(I)}),y.addPrimitive(v)}),y}),n.cameras=(a.cameras||[]).map(g=>{let y=s.createCamera(g.name).setType(g.type);if(g.extras&&y.setExtras(g.extras),g.type===_s.Type.PERSPECTIVE){let x=g.perspective;y.setYFov(x.yfov),y.setZNear(x.znear),x.zfar!==void 0&&y.setZFar(x.zfar),x.aspectRatio!==void 0&&y.setAspectRatio(x.aspectRatio)}else{let x=g.orthographic;y.setZNear(x.znear).setZFar(x.zfar).setXMag(x.xmag).setYMag(x.ymag)}return y});let u=a.nodes||[];s.getRoot().listExtensionsUsed().filter(g=>g.prereadTypes.includes("Node")).forEach(g=>g.preread(n,"Node")),n.nodes=u.map(g=>{let y=s.createNode(g.name);if(g.extras&&y.setExtras(g.extras),g.translation!==void 0&&y.setTranslation(g.translation),g.rotation!==void 0&&y.setRotation(g.rotation),g.scale!==void 0&&y.setScale(g.scale),g.matrix!==void 0){let x=[0,0,0],v=[0,0,0,1],E=[1,1,1];he.decompose(g.matrix,x,v,E),y.setTranslation(x),y.setRotation(v),y.setScale(E)}return g.weights!==void 0&&y.setWeights(g.weights),y}),n.skins=(a.skins||[]).map(g=>{let y=s.createSkin(g.name);g.extras&&y.setExtras(g.extras),g.inverseBindMatrices!==void 0&&y.setInverseBindMatrices(n.accessors[g.inverseBindMatrices]),g.skeleton!==void 0&&y.setSkeleton(n.nodes[g.skeleton]);for(let x of g.joints)y.addJoint(n.nodes[x]);return y}),u.map((g,y)=>{let x=n.nodes[y];(g.children||[]).forEach(v=>x.addChild(n.nodes[v])),g.mesh!==void 0&&x.setMesh(n.meshes[g.mesh]),g.camera!==void 0&&x.setCamera(n.cameras[g.camera]),g.skin!==void 0&&x.setSkin(n.skins[g.skin])}),n.animations=(a.animations||[]).map(g=>{let y=s.createAnimation(g.name);g.extras&&y.setExtras(g.extras);let x=(g.samplers||[]).map(v=>{let E=s.createAnimationSampler().setInput(n.accessors[v.input]).setOutput(n.accessors[v.output]).setInterpolation(v.interpolation||As.Interpolation.LINEAR);return v.extras&&E.setExtras(v.extras),y.addSampler(E),E});return(g.channels||[]).forEach(v=>{let E=s.createAnimationChannel().setSampler(x[v.sampler]).setTargetPath(v.target.path);v.target.node!==void 0&&E.setTargetNode(n.nodes[v.target.node]),v.extras&&E.setExtras(v.extras),y.addChannel(E)}),y});let m=a.scenes||[];return s.getRoot().listExtensionsUsed().filter(g=>g.prereadTypes.includes("Scene")).forEach(g=>g.preread(n,"Scene")),n.scenes=m.map(g=>{let y=s.createScene(g.name);return g.extras&&y.setExtras(g.extras),(g.nodes||[]).map(x=>n.nodes[x]).forEach(x=>y.addChild(x)),y}),a.scene!==void 0&&s.getRoot().setDefaultScene(n.scenes[a.scene]),s.getRoot().listExtensionsUsed().forEach(g=>g.read(n)),d.forEach((g,y)=>{let x=n.accessors[y],v=!!g.sparse,E=!g.bufferView&&!x.getArray();(v||E)&&x.setSparse(!0).setArray(bm(g,n))}),s}static validate(t,e){let r=t.json;if(r.asset.version!=="2.0")throw new Error(`Unsupported glTF version, "${r.asset.version}".`);if(r.extensionsRequired){for(let a of r.extensionsRequired)if(!e.extensions.find(s=>s.EXTENSION_NAME===a))throw new Error(`Missing required extension, "${a}".`)}if(r.extensionsUsed)for(let a of r.extensionsUsed)e.extensions.find(s=>s.EXTENSION_NAME===a)||e.logger.warn(`Missing optional extension, "${a}".`)}};function hm(t,e){let r=e.jsonDoc,a=e.bufferViews[t.bufferView],s=r.json.bufferViews[t.bufferView],n=Ss[t.componentType],i=V.getElementSize(t.type),o=n.BYTES_PER_ELEMENT,c=t.byteOffset||0,l=new n(t.count*i),f=new DataView(a.buffer,a.byteOffset,a.byteLength),d=s.byteStride;for(let p=0;p<t.count;p++)for(let b=0;b<i;b++){let h=c+p*d+b*o,u;switch(t.componentType){case V.ComponentType.FLOAT:u=f.getFloat32(h,!0);break;case V.ComponentType.UNSIGNED_INT:u=f.getUint32(h,!0);break;case V.ComponentType.UNSIGNED_SHORT:u=f.getUint16(h,!0);break;case V.ComponentType.UNSIGNED_BYTE:u=f.getUint8(h);break;case V.ComponentType.SHORT:u=f.getInt16(h,!0);break;case V.ComponentType.BYTE:u=f.getInt8(h);break;case V.ComponentType.FLOAT16:u=f.getFloat16(h,!0);break;case V.ComponentType.FLOAT64:u=f.getFloat64(h,!0);break;default:throw new Error(`Unexpected componentType "${t.componentType}".`)}l[p*i+b]=u}return l}function Ms(t,e){let r=e.jsonDoc,a=e.bufferViews[t.bufferView],s=r.json.bufferViews[t.bufferView],n=Ss[t.componentType],i=V.getElementSize(t.type),o=n.BYTES_PER_ELEMENT,c=i*o;if(s.byteStride!==void 0&&s.byteStride!==c)return hm(t,e);let l=a.byteOffset+(t.byteOffset||0),f=t.count*i*o;return new n(a.buffer.slice(l,l+f))}function bm(t,e){let r=Ss[t.componentType],a=V.getElementSize(t.type),s;t.bufferView!==void 0?s=Ms(t,e):s=new r(t.count*a);let n=t.sparse;if(!n)return s;let i=n.count,o={...t,...n.indices,count:i,type:"SCALAR"},c={...t,...n.values,count:i},l=Ms(o,e),f=Ms(c,e);for(let d=0;d<o.count;d++)for(let p=0;p<a;p++)s[l[d]*a+p]=f[d*a+p];return s}var Jl=(function(t){return t[t.ARRAY_BUFFER=34962]="ARRAY_BUFFER",t[t.ELEMENT_ARRAY_BUFFER=34963]="ELEMENT_ARRAY_BUFFER",t})(Jl||{}),jt=class{_doc;jsonDoc;options;static BufferViewTarget=Jl;static BufferViewUsage=Lg;static USAGE_TO_TARGET={ARRAY_BUFFER:34962,ELEMENT_ARRAY_BUFFER:34963};accessorIndexMap=new Map;animationIndexMap=new Map;bufferIndexMap=new Map;cameraIndexMap=new Map;skinIndexMap=new Map;materialIndexMap=new Map;meshIndexMap=new Map;nodeIndexMap=new Map;imageIndexMap=new Map;textureDefIndexMap=new Map;textureInfoDefMap=new Map;samplerDefIndexMap=new Map;sceneIndexMap=new Map;imageBufferViews=[];otherBufferViews=new Map;otherBufferViewsIndexMap=new Map;extensionData={};bufferURIGenerator;imageURIGenerator;logger;_accessorUsageMap=new Map;accessorUsageGroupedByParent=new Set(["ARRAY_BUFFER"]);accessorParents=new Map;constructor(t,e,r){this._doc=t,this.jsonDoc=e,this.options=r;let a=t.getRoot(),s=a.listBuffers().length,n=a.listTextures().length;this.bufferURIGenerator=new Nl(s>1,()=>r.basename||"buffer"),this.imageURIGenerator=new Nl(n>1,i=>pm(t,i)||r.basename||"texture"),this.logger=t.getLogger()}createTextureInfoDef(t,e){let r={magFilter:e.getMagFilter()||void 0,minFilter:e.getMinFilter()||void 0,wrapS:e.getWrapS(),wrapT:e.getWrapT()},a=JSON.stringify(r);this.samplerDefIndexMap.has(a)||(this.samplerDefIndexMap.set(a,this.jsonDoc.json.samplers.length),this.jsonDoc.json.samplers.push(r));let s={source:this.imageIndexMap.get(t),sampler:this.samplerDefIndexMap.get(a)},n=JSON.stringify(s);this.textureDefIndexMap.has(n)||(this.textureDefIndexMap.set(n,this.jsonDoc.json.textures.length),this.jsonDoc.json.textures.push(s));let i={index:this.textureDefIndexMap.get(n)};return e.getTexCoord()!==0&&(i.texCoord=e.getTexCoord()),Object.keys(e.getExtras()).length>0&&(i.extras=e.getExtras()),this.textureInfoDefMap.set(e,i),i}createPropertyDef(t){let e={};return t.getName()&&(e.name=t.getName()),Object.keys(t.getExtras()).length>0&&(e.extras=t.getExtras()),e}createAccessorDef(t){let e=this.createPropertyDef(t);return e.type=t.getType(),e.componentType=t.getComponentType(),e.count=t.getCount(),this._doc.getGraph().listParentEdges(t).some(r=>r.getName()==="attributes"&&r.getAttributes().key==="POSITION"||r.getName()==="input")&&(e.max=t.getMax([]).map(Math.fround),e.min=t.getMin([]).map(Math.fround)),t.getNormalized()&&(e.normalized=t.getNormalized()),e}createImageData(t,e,r){if(this.options.format==="GLB")this.imageBufferViews.push(e),t.bufferView=this.jsonDoc.json.bufferViews.length,this.jsonDoc.json.bufferViews.push({buffer:0,byteOffset:-1,byteLength:e.byteLength});else{let a=bt.mimeTypeToExtension(r.getMimeType());t.uri=this.imageURIGenerator.createURI(r,a),this.assignResourceURI(t.uri,e,!1)}}assignResourceURI(t,e,r){let a=this.jsonDoc.resources;if(!(t in a)){a[t]=e;return}if(e===a[t]){this.logger.warn(`Duplicate resource URI, "${t}".`);return}let s=`Resource URI "${t}" already assigned to different data.`;if(!r){this.logger.warn(s);return}throw new Error(s)}getAccessorUsage(t){let e=this._accessorUsageMap.get(t);if(e)return e;if(t.getSparse())return"SPARSE";for(let r of this._doc.getGraph().listParentEdges(t)){let{usage:a}=r.getAttributes();if(a)return a;r.getParent().propertyType!=="Root"&&this.logger.warn(`Missing attribute ".usage" on edge, "${r.getName()}".`)}return"OTHER"}addAccessorToUsageGroup(t,e){let r=this._accessorUsageMap.get(t);if(r&&r!==e)throw new Error(`Accessor with usage "${r}" cannot be reused as "${e}".`);return this._accessorUsageMap.set(t,e),this}},Nl=class{multiple;basename;counter={};constructor(t,e){this.multiple=t,this.basename=e}createURI(t,e){if(t.getURI())return t.getURI();if(this.multiple){let r=this.basename(t);return this.counter[r]=this.counter[r]||1,`${r}_${this.counter[r]++}.${e}`}else return`${this.basename(t)}.${e}`}};function pm(t,e){let r=t.getGraph().listParentEdges(e).find(a=>a.getParent()!==t.getRoot());return r?r.getName().replace(/texture$/i,""):""}var{BufferViewUsage:vs}=jt,{UNSIGNED_INT:gm,UNSIGNED_SHORT:mm,UNSIGNED_BYTE:ym}=V.ComponentType,xm=new Set(["Accessor","Buffer","Material","Mesh"]),wm=class{static write(t,e){let r=t.getGraph(),a=t.getRoot(),s={asset:{generator:`glTF-Transform ${Bl}`,...a.getAsset()},extras:{...a.getExtras()}},n={json:s,resources:{}},i=new jt(t,n,e),o=e.logger||Ts.DEFAULT_INSTANCE,c=new Set(e.extensions.map(u=>u.EXTENSION_NAME)),l=t.getRoot().listExtensionsUsed().filter(u=>c.has(u.extensionName)).sort((u,m)=>u.extensionName>m.extensionName?1:-1),f=t.getRoot().listExtensionsRequired().filter(u=>c.has(u.extensionName)).sort((u,m)=>u.extensionName>m.extensionName?1:-1);l.length<t.getRoot().listExtensionsUsed().length&&o.warn("Some extensions were not registered for I/O, and will not be written.");for(let u of l){let m=u.prewriteTypes.filter(g=>!xm.has(g));m.length&&o.warn(`Prewrite hooks for some types (${m.join()}), requested by extension ${u.extensionName}, are unsupported. Please file an issue or a PR.`);for(let g of u.writeDependencies)u.install(g,e.dependencies[g])}function d(u,m,g,y){let x=[],v=0;for(let S of u){let T=i.createAccessorDef(S);T.bufferView=s.bufferViews.length;let _=S.getArray(),I=X.pad(X.toView(_));T.byteOffset=v,v+=I.byteLength,x.push(I),i.accessorIndexMap.set(S,s.accessors.length),s.accessors.push(T)}let E={buffer:m,byteOffset:g,byteLength:X.concat(x).byteLength};return y&&(E.target=y),s.bufferViews.push(E),{buffers:x,byteLength:v}}function p(u,m,g){let y=u[0].getCount(),x=0;for(let _ of u){let I=i.createAccessorDef(_);I.bufferView=s.bufferViews.length,I.byteOffset=x;let N=_.getElementSize(),C=_.getComponentSize();x+=X.padNumber(N*C),i.accessorIndexMap.set(_,s.accessors.length),s.accessors.push(I)}let v=y*x,E=new ArrayBuffer(v),S=new DataView(E);for(let _=0;_<y;_++){let I=0;for(let N of u){let C=N.getElementSize(),B=N.getComponentSize(),R=N.getComponentType(),j=N.getArray();for(let q=0;q<C;q++){let Y=_*x+I+q*B,te=j[_*C+q];switch(R){case V.ComponentType.FLOAT:S.setFloat32(Y,te,!0);break;case V.ComponentType.BYTE:S.setInt8(Y,te);break;case V.ComponentType.SHORT:S.setInt16(Y,te,!0);break;case V.ComponentType.UNSIGNED_BYTE:S.setUint8(Y,te);break;case V.ComponentType.UNSIGNED_SHORT:S.setUint16(Y,te,!0);break;case V.ComponentType.UNSIGNED_INT:S.setUint32(Y,te,!0);break;case V.ComponentType.FLOAT16:S.setFloat16(Y,te,!0);break;case V.ComponentType.FLOAT64:S.setFloat64(Y,te,!0);break;default:throw new Error("Unexpected component type: "+R)}}I+=X.padNumber(C*B)}}let T={buffer:m,byteOffset:g,byteLength:v,byteStride:x,target:jt.BufferViewTarget.ARRAY_BUFFER};return s.bufferViews.push(T),{byteLength:v,buffers:[new Uint8Array(E)]}}function b(u,m,g){let y=[],x=0,v=new Map,E=-1/0,S=!1;for(let R of u){let j=i.createAccessorDef(R);s.accessors.push(j),i.accessorIndexMap.set(R,s.accessors.length-1);let q=[],Y=[],te=[],ye=new Array(R.getElementSize()).fill(0);for(let be=0,Ce=R.getCount();be<Ce;be++)if(R.getElement(be,te),!he.eq(te,ye,0)){E=Math.max(be,E),q.push(be);for(let xe=0;xe<te.length;xe++)Y.push(te[xe])}let ne=q.length,me={accessorDef:j,count:ne};if(v.set(R,me),ne===0)continue;ne>R.getCount()/2&&(S=!0);let Ie=Ss[R.getComponentType()];me.indices=q,me.values=new Ie(Y)}if(!Number.isFinite(E))return{buffers:y,byteLength:x};S&&o.warn("Some sparse accessors have >50% non-zero elements, which may increase file size.");let T=E<255?Uint8Array:E<65535?Uint16Array:Uint32Array,_=E<255?ym:E<65535?mm:gm,I={buffer:m,byteOffset:g+x,byteLength:0};for(let R of u){let j=v.get(R);if(j.count===0)continue;j.indicesByteOffset=I.byteLength;let q=X.pad(X.toView(new T(j.indices)));y.push(q),x+=q.byteLength,I.byteLength+=q.byteLength}s.bufferViews.push(I);let N=s.bufferViews.length-1,C={buffer:m,byteOffset:g+x,byteLength:0};for(let R of u){let j=v.get(R);if(j.count===0)continue;j.valuesByteOffset=C.byteLength;let q=X.pad(X.toView(j.values));y.push(q),x+=q.byteLength,C.byteLength+=q.byteLength}s.bufferViews.push(C);let B=s.bufferViews.length-1;for(let R of u){let j=v.get(R);j.count!==0&&(j.accessorDef.sparse={count:j.count,indices:{bufferView:N,byteOffset:j.indicesByteOffset,componentType:_},values:{bufferView:B,byteOffset:j.valuesByteOffset}})}return{buffers:y,byteLength:x}}if(s.accessors=[],s.bufferViews=[],s.samplers=[],s.textures=[],s.images=a.listTextures().map((u,m)=>{let g=i.createPropertyDef(u);u.getMimeType()&&(g.mimeType=u.getMimeType());let y=u.getImage();return y&&i.createImageData(g,y,u),i.imageIndexMap.set(u,m),g}),l.filter(u=>u.prewriteTypes.includes("Accessor")).forEach(u=>u.prewrite(i,"Accessor")),a.listAccessors().forEach(u=>{let m=i.accessorUsageGroupedByParent,g=i.accessorParents;if(i.accessorIndexMap.has(u))return;let y=i.getAccessorUsage(u);if(i.addAccessorToUsageGroup(u,y),m.has(y)){let x=r.listParents(u).find(v=>v.propertyType!=="Root");g.set(u,x)}}),l.filter(u=>u.prewriteTypes.includes("Buffer")).forEach(u=>u.prewrite(i,"Buffer")),(a.listAccessors().length>0||i.otherBufferViews.size>0||a.listTextures().length>0&&e.format==="GLB")&&a.listBuffers().length===0)throw new Error("Buffer required for Document resources, but none was found.");s.buffers=[],a.listBuffers().forEach((u,m)=>{let g=i.createPropertyDef(u),y=i.accessorUsageGroupedByParent,x=u.listParents().filter(N=>N instanceof V),v=new Set(x.map(N=>i.accessorParents.get(N))),E=new Map(Array.from(v).map((N,C)=>[N,C])),S={};for(let N of x){if(i.accessorIndexMap.has(N))continue;let C=i.getAccessorUsage(N),B=C;if(y.has(C)){let R=i.accessorParents.get(N);B+=`:${E.get(R)}`}S[B]||={usage:C,accessors:[]},S[B].accessors.push(N)}let T=[],_=s.buffers.length,I=0;for(let{usage:N,accessors:C}of Object.values(S))if(N===vs.ARRAY_BUFFER&&e.vertexLayout==="interleaved"){let B=p(C,_,I);I+=B.byteLength;for(let R of B.buffers)T.push(R)}else if(N===vs.ARRAY_BUFFER)for(let B of C){let R=p([B],_,I);I+=R.byteLength;for(let j of R.buffers)T.push(j)}else if(N===vs.SPARSE){let B=b(C,_,I);I+=B.byteLength;for(let R of B.buffers)T.push(R)}else if(N===vs.ELEMENT_ARRAY_BUFFER){let B=jt.BufferViewTarget.ELEMENT_ARRAY_BUFFER,R=d(C,_,I,B);I+=R.byteLength;for(let j of R.buffers)T.push(j)}else{let B=d(C,_,I);I+=B.byteLength;for(let R of B.buffers)T.push(R)}if(i.imageBufferViews.length&&m===0){for(let N=0;N<i.imageBufferViews.length;N++)if(s.bufferViews[s.images[N].bufferView].byteOffset=I,I+=i.imageBufferViews[N].byteLength,T.push(i.imageBufferViews[N]),I%8){let C=8-I%8;I+=C,T.push(new Uint8Array(C))}}if(i.otherBufferViews.has(u))for(let N of i.otherBufferViews.get(u))s.bufferViews.push({buffer:_,byteOffset:I,byteLength:N.byteLength}),i.otherBufferViewsIndexMap.set(N,s.bufferViews.length-1),I+=N.byteLength,T.push(N);if(I){let N;e.format==="GLB"?N=Lt:(N=i.bufferURIGenerator.createURI(u,"bin"),g.uri=N),g.byteLength=I,i.assignResourceURI(N,X.concat(T),!0)}s.buffers.push(g),i.bufferIndexMap.set(u,m)}),a.listAccessors().find(u=>!u.getBuffer())&&o.warn("Skipped writing one or more Accessors: no Buffer assigned."),l.filter(u=>u.prewriteTypes.includes("Material")).forEach(u=>u.prewrite(i,"Material")),s.materials=a.listMaterials().map((u,m)=>{let g=i.createPropertyDef(u);if(u.getAlphaMode()!==Es.AlphaMode.OPAQUE&&(g.alphaMode=u.getAlphaMode()),u.getAlphaMode()===Es.AlphaMode.MASK&&(g.alphaCutoff=u.getAlphaCutoff()),u.getDoubleSided()&&(g.doubleSided=!0),g.pbrMetallicRoughness={},he.eq(u.getBaseColorFactor(),[1,1,1,1])||(g.pbrMetallicRoughness.baseColorFactor=u.getBaseColorFactor()),he.eq(u.getEmissiveFactor(),[0,0,0])||(g.emissiveFactor=u.getEmissiveFactor()),u.getRoughnessFactor()!==1&&(g.pbrMetallicRoughness.roughnessFactor=u.getRoughnessFactor()),u.getMetallicFactor()!==1&&(g.pbrMetallicRoughness.metallicFactor=u.getMetallicFactor()),u.getBaseColorTexture()){let y=u.getBaseColorTexture(),x=u.getBaseColorTextureInfo();g.pbrMetallicRoughness.baseColorTexture=i.createTextureInfoDef(y,x)}if(u.getEmissiveTexture()){let y=u.getEmissiveTexture(),x=u.getEmissiveTextureInfo();g.emissiveTexture=i.createTextureInfoDef(y,x)}if(u.getNormalTexture()){let y=u.getNormalTexture(),x=u.getNormalTextureInfo(),v=i.createTextureInfoDef(y,x);u.getNormalScale()!==1&&(v.scale=u.getNormalScale()),g.normalTexture=v}if(u.getOcclusionTexture()){let y=u.getOcclusionTexture(),x=u.getOcclusionTextureInfo(),v=i.createTextureInfoDef(y,x);u.getOcclusionStrength()!==1&&(v.strength=u.getOcclusionStrength()),g.occlusionTexture=v}if(u.getMetallicRoughnessTexture()){let y=u.getMetallicRoughnessTexture(),x=u.getMetallicRoughnessTextureInfo();g.pbrMetallicRoughness.metallicRoughnessTexture=i.createTextureInfoDef(y,x)}return i.materialIndexMap.set(u,m),g}),l.filter(u=>u.prewriteTypes.includes("Mesh")).forEach(u=>u.prewrite(i,"Mesh")),s.meshes=a.listMeshes().map((u,m)=>{let g=i.createPropertyDef(u),y=null;return g.primitives=u.listPrimitives().map(x=>{let v={attributes:{}};v.mode=x.getMode();let E=x.getMaterial();E&&(v.material=i.materialIndexMap.get(E)),Object.keys(x.getExtras()).length&&(v.extras=x.getExtras());let S=x.getIndices();S&&(v.indices=i.accessorIndexMap.get(S));for(let T of x.listSemantics())v.attributes[T]=i.accessorIndexMap.get(x.getAttribute(T));for(let T of x.listTargets()){let _={};for(let I of T.listSemantics())_[I]=i.accessorIndexMap.get(T.getAttribute(I));v.targets=v.targets||[],v.targets.push(_)}return x.listTargets().length&&!y&&(y=x.listTargets().map(T=>T.getName())),v}),u.getWeights().length&&(g.weights=u.getWeights()),y&&(g.extras=g.extras||{},g.extras.targetNames=y),i.meshIndexMap.set(u,m),g}),s.cameras=a.listCameras().map((u,m)=>{let g=i.createPropertyDef(u);if(g.type=u.getType(),g.type===_s.Type.PERSPECTIVE){g.perspective={znear:u.getZNear(),zfar:u.getZFar(),yfov:u.getYFov()};let y=u.getAspectRatio();y!==null&&(g.perspective.aspectRatio=y)}else g.orthographic={znear:u.getZNear(),zfar:u.getZFar(),xmag:u.getXMag(),ymag:u.getYMag()};return i.cameraIndexMap.set(u,m),g}),s.nodes=a.listNodes().map((u,m)=>{let g=i.createPropertyDef(u);return he.eq(u.getTranslation(),[0,0,0])||(g.translation=u.getTranslation()),he.eq(u.getRotation(),[0,0,0,1])||(g.rotation=u.getRotation()),he.eq(u.getScale(),[1,1,1])||(g.scale=u.getScale()),u.getWeights().length&&(g.weights=u.getWeights()),i.nodeIndexMap.set(u,m),g}),s.skins=a.listSkins().map((u,m)=>{let g=i.createPropertyDef(u),y=u.getInverseBindMatrices();y&&(g.inverseBindMatrices=i.accessorIndexMap.get(y));let x=u.getSkeleton();return x&&(g.skeleton=i.nodeIndexMap.get(x)),g.joints=u.listJoints().map(v=>i.nodeIndexMap.get(v)),i.skinIndexMap.set(u,m),g}),a.listNodes().forEach((u,m)=>{let g=s.nodes[m],y=u.getMesh();y&&(g.mesh=i.meshIndexMap.get(y));let x=u.getCamera();x&&(g.camera=i.cameraIndexMap.get(x));let v=u.getSkin();v&&(g.skin=i.skinIndexMap.get(v)),u.listChildren().length>0&&(g.children=u.listChildren().map(E=>i.nodeIndexMap.get(E)))}),s.animations=a.listAnimations().map((u,m)=>{let g=i.createPropertyDef(u),y=new Map;return g.samplers=u.listSamplers().map((x,v)=>{let E=i.createPropertyDef(x);return E.input=i.accessorIndexMap.get(x.getInput()),E.output=i.accessorIndexMap.get(x.getOutput()),E.interpolation=x.getInterpolation(),y.set(x,v),E}),g.channels=u.listChannels().map(x=>{let v=i.createPropertyDef(x);return v.sampler=y.get(x.getSampler()),v.target={node:i.nodeIndexMap.get(x.getTargetNode()),path:x.getTargetPath()},v}),i.animationIndexMap.set(u,m),g}),s.scenes=a.listScenes().map((u,m)=>{let g=i.createPropertyDef(u);return g.nodes=u.listChildren().map(y=>i.nodeIndexMap.get(y)),i.sceneIndexMap.set(u,m),g});let h=a.getDefaultScene();return h&&(s.scene=a.listScenes().indexOf(h)),s.extensionsUsed=l.map(u=>u.extensionName),s.extensionsRequired=f.map(u=>u.extensionName),l.forEach(u=>u.write(i)),vm(s),n}};function vm(t){let e=[];for(let r in t){let a=t[r];(Array.isArray(a)&&a.length===0||a===null||a===""||a&&typeof a=="object"&&Object.keys(a).length===0)&&e.push(r)}for(let r of e)delete t[r]}var Mm=class{_logger=Ts.DEFAULT_INSTANCE;_extensions=new Set;_dependencies={};_vertexLayout="interleaved";_strictResources=!0;lastReadBytes=0;lastWriteBytes=0;setLogger(t){return this._logger=t,this}registerExtensions(t){for(let e of t)this._extensions.add(e),e.register();return this}registerDependencies(t){return Object.assign(this._dependencies,t),this}setVertexLayout(t){return this._vertexLayout=t,this}setStrictResources(t){return this._strictResources=t,this}async read(t){return await this.readJSON(await this.readAsJSON(t))}async readAsJSON(t){let e=await this.readURI(t,"view");this.lastReadBytes=e.byteLength;let r=Cl(e)?this._binaryToJSON(e):{json:JSON.parse(X.decodeText(e)),resources:{}};return await this._readResourcesExternal(r,this.dirname(t)),this._readResourcesInternal(r),r}async readJSON(t){return t=this._copyJSON(t),this._readResourcesInternal(t),fm.read(t,{extensions:Array.from(this._extensions),dependencies:this._dependencies,logger:this._logger})}async binaryToJSON(t){let e=this._binaryToJSON(X.assertView(t));this._readResourcesInternal(e);let r=e.json;if(r.buffers&&r.buffers.some(a=>km(e,a)))throw new Error("Cannot resolve external buffers with binaryToJSON().");if(r.images&&r.images.some(a=>Em(e,a)))throw new Error("Cannot resolve external images with binaryToJSON().");return e}async readBinary(t){return this.readJSON(await this.binaryToJSON(X.assertView(t)))}async writeJSON(t,e={}){if(e.format==="GLB"&&t.getRoot().listBuffers().length>1)throw new Error("GLB must have 0\u20131 buffers.");return wm.write(t,{format:e.format||"GLTF",basename:e.basename||"",logger:this._logger,vertexLayout:this._vertexLayout,dependencies:{...this._dependencies},extensions:Array.from(this._extensions)})}async writeBinary(t){let{json:e,resources:r}=await this.writeJSON(t,{format:"GLB"}),a=new Uint32Array([1179937895,2,12]),s=JSON.stringify(e),n=X.pad(X.encodeText(s),32),i=X.toView(new Uint32Array([n.byteLength,1313821514])),o=X.concat([i,n]);a[a.length-1]+=o.byteLength;let c=Object.values(r)[0];if(!c||!c.byteLength)return X.concat([X.toView(a),o]);let l=X.pad(c,0),f=X.toView(new Uint32Array([l.byteLength,5130562])),d=X.concat([f,l]);return a[a.length-1]+=d.byteLength,X.concat([X.toView(a),o,d])}async _readResourcesExternal(t,e){let r=t.json.images||[],a=t.json.buffers||[],s=[...r,...a].map(async n=>{let i=n.uri;if(!i||i.match(/data:/))return Promise.resolve();try{t.resources[i]=await this.readURI(this.resolve(e,i),"view"),this.lastReadBytes+=t.resources[i].byteLength}catch(o){if(!this._strictResources&&r.includes(n))this._logger.warn(`Failed to load image URI, "${i}". ${o}`),t.resources[i]=null;else throw o}});await Promise.all(s)}_readResourcesInternal(t){function e(r){if(r.uri){if(r.uri in t.resources){X.assertView(t.resources[r.uri]);return}if(r.uri.match(/data:/)){let a=`__${sm()}.${Ir.extension(r.uri)}`;t.resources[a]=X.createBufferFromDataURI(r.uri),r.uri=a}}}(t.json.images||[]).forEach(r=>{if(r.bufferView===void 0&&r.uri===void 0)throw new Error("Missing resource URI or buffer view.");e(r)}),(t.json.buffers||[]).forEach(e)}_copyJSON(t){let{images:e,buffers:r}=t.json;return t={json:{...t.json},resources:{...t.resources}},e&&(t.json.images=e.map(a=>({...a}))),r&&(t.json.buffers=r.map(a=>({...a}))),t}_binaryToJSON(t){if(!Cl(t))throw new Error("Invalid glTF 2.0 binary.");let e=new Uint32Array(t.buffer,t.byteOffset+12,2);if(e[1]!==1313821514)throw new Error("Missing required GLB JSON chunk.");let r=20,a=e[0],s=X.decodeText(X.toView(t,r,a)),n=JSON.parse(s),i=r+a;if(t.byteLength<=i)return{json:n,resources:{}};let o=new Uint32Array(t.buffer,t.byteOffset+i,2);if(o[1]!==5130562)return{json:n,resources:{}};let c=o[0],l=X.toView(t,i+8,c);return{json:n,resources:{[Lt]:l}}}};function km(t,e){return e.uri!==void 0&&!(e.uri in t.resources)}function Em(t,e){return e.uri!==void 0&&!(e.uri in t.resources)&&e.bufferView===void 0}function Cl(t){if(t.byteLength<3*Uint32Array.BYTES_PER_ELEMENT)return!1;let e=new Uint32Array(t.buffer,t.byteOffset,3);return e[0]===1179937895&&e[1]===2}var Ql=class extends Mm{_fetchConfig;constructor(t=Ri.DEFAULT_INIT){super(),this._fetchConfig=t}async readURI(t,e){let r=await fetch(t,this._fetchConfig);switch(e){case"view":return new Uint8Array(await r.arrayBuffer());case"text":return r.text()}}resolve(t,e){return Ri.resolve(t,e)}dirname(t){return Ri.dirname(t)}};function Sm(){return{vkFormat:0,typeSize:1,pixelWidth:0,pixelHeight:0,pixelDepth:0,layerCount:0,faceCount:1,levelCount:0,supercompressionScheme:0,levels:[],dataFormatDescriptor:[{vendorId:0,descriptorType:0,versionNumber:2,colorModel:0,colorPrimaries:1,transferFunction:2,flags:0,texelBlockDimension:[0,0,0,0],bytesPlane:[0,0,0,0,0,0,0,0],samples:[]}],keyValue:{},globalData:null}}var ur=class{constructor(e,r,a,s){this._dataView=void 0,this._littleEndian=void 0,this._offset=void 0,this._dataView=new DataView(e.buffer,e.byteOffset+r,a),this._littleEndian=s,this._offset=0}_nextUint8(){let e=this._dataView.getUint8(this._offset);return this._offset+=1,e}_nextUint16(){let e=this._dataView.getUint16(this._offset,this._littleEndian);return this._offset+=2,e}_nextUint32(){let e=this._dataView.getUint32(this._offset,this._littleEndian);return this._offset+=4,e}_nextUint64(){let e=this._dataView.getUint32(this._offset,this._littleEndian),r=this._dataView.getUint32(this._offset+4,this._littleEndian),a=e+2**32*r;return this._offset+=8,a}_nextInt32(){let e=this._dataView.getInt32(this._offset,this._littleEndian);return this._offset+=4,e}_nextUint8Array(e){let r=new Uint8Array(this._dataView.buffer,this._dataView.byteOffset+this._offset,e);return this._offset+=e,r}_skip(e){return this._offset+=e,this}_scan(e,r=0){let a=this._offset,s=0;for(;this._dataView.getUint8(this._offset)!==r&&s<e;)s++,this._offset++;return s<e&&this._offset++,new Uint8Array(this._dataView.buffer,this._dataView.byteOffset+a,s)}};var vS=new Uint8Array([0]),ze=[171,75,84,88,32,50,48,187,13,10,26,10];function Zl(t){return new TextDecoder().decode(t)}function Is(t){let e=new Uint8Array(t.buffer,t.byteOffset,ze.length);if(e[0]!==ze[0]||e[1]!==ze[1]||e[2]!==ze[2]||e[3]!==ze[3]||e[4]!==ze[4]||e[5]!==ze[5]||e[6]!==ze[6]||e[7]!==ze[7]||e[8]!==ze[8]||e[9]!==ze[9]||e[10]!==ze[10]||e[11]!==ze[11])throw new Error("Missing KTX 2.0 identifier.");let r=Sm(),a=17*Uint32Array.BYTES_PER_ELEMENT,s=new ur(t,ze.length,a,!0);r.vkFormat=s._nextUint32(),r.typeSize=s._nextUint32(),r.pixelWidth=s._nextUint32(),r.pixelHeight=s._nextUint32(),r.pixelDepth=s._nextUint32(),r.layerCount=s._nextUint32(),r.faceCount=s._nextUint32(),r.levelCount=s._nextUint32(),r.supercompressionScheme=s._nextUint32();let n=s._nextUint32(),i=s._nextUint32(),o=s._nextUint32(),c=s._nextUint32(),l=s._nextUint64(),f=s._nextUint64(),d=Math.max(r.levelCount,1)*3*8,p=new ur(t,ze.length+a,d,!0);for(let P=0,U=Math.max(r.levelCount,1);P<U;P++)r.levels.push({levelData:new Uint8Array(t.buffer,t.byteOffset+p._nextUint64(),p._nextUint64()),uncompressedByteLength:p._nextUint64()});let b=new ur(t,n,i,!0);b._skip(4);let h=b._nextUint16(),u=b._nextUint16(),m=b._nextUint16(),g=b._nextUint16(),y=b._nextUint8(),x=b._nextUint8(),v=b._nextUint8(),E=b._nextUint8(),S=[b._nextUint8(),b._nextUint8(),b._nextUint8(),b._nextUint8()],T=[b._nextUint8(),b._nextUint8(),b._nextUint8(),b._nextUint8(),b._nextUint8(),b._nextUint8(),b._nextUint8(),b._nextUint8()],I={vendorId:h,descriptorType:u,versionNumber:m,colorModel:y,colorPrimaries:x,transferFunction:v,flags:E,texelBlockDimension:S,bytesPlane:T,samples:[]},B=(g/4-6)/4;for(let P=0;P<B;P++){let U={bitOffset:b._nextUint16(),bitLength:b._nextUint8(),channelType:b._nextUint8(),samplePosition:[b._nextUint8(),b._nextUint8(),b._nextUint8(),b._nextUint8()],sampleLower:Number.NEGATIVE_INFINITY,sampleUpper:Number.POSITIVE_INFINITY};U.channelType&64?(U.sampleLower=b._nextInt32(),U.sampleUpper=b._nextInt32()):(U.sampleLower=b._nextUint32(),U.sampleUpper=b._nextUint32()),I.samples[P]=U}r.dataFormatDescriptor.length=0,r.dataFormatDescriptor.push(I);let R=new ur(t,o,c,!0);for(;R._offset<c;){let P=R._nextUint32(),U=R._scan(P),J=Zl(U);if(r.keyValue[J]=R._nextUint8Array(P-U.byteLength-1),J.match(/^ktx/i)){let ve=Zl(r.keyValue[J]);r.keyValue[J]=ve.substring(0,ve.lastIndexOf("\0"))}let pe=P%4?4-P%4:0;R._skip(pe)}if(f<=0)return r;let j=new ur(t,l,f,!0),q=j._nextUint16(),Y=j._nextUint16(),te=j._nextUint32(),ye=j._nextUint32(),ne=j._nextUint32(),me=j._nextUint32(),Ie=[];for(let P=0,U=Math.max(r.levelCount,1);P<U;P++)Ie.push({imageFlags:j._nextUint32(),rgbSliceByteOffset:j._nextUint32(),rgbSliceByteLength:j._nextUint32(),alphaSliceByteOffset:j._nextUint32(),alphaSliceByteLength:j._nextUint32()});let be=l+j._offset,Ce=be+te,xe=Ce+ye,De=xe+ne,Be=new Uint8Array(t.buffer,t.byteOffset+be,te),ta=new Uint8Array(t.buffer,t.byteOffset+Ce,ye),Tr=new Uint8Array(t.buffer,t.byteOffset+xe,ne),A=new Uint8Array(t.buffer,t.byteOffset+De,me);return r.globalData={endpointCount:q,selectorCount:Y,imageDescs:Ie,endpointsData:Be,selectorsData:ta,tablesData:Tr,extendedData:A},r}var Ut="EXT_mesh_gpu_instancing",St="EXT_mesh_features",qe="EXT_meshopt_compression",W="EXT_structural_metadata",Rs="EXT_texture_webp",Ns="EXT_texture_avif",Nm="KHR_accessor_float16",Cm="KHR_accessor_float64",we="KHR_draco_mesh_compression",Et="KHR_lights_punctual",zt="KHR_materials_anisotropy",Gt="KHR_materials_clearcoat",Kt="KHR_materials_diffuse_transmission",Vt="KHR_materials_dispersion",Ht="KHR_materials_emissive_strength",qt="KHR_materials_ior",Wt="KHR_materials_iridescence",Xt="KHR_materials_pbrSpecularGlossiness",$t="KHR_materials_sheen",Yt="KHR_materials_specular",Jt="KHR_materials_transmission",Rr="KHR_materials_unlit",Qt="KHR_materials_volume",$e="KHR_materials_variants",ed="KHR_mesh_primitive_restart",td="KHR_mesh_quantization",Zt="KHR_node_visibility",Cs="KHR_texture_basisu",er="KHR_texture_transform",lt="KHR_xmp_json_ld",Bm=class extends Q{static EXTENSION_NAME=St;init(){this.extensionName=St,this.propertyType="FeatureID",this.parentTypes=["Features"]}getDefaults(){return Object.assign(super.getDefaults(),{nullFeatureId:null,label:"",attribute:null,texture:null,propertyTable:null})}getFeatureCount(){return this.get("featureCount")}setFeatureCount(t){return this.set("featureCount",t)}getNullFeatureID(){return this.get("nullFeatureId")}setNullFeatureID(t){return this.set("nullFeatureId",t)}getLabel(){return this.get("label")}setLabel(t){return this.set("label",t)}getAttribute(){return this.get("attribute")}setAttribute(t){return this.set("attribute",t)}getTexture(){return this.getRef("texture")}setTexture(t){return this.setRef("texture",t)}getPropertyTable(){return this.getRef("propertyTable")}setPropertyTable(t){return this.setRef("propertyTable",t)}},Om=class extends Q{static EXTENSION_NAME=St;init(){this.extensionName=St,this.propertyType="FeatureIDTexture",this.parentTypes=["FeatureID"]}getDefaults(){let t=new ue(this.graph,"textureInfo");return t.setMinFilter(ue.MagFilter.NEAREST),t.setMagFilter(ue.MagFilter.NEAREST),Object.assign(super.getDefaults(),{channels:[0],texture:null,textureInfo:t})}getChannels(){return this.get("channels")}setChannels(t){return this.set("channels",t)}getTexture(){return this.getRef("texture")}setTexture(t){return this.setRef("texture",t)}getTextureInfo(){return this.getRef("texture")?this.getRef("textureInfo"):null}},Fm=class extends Q{static EXTENSION_NAME=St;init(){this.extensionName=St,this.propertyType="Features",this.parentTypes=[F.PRIMITIVE]}getDefaults(){return Object.assign(super.getDefaults(),{featureIds:new le([])})}listFeatureIDs(){return this.listRefs("featureIds")}addFeatureID(t){return this.addRef("featureIds",t)}removeFeatureID(t){return this.removeRef("featureIds",t)}},da=St,Ki=class extends oe{extensionName=St;static EXTENSION_NAME=St;createFeatures(){return new Fm(this.document.getGraph())}createFeatureID(){return new Bm(this.document.getGraph())}createFeatureIDTexture(){return new Om(this.document.getGraph())}read(t){return(t.jsonDoc.json.meshes||[]).forEach((e,r)=>{(e.primitives||[]).forEach((a,s)=>{this._readPrimitive(t,r,a,s)})}),this}_readPrimitive(t,e,r,a){if(!r.extensions||!r.extensions[da])return;let s=this.createFeatures(),n=r.extensions[da];for(let i of n.featureIds){let o=Pm(this.document,this,t,i);s.addFeatureID(o)}t.meshes[e].listPrimitives()[a].setExtension(da,s)}write(t){let e=t.jsonDoc.json.meshes;if(!e)return this;for(let r of this.document.getRoot().listMeshes()){let a=e[t.meshIndexMap.get(r)];r.listPrimitives().forEach((s,n)=>{let i=a.primitives[n];this._writePrimitive(t,s,i)})}return this}_writePrimitive(t,e,r){let a=e.getExtension(da);if(!a)return;let s={featureIds:[]};a.listFeatureIDs().forEach(n=>{s.featureIds.push(Lm(this.document,t,n))}),r.extensions=r.extensions||{},r.extensions[da]=s}};function Pm(t,e,r,a){let s=e.createFeatureID().setFeatureCount(a.featureCount);a.nullFeatureId!==void 0&&s.setNullFeatureID(a.nullFeatureId),a.label!==void 0&&s.setLabel(a.label),a.attribute!==void 0&&s.setAttribute(a.attribute);let n=a.texture;if(n!==void 0){let i=jm(e,r,n);s.setTexture(i)}if(a.propertyTable!==void 0){let i=t.getRoot().getExtension(W).listPropertyTables();s.setPropertyTable(i[a.propertyTable])}return s}function jm(t,e,r){let a=t.createFeatureIDTexture(),{json:s}=e.jsonDoc;if(r.channels&&a.setChannels(r.channels),r.index!==void 0){let n=s.textures[r.index].source;a.setTexture(e.textures[n]),e.setTextureInfo(a.getTextureInfo(),r)}return a}function Lm(t,e,r){let a=t.getRoot(),s={featureCount:r.getFeatureCount()};if(r.getNullFeatureID()!=null&&(s.nullFeatureId=r.getNullFeatureID()),r.getLabel()&&(s.label=r.getLabel()),r.getAttribute()!=null&&(s.attribute=r.getAttribute()),r.getTexture()){let n=r.getTexture(),i=n.getTexture(),o=n.getTextureInfo();s.texture=e.createTextureInfoDef(i,o);let c=n.getChannels();he.eq(c,[0])||(s.texture.channels=c)}if(r.getPropertyTable()){let n=a.getExtension(W),i=r.getPropertyTable();s.propertyTable=n.listPropertyTables().indexOf(i)}return s}var Ui="INSTANCE_ATTRIBUTE",Dm=class extends Q{static EXTENSION_NAME=Ut;init(){this.extensionName=Ut,this.propertyType="InstancedMesh",this.parentTypes=[F.NODE]}getDefaults(){return Object.assign(super.getDefaults(),{attributes:new ke})}getAttribute(t){return this.getRefMap("attributes",t)}setAttribute(t,e){return this.setRefMap("attributes",t,e,{usage:Ui})}listAttributes(){return this.listRefMapValues("attributes")}listSemantics(){return this.listRefMapKeys("attributes")}},Um=class extends oe{static EXTENSION_NAME=Ut;extensionName=Ut;prewriteTypes=[F.ACCESSOR];createInstancedMesh(){return new Dm(this.document.getGraph())}read(t){return(t.jsonDoc.json.nodes||[]).forEach((e,r)=>{if(!e.extensions||!e.extensions.EXT_mesh_gpu_instancing)return;let a=e.extensions[Ut],s=this.createInstancedMesh();for(let n in a.attributes)s.setAttribute(n,t.accessors[a.attributes[n]]);t.nodes[r].setExtension(Ut,s)}),this}prewrite(t){t.accessorUsageGroupedByParent.add(Ui);for(let e of this.properties)for(let r of e.listAttributes())t.addAccessorToUsageGroup(r,Ui);return this}write(t){let e=t.jsonDoc;return this.document.getRoot().listNodes().forEach(r=>{let a=r.getExtension(Ut);if(a){let s=t.nodeIndexMap.get(r),n=e.json.nodes[s],i={attributes:{}};a.listSemantics().forEach(o=>{let c=a.getAttribute(o);i.attributes[o]=t.accessorIndexMap.get(c)}),n.extensions=n.extensions||{},n.extensions[Ut]=i}}),this}},zm=(function(t){return t.QUANTIZE="quantize",t.FILTER="filter",t})({});function Gm(t){return!t.extensions||!t.extensions.EXT_meshopt_compression?!1:!!t.extensions[qe].fallback}var{BYTE:Km,SHORT:rd,FLOAT:Vm}=V.ComponentType,{encodeNormalizedInt:ad,decodeNormalizedInt:zi}=he;function Hm(t,e,r,a){let{filter:s,bits:n}=a,i={array:t.getArray(),byteStride:t.getElementSize()*t.getComponentSize(),componentType:t.getComponentType(),normalized:t.getNormalized()};if(r!=="ATTRIBUTES")return i;if(s!=="NONE"){let o=t.getNormalized()?qm(t):new Float32Array(i.array);switch(s){case"EXPONENTIAL":i.byteStride=t.getElementSize()*4,i.componentType=Vm,i.normalized=!1,i.array=e.encodeFilterExp(o,t.getCount(),i.byteStride,n);break;case"OCTAHEDRAL":i.byteStride=n>8?8:4,i.componentType=n>8?rd:Km,i.normalized=!0,o=t.getElementSize()===3?Xm(o):o,i.array=e.encodeFilterOct(o,t.getCount(),i.byteStride,n);break;case"QUATERNION":i.byteStride=8,i.componentType=rd,i.normalized=!0,i.array=e.encodeFilterQuat(o,t.getCount(),i.byteStride,n);break;default:throw new Error("Invalid filter.")}i.min=t.getMin([]),i.max=t.getMax([]),t.getNormalized()&&(i.min=i.min.map(c=>zi(c,t.getComponentType())),i.max=i.max.map(c=>zi(c,t.getComponentType()))),i.normalized&&(i.min=i.min.map(c=>ad(c,i.componentType)),i.max=i.max.map(c=>ad(c,i.componentType)))}else i.byteStride%4&&(i.array=Wm(i.array,t.getElementSize()),i.byteStride=i.array.byteLength/t.getCount());return i}function qm(t){let e=t.getComponentType(),r=t.getArray(),a=new Float32Array(r.length);for(let s=0;s<r.length;s++)a[s]=zi(r[s],e);return a}function Wm(t,e){let r=X.padNumber(t.BYTES_PER_ELEMENT*e)/t.BYTES_PER_ELEMENT,a=t.length/e,s=new t.constructor(a*r);for(let n=0;n*e<t.length;n++)for(let i=0;i<e;i++)s[n*r+i]=t[n*e+i];return s}function Xm(t){let e=new Float32Array(t.length*4/3);for(let r=0,a=t.length/3;r<a;r++)e[r*4]=t[r*3],e[r*4+1]=t[r*3+1],e[r*4+2]=t[r*3+2];return e}function $m(t,e){return e===jt.BufferViewUsage.ELEMENT_ARRAY_BUFFER?t.listParents().some(r=>r instanceof la&&r.getMode()===la.Mode.TRIANGLES)?"TRIANGLES":"INDICES":"ATTRIBUTES"}function Ym(t,e){let r=e.getGraph().listParentEdges(t).filter(a=>!(a.getParent()instanceof ji));for(let a of r){let s=a.getName(),n=a.getAttributes().key||"",i=a.getParent().propertyType===F.PRIMITIVE_TARGET;if(s==="indices")return{filter:"NONE"};if(s==="attributes"){if(n==="POSITION")return{filter:"NONE"};if(n==="TEXCOORD_0")return{filter:"NONE"};if(n.startsWith("JOINTS_"))return{filter:"NONE"};if(n.startsWith("WEIGHTS_"))return{filter:"NONE"};if(n==="NORMAL"||n==="TANGENT")return i?{filter:"NONE"}:{filter:"OCTAHEDRAL",bits:8}}if(s==="output"){let o=wd(t);return o==="rotation"?{filter:"QUATERNION",bits:16}:o==="translation"?{filter:"EXPONENTIAL",bits:12}:o==="scale"?{filter:"EXPONENTIAL",bits:12}:{filter:"NONE"}}if(s==="input")return{filter:"NONE"};if(s==="inverseBindMatrices")return{filter:"NONE"}}return{filter:"NONE"}}function wd(t){for(let e of t.listParents())if(e instanceof As){for(let r of e.listParents())if(r instanceof Pi)return r.getTargetPath()}return null}var sd={method:"quantize"},Vi=class extends oe{extensionName=qe;prereadTypes=[F.BUFFER,F.PRIMITIVE];prewriteTypes=[F.BUFFER,F.ACCESSOR];readDependencies=["meshopt.decoder"];writeDependencies=["meshopt.encoder"];static EXTENSION_NAME=qe;static EncoderMethod=zm;_decoder=null;_decoderFallbackBufferMap=new Map;_encoder=null;_encoderOptions=sd;_encoderFallbackBuffer=null;_encoderBufferViews={};_encoderBufferViewData={};_encoderBufferViewAccessors={};install(t,e){return t==="meshopt.decoder"&&(this._decoder=e),t==="meshopt.encoder"&&(this._encoder=e),this}setEncoderOptions(t){return this._encoderOptions={...sd,...t},this}preread(t,e){if(!this._decoder){if(!this.isRequired())return this;throw new Error(`[${qe}] Please install extension dependency, "meshopt.decoder".`)}if(!this._decoder.supported){if(!this.isRequired())return this;throw new Error(`[${qe}]: Missing WASM support.`)}return e===F.BUFFER?this._prereadBuffers(t):e===F.PRIMITIVE&&this._prereadPrimitives(t),this}_prereadBuffers(t){let e=t.jsonDoc;(e.json.bufferViews||[]).forEach((r,a)=>{if(!r.extensions||!r.extensions.EXT_meshopt_compression)return;let s=r.extensions[qe],n=s.byteOffset||0,i=s.byteLength||0,o=s.count,c=s.byteStride,l=new Uint8Array(o*c),f=e.json.buffers[s.buffer],d=f.uri?e.resources[f.uri]:e.resources[Lt],p=X.toView(d,n,i);this._decoder.decodeGltfBuffer(l,o,c,p,s.mode,s.filter),t.bufferViews[a]=l})}_prereadPrimitives(t){let e=t.jsonDoc;(e.json.bufferViews||[]).forEach(r=>{if(!r.extensions||!r.extensions.EXT_meshopt_compression)return;let a=r.extensions[qe],s=t.buffers[a.buffer],n=t.buffers[r.buffer],i=e.json.buffers[r.buffer];Gm(i)&&this._decoderFallbackBufferMap.set(n,s)})}read(t){if(!this.isRequired())return this;for(let[e,r]of this._decoderFallbackBufferMap){for(let a of e.listParents())a instanceof V&&a.swap(e,r);e.dispose()}return this}prewrite(t,e){return e===F.ACCESSOR?this._prewriteAccessors(t):e===F.BUFFER&&this._prewriteBuffers(t),this}_prewriteAccessors(t){let e=t.jsonDoc.json,r=this._encoder,a=this._encoderOptions,s=this.document.getGraph(),n=this.document.createBuffer(),i=this.document.getRoot().listBuffers().indexOf(n),o=1,c=new Map,l=f=>{for(let d of s.listParents(f)){if(d.propertyType===F.ROOT)continue;let p=c.get(f);return p===void 0&&c.set(f,p=o++),p}return-1};this._encoderFallbackBuffer=n,this._encoderBufferViews={},this._encoderBufferViewData={},this._encoderBufferViewAccessors={};for(let f of this.document.getRoot().listAccessors()){if(wd(f)==="weights"||f.getSparse())continue;let d=t.getAccessorUsage(f),p=t.accessorUsageGroupedByParent.has(d)?l(f):null,b=$m(f,d),h=a.method==="filter"?Ym(f,this.document):{filter:"NONE"},u=Hm(f,r,b,h),{array:m,byteStride:g}=u,y=f.getBuffer();if(!y)throw new Error(`${qe}: Missing buffer for accessor.`);let x=this.document.getRoot().listBuffers().indexOf(y),v=[d,p,b,h.filter,g,x].join(":"),E=this._encoderBufferViews[v],S=this._encoderBufferViewData[v],T=this._encoderBufferViewAccessors[v];(!E||!S)&&(T=this._encoderBufferViewAccessors[v]=[],S=this._encoderBufferViewData[v]=[],E=this._encoderBufferViews[v]={buffer:i,target:jt.USAGE_TO_TARGET[d],byteOffset:0,byteLength:0,byteStride:d===jt.BufferViewUsage.ARRAY_BUFFER?g:void 0,extensions:{[qe]:{buffer:x,byteOffset:0,byteLength:0,mode:b,filter:h.filter!=="NONE"?h.filter:void 0,byteStride:g,count:0}}});let _=t.createAccessorDef(f);_.componentType=u.componentType,_.normalized=u.normalized,_.byteOffset=E.byteLength,_.min&&u.min&&(_.min=u.min),_.max&&u.max&&(_.max=u.max),t.accessorIndexMap.set(f,e.accessors.length),e.accessors.push(_),T.push(_),S.push(new Uint8Array(m.buffer,m.byteOffset,m.byteLength)),E.byteLength+=m.byteLength,E.extensions.EXT_meshopt_compression.count+=f.getCount()}}_prewriteBuffers(t){let e=this._encoder;for(let r in this._encoderBufferViews){let a=this._encoderBufferViews[r],s=this._encoderBufferViewData[r],n=this.document.getRoot().listBuffers()[a.extensions[qe].buffer],i=t.otherBufferViews.get(n)||[],{count:o,byteStride:c,mode:l}=a.extensions[qe],f=X.concat(s),d=e.encodeGltfBuffer(f,o,c,l),p=X.pad(d);a.extensions[qe].byteLength=d.byteLength,s.length=0,s.push(p),i.push(p),t.otherBufferViews.set(n,i)}}write(t){let e=0;for(let n in this._encoderBufferViews){let i=this._encoderBufferViews[n],o=this._encoderBufferViewData[n][0],c=t.otherBufferViewsIndexMap.get(o),l=this._encoderBufferViewAccessors[n];for(let b of l)b.bufferView=c;let f=t.jsonDoc.json.bufferViews[c],d=f.byteOffset||0;Object.assign(f,i),f.byteOffset=e;let p=f.extensions[qe];p.byteOffset=d,e+=X.padNumber(i.byteLength)}let r=this._encoderFallbackBuffer,a=t.bufferIndexMap.get(r),s=t.jsonDoc.json.buffers[a];return s.byteLength=e,s.extensions={[qe]:{fallback:!0}},r.dispose(),this}},Jm=class extends Q{static EXTENSION_NAME=W;init(){this.extensionName=W,this.propertyType="StructuralMetadata",this.parentTypes=[F.ROOT]}getDefaults(){return Object.assign(super.getDefaults(),{schema:null,schemaUri:"",propertyTables:new Fe,propertyTextures:new Fe,propertyAttributes:new Fe})}getSchema(){return this.getRef("schema")}setSchema(t){return this.setRef("schema",t)}getSchemaUri(){return this.get("schemaUri")}setSchemaUri(t){return this.set("schemaUri",t)}listPropertyTables(){return this.listRefs("propertyTables")}addPropertyTable(t){return this.addRef("propertyTables",t)}removePropertyTable(t){return this.removeRef("propertyTables",t)}listPropertyTextures(){return this.listRefs("propertyTextures")}addPropertyTexture(t){return this.addRef("propertyTextures",t)}removePropertyTexture(t){return this.removeRef("propertyTextures",t)}listPropertyAttributes(){return this.listRefs("propertyAttributes")}addPropertyAttribute(t){return this.addRef("propertyAttributes",t)}removePropertyAttribute(t){return this.removeRef("propertyAttributes",t)}},Qm=class extends Q{static EXTENSION_NAME=W;init(){this.extensionName=W,this.propertyType="Schema",this.parentTypes=["StructuralMetadata"]}getDefaults(){return Object.assign(super.getDefaults(),{description:"",version:"",classes:new ke,enums:new ke})}getId(){return this.get("id")}setId(t){return this.set("id",t)}getDescription(){return this.get("description")}setDescription(t){return this.set("description",t)}getVersion(){return this.get("version")}setVersion(t){return this.set("version",t)}setClass(t,e){return this.setRefMap("classes",t,e)}getClass(t){return this.getRefMap("classes",t)}listClassKeys(){return this.listRefMapKeys("classes")}listClassValues(){return this.listRefMapValues("classes")}setEnum(t,e){return this.setRefMap("enums",t,e)}getEnum(t){return this.getRefMap("enums",t)}listEnumKeys(){return this.listRefMapKeys("enums")}listEnumValues(){return this.listRefMapValues("enums")}},Zm=class extends Q{static EXTENSION_NAME=W;init(){this.extensionName=W,this.propertyType="Class",this.parentTypes=["Schema"]}getDefaults(){return Object.assign(super.getDefaults(),{description:"",properties:new ke})}getDescription(){return this.get("description")}setDescription(t){return this.set("description",t)}setProperty(t,e){return this.setRefMap("properties",t,e)}getProperty(t){return this.getRefMap("properties",t)}listPropertyKeys(){return this.listRefMapKeys("properties")}listPropertyValues(){return this.listRefMapValues("properties")}},ey=class extends Q{static EXTENSION_NAME=W;init(){this.extensionName=W,this.propertyType="ClassProperty",this.parentTypes=["Class"]}getDefaults(){return Object.assign(super.getDefaults(),{description:"",componentType:null,enumType:null,array:null,count:null,normalized:null,offset:null,scale:null,max:null,min:null,required:null,noData:null,default:null})}getDescription(){return this.get("description")}setDescription(t){return this.set("description",t)}getType(){return this.get("type")}setType(t){return this.set("type",t)}getComponentType(){return this.get("componentType")}setComponentType(t){return this.set("componentType",t)}getEnumType(){return this.get("enumType")}setEnumType(t){return this.set("enumType",t)}getArray(){return this.get("array")}setArray(t){return this.set("array",t)}getCount(){return this.get("count")}setCount(t){return this.set("count",t)}getNormalized(){return this.get("normalized")}setNormalized(t){return this.set("normalized",t)}getOffset(){return this.get("offset")}setOffset(t){return this.set("offset",t)}getScale(){return this.get("scale")}setScale(t){return this.set("scale",t)}getMax(){return this.get("max")}setMax(t){return this.set("max",t)}getMin(){return this.get("min")}setMin(t){return this.set("min",t)}getRequired(){return this.get("required")}setRequired(t){return this.set("required",t)}getNoData(){return this.get("noData")}setNoData(t){return this.set("noData",t)}getDefault(){return this.get("default")}setDefault(t){return this.set("default",t)}},ty=class extends Q{static EXTENSION_NAME=W;init(){this.extensionName=W,this.propertyType="Enum",this.parentTypes=["Schema"]}getDefaults(){return Object.assign(super.getDefaults(),{description:"",valueType:"UINT16",values:new Fe})}getDescription(){return this.get("description")}setDescription(t){return this.set("description",t)}getValueType(){return this.get("valueType")}setValueType(t){return this.set("valueType",t)}listValues(){return this.listRefs("values")}addEnumValue(t){return this.addRef("values",t)}removeEnumValue(t){return this.removeRef("values",t)}},ry=class extends Q{static EXTENSION_NAME=W;init(){this.extensionName=W,this.propertyType="EnumValue",this.parentTypes=["Enum"]}getDefaults(){return Object.assign(super.getDefaults(),{description:null})}getDescription(){return this.get("description")}setDescription(t){return this.set("description",t)}getValue(){return this.get("value")}setValue(t){return this.set("value",t)}},ay=class extends Q{static EXTENSION_NAME=W;init(){this.extensionName=W,this.propertyType="PropertyTable",this.parentTypes=["StructuralMetadata"]}getDefaults(){return Object.assign(super.getDefaults(),{properties:new ke})}getClass(){return this.get("class")}setClass(t){return this.set("class",t)}getCount(){return this.get("count")}setCount(t){return this.set("count",t)}setProperty(t,e){return this.setRefMap("properties",t,e)}getProperty(t){return this.getRefMap("properties",t)}listPropertyKeys(){return this.listRefMapKeys("properties")}listPropertyValues(){return this.listRefMapValues("properties")}},sy=class extends Q{static EXTENSION_NAME=W;init(){this.extensionName=W,this.propertyType="PropertyTableProperty",this.parentTypes=["PropertyTable"]}getDefaults(){return Object.assign(super.getDefaults(),{arrayOffsets:null,stringOffsets:null,arrayOffsetType:null,stringOffsetType:null,offset:null,scale:null,max:null,min:null})}getValues(){return this.get("values")}setValues(t){return this.set("values",t)}getArrayOffsets(){return this.get("arrayOffsets")}setArrayOffsets(t){return this.set("arrayOffsets",t)}getStringOffsets(){return this.get("stringOffsets")}setStringOffsets(t){return this.set("stringOffsets",t)}getArrayOffsetType(){return this.get("arrayOffsetType")}setArrayOffsetType(t){return this.set("arrayOffsetType",t)}getStringOffsetType(){return this.get("stringOffsetType")}setStringOffsetType(t){return this.set("stringOffsetType",t)}getOffset(){return this.get("offset")}setOffset(t){return this.set("offset",t)}getScale(){return this.get("scale")}setScale(t){return this.set("scale",t)}getMax(){return this.get("max")}setMax(t){return this.set("max",t)}getMin(){return this.get("min")}setMin(t){return this.set("min",t)}},ny=class extends Q{static EXTENSION_NAME=W;init(){this.extensionName=W,this.propertyType="PropertyTexture",this.parentTypes=["StructuralMetadata"]}getDefaults(){return Object.assign(super.getDefaults(),{properties:new ke})}getClass(){return this.get("class")}setClass(t){return this.set("class",t)}setProperty(t,e){return this.setRefMap("properties",t,e)}getProperty(t){return this.getRefMap("properties",t)}listPropertyKeys(){return this.listRefMapKeys("properties")}listPropertyValues(){return this.listRefMapValues("properties")}},iy=class extends Q{static EXTENSION_NAME=W;init(){this.extensionName=W,this.propertyType="PropertyTextureProperty",this.parentTypes=["PropertyTexture"]}getDefaults(){let t=new ue(this.graph,"textureInfo");return t.setMinFilter(ue.MagFilter.NEAREST),t.setMagFilter(ue.MagFilter.NEAREST),Object.assign(super.getDefaults(),{channels:[0],texture:null,textureInfo:t,offset:null,scale:null,max:null,min:null})}getChannels(){return this.get("channels")}setChannels(t){return this.set("channels",t)}getTexture(){return this.getRef("texture")}setTexture(t){return this.setRef("texture",t)}getTextureInfo(){return this.getRef("texture")?this.getRef("textureInfo"):null}getOffset(){return this.get("offset")}setOffset(t){return this.set("offset",t)}getScale(){return this.get("scale")}setScale(t){return this.set("scale",t)}getMax(){return this.get("max")}setMax(t){return this.set("max",t)}getMin(){return this.get("min")}setMin(t){return this.set("min",t)}},oy=class extends Q{static EXTENSION_NAME=W;init(){this.extensionName=W,this.propertyType="PropertyAttribute",this.parentTypes=["StructuralMetadata"]}getDefaults(){return Object.assign(super.getDefaults(),{properties:new ke})}getClass(){return this.get("class")}setClass(t){return this.set("class",t)}setProperty(t,e){return this.setRefMap("properties",t,e)}getProperty(t){return this.getRefMap("properties",t)}listPropertyKeys(){return this.listRefMapKeys("properties")}listPropertyValues(){return this.listRefMapValues("properties")}},cy=class extends Q{static EXTENSION_NAME=W;init(){this.extensionName=W,this.propertyType="PropertyAttributeProperty",this.parentTypes=["PropertyAttribute"]}getDefaults(){return Object.assign(super.getDefaults(),{offset:null,scale:null,max:null,min:null})}getAttribute(){return this.get("attribute")}setAttribute(t){return this.set("attribute",t)}getOffset(){return this.get("offset")}setOffset(t){return this.set("offset",t)}getScale(){return this.get("scale")}setScale(t){return this.set("scale",t)}getMax(){return this.get("max")}setMax(t){return this.set("max",t)}getMin(){return this.get("min")}setMin(t){return this.set("min",t)}},ly=class extends Q{static EXTENSION_NAME=W;init(){this.extensionName=W,this.propertyType="NodeStructuralMetadata",this.parentTypes=[F.NODE]}getDefaults(){return Object.assign(super.getDefaults(),{class:"",properties:{}})}getClass(){return this.get("class")}setClass(t){return this.set("class",t)}getProperties(){return this.get("properties")}setProperties(t){return this.set("properties",t)}},dy=class extends Q{static EXTENSION_NAME=W;init(){this.extensionName=W,this.propertyType="MeshPrimitiveStructuralMetadata",this.parentTypes=[F.PRIMITIVE]}getDefaults(){return Object.assign(super.getDefaults(),{propertyTextures:new Fe,propertyAttributes:new Fe})}listPropertyTextures(){return this.listRefs("propertyTextures")}addPropertyTexture(t){return this.addRef("propertyTextures",t)}removePropertyTexture(t){return this.removeRef("propertyTextures",t)}listPropertyAttributes(){return this.listRefs("propertyAttributes")}addPropertyAttribute(t){return this.addRef("propertyAttributes",t)}removePropertyAttribute(t){return this.removeRef("propertyAttributes",t)}},uy=class extends oe{extensionName=W;static EXTENSION_NAME=W;prewriteTypes=[F.BUFFER];prereadTypes=[F.SCENE];createStructuralMetadata(){return new Jm(this.document.getGraph())}createSchema(){return new Qm(this.document.getGraph())}createClass(){return new Zm(this.document.getGraph())}createClassProperty(){return new ey(this.document.getGraph())}createEnum(){return new ty(this.document.getGraph())}createEnumValue(){return new ry(this.document.getGraph())}createPropertyTable(){return new ay(this.document.getGraph())}createPropertyTableProperty(){return new sy(this.document.getGraph())}createPropertyTexture(){return new ny(this.document.getGraph())}createPropertyTextureProperty(){return new iy(this.document.getGraph())}createPropertyAttribute(){return new oy(this.document.getGraph())}createPropertyAttributeProperty(){return new cy(this.document.getGraph())}createNodeStructuralMetadata(){return new ly(this.document.getGraph())}createMeshPrimitiveStructuralMetadata(){return new dy(this.document.getGraph())}read(t){return this}preread(t){let e=this.document.getRoot(),{json:r}=t.jsonDoc,a=r.extensions[W],s=fy(this,t,a);return e.setExtension(W,s),(r.meshes||[]).forEach((n,i)=>{let o=t.meshes[i].listPrimitives();(n.primitives||[]).forEach((c,l)=>{let f=o[l];this._readPrimitive(s,f,c)})}),(r.nodes||[]).forEach((n,i)=>{this._readNode(t.nodes[i],n)}),this}_readPrimitive(t,e,r){if(!r.extensions||!r.extensions.EXT_structural_metadata)return;let a=this.createMeshPrimitiveStructuralMetadata(),s=r.extensions[W],n=t.listPropertyTextures(),i=s.propertyTextures||[];for(let l of i){let f=n[l];a.addPropertyTexture(f)}let o=t.listPropertyAttributes(),c=s.propertyAttributes||[];for(let l of c){let f=o[l];a.addPropertyAttribute(f)}e.setExtension(W,a)}_readNode(t,e){if(!e.extensions||!e.extensions.EXT_structural_metadata)return;let r=e.extensions[W],a=this.createNodeStructuralMetadata().setClass(r.class).setProperties(r.properties);t.setExtension(W,a)}write(t){let e=this.document.getRoot(),r=e.getExtension(W);if(!r)return this;let a=t.jsonDoc.json,s=Ey(t,r);a.extensions=a.extensions||{},a.extensions[W]=s;let n=e.listMeshes(),i=a.meshes;if(i)for(let l of n){let f=i[t.meshIndexMap.get(l)];l.listPrimitives().forEach((d,p)=>{let b=f.primitives[p];this._writePrimitive(r,d,b)})}let o=e.listNodes(),c=a.nodes;if(c)for(let l of o){let f=t.nodeIndexMap.get(l);this._writeNode(l,c[f])}return this}_writePrimitive(t,e,r){let a=e.getExtension(W);if(!a)return;let s=t.listPropertyTextures(),n=t.listPropertyAttributes(),i,o,c=a.listPropertyTextures();if(c.length>0){i=[];for(let d of c){let p=s.indexOf(d);if(p>=0)i.push(p);else throw new Error(`${W}: Invalid property texture in mesh primitive`)}}let l=a.listPropertyAttributes();if(l.length>0){o=[];for(let d of l){let p=n.indexOf(d);if(p>=0)o.push(p);else throw new Error(`${W}: Invalid property attribute in mesh primitive`)}}let f={propertyTextures:i,propertyAttributes:o};r.extensions=r.extensions||{},r.extensions[W]=f}_writeNode(t,e){let r=t.getExtension("EXT_structural_metadata");r&&(e.extensions=e.extensions||{},e.extensions[W]={class:r.getClass(),properties:r.getProperties()})}prewrite(t,e){return e===F.BUFFER&&this._prewriteBuffers(t),this}_prewriteBuffers(t){let e=this.document,r=e.getRoot().getExtension(W);t.jsonDoc.json.bufferViews||=[];for(let a of r.listPropertyTables())for(let s of a.listPropertyValues()){let n=Py(e,t);n.push(s.getValues());let i=s.getArrayOffsets();i&&n.push(i);let o=s.getStringOffsets();o&&n.push(o)}}};function fy(t,e,r){let a=t.createStructuralMetadata();if(r.schema!==void 0){let o=hy(t,r.schema);a.setSchema(o)}else if(r.schemaUri){let o=r.schemaUri;a.setSchemaUri(o)}let s=r.propertyTextures||[];for(let o of s){let c=yy(t,e,o);a.addPropertyTexture(c)}let n=r.propertyTables||[];for(let o of n){let c=wy(t,e,o);a.addPropertyTable(c)}let i=r.propertyAttributes||[];for(let o of i){let c=My(t,o);a.addPropertyAttribute(c)}return a}function hy(t,e){let r=t.createSchema().setId(e.id);e.name!==void 0&&r.setName(e.name),e.description!==void 0&&r.setDescription(e.description),e.version!==void 0&&r.setVersion(e.version);let a=e.classes||{};for(let n of Object.keys(a)){let i=a[n];r.setClass(n,by(t,i))}let s=e.enums||{};for(let n of Object.keys(s))r.setEnum(n,gy(t,s[n]));return r}function by(t,e){let r=t.createClass();e.name!==void 0&&r.setName(e.name),e.description!==void 0&&r.setDescription(e.description);let a=e.properties||{};for(let s of Object.keys(a)){let n=py(t,a[s]);r.setProperty(s,n)}return r}function py(t,e){let r=t.createClassProperty().setType(e.type);return e.name!==void 0&&r.setName(e.name),e.description!==void 0&&r.setDescription(e.description),e.componentType!==void 0&&r.setComponentType(e.componentType),e.enumType!==void 0&&r.setEnumType(e.enumType),e.array!==void 0&&r.setArray(e.array),e.count!==void 0&&r.setCount(e.count),e.normalized!==void 0&&r.setNormalized(e.normalized),e.offset!==void 0&&r.setOffset(e.offset),e.scale!==void 0&&r.setScale(e.scale),e.max!==void 0&&r.setMax(e.max),e.min!==void 0&&r.setMin(e.min),e.required!==void 0&&r.setRequired(e.required),e.noData!==void 0&&r.setNoData(e.noData),e.default!==void 0&&r.setDefault(e.default),r}function gy(t,e){let r=t.createEnum();e.name!==void 0&&r.setName(e.name),e.description!==void 0&&r.setDescription(e.description),e.valueType!==void 0&&r.setValueType(e.valueType);let a=e.values||{};for(let s of a)r.addEnumValue(my(t,s));return r}function my(t,e){let r=t.createEnumValue();return e.name!==void 0&&r.setName(e.name),e.description!==void 0&&r.setDescription(e.description),e.value!==void 0&&r.setValue(e.value),r}function yy(t,e,r){let a=t.createPropertyTexture();a.setClass(r.class),r.name!==void 0&&a.setName(r.name);let s=r.properties||{};for(let n of Object.keys(s)){let i=xy(t,e,s[n]);a.setProperty(n,i)}return a}function xy(t,e,r){let a=t.createPropertyTextureProperty(),s=e.jsonDoc.json.textures||[];r.channels&&a.setChannels(r.channels);let n=s[r.index].source;if(n!==void 0){let i=e.textures[n];a.setTexture(i);let o=a.getTextureInfo();o&&e.setTextureInfo(o,r)}return r.offset!==void 0&&a.setOffset(r.offset),r.scale!==void 0&&a.setScale(r.scale),r.max!==void 0&&a.setMax(r.max),r.min!==void 0&&a.setMin(r.min),a}function wy(t,e,r){let a=t.createPropertyTable().setClass(r.class).setCount(r.count);r.name!==void 0&&a.setName(r.name);let s=r.properties||{};for(let n of Object.keys(s)){let i=vy(t,e,s[n]);a.setProperty(n,i)}return a}function vy(t,e,r){let a=t.createPropertyTableProperty(),s=Li(e,r.values);if(a.setValues(s),r.arrayOffsets!==void 0){let n=Li(e,r.arrayOffsets);a.setArrayOffsets(n)}if(r.stringOffsets!==void 0){let n=Li(e,r.stringOffsets);a.setStringOffsets(n)}return r.arrayOffsetType!==void 0&&a.setArrayOffsetType(r.arrayOffsetType),r.stringOffsetType!==void 0&&a.setStringOffsetType(r.stringOffsetType),r.offset!==void 0&&a.setOffset(r.offset),r.scale!==void 0&&a.setScale(r.scale),r.max!==void 0&&a.setMax(r.max),r.min!==void 0&&a.setMin(r.min),a}function My(t,e){let r=t.createPropertyAttribute();r.setClass(e.class),e.name!==void 0&&r.setName(e.name);let a=e.properties||{};for(let s of Object.keys(a)){let n=ky(t,a[s]);r.setProperty(s,n)}return r}function ky(t,e){let r=t.createPropertyAttributeProperty();return r.setAttribute(e.attribute),e.offset!==void 0&&r.setOffset(e.offset),e.scale!==void 0&&r.setScale(e.scale),e.max!==void 0&&r.setMax(e.max),e.min!==void 0&&r.setMin(e.min),r}function Ey(t,e){let r={},a=e.getSchema();a&&(r.schema=Sy(a));let s=e.getSchemaUri();s&&(r.schemaUri=s);let n=e.listPropertyTables();if(n.length>0){let c=[];for(let l of n){let f=Ry(t,l);c.push(f)}r.propertyTables=c}let i=e.listPropertyTextures();if(i.length>0){let c=[];for(let l of i){let f=Oy(t,l);c.push(f)}r.propertyTextures=c}let o=e.listPropertyAttributes();if(o.length>0){let c=[];for(let l of o){let f=Cy(l);c.push(f)}r.propertyAttributes=c}return r}function Sy(t){let e={id:t.getId()},r=t.listClassKeys();if(r.length>0){e.classes={};for(let s of r){let n=Ty(t.getClass(s));e.classes[s]=n}}let a=t.listEnumKeys();if(a.length>0){e.enums={};for(let s of a){let n=_y(t.getEnum(s));e.enums[s]=n}}return t.getName()&&(e.name=t.getName()),t.getDescription()&&(e.description=t.getDescription()),t.getVersion()&&(e.version=t.getVersion()),e}function Ty(t){let e={},r=t.listPropertyKeys();if(r.length>0){e.properties={};for(let a of r){let s=t.getProperty(a);e.properties[a]=Ay(s)}}return t.getName()&&(e.name=t.getName()),t.getDescription()&&(e.description=t.getDescription()),e}function Ay(t){let e={type:t.getType()};return t.getArray()&&(e.array=t.getArray()),t.getNormalized()&&(e.normalized=t.getNormalized()),t.getRequired()&&(e.required=t.getRequired()),t.getName()&&(e.name=t.getName()),t.getDescription()&&(e.description=t.getDescription()),t.getComponentType()!=null&&(e.componentType=t.getComponentType()),t.getEnumType()!=null&&(e.enumType=t.getEnumType()),t.getCount()!=null&&(e.count=t.getCount()),t.getOffset()!=null&&(e.offset=t.getOffset()),t.getScale()!=null&&(e.scale=t.getScale()),t.getMax()!=null&&(e.max=t.getMax()),t.getMin()!=null&&(e.min=t.getMin()),t.getNoData()!=null&&(e.noData=t.getNoData()),t.getDefault()!=null&&(e.default=t.getDefault()),e}function _y(t){let e={values:t.listValues().map(Iy)};return t.getName()&&(e.name=t.getName()),t.getDescription()&&(e.description=t.getDescription()),t.getValueType()!=="UINT16"&&(e.valueType=t.getValueType()),e}function Iy(t){let e={name:t.getName(),value:t.getValue()};return t.getDescription()&&(e.description=t.getDescription()),e}function Ry(t,e){let r={class:e.getClass(),count:e.getCount()};e.getName()&&(r.name=e.getName());let a=e.listPropertyKeys();if(a.length>0){r.properties={};for(let s of a){let n=Ny(t,e.getProperty(s));r.properties[s]=n}}return r}function Ny(t,e){let r=e.getValues(),a={values:t.otherBufferViewsIndexMap.get(r)};if(e.getArrayOffsets()){let s=e.getArrayOffsets();a.arrayOffsets=t.otherBufferViewsIndexMap.get(s)}if(e.getStringOffsets()){let s=e.getStringOffsets();a.stringOffsets=t.otherBufferViewsIndexMap.get(s)}return e.getArrayOffsetType()!=null&&(a.arrayOffsetType=e.getArrayOffsetType()),e.getStringOffsetType()!=null&&(a.stringOffsetType=e.getStringOffsetType()),e.getOffset()!=null&&(a.offset=e.getOffset()),e.getScale()!=null&&(a.scale=e.getScale()),e.getMax()!=null&&(a.max=e.getMax()),e.getMin()!=null&&(a.min=e.getMin()),a}function Cy(t){let e={class:t.getClass()};t.getName()&&(e.name=t.getName());let r=t.listPropertyKeys();if(r.length>0){e.properties={};for(let a of r){let s=By(t.getProperty(a));e.properties[a]=s}}return e}function By(t){let e={attribute:t.getAttribute()};return t.getOffset()!=null&&(e.offset=t.getOffset()),t.getScale()!=null&&(e.scale=t.getScale()),t.getMax()!=null&&(e.max=t.getMax()),t.getMin()!=null&&(e.min=t.getMin()),e}function Oy(t,e){let r={class:e.getClass()};e.getName()&&(r.name=e.getName());let a=e.listPropertyKeys();if(a.length>0){r.properties={};for(let s of a){let n=Fy(t,e.getProperty(s));r.properties[s]=n}}return r}function Fy(t,e){let r=e.getTexture(),a=e.getTextureInfo(),s=e.getChannels(),n=t.createTextureInfoDef(r,a);return he.eq(s,[0])||(n.channels=s),e.getOffset()!=null&&(n.offset=e.getOffset()),e.getScale()!=null&&(n.scale=e.getScale()),e.getMax()!=null&&(n.max=e.getMax()),e.getMin()!=null&&(n.min=e.getMin()),n}function Li(t,e){let r=t.jsonDoc,a=r.json.buffers||[],s=(r.json.bufferViews||[])[e],n=a[s.buffer],i=n.uri?r.resources[n.uri]:r.resources[Lt],o=s.byteOffset||0,c=s.byteLength;return i.slice(o,o+c)}function Py(t,e){let r=t.getRoot().listBuffers()[0],a=e.otherBufferViews.get(r);return a||(a=[],e.otherBufferViews.set(r,a)),a}var jy=class{match(t){return t.length>=12&&X.decodeText(t.slice(4,12))==="ftypavif"}getSize(t){if(!this.match(t))return null;let e=new DataView(t.buffer,t.byteOffset,t.byteLength),r=nd(e,0);if(!r)return null;let a=r.end;for(;r=nd(e,a);)if(r.type==="meta")a=r.start+4;else if(r.type==="iprp"||r.type==="ipco")a=r.start;else{if(r.type==="ispe")return[e.getUint32(r.start+4),e.getUint32(r.start+8)];if(r.type==="mdat")break;a=r.end}return null}getChannels(t){return 4}},Ly=class extends oe{extensionName=Ns;prereadTypes=[F.TEXTURE];static EXTENSION_NAME=Ns;static register(){bt.registerFormat("image/avif",new jy)}preread(t){return(t.jsonDoc.json.textures||[]).forEach(e=>{e.extensions&&e.extensions.EXT_texture_avif&&(e.source=e.extensions[Ns].source)}),this}read(t){return this}write(t){let e=t.jsonDoc;return this.document.getRoot().listTextures().forEach(r=>{if(r.getMimeType()==="image/avif"){let a=t.imageIndexMap.get(r);(e.json.textures||[]).forEach(s=>{s.source===a&&(s.extensions=s.extensions||{},s.extensions[Ns]={source:s.source},delete s.source)})}}),this}};function nd(t,e){if(t.byteLength<4+e)return null;let r=t.getUint32(e);return t.byteLength<r+e||r<8?null:{type:X.decodeText(new Uint8Array(t.buffer,t.byteOffset+e+4,4)),start:e+8,end:e+r}}var Dy=class{match(t){return t.length>=12&&t[8]===87&&t[9]===69&&t[10]===66&&t[11]===80}getSize(t){let e=X.decodeText(t.slice(0,4)),r=X.decodeText(t.slice(8,12));if(e!=="RIFF"||r!=="WEBP")return null;let a=new DataView(t.buffer,t.byteOffset),s=12;for(;s<a.byteLength;){let n=X.decodeText(new Uint8Array([a.getUint8(s),a.getUint8(s+1),a.getUint8(s+2),a.getUint8(s+3)])),i=a.getUint32(s+4,!0);if(n==="VP8 ")return[a.getInt16(s+14,!0)&16383,a.getInt16(s+16,!0)&16383];if(n==="VP8L"){let o=a.getUint8(s+9),c=a.getUint8(s+10),l=a.getUint8(s+11),f=a.getUint8(s+12);return[1+((c&63)<<8|o),1+((f&15)<<10|l<<2|(c&192)>>6)]}s+=8+i+i%2}return null}getChannels(t){return 4}},Uy=class extends oe{extensionName=Rs;prereadTypes=[F.TEXTURE];static EXTENSION_NAME=Rs;static register(){bt.registerFormat("image/webp",new Dy)}preread(t){return(t.jsonDoc.json.textures||[]).forEach(e=>{e.extensions&&e.extensions.EXT_texture_webp&&(e.source=e.extensions[Rs].source)}),this}read(t){return this}write(t){let e=t.jsonDoc;return this.document.getRoot().listTextures().forEach(r=>{if(r.getMimeType()==="image/webp"){let a=t.imageIndexMap.get(r);(e.json.textures||[]).forEach(s=>{s.source===a&&(s.extensions=s.extensions||{},s.extensions[Rs]={source:s.source},delete s.source)})}}),this}},id=Nm,zy=class extends oe{extensionName=id;static EXTENSION_NAME=id;read(t){return this}write(t){return this}},od=Cm,Gy=class extends oe{extensionName=od;static EXTENSION_NAME=od;read(t){return this}write(t){return this}},Se,vd,Md;function Ky(t,e){let r=new Se.DecoderBuffer;try{if(r.Init(e,e.length),t.GetEncodedGeometryType(r)!==Se.TRIANGULAR_MESH)throw new Error(`[${we}] Unknown geometry type.`);let a=new Se.Mesh;if(!t.DecodeBufferToMesh(r,a).ok()||a.ptr===0)throw new Error(`[${we}] Decoding failure.`);return a}finally{Se.destroy(r)}}function Vy(t,e){let r=e.num_faces()*3,a,s;if(e.num_points()<=65534){let n=r*Uint16Array.BYTES_PER_ELEMENT;a=Se._malloc(n),t.GetTrianglesUInt16Array(e,n,a),s=new Uint16Array(Se.HEAPU16.buffer,a,r).slice()}else{let n=r*Uint32Array.BYTES_PER_ELEMENT;a=Se._malloc(n),t.GetTrianglesUInt32Array(e,n,a),s=new Uint32Array(Se.HEAPU32.buffer,a,r).slice()}return Se._free(a),s}function Hy(t,e,r,a){let s=Md[a.componentType],n=vd[a.componentType],i=r.num_components(),o=e.num_points()*i,c=o*n.BYTES_PER_ELEMENT,l=Se._malloc(c);t.GetAttributeDataArrayForAllPoints(e,r,s,c,l);let f=new n(Se.HEAPF32.buffer,l,o).slice();return Se._free(l),f}function qy(t){Se=t,vd={[V.ComponentType.FLOAT]:Float32Array,[V.ComponentType.UNSIGNED_INT]:Uint32Array,[V.ComponentType.UNSIGNED_SHORT]:Uint16Array,[V.ComponentType.UNSIGNED_BYTE]:Uint8Array,[V.ComponentType.SHORT]:Int16Array,[V.ComponentType.BYTE]:Int8Array},Md={[V.ComponentType.FLOAT]:Se.DT_FLOAT32,[V.ComponentType.UNSIGNED_INT]:Se.DT_UINT32,[V.ComponentType.UNSIGNED_SHORT]:Se.DT_UINT16,[V.ComponentType.UNSIGNED_BYTE]:Se.DT_UINT8,[V.ComponentType.SHORT]:Se.DT_INT16,[V.ComponentType.BYTE]:Se.DT_INT8}}var tt,Wy=(function(t){return t[t.EDGEBREAKER=1]="EDGEBREAKER",t[t.SEQUENTIAL=0]="SEQUENTIAL",t})({}),kd={POSITION:14,NORMAL:10,COLOR:8,TEX_COORD:12,GENERIC:12},cd={decodeSpeed:5,encodeSpeed:5,method:1,quantizationBits:kd,quantizationVolume:"mesh"};function Xy(t){tt=t}function $y(t,e=cd){let r={...cd,...e};r.quantizationBits={...kd,...e.quantizationBits};let a=new tt.MeshBuilder,s=new tt.Mesh,n=new tt.ExpertEncoder(s),i={},o=new tt.DracoInt8Array,c=t.listTargets().length>0,l=!1;for(let u of t.listSemantics()){let m=t.getAttribute(u);if(m.getSparse()){l=!0;continue}let g=Yy(u),y=Jy(a,m.getComponentType(),s,tt[g],m.getCount(),m.getElementSize(),m.getArray());if(y===-1)throw new Error(`Error compressing "${u}" attribute.`);if(i[u]=y,r.quantizationVolume==="mesh"||u!=="POSITION")n.SetAttributeQuantization(y,r.quantizationBits[g]);else if(typeof r.quantizationVolume=="object"){let{quantizationVolume:x}=r,v=Math.max(x.max[0]-x.min[0],x.max[1]-x.min[1],x.max[2]-x.min[2]);n.SetAttributeExplicitQuantization(y,r.quantizationBits[g],m.getElementSize(),x.min,v)}else throw new Error("Invalid quantization volume state.")}let f=t.getIndices();if(!f)throw new Gi("Primitive must have indices.");a.AddFacesToMesh(s,f.getCount()/3,f.getArray()),n.SetSpeedOptions(r.encodeSpeed,r.decodeSpeed),n.SetTrackEncodedProperties(!0),r.method===0||c||l?n.SetEncodingMethod(tt.MESH_SEQUENTIAL_ENCODING):n.SetEncodingMethod(tt.MESH_EDGEBREAKER_ENCODING);let d=n.EncodeToDracoBuffer(!(c||l),o);if(d<=0)throw new Gi("Error applying Draco compression.");let p=new Uint8Array(d);for(let u=0;u<d;++u)p[u]=o.GetValue(u);let b=n.GetNumberOfEncodedPoints(),h=n.GetNumberOfEncodedFaces()*3;return tt.destroy(o),tt.destroy(s),tt.destroy(a),tt.destroy(n),{numVertices:b,numIndices:h,data:p,attributeIDs:i}}function Yy(t){return t==="POSITION"?"POSITION":t==="NORMAL"?"NORMAL":t.startsWith("COLOR_")?"COLOR":t.startsWith("TEXCOORD_")?"TEX_COORD":"GENERIC"}function Jy(t,e,r,a,s,n,i){switch(e){case V.ComponentType.UNSIGNED_BYTE:return t.AddUInt8Attribute(r,a,s,n,i);case V.ComponentType.BYTE:return t.AddInt8Attribute(r,a,s,n,i);case V.ComponentType.UNSIGNED_SHORT:return t.AddUInt16Attribute(r,a,s,n,i);case V.ComponentType.SHORT:return t.AddInt16Attribute(r,a,s,n,i);case V.ComponentType.UNSIGNED_INT:return t.AddUInt32Attribute(r,a,s,n,i);case V.ComponentType.FLOAT:return t.AddFloatAttribute(r,a,s,n,i);default:throw new Error(`Unexpected component type, "${e}".`)}}var Gi=class extends Error{},Qy=class extends oe{extensionName=we;prereadTypes=[F.PRIMITIVE];prewriteTypes=[F.ACCESSOR];readDependencies=["draco3d.decoder"];writeDependencies=["draco3d.encoder"];static EXTENSION_NAME=we;static EncoderMethod=Wy;_decoderModule=null;_encoderModule=null;_encoderOptions={};install(t,e){return t==="draco3d.decoder"&&(this._decoderModule=e,qy(this._decoderModule)),t==="draco3d.encoder"&&(this._encoderModule=e,Xy(this._encoderModule)),this}setEncoderOptions(t){return this._encoderOptions=t,this}preread(t){if(!this._decoderModule)throw new Error(`[${we}] Please install extension dependency, "draco3d.decoder".`);let e=this.document.getLogger(),r=t.jsonDoc,a=new Map;try{let s=r.json.meshes||[];for(let n of s)for(let i of n.primitives){if(!i.extensions||!i.extensions.KHR_draco_mesh_compression)continue;let o=i.extensions[we],[c,l]=a.get(o.bufferView)||[];if(!l||!c){let f=r.json.bufferViews[o.bufferView],d=r.json.buffers[f.buffer],p=d.uri?r.resources[d.uri]:r.resources[Lt],b=f.byteOffset||0,h=f.byteLength,u=X.toView(p,b,h);c=new this._decoderModule.Decoder,l=Ky(c,u),a.set(o.bufferView,[c,l]),e.debug(`[${we}] Decompressed ${u.byteLength} bytes.`)}for(let f in o.attributes){let d=t.jsonDoc.json.accessors[i.attributes[f]],p=c.GetAttributeByUniqueId(l,o.attributes[f]),b=Hy(c,l,p,d);t.accessors[i.attributes[f]].setArray(b)}i.indices!==void 0&&t.accessors[i.indices].setArray(Vy(c,l))}}finally{for(let[s,n]of Array.from(a.values()))this._decoderModule.destroy(s),this._decoderModule.destroy(n)}return this}read(t){return this}prewrite(t,e){if(!this._encoderModule)throw new Error(`[${we}] Please install extension dependency, "draco3d.encoder".`);let r=this.document.getLogger();r.debug(`[${we}] Compression options: ${JSON.stringify(this._encoderOptions)}`);let a=Zy(this.document),s=new Map,n="mesh";this._encoderOptions.quantizationVolume==="scene"&&(this.document.getRoot().listScenes().length!==1?r.warn(`[${we}]: quantizationVolume=scene requires exactly 1 scene.`):n=Fl(this.document.getRoot().listScenes().pop()));for(let i of Array.from(a.keys())){let o=a.get(i);if(!o)throw new Error("Unexpected primitive.");if(s.has(o)){s.set(o,s.get(o));continue}let c=i.getIndices(),l=t.jsonDoc.json.accessors,f;try{f=$y(i,{...this._encoderOptions,quantizationVolume:n})}catch(b){if(b instanceof Gi){r.warn(`[${we}]: ${b.message} Skipping primitive compression.`);continue}throw b}s.set(o,f);let d=t.createAccessorDef(c);d.count=f.numIndices,t.accessorIndexMap.set(c,l.length),l.push(d),f.numVertices>65534&&V.getComponentSize(d.componentType)<=2?d.componentType=V.ComponentType.UNSIGNED_INT:f.numVertices>254&&V.getComponentSize(d.componentType)<=1&&(d.componentType=V.ComponentType.UNSIGNED_SHORT);for(let b of i.listSemantics()){let h=i.getAttribute(b);if(f.attributeIDs[b]===void 0)continue;let u=t.createAccessorDef(h);u.count=f.numVertices,t.accessorIndexMap.set(h,l.length),l.push(u)}let p=i.getAttribute("POSITION").getBuffer()||this.document.getRoot().listBuffers()[0];t.otherBufferViews.has(p)||t.otherBufferViews.set(p,[]),t.otherBufferViews.get(p).push(f.data)}return r.debug(`[${we}] Compressed ${a.size} primitives.`),t.extensionData[we]={primitiveHashMap:a,primitiveEncodingMap:s},this}write(t){let e=t.extensionData[we];for(let r of this.document.getRoot().listMeshes()){let a=t.jsonDoc.json.meshes[t.meshIndexMap.get(r)];for(let s=0;s<r.listPrimitives().length;s++){let n=r.listPrimitives()[s],i=a.primitives[s],o=e.primitiveHashMap.get(n);if(!o)continue;let c=e.primitiveEncodingMap.get(o);c&&(i.extensions=i.extensions||{},i.extensions[we]={bufferView:t.otherBufferViewsIndexMap.get(c.data),attributes:c.attributeIDs})}}if(!e.primitiveHashMap.size){let r=t.jsonDoc.json;r.extensionsUsed=(r.extensionsUsed||[]).filter(a=>a!==we),r.extensionsRequired=(r.extensionsRequired||[]).filter(a=>a!==we)}return this}};function Zy(t){let e=t.getLogger(),r=new Set,a=new Set,s=0,n=0;for(let d of t.getRoot().listMeshes())for(let p of d.listPrimitives())p.getIndices()?p.getMode()!==la.Mode.TRIANGLES?(a.add(p),n++):r.add(p):(a.add(p),s++);s>0&&e.warn(`[${we}] Skipping Draco compression of ${s} non-indexed primitives.`),n>0&&e.warn(`[${we}] Skipping Draco compression of ${n} non-TRIANGLES primitives.`);let i=t.getRoot().listAccessors(),o=new Map;for(let d=0;d<i.length;d++)o.set(i[d],d);let c=new Map,l=new Set,f=new Map;for(let d of Array.from(r)){let p=ld(d,o);if(l.has(p)){f.set(d,p);continue}if(c.has(d.getIndices())){let b=d.getIndices(),h=b.clone();o.set(h,t.getRoot().listAccessors().length-1),d.swap(b,h)}for(let b of d.listAttributes())if(c.has(b)){let h=b.clone();o.set(h,t.getRoot().listAccessors().length-1),d.swap(b,h)}p=ld(d,o),l.add(p),f.set(d,p),c.set(d.getIndices(),p);for(let b of d.listAttributes())c.set(b,p)}for(let d of Array.from(c.keys())){let p=new Set(d.listParents().map(b=>b.propertyType));if(p.size!==2||!p.has(F.PRIMITIVE)||!p.has(F.ROOT))throw new Error(`[${we}] Compressed accessors must only be used as indices or vertex attributes.`)}for(let d of Array.from(r)){let p=f.get(d),b=d.getIndices();if(c.get(b)!==p||d.listAttributes().some(h=>c.get(h)!==p))throw new Error(`[${we}] Draco primitives must share all, or no, accessors.`)}for(let d of Array.from(a)){let p=d.getIndices();if(c.has(p)||d.listAttributes().some(b=>c.has(b)))throw new Error(`[${we}] Accessor cannot be shared by compressed and uncompressed primitives.`)}return f}function ld(t,e){let r=[],a=t.getIndices();r.push(e.get(a));for(let s of t.listAttributes())r.push(e.get(s));return r.sort().join("|")}var dd=class Ed extends Q{static EXTENSION_NAME=Et;static Type={POINT:"point",SPOT:"spot",DIRECTIONAL:"directional"};init(){this.extensionName=Et,this.propertyType="Light",this.parentTypes=[F.NODE]}getDefaults(){return Object.assign(super.getDefaults(),{color:[1,1,1],intensity:1,type:Ed.Type.POINT,range:null,innerConeAngle:0,outerConeAngle:Math.PI/4})}getColor(){return this.get("color")}setColor(e){return this.set("color",e)}getIntensity(){return this.get("intensity")}setIntensity(e){return this.set("intensity",e)}getType(){return this.get("type")}setType(e){return this.set("type",e)}getRange(){return this.get("range")}setRange(e){return this.set("range",e)}getInnerConeAngle(){return this.get("innerConeAngle")}setInnerConeAngle(e){return this.set("innerConeAngle",e)}getOuterConeAngle(){return this.get("outerConeAngle")}setOuterConeAngle(e){return this.set("outerConeAngle",e)}},e0=class extends oe{extensionName=Et;static EXTENSION_NAME=Et;createLight(t=""){return new dd(this.document.getGraph(),t)}read(t){let e=t.jsonDoc;if(!e.json.extensions||!e.json.extensions.KHR_lights_punctual)return this;let r=(e.json.extensions.KHR_lights_punctual.lights||[]).map(a=>{let s=this.createLight().setName(a.name||"").setType(a.type);return a.extras&&s.setExtras(a.extras),a.color!==void 0&&s.setColor(a.color),a.intensity!==void 0&&s.setIntensity(a.intensity),a.range!==void 0&&s.setRange(a.range),a.spot?.innerConeAngle!==void 0&&s.setInnerConeAngle(a.spot.innerConeAngle),a.spot?.outerConeAngle!==void 0&&s.setOuterConeAngle(a.spot.outerConeAngle),s});return e.json.nodes.forEach((a,s)=>{if(!a.extensions||!a.extensions.KHR_lights_punctual)return;let n=a.extensions[Et];t.nodes[s].setExtension(Et,r[n.light])}),this}write(t){let e=t.jsonDoc;if(this.properties.size===0)return this;let r=[],a=new Map;for(let s of this.properties){let n=s,i=t.createPropertyDef(s);i.type=n.getType(),he.eq(n.getColor(),[1,1,1])||(i.color=n.getColor()),n.getIntensity()!==1&&(i.intensity=n.getIntensity()),n.getRange()!=null&&(i.range=n.getRange()),n.getName()&&(i.name=n.getName()),n.getType()===dd.Type.SPOT&&(i.spot={innerConeAngle:n.getInnerConeAngle(),outerConeAngle:n.getOuterConeAngle()}),r.push(i),a.set(n,r.length-1)}return this.document.getRoot().listNodes().forEach(s=>{let n=s.getExtension(Et);if(n){let i=t.nodeIndexMap.get(s),o=e.json.nodes[i];o.extensions=o.extensions||{},o.extensions[Et]={light:a.get(n)}}}),e.json.extensions=e.json.extensions||{},e.json.extensions[Et]={lights:r},this}},{R:t0,G:r0,B:a0}=ct,s0=class extends Q{static EXTENSION_NAME=zt;init(){this.extensionName=zt,this.propertyType="Anisotropy",this.parentTypes=[F.MATERIAL]}getDefaults(){return Object.assign(super.getDefaults(),{anisotropyStrength:0,anisotropyRotation:0,anisotropyTexture:null,anisotropyTextureInfo:new ue(this.graph,"anisotropyTextureInfo")})}getAnisotropyStrength(){return this.get("anisotropyStrength")}setAnisotropyStrength(t){return this.set("anisotropyStrength",t)}getAnisotropyRotation(){return this.get("anisotropyRotation")}setAnisotropyRotation(t){return this.set("anisotropyRotation",t)}getAnisotropyTexture(){return this.getRef("anisotropyTexture")}getAnisotropyTextureInfo(){return this.getRef("anisotropyTexture")?this.getRef("anisotropyTextureInfo"):null}setAnisotropyTexture(t){return this.setRef("anisotropyTexture",t,{channels:t0|r0|a0})}},n0=class extends oe{static EXTENSION_NAME=zt;extensionName=zt;prereadTypes=[F.MESH];prewriteTypes=[F.MESH];createAnisotropy(){return new s0(this.document.getGraph())}read(t){return this}write(t){return this}preread(t){let e=t.jsonDoc,r=e.json.materials||[],a=e.json.textures||[];return r.forEach((s,n)=>{if(s.extensions&&s.extensions.KHR_materials_anisotropy){let i=this.createAnisotropy();t.materials[n].setExtension(zt,i);let o=s.extensions[zt];if(o.extras&&i.setExtras(o.extras),o.anisotropyStrength!==void 0&&i.setAnisotropyStrength(o.anisotropyStrength),o.anisotropyRotation!==void 0&&i.setAnisotropyRotation(o.anisotropyRotation),o.anisotropyTexture!==void 0){let c=o.anisotropyTexture,l=t.textures[a[c.index].source];i.setAnisotropyTexture(l),t.setTextureInfo(i.getAnisotropyTextureInfo(),c)}}}),this}prewrite(t){let e=t.jsonDoc;return this.document.getRoot().listMaterials().forEach(r=>{let a=r.getExtension(zt);if(a){let s=t.materialIndexMap.get(r),n=e.json.materials[s],i=t.createPropertyDef(a);if(n.extensions=n.extensions||{},n.extensions[zt]=i,a.getAnisotropyStrength()>0&&(i.anisotropyStrength=a.getAnisotropyStrength()),a.getAnisotropyRotation()!==0&&(i.anisotropyRotation=a.getAnisotropyRotation()),a.getAnisotropyTexture()){let o=a.getAnisotropyTexture(),c=a.getAnisotropyTextureInfo();i.anisotropyTexture=t.createTextureInfoDef(o,c)}}}),this}},{R:ud,G:fd,B:i0}=ct,o0=class extends Q{static EXTENSION_NAME=Gt;init(){this.extensionName=Gt,this.propertyType="Clearcoat",this.parentTypes=[F.MATERIAL]}getDefaults(){return Object.assign(super.getDefaults(),{clearcoatFactor:0,clearcoatTexture:null,clearcoatTextureInfo:new ue(this.graph,"clearcoatTextureInfo"),clearcoatRoughnessFactor:0,clearcoatRoughnessTexture:null,clearcoatRoughnessTextureInfo:new ue(this.graph,"clearcoatRoughnessTextureInfo"),clearcoatNormalScale:1,clearcoatNormalTexture:null,clearcoatNormalTextureInfo:new ue(this.graph,"clearcoatNormalTextureInfo")})}getClearcoatFactor(){return this.get("clearcoatFactor")}setClearcoatFactor(t){return this.set("clearcoatFactor",t)}getClearcoatTexture(){return this.getRef("clearcoatTexture")}getClearcoatTextureInfo(){return this.getRef("clearcoatTexture")?this.getRef("clearcoatTextureInfo"):null}setClearcoatTexture(t){return this.setRef("clearcoatTexture",t,{channels:ud})}getClearcoatRoughnessFactor(){return this.get("clearcoatRoughnessFactor")}setClearcoatRoughnessFactor(t){return this.set("clearcoatRoughnessFactor",t)}getClearcoatRoughnessTexture(){return this.getRef("clearcoatRoughnessTexture")}getClearcoatRoughnessTextureInfo(){return this.getRef("clearcoatRoughnessTexture")?this.getRef("clearcoatRoughnessTextureInfo"):null}setClearcoatRoughnessTexture(t){return this.setRef("clearcoatRoughnessTexture",t,{channels:fd})}getClearcoatNormalScale(){return this.get("clearcoatNormalScale")}setClearcoatNormalScale(t){return this.set("clearcoatNormalScale",t)}getClearcoatNormalTexture(){return this.getRef("clearcoatNormalTexture")}getClearcoatNormalTextureInfo(){return this.getRef("clearcoatNormalTexture")?this.getRef("clearcoatNormalTextureInfo"):null}setClearcoatNormalTexture(t){return this.setRef("clearcoatNormalTexture",t,{channels:ud|fd|i0})}},c0=class extends oe{static EXTENSION_NAME=Gt;extensionName=Gt;prereadTypes=[F.MESH];prewriteTypes=[F.MESH];createClearcoat(){return new o0(this.document.getGraph())}read(t){return this}write(t){return this}preread(t){let e=t.jsonDoc,r=e.json.materials||[],a=e.json.textures||[];return r.forEach((s,n)=>{if(s.extensions&&s.extensions.KHR_materials_clearcoat){let i=this.createClearcoat();t.materials[n].setExtension(Gt,i);let o=s.extensions[Gt];if(o.extras&&i.setExtras(o.extras),o.clearcoatFactor!==void 0&&i.setClearcoatFactor(o.clearcoatFactor),o.clearcoatRoughnessFactor!==void 0&&i.setClearcoatRoughnessFactor(o.clearcoatRoughnessFactor),o.clearcoatTexture!==void 0){let c=o.clearcoatTexture,l=t.textures[a[c.index].source];i.setClearcoatTexture(l),t.setTextureInfo(i.getClearcoatTextureInfo(),c)}if(o.clearcoatRoughnessTexture!==void 0){let c=o.clearcoatRoughnessTexture,l=t.textures[a[c.index].source];i.setClearcoatRoughnessTexture(l),t.setTextureInfo(i.getClearcoatRoughnessTextureInfo(),c)}if(o.clearcoatNormalTexture!==void 0){let c=o.clearcoatNormalTexture,l=t.textures[a[c.index].source];i.setClearcoatNormalTexture(l),t.setTextureInfo(i.getClearcoatNormalTextureInfo(),c),c.scale!==void 0&&i.setClearcoatNormalScale(c.scale)}}}),this}prewrite(t){let e=t.jsonDoc;return this.document.getRoot().listMaterials().forEach(r=>{let a=r.getExtension(Gt);if(a){let s=t.materialIndexMap.get(r),n=e.json.materials[s],i=t.createPropertyDef(a);if(n.extensions=n.extensions||{},n.extensions[Gt]=i,i.clearcoatFactor=a.getClearcoatFactor(),i.clearcoatRoughnessFactor=a.getClearcoatRoughnessFactor(),a.getClearcoatTexture()){let o=a.getClearcoatTexture(),c=a.getClearcoatTextureInfo();i.clearcoatTexture=t.createTextureInfoDef(o,c)}if(a.getClearcoatRoughnessTexture()){let o=a.getClearcoatRoughnessTexture(),c=a.getClearcoatRoughnessTextureInfo();i.clearcoatRoughnessTexture=t.createTextureInfoDef(o,c)}if(a.getClearcoatNormalTexture()){let o=a.getClearcoatNormalTexture(),c=a.getClearcoatNormalTextureInfo();i.clearcoatNormalTexture=t.createTextureInfoDef(o,c),a.getClearcoatNormalScale()!==1&&(i.clearcoatNormalTexture.scale=a.getClearcoatNormalScale())}}}),this}},{R:l0,G:d0,B:u0,A:f0}=ct,h0=class extends Q{static EXTENSION_NAME=Kt;init(){this.extensionName=Kt,this.propertyType="DiffuseTransmission",this.parentTypes=[F.MATERIAL]}getDefaults(){return Object.assign(super.getDefaults(),{diffuseTransmissionFactor:0,diffuseTransmissionTexture:null,diffuseTransmissionTextureInfo:new ue(this.graph,"diffuseTransmissionTextureInfo"),diffuseTransmissionColorFactor:[1,1,1],diffuseTransmissionColorTexture:null,diffuseTransmissionColorTextureInfo:new ue(this.graph,"diffuseTransmissionColorTextureInfo")})}getDiffuseTransmissionFactor(){return this.get("diffuseTransmissionFactor")}setDiffuseTransmissionFactor(t){return this.set("diffuseTransmissionFactor",t)}getDiffuseTransmissionTexture(){return this.getRef("diffuseTransmissionTexture")}getDiffuseTransmissionTextureInfo(){return this.getRef("diffuseTransmissionTexture")?this.getRef("diffuseTransmissionTextureInfo"):null}setDiffuseTransmissionTexture(t){return this.setRef("diffuseTransmissionTexture",t,{channels:f0})}getDiffuseTransmissionColorFactor(){return this.get("diffuseTransmissionColorFactor")}setDiffuseTransmissionColorFactor(t){return this.set("diffuseTransmissionColorFactor",t)}getDiffuseTransmissionColorTexture(){return this.getRef("diffuseTransmissionColorTexture")}getDiffuseTransmissionColorTextureInfo(){return this.getRef("diffuseTransmissionColorTexture")?this.getRef("diffuseTransmissionColorTextureInfo"):null}setDiffuseTransmissionColorTexture(t){return this.setRef("diffuseTransmissionColorTexture",t,{channels:l0|d0|u0})}},b0=class extends oe{extensionName=Kt;static EXTENSION_NAME=Kt;createDiffuseTransmission(){return new h0(this.document.getGraph())}read(t){let e=t.jsonDoc,r=e.json.materials||[],a=e.json.textures||[];return r.forEach((s,n)=>{if(s.extensions&&s.extensions.KHR_materials_diffuse_transmission){let i=this.createDiffuseTransmission();t.materials[n].setExtension(Kt,i);let o=s.extensions[Kt];if(o.extras&&i.setExtras(o.extras),o.diffuseTransmissionFactor!==void 0&&i.setDiffuseTransmissionFactor(o.diffuseTransmissionFactor),o.diffuseTransmissionColorFactor!==void 0&&i.setDiffuseTransmissionColorFactor(o.diffuseTransmissionColorFactor),o.diffuseTransmissionTexture!==void 0){let c=o.diffuseTransmissionTexture,l=t.textures[a[c.index].source];i.setDiffuseTransmissionTexture(l),t.setTextureInfo(i.getDiffuseTransmissionTextureInfo(),c)}if(o.diffuseTransmissionColorTexture!==void 0){let c=o.diffuseTransmissionColorTexture,l=t.textures[a[c.index].source];i.setDiffuseTransmissionColorTexture(l),t.setTextureInfo(i.getDiffuseTransmissionColorTextureInfo(),c)}}}),this}write(t){let e=t.jsonDoc;for(let r of this.document.getRoot().listMaterials()){let a=r.getExtension(Kt);if(!a)continue;let s=t.materialIndexMap.get(r),n=e.json.materials[s],i=t.createPropertyDef(a);if(n.extensions=n.extensions||{},n.extensions[Kt]=i,i.diffuseTransmissionFactor=a.getDiffuseTransmissionFactor(),i.diffuseTransmissionColorFactor=a.getDiffuseTransmissionColorFactor(),a.getDiffuseTransmissionTexture()){let o=a.getDiffuseTransmissionTexture(),c=a.getDiffuseTransmissionTextureInfo();i.diffuseTransmissionTexture=t.createTextureInfoDef(o,c)}if(a.getDiffuseTransmissionColorTexture()){let o=a.getDiffuseTransmissionColorTexture(),c=a.getDiffuseTransmissionColorTextureInfo();i.diffuseTransmissionColorTexture=t.createTextureInfoDef(o,c)}}return this}},p0=class extends Q{static EXTENSION_NAME=Vt;init(){this.extensionName=Vt,this.propertyType="Dispersion",this.parentTypes=[F.MATERIAL]}getDefaults(){return Object.assign(super.getDefaults(),{dispersion:0})}getDispersion(){return this.get("dispersion")}setDispersion(t){return this.set("dispersion",t)}},g0=class extends oe{static EXTENSION_NAME=Vt;extensionName=Vt;prereadTypes=[F.MESH];prewriteTypes=[F.MESH];createDispersion(){return new p0(this.document.getGraph())}read(t){return this}write(t){return this}preread(t){return(t.jsonDoc.json.materials||[]).forEach((e,r)=>{if(e.extensions&&e.extensions.KHR_materials_dispersion){let a=this.createDispersion();t.materials[r].setExtension(Vt,a);let s=e.extensions[Vt];s.extras&&a.setExtras(s.extras),s.dispersion!==void 0&&a.setDispersion(s.dispersion)}}),this}prewrite(t){let e=t.jsonDoc;return this.document.getRoot().listMaterials().forEach(r=>{let a=r.getExtension(Vt);if(a){let s=t.materialIndexMap.get(r),n=e.json.materials[s],i=t.createPropertyDef(a);n.extensions=n.extensions||{},n.extensions[Vt]=i,i.dispersion=a.getDispersion()}}),this}},m0=class extends Q{static EXTENSION_NAME=Ht;init(){this.extensionName=Ht,this.propertyType="EmissiveStrength",this.parentTypes=[F.MATERIAL]}getDefaults(){return Object.assign(super.getDefaults(),{emissiveStrength:1})}getEmissiveStrength(){return this.get("emissiveStrength")}setEmissiveStrength(t){return this.set("emissiveStrength",t)}},y0=class extends oe{static EXTENSION_NAME=Ht;extensionName=Ht;prereadTypes=[F.MESH];prewriteTypes=[F.MESH];createEmissiveStrength(){return new m0(this.document.getGraph())}read(t){return this}write(t){return this}preread(t){return(t.jsonDoc.json.materials||[]).forEach((e,r)=>{if(e.extensions&&e.extensions.KHR_materials_emissive_strength){let a=this.createEmissiveStrength();t.materials[r].setExtension(Ht,a);let s=e.extensions[Ht];s.extras&&a.setExtras(s.extras),s.emissiveStrength!==void 0&&a.setEmissiveStrength(s.emissiveStrength)}}),this}prewrite(t){let e=t.jsonDoc;return this.document.getRoot().listMaterials().forEach(r=>{let a=r.getExtension(Ht);if(a){let s=t.materialIndexMap.get(r),n=e.json.materials[s],i=t.createPropertyDef(a);n.extensions=n.extensions||{},n.extensions[Ht]=i,i.emissiveStrength=a.getEmissiveStrength()}}),this}},x0=class extends Q{static EXTENSION_NAME=qt;init(){this.extensionName=qt,this.propertyType="IOR",this.parentTypes=[F.MATERIAL]}getDefaults(){return Object.assign(super.getDefaults(),{ior:1.5})}getIOR(){return this.get("ior")}setIOR(t){return this.set("ior",t)}},w0=class extends oe{static EXTENSION_NAME=qt;extensionName=qt;prereadTypes=[F.MESH];prewriteTypes=[F.MESH];createIOR(){return new x0(this.document.getGraph())}read(t){return this}write(t){return this}preread(t){return(t.jsonDoc.json.materials||[]).forEach((e,r)=>{if(e.extensions&&e.extensions.KHR_materials_ior){let a=this.createIOR();t.materials[r].setExtension(qt,a);let s=e.extensions[qt];s.extras&&a.setExtras(s.extras),s.ior!==void 0&&a.setIOR(s.ior)}}),this}prewrite(t){let e=t.jsonDoc;return this.document.getRoot().listMaterials().forEach(r=>{let a=r.getExtension(qt);if(a){let s=t.materialIndexMap.get(r),n=e.json.materials[s],i=t.createPropertyDef(a);n.extensions=n.extensions||{},n.extensions[qt]=i,i.ior=a.getIOR()}}),this}},{R:v0,G:M0}=ct,k0=class extends Q{static EXTENSION_NAME=Wt;init(){this.extensionName=Wt,this.propertyType="Iridescence",this.parentTypes=[F.MATERIAL]}getDefaults(){return Object.assign(super.getDefaults(),{iridescenceFactor:0,iridescenceTexture:null,iridescenceTextureInfo:new ue(this.graph,"iridescenceTextureInfo"),iridescenceIOR:1.3,iridescenceThicknessMinimum:100,iridescenceThicknessMaximum:400,iridescenceThicknessTexture:null,iridescenceThicknessTextureInfo:new ue(this.graph,"iridescenceThicknessTextureInfo")})}getIridescenceFactor(){return this.get("iridescenceFactor")}setIridescenceFactor(t){return this.set("iridescenceFactor",t)}getIridescenceTexture(){return this.getRef("iridescenceTexture")}getIridescenceTextureInfo(){return this.getRef("iridescenceTexture")?this.getRef("iridescenceTextureInfo"):null}setIridescenceTexture(t){return this.setRef("iridescenceTexture",t,{channels:v0})}getIridescenceIOR(){return this.get("iridescenceIOR")}setIridescenceIOR(t){return this.set("iridescenceIOR",t)}getIridescenceThicknessMinimum(){return this.get("iridescenceThicknessMinimum")}setIridescenceThicknessMinimum(t){return this.set("iridescenceThicknessMinimum",t)}getIridescenceThicknessMaximum(){return this.get("iridescenceThicknessMaximum")}setIridescenceThicknessMaximum(t){return this.set("iridescenceThicknessMaximum",t)}getIridescenceThicknessTexture(){return this.getRef("iridescenceThicknessTexture")}getIridescenceThicknessTextureInfo(){return this.getRef("iridescenceThicknessTexture")?this.getRef("iridescenceThicknessTextureInfo"):null}setIridescenceThicknessTexture(t){return this.setRef("iridescenceThicknessTexture",t,{channels:M0})}},E0=class extends oe{static EXTENSION_NAME=Wt;extensionName=Wt;prereadTypes=[F.MESH];prewriteTypes=[F.MESH];createIridescence(){return new k0(this.document.getGraph())}read(t){return this}write(t){return this}preread(t){let e=t.jsonDoc,r=e.json.materials||[],a=e.json.textures||[];return r.forEach((s,n)=>{if(s.extensions&&s.extensions.KHR_materials_iridescence){let i=this.createIridescence();t.materials[n].setExtension(Wt,i);let o=s.extensions[Wt];if(o.extras&&i.setExtras(o.extras),o.iridescenceFactor!==void 0&&i.setIridescenceFactor(o.iridescenceFactor),o.iridescenceIor!==void 0&&i.setIridescenceIOR(o.iridescenceIor),o.iridescenceThicknessMinimum!==void 0&&i.setIridescenceThicknessMinimum(o.iridescenceThicknessMinimum),o.iridescenceThicknessMaximum!==void 0&&i.setIridescenceThicknessMaximum(o.iridescenceThicknessMaximum),o.iridescenceTexture!==void 0){let c=o.iridescenceTexture,l=t.textures[a[c.index].source];i.setIridescenceTexture(l),t.setTextureInfo(i.getIridescenceTextureInfo(),c)}if(o.iridescenceThicknessTexture!==void 0){let c=o.iridescenceThicknessTexture,l=t.textures[a[c.index].source];i.setIridescenceThicknessTexture(l),t.setTextureInfo(i.getIridescenceThicknessTextureInfo(),c)}}}),this}prewrite(t){let e=t.jsonDoc;return this.document.getRoot().listMaterials().forEach(r=>{let a=r.getExtension(Wt);if(a){let s=t.materialIndexMap.get(r),n=e.json.materials[s],i=t.createPropertyDef(a);if(n.extensions=n.extensions||{},n.extensions[Wt]=i,a.getIridescenceFactor()>0&&(i.iridescenceFactor=a.getIridescenceFactor()),a.getIridescenceIOR()!==1.3&&(i.iridescenceIor=a.getIridescenceIOR()),a.getIridescenceThicknessMinimum()!==100&&(i.iridescenceThicknessMinimum=a.getIridescenceThicknessMinimum()),a.getIridescenceThicknessMaximum()!==400&&(i.iridescenceThicknessMaximum=a.getIridescenceThicknessMaximum()),a.getIridescenceTexture()){let o=a.getIridescenceTexture(),c=a.getIridescenceTextureInfo();i.iridescenceTexture=t.createTextureInfoDef(o,c)}if(a.getIridescenceThicknessTexture()){let o=a.getIridescenceThicknessTexture(),c=a.getIridescenceThicknessTextureInfo();i.iridescenceThicknessTexture=t.createTextureInfoDef(o,c)}}}),this}},{R:hd,G:bd,B:pd,A:gd}=ct,S0=class extends Q{static EXTENSION_NAME=Xt;init(){this.extensionName=Xt,this.propertyType="PBRSpecularGlossiness",this.parentTypes=[F.MATERIAL]}getDefaults(){return Object.assign(super.getDefaults(),{diffuseFactor:[1,1,1,1],diffuseTexture:null,diffuseTextureInfo:new ue(this.graph,"diffuseTextureInfo"),specularFactor:[1,1,1],glossinessFactor:1,specularGlossinessTexture:null,specularGlossinessTextureInfo:new ue(this.graph,"specularGlossinessTextureInfo")})}getDiffuseFactor(){return this.get("diffuseFactor")}setDiffuseFactor(t){return this.set("diffuseFactor",t)}getDiffuseTexture(){return this.getRef("diffuseTexture")}getDiffuseTextureInfo(){return this.getRef("diffuseTexture")?this.getRef("diffuseTextureInfo"):null}setDiffuseTexture(t){return this.setRef("diffuseTexture",t,{channels:hd|bd|pd|gd,isColor:!0})}getSpecularFactor(){return this.get("specularFactor")}setSpecularFactor(t){return this.set("specularFactor",t)}getGlossinessFactor(){return this.get("glossinessFactor")}setGlossinessFactor(t){return this.set("glossinessFactor",t)}getSpecularGlossinessTexture(){return this.getRef("specularGlossinessTexture")}getSpecularGlossinessTextureInfo(){return this.getRef("specularGlossinessTexture")?this.getRef("specularGlossinessTextureInfo"):null}setSpecularGlossinessTexture(t){return this.setRef("specularGlossinessTexture",t,{channels:hd|bd|pd|gd})}},T0=class extends oe{static EXTENSION_NAME=Xt;extensionName=Xt;prereadTypes=[F.MESH];prewriteTypes=[F.MESH];createPBRSpecularGlossiness(){return new S0(this.document.getGraph())}read(t){return this}write(t){return this}preread(t){let e=t.jsonDoc,r=e.json.materials||[],a=e.json.textures||[];return r.forEach((s,n)=>{if(s.extensions&&s.extensions.KHR_materials_pbrSpecularGlossiness){let i=this.createPBRSpecularGlossiness();t.materials[n].setExtension(Xt,i);let o=s.extensions[Xt];if(o.extras&&i.setExtras(o.extras),o.diffuseFactor!==void 0&&i.setDiffuseFactor(o.diffuseFactor),o.specularFactor!==void 0&&i.setSpecularFactor(o.specularFactor),o.glossinessFactor!==void 0&&i.setGlossinessFactor(o.glossinessFactor),o.diffuseTexture!==void 0){let c=o.diffuseTexture,l=t.textures[a[c.index].source];i.setDiffuseTexture(l),t.setTextureInfo(i.getDiffuseTextureInfo(),c)}if(o.specularGlossinessTexture!==void 0){let c=o.specularGlossinessTexture,l=t.textures[a[c.index].source];i.setSpecularGlossinessTexture(l),t.setTextureInfo(i.getSpecularGlossinessTextureInfo(),c)}}}),this}prewrite(t){let e=t.jsonDoc;return this.document.getRoot().listMaterials().forEach(r=>{let a=r.getExtension(Xt);if(a){let s=t.materialIndexMap.get(r),n=e.json.materials[s],i=t.createPropertyDef(a);if(n.extensions=n.extensions||{},n.extensions[Xt]=i,i.diffuseFactor=a.getDiffuseFactor(),i.specularFactor=a.getSpecularFactor(),i.glossinessFactor=a.getGlossinessFactor(),a.getDiffuseTexture()){let o=a.getDiffuseTexture(),c=a.getDiffuseTextureInfo();i.diffuseTexture=t.createTextureInfoDef(o,c)}if(a.getSpecularGlossinessTexture()){let o=a.getSpecularGlossinessTexture(),c=a.getSpecularGlossinessTextureInfo();i.specularGlossinessTexture=t.createTextureInfoDef(o,c)}}}),this}},{R:A0,G:_0,B:I0,A:R0}=ct,N0=class extends Q{static EXTENSION_NAME=$t;init(){this.extensionName=$t,this.propertyType="Sheen",this.parentTypes=[F.MATERIAL]}getDefaults(){return Object.assign(super.getDefaults(),{sheenColorFactor:[0,0,0],sheenColorTexture:null,sheenColorTextureInfo:new ue(this.graph,"sheenColorTextureInfo"),sheenRoughnessFactor:0,sheenRoughnessTexture:null,sheenRoughnessTextureInfo:new ue(this.graph,"sheenRoughnessTextureInfo")})}getSheenColorFactor(){return this.get("sheenColorFactor")}setSheenColorFactor(t){return this.set("sheenColorFactor",t)}getSheenColorTexture(){return this.getRef("sheenColorTexture")}getSheenColorTextureInfo(){return this.getRef("sheenColorTexture")?this.getRef("sheenColorTextureInfo"):null}setSheenColorTexture(t){return this.setRef("sheenColorTexture",t,{channels:A0|_0|I0,isColor:!0})}getSheenRoughnessFactor(){return this.get("sheenRoughnessFactor")}setSheenRoughnessFactor(t){return this.set("sheenRoughnessFactor",t)}getSheenRoughnessTexture(){return this.getRef("sheenRoughnessTexture")}getSheenRoughnessTextureInfo(){return this.getRef("sheenRoughnessTexture")?this.getRef("sheenRoughnessTextureInfo"):null}setSheenRoughnessTexture(t){return this.setRef("sheenRoughnessTexture",t,{channels:R0})}},C0=class extends oe{static EXTENSION_NAME=$t;extensionName=$t;prereadTypes=[F.MESH];prewriteTypes=[F.MESH];createSheen(){return new N0(this.document.getGraph())}read(t){return this}write(t){return this}preread(t){let e=t.jsonDoc,r=e.json.materials||[],a=e.json.textures||[];return r.forEach((s,n)=>{if(s.extensions&&s.extensions.KHR_materials_sheen){let i=this.createSheen();t.materials[n].setExtension($t,i);let o=s.extensions[$t];if(o.extras&&i.setExtras(o.extras),o.sheenColorFactor!==void 0&&i.setSheenColorFactor(o.sheenColorFactor),o.sheenRoughnessFactor!==void 0&&i.setSheenRoughnessFactor(o.sheenRoughnessFactor),o.sheenColorTexture!==void 0){let c=o.sheenColorTexture,l=t.textures[a[c.index].source];i.setSheenColorTexture(l),t.setTextureInfo(i.getSheenColorTextureInfo(),c)}if(o.sheenRoughnessTexture!==void 0){let c=o.sheenRoughnessTexture,l=t.textures[a[c.index].source];i.setSheenRoughnessTexture(l),t.setTextureInfo(i.getSheenRoughnessTextureInfo(),c)}}}),this}prewrite(t){let e=t.jsonDoc;return this.document.getRoot().listMaterials().forEach(r=>{let a=r.getExtension($t);if(a){let s=t.materialIndexMap.get(r),n=e.json.materials[s],i=t.createPropertyDef(a);if(n.extensions=n.extensions||{},n.extensions[$t]=i,i.sheenColorFactor=a.getSheenColorFactor(),i.sheenRoughnessFactor=a.getSheenRoughnessFactor(),a.getSheenColorTexture()){let o=a.getSheenColorTexture(),c=a.getSheenColorTextureInfo();i.sheenColorTexture=t.createTextureInfoDef(o,c)}if(a.getSheenRoughnessTexture()){let o=a.getSheenRoughnessTexture(),c=a.getSheenRoughnessTextureInfo();i.sheenRoughnessTexture=t.createTextureInfoDef(o,c)}}}),this}},{R:B0,G:O0,B:F0,A:P0}=ct,j0=class extends Q{static EXTENSION_NAME=Yt;init(){this.extensionName=Yt,this.propertyType="Specular",this.parentTypes=[F.MATERIAL]}getDefaults(){return Object.assign(super.getDefaults(),{specularFactor:1,specularTexture:null,specularTextureInfo:new ue(this.graph,"specularTextureInfo"),specularColorFactor:[1,1,1],specularColorTexture:null,specularColorTextureInfo:new ue(this.graph,"specularColorTextureInfo")})}getSpecularFactor(){return this.get("specularFactor")}setSpecularFactor(t){return this.set("specularFactor",t)}getSpecularColorFactor(){return this.get("specularColorFactor")}setSpecularColorFactor(t){return this.set("specularColorFactor",t)}getSpecularTexture(){return this.getRef("specularTexture")}getSpecularTextureInfo(){return this.getRef("specularTexture")?this.getRef("specularTextureInfo"):null}setSpecularTexture(t){return this.setRef("specularTexture",t,{channels:P0})}getSpecularColorTexture(){return this.getRef("specularColorTexture")}getSpecularColorTextureInfo(){return this.getRef("specularColorTexture")?this.getRef("specularColorTextureInfo"):null}setSpecularColorTexture(t){return this.setRef("specularColorTexture",t,{channels:B0|O0|F0,isColor:!0})}},L0=class extends oe{static EXTENSION_NAME=Yt;extensionName=Yt;prereadTypes=[F.MESH];prewriteTypes=[F.MESH];createSpecular(){return new j0(this.document.getGraph())}read(t){return this}write(t){return this}preread(t){let e=t.jsonDoc,r=e.json.materials||[],a=e.json.textures||[];return r.forEach((s,n)=>{if(s.extensions&&s.extensions.KHR_materials_specular){let i=this.createSpecular();t.materials[n].setExtension(Yt,i);let o=s.extensions[Yt];if(o.extras&&i.setExtras(o.extras),o.specularFactor!==void 0&&i.setSpecularFactor(o.specularFactor),o.specularColorFactor!==void 0&&i.setSpecularColorFactor(o.specularColorFactor),o.specularTexture!==void 0){let c=o.specularTexture,l=t.textures[a[c.index].source];i.setSpecularTexture(l),t.setTextureInfo(i.getSpecularTextureInfo(),c)}if(o.specularColorTexture!==void 0){let c=o.specularColorTexture,l=t.textures[a[c.index].source];i.setSpecularColorTexture(l),t.setTextureInfo(i.getSpecularColorTextureInfo(),c)}}}),this}prewrite(t){let e=t.jsonDoc;return this.document.getRoot().listMaterials().forEach(r=>{let a=r.getExtension(Yt);if(a){let s=t.materialIndexMap.get(r),n=e.json.materials[s],i=t.createPropertyDef(a);if(n.extensions=n.extensions||{},n.extensions[Yt]=i,a.getSpecularFactor()!==1&&(i.specularFactor=a.getSpecularFactor()),he.eq(a.getSpecularColorFactor(),[1,1,1])||(i.specularColorFactor=a.getSpecularColorFactor()),a.getSpecularTexture()){let o=a.getSpecularTexture(),c=a.getSpecularTextureInfo();i.specularTexture=t.createTextureInfoDef(o,c)}if(a.getSpecularColorTexture()){let o=a.getSpecularColorTexture(),c=a.getSpecularColorTextureInfo();i.specularColorTexture=t.createTextureInfoDef(o,c)}}}),this}},{R:D0}=ct,U0=class extends Q{static EXTENSION_NAME=Jt;init(){this.extensionName=Jt,this.propertyType="Transmission",this.parentTypes=[F.MATERIAL]}getDefaults(){return Object.assign(super.getDefaults(),{transmissionFactor:0,transmissionTexture:null,transmissionTextureInfo:new ue(this.graph,"transmissionTextureInfo")})}getTransmissionFactor(){return this.get("transmissionFactor")}setTransmissionFactor(t){return this.set("transmissionFactor",t)}getTransmissionTexture(){return this.getRef("transmissionTexture")}getTransmissionTextureInfo(){return this.getRef("transmissionTexture")?this.getRef("transmissionTextureInfo"):null}setTransmissionTexture(t){return this.setRef("transmissionTexture",t,{channels:D0})}},z0=class extends oe{static EXTENSION_NAME=Jt;extensionName=Jt;prereadTypes=[F.MESH];prewriteTypes=[F.MESH];createTransmission(){return new U0(this.document.getGraph())}read(t){return this}write(t){return this}preread(t){let e=t.jsonDoc,r=e.json.materials||[],a=e.json.textures||[];return r.forEach((s,n)=>{if(s.extensions&&s.extensions.KHR_materials_transmission){let i=this.createTransmission();t.materials[n].setExtension(Jt,i);let o=s.extensions[Jt];if(o.extras&&i.setExtras(o.extras),o.transmissionFactor!==void 0&&i.setTransmissionFactor(o.transmissionFactor),o.transmissionTexture!==void 0){let c=o.transmissionTexture,l=t.textures[a[c.index].source];i.setTransmissionTexture(l),t.setTextureInfo(i.getTransmissionTextureInfo(),c)}}}),this}prewrite(t){let e=t.jsonDoc;return this.document.getRoot().listMaterials().forEach(r=>{let a=r.getExtension(Jt);if(a){let s=t.materialIndexMap.get(r),n=e.json.materials[s],i=t.createPropertyDef(a);if(n.extensions=n.extensions||{},n.extensions[Jt]=i,i.transmissionFactor=a.getTransmissionFactor(),a.getTransmissionTexture()){let o=a.getTransmissionTexture(),c=a.getTransmissionTextureInfo();i.transmissionTexture=t.createTextureInfoDef(o,c)}}}),this}},G0=class extends Q{static EXTENSION_NAME=Rr;init(){this.extensionName=Rr,this.propertyType="Unlit",this.parentTypes=[F.MATERIAL]}},K0=class extends oe{static EXTENSION_NAME=Rr;extensionName=Rr;prereadTypes=[F.MESH];prewriteTypes=[F.MESH];createUnlit(){return new G0(this.document.getGraph())}read(t){return this}write(t){return this}preread(t){return(t.jsonDoc.json.materials||[]).forEach((e,r)=>{e.extensions&&e.extensions.KHR_materials_unlit&&t.materials[r].setExtension(Rr,this.createUnlit())}),this}prewrite(t){let e=t.jsonDoc;return this.document.getRoot().listMaterials().forEach(r=>{if(r.getExtension("KHR_materials_unlit")){let a=t.materialIndexMap.get(r),s=e.json.materials[a];s.extensions=s.extensions||{},s.extensions[Rr]={}}}),this}},V0=class extends Q{static EXTENSION_NAME=$e;init(){this.extensionName=$e,this.propertyType="Mapping",this.parentTypes=["MappingList"]}getDefaults(){return Object.assign(super.getDefaults(),{material:null,variants:new le})}getMaterial(){return this.getRef("material")}setMaterial(t){return this.setRef("material",t)}addVariant(t){return this.addRef("variants",t)}removeVariant(t){return this.removeRef("variants",t)}listVariants(){return this.listRefs("variants")}},H0=class extends Q{static EXTENSION_NAME=$e;init(){this.extensionName=$e,this.propertyType="MappingList",this.parentTypes=[F.PRIMITIVE]}getDefaults(){return Object.assign(super.getDefaults(),{mappings:new le})}addMapping(t){return this.addRef("mappings",t)}removeMapping(t){return this.removeRef("mappings",t)}listMappings(){return this.listRefs("mappings")}},md=class extends Q{static EXTENSION_NAME=$e;init(){this.extensionName=$e,this.propertyType="Variant",this.parentTypes=["MappingList"]}},q0=class extends oe{extensionName=$e;static EXTENSION_NAME=$e;createMappingList(){return new H0(this.document.getGraph())}createVariant(t=""){return new md(this.document.getGraph(),t)}createMapping(){return new V0(this.document.getGraph())}listVariants(){return Array.from(this.properties).filter(t=>t instanceof md)}read(t){let e=t.jsonDoc;if(!e.json.extensions||!e.json.extensions.KHR_materials_variants)return this;let r=(e.json.extensions.KHR_materials_variants.variants||[]).map(a=>this.createVariant().setName(a.name||""));return(e.json.meshes||[]).forEach((a,s)=>{let n=t.meshes[s];(a.primitives||[]).forEach((i,o)=>{if(!i.extensions||!i.extensions.KHR_materials_variants)return;let c=this.createMappingList(),l=i.extensions[$e];for(let f of l.mappings){let d=this.createMapping();f.material!==void 0&&d.setMaterial(t.materials[f.material]);for(let p of f.variants||[])d.addVariant(r[p]);c.addMapping(d)}n.listPrimitives()[o].setExtension($e,c)})}),this}write(t){let e=t.jsonDoc,r=this.listVariants();if(!r.length)return this;let a=[],s=new Map;for(let n of r)s.set(n,a.length),a.push(t.createPropertyDef(n));for(let n of this.document.getRoot().listMeshes()){let i=t.meshIndexMap.get(n);n.listPrimitives().forEach((o,c)=>{let l=o.getExtension($e);if(!l)return;let f=t.jsonDoc.json.meshes[i].primitives[c],d=l.listMappings().map(p=>{let b=t.createPropertyDef(p),h=p.getMaterial();return h&&(b.material=t.materialIndexMap.get(h)),b.variants=p.listVariants().map(u=>s.get(u)),b});f.extensions=f.extensions||{},f.extensions[$e]={mappings:d}})}return e.json.extensions=e.json.extensions||{},e.json.extensions[$e]={variants:a},this}},{G:W0}=ct,X0=class extends Q{static EXTENSION_NAME=Qt;init(){this.extensionName=Qt,this.propertyType="Volume",this.parentTypes=[F.MATERIAL]}getDefaults(){return Object.assign(super.getDefaults(),{thicknessFactor:0,thicknessTexture:null,thicknessTextureInfo:new ue(this.graph,"thicknessTexture"),attenuationDistance:1/0,attenuationColor:[1,1,1]})}getThicknessFactor(){return this.get("thicknessFactor")}setThicknessFactor(t){return this.set("thicknessFactor",t)}getThicknessTexture(){return this.getRef("thicknessTexture")}getThicknessTextureInfo(){return this.getRef("thicknessTexture")?this.getRef("thicknessTextureInfo"):null}setThicknessTexture(t){return this.setRef("thicknessTexture",t,{channels:W0})}getAttenuationDistance(){return this.get("attenuationDistance")}setAttenuationDistance(t){return this.set("attenuationDistance",t)}getAttenuationColor(){return this.get("attenuationColor")}setAttenuationColor(t){return this.set("attenuationColor",t)}},$0=class extends oe{static EXTENSION_NAME=Qt;extensionName=Qt;prereadTypes=[F.MESH];prewriteTypes=[F.MESH];createVolume(){return new X0(this.document.getGraph())}read(t){return this}write(t){return this}preread(t){let e=t.jsonDoc,r=e.json.materials||[],a=e.json.textures||[];return r.forEach((s,n)=>{if(s.extensions&&s.extensions.KHR_materials_volume){let i=this.createVolume();t.materials[n].setExtension(Qt,i);let o=s.extensions[Qt];if(o.extras&&i.setExtras(o.extras),o.thicknessFactor!==void 0&&i.setThicknessFactor(o.thicknessFactor),o.attenuationDistance!==void 0&&i.setAttenuationDistance(o.attenuationDistance),o.attenuationColor!==void 0&&i.setAttenuationColor(o.attenuationColor),o.thicknessTexture!==void 0){let c=o.thicknessTexture,l=t.textures[a[c.index].source];i.setThicknessTexture(l),t.setTextureInfo(i.getThicknessTextureInfo(),c)}}}),this}prewrite(t){let e=t.jsonDoc;return this.document.getRoot().listMaterials().forEach(r=>{let a=r.getExtension(Qt);if(a){let s=t.materialIndexMap.get(r),n=e.json.materials[s],i=t.createPropertyDef(a);if(n.extensions=n.extensions||{},n.extensions[Qt]=i,a.getThicknessFactor()>0&&(i.thicknessFactor=a.getThicknessFactor()),Number.isFinite(a.getAttenuationDistance())&&(i.attenuationDistance=a.getAttenuationDistance()),he.eq(a.getAttenuationColor(),[1,1,1])||(i.attenuationColor=a.getAttenuationColor()),a.getThicknessTexture()){let o=a.getThicknessTexture(),c=a.getThicknessTextureInfo();i.thicknessTexture=t.createTextureInfoDef(o,c)}}}),this}},Y0=class extends oe{extensionName=ed;static EXTENSION_NAME=ed;read(t){return this}write(t){return this}},Hi=class extends oe{extensionName=td;static EXTENSION_NAME=td;read(t){return this}write(t){return this}},J0=class extends Q{static EXTENSION_NAME=Zt;init(){this.extensionName=Zt,this.propertyType="Visibility",this.parentTypes=[F.NODE]}getDefaults(){return Object.assign(super.getDefaults(),{visible:!0})}getVisible(){return this.get("visible")}setVisible(t){return this.set("visible",t)}},Q0=class extends oe{static EXTENSION_NAME=Zt;extensionName=Zt;createVisibility(){return new J0(this.document.getGraph())}read(t){return(t.jsonDoc.json.nodes||[]).forEach((e,r)=>{if(e.extensions&&e.extensions.KHR_node_visibility){let a=this.createVisibility();t.nodes[r].setExtension(Zt,a);let s=e.extensions[Zt];s.visible!==void 0&&a.setVisible(s.visible)}}),this}write(t){let e=t.jsonDoc;for(let r of this.document.getRoot().listNodes()){let a=r.getExtension(Zt);if(!a)continue;let s=t.nodeIndexMap.get(r),n=e.json.nodes[s];n.extensions=n.extensions||{},n.extensions[Zt]={visible:a.getVisible()}}return this}};function Z0(t){return t.vkFormat>0&&t.vkFormat<=123}function yd(t){let e=t.vkFormat===1000066e3&&t.dataFormatDescriptor[0].colorModel===167;return t.vkFormat===0||e}var ex=class{match(t){return t[0]===171&&t[1]===75&&t[2]===84&&t[3]===88&&t[4]===32&&t[5]===50&&t[6]===48&&t[7]===187&&t[8]===13&&t[9]===10&&t[10]===26&&t[11]===10}getSize(t){let e=Is(t);return[e.pixelWidth,e.pixelHeight]}getChannels(t){let e=Is(t),r=e.dataFormatDescriptor[0];if(Z0(e))return r.samples.length;if(yd(e))switch(r.colorModel){case 163:return r.samples.length===2&&(r.samples[1].channelType&15)===15?4:3;case 166:return(r.samples[0].channelType&15)===3?4:3;default:throw new Error(`Unexpected KTX2 colorModel, "${r.colorModel}".`)}throw new Error(`Unexpected KTX2 vkFormat, "${e.vkFormat}".`)}getVRAMByteLength(t){let e=Is(t),r=0;if(yd(e)){let a=this.getChannels(t)>3;for(let s=0;s<e.levels.length;s++){let n=e.levels[s];if(n.uncompressedByteLength)r+=n.uncompressedByteLength;else{let i=Math.max(1,Math.floor(e.pixelWidth/Math.pow(2,s))),o=Math.max(1,Math.floor(e.pixelHeight/Math.pow(2,s))),c=a?16:8;r+=i/4*(o/4)*c}}}else for(let a of e.levels)e.supercompressionScheme===0?r+=a.levelData.byteLength:r+=a.uncompressedByteLength;return r}},tx=class extends oe{static EXTENSION_NAME=Cs;extensionName=Cs;prereadTypes=[F.TEXTURE];static register(){bt.registerFormat("image/ktx2",new ex)}preread(t){return t.jsonDoc.json.textures&&t.jsonDoc.json.textures.forEach(e=>{e.extensions&&e.extensions.KHR_texture_basisu&&(e.source=e.extensions[Cs].source)}),this}read(t){return this}write(t){let e=t.jsonDoc;return this.document.getRoot().listTextures().forEach(r=>{if(r.getMimeType()==="image/ktx2"){let a=t.imageIndexMap.get(r);e.json.textures.forEach(s=>{s.source===a&&(s.extensions=s.extensions||{},s.extensions[Cs]={source:s.source},delete s.source)})}}),this}},rx=class extends Q{static EXTENSION_NAME=er;init(){this.extensionName=er,this.propertyType="Transform",this.parentTypes=[F.TEXTURE_INFO]}getDefaults(){return Object.assign(super.getDefaults(),{offset:[0,0],rotation:0,scale:[1,1],texCoord:null})}getOffset(){return this.get("offset")}setOffset(t){return this.set("offset",t)}getRotation(){return this.get("rotation")}setRotation(t){return this.set("rotation",t)}getScale(){return this.get("scale")}setScale(t){return this.set("scale",t)}getTexCoord(){return this.get("texCoord")}setTexCoord(t){return this.set("texCoord",t)}},ax=class extends oe{extensionName=er;static EXTENSION_NAME=er;createTransform(){return new rx(this.document.getGraph())}read(t){for(let[e,r]of Array.from(t.textureInfos.entries())){if(!r.extensions||!r.extensions.KHR_texture_transform)continue;let a=this.createTransform(),s=r.extensions[er];s.offset!==void 0&&a.setOffset(s.offset),s.rotation!==void 0&&a.setRotation(s.rotation),s.scale!==void 0&&a.setScale(s.scale),s.texCoord!==void 0&&a.setTexCoord(s.texCoord),e.setExtension(er,a)}return this}write(t){let e=Array.from(t.textureInfoDefMap.entries());for(let[r,a]of e){let s=r.getExtension(er);if(!s)continue;a.extensions=a.extensions||{};let n={},i=he.eq;i(s.getOffset(),[0,0])||(n.offset=s.getOffset()),s.getRotation()!==0&&(n.rotation=s.getRotation()),i(s.getScale(),[1,1])||(n.scale=s.getScale()),s.getTexCoord()!=null&&(n.texCoord=s.getTexCoord()),a.extensions[er]=n}return this}},sx=[F.ROOT,F.SCENE,F.NODE,F.MESH,F.MATERIAL,F.TEXTURE,F.ANIMATION],nx=class extends Q{static EXTENSION_NAME=lt;init(){this.extensionName=lt,this.propertyType="Packet",this.parentTypes=sx}getDefaults(){return Object.assign(super.getDefaults(),{context:{},properties:{}})}getContext(){return this.get("context")}setContext(t){return this.set("context",{...t})}listProperties(){return Object.keys(this.get("properties"))}getProperty(t){let e=this.get("properties");return t in e?e[t]:null}setProperty(t,e){this._assertContext(t);let r={...this.get("properties")};return e?r[t]=e:delete r[t],this.set("properties",r)}toJSONLD(){return{"@context":Di(this.get("context")),...Di(this.get("properties"))}}fromJSONLD(t){t=Di(t);let e=t["@context"];return e&&this.set("context",e),delete t["@context"],this.set("properties",t)}_assertContext(t){if(!(t.split(":")[0]in this.get("context")))throw new Error(`${lt}: Missing context for term, "${t}".`)}};function Di(t){return JSON.parse(JSON.stringify(t))}var ix=class extends oe{extensionName=lt;static EXTENSION_NAME=lt;createPacket(){return new nx(this.document.getGraph())}listPackets(){return Array.from(this.properties)}read(t){let e=t.jsonDoc.json.extensions?.[lt];if(!e||!e.packets)return this;let r=t.jsonDoc.json,a=this.document.getRoot(),s=e.packets.map(o=>this.createPacket().fromJSONLD(o)),n=[[r.asset],r.scenes,r.nodes,r.meshes,r.materials,r.images,r.animations],i=[[a],a.listScenes(),a.listNodes(),a.listMeshes(),a.listMaterials(),a.listTextures(),a.listAnimations()];for(let o=0;o<n.length;o++){let c=n[o]||[];for(let l=0;l<c.length;l++){let f=c[l];if(f.extensions&&f.extensions.KHR_xmp_json_ld){let d=f.extensions[lt];i[o][l].setExtension(lt,s[d.packet])}}}return this}write(t){let{json:e}=t.jsonDoc,r=[];for(let a of this.properties){r.push(a.toJSONLD());for(let s of a.listParents()){let n;switch(s.propertyType){case F.ROOT:n=e.asset;break;case F.SCENE:n=e.scenes[t.sceneIndexMap.get(s)];break;case F.NODE:n=e.nodes[t.nodeIndexMap.get(s)];break;case F.MESH:n=e.meshes[t.meshIndexMap.get(s)];break;case F.MATERIAL:n=e.materials[t.materialIndexMap.get(s)];break;case F.TEXTURE:n=e.images[t.imageIndexMap.get(s)];break;case F.ANIMATION:n=e.animations[t.animationIndexMap.get(s)];break;default:n=null,this.document.getLogger().warn(`[${lt}]: Unsupported parent property, "${s.propertyType}"`);break}n&&(n.extensions=n.extensions||{},n.extensions[lt]={packet:r.length-1})}}return r.length>0&&(e.extensions=e.extensions||{},e.extensions[lt]={packets:r}),this}},ox=[zy,Gy,Qy,e0,n0,c0,b0,g0,y0,w0,E0,T0,L0,C0,z0,K0,q0,$0,Y0,Hi,Q0,tx,ax,ix],SS=[Um,Ki,Vi,uy,Ly,Uy,...ox];var VT=(function(){var t="b9H79Tebbbe9ok9Geueu9Geub9Gbb9Gruuuuuuueu9Gvuuuuueu9Gduueu9Gluuuueu9Gvuuuuub9Gouuuuuub9Gluuuub9Giuuueui8AYdilveoveovrrwrrDDoDrbqqbelve9Weiiviebeoweuec;G:Qdkr:nlAo9TW9T9VV95dbH9F9F939H79T9F9J9H229F9Jt9VV7bb8F9TW79O9V9Wt9FW9U9J9V9KW9wWVtW949c919M9MWV9mW4W2be8A9TW79O9V9Wt9FW9U9J9V9KW9wWVtW949c919M9MWVbd8F9TW79O9V9Wt9FW9U9J9V9KW9wWVtW949c919M9MWV9c9V919U9KbiE9TW79O9V9Wt9FW9U9J9V9KW9wWVtW949wWV79P9V9UblY9TW79O9V9Wt9FW9U9J9V9KW69U9KW949c919M9MWVbv8E9TW79O9V9Wt9FW9U9J9V9KW69U9KW949c919M9MWV9c9V919U9Kbo8A9TW79O9V9Wt9FW9U9J9V9KW69U9KW949wWV79P9V9UbrE9TW79O9V9Wt9FW9U9J9V9KW69U9KW949tWG91W9U9JWbwa9TW79O9V9Wt9FW9U9J9V9KW69U9KW949tWG91W9U9JW9c9V919U9KbDL9TW79O9V9Wt9FW9U9J9V9KWS9P2tWV9p9JtbqK9TW79O9V9Wt9FW9U9J9V9KWS9P2tWV9r919HtbkL9TW79O9V9Wt9FW9U9J9V9KWS9P2tWVT949WbxE9TW79O9V9Wt9F9V9Wt9P9T9P96W9wWVtW94J9H9J9OWbsa9TW79O9V9Wt9F9V9Wt9P9T9P96W9wWVtW94J9H9J9OW9ttV9P9Wbza9TW79O9V9Wt9F9V9Wt9P9T9P96W9wWVtW94SWt9J9O9sW9T9H9WbHK9TW79O9V9Wt9F79W9Ht9P9H29t9VVt9sW9T9H9WbOl79IV9RbCDwebcekdKLqN9OYdbk:Bhdhud9:8Jjjjjbc;qw9Rgr8KjjjjbcbhwdnaeTmbabcbyd;C:kjjbaoaocb9iEgDc:GeV86bbarc;adfcbcjdz:wjjjb8AdnaiTmbarc;adfadalz:vjjjb8Akarc;abfalfcbcbcjdal9RalcFe0Ez:wjjjb8Aarc;abfarc;adfalz:vjjjb8AarcUf9cb83ibarc8Wf9cb83ibarcyf9cb83ibarcaf9cb83ibarcKf9cb83ibarczf9cb83ibar9cb83iwar9cb83ibcj;abal9Uc;WFbGcjdalca0Ehqdnaicd6mbavcd9imbaDTmbadcefhkaqci2gxal2hmarc;alfclfhParc;qlfceVhsarc;qofclVhzarc;qofcKfhHarc;qofczfhOcbhAincdhCcbhodnavci6mbaH9cb83ibaO9cb83ibar9cb83i;yoar9cb83i;qoadaAfgoybbhXcbhQincbhwcbhLdninaoalfhKaoybbgYaX7aLVhLawcP0meaKhoaYhXawcefgwaQfai6mbkkcbhXarc;qofhwincwh8AcwhEdnaLaX93gocFeGg3cs0mbclhEa3ci0mba3cb9hcethEkdnaocw4cFeGg3cs0mbclh8Aa3ci0mba3cb9hceth8Aka8AaEfh3awydbh5cwh8AcwhEdnaocz4cFeGg8Ecs0mbclhEa8Eci0mba8Ecb9hcethEka3a5fh3dnaocFFFFb0mbclh8AaocFFF8F0mbaocFFFr0ceth8Akawa3aEfa8AfBdbawclfhwaXcefgXcw9hmbkaKhoaYhXaQczfgQai6mbkcbhocehwazhLinawaoaLydbarc;qofaocdtfydb6EhoaLclfhLawcefgwcw9hmbkcihCkcbh3arc;qlfcbcjdz:wjjjb8Aarc;alfcwfcbBdbar9cb83i;alaoclth8Fadhaaqhhakh5inarc;qlfadcba3cufgoaoa30Eal2falz:vjjjb8Aaiahaiah6Ehgdnaqaia39Ra3aqfai6EgYcsfc9WGgoaY9nmbarc;qofaYfcbaoaY9Rz:wjjjb8Akada3al2fh8Jcbh8Kina8Ka8FVcl4hQarc;alfa8Kcdtfh8LaAh8Mcbh8Nina8NaAfhwdndndndndndna8KPldebidkasa8Mc98GgLfhoa5aLfh8Aarc;qlfawc98GgLfRbbhXcwhwinaoRbbawtaXVhXaocefhoawcwfgwca9hmbkaYTmla8Ncith8Ea8JaLfhEcbhKinaERbbhLcwhoa8AhwinawRbbaotaLVhLawcefhwaocwfgoca9hmbkarc;qofaKfaLaX7aQ93a8E486bba8Aalfh8AaEalfhEaLhXaKcefgKaY9hmbxlkkaYTmia8Mc9:Ghoa8NcitcwGhEarc;qlfawceVfRbbcwtarc;qlfawc9:GfRbbVhLarc;qofhwaghXinawa5aofRbbcwtaaaofRbbVg8AaL9RgLcetaLcztcz91cs47cFFiGaE486bbaoalfhoawcefhwa8AhLa3aXcufgX9hmbxikkaYTmda8Jawfhoarc;qlfawfRbbhLarc;qofhwaghXinawaoRbbg8AaL9RgLcetaLcKtcK91cr4786bbawcefhwaoalfhoa8AhLa3aXcufgX9hmbxdkkaYTmeka8LydbhEcbhKarc;qofhoincdhLcbhwinaLaoawfRbbcb9hfhLawcefgwcz9hmbkclhXcbhwinaXaoawfRbbcd0fhXawcefgwcz9hmbkcwh8Acbhwina8AaoawfRbbcP0fh8Aawcefgwcz9hmbkaLaXaLaX6Egwa8Aawa8A6Egwczawcz6EaEfhEaoczfhoaKczfgKaY6mbka8LaEBdbka8Mcefh8Ma8Ncefg8Ncl9hmbka8Kcefg8KaC9hmbkaaamfhaahaxfhha5amfh5a3axfg3ai6mbkcbhocehwaPhLinawaoaLydbarc;alfaocdtfydb6EhoaLclfhLawcefgXhwaCaX9hmbkaraAcd4fa8FcdVaoaocdSE86bbaAclfgAal6mbkkabaefh8Kabcefhoalcd4gecbaDEhkadcefhOarc;abfceVhHcbhmdndninaiam9nmearc;qofcbcjdz:wjjjb8Aa8Kao9Rak6mdadamal2gwfhxcbh8JaOawfhzaocbakz:wjjjbghakfh5aqaiam9Ramaqfai6Egscsfgocl4cifcd4hCaoc9WGg8LThPindndndndndndndndndndnaDTmbara8Jcd4fRbbgLciGPlbedlbkasTmdaxa8Jfhoarc;abfa8JfRbbhLarc;qofhwashXinawaoRbbg8AaL9RgLcetaLcKtcK91cr4786bbawcefhwaoalfhoa8AhLaXcufgXmbxikkasTmia8JcitcwGhEarc;abfa8JceVfRbbcwtarc;abfa8Jc9:GgofRbbVhLaxaofhoarc;qofhwashXinawao8Vbbg8AaL9RgLcetaLcztcz91cs47cFFiGaE486bbawcefhwaoalfhoa8AhLaXcufgXmbxdkkaHa8Jc98GgEfhoazaEfh8Aarc;abfaEfRbbhXcwhwinaoRbbawtaXVhXaocefhoawcwfgwca9hmbkasTmbaLcl4hYa8JcitcKGh3axaEfhEcbhKinaERbbhLcwhoa8AhwinawRbbaotaLVhLawcefhwaocwfgoca9hmbkarc;qofaKfaLaX7aY93a3486bba8Aalfh8AaEalfhEaLhXaKcefgKas9hmbkkaDmbcbhoxlka8LTmbcbhodninarc;qofaofgwcwf8Pibaw8Pib:e9qTmeaoczfgoa8L9pmdxbkkdnavmbcehoxikcbhEaChKaChYinarc;qofaEfgocwf8Pibhyao8Pibh8PcdhLcbhwinaLaoawfRbbcb9hfhLawcefgwcz9hmbkclhXcbhwinaXaoawfRbbcd0fhXawcefgwcz9hmbkcwh8Acbhwina8AaoawfRbbcP0fh8Aawcefgwcz9hmbkaLaXaLaX6Egoa8Aaoa8A6Egoczaocz6EaYfhYaocucbaya8P:e9cb9sEgwaoaw6EaKfhKaEczfgEa8L9pmdxbkkaha8Jcd4fgoaoRbbcda8JcetcoGtV86bbxikdnaKas6mbaYas6mbaha8Jcd4fgoaoRbbcia8JcetcoGtV86bba8Ka59Ras6mra5arc;qofasz:vjjjbasfh5xikaKaY9phokaha8Jcd4fgwawRbbaoa8JcetcoGtV86bbka8Ka59RaC6mla5cbaCz:wjjjbgAaCfhYdndna8LmbaPhoxekdna8KaY9RcK9pmbaPhoxekaocdtc:q1jjbfcj1jjbaDEg5ydxggcetc;:FFFeGh8Fcuh3cuagtcu7cFeGhacbh8Marc;qofhLinarc;qofa8MfhQczhEdndndnagPDbeeeeeeedekcucbaQcwf8PibaQ8Pib:e9cb9sEhExekcbhoa8FhEinaEaaaLaofRbb9nfhEaocefgocz9hmbkkcih8Ecbh8Ainczhwdndndna5a8AcdtfydbgKPDbeeeeeeedekcucbaQcwf8PibaQ8Pib:e9cb9sEhwxekaKcetc;:FFFeGhwcuaKtcu7cFeGhXcbhoinawaXaLaofRbb9nfhwaocefgocz9hmbkkdndnawaE6mbaKa39hmeawaE9hmea5a8EcdtfydbcwSmeka8Ah8EawhEka8Acefg8Aci9hmbkaAa8Mco4fgoaoRbba8Ea8Mci4coGtV86bbdndndna5a8Ecdtfydbg3PDdbbbbbbbebkdncwa39Tg8ETmbcua3tcu7hwdndna3ceSmbcbh8NaLhQinaQhoa8Eh8AcbhXinaoRbbgEawcFeGgKaEaK6EaXa3tVhXaocefhoa8Acufg8AmbkaYaX86bbaQa8EfhQaYcefhYa8Na8Efg8Ncz6mbxdkkcbh8NaLhQinaQhoa8Eh8AcbhXinaoRbbgEawcFeGgKaEaK6EaXcetVhXaocefhoa8Acufg8AmbkaYaX:T9cFe:d9c:c:qj:bw9:9c:q;c1:I1e:d9c:b:c:e1z9:9ca188bbaQa8EfhQaYcefhYa8Na8Efg8Ncz6mbkkcbhoinaYaLaofRbbgX86bbaYaXawcFeG9pfhYaocefgocz9hmbxikkdna3ceSmbinaYcb86bbaYcefhYxbkkinaYcb86bbaYcefhYxbkkaYaQ8Pbb83bbaYcwfaQcwf8Pbb83bbaYczfhYka8Mczfg8Ma8L9pgomeaLczfhLa8KaY9RcK9pmbkkaoTmlaYh5aYTmlka8Jcefg8Jal9hmbkarc;abfaxascufal2falz:vjjjb8Aasamfhma5hoa5mbkcbhwxdkdna8Kao9RakalfgwcKcaaDEgLawaL0EgX9pmbcbhwxdkdnawaL9pmbaocbaXaw9Rgwz:wjjjbawfhokaoarc;adfalz:vjjjbalfhodnaDTmbaoaraez:vjjjbaefhokaoab9Rhwxekcbhwkarc;qwf8Kjjjjbawk5babaeadaialcdcbyd;C:kjjbz:bjjjbk9reduaecd4gdaefgicaaica0Eabcj;abae9Uc;WFbGcjdaeca0Egifcufai9Uae2aiadfaicl4cifcd4f2fcefkmbcbabBd;C:kjjbk:Ese5u8Jjjjjbc;ae9Rgl8Kjjjjbcbhvdnaici9UgocHfae0mbabcbyd;m:kjjbgrc;GeV86bbalc;abfcFecjez:wjjjb8AalcUfgw9cu83ibalc8WfgD9cu83ibalcyfgq9cu83ibalcafgk9cu83ibalcKfgx9cu83ibalczfgm9cu83ibal9cu83iwal9cu83ibabaefc9WfhPabcefgsaofhednaiTmbcmcsarcb9kgzEhHcbhOcbhAcbhCcbhXcbhQindnaeaP9nmbcbhvxikaQcufhvadaCcdtfgLydbhKaLcwfydbhYaLclfydbh8AcbhEdndndninalc;abfavcsGcitfgoydlh3dndndnaoydbgoaK9hmba3a8ASmekdnaoa8A9hmba3aY9hmbaEcefhExekaoaY9hmea3aK9hmeaEcdfhEkaEc870mdaXcufhvaLaEciGcx2goc;i1jjbfydbcdtfydbh3aLaoc;e1jjbfydbcdtfydbh8AaLaoc;a1jjbfydbcdtfydbhKcbhodnindnalavcsGcdtfydba39hmbaohYxdkcuhYavcufhvaocefgocz9hmbkkaOa3aOSgvaYce9iaYaH9oVgoGfhOdndndncbcsavEaYaoEgvcs9hmbarce9imba3a3aAa3cefaASgvEgAcefSmecmcsavEhvkasavaEcdtc;WeGV86bbavcs9hmea3aA9Rgvcetavc8F917hvinaeavcFb0crtavcFbGV86bbaecefheavcje6hoavcr4hvaoTmbka3hAxvkcPhvasaEcdtcPV86bba3hAkavTmiavaH9omicdhocehEaQhYxlkavcufhvaEclfgEc;ab9hmbkkdnaLceaYaOSceta8AaOSEcx2gvc;a1jjbfydbcdtfydbgKTaLavc;e1jjbfydbcdtfydbg8AceSGaLavc;i1jjbfydbcdtfydbg3cdSGaOcb9hGazGg5ce9hmbaw9cu83ibaD9cu83ibaq9cu83ibak9cu83ibax9cu83ibam9cu83ibal9cu83iwal9cu83ibcbhOkcbhEaXcufgvhodnindnalaocsGcdtfydba8A9hmbaEhYxdkcuhYaocufhoaEcefgEcz9hmbkkcbhodnindnalavcsGcdtfydba39hmbaohExdkcuhEavcufhvaocefgocz9hmbkkaOaKaOSg8EfhLdndnaYcm0mbaYcefhYxekcbcsa8AaLSgvEhYaLavfhLkdndnaEcm0mbaEcefhExekcbcsa3aLSgvEhEaLavfhLkc9:cua8EEh8FcbhvaEaYcltVgacFeGhodndndninavc:W1jjbfRbbaoSmeavcefgvcz9hmbxdkka5aKaO9havcm0VVmbasavc;WeV86bbxekasa8F86bbaeaa86bbaecefhekdna8EmbaKaA9Rgvcetavc8F917hvinaeavcFb0gocrtavcFbGV86bbavcr4hvaecefheaombkaKhAkdnaYcs9hmba8AaA9Rgvcetavc8F917hvinaeavcFb0gocrtavcFbGV86bbavcr4hvaecefheaombka8AhAkdnaEcs9hmba3aA9Rgvcetavc8F917hvinaeavcFb0gocrtavcFbGV86bbavcr4hvaecefheaombka3hAkalaXcdtfaKBdbaXcefcsGhvdndnaYPzbeeeeeeeeeeeeeebekalavcdtfa8ABdbaXcdfcsGhvkdndnaEPzbeeeeeeeeeeeeeebekalavcdtfa3BdbavcefcsGhvkcihoalc;abfaQcitfgEaKBdlaEa8ABdbaQcefcsGhYcdhEavhXaLhOxekcdhoalaXcdtfa3BdbcehEaXcefcsGhXaQhYkalc;abfaYcitfgva8ABdlava3Bdbalc;abfaQaEfcsGcitfgva3BdlavaKBdbascefhsaQaofcsGhQaCcifgCai6mbkkdnaeaP9nmbcbhvxekcbhvinaeavfavc:W1jjbfRbb86bbavcefgvcz9hmbkaeab9Ravfhvkalc;aef8KjjjjbavkZeeucbhddninadcefgdc8F0meceadtae6mbkkadcrfcFeGcr9Uci2cdfabci9U2cHfkmbcbabBd;m:kjjbk:Adewu8Jjjjjbcz9Rhlcbhvdnaicvfae0mbcbhvabcbRb;m:kjjbc;qeV86bbal9cb83iwabcefhoabaefc98fhrdnaiTmbcbhwcbhDindnaoar6mbcbskadaDcdtfydbgqalcwfawaqav9Rgvavc8F91gv7av9Rc507gwcdtfgkydb9Rgvc8E91c9:Gavcdt7awVhvinaoavcFb0gecrtavcFbGV86bbavcr4hvaocefhoaembkakaqBdbaqhvaDcefgDai9hmbkkdnaoar9nmbcbskaocbBbbaoab9RclfhvkavkBeeucbhddninadcefgdc8F0meceadtae6mbkkadcwfcFeGcr9Uab2cvfk:bvli99dui99ludnaeTmbcuadcetcuftcu7:Zhvdndncuaicuftcu7:ZgoJbbbZMgr:lJbbb9p9DTmbar:Ohwxekcjjjj94hwkcbhicbhDinalclfIdbgrJbbbbJbbjZalIdbgq:lar:lMalcwfIdbgk:lMgr:varJbbbb9BEgrNhxaqarNhrdndnakJbbbb9GTmbaxhqxekJbbjZar:l:tgqaq:maxJbbbb9GEhqJbbjZax:l:tgxax:marJbbbb9GEhrkdndnalcxfIdbgxJbbj:;axJbbj:;9GEgkJbbjZakJbbjZ9FEavNJbbbZJbbb:;axJbbbb9GEMgx:lJbbb9p9DTmbax:Ohmxekcjjjj94hmkdndnaqJbbj:;aqJbbj:;9GEgxJbbjZaxJbbjZ9FEaoNJbbbZJbbb:;aqJbbbb9GEMgq:lJbbb9p9DTmbaq:OhPxekcjjjj94hPkdndnarJbbj:;arJbbj:;9GEgqJbbjZaqJbbjZ9FEaoNJbbbZJbbb:;arJbbbb9GEMgr:lJbbb9p9DTmbar:Ohsxekcjjjj94hskdndnadcl9hmbabaifgzas86bbazcifam86bbazcdfaw86bbazcefaP86bbxekabaDfgzas87ebazcofam87ebazclfaw87ebazcdfaP87ebkalczfhlaiclfhiaDcwfhDaecufgembkkk;hlld99eud99eudnaeTmbdndncuaicuftcu7:ZgvJbbbZMgo:lJbbb9p9DTmbao:Ohixekcjjjj94hikaic;8FiGhrinabcofcicdalclfIdb:lalIdb:l9EgialcwfIdb:lalaicdtfIdb:l9EEgialcxfIdb:lalaicdtfIdb:l9EEgiarV87ebdndnJbbj:;JbbjZalaicdtfIdbJbbbb9DEgoalaicd7cdtfIdbJ;Zl:1ZNNgwJbbj:;awJbbj:;9GEgDJbbjZaDJbbjZ9FEavNJbbbZJbbb:;awJbbbb9GEMgw:lJbbb9p9DTmbaw:Ohqxekcjjjj94hqkabcdfaq87ebdndnalaicefciGcdtfIdbJ;Zl:1ZNaoNgwJbbj:;awJbbj:;9GEgDJbbjZaDJbbjZ9FEavNJbbbZJbbb:;awJbbbb9GEMgw:lJbbb9p9DTmbaw:Ohqxekcjjjj94hqkabaq87ebdndnaoalaicufciGcdtfIdbJ;Zl:1ZNNgoJbbj:;aoJbbj:;9GEgwJbbjZawJbbjZ9FEavNJbbbZJbbb:;aoJbbbb9GEMgo:lJbbb9p9DTmbao:Ohixekcjjjj94hikabclfai87ebabcwfhbalczfhlaecufgembkkk;3viDue99eu8Jjjjjbcjd9Rgo8Kjjjjbadcd4hrdndndndnavcd9hmbadcl6meaohwarhDinawc:CuBdbawclfhwaDcufgDmbkaeTmiadcl6mdarcdthqalhkcbhxinaohwakhDarhminawawydbgPcbaDIdbgs:8cL4cFeGc:cufasJbbbb9BEgzaPaz9kEBdbaDclfhDawclfhwamcufgmmbkakaqfhkaxcefgxaeSmixbkkaeTmdxekaeTmekarcdthkavce9hhqadcl6hdcbhxindndndnaqmbadmdc:CuhDalhwarhminaDcbawIdbgs:8cL4cFeGc:cufasJbbbb9BEgPaDaP9kEhDawclfhwamcufgmmbxdkkc:CuhDdndnavPleddbdkadmdaohwalhmarhPinawcbamIdbgs:8cL4cFeGgzc;:bazc;:b0Ec:cufasJbbbb9BEBdbamclfhmawclfhwaPcufgPmbxdkkadmecbhwarhminaoawfcbalawfIdbgs:8cL4cFeGgPc8AaPc8A0Ec:cufasJbbbb9BEBdbawclfhwamcufgmmbkkadmbcbhwarhPinaDhmdnavceSmbaoawfydbhmkdndnalawfIdbgscjjj;8iamai9RcefgmcLt9R::NJbbbZJbbb:;asJbbbb9GEMgs:lJbbb9p9DTmbas:Ohzxekcjjjj94hzkabawfazcFFFrGamcKtVBdbawclfhwaPcufgPmbkkabakfhbalakfhlaxcefgxae9hmbkkaocjdf8Kjjjjbk;YqdXui998Jjjjjbc:qd9Rgv8Kjjjjbavc:Sefcbc;Kbz:wjjjb8AcbhodnadTmbcbhoaiTmbdndnabaeSmbaehrxekavcuadcdtgwadcFFFFi0Ecbyd;u:kjjbHjjjjbbgrBd:SeavceBd:mdaraeawz:vjjjb8Akavc:GefcwfcbBdbav9cb83i:Geavc:Gefaradaiavc:Sefz:ojjjbavyd:GehDadci9Ugqcbyd;u:kjjbHjjjjbbheavc:Sefavyd:mdgkcdtfaeBdbavakcefgwBd:mdaecbaqz:wjjjbhxavc:SefawcdtfcuaicdtaicFFFFi0Ecbyd;u:kjjbHjjjjbbgmBdbavakcdfgPBd:mdalc;ebfhsaDheamhwinawalIdbasaeydbgzcwazcw6EcdtfIdbMUdbaeclfheawclfhwaicufgimbkavc:SefaPcdtfcuaqcdtadcFFFF970Ecbyd;u:kjjbHjjjjbbgPBdbdnadci6mbarheaPhwaqhiinawamaeydbcdtfIdbamaeclfydbcdtfIdbMamaecwfydbcdtfIdbMUdbaecxfheawclfhwaicufgimbkkakcifhoalc;ebfhHavc;qbfhOavheavyd:KehAavyd:OehCcbhzcbhwcbhXcehQinaehLcihkarawci2gKcdtfgeydbhsaeclfydbhdabaXcx2fgicwfaecwfydbgYBdbaiclfadBdbaiasBdbaxawfce86bbaOaYBdwaOadBdlaOasBdbaPawcdtfcbBdbdnazTmbcihkaLhiinaOakcdtfaiydbgeBdbakaeaY9haeas9haead9hGGfhkaiclfhiazcufgzmbkkaXcefhXcbhzinaCaAarazaKfcdtfydbcdtgifydbcdtfgYheaDaifgdydbgshidnasTmbdninaeydbawSmeaeclfheaicufgiTmdxbkkaeaYascdtfc98fydbBdbadadydbcufBdbkazcefgzci9hmbkdndnakTmbcuhwJbbbbh8Acbhdavyd:KehYavyd:OehKindndnaDaOadcdtfydbcdtgzfydbgembadcefhdxekadcs0hiamazfgsIdbhEasalcbadcefgdaiEcdtfIdbaHaecwaecw6EcdtfIdbMg3Udba3aE:th3aecdthiaKaYazfydbcdtfheinaPaeydbgzcdtfgsa3asIdbMgEUdbaEa8Aa8AaE9DgsEh8AazawasEhwaeclfheaic98fgimbkkadak9hmbkawcu9hmekaQaq9pmdindnaxaQfRbbmbaQhwxdkaqaQcefgQ9hmbxikkakczakcz6EhzaOheaLhOawcu9hmbkkaocdtavc:Seffc98fhedninaoTmeaeydbcbyd;q:kjjbH:bjjjbbaec98fheaocufhoxbkkavc:qdf8Kjjjjbk;IlevucuaicdtgvaicFFFFi0Egocbyd;u:kjjbHjjjjbbhralalyd9GgwcdtfarBdbalawcefBd9GabarBdbaocbyd;u:kjjbHjjjjbbhralalyd9GgocdtfarBdbalaocefBd9GabarBdlcuadcdtadcFFFFi0Ecbyd;u:kjjbHjjjjbbhralalyd9GgocdtfarBdbalaocefBd9GabarBdwabydbcbavz:wjjjb8Aadci9UhDdnadTmbabydbhoaehladhrinaoalydbcdtfgvavydbcefBdbalclfhlarcufgrmbkkdnaiTmbabydbhlabydlhrcbhvaihoinaravBdbarclfhralydbavfhvalclfhlaocufgombkkdnadci6mbabydlhrabydwhvcbhlinaecwfydbhoaeclfydbhdaraeydbcdtfgwawydbgwcefBdbavawcdtfalBdbaradcdtfgdadydbgdcefBdbavadcdtfalBdbaraocdtfgoaoydbgocefBdbavaocdtfalBdbaecxfheaDalcefgl9hmbkkdnaiTmbabydlheabydbhlinaeaeydbalydb9RBdbalclfhlaeclfheaicufgimbkkkQbabaeadaic;K1jjbz:njjjbkQbabaeadaic;m:jjjbz:njjjbk9DeeuabcFeaicdtz:wjjjbhlcbhbdnadTmbindnalaeydbcdtfgiydbcu9hmbaiabBdbabcefhbkaeclfheadcufgdmbkkabk:Vvioud9:du8Jjjjjbc;Wa9Rgl8Kjjjjbcbhvalcxfcbc;Kbz:wjjjb8AalcuadcitgoadcFFFFe0Ecbyd;u:kjjbHjjjjbbgrBdxalceBd2araeadaicez:tjjjbalcuaoadcjjjjoGEcbyd;u:kjjbHjjjjbbgwBdzadcdthednadTmbabhiinaiavBdbaiclfhiadavcefgv9hmbkkawaefhDalabBdwalawBdl9cbhqindnadTmbaq9cq9:hkarhvaDhiadheinaiav8Pibak1:NcFrG87ebavcwfhvaicdfhiaecufgembkkalclfaq:NceGcdtfydbhxalclfaq9ce98gq:NceGcdtfydbhmalc;Wbfcbcjaz:wjjjb8AaDhvadhidnadTmbinalc;Wbfav8VebcdtfgeaeydbcefBdbavcdfhvaicufgimbkkcbhvcbhiinalc;WbfavfgeydbhoaeaiBdbaoaifhiavclfgvcja9hmbkadhvdndnadTmbinalc;WbfaDamydbgicetf8VebcdtfgeaeydbgecefBdbaxaecdtfaiBdbamclfhmavcufgvmbkaq9cv9smdcbhvinabawydbcdtfavBdbawclfhwadavcefgv9hmbxdkkaq9cv9smekkclhvdninavc98Smealcxfavfydbcbyd;q:kjjbH:bjjjbbavc98fhvxbkkalc;Waf8Kjjjjbk:Jwliuo99iud9:cbhv8Jjjjjbca9Rgoczfcwfcbyd:8:kjjbBdbaocb8Pd:0:kjjb83izaocwfcbyd;i:kjjbBdbaocb8Pd;a:kjjb83ibaicd4hrdndnadmbJFFuFhwJFFuuhDJFFuuhqJFFuFhkJFFuuhxJFFuFhmxekarcdthPaehsincbhiinaoczfaifgzasaifIdbgwazIdbgDaDaw9EEUdbaoaifgzawazIdbgDaDaw9DEUdbaiclfgicx9hmbkasaPfhsavcefgvad9hmbkaoIdKhDaoIdwhwaoIdChqaoIdlhkaoIdzhxaoIdbhmkdnadTmbJbbbbJbFu9hJbbbbamax:tgmamJbbbb9DEgmakaq:tgkakam9DEgkawaD:tgwawak9DEgw:vawJbbbb9BEhwdnalmbarcdthoindndnaeclfIdbaq:tawNJbbbZMgk:lJbbb9p9DTmbak:Ohixekcjjjj94hikai:S9cC:ghHdndnaeIdbax:tawNJbbbZMgk:lJbbb9p9DTmbak:Ohixekcjjjj94hikaHai:S:ehHdndnaecwfIdbaD:tawNJbbbZMgk:lJbbb9p9DTmbak:Ohixekcjjjj94hikabaHai:T9cy:g:e83ibaeaofheabcwfhbadcufgdmbxdkkarcdthoindndnaeIdbax:tawNJbbbZMgk:lJbbb9p9DTmbak:Ohixekcjjjj94hikai:SgH9ca:gaH9cz:g9cjjj;4s:d:eaH9cFe:d:e9cF:bj;4:pj;ar:d9c:bd9:9c:p;G:d;4j:E;ar:d9cH9:9c;d;H:W:y:m:g;d;Hb:d9cv9:9c;j:KM;j:KM;j:Kd:dhOdndnaeclfIdbaq:tawNJbbbZMgk:lJbbb9p9DTmbak:Ohixekcjjjj94hikai:SgH9ca:gaH9cz:g9cjjj;4s:d:eaH9cFe:d:e9cF:bj;4:pj;ar:d9c:bd9:9c:p;G:d;4j:E;ar:d9cH9:9c;d;H:W:y:m:g;d;Hb:d9cq9:9cM;j:KM;j:KM;jl:daO:ehOdndnaecwfIdbaD:tawNJbbbZMgk:lJbbb9p9DTmbak:Ohixekcjjjj94hikabaOai:SgH9ca:gaH9cz:g9cjjj;4s:d:eaH9cFe:d:e9cF:bj;4:pj;ar:d9c:bd9:9c:p;G:d;4j:E;ar:d9cH9:9c;d;H:W:y:m:g;d;Hb:d9cC9:9c:KM;j:KM;j:KMD:d:e83ibaeaofheabcwfhbadcufgdmbkkk9teiucbcbyd;y:kjjbgeabcifc98GfgbBd;y:kjjbdndnabZbcztgd9nmbcuhiabad9RcFFifcz4nbcuSmekaehikaik;teeeudndnaeabVciGTmbabhixekdndnadcz9pmbabhixekabhiinaiaeydbBdbaiaeydlBdlaiaeydwBdwaiaeydxBdxaeczfheaiczfhiadc9Wfgdcs0mbkkadcl6mbinaiaeydbBdbaeclfheaiclfhiadc98fgdci0mbkkdnadTmbinaiaeRbb86bbaicefhiaecefheadcufgdmbkkabk:3eedudndnabciGTmbabhixekaecFeGc:b:c:ew2hldndnadcz9pmbabhixekabhiinaialBdxaialBdwaialBdlaialBdbaiczfhiadc9Wfgdcs0mbkkadcl6mbinaialBdbaiclfhiadc98fgdci0mbkkdnadTmbinaiae86bbaicefhiadcufgdmbkkabk9teiucbcbyd;y:kjjbgeabcrfc94GfgbBd;y:kjjbdndnabZbcztgd9nmbcuhiabad9RcFFifcz4nbcuSmekaehikaik9:eiuZbhedndncbyd;y:kjjbgdaecztgi9nmbcuheadai9RcFFifcz4nbcuSmekadhekcbabae9Rcifc98Gcbyd;y:kjjbfgdBd;y:kjjbdnadZbcztge9nmbadae9RcFFifcz4nb8Akkk;Qddbcjwk;mdbbbbdbbblbbbwbbbbbbbebbbdbbblbbbwbbbbbbbbbbbbbbbb4:h9w9N94:P:gW:j9O:ye9Pbbbbbbebbbdbbbebbbdbbbbbbbdbbbbbbbebbbbbbb:l29hZ;69:9kZ;N;76Z;rg97Z;z;o9xZ8J;B85Z;:;u9yZ;b;k9HZ:2;Z9DZ9e:l9mZ59A8KZ:r;T3Z:A:zYZ79OHZ;j4::8::Y:D9V8:bbbb9s:49:Z8R:hBZ9M9M;M8:L;z;o8:;8:PG89q;x:J878R:hQ8::M:B;e87bbbbbbjZbbjZbbjZ:E;V;N8::Y:DsZ9i;H;68:xd;R8:;h0838:;W:NoZbbbb:WV9O8:uf888:9i;H;68:9c9G;L89;n;m9m89;D8Ko8:bbbbf:8tZ9m836ZS:2AZL;zPZZ818EZ9e:lxZ;U98F8:819E;68:FFuuFFuuFFuuFFuFFFuFFFuFbc;mqkzebbbebbbdbbb9G:vbb",e=new Uint8Array([32,0,65,2,1,106,34,33,3,128,11,4,13,64,6,253,10,7,15,116,127,5,8,12,40,16,19,54,20,9,27,255,113,17,42,67,24,23,146,148,18,14,22,45,70,69,56,114,101,21,25,63,75,136,108,28,118,29,73,115]);if(typeof WebAssembly!="object")return{supported:!1};var r,a=WebAssembly.instantiate(s(t),{}).then(function(b){r=b.instance,r.exports.__wasm_call_ctors(),r.exports.meshopt_encodeVertexVersion(0),r.exports.meshopt_encodeIndexVersion(1)});function s(b){for(var h=new Uint8Array(b.length),u=0;u<b.length;++u){var m=b.charCodeAt(u);h[u]=m>96?m-97:m>64?m-39:m+4}for(var g=0,u=0;u<b.length;++u)h[g++]=h[u]<60?e[h[u]]:(h[u]-60)*64+h[++u];return h.buffer.slice(0,g)}function n(b){if(!b)throw new Error("Assertion failed")}function i(b){return new Uint8Array(b.buffer,b.byteOffset,b.byteLength)}function o(b,h,u,m){var g=r.exports.sbrk,y=g(h.length*4),x=g(u*4),v=new Uint8Array(r.exports.memory.buffer),E=i(h);v.set(E,y),m&&m(y,y,h.length,u);var S=b(x,y,h.length,u);v=new Uint8Array(r.exports.memory.buffer);var T=new Uint32Array(u);new Uint8Array(T.buffer).set(v.subarray(x,x+u*4)),E.set(v.subarray(y,y+h.length*4)),g(y-g(0));for(var _=0;_<h.length;++_)h[_]=T[h[_]];return[T,S]}function c(b,h,u,m){var g=r.exports.sbrk,y=g(u*4),x=g(u*m),v=new Uint8Array(r.exports.memory.buffer);v.set(i(h),x),b(y,x,u,m),v=new Uint8Array(r.exports.memory.buffer);var E=new Uint32Array(u);return new Uint8Array(E.buffer).set(v.subarray(y,y+u*4)),g(y-g(0)),E}function l(b,h,u,m,g){var y=r.exports.sbrk,x=y(h),v=y(m*g),E=new Uint8Array(r.exports.memory.buffer);E.set(i(u),v);var S=b(x,h,v,m,g),T=new Uint8Array(S);return T.set(E.subarray(x,x+S)),y(x-y(0)),T}function f(b){for(var h=0,u=0;u<b.length;++u){var m=b[u];h=h<m?m:h}return h}function d(b,h){if(n(h==2||h==4),h==4)return new Uint32Array(b.buffer,b.byteOffset,b.byteLength/4);var u=new Uint16Array(b.buffer,b.byteOffset,b.byteLength/2);return new Uint32Array(u)}function p(b,h,u,m,g,y,x){var v=r.exports.sbrk,E=v(u*m),S=v(u*y),T=new Uint8Array(r.exports.memory.buffer);T.set(i(h),S),b(E,u,m,g,S,x);var _=new Uint8Array(u*m);return _.set(T.subarray(E,E+u*m)),v(E-v(0)),_}return{ready:a,supported:!0,reorderMesh:function(b,h,u){var m=h?u?r.exports.meshopt_optimizeVertexCacheStrip:r.exports.meshopt_optimizeVertexCache:void 0;return o(r.exports.meshopt_optimizeVertexFetchRemap,b,f(b)+1,m)},reorderPoints:function(b,h){return n(b instanceof Float32Array),n(b.length%h==0),n(h>=3),c(r.exports.meshopt_spatialSortRemap,b,b.length/h,h*4)},encodeVertexBuffer:function(b,h,u){n(u>0&&u<=256),n(u%4==0);var m=r.exports.meshopt_encodeVertexBufferBound(h,u);return l(r.exports.meshopt_encodeVertexBuffer,m,b,h,u)},encodeIndexBuffer:function(b,h,u){n(u==2||u==4),n(h%3==0);var m=d(b,u),g=r.exports.meshopt_encodeIndexBufferBound(h,f(m)+1);return l(r.exports.meshopt_encodeIndexBuffer,g,m,h,4)},encodeIndexSequence:function(b,h,u){n(u==2||u==4);var m=d(b,u),g=r.exports.meshopt_encodeIndexSequenceBound(h,f(m)+1);return l(r.exports.meshopt_encodeIndexSequence,g,m,h,4)},encodeGltfBuffer:function(b,h,u,m){var g={ATTRIBUTES:this.encodeVertexBuffer,TRIANGLES:this.encodeIndexBuffer,INDICES:this.encodeIndexSequence};return n(g[m]),g[m](b,h,u)},encodeFilterOct:function(b,h,u,m){return n(u==4||u==8),n(m>=1&&m<=16),p(r.exports.meshopt_encodeFilterOct,b,h,u,m,16)},encodeFilterQuat:function(b,h,u,m){return n(u==8),n(m>=4&&m<=16),p(r.exports.meshopt_encodeFilterQuat,b,h,u,m,16)},encodeFilterExp:function(b,h,u,m,g){n(u>0&&u%4==0),n(m>=1&&m<=24);var y={Separate:0,SharedVector:1,SharedComponent:2,Clamped:3};return p(r.exports.meshopt_encodeFilterExp,b,h,u,m,u,g?y[g]:1)}}})();var Bs=(function(){var t="b9H79Tebbbe8Fv9Gbb9Gvuuuuueu9Giuuub9Geueu9Giuuueuikqbeeedddillviebeoweuec:W:Odkr;leDo9TW9T9VV95dbH9F9F939H79T9F9J9H229F9Jt9VV7bb8A9TW79O9V9Wt9F9KW9J9V9KW9wWVtW949c919M9MWVbeY9TW79O9V9Wt9F9KW9J9V9KW69U9KW949c919M9MWVbdE9TW79O9V9Wt9F9KW9J9V9KW69U9KW949tWG91W9U9JWbiL9TW79O9V9Wt9F9KW9J9V9KWS9P2tWV9p9JtblK9TW79O9V9Wt9F9KW9J9V9KWS9P2tWV9r919HtbvL9TW79O9V9Wt9F9KW9J9V9KWS9P2tWVT949Wbol79IV9Rbrq:S86qdbk;jYi5ud9:du8Jjjjjbcj;kb9Rgv8Kjjjjbc9:hodnalTmbcuhoaiRbbgrc;WeGc:Ge9hmbarcsGgwce0mbc9:hoalcufadcd4cbawEgDadfgrcKcaawEgqaraq0Egk6mbaicefhxcj;abad9Uc;WFbGcjdadca0EhmaialfgPar9Rgoadfhsavaoadz1jjjbgzceVhHcbhOdndninaeaO9nmeaPax9RaD6mdamaeaO9RaOamfgoae6EgAcsfglc9WGhCabaOad2fhXaAcethQaxaDfhiaOaeaoaeao6E9RhLalcl4cifcd4hKazcj;cbfaAfhYcbh8AazcjdfhEaHh3incbhodnawTmbaxa8Acd4fRbbhokaocFeGh5cbh8Eazcj;cbfhqinaih8Fdndndndna5a8Ecet4ciGgoc9:fPdebdkaPa8F9RaA6mrazcj;cbfa8EaA2fa8FaAz1jjjb8Aa8FaAfhixdkazcj;cbfa8EaA2fcbaAz:jjjjb8Aa8FhixekaPa8F9RaK6mva8FaKfhidnaCTmbaPai9RcK6mbaocdtc:q1jjbfcj1jjbawEhaczhrcbhlinargoc9Wfghaqfhrdndndndndndnaaa8Fahco4fRbbalcoG4ciGcdtfydbPDbedvivvvlvkar9cb83bbarcwf9cb83bbxlkarcbaiRbdai8Xbb9c:c:qj:bw9:9c:q;c1:I1e:d9c:b:c:e1z9:gg9cjjjjjz:dg8J9qE86bbaqaofgrcGfag9c8F1:NghcKtc8F91aicdfa8J9c8N1:Nfg8KRbbG86bbarcVfcba8KahcjeGcr4fghRbbag9cjjjjjl:dg8J9qE86bbarc7fcbaha8J9c8L1:NfghRbbag9cjjjjjd:dg8J9qE86bbarctfcbaha8J9c8K1:NfghRbbag9cjjjjje:dg8J9qE86bbarc91fcbaha8J9c8J1:NfghRbbag9cjjjj;ab:dg8J9qE86bbarc4fcbaha8J9cg1:NfghRbbag9cjjjja:dg8J9qE86bbarc93fcbaha8J9ch1:NfghRbbag9cjjjjz:dgg9qE86bbarc94fcbahag9ca1:NfghRbbai8Xbe9c:c:qj:bw9:9c:q;c1:I1e:d9c:b:c:e1z9:gg9cjjjjjz:dg8J9qE86bbarc95fag9c8F1:NgicKtc8F91aha8J9c8N1:NfghRbbG86bbarc96fcbahaicjeGcr4fgiRbbag9cjjjjjl:dg8J9qE86bbarc97fcbaia8J9c8L1:NfgiRbbag9cjjjjjd:dg8J9qE86bbarc98fcbaia8J9c8K1:NfgiRbbag9cjjjjje:dg8J9qE86bbarc99fcbaia8J9c8J1:NfgiRbbag9cjjjj;ab:dg8J9qE86bbarc9:fcbaia8J9cg1:NfgiRbbag9cjjjja:dg8J9qE86bbarcufcbaia8J9ch1:NfgiRbbag9cjjjjz:dgg9qE86bbaiag9ca1:NfhixikaraiRblaiRbbghco4g8Ka8KciSg8KE86bbaqaofgrcGfaiclfa8Kfg8KRbbahcl4ciGg8La8LciSg8LE86bbarcVfa8Ka8Lfg8KRbbahcd4ciGg8La8LciSg8LE86bbarc7fa8Ka8Lfg8KRbbahciGghahciSghE86bbarctfa8Kahfg8KRbbaiRbeghco4g8La8LciSg8LE86bbarc91fa8Ka8Lfg8KRbbahcl4ciGg8La8LciSg8LE86bbarc4fa8Ka8Lfg8KRbbahcd4ciGg8La8LciSg8LE86bbarc93fa8Ka8Lfg8KRbbahciGghahciSghE86bbarc94fa8Kahfg8KRbbaiRbdghco4g8La8LciSg8LE86bbarc95fa8Ka8Lfg8KRbbahcl4ciGg8La8LciSg8LE86bbarc96fa8Ka8Lfg8KRbbahcd4ciGg8La8LciSg8LE86bbarc97fa8Ka8Lfg8KRbbahciGghahciSghE86bbarc98fa8KahfghRbbaiRbigico4g8Ka8KciSg8KE86bbarc99faha8KfghRbbaicl4ciGg8Ka8KciSg8KE86bbarc9:faha8KfghRbbaicd4ciGg8Ka8KciSg8KE86bbarcufaha8KfgrRbbaiciGgiaiciSgiE86bbaraifhixdkaraiRbwaiRbbghcl4g8Ka8KcsSg8KE86bbaqaofgrcGfaicwfa8Kfg8KRbbahcsGghahcsSghE86bbarcVfa8KahfghRbbaiRbeg8Kcl4g8La8LcsSg8LE86bbarc7faha8LfghRbba8KcsGg8Ka8KcsSg8KE86bbarctfaha8KfghRbbaiRbdg8Kcl4g8La8LcsSg8LE86bbarc91faha8LfghRbba8KcsGg8Ka8KcsSg8KE86bbarc4faha8KfghRbbaiRbig8Kcl4g8La8LcsSg8LE86bbarc93faha8LfghRbba8KcsGg8Ka8KcsSg8KE86bbarc94faha8KfghRbbaiRblg8Kcl4g8La8LcsSg8LE86bbarc95faha8LfghRbba8KcsGg8Ka8KcsSg8KE86bbarc96faha8KfghRbbaiRbvg8Kcl4g8La8LcsSg8LE86bbarc97faha8LfghRbba8KcsGg8Ka8KcsSg8KE86bbarc98faha8KfghRbbaiRbog8Kcl4g8La8LcsSg8LE86bbarc99faha8LfghRbba8KcsGg8Ka8KcsSg8KE86bbarc9:faha8KfghRbbaiRbrgicl4g8Ka8KcsSg8KE86bbarcufaha8KfgrRbbaicsGgiaicsSgiE86bbaraifhixekarai8Pbb83bbarcwfaicwf8Pbb83bbaiczfhikdnaoaC9pmbalcdfhlaoczfhraPai9RcL0mekkaoaC6moaimexokaCmva8FTmvkaqaAfhqa8Ecefg8Ecl9hmbkdndndndnawTmbasa8Acd4fRbbgociGPlbedrbkaATmdaza8Afh8Fazcj;cbfhhcbh8EaEhaina8FRbbhraahocbhlinaoahalfRbbgqce4cbaqceG9R7arfgr86bbaoadfhoaAalcefgl9hmbkaacefhaa8Fcefh8FahaAfhha8Ecefg8Ecl9hmbxikkaATmeaza8Afhaazcj;cbfhhcbhoceh8EaYh8FinaEaofhlaa8Vbbhrcbhoinala8FaofRbbcwtahaofRbbgqVc;:FiGce4cbaqceG9R7arfgr87bbaladfhlaLaocefgofmbka8FaQfh8FcdhoaacdfhaahaQfhha8EceGhlcbh8EalmbxdkkaATmbcbaocl49Rh8Eaza8AfRbbhqcwhoa3hlinalRbbaotaqVhqalcefhlaocwfgoca9hmbkcbhhaEh8FaYhainazcj;cbfahfRbbhrcwhoaahlinalRbbaotarVhralaAfhlaocwfgoca9hmbkara8E93aq7hqcbhoa8Fhlinalaqao486bbalcefhlaocwfgoca9hmbka8Fadfh8FaacefhaahcefghaA9hmbkkaEclfhEa3clfh3a8Aclfg8Aad6mbkaXazcjdfaAad2z1jjjb8AazazcjdfaAcufad2fadz1jjjb8AaAaOfhOaihxaimbkc9:hoxdkcbc99aPax9RakSEhoxekc9:hokavcj;kbf8Kjjjjbaok:XseHu8Jjjjjbc;ae9Rgv8Kjjjjbc9:hodnaeci9UgrcHfal0mbcuhoaiRbbgwc;WeGc;Ge9hmbawcsGgDce0mbavc;abfcFecjez:jjjjb8AavcUf9cu83ibavc8Wf9cu83ibavcyf9cu83ibavcaf9cu83ibavcKf9cu83ibavczf9cu83ibav9cu83iwav9cu83ibaialfc9WfhqaicefgwarfhldnaeTmbcmcsaDceSEhkcbhxcbhmcbhrcbhicbhoindnalaq9nmbc9:hoxikdndnawRbbgDc;Ve0mbavc;abfaoaDcu7gPcl4fcsGcitfgsydlhzasydbhHdndnaDcsGgsak9pmbavaiaPfcsGcdtfydbaxasEhDaxasTgOfhxxekdndnascsSmbcehOasc987asamffcefhDxekalcefhDal8SbbgscFeGhPdndnascu9mmbaDhlxekalcvfhlaPcFbGhPcrhsdninaD8SbbgOcFbGastaPVhPaOcu9kmeaDcefhDascrfgsc8J9hmbxdkkaDcefhlkcehOaPce4cbaPceG9R7amfhDkaDhmkavc;abfaocitfgsaDBdbasazBdlavaicdtfaDBdbavc;abfaocefcsGcitfgsaHBdbasaDBdlaocdfhoaOaifhidnadcd9hmbabarcetfgsaH87ebasclfaD87ebascdfaz87ebxdkabarcdtfgsaHBdbascwfaDBdbasclfazBdbxekdnaDcpe0mbaxcefgOavaiaqaDcsGfRbbgscl49RcsGcdtfydbascz6gPEhDavaias9RcsGcdtfydbaOaPfgzascsGgOEhsaOThOdndnadcd9hmbabarcetfgHax87ebaHclfas87ebaHcdfaD87ebxekabarcdtfgHaxBdbaHcwfasBdbaHclfaDBdbkavaicdtfaxBdbavc;abfaocitfgHaDBdbaHaxBdlavaicefgicsGcdtfaDBdbavc;abfaocefcsGcitfgHasBdbaHaDBdlavaiaPfgicsGcdtfasBdbavc;abfaocdfcsGcitfgDaxBdbaDasBdlaocifhoaiaOfhiazaOfhxxekaxcbalRbbgHEgAaDc;:eSgDfhzaHcsGhCaHcl4hXdndnaHcs0mbazcefhOxekazhOavaiaX9RcsGcdtfydbhzkdndnaCmbaOcefhxxekaOhxavaiaH9RcsGcdtfydbhOkdndnaDTmbalcefhDxekalcdfhDal8SbegPcFeGhsdnaPcu9kmbalcofhAascFbGhscrhldninaD8SbbgPcFbGaltasVhsaPcu9kmeaDcefhDalcrfglc8J9hmbkaAhDxekaDcefhDkasce4cbasceG9R7amfgmhAkdndnaXcsSmbaDhsxekaDcefhsaD8SbbglcFeGhPdnalcu9kmbaDcvfhzaPcFbGhPcrhldninas8SbbgDcFbGaltaPVhPaDcu9kmeascefhsalcrfglc8J9hmbkazhsxekascefhskaPce4cbaPceG9R7amfgmhzkdndnaCcsSmbashlxekascefhlas8SbbgDcFeGhPdnaDcu9kmbascvfhOaPcFbGhPcrhDdninal8SbbgscFbGaDtaPVhPascu9kmealcefhlaDcrfgDc8J9hmbkaOhlxekalcefhlkaPce4cbaPceG9R7amfgmhOkdndnadcd9hmbabarcetfgDaA87ebaDclfaO87ebaDcdfaz87ebxekabarcdtfgDaABdbaDcwfaOBdbaDclfazBdbkavc;abfaocitfgDazBdbaDaABdlavaicdtfaABdbavc;abfaocefcsGcitfgDaOBdbaDazBdlavaicefgicsGcdtfazBdbavc;abfaocdfcsGcitfgDaABdbaDaOBdlavaiaHcz6aXcsSVfgicsGcdtfaOBdbaiaCTaCcsSVfhiaocifhokawcefhwaocsGhoaicsGhiarcifgrae6mbkkcbc99alaqSEhokavc;aef8Kjjjjbaok:clevu8Jjjjjbcz9Rhvdnaecvfal9nmbc9:skdnaiRbbc;:eGc;qeSmbcuskav9cb83iwaicefhoaialfc98fhrdnaeTmbdnadcdSmbcbhwindnaoar6mbc9:skaocefhlao8SbbgicFeGhddndnaicu9mmbalhoxekaocvfhoadcFbGhdcrhidninal8SbbgDcFbGaitadVhdaDcu9kmealcefhlaicrfgic8J9hmbxdkkalcefhokabawcdtfadc8Etc8F91adcd47avcwfadceGcdtVglydbfgiBdbalaiBdbawcefgwae9hmbxdkkcbhwindnaoar6mbc9:skaocefhlao8SbbgicFeGhddndnaicu9mmbalhoxekaocvfhoadcFbGhdcrhidninal8SbbgDcFbGaitadVhdaDcu9kmealcefhlaicrfgic8J9hmbxdkkalcefhokabawcetfadc8Etc8F91adcd47avcwfadceGcdtVglydbfgi87ebalaiBdbawcefgwae9hmbkkcbc99aoarSEk:Lvoeue99dud99eud99dndnadcl9hmbaeTmeindndnabcdfgd8Sbb:Yab8Sbbgi:Ygl:l:tabcefgv8Sbbgo:Ygr:l:tgwJbb;:9cawawNJbbbbawawJbbbb9GgDEgq:mgkaqaicb9iEalMgwawNakaqaocb9iEarMgqaqNMM:r:vglNJbbbZJbbb:;aDEMgr:lJbbb9p9DTmbar:Ohixekcjjjj94hikadai86bbdndnaqalNJbbbZJbbb:;aqJbbbb9GEMgq:lJbbb9p9DTmbaq:Ohdxekcjjjj94hdkavad86bbdndnawalNJbbbZJbbb:;awJbbbb9GEMgw:lJbbb9p9DTmbaw:Ohdxekcjjjj94hdkabad86bbabclfhbaecufgembxdkkaeTmbindndnabclfgd8Ueb:Yab8Uebgi:Ygl:l:tabcdfgv8Uebgo:Ygr:l:tgwJb;:FSawawNJbbbbawawJbbbb9GgDEgq:mgkaqaicb9iEalMgwawNakaqaocb9iEarMgqaqNMM:r:vglNJbbbZJbbb:;aDEMgr:lJbbb9p9DTmbar:Ohixekcjjjj94hikadai87ebdndnaqalNJbbbZJbbb:;aqJbbbb9GEMgq:lJbbb9p9DTmbaq:Ohdxekcjjjj94hdkavad87ebdndnawalNJbbbZJbbb:;awJbbbb9GEMgw:lJbbb9p9DTmbaw:Ohdxekcjjjj94hdkabad87ebabcwfhbaecufgembkkk;oiliui99iue99dnaeTmbcbhiabhlindndnJ;Zl81Zalcof8UebgvciV:Y:vgoal8Ueb:YNgrJb;:FSNJbbbZJbbb:;arJbbbb9GEMgw:lJbbb9p9DTmbaw:OhDxekcjjjj94hDkalclf8Uebhqalcdf8UebhkabaiavcefciGfcetfaD87ebdndnaoak:YNgwJb;:FSNJbbbZJbbb:;awJbbbb9GEMgx:lJbbb9p9DTmbax:OhDxekcjjjj94hDkabaiavciGfgkcd7cetfaD87ebdndnaoaq:YNgoJb;:FSNJbbbZJbbb:;aoJbbbb9GEMgx:lJbbb9p9DTmbax:OhDxekcjjjj94hDkabaiavcufciGfcetfaD87ebdndnJbbjZararN:tawawN:taoaoN:tgrJbbbbarJbbbb9GE:rJb;:FSNJbbbZMgr:lJbbb9p9DTmbar:Ohvxekcjjjj94hvkabakcetfav87ebalcwfhlaiclfhiaecufgembkkk9mbdnadcd4ae2gdTmbinababydbgecwtcw91:Yaece91cjjj98Gcjjj;8if::NUdbabclfhbadcufgdmbkkk9teiucbcbyd:K1jjbgeabcifc98GfgbBd:K1jjbdndnabZbcztgd9nmbcuhiabad9RcFFifcz4nbcuSmekaehikaik;teeeudndnaeabVciGTmbabhixekdndnadcz9pmbabhixekabhiinaiaeydbBdbaiaeydlBdlaiaeydwBdwaiaeydxBdxaeczfheaiczfhiadc9Wfgdcs0mbkkadcl6mbinaiaeydbBdbaeclfheaiclfhiadc98fgdci0mbkkdnadTmbinaiaeRbb86bbaicefhiaecefheadcufgdmbkkabk:3eedudndnabciGTmbabhixekaecFeGc:b:c:ew2hldndnadcz9pmbabhixekabhiinaialBdxaialBdwaialBdlaialBdbaiczfhiadc9Wfgdcs0mbkkadcl6mbinaialBdbaiclfhiadc98fgdci0mbkkdnadTmbinaiae86bbaicefhiadcufgdmbkkabkk81dbcjwk8Kbbbbdbbblbbbwbbbbbbbebbbdbbblbbbwbbbbc:Kwkl8WNbb",e="b9H79TebbbeKl9Gbb9Gvuuuuueu9Giuuub9Geueuikqbbebeedddilve9Weeeviebeoweuec:q:6dkr;leDo9TW9T9VV95dbH9F9F939H79T9F9J9H229F9Jt9VV7bb8A9TW79O9V9Wt9F9KW9J9V9KW9wWVtW949c919M9MWVbdY9TW79O9V9Wt9F9KW9J9V9KW69U9KW949c919M9MWVblE9TW79O9V9Wt9F9KW9J9V9KW69U9KW949tWG91W9U9JWbvL9TW79O9V9Wt9F9KW9J9V9KWS9P2tWV9p9JtboK9TW79O9V9Wt9F9KW9J9V9KWS9P2tWV9r919HtbrL9TW79O9V9Wt9F9KW9J9V9KWS9P2tWVT949Wbwl79IV9RbDq;G9Mqlbzik9:evu8Jjjjjbcz9Rhbcbheincbhdcbhiinabcwfadfaicjuaead4ceGglE86bbaialfhiadcefgdcw9hmbkaec:q:yjjbfai86bbaecitc:q1jjbfab8Piw83ibaecefgecjd9hmbkk:183lYud97dur978Jjjjjbcj;kb9Rgv8Kjjjjbc9:hodnalTmbcuhoaiRbbgrc;WeGc:Ge9hmbarcsGgwce0mbc9:hoalcufadcd4cbawEgDadfgrcKcaawEgqaraq0Egk6mbaicefhxavaialfgmar9Rgoad;8qbbcj;abad9Uc;WFbGcjdadca0EhPdndndnadTmbaoadfhscbhzinaeaz9nmdamax9RaD6miabazad2fhHaxaDfhOaPaeaz9RazaPfae6EgAcsfgocl4cifcd4hCavcj;cbfaoc9WGgXcetfhQavcj;cbfaXci2fhLavcj;cbfaXfhKcbhYaoc;ab6h8AincbhodnawTmbaxaYcd4fRbbhokaocFeGhEcbh3avcj;cbfh5indndndndnaEa3cet4ciGgoc9:fPdebdkamaO9RaX6mwavcj;cbfa3aX2faOaX;8qbbaOaAfhOxdkavcj;cbfa3aX2fcbaX;8kbxekamaO9RaC6moaoclVcbawEhraOaCfhocbhidna8Ambamao9Rc;Gb6mbcbhlina5alfhidndndndndndnaOalco4fRbbgqciGarfPDbedibledibkaipxbbbbbbbbbbbbbbbbpklbxlkaiaopbblaopbbbg8Eclp:mea8EpmbzeHdOiAlCvXoQrLg8Ecdp:mea8EpmbzeHdOiAlCvXoQrLpxiiiiiiiiiiiiiiiip9og8Fpxiiiiiiiiiiiiiiiip8Jg8Ep5b9cjF;8;4;W;G;ab9:9cU1:Ngacitc:q1jjbfpbibaac:q:yjjbfRbbgapsa8Ep5e9cjF;8;4;W;G;ab9:9cU1:Nghcitc:q1jjbfpbibp9UpmbedilvorzHOACXQLpPa8Fa8Ep9spklbaaaoclffahc:q:yjjbfRbbfhoxikaiaopbbwaopbbbg8Eclp:mea8EpmbzeHdOiAlCvXoQrLpxssssssssssssssssp9og8Fpxssssssssssssssssp8Jg8Ep5b9cjF;8;4;W;G;ab9:9cU1:Ngacitc:q1jjbfpbibaac:q:yjjbfRbbgapsa8Ep5e9cjF;8;4;W;G;ab9:9cU1:Nghcitc:q1jjbfpbibp9UpmbedilvorzHOACXQLpPa8Fa8Ep9spklbaaaocwffahc:q:yjjbfRbbfhoxdkaiaopbbbpklbaoczfhoxekaiaopbbdaoRbbgacitc:q1jjbfpbibaac:q:yjjbfRbbgapsaoRbeghcitc:q1jjbfpbibp9UpmbedilvorzHOACXQLpPpklbaaaocdffahc:q:yjjbfRbbfhokdndndndndndnaqcd4ciGarfPDbedibledibkaiczfpxbbbbbbbbbbbbbbbbpklbxlkaiczfaopbblaopbbbg8Eclp:mea8EpmbzeHdOiAlCvXoQrLg8Ecdp:mea8EpmbzeHdOiAlCvXoQrLpxiiiiiiiiiiiiiiiip9og8Fpxiiiiiiiiiiiiiiiip8Jg8Ep5b9cjF;8;4;W;G;ab9:9cU1:Ngacitc:q1jjbfpbibaac:q:yjjbfRbbgapsa8Ep5e9cjF;8;4;W;G;ab9:9cU1:Nghcitc:q1jjbfpbibp9UpmbedilvorzHOACXQLpPa8Fa8Ep9spklbaaaoclffahc:q:yjjbfRbbfhoxikaiczfaopbbwaopbbbg8Eclp:mea8EpmbzeHdOiAlCvXoQrLpxssssssssssssssssp9og8Fpxssssssssssssssssp8Jg8Ep5b9cjF;8;4;W;G;ab9:9cU1:Ngacitc:q1jjbfpbibaac:q:yjjbfRbbgapsa8Ep5e9cjF;8;4;W;G;ab9:9cU1:Nghcitc:q1jjbfpbibp9UpmbedilvorzHOACXQLpPa8Fa8Ep9spklbaaaocwffahc:q:yjjbfRbbfhoxdkaiczfaopbbbpklbaoczfhoxekaiczfaopbbdaoRbbgacitc:q1jjbfpbibaac:q:yjjbfRbbgapsaoRbeghcitc:q1jjbfpbibp9UpmbedilvorzHOACXQLpPpklbaaaocdffahc:q:yjjbfRbbfhokdndndndndndnaqcl4ciGarfPDbedibledibkaicafpxbbbbbbbbbbbbbbbbpklbxlkaicafaopbblaopbbbg8Eclp:mea8EpmbzeHdOiAlCvXoQrLg8Ecdp:mea8EpmbzeHdOiAlCvXoQrLpxiiiiiiiiiiiiiiiip9og8Fpxiiiiiiiiiiiiiiiip8Jg8Ep5b9cjF;8;4;W;G;ab9:9cU1:Ngacitc:q1jjbfpbibaac:q:yjjbfRbbgapsa8Ep5e9cjF;8;4;W;G;ab9:9cU1:Nghcitc:q1jjbfpbibp9UpmbedilvorzHOACXQLpPa8Fa8Ep9spklbaaaoclffahc:q:yjjbfRbbfhoxikaicafaopbbwaopbbbg8Eclp:mea8EpmbzeHdOiAlCvXoQrLpxssssssssssssssssp9og8Fpxssssssssssssssssp8Jg8Ep5b9cjF;8;4;W;G;ab9:9cU1:Ngacitc:q1jjbfpbibaac:q:yjjbfRbbgapsa8Ep5e9cjF;8;4;W;G;ab9:9cU1:Nghcitc:q1jjbfpbibp9UpmbedilvorzHOACXQLpPa8Fa8Ep9spklbaaaocwffahc:q:yjjbfRbbfhoxdkaicafaopbbbpklbaoczfhoxekaicafaopbbdaoRbbgacitc:q1jjbfpbibaac:q:yjjbfRbbgapsaoRbeghcitc:q1jjbfpbibp9UpmbedilvorzHOACXQLpPpklbaaaocdffahc:q:yjjbfRbbfhokdndndndndndnaqco4arfPDbedibledibkaic8Wfpxbbbbbbbbbbbbbbbbpklbxlkaic8Wfaopbblaopbbbg8Eclp:mea8EpmbzeHdOiAlCvXoQrLg8Ecdp:mea8EpmbzeHdOiAlCvXoQrLpxiiiiiiiiiiiiiiiip9og8Fpxiiiiiiiiiiiiiiiip8Jg8Ep5b9cjF;8;4;W;G;ab9:9cU1:Ngicitc:q1jjbfpbibaic:q:yjjbfRbbgipsa8Ep5e9cjF;8;4;W;G;ab9:9cU1:Ngqcitc:q1jjbfpbibp9UpmbedilvorzHOACXQLpPa8Fa8Ep9spklbaiaoclffaqc:q:yjjbfRbbfhoxikaic8Wfaopbbwaopbbbg8Eclp:mea8EpmbzeHdOiAlCvXoQrLpxssssssssssssssssp9og8Fpxssssssssssssssssp8Jg8Ep5b9cjF;8;4;W;G;ab9:9cU1:Ngicitc:q1jjbfpbibaic:q:yjjbfRbbgipsa8Ep5e9cjF;8;4;W;G;ab9:9cU1:Ngqcitc:q1jjbfpbibp9UpmbedilvorzHOACXQLpPa8Fa8Ep9spklbaiaocwffaqc:q:yjjbfRbbfhoxdkaic8Wfaopbbbpklbaoczfhoxekaic8WfaopbbdaoRbbgicitc:q1jjbfpbibaic:q:yjjbfRbbgipsaoRbegqcitc:q1jjbfpbibp9UpmbedilvorzHOACXQLpPpklbaiaocdffaqc:q:yjjbfRbbfhokalc;abfhialcjefaX0meaihlamao9Rc;Fb0mbkkdnaiaX9pmbaici4hlinamao9RcK6mwa5aifhqdndndndndndnaOaico4fRbbalcoG4ciGarfPDbedibledibkaqpxbbbbbbbbbbbbbbbbpkbbxlkaqaopbblaopbbbg8Eclp:mea8EpmbzeHdOiAlCvXoQrLg8Ecdp:mea8EpmbzeHdOiAlCvXoQrLpxiiiiiiiiiiiiiiiip9og8Fpxiiiiiiiiiiiiiiiip8Jg8Ep5b9cjF;8;4;W;G;ab9:9cU1:Ngacitc:q1jjbfpbibaac:q:yjjbfRbbgapsa8Ep5e9cjF;8;4;W;G;ab9:9cU1:Nghcitc:q1jjbfpbibp9UpmbedilvorzHOACXQLpPa8Fa8Ep9spkbbaaaoclffahc:q:yjjbfRbbfhoxikaqaopbbwaopbbbg8Eclp:mea8EpmbzeHdOiAlCvXoQrLpxssssssssssssssssp9og8Fpxssssssssssssssssp8Jg8Ep5b9cjF;8;4;W;G;ab9:9cU1:Ngacitc:q1jjbfpbibaac:q:yjjbfRbbgapsa8Ep5e9cjF;8;4;W;G;ab9:9cU1:Nghcitc:q1jjbfpbibp9UpmbedilvorzHOACXQLpPa8Fa8Ep9spkbbaaaocwffahc:q:yjjbfRbbfhoxdkaqaopbbbpkbbaoczfhoxekaqaopbbdaoRbbgacitc:q1jjbfpbibaac:q:yjjbfRbbgapsaoRbeghcitc:q1jjbfpbibp9UpmbedilvorzHOACXQLpPpkbbaaaocdffahc:q:yjjbfRbbfhokalcdfhlaiczfgiaX6mbkkaohOaoTmoka5aXfh5a3cefg3cl9hmbkdndndndnawTmbasaYcd4fRbbglciGPlbedwbkaXTmdavcjdfaYfhlavaYfpbdbhgcbhoinalavcj;cbfaofpblbg8JaKaofpblbg8KpmbzeHdOiAlCvXoQrLg8LaQaofpblbg8MaLaofpblbg8NpmbzeHdOiAlCvXoQrLgypmbezHdiOAlvCXorQLg8Ecep9Ta8Epxeeeeeeeeeeeeeeeeg8Fp9op9Hp9rg8Eagp9Uggp9Abbbaladfglaga8Ea8Epmlvorlvorlvorlvorp9Uggp9Abbbaladfglaga8Ea8EpmwDqkwDqkwDqkwDqkp9Uggp9Abbbaladfglaga8Ea8EpmxmPsxmPsxmPsxmPsp9Uggp9Abbbaladfglaga8LaypmwDKYqk8AExm35Ps8E8Fg8Ecep9Ta8Ea8Fp9op9Hp9rg8Ep9Uggp9Abbbaladfglaga8Ea8Epmlvorlvorlvorlvorp9Uggp9Abbbaladfglaga8Ea8EpmwDqkwDqkwDqkwDqkp9Uggp9Abbbaladfglaga8Ea8EpmxmPsxmPsxmPsxmPsp9Uggp9Abbbaladfglaga8Ja8KpmwKDYq8AkEx3m5P8Es8Fg8Ja8Ma8NpmwKDYq8AkEx3m5P8Es8Fg8KpmbezHdiOAlvCXorQLg8Ecep9Ta8Ea8Fp9op9Hp9rg8Ep9Uggp9Abbbaladfglaga8Ea8Epmlvorlvorlvorlvorp9Uggp9Abbbaladfglaga8Ea8EpmwDqkwDqkwDqkwDqkp9Uggp9Abbbaladfglaga8Ea8EpmxmPsxmPsxmPsxmPsp9Uggp9Abbbaladfglaga8Ja8KpmwDKYqk8AExm35Ps8E8Fg8Ecep9Ta8Ea8Fp9op9Hp9rg8Ep9Ug8Fp9Abbbaladfgla8Fa8Ea8Epmlvorlvorlvorlvorp9Ug8Fp9Abbbaladfgla8Fa8Ea8EpmwDqkwDqkwDqkwDqkp9Ug8Fp9Abbbaladfgla8Fa8Ea8EpmxmPsxmPsxmPsxmPsp9Uggp9AbbbaladfhlaoczfgoaX6mbxikkaXTmeavcjdfaYfhlavaYfpbdbhgcbhoinalavcj;cbfaofpblbg8JaKaofpblbg8KpmbzeHdOiAlCvXoQrLg8LaQaofpblbg8MaLaofpblbg8NpmbzeHdOiAlCvXoQrLgypmbezHdiOAlvCXorQLg8Ecep:nea8Epxebebebebebebebebg8Fp9op:bep9rg8Eagp:oeggp9Abbbaladfglaga8Ea8Epmlvorlvorlvorlvorp:oeggp9Abbbaladfglaga8Ea8EpmwDqkwDqkwDqkwDqkp:oeggp9Abbbaladfglaga8Ea8EpmxmPsxmPsxmPsxmPsp:oeggp9Abbbaladfglaga8LaypmwDKYqk8AExm35Ps8E8Fg8Ecep:nea8Ea8Fp9op:bep9rg8Ep:oeggp9Abbbaladfglaga8Ea8Epmlvorlvorlvorlvorp:oeggp9Abbbaladfglaga8Ea8EpmwDqkwDqkwDqkwDqkp:oeggp9Abbbaladfglaga8Ea8EpmxmPsxmPsxmPsxmPsp:oeggp9Abbbaladfglaga8Ja8KpmwKDYq8AkEx3m5P8Es8Fg8Ja8Ma8NpmwKDYq8AkEx3m5P8Es8Fg8KpmbezHdiOAlvCXorQLg8Ecep:nea8Ea8Fp9op:bep9rg8Ep:oeggp9Abbbaladfglaga8Ea8Epmlvorlvorlvorlvorp:oeggp9Abbbaladfglaga8Ea8EpmwDqkwDqkwDqkwDqkp:oeggp9Abbbaladfglaga8Ea8EpmxmPsxmPsxmPsxmPsp:oeggp9Abbbaladfglaga8Ja8KpmwDKYqk8AExm35Ps8E8Fg8Ecep:nea8Ea8Fp9op:bep9rg8Ep:oeg8Fp9Abbbaladfgla8Fa8Ea8Epmlvorlvorlvorlvorp:oeg8Fp9Abbbaladfgla8Fa8Ea8EpmwDqkwDqkwDqkwDqkp:oeg8Fp9Abbbaladfgla8Fa8Ea8EpmxmPsxmPsxmPsxmPsp:oeggp9AbbbaladfhlaoczfgoaX6mbxdkkaXTmbcbhocbalcl4gl9Rc8FGhiavcjdfaYfhravaYfpbdbh8Finaravcj;cbfaofpblbggaKaofpblbg8JpmbzeHdOiAlCvXoQrLg8KaQaofpblbg8LaLaofpblbg8MpmbzeHdOiAlCvXoQrLg8NpmbezHdiOAlvCXorQLg8Eaip:Rea8Ealp:Sep9qg8Ea8Fp9rg8Fp9Abbbaradfgra8Fa8Ea8Epmlvorlvorlvorlvorp9rg8Fp9Abbbaradfgra8Fa8Ea8EpmwDqkwDqkwDqkwDqkp9rg8Fp9Abbbaradfgra8Fa8Ea8EpmxmPsxmPsxmPsxmPsp9rg8Fp9Abbbaradfgra8Fa8Ka8NpmwDKYqk8AExm35Ps8E8Fg8Eaip:Rea8Ealp:Sep9qg8Ep9rg8Fp9Abbbaradfgra8Fa8Ea8Epmlvorlvorlvorlvorp9rg8Fp9Abbbaradfgra8Fa8Ea8EpmwDqkwDqkwDqkwDqkp9rg8Fp9Abbbaradfgra8Fa8Ea8EpmxmPsxmPsxmPsxmPsp9rg8Fp9Abbbaradfgra8Faga8JpmwKDYq8AkEx3m5P8Es8Fgga8La8MpmwKDYq8AkEx3m5P8Es8Fg8JpmbezHdiOAlvCXorQLg8Eaip:Rea8Ealp:Sep9qg8Ep9rg8Fp9Abbbaradfgra8Fa8Ea8Epmlvorlvorlvorlvorp9rg8Fp9Abbbaradfgra8Fa8Ea8EpmwDqkwDqkwDqkwDqkp9rg8Fp9Abbbaradfgra8Fa8Ea8EpmxmPsxmPsxmPsxmPsp9rg8Fp9Abbbaradfgra8Faga8JpmwDKYqk8AExm35Ps8E8Fg8Eaip:Rea8Ealp:Sep9qg8Ep9rg8Fp9Abbbaradfgra8Fa8Ea8Epmlvorlvorlvorlvorp9rg8Fp9Abbbaradfgra8Fa8Ea8EpmwDqkwDqkwDqkwDqkp9rg8Fp9Abbbaradfgra8Fa8Ea8EpmxmPsxmPsxmPsxmPsp9rg8Fp9AbbbaradfhraoczfgoaX6mbkkaYclfgYad6mbkaHavcjdfaAad2;8qbbavavcjdfaAcufad2fad;8qbbaAazfhzc9:hoaOhxaOmbxlkkaeTmbaDalfhrcbhocuhlinaralaD9RglfaD6mdaPaeao9RaoaPfae6Eaofgoae6mbkaial9Rhxkcbc99amax9RakSEhoxekc9:hokavcj;kbf8Kjjjjbaokwbz:bjjjbk:TseHu8Jjjjjbc;ae9Rgv8Kjjjjbc9:hodnaeci9UgrcHfal0mbcuhoaiRbbgwc;WeGc;Ge9hmbawcsGgDce0mbavc;abfcFecje;8kbavcUf9cu83ibavc8Wf9cu83ibavcyf9cu83ibavcaf9cu83ibavcKf9cu83ibavczf9cu83ibav9cu83iwav9cu83ibaialfc9WfhqaicefgwarfhldnaeTmbcmcsaDceSEhkcbhxcbhmcbhrcbhicbhoindnalaq9nmbc9:hoxikdndnawRbbgDc;Ve0mbavc;abfaoaDcu7gPcl4fcsGcitfgsydlhzasydbhHdndnaDcsGgsak9pmbavaiaPfcsGcdtfydbaxasEhDaxasTgOfhxxekdndnascsSmbcehOasc987asamffcefhDxekalcefhDal8SbbgscFeGhPdndnascu9mmbaDhlxekalcvfhlaPcFbGhPcrhsdninaD8SbbgOcFbGastaPVhPaOcu9kmeaDcefhDascrfgsc8J9hmbxdkkaDcefhlkcehOaPce4cbaPceG9R7amfhDkaDhmkavc;abfaocitfgsaDBdbasazBdlavaicdtfaDBdbavc;abfaocefcsGcitfgsaHBdbasaDBdlaocdfhoaOaifhidnadcd9hmbabarcetfgsaH87ebasclfaD87ebascdfaz87ebxdkabarcdtfgsaHBdbascwfaDBdbasclfazBdbxekdnaDcpe0mbaxcefgOavaiaqaDcsGfRbbgscl49RcsGcdtfydbascz6gPEhDavaias9RcsGcdtfydbaOaPfgzascsGgOEhsaOThOdndnadcd9hmbabarcetfgHax87ebaHclfas87ebaHcdfaD87ebxekabarcdtfgHaxBdbaHcwfasBdbaHclfaDBdbkavaicdtfaxBdbavc;abfaocitfgHaDBdbaHaxBdlavaicefgicsGcdtfaDBdbavc;abfaocefcsGcitfgHasBdbaHaDBdlavaiaPfgicsGcdtfasBdbavc;abfaocdfcsGcitfgDaxBdbaDasBdlaocifhoaiaOfhiazaOfhxxekaxcbalRbbgHEgAaDc;:eSgDfhzaHcsGhCaHcl4hXdndnaHcs0mbazcefhOxekazhOavaiaX9RcsGcdtfydbhzkdndnaCmbaOcefhxxekaOhxavaiaH9RcsGcdtfydbhOkdndnaDTmbalcefhDxekalcdfhDal8SbegPcFeGhsdnaPcu9kmbalcofhAascFbGhscrhldninaD8SbbgPcFbGaltasVhsaPcu9kmeaDcefhDalcrfglc8J9hmbkaAhDxekaDcefhDkasce4cbasceG9R7amfgmhAkdndnaXcsSmbaDhsxekaDcefhsaD8SbbglcFeGhPdnalcu9kmbaDcvfhzaPcFbGhPcrhldninas8SbbgDcFbGaltaPVhPaDcu9kmeascefhsalcrfglc8J9hmbkazhsxekascefhskaPce4cbaPceG9R7amfgmhzkdndnaCcsSmbashlxekascefhlas8SbbgDcFeGhPdnaDcu9kmbascvfhOaPcFbGhPcrhDdninal8SbbgscFbGaDtaPVhPascu9kmealcefhlaDcrfgDc8J9hmbkaOhlxekalcefhlkaPce4cbaPceG9R7amfgmhOkdndnadcd9hmbabarcetfgDaA87ebaDclfaO87ebaDcdfaz87ebxekabarcdtfgDaABdbaDcwfaOBdbaDclfazBdbkavc;abfaocitfgDazBdbaDaABdlavaicdtfaABdbavc;abfaocefcsGcitfgDaOBdbaDazBdlavaicefgicsGcdtfazBdbavc;abfaocdfcsGcitfgDaABdbaDaOBdlavaiaHcz6aXcsSVfgicsGcdtfaOBdbaiaCTaCcsSVfhiaocifhokawcefhwaocsGhoaicsGhiarcifgrae6mbkkcbc99alaqSEhokavc;aef8Kjjjjbaok:clevu8Jjjjjbcz9Rhvdnaecvfal9nmbc9:skdnaiRbbc;:eGc;qeSmbcuskav9cb83iwaicefhoaialfc98fhrdnaeTmbdnadcdSmbcbhwindnaoar6mbc9:skaocefhlao8SbbgicFeGhddndnaicu9mmbalhoxekaocvfhoadcFbGhdcrhidninal8SbbgDcFbGaitadVhdaDcu9kmealcefhlaicrfgic8J9hmbxdkkalcefhokabawcdtfadc8Etc8F91adcd47avcwfadceGcdtVglydbfgiBdbalaiBdbawcefgwae9hmbxdkkcbhwindnaoar6mbc9:skaocefhlao8SbbgicFeGhddndnaicu9mmbalhoxekaocvfhoadcFbGhdcrhidninal8SbbgDcFbGaitadVhdaDcu9kmealcefhlaicrfgic8J9hmbxdkkalcefhokabawcetfadc8Etc8F91adcd47avcwfadceGcdtVglydbfgi87ebalaiBdbawcefgwae9hmbkkcbc99aoarSEk:SPliuo97eue978Jjjjjbca9Rhiaec98Ghldndnadcl9hmbdnalTmbcbhvabhdinadadpbbbgocKp:RecKp:Sep;6egraocwp:RecKp:Sep;6earp;Geaoczp:RecKp:Sep;6egwp;Gep;Kep;LegDpxbbbbbbbbbbbbbbbbp:2egqarpxbbbjbbbjbbbjbbbjgkp9op9rp;Kegrpxbb;:9cbb;:9cbb;:9cbb;:9cararp;MeaDaDp;Meawaqawakp9op9rp;Kegrarp;Mep;Kep;Kep;Jep;Negwp;Mepxbbn0bbn0bbn0bbn0gqp;KepxFbbbFbbbFbbbFbbbp9oaopxbbbFbbbFbbbFbbbFp9op9qarawp;Meaqp;Kecwp:RepxbFbbbFbbbFbbbFbbp9op9qaDawp;Meaqp;Keczp:RepxbbFbbbFbbbFbbbFbp9op9qpkbbadczfhdavclfgval6mbkkalaeSmeaipxbbbbbbbbbbbbbbbbgqpklbaiabalcdtfgdaeciGglcdtgv;8qbbdnalTmbaiaipblbgocKp:RecKp:Sep;6egraocwp:RecKp:Sep;6earp;Geaoczp:RecKp:Sep;6egwp;Gep;Kep;LegDaqp:2egqarpxbbbjbbbjbbbjbbbjgkp9op9rp;Kegrpxbb;:9cbb;:9cbb;:9cbb;:9cararp;MeaDaDp;Meawaqawakp9op9rp;Kegrarp;Mep;Kep;Kep;Jep;Negwp;Mepxbbn0bbn0bbn0bbn0gqp;KepxFbbbFbbbFbbbFbbbp9oaopxbbbFbbbFbbbFbbbFp9op9qarawp;Meaqp;Kecwp:RepxbFbbbFbbbFbbbFbbp9op9qaDawp;Meaqp;Keczp:RepxbbFbbbFbbbFbbbFbp9op9qpklbkadaiav;8qbbskdnalTmbcbhvabhdinadczfgxaxpbbbgopxbbbbbbFFbbbbbbFFgkp9oadpbbbgDaopmbediwDqkzHOAKY8AEgwczp:Reczp:Sep;6egraDaopmlvorxmPsCXQL358E8FpxFubbFubbFubbFubbp9op;7eawczp:Sep;6egwp;Gearp;Gep;Kep;Legopxbbbbbbbbbbbbbbbbp:2egqarpxbbbjbbbjbbbjbbbjgmp9op9rp;Kegrpxb;:FSb;:FSb;:FSb;:FSararp;Meaoaop;Meawaqawamp9op9rp;Kegrarp;Mep;Kep;Kep;Jep;Negwp;Mepxbbn0bbn0bbn0bbn0gqp;KepxFFbbFFbbFFbbFFbbp9oaoawp;Meaqp;Keczp:Rep9qgoarawp;Meaqp;KepxFFbbFFbbFFbbFFbbp9ogrpmwDKYqk8AExm35Ps8E8Fp9qpkbbadaDakp9oaoarpmbezHdiOAlvCXorQLp9qpkbbadcafhdavclfgval6mbkkalaeSmbaiczfpxbbbbbbbbbbbbbbbbgopklbaiaopklbaiabalcitfgdaeciGglcitgv;8qbbdnalTmbaiaipblzgopxbbbbbbFFbbbbbbFFgkp9oaipblbgDaopmbediwDqkzHOAKY8AEgwczp:Reczp:Sep;6egraDaopmlvorxmPsCXQL358E8FpxFubbFubbFubbFubbp9op;7eawczp:Sep;6egwp;Gearp;Gep;Kep;Legopxbbbbbbbbbbbbbbbbp:2egqarpxbbbjbbbjbbbjbbbjgmp9op9rp;Kegrpxb;:FSb;:FSb;:FSb;:FSararp;Meaoaop;Meawaqawamp9op9rp;Kegrarp;Mep;Kep;Kep;Jep;Negwp;Mepxbbn0bbn0bbn0bbn0gqp;KepxFFbbFFbbFFbbFFbbp9oaoawp;Meaqp;Keczp:Rep9qgoarawp;Meaqp;KepxFFbbFFbbFFbbFFbbp9ogrpmwDKYqk8AExm35Ps8E8Fp9qpklzaiaDakp9oaoarpmbezHdiOAlvCXorQLp9qpklbkadaiav;8qbbkk:oDllue97euv978Jjjjjbc8W9Rhidnaec98GglTmbcbhvabhoinaiaopbbbgraoczfgwpbbbgDpmlvorxmPsCXQL358E8Fgqczp:Segkclp:RepklbaopxbbjZbbjZbbjZbbjZpx;Zl81Z;Zl81Z;Zl81Z;Zl81Zakpxibbbibbbibbbibbbp9qp;6ep;NegkaraDpmbediwDqkzHOAKY8AEgrczp:Reczp:Sep;6ep;MegDaDp;Meakarczp:Sep;6ep;Megxaxp;Meakaqczp:Reczp:Sep;6ep;Megqaqp;Mep;Kep;Kep;Lepxbbbbbbbbbbbbbbbbp:4ep;Jepxb;:FSb;:FSb;:FSb;:FSgkp;Mepxbbn0bbn0bbn0bbn0grp;KepxFFbbFFbbFFbbFFbbgmp9oaxakp;Mearp;Keczp:Rep9qgxaDakp;Mearp;Keamp9oaqakp;Mearp;Keczp:Rep9qgkpmbezHdiOAlvCXorQLgrp5baipblbpEb:T:j83ibaocwfarp5eaipblbpEe:T:j83ibawaxakpmwDKYqk8AExm35Ps8E8Fgkp5baipblbpEd:T:j83ibaocKfakp5eaipblbpEi:T:j83ibaocafhoavclfgval6mbkkdnalaeSmbaiczfpxbbbbbbbbbbbbbbbbgkpklbaiakpklbaiabalcitfgoaeciGgvcitgw;8qbbdnavTmbaiaipblbgraipblzgDpmlvorxmPsCXQL358E8Fgqczp:Segkclp:RepklaaipxbbjZbbjZbbjZbbjZpx;Zl81Z;Zl81Z;Zl81Z;Zl81Zakpxibbbibbbibbbibbbp9qp;6ep;NegkaraDpmbediwDqkzHOAKY8AEgrczp:Reczp:Sep;6ep;MegDaDp;Meakarczp:Sep;6ep;Megxaxp;Meakaqczp:Reczp:Sep;6ep;Megqaqp;Mep;Kep;Kep;Lepxbbbbbbbbbbbbbbbbp:4ep;Jepxb;:FSb;:FSb;:FSb;:FSgkp;Mepxbbn0bbn0bbn0bbn0grp;KepxFFbbFFbbFFbbFFbbgmp9oaxakp;Mearp;Keczp:Rep9qgxaDakp;Mearp;Keamp9oaqakp;Mearp;Keczp:Rep9qgkpmbezHdiOAlvCXorQLgrp5baipblapEb:T:j83ibaiarp5eaipblapEe:T:j83iwaiaxakpmwDKYqk8AExm35Ps8E8Fgkp5baipblapEd:T:j83izaiakp5eaipblapEi:T:j83iKkaoaiaw;8qbbkk;uddiue978Jjjjjbc;ab9Rhidnadcd4ae2glc98GgvTmbcbheabhdinadadpbbbgocwp:Recwp:Sep;6eaocep:SepxbbjFbbjFbbjFbbjFp9opxbbjZbbjZbbjZbbjZp:Uep;Mepkbbadczfhdaeclfgeav6mbkkdnavalSmbaic8WfpxbbbbbbbbbbbbbbbbgopklbaicafaopklbaiczfaopklbaiaopklbaiabavcdtfgdalciGgecdtgv;8qbbdnaeTmbaiaipblbgocwp:Recwp:Sep;6eaocep:SepxbbjFbbjFbbjFbbjFp9opxbbjZbbjZbbjZbbjZp:Uep;Mepklbkadaiav;8qbbkk9teiucbcbydj1jjbgeabcifc98GfgbBdj1jjbdndnabZbcztgd9nmbcuhiabad9RcFFifcz4nbcuSmekaehikaikkkebcjwklz:Dbb",r=new Uint8Array([0,97,115,109,1,0,0,0,1,4,1,96,0,0,3,3,2,0,0,5,3,1,0,1,12,1,0,10,22,2,12,0,65,0,65,0,65,0,252,10,0,0,11,7,0,65,0,253,15,26,11]),a=new Uint8Array([32,0,65,2,1,106,34,33,3,128,11,4,13,64,6,253,10,7,15,116,127,5,8,12,40,16,19,54,20,9,27,255,113,17,42,67,24,23,146,148,18,14,22,45,70,69,56,114,101,21,25,63,75,136,108,28,118,29,73,115]);if(typeof WebAssembly!="object")return{supported:!1};var s=WebAssembly.validate(r)?o(e):o(t),n,i=WebAssembly.instantiate(s,{}).then(function(g){n=g.instance,n.exports.__wasm_call_ctors()});function o(g){for(var y=new Uint8Array(g.length),x=0;x<g.length;++x){var v=g.charCodeAt(x);y[x]=v>96?v-97:v>64?v-39:v+4}for(var E=0,x=0;x<g.length;++x)y[E++]=y[x]<60?a[y[x]]:(y[x]-60)*64+y[++x];return y.buffer.slice(0,E)}function c(g,y,x,v,E,S,T){var _=g.exports.sbrk,I=v+3&-4,N=_(I*E),C=_(S.length),B=new Uint8Array(g.exports.memory.buffer);B.set(S,C);var R=y(N,v,E,C,S.length);if(R==0&&T&&T(N,I,E),x.set(B.subarray(N,N+v*E)),_(N-_(0)),R!=0)throw new Error("Malformed buffer data: "+R)}var l={NONE:"",OCTAHEDRAL:"meshopt_decodeFilterOct",QUATERNION:"meshopt_decodeFilterQuat",EXPONENTIAL:"meshopt_decodeFilterExp"},f={ATTRIBUTES:"meshopt_decodeVertexBuffer",TRIANGLES:"meshopt_decodeIndexBuffer",INDICES:"meshopt_decodeIndexSequence"},d=[],p=0;function b(g){var y={object:new Worker(g),pending:0,requests:{}};return y.object.onmessage=function(x){var v=x.data;y.pending-=v.count,y.requests[v.id][v.action](v.value),delete y.requests[v.id]},y}function h(g){for(var y="self.ready = WebAssembly.instantiate(new Uint8Array(["+new Uint8Array(s)+"]), {}).then(function(result) { result.instance.exports.__wasm_call_ctors(); return result.instance; });self.onmessage = "+m.name+";"+c.toString()+m.toString(),x=new Blob([y],{type:"text/javascript"}),v=URL.createObjectURL(x),E=d.length;E<g;++E)d[E]=b(v);for(var E=g;E<d.length;++E)d[E].object.postMessage({});d.length=g,URL.revokeObjectURL(v)}function u(g,y,x,v,E){for(var S=d[0],T=1;T<d.length;++T)d[T].pending<S.pending&&(S=d[T]);return new Promise(function(_,I){var N=new Uint8Array(x),C=++p;S.pending+=g,S.requests[C]={resolve:_,reject:I},S.object.postMessage({id:C,count:g,size:y,source:N,mode:v,filter:E},[N.buffer])})}function m(g){var y=g.data;if(!y.id)return self.close();self.ready.then(function(x){try{var v=new Uint8Array(y.count*y.size);c(x,x.exports[y.mode],v,y.count,y.size,y.source,x.exports[y.filter]),self.postMessage({id:y.id,count:y.count,action:"resolve",value:v},[v.buffer])}catch(E){self.postMessage({id:y.id,count:y.count,action:"reject",value:E})}})}return{ready:i,supported:!0,useWorkers:function(g){h(g)},decodeVertexBuffer:function(g,y,x,v,E){c(n,n.exports.meshopt_decodeVertexBuffer,g,y,x,v,n.exports[l[E]])},decodeIndexBuffer:function(g,y,x,v){c(n,n.exports.meshopt_decodeIndexBuffer,g,y,x,v)},decodeIndexSequence:function(g,y,x,v){c(n,n.exports.meshopt_decodeIndexSequence,g,y,x,v)},decodeGltfBuffer:function(g,y,x,v,E,S){c(n,n.exports[f[E]],g,y,x,v,n.exports[l[S]])},decodeGltfBufferAsync:function(g,y,x,v,E){return d.length>0?u(g,y,x,f[v],l[E]):i.then(function(){var S=new Uint8Array(g*y);return c(n,n.exports[f[v]],S,g,y,x,n.exports[l[E]]),S})}}})();var WT=(function(){var t="b9H79Tebbbetm9Geueu9Geub9Gbb9Gsuuuuuuuuuuuu99uueu9Gvuuuuub9Gruuuuuuub9Gvuuuuue999Gvuuuuueu9Gquuuuuuu99uueu9Gwuuuuuu99ueu9Giuuue999Gluuuueu9GiuuueuiOHdilvorlwiDqkbxxbelve9Weiiviebeoweuec:G:Pdkr:Tewo9TW9T9VV95dbH9F9F939H79T9F9J9H229F9Jt9VV7bbz9TW79O9V9Wt9F79P9T9W29P9M95br8E9TW79O9V9Wt9F79P9T9W29P9M959x9Pt9OcttV9P9I91tW7bwQ9TW79O9V9Wt9F79P9T9W29P9M959q9V9P9Ut7bDX9TW79O9V9Wt9F79P9T9W29P9M959t9J9H2Wbqa9TW79O9V9Wt9F9V9Wt9P9T9P96W9wWVtW94SWt9J9O9sW9T9H9Wbkl79IV9RbxDwebcekdzsq;B:xeHdbkM9Hi8Au8A99Au8Jjjjjbc;W;qb9Rgs8Kjjjjbcbhzascxfcbc;Kbz:ojjjb8AdnabaeSmbabaeadcdtz:njjjb8AkdndnamcdGmbascxfhHcbhOxekasalcrfci4gecbyd:m:jjjbHjjjjbbgABdxasceBd2aAcbaez:ojjjbhCcbhlcbhednadTmbcbhlabheadhAinaCaeydbgXci4fgQaQRbbgQceaXcrGgXtV86bbaQcu7aX4ceGalfhlaeclfheaAcufgAmbkcualcdtalcFFFFi0EhekascCfhHasaecbyd:m:jjjbHjjjjbbgOBdzascdBd2alcd4alfhXcehAinaAgecethAaeaX6mbkcdhzcbhLascuaecdtgAaecFFFFi0Ecbyd:m:jjjbHjjjjbbgXBdCasciBd2aXcFeaAz:ojjjbhKdnadTmbaecufhYcbh8AindndnaKabaLcdtfgEydbgQc:v;t;h;Ev2aYGgXcdtfgCydbgAcuSmbceheinaOaAcdtfydbaQSmdaXaefhAaecefheaKaAaYGgXcdtfgCydbgAcu9hmbkkaOa8AcdtfaQBdbaCa8ABdba8AhAa8Acefh8AkaEaABdbaLcefgLad9hmbkkaKcbyd1:jjjbH:bjjjbbascdBd2kcbh3aHcualcefgecdtaecFFFFi0Ecbyd:m:jjjbHjjjjbbg5Bdbasa5BdlasazceVgeBd2ascxfaecdtfcuadcitadcFFFFe0Ecbyd:m:jjjbHjjjjbbg8EBdbasa8EBdwasazcdfgeBd2asclfabadalcbz:cjjjbascxfaecdtfcualcdtgealcFFFFi0Eg8Fcbyd:m:jjjbHjjjjbbgABdbasazcifgXBd2ascxfaXcdtfa8Fcbyd:m:jjjbHjjjjbbgaBdbasazclVBd2aAaaaialavaOascxfz:djjjbalcbyd:m:jjjbHjjjjbbhCascxfasyd2ghcdtfaCBdbasahcefgXBd2ascxfaXcdtfa8Fcbyd:m:jjjbHjjjjbbgXBdbasahcdfgQBd2ascxfaQcdtfa8Fcbyd:m:jjjbHjjjjbbgQBdbasahcifggBd2aXcFeaez:ojjjbh8JaQcFeaez:ojjjbh8KdnalTmba8Ecwfh8Lindna5a3gQcefg3cdtfydbgKa5aQcdtgefydbgXSmbaKaX9Rhza8EaXcitfhHa8Kaefh8Ma8JaefhEcbhYindndnaHaYcitfydbg8AaQ9hmbaEaQBdba8MaQBdbxekdna5a8Acdtg8NfgeclfydbgXaeydbgeSmba8EaecitgKfydbaQSmeaXae9Rhyaecu7aXfhLa8LaKfhXcbheinaLaeSmeaecefheaXydbhKaXcwfhXaKaQ9hmbkaeay6meka8Ka8NfgeaQa8AaeydbcuSEBdbaEa8AaQaEydbcuSEBdbkaYcefgYaz9hmbkka3al9hmbkaAhXaahQa8KhKa8JhYcbheindndnaeaXydbg8A9hmbdnaeaQydbg8A9hmbaYydbh8AdnaKydbgLcu9hmba8Acu9hmbaCaefcb86bbxikaCaefhEdnaeaLSmbaea8ASmbaEce86bbxikaEcl86bbxdkdnaeaaa8AcdtgLfydb9hmbdnaKydbgEcuSmbaeaESmbaYydbgzcuSmbaeazSmba8KaLfydbgHcuSmbaHa8ASmba8JaLfydbgLcuSmbaLa8ASmbdnaAaEcdtfydbg8AaAaLcdtfydb9hmba8AaAazcdtfydbgLSmbaLaAaHcdtfydb9hmbaCaefcd86bbxlkaCaefcl86bbxikaCaefcl86bbxdkaCaefcl86bbxekaCaefaCa8AfRbb86bbkaXclfhXaQclfhQaKclfhKaYclfhYalaecefge9hmbkdnaqTmbdndnaOTmbaOheaAhXalhQindnaqaeydbfRbbTmbaCaXydbfcl86bbkaeclfheaXclfhXaQcufgQmbxdkkaAhealhXindnaqRbbTmbaCaeydbfcl86bbkaqcefhqaeclfheaXcufgXmbkkaAhealhQaChXindnaCaeydbfRbbcl9hmbaXcl86bbkaeclfheaXcefhXaQcufgQmbkkamceGTmbaChealhXindnaeRbbce9hmbaecl86bbkaecefheaXcufgXmbkkascxfagcdtfcualcx2alc;v:Q;v:Qe0Ecbyd:m:jjjbHjjjjbbg3BdbasahclfgHBd2a3aialavaOz:ejjjbh8PdndnaDmbcbhgcbh8Lxekcbh8LawhecbhXindnaeIdbJbbbb9ETmbasc;Wbfa8LcdtfaXBdba8Lcefh8LkaeclfheaDaXcefgX9hmbkascxfaHcdtfcua8Lal2gecdtaecFFFFi0Ecbyd:m:jjjbHjjjjbbggBdbasahcvfgHBd2alTmba8LTmbarcd4hEdnaOTmba8Lcdthzcbh8AaghLinaoaOa8AcdtfydbaE2cdtfhYasc;WbfheaLhXa8LhQinaXaYaeydbcdtgKfIdbawaKfIdbNUdbaeclfheaXclfhXaQcufgQmbkaLazfhLa8Acefg8Aal9hmbxdkka8Lcdthzcbh8AaghLinaoa8AaE2cdtfhYasc;WbfheaLhXa8LhQinaXaYaeydbcdtgKfIdbawaKfIdbNUdbaeclfheaXclfhXaQcufgQmbkaLazfhLa8Acefg8Aal9hmbkkascxfaHcdtfcualc8S2gealc;D;O;f8U0EgQcbyd:m:jjjbHjjjjbbgXBdbasaHcefgKBd2aXcbaez:ojjjbhqdndndna8LTmbascxfaKcdtfaQcbyd:m:jjjbHjjjjbbgvBdbasaHcdfgXBd2avcbaez:ojjjb8AascxfaXcdtfcua8Lal2gecltgXaecFFFFb0Ecbyd:m:jjjbHjjjjbbgiBdbasaHcifBd2aicbaXz:ojjjb8AadmexdkcbhvcbhiadTmekcbhYabhXindna3aXclfydbg8Acx2fgeIdba3aXydbgLcx2fgQIdbgI:tg8Ra3aXcwfydbgEcx2fgKIdlaQIdlg8S:tgRNaKIdbaI:tg8UaeIdla8S:tg8VN:tg8Wa8WNa8VaKIdwaQIdwg8X:tg8YNaRaeIdwa8X:tg8VN:tgRaRNa8Va8UNa8Ya8RN:tg8Ra8RNMM:rg8UJbbbb9ETmba8Wa8U:vh8Wa8Ra8U:vh8RaRa8U:vhRkaqaAaLcdtfydbc8S2fgeaRa8U:rg8UaRNNg8VaeIdbMUdbaea8Ra8Ua8RNg8ZNg8YaeIdlMUdlaea8Wa8Ua8WNg80Ng81aeIdwMUdwaea8ZaRNg8ZaeIdxMUdxaea80aRNgBaeIdzMUdzaea80a8RNg80aeIdCMUdCaeaRa8Ua8Wa8XNaRaINa8Sa8RNMM:mg8SNgINgRaeIdKMUdKaea8RaINg8RaeId3MUd3aea8WaINg8WaeIdaMUdaaeaIa8SNgIaeId8KMUd8Kaea8UaeIdyMUdyaqaAa8Acdtfydbc8S2fgea8VaeIdbMUdbaea8YaeIdlMUdlaea81aeIdwMUdwaea8ZaeIdxMUdxaeaBaeIdzMUdzaea80aeIdCMUdCaeaRaeIdKMUdKaea8RaeId3MUd3aea8WaeIdaMUdaaeaIaeId8KMUd8Kaea8UaeIdyMUdyaqaAaEcdtfydbc8S2fgea8VaeIdbMUdbaea8YaeIdlMUdlaea81aeIdwMUdwaea8ZaeIdxMUdxaeaBaeIdzMUdzaea80aeIdCMUdCaeaRaeIdKMUdKaea8RaeId3MUd3aea8WaeIdaMUdaaeaIaeId8KMUd8Kaea8UaeIdyMUdyaXcxfhXaYcifgYad6mbkcbhzabhLinabazcdtfh8AcbhXinaCa8AaXc;a1jjbfydbcdtfydbgQfRbbhedndnaCaLaXfydbgKfRbbgYc99fcFeGcpe0mbaec99fcFeGc;:e6mekdnaYcufcFeGce0mba8JaKcdtfydbaQ9hmekdnaecufcFeGce0mba8KaQcdtfydbaK9hmekdnaYcv2aefc:G1jjbfRbbTmbaAaQcdtfydbaAaKcdtfydb0mekJbbacJbbacJbbjZaecFeGceSEaYceSEh80dna3a8AaXc;e1jjbfydbcdtfydbcx2fgeIdwa3aKcx2fgYIdwg8S:tg8Wa3aQcx2fgEIdwa8S:tgRaRNaEIdbaYIdbg8X:tg8Ra8RNaEIdlaYIdlg8V:tg8Ua8UNMMgINa8WaRNaeIdba8X:tg81a8RNa8UaeIdla8V:tg8ZNMMg8YaRN:tg8Wa8WNa81aINa8Ya8RN:tgRaRNa8ZaINa8Ya8UN:tg8Ra8RNMM:rg8UJbbbb9ETmba8Wa8U:vh8Wa8Ra8U:vh8RaRa8U:vhRkaqaAaKcdtfydbc8S2fgeaRa80aI:rNg8UaRNNg8YaeIdbMUdbaea8Ra8Ua8RNg80Ng81aeIdlMUdlaea8Wa8Ua8WNgINg8ZaeIdwMUdwaea80aRNg80aeIdxMUdxaeaIaRNgBaeIdzMUdzaeaIa8RNg83aeIdCMUdCaeaRa8Ua8Wa8SNaRa8XNa8Va8RNMM:mg8SNgINgRaeIdKMUdKaea8RaINg8RaeId3MUd3aea8WaINg8WaeIdaMUdaaeaIa8SNgIaeId8KMUd8Kaea8UaeIdyMUdyaqaAaQcdtfydbc8S2fgea8YaeIdbMUdbaea81aeIdlMUdlaea8ZaeIdwMUdwaea80aeIdxMUdxaeaBaeIdzMUdzaea83aeIdCMUdCaeaRaeIdKMUdKaea8RaeId3MUd3aea8WaeIdaMUdaaeaIaeId8KMUd8Kaea8UaeIdyMUdykaXclfgXcx9hmbkaLcxfhLazcifgzad6mbka8LTmbcbhLinJbbbbh8Xa3abaLcdtfgeclfydbgEcx2fgXIdwa3aeydbgzcx2fgQIdwg8Z:tg8Ra8RNaXIdbaQIdbgB:tg8Wa8WNaXIdlaQIdlg83:tg8Ua8UNMMg80a3aecwfydbgHcx2fgeIdwa8Z:tgINa8Ra8RaINa8WaeIdbaB:tg8SNa8UaeIdla83:tg8VNMMgRN:tJbbbbJbbjZa80aIaINa8Sa8SNa8Va8VNMMg81NaRaRN:tg8Y:va8YJbbbb9BEg8YNhUa81a8RNaIaRN:ta8YNh85a80a8VNa8UaRN:ta8YNh86a81a8UNa8VaRN:ta8YNh87a80a8SNa8WaRN:ta8YNh88a81a8WNa8SaRN:ta8YNh89a8Wa8VNa8Sa8UN:tgRaRNa8UaINa8Va8RN:tgRaRNa8Ra8SNaIa8WN:tgRaRNMM:rJbbbZNhRagaza8L2gwcdtfhXagaHa8L2g8NcdtfhQagaEa8L2g5cdtfhKa8Z:mh8:a83:mhZaB:mhncbhYa8Lh8AJbbbbh8VJbbbbh8YJbbbbh80Jbbbbh81Jbbbbh8ZJbbbbhBJbbbbh83JbbbbhcJbbbbh9cinasc;WbfaYfgecwfaRa85aKIdbaXIdbgI:tg8UNaUaQIdbaI:tg8SNMg8RNUdbaeclfaRa87a8UNa86a8SNMg8WNUdbaeaRa89a8UNa88a8SNMg8UNUdbaecxfaRa8:a8RNaZa8WNaIana8UNMMMgINUdbaRa8Ra8WNNa81Mh81aRa8Ra8UNNa8ZMh8ZaRa8Wa8UNNaBMhBaRaIaINNa8XMh8XaRa8RaINNa8VMh8VaRa8WaINNa8YMh8YaRa8UaINNa80Mh80aRa8Ra8RNNa83Mh83aRa8Wa8WNNacMhcaRa8Ua8UNNa9cMh9caXclfhXaKclfhKaQclfhQaYczfhYa8Acufg8Ambkavazc8S2fgea9caeIdbMUdbaeacaeIdlMUdlaea83aeIdwMUdwaeaBaeIdxMUdxaea8ZaeIdzMUdzaea81aeIdCMUdCaea80aeIdKMUdKaea8YaeId3MUd3aea8VaeIdaMUdaaea8XaeId8KMUd8KaeaRaeIdyMUdyavaEc8S2fgea9caeIdbMUdbaeacaeIdlMUdlaea83aeIdwMUdwaeaBaeIdxMUdxaea8ZaeIdzMUdzaea81aeIdCMUdCaea80aeIdKMUdKaea8YaeId3MUd3aea8VaeIdaMUdaaea8XaeId8KMUd8KaeaRaeIdyMUdyavaHc8S2fgea9caeIdbMUdbaeacaeIdlMUdlaea83aeIdwMUdwaeaBaeIdxMUdxaea8ZaeIdzMUdzaea81aeIdCMUdCaea80aeIdKMUdKaea8YaeId3MUd3aea8VaeIdaMUdaaea8XaeId8KMUd8KaeaRaeIdyMUdyaiawcltfh8AcbhXa8LhKina8AaXfgeasc;WbfaXfgQIdbaeIdbMUdbaeclfgYaQclfIdbaYIdbMUdbaecwfgYaQcwfIdbaYIdbMUdbaecxfgeaQcxfIdbaeIdbMUdbaXczfhXaKcufgKmbkaia5cltfh8AcbhXa8LhKina8AaXfgeasc;WbfaXfgQIdbaeIdbMUdbaeclfgYaQclfIdbaYIdbMUdbaecwfgYaQcwfIdbaYIdbMUdbaecxfgeaQcxfIdbaeIdbMUdbaXczfhXaKcufgKmbkaia8Ncltfh8AcbhXa8LhKina8AaXfgeasc;WbfaXfgQIdbaeIdbMUdbaeclfgYaQclfIdbaYIdbMUdbaecwfgYaQcwfIdbaYIdbMUdbaecxfgeaQcxfIdbaeIdbMUdbaXczfhXaKcufgKmbkaLcifgLad6mbkkcbhQdndnamcwGgJmbJbbbbh8Vcbh9ecbhocbhhxekcbh9ea8Fcbyd:m:jjjbHjjjjbbhhascxfasyd2gecdtfahBdbasaecefgXBd2ascxfaXcdtfcuahalabadaAz:fjjjbgKcltaKcjjjjiGEcbyd:m:jjjbHjjjjbbgoBdbasaecdfBd2aoaKaha3alz:gjjjbJFFuuh8VaKTmbaoheaKhXinaeIdbgRa8Va8VaR9EEh8VaeclfheaXcufgXmbkaKh9ekasydlhTdnalTmbaTclfheaTydbhKaChXalhYcbhQincbaeydbg8AaK9RaXRbbcpeGEaQfhQaXcefhXaeclfhea8AhKaYcufgYmbkaQce4hQkcuadaQ9RcifgScx2aSc;v:Q;v:Qe0Ecbyd:m:jjjbHjjjjbbhDascxfasyd2g9hcdtfaDBdbasa9hcefgeBd2ascxfaecdtfcuaScdtaScFFFFi0Ecbyd:m:jjjbHjjjjbbgrBdbasa9hcdfgeBd2ascxfaecdtfa8Fcbyd:m:jjjbHjjjjbbgyBdbasa9hcifgeBd2ascxfaecdtfalcbyd:m:jjjbHjjjjbbg9iBdbasa9hclfg6Bd2axaxNa8PJbbjZamclGEgUaUN:vh9cJbbbbhcdnadak9nmbdnaSci6mba8Lclth9kaDcwfh0Jbbbbh83JbbbbhcinasclfabadalaAz:cjjjbabhzcbh8Ecbh8Finaba8FcdtfhHcbheindnaAazaefydbgQcdtgEfydbgYaAaHaec;q1jjbfydbcdtfydbgXcdtgwfydbg8ASmbaCaXfRbbgLcv2aCaQfRbbgKfc;G1jjbfRbbg5aKcv2aLfg8Nc;G1jjbfRbbg8MVcFeGTmbdna8AaY9nmba8Nc:G1jjbfRbbcFeGmekaKcufhYdnaKaL9hmbaYcFeGce0mba8JaEfydbaX9hmekdndnaKclSmbaLcl9hmekdnaYcFeGce0mba8JaEfydbaX9hmdkaLcufcFeGce0mba8KawfydbaQ9hmekaDa8Ecx2fgKaXaQa8McFeGgYEBdlaKaQaXaYEBdbaKaYa5Gcb9hBdwa8Ecefh8Ekaeclfgecx9hmbkdna8Fcifg8Fad9pmbazcxfhza8EcifaS9nmekka8ETmdcbhLinaqaAaDaLcx2fgKydbgYcdtgzfydbc8S2fgeIdwa3aKydlg8Acx2fgXIdwg8WNaeIdzaXIdbg8UNaeIdaMgRaRMMa8WNaeIdlaXIdlgINaeIdCa8WNaeId3MgRaRMMaINaeIdba8UNaeIdxaINaeIdKMgRaRMMa8UNaeId8KMMM:lhRJbbbbJbbjZaeIdyg8R:va8RJbbbb9BEh8RdndnaKydwgEmbJFFuuh8YxekJbbbbJbbjZaqaAa8Acdtfydbc8S2fgeIdyg8S:va8SJbbbb9BEaeIdwa3aYcx2fgXIdwg8SNaeIdzaXIdbg8XNaeIdaMg8Ya8YMMa8SNaeIdlaXIdlg8YNaeIdCa8SNaeId3Mg8Sa8SMMa8YNaeIdba8XNaeIdxa8YNaeIdKMg8Sa8SMMa8XNaeId8KMMM:lNh8Yka8RaRNh80dna8LTmbavaYc8S2fgQIdwa8WNaQIdza8UNaQIdaMgRaRMMa8WNaQIdlaINaQIdCa8WNaQId3MgRaRMMaINaQIdba8UNaQIdxaINaQIdKMgRaRMMa8UNaQId8KMMMhRaga8Aa8L2gHcdtfhXaiaYa8L2gwcltfheaQIdyh8Sa8LhQinaXIdbg8Ra8Ra8SNaecxfIdba8WaecwfIdbNa8UaeIdbNaIaeclfIdbNMMMg8Ra8RM:tNaRMhRaXclfhXaeczfheaQcufgQmbkdndnaEmbJbbbbh8Rxekava8Ac8S2fgQIdwa3aYcx2fgeIdwg8UNaQIdzaeIdbgINaQIdaMg8Ra8RMMa8UNaQIdlaeIdlg8SNaQIdCa8UNaQId3Mg8Ra8RMMa8SNaQIdbaINaQIdxa8SNaQIdKMg8Ra8RMMaINaQId8KMMMh8RagawcdtfhXaiaHcltfheaQIdyh8Xa8LhQinaXIdbg8Wa8Wa8XNaecxfIdba8UaecwfIdbNaIaeIdbNa8SaeclfIdbNMMMg8Wa8WM:tNa8RMh8RaXclfhXaeczfheaQcufgQmbka8R:lh8Rka80aR:lMh80a8Ya8RMh8YaCaYfRbbcd9hmbdna8Ka8Ja8Jazfydba8ASEaaazfydbgHcdtfydbgzcu9hmbaaa8AcdtfydbhzkavaHc8S2fgQIdwa3azcx2fgeIdwg8WNaQIdzaeIdbg8UNaQIdaMgRaRMMa8WNaQIdlaeIdlgINaQIdCa8WNaQId3MgRaRMMaINaQIdba8UNaQIdxaINaQIdKMgRaRMMa8UNaQId8KMMMhRagaza8L2gwcdtfhXaiaHa8L2g8NcltfheaQIdyh8Sa8LhQinaXIdbg8Ra8Ra8SNaecxfIdba8WaecwfIdbNa8UaeIdbNaIaeclfIdbNMMMg8Ra8RM:tNaRMhRaXclfhXaeczfheaQcufgQmbkdndnaEmbJbbbbh8Rxekavazc8S2fgQIdwa3aHcx2fgeIdwg8UNaQIdzaeIdbgINaQIdaMg8Ra8RMMa8UNaQIdlaeIdlg8SNaQIdCa8UNaQId3Mg8Ra8RMMa8SNaQIdbaINaQIdxa8SNaQIdKMg8Ra8RMMaINaQId8KMMMh8Raga8NcdtfhXaiawcltfheaQIdyh8Xa8LhQinaXIdbg8Wa8Wa8XNaecxfIdba8UaecwfIdbNaIaeIdbNa8SaeclfIdbNMMMg8Wa8WM:tNa8RMh8RaXclfhXaeczfheaQcufgQmbka8R:lh8Rka80aR:lMh80a8Ya8RMh8YkaKa80a8Ya80a8Y9FgeEUdwaKa8AaYaeaETVgeEBdlaKaYa8AaeEBdbaLcefgLa8E9hmbkasc;Wbfcbcj;qbz:ojjjb8Aa0hea8EhXinasc;WbfaeydbcA4cF8FGgQcFAaQcFA6EcdtfgQaQydbcefBdbaecxfheaXcufgXmbkcbhecbhXinasc;WbfaefgQydbhKaQaXBdbaKaXfhXaeclfgecj;qb9hmbkcbhea0hXinasc;WbfaXydbcA4cF8FGgQcFAaQcFA6EcdtfgQaQydbgQcefBdbaraQcdtfaeBdbaXcxfhXa8Eaecefge9hmbkadak9RgQci9Uh9mdnalTmbcbheayhXinaXaeBdbaXclfhXalaecefge9hmbkkcbh9na9icbalz:ojjjbh8FaQcO9Uh9oa9mce4h9pasydwh9qcbh8Mcbh5dninaDara5cdtfydbcx2fg8NIdwgRa9c9Emea8Ma9m9pmeJFFuuh8Rdna9pa8E9pmbaDara9pcdtfydbcx2fIdwJbb;aZNh8RkdnaRa8R9ETmbaRac9ETmba8Ma9o0mdkdna8FaAa8NydlgHcdtg9rfydbgKfg9sRbba8FaAa8Nydbgzcdtg9tfydbgefg9uRbbVmbaCazfRbbh9vdnaTaecdtfgXclfydbgQaXydbgXSmbaQaX9RhYa3aKcx2fhLa3aecx2fhEa9qaXcitfhecbhXcehwdnindnayaeydbcdtfydbgQaKSmbayaeclfydbcdtfydbg8AaKSmbaQa8ASmba3a8Acx2fg8AIdba3aQcx2fgQIdbg8W:tgRaEIdlaQIdlg8U:tg8XNaEIdba8W:tg8Ya8AIdla8U:tg8RN:tgIaRaLIdla8U:tg80NaLIdba8W:tg81a8RN:tg8UNa8RaEIdwaQIdwg8S:tg8ZNa8Xa8AIdwa8S:tg8WN:tg8Xa8RaLIdwa8S:tgBNa80a8WN:tg8RNa8Wa8YNa8ZaRN:tg8Sa8Wa81NaBaRN:tgRNMMaIaINa8Xa8XNa8Sa8SNMMa8Ua8UNa8Ra8RNaRaRNMMN:rJbbj8:N9FmdkaecwfheaXcefgXaY6hwaYaX9hmbkkawceGTmba9pcefh9pxekdndndndna9vc9:fPdebdkazheinayaecdtgefaHBdbaaaefydbgeaz9hmbxikkdna8Ka8Ja8Ja9tfydbaHSEaaa9tfydbgzcdtfydbgecu9hmbaaa9rfydbhekaya9tfaHBdbaehHkayazcdtfaHBdbka9uce86bba9sce86bba8NIdwgRacacaR9DEhca9ncefh9ncecda9vceSEa8Mfh8Mka5cefg5a8E9hmbkka9nTmddnalTmbcbh8AcbhEindnayaEcdtgefydbgQaESmbaAaQcdtfydbhzdnaEaAaefydb9hgHmbaqazc8S2fgeaqaEc8S2fgXIdbaeIdbMUdbaeaXIdlaeIdlMUdlaeaXIdwaeIdwMUdwaeaXIdxaeIdxMUdxaeaXIdzaeIdzMUdzaeaXIdCaeIdCMUdCaeaXIdKaeIdKMUdKaeaXId3aeId3MUd3aeaXIdaaeIdaMUdaaeaXId8KaeId8KMUd8KaeaXIdyaeIdyMUdyka8LTmbavaQc8S2fgeavaEc8S2gwfgXIdbaeIdbMUdbaeaXIdlaeIdlMUdlaeaXIdwaeIdwMUdwaeaXIdxaeIdxMUdxaeaXIdzaeIdzMUdzaeaXIdCaeIdCMUdCaeaXIdKaeIdKMUdKaeaXId3aeId3MUd3aeaXIdaaeIdaMUdaaeaXId8KaeId8KMUd8KaeaXIdyaeIdyMUdya9kaQ2hLaihXa8LhKinaXaLfgeaXa8AfgQIdbaeIdbMUdbaeclfgYaQclfIdbaYIdbMUdbaecwfgYaQcwfIdbaYIdbMUdbaecxfgeaQcxfIdbaeIdbMUdbaXczfhXaKcufgKmbkaHmbJbbbbJbbjZaqawfgeIdygR:vaRJbbbb9BEaeIdwa3azcx2fgXIdwgRNaeIdzaXIdbg8RNaeIdaMg8Wa8WMMaRNaeIdlaXIdlg8WNaeIdCaRNaeId3MgRaRMMa8WNaeIdba8RNaeIdxa8WNaeIdKMgRaRMMa8RNaeId8KMMM:lNgRa83a83aR9DEh83ka8Aa9kfh8AaEcefgEal9hmbkcbhXa8JheindnaeydbgQcuSmbdnaXayaQcdtgKfydbgQ9hmbcuhQa8JaKfydbgKcuSmbayaKcdtfydbhQkaeaQBdbkaeclfhealaXcefgX9hmbkcbhXa8KheindnaeydbgQcuSmbdnaXayaQcdtgKfydbgQ9hmbcuhQa8KaKfydbgKcuSmbayaKcdtfydbhQkaeaQBdbkaeclfhealaXcefgX9hmbkka83aca8LEh83cbhKabhecbhYindnayaeydbcdtfydbgXayaeclfydbcdtfydbgQSmbaXayaecwfydbcdtfydbg8ASmbaQa8ASmbabaKcdtfgLaXBdbaLcwfa8ABdbaLclfaQBdbaKcifhKkaecxfheaYcifgYad6mbkdndnaJTmbaKak9nmba8Va839FTmbcbhdabhecbhXindnaoahaeydbgQcdtfydbcdtfIdba839ETmbabadcdtfgYaQBdbaYclfaeclfydbBdbaYcwfaecwfydbBdbadcifhdkaecxfheaXcifgXaK6mbkJFFuuh8Va9eTmeaohea9ehXJFFuuhRinaeIdbg8RaRaRa8R9EEg8WaRa8Ra839EgQEhRa8Wa8VaQEh8VaeclfheaXcufgXmbxdkkaKhdkadak0mbxdkkasclfabadalaAz:cjjjbkdndnadak0mbadhXxekdnaJmbadhXxekdna8Va9c9FmbadhXxekina8VJbb;aZNgRa9caRa9c9DEh8WJbbbbhRdna9eTmbaohea9ehAinaeIdbg8RaRa8Ra8W9FEaRa8RaR9EEhRaeclfheaAcufgAmbkkcbhXabhecbhAindnaoahaeydbgQcdtfydbcdtfIdba8W9ETmbabaXcdtfgKaQBdbaKclfaeclfydbBdbaKcwfaecwfydbBdbaXcifhXkaecxfheaAcifgAad6mbkJFFuuh8Vdna9eTmbaohea9ehAJFFuuh8RinaeIdbg8Ua8Ra8Ra8U9EEgIa8Ra8Ua8W9EgQEh8RaIa8VaQEh8VaeclfheaAcufgAmbkkdnaXad9hmbadhXxdkaRacacaR9DEhcaXak9nmeaXhda8Va9c9FmbkkdnamcjjjjlGTmbaOmbaXTmbcbh8AabheinaCaeydbgKfRbbc3thLaecwfgEydbhAdndna8JaKcdtgHfydbaeclfgzydbgQSmbcbhYa8KaQcdtfydbaK9hmekcjjjj94hYkaeaLaYVaKVBdbaCaQfRbbc3thLdndna8JaQcdtfydbaASmbcbhYa8KaAcdtfydbaQ9hmekcjjjj94hYkazaLaYVaQVBdbaCaAfRbbc3thYdndna8JaAcdtfydbaKSmbcbhQa8KaHfydbaA9hmekcjjjj94hQkaEaYaQVaAVBdbaecxfhea8Acifg8AaX6mbkkdnaOTmbaXTmbaXheinabaOabydbcdtfydbBdbabclfhbaecufgembkkdnaPTmbaPaUac:rNUdbka9hcdtascxffcxfhednina6Tmeaeydbcbyd1:jjjbH:bjjjbbaec98fhea6cufh6xbkkasc;W;qbf8KjjjjbaXk;Yieouabydlhvabydbclfcbaicdtz:ojjjbhoadci9UhrdnadTmbdnalTmbaehwadhDinaoalawydbcdtfydbcdtfgqaqydbcefBdbawclfhwaDcufgDmbxdkkaehwadhDinaoawydbcdtfgqaqydbcefBdbawclfhwaDcufgDmbkkdnaiTmbcbhDaohwinawydbhqawaDBdbawclfhwaqaDfhDaicufgimbkkdnadci6mbinaecwfydbhwaeclfydbhDaeydbhidnalTmbalawcdtfydbhwalaDcdtfydbhDalaicdtfydbhikavaoaicdtfgqydbcitfaDBdbavaqydbcitfawBdlaqaqydbcefBdbavaoaDcdtfgqydbcitfawBdbavaqydbcitfaiBdlaqaqydbcefBdbavaoawcdtfgwydbcitfaiBdbavawydbcitfaDBdlawawydbcefBdbaecxfhearcufgrmbkkabydbcbBdbk:todDue99aicd4aifhrcehwinawgDcethwaDar6mbkcuaDcdtgraDcFFFFi0Ecbyd:m:jjjbHjjjjbbhwaoaoyd9GgqcefBd9GaoaqcdtfawBdbawcFearz:ojjjbhkdnaiTmbalcd4hlaDcufhxcbhminamhDdnavTmbavamcdtfydbhDkcbadaDal2cdtfgDydlgwawcjjjj94SEgwcH4aw7c:F:b:DD2cbaDydbgwawcjjjj94SEgwcH4aw7c;D;O:B8J27cbaDydwgDaDcjjjj94SEgDcH4aD7c:3F;N8N27axGhwamcdthPdndndnavTmbakawcdtfgrydbgDcuSmeadavaPfydbal2cdtfgsIdbhzcehqinaqhrdnadavaDcdtfydbal2cdtfgqIdbaz9CmbaqIdlasIdl9CmbaqIdwasIdw9BmlkarcefhqakawarfaxGgwcdtfgrydbgDcu9hmbxdkkakawcdtfgrydbgDcuSmbadamal2cdtfgsIdbhzcehqinaqhrdnadaDal2cdtfgqIdbaz9CmbaqIdlasIdl9CmbaqIdwasIdw9BmikarcefhqakawarfaxGgwcdtfgrydbgDcu9hmbkkaramBdbamhDkabaPfaDBdbamcefgmai9hmbkkakcbyd1:jjjbH:bjjjbbaoaoyd9GcufBd9GdnaeTmbaiTmbcbhDaehwinawaDBdbawclfhwaiaDcefgD9hmbkcbhDaehwindnaDabydbgrSmbawaearcdtfgrydbBdbaraDBdbkawclfhwabclfhbaiaDcefgD9hmbkkk;Qodvuv998Jjjjjbca9Rgvczfcwfcbyd11jjbBdbavcb8Pdj1jjb83izavcwfcbydN1jjbBdbavcb8Pd:m1jjb83ibdnadTmbaicd4hodnabmbdnalTmbcbhrinaealarcdtfydbao2cdtfhwcbhiinavczfaifgDawaifIdbgqaDIdbgkakaq9EEUdbavaifgDaqaDIdbgkakaq9DEUdbaiclfgicx9hmbkarcefgrad9hmbxikkaocdthrcbhwincbhiinavczfaifgDaeaifIdbgqaDIdbgkakaq9EEUdbavaifgDaqaDIdbgkakaq9DEUdbaiclfgicx9hmbkaearfheawcefgwad9hmbxdkkdnalTmbcbhrinabarcx2fgiaealarcdtfydbao2cdtfgwIdbUdbaiawIdlUdlaiawIdwUdwcbhiinavczfaifgDawaifIdbgqaDIdbgkakaq9EEUdbavaifgDaqaDIdbgkakaq9DEUdbaiclfgicx9hmbkarcefgrad9hmbxdkkaocdthlcbhraehwinabarcx2fgiaearao2cdtfgDIdbUdbaiaDIdlUdlaiaDIdwUdwcbhiinavczfaifgDawaifIdbgqaDIdbgkakaq9EEUdbavaifgDaqaDIdbgkakaq9DEUdbaiclfgicx9hmbkawalfhwarcefgrad9hmbkkJbbbbavIdbavIdzgk:tgqaqJbbbb9DEgqavIdlavIdCgx:tgmamaq9DEgqavIdwavIdKgm:tgPaPaq9DEhPdnabTmbadTmbJbbbbJbbjZaP:vaPJbbbb9BEhqinabaqabIdbak:tNUdbabclfgvaqavIdbax:tNUdbabcwfgvaqavIdbam:tNUdbabcxfhbadcufgdmbkkaPk:ZlewudnaeTmbcbhvabhoinaoavBdbaoclfhoaeavcefgv9hmbkkdnaiTmbcbhrinadarcdtfhwcbhDinalawaDcdtgvc;a1jjbfydbcdtfydbcdtfydbhodnabalawavfydbcdtfydbgqcdtfgkydbgvaqSmbinakabavgqcdtfgxydbgvBdbaxhkaqav9hmbkkdnabaocdtfgkydbgvaoSmbinakabavgocdtfgxydbgvBdbaxhkaoav9hmbkkdnaqaoSmbabaqaoaqao0Ecdtfaqaoaqao6EBdbkaDcefgDci9hmbkarcifgrai6mbkkdnaembcbskcbhxindnalaxcdtgvfydbax9hmbaxhodnabavfgDydbgvaxSmbaDhqinaqabavgocdtfgkydbgvBdbakhqaoav9hmbkkaDaoBdbkaxcefgxae9hmbkcbhvabhocbhkindndnavalydbgq9hmbdnavaoydbgq9hmbaoakBdbakcefhkxdkaoabaqcdtfydbBdbxekaoabaqcdtfydbBdbkaoclfhoalclfhlaeavcefgv9hmbkakk;Jiilud99duabcbaecltz:ojjjbhvdnalTmbadhoaihralhwinarcwfIdbhDarclfIdbhqavaoydbcltfgkarIdbakIdbMUdbakclfgxaqaxIdbMUdbakcwfgxaDaxIdbMUdbakcxfgkakIdbJbbjZMUdbaoclfhoarcxfhrawcufgwmbkkdnaeTmbavhraehkinarcxfgoIdbhDaocbBdbararIdbJbbbbJbbjZaD:vaDJbbbb9BEgDNUdbarclfgoaDaoIdbNUdbarcwfgoaDaoIdbNUdbarczfhrakcufgkmbkkdnalTmbinavadydbcltfgrcxfgkaicwfIdbarcwfIdb:tgDaDNaiIdbarIdb:tgDaDNaiclfIdbarclfIdb:tgDaDNMMgDakIdbgqaqaD9DEUdbadclfhdaicxfhialcufglmbkkdnaeTmbavcxfhrinabarIdbUdbarczfhrabclfhbaecufgembkkk8MbabaeadaialavcbcbcbcbcbaoarawaDz:bjjjbk8MbabaeadaialavaoarawaDaqakaxamaPz:bjjjbk:DCoDud99rue99iul998Jjjjjbc;Wb9Rgw8KjjjjbdndnarmbcbhDxekawcxfcbc;Kbz:ojjjb8Aawcuadcx2adc;v:Q;v:Qe0Ecbyd:m:jjjbHjjjjbbgqBdxawceBd2aqaeadaicbz:ejjjb8AawcuadcdtadcFFFFi0Egkcbyd:m:jjjbHjjjjbbgxBdzawcdBd2adcd4adfhmceheinaegicetheaiam6mbkcbhPawcuaicdtgsaicFFFFi0Ecbyd:m:jjjbHjjjjbbgzBdCawciBd2dndnar:ZgH:rJbbbZMgO:lJbbb9p9DTmbaO:Ohexekcjjjj94hekaicufhAc:bwhmcbhCadhXcbhQinaChLaeamgKcufaeaK9iEaPgDcefaeaD9kEhYdndnadTmbaYcuf:YhOaqhiaxheadhmindndnaiIdbaONJbbbZMg8A:lJbbb9p9DTmba8A:OhCxekcjjjj94hCkaCcCthCdndnaiclfIdbaONJbbbZMg8A:lJbbb9p9DTmba8A:OhExekcjjjj94hEkaEcqtaCVhCdndnaicwfIdbaONJbbbZMg8A:lJbbb9p9DTmba8A:OhExekcjjjj94hEkaeaCaEVBdbaicxfhiaeclfheamcufgmmbkazcFeasz:ojjjbh3cbh5cbhPindna3axaPcdtfydbgCcm4aC7c:v;t;h;Ev2gics4ai7aAGgmcdtfgEydbgecuSmbaeaCSmbcehiina3amaifaAGgmcdtfgEydbgecuSmeaicefhiaeaC9hmbkkaEaCBdba5aecuSfh5aPcefgPad9hmbxdkkazcFeasz:ojjjb8Acbh5kaDaYa5ar0giEhPaLa5aiEhCdna5arSmbaYaKaiEgmaP9Rcd9imbdndnaQcl0mbdnaX:ZgOaL:Zg8A:taY:Yg8EaD:Y:tg8Fa8EaK:Y:tgaa5:ZghaH:tNNNaOaH:taaNa8Aah:tNa8AaH:ta8FNahaO:tNM:va8EMJbbbZMgO:lJbbb9p9DTmbaO:Ohexdkcjjjj94hexekaPamfcd9Theka5aXaiEhXaQcefgQcs9hmekkdndnaCmbcihicbhDxekcbhiawakcbyd:m:jjjbHjjjjbbg5BdKawclBd2aPcuf:Yh8AdndnadTmbaqhiaxheadhmindndnaiIdba8ANJbbbZMgO:lJbbb9p9DTmbaO:OhCxekcjjjj94hCkaCcCthCdndnaiclfIdba8ANJbbbZMgO:lJbbb9p9DTmbaO:OhExekcjjjj94hEkaEcqtaCVhCdndnaicwfIdba8ANJbbbZMgO:lJbbb9p9DTmbaO:OhExekcjjjj94hEkaeaCaEVBdbaicxfhiaeclfheamcufgmmbkazcFeasz:ojjjbh3cbhDcbhYindndndna3axaYcdtgKfydbgCcm4aC7c:v;t;h;Ev2gics4ai7aAGgmcdtfgEydbgecuSmbcehiinaxaecdtgefydbaCSmdamaifheaicefhia3aeaAGgmcdtfgEydbgecu9hmbkkaEaYBdbaDhiaDcefhDxeka5aefydbhika5aKfaiBdbaYcefgYad9hmbkcuaDc32giaDc;j:KM;jb0EhexekazcFeasz:ojjjb8AcbhDcbhekawaecbyd:m:jjjbHjjjjbbgeBd3awcvBd2aecbaiz:ojjjbhEavcd4hKdnadTmbdnalTmbaKcdth3a5hCaqhealhmadhAinaEaCydbc32fgiaeIdbaiIdbMUdbaiaeclfIdbaiIdlMUdlaiaecwfIdbaiIdwMUdwaiamIdbaiIdxMUdxaiamclfIdbaiIdzMUdzaiamcwfIdbaiIdCMUdCaiaiIdKJbbjZMUdKaCclfhCaecxfheama3fhmaAcufgAmbxdkka5hmaqheadhCinaEamydbc32fgiaeIdbaiIdbMUdbaiaeclfIdbaiIdlMUdlaiaecwfIdbaiIdwMUdwaiaiIdxJbbbbMUdxaiaiIdzJbbbbMUdzaiaiIdCJbbbbMUdCaiaiIdKJbbjZMUdKamclfhmaecxfheaCcufgCmbkkdnaDTmbaEhiaDheinaiaiIdbJbbbbJbbjZaicKfIdbgO:vaOJbbbb9BEgONUdbaiclfgmaOamIdbNUdbaicwfgmaOamIdbNUdbaicxfgmaOamIdbNUdbaiczfgmaOamIdbNUdbaicCfgmaOamIdbNUdbaic3fhiaecufgembkkcbhCawcuaDcdtgYaDcFFFFi0Egicbyd:m:jjjbHjjjjbbgeBdaawcoBd2awaicbyd:m:jjjbHjjjjbbg3Bd8KaecFeaYz:ojjjbhxdnadTmbJbbjZJbbjZa8A:vaPceSEaoNgOaONh8AaKcdthPalheina8Aaec;81jjbalEgmIdwaEa5ydbgAc32fgiIdC:tgOaONamIdbaiIdx:tgOaONamIdlaiIdz:tgOaONMMNaqcwfIdbaiIdw:tgOaONaqIdbaiIdb:tgOaONaqclfIdbaiIdl:tgOaONMMMhOdndnaxaAcdtgifgmydbcuSmba3aifIdbaO9ETmekamaCBdba3aifaOUdbka5clfh5aqcxfhqaeaPfheadaCcefgC9hmbkkabaxaYz:njjjb8AcrhikaicdthiinaiTmeaic98fgiawcxffydbcbyd1:jjjbH:bjjjbbxbkkawc;Wbf8KjjjjbaDk:Ydidui99ducbhi8Jjjjjbca9Rglczfcwfcbyd11jjbBdbalcb8Pdj1jjb83izalcwfcbydN1jjbBdbalcb8Pd:m1jjb83ibdndnaembJbbjFhvJbbjFhoJbbjFhrxekadcd4cdthwincbhdinalczfadfgDabadfIdbgvaDIdbgoaoav9EEUdbaladfgDavaDIdbgoaoav9DEUdbadclfgdcx9hmbkabawfhbaicefgiae9hmbkalIdwalIdK:thralIdlalIdC:thoalIdbalIdz:thvkJbbbbavavJbbbb9DEgvaoaoav9DEgvararav9DEk9DeeuabcFeaicdtz:ojjjbhlcbhbdnadTmbindnalaeydbcdtfgiydbcu9hmbaiabBdbabcefhbkaeclfheadcufgdmbkkabk9teiucbcbyd:q:jjjbgeabcifc98GfgbBd:q:jjjbdndnabZbcztgd9nmbcuhiabad9RcFFifcz4nbcuSmekaehikaik;teeeudndnaeabVciGTmbabhixekdndnadcz9pmbabhixekabhiinaiaeydbBdbaiaeydlBdlaiaeydwBdwaiaeydxBdxaeczfheaiczfhiadc9Wfgdcs0mbkkadcl6mbinaiaeydbBdbaeclfheaiclfhiadc98fgdci0mbkkdnadTmbinaiaeRbb86bbaicefhiaecefheadcufgdmbkkabk:3eedudndnabciGTmbabhixekaecFeGc:b:c:ew2hldndnadcz9pmbabhixekabhiinaialBdxaialBdwaialBdlaialBdbaiczfhiadc9Wfgdcs0mbkkadcl6mbinaialBdbaiclfhiadc98fgdci0mbkkdnadTmbinaiae86bbaicefhiadcufgdmbkkabk9teiucbcbyd:q:jjjbgeabcrfc94GfgbBd:q:jjjbdndnabZbcztgd9nmbcuhiabad9RcFFifcz4nbcuSmekaehikaik9:eiuZbhedndncbyd:q:jjjbgdaecztgi9nmbcuheadai9RcFFifcz4nbcuSmekadhekcbabae9Rcifc98Gcbyd:q:jjjbfgdBd:q:jjjbdnadZbcztge9nmbadae9RcFFifcz4nb8Akkk:Iedbcjwk1eFFuuFFuuFFuuFFuFFFuFFFuFbbbbbbbbeeebeebebbeeebebbbbbebebbbbbbbbbebbbdbbbbbbbebbbebbbdbbbbbbbbbbbeeeeebebbebbebebbbeebbbbbbbbbbbbbbbbbbbbbc1Dkxebbbdbbb:GNbb",e=new Uint8Array([32,0,65,2,1,106,34,33,3,128,11,4,13,64,6,253,10,7,15,116,127,5,8,12,40,16,19,54,20,9,27,255,113,17,42,67,24,23,146,148,18,14,22,45,70,69,56,114,101,21,25,63,75,136,108,28,118,29,73,115]);if(typeof WebAssembly!="object")return{supported:!1};var r,a=WebAssembly.instantiate(s(t),{}).then(function(h){r=h.instance,r.exports.__wasm_call_ctors()});function s(h){for(var u=new Uint8Array(h.length),m=0;m<h.length;++m){var g=h.charCodeAt(m);u[m]=g>96?g-97:g>64?g-39:g+4}for(var y=0,m=0;m<h.length;++m)u[y++]=u[m]<60?e[u[m]]:(u[m]-60)*64+u[++m];return u.buffer.slice(0,y)}function n(h){if(!h)throw new Error("Assertion failed")}function i(h){return new Uint8Array(h.buffer,h.byteOffset,h.byteLength)}function o(h,u,m){var g=r.exports.sbrk,y=g(u.length*4),x=g(m*4),v=new Uint8Array(r.exports.memory.buffer),E=i(u);v.set(E,y);var S=h(x,y,u.length,m);v=new Uint8Array(r.exports.memory.buffer);var T=new Uint32Array(m);new Uint8Array(T.buffer).set(v.subarray(x,x+m*4)),E.set(v.subarray(y,y+u.length*4)),g(y-g(0));for(var _=0;_<u.length;++_)u[_]=T[u[_]];return[T,S]}function c(h){for(var u=0,m=0;m<h.length;++m){var g=h[m];u=u<g?g:u}return u}function l(h,u,m,g,y,x,v,E,S){var T=r.exports.sbrk,_=T(4),I=T(m*4),N=T(y*x),C=T(m*4),B=new Uint8Array(r.exports.memory.buffer);B.set(i(g),N),B.set(i(u),C);var R=h(I,C,m,N,y,x,v,E,S,_);B=new Uint8Array(r.exports.memory.buffer);var j=new Uint32Array(R);i(j).set(B.subarray(I,I+R*4));var q=new Float32Array(1);return i(q).set(B.subarray(_,_+4)),T(_-T(0)),[j,q[0]]}function f(h,u,m,g,y,x,v,E,S,T,_,I,N){var C=r.exports.sbrk,B=C(4),R=C(m*4),j=C(y*x),q=C(y*E),Y=C(S.length*4),te=C(m*4),ye=T?C(y):0,ne=new Uint8Array(r.exports.memory.buffer);ne.set(i(g),j),ne.set(i(v),q),ne.set(i(S),Y),ne.set(i(u),te),T&&ne.set(i(T),ye);var me=h(R,te,m,j,y,x,q,E,Y,S.length,ye,_,I,N,B);ne=new Uint8Array(r.exports.memory.buffer);var Ie=new Uint32Array(me);i(Ie).set(ne.subarray(R,R+me*4));var be=new Float32Array(1);return i(be).set(ne.subarray(B,B+4)),C(B-C(0)),[Ie,be[0]]}function d(h,u,m,g){var y=r.exports.sbrk,x=y(m*g),v=new Uint8Array(r.exports.memory.buffer);v.set(i(u),x);var E=h(x,m,g);return y(x-y(0)),E}function p(h,u,m,g,y,x,v,E){var S=r.exports.sbrk,T=S(E*4),_=S(m*g),I=S(m*x),N=new Uint8Array(r.exports.memory.buffer);N.set(i(u),_),y&&N.set(i(y),I);var C=h(T,_,m,g,I,x,v,E);N=new Uint8Array(r.exports.memory.buffer);var B=new Uint32Array(C);return i(B).set(N.subarray(T,T+C*4)),S(T-S(0)),B}var b={LockBorder:1,Sparse:2,ErrorAbsolute:4,Prune:8,_InternalDebug:1<<30};return{ready:a,supported:!0,compactMesh:function(h){n(h instanceof Uint32Array||h instanceof Int32Array||h instanceof Uint16Array||h instanceof Int16Array),n(h.length%3==0);var u=h.BYTES_PER_ELEMENT==4?h:new Uint32Array(h);return o(r.exports.meshopt_optimizeVertexFetchRemap,u,c(h)+1)},simplify:function(h,u,m,g,y,x){n(h instanceof Uint32Array||h instanceof Int32Array||h instanceof Uint16Array||h instanceof Int16Array),n(h.length%3==0),n(u instanceof Float32Array),n(u.length%m==0),n(m>=3),n(g>=0&&g<=h.length),n(g%3==0),n(y>=0);for(var v=0,E=0;E<(x?x.length:0);++E)n(x[E]in b),v|=b[x[E]];var S=h.BYTES_PER_ELEMENT==4?h:new Uint32Array(h),T=l(r.exports.meshopt_simplify,S,h.length,u,u.length/m,m*4,g,y,v);return T[0]=h instanceof Uint32Array?T[0]:new h.constructor(T[0]),T},simplifyWithAttributes:function(h,u,m,g,y,x,v,E,S,T){n(h instanceof Uint32Array||h instanceof Int32Array||h instanceof Uint16Array||h instanceof Int16Array),n(h.length%3==0),n(u instanceof Float32Array),n(u.length%m==0),n(m>=3),n(g instanceof Float32Array),n(g.length%y==0),n(y>=0),n(v==null||v instanceof Uint8Array),n(v==null||v.length==u.length/m),n(E>=0&&E<=h.length),n(E%3==0),n(S>=0),n(Array.isArray(x)),n(y>=x.length),n(x.length<=32);for(var _=0;_<x.length;++_)n(x[_]>=0);for(var I=0,_=0;_<(T?T.length:0);++_)n(T[_]in b),I|=b[T[_]];var N=h.BYTES_PER_ELEMENT==4?h:new Uint32Array(h),C=f(r.exports.meshopt_simplifyWithAttributes,N,h.length,u,u.length/m,m*4,g,y*4,new Float32Array(x),v?new Uint8Array(v):null,E,S,I);return C[0]=h instanceof Uint32Array?C[0]:new h.constructor(C[0]),C},getScale:function(h,u){return n(h instanceof Float32Array),n(h.length%u==0),n(u>=3),d(r.exports.meshopt_simplifyScale,h,h.length/u,u*4)},simplifyPoints:function(h,u,m,g,y,x){return n(h instanceof Float32Array),n(h.length%u==0),n(u>=3),n(m>=0&&m<=h.length/u),g?(n(g instanceof Float32Array),n(g.length%y==0),n(y>=3),n(h.length/u==g.length/y),p(r.exports.meshopt_simplifyPoints,h,h.length/u,u*4,g,y*4,x,m)):p(r.exports.meshopt_simplifyPoints,h,h.length/u,u*4,void 0,0,0,m)}}})();var $T=(function(){var t="b9H79TebbbeVx9Geueu9Geub9Gbb9Giuuueu9Gmuuuuuuuuuuu9999eu9Gvuuuuueu9Gwuuuuuuuub9Gxuuuuuuuuuuuueu9Gkuuuuuuuuuu99eu9Gouuuuuub9Gruuuuuuub9GluuuubiOHdilvorwDqqkbiibeilve9Weiiviebeoweuec;G:Odkr:Yewo9TW9T9VV95dbH9F9F939H79T9F9J9H229F9Jt9VV7bb8A9TW79O9V9Wt9F9I919P29K9nW79O2Wt79c9V919U9KbeX9TW79O9V9Wt9F9I919P29K9nW79O2Wt7bo39TW79O9V9Wt9F9J9V9T9W91tWJ2917tWV9c9V919U9K7br39TW79O9V9Wt9F9J9V9T9W91tW9nW79O2Wt9c9V919U9K7bDL9TW79O9V9Wt9F9V9Wt9P9T9P96W9nW79O2Wtbql79IV9RbkDwebcekdsPq;Q9BHdbkIbabaec9:fgefcufae9Ugeabci9Uadfcufad9Ugbaeab0Ek:w8KDPue99eux99dui99euo99iu8Jjjjjbc:WD9Rgm8KjjjjbdndnalmbcbhPxekamc:Cwfcbc;Kbz:njjjb8Adndnalcb9imbaoal9nmbamcuaocdtaocFFFFi0Egscbyd;y1jjbHjjjjbbgzBd:CwamceBd;8wamascbyd;y1jjbHjjjjbbgHBd:GwamcdBd;8wamcualcdtalcFFFFi0Ecbyd;y1jjbHjjjjbbgOBd:KwamciBd;8waihsalhAinazasydbcdtfcbBdbasclfhsaAcufgAmbkaihsalhAinazasydbcdtfgCaCydbcefBdbasclfhsaAcufgAmbkaihsalhCcbhXindnazasydbcdtgQfgAydbcb9imbaHaQfaXBdbaAaAydbgQcjjjj94VBdbaQaXfhXkasclfhsaCcufgCmbkalci9UhLdnalci6mbcbhsaihAinaAcwfydbhCaAclfydbhXaHaAydbcdtfgQaQydbgQcefBdbaOaQcdtfasBdbaHaXcdtfgXaXydbgXcefBdbaOaXcdtfasBdbaHaCcdtfgCaCydbgCcefBdbaOaCcdtfasBdbaAcxfhAaLascefgs9hmbkkaihsalhAindnazasydbcdtgCfgXydbgQcu9kmbaXaQcFFFFrGgQBdbaHaCfgCaCydbaQ9RBdbkasclfhsaAcufgAmbxdkkamcuaocdtgsaocFFFFi0EgAcbyd;y1jjbHjjjjbbgzBd:CwamceBd;8wamaAcbyd;y1jjbHjjjjbbgHBd:GwamcdBd;8wamcualcdtalcFFFFi0Ecbyd;y1jjbHjjjjbbgOBd:KwamciBd;8wazcbasz:njjjbhXalci9UhLaihsalhAinaXasydbcdtfgCaCydbcefBdbasclfhsaAcufgAmbkdnaoTmbcbhsaHhAaXhCaohQinaAasBdbaAclfhAaCydbasfhsaCclfhCaQcufgQmbkkdnalci6mbcbhsaihAinaAcwfydbhCaAclfydbhQaHaAydbcdtfgKaKydbgKcefBdbaOaKcdtfasBdbaHaQcdtfgQaQydbgQcefBdbaOaQcdtfasBdbaHaCcdtfgCaCydbgCcefBdbaOaCcdtfasBdbaAcxfhAaLascefgs9hmbkkaoTmbcbhsaohAinaHasfgCaCydbaXasfydb9RBdbasclfhsaAcufgAmbkkamaLcbyd;y1jjbHjjjjbbgsBd:OwamclBd;8wascbaLz:njjjbhYamcuaLcK2alcjjjjd0Ecbyd;y1jjbHjjjjbbg8ABd:SwamcvBd;8wJbbbbhEdnalci6g3mbarcd4hKaihAa8AhsaLhrJbbbbh5inavaAclfydbaK2cdtfgCIdlh8EavaAydbaK2cdtfgXIdlhEavaAcwfydbaK2cdtfgQIdlh8FaCIdwhaaXIdwhhaQIdwhgasaCIdbg8JaXIdbg8KMaQIdbg8LMJbbnn:vUdbasclfaXIdlaCIdlMaQIdlMJbbnn:vUdbaQIdwh8MaCIdwh8NaXIdwhyascxfa8EaE:tg8Eagah:tggNa8FaE:tg8Faaah:tgaN:tgEJbbbbJbbjZa8Ja8K:tg8Ja8FNa8La8K:tg8Ka8EN:tghahNaEaENaaa8KNaga8JN:tgEaENMM:rg8K:va8KJbbbb9BEg8ENUdbasczfaEa8ENUdbascCfaha8ENUdbascwfa8Maya8NMMJbbnn:vUdba5a8KMh5aAcxfhAascKfhsarcufgrmbka5aL:Z:vJbbbZNhEkamcuaLcdtalcFFFF970Ecbyd;y1jjbHjjjjbbgCBd:WwamcoBd;8waEaq:ZNhEdna3mbcbhsaChAinaAasBdbaAclfhAaLascefgs9hmbkkaE:rhhcuh8PamcuaLcltalcFFFFd0Ecbyd;y1jjbHjjjjbbgIBd:0wamcrBd;8wcbaIa8AaCaLz:djjjb8AJFFuuhyJFFuuh8RJFFuuh8Sdnalci6gXmbJFFuuh8Sa8AhsaLhAJFFuuh8RJFFuuhyinascwfIdbgEayayaE9EEhyasclfIdbgEa8Ra8RaE9EEh8RasIdbgEa8Sa8SaE9EEh8SascKfhsaAcufgAmbkkahJbbbZNhgamaocetgscuaocu9kEcbyd;y1jjbHjjjjbbgABd:4waAcFeasz:njjjbhCdnaXmbcbhAJFFuuhEa8Ahscuh8PinascwfIdbay:tghahNasIdba8S:tghahNasclfIdba8R:tghahNMM:rghaEa8PcuSahaE9DVgXEhEaAa8PaXEh8PascKfhsaLaAcefgA9hmbkkamczfcbcjwz:njjjb8Aamcwf9cb83ibam9cb83ibagaxNhRJbbjZak:th8Ncbh8UJbbbbh8VJbbbbh8WJbbbbh8XJbbbbh8YJbbbbh8ZJbbbbh80cbh81cbhPinJbbbbhEdna8UTmbJbbjZa8U:Z:vhEkJbbbbhhdna80a80Na8Ya8YNa8Za8ZNMMg8KJbbbb9BmbJbbjZa8K:r:vhhka8XaENh5a8WaENh8Fa8VaENhaa8PhQdndndndndna8UaPVTmbamydwgBTmea80ahNh8Ja8ZahNh8La8YahNh8Maeamydbcdtfh83cbh3JFFuuhEcvhXcuhQindnaza83a3cdtfydbcdtgsfydbgvTmbaOaHasfydbcdtfhAindndnaCaiaAydbgKcx2fgsclfydbgrcetf8Vebcs4aCasydbgLcetf8Vebcs4faCascwfydbglcetf8Vebcs4fgombcbhsxekcehsazaLcdtfydbgLceSmbcehsazarcdtfydbgrceSmbcehsazalcdtfydbglceSmbdnarcdSaLcdSfalcdSfcd6mbaocefhsxekaocdfhskdnasaX9kmba8AaKcK2fgLIdwa5:thhaLIdla8F:th8KaLIdbaa:th8EdndnakJbbbb9DTmba8E:lg8Ea8K:lg8Ka8Ea8K9EEg8Kah:lgha8Kah9EEag:vJbbjZMhhxekahahNa8Ea8ENa8Ka8KNMM:rag:va8NNJbbjZMJ9VO:d86JbbjZaLIdCa8JNaLIdxa8MNa8LaLIdzNMMakN:tghahJ9VO:d869DENhhkaKaQasaX6ahaE9DVgLEhQasaXaLEhXahaEaLEhEkaAclfhAavcufgvmbkka3cefg3aB9hmbkkaQcu9hmekama5Ud:ODama8FUd:KDamaaUd:GDamcuBd:qDamcFFF;7rBdjDaIcba8AaYamc:GDfakJbbbb9Damc:qDfamcjDfz:ejjjbamyd:qDhQdndnaxJbbbb9ETmba8UaD6mbaQcuSmeceh3amIdjDaR9EmixdkaQcu9hmekdna8UTmbdnamydlgza8Uci2fgsciGTmbadasfcba8Uazcu7fciGcefz:njjjb8AkabaPcltfgzam8Pib83dbazcwfamcwf8Pib83dbaPcefhPkc3hzinazc98Smvamc:Cwfazfydbcbyd;u1jjbH:bjjjbbazc98fhzxbkkcbh3a8Uaq9pmbamydwaCaiaQcx2fgsydbcetf8Vebcs4aCascwfydbcetf8Vebcs4faCasclfydbcetf8Vebcs4ffaw9nmekcbhscbhAdna81TmbcbhAamczfhXinamczfaAcdtfaXydbgLBdbaXclfhXaAaYaLfRbbTfhAa81cufg81mbkkamydwhlamydbhXam9cu83i:GDam9cu83i:ODam9cu83i:qDam9cu83i:yDaAc;8eaAclfc:bd6Eh81inamcjDfasfcFFF;7rBdbasclfgscz9hmbka81cdthBdnalTmbaeaXcdtfhocbhrindnazaoarcdtfydbcdtgsfydbgvTmbaOaHasfydbcdtfhAcuhLcuhsinazaiaAydbgKcx2fgXclfydbcdtfydbazaXydbcdtfydbfazaXcwfydbcdtfydbfgXasaXas6gXEhsaKaLaXEhLaAclfhAavcufgvmbkaLcuSmba8AaLcK2fgAIdway:tgEaENaAIdba8S:tgEaENaAIdla8R:tgEaENMM:rhEcbhAindndnasamc:qDfaAfgvydbgX6mbasaX9hmeaEamcjDfaAfIdb9FTmekavasBdbamc:GDfaAfaLBdbamcjDfaAfaEUdbxdkaAclfgAcz9hmbkkarcefgral9hmbkkamczfaBfhLcbhscbhAindnamc:GDfasfydbgXcuSmbaLaAcdtfaXBdbaAcefhAkasclfgscz9hmbkaAa81fg81TmbJFFuuhhcuhKamczfhsa81hvcuhLina8AasydbgXcK2fgAIdway:tgEaENaAIdba8S:tgEaENaAIdla8R:tgEaENMM:rhEdndnazaiaXcx2fgAclfydbcdtfydbazaAydbcdtfydbfazaAcwfydbcdtfydbfgAaL6mbaAaL9hmeaEah9DTmekaEhhaAhLaXhKkasclfhsavcufgvmbkaKcuSmbaKhQkdnamaiaQcx2fgrydbarclfydbarcwfydbaCabaeadaPawaqa3z:fjjjbTmbaPcefhPJbbbbh8VJbbbbh8WJbbbbh8XJbbbbh8YJbbbbh8ZJbbbbh80kcbhXinaOaHaraXcdtfydbcdtgAfydbcdtfgKhsazaAfgvydbgLhAdnaLTmbdninasydbaQSmeasclfhsaAcufgATmdxbkkasaKaLcdtfc98fydbBdbavavydbcufBdbkaXcefgXci9hmbka8AaQcK2fgsIdbhEasIdlhhasIdwh8KasIdxh8EasIdzh5asIdCh8FaYaQfce86bba80a8FMh80a8Za5Mh8Za8Ya8EMh8Ya8Xa8KMh8Xa8WahMh8Wa8VaEMh8Vamydxh8Uxbkkamc:WDf8KjjjjbaPk;Vvivuv99lu8Jjjjjbca9Rgv8Kjjjjbdndnalcw0mbaiydbhoaeabcitfgralcdtcufBdlaraoBdbdnalcd6mbaiclfhoalcufhwarcxfhrinaoydbhDarcuBdbarc98faDBdbarcwfhraoclfhoawcufgwmbkkalabfhrxekcbhDavczfcwfcbBdbav9cb83izavcwfcbBdbav9cb83ibJbbjZhqJbbjZhkinadaiaDcdtfydbcK2fhwcbhrinavczfarfgoawarfIdbgxaoIdbgm:tgPakNamMgmUdbavarfgoaPaxam:tNaoIdbMUdbarclfgrcx9hmbkJbbjZaqJbbjZMgq:vhkaDcefgDal9hmbkcbhoadcbcecdavIdlgxavIdwgm9GEgravIdbgPam9GEaraPax9GEgscdtgrfhzavczfarfIdbhxaihralhwinaiaocdtfgDydbhHaDarydbgOBdbaraHBdbarclfhraoazaOcK2fIdbax9Dfhoawcufgwmbkaeabcitfhrdndnaocv6mbaoalc98f6mekaraiydbBdbaralcdtcufBdlaiclfhoalcufhwarcxfhrinaoydbhDarcuBdbarc98faDBdbarcwfhraoclfhoawcufgwmbkalabfhrxekaraxUdbararydlc98GasVBdlabcefaeadaiaoz:djjjbhwararydlciGawabcu7fcdtVBdlawaeadaiaocdtfalao9Rz:djjjbhrkavcaf8Kjjjjbark:;idiud99dndnabaecitfgwydlgDciGgqciSmbinabcbaDcd4gDalaqcdtfIdbawIdb:tgkJbbbb9FEgwaecefgefadaialavaoarz:ejjjbak:larIdb9FTmdabawaD7aefgecitfgwydlgDciGgqci9hmbkkabaecitfgeclfhbdnavmbcuhwindnaiaeydbgDfRbbmbadaDcK2fgqIdwalIdw:tgkakNaqIdbalIdb:tgkakNaqIdlalIdl:tgkakNMM:rgkarIdb9DTmbarakUdbaoaDBdbkaecwfheawcefgwabydbcd46mbxdkkcuhwindnaiaeydbgDfRbbmbadaDcK2fgqIdbalIdb:t:lgkaqIdlalIdl:t:lgxakax9EEgkaqIdwalIdw:t:lgxakax9EEgkarIdb9DTmbarakUdbaoaDBdbkaecwfheawcefgwabydbcd46mbkkk;llevudnabydwgxaladcetfgm8Vebcs4alaecetfgP8Vebgscs4falaicetfgz8Vebcs4ffaD0abydxaq9pVakVgDce9hmbavawcltfgxab8Pdb83dbaxcwfabcwfgx8Pdb83dbdnaxydbgqTmbaoabydbcdtfhxaqhsinalaxydbcetfcFFi87ebaxclfhxascufgsmbkkdnabydxglci2gsabydlgxfgkciGTmbarakfcbalaxcu7fciGcefz:njjjb8Aabydxci2hsabydlhxabydwhqkab9cb83dwababydbaqfBdbabascifc98GaxfBdlaP8Vebhscbhxkdnascztcz91cu9kmbabaxcefBdwaPax87ebaoabydbcdtfaxcdtfaeBdbkdnam8Uebcu9kmbababydwgxcefBdwamax87ebaoabydbcdtfaxcdtfadBdbkdnaz8Uebcu9kmbababydwgxcefBdwazax87ebaoabydbcdtfaxcdtfaiBdbkarabydlfabydxci2faPRbb86bbarabydlfabydxci2fcefamRbb86bbarabydlfabydxci2fcdfazRbb86bbababydxcefBdxaDk8LbabaeadaialavaoarawaDaDaqJbbbbz:cjjjbk;Nkovud99euv99eul998Jjjjjbc:W;ae9Rgo8KjjjjbdndnadTmbavcd4hrcbhwcbhDindnaiaeclfydbar2cdtfgvIdbaiaeydbar2cdtfgqIdbgk:tgxaiaecwfydbar2cdtfgmIdlaqIdlgP:tgsNamIdbak:tgzavIdlaP:tgPN:tgkakNaPamIdwaqIdwgH:tgONasavIdwaH:tgHN:tgPaPNaHazNaOaxN:tgxaxNMM:rgsJbbbb9Bmbaoc:W:qefawcx2fgAakas:vUdwaAaxas:vUdlaAaPas:vUdbaoc8Wfawc8K2fgAaq8Pdb83dbaAav8Pdb83dxaAam8Pdb83dKaAcwfaqcwfydbBdbaAcCfavcwfydbBdbaAcafamcwfydbBdbawcefhwkaecxfheaDcifgDad6mbkab9cb83dbabcyf9cb83dbabcaf9cb83dbabcKf9cb83dbabczf9cb83dbabcwf9cb83dbawTmeaocbBd8Sao9cb83iKao9cb83izaoczfaoc8Wfawci2cxaoc8Sfcbcrz1jjjbaoIdKhCaoIdChXaoIdzhQao9cb83iwao9cb83ibaoaoc:W:qefawcxaoc8Sfcbciz1jjjbJbbjZhkaoIdwgPJbbbbJbbjZaPaPNaoIdbgPaPNaoIdlgsasNMM:rgx:vaxJbbbb9BEgzNhxasazNhsaPazNhzaoc:W:qefheawhvinaecwfIdbaxNaeIdbazNasaeclfIdbNMMgPakaPak9DEhkaecxfheavcufgvmbkabaCUdwabaXUdlabaQUdbabaoId3UdxdndnakJ;n;m;m899FmbJbbbbhPaoc:W:qefheaoc8WfhvinaCavcwfIdb:taecwfIdbgHNaQavIdb:taeIdbgONaXavclfIdb:taeclfIdbgLNMMaxaHNazaONasaLNMM:vgHaPaHaP9EEhPavc8KfhvaecxfheawcufgwmbkabaxUd8KabasUdaabazUd3abaCaxaPN:tUdKabaXasaPN:tUdCabaQazaPN:tUdzabJbbjZakakN:t:rgkUdydndnaxJbbj:;axJbbj:;9GEgPJbbjZaPJbbjZ9FEJbb;:9cNJbbbZJbbb:;axJbbbb9GEMgP:lJbbb9p9DTmbaP:Ohexekcjjjj94hekabae86b8UdndnasJbbj:;asJbbj:;9GEgPJbbjZaPJbbjZ9FEJbb;:9cNJbbbZJbbb:;asJbbbb9GEMgP:lJbbb9p9DTmbaP:Ohvxekcjjjj94hvkabav86bRdndnazJbbj:;azJbbj:;9GEgPJbbjZaPJbbjZ9FEJbb;:9cNJbbbZJbbb:;azJbbbb9GEMgP:lJbbb9p9DTmbaP:Ohqxekcjjjj94hqkabaq86b8SdndnaecKtcK91:YJbb;:9c:vax:t:lavcKtcK91:YJbb;:9c:vas:t:laqcKtcK91:YJbb;:9c:vaz:t:lakMMMJbb;:9cNJbbjZMgk:lJbbb9p9DTmbak:Ohexekcjjjj94hekaecFbaecFb9iEhexekabcjjj;8iBdycFbhekabae86b8Vxekab9cb83dbabcyf9cb83dbabcaf9cb83dbabcKf9cb83dbabczf9cb83dbabcwf9cb83dbkaoc:W;aef8Kjjjjbk;Iwwvul99iud99eue99eul998Jjjjjbcje9Rgr8Kjjjjbavcd4hwaicd4hDdndnaoTmbarc;abfcbaocdtgvz:njjjb8Aarc;Gbfcbavz:njjjb8AarhvarcafhiaohqinavcFFF97BdbaicFFF;7rBdbaiclfhiavclfhvaqcufgqmbkdnadTmbcbhkinaeakaD2cdtfgvIdwhxavIdlhmavIdbhPalakaw2cdtfIdbhsarc;abfhzarhiarc;GbfhHarcafhqcj1jjbhvaohOinasavcwfIdbaxNavIdbaPNavclfIdbamNMMgAMhCakhXdnaAas:tgAaqIdbgQ9DgLmbaHydbhXkaHaXBdbakhXdnaCaiIdbgK9EmbazydbhXaKhCkazaXBdbaiaCUdbaqaAaQaLEUdbavcxfhvaqclfhqaHclfhHaiclfhiazclfhzaOcufgOmbkakcefgkad9hmbkkadThkJbbbbhCcbhXarc;abfhvarc;Gbfhicbhqinalavydbgzaw2cdtfIdbalaiydbgHaw2cdtfIdbaeazaD2cdtfgzIdwaeaHaD2cdtfgHIdw:tgsasNazIdbaHIdb:tgsasNazIdlaHIdl:tgsasNMM:rMMgsaCasaC9EgzEhCaqaXazEhXaiclfhiavclfhvaoaqcefgq9hmbkaCJbbbZNhKxekadThkcbhXJbbbbhKkJbbbbhCdnaearc;abfaXcdtgifydbgqaD2cdtfgvIdwaearc;GbfaifydbgzaD2cdtfgiIdwgm:tgsasNavIdbaiIdbgY:tgAaANavIdlaiIdlgP:tgQaQNMM:rgxJbbbb9ETmbaxalaqaw2cdtfIdbMalazaw2cdtfIdb:taxaxM:vhCkasaCNamMhmaQaCNaPMhPaAaCNaYMhYdnakmbaDcdthvawcdthiindnalIdbg8AaecwfIdbam:tgCaCNaeIdbaY:tgsasNaeclfIdbaP:tgAaANMM:rgQMgEaK9ETmbJbbbbhxdnaQJbbbb9ETmbaEaK:taQaQM:vhxkaxaCNamMhmaxaANaPMhPaxasNaYMhYa8AaKaQMMJbbbZNhKkaeavfhealaifhladcufgdmbkkabaKUdxabamUdwabaPUdlabaYUdbarcjef8Kjjjjbkjeeiu8Jjjjjbcj8W9Rgr8Kjjjjbaici2hwdnaiTmbawceawce0EhDarhiinaiaeadRbbcdtfydbBdbadcefhdaiclfhiaDcufgDmbkkabarawaladaoz:hjjjbarcj8Wf8Kjjjjbk:3lequ8JjjjjbcjP9Rgl8Kjjjjbcbhvalcjxfcbaiz:njjjb8AdndnadTmbcjehoaehrincuhwarhDcuhqavhkdninawakaoalcjxfaDcefRbbfRbb9RcFeGci6aoalcjxfaDRbbfRbb9RcFeGci6faoalcjxfaDcdfRbbfRbb9RcFeGci6fgxaq9mgmEhwdnammbaxce0mdkaxaqaxaq9kEhqaDcifhDadakcefgk9hmbkkaeawci2fgDcdfRbbhqaDcefRbbhxaDRbbhkaeavci2fgDcifaDawav9Rci2z:qjjjb8Aakalcjxffaocefgo86bbaxalcjxffao86bbaDcdfaq86bbaDcefax86bbaDak86bbaqalcjxffao86bbarcifhravcefgvad9hmbkalcFeaicetz:njjjbhoadci2gDceaDce0EhqcbhxindnaoaeRbbgkcetfgw8UebgDcu9kmbawax87ebaocjlfaxcdtfabakcdtfydbBdbaxhDaxcefhxkaeaD86bbaecefheaqcufgqmbkaxcdthDxekcbhDkabalcjlfaDz:mjjjb8AalcjPf8Kjjjjbk9teiucbcbyd;C1jjbgeabcifc98GfgbBd;C1jjbdndnabZbcztgd9nmbcuhiabad9RcFFifcz4nbcuSmekaehikaik;teeeudndnaeabVciGTmbabhixekdndnadcz9pmbabhixekabhiinaiaeydbBdbaiaeydlBdlaiaeydwBdwaiaeydxBdxaeczfheaiczfhiadc9Wfgdcs0mbkkadcl6mbinaiaeydbBdbaeclfheaiclfhiadc98fgdci0mbkkdnadTmbinaiaeRbb86bbaicefhiaecefheadcufgdmbkkabk:3eedudndnabciGTmbabhixekaecFeGc:b:c:ew2hldndnadcz9pmbabhixekabhiinaialBdxaialBdwaialBdlaialBdbaiczfhiadc9Wfgdcs0mbkkadcl6mbinaialBdbaiclfhiadc98fgdci0mbkkdnadTmbinaiae86bbaicefhiadcufgdmbkkabk9teiucbcbyd;C1jjbgeabcrfc94GfgbBd;C1jjbdndnabZbcztgd9nmbcuhiabad9RcFFifcz4nbcuSmekaehikaik9:eiuZbhedndncbyd;C1jjbgdaecztgi9nmbcuheadai9RcFFifcz4nbcuSmekadhekcbabae9Rcifc98Gcbyd;C1jjbfgdBd;C1jjbdnadZbcztge9nmbadae9RcFFifcz4nb8Akk:;Deludndndnadch9pmbabaeSmdaeabadfgi9Rcbadcet9R0mekabaead;8qbbxekaeab7ciGhldndndnabae9pmbdnalTmbadhvabhixikdnabciGmbadhvabhixdkadTmiabaeRbb86bbadcufhvdnabcefgiciGmbaecefhexdkavTmiabaeRbe86beadc9:fhvdnabcdfgiciGmbaecdfhexdkavTmiabaeRbd86bdadc99fhvdnabcifgiciGmbaecifhexdkavTmiabaeRbi86biabclfhiaeclfheadc98fhvxekdnalmbdnaiciGTmbadTmlabadcufgifglaeaifRbb86bbdnalciGmbaihdxekaiTmlabadc9:fgifglaeaifRbb86bbdnalciGmbaihdxekaiTmlabadc99fgifglaeaifRbb86bbdnalciGmbaihdxekaiTmlabadc98fgdfaeadfRbb86bbkadcl6mbdnadc98fgocd4cefciGgiTmbaec98fhlabc98fhvinavadfaladfydbBdbadc98fhdaicufgimbkkaocx6mbaec9Wfhvabc9WfhoinaoadfgicxfavadfglcxfydbBdbaicwfalcwfydbBdbaiclfalclfydbBdbaialydbBdbadc9Wfgdci0mbkkadTmdadhidnadciGglTmbaecufhvabcufhoadhiinaoaifavaifRbb86bbaicufhialcufglmbkkadcl6mdaec98fhlabc98fhvinavaifgecifalaifgdcifRbb86bbaecdfadcdfRbb86bbaecefadcefRbb86bbaeadRbb86bbaic98fgimbxikkavcl6mbdnavc98fglcd4cefcrGgdTmbavadcdt9RhvinaiaeydbBdbaeclfheaiclfhiadcufgdmbkkalc36mbinaiaeydbBdbaiaeydlBdlaiaeydwBdwaiaeydxBdxaiaeydzBdzaiaeydCBdCaiaeydKBdKaiaeyd3Bd3aecafheaicafhiavc9Gfgvci0mbkkavTmbdndnavcrGgdmbavhlxekavc94GhlinaiaeRbb86bbaicefhiaecefheadcufgdmbkkavcw6mbinaiaeRbb86bbaiaeRbe86beaiaeRbd86bdaiaeRbi86biaiaeRbl86blaiaeRbv86bvaiaeRbo86boaiaeRbr86braicwfhiaecwfhealc94fglmbkkabkk9Tdbcjwk9ubbjZbbbbbbbbbbbbbbjZbbbbbbbbbbbbbbjZ86;nAZ86;nAZ86;nAZ86;nA:;86;nAZ86;nAZ86;nAZ86;nA:;86;nAZ86;nAZ86;nAZ86;nA:;bc;uwkxebbbdbbb9GNbb",e=new Uint8Array([32,0,65,2,1,106,34,33,3,128,11,4,13,64,6,253,10,7,15,116,127,5,8,12,40,16,19,54,20,9,27,255,113,17,42,67,24,23,146,148,18,14,22,45,70,69,56,114,101,21,25,63,75,136,108,28,118,29,73,115]);if(typeof WebAssembly!="object")return{supported:!1};var r,a=WebAssembly.instantiate(s(t),{}).then(function(h){r=h.instance,r.exports.__wasm_call_ctors()});function s(h){for(var u=new Uint8Array(h.length),m=0;m<h.length;++m){var g=h.charCodeAt(m);u[m]=g>96?g-97:g>64?g-39:g+4}for(var y=0,m=0;m<h.length;++m)u[y++]=u[m]<60?e[u[m]]:(u[m]-60)*64+u[++m];return u.buffer.slice(0,y)}function n(h){if(!h)throw new Error("Assertion failed")}function i(h){return new Uint8Array(h.buffer,h.byteOffset,h.byteLength)}var o=48,c=16;function l(h,u){var m=h.meshlets[u*4+0],g=h.meshlets[u*4+1],y=h.meshlets[u*4+2],x=h.meshlets[u*4+3];return{vertices:h.vertices.subarray(m,m+y),triangles:h.triangles.subarray(g,g+x*3)}}function f(h,u,m,g,y,x,v){var E=r.exports.sbrk,S=r.exports.meshopt_buildMeshletsBound(h.length,y,x),T=E(S*c),_=E(S*y*4),I=E(S*x*3),N=E(h.byteLength),C=E(u.byteLength),B=new Uint8Array(r.exports.memory.buffer);B.set(i(h),N),B.set(i(u),C);var R=r.exports.meshopt_buildMeshlets(T,_,I,N,h.length,C,m,g,y,x,v);B=new Uint8Array(r.exports.memory.buffer);for(var j=B.subarray(T,T+R*c),q=new Uint32Array(j.buffer,j.byteOffset,j.byteLength/4).slice(),Y=0;Y<R;++Y){var te=q[Y*4+0],ye=q[Y*4+1],m=q[Y*4+2],ne=q[Y*4+3];r.exports.meshopt_optimizeMeshlet(_+te*4,I+ye,ne,m)}var me=q[(R-1)*4+0],Ie=q[(R-1)*4+1],be=q[(R-1)*4+2],Ce=q[(R-1)*4+3],xe=me+be,De=Ie+(Ce*3+3&-4),Be={meshlets:q,vertices:new Uint32Array(B.buffer,_,xe).slice(),triangles:new Uint8Array(B.buffer,I,De*3).slice(),meshletCount:R};return E(T-E(0)),Be}function d(h){var u=new Float32Array(r.exports.memory.buffer,h,o/4);return{centerX:u[0],centerY:u[1],centerZ:u[2],radius:u[3],coneApexX:u[4],coneApexY:u[5],coneApexZ:u[6],coneAxisX:u[7],coneAxisY:u[8],coneAxisZ:u[9],coneCutoff:u[10]}}function p(h,u,m,g){var y=r.exports.sbrk,x=[],v=y(u.byteLength),E=y(h.vertices.byteLength),S=y(h.triangles.byteLength),T=y(o),_=new Uint8Array(r.exports.memory.buffer);_.set(i(u),v),_.set(i(h.vertices),E),_.set(i(h.triangles),S);for(var I=0;I<h.meshletCount;++I){var N=h.meshlets[I*4+0],C=h.meshlets[I*4+0+1],B=h.meshlets[I*4+0+3];r.exports.meshopt_computeMeshletBounds(T,E+N*4,S+C,B,v,m,g),x.push(d(T))}return y(v-y(0)),x}function b(h,u,m,g){var y=r.exports.sbrk,x=y(o),v=y(h.byteLength),E=y(u.byteLength),S=new Uint8Array(r.exports.memory.buffer);S.set(i(h),v),S.set(i(u),E),r.exports.meshopt_computeClusterBounds(x,v,h.length,E,m,g);var T=d(x);return y(x-y(0)),T}return{ready:a,supported:!0,buildMeshlets:function(h,u,m,g,y,x){n(h.length%3==0),n(u instanceof Float32Array),n(u.length%m==0),n(m>=3),n(g<=256||g>0),n(y<=512),n(y%4==0),x=x||0;var v=h.BYTES_PER_ELEMENT==4?h:new Uint32Array(h);return f(v,u,u.length/m,m*4,g,y,x)},computeClusterBounds:function(h,u,m){n(h.length%3==0),n(h.length/3<=512),n(u instanceof Float32Array),n(u.length%m==0),n(m>=3);var g=h.BYTES_PER_ELEMENT==4?h:new Uint32Array(h);return b(g,u,u.length/m,m*4)},computeMeshletBounds:function(h,u,m){return n(h.meshletCount!=0),n(u instanceof Float32Array),n(u.length%m==0),n(m>=3),p(h,u,u.length/m,m*4)},extractMeshlet:function(h,u){return n(u>=0&&u<h.meshletCount),l(h,u)}}})();var Sd=new Ql().registerExtensions([Ki,Vi,Hi]).registerDependencies({"meshopt.decoder":Bs});async function fa(t,e={}){await Bs.ready;let r;if(e.fetchBytes)r=new Uint8Array(await e.fetchBytes(t));else{let c=await fetch(t,{cache:e.fetchCache||"no-store"});if(!c.ok)throw new Error(`Failed to load ${t}: ${c.status}`);r=new Uint8Array(await c.arrayBuffer())}let a=await Sd.readBinary(r),s=[],n=e.componentFeatures||new Map,i=new Map;function o(c,l=""){let f=n.has(c.getName());f&&i.set(c.getName(),(i.get(c.getName())||0)+1);let d=f?c.getName():l,p=c.getMesh();if(p){let b=c.getWorldMatrix();for(let h of p.listPrimitives()){let u=h.getAttribute("POSITION"),m=h.getAttribute("NORMAL"),g=h.getAttribute("_FEATURE_ID_0"),y=h.getAttribute("_FEATURE_ID_1"),x=h.getIndices()?.getArray();if(!u||!x)continue;let v=u.getCount(),E=new Float32Array(v*3),S=new Float32Array(v*3),T=new Uint32Array(v),_=new Uint32Array(v),I=[1/0,1/0,1/0,-1/0,-1/0,-1/0],N=[],C=n.get(d)?.featureId||e.defaultFeatureId||0;for(let R=0;R<v;R+=1)u.getElement(R,N),cx(E,R*3,N,b),I[0]=Math.min(I[0],E[R*3]),I[1]=Math.min(I[1],E[R*3+1]),I[2]=Math.min(I[2],E[R*3+2]),I[3]=Math.max(I[3],E[R*3]),I[4]=Math.max(I[4],E[R*3+1]),I[5]=Math.max(I[5],E[R*3+2]),m?(m.getElement(R,N),lx(S,R*3,N,b)):S.set([0,0,1],R*3),T[R]=Number(g?.getScalar(R)||0),_[R]=Number(y?y.getScalar(R)||0:C);let B=h.getMaterial();s.push({position:E,normal:S,netId:T,objectFeatureId:_,indices:x,designator:d,nodeName:c.getName(),meshName:p.getName(),bounds:I,material:B?{name:B.getName(),baseColor:B.getBaseColorFactor(),metallic:B.getMetallicFactor(),roughness:B.getRoughnessFactor(),emissive:B.getEmissiveFactor()}:{baseColor:e.baseColor||[.55,.58,.64,1],metallic:.05,roughness:.72,emissive:[0,0,0]}})}}for(let b of c.listChildren())o(b,d)}for(let c of a.getRoot().listScenes())for(let l of c.listChildren())o(l);return{byteLength:r.byteLength,primitives:s,componentNodeCounts:i}}function cx(t,e,r,a){let s=a[0]*r[0]+a[4]*r[1]+a[8]*r[2]+a[12],n=a[1]*r[0]+a[5]*r[1]+a[9]*r[2]+a[13],i=a[2]*r[0]+a[6]*r[1]+a[10]*r[2]+a[14];t[e]=s,t[e+1]=-i,t[e+2]=n}function lx(t,e,r,a){let s=a[0]*r[0]+a[4]*r[1]+a[8]*r[2],n=a[1]*r[0]+a[5]*r[1]+a[9]*r[2],i=a[2]*r[0]+a[6]*r[1]+a[10]*r[2],o=Math.hypot(s,n,i)||1;t[e]=s/o,t[e+1]=-i/o,t[e+2]=n/o}async function Td(t,e={}){await Bs.ready;let r;if(e.fetchBytes)r=new Uint8Array(await e.fetchBytes(t));else{let d=await fetch(t,{cache:e.fetchCache||"no-store"});if(!d.ok)throw new Error(`Failed to load ${t}: ${d.status}`);r=new Uint8Array(await d.arrayBuffer())}let a=await Sd.readBinary(r),s=e.componentFeatures||new Map,n=new Map,i=new Map,o=new Map,c=0;function l(d){if(o.has(d))return o.get(d);let p=d.getAttribute("POSITION"),b=d.getIndices()?.getArray();if(!p||!b)return o.set(d,null),null;let h=d.getAttribute("NORMAL"),u=d.getAttribute("_FEATURE_ID_0"),m=d.getAttribute("_FEATURE_ID_1"),g=p.getCount(),y=new Float32Array(g*3),x=new Float32Array(g*3),v=new Uint32Array(g),E=new Uint32Array(g),S=[];for(let C=0;C<g;C+=1)p.getElement(C,S),y.set(S.slice(0,3),C*3),h?(h.getElement(C,S),x.set(S.slice(0,3),C*3)):x.set([0,1,0],C*3),v[C]=Number(u?.getScalar(C)||0),E[C]=Number(m?.getScalar(C)||0);let T=fx(d.getMaterial(),e),_=[ua(y),ua(x),ua(v),ua(E),ua(b),g,b.length,JSON.stringify(T)].join(":"),I=i.get(_),N=I;return(!I||!hx(I.primitive,y,x,v,E,b))&&(N={primitive:{position:y,normal:x,netId:v,objectFeatureId:E,indices:Uint32Array.from(b),material:T,bounds:null},placements:[]},i.set(I?`${_}:${i.size}`:_,N)),o.set(d,N),N}function f(d,p=""){let b=s.has(d.getName());b&&n.set(d.getName(),(n.get(d.getName())||0)+1);let h=b?d.getName():p,u=d.getMesh();if(u){let m=dx(d.getWorldMatrix()),g=Number(s.get(h)?.featureId||e.defaultFeatureId||0),y=c++;for(let x of u.listPrimitives()){let v=l(x);if(!v)continue;let E=ux(v.primitive.position,m);v.placements.push({rows:m,featureId:g,designator:h,bounds:E,node:y});let S=v.primitive.bounds;v.primitive.bounds=S?[Math.min(S[0],E[0]),Math.min(S[1],E[1]),Math.min(S[2],E[2]),Math.max(S[3],E[3]),Math.max(S[4],E[4]),Math.max(S[5],E[5])]:[...E]}}for(let m of d.listChildren())f(m,h)}for(let d of a.getRoot().listScenes())for(let p of d.listChildren())f(p);return{byteLength:r.byteLength,models:[...i.values()],componentNodeCounts:n}}function dx(t){return[t[0],t[4],t[8],t[12],-t[2],-t[6],-t[10],-t[14],t[1],t[5],t[9],t[13]]}function ux(t,e){let r=[1/0,1/0,1/0,-1/0,-1/0,-1/0];for(let a=0;a<t.length;a+=3){let s=t[a],n=t[a+1],i=t[a+2];for(let o=0;o<3;o+=1){let c=o*4,l=e[c]*s+e[c+1]*n+e[c+2]*i+e[c+3];l<r[o]&&(r[o]=l),l>r[o+3]&&(r[o+3]=l)}}return r}function fx(t,e){return t?{name:t.getName(),baseColor:t.getBaseColorFactor(),metallic:t.getMetallicFactor(),roughness:t.getRoughnessFactor(),emissive:t.getEmissiveFactor()}:{baseColor:e.baseColor||[.55,.58,.64,1],metallic:.05,roughness:.72,emissive:[0,0,0]}}function ua(t){let e=t.BYTES_PER_ELEMENT===4?new Uint32Array(t.buffer,t.byteOffset,t.length):t,r=2166136261;for(let a=0;a<e.length;a+=1)r^=e[a],r=Math.imul(r,16777619)>>>0;return r.toString(36)}function hx(t,e,r,a,s,n){let i=(o,c)=>o.length===c.length&&o.every((l,f)=>l===c[f]);return i(t.position,e)&&i(t.normal,r)&&i(t.netId,a)&&i(t.objectFeatureId,s)&&i(t.indices,n)}var fr=Object.freeze({mm:1,fineMm:.1,deg:15,fineDeg:1}),qi=Object.freeze([[1,0,0],[0,1,0],[0,0,1]]);function Ad(t){return Math.round(t*1e9)/1e9+0}function tr(t){let e=Math.hypot(...t.rotation)||1,r=t.rotation.map(s=>s/e),a=[r[3],r[0],r[1],r[2]].find(s=>Math.abs(s)>1e-12)??1;return{translationMm:t.translationMm.map(Ad),rotation:r.map(s=>Ad(a<0?-s:s))}}function bx(t){let[e,r,a,s]=t.rotation,[n,i,o]=t.translationMm;return[1-2*(r*r+a*a),2*(e*r+a*s),2*(e*a-r*s),0,2*(e*r-a*s),1-2*(e*e+a*a),2*(r*a+e*s),0,2*(e*a+r*s),2*(r*a-e*s),1-2*(e*e+r*r),0,n,i,o,1]}function _d(t,e){let r=new Array(16);for(let a=0;a<4;a+=1)for(let s=0;s<4;s+=1)r[a*4+s]=t[s]*e[a*4]+t[4+s]*e[a*4+1]+t[8+s]*e[a*4+2]+t[12+s]*e[a*4+3];return r}function px(t){let e=[t[0],t[4],t[8],0,t[1],t[5],t[9],0,t[2],t[6],t[10],0,0,0,0,1];for(let r=0;r<3;r+=1)e[12+r]=-(e[r]*t[12]+e[4+r]*t[13]+e[8+r]*t[14]);return e}function Os(t,e){return e>0?Math.round(t/e)*e:t}function Wi(t,e){let r=e[0]**2+e[1]**2;return r<1e-9?0:(t[0]*e[0]+t[1]*e[1])/r}function Id(t,e,r){let a=Math.atan2(e[1]-t[1],e[0]-t[0]),n=Math.atan2(r[1]-t[1],r[0]-t[0])-a;for(;n>Math.PI;)n-=2*Math.PI;for(;n<-Math.PI;)n+=2*Math.PI;return n}function Rd(t,e,r){return ot(t,e)>=0?-r:r}function Nd(t){return qi.map(e=>Ei(t.rotation,e))}function Cd(t,e,r){return{translationMm:t.translationMm.map((a,s)=>a+e[s]*r),rotation:[...t.rotation]}}function Bd(t,e,r,a){let s=ll(e,r),n=t.translationMm.map((o,c)=>o-a[c]);return{translationMm:Ei(s,n).map((o,c)=>o+a[c]),rotation:us(s,t.rotation)}}function Od(t,e){if(e==null)return null;let r=`/${String(e).split("/")[1]||""}`;return(t?.occurrences||[]).find(a=>a.path===r&&a.depth===1)??null}function Fd(t,e,r){let a=t.occurrences.find(o=>o.path===e);if(!a||a.depth!==1)return t;let s=bx(r),n=_d(s,px(a.worldMatrix)),i=`${e}/`;return{...t,occurrences:t.occurrences.map(o=>o.path===e?{...o,pose:{...tr(r),source:"manual"},worldMatrix:s}:o.path.startsWith(i)?{...o,worldMatrix:_d(n,o.worldMatrix)}:o)}}function Pd(t){let e=Math.abs(t[0])<.9?[1,0,0]:[0,1,0];return Qe(Ze(t,e))}var gx=Object.freeze([0,1,1,0]),ha=`
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
`,rt=Object.freeze([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);function mx(t){let e=t?.matrix??t;if(!e||typeof e.length!="number"||e.length!==16)throw new TypeError("An occurrence matrix must have 16 numbers (column-major)");let r=Array.from(e,Number);if(!r.every(Number.isFinite))throw new TypeError("An occurrence matrix must be finite");if(r[3]!==0||r[7]!==0||r[11]!==0||r[15]!==1)throw new TypeError("An occurrence matrix must be affine (last row 0 0 0 1)");return r}function yx(t){let[e,r,a,,s,n,i,,o,c,l]=t,f=n*l-c*i,d=c*a-r*l,p=r*i-n*a,b=o*i-s*l,h=e*l-o*a,u=s*a-e*i,m=s*c-o*n,g=o*r-e*c,y=e*n-s*r,x=e*f+s*d+o*p;if(x===0)throw new TypeError("An occurrence matrix must be invertible");let v=x<0?-1:1;return[v*f,v*b,v*m,0,v*d,v*h,v*g,0,v*p,v*u,v*y,0,0,0,0,1]}function xx(t){let e=new Uint32Array(4);for(let r of t||[]){let a=Number(r);!Number.isInteger(a)||a<0||a>=128||(e[a>>>5]|=1<<(a&31)>>>0)}return e}function Fs(t,e=[],r=[]){let a=new Float32Array(Math.max(1,t.length)*40),s=new Uint32Array(a.buffer);return t.forEach((n,i)=>{let o=i*40;a.set(n,o),a.set(yx(n),o+16),e[i]&&s.set(xx(e[i]),o+32),a.set(r[i]||gx,o+36)}),a}function Ps(t,e){let[r,a,s]=e;return[t[0]*r+t[4]*a+t[8]*s+t[12],t[1]*r+t[5]*a+t[9]*s+t[13],t[2]*r+t[6]*a+t[10]*s+t[14]]}function Tt(t,e){if(!e)return null;let r=[1/0,1/0,1/0,-1/0,-1/0,-1/0];for(let a=0;a<8;a+=1){let s=Ps(t,[e[a&1?3:0],e[a&2?4:1],e[a&4?5:2]]);for(let n=0;n<3;n+=1)r[n]=Math.min(r[n],s[n]),r[n+3]=Math.max(r[n+3],s[n])}return r}function js(t){return t.every((e,r)=>e===rt[r])}var wx=0,vx=4294901759;function jd(t,e){let r=t>>>0,a=e>>>0;return r===wx?{kind:"none",occurrenceIndex:-1,featureId:0}:{kind:a?"feature":"board",occurrenceIndex:r-1,featureId:a}}function Ld(t){let e=Array.from(t);if(e.length>vx)throw new RangeError("Too many occurrences for the pick target");let r=e.map(mx),a=o=>o&&!Array.isArray(o)&&!ArrayBuffer.isView(o),s=e.map((o,c)=>a(o)&&o.key!=null?String(o.key):String(c));if(new Set(s).size!==s.length)throw new TypeError("Occurrence keys must be unique");let n=e.map(o=>a(o)&&o.hiddenLayers?[...o.hiddenLayers].map(Number):[]),i=e.map(o=>a(o)&&o.explode?[...o.explode].map(Number):null);return{matrices:r,keys:s,hiddenLayers:n,explode:i}}function ba(t,e,r){let[a,s,n]=e,i=t[0]*a+t[4]*s+t[8]*n+t[12],o=t[1]*a+t[5]*s+t[9]*n+t[13],c=t[2]*a+t[6]*s+t[10]*n+t[14],l=t[3]*a+t[7]*s+t[11]*n+t[15];return!(l>0)||c<0||c>l?null:{x:r.x+(i/l*.5+.5)*r.width,y:r.y+(.5-o/l*.5)*r.height}}var Ls=0;var Dd=3,Xi=4,cA=Object.freeze(["full","board","body","box"]),dt=Object.freeze({fullPx:140,boardPx:70,boxPx:18,keep:.8});function Nr(t={}){let e=(i,o)=>Number.isFinite(Number(t[i]))?Math.max(0,Number(t[i])):o,r=e("boxPx",dt.boxPx),a=Math.max(r,e("boardPx",dt.boardPx)),s=Math.max(a,e("fullPx",dt.fullPx)),n=Math.min(1,Math.max(.05,e("keep",dt.keep)));return{fullPx:s,boardPx:a,boxPx:r,keep:n}}function Ud(t){let e=c=>[t[c],t[4+c],t[8+c],t[12+c]],[r,a,s,n]=[e(0),e(1),e(2),e(3)],i=(c,l)=>c.map((f,d)=>f+l[d]),o=(c,l)=>c.map((f,d)=>f-l[d]);return[i(n,r),o(n,r),i(n,a),o(n,a),s,o(n,s)]}var pa=class{constructor(e,r,a,s=16777216){this.device=e,this.usage=r|zd.COPY_SRC|zd.COPY_DST,this.label=a,this.chunkBytes=s,this.chunks=[],this.usedBytes=0,this.generation=0,this.repacks=0}alloc(e){let a={buffer:null,offset:0,size:Math.max(4,Math.ceil(e/4)*4),chunk:null};return this.place(a,null),a}place(e,r){let{size:a}=e,s=null;if(a<=this.chunkBytes/2)for(let o of this.chunks)o===r||o.dedicated||o.free.forEach((c,l)=>{c.size>=a&&(!s||c.size<s.range.size)&&(s={chunk:o,index:l,range:c})});let n,i;if(s)({chunk:n}=s),i=s.range.offset,s.range.size===a?n.free.splice(s.index,1):n.free[s.index]={offset:i+a,size:s.range.size-a};else{let o=a>this.chunkBytes/2,c=o?a:this.chunkBytes;n={buffer:this.device.createBuffer({label:`${this.label}-${this.chunks.length}`,size:c,usage:this.usage}),size:c,free:c>a?[{offset:a,size:c-a}]:[],used:0,live:new Set,dedicated:o},this.chunks.push(n),i=0}n.used+=a,n.live.add(e),this.usedBytes+=a,Object.assign(e,{buffer:n.buffer,offset:i,chunk:n})}write(e,r){this.device.queue.writeBuffer(e.buffer,e.offset,r)}free(e){let{chunk:r}=e;if(!(!r||!r.live.has(e))){if(this.release(r,e),e.chunk=null,!r.live.size){this.drop(r);return}!r.dedicated&&r.used<r.size*.5&&this.chunks.length>1&&this.repack(r)}}release(e,r){e.used-=r.size,e.live.delete(r),this.usedBytes-=r.size;let a=e.free,s=a.findIndex(n=>n.offset>r.offset);s<0&&(s=a.length),a.splice(s,0,{offset:r.offset,size:r.size}),s+1<a.length&&a[s].offset+a[s].size===a[s+1].offset&&(a[s].size+=a[s+1].size,a.splice(s+1,1)),s>0&&a[s-1].offset+a[s-1].size===a[s].offset&&(a[s-1].size+=a[s].size,a.splice(s,1))}drop(e){e.buffer.destroy?.(),this.chunks.splice(this.chunks.indexOf(e),1)}repack(e){let r=this.device.createCommandEncoder({label:`${this.label}-repack`});for(let a of[...e.live]){let s={buffer:a.buffer,offset:a.offset};this.release(e,a),this.place(a,e),r.copyBufferToBuffer(s.buffer,s.offset,a.buffer,a.offset,a.size)}this.device.queue.submit([r.finish()]),this.drop(e),this.generation+=1,this.repacks+=1}reservedBytes(){return this.chunks.reduce((e,r)=>e+r.size,0)}destroy(){for(let e of this.chunks)e.buffer.destroy?.();this.chunks=[],this.usedBytes=0}},zd=globalThis.GPUBufferUsage||{COPY_SRC:4,COPY_DST:8};var $i=Object.freeze(["decl","vs-out","vs-end","fs-begin","fs-return"]),Mx={decl:"decl","vs-out":"vsOut","vs-end":"vsEnd","fs-begin":"fsBegin"},kx=/^[ \t]*\/\/ @feature:[a-z-]+\n/gm;function de(t){if(!$i.includes(t))throw new Error(`Unknown shader hook ${t}`);return`// @feature:${t}
`}function Pe(t){return t.replace(kx,"")}function Yi(t){return ga(t).map(e=>e.name).join("+")}function ga(t=[]){let e=new Set;for(let r of t){if(!r?.name||!/^[a-z][a-z0-9-]*$/.test(r.name))throw new Error(`Bad shader feature name ${r?.name}`);if(e.has(r.name))throw new Error(`Shader feature ${r.name} given twice`);e.add(r.name)}return[...t].sort((r,a)=>r.name<a.name?-1:r.name>a.name?1:0)}function Ex(t,e="shader"){for(let r of $i){let a=Ji(t,r).length;if(a!==1)throw new Error(`${e}: hook ${r} appears ${a} times, expected once`)}Kd(t,e)}function Gd(t,e=[],r={}){let a=ga(e);if(!a.length)return Pe(t);let s=`${r.family||"shader"}${r.instanced?" (instanced)":""}`;Ex(t,s);let n=t;for(let i of $i){if(i==="fs-return"){let{start:d,end:p,indent:b,expression:h}=Kd(n,s),u=a.reduce((m,g)=>g.fsReturn?g.fsReturn(m,r):m,h);n=`${n.slice(0,d)}${b}return ${u};
${n.slice(p)}`;continue}let o=Mx[i],c=a.map(d=>d[o]?.(r)).filter(Boolean),[l]=Ji(n,i),f=c.map(d=>d.endsWith(`
`)?d:`${d}
`).join("");n=`${n.slice(0,l.index)}${f}${n.slice(l.index+l[0].length)}`}return Pe(n)}function Ji(t,e){return[...t.matchAll(new RegExp(`^[ \\t]*// @feature:${e}\\n`,"gm"))]}function Kd(t,e){let[r]=Ji(t,"fs-return"),a=r.index+r[0].length,s=t.slice(a).match(/^([ \t]*)return (.+);\n/);if(!s)throw new Error(`${e}: hook fs-return is not followed by a return line`);return{start:r.index,end:a+s[0].length,indent:s[1],expression:s[2]}}var Qi=`
fn featureHidden(id: u32) -> bool {
  return id < arrayLength(&hiddenMask) && hiddenMask[id] == 0u;
}
`;function Ds(t){let e=new Set;if(t==null)return e;for(let r of t){let a=Number(r);!Number.isInteger(a)||a<=0||a>4294967295||e.add(a)}return e}function Vd(t,e=0){let r=0;for(let n of Ds(t))r=Math.max(r,n);let a=64,s=r+1;for(;a<s;)a*=2;return Math.max(a,Math.floor(e)||0)}function Hd(t,e){let r=Math.max(64,Math.floor(e)||0),a=new Uint32Array(r);a.fill(1);for(let s of Ds(t))s<r&&(a[s]=0);return a}function Sx(t){let e=Number(t.drillWidthMm)||0,r=Number(t.drillHeightMm)||e,a=Math.min(e,r),s=Math.min(Number(t.outerWidthMm)||0,Number(t.outerHeightMm)||0),n=Number.isFinite(t.platingThicknessMm)?t.platingThicknessMm:Math.max(0,(s-a)/2),i=(Number(t.rotationDeg)||0)*Math.PI/180+(r>e?Math.PI/2:0);return{x:t.centerMm[0]/1e3,y:-t.centerMm[1]/1e3,drillRadius:a/2e3,outerRadius:(a/2+n)/1e3,halfLength:Math.abs(e-r)/2e3,angle:Math.abs(e-r)>0?-i:0,startZ:t.startZMm/1e3,endZ:t.endZMm/1e3,netId:t.netId||0,objectId:t.objectFeatureId||0,startLayerId:t.startLayerId||0,endLayerId:t.endLayerId||0}}function to(t,e){let r=new Map((e||[]).map(a=>[Number(a.id),Number(a.thickness_mm)||0]));return(t||[]).map(a=>{let s=i=>Math.max(0,(r.get(Number(i))||0)/2-.001),n=a.startZMm>=a.endZMm?1:-1;return{...a,startZMm:a.startZMm+n*s(a.startLayerId),endZMm:a.endZMm-n*s(a.endLayerId)}})}var ma=0,Zi=16,eo=24,ya=32,qd=48,Wd=Object.freeze({arrayStride:qd,stepMode:"instance",attributes:Object.freeze([Object.freeze({shaderLocation:3,offset:ma,format:"float32x4"}),Object.freeze({shaderLocation:4,offset:Zi,format:"float32x2"}),Object.freeze({shaderLocation:6,offset:eo,format:"float32x2"}),Object.freeze({shaderLocation:5,offset:ya,format:"uint32x4"})])}),ro=48,Us=`struct Input {
  @location(0) unit: vec3f,
  @location(1) normal: vec3f,
  @location(2) radiusMix: f32,
  @location(3) dimensions: vec4f,
  @location(4) span: vec2f,
  @location(5) ids: vec4u,
  @location(6) shape: vec2f,
};`,Xd=`struct Barrel {
  dimensions: vec4f,
  span: vec2f,
  shape: vec2f,
  ids: vec4u,
};
@group(0) @binding(6) var<storage, read> barrels: array<Barrel>;`;function $d(t,e,r){let a=new ArrayBuffer(Math.max(r,t.length)*e),s=new DataView(a);return t.forEach((n,i)=>{let o=i*e,c=Sx(n);s.setFloat32(o+ma,c.x,!0),s.setFloat32(o+ma+4,c.y,!0),s.setFloat32(o+ma+8,c.drillRadius,!0),s.setFloat32(o+ma+12,c.outerRadius,!0),s.setFloat32(o+Zi,c.startZ,!0),s.setFloat32(o+Zi+4,c.endZ,!0),s.setFloat32(o+eo,c.halfLength,!0),s.setFloat32(o+eo+4,c.angle,!0),s.setUint32(o+ya,c.netId,!0),s.setUint32(o+ya+4,c.objectId,!0),s.setUint32(o+ya+8,c.startLayerId,!0),s.setUint32(o+ya+12,c.endLayerId,!0)}),a}function Yd(t){return $d(t,qd,0)}function Jd(t){return $d(t,ro,1)}var ao=t=>`
struct Palette {
  ramps: array<vec4f, 512>,
  outline: vec4f,
};
@group(0) @binding(${t}) var<uniform> palette: Palette;
fn ramp(t: f32, which: u32) -> vec3f {
  let x = clamp(t, 0.0, 1.0) * 255.0;
  let i = u32(floor(x));
  let j = min(i + 1u, 255u);
  return mix(palette.ramps[which * 256u + i].rgb, palette.ramps[which * 256u + j].rgb, x - floor(x));
}
fn fieldColor(t: f32) -> vec3f {
  return ramp(t, 0u);
}
`,Qd=`
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

${ao(10)}
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
`,Tx={compare:"always",passOp:"keep"},zs=Object.freeze({shapeMask:{face:{compare:"always",passOp:"replace"},read:255,write:128,reference:128,color:!1,depth:!1},fan:{face:{compare:"always",passOp:"invert"},read:255,write:64,reference:0,color:!1,depth:!1},coverSubtract:{face:{compare:"not-equal",passOp:"replace",failOp:"keep"},read:64,write:192,reference:128,color:!1,depth:!1},shapeAdd:{face:{compare:"greater",passOp:"replace"},read:160,write:33,reference:32,color:!0,depth:!0},coverMark:{face:{compare:"equal",passOp:"replace",failOp:"keep"},read:192,write:1,reference:65,color:!1,depth:!1,depthTest:!0},coverAdd:{face:{compare:"equal",passOp:"invert",failOp:"keep",depthFailOp:"keep"},read:224,write:96,reference:64,color:!0,depth:!0},coverClear:{face:{compare:"always",passOp:"zero"},read:255,write:64,reference:0,color:!1,depth:!1},shapeLay:{face:{compare:"greater",passOp:"replace"},read:160,write:32,reference:32,color:!1,depth:!1,depthTest:!0},coverLay:{face:{compare:"equal",passOp:"invert",failOp:"keep",depthFailOp:"keep"},read:224,write:96,reference:64,color:!1,depth:!1,depthTest:!0},shapeBlend:{face:{compare:"greater",passOp:"replace"},read:160,write:32,reference:32,color:!0,depth:!0},coverBlend:{face:{compare:"equal",passOp:"invert",failOp:"keep",depthFailOp:"keep"},read:224,write:96,reference:64,color:!0,depth:!0},tintCovered:{face:{compare:"equal",passOp:"keep"},read:33,write:0,reference:33,color:!0,depth:!0},tintPlain:{face:{compare:"equal",passOp:"keep"},read:33,write:0,reference:32,color:!0,depth:!0},footShape:{face:{compare:"always",passOp:"replace"},read:0,write:2,reference:2,color:!1,depth:!1},footCover:{face:{compare:"equal",passOp:"replace",failOp:"keep"},read:64,write:2,reference:66,color:!1,depth:!1},tintHigh:{face:{compare:"equal",passOp:"replace"},read:34,write:4,reference:38,color:!0,depth:!0},tintLow:{face:{compare:"equal",passOp:"replace"},read:34,write:4,reference:36,color:!0,depth:!0},clearLay:{face:{compare:"always",passOp:"zero"},read:0,write:224,reference:0,color:!1,depth:!1},shapeOnFoot:{face:{compare:"equal",passOp:"invert"},read:166,write:32,reference:6,color:!0,depth:!0},shapeOffFoot:{face:{compare:"equal",passOp:"invert"},read:166,write:32,reference:4,color:!0,depth:!0},coverOnFoot:{face:{compare:"equal",passOp:"invert",failOp:"keep",depthFailOp:"keep"},read:230,write:96,reference:70,color:!0,depth:!0},coverOffFoot:{face:{compare:"equal",passOp:"invert",failOp:"keep",depthFailOp:"keep"},read:230,write:96,reference:68,color:!0,depth:!0},clearFoot:{face:{compare:"always",passOp:"zero"},read:0,write:6,reference:0,color:!1,depth:!1},coat:{face:{compare:"equal",passOp:"keep",failOp:"keep",depthFailOp:"keep"},read:2,write:0,reference:0,color:!0,depth:!0},solid:{face:Tx,read:0,write:0,reference:0,color:!0,depth:!0},clear:{face:{compare:"always",passOp:"zero"},read:255,write:224,reference:0,color:!1,depth:!1}});var Zd=64,so=112,eu=48,Ax=.51,tu=6,ru=`
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
  // 1 while any layer is lifted off its place (the stack separated): only the
  // lit nets' barrels draw exact; the rest are ghosts (vs_ghost).
  separated: u32,
  padding3: u32,
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
// 1 in the pick pipeline: every barrel stays pickable, ghost or not.
override PICK_PASS: u32 = 0u;
const FAR = 1e30;
fn netLit(operation: u32) -> bool {
  let net = select(0u, nets[operation], operation < arrayLength(&nets));
  let emphasised = net != 0u && net < arrayLength(&netMask) && netMask[net] != 0u;
  return emphasised || (globals.activeNet != 0u && net == globals.activeNet);
}
fn present(value: f32) -> bool { return value < 1e38; }
${ao(7)}
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
  // A separated stack draws only the lit nets' barrels exact: the rest are
  // ghosts (vs_ghost), and their boxes collapse here, before any fragment.
  // Net isolation hides the unlit ones in every pass.
  let unlit = !netLit(b.ids.x);
  if ((PICK_PASS == 0u && ghosted(b)) || (view.isolate == 1u && unlit)) { out.position = vec4f(0.0); }
  return out;
}

fn ghosted(b: Barrel) -> bool {
  return view.separated == 1u && !netLit(b.ids.x);
}

struct GhostOut {
  @builtin(position) position: vec4f,
  // Across the strip, -1 to 1, and the strip's side and toward-eye directions.
  @location(0) across: f32,
  @location(1) side: vec3f,
  @location(2) facing: vec3f,
};

// A barrel off the lit nets in a separated stack: a strip facing the eye,
// as wide as the hole, between its layers' lifted faces, shaded across its
// width as the tube it stands for. Barrels drawn exact collapse here instead.
@vertex fn vs_ghost(@builtin(vertex_index) vertex: u32, @builtin(instance_index) index: u32) -> GhostOut {
  let b = barrels[index];
  var out: GhostOut;
  if (!ghosted(b) || ((b.ids.w & UNPLATED) != 0u && view.board == 0u)) {
    out.position = vec4f(0.0);
    return out;
  }
  let z = span(b);
  let centre = vec3f(b.shape.xy, 0.5 * (z.x + z.y));
  // Toward the eye, in the board's plane (the strip stands upright).
  var toward = select(-view.eye.xyz, view.eye.xyz / view.eye.w - centre, abs(view.eye.w) > 1e-12);
  toward = vec3f(toward.xy, 0.0);
  let flat = length(toward) < 1e-12;
  let facing = select(normalize(toward), vec3f(0.0, -1.0, 0.0), flat);
  let side = vec3f(-facing.y, facing.x, 0.0);
  // A slot's long half (shape.z) along its angle, seen across: its widest extent.
  let reach = b.size.x + b.shape.z * abs(dot(vec2f(cos(b.shape.w), sin(b.shape.w)), side.xy));
  var corners = array<vec2f, 6>(vec2f(-1.0, 0.0), vec2f(1.0, 0.0), vec2f(-1.0, 1.0), vec2f(1.0, 0.0), vec2f(1.0, 1.0), vec2f(-1.0, 1.0));
  let corner = corners[vertex];
  let world = vec3f(centre.xy + side.xy * corner.x * reach, select(z.y, z.x, corner.y > 0.5));
  out.position = globals.viewProjection * vec4f(world, 1.0);
  out.across = corner.x;
  out.side = side;
  out.facing = facing;
  return out;
}

@fragment fn fs_ghost(input: GhostOut) -> @location(0) vec4f {
  // The tube's normal under this point of the strip.
  let u = clamp(input.across, -1.0, 1.0);
  let normal = normalize(input.side * u + input.facing * sqrt(1.0 - u * u));
  let light = normalize(globals.lightDirection.xyz);
  let shade = 0.55 + 0.45 * abs(dot(normal, light));
  return vec4f(view.color.rgb * shade, ${Ax});
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
`,au=`
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
`;var su=`
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
${ao(3)}

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
`;var co=20,pt=256,nu=112,rr="rg32uint",Cr=pt/4,Nx=256,iu={compare:"always",passOp:"zero"},Cx={compare:"always",passOp:"replace"},Bx={compare:"not-equal",passOp:"keep"},Ox={compare:"equal",passOp:"keep"},du="fn dequant(p: vec3f) -> vec3f { return draw.quantMin.xyz + p * draw.quantSize.xyz; }",uu=32,fu=`  let plating = input.dimensions.w - input.dimensions.z;
  let rim = select(1.0, ${(1/Math.cos(Math.PI/uu)).toFixed(6)}, input.radiusMix > 1.5);
  let radius = mix(max(input.dimensions.z - plating, input.dimensions.z * 0.5), input.dimensions.z, min(input.radiusMix, 1.0)) * rim;
  let turn = vec2f(cos(input.shape.y), sin(input.shape.y));
  let local = vec2f(input.unit.x * radius + select(-input.shape.x, input.shape.x, input.unit.x >= 0.0), input.unit.y * radius);
  let planar = vec2f(local.x * turn.x - local.y * turn.y, local.x * turn.y + local.y * turn.x);
  let turnedNormal = vec3f(input.normal.x * turn.x - input.normal.y * turn.y, input.normal.x * turn.y + input.normal.y * turn.x, input.normal.z);
`,Ks=`
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
${du}
@group(0) @binding(3) var<storage, read> hiddenMask: array<u32>;
@group(0) @binding(4) var<storage, read> netMask: array<u32>;
${Qi}
${oa}
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
`,Fx=Pe(Ks),Vs=`
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
${du}
@group(0) @binding(3) var<storage, read> hiddenMask: array<u32>;
@group(0) @binding(4) var<storage, read> netMask: array<u32>;
${Qi}
${oa}
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
`,Px=Pe(Vs),uo=`
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
${oa}
${de("decl")}${Us}
struct Output {
  @builtin(position) position: vec4f,
  @location(0) normal: vec3f,
  @location(1) @interpolate(flat) netId: u32,
  @location(2) @interpolate(flat) objectId: u32,
${de("vs-out")}  @location(3) @interpolate(flat) visible: u32,
};
@vertex fn vs(input: Input) -> Output {
${fu}  let z0 = input.span.x + layerOffsets[input.ids.z];
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
`,jx=Pe(uo),fo=`
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
${oa}
${de("decl")}${Us}
struct Output {
  @builtin(position) position: vec4f,
  @location(3) @interpolate(flat) netId: u32,
  @location(0) @interpolate(flat) objectId: u32,
${de("vs-out")}  @location(1) @interpolate(flat) visible: u32,
};
@vertex fn vs(input: Input) -> Output {
${fu}  let world = vec3f(
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
`,Lx=Pe(fo);function hr(t,e){return e.reduce((r,[a,s])=>{if(r.split(a).length!==2)throw new Error(`Shader variant anchor not found once: ${a.slice(0,60)}`);return r.replace(a,()=>s)},t)}var ho=[`  padding0: u32,
  padding1: u32,`,`  selectedOccurrence: u32,
  occurrenceBase: u32,`],Hs=[["  padding2: u32,","  emphasisStride: u32,"],["fn netEmphasized(id: u32) -> bool {",`${yl}fn netEmphasized(id: u32) -> bool {`]],hu="  let lit = netEmphasized(input.netId) || (globals.activeNet != 0u && input.netId == globals.activeNet);",bu=`  let lit = emphasisOf(input.occurrence, input.netId) != 0u
    || (input.occurrence == globals.selectedOccurrence && globals.activeNet != 0u && input.netId == globals.activeNet);`,bo=hr(Ks,[ho,[`  @location(3) world: vec3f,
};`,`  @location(3) world: vec3f,
  @location(4) @interpolate(flat) occurrence: u32,
  // Mask and silkscreen opacity of this occurrence's own stackup separation (SB2-31f).
  @location(5) @interpolate(flat) fade: f32,
};`],[`@vertex fn vs(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  output.world = dequant(input.position) + draw.offset.xyz;
  output.position = globals.viewProjection * vec4f(output.world, 1.0);
  output.normal = normalize(input.normal);`,`${ha}
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
  let selectedComponent = here && component && globals.selectedFeature != 0u && input.objectId == globals.selectedFeature;`],...Hs,["      base = vec3f(0.08, 1.0, 0.2) * pulse;","      base = emphasisColor(mark, vec3f(0.08, 1.0, 0.2)) * pulse;"],["  var alpha = draw.flags.y;","  var alpha = draw.flags.y * input.fade;"]]),pu=Pe(bo),po=hr(Vs,[ho,[`  @location(0) @interpolate(flat) objectId: u32,
};`,`  @location(0) @interpolate(flat) objectId: u32,
  @location(1) @interpolate(flat) occurrence: u32,
};`],[`@vertex fn vs(input: Input) -> Output {
  var output: Output;
  output.position = globals.viewProjection * vec4f(dequant(input.position) + draw.offset.xyz, 1.0);`,`${ha}
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
${de("fs-return")}  return vec2u(input.occurrence, select(input.objectId, 0u, kind == 0u));`],...Hs,[hu,bu]]),gu=Pe(po),Dx=`struct Placement { r0: vec4f, r1: vec4f, r2: vec4f, ids: vec4u };
@group(0) @binding(8) var<storage, read> placements: array<Placement>;
fn place(p: Placement, v: vec3f) -> vec3f {
  return vec3f(dot(p.r0.xyz, v) + p.r0.w, dot(p.r1.xyz, v) + p.r1.w, dot(p.r2.xyz, v) + p.r2.w);
}
fn turn(p: Placement, n: vec3f) -> vec3f {
  return vec3f(dot(p.r0.xyz, n), dot(p.r1.xyz, n), dot(p.r2.xyz, n));
}`,ou="@group(0) @binding(1) var<uniform> draw: Draw;",qs=[ou,`${ou}
${Dx}`],Ws=["  output.objectId = input.objectId;","  output.objectId = select(placement.ids.x, input.objectId, input.objectId != 0u);"],mu=["  let index = listedOccurrence(u32(draw.material.w + 0.5), instance);",`  let placement = placements[draw.placement.x + instance % draw.placement.y];
  let index = listedOccurrence(u32(draw.material.w + 0.5), instance / draw.placement.y);`],yu=hr(Ks,[qs,[`@vertex fn vs(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  output.world = dequant(input.position) + draw.offset.xyz;`,`@vertex fn vs(input: VertexInput, @builtin(instance_index) instance: u32) -> VertexOutput {
  let placement = placements[draw.placement.x + instance];
  var output: VertexOutput;
  output.world = place(placement, dequant(input.position)) + draw.offset.xyz;`],["  output.normal = normalize(input.normal);","  output.normal = normalize(turn(placement, input.normal));"],Ws]),xu=hr(bo,[qs,mu,["occurrence.model * vec4f(dequant(input.position) + draw.offset.xyz + lift, 1.0)","occurrence.model * vec4f(place(placement, dequant(input.position)) + draw.offset.xyz + lift, 1.0)"],["(occurrence.normal * vec4f(input.normal, 0.0))","(occurrence.normal * vec4f(turn(placement, input.normal), 0.0))"],Ws]),wu=hr(Vs,[qs,[`@vertex fn vs(input: Input) -> Output {
  var output: Output;
  output.position = globals.viewProjection * vec4f(dequant(input.position) + draw.offset.xyz, 1.0);`,`@vertex fn vs(input: Input, @builtin(instance_index) instance: u32) -> Output {
  let placement = placements[draw.placement.x + instance];
  var output: Output;
  output.position = globals.viewProjection * vec4f(place(placement, dequant(input.position)) + draw.offset.xyz, 1.0);`],Ws]),vu=hr(po,[qs,mu,["occurrence.model * vec4f(dequant(input.position) + draw.offset.xyz + lift, 1.0)","occurrence.model * vec4f(place(placement, dequant(input.position)) + draw.offset.xyz + lift, 1.0)"],Ws]),Mu=Pe(yu),ku=Pe(xu),Eu=Pe(wu),Su=Pe(vu),no=64,Ux=6,zx=`${Xd}
${ha}
struct Input {
  @location(0) unit: vec3f,
  @location(1) normal: vec3f,
  @location(2) radiusMix: f32,
};`;function Tu(t,e,r=[]){return hr(t,[ho,[`@group(0) @binding(2) var<storage, read> layerOffsets: array<f32>;
`,""],[Us,zx],["@vertex fn vs(input: Input) -> Output {",`struct Record {
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
  let input = Record(vertex.unit, vertex.normal, vertex.radiusMix, barrel.dimensions, barrel.span, barrel.shape, barrel.ids);`],[e,e.replace("vec4f(world, 1.0)","vec4f((occurrence.model * vec4f(world, 1.0)).xyz, 1.0)")],["  output.objectId = input.ids.y;",`  output.objectId = input.ids.y;
  output.occurrence = index + 1u + globals.occurrenceBase;`],...r])}var Au=Tu(uo,`  output.position = globals.viewProjection * vec4f(world, 1.0);
  output.normal = turnedNormal;`,[[`  let z0 = input.span.x + layerOffsets[input.ids.z];
  let z1 = input.span.y + layerOffsets[input.ids.w];`,`  let z0 = input.span.x + layerOffsets[input.ids.z] * spread;
  let z1 = input.span.y + layerOffsets[input.ids.w] * spread;`],[`  output.normal = turnedNormal;
  output.netId`,`  output.normal = (occurrence.normal * vec4f(turnedNormal, 0.0)).xyz;
  output.netId`],[`  @location(3) @interpolate(flat) visible: u32,
};`,`  @location(3) @interpolate(flat) visible: u32,
  @location(4) @interpolate(flat) occurrence: u32,
};`],["  let selected = netEmphasized(input.netId) || (globals.activeNet != 0u && input.netId == globals.activeNet);",`  let mark = emphasisOf(input.occurrence, input.netId);
  let selected = mark != 0u
    || (input.occurrence == globals.selectedOccurrence && globals.activeNet != 0u && input.netId == globals.activeNet);`],...Hs,["      base = vec3f(0.1, 1.0, 0.22) * (","      base = emphasisColor(mark, vec3f(0.1, 1.0, 0.22)) * ("]]),_u=Tu(fo,`  output.position = globals.viewProjection * vec4f(world, 1.0);
  output.objectId`,[["mix(input.span.x + layerOffsets[input.ids.z], input.span.y + layerOffsets[input.ids.w], input.unit.z)","mix(input.span.x + layerOffsets[input.ids.z] * spread, input.span.y + layerOffsets[input.ids.w] * spread, input.unit.z)"],[`  @location(1) @interpolate(flat) visible: u32,
};`,`  @location(1) @interpolate(flat) visible: u32,
  @location(2) @interpolate(flat) occurrence: u32,
};`],["  return vec2u(1u, input.objectId);","  return vec2u(input.occurrence, input.objectId);"],...Hs,[hu,bu]]),Iu=Pe(Au),Ru=Pe(_u),Nu=`
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
${ha}
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
`,Cu=`${Nu}
@fragment fn fs(input: Output) -> @location(0) vec4f {
${de("fs-begin")}  let light = normalize(globals.lightDirection.xyz);
${de("fs-return")}  return vec4f(draw.color.rgb * (0.45 + max(dot(normalize(input.normal), light), 0.0) * 0.55), 1.0);
}
`,Bu=Pe(Cu),Ou=`${Nu}
@fragment fn fs(input: Output) -> @location(0) vec2u {
${de("fs-begin")}${de("fs-return")}  return vec2u(input.occurrence, 0u);
}
`,Fu=Pe(Ou),go=`
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
`,cu=[{arrayStride:24,attributes:[{shaderLocation:0,offset:0,format:"float32x3"},{shaderLocation:1,offset:12,format:"float32x3"}]}],MA=Object.freeze({main:pu,pick:gu,barrel:Iu,barrelPick:Ru,box:Bu,boxPick:Fu,cull:go,component:Mu,componentInstanced:ku,componentPick:Eu,componentPickInstanced:Su}),Pu=Object.freeze({main:{output:"color",single:Ks,instanced:bo,world:["output.world","output.world"]},pick:{output:"pick",single:Vs,instanced:po,world:["(dequant(input.position) + draw.offset.xyz)","world"]},barrel:{output:"color",single:uo,instanced:Au,world:["world","(occurrence.model * vec4f(world, 1.0)).xyz"]},barrelPick:{output:"pick",single:fo,instanced:_u,world:["world","(occurrence.model * vec4f(world, 1.0)).xyz"]},component:{output:"color",single:yu,instanced:xu,world:["output.world","output.world"]},componentPick:{output:"pick",single:wu,instanced:vu,world:["(place(placement, dequant(input.position)) + draw.offset.xyz)","world"]},box:{output:"color",single:null,instanced:Cu,world:[null,"(occurrence.model * vec4f(local, 1.0)).xyz"]},boxPick:{output:"pick",single:null,instanced:Ou,world:[null,"(occurrence.model * vec4f(local, 1.0)).xyz"]}}),kA=Object.freeze(Object.keys(Pu));function io(t,e,r=[]){let a=Pu[t],s=a?.[e?"instanced":"single"];if(!s)throw new Error(`No ${e?"instanced":"one-board"} ${t} shader`);return Gd(s,r,{family:t,instanced:e,output:a.output,world:a.world[e?1:0]})}var EA=Object.freeze({main:Fx,pick:Px,barrel:jx,barrelPick:Lx,mainInstanced:pu,pickInstanced:gu,barrelInstanced:Iu,barrelPickInstanced:Ru,component:Mu,componentInstanced:ku,componentPick:Eu,componentPickInstanced:Su,box:Bu,boxPick:Fu,cull:go}),ar=class t{static async create(e,{sampleCount:r=4}={}){if(!navigator.gpu)throw new Error("WebGPU is unavailable in this browser");let a=await navigator.gpu.requestAdapter({powerPreference:"high-performance"});if(!a)throw new Error("No WebGPU adapter is available");let s=a.features.has("depth32float-stencil8"),n=await a.requestDevice(s?{requiredFeatures:["depth32float-stencil8"]}:void 0);return new t(e,n,{stencil:s,sampleCount:r})}constructor(e,r,{shareFrom:a=null,stencil:s=!1,sampleCount:n=1}={}){if(this.canvas=e,this.device=r,this.shareFrom=a,this.stencil=a?a.stencil:!!s,this.sampleCount=a?a.sampleCount:n===4?4:1,this.depthFormat=this.stencil?"depth32float-stencil8":"depth32float",this.version=0,this.barrelColor=[.55,.35,.16,.78],this.alwaysInstanced=!!a,this.occurrenceBase=0,a?(this.context=a.context,this.format=a.format):(r.addEventListener("uncapturederror",i=>{console.error(`Uncaptured WebGPU error: ${i.error?.message||i.error}`)}),r.lost.then(i=>{i.reason!=="destroyed"&&console.error(`WebGPU device lost: ${i.reason}`,i.message)}),this.context=e.getContext("webgpu"),this.format=navigator.gpu.getPreferredCanvasFormat(),this.context.configure({device:r,format:this.format,alphaMode:"opaque"})),this.entries=[],this.barrels=null,this.drawSlotCapacity=Nx,this.drawSlotBuffer=this.createDrawSlotBuffer(this.drawSlotCapacity),this.drawStaging=new Float32Array(this.drawSlotCapacity*Cr),this.freeDrawSlots=[],this.nextDrawSlot=0,this.globalBuffer=r.createBuffer({size:nu,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),this.layerOffsetBuffer=r.createBuffer({size:1024,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),this.occurrenceMatrices=[[...rt]],this.occurrenceKeys=["0"],this.occurrenceHiddenLayers=[[]],this.occurrenceExplode=[null],this.identityOnly=!0,this.occurrenceCapacity=1,this.occurrenceBuffer=this.createOccurrenceBuffer(this.occurrenceCapacity),this.device.queue.writeBuffer(this.occurrenceBuffer,0,Fs(this.occurrenceMatrices)),this.barrelRecordBuffer=r.createBuffer({label:"barrel-records",size:ro,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),this.placementBuffer=r.createBuffer({label:"component-placements",size:no,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),this.componentPipelineSets=new Map,this.instancedPipelines=null,this.shaderFeatures=[],this.shaderFeatureKey="",this.featurePipelineSets=new Map,this.pipelineSetKinds=new WeakMap,this.listBuffer=this.createListBuffer(this.occurrenceCapacity),this.slotCapacity=0,this.slotArgs=new Uint32Array(0),this.slotClasses=new Uint32Array(0),this.freeSlots=[],this.nextSlot=2,this.argsBuffer=null,this.classesBuffer=null,this.growSlots(256),this.setSlot(0,0,4),this.setSlot(1,0,4),this.cull=null,this.box=null,this.boardBounds=null,this.selectedOccurrence=-1,this.lodOverride=null,this.lodThresholds={...dt},this.innerCopperAtFull=!0,this.innerCopperMode="all",this.cullCounts={full:0,board:0,body:0,box:0,culled:0},this.frameStats={triangles:0,draws:0},this.boxColor=[.24,.36,.28,1],a)for(let i of["bindGroupLayout","pipelineLayout","vertexBuffers","pipeline","pickPipeline","barrelPipeline","barrelPickPipeline","singlePipelines"])this[i]=a[i];else this.createSinglePipelines();this.depth=null,this.colorTarget=null,this.pickDepth=null,this.pickTexture=null,this.insetColor=null,this.pickSerial=Promise.resolve(),this.bundleCache=new Map,this.globalScratch=new ArrayBuffer(nu),this.globalScratchF32=new Float32Array(this.globalScratch),this.globalScratchView=new DataView(this.globalScratch),this.barrelDrawScratch=new Float32Array(pt/4),this.nextEntryId=1,this.hiddenFeatureIds=new Set,this.showPlaceholders=!0,this.hiddenBoardLayers=new Set,this.featureMaskCapacity=64,this.featureMaskBuffer=this.createFeatureMaskBuffer(this.featureMaskCapacity),this.uploadFeatureMask(),this.emphasizedNetIds=new Set,this.occurrenceEmphasis=null,this.emphasisStride=0,this.dimCopper=!1,this.netMaskCapacity=64,this.netMaskBuffer=this.createNetMaskBuffer(this.netMaskCapacity),this.uploadNetMask(),a&&this.setOccurrences([])}createSinglePipelines(){let e=this.device;this.bindGroupLayout=e.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}},{binding:1,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}},{binding:2,visibility:GPUShaderStage.VERTEX,buffer:{type:"read-only-storage"}},{binding:3,visibility:GPUShaderStage.FRAGMENT,buffer:{type:"read-only-storage"}},{binding:4,visibility:GPUShaderStage.FRAGMENT,buffer:{type:"read-only-storage"}},{binding:5,visibility:GPUShaderStage.VERTEX,buffer:{type:"read-only-storage"}},{binding:6,visibility:GPUShaderStage.VERTEX,buffer:{type:"read-only-storage"}},{binding:7,visibility:GPUShaderStage.VERTEX,buffer:{type:"read-only-storage"}},{binding:8,visibility:GPUShaderStage.VERTEX,buffer:{type:"read-only-storage"}}]});let r=e.createPipelineLayout({bindGroupLayouts:[this.bindGroupLayout]});this.pipelineLayout=r;let a=this.vertexBuffers=[{arrayStride:co,attributes:[{shaderLocation:0,offset:0,format:"unorm16x4"},{shaderLocation:1,offset:8,format:"snorm8x4"},{shaderLocation:2,offset:12,format:"uint32"},{shaderLocation:3,offset:16,format:"uint32"}]}];this.singlePipelines=this.makePipelineSet(!1,[]),this.pipeline=this.singlePipelines.main,this.pickPipeline=this.singlePipelines.pick,this.barrelPipeline=this.singlePipelines.barrel,this.barrelPickPipeline=this.singlePipelines.barrelPick}makeMainPipelines(e,r){let a=this.pipelineLayout,s=this.vertexBuffers,n=(c,l)=>this.makePipeline(a,e,this.format,s,`${c}${r}`,l),i=n("main",{stencil:iu}),o=n("main-blend");return{main:i,mark:this.stencil?n("main-mark",{stencil:Cx}):i,blend:o,translucent:n("main-translucent",{depthWrite:!1,cullMode:"back"}),mask:this.stencil?n("mask",{stencil:Bx}):o,maskCovered:this.stencil?n("mask-covered",{stencil:Ox,constants:{COVERED:1}}):null}}createOccurrenceBuffer(e){return this.device.createBuffer({label:"occurrences",size:e*160,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST})}createListBuffer(e){return this.device.createBuffer({label:"visible-occurrences",size:e*4*Uint32Array.BYTES_PER_ELEMENT,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST})}growSlots(e){let r=new Uint32Array(e*5);r.set(this.slotArgs);let a=new Uint32Array(e).fill(4);a.set(this.slotClasses),this.slotArgs=r,this.slotClasses=a,this.slotCapacity=e,this.argsBuffer?.destroy?.(),this.classesBuffer?.destroy?.(),this.argsBuffer=this.device.createBuffer({label:"indirect-args",size:r.byteLength,usage:GPUBufferUsage.INDIRECT|GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),this.classesBuffer=this.device.createBuffer({label:"draw-classes",size:a.byteLength,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),this.device.queue.writeBuffer(this.argsBuffer,0,r),this.device.queue.writeBuffer(this.classesBuffer,0,a),this.cull&&(this.cull.bindGroup=this.makeCullBindGroup()),this.bundleCache?.clear()}setSlot(e,r,a){this.slotArgs.fill(0,e*5,e*5+5),this.slotArgs[e*5]=r,this.slotClasses[e]=a,this.device.queue.writeBuffer(this.argsBuffer,e*20,this.slotArgs,e*5,5),this.device.queue.writeBuffer(this.classesBuffer,e*4,this.slotClasses,e,1)}allocSlot(e,r){let a=this.freeSlots.length?this.freeSlots.pop():this.nextSlot++;return a>=this.slotCapacity&&this.growSlots(this.slotCapacity*2),this.setSlot(a,e,r),a}get occurrenceCount(){return this.occurrenceMatrices.length}setOccurrences(e){let{matrices:r,keys:a,hiddenLayers:s,explode:n}=Ld(e??[rt]);this.occurrenceMatrices=r,this.occurrenceKeys=a,this.occurrenceHiddenLayers=s,this.occurrenceExplode=n,this.identityOnly=!this.alwaysInstanced&&r.length===1&&js(r[0]),this.identityOnly||this.ensureInstancedPipelines(),r.length>this.occurrenceCapacity&&(this.occurrenceBuffer?.destroy?.(),this.listBuffer?.destroy?.(),this.occurrenceCapacity=Math.max(r.length,this.occurrenceCapacity*2),this.occurrenceBuffer=this.createOccurrenceBuffer(this.occurrenceCapacity),this.listBuffer=this.createListBuffer(this.occurrenceCapacity),this.cull&&(this.cull.lods.destroy(),this.cull.lods=this.createLodBuffer(this.occurrenceCapacity)),this.rebindAll()),r.length&&this.device.queue.writeBuffer(this.occurrenceBuffer,0,Fs(r,s,n)),this.cull&&this.device.queue.writeBuffer(this.cull.lods,0,new Uint32Array(this.occurrenceCapacity).fill(Xi)),this.selectedOccurrence>=r.length&&(this.selectedOccurrence=-1),this.bundleCache.clear(),this.invalidate()}setOccurrenceHiddenLayers(e){this.occurrenceHiddenLayers=this.occurrenceMatrices.map((r,a)=>[...e?.[a]||[]].map(Number)),this.writeOccurrenceRecords()}setOccurrenceExplode(e){this.occurrenceExplode=this.occurrenceMatrices.map((r,a)=>e?.[a]?[...e[a]].map(Number):null),this.writeOccurrenceRecords()}writeOccurrenceRecords(){this.occurrenceMatrices.length&&this.device.queue.writeBuffer(this.occurrenceBuffer,0,Fs(this.occurrenceMatrices,this.occurrenceHiddenLayers,this.occurrenceExplode)),this.invalidate()}setInnerCopperMode(e){this.setInnerCopperAtFull(!1),this.innerCopperMode!==e&&(this.innerCopperMode=e,this.invalidate())}setInnerCopperAtFull(e){if(this.innerCopperAtFull!==e){this.innerCopperAtFull=e;for(let r of this.entries)r.innerCopper&&(r.drawClass=lu(r,e),this.setSlot(r.slot,r.indexCount,r.drawClass));this.invalidate()}}setBoardBounds(e){this.boardBounds=e?[...e]:null,this.invalidate()}setLodThresholds(e){this.lodThresholds=Nr({...this.lodThresholds,...e}),this.invalidate()}setAnalytic(e){this.analytic&&this.analytic!==e&&this.analytic.destroy(),this.analytic=e||null,this.bundleCache.clear(),this.invalidate()}setLodOverride(e){this.lodOverride=e==null?null:Number(e),this.invalidate()}createLodBuffer(e){return this.device.createBuffer({label:"occurrence-lods",size:e*Uint32Array.BYTES_PER_ELEMENT,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST})}createCull(){let e=this.device,r=this.shareFrom?.cull,a=i=>({visibility:GPUShaderStage.COMPUTE,buffer:{type:i}}),s=r?.layout||e.createBindGroupLayout({label:"cull",entries:[{binding:0,visibility:GPUShaderStage.COMPUTE,buffer:{type:"uniform"}},{binding:1,...a("read-only-storage")},{binding:2,...a("storage")},{binding:3,...a("storage")},{binding:4,...a("storage")},{binding:5,...a("storage")},{binding:6,...a("read-only-storage")}]}),n=r&&{layout:s,classify:r.classify,writeArgs:r.writeArgs};if(!n){let i=this.createShaderModule(go,"cull"),o=e.createPipelineLayout({bindGroupLayouts:[s]});n={layout:s,classify:e.createComputePipeline({layout:o,compute:{module:i,entryPoint:"classify"}}),writeArgs:e.createComputePipeline({layout:o,compute:{module:i,entryPoint:"writeArgs"}})}}this.cull={...n,uniform:e.createBuffer({label:"cull-params",size:192,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),lods:this.createLodBuffer(this.occurrenceCapacity),counters:e.createBuffer({label:"cull-counters",size:16,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST}),readback:e.createBuffer({label:"cull-readback",size:16,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}),scratch:new ArrayBuffer(192),reading:!1,readAt:0,bindGroup:null},e.queue.writeBuffer(this.cull.lods,0,new Uint32Array(this.occurrenceCapacity).fill(Xi)),this.cull.bindGroup=this.makeCullBindGroup()}makeCullBindGroup(){return this.device.createBindGroup({layout:this.cull.layout,entries:[{binding:0,resource:{buffer:this.cull.uniform}},{binding:1,resource:{buffer:this.occurrenceBuffer}},{binding:2,resource:{buffer:this.cull.lods}},{binding:3,resource:{buffer:this.listBuffer}},{binding:4,resource:{buffer:this.cull.counters}},{binding:5,resource:{buffer:this.argsBuffer}},{binding:6,resource:{buffer:this.classesBuffer}}]})}createBox(){let e=[[[1,0,0],[[1,0,0],[1,1,0],[1,1,1],[1,0,1]]],[[-1,0,0],[[0,0,0],[0,0,1],[0,1,1],[0,1,0]]],[[0,1,0],[[0,1,0],[0,1,1],[1,1,1],[1,1,0]]],[[0,-1,0],[[0,0,0],[1,0,0],[1,0,1],[0,0,1]]],[[0,0,1],[[0,0,1],[1,0,1],[1,1,1],[0,1,1]]],[[0,0,-1],[[0,0,0],[0,1,0],[1,1,0],[1,0,0]]]],r=[],a=[];e.forEach(([l,f],d)=>{for(let b of f)r.push(...b,...l);let p=d*4;a.push(p,p+1,p+2,p,p+2,p+3)});let s=new Float32Array(r),n=new Uint16Array(a),i=this.device.createBuffer({label:"box-vertices",size:s.byteLength,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST}),o=this.device.createBuffer({label:"box-indices",size:n.byteLength,usage:GPUBufferUsage.INDEX|GPUBufferUsage.COPY_DST});this.device.queue.writeBuffer(i,0,s),this.device.queue.writeBuffer(o,0,n);let c=this.device.createBuffer({size:pt,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});this.box={vertexBuffer:i,indexBuffer:o,indexCount:n.length,drawBuffer:c,bindGroup:this.makeBindGroup(c),scratch:new Float32Array(pt/4)},this.setSlot(1,n.length,3)}writeBoxDraw(){let e=this.box.scratch,[r,a,s,n,i,o]=this.boardBounds;e.fill(0),e.set(this.boxColor,0),e.set([n-r,i-a,o-s,0],4),e.set([r,a,s,0],8),this.device.queue.writeBuffer(this.box.drawBuffer,0,e)}encodeCull(e,r){let a=this.cull,s=new Float32Array(a.scratch),n=new Uint32Array(a.scratch);s.fill(0),Ud(r.matrix).forEach((u,m)=>s.set(u,m*4));let i=r.lod;i&&s.set([...i.eye,i.orthographic?0:1],24);let o=this.boardBounds||[-1e6,-1e6,-1e6,1e6,1e6,1e6];s.set([o[0],o[1],o[2],0,o[3],o[4],o[5],0],28);let{fullPx:c,boardPx:l,boxPx:f,keep:d}=this.lodThresholds;s.set([i?.pixelScale||0,c,f,d],36);let p=this.lodOverride!=null?this.lodOverride+1:!i||!this.boardBounds?Ls+1:0;n.set([this.occurrenceMatrices.length,this.selectedOccurrence+1,p,this.nextSlot],40),n[44]=this.barrels?.instanceCount||0,s[45]=l,this.device.queue.writeBuffer(a.uniform,0,a.scratch),e.clearBuffer(a.counters);let b=e.beginComputePass({label:"cull"});b.setBindGroup(0,a.bindGroup),b.setPipeline(a.classify),b.dispatchWorkgroups(Math.ceil(this.occurrenceMatrices.length/64)),b.setPipeline(a.writeArgs),b.dispatchWorkgroups(Math.ceil(this.nextSlot/64)),b.end();let h=performance.now();return!a.reading&&h-a.readAt>250?(e.copyBufferToBuffer(a.counters,0,a.readback,0,16),a.readAt=h,!0):!1}readCullCounts(){let e=this.cull;e.reading=!0;let r=this.occurrenceMatrices.length;e.readback.mapAsync(GPUMapMode.READ).then(()=>{let[a,s,n,i]=new Uint32Array(e.readback.getMappedRange().slice(0));e.readback.unmap(),this.cullCounts={full:a,board:s-a,body:n-s,box:i,culled:Math.max(0,r-n-i)}}).catch(()=>{}).finally(()=>{e.reading=!1})}countFor(e){if(this.identityOnly)return e===2?this.barrels?.instanceCount||0:e===3?0:1;let{full:r,board:a,body:s,box:n}=this.cullCounts;return e===5?r+a+s:e===0?r+a:e===1?r:e===2?(r+a)*(this.barrels?.instanceCount||0):n}gpuMemoryBytes(){let e=0;for(let r of this.entries)e+=(r.vertexAllocation?.size||0)+(r.indexAllocation?.size||0);this.shareFrom||(e+=this.arenaSlackBytes());for(let r of[this.barrels?.vertexBuffer,this.barrels?.indexBuffer,this.barrels?.instanceBuffer,this.barrelRecordBuffer,this.occurrenceBuffer,this.listBuffer,this.argsBuffer,this.classesBuffer,this.featureMaskBuffer,this.netMaskBuffer,this.cull?.lods])e+=r?.size||0;return e+=this.analytic?.gpuMemoryBytes()||0,e+=this.canvas.width*this.canvas.height*12,e}gpuMemoryBreakdown(){let e={},r=0,a=0;for(let c of this.entries){let l=c.vertexAllocation?.size||0,f=c.indexAllocation?.size||0;r+=l,a+=f;let d=c.kind==="copper"?`copper:${c.layerId??"?"}`:c.boardRole?`${c.kind}:${c.boardRole}`:c.kind||"other";e[d]=(e[d]||0)+l+f}let s=[this.barrels?.vertexBuffer,this.barrels?.indexBuffer,this.barrels?.instanceBuffer,this.barrelRecordBuffer].reduce((c,l)=>c+(l?.size||0),0),n=[this.occurrenceBuffer,this.listBuffer,this.argsBuffer,this.classesBuffer,this.featureMaskBuffer,this.netMaskBuffer,this.cull?.lods].reduce((c,l)=>c+(l?.size||0),0),i=this.shareFrom?null:this.arenaStats(),o=this.analytic?.gpuMemoryBytes()||0;return{vertex:r,index:a,geometry:e,barrels:s,occurrences:n,analytic:o,targets:this.canvas.width*this.canvas.height*12,entries:this.entries.length,arena:i}}ensureInstancedPipelines(){if(!this.instancedPipelines){if(this.shareFrom){this.shareFrom.ensureInstancedPipelines(),this.instancedPipelines=this.shareFrom.instancedPipelines,this.createBox(),this.createCull();return}this.instancedPipelines=this.makePipelineSet(!0,[]),this.createBox(),this.createCull()}}makePipelineSet(e,r){let a=this.pipelineLayout,s=Yi(r),n=l=>io(l,e,r),i=s?`+${s}`:"",o=`${e?"-instanced":""}${i}`,c={...this.makeMainPipelines(n("main"),o),pick:this.makePipeline(a,n("pick"),rr,this.vertexBuffers,`pick${o}`),barrel:this.makeBarrelPipeline(a,n("barrel"),this.format,`barrel${o}`,!e),barrelPick:this.makeBarrelPipeline(a,n("barrelPick"),rr,`barrel-pick${o}`,!e)};return e&&(c.box=this.makePipeline(a,n("box"),this.format,cu,`box${i}`),c.boxPick=this.makePipeline(a,n("boxPick"),rr,cu,`box-pick${i}`)),this.pipelineSetKinds.set(c,{instanced:e,features:ga(r),key:s}),c}setShaderFeatures(e=[]){let r=ga(e),a=Yi(r);a!==this.shaderFeatureKey&&(this.shaderFeatures=r,this.shaderFeatureKey=a,this.bundleCache.clear(),this.invalidate())}pipelinesFor(e){let r=this.shareFrom||this;if(e&&this.ensureInstancedPipelines(),!this.shaderFeatureKey)return e?r.instancedPipelines:r.singlePipelines;let a=`${e?"instanced":"single"}|${this.shaderFeatureKey}`,s=r.featurePipelineSets.get(a);return s||(s=r.makePipelineSet(e,this.shaderFeatures),r.featurePipelineSets.set(a,s)),s}drawSet(){return this.identityOnly?{pipelines:this.pipelinesFor(!1),indirect:!1,barrelInstances:this.barrels?.instanceCount||0}:{pipelines:this.pipelinesFor(!0),indirect:!0,barrelInstances:0}}drawEntry(e,r,a){e.setBindGroup(0,r.bindGroup);let s=r.vertexAllocation,n=r.indexAllocation;e.setVertexBuffer(0,s.buffer,s.offset,s.size),e.setIndexBuffer(n.buffer,r.indexFormat,n.offset,n.size),a?e.drawIndexedIndirect(this.argsBuffer,r.slot*20):e.drawIndexed(r.indexCount,r.placementCount||1)}drawBarrels(e,r,a,s){e.setPipeline(r),e.setBindGroup(0,this.barrels.bindGroup),e.setVertexBuffer(0,this.barrels.vertexBuffer),e.setVertexBuffer(1,this.barrels.instanceBuffer),e.setIndexBuffer(this.barrels.indexBuffer,"uint16"),a?e.drawIndexedIndirect(this.argsBuffer,0):e.drawIndexed(this.barrels.indexCount,s)}drawBox(e,r){!this.box||!this.boardBounds||(this.writeBoxDraw(),e.setPipeline(r),e.setBindGroup(0,this.box.bindGroup),e.setVertexBuffer(0,this.box.vertexBuffer),e.setIndexBuffer(this.box.indexBuffer,"uint16"),e.drawIndexedIndirect(this.argsBuffer,20))}createNetMaskBuffer(e){return this.device.createBuffer({label:"net-emphasis-mask",size:e*Uint32Array.BYTES_PER_ELEMENT,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST})}uploadNetMask(){let e;if(this.occurrenceEmphasis&&!this.identityOnly){let a=wl(this.occurrenceEmphasis);this.emphasisStride=a.stride,e=a.data}else this.emphasisStride=0,e=gl(this.emphasizedNetIds,this.netMaskCapacity);if(e.length>this.netMaskCapacity){this.netMaskBuffer?.destroy?.();let a=this.netMaskCapacity;for(;a<e.length;)a*=2;this.netMaskCapacity=a,this.netMaskBuffer=this.createNetMaskBuffer(a),this.rebindAll()}let r=new Uint32Array(this.netMaskCapacity);r.set(e),this.device.queue.writeBuffer(this.netMaskBuffer,0,r)}setOccurrenceEmphasis(e,{dimCopper:r=!1}={}){let a=Array.isArray(e)&&e.some(s=>s&&s.size);this.occurrenceEmphasis=a?e.map(s=>s&&s.size?new Map(s):null):null,this.dimCopper=!!r,this.uploadNetMask(),this.invalidate()}get netHighlightActive(){return!!(this.emphasizedNetIds.size||this.occurrenceEmphasis||this.dimCopper)}setEmphasizedNetIds(e){this.emphasizedNetIds=ms(e),this.occurrenceEmphasis=null;let r=pl(this.emphasizedNetIds,this.netMaskCapacity);r!==this.netMaskCapacity&&(this.netMaskBuffer?.destroy?.(),this.netMaskCapacity=r,this.netMaskBuffer=this.createNetMaskBuffer(r),this.rebindAll()),this.uploadNetMask(),this.invalidate()}rebindAll(){for(let e of this.entries)e.bindGroup=this.makeBindGroup(this.drawSlotBuffer,e.drawSlot*pt);this.barrels&&(this.barrels.bindGroup=this.makeBindGroup(this.barrels.drawBuffer)),this.box&&(this.box.bindGroup=this.makeBindGroup(this.box.drawBuffer)),this.cull&&(this.cull.bindGroup=this.makeCullBindGroup()),this.bundleCache.clear()}createFeatureMaskBuffer(e){return this.device.createBuffer({label:"feature-visibility-mask",size:e*Uint32Array.BYTES_PER_ELEMENT,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST})}createDrawSlotBuffer(e){return this.device.createBuffer({label:"draw-uniforms",size:e*pt,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST})}allocateDrawSlot(){if(this.freeDrawSlots.length)return this.freeDrawSlots.pop();if(this.nextDrawSlot>=this.drawSlotCapacity){let e=this.drawSlotCapacity*2,r=new Float32Array(e*Cr);r.set(this.drawStaging),this.drawSlotBuffer.destroy?.(),this.drawSlotCapacity=e,this.drawSlotBuffer=this.createDrawSlotBuffer(e),this.drawStaging=r,this.rebindAll()}return this.nextDrawSlot++}flushDraws(e){if(!e.length)return;let r=1/0,a=-1;for(let s of e)r=Math.min(r,s.drawSlot),a=Math.max(a,s.drawSlot);this.device.queue.writeBuffer(this.drawSlotBuffer,r*pt,this.drawStaging,r*Cr,(a-r+1)*Cr)}invalidate(){this.version+=1}setBarrelColor(e){this.barrelColor=[...e],this.invalidate()}makeBindGroup(e,r=0){return this.device.createBindGroup({layout:this.bindGroupLayout,entries:[{binding:0,resource:{buffer:this.globalBuffer}},{binding:1,resource:{buffer:e,offset:r,size:pt}},{binding:2,resource:{buffer:this.layerOffsetBuffer}},{binding:3,resource:{buffer:this.featureMaskBuffer}},{binding:4,resource:{buffer:this.netMaskBuffer}},{binding:5,resource:{buffer:this.occurrenceBuffer}},{binding:6,resource:{buffer:this.barrelRecordBuffer}},{binding:7,resource:{buffer:this.listBuffer}},{binding:8,resource:{buffer:this.placementBuffer}}]})}uploadFeatureMask(){let e=Hd(this.hiddenFeatureIds,this.featureMaskCapacity);this.device.queue.writeBuffer(this.featureMaskBuffer,0,e)}setHiddenFeatureIds(e){this.hiddenFeatureIds=Ds(e);let r=Vd(this.hiddenFeatureIds,this.featureMaskCapacity);r!==this.featureMaskCapacity&&(this.featureMaskBuffer?.destroy?.(),this.featureMaskCapacity=r,this.featureMaskBuffer=this.createFeatureMaskBuffer(r),this.rebindAll()),this.uploadFeatureMask(),this.bundleCache.clear(),this.invalidate()}depthStencilState(e=null,r=!0){let a={format:this.depthFormat,depthWriteEnabled:r,depthCompare:"greater"};return this.stencil&&e&&(a.stencilFront=e,a.stencilBack=e),a}makePipeline(e,r,a,s,n,i={}){let o=this.createShaderModule(r,n);return this.device.createRenderPipeline({layout:e,vertex:{module:o,entryPoint:"vs",buffers:s},fragment:{module:o,entryPoint:"fs",...i.constants?{constants:i.constants}:{},targets:[{format:a,blend:a===rr?void 0:{color:{srcFactor:"src-alpha",dstFactor:"one-minus-src-alpha"},alpha:{srcFactor:"one",dstFactor:"one-minus-src-alpha"}}}]},primitive:{topology:"triangle-list",cullMode:i.cullMode??"none"},depthStencil:this.depthStencilState(i.stencil,i.depthWrite??!0),multisample:{count:this.samplesFor(a)}})}makeBarrelPipeline(e,r,a,s,n=!0){let i=this.createShaderModule(r,s);return this.device.createRenderPipeline({layout:e,vertex:{module:i,entryPoint:"vs",buffers:[{arrayStride:28,attributes:[{shaderLocation:0,offset:0,format:"float32x3"},{shaderLocation:1,offset:12,format:"float32x3"},{shaderLocation:2,offset:24,format:"float32"}]},...n?[Wd]:[]]},fragment:{module:i,entryPoint:"fs",targets:[{format:a,blend:a===rr?void 0:{color:{srcFactor:"src-alpha",dstFactor:"one-minus-src-alpha"},alpha:{srcFactor:"one",dstFactor:"one-minus-src-alpha"}}}]},primitive:{topology:"triangle-list",cullMode:"none"},depthStencil:this.depthStencilState(),multisample:{count:this.samplesFor(a)}})}samplesFor(e){return e===rr?1:this.sampleCount}createShaderModule(e,r){let a=this.device.createShaderModule({label:`pcb-${r}`,code:e});return typeof a.getCompilationInfo=="function"&&a.getCompilationInfo().then(s=>{let n=[...s.messages||[]];if(n.length){console.groupCollapsed(`WebGPU shader compilation info: pcb-${r}`);for(let i of n)console[i.type==="error"?"error":"warn"](`${i.type} ${i.lineNum}:${i.linePos} ${i.message}`);console.groupEnd()}}),a}resize(){let e=Math.min(devicePixelRatio||1,2),r=Math.max(1,Math.floor(this.canvas.clientWidth*e)),a=Math.max(1,Math.floor(this.canvas.clientHeight*e));if(this.canvas.width===r&&this.canvas.height===a)return;this.canvas.width=r,this.canvas.height=a,this.depth?.destroy(),this.colorTarget?.destroy(),this.pickDepth?.destroy(),this.pickTexture?.destroy();let s=this.sampleCount;this.depth=this.device.createTexture({label:"depth",size:[r,a],format:this.depthFormat,sampleCount:s,usage:GPUTextureUsage.RENDER_ATTACHMENT}),this.colorTarget=s>1?this.device.createTexture({label:"color-msaa",size:[r,a],format:this.format,sampleCount:s,usage:GPUTextureUsage.RENDER_ATTACHMENT}):null,this.pickDepth=s>1?this.device.createTexture({label:"pick-depth",size:[r,a],format:this.depthFormat,usage:GPUTextureUsage.RENDER_ATTACHMENT}):this.depth,this.pickTexture=this.device.createTexture({size:[r,a],format:rr,usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.COPY_SRC})}addPrimitive(e,r){let a=e.position.length/3,s=new ArrayBuffer(a*co),n=new Uint32Array(s),i=new Uint16Array(s),o=new Int8Array(s),c=Kx(e.position);for(let y=0;y<a;y+=1){let x=y*5,v=y*3;Vx(i,x*2,e.position,v,c),Hx(o,(x+2)*4,e.normal,v),n[x+3]=e.netId[y]||0,n[x+4]=e.objectFeatureId[y]||0}let l=this.arenas(),f=l.vertex.alloc(s.byteLength);l.vertex.write(f,s);let{indices:d,format:p}=qx(e.indices,a),b=l.index.alloc(d.byteLength);l.index.write(b,d);let h=this.allocateDrawSlot(),u=this.makeBindGroup(this.drawSlotBuffer,h*pt),m=lu(r,this.innerCopperAtFull),g={...r,drawClass:m,slot:this.allocSlot(e.indices.length,r.placements?Ux|r.placements<<3:m),placementCount:r.placements||0,placementBase:0,bounds:e.bounds||r.bounds||null,id:this.nextEntryId++,vertexAllocation:f,indexAllocation:b,quantMin:c.min,quantSize:c.size,indexFormat:p,indexCount:e.indices.length,drawSlot:h,bindGroup:u};return this.entries.push(g),this.bundleCache.clear(),this.invalidate(),g}arenas(){let e=this.shareFrom||this;return e.geometryArenas??={vertex:new pa(e.device,GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST,"geometry-vertices"),index:new pa(e.device,GPUBufferUsage.INDEX|GPUBufferUsage.COPY_DST,"geometry-indices")},e.geometryArenas}arenaSlackBytes(){let e=this.geometryArenas;return e?e.vertex.reservedBytes()-e.vertex.usedBytes+e.index.reservedBytes()-e.index.usedBytes:0}arenaStats(){let e=this.geometryArenas;if(!e)return{chunks:0,reserved:0,used:0};let r=a=>a.chunks.reduce((s,n)=>s+n.free.filter(i=>i.offset+i.size<n.size).reduce((i,o)=>i+o.size,0),0);return{chunks:e.vertex.chunks.length+e.index.chunks.length,reserved:e.vertex.reservedBytes()+e.index.reservedBytes(),used:e.vertex.usedBytes+e.index.usedBytes,holes:r(e.vertex)+r(e.index)}}componentPipelines(e){let r=this.shareFrom||this,a=r.componentPipelineSets.get(e);if(!a){let{instanced:s,features:n,key:i}=r.pipelineSetKinds.get(e),o=r.pipelineLayout,c=r.vertexBuffers,l=io("component",s,n),f=io("componentPick",s,n),d=`${s?"-instanced":""}${i?`+${i}`:""}`;a={main:r.makePipeline(o,l,r.format,c,`component${d}`,{stencil:iu}),blend:r.makePipeline(o,l,r.format,c,`component-blend${d}`),pick:r.makePipeline(o,f,rr,c,`component-pick${d}`)},r.componentPipelineSets.set(e,a)}return a}addInstancedPrimitives(e){let r=e.map(({primitive:a,placements:s,metadata:n})=>{let i=this.addPrimitive(a,{...n,placements:s.length});return i.placementRecords=s,i});return this.writePlacements(),r}writePlacements(){let e=this.entries.filter(o=>o.placementRecords),r=e.reduce((o,c)=>o+c.placementRecords.length,0),a=new ArrayBuffer(Math.max(1,r)*no),s=new Float32Array(a),n=new Uint32Array(a),i=0;for(let o of e){o.placementBase=i;for(let c of o.placementRecords){let l=i*(no/4);s.set(c.rows,l),n[l+12]=c.featureId||0,i+=1}}this.placementBuffer.size<a.byteLength&&(this.placementBuffer.destroy?.(),this.placementBuffer=this.device.createBuffer({label:"component-placements",size:a.byteLength,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),this.rebindAll()),this.device.queue.writeBuffer(this.placementBuffer,0,a),this.invalidate()}removeEntries(e){if(!e?.length)return;let r=new Set(e.map(a=>a.id));for(let a of e){let s=this.arenas();a.vertexAllocation&&s.vertex.free(a.vertexAllocation),a.indexAllocation&&s.index.free(a.indexAllocation),this.freeDrawSlots.push(a.drawSlot),a.slot!=null&&(this.setSlot(a.slot,0,4),this.freeSlots.push(a.slot))}this.entries=this.entries.filter(a=>!r.has(a.id)),e.some(a=>a.placementRecords)&&this.writePlacements(),this.bundleCache.clear(),this.invalidate()}dispose(){this.removeEntries(this.entries),this.shareFrom||(this.geometryArenas?.vertex.destroy(),this.geometryArenas?.index.destroy(),this.geometryArenas=null),this.barrels&&(this.barrels.vertexBuffer?.destroy?.(),this.barrels.indexBuffer?.destroy?.(),this.barrels.instanceBuffer?.destroy?.(),this.barrels.drawBuffer?.destroy?.(),this.barrels=null),this.depth?.destroy(),this.colorTarget?.destroy(),this.pickDepth!==this.depth&&this.pickDepth?.destroy(),this.insetColor?.texture.destroy(),this.pickTexture?.destroy(),this.featureMaskBuffer?.destroy?.(),this.occurrenceBuffer?.destroy?.(),this.barrelRecordBuffer?.destroy?.(),this.listBuffer?.destroy?.(),this.argsBuffer?.destroy?.(),this.classesBuffer?.destroy?.();for(let e of[this.box?.vertexBuffer,this.box?.indexBuffer,this.box?.drawBuffer,this.cull?.uniform,this.cull?.lods,this.cull?.counters,this.cull?.readback])e?.destroy?.();this.box=null,this.cull=null,this.drawSlotBuffer?.destroy?.(),this.depth=null,this.colorTarget=null,this.pickDepth=null,this.insetColor=null,this.pickTexture=null,this.featureMaskBuffer=null,this.bundleCache.clear()}setBarrels(e){if(!e?.length)return;let r=uu,a=[],s=[],n=(u,m,g)=>{let y=a.length/7;for(let x=0;x<r;x+=1){let v=Math.PI*2*(x+.5)/r,E=Math.cos(v),S=Math.sin(v),[T,_,I]=g(E,S);a.push(E,S,m,T,_,I,u)}return y},i=(u,m)=>{for(let g=0;g<r;g+=1){let y=(g+1)%r;s.push(u+g,u+y,m+y,u+g,m+y,m+g)}};for(let u of[0,1]){let m=u?(g,y)=>[-g,-y,0]:(g,y)=>[g,y,0];i(n(u,0,m),n(u,1,m))}for(let[u,m]of[[0,1],[1,-1]]){let g=()=>[0,0,m];i(n(0,u,g),n(2,u,g))}let o=new Float32Array(a),c=new Uint16Array(s),l=Yd(e),f=this.device.createBuffer({size:o.byteLength,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST}),d=this.device.createBuffer({size:c.byteLength,usage:GPUBufferUsage.INDEX|GPUBufferUsage.COPY_DST}),p=this.device.createBuffer({size:l.byteLength,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST});this.device.queue.writeBuffer(f,0,o),this.device.queue.writeBuffer(d,0,c),this.device.queue.writeBuffer(p,0,l);let b=Jd(e);this.barrelRecordBuffer?.destroy?.(),this.barrelRecordBuffer=this.device.createBuffer({label:"barrel-records",size:b.byteLength,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),this.device.queue.writeBuffer(this.barrelRecordBuffer,0,b);let h=this.device.createBuffer({size:pt,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});this.barrels={records:e,vertexBuffer:f,indexBuffer:d,instanceBuffer:p,indexCount:c.length,instanceCount:e.length,drawBuffer:h,bindGroup:null},this.setSlot(0,c.length,2),this.rebindAll(),this.invalidate()}render(e){let{panels:r,layerOffsets:a}=e;this.resize(),this.device.queue.writeBuffer(this.layerOffsetBuffer,0,a);let s=this.context.getCurrentTexture().createView(),n=0,i=0;r.forEach((o,c)=>{let l=this.device.createCommandEncoder(),f=!this.identityOnly&&this.encodeCull(l,o),d=l.beginRenderPass({colorAttachments:[this.colorAttachment(s,c===0,c===r.length-1)],depthStencilAttachment:this.depthAttachment()}),p=oo(o.viewport,this.canvas.width,this.canvas.height);d.setViewport(p.x,p.y,p.width,p.height,0,1),d.setScissorRect(p.x,p.y,p.width,p.height),this.analytic&&(this.analytic.viewport=p);let b=this.encodeDraws(d,o,e);n+=b.triangles,i+=b.draws,d.end(),this.device.queue.submit([l.finish()]),f&&this.readCullCounts()}),this.frameStats={triangles:Math.round(n),draws:i}}renderInto(e,r,a){if(!this.identityOnly)throw new Error("renderInto: one-board renderer only");let s=this.device.createCommandEncoder({label:"inset"}),n={view:e.depthView,depthClearValue:0,depthLoadOp:"clear",depthStoreOp:"discard"};this.stencil&&Object.assign(n,{stencilClearValue:0,stencilLoadOp:"clear",stencilStoreOp:"discard"});let i=s.beginRenderPass({colorAttachments:[this.colorAttachment(e.colorView,!0,!0,this.insetColorView(e.width,e.height))],depthStencilAttachment:n}),o=oo(r.viewport,e.width,e.height);i.setViewport(o.x,o.y,o.width,o.height,0,1),i.setScissorRect(o.x,o.y,o.width,o.height),this.analytic&&(this.analytic.viewport=o);let c=this.encodeDraws(i,r,a);return i.end(),this.device.queue.submit([s.finish()]),c}encodeDraws(e,r,{activeNetId:a,selectedFeatureId:s,time:n,visibleLayers:i,showBoard:o,showComponents:c,showPaste:l=!0,componentOpacity:f,boardOpacity:d,isolateNet:p,compareMode:b=!1,compareOffsets:h=new Map,layerAlphas:u=null,visibleTileIds:m=null,layerOffsets:g=null}){let y=0,x=0,v=null;if(this.stencil&&e.setStencilReference(1),this.writeGlobals(r.matrix,a,r.layerId,n,s),this.relief?.ready&&!b)return{triangles:this.relief.vertexCount/3,draws:this.relief.encode(e,r.matrix)};let{pipelines:E,indirect:S,barrelInstances:T}=this.drawSet(),_=!l||!!(a||this.netHighlightActive),I=this.entries.filter(B=>this.visible(B,r.layerId,i,o,c,f,b,m)&&!(_&&B.boardRole==="paste")&&!(B.side&&this.hiddenBoardLayers?.has(`${B.boardRole}:${B.side}`))),N=I.filter(B=>!Gs(B)).sort((B,R)=>+!!B.stencilMark-+!!R.stencilMark),C=I.filter(B=>Gs(B)).sort((B,R)=>Gs(B)-Gs(R));for(let B of I)this.writeDraw(B,a,f,d,p,b,h.get(B.layerId),u?.get(B.layerId)??1);this.flushDraws(I),N.length>64?e.executeBundles([this.renderBundle(N,r.layerId)]):this.drawEntries(e,N,E,S);for(let B of I)y+=B.indexCount/3*this.countFor(B.drawClass)*(B.placementCount||1);return x+=I.length,this.analytic&&!b&&(v={matrix:r.matrix,showBoard:o,boardOpacity:d,hidePaste:_,isolateNet:p,panelLayer:r.layerId,assemblyOpacity:l?1:f,hiddenBoardLayers:this.hiddenBoardLayers},x+=this.analytic.encodeInto(e,g,r.layerId?new Set([r.layerId]):i,!1,v),x+=this.analytic.encodeBarrels(e,g,r.matrix),x+=this.analytic.encodeArrows(e)),!b&&this.barrels&&!this.analytic?.hasBarrels()&&(r.layerId===0||i.has(r.layerId))&&(this.writeBarrelDraw(p),this.drawBarrels(e,E.barrel,S,T),y+=this.barrels.indexCount/3*this.countFor(2),x+=1),S&&!b&&(this.drawBox(e,E.box),y+=12*this.countFor(3),x+=1),v&&(x+=this.analytic.encodeGhostBarrels(e),x+=this.analytic.encodeBlended(e,g,r.layerId?new Set([r.layerId]):i,v)),this.drawBlended(e,C,E,S),{triangles:y,draws:x}}colorAttachment(e,r=!0,a=!0,s=this.colorTarget?.createView()){let n={view:e,clearValue:{r:.91,g:.93,b:.94,a:1},loadOp:r?"clear":"load",storeOp:"store"};return this.sampleCount===1?n:{...n,view:s,resolveTarget:e,storeOp:a?"discard":"store"}}insetColorView(e,r){if(this.sampleCount!==1){if(this.insetColor?.width!==e||this.insetColor?.height!==r){this.insetColor?.texture.destroy();let a=this.device.createTexture({label:"inset-msaa",size:[e,r],format:this.format,sampleCount:this.sampleCount,usage:GPUTextureUsage.RENDER_ATTACHMENT});this.insetColor={texture:a,view:a.createView(),width:e,height:r}}return this.insetColor.view}}depthAttachment(e=!1){let r={view:(e?this.pickDepth:this.depth).createView(),depthClearValue:0,depthLoadOp:"clear",depthStoreOp:"discard"};return this.stencil&&Object.assign(r,{stencilClearValue:0,stencilLoadOp:"clear",stencilStoreOp:"discard"}),r}drawEntries(e,r,a,s){let n=null;for(let i of r){let o=i.placementCount?this.componentPipelines(a).main:i.stencilMark?a.mark:a.main;o!==n&&(e.setPipeline(o),n=o),this.drawEntry(e,i,s)}}drawBlended(e,r,a,s){for(let n of r)if(n.boardRole==="soldermask"&&n.kind==="board")e.setPipeline(a.mask),this.drawEntry(e,n,s),a.maskCovered&&(e.setPipeline(a.maskCovered),this.drawEntry(e,n,s));else{let i=n.translucent?a.translucent??a.blend:a.blend;e.setPipeline(n.placementCount?this.componentPipelines(a).blend:i),this.drawEntry(e,n,s)}}setPlaceholdersVisible(e){this.showPlaceholders=!!e,this.invalidate()}setHiddenBoardLayers(e){this.hiddenBoardLayers=new Set(e||[]),this.invalidate()}visible(e,r,a,s,n,i,o=!1,c=null){return e.placeholder&&!this.showPlaceholders?!1:o?e.kind==="copper"&&a.has(e.layerId):e.kind==="copper"&&this.analytic?.coversLayer(e.layerId)||e.kind==="board"&&this.analytic?.coversRole(e.boardRole)||e.kind==="board"&&e.boardRole==="pad"||e.kind==="copper"&&c&&!c.has(e.tileId)||e.innerCopper&&this.innerCopperMode==="none"?!1:e.boardRole==="paste"?r===0&&a.has(e.layerId):e.kind==="board"?r===0&&s:e.kind==="component"?r===0&&n&&i>.001:r?e.layerId===r:a.has(e.layerId)}writeGlobals(e,r,a,s,n=0){let i=this.globalScratch,o=this.globalScratchF32;o.fill(0),o.set(e,0);let c=this.globalScratchView;c.setUint32(64,r||0,!0),c.setUint32(68,a||0,!0),c.setFloat32(72,s,!0),c.setFloat32(76,r||this.netHighlightActive?1:0,!0),c.setUint32(80,n||0,!0),c.setUint32(84,this.selectedOccurrence>=0?this.selectedOccurrence+1+this.occurrenceBase:0,!0),c.setUint32(88,this.occurrenceBase,!0),c.setUint32(92,this.emphasisStride,!0),o.set([.35,-.5,.8,0],24),this.device.queue.writeBuffer(this.globalBuffer,0,i)}writeDraw(e,r,a,s=1,n=!1,i=!1,o=null,c=1){let l=this.drawStaging.subarray(e.drawSlot*Cr,(e.drawSlot+1)*Cr);l.fill(0);let f=e.color||e.material.baseColor;l.set(f,0),l.set([e.material.metallic||0,e.material.roughness??.72,e.opacityScale!=null?a:0,Gx[e.drawClass]??1],4);let d=Xx(e);l.set([o?.[0]||0,o?.[1]||0,(i?-(e.baseZ||0):e.layerOffset||0)+d,e.kind==="copper"||e.boardRole==="paste"?Number(e.layerId||0)+1:0],8);let p=Number.isFinite(f?.[3])?f[3]:1,b=e.kind==="component"?a*(e.opacityScale??1):e.kind==="board"&&e.boardRole!=="paste"?s*Wx(e,p):c,h=e.kind==="copper"?1:e.kind==="component"?2:0,u=n?1:e.innerCopper&&this.innerCopperMode==="lit"?2:0;if(l.set([h,b,u,i?1:0],12),e.placementCount){let m=new Uint32Array(l.buffer,l.byteOffset+64,2);m[0]=e.placementBase,m[1]=e.placementCount}l.set(e.quantMin,20),l.set(e.quantSize,24)}writeBarrelDraw(e=!1){let r=this.barrelDrawScratch;r.fill(0),r.set(this.barrelColor,0),r.set([.75,.32,0,0],4),r.set([1,1,e?1:0,0],12),this.device.queue.writeBuffer(this.barrels.drawBuffer,0,r)}renderBundle(e,r){let{pipelines:a,indirect:s}=this.drawSet(),{vertex:n,index:i}=this.arenas(),o=`${r}:${s?"indirect":"single"}:${this.shaderFeatureKey}:${n.generation}.${i.generation}:${e.map(d=>d.id).join(",")}`,c=this.bundleCache.get(o);if(c)return c;let l=this.device.createRenderBundleEncoder({colorFormats:[this.format],depthStencilFormat:this.depthFormat,sampleCount:this.sampleCount});this.drawEntries(l,e,a,s);let f=l.finish();return this.bundleCache.set(o,f),this.bundleCache.size>32&&this.bundleCache.delete(this.bundleCache.keys().next().value),f}pick(e,r,a,s){let n=this.pickSerial.then(()=>this.performPick(e,r,a,s));return this.pickSerial=n.catch(()=>0),n}async performPick(e,r,a,s){this.resize();let n=Math.max(0,Math.min(this.canvas.width-1,Math.floor(r))),i=Math.max(0,Math.min(this.canvas.height-1,Math.floor(a)));this.device.queue.writeBuffer(this.layerOffsetBuffer,0,s.layerOffsets);let o=this.device.createCommandEncoder(),c=o.beginRenderPass({colorAttachments:[{view:this.pickTexture.createView(),clearValue:{r:0,g:0,b:0,a:0},loadOp:"clear",storeOp:"store"}],depthStencilAttachment:this.depthAttachment(!0)}),l=oo(e.viewport,this.canvas.width,this.canvas.height);return c.setViewport(l.x,l.y,l.width,l.height,0,1),c.setScissorRect(l.x,l.y,l.width,l.height),this.analytic&&(this.analytic.viewport=l),this.encodePick(c,e,s),c.end(),this.readPick(o,n,i)}encodePick(e,r,a){if(this.relief?.ready&&!a.compareMode)return;this.writeGlobals(r.matrix,a.activeNetId,r.layerId,performance.now()/1e3,a.selectedFeatureId);let{pipelines:s,indirect:n,barrelInstances:i}=this.drawSet();e.setPipeline(s.pick);let o=[];for(let c of this.entries)this.visible(c,r.layerId,a.visibleLayers,a.showBoard,a.showComponents,a.componentOpacity,a.compareMode,a.visibleTileIds)&&(c.kind==="board"&&(this.identityOnly||c.boardRole!=="substrate")||(this.writeDraw(c,a.activeNetId,a.componentOpacity,a.boardOpacity,a.isolateNet,a.compareMode,a.compareOffsets?.get(c.layerId)),o.push(c)));this.flushDraws(o);for(let c of o)e.setPipeline(c.placementCount?this.componentPipelines(s).pick:s.pick),this.drawEntry(e,c,n);if(!a.compareMode&&this.barrels&&!this.analytic?.hasBarrels()&&(this.writeBarrelDraw(a.isolateNet),this.drawBarrels(e,s.barrelPick,n,i)),n&&!a.compareMode&&this.drawBox(e,s.boxPick),this.analytic&&!a.compareMode){let c=r.layerId?new Set([r.layerId]):a.visibleLayers;this.analytic.encodeInto(e,a.layerOffsets,c,!0,{matrix:r.matrix,panelLayer:r.layerId,isolateNet:a.isolateNet,showBoard:a.showBoard}),this.analytic.encodeBarrels(e,a.layerOffsets,r.matrix,!0)}}async readPick(e,r,a){let s=this.device.createBuffer({label:"pick-readback",size:256,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});e.copyTextureToBuffer({texture:this.pickTexture,origin:{x:r,y:a}},{buffer:s,bytesPerRow:256},{width:1,height:1}),this.device.queue.submit([e.finish()]);try{await s.mapAsync(GPUMapMode.READ);let n=new DataView(s.getMappedRange()),i=n.getUint32(0,!0),o=n.getUint32(4,!0);if(s.unmap(),this.analytic&&i&2147483648&&o)return{kind:"analytic",occurrenceIndex:-1,featureId:0,operationIndex:o-1,occurrenceKey:null};let c=jd(i,o);return{...c,occurrenceKey:c.occurrenceIndex>=0?this.occurrenceKeys[c.occurrenceIndex]??null:null}}finally{s.mapState==="mapped"&&s.unmap(),s.destroy()}}},Gx=Object.freeze({0:1,1:0,5:2});function Kx(t){let e=[1/0,1/0,1/0],r=[-1/0,-1/0,-1/0];for(let a=0;a<t.length;a+=3)for(let s=0;s<3;s+=1){let n=t[a+s];n<e[s]&&(e[s]=n),n>r[s]&&(r[s]=n)}return Number.isFinite(e[0])?{min:e,size:e.map((a,s)=>r[s]>a?r[s]-a:1)}:{min:[0,0,0],size:[1,1,1]}}function Vx(t,e,r,a,s){for(let n=0;n<3;n+=1){let i=(r[a+n]-s.min[n])/s.size[n];t[e+n]=Math.max(0,Math.min(65535,Math.round(i*65535)))}t[e+3]=0}function Hx(t,e,r,a){for(let s=0;s<3;s+=1){let n=Number(r[a+s])||0;t[e+s]=Math.max(-127,Math.min(127,Math.round(n*127)))}t[e+3]=0}function qx(t,e){if(e<=65536){let r=new Uint16Array(t.length+(t.length&1));return r.set(t),{indices:r,format:"uint16"}}return{indices:t instanceof Uint32Array?t:new Uint32Array(t),format:"uint32"}}function ju(t,e){return t*co+(t<=65536?(e+(e&1))*2:e*4)}function lu(t,e){return t.kind==="component"||t.innerCopper&&e?1:t.kind==="board"&&(t.boardRole==="substrate"||t.boardRole==="soldermask")?5:0}function Gs(t){return t.translucent?3:t.kind!=="board"?0:t.boardRole==="soldermask"?1:t.boardRole==="silkscreen"?2:0}function Wx(t,e){return t.kind!=="board"||t.boardRole==="substrate"?1:t.boardRole==="soldermask"?Math.min(e,.72):t.boardRole==="silkscreen"?Math.min(e,.92):e}function Xx(t){if(t.kind!=="board"||t.boardRole!=="soldermask"&&t.boardRole!=="silkscreen")return 0;let e=t.bounds,a=(e?(e[2]+e[5])*.5:0)<0?-1:1,s=t.boardRole==="silkscreen"?35e-6:18e-6;return a*s}function oo(t,e,r){let a=Math.max(0,Math.min(e-1,Math.floor(t.x))),s=Math.max(0,Math.min(r-1,Math.floor(t.y)));return{x:a,y:s,width:Math.max(1,Math.min(e-a,Math.floor(t.width))),height:Math.max(1,Math.min(r-s,Math.floor(t.height)))}}function Lu(t){return t*12+2}function Du(t){let e=[],r=0,a=0,s=0;for(let b=0;b<t.length;b+=1){let h=Math.floor(t[b].samplesMm.length/3);h<2||(e.push(b),r+=h,a+=Lu(h),s+=(h-1)*12*6+72)}let n=new Float32Array(Math.max(r,1)*4),i=new ArrayBuffer(Math.max(e.length,1)*32),o=new Uint32Array(i),c=new Float32Array(i),l=new Uint32Array(Math.max(s,3)),f=0,d=0,p=0;return e.forEach((b,h)=>{let u=t[b],m=Math.floor(u.samplesMm.length/3);for(let x=0;x<m;x+=1)n[(f+x)*4]=u.samplesMm[x*3]*.001,n[(f+x)*4+1]=u.samplesMm[x*3+1]*.001,n[(f+x)*4+2]=u.samplesMm[x*3+2]*.001;o[h*8]=f,o[h*8+1]=m,o[h*8+2]=d,o[h*8+3]=h,c[h*8+4]=u.radiusMm*.001;let g=(x,v)=>d+x*12+v%12;for(let x=0;x+1<m;x+=1)for(let v=0;v<12;v+=1)l.set([g(x,v),g(x+1,v),g(x+1,v+1),g(x,v),g(x+1,v+1),g(x,v+1)],p),p+=6;let y=d+m*12;for(let x=0;x<12;x+=1)l.set([y,g(0,x+1),g(0,x)],p),l.set([y+1,g(m-1,x),g(m-1,x+1)],p+3),p+=6;f+=m,d+=Lu(m)}),{samples:n,segments:o,indices:l,kept:e,sampleCount:r,vertexCount:a,indexCount:s}}var Yx=`
struct Segment { start: u32, count: u32, vertexStart: u32, color: u32, radius: f32, p0: u32, p1: u32, p2: u32 };
struct Vertex { position: vec4f, normal: vec4f };
`,Jx=`${Yx}
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
`,Qx=`
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
`,Uu=96,Xs=class{constructor(e){this.host=e,this.device=e.device,this.counts={segments:0,samples:0,vertices:0,indices:0},this.dirty=!1,this.kept=[];let r=this.device,a=r.createShaderModule({label:"harness-tubes-compute",code:Jx});this.computeLayout=r.createBindGroupLayout({label:"harness-tubes-compute",entries:[{binding:0,visibility:GPUShaderStage.COMPUTE,buffer:{type:"read-only-storage"}},{binding:1,visibility:GPUShaderStage.COMPUTE,buffer:{type:"read-only-storage"}},{binding:2,visibility:GPUShaderStage.COMPUTE,buffer:{type:"storage"}},{binding:3,visibility:GPUShaderStage.COMPUTE,buffer:{type:"storage"}},{binding:4,visibility:GPUShaderStage.COMPUTE,buffer:{type:"uniform"}}]});let s=r.createPipelineLayout({bindGroupLayouts:[this.computeLayout]});this.framesPipeline=r.createComputePipeline({layout:s,compute:{module:a,entryPoint:"framesMain"}}),this.ringsPipeline=r.createComputePipeline({layout:s,compute:{module:a,entryPoint:"ringsMain"}});let n=r.createShaderModule({label:"harness-tubes-draw",code:Qx});this.drawLayout=r.createBindGroupLayout({label:"harness-tubes-draw",entries:[{binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}},{binding:1,visibility:GPUShaderStage.FRAGMENT,buffer:{type:"read-only-storage"}}]}),this.drawPipeline=r.createRenderPipeline({label:"harness-tubes",layout:r.createPipelineLayout({bindGroupLayouts:[this.drawLayout]}),vertex:{module:n,entryPoint:"vs",buffers:[{arrayStride:32,attributes:[{shaderLocation:0,offset:0,format:"float32x4"},{shaderLocation:1,offset:16,format:"float32x4"}]}]},fragment:{module:n,entryPoint:"fs",targets:[{format:e.format}]},primitive:{topology:"triangle-list",cullMode:"none"},depthStencil:e.depthStencilState(),multisample:{count:e.sampleCount}}),this.globals=r.createBuffer({label:"harness-tubes-globals",size:Uu,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),this.countBuffer=r.createBuffer({label:"harness-tubes-counts",size:16,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),this.buffers={},this.capacity={samples:0,segments:0,vertices:0,indices:0},this.globalScratch=new Float32Array(Uu/4)}ensure(e,r,a){let s=this.buffers[e];return s&&s.size>=r?!1:(s?.destroy(),this.buffers[e]=this.device.createBuffer({label:`harness-tubes-${e}`,size:Math.max(256,Math.ceil(r*1.5/4)*4),usage:a}),!0)}setTubes(e,r){let a=Du(e);if(this.kept=a.kept.map(o=>e[o]),this.counts={segments:a.kept.length,samples:a.sampleCount,vertices:a.vertexCount,indices:a.indexCount},!this.counts.segments){this.dirty=!1;return}let s=GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST,n=!1;n=this.ensure("samples",a.samples.byteLength,s)||n,n=this.ensure("segments",a.segments.byteLength,s)||n,n=this.ensure("frames",a.samples.byteLength,GPUBufferUsage.STORAGE)||n,n=this.ensure("vertices",this.counts.vertices*32,GPUBufferUsage.STORAGE|GPUBufferUsage.VERTEX)||n,this.ensure("indices",a.indices.byteLength,GPUBufferUsage.INDEX|GPUBufferUsage.COPY_DST);let i=this.device.queue;i.writeBuffer(this.buffers.samples,0,a.samples),i.writeBuffer(this.buffers.segments,0,a.segments),i.writeBuffer(this.buffers.indices,0,a.indices),i.writeBuffer(this.countBuffer,0,new Uint32Array([this.counts.segments,this.counts.samples,this.counts.vertices,0])),(n||!this.computeGroup)&&(this.computeGroup=this.device.createBindGroup({layout:this.computeLayout,entries:["samples","segments","frames","vertices"].map((o,c)=>({binding:c,resource:{buffer:this.buffers[o]}})).concat([{binding:4,resource:{buffer:this.countBuffer}}])})),this.setColors(r),this.dirty=!0}setColors(e){if(!this.counts.segments)return;let r=new Float32Array(this.counts.segments*4);this.kept.forEach((a,s)=>{let{rgb:n,mode:i}=e(a);r.set([n[0],n[1],n[2],i],s*4)}),(this.ensure("colors",r.byteLength,GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST)||!this.drawGroup||this.drawGroupColors!==this.buffers.colors)&&(this.drawGroup=this.device.createBindGroup({layout:this.drawLayout,entries:[{binding:0,resource:{buffer:this.globals}},{binding:1,resource:{buffer:this.buffers.colors}}]}),this.drawGroupColors=this.buffers.colors),this.device.queue.writeBuffer(this.buffers.colors,0,r)}encodeCompute(e){if(!this.dirty||!this.counts.segments)return;let r=e.beginComputePass({label:"harness-tubes"});r.setBindGroup(0,this.computeGroup),r.setPipeline(this.framesPipeline),r.dispatchWorkgroups(Math.ceil(this.counts.segments/64)),r.setPipeline(this.ringsPipeline),r.dispatchWorkgroups(Math.ceil(this.counts.vertices/64)),r.end(),this.dirty=!1}draw(e,r,a=0){if(!this.counts.segments)return 0;let s=this.globalScratch;return s.fill(0),s.set(r,0),s.set([.35,-.45,.82,0],16),s[20]=a,this.device.queue.writeBuffer(this.globals,0,s),e.setPipeline(this.drawPipeline),e.setBindGroup(0,this.drawGroup),e.setVertexBuffer(0,this.buffers.vertices),e.setIndexBuffer(this.buffers.indices,"uint32"),e.drawIndexed(this.counts.indices),this.counts.indices/3}gpuMemoryBytes(){return Object.values(this.buffers).reduce((e,r)=>e+r.size,0)}dispose(){for(let e of Object.values(this.buffers))e.destroy();this.globals.destroy(),this.countBuffer.destroy(),this.buffers={}}};var Zx=[0,0,0,1,1,1],$s=class t{static async create(e){return new t(await ar.create(e))}constructor(e){this.host=e,this.canvas=e.canvas,this.device=e.device,e.alwaysInstanced=!0,e.setOccurrences([]),this.assets=new Map,this.order=[],this.frameStats={triangles:0,draws:0},this.lodThresholds={...dt},this.tubes=null,this.tubeVersion=0}setTubes(e,r){!e.length&&!this.tubes||(this.tubes??=new Xs(this.host),this.tubes.setTubes(e,r),this.tubeVersion+=1)}setTubeColors(e){this.tubes?.setColors(e),this.tubeVersion+=1}asset(e){let r=this.assets.get(e);return r||(r=new ar(this.canvas,this.device,{shareFrom:this.host}),r.setLodThresholds(this.lodThresholds),this.assets.set(e,r)),r}standIn(e,r){let a=this.asset(e);return a.standIn||(a.standIn=!0,a.setBoardBounds(Zx),a.setLodOverride(Dd)),a.boxColor=[...r],a}removeAsset(e){let r=this.assets.get(e);r&&(r.dispose(),this.assets.delete(e))}get renderers(){return this.order.map(e=>this.assets.get(e)).filter(Boolean)}setOccurrences(e){this.order=[...e.keys()].filter(a=>this.assets.has(a));for(let[a,s]of this.assets)e.has(a)||s.setOccurrences([]);for(let a of this.order)this.assets.get(a).setOccurrences(e.get(a));let r=0;for(let a of this.renderers)a.occurrenceBase=r,r+=a.occurrenceCount;this.occurrenceCount=r}locate(e){for(let r of this.renderers){let a=e-r.occurrenceBase;if(a>=0&&a<r.occurrenceCount)return{renderer:r,local:a}}return null}keyOf(e){let r=this.locate(e);return r?r.renderer.occurrenceKeys[r.local]??null:null}setSelectedOccurrence(e){let r=e>=0?this.locate(e):null;for(let a of this.renderers)a.selectedOccurrence=!a.standIn&&r?.renderer===a?r.local:-1}resize(){this.host.resize()}render(e,r){let a=this.host;a.resize();let s=this.renderers.filter(d=>d.occurrenceCount>0),n=new Map(s.map(d=>[d,r(d)]));for(let[d,p]of n)zu(d,p);let i=this.device.createCommandEncoder(),o=s.filter(d=>d.encodeCull(i,e));this.tubes?.encodeCompute(i);let c=i.beginRenderPass({colorAttachments:[a.colorAttachment(a.context.getCurrentTexture().createView())],depthStencilAttachment:a.depthAttachment()});Gu(c,e.viewport,this.canvas);let l=0,f=0;for(let d of s){let p=d.encodeDraws(c,e,n.get(d));l+=p.triangles,f+=p.draws}this.tubes?.counts.segments&&(l+=this.tubes.draw(c,e.matrix,performance.now()/1e3),f+=1),c.end(),this.device.queue.submit([i.finish()]);for(let d of o)d.readCullCounts();this.frameStats={triangles:Math.round(l),draws:f}}pick(e,r,a,s){let n=this.host.pickSerial.then(()=>this.performPick(e,r,a,s));return this.host.pickSerial=n.catch(()=>0),n}async performPick(e,r,a,s){let n=this.host;n.resize();let i=Math.max(0,Math.min(this.canvas.width-1,Math.floor(r))),o=Math.max(0,Math.min(this.canvas.height-1,Math.floor(a))),c=this.device.createCommandEncoder(),l=c.beginRenderPass({colorAttachments:[{view:n.pickTexture.createView(),clearValue:{r:0,g:0,b:0,a:0},loadOp:"clear",storeOp:"store"}],depthStencilAttachment:n.depthAttachment(!0)});Gu(l,e.viewport,this.canvas);for(let p of this.renderers){if(p.occurrenceCount===0)continue;let b=s(p);zu(p,b),p.encodePick(l,e,b)}l.end();let f=await n.readPick(c,i,o),d=f.occurrenceIndex>=0?this.locate(f.occurrenceIndex):null;return{...f,occurrenceKey:d?d.renderer.occurrenceKeys[d.local]??null:null,renderer:d?.renderer||null,standIn:!!d?.renderer?.standIn}}gpuMemoryBytes(){let e=0;for(let r of this.renderers)e+=r.gpuMemoryBytes();return e+=this.tubes?.gpuMemoryBytes()||0,e+=this.host.arenaSlackBytes(),e-Math.max(0,this.renderers.length-1)*this.canvas.width*this.canvas.height*12}gpuMemoryBreakdown(){let e={};for(let[r,a]of this.assets){let s=a.gpuMemoryBreakdown();delete s.targets,e[r]=s}return{assets:e,tubes:this.tubes?.gpuMemoryBytes()||0,targets:this.canvas.width*this.canvas.height*12,arena:this.host.arenaStats()}}setLodThresholds(e){this.lodThresholds=Nr({...this.lodThresholds,...e});for(let r of this.assets.values())r.setLodThresholds(this.lodThresholds);return{...this.lodThresholds}}cullCounts(){let e={full:0,board:0,body:0,box:0,culled:0};for(let r of this.renderers)if(r.occurrenceCount)for(let a of Object.keys(e))e[a]+=r.cullCounts[a]||0;return e}dispose(){for(let e of[...this.assets.keys()])this.removeAsset(e);this.tubes?.dispose(),this.tubes=null,this.host.dispose(),this.host.context?.unconfigure?.(),this.device.destroy?.()}};function zu(t,e){e?.layerOffsets&&t.device.queue.writeBuffer(t.layerOffsetBuffer,0,e.layerOffsets)}function Gu(t,e,r){let a=Math.max(0,Math.min(r.width-1,Math.floor(e.x))),s=Math.max(0,Math.min(r.height-1,Math.floor(e.y))),n=Math.max(1,Math.min(r.width-a,Math.floor(e.width))),i=Math.max(1,Math.min(r.height-s,Math.floor(e.height)));t.setViewport(a,s,n,i,0,1),t.setScissorRect(a,s,n,i)}var ew=`
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
}`,tw=`
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
}`,rw=`
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
}`,aw=`
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
}`,sw=`
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
}`,nw=`
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
}`,iw=`
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
}`,ow=6.2,cw=4.6,lw=3.8,Js=4*1024*1024,dw=Math.floor(Js/6),Ku=dw*6,Ys=512*1024,Vu=512*1024,Hu=96,uw=96,fw=18,qu=96*1024*1024,hw=2,en=class t{static async create(e,r){if(!navigator.gpu)throw new Error("WebGPU is unavailable in this browser");let a=await navigator.gpu.requestAdapter({powerPreference:"high-performance"});if(!a)throw new Error("No WebGPU adapter is available");let s=await a.requestDevice(),n=await fetch(r,{cache:"default"});if(!n.ok)throw new Error(`Failed to load schematic manifest: ${n.status}`);let i=await n.json();if(!["prism.schematic_world_a0","prism.schematic_vector_a0"].includes(i.schema))throw new Error(`Unsupported schematic scene schema: ${i.schema}`);let o=i.featureTable||i.features,c=await fetch(new URL(o,r),{cache:"default"});if(!c.ok)throw new Error(`Failed to load schematic features: ${c.status}`);let l=pw(await c.json());return new t(e,s,r,i,l)}constructor(e,r,a,s,n){this.canvas=e,this.device=r,this.manifestUrl=a,this.manifest=s,this.isNativeScene=s.schema==="prism.schematic_vector_a0",this.pages=s.pages||[],this.featuresByPage=n,this.featuresById=new Map;for(let b of Object.values(n))for(let h of b)this.featuresById.set(Number(h.id),h);this.context=e.getContext("webgpu"),this.format=navigator.gpu.getPreferredCanvasFormat(),this.context.configure({device:r,format:this.format,alphaMode:"opaque"}),this.flowCanvas=null,this.flowContext=null,this.globalBuffer=r.createBuffer({size:48,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),this.bindGroupLayout=r.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}},{binding:1,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}},{binding:2,visibility:GPUShaderStage.FRAGMENT,sampler:{type:"filtering"}},{binding:3,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:"float"}}]});let i=r.createShaderModule({code:ew});this.pagePipeline=r.createRenderPipeline({layout:r.createPipelineLayout({bindGroupLayouts:[this.bindGroupLayout]}),vertex:{module:i,entryPoint:"vs"},fragment:{module:i,entryPoint:"fs",targets:[{format:this.format}]},primitive:{topology:"triangle-list"}}),this.edgeLayout=r.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}}]});let o=r.createShaderModule({code:tw});this.edgePipeline=r.createRenderPipeline({layout:r.createPipelineLayout({bindGroupLayouts:[this.edgeLayout]}),vertex:{module:o,entryPoint:"vs",buffers:[{arrayStride:8,attributes:[{shaderLocation:0,offset:0,format:"float32x2"}]}]},fragment:{module:o,entryPoint:"fs",targets:[{format:this.format,blend:{color:{srcFactor:"src-alpha",dstFactor:"one-minus-src-alpha"},alpha:{srcFactor:"one",dstFactor:"one-minus-src-alpha"}}}]},primitive:{topology:"line-list"}}),this.edgeBindGroup=r.createBindGroup({layout:this.edgeLayout,entries:[{binding:0,resource:{buffer:this.globalBuffer}}]});let c=r.createShaderModule({code:rw});this.highlightPipeline=r.createRenderPipeline({layout:r.createPipelineLayout({bindGroupLayouts:[this.edgeLayout]}),vertex:{module:c,entryPoint:"vs",buffers:[{arrayStride:8,attributes:[{shaderLocation:0,offset:0,format:"float32x2"}]}]},fragment:{module:c,entryPoint:"fs",targets:[{format:this.format,blend:{color:{srcFactor:"src-alpha",dstFactor:"one-minus-src-alpha"},alpha:{srcFactor:"one",dstFactor:"one-minus-src-alpha"}}}]},primitive:{topology:"line-list"}}),this.highlightBufferSize=4*1024*1024,this.highlightBuffer=r.createBuffer({size:this.highlightBufferSize,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST});let l=r.createShaderModule({code:aw});this.netFlowPipeline=r.createRenderPipeline({layout:r.createPipelineLayout({bindGroupLayouts:[this.edgeLayout]}),vertex:{module:l,entryPoint:"vs",buffers:[{arrayStride:16,attributes:[{shaderLocation:0,offset:0,format:"float32x2"},{shaderLocation:1,offset:8,format:"float32x2"}]}]},fragment:{module:l,entryPoint:"fs",targets:[{format:this.format,blend:{color:{srcFactor:"src-alpha",dstFactor:"one-minus-src-alpha"},alpha:{srcFactor:"one",dstFactor:"one-minus-src-alpha"}}}]},primitive:{topology:"triangle-list"}}),this.netFlowBuffer=r.createBuffer({size:Vu*4,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST}),this.globalUniformScratch=new Float32Array(12),this.pageUniformScratch=new Float32Array(8),this.imageUniformScratch=new Float32Array(8),this.vectorScratch=new Float32Array(Js),this.highlightScratch=new Float32Array(this.highlightBufferSize/4),this.netFlowScratch=new Float32Array(Vu),this.netTrackingCache=null,this.selectedIntrasheetLinkIndex=-1,this.truncatedHighlightCount=0,this.truncatedVectorCount=0,this.frameSerial=0,this.querySerial=0;let f=r.createShaderModule({code:sw});this.vectorPipeline=r.createRenderPipeline({layout:r.createPipelineLayout({bindGroupLayouts:[this.edgeLayout]}),vertex:{module:f,entryPoint:"vs",buffers:[{arrayStride:24,attributes:[{shaderLocation:0,offset:0,format:"float32x2"},{shaderLocation:1,offset:8,format:"float32x4"}]}]},fragment:{module:f,entryPoint:"fs",targets:[{format:this.format,blend:{color:{srcFactor:"src-alpha",dstFactor:"one-minus-src-alpha"},alpha:{srcFactor:"one",dstFactor:"one-minus-src-alpha"}}}]},primitive:{topology:"triangle-list"}}),this.vectorBuffer=r.createBuffer({size:Js*4,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST}),this.vectorBuffers=[this.vectorBuffer];let d=r.createShaderModule({code:nw});this.imagePipeline=r.createRenderPipeline({layout:r.createPipelineLayout({bindGroupLayouts:[this.bindGroupLayout]}),vertex:{module:d,entryPoint:"vs"},fragment:{module:d,entryPoint:"fs",targets:[{format:this.format,blend:{color:{srcFactor:"src-alpha",dstFactor:"one-minus-src-alpha"},alpha:{srcFactor:"one",dstFactor:"one-minus-src-alpha"}}}]},primitive:{topology:"triangle-list"}});let p=r.createShaderModule({code:iw});this.pickPipeline=r.createRenderPipeline({layout:r.createPipelineLayout({bindGroupLayouts:[this.edgeLayout]}),vertex:{module:p,entryPoint:"vs",buffers:[{arrayStride:12,attributes:[{shaderLocation:0,offset:0,format:"float32x2"},{shaderLocation:1,offset:8,format:"uint32"}]}]},fragment:{module:p,entryPoint:"fs",targets:[{format:"r32uint"}]},primitive:{topology:"triangle-list"}}),this.pickVertexBuffer=r.createBuffer({size:Ys*12,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST}),this.pickReadBuffer=r.createBuffer({size:256,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}),this.pickTexture=null,this.pickTextureSize=[0,0],this.pickPending=!1,this.vectorChunks=new Map,this.failedVectorChunks=new Map,this.nativeDetailState=new Map,this.domDetailPageIds=new Set,this.nativeDetailThresholds=new Map,this.residentVectorBytes=0,this.sampler=r.createSampler({magFilter:"linear",minFilter:"linear",mipmapFilter:"linear"}),this.placeholder=this.createSolidTexture([245,247,249,255]),this.pageResources=new Map,this.imageResources=new Map,this.loading=new Map,this.selectedPageId="",this.selectedFeatureId=0,this.activeNetUid="",this.showHierarchy=!0,this.downloadedBytes=0,this.world=s.worldBoundsMm,this.center=[(this.world.minX+this.world.maxX)/2,(this.world.minY+this.world.maxY)/2],this.scale=Math.max((this.world.maxX-this.world.minX)/900,(this.world.maxY-this.world.minY)/650,.1)*1.16,this.edgeBuffer=this.createEdgeBuffer();for(let b of this.pages)this.createPageResource(b)}createSolidTexture(e){let r=this.device.createTexture({size:[1,1],format:"rgba8unorm-srgb",usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST});return this.device.queue.writeTexture({texture:r},new Uint8Array(e),{bytesPerRow:4},[1,1]),r}createPageResource(e){let r=this.device.createBuffer({size:32,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),a={page:e,uniform:r,texture:this.placeholder,textureWidth:0,svgBlob:null,bindGroup:null};this.pageResources.set(e.id,a),this.updateBindGroup(a)}createImageResource(e){let r=this.device.createBuffer({size:32,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),a={path:e,uniform:r,texture:this.placeholder,loaded:!1,bindGroup:null};return this.imageResources.set(e,a),this.updateBindGroup(a),a}updateBindGroup(e){e.bindGroup=this.device.createBindGroup({layout:this.bindGroupLayout,entries:[{binding:0,resource:{buffer:this.globalBuffer}},{binding:1,resource:{buffer:e.uniform}},{binding:2,resource:this.sampler},{binding:3,resource:e.texture.createView()}]})}async loadImageTexture(e){let r=this.imageResources.get(e)||this.createImageResource(e);if(r.loaded)return r;let a=`image:${e}`;if(this.loading.has(a))return this.loading.get(a);let s=(async()=>{try{let n=await fetch(new URL(e,this.manifestUrl),{cache:"default"});if(!n.ok)throw new Error(`Failed to load schematic image ${e}: ${n.status}`);let i=await n.blob(),o=await createImageBitmap(i),c=this.device.createTexture({size:[o.width,o.height],format:"rgba8unorm-srgb",usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST|GPUTextureUsage.RENDER_ATTACHMENT});this.device.queue.copyExternalImageToTexture({source:o},{texture:c},[o.width,o.height]),o.close(),r.texture!==this.placeholder&&r.texture.destroy(),r.texture=c,r.loaded=!0,this.updateBindGroup(r)}finally{this.loading.delete(a)}return r})();return this.loading.set(a,s),s}createEdgeBuffer(){let e=new Map(this.pages.map(n=>[n.id,n])),r=[];for(let n of this.manifest.edges||[]){let i=e.get(n.source),o=e.get(n.target);!i||!o||r.push(i.worldX+i.widthMm/2,i.worldY+i.heightMm,o.worldX+o.widthMm/2,o.worldY)}let a=new Float32Array(r);if(!a.length)return null;let s=this.device.createBuffer({size:a.byteLength,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST});return this.device.queue.writeBuffer(s,0,a),{buffer:s,count:a.length/2}}resize(){let e=Math.min(devicePixelRatio||1,2),r=Math.max(1,Math.floor(this.canvas.clientWidth*e)),a=Math.max(1,Math.floor(this.canvas.clientHeight*e));(this.canvas.width!==r||this.canvas.height!==a)&&(this.canvas.width=r,this.canvas.height=a),this.flowCanvas&&(this.flowCanvas.width!==r||this.flowCanvas.height!==a)&&(this.flowCanvas.width=r,this.flowCanvas.height=a)}setFlowOverlayCanvas(e){e&&(this.flowCanvas=e,this.flowContext=e.getContext("webgpu"),this.flowContext.configure({device:this.device,format:this.format,alphaMode:"premultiplied"}))}writeGlobals(){let e=this.globalUniformScratch;e[0]=this.center[0],e[1]=this.center[1],e[2]=this.scale,e[3]=performance.now()*.001,e[4]=this.canvas.width,e[5]=this.canvas.height,this.device.queue.writeBuffer(this.globalBuffer,0,e)}pagePixelWidth(e){return e.widthMm/this.scale}pageSourcePixelsPerMm(e){let r=this.pagePixelWidth(e)/Math.max(1,e.sourceWidthMm||e.widthMm),a=e.heightMm/this.scale/Math.max(1,e.sourceHeightMm||e.heightMm);return Math.min(r,a)}pageNativeDetailThresholds(e){let r=this.nativeDetailThresholds.get(e.id);if(r)return r;let a=Math.max(1,e.sourceWidthMm||e.widthMm),s=Math.max(1,e.sourceHeightMm||e.heightMm),n=a*s,i=Math.max(0,e.featureCount||e.featureIds?.length||0)/Math.max(1,n),o=fe(1-i*72,.84,1.08),c=fe(Math.sqrt(Math.max(a,s)/Math.max(1,Math.min(a,s)))/1.18,.92,1.14),l=fe(ow*o*c,5,7.4),f={enter:l,exit:fe(Math.min(l-1.2,cw*o),3.8,l-.7),prefetch:fe(Math.min(l-2,lw*o),3,l-1)};return this.nativeDetailThresholds.set(e.id,f),f}pageWantsNativeDetail(e){if(!this.pageHasNativeDetail(e))return!1;let r=this.pageSourcePixelsPerMm(e),a=this.nativeDetailState.get(e.id)===!0,s=this.pageNativeDetailThresholds(e),n=a?s.exit:s.enter,i=r>=n;return i!==a&&this.nativeDetailState.set(e.id,i),i}pageNativeDetailReady(e){if(this.domDetailPageIds.has(e.id)||!this.pageWantsNativeDetail(e))return!1;let r=this.vectorChunks.get(e.id);return!r?.loaded||!r.segments?.length&&!r.fills?.length?!1:this.visibleNativeImagesReady(e,r)}visibleNativeImagesReady(e,r){if(!r?.images?.length)return!0;let a=this.sourceViewportBounds(e,4),s=!0;for(let n of r.images){if(!At(n.bounds,a))continue;(this.imageResources.get(n.path)||this.createImageResource(n.path)).loaded||(s=!1,this.loadImageTexture(n.path).catch(()=>{}))}return s}visiblePages(){let e=this.canvas.width*this.scale/2,r=this.canvas.height*this.scale/2,a=this.center[0]-e,s=this.center[0]+e,n=this.center[1]-r,i=this.center[1]+r;return this.pages.filter(o=>o.worldX+o.widthMm>=a&&o.worldX<=s&&o.worldY+o.heightMm>=n&&o.worldY<=i)}worldViewportBounds(e=0){let r=this.canvas.width*this.scale/2,a=this.canvas.height*this.scale/2;return[this.center[0]-r-e,this.center[1]-a-e,this.center[0]+r+e,this.center[1]+a+e]}sourceViewportBounds(e,r=2.5){let a=this.worldViewportBounds(this.scale*8),s=(a[0]-e.worldX)/e.widthMm*e.sourceWidthMm-r,n=(a[1]-e.worldY)/e.heightMm*e.sourceHeightMm-r,i=(a[2]-e.worldX)/e.widthMm*e.sourceWidthMm+r,o=(a[3]-e.worldY)/e.heightMm*e.sourceHeightMm+r;return[Math.max(-r,Math.min(s,i)),Math.max(-r,Math.min(n,o)),Math.min(e.sourceWidthMm+r,Math.max(s,i)),Math.min(e.sourceHeightMm+r,Math.max(n,o))]}render(){this.frameSerial+=1,this.resize(),this.writeGlobals();let e=this.visiblePages(),r=this.device.createCommandEncoder(),a=r.beginRenderPass({colorAttachments:[{view:this.context.getCurrentTexture().createView(),clearValue:{r:.045,g:.055,b:.073,a:1},loadOp:"clear",storeOp:"store"}]});this.showHierarchy&&this.edgeBuffer&&(a.setPipeline(this.edgePipeline),a.setBindGroup(0,this.edgeBindGroup),a.setVertexBuffer(0,this.edgeBuffer.buffer),a.draw(this.edgeBuffer.count)),a.setPipeline(this.pagePipeline);for(let i of e){let o=this.pageResources.get(i.id),c=this.activeNetUid&&i.netUids.includes(this.activeNetUid),l=this.domDetailPageIds.has(i.id),f=!l&&this.pageNativeDetailReady(i),d=this.pageUniformScratch;d[0]=i.worldX,d[1]=i.worldY,d[2]=i.widthMm,d[3]=i.heightMm,d[4]=i.id===this.selectedPageId?1:0,d[5]=c?1:0,d[6]=this.activeNetUid?1:0,d[7]=f||l?1:0,this.device.queue.writeBuffer(o.uniform,0,d),a.setBindGroup(0,o.bindGroup),a.draw(6);let p=fe(Math.ceil(this.pagePixelWidth(i)*1.3/512)*512,512,6144);o.textureWidth<p*.82&&this.loadPageTexture(i,p).catch(()=>{})}this.scheduleVisibleVectorLoads(e),this.drawVisibleImages(a,e),this.drawVisibleVectors(a,e);let s=this.writeNetTrackingOverlay();s&&!this.flowContext&&(a.setPipeline(this.netFlowPipeline),a.setBindGroup(0,this.edgeBindGroup),a.setVertexBuffer(0,this.netFlowBuffer),a.draw(s));let n=this.writeNetHighlights(e);return n&&(a.setPipeline(this.highlightPipeline),a.setBindGroup(0,this.edgeBindGroup),a.setVertexBuffer(0,this.highlightBuffer),a.draw(n)),a.end(),this.device.queue.submit([r.finish()]),this.renderFlowOverlay(s),this.evictVectorChunks(e),e}renderFlowOverlay(e){if(!this.flowContext)return;let r=this.device.createCommandEncoder(),a=r.beginRenderPass({colorAttachments:[{view:this.flowContext.getCurrentTexture().createView(),clearValue:{r:0,g:0,b:0,a:0},loadOp:"clear",storeOp:"store"}]});e&&(a.setPipeline(this.netFlowPipeline),a.setBindGroup(0,this.edgeBindGroup),a.setVertexBuffer(0,this.netFlowBuffer),a.draw(e)),a.end(),this.device.queue.submit([r.finish()])}drawVisibleImages(e,r){if(!this.isNativeScene)return;let a=!1;for(let s of r){if(this.domDetailPageIds.has(s.id)||!this.pageNativeDetailReady(s))continue;let n=this.vectorChunks.get(s.id);if(!n?.images?.length)continue;let i=this.sourceViewportBounds(s,4);for(let o of n.images){if(!At(o.bounds,i))continue;let c=this.imageResources.get(o.path)||this.createImageResource(o.path);c.loaded||this.loadImageTexture(o.path).catch(()=>{});let l=o.worldOrigin||this.sourceToWorld(s,[o.xMm,o.yMm]),f=o.worldSize||this.sourceSizeToWorld(s,o.widthMm,o.heightMm),d=this.imageUniformScratch;d[0]=l[0],d[1]=l[1],d[2]=f[0],d[3]=f[1],d[4]=0,d[5]=0,d[6]=0,d[7]=0,this.device.queue.writeBuffer(c.uniform,0,d),a||(e.setPipeline(this.imagePipeline),a=!0),e.setBindGroup(0,c.bindGroup),e.draw(6)}}}drawVisibleVectors(e,r){if(!this.isNativeScene)return 0;let a=this.vectorScratch,s=0,n=0,i=0,o=0,c=!1,l=()=>{if(!s)return;let d=this.vectorBuffers[o];d||(d=this.device.createBuffer({size:Js*4,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST}),this.vectorBuffers.push(d)),this.device.queue.writeBuffer(d,0,a,0,s),c||(e.setPipeline(this.vectorPipeline),e.setBindGroup(0,this.edgeBindGroup),c=!0);let p=Math.floor(s/6);e.setVertexBuffer(0,d),e.draw(p),i+=p,o+=1,s=0},f=d=>d>Ku||d>a.length?(n+=1,!1):((s+d>Ku||s+d>a.length)&&l(),!0);for(let d of r){if(this.domDetailPageIds.has(d.id)||!this.pageHasNativeDetail(d))continue;let p=this.vectorChunks.get(d.id);if(!p?.segments?.length&&!p?.fills?.length||!this.pageNativeDetailReady(d))continue;p.lastUsedFrame=this.frameSerial;let b=this.sourceViewportBounds(d),h=Xu(p.spatial,b);for(let u of h.fills){if(!At(u.bounds,b)||!f(18))continue;let m=this.featuresById.get(u.featureId),g=this.activeNetUid&&m?.netUid===this.activeNetUid,x=this.selectedFeatureId===u.featureId?[.24,.58,1,1]:g?[.06,1,.24,1]:this.activeNetUid&&va(m)?Qu(m,u.kind,u.color):wo(m,u.kind,u.color),v=u.worldPoints||u.points.map(E=>this.sourceToWorld(d,E));s=Cw(a,s,v[0],v[1],v[2],x)}for(let u of h.segments){if(!At(u.bounds,b))continue;let m=this.featuresById.get(u.featureId),g=this.activeNetUid&&m?.netUid===this.activeNetUid,y=this.selectedFeatureId===u.featureId,x=y?[.24,.58,1,1]:g?[.06,1,.24,1]:this.activeNetUid&&va(m)?Qu(m,u.kind,u.color):wo(m,u.kind,u.color),v=this.segmentWorldWidth(d,u,m,g||y);for(let E of this.visibleSegmentParts(d,u,m)){if(!f(36))continue;let S=E.worldA||this.sourceToWorld(d,E.a),T=E.worldB||this.sourceToWorld(d,E.b);s=Nw(a,s,S,T,v,x)}}}return l(),this.truncatedVectorCount=n,this.vectorTruncated=n>0,this.lastVectorVertices=i,this.lastVectorChunks=o,i}pageHasNativeDetail(e){return this.isNativeScene?e?.nativeDetail?.enabled!==!1:!1}scheduleVisibleVectorLoads(e){if(!this.isNativeScene)return;let r=[...this.vectorChunks.values()].filter(n=>n?.promise&&!n.loaded).length,a=Math.max(0,hw-r);if(!a)return;let s=e.filter(n=>!this.domDetailPageIds.has(n.id)).filter(n=>this.pageHasNativeDetail(n)&&this.pageSourcePixelsPerMm(n)>=this.pageNativeDetailThresholds(n).prefetch).filter(n=>!this.vectorChunks.get(n.id)?.loaded&&!this.vectorChunks.get(n.id)?.promise).sort((n,i)=>{let o=Math.hypot(n.worldX+n.widthMm/2-this.center[0],n.worldY+n.heightMm/2-this.center[1]),c=Math.hypot(i.worldX+i.widthMm/2-this.center[0],i.worldY+i.heightMm/2-this.center[1]);return o-c});for(let n of s)if(this.loadPageVectors(n).catch(()=>{}),a-=1,!a)break}featurePrimitiveBounds(e,r){let a=this.vectorChunks.get(e.id);if(!a?.segments?.length&&!a?.fills?.length)return null;let s=[],n=[];for(let i of a.segments||[])i.featureId===r&&(s.push(i.a[0],i.b[0]),n.push(i.a[1],i.b[1]));for(let i of a.fills||[])if(i.featureId===r)for(let o of i.points||[])s.push(o[0]),n.push(o[1]);return s.length?[Math.min(...s),Math.min(...n),Math.max(...s),Math.max(...n)]:null}symbolClipBounds(e){if(this._symbolClipBounds||(this._symbolClipBounds=new Map),this._symbolClipBounds.has(e.id))return this._symbolClipBounds.get(e.id);let r=(this.featuresByPage[e.id]||[]).filter(a=>a?.kind==="symbol_body"&&a.boundsMm&&!String(a.sourceId||"").includes(":overplot")).map(a=>{let s=this.featurePrimitiveBounds(e,a.id)||a.boundsMm;return[s[0]-.02,s[1]-.02,s[2]+.02,s[3]+.02]}).filter(a=>{let s=a[2]-a[0],n=a[3]-a[1];return Math.max(s,n)<=12&&s*n<=80});return this._symbolClipBounds.set(e.id,r),r}visibleSegmentParts(e,r,a){if(r._visibleParts)return r._visibleParts;let s=String(a?.kind||""),n=String(a?.semanticRole||"");if(s!=="wire"&&n!=="wire")return r._visibleParts=[r],r._visibleParts;let i=[r];for(let o of this.symbolClipBounds(e)){let c=[];for(let l of i)c.push(...Fw(l,o));if(i=c,!i.length)break}for(let o of i)o.worldA=Or(e,o.a),o.worldB=Or(e,o.b);return r._visibleParts=i,r._visibleParts}netTrackingSegments(){if(!this.activeNetUid)return{netUid:"",anchorsByPage:new Map,segments:[],intrasheetSegments:[]};let e=Number(this.selectedFeatureId||0),r=String(this.selectedFeatureKey||""),a=String(this.selectedSourceId||"");if(this.netTrackingCache?.netUid===this.activeNetUid&&this.netTrackingCache?.selectedFeatureId===e&&this.netTrackingCache?.selectedFeatureKey===r&&this.netTrackingCache?.selectedSourceId===a)return this.netTrackingCache;this.selectedIntrasheetLinkIndex=-1;let s=new Map(this.pages.map(h=>[h.id,h])),n=this.manifest.netToPages?.[this.activeNetUid]||[],i=n.length?n.map(h=>s.get(h)).filter(Boolean):this.pages.filter(h=>h.netUids?.includes(this.activeNetUid)),o=new Map;for(let h of i.slice(0,uw)){let u=this.netTrackingAnchorsForPage(h);u.length&&o.set(h.id,u)}let c=[],l=[];for(let[h,u]of o){let m=Yu(Aw(u),"intrasheet",h);c.push(...m),l.push(...m)}let f=[...o.entries()].map(([h,u])=>_w(s.get(h),u,{featureId:e,stableKey:r,sourceId:a})).filter(Boolean);c.push(...Yu(f,"intersheet",""));let d=l.map((h,u)=>({...h,intrasheetIndex:u})),p=0,b=c.map((h,u)=>{if(h.type!=="intrasheet")return{...h,id:u};let m=p;return p+=1,{...h,id:u,intrasheetIndex:m}});return this.netTrackingCache={netUid:this.activeNetUid,selectedFeatureId:e,selectedFeatureKey:r,selectedSourceId:a,anchorsByPage:o,segments:b,intrasheetSegments:d},this.selectedIntrasheetLinkIndex>=this.netTrackingCache.intrasheetSegments.length&&(this.selectedIntrasheetLinkIndex=-1),this.netTrackingCache}netTrackingAnchorsForPage(e){let r=this.featuresByPage[e.id]||[],a=[];for(let s of r){if(s.netUid!==this.activeNetUid||!s.boundsMm||!Sw(s))continue;let n=s.boundsMm,i=[(n[0]+n[2])/2,(n[1]+n[3])/2],o=this.sourceToWorld(e,i);a.push({pageId:e.id,featureId:Number(s.id||0),stableKey:String(s.stableKey||""),sourceId:String(s.sourceId||s.sourceUid||s.objectId||""),kind:s.kind||s.semanticRole||"",source:i,world:o,bounds:n,priority:Tw(s)})}return a.sort((s,n)=>n.priority-s.priority||s.source[1]-n.source[1]||s.source[0]-n.source[0]),a}writeNetTrackingOverlay(){let e=this.netTrackingSegments();if(this.lastNetFlowSegments=e.segments.length,this.lastNetFlowIntrasheetSegments=e.intrasheetSegments.length,!e.segments.length)return this.lastNetFlowVertices=0,0;let r=this.worldViewportBounds(this.scale*96),a=this.netFlowScratch,s=0,n=0;for(let i of e.segments){if(!At(Ju(i),r))continue;let o=i.type==="intrasheet"&&i.intrasheetIndex===this.selectedIntrasheetLinkIndex,c=o?9.5:i.type==="intersheet"?8:4.8,l=o?2:i.type==="intersheet"?1:0,f=Bw(a,s,i.a,i.b,c*this.scale,l,n,this.scale);if(f!==s&&(s=f,n+=Math.hypot(i.b[0]-i.a[0],i.b[1]-i.a[1])/Math.max(this.scale,1e-6),s+24>a.length))break}return s?(this.device.queue.writeBuffer(this.netFlowBuffer,0,a,0,s),this.lastNetFlowVertices=s/4,s/4):(this.lastNetFlowVertices=0,0)}cycleNetIntrasheetLink(e=1){let r=this.netTrackingSegments();if(!r.intrasheetSegments.length)return null;let a=r.intrasheetSegments.length;this.selectedIntrasheetLinkIndex=(this.selectedIntrasheetLinkIndex+e+a)%a;let s=r.intrasheetSegments[this.selectedIntrasheetLinkIndex];if(!s)return null;let n=Ju(s,14*this.scale);return this.center=[(n[0]+n[2])/2,(n[1]+n[3])/2],this.scale=Math.max((n[2]-n[0])/Math.max(1,this.canvas.width*.36),(n[3]-n[1])/Math.max(1,this.canvas.height*.3),this.scale*.35,.025),{pageId:s.pageId,segment:s}}writeNetHighlights(e){if(!this.activeNetUid)return 0;let r=this.highlightScratch,a=0,s=0;for(let n of e){let i=this.sourceViewportBounds(n,5);for(let o of this.featuresByPage[n.id]||[]){if(o.netUid!==this.activeNetUid||!o.boundsMm||!At(o.boundsMm,i))continue;let c=this.featureWorldBounds(n,o.boundsMm);if(a+16>r.length){s+=1;continue}r[a++]=c[0],r[a++]=c[1],r[a++]=c[2],r[a++]=c[1],r[a++]=c[2],r[a++]=c[1],r[a++]=c[2],r[a++]=c[3],r[a++]=c[2],r[a++]=c[3],r[a++]=c[0],r[a++]=c[3],r[a++]=c[0],r[a++]=c[3],r[a++]=c[0],r[a++]=c[1]}}return this.truncatedHighlightCount=s,a?(this.device.queue.writeBuffer(this.highlightBuffer,0,r,0,a),a/2):0}featureWorldBounds(e,r){return[e.worldX+r[0]/e.sourceWidthMm*e.widthMm,e.worldY+r[1]/e.sourceHeightMm*e.heightMm,e.worldX+r[2]/e.sourceWidthMm*e.widthMm,e.worldY+r[3]/e.sourceHeightMm*e.heightMm]}sourceToWorld(e,r){return[e.worldX+r[0]/e.sourceWidthMm*e.widthMm,e.worldY+r[1]/e.sourceHeightMm*e.heightMm]}sourceSizeToWorld(e,r,a){return[r/e.sourceWidthMm*e.widthMm,a/e.sourceHeightMm*e.heightMm]}async loadPageVectors(e){if(!this.pageHasNativeDetail(e)||!e.chunks?.lod2)return null;let r=this.vectorChunks.get(e.id);if(r?.loaded)return r;if(r?.promise)return r.promise;let a=(async()=>{try{let s=await fetch(new URL(e.chunks.lod2,this.manifestUrl));if(!s.ok)throw new Error(`Failed to load schematic vector chunk ${e.id}: ${s.status}`);let n=await s.json(),i=gw(n.primitives||[]);mw(e,i);let c=JSON.stringify(n).length,l={loaded:!0,segments:i.segments,fills:i.fills,images:i.images,spatial:Ew(i),unsupported:n.unsupported||[],bytes:c,lastUsedFrame:this.frameSerial};return this.vectorChunks.set(e.id,l),this.failedVectorChunks.delete(e.id),this.residentVectorBytes+=c,l}catch(s){let n=this.failedVectorChunks.get(e.id)||{count:0,message:""};throw this.failedVectorChunks.set(e.id,{count:n.count+1,message:s?.message||String(s)}),this.vectorChunks.delete(e.id),s}})();return this.vectorChunks.set(e.id,{loaded:!1,promise:a,segments:[]}),a}evictVectorChunks(e){if(this.residentVectorBytes<=qu)return;let r=new Set(e.map(s=>s.id)),a=[...this.vectorChunks.entries()].filter(([,s])=>s?.loaded).filter(([s])=>!r.has(s)&&s!==this.selectedPageId).sort((s,n)=>(s[1].lastUsedFrame||0)-(n[1].lastUsedFrame||0));for(let[s,n]of a)if(this.vectorChunks.delete(s),this.residentVectorBytes=Math.max(0,this.residentVectorBytes-(n.bytes||0)),this.residentVectorBytes<=qu*.82)break}stats(){let e=this.visiblePages(),r=e.map(s=>this.pageSourcePixelsPerMm(s)),a=e.map(s=>this.pageNativeDetailThresholds(s).enter);return{residentVectorBytes:this.residentVectorBytes,vectorChunks:[...this.vectorChunks.values()].filter(s=>s?.loaded).length,vectorLoads:[...this.vectorChunks.values()].filter(s=>s?.promise&&!s.loaded).length,failedVectorChunks:this.failedVectorChunks.size,vectorVertices:this.lastVectorVertices||0,vectorDrawChunks:this.lastVectorChunks||0,truncatedVectors:this.truncatedVectorCount||0,nativeDetailPages:[...this.nativeDetailState.values()].filter(Boolean).length,nativePxPerMm:Number((Math.max(0,...r)||0).toFixed(2)),nativeThresholdPxPerMm:Number((a.length?Math.min(...a):0).toFixed(2)),domDetailPages:this.domDetailPageIds.size,netFlowSegments:this.lastNetFlowSegments||0,netFlowIntrasheetSegments:this.lastNetFlowIntrasheetSegments||0,netFlowVertices:this.lastNetFlowVertices||0}}setDomDetailPageIds(e){this.domDetailPageIds=new Set(e||[])}async loadPageTexture(e,r){let a=`${e.id}:${r}`;if(this.loading.has(a))return this.loading.get(a);let s=this.pageResources.get(e.id);if(!s||s.textureWidth>=r)return;let n=(async()=>{if(!s.svgBlob){let c=await fetch(new URL(bw(e),this.manifestUrl));if(!c.ok)throw new Error(`Failed to load schematic page ${e.name}: ${c.status}`);s.svgBlob=await c.blob(),this.downloadedBytes+=s.svgBlob.size}let i=s.svgBlob,o=URL.createObjectURL(i);try{let c=new Image;if(c.decoding="async",c.src=o,await c.decode(),s.textureWidth>=r)return;let l=Math.max(64,Math.round(r*e.heightMm/e.widthMm)),f=new OffscreenCanvas(r,l),d=f.getContext("2d",{alpha:!1});d.fillStyle="#ffffff",d.fillRect(0,0,r,l),d.drawImage(c,0,0,r,l);let p=await createImageBitmap(f),b=this.device.createTexture({size:[r,l],format:"rgba8unorm-srgb",usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST|GPUTextureUsage.RENDER_ATTACHMENT});this.device.queue.copyExternalImageToTexture({source:p},{texture:b},[r,l]),p.close(),s.texture!==this.placeholder&&s.texture.destroy(),s.texture=b,s.textureWidth=r,this.updateBindGroup(s)}finally{URL.revokeObjectURL(o),this.loading.delete(a)}})();return this.loading.set(a,n),n}preloadOverview(){let e=[...this.pages],r=async()=>{for(;e.length;){let a=e.shift();await this.loadPageTexture(a,512).catch(()=>{})}};return Promise.all(Array.from({length:Math.min(4,e.length)},r))}screenToWorld(e,r){let a=this.canvas.getBoundingClientRect(),s=(e-a.left)*this.canvas.width/a.width,n=(r-a.top)*this.canvas.height/a.height;return[this.center[0]+(s-this.canvas.width/2)*this.scale,this.center[1]+(n-this.canvas.height/2)*this.scale]}worldToScreen(e,r){let a=this.canvas.clientWidth/this.canvas.width,s=this.canvas.clientHeight/this.canvas.height;return[((e-this.center[0])/this.scale+this.canvas.width/2)*a,((r-this.center[1])/this.scale+this.canvas.height/2)*s]}hitPage(e,r){let[a,s]=this.screenToWorld(e,r);return[...this.pages].reverse().find(n=>a>=n.worldX&&a<=n.worldX+n.widthMm&&s>=n.worldY&&s<=n.worldY+n.heightMm)||null}async pickFeature(e,r){if(!this.isNativeScene)return this.hitFeature(e,r);let a=this.hitPage(e,r);if(!a)return null;if(!this.pageHasNativeDetail(a))return this.hitFeature(e,r);await this.loadPageVectors(a);let s=await this.gpuPickFeature(a,e,r);return s&&!wa(s)?{page:a,feature:s,source:this.clientToSource(a,e,r),native:!0,gpu:!0}:this.hitFeature(e,r)}hitFeature(e,r){let a=this.hitPage(e,r);if(!a)return null;let[s,n]=this.clientToSource(a,e,r),i=Math.max(.45,5*this.scale*this.canvas.width/Math.max(1,this.canvas.clientWidth)*a.sourceWidthMm/a.widthMm),o=this.hitResidentVectorFeature(a,s,n,i);if(o)return{page:a,feature:o,source:[s,n],native:!0};let c=this.hitSymbolInterior(a,s,n);if(c)return{page:a,feature:c,source:[s,n],native:!0,interior:!0};let l=(this.featuresByPage[a.id]||[]).filter(f=>{if(wa(f))return!1;let d=f.boundsMm;return d&&s>=d[0]-i&&s<=d[2]+i&&n>=d[1]-i&&n<=d[3]+i}).map(f=>({feature:f,priority:xa(f),area:Math.max(1e-4,(f.boundsMm[2]-f.boundsMm[0])*(f.boundsMm[3]-f.boundsMm[1]))})).sort((f,d)=>d.priority-f.priority||f.area-d.area);return{page:a,feature:l[0]?.feature||null,source:[s,n]}}hitSymbolInterior(e,r,a){let s=null;for(let n of this.featuresByPage[e.id]||[]){let i=String(n?.kind||"");if(i!=="symbol_body"&&i!=="symbol_instance"||String(n?.sourceId||"").includes(":overplot"))continue;let o=n.boundsMm;if(!o||r<o[0]||r>o[2]||a<o[1]||a>o[3])continue;let c=Math.max(1e-4,(o[2]-o[0])*(o[3]-o[1])),l=(i==="symbol_body"?0:1e6)+c;(!s||l<s.score)&&(s={feature:n,score:l})}return s?.feature||null}clientToSource(e,r,a){let[s,n]=this.screenToWorld(r,a);return[(s-e.worldX)/e.widthMm*e.sourceWidthMm,(n-e.worldY)/e.heightMm*e.sourceHeightMm]}ensurePickTexture(){this.pickTexture&&this.pickTextureSize[0]===this.canvas.width&&this.pickTextureSize[1]===this.canvas.height||(this.pickTexture&&this.pickTexture.destroy(),this.pickTexture=this.device.createTexture({size:[this.canvas.width,this.canvas.height],format:"r32uint",usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.COPY_SRC}),this.pickTextureSize=[this.canvas.width,this.canvas.height])}writePickVectors(e){let r=new ArrayBuffer(Ys*12),a=new DataView(r),s=0,n=[];for(let i of e){let o=this.vectorChunks.get(i.id);if(!o?.segments?.length&&!o?.fills?.length&&!o?.images?.length)continue;let c=this._pickSourcePointByPage?.get(i.id),l=c?[c[0]-2.5,c[1]-2.5,c[0]+2.5,c[1]+2.5]:[0,0,i.sourceWidthMm,i.sourceHeightMm],f=Xu(o.spatial,l);for(let d of f.images){if(!At(d.bounds,l))continue;let p=this.featuresById.get(d.featureId);!p||wa(p)||n.push({page:i,image:d,feature:p,priority:xa(p)-5})}for(let d of f.fills){if(!At(d.bounds,l))continue;let p=this.featuresById.get(d.featureId);!p||wa(p)||n.push({page:i,fill:d,feature:p,priority:xa(p)-2})}for(let d of f.segments){if(!At(d.bounds,l))continue;let p=this.featuresById.get(d.featureId);!p||wa(p)||n.push({page:i,segment:d,feature:p,priority:xa(p)})}}n.sort((i,o)=>i.priority-o.priority);for(let{page:i,segment:o,fill:c,image:l,feature:f}of n){if(s+6>Ys)break;if(l){let d=this.sourceToWorld(i,[l.xMm,l.yMm]),p=this.sourceToWorld(i,[l.xMm+l.widthMm,l.yMm]),b=this.sourceToWorld(i,[l.xMm,l.yMm+l.heightMm]),h=this.sourceToWorld(i,[l.xMm+l.widthMm,l.yMm+l.heightMm]);s=xo(a,s,d,p,b,l.featureId),s=xo(a,s,b,p,h,l.featureId)}else if(c){let d=c.worldPoints||c.points.map(p=>this.sourceToWorld(i,p));s=xo(a,s,d[0],d[1],d[2],c.featureId)}else{let d=Math.max(this.segmentWorldWidth(i,o,f,!1),this.scale*7);for(let p of this.visibleSegmentParts(i,o,f)){if(s+6>Ys)break;let b=p.worldA||this.sourceToWorld(i,p.a),h=p.worldB||this.sourceToWorld(i,p.b);s=Pw(a,s,b,h,d,o.featureId)}}}return s?(this.device.queue.writeBuffer(this.pickVertexBuffer,0,r,0,s*12),s):0}async gpuPickFeature(e,r,a){if(this.pickPending)return null;let s=this.clientToSource(e,r,a);this._pickSourcePointByPage=new Map([[e.id,s]]);let n=this.writePickVectors([e]);if(this._pickSourcePointByPage=null,!n)return null;this.resize(),this.writeGlobals(),this.ensurePickTexture();let i=this.canvas.getBoundingClientRect(),o=Math.max(0,Math.min(this.canvas.width-1,Math.floor((r-i.left)*this.canvas.width/i.width))),c=Math.max(0,Math.min(this.canvas.height-1,Math.floor((a-i.top)*this.canvas.height/i.height))),l=this.device.createCommandEncoder(),f=l.beginRenderPass({colorAttachments:[{view:this.pickTexture.createView(),clearValue:{r:0,g:0,b:0,a:0},loadOp:"clear",storeOp:"store"}]});f.setPipeline(this.pickPipeline),f.setBindGroup(0,this.edgeBindGroup),f.setVertexBuffer(0,this.pickVertexBuffer),f.draw(n),f.end(),l.copyTextureToBuffer({texture:this.pickTexture,origin:{x:o,y:c}},{buffer:this.pickReadBuffer,bytesPerRow:256,rowsPerImage:1},{width:1,height:1,depthOrArrayLayers:1}),this.pickPending=!0,this.device.queue.submit([l.finish()]);try{await this.pickReadBuffer.mapAsync(GPUMapMode.READ);let d=new DataView(this.pickReadBuffer.getMappedRange()).getUint32(0,!0);return this.pickReadBuffer.unmap(),d&&this.featuresById.get(d)||null}finally{this.pickReadBuffer.mapState==="mapped"&&this.pickReadBuffer.unmap(),this.pickPending=!1}}hitResidentVectorFeature(e,r,a,s){if(!this.isNativeScene)return null;let n=this.vectorChunks.get(e.id);if(!n?.loaded)return null;let i=null;for(let o of n.segments){let c=this.featuresById.get(o.featureId),l=Math.max(s,(o.widthMm||0)*.5+s*.45);if(c)for(let f of this.visibleSegmentParts(e,o,c)){let d=Ow([r,a],f.a,f.b);if(d>l)continue;let p=d-xa(c)*.025+(va(c)?0:8);(!i||p<i.score)&&(i={feature:c,score:p})}}return i?.feature||null}segmentWorldWidth(e,r,a,s){let n=(r.widthMm||.15)/Math.max(1,e.sourceWidthMm)*e.widthMm;return Math.max(n,this.scale*Rw(a,r.kind,s))}pan(e,r){let a=this.canvas.width/Math.max(1,this.canvas.clientWidth);this.center[0]-=e*this.scale*a,this.center[1]-=r*this.scale*a}zoom(e,r,a){let s=this.screenToWorld(r,a);this.scale=fe(this.scale*Math.exp(e*.0015),.015,16);let n=this.screenToWorld(r,a);this.center[0]+=s[0]-n[0],this.center[1]+=s[1]-n[1]}framePage(e){e&&(this.resize(),this.center=[e.worldX+e.widthMm/2,e.worldY+e.heightMm/2],this.scale=Math.max(e.widthMm/Math.max(1,this.canvas.width*.88),e.heightMm/Math.max(1,this.canvas.height*.84)))}frameWorld(){this.resize(),this.center=[(this.world.minX+this.world.maxX)/2,(this.world.minY+this.world.maxY)/2],this.scale=Math.max((this.world.maxX-this.world.minX)/Math.max(1,this.canvas.width*.9),(this.world.maxY-this.world.minY)/Math.max(1,this.canvas.height*.88),.05)}};function bw(t){return t.thumbnail?.path||t.svg}function pw(t){if(t.schema==="prism.schematic_vector_a0.features"){let e=new Map((t.features||[]).map(a=>[Number(a.id),a])),r={};for(let[a,s]of Object.entries(t.pages||{}))r[a]=s.map(n=>e.get(Number(n))).filter(Boolean);return r}return t.pages||{}}function gw(t){let e=[],r=[],a=[];for(let s of t){let n=Number(s.featureId||0);if(!n)continue;if(s.kind==="plotimage"&&s.image?.path){let y=s.xMm||0,x=s.yMm||0,v=s.widthMm||0,E=s.heightMm||0;a.push({featureId:n,kind:s.kind,xMm:y,yMm:x,widthMm:v,heightMm:E,bounds:[y,x,y+v,x+E],path:s.image.path});continue}let i=String(s.semanticRole||""),o=s.radiusMm||s.diameterMm/2||0,c=String(s.fill||"").toUpperCase()==="FILLED_SHAPE",l=s.widthMm||s.pen_widthMm||(i==="junction"?.08:.15),f=String(s.lineStyle||s.line_style||"DEFAULT").toUpperCase(),d=s.color||s.strokeColor||s.style?.color||"",p=s.fillColor||s.color||s.style?.color||"",b=(y,x)=>Mw(e,{featureId:n,kind:s.kind,widthMm:l,lineStyle:f,color:d},y,x),h=s.x1Mm,u=s.y1Mm,m=s.x2Mm,g=s.y2Mm;if(s.trianglesMm?.length){for(let y of s.trianglesMm)Array.isArray(y)&&y.length===3&&r.push({featureId:n,kind:s.kind,color:p,points:y,bounds:Zu(y)});if(s.pointsMm?.length>=2){for(let y=1;y<s.pointsMm.length;y+=1)b(s.pointsMm[y-1],s.pointsMm[y]);$u(s)&&b(s.pointsMm[s.pointsMm.length-1],s.pointsMm[0])}}else if(s.pointsMm?.length>=2){c&&s.pointsMm.length>=3&&vw(r,n,s.kind,s.pointsMm,p);for(let y=1;y<s.pointsMm.length;y+=1)b(s.pointsMm[y-1],s.pointsMm[y]);$u(s)&&b(s.pointsMm[s.pointsMm.length-1],s.pointsMm[0])}else if(s.polylinesMm?.length){for(let y of s.polylinesMm)if(!(!Array.isArray(y)||y.length<2))for(let x=1;x<y.length;x+=1)b(y[x-1],y[x])}else if(Number.isFinite(h)&&Number.isFinite(u)&&Number.isFinite(m)&&Number.isFinite(g))s.kind==="rect"?(c&&xw(r,n,s.kind,[h,u,m,g],p),b([h,u],[m,u]),b([m,u],[m,g]),b([m,g],[h,g]),b([h,g],[h,u])):b([h,u],[m,g]);else if(Number.isFinite(s.cxMm)&&Number.isFinite(s.cyMm)){let y=s.radiusMm||s.diameterMm/2||.4;c&&ww(r,n,s.kind,[s.cxMm,s.cyMm],y,p),kw(e,{featureId:n,kind:s.kind,widthMm:l,lineStyle:f,color:d},[s.cxMm,s.cyMm],y)}else if(s.contoursMm?.length){for(let y of s.contoursMm)if(!(!Array.isArray(y)||y.length<2)){for(let x=1;x<y.length;x+=1)b(y[x-1],y[x]);b(y[y.length-1],y[0])}}else if(Number.isFinite(s.start_xMm)&&Number.isFinite(s.start_yMm)&&Number.isFinite(s.end_xMm)&&Number.isFinite(s.end_yMm))Number.isFinite(s.mid_xMm)&&Number.isFinite(s.mid_yMm)?(b([s.start_xMm,s.start_yMm],[s.mid_xMm,s.mid_yMm]),b([s.mid_xMm,s.mid_yMm],[s.end_xMm,s.end_yMm])):b([s.start_xMm,s.start_yMm],[s.end_xMm,s.end_yMm]);else if(Number.isFinite(s.start_xMm)&&Number.isFinite(s.start_yMm)&&Number.isFinite(s.mid_xMm)&&Number.isFinite(s.mid_yMm)&&Number.isFinite(s.end_xMm)&&Number.isFinite(s.end_yMm))b([s.start_xMm,s.start_yMm],[s.mid_xMm,s.mid_yMm]),b([s.mid_xMm,s.mid_yMm],[s.end_xMm,s.end_yMm]);else if(s.boundsMm&&s.kind!=="text"){let[y,x,v,E]=s.boundsMm;b([y,x],[v,x]),b([v,x],[v,E]),b([v,E],[y,E]),b([y,E],[y,x])}}return{segments:e,fills:r,images:a}}function mw(t,e){for(let r of e.segments||[])r.worldA=Or(t,r.a),r.worldB=Or(t,r.b);for(let r of e.fills||[])r.worldPoints=r.points.map(a=>Or(t,a));for(let r of e.images||[])r.worldOrigin=Or(t,[r.xMm,r.yMm]),r.worldSize=yw(t,r.widthMm,r.heightMm)}function Or(t,e){return[t.worldX+e[0]/t.sourceWidthMm*t.widthMm,t.worldY+e[1]/t.sourceHeightMm*t.heightMm]}function yw(t,e,r){return[e/t.sourceWidthMm*t.widthMm,r/t.sourceHeightMm*t.heightMm]}function xw(t,e,r,a,s){let[n,i,o,c]=a;t.push({featureId:e,kind:r,color:s,points:[[n,i],[o,i],[n,c]],bounds:[n,i,o,c]},{featureId:e,kind:r,color:s,points:[[n,c],[o,i],[o,c]],bounds:[n,i,o,c]})}function ww(t,e,r,a,s,n){for(let o=0;o<36;o+=1){let c=o/36*Math.PI*2,l=(o+1)/36*Math.PI*2;t.push({featureId:e,kind:r,color:n,points:[a,[a[0]+Math.cos(c)*s,a[1]+Math.sin(c)*s],[a[0]+Math.cos(l)*s,a[1]+Math.sin(l)*s]],bounds:[a[0]-s,a[1]-s,a[0]+s,a[1]+s]})}}function vw(t,e,r,a,s){let n=a[0],i=Zu(a);for(let o=2;o<a.length;o+=1)t.push({featureId:e,kind:r,color:s,points:[n,a[o-1],a[o]],bounds:i})}function Mw(t,e,r,a){let s=Wu(r,a,e.widthMm||.15),n=e.lineStyle||"DEFAULT";if(!["DASH","DASHED","DOT","DOTTED","DASHDOT","DASH_DOT"].includes(n)){t.push({...e,a:r,b:a,bounds:s});return}let i=a[0]-r[0],o=a[1]-r[1],c=Math.hypot(i,o);if(c<1e-6)return;let l=i/c,f=o/c,d=Math.max(e.widthMm*4,.45),p=n.includes("DOT")?[d*.8,d*.75,d*3,d*.75]:[d*3,d*1.5],b=0,h=0;for(;b<c;){let u=Math.min(p[h%p.length],c-b);if(h%2===0){let m=[r[0]+l*b,r[1]+f*b],g=[r[0]+l*(b+u),r[1]+f*(b+u)];t.push({...e,a:m,b:g,bounds:Wu(m,g,e.widthMm||.15)})}b+=u,h+=1}}function kw(t,e,r,a){for(let n=0;n<32;n+=1){let i=n/32*Math.PI*2,o=(n+1)/32*Math.PI*2;t.push({...e,a:[r[0]+Math.cos(i)*a,r[1]+Math.sin(i)*a],b:[r[0]+Math.cos(o)*a,r[1]+Math.sin(o)*a],bounds:[r[0]-a,r[1]-a,r[0]+a,r[1]+a]})}}function Zu(t,e=0){let r=1/0,a=1/0,s=-1/0,n=-1/0;for(let i of t||[])r=Math.min(r,i[0]),a=Math.min(a,i[1]),s=Math.max(s,i[0]),n=Math.max(n,i[1]);return Number.isFinite(r)?[r-e,a-e,s+e,n+e]:[0,0,0,0]}function Wu(t,e,r=0){let a=Math.max(.05,r*.5);return[Math.min(t[0],e[0])-a,Math.min(t[1],e[1])-a,Math.max(t[0],e[0])+a,Math.max(t[1],e[1])+a]}function At(t,e){return!t||!e?!0:t[0]<=e[2]&&t[2]>=e[0]&&t[1]<=e[3]&&t[3]>=e[1]}function Ew(t){let e={cellSize:fw,cells:new Map,segments:t.segments||[],fills:t.fills||[],images:t.images||[],queryId:0};for(let r of e.segments)mo(e,"segments",r);for(let r of e.fills)mo(e,"fills",r);for(let r of e.images)mo(e,"images",r);return e}function mo(t,e,r){let a=r.bounds;if(!a)return;let s=Math.floor(a[0]/t.cellSize),n=Math.floor(a[2]/t.cellSize),i=Math.floor(a[1]/t.cellSize),o=Math.floor(a[3]/t.cellSize);for(let c=i;c<=o;c+=1)for(let l=s;l<=n;l+=1){let f=`${l}:${c}`,d=t.cells.get(f);d||(d={segments:[],fills:[],images:[]},t.cells.set(f,d)),d[e].push(r)}}function Xu(t,e){if(!t)return{segments:[],fills:[],images:[]};t.queryId=(t.queryId||0)+1;let r=t.queryId,a={segments:[],fills:[],images:[]},s=Math.floor(e[0]/t.cellSize),n=Math.floor(e[2]/t.cellSize),i=Math.floor(e[1]/t.cellSize),o=Math.floor(e[3]/t.cellSize);for(let c=i;c<=o;c+=1)for(let l=s;l<=n;l+=1){let f=t.cells.get(`${l}:${c}`);f&&(yo(f.segments,a.segments,r,"segments"),yo(f.fills,a.fills,r,"fills"),yo(f.images,a.images,r,"images"))}return a}function yo(t,e,r,a){let s=`_${a}QueryId`;for(let n of t)n[s]!==r&&(n[s]=r,e.push(n))}function $u(t){let e=String(t.kind||"");if(String(t.fill||"").toUpperCase()==="FILLED_SHAPE"||t.closed===!0||["polygon","fill"].includes(e))return!0;let a=t.pointsMm||[];if(a.length>=3){let s=a[0],n=a[a.length-1];return Math.hypot(s[0]-n[0],s[1]-n[1])<1e-6}return!1}function va(t){return!!t?.netUid}function Sw(t){let e=String(t?.kind||""),r=String(t?.semanticRole||"");return e==="pin"||e==="pin_body"||e==="label"||e==="global_label"||e==="hierarchical_label"||e==="netclass_flag"||e==="power_symbol"||e==="power_port"||r==="label"||r==="global_label"||r==="hierarchical_label"}function Tw(t){let e=String(t?.kind||""),r=String(t?.semanticRole||"");return e==="global_label"||r==="global_label"?130:e==="hierarchical_label"||r==="hierarchical_label"?125:e==="label"||r==="label"?118:e==="pin"||e==="pin_body"?106:e==="power_symbol"||e==="power_port"||e==="netclass_flag"?98:50}function Aw(t){if(t.length<=Hu)return t;let e=t.slice(0,Hu);return e.sort((r,a)=>r.source[1]-a.source[1]||r.source[0]-a.source[0]),e}function _w(t,e,r={}){if(!t||!e?.length)return null;let a=r.featureId||r.stableKey||r.sourceId?e.find(l=>r.featureId&&Number(l.featureId||0)===Number(r.featureId)||r.stableKey&&l.stableKey===r.stableKey||r.sourceId&&l.sourceId===r.sourceId):null;if(a)return{...a,kind:"selected-net-occurrence",priority:200};let s=e.filter(l=>l.priority>=118).slice(0,16),n=s.length?s:e.slice(0,16),i=0,o=0;for(let l of n)i+=l.world[0],o+=l.world[1];let c=[i/n.length,o/n.length];return{pageId:t.id,featureId:n[0]?.featureId||0,kind:"page-net-occurrence",source:[0,0],world:c,bounds:[c[0],c[1],c[0],c[1]],priority:1}}function Yu(t,e,r){if(!t||t.length<2)return[];let a=t.map(i=>({...i})).sort((i,o)=>i.world[1]-o.world[1]||i.world[0]-o.world[0]),s=[],n=a.shift();for(;a.length;){let i=0,o=1/0;for(let l=0;l<a.length;l+=1){let f=a[l],d=Math.hypot(f.world[0]-n.world[0],f.world[1]-n.world[1]);d<o&&(o=d,i=l)}let c=a.splice(i,1)[0];s.push({type:e,pageId:r||n.pageId||c.pageId||"",a:n.world,b:c.world,sourceFeatureIds:[n.featureId,c.featureId].filter(Boolean)}),n=c}return s}function Ju(t,e=0){return[Math.min(t.a[0],t.b[0])-e,Math.min(t.a[1],t.b[1])-e,Math.max(t.a[0],t.b[0])+e,Math.max(t.a[1],t.b[1])+e]}function xa(t){let e=String(t?.kind||""),a=String(t?.semanticRole||"")||e;return a==="pin_number"||a==="pin_name"?120:a==="pin_body"||e==="pin"?110:a==="symbol_reference"||a==="symbol_value"?92:e==="junction"||e==="no_connect"?88:e==="wire"||e==="bus"||e==="bus_entry"?78:a==="symbol_body"||e==="symbol_body"?45:e==="symbol_instance"||e==="symbol_overplot"?30:e==="text"||String(a).includes("text")?24:10}function wa(t){let e=String(t?.kind||""),r=String(t?.semanticRole||"");if(e==="page"||e==="sheet_header")return!0;if(e==="graphic_rect"&&r==="graphic_rect"&&!t?.netUid&&!t?.componentUid){let a=t.boundsMm||[];return a[2]-a[0]>150&&a[3]-a[1]>120}return!1}function Iw(t){if(!t||typeof t!="string")return null;let r=t.trim().match(/^#([0-9a-f]{6})([0-9a-f]{2})?$/i);if(!r)return null;let a=r[1],s=r[2]??"ff";return[parseInt(a.slice(0,2),16)/255,parseInt(a.slice(2,4),16)/255,parseInt(a.slice(4,6),16)/255,parseInt(s,16)/255]}function wo(t,e,r=""){let a=Iw(r||t?.color||"");return t?.kind==="dnp_marker"?a||[.86,.04,.05,.85]:t?.dnp&&["symbol_reference","symbol_value","symbol_text"].includes(String(t?.kind||""))?[.5,.52,.54,.56]:a||(t?.dnp?[.5,.52,.54,.56]:va(t)?[.12,.56,.2,.96]:t?.kind==="pin_name"?[0,.28,.31,.96]:t?.kind==="pin_number"?[.45,.17,.16,.96]:t?.kind==="pin_body"?[.28,.18,.18,.88]:t?.kind==="symbol_body"||t?.kind==="symbol_instance"?[.42,.18,.18,.72]:t?.kind==="symbol_reference"||t?.kind==="symbol_value"?[.05,.13,.16,.94]:t?.kind==="text"||String(e||"").startsWith("text")?[.05,.13,.16,.94]:[.16,.17,.19,.7])}function Qu(t,e,r=""){let a=wo(t,e,r);return[a[0]*.72,a[1]*.72,a[2]*.72,Math.min(a[3],.38)]}function Rw(t,e,r){return r?5.5:t?.kind==="dnp_marker"?3:["pin_name","pin_number"].includes(String(t?.kind||""))?1.5:t?.kind==="pin_body"?1.7:String(e||"").startsWith("text")?1.35:e==="bus"||t?.kind==="bus"?4.2:va(t)?2.6:t?.kind==="symbol_body"||t?.kind==="symbol_instance"||t?.kind==="sheet"?1.5:1.25}function Qs(t,e,r,a){return t[e++]=r[0],t[e++]=r[1],t[e++]=a[0],t[e++]=a[1],t[e++]=a[2],t[e++]=a[3],e}function Nw(t,e,r,a,s,n){let i=ef(r,a,s);if(!i)return e;for(let o of i)e=Qs(t,e,o,n);return e}function Cw(t,e,r,a,s,n){return e=Qs(t,e,r,n),e=Qs(t,e,a,n),e=Qs(t,e,s,n),e}function Br(t,e,r,a,s){return t[e++]=r[0],t[e++]=r[1],t[e++]=a,t[e++]=s,e}function Bw(t,e,r,a,s,n,i,o){let c=a[0]-r[0],l=a[1]-r[1],f=Math.hypot(c,l);if(f<1e-6||e+24>t.length)return e;let d=s*.5,p=c/f,h=-(l/f)*d,u=p*d,m=[r[0]+h,r[1]+u],g=[r[0]-h,r[1]-u],y=[a[0]+h,a[1]+u],x=[a[0]-h,a[1]-u],v=i+f/Math.max(o,1e-6);return e=Br(t,e,m,i,n),e=Br(t,e,g,i,n),e=Br(t,e,y,v,n),e=Br(t,e,y,v,n),e=Br(t,e,g,i,n),e=Br(t,e,x,v,n),e}function ef(t,e,r){let a=e[0]-t[0],s=e[1]-t[1],n=Math.hypot(a,s);if(n<1e-6)return null;let i=r*.5,o=a/n*i,c=s/n*i,l=-s/n*i,f=a/n*i,d=[t[0]-o,t[1]-c],p=[e[0]+o,e[1]+c],b=[d[0]+l,d[1]+f],h=[d[0]-l,d[1]-f],u=[p[0]+l,p[1]+f],m=[p[0]-l,p[1]-f];return[b,h,u,u,h,m]}function Ow(t,e,r){let a=r[0]-e[0],s=r[1]-e[1],n=a*a+s*s||1,i=fe(((t[0]-e[0])*a+(t[1]-e[1])*s)/n,0,1),o=e[0]+a*i,c=e[1]+s*i;return Math.hypot(t[0]-o,t[1]-c)}function Fw(t,e){let[r,a,s,n]=e,[i,o]=t.a,[c,l]=t.b,f=1e-6,d=(p,b)=>({...t,a:p,b});if(Math.abs(o-l)<=f){let p=o;if(p<a-f||p>n+f)return[t];let b=Math.min(i,c),h=Math.max(i,c),u=Math.max(b,r),m=Math.min(h,s);if(m<=u+f)return[t];let g=[],y=i<=c;if(b<u-f){let x=y?[b,p]:[u,p],v=y?[u,p]:[b,p];g.push(d(x,v))}if(m<h-f){let x=y?[m,p]:[h,p],v=y?[h,p]:[m,p];g.push(d(x,v))}return g}if(Math.abs(i-c)<=f){let p=i;if(p<r-f||p>s+f)return[t];let b=Math.min(o,l),h=Math.max(o,l),u=Math.max(b,a),m=Math.min(h,n);if(m<=u+f)return[t];let g=[],y=o<=l;if(b<u-f){let x=y?[p,b]:[p,u],v=y?[p,u]:[p,b];g.push(d(x,v))}if(m<h-f){let x=y?[p,m]:[p,h],v=y?[p,h]:[p,m];g.push(d(x,v))}return g}return[t]}function Zs(t,e,r,a){let s=e*12;t.setFloat32(s,r[0],!0),t.setFloat32(s+4,r[1],!0),t.setUint32(s+8,a,!0)}function Pw(t,e,r,a,s,n){let i=ef(r,a,s);if(!i)return e;for(let o of i)Zs(t,e,o,n),e+=1;return e}function xo(t,e,r,a,s,n){return Zs(t,e,r,n),Zs(t,e+1,a,n),Zs(t,e+2,s,n),e+3}function jw(t,e){let r=Array.isArray(t?.layerIds)?t.layerIds:[];if(r.length<2&&t?.startLayerId!=null&&t?.endLayerId!=null&&(r=[t.startLayerId,t.endLayerId]),r.length<2&&t?.layerMask!=null)try{let a=BigInt(String(t.layerMask));r=e.filter((s,n)=>(a&1n<<BigInt(n))!==0n).map(s=>s.id)}catch{r=[]}return r}function Lw(t){let e=t?.objectFeatureId??t?.id;if(e!=null&&Number.isFinite(Number(e))&&Number(e)!==0)return`feature:${Number(e)}`;let r=String(t?.sourceUid||"");return r?`source:${r}`:""}function tf(t,e){let r=new Map(t.map((o,c)=>[Number(o.id),c])),a=new Map(t.map(o=>[Number(o.id),o])),s=new Map,n=new Set,i={thru:0,blind:0,buried:0};for(let o of e){let c=Lw(o);if(c){if(n.has(c))continue;n.add(c)}let l=[...new Set(jw(o,t).map(Number))].filter(x=>r.has(x)).sort((x,v)=>r.get(x)-r.get(v));if(l.length<2)continue;let f=l[0],d=l[l.length-1],p=r.get(f),b=r.get(d),h=p===0,u=b===t.length-1,m=h&&u?"thru":h||u?"blind":"buried";i[m]+=1;let g=`${f}:${d}:${m}`,y=s.get(g);if(y){y.count+=1;continue}s.set(g,{startId:f,endId:d,startName:a.get(f)?.name||String(f),endName:a.get(d)?.name||String(d),startIndex:p,endIndex:b,type:m,count:1})}return{counts:i,spans:[...s.values()]}}var Ma="http://www.w3.org/2000/svg";var Dw=new Set(["script","foreignobject","iframe","object","embed"]),Uw=new Set(["href","xlink:href"]),zw=1,Gw=18,Kw=8,an=class t{static create(e,r,a,s,n={}){return new t(e,r,a,s,n)}constructor(e,r,a,s,n){this.host=e,this.manifestUrl=r,this.manifest=a,this.featuresByPage=s||{},this.callbacks=n,this.activePage=null,this.activeSvgUrl="",this.container=null,this.svg=null,this.overlay=null,this.mountedPages=new Map,this.loadingPages=new Map,this.svgCache=new Map,this.serial=0,this.maxMountedWorldPages=zw,this.maxCachedSvgPages=Gw,this.worldHandlersInstalled=!1,this.worldDrag=null,this.view={scale:1,tx:0,ty:0},this.drag=null,this.selected=null,this.highlightedNetUid="",this.index=nf(),this.lastStats={mountedPages:0,domNodes:0,indexedFeatures:0,indexedNets:0,mountMs:0,coldMounts:0,warmMounts:0,highlightMs:0,selectionMs:0,cachedSvgPages:0,cachedSvgBytes:0,heapMb:null,fallbackReason:""}}get active(){return!!(this.container&&this.activePage)}get worldActive(){return this.mountedPages.size>0}stats(){return{...this.lastStats,activePage:this.activePage?.name||[...this.mountedPages.values()][0]?.page?.name||"-",mountedPages:this.active?1:this.mountedPages.size}}dispose(){this.unmountPage(),this.unmountWorldPages()}unmountPage(){this.container?.remove(),this.container=null,this.svg=null,this.overlay=null,this.activePage=null,this.activeSvgUrl="",this.index=nf(),this.host.hidden=!0}unmountWorldPages(){for(let e of this.mountedPages.values())e.container.remove();this.mountedPages.clear(),this.loadingPages.clear(),this.active||(this.host.hidden=!0)}async preloadPages(e){let r=performance.now(),a=await Promise.allSettled((e||[]).slice(0,Kw).map(s=>this.loadSvgTemplate(s)));this.lastStats.preloadedPages=a.filter(s=>s.status==="fulfilled"&&s.value).length,this.lastStats.preloadMs=performance.now()-r,this.updateCacheStats()}syncWorldPages(e,r,a={}){if(!r)return;this.installWorldHandlers(r);let s=(e||[]).slice(0,a.maxMountedPages||this.maxMountedWorldPages),n=new Set(s.map(i=>i.id));for(let[i,o]of this.mountedPages)n.has(i)||(o.container.remove(),this.mountedPages.delete(i));for(let i of s){let o=this.mountedPages.get(i.id);if(o)o.lastUsed=++this.serial,this.positionWorldEntry(o,r);else if(!this.loadingPages.has(i.id)){let c=this.mountWorldPage(i).then(l=>{l&&n.has(i.id)?this.positionWorldEntry(l,r):l?.container.remove()}).finally(()=>this.loadingPages.delete(i.id));this.loadingPages.set(i.id,c)}}this.pruneMountedWorldPages(n),this.host.hidden=s.length===0&&!this.active,this.setSelection(this.selected),this.setHighlightedNet(a.activeNetUid??this.highlightedNetUid),this.lastStats.mountedPages=this.mountedPages.size,this.updateCacheStats()}async mountWorldPage(e){let r=performance.now(),a=this.hasCachedSvg(e),s=await this.loadImportedSvg(e);if(!s)return null;let n=document.createElement("div");n.className="svg-dom-page svg-dom-world-page",n.dataset.pageId=e.id,n.append(s),this.host.append(n);let i=af(s),o=sf(s),c=rf(s,e,this.featuresByPage[e.id]||[]),l={page:e,container:n,svg:s,overlay:i,selectionOverlay:o,index:c,mountMs:performance.now()-r,lastUsed:++this.serial,warm:a};return this.mountedPages.set(e.id,l),this.lastStats={...this.lastStats,mountedPages:this.mountedPages.size,domNodes:[...this.mountedPages.values()].reduce((f,d)=>f+d.svg.querySelectorAll("*").length,0),indexedFeatures:[...this.mountedPages.values()].reduce((f,d)=>f+d.index.featureToElements.size,0),indexedNets:new Set([...this.mountedPages.values()].flatMap(f=>[...f.index.netToElements.keys()])).size,mountMs:l.mountMs,coldMounts:this.lastStats.coldMounts+(l.warm?0:1),warmMounts:this.lastStats.warmMounts+(l.warm?1:0),fallbackReason:""},this.updateCacheStats(),l}async loadImportedSvg(e){let r=await this.loadSvgTemplate(e);return r?r.cloneNode(!0):null}async loadSvgTemplate(e){let r=this.svgUrlForPage(e),a=this.svgCache.get(r);if(a?.template)return a.lastUsed=++this.serial,a.template;if(a?.promise)return a.promise;let s=performance.now(),n=(async()=>{let i=await fetch(r,{cache:"default"});if(!i.ok)return this.lastStats.fallbackReason=`Failed to load SVG page ${e.id}: ${i.status}`,this.callbacks.onFallback?.(this.lastStats.fallbackReason),null;let o=await i.text(),l=new DOMParser().parseFromString(o,"image/svg+xml"),f=l.documentElement;if(!f||f.localName.toLowerCase()!=="svg"||l.querySelector("parsererror"))return this.lastStats.fallbackReason=`Invalid SVG for page ${e.id}`,this.callbacks.onFallback?.(this.lastStats.fallbackReason),null;Vw(l,r,e.id);let d=document.importNode(f,!0);d.classList.add("svg-dom-page-svg"),Yw(d);let p=this.svgCache.get(r)||{};return Object.assign(p,{template:d,promise:null,pageId:e.id,byteLength:o.length*2,loadMs:performance.now()-s,lastUsed:++this.serial}),this.svgCache.set(r,p),this.pruneSvgCache(),this.updateCacheStats(),d})();return this.svgCache.set(r,{promise:n,pageId:e.id,byteLength:0,loadMs:0,lastUsed:++this.serial}),n}svgUrlForPage(e){return new URL(e.svg||e.thumbnail?.path,this.manifestUrl).toString()}positionWorldEntry(e,r){let{page:a,container:s}=e,[n,i]=r.worldToScreen(a.worldX,a.worldY),[o,c]=r.worldToScreen(a.worldX+a.widthMm,a.worldY+a.heightMm),l=Math.max(1,o-n),f=Math.max(1,c-i);s.style.transform=`translate3d(${n}px, ${i}px, 0)`,s.style.width=`${l}px`,s.style.height=`${f}px`}installWorldHandlers(e){if(this.worldHandlersInstalled)return;this.worldHandlersInstalled=!0;let r=this.host;r.oncontextmenu=a=>a.preventDefault(),r.onpointerdown=a=>{let s=a.button===0&&!a.shiftKey&&!!a.target.closest?.("text"),i=a.target.closest?.("[data-feature-key]")?null:this.featureAtEvent(a);this.worldDrag={pointerId:a.pointerId,startX:a.clientX,startY:a.clientY,lastX:a.clientX,lastY:a.clientY,button:a.button,moved:!1,pan:!s&&(a.button===0||a.button===1||a.shiftKey),allowTextSelection:s},s||r.setPointerCapture(a.pointerId)},r.onpointermove=a=>{if(!this.worldDrag||this.worldDrag.pointerId!==a.pointerId)return;let s=a.clientX-this.worldDrag.lastX,n=a.clientY-this.worldDrag.lastY;this.worldDrag.lastX=a.clientX,this.worldDrag.lastY=a.clientY,Math.hypot(a.clientX-this.worldDrag.startX,a.clientY-this.worldDrag.startY)>3&&(this.worldDrag.moved=!0),this.worldDrag.pan&&e.pan(s,n)},r.onpointerup=a=>{if(!this.worldDrag||this.worldDrag.pointerId!==a.pointerId)return;let s=this.worldDrag;if(this.worldDrag=null,s.allowTextSelection||r.releasePointerCapture(a.pointerId),s.button!==0||s.moved)return;let n=a.target.closest?.("[data-feature-key]");if(n)this.selectElement(n,a);else{let i=this.featureAtEvent(a);i?this.selectFeature(i.entry,i.feature,a):this.callbacks.onBlank?.()}},r.ondblclick=a=>{let s=a.target.closest?.("[data-feature-key]"),n=s?null:this.featureAtEvent(a),i=n?.entry||this.entryForPoint(a.clientX,a.clientY),o=s?this.selectionFromElement(s):n?this.selectionFromFeature(n.entry,n.feature):this.selected;of(o)?this.callbacks.onOpenPage?.(o):o?.netUid?this.callbacks.onHighlightNet?.(o.netUid,o):!n&&i?.page&&this.callbacks.onOpenPage?.({kind:"page",pageId:i.page.id,page:i.page})},r.onwheel=a=>{a.preventDefault(),Math.abs(a.deltaX)>Math.abs(a.deltaY)*.65?e.pan(-a.deltaX,-a.deltaY):e.zoom(a.deltaY,a.clientX,a.clientY)}}async focusPage(e,r={}){if(!e)return!1;if(this.activePage?.id===e.id&&this.active)return r.frame!==!1&&this.fitPage(),!0;let a=performance.now(),s=await this.loadImportedSvg(e);if(!s)return!1;let n=document.createElement("div");return n.className="svg-dom-page",n.append(s),this.host.replaceChildren(n),this.host.hidden=!1,this.container=n,this.svg=s,this.activePage=e,this.activeSvgUrl=new URL(e.svg||e.thumbnail?.path,this.manifestUrl).toString(),this.overlay=af(s),this.selectionOverlay=sf(s),this.index=rf(s,e,this.featuresByPage[e.id]||[]),this.installPageHandlers(),this.fitPage(),this.setSelection(this.selected),this.setHighlightedNet(this.highlightedNetUid),this.lastStats={...this.lastStats,mountedPages:1,domNodes:s.querySelectorAll("*").length,indexedFeatures:this.index.featureToElements.size,indexedNets:this.index.netToElements.size,mountMs:performance.now()-a,fallbackReason:""},this.updateCacheStats(),!0}installPageHandlers(){let e=this.host;e.oncontextmenu=r=>r.preventDefault(),e.onpointerdown=r=>{if(!this.active)return;let a=r.button===0&&!r.shiftKey&&!!r.target.closest?.("text"),s=r.target.closest?.("[data-feature-key]"),n=s?null:this.featureAtEvent(r);this.drag={pointerId:r.pointerId,startX:r.clientX,startY:r.clientY,lastX:r.clientX,lastY:r.clientY,button:r.button,moved:!1,pan:!a&&(r.button===0||r.button===1||r.shiftKey),featureElement:s,allowTextSelection:a},a||e.setPointerCapture(r.pointerId)},e.onpointermove=r=>{if(!this.drag||this.drag.pointerId!==r.pointerId)return;let a=r.clientX-this.drag.lastX,s=r.clientY-this.drag.lastY;this.drag.lastX=r.clientX,this.drag.lastY=r.clientY,Math.hypot(r.clientX-this.drag.startX,r.clientY-this.drag.startY)>3&&(this.drag.moved=!0),this.drag.pan&&(this.view.tx+=a,this.view.ty+=s,this.applyTransform())},e.onpointerup=r=>{if(!this.drag||this.drag.pointerId!==r.pointerId)return;let a=this.drag;if(this.drag=null,a.allowTextSelection||e.releasePointerCapture(r.pointerId),a.button!==0||a.moved)return;let s=r.target.closest?.("[data-feature-key]");if(s)this.selectElement(s,r);else{let n=this.featureAtEvent(r);n?this.selectFeature(n.entry,n.feature,r):this.callbacks.onBlank?.()}},e.ondblclick=r=>{let a=r.target.closest?.("[data-feature-key]"),s=a?null:this.featureAtEvent(r),n=a?this.selectionFromElement(a):s?this.selectionFromFeature(s.entry,s.feature):this.selected;of(n)?this.callbacks.onOpenPage?.(n):n?.netUid?this.callbacks.onHighlightNet?.(n.netUid,n):!s&&this.activePage&&this.callbacks.onOpenPage?.({kind:"page",pageId:this.activePage.id,page:this.activePage})},e.onwheel=r=>{if(r.preventDefault(),!this.active)return;if(Math.abs(r.deltaX)>Math.abs(r.deltaY)*.65){this.view.tx-=r.deltaX,this.view.ty-=r.deltaY,this.applyTransform();return}let a=this.host.getBoundingClientRect(),s=r.clientX-a.left,n=r.clientY-a.top,i=this.screenToSvg(s,n),o=Math.exp(-r.deltaY*.0016);this.view.scale=tn(this.view.scale*o,.02,80),this.view.tx=s-i[0]*this.view.scale,this.view.ty=n-i[1]*this.view.scale,this.applyTransform()}}selectElement(e,r){let a=performance.now(),s=this.selectionFromElement(e);if(this.setSelection(s),r){let n=this.host.getBoundingClientRect();s.anchor={x:r.clientX-n.left,y:r.clientY-n.top}}this.callbacks.onSelect?.(s),this.lastStats.selectionMs=performance.now()-a}selectFeature(e,r,a){let s=performance.now(),n=this.selectionFromFeature(e,r);if(this.setSelection(n),a){let i=this.host.getBoundingClientRect();n.anchor={x:a.clientX-i.left,y:a.clientY-i.top}}this.callbacks.onSelect?.(n),this.lastStats.selectionMs=performance.now()-s}selectionFromElement(e){let r=e.dataset.featureKey||"",a=this.entryForElement(e),s=a.index.featureByKey.get(r)||{};return this.selectionFromFeature(a,s,e)}selectionFromFeature(e,r,a=null){let s=r?.stableKey||a?.dataset?.featureKey||"",n=e?.page||this.activePage,i=r?.kind||a?.dataset?.role||a?.dataset?.primitive||"feature",o=r?.netUid||a?.dataset?.netUid||"",c=r?.netName||a?.dataset?.netName||"";return i==="sheet"?{kind:"sheet",featureKey:s,sheetInstancePath:r?.sheetInstancePath||n?.sheetInstancePath||"",sourceId:r?.sourceId||a?.dataset?.sourceId||a?.dataset?.objectId||a?.dataset?.uuid||"",sheetName:r?.sheet_name||r?.sheetName||a?.dataset?.sheetName||r?.objectId||"",sheetFile:r?.sheet_file||r?.sheetFile||a?.dataset?.sheetFile||"",feature:r}:i==="pin"||i==="pin_body"||i==="pin_name"||i==="pin_number"||a?.dataset?.pin?{kind:"pin",featureKey:s,sheetInstancePath:r?.sheetInstancePath||n?.sheetInstancePath||"",sourceId:r?.sourceId||a?.dataset?.sourceId||a?.dataset?.objectId||a?.dataset?.uuid||"",symbolUuid:r?.symbolUuid||a?.dataset?.symbolUuid||"",reference:r?.reference||a?.dataset?.designator||a?.dataset?.component||a?.dataset?.ref||"",pinNumber:r?.pinNumber||a?.dataset?.pin||"",pinName:r?.pinName||"",netUid:o,netName:c,feature:r}:i==="symbol_body"||i==="symbol_instance"||i==="component"||a?.dataset?.ref?{kind:"component",featureKey:s,sheetInstancePath:r?.sheetInstancePath||n?.sheetInstancePath||"",sourceId:r?.sourceId||a?.dataset?.sourceId||a?.dataset?.objectId||a?.dataset?.uuid||"",symbolUuid:r?.symbolUuid||a?.dataset?.symbolUuid||"",reference:r?.reference||a?.dataset?.designator||a?.dataset?.component||a?.dataset?.ref||"",netUid:o,netName:c,feature:r}:{kind:o?"feature":i,featureKey:s,sheetInstancePath:r?.sheetInstancePath||n?.sheetInstancePath||"",sourceId:r?.sourceId||a?.dataset?.sourceId||a?.dataset?.objectId||a?.dataset?.uuid||"",role:i,netUid:o,netName:c,feature:r}}setSelection(e){this.selected=e||null;for(let a of this.host.querySelectorAll(".prism-svg-selected"))a.classList.remove("prism-svg-selected");for(let a of this.host.querySelectorAll("[data-prism-overlay='selection']"))a.replaceChildren();let r=e?.featureKey||"";if(r){for(let a of this.entries()){for(let s of a.index.featureToElements.get(r)||[])s.classList.add("prism-svg-selected");this.drawSelectionOverlay(a,e)}for(let a of this.index.featureToElements.get(r)||[])a.classList.add("prism-svg-selected");this.drawSelectionOverlay({page:this.activePage,index:this.index,selectionOverlay:this.selectionOverlay},e)}}setHighlightedNet(e){this.highlightedNetUid=e||"";let r=performance.now();for(let a of this.entries())this.updateEntryHighlight(a);if(!this.svg||!this.overlay){this.lastStats.highlightMs=performance.now()-r;return}this.updateEntryHighlight({svg:this.svg,overlay:this.overlay,index:this.index,page:this.activePage}),this.lastStats.highlightMs=performance.now()-r}updateEntryHighlight(e){if(!e?.svg||!e?.overlay||(e.overlay.replaceChildren(),!this.highlightedNetUid))return;let r=rn(e.svg,e.page),a=document.createElementNS(Ma,"rect");a.setAttribute("x",String(r[0])),a.setAttribute("y",String(r[1])),a.setAttribute("width",String(r[2])),a.setAttribute("height",String(r[3])),a.setAttribute("class","prism-svg-net-dimmer"),e.overlay.append(a);let n=(e.index.netToElements.get(this.highlightedNetUid)||[]).slice(0,2200);for(let i of n){let o=Jw(i);e.overlay.append(o)}}entries(){return[...this.mountedPages.values()]}entryForElement(e){let a=e.closest?.(".svg-dom-page")?.dataset.pageId||"";return this.mountedPages.get(a)||{page:this.activePage,index:this.index,svg:this.svg,overlay:this.overlay,selectionOverlay:this.selectionOverlay}}featureAtEvent(e){let r=this.entryForPoint(e.clientX,e.clientY);if(!r)return null;let a=this.clientToSvg(r,e.clientX,e.clientY);if(!a)return null;let s=Math.max(.18,5*Zw(r)),i=r.index.features.filter(o=>(o?.domBoundsMm||o?.boundsMm)&&df(o)).filter(o=>a[0]>=(o.domBoundsMm||o.boundsMm)[0]-s&&a[0]<=(o.domBoundsMm||o.boundsMm)[2]+s&&a[1]>=(o.domBoundsMm||o.boundsMm)[1]-s&&a[1]<=(o.domBoundsMm||o.boundsMm)[3]+s).map(o=>({feature:o,priority:tv(o),area:Math.max(1e-4,((o.domBoundsMm||o.boundsMm)[2]-(o.domBoundsMm||o.boundsMm)[0])*((o.domBoundsMm||o.boundsMm)[3]-(o.domBoundsMm||o.boundsMm)[1]))})).sort((o,c)=>c.priority-o.priority||o.area-c.area)[0]?.feature;return i?{entry:r,feature:i,point:a}:null}entryForPoint(e,r){for(let a of[...this.entries()].reverse()){let s=a.container.getBoundingClientRect();if(e>=s.left&&e<=s.right&&r>=s.top&&r<=s.bottom)return a}if(this.container){let a=this.container.getBoundingClientRect();if(e>=a.left&&e<=a.right&&r>=a.top&&r<=a.bottom)return{page:this.activePage,container:this.container,svg:this.svg,index:this.index,selectionOverlay:this.selectionOverlay}}return null}clientToSvg(e,r,a){if(!e?.container||!e?.svg||!e?.page)return null;let s=e.container.getBoundingClientRect();if(!s.width||!s.height)return null;let n=rn(e.svg,e.page);return[n[0]+(r-s.left)/s.width*n[2],n[1]+(a-s.top)/s.height*n[3]]}drawSelectionOverlay(e,r){if(!e?.selectionOverlay||!r?.featureKey)return;let a=e.index.featureByKey.get(r.featureKey),s=a?.domBoundsMm||a?.boundsMm;if(!s)return;let[n,i,o,c]=s,l=document.createElementNS(Ma,"rect");l.setAttribute("x",String(n)),l.setAttribute("y",String(i)),l.setAttribute("width",String(Math.max(.001,o-n))),l.setAttribute("height",String(Math.max(.001,c-i))),l.setAttribute("rx","0.65"),l.setAttribute("ry","0.65"),l.setAttribute("class","prism-svg-selection-box"),e.selectionOverlay.append(l)}fitPage(){if(!this.svg||!this.activePage)return;let e=rn(this.svg,this.activePage),r=e[2]||this.activePage.sourceWidthMm||this.activePage.widthMm||1,a=e[3]||this.activePage.sourceHeightMm||this.activePage.heightMm||1,s=this.host.getBoundingClientRect(),n=Math.min(s.width/r,s.height/a)*.92;this.view.scale=tn(n,.02,80),this.view.tx=(s.width-r*this.view.scale)/2-e[0]*this.view.scale,this.view.ty=(s.height-a*this.view.scale)/2-e[1]*this.view.scale,this.applyTransform()}frameSelection(e=this.selected){if(!e?.featureKey||!this.active){this.fitPage();return}let r=this.index.featureToElements.get(e.featureKey)||[],a=lf(r);if(!a)return;let s=this.host.getBoundingClientRect(),n=Math.max(1,a[2]-a[0]),i=Math.max(1,a[3]-a[1]),o=Math.min(s.width/n,s.height/i)*.36;this.view.scale=tn(o,.04,80),this.view.tx=s.width/2-(a[0]+a[2])/2*this.view.scale,this.view.ty=s.height/2-(a[1]+a[3])/2*this.view.scale,this.applyTransform()}pan(e,r){this.active&&(this.view.tx+=e,this.view.ty+=r,this.applyTransform())}zoom(e,r,a){if(!this.active)return;let s=this.host.getBoundingClientRect(),n=(r??s.left+s.width/2)-s.left,i=(a??s.top+s.height/2)-s.top,o=this.screenToSvg(n,i),c=Math.exp(-e*.0016);this.view.scale=tn(this.view.scale*c,.02,80),this.view.tx=n-o[0]*this.view.scale,this.view.ty=i-o[1]*this.view.scale,this.applyTransform()}screenToSvg(e,r){return[(e-this.view.tx)/Math.max(1e-6,this.view.scale),(r-this.view.ty)/Math.max(1e-6,this.view.scale)]}applyTransform(){this.container&&(this.container.style.transform=`translate3d(${this.view.tx}px, ${this.view.ty}px, 0) scale(${this.view.scale})`)}hasCachedSvg(e){return!!this.svgCache.get(this.svgUrlForPage(e))?.template}pruneMountedWorldPages(e=new Set){if(this.mountedPages.size<=this.maxMountedWorldPages)return;let r=[...this.mountedPages.entries()].filter(([a])=>!e.has(a)).sort((a,s)=>(a[1].lastUsed||0)-(s[1].lastUsed||0));for(let[a,s]of r){if(this.mountedPages.size<=this.maxMountedWorldPages)break;s.container.remove(),this.mountedPages.delete(a)}}pruneSvgCache(){let e=[...this.svgCache.entries()].filter(([,s])=>s?.template);if(e.length<=this.maxCachedSvgPages)return;let r=new Set([...this.mountedPages.values()].map(s=>this.svgUrlForPage(s.page)));this.activePage&&r.add(this.svgUrlForPage(this.activePage));let a=e.filter(([s])=>!r.has(s)).sort((s,n)=>(s[1].lastUsed||0)-(n[1].lastUsed||0));for(let[s]of a){if([...this.svgCache.values()].filter(n=>n?.template).length<=this.maxCachedSvgPages)break;this.svgCache.delete(s)}}updateCacheStats(){let e=[...this.svgCache.values()].filter(a=>a?.template);this.lastStats.cachedSvgPages=e.length,this.lastStats.cachedSvgBytes=e.reduce((a,s)=>a+(s.byteLength||0),0);let r=performance?.memory;this.lastStats.heapMb=r?.usedJSHeapSize?r.usedJSHeapSize/1048576:null}};function Vw(t,e,r){for(let n of[...t.querySelectorAll("*")]){if(Dw.has(n.localName.toLowerCase())){n.remove();continue}for(let i of[...n.attributes]){let o=i.name,c=o.toLowerCase(),l=i.value||"";if(c.startsWith("on")){n.removeAttribute(o);continue}if((c==="href"||c==="xlink:href"||c==="src")&&uf(l)){if((c==="href"||c==="xlink:href")&&n.localName.toLowerCase()==="image"&&av(l))continue;n.removeAttribute(o);continue}c==="style"&&n.setAttribute(o,nv(l))}}let a=`prism-${vo(r)}-`,s=new Map;for(let n of t.querySelectorAll("[id]")){let i=n.getAttribute("id"),o=`${a}${vo(i)}`;s.set(i,o),n.setAttribute("id",o)}for(let n of t.querySelectorAll("*"))for(let i of[...n.attributes]){let o=i.name.toLowerCase(),c=i.value||"";Uw.has(o)&&(c.startsWith("#")&&s.has(c.slice(1))?c=`#${s.get(c.slice(1))}`:sv(c)&&(c=new URL(c,e).toString())),c=iv(c,s),n.setAttribute(i.name,c)}}function rf(t,e,r){let a=new Map,s=new Map,n=new Map,i=[];for(let f of r){let d=Ww(f,e);i.push(d),s.set(d.stableKey,d),n.set(Number(d.id||0),d);for(let p of Xw(d))a.has(p)||a.set(p,[]),a.get(p).push(d)}let o=new Map,c=new Map,l=new Map;for(let f of i)l.set(f.stableKey,f);for(let f of t.querySelectorAll("[data-uuid], [data-element-key], [data-primitive], [data-ref], [data-pin], [data-object-id], [data-designator], [data-component]")){let d=Hw(f,a,e);if(d&&!df(d)||!d&&!rv(f))continue;let p=$w(f,e),b=d?.stableKey||p,h=d?.netUid||"",u=d?.netName||"";f.classList.add("prism-feature"),f.dataset.featureKey=b,f.dataset.sourceId=d?.sourceId||f.dataset.uuid||f.dataset.elementKey||"",f.dataset.role=d?.kind||f.dataset.primitive||f.dataset.ref||"feature",d?.id&&(f.dataset.featureId=String(d.id)),h&&(f.dataset.netUid=h),u&&(f.dataset.netName=u),f.id||(f.id=`prism-feature-${vo(b)}`),cf(o,b,f),l.set(b,d||{id:0,stableKey:b,kind:f.dataset.role,sourceId:f.dataset.sourceId,sheetInstancePath:e.sheetInstancePath||""}),h&&cf(c,h,f)}for(let[f,d]of o){let p=l.get(f),b=lf(d);p&&b&&(p.domBoundsMm=Qw(p.boundsMm,b))}return{featureToElements:o,netToElements:c,featureByKey:l,byId:n,bySource:a,features:i}}function Hw(t,e,r){let s=[t.dataset.uuid,t.dataset.elementKey,t.dataset.sourceId,t.dataset.objectId,t.dataset.componentUid,t.dataset.componentUuid,t.dataset.ref&&`${t.dataset.ref}:${t.dataset.pin||""}`].filter(Boolean).flatMap(i=>e.get(i)||[]);if(!s.length)return null;let n=String(t.dataset.primitive||t.dataset.ref||t.dataset.pin||"").toLowerCase();return s.map(i=>({feature:i,score:qw(i,n,r)})).sort((i,o)=>o.score-i.score)[0].feature}function qw(t,e,r){let a=0,s=String(t.kind||"").toLowerCase();return t.sheetInstancePath===r.sheetInstancePath&&(a+=20),t.netUid&&(a+=4),e&&s.includes(e)&&(a+=8),e==="symbol"&&s==="symbol_body"&&(a+=12),(e==="label"||e==="port")&&(s.includes("label")||s.includes("port"))&&(a+=12),e==="sheet"&&s==="sheet"&&(a+=12),s!=="record"&&(a+=2),s.includes("pin")&&(a+=2),a}function Ww(t,e){let r=t.sourceId||t.sourceUid||t.uuid||t.objectId||t.stableKey||"";return{...t,id:Number(t.id||0),sourceId:r,stableKey:t.stableKey||`${e.sheetInstancePath||e.id}|${r}|0|${t.kind||"feature"}|0`,sheetInstancePath:t.sheetInstancePath||e.sheetInstancePath||""}}function Xw(t){let e=new Set([t.sourceId,t.sourceUid,t.uuid,t.objectId,t.stableKey].filter(Boolean).map(String));return t.reference&&t.pinNumber&&e.add(`${t.reference}:${t.pinNumber}`),t.componentDesignator&&e.add(t.componentDesignator),t.reference&&e.add(t.reference),[...e]}function $w(t,e){let r=t.dataset.uuid||t.dataset.elementKey||t.dataset.objectId||t.dataset.ref||t.id||"svg",a=t.dataset.primitive||t.dataset.role||t.localName||"feature";return`${e.sheetInstancePath||e.id}|${r}|0|${a}|0`}function Yw(t){let e=document.createElementNS(Ma,"style");e.textContent=`
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
  `,t.prepend(e)}function af(t){let e=document.createElementNS(Ma,"g");return e.setAttribute("class","prism-svg-net-overlay"),e.setAttribute("data-prism-overlay","net-highlight"),t.append(e),e}function sf(t){let e=document.createElementNS(Ma,"g");return e.setAttribute("class","prism-svg-selection-overlay"),e.setAttribute("data-prism-overlay","selection"),e.style.pointerEvents="none",t.append(e),e}function Jw(t){let e=t.cloneNode(!0);e.removeAttribute("id"),e.removeAttribute("data-feature-key"),e.removeAttribute("data-net-uid"),e.removeAttribute("data-net-name"),e.classList.add("prism-svg-net-overlay-clone");for(let r of[e,...Array.from(e.querySelectorAll?.("*")||[])])r instanceof SVGElement&&(r.removeAttribute("filter"),r.style.pointerEvents="none",r.style.stroke="#18ef52",r.style.fill="none",r.style.opacity="0.98",r.style.vectorEffect="non-scaling-stroke");return e}function lf(t){let e=null;for(let r of t)if(r.getBBox)try{let a=r.getBBox(),s=[a.x,a.y,a.x+a.width,a.y+a.height];e=e?[Math.min(e[0],s[0]),Math.min(e[1],s[1]),Math.max(e[2],s[2]),Math.max(e[3],s[3])]:s}catch{}return e}function Qw(t,e){return t?e?[Math.min(t[0],e[0]),Math.min(t[1],e[1]),Math.max(t[2],e[2]),Math.max(t[3],e[3])]:t:e}function rn(t,e){let r=t.getAttribute("viewBox");if(r){let a=r.trim().split(/[\s,]+/).map(Number);if(a.length===4&&a.every(Number.isFinite))return a}return[0,0,e.sourceWidthMm||e.widthMm||1,e.sourceHeightMm||e.heightMm||1]}function nf(){return{featureToElements:new Map,netToElements:new Map,featureByKey:new Map,byId:new Map,bySource:new Map,features:[]}}function Zw(t){let e=t?.container?.getBoundingClientRect?.();if(!t?.svg||!t?.page||!e?.width||!e?.height)return .1;let r=rn(t.svg,t.page);return Math.max(r[2]/e.width,r[3]/e.height)}function ev(t){let e=String(t?.kind||"").toLowerCase(),r=String(t?.semanticRole||"").toLowerCase(),a=`${t?.sourceId||""} ${t?.objectId||""} ${t?.text||""}`.toLowerCase();return e.includes("page")||r.includes("page")||e.includes("background")||r.includes("background")||a.includes("background")||a.includes("sheet_header")||a.includes("sheet header")||a.includes("drawing-sheet")}function tv(t){let e=String(t?.kind||t?.semanticRole||"").toLowerCase();return e.includes("pin")?90:e.includes("label")||e.includes("port")?78:e.includes("wire")||e.includes("bus")||e.includes("junction")?70:e.includes("symbol")||e.includes("component")?54:e.includes("image")?30:20}function df(t){if(!t||ev(t))return!1;let e=String(t.kind||t.semanticRole||"").toLowerCase();return["pin","label","port","wire","bus","junction","no_connect","symbol","component","sheet","image","text"].some(r=>e.includes(r))}function rv(t){let e=`${t?.dataset?.primitive||""} ${t?.dataset?.ref||""} ${t?.dataset?.role||""} ${t?.dataset?.objectId||""} ${t?.dataset?.text||""}`.toLowerCase();return!e||e.includes("background")||e.includes("sheet_header")||e.includes("sheet header")||e.includes("drawing-sheet")?!1:["pin","label","port","wire","bus","junction","no_connect","symbol","component","sheet","image","text"].some(r=>e.includes(r))}function of(t){return String(t?.kind||t?.feature?.kind||"").toLowerCase()==="sheet"}function cf(t,e,r){t.has(e)||t.set(e,[]),t.get(e).push(r)}function uf(t){let e=String(t||"").trim().toLowerCase();return!e||e.startsWith("#")?!1:e.startsWith("javascript:")||e.startsWith("data:")||e.startsWith("http://")||e.startsWith("https://")}function av(t){return/^data:image\/(?:png|jpe?g|gif|webp);base64,[a-z0-9+/=\s]+$/i.test(String(t||"").trim())}function sv(t){let e=String(t||"").trim();return e&&!e.startsWith("#")&&!/^[a-z][a-z0-9+.-]*:/i.test(e)}function nv(t){return String(t||"").replace(/url\(([^)]+)\)/gi,(e,r)=>{let a=r.trim().replace(/^['"]|['"]$/g,"");return uf(a)?"none":e})}function iv(t,e){let r=String(t||"");return r=r.replace(/url\(#([^)]+)\)/g,(a,s)=>e.has(s)?`url(#${e.get(s)})`:a),r=r.replace(/^#(.+)$/,(a,s)=>e.has(s)?`#${e.get(s)}`:a),r}function vo(t){return String(t||"").trim().replace(/[^a-zA-Z0-9_-]+/g,"-").replace(/^-+|-+$/g,"").slice(0,96)||"item"}function tn(t,e,r){return Math.max(e,Math.min(r,t))}function _t(t){return`${t.level||""}/${t.id}`}function ff(t){let e=t.ends||[],r=t.wires||[];return e.length<2?[]:e.length===2?[{key:`${e[0].id}~${e[1].id}`,a:e[0].id,b:e[1].id,wires:new Set(r.map(a=>a.id))}]:e.map(a=>({key:`hub~${a.id}`,a:"hub",b:a.id,wires:new Set(r.filter(s=>s.from===a.id||s.to===a.id).map(s=>s.id))}))}function ov(t,e){return!e||e.harness!==t.id?!1:!t.level||!e.occurrence||e.occurrence.startsWith(`${t.level}/`)}function hf(t,e){let r=new Map;for(let a of t||[]){let s=new Map,n=new Set((a.wires||[]).map(i=>i.id));for(let i of e||[])for(let o of i.wires||[])n.has(o.wire)&&ov(a,o)&&!s.has(o.wire)&&s.set(o.wire,i.color);s.size&&r.set(_t(a),s)}return r}function bf(t,e){if(!e)return null;for(let r of t.wires)if(e.has(r))return e.get(r);return null}function pf(t,e){let r=new Map;if(!e)return r;for(let a of t.wires||[]){let s=e.get(a.id);s&&(r.has(a.from)||r.set(a.from,s),r.has(a.to)||r.set(a.to,s))}return r}function gf(t){let e=t.filter(Boolean);return e.length<2?null:[0,1,2].map(r=>e.reduce((a,s)=>a+s[r],0)/e.length)}var sr="auto",cv=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];function Fr(t,e){return t.level?e(t.level):cv}function Mo(t,e){return[0,1,2].map(r=>t[r]*e[0]+t[4+r]*e[1]+t[8+r]*e[2]+t[12+r])}function ka(t,e){let r=[e[0]-t[12],e[1]-t[13],e[2]-t[14]];return[0,1,2].map(a=>t[a*4]*r[0]+t[a*4+1]*r[1]+t[a*4+2]*r[2])}function ko(t,e,r){return e?t.map(a=>{if(r(a)!==e.harness)return a;let s=a.nodes??[];if(e.insert)return{...a,nodes:[...s,e.insert]};let n=e.id===sr?[{id:sr,kind:"breakout",positionMm:e.positionMm,pinned:!1,order:-1,ends:[],between:null},...s]:s.map(i=>i.id===e.id?{...i,positionMm:e.positionMm,pinned:i.kind==="waypoint"?!0:i.pinned}:i);return{...a,nodes:n}}):t}var mf="__bend__";function yf(t,{kind:e,segment:r,atMm:a,positionMm:s,toWorldMm:n}){if(e==="breakout"){let m=t.filter(g=>g.kind==="breakout").reduce((g,y)=>Math.max(g,y.order??0),-1);return{id:mf,kind:"breakout",positionMm:s,pinned:!1,order:m+1,ends:[],between:null}}let i=r.samplesMm.flat(),o=m=>{let g=0,y=1/0;for(let x=0;x+2<i.length;x+=3){let v=Math.hypot(i[x]-m[0],i[x+1]-m[1],i[x+2]-m[2]);v<y&&([g,y]=[x/3,v])}return g},c=m=>[...m].sort().join("|"),l=t.filter(m=>m.kind==="waypoint"&&m.between&&c(m.between)===c([r.from,r.to])).sort((m,g)=>(m.order??0)-(g.order??0)),f=l[0]?.between??[r.from,r.to],d=f[0]===r.from?1:-1,p=m=>d*o(m),b=p(a),h=l.filter(m=>p(n(m.positionMm))<b).length,u=l.length?h===0?(l[0].order??0)-1:h===l.length?(l[l.length-1].order??0)+1:((l[h-1].order??0)+(l[h].order??0))/2:0;return{id:mf,kind:"waypoint",positionMm:s,pinned:!0,order:u,ends:[],between:[...f]}}function xf(t,e,r){let a=(t.nodes??[]).map(n=>({id:n.id,kind:n.kind,pinned:!!n.pinned,worldMm:Mo(r,n.positionMm)})),s=e.find(n=>n.to===sr);return s&&a.push({id:sr,kind:"breakout",pinned:!1,auto:!0,worldMm:s.samplesMm.slice(-3)}),a}function lv(t,e,r){let a=e[0]-t[0],s=e[1]-t[1],n=a*a+s*s,i=n>0?Math.max(0,Math.min(1,((r[0]-t[0])*a+(r[1]-t[1])*s)/n)):0;return{t:i,distance:Math.hypot(t[0]+i*a-r[0],t[1]+i*s-r[1])}}function wf(t,e,r,a,s=5){let n=null;return t.forEach((i,o)=>{let c=i.samplesMm,l=Math.floor(c.length/3),f=l?r([c[0],c[1],c[2]]):null;for(let d=0;d+1<l;d+=1){let p=[c[d*3+3],c[d*3+4],c[d*3+5]],b=r(p);if(f&&b){let{t:h,distance:u}=lv(f,b,e),m=[0,1,2].map(y=>c[d*3+y]+h*(p[y]-c[d*3+y])),g=s+i.radiusMm*a(m);u<=g&&(!n||u<n.distancePx)&&(n={index:o,sample:d,t:h,pointMm:m,distancePx:u})}f=b}}),n}function vf(t,e,r,a,{right:s,up:n}){if(!(a>0))return[...t];let i=e/a,o=-r/a;return t.map((c,l)=>c+s[l]*i+n[l]*o)}function Mf(t,e,r=3){return Math.hypot(e[0]-t[0],e[1]-t[1])>=r}function Sf(t,e,r,a){let{right:s,up:n,back:i}=t.basis(),o=Math.tan(t.fov/2),c=Oe(t.focus,Me(i,t.distance)),l=Qe(Oe(Oe(Me(i,-1),Me(s,e*o*a)),Me(n,r*o)));return{origin:c,direction:l}}function Tf(t,e,r){let a=Af(Array.from(t,Number));if(!a)return null;let s=l=>{let f=[0,1,2,3].map(d=>a[d]*e+a[4+d]*r+a[8+d]*l+a[12+d]);return f.slice(0,3).map(d=>d/f[3])},n=s(1),o=s(0).map((l,f)=>l-n[f]),c=Math.hypot(...o);return c>0?{origin:n,direction:o.map(l=>l/c)}:null}function Af(t){let e=new Array(16);e[0]=t[5]*t[10]*t[15]-t[5]*t[11]*t[14]-t[9]*t[6]*t[15]+t[9]*t[7]*t[14]+t[13]*t[6]*t[11]-t[13]*t[7]*t[10],e[4]=-t[4]*t[10]*t[15]+t[4]*t[11]*t[14]+t[8]*t[6]*t[15]-t[8]*t[7]*t[14]-t[12]*t[6]*t[11]+t[12]*t[7]*t[10],e[8]=t[4]*t[9]*t[15]-t[4]*t[11]*t[13]-t[8]*t[5]*t[15]+t[8]*t[7]*t[13]+t[12]*t[5]*t[11]-t[12]*t[7]*t[9],e[12]=-t[4]*t[9]*t[14]+t[4]*t[10]*t[13]+t[8]*t[5]*t[14]-t[8]*t[6]*t[13]-t[12]*t[5]*t[10]+t[12]*t[6]*t[9],e[1]=-t[1]*t[10]*t[15]+t[1]*t[11]*t[14]+t[9]*t[2]*t[15]-t[9]*t[3]*t[14]-t[13]*t[2]*t[11]+t[13]*t[3]*t[10],e[5]=t[0]*t[10]*t[15]-t[0]*t[11]*t[14]-t[8]*t[2]*t[15]+t[8]*t[3]*t[14]+t[12]*t[2]*t[11]-t[12]*t[3]*t[10],e[9]=-t[0]*t[9]*t[15]+t[0]*t[11]*t[13]+t[8]*t[1]*t[15]-t[8]*t[3]*t[13]-t[12]*t[1]*t[11]+t[12]*t[3]*t[9],e[13]=t[0]*t[9]*t[14]-t[0]*t[10]*t[13]-t[8]*t[1]*t[14]+t[8]*t[2]*t[13]+t[12]*t[1]*t[10]-t[12]*t[2]*t[9],e[2]=t[1]*t[6]*t[15]-t[1]*t[7]*t[14]-t[5]*t[2]*t[15]+t[5]*t[3]*t[14]+t[13]*t[2]*t[7]-t[13]*t[3]*t[6],e[6]=-t[0]*t[6]*t[15]+t[0]*t[7]*t[14]+t[4]*t[2]*t[15]-t[4]*t[3]*t[14]-t[12]*t[2]*t[7]+t[12]*t[3]*t[6],e[10]=t[0]*t[5]*t[15]-t[0]*t[7]*t[13]-t[4]*t[1]*t[15]+t[4]*t[3]*t[13]+t[12]*t[1]*t[7]-t[12]*t[3]*t[5],e[14]=-t[0]*t[5]*t[14]+t[0]*t[6]*t[13]+t[4]*t[1]*t[14]-t[4]*t[2]*t[13]-t[12]*t[1]*t[6]+t[12]*t[2]*t[5],e[3]=-t[1]*t[6]*t[11]+t[1]*t[7]*t[10]+t[5]*t[2]*t[11]-t[5]*t[3]*t[10]-t[9]*t[2]*t[7]+t[9]*t[3]*t[6],e[7]=t[0]*t[6]*t[11]-t[0]*t[7]*t[10]-t[4]*t[2]*t[11]+t[4]*t[3]*t[10]+t[8]*t[2]*t[7]-t[8]*t[3]*t[6],e[11]=-t[0]*t[5]*t[11]+t[0]*t[7]*t[9]+t[4]*t[1]*t[11]-t[4]*t[3]*t[9]-t[8]*t[1]*t[7]+t[8]*t[3]*t[5],e[15]=t[0]*t[5]*t[10]-t[0]*t[6]*t[9]-t[4]*t[1]*t[10]+t[4]*t[2]*t[9]+t[8]*t[1]*t[6]-t[8]*t[2]*t[5];let r=t[0]*e[0]+t[1]*e[4]+t[2]*e[8]+t[3]*e[12];return Math.abs(r)<1e-30?null:e.map(a=>a/r)}function kf(t,e){return[0,1,2].map(r=>t[r]*e[0]+t[4+r]*e[1]+t[8+r]*e[2]+t[12+r])}function Ef(t,e){return[0,1,2].map(r=>t[r]*e[0]+t[4+r]*e[1]+t[8+r]*e[2])}function dv(t,e,r){let a=-1/0,s=1/0;for(let n=0;n<3;n+=1){if(Math.abs(e[n])<1e-15){if(t[n]<r[n]||t[n]>r[n+3])return!1;continue}let i=(r[n]-t[n])/e[n],o=(r[n+3]-t[n])/e[n];a=Math.max(a,Math.min(i,o)),s=Math.min(s,Math.max(i,o))}return s>=Math.max(a,0)}function uv(t,e,r){let a=null;for(let s of t){if(s.bounds&&!dv(e,r,s.bounds))continue;let n=s.position,i=s.indices,o=i?i.length:n.length/3;for(let c=0;c+2<o;c+=3){let l=(i?i[c]:c)*3,f=(i?i[c+1]:c+1)*3,d=(i?i[c+2]:c+2)*3,p=[n[f]-n[l],n[f+1]-n[l+1],n[f+2]-n[l+2]],b=[n[d]-n[l],n[d+1]-n[l+1],n[d+2]-n[l+2]],h=Ze(r,b),u=ot(p,h);if(Math.abs(u)<1e-18)continue;let m=[e[0]-n[l],e[1]-n[l+1],e[2]-n[l+2]],g=ot(m,h)/u;if(g<0||g>1)continue;let y=Ze(m,p),x=ot(r,y)/u;if(x<0||g+x>1)continue;let v=ot(b,y)/u;v>1e-12&&(!a||v<a.t)&&(a={t:v,normal:Ze(p,b)})}}return a}function _f(t,e){let r=null;for(let a of t){let s=Af(a.matrix);if(!s)continue;let n=kf(s,e.origin),i=Ef(s,e.direction),o=uv(a.primitives,n,i);if(!o)continue;let c=kf(a.matrix,Oe(n,Me(i,o.t))),l=Math.hypot(...c.map((p,b)=>p-e.origin[b]));if(r&&l>=r.distance)continue;let f=[s[0],s[4],s[8],0,s[1],s[5],s[9],0,s[2],s[6],s[10],0,0,0,0,1],d=Qe(Ef(f,o.normal));ot(d,e.direction)>0&&(d=Me(d,-1)),r={key:a.key,point:c,normal:d,distance:l}}return r?{key:r.key,point:r.point,normal:r.normal}:null}var je={bootMm:10,housingDepthMm:8,breakoutLiftMm:10,chordErrorMm:.2,catmullRomAlpha:.5,minBendRadiusFactor:6,bendRelaxIterations:8,packingFactor:1.2,ringSegments:12,breakoutBlendMm:5,lengthAllowance:.1,lengthMismatchTolerance:.15,boardCollisionMarginMm:1,defaultGaugeAwg:"24"},Eo={24:1.143,22:1.3208,20:1.524,18:1.8034,16:2.0066,14:2.3622,12:2.8956,10:3.5306,8:5.0546,6:6.35,4:7.9248,2:9.8552,1:10.9474,0:12.1666,"00":13.8684};function If(t){let e=t==null?null:String(t).trim().toUpperCase().replace(/AWG$/,"").trim();return e!==null&&e in Eo?{odMm:Eo[e],assumed:!1}:{odMm:Eo[je.defaultGaugeAwg],assumed:!0}}var sn=(Math.sqrt(5)-1)/2,fv=60;function hv(t,e,r){let a=0;for(let s=0;s<3;s+=1){let n=t[s]<e[s]?e[s]-t[s]:t[s]>r[s]?t[s]-r[s]:0;a+=n*n}return a}function bv(t,e,r,a){let s=b=>hv([0,1,2].map(h=>t[h]+b*(e[h]-t[h])),r,a),n=0,i=1,o=i-sn*(i-n),c=n+sn*(i-n),l=s(o),f=s(c);for(let b=0;b<fv;b+=1)l<=f?([i,c,f]=[c,o,l],o=i-sn*(i-n),l=s(o)):([n,o,l]=[o,c,f],c=n+sn*(i-n),f=s(c));let[d,p]=l<=f?[o,l]:[c,f];for(let b of[0,1]){let h=s(b);h<p&&([d,p]=[b,h])}return[Math.sqrt(p),d]}function pv(t,e){let r=[e[0]-t[12],e[1]-t[13],e[2]-t[14]];return[0,1,2].map(a=>t[a*4]*r[0]+t[a*4+1]*r[1]+t[a*4+2]*r[2])}function gv(t,e){let[r,a]=[t[e],t[e+1]],s=0;for(let n=0;n<3;n+=1)s+=(a[n]-r[n])*(a[n]-r[n]);return Math.sqrt(s)}function Rf(t,e){let r=t.length-1,a=0;for(let s=0;s<r;s+=1){let n=e?s:r-1-s;if(a>=je.bootMm)return s;a+=gv(t,n)}return r}function Nf(t,e){let r=je.boardCollisionMarginMm,a=e.map(n=>({board:n,lo:[0,1,2].map(i=>n.minMm[i]-r),hi:[0,1,2].map(i=>n.maxMm[i]+r)})),s=[];for(let n of t.curves){let i=n.diameterMm/2,o=n.samplesMm;if(i<=0||o.length<2)continue;let c=o.length-1,l=new Map,f=(b,h,u)=>{let m=l.get(b)??new Set;for(let g=h;g<u;g+=1)m.add(g);l.set(b,m)},d=t.ends[n.from];d&&f(d.occurrence,0,Rf(o,!0));let p=t.ends[n.to];p&&f(p.occurrence,c-Rf(o,!1),c);for(let{board:b,lo:h,hi:u}of a){let m=o.map(v=>pv(b.matrix,v)),g=l.get(b.id),y=[],x=null;for(let v=0;v<c;v+=1){if(g?.has(v))continue;let[E,S]=bv(m[v],m[v+1],h,u);E<i&&(y.push(v),(!x||E<x[0])&&(x=[E,v,S]))}if(x){let[v,E,S]=x,[T,_]=[o[E],o[E+1]];s.push({segmentId:n.segmentId,board:b.id,distanceMm:v,radiusMm:i,atMm:[0,1,2].map(I=>T[I]+S*(_[I]-T[I])),spans:y})}}}return s}var mv=/_vertical(_|$)/i,yv=/_(horizontal|rightangle|right_angle|angled)(_|$)|_RA(_|$)/i,Bf=t=>t*Math.PI/180;function Cf(t){let e=t.replace(/[0-9]+$/,""),r=t.slice(e.length);return[e,r?Number.parseInt(r,10):-1,t]}function xv(t,e){let[r,a,s]=Cf(t),[n,i,o]=Cf(e);return r!==n?r<n?-1:1:a!==i?a-i:s<o?-1:s>o?1:0}function To(t,e){let r=Bf(t.rotationDeg),a=e[0]-t.positionMm[0],s=e[1]-t.positionMm[1];return[a*Math.cos(r)+s*Math.sin(r),-a*Math.sin(r)+s*Math.cos(r)]}function Of(t,e){let r=Bf(t.rotationDeg);return[e[0]*Math.cos(r)-e[1]*Math.sin(r),e[0]*Math.sin(r)+e[1]*Math.cos(r),0]}function wv(t){return new Set(t.pads.map(e=>`${e.positionMm[0]},${e.positionMm[1]}`)).size}function Ff(t){let e=t.pads.filter(r=>r.pad);return e.length?e:t.pads}function Pf(t){let e=Ff(t),r=e.length;return[e.reduce((a,s)=>a+s.positionMm[0],0)/r,e.reduce((a,s)=>a+s.positionMm[1],0)/r]}function vv(t,e){let r=Math.atan2(e,t)*180/Math.PI,a=Mv(r/90)*90;return Math.abs(r-a)>20?null:{0:"+x",90:"+y",180:"-x","-180":"-x","-90":"-y"}[String(a===0?0:a)]}function Mv(t){let e=Math.floor(t),r=t-e;return r>.5?e+1:r<.5||e%2===0?e:e+1}function kv(t){let e=(u,m,...g)=>({axis:m==="low"?null:u,confidence:m,reasons:g});if(!t||wv(t)<2)return e(null,"low","too_few_pads");let r=t.side==="top"?"top":"bottom",a=t.footprintName??"",s=mv.test(a),n=yv.test(a),i=t.courtyard;if(!i)return s?e(r,"medium","name_vertical","no_courtyard"):e(null,"low","no_courtyard");let o=t.pads.map(u=>To(t,u.positionMm)),c=o.map(([u])=>u),l=o.map(([,u])=>u),f=[c.reduce((u,m)=>u+m,0)/c.length,l.reduce((u,m)=>u+m,0)/l.length],d=[(i.minMm[0]+i.maxMm[0])/2,(i.minMm[1]+i.maxMm[1])/2],p=Math.min(...c)-1<=d[0]&&d[0]<=Math.max(...c)+1&&Math.min(...l)-1<=d[1]&&d[1]<=Math.max(...l)+1,b=[d[0]-f[0],d[1]-f[1]],h=!p&&Math.hypot(...b)>=.5?vv(...b):null;return s?p?e(r,"high","name_vertical","body_over_pads"):e(null,"low","name_vertical","name_conflicts_geometry"):n?h?e(h,"high","name_right_angle","body_off_pads"):e(null,"low","name_right_angle","name_conflicts_geometry"):p?e(r,"medium","body_over_pads"):h?e(h,"medium","body_off_pads"):e(null,"low","body_ambiguous")}function nn(t){let e=Math.sqrt(t.reduce((r,a)=>r+a*a,0));return t.map(r=>r/e)}var Ev=(t,e)=>[t[1]*e[2]-t[2]*e[1],t[2]*e[0]-t[0]*e[2],t[0]*e[1]-t[1]*e[0]],So=(t,e)=>t.reduce((r,a,s)=>r+a*e[s],0);function Sv(t){let e=t.pads.filter(a=>a.pad),r=e.find(a=>a.pad==="1");return r||(e.length?[...e].sort((a,s)=>xv(a.pad,s.pad))[0]:t.pads[0])}function Tv(t){let[e,r]=Pf(t),a=Ff(t),s=a.length,n=0,i=0,o=0;for(let b of a)n+=(b.positionMm[0]-e)**2,i+=(b.positionMm[1]-r)**2,o+=(b.positionMm[0]-e)*(b.positionMm[1]-r);n/=s,i/=s,o/=s;let c=(n+i)/2,l=n*i-o*o,f=Math.sqrt(Math.max(c*c-l,0)),d=c+f,p=c-f;return d<=1e-12||d-p<=.05*d?Of(t,[1,0]):Math.abs(o)>1e-12?nn([d-i,o,0]):n>=i?[1,0,0]:[0,1,0]}function Av(t,e){if(e==="top")return[0,0,1];if(e==="bottom")return[0,0,-1];let r=e[0]==="-"?-1:1;return nn(Of(t,e[1]==="x"?[r,0]:[0,r]))}function Ao(t,e,r){let[a,s,n]=t,[i,o,c]=e,[l,f,d]=r,p=a+o+d,b;if(p>0){let u=Math.sqrt(p+1)*2;b=[(c-f)/u,(l-n)/u,(s-i)/u,.25*u]}else if(a>o&&a>d){let u=Math.sqrt(1+a-o-d)*2;b=[.25*u,(i+s)/u,(l+n)/u,(c-f)/u]}else if(o>d){let u=Math.sqrt(1+o-a-d)*2;b=[(i+s)/u,.25*u,(f+c)/u,(l-n)/u]}else{let u=Math.sqrt(1+d-a-o)*2;b=[(l+n)/u,(f+c)/u,.25*u,(s-i)/u]}return b=nn(b),([b[3],b[0],b[1],b[2]].find(u=>Math.abs(u)>1e-12)??1)<0?b.map(u=>-u):b}function Ea(t,e,r){if(!t||t.pads.length===0)return null;let a=r?r.axis:kv(t).axis;if(!a)return null;let s=r?((r.quarterTurns??0)%4+4)%4:0,[n,i]=Pf(t),o=(e??0)/2,c=[n,i,t.side==="top"?o:-o],l=Av(t,a),f=Tv(t),d=So(f,l),p=[f[0]-d*l[0],f[1]-d*l[1],f[2]-d*l[2]];Math.sqrt(So(p,p))<1e-9&&(p=[-l[1],l[0],0]),p=nn(p);let b=Sv(t).positionMm;So([b[0]-n,b[1]-i,0],p)>1e-9&&(p=p.map(u=>-u));let h=Ev(l,p);for(let u=0;u<s;u+=1)[p,h]=[h,p.map(m=>-m)];return{axis:a,quarterTurns:s,originMm:c,xAxis:p,yAxis:h,zAxis:l,rotation:Ao(p,h,l)}}function Te(t){return Math.round(t*1e9)/1e9+0}function on(t){let e=Math.hypot(...t)||1,r=t.map(s=>s/e),a=[r[3],r[0],r[1],r[2]].find(s=>Math.abs(s)>1e-12)??1;return r.map(s=>Te(a<0?-s:s))}function Sa(t,e){let[r,a,s,n]=t,i=a*e[2]-s*e[1],o=s*e[0]-r*e[2],c=r*e[1]-a*e[0];return[e[0]+2*(n*i+a*c-s*o),e[1]+2*(n*o+s*i-r*c),e[2]+2*(n*c+r*o-a*i)]}function _v(t,e){let[r,a,s,n]=t,[i,o,c,l]=e;return[n*i+r*l+a*c-s*o,n*o-r*c+a*l+s*i,n*c+r*o-a*i+s*l,n*l-r*i-a*o-s*c]}function gt(t,e){let r=Sa(t.rotation,e.translationMm);return{translationMm:t.translationMm.map((a,s)=>Te(a+r[s])),rotation:on(_v(t.rotation,e.rotation))}}function _o(t){let[e,r,a,s]=t.rotation,[n,i,o]=t.translationMm;return[1-2*(r*r+a*a),2*(e*r+a*s),2*(e*a-r*s),0,2*(e*r-a*s),1-2*(e*e+a*a),2*(r*a+e*s),0,2*(e*a+r*s),2*(r*a-e*s),1-2*(e*e+r*r),0,n,i,o,1].map(Te)}var jf=5;var cn=Math.SQRT1_2,YA=[[0,0,0,1],[0,0,cn,cn],[0,0,1,0],[0,0,cn,-cn]];function Iv(t,e){let r=[0,1,2].map(a=>e[a]-t.originMm[a]);return[t.xAxis,t.yAxis,t.zAxis].map(a=>r[0]*a[0]+r[1]*a[1]+r[2]*a[2])}function ln(t,e,r){let a,s;if(r)a=[...r.minMm],s=[...r.maxMm];else if(t.courtyard)a=[...t.courtyard.minMm,0],s=[...t.courtyard.maxMm,jf];else{let d=t.pads.map(p=>To(t,p.positionMm));a=[Math.min(...d.map(p=>p[0])),Math.min(...d.map(p=>p[1])),0],s=[Math.max(...d.map(p=>p[0])),Math.max(...d.map(p=>p[1])),jf]}let n=t.rotationDeg*Math.PI/180,[i,o]=t.positionMm,c=(e??0)/2,l=t.side==="top",f=[];for(let d=0;d<8;d+=1){let[p,b,h]=[0,1,2].map(u=>(d>>u&1?s:a)[u]);f.push([i+p*Math.cos(n)-b*Math.sin(n),o+p*Math.sin(n)+b*Math.cos(n),l?c+h:-c-h])}return f}function dn(t,e){let r=e.map(a=>Iv(t,a));return[[0,1,2].map(a=>Math.min(...r.map(s=>s[a]))),[0,1,2].map(a=>Math.max(...r.map(s=>s[a])))]}var un=Math.SQRT1_2,Rv=[[0,0,0,1],[0,0,un,un],[0,0,1,0],[0,0,un,-un]],Nv=[1,0,0,0],fn=[0,0,0,1],Cv=(t,e)=>{let r=e*Math.PI/360;return[t[0]*Math.sin(r),t[1]*Math.sin(r),t[2]*Math.sin(r),Math.cos(r)]};function Io(t){if(!t)return{pose:{translationMm:[0,0,0],rotation:fn},scale:1};let[e,r,a]=(t.rotationDeg??[0,0,0]).map(Number),s=fn;for(let[i,o]of[[[0,0,1],a],[[0,1,0],r],[[1,0,0],e]])s=gt({translationMm:[0,0,0],rotation:s},{translationMm:[0,0,0],rotation:Cv(i,o)}).rotation;return{pose:{translationMm:(t.offsetMm??[0,0,0]).map(Number),rotation:on(s)},scale:Number(t.scale??1)||1}}function Bv(t){let e=t?.boundsMm;if(!e)return{exit:[0,0,-je.housingDepthMm],depth:je.housingDepthMm,modeled:!1};let{pose:r,scale:a}=Io(t.alignment),s=[];for(let c=0;c<8;c+=1){let l=[0,1,2].map(d=>(c>>d&1?e.maxMm:e.minMm)[d]*a),f=Sa(r.rotation,l);s.push([0,1,2].map(d=>f[d]+r.translationMm[d]))}let n=[0,1,2].map(c=>Math.min(...s.map(l=>l[c]))),i=[0,1,2].map(c=>Math.max(...s.map(l=>l[c]))),o=Math.min(n[2],0);return{exit:[(n[0]+i[0])/2,(n[1]+i[1])/2,o],depth:-o+0,modeled:!0}}function Ov(t,e=0,r){let a=Rv[(e%4+4)%4],s=gt({translationMm:[0,0,0],rotation:Nv},{translationMm:[0,0,0],rotation:a}),n=gt(t,s),{exit:i,depth:o,modeled:c}=Bv(r),l=gt(n,{translationMm:i,rotation:fn}).translationMm,f=Sa(n.rotation,[0,0,-1]),d=[0,1,2].map(p=>l[p]+je.bootMm*f[p]);return{pose:n,exitMm:l.map(Te),outward:f.map(Te),legMm:d.map(Te),depthMm:Te(o),modeled:c}}function Lf(t,e,r,a,s=0,n,i){let o=Ea(e,r,a);if(!o||!e)return null;let c=Math.max(dn(o,ln(e,r,i))[1][2],0),l=gt(t,{translationMm:o.originMm,rotation:o.rotation});return l=gt(l,{translationMm:[0,0,c],rotation:fn}),{...Ov(l,s,n),matingPlaneMm:Te(c)}}function Ro(t,e){let r=new Array(16).fill(0);for(let a=0;a<4;a+=1)for(let s=0;s<4;s+=1){let n=0;for(let i=0;i<4;i+=1)n+=t[i*4+s]*e[a*4+i];r[a*4+s]=n}return r}var Fv=(t,e)=>[e[0]-t[0],0,0,0,0,e[1]-t[1],0,0,0,0,e[2]-t[2],0,t[0],t[1],t[2],1];function Pv(t,e){let r=t.connector,a=r?Ea(r.geometry,r.thicknessMm,r.stored):null;if(!r||!a)return null;let[s,n]=dn(a,ln(r.geometry,r.thicknessMm));return[[s[0],-n[1],-e],[n[0],-s[1],0]]}function Df(t,e){let r=`${t.level||""}/${t.id}`,a=[];for(let s of[...t.ends].sort((n,i)=>n.ordinal-i.ordinal)){let n=e.ends[s.id];if(!n)continue;let i=_o(n.pose),o={key:`${r}/${s.id}`,harness:r,end:s.id};if(s.housing?.boundsMm){let{pose:l,scale:f}=Io(s.housing.alignment),d=Ro(_o(l),[f,0,0,0,0,f,0,0,0,0,f,0,0,0,0,1]);a.push({...o,matrix:Ro(i,d),model:s.housing});continue}let c=Pv(s,n.depthMm);c&&a.push({...o,matrix:Ro(i,Fv(...c)),model:null})}return a}var jv=12,Lv=2,Dv=1e-9,jr=(t,e)=>[t[0]-e[0],t[1]-e[1],t[2]-e[2]],It=(t,e)=>Math.sqrt((t[0]-e[0])**2+(t[1]-e[1])**2+(t[2]-e[2])**2);function Pr(t,e,r,a,s){if(a===r)return[t[0],t[1],t[2]];let n=(a-s)/(a-r),i=(s-r)/(a-r);return[n*t[0]+i*e[0],n*t[1]+i*e[1],n*t[2]+i*e[2]]}function Uv(t,e,r,a){let s=je.catmullRomAlpha,n=0,i=n+It(t,e)**s,o=i+It(e,r)**s,c=o+It(r,a)**s;return l=>{let f=i+l*(o-i),d=Pr(t,e,n,i,f),p=Pr(e,r,i,o,f),b=Pr(r,a,o,c,f),h=Pr(d,p,n,o,f),u=Pr(p,b,i,c,f);return Pr(h,u,i,o,f)}}function zv(t,e,r){let a=jr(r,e),s=jr(t,e),n=Math.sqrt(a[0]*a[0]+a[1]*a[1]+a[2]*a[2]);if(n<1e-12)return It(t,e);let i=[a[1]*s[2]-a[2]*s[1],a[2]*s[0]-a[0]*s[2],a[0]*s[1]-a[1]*s[0]];return Math.sqrt(i[0]*i[0]+i[1]*i[1]+i[2]*i[2])/n}function Uf(t){let e=o=>[o[0],o[1],o[2]];if(t.length<2)return{samples:t.map(e),spans:t.map(()=>0)};let r=t[0],a=t[t.length-1],s=[jr([2*r[0],2*r[1],2*r[2]],t[1]),...t,jr([2*a[0],2*a[1],2*a[2]],t[t.length-2])],n=[e(r)],i=[0];for(let o=0;o<t.length-1;o+=1){let c=Uv(s[o],s[o+1],s[o+2],s[o+3]),l=(f,d,p,b,h)=>{let u=(f+d)/2,m=c(u);h<Lv||h<jv&&zv(m,p,b)>je.chordErrorMm?(l(f,u,p,m,h+1),l(u,d,m,b,h+1)):(n.push(b),i.push(o))};l(0,1,e(t[o]),e(t[o+1]),0)}return{samples:n,spans:i}}function Gv(t,e,r){let a=It(t,e),s=It(e,r),n=It(r,t),i=jr(e,t),o=jr(r,t),c=[i[1]*o[2]-i[2]*o[1],i[2]*o[0]-i[0]*o[2],i[0]*o[1]-i[1]*o[0]],l=Math.sqrt(c[0]*c[0]+c[1]*c[1]+c[2]*c[2]);return l<1e-12?Number.POSITIVE_INFINITY:a*s*n/(2*l)}function zf(t){let e=Number.POSITIVE_INFINITY,r=-1;for(let a=1;a<t.length-1;a+=1){let s=Gv(t[a-1],t[a],t[a+1]);s<e&&(e=s,r=a)}return{radius:e,at:r}}function Kv(t,e,r){let a=[],s=[];t.forEach((p,b)=>{if(a.length&&It(a[a.length-1],p)<Dv){s[s.length-1]=s[s.length-1]&&e[b];return}a.push([p[0],p[1],p[2]]),s.push(!!e[b])});let n=je.minBendRadiusFactor*r,{samples:i,spans:o}=Uf(a),{radius:c,at:l}=zf(i);for(let p=0;p<je.bendRelaxIterations&&!(c>=n||l<0);p+=1){let b=o[l],h=[];for(let y=1;y<a.length-1;y+=1)s[y]&&h.push(y);if(!h.length)break;let u=y=>Math.min(Math.abs(y-b),Math.abs(y-(b+1))),m=h[0];for(let y of h)u(y)<u(m)&&(m=y);let g=[0,1,2].map(y=>(a[m-1][y]+a[m+1][y])/2);a[m]=[0,1,2].map(y=>(a[m][y]+g[y])/2),{samples:i,spans:o}=Uf(a),{radius:c,at:l}=zf(i)}let f=0;for(let p=0;p+1<i.length;p+=1)f+=It(i[p],i[p+1]);let d=p=>p.map(Te);return{controlMm:a.map(d),samplesMm:i.map(d),lengthMm:Te(f),minRadiusMm:Number.isFinite(c)?Te(c):null,minRadiusAllowedMm:Te(n),tightBend:l>=0&&c<n?{atMm:d(i[l]),radiusMm:Te(c)}:null}}function Vv(t){let e=je.bootMm/2,{exitMm:r,outward:a,legMm:s}=t;return[[r[0],r[1],r[2]],[r[0]+e*a[0],r[1]+e*a[1],r[2]+e*a[2]],[s[0],s[1],s[2]],[s[0]+e*a[0],s[1]+e*a[1],s[2]+e*a[2]]]}function Gf(t,e,r={},a={}){let s=new Map(e.nodes.map(n=>[n.id,n.positionMm]));return e.segments.map(n=>{let i=b=>b in t?Vv(t[b]):[[...s.get(b)]],o=i(n.from),c=i(n.to),l=(r[n.id]??[]).map(b=>[b[0],b[1],b[2]]),f=[...o,...l,...c.reverse()],d=a[n.id]??[],p=[...o.map(()=>!1),...l.map((b,h)=>!d[h]),...c.map(()=>!1)];return{segmentId:n.id,...Kv(f,p,n.diameterMm)}})}var Kf=t=>[t[0],t[1],t[2]];function Vf(t,e){return t.filter(r=>r.kind===e).sort((r,a)=>r.order-a.order||(r.id<a.id?-1:r.id>a.id?1:0))}function Hf(t){return Vf(t,"breakout").map(e=>({id:e.id,positionMm:Kf(e.positionMm),ends:[...e.ends??[]]}))}function qf(t,e){let r=(i,o)=>i<o?`${i}
${o}`:`${o}
${i}`,a=new Map;for(let i of Vf(e,"waypoint")){let[o,c]=i.between??[],l=r(o,c),f=a.get(l);f?f.push(i):a.set(l,[i])}let s={waypoints:{},pinned:{},unused:[]},n=new Set;for(let i of t.segments){let o=r(i.from,i.to),c=a.get(o);c&&(n.add(o),c[0].between?.[0]!==i.from&&(c=[...c].reverse()),s.waypoints[i.id]=c.map(l=>Kf(l.positionMm)),s.pinned[i.id]=c.map(l=>!!l.pinned))}for(let[i,o]of a)n.has(i)||s.unused.push(...o.map(c=>c.id));return s.unused.sort(),s}var Wf=(t,e)=>Math.hypot(t[0]-e[0],t[1]-e[1],t[2]-e[2]);function Hv(t){if(!t.length)return{diameterMm:0,assumedGauge:!1};let e=0,r=!1;for(let a of t){let{odMm:s,assumed:n}=If(a.gaugeAwg);e+=s*s,r=r||n}return{diameterMm:Te(je.packingFactor*Math.sqrt(e)),assumedGauge:r}}function qv(t,e){let r=t.map(o=>Math.max(e.get(o.id)??0,0));r.every(o=>o===0)&&(r=t.map(()=>1));let a=r.reduce((o,c)=>o+c,0),s=[0,1,2].map(o=>t.reduce((c,l,f)=>c+r[f]*l.legMm[o],0)/a),n=[0,1,2].map(o=>t.reduce((c,l)=>c+l.outward[o],0)/t.length),i=Math.hypot(...n);return i<1e-9?s:[0,1,2].map(o=>s[o]+je.breakoutLiftMm*n[o]/i)}function Xf(t,e,r=[]){let a=new Map(t.map(b=>[b.id,b])),s=[],n=[];for(let b of e)a.has(b.from.end)&&a.has(b.to.end)?s.push(b):n.push(b.id);let i=new Map;for(let b of s)for(let h of[b.from.end,b.to.end])i.set(h,(i.get(h)??0)+1);let o=b=>b.map(Te),c=t.map(b=>({id:b.id,kind:"end",positionMm:o(b.legMm)})),l=[];if(r.length){for(let h of r)c.push({id:h.id,kind:"breakout",positionMm:o(h.positionMm)});let b=new Map;for(let h of r)for(let u of h.ends??[])a.has(u)&&!b.has(u)&&b.set(u,h.id);for(let h of t){let u=b.get(h.id);if(u===void 0){let m=r[0];for(let g of r)Wf(g.positionMm,h.legMm)<Wf(m.positionMm,h.legMm)&&(m=g);u=m.id}l.push([h.id,u])}for(let h=0;h+1<r.length;h+=1)l.push([r[h].id,r[h+1].id])}else if(t.length===2)l.push([t[0].id,t[1].id]);else if(t.length>2){c.push({id:"auto",kind:"breakout",positionMm:o(qv(t,i))});for(let b of t)l.push([b.id,"auto"])}let f=new Map(c.map(b=>[b.id,[]]));for(let[b,h]of l)f.get(b).push(h),f.get(h).push(b);let d=(b,h)=>{let u=new Set([b]),m=[b];for(;m.length;){let g=m.pop();for(let y of f.get(g))g===h[0]&&y===h[1]||g===h[1]&&y===h[0]||u.has(y)||(u.add(y),m.push(y))}return u},p=l.map(([b,h])=>{let u=d(b,[b,h]),m=s.filter(g=>u.has(g.from.end)!==u.has(g.to.end));return{id:`${b}~${h}`,from:b,to:h,wires:m.map(g=>g.id),...Hv(m)}});return{nodes:c,segments:p,unplaced:n}}var Wv=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];function No(t){return{translationMm:[t[12],t[13],t[14]],rotation:Ao([t[0],t[1],t[2]],[t[4],t[5],t[6]],[t[8],t[9],t[10]])}}function Xv(t,e){return[0,1,2].map(r=>t[r]*e[0]+t[4+r]*e[1]+t[8+r]*e[2]+t[12+r])}function $f(t,e){let r={};for(let d of[...t.ends].sort((p,b)=>p.ordinal-b.ordinal)){let p=d.occurrence?e(d.occurrence):null;if(!p||!d.connector||!d.occurrence)continue;let b=d.connector.inOccurrence?gt(No(p),d.connector.inOccurrence):No(p),h=Lf(b,d.connector.geometry,d.connector.thicknessMm,d.connector.stored,0,d.housing);h&&(r[d.id]={...h,occurrence:d.occurrence})}if(Object.keys(r).length<2)return null;let a=Object.entries(r).map(([d,p])=>({id:d,legMm:p.legMm,outward:p.outward})),s=t.wires.map(d=>({id:d.id,from:{end:d.from},to:{end:d.to},gaugeAwg:d.gaugeAwg??null})),n=t.level?e(t.level):Wv,i=n?(t.nodes??[]).map(d=>({...d,positionMm:Xv(n,d.positionMm)})):[],o=Xf(a,s,Hf(i)),c=qf(o,i),l=new Map(o.segments.map(d=>[d.id,d])),f=Gf(r,o,c.waypoints,c.pinned).map(d=>{let p=l.get(d.segmentId);return{...d,from:p.from,to:p.to,wires:[...p.wires],diameterMm:p.diameterMm,assumedGauge:p.assumedGauge}});return{ends:r,tree:o,curves:f,unused:c.unused,unplaced:o.unplaced,wires:t.wires.map(d=>({id:d.id,from:d.from,to:d.to}))}}function Yf(t,e,r=[]){let a=[],s=[];for(let n of t){let i=$f(n,e);if(!i)continue;s.push(...Df(n,i));let o=new Map;for(let c of r.length?Nf(i,r):[])o.set(c.segmentId,[...o.get(c.segmentId)??[],c.board]);for(let c of i.curves)c.diameterMm<=0||a.push({harness:`${n.level||""}/${n.id}`,segmentId:c.segmentId,from:c.from,to:c.to,samplesMm:c.samplesMm.flat(),radiusMm:c.diameterMm/2,wires:c.wires,tightBend:c.tightBend!==null,assumedGauge:c.assumedGauge,collides:o.get(c.segmentId)??[]})}return{tubes:a,housings:s}}var hn=Object.freeze({restricted:{color:[.55,.57,.6,1],label:"Restricted"},loading:{color:[.7,.76,.82,1],label:"Loading\u2026"},building:{color:[.62,.72,.84,1],label:"Building 3D view\u2026"},missing:{color:[.78,.76,.7,1],label:"No 3D view"},failed:{color:[.86,.6,.56,1],label:"3D view failed"},unknown:{color:[.78,.76,.7,1],label:""}}),Jf=Object.freeze([.001,0,0,0,0,.001,0,0,0,0,.001,0,0,0,0,1]);function Ta(t,e){let r=new Array(16);for(let a=0;a<4;a+=1)for(let s=0;s<4;s+=1)r[a*4+s]=t[s]*e[a*4]+t[4+s]*e[a*4+1]+t[8+s]*e[a*4+2]+t[12+s]*e[a*4+3];return r}function $v([t,e,r]){return[1,0,0,0,0,1,0,0,0,0,1,0,t,e,r,1]}function Yv([t,e,r]){return[t,0,0,0,0,e,0,0,0,0,r,0,0,0,0,1]}function bn(t,e){return Ta(Jf,Ta(t,e))}function Aa(t,e){let r=e.minMm,a=e.maxMm.map((s,n)=>Math.max(s-r[n],.2));return Ta(Jf,Ta(t,Ta($v(r),Yv(a))))}function Qf(t,e,r){return t.restricted?"restricted":!t.assetId||!e?"missing":r==="loaded"?null:r==="failed"?"failed":e.status==="ready"?e.bundleUrl&&e.bundleToBoard?"loading":"building":hn[e.status]?e.status:"unknown"}function Co(t){return!!(t&&t.status==="ready"&&t.bundleUrl&&t.bundleToBoard)}function Zf(t,e){return!t||t.bundleUrl!==e.bundleUrl||t.loadState==="failed"?"create":t.loadState==="waiting"&&Co(e)?"load":"keep"}function eh(t){return(t?.occurrences||[]).filter(e=>e.kind==="board"||e.restricted||e.model||e.box)}function th(t){return`box:${t.map(e=>Number(e).toFixed(3)).join(",")}`}function rh(t){if(!t.length)return!1;let e=0;for(let r of t)if(!r.standIn)e+=1;else if(r.standIn==="loading")return!1;return e>0}function sh(t,e,r=0){return[t/1e3,-e/1e3,r]}function Jv({rotation:t=0,mirror:e=!1,tilt:r=0}){let a=e?[-1,0,0]:[1,0,0],s=[0,1,0],n=e?[0,0,-1]:[0,0,1],i=Math.cos(t),o=Math.sin(t),c=a.map((h,u)=>i*h+o*s[u]),l=s.map((h,u)=>-o*a[u]+i*h),f=Math.cos(r),d=Math.sin(r),p=n.map((h,u)=>f*h-d*l[u]),b=l.map((h,u)=>d*n[u]+f*h);return{right:c,up:b,back:p}}function Oo(t,e,r,a,s=0){let{up:n,back:i}=Jv(t),o=sh(t.center[0],t.center[1],s),c=a*3,l=o.map((p,b)=>p+i[b]*c),f=1/(t.zoom*1e3),d=bs(e*f,r*f,-a*40,a*40);return cr(d,hs(l,o,n))}function Qv(t,e,r,a){let[s,n,i]=a,o=t[0]*s+t[4]*n+t[8]*i+t[12],c=t[1]*s+t[5]*n+t[9]*i+t[13],l=t[3]*s+t[7]*n+t[11]*i+t[15];return l>0?[(o/l+1)/2*e,(1-c/l)/2*r]:null}function _a(t){let e=t[0]*1e3,r=t[3]*1e3,a=-t[4]*1e3,s=-t[1]*1e3;return{box:{x:e,y:a,w:r-e,h:s-a},bottom:t[2]+t[5]<0}}function Fo(t,e){return t?e?t[2]:t[5]:0}function nh(t,e,r,a,s){let n=Ot(t),i=Oo(e,r,a,n,e.focusZ??0);return Qv(i,r,a,sh(s[0],s[1],e.focusZ??0))}var Zv=([t,e,r,a])=>({x:Math.min(t,r),y:Math.min(e,a),w:Math.abs(r-t),h:Math.abs(a-e)}),Bo=t=>[t.x+t.w/2,t.y+t.h/2],ah=new WeakMap;function e1(t,e){let r=ah.get(t);if(r)return r;let a=new Map,s=new Map;for(let c of t.features.values()){if(c.sourceUid&&a.set(String(c.sourceUid),c),c.kind!=="pad")continue;let l=/^(.*):pad:\d+:(.+)$/.exec(String(c.sourceUid||""));if(!l)continue;let f=`${l[1]}\0${l[2]}`;s.has(f)||s.set(f,[]),s.get(f).push(c)}let n=new Map;for(let c of e?.physical_objects||[])c.kind==="footprint_body"&&c.designator&&c.bbox_mm?.length===4&&n.set(c.designator,c);let i=new Map((e?.physical_objects||[]).map(c=>[c.uid,c])),o={bySource:a,padsByFootprintPin:s,bodies:n,objects:i};return ah.set(t,o),o}function ih({scene:t,topology:e},r,a){let s=String(r),n=t.componentFeatures.get(s);if(!n)return null;let i=e1(t,e),o=t.features.get(Number(n.featureId)),c=i.bodies.get(s),l=o?.bounds?_a(o.bounds).box:c?Zv(c.bbox_mm.map(Number)):null,f=o?.bounds?_a(o.bounds).bottom:String(c?.layer||"").startsWith("B."),d=null;if(a!=null&&a!==""){let b=(e?.terminals||[]).find(u=>u.designator===s&&String(u.pin)===String(a)),h=b?.pcb_pad_id?i.objects.get(b.pcb_pad_id):null;if(d=h?.source_ids?.[0]&&i.bySource.get(String(h.source_ids[0]))||null,!d){let u=i.padsByFootprintPin.get(`${n.footprint}\0${a}`)||[],m=l?Bo(l):null,g=1/0;for(let y of u){let x=Bo(_a(y.bounds).box),v=m?Math.hypot(x[0]-m[0],x[1]-m[1]):0;v<g&&([g,d]=[v,y])}}}let p=d?.bounds?_a(d.bounds).box:null;return!l&&p&&(l=p,f=_a(d.bounds).bottom),l?{reference:s,pin:d?String(a):null,focus:l,anchor:Bo(p||l),anchorBox:p,bottom:f,surfaceZ:Fo(t.runtimeBounds,f)}:null}var pn=class{#e=new Map;constructor(e=3e3){this.ttlMs=e}get size(){return this.#e.size}record(e,r,a){this.#e.set(e,{matrix:r,at:a})}release(e){this.#e.delete(e)}clear(){this.#e.clear()}active(e){let r=[];for(let[a,s]of this.#e)e-s.at>this.ttlMs?this.#e.delete(a):r.push(s.matrix);return r}};var xn=1.5*1024*1024*1024;function Po(t){let e=Number(t);return Number.isFinite(e)&&e>0?e:xn}function oh(t,e){if(e.netName||e.netUid){let r=e.netUid&&t.find(a=>a.uid===e.netUid)||e.netName&&lr(t,e.netName);return r?{kind:"net",id:Number(r.id)}:{kind:"unresolved"}}return e.netId?{kind:"net",id:Number(e.netId)}:e.featureId?{kind:"feature",id:Number(e.featureId)}:e.reference?{kind:"component",reference:String(e.reference)}:{kind:"board"}}function ch(t,e){if(e.kind==="net")t.selectNet(e.id,!0);else if(e.kind==="feature")t.selectFeature(e.id,!0);else if(e.kind==="component")t.selectComponent(e.reference,!0);else return!1;return!0}function lh(t,e){return e&&!t?"enter":!e&&t?"leave":null}function t1(t){return(Array.isArray(t)?t:[]).map((e,r)=>{let a=xl(e?.color??Ai[r%Ai.length]);return{key:String(e?.key??r),mark:a,color:`#${(a&16777215).toString(16).padStart(6,"0")}`,members:(Array.isArray(e?.members)?e.members:[]).filter(s=>s&&typeof s.occurrence=="string"&&typeof s.net=="string"),wires:(Array.isArray(e?.wires)?e.wires:[]).filter(s=>s&&typeof s.harness=="string"&&typeof s.wire=="string")}})}function jo(){return{selection:null,gpuBudget:null}}var r1=Object.freeze(["setSelection","resize","getViewState","setLayerVisible","applyLayerPreset","setShowBoard","setShowComponents","setShowPlaceholders","setRealisticColors","setBoardLayerVisible","setSeparation","showNetLayers","setNetIsolation","setStatsOverlay","getStats","setLodOverride","setGpuBudget","pickAt","projectComponent","projectPoint"]),gn=class{#e=null;constructor(e=jo()){this.shared=e}get port(){return this.#e}attach(e){if(!e)throw new TypeError("A mode controller attaches to a mounted scene port");this.detach(),this.#e=e,this.replay(e)}detach(){let e=this.#e;this.#e=null,this.release(),e?.dispose?.()}replay(){}release(){}setSelection(e){this.shared.selection=e||null;let r=this.#e;r&&r.quietly(()=>this.applySelection(r,this.shared.selection))}setGpuBudget(e){this.shared.gpuBudget=e,this.#e?.setGpuBudget(Po(e))}resize(){this.#e?.resize()}getViewState(){return this.#e?.getViewState()??null}setLayerVisible(e,r,a=null){this.#e?.setLayerVisible(e,r,a)}applyLayerPreset(e,r=null){this.#e?.applyLayerPreset(e,r)}setShowBoard(e){this.#e?.setShowBoard(e)}setShowComponents(e){this.#e?.setShowComponents(e)}setShowPlaceholders(e){this.#e?.setShowPlaceholders(e)}setRealisticColors(e){this.#e?.setRealisticColors(e)}setBoardLayerVisible(e,r,a){this.#e?.setBoardLayerVisible(e,r,a)}setSeparation(e,r=null){this.#e?.setSeparation(e,r)}showNetLayers(){this.#e?.showNetLayers()}setNetIsolation(e){this.#e?.setNetIsolation(e)}setStatsOverlay(e){this.#e?.setStatsOverlay(e)}getStats(){return this.#e?.stats()??null}setLodOverride(e){this.#e?.setLodOverride(e)}pickAt(e,r){return Promise.resolve(this.#e?.pickAt(e,r)??null)}projectComponent(e,r){return this.#e?.projectComponent(e,r)??null}projectPoint(e,r){return this.#e?.projectPoint(e,r)??null}},a1=Object.freeze(["setHighlightedNets","setHiddenComponents","getComponentReferences","setViewMode","renderInset","insetReady","insetSurfaceZ","releaseInset","insetTarget","projectInset","onSceneChange","insetStats","insetSettings","gpuIdle","loadAnalyticPack","setAnalyticOverlay","setAnalyticVectors","setAnalyticStyle","analyticColormaps","setAnalyticRelief","setClickSelect","analyticProbe","analyticAt","analyticStats","unloadAnalyticPack"]),mn=class extends gn{#e=[];#r=null;#a="pcb";#s=new Set;#n=null;#t=null;#o=!0;#i=null;attach(e,{workspace:r="pcb"}={}){this.#a=r,super.attach(e)}replay(e){this.#n=e.onSceneChange?.(()=>this.#l())??null,this.#l(),e.setWorkspace(this.#a),this.#r&&e.setHiddenComponents(this.#r),this.shared.gpuBudget!=null&&e.setGpuBudget(Po(this.shared.gpuBudget)),this.shared.selection&&e.quietly(()=>this.applySelection(e,this.shared.selection)),this.#e.length&&this.#c(e,this.#e),this.#t&&this.#d(e,this.#t),this.#o||e.setClickSelect(!1)}async#d(e,r){await e.loadAnalyticPack(r.bytes,r.options),r.overlay&&e.setAnalyticOverlay(r.overlay),this.#i&&e.setAnalyticRelief(this.#i),r.style&&e.setAnalyticStyle(r.style),r.vectors&&e.setAnalyticVectors(r.vectors)}release(){this.#n?.(),this.#n=null}applySelection(e,r){r?.occurrence!=null&&e.selectOccurrence(r.occurrence),r?ch(e,oh(e.nets(),r)):e.clearSelection()}setWorkspace(e){this.#a=e,this.port?.setWorkspace(e)}setHighlightedNets(e){this.#e=Array.isArray(e)?[...e]:[];let r=this.port;r&&this.#c(r,this.#e)}#c(e,r){let a=ml(e.nets(),r),s=e.anyEmphasis();e.setHighlightedNetIds(a);let n=e.anyEmphasis(),i=lh(s,n);i==="enter"?e.showNetProbe():i==="leave"&&e.restoreVisibility(),e.isolating()&&n&&e.isolateLitNets(),e.refreshResidency()}setHiddenComponents(e){this.#r=Array.isArray(e)?[...e]:[],this.port?.setHiddenComponents(this.#r)}getComponentReferences(){return this.port?.getComponentReferences()??[]}setViewMode(e){this.port?.setViewMode(e)}renderInset(e,r,a){return!!this.port?.renderInset(e,r,a)}insetReady(){return!!this.port?.insetReady()}insetSurfaceZ(e){let r=this.port;return r?Fo(r.insetBoard().scene.runtimeBounds,!!e):0}releaseInset(e){this.port?.releaseInset(String(e))}insetTarget(e,r){let a=this.port;return a?ih(a.insetBoard(),e,r):null}projectInset(e,r,a,s){let n=this.port;return n?nh(n.insetBoard().scene.runtimeBounds,e,r,a,s):null}onSceneChange(e){return this.#s.add(e),()=>this.#s.delete(e)}#l(){for(let e of this.#s)e()}insetStats(){return this.port?.insetStats()??null}insetSettings(e){return this.port?.insetSettings(e)??null}gpuIdle(){return this.port?.gpuIdle()??Promise.resolve()}async loadAnalyticPack(e,r={}){let a=e instanceof Uint8Array?e:new Uint8Array(e);return this.#t={bytes:a,options:r,overlay:null,vectors:null,style:this.#t?.style??null},this.port?this.port.loadAnalyticPack(a,r):null}setAnalyticOverlay(e){return this.#t&&(this.#t.overlay=e),this.port?.setAnalyticOverlay(e)??null}setAnalyticVectors(e){return this.#t&&(this.#t.vectors=e),this.port?.setAnalyticVectors(e)??null}setAnalyticStyle(e){return this.#t&&(this.#t.style={...this.#t.style||{},...e}),this.port?.setAnalyticStyle(e)??null}analyticColormaps(){return this.port?.analyticColormaps()??null}setAnalyticRelief(e){return this.#i=e||null,this.port?.setAnalyticRelief(this.#i)??null}setClickSelect(e){this.#o=e!==!1,this.port?.setClickSelect(this.#o)}analyticProbe(e,r){return this.port?.analyticProbe(e,r)??null}analyticAt(e,r){return this.port?.analyticAt(e,r)??Promise.resolve(null)}analyticStats(){return this.port?.analyticStats()??null}unloadAnalyticPack(){this.#t=null,this.port?.unloadAnalyticPack()}},s1=Object.freeze(["setSystemScene","setNetEmphasis","frameNetEmphasis","frameAll","frameBoard","frameParts","setMoveMode","setRouteMode","setMoveSpace","previewPose","cancelMove","getMoveState","targetHarnessNode","selectHarness","previewHarnessNode","cancelHarnessNode","getHarnessState","setLabelsVisible","setHarnessesVisible","setHelpVisible","isHelpVisible","setLodThresholds","pickSurfaceAt","focusMoveTarget","viewAxis"]),yn=class extends gn{#e=null;#r=null;#a=null;#s=!1;attach(e,{moveAllowed:r=!1}={}){this.#s=!!r,super.attach(e)}replay(e){this.shared.gpuBudget!=null&&e.setGpuBudget(Po(this.shared.gpuBudget)),this.#e&&e.setSystemScene(this.#e),this.#r&&this.#n(e,this.#r),e.setMoveAllowed(this.#s),this.#a!=null&&e.setLabelsVisible(this.#a)}applySelection(e,r){if(!r){e.clearSelection();return}if(e.focusPlacement(r.occurrence)!=="board")return;let a=oh(e.nets(),r);a.kind==="board"?e.selectBoardContext():ch(e,a)}setSystemScene(e){this.#e=e||null,e&&this.port?.setSystemScene(e)}setNetEmphasis(e){this.#r=Array.isArray(e)?e:[];let r=this.port;return r?this.#n(r,this.#r):[]}#n(e,r){let a=e.anyEmphasis(),s=e.setEmphasisSets(t1(r));if(!s)return[];let n=e.anyEmphasis(),i=lh(a,n);return i==="enter"?e.showNetProbe():i==="leave"&&(e.isolating()&&e.setNetIsolation(!1),e.restoreVisibility()),e.isolating()&&n&&e.isolateLitNets(),s}frameNetEmphasis(e=null,r=null){return this.port?.frameNetEmphasis(e,r)??!1}frameAll(){this.port?.frameAll()}frameBoard(e){return this.port?.frameBoard(e)??!1}frameParts(e){return this.port?.frameParts(e)??!1}setMoveAllowed(e){this.#s=!!e,this.port?.setMoveAllowed(this.#s)}setMoveMode(e,r){this.port?.setMoveMode(e,r)}setRouteMode(e){this.port?.setMoveMode(e,{route:!0})}setMoveSpace(e){this.port?.setMoveSpace(e)}previewPose(e){this.port?.previewPose(e)}cancelMove(){this.port?.cancelMove()}getMoveState(){return this.port?.getMoveState()??null}targetHarnessNode(e){this.port?.targetHarnessNode(e)}selectHarness(e){return this.port?.selectHarness(e)??!1}previewHarnessNode(e){this.port?.previewHarnessNode(e)}cancelHarnessNode(){this.port?.cancelHarnessNode()}getHarnessState(){return this.port?.getHarnessState()??null}setLabelsVisible(e){this.#a=!!e,this.port?.setLabelsVisible(this.#a)}setHarnessesVisible(e){this.port?.setHarnessesVisible(!!e)}setHelpVisible(e){this.port?.setHelpVisible(e)}isHelpVisible(){return!!this.port?.isHelpVisible()}setLodThresholds(e){return this.port?.setLodThresholds(e)??null}pickSurfaceAt(e,r){return this.port?.pickSurfaceAt(e,r)??null}focusMoveTarget(e){return!!this.port?.focusMoveTarget(e)}viewAxis(e,r=!1){this.port?.viewAxis(e,r)}};function dh(t){let e=(r,a)=>{for(let s of r)Object.defineProperty(t,s,{configurable:!0,writable:!0,value(...n){return a(this)[s](...n)}})};e(r1,r=>r.activeMode),e(a1,r=>r.modes.board),e(s1,r=>r.modes.system)}var Do=Object.freeze({viridis:["#440154","#482878","#3e4989","#31688e","#26828e","#1f9e89","#35b779","#6ece58","#b5de2b","#fde725"],inferno:["#000004","#1b0c41","#4a0c6b","#781c6d","#a52c60","#cf4446","#ed6925","#fb9b06","#f7d13d","#fcffa4"],magma:["#000004","#180f3d","#440f76","#721f81","#9e2f7f","#cd4071","#f1605d","#fd9668","#feca8d","#fcfdbf"],plasma:["#0d0887","#46039f","#7201a8","#9c179e","#bd3786","#d8576b","#ed7953","#fb9f3a","#fdca26","#f0f921"],cividis:["#00224e","#123570","#3b496c","#575d6d","#707173","#8a8678","#a59c74","#c3b369","#e1cc55","#fee838"],turbo:["#30123b","#4662d7","#36aaf9","#1ae4b6","#72fe5e","#c8ef34","#faba39","#f66b19","#ca2a04","#7a0403"],coolwarm:["#3b4cc0","#6788ee","#9abbff","#c9d7f0","#edd1c2","#f7a889","#e26952","#b40426"],ember:["#e0e3ed","#ff9e1f","#db141a"],ice:["#f4f7fb","#9ecae1","#2171b5","#08306b"],white:["#fafaf5","#fafaf5"],greys:["#f7f7f7","#bdbdbd","#737373","#252525"]}),Lr=256,Ia=Object.freeze({fieldColormap:"viridis",arrowColormap:"ember",arrowDensity:70,arrowWidth:.07,arrowMinLength:.3,arrowOutline:[.05,.05,.07,.85]});function uh(t){let e=String(t).replace(/^#/,"");if(!/^[0-9a-fA-F]{6}$/.test(e))throw new TypeError(`colour ${t} is not #rrggbb`);return[0,2,4].map(r=>Number.parseInt(e.slice(r,r+2),16)/255)}function Lo(t){if(Array.isArray(t)){if(t.length<2)throw new TypeError("a colormap needs two or more stops");return t.forEach(uh),[...t]}let e=Do[t];if(!e)throw new TypeError(`unknown colormap ${t}`);return[...e]}function Uo(t,e=Lr){let r=Lo(t).map(uh),a=new Float32Array(e*4);for(let s=0;s<e;s++){let n=s/(e-1)*(r.length-1),i=Math.min(r.length-2,Math.floor(n)),o=n-i;for(let c=0;c<3;c++)a[s*4+c]=r[i][c]*(1-o)+r[i+1][c]*o;a[s*4+3]=1}return a}function zo(t={},e=Ia){let r={...e,...t||{}};Lo(r.fieldColormap),Lo(r.arrowColormap);let a=(s,n)=>{if(!(Number(r[s])>0&&Number(r[s])<=n))throw new RangeError(`${s} must be in (0, ${n}]`);r[s]=Number(r[s])};if(a("arrowDensity",400),a("arrowWidth",.5),a("arrowMinLength",1),!Array.isArray(r.arrowOutline)||r.arrowOutline.length!==4)throw new TypeError("arrowOutline is [r, g, b, a]");return r}var Dr=class{__destroy_into_raw(){let e=this.__wbg_ptr;return this.__wbg_ptr=0,fh.unregister(this),e}free(){let e=this.__destroy_into_raw();K.__wbg_analyticpack_free(e,0)}barrelRecords(){let e=K.analyticpack_barrelRecords(this.__wbg_ptr);return Fa.__wrap(e)}bindingJson(e){let r,a;try{let i=K.analyticpack_bindingJson(this.__wbg_ptr,e);var s=i[0],n=i[1];if(i[3])throw s=0,n=0,wn(i[2]);return r=s,a=n,ja(s,n)}finally{K.__wbindgen_free(r,a,1)}}headerJson(){let e,r;try{let n=K.analyticpack_headerJson(this.__wbg_ptr);var a=n[0],s=n[1];if(n[3])throw a=0,s=0,wn(n[2]);return e=a,r=s,ja(a,s)}finally{K.__wbindgen_free(e,r,1)}}lowerSlice(e,r){let a=l1(e,K.__wbindgen_malloc,K.__wbindgen_realloc),s=La,n=K.analyticpack_lowerSlice(this.__wbg_ptr,a,s,r);if(n[2])throw wn(n[1]);return Pa.__wrap(n[0])}constructor(e){let r=c1(e,K.__wbindgen_malloc),a=La,s=K.analyticpack_new(r,a);if(s[2])throw wn(s[1]);return this.__wbg_ptr=s[0],fh.register(this,this.__wbg_ptr,this),this}operationNetIndices(e){let r=K.analyticpack_operationNetIndices(this.__wbg_ptr,e);var a=mt(r[0],r[1]).slice();return K.__wbindgen_free(r[0],r[1]*4,4),a}};Symbol.dispose&&(Dr.prototype[Symbol.dispose]=Dr.prototype.free);var Fa=class t{static __wrap(e){let r=Object.create(t.prototype);return r.__wbg_ptr=e,hh.register(r,r.__wbg_ptr,r),r}__destroy_into_raw(){let e=this.__wbg_ptr;return this.__wbg_ptr=0,hh.unregister(this),e}free(){let e=this.__destroy_into_raw();K.__wbg_barrelrecords_free(e,0)}floats(){let e=K.barrelrecords_floats(this.__wbg_ptr);var r=vn(e[0],e[1]).slice();return K.__wbindgen_free(e[0],e[1]*4,4),r}skipped(){return K.barrelrecords_skipped(this.__wbg_ptr)>>>0}words(){let e=K.barrelrecords_words(this.__wbg_ptr);var r=mt(e[0],e[1]).slice();return K.__wbindgen_free(e[0],e[1]*4,4),r}};Symbol.dispose&&(Fa.prototype[Symbol.dispose]=Fa.prototype.free);var Pa=class t{static __wrap(e){let r=Object.create(t.prototype);return r.__wbg_ptr=e,bh.register(r,r.__wbg_ptr,r),r}__destroy_into_raw(){let e=this.__wbg_ptr;return this.__wbg_ptr=0,bh.unregister(this),e}free(){let e=this.__destroy_into_raw();K.__wbg_loweredslicerecords_free(e,0)}batches(){let e=K.loweredslicerecords_batches(this.__wbg_ptr);var r=mt(e[0],e[1]).slice();return K.__wbindgen_free(e[0],e[1]*4,4),r}contourEdgeOperations(){let e=K.loweredslicerecords_contourEdgeOperations(this.__wbg_ptr);var r=mt(e[0],e[1]).slice();return K.__wbindgen_free(e[0],e[1]*4,4),r}contourEdges(){let e=K.loweredslicerecords_contourEdges(this.__wbg_ptr);var r=vn(e[0],e[1]).slice();return K.__wbindgen_free(e[0],e[1]*4,4),r}covers(){let e=K.loweredslicerecords_covers(this.__wbg_ptr);var r=mt(e[0],e[1]).slice();return K.__wbindgen_free(e[0],e[1]*4,4),r}cutIndices(){let e=K.loweredslicerecords_cutIndices(this.__wbg_ptr);var r=mt(e[0],e[1]).slice();return K.__wbindgen_free(e[0],e[1]*4,4),r}edgeCuts(){let e=K.loweredslicerecords_edgeCuts(this.__wbg_ptr);var r=mt(e[0],e[1]).slice();return K.__wbindgen_free(e[0],e[1]*4,4),r}fanVertices(){let e=K.loweredslicerecords_fanVertices(this.__wbg_ptr);var r=vn(e[0],e[1]).slice();return K.__wbindgen_free(e[0],e[1]*4,4),r}outlineEdges(){let e=K.loweredslicerecords_outlineEdges(this.__wbg_ptr);var r=vn(e[0],e[1]).slice();return K.__wbindgen_free(e[0],e[1]*4,4),r}outlineShapes(){let e=K.loweredslicerecords_outlineShapes(this.__wbg_ptr);var r=mt(e[0],e[1]).slice();return K.__wbindgen_free(e[0],e[1]*4,4),r}shapeCuts(){let e=K.loweredslicerecords_shapeCuts(this.__wbg_ptr);var r=mt(e[0],e[1]).slice();return K.__wbindgen_free(e[0],e[1]*4,4),r}shapes(){let e=K.loweredslicerecords_shapes(this.__wbg_ptr);var r=mt(e[0],e[1]).slice();return K.__wbindgen_free(e[0],e[1]*4,4),r}statsJson(){let e,r;try{let a=K.loweredslicerecords_statsJson(this.__wbg_ptr);return e=a[0],r=a[1],ja(a[0],a[1])}finally{K.__wbindgen_free(e,r,1)}}subtractShapes(){return K.loweredslicerecords_subtractShapes(this.__wbg_ptr)>>>0}};Symbol.dispose&&(Pa.prototype[Symbol.dispose]=Pa.prototype.free);function n1(){return{__proto__:null,"./prism_kicad_analytic_bg.js":{__proto__:null,__wbg___wbindgen_throw_bb96b2010945f0bc:function(e,r){throw new Error(ja(e,r))},__wbindgen_cast_0000000000000001:function(e,r){return ja(e,r)},__wbindgen_init_externref_table:function(){let e=K.__wbindgen_externrefs,r=e.grow(4);e.set(0,void 0),e.set(r+0,void 0),e.set(r+1,null),e.set(r+2,!0),e.set(r+3,!1)}}}}var fh=typeof FinalizationRegistry>"u"?{register:()=>{},unregister:()=>{}}:new FinalizationRegistry(t=>K.__wbg_analyticpack_free(t,1)),hh=typeof FinalizationRegistry>"u"?{register:()=>{},unregister:()=>{}}:new FinalizationRegistry(t=>K.__wbg_barrelrecords_free(t,1)),bh=typeof FinalizationRegistry>"u"?{register:()=>{},unregister:()=>{}}:new FinalizationRegistry(t=>K.__wbg_loweredslicerecords_free(t,1));function vn(t,e){return t=t>>>0,i1().subarray(t/4,t/4+e)}function mt(t,e){return t=t>>>0,o1().subarray(t/4,t/4+e)}var Ra=null;function i1(){return(Ra===null||Ra.byteLength===0)&&(Ra=new Float32Array(K.memory.buffer)),Ra}function ja(t,e){return u1(t>>>0,e)}var Na=null;function o1(){return(Na===null||Na.byteLength===0)&&(Na=new Uint32Array(K.memory.buffer)),Na}var Ca=null;function Ba(){return(Ca===null||Ca.byteLength===0)&&(Ca=new Uint8Array(K.memory.buffer)),Ca}function c1(t,e){let r=e(t.length*1,1)>>>0;return Ba().set(t,r/1),La=t.length,r}function l1(t,e,r){if(r===void 0){let o=Oa.encode(t),c=e(o.length,1)>>>0;return Ba().subarray(c,c+o.length).set(o),La=o.length,c}let a=t.length,s=e(a,1)>>>0,n=Ba(),i=0;for(;i<a;i++){let o=t.charCodeAt(i);if(o>127)break;n[s+i]=o}if(i!==a){i!==0&&(t=t.slice(i)),s=r(s,a,a=i+t.length*3,1)>>>0;let o=Ba().subarray(s+i,s+a),c=Oa.encodeInto(t,o);i+=c.written,s=r(s,a,i,1)>>>0}return La=i,s}function wn(t){let e=K.__wbindgen_externrefs.get(t);return K.__externref_table_dealloc(t),e}var Mn=new TextDecoder("utf-8",{ignoreBOM:!0,fatal:!0});Mn.decode();var d1=2146435072,Go=0;function u1(t,e){return Go+=e,Go>=d1&&(Mn=new TextDecoder("utf-8",{ignoreBOM:!0,fatal:!0}),Mn.decode(),Go=e),Mn.decode(Ba().subarray(t,t+e))}var Oa=new TextEncoder;"encodeInto"in Oa||(Oa.encodeInto=function(t,e){let r=Oa.encode(t);return e.set(r),{read:t.length,written:r.length}});var La=0,f1,h1,K;function b1(t,e){return h1=t,K=t.exports,f1=e,Ra=null,Na=null,Ca=null,K.__wbindgen_start(),K}async function p1(t,e){if(typeof Response=="function"&&t instanceof Response){if(!t.ok)throw new Error(`failed to fetch Wasm: ${t.status} ${t.statusText} fetching '${t.url}'`);if(typeof WebAssembly.instantiateStreaming=="function")try{return await WebAssembly.instantiateStreaming(t,e)}catch(s){if(r(t.type)&&t.headers.get("Content-Type")!=="application/wasm")console.warn("`WebAssembly.instantiateStreaming` failed because your server does not serve Wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n",s);else throw s}let a=await t.arrayBuffer();return await WebAssembly.instantiate(a,e)}else{let a=await WebAssembly.instantiate(t,e);return a instanceof WebAssembly.Instance?{instance:a,module:t}:a}function r(a){switch(a){case"basic":case"cors":case"default":return!0}return!1}}async function ph(t){if(K!==void 0)return K;t!==void 0&&(Object.getPrototypeOf(t)===Object.prototype?{module_or_path:t}=t:console.warn("using deprecated parameters for the initialization function; pass a single object instead")),t===void 0&&(t=new URL("prism_kicad_analytic_bg.wasm",import.meta.url));let e=n1();(typeof t=="string"||typeof Request=="function"&&t instanceof Request||typeof URL=="function"&&t instanceof URL)&&(t=fetch(t));let{instance:r,module:a}=await p1(await t,e);return b1(r,a)}var gh={schema:"prism.vendored_wasm.a0",purpose:"Reads materialization packs (kicad_monkey.materialization.a0) in the browser and lowers their slices for the analytic renderer.",source:{repository:"this repository",crate:"prism-kicad-wasm",native_src_rs_tree:"5b03b10ee0e1b0c9d2449fbb47596a4065a1785d",license:"MIT"},build:{target:"wasm32-unknown-unknown",profile:"release",features:["materialization"],wasm_bindgen:"0.2.127",rustc:"rustc 1.98.0 (88d9e12ae 2026-08-18)",command:"node scripts/build-analytic-wasm.mjs"},files:{"prism_kicad_analytic.js":"c93b31ad6ad5e7bc4ef2b0e658e1f514c81a9124dfc6a42db5ea1c5fa96d5fd9","prism_kicad_analytic_bg.wasm":"8fcc4ad15c6f41bc1358b9d739faf9264a06758edf7e587afc11db6b38a3b85d"}};var mh="prism-kicad-analytic.wasm",m1="kicad_monkey.materialization.a0",br=1e3,Ko=null;function Ur(){return String(gh.files?.["prism_kicad_analytic_bg.wasm"]||"").slice(0,16)}function vh(){let t=Ur();try{return new URL(`${mh}?v=${t}`,import.meta.url)}catch{return`/${mh}?v=${t}`}}function y1(t=vh()){return Ko??=ph({module_or_path:t}).catch(e=>{throw Ko=null,e}),Ko}function x1(t,e,r=br){let a=t.lowerSlice(e,r);try{return{shapes:new Uint32Array(a.shapes()),subtractShapes:a.subtractShapes(),fanVertices:new Float32Array(a.fanVertices()),covers:new Uint32Array(a.covers()),batches:new Uint32Array(a.batches()),contourEdges:new Float32Array(a.contourEdges()),contourEdgeOperations:new Uint32Array(a.contourEdgeOperations()),shapeCuts:new Uint32Array(a.shapeCuts()),edgeCuts:new Uint32Array(a.edgeCuts()),cutIndices:new Uint32Array(a.cutIndices()),outlineEdges:new Float32Array(a.outlineEdges()),outlineShapes:new Uint32Array(a.outlineShapes()),stats:JSON.parse(a.statsJson())}}finally{a.free()}}function En(){return String(vh())}async function Da(t,{wasm:e}={}){await y1(e);let r=new Dr(t instanceof Uint8Array?t:new Uint8Array(t)),a=JSON.parse(r.headerJson());if(a.schema!==m1)throw new Error(`unsupported materialization schema ${a.schema}`);return{header:a,lowerSlice(s,n=br){return x1(r,s,n)},barrels(){let s=r.barrelRecords();try{return{floats:new Float32Array(s.floats()),words:new Uint32Array(s.words()),skipped:s.skipped()}}finally{s.free()}},binding(s){return JSON.parse(r.bindingJson(s))},netIndices(){return new Uint32Array(r.operationNetIndices(zr(a)))},free(){r.free()}}}function zr(t){return(t.chunks||[]).reduce((e,r)=>e+Number(r.operation_count||0),0)}function w1(t,e){let r=null;for(let a of t.chunks||[]){if(a.slice_key!==e)continue;let s=a.bounds,n=[s.min_x_nm,s.min_y_nm,s.max_x_nm,s.max_y_nm].map(i=>i/1e6);r=r?[Math.min(r[0],n[0]),Math.min(r[1],n[1]),Math.max(r[2],n[2]),Math.max(r[3],n[3])]:n}return r}var v1={conductor:"copper",solder_mask:"mask",silkscreen:"silk",paste:"paste",dielectric:"dielectric"},Mh=1e-6,kh=2e-6,yh=1e-7,xh={"fr4 natural":[109,116,75],"ptfe natural":[252,252,250],polyimide:[205,130,0],"phenolic natural":[92,17,6],aluminum:[213,213,213]};function M1(t){let e=String(t||"").trim(),r=/^#([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(e);return[...(r?[0,2,4].map(s=>parseInt(r[1].slice(s,s+2),16)):xh[e.toLowerCase()]||xh["fr4 natural"]).map(s=>s/255),1]}function Eh(t,e,r=0){let a=new Map((e||[]).map(u=>[String(u.name),u])),s=[...t.stack?.slices||[]].sort((u,m)=>u.order-m.order),n=s.filter(u=>u.role==="conductor"),i=u=>Number(a.get(String(u?.kicad_layer||""))?.id||0),o=i(n[0]),c=i(n[n.length-1]),l=[],f=[];for(let u of s){let m=v1[u.role],g=a.get(String(u.kicad_layer||"")),y=w1(t,u.key);if(!m||!g||!y){m&&f.push(u.key);continue}let x=Number(g.z_mm||0)/1e3+r,v=(Number(g.thickness_mm)||Number(u.thickness_nm||0)/1e6)/2e3,E=u.side==="back"||m!=="dielectric"&&m!=="copper"&&x<r,S={key:u.key,role:m,layerId:Number(g.id),side:u.side||null,bounds:y};if(m==="dielectric"){S.color=M1(g.color);let T=[...n].reverse().find(C=>C.order<u.order),_=n.find(C=>C.order>u.order),I=[i(T)||i(_),i(_)||i(T)],N={zTop:x+v,zBottom:x-v};l.push({...S,...N,face:"top",z:x+v-yh,faceDown:!1,outer:!1,offsetLayers:I}),l.push({...S,...N,face:"bottom",z:x-v+yh,faceDown:!0,outer:!1,offsetLayers:I})}else if(m==="copper"){let T=n.indexOf(u),_=T===n.length-1&&n.length>1,I=T===0||_,N={...S,bottom:_,outer:I,zTop:x+v,zBottom:x-v,offsetLayers:[Number(g.id),Number(g.id)]};l.push({...N,face:"top",z:x+v,faceDown:!1,mark:I&&!_,walls:!_}),l.push({...N,face:"bottom",z:x-v,faceDown:!0,mark:_,walls:_})}else{let T=m==="silk"?kh:m==="paste"?Mh:0,_=E?c:o;l.push({...S,z:E?x-v-T:x+v+T,faceDown:E,outer:!1,thickness:v*2,offsetLayers:[_,_]})}}k1(l);let d=l.filter(u=>u.role==="dielectric"),p=d.filter(u=>!u.faceDown).sort((u,m)=>m.z-u.z)[0],b=d.filter(u=>u.faceDown).sort((u,m)=>u.z-m.z)[0];for(let u of d)u.skin=u===p||u===b;let h={dielectric:0,copper:1,mask:2,paste:3,silk:4};return l.sort((u,m)=>h[u.role]-h[m.role]),{planned:l,unmatched:f}}function k1(t){for(let e of t){if(e.role!=="mask"&&e.role!=="silk"&&e.role!=="paste")continue;let r=t.find(c=>c.role==="copper"&&c.mark&&c.faceDown===e.faceDown);if(!r)continue;let a=e.faceDown?-1:1,s=e.faceDown?r.zTop:r.zBottom,n=e.faceDown?r.zBottom:r.zTop,o=t.find(c=>c.role==="mask"&&c.faceDown===e.faceDown)?.thickness||0;e.role==="mask"?(e.coat=o,e.zLow=s+a*o):e.role==="silk"?e.zLow=s+a*(o+kh):e.z=n+a*Mh}}function Wo(t,e){let r=new Float32Array(Math.max(1,e)).fill(Number.NaN);if(ArrayBuffer.isView(t)||Array.isArray(t))for(let a=0;a<Math.min(e,t.length);a+=1)r[a]=Number(t[a]);else for(let[a,s]of Object.entries(t||{})){let n=Number(a);Number.isInteger(n)&&n>=0&&n<e&&(r[n]=Number(s))}return r}function Gr(t){let e=1/0,r=-1/0;for(let a of t)Number.isFinite(a)&&(e=Math.min(e,a),r=Math.max(r,a));return Number.isFinite(e)?[e,r]:[0,1]}function Sn(t){let e=new Map,r=1e3;for(let a of t.slices||[]){if(!(a.nx>0&&a.ny>0)||a.values.length!==a.nx*a.ny)throw new Error(`grid field slice ${a.slice_key} has ${a.values.length} values for ${a.nx} x ${a.ny} cells`);e.set(a.slice_key,{originMm:[(t.origin_x_m+a.ix0*t.dx_m)*r,(t.origin_y_m+a.iy0*t.dy_m)*r],pitchMm:[t.dx_m*r,t.dy_m*r],width:a.nx,height:a.ny,values:a.values})}return e}function Sh(t){let e=new Map;for(let a of t||[])e.has(a.slice_key)||e.set(a.slice_key,[]),e.get(a.slice_key).push(a);let r=new Map;for(let[a,s]of e){let n=Number(s[0].pitch_nm);if(!(n>0)||s.some(p=>Number(p.pitch_nm)!==n))throw new Error(`field tiles of ${a} must share one positive pitch`);let i=Math.min(...s.map(p=>p.origin_nm[0])),o=Math.min(...s.map(p=>p.origin_nm[1])),c=(p,b)=>{let h=(p-b)/n;if(!Number.isInteger(h))throw new Error(`field tile of ${a} is off its pitch grid`);return h},l=Math.max(...s.map(p=>c(p.origin_nm[0],i)+p.width)),f=Math.max(...s.map(p=>c(p.origin_nm[1],o)+p.height)),d=new Float32Array(l*f).fill(Number.NaN);for(let p of s){let b=c(p.origin_nm[0],i),h=c(p.origin_nm[1],o);for(let u=0;u<p.height;u+=1)d.set(p.values.subarray?p.values.subarray(u*p.width,(u+1)*p.width):p.values.slice(u*p.width,(u+1)*p.width),(h+u)*l+b)}r.set(a,{originMm:[i/1e6,o/1e6],pitchMm:n/1e6,width:l,height:f,values:d})}return r}var Vo=8,kn=8,wh=4294967295,E1=Object.freeze({unplated:2,tentedFront:4,tentedBack:8,coveredFront:16,coveredBack:32,pluggedFront:64,pluggedBack:128,filled:256,capped:512,castellated:1024}),Ho=16;function S1(t,e,r){let a=null;for(let s=0;t&&s+3<t.length;s+=4){let n=[t[s],t[s+1]],i=[t[s+2],t[s+3]],o=[i[0]-n[0],i[1]-n[1]],c=o[0]*o[0]+o[1]*o[1];if(c<=0)continue;let l=Math.max(0,Math.min(1,((e[0]-n[0])*o[0]+(e[1]-n[1])*o[1])/c)),f=Math.hypot(e[0]-n[0]-l*o[0],e[1]-n[1]-l*o[1]);if(f>r||a&&f>=a.distance)continue;let d=Math.sqrt(c),p=[o[1]/d,o[0]/d];a={distance:f,normal:p,offset:(p[0]*n[0]-p[1]*n[1])/1e3}}return a&&{normal:a.normal,offset:a.offset}}function Th(t,e,r,a=null){let s=(t.stack?.slices||[]).filter(b=>b.role==="conductor").sort((b,h)=>b.order-h.order),n=new Map((r||[]).filter(b=>b.role===void 0||b.role==="copper").map(b=>[b.key,b])),i=b=>{let h=n.get(b.key);if(!h)return null;if(h.zTop!==void 0)return{top:h.zTop,bottom:h.zBottom,layerId:h.layerId};let u=Number(b.thickness_nm||0)/1e9;return h.bottom?{top:h.z+u,bottom:h.z,layerId:h.layerId}:{top:h.z,bottom:h.z-u,layerId:h.layerId}},o=Math.floor(e.floats.length/Vo),c=new ArrayBuffer(o*Ho*4),l=new Float32Array(c),f=new Uint32Array(c),d=0,p=e.skipped||0;for(let b=0;b<o;b+=1){let h=e.floats.subarray(b*Vo,(b+1)*Vo),u=e.words.subarray(b*kn,(b+1)*kn),[m,g]=[Math.min(u[1],u[2]),Math.max(u[1],u[2])],y=s.filter(T=>T.order>=m&&T.order<=g&&(u[3]===wh||T.order>u[3])&&(u[4]===wh||T.order<u[4])),x=y.length?i(y[0]):null,v=y.length?i(y[y.length-1]):null;if(!x||!v){p+=1;continue}let E=d*Ho;l.set([h[0]/1e3,-h[1]/1e3,h[2]/1e3,-h[3],h[4]/1e3,h[5]/1e3,x.top,v.bottom],E),f.set([u[0],x.layerId,v.layerId,u[5]],E+8);let S=u[5]&E1.castellated?S1(a,[h[0],h[1]],h[4]+h[2]):null;l.set(S?[S.normal[0],S.normal[1],S.offset,0]:[0,0,1,0],E+12),d+=1}return{data:c.slice(0,d*Ho*4),count:d,skipped:p}}var qo=12,T1=0,A1=1;function Ah(t,e,r,a=0){let s=(r||[]).filter(b=>b.role==="soldermask").map(b=>Number(b.z_mm)/1e3+a+Math.sign(Number(b.z_mm))*Number(b.thickness_mm||0)/2e3),n=s.length?Math.max(...s):null,i=s.length?Math.min(...s):null,o=t.filter(b=>b.role==="dielectric"&&b.face==="top"&&e.get(b.key)?.contourEdges?.length),c=[],l=(b,h,u,m,g,y)=>{let x=e.get(b.key).contourEdges;for(let v=0;v+3<x.length;v+=4)c.push([x[v],x[v+1],x[v+2],x[v+3],h,u,m,g,y])};for(let b of o)l(b,b.zTop,b.zBottom,b.offsetLayers[0],b.offsetLayers[1],T1);for(let b of t.filter(h=>h.role==="copper"&&h.face==="top")){let h=v=>Math.min(Math.abs(v.zBottom-b.zTop),Math.abs(v.zTop-b.zBottom)),u=[...o].sort((v,E)=>h(v)-h(E))[0];if(!u)continue;let m=b.outer&&!b.bottom,g=b.outer&&b.bottom,y=m&&n!=null?Math.max(n,b.zTop):b.zTop,x=g&&i!=null?Math.min(i,b.zBottom):b.zBottom;l(u,y,x,b.layerId,b.layerId,A1)}let f=new ArrayBuffer(c.length*qo*4),d=new Float32Array(f),p=new Uint32Array(f);return c.forEach(([b,h,u,m,g,y,x,v,E],S)=>{d.set([b/1e3,-h/1e3,u/1e3,-m/1e3,g,y,0,0],S*qo),p.set([x,v,E,0],S*qo+8)}),{data:f,count:c.length}}function _h(t,e){let r=new Map;for(let o of e||[])for(let c of o?.aliases||[])r.has(String(c))||r.set(String(c),Number(o.id));for(let o of e||[])o?.name&&r.set(String(o.name),Number(o.id));let a=t.header.nets||[];if(typeof t.netIndices=="function"){let o=new Uint32Array(a.length+1);a.forEach((f,d)=>{o[d+1]=r.get(f.name??f.key)||r.get(f.key)||0});let c=t.netIndices(),l=new Uint32Array(c.length);for(let f=0;f<c.length;f+=1)l[f]=o[c[f]];return l}let s=new Map(a.map(o=>[o.key,o.name])),n=zr(t.header),i=new Uint32Array(n);for(let o=0;o<n;o+=1){let c=t.binding(o)?.net_key;c&&(i[o]=r.get(s.get(c)??c)||0)}return i}var Ih={Uint32Array,Float32Array},Ua=".board";function Rh(t,e,r){return{header:t,barrelFloats:e.floats,barrelWords:e.words,barrelSkipped:e.skipped,netIndices:r}}function Tn(t,e,r,a){return`analytic-lowered-a1/${t}/${e}/${r}/${a}`}function _1(t){let e=[],r=[];for(let[f,d]of Object.entries(t)){if(!ArrayBuffer.isView(d))continue;let p=d.constructor.name;if(!Ih[p])throw new TypeError(`cannot cache a ${p} (${f})`);e.push({name:f,kind:p,length:d.length}),r.push(new Uint8Array(d.buffer,d.byteOffset,d.byteLength))}let a=Object.fromEntries(Object.entries(t).filter(([,f])=>!ArrayBuffer.isView(f))),s=new TextEncoder().encode(JSON.stringify({fields:e,rest:a})),n=Math.ceil(s.length/4)*4,i=8+n+r.reduce((f,d)=>f+Math.ceil(d.length/4)*4,0),o=new Uint8Array(i),c=new DataView(o.buffer);c.setUint32(0,1280527440,!0),c.setUint32(4,s.length,!0),o.set(s,8);let l=8+n;for(let f of r)o.set(f,l),l+=Math.ceil(f.length/4)*4;return o}function An(t){let e=t instanceof Uint8Array?t:new Uint8Array(t);if(e.length<8)return null;let r=new DataView(e.buffer,e.byteOffset,e.byteLength);if(r.getUint32(0,!0)!==1280527440)return null;let a=r.getUint32(4,!0),s;try{s=JSON.parse(new TextDecoder().decode(e.subarray(8,8+a)))}catch{return null}let n={...s.rest},i=8+Math.ceil(a/4)*4;for(let{name:o,kind:c,length:l}of s.fields){let f=Ih[c];if(!f)return null;let d=l*f.BYTES_PER_ELEMENT;if(i+d>e.length||(e.byteOffset+i)%f.BYTES_PER_ELEMENT)return null;n[o]=new f(e.buffer,e.byteOffset+i,l),i+=Math.ceil(d/4)*4}return n}async function za(t,{cacheKey:e,wasmKey:r,toleranceNm:a},s){let n=new Map;return!t?.read||!e||await Promise.all(s.map(async i=>{try{let o=await t.read(Tn(e,r,a,i)),c=o?An(o):null;c&&n.set(i,c)}catch{}})),n}function Xo(t,{cacheKey:e,wasmKey:r,toleranceNm:a},s){return!t?.write||!e?Promise.resolve():Promise.all([...s].map(([n,i])=>t.write(Tn(e,r,a,n),i instanceof Uint8Array?i:_1(i)).catch(()=>{}))).then(()=>{})}function Nh(t,e,r){return`analytic-lowered-a1/${t}/${e}/${r}/.complete`}async function Ch(t,{cacheKey:e,wasmKey:r,toleranceNm:a}){if(!t?.read||!e)return!1;try{return!!await t.read(Nh(e,r,a))}catch{return!1}}async function Bh(t,{cacheKey:e,wasmKey:r,toleranceNm:a},s=Promise.resolve()){!t?.write||!e||(await s,await t.write(Nh(e,r,a),new Uint8Array([1])).catch(()=>{}))}var I1="prism-semantic-viewer-lower.js",_n=3;function R1(){if(typeof Worker>"u")return null;try{let t=new URL(import.meta.url),e=t.searchParams.get("v");return new URL(`${I1}${e?`?v=${e}`:""}`,t)}catch{return null}}function In(t,e=globalThis.navigator?.hardwareConcurrency||4){return Math.max(1,Math.min(_n,Math.max(1,e-1),t))}function N1(t,e,r){let a=Array.from({length:Math.max(1,r)},()=>({keys:[],load:0})),s=new Map(t.map((i,o)=>[i,o])),n=[...t].sort((i,o)=>(e.get(o)||1)-(e.get(i)||1)||s.get(i)-s.get(o));for(let i of n){let o=a.reduce((c,l)=>l.load<c.load?l:c,a[0]);o.keys.push(i),o.load+=e.get(i)||1}return a.filter(i=>i.keys.length).map(i=>i.keys.sort((o,c)=>s.get(o)-s.get(c)))}function Oh(t){let e=new Map;for(let r of t?.chunks||[])e.set(r.slice_key,(e.get(r.slice_key)||0)+Number(r.operation_count||0));return e}var $o=new Map;function C1(t){if(!$o.has(t)){let e=typeof WebAssembly?.compileStreaming=="function"&&typeof fetch=="function"?WebAssembly.compileStreaming(fetch(t)).catch(()=>null):Promise.resolve(null);$o.set(t,e)}return $o.get(t)}var Ga=class t{static start(e,r,a=In(_n)){let s=R1();if(!s||typeof r!="string")return null;let n=[],i=C1(r);for(let o=0;o<a;o+=1){let c;try{c=new Worker(s,{type:"module",name:`analytic-lower-${o}`})}catch{break}let l={worker:c,pending:new Map,alive:!0};c.onmessage=({data:d})=>{let p=l.pending.get(d.id);l.pending.delete(d.id),p?.(d)},c.onerror=d=>{d.preventDefault?.(),l.alive=!1;for(let p of l.pending.values())p({error:"worker failed"});l.pending.clear()},l.opened=new Promise(d=>l.pending.set(0,p=>d(p.error?null:p.header)));let f=(e instanceof Uint8Array?e:new Uint8Array(e)).slice();i.then(d=>c.postMessage({type:"open",bytes:f.buffer,wasmUrl:r,wasmModule:d},[f.buffer])),n.push(l)}return n.length?new t(n):null}constructor(e){this.members=e,this.nextId=1}async header(){for(let e of this.members){let r=await e.opened;if(r&&e.alive)return r}return null}async host(){for(let e of this.members)if(await e.opened&&e.alive)return e;return null}async ask(e,r={},a=[],s=null){let n=s||await this.host();if(!n)throw new Error("no lowering worker has the pack open");return new Promise((i,o)=>{let c=this.nextId++;n.pending.set(c,l=>l.error?o(new Error(l.error)):i(l)),n.worker.postMessage({type:e,id:c,...r},a)})}async steps(e,r=null,a=[]){let s=[];for(let o of this.members)await o.opened&&o.alive&&s.push(o);let n=(o,c)=>Object.fromEntries(c.map(l=>[l,ArrayBuffer.isView(o[l])?o[l].slice():o[l]])),i=["shapes","subtractShapes","contourEdges","contourEdgeOperations","outlineEdges","outlineShapes"];return Promise.all(e.map(([o,c],l)=>{if(!s.length)return null;let f={key:a[l],store:r?.identity??null,copper:n(o,i),mask:n(c,["shapes","subtractShapes"])},d=s[l%s.length];return r&&r.writes.push(this.stored(d,this.nextId,r)),this.ask("step",f,[],d).then(p=>p.step,()=>null)}))}stored(e,r,a){return new Promise(s=>e.pending.set(-r,n=>{for(let[i,o]of n.stored||[])a.adopt(i,o);s()}))}async release(){let e=await this.host();for(let r of this.members)r!==e&&r.worker.terminate();this.members=e?[e]:[]}async lower(e,r,a=new Map,s=null){if(!e.length)return new Map;let n=await Promise.all(this.members.map(f=>f.opened)),i=this.members.filter((f,d)=>n[d]&&f.alive);if(!i.length)return null;let o=N1(e,a,i.length),c=await Promise.all(o.map((f,d)=>new Promise(p=>{let b=i[d],h=this.nextId++;s&&s.writes.push(this.stored(b,h,s)),b.pending.set(h,u=>p(u.error?null:new Map(Object.entries(u.lowered)))),b.worker.postMessage({type:"lower",id:h,keys:f,toleranceNm:r,store:s?.identity??null})})));if(c.every(f=>f===null))return null;let l=new Map;for(let f of c)for(let[d,p]of f||[])l.set(d,p);return l}close(){for(let e of this.members)e.worker.terminate();this.members=[]}};async function Fh(t){let e=await t.header();if(!e)return null;let r=zr(e);return{header:e,hosted:!0,async barrels(){return(await t.ask("barrels")).barrels},async netIndices(){return(await t.ask("netIndices",{count:r})).indices},async binding(a){return(await t.ask("binding",{index:a})).binding},free(){t.close()}}}function Ph(t,e){return{header:t.header,hosted:!0,async barrels(){return{floats:t.barrelFloats,words:t.barrelWords,skipped:t.barrelSkipped}},async netIndices(){return t.netIndices},async binding(r){if(!e)throw new Error("no worker holds the pack");return(await e.ask("binding",{index:r})).binding},free(){e?.close()}}}async function jh(t,e,r,a,{weights:s=new Map,workers:n}={}){if(!e.length)return new Map;let i=Ga.start(t,a,n??In(e.length));if(!i)return null;try{return await i.lower(e,r,s)}finally{i.close()}}function Lh(t,e){let r=new Float32Array(t.buffer,t.byteOffset+e*20*4,20),[a,s,n,i,o,c]=[r[4],r[5],r[6],r[7],r[8],r[9]],l=[1/0,1/0,-1/0,-1/0];for(let[f,d]of[[r[10],r[11]],[r[12],r[11]],[r[10],r[13]],[r[12],r[13]]]){let p=a*f+s*d+o,b=n*f+i*d+c;l[0]=Math.min(l[0],p),l[1]=Math.min(l[1],b),l[2]=Math.max(l[2],p),l[3]=Math.max(l[3],b)}return l}function Uh(t){let e=t.contourEdges||new Float32Array(0),r=t.contourEdgeOperations||new Uint32Array(0),a=t.shapeCuts||new Uint32Array(0),s=t.edgeCuts||new Uint32Array(0),n=t.cutIndices||new Uint32Array(0),i=a.length,o=new Uint32Array(Math.max(1,i+n.length));for(let m=0;m<i;m+=2)o[m]=a[m]+i,o[m+1]=a[m+1];o.set(n,i);let c=t.outlineEdges||new Float32Array(0),l=t.outlineShapes||new Uint32Array(0),f=Math.min(e.length/4,r.length),d=new Uint32Array(Math.max(1,f+l.length)*7),p=new Uint32Array(e.buffer,e.byteOffset,e.length),b=0;for(let m=0;m<f;m+=1){if(r[m]&2147483648)continue;let g=b*7;d[g]=p[m*4],d[g+1]=p[m*4+1],d[g+2]=p[m*4+2],d[g+3]=p[m*4+3],d[g+4]=r[m],d[g+5]=(s[m*2]??0)+i,d[g+6]=s[m*2+1]??0,b+=1}let h=b,u=new Uint32Array(c.buffer,c.byteOffset,c.length);for(let m=0;m<l.length;m+=1){let g=b*7;d[g]=u[m*4],d[g+1]=u[m*4+1],d[g+2]=u[m*4+2],d[g+3]=u[m*4+3],d[g+4]=(1073741824|l[m])>>>0,b+=1}return{edgeWords:d,cutWords:o,regionEdges:h,skirtEdges:b-h}}function Qo(t){return t.edgeWords?t:Object.assign(t,Uh(t))}function zh(t,e,r=.05){let a=e.shapes.subarray(0,e.subtractShapes*20),s=t.shapes.length/20,n=new Uint32Array(t.shapes.length+a.length);n.set(t.shapes),n.set(a,t.shapes.length);let i=a.length/20,o=new Float64Array(i*4),[c,l,f,d]=[1/0,1/0,-1/0,-1/0];for(let R=0;R<i;R+=1){let j=Lh(a,R);o.set(j,R*4),c=Math.min(c,j[0]),l=Math.min(l,j[1]),f=Math.max(f,j[2]),d=Math.max(d,j[3])}let[p,b]=[Math.floor(c),Math.floor(l)],h=i?Math.floor(f)-p+1:0,u=i?Math.floor(d)-b+1:0,m=(R,j,q)=>Math.min(q-1,Math.max(0,Math.floor(R)-j)),g=new Uint32Array(h*u+1),y=(R,j)=>{let[q,Y]=[m(o[R*4],p,h),m(o[R*4+2],p,h)],[te,ye]=[m(o[R*4+1],b,u),m(o[R*4+3],b,u)];for(let ne=q;ne<=Y;ne+=1)for(let me=te;me<=ye;me+=1)j(ne*u+me)};for(let R=0;R<i;R+=1)y(R,j=>{g[j+1]+=1});for(let R=0;R<h*u;R+=1)g[R+1]+=g[R];let x=new Uint32Array(g[h*u]),v=g.slice(0,h*u);for(let R=0;R<i;R+=1)y(R,j=>{x[v[j]++]=R});let E=[],S=[],T=new Uint32Array(i),_=0,I=(R,j,q,Y)=>{let te=E.length;if(_+=1,i&&Math.floor(q)>=p&&Math.floor(R)<=p+h-1&&Math.floor(Y)>=b&&Math.floor(j)<=b+u-1){let[ye,ne]=[m(R,p,h),m(q,p,h)],[me,Ie]=[m(j,b,u),m(Y,b,u)];for(let be=ye;be<=ne;be+=1)for(let Ce=me;Ce<=Ie;Ce+=1){let xe=be*u+Ce;for(let De=g[xe];De<g[xe+1];De+=1){let Be=x[De];T[Be]!==_&&(T[Be]=_,o[Be*4]<=q&&R<=o[Be*4+2]&&o[Be*4+1]<=Y&&j<=o[Be*4+3]&&E.push(s+Be))}}}S.push(te,E.length-te)};for(let R=t.subtractShapes;R<s;R+=1){let j=Lh(t.shapes,R);I(j[0]-r,j[1]-r,j[2]+r,j[3]+r)}let N=s-t.subtractShapes,C=t.contourEdges||new Float32Array(0);for(let R=0;R+3<C.length;R+=4)I(Math.min(C[R],C[R+2])-r,Math.min(C[R+1],C[R+3])-r,Math.max(C[R],C[R+2])+r,Math.max(C[R+1],C[R+3])+r);let B=Uh({...t,shapeCuts:new Uint32Array(S.slice(0,N*2)),edgeCuts:new Uint32Array(S.slice(N*2)),cutIndices:new Uint32Array(E)});return{shapes:n,...B}}function Gh(t){let e=[];for(let r of t){if(r.role!=="mask"||r.zLow===void 0)continue;let a=t.find(s=>s.role==="copper"&&s.mark&&s.faceDown===r.faceDown);a&&e.push([r,a])}return e}function Rn(t,e){return`step:${t.key}:${e.key}`}function Kh(t){let e=t.contourEdges||new Float32Array(0),r=t.contourEdgeOperations||new Uint32Array(0),a=[];for(let d=0;d<r.length&&d*4+3<e.length;d+=1)r[d]&2147483648||a.push(d);if(!a.length)return null;let[s,n]=[e[a[0]*4],e[a[0]*4+1]],i=new Float32Array(a.length*6),o=[1/0,1/0,-1/0,-1/0],c=new Float32Array(a.length*4),l=new Uint32Array(a.length);a.forEach((d,p)=>{let[b,h,u,m]=e.subarray(d*4,d*4+4);i.set([s,n,b,h,u,m],p*6),c.set([b,h,u,m],p*4),l[p]=r[d],o[0]=Math.min(o[0],b,u),o[1]=Math.min(o[1],h,m),o[2]=Math.max(o[2],b,u),o[3]=Math.max(o[3],h,m)});let f=new Uint32Array(6);return f[0]=r[a[0]],f.set(new Uint32Array(Float32Array.from(o).buffer),2),Qo({shapes:new Uint32Array(0),subtractShapes:0,fanVertices:i,covers:f,batches:new Uint32Array([0,0,a.length*3,0,1]),contourEdges:c,contourEdgeOperations:l})}var Cn={color:{srcFactor:"src-alpha",dstFactor:"one-minus-src-alpha"},alpha:{srcFactor:"one",dstFactor:"one-minus-src-alpha"}};function ec(t){let e=Float32Array.from(t);for(let r=0;r<e.length;r+=1)Number.isFinite(e[r])||(e[r]=3e38);return e}var Nn=2,O1=5e-4,F1={mask:"soldermask",silk:"silkscreen",paste:"paste"};function P1(t,e){let r=F1[e.role];return!!(t?.size&&r)&&t.has(L1(r,e.faceDown?"back":"front"))}function j1(t,e){let r=e?.soldermask?.front;return!t.soldermask&&r?.length>=3&&(t.soldermask={color:r,metallic:0,roughness:.6}),!t.paste&&e?.paste?.length>=3&&(t.paste={color:e.paste,metallic:0,roughness:.45}),!t.silkscreen&&e?.silkscreen?.length>=3&&(t.silkscreen={color:e.silkscreen,metallic:0,roughness:.8}),t}function L1(t,e){return`${t}:${e}`}var $h=.3,Yh=new WeakMap,Jh=new WeakMap;function Zh(t){let e=Yh.get(t);return e||(e={layout:t.createBindGroupLayout({label:"analytic",entries:[{binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}},{binding:1,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}},{binding:2,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:"read-only-storage"}},{binding:3,visibility:GPUShaderStage.VERTEX,buffer:{type:"read-only-storage"}},{binding:4,visibility:GPUShaderStage.FRAGMENT,buffer:{type:"read-only-storage"}},{binding:5,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:"unfilterable-float"}},{binding:6,visibility:GPUShaderStage.FRAGMENT,buffer:{type:"read-only-storage"}},{binding:7,visibility:GPUShaderStage.FRAGMENT,buffer:{type:"read-only-storage"}},{binding:8,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:"read-only-storage"}},{binding:9,visibility:GPUShaderStage.FRAGMENT,buffer:{type:"read-only-storage"}},{binding:10,visibility:GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}},{binding:11,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:"uint"}}]}),module:t.createShaderModule({label:"analytic",code:Qd})},Yh.set(t,e)),e}function Qh(t){let e=Zh(t.device);return{device:t.device,depthFormat:t.depthFormat,stencil:t.stencil,samples:t.sampleCount||1,layout:e.layout,module:e.module}}function rc(t){return`${t.format}|${t.sampleCount||1}|${t.depthFormat}|${t.stencil?1:0}`}function ac(t){let e=Jh.get(t);return e||(e=new Map,Jh.set(t,e)),e}function D1(t){return ac(t.device).get(rc(t))?.ready||null}function U1(t,e){let r=ac(t.device),a=rc(t);return r.get(a)?.ready||r.set(a,{ready:e,promise:Promise.resolve(e)}),e}function tc(t,e,r,a){let s=t.device.createPipelineLayout({bindGroupLayouts:[t.layout]}),n=(o,c,l,f,d=[],p=!1,b="none")=>{let h=zs[f],u={format:t.depthFormat,depthWriteEnabled:h.depth,depthCompare:h.depth||h.depthTest?"greater":"always"};return t.stencil&&Object.assign(u,{stencilFront:h.face,stencilBack:h.face,stencilReadMask:h.read,stencilWriteMask:h.write}),a({label:`analytic-${o}${r?"-pick":""}`,layout:s,vertex:{module:t.module,entryPoint:c,buffers:d},fragment:{module:t.module,entryPoint:r?`${l}_pick`:l,...r?{}:{constants:{SAMPLES:t.samples}},targets:[{format:e,writeMask:h.color?GPUColorWrite.ALL:0,...p&&!r?{blend:Cn}:{}}]},primitive:{topology:"triangle-list",cullMode:b},depthStencil:u,multisample:{count:r?1:t.samples}})},i=[{arrayStride:8,attributes:[{shaderLocation:0,offset:0,format:"float32x2"}]}];return{shapeMask:n("shape-mask","vs_shape","fs_shape_mask","shapeMask"),shapeAdd:n("shape","vs_shape","fs_shape","shapeAdd"),fan:n("fan","vs_fan","fs_plain_mask","fan",i),coverSubtract:n("cover-subtract","vs_cover","fs_plain_mask","coverSubtract"),coverMark:n("cover-mark","vs_cover","fs_plain_mask","coverMark"),coverAdd:n("cover","vs_cover","fs_cover","coverAdd"),coverClear:n("cover-clear","vs_cover","fs_plain_mask","coverClear"),clear:n("clear","vs_clear","fs_plain_mask","clear"),regionWall:n("region-wall","vs_region_wall","fs_region_wall","solid"),skirt:n("skirt","vs_skirt","fs_skirt","solid"),...r?{}:{shapeLay:n("shape-lay","vs_shape","fs_shape_mask","shapeLay"),coverLay:n("cover-lay","vs_cover","fs_cover_mask","coverLay"),shapeBlend:n("shape-blend","vs_shape","fs_shape","shapeBlend",[],!0),coverBlend:n("cover-blend","vs_cover","fs_cover","coverBlend",[],!0),tintCovered:n("tint-covered","vs_clear","fs_tint_covered","tintCovered",[],!0),tintPlain:n("tint-plain","vs_clear","fs_tint_plain","tintPlain",[],!0),footShape:n("foot-shape","vs_shape","fs_shape_mask","footShape"),footCover:n("foot-cover","vs_cover","fs_cover_mask","footCover"),tintHigh:n("tint-high","vs_clear","fs_tint_covered","tintHigh",[],!0),tintLow:n("tint-low","vs_clear","fs_tint_plain","tintLow",[],!0),regionStep:n("region-step","vs_region_step","fs_region_step","coat"),step:n("step","vs_step","fs_step","coat"),clearLay:n("clear-lay","vs_clear","fs_plain_mask","clearLay"),clearFoot:n("clear-foot","vs_clear","fs_plain_mask","clearFoot"),shapeOnFoot:n("shape-on-foot","vs_shape","fs_shape","shapeOnFoot",[],!0),shapeOffFoot:n("shape-off-foot","vs_shape","fs_shape","shapeOffFoot",[],!0),coverOnFoot:n("cover-on-foot","vs_cover","fs_cover","coverOnFoot",[],!0),coverOffFoot:n("cover-off-foot","vs_cover","fs_cover","coverOffFoot",[],!0)}}}var gr=class{constructor(e){this.renderer=e,this.device=e.device,this.stencil=e.stencil,this.samples=e.sampleCount||1,this.slices=[],this.skin=null,this.eye=null,this.viewMatrix=null,this.extent=null,this.overlay={mode:0,range:[0,1]};let r=Zh(this.device);this.layout=r.layout,this.module=r.module,this.boardClip=null,this.emptyClip=this.device.createTexture({label:"analytic-clip-none",size:[1,1],format:"r8uint",usage:GPUTextureUsage.TEXTURE_BINDING}),this.palette=this.device.createBuffer({label:"analytic-palette",size:8208,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),this.style=zo(Ia),this.writePalette(),this.pipelines=D1(e)||U1(e,{color:this.makePipelines(e.format,!1),pick:this.makePipelines("rg32uint",!0)}),this.emptyValues=this.buffer(new Float32Array([3e38]),GPUBufferUsage.STORAGE,"analytic-values-empty"),this.valuesBuffer=this.emptyValues,this.emptyField=this.fieldTexture(1,1,new Float32Array([3e38])),this.uniformScratch=new ArrayBuffer(256),this.netsBuffer=this.buffer(new Uint32Array(1),GPUBufferUsage.STORAGE,"analytic-nets"),this.makeBarrelPipelines(),this.makeArrowPipeline()}makeArrowPipeline(){this.arrowLayout=this.device.createBindGroupLayout({label:"analytic-arrows",entries:[{binding:0,visibility:GPUShaderStage.VERTEX,buffer:{type:"uniform"}},{binding:1,visibility:GPUShaderStage.VERTEX,buffer:{type:"read-only-storage"}},{binding:2,visibility:GPUShaderStage.VERTEX,buffer:{type:"read-only-storage"}},{binding:3,visibility:GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}},{binding:4,visibility:GPUShaderStage.VERTEX,buffer:{type:"read-only-storage"}}]}),this.drawnLayers=new Uint32Array(256),this.drawnLayersBuffer=this.buffer(this.drawnLayers,GPUBufferUsage.STORAGE,"analytic-drawn-layers");let e=this.device.createShaderModule({label:"analytic-arrows",code:su});this.arrowPipeline=this.device.createRenderPipeline({label:"analytic-arrow",layout:this.device.createPipelineLayout({bindGroupLayouts:[this.arrowLayout]}),vertex:{module:e,entryPoint:"vs_arrow"},fragment:{module:e,entryPoint:"fs_arrow",targets:[{format:this.renderer.format,blend:Cn}]},primitive:{topology:"triangle-list",cullMode:"none"},depthStencil:{format:this.renderer.depthFormat,depthWriteEnabled:!1,depthCompare:"greater-equal"},multisample:{count:this.samples}}),this.arrows=null}writePalette(){let e=new Float32Array(8208/4);e.set(Uo(this.style.fieldColormap,Lr),0),e.set(Uo(this.style.arrowColormap,Lr),Lr*4),e.set(this.style.arrowOutline,2*Lr*4),this.device.queue.writeBuffer(this.palette,0,e),this.renderer.invalidate?.()}setStyle(e){return this.style=zo(e,this.style),this.writePalette(),this.style}setArrows(e){this.arrows?.buffer.destroy(),this.arrows=e?.count?{buffer:this.buffer(new Uint8Array(e.data),GPUBufferUsage.STORAGE,"analytic-arrows"),count:e.count}:null,this.arrows&&(this.arrows.bindGroup=this.device.createBindGroup({layout:this.arrowLayout,entries:[{binding:0,resource:{buffer:this.renderer.globalBuffer}},{binding:1,resource:{buffer:this.arrows.buffer}},{binding:2,resource:{buffer:this.layerOffsets}},{binding:3,resource:{buffer:this.palette}},{binding:4,resource:{buffer:this.drawnLayersBuffer}}]})),this.renderer.invalidate?.()}encodeArrows(e){return this.arrows?(this.device.queue.writeBuffer(this.drawnLayersBuffer,0,this.drawnLayers),e.setPipeline(this.arrowPipeline),e.setBindGroup(0,this.arrows.bindGroup),e.draw(9,2*this.arrows.count),1):0}makeBarrelPipelines(){let e=GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT;this.barrelLayout=this.device.createBindGroupLayout({label:"analytic-barrels",entries:[{binding:0,visibility:e,buffer:{type:"uniform"}},{binding:1,visibility:e,buffer:{type:"uniform"}},{binding:2,visibility:e,buffer:{type:"read-only-storage"}},{binding:3,visibility:GPUShaderStage.FRAGMENT,buffer:{type:"read-only-storage"}},{binding:4,visibility:e,buffer:{type:"read-only-storage"}},{binding:5,visibility:e,buffer:{type:"read-only-storage"}},{binding:6,visibility:e,buffer:{type:"read-only-storage"}},{binding:7,visibility:GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}}]});let r=this.device.createShaderModule({label:"analytic-barrels",code:ru}),a=this.device.createPipelineLayout({bindGroupLayouts:[this.barrelLayout]}),s=(o,c)=>this.device.createRenderPipeline({label:`analytic-barrel${c?"-pick":""}`,layout:a,vertex:{module:r,entryPoint:"vs_barrel",constants:{PICK_PASS:c?1:0}},fragment:{module:r,entryPoint:c?"fs_barrel_pick":"fs_barrel",targets:[{format:o}],constants:{PICK_PASS:c?1:0}},primitive:{topology:"triangle-list",cullMode:"back"},depthStencil:{format:this.renderer.depthFormat,depthWriteEnabled:!0,depthCompare:"greater"},multisample:{count:c?1:this.samples}});this.barrelPipelines={color:s(this.renderer.format,!1),pick:s("rg32uint",!0)},this.ghostPipeline=this.device.createRenderPipeline({label:"analytic-ghost-barrel",layout:a,vertex:{module:r,entryPoint:"vs_ghost"},fragment:{module:r,entryPoint:"fs_ghost",targets:[{format:this.renderer.format,blend:Cn}]},primitive:{topology:"triangle-list",cullMode:"none"},depthStencil:{format:this.renderer.depthFormat,depthWriteEnabled:!1,depthCompare:"greater"},multisample:{count:this.samples}}),this.barrelView=this.device.createBuffer({label:"analytic-barrel-view",size:so,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),this.layerOffsets=this.device.createBuffer({label:"analytic-layer-offsets",size:256*4,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),this.viewScratch=new ArrayBuffer(so),this.barrels=null;let n=this.device.createShaderModule({label:"analytic-walls",code:au}),i=o=>this.device.createRenderPipeline({label:`analytic-wall${o?"-blend":""}`,layout:a,vertex:{module:n,entryPoint:"vs_wall"},fragment:{module:n,entryPoint:"fs_wall",targets:[{format:this.renderer.format,...o?{blend:Cn}:{}}]},primitive:{topology:"triangle-list",cullMode:"none"},depthStencil:{format:this.renderer.depthFormat,depthWriteEnabled:!0,depthCompare:"greater"},multisample:{count:this.samples}});this.wallPipelines={opaque:i(!1),blend:i(!0)},this.walls=null}setWalls({data:e,count:r}){this.walls?.buffer.destroy(),this.walls=r?{buffer:this.buffer(new Uint8Array(e),GPUBufferUsage.STORAGE,"analytic-walls"),count:r,bindGroup:null}:null,this.walls&&(this.walls.bindGroup=this.wallBindGroup()),this.renderer.invalidate?.()}wallBindGroup(){return this.device.createBindGroup({layout:this.barrelLayout,entries:[{binding:0,resource:{buffer:this.renderer.globalBuffer}},{binding:1,resource:{buffer:this.barrelView}},{binding:2,resource:{buffer:this.walls.buffer}},{binding:3,resource:{buffer:this.valuesBuffer}},{binding:4,resource:{buffer:this.layerOffsets}},{binding:5,resource:{buffer:this.netsBuffer}},{binding:6,resource:{buffer:this.renderer.netMaskBuffer}},{binding:7,resource:{buffer:this.palette}}]})}encodeWalls(e,r){return this.walls?(e.setPipeline(r?this.wallPipelines.blend:this.wallPipelines.opaque),e.setBindGroup(0,this.walls.bindGroup),e.draw(6,this.walls.count),1):0}writeView(e,r,a={}){let s=new Float32Array(256);r&&s.set(r.subarray?r.subarray(0,256):r.slice(0,256)),this.device.queue.writeBuffer(this.layerOffsets,0,s);let n=new Float32Array(this.viewScratch),i=new Uint32Array(this.viewScratch);n.fill(0),this.eye=z1(e),this.viewMatrix=e,n.set(this.eye,0),n.set(this.renderer.barrelColor||[.55,.35,.16,1],4);let o=this.laminateColor()||this.boardLooks().substrate?.color||[.3,.32,.25,1],c=(a.boardOpacity??1)*(.15+.85*(a.assemblyOpacity??1));n.set([...o.slice(0,3),c],8);let l=this.overlay.mode===1||this.overlay.mode===2&&this.valuesBuffer!==this.emptyValues;i[12]=l?1:0,i[13]=a.isolateNet?1:0,i[14]=this.boardShown(a)?1:0,i[15]=this.boardShown(a)&&(a.boardOpacity??1)>=.999&&this.renderer.innerCopperMode!=="all"?1:0,n.set(this.overlay.range,16),this.separated=!!r&&Array.prototype.some.call(r,f=>Math.abs(f)>1e-12),i[18]=this.separated?1:0,n.set(this.edgePlated?[...(this.renderer.barrelColor||[.55,.35,.16]).slice(0,3),c]:[...o.slice(0,3),c],20),n.set([...(this.boardLooks().soldermask?.color||[.06,.16,.11]).slice(0,3),1],24),this.device.queue.writeBuffer(this.barrelView,0,this.viewScratch)}setBarrels({data:e,count:r,skipped:a=0}){this.barrels?.buffer.destroy(),this.barrels=r?{buffer:this.buffer(new Uint8Array(e),GPUBufferUsage.STORAGE,"analytic-barrels"),count:r,skipped:a,bindGroup:null}:null,this.barrels&&(this.barrels.bindGroup=this.barrelBindGroup()),this.renderer.invalidate?.()}hasBarrels(){return!!this.barrels}barrelBindGroup(){return this.device.createBindGroup({layout:this.barrelLayout,entries:[{binding:0,resource:{buffer:this.renderer.globalBuffer}},{binding:1,resource:{buffer:this.barrelView}},{binding:2,resource:{buffer:this.barrels.buffer}},{binding:3,resource:{buffer:this.valuesBuffer}},{binding:4,resource:{buffer:this.layerOffsets}},{binding:5,resource:{buffer:this.netsBuffer}},{binding:6,resource:{buffer:this.renderer.netMaskBuffer}},{binding:7,resource:{buffer:this.palette}}]})}encodeBarrels(e,r,a,s=!1){return this.barrels?(a&&this.writeView(a,r,this.context),e.setPipeline(s?this.barrelPipelines.pick:this.barrelPipelines.color),e.setBindGroup(0,this.barrels.bindGroup),e.draw(36,this.barrels.count),1):0}encodeGhostBarrels(e){return!this.barrels||!this.separated?0:(e.setPipeline(this.ghostPipeline),e.setBindGroup(0,this.barrels.bindGroup),e.draw(tu,this.barrels.count),1)}buffer(e,r,a){let s=Math.max(16,Math.ceil(e.byteLength/4)*4),n=this.device.createBuffer({label:a,size:s,usage:r|GPUBufferUsage.COPY_DST});return e.byteLength&&this.device.queue.writeBuffer(n,0,e),n}fieldTexture(e,r,a){let s=this.device.createTexture({label:"analytic-field",size:[e,r],format:"r32float",usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST});return this.device.queue.writeTexture({texture:s},a,{bytesPerRow:e*4},[e,r]),s}makePipelines(e,r){return tc(Qh(this.renderer),e,r,a=>this.device.createRenderPipeline(a))}static prewarm(e){let r=rc(e),a=ac(e.device),s=a.get(r);if(s)return s.promise;let n=Qh(e),i=l=>e.device.createRenderPipelineAsync(l),o=async l=>Object.fromEntries(await Promise.all(Object.entries(l).map(async([f,d])=>[f,await d]))),c={ready:null,promise:null};return c.promise=Promise.all([o(tc(n,e.format,!1,i)),o(tc(n,"rg32uint",!0,i))]).then(([l,f])=>(c.ready={color:l,pick:f},c.ready)).catch(()=>(a.delete(r),null)),a.set(r,c),c.promise}setSlices(e){this.releaseSlices();let r=new Map;this.slices=e.map(o=>this.uploadSlice(o,r)),this.makePlainSlabs(r),this.makeTwins();let a=e.map(o=>o.z),s=e.flatMap(o=>[o.bounds[0],o.bounds[2]]),n=e.flatMap(o=>[o.bounds[1],o.bounds[3]]);this.extent=e.length?[[Math.min(...s)/1e3,-Math.max(...n)/1e3,Math.min(...a)],[Math.max(...s)/1e3,-Math.min(...n)/1e3,Math.max(...a)]]:null;let i=e.filter(o=>o.skin);this.skin=i.length===2?{top:Math.max(...i.map(o=>o.z)),bottom:Math.min(...i.map(o=>o.z))}:null,this.renderer.invalidate?.()}makeTwins(){this.twinBuffers?.forEach(r=>r.destroy()),this.twinBuffers=[];let e=(r,a)=>{let s={...r,...a,uniform:this.device.createBuffer({label:`analytic-twin-${r.key}`,size:256,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),field:null};return s.bindGroup=this.bindGroup(s),s};this.twins=new Map;for(let r of this.slices){if(r.zLow===void 0||r.role!=="mask"&&r.role!=="silk")continue;let a={low:e(r,{z:r.zLow})},s=r.role==="mask"&&this.slices.find(n=>n.role==="copper"&&n.mark&&n.faceDown===r.faceDown);if(s){let n=this.uploadOpenings(s,r,r.step),i=r.faceDown?s.zTop:s.zBottom;a.foot=e(s,{role:"footprint",z:r.z,dilate:O1,mark:!1,walls:!1,zTop:Math.max(r.z,i),zBottom:Math.min(r.z,i),...n})}this.twins.set(r,a)}}uploadOpenings(e,r,a=null){let s=a||zh(e.lowered,r.lowered),n=this.uploadEdges(s,`${e.key}-step`),i=this.buffer(s.shapes,GPUBufferUsage.STORAGE,`analytic-step-shapes-${e.key}`);return this.twinBuffers.push(i,n.edges,n.cuts),{...n,shapes:i}}uploadSlice(e,r=new Map){let{lowered:a}=e,s=GPUBufferUsage.STORAGE;r.has(a)||r.set(a,{shapes:this.buffer(a.shapes,s,`analytic-shapes-${e.key}`),covers:this.buffer(a.covers,s,`analytic-covers-${e.key}`),fans:a.fanVertices.length?this.buffer(a.fanVertices,GPUBufferUsage.VERTEX,`analytic-fans-${e.key}`):null,...this.uploadEdges(a,e.key)});let n={...e,...r.get(a),uniform:this.device.createBuffer({label:`analytic-slice-${e.key}`,size:256,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),shapeCount:a.shapes.length/20,subtractShapes:a.subtractShapes,batches:[],field:null};for(let i=0;i<a.batches.length;i+=5){let[o,c,l,f,d]=a.batches.subarray(i,i+5);n.batches.push({subtract:o===1,firstVertex:c,vertexCount:l,firstCover:f,coverCount:d})}return n.bindGroup=this.bindGroup(n),n}uploadEdges(e,r){let{edgeWords:a,cutWords:s,regionEdges:n,skirtEdges:i}=Qo(e);return{edges:this.buffer(a,GPUBufferUsage.STORAGE,`analytic-edges-${r}`),regionEdges:n,skirtEdges:i,cuts:this.buffer(s,GPUBufferUsage.STORAGE,`analytic-cuts-${r}`)}}bindGroup(e){return this.device.createBindGroup({layout:this.layout,entries:[{binding:0,resource:{buffer:this.renderer.globalBuffer}},{binding:1,resource:{buffer:e.uniform}},{binding:2,resource:{buffer:e.shapes}},{binding:3,resource:{buffer:e.covers}},{binding:4,resource:{buffer:this.valuesBuffer}},{binding:5,resource:(e.field?.texture||this.emptyField).createView()},{binding:6,resource:{buffer:this.netsBuffer}},{binding:7,resource:{buffer:this.renderer.netMaskBuffer}},{binding:8,resource:{buffer:e.edges}},{binding:9,resource:{buffer:e.cuts}},{binding:10,resource:{buffer:this.palette}},{binding:11,resource:(this.boardClip?.texture||this.emptyClip).createView()}]})}setBoardClipMask(e){if(!e)return this.setBoardClip(null),null;let{data:r,width:a,height:s}=e,n=Math.ceil(a/256)*256,i=n===a?r:new Uint8Array(n*s);if(i!==r)for(let c=0;c<s;c+=1)i.set(r.subarray(c*a,(c+1)*a),c*n);let o=this.device.createTexture({label:"analytic-clip",size:[a,s],format:"r8uint",usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST});return this.device.queue.writeTexture({texture:o},i,{bytesPerRow:n},[a,s]),this.setBoardClip({texture:o,originMm:e.originMm,pitchMm:e.pitchMm,width:a,height:s}),this.boardClip}setBoardClip(e){this.boardClip&&this.boardClip!==e&&this.boardClip.texture.destroy(),this.boardClip=e;for(let r of this.slices)r.bindGroup=this.bindGroup(r),r.plain&&(r.plain.bindGroup=this.bindGroup(r.plain));this.renderer.invalidate?.()}coversLayer(e){return this.slices.some(r=>r.role!==void 0?r.role==="copper"&&r.layerId===Number(e):r.layerId===Number(e))}coversRole(e){let r={substrate:"dielectric",soldermask:"mask",silkscreen:"silk",paste:"paste"}[e];return!!r&&this.slices.some(a=>a.role===r)}setOperationValues(e,r){this.clearOverlay(),this.valuesBuffer=this.buffer(ec(e),GPUBufferUsage.STORAGE,"analytic-values"),this.overlay={mode:1,range:r},this.rebind()}setFieldRasters(e,r,a=null){this.clearOverlay(),a&&(this.valuesBuffer=this.buffer(ec(a),GPUBufferUsage.STORAGE,"analytic-values"));for(let s of this.slices){let n=e.get(s.key);n&&(s.field={...n,texture:this.fieldTexture(n.width,n.height,ec(n.values))})}this.overlay={mode:2,range:r},this.rebind()}clearOverlay(){this.valuesBuffer!==this.emptyValues&&this.valuesBuffer.destroy(),this.valuesBuffer=this.emptyValues;for(let e of this.slices)e.field?.texture.destroy(),e.field=null;this.overlay={mode:0,range:[0,1]},this.rebind()}setOperationNets(e){this.netsBuffer.destroy(),this.netsBuffer=this.buffer(e.length?e:new Uint32Array(1),GPUBufferUsage.STORAGE,"analytic-nets"),this.rebind()}rebind(){this.boundNetMask=this.renderer.netMaskBuffer;for(let e of this.slices)e.bindGroup=this.bindGroup(e),e.plain&&(e.plain.bindGroup=this.bindGroup(e.plain));for(let e of this.twins?.values()||[])for(let r of Object.values(e))r.bindGroup=this.bindGroup(r);this.barrels&&(this.barrels.bindGroup=this.barrelBindGroup()),this.walls&&(this.walls.bindGroup=this.wallBindGroup()),this.renderer.invalidate?.()}writeSlice(e,r,a=null){let s=new Float32Array(this.uniformScratch),n=new Uint32Array(this.uniformScratch);s.fill(0),s.set(a?.color||e.color,0);let[i,o]=e.offsetLayers||[e.layerId,e.layerId];s[4]=e.z+.5*((r?.[i]||0)+(r?.[o]||0));let c=e.role===void 0||e.role==="copper";n[5]=c?this.overlay.mode:0;let f=(this.context||{}).isolateNet||!e.outer&&this.renderer.innerCopperMode==="lit";n[7]=c?2|(f?1:0):0;let d=c?e.field:null;if(n[6]=d?1:0,d){s.set(d.originMm,8);let[b,h]=Array.isArray(d.pitchMm)?d.pitchMm:[d.pitchMm,d.pitchMm];s[10]=b,s[11]=h,n[12]=d.width,n[13]=d.height}if(s.set(this.overlay.range,16),s.set(e.bounds,20),s.set([a?.metallic??0,a?.roughness??.72,e.faceDown??e.bottom?-1:1,c?1:0],24),e.zTop!==void 0){let b=s[4]-e.z;s.set([e.zBottom+b,e.zTop+b],28)}n[30]=e.subtractShapes||0,s[31]=e.dilate||0,this.eye&&s.set(this.eye,32);let p=e.role!=="dielectric"?this.boardClip:null;p&&(s.set(p.originMm,36),s[38]=p.pitchMm,s[39]=p.pitchMm,n[40]=p.width,n[41]=p.height,n[42]=1),this.device.queue.writeBuffer(e.uniform,0,this.uniformScratch)}copperLooks(){let e=new Map;for(let r of this.renderer.entries||[]){let a=Number(r.layerId);if(r.kind!=="copper"||e.has(a))continue;let s=r.color||r.material?.baseColor;e.set(a,{color:s&&s.length<4?[...s,1]:s,metallic:r.material?.metallic||0,roughness:r.material?.roughness??.72})}for(let[r,a]of this.renderer.copperColors||[])e.has(r)||e.set(r,{color:a.length<4?[...a,1]:a,metallic:0,roughness:.72});return e}boardLooks(){let e={};for(let r of this.renderer.entries||[]){if(r.kind!=="board"||e[r.boardRole])continue;let a=r.color||r.material?.baseColor;e[r.boardRole]={color:a&&a.length<4?[...a,1]:a,metallic:r.material?.metallic||0,roughness:r.material?.roughness??.72}}return j1(e,this.renderer.stackupLooks)}laminateColor(){return this.slices.find(e=>e.role==="dielectric"&&e.color)?.color||null}lookFor(e,r,a,s){if(e.role===void 0||e.role==="copper")return r.get(e.layerId);let n=s.boardOpacity??1,i=(c,l)=>{let f=a[c];if(!f)return null;let d=f.color||[1,1,1,1];return{...f,color:[d[0],d[1],d[2],l(Number.isFinite(d[3])?d[3]:1)]}};if(e.role==="dielectric"){let c=n*(.15+.85*(s.assemblyOpacity??1));return e.color?{...a.substrate||{metallic:0,roughness:.72},color:[...e.color.slice(0,3),c]}:i("substrate",()=>c)}let o=s.assemblyOpacity??1;return e.role==="mask"?i("soldermask",c=>Math.min(c,.72)*n*o):e.role==="silk"?i("silkscreen",c=>Math.min(c,.92)*n*o):i("paste",c=>c)}encodeInto(e,r,a,s=!1,n={}){this.context=n,this.renderer.netMaskBuffer!==this.boundNetMask&&this.rebind(),n.matrix&&this.writeView(n.matrix,r,n);let i=s?this.pipelines.pick:this.pipelines.color,o=this.copperLooks(),c=this.boardLooks(),f=this.boardShown(n)&&(n.boardOpacity??1)>=.999,d=0;s||this.drawnLayers.fill(0);for(let p of this.slices){let b=p.role===void 0||p.role==="copper";(b?a&&!a.has(p.layerId):s||p.role!=="dielectric"||!f)||b&&!p.outer&&p.role!==void 0&&this.renderer.innerCopperMode==="none"||p.role==="dielectric"&&!p.skin&&this.renderer.innerCopperMode!=="all"||this.behindBoard(p,n)||(this.encodeSlice(e,i,p,"opaque",r,this.lookFor(p,o,c,n)),!s&&b&&p.face===(p.bottom?"bottom":"top")&&(this.drawnLayers[p.layerId]=1),d+=1)}return f&&!s&&(d+=this.encodeWalls(e,!1)),this.stencil&&e.setStencilReference(1),d}boardShown(e){return(e.showBoard??!0)&&!e.panelLayer}behindBoard(e,r){if(!this.skin||!this.eye||this.renderer.innerCopperMode==="all"||!this.boardShown(r)||(r.boardOpacity??1)<.999)return!1;let[,,a,s]=this.eye,n=s?a>this.skin.top:a<0,i=s?a<this.skin.bottom:a>0;return e.faceDown?n:i}encodeBlended(e,r,a,s={}){if(!this.stencil)return 0;this.context=s;let n=this.copperLooks(),i=this.boardLooks(),o=this.boardShown(s),c=o&&(s.boardOpacity??1)<.999,l=0,f=(h,u)=>{this.behindBoard(h,s)||(this.encodeSlice(e,this.pipelines.color,h,u,r,this.lookFor(h,n,i,s)),l+=1)};for(let h of this.slices)c&&h.role==="dielectric"&&f(h,"blend");c&&(l+=this.encodeWalls(e,!0));let d=o&&(s.assemblyOpacity??1)>.01,p=h=>!P1(s.hiddenBoardLayers,h),b=new Set;for(let h of this.slices){if(h.role!=="mask"||!d||!p(h)||this.behindBoard(h,s))continue;let u=this.twins.get(h);if(!u?.foot){f(h,"mask");continue}let m=this.slices.filter(g=>g.role==="silk"&&g.faceDown===h.faceDown&&p(g)&&!this.behindBoard(g,s));for(let g of m)b.add(g);l+=this.encodeConformal(e,h,u,m,r,g=>this.lookFor(g,n,i,s))}for(let h of this.slices)h.role==="paste"&&p(h)&&!s.hidePaste&&!s.panelLayer&&(!a||a.has(h.offsetLayers?.[0]))&&f(h,"blend");for(let h of this.slices)h.role==="silk"&&d&&p(h)&&!b.has(h)&&f(h,"blend");return e.setStencilReference(1),l}encodeSlice(e,r,a,s,n,i){let o=this.drawnSlice(a),c=r===this.pipelines.pick?void 0:this.sliceRect(o,n);c!==null&&(c&&e.setScissorRect(c.x,c.y,c.width,c.height),this.encodeSliceIn(e,r,o,s,n,i),c&&e.setScissorRect(this.viewport.x,this.viewport.y,this.viewport.width,this.viewport.height))}sliceRect(e,r){let a=this.viewport,s=this.viewMatrix;if(!a||!s||!e.bounds)return;let[n,i]=e.offsetLayers||[e.layerId,e.layerId],o=.5*((r?.[n]||0)+(r?.[i]||0)),c=[e.z,e.zBottom??e.z,e.zTop??e.z,e.zLow??e.z].map(E=>E+o),[l,f,d,p]=e.bounds,[b,h,u,m]=[1/0,1/0,-1/0,-1/0];for(let E of[l/1e3,d/1e3])for(let S of[-f/1e3,-p/1e3])for(let T of[Math.min(...c),Math.max(...c)]){let _=s[3]*E+s[7]*S+s[11]*T+s[15];if(!(_>1e-9))return;let I=a.x+((s[0]*E+s[4]*S+s[8]*T+s[12])/_+1)*.5*a.width,N=a.y+(1-(s[1]*E+s[5]*S+s[9]*T+s[13])/_)*.5*a.height;b=Math.min(b,I),u=Math.max(u,I),h=Math.min(h,N),m=Math.max(m,N)}let g=Math.max(a.x,Math.floor(b-Nn)),y=Math.max(a.y,Math.floor(h-Nn)),x=Math.min(a.x+a.width,Math.ceil(u+Nn)),v=Math.min(a.y+a.height,Math.ceil(m+Nn));return x<=g||v<=y?null:{x:g,y,width:x-g,height:v-y}}encodeSliceIn(e,r,a,s,n,i){this.writeSlice(a,n,i),e.setBindGroup(0,a.bindGroup),this.stencil?this.encodeStencilled(e,r,a,s):this.encodeAddsOnly(e,r,a),s==="opaque"&&a.walls&&this.encodeSlabWalls(e,r,a)}wallPixels(e){let r=this.viewMatrix,a=this.renderer.canvas;if(!r||!this.extent||!a)return 1/0;let[s,n]=this.extent,i=[];for(let l of[s[0],n[0]])for(let f of[s[1],n[1]])for(let d of[s[2],n[2]])i.push([l,f,d]);this.eye?.[3]&&i.push(this.eye.slice(0,3).map((l,f)=>Math.min(n[f],Math.max(s[f],l/this.eye[3]))));let o=([l,f,d])=>{let p=[0,1,2,3].map(b=>r[b]*l+r[4+b]*f+r[8+b]*d+r[12+b]);return p[3]>1e-9?[p[0]/p[3],p[1]/p[3]]:null},c=0;for(let l of i){let f=o(l),d=o([l[0],l[1],l[2]+e]);if(!f||!d)return 1/0;c=Math.max(c,Math.hypot((d[0]-f[0])*a.width/2,(d[1]-f[1])*a.height/2))}return c}encodeSlabWalls(e,r,a){this.stencil&&e.setStencilReference(0),a.regionEdges&&(e.setPipeline(r.regionWall),e.draw(6,a.regionEdges,0,0)),a.skirtEdges&&this.wallPixels(a.zTop-a.zBottom)>=$h&&(e.setPipeline(r.skirt),e.draw(12,a.skirtEdges,0,a.regionEdges))}encodeAddsOnly(e,r,a){let s=a.shapeCount-a.subtractShapes;s&&(e.setPipeline(r.shapeAdd),e.draw(6,s,0,a.subtractShapes))}encodeStencilled(e,r,a,s="opaque"){let n=(i,o=zs[i].reference)=>{e.setPipeline(r[i]),e.setStencilReference(o)};this.encodeFill(e,a,n,s),s==="mask"&&(n("tintCovered"),e.draw(6),n("tintPlain"),e.draw(6)),n("clear"),e.draw(6)}encodeFill(e,r,a,s){let n=s==="footprint";r.subtractShapes&&!n&&(a("shapeMask"),e.draw(6,r.subtractShapes,0,0)),n||this.encodeBatches(e,r,!0,a,s);let i=r.shapeCount-r.subtractShapes;i&&(s==="opaque"?a("shapeAdd",r.mark?33:32):a({mask:"shapeLay",blend:"shapeBlend",footprint:"footShape",onFoot:"shapeOnFoot",offFoot:"shapeOffFoot"}[s]),e.draw(6,i,0,r.subtractShapes)),this.encodeBatches(e,r,!1,a,s)}encodeConformal(e,r,{low:a,foot:s},n,i,o){let c=this.pipelines.color,l=b=>zs[b==="step"||b==="regionStep"?"coat":b],f=(b,h=l(b).reference)=>{e.setPipeline(c[b]),e.setStencilReference(h)},d=(b,h)=>{this.writeSlice(b,i,h),e.setBindGroup(0,b.bindGroup)},p=o(r);d(s,p),this.encodeFill(e,s,f,"footprint"),d(r,p),this.encodeFill(e,r,f,"mask"),f("tintHigh"),e.draw(6),e.setBindGroup(0,s.bindGroup),s.regionEdges&&(f("regionStep"),e.draw(6,s.regionEdges,0,0)),s.skirtEdges&&this.wallPixels(s.zTop-s.zBottom)>=$h&&(f("step"),e.draw(12,s.skirtEdges,0,s.regionEdges)),e.setBindGroup(0,r.bindGroup),f("clearLay"),e.draw(6),d(a,p),this.encodeFill(e,a,f,"mask"),f("tintLow"),e.draw(6),f("clearLay"),e.draw(6);for(let b of n){let h=o(b);d(b,h),this.encodeFill(e,b,f,"onFoot"),f("clear"),e.draw(6);let u=this.twins.get(b)?.low;u&&(d(u,h),this.encodeFill(e,u,f,"offFoot"),f("clear"),e.draw(6))}return e.setBindGroup(0,r.bindGroup),f("clearFoot"),e.draw(6),e.setStencilReference(1),1+n.length}encodeBatches(e,r,a,s,n="opaque"){let i=r.batches.findLast(o=>!o.subtract);for(let o of r.batches){if(o.subtract!==a||!r.fans)continue;s("fan"),e.setVertexBuffer(0,r.fans),e.draw(o.vertexCount,1,o.firstVertex,0),!a&&n==="opaque"&&(r.mark||r.role==="dielectric")&&(s("coverMark",r.mark?65:64),e.draw(6,o.coverCount,0,o.firstCover));let c={opaque:"coverAdd",blend:"coverBlend",mask:"coverLay",footprint:"footCover",onFoot:"coverOnFoot",offFoot:"coverOffFoot"}[n];s(a?"coverSubtract":c),e.draw(6,o.coverCount,0,o.firstCover),!a&&(o!==i||n==="footprint")&&(s("coverClear"),e.draw(6,o.coverCount,0,o.firstCover))}}gpuMemoryBytes(){let e=this.valuesBuffer===this.emptyValues?0:this.valuesBuffer.size;this.barrels&&(e+=this.barrels.count*Zd),this.walls&&(e+=this.walls.count*eu);let r=new Set;for(let a of this.slices.flatMap(s=>s.plain?[s,s.plain]:[s])){for(let s of[a.shapes,a.covers,a.fans,a.uniform,a.edges,a.cuts])s&&r.add(s);a.field&&(e+=a.field.width*a.field.height*4)}for(let a of r)e+=a.size;return e}stats(){return{slices:this.slices.map(e=>({key:e.key,role:e.role||"copper",face:e.face,layerId:e.layerId,z:e.z,shapes:e.shapeCount,subtractShapes:e.subtractShapes,regionBatches:e.batches.length,fanVertices:e.lowered.fanVertices.length/2,covers:e.lowered.covers.length/6,approximations:e.lowered.stats})),overlay:this.overlay.mode,barrels:this.barrels?{count:this.barrels.count,skipped:this.barrels.skipped}:null,walls:this.walls?.count||0,gpuMemoryBytes:this.gpuMemoryBytes(),degraded:!this.stencil}}makePlainSlabs(e){let r=new Map;for(let a of this.slices){if(a.role!=="dielectric"||!a.lowered)continue;r.has(a.lowered)||r.set(a.lowered,Kh(a.lowered));let s=r.get(a.lowered);s&&(a.plain=this.uploadSlice({...a,lowered:s,plain:null},e))}}drawnSlice(e){return this.separated&&e.plain?e.plain:e}releaseSlices(){for(let r of this.twins?.values()||[])for(let a of Object.values(r))a.uniform.destroy();this.twinBuffers?.forEach(r=>r.destroy()),this.twinBuffers=[],this.twins=new Map;let e=new Set;for(let r of this.slices.flatMap(a=>a.plain?[a,a.plain]:[a])){for(let a of[r.shapes,r.covers,r.fans,r.uniform,r.edges,r.cuts])a&&e.add(a);r.field?.texture.destroy()}for(let r of e)r.destroy();this.slices=[]}destroy(){this.releaseSlices(),this.barrels?.buffer.destroy(),this.walls?.buffer.destroy(),this.arrows?.buffer.destroy(),this.drawnLayersBuffer.destroy(),this.palette.destroy(),this.netsBuffer.destroy(),this.barrelView.destroy(),this.layerOffsets.destroy(),this.valuesBuffer!==this.emptyValues&&this.valuesBuffer.destroy(),this.emptyValues.destroy(),this.emptyField.destroy(),this.boardClip?.texture.destroy(),this.emptyClip.destroy()}};function z1(t){let e=G1(Array.from(t,Number));if(!e)return[0,0,-1,0];let r=l=>[0,1,2,3].map(f=>e[f]*l[0]+e[4+f]*l[1]+e[8+f]*l[2]+e[12+f]*l[3]),a=r([0,0,1,0]),s=Math.hypot(a[0],a[1],a[2]);if(Math.abs(a[3])>1e-9*Math.max(s,1e-30))return[a[0]/a[3],a[1]/a[3],a[2]/a[3],1];let n=r([0,0,1,1]),i=r([0,0,0,1]),o=[0,1,2].map(l=>i[l]/i[3]-n[l]/n[3]),c=Math.hypot(...o)||1;return[...o.map(l=>l/c),0]}function G1(t){let e=new Array(16);e[0]=t[5]*t[10]*t[15]-t[5]*t[11]*t[14]-t[9]*t[6]*t[15]+t[9]*t[7]*t[14]+t[13]*t[6]*t[11]-t[13]*t[7]*t[10],e[4]=-t[4]*t[10]*t[15]+t[4]*t[11]*t[14]+t[8]*t[6]*t[15]-t[8]*t[7]*t[14]-t[12]*t[6]*t[11]+t[12]*t[7]*t[10],e[8]=t[4]*t[9]*t[15]-t[4]*t[11]*t[13]-t[8]*t[5]*t[15]+t[8]*t[7]*t[13]+t[12]*t[5]*t[11]-t[12]*t[7]*t[9],e[12]=-t[4]*t[9]*t[14]+t[4]*t[10]*t[13]+t[8]*t[5]*t[14]-t[8]*t[6]*t[13]-t[12]*t[5]*t[10]+t[12]*t[6]*t[9],e[1]=-t[1]*t[10]*t[15]+t[1]*t[11]*t[14]+t[9]*t[2]*t[15]-t[9]*t[3]*t[14]-t[13]*t[2]*t[11]+t[13]*t[3]*t[10],e[5]=t[0]*t[10]*t[15]-t[0]*t[11]*t[14]-t[8]*t[2]*t[15]+t[8]*t[3]*t[14]+t[12]*t[2]*t[11]-t[12]*t[3]*t[10],e[9]=-t[0]*t[9]*t[15]+t[0]*t[11]*t[13]+t[8]*t[1]*t[15]-t[8]*t[3]*t[13]-t[12]*t[1]*t[11]+t[12]*t[3]*t[9],e[13]=t[0]*t[9]*t[14]-t[0]*t[10]*t[13]-t[8]*t[1]*t[14]+t[8]*t[2]*t[13]+t[12]*t[1]*t[10]-t[12]*t[2]*t[9],e[2]=t[1]*t[6]*t[15]-t[1]*t[7]*t[14]-t[5]*t[2]*t[15]+t[5]*t[3]*t[14]+t[13]*t[2]*t[7]-t[13]*t[3]*t[6],e[6]=-t[0]*t[6]*t[15]+t[0]*t[7]*t[14]+t[4]*t[2]*t[15]-t[4]*t[3]*t[14]-t[12]*t[2]*t[7]+t[12]*t[3]*t[6],e[10]=t[0]*t[5]*t[15]-t[0]*t[7]*t[13]-t[4]*t[1]*t[15]+t[4]*t[3]*t[13]+t[12]*t[1]*t[7]-t[12]*t[3]*t[5],e[14]=-t[0]*t[5]*t[14]+t[0]*t[6]*t[13]+t[4]*t[1]*t[14]-t[4]*t[2]*t[13]-t[12]*t[1]*t[6]+t[12]*t[2]*t[5],e[3]=-t[1]*t[6]*t[11]+t[1]*t[7]*t[10]+t[5]*t[2]*t[11]-t[5]*t[3]*t[10]-t[9]*t[2]*t[7]+t[9]*t[3]*t[6],e[7]=t[0]*t[6]*t[11]-t[0]*t[7]*t[10]-t[4]*t[2]*t[11]+t[4]*t[3]*t[10]+t[8]*t[2]*t[7]-t[8]*t[3]*t[6],e[11]=-t[0]*t[5]*t[11]+t[0]*t[7]*t[9]+t[4]*t[1]*t[11]-t[4]*t[3]*t[9]-t[8]*t[1]*t[7]+t[8]*t[3]*t[5],e[15]=t[0]*t[5]*t[10]-t[0]*t[6]*t[9]-t[4]*t[1]*t[10]+t[4]*t[2]*t[9]+t[8]*t[1]*t[6]-t[8]*t[2]*t[5];let r=t[0]*e[0]+t[1]*e[4]+t[2]*e[8]+t[3]*e[12];return r?e.map(a=>a/r):null}function eb(t,e=1536){if(!t||t.length<12)return null;let[r,a,s,n]=[1/0,1/0,-1/0,-1/0];for(let b=0;b+3<t.length;b+=4)r=Math.min(r,t[b],t[b+2]),s=Math.max(s,t[b],t[b+2]),a=Math.min(a,t[b+1],t[b+3]),n=Math.max(n,t[b+1],t[b+3]);let i=1;[r,a,s,n]=[r-i,a-i,s+i,n+i];let o=Math.max(Math.max(s-r,n-a)/e,.02),c=Math.max(1,Math.ceil((s-r)/o)),l=Math.max(1,Math.ceil((n-a)/o)),f=new Uint8Array(c*l),d=Array.from({length:l},()=>[]);for(let b=0;b+3<t.length;b+=4){let[h,u,m,g]=[t[b],t[b+1],t[b+2],t[b+3]];if(u===g)continue;let y=Math.max(0,Math.ceil((Math.min(u,g)-a)/o-.5)),x=Math.min(l-1,Math.floor((Math.max(u,g)-a)/o-.5));for(let v=y;v<=x;v+=1)d[v].push(b)}let p=[];for(let b=0;b<l;b+=1){let h=a+(b+.5)*o;p.length=0;for(let u of d[b]){let[m,g,y,x]=[t[u],t[u+1],t[u+2],t[u+3]];g<=h!=x<=h&&p.push(m+(h-g)/(x-g)*(y-m))}p.sort((u,m)=>u-m);for(let u=0;u+1<p.length;u+=2){let m=Math.max(0,Math.ceil((p[u]-r)/o-.5)),g=Math.min(c-1,Math.floor((p[u+1]-r)/o-.5));g>=m&&f.fill(1,b*c+m,b*c+g+1)}}return{data:f,width:c,height:l,originMm:[r,a],pitchMm:o}}function K1(t,e,r=0){let a=new Map((e||[]).map(s=>[Number(s.id),s]));for(let s of t||[]){let n=a.get(Number(s.layerId));if(s.kind!=="copper"||!n||!s.quantMin||!s.quantSize)continue;let i=s.quantSize[2]===1;return s.quantMin[2]+(i?0:s.quantSize[2]/2)-Number(n.z_mm||0)/1e3}return Number(r||0)/1e3}async function nc({renderer:t,layers:e,colorFor:r,bytes:a,wasm:s,toleranceNm:n,nets:i=[],features:o=[],boardZOffsetMm:c=0,pack:l=null,cache:f=null,pool:d=null,netIds:p=null}){let b={},h=performance.now(),u=D=>{let ie=performance.now();b[D]=Math.round(ie-h),h=ie},m=l||await Da(a,{wasm:s}),g=m.lowerSlice?m:null,y=async()=>g??=await Da(a,{wasm:s});u("open");let x=K1(t.entries,e,c),{planned:v,unmatched:E}=Eh(m.header,e,x),S=new Map(e.map(D=>[Number(D.id),D])),T=performance.now(),_=[...new Set(v.map(D=>D.key))],I=n??br,N=new Map,C=f?{cacheKey:f.cacheKey,wasmKey:Ur(),toleranceNm:I}:null;if(C){let D=_.filter(ie=>!N.has(ie));for(let[ie,it]of await za(f.store,C,D))N.set(ie,it);b.cached=_.filter(ie=>N.has(ie)).length}let B=_.filter(D=>!N.has(D)),R=Oh(m.header),j=new Set,q=C&&typeof f.store.adopt=="function"&&f.store.enabled!==!1?{identity:C,writes:[],adopt(D,ie){f.store.adopt(Tn(C.cacheKey,C.wasmKey,C.toleranceNm,D),ie),j.add(D)}}:null,Y=B.length?d?await d.lower(B,I,R,q):await jh(a,B,I,s??En(),{weights:R}):new Map;b.lowerIn=B.length?Y?"workers":"main":"none";let te=new Map;for(let D of B){let ie=Y?.get(D);te.set(D,ie||(await y()).lowerSlice(D,n)),N.set(D,ie?An(ie):te.get(D))}let ye=v.map(D=>({...D,color:D.role==="copper"?r(S.get(D.layerId)):D.color||[1,1,1,1],lowered:N.get(D.key)})),ne=Gh(ye),me=ne.map(([D,ie])=>Rn(D,ie)),Ie=C?await za(f.store,C,me):new Map,be=ne.filter((D,ie)=>!Ie.has(me[ie])),Ce=be.length&&d?await d.steps(be.map(([D,ie])=>[ie.lowered,D.lowered]),q,be.map(([D,ie])=>Rn(D,ie))):[],xe=new Map;be.forEach(([D,ie],it)=>{Ce[it]&&xe.set(Rn(D,ie),Ce[it])}),ne.forEach(([D],ie)=>{let it=xe.get(me[ie]);D.step=Ie.get(me[ie])||it&&An(it)||null}),b.steps=`${Ie.size} cached, ${xe.size} in workers, ${ne.length-Ie.size-xe.size} here`;let De=D=>!!Y?.get(D)||xe.has(D),Be=new Map([...te,...xe].filter(([D])=>!(q&&De(D)))),ta=C&&Be.size?Xo(f.store,C,Be):Promise.resolve(),Tr=performance.now()-T;u("lower"),await gr.prewarm(t);let A=new gr(t);A.setSlices(ye),u("slices");let P=ye.find(D=>D.role==="dielectric"&&D.lowered?.contourEdges?.length)?.lowered.contourEdges,U=eb(P),J=await m.barrels();A.setBarrels(Th(m.header,J,ye,P)),A.setBoardClipMask(U),u("barrels");let pe=new Set;for(let D=0;D<J.words.length;D+=kn)pe.add(J.words[D]);A.edgePlated=!!m.header.stack?.edge_plating,A.setWalls(Ah(ye,N,e,x)),u("walls");let ve=p?null:await m.netIndices?.(),ht=p||_h(ve?{header:m.header,netIndices:()=>ve}:m,i);A.setOperationNets(ht),u("nets");let Ar=Promise.resolve();if(C){let D=ve?Xo(f.store,C,new Map([[Ua,Rh(m.header,J,ve)]])):Promise.resolve(),ie=q?[...te.keys(),...xe.keys()].filter(De):[];Ar=Promise.all([ta,D,...q?.writes||[]]).then(()=>{if(ie.every(it=>j.has(it)))return Bh(f.store,C)})}let kt=new Map;for(let D of o||[])D?.sourceUid&&(kt.has(D.sourceUid)||kt.set(D.sourceUid,[]),kt.get(D.sourceUid).push(D));return u("features"),g&&g!==m&&g.free(),{cacheWrites:Ar,pack:m,analytic:A,unmatched:E,lowerMs:Tr,timings:b,zOffset:x,operations:zr(m.header),overlay:null,netIds:ht,featuresBySource:kt,barrelOperations:pe,lowered:N}}async function ic(t,e){let r=(await t.pack.binding(e))?.source_uid,a=r?t.featuresBySource?.get(r)||[]:[],s=t.netIds?.[e]||0,n=a.find(i=>Number(i.netId)===s)||a[0];return n?Number(n.id):0}function ab(t,e){if(!e)return t.analytic.clearOverlay(),t.overlay=null,null;if(e.kind==="operation_values"){let r=Wo(e.values,t.operations),a=e.range||Gr(r);t.analytic.setOperationValues(r,a),t.overlay={...e,values:r,range:a}}else if(e.kind==="field_tiles"){let r=Sh(e.tiles),a=e.range||Gr([...r.values()].flatMap(s=>[...Gr(s.values)]));t.analytic.setFieldRasters(r,a),t.overlay={...e,range:a,slices:[...r.keys()]}}else if(e.kind==="field_grid"){let r=Sn(e.grid),a=e.range||Gr([...r.values()].flatMap(n=>[...Gr(n.values)])),s=e.values?Wo(e.values,t.operations):null;t.analytic.setFieldRasters(r,a,s),t.overlay={kind:e.kind,quantity:e.quantity,units:e.units,range:a,slices:[...r.keys()],barrels:s,net:e.grid?.net??null}}else throw new TypeError(`unknown analytic overlay kind ${e.kind}`);return{kind:e.kind,range:t.overlay.range}}function sc(t,e,r=!1){let[a,s]=Array.isArray(t.pitchMm)?t.pitchMm:[t.pitchMm,t.pitchMm],n=(e[0]-t.originMm[0])/a-.5,i=(e[1]-t.originMm[1])/s-.5,o=(m,g)=>m<0||g<0||m>=t.width||g>=t.height?NaN:t.values[g*t.width+m],[c,l]=[Math.floor(n),Math.floor(i)],[f,d]=[n-c,i-l],p=o(c,l),b=o(c+1,l),h=o(c,l+1),u=o(c+1,l+1);return[p,b,h,u].every(Number.isFinite)?(p*(1-f)+b*f)*(1-d)+(h*(1-f)+u*f)*d:r?NaN:o(Math.floor(n+.5),Math.floor(i+.5))}function V1(t,e,r){let[a,s]=Array.isArray(t.pitchMm)?t.pitchMm:[t.pitchMm,t.pitchMm],n=(e[0]-t.originMm[0])/a-.5,i=(e[1]-t.originMm[1])/s-.5,o=NaN,c=1/0;for(let l=Math.floor(i)-r+1;l<=Math.floor(i)+r;l+=1)for(let f=Math.floor(n)-r+1;f<=Math.floor(n)+r;f+=1){if(f<0||l<0||f>=t.width||l>=t.height)continue;let d=t.values[l*t.width+f],p=(f-n)**2+(l-i)**2;Number.isFinite(d)&&p<c&&([o,c]=[d,p])}return o}function sb(t){let e=new Map;for(let r of t.analytic.slices){if(!r.field||!(r.role===void 0||r.role==="copper"))continue;let a=e.get(r.layerId);(!a||r.z>a.z)&&e.set(r.layerId,r)}return[...e.values()].map(r=>({slice:r,key:r.key,layerId:r.layerId,cells:r.field.values.reduce((a,s)=>a+(Number.isFinite(s)?1:0),0)}))}function nb(t,e){if(!e)return 0;let r=(t||[]).find(a=>a?.name===e)||(t||[]).find(a=>(a?.aliases||[]).includes(e));return r&&Number(r.id)||0}var tb=48,H1=70,rb=2e-6,q1=.95;function W1(t,e,r,{spacingMm:a=null,floor:s=.001,density:n=H1,width:i=.07,minLength:o=.3}={}){let c=t.filter(x=>x.role==="copper"&&e.has(x.key)&&r.has(x.key)&&x.face===(x.bottom?"bottom":"top"));if(!c.length)return{data:new ArrayBuffer(0),count:0,spacingMm:0,max:0,reference:0};let l=c.reduce((x,v)=>[Math.min(x[0],v.bounds[0]),Math.min(x[1],v.bounds[1]),Math.max(x[2],v.bounds[2]),Math.max(x[3],v.bounds[3])],[1/0,1/0,-1/0,-1/0]),f=a||Math.max(l[2]-l[0],l[3]-l[1])/n,d=[];for(let x of c){let[v,E]=[e.get(x.key),r.get(x.key)],[S,T,_,I]=x.bounds;for(let N=l[0]+Math.ceil((S-l[0])/f)*f+f/2;N<=_;N+=f)for(let C=l[1]+Math.ceil((T-l[1])/f)*f+f/2;C<=I;C+=f){let B=sc(v,[N,C],!0),R=sc(E,[N,C],!0),j=Math.hypot(B,R);j>0&&d.push({face:x,x:N,y:C,jx:B,jy:R,size:j})}}let p=d.map(x=>x.size).sort((x,v)=>x-v),b=p.length?p[p.length-1]:0,h=p.length?p[Math.min(p.length-1,Math.floor(q1*p.length))]:0,u=d.filter(x=>x.size>=s*h),m=new ArrayBuffer(u.length*tb),g=new Float32Array(m),y=new Uint32Array(m);return u.forEach((x,v)=>{let E=v*(tb/4),[S,T]=x.face.offsetLayers||[x.face.layerId,x.face.layerId],_=x.face.bottom?-rb:rb,I=Math.min(1,x.size/h),N=.9*f*(o+(1-o)*Math.sqrt(I))/1e3;g.set([x.x/1e3,-x.y/1e3,x.face.z+_,i*f/1e3,x.jx/x.size,-x.jy/x.size,N,I],E),y.set([S,T,0,0],E+8)}),{data:m,count:u.length,spacingMm:f,max:b,reference:h}}function oc(t,e){if(!e)return t.analytic.setArrows(null),t.vectors=null,t.vectorInput=null,null;let r=t.analytic.style,a=W1(t.analytic.slices,Sn(e.x),Sn(e.y),{density:r.arrowDensity,width:r.arrowWidth,minLength:r.arrowMinLength});return t.analytic.setArrows(a),t.vectorInput=e,t.vectors={quantity:e.quantity,units:e.units,max:a.max,reference:a.reference,spacingMm:a.spacingMm},{count:a.count,max:a.max,reference:a.reference,spacingMm:a.spacingMm}}function ib(t,e){let r=t.analytic.style,a=t.analytic.setStyle(e);return["arrowDensity","arrowWidth","arrowMinLength"].some(n=>r[n]!==a[n])&&t.vectorInput&&oc(t,t.vectorInput),a}function ob(t,e){for(let r of t?.chunks||[]){let a=Number(r.first_operation_index);if(e>=a&&e<a+Number(r.operation_count||0))return r.slice_key}return null}function Bn(t,e,r,a=null,s=null,n=0){let i=null;for(let o of t.analytic.slices){if(!o.field||Math.abs(e.direction[2])<1e-12||a&&o.key!==a||s&&!s.has(Number(o.layerId)))continue;let[c,l]=o.offsetLayers||[o.layerId,o.layerId],f=o.z+.5*((r?.[c]||0)+(r?.[l]||0)),d=(f-e.origin[2])/e.direction[2];if(!a&&!(d>0)||i&&d>=i.t)continue;let p=[e.origin[0]+d*e.direction[0],e.origin[1]+d*e.direction[1],f],b=[p[0]*1e3,-p[1]*1e3],h=sc(o.field,b);!Number.isFinite(h)&&n>0&&(h=V1(o.field,b,n)),Number.isFinite(h)&&(i={t:d,value:h,sliceKey:o.key,boardMm:b,world:p})}return i&&{value:i.value,sliceKey:i.sliceKey,boardMm:i.boardMm,world:i.world}}async function cc(t,e,r=null){let a=t.overlay,s=a?.kind==="operation_values"?a.values[e]:a?.barrels?.[e],n=a?.kind!=="operation_values"&&Number.isFinite(s)&&(!t.barrelOperations||t.barrelOperations.has(e)),i=a?.kind==="operation_values"||n?s:r?.value;return n&&(r={...r,sliceKey:"via barrel"}),{operationIndex:e,featureId:await ic(t,e)||null,binding:await t.pack.binding(e),...Number.isFinite(i)?{value:i,quantity:a.quantity,units:a.units}:{},...r?{sliceKey:r.sliceKey,boardMm:r.boardMm,world:r.world}:{}}}var X1=2048,$1=.22,cb=2,lb=1024,db=160;function Y1(t,e,r){let a=Float32Array.from(t,o=>Number.isFinite(o)?o:NaN),s=new Int32Array(e*r),n=0,i=0;for(let o=0;o<a.length;o+=1)Number.isFinite(a[o])&&(s[i++]=o);for(;n<i;){let o=s[n++],c=o%e,l=(o-c)/e;for(let[f,d]of[[c-1,l],[c+1,l],[c,l-1],[c,l+1]]){if(f<0||d<0||f>=e||d>=r)continue;let p=d*e+f;Number.isFinite(a[p])||(a[p]=a[o],s[i++]=p)}}return a}function J1(t,e,r){let[a,s,n,i]=t,o=(n-a)/1e3,c=(i-s)/1e3,l=(a+n)/2e3,f=-(s+i)/2e3,d=r-e||1;return new Float32Array([2/o,0,0,0,0,2/c,0,0,0,0,1/d,0,-2*l/o,-2*f/c,-e/d,1])}function Q1(t,e=X1){let r=t[2]-t[0],a=t[3]-t[1],s=e/Math.max(r,a,1e-9);return[Math.max(1,Math.round(r*s)),Math.max(1,Math.round(a*s))]}var Z1=`
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
`,eM=`
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
`,tM=`
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
`,On=class{constructor(e){this.analytic=e,this.renderer=e.renderer,this.device=e.device,this.uniform=this.device.createBuffer({label:"relief",size:db,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),this.scratch=new ArrayBuffer(db),this.sampler=this.device.createSampler({magFilter:"linear",minFilter:"linear"}),this.layer=null,this.vertexCount=0}get ready(){return this.vertexCount>0}pipeline(){if(this.reliefPipeline)return this.reliefPipeline;let e=this.device.createShaderModule({label:"relief",code:eM.replace("PALETTE",tM)});return this.reliefPipeline=this.device.createRenderPipeline({label:"relief",layout:"auto",vertex:{module:e,entryPoint:"vs_relief"},fragment:{module:e,entryPoint:"fs_relief",targets:[{format:this.renderer.format}]},primitive:{topology:"triangle-list",cullMode:"none"},depthStencil:{format:this.renderer.depthFormat,depthWriteEnabled:!0,depthCompare:"greater"},multisample:{count:this.renderer.sampleCount||1}}),this.reliefPipeline}netPipeline(){if(this.netMaskPipeline)return this.netMaskPipeline;let e=this.device.createShaderModule({label:"relief-net-mask",code:Z1});return this.netMaskPipeline=this.device.createRenderPipeline({label:"relief-net-mask",layout:"auto",vertex:{module:e,entryPoint:"vs_full"},fragment:{module:e,entryPoint:"fs_net",targets:[{format:"r8unorm"}]},primitive:{topology:"triangle-list"}}),this.netMaskPipeline}build(e,{range:r,netId:a=0,heightShare:s=$1}={}){this.release();let n=e?.field;if(!n)return!1;let i=this.boundsOf(e),[o,c]=Q1(i),l=this.renderMask(e.layerId,i,o,c);this.mask=this.filterMask(l,o,c,a),l.destroy();let f=Y1(n.values,n.width,n.height),d=Float32Array.from(f,m=>Number.isFinite(m)?m:3e38);this.field=this.device.createTexture({label:"relief-field",size:[n.width,n.height],format:"r32float",usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST}),this.device.queue.writeTexture({texture:this.field},d,{bytesPerRow:n.width*4},[n.width,n.height]);let[p,b]=Array.isArray(n.pitchMm)?n.pitchMm:[n.pitchMm,n.pitchMm],h=Math.max(i[2]-i[0],i[3]-i[1])/1e3,u=[Math.min(lb,Math.max(2,Math.ceil((i[2]-i[0])/p*cb)+1)),Math.min(lb,Math.max(2,Math.ceil((i[3]-i[1])/b*cb)+1))];return this.layer=e.layerId,this.sliceKey=e.key,this.boundsMm=i,this.base=e.z,this.height=h*s,this.grid=u,this.vertexCount=(u[0]-1)*(u[1]-1)*6,this.params={field:n,pitch:[p,b],range:r||[0,1]},this.bindGroup=this.device.createBindGroup({layout:this.pipeline().getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:this.uniform}},{binding:1,resource:this.field.createView()},{binding:2,resource:this.mask.createView()},{binding:3,resource:this.sampler},{binding:4,resource:{buffer:this.analytic.palette}}]}),this.renderer.invalidate?.(),!0}boundsOf(e){let r=this.analytic.slices.filter(n=>n.layerId===e.layerId&&(n.role===void 0||n.role==="copper")),a=(r.length?r:[e]).map(n=>n.bounds),s=.05;return[Math.min(...a.map(n=>n[0]))-s,Math.min(...a.map(n=>n[1]))-s,Math.max(...a.map(n=>n[2]))+s,Math.max(...a.map(n=>n[3]))+s]}renderMask(e,r,a,s){let{analytic:n,renderer:i,device:o}=this,c=n.extent,l=(c?.[0][2]??-.01)-.001,f=(c?.[1][2]??.01)+.001,d=J1(r,l,f),p=o.createTexture({label:"relief-pick",size:[a,s],format:"rg32uint",usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.TEXTURE_BINDING}),b=o.createTexture({label:"relief-pick-depth",size:[a,s],format:i.depthFormat,usage:GPUTextureUsage.RENDER_ATTACHMENT}),h={view:b.createView(),depthClearValue:0,depthLoadOp:"clear",depthStoreOp:"discard"};i.stencil&&Object.assign(h,{stencilClearValue:0,stencilLoadOp:"clear",stencilStoreOp:"discard"});let u=o.createCommandEncoder(),m=u.beginRenderPass({colorAttachments:[{view:p.createView(),clearValue:{r:0,g:0,b:0,a:0},loadOp:"clear",storeOp:"store"}],depthStencilAttachment:h}),g=i.innerCopperMode;i.innerCopperMode="all";try{i.writeGlobals(d,0,0,0,0),i.stencil&&m.setStencilReference(1),n.encodeInto(m,null,new Set([e]),!0,{matrix:d,showBoard:!1})}finally{i.innerCopperMode=g}return m.end(),o.queue.submit([u.finish()]),b.destroy(),p}filterMask(e,r,a,s){let{device:n}=this,i=n.createTexture({label:"relief-mask",size:[r,a],format:"r8unorm",usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.TEXTURE_BINDING}),o=n.createBuffer({label:"relief-net",size:16,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});n.queue.writeBuffer(o,0,new Uint32Array([s>>>0,0,0,0]));let c=this.netPipeline(),l=n.createBindGroup({layout:c.getBindGroupLayout(0),entries:[{binding:0,resource:e.createView()},{binding:1,resource:{buffer:this.analytic.netsBuffer}},{binding:2,resource:{buffer:o}}]}),f=n.createCommandEncoder(),d=f.beginRenderPass({colorAttachments:[{view:i.createView(),clearValue:{r:0,g:0,b:0,a:0},loadOp:"clear",storeOp:"store"}]});return d.setPipeline(c),d.setBindGroup(0,l),d.draw(3),d.end(),n.queue.submit([f.finish()]),o.destroy(),i}encode(e,r){if(!this.ready)return 0;let a=new Float32Array(this.scratch),s=new Uint32Array(this.scratch);return a.set(r,0),a.set(this.boundsMm,16),a.set(this.params.field.originMm,20),a.set(this.params.pitch,22),s[24]=this.params.field.width,s[25]=this.params.field.height,s[26]=this.grid[0],s[27]=this.grid[1],a.set(this.params.range,28),a[30]=this.base,a[31]=this.height,a.set([.35,.45,.82,0],32),this.device.queue.writeBuffer(this.uniform,0,this.scratch),e.setPipeline(this.pipeline()),e.setBindGroup(0,this.bindGroup),e.draw(this.vertexCount),1}worldBounds(){if(!this.ready)return null;let[e,r,a,s]=this.boundsMm;return[e/1e3,-s/1e3,this.base,a/1e3,-r/1e3,this.base+this.height]}release(){this.mask?.destroy(),this.field?.destroy(),this.mask=null,this.field=null,this.bindGroup=null,this.vertexCount=0,this.layer=null}destroy(){this.release(),this.uniform.destroy()}};var ub=512*1024*1024,rM=.65,aM=1.5,sM=15e3,nM=120,iM=12,oM=48,Ib=230,kc=document,Nt,L,Ke,Gn,Kn,Vn,qr,ri,vt,Pn,Wa,xt,ut,Ae,Xe,jn,Hn,Xa,Ge,se,ai,si,We,Kr,wr,at,Rt,qn,Vr,Z=t=>kc.querySelector(t),xr=t=>kc.querySelectorAll(t);function Rb(t=document){kc=t,Nt=Z("#app"),L=Z("#viewport"),Ke=Z("#schematic-viewport"),Gn=Z("#schematic-dom-layer"),Kn=Z("#schematic-flow-overlay"),Vn=Z("#bom-view"),qr=Z("#status")||{set textContent(e){}},ri=Z("#viewer-kind")||{set textContent(e){}},vt=Z("#selection")||{set textContent(e){}},Pn=Z("#diagnostics")||{set innerHTML(e){}},Wa=Z("#scene-stats"),xt=Z("#lod-tuning"),ut=Z("#layers"),Ae=Z("#search-controls"),Xe=Z("#view-controls"),We=Z("#stackup-workspace-view"),jn=Z("#fallback"),Hn=Z("#panel-labels"),Xa=Z("#schematic-labels"),Ge=Z("#axis-gizmo"),se=Z("#selection-card"),ai=Z("#primary-heading"),si=Z("#primary-description"),Kr=Z("#mode-switch"),wr=Z("#system-labels"),at=Z("#move-gizmo"),Rt=Z("#system-help"),qn=Z("#system-harnesses"),Vr=Z("#harness-nodes"),Vr?.addEventListener("pointermove",e=>Ep(e)),Vr?.addEventListener("pointerup",e=>Sp(e)),Nt.classList.add("workspace-pcb")}var cM=["soldermask","silkscreen","paste"],lM=Object.freeze([{role:"soldermask",side:"front",name:"F.Mask"},{role:"soldermask",side:"back",name:"B.Mask"},{role:"silkscreen",side:"front",name:"F.SilkS"},{role:"silkscreen",side:"back",name:"B.SilkS"},{role:"paste",side:"front",name:"F.Paste"},{role:"paste",side:"back",name:"B.Paste"}]),dM={soldermask:"#1f6b45",silkscreen:"#f2f2f2",paste:"#a0a3a8"};function Nb(){return{workspace:"pcb",clickSelect:!0,mode:"3d",activeNetId:0,selectedFeatureId:0,selectedOccurrence:0,selectionAnchor:null,showBoard:!0,showComponents:!0,showPlaceholders:!0,realisticColors:!0,hiddenBoardLayers:[],isolateNet:!1,savedShowBoard:!0,savedShowComponents:!0,preIsolationShowBoard:null,separation:0,dragging:!1,dragMode:"orbit",lastX:0,lastY:0,pointerStartX:0,pointerStartY:0,frameCpuMs:0,frameCpuP95Ms:0,frameIntervalMs:0,frameIntervalP95Ms:0,frameSamples:[],fps:0,frames:0,fpsAt:performance.now(),activeTab:"layers",selectedPageId:"",selectedSchematicFeature:null,schematicDragging:!1,schematicLastX:0,schematicLastY:0,schematicStartX:0,schematicStartY:0}}function ts(t={}){return{key:t.key??"board",topology:t.topology||window.__TOPOLOGY__||{},semanticGeometry:t.semanticGeometry||window.__SEMANTIC_GEOMETRY__||{},viewerReadiness:t.readiness||{stage:"semantic-ready",progress:100},assetCache:t.assetCache||null,deferComponents:!!t.deferComponents,scene:uM(),renderer:null,compareLayers:new Set,desiredCompareLayers:new Set,visible3dLayers:new Set,preIsolation3dLayers:null,preIsolationCompareLayers:null,highlightedNetIds:new Set,hiddenComponents:new Set,hiddenComponentRequest:null,loadedBytes:0,triangles:0,residentTileBytes:0,residentTileGpuBytes:0,residentTileTriangles:0,tileLoads:0,tileEvictions:0,tileSchedulerMs:0,lastTileScheduleAt:0,visibleTileIds:new Set,gpuBytes:0}}function uM(){return{manifest:null,manifestUrl:"",layers:[],copperLayers:[],nets:[],features:new Map,tiles:new Map,loaded:new Set,loading:new Map,failed:new Map,residentTiles:new Map,componentFeatures:new Map,componentModelCounts:new Map,componentTier:"idle",componentEntries:[],componentsWantedAt:0,componentEvictions:0,runtimeBounds:null,layerZOffsets:new Float32Array(256),layerZOffsetSignature:""}}function Cb(){return{key:"",started:0,from:new Map,current:new Map}}function Bb(){return{phase:"idle",previous:new Set,target:new Set,previousOffsets:new Map,started:0}}function Ob(){return{manifest:null,manifestUrl:"",pages:[],byId:new Map,activeNetUid:"",visiblePages:[],fitted:!1,rendererMode:new URLSearchParams(location.search).get("schematicRenderer")||"svg-dom",domFallbackReason:""}}var M=Nb(),k=ts(),w=null,Le=Cb(),$=Bb(),z=Ob(),Wn=[],fM=5e3,hM=5e3,O,re,ft,G,ee,vr=new Map,nr=performance.now(),_e=0,Ln=0,rs=null,Xn=null,$n=null,lc=!1,Je=!1,ni=()=>!0,$a=!0;!window.__PRISM_SEMANTIC_VIEWER_MANUAL_BOOT__&&document.getElementById("app")&&Sc().catch(t=>{console.error(t),qr&&(qr.textContent="Renderer failed"),jn&&(jn.hidden=!1,jn.textContent=t.stack||t.message||String(t))});function Fb(t){let e=new Map((t.components||[]).map(a=>[a.uid,a])),r={};for(let a of t.terminals||[]){let s=a.net_uid;if(!s)continue;let n=e.get(a.component_uid)||{},i={designator:a.designator||n.designator||"",pin:a.pin||"",value:n.value||"",pcb_pad_id:a.pcb_pad_id||"",pcb_pad_source_uid:a.pcb_pad_source_uid||""};r[s]||(r[s]={terminals:[]});let o=r[s].terminals;o.some(c=>c.designator===i.designator&&c.pin===i.pin)||o.push(i)}return r}function bM(t,e=k){if(!t||!e.scene?.features)return 0;let r=t.pcb_pad_source_uid||"";if(!r&&t.pcb_pad_id&&(r=(e.topology?.physical_objects||[]).find(s=>s.uid===t.pcb_pad_id)?.source_ids?.[0]||""),!r)return 0;for(let[a,s]of e.scene.features.entries())if(s.sourceUid===r&&s.kind==="pad")return a;return 0}function Ec(t,e=k){return!t||!e.topology||!e.topology.components?null:e.topology.components.find(r=>r.designator===t)}function Fn(t,e){for(let r of Object.keys(t))delete t[r];Object.assign(t,e)}function Pb(){if(Ln&&(cancelAnimationFrame(Ln),Ln=0),window.removeEventListener("keydown",tg),w){for(let t of w.boards.values())t.abort?.abort();w.scene.dispose(),w=null}else fc(),k.renderer?.dispose?.();k.renderer=null,O=null,re?.dispose?.(),re=null,ft=null,rs=null,ni=()=>!0,$a=!0}function jb(){return _e+=1,Pb(),Fn(M,Nb()),k=ts(),Fn(Le,Cb()),Fn($,Bb()),Fn(z,Ob()),Wn=[],G=null,ee=null,vr=new Map,nr=performance.now(),_e}function Lb(t){t===_e&&(_e+=1,Pb())}function Ya(t){t===_e&&(Ln=requestAnimationFrame(e=>Ok(e,t)))}function ge(t){return t===_e}async function Sc(t={}){let e=jb(),r={};if(k.topology=t.topology||window.__TOPOLOGY__||{},k.topology&&!k.topology.net_details&&(k.topology.net_details=Fb(k.topology)),k.semanticGeometry=t.semanticGeometry||window.__SEMANTIC_GEOMETRY__||{},k.viewerReadiness=t.readiness||k.semanticGeometry.readiness||{stage:"semantic-ready",progress:100},rs=typeof t.onSelectionChange=="function"?t.onSelectionChange:null,$n=typeof t.onContextMenu=="function"?t.onContextMenu:null,Xn=typeof t.onViewStateChange=="function"?t.onViewStateChange:null,ni=typeof t.isActive=="function"?t.isActive:()=>!0,$a=t.workspaceScope!=="3d",k.assetCache=t.assetCache||null,M.gpuBudgetBytes=xn,Rb(t.root||document),!Nt||!L)throw new Error("Semantic viewer shell is missing required DOM nodes");return await wM(e,r,t.onPerformanceEvent),{performance:r,...Db(),selectOccurrence:xM,setHighlightedNetIds(a){k.highlightedNetIds=a,k.renderer?.setEmphasizedNetIds(a)},refreshResidency(){Re(performance.now(),{force:!0})},resize(){k.renderer?.resize(),O?.resize(),M.workspace==="pcb"&&M.mode==="layer"&&Uc()},setWorkspace(a){let s=a==="stackup"?"stackup":"pcb";M.workspace!==s&&Yp(s)},setHiddenComponents:Xp,getComponentReferences(){return[...k.scene.componentFeatures.keys()]},async loadAnalyticPack(a,s={}){if(!k.renderer)return null;let n=performance.now();fc();let i=Math.round(performance.now()-n),o=++Ha,c=await nc({renderer:k.renderer,layers:k.scene.layers,colorFor:f=>{let d=Za(f,k);return d.length>=4?d.slice(0,4):[...d,1]},bytes:a,wasm:s.wasm,toleranceNm:s.toleranceNm,nets:k.scene.manifest?.nets,features:k.scene.manifest?.objectFeatures,boardZOffsetMm:k.scene.manifest?.boardZOffsetMm});if(o!==Ha||!k.renderer)return c.analytic.destroy(),c.pack.free(),null;let l=performance.now();return k.renderer.setAnalytic(c.analytic),c.timings.attach=Math.round(performance.now()-l),k.analytic=c,k.analytic.timings={release:i,...k.analytic.timings},fb()},setAnalyticOverlay(a){if(!k.analytic)return null;let s=ab(k.analytic,a);return k.reliefOptions&&hb(!1),s},setAnalyticRelief(a){return k.reliefOptions=a||null,hb(!0)},setAnalyticVectors(a){return k.analytic?oc(k.analytic,a):null},setAnalyticStyle(a){return k.analytic?ib(k.analytic,a):null},analyticColormaps(){return{colormaps:Do,defaults:Ia}},setClickSelect(a){M.clickSelect=a!==!1},analyticProbe(a,s){if(!k.analytic?.overlay||k.analytic.overlay.kind==="operation_values")return null;let n=Sb(a,s);if(!n)return null;let i=M.mode==="3d"?k.visible3dLayers:null,o=Bn(k.analytic,n,Zn(),null,i,1);if(!o)return null;let{quantity:c,units:l}=k.analytic.overlay;return{value:o.value,quantity:c,units:l,sliceKey:o.sliceKey,boardMm:o.boardMm,world:o.world,marker:Eb(o.world)}},async analyticAt(a,s){if(!k.analytic)return null;let n=await Zp(a,s);if(n?.kind!=="analytic")return null;let i=Sb(a,s);if(!i||k.analytic.overlay?.kind==="operation_values")return cc(k.analytic,n.operationIndex);let o=Zn(),c=ob(k.analytic.pack.header,n.operationIndex),l=c&&Bn(k.analytic,i,o,c)||Bn(k.analytic,i,o),f=await cc(k.analytic,n.operationIndex,l);return l?{...f,marker:Eb(l.world)}:f},analyticStats:fb,unloadAnalyticPack(){Ha+=1,fc()},setLodOverride(a){k.renderer?.setLodOverride(a)},projectComponent(a){return eg(k,a,s=>yr(s,rt))},projectPoint(a){return yr(a,rt)},setViewMode:Up,renderInset:Pk,insetReady:Op,releaseInset(a){es.release(a)},insetBoard:()=>({scene:k.scene,topology:k.topology}),onSceneChange(a){return Qn.add(a),()=>Qn.delete(a)},insetStats(){return{...Dn,views:es.size,targets:[ce.width,ce.height]}},insetSettings(a){return Object.assign(wc,a||{}),{...wc}},gpuIdle(){return k.renderer?.device.queue.onSubmittedWorkDone()??Promise.resolve()},dispose(){yM(),Lb(e)}}}function fb(){let t=k.analytic;return t?{operations:t.operations,lowerMs:t.lowerMs,timings:t.timings,zOffset:t.zOffset,unmatched:t.unmatched,...t.analytic.stats()}:null}function hb(t){let e=k.renderer;if(!e)return null;let r=k.reliefOptions,a=k.analytic?.overlay;if(!r||!a||a.kind==="operation_values"){let i=e.relief?.ready;return e.relief?.release(),i&&t&&G.frame(or()),e.invalidate?.(),null}let s=sb(k.analytic).sort((i,o)=>o.cells-i.cells),n=s.find(i=>i.key===r.sliceKey)||s[0];return n?(e.relief??=new On(k.analytic.analytic),e.relief.build(n.slice,{range:a.range,netId:nb(k.scene.manifest?.nets,a.net),heightShare:r.heightShare}),t&&G.frame(e.relief.worldBounds()),e.invalidate?.(),{sliceKey:n.key,slices:s.map(i=>({key:i.key,layerId:i.layerId,cells:i.cells}))}):(e.relief?.release(),e.invalidate?.(),{sliceKey:null,slices:[]})}var Ha=0;async function pM(t,e=k){let r=Qa(e);if(r)return new Uint8Array(await r(t));let a=await fetch(t,{cache:"default"});if(!a.ok)throw new Error(`Failed to load ${t}: ${a.status}`);return new Uint8Array(await a.arrayBuffer())}async function gM(t,e,r){let a=t.semanticGeometry.assets||{};if(!a.analytic_pack)throw new Error("The analytic bundle names no pack");let s=performance.now(),[n,i]=await Promise.all([pM(a.analytic_pack,t),a.stackup?qb(a.stackup,t).catch(()=>null):null]);if(r.analytic_pack_fetch_ms=performance.now()-s,r.analytic_pack_bytes=n.byteLength,t.loadedBytes+=n.byteLength,!ge(e))return!1;let o=t.semanticGeometry.cache_key||"",c=t.assetCache&&o?await Ch(t.assetCache,{cacheKey:o,wasmKey:Ur(),toleranceNm:br}):!1;r.analytic_lowering_cached=c;let l=Ga.start(n,En(),c?1:In(_n));s=performance.now();let f=c?(await za(t.assetCache,{cacheKey:o,wasmKey:Ur(),toleranceNm:br},[Ua])).get(Ua):null,d=f&&Ph(f,l)||l&&await Fh(l)||await Da(n);return r.analytic_pack_from_cache=!!f,r.analytic_pack_open_ms=performance.now()-s,r.analytic_pack_hosted=!!d.hosted,ge(e)?(t.analyticSource={bytes:n,pack:d,stackup:i,pool:l},t.scene.manifest=sl(d.header,i),!0):(d.free(),l?.close(),!1)}async function mM(t,e,r){let a=e.analyticSource,s=++Ha;e.renderer.stackupLooks=nl(a.stackup);let n=e.semanticGeometry.cache_key||"",i={renderer:e.renderer,layers:e.scene.layers,colorFor:f=>{let d=Za(f,e);return d.length>=4?d.slice(0,4):[...d,1]},bytes:a.bytes,pack:a.pack,nets:e.scene.nets,cache:e.assetCache&&n?{store:e.assetCache,cacheKey:n}:null,pool:a.pool},o=performance.now(),c=await nc(i),l=a.pool;return l&&c.pack.hosted?c.cacheWrites.then(()=>l.release()):l?.close(),a.pool=null,s!==Ha||!ge(t)||!e.renderer?(c.analytic.destroy(),c.pack.free(),null):(e.renderer.setAnalytic(c.analytic),e.analytic=c,r.analytic_board_ms=performance.now()-o,r.analytic_board=c.timings,na(e.scene.manifest.bbox))}function fc(){k.renderer?.relief?.destroy(),k.renderer&&(k.renderer.relief=null),k.renderer?.setAnalytic(null),k.analytic?.pack.free(),k.analytic=null}function Db(){return{nets:()=>k.scene.nets,quietly(t){Je=!0;try{t()}finally{Je=!1}},selectNet:Vc,selectFeature:Sr,selectComponent:Hc,clearSelection:Ve,anyEmphasis:Qr,showNetProbe:Ac,restoreVisibility:Vb,isolating:()=>M.isolateNet,isolateLitNets:Yr,setNetIsolation:ea,setGpuBudget(t){M.gpuBudgetBytes=t;for(let e of w?w.boards.values():[k])e.tiersCheckedAt=0},setStatsOverlay:sp,stats:ap,pickAt(t,e){return Zp(t,e)},getViewState:Ub,setLayerVisible:zp,applyLayerPreset:Gp,setShowBoard:Kp,setShowComponents:Vp,setShowPlaceholders:Qk,setRealisticColors:tE,setBoardLayerVisible:eE,setSeparation:Hp,showNetLayers:Kc}}function yM(){ce.depth?.destroy(),Object.assign(ce,{canvas:null,context:null,depth:null,depthView:null,width:0,height:0}),es.clear(),Qn.clear(),Hr=null}function Bt(){!Xn||lc||(lc=!0,queueMicrotask(()=>{lc=!1,Xn?.(Ub())}))}function Ub(){let t=M.mode==="3d"?k.visible3dLayers:k.desiredCompareLayers;return{mode:M.mode,layers:k.scene.copperLayers.map(e=>({id:Number(e.id),name:String(e.name),color:bi(hi(e)),visible:t.has(Number(e.id))})),boardLayers:Zk(),showBoard:M.showBoard,showComponents:M.showComponents,showPlaceholders:M.showPlaceholders,realisticColors:M.realisticColors,separation:w?w.separation.get(Ja())||0:M.separation,isolateNet:M.isolateNet,hasNet:!!M.activeNetId||Qr(),...w?{boards:tk(),selectedBoard:Ja()}:{}}}function ii(t){if(w?.move.enabled&&ss(),Je)return;let e=k.renderer&&!k.renderer.identityOnly?k.renderer.occurrenceKeys[M.selectedOccurrence]:null;rs?.(t&&e!=null?{...t,occurrence:e}:t)}function xM(t){let e=k.renderer?.occurrenceKeys.indexOf(String(t))??-1;e>=0&&(M.selectedOccurrence=e)}function Tc(t){if(!t||!k.renderer||k.renderer.identityOnly)return t;let e=k.renderer.occurrenceMatrices[M.selectedOccurrence];return e?Tt(e,t):t}function zb(t,e=null){return t?{kind:"net",sourceContext:"3D",netName:String(t.name||""),netUid:String(t.uid||"")||void 0,netCode:Number(t.id||0)||void 0,featureId:Number(e?.id||0)||void 0,uuid:String(e?.sourceUid||"")||void 0}:null}function Gb(t,e=k){if(!t)return null;let r=Jr(t),a=String(t.padNumber||t.pin||t.pinNumber||""),s=e.scene.nets.find(n=>Number(n.id)===Number(t.netId||0));if(r&&a)return{kind:"terminal",sourceContext:"3D",reference:r,pin:a,netUid:s?.uid,netName:s?.name,netCode:s?Number(s.id):void 0,uuid:String(t.sourceUid||"")||void 0,featureId:Number(t.id||0)||void 0};if(r){let n=Ec(r,e);return{kind:"component",sourceContext:"3D",reference:r,componentUid:n?.uid,uuid:String(t.sourceUid||"")||void 0,featureId:Number(t.id||0)||void 0}}return zb(s,t)}function Kb(){M.showBoard=!0,M.showComponents=!0,Er(),typeof He=="function"&&He()}function Qr(){return Wr().size>0||!!w?.emphasisSets.length}function Wr(){let t=new Set(k.highlightedNetIds);return M.activeNetId&&t.add(Number(M.activeNetId)),t}function Ac(){(M.showBoard||M.showComponents)&&(M.savedShowBoard=M.showBoard,M.savedShowComponents=M.showComponents),M.showBoard=!1,M.showComponents=!1,Er(),typeof He=="function"&&He()}function Vb(){M.showBoard=M.savedShowBoard!==!1,M.showComponents=M.savedShowComponents!==!1,Er(),typeof He=="function"&&He()}async function Hb(t,e,r={}){let a=t.semanticGeometry.assets?.scene_manifest||t.semanticGeometry.semantic_gltf?.path,s=performance.now();if(t.semanticGeometry.analytic){if(!await gM(t,e,r))return!1}else if(a){if(t.scene.manifestUrl=new URL(a,location.href).toString(),t.scene.manifest=await qb(t.scene.manifestUrl,t),r.scene_manifest_fetch_parse_ms=performance.now()-s,!ge(e))return!1;if(t.scene.manifest.schema!=="prism.semantic_gltf_a0")throw new Error(`Unsupported scene schema: ${t.scene.manifest.schema}`)}else t.scene.manifest={schema:"prism.semantic_gltf_partial.a0",bbox:null,layers:[],nets:[],objectFeatures:[],components:[],tiles:[],barrels:[]},r.scene_manifest_fetch_parse_ms=0;s=performance.now(),t.scene.layers=t.scene.manifest.layers||[],t.scene.copperLayers=t.scene.layers.filter(i=>i.role==="copper"||String(i.name).endsWith(".Cu")),t.scene.nets=t.scene.manifest.nets||[];for(let i of t.scene.manifest.objectFeatures||[])t.scene.features.set(Number(i.id),{...i,bounds:sa(i.boundsMm)});for(let i of t.scene.manifest.components||[])t.scene.componentFeatures.set(i.designator,i),t.scene.features.set(Number(i.featureId),{...i,kind:"component",sourceUid:i.uid,netId:0,bounds:null});for(let i of t.scene.manifest.tiles||[])t.scene.tiles.set(i.id,i);r.scene_manifest_index_ms=performance.now()-s;let n=Yb(t);for(let i of n)t.compareLayers.add(i),t.desiredCompareLayers.add(i);for(let i of t.scene.copperLayers)t.visible3dLayers.add(Number(i.id));return!0}async function wM(t,e={},r=null){let a=performance.now(),s=k.semanticGeometry.analytic?ar.create(L).then(c=>(gr.prewarm(c),c)):null;if(!await Hb(k,t,e)){s&&s.then(c=>c?.dispose?.()).catch(()=>{});return}let n=performance.now();if(k.renderer=s?await s:await ar.create(L),e.webgpu_renderer_create_ms=performance.now()-n,!ge(t)){k.renderer?.dispose?.(),k.renderer=null;return}k.renderer.setBarrels(to(k.scene.manifest.barrels,k.scene.manifest.layers)),os(),n=performance.now();let i=k.analyticSource?await mM(t,k,e):await tp(t);if(e.board_fetch_parse_upload_ms=performance.now()-n,!ge(t)||(k.scene.runtimeBounds=i||na(k.scene.manifest.bbox),G=new ia(k.scene.runtimeBounds),$a&&(await vM(t),!ge(t)||(await MM(t),!ge(t)))))return;n=performance.now(),zc(),$p(),$a&&(dE(),lE()),qp(),ag(),e.controls_and_bindings_ms=performance.now()-n;let o={"board-ready":"Board ready \xB7 components and semantic layers are still generating","components-ready":"Board and components ready \xB7 semantic layers are still generating","semantic-ready":"WebGPU semantic glTF active"};if(qr.textContent=o[k.viewerReadiness.stage]||"Loading 3D assets",k.semanticGeometry.assets?.components_glb&&!k.deferComponents){let c=performance.now(),l=_p(t);k.analytic&&await l.catch(()=>{}),l.then(()=>{ge(t)&&(xc(i),r?.({schema:"prism.semantic_viewer_performance.a0",milestone:"components-loaded",readiness_stage:k.viewerReadiness.stage,elapsed_ms:performance.now()-c,bytes_loaded:k.loadedBytes}))})}else xc(i);Re(performance.now(),{force:!0}),Ya(t),n=performance.now(),await new Promise(c=>requestAnimationFrame(c)),e.first_frame_wait_ms=performance.now()-n,e.boot_total_ms=performance.now()-a}async function vM(t=_e){let e=k.semanticGeometry.assets?.schematic_native_manifest||k.semanticGeometry.schematic_vector?.path||k.semanticGeometry.schematic_scene?.path,r=k.semanticGeometry.assets?.schematic_manifest||k.semanticGeometry.schematic_world?.path,a=Z("[data-workspace=schematic]");if(!e&&!r){a.disabled=!0,a.title="No schematic world assets are available";return}let s=[e,r].filter(Boolean),n=null;for(let o of s)try{z.manifestUrl=new URL(o,location.href).toString();let c=await en.create(Ke,z.manifestUrl);if(!ge(t))return;O=c,O.setFlowOverlayCanvas(Kn);break}catch(c){if(n=c,O=null,o===r)throw c}if(!O)throw n||new Error("Failed to load schematic viewer assets");z.manifest=O.manifest,z.pages=O.pages,z.byId=new Map(z.pages.map(o=>[o.id,o])),M.selectedPageId=z.pages[0]?.id||"",O.selectedPageId=M.selectedPageId,!["native","legacy","webgpu"].includes(String(z.rendererMode).toLowerCase())&&(re=an.create(Gn,z.manifestUrl,z.manifest,O.featuresByPage,{onSelect:$k,onBlank:is,onHighlightNet:Lp,onOpenPage:Wk,onFallback:o=>{z.domFallbackReason=o,console.warn(o)}}),re.preloadPages(z.pages)),O.preloadOverview()}async function MM(t=_e){let e=k.semanticGeometry.assets?.bom||k.semanticGeometry.bom?.path,r=Z("[data-workspace=bom]");if(!e){r&&(r.disabled=!0,r.title="No BoM artifact is available");return}try{let a=await ps.create(Vn,new URL(e,location.href).toString(),{onSelectReference:s=>Hc(s,!0)});if(!ge(t))return;ft=a}catch(a){if(!ge(t))return;console.warn(a),r&&(r.disabled=!0,r.title=a?.message||"BoM artifact could not be loaded")}}async function qb(t,e=k){if(e.assetCache)return e.assetCache.fetchJson(String(t));let r=await fetch(t,{cache:"default"});if(!r.ok)throw new Error(`Failed to load ${t}: ${r.status}`);return r.json()}function kM(){return!w||w.timing.boardsDrawnAt!=null?!0:![...w.boards.values()].some(t=>t.loadState==="loading"||t.loadState==="waiting")}var EM=24*1024*1024,mr={bytes:0,waiting:null};async function Wb(t){for(;;){if(mr.bytes===0||mr.bytes+t<=EM){mr.bytes+=t,mr.waiting??=new Promise(e=>requestAnimationFrame(()=>{mr.bytes=0,mr.waiting=null,e()}));return}await mr.waiting}}async function SM(t,e=_e,r=k){if(!ge(e))return;let a=r.scene.residentTiles.get(t.id);if(a){a.lastUsed=performance.now();return}if(r.scene.failed.get(t.id))return;if(r.scene.loading.has(t.id))return r.scene.loading.get(t.id);let n=(async()=>{try{let i=await fa(new URL(t.path,r.scene.manifestUrl).toString(),{fetchBytes:Qa(r),fetchCache:"no-store"});if(!ge(e)||!r.renderer||(await Wb(i.primitives.reduce((p,b)=>p+hc(b),0)),!ge(e)||!r.renderer))return;r.loadedBytes+=i.byteLength;let o=r.scene.layers.find(p=>Number(p.id)===Number(t.layerId)),c=[],l=0,f=0;for(let p of i.primitives){let b=r.renderer.addPrimitive(p,{kind:"copper",tileId:t.id,layerId:Number(t.layerId),innerCopper:oi(Number(t.layerId),r),color:Za(o,r),stencilMark:Np(o,r),baseZ:Number(o?.z_mm||0)/1e3,material:{baseColor:[1,1,1,1],metallic:.78,roughness:.32}});c.push(b),l+=p.indices.length/3,f+=hc(p)}let d={tile:t,entries:c,byteLength:i.byteLength,gpuBytes:f,triangles:l,lastUsed:performance.now(),pinned:!1};r.scene.residentTiles.set(t.id,d),r.scene.loaded.add(t.id),r.tileLoads+=1,r.residentTileBytes+=i.byteLength,r.residentTileGpuBytes+=f,r.residentTileTriangles+=l,r.triangles=r.residentTileTriangles,r.scene.failed.delete(t.id)}catch(i){if(!ge(e))return;let o=r.scene.failed.get(t.id)||{count:0,message:""};r.scene.failed.set(t.id,{count:o.count+1,message:i?.message||String(i)}),o.count||console.warn(`Failed to load tile ${t.id}; suppressing retries until assets are regenerated`,i)}finally{ge(e)&&r.scene.loading.delete(t.id)}})();return r.scene.loading.set(t.id,n),n}function hc(t){return ju(t.position.length/3,t.indices.length)}function _c(t,e=k){let r=e.scene.residentTiles.get(t);r&&(e.renderer.removeEntries(r.entries),e.scene.residentTiles.delete(t),e.scene.loaded.delete(t),e.residentTileBytes=Math.max(0,e.residentTileBytes-r.byteLength),e.residentTileGpuBytes=Math.max(0,e.residentTileGpuBytes-r.gpuBytes),e.residentTileTriangles=Math.max(0,e.residentTileTriangles-r.triangles),e.triangles=e.residentTileTriangles,e.tileEvictions+=1)}function Re(t=performance.now(),e={},r=k){if(!r.renderer||!G||M.workspace!=="pcb")return;let a=M.mode==="layer"&&$.phase==="preload";if(!e.force&&!a&&t-r.lastTileScheduleAt<nM)return;let s=performance.now();r.lastTileScheduleAt=t;let n=TM(r);r.visibleTileIds=n;let i=r.scene.loading.size,c=Math.max(0,(a?oM:iM)-i),l=[...n].map(d=>r.scene.tiles.get(d)).filter(d=>d&&!r.scene.residentTiles.has(d.id)&&!r.scene.loading.has(d.id)&&!r.scene.failed.has(d.id)).sort((d,p)=>pb(d,r)-pb(p,r)).slice(0,c),f=_e;for(let d of l)SM(d,f,r);for(let d of n){let p=r.scene.residentTiles.get(d);p&&(p.lastUsed=t)}Qb(n,void 0,r),IM(n,t,r),_M(n,t,r),r.tileSchedulerMs=performance.now()-s}function TM(t=k){let e=new Set,r=M.mode==="3d"?t.visible3dLayers:RM();if(!r.size||!ee)return e;if(M.mode==="layer"){for(let c of t.scene.tiles.values())r.has(Number(c.layerId))&&e.add(c.id);return e}let a=new Set,s=Cc(t);if(s.size){for(let c of t.scene.tiles.values())if(r.has(Number(c.layerId))){for(let l of s)if(ep(c,l)){a.add(c.id);break}}}let n=Ic(t),i=[ee.matrix,...AM(),...t===k?es.active(performance.now()):[]],o=0;for(let c of t.scene.tiles.values()){if(!r.has(Number(c.layerId))||n&&oi(Number(c.layerId),t))continue;let l=M.mode==="layer"?vr.get(Number(c.layerId)):null;i.some(f=>Yn(c,f,l,rM,t))&&e.add(c.id),!t.scene.residentTiles.has(c.id)&&Yn(c,ee.matrix,l,0,t)&&(o+=1)}for(let c of a)e.add(c);return t.visibleTileMisses=o,e}function AM(){if(!G?.moving?.()||M.mode==="layer")return[];let t=performance.now();return Va.at===t||(Va.at=t,Va.views=[0,1].map(e=>G.targetMatrix(L.width,L.height,!1,e))),Va.views}var Va={at:-1,views:[]};function _M(t,e,r){if(M.mode==="layer"||!ee)return;let a=Ic(r);for(let s of[...r.scene.residentTiles.values()]){if(t.has(s.tile.id)||r.scene.loading.has(s.tile.id))continue;let n=Number(s.tile.layerId);if(r.visible3dLayers.has(n)&&!(a&&oi(n,r))&&Yn(s.tile,ee.matrix,null,aM,r)){s.lastUsed=e;continue}e-s.lastUsed>sM&&_c(s.tile.id,r)}}function Xb(t,e){return t?"all":e?"lit":"none"}function Ic(t){return!!t.renderer&&t.renderer.innerCopperMode!=="all"}function IM(t,e,r){if(Ic(r))for(let a of[...r.scene.residentTiles.values()])t.has(a.tile.id)||r.scene.loading.has(a.tile.id)||oi(Number(a.tile.layerId),r)&&e-a.lastUsed>hM&&_c(a.tile.id,r)}function RM(){return M.mode!=="layer"||$.phase==="idle"?k.compareLayers:Jb($.previous,$.target)}function $b(){return M.mode!=="layer"?k.visible3dLayers:$.phase==="reveal"?Jb($.previous,$.target):k.compareLayers}function Yb(t=k){let e=t.scene.copperLayers.map(r=>Number(r.id)).filter(Number.isFinite);return e.length?e.length===1?new Set([e[0]]):new Set([e[0],e[e.length-1]]):new Set}function NM(){let t=k.desiredCompareLayers.size?k.desiredCompareLayers:k.compareLayers;return t.size?new Set([...t].map(Number)):Yb()}function Jb(...t){let e=new Set;for(let r of t)for(let a of r||[])e.add(Number(a));return e}function Qb(t,e=ub,r=k){if(M.mode==="layer")return;let a=Math.min(ub,e);if(r.residentTileGpuBytes<=a)return;let s=[...r.scene.residentTiles.values()].filter(n=>!t.has(n.tile.id)&&!r.scene.loading.has(n.tile.id)).sort((n,i)=>n.lastUsed-i.lastUsed);for(let n of s){if(r.residentTileGpuBytes<=a)break;_c(n.tile.id,r)}}function Yn(t,e,r=null,a=0,s=k){let n=Zb(t,s);if(!n)return!0;let i=Math.max(n[3]-n[0],n[4]-n[1])*a,o=[n[0]-i+(r?.[0]||0),n[1]-i+(r?.[1]||0),n[2]-.002,n[3]+i+(r?.[0]||0),n[4]+i+(r?.[1]||0),n[5]+.002],c=s.renderer?.occurrenceMatrices;return!c||c.length===1&&js(c[0])?bb(o,e):c.some(l=>bb(o,cr(e,l)))}function Zb(t,e=k){let r=t.boundsMm;if(!r||r.length!==4)return null;let a=e.scene.layers.find(n=>Number(n.id)===Number(t.layerId)),s=Number(a?.z_mm||0)/1e3;return[r[0]/1e3,-r[3]/1e3,s-4e-4,r[2]/1e3,-r[1]/1e3,s+4e-4]}function bb(t,e){let r=[[t[0],t[1],t[2]],[t[3],t[1],t[2]],[t[0],t[4],t[2]],[t[3],t[4],t[2]],[t[0],t[1],t[5]],[t[3],t[1],t[5]],[t[0],t[4],t[5]],[t[3],t[4],t[5]]].map(s=>CM(e,s));return![s=>s[0]<-s[3],s=>s[0]>s[3],s=>s[1]<-s[3],s=>s[1]>s[3],s=>s[2]<0,s=>s[2]>s[3]].some(s=>r.every(s))}function CM(t,e){let r=e[0],a=e[1],s=e[2];return[t[0]*r+t[4]*a+t[8]*s+t[12],t[1]*r+t[5]*a+t[9]*s+t[13],t[2]*r+t[6]*a+t[10]*s+t[14],t[3]*r+t[7]*a+t[11]*s+t[15]]}function ep(t,e){return Array.isArray(t.netIds)&&t.netIds.some(r=>Number(r)===Number(e))}function pb(t,e=k){let r=Zb(t,e);if(!r||!G)return 0;let a=(r[0]+r[3])*.5-G.focus[0],s=(r[1]+r[4])*.5-G.focus[1];return a*a+s*s}async function tp(t=_e,e=k){let r=e.semanticGeometry.assets?.base_board_glb;if(!r)return null;let a=e.semanticGeometry.assets?.soldermask_glb,[s,n]=await Promise.all([fa(new URL(r,location.href).toString(),{defaultFeatureId:0,fetchBytes:Qa(e)}),a?fa(new URL(a,location.href).toString(),{defaultFeatureId:0,fetchBytes:Qa(e)}).catch(o=>(console.warn("[prism-semantic-viewer] solder mask failed to load",o),null)):null]);if(!ge(t)||!e.renderer)return null;e.renderer.stackupLooks=e.semanticGeometry.board_looks||null,e.loadedBytes+=s.byteLength,n&&(e.loadedBytes+=n.byteLength);let i=[...s.primitives.filter(o=>{let c=gi(o);return c!=="pad"&&!(n&&c==="soldermask")}),...n?.primitives||[]];for(let o of aa(i,gi)){let c=cM.includes(o.groupKey);e.renderer.addPrimitive(o,{kind:"board",boardRole:o.groupKey,...c?{side:Yc(o)}:{},layerId:o.groupKey==="paste"?_k(o,e):0,material:o.material,color:o.material.baseColor})}return e.renderer.setHiddenBoardLayers(M.hiddenBoardLayers),_r(i.map(o=>o.bounds))}function or(t=k){return t.scene.runtimeBounds||na(t.scene.manifest?.bbox)}function oi(t,e=k){return Qc(t,e.scene.copperLayers)}function rp(t,e){let{back:r}=G.basis();return{eye:Oe(G.focus,Me(r,G.distance)),orthographic:e,pixelScale:e?t/Math.max(1e-9,G.orthoScale):t/2/Math.tan(G.fov/2)}}function ap(){if(w)return BM();let t=k.renderer?.cullCounts||{full:0,board:0,body:0,box:0,culled:0},e=!k.renderer||k.renderer.identityOnly;return{occurrences:k.renderer?.occurrenceMatrices.length||0,lod:e?{full:1,board:0,body:0,box:0,culled:0}:{...t},triangles:k.renderer?.frameStats.triangles||0,draws:k.renderer?.frameStats.draws||0,gpuMemoryBytes:k.renderer?.gpuMemoryBytes()||0,gpuBreakdown:k.renderer?.gpuMemoryBreakdown()||null,gpuBudgetBytes:M.gpuBudgetBytes,componentTier:k.scene.componentTier,componentEvictions:k.scene.componentEvictions,tileEvictions:k.tileEvictions,visibleTileMisses:k.visibleTileMisses||0,cache:k.assetCache?k.assetCache.summary():{enabled:!1},frameIntervalMs:M.frameIntervalMs,frameIntervalP95Ms:M.frameIntervalP95Ms,frameCpuMs:M.frameCpuMs,frameCpuP95Ms:M.frameCpuP95Ms,fps:M.fps}}function BM(){let t=st(),e=t.map(r=>r.scene.componentTier);return{occurrences:w.scene.occurrenceCount||0,lod:w.scene.cullCounts(),triangles:w.scene.frameStats.triangles,draws:w.scene.frameStats.draws,gpuMemoryBytes:w.scene.gpuMemoryBytes(),gpuBreakdown:w.scene.gpuMemoryBreakdown(),gpuBudgetBytes:M.gpuBudgetBytes,componentTier:`${e.filter(r=>r==="loaded").length}/${t.length} loaded`,componentEvictions:t.reduce((r,a)=>r+a.scene.componentEvictions,0),tileEvictions:t.reduce((r,a)=>r+a.tileEvictions,0),visibleTileMisses:t.reduce((r,a)=>r+(a.visibleTileMisses||0),0),componentMisses:t.filter(r=>r.renderer.cullCounts.full>0&&r.scene.componentTier!=="loaded"&&r.semanticGeometry.assets?.components_glb).length,cache:t.find(r=>r.assetCache)?.assetCache.summary()||{enabled:!1},frameIntervalMs:M.frameIntervalMs,frameIntervalP95Ms:M.frameIntervalP95Ms,frameCpuMs:M.frameCpuMs,frameCpuP95Ms:M.frameCpuP95Ms,fps:M.fps,firstFrame:w.timing.boardsDrawnAt==null?null:{sinceSceneMs:w.timing.boardsDrawnAt-w.timing.descriptorAt,sinceNavigationMs:w.timing.boardsDrawnAt}}}function sp(t){M.showStats=!!t,Wa&&(Wa.hidden=!M.showStats),xt&&(xt.hidden=!(M.showStats&&w)),M.showStats&&w&&jM(),np()}var bc="prism.systemScene.lodThresholds",OM=Object.freeze([{key:"fullPx",label:"Parts",max:600},{key:"boardPx",label:"Copper",max:400},{key:"boxPx",label:"Box below",max:120}]);function FM(){try{let t=JSON.parse(globalThis.localStorage?.getItem(bc)||"null");if(t&&typeof t=="object")return Nr(t)}catch{}return{...dt}}function PM(t){try{t?globalThis.localStorage?.setItem(bc,JSON.stringify(t)):globalThis.localStorage?.removeItem(bc)}catch{}}function pc(t){if(!w)return null;let e=t==null?{...dt}:{...w.scene.lodThresholds,...t},r=w.scene.setLodThresholds(e);return PM(t==null?null:r),gc(),r}function jM(){if(!xt||xt.childElementCount)return gc();let t=document.createElement("h2");t.textContent="Detail thresholds (CSS px)",xt.append(t);for(let r of OM){let a=document.createElement("label"),s=document.createElement("span");s.textContent=r.label;let n=document.createElement("input");Object.assign(n,{type:"range",min:"0",max:String(r.max),step:"1"}),n.dataset.key=r.key;let i=document.createElement("output");n.addEventListener("input",()=>pc({[r.key]:Number(n.value)})),a.append(s,n,i),xt.append(a)}let e=document.createElement("button");e.type="button",e.textContent="Defaults",e.addEventListener("click",()=>pc(null)),xt.append(e),gc()}function gc(){if(!xt||!w)return;let t=w.scene.lodThresholds;for(let e of xt.querySelectorAll("input[data-key]"))e.value=String(t[e.dataset.key]),e.nextElementSibling.value=String(Math.round(t[e.dataset.key]))}function np(){if(!Wa||!M.showStats)return;let t=ap(),{full:e,board:r,body:a,box:s,culled:n}=t.lod,i=[["Occurrences",`${t.occurrences} (${e+r+a+s} visible)`],["Detail",`${e} full \xB7 ${r} board \xB7 ${a} body \xB7 ${s} box \xB7 ${n} culled`],["Triangles",t.triangles.toLocaleString()],["Draws",t.draws.toLocaleString()],["GPU memory",`${(t.gpuMemoryBytes/1048576).toFixed(1)} / ${(t.gpuBudgetBytes/1048576).toFixed(0)} MB`],["Components",`${t.componentTier}${t.componentEvictions?` \xB7 ${t.componentEvictions} evicted`:""}`],["Cache",t.cache.enabled?`${t.cache.hits} hits \xB7 ${t.cache.misses} misses \xB7 ${(t.cache.bytes/1048576).toFixed(0)} MB`:"off"],["Frame",`${t.frameIntervalMs.toFixed(1)} ms \xB7 p95 ${t.frameIntervalP95Ms.toFixed(1)}`],["CPU",`${t.frameCpuMs.toFixed(2)} ms \xB7 p95 ${t.frameCpuP95Ms.toFixed(2)}`],["FPS",t.fps.toFixed(0)]];Wa.innerHTML=i.map(([o,c])=>`<dt>${o}</dt><dd>${c}</dd>`).join("")}var LM="prism.system_scene.a0";function st(){return w?[...w.boards.values()].filter(t=>t.renderer&&t.loadState==="loaded"):[]}async function ip(t={}){let e=jb();if(rs=typeof t.onSelectionChange=="function"?t.onSelectionChange:null,$n=typeof t.onContextMenu=="function"?t.onContextMenu:null,Xn=typeof t.onViewStateChange=="function"?t.onViewStateChange:null,ni=typeof t.isActive=="function"?t.isActive:()=>!0,$a=!1,M.gpuBudgetBytes=xn,Rb(t.root||document),!Nt||!L)throw new Error("Semantic viewer shell is missing required DOM nodes");if(typeof t.loadBundle!="function")throw new Error("A system scene needs a bundle loader");let r=await $s.create(L);return ge(e)?(r.setLodThresholds(FM()),w={scene:r,loadBundle:t.loadBundle,onEmphasis:typeof t.onEmphasis=="function"?t.onEmphasis:null,onMove:typeof t.onMove=="function"?t.onMove:null,onHarness:typeof t.onHarness=="function"?t.onHarness:null,baseDescriptor:null,descriptor:null,move:ik(),gizmo:null,standInKey:null,showLabels:!0,harnesses:[],harnessLit:new Map,showHarnesses:!0,harnessDrawn:null,tubes:[],tubedHarnesses:new Set,harnessPick:null,worlds:new Map,nodePreview:null,housingModels:new Map,timing:{descriptorAt:null,boardsDrawnAt:null},boards:new Map,groups:new Map,placed:[],placements:new Map,hiddenLayers:new Map,separation:new Map,bounds:null,framed:!1,snapped:!1,boardSelected:!1,inputs:new Map,emphasisSets:[],emphasisBounds:new Map,emphasisReport:null},k=ts({key:""}),G=new ia([-.1,-.1,-.01,.1,.1,.01]),zc(),$p(),qp(),ag(),qr.textContent="System scene",Ya(e),{...Db(),focusPlacement:$M,selectBoardContext:Xc,setEmphasisSets:rk,setSystemScene:DM,frameNetEmphasis:ak,frameAll(){w?.bounds&&G.frame(w.bounds)},setMoveAllowed:ok,setMoveMode:Jn,setMoveSpace:vp,previewPose:ck,cancelMove:jc,getMoveState:()=>w?wp():null,targetHarnessNode:fi,selectHarness:Mk,previewHarnessNode:kk,cancelHarnessNode:Ap,getHarnessState:()=>w?Tp():null,setLabelsVisible(a){w&&(w.showLabels=!!a,wr&&(wr.hidden=!w.showLabels))},setHelpVisible:kp,isHelpVisible:()=>!!(Rt&&!Rt.hidden),setHarnessesVisible(a){w&&(w.showHarnesses=!!a,w.harnessDrawn=null,Xr({relabel:!1}))},frameBoard(a){let s=w?.placements.get(String(a));return s&&G.frame(s.worldBounds),!!s},frameParts:sk,resize(){w?.scene.resize()},setLodOverride(a){for(let s of st())s.renderer.setLodOverride(a)},setLodThresholds:pc,pickSurfaceAt:fE,focusMoveTarget:hE,viewAxis(a,s=!1){!w||!["x","y","z"].includes(a)||(G.setAxis(a,!!s),w.bounds&&G.frame(w.bounds))},projectPoint(a,s){return yb(a,s)},projectComponent(a,s){let n=w?.placements.get(String(s));return n?.board?eg(n.board,a,i=>yb(i,s)):null},dispose(){Lb(e)}}):(r.dispose(),null)}function DM(t){if(!w)return;if(t?.schema!==LM)throw new Error(`Unsupported system scene schema: ${t?.schema||"missing"}`);w.baseDescriptor=t,w.timing.descriptorAt??=performance.now();let e=w.move.target?t.occurrences.find(a=>a.path===w.move.target):null;e?!w.move.drag&&yp(w.move.preview,e.pose)&&(w.move.preview=null):(w.move.drag=null,w.move.preview=null,w.move.target=null),w.descriptor=xp(),w.harnesses=Array.isArray(t.harnesses)?t.harnesses:[],w.harnessDrawn=null;let r=new Set;for(let a of t.assets||[]){r.add(a.assetId);let s=w.boards.get(a.assetId),n=Zf(s,a);if(n!=="create"){s.asset=a,n==="load"&&mb(s,_e);continue}s&&gb(a.assetId);let i=ts({key:a.assetId,topology:{},semanticGeometry:{},deferComponents:!0});Object.assign(i,{asset:a,bundleUrl:a.bundleUrl,loadState:"waiting",abort:null}),w.boards.set(a.assetId,i),Co(a)&&mb(i,_e)}for(let a of[...w.boards.keys()])r.has(a)||gb(a);Xr(),Ek(),w.move.enabled&&(ss({quiet:!0}),Mt("sync"))}function gb(t){let e=w.boards.get(t);e?.abort?.abort(),w.boards.delete(t),w.scene.removeAsset(t),e&&(e.renderer=null),k===e&&Rc()}async function mb(t,e){t.loadState="loading",t.abort=new AbortController;let r=()=>ge(e)&&w?.boards.get(t.key)===t&&!t.abort.signal.aborted;try{let a=await w.loadBundle(t.bundleUrl,t.abort.signal);if(!r()||(t.topology=a.topology||{},t.topology.net_details||(t.topology.net_details=Fb(t.topology)),t.semanticGeometry=a.semanticGeometry||{},t.viewerReadiness=a.readiness||t.semanticGeometry.readiness||{stage:"semantic-ready",progress:100},t.assetCache=a.assetCache||null,!await Hb(t,e)||!r()))return;t.renderer=w.scene.asset(t.key),t.renderer.setBarrels(to(t.scene.manifest.barrels,t.scene.manifest.layers)),os(t);let s=await tp(e,t);if(!r())return;t.scene.runtimeBounds=s||na(t.scene.manifest.bbox),t.renderer.setBoardBounds(t.scene.runtimeBounds),t.loadState="loaded",Xr()}catch(a){if(!r())return;console.warn(`[prism-semantic-viewer] system board ${t.key} failed to load`,a),t.loadState="failed",t.error=a?.message||String(a),w.scene.removeAsset(t.key),t.renderer=null,k===t&&Rc(),Xr()}}function Xr({relabel:t=!0}={}){let e=w?.descriptor;if(!e)return;w.harnessDrawn=null;let r=Ja(),a=new Map((e.assets||[]).map(c=>[c.assetId,c])),s=new Map,n=[];for(let c of eh(e)){let l=c.assetId?a.get(c.assetId):null,f=c.assetId?w.boards.get(c.assetId):null,d=c.kind!=="board"&&!c.restricted?KM(c):null;if(d){s.has(d.rendererId)||s.set(d.rendererId,[]),s.get(d.rendererId).push({matrix:d.matrix,key:c.path,hiddenLayers:[],explode:null}),n.push({occurrence:c,rendererId:d.rendererId,board:null,matrix:d.matrix,worldBounds:d.worldBounds,standIn:null,own:d.kind,primitives:d.primitives});continue}if(c.model||c.box)continue;let p=Qf(c,l,f?.loadState),b,h,u;if(!p)b=f.key,h=bn(c.worldMatrix,l.bundleToBoard),u=Tt(h,f.scene.runtimeBounds);else{if(!c.boundsMm)continue;b=`stand-in:${p}`,w.scene.standIn(b,hn[p].color),h=Aa(c.worldMatrix,c.boundsMm),u=Tt(h,[0,0,0,1,1,1])}s.has(b)||s.set(b,[]),s.get(b).push({matrix:h,key:c.path,hiddenLayers:p?[]:[...w.hiddenLayers.get(c.path)||[]],explode:p?null:gp(f,w.separation.get(c.path)||0)}),n.push({occurrence:c,rendererId:b,board:p?null:f,matrix:h,worldBounds:u,standIn:p})}let i=cp();VM(s,i.housings);for(let c of w.scene.assets.keys())s.has(c)||s.set(c,[]);w.scene.setOccurrences(s),w.groups=s;let o=w.placements;if(w.placed=n,w.placements=new Map(n.map(c=>[c.occurrence.path,c])),t||!o)Tk();else for(let c of n)c.label=o.get(c.occurrence.path)?.label;w.bounds=_r(n.map(c=>c.worldBounds)),w.bounds&&(G.sceneRadius=Ot(w.bounds),w.framed||(G.frame(w.bounds),w.snapped||G.snap(),w.snapped=!0,n.some(c=>c.standIn==="loading")||(w.framed=!0)));for(let c of st())ci(c);r!=null&&(w.placements.get(r)?.board===k?M.selectedOccurrence=k.renderer.occurrenceKeys.indexOf(r):Rc()),wt(i),mp(),Bt()}var op=[.17,.18,.2],UM=[.24,.39,.87],zM=[.9,.28,.3];function cp(){if(w.worlds=new Map(w.descriptor.occurrences.map(t=>[t.path,t.worldMatrix])),!w.showHarnesses||!w.harnesses.length)return{tubes:[],housings:[]};try{let t=w.descriptor.occurrences.filter(e=>e.kind==="board"&&e.boundsMm).map(e=>({id:e.path,matrix:e.worldMatrix,...e.boundsMm}));return Yf(ko(w.harnesses,w.nodePreview,_t),Zr,t)}catch(t){return console.warn("[prism-semantic-viewer] harness geometry failed",t),{tubes:[],housings:[]}}}function wt(t=null){if(!w?.descriptor)return;let e=(t??cp()).tubes;w.tubes=e,w.tubedHarnesses=new Set(e.map(r=>r.harness)),w.scene.setTubes(e,fp)}var mc=[.42,.45,.5,1],lp=Object.freeze([1e3,0,0,0,0,0,-1e3,0,0,1e3,0,0,0,0,0,1]);function GM(t){return{...pp(t),showBoard:!1,showComponents:!0}}function dp(t,e){return t.housing?GM(e):pp(e)}function KM(t){if(t.model?.glbKey){let e=cr(t.worldMatrix,t.model.matrixMm||rt),r=w.housingModels.get(t.model.glbKey);if(r||up(t.model.glbKey),r?.state==="ready"){let a=bn(e,lp);return{kind:"model",rendererId:`housing:${t.model.glbKey}`,matrix:a,worldBounds:Tt(a,r.bounds),primitives:r.primitives}}if(t.model.boundsMm){w.scene.standIn("housing:proxy",mc);let a=Aa(e,t.model.boundsMm);return{kind:"model",rendererId:"housing:proxy",matrix:a,worldBounds:Tt(a,[0,0,0,1,1,1])}}}if(t.box?.boundsMm){let e=t.box.rgba||mc,r=th(e);w.scene.standIn(r,e);let a=Aa(t.worldMatrix,t.box.boundsMm);return{kind:"box",rendererId:r,matrix:a,worldBounds:Tt(a,[0,0,0,1,1,1])}}return null}function VM(t,e){let r=(a,s)=>{t.has(a)||t.set(a,[]),t.get(a).push({...s,hiddenLayers:[],explode:null})};for(let a of e){let s=`housing:${a.key}`,n=a.model?w.housingModels.get(a.model.glbKey):null;if(a.model&&!n&&up(a.model.glbKey),n?.state==="ready"){r(`housing:${a.model.glbKey}`,{key:s,matrix:bn(a.matrix,lp)});continue}w.scene.standIn("housing:proxy",mc);let i=a.model?a.model.boundsMm:{minMm:[0,0,0],maxMm:[1,1,1]};r("housing:proxy",{key:s,matrix:Aa(a.matrix,i)})}}async function up(t){w.housingModels.set(t,{state:"loading"});let e=_e;try{let r=await fa(new URL(`/api/catalog/models/${encodeURIComponent(t)}.glb`,location.href).toString(),{fetchCache:"force-cache"});if(!ge(e)||!w)return;let a=w.scene.asset(`housing:${t}`);a.housing=!0,a.setLodOverride(Ls);let s=[1/0,1/0,1/0,-1/0,-1/0,-1/0];for(let n of r.primitives){for(let i=0;i<3;i+=1)s[i]=Math.min(s[i],n.bounds[i]),s[i+3]=Math.max(s[i+3],n.bounds[i+3]);a.addPrimitive(n,{kind:"component",layerId:0,material:n.material,color:n.material.baseColor})}r.primitives.length&&a.setBoardBounds(s),w.housingModels.set(t,{state:"ready",bounds:s,primitives:r.primitives})}catch(r){console.warn("[prism-semantic-viewer] housing model failed",t,r),w&&w.housingModels.set(t,{state:"failed"})}w?.descriptor&&Xr({relabel:!1})}function Zr(t){return w.worlds.get(t)??null}function fp(t){let e=w.harnessLit.get(t.harness),r=e?t.wires.map(a=>e.get(a)).find(Boolean):null;return r?{rgb:HM(r),mode:1}:t.collides.length?{rgb:zM,mode:0}:w.harnessPick?.key===t.harness?{rgb:UM,mode:0}:{rgb:op,mode:w.emphasisSets.length?2:0}}function HM(t){let e=/^#?([0-9a-f]{6})$/i.exec(String(t));if(!e)return op;let r=Number.parseInt(e[1],16);return[(r>>16&255)/255,(r>>8&255)/255,(r&255)/255]}function Ja(){return!w||!k.renderer||!hp()?null:k.renderer.occurrenceKeys[M.selectedOccurrence]??null}function hp(){return!!(M.selectedFeatureId||M.activeNetId||w?.boardSelected)}function bp(t){if(k===t)return;let e=Je;Je=!0;try{Ve()}finally{Je=e}k=t,He()}function Rc(){Ve(),k=ts({key:""}),He()}function qM(t,e){let r=performance.now(),a=Math.max(0,t-nr),s=Math.min(.05,(t-nr)/1e3);nr=t,G.update(s),w.scene.resize(),ee={layerId:0,viewport:{x:0,y:0,width:L.width,height:L.height},matrix:G.matrix(L.width,L.height,!1),lod:rp(L.height/Math.min(devicePixelRatio||1,2),!1)};let n=Qr(),i=new Map;for(let o of st()){let c=QM(o);o.scene.copperRealism!==$r()&&os(o),o.renderer.setInnerCopperMode(Xb(!M.showBoard||ZM(o),Cc(o).size>0)),o.renderer.dimCopper=n,Re(t,{},o);let l=o===k;i.set(o.renderer,{activeNetId:l?M.activeNetId:0,selectedFeatureId:l?M.selectedFeatureId:0,time:t/1e3,layerOffsets:c,visibleLayers:o.visible3dLayers,showBoard:M.showBoard,showComponents:M.showComponents,showPaste:!0,componentOpacity:1,boardOpacity:n?.34:1,isolateNet:M.isolateNet,compareMode:!1,compareOffsets:new Map,layerAlphas:null,visibleTileIds:o.visibleTileIds})}w.inputs=i,w.scene.setSelectedOccurrence(k.renderer&&hp()?k.renderer.occurrenceBase+M.selectedOccurrence:-1),Dk(t,i,n)&&(w.scene.render(ee,o=>i.get(o)||dp(o,t)),rg(),Ak()),yk(),Sk(),dk(),w.timing.boardsDrawnAt==null&&rh(w.placed)&&(w.timing.boardsDrawnAt=performance.now());for(let o of st())Ip(t,o);vc(a,performance.now()-r),Mc(t),Ya(e)}function pp(t){return{activeNetId:0,selectedFeatureId:0,time:t/1e3,visibleLayers:new Set,showBoard:!0,showComponents:!1,componentOpacity:1,boardOpacity:1,isolateNet:!1}}function WM(t,e){let r=performance.now();return w.scene.pick(ee,t,e,a=>w.inputs.get(a)||dp(a,r))}function XM(t){let e=typeof t.occurrenceKey=="string"&&t.occurrenceKey.startsWith("housing:")?t.occurrenceKey.slice(8):null;if(e){let s=e.lastIndexOf("/"),[n,i]=[e.slice(0,s),e.slice(s+1)],o=w.tubes.find(c=>c.harness===n&&(c.from===i||c.to===i));o?Mr({key:n,segmentId:o.segmentId,pointMm:null}):Ve();return}let r=t.occurrenceKey!=null?w.placements.get(t.occurrenceKey):null;if(!r)return Ve();if(r.standIn||r.own)return Nc(r);let a=r.board;if(M.isolateNet&&!YM(a,r.occurrence.path,t.featureId))return Ve();bp(a),M.selectedOccurrence=a.renderer.occurrenceKeys.indexOf(r.occurrence.path),t.featureId&&!w.move.enabled?Sr(t.featureId,!0):Xc()}function $M(t){let e=t!=null?w?.placements.get(String(t)):null;return e?e.standIn||e.own?(Nc(e),"stand-in"):(bp(e.board),M.selectedOccurrence=k.renderer.occurrenceKeys.indexOf(e.occurrence.path),"board"):null}function Nc(t){let e=Je;Je=!0;try{Ve()}finally{Je=e}w.standInKey=t.occurrence.path,w.move.enabled&&ss(),Je||rs?.({kind:"board",sourceContext:"3D",occurrence:t.occurrence.path,standIn:t.standIn})}function YM(t,e,r){let a=Number(t.scene.features.get(Number(r))?.netId)||0;if(!a)return!1;let s=t.renderer.occurrenceKeys.indexOf(e);return s<0?!1:t.renderer.occurrenceEmphasis?.[s]?.has(a)?!0:t===k&&s===M.selectedOccurrence&&a===Number(M.activeNetId)}function yb(t,e){let r=w?.placements.get(String(e));return r?yr(t,r.matrix):null}function Cc(t=k){if(!w)return Wr();let e=new Set(t===k?Wr():[]);for(let r of t.renderer?.occurrenceEmphasis||[])if(r)for(let a of r.keys())e.add(Number(a));return e}function ci(t){let e=w.groups.get(t.key)||[],r=new Set;for(let a of t.scene.copperLayers){let s=Number(a.id);e.some(n=>!w.hiddenLayers.get(n.key)?.has(s))&&r.add(s)}if(M.isolateNet){let a=new Set;for(let s of Cc(t))for(let n of Gc(s,t))a.add(n);t.visible3dLayers=new Set([...r].filter(s=>a.has(s)))}else t.visible3dLayers=r;Re(performance.now(),{force:!0},t)}function Bc(t,e){let r=t??(w.groups.get(k.key)||[]).map(a=>a.key);for(let a of r){let s=new Set(w.hiddenLayers.get(String(a))||[]);e(s,w.placements.get(String(a))?.board),w.hiddenLayers.set(String(a),s)}for(let a of st()){let s=w.groups.get(a.key)||[];for(let n of s)n.hiddenLayers=[...w.hiddenLayers.get(n.key)||[]];a.renderer.setOccurrenceHiddenLayers(s.map(n=>n.hiddenLayers)),ci(a)}He(),Bt()}function JM(){let t=Ja();if(t==null||!M.activeNetId)return;let e=Gc(M.activeNetId,k);e.size&&Bc([t],r=>{r.clear();for(let a of k.scene.copperLayers)e.has(Number(a.id))||r.add(Number(a.id))})}function QM(t){if(t.scene.layerSteps)return t.scene.layerSteps;let e=new Float32Array(256),r=(t.scene.copperLayers.length-1)/2;return t.scene.copperLayers.forEach((a,s)=>{e[Number(a.id)]=r-s}),t.scene.layerSteps=e,e}function gp(t,e){let r=t?.scene.runtimeBounds,a=r?Math.hypot((r[3]-r[0])*1e3,(r[4]-r[1])*1e3):0;return[e*e*fe(a*.12,8,25)/1e3,e<.0999?1:0,1-e*.72,1]}function ZM(t){return(w.groups.get(t.key)||[]).some(e=>(w.separation.get(e.key)||0)>.001)}function ek(t,e){let r=e!=null?[String(e)]:(w.groups.get(k.key)||[]).map(a=>a.key);for(let a of r)w.separation.set(a,t);for(let a of st()){let s=w.groups.get(a.key)||[];a.renderer.setOccurrenceExplode(s.map(n=>gp(a,w.separation.get(n.key)||0)))}Bt()}function tk(){return w.placed.filter(t=>!t.own).map(t=>{let e=w.hiddenLayers.get(t.occurrence.path)||new Set,r=t.board;return{key:t.occurrence.path,name:t.occurrence.displayPath||t.occurrence.path,standIn:t.standIn||null,separation:w.separation.get(t.occurrence.path)||0,layers:r?r.scene.copperLayers.map(a=>({id:Number(a.id),name:String(a.name),color:bi(hi(a,r)),visible:!e.has(Number(a.id))})):[]}})}function rk(t){return w?(w.emphasisSets=t,mp()):null}function mp(){if(!w)return[];let t=new Map;for(let[n,i]of w.groups)t.set(n,i.map(()=>null));let e=new Map;for(let n of w.groups.values())n.forEach((i,o)=>e.set(i.key,o));w.emphasisBounds=new Map;let r=w.emphasisSets.map(n=>{let i={key:n.key,color:n.color,lit:0,unresolved:[]},o=[];w.emphasisBounds.set(n.key,o);for(let c of n.members){let l=w.placements.get(c.occurrence),f=l?.board;if(!f&&l?.own){i.lit+=1,l.worldBounds&&o.push({occurrence:c.occurrence,box:l.worldBounds});continue}if(!f){let m=l?l.standIn==="loading"||l.standIn==="building"?"loading":l.standIn==="restricted"?"restricted":"not-drawn":"not-drawn";i.unresolved.push({occurrence:c.occurrence,net:c.net,reason:m});continue}let d=lr(f.scene.nets,c.net),p=Number(d?.id)||0;if(!p){i.unresolved.push({occurrence:c.occurrence,net:c.net,reason:"unknown-net"});continue}let b=t.get(f.key),h=e.get(c.occurrence);if(!b||h==null)continue;b[h]=b[h]||new Map,b[h].has(p)||b[h].set(p,n.mark),i.lit+=1;let u=sa(d.boundsMm);u&&o.push({occurrence:c.occurrence,box:Tt(l.matrix,u)})}return i});w.harnessLit=hf(w.harnesses,w.emphasisSets),w.harnessDrawn=null,w.scene.setTubeColors(fp);for(let n of r){n.wires=0;for(let i of w.harnessLit.values())for(let o of i.values())o===n.color&&(n.wires+=1)}let a=w.emphasisSets.length>0;for(let n of st())n.renderer.setOccurrenceEmphasis(a&&t.get(n.key)||null,{dimCopper:a});if(M.isolateNet)for(let n of st())ci(n);let s=JSON.stringify(r)!==JSON.stringify(w.emphasisReport);return w.emphasisReport=r,s&&w.onEmphasis?.(r),r}function ak(t=null,e=null){let r=[];for(let[s,n]of w?.emphasisBounds||[])if(!(t!=null&&s!==String(t)))for(let i of n)(e==null||i.occurrence===e)&&r.push(i.box);let a=_r(r);return a?(G.frame(a),!0):!1}function sk(t){let e=[];for(let a of Array.isArray(t)?t:[]){let s=w?.placements.get(String(a?.occurrence));if(s&&!a?.reference){s.worldBounds&&e.push(s.worldBounds);continue}let n=s?.board?.scene.componentFeatures.get(String(a?.reference)),i=n?s.board.scene.features.get(Number(n.featureId))?.bounds:null;i&&e.push(Tt(s.matrix,i))}let r=_r(e);return r?(G.frame(r),!0):!1}var Oc=.001,nk=90,xb=["#e5484d","#30a46c","#3e63dd"],dc=["X","Y","Z"];function yp(t,e){if(!t||!e)return!1;let r=tr(t),a=tr(e),s=[...r.translationMm,...r.rotation],n=[...a.translationMm,...a.rotation];return s.every((i,o)=>Math.abs(i-n[o])<1e-6)}function ik(){return{allowed:!1,enabled:!1,route:!1,space:"world",target:null,preview:null,drag:null,node:null}}function xp(){let t=w.baseDescriptor;return!t||!w.move.target||!w.move.preview?t:Fd(t,w.move.target,w.move.preview)}function as(){w.baseDescriptor&&(w.descriptor=xp(),Xr({relabel:!1}))}function Fc(){let t=w.move.target;return t?w.baseDescriptor?.occurrences.find(e=>e.path===t)??null:null}function wp(){let t=w.move,e=Fc();return{allowed:t.allowed,enabled:t.enabled,route:t.route,space:t.space,dragging:!!t.drag,target:e?{occurrence:e.path,instanceId:e.instanceId,displayPath:e.displayPath,kind:e.kind,restricted:!!e.restricted,pose:tr(t.preview??e.pose),source:t.preview?"manual":e.pose?.source??"default",unsaved:!!t.preview}:null}}function Mt(t){w.onMove?.({phase:t,...wp()})}function ok(t){w.move.allowed=!!t,!w.move.allowed&&w.move.enabled&&Jn(!1)}function Jn(t,{route:e=!1}={}){let r=!!t&&w.move.allowed,a=r&&!!e;r===w.move.enabled&&a===w.move.route||(w.move.route=a,a&&yc(),r||(yc(),w.move.node&&(w.move.node=null,w.nodePreview&&(w.nodePreview=null,wt()),Ne("target"))),w.move.enabled=r,r&&ss({quiet:!0}),Mt("mode"))}function vp(t){w.move.space=t==="local"?"local":"world",Mt("mode")}function Pc(){return w.standInKey??Ja()}function ss({quiet:t=!1}={}){if(!w)return;let e=Pc(),r=w.move.enabled&&!w.move.route&&e!=null?Od(w.baseDescriptor,e):null,a=r&&r.move!==!1?r.path:null;a!==w.move.target&&(yc(),w.move.target=a,t||Mt("target"))}function yc(){let t=!!w.move.preview;w.move.drag=null,w.move.preview=null,w.move.target=null,t&&as()}function ck(t){w?.move.target&&(w.move.preview=t?tr(t):null,as(),Mt("preview"))}function jc(){!w||!w.move.preview&&!w.move.drag||(w.move.drag=null,w.move.preview=null,as(),Mt("cancel"))}function lk(){let t=`${w.move.target}/`,e=_r(w.placed.filter(r=>r.occurrence.path===w.move.target||r.occurrence.path.startsWith(t)).map(r=>r.worldBounds));return e?[0,1,2].map(r=>(e[r]+e[r+3])/2/Oc):null}function ir(t){let e=ba(ee.matrix,Me(t,Oc),ee.viewport);if(!e)return null;let r=L.getBoundingClientRect();return[e.x*r.width/L.width,e.y*r.height/L.height]}function dk(){let t=at;if(!t)return;let e=w.move.enabled&&ee?ui():null,r=e?null:Fc(),a=r&&typeof r.move=="object"?r.move:null,s=a?w.move.preview??r.pose:null,n=e?e.worldMm:w.move.enabled&&r&&ee?a?.pivot==="origin"?[...s.translationMm]:lk():null,i=n?ir(n):null;if(!i){t.toggleAttribute("hidden",!0),w.gizmo=null;return}t.toggleAttribute("hidden",!1),t.firstChild||uk(t);let{right:o,back:c}=G.basis(),l=ir(Oe(n,o)),f=l?Math.hypot(l[0]-i[0],l[1]-i[1]):0;if(!(f>1e-6)){t.toggleAttribute("hidden",!0);return}let d=nk/f,p=r?w.move.preview??r.pose:null,b=p&&(a||w.move.space==="local")?Nd(p):qi,h=[];b.forEach((m,g)=>{let y=ir(Oe(n,Me(m,d))),x=t.querySelector(`[data-part="t${g}"]`),v=y&&Math.hypot(y[0]-i[0],y[1]-i[1])>12&&(!a||(a.translate||[]).includes(g));if(x.style.display=v?"":"none",v){let I=x.querySelector("line");I.setAttribute("x1",i[0]),I.setAttribute("y1",i[1]),I.setAttribute("x2",y[0]),I.setAttribute("y2",y[1]),x.querySelector("circle").setAttribute("cx",y[0]),x.querySelector("circle").setAttribute("cy",y[1]),x.querySelector("text").setAttribute("x",y[0]+9),x.querySelector("text").setAttribute("y",y[1]-7)}let E=Pd(m),S=Ze(m,E),T=[];for(let I=0;I<=64;I+=1){let N=I/64*Math.PI*2,C=ir(Oe(n,Me(Oe(Me(E,Math.cos(N)),Me(S,Math.sin(N))),d*.7)));C&&T.push(`${C[0].toFixed(1)},${C[1].toFixed(1)}`)}let _=t.querySelector(`[data-part="r${g}"]`);_.setAttribute("points",T.join(" ")),_.style.display=e||a&&!(a.rotate||[]).includes(g)?"none":"",h.push({axis:m,pxPerMm:y?[(y[0]-i[0])/d,(y[1]-i[1])/d]:[0,0]})});let u=t.querySelector('[data-part="pivot"]');u.setAttribute("cx",i[0]),u.setAttribute("cy",i[1]),w.gizmo={center:i,pivot:n,handles:h,back:c,limits:a}}function uk(t){let e="http://www.w3.org/2000/svg",r=(a,s)=>{let n=document.createElementNS(e,a);for(let[i,o]of Object.entries(s))n.setAttribute(i,o);return n};xb.forEach((a,s)=>{let n=r("polyline",{"data-part":`r${s}`,class:"ring",stroke:a,fill:"none"}),i=r("title",{});i.textContent=`Rotate about ${dc[s]}`,n.append(i),t.append(n)}),xb.forEach((a,s)=>{let n=r("g",{"data-part":`t${s}`,class:"arrow",stroke:a,fill:a}),i=r("title",{});i.textContent=`Move along ${dc[s]}`;let o=r("text",{stroke:"none"});o.textContent=dc[s],n.append(i,r("line",{}),r("circle",{r:6}),o),t.append(n)}),t.append(r("circle",{"data-part":"pivot",r:4,class:"pivot"})),t.append(r("text",{"data-part":"readout",class:"readout"})),t.addEventListener("pointerdown",fk),t.addEventListener("pointermove",hk),t.addEventListener("pointerup",bk),t.addEventListener("dblclick",a=>{!w?.move.node||w.move.node===sr||(a.preventDefault(),a.stopPropagation(),Ne("delete"))}),t.addEventListener("pointercancel",()=>Mp())}function fk(t){let e=t.target.closest?.("[data-part]")?.dataset.part;if(!w||!e||!w.gizmo||!/^[tr][012]$/.test(e))return;t.preventDefault(),t.stopPropagation();let r=at.getBoundingClientRect(),a=ui();if(a){if(e[0]!=="t")return;w.move.drag={kind:"node",handle:w.gizmo.handles[Number(e[1])],start:[t.clientX-r.left,t.clientY-r.top],startMm:a.worldMm,startPreview:w.nodePreview,matrix:Fr(kr(),Zr),changed:!1};try{at.setPointerCapture(t.pointerId)}catch{}return}let s=Fc(),n=w.gizmo.limits;if(!(n&&!((e[0]==="t"?n.translate:n.rotate)||[]).includes(Number(e[1])))){w.move.drag={kind:e[0]==="t"?"translate":"rotate",snapDeg:n?.rotateSnapDeg??null,handle:w.gizmo.handles[Number(e[1])],start:[t.clientX-r.left,t.clientY-r.top],startPose:tr(w.move.preview??s.pose),hadPreview:!!w.move.preview,center:w.gizmo.center,pivot:w.gizmo.pivot,back:w.gizmo.back,changed:!1};try{at.setPointerCapture(t.pointerId)}catch{}}}function hk(t){let e=w?.move.drag;if(!e)return;let r=at.getBoundingClientRect(),a=[t.clientX-r.left,t.clientY-r.top],s=t.shiftKey;if(e.kind==="node"){let o=Os(Wi([a[0]-e.start[0],a[1]-e.start[1]],e.handle.pxPerMm),s?fr.fineMm:fr.mm),c=Oe(e.startMm,Me(e.handle.axis,o));e.changed=e.changed||o!==0,w.nodePreview={harness:w.harnessPick.key,id:w.move.node,positionMm:e.matrix?ka(e.matrix,c):c},wb(`${o>=0?"+":""}${o.toFixed(s?1:0)} mm`,a),wt(),Ne("preview");return}let n,i;if(e.kind==="translate"){let o=Os(Wi([a[0]-e.start[0],a[1]-e.start[1]],e.handle.pxPerMm),s?fr.fineMm:fr.mm);n=Cd(e.startPose,e.handle.axis,o),i=`${o>=0?"+":""}${o.toFixed(s?1:0)} mm`}else{let o=Rd(e.handle.axis,e.back,Id(e.center,e.start,a))*180/Math.PI,c=Os(o,e.snapDeg??(s?fr.fineDeg:fr.deg));n=Bd(e.startPose,e.handle.axis,c*Math.PI/180,e.pivot),i=`${c>=0?"+":""}${c.toFixed(0)}\xB0`}e.changed=e.changed||!yp(n,e.startPose),w.move.preview=tr(n),wb(i,a),as(),Mt("preview")}function wb(t,e){let r=at.querySelector('[data-part="readout"]');r.textContent=t,r.setAttribute("x",e[0]+14),r.setAttribute("y",e[1]-10)}function bk(t){let e=w?.move.drag;if(e){if(at.hasPointerCapture?.(t.pointerId)&&at.releasePointerCapture(t.pointerId),w.move.drag=null,at.querySelector('[data-part="readout"]').textContent="",e.kind==="node"){e.changed&&Ne("commit");return}e.changed?Mt("commit"):e.hadPreview||jc()}}function Mp(){let t=w?.move.drag;return t?t.kind==="route"||t.kind==="handle"?(w.move.drag=null,t.changed&&(w.nodePreview=t.kind==="handle"?t.startPreview:null,wt(),Ne("cancel")),!0):(w.move.drag=null,t.kind==="node"?(at.querySelector('[data-part="readout"]').textContent="",w.nodePreview=t.startPreview,wt(),Ne("cancel"),!0):(w.move.preview=t.hadPreview?t.startPose:null,at.querySelector('[data-part="readout"]').textContent="",as(),Mt("cancel"),!0)):!1}function pk(t,e){let r=w.move;if(e==="escape"){if(Rt&&!Rt.hidden)Rt.hidden=!0;else if(!Mp()){if(!Ap())if(r.node)fi(null);else if(r.preview)jc();else if(w.harnessPick)Mr(null);else if(r.enabled)Jn(!1);else return!1}return!0}if(e==="m"&&r.allowed)Jn(!r.enabled);else if(e==="l"&&r.enabled)vp(r.space==="world"?"local":"world");else if(e==="enter"&&r.node&&w.nodePreview&&!r.drag)Ne("commit");else if(e==="enter"&&r.preview&&!r.drag)Mt("commit");else if((e==="delete"||e==="backspace")&&r.node&&r.node!==sr&&!r.drag)Ne("delete");else if(t.key==="?")kp(!!Rt?.hidden);else if(e==="a")G.frame(w.bounds||or());else return!1;return!0}function kp(t){Rt&&(Rt.hidden=!t)}var qa="http://www.w3.org/2000/svg";function gk(t){let e=t.occurrence?w.placements.get(t.occurrence):null;if(!e)return null;let r=t.reference&&e.board?e.board.scene.componentFeatures.get(t.reference):null,a=r?e.board.scene.features.get(Number(r.featureId))?.bounds:null;if(a)return Ps(e.matrix,[0,1,2].map(n=>(a[n]+a[n+3])/2));let s=e.worldBounds;return s?[0,1,2].map(n=>(s[n]+s[n+3])/2):null}function mk(){let t=w.emphasisSets.length>0,e=[],r=[];for(let a of w.showHarnesses?w.harnesses:[]){let s=w.harnessLit.get(_t(a)),n=pf(a,s),i=new Map(a.ends.map(c=>[c.id,gk(c)]));i.set("hub",a.ends.length>2?gf([...i.values()]):null);let o=a.name||"Harness";for(let c of w.tubedHarnesses.has(_t(a))?[]:ff(a)){let l=bf(c,s),f=document.createElementNS(qa,"line");f.setAttribute("class",`segment${l?" lit":t?" dim":""}`),l&&Object.assign(f.style,{stroke:l,color:l});let d=document.createElementNS(qa,"title");d.textContent=`${o}: ${c.wires.size} wire${c.wires.size===1?"":"s"}`,f.append(d),r.push(f),e.push({node:f,kind:"line",a:i.get(c.a),b:i.get(c.b)})}for(let c of a.ends){let l=n.get(c.id),f=document.createElementNS(qa,"circle");f.setAttribute("class",`end${l?" lit":t?" dim":""}`),f.setAttribute("r",l?"6":"4"),l&&(f.style.fill=l),r.push(f),e.push({node:f,kind:"dot",a:i.get(c.id)})}}qn.replaceChildren(...r),w.harnessDrawn={items:e,matrix:null}}function yk(){if(!qn||!ee)return;w.harnessDrawn||mk();let t=w.harnessDrawn;qn.toggleAttribute("hidden",!t.items.length);let e=ee.matrix.join(",");if(t.matrix===e)return;t.matrix=e;let r=L.getBoundingClientRect(),a=r.width/Math.max(1,L.width),s=r.height/Math.max(1,L.height),n=i=>{let o=i?ba(ee.matrix,i,ee.viewport):null;return o?[o.x*a,o.y*s]:null};for(let i of t.items){let o=n(i.a),c=i.kind==="line"?n(i.b):null,l=i.kind==="line"?!!(o&&c):!!o;i.node.style.display=l?"":"none",l&&(i.kind==="line"?(i.node.setAttribute("x1",o[0].toFixed(1)),i.node.setAttribute("y1",o[1].toFixed(1)),i.node.setAttribute("x2",c[0].toFixed(1)),i.node.setAttribute("y2",c[1].toFixed(1))):(i.node.setAttribute("cx",o[0].toFixed(1)),i.node.setAttribute("cy",o[1].toFixed(1))))}}function Lc(t){let{right:e}=G.basis(),r=ir(t),a=ir(Oe(t,e));return r&&a?Math.hypot(a[0]-r[0],a[1]-r[1]):0}function Dc(t){if(!w?.tubes.length||!ee)return null;let e=L.getBoundingClientRect(),r=wf(w.tubes,[t.clientX-e.left,t.clientY-e.top],ir,Lc,w.move.route?10:5);return r?{tube:w.tubes[r.index],pointMm:r.pointMm}:null}function xk(t){let e=Dc(t);return e?(Mr({key:e.tube.harness,segmentId:e.tube.segmentId,pointMm:e.pointMm}),!0):(Mr(null),!1)}function wk(t){if(!w?.move.enabled||!w.move.route||t.button!==0||t.shiftKey)return!1;let e=Dc(t),r=e?w.harnesses.find(a=>_t(a)===e.tube.harness):null;return!e||!li(r)?!1:(Mr({key:e.tube.harness,segmentId:e.tube.segmentId,pointMm:e.pointMm}),w.move.drag={kind:"route",start:[t.clientX,t.clientY],startMm:e.pointMm,nowMm:e.pointMm,pxPerMm:Lc(e.pointMm),basis:G.basis(),breakout:t.altKey,changed:!1,matrix:Fr(r,Zr),capture:L,harness:r,segment:{from:e.tube.from,to:e.tube.to,samplesMm:e.tube.samplesMm}},L.setPointerCapture(t.pointerId),!0)}function vk(t,e){fi(e);let r=ui();if(r){w.move.drag={kind:"handle",start:[t.clientX,t.clientY],startMm:r.worldMm,nowMm:r.worldMm,pxPerMm:Lc(r.worldMm),basis:G.basis(),changed:!1,startPreview:w.nodePreview,matrix:Fr(kr(),Zr),capture:Vr};try{Vr.setPointerCapture(t.pointerId)}catch{}}}function Ep(t){let e=w?.move.drag;if(!e||e.kind!=="route"&&e.kind!=="handle")return!1;let r=[t.clientX,t.clientY];if(!e.changed&&!Mf(e.start,r))return!0;e.changed=!0,e.nowMm=vf(e.startMm,r[0]-e.start[0],r[1]-e.start[1],e.pxPerMm,e.basis);let a=e.matrix?ka(e.matrix,e.nowMm):[...e.nowMm];return e.kind==="handle"?w.nodePreview={harness:w.harnessPick.key,id:w.move.node,positionMm:a}:w.nodePreview={harness:w.harnessPick.key,insert:yf(e.harness.nodes??[],{kind:e.breakout?"breakout":"waypoint",segment:e.segment,atMm:e.startMm,positionMm:a,toWorldMm:s=>e.matrix?Mo(e.matrix,s):s})},wt(),Ne("preview"),!0}function Sp(t){let e=w?.move.drag;if(!e||e.kind!=="route"&&e.kind!=="handle")return!1;if(e.capture?.hasPointerCapture?.(t.pointerId)&&e.capture.releasePointerCapture(t.pointerId),w.move.drag=null,!e.changed)return!0;if(e.kind==="handle")return Ne("commit"),!0;let r=a=>e.matrix?ka(e.matrix,a):[...a];return Ne("route-drag",{atMm:r(e.startMm),positionMm:r(e.nowMm),breakout:e.breakout}),!0}function Mk(t){if(!w)return!1;if(t==null)return Mr(null),!0;let e=_t({level:"",id:String(t)});if(w.harnessPick?.key===e)return!0;let r=w.tubes.find(s=>s.harness===e);if(!r)return!1;let a=Math.floor(r.samplesMm.length/6)*3;return Mr({key:e,segmentId:r.segmentId,pointMm:r.samplesMm.slice(a,a+3)}),!0}function Mr(t){if(!t&&!w.harnessPick)return;t&&(Ve(),ss({quiet:!0}));let e=t&&w.harnessPick?.key===t.key;w.harnessPick=t,e||(w.move.node=null,w.nodePreview=null),wt(),Ne("select")}function kr(){let t=w?.harnessPick;return t?w.harnesses.find(e=>_t(e)===t.key)??null:null}function li(t){return!!t&&!t.level&&w.move.allowed}function di(){let t=kr();if(!t)return[];let e=ko([t],w.nodePreview,_t)[0],r=w.tubes.filter(a=>a.harness===w.harnessPick.key);return xf(e,r,Fr(t,Zr)??[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1])}function ui(){return w.move.node?di().find(t=>t.id===w.move.node)??null:null}function Tp(){let t=kr();if(!t)return{harness:null,segment:null,pointMm:null,autoMm:null,node:null,editable:!1};let e=Fr(t,Zr),r=f=>e?ka(e,f):[...f],a=w.harnessPick,s=w.tubes.find(f=>f.harness===a.key&&f.segmentId===a.segmentId),n=[];for(let f=0;s&&f+2<s.samplesMm.length;f+=3)n.push(r(s.samplesMm.slice(f,f+3)));let o=di().find(f=>f.auto),c=ui(),l=!!(c&&w.nodePreview?.id===c.id);return{harness:{id:t.id,level:t.level??null,name:t.name||""},segment:s?{id:s.segmentId,from:s.from,to:s.to,samplesMm:n}:null,pointMm:a.pointMm?r(a.pointMm):null,autoMm:o?r(o.worldMm):null,node:c?{id:c.id,kind:c.kind,auto:!!c.auto,pinned:c.pinned,positionMm:l?[...w.nodePreview.positionMm]:r(c.worldMm),unsaved:l}:null,editable:li(t)}}function Ne(t,e={}){w.onHarness?.({phase:t,...Tp(),...e})}function fi(t){if(!w)return;let e=t&&li(kr())&&w.move.enabled?String(t):null;e!==w.move.node&&(w.move.node=e,w.move.drag=null,w.nodePreview&&w.nodePreview.id!==e&&(w.nodePreview=null,wt()),Ne("target"))}function kk(t){!w?.move.node||!w.harnessPick||(w.nodePreview=t?{harness:w.harnessPick.key,id:w.move.node,positionMm:[...t]}:null,wt(),Ne("preview"))}function Ap(){return w?.nodePreview?(w.nodePreview=null,w.move.drag=null,wt(),Ne("cancel"),!0):!1}function Ek(){if(!kr()){w.harnessPick&&(w.harnessPick=null,w.move.node=null,w.nodePreview=null,Ne("select"));return}w.move.drag||(w.nodePreview=null),w.move.node&&!di().some(a=>a.id===w.move.node)&&(w.move.node=null);let e=w.harnessPick,r=w.tubes.filter(a=>a.harness===e.key);if(e.pointMm&&r.length&&!r.some(a=>a.segmentId===e.segmentId)){let a=s=>{let n=1/0;for(let i=0;i+2<s.samplesMm.length;i+=3)n=Math.min(n,Math.hypot(s.samplesMm[i]-e.pointMm[0],s.samplesMm[i+1]-e.pointMm[1],s.samplesMm[i+2]-e.pointMm[2]));return n};e.segmentId=r.reduce((s,n)=>a(n)<a(s)?n:s).segmentId}Ne("sync")}function Sk(){let t=Vr;if(!t)return;let e=w.move.enabled&&ee?kr():null,r=li(e)?di():[];if(t.toggleAttribute("hidden",!r.length),!r.length){t.firstChild&&t.replaceChildren();return}let a=new Map([...t.children].map(n=>[n.dataset.node,n])),s=new Set;for(let n of r){let i=ir(n.worldMm),o=a.get(n.id);if(!o){o=document.createElementNS(qa,"circle"),o.dataset.node=n.id;let c=document.createElementNS(qa,"title");o.append(c),o.addEventListener("pointerdown",l=>{l.preventDefault(),l.stopPropagation(),vk(l,o.dataset.node)}),o.addEventListener("dblclick",l=>{l.preventDefault(),l.stopPropagation(),fi(o.dataset.node),w.move.node&&w.move.node!==sr&&Ne("delete")}),t.append(o)}s.add(n.id),o.setAttribute("class",`node ${n.kind}${n.auto?" auto":""}${n.pinned?" pinned":""}${n.id===w.move.node?" target":""}`),o.setAttribute("r",n.kind==="breakout"?"7":"5.5"),o.querySelector("title").textContent=n.auto?"Automatic breakout: drag to place it":n.kind==="breakout"?"Breakout":n.pinned?"Pinned waypoint":"Waypoint",o.style.display=i?"":"none",i&&(o.setAttribute("cx",i[0].toFixed(1)),o.setAttribute("cy",i[1].toFixed(1)))}for(let[n,i]of a)s.has(n)||i.remove()}function Tk(){wr&&(w.labelsDrawn=null,wr.replaceChildren(...w.placed.map(t=>{let e=document.createElement("div");e.className=`scene-label${t.standIn?` stand-in ${t.standIn}`:""}`;let r=document.createElement("strong");r.textContent=t.occurrence.displayPath||t.occurrence.labels?.join(" / ")||t.occurrence.path,e.append(r);let a=t.standIn?hn[t.standIn]?.label:"";if(a){let s=document.createElement("span");s.textContent=a,e.append(s)}return t.label=e,e})))}function Ak(){if(!wr||!ee)return;if(wr.hidden=!w.showLabels,!w.showLabels){w.labelsDrawn=null;return}let t=L.getBoundingClientRect(),e=Pc(),r=`${e}|${t.width}x${t.height}|${Array.prototype.join.call(ee.matrix,",")}`;if(w.labelsDrawn?.placed===w.placed&&w.labelsDrawn.key===r)return;w.labelsDrawn={placed:w.placed,key:r};let a=t.width/Math.max(1,L.width),s=t.height/Math.max(1,L.height);for(let n of w.placed){if(!n.label)continue;let[i,o,,c,l,f]=n.worldBounds,d=ba(ee.matrix,[(i+c)/2,(o+l)/2,f],ee.viewport),p=d&&d.x>=0&&d.y>=0&&d.x<=L.width&&d.y<=L.height;n.label.hidden=!p,p&&(n.label.style.transform=`translate(${(d.x*a).toFixed(1)}px, ${(d.y*s).toFixed(1)}px) translate(-50%, -100%)`),n.label.classList.toggle("selected",e===n.occurrence.path)}}function _k(t,e=k){return tl(t,e.scene.copperLayers)}async function _p(t=_e,e=k){let r=e.semanticGeometry.assets?.components_glb;if(!r||e.scene.componentTier!=="idle")return;e.scene.componentTier="loading";let a;try{a=await Td(new URL(r,location.href).toString(),{componentFeatures:e.scene.componentFeatures,fetchBytes:Qa(e)})}catch(i){throw ge(t)&&(e.scene.componentTier="idle"),i}if(!ge(t)||!e.renderer)return;let s=kl(a.models);if(await Wb([...s.instanced.map(i=>i.primitive),...s.baked].reduce((i,o)=>i+hc(o),0)),!ge(t)||!e.renderer)return;e.scene.componentTier="loaded",e.loadedBytes+=a.byteLength;for(let i of a.models)for(let o of i.placements){let c=e.scene.componentFeatures.get(o.designator);c&&Nk(c.featureId,o.bounds,e)}w&&(w.harnessDrawn=null,w.labelsDrawn=null);for(let[i,o]of a.componentNodeCounts||[])e.scene.componentModelCounts.set(i,o);e.hiddenComponentRequest&&Xp(e.hiddenComponentRequest);let n=i=>({kind:"component",layerId:0,material:i.material,color:i.material.baseColor});e.scene.componentEntries=[...e.renderer.addInstancedPrimitives(s.instanced.map(i=>({primitive:i.primitive,placements:i.placements,metadata:n(i.primitive)}))),...s.baked.map(i=>e.renderer.addPrimitive(i,n(i)))]}function Qa(t=k){return t.assetCache?e=>t.assetCache.fetchBytes(e):void 0}function Ip(t,e=k){if(!e.renderer||t-(e.tiersCheckedAt||0)<250)return;e.tiersCheckedAt=t;let r=e.renderer.cullCounts,a=kM()&&r.board+r.body>0,s=e.renderer.identityOnly&&!e.deferComponents||!e.renderer.identityOnly&&(r.full>0||a);s&&(e.scene.componentsWantedAt=t),s&&e.scene.componentTier==="idle"&&e.semanticGeometry.assets?.components_glb&&_p(_e,e).then(()=>{w&&e.renderer&&e.scene.componentTier==="loaded"&&xc(e.scene.runtimeBounds,e)}).catch(i=>console.warn("Failed to load components",i));let n=()=>w?w.scene.gpuMemoryBytes():e.renderer.gpuMemoryBytes();e.gpuBytes=n(),!(e.gpuBytes<=M.gpuBudgetBytes)&&(e.scene.componentTier==="loaded"&&t-e.scene.componentsWantedAt>fM&&(e.renderer.removeEntries(e.scene.componentEntries),e.scene.componentEntries=[],e.scene.componentTier="idle",e.scene.componentEvictions+=1,e.gpuBytes=n()),e.gpuBytes>M.gpuBudgetBytes&&Qb(e.visibleTileIds||new Set,Math.max(0,e.residentTileGpuBytes-(e.gpuBytes-M.gpuBudgetBytes)),e))}var vb=4e-4,Mb=5e-5,Ik={baseColor:[.62,.7,.8,1],metallic:0,roughness:.8,emissive:[0,0,0]};function xc(t,e=k){if(!e.renderer)return;let r=new Map;for(let i of e.topology.physical_objects||[])i.kind==="footprint_body"&&i.designator&&i.bbox_mm?.length===4&&r.set(i.designator,i);let a=(t?.[5]??8e-4)+Mb,s=(t?.[2]??-8e-4)-Mb,n=[];for(let i of e.scene.componentFeatures.values()){let o=Number(i.featureId),c=e.scene.features.get(o),l=r.get(i.designator);if(!c||c.bounds||!l)continue;let[f,d,p,b]=l.bbox_mm.map(Number),h=String(l.layer||"").startsWith("B."),u=[f/1e3,-b/1e3,h?s-vb:a,p/1e3,-d/1e3,h?s:a+vb];c.bounds=u,c.placeholder=!0,n.push(Rk(u,o))}if(n.length)for(let i of aa(n))e.renderer.addPrimitive(i,{kind:"component",layerId:0,material:i.material,color:i.material.baseColor,opacityScale:.3,translucent:!0,placeholder:!0})}function Rk([t,e,r,a,s,n],i){let o=[[[0,0,1],[[t,e,n],[a,e,n],[a,s,n],[t,s,n]]],[[0,0,-1],[[t,s,r],[a,s,r],[a,e,r],[t,e,r]]],[[1,0,0],[[a,e,r],[a,s,r],[a,s,n],[a,e,n]]],[[-1,0,0],[[t,s,r],[t,e,r],[t,e,n],[t,s,n]]],[[0,1,0],[[a,s,r],[t,s,r],[t,s,n],[a,s,n]]],[[0,-1,0],[[t,e,r],[a,e,r],[a,e,n],[t,e,n]]]],c=new Float32Array(72),l=new Float32Array(72),f=new Uint32Array(36);return o.forEach(([d,p],b)=>{p.forEach((u,m)=>{c.set(u,(b*4+m)*3),l.set(d,(b*4+m)*3)});let h=b*4;f.set([h,h+1,h+2,h,h+2,h+3],b*6)}),{position:c,normal:l,netId:new Uint32Array(24),objectFeatureId:new Uint32Array(24).fill(i),indices:f,material:Ik,bounds:[t,e,r,a,s,n]}}function Nk(t,e,r=k){let a=r.scene.features.get(Number(t));if(!a||!e.length)return;let s=[1/0,1/0,1/0,-1/0,-1/0,-1/0];for(let n=0;n<e.length;n+=3)s[0]=Math.min(s[0],e[n]),s[1]=Math.min(s[1],e[n+1]),s[2]=Math.min(s[2],e[n+2]),s[3]=Math.max(s[3],e[n]),s[4]=Math.max(s[4],e[n+1]),s[5]=Math.max(s[5],e[n+2]);a.bounds=a.bounds?[Math.min(a.bounds[0],s[0]),Math.min(a.bounds[1],s[1]),Math.min(a.bounds[2],s[2]),Math.max(a.bounds[3],s[3]),Math.max(a.bounds[4],s[4]),Math.max(a.bounds[5],s[5])]:s}function hi(t,e=k){return Jc(t,e.scene.copperLayers)}var Ck=[.55,.35,.16,.78];function Rp(t=k){return Zc(t.topology?.board?.stackup?.copper_finish)}function Np(t,e=k){return el(t,e.scene.copperLayers)}var Bk=.25;function $r(){return!M.realisticColors||M.mode==="layer"||!M.showBoard?0:1-fe(M.separation/Bk,0,1)}function Za(t,e=k){let r=Np(t,e)?Rp(e):ra.copper;return Cp(hi(t,e),r,$r())}function Cp(t,e,r){return t.map((a,s)=>a+(e[s]-a)*r)}function Ok(t,e=_e){if(e===_e&&w&&G){qM(t,e);return}if(e!==_e||!k.renderer||!G)return;let r=performance.now(),a=Math.max(0,t-nr);if(M.workspace==="schematic"&&O){nr=t;let l=O.visiblePages(),f=re?zk(l):[];O.setDomDetailPageIds(f.map(d=>d.id)),z.visiblePages=O.render(),re?.syncWorldPages(f,O,{activeNetUid:z.activeNetUid}),sg(),vc(a,performance.now()-r),Mc(t),Ya(e);return}let s=Math.min(.05,(t-nr)/1e3);nr=t,G.update(s),k.renderer.resize();let n=Zn();k.scene.copperRealism!==$r()&&os();for(let l of k.renderer.entries)l.layerOffset=n[l.layerId]||0;Gk(t),vr=Pp(t);let i=Vk(t);ee={layerId:0,viewport:{x:0,y:0,width:L.width,height:L.height},matrix:G.matrix(L.width,L.height,M.mode==="layer"),lod:rp(L.height,M.mode==="layer")},k.renderer.selectedOccurrence=M.selectedFeatureId||M.activeNetId?M.selectedOccurrence:-1,k.renderer.setInnerCopperMode(Xb(!M.showBoard||M.separation>.001,Wr().size>0)),Re(t);let o=M.mode==="3d"?k.visible3dLayers:$b(),c={panels:[ee],activeNetId:M.activeNetId,selectedFeatureId:M.selectedFeatureId,time:t/1e3,layerOffsets:n,visibleLayers:o,showBoard:M.showBoard,showComponents:M.showComponents,showPaste:M.separation===0,componentOpacity:fe(1-M.separation/.1,0,1),boardOpacity:Wr().size?.34:1-M.separation*.72,isolateNet:M.isolateNet,compareMode:M.mode==="layer",compareOffsets:vr,layerAlphas:i,visibleTileIds:M.mode==="3d"?k.visibleTileIds:null};if(Hr=c,jk(t,c)){k.renderer.render(c),rg(),pE();for(let l of Qn)l()}Ip(t),vc(a,performance.now()-r),Mc(t),Ya(e)}var Bp=1e3,yt={key:"",matrix:new Float32Array(16),tiles:null,at:0},Hr=null,ce={canvas:null,context:null,depth:null,depthView:null,width:0,height:0},es=new pn(3e3),Qn=new Set,Dn={frames:0,cpuMs:0,gpuMs:0,lastTriangles:0},wc={cullTiles:!0};function Fk(t,e){let r=k.renderer;ce.canvas||(ce.canvas=document.createElement("canvas"),ce.context=ce.canvas.getContext("webgpu")),!(ce.width>=t&&ce.height>=e&&ce.depth)&&(ce.width=Math.max(ce.width,t),ce.height=Math.max(ce.height,e),ce.canvas.width=ce.width,ce.canvas.height=ce.height,ce.context.configure({device:r.device,format:r.format,alphaMode:"opaque"}),ce.depth?.destroy(),ce.depth=r.device.createTexture({label:"inset-depth",size:[ce.width,ce.height],format:r.depthFormat,sampleCount:r.sampleCount,usage:GPUTextureUsage.RENDER_ATTACHMENT}),ce.depthView=ce.depth.createView())}function Op(){return!!(!w&&k.renderer&&Hr&&M.workspace==="pcb")}function Pk(t,e,r="inset"){if(!Op())return!1;let a=t.clientWidth,s=t.clientHeight;if(!a||!s)return!1;let n=performance.now(),i=Math.min(devicePixelRatio||1,2),o=Math.round(a*i),c=Math.round(s*i);Fk(o,c);let l=Ot(k.scene.runtimeBounds),f=Oo(e,a,s,l,e.focusZ??0);es.record(r,f,n);let d={layerId:0,viewport:{x:0,y:0,width:o,height:c},matrix:f,lod:Hr.panels[0].lod},p=Hr.visibleTileIds;if(p&&wc.cullTiles){let u=new Set;for(let m of p){let g=k.scene.tiles.get(m);g&&Yn(g,f,null,0,k)&&u.add(m)}p=u}let b=k.renderer.renderInto({colorView:ce.context.getCurrentTexture().createView(),depthView:ce.depthView,width:ce.width,height:ce.height},d,{...Hr,panels:[d],visibleTileIds:p});return t.width!==o&&(t.width=o),t.height!==c&&(t.height=c),t.getContext("2d").drawImage(ce.canvas,0,0,o,c,0,0,o,c),Dn.frames+=1,Dn.cpuMs+=performance.now()-n,Dn.lastTriangles=b.triangles,!0}function jk(t,e){let r=e.panels[0].matrix,a=!1;for(let o=0;o<16;o+=1)if(r[o]!==yt.matrix[o]){a=!0;break}if(a)return yt.matrix.set(r),yt.key="",yt.at=t,!0;let s=[L.width,L.height,k.renderer.version,k.renderer.selectedOccurrence,M.workspace,M.mode,e.activeNetId,e.selectedFeatureId,e.showBoard,e.showComponents,e.showPaste,e.componentOpacity,e.boardOpacity,e.isolateNet,k.scene.layerZOffsetSignature,[...e.visibleLayers].join(","),[...e.compareOffsets].map(([o,c])=>`${o}:${c}`).join(";"),e.layerAlphas?[...e.layerAlphas].join(";"):""].join("|");return!!(e.activeNetId||e.selectedFeatureId||k.renderer.emphasizedNetIds.size)||s!==yt.key||!Fp(e.visibleTileIds,yt.tiles)||t-yt.at>Bp?(yt.key=s,yt.tiles=e.visibleTileIds,yt.at=t,!0):!1}var Lk=1e3/30-2,Ye={scene:null,key:"",matrix:new Float32Array(16),tiles:new Map,at:0};function Dk(t,e,r){let a=ee.matrix,s=!1;for(let p=0;p<16;p+=1)if(a[p]!==Ye.matrix[p]){s=!0;break}if(Ye.scene!==w.scene&&(Ye.scene=w.scene,s=!0),s)return Ye.matrix.set(a),Ye.key="",Ye.at=t,!0;let n=[L.width,L.height,M.showBoard,M.showComponents,M.isolateNet,M.activeNetId,M.selectedFeatureId,M.selectedOccurrence,w.showLabels,r,$r(),Pc(),w.scene.tubeVersion];for(let p of w.scene.renderers){let b=e.get(p);n.push(p.version,p.occurrenceCount,p.selectedOccurrence,p.dimCopper,p.standIn?p.boxColor.join(","):"",b?[...b.visibleLayers].join(","):"",b?.layerOffsets?Array.prototype.join.call(b.layerOffsets,","):"")}let i=n.join("|"),o=!1;for(let[p,b]of e)Fp(b.visibleTileIds,Ye.tiles.get(p))||(o=!0);let c=!!(r||M.activeNetId||M.selectedFeatureId),l=o||i!==Ye.key,f=c&&t-Ye.at>=Lk;return l||f||t-Ye.at>Bp?(Ye.key=i,Ye.tiles=new Map([...e].map(([p,b])=>[p,b.visibleTileIds])),Ye.at=t,!0):!1}function Fp(t,e){if(!t||!e)return t===e;if(t.size!==e.size)return!1;for(let r of t)if(!e.has(r))return!1;return!0}function Uk(t){if(!O||!t)return{widthPx:0,heightPx:0,sourcePxPerMm:0,area:0};let e=O.pagePixelWidth(t),r=t.heightMm/Math.max(1e-6,O.scale),a=O.pageSourcePixelsPerMm(t);return{widthPx:e,heightPx:r,sourcePxPerMm:a,area:e*r}}function zk(t){if(!re||!O)return[];let e=t||[],r=Math.max(1,Ke.clientWidth*Ke.clientHeight);return e.map(n=>({page:n,...Uk(n)})).filter(n=>n.widthPx>=760&&n.heightPx>=520&&n.area>=r*.36&&n.sourcePxPerMm>=1.25).sort((n,i)=>i.area-n.area).slice(0,1).map(n=>n.page)}function Zn(t=k){let e=or(t),r=Math.hypot((e[3]-e[0])*1e3,(e[4]-e[1])*1e3),a=M.separation*M.separation*fe(r*.12,8,25)/1e3,s=`${M.separation}:${a}:${t.scene.copperLayers.length}`;if(t.scene.layerZOffsetSignature===s)return t.scene.layerZOffsets;let n=t.scene.layerZOffsets;n.fill(0);let i=(t.scene.copperLayers.length-1)/2;return t.scene.copperLayers.forEach((o,c)=>{n[Number(o.id)]=(i-c)*a}),t.scene.layerZOffsetSignature=s,n}function Pp(t){if(M.mode!=="layer")return Le.key="3d",Le.current.clear(),new Map;let e=k.scene.copperLayers.filter(m=>k.compareLayers.has(Number(m.id))),r=Math.max(1,e.length),a=L.width/Math.max(1,L.height),s=1;r===2?s=a>=1?2:1:r===3||r===4?s=2:r>4&&(s=Math.ceil(Math.sqrt(r*a)));let n=Math.ceil(r/s),i=or(),o=i[3]-i[0],c=i[4]-i[1],l=o*1.18,f=c*1.22,d=e.map((m,g)=>{let y=g%s,x=Math.floor(g/s);return{layer:m,layerId:Number(m.id),column:y,row:x,offset:[(y-(s-1)/2)*l,((n-1)/2-x)*f,0]}}),p=`${s}x${n}:${d.map(m=>m.layerId).join(",")}`;if(p!==Le.key){Le.key=p,Le.started=t,Le.from=new Map(Le.current);let m=s*o+(s-1)*(l-o),g=n*c+(n-1)*(f-c);G.targetFocus=[(i[0]+i[3])/2,(i[1]+i[4])/2,(i[2]+i[5])/2],G.targetOrthoScale=Math.max(g,m/a)*1.08}let b=fe((t-Le.started)/420,0,1),h=1-Math.pow(1-b,3),u=new Map;for(let m of d){let g=Le.from.get(m.layerId)||[0,0,0],y=m.offset.map((x,v)=>g[v]+(x-g[v])*h);u.set(m.layerId,y),Le.current.set(m.layerId,y)}if($.phase==="reveal")for(let m of $.previous)u.has(Number(m))||u.set(Number(m),$.previousOffsets.get(Number(m))||[0,0,0]);for(let m of[...Le.current.keys()])d.some(g=>g.layerId===m)||Le.current.delete(m);return u}function ns(t){let e=new Set([...t].map(Number));if(!(kb(e,k.desiredCompareLayers)&&$.phase!=="idle")){if(k.desiredCompareLayers=e,kb(e,k.compareLayers)){$.phase="idle",$.previous.clear(),$.target.clear();return}$.phase="preload",$.previous=new Set(k.compareLayers),$.target=new Set(e),$.previousOffsets=new Map(Le.current),$.started=performance.now(),Re($.started,{force:!0})}}function Uc({snap:t=!0}={}){M.mode="layer";let e=NM();k.desiredCompareLayers=new Set(e),!k.compareLayers.size&&e.size&&(k.compareLayers=new Set(e)),$.phase="idle",$.previous.clear(),$.target.clear(),Le.key="",G.setAxis("z",!1),k.renderer?.resize(),vr=Pp(performance.now()),t&&G.snap(),Re(performance.now(),{force:!0})}function Gk(t){if(!(M.mode!=="layer"||$.phase==="idle")){if($.phase==="preload"){if(!Kk($.target)){Re(t,{force:!0});return}$.phase="reveal",$.started=t,$.previousOffsets=new Map(Le.current),k.compareLayers=new Set($.target),Le.key="";return}$.phase==="reveal"&&t-$.started>=Ib&&(k.compareLayers=new Set($.target),$.phase="idle",$.previous.clear(),$.target.clear(),$.previousOffsets.clear(),Re(t,{force:!0}))}}function Kk(t,e=k){for(let r of e.scene.tiles.values())if(t.has(Number(r.layerId))&&!e.scene.residentTiles.has(r.id)&&!e.scene.failed.has(r.id))return!1;return!0}function Vk(t){if(M.mode!=="layer"||$.phase!=="reveal")return null;let e=fe((t-$.started)/Ib,0,1),r=e*e*(3-2*e),a=new Map;for(let s of $.previous)a.set(Number(s),$.target.has(Number(s))?1:1-r);for(let s of $.target)a.set(Number(s),$.previous.has(Number(s))?1:r);return a}function kb(t,e){if(t.size!==e.size)return!1;for(let r of t)if(!e.has(r))return!1;return!0}function zc(){if(M.workspace==="schematic"){qk();return}if(M.workspace==="bom"){Hk();return}if(M.workspace==="stackup")return;ri.textContent=k.viewerReadiness.stage==="semantic-ready"?"Semantic GLTF A0":"Prism staged 3D",ai.textContent="Layers",si.textContent="Visibility and compare",Z('[data-panel="search"] .section-heading span').textContent="Nets, components and pins",Z('[data-panel="view"] .section-heading span').textContent="Camera and stackup";let t=`
    <div class="mode-toolbar">
      <button data-mode="layer">PCB</button>
      <button data-mode="3d">3D</button>
    </div>`;Kr&&(Kr.innerHTML=t),ut.innerHTML=`
    ${Kr?"":t}
    <div class="layer-presets">
      <button data-preset="all">All</button><button data-preset="none">None</button>
      <button data-preset="outer">Outer</button><button data-preset="inner">Inner</button>
    </div>
    <div class="layer-list"></div>`,Ae.innerHTML=`
    <label class="control-field"><span>Search</span>
      <input id="entity-search" class="layer-select" type="search" placeholder="Net, component or pin">
      <div id="search-results" class="search-results"></div>
    </label>
    <div class="quick-actions">
      <button id="frame-selection">Frame</button>
      <button id="show-net-layers">Net layers</button>
      <button id="isolate-net" aria-keyshortcuts="I" title="Toggle isolated net view (I)">Isolate</button>
      <button id="clear-selection">Clear</button>
    </div>`,Xe.innerHTML=`
    <div class="toggle-list">
      <label class="toggle-row"><input id="show-board" type="checkbox"><span>Board substrate</span></label>
      <label class="toggle-row"><input id="show-components" type="checkbox"><span>Components</span></label>
    </div>
    <label class="control-field range-field"><span>Stackup separation</span>
      <input id="separation" type="range" min="0" max="1" step="0.002">
    </label>`,He(),rE()}function Hk(){ri.textContent="BoM A0",ai.textContent="Bill of Materials",si.textContent="Grouped procurement view",Z('[data-panel="search"] .section-heading span').textContent="Search inside the BoM table",Z('[data-panel="view"] .section-heading span').textContent="BoM actions";let t=ft?.payload?.counts||{};ut.innerHTML=`
    <div class="selection-properties">
      <div class="selection-property"><small>Rows</small><strong>${t.rows||0}</strong></div>
      <div class="selection-property"><small>Components</small><strong>${t.components||0}</strong></div>
      <div class="selection-property"><small>DNP</small><strong>${t.dnpComponents||0}</strong></div>
    </div>
    <div class="selection-section">
      <span class="selection-section-title">Columns</span>
      <div class="selection-empty">Primary procurement and thermal columns are shown first. Additional symbol and footprint metadata is available in the row detail panel.</div>
    </div>`,Ae.innerHTML=`
    <div class="selection-empty">Use the BoM search box in the main view. Reference chips update the shared PCB and schematic selection without changing workspaces.</div>
    <div class="quick-actions">
      <button id="clear-selection">Clear</button>
    </div>`,Xe.innerHTML=`
    <div class="selection-section">
      <span class="selection-section-title">Cross-probing</span>
      <div class="selection-table">
        <div class="selection-row"><span><strong>PCB/Schematic</strong></span><span>Select component</span><span>Highlights matching BoM row</span></div>
        <div class="selection-row"><span><strong>BoM reference</strong></span><span>Click chip</span><span>Holds component selection for PCB and schematic</span></div>
      </div>
    </div>`,Ae.querySelector("#clear-selection")?.addEventListener("click",Ve)}function qk(){ri.textContent=re?"Schematic SVG DOM":z.manifest?.schema==="prism.schematic_vector_a0"?"Schematic Vector A0":"Schematic World A0",ai.textContent="Pages",si.textContent=`${z.pages.length} hierarchy instances`,Z('[data-panel="search"] .section-heading span').textContent="Pages, nets and components",Z('[data-panel="view"] .section-heading span').textContent="World navigation",ut.innerHTML=`
    <div class="layer-presets">
      <button data-page-action="world">Fit world</button>
      <button data-page-action="parent">Parent</button>
      <button data-page-action="previous">Previous</button>
      <button data-page-action="next">Next</button>
    </div>
    <div class="page-list">${z.pages.map(t=>`
      <button class="page-row ${t.id===M.selectedPageId?"active":""}" data-page="${t.id}">
        <span>${t.sheetNumber}</span>
        <strong>${H(t.name)}</strong>
        <small>L${t.depth}</small>
      </button>`).join("")}</div>`,Ae.innerHTML=`
    <label class="control-field"><span>Search</span>
      <input id="entity-search" class="layer-select" type="search" placeholder="Page, net or component">
      <div id="search-results" class="search-results"></div>
    </label>
    <div class="quick-actions">
      <button id="frame-selection">Frame</button>
      <button id="clear-selection">Clear</button>
    </div>`,Xe.innerHTML=`
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
    </div>`,ut.querySelectorAll("[data-page]").forEach(t=>{t.addEventListener("click",()=>Ct(t.dataset.page,!0))}),ut.querySelectorAll("[data-page-action]").forEach(t=>{t.addEventListener("click",()=>Un(t.dataset.pageAction))}),Ae.querySelector("#entity-search").addEventListener("input",t=>{Xk(t.target.value)}),Ae.querySelector("#frame-selection").addEventListener("click",Dp),Ae.querySelector("#clear-selection").addEventListener("click",is),Xe.querySelector("#show-hierarchy").checked=O?.showHierarchy??!0,Xe.querySelector("#show-hierarchy").addEventListener("change",t=>{O.showHierarchy=t.target.checked})}function Ct(t,e){let r=z.byId.get(t);!r||!O||(M.selectedPageId=r.id,M.selectedSchematicFeature=null,O.selectedPageId=r.id,O.selectedFeatureId=0,vt.textContent=JSON.stringify(r,null,2),e&&O.framePage(r),ut.querySelectorAll("[data-page]").forEach(a=>{a.classList.toggle("active",a.dataset.page===r.id)}))}function Un(t){if(!O)return;if(t==="world"){O.frameWorld();return}let e=Math.max(0,z.pages.findIndex(a=>a.id===M.selectedPageId)),r=null;t==="previous"?r=z.pages[(e-1+z.pages.length)%z.pages.length]:t==="next"?r=z.pages[(e+1)%z.pages.length]:t==="parent"&&(r=z.byId.get(z.pages[e]?.parentId)),r&&Ct(r.id,!0)}function Wk(t){if(!t||!O)return;if(is(),t.kind==="page"&&t.pageId){Ct(t.pageId,!0);return}if(t.kind!=="sheet")return;let e=z.pages.find(n=>n.sheetInstancePath===t.sheetInstancePath)||z.byId.get(M.selectedPageId),r=String(t.sheetFile||t.feature?.sheet_file||"").replace(/\\/g,"/"),a=String(t.sheetName||t.feature?.sheet_name||t.feature?.objectId||""),s=z.pages.find(n=>{if(e&&n.parentId&&n.parentId!==e.id)return!1;let i=String(n.sourcePath||"").replace(/\\/g,"/");return r&&i.endsWith(r)||a&&n.name===a})||z.pages.find(n=>{let i=String(n.sourcePath||"").replace(/\\/g,"/");return r&&i.endsWith(r)||a&&n.name===a});s&&Ct(s.id,!0)}function Xk(t){let e=Ae.querySelector("#search-results"),r=t.trim().toLowerCase();if(!r){e.innerHTML="";return}let a=z.pages.filter(n=>`${n.name} ${n.sheetPath}`.toLowerCase().includes(r)).slice(0,8),s=k.scene.nets.filter(n=>String(n.name).toLowerCase().includes(r)).slice(0,8);e.innerHTML=[...a.map(n=>`<button data-page="${n.id}"><b>${H(n.name)}</b><span>Page ${n.sheetNumber}</span></button>`),...s.map(n=>`<button data-schematic-net="${n.id}"><b>${H(n.name)}</b><span>${(z.manifest.netToPages?.[n.uid]||[]).length} pages</span></button>`)].join(""),e.querySelectorAll("[data-page]").forEach(n=>{n.addEventListener("click",()=>Ct(n.dataset.page,!0))}),e.querySelectorAll("[data-schematic-net]").forEach(n=>{n.addEventListener("click",()=>jp(Number(n.dataset.schematicNet),!0))})}function jp(t,e){let r=k.scene.nets.find(s=>Number(s.id)===t);if(!r||!O)return;M.activeNetId=t,M.selectedFeatureId=0,M.selectedSchematicFeature=null,O.selectedFeatureId=0,O.selectedFeatureKey="",O.selectedSourceId="",z.activeNetUid=r.uid,O.activeNetUid=r.uid,re?.setHighlightedNet(r.uid),vt.textContent=JSON.stringify(r,null,2),nt();let a=z.manifest.netToPages?.[r.uid]||[];e&&a.length&&Ct(a[0],!0)}function Lp(t,e=null){let r=k.scene.nets.find(a=>a.uid===t);r&&(M.activeNetId=Number(r.id),z.activeNetUid=r.uid,O&&(O.activeNetUid=r.uid,O.selectedFeatureId=Number(e?.feature?.id||e?.featureId||0),O.selectedFeatureKey=e?.feature?.stableKey||e?.featureKey||"",O.selectedSourceId=e?.feature?.sourceId||e?.sourceId||""),re?.setHighlightedNet(r.uid),e&&(M.selectedSchematicFeature={...e,pageId:M.selectedPageId}),vt.textContent=JSON.stringify(e?{...e,net:r}:r,null,2),nt())}function is(){M.activeNetId=0,M.selectedFeatureId=0,M.selectedSchematicFeature=null,z.activeNetUid="",O&&(O.activeNetUid="",O.selectedFeatureId=0,O.selectedFeatureKey="",O.selectedSourceId=""),re?.setSelection(null),re?.setHighlightedNet(""),vt.textContent="No object selected",nt()}function Dp(){let t=z.byId.get(M.selectedPageId);t?O.framePage(t):O.frameWorld()}function $k(t){M.selectedPageId=t.sheetInstancePath&&z.pages.find(a=>a.sheetInstancePath===t.sheetInstancePath)?.id||M.selectedPageId,M.selectedFeatureId=0,M.selectedSchematicFeature={...t,pageId:M.selectedPageId},t.anchor&&(M.selectionAnchor=t.anchor),O&&(O.selectedPageId=M.selectedPageId,O.selectedFeatureId=Number(t.feature?.id||0));let e=t.netUid?k.scene.nets.find(a=>a.uid===t.netUid):null,r=t.reference?k.scene.componentFeatures.get(t.reference):null;r&&(M.selectedFeatureId=Number(r.featureId||0),ft?.setSelectionByReference(t.reference,{scroll:M.workspace==="bom"})),vt.textContent=JSON.stringify({...t,net:e,component:r},null,2),nt()}function Yk(t){let{page:e,feature:r}=t;if(!r){M.selectedSchematicFeature=null,O.selectedFeatureId=0,Ct(e.id,!1),nt();return}let a=Number(r.id||0);if(M.selectedPageId=e.id,O.selectedPageId=e.id,O.selectedFeatureId=a,M.selectedSchematicFeature={...r,pageId:e.id},M.selectionAnchor=null,r.netUid){let s=k.scene.nets.find(n=>n.uid===r.netUid);if(s){jp(Number(s.id),!1),M.selectedSchematicFeature={...r,pageId:e.id},O.selectedFeatureId=a;return}}if(r.reference){let s=k.scene.componentFeatures.get(r.reference);if(s){Sr(Number(s.featureId),!1),M.selectedSchematicFeature={...r,pageId:e.id},O.selectedFeatureId=a;return}}M.activeNetId=0,M.selectedFeatureId=0,O.activeNetUid="",vt.textContent=JSON.stringify({page:e.name,...r},null,2),nt()}function Er(){let t=M.isolateNet,e=Ae?.querySelector?.("#isolate-net");e?.classList.toggle("active",t),e?.setAttribute("aria-pressed",String(t));let r=se?.querySelector?.("[data-action=isolate]");r?.classList.toggle("active",t),r?.setAttribute("aria-pressed",String(t));let a=Xe?.querySelector?.("#show-board");a&&(a.checked=M.showBoard);let s=Xe?.querySelector?.("#show-components");s&&(s.checked=M.showComponents),Bt()}function Jk(){let t=new Set;for(let e of Wr())for(let r of Gc(e))t.add(r);return t}function Gc(t,e=k){let r=new Set,a=e.scene.nets.find(n=>Number(n.id)===Number(t)),s=new Set(e.scene.copperLayers.map(n=>Number(n.id)));for(let n of Object.keys(a?.layerBoundsMm||{})){let i=Number(n);s.has(i)&&r.add(i)}if(!r.size){let n=new Map(e.scene.copperLayers.map(i=>[i.name,Number(i.id)]));for(let i of a?.metrics?.layers||[]){let o=n.get(i);o!=null&&r.add(o)}}if(r.size)return r;for(let n of e.scene.tiles.values())ep(n,t)&&r.add(Number(n.layerId));return r}function Yr(){if(w){for(let e of st())ci(e);return}let t=Jk();t.size&&(k.visible3dLayers=new Set(t),M.mode==="layer"?ns(t):(k.compareLayers=new Set(t),k.desiredCompareLayers=new Set(t)),Re(performance.now(),{force:!0}))}function ea(t){let e=!!(t&&Qr()),r=M.isolateNet;if(e&&!M.isolateNet&&!w&&(k.preIsolation3dLayers=new Set(k.visible3dLayers),k.preIsolationCompareLayers=new Set(k.desiredCompareLayers.size?k.desiredCompareLayers:k.compareLayers)),M.isolateNet=e,w)Yr();else if(M.isolateNet)Yr();else if(k.preIsolation3dLayers||k.preIsolationCompareLayers){if(k.preIsolation3dLayers&&(k.visible3dLayers=new Set(k.preIsolation3dLayers)),k.preIsolationCompareLayers){let a=new Set(k.preIsolationCompareLayers);M.mode==="layer"?ns(a):(k.compareLayers=a,k.desiredCompareLayers=new Set(a))}k.preIsolation3dLayers=null,k.preIsolationCompareLayers=null,Re(performance.now(),{force:!0})}e&&!r?(M.preIsolationShowBoard=M.showBoard,M.showBoard=!1):!e&&r&&(typeof M.preIsolationShowBoard=="boolean"&&(M.showBoard=M.preIsolationShowBoard),M.preIsolationShowBoard=null),Er(),He()}function He(){(Kr||ut).querySelectorAll("[data-mode]").forEach(r=>{let a=r.dataset.mode===M.mode;r.classList.toggle("active",a),r.setAttribute("aria-pressed",String(a))}),Xe.querySelector("#show-board").checked=M.showBoard,Xe.querySelector("#show-components").checked=M.showComponents,Xe.querySelector("#separation").value=M.separation;let t=ut.querySelector(".layer-list"),e=M.mode==="3d"?k.visible3dLayers:k.desiredCompareLayers;t.innerHTML=k.scene.copperLayers.map((r,a)=>`
    <label class="layer-row">
      <input type="checkbox" data-layer="${r.id}" ${e.has(Number(r.id))?"checked":""}>
      <span class="swatch" style="background:${bi(hi(r))}"></span>
      <span>${H(r.name)}</span><small>${a+1}</small>
    </label>`).join(""),t.querySelectorAll("[data-layer]").forEach(r=>r.addEventListener("change",()=>{zp(Number(r.dataset.layer),r.checked)})),Er()}function Up(t){t==="layer"?Uc():(M.mode="3d",G.frame(or()),G.snap(),k.visibleTileIds=new Set,Re(performance.now(),{force:!0})),He()}function zp(t,e,r=null){if(w){let a=Number(t);Bc(r==null?null:[r],s=>e?s.delete(a):s.add(a));return}if(M.mode==="3d")e?k.visible3dLayers.add(t):k.visible3dLayers.delete(t),Re(performance.now(),{force:!0});else{let a=new Set(k.desiredCompareLayers);e?a.add(t):a.delete(t),ns(a)}He()}function Gp(t,e=null){if(w){Bc(e==null?null:[e],(a,s)=>{let n=s?.scene.copperLayers||[];a.clear(),n.forEach((i,o)=>{t==="all"||t==="outer"&&(o===0||o===n.length-1)||t==="inner"&&o>0&&o<n.length-1||a.add(Number(i.id))})});return}let r=M.mode==="3d"?k.visible3dLayers:new Set;r.clear();for(let[a,s]of k.scene.copperLayers.entries())(t==="all"||t==="outer"&&(a===0||a===k.scene.copperLayers.length-1)||t==="inner"&&a>0&&a<k.scene.copperLayers.length-1)&&r.add(Number(s.id));M.mode==="3d"?Re(performance.now(),{force:!0}):ns(r),He()}function Kp(t){M.showBoard=!!t,M.savedShowBoard=M.showBoard,M.showBoard&&M.isolateNet?ea(!1):Er()}function Vp(t){M.showComponents=!!t,M.savedShowComponents=M.showComponents,Er()}function Qk(t){M.showPlaceholders=!!t;for(let e of w?st():[k])e.renderer?.setPlaceholdersVisible(M.showPlaceholders);Bt()}function Zk(){let t=new Set((k.scene?.layers||[]).map(a=>String(a.name))),e=new Set(M.hiddenBoardLayers),r=a=>{let s=(k.renderer?.entries||[]).find(i=>i.kind==="board"&&i.boardRole===a),n=s?.color||s?.material?.baseColor;return n?bi(n):dM[a]};return lM.filter(a=>!t.size||t.has(a.name)).map(a=>({...a,color:r(a.role),visible:!e.has(`${a.role}:${a.side}`)}))}function eE(t,e,r){let a=`${t}:${e}`,s=new Set(M.hiddenBoardLayers);r?s.delete(a):s.add(a),M.hiddenBoardLayers=[...s];for(let n of w?st():[k])n.renderer?.setHiddenBoardLayers(M.hiddenBoardLayers);Bt()}function tE(t){M.realisticColors=!!t,os(),Bt()}function os(t=k){if(!t.renderer)return;let e=new Map(t.scene.layers.map(r=>[Number(r.id),r]));for(let r of t.renderer.entries)r.kind==="copper"&&(r.color=Za(e.get(Number(r.layerId)),t));t.renderer.copperColors=new Map([...e].map(([r,a])=>[r,Za(a,t)])),t.renderer.invalidate?.(),t.renderer.setBarrelColor(Cp(Ck,[...Rp(t).slice(0,3),.78],$r())),t.scene.copperRealism=$r()}function Hp(t,e=null){if(w){ek(fe(Number(t)||0,0,1),e);return}M.separation=fe(Number(t)||0,0,1),Bt()}function rE(){(Kr||ut).querySelectorAll("[data-mode]").forEach(e=>e.addEventListener("click",()=>{Up(e.dataset.mode)})),ut.querySelectorAll("[data-preset]").forEach(e=>e.addEventListener("click",()=>{Gp(e.dataset.preset)})),Xe.querySelector("#show-board").addEventListener("change",e=>{Kp(e.target.checked)}),Xe.querySelector("#show-components").addEventListener("change",e=>{Vp(e.target.checked)}),Xe.querySelector("#separation").addEventListener("input",e=>{Hp(e.target.value)}),Ae.querySelector("#clear-selection").addEventListener("click",Ve),Ae.querySelector("#isolate-net").addEventListener("click",()=>{ea(!M.isolateNet)}),Ae.querySelector("#frame-selection").addEventListener("click",Wc),Ae.querySelector("#show-net-layers").addEventListener("click",Kc);let t=Ae.querySelector("#entity-search");t.addEventListener("input",()=>Wp(t.value))}function qp(){xr(".rail-tab").forEach(t=>t.addEventListener("click",()=>{let e=t.dataset.tab,r=M.activeTab===e&&!Nt.classList.contains("panel-collapsed");M.activeTab=e,Nt.classList.toggle("panel-collapsed",r),xr(".rail-tab").forEach(a=>{a.classList.toggle("active",!r&&a.dataset.tab===e)}),xr(".tab-panel").forEach(a=>{a.classList.toggle("active",!r&&a.dataset.panel===e)})}))}function Kc(){if(w){JM();return}let t=k.scene.nets.find(a=>Number(a.id)===M.activeNetId);if(!t)return;let e=new Set(t.metrics?.layers||[]),r=M.mode==="3d"?k.visible3dLayers:new Set;r.clear();for(let a of k.scene.copperLayers)e.has(a.name)&&r.add(Number(a.id));M.mode==="3d"?Re(performance.now(),{force:!0}):ns(r),He()}function Wp(t){let e=Ae.querySelector("#search-results"),r=t.trim().toLowerCase();if(!r){e.innerHTML="";return}let a=k.scene.nets.filter(n=>String(n.name).toLowerCase().includes(r)).slice(0,8),s=[...k.scene.componentFeatures.values()].filter(n=>!k.hiddenComponents.has(String(n.designator||""))&&`${n.designator} ${n.value} ${n.footprint}`.toLowerCase().includes(r)).slice(0,6);e.innerHTML=[...a.map(n=>`<button data-net="${n.id}"><b>${H(n.name)}</b><span>${H(n.netClass||"")}</span></button>`),...s.map(n=>`<button data-feature="${n.featureId}"><b>${H(n.designator)}</b><span>${H(n.value)}</span></button>`)].join(""),e.querySelectorAll("[data-net]").forEach(n=>{n.addEventListener("click",()=>Vc(Number(n.dataset.net),!0))}),e.querySelectorAll("[data-feature]").forEach(n=>{n.addEventListener("click",()=>Sr(Number(n.dataset.feature),!0))})}function Vc(t,e){e&&(M.selectionAnchor=null),M.activeNetId=t,M.selectedFeatureId=0;let r=k.scene.nets.find(a=>Number(a.id)===t);M.workspace==="schematic"&&r&&O&&(z.activeNetUid=r.uid,O.activeNetUid=r.uid),Ac(),vt.textContent=JSON.stringify(r||{},null,2),nt(),M.isolateNet&&Yr(),e&&r?.boundsMm&&G.frame(Tc(sa(r.boundsMm))),Re(performance.now(),{force:!0}),ii(zb(r))}function Sr(t,e=!1){let r=k.scene.features.get(t);if(r?.kind==="component"&&gs(Jr(r),k.hiddenComponents))return;e&&(M.selectionAnchor=null),M.selectedFeatureId=t,M.activeNetId=Number(r?.netId||0);let a=Jr(r);a&&ft?.setSelectionByReference(a,{scroll:M.workspace==="bom"});let s=Gb(r);s?.kind==="net"?Ac():Kb(),vt.textContent=r?JSON.stringify(r,null,2):"No object selected",nt(),M.isolateNet&&M.activeNetId&&Yr(),e&&r?.bounds&&qc(r),Re(performance.now(),{force:!0}),ii(s)}function Hc(t,e=!1){if(gs(t,k.hiddenComponents))return;let r=k.scene.componentFeatures.get(t);if(ft?.setSelectionByReference(t,{scroll:M.workspace==="bom"}),!r?.featureId)return;Kb(),Sr(Number(r.featureId),!1);let a=sE(t);if(a){let{page:s,feature:n}=a;M.selectedPageId=s.id,M.selectedSchematicFeature={...n,pageId:s.id},O&&(O.selectedPageId=s.id,O.selectedFeatureId=Number(n.id||0)),re?.setSelection?.({kind:"component",featureKey:n.stableKey||"",sheetInstancePath:n.sheetInstancePath||s.sheetInstancePath||"",sourceId:n.sourceId||n.uuid||"",reference:t,feature:n,pageId:s.id}),e&&M.workspace==="schematic"&&(Ct(s.id,!0),re?.frameSelection?.())}if(e&&M.workspace==="pcb"){let s=k.scene.features.get(Number(r.featureId));s?.bounds&&qc(s,!0)}nt()}function Jr(t){return t?.designator||t?.reference||t?.componentDesignator||""}function aE(t=k){return hl(t.scene.manifest?.components||[],t.scene.componentModelCounts)}function Xp(t){k.hiddenComponentRequest=t;let e=bl(t,aE());k.hiddenComponents=e.hiddenReferences,k.renderer?.setHiddenFeatureIds(e.hiddenFeatureIds),e.ambiguous.length&&console.warn(`[prism-semantic-viewer] keeping ambiguous components visible: ${e.ambiguous.join(", ")}`),e.unknown.length&&console.warn(`[prism-semantic-viewer] ignoring unknown components: ${e.unknown.join(", ")}`);let r=Jr(k.scene.features.get(M.selectedFeatureId));gs(r,k.hiddenComponents)&&Ve();let a=Ae.querySelector("input");return a?.value&&Wp(a.value),e}function qc(t,e=!1){if(!t?.bounds)return;let r=Tc(t.bounds);if(e||t.kind==="component"||!!Jr(t)){let n=(r[2]+r[5])*.5<0,i=G.isBelow();n!==i&&G.setAxis("z",n)}G.frame(r)}function sE(t){if(!t||!O?.featuresByPage)return null;let e=z.byId.get(M.selectedPageId),r=[...e?[e]:[],...(z.pages||[]).filter(s=>s.id!==e?.id)],a=s=>{let n=String(s.kind||"").toLowerCase();return n==="component"||n==="symbol_body"||n==="symbol_instance"?0:n==="symbol_reference"?1:n.startsWith("pin")?2:3};for(let s of r){let n=(O.featuresByPage[s.id]||[]).filter(i=>String(i.reference||i.designator||i.componentDesignator||"")===t).sort((i,o)=>a(i)-a(o));if(n.length)return{page:s,feature:n[0]}}return null}function Ve(){M.activeNetId=0,M.selectedFeatureId=0,w&&(w.boardSelected=!1,w.standInKey=null),M.selectedSchematicFeature=null,M.selectionAnchor=null;let t=Qr(),e=M.isolateNet;e&&!t?ea(!1):t?e&&Yr():M.isolateNet=!1,t||Vb(),z.activeNetUid="",O&&(O.activeNetUid=""),re?.setSelection(null),re?.setHighlightedNet(""),vt.textContent="No object selected",ft?.clearSelection?.(),nt(),ii(null)}function zn(t){return`<div class="selection-properties">${t.map(([e,r])=>`
    <div class="selection-property">
      <small>${H(e)}</small>
      <strong title="${H(String(r))}">${H(String(r))}</strong>
    </div>`).join("")}</div>`}function ei(t,e,r){return`
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
      <div class="selection-card-title"><small>${H(t)}</small><strong>${H(e)}</strong></div>
      <button class="selection-card-close" type="button" aria-label="Clear selection">&times;</button>
    </div>`}function nE(t){let r=(k.topology.net_details?.[t.uid]||{}).terminals||[],a=t.metrics||{},s=Number(a.traceLengthMm||0).toFixed(2),n=a.objectCounts?.via||0,i=r.length,c=/^(VCC|VDD|GND|3V3|5V|12V|VIN|POWER)/i.test(t.name)?"#10b981":"#8b5cf6",l=t.netClass||"Default",f=r.length?r.map(d=>`
      <div class="selection-row pin-row-interactive" data-ref="${H(d.designator)}" data-pin="${H(d.pin)}">
        <span class="refdes-col"><strong>${H(d.designator)}</strong></span>
        <span class="pin-col">Pin ${H(d.pin)}</span>
        <span class="val-col" title="${H(d.value||"")}">${H(d.value||"-")}</span>
      </div>`).join(""):'<div class="selection-empty">No connected pin metadata is available.</div>';return`
    ${ei("Net",t.name,c)}
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
    </div>`}function iE(t,e=null){let r=Ec(t.designator),a=r?r.value:t.value||"Not specified",s=r?r.footprint:t.footprint||"Not specified",n=r?.parameters||{},i=n.Manufacturer||n.Mfr||"",o=n["Manufacturer Part Number"]||n.MPN||n["Part Number"]||"",c=n.kicad_dnp==="true"||n.DNP==="true"||n.kicad_in_bom==="false",l="";(i||o)&&(l=`
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
      </div>`);let f="";return e&&(f=`
      <div class="selection-section">
        <span class="selection-section-title">Selected Pin</span>
        <div class="selection-table">
          <div class="selection-row">
            <span><strong>Pin</strong></span>
            <span>Pin ${H(e.pinNumber||e.pin||"")}</span>
            <span title="${H(e.pinName||"")}">${H(e.pinName||"No name")}</span>
          </div>
          <div class="selection-row">
            <span><strong>Net</strong></span>
            <span class="net-ref-interactive" data-net-name="${H(e.netName||"")}">${H(e.netName||"Not connected")}</span>
          </div>
        </div>
      </div>`),`
    ${ei("Component",t.designator||"Unknown","#3b82f6")}
    <div class="selection-component-dashboard">
      ${c?'<div class="dnp-banner" style="background:#b45309;color:#fff;font-size:9px;font-weight:750;text-align:center;padding:3px;margin-bottom:8px;border-radius:2px;text-transform:uppercase;letter-spacing:0.05em;">DNP (Do Not Populate)</div>':""}
      ${zn([["Value",a],["Footprint",s.split(":").pop()||s]])}
      ${l}
      ${f}
    </div>`}function oE(t,e){let r=String(t.kind||"").toLowerCase(),a=r.startsWith("pin");if(r==="component"||r.includes("symbol"))return`
      ${ei("Component",t.reference||t.componentDesignator||"Unknown","#3b82f6")}
      ${zn([["Value",t.value||t.componentValue||"Not specified"],["Footprint",t.componentFootprint||t.footprint||"Not specified"],["Library",t.libraryRef||"Not specified"],["UID",t.componentUid||t.uuid||t.sourceId||"Not resolved"]])}
      <div class="selection-section">
        <span class="selection-section-title">Schematic placement</span>
        ${zn([["Page",e?.name||"Unknown"],["Sheet",t.sheetInstancePath||"/"]])}
      </div>`;let n=a?[["Symbol",t.reference||t.designator||"Unknown"],["Value",t.value||t.componentValue||"Not specified"],["Pin",`${t.pinNumber||"-"}${t.pinName?` ${t.pinName}`:""}`],["Net",t.netName||"Not connected"],["PCB Pad",t.pcbPadId||"Not resolved"],["Component UID",t.componentUid||"Not resolved"]]:[["Page",e?.name||"Unknown"],["Kind",t.kind.replaceAll("_"," ")],["Net",t.netName||"Not connected"]];return`
    ${ei(t.kind.replaceAll("_"," "),t.pinName||t.reference||t.designator||t.text||t.netName||"Schematic object","#3b82f6")}
    ${zn(n)}
    <div class="selection-section">
      <span class="selection-section-title">Source identity</span>
      <div class="selection-table">
        <div class="selection-row">
          <span><strong>${a?"Pin UUID":"UUID"}</strong></span>
          <span title="${H(t.uuid||t.sourceId||"")}">${H(t.uuid||t.sourceId||"-")}</span>
          <span title="${H(t.objectId||"")}">${H(t.objectId||"No object ID")}</span>
        </div>
        <div class="selection-row">
          <span><strong>Sheet</strong></span>
          <span>${H(e?.name||"Unknown")}</span>
          <span title="${H(t.sheetInstancePath||"")}">${H(t.sheetInstancePath||"/")}</span>
        </div>
      </div>
    </div>`}function nt(){if(Bt(),M.workspace==="bom"){se.hidden=!0,se.innerHTML="";return}let t=k.scene.features.get(M.selectedFeatureId),e=t?.kind==="component"?t:null,r=M.workspace==="schematic"?M.selectedSchematicFeature:null,a=r?z.byId.get(r.pageId):null,s=M.activeNetId?k.scene.nets.find(d=>Number(d.id)===M.activeNetId):null;if(!s&&r&&(r.netUid?s=k.scene.nets.find(d=>d.uid===r.netUid):r.netName&&(s=lr(k.scene.nets,r.netName))),!e&&r){let d=r.reference||r.componentDesignator||r.designator;d&&(e=k.scene.componentFeatures.get(d)||{designator:d})}if(!e&&!s&&!r){se.hidden=!0,se.innerHTML="";return}let n="";if(s)n=nE(s);else if(e){let d=r?.kind?.startsWith("pin")?r:null;n=iE(e,d)}else r&&(n=oE(r,a));se.innerHTML=`
    ${n}
    <div class="selection-card-actions">
      ${s?`
        <button type="button" data-action="isolate" aria-keyshortcuts="I" title="Toggle isolated net view (I)" class="${M.isolateNet?"active":""}">Isolate</button>
        <button type="button" data-action="net-layers">Layers</button>
      `:""}
      <button type="button" data-action="frame">Frame selection</button>
    </div>`,se.hidden=!1;let i=M.workspace==="schematic"?Ke:L,o=M.selectionAnchor,c=se.offsetWidth||360,l=se.offsetHeight||330;if(o){let d=Math.max(16,i.clientWidth-c-24),p=Math.max(16,i.clientHeight-l-24);se.style.left=`${fe(o.x+18,16,d)}px`,se.style.top=`${fe(o.y+18,16,p)}px`}else se.style.left="20px",se.style.top="20px";if(se.querySelector(".selection-card-close").addEventListener("click",Ve),se.querySelector("[data-action=frame]").addEventListener("click",Wc),s){let d=se.querySelector("[data-action=isolate]");d&&d.addEventListener("click",()=>{ea(!M.isolateNet)});let p=se.querySelector("[data-action=net-layers]");p&&p.addEventListener("click",Kc),se.querySelectorAll(".pin-row-interactive").forEach(b=>{b.addEventListener("click",()=>{let h=b.dataset.ref,u=b.dataset.pin;if(!h)return;let y=((k.topology.net_details?.[s.uid]||{}).terminals||[]).find(v=>v.designator===h&&v.pin===u),x=bM(y);x?Sr(x,!0):Hc(h,!0)})})}let f=se.querySelector(".net-ref-interactive");f&&f.addEventListener("click",()=>{let d=f.dataset.netName;if(!d)return;let p=lr(k.scene.nets,d);p&&Vc(Number(p.id),!0)})}function Wc(){if(M.workspace==="schematic"){Dp();return}let t=k.scene.features.get(M.selectedFeatureId);if(t?.bounds)qc(t);else{let e=k.scene.nets.find(r=>Number(r.id)===M.activeNetId);e?.boundsMm&&G.frame(Tc(sa(e.boundsMm)))}}function $p(){L.addEventListener("contextmenu",t=>t.preventDefault()),L.addEventListener("pointerdown",t=>{w&&(w.framed=!0),!(w&&wk(t))&&(M.dragging=!0,M.lastX=t.clientX,M.lastY=t.clientY,M.pointerStartX=t.clientX,M.pointerStartY=t.clientY,M.dragMode=M.mode==="layer"||t.shiftKey||t.button!==0?"pan":"orbit",L.setPointerCapture(t.pointerId))}),L.addEventListener("pointermove",t=>{if(w&&Ep(t)||(w?.move.route&&!M.dragging&&(L.style.cursor=Dc(t)?"crosshair":""),!M.dragging))return;let e=t.clientX-M.lastX,r=t.clientY-M.lastY;M.lastX=t.clientX,M.lastY=t.clientY,M.dragMode==="pan"?G.pan(e,r,L.clientHeight,M.mode==="layer"):G.orbit(e,r)}),L.addEventListener("pointerup",async t=>{w&&Sp(t)||(M.dragging=!1,L.releasePointerCapture(t.pointerId),!(Math.hypot(t.clientX-M.pointerStartX,t.clientY-M.pointerStartY)>=3)&&M.clickSelect&&(t.button===0?await Ab(t):t.button===2&&await uE(t)))}),L.addEventListener("dblclick",async t=>{M.clickSelect&&(await Ab(t),Wc())}),L.addEventListener("wheel",t=>{w&&(w.framed=!0),t.preventDefault(),Math.abs(t.deltaX)>Math.abs(t.deltaY)*.4?G.pan(-t.deltaX,0,L.clientHeight,M.mode==="layer"):G.dolly(t.deltaY,M.mode==="layer")},{passive:!1}),window.addEventListener("keydown",tg),cE()}function cE(){let t=!1,e,r,a=0,s=0;se.addEventListener("pointerdown",n=>{if(!n.target.closest(".selection-card-head")||n.target.closest(".selection-card-close"))return;t=!0,se.classList.add("dragging");let o=se.getBoundingClientRect();a=o.left,s=o.top,e=n.clientX,r=n.clientY,se.setPointerCapture(n.pointerId),n.stopPropagation()}),se.addEventListener("pointermove",n=>{if(!t)return;let i=n.clientX-e,o=n.clientY-r,c=M.workspace==="schematic"?Ke:L,l=se.offsetWidth||360,f=se.offsetHeight||330,d=Math.max(16,c.clientWidth-l-24),p=Math.max(16,c.clientHeight-f-24),b=fe(a+i,16,d),h=fe(s+o,16,p);se.style.left=`${b}px`,se.style.top=`${h}px`,M.selectionAnchor={x:b-18,y:h-18},n.stopPropagation()}),se.addEventListener("pointerup",n=>{t&&(t=!1,se.classList.remove("dragging"),se.releasePointerCapture(n.pointerId),n.stopPropagation())})}function lE(){xr("[data-workspace]").forEach(t=>{t.addEventListener("click",()=>Yp(t.dataset.workspace))})}function Yp(t){if(t==="schematic"&&!O||t==="bom"&&!ft)return;M.workspace=t,Nt.classList.remove("workspace-pcb","workspace-schematic","workspace-bom","workspace-stackup"),Nt.classList.add(`workspace-${t}`),(t==="schematic"&&(M.activeTab==="view"||M.activeTab==="inspect"||M.activeTab==="stats")||t==="bom"||t==="stackup")&&ti("layers");let e=Z('.rail-tab[data-tab="layers"]');e&&(t==="schematic"?(e.textContent="Pages",e.title="Schematic pages"):t==="bom"?(e.textContent="Summary",e.title="BoM summary"):(e.textContent="Layers",e.title="Layers and compare"));let r=t==="schematic",a=t==="bom",s=t==="stackup";if(L.hidden=r||a||s,Ke&&(Ke.hidden=!r),Gn&&(Gn.hidden=!r||!re),Kn&&(Kn.hidden=!r),Vn&&(Vn.hidden=!a),We&&(We.hidden=!s),Ge.hidden=r||a||s,Hn.hidden=r||a||s,Xa&&(Xa.hidden=!r),xr("[data-workspace]").forEach(n=>{n.classList.toggle("active",n.dataset.workspace===t)}),qr.textContent=a?"Semantic BoM active":r?re?"SVG DOM + WebGPU schematic world active":"WebGPU schematic world active":s?"Layer Stackup active":"WebGPU semantic glTF active",r&&!z.fitted&&(O.resize(),O.frameWorld(),z.fitted=!0),!r&&!a&&!s&&(k.renderer?.resize(),M.mode==="layer"?Uc():Re(performance.now(),{force:!0})),s)try{yE()}catch(n){console.error("Failed to render stackup workspace",n),We&&(We.innerHTML=`
          <div class="selection-empty" style="padding:40px;text-align:center;">
            Stackup view failed to render. ${H(n?.message||String(n))}
          </div>
        `)}zc(),nt()}function dE(){Ke.addEventListener("pointerdown",t=>{re?.worldActive||re?.active||(M.schematicDragging=!0,M.schematicLastX=t.clientX,M.schematicLastY=t.clientY,M.schematicStartX=t.clientX,M.schematicStartY=t.clientY,Ke.setPointerCapture(t.pointerId))}),Ke.addEventListener("pointermove",t=>{if(re?.worldActive||re?.active||!M.schematicDragging||!O)return;let e=t.clientX-M.schematicLastX,r=t.clientY-M.schematicLastY;M.schematicLastX=t.clientX,M.schematicLastY=t.clientY,O.pan(e,r)}),Ke.addEventListener("pointerup",async t=>{if(!(re?.worldActive||re?.active)&&(M.schematicDragging=!1,Ke.releasePointerCapture(t.pointerId),Math.hypot(t.clientX-M.schematicStartX,t.clientY-M.schematicStartY)<3)){let e=await O.pickFeature(t.clientX,t.clientY);e?Yk(e):is()}}),Ke.addEventListener("dblclick",t=>{if(re?.worldActive||re?.active)return;let e=O.hitPage(t.clientX,t.clientY);e&&Ct(e.id,!0)}),Ke.addEventListener("wheel",t=>{re?.worldActive||re?.active||(t.preventDefault(),O.zoom(t.deltaY,t.clientX,t.clientY))},{passive:!1})}function Eb(t,e=11,r=32){let a=yr(t,rt),s=yr([t[0]+1e-4,t[1],t[2]],rt),n=yr([t[0],t[1]+1e-4,t[2]],rt);if(!a||!s||!n)return null;let i=Math.max(Math.hypot(s.x-a.x,s.y-a.y),Math.hypot(n.x-a.x,n.y-a.y))/1e-4;if(!(i>0))return null;let o=e/i,c=[];for(let l=0;l<r;l++){let f=2*Math.PI*l/r,d=yr([t[0]+o*Math.cos(f),t[1]+o*Math.sin(f),t[2]],rt);if(!d)return null;c.push(d)}return{centre:a,ring:c}}function Sb(t,e){if(!ee||!L)return null;let r=L.getBoundingClientRect(),a=(t-r.left)/r.width*2-1,s=1-(e-r.top)/r.height*2;return Tf(ee.matrix,a,s)}var Tb=0;async function Ab(t){if(!ee)return;let e=++Tb,r=L.getBoundingClientRect();if(M.selectionAnchor={x:t.clientX-r.left,y:t.clientY-r.top},w&&xk(t))return;let a=await Jp(t);if(e===Tb){if(w){XM(a);return}(a.kind==="feature"||a.kind==="board")&&(M.selectedOccurrence=a.occurrenceIndex),a.featureId?Sr(a.featureId,!0):a.kind==="board"&&!k.renderer.identityOnly?Xc():Ve()}}async function uE(t){if(!ee||!$n)return;let e=await Jp(t),r=w?w.placements.get(e.occurrenceKey)?.board:k;if(!r)return;let a=r.scene.features.get(e.featureId),s=Jr(a),n=s?Ec(s,r):null;$n({clientX:t.clientX,clientY:t.clientY,reference:s||void 0,value:String(n?.value||a?.value||"")||void 0})}function fE(t,e){if(!w||!L)return null;let r=L.getBoundingClientRect(),a=(t-r.left)/r.width*2-1,s=1-(e-r.top)/r.height*2,n=Sf(G,a,s,r.width/Math.max(r.height,1)),i=w.placed.filter(c=>c.primitives&&c.occurrence.pickSurface).map(c=>({key:c.occurrence.path,matrix:c.matrix,primitives:c.primitives})),o=_f(i,n);return o?{occurrence:o.key,pointMm:o.point.map(c=>c/Oc),normal:o.normal,toCamera:n.direction.map(c=>-c)}:null}function hE(t){let e=t!=null?w?.placements.get(String(t)):null;return e?(Nc(e),!0):!1}function Jp(t){let e=L.getBoundingClientRect();return Qp((t.clientX-e.left)*L.width/e.width,(t.clientY-e.top)*L.height/e.height)}async function Qp(t,e){if(w)return WM(t,e);let r=await bE(t,e);return r?.kind==="analytic"&&k.analytic?{...r,featureId:await ic(k.analytic,r.operationIndex)||null}:r}function bE(t,e){return k.renderer.pick(ee,t,e,{activeNetId:M.activeNetId,selectedFeatureId:M.selectedFeatureId,layerOffsets:Zn(),visibleLayers:M.mode==="3d"?k.visible3dLayers:k.compareLayers,showBoard:M.showBoard,showComponents:M.showComponents,componentOpacity:fe(1-M.separation/.1,0,1),boardOpacity:1-M.separation*.72,isolateNet:M.isolateNet,compareMode:M.mode==="layer",compareOffsets:vr,visibleTileIds:M.mode==="3d"?k.visibleTileIds:null})}async function Zp(t,e){if(!ee||!(w||k.renderer))return null;let r=L.getBoundingClientRect(),a=await Qp((t-r.left)*L.width/r.width,(e-r.top)*L.height/r.height),s=w?w.placements.get(a.occurrenceKey)?.board:k,n=a.featureId&&s?Gb(s.scene.features.get(a.featureId),s):null;return{...a,renderer:void 0,selection:n}}function Xc(){let t=M.selectedOccurrence,e=Je;Je=!0;try{Ve()}finally{Je=e}M.selectedOccurrence=t,w&&(w.boardSelected=!0),ii({kind:"board",sourceContext:"3D"})}function eg(t,e,r){let a=t.scene.componentFeatures.get(String(e)),s=a?t.scene.features.get(Number(a.featureId))?.bounds:null;if(!s)return null;let n=s[2]+s[5]>=0;return r([(s[0]+s[3])/2,(s[1]+s[4])/2,n?s[5]:s[2]])}function yr(t,e){if(!ee)return null;let r=ba(ee.matrix,Ps(e,t),ee.viewport);if(!r)return null;let a=L.getBoundingClientRect();return{x:a.left+r.x*a.width/L.width,y:a.top+r.y*a.height/L.height}}function tg(t){if(!ni())return;if(vl(t)){t.key==="Escape"&&t.target instanceof HTMLInputElement&&t.target.blur();return}if(Ml(t))return;let e=t.key.toLowerCase();if(M.workspace==="schematic"){if(e==="/")t.preventDefault(),ti("search"),Ae.querySelector("#entity-search")?.focus();else if(e==="escape")z.activeNetUid?(z.activeNetUid="",M.activeNetId=0,O.activeNetUid="",re?.setHighlightedNet(""),nt()):is();else if(e==="~"||t.key==="~"){t.preventDefault();let r=M.selectedSchematicFeature?.netUid;r&&(z.activeNetUid===r?(z.activeNetUid="",M.activeNetId=0,O.activeNetUid="",re?.setHighlightedNet("")):Lp(r,M.selectedSchematicFeature))}else if(e==="home")O?.frameWorld();else if(e==="[")Un("previous");else if(e==="]")Un("next");else if(e==="n"){t.preventDefault();let r=O?.cycleNetIntrasheetLink(t.shiftKey?-1:1);r?.pageId&&(M.selectedPageId=r.pageId,O.selectedPageId=r.pageId,sg())}else if(t.altKey&&e==="arrowup")Un("parent");else if(t.key.startsWith("Arrow")){t.preventDefault();let r=t.key==="ArrowRight"?32:t.key==="ArrowLeft"?-32:0,a=t.key==="ArrowDown"?32:t.key==="ArrowUp"?-32:0;O?.pan(r,a)}return}if(w&&pk(t,e)){t.preventDefault();return}if(e==="/")t.preventDefault(),ti("search"),Ae.querySelector("#entity-search").focus();else if(e==="escape")Ve();else if(e==="i"&&M.workspace==="pcb"&&Qr())t.preventDefault(),ea(!M.isolateNet);else if(e==="home")G.frame(w&&w.bounds||or());else if(e==="`")sp(!M.showStats);else if(["x","y","z"].includes(e))G.setAxis(e,t.shiftKey);else if(e==="f")G.flip();else if(e==="r")G.rotateZ(t.shiftKey?-1:1);else if(e===" "){t.preventDefault();let r=k.scene.features.get(M.selectedFeatureId);r?.bounds&&G.setFocus([(r.bounds[0]+r.bounds[3])/2,(r.bounds[1]+r.bounds[4])/2,(r.bounds[2]+r.bounds[5])/2])}else if(t.key.startsWith("Arrow")){t.preventDefault();let r=t.key==="ArrowRight"?32:t.key==="ArrowLeft"?-32:0,a=t.key==="ArrowDown"?32:t.key==="ArrowUp"?-32:0;G.pan(r,a,L.clientHeight,M.mode==="layer")}}function ti(t){M.activeTab=t,Nt.classList.remove("panel-collapsed"),xr(".rail-tab").forEach(e=>{e.classList.toggle("active",e.dataset.tab===t)}),xr(".tab-panel").forEach(e=>{e.classList.toggle("active",e.dataset.panel===t)})}function rg(){let t=Ge.getContext("2d");t.clearRect(0,0,Ge.width,Ge.height);let e=[Ge.width/2,Ge.height/2],r=G.basis(),a=[{axis:"x",label:"X",color:"#e23838",vector:[1,0,0]},{axis:"y",label:"Y",color:"#2dbd50",vector:[0,1,0]},{axis:"z",label:"Z",color:"#3157d5",vector:[0,0,1]}],s=[];for(let n of a)for(let i of[-1,1]){let o=n.vector.map(l=>l*i),c=[uc(o,r.right),-uc(o,r.up),uc(o,r.back)];s.push({...n,sign:i,depth:c[2],point:[e[0]+c[0]*34,e[1]+c[1]*34]})}for(let n of a){let i=s.find(o=>o.axis===n.axis&&o.sign===1);t.strokeStyle=n.color,t.lineWidth=2.4,t.beginPath(),t.moveTo(...e),t.lineTo(...i.point),t.stroke()}Wn=[];for(let n of s.sort((i,o)=>o.depth-i.depth)){let i=n.sign===1,o=i?13:9;t.beginPath(),t.arc(n.point[0],n.point[1],o,0,Math.PI*2),t.fillStyle=i?n.color:`${n.color}66`,t.fill(),t.lineWidth=2,t.strokeStyle=mE(n.color,i?.45:.58),t.stroke(),i&&(t.fillStyle="#07101c",t.font="700 13px system-ui",t.textAlign="center",t.textBaseline="middle",t.fillText(n.label,n.point[0],n.point[1]+.5)),Wn.push({...n,radius:o+5})}}function ag(){!Ge||Ge.dataset.bound==="true"||(Ge.dataset.bound="true",Ge.addEventListener("click",t=>{let e=Ge.width/Ge.clientWidth,r=Ge.height/Ge.clientHeight,a=[t.offsetX*e,t.offsetY*r],s=Wn.map(n=>({item:n,distance:Math.hypot(a[0]-n.point[0],a[1]-n.point[1])})).filter(({item:n,distance:i})=>i<=n.radius).sort((n,i)=>n.distance-i.distance)[0]?.item;s&&G.setAxis(s.axis,s.sign<0)}))}function pE(){if(M.mode!=="layer"||!ee){Hn.innerHTML="";return}let t=or(),e=$b();Hn.innerHTML=k.scene.copperLayers.filter(r=>e.has(Number(r.id))).map(r=>{let a=vr.get(Number(r.id))||[0,0,0],s=gE([t[0]+a[0],t[4]+a[1],0],ee.matrix,L.clientWidth,L.clientHeight);return!s||s[0]<-100||s[0]>L.clientWidth+100||s[1]<-100||s[1]>L.clientHeight+100?"":`<span style="left:${s[0]}px;top:${s[1]}px">${H(r.name)}</span>`}).join("")}function sg(){if(M.workspace!=="schematic"||!O){Xa.innerHTML="";return}Xa.innerHTML=z.visiblePages.filter(t=>O.pagePixelWidth(t)>120).map(t=>{let[e,r]=O.worldToScreen(t.worldX+8*O.scale,t.worldY-6*O.scale),a=t.id===M.selectedPageId,n=z.activeNetUid&&t.netUids.includes(z.activeNetUid)?"#18ef52":a?"#3b82f6":"#4b8de8";return`<div class="schematic-page-label" style="left:${e}px;top:${r}px;border-left-color:${n}">
        <strong>${H(t.name)}</strong>
        <small>Page ${t.sheetNumber} &middot; ${t.featureCount.toLocaleString()} features</small>
      </div>`}).join("")}function gE(t,e,r,a){let s=t[0],n=t[1],i=t[2],o=e[0]*s+e[4]*n+e[8]*i+e[12],c=e[1]*s+e[5]*n+e[9]*i+e[13],l=e[3]*s+e[7]*n+e[11]*i+e[15];return Math.abs(l)<1e-8?null:[(o/l*.5+.5)*r,(.5-c/l*.5)*a]}function uc(t,e){return t[0]*e[0]+t[1]*e[1]+t[2]*e[2]}function mE(t,e){let r=t.replace("#","");return`#${[0,2,4].map(a=>Math.round(parseInt(r.slice(a,a+2),16)*e).toString(16).padStart(2,"0")).join("")}`}function vc(t,e){M.frameSamples.push({intervalMs:t,cpuMs:e}),M.frameSamples.length>180&&M.frameSamples.shift()}function _b(t,e){if(!t.length)return 0;let r=[...t].sort((a,s)=>a-s);return r[Math.min(r.length-1,Math.floor((r.length-1)*e))]}function Mc(t){if(!Pn||(M.frames+=1,t-M.fpsAt<=500))return;M.fps=M.frames*1e3/(t-M.fpsAt);let e=M.frameSamples;if(M.frameIntervalMs=e.length?e.reduce((n,i)=>n+i.intervalMs,0)/e.length:0,M.frameCpuMs=e.length?e.reduce((n,i)=>n+i.cpuMs,0)/e.length:0,M.frameIntervalP95Ms=_b(e.map(n=>n.intervalMs),.95),M.frameCpuP95Ms=_b(e.map(n=>n.cpuMs),.95),M.frames=0,M.fpsAt=t,np(),M.workspace==="bom"){let n=ft?.payload?.counts||{},i=[["Renderer","BoM DOM table"],["Schema",ft?.payload?.schema||"-"],["Grouped rows",n.rows||0],["Components",n.components||0],["DNP components",n.dnpComponents||0],["Extra columns",ft?.payload?.extraColumns?.length||0],["Frame interval",`${M.frameIntervalMs.toFixed(2)} ms avg / ${M.frameIntervalP95Ms.toFixed(2)} p95`],["CPU frame",`${M.frameCpuMs.toFixed(2)} ms avg / ${M.frameCpuP95Ms.toFixed(2)} p95`],["FPS",M.fps.toFixed(1)]];Pn.innerHTML=i.map(([o,c])=>`<dt>${o}</dt><dd>${c}</dd>`).join("");return}let r=M.workspace==="schematic"&&O?O.stats():null,a=M.workspace==="schematic"&&re?re.stats():null,s=M.workspace==="schematic"&&O?re?.active?[["Renderer","SVG DOM schematic detail"],["Pages",z.pages.length],["Mounted pages",a.mountedPages],["Active page",a.activePage],["DOM nodes",a.domNodes.toLocaleString()],["Indexed features",a.indexedFeatures.toLocaleString()],["Indexed nets",a.indexedNets.toLocaleString()],["SVG cache",`${a.cachedSvgPages} pages / ${(a.cachedSvgBytes/1048576).toFixed(1)} MB`],["Selection",`${a.selectionMs.toFixed(1)} ms`],["Active net",k.scene.nets.find(n=>n.uid===z.activeNetUid)?.name||"-"],["Tracking links",`${r.netFlowSegments} total / ${r.netFlowIntrasheetSegments} local`],["Tracking verts",r.netFlowVertices.toLocaleString()],["Mount",`${a.mountMs.toFixed(1)} ms`],["Highlight",`${a.highlightMs.toFixed(1)} ms`],["Fallback",a.fallbackReason||"-"],["Frame interval",`${M.frameIntervalMs.toFixed(2)} ms avg / ${M.frameIntervalP95Ms.toFixed(2)} p95`],["CPU frame",`${M.frameCpuMs.toFixed(2)} ms avg / ${M.frameCpuP95Ms.toFixed(2)} p95`],["FPS",M.fps.toFixed(1)]]:[["Renderer",re?"SVG DOM + WebGPU world":"WebGPU schematic world"],["Pages",z.pages.length],["Visible pages",z.visiblePages.length],["DOM pages",a?a.mountedPages:0],["DOM nodes",a?a.domNodes.toLocaleString():"0"],["Indexed SVG features",a?a.indexedFeatures.toLocaleString():"0"],["SVG cache",a?`${a.cachedSvgPages} pages / ${(a.cachedSvgBytes/1048576).toFixed(1)} MB`:"0 pages"],["JS heap",a?.heapMb?`${a.heapMb.toFixed(1)} MB`:"-"],["Hierarchy links",z.manifest.edges?.length||0],["Selected page",z.byId.get(M.selectedPageId)?.name||"-"],["Active net",k.scene.nets.find(n=>n.uid===z.activeNetUid)?.name||"-"],["Tracking links",`${r.netFlowSegments} total / ${r.netFlowIntrasheetSegments} local`],["Downloaded",`${(O.downloadedBytes/1048576).toFixed(1)} MB`],["Resident vectors",`${(r.residentVectorBytes/1048576).toFixed(1)} MB`],["Vector pages",`${r.vectorChunks} loaded / ${r.vectorLoads} loading`],["Vector draw",`${r.vectorVertices.toLocaleString()} verts / ${r.vectorDrawChunks} chunks`],["Native detail",`${r.nativeDetailPages} pages @ ${r.nativePxPerMm} / ${r.nativeThresholdPxPerMm} px/mm`],["Vector failures",r.failedVectorChunks],["Truncated",r.truncatedVectors],["Frame interval",`${M.frameIntervalMs.toFixed(2)} ms avg / ${M.frameIntervalP95Ms.toFixed(2)} p95`],["CPU frame",`${M.frameCpuMs.toFixed(2)} ms avg / ${M.frameCpuP95Ms.toFixed(2)} p95`],["FPS",M.fps.toFixed(1)]]:[["Renderer","WebGPU semantic glTF"],["Mode",M.mode==="3d"?"3D":"Layer Compare"],["Visible layers",M.mode==="3d"?k.visible3dLayers.size:k.compareLayers.size],["Resident tiles",k.scene.loaded.size],["Loading tiles",k.scene.loading.size],["Failed tiles",k.scene.failed.size],["Triangles",Math.round(k.triangles).toLocaleString()],["Downloaded",`${(k.loadedBytes/1048576).toFixed(1)} MB`],["Resident GLB",`${(k.residentTileBytes/1048576).toFixed(1)} MB`],["Resident GPU",`${(k.residentTileGpuBytes/1048576).toFixed(1)} MB`],["Tile loads",k.tileLoads.toLocaleString()],["Tile evictions",k.tileEvictions.toLocaleString()],["Tile scheduler",`${k.tileSchedulerMs.toFixed(2)} ms`],["Active net",k.scene.nets.find(n=>Number(n.id)===M.activeNetId)?.name||"-"],["Frame interval",`${M.frameIntervalMs.toFixed(2)} ms avg / ${M.frameIntervalP95Ms.toFixed(2)} p95`],["CPU frame",`${M.frameCpuMs.toFixed(2)} ms avg / ${M.frameCpuP95Ms.toFixed(2)} p95`],["FPS",M.fps.toFixed(1)]];Pn.innerHTML=s.map(([n,i])=>`<dt>${n}</dt><dd>${i}</dd>`).join("")}function bi(t){return`rgb(${t.slice(0,3).map(e=>Math.round(e*255)).join(" ")})`}function yE(){if(!We)return;let t=k.scene.layers||[];if(!t.length){We.innerHTML='<div class="selection-empty" style="padding:40px;text-align:center;">No stackup information available for this board.</div>';return}let e=t.filter(A=>["copper","dielectric","paste","silkscreen","soldermask"].includes(A.role)),r=k.topology.board?.stackup||{},a=A=>{if(A==null||A==="")return"None";let P=String(A);return H(P.includes(".")?P.split(".").pop():P)},s=(A,P=4)=>{let U=Number(A);return Number.isFinite(U)&&U>0?U.toFixed(P):"-"},n=(A,P=3)=>{let U=Number(A);return Number.isFinite(U)?U.toFixed(P):"-"},i=A=>{if(A==null||A==="")return"No";if(typeof A=="boolean")return A?"Yes":"No";let P=String(A).trim().toLowerCase(),U=P.includes(".")?P.split(".").pop():P;return["0","false","no","n","off","none"].includes(U)?"No":(["1","true","yes","y","on"].includes(U),"Yes")},o=A=>({copper:"Copper",dielectric:"Dielectric",paste:"Paste",silkscreen:"Silkscreen",soldermask:"Solder mask"})[A]||String(A||"Layer"),c=A=>A.role!=="dielectric"?"":A.type==="core"?"Core":A.type==="prepreg"||(A.material||"").toLowerCase().includes("prepreg")?"Prepreg":"Core",l=(A,P=4)=>{let U=Number(A.thickness_mm);return Number.isFinite(U)&&U>0?`${U.toFixed(P)} mm`:"Not specified"},f=A=>{let P=o(A.role),U=String(A.material||"").trim(),J=U&&U.toLowerCase()!==String(A.role||"").toLowerCase();if(A.role==="dielectric"){let pe=[J?U:"",s(A.epsilon_r,3)!=="-"?`\u03B5r ${s(A.epsilon_r,3)}`:"",s(A.loss_tangent,4)!=="-"?`tan \u03B4 ${s(A.loss_tangent,4)}`:""].filter(Boolean).join(" \xB7 ");return{primary:`${A.name} \xB7 ${c(A)}`,secondary:pe}}return{primary:[A.name,P,J?U:""].filter(Boolean).join(" \xB7 "),secondary:""}},d=0,p=0,b=0,h=0;e.forEach(A=>{h+=A.thickness_mm||0,A.role==="copper"?A.name.toLowerCase().includes("gnd")||A.name.toLowerCase().includes("pwr")||A.name.toLowerCase().includes("plane")?p++:d++:A.role==="dielectric"&&b++});let u=k.scene.copperLayers||[],m=0,g=0,y=0,x=[...(k.scene.manifest?.barrels||[]).filter(A=>A.kind==="via"),...[...k.scene.features.values()].filter(A=>A.kind==="via")],v=tf(u,x);m=v.counts.thru,g=v.counts.blind,y=v.counts.buried;let E=v.spans,S=30,T=S,_=[],I=new Map(e.map((A,P)=>[A,P])),N=xE(e),C=(A,P)=>{let U=N.get(A.name);if(U!==void 0)return U;let J=Number(A.stack_index);return Number.isFinite(J)?J:P+1e5},B=[...e].sort((A,P)=>{let U=C(A,I.get(A)||0),J=C(P,I.get(P)||0);return U!==J?U-J:(P.z_mm||0)-(A.z_mm||0)});B.forEach(A=>{let P=12;A.role==="dielectric"?P=Math.max(160,Math.min(360,(A.thickness_mm||.1)*140)):A.role==="copper"?P=22:A.role==="soldermask"&&(P=14),_.push({...A,svgY:T,svgHeight:P}),T+=P});let R=800,j=130,q=240,Y=j+q+16,te=Y+84,ye="";_.forEach(A=>{let P=A.color||"#7f7f7f";A.role==="copper"?P=A.color||"#f97316":A.role==="dielectric"?P="#a98d5c":A.role==="paste"?P="#cbd5e1":A.role==="soldermask"?P="#1b4332":A.role==="silkscreen"&&(P="#e2e8f0");let U=u.findIndex(dg=>dg.name===A.name),J=f(A),pe=A.svgY+A.svgHeight/2,ve=!!J.secondary&&A.svgHeight>=38,ht=ve?pe-5:pe+3,Ar=H(A.id),kt=H(A.name),D=Number.isFinite(Number(A.thickness_mm))&&Number(A.thickness_mm)>0,ie=H(D?l(A):"\u2014"),it=H([J.primary,J.secondary,`Thickness ${l(A)}`].filter(Boolean).join("; "));ye+=`
      <g class="stackup-svg-layer" data-layer-id="${Ar}" data-layer-name="${kt}">
        <title>${it}</title>
        <rect x="${j}" y="${A.svgY}" width="${q}" height="${A.svgHeight}" fill="${P}" opacity="0.85" rx="1"/>
        <text x="${j-8}" y="${A.svgY+A.svgHeight/2+3}" fill="var(--muted)" font-size="9px" text-anchor="end" font-weight="700">
          ${A.role==="copper"?U+1:""}
        </text>
        <path class="stackup-layer-dimension" d="M ${Y+6} ${A.svgY+1} H ${Y} V ${A.svgY+A.svgHeight-1} H ${Y+6}" />
        <text class="stackup-layer-thickness" x="${Y+10}" y="${pe+3}" fill="var(--muted)" font-size="8.5px" font-weight="650">
          ${ie}
        </text>
        <text class="stackup-layer-name" x="${te}" y="${ht}" fill="var(--foreground)" font-size="9px" font-weight="650">
          ${H(J.primary)}
        </text>
        ${ve?`<text class="stackup-layer-metadata" x="${te}" y="${pe+10}" fill="var(--muted)" font-size="8px">${H(J.secondary)}</text>`:""}
      </g>
    `});let ne="",me=_.filter(A=>A.role==="copper");E.forEach((A,P)=>{let U=_.find(D=>D.name===A.startName),J=_.find(D=>D.name===A.endName);if(!U||!J)return;let pe=U.svgY,ve=J.svgY+J.svgHeight,ht=j+(P+1)*q/(E.length+1),Ar=A.type==="thru"?"Thru":A.type==="blind"?"Blind":"Buried",kt=`var(--stackup-via-${A.type})`;ne+=`
      <g class="stackup-svg-via" data-via-type="${A.type}">
        <title>${Ar}: ${A.startName} \u2192 ${A.endName}</title>
        ${me.map(D=>D.svgY>=U.svgY&&D.svgY<=J.svgY?`<rect x="${ht-5}" y="${D.svgY}" width="10" height="${D.svgHeight}" fill="${kt}" rx="0.5" />`:"").join("")}
        <rect x="${ht-2}" y="${pe}" width="4" height="${ve-pe}" fill="${kt}" opacity="0.95" />
        <rect x="${ht-.75}" y="${pe-1}" width="1.5" height="${ve-pe+2}" fill="var(--panel)" opacity="0.9" />
      </g>
    `});let Ie=`
    <svg class="stackup-visual-svg" viewBox="0 0 ${R} ${T+10}" width="${R}" height="${T+10}">
      <g class="stackup-svg-column-headings" aria-hidden="true">
        <text x="${Y+10}" y="15">Thickness</text>
        <text x="${te}" y="15">Layer / material properties</text>
      </g>
      <g class="stackup-total-dimension" aria-label="Total board thickness ${h.toFixed(4)} millimetres">
        <path d="M 76 ${S} H 68 V ${T} H 76" />
        <text x="68" y="15">Total ${h.toFixed(4)} mm</text>
      </g>
      ${ye}
      ${ne}
    </svg>
    <div class="stackup-via-legend" aria-label="Via span legend">
      <span><i data-via-type="thru"></i>Thru</span>
      <span><i data-via-type="blind"></i>Blind</span>
      <span><i data-via-type="buried"></i>Buried</span>
    </div>
  `,be="";B.forEach(A=>{let P="silk";A.role==="copper"?P="copper":A.role==="dielectric"?P="dielectric":A.role==="paste"?P="paste":A.role==="soldermask"&&(P="mask");let U=c(A),J=H(A.id),pe=H(A.name),ve=f(A);be+=`
      <tr data-layer-id="${J}" data-layer-name="${pe}" tabindex="0" aria-label="${H(`${ve.primary}; thickness ${l(A)}`)}">
        <td><strong>${pe}</strong></td>
        <td><span class="stackup-badge ${P}">${A.role}</span></td>
        <td>${U||"-"}</td>
        <td>${H(A.material||"-")}</td>
        <td>${A.role==="dielectric"?s(A.epsilon_r,3):"-"}</td>
        <td>${A.role==="dielectric"?s(A.loss_tangent,4):"-"}</td>
        <td>${A.thickness_mm?A.thickness_mm.toFixed(4)+" mm":"-"}</td>
      </tr>
    `});let Ce="",xe=k.topology.board?.net_classes||[],De=A=>{let P=n(A);return P==="-"?P:`${P} mm`};xe.length?xe.forEach(A=>{Ce+=`
        <tr>
          <td><strong>${A.name}</strong></td>
          <td>${De(A.track_width)}</td>
          <td>${De(A.clearance)}</td>
          <td>${De(A.diff_pair_width)}</td>
          <td>${De(A.diff_pair_gap)}</td>
          <td>${Number.isFinite(Number(A.via_diameter))?`${n(A.via_drill)}/${n(A.via_diameter)} mm`:"-"}</td>
        </tr>
      `}):Ce=`
      <tr>
        <td colspan="6" class="selection-empty" style="text-align: center;">No design rules or impedance classes defined.</td>
      </tr>
    `,We.innerHTML=`
    <div class="stackup-header">
      <div class="stackup-header-title">
        <h1>Layer Stackup</h1>
        <p>Board cross-section profile, layer properties & design rules</p>
      </div>
    </div>

    <div class="stackup-workspace-body">
      <div class="stackup-diagram-card">
        <span class="stackup-section-title">Cross-Section Profile</span>
        ${Ie}
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
                ${be}
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
                ${Ce}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      </aside>
    </div>
  `;let Be=(A,P)=>{We.querySelectorAll(".stackup-svg-layer").forEach(U=>{let J=U.dataset.layerId===A;U.classList.toggle("active",J&&P)}),We.querySelectorAll(".stackup-table tbody tr[data-layer-id]").forEach(U=>{let J=U.dataset.layerId===A;U.classList.toggle("active",J&&P)})},ta=A=>{let P=We.querySelector(".stackup-diagram-card"),U=We.querySelector(`.stackup-svg-layer[data-layer-id="${CSS.escape(A)}"]`);if(!P||!U||P.scrollHeight<=P.clientHeight)return;let J=P.getBoundingClientRect(),pe=U.getBoundingClientRect(),ve=P.scrollTop+pe.top-J.top-(P.clientHeight-pe.height)/2,ht=window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;P.scrollTo({top:Math.max(0,ve),behavior:ht?"auto":"smooth"})},Tr=(A,{revealDiagram:P=!1}={})=>{A.forEach(U=>{let J=()=>{let ve=U.dataset.layerId;Be(ve,!0),P&&ta(ve)},pe=()=>Be(null,!1);U.addEventListener("mouseenter",J),U.addEventListener("mouseleave",pe),P&&(U.addEventListener("focus",J),U.addEventListener("blur",pe))})};Tr(We.querySelectorAll(".stackup-svg-layer")),Tr(We.querySelectorAll(".stackup-table tbody tr[data-layer-id]"),{revealDiagram:!0})}function xE(t){let e=t.filter(s=>s.role==="dielectric");if(!(e.length===1&&e[0]?.name==="Board"))return new Map;let a=new Map;return["F.SilkS","F.Paste","F.Mask","F.Cu","Board","B.Cu","B.Mask","B.Paste","B.SilkS"].forEach((s,n)=>a.set(s,n)),a}function ng(){let t=null;return{begin(){return t?.abort(),t=new AbortController,t},owns(e){return e!==null&&e===t&&!e.signal.aborted},cancel(){t?.abort(),t=null}}}async function ig(t,e,{owner:r,bundleUrl:a,loadBundle:s,now:n=()=>performance.now()}){let i=n(),o={},{signal:c}=e,l=()=>r.owns(e)&&t.isConnected;try{t.renderLoading();let f=n(),{bundle:d,topology:p,semanticGeometry:b,assetCache:h}=await s(a,o,c);if(o.bundle_group_total_ms=n()-f,!l())return;t.renderShell();let u=n(),m=await t.mountViewer({topology:p,semanticGeometry:b,readiness:d.readiness,assetCache:h,signal:c});if(!l()){m?.dispose?.();return}t.publishController(m),o.mount_and_first_frame_ms=n()-u,Object.assign(o,m?.performance||{}),o.reload_to_visible_ms=n()-i,t.emitReady({schema:"prism.semantic_viewer_performance.a0",milestone:"board-visible",readiness_stage:d.readiness?.stage||"semantic-ready",readiness_progress:d.readiness?.progress??100,timings:o})}catch(f){if(!l())return;t.renderError(f),t.emitError(f)}}var wE="prism.visualizer_bundle.a0";function vE(){return`
    <style>
      ${il}
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
  `}function ME(t){return String(t).replace(/[&<>"']/g,e=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[e])}async function og(t,e=null,r="fetch",a=void 0){let s=performance.now(),n=await fetch(t,{cache:"no-store",signal:a});if(!n.ok)throw new Error(`Failed to load ${t}: ${n.status}`);let i=await n.json();return e&&(e[`${r}_fetch_parse_ms`]=performance.now()-s,e[`${r}_content_length`]=Number(n.headers.get("content-length")||0)),i}async function cg(t,e,r){let a=new URL(t,document.baseURI).toString(),s=new URL(a).searchParams.get("viewer")||"",n=ds.open(),i=await n.peekJson(a).catch(()=>null),o=!!i;i||(i=await og(a,e,"bundle",r),ki(i)&&n.store(a,new TextEncoder().encode(JSON.stringify(i)))),e&&(e.bundle_from_cache=o);let c=ki(i)&&n.enabled?n:null;if(i.schema===al){let h={analytic:!0,cache_key:i.cache_key||"",readiness:i.readiness,assets:i.assets||{}};return{bundle:i,topology:{},semanticGeometry:Mi(h,a,i,s),assetCache:c}}if(i.schema!==wE)throw new Error(`Unsupported visualizer bundle schema: ${i.schema||"missing"}`);let l=new URL(i.topology||"topology.json",a),f=new URL(i.semantic_geometry||"semantic_geometry.json",a),d=(h,u)=>c?c.fetchJson(h.toString(),{signal:r}):og(h,e,u,r),[p,b]=await Promise.all([d(l,"topology"),d(f,"semantic_geometry")]);return{bundle:i,topology:p,semanticGeometry:Mi(b,a,i,s),assetCache:c}}var pi=class extends HTMLElement{static get observedAttributes(){return["bundle-url","workspace","mode","move-allowed"]}constructor(){super(),this.attachShadow({mode:"open"}),this.reloadOwner=ng(),this.reloadQueued=!1,this.reloadSource=null;let e=jo();this.modes=Object.freeze({board:new mn(e),system:new yn(e)}),this.mounted=null}get activeMode(){return this.mounted??(this.systemMode?this.modes.system:this.modes.board)}detachModes(){this.modes.board.detach(),this.modes.system.detach(),this.mounted=null}connectedCallback(){this.queueReload()}disconnectedCallback(){this.reloadOwner.cancel(),this.detachModes(),this.reloadSource=null}attributeChangedCallback(e,r,a){if(!(!this.isConnected||r===a)){if(e==="workspace"){this.modes.board.setWorkspace(this.workspace);return}if(e==="move-allowed"){this.modes.system.setMoveAllowed(a==="true");return}this.queueReload()}}get workspace(){return this.getAttribute("workspace")==="stackup"?"stackup":"pcb"}get systemMode(){return this.getAttribute("mode")==="system"}queueReload(){let e=this.systemMode?"system":this.getAttribute("bundle-url");!e||e===this.reloadSource||(this.reloadSource=e,!this.reloadQueued&&(this.reloadQueued=!0,queueMicrotask(()=>{this.reloadQueued=!1,this.isConnected&&this.reload()})))}async reload(){let e=this.getAttribute("bundle-url"),r=this.reloadOwner.begin();if(this.detachModes(),this.systemMode){await this.reloadSystem(r);return}if(!e){this.shadowRoot.innerHTML="<style>:host{display:block;height:100%;font:14px system-ui;color:#94a3b8}</style><div>Semantic bundle URL is missing.</div>";return}await ig(this,r,{owner:this.reloadOwner,bundleUrl:e,loadBundle:cg})}async reloadSystem(e){let{signal:r}=e,a=()=>this.reloadOwner.owns(e)&&this.isConnected;try{this.renderShell();let s=await ip({root:this.shadowRoot,loadBundle:(i,o)=>cg(i,null,o),isActive:()=>this.getAttribute("active")==="true",onSelectionChange:i=>{r.aborted||this.emit("selectionchange",{selection:i})},onContextMenu:i=>{r.aborted||this.emit("contextmenu",i)},onViewStateChange:i=>{r.aborted||this.emitViewState(i)},onEmphasis:i=>{r.aborted||this.emit("emphasis",{results:i})},onMove:i=>{r.aborted||this.emit("move",i)},onHarness:i=>{r.aborted||this.emit("harness",i)}});if(!a()){s?.dispose?.();return}this.mounted=this.modes.system,this.mounted.attach(s,{moveAllowed:this.getAttribute("move-allowed")==="true"});let n=this.getViewState();n&&this.emitViewState(n),this.emitReady({schema:"prism.semantic_viewer_performance.a0",milestone:"system-mounted"})}catch(s){if(!a())return;this.renderError(s),this.emitError(s)}}emit(e,r){this.dispatchEvent(new CustomEvent(`prism-semantic-viewer:${e}`,{bubbles:!0,composed:!0,detail:r}))}renderLoading(){this.shadowRoot.innerHTML='<style>:host{display:block;height:100%;background:#020817;color:#e5e7eb;font:14px system-ui}</style><div style="display:grid;place-items:center;height:100%">Loading semantic visualizer...</div>'}renderShell(){this.shadowRoot.innerHTML=vE()}renderError(e){console.error(e),this.shadowRoot.innerHTML=`
      <style>
        :host{display:block;height:100%;background:#020817;color:#e5e7eb;font:14px system-ui}
        .error{height:100%;display:grid;place-items:center;padding:24px}
        pre{max-width:100%;white-space:pre-wrap;color:#fecaca;background:#111827;border:1px solid #374151;padding:16px}
      </style>
      <div class="error"><pre>${ME(e?.stack||e?.message||String(e))}</pre></div>
    `}mountViewer({topology:e,semanticGeometry:r,readiness:a,assetCache:s=null,signal:n}){return Sc({root:this.shadowRoot,topology:e,semanticGeometry:r,readiness:a,workspaceScope:"3d",assetCache:s,isActive:()=>this.getAttribute("active")==="true",onSelectionChange:i=>{n.aborted||this.dispatchEvent(new CustomEvent("prism-semantic-viewer:selectionchange",{bubbles:!0,composed:!0,detail:{selection:i}}))},onContextMenu:i=>{n.aborted||this.dispatchEvent(new CustomEvent("prism-semantic-viewer:contextmenu",{bubbles:!0,composed:!0,detail:i}))},onViewStateChange:i=>{n.aborted||this.emitViewState(i)},onPerformanceEvent:i=>{n.aborted||(console.info("[prism-3d-perf]",i),this.dispatchEvent(new CustomEvent("prism-semantic-viewer:performance",{bubbles:!0,composed:!0,detail:i})))}})}publishController(e){this.mounted=this.modes.board,this.mounted.attach(e,{workspace:this.workspace});let r=this.getViewState();r&&this.emitViewState(r)}emitViewState(e){this.dispatchEvent(new CustomEvent("prism-semantic-viewer:viewstatechange",{bubbles:!0,composed:!0,detail:e}))}emitReady(e){console.info("[prism-3d-perf]",e),this.dispatchEvent(new CustomEvent("prism-semantic-viewer:ready",{bubbles:!0,composed:!0,detail:e}))}emitError(e){this.dispatchEvent(new CustomEvent("prism-semantic-viewer:error",{bubbles:!0,detail:{error:e}}))}};dh(pi.prototype);function lg(){customElements.get("prism-semantic-viewer")||customElements.define("prism-semantic-viewer",pi)}window.__PRISM_SEMANTIC_VIEWER_MANUAL_BOOT__=!0;lg();
