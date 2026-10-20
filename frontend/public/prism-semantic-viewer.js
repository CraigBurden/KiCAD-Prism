function Nr(t,e=()=>""){let a=new Map;for(let r of t){let n=`${e(r)}:${JSON.stringify(r.material)}`;a.has(n)||a.set(n,[]),a.get(n).push(r)}return[...a.values()].map(r=>{let s=r.reduce((h,d)=>h+d.position.length/3,0),n=r.reduce((h,d)=>h+d.indices.length,0),i=new Float32Array(s*3),o=new Float32Array(s*3),c=new Uint32Array(s),l=new Uint32Array(s),f=new Uint32Array(n),u=0,g=0,p=[1/0,1/0,1/0,-1/0,-1/0,-1/0];for(let h of r){let d=h.position.length/3;i.set(h.position,u*3),o.set(h.normal,u*3),c.set(h.netId,u),l.set(h.objectFeatureId,u);for(let m=0;m<h.indices.length;m+=1)f[g+m]=Number(h.indices[m])+u;h.bounds&&(p[0]=Math.min(p[0],h.bounds[0]),p[1]=Math.min(p[1],h.bounds[1]),p[2]=Math.min(p[2],h.bounds[2]),p[3]=Math.max(p[3],h.bounds[3]),p[4]=Math.max(p[4],h.bounds[4]),p[5]=Math.max(p[5],h.bounds[5])),u+=d,g+=h.indices.length}return{position:i,normal:o,netId:c,objectFeatureId:l,indices:f,material:r[0].material,groupKey:e(r[0]),bounds:Number.isFinite(p[0])?p:null}})}function ha(t){return!t||t.length!==6?null:[t[0]/1e3,-t[4]/1e3,t[2]/1e3,t[3]/1e3,-t[1]/1e3,t[5]/1e3]}function La(t){let e=t?.min||[0,0,0],a=t?.max||[.08,.0016,.05];return[e[0],-a[2],e[1],a[0],-e[2],a[1]]}function ba(t){let e=t.filter(a=>Array.isArray(a)&&a.length===6);return e.length?e.reduce((a,r)=>[Math.min(a[0],r[0]),Math.min(a[1],r[1]),Math.min(a[2],r[2]),Math.max(a[3],r[3]),Math.max(a[4],r[4]),Math.max(a[5],r[5])],[...e[0]]):null}function zo(t){let e=t.replace("#","");return[0,2,4].map(a=>parseInt(e.slice(a,a+2),16)/255)}var ob="#c83434",cb="#4d7fc4",Rr=["#7fc87f","#ce7d2c","#4fcbcb","#db628b","#a7a5c6","#28ccd9","#e8b2a7","#f2eda1","#8dcb81","#ed7c33","#5bc3eb","#f76f8e","#a7a5c6","#28ccd9","#e8b2a7","#f2eda1","#ed7c33","#5bc3eb","#f76f8e","#a7a5c6","#28ccd9","#e8b2a7","#f2eda1","#ed7c33","#5bc3eb","#f76f8e","#a7a5c6","#28ccd9","#e8b2a7","#f2eda1"];function Tn(t,e=0){if(t==="F.Cu")return ob;if(t==="B.Cu")return cb;let a=/^In(\d+)\.Cu$/.exec(String(t||""))?.[1],r=a?Number(a)-1:e;return Rr[(r%Rr.length+Rr.length)%Rr.length]}function Go(t,e){if(typeof t?.color=="string"&&/^#[0-9a-fA-F]{6}$/.test(t.color))return[...zo(t.color),1];let a=String(t?.name||""),r=Math.max(0,e.findIndex(s=>s.name===a)-1);return[...zo(Tn(a,r)),1]}var ja=Object.freeze({gold:[.83,.69,.37,1],silver:[.74,.75,.77,1],copper:[.76,.47,.28,1]});function Ko(t){let e=String(t||"").toLowerCase();return/hasl|hal\b|tin|silver|lead/.test(e)?ja.silver:/osp|bare|none/.test(e)?ja.copper:ja.gold}function Vo(t,e){let a=String(t?.name||"");return!!a&&(a===e[0]?.name||a===e[e.length-1]?.name)}var Ho="prism.viewer_3d.analytic.a0",_n={"F.SilkS":"#f2f2f2","B.SilkS":"#dddddd","F.Mask":"#316d4f","B.Mask":"#275840","F.Paste":"#c5cbd3","B.Paste":"#aeb7c2"},lb="#2f6b4f",db={green:"#316d4f",red:"#a5272a",blue:"#1f4f8a",yellow:"#c9a227",white:"#e6e6e6",black:"#1a1a1a",purple:"#5b2d7a"},ub={conductor:"copper",dielectric:"dielectric",solder_mask:"soldermask",silkscreen:"silkscreen",paste:"paste"},fb={copper:"copper",dielectric:"FR4",soldermask:"soldermask",silkscreen:"ink",paste:"paste"};function hb(t,e){let a=String(t?.maskColors?.[e]||"").trim();return/^#[0-9a-f]{6}$/i.test(a)?a:db[a.toLowerCase()]||(e==="back"?_n["B.Mask"]:_n["F.Mask"])}function bb(t,e=null){let a=[...t?.stack?.slices||[]].sort((c,l)=>c.order-l.order),r=c=>Number(c.thickness_nm||0)/1e6,n=a.reduce((c,l)=>c+r(l),0)/2,i=0,o=[];for(let c of a){let l=ub[c.role],f=r(c),u=n-f/2;if(n-=f,!l)continue;let g=String(c.kicad_layer||c.key),p=_n[g];l==="copper"&&(p=Tn(g,g==="F.Cu"||g==="B.Cu"?0:i++)),l==="soldermask"&&(p=hb(e,c.side==="back"?"back":"front")),l==="dielectric"&&(p=c.color||lb),o.push({id:o.length+1,uid:`layer_${c.key}`,name:g,role:l,z_mm:+u.toFixed(6)||0,thickness_mm:+f.toFixed(6),material:c.material_name||fb[l],color:p||"#8a8a8a",visibility_group:l==="dielectric"?"board":l,stack_index:c.order,side:c.side||null,sliceKey:c.key})}return o}function pb(t){let e=t?.chunks||[],a=e.filter(s=>String(s.slice_key||"").startsWith("dielectric")),r=null;for(let s of a.length?a:e){let n=s.bounds;if(!n)continue;let i=[n.min_x_nm,n.min_y_nm,n.max_x_nm,n.max_y_nm].map(o=>Number(o)/1e6);r=r?[Math.min(r[0],i[0]),Math.min(r[1],i[1]),Math.max(r[2],i[2]),Math.max(r[3],i[3])]:i}return r}var gb=1,Wo=1073741824;function mb(t,e){let a=t?.body_bounds,r=t?.affine;if(!a||!r)return null;let[s,n,i,o]=[1/0,1/0,-1/0,-1/0];for(let[g,p]of[[a.min_x_nm,a.min_y_nm],[a.max_x_nm,a.min_y_nm],[a.min_x_nm,a.max_y_nm],[a.max_x_nm,a.max_y_nm]]){let h=(r.m11*g+r.m12*p+Number(r.tx_nm))/1e6,d=(r.m21*g+r.m22*p+Number(r.ty_nm))/1e6;[s,n,i,o]=[Math.min(s,h),Math.min(n,d),Math.max(i,h),Math.max(o,d)]}let c=t.body_height_nm?Number(t.body_height_nm)/1e6:1,l=e/2,[f,u]=t.side==="back"?[-l-c,-l]:[l,l+c];return[s,n,f,i,o,u]}function Xo(t,e=null){let a=bb(t,e),r=[{id:0,uid:"",name:"",netClass:""}];for(let c of t?.nets||[])c?.name&&r.push({id:r.length,uid:String(c.key||c.name),name:String(c.name),netClass:String(c.net_class||""),aliases:[]});let s=Number(t?.stack?.board_thickness_nm||0)/1e6,n=(t?.components||[]).map((c,l)=>({id:l+1,featureId:gb+l,uid:String(c.source_uid||""),designator:String(c.refdes||""),footprint:String(c.footprint||""),side:c.side||null,nodeIndex:null,meshNames:[],boundsMm:mb(c,s)})),i=pb(t);return{schema:"prism.analytic_scene.a0",bbox:i?{min:[i[0]/1e3,-s/2e3,i[1]/1e3],max:[i[2]/1e3,s/2e3,i[3]/1e3]}:null,componentsZOffsetMm:-s/2,layers:a,copperLayerIds:a.filter(c=>c.role==="copper").map(c=>c.id),nets:r,objectFeatures:[],components:n,tiles:[],barrels:[]}}var An={green:[.06,.16,.11,.83],red:[.52,.05,.05,.83],blue:[.05,.12,.42,.83],black:[.05,.05,.05,.85],white:[.9,.9,.9,.83],purple:[.3,.1,.4,.83],yellow:[.7,.62,.1,.83]},yb=[.62,.63,.65,1],xb=[.9,.9,.88,1],wb=t=>{let e=t/255;return e<=.04045?e/12.92:((e+.055)/1.055)**2.4};function qo(t){let e=String(t||"").trim().toLowerCase(),a=/^#([0-9a-f]{6})([0-9a-f]{2})?$/.exec(e);if(a){let r=[0,2,4].map(n=>parseInt(a[1].slice(n,n+2),16)),s=a[2]?parseInt(a[2],16)/255:An.green[3];return[...r.map(n=>+wb(n).toFixed(4)),+s.toFixed(4)]}return[...An[e]||An.green]}function $o(t){let e=t?.maskColors?.front||"";return{soldermask:{front:qo(e),back:qo(t?.maskColors?.back||e)},paste:[...yb],silkscreen:[...xb]}}var Yo=`:host,
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
`;var kb=/\/api\/projects\/([^/]+)\/webgpu-3d\/assets\/([^/]+)\/([^/]+)\/(.+)$/,Eb="prism-bundle-cache-a0";var In="manifest.json",Jo=720*60*60*1e3,Qo=2*1024*1024*1024;function Rn(t){let e;try{e=new URL(t,"http://cache.invalid/")}catch{return null}let a=kb.exec(e.pathname);if(!a)return null;let[,r,s,n,i]=a.map(decodeURIComponent);if(i.split("/").some(c=>!c||c==="."||c===".."))return null;let o=e.searchParams.get("viewer")||"";return`${r}/${s}/${n}/${i}${o?`?viewer=${o}`:""}`}function Cr(t){return`a_${encodeURIComponent(t)}`}function Mb(t,e,{maxAgeMs:a=Jo,maxBytes:r=Qo}={}){let s=new Set,n=[];for(let[o,c]of Object.entries(t))e-Number(c.lastUsed||0)<=a?n.push([o,c]):s.add(o);n.sort((o,c)=>Number(c[1].lastUsed)-Number(o[1].lastUsed));let i=0;for(let[o,c]of n)i+=Number(c.bytes||0),i>r&&s.add(o);return[...s]}var Br=class t{static open(e={}){return t.shared||(t.shared=new t(e)),t.shared}constructor({maxAgeMs:e=Jo,maxBytes:a=Qo}={}){this.maxAgeMs=e,this.maxBytes=a,this.stats={hits:0,misses:0,bypassed:0,cachedBytes:0,networkBytes:0,writeErrors:0},this.ready=this.init(),this.flushTimer=null}async init(){try{let e=globalThis.navigator?.storage;if(!e?.getDirectory)return null;let r=await(await e.getDirectory()).getDirectoryHandle(Eb,{create:!0}),s=await r.getFileHandle(In,{create:!0});if(typeof s.createWritable!="function")return null;let n={};try{let i=await(await s.getFile()).text();n=i?JSON.parse(i).entries||{}:{}}catch{n={}}return this.directory=r,this.entries=n,await this.prune(),globalThis.addEventListener?.("pagehide",()=>void this.flush()),r}catch{return null}}get enabled(){return!!this.directory}async fetchBytes(e,{store:a=!0,signal:r}={}){let s=Rn(e);if(await this.ready,s&&this.directory){let c=await this.read(s);if(c)return this.stats.hits+=1,this.stats.cachedBytes+=c.byteLength,c;this.stats.misses+=1}else this.stats.bypassed+=1;let n=await fetch(e,{cache:"no-store",signal:r});if(!n.ok)throw new Error(`Failed to load ${e}: ${n.status}`);let i=await n.arrayBuffer(),o=Number(n.headers.get("content-length")||0);return this.stats.networkBytes+=i.byteLength,a&&s&&this.directory&&(!o||o===i.byteLength)&&this.write(s,i),i}async fetchJson(e,a={}){let r=await this.fetchBytes(e,a);return JSON.parse(new TextDecoder().decode(r))}async peekJson(e){let a=Rn(e);if(await this.ready,!a||!this.directory)return null;let r=await this.read(a);return r?(this.stats.hits+=1,this.stats.cachedBytes+=r.byteLength,JSON.parse(new TextDecoder().decode(r))):null}async store(e,a){let r=Rn(e);await this.ready,r&&this.directory&&await this.write(r,a)}async read(e){let a=this.entries[e];if(!a)return null;try{let r=await(await this.directory.getFileHandle(Cr(e))).getFile();return r.size!==a.bytes?null:(a.lastUsed=Date.now(),this.scheduleFlush(),await r.arrayBuffer())}catch{return delete this.entries[e],null}}async write(e,a){try{let s=await(await this.directory.getFileHandle(Cr(e),{create:!0})).createWritable();await s.write(a),await s.close(),this.entries[e]={bytes:a.byteLength,lastUsed:Date.now()},this.scheduleFlush()}catch{this.stats.writeErrors+=1}}adopt(e,a){this.directory&&(this.entries[e]={bytes:a,lastUsed:Date.now()},this.scheduleFlush())}async prune(e=Date.now()){if(!this.directory)return[];let a=Mb(this.entries,e,{maxAgeMs:this.maxAgeMs,maxBytes:this.maxBytes});for(let s of a)delete this.entries[s],await this.directory.removeEntry(Cr(s)).catch(()=>{});let r=new Set(Object.keys(this.entries).map(Cr));for await(let s of this.directory.keys())s!==In&&!r.has(s)&&await this.directory.removeEntry(s).catch(()=>{});return a.length&&await this.flush(),a}async clear(){await this.ready,this.directory&&(this.entries={},await this.prune(),await this.flush())}summary(){let e=Object.values(this.entries||{});return{enabled:this.enabled,files:e.length,bytes:e.reduce((a,r)=>a+Number(r.bytes||0),0),...this.stats}}scheduleFlush(){this.flushTimer||(this.flushTimer=setTimeout(()=>{this.flushTimer=null,this.flush()},1e3))}async flush(){if(this.directory)try{let a=await(await this.directory.getFileHandle(In,{create:!0})).createWritable();await a.write(JSON.stringify({schema:"prism.bundle_cache_manifest.a0",entries:this.entries})),await a.close()}catch{this.stats.writeErrors+=1}}};function Sb(t,e){if(!e)return t;let a=new URL(t);return a.searchParams.set("viewer",e),a.toString()}function Zo(t,e,a,r){let s=new URL(a.asset_base||"./",e),n=structuredClone(t||{}),i=o=>!o||typeof o!="string"?o:Sb(new URL(o,s).toString(),r);for(let o of["assets","semantic_gltf","schematic_world","schematic_vector","schematic_scene","bom"]){let c=n[o];if(!(!c||typeof c!="object"))for(let[l,f]of Object.entries(c))c[l]=i(f)}return n}function Nn(t){return(t?.readiness?.stage||"semantic-ready")==="semantic-ready"&&(t?.readiness?.progress??100)>=100}var de=(t,e,a)=>Math.max(e,Math.min(a,t)),Fr=(t,e,a)=>t+(e-t)*a;function Je(t,e){return[t[0]+e[0],t[1]+e[1],t[2]+e[2]]}function Tb(t,e){return[t[0]-e[0],t[1]-e[1],t[2]-e[2]]}function Ke(t,e){return[t[0]*e,t[1]*e,t[2]*e]}function Ab(t){return Math.hypot(t[0],t[1],t[2])}function it(t){let e=Ab(t)||1;return Ke(t,1/e)}function pt(t,e){return[t[1]*e[2]-t[2]*e[1],t[2]*e[0]-t[0]*e[2],t[0]*e[1]-t[1]*e[0]]}function pa(t,e){return t[0]*e[0]+t[1]*e[1]+t[2]*e[2]}function ec(t,e){let a=e/2,r=Math.sin(a),s=it(t);return[s[0]*r,s[1]*r,s[2]*r,Math.cos(a)]}function Or(t,e){return[t[3]*e[0]+t[0]*e[3]+t[1]*e[2]-t[2]*e[1],t[3]*e[1]-t[0]*e[2]+t[1]*e[3]+t[2]*e[0],t[3]*e[2]+t[0]*e[1]-t[1]*e[0]+t[2]*e[3],t[3]*e[3]-t[0]*e[0]-t[1]*e[1]-t[2]*e[2]]}function Cn(t,e){let a=[e[0],e[1],e[2],0],r=[-t[0],-t[1],-t[2],t[3]];return Or(Or(t,a),r).slice(0,3)}function ga(t,e){let a=new Float32Array(16);for(let r=0;r<4;r+=1)for(let s=0;s<4;s+=1)a[r*4+s]=t[s]*e[r*4]+t[4+s]*e[r*4+1]+t[8+s]*e[r*4+2]+t[12+s]*e[r*4+3];return a}function Pr(t,e,a){let r=it(Tb(t,e)),s=it(pt(a,r)),n=pt(r,s);return new Float32Array([s[0],n[0],r[0],0,s[1],n[1],r[1],0,s[2],n[2],r[2],0,-pa(s,t),-pa(n,t),-pa(r,t),1])}function tc(t,e,a,r){let s=1/Math.tan(t/2);return new Float32Array([s/e,0,0,0,0,s,0,0,0,0,a/(r-a),-1,0,0,a*r/(r-a),0])}function jr(t,e,a,r){return new Float32Array([2/t,0,0,0,0,2/e,0,0,0,0,1/(r-a),0,0,0,1,1])}function Bn(t){return[(t[0]+t[3])/2,(t[1]+t[4])/2,(t[2]+t[5])/2]}function Et(t){return Math.max(.001,Math.hypot(t[3]-t[0],t[4]-t[1],t[5]-t[2])/2)}var Da=class{constructor(e){let a=Bn(e),r=Et(e);this.focus=[...a],this.targetFocus=[...a],this.azimuth=-.62,this.targetAzimuth=this.azimuth,this.polar=.72,this.targetPolar=this.polar,this.distance=r*2.8,this.targetDistance=this.distance,this.orthoScale=r*2.15,this.targetOrthoScale=this.orthoScale,this.sceneRadius=r,this.fov=Math.PI/4}update(e){let a=1-Math.exp(-e*14);this.focus=this.focus.map((r,s)=>Fr(r,this.targetFocus[s],a)),this.azimuth=rc(this.azimuth,this.targetAzimuth,a),this.polar=rc(this.polar,this.targetPolar,a),this.distance=Fr(this.distance,this.targetDistance,a),this.orthoScale=Fr(this.orthoScale,this.targetOrthoScale,a),this.settled()&&this.snap()}settled(){let e=Math.max(this.distance,1e-9),a=(r,s,n)=>Math.abs(r-s)<=n;return this.focus.every((r,s)=>a(r,this.targetFocus[s],1e-5*e))&&Math.abs(Math.atan2(Math.sin(this.targetAzimuth-this.azimuth),Math.cos(this.targetAzimuth-this.azimuth)))<=1e-5&&Math.abs(Math.atan2(Math.sin(this.targetPolar-this.polar),Math.cos(this.targetPolar-this.polar)))<=1e-5&&a(this.distance,this.targetDistance,1e-5*e)&&a(this.orthoScale,this.targetOrthoScale,1e-5*Math.max(this.orthoScale,1e-9))}snap(){this.focus=[...this.targetFocus],this.azimuth=this.targetAzimuth,this.polar=this.targetPolar,this.distance=this.targetDistance,this.orthoScale=this.targetOrthoScale}basis(){let e=Math.sin(this.polar),a=Math.cos(this.polar),r=it([e*Math.sin(this.azimuth),-e*Math.cos(this.azimuth),a]),s=it([Math.cos(this.azimuth),Math.sin(this.azimuth),0]),n=it(pt(r,s));return{right:s,up:n,back:r}}matrix(e,a,r=!1,s=1){let n=Math.max(.01,e/Math.max(1,a)),{up:i,back:o}=this.basis(),c=Je(this.focus,Ke(o,this.distance)),l=Pr(c,this.focus,i),f=r?jr(this.orthoScale*s*n,this.orthoScale*s,-this.sceneRadius*40,this.sceneRadius*40):tc(this.fov,n,Math.max(this.sceneRadius*5e-4,this.distance-this.sceneRadius*3.5),this.distance+this.sceneRadius*4.5);return ga(f,l)}targetMatrix(e,a,r=!1,s=0){let n=(l,f)=>f+(f-l)*s,i=[this.focus,this.azimuth,this.polar,this.distance,this.orthoScale];this.focus=this.focus.map((l,f)=>n(l,this.targetFocus[f]));let o=(l,f)=>f+Math.atan2(Math.sin(f-l),Math.cos(f-l))*s;this.azimuth=o(this.azimuth,this.targetAzimuth),this.polar=o(this.polar,this.targetPolar),this.distance=Math.max(this.sceneRadius*.001,n(this.distance,this.targetDistance)),this.orthoScale=Math.max(this.sceneRadius*.001,n(this.orthoScale,this.targetOrthoScale));let c=this.matrix(e,a,r);return[this.focus,this.azimuth,this.polar,this.distance,this.orthoScale]=i,c}moving(){let e=(a,r)=>Math.abs(a-r)<=Math.max(1e-9,Math.abs(r)*1e-4);return!(this.focus.every((a,r)=>e(a,this.targetFocus[r]))&&e(this.azimuth,this.targetAzimuth)&&e(this.polar,this.targetPolar)&&e(this.distance,this.targetDistance)&&e(this.orthoScale,this.targetOrthoScale))}orbit(e,a){let r=Math.sin(this.targetPolar)<0?-1:1;this.targetAzimuth-=r*e*.006,this.targetPolar=ac(this.targetPolar-a*.006)}isBelow(){return Math.cos(this.targetPolar)<0}pan(e,a,r,s=!1){let{right:n,up:i}=this.basis(),o=s?this.targetOrthoScale/Math.max(1,r):2*this.targetDistance*Math.tan(this.fov/2)/Math.max(1,r),c=Je(Ke(n,-e*o),Ke(i,a*o));this.targetFocus=Je(this.targetFocus,c)}dolly(e,a=!1){let r=Math.exp(e*.0032);a?this.targetOrthoScale=de(this.targetOrthoScale*r,this.sceneRadius*.008,this.sceneRadius*24):this.targetDistance=de(this.targetDistance*r,this.sceneRadius*.01,this.sceneRadius*48)}frame(e){if(!e)return;let a=Et(e);this.targetFocus=Bn(e),this.targetDistance=Math.max(a*2.8,this.sceneRadius*.02),this.targetOrthoScale=Math.max(a*2.15,this.sceneRadius*.02)}setFocus(e){this.targetFocus=[...e]}setAxis(e,a=!1){e==="z"?(this.targetAzimuth=0,this.targetPolar=a?Math.PI-.015:.015):e==="x"?(this.targetAzimuth=a?-Math.PI/2:Math.PI/2,this.targetPolar=Math.PI/2):(this.targetAzimuth=a?0:Math.PI,this.targetPolar=Math.PI/2)}rotateZ(e=1){this.targetAzimuth+=e*Math.PI/2}flip(){this.targetPolar=ac(Math.PI-this.targetPolar)}};function ac(t){return Math.atan2(Math.sin(t),Math.cos(t))}function rc(t,e,a){let r=Math.atan2(Math.sin(e-t),Math.cos(e-t));return t+r*a}var Lr=class t{static async create(e,a,r={}){let s=await fetch(a,{cache:"default"});if(!s.ok)throw new Error(`Failed to load BoM ${a}: ${s.status}`);let n=await s.json();if(n.schema!=="prism.bom_a0")throw new Error(`Unsupported BoM schema: ${n.schema||"missing"}`);let i=new t(e,n,r);return i.render(),i}constructor(e,a,r){this.container=e,this.payload=a,this.callbacks=r,this.query="",this.selectedRowId="",this.selectedReference="",this.rowsById=new Map((a.rows||[]).map(s=>[s.id,s])),this.componentIndex=new Map(Object.entries(a.componentIndex||{}))}setSelectionByReference(e,a={}){let r=this.componentIndex.get(e);r&&(this.selectedReference=e,this.selectedRowId=r.rowId,this.renderContent(),a.scroll&&this.container.querySelector(`[data-row-id="${Rb(r.rowId)}"]`)?.scrollIntoView({block:"center",behavior:"smooth"}))}clearSelection(){this.selectedReference="",this.selectedRowId="",this.renderContent()}render(){let e=this.filteredRows();this.container.innerHTML=`
      <section class="bom-workspace">
        <header class="bom-toolbar">
          <div>
            <p class="eyebrow">Prism BoM A0</p>
            <h2>Bill of Materials</h2>
            <span data-bom-count>${e.length} of ${(this.payload.rows||[]).length} grouped rows \xB7 ${(this.payload.components||[]).length} components</span>
          </div>
          <label class="bom-search">
            <span>Search</span>
            <input id="bom-search" type="search" value="${We(this.query)}" placeholder="Reference, value, footprint, manufacturer..." />
          </label>
        </header>
        <div class="bom-content" data-bom-content>
          ${this.contentHtml(e,this.payload.displayColumns||[])}
        </div>
      </section>
    `,this.bind()}renderContent(){let e=this.container.querySelector("[data-bom-content]");if(!e){this.render();return}let a=this.filteredRows();e.innerHTML=this.contentHtml(a,this.payload.displayColumns||[]);let r=this.container.querySelector("[data-bom-count]");r&&(r.textContent=`${a.length} of ${(this.payload.rows||[]).length} grouped rows \xB7 ${(this.payload.components||[]).length} components`),this.bindContent(e)}contentHtml(e,a){let r=this.rowsById.get(this.selectedRowId);return`
      <div class="bom-table-wrap">
        <table class="bom-table">
          <thead>
            <tr>${a.map(s=>`<th>${We(s)}</th>`).join("")}</tr>
          </thead>
          <tbody>
            ${e.map(s=>this.rowHtml(s,a)).join("")}
          </tbody>
        </table>
      </div>
      ${r?`<aside class="bom-detail">${this.detailHtml(r)}</aside>`:""}
    `}filteredRows(){let e=this.query.trim().toLowerCase(),a=this.payload.rows||[];return e?a.filter(r=>JSON.stringify(r).toLowerCase().includes(e)):a}rowHtml(e,a){return`
      <tr class="${e.id===this.selectedRowId?"selected":""}" data-row-id="${We(e.id)}">
        ${a.map(s=>{let n=e.fields?.[s]||"";return s==="Reference"?`<td class="bom-reference-cell">${(e.references||[]).map(i=>`
              <button class="bom-ref-chip ${i===this.selectedReference?"active":""}" data-reference="${We(i)}">${We(i)}</button>
            `).join("")}</td>`:!n&&Ib(s)?'<td><span class="bom-missing">Missing</span></td>':`<td title="${We(n)}">${We(n)}</td>`}).join("")}
      </tr>
    `}detailHtml(e){let a=_b(e,this.payload.displayColumns||[],this.payload.extraColumns||[]);return`
      <div class="bom-detail-head">
        <p class="eyebrow">Line item</p>
        <h3>${We((e.references||[]).join(", "))}</h3>
        <span>${e.qty} component${e.qty===1?"":"s"}${e.dnp?" \xB7 DNP":""}</span>
      </div>
      <div class="bom-ref-list">
        ${(e.references||[]).map(r=>`
          <button class="bom-ref-chip detail ${r===this.selectedReference?"active":""}" data-reference="${We(r)}">${We(r)}</button>
        `).join("")}
      </div>
      <dl class="bom-field-list">
        ${a.map(([r,s])=>`
          <div>
            <dt>${We(r)}</dt>
            <dd>${We(s)}</dd>
          </div>
        `).join("")}
      </dl>
    `}bind(){let e=this.container.querySelector("#bom-search");e?.addEventListener("input",()=>{this.query=e.value,this.renderContent()}),this.bindContent(this.container)}bindContent(e){e.querySelectorAll("[data-row-id]").forEach(a=>{a.addEventListener("click",r=>{r.target.closest("[data-reference]")||(this.selectedRowId=a.dataset.rowId,this.selectedReference="",this.renderContent())})}),e.querySelectorAll("[data-reference]").forEach(a=>{a.addEventListener("click",r=>{r.stopPropagation();let s=a.dataset.reference;this.setSelectionByReference(s),this.callbacks.onSelectReference?.(s)})})}};function _b(t,e,a){let r=[],s=new Set(["Reference","Qty"].map(On));for(let i of e){if(i==="Reference"||i==="Qty")continue;let o=t.fields?.[i]||"";o&&(r.push([i,o]),s.add(On(i)))}let n=t.canonicalFields||{};for(let i of a){let o=n[i]||"";if(!o)continue;let c=On(i);s.has(c)||(s.add(c),r.push([i,o]))}return r}function On(t){return String(t||"").toLowerCase().replace(/[\s_\-()[\]/]+/g,"")}function Ib(t){return["Manufacturer Part Number","Vendor Part Number","Datasheet","Footprint","Value"].includes(t)}function We(t){return String(t??"").replace(/[&<>"']/g,e=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[e])}function Rb(t){return String(t).replace(/["\\]/g,"\\$&")}function sc(t,e=new Map){let a=new Map;for(let s of t||[]){let n=String(s?.designator||"");if(!n)continue;let i=a.get(n)||{reference:n,featureIds:new Set,modelCount:0},o=Number(s?.featureId)||0;o>0&&i.featureIds.add(o),a.set(n,i)}for(let[s,n]of e||[]){let i=a.get(String(s));i&&(i.modelCount=Math.max(i.modelCount,Number(n)||0))}let r=new Map;for(let[s,n]of a)r.set(s,{reference:s,featureIds:[...n.featureIds].sort((i,o)=>i-o),ambiguous:n.featureIds.size>1||n.modelCount>1});return r}function nc(t,e){let a=[...new Set((Array.isArray(t)?t:[]).map(c=>String(c||"")).filter(Boolean))],r=[],s=[],n=[],i=new Set,o=new Set;for(let c of a){let l=e.get(c);if(!l){n.push(c);continue}if(l.ambiguous){s.push(c);continue}r.push(c),o.add(c);for(let f of l.featureIds)i.add(f)}return{requested:a,applied:r,ambiguous:s,unknown:n,hiddenFeatureIds:i,hiddenReferences:o}}function Dr(t,e){return!!t&&e.has(String(t))}var Nb={"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"};function V(t){return String(t??"").replace(/[&<>"']/g,e=>Nb[e])}var Ua=`
fn netEmphasized(id: u32) -> bool {
  return id != 0u && id < arrayLength(&netMask) && netMask[id] != 0u;
}
`;function Ur(t){let e=new Set;if(t==null)return e;for(let a of t){let r=Number(a);!Number.isInteger(r)||r<=0||r>4294967295||e.add(r)}return e}function ic(t,e=0){let a=0;for(let s of Ur(t))a=Math.max(a,s);let r=64;for(;r<a+1;)r*=2;return Math.max(r,Math.floor(e)||0)}function oc(t,e){let a=Math.max(64,Math.floor(e)||0),r=new Uint32Array(a);r.fill(0);for(let s of Ur(t))s<a&&(r[s]=1);return r}function Zt(t,e){return!Array.isArray(t)||!e?null:t.find(a=>a.name===e||Array.isArray(a.aliases)&&a.aliases.includes(e))||null}function cc(t,e){let a=new Set;if(!Array.isArray(t)||!Array.isArray(e))return a;for(let r of e){if(!r)continue;let s=r.netUid&&t.find(i=>i.uid===r.netUid)||r.netName&&Zt(t,r.netName),n=Number(s?.id);Number.isInteger(n)&&n>0&&a.add(n)}return a}var Fn=Object.freeze([[.08,1,.2],[1,.72,.1],[.2,.75,1],[1,.3,.75],[.65,.45,1],[1,.45,.2],[.3,1,.85],[.95,.95,.3]]),lc=`
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
`;function dc(t){let e=null;return Array.isArray(t)&&t.length>=3&&t.slice(0,3).every(a=>Number.isFinite(Number(a)))?e=t.slice(0,3).map(a=>Math.round(Math.min(1,Math.max(0,Number(a)))*255)):typeof t=="string"&&/^#[0-9a-f]{6}$/i.test(t)&&(e=[1,3,5].map(a=>parseInt(t.slice(a,a+2),16))),e?(1<<24|e[0]<<16|e[1]<<8|e[2])>>>0:1}function uc(t){let e=1;for(let r of t)for(let s of r?.keys()||[])e=Math.max(e,s+1);let a=new Uint32Array(Math.max(64,t.length*e));return t.forEach((r,s)=>{for(let[n,i]of r||[])Number.isInteger(n)&&n>0&&(a[s*e+n]=i>>>0)}),{stride:e,data:a}}function Cb(t){return(typeof t.composedPath=="function"?t.composedPath():[])[0]??t.target??null}function fc(t){let e=Cb(t);if(!e||typeof e!="object")return!1;let a=typeof e.tagName=="string"?e.tagName.toUpperCase():"";return a==="INPUT"||a==="TEXTAREA"||a==="SELECT"||e.isContentEditable===!0}function hc(t){return!!(t.metaKey||t.ctrlKey)}var Bb=4;function bc(t,e=Bb){let a=new Map,r=[];for(let n of t){if(n.placements.length<e){for(let o of n.placements)r.push(Ob(n.primitive,o));continue}let i=`${n.placements.map(o=>o.node).join(",")}|${JSON.stringify(n.primitive.material)}`;a.has(i)||a.set(i,[]),a.get(i).push(n)}return{instanced:[...a.values()].map(n=>({primitive:Fb(n.map(i=>i.primitive)),placements:n[0].placements})),baked:Nr(r)}}function Ob(t,e){let{rows:a,featureId:r,bounds:s}=e,n=t.position.length/3,i=new Float32Array(n*3),o=new Float32Array(n*3),c=new Uint32Array(n);for(let l=0;l<n;l+=1){let f=l*3,[u,g,p]=[t.position[f],t.position[f+1],t.position[f+2]],[h,d,m]=[t.normal[f],t.normal[f+1],t.normal[f+2]],b=0;for(let y=0;y<3;y+=1){let x=y*4;i[f+y]=a[x]*u+a[x+1]*g+a[x+2]*p+a[x+3],o[f+y]=a[x]*h+a[x+1]*d+a[x+2]*m,b+=o[f+y]**2}b=Math.sqrt(b)||1;for(let y=0;y<3;y+=1)o[f+y]/=b;c[l]=t.objectFeatureId[l]||r||0}return{position:i,normal:o,netId:t.netId,objectFeatureId:c,indices:t.indices,material:t.material,bounds:[...s]}}function Fb(t){if(t.length===1)return t[0];let e=t.reduce((u,g)=>u+g.position.length/3,0),a=t.reduce((u,g)=>u+g.indices.length,0),r=new Float32Array(e*3),s=new Float32Array(e*3),n=new Uint32Array(e),i=new Uint32Array(e),o=new Uint32Array(a),c=[1/0,1/0,1/0,-1/0,-1/0,-1/0],l=0,f=0;for(let u of t){r.set(u.position,l*3),s.set(u.normal,l*3),n.set(u.netId,l),i.set(u.objectFeatureId,l);for(let g=0;g<u.indices.length;g+=1)o[f+g]=u.indices[g]+l;for(let g=0;g<3;g+=1)c[g]=Math.min(c[g],u.bounds[g]),c[g+3]=Math.max(c[g+3],u.bounds[g+3]);l+=u.position.length/3,f+=u.indices.length}return{position:r,normal:s,netId:n,objectFeatureId:i,indices:o,material:t[0].material,bounds:c}}var pc=class{_listeners={};addEventListener(t,e){let a=this._listeners;return a[t]===void 0&&(a[t]=[]),a[t].indexOf(e)===-1&&a[t].push(e),this}removeEventListener(t,e){let a=this._listeners[t];if(a!==void 0){let r=a.indexOf(e);r!==-1&&a.splice(r,1)}return this}dispatchEvent(t){let e=this._listeners[t.type];if(e!==void 0){let a=e.slice(0);for(let r=0,s=a.length;r<s;r++)a[r].call(this,t)}return this}dispose(){for(let t in this._listeners)delete this._listeners[t]}},St=class{_disposed=!1;_name;_parent;_child;_attributes;constructor(t,e,a,r={}){if(this._name=t,this._parent=e,this._child=a,this._attributes=r,!e.isOnGraph(a))throw new Error("Cannot connect disconnected graphs.")}getName(){return this._name}getParent(){return this._parent}getChild(){return this._child}setChild(t){return this._child=t,this}getAttributes(){return this._attributes}dispose(){this._disposed||(this._parent._destroyRef(this),this._disposed=!0)}isDisposed(){return this._disposed}},Pn=class extends pc{_emptySet=new Set;_edges=new Set;_parentEdges=new Map;_childEdges=new Map;listEdges(){return Array.from(this._edges)}listParentEdges(t){return Array.from(this._childEdges.get(t)||this._emptySet)}listParents(t){let e=new Set;for(let a of this.listParentEdges(t))e.add(a.getParent());return Array.from(e)}listChildEdges(t){return Array.from(this._parentEdges.get(t)||this._emptySet)}listChildren(t){let e=new Set;for(let a of this.listChildEdges(t))e.add(a.getChild());return Array.from(e)}disconnectParents(t,e){for(let a of this.listParentEdges(t))(!e||e(a.getParent()))&&a.dispose();return this}_createEdge(t,e,a,r){let s=new St(t,e,a,r);this._edges.add(s);let n=s.getParent();this._parentEdges.has(n)||this._parentEdges.set(n,new Set),this._parentEdges.get(n).add(s);let i=s.getChild();return this._childEdges.has(i)||this._childEdges.set(i,new Set),this._childEdges.get(i).add(s),s}_destroyEdge(t){return this._edges.delete(t),this._parentEdges.get(t.getParent()).delete(t),this._childEdges.get(t.getChild()).delete(t),this}},_e=class{list=[];constructor(t){if(t)for(let e of t)this.list.push(e)}add(t){this.list.push(t)}remove(t){let e=this.list.indexOf(t);e>=0&&this.list.splice(e,1)}removeChild(t){let e=[];for(let a of this.list)a.getChild()===t&&e.push(a);for(let a of e)this.remove(a);return e}listRefsByChild(t){let e=[];for(let a of this.list)a.getChild()===t&&e.push(a);return e}values(){return this.list}},ce=class{set=new Set;map=new Map;constructor(t){if(t)for(let e of t)this.add(e)}add(t){let e=t.getChild();this.removeChild(e),this.set.add(t),this.map.set(e,t)}remove(t){this.set.delete(t),this.map.delete(t.getChild())}removeChild(t){let e=this.map.get(t)||null;return e&&this.remove(e),e}getRefByChild(t){return this.map.get(t)||null}values(){return Array.from(this.set)}},ve=class{map={};constructor(t){t&&Object.assign(this.map,t)}set(t,e){this.map[t]=e}delete(t){delete this.map[t]}get(t){return this.map[t]||null}keys(){return Object.keys(this.map)}values(){return Object.values(this.map)}},ae=Symbol("attributes"),Mt=Symbol("immutableKeys"),gc=class mc extends pc{_disposed=!1;graph;[ae];[Mt];constructor(e){super(),this.graph=e,this[Mt]=new Set,this[ae]=this._createAttributes()}getDefaults(){return{}}_createAttributes(){let e=this.getDefaults(),a={};for(let r in e){let s=e[r];if(s instanceof mc){let n=this.graph._createEdge(r,this,s);this[Mt].add(r),a[r]=n}else a[r]=s}return a}isOnGraph(e){return this.graph===e.graph}isDisposed(){return this._disposed}dispose(){this._disposed||(this.graph.listChildEdges(this).forEach(e=>e.dispose()),this.graph.disconnectParents(this),this._disposed=!0,this.dispatchEvent({type:"dispose"}))}detach(){return this.graph.disconnectParents(this),this}swap(e,a){for(let r in this[ae]){let s=this[ae][r];if(s instanceof St){let n=s;n.getChild()===e&&this.setRef(r,a,n.getAttributes())}else if(s instanceof _e)for(let n of s.listRefsByChild(e)){let i=n.getAttributes();this.removeRef(r,e),this.addRef(r,a,i)}else if(s instanceof ce){let n=s.getRefByChild(e);if(n){let i=n.getAttributes();this.removeRef(r,e),this.addRef(r,a,i)}}else if(s instanceof ve)for(let n of s.keys()){let i=s.get(n);i.getChild()===e&&this.setRefMap(r,n,a,i.getAttributes())}}return this}get(e){return this[ae][e]}set(e,a){return this[ae][e]=a,this.dispatchEvent({type:"change",attribute:e})}getRef(e){let a=this[ae][e];return a?a.getChild():null}setRef(e,a,r){if(this[Mt].has(e))throw new Error(`Cannot overwrite immutable attribute, "${e}".`);let s=this[ae][e];if(s&&s.dispose(),!a)return this;let n=this.graph._createEdge(e,this,a,r);return this[ae][e]=n,this.dispatchEvent({type:"change",attribute:e})}listRefs(e){return this.assertRefList(e).values().map(a=>a.getChild())}addRef(e,a,r){let s=this.graph._createEdge(e,this,a,r);return this.assertRefList(e).add(s),this.dispatchEvent({type:"change",attribute:e})}removeRef(e,a){let r=this.assertRefList(e);if(r instanceof _e)for(let s of r.listRefsByChild(a))s.dispose();else{let s=r.getRefByChild(a);s&&s.dispose()}return this}assertRefList(e){let a=this[ae][e];if(a instanceof _e||a instanceof ce)return a;throw new Error(`Expected RefList or RefSet for attribute "${e}"`)}listRefMapKeys(e){return this.assertRefMap(e).keys()}listRefMapValues(e){return this.assertRefMap(e).values().map(a=>a.getChild())}getRefMap(e,a){let r=this.assertRefMap(e).get(a);return r?r.getChild():null}setRefMap(e,a,r,s){let n=this.assertRefMap(e),i=n.get(a);if(i&&i.dispose(),!r)return this;s=Object.assign(s||{},{key:a});let o=this.graph._createEdge(e,this,r,{...s,key:a});return n.set(a,o),this.dispatchEvent({type:"change",attribute:e,key:a})}assertRefMap(e){let a=this[ae][e];if(a instanceof ve)return a;throw new Error(`Expected RefMap for attribute "${e}"`)}dispatchEvent(e){return super.dispatchEvent({...e,target:this}),this.graph.dispatchEvent({...e,target:this,type:`node:${e.type}`}),this}_destroyRef(e){let a=e.getName();if(this[ae][a]===e)this[ae][a]=null,this[Mt].has(a)&&e.getChild().dispose();else if(this[ae][a]instanceof _e)this[ae][a].remove(e);else if(this[ae][a]instanceof ce)this[ae][a].remove(e);else if(this[ae][a]instanceof ve){let r=this[ae][a];for(let s of r.keys())r.get(s)===e&&r.delete(s)}else return;this.graph._destroyEdge(e),this.dispatchEvent({type:"change",attribute:a})}};var Mc="v4.4.2",At="@glb.bin",F=(function(t){return t.ACCESSOR="Accessor",t.ANIMATION="Animation",t.ANIMATION_CHANNEL="AnimationChannel",t.ANIMATION_SAMPLER="AnimationSampler",t.BUFFER="Buffer",t.CAMERA="Camera",t.MATERIAL="Material",t.MESH="Mesh",t.PRIMITIVE="Primitive",t.PRIMITIVE_TARGET="PrimitiveTarget",t.NODE="Node",t.ROOT="Root",t.SCENE="Scene",t.SKIN="Skin",t.TEXTURE="Texture",t.TEXTURE_INFO="TextureInfo",t})({});var Pb=(function(t){return t.ARRAY_BUFFER="ARRAY_BUFFER",t.ELEMENT_ARRAY_BUFFER="ELEMENT_ARRAY_BUFFER",t.INVERSE_BIND_MATRICES="INVERSE_BIND_MATRICES",t.OTHER="OTHER",t.SPARSE="SPARSE",t})({}),Qe=(function(t){return t[t.R=4096]="R",t[t.G=256]="G",t[t.B=16]="B",t[t.A=1]="A",t})({});var jb=class extends Float32Array{constructor(){throw super(),new Error("Unsupported typed array instantiation.")}},Xr={5120:Int8Array,5121:Uint8Array,5122:Int16Array,5123:Uint16Array,5125:Uint32Array,5131:typeof Float16Array<"u"?Float16Array:jb,5126:Float32Array,5130:Float64Array},X=class{static createBufferFromDataURI(t){if(typeof Buffer>"u"){let e=atob(t.split(",")[1]),a=new Uint8Array(e.length);for(let r=0;r<e.length;r++)a[r]=e.charCodeAt(r);return a}else{let e=t.split(",")[1],a=t.indexOf("base64")>=0;return Buffer.from(e,a?"base64":"utf8")}}static encodeText(t){return new TextEncoder().encode(t)}static decodeText(t){return new TextDecoder().decode(t)}static concat(t){let e=0;for(let s of t)e+=s.byteLength;let a=new Uint8Array(e),r=0;for(let s of t)a.set(s,r),r+=s.byteLength;return a}static pad(t,e=0){let a=this.padNumber(t.byteLength);if(a===t.byteLength)return t;let r=new Uint8Array(a);if(r.set(t),e!==0)for(let s=t.byteLength;s<a;s++)r[s]=e;return r}static padNumber(t){return Math.ceil(t/4)*4}static equals(t,e){if(t===e)return!0;if(t.byteLength!==e.byteLength)return!1;let a=t.byteLength;for(;a--;)if(t[a]!==e[a])return!1;return!0}static toView(t,e=0,a=1/0){return new Uint8Array(t.buffer,t.byteOffset+e,Math.min(t.byteLength,a))}static assertView(t){if(t&&!ArrayBuffer.isView(t))throw new Error(`Method requires Uint8Array parameter; received "${typeof t}".`);return t}};var Lb=class{match(t){return t.length>=3&&t[0]===255&&t[1]===216&&t[2]===255}getSize(t){let e=new DataView(t.buffer,t.byteOffset+4),a,r;for(;e.byteLength;){if(a=e.getUint16(0,!1),Ub(e,a),r=e.getUint8(a+1),r===192||r===193||r===194)return[e.getUint16(a+7,!1),e.getUint16(a+5,!1)];e=new DataView(t.buffer,e.byteOffset+a+2)}throw new TypeError("Invalid JPG, no size found")}getChannels(t){return 3}},Db=class Sc{static PNG_FRIED_CHUNK_NAME="CgBI";match(e){return e.length>=8&&e[0]===137&&e[1]===80&&e[2]===78&&e[3]===71&&e[4]===13&&e[5]===10&&e[6]===26&&e[7]===10}getSize(e){let a=new DataView(e.buffer,e.byteOffset);return X.decodeText(e.slice(12,16))===Sc.PNG_FRIED_CHUNK_NAME?[a.getUint32(32,!1),a.getUint32(36,!1)]:[a.getUint32(16,!1),a.getUint32(20,!1)]}getChannels(e){return 4}},ot=class{static impls={"image/jpeg":new Lb,"image/png":new Db};static registerFormat(t,e){this.impls[t]=e}static getMimeType(t){for(let e in this.impls)if(this.impls[e].match(t))return e;return null}static getSize(t,e){return this.impls[e]?this.impls[e].getSize(t):null}static getChannels(t,e){return this.impls[e]?this.impls[e].getChannels(t):null}static getVRAMByteLength(t,e){if(!this.impls[e])return null;if(this.impls[e].getVRAMByteLength)return this.impls[e].getVRAMByteLength(t);let a=0,r=4,s=this.getSize(t,e);if(!s)return null;for(;s[0]>1||s[1]>1;)a+=s[0]*s[1]*r,s[0]=Math.max(Math.floor(s[0]/2),1),s[1]=Math.max(Math.floor(s[1]/2),1);return a+=1*r,a}static mimeTypeToExtension(t){return t==="image/jpeg"?"jpg":t.split("/").pop()}static extensionToMimeType(t){return t==="jpg"?"image/jpeg":t?`image/${t}`:""}};function Ub(t,e){if(e>t.byteLength)throw new TypeError("Corrupt JPG, exceeded buffer limits");if(t.getUint8(e)!==255)throw new TypeError("Invalid JPG, marker table corrupted");return t}var ma=class{static basename(t){let e=t.split(/[\\/]/).pop();return e.substring(0,e.lastIndexOf("."))}static extension(t){if(t.startsWith("data:image/")){let e=t.match(/data:(image\/\w+)/)[1];return ot.mimeTypeToExtension(e)}else{if(t.startsWith("data:model/gltf+json"))return"gltf";if(t.startsWith("data:model/gltf-binary"))return"glb";if(t.startsWith("data:application/"))return"bin"}return t.split(/[\\/]/).pop().split(/[.]/).pop()}},Dn=typeof Float32Array<"u"?Float32Array:Array;Math.PI/180;180/Math.PI;function zb(){var t=new Dn(3);return Dn!=Float32Array&&(t[0]=0,t[1]=0,t[2]=0),t}function jn(t){var e=t[0],a=t[1],r=t[2];return Math.sqrt(e*e+a*a+r*r)}function Gb(t,e,a){var r=e[0],s=e[1],n=e[2],i=a[3]*r+a[7]*s+a[11]*n+a[15];return i=i||1,t[0]=(a[0]*r+a[4]*s+a[8]*n+a[12])/i,t[1]=(a[1]*r+a[5]*s+a[9]*n+a[13])/i,t[2]=(a[2]*r+a[6]*s+a[10]*n+a[14])/i,t}(function(){var t=zb();return function(e,a,r,s,n,i){var o,c;for(a||(a=3),r||(r=0),s?c=Math.min(s*a+r,e.length):c=e.length,o=r;o<c;o+=a)t[0]=e[o],t[1]=e[o+1],t[2]=e[o+2],n(t,t,i),e[o]=t[0],e[o+1]=t[1],e[o+2]=t[2];return e}})();function Tc(t){let e=Ac(),a=t.propertyType==="Node"?[t]:t.listChildren();for(let r of a)r.traverse(s=>{let n=s.getMesh();if(!n)return;let i=Kb(n,s.getWorldMatrix());i.min.every(isFinite)&&i.max.every(isFinite)&&(Un(i.min,e),Un(i.max,e))});return e}function Kb(t,e){let a=Ac();for(let r of t.listPrimitives()){let s=r.getAttribute("POSITION"),n=r.getIndices();if(!s)continue;let i=[0,0,0],o=[0,0,0];for(let c=0,l=n?n.getCount():s.getCount();c<l;c++){let f=n?n.getScalar(c):c;i=s.getElement(f,i),o=Gb(o,i,e),Un(o,a)}}return a}function Un(t,e){for(let a=0;a<3;a++)e.min[a]=Math.min(t[a],e.min[a]),e.max[a]=Math.max(t[a],e.max[a])}function Ac(){return{min:[1/0,1/0,1/0],max:[-1/0,-1/0,-1/0]}}var yc="https://null.example",Ln=class{static DEFAULT_INIT={};static PROTOCOL_REGEXP=/^[a-zA-Z]+:\/\//;static dirname(t){let e=t.lastIndexOf("/");return e===-1?"./":t.substring(0,e+1)}static basename(t){return ma.basename(new URL(t,yc).pathname)}static extension(t){return ma.extension(new URL(t,yc).pathname)}static resolve(t,e){if(!this.isRelativePath(e))return e;let a=t.split("/"),r=e.split("/");a.pop();for(let s=0;s<r.length;s++)r[s]!=="."&&(r[s]===".."?a.pop():a.push(r[s]));return a.join("/")}static isAbsoluteURL(t){return this.PROTOCOL_REGEXP.test(t)}static isRelativePath(t){return!/^(?:[a-zA-Z]+:)?\//.test(t)}};function xc(t){return Object.prototype.toString.call(t)==="[object Object]"}function ea(t){if(xc(t)===!1)return!1;let e=t.constructor;if(e===void 0)return!0;let a=e.prototype;return!(xc(a)===!1||Object.hasOwn(a,"isPrototypeOf")===!1)}var Vb=(function(t){return t[t.SILENT=4]="SILENT",t[t.ERROR=3]="ERROR",t[t.WARN=2]="WARN",t[t.INFO=1]="INFO",t[t.DEBUG=0]="DEBUG",t})({}),$r=class _c{verbosity;static Verbosity=Vb;static DEFAULT_INSTANCE=new _c(1);constructor(e){this.verbosity=e}debug(e){this.verbosity<=0&&console.debug(e)}info(e){this.verbosity<=1&&console.info(e)}warn(e){this.verbosity<=2&&console.warn(e)}error(e){this.verbosity<=3&&console.error(e)}};function qb(t){var e=t[0],a=t[1],r=t[2],s=t[3],n=t[4],i=t[5],o=t[6],c=t[7],l=t[8],f=t[9],u=t[10],g=t[11],p=t[12],h=t[13],d=t[14],m=t[15],b=e*i-a*n,y=e*o-r*n,x=a*o-r*i,v=l*h-f*p,M=l*d-u*p,S=f*d-u*h,A=e*S-a*M+r*v,_=n*S-i*M+o*v,N=l*x-f*y+u*b,I=p*x-h*y+d*b;return c*A-s*_+m*N-g*I}function Hb(t,e,a){var r=e[0],s=e[1],n=e[2],i=e[3],o=e[4],c=e[5],l=e[6],f=e[7],u=e[8],g=e[9],p=e[10],h=e[11],d=e[12],m=e[13],b=e[14],y=e[15],x=a[0],v=a[1],M=a[2],S=a[3];return t[0]=x*r+v*o+M*u+S*d,t[1]=x*s+v*c+M*g+S*m,t[2]=x*n+v*l+M*p+S*b,t[3]=x*i+v*f+M*h+S*y,x=a[4],v=a[5],M=a[6],S=a[7],t[4]=x*r+v*o+M*u+S*d,t[5]=x*s+v*c+M*g+S*m,t[6]=x*n+v*l+M*p+S*b,t[7]=x*i+v*f+M*h+S*y,x=a[8],v=a[9],M=a[10],S=a[11],t[8]=x*r+v*o+M*u+S*d,t[9]=x*s+v*c+M*g+S*m,t[10]=x*n+v*l+M*p+S*b,t[11]=x*i+v*f+M*h+S*y,x=a[12],v=a[13],M=a[14],S=a[15],t[12]=x*r+v*o+M*u+S*d,t[13]=x*s+v*c+M*g+S*m,t[14]=x*n+v*l+M*p+S*b,t[15]=x*i+v*f+M*h+S*y,t}function Wb(t,e){var a=e[0],r=e[1],s=e[2],n=e[4],i=e[5],o=e[6],c=e[8],l=e[9],f=e[10];return t[0]=Math.sqrt(a*a+r*r+s*s),t[1]=Math.sqrt(n*n+i*i+o*o),t[2]=Math.sqrt(c*c+l*l+f*f),t}function Xb(t,e){var a=new Dn(3);Wb(a,e);var r=1/a[0],s=1/a[1],n=1/a[2],i=e[0]*r,o=e[1]*s,c=e[2]*n,l=e[4]*r,f=e[5]*s,u=e[6]*n,g=e[8]*r,p=e[9]*s,h=e[10]*n,d=i+f+h,m=0;return d>0?(m=Math.sqrt(d+1)*2,t[3]=.25*m,t[0]=(u-p)/m,t[1]=(g-c)/m,t[2]=(o-l)/m):i>f&&i>h?(m=Math.sqrt(1+i-f-h)*2,t[3]=(u-p)/m,t[0]=.25*m,t[1]=(o+l)/m,t[2]=(g+c)/m):f>h?(m=Math.sqrt(1+f-i-h)*2,t[3]=(g-c)/m,t[0]=(o+l)/m,t[1]=.25*m,t[2]=(u+p)/m):(m=Math.sqrt(1+h-i-f)*2,t[3]=(o-l)/m,t[0]=(g+c)/m,t[1]=(u+p)/m,t[2]=.25*m),t}var fe=class za{static identity(e){return e}static eq(e,a,r=1e-5){if(e.length!==a.length)return!1;for(let s=0;s<e.length;s++)if(Math.abs(e[s]-a[s])>r)return!1;return!0}static clamp(e,a,r){return e<a?a:e>r?r:e}static decodeNormalizedInt(e,a){switch(a){case 5126:return e;case 5123:return e/65535;case 5121:return e/255;case 5122:return Math.max(e/32767,-1);case 5120:return Math.max(e/127,-1);default:throw new Error("Invalid component type.")}}static encodeNormalizedInt(e,a){switch(a){case 5126:return e;case 5123:return Math.round(za.clamp(e,0,1)*65535);case 5121:return Math.round(za.clamp(e,0,1)*255);case 5122:return Math.round(za.clamp(e,-1,1)*32767);case 5120:return Math.round(za.clamp(e,-1,1)*127);default:throw new Error("Invalid component type.")}}static decompose(e,a,r,s){let n=jn([e[0],e[1],e[2]]),i=jn([e[4],e[5],e[6]]),o=jn([e[8],e[9],e[10]]);qb(e)<0&&(n=-n),a[0]=e[12],a[1]=e[13],a[2]=e[14];let c=e.slice(),l=1/n,f=1/i,u=1/o;c[0]*=l,c[1]*=l,c[2]*=l,c[4]*=f,c[5]*=f,c[6]*=f,c[8]*=u,c[9]*=u,c[10]*=u,Xb(r,c),s[0]=n,s[1]=i,s[2]=o}static compose(e,a,r,s){let n=s,i=a[0],o=a[1],c=a[2],l=a[3],f=i+i,u=o+o,g=c+c,p=i*f,h=i*u,d=i*g,m=o*u,b=o*g,y=c*g,x=l*f,v=l*u,M=l*g,S=r[0],A=r[1],_=r[2];return n[0]=(1-(m+y))*S,n[1]=(h+M)*S,n[2]=(d-v)*S,n[3]=0,n[4]=(h-M)*A,n[5]=(1-(p+y))*A,n[6]=(b+x)*A,n[7]=0,n[8]=(d+v)*_,n[9]=(b-x)*_,n[10]=(1-(p+m))*_,n[11]=0,n[12]=e[0],n[13]=e[1],n[14]=e[2],n[15]=1,n}};function $b(t,e){if(!!t!=!!e)return!1;let a=t.getChild(),r=e.getChild();return a===r||a.equals(r)}function Yb(t,e){if(!!t!=!!e)return!1;let a=t.values(),r=e.values();if(a.length!==r.length)return!1;for(let s=0;s<a.length;s++){let n=a[s],i=r[s];if(n.getChild()!==i.getChild()&&!n.getChild().equals(i.getChild()))return!1}return!0}function Jb(t,e){if(!!t!=!!e)return!1;let a=t.keys(),r=e.keys();if(a.length!==r.length)return!1;for(let s of a){let n=t.get(s),i=e.get(s);if(!!n!=!!i)return!1;let o=n.getChild(),c=i.getChild();if(o!==c&&!o.equals(c))return!1}return!0}function Ic(t,e){if(t===e)return!0;if(!!t!=!!e||!t||!e||t.length!==e.length)return!1;for(let a=0;a<t.length;a++)if(t[a]!==e[a])return!1;return!0}function Rc(t,e){if(t===e)return!0;if(!!t!=!!e)return!1;if(!ea(t)||!ea(e))return t===e;let a=t,r=e,s=0,n=0,i;for(i in a)s++;for(i in r)n++;if(s!==n)return!1;for(i in a){let o=a[i],c=r[i];if(Hr(o)&&Hr(c)){if(!Ic(o,c))return!1}else if(ea(o)&&ea(c)){if(!Rc(o,c))return!1}else if(o!==c)return!1}return!0}function Hr(t){return Array.isArray(t)||ArrayBuffer.isView(t)}var Qb="23456789abdegjkmnpqrvwxyzABDEGJKMNPQRVWXYZ",Zb=999,ep=6,wc=new Set,tp=function(){let t="";for(let e=0;e<ep;e++)t+=Qb.charAt(Math.floor(Math.random()*42));return t},ap=function(){for(let t=0;t<Zb;t++){let e=tp();if(!wc.has(e))return wc.add(e),e}return""},_t=t=>t,rp=new Set,Kn=class extends gc{constructor(t,e=""){super(t),this[ae].name=e,this.init(),this.dispatchEvent({type:"create"})}getGraph(){return this.graph}getDefaults(){return Object.assign(super.getDefaults(),{name:"",extras:{}})}set(t,e){return Array.isArray(e)&&(e=e.slice()),super.set(t,e)}getName(){return this.get("name")}setName(t){return this.set("name",t)}getExtras(){return this.get("extras")}setExtras(t){return this.set("extras",t)}clone(){let t=this.constructor;return new t(this.graph).copy(this,_t)}copy(t,e=_t){for(let a in this[ae]){let r=this[ae][a];if(r instanceof St)this[Mt].has(a)||r.dispose();else if(r instanceof _e||r instanceof ce)for(let s of r.values())s.dispose();else if(r instanceof ve)for(let s of r.values())s.dispose()}for(let a in t[ae]){let r=this[ae][a],s=t[ae][a];if(s instanceof St)this[Mt].has(a)?r.getChild().copy(e(s.getChild()),e):this.setRef(a,e(s.getChild()),s.getAttributes());else if(s instanceof ce||s instanceof _e)for(let n of s.values())this.addRef(a,e(n.getChild()),n.getAttributes());else if(s instanceof ve)for(let n of s.keys()){let i=s.get(n);this.setRefMap(a,n,e(i.getChild()),i.getAttributes())}else ea(s)?this[ae][a]=JSON.parse(JSON.stringify(s)):Array.isArray(s)||s instanceof ArrayBuffer||ArrayBuffer.isView(s)?this[ae][a]=s.slice():this[ae][a]=s}return this}equals(t,e=rp){if(this===t)return!0;if(this.propertyType!==t.propertyType)return!1;for(let a in this[ae]){if(e.has(a))continue;let r=this[ae][a],s=t[ae][a];if(r instanceof St||s instanceof St){if(!$b(r,s))return!1}else if(r instanceof ce||s instanceof ce||r instanceof _e||s instanceof _e){if(!Yb(r,s))return!1}else if(r instanceof ve||s instanceof ve){if(!Jb(r,s))return!1}else if(ea(r)||ea(s)){if(!Rc(r,s))return!1}else if(Hr(r)||Hr(s)){if(!Ic(r,s))return!1}else if(r!==s)return!1}return!0}detach(){return this.graph.disconnectParents(this,t=>t.propertyType!=="Root"),this}listParents(){return this.graph.listParents(this)}},Be=class extends Kn{getDefaults(){return Object.assign(super.getDefaults(),{extensions:new ve})}getExtension(t){return this.getRefMap("extensions",t)}setExtension(t,e){return e&&e._validateParent(this),this.setRefMap("extensions",t,e)}listExtensions(){return this.listRefMapValues("extensions")}},K=class ke extends Be{static Type={SCALAR:"SCALAR",VEC2:"VEC2",VEC3:"VEC3",VEC4:"VEC4",MAT2:"MAT2",MAT3:"MAT3",MAT4:"MAT4"};static ComponentType={BYTE:5120,UNSIGNED_BYTE:5121,SHORT:5122,UNSIGNED_SHORT:5123,UNSIGNED_INT:5125,FLOAT:5126,FLOAT16:5131,FLOAT64:5130};init(){this.propertyType="Accessor"}getDefaults(){return Object.assign(super.getDefaults(),{array:null,type:ke.Type.SCALAR,componentType:ke.ComponentType.FLOAT,normalized:!1,sparse:!1,buffer:null})}static getElementSize(e){switch(e){case ke.Type.SCALAR:return 1;case ke.Type.VEC2:return 2;case ke.Type.VEC3:return 3;case ke.Type.VEC4:return 4;case ke.Type.MAT2:return 4;case ke.Type.MAT3:return 9;case ke.Type.MAT4:return 16;default:throw new Error("Unexpected type: "+e)}}static getComponentSize(e){switch(e){case ke.ComponentType.BYTE:case ke.ComponentType.UNSIGNED_BYTE:return 1;case ke.ComponentType.SHORT:case ke.ComponentType.UNSIGNED_SHORT:return 2;case ke.ComponentType.UNSIGNED_INT:case ke.ComponentType.FLOAT:return 4;case ke.ComponentType.FLOAT16:return 2;case ke.ComponentType.FLOAT64:return 8;default:throw new Error("Unexpected component type: "+e)}}getMinNormalized(e){let a=this.getNormalized(),r=this.getElementSize(),s=this.getComponentType();if(this.getMin(e),a)for(let n=0;n<r;n++)e[n]=fe.decodeNormalizedInt(e[n],s);return e}getMin(e){let a=this.getArray(),r=this.getCount(),s=this.getElementSize();for(let n=0;n<s;n++)e[n]=1/0;for(let n=0;n<r*s;n+=s)for(let i=0;i<s;i++){let o=a[n+i];Number.isFinite(o)&&(e[i]=Math.min(e[i],o))}return e}getMaxNormalized(e){let a=this.getNormalized(),r=this.getElementSize(),s=this.getComponentType();if(this.getMax(e),a)for(let n=0;n<r;n++)e[n]=fe.decodeNormalizedInt(e[n],s);return e}getMax(e){let a=this.get("array"),r=this.getCount(),s=this.getElementSize();for(let n=0;n<s;n++)e[n]=-1/0;for(let n=0;n<r*s;n+=s)for(let i=0;i<s;i++){let o=a[n+i];Number.isFinite(o)&&(e[i]=Math.max(e[i],o))}return e}getCount(){let e=this.get("array");return e?e.length/this.getElementSize():0}getType(){return this.get("type")}setType(e){return this.set("type",e)}getElementSize(){return ke.getElementSize(this.get("type"))}getComponentSize(){return this.get("array").BYTES_PER_ELEMENT}getComponentType(){return this.get("componentType")}getNormalized(){return this.get("normalized")}setNormalized(e){return this.set("normalized",e)}getScalar(e){let a=this.getElementSize(),r=this.getComponentType(),s=this.getArray();return this.getNormalized()?fe.decodeNormalizedInt(s[e*a],r):s[e*a]}setScalar(e,a){let r=this.getElementSize(),s=this.getComponentType(),n=this.getArray();return this.getNormalized()?n[e*r]=fe.encodeNormalizedInt(a,s):n[e*r]=a,this}getElement(e,a){let r=this.getNormalized(),s=this.getElementSize(),n=this.getComponentType(),i=this.getArray();for(let o=0;o<s;o++)r?a[o]=fe.decodeNormalizedInt(i[e*s+o],n):a[o]=i[e*s+o];return a}setElement(e,a){let r=this.getNormalized(),s=this.getElementSize(),n=this.getComponentType(),i=this.getArray();for(let o=0;o<s;o++)r?i[e*s+o]=fe.encodeNormalizedInt(a[o],n):i[e*s+o]=a[o];return this}getSparse(){return this.get("sparse")}setSparse(e){return this.set("sparse",e)}getBuffer(){return this.getRef("buffer")}setBuffer(e){return this.setRef("buffer",e)}getArray(){return this.get("array")}setArray(e){return this.set("componentType",e?sp(e):ke.ComponentType.FLOAT),this.set("array",e),this}getByteLength(){let e=this.get("array");return e?e.byteLength:0}};function sp(t){switch(t.constructor){case Float32Array:return K.ComponentType.FLOAT;case Uint32Array:return K.ComponentType.UNSIGNED_INT;case Uint16Array:return K.ComponentType.UNSIGNED_SHORT;case Uint8Array:return K.ComponentType.UNSIGNED_BYTE;case Int16Array:return K.ComponentType.SHORT;case Int8Array:return K.ComponentType.BYTE;case Float64Array:return K.ComponentType.FLOAT64}if(typeof Float16Array<"u"&&t.constructor===Float16Array)return K.ComponentType.FLOAT16;throw new Error("Unknown accessor componentType.")}var Nc=class extends Be{init(){this.propertyType="Animation"}getDefaults(){return Object.assign(super.getDefaults(),{channels:new ce,samplers:new ce})}addChannel(t){return this.addRef("channels",t)}removeChannel(t){return this.removeRef("channels",t)}listChannels(){return this.listRefs("channels")}addSampler(t){return this.addRef("samplers",t)}removeSampler(t){return this.removeRef("samplers",t)}listSamplers(){return this.listRefs("samplers")}},Vn=class extends Be{static TargetPath={TRANSLATION:"translation",ROTATION:"rotation",SCALE:"scale",WEIGHTS:"weights"};init(){this.propertyType="AnimationChannel"}getDefaults(){return Object.assign(super.getDefaults(),{targetPath:null,targetNode:null,sampler:null})}getTargetPath(){return this.get("targetPath")}setTargetPath(t){return this.set("targetPath",t)}getTargetNode(){return this.getRef("targetNode")}setTargetNode(t){return this.setRef("targetNode",t)}getSampler(){return this.getRef("sampler")}setSampler(t){return this.setRef("sampler",t)}},Yr=class Cc extends Be{static Interpolation={LINEAR:"LINEAR",STEP:"STEP",CUBICSPLINE:"CUBICSPLINE"};init(){this.propertyType="AnimationSampler"}getDefaultAttributes(){return Object.assign(super.getDefaults(),{interpolation:Cc.Interpolation.LINEAR,input:null,output:null})}getInterpolation(){return this.get("interpolation")}setInterpolation(e){return this.set("interpolation",e)}getInput(){return this.getRef("input")}setInput(e){return this.setRef("input",e,{usage:"OTHER"})}getOutput(){return this.getRef("output")}setOutput(e){return this.setRef("output",e,{usage:"OTHER"})}},Bc=class extends Be{init(){this.propertyType="Buffer"}getDefaults(){return Object.assign(super.getDefaults(),{uri:""})}getURI(){return this.get("uri")}setURI(t){return this.set("uri",t)}},Jr=class Oc extends Be{static Type={PERSPECTIVE:"perspective",ORTHOGRAPHIC:"orthographic"};init(){this.propertyType="Camera"}getDefaults(){return Object.assign(super.getDefaults(),{type:Oc.Type.PERSPECTIVE,znear:.1,zfar:100,aspectRatio:null,yfov:Math.PI*2*50/360,xmag:1,ymag:1})}getType(){return this.get("type")}setType(e){return this.set("type",e)}getZNear(){return this.get("znear")}setZNear(e){return this.set("znear",e)}getZFar(){return this.get("zfar")}setZFar(e){return this.set("zfar",e)}getAspectRatio(){return this.get("aspectRatio")}setAspectRatio(e){return this.set("aspectRatio",e)}getYFov(){return this.get("yfov")}setYFov(e){return this.set("yfov",e)}getXMag(){return this.get("xmag")}setXMag(e){return this.set("xmag",e)}getYMag(){return this.get("ymag")}setYMag(e){return this.set("ymag",e)}},J=class extends Kn{static EXTENSION_NAME;_validateParent(t){if(!this.parentTypes.includes(t.propertyType))throw new Error(`Parent "${t.propertyType}" invalid for child "${this.propertyType}".`)}},ue=class zn extends Be{static WrapMode={CLAMP_TO_EDGE:33071,MIRRORED_REPEAT:33648,REPEAT:10497};static MagFilter={NEAREST:9728,LINEAR:9729};static MinFilter={NEAREST:9728,LINEAR:9729,NEAREST_MIPMAP_NEAREST:9984,LINEAR_MIPMAP_NEAREST:9985,NEAREST_MIPMAP_LINEAR:9986,LINEAR_MIPMAP_LINEAR:9987};init(){this.propertyType="TextureInfo"}getDefaults(){return Object.assign(super.getDefaults(),{texCoord:0,magFilter:null,minFilter:null,wrapS:zn.WrapMode.REPEAT,wrapT:zn.WrapMode.REPEAT})}getTexCoord(){return this.get("texCoord")}setTexCoord(e){return this.set("texCoord",e)}getMagFilter(){return this.get("magFilter")}setMagFilter(e){return this.set("magFilter",e)}getMinFilter(){return this.get("minFilter")}setMinFilter(e){return this.set("minFilter",e)}getWrapS(){return this.get("wrapS")}setWrapS(e){return this.set("wrapS",e)}getWrapT(){return this.get("wrapT")}setWrapT(e){return this.set("wrapT",e)}},{R:zr,G:Gr,B:Kr,A:np}=Qe,Wr=class Fc extends Be{static AlphaMode={OPAQUE:"OPAQUE",MASK:"MASK",BLEND:"BLEND"};init(){this.propertyType="Material"}getDefaults(){return Object.assign(super.getDefaults(),{alphaMode:Fc.AlphaMode.OPAQUE,alphaCutoff:.5,doubleSided:!1,baseColorFactor:[1,1,1,1],baseColorTexture:null,baseColorTextureInfo:new ue(this.graph,"baseColorTextureInfo"),emissiveFactor:[0,0,0],emissiveTexture:null,emissiveTextureInfo:new ue(this.graph,"emissiveTextureInfo"),normalScale:1,normalTexture:null,normalTextureInfo:new ue(this.graph,"normalTextureInfo"),occlusionStrength:1,occlusionTexture:null,occlusionTextureInfo:new ue(this.graph,"occlusionTextureInfo"),roughnessFactor:1,metallicFactor:1,metallicRoughnessTexture:null,metallicRoughnessTextureInfo:new ue(this.graph,"metallicRoughnessTextureInfo")})}getDoubleSided(){return this.get("doubleSided")}setDoubleSided(e){return this.set("doubleSided",e)}getAlpha(){return this.get("baseColorFactor")[3]}setAlpha(e){let a=this.get("baseColorFactor").slice();return a[3]=e,this.set("baseColorFactor",a)}getAlphaMode(){return this.get("alphaMode")}setAlphaMode(e){return this.set("alphaMode",e)}getAlphaCutoff(){return this.get("alphaCutoff")}setAlphaCutoff(e){return this.set("alphaCutoff",e)}getBaseColorFactor(){return this.get("baseColorFactor")}setBaseColorFactor(e){return this.set("baseColorFactor",e)}getBaseColorTexture(){return this.getRef("baseColorTexture")}getBaseColorTextureInfo(){return this.getRef("baseColorTexture")?this.getRef("baseColorTextureInfo"):null}setBaseColorTexture(e){return this.setRef("baseColorTexture",e,{channels:zr|Gr|Kr|np,isColor:!0})}getEmissiveFactor(){return this.get("emissiveFactor")}setEmissiveFactor(e){return this.set("emissiveFactor",e)}getEmissiveTexture(){return this.getRef("emissiveTexture")}getEmissiveTextureInfo(){return this.getRef("emissiveTexture")?this.getRef("emissiveTextureInfo"):null}setEmissiveTexture(e){return this.setRef("emissiveTexture",e,{channels:zr|Gr|Kr,isColor:!0})}getNormalScale(){return this.get("normalScale")}setNormalScale(e){return this.set("normalScale",e)}getNormalTexture(){return this.getRef("normalTexture")}getNormalTextureInfo(){return this.getRef("normalTexture")?this.getRef("normalTextureInfo"):null}setNormalTexture(e){return this.setRef("normalTexture",e,{channels:zr|Gr|Kr})}getOcclusionStrength(){return this.get("occlusionStrength")}setOcclusionStrength(e){return this.set("occlusionStrength",e)}getOcclusionTexture(){return this.getRef("occlusionTexture")}getOcclusionTextureInfo(){return this.getRef("occlusionTexture")?this.getRef("occlusionTextureInfo"):null}setOcclusionTexture(e){return this.setRef("occlusionTexture",e,{channels:zr})}getRoughnessFactor(){return this.get("roughnessFactor")}setRoughnessFactor(e){return this.set("roughnessFactor",e)}getMetallicFactor(){return this.get("metallicFactor")}setMetallicFactor(e){return this.set("metallicFactor",e)}getMetallicRoughnessTexture(){return this.getRef("metallicRoughnessTexture")}getMetallicRoughnessTextureInfo(){return this.getRef("metallicRoughnessTexture")?this.getRef("metallicRoughnessTextureInfo"):null}setMetallicRoughnessTexture(e){return this.setRef("metallicRoughnessTexture",e,{channels:Gr|Kr})}},Pc=class extends Be{init(){this.propertyType="Mesh"}getDefaults(){return Object.assign(super.getDefaults(),{weights:[],primitives:new ce})}addPrimitive(t){return this.addRef("primitives",t)}removePrimitive(t){return this.removeRef("primitives",t)}listPrimitives(){return this.listRefs("primitives")}getWeights(){return this.get("weights")}setWeights(t){return this.set("weights",t)}},jc=class extends Be{init(){this.propertyType="Node"}getDefaults(){return Object.assign(super.getDefaults(),{translation:[0,0,0],rotation:[0,0,0,1],scale:[1,1,1],weights:[],camera:null,mesh:null,skin:null,children:new ce})}copy(t,e=_t){if(e===_t)throw new Error("Node cannot be copied.");return super.copy(t,e)}getTranslation(){return this.get("translation")}getRotation(){return this.get("rotation")}getScale(){return this.get("scale")}setTranslation(t){return this.set("translation",t)}setRotation(t){return this.set("rotation",t)}setScale(t){return this.set("scale",t)}getMatrix(){return fe.compose(this.get("translation"),this.get("rotation"),this.get("scale"),[])}setMatrix(t){let e=this.get("translation").slice(),a=this.get("rotation").slice(),r=this.get("scale").slice();return fe.decompose(t,e,a,r),this.set("translation",e).set("rotation",a).set("scale",r)}getWorldTranslation(){let t=[0,0,0];return fe.decompose(this.getWorldMatrix(),t,[0,0,0,1],[1,1,1]),t}getWorldRotation(){let t=[0,0,0,1];return fe.decompose(this.getWorldMatrix(),[0,0,0],t,[1,1,1]),t}getWorldScale(){let t=[1,1,1];return fe.decompose(this.getWorldMatrix(),[0,0,0],[0,0,0,1],t),t}getWorldMatrix(){let t=[];for(let r=this;r!=null;r=r.getParentNode())t.push(r);let e,a=t.pop().getMatrix();for(;e=t.pop();)Hb(a,a,e.getMatrix());return a}addChild(t){let e=t.getParentNode();e&&e.removeChild(t);for(let a of t.listParents())a.propertyType==="Scene"&&a.removeChild(t);return this.addRef("children",t)}removeChild(t){return this.removeRef("children",t)}listChildren(){return this.listRefs("children")}getParentNode(){for(let t of this.listParents())if(t.propertyType==="Node")return t;return null}getMesh(){return this.getRef("mesh")}setMesh(t){return this.setRef("mesh",t)}getCamera(){return this.getRef("camera")}setCamera(t){return this.setRef("camera",t)}getSkin(){return this.getRef("skin")}setSkin(t){return this.setRef("skin",t)}getWeights(){return this.get("weights")}setWeights(t){return this.set("weights",t)}traverse(t){t(this);for(let e of this.listChildren())e.traverse(t);return this}},Ga=class Lc extends Be{static Mode={POINTS:0,LINES:1,LINE_LOOP:2,LINE_STRIP:3,TRIANGLES:4,TRIANGLE_STRIP:5,TRIANGLE_FAN:6};init(){this.propertyType="Primitive"}getDefaults(){return Object.assign(super.getDefaults(),{mode:Lc.Mode.TRIANGLES,material:null,indices:null,attributes:new ve,targets:new ce})}getIndices(){return this.getRef("indices")}setIndices(e){return this.setRef("indices",e,{usage:"ELEMENT_ARRAY_BUFFER"})}getAttribute(e){return this.getRefMap("attributes",e)}setAttribute(e,a){return this.setRefMap("attributes",e,a,{usage:"ARRAY_BUFFER"})}listAttributes(){return this.listRefMapValues("attributes")}listSemantics(){return this.listRefMapKeys("attributes")}getMaterial(){return this.getRef("material")}setMaterial(e){return this.setRef("material",e)}getMode(){return this.get("mode")}setMode(e){return this.set("mode",e)}listTargets(){return this.listRefs("targets")}addTarget(e){return this.addRef("targets",e)}removeTarget(e){return this.removeRef("targets",e)}},ip=class extends Kn{init(){this.propertyType="PrimitiveTarget"}getDefaults(){return Object.assign(super.getDefaults(),{attributes:new ve})}getAttribute(t){return this.getRefMap("attributes",t)}setAttribute(t,e){return this.setRefMap("attributes",t,e,{usage:"ARRAY_BUFFER"})}listAttributes(){return this.listRefMapValues("attributes")}listSemantics(){return this.listRefMapKeys("attributes")}},Dc=class extends Be{init(){this.propertyType="Scene"}getDefaults(){return Object.assign(super.getDefaults(),{children:new ce})}copy(t,e=_t){if(e===_t)throw new Error("Scene cannot be copied.");return super.copy(t,e)}addChild(t){let e=t.getParentNode();return e&&e.removeChild(t),this.addRef("children",t)}removeChild(t){return this.removeRef("children",t)}listChildren(){return this.listRefs("children")}traverse(t){for(let e of this.listChildren())e.traverse(t);return this}},Uc=class extends Be{init(){this.propertyType="Skin"}getDefaults(){return Object.assign(super.getDefaults(),{skeleton:null,inverseBindMatrices:null,joints:new ce})}getSkeleton(){return this.getRef("skeleton")}setSkeleton(t){return this.setRef("skeleton",t)}getInverseBindMatrices(){return this.getRef("inverseBindMatrices")}setInverseBindMatrices(t){return this.setRef("inverseBindMatrices",t,{usage:"INVERSE_BIND_MATRICES"})}addJoint(t){return this.addRef("joints",t)}removeJoint(t){return this.removeRef("joints",t)}listJoints(){return this.listRefs("joints")}},zc=class extends Be{init(){this.propertyType="Texture"}getDefaults(){return Object.assign(super.getDefaults(),{image:null,mimeType:"",uri:""})}getMimeType(){return this.get("mimeType")||ot.extensionToMimeType(ma.extension(this.get("uri")))}setMimeType(t){return this.set("mimeType",t)}getURI(){return this.get("uri")}setURI(t){this.set("uri",t);let e=ot.extensionToMimeType(ma.extension(t));return e&&this.set("mimeType",e),this}getImage(){return this.get("image")}setImage(t){return this.set("image",X.assertView(t))}getSize(){let t=this.get("image");return t?ot.getSize(t,this.getMimeType()):null}},qn=class extends Be{_extensions=new Set;init(){this.propertyType="Root"}getDefaults(){return Object.assign(super.getDefaults(),{asset:{generator:`glTF-Transform ${Mc}`,version:"2.0"},defaultScene:null,accessors:new ce,animations:new ce,buffers:new ce,cameras:new ce,materials:new ce,meshes:new ce,nodes:new ce,scenes:new ce,skins:new ce,textures:new ce})}constructor(t){super(t),t.addEventListener("node:create",e=>{this._addChildOfRoot(e.target)})}clone(){throw new Error("Root cannot be cloned.")}copy(t,e=_t){if(e===_t)throw new Error("Root cannot be copied.");this.set("asset",{...t.get("asset")}),this.setName(t.getName()),this.setExtras({...t.getExtras()}),this.setDefaultScene(t.getDefaultScene()?e(t.getDefaultScene()):null);for(let a of t.listRefMapKeys("extensions")){let r=t.getExtension(a);this.setExtension(a,e(r))}return this}_addChildOfRoot(t){return t instanceof Dc?this.addRef("scenes",t):t instanceof jc?this.addRef("nodes",t):t instanceof Jr?this.addRef("cameras",t):t instanceof Uc?this.addRef("skins",t):t instanceof Pc?this.addRef("meshes",t):t instanceof Wr?this.addRef("materials",t):t instanceof zc?this.addRef("textures",t):t instanceof Nc?this.addRef("animations",t):t instanceof K?this.addRef("accessors",t):t instanceof Bc&&this.addRef("buffers",t),this}getAsset(){return this.get("asset")}listExtensionsUsed(){return Array.from(this._extensions)}listExtensionsRequired(){return this.listExtensionsUsed().filter(t=>t.isRequired())}_enableExtension(t){return this._extensions.add(t),this}_disableExtension(t){return this._extensions.delete(t),this}listScenes(){return this.listRefs("scenes")}setDefaultScene(t){return this.setRef("defaultScene",t)}getDefaultScene(){return this.getRef("defaultScene")}listNodes(){return this.listRefs("nodes")}listCameras(){return this.listRefs("cameras")}listSkins(){return this.listRefs("skins")}listMeshes(){return this.listRefs("meshes")}listMaterials(){return this.listRefs("materials")}listTextures(){return this.listRefs("textures")}listAnimations(){return this.listRefs("animations")}listAccessors(){return this.listRefs("accessors")}listBuffers(){return this.listRefs("buffers")}},op=class Gn{_graph=new Pn;_root=new qn(this._graph);_logger=$r.DEFAULT_INSTANCE;static _GRAPH_DOCUMENTS=new WeakMap;static fromGraph(e){return Gn._GRAPH_DOCUMENTS.get(e)||null}constructor(){Gn._GRAPH_DOCUMENTS.set(this._graph,this)}getRoot(){return this._root}getGraph(){return this._graph}getLogger(){return this._logger}setLogger(e){return this._logger=e,this}clone(){throw new Error("Use 'cloneDocument(source)' from '@gltf-transform/functions'.")}merge(e){throw new Error("Use 'mergeDocuments(target, source)' from '@gltf-transform/functions'.")}async transform(...e){let a=e.map(r=>r.name);for(let r of e)await r(this,{stack:a});return this}hasExtension(e){return this.getRoot().listExtensionsUsed().some(a=>a.extensionName===e)}createExtension(e){let a=e.EXTENSION_NAME;return this.getRoot().listExtensionsUsed().find(r=>r.extensionName===a)||new e(this)}disposeExtension(e){let a=this.getRoot().listExtensionsUsed().find(r=>r.extensionName===e);a&&a.dispose()}createScene(e=""){return new Dc(this._graph,e)}createNode(e=""){return new jc(this._graph,e)}createCamera(e=""){return new Jr(this._graph,e)}createSkin(e=""){return new Uc(this._graph,e)}createMesh(e=""){return new Pc(this._graph,e)}createPrimitive(){return new Ga(this._graph)}createPrimitiveTarget(e=""){return new ip(this._graph,e)}createMaterial(e=""){return new Wr(this._graph,e)}createTexture(e=""){return new zc(this._graph,e)}createAnimation(e=""){return new Nc(this._graph,e)}createAnimationChannel(e=""){return new Vn(this._graph,e)}createAnimationSampler(e=""){return new Yr(this._graph,e)}createAccessor(e="",a=null){return a||(a=this.getRoot().listBuffers()[0]),new K(this._graph,e).setBuffer(a)}createBuffer(e=""){return new Bc(this._graph,e)}},ie=class{static EXTENSION_NAME;extensionName="";prereadTypes=[];prewriteTypes=[];readDependencies=[];writeDependencies=[];document;required=!1;properties=new Set;_listener;constructor(t){this.document=t,t.getRoot()._enableExtension(this),this._listener=a=>{let r=a,s=r.target;s instanceof J&&s.extensionName===this.extensionName&&(r.type==="node:create"&&this._addExtensionProperty(s),r.type==="node:dispose"&&this._removeExtensionProperty(s))};let e=t.getGraph();e.addEventListener("node:create",this._listener),e.addEventListener("node:dispose",this._listener)}dispose(){this.document.getRoot()._disableExtension(this);let t=this.document.getGraph();t.removeEventListener("node:create",this._listener),t.removeEventListener("node:dispose",this._listener);for(let e of this.properties)e.dispose()}static register(){}isRequired(){return this.required}setRequired(t){return this.required=t,this}listProperties(){return Array.from(this.properties)}_addExtensionProperty(t){return this.properties.add(t),this}_removeExtensionProperty(t){return this.properties.delete(t),this}install(t,e){return this}preread(t,e){return this}prewrite(t,e){return this}},cp=class{jsonDoc;buffers=[];bufferViews=[];bufferViewBuffers=[];accessors=[];textures=[];textureInfos=new Map;materials=[];meshes=[];cameras=[];nodes=[];skins=[];animations=[];scenes=[];constructor(t){this.jsonDoc=t}setTextureInfo(t,e){this.textureInfos.set(t,e),e.texCoord!==void 0&&t.setTexCoord(e.texCoord),e.extras!==void 0&&t.setExtras(e.extras);let a=this.jsonDoc.json.textures[e.index];if(a.sampler===void 0)return;let r=this.jsonDoc.json.samplers[a.sampler];r.magFilter!==void 0&&t.setMagFilter(r.magFilter),r.minFilter!==void 0&&t.setMinFilter(r.minFilter),r.wrapS!==void 0&&t.setWrapS(r.wrapS),r.wrapT!==void 0&&t.setWrapT(r.wrapT)}},vc={logger:$r.DEFAULT_INSTANCE,extensions:[],dependencies:{}},lp=new Set(["Buffer","Texture","Material","Mesh","Primitive","Node","Scene"]),dp=class{static read(t,e=vc){let a={...vc,...e},{json:r}=t,s=new op().setLogger(a.logger);this.validate(t,a);let n=new cp(t),i=r.asset,o=s.getRoot().getAsset();i.copyright&&(o.copyright=i.copyright),i.extras&&(o.extras=i.extras),r.extras!==void 0&&s.getRoot().setExtras({...r.extras});let c=r.extensionsUsed||[],l=r.extensionsRequired||[];a.extensions.sort((b,y)=>b.EXTENSION_NAME>y.EXTENSION_NAME?1:-1);for(let b of a.extensions)if(c.includes(b.EXTENSION_NAME)){let y=s.createExtension(b).setRequired(l.includes(b.EXTENSION_NAME)),x=y.prereadTypes.filter(v=>!lp.has(v));x.length&&a.logger.warn(`Preread hooks for some types (${x.join()}), requested by extension ${y.extensionName}, are unsupported. Please file an issue or a PR.`);for(let v of y.readDependencies)y.install(v,a.dependencies[v])}let f=r.buffers||[];s.getRoot().listExtensionsUsed().filter(b=>b.prereadTypes.includes("Buffer")).forEach(b=>b.preread(n,"Buffer")),n.buffers=f.map(b=>{let y=s.createBuffer(b.name);return b.extras&&y.setExtras(b.extras),b.uri&&b.uri.indexOf("__")!==0&&y.setURI(b.uri),y}),n.bufferViewBuffers=(r.bufferViews||[]).map((b,y)=>{if(!n.bufferViews[y]){let x=t.json.buffers[b.buffer],v=x.uri?t.resources[x.uri]:t.resources[At],M=b.byteOffset||0;n.bufferViews[y]=X.toView(v,M,b.byteLength)}return n.buffers[b.buffer]});let u=r.accessors||[];n.accessors=u.map(b=>{let y=n.bufferViewBuffers[b.bufferView],x=s.createAccessor(b.name,y).setType(b.type);return b.extras&&x.setExtras(b.extras),b.normalized!==void 0&&x.setNormalized(b.normalized),b.bufferView===void 0||x.setArray(qr(b,n)),x});let g=r.images||[],p=r.textures||[];s.getRoot().listExtensionsUsed().filter(b=>b.prereadTypes.includes("Texture")).forEach(b=>b.preread(n,"Texture")),n.textures=g.map(b=>{let y=s.createTexture(b.name);if(b.extras&&y.setExtras(b.extras),b.bufferView!==void 0){let x=r.bufferViews[b.bufferView],v=t.json.buffers[x.buffer],M=v.uri?t.resources[v.uri]:t.resources[At],S=x.byteOffset||0,A=x.byteLength,_=M.slice(S,S+A);y.setImage(_)}else b.uri!==void 0&&(y.setImage(t.resources[b.uri]),b.uri.indexOf("__")!==0&&y.setURI(b.uri));if(b.mimeType!==void 0)y.setMimeType(b.mimeType);else if(b.uri){let x=ma.extension(b.uri);y.setMimeType(ot.extensionToMimeType(x))}return y}),s.getRoot().listExtensionsUsed().filter(b=>b.prereadTypes.includes("Material")).forEach(b=>b.preread(n,"Material")),n.materials=(r.materials||[]).map(b=>{let y=s.createMaterial(b.name);b.extras&&y.setExtras(b.extras),b.alphaMode!==void 0&&y.setAlphaMode(b.alphaMode),b.alphaCutoff!==void 0&&y.setAlphaCutoff(b.alphaCutoff),b.doubleSided!==void 0&&y.setDoubleSided(b.doubleSided);let x=b.pbrMetallicRoughness||{};if(x.baseColorFactor!==void 0&&y.setBaseColorFactor(x.baseColorFactor),b.emissiveFactor!==void 0&&y.setEmissiveFactor(b.emissiveFactor),x.metallicFactor!==void 0&&y.setMetallicFactor(x.metallicFactor),x.roughnessFactor!==void 0&&y.setRoughnessFactor(x.roughnessFactor),x.baseColorTexture!==void 0){let v=x.baseColorTexture,M=n.textures[p[v.index].source];y.setBaseColorTexture(M),n.setTextureInfo(y.getBaseColorTextureInfo(),v)}if(b.emissiveTexture!==void 0){let v=b.emissiveTexture,M=n.textures[p[v.index].source];y.setEmissiveTexture(M),n.setTextureInfo(y.getEmissiveTextureInfo(),v)}if(b.normalTexture!==void 0){let v=b.normalTexture,M=n.textures[p[v.index].source];y.setNormalTexture(M),n.setTextureInfo(y.getNormalTextureInfo(),v),b.normalTexture.scale!==void 0&&y.setNormalScale(b.normalTexture.scale)}if(b.occlusionTexture!==void 0){let v=b.occlusionTexture,M=n.textures[p[v.index].source];y.setOcclusionTexture(M),n.setTextureInfo(y.getOcclusionTextureInfo(),v),b.occlusionTexture.strength!==void 0&&y.setOcclusionStrength(b.occlusionTexture.strength)}if(x.metallicRoughnessTexture!==void 0){let v=x.metallicRoughnessTexture,M=n.textures[p[v.index].source];y.setMetallicRoughnessTexture(M),n.setTextureInfo(y.getMetallicRoughnessTextureInfo(),v)}return y}),s.getRoot().listExtensionsUsed().filter(b=>b.prereadTypes.includes("Mesh")).forEach(b=>b.preread(n,"Mesh"));let h=r.meshes||[];s.getRoot().listExtensionsUsed().filter(b=>b.prereadTypes.includes("Primitive")).forEach(b=>b.preread(n,"Primitive")),n.meshes=h.map(b=>{let y=s.createMesh(b.name);return b.extras&&y.setExtras(b.extras),b.weights!==void 0&&y.setWeights(b.weights),(b.primitives||[]).forEach(x=>{let v=s.createPrimitive();x.extras&&v.setExtras(x.extras),x.material!==void 0&&v.setMaterial(n.materials[x.material]),x.mode!==void 0&&v.setMode(x.mode);for(let[S,A]of Object.entries(x.attributes||{}))v.setAttribute(S,n.accessors[A]);x.indices!==void 0&&v.setIndices(n.accessors[x.indices]);let M=b.extras&&b.extras.targetNames||[];(x.targets||[]).forEach((S,A)=>{let _=M[A]||A.toString(),N=s.createPrimitiveTarget(_);for(let[I,C]of Object.entries(S))N.setAttribute(I,n.accessors[C]);v.addTarget(N)}),y.addPrimitive(v)}),y}),n.cameras=(r.cameras||[]).map(b=>{let y=s.createCamera(b.name).setType(b.type);if(b.extras&&y.setExtras(b.extras),b.type===Jr.Type.PERSPECTIVE){let x=b.perspective;y.setYFov(x.yfov),y.setZNear(x.znear),x.zfar!==void 0&&y.setZFar(x.zfar),x.aspectRatio!==void 0&&y.setAspectRatio(x.aspectRatio)}else{let x=b.orthographic;y.setZNear(x.znear).setZFar(x.zfar).setXMag(x.xmag).setYMag(x.ymag)}return y});let d=r.nodes||[];s.getRoot().listExtensionsUsed().filter(b=>b.prereadTypes.includes("Node")).forEach(b=>b.preread(n,"Node")),n.nodes=d.map(b=>{let y=s.createNode(b.name);if(b.extras&&y.setExtras(b.extras),b.translation!==void 0&&y.setTranslation(b.translation),b.rotation!==void 0&&y.setRotation(b.rotation),b.scale!==void 0&&y.setScale(b.scale),b.matrix!==void 0){let x=[0,0,0],v=[0,0,0,1],M=[1,1,1];fe.decompose(b.matrix,x,v,M),y.setTranslation(x),y.setRotation(v),y.setScale(M)}return b.weights!==void 0&&y.setWeights(b.weights),y}),n.skins=(r.skins||[]).map(b=>{let y=s.createSkin(b.name);b.extras&&y.setExtras(b.extras),b.inverseBindMatrices!==void 0&&y.setInverseBindMatrices(n.accessors[b.inverseBindMatrices]),b.skeleton!==void 0&&y.setSkeleton(n.nodes[b.skeleton]);for(let x of b.joints)y.addJoint(n.nodes[x]);return y}),d.map((b,y)=>{let x=n.nodes[y];(b.children||[]).forEach(v=>x.addChild(n.nodes[v])),b.mesh!==void 0&&x.setMesh(n.meshes[b.mesh]),b.camera!==void 0&&x.setCamera(n.cameras[b.camera]),b.skin!==void 0&&x.setSkin(n.skins[b.skin])}),n.animations=(r.animations||[]).map(b=>{let y=s.createAnimation(b.name);b.extras&&y.setExtras(b.extras);let x=(b.samplers||[]).map(v=>{let M=s.createAnimationSampler().setInput(n.accessors[v.input]).setOutput(n.accessors[v.output]).setInterpolation(v.interpolation||Yr.Interpolation.LINEAR);return v.extras&&M.setExtras(v.extras),y.addSampler(M),M});return(b.channels||[]).forEach(v=>{let M=s.createAnimationChannel().setSampler(x[v.sampler]).setTargetPath(v.target.path);v.target.node!==void 0&&M.setTargetNode(n.nodes[v.target.node]),v.extras&&M.setExtras(v.extras),y.addChannel(M)}),y});let m=r.scenes||[];return s.getRoot().listExtensionsUsed().filter(b=>b.prereadTypes.includes("Scene")).forEach(b=>b.preread(n,"Scene")),n.scenes=m.map(b=>{let y=s.createScene(b.name);return b.extras&&y.setExtras(b.extras),(b.nodes||[]).map(x=>n.nodes[x]).forEach(x=>y.addChild(x)),y}),r.scene!==void 0&&s.getRoot().setDefaultScene(n.scenes[r.scene]),s.getRoot().listExtensionsUsed().forEach(b=>b.read(n)),u.forEach((b,y)=>{let x=n.accessors[y],v=!!b.sparse,M=!b.bufferView&&!x.getArray();(v||M)&&x.setSparse(!0).setArray(fp(b,n))}),s}static validate(t,e){let a=t.json;if(a.asset.version!=="2.0")throw new Error(`Unsupported glTF version, "${a.asset.version}".`);if(a.extensionsRequired){for(let r of a.extensionsRequired)if(!e.extensions.find(s=>s.EXTENSION_NAME===r))throw new Error(`Missing required extension, "${r}".`)}if(a.extensionsUsed)for(let r of a.extensionsUsed)e.extensions.find(s=>s.EXTENSION_NAME===r)||e.logger.warn(`Missing optional extension, "${r}".`)}};function up(t,e){let a=e.jsonDoc,r=e.bufferViews[t.bufferView],s=a.json.bufferViews[t.bufferView],n=Xr[t.componentType],i=K.getElementSize(t.type),o=n.BYTES_PER_ELEMENT,c=t.byteOffset||0,l=new n(t.count*i),f=new DataView(r.buffer,r.byteOffset,r.byteLength),u=s.byteStride;for(let g=0;g<t.count;g++)for(let p=0;p<i;p++){let h=c+g*u+p*o,d;switch(t.componentType){case K.ComponentType.FLOAT:d=f.getFloat32(h,!0);break;case K.ComponentType.UNSIGNED_INT:d=f.getUint32(h,!0);break;case K.ComponentType.UNSIGNED_SHORT:d=f.getUint16(h,!0);break;case K.ComponentType.UNSIGNED_BYTE:d=f.getUint8(h);break;case K.ComponentType.SHORT:d=f.getInt16(h,!0);break;case K.ComponentType.BYTE:d=f.getInt8(h);break;case K.ComponentType.FLOAT16:d=f.getFloat16(h,!0);break;case K.ComponentType.FLOAT64:d=f.getFloat64(h,!0);break;default:throw new Error(`Unexpected componentType "${t.componentType}".`)}l[g*i+p]=d}return l}function qr(t,e){let a=e.jsonDoc,r=e.bufferViews[t.bufferView],s=a.json.bufferViews[t.bufferView],n=Xr[t.componentType],i=K.getElementSize(t.type),o=n.BYTES_PER_ELEMENT,c=i*o;if(s.byteStride!==void 0&&s.byteStride!==c)return up(t,e);let l=r.byteOffset+(t.byteOffset||0),f=t.count*i*o;return new n(r.buffer.slice(l,l+f))}function fp(t,e){let a=Xr[t.componentType],r=K.getElementSize(t.type),s;t.bufferView!==void 0?s=qr(t,e):s=new a(t.count*r);let n=t.sparse;if(!n)return s;let i=n.count,o={...t,...n.indices,count:i,type:"SCALAR"},c={...t,...n.values,count:i},l=qr(o,e),f=qr(c,e);for(let u=0;u<o.count;u++)for(let g=0;g<r;g++)s[l[u]*r+g]=f[u*r+g];return s}var Gc=(function(t){return t[t.ARRAY_BUFFER=34962]="ARRAY_BUFFER",t[t.ELEMENT_ARRAY_BUFFER=34963]="ELEMENT_ARRAY_BUFFER",t})(Gc||{}),Tt=class{_doc;jsonDoc;options;static BufferViewTarget=Gc;static BufferViewUsage=Pb;static USAGE_TO_TARGET={ARRAY_BUFFER:34962,ELEMENT_ARRAY_BUFFER:34963};accessorIndexMap=new Map;animationIndexMap=new Map;bufferIndexMap=new Map;cameraIndexMap=new Map;skinIndexMap=new Map;materialIndexMap=new Map;meshIndexMap=new Map;nodeIndexMap=new Map;imageIndexMap=new Map;textureDefIndexMap=new Map;textureInfoDefMap=new Map;samplerDefIndexMap=new Map;sceneIndexMap=new Map;imageBufferViews=[];otherBufferViews=new Map;otherBufferViewsIndexMap=new Map;extensionData={};bufferURIGenerator;imageURIGenerator;logger;_accessorUsageMap=new Map;accessorUsageGroupedByParent=new Set(["ARRAY_BUFFER"]);accessorParents=new Map;constructor(t,e,a){this._doc=t,this.jsonDoc=e,this.options=a;let r=t.getRoot(),s=r.listBuffers().length,n=r.listTextures().length;this.bufferURIGenerator=new kc(s>1,()=>a.basename||"buffer"),this.imageURIGenerator=new kc(n>1,i=>hp(t,i)||a.basename||"texture"),this.logger=t.getLogger()}createTextureInfoDef(t,e){let a={magFilter:e.getMagFilter()||void 0,minFilter:e.getMinFilter()||void 0,wrapS:e.getWrapS(),wrapT:e.getWrapT()},r=JSON.stringify(a);this.samplerDefIndexMap.has(r)||(this.samplerDefIndexMap.set(r,this.jsonDoc.json.samplers.length),this.jsonDoc.json.samplers.push(a));let s={source:this.imageIndexMap.get(t),sampler:this.samplerDefIndexMap.get(r)},n=JSON.stringify(s);this.textureDefIndexMap.has(n)||(this.textureDefIndexMap.set(n,this.jsonDoc.json.textures.length),this.jsonDoc.json.textures.push(s));let i={index:this.textureDefIndexMap.get(n)};return e.getTexCoord()!==0&&(i.texCoord=e.getTexCoord()),Object.keys(e.getExtras()).length>0&&(i.extras=e.getExtras()),this.textureInfoDefMap.set(e,i),i}createPropertyDef(t){let e={};return t.getName()&&(e.name=t.getName()),Object.keys(t.getExtras()).length>0&&(e.extras=t.getExtras()),e}createAccessorDef(t){let e=this.createPropertyDef(t);return e.type=t.getType(),e.componentType=t.getComponentType(),e.count=t.getCount(),this._doc.getGraph().listParentEdges(t).some(a=>a.getName()==="attributes"&&a.getAttributes().key==="POSITION"||a.getName()==="input")&&(e.max=t.getMax([]).map(Math.fround),e.min=t.getMin([]).map(Math.fround)),t.getNormalized()&&(e.normalized=t.getNormalized()),e}createImageData(t,e,a){if(this.options.format==="GLB")this.imageBufferViews.push(e),t.bufferView=this.jsonDoc.json.bufferViews.length,this.jsonDoc.json.bufferViews.push({buffer:0,byteOffset:-1,byteLength:e.byteLength});else{let r=ot.mimeTypeToExtension(a.getMimeType());t.uri=this.imageURIGenerator.createURI(a,r),this.assignResourceURI(t.uri,e,!1)}}assignResourceURI(t,e,a){let r=this.jsonDoc.resources;if(!(t in r)){r[t]=e;return}if(e===r[t]){this.logger.warn(`Duplicate resource URI, "${t}".`);return}let s=`Resource URI "${t}" already assigned to different data.`;if(!a){this.logger.warn(s);return}throw new Error(s)}getAccessorUsage(t){let e=this._accessorUsageMap.get(t);if(e)return e;if(t.getSparse())return"SPARSE";for(let a of this._doc.getGraph().listParentEdges(t)){let{usage:r}=a.getAttributes();if(r)return r;a.getParent().propertyType!=="Root"&&this.logger.warn(`Missing attribute ".usage" on edge, "${a.getName()}".`)}return"OTHER"}addAccessorToUsageGroup(t,e){let a=this._accessorUsageMap.get(t);if(a&&a!==e)throw new Error(`Accessor with usage "${a}" cannot be reused as "${e}".`);return this._accessorUsageMap.set(t,e),this}},kc=class{multiple;basename;counter={};constructor(t,e){this.multiple=t,this.basename=e}createURI(t,e){if(t.getURI())return t.getURI();if(this.multiple){let a=this.basename(t);return this.counter[a]=this.counter[a]||1,`${a}_${this.counter[a]++}.${e}`}else return`${this.basename(t)}.${e}`}};function hp(t,e){let a=t.getGraph().listParentEdges(e).find(r=>r.getParent()!==t.getRoot());return a?a.getName().replace(/texture$/i,""):""}var{BufferViewUsage:Vr}=Tt,{UNSIGNED_INT:bp,UNSIGNED_SHORT:pp,UNSIGNED_BYTE:gp}=K.ComponentType,mp=new Set(["Accessor","Buffer","Material","Mesh"]),yp=class{static write(t,e){let a=t.getGraph(),r=t.getRoot(),s={asset:{generator:`glTF-Transform ${Mc}`,...r.getAsset()},extras:{...r.getExtras()}},n={json:s,resources:{}},i=new Tt(t,n,e),o=e.logger||$r.DEFAULT_INSTANCE,c=new Set(e.extensions.map(d=>d.EXTENSION_NAME)),l=t.getRoot().listExtensionsUsed().filter(d=>c.has(d.extensionName)).sort((d,m)=>d.extensionName>m.extensionName?1:-1),f=t.getRoot().listExtensionsRequired().filter(d=>c.has(d.extensionName)).sort((d,m)=>d.extensionName>m.extensionName?1:-1);l.length<t.getRoot().listExtensionsUsed().length&&o.warn("Some extensions were not registered for I/O, and will not be written.");for(let d of l){let m=d.prewriteTypes.filter(b=>!mp.has(b));m.length&&o.warn(`Prewrite hooks for some types (${m.join()}), requested by extension ${d.extensionName}, are unsupported. Please file an issue or a PR.`);for(let b of d.writeDependencies)d.install(b,e.dependencies[b])}function u(d,m,b,y){let x=[],v=0;for(let S of d){let A=i.createAccessorDef(S);A.bufferView=s.bufferViews.length;let _=S.getArray(),N=X.pad(X.toView(_));A.byteOffset=v,v+=N.byteLength,x.push(N),i.accessorIndexMap.set(S,s.accessors.length),s.accessors.push(A)}let M={buffer:m,byteOffset:b,byteLength:X.concat(x).byteLength};return y&&(M.target=y),s.bufferViews.push(M),{buffers:x,byteLength:v}}function g(d,m,b){let y=d[0].getCount(),x=0;for(let _ of d){let N=i.createAccessorDef(_);N.bufferView=s.bufferViews.length,N.byteOffset=x;let I=_.getElementSize(),C=_.getComponentSize();x+=X.padNumber(I*C),i.accessorIndexMap.set(_,s.accessors.length),s.accessors.push(N)}let v=y*x,M=new ArrayBuffer(v),S=new DataView(M);for(let _=0;_<y;_++){let N=0;for(let I of d){let C=I.getElementSize(),B=I.getComponentSize(),R=I.getComponentType(),j=I.getArray();for(let q=0;q<C;q++){let $=_*x+N+q*B,Z=j[_*C+q];switch(R){case K.ComponentType.FLOAT:S.setFloat32($,Z,!0);break;case K.ComponentType.BYTE:S.setInt8($,Z);break;case K.ComponentType.SHORT:S.setInt16($,Z,!0);break;case K.ComponentType.UNSIGNED_BYTE:S.setUint8($,Z);break;case K.ComponentType.UNSIGNED_SHORT:S.setUint16($,Z,!0);break;case K.ComponentType.UNSIGNED_INT:S.setUint32($,Z,!0);break;case K.ComponentType.FLOAT16:S.setFloat16($,Z,!0);break;case K.ComponentType.FLOAT64:S.setFloat64($,Z,!0);break;default:throw new Error("Unexpected component type: "+R)}}N+=X.padNumber(C*B)}}let A={buffer:m,byteOffset:b,byteLength:v,byteStride:x,target:Tt.BufferViewTarget.ARRAY_BUFFER};return s.bufferViews.push(A),{byteLength:v,buffers:[new Uint8Array(M)]}}function p(d,m,b){let y=[],x=0,v=new Map,M=-1/0,S=!1;for(let R of d){let j=i.createAccessorDef(R);s.accessors.push(j),i.accessorIndexMap.set(R,s.accessors.length-1);let q=[],$=[],Z=[],me=new Array(R.getElementSize()).fill(0);for(let be=0,Te=R.getCount();be<Te;be++)if(R.getElement(be,Z),!fe.eq(Z,me,0)){M=Math.max(be,M),q.push(be);for(let ye=0;ye<Z.length;ye++)$.push(Z[ye])}let se=q.length,ge={accessorDef:j,count:se};if(v.set(R,ge),se===0)continue;se>R.getCount()/2&&(S=!0);let Se=Xr[R.getComponentType()];ge.indices=q,ge.values=new Se($)}if(!Number.isFinite(M))return{buffers:y,byteLength:x};S&&o.warn("Some sparse accessors have >50% non-zero elements, which may increase file size.");let A=M<255?Uint8Array:M<65535?Uint16Array:Uint32Array,_=M<255?gp:M<65535?pp:bp,N={buffer:m,byteOffset:b+x,byteLength:0};for(let R of d){let j=v.get(R);if(j.count===0)continue;j.indicesByteOffset=N.byteLength;let q=X.pad(X.toView(new A(j.indices)));y.push(q),x+=q.byteLength,N.byteLength+=q.byteLength}s.bufferViews.push(N);let I=s.bufferViews.length-1,C={buffer:m,byteOffset:b+x,byteLength:0};for(let R of d){let j=v.get(R);if(j.count===0)continue;j.valuesByteOffset=C.byteLength;let q=X.pad(X.toView(j.values));y.push(q),x+=q.byteLength,C.byteLength+=q.byteLength}s.bufferViews.push(C);let B=s.bufferViews.length-1;for(let R of d){let j=v.get(R);j.count!==0&&(j.accessorDef.sparse={count:j.count,indices:{bufferView:I,byteOffset:j.indicesByteOffset,componentType:_},values:{bufferView:B,byteOffset:j.valuesByteOffset}})}return{buffers:y,byteLength:x}}if(s.accessors=[],s.bufferViews=[],s.samplers=[],s.textures=[],s.images=r.listTextures().map((d,m)=>{let b=i.createPropertyDef(d);d.getMimeType()&&(b.mimeType=d.getMimeType());let y=d.getImage();return y&&i.createImageData(b,y,d),i.imageIndexMap.set(d,m),b}),l.filter(d=>d.prewriteTypes.includes("Accessor")).forEach(d=>d.prewrite(i,"Accessor")),r.listAccessors().forEach(d=>{let m=i.accessorUsageGroupedByParent,b=i.accessorParents;if(i.accessorIndexMap.has(d))return;let y=i.getAccessorUsage(d);if(i.addAccessorToUsageGroup(d,y),m.has(y)){let x=a.listParents(d).find(v=>v.propertyType!=="Root");b.set(d,x)}}),l.filter(d=>d.prewriteTypes.includes("Buffer")).forEach(d=>d.prewrite(i,"Buffer")),(r.listAccessors().length>0||i.otherBufferViews.size>0||r.listTextures().length>0&&e.format==="GLB")&&r.listBuffers().length===0)throw new Error("Buffer required for Document resources, but none was found.");s.buffers=[],r.listBuffers().forEach((d,m)=>{let b=i.createPropertyDef(d),y=i.accessorUsageGroupedByParent,x=d.listParents().filter(I=>I instanceof K),v=new Set(x.map(I=>i.accessorParents.get(I))),M=new Map(Array.from(v).map((I,C)=>[I,C])),S={};for(let I of x){if(i.accessorIndexMap.has(I))continue;let C=i.getAccessorUsage(I),B=C;if(y.has(C)){let R=i.accessorParents.get(I);B+=`:${M.get(R)}`}S[B]||={usage:C,accessors:[]},S[B].accessors.push(I)}let A=[],_=s.buffers.length,N=0;for(let{usage:I,accessors:C}of Object.values(S))if(I===Vr.ARRAY_BUFFER&&e.vertexLayout==="interleaved"){let B=g(C,_,N);N+=B.byteLength;for(let R of B.buffers)A.push(R)}else if(I===Vr.ARRAY_BUFFER)for(let B of C){let R=g([B],_,N);N+=R.byteLength;for(let j of R.buffers)A.push(j)}else if(I===Vr.SPARSE){let B=p(C,_,N);N+=B.byteLength;for(let R of B.buffers)A.push(R)}else if(I===Vr.ELEMENT_ARRAY_BUFFER){let B=Tt.BufferViewTarget.ELEMENT_ARRAY_BUFFER,R=u(C,_,N,B);N+=R.byteLength;for(let j of R.buffers)A.push(j)}else{let B=u(C,_,N);N+=B.byteLength;for(let R of B.buffers)A.push(R)}if(i.imageBufferViews.length&&m===0){for(let I=0;I<i.imageBufferViews.length;I++)if(s.bufferViews[s.images[I].bufferView].byteOffset=N,N+=i.imageBufferViews[I].byteLength,A.push(i.imageBufferViews[I]),N%8){let C=8-N%8;N+=C,A.push(new Uint8Array(C))}}if(i.otherBufferViews.has(d))for(let I of i.otherBufferViews.get(d))s.bufferViews.push({buffer:_,byteOffset:N,byteLength:I.byteLength}),i.otherBufferViewsIndexMap.set(I,s.bufferViews.length-1),N+=I.byteLength,A.push(I);if(N){let I;e.format==="GLB"?I=At:(I=i.bufferURIGenerator.createURI(d,"bin"),b.uri=I),b.byteLength=N,i.assignResourceURI(I,X.concat(A),!0)}s.buffers.push(b),i.bufferIndexMap.set(d,m)}),r.listAccessors().find(d=>!d.getBuffer())&&o.warn("Skipped writing one or more Accessors: no Buffer assigned."),l.filter(d=>d.prewriteTypes.includes("Material")).forEach(d=>d.prewrite(i,"Material")),s.materials=r.listMaterials().map((d,m)=>{let b=i.createPropertyDef(d);if(d.getAlphaMode()!==Wr.AlphaMode.OPAQUE&&(b.alphaMode=d.getAlphaMode()),d.getAlphaMode()===Wr.AlphaMode.MASK&&(b.alphaCutoff=d.getAlphaCutoff()),d.getDoubleSided()&&(b.doubleSided=!0),b.pbrMetallicRoughness={},fe.eq(d.getBaseColorFactor(),[1,1,1,1])||(b.pbrMetallicRoughness.baseColorFactor=d.getBaseColorFactor()),fe.eq(d.getEmissiveFactor(),[0,0,0])||(b.emissiveFactor=d.getEmissiveFactor()),d.getRoughnessFactor()!==1&&(b.pbrMetallicRoughness.roughnessFactor=d.getRoughnessFactor()),d.getMetallicFactor()!==1&&(b.pbrMetallicRoughness.metallicFactor=d.getMetallicFactor()),d.getBaseColorTexture()){let y=d.getBaseColorTexture(),x=d.getBaseColorTextureInfo();b.pbrMetallicRoughness.baseColorTexture=i.createTextureInfoDef(y,x)}if(d.getEmissiveTexture()){let y=d.getEmissiveTexture(),x=d.getEmissiveTextureInfo();b.emissiveTexture=i.createTextureInfoDef(y,x)}if(d.getNormalTexture()){let y=d.getNormalTexture(),x=d.getNormalTextureInfo(),v=i.createTextureInfoDef(y,x);d.getNormalScale()!==1&&(v.scale=d.getNormalScale()),b.normalTexture=v}if(d.getOcclusionTexture()){let y=d.getOcclusionTexture(),x=d.getOcclusionTextureInfo(),v=i.createTextureInfoDef(y,x);d.getOcclusionStrength()!==1&&(v.strength=d.getOcclusionStrength()),b.occlusionTexture=v}if(d.getMetallicRoughnessTexture()){let y=d.getMetallicRoughnessTexture(),x=d.getMetallicRoughnessTextureInfo();b.pbrMetallicRoughness.metallicRoughnessTexture=i.createTextureInfoDef(y,x)}return i.materialIndexMap.set(d,m),b}),l.filter(d=>d.prewriteTypes.includes("Mesh")).forEach(d=>d.prewrite(i,"Mesh")),s.meshes=r.listMeshes().map((d,m)=>{let b=i.createPropertyDef(d),y=null;return b.primitives=d.listPrimitives().map(x=>{let v={attributes:{}};v.mode=x.getMode();let M=x.getMaterial();M&&(v.material=i.materialIndexMap.get(M)),Object.keys(x.getExtras()).length&&(v.extras=x.getExtras());let S=x.getIndices();S&&(v.indices=i.accessorIndexMap.get(S));for(let A of x.listSemantics())v.attributes[A]=i.accessorIndexMap.get(x.getAttribute(A));for(let A of x.listTargets()){let _={};for(let N of A.listSemantics())_[N]=i.accessorIndexMap.get(A.getAttribute(N));v.targets=v.targets||[],v.targets.push(_)}return x.listTargets().length&&!y&&(y=x.listTargets().map(A=>A.getName())),v}),d.getWeights().length&&(b.weights=d.getWeights()),y&&(b.extras=b.extras||{},b.extras.targetNames=y),i.meshIndexMap.set(d,m),b}),s.cameras=r.listCameras().map((d,m)=>{let b=i.createPropertyDef(d);if(b.type=d.getType(),b.type===Jr.Type.PERSPECTIVE){b.perspective={znear:d.getZNear(),zfar:d.getZFar(),yfov:d.getYFov()};let y=d.getAspectRatio();y!==null&&(b.perspective.aspectRatio=y)}else b.orthographic={znear:d.getZNear(),zfar:d.getZFar(),xmag:d.getXMag(),ymag:d.getYMag()};return i.cameraIndexMap.set(d,m),b}),s.nodes=r.listNodes().map((d,m)=>{let b=i.createPropertyDef(d);return fe.eq(d.getTranslation(),[0,0,0])||(b.translation=d.getTranslation()),fe.eq(d.getRotation(),[0,0,0,1])||(b.rotation=d.getRotation()),fe.eq(d.getScale(),[1,1,1])||(b.scale=d.getScale()),d.getWeights().length&&(b.weights=d.getWeights()),i.nodeIndexMap.set(d,m),b}),s.skins=r.listSkins().map((d,m)=>{let b=i.createPropertyDef(d),y=d.getInverseBindMatrices();y&&(b.inverseBindMatrices=i.accessorIndexMap.get(y));let x=d.getSkeleton();return x&&(b.skeleton=i.nodeIndexMap.get(x)),b.joints=d.listJoints().map(v=>i.nodeIndexMap.get(v)),i.skinIndexMap.set(d,m),b}),r.listNodes().forEach((d,m)=>{let b=s.nodes[m],y=d.getMesh();y&&(b.mesh=i.meshIndexMap.get(y));let x=d.getCamera();x&&(b.camera=i.cameraIndexMap.get(x));let v=d.getSkin();v&&(b.skin=i.skinIndexMap.get(v)),d.listChildren().length>0&&(b.children=d.listChildren().map(M=>i.nodeIndexMap.get(M)))}),s.animations=r.listAnimations().map((d,m)=>{let b=i.createPropertyDef(d),y=new Map;return b.samplers=d.listSamplers().map((x,v)=>{let M=i.createPropertyDef(x);return M.input=i.accessorIndexMap.get(x.getInput()),M.output=i.accessorIndexMap.get(x.getOutput()),M.interpolation=x.getInterpolation(),y.set(x,v),M}),b.channels=d.listChannels().map(x=>{let v=i.createPropertyDef(x);return v.sampler=y.get(x.getSampler()),v.target={node:i.nodeIndexMap.get(x.getTargetNode()),path:x.getTargetPath()},v}),i.animationIndexMap.set(d,m),b}),s.scenes=r.listScenes().map((d,m)=>{let b=i.createPropertyDef(d);return b.nodes=d.listChildren().map(y=>i.nodeIndexMap.get(y)),i.sceneIndexMap.set(d,m),b});let h=r.getDefaultScene();return h&&(s.scene=r.listScenes().indexOf(h)),s.extensionsUsed=l.map(d=>d.extensionName),s.extensionsRequired=f.map(d=>d.extensionName),l.forEach(d=>d.write(i)),xp(s),n}};function xp(t){let e=[];for(let a in t){let r=t[a];(Array.isArray(r)&&r.length===0||r===null||r===""||r&&typeof r=="object"&&Object.keys(r).length===0)&&e.push(a)}for(let a of e)delete t[a]}var wp=class{_logger=$r.DEFAULT_INSTANCE;_extensions=new Set;_dependencies={};_vertexLayout="interleaved";_strictResources=!0;lastReadBytes=0;lastWriteBytes=0;setLogger(t){return this._logger=t,this}registerExtensions(t){for(let e of t)this._extensions.add(e),e.register();return this}registerDependencies(t){return Object.assign(this._dependencies,t),this}setVertexLayout(t){return this._vertexLayout=t,this}setStrictResources(t){return this._strictResources=t,this}async read(t){return await this.readJSON(await this.readAsJSON(t))}async readAsJSON(t){let e=await this.readURI(t,"view");this.lastReadBytes=e.byteLength;let a=Ec(e)?this._binaryToJSON(e):{json:JSON.parse(X.decodeText(e)),resources:{}};return await this._readResourcesExternal(a,this.dirname(t)),this._readResourcesInternal(a),a}async readJSON(t){return t=this._copyJSON(t),this._readResourcesInternal(t),dp.read(t,{extensions:Array.from(this._extensions),dependencies:this._dependencies,logger:this._logger})}async binaryToJSON(t){let e=this._binaryToJSON(X.assertView(t));this._readResourcesInternal(e);let a=e.json;if(a.buffers&&a.buffers.some(r=>vp(e,r)))throw new Error("Cannot resolve external buffers with binaryToJSON().");if(a.images&&a.images.some(r=>kp(e,r)))throw new Error("Cannot resolve external images with binaryToJSON().");return e}async readBinary(t){return this.readJSON(await this.binaryToJSON(X.assertView(t)))}async writeJSON(t,e={}){if(e.format==="GLB"&&t.getRoot().listBuffers().length>1)throw new Error("GLB must have 0\u20131 buffers.");return yp.write(t,{format:e.format||"GLTF",basename:e.basename||"",logger:this._logger,vertexLayout:this._vertexLayout,dependencies:{...this._dependencies},extensions:Array.from(this._extensions)})}async writeBinary(t){let{json:e,resources:a}=await this.writeJSON(t,{format:"GLB"}),r=new Uint32Array([1179937895,2,12]),s=JSON.stringify(e),n=X.pad(X.encodeText(s),32),i=X.toView(new Uint32Array([n.byteLength,1313821514])),o=X.concat([i,n]);r[r.length-1]+=o.byteLength;let c=Object.values(a)[0];if(!c||!c.byteLength)return X.concat([X.toView(r),o]);let l=X.pad(c,0),f=X.toView(new Uint32Array([l.byteLength,5130562])),u=X.concat([f,l]);return r[r.length-1]+=u.byteLength,X.concat([X.toView(r),o,u])}async _readResourcesExternal(t,e){let a=t.json.images||[],r=t.json.buffers||[],s=[...a,...r].map(async n=>{let i=n.uri;if(!i||i.match(/data:/))return Promise.resolve();try{t.resources[i]=await this.readURI(this.resolve(e,i),"view"),this.lastReadBytes+=t.resources[i].byteLength}catch(o){if(!this._strictResources&&a.includes(n))this._logger.warn(`Failed to load image URI, "${i}". ${o}`),t.resources[i]=null;else throw o}});await Promise.all(s)}_readResourcesInternal(t){function e(a){if(a.uri){if(a.uri in t.resources){X.assertView(t.resources[a.uri]);return}if(a.uri.match(/data:/)){let r=`__${ap()}.${ma.extension(a.uri)}`;t.resources[r]=X.createBufferFromDataURI(a.uri),a.uri=r}}}(t.json.images||[]).forEach(a=>{if(a.bufferView===void 0&&a.uri===void 0)throw new Error("Missing resource URI or buffer view.");e(a)}),(t.json.buffers||[]).forEach(e)}_copyJSON(t){let{images:e,buffers:a}=t.json;return t={json:{...t.json},resources:{...t.resources}},e&&(t.json.images=e.map(r=>({...r}))),a&&(t.json.buffers=a.map(r=>({...r}))),t}_binaryToJSON(t){if(!Ec(t))throw new Error("Invalid glTF 2.0 binary.");let e=new Uint32Array(t.buffer,t.byteOffset+12,2);if(e[1]!==1313821514)throw new Error("Missing required GLB JSON chunk.");let a=20,r=e[0],s=X.decodeText(X.toView(t,a,r)),n=JSON.parse(s),i=a+r;if(t.byteLength<=i)return{json:n,resources:{}};let o=new Uint32Array(t.buffer,t.byteOffset+i,2);if(o[1]!==5130562)return{json:n,resources:{}};let c=o[0],l=X.toView(t,i+8,c);return{json:n,resources:{[At]:l}}}};function vp(t,e){return e.uri!==void 0&&!(e.uri in t.resources)}function kp(t,e){return e.uri!==void 0&&!(e.uri in t.resources)&&e.bufferView===void 0}function Ec(t){if(t.byteLength<3*Uint32Array.BYTES_PER_ELEMENT)return!1;let e=new Uint32Array(t.buffer,t.byteOffset,3);return e[0]===1179937895&&e[1]===2}var Kc=class extends wp{_fetchConfig;constructor(t=Ln.DEFAULT_INIT){super(),this._fetchConfig=t}async readURI(t,e){let a=await fetch(t,this._fetchConfig);switch(e){case"view":return new Uint8Array(await a.arrayBuffer());case"text":return a.text()}}resolve(t,e){return Ln.resolve(t,e)}dirname(t){return Ln.dirname(t)}};function Ep(){return{vkFormat:0,typeSize:1,pixelWidth:0,pixelHeight:0,pixelDepth:0,layerCount:0,faceCount:1,levelCount:0,supercompressionScheme:0,levels:[],dataFormatDescriptor:[{vendorId:0,descriptorType:0,versionNumber:2,colorModel:0,colorPrimaries:1,transferFunction:2,flags:0,texelBlockDimension:[0,0,0,0],bytesPlane:[0,0,0,0,0,0,0,0],samples:[]}],keyValue:{},globalData:null}}var ta=class{constructor(e,a,r,s){this._dataView=void 0,this._littleEndian=void 0,this._offset=void 0,this._dataView=new DataView(e.buffer,e.byteOffset+a,r),this._littleEndian=s,this._offset=0}_nextUint8(){let e=this._dataView.getUint8(this._offset);return this._offset+=1,e}_nextUint16(){let e=this._dataView.getUint16(this._offset,this._littleEndian);return this._offset+=2,e}_nextUint32(){let e=this._dataView.getUint32(this._offset,this._littleEndian);return this._offset+=4,e}_nextUint64(){let e=this._dataView.getUint32(this._offset,this._littleEndian),a=this._dataView.getUint32(this._offset+4,this._littleEndian),r=e+2**32*a;return this._offset+=8,r}_nextInt32(){let e=this._dataView.getInt32(this._offset,this._littleEndian);return this._offset+=4,e}_nextUint8Array(e){let a=new Uint8Array(this._dataView.buffer,this._dataView.byteOffset+this._offset,e);return this._offset+=e,a}_skip(e){return this._offset+=e,this}_scan(e,a=0){let r=this._offset,s=0;for(;this._dataView.getUint8(this._offset)!==a&&s<e;)s++,this._offset++;return s<e&&this._offset++,new Uint8Array(this._dataView.buffer,this._dataView.byteOffset+r,s)}};var nk=new Uint8Array([0]),Oe=[171,75,84,88,32,50,48,187,13,10,26,10];function Vc(t){return new TextDecoder().decode(t)}function Qr(t){let e=new Uint8Array(t.buffer,t.byteOffset,Oe.length);if(e[0]!==Oe[0]||e[1]!==Oe[1]||e[2]!==Oe[2]||e[3]!==Oe[3]||e[4]!==Oe[4]||e[5]!==Oe[5]||e[6]!==Oe[6]||e[7]!==Oe[7]||e[8]!==Oe[8]||e[9]!==Oe[9]||e[10]!==Oe[10]||e[11]!==Oe[11])throw new Error("Missing KTX 2.0 identifier.");let a=Ep(),r=17*Uint32Array.BYTES_PER_ELEMENT,s=new ta(t,Oe.length,r,!0);a.vkFormat=s._nextUint32(),a.typeSize=s._nextUint32(),a.pixelWidth=s._nextUint32(),a.pixelHeight=s._nextUint32(),a.pixelDepth=s._nextUint32(),a.layerCount=s._nextUint32(),a.faceCount=s._nextUint32(),a.levelCount=s._nextUint32(),a.supercompressionScheme=s._nextUint32();let n=s._nextUint32(),i=s._nextUint32(),o=s._nextUint32(),c=s._nextUint32(),l=s._nextUint64(),f=s._nextUint64(),u=Math.max(a.levelCount,1)*3*8,g=new ta(t,Oe.length+r,u,!0);for(let P=0,D=Math.max(a.levelCount,1);P<D;P++)a.levels.push({levelData:new Uint8Array(t.buffer,t.byteOffset+g._nextUint64(),g._nextUint64()),uncompressedByteLength:g._nextUint64()});let p=new ta(t,n,i,!0);p._skip(4);let h=p._nextUint16(),d=p._nextUint16(),m=p._nextUint16(),b=p._nextUint16(),y=p._nextUint8(),x=p._nextUint8(),v=p._nextUint8(),M=p._nextUint8(),S=[p._nextUint8(),p._nextUint8(),p._nextUint8(),p._nextUint8()],A=[p._nextUint8(),p._nextUint8(),p._nextUint8(),p._nextUint8(),p._nextUint8(),p._nextUint8(),p._nextUint8(),p._nextUint8()],N={vendorId:h,descriptorType:d,versionNumber:m,colorModel:y,colorPrimaries:x,transferFunction:v,flags:M,texelBlockDimension:S,bytesPlane:A,samples:[]},B=(b/4-6)/4;for(let P=0;P<B;P++){let D={bitOffset:p._nextUint16(),bitLength:p._nextUint8(),channelType:p._nextUint8(),samplePosition:[p._nextUint8(),p._nextUint8(),p._nextUint8(),p._nextUint8()],sampleLower:Number.NEGATIVE_INFINITY,sampleUpper:Number.POSITIVE_INFINITY};D.channelType&64?(D.sampleLower=p._nextInt32(),D.sampleUpper=p._nextInt32()):(D.sampleLower=p._nextUint32(),D.sampleUpper=p._nextUint32()),N.samples[P]=D}a.dataFormatDescriptor.length=0,a.dataFormatDescriptor.push(N);let R=new ta(t,o,c,!0);for(;R._offset<c;){let P=R._nextUint32(),D=R._scan(P),Y=Vc(D);if(a.keyValue[Y]=R._nextUint8Array(P-D.byteLength-1),Y.match(/^ktx/i)){let we=Vc(a.keyValue[Y]);a.keyValue[Y]=we.substring(0,we.lastIndexOf("\0"))}let pe=P%4?4-P%4:0;R._skip(pe)}if(f<=0)return a;let j=new ta(t,l,f,!0),q=j._nextUint16(),$=j._nextUint16(),Z=j._nextUint32(),me=j._nextUint32(),se=j._nextUint32(),ge=j._nextUint32(),Se=[];for(let P=0,D=Math.max(a.levelCount,1);P<D;P++)Se.push({imageFlags:j._nextUint32(),rgbSliceByteOffset:j._nextUint32(),rgbSliceByteLength:j._nextUint32(),alphaSliceByteOffset:j._nextUint32(),alphaSliceByteLength:j._nextUint32()});let be=l+j._offset,Te=be+Z,ye=Te+me,Ce=ye+se,Ae=new Uint8Array(t.buffer,t.byteOffset+be,Z),Pa=new Uint8Array(t.buffer,t.byteOffset+Te,me),ua=new Uint8Array(t.buffer,t.byteOffset+ye,se),T=new Uint8Array(t.buffer,t.byteOffset+Ce,ge);return a.globalData={endpointCount:q,selectorCount:$,imageDescs:Se,endpointsData:Ae,selectorsData:Pa,tablesData:ua,extendedData:T},a}var It="EXT_mesh_gpu_instancing",mt="EXT_mesh_features",De="EXT_meshopt_compression",W="EXT_structural_metadata",Zr="EXT_texture_webp",es="EXT_texture_avif",Ip="KHR_accessor_float16",Rp="KHR_accessor_float64",xe="KHR_draco_mesh_compression",gt="KHR_lights_punctual",Rt="KHR_materials_anisotropy",Nt="KHR_materials_clearcoat",Ct="KHR_materials_diffuse_transmission",Bt="KHR_materials_dispersion",Ot="KHR_materials_emissive_strength",Ft="KHR_materials_ior",Pt="KHR_materials_iridescence",jt="KHR_materials_pbrSpecularGlossiness",Lt="KHR_materials_sheen",Dt="KHR_materials_specular",Ut="KHR_materials_transmission",ya="KHR_materials_unlit",zt="KHR_materials_volume",Ve="KHR_materials_variants",qc="KHR_mesh_primitive_restart",Hc="KHR_mesh_quantization",Gt="KHR_node_visibility",ts="KHR_texture_basisu",Kt="KHR_texture_transform",Ze="KHR_xmp_json_ld",Np=class extends J{static EXTENSION_NAME=mt;init(){this.extensionName=mt,this.propertyType="FeatureID",this.parentTypes=["Features"]}getDefaults(){return Object.assign(super.getDefaults(),{nullFeatureId:null,label:"",attribute:null,texture:null,propertyTable:null})}getFeatureCount(){return this.get("featureCount")}setFeatureCount(t){return this.set("featureCount",t)}getNullFeatureID(){return this.get("nullFeatureId")}setNullFeatureID(t){return this.set("nullFeatureId",t)}getLabel(){return this.get("label")}setLabel(t){return this.set("label",t)}getAttribute(){return this.get("attribute")}setAttribute(t){return this.set("attribute",t)}getTexture(){return this.getRef("texture")}setTexture(t){return this.setRef("texture",t)}getPropertyTable(){return this.getRef("propertyTable")}setPropertyTable(t){return this.setRef("propertyTable",t)}},Cp=class extends J{static EXTENSION_NAME=mt;init(){this.extensionName=mt,this.propertyType="FeatureIDTexture",this.parentTypes=["FeatureID"]}getDefaults(){let t=new ue(this.graph,"textureInfo");return t.setMinFilter(ue.MagFilter.NEAREST),t.setMagFilter(ue.MagFilter.NEAREST),Object.assign(super.getDefaults(),{channels:[0],texture:null,textureInfo:t})}getChannels(){return this.get("channels")}setChannels(t){return this.set("channels",t)}getTexture(){return this.getRef("texture")}setTexture(t){return this.setRef("texture",t)}getTextureInfo(){return this.getRef("texture")?this.getRef("textureInfo"):null}},Bp=class extends J{static EXTENSION_NAME=mt;init(){this.extensionName=mt,this.propertyType="Features",this.parentTypes=[F.PRIMITIVE]}getDefaults(){return Object.assign(super.getDefaults(),{featureIds:new ce([])})}listFeatureIDs(){return this.listRefs("featureIds")}addFeatureID(t){return this.addRef("featureIds",t)}removeFeatureID(t){return this.removeRef("featureIds",t)}},Ka=mt,Jn=class extends ie{extensionName=mt;static EXTENSION_NAME=mt;createFeatures(){return new Bp(this.document.getGraph())}createFeatureID(){return new Np(this.document.getGraph())}createFeatureIDTexture(){return new Cp(this.document.getGraph())}read(t){return(t.jsonDoc.json.meshes||[]).forEach((e,a)=>{(e.primitives||[]).forEach((r,s)=>{this._readPrimitive(t,a,r,s)})}),this}_readPrimitive(t,e,a,r){if(!a.extensions||!a.extensions[Ka])return;let s=this.createFeatures(),n=a.extensions[Ka];for(let i of n.featureIds){let o=Op(this.document,this,t,i);s.addFeatureID(o)}t.meshes[e].listPrimitives()[r].setExtension(Ka,s)}write(t){let e=t.jsonDoc.json.meshes;if(!e)return this;for(let a of this.document.getRoot().listMeshes()){let r=e[t.meshIndexMap.get(a)];a.listPrimitives().forEach((s,n)=>{let i=r.primitives[n];this._writePrimitive(t,s,i)})}return this}_writePrimitive(t,e,a){let r=e.getExtension(Ka);if(!r)return;let s={featureIds:[]};r.listFeatureIDs().forEach(n=>{s.featureIds.push(Pp(this.document,t,n))}),a.extensions=a.extensions||{},a.extensions[Ka]=s}};function Op(t,e,a,r){let s=e.createFeatureID().setFeatureCount(r.featureCount);r.nullFeatureId!==void 0&&s.setNullFeatureID(r.nullFeatureId),r.label!==void 0&&s.setLabel(r.label),r.attribute!==void 0&&s.setAttribute(r.attribute);let n=r.texture;if(n!==void 0){let i=Fp(e,a,n);s.setTexture(i)}if(r.propertyTable!==void 0){let i=t.getRoot().getExtension(W).listPropertyTables();s.setPropertyTable(i[r.propertyTable])}return s}function Fp(t,e,a){let r=t.createFeatureIDTexture(),{json:s}=e.jsonDoc;if(a.channels&&r.setChannels(a.channels),a.index!==void 0){let n=s.textures[a.index].source;r.setTexture(e.textures[n]),e.setTextureInfo(r.getTextureInfo(),a)}return r}function Pp(t,e,a){let r=t.getRoot(),s={featureCount:a.getFeatureCount()};if(a.getNullFeatureID()!=null&&(s.nullFeatureId=a.getNullFeatureID()),a.getLabel()&&(s.label=a.getLabel()),a.getAttribute()!=null&&(s.attribute=a.getAttribute()),a.getTexture()){let n=a.getTexture(),i=n.getTexture(),o=n.getTextureInfo();s.texture=e.createTextureInfoDef(i,o);let c=n.getChannels();fe.eq(c,[0])||(s.texture.channels=c)}if(a.getPropertyTable()){let n=r.getExtension(W),i=a.getPropertyTable();s.propertyTable=n.listPropertyTables().indexOf(i)}return s}var Xn="INSTANCE_ATTRIBUTE",jp=class extends J{static EXTENSION_NAME=It;init(){this.extensionName=It,this.propertyType="InstancedMesh",this.parentTypes=[F.NODE]}getDefaults(){return Object.assign(super.getDefaults(),{attributes:new ve})}getAttribute(t){return this.getRefMap("attributes",t)}setAttribute(t,e){return this.setRefMap("attributes",t,e,{usage:Xn})}listAttributes(){return this.listRefMapValues("attributes")}listSemantics(){return this.listRefMapKeys("attributes")}},Lp=class extends ie{static EXTENSION_NAME=It;extensionName=It;prewriteTypes=[F.ACCESSOR];createInstancedMesh(){return new jp(this.document.getGraph())}read(t){return(t.jsonDoc.json.nodes||[]).forEach((e,a)=>{if(!e.extensions||!e.extensions.EXT_mesh_gpu_instancing)return;let r=e.extensions[It],s=this.createInstancedMesh();for(let n in r.attributes)s.setAttribute(n,t.accessors[r.attributes[n]]);t.nodes[a].setExtension(It,s)}),this}prewrite(t){t.accessorUsageGroupedByParent.add(Xn);for(let e of this.properties)for(let a of e.listAttributes())t.addAccessorToUsageGroup(a,Xn);return this}write(t){let e=t.jsonDoc;return this.document.getRoot().listNodes().forEach(a=>{let r=a.getExtension(It);if(r){let s=t.nodeIndexMap.get(a),n=e.json.nodes[s],i={attributes:{}};r.listSemantics().forEach(o=>{let c=r.getAttribute(o);i.attributes[o]=t.accessorIndexMap.get(c)}),n.extensions=n.extensions||{},n.extensions[It]=i}}),this}},Dp=(function(t){return t.QUANTIZE="quantize",t.FILTER="filter",t})({});function Up(t){return!t.extensions||!t.extensions.EXT_meshopt_compression?!1:!!t.extensions[De].fallback}var{BYTE:zp,SHORT:Wc,FLOAT:Gp}=K.ComponentType,{encodeNormalizedInt:Xc,decodeNormalizedInt:$n}=fe;function Kp(t,e,a,r){let{filter:s,bits:n}=r,i={array:t.getArray(),byteStride:t.getElementSize()*t.getComponentSize(),componentType:t.getComponentType(),normalized:t.getNormalized()};if(a!=="ATTRIBUTES")return i;if(s!=="NONE"){let o=t.getNormalized()?Vp(t):new Float32Array(i.array);switch(s){case"EXPONENTIAL":i.byteStride=t.getElementSize()*4,i.componentType=Gp,i.normalized=!1,i.array=e.encodeFilterExp(o,t.getCount(),i.byteStride,n);break;case"OCTAHEDRAL":i.byteStride=n>8?8:4,i.componentType=n>8?Wc:zp,i.normalized=!0,o=t.getElementSize()===3?Hp(o):o,i.array=e.encodeFilterOct(o,t.getCount(),i.byteStride,n);break;case"QUATERNION":i.byteStride=8,i.componentType=Wc,i.normalized=!0,i.array=e.encodeFilterQuat(o,t.getCount(),i.byteStride,n);break;default:throw new Error("Invalid filter.")}i.min=t.getMin([]),i.max=t.getMax([]),t.getNormalized()&&(i.min=i.min.map(c=>$n(c,t.getComponentType())),i.max=i.max.map(c=>$n(c,t.getComponentType()))),i.normalized&&(i.min=i.min.map(c=>Xc(c,i.componentType)),i.max=i.max.map(c=>Xc(c,i.componentType)))}else i.byteStride%4&&(i.array=qp(i.array,t.getElementSize()),i.byteStride=i.array.byteLength/t.getCount());return i}function Vp(t){let e=t.getComponentType(),a=t.getArray(),r=new Float32Array(a.length);for(let s=0;s<a.length;s++)r[s]=$n(a[s],e);return r}function qp(t,e){let a=X.padNumber(t.BYTES_PER_ELEMENT*e)/t.BYTES_PER_ELEMENT,r=t.length/e,s=new t.constructor(r*a);for(let n=0;n*e<t.length;n++)for(let i=0;i<e;i++)s[n*a+i]=t[n*e+i];return s}function Hp(t){let e=new Float32Array(t.length*4/3);for(let a=0,r=t.length/3;a<r;a++)e[a*4]=t[a*3],e[a*4+1]=t[a*3+1],e[a*4+2]=t[a*3+2];return e}function Wp(t,e){return e===Tt.BufferViewUsage.ELEMENT_ARRAY_BUFFER?t.listParents().some(a=>a instanceof Ga&&a.getMode()===Ga.Mode.TRIANGLES)?"TRIANGLES":"INDICES":"ATTRIBUTES"}function Xp(t,e){let a=e.getGraph().listParentEdges(t).filter(r=>!(r.getParent()instanceof qn));for(let r of a){let s=r.getName(),n=r.getAttributes().key||"",i=r.getParent().propertyType===F.PRIMITIVE_TARGET;if(s==="indices")return{filter:"NONE"};if(s==="attributes"){if(n==="POSITION")return{filter:"NONE"};if(n==="TEXCOORD_0")return{filter:"NONE"};if(n.startsWith("JOINTS_"))return{filter:"NONE"};if(n.startsWith("WEIGHTS_"))return{filter:"NONE"};if(n==="NORMAL"||n==="TANGENT")return i?{filter:"NONE"}:{filter:"OCTAHEDRAL",bits:8}}if(s==="output"){let o=ul(t);return o==="rotation"?{filter:"QUATERNION",bits:16}:o==="translation"?{filter:"EXPONENTIAL",bits:12}:o==="scale"?{filter:"EXPONENTIAL",bits:12}:{filter:"NONE"}}if(s==="input")return{filter:"NONE"};if(s==="inverseBindMatrices")return{filter:"NONE"}}return{filter:"NONE"}}function ul(t){for(let e of t.listParents())if(e instanceof Yr){for(let a of e.listParents())if(a instanceof Vn)return a.getTargetPath()}return null}var $c={method:"quantize"},Qn=class extends ie{extensionName=De;prereadTypes=[F.BUFFER,F.PRIMITIVE];prewriteTypes=[F.BUFFER,F.ACCESSOR];readDependencies=["meshopt.decoder"];writeDependencies=["meshopt.encoder"];static EXTENSION_NAME=De;static EncoderMethod=Dp;_decoder=null;_decoderFallbackBufferMap=new Map;_encoder=null;_encoderOptions=$c;_encoderFallbackBuffer=null;_encoderBufferViews={};_encoderBufferViewData={};_encoderBufferViewAccessors={};install(t,e){return t==="meshopt.decoder"&&(this._decoder=e),t==="meshopt.encoder"&&(this._encoder=e),this}setEncoderOptions(t){return this._encoderOptions={...$c,...t},this}preread(t,e){if(!this._decoder){if(!this.isRequired())return this;throw new Error(`[${De}] Please install extension dependency, "meshopt.decoder".`)}if(!this._decoder.supported){if(!this.isRequired())return this;throw new Error(`[${De}]: Missing WASM support.`)}return e===F.BUFFER?this._prereadBuffers(t):e===F.PRIMITIVE&&this._prereadPrimitives(t),this}_prereadBuffers(t){let e=t.jsonDoc;(e.json.bufferViews||[]).forEach((a,r)=>{if(!a.extensions||!a.extensions.EXT_meshopt_compression)return;let s=a.extensions[De],n=s.byteOffset||0,i=s.byteLength||0,o=s.count,c=s.byteStride,l=new Uint8Array(o*c),f=e.json.buffers[s.buffer],u=f.uri?e.resources[f.uri]:e.resources[At],g=X.toView(u,n,i);this._decoder.decodeGltfBuffer(l,o,c,g,s.mode,s.filter),t.bufferViews[r]=l})}_prereadPrimitives(t){let e=t.jsonDoc;(e.json.bufferViews||[]).forEach(a=>{if(!a.extensions||!a.extensions.EXT_meshopt_compression)return;let r=a.extensions[De],s=t.buffers[r.buffer],n=t.buffers[a.buffer],i=e.json.buffers[a.buffer];Up(i)&&this._decoderFallbackBufferMap.set(n,s)})}read(t){if(!this.isRequired())return this;for(let[e,a]of this._decoderFallbackBufferMap){for(let r of e.listParents())r instanceof K&&r.swap(e,a);e.dispose()}return this}prewrite(t,e){return e===F.ACCESSOR?this._prewriteAccessors(t):e===F.BUFFER&&this._prewriteBuffers(t),this}_prewriteAccessors(t){let e=t.jsonDoc.json,a=this._encoder,r=this._encoderOptions,s=this.document.getGraph(),n=this.document.createBuffer(),i=this.document.getRoot().listBuffers().indexOf(n),o=1,c=new Map,l=f=>{for(let u of s.listParents(f)){if(u.propertyType===F.ROOT)continue;let g=c.get(f);return g===void 0&&c.set(f,g=o++),g}return-1};this._encoderFallbackBuffer=n,this._encoderBufferViews={},this._encoderBufferViewData={},this._encoderBufferViewAccessors={};for(let f of this.document.getRoot().listAccessors()){if(ul(f)==="weights"||f.getSparse())continue;let u=t.getAccessorUsage(f),g=t.accessorUsageGroupedByParent.has(u)?l(f):null,p=Wp(f,u),h=r.method==="filter"?Xp(f,this.document):{filter:"NONE"},d=Kp(f,a,p,h),{array:m,byteStride:b}=d,y=f.getBuffer();if(!y)throw new Error(`${De}: Missing buffer for accessor.`);let x=this.document.getRoot().listBuffers().indexOf(y),v=[u,g,p,h.filter,b,x].join(":"),M=this._encoderBufferViews[v],S=this._encoderBufferViewData[v],A=this._encoderBufferViewAccessors[v];(!M||!S)&&(A=this._encoderBufferViewAccessors[v]=[],S=this._encoderBufferViewData[v]=[],M=this._encoderBufferViews[v]={buffer:i,target:Tt.USAGE_TO_TARGET[u],byteOffset:0,byteLength:0,byteStride:u===Tt.BufferViewUsage.ARRAY_BUFFER?b:void 0,extensions:{[De]:{buffer:x,byteOffset:0,byteLength:0,mode:p,filter:h.filter!=="NONE"?h.filter:void 0,byteStride:b,count:0}}});let _=t.createAccessorDef(f);_.componentType=d.componentType,_.normalized=d.normalized,_.byteOffset=M.byteLength,_.min&&d.min&&(_.min=d.min),_.max&&d.max&&(_.max=d.max),t.accessorIndexMap.set(f,e.accessors.length),e.accessors.push(_),A.push(_),S.push(new Uint8Array(m.buffer,m.byteOffset,m.byteLength)),M.byteLength+=m.byteLength,M.extensions.EXT_meshopt_compression.count+=f.getCount()}}_prewriteBuffers(t){let e=this._encoder;for(let a in this._encoderBufferViews){let r=this._encoderBufferViews[a],s=this._encoderBufferViewData[a],n=this.document.getRoot().listBuffers()[r.extensions[De].buffer],i=t.otherBufferViews.get(n)||[],{count:o,byteStride:c,mode:l}=r.extensions[De],f=X.concat(s),u=e.encodeGltfBuffer(f,o,c,l),g=X.pad(u);r.extensions[De].byteLength=u.byteLength,s.length=0,s.push(g),i.push(g),t.otherBufferViews.set(n,i)}}write(t){let e=0;for(let n in this._encoderBufferViews){let i=this._encoderBufferViews[n],o=this._encoderBufferViewData[n][0],c=t.otherBufferViewsIndexMap.get(o),l=this._encoderBufferViewAccessors[n];for(let p of l)p.bufferView=c;let f=t.jsonDoc.json.bufferViews[c],u=f.byteOffset||0;Object.assign(f,i),f.byteOffset=e;let g=f.extensions[De];g.byteOffset=u,e+=X.padNumber(i.byteLength)}let a=this._encoderFallbackBuffer,r=t.bufferIndexMap.get(a),s=t.jsonDoc.json.buffers[r];return s.byteLength=e,s.extensions={[De]:{fallback:!0}},a.dispose(),this}},$p=class extends J{static EXTENSION_NAME=W;init(){this.extensionName=W,this.propertyType="StructuralMetadata",this.parentTypes=[F.ROOT]}getDefaults(){return Object.assign(super.getDefaults(),{schema:null,schemaUri:"",propertyTables:new _e,propertyTextures:new _e,propertyAttributes:new _e})}getSchema(){return this.getRef("schema")}setSchema(t){return this.setRef("schema",t)}getSchemaUri(){return this.get("schemaUri")}setSchemaUri(t){return this.set("schemaUri",t)}listPropertyTables(){return this.listRefs("propertyTables")}addPropertyTable(t){return this.addRef("propertyTables",t)}removePropertyTable(t){return this.removeRef("propertyTables",t)}listPropertyTextures(){return this.listRefs("propertyTextures")}addPropertyTexture(t){return this.addRef("propertyTextures",t)}removePropertyTexture(t){return this.removeRef("propertyTextures",t)}listPropertyAttributes(){return this.listRefs("propertyAttributes")}addPropertyAttribute(t){return this.addRef("propertyAttributes",t)}removePropertyAttribute(t){return this.removeRef("propertyAttributes",t)}},Yp=class extends J{static EXTENSION_NAME=W;init(){this.extensionName=W,this.propertyType="Schema",this.parentTypes=["StructuralMetadata"]}getDefaults(){return Object.assign(super.getDefaults(),{description:"",version:"",classes:new ve,enums:new ve})}getId(){return this.get("id")}setId(t){return this.set("id",t)}getDescription(){return this.get("description")}setDescription(t){return this.set("description",t)}getVersion(){return this.get("version")}setVersion(t){return this.set("version",t)}setClass(t,e){return this.setRefMap("classes",t,e)}getClass(t){return this.getRefMap("classes",t)}listClassKeys(){return this.listRefMapKeys("classes")}listClassValues(){return this.listRefMapValues("classes")}setEnum(t,e){return this.setRefMap("enums",t,e)}getEnum(t){return this.getRefMap("enums",t)}listEnumKeys(){return this.listRefMapKeys("enums")}listEnumValues(){return this.listRefMapValues("enums")}},Jp=class extends J{static EXTENSION_NAME=W;init(){this.extensionName=W,this.propertyType="Class",this.parentTypes=["Schema"]}getDefaults(){return Object.assign(super.getDefaults(),{description:"",properties:new ve})}getDescription(){return this.get("description")}setDescription(t){return this.set("description",t)}setProperty(t,e){return this.setRefMap("properties",t,e)}getProperty(t){return this.getRefMap("properties",t)}listPropertyKeys(){return this.listRefMapKeys("properties")}listPropertyValues(){return this.listRefMapValues("properties")}},Qp=class extends J{static EXTENSION_NAME=W;init(){this.extensionName=W,this.propertyType="ClassProperty",this.parentTypes=["Class"]}getDefaults(){return Object.assign(super.getDefaults(),{description:"",componentType:null,enumType:null,array:null,count:null,normalized:null,offset:null,scale:null,max:null,min:null,required:null,noData:null,default:null})}getDescription(){return this.get("description")}setDescription(t){return this.set("description",t)}getType(){return this.get("type")}setType(t){return this.set("type",t)}getComponentType(){return this.get("componentType")}setComponentType(t){return this.set("componentType",t)}getEnumType(){return this.get("enumType")}setEnumType(t){return this.set("enumType",t)}getArray(){return this.get("array")}setArray(t){return this.set("array",t)}getCount(){return this.get("count")}setCount(t){return this.set("count",t)}getNormalized(){return this.get("normalized")}setNormalized(t){return this.set("normalized",t)}getOffset(){return this.get("offset")}setOffset(t){return this.set("offset",t)}getScale(){return this.get("scale")}setScale(t){return this.set("scale",t)}getMax(){return this.get("max")}setMax(t){return this.set("max",t)}getMin(){return this.get("min")}setMin(t){return this.set("min",t)}getRequired(){return this.get("required")}setRequired(t){return this.set("required",t)}getNoData(){return this.get("noData")}setNoData(t){return this.set("noData",t)}getDefault(){return this.get("default")}setDefault(t){return this.set("default",t)}},Zp=class extends J{static EXTENSION_NAME=W;init(){this.extensionName=W,this.propertyType="Enum",this.parentTypes=["Schema"]}getDefaults(){return Object.assign(super.getDefaults(),{description:"",valueType:"UINT16",values:new _e})}getDescription(){return this.get("description")}setDescription(t){return this.set("description",t)}getValueType(){return this.get("valueType")}setValueType(t){return this.set("valueType",t)}listValues(){return this.listRefs("values")}addEnumValue(t){return this.addRef("values",t)}removeEnumValue(t){return this.removeRef("values",t)}},eg=class extends J{static EXTENSION_NAME=W;init(){this.extensionName=W,this.propertyType="EnumValue",this.parentTypes=["Enum"]}getDefaults(){return Object.assign(super.getDefaults(),{description:null})}getDescription(){return this.get("description")}setDescription(t){return this.set("description",t)}getValue(){return this.get("value")}setValue(t){return this.set("value",t)}},tg=class extends J{static EXTENSION_NAME=W;init(){this.extensionName=W,this.propertyType="PropertyTable",this.parentTypes=["StructuralMetadata"]}getDefaults(){return Object.assign(super.getDefaults(),{properties:new ve})}getClass(){return this.get("class")}setClass(t){return this.set("class",t)}getCount(){return this.get("count")}setCount(t){return this.set("count",t)}setProperty(t,e){return this.setRefMap("properties",t,e)}getProperty(t){return this.getRefMap("properties",t)}listPropertyKeys(){return this.listRefMapKeys("properties")}listPropertyValues(){return this.listRefMapValues("properties")}},ag=class extends J{static EXTENSION_NAME=W;init(){this.extensionName=W,this.propertyType="PropertyTableProperty",this.parentTypes=["PropertyTable"]}getDefaults(){return Object.assign(super.getDefaults(),{arrayOffsets:null,stringOffsets:null,arrayOffsetType:null,stringOffsetType:null,offset:null,scale:null,max:null,min:null})}getValues(){return this.get("values")}setValues(t){return this.set("values",t)}getArrayOffsets(){return this.get("arrayOffsets")}setArrayOffsets(t){return this.set("arrayOffsets",t)}getStringOffsets(){return this.get("stringOffsets")}setStringOffsets(t){return this.set("stringOffsets",t)}getArrayOffsetType(){return this.get("arrayOffsetType")}setArrayOffsetType(t){return this.set("arrayOffsetType",t)}getStringOffsetType(){return this.get("stringOffsetType")}setStringOffsetType(t){return this.set("stringOffsetType",t)}getOffset(){return this.get("offset")}setOffset(t){return this.set("offset",t)}getScale(){return this.get("scale")}setScale(t){return this.set("scale",t)}getMax(){return this.get("max")}setMax(t){return this.set("max",t)}getMin(){return this.get("min")}setMin(t){return this.set("min",t)}},rg=class extends J{static EXTENSION_NAME=W;init(){this.extensionName=W,this.propertyType="PropertyTexture",this.parentTypes=["StructuralMetadata"]}getDefaults(){return Object.assign(super.getDefaults(),{properties:new ve})}getClass(){return this.get("class")}setClass(t){return this.set("class",t)}setProperty(t,e){return this.setRefMap("properties",t,e)}getProperty(t){return this.getRefMap("properties",t)}listPropertyKeys(){return this.listRefMapKeys("properties")}listPropertyValues(){return this.listRefMapValues("properties")}},sg=class extends J{static EXTENSION_NAME=W;init(){this.extensionName=W,this.propertyType="PropertyTextureProperty",this.parentTypes=["PropertyTexture"]}getDefaults(){let t=new ue(this.graph,"textureInfo");return t.setMinFilter(ue.MagFilter.NEAREST),t.setMagFilter(ue.MagFilter.NEAREST),Object.assign(super.getDefaults(),{channels:[0],texture:null,textureInfo:t,offset:null,scale:null,max:null,min:null})}getChannels(){return this.get("channels")}setChannels(t){return this.set("channels",t)}getTexture(){return this.getRef("texture")}setTexture(t){return this.setRef("texture",t)}getTextureInfo(){return this.getRef("texture")?this.getRef("textureInfo"):null}getOffset(){return this.get("offset")}setOffset(t){return this.set("offset",t)}getScale(){return this.get("scale")}setScale(t){return this.set("scale",t)}getMax(){return this.get("max")}setMax(t){return this.set("max",t)}getMin(){return this.get("min")}setMin(t){return this.set("min",t)}},ng=class extends J{static EXTENSION_NAME=W;init(){this.extensionName=W,this.propertyType="PropertyAttribute",this.parentTypes=["StructuralMetadata"]}getDefaults(){return Object.assign(super.getDefaults(),{properties:new ve})}getClass(){return this.get("class")}setClass(t){return this.set("class",t)}setProperty(t,e){return this.setRefMap("properties",t,e)}getProperty(t){return this.getRefMap("properties",t)}listPropertyKeys(){return this.listRefMapKeys("properties")}listPropertyValues(){return this.listRefMapValues("properties")}},ig=class extends J{static EXTENSION_NAME=W;init(){this.extensionName=W,this.propertyType="PropertyAttributeProperty",this.parentTypes=["PropertyAttribute"]}getDefaults(){return Object.assign(super.getDefaults(),{offset:null,scale:null,max:null,min:null})}getAttribute(){return this.get("attribute")}setAttribute(t){return this.set("attribute",t)}getOffset(){return this.get("offset")}setOffset(t){return this.set("offset",t)}getScale(){return this.get("scale")}setScale(t){return this.set("scale",t)}getMax(){return this.get("max")}setMax(t){return this.set("max",t)}getMin(){return this.get("min")}setMin(t){return this.set("min",t)}},og=class extends J{static EXTENSION_NAME=W;init(){this.extensionName=W,this.propertyType="NodeStructuralMetadata",this.parentTypes=[F.NODE]}getDefaults(){return Object.assign(super.getDefaults(),{class:"",properties:{}})}getClass(){return this.get("class")}setClass(t){return this.set("class",t)}getProperties(){return this.get("properties")}setProperties(t){return this.set("properties",t)}},cg=class extends J{static EXTENSION_NAME=W;init(){this.extensionName=W,this.propertyType="MeshPrimitiveStructuralMetadata",this.parentTypes=[F.PRIMITIVE]}getDefaults(){return Object.assign(super.getDefaults(),{propertyTextures:new _e,propertyAttributes:new _e})}listPropertyTextures(){return this.listRefs("propertyTextures")}addPropertyTexture(t){return this.addRef("propertyTextures",t)}removePropertyTexture(t){return this.removeRef("propertyTextures",t)}listPropertyAttributes(){return this.listRefs("propertyAttributes")}addPropertyAttribute(t){return this.addRef("propertyAttributes",t)}removePropertyAttribute(t){return this.removeRef("propertyAttributes",t)}},lg=class extends ie{extensionName=W;static EXTENSION_NAME=W;prewriteTypes=[F.BUFFER];prereadTypes=[F.SCENE];createStructuralMetadata(){return new $p(this.document.getGraph())}createSchema(){return new Yp(this.document.getGraph())}createClass(){return new Jp(this.document.getGraph())}createClassProperty(){return new Qp(this.document.getGraph())}createEnum(){return new Zp(this.document.getGraph())}createEnumValue(){return new eg(this.document.getGraph())}createPropertyTable(){return new tg(this.document.getGraph())}createPropertyTableProperty(){return new ag(this.document.getGraph())}createPropertyTexture(){return new rg(this.document.getGraph())}createPropertyTextureProperty(){return new sg(this.document.getGraph())}createPropertyAttribute(){return new ng(this.document.getGraph())}createPropertyAttributeProperty(){return new ig(this.document.getGraph())}createNodeStructuralMetadata(){return new og(this.document.getGraph())}createMeshPrimitiveStructuralMetadata(){return new cg(this.document.getGraph())}read(t){return this}preread(t){let e=this.document.getRoot(),{json:a}=t.jsonDoc,r=a.extensions[W],s=dg(this,t,r);return e.setExtension(W,s),(a.meshes||[]).forEach((n,i)=>{let o=t.meshes[i].listPrimitives();(n.primitives||[]).forEach((c,l)=>{let f=o[l];this._readPrimitive(s,f,c)})}),(a.nodes||[]).forEach((n,i)=>{this._readNode(t.nodes[i],n)}),this}_readPrimitive(t,e,a){if(!a.extensions||!a.extensions.EXT_structural_metadata)return;let r=this.createMeshPrimitiveStructuralMetadata(),s=a.extensions[W],n=t.listPropertyTextures(),i=s.propertyTextures||[];for(let l of i){let f=n[l];r.addPropertyTexture(f)}let o=t.listPropertyAttributes(),c=s.propertyAttributes||[];for(let l of c){let f=o[l];r.addPropertyAttribute(f)}e.setExtension(W,r)}_readNode(t,e){if(!e.extensions||!e.extensions.EXT_structural_metadata)return;let a=e.extensions[W],r=this.createNodeStructuralMetadata().setClass(a.class).setProperties(a.properties);t.setExtension(W,r)}write(t){let e=this.document.getRoot(),a=e.getExtension(W);if(!a)return this;let r=t.jsonDoc.json,s=kg(t,a);r.extensions=r.extensions||{},r.extensions[W]=s;let n=e.listMeshes(),i=r.meshes;if(i)for(let l of n){let f=i[t.meshIndexMap.get(l)];l.listPrimitives().forEach((u,g)=>{let p=f.primitives[g];this._writePrimitive(a,u,p)})}let o=e.listNodes(),c=r.nodes;if(c)for(let l of o){let f=t.nodeIndexMap.get(l);this._writeNode(l,c[f])}return this}_writePrimitive(t,e,a){let r=e.getExtension(W);if(!r)return;let s=t.listPropertyTextures(),n=t.listPropertyAttributes(),i,o,c=r.listPropertyTextures();if(c.length>0){i=[];for(let u of c){let g=s.indexOf(u);if(g>=0)i.push(g);else throw new Error(`${W}: Invalid property texture in mesh primitive`)}}let l=r.listPropertyAttributes();if(l.length>0){o=[];for(let u of l){let g=n.indexOf(u);if(g>=0)o.push(g);else throw new Error(`${W}: Invalid property attribute in mesh primitive`)}}let f={propertyTextures:i,propertyAttributes:o};a.extensions=a.extensions||{},a.extensions[W]=f}_writeNode(t,e){let a=t.getExtension("EXT_structural_metadata");a&&(e.extensions=e.extensions||{},e.extensions[W]={class:a.getClass(),properties:a.getProperties()})}prewrite(t,e){return e===F.BUFFER&&this._prewriteBuffers(t),this}_prewriteBuffers(t){let e=this.document,a=e.getRoot().getExtension(W);t.jsonDoc.json.bufferViews||=[];for(let r of a.listPropertyTables())for(let s of r.listPropertyValues()){let n=Og(e,t);n.push(s.getValues());let i=s.getArrayOffsets();i&&n.push(i);let o=s.getStringOffsets();o&&n.push(o)}}};function dg(t,e,a){let r=t.createStructuralMetadata();if(a.schema!==void 0){let o=ug(t,a.schema);r.setSchema(o)}else if(a.schemaUri){let o=a.schemaUri;r.setSchemaUri(o)}let s=a.propertyTextures||[];for(let o of s){let c=gg(t,e,o);r.addPropertyTexture(c)}let n=a.propertyTables||[];for(let o of n){let c=yg(t,e,o);r.addPropertyTable(c)}let i=a.propertyAttributes||[];for(let o of i){let c=wg(t,o);r.addPropertyAttribute(c)}return r}function ug(t,e){let a=t.createSchema().setId(e.id);e.name!==void 0&&a.setName(e.name),e.description!==void 0&&a.setDescription(e.description),e.version!==void 0&&a.setVersion(e.version);let r=e.classes||{};for(let n of Object.keys(r)){let i=r[n];a.setClass(n,fg(t,i))}let s=e.enums||{};for(let n of Object.keys(s))a.setEnum(n,bg(t,s[n]));return a}function fg(t,e){let a=t.createClass();e.name!==void 0&&a.setName(e.name),e.description!==void 0&&a.setDescription(e.description);let r=e.properties||{};for(let s of Object.keys(r)){let n=hg(t,r[s]);a.setProperty(s,n)}return a}function hg(t,e){let a=t.createClassProperty().setType(e.type);return e.name!==void 0&&a.setName(e.name),e.description!==void 0&&a.setDescription(e.description),e.componentType!==void 0&&a.setComponentType(e.componentType),e.enumType!==void 0&&a.setEnumType(e.enumType),e.array!==void 0&&a.setArray(e.array),e.count!==void 0&&a.setCount(e.count),e.normalized!==void 0&&a.setNormalized(e.normalized),e.offset!==void 0&&a.setOffset(e.offset),e.scale!==void 0&&a.setScale(e.scale),e.max!==void 0&&a.setMax(e.max),e.min!==void 0&&a.setMin(e.min),e.required!==void 0&&a.setRequired(e.required),e.noData!==void 0&&a.setNoData(e.noData),e.default!==void 0&&a.setDefault(e.default),a}function bg(t,e){let a=t.createEnum();e.name!==void 0&&a.setName(e.name),e.description!==void 0&&a.setDescription(e.description),e.valueType!==void 0&&a.setValueType(e.valueType);let r=e.values||{};for(let s of r)a.addEnumValue(pg(t,s));return a}function pg(t,e){let a=t.createEnumValue();return e.name!==void 0&&a.setName(e.name),e.description!==void 0&&a.setDescription(e.description),e.value!==void 0&&a.setValue(e.value),a}function gg(t,e,a){let r=t.createPropertyTexture();r.setClass(a.class),a.name!==void 0&&r.setName(a.name);let s=a.properties||{};for(let n of Object.keys(s)){let i=mg(t,e,s[n]);r.setProperty(n,i)}return r}function mg(t,e,a){let r=t.createPropertyTextureProperty(),s=e.jsonDoc.json.textures||[];a.channels&&r.setChannels(a.channels);let n=s[a.index].source;if(n!==void 0){let i=e.textures[n];r.setTexture(i);let o=r.getTextureInfo();o&&e.setTextureInfo(o,a)}return a.offset!==void 0&&r.setOffset(a.offset),a.scale!==void 0&&r.setScale(a.scale),a.max!==void 0&&r.setMax(a.max),a.min!==void 0&&r.setMin(a.min),r}function yg(t,e,a){let r=t.createPropertyTable().setClass(a.class).setCount(a.count);a.name!==void 0&&r.setName(a.name);let s=a.properties||{};for(let n of Object.keys(s)){let i=xg(t,e,s[n]);r.setProperty(n,i)}return r}function xg(t,e,a){let r=t.createPropertyTableProperty(),s=Hn(e,a.values);if(r.setValues(s),a.arrayOffsets!==void 0){let n=Hn(e,a.arrayOffsets);r.setArrayOffsets(n)}if(a.stringOffsets!==void 0){let n=Hn(e,a.stringOffsets);r.setStringOffsets(n)}return a.arrayOffsetType!==void 0&&r.setArrayOffsetType(a.arrayOffsetType),a.stringOffsetType!==void 0&&r.setStringOffsetType(a.stringOffsetType),a.offset!==void 0&&r.setOffset(a.offset),a.scale!==void 0&&r.setScale(a.scale),a.max!==void 0&&r.setMax(a.max),a.min!==void 0&&r.setMin(a.min),r}function wg(t,e){let a=t.createPropertyAttribute();a.setClass(e.class),e.name!==void 0&&a.setName(e.name);let r=e.properties||{};for(let s of Object.keys(r)){let n=vg(t,r[s]);a.setProperty(s,n)}return a}function vg(t,e){let a=t.createPropertyAttributeProperty();return a.setAttribute(e.attribute),e.offset!==void 0&&a.setOffset(e.offset),e.scale!==void 0&&a.setScale(e.scale),e.max!==void 0&&a.setMax(e.max),e.min!==void 0&&a.setMin(e.min),a}function kg(t,e){let a={},r=e.getSchema();r&&(a.schema=Eg(r));let s=e.getSchemaUri();s&&(a.schemaUri=s);let n=e.listPropertyTables();if(n.length>0){let c=[];for(let l of n){let f=_g(t,l);c.push(f)}a.propertyTables=c}let i=e.listPropertyTextures();if(i.length>0){let c=[];for(let l of i){let f=Cg(t,l);c.push(f)}a.propertyTextures=c}let o=e.listPropertyAttributes();if(o.length>0){let c=[];for(let l of o){let f=Rg(l);c.push(f)}a.propertyAttributes=c}return a}function Eg(t){let e={id:t.getId()},a=t.listClassKeys();if(a.length>0){e.classes={};for(let s of a){let n=Mg(t.getClass(s));e.classes[s]=n}}let r=t.listEnumKeys();if(r.length>0){e.enums={};for(let s of r){let n=Tg(t.getEnum(s));e.enums[s]=n}}return t.getName()&&(e.name=t.getName()),t.getDescription()&&(e.description=t.getDescription()),t.getVersion()&&(e.version=t.getVersion()),e}function Mg(t){let e={},a=t.listPropertyKeys();if(a.length>0){e.properties={};for(let r of a){let s=t.getProperty(r);e.properties[r]=Sg(s)}}return t.getName()&&(e.name=t.getName()),t.getDescription()&&(e.description=t.getDescription()),e}function Sg(t){let e={type:t.getType()};return t.getArray()&&(e.array=t.getArray()),t.getNormalized()&&(e.normalized=t.getNormalized()),t.getRequired()&&(e.required=t.getRequired()),t.getName()&&(e.name=t.getName()),t.getDescription()&&(e.description=t.getDescription()),t.getComponentType()!=null&&(e.componentType=t.getComponentType()),t.getEnumType()!=null&&(e.enumType=t.getEnumType()),t.getCount()!=null&&(e.count=t.getCount()),t.getOffset()!=null&&(e.offset=t.getOffset()),t.getScale()!=null&&(e.scale=t.getScale()),t.getMax()!=null&&(e.max=t.getMax()),t.getMin()!=null&&(e.min=t.getMin()),t.getNoData()!=null&&(e.noData=t.getNoData()),t.getDefault()!=null&&(e.default=t.getDefault()),e}function Tg(t){let e={values:t.listValues().map(Ag)};return t.getName()&&(e.name=t.getName()),t.getDescription()&&(e.description=t.getDescription()),t.getValueType()!=="UINT16"&&(e.valueType=t.getValueType()),e}function Ag(t){let e={name:t.getName(),value:t.getValue()};return t.getDescription()&&(e.description=t.getDescription()),e}function _g(t,e){let a={class:e.getClass(),count:e.getCount()};e.getName()&&(a.name=e.getName());let r=e.listPropertyKeys();if(r.length>0){a.properties={};for(let s of r){let n=Ig(t,e.getProperty(s));a.properties[s]=n}}return a}function Ig(t,e){let a=e.getValues(),r={values:t.otherBufferViewsIndexMap.get(a)};if(e.getArrayOffsets()){let s=e.getArrayOffsets();r.arrayOffsets=t.otherBufferViewsIndexMap.get(s)}if(e.getStringOffsets()){let s=e.getStringOffsets();r.stringOffsets=t.otherBufferViewsIndexMap.get(s)}return e.getArrayOffsetType()!=null&&(r.arrayOffsetType=e.getArrayOffsetType()),e.getStringOffsetType()!=null&&(r.stringOffsetType=e.getStringOffsetType()),e.getOffset()!=null&&(r.offset=e.getOffset()),e.getScale()!=null&&(r.scale=e.getScale()),e.getMax()!=null&&(r.max=e.getMax()),e.getMin()!=null&&(r.min=e.getMin()),r}function Rg(t){let e={class:t.getClass()};t.getName()&&(e.name=t.getName());let a=t.listPropertyKeys();if(a.length>0){e.properties={};for(let r of a){let s=Ng(t.getProperty(r));e.properties[r]=s}}return e}function Ng(t){let e={attribute:t.getAttribute()};return t.getOffset()!=null&&(e.offset=t.getOffset()),t.getScale()!=null&&(e.scale=t.getScale()),t.getMax()!=null&&(e.max=t.getMax()),t.getMin()!=null&&(e.min=t.getMin()),e}function Cg(t,e){let a={class:e.getClass()};e.getName()&&(a.name=e.getName());let r=e.listPropertyKeys();if(r.length>0){a.properties={};for(let s of r){let n=Bg(t,e.getProperty(s));a.properties[s]=n}}return a}function Bg(t,e){let a=e.getTexture(),r=e.getTextureInfo(),s=e.getChannels(),n=t.createTextureInfoDef(a,r);return fe.eq(s,[0])||(n.channels=s),e.getOffset()!=null&&(n.offset=e.getOffset()),e.getScale()!=null&&(n.scale=e.getScale()),e.getMax()!=null&&(n.max=e.getMax()),e.getMin()!=null&&(n.min=e.getMin()),n}function Hn(t,e){let a=t.jsonDoc,r=a.json.buffers||[],s=(a.json.bufferViews||[])[e],n=r[s.buffer],i=n.uri?a.resources[n.uri]:a.resources[At],o=s.byteOffset||0,c=s.byteLength;return i.slice(o,o+c)}function Og(t,e){let a=t.getRoot().listBuffers()[0],r=e.otherBufferViews.get(a);return r||(r=[],e.otherBufferViews.set(a,r)),r}var Fg=class{match(t){return t.length>=12&&X.decodeText(t.slice(4,12))==="ftypavif"}getSize(t){if(!this.match(t))return null;let e=new DataView(t.buffer,t.byteOffset,t.byteLength),a=Yc(e,0);if(!a)return null;let r=a.end;for(;a=Yc(e,r);)if(a.type==="meta")r=a.start+4;else if(a.type==="iprp"||a.type==="ipco")r=a.start;else{if(a.type==="ispe")return[e.getUint32(a.start+4),e.getUint32(a.start+8)];if(a.type==="mdat")break;r=a.end}return null}getChannels(t){return 4}},Pg=class extends ie{extensionName=es;prereadTypes=[F.TEXTURE];static EXTENSION_NAME=es;static register(){ot.registerFormat("image/avif",new Fg)}preread(t){return(t.jsonDoc.json.textures||[]).forEach(e=>{e.extensions&&e.extensions.EXT_texture_avif&&(e.source=e.extensions[es].source)}),this}read(t){return this}write(t){let e=t.jsonDoc;return this.document.getRoot().listTextures().forEach(a=>{if(a.getMimeType()==="image/avif"){let r=t.imageIndexMap.get(a);(e.json.textures||[]).forEach(s=>{s.source===r&&(s.extensions=s.extensions||{},s.extensions[es]={source:s.source},delete s.source)})}}),this}};function Yc(t,e){if(t.byteLength<4+e)return null;let a=t.getUint32(e);return t.byteLength<a+e||a<8?null:{type:X.decodeText(new Uint8Array(t.buffer,t.byteOffset+e+4,4)),start:e+8,end:e+a}}var jg=class{match(t){return t.length>=12&&t[8]===87&&t[9]===69&&t[10]===66&&t[11]===80}getSize(t){let e=X.decodeText(t.slice(0,4)),a=X.decodeText(t.slice(8,12));if(e!=="RIFF"||a!=="WEBP")return null;let r=new DataView(t.buffer,t.byteOffset),s=12;for(;s<r.byteLength;){let n=X.decodeText(new Uint8Array([r.getUint8(s),r.getUint8(s+1),r.getUint8(s+2),r.getUint8(s+3)])),i=r.getUint32(s+4,!0);if(n==="VP8 ")return[r.getInt16(s+14,!0)&16383,r.getInt16(s+16,!0)&16383];if(n==="VP8L"){let o=r.getUint8(s+9),c=r.getUint8(s+10),l=r.getUint8(s+11),f=r.getUint8(s+12);return[1+((c&63)<<8|o),1+((f&15)<<10|l<<2|(c&192)>>6)]}s+=8+i+i%2}return null}getChannels(t){return 4}},Lg=class extends ie{extensionName=Zr;prereadTypes=[F.TEXTURE];static EXTENSION_NAME=Zr;static register(){ot.registerFormat("image/webp",new jg)}preread(t){return(t.jsonDoc.json.textures||[]).forEach(e=>{e.extensions&&e.extensions.EXT_texture_webp&&(e.source=e.extensions[Zr].source)}),this}read(t){return this}write(t){let e=t.jsonDoc;return this.document.getRoot().listTextures().forEach(a=>{if(a.getMimeType()==="image/webp"){let r=t.imageIndexMap.get(a);(e.json.textures||[]).forEach(s=>{s.source===r&&(s.extensions=s.extensions||{},s.extensions[Zr]={source:s.source},delete s.source)})}}),this}},Jc=Ip,Dg=class extends ie{extensionName=Jc;static EXTENSION_NAME=Jc;read(t){return this}write(t){return this}},Qc=Rp,Ug=class extends ie{extensionName=Qc;static EXTENSION_NAME=Qc;read(t){return this}write(t){return this}},Ee,fl,hl;function zg(t,e){let a=new Ee.DecoderBuffer;try{if(a.Init(e,e.length),t.GetEncodedGeometryType(a)!==Ee.TRIANGULAR_MESH)throw new Error(`[${xe}] Unknown geometry type.`);let r=new Ee.Mesh;if(!t.DecodeBufferToMesh(a,r).ok()||r.ptr===0)throw new Error(`[${xe}] Decoding failure.`);return r}finally{Ee.destroy(a)}}function Gg(t,e){let a=e.num_faces()*3,r,s;if(e.num_points()<=65534){let n=a*Uint16Array.BYTES_PER_ELEMENT;r=Ee._malloc(n),t.GetTrianglesUInt16Array(e,n,r),s=new Uint16Array(Ee.HEAPU16.buffer,r,a).slice()}else{let n=a*Uint32Array.BYTES_PER_ELEMENT;r=Ee._malloc(n),t.GetTrianglesUInt32Array(e,n,r),s=new Uint32Array(Ee.HEAPU32.buffer,r,a).slice()}return Ee._free(r),s}function Kg(t,e,a,r){let s=hl[r.componentType],n=fl[r.componentType],i=a.num_components(),o=e.num_points()*i,c=o*n.BYTES_PER_ELEMENT,l=Ee._malloc(c);t.GetAttributeDataArrayForAllPoints(e,a,s,c,l);let f=new n(Ee.HEAPF32.buffer,l,o).slice();return Ee._free(l),f}function Vg(t){Ee=t,fl={[K.ComponentType.FLOAT]:Float32Array,[K.ComponentType.UNSIGNED_INT]:Uint32Array,[K.ComponentType.UNSIGNED_SHORT]:Uint16Array,[K.ComponentType.UNSIGNED_BYTE]:Uint8Array,[K.ComponentType.SHORT]:Int16Array,[K.ComponentType.BYTE]:Int8Array},hl={[K.ComponentType.FLOAT]:Ee.DT_FLOAT32,[K.ComponentType.UNSIGNED_INT]:Ee.DT_UINT32,[K.ComponentType.UNSIGNED_SHORT]:Ee.DT_UINT16,[K.ComponentType.UNSIGNED_BYTE]:Ee.DT_UINT8,[K.ComponentType.SHORT]:Ee.DT_INT16,[K.ComponentType.BYTE]:Ee.DT_INT8}}var Xe,qg=(function(t){return t[t.EDGEBREAKER=1]="EDGEBREAKER",t[t.SEQUENTIAL=0]="SEQUENTIAL",t})({}),bl={POSITION:14,NORMAL:10,COLOR:8,TEX_COORD:12,GENERIC:12},Zc={decodeSpeed:5,encodeSpeed:5,method:1,quantizationBits:bl,quantizationVolume:"mesh"};function Hg(t){Xe=t}function Wg(t,e=Zc){let a={...Zc,...e};a.quantizationBits={...bl,...e.quantizationBits};let r=new Xe.MeshBuilder,s=new Xe.Mesh,n=new Xe.ExpertEncoder(s),i={},o=new Xe.DracoInt8Array,c=t.listTargets().length>0,l=!1;for(let d of t.listSemantics()){let m=t.getAttribute(d);if(m.getSparse()){l=!0;continue}let b=Xg(d),y=$g(r,m.getComponentType(),s,Xe[b],m.getCount(),m.getElementSize(),m.getArray());if(y===-1)throw new Error(`Error compressing "${d}" attribute.`);if(i[d]=y,a.quantizationVolume==="mesh"||d!=="POSITION")n.SetAttributeQuantization(y,a.quantizationBits[b]);else if(typeof a.quantizationVolume=="object"){let{quantizationVolume:x}=a,v=Math.max(x.max[0]-x.min[0],x.max[1]-x.min[1],x.max[2]-x.min[2]);n.SetAttributeExplicitQuantization(y,a.quantizationBits[b],m.getElementSize(),x.min,v)}else throw new Error("Invalid quantization volume state.")}let f=t.getIndices();if(!f)throw new Yn("Primitive must have indices.");r.AddFacesToMesh(s,f.getCount()/3,f.getArray()),n.SetSpeedOptions(a.encodeSpeed,a.decodeSpeed),n.SetTrackEncodedProperties(!0),a.method===0||c||l?n.SetEncodingMethod(Xe.MESH_SEQUENTIAL_ENCODING):n.SetEncodingMethod(Xe.MESH_EDGEBREAKER_ENCODING);let u=n.EncodeToDracoBuffer(!(c||l),o);if(u<=0)throw new Yn("Error applying Draco compression.");let g=new Uint8Array(u);for(let d=0;d<u;++d)g[d]=o.GetValue(d);let p=n.GetNumberOfEncodedPoints(),h=n.GetNumberOfEncodedFaces()*3;return Xe.destroy(o),Xe.destroy(s),Xe.destroy(r),Xe.destroy(n),{numVertices:p,numIndices:h,data:g,attributeIDs:i}}function Xg(t){return t==="POSITION"?"POSITION":t==="NORMAL"?"NORMAL":t.startsWith("COLOR_")?"COLOR":t.startsWith("TEXCOORD_")?"TEX_COORD":"GENERIC"}function $g(t,e,a,r,s,n,i){switch(e){case K.ComponentType.UNSIGNED_BYTE:return t.AddUInt8Attribute(a,r,s,n,i);case K.ComponentType.BYTE:return t.AddInt8Attribute(a,r,s,n,i);case K.ComponentType.UNSIGNED_SHORT:return t.AddUInt16Attribute(a,r,s,n,i);case K.ComponentType.SHORT:return t.AddInt16Attribute(a,r,s,n,i);case K.ComponentType.UNSIGNED_INT:return t.AddUInt32Attribute(a,r,s,n,i);case K.ComponentType.FLOAT:return t.AddFloatAttribute(a,r,s,n,i);default:throw new Error(`Unexpected component type, "${e}".`)}}var Yn=class extends Error{},Yg=class extends ie{extensionName=xe;prereadTypes=[F.PRIMITIVE];prewriteTypes=[F.ACCESSOR];readDependencies=["draco3d.decoder"];writeDependencies=["draco3d.encoder"];static EXTENSION_NAME=xe;static EncoderMethod=qg;_decoderModule=null;_encoderModule=null;_encoderOptions={};install(t,e){return t==="draco3d.decoder"&&(this._decoderModule=e,Vg(this._decoderModule)),t==="draco3d.encoder"&&(this._encoderModule=e,Hg(this._encoderModule)),this}setEncoderOptions(t){return this._encoderOptions=t,this}preread(t){if(!this._decoderModule)throw new Error(`[${xe}] Please install extension dependency, "draco3d.decoder".`);let e=this.document.getLogger(),a=t.jsonDoc,r=new Map;try{let s=a.json.meshes||[];for(let n of s)for(let i of n.primitives){if(!i.extensions||!i.extensions.KHR_draco_mesh_compression)continue;let o=i.extensions[xe],[c,l]=r.get(o.bufferView)||[];if(!l||!c){let f=a.json.bufferViews[o.bufferView],u=a.json.buffers[f.buffer],g=u.uri?a.resources[u.uri]:a.resources[At],p=f.byteOffset||0,h=f.byteLength,d=X.toView(g,p,h);c=new this._decoderModule.Decoder,l=zg(c,d),r.set(o.bufferView,[c,l]),e.debug(`[${xe}] Decompressed ${d.byteLength} bytes.`)}for(let f in o.attributes){let u=t.jsonDoc.json.accessors[i.attributes[f]],g=c.GetAttributeByUniqueId(l,o.attributes[f]),p=Kg(c,l,g,u);t.accessors[i.attributes[f]].setArray(p)}i.indices!==void 0&&t.accessors[i.indices].setArray(Gg(c,l))}}finally{for(let[s,n]of Array.from(r.values()))this._decoderModule.destroy(s),this._decoderModule.destroy(n)}return this}read(t){return this}prewrite(t,e){if(!this._encoderModule)throw new Error(`[${xe}] Please install extension dependency, "draco3d.encoder".`);let a=this.document.getLogger();a.debug(`[${xe}] Compression options: ${JSON.stringify(this._encoderOptions)}`);let r=Jg(this.document),s=new Map,n="mesh";this._encoderOptions.quantizationVolume==="scene"&&(this.document.getRoot().listScenes().length!==1?a.warn(`[${xe}]: quantizationVolume=scene requires exactly 1 scene.`):n=Tc(this.document.getRoot().listScenes().pop()));for(let i of Array.from(r.keys())){let o=r.get(i);if(!o)throw new Error("Unexpected primitive.");if(s.has(o)){s.set(o,s.get(o));continue}let c=i.getIndices(),l=t.jsonDoc.json.accessors,f;try{f=Wg(i,{...this._encoderOptions,quantizationVolume:n})}catch(p){if(p instanceof Yn){a.warn(`[${xe}]: ${p.message} Skipping primitive compression.`);continue}throw p}s.set(o,f);let u=t.createAccessorDef(c);u.count=f.numIndices,t.accessorIndexMap.set(c,l.length),l.push(u),f.numVertices>65534&&K.getComponentSize(u.componentType)<=2?u.componentType=K.ComponentType.UNSIGNED_INT:f.numVertices>254&&K.getComponentSize(u.componentType)<=1&&(u.componentType=K.ComponentType.UNSIGNED_SHORT);for(let p of i.listSemantics()){let h=i.getAttribute(p);if(f.attributeIDs[p]===void 0)continue;let d=t.createAccessorDef(h);d.count=f.numVertices,t.accessorIndexMap.set(h,l.length),l.push(d)}let g=i.getAttribute("POSITION").getBuffer()||this.document.getRoot().listBuffers()[0];t.otherBufferViews.has(g)||t.otherBufferViews.set(g,[]),t.otherBufferViews.get(g).push(f.data)}return a.debug(`[${xe}] Compressed ${r.size} primitives.`),t.extensionData[xe]={primitiveHashMap:r,primitiveEncodingMap:s},this}write(t){let e=t.extensionData[xe];for(let a of this.document.getRoot().listMeshes()){let r=t.jsonDoc.json.meshes[t.meshIndexMap.get(a)];for(let s=0;s<a.listPrimitives().length;s++){let n=a.listPrimitives()[s],i=r.primitives[s],o=e.primitiveHashMap.get(n);if(!o)continue;let c=e.primitiveEncodingMap.get(o);c&&(i.extensions=i.extensions||{},i.extensions[xe]={bufferView:t.otherBufferViewsIndexMap.get(c.data),attributes:c.attributeIDs})}}if(!e.primitiveHashMap.size){let a=t.jsonDoc.json;a.extensionsUsed=(a.extensionsUsed||[]).filter(r=>r!==xe),a.extensionsRequired=(a.extensionsRequired||[]).filter(r=>r!==xe)}return this}};function Jg(t){let e=t.getLogger(),a=new Set,r=new Set,s=0,n=0;for(let u of t.getRoot().listMeshes())for(let g of u.listPrimitives())g.getIndices()?g.getMode()!==Ga.Mode.TRIANGLES?(r.add(g),n++):a.add(g):(r.add(g),s++);s>0&&e.warn(`[${xe}] Skipping Draco compression of ${s} non-indexed primitives.`),n>0&&e.warn(`[${xe}] Skipping Draco compression of ${n} non-TRIANGLES primitives.`);let i=t.getRoot().listAccessors(),o=new Map;for(let u=0;u<i.length;u++)o.set(i[u],u);let c=new Map,l=new Set,f=new Map;for(let u of Array.from(a)){let g=el(u,o);if(l.has(g)){f.set(u,g);continue}if(c.has(u.getIndices())){let p=u.getIndices(),h=p.clone();o.set(h,t.getRoot().listAccessors().length-1),u.swap(p,h)}for(let p of u.listAttributes())if(c.has(p)){let h=p.clone();o.set(h,t.getRoot().listAccessors().length-1),u.swap(p,h)}g=el(u,o),l.add(g),f.set(u,g),c.set(u.getIndices(),g);for(let p of u.listAttributes())c.set(p,g)}for(let u of Array.from(c.keys())){let g=new Set(u.listParents().map(p=>p.propertyType));if(g.size!==2||!g.has(F.PRIMITIVE)||!g.has(F.ROOT))throw new Error(`[${xe}] Compressed accessors must only be used as indices or vertex attributes.`)}for(let u of Array.from(a)){let g=f.get(u),p=u.getIndices();if(c.get(p)!==g||u.listAttributes().some(h=>c.get(h)!==g))throw new Error(`[${xe}] Draco primitives must share all, or no, accessors.`)}for(let u of Array.from(r)){let g=u.getIndices();if(c.has(g)||u.listAttributes().some(p=>c.has(p)))throw new Error(`[${xe}] Accessor cannot be shared by compressed and uncompressed primitives.`)}return f}function el(t,e){let a=[],r=t.getIndices();a.push(e.get(r));for(let s of t.listAttributes())a.push(e.get(s));return a.sort().join("|")}var tl=class pl extends J{static EXTENSION_NAME=gt;static Type={POINT:"point",SPOT:"spot",DIRECTIONAL:"directional"};init(){this.extensionName=gt,this.propertyType="Light",this.parentTypes=[F.NODE]}getDefaults(){return Object.assign(super.getDefaults(),{color:[1,1,1],intensity:1,type:pl.Type.POINT,range:null,innerConeAngle:0,outerConeAngle:Math.PI/4})}getColor(){return this.get("color")}setColor(e){return this.set("color",e)}getIntensity(){return this.get("intensity")}setIntensity(e){return this.set("intensity",e)}getType(){return this.get("type")}setType(e){return this.set("type",e)}getRange(){return this.get("range")}setRange(e){return this.set("range",e)}getInnerConeAngle(){return this.get("innerConeAngle")}setInnerConeAngle(e){return this.set("innerConeAngle",e)}getOuterConeAngle(){return this.get("outerConeAngle")}setOuterConeAngle(e){return this.set("outerConeAngle",e)}},Qg=class extends ie{extensionName=gt;static EXTENSION_NAME=gt;createLight(t=""){return new tl(this.document.getGraph(),t)}read(t){let e=t.jsonDoc;if(!e.json.extensions||!e.json.extensions.KHR_lights_punctual)return this;let a=(e.json.extensions.KHR_lights_punctual.lights||[]).map(r=>{let s=this.createLight().setName(r.name||"").setType(r.type);return r.extras&&s.setExtras(r.extras),r.color!==void 0&&s.setColor(r.color),r.intensity!==void 0&&s.setIntensity(r.intensity),r.range!==void 0&&s.setRange(r.range),r.spot?.innerConeAngle!==void 0&&s.setInnerConeAngle(r.spot.innerConeAngle),r.spot?.outerConeAngle!==void 0&&s.setOuterConeAngle(r.spot.outerConeAngle),s});return e.json.nodes.forEach((r,s)=>{if(!r.extensions||!r.extensions.KHR_lights_punctual)return;let n=r.extensions[gt];t.nodes[s].setExtension(gt,a[n.light])}),this}write(t){let e=t.jsonDoc;if(this.properties.size===0)return this;let a=[],r=new Map;for(let s of this.properties){let n=s,i=t.createPropertyDef(s);i.type=n.getType(),fe.eq(n.getColor(),[1,1,1])||(i.color=n.getColor()),n.getIntensity()!==1&&(i.intensity=n.getIntensity()),n.getRange()!=null&&(i.range=n.getRange()),n.getName()&&(i.name=n.getName()),n.getType()===tl.Type.SPOT&&(i.spot={innerConeAngle:n.getInnerConeAngle(),outerConeAngle:n.getOuterConeAngle()}),a.push(i),r.set(n,a.length-1)}return this.document.getRoot().listNodes().forEach(s=>{let n=s.getExtension(gt);if(n){let i=t.nodeIndexMap.get(s),o=e.json.nodes[i];o.extensions=o.extensions||{},o.extensions[gt]={light:r.get(n)}}}),e.json.extensions=e.json.extensions||{},e.json.extensions[gt]={lights:a},this}},{R:Zg,G:em,B:tm}=Qe,am=class extends J{static EXTENSION_NAME=Rt;init(){this.extensionName=Rt,this.propertyType="Anisotropy",this.parentTypes=[F.MATERIAL]}getDefaults(){return Object.assign(super.getDefaults(),{anisotropyStrength:0,anisotropyRotation:0,anisotropyTexture:null,anisotropyTextureInfo:new ue(this.graph,"anisotropyTextureInfo")})}getAnisotropyStrength(){return this.get("anisotropyStrength")}setAnisotropyStrength(t){return this.set("anisotropyStrength",t)}getAnisotropyRotation(){return this.get("anisotropyRotation")}setAnisotropyRotation(t){return this.set("anisotropyRotation",t)}getAnisotropyTexture(){return this.getRef("anisotropyTexture")}getAnisotropyTextureInfo(){return this.getRef("anisotropyTexture")?this.getRef("anisotropyTextureInfo"):null}setAnisotropyTexture(t){return this.setRef("anisotropyTexture",t,{channels:Zg|em|tm})}},rm=class extends ie{static EXTENSION_NAME=Rt;extensionName=Rt;prereadTypes=[F.MESH];prewriteTypes=[F.MESH];createAnisotropy(){return new am(this.document.getGraph())}read(t){return this}write(t){return this}preread(t){let e=t.jsonDoc,a=e.json.materials||[],r=e.json.textures||[];return a.forEach((s,n)=>{if(s.extensions&&s.extensions.KHR_materials_anisotropy){let i=this.createAnisotropy();t.materials[n].setExtension(Rt,i);let o=s.extensions[Rt];if(o.extras&&i.setExtras(o.extras),o.anisotropyStrength!==void 0&&i.setAnisotropyStrength(o.anisotropyStrength),o.anisotropyRotation!==void 0&&i.setAnisotropyRotation(o.anisotropyRotation),o.anisotropyTexture!==void 0){let c=o.anisotropyTexture,l=t.textures[r[c.index].source];i.setAnisotropyTexture(l),t.setTextureInfo(i.getAnisotropyTextureInfo(),c)}}}),this}prewrite(t){let e=t.jsonDoc;return this.document.getRoot().listMaterials().forEach(a=>{let r=a.getExtension(Rt);if(r){let s=t.materialIndexMap.get(a),n=e.json.materials[s],i=t.createPropertyDef(r);if(n.extensions=n.extensions||{},n.extensions[Rt]=i,r.getAnisotropyStrength()>0&&(i.anisotropyStrength=r.getAnisotropyStrength()),r.getAnisotropyRotation()!==0&&(i.anisotropyRotation=r.getAnisotropyRotation()),r.getAnisotropyTexture()){let o=r.getAnisotropyTexture(),c=r.getAnisotropyTextureInfo();i.anisotropyTexture=t.createTextureInfoDef(o,c)}}}),this}},{R:al,G:rl,B:sm}=Qe,nm=class extends J{static EXTENSION_NAME=Nt;init(){this.extensionName=Nt,this.propertyType="Clearcoat",this.parentTypes=[F.MATERIAL]}getDefaults(){return Object.assign(super.getDefaults(),{clearcoatFactor:0,clearcoatTexture:null,clearcoatTextureInfo:new ue(this.graph,"clearcoatTextureInfo"),clearcoatRoughnessFactor:0,clearcoatRoughnessTexture:null,clearcoatRoughnessTextureInfo:new ue(this.graph,"clearcoatRoughnessTextureInfo"),clearcoatNormalScale:1,clearcoatNormalTexture:null,clearcoatNormalTextureInfo:new ue(this.graph,"clearcoatNormalTextureInfo")})}getClearcoatFactor(){return this.get("clearcoatFactor")}setClearcoatFactor(t){return this.set("clearcoatFactor",t)}getClearcoatTexture(){return this.getRef("clearcoatTexture")}getClearcoatTextureInfo(){return this.getRef("clearcoatTexture")?this.getRef("clearcoatTextureInfo"):null}setClearcoatTexture(t){return this.setRef("clearcoatTexture",t,{channels:al})}getClearcoatRoughnessFactor(){return this.get("clearcoatRoughnessFactor")}setClearcoatRoughnessFactor(t){return this.set("clearcoatRoughnessFactor",t)}getClearcoatRoughnessTexture(){return this.getRef("clearcoatRoughnessTexture")}getClearcoatRoughnessTextureInfo(){return this.getRef("clearcoatRoughnessTexture")?this.getRef("clearcoatRoughnessTextureInfo"):null}setClearcoatRoughnessTexture(t){return this.setRef("clearcoatRoughnessTexture",t,{channels:rl})}getClearcoatNormalScale(){return this.get("clearcoatNormalScale")}setClearcoatNormalScale(t){return this.set("clearcoatNormalScale",t)}getClearcoatNormalTexture(){return this.getRef("clearcoatNormalTexture")}getClearcoatNormalTextureInfo(){return this.getRef("clearcoatNormalTexture")?this.getRef("clearcoatNormalTextureInfo"):null}setClearcoatNormalTexture(t){return this.setRef("clearcoatNormalTexture",t,{channels:al|rl|sm})}},im=class extends ie{static EXTENSION_NAME=Nt;extensionName=Nt;prereadTypes=[F.MESH];prewriteTypes=[F.MESH];createClearcoat(){return new nm(this.document.getGraph())}read(t){return this}write(t){return this}preread(t){let e=t.jsonDoc,a=e.json.materials||[],r=e.json.textures||[];return a.forEach((s,n)=>{if(s.extensions&&s.extensions.KHR_materials_clearcoat){let i=this.createClearcoat();t.materials[n].setExtension(Nt,i);let o=s.extensions[Nt];if(o.extras&&i.setExtras(o.extras),o.clearcoatFactor!==void 0&&i.setClearcoatFactor(o.clearcoatFactor),o.clearcoatRoughnessFactor!==void 0&&i.setClearcoatRoughnessFactor(o.clearcoatRoughnessFactor),o.clearcoatTexture!==void 0){let c=o.clearcoatTexture,l=t.textures[r[c.index].source];i.setClearcoatTexture(l),t.setTextureInfo(i.getClearcoatTextureInfo(),c)}if(o.clearcoatRoughnessTexture!==void 0){let c=o.clearcoatRoughnessTexture,l=t.textures[r[c.index].source];i.setClearcoatRoughnessTexture(l),t.setTextureInfo(i.getClearcoatRoughnessTextureInfo(),c)}if(o.clearcoatNormalTexture!==void 0){let c=o.clearcoatNormalTexture,l=t.textures[r[c.index].source];i.setClearcoatNormalTexture(l),t.setTextureInfo(i.getClearcoatNormalTextureInfo(),c),c.scale!==void 0&&i.setClearcoatNormalScale(c.scale)}}}),this}prewrite(t){let e=t.jsonDoc;return this.document.getRoot().listMaterials().forEach(a=>{let r=a.getExtension(Nt);if(r){let s=t.materialIndexMap.get(a),n=e.json.materials[s],i=t.createPropertyDef(r);if(n.extensions=n.extensions||{},n.extensions[Nt]=i,i.clearcoatFactor=r.getClearcoatFactor(),i.clearcoatRoughnessFactor=r.getClearcoatRoughnessFactor(),r.getClearcoatTexture()){let o=r.getClearcoatTexture(),c=r.getClearcoatTextureInfo();i.clearcoatTexture=t.createTextureInfoDef(o,c)}if(r.getClearcoatRoughnessTexture()){let o=r.getClearcoatRoughnessTexture(),c=r.getClearcoatRoughnessTextureInfo();i.clearcoatRoughnessTexture=t.createTextureInfoDef(o,c)}if(r.getClearcoatNormalTexture()){let o=r.getClearcoatNormalTexture(),c=r.getClearcoatNormalTextureInfo();i.clearcoatNormalTexture=t.createTextureInfoDef(o,c),r.getClearcoatNormalScale()!==1&&(i.clearcoatNormalTexture.scale=r.getClearcoatNormalScale())}}}),this}},{R:om,G:cm,B:lm,A:dm}=Qe,um=class extends J{static EXTENSION_NAME=Ct;init(){this.extensionName=Ct,this.propertyType="DiffuseTransmission",this.parentTypes=[F.MATERIAL]}getDefaults(){return Object.assign(super.getDefaults(),{diffuseTransmissionFactor:0,diffuseTransmissionTexture:null,diffuseTransmissionTextureInfo:new ue(this.graph,"diffuseTransmissionTextureInfo"),diffuseTransmissionColorFactor:[1,1,1],diffuseTransmissionColorTexture:null,diffuseTransmissionColorTextureInfo:new ue(this.graph,"diffuseTransmissionColorTextureInfo")})}getDiffuseTransmissionFactor(){return this.get("diffuseTransmissionFactor")}setDiffuseTransmissionFactor(t){return this.set("diffuseTransmissionFactor",t)}getDiffuseTransmissionTexture(){return this.getRef("diffuseTransmissionTexture")}getDiffuseTransmissionTextureInfo(){return this.getRef("diffuseTransmissionTexture")?this.getRef("diffuseTransmissionTextureInfo"):null}setDiffuseTransmissionTexture(t){return this.setRef("diffuseTransmissionTexture",t,{channels:dm})}getDiffuseTransmissionColorFactor(){return this.get("diffuseTransmissionColorFactor")}setDiffuseTransmissionColorFactor(t){return this.set("diffuseTransmissionColorFactor",t)}getDiffuseTransmissionColorTexture(){return this.getRef("diffuseTransmissionColorTexture")}getDiffuseTransmissionColorTextureInfo(){return this.getRef("diffuseTransmissionColorTexture")?this.getRef("diffuseTransmissionColorTextureInfo"):null}setDiffuseTransmissionColorTexture(t){return this.setRef("diffuseTransmissionColorTexture",t,{channels:om|cm|lm})}},fm=class extends ie{extensionName=Ct;static EXTENSION_NAME=Ct;createDiffuseTransmission(){return new um(this.document.getGraph())}read(t){let e=t.jsonDoc,a=e.json.materials||[],r=e.json.textures||[];return a.forEach((s,n)=>{if(s.extensions&&s.extensions.KHR_materials_diffuse_transmission){let i=this.createDiffuseTransmission();t.materials[n].setExtension(Ct,i);let o=s.extensions[Ct];if(o.extras&&i.setExtras(o.extras),o.diffuseTransmissionFactor!==void 0&&i.setDiffuseTransmissionFactor(o.diffuseTransmissionFactor),o.diffuseTransmissionColorFactor!==void 0&&i.setDiffuseTransmissionColorFactor(o.diffuseTransmissionColorFactor),o.diffuseTransmissionTexture!==void 0){let c=o.diffuseTransmissionTexture,l=t.textures[r[c.index].source];i.setDiffuseTransmissionTexture(l),t.setTextureInfo(i.getDiffuseTransmissionTextureInfo(),c)}if(o.diffuseTransmissionColorTexture!==void 0){let c=o.diffuseTransmissionColorTexture,l=t.textures[r[c.index].source];i.setDiffuseTransmissionColorTexture(l),t.setTextureInfo(i.getDiffuseTransmissionColorTextureInfo(),c)}}}),this}write(t){let e=t.jsonDoc;for(let a of this.document.getRoot().listMaterials()){let r=a.getExtension(Ct);if(!r)continue;let s=t.materialIndexMap.get(a),n=e.json.materials[s],i=t.createPropertyDef(r);if(n.extensions=n.extensions||{},n.extensions[Ct]=i,i.diffuseTransmissionFactor=r.getDiffuseTransmissionFactor(),i.diffuseTransmissionColorFactor=r.getDiffuseTransmissionColorFactor(),r.getDiffuseTransmissionTexture()){let o=r.getDiffuseTransmissionTexture(),c=r.getDiffuseTransmissionTextureInfo();i.diffuseTransmissionTexture=t.createTextureInfoDef(o,c)}if(r.getDiffuseTransmissionColorTexture()){let o=r.getDiffuseTransmissionColorTexture(),c=r.getDiffuseTransmissionColorTextureInfo();i.diffuseTransmissionColorTexture=t.createTextureInfoDef(o,c)}}return this}},hm=class extends J{static EXTENSION_NAME=Bt;init(){this.extensionName=Bt,this.propertyType="Dispersion",this.parentTypes=[F.MATERIAL]}getDefaults(){return Object.assign(super.getDefaults(),{dispersion:0})}getDispersion(){return this.get("dispersion")}setDispersion(t){return this.set("dispersion",t)}},bm=class extends ie{static EXTENSION_NAME=Bt;extensionName=Bt;prereadTypes=[F.MESH];prewriteTypes=[F.MESH];createDispersion(){return new hm(this.document.getGraph())}read(t){return this}write(t){return this}preread(t){return(t.jsonDoc.json.materials||[]).forEach((e,a)=>{if(e.extensions&&e.extensions.KHR_materials_dispersion){let r=this.createDispersion();t.materials[a].setExtension(Bt,r);let s=e.extensions[Bt];s.extras&&r.setExtras(s.extras),s.dispersion!==void 0&&r.setDispersion(s.dispersion)}}),this}prewrite(t){let e=t.jsonDoc;return this.document.getRoot().listMaterials().forEach(a=>{let r=a.getExtension(Bt);if(r){let s=t.materialIndexMap.get(a),n=e.json.materials[s],i=t.createPropertyDef(r);n.extensions=n.extensions||{},n.extensions[Bt]=i,i.dispersion=r.getDispersion()}}),this}},pm=class extends J{static EXTENSION_NAME=Ot;init(){this.extensionName=Ot,this.propertyType="EmissiveStrength",this.parentTypes=[F.MATERIAL]}getDefaults(){return Object.assign(super.getDefaults(),{emissiveStrength:1})}getEmissiveStrength(){return this.get("emissiveStrength")}setEmissiveStrength(t){return this.set("emissiveStrength",t)}},gm=class extends ie{static EXTENSION_NAME=Ot;extensionName=Ot;prereadTypes=[F.MESH];prewriteTypes=[F.MESH];createEmissiveStrength(){return new pm(this.document.getGraph())}read(t){return this}write(t){return this}preread(t){return(t.jsonDoc.json.materials||[]).forEach((e,a)=>{if(e.extensions&&e.extensions.KHR_materials_emissive_strength){let r=this.createEmissiveStrength();t.materials[a].setExtension(Ot,r);let s=e.extensions[Ot];s.extras&&r.setExtras(s.extras),s.emissiveStrength!==void 0&&r.setEmissiveStrength(s.emissiveStrength)}}),this}prewrite(t){let e=t.jsonDoc;return this.document.getRoot().listMaterials().forEach(a=>{let r=a.getExtension(Ot);if(r){let s=t.materialIndexMap.get(a),n=e.json.materials[s],i=t.createPropertyDef(r);n.extensions=n.extensions||{},n.extensions[Ot]=i,i.emissiveStrength=r.getEmissiveStrength()}}),this}},mm=class extends J{static EXTENSION_NAME=Ft;init(){this.extensionName=Ft,this.propertyType="IOR",this.parentTypes=[F.MATERIAL]}getDefaults(){return Object.assign(super.getDefaults(),{ior:1.5})}getIOR(){return this.get("ior")}setIOR(t){return this.set("ior",t)}},ym=class extends ie{static EXTENSION_NAME=Ft;extensionName=Ft;prereadTypes=[F.MESH];prewriteTypes=[F.MESH];createIOR(){return new mm(this.document.getGraph())}read(t){return this}write(t){return this}preread(t){return(t.jsonDoc.json.materials||[]).forEach((e,a)=>{if(e.extensions&&e.extensions.KHR_materials_ior){let r=this.createIOR();t.materials[a].setExtension(Ft,r);let s=e.extensions[Ft];s.extras&&r.setExtras(s.extras),s.ior!==void 0&&r.setIOR(s.ior)}}),this}prewrite(t){let e=t.jsonDoc;return this.document.getRoot().listMaterials().forEach(a=>{let r=a.getExtension(Ft);if(r){let s=t.materialIndexMap.get(a),n=e.json.materials[s],i=t.createPropertyDef(r);n.extensions=n.extensions||{},n.extensions[Ft]=i,i.ior=r.getIOR()}}),this}},{R:xm,G:wm}=Qe,vm=class extends J{static EXTENSION_NAME=Pt;init(){this.extensionName=Pt,this.propertyType="Iridescence",this.parentTypes=[F.MATERIAL]}getDefaults(){return Object.assign(super.getDefaults(),{iridescenceFactor:0,iridescenceTexture:null,iridescenceTextureInfo:new ue(this.graph,"iridescenceTextureInfo"),iridescenceIOR:1.3,iridescenceThicknessMinimum:100,iridescenceThicknessMaximum:400,iridescenceThicknessTexture:null,iridescenceThicknessTextureInfo:new ue(this.graph,"iridescenceThicknessTextureInfo")})}getIridescenceFactor(){return this.get("iridescenceFactor")}setIridescenceFactor(t){return this.set("iridescenceFactor",t)}getIridescenceTexture(){return this.getRef("iridescenceTexture")}getIridescenceTextureInfo(){return this.getRef("iridescenceTexture")?this.getRef("iridescenceTextureInfo"):null}setIridescenceTexture(t){return this.setRef("iridescenceTexture",t,{channels:xm})}getIridescenceIOR(){return this.get("iridescenceIOR")}setIridescenceIOR(t){return this.set("iridescenceIOR",t)}getIridescenceThicknessMinimum(){return this.get("iridescenceThicknessMinimum")}setIridescenceThicknessMinimum(t){return this.set("iridescenceThicknessMinimum",t)}getIridescenceThicknessMaximum(){return this.get("iridescenceThicknessMaximum")}setIridescenceThicknessMaximum(t){return this.set("iridescenceThicknessMaximum",t)}getIridescenceThicknessTexture(){return this.getRef("iridescenceThicknessTexture")}getIridescenceThicknessTextureInfo(){return this.getRef("iridescenceThicknessTexture")?this.getRef("iridescenceThicknessTextureInfo"):null}setIridescenceThicknessTexture(t){return this.setRef("iridescenceThicknessTexture",t,{channels:wm})}},km=class extends ie{static EXTENSION_NAME=Pt;extensionName=Pt;prereadTypes=[F.MESH];prewriteTypes=[F.MESH];createIridescence(){return new vm(this.document.getGraph())}read(t){return this}write(t){return this}preread(t){let e=t.jsonDoc,a=e.json.materials||[],r=e.json.textures||[];return a.forEach((s,n)=>{if(s.extensions&&s.extensions.KHR_materials_iridescence){let i=this.createIridescence();t.materials[n].setExtension(Pt,i);let o=s.extensions[Pt];if(o.extras&&i.setExtras(o.extras),o.iridescenceFactor!==void 0&&i.setIridescenceFactor(o.iridescenceFactor),o.iridescenceIor!==void 0&&i.setIridescenceIOR(o.iridescenceIor),o.iridescenceThicknessMinimum!==void 0&&i.setIridescenceThicknessMinimum(o.iridescenceThicknessMinimum),o.iridescenceThicknessMaximum!==void 0&&i.setIridescenceThicknessMaximum(o.iridescenceThicknessMaximum),o.iridescenceTexture!==void 0){let c=o.iridescenceTexture,l=t.textures[r[c.index].source];i.setIridescenceTexture(l),t.setTextureInfo(i.getIridescenceTextureInfo(),c)}if(o.iridescenceThicknessTexture!==void 0){let c=o.iridescenceThicknessTexture,l=t.textures[r[c.index].source];i.setIridescenceThicknessTexture(l),t.setTextureInfo(i.getIridescenceThicknessTextureInfo(),c)}}}),this}prewrite(t){let e=t.jsonDoc;return this.document.getRoot().listMaterials().forEach(a=>{let r=a.getExtension(Pt);if(r){let s=t.materialIndexMap.get(a),n=e.json.materials[s],i=t.createPropertyDef(r);if(n.extensions=n.extensions||{},n.extensions[Pt]=i,r.getIridescenceFactor()>0&&(i.iridescenceFactor=r.getIridescenceFactor()),r.getIridescenceIOR()!==1.3&&(i.iridescenceIor=r.getIridescenceIOR()),r.getIridescenceThicknessMinimum()!==100&&(i.iridescenceThicknessMinimum=r.getIridescenceThicknessMinimum()),r.getIridescenceThicknessMaximum()!==400&&(i.iridescenceThicknessMaximum=r.getIridescenceThicknessMaximum()),r.getIridescenceTexture()){let o=r.getIridescenceTexture(),c=r.getIridescenceTextureInfo();i.iridescenceTexture=t.createTextureInfoDef(o,c)}if(r.getIridescenceThicknessTexture()){let o=r.getIridescenceThicknessTexture(),c=r.getIridescenceThicknessTextureInfo();i.iridescenceThicknessTexture=t.createTextureInfoDef(o,c)}}}),this}},{R:sl,G:nl,B:il,A:ol}=Qe,Em=class extends J{static EXTENSION_NAME=jt;init(){this.extensionName=jt,this.propertyType="PBRSpecularGlossiness",this.parentTypes=[F.MATERIAL]}getDefaults(){return Object.assign(super.getDefaults(),{diffuseFactor:[1,1,1,1],diffuseTexture:null,diffuseTextureInfo:new ue(this.graph,"diffuseTextureInfo"),specularFactor:[1,1,1],glossinessFactor:1,specularGlossinessTexture:null,specularGlossinessTextureInfo:new ue(this.graph,"specularGlossinessTextureInfo")})}getDiffuseFactor(){return this.get("diffuseFactor")}setDiffuseFactor(t){return this.set("diffuseFactor",t)}getDiffuseTexture(){return this.getRef("diffuseTexture")}getDiffuseTextureInfo(){return this.getRef("diffuseTexture")?this.getRef("diffuseTextureInfo"):null}setDiffuseTexture(t){return this.setRef("diffuseTexture",t,{channels:sl|nl|il|ol,isColor:!0})}getSpecularFactor(){return this.get("specularFactor")}setSpecularFactor(t){return this.set("specularFactor",t)}getGlossinessFactor(){return this.get("glossinessFactor")}setGlossinessFactor(t){return this.set("glossinessFactor",t)}getSpecularGlossinessTexture(){return this.getRef("specularGlossinessTexture")}getSpecularGlossinessTextureInfo(){return this.getRef("specularGlossinessTexture")?this.getRef("specularGlossinessTextureInfo"):null}setSpecularGlossinessTexture(t){return this.setRef("specularGlossinessTexture",t,{channels:sl|nl|il|ol})}},Mm=class extends ie{static EXTENSION_NAME=jt;extensionName=jt;prereadTypes=[F.MESH];prewriteTypes=[F.MESH];createPBRSpecularGlossiness(){return new Em(this.document.getGraph())}read(t){return this}write(t){return this}preread(t){let e=t.jsonDoc,a=e.json.materials||[],r=e.json.textures||[];return a.forEach((s,n)=>{if(s.extensions&&s.extensions.KHR_materials_pbrSpecularGlossiness){let i=this.createPBRSpecularGlossiness();t.materials[n].setExtension(jt,i);let o=s.extensions[jt];if(o.extras&&i.setExtras(o.extras),o.diffuseFactor!==void 0&&i.setDiffuseFactor(o.diffuseFactor),o.specularFactor!==void 0&&i.setSpecularFactor(o.specularFactor),o.glossinessFactor!==void 0&&i.setGlossinessFactor(o.glossinessFactor),o.diffuseTexture!==void 0){let c=o.diffuseTexture,l=t.textures[r[c.index].source];i.setDiffuseTexture(l),t.setTextureInfo(i.getDiffuseTextureInfo(),c)}if(o.specularGlossinessTexture!==void 0){let c=o.specularGlossinessTexture,l=t.textures[r[c.index].source];i.setSpecularGlossinessTexture(l),t.setTextureInfo(i.getSpecularGlossinessTextureInfo(),c)}}}),this}prewrite(t){let e=t.jsonDoc;return this.document.getRoot().listMaterials().forEach(a=>{let r=a.getExtension(jt);if(r){let s=t.materialIndexMap.get(a),n=e.json.materials[s],i=t.createPropertyDef(r);if(n.extensions=n.extensions||{},n.extensions[jt]=i,i.diffuseFactor=r.getDiffuseFactor(),i.specularFactor=r.getSpecularFactor(),i.glossinessFactor=r.getGlossinessFactor(),r.getDiffuseTexture()){let o=r.getDiffuseTexture(),c=r.getDiffuseTextureInfo();i.diffuseTexture=t.createTextureInfoDef(o,c)}if(r.getSpecularGlossinessTexture()){let o=r.getSpecularGlossinessTexture(),c=r.getSpecularGlossinessTextureInfo();i.specularGlossinessTexture=t.createTextureInfoDef(o,c)}}}),this}},{R:Sm,G:Tm,B:Am,A:_m}=Qe,Im=class extends J{static EXTENSION_NAME=Lt;init(){this.extensionName=Lt,this.propertyType="Sheen",this.parentTypes=[F.MATERIAL]}getDefaults(){return Object.assign(super.getDefaults(),{sheenColorFactor:[0,0,0],sheenColorTexture:null,sheenColorTextureInfo:new ue(this.graph,"sheenColorTextureInfo"),sheenRoughnessFactor:0,sheenRoughnessTexture:null,sheenRoughnessTextureInfo:new ue(this.graph,"sheenRoughnessTextureInfo")})}getSheenColorFactor(){return this.get("sheenColorFactor")}setSheenColorFactor(t){return this.set("sheenColorFactor",t)}getSheenColorTexture(){return this.getRef("sheenColorTexture")}getSheenColorTextureInfo(){return this.getRef("sheenColorTexture")?this.getRef("sheenColorTextureInfo"):null}setSheenColorTexture(t){return this.setRef("sheenColorTexture",t,{channels:Sm|Tm|Am,isColor:!0})}getSheenRoughnessFactor(){return this.get("sheenRoughnessFactor")}setSheenRoughnessFactor(t){return this.set("sheenRoughnessFactor",t)}getSheenRoughnessTexture(){return this.getRef("sheenRoughnessTexture")}getSheenRoughnessTextureInfo(){return this.getRef("sheenRoughnessTexture")?this.getRef("sheenRoughnessTextureInfo"):null}setSheenRoughnessTexture(t){return this.setRef("sheenRoughnessTexture",t,{channels:_m})}},Rm=class extends ie{static EXTENSION_NAME=Lt;extensionName=Lt;prereadTypes=[F.MESH];prewriteTypes=[F.MESH];createSheen(){return new Im(this.document.getGraph())}read(t){return this}write(t){return this}preread(t){let e=t.jsonDoc,a=e.json.materials||[],r=e.json.textures||[];return a.forEach((s,n)=>{if(s.extensions&&s.extensions.KHR_materials_sheen){let i=this.createSheen();t.materials[n].setExtension(Lt,i);let o=s.extensions[Lt];if(o.extras&&i.setExtras(o.extras),o.sheenColorFactor!==void 0&&i.setSheenColorFactor(o.sheenColorFactor),o.sheenRoughnessFactor!==void 0&&i.setSheenRoughnessFactor(o.sheenRoughnessFactor),o.sheenColorTexture!==void 0){let c=o.sheenColorTexture,l=t.textures[r[c.index].source];i.setSheenColorTexture(l),t.setTextureInfo(i.getSheenColorTextureInfo(),c)}if(o.sheenRoughnessTexture!==void 0){let c=o.sheenRoughnessTexture,l=t.textures[r[c.index].source];i.setSheenRoughnessTexture(l),t.setTextureInfo(i.getSheenRoughnessTextureInfo(),c)}}}),this}prewrite(t){let e=t.jsonDoc;return this.document.getRoot().listMaterials().forEach(a=>{let r=a.getExtension(Lt);if(r){let s=t.materialIndexMap.get(a),n=e.json.materials[s],i=t.createPropertyDef(r);if(n.extensions=n.extensions||{},n.extensions[Lt]=i,i.sheenColorFactor=r.getSheenColorFactor(),i.sheenRoughnessFactor=r.getSheenRoughnessFactor(),r.getSheenColorTexture()){let o=r.getSheenColorTexture(),c=r.getSheenColorTextureInfo();i.sheenColorTexture=t.createTextureInfoDef(o,c)}if(r.getSheenRoughnessTexture()){let o=r.getSheenRoughnessTexture(),c=r.getSheenRoughnessTextureInfo();i.sheenRoughnessTexture=t.createTextureInfoDef(o,c)}}}),this}},{R:Nm,G:Cm,B:Bm,A:Om}=Qe,Fm=class extends J{static EXTENSION_NAME=Dt;init(){this.extensionName=Dt,this.propertyType="Specular",this.parentTypes=[F.MATERIAL]}getDefaults(){return Object.assign(super.getDefaults(),{specularFactor:1,specularTexture:null,specularTextureInfo:new ue(this.graph,"specularTextureInfo"),specularColorFactor:[1,1,1],specularColorTexture:null,specularColorTextureInfo:new ue(this.graph,"specularColorTextureInfo")})}getSpecularFactor(){return this.get("specularFactor")}setSpecularFactor(t){return this.set("specularFactor",t)}getSpecularColorFactor(){return this.get("specularColorFactor")}setSpecularColorFactor(t){return this.set("specularColorFactor",t)}getSpecularTexture(){return this.getRef("specularTexture")}getSpecularTextureInfo(){return this.getRef("specularTexture")?this.getRef("specularTextureInfo"):null}setSpecularTexture(t){return this.setRef("specularTexture",t,{channels:Om})}getSpecularColorTexture(){return this.getRef("specularColorTexture")}getSpecularColorTextureInfo(){return this.getRef("specularColorTexture")?this.getRef("specularColorTextureInfo"):null}setSpecularColorTexture(t){return this.setRef("specularColorTexture",t,{channels:Nm|Cm|Bm,isColor:!0})}},Pm=class extends ie{static EXTENSION_NAME=Dt;extensionName=Dt;prereadTypes=[F.MESH];prewriteTypes=[F.MESH];createSpecular(){return new Fm(this.document.getGraph())}read(t){return this}write(t){return this}preread(t){let e=t.jsonDoc,a=e.json.materials||[],r=e.json.textures||[];return a.forEach((s,n)=>{if(s.extensions&&s.extensions.KHR_materials_specular){let i=this.createSpecular();t.materials[n].setExtension(Dt,i);let o=s.extensions[Dt];if(o.extras&&i.setExtras(o.extras),o.specularFactor!==void 0&&i.setSpecularFactor(o.specularFactor),o.specularColorFactor!==void 0&&i.setSpecularColorFactor(o.specularColorFactor),o.specularTexture!==void 0){let c=o.specularTexture,l=t.textures[r[c.index].source];i.setSpecularTexture(l),t.setTextureInfo(i.getSpecularTextureInfo(),c)}if(o.specularColorTexture!==void 0){let c=o.specularColorTexture,l=t.textures[r[c.index].source];i.setSpecularColorTexture(l),t.setTextureInfo(i.getSpecularColorTextureInfo(),c)}}}),this}prewrite(t){let e=t.jsonDoc;return this.document.getRoot().listMaterials().forEach(a=>{let r=a.getExtension(Dt);if(r){let s=t.materialIndexMap.get(a),n=e.json.materials[s],i=t.createPropertyDef(r);if(n.extensions=n.extensions||{},n.extensions[Dt]=i,r.getSpecularFactor()!==1&&(i.specularFactor=r.getSpecularFactor()),fe.eq(r.getSpecularColorFactor(),[1,1,1])||(i.specularColorFactor=r.getSpecularColorFactor()),r.getSpecularTexture()){let o=r.getSpecularTexture(),c=r.getSpecularTextureInfo();i.specularTexture=t.createTextureInfoDef(o,c)}if(r.getSpecularColorTexture()){let o=r.getSpecularColorTexture(),c=r.getSpecularColorTextureInfo();i.specularColorTexture=t.createTextureInfoDef(o,c)}}}),this}},{R:jm}=Qe,Lm=class extends J{static EXTENSION_NAME=Ut;init(){this.extensionName=Ut,this.propertyType="Transmission",this.parentTypes=[F.MATERIAL]}getDefaults(){return Object.assign(super.getDefaults(),{transmissionFactor:0,transmissionTexture:null,transmissionTextureInfo:new ue(this.graph,"transmissionTextureInfo")})}getTransmissionFactor(){return this.get("transmissionFactor")}setTransmissionFactor(t){return this.set("transmissionFactor",t)}getTransmissionTexture(){return this.getRef("transmissionTexture")}getTransmissionTextureInfo(){return this.getRef("transmissionTexture")?this.getRef("transmissionTextureInfo"):null}setTransmissionTexture(t){return this.setRef("transmissionTexture",t,{channels:jm})}},Dm=class extends ie{static EXTENSION_NAME=Ut;extensionName=Ut;prereadTypes=[F.MESH];prewriteTypes=[F.MESH];createTransmission(){return new Lm(this.document.getGraph())}read(t){return this}write(t){return this}preread(t){let e=t.jsonDoc,a=e.json.materials||[],r=e.json.textures||[];return a.forEach((s,n)=>{if(s.extensions&&s.extensions.KHR_materials_transmission){let i=this.createTransmission();t.materials[n].setExtension(Ut,i);let o=s.extensions[Ut];if(o.extras&&i.setExtras(o.extras),o.transmissionFactor!==void 0&&i.setTransmissionFactor(o.transmissionFactor),o.transmissionTexture!==void 0){let c=o.transmissionTexture,l=t.textures[r[c.index].source];i.setTransmissionTexture(l),t.setTextureInfo(i.getTransmissionTextureInfo(),c)}}}),this}prewrite(t){let e=t.jsonDoc;return this.document.getRoot().listMaterials().forEach(a=>{let r=a.getExtension(Ut);if(r){let s=t.materialIndexMap.get(a),n=e.json.materials[s],i=t.createPropertyDef(r);if(n.extensions=n.extensions||{},n.extensions[Ut]=i,i.transmissionFactor=r.getTransmissionFactor(),r.getTransmissionTexture()){let o=r.getTransmissionTexture(),c=r.getTransmissionTextureInfo();i.transmissionTexture=t.createTextureInfoDef(o,c)}}}),this}},Um=class extends J{static EXTENSION_NAME=ya;init(){this.extensionName=ya,this.propertyType="Unlit",this.parentTypes=[F.MATERIAL]}},zm=class extends ie{static EXTENSION_NAME=ya;extensionName=ya;prereadTypes=[F.MESH];prewriteTypes=[F.MESH];createUnlit(){return new Um(this.document.getGraph())}read(t){return this}write(t){return this}preread(t){return(t.jsonDoc.json.materials||[]).forEach((e,a)=>{e.extensions&&e.extensions.KHR_materials_unlit&&t.materials[a].setExtension(ya,this.createUnlit())}),this}prewrite(t){let e=t.jsonDoc;return this.document.getRoot().listMaterials().forEach(a=>{if(a.getExtension("KHR_materials_unlit")){let r=t.materialIndexMap.get(a),s=e.json.materials[r];s.extensions=s.extensions||{},s.extensions[ya]={}}}),this}},Gm=class extends J{static EXTENSION_NAME=Ve;init(){this.extensionName=Ve,this.propertyType="Mapping",this.parentTypes=["MappingList"]}getDefaults(){return Object.assign(super.getDefaults(),{material:null,variants:new ce})}getMaterial(){return this.getRef("material")}setMaterial(t){return this.setRef("material",t)}addVariant(t){return this.addRef("variants",t)}removeVariant(t){return this.removeRef("variants",t)}listVariants(){return this.listRefs("variants")}},Km=class extends J{static EXTENSION_NAME=Ve;init(){this.extensionName=Ve,this.propertyType="MappingList",this.parentTypes=[F.PRIMITIVE]}getDefaults(){return Object.assign(super.getDefaults(),{mappings:new ce})}addMapping(t){return this.addRef("mappings",t)}removeMapping(t){return this.removeRef("mappings",t)}listMappings(){return this.listRefs("mappings")}},cl=class extends J{static EXTENSION_NAME=Ve;init(){this.extensionName=Ve,this.propertyType="Variant",this.parentTypes=["MappingList"]}},Vm=class extends ie{extensionName=Ve;static EXTENSION_NAME=Ve;createMappingList(){return new Km(this.document.getGraph())}createVariant(t=""){return new cl(this.document.getGraph(),t)}createMapping(){return new Gm(this.document.getGraph())}listVariants(){return Array.from(this.properties).filter(t=>t instanceof cl)}read(t){let e=t.jsonDoc;if(!e.json.extensions||!e.json.extensions.KHR_materials_variants)return this;let a=(e.json.extensions.KHR_materials_variants.variants||[]).map(r=>this.createVariant().setName(r.name||""));return(e.json.meshes||[]).forEach((r,s)=>{let n=t.meshes[s];(r.primitives||[]).forEach((i,o)=>{if(!i.extensions||!i.extensions.KHR_materials_variants)return;let c=this.createMappingList(),l=i.extensions[Ve];for(let f of l.mappings){let u=this.createMapping();f.material!==void 0&&u.setMaterial(t.materials[f.material]);for(let g of f.variants||[])u.addVariant(a[g]);c.addMapping(u)}n.listPrimitives()[o].setExtension(Ve,c)})}),this}write(t){let e=t.jsonDoc,a=this.listVariants();if(!a.length)return this;let r=[],s=new Map;for(let n of a)s.set(n,r.length),r.push(t.createPropertyDef(n));for(let n of this.document.getRoot().listMeshes()){let i=t.meshIndexMap.get(n);n.listPrimitives().forEach((o,c)=>{let l=o.getExtension(Ve);if(!l)return;let f=t.jsonDoc.json.meshes[i].primitives[c],u=l.listMappings().map(g=>{let p=t.createPropertyDef(g),h=g.getMaterial();return h&&(p.material=t.materialIndexMap.get(h)),p.variants=g.listVariants().map(d=>s.get(d)),p});f.extensions=f.extensions||{},f.extensions[Ve]={mappings:u}})}return e.json.extensions=e.json.extensions||{},e.json.extensions[Ve]={variants:r},this}},{G:qm}=Qe,Hm=class extends J{static EXTENSION_NAME=zt;init(){this.extensionName=zt,this.propertyType="Volume",this.parentTypes=[F.MATERIAL]}getDefaults(){return Object.assign(super.getDefaults(),{thicknessFactor:0,thicknessTexture:null,thicknessTextureInfo:new ue(this.graph,"thicknessTexture"),attenuationDistance:1/0,attenuationColor:[1,1,1]})}getThicknessFactor(){return this.get("thicknessFactor")}setThicknessFactor(t){return this.set("thicknessFactor",t)}getThicknessTexture(){return this.getRef("thicknessTexture")}getThicknessTextureInfo(){return this.getRef("thicknessTexture")?this.getRef("thicknessTextureInfo"):null}setThicknessTexture(t){return this.setRef("thicknessTexture",t,{channels:qm})}getAttenuationDistance(){return this.get("attenuationDistance")}setAttenuationDistance(t){return this.set("attenuationDistance",t)}getAttenuationColor(){return this.get("attenuationColor")}setAttenuationColor(t){return this.set("attenuationColor",t)}},Wm=class extends ie{static EXTENSION_NAME=zt;extensionName=zt;prereadTypes=[F.MESH];prewriteTypes=[F.MESH];createVolume(){return new Hm(this.document.getGraph())}read(t){return this}write(t){return this}preread(t){let e=t.jsonDoc,a=e.json.materials||[],r=e.json.textures||[];return a.forEach((s,n)=>{if(s.extensions&&s.extensions.KHR_materials_volume){let i=this.createVolume();t.materials[n].setExtension(zt,i);let o=s.extensions[zt];if(o.extras&&i.setExtras(o.extras),o.thicknessFactor!==void 0&&i.setThicknessFactor(o.thicknessFactor),o.attenuationDistance!==void 0&&i.setAttenuationDistance(o.attenuationDistance),o.attenuationColor!==void 0&&i.setAttenuationColor(o.attenuationColor),o.thicknessTexture!==void 0){let c=o.thicknessTexture,l=t.textures[r[c.index].source];i.setThicknessTexture(l),t.setTextureInfo(i.getThicknessTextureInfo(),c)}}}),this}prewrite(t){let e=t.jsonDoc;return this.document.getRoot().listMaterials().forEach(a=>{let r=a.getExtension(zt);if(r){let s=t.materialIndexMap.get(a),n=e.json.materials[s],i=t.createPropertyDef(r);if(n.extensions=n.extensions||{},n.extensions[zt]=i,r.getThicknessFactor()>0&&(i.thicknessFactor=r.getThicknessFactor()),Number.isFinite(r.getAttenuationDistance())&&(i.attenuationDistance=r.getAttenuationDistance()),fe.eq(r.getAttenuationColor(),[1,1,1])||(i.attenuationColor=r.getAttenuationColor()),r.getThicknessTexture()){let o=r.getThicknessTexture(),c=r.getThicknessTextureInfo();i.thicknessTexture=t.createTextureInfoDef(o,c)}}}),this}},Xm=class extends ie{extensionName=qc;static EXTENSION_NAME=qc;read(t){return this}write(t){return this}},Zn=class extends ie{extensionName=Hc;static EXTENSION_NAME=Hc;read(t){return this}write(t){return this}},$m=class extends J{static EXTENSION_NAME=Gt;init(){this.extensionName=Gt,this.propertyType="Visibility",this.parentTypes=[F.NODE]}getDefaults(){return Object.assign(super.getDefaults(),{visible:!0})}getVisible(){return this.get("visible")}setVisible(t){return this.set("visible",t)}},Ym=class extends ie{static EXTENSION_NAME=Gt;extensionName=Gt;createVisibility(){return new $m(this.document.getGraph())}read(t){return(t.jsonDoc.json.nodes||[]).forEach((e,a)=>{if(e.extensions&&e.extensions.KHR_node_visibility){let r=this.createVisibility();t.nodes[a].setExtension(Gt,r);let s=e.extensions[Gt];s.visible!==void 0&&r.setVisible(s.visible)}}),this}write(t){let e=t.jsonDoc;for(let a of this.document.getRoot().listNodes()){let r=a.getExtension(Gt);if(!r)continue;let s=t.nodeIndexMap.get(a),n=e.json.nodes[s];n.extensions=n.extensions||{},n.extensions[Gt]={visible:r.getVisible()}}return this}};function Jm(t){return t.vkFormat>0&&t.vkFormat<=123}function ll(t){let e=t.vkFormat===1000066e3&&t.dataFormatDescriptor[0].colorModel===167;return t.vkFormat===0||e}var Qm=class{match(t){return t[0]===171&&t[1]===75&&t[2]===84&&t[3]===88&&t[4]===32&&t[5]===50&&t[6]===48&&t[7]===187&&t[8]===13&&t[9]===10&&t[10]===26&&t[11]===10}getSize(t){let e=Qr(t);return[e.pixelWidth,e.pixelHeight]}getChannels(t){let e=Qr(t),a=e.dataFormatDescriptor[0];if(Jm(e))return a.samples.length;if(ll(e))switch(a.colorModel){case 163:return a.samples.length===2&&(a.samples[1].channelType&15)===15?4:3;case 166:return(a.samples[0].channelType&15)===3?4:3;default:throw new Error(`Unexpected KTX2 colorModel, "${a.colorModel}".`)}throw new Error(`Unexpected KTX2 vkFormat, "${e.vkFormat}".`)}getVRAMByteLength(t){let e=Qr(t),a=0;if(ll(e)){let r=this.getChannels(t)>3;for(let s=0;s<e.levels.length;s++){let n=e.levels[s];if(n.uncompressedByteLength)a+=n.uncompressedByteLength;else{let i=Math.max(1,Math.floor(e.pixelWidth/Math.pow(2,s))),o=Math.max(1,Math.floor(e.pixelHeight/Math.pow(2,s))),c=r?16:8;a+=i/4*(o/4)*c}}}else for(let r of e.levels)e.supercompressionScheme===0?a+=r.levelData.byteLength:a+=r.uncompressedByteLength;return a}},Zm=class extends ie{static EXTENSION_NAME=ts;extensionName=ts;prereadTypes=[F.TEXTURE];static register(){ot.registerFormat("image/ktx2",new Qm)}preread(t){return t.jsonDoc.json.textures&&t.jsonDoc.json.textures.forEach(e=>{e.extensions&&e.extensions.KHR_texture_basisu&&(e.source=e.extensions[ts].source)}),this}read(t){return this}write(t){let e=t.jsonDoc;return this.document.getRoot().listTextures().forEach(a=>{if(a.getMimeType()==="image/ktx2"){let r=t.imageIndexMap.get(a);e.json.textures.forEach(s=>{s.source===r&&(s.extensions=s.extensions||{},s.extensions[ts]={source:s.source},delete s.source)})}}),this}},ey=class extends J{static EXTENSION_NAME=Kt;init(){this.extensionName=Kt,this.propertyType="Transform",this.parentTypes=[F.TEXTURE_INFO]}getDefaults(){return Object.assign(super.getDefaults(),{offset:[0,0],rotation:0,scale:[1,1],texCoord:null})}getOffset(){return this.get("offset")}setOffset(t){return this.set("offset",t)}getRotation(){return this.get("rotation")}setRotation(t){return this.set("rotation",t)}getScale(){return this.get("scale")}setScale(t){return this.set("scale",t)}getTexCoord(){return this.get("texCoord")}setTexCoord(t){return this.set("texCoord",t)}},ty=class extends ie{extensionName=Kt;static EXTENSION_NAME=Kt;createTransform(){return new ey(this.document.getGraph())}read(t){for(let[e,a]of Array.from(t.textureInfos.entries())){if(!a.extensions||!a.extensions.KHR_texture_transform)continue;let r=this.createTransform(),s=a.extensions[Kt];s.offset!==void 0&&r.setOffset(s.offset),s.rotation!==void 0&&r.setRotation(s.rotation),s.scale!==void 0&&r.setScale(s.scale),s.texCoord!==void 0&&r.setTexCoord(s.texCoord),e.setExtension(Kt,r)}return this}write(t){let e=Array.from(t.textureInfoDefMap.entries());for(let[a,r]of e){let s=a.getExtension(Kt);if(!s)continue;r.extensions=r.extensions||{};let n={},i=fe.eq;i(s.getOffset(),[0,0])||(n.offset=s.getOffset()),s.getRotation()!==0&&(n.rotation=s.getRotation()),i(s.getScale(),[1,1])||(n.scale=s.getScale()),s.getTexCoord()!=null&&(n.texCoord=s.getTexCoord()),r.extensions[Kt]=n}return this}},ay=[F.ROOT,F.SCENE,F.NODE,F.MESH,F.MATERIAL,F.TEXTURE,F.ANIMATION],ry=class extends J{static EXTENSION_NAME=Ze;init(){this.extensionName=Ze,this.propertyType="Packet",this.parentTypes=ay}getDefaults(){return Object.assign(super.getDefaults(),{context:{},properties:{}})}getContext(){return this.get("context")}setContext(t){return this.set("context",{...t})}listProperties(){return Object.keys(this.get("properties"))}getProperty(t){let e=this.get("properties");return t in e?e[t]:null}setProperty(t,e){this._assertContext(t);let a={...this.get("properties")};return e?a[t]=e:delete a[t],this.set("properties",a)}toJSONLD(){return{"@context":Wn(this.get("context")),...Wn(this.get("properties"))}}fromJSONLD(t){t=Wn(t);let e=t["@context"];return e&&this.set("context",e),delete t["@context"],this.set("properties",t)}_assertContext(t){if(!(t.split(":")[0]in this.get("context")))throw new Error(`${Ze}: Missing context for term, "${t}".`)}};function Wn(t){return JSON.parse(JSON.stringify(t))}var sy=class extends ie{extensionName=Ze;static EXTENSION_NAME=Ze;createPacket(){return new ry(this.document.getGraph())}listPackets(){return Array.from(this.properties)}read(t){let e=t.jsonDoc.json.extensions?.[Ze];if(!e||!e.packets)return this;let a=t.jsonDoc.json,r=this.document.getRoot(),s=e.packets.map(o=>this.createPacket().fromJSONLD(o)),n=[[a.asset],a.scenes,a.nodes,a.meshes,a.materials,a.images,a.animations],i=[[r],r.listScenes(),r.listNodes(),r.listMeshes(),r.listMaterials(),r.listTextures(),r.listAnimations()];for(let o=0;o<n.length;o++){let c=n[o]||[];for(let l=0;l<c.length;l++){let f=c[l];if(f.extensions&&f.extensions.KHR_xmp_json_ld){let u=f.extensions[Ze];i[o][l].setExtension(Ze,s[u.packet])}}}return this}write(t){let{json:e}=t.jsonDoc,a=[];for(let r of this.properties){a.push(r.toJSONLD());for(let s of r.listParents()){let n;switch(s.propertyType){case F.ROOT:n=e.asset;break;case F.SCENE:n=e.scenes[t.sceneIndexMap.get(s)];break;case F.NODE:n=e.nodes[t.nodeIndexMap.get(s)];break;case F.MESH:n=e.meshes[t.meshIndexMap.get(s)];break;case F.MATERIAL:n=e.materials[t.materialIndexMap.get(s)];break;case F.TEXTURE:n=e.images[t.imageIndexMap.get(s)];break;case F.ANIMATION:n=e.animations[t.animationIndexMap.get(s)];break;default:n=null,this.document.getLogger().warn(`[${Ze}]: Unsupported parent property, "${s.propertyType}"`);break}n&&(n.extensions=n.extensions||{},n.extensions[Ze]={packet:a.length-1})}}return a.length>0&&(e.extensions=e.extensions||{},e.extensions[Ze]={packets:a}),this}},ny=[Dg,Ug,Yg,Qg,rm,im,fm,bm,gm,ym,km,Mm,Pm,Rm,Dm,zm,Vm,Wm,Xm,Zn,Ym,Zm,ty,sy],lk=[Lp,Jn,Qn,lg,Pg,Lg,...ny];var _E=(function(){var t="b9H79Tebbbe9ok9Geueu9Geub9Gbb9Gruuuuuuueu9Gvuuuuueu9Gduueu9Gluuuueu9Gvuuuuub9Gouuuuuub9Gluuuub9Giuuueui8AYdilveoveovrrwrrDDoDrbqqbelve9Weiiviebeoweuec;G:Qdkr:nlAo9TW9T9VV95dbH9F9F939H79T9F9J9H229F9Jt9VV7bb8F9TW79O9V9Wt9FW9U9J9V9KW9wWVtW949c919M9MWV9mW4W2be8A9TW79O9V9Wt9FW9U9J9V9KW9wWVtW949c919M9MWVbd8F9TW79O9V9Wt9FW9U9J9V9KW9wWVtW949c919M9MWV9c9V919U9KbiE9TW79O9V9Wt9FW9U9J9V9KW9wWVtW949wWV79P9V9UblY9TW79O9V9Wt9FW9U9J9V9KW69U9KW949c919M9MWVbv8E9TW79O9V9Wt9FW9U9J9V9KW69U9KW949c919M9MWV9c9V919U9Kbo8A9TW79O9V9Wt9FW9U9J9V9KW69U9KW949wWV79P9V9UbrE9TW79O9V9Wt9FW9U9J9V9KW69U9KW949tWG91W9U9JWbwa9TW79O9V9Wt9FW9U9J9V9KW69U9KW949tWG91W9U9JW9c9V919U9KbDL9TW79O9V9Wt9FW9U9J9V9KWS9P2tWV9p9JtbqK9TW79O9V9Wt9FW9U9J9V9KWS9P2tWV9r919HtbkL9TW79O9V9Wt9FW9U9J9V9KWS9P2tWVT949WbxE9TW79O9V9Wt9F9V9Wt9P9T9P96W9wWVtW94J9H9J9OWbsa9TW79O9V9Wt9F9V9Wt9P9T9P96W9wWVtW94J9H9J9OW9ttV9P9Wbza9TW79O9V9Wt9F9V9Wt9P9T9P96W9wWVtW94SWt9J9O9sW9T9H9WbHK9TW79O9V9Wt9F79W9Ht9P9H29t9VVt9sW9T9H9WbOl79IV9RbCDwebcekdKLqN9OYdbk:Bhdhud9:8Jjjjjbc;qw9Rgr8KjjjjbcbhwdnaeTmbabcbyd;C:kjjbaoaocb9iEgDc:GeV86bbarc;adfcbcjdz:wjjjb8AdnaiTmbarc;adfadalz:vjjjb8Akarc;abfalfcbcbcjdal9RalcFe0Ez:wjjjb8Aarc;abfarc;adfalz:vjjjb8AarcUf9cb83ibarc8Wf9cb83ibarcyf9cb83ibarcaf9cb83ibarcKf9cb83ibarczf9cb83ibar9cb83iwar9cb83ibcj;abal9Uc;WFbGcjdalca0Ehqdnaicd6mbavcd9imbaDTmbadcefhkaqci2gxal2hmarc;alfclfhParc;qlfceVhsarc;qofclVhzarc;qofcKfhHarc;qofczfhOcbhAincdhCcbhodnavci6mbaH9cb83ibaO9cb83ibar9cb83i;yoar9cb83i;qoadaAfgoybbhXcbhQincbhwcbhLdninaoalfhKaoybbgYaX7aLVhLawcP0meaKhoaYhXawcefgwaQfai6mbkkcbhXarc;qofhwincwh8AcwhEdnaLaX93gocFeGg3cs0mbclhEa3ci0mba3cb9hcethEkdnaocw4cFeGg3cs0mbclh8Aa3ci0mba3cb9hceth8Aka8AaEfh3awydbh5cwh8AcwhEdnaocz4cFeGg8Ecs0mbclhEa8Eci0mba8Ecb9hcethEka3a5fh3dnaocFFFFb0mbclh8AaocFFF8F0mbaocFFFr0ceth8Akawa3aEfa8AfBdbawclfhwaXcefgXcw9hmbkaKhoaYhXaQczfgQai6mbkcbhocehwazhLinawaoaLydbarc;qofaocdtfydb6EhoaLclfhLawcefgwcw9hmbkcihCkcbh3arc;qlfcbcjdz:wjjjb8Aarc;alfcwfcbBdbar9cb83i;alaoclth8Fadhaaqhhakh5inarc;qlfadcba3cufgoaoa30Eal2falz:vjjjb8Aaiahaiah6Ehgdnaqaia39Ra3aqfai6EgYcsfc9WGgoaY9nmbarc;qofaYfcbaoaY9Rz:wjjjb8Akada3al2fh8Jcbh8Kina8Ka8FVcl4hQarc;alfa8Kcdtfh8LaAh8Mcbh8Nina8NaAfhwdndndndndndna8KPldebidkasa8Mc98GgLfhoa5aLfh8Aarc;qlfawc98GgLfRbbhXcwhwinaoRbbawtaXVhXaocefhoawcwfgwca9hmbkaYTmla8Ncith8Ea8JaLfhEcbhKinaERbbhLcwhoa8AhwinawRbbaotaLVhLawcefhwaocwfgoca9hmbkarc;qofaKfaLaX7aQ93a8E486bba8Aalfh8AaEalfhEaLhXaKcefgKaY9hmbxlkkaYTmia8Mc9:Ghoa8NcitcwGhEarc;qlfawceVfRbbcwtarc;qlfawc9:GfRbbVhLarc;qofhwaghXinawa5aofRbbcwtaaaofRbbVg8AaL9RgLcetaLcztcz91cs47cFFiGaE486bbaoalfhoawcefhwa8AhLa3aXcufgX9hmbxikkaYTmda8Jawfhoarc;qlfawfRbbhLarc;qofhwaghXinawaoRbbg8AaL9RgLcetaLcKtcK91cr4786bbawcefhwaoalfhoa8AhLa3aXcufgX9hmbxdkkaYTmeka8LydbhEcbhKarc;qofhoincdhLcbhwinaLaoawfRbbcb9hfhLawcefgwcz9hmbkclhXcbhwinaXaoawfRbbcd0fhXawcefgwcz9hmbkcwh8Acbhwina8AaoawfRbbcP0fh8Aawcefgwcz9hmbkaLaXaLaX6Egwa8Aawa8A6Egwczawcz6EaEfhEaoczfhoaKczfgKaY6mbka8LaEBdbka8Mcefh8Ma8Ncefg8Ncl9hmbka8Kcefg8KaC9hmbkaaamfhaahaxfhha5amfh5a3axfg3ai6mbkcbhocehwaPhLinawaoaLydbarc;alfaocdtfydb6EhoaLclfhLawcefgXhwaCaX9hmbkaraAcd4fa8FcdVaoaocdSE86bbaAclfgAal6mbkkabaefh8Kabcefhoalcd4gecbaDEhkadcefhOarc;abfceVhHcbhmdndninaiam9nmearc;qofcbcjdz:wjjjb8Aa8Kao9Rak6mdadamal2gwfhxcbh8JaOawfhzaocbakz:wjjjbghakfh5aqaiam9Ramaqfai6Egscsfgocl4cifcd4hCaoc9WGg8LThPindndndndndndndndndndnaDTmbara8Jcd4fRbbgLciGPlbedlbkasTmdaxa8Jfhoarc;abfa8JfRbbhLarc;qofhwashXinawaoRbbg8AaL9RgLcetaLcKtcK91cr4786bbawcefhwaoalfhoa8AhLaXcufgXmbxikkasTmia8JcitcwGhEarc;abfa8JceVfRbbcwtarc;abfa8Jc9:GgofRbbVhLaxaofhoarc;qofhwashXinawao8Vbbg8AaL9RgLcetaLcztcz91cs47cFFiGaE486bbawcefhwaoalfhoa8AhLaXcufgXmbxdkkaHa8Jc98GgEfhoazaEfh8Aarc;abfaEfRbbhXcwhwinaoRbbawtaXVhXaocefhoawcwfgwca9hmbkasTmbaLcl4hYa8JcitcKGh3axaEfhEcbhKinaERbbhLcwhoa8AhwinawRbbaotaLVhLawcefhwaocwfgoca9hmbkarc;qofaKfaLaX7aY93a3486bba8Aalfh8AaEalfhEaLhXaKcefgKas9hmbkkaDmbcbhoxlka8LTmbcbhodninarc;qofaofgwcwf8Pibaw8Pib:e9qTmeaoczfgoa8L9pmdxbkkdnavmbcehoxikcbhEaChKaChYinarc;qofaEfgocwf8Pibhyao8Pibh8PcdhLcbhwinaLaoawfRbbcb9hfhLawcefgwcz9hmbkclhXcbhwinaXaoawfRbbcd0fhXawcefgwcz9hmbkcwh8Acbhwina8AaoawfRbbcP0fh8Aawcefgwcz9hmbkaLaXaLaX6Egoa8Aaoa8A6Egoczaocz6EaYfhYaocucbaya8P:e9cb9sEgwaoaw6EaKfhKaEczfgEa8L9pmdxbkkaha8Jcd4fgoaoRbbcda8JcetcoGtV86bbxikdnaKas6mbaYas6mbaha8Jcd4fgoaoRbbcia8JcetcoGtV86bba8Ka59Ras6mra5arc;qofasz:vjjjbasfh5xikaKaY9phokaha8Jcd4fgwawRbbaoa8JcetcoGtV86bbka8Ka59RaC6mla5cbaCz:wjjjbgAaCfhYdndna8LmbaPhoxekdna8KaY9RcK9pmbaPhoxekaocdtc:q1jjbfcj1jjbaDEg5ydxggcetc;:FFFeGh8Fcuh3cuagtcu7cFeGhacbh8Marc;qofhLinarc;qofa8MfhQczhEdndndnagPDbeeeeeeedekcucbaQcwf8PibaQ8Pib:e9cb9sEhExekcbhoa8FhEinaEaaaLaofRbb9nfhEaocefgocz9hmbkkcih8Ecbh8Ainczhwdndndna5a8AcdtfydbgKPDbeeeeeeedekcucbaQcwf8PibaQ8Pib:e9cb9sEhwxekaKcetc;:FFFeGhwcuaKtcu7cFeGhXcbhoinawaXaLaofRbb9nfhwaocefgocz9hmbkkdndnawaE6mbaKa39hmeawaE9hmea5a8EcdtfydbcwSmeka8Ah8EawhEka8Acefg8Aci9hmbkaAa8Mco4fgoaoRbba8Ea8Mci4coGtV86bbdndndna5a8Ecdtfydbg3PDdbbbbbbbebkdncwa39Tg8ETmbcua3tcu7hwdndna3ceSmbcbh8NaLhQinaQhoa8Eh8AcbhXinaoRbbgEawcFeGgKaEaK6EaXa3tVhXaocefhoa8Acufg8AmbkaYaX86bbaQa8EfhQaYcefhYa8Na8Efg8Ncz6mbxdkkcbh8NaLhQinaQhoa8Eh8AcbhXinaoRbbgEawcFeGgKaEaK6EaXcetVhXaocefhoa8Acufg8AmbkaYaX:T9cFe:d9c:c:qj:bw9:9c:q;c1:I1e:d9c:b:c:e1z9:9ca188bbaQa8EfhQaYcefhYa8Na8Efg8Ncz6mbkkcbhoinaYaLaofRbbgX86bbaYaXawcFeG9pfhYaocefgocz9hmbxikkdna3ceSmbinaYcb86bbaYcefhYxbkkinaYcb86bbaYcefhYxbkkaYaQ8Pbb83bbaYcwfaQcwf8Pbb83bbaYczfhYka8Mczfg8Ma8L9pgomeaLczfhLa8KaY9RcK9pmbkkaoTmlaYh5aYTmlka8Jcefg8Jal9hmbkarc;abfaxascufal2falz:vjjjb8Aasamfhma5hoa5mbkcbhwxdkdna8Kao9RakalfgwcKcaaDEgLawaL0EgX9pmbcbhwxdkdnawaL9pmbaocbaXaw9Rgwz:wjjjbawfhokaoarc;adfalz:vjjjbalfhodnaDTmbaoaraez:vjjjbaefhokaoab9Rhwxekcbhwkarc;qwf8Kjjjjbawk5babaeadaialcdcbyd;C:kjjbz:bjjjbk9reduaecd4gdaefgicaaica0Eabcj;abae9Uc;WFbGcjdaeca0Egifcufai9Uae2aiadfaicl4cifcd4f2fcefkmbcbabBd;C:kjjbk:Ese5u8Jjjjjbc;ae9Rgl8Kjjjjbcbhvdnaici9UgocHfae0mbabcbyd;m:kjjbgrc;GeV86bbalc;abfcFecjez:wjjjb8AalcUfgw9cu83ibalc8WfgD9cu83ibalcyfgq9cu83ibalcafgk9cu83ibalcKfgx9cu83ibalczfgm9cu83ibal9cu83iwal9cu83ibabaefc9WfhPabcefgsaofhednaiTmbcmcsarcb9kgzEhHcbhOcbhAcbhCcbhXcbhQindnaeaP9nmbcbhvxikaQcufhvadaCcdtfgLydbhKaLcwfydbhYaLclfydbh8AcbhEdndndninalc;abfavcsGcitfgoydlh3dndndnaoydbgoaK9hmba3a8ASmekdnaoa8A9hmba3aY9hmbaEcefhExekaoaY9hmea3aK9hmeaEcdfhEkaEc870mdaXcufhvaLaEciGcx2goc;i1jjbfydbcdtfydbh3aLaoc;e1jjbfydbcdtfydbh8AaLaoc;a1jjbfydbcdtfydbhKcbhodnindnalavcsGcdtfydba39hmbaohYxdkcuhYavcufhvaocefgocz9hmbkkaOa3aOSgvaYce9iaYaH9oVgoGfhOdndndncbcsavEaYaoEgvcs9hmbarce9imba3a3aAa3cefaASgvEgAcefSmecmcsavEhvkasavaEcdtc;WeGV86bbavcs9hmea3aA9Rgvcetavc8F917hvinaeavcFb0crtavcFbGV86bbaecefheavcje6hoavcr4hvaoTmbka3hAxvkcPhvasaEcdtcPV86bba3hAkavTmiavaH9omicdhocehEaQhYxlkavcufhvaEclfgEc;ab9hmbkkdnaLceaYaOSceta8AaOSEcx2gvc;a1jjbfydbcdtfydbgKTaLavc;e1jjbfydbcdtfydbg8AceSGaLavc;i1jjbfydbcdtfydbg3cdSGaOcb9hGazGg5ce9hmbaw9cu83ibaD9cu83ibaq9cu83ibak9cu83ibax9cu83ibam9cu83ibal9cu83iwal9cu83ibcbhOkcbhEaXcufgvhodnindnalaocsGcdtfydba8A9hmbaEhYxdkcuhYaocufhoaEcefgEcz9hmbkkcbhodnindnalavcsGcdtfydba39hmbaohExdkcuhEavcufhvaocefgocz9hmbkkaOaKaOSg8EfhLdndnaYcm0mbaYcefhYxekcbcsa8AaLSgvEhYaLavfhLkdndnaEcm0mbaEcefhExekcbcsa3aLSgvEhEaLavfhLkc9:cua8EEh8FcbhvaEaYcltVgacFeGhodndndninavc:W1jjbfRbbaoSmeavcefgvcz9hmbxdkka5aKaO9havcm0VVmbasavc;WeV86bbxekasa8F86bbaeaa86bbaecefhekdna8EmbaKaA9Rgvcetavc8F917hvinaeavcFb0gocrtavcFbGV86bbavcr4hvaecefheaombkaKhAkdnaYcs9hmba8AaA9Rgvcetavc8F917hvinaeavcFb0gocrtavcFbGV86bbavcr4hvaecefheaombka8AhAkdnaEcs9hmba3aA9Rgvcetavc8F917hvinaeavcFb0gocrtavcFbGV86bbavcr4hvaecefheaombka3hAkalaXcdtfaKBdbaXcefcsGhvdndnaYPzbeeeeeeeeeeeeeebekalavcdtfa8ABdbaXcdfcsGhvkdndnaEPzbeeeeeeeeeeeeeebekalavcdtfa3BdbavcefcsGhvkcihoalc;abfaQcitfgEaKBdlaEa8ABdbaQcefcsGhYcdhEavhXaLhOxekcdhoalaXcdtfa3BdbcehEaXcefcsGhXaQhYkalc;abfaYcitfgva8ABdlava3Bdbalc;abfaQaEfcsGcitfgva3BdlavaKBdbascefhsaQaofcsGhQaCcifgCai6mbkkdnaeaP9nmbcbhvxekcbhvinaeavfavc:W1jjbfRbb86bbavcefgvcz9hmbkaeab9Ravfhvkalc;aef8KjjjjbavkZeeucbhddninadcefgdc8F0meceadtae6mbkkadcrfcFeGcr9Uci2cdfabci9U2cHfkmbcbabBd;m:kjjbk:Adewu8Jjjjjbcz9Rhlcbhvdnaicvfae0mbcbhvabcbRb;m:kjjbc;qeV86bbal9cb83iwabcefhoabaefc98fhrdnaiTmbcbhwcbhDindnaoar6mbcbskadaDcdtfydbgqalcwfawaqav9Rgvavc8F91gv7av9Rc507gwcdtfgkydb9Rgvc8E91c9:Gavcdt7awVhvinaoavcFb0gecrtavcFbGV86bbavcr4hvaocefhoaembkakaqBdbaqhvaDcefgDai9hmbkkdnaoar9nmbcbskaocbBbbaoab9RclfhvkavkBeeucbhddninadcefgdc8F0meceadtae6mbkkadcwfcFeGcr9Uab2cvfk:bvli99dui99ludnaeTmbcuadcetcuftcu7:Zhvdndncuaicuftcu7:ZgoJbbbZMgr:lJbbb9p9DTmbar:Ohwxekcjjjj94hwkcbhicbhDinalclfIdbgrJbbbbJbbjZalIdbgq:lar:lMalcwfIdbgk:lMgr:varJbbbb9BEgrNhxaqarNhrdndnakJbbbb9GTmbaxhqxekJbbjZar:l:tgqaq:maxJbbbb9GEhqJbbjZax:l:tgxax:marJbbbb9GEhrkdndnalcxfIdbgxJbbj:;axJbbj:;9GEgkJbbjZakJbbjZ9FEavNJbbbZJbbb:;axJbbbb9GEMgx:lJbbb9p9DTmbax:Ohmxekcjjjj94hmkdndnaqJbbj:;aqJbbj:;9GEgxJbbjZaxJbbjZ9FEaoNJbbbZJbbb:;aqJbbbb9GEMgq:lJbbb9p9DTmbaq:OhPxekcjjjj94hPkdndnarJbbj:;arJbbj:;9GEgqJbbjZaqJbbjZ9FEaoNJbbbZJbbb:;arJbbbb9GEMgr:lJbbb9p9DTmbar:Ohsxekcjjjj94hskdndnadcl9hmbabaifgzas86bbazcifam86bbazcdfaw86bbazcefaP86bbxekabaDfgzas87ebazcofam87ebazclfaw87ebazcdfaP87ebkalczfhlaiclfhiaDcwfhDaecufgembkkk;hlld99eud99eudnaeTmbdndncuaicuftcu7:ZgvJbbbZMgo:lJbbb9p9DTmbao:Ohixekcjjjj94hikaic;8FiGhrinabcofcicdalclfIdb:lalIdb:l9EgialcwfIdb:lalaicdtfIdb:l9EEgialcxfIdb:lalaicdtfIdb:l9EEgiarV87ebdndnJbbj:;JbbjZalaicdtfIdbJbbbb9DEgoalaicd7cdtfIdbJ;Zl:1ZNNgwJbbj:;awJbbj:;9GEgDJbbjZaDJbbjZ9FEavNJbbbZJbbb:;awJbbbb9GEMgw:lJbbb9p9DTmbaw:Ohqxekcjjjj94hqkabcdfaq87ebdndnalaicefciGcdtfIdbJ;Zl:1ZNaoNgwJbbj:;awJbbj:;9GEgDJbbjZaDJbbjZ9FEavNJbbbZJbbb:;awJbbbb9GEMgw:lJbbb9p9DTmbaw:Ohqxekcjjjj94hqkabaq87ebdndnaoalaicufciGcdtfIdbJ;Zl:1ZNNgoJbbj:;aoJbbj:;9GEgwJbbjZawJbbjZ9FEavNJbbbZJbbb:;aoJbbbb9GEMgo:lJbbb9p9DTmbao:Ohixekcjjjj94hikabclfai87ebabcwfhbalczfhlaecufgembkkk;3viDue99eu8Jjjjjbcjd9Rgo8Kjjjjbadcd4hrdndndndnavcd9hmbadcl6meaohwarhDinawc:CuBdbawclfhwaDcufgDmbkaeTmiadcl6mdarcdthqalhkcbhxinaohwakhDarhminawawydbgPcbaDIdbgs:8cL4cFeGc:cufasJbbbb9BEgzaPaz9kEBdbaDclfhDawclfhwamcufgmmbkakaqfhkaxcefgxaeSmixbkkaeTmdxekaeTmekarcdthkavce9hhqadcl6hdcbhxindndndnaqmbadmdc:CuhDalhwarhminaDcbawIdbgs:8cL4cFeGc:cufasJbbbb9BEgPaDaP9kEhDawclfhwamcufgmmbxdkkc:CuhDdndnavPleddbdkadmdaohwalhmarhPinawcbamIdbgs:8cL4cFeGgzc;:bazc;:b0Ec:cufasJbbbb9BEBdbamclfhmawclfhwaPcufgPmbxdkkadmecbhwarhminaoawfcbalawfIdbgs:8cL4cFeGgPc8AaPc8A0Ec:cufasJbbbb9BEBdbawclfhwamcufgmmbkkadmbcbhwarhPinaDhmdnavceSmbaoawfydbhmkdndnalawfIdbgscjjj;8iamai9RcefgmcLt9R::NJbbbZJbbb:;asJbbbb9GEMgs:lJbbb9p9DTmbas:Ohzxekcjjjj94hzkabawfazcFFFrGamcKtVBdbawclfhwaPcufgPmbkkabakfhbalakfhlaxcefgxae9hmbkkaocjdf8Kjjjjbk;YqdXui998Jjjjjbc:qd9Rgv8Kjjjjbavc:Sefcbc;Kbz:wjjjb8AcbhodnadTmbcbhoaiTmbdndnabaeSmbaehrxekavcuadcdtgwadcFFFFi0Ecbyd;u:kjjbHjjjjbbgrBd:SeavceBd:mdaraeawz:vjjjb8Akavc:GefcwfcbBdbav9cb83i:Geavc:Gefaradaiavc:Sefz:ojjjbavyd:GehDadci9Ugqcbyd;u:kjjbHjjjjbbheavc:Sefavyd:mdgkcdtfaeBdbavakcefgwBd:mdaecbaqz:wjjjbhxavc:SefawcdtfcuaicdtaicFFFFi0Ecbyd;u:kjjbHjjjjbbgmBdbavakcdfgPBd:mdalc;ebfhsaDheamhwinawalIdbasaeydbgzcwazcw6EcdtfIdbMUdbaeclfheawclfhwaicufgimbkavc:SefaPcdtfcuaqcdtadcFFFF970Ecbyd;u:kjjbHjjjjbbgPBdbdnadci6mbarheaPhwaqhiinawamaeydbcdtfIdbamaeclfydbcdtfIdbMamaecwfydbcdtfIdbMUdbaecxfheawclfhwaicufgimbkkakcifhoalc;ebfhHavc;qbfhOavheavyd:KehAavyd:OehCcbhzcbhwcbhXcehQinaehLcihkarawci2gKcdtfgeydbhsaeclfydbhdabaXcx2fgicwfaecwfydbgYBdbaiclfadBdbaiasBdbaxawfce86bbaOaYBdwaOadBdlaOasBdbaPawcdtfcbBdbdnazTmbcihkaLhiinaOakcdtfaiydbgeBdbakaeaY9haeas9haead9hGGfhkaiclfhiazcufgzmbkkaXcefhXcbhzinaCaAarazaKfcdtfydbcdtgifydbcdtfgYheaDaifgdydbgshidnasTmbdninaeydbawSmeaeclfheaicufgiTmdxbkkaeaYascdtfc98fydbBdbadadydbcufBdbkazcefgzci9hmbkdndnakTmbcuhwJbbbbh8Acbhdavyd:KehYavyd:OehKindndnaDaOadcdtfydbcdtgzfydbgembadcefhdxekadcs0hiamazfgsIdbhEasalcbadcefgdaiEcdtfIdbaHaecwaecw6EcdtfIdbMg3Udba3aE:th3aecdthiaKaYazfydbcdtfheinaPaeydbgzcdtfgsa3asIdbMgEUdbaEa8Aa8AaE9DgsEh8AazawasEhwaeclfheaic98fgimbkkadak9hmbkawcu9hmekaQaq9pmdindnaxaQfRbbmbaQhwxdkaqaQcefgQ9hmbxikkakczakcz6EhzaOheaLhOawcu9hmbkkaocdtavc:Seffc98fhedninaoTmeaeydbcbyd;q:kjjbH:bjjjbbaec98fheaocufhoxbkkavc:qdf8Kjjjjbk;IlevucuaicdtgvaicFFFFi0Egocbyd;u:kjjbHjjjjbbhralalyd9GgwcdtfarBdbalawcefBd9GabarBdbaocbyd;u:kjjbHjjjjbbhralalyd9GgocdtfarBdbalaocefBd9GabarBdlcuadcdtadcFFFFi0Ecbyd;u:kjjbHjjjjbbhralalyd9GgocdtfarBdbalaocefBd9GabarBdwabydbcbavz:wjjjb8Aadci9UhDdnadTmbabydbhoaehladhrinaoalydbcdtfgvavydbcefBdbalclfhlarcufgrmbkkdnaiTmbabydbhlabydlhrcbhvaihoinaravBdbarclfhralydbavfhvalclfhlaocufgombkkdnadci6mbabydlhrabydwhvcbhlinaecwfydbhoaeclfydbhdaraeydbcdtfgwawydbgwcefBdbavawcdtfalBdbaradcdtfgdadydbgdcefBdbavadcdtfalBdbaraocdtfgoaoydbgocefBdbavaocdtfalBdbaecxfheaDalcefgl9hmbkkdnaiTmbabydlheabydbhlinaeaeydbalydb9RBdbalclfhlaeclfheaicufgimbkkkQbabaeadaic;K1jjbz:njjjbkQbabaeadaic;m:jjjbz:njjjbk9DeeuabcFeaicdtz:wjjjbhlcbhbdnadTmbindnalaeydbcdtfgiydbcu9hmbaiabBdbabcefhbkaeclfheadcufgdmbkkabk:Vvioud9:du8Jjjjjbc;Wa9Rgl8Kjjjjbcbhvalcxfcbc;Kbz:wjjjb8AalcuadcitgoadcFFFFe0Ecbyd;u:kjjbHjjjjbbgrBdxalceBd2araeadaicez:tjjjbalcuaoadcjjjjoGEcbyd;u:kjjbHjjjjbbgwBdzadcdthednadTmbabhiinaiavBdbaiclfhiadavcefgv9hmbkkawaefhDalabBdwalawBdl9cbhqindnadTmbaq9cq9:hkarhvaDhiadheinaiav8Pibak1:NcFrG87ebavcwfhvaicdfhiaecufgembkkalclfaq:NceGcdtfydbhxalclfaq9ce98gq:NceGcdtfydbhmalc;Wbfcbcjaz:wjjjb8AaDhvadhidnadTmbinalc;Wbfav8VebcdtfgeaeydbcefBdbavcdfhvaicufgimbkkcbhvcbhiinalc;WbfavfgeydbhoaeaiBdbaoaifhiavclfgvcja9hmbkadhvdndnadTmbinalc;WbfaDamydbgicetf8VebcdtfgeaeydbgecefBdbaxaecdtfaiBdbamclfhmavcufgvmbkaq9cv9smdcbhvinabawydbcdtfavBdbawclfhwadavcefgv9hmbxdkkaq9cv9smekkclhvdninavc98Smealcxfavfydbcbyd;q:kjjbH:bjjjbbavc98fhvxbkkalc;Waf8Kjjjjbk:Jwliuo99iud9:cbhv8Jjjjjbca9Rgoczfcwfcbyd:8:kjjbBdbaocb8Pd:0:kjjb83izaocwfcbyd;i:kjjbBdbaocb8Pd;a:kjjb83ibaicd4hrdndnadmbJFFuFhwJFFuuhDJFFuuhqJFFuFhkJFFuuhxJFFuFhmxekarcdthPaehsincbhiinaoczfaifgzasaifIdbgwazIdbgDaDaw9EEUdbaoaifgzawazIdbgDaDaw9DEUdbaiclfgicx9hmbkasaPfhsavcefgvad9hmbkaoIdKhDaoIdwhwaoIdChqaoIdlhkaoIdzhxaoIdbhmkdnadTmbJbbbbJbFu9hJbbbbamax:tgmamJbbbb9DEgmakaq:tgkakam9DEgkawaD:tgwawak9DEgw:vawJbbbb9BEhwdnalmbarcdthoindndnaeclfIdbaq:tawNJbbbZMgk:lJbbb9p9DTmbak:Ohixekcjjjj94hikai:S9cC:ghHdndnaeIdbax:tawNJbbbZMgk:lJbbb9p9DTmbak:Ohixekcjjjj94hikaHai:S:ehHdndnaecwfIdbaD:tawNJbbbZMgk:lJbbb9p9DTmbak:Ohixekcjjjj94hikabaHai:T9cy:g:e83ibaeaofheabcwfhbadcufgdmbxdkkarcdthoindndnaeIdbax:tawNJbbbZMgk:lJbbb9p9DTmbak:Ohixekcjjjj94hikai:SgH9ca:gaH9cz:g9cjjj;4s:d:eaH9cFe:d:e9cF:bj;4:pj;ar:d9c:bd9:9c:p;G:d;4j:E;ar:d9cH9:9c;d;H:W:y:m:g;d;Hb:d9cv9:9c;j:KM;j:KM;j:Kd:dhOdndnaeclfIdbaq:tawNJbbbZMgk:lJbbb9p9DTmbak:Ohixekcjjjj94hikai:SgH9ca:gaH9cz:g9cjjj;4s:d:eaH9cFe:d:e9cF:bj;4:pj;ar:d9c:bd9:9c:p;G:d;4j:E;ar:d9cH9:9c;d;H:W:y:m:g;d;Hb:d9cq9:9cM;j:KM;j:KM;jl:daO:ehOdndnaecwfIdbaD:tawNJbbbZMgk:lJbbb9p9DTmbak:Ohixekcjjjj94hikabaOai:SgH9ca:gaH9cz:g9cjjj;4s:d:eaH9cFe:d:e9cF:bj;4:pj;ar:d9c:bd9:9c:p;G:d;4j:E;ar:d9cH9:9c;d;H:W:y:m:g;d;Hb:d9cC9:9c:KM;j:KM;j:KMD:d:e83ibaeaofheabcwfhbadcufgdmbkkk9teiucbcbyd;y:kjjbgeabcifc98GfgbBd;y:kjjbdndnabZbcztgd9nmbcuhiabad9RcFFifcz4nbcuSmekaehikaik;teeeudndnaeabVciGTmbabhixekdndnadcz9pmbabhixekabhiinaiaeydbBdbaiaeydlBdlaiaeydwBdwaiaeydxBdxaeczfheaiczfhiadc9Wfgdcs0mbkkadcl6mbinaiaeydbBdbaeclfheaiclfhiadc98fgdci0mbkkdnadTmbinaiaeRbb86bbaicefhiaecefheadcufgdmbkkabk:3eedudndnabciGTmbabhixekaecFeGc:b:c:ew2hldndnadcz9pmbabhixekabhiinaialBdxaialBdwaialBdlaialBdbaiczfhiadc9Wfgdcs0mbkkadcl6mbinaialBdbaiclfhiadc98fgdci0mbkkdnadTmbinaiae86bbaicefhiadcufgdmbkkabk9teiucbcbyd;y:kjjbgeabcrfc94GfgbBd;y:kjjbdndnabZbcztgd9nmbcuhiabad9RcFFifcz4nbcuSmekaehikaik9:eiuZbhedndncbyd;y:kjjbgdaecztgi9nmbcuheadai9RcFFifcz4nbcuSmekadhekcbabae9Rcifc98Gcbyd;y:kjjbfgdBd;y:kjjbdnadZbcztge9nmbadae9RcFFifcz4nb8Akkk;Qddbcjwk;mdbbbbdbbblbbbwbbbbbbbebbbdbbblbbbwbbbbbbbbbbbbbbbb4:h9w9N94:P:gW:j9O:ye9Pbbbbbbebbbdbbbebbbdbbbbbbbdbbbbbbbebbbbbbb:l29hZ;69:9kZ;N;76Z;rg97Z;z;o9xZ8J;B85Z;:;u9yZ;b;k9HZ:2;Z9DZ9e:l9mZ59A8KZ:r;T3Z:A:zYZ79OHZ;j4::8::Y:D9V8:bbbb9s:49:Z8R:hBZ9M9M;M8:L;z;o8:;8:PG89q;x:J878R:hQ8::M:B;e87bbbbbbjZbbjZbbjZ:E;V;N8::Y:DsZ9i;H;68:xd;R8:;h0838:;W:NoZbbbb:WV9O8:uf888:9i;H;68:9c9G;L89;n;m9m89;D8Ko8:bbbbf:8tZ9m836ZS:2AZL;zPZZ818EZ9e:lxZ;U98F8:819E;68:FFuuFFuuFFuuFFuFFFuFFFuFbc;mqkzebbbebbbdbbb9G:vbb",e=new Uint8Array([32,0,65,2,1,106,34,33,3,128,11,4,13,64,6,253,10,7,15,116,127,5,8,12,40,16,19,54,20,9,27,255,113,17,42,67,24,23,146,148,18,14,22,45,70,69,56,114,101,21,25,63,75,136,108,28,118,29,73,115]);if(typeof WebAssembly!="object")return{supported:!1};var a,r=WebAssembly.instantiate(s(t),{}).then(function(p){a=p.instance,a.exports.__wasm_call_ctors(),a.exports.meshopt_encodeVertexVersion(0),a.exports.meshopt_encodeIndexVersion(1)});function s(p){for(var h=new Uint8Array(p.length),d=0;d<p.length;++d){var m=p.charCodeAt(d);h[d]=m>96?m-97:m>64?m-39:m+4}for(var b=0,d=0;d<p.length;++d)h[b++]=h[d]<60?e[h[d]]:(h[d]-60)*64+h[++d];return h.buffer.slice(0,b)}function n(p){if(!p)throw new Error("Assertion failed")}function i(p){return new Uint8Array(p.buffer,p.byteOffset,p.byteLength)}function o(p,h,d,m){var b=a.exports.sbrk,y=b(h.length*4),x=b(d*4),v=new Uint8Array(a.exports.memory.buffer),M=i(h);v.set(M,y),m&&m(y,y,h.length,d);var S=p(x,y,h.length,d);v=new Uint8Array(a.exports.memory.buffer);var A=new Uint32Array(d);new Uint8Array(A.buffer).set(v.subarray(x,x+d*4)),M.set(v.subarray(y,y+h.length*4)),b(y-b(0));for(var _=0;_<h.length;++_)h[_]=A[h[_]];return[A,S]}function c(p,h,d,m){var b=a.exports.sbrk,y=b(d*4),x=b(d*m),v=new Uint8Array(a.exports.memory.buffer);v.set(i(h),x),p(y,x,d,m),v=new Uint8Array(a.exports.memory.buffer);var M=new Uint32Array(d);return new Uint8Array(M.buffer).set(v.subarray(y,y+d*4)),b(y-b(0)),M}function l(p,h,d,m,b){var y=a.exports.sbrk,x=y(h),v=y(m*b),M=new Uint8Array(a.exports.memory.buffer);M.set(i(d),v);var S=p(x,h,v,m,b),A=new Uint8Array(S);return A.set(M.subarray(x,x+S)),y(x-y(0)),A}function f(p){for(var h=0,d=0;d<p.length;++d){var m=p[d];h=h<m?m:h}return h}function u(p,h){if(n(h==2||h==4),h==4)return new Uint32Array(p.buffer,p.byteOffset,p.byteLength/4);var d=new Uint16Array(p.buffer,p.byteOffset,p.byteLength/2);return new Uint32Array(d)}function g(p,h,d,m,b,y,x){var v=a.exports.sbrk,M=v(d*m),S=v(d*y),A=new Uint8Array(a.exports.memory.buffer);A.set(i(h),S),p(M,d,m,b,S,x);var _=new Uint8Array(d*m);return _.set(A.subarray(M,M+d*m)),v(M-v(0)),_}return{ready:r,supported:!0,reorderMesh:function(p,h,d){var m=h?d?a.exports.meshopt_optimizeVertexCacheStrip:a.exports.meshopt_optimizeVertexCache:void 0;return o(a.exports.meshopt_optimizeVertexFetchRemap,p,f(p)+1,m)},reorderPoints:function(p,h){return n(p instanceof Float32Array),n(p.length%h==0),n(h>=3),c(a.exports.meshopt_spatialSortRemap,p,p.length/h,h*4)},encodeVertexBuffer:function(p,h,d){n(d>0&&d<=256),n(d%4==0);var m=a.exports.meshopt_encodeVertexBufferBound(h,d);return l(a.exports.meshopt_encodeVertexBuffer,m,p,h,d)},encodeIndexBuffer:function(p,h,d){n(d==2||d==4),n(h%3==0);var m=u(p,d),b=a.exports.meshopt_encodeIndexBufferBound(h,f(m)+1);return l(a.exports.meshopt_encodeIndexBuffer,b,m,h,4)},encodeIndexSequence:function(p,h,d){n(d==2||d==4);var m=u(p,d),b=a.exports.meshopt_encodeIndexSequenceBound(h,f(m)+1);return l(a.exports.meshopt_encodeIndexSequence,b,m,h,4)},encodeGltfBuffer:function(p,h,d,m){var b={ATTRIBUTES:this.encodeVertexBuffer,TRIANGLES:this.encodeIndexBuffer,INDICES:this.encodeIndexSequence};return n(b[m]),b[m](p,h,d)},encodeFilterOct:function(p,h,d,m){return n(d==4||d==8),n(m>=1&&m<=16),g(a.exports.meshopt_encodeFilterOct,p,h,d,m,16)},encodeFilterQuat:function(p,h,d,m){return n(d==8),n(m>=4&&m<=16),g(a.exports.meshopt_encodeFilterQuat,p,h,d,m,16)},encodeFilterExp:function(p,h,d,m,b){n(d>0&&d%4==0),n(m>=1&&m<=24);var y={Separate:0,SharedVector:1,SharedComponent:2,Clamped:3};return g(a.exports.meshopt_encodeFilterExp,p,h,d,m,d,b?y[b]:1)}}})();var ei=(function(){var t="b9H79Tebbbe8Fv9Gbb9Gvuuuuueu9Giuuub9Geueu9Giuuueuikqbeeedddillviebeoweuec:W:Odkr;leDo9TW9T9VV95dbH9F9F939H79T9F9J9H229F9Jt9VV7bb8A9TW79O9V9Wt9F9KW9J9V9KW9wWVtW949c919M9MWVbeY9TW79O9V9Wt9F9KW9J9V9KW69U9KW949c919M9MWVbdE9TW79O9V9Wt9F9KW9J9V9KW69U9KW949tWG91W9U9JWbiL9TW79O9V9Wt9F9KW9J9V9KWS9P2tWV9p9JtblK9TW79O9V9Wt9F9KW9J9V9KWS9P2tWV9r919HtbvL9TW79O9V9Wt9F9KW9J9V9KWS9P2tWVT949Wbol79IV9Rbrq:S86qdbk;jYi5ud9:du8Jjjjjbcj;kb9Rgv8Kjjjjbc9:hodnalTmbcuhoaiRbbgrc;WeGc:Ge9hmbarcsGgwce0mbc9:hoalcufadcd4cbawEgDadfgrcKcaawEgqaraq0Egk6mbaicefhxcj;abad9Uc;WFbGcjdadca0EhmaialfgPar9Rgoadfhsavaoadz1jjjbgzceVhHcbhOdndninaeaO9nmeaPax9RaD6mdamaeaO9RaOamfgoae6EgAcsfglc9WGhCabaOad2fhXaAcethQaxaDfhiaOaeaoaeao6E9RhLalcl4cifcd4hKazcj;cbfaAfhYcbh8AazcjdfhEaHh3incbhodnawTmbaxa8Acd4fRbbhokaocFeGh5cbh8Eazcj;cbfhqinaih8Fdndndndna5a8Ecet4ciGgoc9:fPdebdkaPa8F9RaA6mrazcj;cbfa8EaA2fa8FaAz1jjjb8Aa8FaAfhixdkazcj;cbfa8EaA2fcbaAz:jjjjb8Aa8FhixekaPa8F9RaK6mva8FaKfhidnaCTmbaPai9RcK6mbaocdtc:q1jjbfcj1jjbawEhaczhrcbhlinargoc9Wfghaqfhrdndndndndndnaaa8Fahco4fRbbalcoG4ciGcdtfydbPDbedvivvvlvkar9cb83bbarcwf9cb83bbxlkarcbaiRbdai8Xbb9c:c:qj:bw9:9c:q;c1:I1e:d9c:b:c:e1z9:gg9cjjjjjz:dg8J9qE86bbaqaofgrcGfag9c8F1:NghcKtc8F91aicdfa8J9c8N1:Nfg8KRbbG86bbarcVfcba8KahcjeGcr4fghRbbag9cjjjjjl:dg8J9qE86bbarc7fcbaha8J9c8L1:NfghRbbag9cjjjjjd:dg8J9qE86bbarctfcbaha8J9c8K1:NfghRbbag9cjjjjje:dg8J9qE86bbarc91fcbaha8J9c8J1:NfghRbbag9cjjjj;ab:dg8J9qE86bbarc4fcbaha8J9cg1:NfghRbbag9cjjjja:dg8J9qE86bbarc93fcbaha8J9ch1:NfghRbbag9cjjjjz:dgg9qE86bbarc94fcbahag9ca1:NfghRbbai8Xbe9c:c:qj:bw9:9c:q;c1:I1e:d9c:b:c:e1z9:gg9cjjjjjz:dg8J9qE86bbarc95fag9c8F1:NgicKtc8F91aha8J9c8N1:NfghRbbG86bbarc96fcbahaicjeGcr4fgiRbbag9cjjjjjl:dg8J9qE86bbarc97fcbaia8J9c8L1:NfgiRbbag9cjjjjjd:dg8J9qE86bbarc98fcbaia8J9c8K1:NfgiRbbag9cjjjjje:dg8J9qE86bbarc99fcbaia8J9c8J1:NfgiRbbag9cjjjj;ab:dg8J9qE86bbarc9:fcbaia8J9cg1:NfgiRbbag9cjjjja:dg8J9qE86bbarcufcbaia8J9ch1:NfgiRbbag9cjjjjz:dgg9qE86bbaiag9ca1:NfhixikaraiRblaiRbbghco4g8Ka8KciSg8KE86bbaqaofgrcGfaiclfa8Kfg8KRbbahcl4ciGg8La8LciSg8LE86bbarcVfa8Ka8Lfg8KRbbahcd4ciGg8La8LciSg8LE86bbarc7fa8Ka8Lfg8KRbbahciGghahciSghE86bbarctfa8Kahfg8KRbbaiRbeghco4g8La8LciSg8LE86bbarc91fa8Ka8Lfg8KRbbahcl4ciGg8La8LciSg8LE86bbarc4fa8Ka8Lfg8KRbbahcd4ciGg8La8LciSg8LE86bbarc93fa8Ka8Lfg8KRbbahciGghahciSghE86bbarc94fa8Kahfg8KRbbaiRbdghco4g8La8LciSg8LE86bbarc95fa8Ka8Lfg8KRbbahcl4ciGg8La8LciSg8LE86bbarc96fa8Ka8Lfg8KRbbahcd4ciGg8La8LciSg8LE86bbarc97fa8Ka8Lfg8KRbbahciGghahciSghE86bbarc98fa8KahfghRbbaiRbigico4g8Ka8KciSg8KE86bbarc99faha8KfghRbbaicl4ciGg8Ka8KciSg8KE86bbarc9:faha8KfghRbbaicd4ciGg8Ka8KciSg8KE86bbarcufaha8KfgrRbbaiciGgiaiciSgiE86bbaraifhixdkaraiRbwaiRbbghcl4g8Ka8KcsSg8KE86bbaqaofgrcGfaicwfa8Kfg8KRbbahcsGghahcsSghE86bbarcVfa8KahfghRbbaiRbeg8Kcl4g8La8LcsSg8LE86bbarc7faha8LfghRbba8KcsGg8Ka8KcsSg8KE86bbarctfaha8KfghRbbaiRbdg8Kcl4g8La8LcsSg8LE86bbarc91faha8LfghRbba8KcsGg8Ka8KcsSg8KE86bbarc4faha8KfghRbbaiRbig8Kcl4g8La8LcsSg8LE86bbarc93faha8LfghRbba8KcsGg8Ka8KcsSg8KE86bbarc94faha8KfghRbbaiRblg8Kcl4g8La8LcsSg8LE86bbarc95faha8LfghRbba8KcsGg8Ka8KcsSg8KE86bbarc96faha8KfghRbbaiRbvg8Kcl4g8La8LcsSg8LE86bbarc97faha8LfghRbba8KcsGg8Ka8KcsSg8KE86bbarc98faha8KfghRbbaiRbog8Kcl4g8La8LcsSg8LE86bbarc99faha8LfghRbba8KcsGg8Ka8KcsSg8KE86bbarc9:faha8KfghRbbaiRbrgicl4g8Ka8KcsSg8KE86bbarcufaha8KfgrRbbaicsGgiaicsSgiE86bbaraifhixekarai8Pbb83bbarcwfaicwf8Pbb83bbaiczfhikdnaoaC9pmbalcdfhlaoczfhraPai9RcL0mekkaoaC6moaimexokaCmva8FTmvkaqaAfhqa8Ecefg8Ecl9hmbkdndndndnawTmbasa8Acd4fRbbgociGPlbedrbkaATmdaza8Afh8Fazcj;cbfhhcbh8EaEhaina8FRbbhraahocbhlinaoahalfRbbgqce4cbaqceG9R7arfgr86bbaoadfhoaAalcefgl9hmbkaacefhaa8Fcefh8FahaAfhha8Ecefg8Ecl9hmbxikkaATmeaza8Afhaazcj;cbfhhcbhoceh8EaYh8FinaEaofhlaa8Vbbhrcbhoinala8FaofRbbcwtahaofRbbgqVc;:FiGce4cbaqceG9R7arfgr87bbaladfhlaLaocefgofmbka8FaQfh8FcdhoaacdfhaahaQfhha8EceGhlcbh8EalmbxdkkaATmbcbaocl49Rh8Eaza8AfRbbhqcwhoa3hlinalRbbaotaqVhqalcefhlaocwfgoca9hmbkcbhhaEh8FaYhainazcj;cbfahfRbbhrcwhoaahlinalRbbaotarVhralaAfhlaocwfgoca9hmbkara8E93aq7hqcbhoa8Fhlinalaqao486bbalcefhlaocwfgoca9hmbka8Fadfh8FaacefhaahcefghaA9hmbkkaEclfhEa3clfh3a8Aclfg8Aad6mbkaXazcjdfaAad2z1jjjb8AazazcjdfaAcufad2fadz1jjjb8AaAaOfhOaihxaimbkc9:hoxdkcbc99aPax9RakSEhoxekc9:hokavcj;kbf8Kjjjjbaok:XseHu8Jjjjjbc;ae9Rgv8Kjjjjbc9:hodnaeci9UgrcHfal0mbcuhoaiRbbgwc;WeGc;Ge9hmbawcsGgDce0mbavc;abfcFecjez:jjjjb8AavcUf9cu83ibavc8Wf9cu83ibavcyf9cu83ibavcaf9cu83ibavcKf9cu83ibavczf9cu83ibav9cu83iwav9cu83ibaialfc9WfhqaicefgwarfhldnaeTmbcmcsaDceSEhkcbhxcbhmcbhrcbhicbhoindnalaq9nmbc9:hoxikdndnawRbbgDc;Ve0mbavc;abfaoaDcu7gPcl4fcsGcitfgsydlhzasydbhHdndnaDcsGgsak9pmbavaiaPfcsGcdtfydbaxasEhDaxasTgOfhxxekdndnascsSmbcehOasc987asamffcefhDxekalcefhDal8SbbgscFeGhPdndnascu9mmbaDhlxekalcvfhlaPcFbGhPcrhsdninaD8SbbgOcFbGastaPVhPaOcu9kmeaDcefhDascrfgsc8J9hmbxdkkaDcefhlkcehOaPce4cbaPceG9R7amfhDkaDhmkavc;abfaocitfgsaDBdbasazBdlavaicdtfaDBdbavc;abfaocefcsGcitfgsaHBdbasaDBdlaocdfhoaOaifhidnadcd9hmbabarcetfgsaH87ebasclfaD87ebascdfaz87ebxdkabarcdtfgsaHBdbascwfaDBdbasclfazBdbxekdnaDcpe0mbaxcefgOavaiaqaDcsGfRbbgscl49RcsGcdtfydbascz6gPEhDavaias9RcsGcdtfydbaOaPfgzascsGgOEhsaOThOdndnadcd9hmbabarcetfgHax87ebaHclfas87ebaHcdfaD87ebxekabarcdtfgHaxBdbaHcwfasBdbaHclfaDBdbkavaicdtfaxBdbavc;abfaocitfgHaDBdbaHaxBdlavaicefgicsGcdtfaDBdbavc;abfaocefcsGcitfgHasBdbaHaDBdlavaiaPfgicsGcdtfasBdbavc;abfaocdfcsGcitfgDaxBdbaDasBdlaocifhoaiaOfhiazaOfhxxekaxcbalRbbgHEgAaDc;:eSgDfhzaHcsGhCaHcl4hXdndnaHcs0mbazcefhOxekazhOavaiaX9RcsGcdtfydbhzkdndnaCmbaOcefhxxekaOhxavaiaH9RcsGcdtfydbhOkdndnaDTmbalcefhDxekalcdfhDal8SbegPcFeGhsdnaPcu9kmbalcofhAascFbGhscrhldninaD8SbbgPcFbGaltasVhsaPcu9kmeaDcefhDalcrfglc8J9hmbkaAhDxekaDcefhDkasce4cbasceG9R7amfgmhAkdndnaXcsSmbaDhsxekaDcefhsaD8SbbglcFeGhPdnalcu9kmbaDcvfhzaPcFbGhPcrhldninas8SbbgDcFbGaltaPVhPaDcu9kmeascefhsalcrfglc8J9hmbkazhsxekascefhskaPce4cbaPceG9R7amfgmhzkdndnaCcsSmbashlxekascefhlas8SbbgDcFeGhPdnaDcu9kmbascvfhOaPcFbGhPcrhDdninal8SbbgscFbGaDtaPVhPascu9kmealcefhlaDcrfgDc8J9hmbkaOhlxekalcefhlkaPce4cbaPceG9R7amfgmhOkdndnadcd9hmbabarcetfgDaA87ebaDclfaO87ebaDcdfaz87ebxekabarcdtfgDaABdbaDcwfaOBdbaDclfazBdbkavc;abfaocitfgDazBdbaDaABdlavaicdtfaABdbavc;abfaocefcsGcitfgDaOBdbaDazBdlavaicefgicsGcdtfazBdbavc;abfaocdfcsGcitfgDaABdbaDaOBdlavaiaHcz6aXcsSVfgicsGcdtfaOBdbaiaCTaCcsSVfhiaocifhokawcefhwaocsGhoaicsGhiarcifgrae6mbkkcbc99alaqSEhokavc;aef8Kjjjjbaok:clevu8Jjjjjbcz9Rhvdnaecvfal9nmbc9:skdnaiRbbc;:eGc;qeSmbcuskav9cb83iwaicefhoaialfc98fhrdnaeTmbdnadcdSmbcbhwindnaoar6mbc9:skaocefhlao8SbbgicFeGhddndnaicu9mmbalhoxekaocvfhoadcFbGhdcrhidninal8SbbgDcFbGaitadVhdaDcu9kmealcefhlaicrfgic8J9hmbxdkkalcefhokabawcdtfadc8Etc8F91adcd47avcwfadceGcdtVglydbfgiBdbalaiBdbawcefgwae9hmbxdkkcbhwindnaoar6mbc9:skaocefhlao8SbbgicFeGhddndnaicu9mmbalhoxekaocvfhoadcFbGhdcrhidninal8SbbgDcFbGaitadVhdaDcu9kmealcefhlaicrfgic8J9hmbxdkkalcefhokabawcetfadc8Etc8F91adcd47avcwfadceGcdtVglydbfgi87ebalaiBdbawcefgwae9hmbkkcbc99aoarSEk:Lvoeue99dud99eud99dndnadcl9hmbaeTmeindndnabcdfgd8Sbb:Yab8Sbbgi:Ygl:l:tabcefgv8Sbbgo:Ygr:l:tgwJbb;:9cawawNJbbbbawawJbbbb9GgDEgq:mgkaqaicb9iEalMgwawNakaqaocb9iEarMgqaqNMM:r:vglNJbbbZJbbb:;aDEMgr:lJbbb9p9DTmbar:Ohixekcjjjj94hikadai86bbdndnaqalNJbbbZJbbb:;aqJbbbb9GEMgq:lJbbb9p9DTmbaq:Ohdxekcjjjj94hdkavad86bbdndnawalNJbbbZJbbb:;awJbbbb9GEMgw:lJbbb9p9DTmbaw:Ohdxekcjjjj94hdkabad86bbabclfhbaecufgembxdkkaeTmbindndnabclfgd8Ueb:Yab8Uebgi:Ygl:l:tabcdfgv8Uebgo:Ygr:l:tgwJb;:FSawawNJbbbbawawJbbbb9GgDEgq:mgkaqaicb9iEalMgwawNakaqaocb9iEarMgqaqNMM:r:vglNJbbbZJbbb:;aDEMgr:lJbbb9p9DTmbar:Ohixekcjjjj94hikadai87ebdndnaqalNJbbbZJbbb:;aqJbbbb9GEMgq:lJbbb9p9DTmbaq:Ohdxekcjjjj94hdkavad87ebdndnawalNJbbbZJbbb:;awJbbbb9GEMgw:lJbbb9p9DTmbaw:Ohdxekcjjjj94hdkabad87ebabcwfhbaecufgembkkk;oiliui99iue99dnaeTmbcbhiabhlindndnJ;Zl81Zalcof8UebgvciV:Y:vgoal8Ueb:YNgrJb;:FSNJbbbZJbbb:;arJbbbb9GEMgw:lJbbb9p9DTmbaw:OhDxekcjjjj94hDkalclf8Uebhqalcdf8UebhkabaiavcefciGfcetfaD87ebdndnaoak:YNgwJb;:FSNJbbbZJbbb:;awJbbbb9GEMgx:lJbbb9p9DTmbax:OhDxekcjjjj94hDkabaiavciGfgkcd7cetfaD87ebdndnaoaq:YNgoJb;:FSNJbbbZJbbb:;aoJbbbb9GEMgx:lJbbb9p9DTmbax:OhDxekcjjjj94hDkabaiavcufciGfcetfaD87ebdndnJbbjZararN:tawawN:taoaoN:tgrJbbbbarJbbbb9GE:rJb;:FSNJbbbZMgr:lJbbb9p9DTmbar:Ohvxekcjjjj94hvkabakcetfav87ebalcwfhlaiclfhiaecufgembkkk9mbdnadcd4ae2gdTmbinababydbgecwtcw91:Yaece91cjjj98Gcjjj;8if::NUdbabclfhbadcufgdmbkkk9teiucbcbyd:K1jjbgeabcifc98GfgbBd:K1jjbdndnabZbcztgd9nmbcuhiabad9RcFFifcz4nbcuSmekaehikaik;teeeudndnaeabVciGTmbabhixekdndnadcz9pmbabhixekabhiinaiaeydbBdbaiaeydlBdlaiaeydwBdwaiaeydxBdxaeczfheaiczfhiadc9Wfgdcs0mbkkadcl6mbinaiaeydbBdbaeclfheaiclfhiadc98fgdci0mbkkdnadTmbinaiaeRbb86bbaicefhiaecefheadcufgdmbkkabk:3eedudndnabciGTmbabhixekaecFeGc:b:c:ew2hldndnadcz9pmbabhixekabhiinaialBdxaialBdwaialBdlaialBdbaiczfhiadc9Wfgdcs0mbkkadcl6mbinaialBdbaiclfhiadc98fgdci0mbkkdnadTmbinaiae86bbaicefhiadcufgdmbkkabkk81dbcjwk8Kbbbbdbbblbbbwbbbbbbbebbbdbbblbbbwbbbbc:Kwkl8WNbb",e="b9H79TebbbeKl9Gbb9Gvuuuuueu9Giuuub9Geueuikqbbebeedddilve9Weeeviebeoweuec:q:6dkr;leDo9TW9T9VV95dbH9F9F939H79T9F9J9H229F9Jt9VV7bb8A9TW79O9V9Wt9F9KW9J9V9KW9wWVtW949c919M9MWVbdY9TW79O9V9Wt9F9KW9J9V9KW69U9KW949c919M9MWVblE9TW79O9V9Wt9F9KW9J9V9KW69U9KW949tWG91W9U9JWbvL9TW79O9V9Wt9F9KW9J9V9KWS9P2tWV9p9JtboK9TW79O9V9Wt9F9KW9J9V9KWS9P2tWV9r919HtbrL9TW79O9V9Wt9F9KW9J9V9KWS9P2tWVT949Wbwl79IV9RbDq;G9Mqlbzik9:evu8Jjjjjbcz9Rhbcbheincbhdcbhiinabcwfadfaicjuaead4ceGglE86bbaialfhiadcefgdcw9hmbkaec:q:yjjbfai86bbaecitc:q1jjbfab8Piw83ibaecefgecjd9hmbkk:183lYud97dur978Jjjjjbcj;kb9Rgv8Kjjjjbc9:hodnalTmbcuhoaiRbbgrc;WeGc:Ge9hmbarcsGgwce0mbc9:hoalcufadcd4cbawEgDadfgrcKcaawEgqaraq0Egk6mbaicefhxavaialfgmar9Rgoad;8qbbcj;abad9Uc;WFbGcjdadca0EhPdndndnadTmbaoadfhscbhzinaeaz9nmdamax9RaD6miabazad2fhHaxaDfhOaPaeaz9RazaPfae6EgAcsfgocl4cifcd4hCavcj;cbfaoc9WGgXcetfhQavcj;cbfaXci2fhLavcj;cbfaXfhKcbhYaoc;ab6h8AincbhodnawTmbaxaYcd4fRbbhokaocFeGhEcbh3avcj;cbfh5indndndndnaEa3cet4ciGgoc9:fPdebdkamaO9RaX6mwavcj;cbfa3aX2faOaX;8qbbaOaAfhOxdkavcj;cbfa3aX2fcbaX;8kbxekamaO9RaC6moaoclVcbawEhraOaCfhocbhidna8Ambamao9Rc;Gb6mbcbhlina5alfhidndndndndndnaOalco4fRbbgqciGarfPDbedibledibkaipxbbbbbbbbbbbbbbbbpklbxlkaiaopbblaopbbbg8Eclp:mea8EpmbzeHdOiAlCvXoQrLg8Ecdp:mea8EpmbzeHdOiAlCvXoQrLpxiiiiiiiiiiiiiiiip9og8Fpxiiiiiiiiiiiiiiiip8Jg8Ep5b9cjF;8;4;W;G;ab9:9cU1:Ngacitc:q1jjbfpbibaac:q:yjjbfRbbgapsa8Ep5e9cjF;8;4;W;G;ab9:9cU1:Nghcitc:q1jjbfpbibp9UpmbedilvorzHOACXQLpPa8Fa8Ep9spklbaaaoclffahc:q:yjjbfRbbfhoxikaiaopbbwaopbbbg8Eclp:mea8EpmbzeHdOiAlCvXoQrLpxssssssssssssssssp9og8Fpxssssssssssssssssp8Jg8Ep5b9cjF;8;4;W;G;ab9:9cU1:Ngacitc:q1jjbfpbibaac:q:yjjbfRbbgapsa8Ep5e9cjF;8;4;W;G;ab9:9cU1:Nghcitc:q1jjbfpbibp9UpmbedilvorzHOACXQLpPa8Fa8Ep9spklbaaaocwffahc:q:yjjbfRbbfhoxdkaiaopbbbpklbaoczfhoxekaiaopbbdaoRbbgacitc:q1jjbfpbibaac:q:yjjbfRbbgapsaoRbeghcitc:q1jjbfpbibp9UpmbedilvorzHOACXQLpPpklbaaaocdffahc:q:yjjbfRbbfhokdndndndndndnaqcd4ciGarfPDbedibledibkaiczfpxbbbbbbbbbbbbbbbbpklbxlkaiczfaopbblaopbbbg8Eclp:mea8EpmbzeHdOiAlCvXoQrLg8Ecdp:mea8EpmbzeHdOiAlCvXoQrLpxiiiiiiiiiiiiiiiip9og8Fpxiiiiiiiiiiiiiiiip8Jg8Ep5b9cjF;8;4;W;G;ab9:9cU1:Ngacitc:q1jjbfpbibaac:q:yjjbfRbbgapsa8Ep5e9cjF;8;4;W;G;ab9:9cU1:Nghcitc:q1jjbfpbibp9UpmbedilvorzHOACXQLpPa8Fa8Ep9spklbaaaoclffahc:q:yjjbfRbbfhoxikaiczfaopbbwaopbbbg8Eclp:mea8EpmbzeHdOiAlCvXoQrLpxssssssssssssssssp9og8Fpxssssssssssssssssp8Jg8Ep5b9cjF;8;4;W;G;ab9:9cU1:Ngacitc:q1jjbfpbibaac:q:yjjbfRbbgapsa8Ep5e9cjF;8;4;W;G;ab9:9cU1:Nghcitc:q1jjbfpbibp9UpmbedilvorzHOACXQLpPa8Fa8Ep9spklbaaaocwffahc:q:yjjbfRbbfhoxdkaiczfaopbbbpklbaoczfhoxekaiczfaopbbdaoRbbgacitc:q1jjbfpbibaac:q:yjjbfRbbgapsaoRbeghcitc:q1jjbfpbibp9UpmbedilvorzHOACXQLpPpklbaaaocdffahc:q:yjjbfRbbfhokdndndndndndnaqcl4ciGarfPDbedibledibkaicafpxbbbbbbbbbbbbbbbbpklbxlkaicafaopbblaopbbbg8Eclp:mea8EpmbzeHdOiAlCvXoQrLg8Ecdp:mea8EpmbzeHdOiAlCvXoQrLpxiiiiiiiiiiiiiiiip9og8Fpxiiiiiiiiiiiiiiiip8Jg8Ep5b9cjF;8;4;W;G;ab9:9cU1:Ngacitc:q1jjbfpbibaac:q:yjjbfRbbgapsa8Ep5e9cjF;8;4;W;G;ab9:9cU1:Nghcitc:q1jjbfpbibp9UpmbedilvorzHOACXQLpPa8Fa8Ep9spklbaaaoclffahc:q:yjjbfRbbfhoxikaicafaopbbwaopbbbg8Eclp:mea8EpmbzeHdOiAlCvXoQrLpxssssssssssssssssp9og8Fpxssssssssssssssssp8Jg8Ep5b9cjF;8;4;W;G;ab9:9cU1:Ngacitc:q1jjbfpbibaac:q:yjjbfRbbgapsa8Ep5e9cjF;8;4;W;G;ab9:9cU1:Nghcitc:q1jjbfpbibp9UpmbedilvorzHOACXQLpPa8Fa8Ep9spklbaaaocwffahc:q:yjjbfRbbfhoxdkaicafaopbbbpklbaoczfhoxekaicafaopbbdaoRbbgacitc:q1jjbfpbibaac:q:yjjbfRbbgapsaoRbeghcitc:q1jjbfpbibp9UpmbedilvorzHOACXQLpPpklbaaaocdffahc:q:yjjbfRbbfhokdndndndndndnaqco4arfPDbedibledibkaic8Wfpxbbbbbbbbbbbbbbbbpklbxlkaic8Wfaopbblaopbbbg8Eclp:mea8EpmbzeHdOiAlCvXoQrLg8Ecdp:mea8EpmbzeHdOiAlCvXoQrLpxiiiiiiiiiiiiiiiip9og8Fpxiiiiiiiiiiiiiiiip8Jg8Ep5b9cjF;8;4;W;G;ab9:9cU1:Ngicitc:q1jjbfpbibaic:q:yjjbfRbbgipsa8Ep5e9cjF;8;4;W;G;ab9:9cU1:Ngqcitc:q1jjbfpbibp9UpmbedilvorzHOACXQLpPa8Fa8Ep9spklbaiaoclffaqc:q:yjjbfRbbfhoxikaic8Wfaopbbwaopbbbg8Eclp:mea8EpmbzeHdOiAlCvXoQrLpxssssssssssssssssp9og8Fpxssssssssssssssssp8Jg8Ep5b9cjF;8;4;W;G;ab9:9cU1:Ngicitc:q1jjbfpbibaic:q:yjjbfRbbgipsa8Ep5e9cjF;8;4;W;G;ab9:9cU1:Ngqcitc:q1jjbfpbibp9UpmbedilvorzHOACXQLpPa8Fa8Ep9spklbaiaocwffaqc:q:yjjbfRbbfhoxdkaic8Wfaopbbbpklbaoczfhoxekaic8WfaopbbdaoRbbgicitc:q1jjbfpbibaic:q:yjjbfRbbgipsaoRbegqcitc:q1jjbfpbibp9UpmbedilvorzHOACXQLpPpklbaiaocdffaqc:q:yjjbfRbbfhokalc;abfhialcjefaX0meaihlamao9Rc;Fb0mbkkdnaiaX9pmbaici4hlinamao9RcK6mwa5aifhqdndndndndndnaOaico4fRbbalcoG4ciGarfPDbedibledibkaqpxbbbbbbbbbbbbbbbbpkbbxlkaqaopbblaopbbbg8Eclp:mea8EpmbzeHdOiAlCvXoQrLg8Ecdp:mea8EpmbzeHdOiAlCvXoQrLpxiiiiiiiiiiiiiiiip9og8Fpxiiiiiiiiiiiiiiiip8Jg8Ep5b9cjF;8;4;W;G;ab9:9cU1:Ngacitc:q1jjbfpbibaac:q:yjjbfRbbgapsa8Ep5e9cjF;8;4;W;G;ab9:9cU1:Nghcitc:q1jjbfpbibp9UpmbedilvorzHOACXQLpPa8Fa8Ep9spkbbaaaoclffahc:q:yjjbfRbbfhoxikaqaopbbwaopbbbg8Eclp:mea8EpmbzeHdOiAlCvXoQrLpxssssssssssssssssp9og8Fpxssssssssssssssssp8Jg8Ep5b9cjF;8;4;W;G;ab9:9cU1:Ngacitc:q1jjbfpbibaac:q:yjjbfRbbgapsa8Ep5e9cjF;8;4;W;G;ab9:9cU1:Nghcitc:q1jjbfpbibp9UpmbedilvorzHOACXQLpPa8Fa8Ep9spkbbaaaocwffahc:q:yjjbfRbbfhoxdkaqaopbbbpkbbaoczfhoxekaqaopbbdaoRbbgacitc:q1jjbfpbibaac:q:yjjbfRbbgapsaoRbeghcitc:q1jjbfpbibp9UpmbedilvorzHOACXQLpPpkbbaaaocdffahc:q:yjjbfRbbfhokalcdfhlaiczfgiaX6mbkkaohOaoTmoka5aXfh5a3cefg3cl9hmbkdndndndnawTmbasaYcd4fRbbglciGPlbedwbkaXTmdavcjdfaYfhlavaYfpbdbhgcbhoinalavcj;cbfaofpblbg8JaKaofpblbg8KpmbzeHdOiAlCvXoQrLg8LaQaofpblbg8MaLaofpblbg8NpmbzeHdOiAlCvXoQrLgypmbezHdiOAlvCXorQLg8Ecep9Ta8Epxeeeeeeeeeeeeeeeeg8Fp9op9Hp9rg8Eagp9Uggp9Abbbaladfglaga8Ea8Epmlvorlvorlvorlvorp9Uggp9Abbbaladfglaga8Ea8EpmwDqkwDqkwDqkwDqkp9Uggp9Abbbaladfglaga8Ea8EpmxmPsxmPsxmPsxmPsp9Uggp9Abbbaladfglaga8LaypmwDKYqk8AExm35Ps8E8Fg8Ecep9Ta8Ea8Fp9op9Hp9rg8Ep9Uggp9Abbbaladfglaga8Ea8Epmlvorlvorlvorlvorp9Uggp9Abbbaladfglaga8Ea8EpmwDqkwDqkwDqkwDqkp9Uggp9Abbbaladfglaga8Ea8EpmxmPsxmPsxmPsxmPsp9Uggp9Abbbaladfglaga8Ja8KpmwKDYq8AkEx3m5P8Es8Fg8Ja8Ma8NpmwKDYq8AkEx3m5P8Es8Fg8KpmbezHdiOAlvCXorQLg8Ecep9Ta8Ea8Fp9op9Hp9rg8Ep9Uggp9Abbbaladfglaga8Ea8Epmlvorlvorlvorlvorp9Uggp9Abbbaladfglaga8Ea8EpmwDqkwDqkwDqkwDqkp9Uggp9Abbbaladfglaga8Ea8EpmxmPsxmPsxmPsxmPsp9Uggp9Abbbaladfglaga8Ja8KpmwDKYqk8AExm35Ps8E8Fg8Ecep9Ta8Ea8Fp9op9Hp9rg8Ep9Ug8Fp9Abbbaladfgla8Fa8Ea8Epmlvorlvorlvorlvorp9Ug8Fp9Abbbaladfgla8Fa8Ea8EpmwDqkwDqkwDqkwDqkp9Ug8Fp9Abbbaladfgla8Fa8Ea8EpmxmPsxmPsxmPsxmPsp9Uggp9AbbbaladfhlaoczfgoaX6mbxikkaXTmeavcjdfaYfhlavaYfpbdbhgcbhoinalavcj;cbfaofpblbg8JaKaofpblbg8KpmbzeHdOiAlCvXoQrLg8LaQaofpblbg8MaLaofpblbg8NpmbzeHdOiAlCvXoQrLgypmbezHdiOAlvCXorQLg8Ecep:nea8Epxebebebebebebebebg8Fp9op:bep9rg8Eagp:oeggp9Abbbaladfglaga8Ea8Epmlvorlvorlvorlvorp:oeggp9Abbbaladfglaga8Ea8EpmwDqkwDqkwDqkwDqkp:oeggp9Abbbaladfglaga8Ea8EpmxmPsxmPsxmPsxmPsp:oeggp9Abbbaladfglaga8LaypmwDKYqk8AExm35Ps8E8Fg8Ecep:nea8Ea8Fp9op:bep9rg8Ep:oeggp9Abbbaladfglaga8Ea8Epmlvorlvorlvorlvorp:oeggp9Abbbaladfglaga8Ea8EpmwDqkwDqkwDqkwDqkp:oeggp9Abbbaladfglaga8Ea8EpmxmPsxmPsxmPsxmPsp:oeggp9Abbbaladfglaga8Ja8KpmwKDYq8AkEx3m5P8Es8Fg8Ja8Ma8NpmwKDYq8AkEx3m5P8Es8Fg8KpmbezHdiOAlvCXorQLg8Ecep:nea8Ea8Fp9op:bep9rg8Ep:oeggp9Abbbaladfglaga8Ea8Epmlvorlvorlvorlvorp:oeggp9Abbbaladfglaga8Ea8EpmwDqkwDqkwDqkwDqkp:oeggp9Abbbaladfglaga8Ea8EpmxmPsxmPsxmPsxmPsp:oeggp9Abbbaladfglaga8Ja8KpmwDKYqk8AExm35Ps8E8Fg8Ecep:nea8Ea8Fp9op:bep9rg8Ep:oeg8Fp9Abbbaladfgla8Fa8Ea8Epmlvorlvorlvorlvorp:oeg8Fp9Abbbaladfgla8Fa8Ea8EpmwDqkwDqkwDqkwDqkp:oeg8Fp9Abbbaladfgla8Fa8Ea8EpmxmPsxmPsxmPsxmPsp:oeggp9AbbbaladfhlaoczfgoaX6mbxdkkaXTmbcbhocbalcl4gl9Rc8FGhiavcjdfaYfhravaYfpbdbh8Finaravcj;cbfaofpblbggaKaofpblbg8JpmbzeHdOiAlCvXoQrLg8KaQaofpblbg8LaLaofpblbg8MpmbzeHdOiAlCvXoQrLg8NpmbezHdiOAlvCXorQLg8Eaip:Rea8Ealp:Sep9qg8Ea8Fp9rg8Fp9Abbbaradfgra8Fa8Ea8Epmlvorlvorlvorlvorp9rg8Fp9Abbbaradfgra8Fa8Ea8EpmwDqkwDqkwDqkwDqkp9rg8Fp9Abbbaradfgra8Fa8Ea8EpmxmPsxmPsxmPsxmPsp9rg8Fp9Abbbaradfgra8Fa8Ka8NpmwDKYqk8AExm35Ps8E8Fg8Eaip:Rea8Ealp:Sep9qg8Ep9rg8Fp9Abbbaradfgra8Fa8Ea8Epmlvorlvorlvorlvorp9rg8Fp9Abbbaradfgra8Fa8Ea8EpmwDqkwDqkwDqkwDqkp9rg8Fp9Abbbaradfgra8Fa8Ea8EpmxmPsxmPsxmPsxmPsp9rg8Fp9Abbbaradfgra8Faga8JpmwKDYq8AkEx3m5P8Es8Fgga8La8MpmwKDYq8AkEx3m5P8Es8Fg8JpmbezHdiOAlvCXorQLg8Eaip:Rea8Ealp:Sep9qg8Ep9rg8Fp9Abbbaradfgra8Fa8Ea8Epmlvorlvorlvorlvorp9rg8Fp9Abbbaradfgra8Fa8Ea8EpmwDqkwDqkwDqkwDqkp9rg8Fp9Abbbaradfgra8Fa8Ea8EpmxmPsxmPsxmPsxmPsp9rg8Fp9Abbbaradfgra8Faga8JpmwDKYqk8AExm35Ps8E8Fg8Eaip:Rea8Ealp:Sep9qg8Ep9rg8Fp9Abbbaradfgra8Fa8Ea8Epmlvorlvorlvorlvorp9rg8Fp9Abbbaradfgra8Fa8Ea8EpmwDqkwDqkwDqkwDqkp9rg8Fp9Abbbaradfgra8Fa8Ea8EpmxmPsxmPsxmPsxmPsp9rg8Fp9AbbbaradfhraoczfgoaX6mbkkaYclfgYad6mbkaHavcjdfaAad2;8qbbavavcjdfaAcufad2fad;8qbbaAazfhzc9:hoaOhxaOmbxlkkaeTmbaDalfhrcbhocuhlinaralaD9RglfaD6mdaPaeao9RaoaPfae6Eaofgoae6mbkaial9Rhxkcbc99amax9RakSEhoxekc9:hokavcj;kbf8Kjjjjbaokwbz:bjjjbk:TseHu8Jjjjjbc;ae9Rgv8Kjjjjbc9:hodnaeci9UgrcHfal0mbcuhoaiRbbgwc;WeGc;Ge9hmbawcsGgDce0mbavc;abfcFecje;8kbavcUf9cu83ibavc8Wf9cu83ibavcyf9cu83ibavcaf9cu83ibavcKf9cu83ibavczf9cu83ibav9cu83iwav9cu83ibaialfc9WfhqaicefgwarfhldnaeTmbcmcsaDceSEhkcbhxcbhmcbhrcbhicbhoindnalaq9nmbc9:hoxikdndnawRbbgDc;Ve0mbavc;abfaoaDcu7gPcl4fcsGcitfgsydlhzasydbhHdndnaDcsGgsak9pmbavaiaPfcsGcdtfydbaxasEhDaxasTgOfhxxekdndnascsSmbcehOasc987asamffcefhDxekalcefhDal8SbbgscFeGhPdndnascu9mmbaDhlxekalcvfhlaPcFbGhPcrhsdninaD8SbbgOcFbGastaPVhPaOcu9kmeaDcefhDascrfgsc8J9hmbxdkkaDcefhlkcehOaPce4cbaPceG9R7amfhDkaDhmkavc;abfaocitfgsaDBdbasazBdlavaicdtfaDBdbavc;abfaocefcsGcitfgsaHBdbasaDBdlaocdfhoaOaifhidnadcd9hmbabarcetfgsaH87ebasclfaD87ebascdfaz87ebxdkabarcdtfgsaHBdbascwfaDBdbasclfazBdbxekdnaDcpe0mbaxcefgOavaiaqaDcsGfRbbgscl49RcsGcdtfydbascz6gPEhDavaias9RcsGcdtfydbaOaPfgzascsGgOEhsaOThOdndnadcd9hmbabarcetfgHax87ebaHclfas87ebaHcdfaD87ebxekabarcdtfgHaxBdbaHcwfasBdbaHclfaDBdbkavaicdtfaxBdbavc;abfaocitfgHaDBdbaHaxBdlavaicefgicsGcdtfaDBdbavc;abfaocefcsGcitfgHasBdbaHaDBdlavaiaPfgicsGcdtfasBdbavc;abfaocdfcsGcitfgDaxBdbaDasBdlaocifhoaiaOfhiazaOfhxxekaxcbalRbbgHEgAaDc;:eSgDfhzaHcsGhCaHcl4hXdndnaHcs0mbazcefhOxekazhOavaiaX9RcsGcdtfydbhzkdndnaCmbaOcefhxxekaOhxavaiaH9RcsGcdtfydbhOkdndnaDTmbalcefhDxekalcdfhDal8SbegPcFeGhsdnaPcu9kmbalcofhAascFbGhscrhldninaD8SbbgPcFbGaltasVhsaPcu9kmeaDcefhDalcrfglc8J9hmbkaAhDxekaDcefhDkasce4cbasceG9R7amfgmhAkdndnaXcsSmbaDhsxekaDcefhsaD8SbbglcFeGhPdnalcu9kmbaDcvfhzaPcFbGhPcrhldninas8SbbgDcFbGaltaPVhPaDcu9kmeascefhsalcrfglc8J9hmbkazhsxekascefhskaPce4cbaPceG9R7amfgmhzkdndnaCcsSmbashlxekascefhlas8SbbgDcFeGhPdnaDcu9kmbascvfhOaPcFbGhPcrhDdninal8SbbgscFbGaDtaPVhPascu9kmealcefhlaDcrfgDc8J9hmbkaOhlxekalcefhlkaPce4cbaPceG9R7amfgmhOkdndnadcd9hmbabarcetfgDaA87ebaDclfaO87ebaDcdfaz87ebxekabarcdtfgDaABdbaDcwfaOBdbaDclfazBdbkavc;abfaocitfgDazBdbaDaABdlavaicdtfaABdbavc;abfaocefcsGcitfgDaOBdbaDazBdlavaicefgicsGcdtfazBdbavc;abfaocdfcsGcitfgDaABdbaDaOBdlavaiaHcz6aXcsSVfgicsGcdtfaOBdbaiaCTaCcsSVfhiaocifhokawcefhwaocsGhoaicsGhiarcifgrae6mbkkcbc99alaqSEhokavc;aef8Kjjjjbaok:clevu8Jjjjjbcz9Rhvdnaecvfal9nmbc9:skdnaiRbbc;:eGc;qeSmbcuskav9cb83iwaicefhoaialfc98fhrdnaeTmbdnadcdSmbcbhwindnaoar6mbc9:skaocefhlao8SbbgicFeGhddndnaicu9mmbalhoxekaocvfhoadcFbGhdcrhidninal8SbbgDcFbGaitadVhdaDcu9kmealcefhlaicrfgic8J9hmbxdkkalcefhokabawcdtfadc8Etc8F91adcd47avcwfadceGcdtVglydbfgiBdbalaiBdbawcefgwae9hmbxdkkcbhwindnaoar6mbc9:skaocefhlao8SbbgicFeGhddndnaicu9mmbalhoxekaocvfhoadcFbGhdcrhidninal8SbbgDcFbGaitadVhdaDcu9kmealcefhlaicrfgic8J9hmbxdkkalcefhokabawcetfadc8Etc8F91adcd47avcwfadceGcdtVglydbfgi87ebalaiBdbawcefgwae9hmbkkcbc99aoarSEk:SPliuo97eue978Jjjjjbca9Rhiaec98Ghldndnadcl9hmbdnalTmbcbhvabhdinadadpbbbgocKp:RecKp:Sep;6egraocwp:RecKp:Sep;6earp;Geaoczp:RecKp:Sep;6egwp;Gep;Kep;LegDpxbbbbbbbbbbbbbbbbp:2egqarpxbbbjbbbjbbbjbbbjgkp9op9rp;Kegrpxbb;:9cbb;:9cbb;:9cbb;:9cararp;MeaDaDp;Meawaqawakp9op9rp;Kegrarp;Mep;Kep;Kep;Jep;Negwp;Mepxbbn0bbn0bbn0bbn0gqp;KepxFbbbFbbbFbbbFbbbp9oaopxbbbFbbbFbbbFbbbFp9op9qarawp;Meaqp;Kecwp:RepxbFbbbFbbbFbbbFbbp9op9qaDawp;Meaqp;Keczp:RepxbbFbbbFbbbFbbbFbp9op9qpkbbadczfhdavclfgval6mbkkalaeSmeaipxbbbbbbbbbbbbbbbbgqpklbaiabalcdtfgdaeciGglcdtgv;8qbbdnalTmbaiaipblbgocKp:RecKp:Sep;6egraocwp:RecKp:Sep;6earp;Geaoczp:RecKp:Sep;6egwp;Gep;Kep;LegDaqp:2egqarpxbbbjbbbjbbbjbbbjgkp9op9rp;Kegrpxbb;:9cbb;:9cbb;:9cbb;:9cararp;MeaDaDp;Meawaqawakp9op9rp;Kegrarp;Mep;Kep;Kep;Jep;Negwp;Mepxbbn0bbn0bbn0bbn0gqp;KepxFbbbFbbbFbbbFbbbp9oaopxbbbFbbbFbbbFbbbFp9op9qarawp;Meaqp;Kecwp:RepxbFbbbFbbbFbbbFbbp9op9qaDawp;Meaqp;Keczp:RepxbbFbbbFbbbFbbbFbp9op9qpklbkadaiav;8qbbskdnalTmbcbhvabhdinadczfgxaxpbbbgopxbbbbbbFFbbbbbbFFgkp9oadpbbbgDaopmbediwDqkzHOAKY8AEgwczp:Reczp:Sep;6egraDaopmlvorxmPsCXQL358E8FpxFubbFubbFubbFubbp9op;7eawczp:Sep;6egwp;Gearp;Gep;Kep;Legopxbbbbbbbbbbbbbbbbp:2egqarpxbbbjbbbjbbbjbbbjgmp9op9rp;Kegrpxb;:FSb;:FSb;:FSb;:FSararp;Meaoaop;Meawaqawamp9op9rp;Kegrarp;Mep;Kep;Kep;Jep;Negwp;Mepxbbn0bbn0bbn0bbn0gqp;KepxFFbbFFbbFFbbFFbbp9oaoawp;Meaqp;Keczp:Rep9qgoarawp;Meaqp;KepxFFbbFFbbFFbbFFbbp9ogrpmwDKYqk8AExm35Ps8E8Fp9qpkbbadaDakp9oaoarpmbezHdiOAlvCXorQLp9qpkbbadcafhdavclfgval6mbkkalaeSmbaiczfpxbbbbbbbbbbbbbbbbgopklbaiaopklbaiabalcitfgdaeciGglcitgv;8qbbdnalTmbaiaipblzgopxbbbbbbFFbbbbbbFFgkp9oaipblbgDaopmbediwDqkzHOAKY8AEgwczp:Reczp:Sep;6egraDaopmlvorxmPsCXQL358E8FpxFubbFubbFubbFubbp9op;7eawczp:Sep;6egwp;Gearp;Gep;Kep;Legopxbbbbbbbbbbbbbbbbp:2egqarpxbbbjbbbjbbbjbbbjgmp9op9rp;Kegrpxb;:FSb;:FSb;:FSb;:FSararp;Meaoaop;Meawaqawamp9op9rp;Kegrarp;Mep;Kep;Kep;Jep;Negwp;Mepxbbn0bbn0bbn0bbn0gqp;KepxFFbbFFbbFFbbFFbbp9oaoawp;Meaqp;Keczp:Rep9qgoarawp;Meaqp;KepxFFbbFFbbFFbbFFbbp9ogrpmwDKYqk8AExm35Ps8E8Fp9qpklzaiaDakp9oaoarpmbezHdiOAlvCXorQLp9qpklbkadaiav;8qbbkk:oDllue97euv978Jjjjjbc8W9Rhidnaec98GglTmbcbhvabhoinaiaopbbbgraoczfgwpbbbgDpmlvorxmPsCXQL358E8Fgqczp:Segkclp:RepklbaopxbbjZbbjZbbjZbbjZpx;Zl81Z;Zl81Z;Zl81Z;Zl81Zakpxibbbibbbibbbibbbp9qp;6ep;NegkaraDpmbediwDqkzHOAKY8AEgrczp:Reczp:Sep;6ep;MegDaDp;Meakarczp:Sep;6ep;Megxaxp;Meakaqczp:Reczp:Sep;6ep;Megqaqp;Mep;Kep;Kep;Lepxbbbbbbbbbbbbbbbbp:4ep;Jepxb;:FSb;:FSb;:FSb;:FSgkp;Mepxbbn0bbn0bbn0bbn0grp;KepxFFbbFFbbFFbbFFbbgmp9oaxakp;Mearp;Keczp:Rep9qgxaDakp;Mearp;Keamp9oaqakp;Mearp;Keczp:Rep9qgkpmbezHdiOAlvCXorQLgrp5baipblbpEb:T:j83ibaocwfarp5eaipblbpEe:T:j83ibawaxakpmwDKYqk8AExm35Ps8E8Fgkp5baipblbpEd:T:j83ibaocKfakp5eaipblbpEi:T:j83ibaocafhoavclfgval6mbkkdnalaeSmbaiczfpxbbbbbbbbbbbbbbbbgkpklbaiakpklbaiabalcitfgoaeciGgvcitgw;8qbbdnavTmbaiaipblbgraipblzgDpmlvorxmPsCXQL358E8Fgqczp:Segkclp:RepklaaipxbbjZbbjZbbjZbbjZpx;Zl81Z;Zl81Z;Zl81Z;Zl81Zakpxibbbibbbibbbibbbp9qp;6ep;NegkaraDpmbediwDqkzHOAKY8AEgrczp:Reczp:Sep;6ep;MegDaDp;Meakarczp:Sep;6ep;Megxaxp;Meakaqczp:Reczp:Sep;6ep;Megqaqp;Mep;Kep;Kep;Lepxbbbbbbbbbbbbbbbbp:4ep;Jepxb;:FSb;:FSb;:FSb;:FSgkp;Mepxbbn0bbn0bbn0bbn0grp;KepxFFbbFFbbFFbbFFbbgmp9oaxakp;Mearp;Keczp:Rep9qgxaDakp;Mearp;Keamp9oaqakp;Mearp;Keczp:Rep9qgkpmbezHdiOAlvCXorQLgrp5baipblapEb:T:j83ibaiarp5eaipblapEe:T:j83iwaiaxakpmwDKYqk8AExm35Ps8E8Fgkp5baipblapEd:T:j83izaiakp5eaipblapEi:T:j83iKkaoaiaw;8qbbkk;uddiue978Jjjjjbc;ab9Rhidnadcd4ae2glc98GgvTmbcbheabhdinadadpbbbgocwp:Recwp:Sep;6eaocep:SepxbbjFbbjFbbjFbbjFp9opxbbjZbbjZbbjZbbjZp:Uep;Mepkbbadczfhdaeclfgeav6mbkkdnavalSmbaic8WfpxbbbbbbbbbbbbbbbbgopklbaicafaopklbaiczfaopklbaiaopklbaiabavcdtfgdalciGgecdtgv;8qbbdnaeTmbaiaipblbgocwp:Recwp:Sep;6eaocep:SepxbbjFbbjFbbjFbbjFp9opxbbjZbbjZbbjZbbjZp:Uep;Mepklbkadaiav;8qbbkk9teiucbcbydj1jjbgeabcifc98GfgbBdj1jjbdndnabZbcztgd9nmbcuhiabad9RcFFifcz4nbcuSmekaehikaikkkebcjwklz:Dbb",a=new Uint8Array([0,97,115,109,1,0,0,0,1,4,1,96,0,0,3,3,2,0,0,5,3,1,0,1,12,1,0,10,22,2,12,0,65,0,65,0,65,0,252,10,0,0,11,7,0,65,0,253,15,26,11]),r=new Uint8Array([32,0,65,2,1,106,34,33,3,128,11,4,13,64,6,253,10,7,15,116,127,5,8,12,40,16,19,54,20,9,27,255,113,17,42,67,24,23,146,148,18,14,22,45,70,69,56,114,101,21,25,63,75,136,108,28,118,29,73,115]);if(typeof WebAssembly!="object")return{supported:!1};var s=WebAssembly.validate(a)?o(e):o(t),n,i=WebAssembly.instantiate(s,{}).then(function(b){n=b.instance,n.exports.__wasm_call_ctors()});function o(b){for(var y=new Uint8Array(b.length),x=0;x<b.length;++x){var v=b.charCodeAt(x);y[x]=v>96?v-97:v>64?v-39:v+4}for(var M=0,x=0;x<b.length;++x)y[M++]=y[x]<60?r[y[x]]:(y[x]-60)*64+y[++x];return y.buffer.slice(0,M)}function c(b,y,x,v,M,S,A){var _=b.exports.sbrk,N=v+3&-4,I=_(N*M),C=_(S.length),B=new Uint8Array(b.exports.memory.buffer);B.set(S,C);var R=y(I,v,M,C,S.length);if(R==0&&A&&A(I,N,M),x.set(B.subarray(I,I+v*M)),_(I-_(0)),R!=0)throw new Error("Malformed buffer data: "+R)}var l={NONE:"",OCTAHEDRAL:"meshopt_decodeFilterOct",QUATERNION:"meshopt_decodeFilterQuat",EXPONENTIAL:"meshopt_decodeFilterExp"},f={ATTRIBUTES:"meshopt_decodeVertexBuffer",TRIANGLES:"meshopt_decodeIndexBuffer",INDICES:"meshopt_decodeIndexSequence"},u=[],g=0;function p(b){var y={object:new Worker(b),pending:0,requests:{}};return y.object.onmessage=function(x){var v=x.data;y.pending-=v.count,y.requests[v.id][v.action](v.value),delete y.requests[v.id]},y}function h(b){for(var y="self.ready = WebAssembly.instantiate(new Uint8Array(["+new Uint8Array(s)+"]), {}).then(function(result) { result.instance.exports.__wasm_call_ctors(); return result.instance; });self.onmessage = "+m.name+";"+c.toString()+m.toString(),x=new Blob([y],{type:"text/javascript"}),v=URL.createObjectURL(x),M=u.length;M<b;++M)u[M]=p(v);for(var M=b;M<u.length;++M)u[M].object.postMessage({});u.length=b,URL.revokeObjectURL(v)}function d(b,y,x,v,M){for(var S=u[0],A=1;A<u.length;++A)u[A].pending<S.pending&&(S=u[A]);return new Promise(function(_,N){var I=new Uint8Array(x),C=++g;S.pending+=b,S.requests[C]={resolve:_,reject:N},S.object.postMessage({id:C,count:b,size:y,source:I,mode:v,filter:M},[I.buffer])})}function m(b){var y=b.data;if(!y.id)return self.close();self.ready.then(function(x){try{var v=new Uint8Array(y.count*y.size);c(x,x.exports[y.mode],v,y.count,y.size,y.source,x.exports[y.filter]),self.postMessage({id:y.id,count:y.count,action:"resolve",value:v},[v.buffer])}catch(M){self.postMessage({id:y.id,count:y.count,action:"reject",value:M})}})}return{ready:i,supported:!0,useWorkers:function(b){h(b)},decodeVertexBuffer:function(b,y,x,v,M){c(n,n.exports.meshopt_decodeVertexBuffer,b,y,x,v,n.exports[l[M]])},decodeIndexBuffer:function(b,y,x,v){c(n,n.exports.meshopt_decodeIndexBuffer,b,y,x,v)},decodeIndexSequence:function(b,y,x,v){c(n,n.exports.meshopt_decodeIndexSequence,b,y,x,v)},decodeGltfBuffer:function(b,y,x,v,M,S){c(n,n.exports[f[M]],b,y,x,v,n.exports[l[S]])},decodeGltfBufferAsync:function(b,y,x,v,M){return u.length>0?d(b,y,x,f[v],l[M]):i.then(function(){var S=new Uint8Array(b*y);return c(n,n.exports[f[v]],S,b,y,x,n.exports[l[M]]),S})}}})();var NE=(function(){var t="b9H79Tebbbetm9Geueu9Geub9Gbb9Gsuuuuuuuuuuuu99uueu9Gvuuuuub9Gruuuuuuub9Gvuuuuue999Gvuuuuueu9Gquuuuuuu99uueu9Gwuuuuuu99ueu9Giuuue999Gluuuueu9GiuuueuiOHdilvorlwiDqkbxxbelve9Weiiviebeoweuec:G:Pdkr:Tewo9TW9T9VV95dbH9F9F939H79T9F9J9H229F9Jt9VV7bbz9TW79O9V9Wt9F79P9T9W29P9M95br8E9TW79O9V9Wt9F79P9T9W29P9M959x9Pt9OcttV9P9I91tW7bwQ9TW79O9V9Wt9F79P9T9W29P9M959q9V9P9Ut7bDX9TW79O9V9Wt9F79P9T9W29P9M959t9J9H2Wbqa9TW79O9V9Wt9F9V9Wt9P9T9P96W9wWVtW94SWt9J9O9sW9T9H9Wbkl79IV9RbxDwebcekdzsq;B:xeHdbkM9Hi8Au8A99Au8Jjjjjbc;W;qb9Rgs8Kjjjjbcbhzascxfcbc;Kbz:ojjjb8AdnabaeSmbabaeadcdtz:njjjb8AkdndnamcdGmbascxfhHcbhOxekasalcrfci4gecbyd:m:jjjbHjjjjbbgABdxasceBd2aAcbaez:ojjjbhCcbhlcbhednadTmbcbhlabheadhAinaCaeydbgXci4fgQaQRbbgQceaXcrGgXtV86bbaQcu7aX4ceGalfhlaeclfheaAcufgAmbkcualcdtalcFFFFi0EhekascCfhHasaecbyd:m:jjjbHjjjjbbgOBdzascdBd2alcd4alfhXcehAinaAgecethAaeaX6mbkcdhzcbhLascuaecdtgAaecFFFFi0Ecbyd:m:jjjbHjjjjbbgXBdCasciBd2aXcFeaAz:ojjjbhKdnadTmbaecufhYcbh8AindndnaKabaLcdtfgEydbgQc:v;t;h;Ev2aYGgXcdtfgCydbgAcuSmbceheinaOaAcdtfydbaQSmdaXaefhAaecefheaKaAaYGgXcdtfgCydbgAcu9hmbkkaOa8AcdtfaQBdbaCa8ABdba8AhAa8Acefh8AkaEaABdbaLcefgLad9hmbkkaKcbyd1:jjjbH:bjjjbbascdBd2kcbh3aHcualcefgecdtaecFFFFi0Ecbyd:m:jjjbHjjjjbbg5Bdbasa5BdlasazceVgeBd2ascxfaecdtfcuadcitadcFFFFe0Ecbyd:m:jjjbHjjjjbbg8EBdbasa8EBdwasazcdfgeBd2asclfabadalcbz:cjjjbascxfaecdtfcualcdtgealcFFFFi0Eg8Fcbyd:m:jjjbHjjjjbbgABdbasazcifgXBd2ascxfaXcdtfa8Fcbyd:m:jjjbHjjjjbbgaBdbasazclVBd2aAaaaialavaOascxfz:djjjbalcbyd:m:jjjbHjjjjbbhCascxfasyd2ghcdtfaCBdbasahcefgXBd2ascxfaXcdtfa8Fcbyd:m:jjjbHjjjjbbgXBdbasahcdfgQBd2ascxfaQcdtfa8Fcbyd:m:jjjbHjjjjbbgQBdbasahcifggBd2aXcFeaez:ojjjbh8JaQcFeaez:ojjjbh8KdnalTmba8Ecwfh8Lindna5a3gQcefg3cdtfydbgKa5aQcdtgefydbgXSmbaKaX9Rhza8EaXcitfhHa8Kaefh8Ma8JaefhEcbhYindndnaHaYcitfydbg8AaQ9hmbaEaQBdba8MaQBdbxekdna5a8Acdtg8NfgeclfydbgXaeydbgeSmba8EaecitgKfydbaQSmeaXae9Rhyaecu7aXfhLa8LaKfhXcbheinaLaeSmeaecefheaXydbhKaXcwfhXaKaQ9hmbkaeay6meka8Ka8NfgeaQa8AaeydbcuSEBdbaEa8AaQaEydbcuSEBdbkaYcefgYaz9hmbkka3al9hmbkaAhXaahQa8KhKa8JhYcbheindndnaeaXydbg8A9hmbdnaeaQydbg8A9hmbaYydbh8AdnaKydbgLcu9hmba8Acu9hmbaCaefcb86bbxikaCaefhEdnaeaLSmbaea8ASmbaEce86bbxikaEcl86bbxdkdnaeaaa8AcdtgLfydb9hmbdnaKydbgEcuSmbaeaESmbaYydbgzcuSmbaeazSmba8KaLfydbgHcuSmbaHa8ASmba8JaLfydbgLcuSmbaLa8ASmbdnaAaEcdtfydbg8AaAaLcdtfydb9hmba8AaAazcdtfydbgLSmbaLaAaHcdtfydb9hmbaCaefcd86bbxlkaCaefcl86bbxikaCaefcl86bbxdkaCaefcl86bbxekaCaefaCa8AfRbb86bbkaXclfhXaQclfhQaKclfhKaYclfhYalaecefge9hmbkdnaqTmbdndnaOTmbaOheaAhXalhQindnaqaeydbfRbbTmbaCaXydbfcl86bbkaeclfheaXclfhXaQcufgQmbxdkkaAhealhXindnaqRbbTmbaCaeydbfcl86bbkaqcefhqaeclfheaXcufgXmbkkaAhealhQaChXindnaCaeydbfRbbcl9hmbaXcl86bbkaeclfheaXcefhXaQcufgQmbkkamceGTmbaChealhXindnaeRbbce9hmbaecl86bbkaecefheaXcufgXmbkkascxfagcdtfcualcx2alc;v:Q;v:Qe0Ecbyd:m:jjjbHjjjjbbg3BdbasahclfgHBd2a3aialavaOz:ejjjbh8PdndnaDmbcbhgcbh8Lxekcbh8LawhecbhXindnaeIdbJbbbb9ETmbasc;Wbfa8LcdtfaXBdba8Lcefh8LkaeclfheaDaXcefgX9hmbkascxfaHcdtfcua8Lal2gecdtaecFFFFi0Ecbyd:m:jjjbHjjjjbbggBdbasahcvfgHBd2alTmba8LTmbarcd4hEdnaOTmba8Lcdthzcbh8AaghLinaoaOa8AcdtfydbaE2cdtfhYasc;WbfheaLhXa8LhQinaXaYaeydbcdtgKfIdbawaKfIdbNUdbaeclfheaXclfhXaQcufgQmbkaLazfhLa8Acefg8Aal9hmbxdkka8Lcdthzcbh8AaghLinaoa8AaE2cdtfhYasc;WbfheaLhXa8LhQinaXaYaeydbcdtgKfIdbawaKfIdbNUdbaeclfheaXclfhXaQcufgQmbkaLazfhLa8Acefg8Aal9hmbkkascxfaHcdtfcualc8S2gealc;D;O;f8U0EgQcbyd:m:jjjbHjjjjbbgXBdbasaHcefgKBd2aXcbaez:ojjjbhqdndndna8LTmbascxfaKcdtfaQcbyd:m:jjjbHjjjjbbgvBdbasaHcdfgXBd2avcbaez:ojjjb8AascxfaXcdtfcua8Lal2gecltgXaecFFFFb0Ecbyd:m:jjjbHjjjjbbgiBdbasaHcifBd2aicbaXz:ojjjb8AadmexdkcbhvcbhiadTmekcbhYabhXindna3aXclfydbg8Acx2fgeIdba3aXydbgLcx2fgQIdbgI:tg8Ra3aXcwfydbgEcx2fgKIdlaQIdlg8S:tgRNaKIdbaI:tg8UaeIdla8S:tg8VN:tg8Wa8WNa8VaKIdwaQIdwg8X:tg8YNaRaeIdwa8X:tg8VN:tgRaRNa8Va8UNa8Ya8RN:tg8Ra8RNMM:rg8UJbbbb9ETmba8Wa8U:vh8Wa8Ra8U:vh8RaRa8U:vhRkaqaAaLcdtfydbc8S2fgeaRa8U:rg8UaRNNg8VaeIdbMUdbaea8Ra8Ua8RNg8ZNg8YaeIdlMUdlaea8Wa8Ua8WNg80Ng81aeIdwMUdwaea8ZaRNg8ZaeIdxMUdxaea80aRNgBaeIdzMUdzaea80a8RNg80aeIdCMUdCaeaRa8Ua8Wa8XNaRaINa8Sa8RNMM:mg8SNgINgRaeIdKMUdKaea8RaINg8RaeId3MUd3aea8WaINg8WaeIdaMUdaaeaIa8SNgIaeId8KMUd8Kaea8UaeIdyMUdyaqaAa8Acdtfydbc8S2fgea8VaeIdbMUdbaea8YaeIdlMUdlaea81aeIdwMUdwaea8ZaeIdxMUdxaeaBaeIdzMUdzaea80aeIdCMUdCaeaRaeIdKMUdKaea8RaeId3MUd3aea8WaeIdaMUdaaeaIaeId8KMUd8Kaea8UaeIdyMUdyaqaAaEcdtfydbc8S2fgea8VaeIdbMUdbaea8YaeIdlMUdlaea81aeIdwMUdwaea8ZaeIdxMUdxaeaBaeIdzMUdzaea80aeIdCMUdCaeaRaeIdKMUdKaea8RaeId3MUd3aea8WaeIdaMUdaaeaIaeId8KMUd8Kaea8UaeIdyMUdyaXcxfhXaYcifgYad6mbkcbhzabhLinabazcdtfh8AcbhXinaCa8AaXc;a1jjbfydbcdtfydbgQfRbbhedndnaCaLaXfydbgKfRbbgYc99fcFeGcpe0mbaec99fcFeGc;:e6mekdnaYcufcFeGce0mba8JaKcdtfydbaQ9hmekdnaecufcFeGce0mba8KaQcdtfydbaK9hmekdnaYcv2aefc:G1jjbfRbbTmbaAaQcdtfydbaAaKcdtfydb0mekJbbacJbbacJbbjZaecFeGceSEaYceSEh80dna3a8AaXc;e1jjbfydbcdtfydbcx2fgeIdwa3aKcx2fgYIdwg8S:tg8Wa3aQcx2fgEIdwa8S:tgRaRNaEIdbaYIdbg8X:tg8Ra8RNaEIdlaYIdlg8V:tg8Ua8UNMMgINa8WaRNaeIdba8X:tg81a8RNa8UaeIdla8V:tg8ZNMMg8YaRN:tg8Wa8WNa81aINa8Ya8RN:tgRaRNa8ZaINa8Ya8UN:tg8Ra8RNMM:rg8UJbbbb9ETmba8Wa8U:vh8Wa8Ra8U:vh8RaRa8U:vhRkaqaAaKcdtfydbc8S2fgeaRa80aI:rNg8UaRNNg8YaeIdbMUdbaea8Ra8Ua8RNg80Ng81aeIdlMUdlaea8Wa8Ua8WNgINg8ZaeIdwMUdwaea80aRNg80aeIdxMUdxaeaIaRNgBaeIdzMUdzaeaIa8RNg83aeIdCMUdCaeaRa8Ua8Wa8SNaRa8XNa8Va8RNMM:mg8SNgINgRaeIdKMUdKaea8RaINg8RaeId3MUd3aea8WaINg8WaeIdaMUdaaeaIa8SNgIaeId8KMUd8Kaea8UaeIdyMUdyaqaAaQcdtfydbc8S2fgea8YaeIdbMUdbaea81aeIdlMUdlaea8ZaeIdwMUdwaea80aeIdxMUdxaeaBaeIdzMUdzaea83aeIdCMUdCaeaRaeIdKMUdKaea8RaeId3MUd3aea8WaeIdaMUdaaeaIaeId8KMUd8Kaea8UaeIdyMUdykaXclfgXcx9hmbkaLcxfhLazcifgzad6mbka8LTmbcbhLinJbbbbh8Xa3abaLcdtfgeclfydbgEcx2fgXIdwa3aeydbgzcx2fgQIdwg8Z:tg8Ra8RNaXIdbaQIdbgB:tg8Wa8WNaXIdlaQIdlg83:tg8Ua8UNMMg80a3aecwfydbgHcx2fgeIdwa8Z:tgINa8Ra8RaINa8WaeIdbaB:tg8SNa8UaeIdla83:tg8VNMMgRN:tJbbbbJbbjZa80aIaINa8Sa8SNa8Va8VNMMg81NaRaRN:tg8Y:va8YJbbbb9BEg8YNhUa81a8RNaIaRN:ta8YNh85a80a8VNa8UaRN:ta8YNh86a81a8UNa8VaRN:ta8YNh87a80a8SNa8WaRN:ta8YNh88a81a8WNa8SaRN:ta8YNh89a8Wa8VNa8Sa8UN:tgRaRNa8UaINa8Va8RN:tgRaRNa8Ra8SNaIa8WN:tgRaRNMM:rJbbbZNhRagaza8L2gwcdtfhXagaHa8L2g8NcdtfhQagaEa8L2g5cdtfhKa8Z:mh8:a83:mhZaB:mhncbhYa8Lh8AJbbbbh8VJbbbbh8YJbbbbh80Jbbbbh81Jbbbbh8ZJbbbbhBJbbbbh83JbbbbhcJbbbbh9cinasc;WbfaYfgecwfaRa85aKIdbaXIdbgI:tg8UNaUaQIdbaI:tg8SNMg8RNUdbaeclfaRa87a8UNa86a8SNMg8WNUdbaeaRa89a8UNa88a8SNMg8UNUdbaecxfaRa8:a8RNaZa8WNaIana8UNMMMgINUdbaRa8Ra8WNNa81Mh81aRa8Ra8UNNa8ZMh8ZaRa8Wa8UNNaBMhBaRaIaINNa8XMh8XaRa8RaINNa8VMh8VaRa8WaINNa8YMh8YaRa8UaINNa80Mh80aRa8Ra8RNNa83Mh83aRa8Wa8WNNacMhcaRa8Ua8UNNa9cMh9caXclfhXaKclfhKaQclfhQaYczfhYa8Acufg8Ambkavazc8S2fgea9caeIdbMUdbaeacaeIdlMUdlaea83aeIdwMUdwaeaBaeIdxMUdxaea8ZaeIdzMUdzaea81aeIdCMUdCaea80aeIdKMUdKaea8YaeId3MUd3aea8VaeIdaMUdaaea8XaeId8KMUd8KaeaRaeIdyMUdyavaEc8S2fgea9caeIdbMUdbaeacaeIdlMUdlaea83aeIdwMUdwaeaBaeIdxMUdxaea8ZaeIdzMUdzaea81aeIdCMUdCaea80aeIdKMUdKaea8YaeId3MUd3aea8VaeIdaMUdaaea8XaeId8KMUd8KaeaRaeIdyMUdyavaHc8S2fgea9caeIdbMUdbaeacaeIdlMUdlaea83aeIdwMUdwaeaBaeIdxMUdxaea8ZaeIdzMUdzaea81aeIdCMUdCaea80aeIdKMUdKaea8YaeId3MUd3aea8VaeIdaMUdaaea8XaeId8KMUd8KaeaRaeIdyMUdyaiawcltfh8AcbhXa8LhKina8AaXfgeasc;WbfaXfgQIdbaeIdbMUdbaeclfgYaQclfIdbaYIdbMUdbaecwfgYaQcwfIdbaYIdbMUdbaecxfgeaQcxfIdbaeIdbMUdbaXczfhXaKcufgKmbkaia5cltfh8AcbhXa8LhKina8AaXfgeasc;WbfaXfgQIdbaeIdbMUdbaeclfgYaQclfIdbaYIdbMUdbaecwfgYaQcwfIdbaYIdbMUdbaecxfgeaQcxfIdbaeIdbMUdbaXczfhXaKcufgKmbkaia8Ncltfh8AcbhXa8LhKina8AaXfgeasc;WbfaXfgQIdbaeIdbMUdbaeclfgYaQclfIdbaYIdbMUdbaecwfgYaQcwfIdbaYIdbMUdbaecxfgeaQcxfIdbaeIdbMUdbaXczfhXaKcufgKmbkaLcifgLad6mbkkcbhQdndnamcwGgJmbJbbbbh8Vcbh9ecbhocbhhxekcbh9ea8Fcbyd:m:jjjbHjjjjbbhhascxfasyd2gecdtfahBdbasaecefgXBd2ascxfaXcdtfcuahalabadaAz:fjjjbgKcltaKcjjjjiGEcbyd:m:jjjbHjjjjbbgoBdbasaecdfBd2aoaKaha3alz:gjjjbJFFuuh8VaKTmbaoheaKhXinaeIdbgRa8Va8VaR9EEh8VaeclfheaXcufgXmbkaKh9ekasydlhTdnalTmbaTclfheaTydbhKaChXalhYcbhQincbaeydbg8AaK9RaXRbbcpeGEaQfhQaXcefhXaeclfhea8AhKaYcufgYmbkaQce4hQkcuadaQ9RcifgScx2aSc;v:Q;v:Qe0Ecbyd:m:jjjbHjjjjbbhDascxfasyd2g9hcdtfaDBdbasa9hcefgeBd2ascxfaecdtfcuaScdtaScFFFFi0Ecbyd:m:jjjbHjjjjbbgrBdbasa9hcdfgeBd2ascxfaecdtfa8Fcbyd:m:jjjbHjjjjbbgyBdbasa9hcifgeBd2ascxfaecdtfalcbyd:m:jjjbHjjjjbbg9iBdbasa9hclfg6Bd2axaxNa8PJbbjZamclGEgUaUN:vh9cJbbbbhcdnadak9nmbdnaSci6mba8Lclth9kaDcwfh0Jbbbbh83JbbbbhcinasclfabadalaAz:cjjjbabhzcbh8Ecbh8Finaba8FcdtfhHcbheindnaAazaefydbgQcdtgEfydbgYaAaHaec;q1jjbfydbcdtfydbgXcdtgwfydbg8ASmbaCaXfRbbgLcv2aCaQfRbbgKfc;G1jjbfRbbg5aKcv2aLfg8Nc;G1jjbfRbbg8MVcFeGTmbdna8AaY9nmba8Nc:G1jjbfRbbcFeGmekaKcufhYdnaKaL9hmbaYcFeGce0mba8JaEfydbaX9hmekdndnaKclSmbaLcl9hmekdnaYcFeGce0mba8JaEfydbaX9hmdkaLcufcFeGce0mba8KawfydbaQ9hmekaDa8Ecx2fgKaXaQa8McFeGgYEBdlaKaQaXaYEBdbaKaYa5Gcb9hBdwa8Ecefh8Ekaeclfgecx9hmbkdna8Fcifg8Fad9pmbazcxfhza8EcifaS9nmekka8ETmdcbhLinaqaAaDaLcx2fgKydbgYcdtgzfydbc8S2fgeIdwa3aKydlg8Acx2fgXIdwg8WNaeIdzaXIdbg8UNaeIdaMgRaRMMa8WNaeIdlaXIdlgINaeIdCa8WNaeId3MgRaRMMaINaeIdba8UNaeIdxaINaeIdKMgRaRMMa8UNaeId8KMMM:lhRJbbbbJbbjZaeIdyg8R:va8RJbbbb9BEh8RdndnaKydwgEmbJFFuuh8YxekJbbbbJbbjZaqaAa8Acdtfydbc8S2fgeIdyg8S:va8SJbbbb9BEaeIdwa3aYcx2fgXIdwg8SNaeIdzaXIdbg8XNaeIdaMg8Ya8YMMa8SNaeIdlaXIdlg8YNaeIdCa8SNaeId3Mg8Sa8SMMa8YNaeIdba8XNaeIdxa8YNaeIdKMg8Sa8SMMa8XNaeId8KMMM:lNh8Yka8RaRNh80dna8LTmbavaYc8S2fgQIdwa8WNaQIdza8UNaQIdaMgRaRMMa8WNaQIdlaINaQIdCa8WNaQId3MgRaRMMaINaQIdba8UNaQIdxaINaQIdKMgRaRMMa8UNaQId8KMMMhRaga8Aa8L2gHcdtfhXaiaYa8L2gwcltfheaQIdyh8Sa8LhQinaXIdbg8Ra8Ra8SNaecxfIdba8WaecwfIdbNa8UaeIdbNaIaeclfIdbNMMMg8Ra8RM:tNaRMhRaXclfhXaeczfheaQcufgQmbkdndnaEmbJbbbbh8Rxekava8Ac8S2fgQIdwa3aYcx2fgeIdwg8UNaQIdzaeIdbgINaQIdaMg8Ra8RMMa8UNaQIdlaeIdlg8SNaQIdCa8UNaQId3Mg8Ra8RMMa8SNaQIdbaINaQIdxa8SNaQIdKMg8Ra8RMMaINaQId8KMMMh8RagawcdtfhXaiaHcltfheaQIdyh8Xa8LhQinaXIdbg8Wa8Wa8XNaecxfIdba8UaecwfIdbNaIaeIdbNa8SaeclfIdbNMMMg8Wa8WM:tNa8RMh8RaXclfhXaeczfheaQcufgQmbka8R:lh8Rka80aR:lMh80a8Ya8RMh8YaCaYfRbbcd9hmbdna8Ka8Ja8Jazfydba8ASEaaazfydbgHcdtfydbgzcu9hmbaaa8AcdtfydbhzkavaHc8S2fgQIdwa3azcx2fgeIdwg8WNaQIdzaeIdbg8UNaQIdaMgRaRMMa8WNaQIdlaeIdlgINaQIdCa8WNaQId3MgRaRMMaINaQIdba8UNaQIdxaINaQIdKMgRaRMMa8UNaQId8KMMMhRagaza8L2gwcdtfhXaiaHa8L2g8NcltfheaQIdyh8Sa8LhQinaXIdbg8Ra8Ra8SNaecxfIdba8WaecwfIdbNa8UaeIdbNaIaeclfIdbNMMMg8Ra8RM:tNaRMhRaXclfhXaeczfheaQcufgQmbkdndnaEmbJbbbbh8Rxekavazc8S2fgQIdwa3aHcx2fgeIdwg8UNaQIdzaeIdbgINaQIdaMg8Ra8RMMa8UNaQIdlaeIdlg8SNaQIdCa8UNaQId3Mg8Ra8RMMa8SNaQIdbaINaQIdxa8SNaQIdKMg8Ra8RMMaINaQId8KMMMh8Raga8NcdtfhXaiawcltfheaQIdyh8Xa8LhQinaXIdbg8Wa8Wa8XNaecxfIdba8UaecwfIdbNaIaeIdbNa8SaeclfIdbNMMMg8Wa8WM:tNa8RMh8RaXclfhXaeczfheaQcufgQmbka8R:lh8Rka80aR:lMh80a8Ya8RMh8YkaKa80a8Ya80a8Y9FgeEUdwaKa8AaYaeaETVgeEBdlaKaYa8AaeEBdbaLcefgLa8E9hmbkasc;Wbfcbcj;qbz:ojjjb8Aa0hea8EhXinasc;WbfaeydbcA4cF8FGgQcFAaQcFA6EcdtfgQaQydbcefBdbaecxfheaXcufgXmbkcbhecbhXinasc;WbfaefgQydbhKaQaXBdbaKaXfhXaeclfgecj;qb9hmbkcbhea0hXinasc;WbfaXydbcA4cF8FGgQcFAaQcFA6EcdtfgQaQydbgQcefBdbaraQcdtfaeBdbaXcxfhXa8Eaecefge9hmbkadak9RgQci9Uh9mdnalTmbcbheayhXinaXaeBdbaXclfhXalaecefge9hmbkkcbh9na9icbalz:ojjjbh8FaQcO9Uh9oa9mce4h9pasydwh9qcbh8Mcbh5dninaDara5cdtfydbcx2fg8NIdwgRa9c9Emea8Ma9m9pmeJFFuuh8Rdna9pa8E9pmbaDara9pcdtfydbcx2fIdwJbb;aZNh8RkdnaRa8R9ETmbaRac9ETmba8Ma9o0mdkdna8FaAa8NydlgHcdtg9rfydbgKfg9sRbba8FaAa8Nydbgzcdtg9tfydbgefg9uRbbVmbaCazfRbbh9vdnaTaecdtfgXclfydbgQaXydbgXSmbaQaX9RhYa3aKcx2fhLa3aecx2fhEa9qaXcitfhecbhXcehwdnindnayaeydbcdtfydbgQaKSmbayaeclfydbcdtfydbg8AaKSmbaQa8ASmba3a8Acx2fg8AIdba3aQcx2fgQIdbg8W:tgRaEIdlaQIdlg8U:tg8XNaEIdba8W:tg8Ya8AIdla8U:tg8RN:tgIaRaLIdla8U:tg80NaLIdba8W:tg81a8RN:tg8UNa8RaEIdwaQIdwg8S:tg8ZNa8Xa8AIdwa8S:tg8WN:tg8Xa8RaLIdwa8S:tgBNa80a8WN:tg8RNa8Wa8YNa8ZaRN:tg8Sa8Wa81NaBaRN:tgRNMMaIaINa8Xa8XNa8Sa8SNMMa8Ua8UNa8Ra8RNaRaRNMMN:rJbbj8:N9FmdkaecwfheaXcefgXaY6hwaYaX9hmbkkawceGTmba9pcefh9pxekdndndndna9vc9:fPdebdkazheinayaecdtgefaHBdbaaaefydbgeaz9hmbxikkdna8Ka8Ja8Ja9tfydbaHSEaaa9tfydbgzcdtfydbgecu9hmbaaa9rfydbhekaya9tfaHBdbaehHkayazcdtfaHBdbka9uce86bba9sce86bba8NIdwgRacacaR9DEhca9ncefh9ncecda9vceSEa8Mfh8Mka5cefg5a8E9hmbkka9nTmddnalTmbcbh8AcbhEindnayaEcdtgefydbgQaESmbaAaQcdtfydbhzdnaEaAaefydb9hgHmbaqazc8S2fgeaqaEc8S2fgXIdbaeIdbMUdbaeaXIdlaeIdlMUdlaeaXIdwaeIdwMUdwaeaXIdxaeIdxMUdxaeaXIdzaeIdzMUdzaeaXIdCaeIdCMUdCaeaXIdKaeIdKMUdKaeaXId3aeId3MUd3aeaXIdaaeIdaMUdaaeaXId8KaeId8KMUd8KaeaXIdyaeIdyMUdyka8LTmbavaQc8S2fgeavaEc8S2gwfgXIdbaeIdbMUdbaeaXIdlaeIdlMUdlaeaXIdwaeIdwMUdwaeaXIdxaeIdxMUdxaeaXIdzaeIdzMUdzaeaXIdCaeIdCMUdCaeaXIdKaeIdKMUdKaeaXId3aeId3MUd3aeaXIdaaeIdaMUdaaeaXId8KaeId8KMUd8KaeaXIdyaeIdyMUdya9kaQ2hLaihXa8LhKinaXaLfgeaXa8AfgQIdbaeIdbMUdbaeclfgYaQclfIdbaYIdbMUdbaecwfgYaQcwfIdbaYIdbMUdbaecxfgeaQcxfIdbaeIdbMUdbaXczfhXaKcufgKmbkaHmbJbbbbJbbjZaqawfgeIdygR:vaRJbbbb9BEaeIdwa3azcx2fgXIdwgRNaeIdzaXIdbg8RNaeIdaMg8Wa8WMMaRNaeIdlaXIdlg8WNaeIdCaRNaeId3MgRaRMMa8WNaeIdba8RNaeIdxa8WNaeIdKMgRaRMMa8RNaeId8KMMM:lNgRa83a83aR9DEh83ka8Aa9kfh8AaEcefgEal9hmbkcbhXa8JheindnaeydbgQcuSmbdnaXayaQcdtgKfydbgQ9hmbcuhQa8JaKfydbgKcuSmbayaKcdtfydbhQkaeaQBdbkaeclfhealaXcefgX9hmbkcbhXa8KheindnaeydbgQcuSmbdnaXayaQcdtgKfydbgQ9hmbcuhQa8KaKfydbgKcuSmbayaKcdtfydbhQkaeaQBdbkaeclfhealaXcefgX9hmbkka83aca8LEh83cbhKabhecbhYindnayaeydbcdtfydbgXayaeclfydbcdtfydbgQSmbaXayaecwfydbcdtfydbg8ASmbaQa8ASmbabaKcdtfgLaXBdbaLcwfa8ABdbaLclfaQBdbaKcifhKkaecxfheaYcifgYad6mbkdndnaJTmbaKak9nmba8Va839FTmbcbhdabhecbhXindnaoahaeydbgQcdtfydbcdtfIdba839ETmbabadcdtfgYaQBdbaYclfaeclfydbBdbaYcwfaecwfydbBdbadcifhdkaecxfheaXcifgXaK6mbkJFFuuh8Va9eTmeaohea9ehXJFFuuhRinaeIdbg8RaRaRa8R9EEg8WaRa8Ra839EgQEhRa8Wa8VaQEh8VaeclfheaXcufgXmbxdkkaKhdkadak0mbxdkkasclfabadalaAz:cjjjbkdndnadak0mbadhXxekdnaJmbadhXxekdna8Va9c9FmbadhXxekina8VJbb;aZNgRa9caRa9c9DEh8WJbbbbhRdna9eTmbaohea9ehAinaeIdbg8RaRa8Ra8W9FEaRa8RaR9EEhRaeclfheaAcufgAmbkkcbhXabhecbhAindnaoahaeydbgQcdtfydbcdtfIdba8W9ETmbabaXcdtfgKaQBdbaKclfaeclfydbBdbaKcwfaecwfydbBdbaXcifhXkaecxfheaAcifgAad6mbkJFFuuh8Vdna9eTmbaohea9ehAJFFuuh8RinaeIdbg8Ua8Ra8Ra8U9EEgIa8Ra8Ua8W9EgQEh8RaIa8VaQEh8VaeclfheaAcufgAmbkkdnaXad9hmbadhXxdkaRacacaR9DEhcaXak9nmeaXhda8Va9c9FmbkkdnamcjjjjlGTmbaOmbaXTmbcbh8AabheinaCaeydbgKfRbbc3thLaecwfgEydbhAdndna8JaKcdtgHfydbaeclfgzydbgQSmbcbhYa8KaQcdtfydbaK9hmekcjjjj94hYkaeaLaYVaKVBdbaCaQfRbbc3thLdndna8JaQcdtfydbaASmbcbhYa8KaAcdtfydbaQ9hmekcjjjj94hYkazaLaYVaQVBdbaCaAfRbbc3thYdndna8JaAcdtfydbaKSmbcbhQa8KaHfydbaA9hmekcjjjj94hQkaEaYaQVaAVBdbaecxfhea8Acifg8AaX6mbkkdnaOTmbaXTmbaXheinabaOabydbcdtfydbBdbabclfhbaecufgembkkdnaPTmbaPaUac:rNUdbka9hcdtascxffcxfhednina6Tmeaeydbcbyd1:jjjbH:bjjjbbaec98fhea6cufh6xbkkasc;W;qbf8KjjjjbaXk;Yieouabydlhvabydbclfcbaicdtz:ojjjbhoadci9UhrdnadTmbdnalTmbaehwadhDinaoalawydbcdtfydbcdtfgqaqydbcefBdbawclfhwaDcufgDmbxdkkaehwadhDinaoawydbcdtfgqaqydbcefBdbawclfhwaDcufgDmbkkdnaiTmbcbhDaohwinawydbhqawaDBdbawclfhwaqaDfhDaicufgimbkkdnadci6mbinaecwfydbhwaeclfydbhDaeydbhidnalTmbalawcdtfydbhwalaDcdtfydbhDalaicdtfydbhikavaoaicdtfgqydbcitfaDBdbavaqydbcitfawBdlaqaqydbcefBdbavaoaDcdtfgqydbcitfawBdbavaqydbcitfaiBdlaqaqydbcefBdbavaoawcdtfgwydbcitfaiBdbavawydbcitfaDBdlawawydbcefBdbaecxfhearcufgrmbkkabydbcbBdbk:todDue99aicd4aifhrcehwinawgDcethwaDar6mbkcuaDcdtgraDcFFFFi0Ecbyd:m:jjjbHjjjjbbhwaoaoyd9GgqcefBd9GaoaqcdtfawBdbawcFearz:ojjjbhkdnaiTmbalcd4hlaDcufhxcbhminamhDdnavTmbavamcdtfydbhDkcbadaDal2cdtfgDydlgwawcjjjj94SEgwcH4aw7c:F:b:DD2cbaDydbgwawcjjjj94SEgwcH4aw7c;D;O:B8J27cbaDydwgDaDcjjjj94SEgDcH4aD7c:3F;N8N27axGhwamcdthPdndndnavTmbakawcdtfgrydbgDcuSmeadavaPfydbal2cdtfgsIdbhzcehqinaqhrdnadavaDcdtfydbal2cdtfgqIdbaz9CmbaqIdlasIdl9CmbaqIdwasIdw9BmlkarcefhqakawarfaxGgwcdtfgrydbgDcu9hmbxdkkakawcdtfgrydbgDcuSmbadamal2cdtfgsIdbhzcehqinaqhrdnadaDal2cdtfgqIdbaz9CmbaqIdlasIdl9CmbaqIdwasIdw9BmikarcefhqakawarfaxGgwcdtfgrydbgDcu9hmbkkaramBdbamhDkabaPfaDBdbamcefgmai9hmbkkakcbyd1:jjjbH:bjjjbbaoaoyd9GcufBd9GdnaeTmbaiTmbcbhDaehwinawaDBdbawclfhwaiaDcefgD9hmbkcbhDaehwindnaDabydbgrSmbawaearcdtfgrydbBdbaraDBdbkawclfhwabclfhbaiaDcefgD9hmbkkk;Qodvuv998Jjjjjbca9Rgvczfcwfcbyd11jjbBdbavcb8Pdj1jjb83izavcwfcbydN1jjbBdbavcb8Pd:m1jjb83ibdnadTmbaicd4hodnabmbdnalTmbcbhrinaealarcdtfydbao2cdtfhwcbhiinavczfaifgDawaifIdbgqaDIdbgkakaq9EEUdbavaifgDaqaDIdbgkakaq9DEUdbaiclfgicx9hmbkarcefgrad9hmbxikkaocdthrcbhwincbhiinavczfaifgDaeaifIdbgqaDIdbgkakaq9EEUdbavaifgDaqaDIdbgkakaq9DEUdbaiclfgicx9hmbkaearfheawcefgwad9hmbxdkkdnalTmbcbhrinabarcx2fgiaealarcdtfydbao2cdtfgwIdbUdbaiawIdlUdlaiawIdwUdwcbhiinavczfaifgDawaifIdbgqaDIdbgkakaq9EEUdbavaifgDaqaDIdbgkakaq9DEUdbaiclfgicx9hmbkarcefgrad9hmbxdkkaocdthlcbhraehwinabarcx2fgiaearao2cdtfgDIdbUdbaiaDIdlUdlaiaDIdwUdwcbhiinavczfaifgDawaifIdbgqaDIdbgkakaq9EEUdbavaifgDaqaDIdbgkakaq9DEUdbaiclfgicx9hmbkawalfhwarcefgrad9hmbkkJbbbbavIdbavIdzgk:tgqaqJbbbb9DEgqavIdlavIdCgx:tgmamaq9DEgqavIdwavIdKgm:tgPaPaq9DEhPdnabTmbadTmbJbbbbJbbjZaP:vaPJbbbb9BEhqinabaqabIdbak:tNUdbabclfgvaqavIdbax:tNUdbabcwfgvaqavIdbam:tNUdbabcxfhbadcufgdmbkkaPk:ZlewudnaeTmbcbhvabhoinaoavBdbaoclfhoaeavcefgv9hmbkkdnaiTmbcbhrinadarcdtfhwcbhDinalawaDcdtgvc;a1jjbfydbcdtfydbcdtfydbhodnabalawavfydbcdtfydbgqcdtfgkydbgvaqSmbinakabavgqcdtfgxydbgvBdbaxhkaqav9hmbkkdnabaocdtfgkydbgvaoSmbinakabavgocdtfgxydbgvBdbaxhkaoav9hmbkkdnaqaoSmbabaqaoaqao0Ecdtfaqaoaqao6EBdbkaDcefgDci9hmbkarcifgrai6mbkkdnaembcbskcbhxindnalaxcdtgvfydbax9hmbaxhodnabavfgDydbgvaxSmbaDhqinaqabavgocdtfgkydbgvBdbakhqaoav9hmbkkaDaoBdbkaxcefgxae9hmbkcbhvabhocbhkindndnavalydbgq9hmbdnavaoydbgq9hmbaoakBdbakcefhkxdkaoabaqcdtfydbBdbxekaoabaqcdtfydbBdbkaoclfhoalclfhlaeavcefgv9hmbkakk;Jiilud99duabcbaecltz:ojjjbhvdnalTmbadhoaihralhwinarcwfIdbhDarclfIdbhqavaoydbcltfgkarIdbakIdbMUdbakclfgxaqaxIdbMUdbakcwfgxaDaxIdbMUdbakcxfgkakIdbJbbjZMUdbaoclfhoarcxfhrawcufgwmbkkdnaeTmbavhraehkinarcxfgoIdbhDaocbBdbararIdbJbbbbJbbjZaD:vaDJbbbb9BEgDNUdbarclfgoaDaoIdbNUdbarcwfgoaDaoIdbNUdbarczfhrakcufgkmbkkdnalTmbinavadydbcltfgrcxfgkaicwfIdbarcwfIdb:tgDaDNaiIdbarIdb:tgDaDNaiclfIdbarclfIdb:tgDaDNMMgDakIdbgqaqaD9DEUdbadclfhdaicxfhialcufglmbkkdnaeTmbavcxfhrinabarIdbUdbarczfhrabclfhbaecufgembkkk8MbabaeadaialavcbcbcbcbcbaoarawaDz:bjjjbk8MbabaeadaialavaoarawaDaqakaxamaPz:bjjjbk:DCoDud99rue99iul998Jjjjjbc;Wb9Rgw8KjjjjbdndnarmbcbhDxekawcxfcbc;Kbz:ojjjb8Aawcuadcx2adc;v:Q;v:Qe0Ecbyd:m:jjjbHjjjjbbgqBdxawceBd2aqaeadaicbz:ejjjb8AawcuadcdtadcFFFFi0Egkcbyd:m:jjjbHjjjjbbgxBdzawcdBd2adcd4adfhmceheinaegicetheaiam6mbkcbhPawcuaicdtgsaicFFFFi0Ecbyd:m:jjjbHjjjjbbgzBdCawciBd2dndnar:ZgH:rJbbbZMgO:lJbbb9p9DTmbaO:Ohexekcjjjj94hekaicufhAc:bwhmcbhCadhXcbhQinaChLaeamgKcufaeaK9iEaPgDcefaeaD9kEhYdndnadTmbaYcuf:YhOaqhiaxheadhmindndnaiIdbaONJbbbZMg8A:lJbbb9p9DTmba8A:OhCxekcjjjj94hCkaCcCthCdndnaiclfIdbaONJbbbZMg8A:lJbbb9p9DTmba8A:OhExekcjjjj94hEkaEcqtaCVhCdndnaicwfIdbaONJbbbZMg8A:lJbbb9p9DTmba8A:OhExekcjjjj94hEkaeaCaEVBdbaicxfhiaeclfheamcufgmmbkazcFeasz:ojjjbh3cbh5cbhPindna3axaPcdtfydbgCcm4aC7c:v;t;h;Ev2gics4ai7aAGgmcdtfgEydbgecuSmbaeaCSmbcehiina3amaifaAGgmcdtfgEydbgecuSmeaicefhiaeaC9hmbkkaEaCBdba5aecuSfh5aPcefgPad9hmbxdkkazcFeasz:ojjjb8Acbh5kaDaYa5ar0giEhPaLa5aiEhCdna5arSmbaYaKaiEgmaP9Rcd9imbdndnaQcl0mbdnaX:ZgOaL:Zg8A:taY:Yg8EaD:Y:tg8Fa8EaK:Y:tgaa5:ZghaH:tNNNaOaH:taaNa8Aah:tNa8AaH:ta8FNahaO:tNM:va8EMJbbbZMgO:lJbbb9p9DTmbaO:Ohexdkcjjjj94hexekaPamfcd9Theka5aXaiEhXaQcefgQcs9hmekkdndnaCmbcihicbhDxekcbhiawakcbyd:m:jjjbHjjjjbbg5BdKawclBd2aPcuf:Yh8AdndnadTmbaqhiaxheadhmindndnaiIdba8ANJbbbZMgO:lJbbb9p9DTmbaO:OhCxekcjjjj94hCkaCcCthCdndnaiclfIdba8ANJbbbZMgO:lJbbb9p9DTmbaO:OhExekcjjjj94hEkaEcqtaCVhCdndnaicwfIdba8ANJbbbZMgO:lJbbb9p9DTmbaO:OhExekcjjjj94hEkaeaCaEVBdbaicxfhiaeclfheamcufgmmbkazcFeasz:ojjjbh3cbhDcbhYindndndna3axaYcdtgKfydbgCcm4aC7c:v;t;h;Ev2gics4ai7aAGgmcdtfgEydbgecuSmbcehiinaxaecdtgefydbaCSmdamaifheaicefhia3aeaAGgmcdtfgEydbgecu9hmbkkaEaYBdbaDhiaDcefhDxeka5aefydbhika5aKfaiBdbaYcefgYad9hmbkcuaDc32giaDc;j:KM;jb0EhexekazcFeasz:ojjjb8AcbhDcbhekawaecbyd:m:jjjbHjjjjbbgeBd3awcvBd2aecbaiz:ojjjbhEavcd4hKdnadTmbdnalTmbaKcdth3a5hCaqhealhmadhAinaEaCydbc32fgiaeIdbaiIdbMUdbaiaeclfIdbaiIdlMUdlaiaecwfIdbaiIdwMUdwaiamIdbaiIdxMUdxaiamclfIdbaiIdzMUdzaiamcwfIdbaiIdCMUdCaiaiIdKJbbjZMUdKaCclfhCaecxfheama3fhmaAcufgAmbxdkka5hmaqheadhCinaEamydbc32fgiaeIdbaiIdbMUdbaiaeclfIdbaiIdlMUdlaiaecwfIdbaiIdwMUdwaiaiIdxJbbbbMUdxaiaiIdzJbbbbMUdzaiaiIdCJbbbbMUdCaiaiIdKJbbjZMUdKamclfhmaecxfheaCcufgCmbkkdnaDTmbaEhiaDheinaiaiIdbJbbbbJbbjZaicKfIdbgO:vaOJbbbb9BEgONUdbaiclfgmaOamIdbNUdbaicwfgmaOamIdbNUdbaicxfgmaOamIdbNUdbaiczfgmaOamIdbNUdbaicCfgmaOamIdbNUdbaic3fhiaecufgembkkcbhCawcuaDcdtgYaDcFFFFi0Egicbyd:m:jjjbHjjjjbbgeBdaawcoBd2awaicbyd:m:jjjbHjjjjbbg3Bd8KaecFeaYz:ojjjbhxdnadTmbJbbjZJbbjZa8A:vaPceSEaoNgOaONh8AaKcdthPalheina8Aaec;81jjbalEgmIdwaEa5ydbgAc32fgiIdC:tgOaONamIdbaiIdx:tgOaONamIdlaiIdz:tgOaONMMNaqcwfIdbaiIdw:tgOaONaqIdbaiIdb:tgOaONaqclfIdbaiIdl:tgOaONMMMhOdndnaxaAcdtgifgmydbcuSmba3aifIdbaO9ETmekamaCBdba3aifaOUdbka5clfh5aqcxfhqaeaPfheadaCcefgC9hmbkkabaxaYz:njjjb8AcrhikaicdthiinaiTmeaic98fgiawcxffydbcbyd1:jjjbH:bjjjbbxbkkawc;Wbf8KjjjjbaDk:Ydidui99ducbhi8Jjjjjbca9Rglczfcwfcbyd11jjbBdbalcb8Pdj1jjb83izalcwfcbydN1jjbBdbalcb8Pd:m1jjb83ibdndnaembJbbjFhvJbbjFhoJbbjFhrxekadcd4cdthwincbhdinalczfadfgDabadfIdbgvaDIdbgoaoav9EEUdbaladfgDavaDIdbgoaoav9DEUdbadclfgdcx9hmbkabawfhbaicefgiae9hmbkalIdwalIdK:thralIdlalIdC:thoalIdbalIdz:thvkJbbbbavavJbbbb9DEgvaoaoav9DEgvararav9DEk9DeeuabcFeaicdtz:ojjjbhlcbhbdnadTmbindnalaeydbcdtfgiydbcu9hmbaiabBdbabcefhbkaeclfheadcufgdmbkkabk9teiucbcbyd:q:jjjbgeabcifc98GfgbBd:q:jjjbdndnabZbcztgd9nmbcuhiabad9RcFFifcz4nbcuSmekaehikaik;teeeudndnaeabVciGTmbabhixekdndnadcz9pmbabhixekabhiinaiaeydbBdbaiaeydlBdlaiaeydwBdwaiaeydxBdxaeczfheaiczfhiadc9Wfgdcs0mbkkadcl6mbinaiaeydbBdbaeclfheaiclfhiadc98fgdci0mbkkdnadTmbinaiaeRbb86bbaicefhiaecefheadcufgdmbkkabk:3eedudndnabciGTmbabhixekaecFeGc:b:c:ew2hldndnadcz9pmbabhixekabhiinaialBdxaialBdwaialBdlaialBdbaiczfhiadc9Wfgdcs0mbkkadcl6mbinaialBdbaiclfhiadc98fgdci0mbkkdnadTmbinaiae86bbaicefhiadcufgdmbkkabk9teiucbcbyd:q:jjjbgeabcrfc94GfgbBd:q:jjjbdndnabZbcztgd9nmbcuhiabad9RcFFifcz4nbcuSmekaehikaik9:eiuZbhedndncbyd:q:jjjbgdaecztgi9nmbcuheadai9RcFFifcz4nbcuSmekadhekcbabae9Rcifc98Gcbyd:q:jjjbfgdBd:q:jjjbdnadZbcztge9nmbadae9RcFFifcz4nb8Akkk:Iedbcjwk1eFFuuFFuuFFuuFFuFFFuFFFuFbbbbbbbbeeebeebebbeeebebbbbbebebbbbbbbbbebbbdbbbbbbbebbbebbbdbbbbbbbbbbbeeeeebebbebbebebbbeebbbbbbbbbbbbbbbbbbbbbc1Dkxebbbdbbb:GNbb",e=new Uint8Array([32,0,65,2,1,106,34,33,3,128,11,4,13,64,6,253,10,7,15,116,127,5,8,12,40,16,19,54,20,9,27,255,113,17,42,67,24,23,146,148,18,14,22,45,70,69,56,114,101,21,25,63,75,136,108,28,118,29,73,115]);if(typeof WebAssembly!="object")return{supported:!1};var a,r=WebAssembly.instantiate(s(t),{}).then(function(h){a=h.instance,a.exports.__wasm_call_ctors()});function s(h){for(var d=new Uint8Array(h.length),m=0;m<h.length;++m){var b=h.charCodeAt(m);d[m]=b>96?b-97:b>64?b-39:b+4}for(var y=0,m=0;m<h.length;++m)d[y++]=d[m]<60?e[d[m]]:(d[m]-60)*64+d[++m];return d.buffer.slice(0,y)}function n(h){if(!h)throw new Error("Assertion failed")}function i(h){return new Uint8Array(h.buffer,h.byteOffset,h.byteLength)}function o(h,d,m){var b=a.exports.sbrk,y=b(d.length*4),x=b(m*4),v=new Uint8Array(a.exports.memory.buffer),M=i(d);v.set(M,y);var S=h(x,y,d.length,m);v=new Uint8Array(a.exports.memory.buffer);var A=new Uint32Array(m);new Uint8Array(A.buffer).set(v.subarray(x,x+m*4)),M.set(v.subarray(y,y+d.length*4)),b(y-b(0));for(var _=0;_<d.length;++_)d[_]=A[d[_]];return[A,S]}function c(h){for(var d=0,m=0;m<h.length;++m){var b=h[m];d=d<b?b:d}return d}function l(h,d,m,b,y,x,v,M,S){var A=a.exports.sbrk,_=A(4),N=A(m*4),I=A(y*x),C=A(m*4),B=new Uint8Array(a.exports.memory.buffer);B.set(i(b),I),B.set(i(d),C);var R=h(N,C,m,I,y,x,v,M,S,_);B=new Uint8Array(a.exports.memory.buffer);var j=new Uint32Array(R);i(j).set(B.subarray(N,N+R*4));var q=new Float32Array(1);return i(q).set(B.subarray(_,_+4)),A(_-A(0)),[j,q[0]]}function f(h,d,m,b,y,x,v,M,S,A,_,N,I){var C=a.exports.sbrk,B=C(4),R=C(m*4),j=C(y*x),q=C(y*M),$=C(S.length*4),Z=C(m*4),me=A?C(y):0,se=new Uint8Array(a.exports.memory.buffer);se.set(i(b),j),se.set(i(v),q),se.set(i(S),$),se.set(i(d),Z),A&&se.set(i(A),me);var ge=h(R,Z,m,j,y,x,q,M,$,S.length,me,_,N,I,B);se=new Uint8Array(a.exports.memory.buffer);var Se=new Uint32Array(ge);i(Se).set(se.subarray(R,R+ge*4));var be=new Float32Array(1);return i(be).set(se.subarray(B,B+4)),C(B-C(0)),[Se,be[0]]}function u(h,d,m,b){var y=a.exports.sbrk,x=y(m*b),v=new Uint8Array(a.exports.memory.buffer);v.set(i(d),x);var M=h(x,m,b);return y(x-y(0)),M}function g(h,d,m,b,y,x,v,M){var S=a.exports.sbrk,A=S(M*4),_=S(m*b),N=S(m*x),I=new Uint8Array(a.exports.memory.buffer);I.set(i(d),_),y&&I.set(i(y),N);var C=h(A,_,m,b,N,x,v,M);I=new Uint8Array(a.exports.memory.buffer);var B=new Uint32Array(C);return i(B).set(I.subarray(A,A+C*4)),S(A-S(0)),B}var p={LockBorder:1,Sparse:2,ErrorAbsolute:4,Prune:8,_InternalDebug:1<<30};return{ready:r,supported:!0,compactMesh:function(h){n(h instanceof Uint32Array||h instanceof Int32Array||h instanceof Uint16Array||h instanceof Int16Array),n(h.length%3==0);var d=h.BYTES_PER_ELEMENT==4?h:new Uint32Array(h);return o(a.exports.meshopt_optimizeVertexFetchRemap,d,c(h)+1)},simplify:function(h,d,m,b,y,x){n(h instanceof Uint32Array||h instanceof Int32Array||h instanceof Uint16Array||h instanceof Int16Array),n(h.length%3==0),n(d instanceof Float32Array),n(d.length%m==0),n(m>=3),n(b>=0&&b<=h.length),n(b%3==0),n(y>=0);for(var v=0,M=0;M<(x?x.length:0);++M)n(x[M]in p),v|=p[x[M]];var S=h.BYTES_PER_ELEMENT==4?h:new Uint32Array(h),A=l(a.exports.meshopt_simplify,S,h.length,d,d.length/m,m*4,b,y,v);return A[0]=h instanceof Uint32Array?A[0]:new h.constructor(A[0]),A},simplifyWithAttributes:function(h,d,m,b,y,x,v,M,S,A){n(h instanceof Uint32Array||h instanceof Int32Array||h instanceof Uint16Array||h instanceof Int16Array),n(h.length%3==0),n(d instanceof Float32Array),n(d.length%m==0),n(m>=3),n(b instanceof Float32Array),n(b.length%y==0),n(y>=0),n(v==null||v instanceof Uint8Array),n(v==null||v.length==d.length/m),n(M>=0&&M<=h.length),n(M%3==0),n(S>=0),n(Array.isArray(x)),n(y>=x.length),n(x.length<=32);for(var _=0;_<x.length;++_)n(x[_]>=0);for(var N=0,_=0;_<(A?A.length:0);++_)n(A[_]in p),N|=p[A[_]];var I=h.BYTES_PER_ELEMENT==4?h:new Uint32Array(h),C=f(a.exports.meshopt_simplifyWithAttributes,I,h.length,d,d.length/m,m*4,b,y*4,new Float32Array(x),v?new Uint8Array(v):null,M,S,N);return C[0]=h instanceof Uint32Array?C[0]:new h.constructor(C[0]),C},getScale:function(h,d){return n(h instanceof Float32Array),n(h.length%d==0),n(d>=3),u(a.exports.meshopt_simplifyScale,h,h.length/d,d*4)},simplifyPoints:function(h,d,m,b,y,x){return n(h instanceof Float32Array),n(h.length%d==0),n(d>=3),n(m>=0&&m<=h.length/d),b?(n(b instanceof Float32Array),n(b.length%y==0),n(y>=3),n(h.length/d==b.length/y),g(a.exports.meshopt_simplifyPoints,h,h.length/d,d*4,b,y*4,x,m)):g(a.exports.meshopt_simplifyPoints,h,h.length/d,d*4,void 0,0,0,m)}}})();var BE=(function(){var t="b9H79TebbbeVx9Geueu9Geub9Gbb9Giuuueu9Gmuuuuuuuuuuu9999eu9Gvuuuuueu9Gwuuuuuuuub9Gxuuuuuuuuuuuueu9Gkuuuuuuuuuu99eu9Gouuuuuub9Gruuuuuuub9GluuuubiOHdilvorwDqqkbiibeilve9Weiiviebeoweuec;G:Odkr:Yewo9TW9T9VV95dbH9F9F939H79T9F9J9H229F9Jt9VV7bb8A9TW79O9V9Wt9F9I919P29K9nW79O2Wt79c9V919U9KbeX9TW79O9V9Wt9F9I919P29K9nW79O2Wt7bo39TW79O9V9Wt9F9J9V9T9W91tWJ2917tWV9c9V919U9K7br39TW79O9V9Wt9F9J9V9T9W91tW9nW79O2Wt9c9V919U9K7bDL9TW79O9V9Wt9F9V9Wt9P9T9P96W9nW79O2Wtbql79IV9RbkDwebcekdsPq;Q9BHdbkIbabaec9:fgefcufae9Ugeabci9Uadfcufad9Ugbaeab0Ek:w8KDPue99eux99dui99euo99iu8Jjjjjbc:WD9Rgm8KjjjjbdndnalmbcbhPxekamc:Cwfcbc;Kbz:njjjb8Adndnalcb9imbaoal9nmbamcuaocdtaocFFFFi0Egscbyd;y1jjbHjjjjbbgzBd:CwamceBd;8wamascbyd;y1jjbHjjjjbbgHBd:GwamcdBd;8wamcualcdtalcFFFFi0Ecbyd;y1jjbHjjjjbbgOBd:KwamciBd;8waihsalhAinazasydbcdtfcbBdbasclfhsaAcufgAmbkaihsalhAinazasydbcdtfgCaCydbcefBdbasclfhsaAcufgAmbkaihsalhCcbhXindnazasydbcdtgQfgAydbcb9imbaHaQfaXBdbaAaAydbgQcjjjj94VBdbaQaXfhXkasclfhsaCcufgCmbkalci9UhLdnalci6mbcbhsaihAinaAcwfydbhCaAclfydbhXaHaAydbcdtfgQaQydbgQcefBdbaOaQcdtfasBdbaHaXcdtfgXaXydbgXcefBdbaOaXcdtfasBdbaHaCcdtfgCaCydbgCcefBdbaOaCcdtfasBdbaAcxfhAaLascefgs9hmbkkaihsalhAindnazasydbcdtgCfgXydbgQcu9kmbaXaQcFFFFrGgQBdbaHaCfgCaCydbaQ9RBdbkasclfhsaAcufgAmbxdkkamcuaocdtgsaocFFFFi0EgAcbyd;y1jjbHjjjjbbgzBd:CwamceBd;8wamaAcbyd;y1jjbHjjjjbbgHBd:GwamcdBd;8wamcualcdtalcFFFFi0Ecbyd;y1jjbHjjjjbbgOBd:KwamciBd;8wazcbasz:njjjbhXalci9UhLaihsalhAinaXasydbcdtfgCaCydbcefBdbasclfhsaAcufgAmbkdnaoTmbcbhsaHhAaXhCaohQinaAasBdbaAclfhAaCydbasfhsaCclfhCaQcufgQmbkkdnalci6mbcbhsaihAinaAcwfydbhCaAclfydbhQaHaAydbcdtfgKaKydbgKcefBdbaOaKcdtfasBdbaHaQcdtfgQaQydbgQcefBdbaOaQcdtfasBdbaHaCcdtfgCaCydbgCcefBdbaOaCcdtfasBdbaAcxfhAaLascefgs9hmbkkaoTmbcbhsaohAinaHasfgCaCydbaXasfydb9RBdbasclfhsaAcufgAmbkkamaLcbyd;y1jjbHjjjjbbgsBd:OwamclBd;8wascbaLz:njjjbhYamcuaLcK2alcjjjjd0Ecbyd;y1jjbHjjjjbbg8ABd:SwamcvBd;8wJbbbbhEdnalci6g3mbarcd4hKaihAa8AhsaLhrJbbbbh5inavaAclfydbaK2cdtfgCIdlh8EavaAydbaK2cdtfgXIdlhEavaAcwfydbaK2cdtfgQIdlh8FaCIdwhaaXIdwhhaQIdwhgasaCIdbg8JaXIdbg8KMaQIdbg8LMJbbnn:vUdbasclfaXIdlaCIdlMaQIdlMJbbnn:vUdbaQIdwh8MaCIdwh8NaXIdwhyascxfa8EaE:tg8Eagah:tggNa8FaE:tg8Faaah:tgaN:tgEJbbbbJbbjZa8Ja8K:tg8Ja8FNa8La8K:tg8Ka8EN:tghahNaEaENaaa8KNaga8JN:tgEaENMM:rg8K:va8KJbbbb9BEg8ENUdbasczfaEa8ENUdbascCfaha8ENUdbascwfa8Maya8NMMJbbnn:vUdba5a8KMh5aAcxfhAascKfhsarcufgrmbka5aL:Z:vJbbbZNhEkamcuaLcdtalcFFFF970Ecbyd;y1jjbHjjjjbbgCBd:WwamcoBd;8waEaq:ZNhEdna3mbcbhsaChAinaAasBdbaAclfhAaLascefgs9hmbkkaE:rhhcuh8PamcuaLcltalcFFFFd0Ecbyd;y1jjbHjjjjbbgIBd:0wamcrBd;8wcbaIa8AaCaLz:djjjb8AJFFuuhyJFFuuh8RJFFuuh8Sdnalci6gXmbJFFuuh8Sa8AhsaLhAJFFuuh8RJFFuuhyinascwfIdbgEayayaE9EEhyasclfIdbgEa8Ra8RaE9EEh8RasIdbgEa8Sa8SaE9EEh8SascKfhsaAcufgAmbkkahJbbbZNhgamaocetgscuaocu9kEcbyd;y1jjbHjjjjbbgABd:4waAcFeasz:njjjbhCdnaXmbcbhAJFFuuhEa8Ahscuh8PinascwfIdbay:tghahNasIdba8S:tghahNasclfIdba8R:tghahNMM:rghaEa8PcuSahaE9DVgXEhEaAa8PaXEh8PascKfhsaLaAcefgA9hmbkkamczfcbcjwz:njjjb8Aamcwf9cb83ibam9cb83ibagaxNhRJbbjZak:th8Ncbh8UJbbbbh8VJbbbbh8WJbbbbh8XJbbbbh8YJbbbbh8ZJbbbbh80cbh81cbhPinJbbbbhEdna8UTmbJbbjZa8U:Z:vhEkJbbbbhhdna80a80Na8Ya8YNa8Za8ZNMMg8KJbbbb9BmbJbbjZa8K:r:vhhka8XaENh5a8WaENh8Fa8VaENhaa8PhQdndndndndna8UaPVTmbamydwgBTmea80ahNh8Ja8ZahNh8La8YahNh8Maeamydbcdtfh83cbh3JFFuuhEcvhXcuhQindnaza83a3cdtfydbcdtgsfydbgvTmbaOaHasfydbcdtfhAindndnaCaiaAydbgKcx2fgsclfydbgrcetf8Vebcs4aCasydbgLcetf8Vebcs4faCascwfydbglcetf8Vebcs4fgombcbhsxekcehsazaLcdtfydbgLceSmbcehsazarcdtfydbgrceSmbcehsazalcdtfydbglceSmbdnarcdSaLcdSfalcdSfcd6mbaocefhsxekaocdfhskdnasaX9kmba8AaKcK2fgLIdwa5:thhaLIdla8F:th8KaLIdbaa:th8EdndnakJbbbb9DTmba8E:lg8Ea8K:lg8Ka8Ea8K9EEg8Kah:lgha8Kah9EEag:vJbbjZMhhxekahahNa8Ea8ENa8Ka8KNMM:rag:va8NNJbbjZMJ9VO:d86JbbjZaLIdCa8JNaLIdxa8MNa8LaLIdzNMMakN:tghahJ9VO:d869DENhhkaKaQasaX6ahaE9DVgLEhQasaXaLEhXahaEaLEhEkaAclfhAavcufgvmbkka3cefg3aB9hmbkkaQcu9hmekama5Ud:ODama8FUd:KDamaaUd:GDamcuBd:qDamcFFF;7rBdjDaIcba8AaYamc:GDfakJbbbb9Damc:qDfamcjDfz:ejjjbamyd:qDhQdndnaxJbbbb9ETmba8UaD6mbaQcuSmeceh3amIdjDaR9EmixdkaQcu9hmekdna8UTmbdnamydlgza8Uci2fgsciGTmbadasfcba8Uazcu7fciGcefz:njjjb8AkabaPcltfgzam8Pib83dbazcwfamcwf8Pib83dbaPcefhPkc3hzinazc98Smvamc:Cwfazfydbcbyd;u1jjbH:bjjjbbazc98fhzxbkkcbh3a8Uaq9pmbamydwaCaiaQcx2fgsydbcetf8Vebcs4aCascwfydbcetf8Vebcs4faCasclfydbcetf8Vebcs4ffaw9nmekcbhscbhAdna81TmbcbhAamczfhXinamczfaAcdtfaXydbgLBdbaXclfhXaAaYaLfRbbTfhAa81cufg81mbkkamydwhlamydbhXam9cu83i:GDam9cu83i:ODam9cu83i:qDam9cu83i:yDaAc;8eaAclfc:bd6Eh81inamcjDfasfcFFF;7rBdbasclfgscz9hmbka81cdthBdnalTmbaeaXcdtfhocbhrindnazaoarcdtfydbcdtgsfydbgvTmbaOaHasfydbcdtfhAcuhLcuhsinazaiaAydbgKcx2fgXclfydbcdtfydbazaXydbcdtfydbfazaXcwfydbcdtfydbfgXasaXas6gXEhsaKaLaXEhLaAclfhAavcufgvmbkaLcuSmba8AaLcK2fgAIdway:tgEaENaAIdba8S:tgEaENaAIdla8R:tgEaENMM:rhEcbhAindndnasamc:qDfaAfgvydbgX6mbasaX9hmeaEamcjDfaAfIdb9FTmekavasBdbamc:GDfaAfaLBdbamcjDfaAfaEUdbxdkaAclfgAcz9hmbkkarcefgral9hmbkkamczfaBfhLcbhscbhAindnamc:GDfasfydbgXcuSmbaLaAcdtfaXBdbaAcefhAkasclfgscz9hmbkaAa81fg81TmbJFFuuhhcuhKamczfhsa81hvcuhLina8AasydbgXcK2fgAIdway:tgEaENaAIdba8S:tgEaENaAIdla8R:tgEaENMM:rhEdndnazaiaXcx2fgAclfydbcdtfydbazaAydbcdtfydbfazaAcwfydbcdtfydbfgAaL6mbaAaL9hmeaEah9DTmekaEhhaAhLaXhKkasclfhsavcufgvmbkaKcuSmbaKhQkdnamaiaQcx2fgrydbarclfydbarcwfydbaCabaeadaPawaqa3z:fjjjbTmbaPcefhPJbbbbh8VJbbbbh8WJbbbbh8XJbbbbh8YJbbbbh8ZJbbbbh80kcbhXinaOaHaraXcdtfydbcdtgAfydbcdtfgKhsazaAfgvydbgLhAdnaLTmbdninasydbaQSmeasclfhsaAcufgATmdxbkkasaKaLcdtfc98fydbBdbavavydbcufBdbkaXcefgXci9hmbka8AaQcK2fgsIdbhEasIdlhhasIdwh8KasIdxh8EasIdzh5asIdCh8FaYaQfce86bba80a8FMh80a8Za5Mh8Za8Ya8EMh8Ya8Xa8KMh8Xa8WahMh8Wa8VaEMh8Vamydxh8Uxbkkamc:WDf8KjjjjbaPk;Vvivuv99lu8Jjjjjbca9Rgv8Kjjjjbdndnalcw0mbaiydbhoaeabcitfgralcdtcufBdlaraoBdbdnalcd6mbaiclfhoalcufhwarcxfhrinaoydbhDarcuBdbarc98faDBdbarcwfhraoclfhoawcufgwmbkkalabfhrxekcbhDavczfcwfcbBdbav9cb83izavcwfcbBdbav9cb83ibJbbjZhqJbbjZhkinadaiaDcdtfydbcK2fhwcbhrinavczfarfgoawarfIdbgxaoIdbgm:tgPakNamMgmUdbavarfgoaPaxam:tNaoIdbMUdbarclfgrcx9hmbkJbbjZaqJbbjZMgq:vhkaDcefgDal9hmbkcbhoadcbcecdavIdlgxavIdwgm9GEgravIdbgPam9GEaraPax9GEgscdtgrfhzavczfarfIdbhxaihralhwinaiaocdtfgDydbhHaDarydbgOBdbaraHBdbarclfhraoazaOcK2fIdbax9Dfhoawcufgwmbkaeabcitfhrdndnaocv6mbaoalc98f6mekaraiydbBdbaralcdtcufBdlaiclfhoalcufhwarcxfhrinaoydbhDarcuBdbarc98faDBdbarcwfhraoclfhoawcufgwmbkalabfhrxekaraxUdbararydlc98GasVBdlabcefaeadaiaoz:djjjbhwararydlciGawabcu7fcdtVBdlawaeadaiaocdtfalao9Rz:djjjbhrkavcaf8Kjjjjbark:;idiud99dndnabaecitfgwydlgDciGgqciSmbinabcbaDcd4gDalaqcdtfIdbawIdb:tgkJbbbb9FEgwaecefgefadaialavaoarz:ejjjbak:larIdb9FTmdabawaD7aefgecitfgwydlgDciGgqci9hmbkkabaecitfgeclfhbdnavmbcuhwindnaiaeydbgDfRbbmbadaDcK2fgqIdwalIdw:tgkakNaqIdbalIdb:tgkakNaqIdlalIdl:tgkakNMM:rgkarIdb9DTmbarakUdbaoaDBdbkaecwfheawcefgwabydbcd46mbxdkkcuhwindnaiaeydbgDfRbbmbadaDcK2fgqIdbalIdb:t:lgkaqIdlalIdl:t:lgxakax9EEgkaqIdwalIdw:t:lgxakax9EEgkarIdb9DTmbarakUdbaoaDBdbkaecwfheawcefgwabydbcd46mbkkk;llevudnabydwgxaladcetfgm8Vebcs4alaecetfgP8Vebgscs4falaicetfgz8Vebcs4ffaD0abydxaq9pVakVgDce9hmbavawcltfgxab8Pdb83dbaxcwfabcwfgx8Pdb83dbdnaxydbgqTmbaoabydbcdtfhxaqhsinalaxydbcetfcFFi87ebaxclfhxascufgsmbkkdnabydxglci2gsabydlgxfgkciGTmbarakfcbalaxcu7fciGcefz:njjjb8Aabydxci2hsabydlhxabydwhqkab9cb83dwababydbaqfBdbabascifc98GaxfBdlaP8Vebhscbhxkdnascztcz91cu9kmbabaxcefBdwaPax87ebaoabydbcdtfaxcdtfaeBdbkdnam8Uebcu9kmbababydwgxcefBdwamax87ebaoabydbcdtfaxcdtfadBdbkdnaz8Uebcu9kmbababydwgxcefBdwazax87ebaoabydbcdtfaxcdtfaiBdbkarabydlfabydxci2faPRbb86bbarabydlfabydxci2fcefamRbb86bbarabydlfabydxci2fcdfazRbb86bbababydxcefBdxaDk8LbabaeadaialavaoarawaDaDaqJbbbbz:cjjjbk;Nkovud99euv99eul998Jjjjjbc:W;ae9Rgo8KjjjjbdndnadTmbavcd4hrcbhwcbhDindnaiaeclfydbar2cdtfgvIdbaiaeydbar2cdtfgqIdbgk:tgxaiaecwfydbar2cdtfgmIdlaqIdlgP:tgsNamIdbak:tgzavIdlaP:tgPN:tgkakNaPamIdwaqIdwgH:tgONasavIdwaH:tgHN:tgPaPNaHazNaOaxN:tgxaxNMM:rgsJbbbb9Bmbaoc:W:qefawcx2fgAakas:vUdwaAaxas:vUdlaAaPas:vUdbaoc8Wfawc8K2fgAaq8Pdb83dbaAav8Pdb83dxaAam8Pdb83dKaAcwfaqcwfydbBdbaAcCfavcwfydbBdbaAcafamcwfydbBdbawcefhwkaecxfheaDcifgDad6mbkab9cb83dbabcyf9cb83dbabcaf9cb83dbabcKf9cb83dbabczf9cb83dbabcwf9cb83dbawTmeaocbBd8Sao9cb83iKao9cb83izaoczfaoc8Wfawci2cxaoc8Sfcbcrz1jjjbaoIdKhCaoIdChXaoIdzhQao9cb83iwao9cb83ibaoaoc:W:qefawcxaoc8Sfcbciz1jjjbJbbjZhkaoIdwgPJbbbbJbbjZaPaPNaoIdbgPaPNaoIdlgsasNMM:rgx:vaxJbbbb9BEgzNhxasazNhsaPazNhzaoc:W:qefheawhvinaecwfIdbaxNaeIdbazNasaeclfIdbNMMgPakaPak9DEhkaecxfheavcufgvmbkabaCUdwabaXUdlabaQUdbabaoId3UdxdndnakJ;n;m;m899FmbJbbbbhPaoc:W:qefheaoc8WfhvinaCavcwfIdb:taecwfIdbgHNaQavIdb:taeIdbgONaXavclfIdb:taeclfIdbgLNMMaxaHNazaONasaLNMM:vgHaPaHaP9EEhPavc8KfhvaecxfheawcufgwmbkabaxUd8KabasUdaabazUd3abaCaxaPN:tUdKabaXasaPN:tUdCabaQazaPN:tUdzabJbbjZakakN:t:rgkUdydndnaxJbbj:;axJbbj:;9GEgPJbbjZaPJbbjZ9FEJbb;:9cNJbbbZJbbb:;axJbbbb9GEMgP:lJbbb9p9DTmbaP:Ohexekcjjjj94hekabae86b8UdndnasJbbj:;asJbbj:;9GEgPJbbjZaPJbbjZ9FEJbb;:9cNJbbbZJbbb:;asJbbbb9GEMgP:lJbbb9p9DTmbaP:Ohvxekcjjjj94hvkabav86bRdndnazJbbj:;azJbbj:;9GEgPJbbjZaPJbbjZ9FEJbb;:9cNJbbbZJbbb:;azJbbbb9GEMgP:lJbbb9p9DTmbaP:Ohqxekcjjjj94hqkabaq86b8SdndnaecKtcK91:YJbb;:9c:vax:t:lavcKtcK91:YJbb;:9c:vas:t:laqcKtcK91:YJbb;:9c:vaz:t:lakMMMJbb;:9cNJbbjZMgk:lJbbb9p9DTmbak:Ohexekcjjjj94hekaecFbaecFb9iEhexekabcjjj;8iBdycFbhekabae86b8Vxekab9cb83dbabcyf9cb83dbabcaf9cb83dbabcKf9cb83dbabczf9cb83dbabcwf9cb83dbkaoc:W;aef8Kjjjjbk;Iwwvul99iud99eue99eul998Jjjjjbcje9Rgr8Kjjjjbavcd4hwaicd4hDdndnaoTmbarc;abfcbaocdtgvz:njjjb8Aarc;Gbfcbavz:njjjb8AarhvarcafhiaohqinavcFFF97BdbaicFFF;7rBdbaiclfhiavclfhvaqcufgqmbkdnadTmbcbhkinaeakaD2cdtfgvIdwhxavIdlhmavIdbhPalakaw2cdtfIdbhsarc;abfhzarhiarc;GbfhHarcafhqcj1jjbhvaohOinasavcwfIdbaxNavIdbaPNavclfIdbamNMMgAMhCakhXdnaAas:tgAaqIdbgQ9DgLmbaHydbhXkaHaXBdbakhXdnaCaiIdbgK9EmbazydbhXaKhCkazaXBdbaiaCUdbaqaAaQaLEUdbavcxfhvaqclfhqaHclfhHaiclfhiazclfhzaOcufgOmbkakcefgkad9hmbkkadThkJbbbbhCcbhXarc;abfhvarc;Gbfhicbhqinalavydbgzaw2cdtfIdbalaiydbgHaw2cdtfIdbaeazaD2cdtfgzIdwaeaHaD2cdtfgHIdw:tgsasNazIdbaHIdb:tgsasNazIdlaHIdl:tgsasNMM:rMMgsaCasaC9EgzEhCaqaXazEhXaiclfhiavclfhvaoaqcefgq9hmbkaCJbbbZNhKxekadThkcbhXJbbbbhKkJbbbbhCdnaearc;abfaXcdtgifydbgqaD2cdtfgvIdwaearc;GbfaifydbgzaD2cdtfgiIdwgm:tgsasNavIdbaiIdbgY:tgAaANavIdlaiIdlgP:tgQaQNMM:rgxJbbbb9ETmbaxalaqaw2cdtfIdbMalazaw2cdtfIdb:taxaxM:vhCkasaCNamMhmaQaCNaPMhPaAaCNaYMhYdnakmbaDcdthvawcdthiindnalIdbg8AaecwfIdbam:tgCaCNaeIdbaY:tgsasNaeclfIdbaP:tgAaANMM:rgQMgEaK9ETmbJbbbbhxdnaQJbbbb9ETmbaEaK:taQaQM:vhxkaxaCNamMhmaxaANaPMhPaxasNaYMhYa8AaKaQMMJbbbZNhKkaeavfhealaifhladcufgdmbkkabaKUdxabamUdwabaPUdlabaYUdbarcjef8Kjjjjbkjeeiu8Jjjjjbcj8W9Rgr8Kjjjjbaici2hwdnaiTmbawceawce0EhDarhiinaiaeadRbbcdtfydbBdbadcefhdaiclfhiaDcufgDmbkkabarawaladaoz:hjjjbarcj8Wf8Kjjjjbk:3lequ8JjjjjbcjP9Rgl8Kjjjjbcbhvalcjxfcbaiz:njjjb8AdndnadTmbcjehoaehrincuhwarhDcuhqavhkdninawakaoalcjxfaDcefRbbfRbb9RcFeGci6aoalcjxfaDRbbfRbb9RcFeGci6faoalcjxfaDcdfRbbfRbb9RcFeGci6fgxaq9mgmEhwdnammbaxce0mdkaxaqaxaq9kEhqaDcifhDadakcefgk9hmbkkaeawci2fgDcdfRbbhqaDcefRbbhxaDRbbhkaeavci2fgDcifaDawav9Rci2z:qjjjb8Aakalcjxffaocefgo86bbaxalcjxffao86bbaDcdfaq86bbaDcefax86bbaDak86bbaqalcjxffao86bbarcifhravcefgvad9hmbkalcFeaicetz:njjjbhoadci2gDceaDce0EhqcbhxindnaoaeRbbgkcetfgw8UebgDcu9kmbawax87ebaocjlfaxcdtfabakcdtfydbBdbaxhDaxcefhxkaeaD86bbaecefheaqcufgqmbkaxcdthDxekcbhDkabalcjlfaDz:mjjjb8AalcjPf8Kjjjjbk9teiucbcbyd;C1jjbgeabcifc98GfgbBd;C1jjbdndnabZbcztgd9nmbcuhiabad9RcFFifcz4nbcuSmekaehikaik;teeeudndnaeabVciGTmbabhixekdndnadcz9pmbabhixekabhiinaiaeydbBdbaiaeydlBdlaiaeydwBdwaiaeydxBdxaeczfheaiczfhiadc9Wfgdcs0mbkkadcl6mbinaiaeydbBdbaeclfheaiclfhiadc98fgdci0mbkkdnadTmbinaiaeRbb86bbaicefhiaecefheadcufgdmbkkabk:3eedudndnabciGTmbabhixekaecFeGc:b:c:ew2hldndnadcz9pmbabhixekabhiinaialBdxaialBdwaialBdlaialBdbaiczfhiadc9Wfgdcs0mbkkadcl6mbinaialBdbaiclfhiadc98fgdci0mbkkdnadTmbinaiae86bbaicefhiadcufgdmbkkabk9teiucbcbyd;C1jjbgeabcrfc94GfgbBd;C1jjbdndnabZbcztgd9nmbcuhiabad9RcFFifcz4nbcuSmekaehikaik9:eiuZbhedndncbyd;C1jjbgdaecztgi9nmbcuheadai9RcFFifcz4nbcuSmekadhekcbabae9Rcifc98Gcbyd;C1jjbfgdBd;C1jjbdnadZbcztge9nmbadae9RcFFifcz4nb8Akk:;Deludndndnadch9pmbabaeSmdaeabadfgi9Rcbadcet9R0mekabaead;8qbbxekaeab7ciGhldndndnabae9pmbdnalTmbadhvabhixikdnabciGmbadhvabhixdkadTmiabaeRbb86bbadcufhvdnabcefgiciGmbaecefhexdkavTmiabaeRbe86beadc9:fhvdnabcdfgiciGmbaecdfhexdkavTmiabaeRbd86bdadc99fhvdnabcifgiciGmbaecifhexdkavTmiabaeRbi86biabclfhiaeclfheadc98fhvxekdnalmbdnaiciGTmbadTmlabadcufgifglaeaifRbb86bbdnalciGmbaihdxekaiTmlabadc9:fgifglaeaifRbb86bbdnalciGmbaihdxekaiTmlabadc99fgifglaeaifRbb86bbdnalciGmbaihdxekaiTmlabadc98fgdfaeadfRbb86bbkadcl6mbdnadc98fgocd4cefciGgiTmbaec98fhlabc98fhvinavadfaladfydbBdbadc98fhdaicufgimbkkaocx6mbaec9Wfhvabc9WfhoinaoadfgicxfavadfglcxfydbBdbaicwfalcwfydbBdbaiclfalclfydbBdbaialydbBdbadc9Wfgdci0mbkkadTmdadhidnadciGglTmbaecufhvabcufhoadhiinaoaifavaifRbb86bbaicufhialcufglmbkkadcl6mdaec98fhlabc98fhvinavaifgecifalaifgdcifRbb86bbaecdfadcdfRbb86bbaecefadcefRbb86bbaeadRbb86bbaic98fgimbxikkavcl6mbdnavc98fglcd4cefcrGgdTmbavadcdt9RhvinaiaeydbBdbaeclfheaiclfhiadcufgdmbkkalc36mbinaiaeydbBdbaiaeydlBdlaiaeydwBdwaiaeydxBdxaiaeydzBdzaiaeydCBdCaiaeydKBdKaiaeyd3Bd3aecafheaicafhiavc9Gfgvci0mbkkavTmbdndnavcrGgdmbavhlxekavc94GhlinaiaeRbb86bbaicefhiaecefheadcufgdmbkkavcw6mbinaiaeRbb86bbaiaeRbe86beaiaeRbd86bdaiaeRbi86biaiaeRbl86blaiaeRbv86bvaiaeRbo86boaiaeRbr86braicwfhiaecwfhealc94fglmbkkabkk9Tdbcjwk9ubbjZbbbbbbbbbbbbbbjZbbbbbbbbbbbbbbjZ86;nAZ86;nAZ86;nAZ86;nA:;86;nAZ86;nAZ86;nAZ86;nA:;86;nAZ86;nAZ86;nAZ86;nA:;bc;uwkxebbbdbbb9GNbb",e=new Uint8Array([32,0,65,2,1,106,34,33,3,128,11,4,13,64,6,253,10,7,15,116,127,5,8,12,40,16,19,54,20,9,27,255,113,17,42,67,24,23,146,148,18,14,22,45,70,69,56,114,101,21,25,63,75,136,108,28,118,29,73,115]);if(typeof WebAssembly!="object")return{supported:!1};var a,r=WebAssembly.instantiate(s(t),{}).then(function(h){a=h.instance,a.exports.__wasm_call_ctors()});function s(h){for(var d=new Uint8Array(h.length),m=0;m<h.length;++m){var b=h.charCodeAt(m);d[m]=b>96?b-97:b>64?b-39:b+4}for(var y=0,m=0;m<h.length;++m)d[y++]=d[m]<60?e[d[m]]:(d[m]-60)*64+d[++m];return d.buffer.slice(0,y)}function n(h){if(!h)throw new Error("Assertion failed")}function i(h){return new Uint8Array(h.buffer,h.byteOffset,h.byteLength)}var o=48,c=16;function l(h,d){var m=h.meshlets[d*4+0],b=h.meshlets[d*4+1],y=h.meshlets[d*4+2],x=h.meshlets[d*4+3];return{vertices:h.vertices.subarray(m,m+y),triangles:h.triangles.subarray(b,b+x*3)}}function f(h,d,m,b,y,x,v){var M=a.exports.sbrk,S=a.exports.meshopt_buildMeshletsBound(h.length,y,x),A=M(S*c),_=M(S*y*4),N=M(S*x*3),I=M(h.byteLength),C=M(d.byteLength),B=new Uint8Array(a.exports.memory.buffer);B.set(i(h),I),B.set(i(d),C);var R=a.exports.meshopt_buildMeshlets(A,_,N,I,h.length,C,m,b,y,x,v);B=new Uint8Array(a.exports.memory.buffer);for(var j=B.subarray(A,A+R*c),q=new Uint32Array(j.buffer,j.byteOffset,j.byteLength/4).slice(),$=0;$<R;++$){var Z=q[$*4+0],me=q[$*4+1],m=q[$*4+2],se=q[$*4+3];a.exports.meshopt_optimizeMeshlet(_+Z*4,N+me,se,m)}var ge=q[(R-1)*4+0],Se=q[(R-1)*4+1],be=q[(R-1)*4+2],Te=q[(R-1)*4+3],ye=ge+be,Ce=Se+(Te*3+3&-4),Ae={meshlets:q,vertices:new Uint32Array(B.buffer,_,ye).slice(),triangles:new Uint8Array(B.buffer,N,Ce*3).slice(),meshletCount:R};return M(A-M(0)),Ae}function u(h){var d=new Float32Array(a.exports.memory.buffer,h,o/4);return{centerX:d[0],centerY:d[1],centerZ:d[2],radius:d[3],coneApexX:d[4],coneApexY:d[5],coneApexZ:d[6],coneAxisX:d[7],coneAxisY:d[8],coneAxisZ:d[9],coneCutoff:d[10]}}function g(h,d,m,b){var y=a.exports.sbrk,x=[],v=y(d.byteLength),M=y(h.vertices.byteLength),S=y(h.triangles.byteLength),A=y(o),_=new Uint8Array(a.exports.memory.buffer);_.set(i(d),v),_.set(i(h.vertices),M),_.set(i(h.triangles),S);for(var N=0;N<h.meshletCount;++N){var I=h.meshlets[N*4+0],C=h.meshlets[N*4+0+1],B=h.meshlets[N*4+0+3];a.exports.meshopt_computeMeshletBounds(A,M+I*4,S+C,B,v,m,b),x.push(u(A))}return y(v-y(0)),x}function p(h,d,m,b){var y=a.exports.sbrk,x=y(o),v=y(h.byteLength),M=y(d.byteLength),S=new Uint8Array(a.exports.memory.buffer);S.set(i(h),v),S.set(i(d),M),a.exports.meshopt_computeClusterBounds(x,v,h.length,M,m,b);var A=u(x);return y(x-y(0)),A}return{ready:r,supported:!0,buildMeshlets:function(h,d,m,b,y,x){n(h.length%3==0),n(d instanceof Float32Array),n(d.length%m==0),n(m>=3),n(b<=256||b>0),n(y<=512),n(y%4==0),x=x||0;var v=h.BYTES_PER_ELEMENT==4?h:new Uint32Array(h);return f(v,d,d.length/m,m*4,b,y,x)},computeClusterBounds:function(h,d,m){n(h.length%3==0),n(h.length/3<=512),n(d instanceof Float32Array),n(d.length%m==0),n(m>=3);var b=h.BYTES_PER_ELEMENT==4?h:new Uint32Array(h);return p(b,d,d.length/m,m*4)},computeMeshletBounds:function(h,d,m){return n(h.meshletCount!=0),n(d instanceof Float32Array),n(d.length%m==0),n(m>=3),g(h,d,d.length/m,m*4)},extractMeshlet:function(h,d){return n(d>=0&&d<h.meshletCount),l(h,d)}}})();var iy=new Kc().registerExtensions([Jn,Qn,Zn]).registerDependencies({"meshopt.decoder":ei});async function gl(t,e={}){await ei.ready;let a;if(e.fetchBytes)a=new Uint8Array(await e.fetchBytes(t));else{let u=await fetch(t,{cache:e.fetchCache||"no-store"});if(!u.ok)throw new Error(`Failed to load ${t}: ${u.status}`);a=new Uint8Array(await u.arrayBuffer())}let r=await iy.readBinary(a),s=e.componentFeatures||new Map,n=new Map,i=new Map,o=new Map,c=0;function l(u){if(o.has(u))return o.get(u);let g=u.getAttribute("POSITION"),p=u.getIndices()?.getArray();if(!g||!p)return o.set(u,null),null;let h=u.getAttribute("NORMAL"),d=u.getAttribute("_FEATURE_ID_0"),m=u.getAttribute("_FEATURE_ID_1"),b=g.getCount(),y=new Float32Array(b*3),x=new Float32Array(b*3),v=new Uint32Array(b),M=new Uint32Array(b),S=[];for(let C=0;C<b;C+=1)g.getElement(C,S),y.set(S.slice(0,3),C*3),h?(h.getElement(C,S),x.set(S.slice(0,3),C*3)):x.set([0,1,0],C*3),v[C]=Number(d?.getScalar(C)||0),M[C]=Number(m?.getScalar(C)||0);let A=ly(u.getMaterial(),e),_=[Va(y),Va(x),Va(v),Va(M),Va(p),b,p.length,JSON.stringify(A)].join(":"),N=i.get(_),I=N;return(!N||!dy(N.primitive,y,x,v,M,p))&&(I={primitive:{position:y,normal:x,netId:v,objectFeatureId:M,indices:Uint32Array.from(p),material:A,bounds:null},placements:[]},i.set(N?`${_}:${i.size}`:_,I)),o.set(u,I),I}function f(u,g=""){let p=s.has(u.getName());p&&n.set(u.getName(),(n.get(u.getName())||0)+1);let h=p?u.getName():g,d=u.getMesh();if(d){let m=oy(u.getWorldMatrix());m[11]+=Number(e.zOffset||0);let b=Number(s.get(h)?.featureId||e.defaultFeatureId||0),y=c++;for(let x of d.listPrimitives()){let v=l(x);if(!v)continue;let M=cy(v.primitive.position,m);v.placements.push({rows:m,featureId:b,designator:h,bounds:M,node:y});let S=v.primitive.bounds;v.primitive.bounds=S?[Math.min(S[0],M[0]),Math.min(S[1],M[1]),Math.min(S[2],M[2]),Math.max(S[3],M[3]),Math.max(S[4],M[4]),Math.max(S[5],M[5])]:[...M]}}for(let m of u.listChildren())f(m,h)}for(let u of r.getRoot().listScenes())for(let g of u.listChildren())f(g);return{byteLength:a.byteLength,models:[...i.values()],componentNodeCounts:n}}function oy(t){return[t[0],t[4],t[8],t[12],-t[2],-t[6],-t[10],-t[14],t[1],t[5],t[9],t[13]]}function cy(t,e){let a=[1/0,1/0,1/0,-1/0,-1/0,-1/0];for(let r=0;r<t.length;r+=3){let s=t[r],n=t[r+1],i=t[r+2];for(let o=0;o<3;o+=1){let c=o*4,l=e[c]*s+e[c+1]*n+e[c+2]*i+e[c+3];l<a[o]&&(a[o]=l),l>a[o+3]&&(a[o+3]=l)}}return a}function ly(t,e){return t?{name:t.getName(),baseColor:t.getBaseColorFactor(),metallic:t.getMetallicFactor(),roughness:t.getRoughnessFactor(),emissive:t.getEmissiveFactor()}:{baseColor:e.baseColor||[.55,.58,.64,1],metallic:.05,roughness:.72,emissive:[0,0,0]}}function Va(t){let e=t.BYTES_PER_ELEMENT===4?new Uint32Array(t.buffer,t.byteOffset,t.length):t,a=2166136261;for(let r=0;r<e.length;r+=1)a^=e[r],a=Math.imul(a,16777619)>>>0;return a.toString(36)}function dy(t,e,a,r,s,n){let i=(o,c)=>o.length===c.length&&o.every((l,f)=>l===c[f]);return i(t.position,e)&&i(t.normal,a)&&i(t.netId,r)&&i(t.objectFeatureId,s)&&i(t.indices,n)}var Vt=Object.freeze({mm:.5,deg:15}),ti=Object.freeze([[1,0,0],[0,1,0],[0,0,1]]);function ai(t=Vt){let e=Number(t?.mm)>0?Number(t.mm):Vt.mm,a=Number(t?.deg)>0?Number(t.deg):Vt.deg;return{mm:e,deg:a,fineMm:e/10,fineDeg:1}}function as(t,e=Vt){let a=ai(e);return{mm:Number(t?.mm)>0?Number(t.mm):a.mm,deg:Number(t?.deg)>0?Number(t.deg):a.deg}}function ml(t){return Math.round(t*1e9)/1e9+0}function qt(t){let e=Math.hypot(...t.rotation)||1,a=t.rotation.map(s=>s/e),r=[a[3],a[0],a[1],a[2]].find(s=>Math.abs(s)>1e-12)??1;return{translationMm:t.translationMm.map(ml),rotation:a.map(s=>ml(r<0?-s:s))}}function uy(t){let[e,a,r,s]=t.rotation,[n,i,o]=t.translationMm;return[1-2*(a*a+r*r),2*(e*a+r*s),2*(e*r-a*s),0,2*(e*a-r*s),1-2*(e*e+r*r),2*(a*r+e*s),0,2*(e*r+a*s),2*(a*r-e*s),1-2*(e*e+a*a),0,n,i,o,1]}function yl(t,e){let a=new Array(16);for(let r=0;r<4;r+=1)for(let s=0;s<4;s+=1)a[r*4+s]=t[s]*e[r*4]+t[4+s]*e[r*4+1]+t[8+s]*e[r*4+2]+t[12+s]*e[r*4+3];return a}function fy(t){let e=[t[0],t[4],t[8],0,t[1],t[5],t[9],0,t[2],t[6],t[10],0,0,0,0,1];for(let a=0;a<3;a+=1)e[12+a]=-(e[a]*t[12]+e[4+a]*t[13]+e[8+a]*t[14]);return e}function ri(t,e){return e>0?Math.round(t/e)*e:t}function xl(t,e){let a=e[0]**2+e[1]**2;return a<1e-9?0:(t[0]*e[0]+t[1]*e[1])/a}function wl(t,e,a){let r=Math.atan2(e[1]-t[1],e[0]-t[0]),n=Math.atan2(a[1]-t[1],a[0]-t[0])-r;for(;n>Math.PI;)n-=2*Math.PI;for(;n<-Math.PI;)n+=2*Math.PI;return n}function vl(t,e,a){return pa(t,e)>=0?-a:a}function kl(t){return ti.map(e=>Cn(t.rotation,e))}function El(t,e,a){return{translationMm:t.translationMm.map((r,s)=>r+e[s]*a),rotation:[...t.rotation]}}function Ml(t,e,a,r){let s=ec(e,a),n=t.translationMm.map((o,c)=>o-r[c]);return{translationMm:Cn(s,n).map((o,c)=>o+r[c]),rotation:Or(s,t.rotation)}}function Sl(t,e){if(e==null)return null;let a=t?.occurrences||[];if(!a.some(s=>s.depth!=null))return a.find(s=>s.path===String(e))??null;let r=`/${String(e).split("/")[1]||""}`;return a.find(s=>s.path===r&&s.depth===1)??null}function Tl(t,e,a){let r=t.occurrences.find(o=>o.path===e);if(!r||r.depth!=null&&r.depth!==1)return t;let s=uy(a),n=yl(s,fy(r.worldMatrix)),i=`${e}/`;return{...t,occurrences:t.occurrences.map(o=>o.path===e?{...o,pose:{...qt(a),source:"manual"},worldMatrix:s}:o.path.startsWith(i)?{...o,worldMatrix:yl(n,o.worldMatrix)}:o)}}function Al(t){let e=Math.abs(t[0])<.9?[1,0,0]:[0,1,0];return it(pt(t,e))}var hy=Object.freeze([0,1,1,0]),qa=`
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
`,et=Object.freeze([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);function by(t){let e=t?.matrix??t;if(!e||typeof e.length!="number"||e.length!==16)throw new TypeError("An occurrence matrix must have 16 numbers (column-major)");let a=Array.from(e,Number);if(!a.every(Number.isFinite))throw new TypeError("An occurrence matrix must be finite");if(a[3]!==0||a[7]!==0||a[11]!==0||a[15]!==1)throw new TypeError("An occurrence matrix must be affine (last row 0 0 0 1)");return a}function py(t){let[e,a,r,,s,n,i,,o,c,l]=t,f=n*l-c*i,u=c*r-a*l,g=a*i-n*r,p=o*i-s*l,h=e*l-o*r,d=s*r-e*i,m=s*c-o*n,b=o*a-e*c,y=e*n-s*a,x=e*f+s*u+o*g;if(x===0)throw new TypeError("An occurrence matrix must be invertible");let v=x<0?-1:1;return[v*f,v*p,v*m,0,v*u,v*h,v*b,0,v*g,v*d,v*y,0,0,0,0,1]}function gy(t){let e=new Uint32Array(4);for(let a of t||[]){let r=Number(a);!Number.isInteger(r)||r<0||r>=128||(e[r>>>5]|=1<<(r&31)>>>0)}return e}function rs(t,e=[],a=[]){let r=new Float32Array(Math.max(1,t.length)*40),s=new Uint32Array(r.buffer);return t.forEach((n,i)=>{let o=i*40;r.set(n,o),r.set(py(n),o+16),e[i]&&s.set(gy(e[i]),o+32),r.set(a[i]||hy,o+36)}),r}function si(t,e){let[a,r,s]=e;return[t[0]*a+t[4]*r+t[8]*s+t[12],t[1]*a+t[5]*r+t[9]*s+t[13],t[2]*a+t[6]*r+t[10]*s+t[14]]}function xa(t,e){if(!e)return null;let a=[1/0,1/0,1/0,-1/0,-1/0,-1/0];for(let r=0;r<8;r+=1){let s=si(t,[e[r&1?3:0],e[r&2?4:1],e[r&4?5:2]]);for(let n=0;n<3;n+=1)a[n]=Math.min(a[n],s[n]),a[n+3]=Math.max(a[n+3],s[n])}return a}function ni(t){return t.every((e,a)=>e===et[a])}var my=0,yy=4294901759;function _l(t,e){let a=t>>>0,r=e>>>0;return a===my?{kind:"none",occurrenceIndex:-1,featureId:0}:{kind:r?"feature":"board",occurrenceIndex:a-1,featureId:r}}function Il(t){let e=Array.from(t);if(e.length>yy)throw new RangeError("Too many occurrences for the pick target");let a=e.map(by),r=o=>o&&!Array.isArray(o)&&!ArrayBuffer.isView(o),s=e.map((o,c)=>r(o)&&o.key!=null?String(o.key):String(c));if(new Set(s).size!==s.length)throw new TypeError("Occurrence keys must be unique");let n=e.map(o=>r(o)&&o.hiddenLayers?[...o.hiddenLayers].map(Number):[]),i=e.map(o=>r(o)&&o.explode?[...o.explode].map(Number):null);return{matrices:a,keys:s,hiddenLayers:n,explode:i}}function ss(t,e,a){let[r,s,n]=e,i=t[0]*r+t[4]*s+t[8]*n+t[12],o=t[1]*r+t[5]*s+t[9]*n+t[13],c=t[2]*r+t[6]*s+t[10]*n+t[14],l=t[3]*r+t[7]*s+t[11]*n+t[15];return!(l>0)||c<0||c>l?null:{x:a.x+(i/l*.5+.5)*a.width,y:a.y+(.5-o/l*.5)*a.height}}var Rl=0;var Nl=3,ii=4,HE=Object.freeze(["full","board","body","box"]),Ht=Object.freeze({fullPx:140,boardPx:70,boxPx:18,keep:.8});function ns(t={}){let e=(i,o)=>Number.isFinite(Number(t[i]))?Math.max(0,Number(t[i])):o,a=e("boxPx",Ht.boxPx),r=Math.max(a,e("boardPx",Ht.boardPx)),s=Math.max(r,e("fullPx",Ht.fullPx)),n=Math.min(1,Math.max(.05,e("keep",Ht.keep)));return{fullPx:s,boardPx:r,boxPx:a,keep:n}}function Cl(t){let e=c=>[t[c],t[4+c],t[8+c],t[12+c]],[a,r,s,n]=[e(0),e(1),e(2),e(3)],i=(c,l)=>c.map((f,u)=>f+l[u]),o=(c,l)=>c.map((f,u)=>f-l[u]);return[i(n,a),o(n,a),i(n,r),o(n,r),s,o(n,s)]}var Ha=class{constructor(e,a,r,s=16777216){this.device=e,this.usage=a|Bl.COPY_SRC|Bl.COPY_DST,this.label=r,this.chunkBytes=s,this.chunks=[],this.usedBytes=0,this.generation=0,this.repacks=0}alloc(e){let r={buffer:null,offset:0,size:Math.max(4,Math.ceil(e/4)*4),chunk:null};return this.place(r,null),r}place(e,a){let{size:r}=e,s=null;if(r<=this.chunkBytes/2)for(let o of this.chunks)o===a||o.dedicated||o.free.forEach((c,l)=>{c.size>=r&&(!s||c.size<s.range.size)&&(s={chunk:o,index:l,range:c})});let n,i;if(s)({chunk:n}=s),i=s.range.offset,s.range.size===r?n.free.splice(s.index,1):n.free[s.index]={offset:i+r,size:s.range.size-r};else{let o=r>this.chunkBytes/2,c=o?r:this.chunkBytes;n={buffer:this.device.createBuffer({label:`${this.label}-${this.chunks.length}`,size:c,usage:this.usage}),size:c,free:c>r?[{offset:r,size:c-r}]:[],used:0,live:new Set,dedicated:o},this.chunks.push(n),i=0}n.used+=r,n.live.add(e),this.usedBytes+=r,Object.assign(e,{buffer:n.buffer,offset:i,chunk:n})}write(e,a){this.device.queue.writeBuffer(e.buffer,e.offset,a)}free(e){let{chunk:a}=e;if(!(!a||!a.live.has(e))){if(this.release(a,e),e.chunk=null,!a.live.size){this.drop(a);return}!a.dedicated&&a.used<a.size*.5&&this.chunks.length>1&&this.repack(a)}}release(e,a){e.used-=a.size,e.live.delete(a),this.usedBytes-=a.size;let r=e.free,s=r.findIndex(n=>n.offset>a.offset);s<0&&(s=r.length),r.splice(s,0,{offset:a.offset,size:a.size}),s+1<r.length&&r[s].offset+r[s].size===r[s+1].offset&&(r[s].size+=r[s+1].size,r.splice(s+1,1)),s>0&&r[s-1].offset+r[s-1].size===r[s].offset&&(r[s-1].size+=r[s].size,r.splice(s,1))}drop(e){e.buffer.destroy?.(),this.chunks.splice(this.chunks.indexOf(e),1)}repack(e){let a=this.device.createCommandEncoder({label:`${this.label}-repack`});for(let r of[...e.live]){let s={buffer:r.buffer,offset:r.offset};this.release(e,r),this.place(r,e),a.copyBufferToBuffer(s.buffer,s.offset,r.buffer,r.offset,r.size)}this.device.queue.submit([a.finish()]),this.drop(e),this.generation+=1,this.repacks+=1}reservedBytes(){return this.chunks.reduce((e,a)=>e+a.size,0)}destroy(){for(let e of this.chunks)e.buffer.destroy?.();this.chunks=[],this.usedBytes=0}},Bl=globalThis.GPUBufferUsage||{COPY_SRC:4,COPY_DST:8};var oi=Object.freeze(["decl","vs-out","vs-end","fs-begin","fs-return"]),xy={decl:"decl","vs-out":"vsOut","vs-end":"vsEnd","fs-begin":"fsBegin"},wy=/^[ \t]*\/\/ @feature:[a-z-]+\n/gm;function le(t){if(!oi.includes(t))throw new Error(`Unknown shader hook ${t}`);return`// @feature:${t}
`}function Ie(t){return t.replace(wy,"")}function ci(t){return Wa(t).map(e=>e.name).join("+")}function Wa(t=[]){let e=new Set;for(let a of t){if(!a?.name||!/^[a-z][a-z0-9-]*$/.test(a.name))throw new Error(`Bad shader feature name ${a?.name}`);if(e.has(a.name))throw new Error(`Shader feature ${a.name} given twice`);e.add(a.name)}return[...t].sort((a,r)=>a.name<r.name?-1:a.name>r.name?1:0)}function vy(t,e="shader"){for(let a of oi){let r=li(t,a).length;if(r!==1)throw new Error(`${e}: hook ${a} appears ${r} times, expected once`)}Fl(t,e)}function Ol(t,e=[],a={}){let r=Wa(e);if(!r.length)return Ie(t);let s=`${a.family||"shader"}${a.instanced?" (instanced)":""}`;vy(t,s);let n=t;for(let i of oi){if(i==="fs-return"){let{start:u,end:g,indent:p,expression:h}=Fl(n,s),d=r.reduce((m,b)=>b.fsReturn?b.fsReturn(m,a):m,h);n=`${n.slice(0,u)}${p}return ${d};
${n.slice(g)}`;continue}let o=xy[i],c=r.map(u=>u[o]?.(a)).filter(Boolean),[l]=li(n,i),f=c.map(u=>u.endsWith(`
`)?u:`${u}
`).join("");n=`${n.slice(0,l.index)}${f}${n.slice(l.index+l[0].length)}`}return Ie(n)}function li(t,e){return[...t.matchAll(new RegExp(`^[ \\t]*// @feature:${e}\\n`,"gm"))]}function Fl(t,e){let[a]=li(t,"fs-return"),r=a.index+a[0].length,s=t.slice(r).match(/^([ \t]*)return (.+);\n/);if(!s)throw new Error(`${e}: hook fs-return is not followed by a return line`);return{start:a.index,end:r+s[0].length,indent:s[1],expression:s[2]}}var di=`
fn featureHidden(id: u32) -> bool {
  return id < arrayLength(&hiddenMask) && hiddenMask[id] == 0u;
}
`;function is(t){let e=new Set;if(t==null)return e;for(let a of t){let r=Number(a);!Number.isInteger(r)||r<=0||r>4294967295||e.add(r)}return e}function Pl(t,e=0){let a=0;for(let n of is(t))a=Math.max(a,n);let r=64,s=a+1;for(;r<s;)r*=2;return Math.max(r,Math.floor(e)||0)}function jl(t,e){let a=Math.max(64,Math.floor(e)||0),r=new Uint32Array(a);r.fill(1);for(let s of is(t))s<a&&(r[s]=0);return r}function ky(t){let e=Number(t.drillWidthMm)||0,a=Number(t.drillHeightMm)||e,r=Math.min(e,a),s=Math.min(Number(t.outerWidthMm)||0,Number(t.outerHeightMm)||0),n=Number.isFinite(t.platingThicknessMm)?t.platingThicknessMm:Math.max(0,(s-r)/2),i=(Number(t.rotationDeg)||0)*Math.PI/180+(a>e?Math.PI/2:0);return{x:t.centerMm[0]/1e3,y:-t.centerMm[1]/1e3,drillRadius:r/2e3,outerRadius:(r/2+n)/1e3,halfLength:Math.abs(e-a)/2e3,angle:Math.abs(e-a)>0?-i:0,startZ:t.startZMm/1e3,endZ:t.endZMm/1e3,netId:t.netId||0,objectId:t.objectFeatureId||0,startLayerId:t.startLayerId||0,endLayerId:t.endLayerId||0}}function hi(t,e){let a=new Map((e||[]).map(r=>[Number(r.id),Number(r.thickness_mm)||0]));return(t||[]).map(r=>{let s=i=>Math.max(0,(a.get(Number(i))||0)/2-.001),n=r.startZMm>=r.endZMm?1:-1;return{...r,startZMm:r.startZMm+n*s(r.startLayerId),endZMm:r.endZMm-n*s(r.endLayerId)}})}var Xa=0,ui=16,fi=24,$a=32,Ll=48,Dl=Object.freeze({arrayStride:Ll,stepMode:"instance",attributes:Object.freeze([Object.freeze({shaderLocation:3,offset:Xa,format:"float32x4"}),Object.freeze({shaderLocation:4,offset:ui,format:"float32x2"}),Object.freeze({shaderLocation:6,offset:fi,format:"float32x2"}),Object.freeze({shaderLocation:5,offset:$a,format:"uint32x4"})])}),bi=48,os=`struct Input {
  @location(0) unit: vec3f,
  @location(1) normal: vec3f,
  @location(2) radiusMix: f32,
  @location(3) dimensions: vec4f,
  @location(4) span: vec2f,
  @location(5) ids: vec4u,
  @location(6) shape: vec2f,
};`,Ul=`struct Barrel {
  dimensions: vec4f,
  span: vec2f,
  shape: vec2f,
  ids: vec4u,
};
@group(0) @binding(6) var<storage, read> barrels: array<Barrel>;`;function zl(t,e,a){let r=new ArrayBuffer(Math.max(a,t.length)*e),s=new DataView(r);return t.forEach((n,i)=>{let o=i*e,c=ky(n);s.setFloat32(o+Xa,c.x,!0),s.setFloat32(o+Xa+4,c.y,!0),s.setFloat32(o+Xa+8,c.drillRadius,!0),s.setFloat32(o+Xa+12,c.outerRadius,!0),s.setFloat32(o+ui,c.startZ,!0),s.setFloat32(o+ui+4,c.endZ,!0),s.setFloat32(o+fi,c.halfLength,!0),s.setFloat32(o+fi+4,c.angle,!0),s.setUint32(o+$a,c.netId,!0),s.setUint32(o+$a+4,c.objectId,!0),s.setUint32(o+$a+8,c.startLayerId,!0),s.setUint32(o+$a+12,c.endLayerId,!0)}),r}function Gl(t){return zl(t,Ll,0)}function Kl(t){return zl(t,bi,1)}var pi=t=>`
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
`,Vl=`
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
  // The 2D view: where the slice's layer lies in the layer grid (world
  // metres, added to x and y); zero in 3D.
  flatShift: vec2f,
  flatPad: vec2f,
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
  // The mask comes dilated by that texel (dilateClip): one lookup.
  return !(all(cell >= vec2i(0)) && all(cell < size) && textureLoad(boardClip, cell, 0).x != 0u);
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
  return globals.viewProjection * vec4f(board.x * 0.001 + slice.flatShift.x, -board.y * 0.001 + slice.flatShift.y, slice.z, 1.0);
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

${pi(10)}
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
`,Ey={compare:"always",passOp:"keep"},cs=Object.freeze({shapeMask:{face:{compare:"always",passOp:"replace"},read:255,write:128,reference:128,color:!1,depth:!1},fan:{face:{compare:"always",passOp:"invert"},read:255,write:64,reference:0,color:!1,depth:!1},coverSubtract:{face:{compare:"not-equal",passOp:"replace",failOp:"keep"},read:64,write:192,reference:128,color:!1,depth:!1},shapeAdd:{face:{compare:"greater",passOp:"replace"},read:160,write:33,reference:32,color:!0,depth:!0},coverMark:{face:{compare:"equal",passOp:"replace",failOp:"keep"},read:192,write:1,reference:65,color:!1,depth:!1,depthTest:!0},coverAdd:{face:{compare:"equal",passOp:"invert",failOp:"keep",depthFailOp:"keep"},read:224,write:96,reference:64,color:!0,depth:!0},coverClear:{face:{compare:"always",passOp:"zero"},read:255,write:64,reference:0,color:!1,depth:!1},shapeLay:{face:{compare:"greater",passOp:"replace"},read:160,write:32,reference:32,color:!1,depth:!1,depthTest:!0},coverLay:{face:{compare:"equal",passOp:"invert",failOp:"keep",depthFailOp:"keep"},read:224,write:96,reference:64,color:!1,depth:!1,depthTest:!0},shapeBlend:{face:{compare:"greater",passOp:"replace"},read:160,write:32,reference:32,color:!0,depth:!0},coverBlend:{face:{compare:"equal",passOp:"invert",failOp:"keep",depthFailOp:"keep"},read:224,write:96,reference:64,color:!0,depth:!0},tintCovered:{face:{compare:"equal",passOp:"keep"},read:33,write:0,reference:33,color:!0,depth:!0},tintPlain:{face:{compare:"equal",passOp:"keep"},read:33,write:0,reference:32,color:!0,depth:!0},footShape:{face:{compare:"always",passOp:"replace"},read:0,write:2,reference:2,color:!1,depth:!1},footCover:{face:{compare:"equal",passOp:"replace",failOp:"keep"},read:64,write:2,reference:66,color:!1,depth:!1},tintHigh:{face:{compare:"equal",passOp:"replace"},read:34,write:4,reference:38,color:!0,depth:!0},tintLow:{face:{compare:"equal",passOp:"replace"},read:34,write:4,reference:36,color:!0,depth:!0},clearLay:{face:{compare:"always",passOp:"zero"},read:0,write:224,reference:0,color:!1,depth:!1},shapeOnFoot:{face:{compare:"equal",passOp:"invert"},read:166,write:32,reference:6,color:!0,depth:!0},shapeOffFoot:{face:{compare:"equal",passOp:"invert"},read:166,write:32,reference:4,color:!0,depth:!0},coverOnFoot:{face:{compare:"equal",passOp:"invert",failOp:"keep",depthFailOp:"keep"},read:230,write:96,reference:70,color:!0,depth:!0},coverOffFoot:{face:{compare:"equal",passOp:"invert",failOp:"keep",depthFailOp:"keep"},read:230,write:96,reference:68,color:!0,depth:!0},clearFoot:{face:{compare:"always",passOp:"zero"},read:0,write:6,reference:0,color:!1,depth:!1},coat:{face:{compare:"equal",passOp:"keep",failOp:"keep",depthFailOp:"keep"},read:2,write:0,reference:0,color:!0,depth:!0},solid:{face:Ey,read:0,write:0,reference:0,color:!0,depth:!0},clear:{face:{compare:"always",passOp:"zero"},read:255,write:224,reference:0,color:!1,depth:!1}});var ql=64,gi=112,Hl=48,My=.51,Wl=6,Xl=`
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
${pi(7)}
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
  return vec4f(view.color.rgb * shade, ${My});
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
`,$l=`
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
`;var Yl=`
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
${pi(3)}

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
`;var vi=Object.freeze([.35,-.5,.8,0]);function _y(t){let[e,a,r]=vi,s=[0,1,2].map(i=>t[i*4]*e+t[i*4+1]*a+t[i*4+2]*r),n=Math.hypot(...s)||1;return[...s.map(i=>i/n),0]}var ki=20,ct=256,mi=112,Wt="rg32uint",wa=ct/4,Iy=256,Jl={compare:"always",passOp:"zero"},Ry={compare:"always",passOp:"replace"},Ny={compare:"not-equal",passOp:"keep"},Cy={compare:"equal",passOp:"keep"},td="fn dequant(p: vec3f) -> vec3f { return draw.quantMin.xyz + p * draw.quantSize.xyz; }",ad=32,rd=`  let plating = input.dimensions.w - input.dimensions.z;
  let rim = select(1.0, ${(1/Math.cos(Math.PI/ad)).toFixed(6)}, input.radiusMix > 1.5);
  let radius = mix(max(input.dimensions.z - plating, input.dimensions.z * 0.5), input.dimensions.z, min(input.radiusMix, 1.0)) * rim;
  let turn = vec2f(cos(input.shape.y), sin(input.shape.y));
  let local = vec2f(input.unit.x * radius + select(-input.shape.x, input.shape.x, input.unit.x >= 0.0), input.unit.y * radius);
  let planar = vec2f(local.x * turn.x - local.y * turn.y, local.x * turn.y + local.y * turn.x);
  let turnedNormal = vec3f(input.normal.x * turn.x - input.normal.y * turn.y, input.normal.x * turn.y + input.normal.y * turn.x, input.normal.z);
`,ds=`
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
${td}
@group(0) @binding(3) var<storage, read> hiddenMask: array<u32>;
@group(0) @binding(4) var<storage, read> netMask: array<u32>;
${di}
${Ua}
// Set on the pipeline that draws the solder mask over copper.
override COVERED: bool = false;

${le("decl")}struct VertexInput {
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
${le("vs-out")}  @location(3) world: vec3f,
};
@vertex fn vs(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  output.world = dequant(input.position) + draw.offset.xyz;
  output.position = globals.viewProjection * vec4f(output.world, 1.0);
  output.normal = normalize(input.normal);
  output.netId = input.netId;
  output.objectId = input.objectId;
${le("vs-end")}  return output;
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
${le("fs-begin")}  let kind = u32(draw.flags.x);
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
${le("fs-return")}  return vec4f(aces(lit), alpha);
}
`,By=Ie(ds),us=`
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
${td}
@group(0) @binding(3) var<storage, read> hiddenMask: array<u32>;
@group(0) @binding(4) var<storage, read> netMask: array<u32>;
${di}
${Ua}
${le("decl")}struct Input {
  @location(0) position: vec3f,
  @location(1) normal: vec3f,
  @location(2) netId: u32,
  @location(3) objectId: u32,
};
struct Output {
  @builtin(position) position: vec4f,
  @location(2) @interpolate(flat) netId: u32,
${le("vs-out")}  @location(0) @interpolate(flat) objectId: u32,
};
@vertex fn vs(input: Input) -> Output {
  var output: Output;
  output.position = globals.viewProjection * vec4f(dequant(input.position) + draw.offset.xyz, 1.0);
  output.objectId = input.objectId;
  output.netId = input.netId;
${le("vs-end")}  return output;
}
@fragment fn fs(input: Output) -> @location(0) vec2u {
${le("fs-begin")}  if (u32(draw.flags.x) == 2u && featureHidden(input.objectId)) { discard; }
  // Isolated (flags.z), unlit copper is not drawn, so it is not there to pick (SB2-31e).
  let lit = netEmphasized(input.netId) || (globals.activeNet != 0u && input.netId == globals.activeNet);
  if (u32(draw.flags.x) == 1u && draw.flags.z > 0.5 && !lit) { discard; }
${le("fs-return")}  return vec2u(1u, input.objectId);
}
`,Oy=Ie(us),Mi=`
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
${Ua}
${le("decl")}${os}
struct Output {
  @builtin(position) position: vec4f,
  @location(0) normal: vec3f,
  @location(1) @interpolate(flat) netId: u32,
  @location(2) @interpolate(flat) objectId: u32,
${le("vs-out")}  @location(3) @interpolate(flat) visible: u32,
};
@vertex fn vs(input: Input) -> Output {
${rd}  let z0 = input.span.x + layerOffsets[input.ids.z];
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
${le("vs-end")}  return output;
}
@fragment fn fs(input: Output) -> @location(0) vec4f {
${le("fs-begin")}  if (input.visible == 0u) { discard; }
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
${le("fs-return")}  return vec4f(lit, 1.0);
}
`,Fy=Ie(Mi),Si=`
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
${Ua}
${le("decl")}${os}
struct Output {
  @builtin(position) position: vec4f,
  @location(3) @interpolate(flat) netId: u32,
  @location(0) @interpolate(flat) objectId: u32,
${le("vs-out")}  @location(1) @interpolate(flat) visible: u32,
};
@vertex fn vs(input: Input) -> Output {
${rd}  let world = vec3f(
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
${le("vs-end")}  return output;
}
@fragment fn fs(input: Output) -> @location(0) vec2u {
${le("fs-begin")}  if (input.visible == 0u) { discard; }
  let lit = netEmphasized(input.netId) || (globals.activeNet != 0u && input.netId == globals.activeNet);
  if (draw.flags.z > 0.5 && !lit) { discard; }
${le("fs-return")}  return vec2u(1u, input.objectId);
}
`,Py=Ie(Si);function aa(t,e){return e.reduce((a,[r,s])=>{if(a.split(r).length!==2)throw new Error(`Shader variant anchor not found once: ${r.slice(0,60)}`);return a.replace(r,()=>s)},t)}var Ti=[`  padding0: u32,
  padding1: u32,`,`  selectedOccurrence: u32,
  occurrenceBase: u32,`],fs=[["  padding2: u32,","  emphasisStride: u32,"],["fn netEmphasized(id: u32) -> bool {",`${lc}fn netEmphasized(id: u32) -> bool {`]],sd="  let lit = netEmphasized(input.netId) || (globals.activeNet != 0u && input.netId == globals.activeNet);",nd=`  let lit = emphasisOf(input.occurrence, input.netId) != 0u
    || (input.occurrence == globals.selectedOccurrence && globals.activeNet != 0u && input.netId == globals.activeNet);`,Ai=aa(ds,[Ti,[`  @location(3) world: vec3f,
};`,`  @location(3) world: vec3f,
  @location(4) @interpolate(flat) occurrence: u32,
  // Mask and silkscreen opacity of this occurrence's own stackup separation (SB2-31f).
  @location(5) @interpolate(flat) fade: f32,
};`],[`@vertex fn vs(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  output.world = dequant(input.position) + draw.offset.xyz;
  output.position = globals.viewProjection * vec4f(output.world, 1.0);
  output.normal = normalize(input.normal);`,`${qa}
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
  let selectedComponent = here && component && globals.selectedFeature != 0u && input.objectId == globals.selectedFeature;`],...fs,["      base = vec3f(0.08, 1.0, 0.2) * pulse;","      base = emphasisColor(mark, vec3f(0.08, 1.0, 0.2)) * pulse;"],["  var alpha = draw.flags.y;","  var alpha = draw.flags.y * input.fade;"]]),id=Ie(Ai),_i=aa(us,[Ti,[`  @location(0) @interpolate(flat) objectId: u32,
};`,`  @location(0) @interpolate(flat) objectId: u32,
  @location(1) @interpolate(flat) occurrence: u32,
};`],[`@vertex fn vs(input: Input) -> Output {
  var output: Output;
  output.position = globals.viewProjection * vec4f(dequant(input.position) + draw.offset.xyz, 1.0);`,`${qa}
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
  }`],[`${le("fs-return")}  return vec2u(1u, input.objectId);`,`  let kind = u32(draw.flags.x);
${le("fs-return")}  return vec2u(input.occurrence, select(input.objectId, 0u, kind == 0u));`],...fs,[sd,nd]]),od=Ie(_i),jy=`struct Placement { r0: vec4f, r1: vec4f, r2: vec4f, ids: vec4u };
@group(0) @binding(8) var<storage, read> placements: array<Placement>;
fn place(p: Placement, v: vec3f) -> vec3f {
  return vec3f(dot(p.r0.xyz, v) + p.r0.w, dot(p.r1.xyz, v) + p.r1.w, dot(p.r2.xyz, v) + p.r2.w);
}
fn turn(p: Placement, n: vec3f) -> vec3f {
  return vec3f(dot(p.r0.xyz, n), dot(p.r1.xyz, n), dot(p.r2.xyz, n));
}`,Ql="@group(0) @binding(1) var<uniform> draw: Draw;",hs=[Ql,`${Ql}
${jy}`],bs=["  output.objectId = input.objectId;","  output.objectId = select(placement.ids.x, input.objectId, input.objectId != 0u);"],cd=["  let index = listedOccurrence(u32(draw.material.w + 0.5), instance);",`  let placement = placements[draw.placement.x + instance % draw.placement.y];
  let index = listedOccurrence(u32(draw.material.w + 0.5), instance / draw.placement.y);`],ld=aa(ds,[hs,[`@vertex fn vs(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  output.world = dequant(input.position) + draw.offset.xyz;`,`@vertex fn vs(input: VertexInput, @builtin(instance_index) instance: u32) -> VertexOutput {
  let placement = placements[draw.placement.x + instance];
  var output: VertexOutput;
  output.world = place(placement, dequant(input.position)) + draw.offset.xyz;`],["  output.normal = normalize(input.normal);","  output.normal = normalize(turn(placement, input.normal));"],bs]),dd=aa(Ai,[hs,cd,["occurrence.model * vec4f(dequant(input.position) + draw.offset.xyz + lift, 1.0)","occurrence.model * vec4f(place(placement, dequant(input.position)) + draw.offset.xyz + lift, 1.0)"],["(occurrence.normal * vec4f(input.normal, 0.0))","(occurrence.normal * vec4f(turn(placement, input.normal), 0.0))"],bs]),ud=aa(us,[hs,[`@vertex fn vs(input: Input) -> Output {
  var output: Output;
  output.position = globals.viewProjection * vec4f(dequant(input.position) + draw.offset.xyz, 1.0);`,`@vertex fn vs(input: Input, @builtin(instance_index) instance: u32) -> Output {
  let placement = placements[draw.placement.x + instance];
  var output: Output;
  output.position = globals.viewProjection * vec4f(place(placement, dequant(input.position)) + draw.offset.xyz, 1.0);`],bs]),fd=aa(_i,[hs,cd,["occurrence.model * vec4f(dequant(input.position) + draw.offset.xyz + lift, 1.0)","occurrence.model * vec4f(place(placement, dequant(input.position)) + draw.offset.xyz + lift, 1.0)"],bs]),hd=Ie(ld),bd=Ie(dd),pd=Ie(ud),gd=Ie(fd),yi=64,Ly=6,Dy=`${Ul}
${qa}
struct Input {
  @location(0) unit: vec3f,
  @location(1) normal: vec3f,
  @location(2) radiusMix: f32,
};`;function md(t,e,a=[]){return aa(t,[Ti,[`@group(0) @binding(2) var<storage, read> layerOffsets: array<f32>;
`,""],[os,Dy],["@vertex fn vs(input: Input) -> Output {",`struct Record {
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
  output.occurrence = index + 1u + globals.occurrenceBase;`],...a])}var yd=md(Mi,`  output.position = globals.viewProjection * vec4f(world, 1.0);
  output.normal = turnedNormal;`,[[`  let z0 = input.span.x + layerOffsets[input.ids.z];
  let z1 = input.span.y + layerOffsets[input.ids.w];`,`  let z0 = input.span.x + layerOffsets[input.ids.z] * spread;
  let z1 = input.span.y + layerOffsets[input.ids.w] * spread;`],[`  output.normal = turnedNormal;
  output.netId`,`  output.normal = (occurrence.normal * vec4f(turnedNormal, 0.0)).xyz;
  output.netId`],[`  @location(3) @interpolate(flat) visible: u32,
};`,`  @location(3) @interpolate(flat) visible: u32,
  @location(4) @interpolate(flat) occurrence: u32,
};`],["  let selected = netEmphasized(input.netId) || (globals.activeNet != 0u && input.netId == globals.activeNet);",`  let mark = emphasisOf(input.occurrence, input.netId);
  let selected = mark != 0u
    || (input.occurrence == globals.selectedOccurrence && globals.activeNet != 0u && input.netId == globals.activeNet);`],...fs,["      base = vec3f(0.1, 1.0, 0.22) * (","      base = emphasisColor(mark, vec3f(0.1, 1.0, 0.22)) * ("]]),xd=md(Si,`  output.position = globals.viewProjection * vec4f(world, 1.0);
  output.objectId`,[["mix(input.span.x + layerOffsets[input.ids.z], input.span.y + layerOffsets[input.ids.w], input.unit.z)","mix(input.span.x + layerOffsets[input.ids.z] * spread, input.span.y + layerOffsets[input.ids.w] * spread, input.unit.z)"],[`  @location(1) @interpolate(flat) visible: u32,
};`,`  @location(1) @interpolate(flat) visible: u32,
  @location(2) @interpolate(flat) occurrence: u32,
};`],["  return vec2u(1u, input.objectId);","  return vec2u(input.occurrence, input.objectId);"],...fs,[sd,nd]]),wd=Ie(yd),vd=Ie(xd),kd=`
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
${qa}
${le("decl")}struct Input {
  @location(0) corner: vec3f,
  @location(1) normal: vec3f,
};
struct Output {
  @builtin(position) position: vec4f,
  @location(0) normal: vec3f,
${le("vs-out")}  @location(1) @interpolate(flat) occurrence: u32,
};
@vertex fn vs(input: Input, @builtin(instance_index) instance: u32) -> Output {
  let index = listedOccurrence(LIST_BOX, instance);
  let occurrence = occurrences[index];
  let local = draw.offset.xyz + input.corner * draw.material.xyz;
  var output: Output;
  output.position = globals.viewProjection * vec4f((occurrence.model * vec4f(local, 1.0)).xyz, 1.0);
  output.normal = (occurrence.normal * vec4f(input.normal, 0.0)).xyz;
  output.occurrence = index + 1u + globals.occurrenceBase;
${le("vs-end")}  return output;
}
`,Ed=`${kd}
@fragment fn fs(input: Output) -> @location(0) vec4f {
${le("fs-begin")}  let light = normalize(globals.lightDirection.xyz);
${le("fs-return")}  return vec4f(draw.color.rgb * (0.45 + max(dot(normalize(input.normal), light), 0.0) * 0.55), 1.0);
}
`,Md=Ie(Ed),Sd=`${kd}
@fragment fn fs(input: Output) -> @location(0) vec2u {
${le("fs-begin")}${le("fs-return")}  return vec2u(input.occurrence, 0u);
}
`,Td=Ie(Sd),Ii=`
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
`,Zl=[{arrayStride:24,attributes:[{shaderLocation:0,offset:0,format:"float32x3"},{shaderLocation:1,offset:12,format:"float32x3"}]}],oM=Object.freeze({main:id,pick:od,barrel:wd,barrelPick:vd,box:Md,boxPick:Td,cull:Ii,component:hd,componentInstanced:bd,componentPick:pd,componentPickInstanced:gd}),Ad=Object.freeze({main:{output:"color",single:ds,instanced:Ai,world:["output.world","output.world"]},pick:{output:"pick",single:us,instanced:_i,world:["(dequant(input.position) + draw.offset.xyz)","world"]},barrel:{output:"color",single:Mi,instanced:yd,world:["world","(occurrence.model * vec4f(world, 1.0)).xyz"]},barrelPick:{output:"pick",single:Si,instanced:xd,world:["world","(occurrence.model * vec4f(world, 1.0)).xyz"]},component:{output:"color",single:ld,instanced:dd,world:["output.world","output.world"]},componentPick:{output:"pick",single:ud,instanced:fd,world:["(place(placement, dequant(input.position)) + draw.offset.xyz)","world"]},box:{output:"color",single:null,instanced:Ed,world:[null,"(occurrence.model * vec4f(local, 1.0)).xyz"]},boxPick:{output:"pick",single:null,instanced:Sd,world:[null,"(occurrence.model * vec4f(local, 1.0)).xyz"]}}),cM=Object.freeze(Object.keys(Ad));function xi(t,e,a=[]){let r=Ad[t],s=r?.[e?"instanced":"single"];if(!s)throw new Error(`No ${e?"instanced":"one-board"} ${t} shader`);return Ol(s,a,{family:t,instanced:e,output:r.output,world:r.world[e?1:0]})}var lM=Object.freeze({main:By,pick:Oy,barrel:Fy,barrelPick:Py,mainInstanced:id,pickInstanced:od,barrelInstanced:wd,barrelPickInstanced:vd,component:hd,componentInstanced:bd,componentPick:pd,componentPickInstanced:gd,box:Md,boxPick:Td,cull:Ii}),Uy=new Float32Array(256),Xt=class t{static async create(e,{sampleCount:a=4}={}){if(!navigator.gpu)throw new Error("WebGPU is unavailable in this browser");let r=await navigator.gpu.requestAdapter({powerPreference:"high-performance"});if(!r)throw new Error("No WebGPU adapter is available");let s=r.features.has("depth32float-stencil8"),n=await r.requestDevice(s?{requiredFeatures:["depth32float-stencil8"]}:void 0);return new t(e,n,{stencil:s,sampleCount:a})}constructor(e,a,{shareFrom:r=null,stencil:s=!1,sampleCount:n=1}={}){if(this.canvas=e,this.device=a,this.shareFrom=r,this.stencil=r?r.stencil:!!s,this.sampleCount=r?r.sampleCount:n===4?4:1,this.depthFormat=this.stencil?"depth32float-stencil8":"depth32float",this.version=0,this.barrelColor=[.55,.35,.16,.78],this.alwaysInstanced=!!r,this.occurrenceBase=0,r?(this.context=r.context,this.format=r.format):(a.addEventListener("uncapturederror",i=>{console.error(`Uncaptured WebGPU error: ${i.error?.message||i.error}`)}),a.lost.then(i=>{i.reason!=="destroyed"&&console.error(`WebGPU device lost: ${i.reason}`,i.message)}),this.context=e.getContext("webgpu"),this.format=navigator.gpu.getPreferredCanvasFormat(),this.context.configure({device:a,format:this.format,alphaMode:"opaque"})),this.entries=[],this.barrels=null,this.drawSlotCapacity=Iy,this.drawSlotBuffer=this.createDrawSlotBuffer(this.drawSlotCapacity),this.drawStaging=new Float32Array(this.drawSlotCapacity*wa),this.freeDrawSlots=[],this.nextDrawSlot=0,this.globalBuffer=a.createBuffer({size:mi,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),this.analyticGlobalBuffer=r?a.createBuffer({label:"analytic-globals",size:mi,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}):null,this.layerOffsetBuffer=a.createBuffer({size:1024,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),this.occurrenceMatrices=[[...et]],this.occurrenceKeys=["0"],this.occurrenceHiddenLayers=[[]],this.occurrenceExplode=[null],this.identityOnly=!0,this.occurrenceCapacity=1,this.occurrenceBuffer=this.createOccurrenceBuffer(this.occurrenceCapacity),this.device.queue.writeBuffer(this.occurrenceBuffer,0,rs(this.occurrenceMatrices)),this.barrelRecordBuffer=a.createBuffer({label:"barrel-records",size:bi,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),this.placementBuffer=a.createBuffer({label:"component-placements",size:yi,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),this.componentPipelineSets=new Map,this.instancedPipelines=null,this.shaderFeatures=[],this.shaderFeatureKey="",this.featurePipelineSets=new Map,this.pipelineSetKinds=new WeakMap,this.listBuffer=this.createListBuffer(this.occurrenceCapacity),this.slotCapacity=0,this.slotArgs=new Uint32Array(0),this.slotClasses=new Uint32Array(0),this.freeSlots=[],this.nextSlot=2,this.argsBuffer=null,this.classesBuffer=null,this.growSlots(256),this.setSlot(0,0,4),this.setSlot(1,0,4),this.cull=null,this.box=null,this.boardBounds=null,this.selectedOccurrence=-1,this.lodOverride=null,this.lodThresholds={...Ht},this.innerCopperAtFull=!0,this.innerCopperMode="all",this.cullCounts={full:0,board:0,body:0,box:0,culled:0},this.frameStats={triangles:0,draws:0},this.boxColor=[.24,.36,.28,1],r)for(let i of["bindGroupLayout","pipelineLayout","vertexBuffers","pipeline","pickPipeline","barrelPipeline","barrelPickPipeline","singlePipelines"])this[i]=r[i];else this.createSinglePipelines();this.depth=null,this.colorTarget=null,this.pickDepth=null,this.pickTexture=null,this.insetColor=null,this.pickSerial=Promise.resolve(),this.bundleCache=new Map,this.globalScratch=new ArrayBuffer(mi),this.globalScratchF32=new Float32Array(this.globalScratch),this.globalScratchView=new DataView(this.globalScratch),this.barrelDrawScratch=new Float32Array(ct/4),this.nextEntryId=1,this.hiddenFeatureIds=new Set,this.showPlaceholders=!0,this.hiddenBoardLayers=new Set,this.featureMaskCapacity=64,this.featureMaskBuffer=this.createFeatureMaskBuffer(this.featureMaskCapacity),this.uploadFeatureMask(),this.emphasizedNetIds=new Set,this.occurrenceEmphasis=null,this.emphasisStride=0,this.dimCopper=!1,this.netMaskCapacity=64,this.netMaskBuffer=this.createNetMaskBuffer(this.netMaskCapacity),this.uploadNetMask(),r&&this.setOccurrences([])}createSinglePipelines(){let e=this.device;this.bindGroupLayout=e.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}},{binding:1,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}},{binding:2,visibility:GPUShaderStage.VERTEX,buffer:{type:"read-only-storage"}},{binding:3,visibility:GPUShaderStage.FRAGMENT,buffer:{type:"read-only-storage"}},{binding:4,visibility:GPUShaderStage.FRAGMENT,buffer:{type:"read-only-storage"}},{binding:5,visibility:GPUShaderStage.VERTEX,buffer:{type:"read-only-storage"}},{binding:6,visibility:GPUShaderStage.VERTEX,buffer:{type:"read-only-storage"}},{binding:7,visibility:GPUShaderStage.VERTEX,buffer:{type:"read-only-storage"}},{binding:8,visibility:GPUShaderStage.VERTEX,buffer:{type:"read-only-storage"}}]});let a=e.createPipelineLayout({bindGroupLayouts:[this.bindGroupLayout]});this.pipelineLayout=a;let r=this.vertexBuffers=[{arrayStride:ki,attributes:[{shaderLocation:0,offset:0,format:"unorm16x4"},{shaderLocation:1,offset:8,format:"snorm8x4"},{shaderLocation:2,offset:12,format:"uint32"},{shaderLocation:3,offset:16,format:"uint32"}]}];this.singlePipelines=this.makePipelineSet(!1,[]),this.pipeline=this.singlePipelines.main,this.pickPipeline=this.singlePipelines.pick,this.barrelPipeline=this.singlePipelines.barrel,this.barrelPickPipeline=this.singlePipelines.barrelPick}makeMainPipelines(e,a){let r=this.pipelineLayout,s=this.vertexBuffers,n=(c,l)=>this.makePipeline(r,e,this.format,s,`${c}${a}`,l),i=n("main",{stencil:Jl}),o=n("main-blend");return{main:i,mark:this.stencil?n("main-mark",{stencil:Ry}):i,blend:o,translucent:n("main-translucent",{depthWrite:!1,cullMode:"back"}),mask:this.stencil?n("mask",{stencil:Ny}):o,maskCovered:this.stencil?n("mask-covered",{stencil:Cy,constants:{COVERED:1}}):null}}createOccurrenceBuffer(e){return this.device.createBuffer({label:"occurrences",size:e*160,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST})}createListBuffer(e){return this.device.createBuffer({label:"visible-occurrences",size:e*4*Uint32Array.BYTES_PER_ELEMENT,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST})}growSlots(e){let a=new Uint32Array(e*5);a.set(this.slotArgs);let r=new Uint32Array(e).fill(4);r.set(this.slotClasses),this.slotArgs=a,this.slotClasses=r,this.slotCapacity=e,this.argsBuffer?.destroy?.(),this.classesBuffer?.destroy?.(),this.argsBuffer=this.device.createBuffer({label:"indirect-args",size:a.byteLength,usage:GPUBufferUsage.INDIRECT|GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),this.classesBuffer=this.device.createBuffer({label:"draw-classes",size:r.byteLength,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),this.device.queue.writeBuffer(this.argsBuffer,0,a),this.device.queue.writeBuffer(this.classesBuffer,0,r),this.cull&&(this.cull.bindGroup=this.makeCullBindGroup()),this.bundleCache?.clear()}setSlot(e,a,r){this.slotArgs.fill(0,e*5,e*5+5),this.slotArgs[e*5]=a,this.slotClasses[e]=r,this.device.queue.writeBuffer(this.argsBuffer,e*20,this.slotArgs,e*5,5),this.device.queue.writeBuffer(this.classesBuffer,e*4,this.slotClasses,e,1)}allocSlot(e,a){let r=this.freeSlots.length?this.freeSlots.pop():this.nextSlot++;return r>=this.slotCapacity&&this.growSlots(this.slotCapacity*2),this.setSlot(r,e,a),r}get occurrenceCount(){return this.occurrenceMatrices.length}setOccurrences(e){let{matrices:a,keys:r,hiddenLayers:s,explode:n}=Il(e??[et]);this.occurrenceMatrices=a,this.occurrenceKeys=r,this.occurrenceHiddenLayers=s,this.occurrenceExplode=n,this.identityOnly=!this.alwaysInstanced&&a.length===1&&ni(a[0]),this.identityOnly||this.ensureInstancedPipelines(),a.length>this.occurrenceCapacity&&(this.occurrenceBuffer?.destroy?.(),this.listBuffer?.destroy?.(),this.occurrenceCapacity=Math.max(a.length,this.occurrenceCapacity*2),this.occurrenceBuffer=this.createOccurrenceBuffer(this.occurrenceCapacity),this.listBuffer=this.createListBuffer(this.occurrenceCapacity),this.cull&&(this.cull.lods.destroy(),this.cull.lods=this.createLodBuffer(this.occurrenceCapacity)),this.rebindAll()),a.length&&this.device.queue.writeBuffer(this.occurrenceBuffer,0,rs(a,s,n)),this.cull&&this.device.queue.writeBuffer(this.cull.lods,0,new Uint32Array(this.occurrenceCapacity).fill(ii)),this.selectedOccurrence>=a.length&&(this.selectedOccurrence=-1),this.bundleCache.clear(),this.invalidate()}setOccurrenceHiddenLayers(e){this.occurrenceHiddenLayers=this.occurrenceMatrices.map((a,r)=>[...e?.[r]||[]].map(Number)),this.writeOccurrenceRecords()}setOccurrenceExplode(e){this.occurrenceExplode=this.occurrenceMatrices.map((a,r)=>e?.[r]?[...e[r]].map(Number):null),this.writeOccurrenceRecords()}writeOccurrenceRecords(){this.occurrenceMatrices.length&&this.device.queue.writeBuffer(this.occurrenceBuffer,0,rs(this.occurrenceMatrices,this.occurrenceHiddenLayers,this.occurrenceExplode)),this.invalidate()}setInnerCopperMode(e){this.setInnerCopperAtFull(!1),this.innerCopperMode!==e&&(this.innerCopperMode=e,this.invalidate())}setInnerCopperAtFull(e){if(this.innerCopperAtFull!==e){this.innerCopperAtFull=e;for(let a of this.entries)a.innerCopper&&(a.drawClass=ed(a,e),this.setSlot(a.slot,a.indexCount,a.drawClass));this.invalidate()}}setBoardBounds(e){this.boardBounds=e?[...e]:null,this.invalidate()}setLodThresholds(e){this.lodThresholds=ns({...this.lodThresholds,...e}),this.invalidate()}setAnalytic(e){this.analytic&&this.analytic!==e&&this.analytic.destroy(),this.analytic=e||null,this.bundleCache.clear(),this.invalidate()}analyticView(e){if(!this.alwaysInstanced||this.occurrenceMatrices.length!==1)return e;let a=this.occurrenceMatrices[0];return ni(a)?e:ga(e,a)}setLodOverride(e){this.lodOverride=e==null?null:Number(e),this.invalidate()}createLodBuffer(e){return this.device.createBuffer({label:"occurrence-lods",size:e*Uint32Array.BYTES_PER_ELEMENT,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST})}createCull(){let e=this.device,a=this.shareFrom?.cull,r=i=>({visibility:GPUShaderStage.COMPUTE,buffer:{type:i}}),s=a?.layout||e.createBindGroupLayout({label:"cull",entries:[{binding:0,visibility:GPUShaderStage.COMPUTE,buffer:{type:"uniform"}},{binding:1,...r("read-only-storage")},{binding:2,...r("storage")},{binding:3,...r("storage")},{binding:4,...r("storage")},{binding:5,...r("storage")},{binding:6,...r("read-only-storage")}]}),n=a&&{layout:s,classify:a.classify,writeArgs:a.writeArgs};if(!n){let i=this.createShaderModule(Ii,"cull"),o=e.createPipelineLayout({bindGroupLayouts:[s]});n={layout:s,classify:e.createComputePipeline({layout:o,compute:{module:i,entryPoint:"classify"}}),writeArgs:e.createComputePipeline({layout:o,compute:{module:i,entryPoint:"writeArgs"}})}}this.cull={...n,uniform:e.createBuffer({label:"cull-params",size:192,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),lods:this.createLodBuffer(this.occurrenceCapacity),counters:e.createBuffer({label:"cull-counters",size:16,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST}),readback:e.createBuffer({label:"cull-readback",size:16,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}),scratch:new ArrayBuffer(192),reading:!1,readAt:0,bindGroup:null},e.queue.writeBuffer(this.cull.lods,0,new Uint32Array(this.occurrenceCapacity).fill(ii)),this.cull.bindGroup=this.makeCullBindGroup()}makeCullBindGroup(){return this.device.createBindGroup({layout:this.cull.layout,entries:[{binding:0,resource:{buffer:this.cull.uniform}},{binding:1,resource:{buffer:this.occurrenceBuffer}},{binding:2,resource:{buffer:this.cull.lods}},{binding:3,resource:{buffer:this.listBuffer}},{binding:4,resource:{buffer:this.cull.counters}},{binding:5,resource:{buffer:this.argsBuffer}},{binding:6,resource:{buffer:this.classesBuffer}}]})}createBox(){let e=[[[1,0,0],[[1,0,0],[1,1,0],[1,1,1],[1,0,1]]],[[-1,0,0],[[0,0,0],[0,0,1],[0,1,1],[0,1,0]]],[[0,1,0],[[0,1,0],[0,1,1],[1,1,1],[1,1,0]]],[[0,-1,0],[[0,0,0],[1,0,0],[1,0,1],[0,0,1]]],[[0,0,1],[[0,0,1],[1,0,1],[1,1,1],[0,1,1]]],[[0,0,-1],[[0,0,0],[0,1,0],[1,1,0],[1,0,0]]]],a=[],r=[];e.forEach(([l,f],u)=>{for(let p of f)a.push(...p,...l);let g=u*4;r.push(g,g+1,g+2,g,g+2,g+3)});let s=new Float32Array(a),n=new Uint16Array(r),i=this.device.createBuffer({label:"box-vertices",size:s.byteLength,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST}),o=this.device.createBuffer({label:"box-indices",size:n.byteLength,usage:GPUBufferUsage.INDEX|GPUBufferUsage.COPY_DST});this.device.queue.writeBuffer(i,0,s),this.device.queue.writeBuffer(o,0,n);let c=this.device.createBuffer({size:ct,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});this.box={vertexBuffer:i,indexBuffer:o,indexCount:n.length,drawBuffer:c,bindGroup:this.makeBindGroup(c),scratch:new Float32Array(ct/4)},this.setSlot(1,n.length,3)}writeBoxDraw(){let e=this.box.scratch,[a,r,s,n,i,o]=this.boardBounds;e.fill(0),e.set(this.boxColor,0),e.set([n-a,i-r,o-s,0],4),e.set([a,r,s,0],8),this.device.queue.writeBuffer(this.box.drawBuffer,0,e)}encodeCull(e,a){let r=this.cull,s=new Float32Array(r.scratch),n=new Uint32Array(r.scratch);s.fill(0),Cl(a.matrix).forEach((d,m)=>s.set(d,m*4));let i=a.lod;i&&s.set([...i.eye,i.orthographic?0:1],24);let o=this.boardBounds||[-1e6,-1e6,-1e6,1e6,1e6,1e6];s.set([o[0],o[1],o[2],0,o[3],o[4],o[5],0],28);let{fullPx:c,boardPx:l,boxPx:f,keep:u}=this.lodThresholds;s.set([i?.pixelScale||0,c,f,u],36);let g=this.lodOverride!=null?this.lodOverride+1:!i||!this.boardBounds?Rl+1:0;n.set([this.occurrenceMatrices.length,this.selectedOccurrence+1,g,this.nextSlot],40),n[44]=this.barrels?.instanceCount||0,s[45]=l,this.device.queue.writeBuffer(r.uniform,0,r.scratch),e.clearBuffer(r.counters);let p=e.beginComputePass({label:"cull"});p.setBindGroup(0,r.bindGroup),p.setPipeline(r.classify),p.dispatchWorkgroups(Math.ceil(this.occurrenceMatrices.length/64)),p.setPipeline(r.writeArgs),p.dispatchWorkgroups(Math.ceil(this.nextSlot/64)),p.end();let h=performance.now();return!r.reading&&h-r.readAt>250?(e.copyBufferToBuffer(r.counters,0,r.readback,0,16),r.readAt=h,!0):!1}readCullCounts(){let e=this.cull;e.reading=!0;let a=this.occurrenceMatrices.length;e.readback.mapAsync(GPUMapMode.READ).then(()=>{let[r,s,n,i]=new Uint32Array(e.readback.getMappedRange().slice(0));e.readback.unmap(),this.cullCounts={full:r,board:s-r,body:n-s,box:i,culled:Math.max(0,a-n-i)}}).catch(()=>{}).finally(()=>{e.reading=!1})}countFor(e){if(this.identityOnly)return e===2?this.barrels?.instanceCount||0:e===3?0:1;let{full:a,board:r,body:s,box:n}=this.cullCounts;return e===5?a+r+s:e===0?a+r:e===1?a:e===2?(a+r)*(this.barrels?.instanceCount||0):n}gpuMemoryBytes(){let e=0;for(let a of this.entries)e+=(a.vertexAllocation?.size||0)+(a.indexAllocation?.size||0);this.shareFrom||(e+=this.arenaSlackBytes());for(let a of[this.barrels?.vertexBuffer,this.barrels?.indexBuffer,this.barrels?.instanceBuffer,this.barrelRecordBuffer,this.occurrenceBuffer,this.listBuffer,this.argsBuffer,this.classesBuffer,this.featureMaskBuffer,this.netMaskBuffer,this.cull?.lods])e+=a?.size||0;return e+=this.analytic?.gpuMemoryBytes()||0,e+=this.canvas.width*this.canvas.height*12,e}gpuMemoryBreakdown(){let e={},a=0,r=0;for(let c of this.entries){let l=c.vertexAllocation?.size||0,f=c.indexAllocation?.size||0;a+=l,r+=f;let u=c.kind==="copper"?`copper:${c.layerId??"?"}`:c.boardRole?`${c.kind}:${c.boardRole}`:c.kind||"other";e[u]=(e[u]||0)+l+f}let s=[this.barrels?.vertexBuffer,this.barrels?.indexBuffer,this.barrels?.instanceBuffer,this.barrelRecordBuffer].reduce((c,l)=>c+(l?.size||0),0),n=[this.occurrenceBuffer,this.listBuffer,this.argsBuffer,this.classesBuffer,this.featureMaskBuffer,this.netMaskBuffer,this.cull?.lods].reduce((c,l)=>c+(l?.size||0),0),i=this.shareFrom?null:this.arenaStats(),o=this.analytic?.gpuMemoryBytes()||0;return{vertex:a,index:r,geometry:e,barrels:s,occurrences:n,analytic:o,targets:this.canvas.width*this.canvas.height*12,entries:this.entries.length,arena:i}}ensureInstancedPipelines(){if(!this.instancedPipelines){if(this.shareFrom){this.shareFrom.ensureInstancedPipelines(),this.instancedPipelines=this.shareFrom.instancedPipelines,this.createBox(),this.createCull();return}this.instancedPipelines=this.makePipelineSet(!0,[]),this.createBox(),this.createCull()}}makePipelineSet(e,a){let r=this.pipelineLayout,s=ci(a),n=l=>xi(l,e,a),i=s?`+${s}`:"",o=`${e?"-instanced":""}${i}`,c={...this.makeMainPipelines(n("main"),o),pick:this.makePipeline(r,n("pick"),Wt,this.vertexBuffers,`pick${o}`),barrel:this.makeBarrelPipeline(r,n("barrel"),this.format,`barrel${o}`,!e),barrelPick:this.makeBarrelPipeline(r,n("barrelPick"),Wt,`barrel-pick${o}`,!e)};return e&&(c.box=this.makePipeline(r,n("box"),this.format,Zl,`box${i}`),c.boxPick=this.makePipeline(r,n("boxPick"),Wt,Zl,`box-pick${i}`)),this.pipelineSetKinds.set(c,{instanced:e,features:Wa(a),key:s}),c}setShaderFeatures(e=[]){let a=Wa(e),r=ci(a);r!==this.shaderFeatureKey&&(this.shaderFeatures=a,this.shaderFeatureKey=r,this.bundleCache.clear(),this.invalidate())}pipelinesFor(e){let a=this.shareFrom||this;if(e&&this.ensureInstancedPipelines(),!this.shaderFeatureKey)return e?a.instancedPipelines:a.singlePipelines;let r=`${e?"instanced":"single"}|${this.shaderFeatureKey}`,s=a.featurePipelineSets.get(r);return s||(s=a.makePipelineSet(e,this.shaderFeatures),a.featurePipelineSets.set(r,s)),s}drawSet(){return this.identityOnly?{pipelines:this.pipelinesFor(!1),indirect:!1,barrelInstances:this.barrels?.instanceCount||0}:{pipelines:this.pipelinesFor(!0),indirect:!0,barrelInstances:0}}drawEntry(e,a,r){e.setBindGroup(0,a.bindGroup);let s=a.vertexAllocation,n=a.indexAllocation;e.setVertexBuffer(0,s.buffer,s.offset,s.size),e.setIndexBuffer(n.buffer,a.indexFormat,n.offset,n.size),r?e.drawIndexedIndirect(this.argsBuffer,a.slot*20):e.drawIndexed(a.indexCount,a.placementCount||1)}drawBarrels(e,a,r,s){e.setPipeline(a),e.setBindGroup(0,this.barrels.bindGroup),e.setVertexBuffer(0,this.barrels.vertexBuffer),e.setVertexBuffer(1,this.barrels.instanceBuffer),e.setIndexBuffer(this.barrels.indexBuffer,"uint16"),r?e.drawIndexedIndirect(this.argsBuffer,0):e.drawIndexed(this.barrels.indexCount,s)}drawBox(e,a){!this.box||!this.boardBounds||(this.writeBoxDraw(),e.setPipeline(a),e.setBindGroup(0,this.box.bindGroup),e.setVertexBuffer(0,this.box.vertexBuffer),e.setIndexBuffer(this.box.indexBuffer,"uint16"),e.drawIndexedIndirect(this.argsBuffer,20))}createNetMaskBuffer(e){return this.device.createBuffer({label:"net-emphasis-mask",size:e*Uint32Array.BYTES_PER_ELEMENT,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST})}uploadNetMask(){let e;if(this.occurrenceEmphasis&&!this.identityOnly){let r=uc(this.occurrenceEmphasis);this.emphasisStride=r.stride,e=r.data}else this.emphasisStride=0,e=oc(this.emphasizedNetIds,this.netMaskCapacity);if(e.length>this.netMaskCapacity){this.netMaskBuffer?.destroy?.();let r=this.netMaskCapacity;for(;r<e.length;)r*=2;this.netMaskCapacity=r,this.netMaskBuffer=this.createNetMaskBuffer(r),this.rebindAll()}let a=new Uint32Array(this.netMaskCapacity);a.set(e),this.device.queue.writeBuffer(this.netMaskBuffer,0,a)}setOccurrenceEmphasis(e,{dimCopper:a=!1}={}){let r=Array.isArray(e)&&e.some(s=>s&&s.size);this.occurrenceEmphasis=r?e.map(s=>s&&s.size?new Map(s):null):null,this.dimCopper=!!a,this.uploadNetMask(),this.invalidate()}get netHighlightActive(){return!!(this.emphasizedNetIds.size||this.occurrenceEmphasis||this.dimCopper)}setEmphasizedNetIds(e){this.emphasizedNetIds=Ur(e),this.occurrenceEmphasis=null;let a=ic(this.emphasizedNetIds,this.netMaskCapacity);a!==this.netMaskCapacity&&(this.netMaskBuffer?.destroy?.(),this.netMaskCapacity=a,this.netMaskBuffer=this.createNetMaskBuffer(a),this.rebindAll()),this.uploadNetMask(),this.invalidate()}rebindAll(){for(let e of this.entries)e.bindGroup=this.makeBindGroup(this.drawSlotBuffer,e.drawSlot*ct);this.barrels&&(this.barrels.bindGroup=this.makeBindGroup(this.barrels.drawBuffer)),this.box&&(this.box.bindGroup=this.makeBindGroup(this.box.drawBuffer)),this.cull&&(this.cull.bindGroup=this.makeCullBindGroup()),this.bundleCache.clear()}createFeatureMaskBuffer(e){return this.device.createBuffer({label:"feature-visibility-mask",size:e*Uint32Array.BYTES_PER_ELEMENT,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST})}createDrawSlotBuffer(e){return this.device.createBuffer({label:"draw-uniforms",size:e*ct,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST})}allocateDrawSlot(){if(this.freeDrawSlots.length)return this.freeDrawSlots.pop();if(this.nextDrawSlot>=this.drawSlotCapacity){let e=this.drawSlotCapacity*2,a=new Float32Array(e*wa);a.set(this.drawStaging),this.drawSlotBuffer.destroy?.(),this.drawSlotCapacity=e,this.drawSlotBuffer=this.createDrawSlotBuffer(e),this.drawStaging=a,this.rebindAll()}return this.nextDrawSlot++}flushDraws(e){if(!e.length)return;let a=1/0,r=-1;for(let s of e)a=Math.min(a,s.drawSlot),r=Math.max(r,s.drawSlot);this.device.queue.writeBuffer(this.drawSlotBuffer,a*ct,this.drawStaging,a*wa,(r-a+1)*wa)}invalidate(){this.version+=1}setBarrelColor(e){this.barrelColor=[...e],this.invalidate()}makeBindGroup(e,a=0){return this.device.createBindGroup({layout:this.bindGroupLayout,entries:[{binding:0,resource:{buffer:this.globalBuffer}},{binding:1,resource:{buffer:e,offset:a,size:ct}},{binding:2,resource:{buffer:this.layerOffsetBuffer}},{binding:3,resource:{buffer:this.featureMaskBuffer}},{binding:4,resource:{buffer:this.netMaskBuffer}},{binding:5,resource:{buffer:this.occurrenceBuffer}},{binding:6,resource:{buffer:this.barrelRecordBuffer}},{binding:7,resource:{buffer:this.listBuffer}},{binding:8,resource:{buffer:this.placementBuffer}}]})}uploadFeatureMask(){let e=jl(this.hiddenFeatureIds,this.featureMaskCapacity);this.device.queue.writeBuffer(this.featureMaskBuffer,0,e)}setHiddenFeatureIds(e){this.hiddenFeatureIds=is(e);let a=Pl(this.hiddenFeatureIds,this.featureMaskCapacity);a!==this.featureMaskCapacity&&(this.featureMaskBuffer?.destroy?.(),this.featureMaskCapacity=a,this.featureMaskBuffer=this.createFeatureMaskBuffer(a),this.rebindAll()),this.uploadFeatureMask(),this.bundleCache.clear(),this.invalidate()}depthStencilState(e=null,a=!0){let r={format:this.depthFormat,depthWriteEnabled:a,depthCompare:"greater"};return this.stencil&&e&&(r.stencilFront=e,r.stencilBack=e),r}makePipeline(e,a,r,s,n,i={}){let o=this.createShaderModule(a,n);return this.device.createRenderPipeline({layout:e,vertex:{module:o,entryPoint:"vs",buffers:s},fragment:{module:o,entryPoint:"fs",...i.constants?{constants:i.constants}:{},targets:[{format:r,blend:r===Wt?void 0:{color:{srcFactor:"src-alpha",dstFactor:"one-minus-src-alpha"},alpha:{srcFactor:"one",dstFactor:"one-minus-src-alpha"}}}]},primitive:{topology:"triangle-list",cullMode:i.cullMode??"none"},depthStencil:this.depthStencilState(i.stencil,i.depthWrite??!0),multisample:{count:this.samplesFor(r)}})}makeBarrelPipeline(e,a,r,s,n=!0){let i=this.createShaderModule(a,s);return this.device.createRenderPipeline({layout:e,vertex:{module:i,entryPoint:"vs",buffers:[{arrayStride:28,attributes:[{shaderLocation:0,offset:0,format:"float32x3"},{shaderLocation:1,offset:12,format:"float32x3"},{shaderLocation:2,offset:24,format:"float32"}]},...n?[Dl]:[]]},fragment:{module:i,entryPoint:"fs",targets:[{format:r,blend:r===Wt?void 0:{color:{srcFactor:"src-alpha",dstFactor:"one-minus-src-alpha"},alpha:{srcFactor:"one",dstFactor:"one-minus-src-alpha"}}}]},primitive:{topology:"triangle-list",cullMode:"none"},depthStencil:this.depthStencilState(),multisample:{count:this.samplesFor(r)}})}samplesFor(e){return e===Wt?1:this.sampleCount}createShaderModule(e,a){let r=this.device.createShaderModule({label:`pcb-${a}`,code:e});return typeof r.getCompilationInfo=="function"&&r.getCompilationInfo().then(s=>{let n=[...s.messages||[]];if(n.length){console.groupCollapsed(`WebGPU shader compilation info: pcb-${a}`);for(let i of n)console[i.type==="error"?"error":"warn"](`${i.type} ${i.lineNum}:${i.linePos} ${i.message}`);console.groupEnd()}}),r}resize(){let e=Math.min(devicePixelRatio||1,2),a=Math.max(1,Math.floor(this.canvas.clientWidth*e)),r=Math.max(1,Math.floor(this.canvas.clientHeight*e));if(this.canvas.width===a&&this.canvas.height===r)return;this.canvas.width=a,this.canvas.height=r,this.depth?.destroy(),this.colorTarget?.destroy(),this.pickDepth?.destroy(),this.pickTexture?.destroy();let s=this.sampleCount;this.depth=this.device.createTexture({label:"depth",size:[a,r],format:this.depthFormat,sampleCount:s,usage:GPUTextureUsage.RENDER_ATTACHMENT}),this.colorTarget=s>1?this.device.createTexture({label:"color-msaa",size:[a,r],format:this.format,sampleCount:s,usage:GPUTextureUsage.RENDER_ATTACHMENT}):null,this.pickDepth=s>1?this.device.createTexture({label:"pick-depth",size:[a,r],format:this.depthFormat,usage:GPUTextureUsage.RENDER_ATTACHMENT}):this.depth,this.pickTexture=this.device.createTexture({size:[a,r],format:Wt,usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.COPY_SRC})}addPrimitive(e,a){let r=e.position.length/3,s=new ArrayBuffer(r*ki),n=new Uint32Array(s),i=new Uint16Array(s),o=new Int8Array(s),c=Gy(e.position);for(let y=0;y<r;y+=1){let x=y*5,v=y*3;Ky(i,x*2,e.position,v,c),Vy(o,(x+2)*4,e.normal,v),n[x+3]=e.netId[y]||0,n[x+4]=e.objectFeatureId[y]||0}let l=this.arenas(),f=l.vertex.alloc(s.byteLength);l.vertex.write(f,s);let{indices:u,format:g}=qy(e.indices,r),p=l.index.alloc(u.byteLength);l.index.write(p,u);let h=this.allocateDrawSlot(),d=this.makeBindGroup(this.drawSlotBuffer,h*ct),m=ed(a,this.innerCopperAtFull),b={...a,drawClass:m,slot:this.allocSlot(e.indices.length,a.placements?Ly|a.placements<<3:m),placementCount:a.placements||0,placementBase:0,bounds:e.bounds||a.bounds||null,id:this.nextEntryId++,vertexAllocation:f,indexAllocation:p,quantMin:c.min,quantSize:c.size,indexFormat:g,indexCount:e.indices.length,drawSlot:h,bindGroup:d};return this.entries.push(b),this.bundleCache.clear(),this.invalidate(),b}arenas(){let e=this.shareFrom||this;return e.geometryArenas??={vertex:new Ha(e.device,GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST,"geometry-vertices"),index:new Ha(e.device,GPUBufferUsage.INDEX|GPUBufferUsage.COPY_DST,"geometry-indices")},e.geometryArenas}arenaSlackBytes(){let e=this.geometryArenas;return e?e.vertex.reservedBytes()-e.vertex.usedBytes+e.index.reservedBytes()-e.index.usedBytes:0}arenaStats(){let e=this.geometryArenas;if(!e)return{chunks:0,reserved:0,used:0};let a=r=>r.chunks.reduce((s,n)=>s+n.free.filter(i=>i.offset+i.size<n.size).reduce((i,o)=>i+o.size,0),0);return{chunks:e.vertex.chunks.length+e.index.chunks.length,reserved:e.vertex.reservedBytes()+e.index.reservedBytes(),used:e.vertex.usedBytes+e.index.usedBytes,holes:a(e.vertex)+a(e.index)}}componentPipelines(e){let a=this.shareFrom||this,r=a.componentPipelineSets.get(e);if(!r){let{instanced:s,features:n,key:i}=a.pipelineSetKinds.get(e),o=a.pipelineLayout,c=a.vertexBuffers,l=xi("component",s,n),f=xi("componentPick",s,n),u=`${s?"-instanced":""}${i?`+${i}`:""}`;r={main:a.makePipeline(o,l,a.format,c,`component${u}`,{stencil:Jl}),blend:a.makePipeline(o,l,a.format,c,`component-blend${u}`),pick:a.makePipeline(o,f,Wt,c,`component-pick${u}`)},a.componentPipelineSets.set(e,r)}return r}addInstancedPrimitives(e){let a=e.map(({primitive:r,placements:s,metadata:n})=>{let i=this.addPrimitive(r,{...n,placements:s.length});return i.placementRecords=s,i});return this.writePlacements(),a}writePlacements(){let e=this.entries.filter(o=>o.placementRecords),a=e.reduce((o,c)=>o+c.placementRecords.length,0),r=new ArrayBuffer(Math.max(1,a)*yi),s=new Float32Array(r),n=new Uint32Array(r),i=0;for(let o of e){o.placementBase=i;for(let c of o.placementRecords){let l=i*(yi/4);s.set(c.rows,l),n[l+12]=c.featureId||0,i+=1}}this.placementBuffer.size<r.byteLength&&(this.placementBuffer.destroy?.(),this.placementBuffer=this.device.createBuffer({label:"component-placements",size:r.byteLength,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),this.rebindAll()),this.device.queue.writeBuffer(this.placementBuffer,0,r),this.invalidate()}removeEntries(e){if(!e?.length)return;let a=new Set(e.map(r=>r.id));for(let r of e){let s=this.arenas();r.vertexAllocation&&s.vertex.free(r.vertexAllocation),r.indexAllocation&&s.index.free(r.indexAllocation),this.freeDrawSlots.push(r.drawSlot),r.slot!=null&&(this.setSlot(r.slot,0,4),this.freeSlots.push(r.slot))}this.entries=this.entries.filter(r=>!a.has(r.id)),e.some(r=>r.placementRecords)&&this.writePlacements(),this.bundleCache.clear(),this.invalidate()}dispose(){this.removeEntries(this.entries),this.shareFrom||(this.geometryArenas?.vertex.destroy(),this.geometryArenas?.index.destroy(),this.geometryArenas=null),this.barrels&&(this.barrels.vertexBuffer?.destroy?.(),this.barrels.indexBuffer?.destroy?.(),this.barrels.instanceBuffer?.destroy?.(),this.barrels.drawBuffer?.destroy?.(),this.barrels=null),this.depth?.destroy(),this.colorTarget?.destroy(),this.pickDepth!==this.depth&&this.pickDepth?.destroy(),this.insetColor?.texture.destroy(),this.pickTexture?.destroy(),this.featureMaskBuffer?.destroy?.(),this.occurrenceBuffer?.destroy?.(),this.barrelRecordBuffer?.destroy?.(),this.listBuffer?.destroy?.(),this.argsBuffer?.destroy?.(),this.classesBuffer?.destroy?.();for(let e of[this.box?.vertexBuffer,this.box?.indexBuffer,this.box?.drawBuffer,this.cull?.uniform,this.cull?.lods,this.cull?.counters,this.cull?.readback])e?.destroy?.();this.box=null,this.cull=null,this.drawSlotBuffer?.destroy?.(),this.depth=null,this.colorTarget=null,this.pickDepth=null,this.insetColor=null,this.pickTexture=null,this.featureMaskBuffer=null,this.bundleCache.clear()}setBarrels(e){if(!e?.length)return;let a=ad,r=[],s=[],n=(d,m,b)=>{let y=r.length/7;for(let x=0;x<a;x+=1){let v=Math.PI*2*(x+.5)/a,M=Math.cos(v),S=Math.sin(v),[A,_,N]=b(M,S);r.push(M,S,m,A,_,N,d)}return y},i=(d,m)=>{for(let b=0;b<a;b+=1){let y=(b+1)%a;s.push(d+b,d+y,m+y,d+b,m+y,m+b)}};for(let d of[0,1]){let m=d?(b,y)=>[-b,-y,0]:(b,y)=>[b,y,0];i(n(d,0,m),n(d,1,m))}for(let[d,m]of[[0,1],[1,-1]]){let b=()=>[0,0,m];i(n(0,d,b),n(2,d,b))}let o=new Float32Array(r),c=new Uint16Array(s),l=Gl(e),f=this.device.createBuffer({size:o.byteLength,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST}),u=this.device.createBuffer({size:c.byteLength,usage:GPUBufferUsage.INDEX|GPUBufferUsage.COPY_DST}),g=this.device.createBuffer({size:l.byteLength,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST});this.device.queue.writeBuffer(f,0,o),this.device.queue.writeBuffer(u,0,c),this.device.queue.writeBuffer(g,0,l);let p=Kl(e);this.barrelRecordBuffer?.destroy?.(),this.barrelRecordBuffer=this.device.createBuffer({label:"barrel-records",size:p.byteLength,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),this.device.queue.writeBuffer(this.barrelRecordBuffer,0,p);let h=this.device.createBuffer({size:ct,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});this.barrels={records:e,vertexBuffer:f,indexBuffer:u,instanceBuffer:g,indexCount:c.length,instanceCount:e.length,drawBuffer:h,bindGroup:null},this.setSlot(0,c.length,2),this.rebindAll(),this.invalidate()}render(e){let{panels:a,layerOffsets:r}=e;this.resize(),this.device.queue.writeBuffer(this.layerOffsetBuffer,0,r);let s=this.context.getCurrentTexture().createView(),n=0,i=0;a.forEach((o,c)=>{let l=this.device.createCommandEncoder(),f=!this.identityOnly&&this.encodeCull(l,o),u=l.beginRenderPass({colorAttachments:[this.colorAttachment(s,c===0,c===a.length-1)],depthStencilAttachment:this.depthAttachment()}),g=wi(o.viewport,this.canvas.width,this.canvas.height);u.setViewport(g.x,g.y,g.width,g.height,0,1),u.setScissorRect(g.x,g.y,g.width,g.height),this.analytic&&(this.analytic.viewport=g);let p=this.encodeDraws(u,o,e);n+=p.triangles,i+=p.draws,u.end(),this.device.queue.submit([l.finish()]),f&&this.readCullCounts()}),this.frameStats={triangles:Math.round(n),draws:i}}analyticFlatLayers(e){if(!this.analytic||!e.compareMode)return[];let a=[];for(let r of e.visibleLayers||[]){let s=this.analytic.layerZ(Number(r));s!==null&&a.push({layerId:Number(r),offset:e.compareOffsets?.get(r)||e.compareOffsets?.get(Number(r))||[0,0,0],z:s})}return a}encodeFlatLayers(e,a,r,s,n){let i=new Map(r.map(l=>[l.layerId,l])),o={matrix:a,flat:i,isolateNet:s,showBoard:!1},c=this.innerCopperMode;this.innerCopperMode="all";try{return this.analytic.encodeInto(e,Uy,new Set(i.keys()),n,o)}finally{this.innerCopperMode=c}}renderInto(e,a,r){if(!this.identityOnly)throw new Error("renderInto: one-board renderer only");let s=this.device.createCommandEncoder({label:"inset"}),n={view:e.depthView,depthClearValue:0,depthLoadOp:"clear",depthStoreOp:"discard"};this.stencil&&Object.assign(n,{stencilClearValue:0,stencilLoadOp:"clear",stencilStoreOp:"discard"});let i=s.beginRenderPass({colorAttachments:[this.colorAttachment(e.colorView,!0,!0,this.insetColorView(e.width,e.height))],depthStencilAttachment:n}),o=wi(a.viewport,e.width,e.height);i.setViewport(o.x,o.y,o.width,o.height,0,1),i.setScissorRect(o.x,o.y,o.width,o.height),this.analytic&&(this.analytic.viewport=o);let c=this.encodeDraws(i,a,r);return i.end(),this.device.queue.submit([s.finish()]),c}encodeDraws(e,a,{activeNetId:r,selectedFeatureId:s,time:n,visibleLayers:i,showBoard:o,showComponents:c,showPaste:l=!0,componentOpacity:f,boardOpacity:u,isolateNet:g,compareMode:p=!1,compareOffsets:h=new Map,layerAlphas:d=null,visibleTileIds:m=null,layerOffsets:b=null}){let y=0,x=0,v=null;if(this.stencil&&e.setStencilReference(1),this.writeGlobals(a.matrix,r,a.layerId,n,s),this.relief?.ready&&!p)return{triangles:this.relief.vertexCount/3,draws:this.relief.encode(e,a.matrix)};let{pipelines:M,indirect:S,barrelInstances:A}=this.drawSet(),_=!l||!!(r||this.netHighlightActive),N=this.entries.filter(B=>this.visible(B,a.layerId,i,o,c,f,p,m)&&!(_&&B.boardRole==="paste")&&!(B.side&&this.hiddenBoardLayers?.has(`${B.boardRole}:${B.side}`))),I=N.filter(B=>!ls(B)).sort((B,R)=>+!!B.stencilMark-+!!R.stencilMark),C=N.filter(B=>ls(B)).sort((B,R)=>ls(B)-ls(R));for(let B of N)this.writeDraw(B,r,f,u,g,p,h.get(B.layerId),d?.get(B.layerId)??1);this.flushDraws(N),I.length>64?e.executeBundles([this.renderBundle(I,a.layerId)]):this.drawEntries(e,I,M,S);for(let B of N)y+=B.indexCount/3*this.countFor(B.drawClass)*(B.placementCount||1);if(x+=N.length,this.analytic&&!p&&(v={matrix:this.analyticView(a.matrix),showBoard:o,boardOpacity:u,hidePaste:_,isolateNet:g,panelLayer:a.layerId,assemblyOpacity:l?1:f,hiddenBoardLayers:this.hiddenBoardLayers},x+=this.analytic.encodeInto(e,b,a.layerId?new Set([a.layerId]):i,!1,v),x+=this.analytic.encodeBarrels(e,b,v.matrix),x+=this.analytic.encodeArrows(e)),this.analytic&&p){let B=this.analyticFlatLayers({compareMode:p,visibleLayers:i,compareOffsets:h});B.length&&(x+=this.encodeFlatLayers(e,a.matrix,B,g,!1))}return!p&&this.barrels&&!this.analytic?.hasBarrels()&&(a.layerId===0||i.has(a.layerId))&&(this.writeBarrelDraw(g),this.drawBarrels(e,M.barrel,S,A),y+=this.barrels.indexCount/3*this.countFor(2),x+=1),S&&!p&&(this.drawBox(e,M.box),y+=12*this.countFor(3),x+=1),v&&(x+=this.analytic.encodeGhostBarrels(e),x+=this.analytic.encodeBlended(e,b,a.layerId?new Set([a.layerId]):i,v)),this.drawBlended(e,C,M,S),{triangles:y,draws:x}}colorAttachment(e,a=!0,r=!0,s=this.colorTarget?.createView()){let n={view:e,clearValue:{r:.91,g:.93,b:.94,a:1},loadOp:a?"clear":"load",storeOp:"store"};return this.sampleCount===1?n:{...n,view:s,resolveTarget:e,storeOp:r?"discard":"store"}}insetColorView(e,a){if(this.sampleCount!==1){if(this.insetColor?.width!==e||this.insetColor?.height!==a){this.insetColor?.texture.destroy();let r=this.device.createTexture({label:"inset-msaa",size:[e,a],format:this.format,sampleCount:this.sampleCount,usage:GPUTextureUsage.RENDER_ATTACHMENT});this.insetColor={texture:r,view:r.createView(),width:e,height:a}}return this.insetColor.view}}depthAttachment(e=!1){let a={view:(e?this.pickDepth:this.depth).createView(),depthClearValue:0,depthLoadOp:"clear",depthStoreOp:"discard"};return this.stencil&&Object.assign(a,{stencilClearValue:0,stencilLoadOp:"clear",stencilStoreOp:"discard"}),a}drawEntries(e,a,r,s){let n=null;for(let i of a){let o=i.placementCount?this.componentPipelines(r).main:i.stencilMark?r.mark:r.main;o!==n&&(e.setPipeline(o),n=o),this.drawEntry(e,i,s)}}drawBlended(e,a,r,s){for(let n of a)if(n.boardRole==="soldermask"&&n.kind==="board")e.setPipeline(r.mask),this.drawEntry(e,n,s),r.maskCovered&&(e.setPipeline(r.maskCovered),this.drawEntry(e,n,s));else{let i=n.translucent?r.translucent??r.blend:r.blend;e.setPipeline(n.placementCount?this.componentPipelines(r).blend:i),this.drawEntry(e,n,s)}}setPlaceholdersVisible(e){this.showPlaceholders=!!e,this.invalidate()}setHiddenBoardLayers(e){this.hiddenBoardLayers=new Set(e||[]),this.invalidate()}visible(e,a,r,s,n,i,o=!1,c=null){return e.placeholder&&!this.showPlaceholders?!1:o?e.kind==="copper"&&r.has(e.layerId):e.kind==="copper"&&this.analytic?.coversLayer(e.layerId)||e.kind==="board"&&this.analytic?.coversRole(e.boardRole)||e.kind==="board"&&e.boardRole==="pad"||e.kind==="copper"&&c&&!c.has(e.tileId)||e.innerCopper&&this.innerCopperMode==="none"?!1:e.boardRole==="paste"?a===0&&r.has(e.layerId):e.kind==="board"?a===0&&s:e.kind==="component"?a===0&&n&&i>.001:a?e.layerId===a:r.has(e.layerId)}writeGlobals(e,a,r,s,n=0){let i=this.globalScratch,o=this.globalScratchF32;o.fill(0),o.set(e,0);let c=this.globalScratchView;if(c.setUint32(64,a||0,!0),c.setUint32(68,r||0,!0),c.setFloat32(72,s,!0),c.setFloat32(76,a||this.netHighlightActive?1:0,!0),c.setUint32(80,n||0,!0),c.setUint32(84,this.selectedOccurrence>=0?this.selectedOccurrence+1+this.occurrenceBase:0,!0),c.setUint32(88,this.occurrenceBase,!0),c.setUint32(92,this.emphasisStride,!0),o.set(vi,24),this.device.queue.writeBuffer(this.globalBuffer,0,i),this.analyticGlobalBuffer&&this.analytic){let l=this.occurrenceMatrices.length===1?this.occurrenceMatrices[0]:null;o.set(this.analyticView(e),0),o.set(l?_y(l):vi,24),this.device.queue.writeBuffer(this.analyticGlobalBuffer,0,i)}}writeDraw(e,a,r,s=1,n=!1,i=!1,o=null,c=1){let l=this.drawStaging.subarray(e.drawSlot*wa,(e.drawSlot+1)*wa);l.fill(0);let f=e.color||e.material.baseColor;l.set(f,0),l.set([e.material.metallic||0,e.material.roughness??.72,e.opacityScale!=null?r:0,zy[e.drawClass]??1],4);let u=Wy(e);l.set([o?.[0]||0,o?.[1]||0,(i?-(e.baseZ||0):e.layerOffset||0)+u,e.kind==="copper"||e.boardRole==="paste"?Number(e.layerId||0)+1:0],8);let g=Number.isFinite(f?.[3])?f[3]:1,p=e.kind==="component"?r*(e.opacityScale??1):e.kind==="board"&&e.boardRole!=="paste"?s*Hy(e,g):c,h=e.kind==="copper"?1:e.kind==="component"?2:0,d=n?1:e.innerCopper&&this.innerCopperMode==="lit"?2:0;if(l.set([h,p,d,i?1:0],12),e.placementCount){let m=new Uint32Array(l.buffer,l.byteOffset+64,2);m[0]=e.placementBase,m[1]=e.placementCount}l.set(e.quantMin,20),l.set(e.quantSize,24)}writeBarrelDraw(e=!1){let a=this.barrelDrawScratch;a.fill(0),a.set(this.barrelColor,0),a.set([.75,.32,0,0],4),a.set([1,1,e?1:0,0],12),this.device.queue.writeBuffer(this.barrels.drawBuffer,0,a)}renderBundle(e,a){let{pipelines:r,indirect:s}=this.drawSet(),{vertex:n,index:i}=this.arenas(),o=`${a}:${s?"indirect":"single"}:${this.shaderFeatureKey}:${n.generation}.${i.generation}:${e.map(u=>u.id).join(",")}`,c=this.bundleCache.get(o);if(c)return c;let l=this.device.createRenderBundleEncoder({colorFormats:[this.format],depthStencilFormat:this.depthFormat,sampleCount:this.sampleCount});this.drawEntries(l,e,r,s);let f=l.finish();return this.bundleCache.set(o,f),this.bundleCache.size>32&&this.bundleCache.delete(this.bundleCache.keys().next().value),f}pick(e,a,r,s){let n=this.pickSerial.then(()=>this.performPick(e,a,r,s));return this.pickSerial=n.catch(()=>0),n}async performPick(e,a,r,s){this.resize();let n=Math.max(0,Math.min(this.canvas.width-1,Math.floor(a))),i=Math.max(0,Math.min(this.canvas.height-1,Math.floor(r)));this.device.queue.writeBuffer(this.layerOffsetBuffer,0,s.layerOffsets);let o=this.device.createCommandEncoder(),c=o.beginRenderPass({colorAttachments:[{view:this.pickTexture.createView(),clearValue:{r:0,g:0,b:0,a:0},loadOp:"clear",storeOp:"store"}],depthStencilAttachment:this.depthAttachment(!0)}),l=wi(e.viewport,this.canvas.width,this.canvas.height);return c.setViewport(l.x,l.y,l.width,l.height,0,1),c.setScissorRect(n,i,1,1),this.analytic&&(this.analytic.viewport=l),this.encodePick(c,e,s),c.end(),this.readPick(o,n,i)}encodePick(e,a,r){if(this.relief?.ready&&!r.compareMode)return;this.writeGlobals(a.matrix,r.activeNetId,a.layerId,performance.now()/1e3,r.selectedFeatureId);let{pipelines:s,indirect:n,barrelInstances:i}=this.drawSet();e.setPipeline(s.pick);let o=[];for(let c of this.entries)this.visible(c,a.layerId,r.visibleLayers,r.showBoard,r.showComponents,r.componentOpacity,r.compareMode,r.visibleTileIds)&&(c.kind==="board"&&(this.identityOnly||c.boardRole!=="substrate")||(this.writeDraw(c,r.activeNetId,r.componentOpacity,r.boardOpacity,r.isolateNet,r.compareMode,r.compareOffsets?.get(c.layerId)),o.push(c)));this.flushDraws(o);for(let c of o)e.setPipeline(c.placementCount?this.componentPipelines(s).pick:s.pick),this.drawEntry(e,c,n);if(!r.compareMode&&this.barrels&&!this.analytic?.hasBarrels()&&(this.writeBarrelDraw(r.isolateNet),this.drawBarrels(e,s.barrelPick,n,i)),n&&!r.compareMode&&this.drawBox(e,s.boxPick),this.analytic&&!r.compareMode){let c=a.layerId?new Set([a.layerId]):r.visibleLayers;this.analytic.encodeInto(e,r.layerOffsets,c,!0,{matrix:this.analyticView(a.matrix),panelLayer:a.layerId,isolateNet:r.isolateNet,showBoard:r.showBoard}),this.analytic.encodeBarrels(e,r.layerOffsets,this.analyticView(a.matrix),!0)}if(this.analytic&&r.compareMode){let c=this.analyticFlatLayers(r);c.length&&this.encodeFlatLayers(e,a.matrix,c,r.isolateNet,!0)}}async readPick(e,a,r,s=this){let n=this.device.createBuffer({label:"pick-readback",size:256,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});e.copyTextureToBuffer({texture:this.pickTexture,origin:{x:a,y:r}},{buffer:n,bytesPerRow:256},{width:1,height:1}),this.device.queue.submit([e.finish()]);try{await n.mapAsync(GPUMapMode.READ);let i=new DataView(n.getMappedRange()),o=i.getUint32(0,!0),c=i.getUint32(4,!0);if(n.unmap(),s.analytic&&o&2147483648&&c)return{kind:"analytic",occurrenceIndex:-1,featureId:0,operationIndex:c-1,occurrenceKey:null};let l=_l(o,c);return{...l,occurrenceKey:l.occurrenceIndex>=0?s.occurrenceKeys[l.occurrenceIndex]??null:null}}finally{n.mapState==="mapped"&&n.unmap(),n.destroy()}}},zy=Object.freeze({0:1,1:0,5:2});function Gy(t){let e=[1/0,1/0,1/0],a=[-1/0,-1/0,-1/0];for(let r=0;r<t.length;r+=3)for(let s=0;s<3;s+=1){let n=t[r+s];n<e[s]&&(e[s]=n),n>a[s]&&(a[s]=n)}return Number.isFinite(e[0])?{min:e,size:e.map((r,s)=>a[s]>r?a[s]-r:1)}:{min:[0,0,0],size:[1,1,1]}}function Ky(t,e,a,r,s){for(let n=0;n<3;n+=1){let i=(a[r+n]-s.min[n])/s.size[n];t[e+n]=Math.max(0,Math.min(65535,Math.round(i*65535)))}t[e+3]=0}function Vy(t,e,a,r){for(let s=0;s<3;s+=1){let n=Number(a[r+s])||0;t[e+s]=Math.max(-127,Math.min(127,Math.round(n*127)))}t[e+3]=0}function qy(t,e){if(e<=65536){let a=new Uint16Array(t.length+(t.length&1));return a.set(t),{indices:a,format:"uint16"}}return{indices:t instanceof Uint32Array?t:new Uint32Array(t),format:"uint32"}}function _d(t,e){return t*ki+(t<=65536?(e+(e&1))*2:e*4)}function ed(t,e){return t.kind==="component"||t.innerCopper&&e?1:t.kind==="board"&&(t.boardRole==="substrate"||t.boardRole==="soldermask")?5:0}function ls(t){return t.translucent?3:t.kind!=="board"?0:t.boardRole==="soldermask"?1:t.boardRole==="silkscreen"?2:0}function Hy(t,e){return t.kind!=="board"||t.boardRole==="substrate"?1:t.boardRole==="soldermask"?Math.min(e,.72):t.boardRole==="silkscreen"?Math.min(e,.92):e}function Wy(t){if(t.kind!=="board"||t.boardRole!=="soldermask"&&t.boardRole!=="silkscreen")return 0;let e=t.bounds,r=(e?(e[2]+e[5])*.5:0)<0?-1:1,s=t.boardRole==="silkscreen"?35e-6:18e-6;return r*s}function wi(t,e,a){let r=Math.max(0,Math.min(e-1,Math.floor(t.x))),s=Math.max(0,Math.min(a-1,Math.floor(t.y)));return{x:r,y:s,width:Math.max(1,Math.min(e-r,Math.floor(t.width))),height:Math.max(1,Math.min(a-s,Math.floor(t.height)))}}var Xy=[0,0,0,1,1,1],ps=class t{static async create(e){return new t(await Xt.create(e))}constructor(e){this.host=e,this.canvas=e.canvas,this.device=e.device,e.alwaysInstanced=!0,e.setOccurrences([]),this.assets=new Map,this.order=[],this.frameStats={triangles:0,draws:0},this.lodThresholds={...Ht}}asset(e){let a=this.assets.get(e);return a||(a=new Xt(this.canvas,this.device,{shareFrom:this.host}),a.setLodThresholds(this.lodThresholds),this.assets.set(e,a)),a}standIn(e,a){let r=this.asset(e);return r.standIn||(r.standIn=!0,r.setBoardBounds(Xy),r.setLodOverride(Nl)),r.boxColor=[...a],r}removeAsset(e){let a=this.assets.get(e);a&&(a.dispose(),this.assets.delete(e))}get renderers(){return this.order.map(e=>this.assets.get(e)).filter(Boolean)}setOccurrences(e){this.order=[...e.keys()].filter(r=>this.assets.has(r));for(let[r,s]of this.assets)e.has(r)||s.setOccurrences([]);for(let r of this.order)this.assets.get(r).setOccurrences(e.get(r));let a=0;for(let r of this.renderers)r.occurrenceBase=a,a+=r.occurrenceCount;this.occurrenceCount=a}locate(e){for(let a of this.renderers){let r=e-a.occurrenceBase;if(r>=0&&r<a.occurrenceCount)return{renderer:a,local:r}}return null}keyOf(e){let a=this.locate(e);return a?a.renderer.occurrenceKeys[a.local]??null:null}setSelectedOccurrence(e){let a=e>=0?this.locate(e):null;for(let r of this.renderers)r.selectedOccurrence=!r.standIn&&a?.renderer===r?a.local:-1}resize(){this.host.resize()}render(e,a){let r=this.host;r.resize();let s=this.renderers.filter(g=>g.occurrenceCount>0),n=new Map(s.map(g=>[g,a(g)])),i=Ri(e.viewport,this.canvas);for(let[g,p]of n)Id(g,p),g.analytic&&(g.analytic.viewport=i);let o=this.device.createCommandEncoder(),c=s.filter(g=>g.encodeCull(o,e)),l=o.beginRenderPass({colorAttachments:[r.colorAttachment(r.context.getCurrentTexture().createView())],depthStencilAttachment:r.depthAttachment()});Rd(l,e.viewport,this.canvas);let f=0,u=0;for(let g of s){let p=g.encodeDraws(l,e,n.get(g));f+=p.triangles,u+=p.draws}l.end(),this.device.queue.submit([o.finish()]);for(let g of c)g.readCullCounts();this.frameStats={triangles:Math.round(f),draws:u}}pick(e,a,r,s){let n=this.host.pickSerial.then(()=>this.performPick(e,a,r,s));return this.host.pickSerial=n.catch(()=>0),n}async performPick(e,a,r,s){let n=this.host;n.resize();let i=Math.max(0,Math.min(this.canvas.width-1,Math.floor(a))),o=Math.max(0,Math.min(this.canvas.height-1,Math.floor(r)));for(let c of this.renderers){if(c.occurrenceCount===0)continue;let l=s(c);Id(c,l),c.analytic&&(c.analytic.viewport=Ri(e.viewport,this.canvas));let f=this.device.createCommandEncoder(),u=f.beginRenderPass({colorAttachments:[{view:n.pickTexture.createView(),clearValue:{r:0,g:0,b:0,a:0},loadOp:"clear",storeOp:"store"}],depthStencilAttachment:n.depthAttachment(!0)});Rd(u,e.viewport,this.canvas),c.encodePick(u,e,l),u.end();let g=await n.readPick(f,i,o,c);if(g.kind==="analytic"||g.occurrenceIndex>=0){let p=g.occurrenceIndex-c.occurrenceBase;return{...g,occurrenceKey:p>=0?c.occurrenceKeys[p]??null:c.occurrenceKeys[0]??null,renderer:c,standIn:!!c.standIn}}}return{occurrenceIndex:-1,occurrenceKey:null,featureId:0,kind:"empty",renderer:null,standIn:!1}}gpuMemoryBytes(){let e=0;for(let a of this.renderers)e+=a.gpuMemoryBytes();return e+=this.host.arenaSlackBytes(),e-Math.max(0,this.renderers.length-1)*this.canvas.width*this.canvas.height*12}gpuMemoryBreakdown(){let e={};for(let[a,r]of this.assets){let s=r.gpuMemoryBreakdown();delete s.targets,e[a]=s}return{assets:e,targets:this.canvas.width*this.canvas.height*12,arena:this.host.arenaStats()}}setLodThresholds(e){this.lodThresholds=ns({...this.lodThresholds,...e});for(let a of this.assets.values())a.setLodThresholds(this.lodThresholds);return{...this.lodThresholds}}cullCounts(){let e={full:0,board:0,body:0,box:0,culled:0};for(let a of this.renderers)if(a.occurrenceCount)for(let r of Object.keys(e))e[r]+=a.cullCounts[r]||0;return e}dispose(){for(let e of[...this.assets.keys()])this.removeAsset(e);this.host.dispose(),this.host.context?.unconfigure?.(),this.device.destroy?.()}};function Id(t,e){e?.layerOffsets&&t.device.queue.writeBuffer(t.layerOffsetBuffer,0,e.layerOffsets)}function Ri(t,e){let a=Math.max(0,Math.min(e.width-1,Math.floor(t.x))),r=Math.max(0,Math.min(e.height-1,Math.floor(t.y))),s=Math.max(1,Math.min(e.width-a,Math.floor(t.width))),n=Math.max(1,Math.min(e.height-r,Math.floor(t.height)));return{x:a,y:r,width:s,height:n}}function Rd(t,e,a){let r=Ri(e,a);t.setViewport(r.x,r.y,r.width,r.height,0,1),t.setScissorRect(r.x,r.y,r.width,r.height)}var $y=`
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
}`,Yy=`
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
}`,Jy=`
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
}`,Qy=`
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
}`,Zy=`
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
}`,e0=`
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
}`,t0=`
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
}`,a0=6.2,r0=4.6,s0=3.8,ms=4*1024*1024,n0=Math.floor(ms/6),Nd=n0*6,gs=512*1024,Cd=512*1024,Bd=96,i0=96,o0=18,Od=96*1024*1024,c0=2,ws=class t{static async create(e,a){if(!navigator.gpu)throw new Error("WebGPU is unavailable in this browser");let r=await navigator.gpu.requestAdapter({powerPreference:"high-performance"});if(!r)throw new Error("No WebGPU adapter is available");let s=await r.requestDevice(),n=await fetch(a,{cache:"default"});if(!n.ok)throw new Error(`Failed to load schematic manifest: ${n.status}`);let i=await n.json();if(!["prism.schematic_world_a0","prism.schematic_vector_a0"].includes(i.schema))throw new Error(`Unsupported schematic scene schema: ${i.schema}`);let o=i.featureTable||i.features,c=await fetch(new URL(o,a),{cache:"default"});if(!c.ok)throw new Error(`Failed to load schematic features: ${c.status}`);let l=d0(await c.json());return new t(e,s,a,i,l)}constructor(e,a,r,s,n){this.canvas=e,this.device=a,this.manifestUrl=r,this.manifest=s,this.isNativeScene=s.schema==="prism.schematic_vector_a0",this.pages=s.pages||[],this.featuresByPage=n,this.featuresById=new Map;for(let p of Object.values(n))for(let h of p)this.featuresById.set(Number(h.id),h);this.context=e.getContext("webgpu"),this.format=navigator.gpu.getPreferredCanvasFormat(),this.context.configure({device:a,format:this.format,alphaMode:"opaque"}),this.flowCanvas=null,this.flowContext=null,this.globalBuffer=a.createBuffer({size:48,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),this.bindGroupLayout=a.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}},{binding:1,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}},{binding:2,visibility:GPUShaderStage.FRAGMENT,sampler:{type:"filtering"}},{binding:3,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:"float"}}]});let i=a.createShaderModule({code:$y});this.pagePipeline=a.createRenderPipeline({layout:a.createPipelineLayout({bindGroupLayouts:[this.bindGroupLayout]}),vertex:{module:i,entryPoint:"vs"},fragment:{module:i,entryPoint:"fs",targets:[{format:this.format}]},primitive:{topology:"triangle-list"}}),this.edgeLayout=a.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}}]});let o=a.createShaderModule({code:Yy});this.edgePipeline=a.createRenderPipeline({layout:a.createPipelineLayout({bindGroupLayouts:[this.edgeLayout]}),vertex:{module:o,entryPoint:"vs",buffers:[{arrayStride:8,attributes:[{shaderLocation:0,offset:0,format:"float32x2"}]}]},fragment:{module:o,entryPoint:"fs",targets:[{format:this.format,blend:{color:{srcFactor:"src-alpha",dstFactor:"one-minus-src-alpha"},alpha:{srcFactor:"one",dstFactor:"one-minus-src-alpha"}}}]},primitive:{topology:"line-list"}}),this.edgeBindGroup=a.createBindGroup({layout:this.edgeLayout,entries:[{binding:0,resource:{buffer:this.globalBuffer}}]});let c=a.createShaderModule({code:Jy});this.highlightPipeline=a.createRenderPipeline({layout:a.createPipelineLayout({bindGroupLayouts:[this.edgeLayout]}),vertex:{module:c,entryPoint:"vs",buffers:[{arrayStride:8,attributes:[{shaderLocation:0,offset:0,format:"float32x2"}]}]},fragment:{module:c,entryPoint:"fs",targets:[{format:this.format,blend:{color:{srcFactor:"src-alpha",dstFactor:"one-minus-src-alpha"},alpha:{srcFactor:"one",dstFactor:"one-minus-src-alpha"}}}]},primitive:{topology:"line-list"}}),this.highlightBufferSize=4*1024*1024,this.highlightBuffer=a.createBuffer({size:this.highlightBufferSize,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST});let l=a.createShaderModule({code:Qy});this.netFlowPipeline=a.createRenderPipeline({layout:a.createPipelineLayout({bindGroupLayouts:[this.edgeLayout]}),vertex:{module:l,entryPoint:"vs",buffers:[{arrayStride:16,attributes:[{shaderLocation:0,offset:0,format:"float32x2"},{shaderLocation:1,offset:8,format:"float32x2"}]}]},fragment:{module:l,entryPoint:"fs",targets:[{format:this.format,blend:{color:{srcFactor:"src-alpha",dstFactor:"one-minus-src-alpha"},alpha:{srcFactor:"one",dstFactor:"one-minus-src-alpha"}}}]},primitive:{topology:"triangle-list"}}),this.netFlowBuffer=a.createBuffer({size:Cd*4,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST}),this.globalUniformScratch=new Float32Array(12),this.pageUniformScratch=new Float32Array(8),this.imageUniformScratch=new Float32Array(8),this.vectorScratch=new Float32Array(ms),this.highlightScratch=new Float32Array(this.highlightBufferSize/4),this.netFlowScratch=new Float32Array(Cd),this.netTrackingCache=null,this.selectedIntrasheetLinkIndex=-1,this.truncatedHighlightCount=0,this.truncatedVectorCount=0,this.frameSerial=0,this.querySerial=0;let f=a.createShaderModule({code:Zy});this.vectorPipeline=a.createRenderPipeline({layout:a.createPipelineLayout({bindGroupLayouts:[this.edgeLayout]}),vertex:{module:f,entryPoint:"vs",buffers:[{arrayStride:24,attributes:[{shaderLocation:0,offset:0,format:"float32x2"},{shaderLocation:1,offset:8,format:"float32x4"}]}]},fragment:{module:f,entryPoint:"fs",targets:[{format:this.format,blend:{color:{srcFactor:"src-alpha",dstFactor:"one-minus-src-alpha"},alpha:{srcFactor:"one",dstFactor:"one-minus-src-alpha"}}}]},primitive:{topology:"triangle-list"}}),this.vectorBuffer=a.createBuffer({size:ms*4,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST}),this.vectorBuffers=[this.vectorBuffer];let u=a.createShaderModule({code:e0});this.imagePipeline=a.createRenderPipeline({layout:a.createPipelineLayout({bindGroupLayouts:[this.bindGroupLayout]}),vertex:{module:u,entryPoint:"vs"},fragment:{module:u,entryPoint:"fs",targets:[{format:this.format,blend:{color:{srcFactor:"src-alpha",dstFactor:"one-minus-src-alpha"},alpha:{srcFactor:"one",dstFactor:"one-minus-src-alpha"}}}]},primitive:{topology:"triangle-list"}});let g=a.createShaderModule({code:t0});this.pickPipeline=a.createRenderPipeline({layout:a.createPipelineLayout({bindGroupLayouts:[this.edgeLayout]}),vertex:{module:g,entryPoint:"vs",buffers:[{arrayStride:12,attributes:[{shaderLocation:0,offset:0,format:"float32x2"},{shaderLocation:1,offset:8,format:"uint32"}]}]},fragment:{module:g,entryPoint:"fs",targets:[{format:"r32uint"}]},primitive:{topology:"triangle-list"}}),this.pickVertexBuffer=a.createBuffer({size:gs*12,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST}),this.pickReadBuffer=a.createBuffer({size:256,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}),this.pickTexture=null,this.pickTextureSize=[0,0],this.pickPending=!1,this.vectorChunks=new Map,this.failedVectorChunks=new Map,this.nativeDetailState=new Map,this.domDetailPageIds=new Set,this.nativeDetailThresholds=new Map,this.residentVectorBytes=0,this.sampler=a.createSampler({magFilter:"linear",minFilter:"linear",mipmapFilter:"linear"}),this.placeholder=this.createSolidTexture([245,247,249,255]),this.pageResources=new Map,this.imageResources=new Map,this.loading=new Map,this.selectedPageId="",this.selectedFeatureId=0,this.activeNetUid="",this.showHierarchy=!0,this.downloadedBytes=0,this.world=s.worldBoundsMm,this.center=[(this.world.minX+this.world.maxX)/2,(this.world.minY+this.world.maxY)/2],this.scale=Math.max((this.world.maxX-this.world.minX)/900,(this.world.maxY-this.world.minY)/650,.1)*1.16,this.edgeBuffer=this.createEdgeBuffer();for(let p of this.pages)this.createPageResource(p)}createSolidTexture(e){let a=this.device.createTexture({size:[1,1],format:"rgba8unorm-srgb",usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST});return this.device.queue.writeTexture({texture:a},new Uint8Array(e),{bytesPerRow:4},[1,1]),a}createPageResource(e){let a=this.device.createBuffer({size:32,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),r={page:e,uniform:a,texture:this.placeholder,textureWidth:0,svgBlob:null,bindGroup:null};this.pageResources.set(e.id,r),this.updateBindGroup(r)}createImageResource(e){let a=this.device.createBuffer({size:32,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),r={path:e,uniform:a,texture:this.placeholder,loaded:!1,bindGroup:null};return this.imageResources.set(e,r),this.updateBindGroup(r),r}updateBindGroup(e){e.bindGroup=this.device.createBindGroup({layout:this.bindGroupLayout,entries:[{binding:0,resource:{buffer:this.globalBuffer}},{binding:1,resource:{buffer:e.uniform}},{binding:2,resource:this.sampler},{binding:3,resource:e.texture.createView()}]})}async loadImageTexture(e){let a=this.imageResources.get(e)||this.createImageResource(e);if(a.loaded)return a;let r=`image:${e}`;if(this.loading.has(r))return this.loading.get(r);let s=(async()=>{try{let n=await fetch(new URL(e,this.manifestUrl),{cache:"default"});if(!n.ok)throw new Error(`Failed to load schematic image ${e}: ${n.status}`);let i=await n.blob(),o=await createImageBitmap(i),c=this.device.createTexture({size:[o.width,o.height],format:"rgba8unorm-srgb",usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST|GPUTextureUsage.RENDER_ATTACHMENT});this.device.queue.copyExternalImageToTexture({source:o},{texture:c},[o.width,o.height]),o.close(),a.texture!==this.placeholder&&a.texture.destroy(),a.texture=c,a.loaded=!0,this.updateBindGroup(a)}finally{this.loading.delete(r)}return a})();return this.loading.set(r,s),s}createEdgeBuffer(){let e=new Map(this.pages.map(n=>[n.id,n])),a=[];for(let n of this.manifest.edges||[]){let i=e.get(n.source),o=e.get(n.target);!i||!o||a.push(i.worldX+i.widthMm/2,i.worldY+i.heightMm,o.worldX+o.widthMm/2,o.worldY)}let r=new Float32Array(a);if(!r.length)return null;let s=this.device.createBuffer({size:r.byteLength,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST});return this.device.queue.writeBuffer(s,0,r),{buffer:s,count:r.length/2}}resize(){let e=Math.min(devicePixelRatio||1,2),a=Math.max(1,Math.floor(this.canvas.clientWidth*e)),r=Math.max(1,Math.floor(this.canvas.clientHeight*e));(this.canvas.width!==a||this.canvas.height!==r)&&(this.canvas.width=a,this.canvas.height=r),this.flowCanvas&&(this.flowCanvas.width!==a||this.flowCanvas.height!==r)&&(this.flowCanvas.width=a,this.flowCanvas.height=r)}setFlowOverlayCanvas(e){e&&(this.flowCanvas=e,this.flowContext=e.getContext("webgpu"),this.flowContext.configure({device:this.device,format:this.format,alphaMode:"premultiplied"}))}writeGlobals(){let e=this.globalUniformScratch;e[0]=this.center[0],e[1]=this.center[1],e[2]=this.scale,e[3]=performance.now()*.001,e[4]=this.canvas.width,e[5]=this.canvas.height,this.device.queue.writeBuffer(this.globalBuffer,0,e)}pagePixelWidth(e){return e.widthMm/this.scale}pageSourcePixelsPerMm(e){let a=this.pagePixelWidth(e)/Math.max(1,e.sourceWidthMm||e.widthMm),r=e.heightMm/this.scale/Math.max(1,e.sourceHeightMm||e.heightMm);return Math.min(a,r)}pageNativeDetailThresholds(e){let a=this.nativeDetailThresholds.get(e.id);if(a)return a;let r=Math.max(1,e.sourceWidthMm||e.widthMm),s=Math.max(1,e.sourceHeightMm||e.heightMm),n=r*s,i=Math.max(0,e.featureCount||e.featureIds?.length||0)/Math.max(1,n),o=de(1-i*72,.84,1.08),c=de(Math.sqrt(Math.max(r,s)/Math.max(1,Math.min(r,s)))/1.18,.92,1.14),l=de(a0*o*c,5,7.4),f={enter:l,exit:de(Math.min(l-1.2,r0*o),3.8,l-.7),prefetch:de(Math.min(l-2,s0*o),3,l-1)};return this.nativeDetailThresholds.set(e.id,f),f}pageWantsNativeDetail(e){if(!this.pageHasNativeDetail(e))return!1;let a=this.pageSourcePixelsPerMm(e),r=this.nativeDetailState.get(e.id)===!0,s=this.pageNativeDetailThresholds(e),n=r?s.exit:s.enter,i=a>=n;return i!==r&&this.nativeDetailState.set(e.id,i),i}pageNativeDetailReady(e){if(this.domDetailPageIds.has(e.id)||!this.pageWantsNativeDetail(e))return!1;let a=this.vectorChunks.get(e.id);return!a?.loaded||!a.segments?.length&&!a.fills?.length?!1:this.visibleNativeImagesReady(e,a)}visibleNativeImagesReady(e,a){if(!a?.images?.length)return!0;let r=this.sourceViewportBounds(e,4),s=!0;for(let n of a.images){if(!yt(n.bounds,r))continue;(this.imageResources.get(n.path)||this.createImageResource(n.path)).loaded||(s=!1,this.loadImageTexture(n.path).catch(()=>{}))}return s}visiblePages(){let e=this.canvas.width*this.scale/2,a=this.canvas.height*this.scale/2,r=this.center[0]-e,s=this.center[0]+e,n=this.center[1]-a,i=this.center[1]+a;return this.pages.filter(o=>o.worldX+o.widthMm>=r&&o.worldX<=s&&o.worldY+o.heightMm>=n&&o.worldY<=i)}worldViewportBounds(e=0){let a=this.canvas.width*this.scale/2,r=this.canvas.height*this.scale/2;return[this.center[0]-a-e,this.center[1]-r-e,this.center[0]+a+e,this.center[1]+r+e]}sourceViewportBounds(e,a=2.5){let r=this.worldViewportBounds(this.scale*8),s=(r[0]-e.worldX)/e.widthMm*e.sourceWidthMm-a,n=(r[1]-e.worldY)/e.heightMm*e.sourceHeightMm-a,i=(r[2]-e.worldX)/e.widthMm*e.sourceWidthMm+a,o=(r[3]-e.worldY)/e.heightMm*e.sourceHeightMm+a;return[Math.max(-a,Math.min(s,i)),Math.max(-a,Math.min(n,o)),Math.min(e.sourceWidthMm+a,Math.max(s,i)),Math.min(e.sourceHeightMm+a,Math.max(n,o))]}render(){this.frameSerial+=1,this.resize(),this.writeGlobals();let e=this.visiblePages(),a=this.device.createCommandEncoder(),r=a.beginRenderPass({colorAttachments:[{view:this.context.getCurrentTexture().createView(),clearValue:{r:.045,g:.055,b:.073,a:1},loadOp:"clear",storeOp:"store"}]});this.showHierarchy&&this.edgeBuffer&&(r.setPipeline(this.edgePipeline),r.setBindGroup(0,this.edgeBindGroup),r.setVertexBuffer(0,this.edgeBuffer.buffer),r.draw(this.edgeBuffer.count)),r.setPipeline(this.pagePipeline);for(let i of e){let o=this.pageResources.get(i.id),c=this.activeNetUid&&i.netUids.includes(this.activeNetUid),l=this.domDetailPageIds.has(i.id),f=!l&&this.pageNativeDetailReady(i),u=this.pageUniformScratch;u[0]=i.worldX,u[1]=i.worldY,u[2]=i.widthMm,u[3]=i.heightMm,u[4]=i.id===this.selectedPageId?1:0,u[5]=c?1:0,u[6]=this.activeNetUid?1:0,u[7]=f||l?1:0,this.device.queue.writeBuffer(o.uniform,0,u),r.setBindGroup(0,o.bindGroup),r.draw(6);let g=de(Math.ceil(this.pagePixelWidth(i)*1.3/512)*512,512,6144);o.textureWidth<g*.82&&this.loadPageTexture(i,g).catch(()=>{})}this.scheduleVisibleVectorLoads(e),this.drawVisibleImages(r,e),this.drawVisibleVectors(r,e);let s=this.writeNetTrackingOverlay();s&&!this.flowContext&&(r.setPipeline(this.netFlowPipeline),r.setBindGroup(0,this.edgeBindGroup),r.setVertexBuffer(0,this.netFlowBuffer),r.draw(s));let n=this.writeNetHighlights(e);return n&&(r.setPipeline(this.highlightPipeline),r.setBindGroup(0,this.edgeBindGroup),r.setVertexBuffer(0,this.highlightBuffer),r.draw(n)),r.end(),this.device.queue.submit([a.finish()]),this.renderFlowOverlay(s),this.evictVectorChunks(e),e}renderFlowOverlay(e){if(!this.flowContext)return;let a=this.device.createCommandEncoder(),r=a.beginRenderPass({colorAttachments:[{view:this.flowContext.getCurrentTexture().createView(),clearValue:{r:0,g:0,b:0,a:0},loadOp:"clear",storeOp:"store"}]});e&&(r.setPipeline(this.netFlowPipeline),r.setBindGroup(0,this.edgeBindGroup),r.setVertexBuffer(0,this.netFlowBuffer),r.draw(e)),r.end(),this.device.queue.submit([a.finish()])}drawVisibleImages(e,a){if(!this.isNativeScene)return;let r=!1;for(let s of a){if(this.domDetailPageIds.has(s.id)||!this.pageNativeDetailReady(s))continue;let n=this.vectorChunks.get(s.id);if(!n?.images?.length)continue;let i=this.sourceViewportBounds(s,4);for(let o of n.images){if(!yt(o.bounds,i))continue;let c=this.imageResources.get(o.path)||this.createImageResource(o.path);c.loaded||this.loadImageTexture(o.path).catch(()=>{});let l=o.worldOrigin||this.sourceToWorld(s,[o.xMm,o.yMm]),f=o.worldSize||this.sourceSizeToWorld(s,o.widthMm,o.heightMm),u=this.imageUniformScratch;u[0]=l[0],u[1]=l[1],u[2]=f[0],u[3]=f[1],u[4]=0,u[5]=0,u[6]=0,u[7]=0,this.device.queue.writeBuffer(c.uniform,0,u),r||(e.setPipeline(this.imagePipeline),r=!0),e.setBindGroup(0,c.bindGroup),e.draw(6)}}}drawVisibleVectors(e,a){if(!this.isNativeScene)return 0;let r=this.vectorScratch,s=0,n=0,i=0,o=0,c=!1,l=()=>{if(!s)return;let u=this.vectorBuffers[o];u||(u=this.device.createBuffer({size:ms*4,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST}),this.vectorBuffers.push(u)),this.device.queue.writeBuffer(u,0,r,0,s),c||(e.setPipeline(this.vectorPipeline),e.setBindGroup(0,this.edgeBindGroup),c=!0);let g=Math.floor(s/6);e.setVertexBuffer(0,u),e.draw(g),i+=g,o+=1,s=0},f=u=>u>Nd||u>r.length?(n+=1,!1):((s+u>Nd||s+u>r.length)&&l(),!0);for(let u of a){if(this.domDetailPageIds.has(u.id)||!this.pageHasNativeDetail(u))continue;let g=this.vectorChunks.get(u.id);if(!g?.segments?.length&&!g?.fills?.length||!this.pageNativeDetailReady(u))continue;g.lastUsedFrame=this.frameSerial;let p=this.sourceViewportBounds(u),h=Pd(g.spatial,p);for(let d of h.fills){if(!yt(d.bounds,p)||!f(18))continue;let m=this.featuresById.get(d.featureId),b=this.activeNetUid&&m?.netUid===this.activeNetUid,x=this.selectedFeatureId===d.featureId?[.24,.58,1,1]:b?[.06,1,.24,1]:this.activeNetUid&&Qa(m)?Ud(m,d.kind,d.color):Oi(m,d.kind,d.color),v=d.worldPoints||d.points.map(M=>this.sourceToWorld(u,M));s=A0(r,s,v[0],v[1],v[2],x)}for(let d of h.segments){if(!yt(d.bounds,p))continue;let m=this.featuresById.get(d.featureId),b=this.activeNetUid&&m?.netUid===this.activeNetUid,y=this.selectedFeatureId===d.featureId,x=y?[.24,.58,1,1]:b?[.06,1,.24,1]:this.activeNetUid&&Qa(m)?Ud(m,d.kind,d.color):Oi(m,d.kind,d.color),v=this.segmentWorldWidth(u,d,m,b||y);for(let M of this.visibleSegmentParts(u,d,m)){if(!f(36))continue;let S=M.worldA||this.sourceToWorld(u,M.a),A=M.worldB||this.sourceToWorld(u,M.b);s=T0(r,s,S,A,v,x)}}}return l(),this.truncatedVectorCount=n,this.vectorTruncated=n>0,this.lastVectorVertices=i,this.lastVectorChunks=o,i}pageHasNativeDetail(e){return this.isNativeScene?e?.nativeDetail?.enabled!==!1:!1}scheduleVisibleVectorLoads(e){if(!this.isNativeScene)return;let a=[...this.vectorChunks.values()].filter(n=>n?.promise&&!n.loaded).length,r=Math.max(0,c0-a);if(!r)return;let s=e.filter(n=>!this.domDetailPageIds.has(n.id)).filter(n=>this.pageHasNativeDetail(n)&&this.pageSourcePixelsPerMm(n)>=this.pageNativeDetailThresholds(n).prefetch).filter(n=>!this.vectorChunks.get(n.id)?.loaded&&!this.vectorChunks.get(n.id)?.promise).sort((n,i)=>{let o=Math.hypot(n.worldX+n.widthMm/2-this.center[0],n.worldY+n.heightMm/2-this.center[1]),c=Math.hypot(i.worldX+i.widthMm/2-this.center[0],i.worldY+i.heightMm/2-this.center[1]);return o-c});for(let n of s)if(this.loadPageVectors(n).catch(()=>{}),r-=1,!r)break}featurePrimitiveBounds(e,a){let r=this.vectorChunks.get(e.id);if(!r?.segments?.length&&!r?.fills?.length)return null;let s=[],n=[];for(let i of r.segments||[])i.featureId===a&&(s.push(i.a[0],i.b[0]),n.push(i.a[1],i.b[1]));for(let i of r.fills||[])if(i.featureId===a)for(let o of i.points||[])s.push(o[0]),n.push(o[1]);return s.length?[Math.min(...s),Math.min(...n),Math.max(...s),Math.max(...n)]:null}symbolClipBounds(e){if(this._symbolClipBounds||(this._symbolClipBounds=new Map),this._symbolClipBounds.has(e.id))return this._symbolClipBounds.get(e.id);let a=(this.featuresByPage[e.id]||[]).filter(r=>r?.kind==="symbol_body"&&r.boundsMm&&!String(r.sourceId||"").includes(":overplot")).map(r=>{let s=this.featurePrimitiveBounds(e,r.id)||r.boundsMm;return[s[0]-.02,s[1]-.02,s[2]+.02,s[3]+.02]}).filter(r=>{let s=r[2]-r[0],n=r[3]-r[1];return Math.max(s,n)<=12&&s*n<=80});return this._symbolClipBounds.set(e.id,a),a}visibleSegmentParts(e,a,r){if(a._visibleParts)return a._visibleParts;let s=String(r?.kind||""),n=String(r?.semanticRole||"");if(s!=="wire"&&n!=="wire")return a._visibleParts=[a],a._visibleParts;let i=[a];for(let o of this.symbolClipBounds(e)){let c=[];for(let l of i)c.push(...R0(l,o));if(i=c,!i.length)break}for(let o of i)o.worldA=ka(e,o.a),o.worldB=ka(e,o.b);return a._visibleParts=i,a._visibleParts}netTrackingSegments(){if(!this.activeNetUid)return{netUid:"",anchorsByPage:new Map,segments:[],intrasheetSegments:[]};let e=Number(this.selectedFeatureId||0),a=String(this.selectedFeatureKey||""),r=String(this.selectedSourceId||"");if(this.netTrackingCache?.netUid===this.activeNetUid&&this.netTrackingCache?.selectedFeatureId===e&&this.netTrackingCache?.selectedFeatureKey===a&&this.netTrackingCache?.selectedSourceId===r)return this.netTrackingCache;this.selectedIntrasheetLinkIndex=-1;let s=new Map(this.pages.map(h=>[h.id,h])),n=this.manifest.netToPages?.[this.activeNetUid]||[],i=n.length?n.map(h=>s.get(h)).filter(Boolean):this.pages.filter(h=>h.netUids?.includes(this.activeNetUid)),o=new Map;for(let h of i.slice(0,i0)){let d=this.netTrackingAnchorsForPage(h);d.length&&o.set(h.id,d)}let c=[],l=[];for(let[h,d]of o){let m=Ld(k0(d),"intrasheet",h);c.push(...m),l.push(...m)}let f=[...o.entries()].map(([h,d])=>E0(s.get(h),d,{featureId:e,stableKey:a,sourceId:r})).filter(Boolean);c.push(...Ld(f,"intersheet",""));let u=l.map((h,d)=>({...h,intrasheetIndex:d})),g=0,p=c.map((h,d)=>{if(h.type!=="intrasheet")return{...h,id:d};let m=g;return g+=1,{...h,id:d,intrasheetIndex:m}});return this.netTrackingCache={netUid:this.activeNetUid,selectedFeatureId:e,selectedFeatureKey:a,selectedSourceId:r,anchorsByPage:o,segments:p,intrasheetSegments:u},this.selectedIntrasheetLinkIndex>=this.netTrackingCache.intrasheetSegments.length&&(this.selectedIntrasheetLinkIndex=-1),this.netTrackingCache}netTrackingAnchorsForPage(e){let a=this.featuresByPage[e.id]||[],r=[];for(let s of a){if(s.netUid!==this.activeNetUid||!s.boundsMm||!w0(s))continue;let n=s.boundsMm,i=[(n[0]+n[2])/2,(n[1]+n[3])/2],o=this.sourceToWorld(e,i);r.push({pageId:e.id,featureId:Number(s.id||0),stableKey:String(s.stableKey||""),sourceId:String(s.sourceId||s.sourceUid||s.objectId||""),kind:s.kind||s.semanticRole||"",source:i,world:o,bounds:n,priority:v0(s)})}return r.sort((s,n)=>n.priority-s.priority||s.source[1]-n.source[1]||s.source[0]-n.source[0]),r}writeNetTrackingOverlay(){let e=this.netTrackingSegments();if(this.lastNetFlowSegments=e.segments.length,this.lastNetFlowIntrasheetSegments=e.intrasheetSegments.length,!e.segments.length)return this.lastNetFlowVertices=0,0;let a=this.worldViewportBounds(this.scale*96),r=this.netFlowScratch,s=0,n=0;for(let i of e.segments){if(!yt(Dd(i),a))continue;let o=i.type==="intrasheet"&&i.intrasheetIndex===this.selectedIntrasheetLinkIndex,c=o?9.5:i.type==="intersheet"?8:4.8,l=o?2:i.type==="intersheet"?1:0,f=_0(r,s,i.a,i.b,c*this.scale,l,n,this.scale);if(f!==s&&(s=f,n+=Math.hypot(i.b[0]-i.a[0],i.b[1]-i.a[1])/Math.max(this.scale,1e-6),s+24>r.length))break}return s?(this.device.queue.writeBuffer(this.netFlowBuffer,0,r,0,s),this.lastNetFlowVertices=s/4,s/4):(this.lastNetFlowVertices=0,0)}cycleNetIntrasheetLink(e=1){let a=this.netTrackingSegments();if(!a.intrasheetSegments.length)return null;let r=a.intrasheetSegments.length;this.selectedIntrasheetLinkIndex=(this.selectedIntrasheetLinkIndex+e+r)%r;let s=a.intrasheetSegments[this.selectedIntrasheetLinkIndex];if(!s)return null;let n=Dd(s,14*this.scale);return this.center=[(n[0]+n[2])/2,(n[1]+n[3])/2],this.scale=Math.max((n[2]-n[0])/Math.max(1,this.canvas.width*.36),(n[3]-n[1])/Math.max(1,this.canvas.height*.3),this.scale*.35,.025),{pageId:s.pageId,segment:s}}writeNetHighlights(e){if(!this.activeNetUid)return 0;let a=this.highlightScratch,r=0,s=0;for(let n of e){let i=this.sourceViewportBounds(n,5);for(let o of this.featuresByPage[n.id]||[]){if(o.netUid!==this.activeNetUid||!o.boundsMm||!yt(o.boundsMm,i))continue;let c=this.featureWorldBounds(n,o.boundsMm);if(r+16>a.length){s+=1;continue}a[r++]=c[0],a[r++]=c[1],a[r++]=c[2],a[r++]=c[1],a[r++]=c[2],a[r++]=c[1],a[r++]=c[2],a[r++]=c[3],a[r++]=c[2],a[r++]=c[3],a[r++]=c[0],a[r++]=c[3],a[r++]=c[0],a[r++]=c[3],a[r++]=c[0],a[r++]=c[1]}}return this.truncatedHighlightCount=s,r?(this.device.queue.writeBuffer(this.highlightBuffer,0,a,0,r),r/2):0}featureWorldBounds(e,a){return[e.worldX+a[0]/e.sourceWidthMm*e.widthMm,e.worldY+a[1]/e.sourceHeightMm*e.heightMm,e.worldX+a[2]/e.sourceWidthMm*e.widthMm,e.worldY+a[3]/e.sourceHeightMm*e.heightMm]}sourceToWorld(e,a){return[e.worldX+a[0]/e.sourceWidthMm*e.widthMm,e.worldY+a[1]/e.sourceHeightMm*e.heightMm]}sourceSizeToWorld(e,a,r){return[a/e.sourceWidthMm*e.widthMm,r/e.sourceHeightMm*e.heightMm]}async loadPageVectors(e){if(!this.pageHasNativeDetail(e)||!e.chunks?.lod2)return null;let a=this.vectorChunks.get(e.id);if(a?.loaded)return a;if(a?.promise)return a.promise;let r=(async()=>{try{let s=await fetch(new URL(e.chunks.lod2,this.manifestUrl));if(!s.ok)throw new Error(`Failed to load schematic vector chunk ${e.id}: ${s.status}`);let n=await s.json(),i=u0(n.primitives||[]);f0(e,i);let c=JSON.stringify(n).length,l={loaded:!0,segments:i.segments,fills:i.fills,images:i.images,spatial:x0(i),unsupported:n.unsupported||[],bytes:c,lastUsedFrame:this.frameSerial};return this.vectorChunks.set(e.id,l),this.failedVectorChunks.delete(e.id),this.residentVectorBytes+=c,l}catch(s){let n=this.failedVectorChunks.get(e.id)||{count:0,message:""};throw this.failedVectorChunks.set(e.id,{count:n.count+1,message:s?.message||String(s)}),this.vectorChunks.delete(e.id),s}})();return this.vectorChunks.set(e.id,{loaded:!1,promise:r,segments:[]}),r}evictVectorChunks(e){if(this.residentVectorBytes<=Od)return;let a=new Set(e.map(s=>s.id)),r=[...this.vectorChunks.entries()].filter(([,s])=>s?.loaded).filter(([s])=>!a.has(s)&&s!==this.selectedPageId).sort((s,n)=>(s[1].lastUsedFrame||0)-(n[1].lastUsedFrame||0));for(let[s,n]of r)if(this.vectorChunks.delete(s),this.residentVectorBytes=Math.max(0,this.residentVectorBytes-(n.bytes||0)),this.residentVectorBytes<=Od*.82)break}stats(){let e=this.visiblePages(),a=e.map(s=>this.pageSourcePixelsPerMm(s)),r=e.map(s=>this.pageNativeDetailThresholds(s).enter);return{residentVectorBytes:this.residentVectorBytes,vectorChunks:[...this.vectorChunks.values()].filter(s=>s?.loaded).length,vectorLoads:[...this.vectorChunks.values()].filter(s=>s?.promise&&!s.loaded).length,failedVectorChunks:this.failedVectorChunks.size,vectorVertices:this.lastVectorVertices||0,vectorDrawChunks:this.lastVectorChunks||0,truncatedVectors:this.truncatedVectorCount||0,nativeDetailPages:[...this.nativeDetailState.values()].filter(Boolean).length,nativePxPerMm:Number((Math.max(0,...a)||0).toFixed(2)),nativeThresholdPxPerMm:Number((r.length?Math.min(...r):0).toFixed(2)),domDetailPages:this.domDetailPageIds.size,netFlowSegments:this.lastNetFlowSegments||0,netFlowIntrasheetSegments:this.lastNetFlowIntrasheetSegments||0,netFlowVertices:this.lastNetFlowVertices||0}}setDomDetailPageIds(e){this.domDetailPageIds=new Set(e||[])}async loadPageTexture(e,a){let r=`${e.id}:${a}`;if(this.loading.has(r))return this.loading.get(r);let s=this.pageResources.get(e.id);if(!s||s.textureWidth>=a)return;let n=(async()=>{if(!s.svgBlob){let c=await fetch(new URL(l0(e),this.manifestUrl));if(!c.ok)throw new Error(`Failed to load schematic page ${e.name}: ${c.status}`);s.svgBlob=await c.blob(),this.downloadedBytes+=s.svgBlob.size}let i=s.svgBlob,o=URL.createObjectURL(i);try{let c=new Image;if(c.decoding="async",c.src=o,await c.decode(),s.textureWidth>=a)return;let l=Math.max(64,Math.round(a*e.heightMm/e.widthMm)),f=new OffscreenCanvas(a,l),u=f.getContext("2d",{alpha:!1});u.fillStyle="#ffffff",u.fillRect(0,0,a,l),u.drawImage(c,0,0,a,l);let g=await createImageBitmap(f),p=this.device.createTexture({size:[a,l],format:"rgba8unorm-srgb",usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST|GPUTextureUsage.RENDER_ATTACHMENT});this.device.queue.copyExternalImageToTexture({source:g},{texture:p},[a,l]),g.close(),s.texture!==this.placeholder&&s.texture.destroy(),s.texture=p,s.textureWidth=a,this.updateBindGroup(s)}finally{URL.revokeObjectURL(o),this.loading.delete(r)}})();return this.loading.set(r,n),n}preloadOverview(){let e=[...this.pages],a=async()=>{for(;e.length;){let r=e.shift();await this.loadPageTexture(r,512).catch(()=>{})}};return Promise.all(Array.from({length:Math.min(4,e.length)},a))}screenToWorld(e,a){let r=this.canvas.getBoundingClientRect(),s=(e-r.left)*this.canvas.width/r.width,n=(a-r.top)*this.canvas.height/r.height;return[this.center[0]+(s-this.canvas.width/2)*this.scale,this.center[1]+(n-this.canvas.height/2)*this.scale]}worldToScreen(e,a){let r=this.canvas.clientWidth/this.canvas.width,s=this.canvas.clientHeight/this.canvas.height;return[((e-this.center[0])/this.scale+this.canvas.width/2)*r,((a-this.center[1])/this.scale+this.canvas.height/2)*s]}hitPage(e,a){let[r,s]=this.screenToWorld(e,a);return[...this.pages].reverse().find(n=>r>=n.worldX&&r<=n.worldX+n.widthMm&&s>=n.worldY&&s<=n.worldY+n.heightMm)||null}async pickFeature(e,a){if(!this.isNativeScene)return this.hitFeature(e,a);let r=this.hitPage(e,a);if(!r)return null;if(!this.pageHasNativeDetail(r))return this.hitFeature(e,a);await this.loadPageVectors(r);let s=await this.gpuPickFeature(r,e,a);return s&&!Ja(s)?{page:r,feature:s,source:this.clientToSource(r,e,a),native:!0,gpu:!0}:this.hitFeature(e,a)}hitFeature(e,a){let r=this.hitPage(e,a);if(!r)return null;let[s,n]=this.clientToSource(r,e,a),i=Math.max(.45,5*this.scale*this.canvas.width/Math.max(1,this.canvas.clientWidth)*r.sourceWidthMm/r.widthMm),o=this.hitResidentVectorFeature(r,s,n,i);if(o)return{page:r,feature:o,source:[s,n],native:!0};let c=this.hitSymbolInterior(r,s,n);if(c)return{page:r,feature:c,source:[s,n],native:!0,interior:!0};let l=(this.featuresByPage[r.id]||[]).filter(f=>{if(Ja(f))return!1;let u=f.boundsMm;return u&&s>=u[0]-i&&s<=u[2]+i&&n>=u[1]-i&&n<=u[3]+i}).map(f=>({feature:f,priority:Ya(f),area:Math.max(1e-4,(f.boundsMm[2]-f.boundsMm[0])*(f.boundsMm[3]-f.boundsMm[1]))})).sort((f,u)=>u.priority-f.priority||f.area-u.area);return{page:r,feature:l[0]?.feature||null,source:[s,n]}}hitSymbolInterior(e,a,r){let s=null;for(let n of this.featuresByPage[e.id]||[]){let i=String(n?.kind||"");if(i!=="symbol_body"&&i!=="symbol_instance"||String(n?.sourceId||"").includes(":overplot"))continue;let o=n.boundsMm;if(!o||a<o[0]||a>o[2]||r<o[1]||r>o[3])continue;let c=Math.max(1e-4,(o[2]-o[0])*(o[3]-o[1])),l=(i==="symbol_body"?0:1e6)+c;(!s||l<s.score)&&(s={feature:n,score:l})}return s?.feature||null}clientToSource(e,a,r){let[s,n]=this.screenToWorld(a,r);return[(s-e.worldX)/e.widthMm*e.sourceWidthMm,(n-e.worldY)/e.heightMm*e.sourceHeightMm]}ensurePickTexture(){this.pickTexture&&this.pickTextureSize[0]===this.canvas.width&&this.pickTextureSize[1]===this.canvas.height||(this.pickTexture&&this.pickTexture.destroy(),this.pickTexture=this.device.createTexture({size:[this.canvas.width,this.canvas.height],format:"r32uint",usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.COPY_SRC}),this.pickTextureSize=[this.canvas.width,this.canvas.height])}writePickVectors(e){let a=new ArrayBuffer(gs*12),r=new DataView(a),s=0,n=[];for(let i of e){let o=this.vectorChunks.get(i.id);if(!o?.segments?.length&&!o?.fills?.length&&!o?.images?.length)continue;let c=this._pickSourcePointByPage?.get(i.id),l=c?[c[0]-2.5,c[1]-2.5,c[0]+2.5,c[1]+2.5]:[0,0,i.sourceWidthMm,i.sourceHeightMm],f=Pd(o.spatial,l);for(let u of f.images){if(!yt(u.bounds,l))continue;let g=this.featuresById.get(u.featureId);!g||Ja(g)||n.push({page:i,image:u,feature:g,priority:Ya(g)-5})}for(let u of f.fills){if(!yt(u.bounds,l))continue;let g=this.featuresById.get(u.featureId);!g||Ja(g)||n.push({page:i,fill:u,feature:g,priority:Ya(g)-2})}for(let u of f.segments){if(!yt(u.bounds,l))continue;let g=this.featuresById.get(u.featureId);!g||Ja(g)||n.push({page:i,segment:u,feature:g,priority:Ya(g)})}}n.sort((i,o)=>i.priority-o.priority);for(let{page:i,segment:o,fill:c,image:l,feature:f}of n){if(s+6>gs)break;if(l){let u=this.sourceToWorld(i,[l.xMm,l.yMm]),g=this.sourceToWorld(i,[l.xMm+l.widthMm,l.yMm]),p=this.sourceToWorld(i,[l.xMm,l.yMm+l.heightMm]),h=this.sourceToWorld(i,[l.xMm+l.widthMm,l.yMm+l.heightMm]);s=Bi(r,s,u,g,p,l.featureId),s=Bi(r,s,p,g,h,l.featureId)}else if(c){let u=c.worldPoints||c.points.map(g=>this.sourceToWorld(i,g));s=Bi(r,s,u[0],u[1],u[2],c.featureId)}else{let u=Math.max(this.segmentWorldWidth(i,o,f,!1),this.scale*7);for(let g of this.visibleSegmentParts(i,o,f)){if(s+6>gs)break;let p=g.worldA||this.sourceToWorld(i,g.a),h=g.worldB||this.sourceToWorld(i,g.b);s=N0(r,s,p,h,u,o.featureId)}}}return s?(this.device.queue.writeBuffer(this.pickVertexBuffer,0,a,0,s*12),s):0}async gpuPickFeature(e,a,r){if(this.pickPending)return null;let s=this.clientToSource(e,a,r);this._pickSourcePointByPage=new Map([[e.id,s]]);let n=this.writePickVectors([e]);if(this._pickSourcePointByPage=null,!n)return null;this.resize(),this.writeGlobals(),this.ensurePickTexture();let i=this.canvas.getBoundingClientRect(),o=Math.max(0,Math.min(this.canvas.width-1,Math.floor((a-i.left)*this.canvas.width/i.width))),c=Math.max(0,Math.min(this.canvas.height-1,Math.floor((r-i.top)*this.canvas.height/i.height))),l=this.device.createCommandEncoder(),f=l.beginRenderPass({colorAttachments:[{view:this.pickTexture.createView(),clearValue:{r:0,g:0,b:0,a:0},loadOp:"clear",storeOp:"store"}]});f.setPipeline(this.pickPipeline),f.setBindGroup(0,this.edgeBindGroup),f.setVertexBuffer(0,this.pickVertexBuffer),f.draw(n),f.end(),l.copyTextureToBuffer({texture:this.pickTexture,origin:{x:o,y:c}},{buffer:this.pickReadBuffer,bytesPerRow:256,rowsPerImage:1},{width:1,height:1,depthOrArrayLayers:1}),this.pickPending=!0,this.device.queue.submit([l.finish()]);try{await this.pickReadBuffer.mapAsync(GPUMapMode.READ);let u=new DataView(this.pickReadBuffer.getMappedRange()).getUint32(0,!0);return this.pickReadBuffer.unmap(),u&&this.featuresById.get(u)||null}finally{this.pickReadBuffer.mapState==="mapped"&&this.pickReadBuffer.unmap(),this.pickPending=!1}}hitResidentVectorFeature(e,a,r,s){if(!this.isNativeScene)return null;let n=this.vectorChunks.get(e.id);if(!n?.loaded)return null;let i=null;for(let o of n.segments){let c=this.featuresById.get(o.featureId),l=Math.max(s,(o.widthMm||0)*.5+s*.45);if(c)for(let f of this.visibleSegmentParts(e,o,c)){let u=I0([a,r],f.a,f.b);if(u>l)continue;let g=u-Ya(c)*.025+(Qa(c)?0:8);(!i||g<i.score)&&(i={feature:c,score:g})}}return i?.feature||null}segmentWorldWidth(e,a,r,s){let n=(a.widthMm||.15)/Math.max(1,e.sourceWidthMm)*e.widthMm;return Math.max(n,this.scale*S0(r,a.kind,s))}pan(e,a){let r=this.canvas.width/Math.max(1,this.canvas.clientWidth);this.center[0]-=e*this.scale*r,this.center[1]-=a*this.scale*r}zoom(e,a,r){let s=this.screenToWorld(a,r);this.scale=de(this.scale*Math.exp(e*.0015),.015,16);let n=this.screenToWorld(a,r);this.center[0]+=s[0]-n[0],this.center[1]+=s[1]-n[1]}framePage(e){e&&(this.resize(),this.center=[e.worldX+e.widthMm/2,e.worldY+e.heightMm/2],this.scale=Math.max(e.widthMm/Math.max(1,this.canvas.width*.88),e.heightMm/Math.max(1,this.canvas.height*.84)))}frameWorld(){this.resize(),this.center=[(this.world.minX+this.world.maxX)/2,(this.world.minY+this.world.maxY)/2],this.scale=Math.max((this.world.maxX-this.world.minX)/Math.max(1,this.canvas.width*.9),(this.world.maxY-this.world.minY)/Math.max(1,this.canvas.height*.88),.05)}};function l0(t){return t.thumbnail?.path||t.svg}function d0(t){if(t.schema==="prism.schematic_vector_a0.features"){let e=new Map((t.features||[]).map(r=>[Number(r.id),r])),a={};for(let[r,s]of Object.entries(t.pages||{}))a[r]=s.map(n=>e.get(Number(n))).filter(Boolean);return a}return t.pages||{}}function u0(t){let e=[],a=[],r=[];for(let s of t){let n=Number(s.featureId||0);if(!n)continue;if(s.kind==="plotimage"&&s.image?.path){let y=s.xMm||0,x=s.yMm||0,v=s.widthMm||0,M=s.heightMm||0;r.push({featureId:n,kind:s.kind,xMm:y,yMm:x,widthMm:v,heightMm:M,bounds:[y,x,y+v,x+M],path:s.image.path});continue}let i=String(s.semanticRole||""),o=s.radiusMm||s.diameterMm/2||0,c=String(s.fill||"").toUpperCase()==="FILLED_SHAPE",l=s.widthMm||s.pen_widthMm||(i==="junction"?.08:.15),f=String(s.lineStyle||s.line_style||"DEFAULT").toUpperCase(),u=s.color||s.strokeColor||s.style?.color||"",g=s.fillColor||s.color||s.style?.color||"",p=(y,x)=>m0(e,{featureId:n,kind:s.kind,widthMm:l,lineStyle:f,color:u},y,x),h=s.x1Mm,d=s.y1Mm,m=s.x2Mm,b=s.y2Mm;if(s.trianglesMm?.length){for(let y of s.trianglesMm)Array.isArray(y)&&y.length===3&&a.push({featureId:n,kind:s.kind,color:g,points:y,bounds:zd(y)});if(s.pointsMm?.length>=2){for(let y=1;y<s.pointsMm.length;y+=1)p(s.pointsMm[y-1],s.pointsMm[y]);jd(s)&&p(s.pointsMm[s.pointsMm.length-1],s.pointsMm[0])}}else if(s.pointsMm?.length>=2){c&&s.pointsMm.length>=3&&g0(a,n,s.kind,s.pointsMm,g);for(let y=1;y<s.pointsMm.length;y+=1)p(s.pointsMm[y-1],s.pointsMm[y]);jd(s)&&p(s.pointsMm[s.pointsMm.length-1],s.pointsMm[0])}else if(s.polylinesMm?.length){for(let y of s.polylinesMm)if(!(!Array.isArray(y)||y.length<2))for(let x=1;x<y.length;x+=1)p(y[x-1],y[x])}else if(Number.isFinite(h)&&Number.isFinite(d)&&Number.isFinite(m)&&Number.isFinite(b))s.kind==="rect"?(c&&b0(a,n,s.kind,[h,d,m,b],g),p([h,d],[m,d]),p([m,d],[m,b]),p([m,b],[h,b]),p([h,b],[h,d])):p([h,d],[m,b]);else if(Number.isFinite(s.cxMm)&&Number.isFinite(s.cyMm)){let y=s.radiusMm||s.diameterMm/2||.4;c&&p0(a,n,s.kind,[s.cxMm,s.cyMm],y,g),y0(e,{featureId:n,kind:s.kind,widthMm:l,lineStyle:f,color:u},[s.cxMm,s.cyMm],y)}else if(s.contoursMm?.length){for(let y of s.contoursMm)if(!(!Array.isArray(y)||y.length<2)){for(let x=1;x<y.length;x+=1)p(y[x-1],y[x]);p(y[y.length-1],y[0])}}else if(Number.isFinite(s.start_xMm)&&Number.isFinite(s.start_yMm)&&Number.isFinite(s.end_xMm)&&Number.isFinite(s.end_yMm))Number.isFinite(s.mid_xMm)&&Number.isFinite(s.mid_yMm)?(p([s.start_xMm,s.start_yMm],[s.mid_xMm,s.mid_yMm]),p([s.mid_xMm,s.mid_yMm],[s.end_xMm,s.end_yMm])):p([s.start_xMm,s.start_yMm],[s.end_xMm,s.end_yMm]);else if(Number.isFinite(s.start_xMm)&&Number.isFinite(s.start_yMm)&&Number.isFinite(s.mid_xMm)&&Number.isFinite(s.mid_yMm)&&Number.isFinite(s.end_xMm)&&Number.isFinite(s.end_yMm))p([s.start_xMm,s.start_yMm],[s.mid_xMm,s.mid_yMm]),p([s.mid_xMm,s.mid_yMm],[s.end_xMm,s.end_yMm]);else if(s.boundsMm&&s.kind!=="text"){let[y,x,v,M]=s.boundsMm;p([y,x],[v,x]),p([v,x],[v,M]),p([v,M],[y,M]),p([y,M],[y,x])}}return{segments:e,fills:a,images:r}}function f0(t,e){for(let a of e.segments||[])a.worldA=ka(t,a.a),a.worldB=ka(t,a.b);for(let a of e.fills||[])a.worldPoints=a.points.map(r=>ka(t,r));for(let a of e.images||[])a.worldOrigin=ka(t,[a.xMm,a.yMm]),a.worldSize=h0(t,a.widthMm,a.heightMm)}function ka(t,e){return[t.worldX+e[0]/t.sourceWidthMm*t.widthMm,t.worldY+e[1]/t.sourceHeightMm*t.heightMm]}function h0(t,e,a){return[e/t.sourceWidthMm*t.widthMm,a/t.sourceHeightMm*t.heightMm]}function b0(t,e,a,r,s){let[n,i,o,c]=r;t.push({featureId:e,kind:a,color:s,points:[[n,i],[o,i],[n,c]],bounds:[n,i,o,c]},{featureId:e,kind:a,color:s,points:[[n,c],[o,i],[o,c]],bounds:[n,i,o,c]})}function p0(t,e,a,r,s,n){for(let o=0;o<36;o+=1){let c=o/36*Math.PI*2,l=(o+1)/36*Math.PI*2;t.push({featureId:e,kind:a,color:n,points:[r,[r[0]+Math.cos(c)*s,r[1]+Math.sin(c)*s],[r[0]+Math.cos(l)*s,r[1]+Math.sin(l)*s]],bounds:[r[0]-s,r[1]-s,r[0]+s,r[1]+s]})}}function g0(t,e,a,r,s){let n=r[0],i=zd(r);for(let o=2;o<r.length;o+=1)t.push({featureId:e,kind:a,color:s,points:[n,r[o-1],r[o]],bounds:i})}function m0(t,e,a,r){let s=Fd(a,r,e.widthMm||.15),n=e.lineStyle||"DEFAULT";if(!["DASH","DASHED","DOT","DOTTED","DASHDOT","DASH_DOT"].includes(n)){t.push({...e,a,b:r,bounds:s});return}let i=r[0]-a[0],o=r[1]-a[1],c=Math.hypot(i,o);if(c<1e-6)return;let l=i/c,f=o/c,u=Math.max(e.widthMm*4,.45),g=n.includes("DOT")?[u*.8,u*.75,u*3,u*.75]:[u*3,u*1.5],p=0,h=0;for(;p<c;){let d=Math.min(g[h%g.length],c-p);if(h%2===0){let m=[a[0]+l*p,a[1]+f*p],b=[a[0]+l*(p+d),a[1]+f*(p+d)];t.push({...e,a:m,b,bounds:Fd(m,b,e.widthMm||.15)})}p+=d,h+=1}}function y0(t,e,a,r){for(let n=0;n<32;n+=1){let i=n/32*Math.PI*2,o=(n+1)/32*Math.PI*2;t.push({...e,a:[a[0]+Math.cos(i)*r,a[1]+Math.sin(i)*r],b:[a[0]+Math.cos(o)*r,a[1]+Math.sin(o)*r],bounds:[a[0]-r,a[1]-r,a[0]+r,a[1]+r]})}}function zd(t,e=0){let a=1/0,r=1/0,s=-1/0,n=-1/0;for(let i of t||[])a=Math.min(a,i[0]),r=Math.min(r,i[1]),s=Math.max(s,i[0]),n=Math.max(n,i[1]);return Number.isFinite(a)?[a-e,r-e,s+e,n+e]:[0,0,0,0]}function Fd(t,e,a=0){let r=Math.max(.05,a*.5);return[Math.min(t[0],e[0])-r,Math.min(t[1],e[1])-r,Math.max(t[0],e[0])+r,Math.max(t[1],e[1])+r]}function yt(t,e){return!t||!e?!0:t[0]<=e[2]&&t[2]>=e[0]&&t[1]<=e[3]&&t[3]>=e[1]}function x0(t){let e={cellSize:o0,cells:new Map,segments:t.segments||[],fills:t.fills||[],images:t.images||[],queryId:0};for(let a of e.segments)Ni(e,"segments",a);for(let a of e.fills)Ni(e,"fills",a);for(let a of e.images)Ni(e,"images",a);return e}function Ni(t,e,a){let r=a.bounds;if(!r)return;let s=Math.floor(r[0]/t.cellSize),n=Math.floor(r[2]/t.cellSize),i=Math.floor(r[1]/t.cellSize),o=Math.floor(r[3]/t.cellSize);for(let c=i;c<=o;c+=1)for(let l=s;l<=n;l+=1){let f=`${l}:${c}`,u=t.cells.get(f);u||(u={segments:[],fills:[],images:[]},t.cells.set(f,u)),u[e].push(a)}}function Pd(t,e){if(!t)return{segments:[],fills:[],images:[]};t.queryId=(t.queryId||0)+1;let a=t.queryId,r={segments:[],fills:[],images:[]},s=Math.floor(e[0]/t.cellSize),n=Math.floor(e[2]/t.cellSize),i=Math.floor(e[1]/t.cellSize),o=Math.floor(e[3]/t.cellSize);for(let c=i;c<=o;c+=1)for(let l=s;l<=n;l+=1){let f=t.cells.get(`${l}:${c}`);f&&(Ci(f.segments,r.segments,a,"segments"),Ci(f.fills,r.fills,a,"fills"),Ci(f.images,r.images,a,"images"))}return r}function Ci(t,e,a,r){let s=`_${r}QueryId`;for(let n of t)n[s]!==a&&(n[s]=a,e.push(n))}function jd(t){let e=String(t.kind||"");if(String(t.fill||"").toUpperCase()==="FILLED_SHAPE"||t.closed===!0||["polygon","fill"].includes(e))return!0;let r=t.pointsMm||[];if(r.length>=3){let s=r[0],n=r[r.length-1];return Math.hypot(s[0]-n[0],s[1]-n[1])<1e-6}return!1}function Qa(t){return!!t?.netUid}function w0(t){let e=String(t?.kind||""),a=String(t?.semanticRole||"");return e==="pin"||e==="pin_body"||e==="label"||e==="global_label"||e==="hierarchical_label"||e==="netclass_flag"||e==="power_symbol"||e==="power_port"||a==="label"||a==="global_label"||a==="hierarchical_label"}function v0(t){let e=String(t?.kind||""),a=String(t?.semanticRole||"");return e==="global_label"||a==="global_label"?130:e==="hierarchical_label"||a==="hierarchical_label"?125:e==="label"||a==="label"?118:e==="pin"||e==="pin_body"?106:e==="power_symbol"||e==="power_port"||e==="netclass_flag"?98:50}function k0(t){if(t.length<=Bd)return t;let e=t.slice(0,Bd);return e.sort((a,r)=>a.source[1]-r.source[1]||a.source[0]-r.source[0]),e}function E0(t,e,a={}){if(!t||!e?.length)return null;let r=a.featureId||a.stableKey||a.sourceId?e.find(l=>a.featureId&&Number(l.featureId||0)===Number(a.featureId)||a.stableKey&&l.stableKey===a.stableKey||a.sourceId&&l.sourceId===a.sourceId):null;if(r)return{...r,kind:"selected-net-occurrence",priority:200};let s=e.filter(l=>l.priority>=118).slice(0,16),n=s.length?s:e.slice(0,16),i=0,o=0;for(let l of n)i+=l.world[0],o+=l.world[1];let c=[i/n.length,o/n.length];return{pageId:t.id,featureId:n[0]?.featureId||0,kind:"page-net-occurrence",source:[0,0],world:c,bounds:[c[0],c[1],c[0],c[1]],priority:1}}function Ld(t,e,a){if(!t||t.length<2)return[];let r=t.map(i=>({...i})).sort((i,o)=>i.world[1]-o.world[1]||i.world[0]-o.world[0]),s=[],n=r.shift();for(;r.length;){let i=0,o=1/0;for(let l=0;l<r.length;l+=1){let f=r[l],u=Math.hypot(f.world[0]-n.world[0],f.world[1]-n.world[1]);u<o&&(o=u,i=l)}let c=r.splice(i,1)[0];s.push({type:e,pageId:a||n.pageId||c.pageId||"",a:n.world,b:c.world,sourceFeatureIds:[n.featureId,c.featureId].filter(Boolean)}),n=c}return s}function Dd(t,e=0){return[Math.min(t.a[0],t.b[0])-e,Math.min(t.a[1],t.b[1])-e,Math.max(t.a[0],t.b[0])+e,Math.max(t.a[1],t.b[1])+e]}function Ya(t){let e=String(t?.kind||""),r=String(t?.semanticRole||"")||e;return r==="pin_number"||r==="pin_name"?120:r==="pin_body"||e==="pin"?110:r==="symbol_reference"||r==="symbol_value"?92:e==="junction"||e==="no_connect"?88:e==="wire"||e==="bus"||e==="bus_entry"?78:r==="symbol_body"||e==="symbol_body"?45:e==="symbol_instance"||e==="symbol_overplot"?30:e==="text"||String(r).includes("text")?24:10}function Ja(t){let e=String(t?.kind||""),a=String(t?.semanticRole||"");if(e==="page"||e==="sheet_header")return!0;if(e==="graphic_rect"&&a==="graphic_rect"&&!t?.netUid&&!t?.componentUid){let r=t.boundsMm||[];return r[2]-r[0]>150&&r[3]-r[1]>120}return!1}function M0(t){if(!t||typeof t!="string")return null;let a=t.trim().match(/^#([0-9a-f]{6})([0-9a-f]{2})?$/i);if(!a)return null;let r=a[1],s=a[2]??"ff";return[parseInt(r.slice(0,2),16)/255,parseInt(r.slice(2,4),16)/255,parseInt(r.slice(4,6),16)/255,parseInt(s,16)/255]}function Oi(t,e,a=""){let r=M0(a||t?.color||"");return t?.kind==="dnp_marker"?r||[.86,.04,.05,.85]:t?.dnp&&["symbol_reference","symbol_value","symbol_text"].includes(String(t?.kind||""))?[.5,.52,.54,.56]:r||(t?.dnp?[.5,.52,.54,.56]:Qa(t)?[.12,.56,.2,.96]:t?.kind==="pin_name"?[0,.28,.31,.96]:t?.kind==="pin_number"?[.45,.17,.16,.96]:t?.kind==="pin_body"?[.28,.18,.18,.88]:t?.kind==="symbol_body"||t?.kind==="symbol_instance"?[.42,.18,.18,.72]:t?.kind==="symbol_reference"||t?.kind==="symbol_value"?[.05,.13,.16,.94]:t?.kind==="text"||String(e||"").startsWith("text")?[.05,.13,.16,.94]:[.16,.17,.19,.7])}function Ud(t,e,a=""){let r=Oi(t,e,a);return[r[0]*.72,r[1]*.72,r[2]*.72,Math.min(r[3],.38)]}function S0(t,e,a){return a?5.5:t?.kind==="dnp_marker"?3:["pin_name","pin_number"].includes(String(t?.kind||""))?1.5:t?.kind==="pin_body"?1.7:String(e||"").startsWith("text")?1.35:e==="bus"||t?.kind==="bus"?4.2:Qa(t)?2.6:t?.kind==="symbol_body"||t?.kind==="symbol_instance"||t?.kind==="sheet"?1.5:1.25}function ys(t,e,a,r){return t[e++]=a[0],t[e++]=a[1],t[e++]=r[0],t[e++]=r[1],t[e++]=r[2],t[e++]=r[3],e}function T0(t,e,a,r,s,n){let i=Gd(a,r,s);if(!i)return e;for(let o of i)e=ys(t,e,o,n);return e}function A0(t,e,a,r,s,n){return e=ys(t,e,a,n),e=ys(t,e,r,n),e=ys(t,e,s,n),e}function va(t,e,a,r,s){return t[e++]=a[0],t[e++]=a[1],t[e++]=r,t[e++]=s,e}function _0(t,e,a,r,s,n,i,o){let c=r[0]-a[0],l=r[1]-a[1],f=Math.hypot(c,l);if(f<1e-6||e+24>t.length)return e;let u=s*.5,g=c/f,h=-(l/f)*u,d=g*u,m=[a[0]+h,a[1]+d],b=[a[0]-h,a[1]-d],y=[r[0]+h,r[1]+d],x=[r[0]-h,r[1]-d],v=i+f/Math.max(o,1e-6);return e=va(t,e,m,i,n),e=va(t,e,b,i,n),e=va(t,e,y,v,n),e=va(t,e,y,v,n),e=va(t,e,b,i,n),e=va(t,e,x,v,n),e}function Gd(t,e,a){let r=e[0]-t[0],s=e[1]-t[1],n=Math.hypot(r,s);if(n<1e-6)return null;let i=a*.5,o=r/n*i,c=s/n*i,l=-s/n*i,f=r/n*i,u=[t[0]-o,t[1]-c],g=[e[0]+o,e[1]+c],p=[u[0]+l,u[1]+f],h=[u[0]-l,u[1]-f],d=[g[0]+l,g[1]+f],m=[g[0]-l,g[1]-f];return[p,h,d,d,h,m]}function I0(t,e,a){let r=a[0]-e[0],s=a[1]-e[1],n=r*r+s*s||1,i=de(((t[0]-e[0])*r+(t[1]-e[1])*s)/n,0,1),o=e[0]+r*i,c=e[1]+s*i;return Math.hypot(t[0]-o,t[1]-c)}function R0(t,e){let[a,r,s,n]=e,[i,o]=t.a,[c,l]=t.b,f=1e-6,u=(g,p)=>({...t,a:g,b:p});if(Math.abs(o-l)<=f){let g=o;if(g<r-f||g>n+f)return[t];let p=Math.min(i,c),h=Math.max(i,c),d=Math.max(p,a),m=Math.min(h,s);if(m<=d+f)return[t];let b=[],y=i<=c;if(p<d-f){let x=y?[p,g]:[d,g],v=y?[d,g]:[p,g];b.push(u(x,v))}if(m<h-f){let x=y?[m,g]:[h,g],v=y?[h,g]:[m,g];b.push(u(x,v))}return b}if(Math.abs(i-c)<=f){let g=i;if(g<a-f||g>s+f)return[t];let p=Math.min(o,l),h=Math.max(o,l),d=Math.max(p,r),m=Math.min(h,n);if(m<=d+f)return[t];let b=[],y=o<=l;if(p<d-f){let x=y?[g,p]:[g,d],v=y?[g,d]:[g,p];b.push(u(x,v))}if(m<h-f){let x=y?[g,m]:[g,h],v=y?[g,h]:[g,m];b.push(u(x,v))}return b}return[t]}function xs(t,e,a,r){let s=e*12;t.setFloat32(s,a[0],!0),t.setFloat32(s+4,a[1],!0),t.setUint32(s+8,r,!0)}function N0(t,e,a,r,s,n){let i=Gd(a,r,s);if(!i)return e;for(let o of i)xs(t,e,o,n),e+=1;return e}function Bi(t,e,a,r,s,n){return xs(t,e,a,n),xs(t,e+1,r,n),xs(t,e+2,s,n),e+3}function C0(t,e){let a=Array.isArray(t?.layerIds)?t.layerIds:[];if(a.length<2&&t?.startLayerId!=null&&t?.endLayerId!=null&&(a=[t.startLayerId,t.endLayerId]),a.length<2&&t?.layerMask!=null)try{let r=BigInt(String(t.layerMask));a=e.filter((s,n)=>(r&1n<<BigInt(n))!==0n).map(s=>s.id)}catch{a=[]}return a}function B0(t){let e=t?.objectFeatureId??t?.id;if(e!=null&&Number.isFinite(Number(e))&&Number(e)!==0)return`feature:${Number(e)}`;let a=String(t?.sourceUid||"");return a?`source:${a}`:""}function Kd(t,e){let a=new Map(t.map((o,c)=>[Number(o.id),c])),r=new Map(t.map(o=>[Number(o.id),o])),s=new Map,n=new Set,i={thru:0,blind:0,buried:0};for(let o of e){let c=B0(o);if(c){if(n.has(c))continue;n.add(c)}let l=[...new Set(C0(o,t).map(Number))].filter(x=>a.has(x)).sort((x,v)=>a.get(x)-a.get(v));if(l.length<2)continue;let f=l[0],u=l[l.length-1],g=a.get(f),p=a.get(u),h=g===0,d=p===t.length-1,m=h&&d?"thru":h||d?"blind":"buried";i[m]+=1;let b=`${f}:${u}:${m}`,y=s.get(b);if(y){y.count+=1;continue}s.set(b,{startId:f,endId:u,startName:r.get(f)?.name||String(f),endName:r.get(u)?.name||String(u),startIndex:g,endIndex:p,type:m,count:1})}return{counts:i,spans:[...s.values()]}}var Za="http://www.w3.org/2000/svg";var O0=new Set(["script","foreignobject","iframe","object","embed"]),F0=new Set(["href","xlink:href"]),P0=1,j0=18,L0=8,Es=class t{static create(e,a,r,s,n={}){return new t(e,a,r,s,n)}constructor(e,a,r,s,n){this.host=e,this.manifestUrl=a,this.manifest=r,this.featuresByPage=s||{},this.callbacks=n,this.activePage=null,this.activeSvgUrl="",this.container=null,this.svg=null,this.overlay=null,this.mountedPages=new Map,this.loadingPages=new Map,this.svgCache=new Map,this.serial=0,this.maxMountedWorldPages=P0,this.maxCachedSvgPages=j0,this.worldHandlersInstalled=!1,this.worldDrag=null,this.view={scale:1,tx:0,ty:0},this.drag=null,this.selected=null,this.highlightedNetUid="",this.index=Wd(),this.lastStats={mountedPages:0,domNodes:0,indexedFeatures:0,indexedNets:0,mountMs:0,coldMounts:0,warmMounts:0,highlightMs:0,selectionMs:0,cachedSvgPages:0,cachedSvgBytes:0,heapMb:null,fallbackReason:""}}get active(){return!!(this.container&&this.activePage)}get worldActive(){return this.mountedPages.size>0}stats(){return{...this.lastStats,activePage:this.activePage?.name||[...this.mountedPages.values()][0]?.page?.name||"-",mountedPages:this.active?1:this.mountedPages.size}}dispose(){this.unmountPage(),this.unmountWorldPages()}unmountPage(){this.container?.remove(),this.container=null,this.svg=null,this.overlay=null,this.activePage=null,this.activeSvgUrl="",this.index=Wd(),this.host.hidden=!0}unmountWorldPages(){for(let e of this.mountedPages.values())e.container.remove();this.mountedPages.clear(),this.loadingPages.clear(),this.active||(this.host.hidden=!0)}async preloadPages(e){let a=performance.now(),r=await Promise.allSettled((e||[]).slice(0,L0).map(s=>this.loadSvgTemplate(s)));this.lastStats.preloadedPages=r.filter(s=>s.status==="fulfilled"&&s.value).length,this.lastStats.preloadMs=performance.now()-a,this.updateCacheStats()}syncWorldPages(e,a,r={}){if(!a)return;this.installWorldHandlers(a);let s=(e||[]).slice(0,r.maxMountedPages||this.maxMountedWorldPages),n=new Set(s.map(i=>i.id));for(let[i,o]of this.mountedPages)n.has(i)||(o.container.remove(),this.mountedPages.delete(i));for(let i of s){let o=this.mountedPages.get(i.id);if(o)o.lastUsed=++this.serial,this.positionWorldEntry(o,a);else if(!this.loadingPages.has(i.id)){let c=this.mountWorldPage(i).then(l=>{l&&n.has(i.id)?this.positionWorldEntry(l,a):l?.container.remove()}).finally(()=>this.loadingPages.delete(i.id));this.loadingPages.set(i.id,c)}}this.pruneMountedWorldPages(n),this.host.hidden=s.length===0&&!this.active,this.setSelection(this.selected),this.setHighlightedNet(r.activeNetUid??this.highlightedNetUid),this.lastStats.mountedPages=this.mountedPages.size,this.updateCacheStats()}async mountWorldPage(e){let a=performance.now(),r=this.hasCachedSvg(e),s=await this.loadImportedSvg(e);if(!s)return null;let n=document.createElement("div");n.className="svg-dom-page svg-dom-world-page",n.dataset.pageId=e.id,n.append(s),this.host.append(n);let i=qd(s),o=Hd(s),c=Vd(s,e,this.featuresByPage[e.id]||[]),l={page:e,container:n,svg:s,overlay:i,selectionOverlay:o,index:c,mountMs:performance.now()-a,lastUsed:++this.serial,warm:r};return this.mountedPages.set(e.id,l),this.lastStats={...this.lastStats,mountedPages:this.mountedPages.size,domNodes:[...this.mountedPages.values()].reduce((f,u)=>f+u.svg.querySelectorAll("*").length,0),indexedFeatures:[...this.mountedPages.values()].reduce((f,u)=>f+u.index.featureToElements.size,0),indexedNets:new Set([...this.mountedPages.values()].flatMap(f=>[...f.index.netToElements.keys()])).size,mountMs:l.mountMs,coldMounts:this.lastStats.coldMounts+(l.warm?0:1),warmMounts:this.lastStats.warmMounts+(l.warm?1:0),fallbackReason:""},this.updateCacheStats(),l}async loadImportedSvg(e){let a=await this.loadSvgTemplate(e);return a?a.cloneNode(!0):null}async loadSvgTemplate(e){let a=this.svgUrlForPage(e),r=this.svgCache.get(a);if(r?.template)return r.lastUsed=++this.serial,r.template;if(r?.promise)return r.promise;let s=performance.now(),n=(async()=>{let i=await fetch(a,{cache:"default"});if(!i.ok)return this.lastStats.fallbackReason=`Failed to load SVG page ${e.id}: ${i.status}`,this.callbacks.onFallback?.(this.lastStats.fallbackReason),null;let o=await i.text(),l=new DOMParser().parseFromString(o,"image/svg+xml"),f=l.documentElement;if(!f||f.localName.toLowerCase()!=="svg"||l.querySelector("parsererror"))return this.lastStats.fallbackReason=`Invalid SVG for page ${e.id}`,this.callbacks.onFallback?.(this.lastStats.fallbackReason),null;D0(l,a,e.id);let u=document.importNode(f,!0);u.classList.add("svg-dom-page-svg"),q0(u);let g=this.svgCache.get(a)||{};return Object.assign(g,{template:u,promise:null,pageId:e.id,byteLength:o.length*2,loadMs:performance.now()-s,lastUsed:++this.serial}),this.svgCache.set(a,g),this.pruneSvgCache(),this.updateCacheStats(),u})();return this.svgCache.set(a,{promise:n,pageId:e.id,byteLength:0,loadMs:0,lastUsed:++this.serial}),n}svgUrlForPage(e){return new URL(e.svg||e.thumbnail?.path,this.manifestUrl).toString()}positionWorldEntry(e,a){let{page:r,container:s}=e,[n,i]=a.worldToScreen(r.worldX,r.worldY),[o,c]=a.worldToScreen(r.worldX+r.widthMm,r.worldY+r.heightMm),l=Math.max(1,o-n),f=Math.max(1,c-i);s.style.transform=`translate3d(${n}px, ${i}px, 0)`,s.style.width=`${l}px`,s.style.height=`${f}px`}installWorldHandlers(e){if(this.worldHandlersInstalled)return;this.worldHandlersInstalled=!0;let a=this.host;a.oncontextmenu=r=>r.preventDefault(),a.onpointerdown=r=>{let s=r.button===0&&!r.shiftKey&&!!r.target.closest?.("text"),i=r.target.closest?.("[data-feature-key]")?null:this.featureAtEvent(r);this.worldDrag={pointerId:r.pointerId,startX:r.clientX,startY:r.clientY,lastX:r.clientX,lastY:r.clientY,button:r.button,moved:!1,pan:!s&&(r.button===0||r.button===1||r.shiftKey),allowTextSelection:s},s||a.setPointerCapture(r.pointerId)},a.onpointermove=r=>{if(!this.worldDrag||this.worldDrag.pointerId!==r.pointerId)return;let s=r.clientX-this.worldDrag.lastX,n=r.clientY-this.worldDrag.lastY;this.worldDrag.lastX=r.clientX,this.worldDrag.lastY=r.clientY,Math.hypot(r.clientX-this.worldDrag.startX,r.clientY-this.worldDrag.startY)>3&&(this.worldDrag.moved=!0),this.worldDrag.pan&&e.pan(s,n)},a.onpointerup=r=>{if(!this.worldDrag||this.worldDrag.pointerId!==r.pointerId)return;let s=this.worldDrag;if(this.worldDrag=null,s.allowTextSelection||a.releasePointerCapture(r.pointerId),s.button!==0||s.moved)return;let n=r.target.closest?.("[data-feature-key]");if(n)this.selectElement(n,r);else{let i=this.featureAtEvent(r);i?this.selectFeature(i.entry,i.feature,r):this.callbacks.onBlank?.()}},a.ondblclick=r=>{let s=r.target.closest?.("[data-feature-key]"),n=s?null:this.featureAtEvent(r),i=n?.entry||this.entryForPoint(r.clientX,r.clientY),o=s?this.selectionFromElement(s):n?this.selectionFromFeature(n.entry,n.feature):this.selected;Xd(o)?this.callbacks.onOpenPage?.(o):o?.netUid?this.callbacks.onHighlightNet?.(o.netUid,o):!n&&i?.page&&this.callbacks.onOpenPage?.({kind:"page",pageId:i.page.id,page:i.page})},a.onwheel=r=>{r.preventDefault(),Math.abs(r.deltaX)>Math.abs(r.deltaY)*.65?e.pan(-r.deltaX,-r.deltaY):e.zoom(r.deltaY,r.clientX,r.clientY)}}async focusPage(e,a={}){if(!e)return!1;if(this.activePage?.id===e.id&&this.active)return a.frame!==!1&&this.fitPage(),!0;let r=performance.now(),s=await this.loadImportedSvg(e);if(!s)return!1;let n=document.createElement("div");return n.className="svg-dom-page",n.append(s),this.host.replaceChildren(n),this.host.hidden=!1,this.container=n,this.svg=s,this.activePage=e,this.activeSvgUrl=new URL(e.svg||e.thumbnail?.path,this.manifestUrl).toString(),this.overlay=qd(s),this.selectionOverlay=Hd(s),this.index=Vd(s,e,this.featuresByPage[e.id]||[]),this.installPageHandlers(),this.fitPage(),this.setSelection(this.selected),this.setHighlightedNet(this.highlightedNetUid),this.lastStats={...this.lastStats,mountedPages:1,domNodes:s.querySelectorAll("*").length,indexedFeatures:this.index.featureToElements.size,indexedNets:this.index.netToElements.size,mountMs:performance.now()-r,fallbackReason:""},this.updateCacheStats(),!0}installPageHandlers(){let e=this.host;e.oncontextmenu=a=>a.preventDefault(),e.onpointerdown=a=>{if(!this.active)return;let r=a.button===0&&!a.shiftKey&&!!a.target.closest?.("text"),s=a.target.closest?.("[data-feature-key]"),n=s?null:this.featureAtEvent(a);this.drag={pointerId:a.pointerId,startX:a.clientX,startY:a.clientY,lastX:a.clientX,lastY:a.clientY,button:a.button,moved:!1,pan:!r&&(a.button===0||a.button===1||a.shiftKey),featureElement:s,allowTextSelection:r},r||e.setPointerCapture(a.pointerId)},e.onpointermove=a=>{if(!this.drag||this.drag.pointerId!==a.pointerId)return;let r=a.clientX-this.drag.lastX,s=a.clientY-this.drag.lastY;this.drag.lastX=a.clientX,this.drag.lastY=a.clientY,Math.hypot(a.clientX-this.drag.startX,a.clientY-this.drag.startY)>3&&(this.drag.moved=!0),this.drag.pan&&(this.view.tx+=r,this.view.ty+=s,this.applyTransform())},e.onpointerup=a=>{if(!this.drag||this.drag.pointerId!==a.pointerId)return;let r=this.drag;if(this.drag=null,r.allowTextSelection||e.releasePointerCapture(a.pointerId),r.button!==0||r.moved)return;let s=a.target.closest?.("[data-feature-key]");if(s)this.selectElement(s,a);else{let n=this.featureAtEvent(a);n?this.selectFeature(n.entry,n.feature,a):this.callbacks.onBlank?.()}},e.ondblclick=a=>{let r=a.target.closest?.("[data-feature-key]"),s=r?null:this.featureAtEvent(a),n=r?this.selectionFromElement(r):s?this.selectionFromFeature(s.entry,s.feature):this.selected;Xd(n)?this.callbacks.onOpenPage?.(n):n?.netUid?this.callbacks.onHighlightNet?.(n.netUid,n):!s&&this.activePage&&this.callbacks.onOpenPage?.({kind:"page",pageId:this.activePage.id,page:this.activePage})},e.onwheel=a=>{if(a.preventDefault(),!this.active)return;if(Math.abs(a.deltaX)>Math.abs(a.deltaY)*.65){this.view.tx-=a.deltaX,this.view.ty-=a.deltaY,this.applyTransform();return}let r=this.host.getBoundingClientRect(),s=a.clientX-r.left,n=a.clientY-r.top,i=this.screenToSvg(s,n),o=Math.exp(-a.deltaY*.0016);this.view.scale=vs(this.view.scale*o,.02,80),this.view.tx=s-i[0]*this.view.scale,this.view.ty=n-i[1]*this.view.scale,this.applyTransform()}}selectElement(e,a){let r=performance.now(),s=this.selectionFromElement(e);if(this.setSelection(s),a){let n=this.host.getBoundingClientRect();s.anchor={x:a.clientX-n.left,y:a.clientY-n.top}}this.callbacks.onSelect?.(s),this.lastStats.selectionMs=performance.now()-r}selectFeature(e,a,r){let s=performance.now(),n=this.selectionFromFeature(e,a);if(this.setSelection(n),r){let i=this.host.getBoundingClientRect();n.anchor={x:r.clientX-i.left,y:r.clientY-i.top}}this.callbacks.onSelect?.(n),this.lastStats.selectionMs=performance.now()-s}selectionFromElement(e){let a=e.dataset.featureKey||"",r=this.entryForElement(e),s=r.index.featureByKey.get(a)||{};return this.selectionFromFeature(r,s,e)}selectionFromFeature(e,a,r=null){let s=a?.stableKey||r?.dataset?.featureKey||"",n=e?.page||this.activePage,i=a?.kind||r?.dataset?.role||r?.dataset?.primitive||"feature",o=a?.netUid||r?.dataset?.netUid||"",c=a?.netName||r?.dataset?.netName||"";return i==="sheet"?{kind:"sheet",featureKey:s,sheetInstancePath:a?.sheetInstancePath||n?.sheetInstancePath||"",sourceId:a?.sourceId||r?.dataset?.sourceId||r?.dataset?.objectId||r?.dataset?.uuid||"",sheetName:a?.sheet_name||a?.sheetName||r?.dataset?.sheetName||a?.objectId||"",sheetFile:a?.sheet_file||a?.sheetFile||r?.dataset?.sheetFile||"",feature:a}:i==="pin"||i==="pin_body"||i==="pin_name"||i==="pin_number"||r?.dataset?.pin?{kind:"pin",featureKey:s,sheetInstancePath:a?.sheetInstancePath||n?.sheetInstancePath||"",sourceId:a?.sourceId||r?.dataset?.sourceId||r?.dataset?.objectId||r?.dataset?.uuid||"",symbolUuid:a?.symbolUuid||r?.dataset?.symbolUuid||"",reference:a?.reference||r?.dataset?.designator||r?.dataset?.component||r?.dataset?.ref||"",pinNumber:a?.pinNumber||r?.dataset?.pin||"",pinName:a?.pinName||"",netUid:o,netName:c,feature:a}:i==="symbol_body"||i==="symbol_instance"||i==="component"||r?.dataset?.ref?{kind:"component",featureKey:s,sheetInstancePath:a?.sheetInstancePath||n?.sheetInstancePath||"",sourceId:a?.sourceId||r?.dataset?.sourceId||r?.dataset?.objectId||r?.dataset?.uuid||"",symbolUuid:a?.symbolUuid||r?.dataset?.symbolUuid||"",reference:a?.reference||r?.dataset?.designator||r?.dataset?.component||r?.dataset?.ref||"",netUid:o,netName:c,feature:a}:{kind:o?"feature":i,featureKey:s,sheetInstancePath:a?.sheetInstancePath||n?.sheetInstancePath||"",sourceId:a?.sourceId||r?.dataset?.sourceId||r?.dataset?.objectId||r?.dataset?.uuid||"",role:i,netUid:o,netName:c,feature:a}}setSelection(e){this.selected=e||null;for(let r of this.host.querySelectorAll(".prism-svg-selected"))r.classList.remove("prism-svg-selected");for(let r of this.host.querySelectorAll("[data-prism-overlay='selection']"))r.replaceChildren();let a=e?.featureKey||"";if(a){for(let r of this.entries()){for(let s of r.index.featureToElements.get(a)||[])s.classList.add("prism-svg-selected");this.drawSelectionOverlay(r,e)}for(let r of this.index.featureToElements.get(a)||[])r.classList.add("prism-svg-selected");this.drawSelectionOverlay({page:this.activePage,index:this.index,selectionOverlay:this.selectionOverlay},e)}}setHighlightedNet(e){this.highlightedNetUid=e||"";let a=performance.now();for(let r of this.entries())this.updateEntryHighlight(r);if(!this.svg||!this.overlay){this.lastStats.highlightMs=performance.now()-a;return}this.updateEntryHighlight({svg:this.svg,overlay:this.overlay,index:this.index,page:this.activePage}),this.lastStats.highlightMs=performance.now()-a}updateEntryHighlight(e){if(!e?.svg||!e?.overlay||(e.overlay.replaceChildren(),!this.highlightedNetUid))return;let a=ks(e.svg,e.page),r=document.createElementNS(Za,"rect");r.setAttribute("x",String(a[0])),r.setAttribute("y",String(a[1])),r.setAttribute("width",String(a[2])),r.setAttribute("height",String(a[3])),r.setAttribute("class","prism-svg-net-dimmer"),e.overlay.append(r);let n=(e.index.netToElements.get(this.highlightedNetUid)||[]).slice(0,2200);for(let i of n){let o=H0(i);e.overlay.append(o)}}entries(){return[...this.mountedPages.values()]}entryForElement(e){let r=e.closest?.(".svg-dom-page")?.dataset.pageId||"";return this.mountedPages.get(r)||{page:this.activePage,index:this.index,svg:this.svg,overlay:this.overlay,selectionOverlay:this.selectionOverlay}}featureAtEvent(e){let a=this.entryForPoint(e.clientX,e.clientY);if(!a)return null;let r=this.clientToSvg(a,e.clientX,e.clientY);if(!r)return null;let s=Math.max(.18,5*X0(a)),i=a.index.features.filter(o=>(o?.domBoundsMm||o?.boundsMm)&&Jd(o)).filter(o=>r[0]>=(o.domBoundsMm||o.boundsMm)[0]-s&&r[0]<=(o.domBoundsMm||o.boundsMm)[2]+s&&r[1]>=(o.domBoundsMm||o.boundsMm)[1]-s&&r[1]<=(o.domBoundsMm||o.boundsMm)[3]+s).map(o=>({feature:o,priority:Y0(o),area:Math.max(1e-4,((o.domBoundsMm||o.boundsMm)[2]-(o.domBoundsMm||o.boundsMm)[0])*((o.domBoundsMm||o.boundsMm)[3]-(o.domBoundsMm||o.boundsMm)[1]))})).sort((o,c)=>c.priority-o.priority||o.area-c.area)[0]?.feature;return i?{entry:a,feature:i,point:r}:null}entryForPoint(e,a){for(let r of[...this.entries()].reverse()){let s=r.container.getBoundingClientRect();if(e>=s.left&&e<=s.right&&a>=s.top&&a<=s.bottom)return r}if(this.container){let r=this.container.getBoundingClientRect();if(e>=r.left&&e<=r.right&&a>=r.top&&a<=r.bottom)return{page:this.activePage,container:this.container,svg:this.svg,index:this.index,selectionOverlay:this.selectionOverlay}}return null}clientToSvg(e,a,r){if(!e?.container||!e?.svg||!e?.page)return null;let s=e.container.getBoundingClientRect();if(!s.width||!s.height)return null;let n=ks(e.svg,e.page);return[n[0]+(a-s.left)/s.width*n[2],n[1]+(r-s.top)/s.height*n[3]]}drawSelectionOverlay(e,a){if(!e?.selectionOverlay||!a?.featureKey)return;let r=e.index.featureByKey.get(a.featureKey),s=r?.domBoundsMm||r?.boundsMm;if(!s)return;let[n,i,o,c]=s,l=document.createElementNS(Za,"rect");l.setAttribute("x",String(n)),l.setAttribute("y",String(i)),l.setAttribute("width",String(Math.max(.001,o-n))),l.setAttribute("height",String(Math.max(.001,c-i))),l.setAttribute("rx","0.65"),l.setAttribute("ry","0.65"),l.setAttribute("class","prism-svg-selection-box"),e.selectionOverlay.append(l)}fitPage(){if(!this.svg||!this.activePage)return;let e=ks(this.svg,this.activePage),a=e[2]||this.activePage.sourceWidthMm||this.activePage.widthMm||1,r=e[3]||this.activePage.sourceHeightMm||this.activePage.heightMm||1,s=this.host.getBoundingClientRect(),n=Math.min(s.width/a,s.height/r)*.92;this.view.scale=vs(n,.02,80),this.view.tx=(s.width-a*this.view.scale)/2-e[0]*this.view.scale,this.view.ty=(s.height-r*this.view.scale)/2-e[1]*this.view.scale,this.applyTransform()}frameSelection(e=this.selected){if(!e?.featureKey||!this.active){this.fitPage();return}let a=this.index.featureToElements.get(e.featureKey)||[],r=Yd(a);if(!r)return;let s=this.host.getBoundingClientRect(),n=Math.max(1,r[2]-r[0]),i=Math.max(1,r[3]-r[1]),o=Math.min(s.width/n,s.height/i)*.36;this.view.scale=vs(o,.04,80),this.view.tx=s.width/2-(r[0]+r[2])/2*this.view.scale,this.view.ty=s.height/2-(r[1]+r[3])/2*this.view.scale,this.applyTransform()}pan(e,a){this.active&&(this.view.tx+=e,this.view.ty+=a,this.applyTransform())}zoom(e,a,r){if(!this.active)return;let s=this.host.getBoundingClientRect(),n=(a??s.left+s.width/2)-s.left,i=(r??s.top+s.height/2)-s.top,o=this.screenToSvg(n,i),c=Math.exp(-e*.0016);this.view.scale=vs(this.view.scale*c,.02,80),this.view.tx=n-o[0]*this.view.scale,this.view.ty=i-o[1]*this.view.scale,this.applyTransform()}screenToSvg(e,a){return[(e-this.view.tx)/Math.max(1e-6,this.view.scale),(a-this.view.ty)/Math.max(1e-6,this.view.scale)]}applyTransform(){this.container&&(this.container.style.transform=`translate3d(${this.view.tx}px, ${this.view.ty}px, 0) scale(${this.view.scale})`)}hasCachedSvg(e){return!!this.svgCache.get(this.svgUrlForPage(e))?.template}pruneMountedWorldPages(e=new Set){if(this.mountedPages.size<=this.maxMountedWorldPages)return;let a=[...this.mountedPages.entries()].filter(([r])=>!e.has(r)).sort((r,s)=>(r[1].lastUsed||0)-(s[1].lastUsed||0));for(let[r,s]of a){if(this.mountedPages.size<=this.maxMountedWorldPages)break;s.container.remove(),this.mountedPages.delete(r)}}pruneSvgCache(){let e=[...this.svgCache.entries()].filter(([,s])=>s?.template);if(e.length<=this.maxCachedSvgPages)return;let a=new Set([...this.mountedPages.values()].map(s=>this.svgUrlForPage(s.page)));this.activePage&&a.add(this.svgUrlForPage(this.activePage));let r=e.filter(([s])=>!a.has(s)).sort((s,n)=>(s[1].lastUsed||0)-(n[1].lastUsed||0));for(let[s]of r){if([...this.svgCache.values()].filter(n=>n?.template).length<=this.maxCachedSvgPages)break;this.svgCache.delete(s)}}updateCacheStats(){let e=[...this.svgCache.values()].filter(r=>r?.template);this.lastStats.cachedSvgPages=e.length,this.lastStats.cachedSvgBytes=e.reduce((r,s)=>r+(s.byteLength||0),0);let a=performance?.memory;this.lastStats.heapMb=a?.usedJSHeapSize?a.usedJSHeapSize/1048576:null}};function D0(t,e,a){for(let n of[...t.querySelectorAll("*")]){if(O0.has(n.localName.toLowerCase())){n.remove();continue}for(let i of[...n.attributes]){let o=i.name,c=o.toLowerCase(),l=i.value||"";if(c.startsWith("on")){n.removeAttribute(o);continue}if((c==="href"||c==="xlink:href"||c==="src")&&Qd(l)){if((c==="href"||c==="xlink:href")&&n.localName.toLowerCase()==="image"&&Q0(l))continue;n.removeAttribute(o);continue}c==="style"&&n.setAttribute(o,ex(l))}}let r=`prism-${Fi(a)}-`,s=new Map;for(let n of t.querySelectorAll("[id]")){let i=n.getAttribute("id"),o=`${r}${Fi(i)}`;s.set(i,o),n.setAttribute("id",o)}for(let n of t.querySelectorAll("*"))for(let i of[...n.attributes]){let o=i.name.toLowerCase(),c=i.value||"";F0.has(o)&&(c.startsWith("#")&&s.has(c.slice(1))?c=`#${s.get(c.slice(1))}`:Z0(c)&&(c=new URL(c,e).toString())),c=tx(c,s),n.setAttribute(i.name,c)}}function Vd(t,e,a){let r=new Map,s=new Map,n=new Map,i=[];for(let f of a){let u=G0(f,e);i.push(u),s.set(u.stableKey,u),n.set(Number(u.id||0),u);for(let g of K0(u))r.has(g)||r.set(g,[]),r.get(g).push(u)}let o=new Map,c=new Map,l=new Map;for(let f of i)l.set(f.stableKey,f);for(let f of t.querySelectorAll("[data-uuid], [data-element-key], [data-primitive], [data-ref], [data-pin], [data-object-id], [data-designator], [data-component]")){let u=U0(f,r,e);if(u&&!Jd(u)||!u&&!J0(f))continue;let g=V0(f,e),p=u?.stableKey||g,h=u?.netUid||"",d=u?.netName||"";f.classList.add("prism-feature"),f.dataset.featureKey=p,f.dataset.sourceId=u?.sourceId||f.dataset.uuid||f.dataset.elementKey||"",f.dataset.role=u?.kind||f.dataset.primitive||f.dataset.ref||"feature",u?.id&&(f.dataset.featureId=String(u.id)),h&&(f.dataset.netUid=h),d&&(f.dataset.netName=d),f.id||(f.id=`prism-feature-${Fi(p)}`),$d(o,p,f),l.set(p,u||{id:0,stableKey:p,kind:f.dataset.role,sourceId:f.dataset.sourceId,sheetInstancePath:e.sheetInstancePath||""}),h&&$d(c,h,f)}for(let[f,u]of o){let g=l.get(f),p=Yd(u);g&&p&&(g.domBoundsMm=W0(g.boundsMm,p))}return{featureToElements:o,netToElements:c,featureByKey:l,byId:n,bySource:r,features:i}}function U0(t,e,a){let s=[t.dataset.uuid,t.dataset.elementKey,t.dataset.sourceId,t.dataset.objectId,t.dataset.componentUid,t.dataset.componentUuid,t.dataset.ref&&`${t.dataset.ref}:${t.dataset.pin||""}`].filter(Boolean).flatMap(i=>e.get(i)||[]);if(!s.length)return null;let n=String(t.dataset.primitive||t.dataset.ref||t.dataset.pin||"").toLowerCase();return s.map(i=>({feature:i,score:z0(i,n,a)})).sort((i,o)=>o.score-i.score)[0].feature}function z0(t,e,a){let r=0,s=String(t.kind||"").toLowerCase();return t.sheetInstancePath===a.sheetInstancePath&&(r+=20),t.netUid&&(r+=4),e&&s.includes(e)&&(r+=8),e==="symbol"&&s==="symbol_body"&&(r+=12),(e==="label"||e==="port")&&(s.includes("label")||s.includes("port"))&&(r+=12),e==="sheet"&&s==="sheet"&&(r+=12),s!=="record"&&(r+=2),s.includes("pin")&&(r+=2),r}function G0(t,e){let a=t.sourceId||t.sourceUid||t.uuid||t.objectId||t.stableKey||"";return{...t,id:Number(t.id||0),sourceId:a,stableKey:t.stableKey||`${e.sheetInstancePath||e.id}|${a}|0|${t.kind||"feature"}|0`,sheetInstancePath:t.sheetInstancePath||e.sheetInstancePath||""}}function K0(t){let e=new Set([t.sourceId,t.sourceUid,t.uuid,t.objectId,t.stableKey].filter(Boolean).map(String));return t.reference&&t.pinNumber&&e.add(`${t.reference}:${t.pinNumber}`),t.componentDesignator&&e.add(t.componentDesignator),t.reference&&e.add(t.reference),[...e]}function V0(t,e){let a=t.dataset.uuid||t.dataset.elementKey||t.dataset.objectId||t.dataset.ref||t.id||"svg",r=t.dataset.primitive||t.dataset.role||t.localName||"feature";return`${e.sheetInstancePath||e.id}|${a}|0|${r}|0`}function q0(t){let e=document.createElementNS(Za,"style");e.textContent=`
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
  `,t.prepend(e)}function qd(t){let e=document.createElementNS(Za,"g");return e.setAttribute("class","prism-svg-net-overlay"),e.setAttribute("data-prism-overlay","net-highlight"),t.append(e),e}function Hd(t){let e=document.createElementNS(Za,"g");return e.setAttribute("class","prism-svg-selection-overlay"),e.setAttribute("data-prism-overlay","selection"),e.style.pointerEvents="none",t.append(e),e}function H0(t){let e=t.cloneNode(!0);e.removeAttribute("id"),e.removeAttribute("data-feature-key"),e.removeAttribute("data-net-uid"),e.removeAttribute("data-net-name"),e.classList.add("prism-svg-net-overlay-clone");for(let a of[e,...Array.from(e.querySelectorAll?.("*")||[])])a instanceof SVGElement&&(a.removeAttribute("filter"),a.style.pointerEvents="none",a.style.stroke="#18ef52",a.style.fill="none",a.style.opacity="0.98",a.style.vectorEffect="non-scaling-stroke");return e}function Yd(t){let e=null;for(let a of t)if(a.getBBox)try{let r=a.getBBox(),s=[r.x,r.y,r.x+r.width,r.y+r.height];e=e?[Math.min(e[0],s[0]),Math.min(e[1],s[1]),Math.max(e[2],s[2]),Math.max(e[3],s[3])]:s}catch{}return e}function W0(t,e){return t?e?[Math.min(t[0],e[0]),Math.min(t[1],e[1]),Math.max(t[2],e[2]),Math.max(t[3],e[3])]:t:e}function ks(t,e){let a=t.getAttribute("viewBox");if(a){let r=a.trim().split(/[\s,]+/).map(Number);if(r.length===4&&r.every(Number.isFinite))return r}return[0,0,e.sourceWidthMm||e.widthMm||1,e.sourceHeightMm||e.heightMm||1]}function Wd(){return{featureToElements:new Map,netToElements:new Map,featureByKey:new Map,byId:new Map,bySource:new Map,features:[]}}function X0(t){let e=t?.container?.getBoundingClientRect?.();if(!t?.svg||!t?.page||!e?.width||!e?.height)return .1;let a=ks(t.svg,t.page);return Math.max(a[2]/e.width,a[3]/e.height)}function $0(t){let e=String(t?.kind||"").toLowerCase(),a=String(t?.semanticRole||"").toLowerCase(),r=`${t?.sourceId||""} ${t?.objectId||""} ${t?.text||""}`.toLowerCase();return e.includes("page")||a.includes("page")||e.includes("background")||a.includes("background")||r.includes("background")||r.includes("sheet_header")||r.includes("sheet header")||r.includes("drawing-sheet")}function Y0(t){let e=String(t?.kind||t?.semanticRole||"").toLowerCase();return e.includes("pin")?90:e.includes("label")||e.includes("port")?78:e.includes("wire")||e.includes("bus")||e.includes("junction")?70:e.includes("symbol")||e.includes("component")?54:e.includes("image")?30:20}function Jd(t){if(!t||$0(t))return!1;let e=String(t.kind||t.semanticRole||"").toLowerCase();return["pin","label","port","wire","bus","junction","no_connect","symbol","component","sheet","image","text"].some(a=>e.includes(a))}function J0(t){let e=`${t?.dataset?.primitive||""} ${t?.dataset?.ref||""} ${t?.dataset?.role||""} ${t?.dataset?.objectId||""} ${t?.dataset?.text||""}`.toLowerCase();return!e||e.includes("background")||e.includes("sheet_header")||e.includes("sheet header")||e.includes("drawing-sheet")?!1:["pin","label","port","wire","bus","junction","no_connect","symbol","component","sheet","image","text"].some(a=>e.includes(a))}function Xd(t){return String(t?.kind||t?.feature?.kind||"").toLowerCase()==="sheet"}function $d(t,e,a){t.has(e)||t.set(e,[]),t.get(e).push(a)}function Qd(t){let e=String(t||"").trim().toLowerCase();return!e||e.startsWith("#")?!1:e.startsWith("javascript:")||e.startsWith("data:")||e.startsWith("http://")||e.startsWith("https://")}function Q0(t){return/^data:image\/(?:png|jpe?g|gif|webp);base64,[a-z0-9+/=\s]+$/i.test(String(t||"").trim())}function Z0(t){let e=String(t||"").trim();return e&&!e.startsWith("#")&&!/^[a-z][a-z0-9+.-]*:/i.test(e)}function ex(t){return String(t||"").replace(/url\(([^)]+)\)/gi,(e,a)=>{let r=a.trim().replace(/^['"]|['"]$/g,"");return Qd(r)?"none":e})}function tx(t,e){let a=String(t||"");return a=a.replace(/url\(#([^)]+)\)/g,(r,s)=>e.has(s)?`url(#${e.get(s)})`:r),a=a.replace(/^#(.+)$/,(r,s)=>e.has(s)?`#${e.get(s)}`:r),a}function Fi(t){return String(t||"").trim().replace(/[^a-zA-Z0-9_-]+/g,"-").replace(/^-+|-+$/g,"").slice(0,96)||"item"}function vs(t,e,a){return Math.max(e,Math.min(a,t))}function Zd(t,e,a){let r=ax(Array.from(t,Number));if(!r)return null;let s=l=>{let f=[0,1,2,3].map(u=>r[u]*e+r[4+u]*a+r[8+u]*l+r[12+u]);return f.slice(0,3).map(u=>u/f[3])},n=s(1),o=s(0).map((l,f)=>l-n[f]),c=Math.hypot(...o);return c>0?{origin:n,direction:o.map(l=>l/c)}:null}function ax(t){let e=new Array(16);e[0]=t[5]*t[10]*t[15]-t[5]*t[11]*t[14]-t[9]*t[6]*t[15]+t[9]*t[7]*t[14]+t[13]*t[6]*t[11]-t[13]*t[7]*t[10],e[4]=-t[4]*t[10]*t[15]+t[4]*t[11]*t[14]+t[8]*t[6]*t[15]-t[8]*t[7]*t[14]-t[12]*t[6]*t[11]+t[12]*t[7]*t[10],e[8]=t[4]*t[9]*t[15]-t[4]*t[11]*t[13]-t[8]*t[5]*t[15]+t[8]*t[7]*t[13]+t[12]*t[5]*t[11]-t[12]*t[7]*t[9],e[12]=-t[4]*t[9]*t[14]+t[4]*t[10]*t[13]+t[8]*t[5]*t[14]-t[8]*t[6]*t[13]-t[12]*t[5]*t[10]+t[12]*t[6]*t[9],e[1]=-t[1]*t[10]*t[15]+t[1]*t[11]*t[14]+t[9]*t[2]*t[15]-t[9]*t[3]*t[14]-t[13]*t[2]*t[11]+t[13]*t[3]*t[10],e[5]=t[0]*t[10]*t[15]-t[0]*t[11]*t[14]-t[8]*t[2]*t[15]+t[8]*t[3]*t[14]+t[12]*t[2]*t[11]-t[12]*t[3]*t[10],e[9]=-t[0]*t[9]*t[15]+t[0]*t[11]*t[13]+t[8]*t[1]*t[15]-t[8]*t[3]*t[13]-t[12]*t[1]*t[11]+t[12]*t[3]*t[9],e[13]=t[0]*t[9]*t[14]-t[0]*t[10]*t[13]-t[8]*t[1]*t[14]+t[8]*t[2]*t[13]+t[12]*t[1]*t[10]-t[12]*t[2]*t[9],e[2]=t[1]*t[6]*t[15]-t[1]*t[7]*t[14]-t[5]*t[2]*t[15]+t[5]*t[3]*t[14]+t[13]*t[2]*t[7]-t[13]*t[3]*t[6],e[6]=-t[0]*t[6]*t[15]+t[0]*t[7]*t[14]+t[4]*t[2]*t[15]-t[4]*t[3]*t[14]-t[12]*t[2]*t[7]+t[12]*t[3]*t[6],e[10]=t[0]*t[5]*t[15]-t[0]*t[7]*t[13]-t[4]*t[1]*t[15]+t[4]*t[3]*t[13]+t[12]*t[1]*t[7]-t[12]*t[3]*t[5],e[14]=-t[0]*t[5]*t[14]+t[0]*t[6]*t[13]+t[4]*t[1]*t[14]-t[4]*t[2]*t[13]-t[12]*t[1]*t[6]+t[12]*t[2]*t[5],e[3]=-t[1]*t[6]*t[11]+t[1]*t[7]*t[10]+t[5]*t[2]*t[11]-t[5]*t[3]*t[10]-t[9]*t[2]*t[7]+t[9]*t[3]*t[6],e[7]=t[0]*t[6]*t[11]-t[0]*t[7]*t[10]-t[4]*t[2]*t[11]+t[4]*t[3]*t[10]+t[8]*t[2]*t[7]-t[8]*t[3]*t[6],e[11]=-t[0]*t[5]*t[11]+t[0]*t[7]*t[9]+t[4]*t[1]*t[11]-t[4]*t[3]*t[9]-t[8]*t[1]*t[7]+t[8]*t[3]*t[5],e[15]=t[0]*t[5]*t[10]-t[0]*t[6]*t[9]-t[4]*t[1]*t[10]+t[4]*t[2]*t[9]+t[8]*t[1]*t[6]-t[8]*t[2]*t[5];let a=t[0]*e[0]+t[1]*e[4]+t[2]*e[8]+t[3]*e[12];return Math.abs(a)<1e-30?null:e.map(r=>r/a)}function tu(t,e,a=0){return[t/1e3,-e/1e3,a]}function rx({rotation:t=0,mirror:e=!1,tilt:a=0}){let r=e?[-1,0,0]:[1,0,0],s=[0,1,0],n=e?[0,0,-1]:[0,0,1],i=Math.cos(t),o=Math.sin(t),c=r.map((h,d)=>i*h+o*s[d]),l=s.map((h,d)=>-o*r[d]+i*h),f=Math.cos(a),u=Math.sin(a),g=n.map((h,d)=>f*h-u*l[d]),p=l.map((h,d)=>u*n[d]+f*h);return{right:c,up:p,back:g}}function ji(t,e,a,r,s=0){let{up:n,back:i}=rx(t),o=tu(t.center[0],t.center[1],s),c=r*3,l=o.map((g,p)=>g+i[p]*c),f=1/(t.zoom*1e3),u=jr(e*f,a*f,-r*40,r*40);return ga(u,Pr(l,o,n))}function sx(t,e,a,r){let[s,n,i]=r,o=t[0]*s+t[4]*n+t[8]*i+t[12],c=t[1]*s+t[5]*n+t[9]*i+t[13],l=t[3]*s+t[7]*n+t[11]*i+t[15];return l>0?[(o/l+1)/2*e,(1-c/l)/2*a]:null}function er(t){let e=t[0]*1e3,a=t[3]*1e3,r=-t[4]*1e3,s=-t[1]*1e3;return{box:{x:e,y:r,w:a-e,h:s-r},bottom:t[2]+t[5]<0}}function Li(t,e){return t?e?t[2]:t[5]:0}function au(t,e,a,r,s){let n=Et(t),i=ji(e,a,r,n,e.focusZ??0);return sx(i,a,r,tu(s[0],s[1],e.focusZ??0))}var nx=([t,e,a,r])=>({x:Math.min(t,a),y:Math.min(e,r),w:Math.abs(a-t),h:Math.abs(r-e)}),Pi=t=>[t.x+t.w/2,t.y+t.h/2],eu=new WeakMap;function ix(t,e){let a=eu.get(t);if(a)return a;let r=new Map,s=new Map;for(let c of t.features.values()){if(c.sourceUid&&r.set(String(c.sourceUid),c),c.kind!=="pad")continue;let l=/^(.*):pad:\d+:(.+)$/.exec(String(c.sourceUid||""));if(!l)continue;let f=`${l[1]}\0${l[2]}`;s.has(f)||s.set(f,[]),s.get(f).push(c)}let n=new Map;for(let c of e?.physical_objects||[])c.kind==="footprint_body"&&c.designator&&c.bbox_mm?.length===4&&n.set(c.designator,c);let i=new Map((e?.physical_objects||[]).map(c=>[c.uid,c])),o={bySource:r,padsByFootprintPin:s,bodies:n,objects:i};return eu.set(t,o),o}function ru({scene:t,topology:e},a,r){let s=String(a),n=t.componentFeatures.get(s);if(!n)return null;let i=ix(t,e),o=t.features.get(Number(n.featureId)),c=i.bodies.get(s),l=o?.bounds?er(o.bounds).box:c?nx(c.bbox_mm.map(Number)):null,f=o?.bounds?er(o.bounds).bottom:String(c?.layer||"").startsWith("B."),u=null;if(r!=null&&r!==""){let p=(e?.terminals||[]).find(d=>d.designator===s&&String(d.pin)===String(r)),h=p?.pcb_pad_id?i.objects.get(p.pcb_pad_id):null;if(u=h?.source_ids?.[0]&&i.bySource.get(String(h.source_ids[0]))||null,!u){let d=i.padsByFootprintPin.get(`${n.footprint}\0${r}`)||[],m=l?Pi(l):null,b=1/0;for(let y of d){let x=Pi(er(y.bounds).box),v=m?Math.hypot(x[0]-m[0],x[1]-m[1]):0;v<b&&([b,u]=[v,y])}}}let g=u?.bounds?er(u.bounds).box:null;return!l&&g&&(l=g,f=er(u.bounds).bottom),l?{reference:s,pin:u?String(r):null,focus:l,anchor:Pi(g||l),anchorBox:g,bottom:f,surfaceZ:Li(t.runtimeBounds,f)}:null}var Ms=class{#e=new Map;constructor(e=3e3){this.ttlMs=e}get size(){return this.#e.size}record(e,a,r){this.#e.set(e,{matrix:a,at:r})}release(e){this.#e.delete(e)}clear(){this.#e.clear()}active(e){let a=[];for(let[r,s]of this.#e)e-s.at>this.ttlMs?this.#e.delete(r):a.push(s.matrix);return a}};var _s=1.5*1024*1024*1024;function Di(t){let e=Number(t);return Number.isFinite(e)&&e>0?e:_s}function su(t,e){if(e.netName||e.netUid){let a=e.netUid&&t.find(r=>r.uid===e.netUid)||e.netName&&Zt(t,e.netName);return a?{kind:"net",id:Number(a.id)}:{kind:"unresolved"}}return e.netId?{kind:"net",id:Number(e.netId)}:e.featureId?{kind:"feature",id:Number(e.featureId)}:e.reference?{kind:"component",reference:String(e.reference)}:{kind:"board"}}function nu(t,e){if(!t||!e||t.occurrence!=null)return!1;let a=r=>String(r??"");return t.reference||e.reference?a(t.reference)===a(e.reference)&&a(t.pin)===a(e.pin):t.featureId&&e.featureId?Number(t.featureId)===Number(e.featureId):t.netName&&e.netName?a(t.netName)===a(e.netName):t.netCode&&e.netCode?Number(t.netCode)===Number(e.netCode):!1}function iu(t,e){if(e.kind==="net")t.selectNet(e.id,!0);else if(e.kind==="feature")t.selectFeature(e.id,!0);else if(e.kind==="component")t.selectComponent(e.reference,!0);else return!1;return!0}function ou(t,e){return e&&!t?"enter":!e&&t?"leave":null}function ox(t){return(Array.isArray(t)?t:[]).map((e,a)=>{let r=dc(e?.color??Fn[a%Fn.length]);return{key:String(e?.key??a),mark:r,color:`#${(r&16777215).toString(16).padStart(6,"0")}`,members:(Array.isArray(e?.members)?e.members:[]).filter(s=>s&&typeof s.occurrence=="string"&&typeof s.net=="string")}})}function Ui(){return{selection:null,gpuBudget:null}}var cx=Object.freeze(["setSelection","resize","getViewState","setLayerVisible","applyLayerPreset","setShowBoard","setShowComponents","setShowPlaceholders","setRealisticColors","setBoardLayerVisible","setSeparation","showNetLayers","setNetIsolation","setStatsOverlay","getStats","setLodOverride","setGpuBudget","pickAt","projectComponent","projectPoint"]),Ss=class{#e=null;constructor(e=Ui()){this.shared=e}get port(){return this.#e}attach(e){if(!e)throw new TypeError("A mode controller attaches to a mounted scene port");this.detach(),this.#e=e,this.replay(e)}detach(){let e=this.#e;this.#e=null,this.release(),e?.dispose?.()}replay(){}release(){}setSelection(e){this.shared.selection=e||null;let a=this.#e;a?.takeEcho?.(this.shared.selection)||a&&a.quietly(()=>this.applySelection(a,this.shared.selection))}setGpuBudget(e){this.shared.gpuBudget=e,this.#e?.setGpuBudget(Di(e))}resize(){this.#e?.resize()}getViewState(){return this.#e?.getViewState()??null}setLayerVisible(e,a,r=null){this.#e?.setLayerVisible(e,a,r)}applyLayerPreset(e,a=null){this.#e?.applyLayerPreset(e,a)}setShowBoard(e){this.#e?.setShowBoard(e)}setShowComponents(e){this.#e?.setShowComponents(e)}setShowPlaceholders(e){this.#e?.setShowPlaceholders(e)}setRealisticColors(e){this.#e?.setRealisticColors(e)}setBoardLayerVisible(e,a,r){this.#e?.setBoardLayerVisible(e,a,r)}setSeparation(e,a=null){this.#e?.setSeparation(e,a)}showNetLayers(){this.#e?.showNetLayers()}setNetIsolation(e){this.#e?.setNetIsolation(e)}setStatsOverlay(e){this.#e?.setStatsOverlay(e)}getStats(){return this.#e?.stats()??null}setLodOverride(e){this.#e?.setLodOverride(e)}pickAt(e,a){return Promise.resolve(this.#e?.pickAt(e,a)??null)}projectComponent(e,a){return this.#e?.projectComponent(e,a)??null}projectPoint(e,a){return this.#e?.projectPoint(e,a)??null}},lx=Object.freeze(["setHighlightedNets","setHiddenComponents","getComponentReferences","setViewMode","renderInset","insetReady","insetSurfaceZ","releaseInset","insetTarget","projectInset","onSceneChange","insetStats","insetSettings","gpuIdle","loadAnalyticPack","setAnalyticOverlay","setAnalyticVectors","setAnalyticStyle","analyticColormaps","setAnalyticRelief","setClickSelect","analyticProbe","analyticAt","analyticStats","unloadAnalyticPack"]),Ts=class extends Ss{#e=[];#a=null;#r="pcb";#s=new Set;#n=null;#t=null;#i=!0;#o=null;attach(e,{workspace:a="pcb"}={}){this.#r=a,super.attach(e)}replay(e){this.#n=e.onSceneChange?.(()=>this.#l())??null,this.#l(),e.setWorkspace(this.#r),this.#a&&e.setHiddenComponents(this.#a),this.shared.gpuBudget!=null&&e.setGpuBudget(Di(this.shared.gpuBudget)),this.shared.selection&&e.quietly(()=>this.applySelection(e,this.shared.selection)),this.#e.length&&this.#c(e,this.#e),this.#t&&this.#d(e,this.#t),this.#i||e.setClickSelect(!1)}async#d(e,a){await e.loadAnalyticPack(a.bytes,a.options),a.overlay&&e.setAnalyticOverlay(a.overlay),this.#o&&e.setAnalyticRelief(this.#o),a.style&&e.setAnalyticStyle(a.style),a.vectors&&e.setAnalyticVectors(a.vectors)}release(){this.#n?.(),this.#n=null}applySelection(e,a){a?.occurrence!=null&&e.selectOccurrence(a.occurrence),a?iu(e,su(e.nets(),a)):e.clearSelection()}setWorkspace(e){this.#r=e,this.port?.setWorkspace(e)}setHighlightedNets(e){this.#e=Array.isArray(e)?[...e]:[];let a=this.port;a&&this.#c(a,this.#e)}#c(e,a){let r=cc(e.nets(),a),s=e.anyEmphasis();e.setHighlightedNetIds(r);let n=e.anyEmphasis(),i=ou(s,n);i==="enter"?e.showNetProbe():i==="leave"&&e.restoreVisibility(),e.isolating()&&n&&e.isolateLitNets()}setHiddenComponents(e){this.#a=Array.isArray(e)?[...e]:[],this.port?.setHiddenComponents(this.#a)}getComponentReferences(){return this.port?.getComponentReferences()??[]}setViewMode(e){this.port?.setViewMode(e)}renderInset(e,a,r){return!!this.port?.renderInset(e,a,r)}insetReady(){return!!this.port?.insetReady()}insetSurfaceZ(e){let a=this.port;return a?Li(a.insetBoard().scene.runtimeBounds,!!e):0}releaseInset(e){this.port?.releaseInset(String(e))}insetTarget(e,a){let r=this.port;return r?ru(r.insetBoard(),e,a):null}projectInset(e,a,r,s){let n=this.port;return n?au(n.insetBoard().scene.runtimeBounds,e,a,r,s):null}onSceneChange(e){return this.#s.add(e),()=>this.#s.delete(e)}#l(){for(let e of this.#s)e()}insetStats(){return this.port?.insetStats()??null}insetSettings(e){return this.port?.insetSettings(e)??null}gpuIdle(){return this.port?.gpuIdle()??Promise.resolve()}async loadAnalyticPack(e,a={}){let r=e instanceof Uint8Array?e:new Uint8Array(e);return this.#t={bytes:r,options:a,overlay:null,vectors:null,style:this.#t?.style??null},this.port?this.port.loadAnalyticPack(r,a):null}setAnalyticOverlay(e){return this.#t&&(this.#t.overlay=e),this.port?.setAnalyticOverlay(e)??null}setAnalyticVectors(e){return this.#t&&(this.#t.vectors=e),this.port?.setAnalyticVectors(e)??null}setAnalyticStyle(e){return this.#t&&(this.#t.style={...this.#t.style||{},...e}),this.port?.setAnalyticStyle(e)??null}analyticColormaps(){return this.port?.analyticColormaps()??null}setAnalyticRelief(e){return this.#o=e||null,this.port?.setAnalyticRelief(this.#o)??null}setClickSelect(e){this.#i=e!==!1,this.port?.setClickSelect(this.#i)}analyticProbe(e,a){return this.port?.analyticProbe(e,a)??null}analyticAt(e,a){return this.port?.analyticAt(e,a)??Promise.resolve(null)}analyticStats(){return this.port?.analyticStats()??null}unloadAnalyticPack(){this.#t=null,this.port?.unloadAnalyticPack()}},dx=Object.freeze(["setSystemScene","setNetEmphasis","frameNetEmphasis","frameAll","frameBoard","frameParts","setMoveMode","setMoveSpace","previewPose","cancelMove","getMoveState","setAssemblyExplode","setMoveSnap","setLabelsVisible","setHelpVisible","isHelpVisible","viewAxis"]),As=class extends Ss{#e=null;#a=null;#r=null;#s=!1;#n=0;#t={...Vt};attach(e,{moveAllowed:a=!1}={}){this.#s=!!a,super.attach(e)}replay(e){this.shared.gpuBudget!=null&&e.setGpuBudget(Di(this.shared.gpuBudget)),this.#e&&e.setSystemScene(this.#e),this.#a&&this.#i(e,this.#a),e.setMoveAllowed(this.#s),e.setAssemblyExplode(this.#n),e.setMoveSnap({...this.#t}),this.#r!=null&&e.setLabelsVisible(this.#r)}applySelection(e,a){if(!a){e.clearSelection();return}if(e.focusPlacement(a.occurrence)!=="board")return;let r=su(e.nets(),a);r.kind==="board"?e.selectBoardContext():iu(e,r)}setSystemScene(e){this.#e=e||null,e&&this.port?.setSystemScene(e)}setNetEmphasis(e){this.#a=Array.isArray(e)?e:[];let a=this.port;return a?this.#i(a,this.#a):[]}#i(e,a){let r=e.anyEmphasis(),s=e.setEmphasisSets(ox(a));if(!s)return[];let n=e.anyEmphasis(),i=ou(r,n);return i==="enter"?e.showNetProbe():i==="leave"&&(e.isolating()&&e.setNetIsolation(!1),e.restoreVisibility()),e.isolating()&&n&&e.isolateLitNets(),s}frameNetEmphasis(e=null,a=null){return this.port?.frameNetEmphasis(e,a)??!1}frameAll(){this.port?.frameAll()}frameBoard(e){return this.port?.frameBoard(e)??!1}frameParts(e){return this.port?.frameParts(e)??!1}setMoveAllowed(e){this.#s=!!e,this.port?.setMoveAllowed(this.#s)}setMoveMode(e,a){this.port?.setMoveMode(e,a)}setMoveSpace(e){this.port?.setMoveSpace(e)}previewPose(e){this.port?.previewPose(e)}cancelMove(){this.port?.cancelMove()}getMoveState(){return this.port?.getMoveState()??null}setAssemblyExplode(e){this.#n=Math.max(0,Math.min(1,Number(e)||0)),this.port?.setAssemblyExplode(this.#n)}setMoveSnap(e){this.#t=as(e,this.#t),this.port?.setMoveSnap({...this.#t})}setLabelsVisible(e){this.#r=!!e,this.port?.setLabelsVisible(this.#r)}setHelpVisible(e){this.port?.setHelpVisible(e)}isHelpVisible(){return!!this.port?.isHelpVisible()}viewAxis(e,a=!1){this.port?.viewAxis(e,a)}};function cu(t){let e=(a,r)=>{for(let s of a)Object.defineProperty(t,s,{configurable:!0,writable:!0,value(...n){return r(this)[s](...n)}})};e(cx,a=>a.activeMode),e(lx,a=>a.modes.board),e(dx,a=>a.modes.system)}var Gi=Object.freeze({viridis:["#440154","#482878","#3e4989","#31688e","#26828e","#1f9e89","#35b779","#6ece58","#b5de2b","#fde725"],inferno:["#000004","#1b0c41","#4a0c6b","#781c6d","#a52c60","#cf4446","#ed6925","#fb9b06","#f7d13d","#fcffa4"],magma:["#000004","#180f3d","#440f76","#721f81","#9e2f7f","#cd4071","#f1605d","#fd9668","#feca8d","#fcfdbf"],plasma:["#0d0887","#46039f","#7201a8","#9c179e","#bd3786","#d8576b","#ed7953","#fb9f3a","#fdca26","#f0f921"],cividis:["#00224e","#123570","#3b496c","#575d6d","#707173","#8a8678","#a59c74","#c3b369","#e1cc55","#fee838"],turbo:["#30123b","#4662d7","#36aaf9","#1ae4b6","#72fe5e","#c8ef34","#faba39","#f66b19","#ca2a04","#7a0403"],coolwarm:["#3b4cc0","#6788ee","#9abbff","#c9d7f0","#edd1c2","#f7a889","#e26952","#b40426"],ember:["#e0e3ed","#ff9e1f","#db141a"],ice:["#f4f7fb","#9ecae1","#2171b5","#08306b"],white:["#fafaf5","#fafaf5"],greys:["#f7f7f7","#bdbdbd","#737373","#252525"]}),Ea=256,tr=Object.freeze({fieldColormap:"viridis",arrowColormap:"ember",arrowDensity:70,arrowWidth:.07,arrowMinLength:.3,arrowOutline:[.05,.05,.07,.85]});function lu(t){let e=String(t).replace(/^#/,"");if(!/^[0-9a-fA-F]{6}$/.test(e))throw new TypeError(`colour ${t} is not #rrggbb`);return[0,2,4].map(a=>Number.parseInt(e.slice(a,a+2),16)/255)}function zi(t){if(Array.isArray(t)){if(t.length<2)throw new TypeError("a colormap needs two or more stops");return t.forEach(lu),[...t]}let e=Gi[t];if(!e)throw new TypeError(`unknown colormap ${t}`);return[...e]}function Ki(t,e=Ea){let a=zi(t).map(lu),r=new Float32Array(e*4);for(let s=0;s<e;s++){let n=s/(e-1)*(a.length-1),i=Math.min(a.length-2,Math.floor(n)),o=n-i;for(let c=0;c<3;c++)r[s*4+c]=a[i][c]*(1-o)+a[i+1][c]*o;r[s*4+3]=1}return r}function Vi(t={},e=tr){let a={...e,...t||{}};zi(a.fieldColormap),zi(a.arrowColormap);let r=(s,n)=>{if(!(Number(a[s])>0&&Number(a[s])<=n))throw new RangeError(`${s} must be in (0, ${n}]`);a[s]=Number(a[s])};if(r("arrowDensity",400),r("arrowWidth",.5),r("arrowMinLength",1),!Array.isArray(a.arrowOutline)||a.arrowOutline.length!==4)throw new TypeError("arrowOutline is [r, g, b, a]");return a}var Ma=class{__destroy_into_raw(){let e=this.__wbg_ptr;return this.__wbg_ptr=0,du.unregister(this),e}free(){let e=this.__destroy_into_raw();G.__wbg_analyticpack_free(e,0)}barrelRecords(){let e=G.analyticpack_barrelRecords(this.__wbg_ptr);return or.__wrap(e)}bindingJson(e){let a,r;try{let i=G.analyticpack_bindingJson(this.__wbg_ptr,e);var s=i[0],n=i[1];if(i[3])throw s=0,n=0,Is(i[2]);return a=s,r=n,lr(s,n)}finally{G.__wbindgen_free(a,r,1)}}headerJson(){let e,a;try{let n=G.analyticpack_headerJson(this.__wbg_ptr);var r=n[0],s=n[1];if(n[3])throw r=0,s=0,Is(n[2]);return e=r,a=s,lr(r,s)}finally{G.__wbindgen_free(e,a,1)}}lowerSlice(e,a){let r=px(e,G.__wbindgen_malloc,G.__wbindgen_realloc),s=dr,n=G.analyticpack_lowerSlice(this.__wbg_ptr,r,s,a);if(n[2])throw Is(n[1]);return cr.__wrap(n[0])}constructor(e){let a=bx(e,G.__wbindgen_malloc),r=dr,s=G.analyticpack_new(a,r);if(s[2])throw Is(s[1]);return this.__wbg_ptr=s[0],du.register(this,this.__wbg_ptr,this),this}operationNetIndices(e){let a=G.analyticpack_operationNetIndices(this.__wbg_ptr,e);var r=lt(a[0],a[1]).slice();return G.__wbindgen_free(a[0],a[1]*4,4),r}};Symbol.dispose&&(Ma.prototype[Symbol.dispose]=Ma.prototype.free);var or=class t{static __wrap(e){let a=Object.create(t.prototype);return a.__wbg_ptr=e,uu.register(a,a.__wbg_ptr,a),a}__destroy_into_raw(){let e=this.__wbg_ptr;return this.__wbg_ptr=0,uu.unregister(this),e}free(){let e=this.__destroy_into_raw();G.__wbg_barrelrecords_free(e,0)}floats(){let e=G.barrelrecords_floats(this.__wbg_ptr);var a=Rs(e[0],e[1]).slice();return G.__wbindgen_free(e[0],e[1]*4,4),a}skipped(){return G.barrelrecords_skipped(this.__wbg_ptr)>>>0}words(){let e=G.barrelrecords_words(this.__wbg_ptr);var a=lt(e[0],e[1]).slice();return G.__wbindgen_free(e[0],e[1]*4,4),a}};Symbol.dispose&&(or.prototype[Symbol.dispose]=or.prototype.free);var cr=class t{static __wrap(e){let a=Object.create(t.prototype);return a.__wbg_ptr=e,fu.register(a,a.__wbg_ptr,a),a}__destroy_into_raw(){let e=this.__wbg_ptr;return this.__wbg_ptr=0,fu.unregister(this),e}free(){let e=this.__destroy_into_raw();G.__wbg_loweredslicerecords_free(e,0)}batches(){let e=G.loweredslicerecords_batches(this.__wbg_ptr);var a=lt(e[0],e[1]).slice();return G.__wbindgen_free(e[0],e[1]*4,4),a}contourEdgeOperations(){let e=G.loweredslicerecords_contourEdgeOperations(this.__wbg_ptr);var a=lt(e[0],e[1]).slice();return G.__wbindgen_free(e[0],e[1]*4,4),a}contourEdges(){let e=G.loweredslicerecords_contourEdges(this.__wbg_ptr);var a=Rs(e[0],e[1]).slice();return G.__wbindgen_free(e[0],e[1]*4,4),a}covers(){let e=G.loweredslicerecords_covers(this.__wbg_ptr);var a=lt(e[0],e[1]).slice();return G.__wbindgen_free(e[0],e[1]*4,4),a}cutIndices(){let e=G.loweredslicerecords_cutIndices(this.__wbg_ptr);var a=lt(e[0],e[1]).slice();return G.__wbindgen_free(e[0],e[1]*4,4),a}edgeCuts(){let e=G.loweredslicerecords_edgeCuts(this.__wbg_ptr);var a=lt(e[0],e[1]).slice();return G.__wbindgen_free(e[0],e[1]*4,4),a}fanVertices(){let e=G.loweredslicerecords_fanVertices(this.__wbg_ptr);var a=Rs(e[0],e[1]).slice();return G.__wbindgen_free(e[0],e[1]*4,4),a}outlineEdges(){let e=G.loweredslicerecords_outlineEdges(this.__wbg_ptr);var a=Rs(e[0],e[1]).slice();return G.__wbindgen_free(e[0],e[1]*4,4),a}outlineShapes(){let e=G.loweredslicerecords_outlineShapes(this.__wbg_ptr);var a=lt(e[0],e[1]).slice();return G.__wbindgen_free(e[0],e[1]*4,4),a}shapeCuts(){let e=G.loweredslicerecords_shapeCuts(this.__wbg_ptr);var a=lt(e[0],e[1]).slice();return G.__wbindgen_free(e[0],e[1]*4,4),a}shapes(){let e=G.loweredslicerecords_shapes(this.__wbg_ptr);var a=lt(e[0],e[1]).slice();return G.__wbindgen_free(e[0],e[1]*4,4),a}statsJson(){let e,a;try{let r=G.loweredslicerecords_statsJson(this.__wbg_ptr);return e=r[0],a=r[1],lr(r[0],r[1])}finally{G.__wbindgen_free(e,a,1)}}subtractShapes(){return G.loweredslicerecords_subtractShapes(this.__wbg_ptr)>>>0}};Symbol.dispose&&(cr.prototype[Symbol.dispose]=cr.prototype.free);function ux(){return{__proto__:null,"./prism_kicad_analytic_bg.js":{__proto__:null,__wbg___wbindgen_throw_bb96b2010945f0bc:function(e,a){throw new Error(lr(e,a))},__wbindgen_cast_0000000000000001:function(e,a){return lr(e,a)},__wbindgen_init_externref_table:function(){let e=G.__wbindgen_externrefs,a=e.grow(4);e.set(0,void 0),e.set(a+0,void 0),e.set(a+1,null),e.set(a+2,!0),e.set(a+3,!1)}}}}var du=typeof FinalizationRegistry>"u"?{register:()=>{},unregister:()=>{}}:new FinalizationRegistry(t=>G.__wbg_analyticpack_free(t,1)),uu=typeof FinalizationRegistry>"u"?{register:()=>{},unregister:()=>{}}:new FinalizationRegistry(t=>G.__wbg_barrelrecords_free(t,1)),fu=typeof FinalizationRegistry>"u"?{register:()=>{},unregister:()=>{}}:new FinalizationRegistry(t=>G.__wbg_loweredslicerecords_free(t,1));function Rs(t,e){return t=t>>>0,fx().subarray(t/4,t/4+e)}function lt(t,e){return t=t>>>0,hx().subarray(t/4,t/4+e)}var ar=null;function fx(){return(ar===null||ar.byteLength===0)&&(ar=new Float32Array(G.memory.buffer)),ar}function lr(t,e){return mx(t>>>0,e)}var rr=null;function hx(){return(rr===null||rr.byteLength===0)&&(rr=new Uint32Array(G.memory.buffer)),rr}var sr=null;function nr(){return(sr===null||sr.byteLength===0)&&(sr=new Uint8Array(G.memory.buffer)),sr}function bx(t,e){let a=e(t.length*1,1)>>>0;return nr().set(t,a/1),dr=t.length,a}function px(t,e,a){if(a===void 0){let o=ir.encode(t),c=e(o.length,1)>>>0;return nr().subarray(c,c+o.length).set(o),dr=o.length,c}let r=t.length,s=e(r,1)>>>0,n=nr(),i=0;for(;i<r;i++){let o=t.charCodeAt(i);if(o>127)break;n[s+i]=o}if(i!==r){i!==0&&(t=t.slice(i)),s=a(s,r,r=i+t.length*3,1)>>>0;let o=nr().subarray(s+i,s+r),c=ir.encodeInto(t,o);i+=c.written,s=a(s,r,i,1)>>>0}return dr=i,s}function Is(t){let e=G.__wbindgen_externrefs.get(t);return G.__externref_table_dealloc(t),e}var Ns=new TextDecoder("utf-8",{ignoreBOM:!0,fatal:!0});Ns.decode();var gx=2146435072,qi=0;function mx(t,e){return qi+=e,qi>=gx&&(Ns=new TextDecoder("utf-8",{ignoreBOM:!0,fatal:!0}),Ns.decode(),qi=e),Ns.decode(nr().subarray(t,t+e))}var ir=new TextEncoder;"encodeInto"in ir||(ir.encodeInto=function(t,e){let a=ir.encode(t);return e.set(a),{read:t.length,written:a.length}});var dr=0,yx,xx,G;function wx(t,e){return xx=t,G=t.exports,yx=e,ar=null,rr=null,sr=null,G.__wbindgen_start(),G}async function vx(t,e){if(typeof Response=="function"&&t instanceof Response){if(!t.ok)throw new Error(`failed to fetch Wasm: ${t.status} ${t.statusText} fetching '${t.url}'`);if(typeof WebAssembly.instantiateStreaming=="function")try{return await WebAssembly.instantiateStreaming(t,e)}catch(s){if(a(t.type)&&t.headers.get("Content-Type")!=="application/wasm")console.warn("`WebAssembly.instantiateStreaming` failed because your server does not serve Wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n",s);else throw s}let r=await t.arrayBuffer();return await WebAssembly.instantiate(r,e)}else{let r=await WebAssembly.instantiate(t,e);return r instanceof WebAssembly.Instance?{instance:r,module:t}:r}function a(r){switch(r){case"basic":case"cors":case"default":return!0}return!1}}async function hu(t){if(G!==void 0)return G;t!==void 0&&(Object.getPrototypeOf(t)===Object.prototype?{module_or_path:t}=t:console.warn("using deprecated parameters for the initialization function; pass a single object instead")),t===void 0&&(t=new URL("prism_kicad_analytic_bg.wasm",import.meta.url));let e=ux();(typeof t=="string"||typeof Request=="function"&&t instanceof Request||typeof URL=="function"&&t instanceof URL)&&(t=fetch(t));let{instance:a,module:r}=await vx(await t,e);return wx(a,r)}var bu={schema:"prism.vendored_wasm.a0",purpose:"Reads materialization packs (kicad_monkey.materialization.a0) in the browser and lowers their slices for the analytic renderer.",source:{repository:"this repository",crate:"prism-kicad-wasm",native_src_rs_tree:"5b03b10ee0e1b0c9d2449fbb47596a4065a1785d",license:"MIT"},build:{target:"wasm32-unknown-unknown",profile:"release",features:["materialization"],wasm_bindgen:"0.2.127",rustc:"rustc 1.98.0 (88d9e12ae 2026-08-18)",command:"node scripts/build-analytic-wasm.mjs"},files:{"prism_kicad_analytic.js":"c93b31ad6ad5e7bc4ef2b0e658e1f514c81a9124dfc6a42db5ea1c5fa96d5fd9","prism_kicad_analytic_bg.wasm":"8fcc4ad15c6f41bc1358b9d739faf9264a06758edf7e587afc11db6b38a3b85d"}};var pu="prism-kicad-analytic.wasm",Ex="kicad_monkey.materialization.a0",ra=1e3,Hi=null;function Sa(){return String(bu.files?.["prism_kicad_analytic_bg.wasm"]||"").slice(0,16)}function xu(){let t=Sa();try{return new URL(`${pu}?v=${t}`,import.meta.url)}catch{return`/${pu}?v=${t}`}}function Mx(t=xu()){return Hi??=hu({module_or_path:t}).catch(e=>{throw Hi=null,e}),Hi}function Sx(t,e,a=ra){let r=t.lowerSlice(e,a);try{return{shapes:new Uint32Array(r.shapes()),subtractShapes:r.subtractShapes(),fanVertices:new Float32Array(r.fanVertices()),covers:new Uint32Array(r.covers()),batches:new Uint32Array(r.batches()),contourEdges:new Float32Array(r.contourEdges()),contourEdgeOperations:new Uint32Array(r.contourEdgeOperations()),shapeCuts:new Uint32Array(r.shapeCuts()),edgeCuts:new Uint32Array(r.edgeCuts()),cutIndices:new Uint32Array(r.cutIndices()),outlineEdges:new Float32Array(r.outlineEdges()),outlineShapes:new Uint32Array(r.outlineShapes()),stats:JSON.parse(r.statsJson())}}finally{r.free()}}function Bs(){return String(xu())}async function ur(t,{wasm:e}={}){await Mx(e);let a=new Ma(t instanceof Uint8Array?t:new Uint8Array(t)),r=JSON.parse(a.headerJson());if(r.schema!==Ex)throw new Error(`unsupported materialization schema ${r.schema}`);return{header:r,lowerSlice(s,n=ra){return Sx(a,s,n)},barrels(){let s=a.barrelRecords();try{return{floats:new Float32Array(s.floats()),words:new Uint32Array(s.words()),skipped:s.skipped()}}finally{s.free()}},binding(s){return JSON.parse(a.bindingJson(s))},netIndices(){return new Uint32Array(a.operationNetIndices(Ta(r)))},free(){a.free()}}}function Ta(t){return(t.chunks||[]).reduce((e,a)=>e+Number(a.operation_count||0),0)}function Tx(t,e){let a=null;for(let r of t.chunks||[]){if(r.slice_key!==e)continue;let s=r.bounds,n=[s.min_x_nm,s.min_y_nm,s.max_x_nm,s.max_y_nm].map(i=>i/1e6);a=a?[Math.min(a[0],n[0]),Math.min(a[1],n[1]),Math.max(a[2],n[2]),Math.max(a[3],n[3])]:n}return a}var Ax={conductor:"copper",solder_mask:"mask",silkscreen:"silk",paste:"paste",dielectric:"dielectric"},wu=1e-6,vu=2e-6,gu=1e-7,mu={"fr4 natural":[109,116,75],"ptfe natural":[252,252,250],polyimide:[205,130,0],"phenolic natural":[92,17,6],aluminum:[213,213,213]};function _x(t){let e=String(t||"").trim(),a=/^#([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(e);return[...(a?[0,2,4].map(s=>parseInt(a[1].slice(s,s+2),16)):mu[e.toLowerCase()]||mu["fr4 natural"]).map(s=>s/255),1]}function ku(t,e,a=0){let r=new Map((e||[]).map(d=>[String(d.name),d])),s=[...t.stack?.slices||[]].sort((d,m)=>d.order-m.order),n=s.filter(d=>d.role==="conductor"),i=d=>Number(r.get(String(d?.kicad_layer||""))?.id||0),o=i(n[0]),c=i(n[n.length-1]),l=[],f=[];for(let d of s){let m=Ax[d.role],b=r.get(String(d.kicad_layer||"")),y=Tx(t,d.key);if(!m||!b||!y){m&&f.push(d.key);continue}let x=Number(b.z_mm||0)/1e3+a,v=(Number(b.thickness_mm)||Number(d.thickness_nm||0)/1e6)/2e3,M=d.side==="back"||m!=="dielectric"&&m!=="copper"&&x<a,S={key:d.key,role:m,layerId:Number(b.id),side:d.side||null,bounds:y};if(m==="dielectric"){S.color=_x(b.color);let A=[...n].reverse().find(C=>C.order<d.order),_=n.find(C=>C.order>d.order),N=[i(A)||i(_),i(_)||i(A)],I={zTop:x+v,zBottom:x-v};l.push({...S,...I,face:"top",z:x+v-gu,faceDown:!1,outer:!1,offsetLayers:N}),l.push({...S,...I,face:"bottom",z:x-v+gu,faceDown:!0,outer:!1,offsetLayers:N})}else if(m==="copper"){let A=n.indexOf(d),_=A===n.length-1&&n.length>1,N=A===0||_,I={...S,bottom:_,outer:N,zTop:x+v,zBottom:x-v,offsetLayers:[Number(b.id),Number(b.id)]};l.push({...I,face:"top",z:x+v,faceDown:!1,mark:N&&!_,walls:!_}),l.push({...I,face:"bottom",z:x-v,faceDown:!0,mark:_,walls:_})}else{let A=m==="silk"?vu:m==="paste"?wu:0,_=M?c:o;l.push({...S,z:M?x-v-A:x+v+A,faceDown:M,outer:!1,thickness:v*2,offsetLayers:[_,_]})}}Ix(l);let u=l.filter(d=>d.role==="dielectric"),g=u.filter(d=>!d.faceDown).sort((d,m)=>m.z-d.z)[0],p=u.filter(d=>d.faceDown).sort((d,m)=>d.z-m.z)[0];for(let d of u)d.skin=d===g||d===p;let h={dielectric:0,copper:1,mask:2,paste:3,silk:4};return l.sort((d,m)=>h[d.role]-h[m.role]),{planned:l,unmatched:f}}function Ix(t){for(let e of t){if(e.role!=="mask"&&e.role!=="silk"&&e.role!=="paste")continue;let a=t.find(c=>c.role==="copper"&&c.mark&&c.faceDown===e.faceDown);if(!a)continue;let r=e.faceDown?-1:1,s=e.faceDown?a.zTop:a.zBottom,n=e.faceDown?a.zBottom:a.zTop,o=t.find(c=>c.role==="mask"&&c.faceDown===e.faceDown)?.thickness||0;e.role==="mask"?(e.coat=o,e.zLow=s+r*o):e.role==="silk"?e.zLow=s+r*(o+vu):e.z=n+r*wu}}function Yi(t,e){let a=new Float32Array(Math.max(1,e)).fill(Number.NaN);if(ArrayBuffer.isView(t)||Array.isArray(t))for(let r=0;r<Math.min(e,t.length);r+=1)a[r]=Number(t[r]);else for(let[r,s]of Object.entries(t||{})){let n=Number(r);Number.isInteger(n)&&n>=0&&n<e&&(a[n]=Number(s))}return a}function Aa(t){let e=1/0,a=-1/0;for(let r of t)Number.isFinite(r)&&(e=Math.min(e,r),a=Math.max(a,r));return Number.isFinite(e)?[e,a]:[0,1]}function Os(t){let e=new Map,a=1e3;for(let r of t.slices||[]){if(!(r.nx>0&&r.ny>0)||r.values.length!==r.nx*r.ny)throw new Error(`grid field slice ${r.slice_key} has ${r.values.length} values for ${r.nx} x ${r.ny} cells`);e.set(r.slice_key,{originMm:[(t.origin_x_m+r.ix0*t.dx_m)*a,(t.origin_y_m+r.iy0*t.dy_m)*a],pitchMm:[t.dx_m*a,t.dy_m*a],width:r.nx,height:r.ny,values:r.values})}return e}function Eu(t){let e=new Map;for(let r of t||[])e.has(r.slice_key)||e.set(r.slice_key,[]),e.get(r.slice_key).push(r);let a=new Map;for(let[r,s]of e){let n=Number(s[0].pitch_nm);if(!(n>0)||s.some(g=>Number(g.pitch_nm)!==n))throw new Error(`field tiles of ${r} must share one positive pitch`);let i=Math.min(...s.map(g=>g.origin_nm[0])),o=Math.min(...s.map(g=>g.origin_nm[1])),c=(g,p)=>{let h=(g-p)/n;if(!Number.isInteger(h))throw new Error(`field tile of ${r} is off its pitch grid`);return h},l=Math.max(...s.map(g=>c(g.origin_nm[0],i)+g.width)),f=Math.max(...s.map(g=>c(g.origin_nm[1],o)+g.height)),u=new Float32Array(l*f).fill(Number.NaN);for(let g of s){let p=c(g.origin_nm[0],i),h=c(g.origin_nm[1],o);for(let d=0;d<g.height;d+=1)u.set(g.values.subarray?g.values.subarray(d*g.width,(d+1)*g.width):g.values.slice(d*g.width,(d+1)*g.width),(h+d)*l+p)}a.set(r,{originMm:[i/1e6,o/1e6],pitchMm:n/1e6,width:l,height:f,values:u})}return a}var Wi=8,Cs=8,yu=4294967295,Rx=Object.freeze({unplated:2,tentedFront:4,tentedBack:8,coveredFront:16,coveredBack:32,pluggedFront:64,pluggedBack:128,filled:256,capped:512,castellated:1024}),Xi=16;function Nx(t,e,a){let r=null;for(let s=0;t&&s+3<t.length;s+=4){let n=[t[s],t[s+1]],i=[t[s+2],t[s+3]],o=[i[0]-n[0],i[1]-n[1]],c=o[0]*o[0]+o[1]*o[1];if(c<=0)continue;let l=Math.max(0,Math.min(1,((e[0]-n[0])*o[0]+(e[1]-n[1])*o[1])/c)),f=Math.hypot(e[0]-n[0]-l*o[0],e[1]-n[1]-l*o[1]);if(f>a||r&&f>=r.distance)continue;let u=Math.sqrt(c),g=[o[1]/u,o[0]/u];r={distance:f,normal:g,offset:(g[0]*n[0]-g[1]*n[1])/1e3}}return r&&{normal:r.normal,offset:r.offset}}function Mu(t,e,a,r=null){let s=(t.stack?.slices||[]).filter(p=>p.role==="conductor").sort((p,h)=>p.order-h.order),n=new Map((a||[]).filter(p=>p.role===void 0||p.role==="copper").map(p=>[p.key,p])),i=p=>{let h=n.get(p.key);if(!h)return null;if(h.zTop!==void 0)return{top:h.zTop,bottom:h.zBottom,layerId:h.layerId};let d=Number(p.thickness_nm||0)/1e9;return h.bottom?{top:h.z+d,bottom:h.z,layerId:h.layerId}:{top:h.z,bottom:h.z-d,layerId:h.layerId}},o=Math.floor(e.floats.length/Wi),c=new ArrayBuffer(o*Xi*4),l=new Float32Array(c),f=new Uint32Array(c),u=0,g=e.skipped||0;for(let p=0;p<o;p+=1){let h=e.floats.subarray(p*Wi,(p+1)*Wi),d=e.words.subarray(p*Cs,(p+1)*Cs),[m,b]=[Math.min(d[1],d[2]),Math.max(d[1],d[2])],y=s.filter(A=>A.order>=m&&A.order<=b&&(d[3]===yu||A.order>d[3])&&(d[4]===yu||A.order<d[4])),x=y.length?i(y[0]):null,v=y.length?i(y[y.length-1]):null;if(!x||!v){g+=1;continue}let M=u*Xi;l.set([h[0]/1e3,-h[1]/1e3,h[2]/1e3,-h[3],h[4]/1e3,h[5]/1e3,x.top,v.bottom],M),f.set([d[0],x.layerId,v.layerId,d[5]],M+8);let S=d[5]&Rx.castellated?Nx(r,[h[0],h[1]],h[4]+h[2]):null;l.set(S?[S.normal[0],S.normal[1],S.offset,0]:[0,0,1,0],M+12),u+=1}return{data:c.slice(0,u*Xi*4),count:u,skipped:g}}var $i=12,Cx=0,Bx=1;function Su(t,e,a,r=0){let s=(a||[]).filter(p=>p.role==="soldermask").map(p=>Number(p.z_mm)/1e3+r+Math.sign(Number(p.z_mm))*Number(p.thickness_mm||0)/2e3),n=s.length?Math.max(...s):null,i=s.length?Math.min(...s):null,o=t.filter(p=>p.role==="dielectric"&&p.face==="top"&&e.get(p.key)?.contourEdges?.length),c=[],l=(p,h,d,m,b,y)=>{let x=e.get(p.key).contourEdges;for(let v=0;v+3<x.length;v+=4)c.push([x[v],x[v+1],x[v+2],x[v+3],h,d,m,b,y])};for(let p of o)l(p,p.zTop,p.zBottom,p.offsetLayers[0],p.offsetLayers[1],Cx);for(let p of t.filter(h=>h.role==="copper"&&h.face==="top")){let h=v=>Math.min(Math.abs(v.zBottom-p.zTop),Math.abs(v.zTop-p.zBottom)),d=[...o].sort((v,M)=>h(v)-h(M))[0];if(!d)continue;let m=p.outer&&!p.bottom,b=p.outer&&p.bottom,y=m&&n!=null?Math.max(n,p.zTop):p.zTop,x=b&&i!=null?Math.min(i,p.zBottom):p.zBottom;l(d,y,x,p.layerId,p.layerId,Bx)}let f=new ArrayBuffer(c.length*$i*4),u=new Float32Array(f),g=new Uint32Array(f);return c.forEach(([p,h,d,m,b,y,x,v,M],S)=>{u.set([p/1e3,-h/1e3,d/1e3,-m/1e3,b,y,0,0],S*$i),g.set([x,v,M,0],S*$i+8)}),{data:f,count:c.length}}function Tu(t,e){let a=new Map;for(let o of e||[])for(let c of o?.aliases||[])a.has(String(c))||a.set(String(c),Number(o.id));for(let o of e||[])o?.name&&a.set(String(o.name),Number(o.id));let r=t.header.nets||[];if(typeof t.netIndices=="function"){let o=new Uint32Array(r.length+1);r.forEach((f,u)=>{o[u+1]=a.get(f.name??f.key)||a.get(f.key)||0});let c=t.netIndices(),l=new Uint32Array(c.length);for(let f=0;f<c.length;f+=1)l[f]=o[c[f]];return l}let s=new Map(r.map(o=>[o.key,o.name])),n=Ta(t.header),i=new Uint32Array(n);for(let o=0;o<n;o+=1){let c=t.binding(o)?.net_key;c&&(i[o]=a.get(s.get(c)??c)||0)}return i}var Au={Uint32Array,Float32Array},fr=".board";function _u(t,e,a){return{header:t,barrelFloats:e.floats,barrelWords:e.words,barrelSkipped:e.skipped,netIndices:a}}function Fs(t,e,a,r){return`analytic-lowered-a1/${t}/${e}/${a}/${r}`}function Ox(t){let e=[],a=[];for(let[f,u]of Object.entries(t)){if(!ArrayBuffer.isView(u))continue;let g=u.constructor.name;if(!Au[g])throw new TypeError(`cannot cache a ${g} (${f})`);e.push({name:f,kind:g,length:u.length}),a.push(new Uint8Array(u.buffer,u.byteOffset,u.byteLength))}let r=Object.fromEntries(Object.entries(t).filter(([,f])=>!ArrayBuffer.isView(f))),s=new TextEncoder().encode(JSON.stringify({fields:e,rest:r})),n=Math.ceil(s.length/4)*4,i=8+n+a.reduce((f,u)=>f+Math.ceil(u.length/4)*4,0),o=new Uint8Array(i),c=new DataView(o.buffer);c.setUint32(0,1280527440,!0),c.setUint32(4,s.length,!0),o.set(s,8);let l=8+n;for(let f of a)o.set(f,l),l+=Math.ceil(f.length/4)*4;return o}function Ps(t){let e=t instanceof Uint8Array?t:new Uint8Array(t);if(e.length<8)return null;let a=new DataView(e.buffer,e.byteOffset,e.byteLength);if(a.getUint32(0,!0)!==1280527440)return null;let r=a.getUint32(4,!0),s;try{s=JSON.parse(new TextDecoder().decode(e.subarray(8,8+r)))}catch{return null}let n={...s.rest},i=8+Math.ceil(r/4)*4;for(let{name:o,kind:c,length:l}of s.fields){let f=Au[c];if(!f)return null;let u=l*f.BYTES_PER_ELEMENT;if(i+u>e.length||(e.byteOffset+i)%f.BYTES_PER_ELEMENT)return null;n[o]=new f(e.buffer,e.byteOffset+i,l),i+=Math.ceil(u/4)*4}return n}async function hr(t,{cacheKey:e,wasmKey:a,toleranceNm:r},s){let n=new Map;return!t?.read||!e||await Promise.all(s.map(async i=>{try{let o=await t.read(Fs(e,a,r,i)),c=o?Ps(o):null;c&&n.set(i,c)}catch{}})),n}function Ji(t,{cacheKey:e,wasmKey:a,toleranceNm:r},s){return!t?.write||!e?Promise.resolve():Promise.all([...s].map(([n,i])=>t.write(Fs(e,a,r,n),i instanceof Uint8Array?i:Ox(i)).catch(()=>{}))).then(()=>{})}function Iu(t,e,a){return`analytic-lowered-a1/${t}/${e}/${a}/.complete`}async function Ru(t,{cacheKey:e,wasmKey:a,toleranceNm:r}){if(!t?.read||!e)return!1;try{return!!await t.read(Iu(e,a,r))}catch{return!1}}async function Nu(t,{cacheKey:e,wasmKey:a,toleranceNm:r},s=Promise.resolve()){!t?.write||!e||(await s,await t.write(Iu(e,a,r),new Uint8Array([1])).catch(()=>{}))}var Fx="prism-semantic-viewer-lower.js",js=3;function Px(){if(typeof Worker>"u")return null;try{let t=new URL(import.meta.url),e=t.searchParams.get("v");return new URL(`${Fx}${e?`?v=${e}`:""}`,t)}catch{return null}}function Ls(t,e=globalThis.navigator?.hardwareConcurrency||4){return Math.max(1,Math.min(js,Math.max(1,e-1),t))}function jx(t,e,a){let r=Array.from({length:Math.max(1,a)},()=>({keys:[],load:0})),s=new Map(t.map((i,o)=>[i,o])),n=[...t].sort((i,o)=>(e.get(o)||1)-(e.get(i)||1)||s.get(i)-s.get(o));for(let i of n){let o=r.reduce((c,l)=>l.load<c.load?l:c,r[0]);o.keys.push(i),o.load+=e.get(i)||1}return r.filter(i=>i.keys.length).map(i=>i.keys.sort((o,c)=>s.get(o)-s.get(c)))}function Cu(t){let e=new Map;for(let a of t?.chunks||[])e.set(a.slice_key,(e.get(a.slice_key)||0)+Number(a.operation_count||0));return e}var Qi=new Map;function Lx(t){if(!Qi.has(t)){let e=typeof WebAssembly?.compileStreaming=="function"&&typeof fetch=="function"?WebAssembly.compileStreaming(fetch(t)).catch(()=>null):Promise.resolve(null);Qi.set(t,e)}return Qi.get(t)}var br=class t{static start(e,a,r=Ls(js)){let s=Px();if(!s||typeof a!="string")return null;let n=[],i=Lx(a);for(let o=0;o<r;o+=1){let c;try{c=new Worker(s,{type:"module",name:`analytic-lower-${o}`})}catch{break}let l={worker:c,pending:new Map,alive:!0};c.onmessage=({data:u})=>{let g=l.pending.get(u.id);l.pending.delete(u.id),g?.(u)},c.onerror=u=>{u.preventDefault?.(),l.alive=!1;for(let g of l.pending.values())g({error:"worker failed"});l.pending.clear()},l.opened=new Promise(u=>l.pending.set(0,g=>u(g.error?null:g.header)));let f=(e instanceof Uint8Array?e:new Uint8Array(e)).slice();i.then(u=>c.postMessage({type:"open",bytes:f.buffer,wasmUrl:a,wasmModule:u},[f.buffer])),n.push(l)}return n.length?new t(n):null}constructor(e){this.members=e,this.nextId=1}async header(){for(let e of this.members){let a=await e.opened;if(a&&e.alive)return a}return null}async host(){for(let e of this.members)if(await e.opened&&e.alive)return e;return null}async ask(e,a={},r=[],s=null){let n=s||await this.host();if(!n)throw new Error("no lowering worker has the pack open");return new Promise((i,o)=>{let c=this.nextId++;n.pending.set(c,l=>l.error?o(new Error(l.error)):i(l)),n.worker.postMessage({type:e,id:c,...a},r)})}async steps(e,a=null,r=[]){let s=[];for(let o of this.members)await o.opened&&o.alive&&s.push(o);let n=(o,c)=>Object.fromEntries(c.map(l=>[l,ArrayBuffer.isView(o[l])?o[l].slice():o[l]])),i=["shapes","subtractShapes","contourEdges","contourEdgeOperations","outlineEdges","outlineShapes"];return Promise.all(e.map(([o,c],l)=>{if(!s.length)return null;let f={key:r[l],store:a?.identity??null,copper:n(o,i),mask:n(c,["shapes","subtractShapes"])},u=s[l%s.length];return a&&a.writes.push(this.stored(u,this.nextId,a)),this.ask("step",f,[],u).then(g=>g.step,()=>null)}))}stored(e,a,r){return new Promise(s=>e.pending.set(-a,n=>{for(let[i,o]of n.stored||[])r.adopt(i,o);s()}))}async release(){let e=await this.host();for(let a of this.members)a!==e&&a.worker.terminate();this.members=e?[e]:[]}async lower(e,a,r=new Map,s=null){if(!e.length)return new Map;let n=await Promise.all(this.members.map(f=>f.opened)),i=this.members.filter((f,u)=>n[u]&&f.alive);if(!i.length)return null;let o=jx(e,r,i.length),c=await Promise.all(o.map((f,u)=>new Promise(g=>{let p=i[u],h=this.nextId++;s&&s.writes.push(this.stored(p,h,s)),p.pending.set(h,d=>g(d.error?null:new Map(Object.entries(d.lowered)))),p.worker.postMessage({type:"lower",id:h,keys:f,toleranceNm:a,store:s?.identity??null})})));if(c.every(f=>f===null))return null;let l=new Map;for(let f of c)for(let[u,g]of f||[])l.set(u,g);return l}close(){for(let e of this.members)e.worker.terminate();this.members=[]}};async function Bu(t){let e=await t.header();if(!e)return null;let a=Ta(e);return{header:e,hosted:!0,async barrels(){return(await t.ask("barrels")).barrels},async netIndices(){return(await t.ask("netIndices",{count:a})).indices},async binding(r){return(await t.ask("binding",{index:r})).binding},free(){t.close()}}}function Ou(t,e){return{header:t.header,hosted:!0,async barrels(){return{floats:t.barrelFloats,words:t.barrelWords,skipped:t.barrelSkipped}},async netIndices(){return t.netIndices},async binding(a){if(!e)throw new Error("no worker holds the pack");return(await e.ask("binding",{index:a})).binding},free(){e?.close()}}}async function Fu(t,e,a,r,{weights:s=new Map,workers:n}={}){if(!e.length)return new Map;let i=br.start(t,r,n??Ls(e.length));if(!i)return null;try{return await i.lower(e,a,s)}finally{i.close()}}function Pu(t,e){let a=new Float32Array(t.buffer,t.byteOffset+e*20*4,20),[r,s,n,i,o,c]=[a[4],a[5],a[6],a[7],a[8],a[9]],l=[1/0,1/0,-1/0,-1/0];for(let[f,u]of[[a[10],a[11]],[a[12],a[11]],[a[10],a[13]],[a[12],a[13]]]){let g=r*f+s*u+o,p=n*f+i*u+c;l[0]=Math.min(l[0],g),l[1]=Math.min(l[1],p),l[2]=Math.max(l[2],g),l[3]=Math.max(l[3],p)}return l}function Lu(t){let e=t.contourEdges||new Float32Array(0),a=t.contourEdgeOperations||new Uint32Array(0),r=t.shapeCuts||new Uint32Array(0),s=t.edgeCuts||new Uint32Array(0),n=t.cutIndices||new Uint32Array(0),i=r.length,o=new Uint32Array(Math.max(1,i+n.length));for(let m=0;m<i;m+=2)o[m]=r[m]+i,o[m+1]=r[m+1];o.set(n,i);let c=t.outlineEdges||new Float32Array(0),l=t.outlineShapes||new Uint32Array(0),f=Math.min(e.length/4,a.length),u=new Uint32Array(Math.max(1,f+l.length)*7),g=new Uint32Array(e.buffer,e.byteOffset,e.length),p=0;for(let m=0;m<f;m+=1){if(a[m]&2147483648)continue;let b=p*7;u[b]=g[m*4],u[b+1]=g[m*4+1],u[b+2]=g[m*4+2],u[b+3]=g[m*4+3],u[b+4]=a[m],u[b+5]=(s[m*2]??0)+i,u[b+6]=s[m*2+1]??0,p+=1}let h=p,d=new Uint32Array(c.buffer,c.byteOffset,c.length);for(let m=0;m<l.length;m+=1){let b=p*7;u[b]=d[m*4],u[b+1]=d[m*4+1],u[b+2]=d[m*4+2],u[b+3]=d[m*4+3],u[b+4]=(1073741824|l[m])>>>0,p+=1}return{edgeWords:u,cutWords:o,regionEdges:h,skirtEdges:p-h}}function to(t){return t.edgeWords?t:Object.assign(t,Lu(t))}function Du(t,e,a=.05){let r=e.shapes.subarray(0,e.subtractShapes*20),s=t.shapes.length/20,n=new Uint32Array(t.shapes.length+r.length);n.set(t.shapes),n.set(r,t.shapes.length);let i=r.length/20,o=new Float64Array(i*4),[c,l,f,u]=[1/0,1/0,-1/0,-1/0];for(let R=0;R<i;R+=1){let j=Pu(r,R);o.set(j,R*4),c=Math.min(c,j[0]),l=Math.min(l,j[1]),f=Math.max(f,j[2]),u=Math.max(u,j[3])}let[g,p]=[Math.floor(c),Math.floor(l)],h=i?Math.floor(f)-g+1:0,d=i?Math.floor(u)-p+1:0,m=(R,j,q)=>Math.min(q-1,Math.max(0,Math.floor(R)-j)),b=new Uint32Array(h*d+1),y=(R,j)=>{let[q,$]=[m(o[R*4],g,h),m(o[R*4+2],g,h)],[Z,me]=[m(o[R*4+1],p,d),m(o[R*4+3],p,d)];for(let se=q;se<=$;se+=1)for(let ge=Z;ge<=me;ge+=1)j(se*d+ge)};for(let R=0;R<i;R+=1)y(R,j=>{b[j+1]+=1});for(let R=0;R<h*d;R+=1)b[R+1]+=b[R];let x=new Uint32Array(b[h*d]),v=b.slice(0,h*d);for(let R=0;R<i;R+=1)y(R,j=>{x[v[j]++]=R});let M=[],S=[],A=new Uint32Array(i),_=0,N=(R,j,q,$)=>{let Z=M.length;if(_+=1,i&&Math.floor(q)>=g&&Math.floor(R)<=g+h-1&&Math.floor($)>=p&&Math.floor(j)<=p+d-1){let[me,se]=[m(R,g,h),m(q,g,h)],[ge,Se]=[m(j,p,d),m($,p,d)];for(let be=me;be<=se;be+=1)for(let Te=ge;Te<=Se;Te+=1){let ye=be*d+Te;for(let Ce=b[ye];Ce<b[ye+1];Ce+=1){let Ae=x[Ce];A[Ae]!==_&&(A[Ae]=_,o[Ae*4]<=q&&R<=o[Ae*4+2]&&o[Ae*4+1]<=$&&j<=o[Ae*4+3]&&M.push(s+Ae))}}}S.push(Z,M.length-Z)};for(let R=t.subtractShapes;R<s;R+=1){let j=Pu(t.shapes,R);N(j[0]-a,j[1]-a,j[2]+a,j[3]+a)}let I=s-t.subtractShapes,C=t.contourEdges||new Float32Array(0);for(let R=0;R+3<C.length;R+=4)N(Math.min(C[R],C[R+2])-a,Math.min(C[R+1],C[R+3])-a,Math.max(C[R],C[R+2])+a,Math.max(C[R+1],C[R+3])+a);let B=Lu({...t,shapeCuts:new Uint32Array(S.slice(0,I*2)),edgeCuts:new Uint32Array(S.slice(I*2)),cutIndices:new Uint32Array(M)});return{shapes:n,...B}}function Uu(t){let e=[];for(let a of t){if(a.role!=="mask"||a.zLow===void 0)continue;let r=t.find(s=>s.role==="copper"&&s.mark&&s.faceDown===a.faceDown);r&&e.push([a,r])}return e}function Ds(t,e){return`step:${t.key}:${e.key}`}function zu(t){let e=t.contourEdges||new Float32Array(0),a=t.contourEdgeOperations||new Uint32Array(0),r=[];for(let u=0;u<a.length&&u*4+3<e.length;u+=1)a[u]&2147483648||r.push(u);if(!r.length)return null;let[s,n]=[e[r[0]*4],e[r[0]*4+1]],i=new Float32Array(r.length*6),o=[1/0,1/0,-1/0,-1/0],c=new Float32Array(r.length*4),l=new Uint32Array(r.length);r.forEach((u,g)=>{let[p,h,d,m]=e.subarray(u*4,u*4+4);i.set([s,n,p,h,d,m],g*6),c.set([p,h,d,m],g*4),l[g]=a[u],o[0]=Math.min(o[0],p,d),o[1]=Math.min(o[1],h,m),o[2]=Math.max(o[2],p,d),o[3]=Math.max(o[3],h,m)});let f=new Uint32Array(6);return f[0]=a[r[0]],f.set(new Uint32Array(Float32Array.from(o).buffer),2),to({shapes:new Uint32Array(0),subtractShapes:0,fanVertices:i,covers:f,batches:new Uint32Array([0,0,r.length*3,0,1]),contourEdges:c,contourEdgeOperations:l})}var zs={color:{srcFactor:"src-alpha",dstFactor:"one-minus-src-alpha"},alpha:{srcFactor:"one",dstFactor:"one-minus-src-alpha"}};function ro(t){let e=Float32Array.from(t);for(let a=0;a<e.length;a+=1)Number.isFinite(e[a])||(e[a]=3e38);return e}var Us=2,Ux=5e-4,zx={mask:"soldermask",silk:"silkscreen",paste:"paste"};function Gx(t,e){let a=zx[e.role];return!!(t?.size&&a)&&t.has(Vx(a,e.faceDown?"back":"front"))}function Kx(t,e){let a=e?.soldermask?.front;return!t.soldermask&&a?.length>=3&&(t.soldermask={color:a,metallic:0,roughness:.6}),!t.paste&&e?.paste?.length>=3&&(t.paste={color:e.paste,metallic:0,roughness:.45}),!t.silkscreen&&e?.silkscreen?.length>=3&&(t.silkscreen={color:e.silkscreen,metallic:0,roughness:.8}),t}function Vx(t,e){return`${t}:${e}`}var qx=128*1048576,no=class{constructor(e){this.budget=e,this.entries=new Map,this.generation=0}texture(e,a){let r=e.values,s=this.entries.get(r);return s?this.entries.delete(r):s={texture:a(),bytes:e.width*e.height*4},s.used=this.generation,this.entries.set(r,s),s.texture}bytes(){let e=0;for(let a of this.entries.values())e+=a.bytes;return e}trim(){let e=this.bytes();for(let[a,r]of this.entries){if(e<=this.budget)break;r.used!==this.generation&&(r.texture.destroy(),e-=r.bytes,this.entries.delete(a))}this.generation+=1}clear(){for(let e of this.entries.values())e.texture.destroy();this.entries.clear()}},Wu=.3,Xu=new WeakMap,$u=new WeakMap;function Ju(t){let e=Xu.get(t);return e||(e={layout:t.createBindGroupLayout({label:"analytic",entries:[{binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}},{binding:1,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}},{binding:2,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:"read-only-storage"}},{binding:3,visibility:GPUShaderStage.VERTEX,buffer:{type:"read-only-storage"}},{binding:4,visibility:GPUShaderStage.FRAGMENT,buffer:{type:"read-only-storage"}},{binding:5,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:"unfilterable-float"}},{binding:6,visibility:GPUShaderStage.FRAGMENT,buffer:{type:"read-only-storage"}},{binding:7,visibility:GPUShaderStage.FRAGMENT,buffer:{type:"read-only-storage"}},{binding:8,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:"read-only-storage"}},{binding:9,visibility:GPUShaderStage.FRAGMENT,buffer:{type:"read-only-storage"}},{binding:10,visibility:GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}},{binding:11,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:"uint"}}]}),module:t.createShaderModule({label:"analytic",code:Vl})},Xu.set(t,e)),e}function Yu(t){let e=Ju(t.device);return{device:t.device,depthFormat:t.depthFormat,stencil:t.stencil,samples:t.sampleCount||1,layout:e.layout,module:e.module}}function io(t){return`${t.format}|${t.sampleCount||1}|${t.depthFormat}|${t.stencil?1:0}`}function oo(t){let e=$u.get(t);return e||(e=new Map,$u.set(t,e)),e}function Hx(t){return oo(t.device).get(io(t))?.ready||null}function Wx(t,e){let a=oo(t.device),r=io(t);return a.get(r)?.ready||a.set(r,{ready:e,promise:Promise.resolve(e)}),e}function so(t,e,a,r){let s=t.device.createPipelineLayout({bindGroupLayouts:[t.layout]}),n=(o,c,l,f,u=[],g=!1,p="none")=>{let h=cs[f],d={format:t.depthFormat,depthWriteEnabled:h.depth,depthCompare:h.depth||h.depthTest?"greater":"always"};return t.stencil&&Object.assign(d,{stencilFront:h.face,stencilBack:h.face,stencilReadMask:h.read,stencilWriteMask:h.write}),r({label:`analytic-${o}${a?"-pick":""}`,layout:s,vertex:{module:t.module,entryPoint:c,buffers:u},fragment:{module:t.module,entryPoint:a?`${l}_pick`:l,...a?{}:{constants:{SAMPLES:t.samples}},targets:[{format:e,writeMask:h.color?GPUColorWrite.ALL:0,...g&&!a?{blend:zs}:{}}]},primitive:{topology:"triangle-list",cullMode:p},depthStencil:d,multisample:{count:a?1:t.samples}})},i=[{arrayStride:8,attributes:[{shaderLocation:0,offset:0,format:"float32x2"}]}];return{shapeMask:n("shape-mask","vs_shape","fs_shape_mask","shapeMask"),shapeAdd:n("shape","vs_shape","fs_shape","shapeAdd"),fan:n("fan","vs_fan","fs_plain_mask","fan",i),coverSubtract:n("cover-subtract","vs_cover","fs_plain_mask","coverSubtract"),coverMark:n("cover-mark","vs_cover","fs_plain_mask","coverMark"),coverAdd:n("cover","vs_cover","fs_cover","coverAdd"),coverClear:n("cover-clear","vs_cover","fs_plain_mask","coverClear"),clear:n("clear","vs_clear","fs_plain_mask","clear"),regionWall:n("region-wall","vs_region_wall","fs_region_wall","solid"),skirt:n("skirt","vs_skirt","fs_skirt","solid"),...a?{}:{shapeLay:n("shape-lay","vs_shape","fs_shape_mask","shapeLay"),coverLay:n("cover-lay","vs_cover","fs_cover_mask","coverLay"),shapeBlend:n("shape-blend","vs_shape","fs_shape","shapeBlend",[],!0),coverBlend:n("cover-blend","vs_cover","fs_cover","coverBlend",[],!0),tintCovered:n("tint-covered","vs_clear","fs_tint_covered","tintCovered",[],!0),tintPlain:n("tint-plain","vs_clear","fs_tint_plain","tintPlain",[],!0),footShape:n("foot-shape","vs_shape","fs_shape_mask","footShape"),footCover:n("foot-cover","vs_cover","fs_cover_mask","footCover"),tintHigh:n("tint-high","vs_clear","fs_tint_covered","tintHigh",[],!0),tintLow:n("tint-low","vs_clear","fs_tint_plain","tintLow",[],!0),regionStep:n("region-step","vs_region_step","fs_region_step","coat"),step:n("step","vs_step","fs_step","coat"),clearLay:n("clear-lay","vs_clear","fs_plain_mask","clearLay"),clearFoot:n("clear-foot","vs_clear","fs_plain_mask","clearFoot"),shapeOnFoot:n("shape-on-foot","vs_shape","fs_shape","shapeOnFoot",[],!0),shapeOffFoot:n("shape-off-foot","vs_shape","fs_shape","shapeOffFoot",[],!0),coverOnFoot:n("cover-on-foot","vs_cover","fs_cover","coverOnFoot",[],!0),coverOffFoot:n("cover-off-foot","vs_cover","fs_cover","coverOffFoot",[],!0)}}}var $t=class{constructor(e){this.renderer=e,this.device=e.device,this.stencil=e.stencil,this.samples=e.sampleCount||1,this.slices=[],this.skin=null,this.eye=null,this.viewMatrix=null,this.extent=null,this.overlay={mode:0,range:[0,1]};let a=Ju(this.device);this.layout=a.layout,this.module=a.module,this.boardClip=null,this.emptyClip=this.device.createTexture({label:"analytic-clip-none",size:[1,1],format:"r8uint",usage:GPUTextureUsage.TEXTURE_BINDING}),this.palette=this.device.createBuffer({label:"analytic-palette",size:8208,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),this.style=Vi(tr),this.writePalette(),this.pipelines=Hx(e)||Wx(e,{color:this.makePipelines(e.format,!1),pick:this.makePipelines("rg32uint",!0)}),this.emptyValues=this.buffer(new Float32Array([3e38]),GPUBufferUsage.STORAGE,"analytic-values-empty"),this.valuesBuffer=this.emptyValues,this.emptyField=this.fieldTexture(1,1,new Float32Array([3e38])),this.uniformScratch=new ArrayBuffer(256),this.netsBuffer=this.buffer(new Uint32Array(1),GPUBufferUsage.STORAGE,"analytic-nets"),this.fieldCache=new no(qx),this.makeBarrelPipelines(),this.makeArrowPipeline()}globals(){return this.renderer.analyticGlobalBuffer||this.renderer.globalBuffer}makeArrowPipeline(){this.arrowLayout=this.device.createBindGroupLayout({label:"analytic-arrows",entries:[{binding:0,visibility:GPUShaderStage.VERTEX,buffer:{type:"uniform"}},{binding:1,visibility:GPUShaderStage.VERTEX,buffer:{type:"read-only-storage"}},{binding:2,visibility:GPUShaderStage.VERTEX,buffer:{type:"read-only-storage"}},{binding:3,visibility:GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}},{binding:4,visibility:GPUShaderStage.VERTEX,buffer:{type:"read-only-storage"}}]}),this.drawnLayers=new Uint32Array(256),this.drawnLayersBuffer=this.buffer(this.drawnLayers,GPUBufferUsage.STORAGE,"analytic-drawn-layers");let e=this.device.createShaderModule({label:"analytic-arrows",code:Yl});this.arrowPipeline=this.device.createRenderPipeline({label:"analytic-arrow",layout:this.device.createPipelineLayout({bindGroupLayouts:[this.arrowLayout]}),vertex:{module:e,entryPoint:"vs_arrow"},fragment:{module:e,entryPoint:"fs_arrow",targets:[{format:this.renderer.format,blend:zs}]},primitive:{topology:"triangle-list",cullMode:"none"},depthStencil:{format:this.renderer.depthFormat,depthWriteEnabled:!1,depthCompare:"greater-equal"},multisample:{count:this.samples}}),this.arrows=null}writePalette(){let e=new Float32Array(8208/4);e.set(Ki(this.style.fieldColormap,Ea),0),e.set(Ki(this.style.arrowColormap,Ea),Ea*4),e.set(this.style.arrowOutline,2*Ea*4),this.device.queue.writeBuffer(this.palette,0,e),this.renderer.invalidate?.()}setStyle(e){return this.style=Vi(e,this.style),this.writePalette(),this.style}setArrows(e){this.arrows?.buffer.destroy(),this.arrows=e?.count?{buffer:this.buffer(new Uint8Array(e.data),GPUBufferUsage.STORAGE,"analytic-arrows"),count:e.count}:null,this.arrows&&(this.arrows.bindGroup=this.device.createBindGroup({layout:this.arrowLayout,entries:[{binding:0,resource:{buffer:this.globals()}},{binding:1,resource:{buffer:this.arrows.buffer}},{binding:2,resource:{buffer:this.layerOffsets}},{binding:3,resource:{buffer:this.palette}},{binding:4,resource:{buffer:this.drawnLayersBuffer}}]})),this.renderer.invalidate?.()}encodeArrows(e){return this.arrows?(this.device.queue.writeBuffer(this.drawnLayersBuffer,0,this.drawnLayers),e.setPipeline(this.arrowPipeline),e.setBindGroup(0,this.arrows.bindGroup),e.draw(9,2*this.arrows.count),1):0}makeBarrelPipelines(){let e=GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT;this.barrelLayout=this.device.createBindGroupLayout({label:"analytic-barrels",entries:[{binding:0,visibility:e,buffer:{type:"uniform"}},{binding:1,visibility:e,buffer:{type:"uniform"}},{binding:2,visibility:e,buffer:{type:"read-only-storage"}},{binding:3,visibility:GPUShaderStage.FRAGMENT,buffer:{type:"read-only-storage"}},{binding:4,visibility:e,buffer:{type:"read-only-storage"}},{binding:5,visibility:e,buffer:{type:"read-only-storage"}},{binding:6,visibility:e,buffer:{type:"read-only-storage"}},{binding:7,visibility:GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}}]});let a=this.device.createShaderModule({label:"analytic-barrels",code:Xl}),r=this.device.createPipelineLayout({bindGroupLayouts:[this.barrelLayout]}),s=(o,c)=>this.device.createRenderPipeline({label:`analytic-barrel${c?"-pick":""}`,layout:r,vertex:{module:a,entryPoint:"vs_barrel",constants:{PICK_PASS:c?1:0}},fragment:{module:a,entryPoint:c?"fs_barrel_pick":"fs_barrel",targets:[{format:o}],constants:{PICK_PASS:c?1:0}},primitive:{topology:"triangle-list",cullMode:"back"},depthStencil:{format:this.renderer.depthFormat,depthWriteEnabled:!0,depthCompare:"greater"},multisample:{count:c?1:this.samples}});this.barrelPipelines={color:s(this.renderer.format,!1),pick:s("rg32uint",!0)},this.ghostPipeline=this.device.createRenderPipeline({label:"analytic-ghost-barrel",layout:r,vertex:{module:a,entryPoint:"vs_ghost"},fragment:{module:a,entryPoint:"fs_ghost",targets:[{format:this.renderer.format,blend:zs}]},primitive:{topology:"triangle-list",cullMode:"none"},depthStencil:{format:this.renderer.depthFormat,depthWriteEnabled:!1,depthCompare:"greater"},multisample:{count:this.samples}}),this.barrelView=this.device.createBuffer({label:"analytic-barrel-view",size:gi,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),this.layerOffsets=this.device.createBuffer({label:"analytic-layer-offsets",size:256*4,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),this.viewScratch=new ArrayBuffer(gi),this.barrels=null;let n=this.device.createShaderModule({label:"analytic-walls",code:$l}),i=o=>this.device.createRenderPipeline({label:`analytic-wall${o?"-blend":""}`,layout:r,vertex:{module:n,entryPoint:"vs_wall"},fragment:{module:n,entryPoint:"fs_wall",targets:[{format:this.renderer.format,...o?{blend:zs}:{}}]},primitive:{topology:"triangle-list",cullMode:"none"},depthStencil:{format:this.renderer.depthFormat,depthWriteEnabled:!0,depthCompare:"greater"},multisample:{count:this.samples}});this.wallPipelines={opaque:i(!1),blend:i(!0)},this.walls=null}setWalls({data:e,count:a}){this.walls?.buffer.destroy(),this.walls=a?{buffer:this.buffer(new Uint8Array(e),GPUBufferUsage.STORAGE,"analytic-walls"),count:a,bindGroup:null}:null,this.walls&&(this.walls.bindGroup=this.wallBindGroup()),this.renderer.invalidate?.()}wallBindGroup(){return this.device.createBindGroup({layout:this.barrelLayout,entries:[{binding:0,resource:{buffer:this.globals()}},{binding:1,resource:{buffer:this.barrelView}},{binding:2,resource:{buffer:this.walls.buffer}},{binding:3,resource:{buffer:this.valuesBuffer}},{binding:4,resource:{buffer:this.layerOffsets}},{binding:5,resource:{buffer:this.netsBuffer}},{binding:6,resource:{buffer:this.renderer.netMaskBuffer}},{binding:7,resource:{buffer:this.palette}}]})}encodeWalls(e,a){return this.walls?(e.setPipeline(a?this.wallPipelines.blend:this.wallPipelines.opaque),e.setBindGroup(0,this.walls.bindGroup),e.draw(6,this.walls.count),1):0}writeView(e,a,r={}){let s=new Float32Array(256);a&&s.set(a.subarray?a.subarray(0,256):a.slice(0,256)),this.device.queue.writeBuffer(this.layerOffsets,0,s);let n=new Float32Array(this.viewScratch),i=new Uint32Array(this.viewScratch);n.fill(0),this.eye=Yx(e),this.viewMatrix=e,n.set(this.eye,0),n.set(this.renderer.barrelColor||[.55,.35,.16,1],4);let o=this.laminateColor()||this.boardLooks().substrate?.color||[.3,.32,.25,1],c=(r.boardOpacity??1)*(.15+.85*(r.assemblyOpacity??1));n.set([...o.slice(0,3),c],8);let l=this.overlay.mode===1||this.overlay.mode===2&&this.valuesBuffer!==this.emptyValues;i[12]=l?1:0,i[13]=r.isolateNet?1:0,i[14]=this.boardShown(r)?1:0,i[15]=this.boardShown(r)&&(r.boardOpacity??1)>=.999&&this.renderer.innerCopperMode!=="all"?1:0,n.set(this.overlay.range,16),this.separated=!!a&&Array.prototype.some.call(a,f=>Math.abs(f)>1e-12),i[18]=this.separated?1:0,n.set(this.edgePlated?[...(this.renderer.barrelColor||[.55,.35,.16]).slice(0,3),c]:[...o.slice(0,3),c],20),n.set([...(this.boardLooks().soldermask?.color||[.06,.16,.11]).slice(0,3),1],24),this.device.queue.writeBuffer(this.barrelView,0,this.viewScratch)}setBarrels({data:e,count:a,skipped:r=0}){this.barrels?.buffer.destroy(),this.barrels=a?{buffer:this.buffer(new Uint8Array(e),GPUBufferUsage.STORAGE,"analytic-barrels"),count:a,skipped:r,bindGroup:null}:null,this.barrels&&(this.barrels.bindGroup=this.barrelBindGroup()),this.renderer.invalidate?.()}hasBarrels(){return!!this.barrels}barrelBindGroup(){return this.device.createBindGroup({layout:this.barrelLayout,entries:[{binding:0,resource:{buffer:this.globals()}},{binding:1,resource:{buffer:this.barrelView}},{binding:2,resource:{buffer:this.barrels.buffer}},{binding:3,resource:{buffer:this.valuesBuffer}},{binding:4,resource:{buffer:this.layerOffsets}},{binding:5,resource:{buffer:this.netsBuffer}},{binding:6,resource:{buffer:this.renderer.netMaskBuffer}},{binding:7,resource:{buffer:this.palette}}]})}encodeBarrels(e,a,r,s=!1){return this.barrels?(r&&this.writeView(r,a,this.context),e.setPipeline(s?this.barrelPipelines.pick:this.barrelPipelines.color),e.setBindGroup(0,this.barrels.bindGroup),e.draw(36,this.barrels.count),1):0}encodeGhostBarrels(e){return!this.barrels||!this.separated?0:(e.setPipeline(this.ghostPipeline),e.setBindGroup(0,this.barrels.bindGroup),e.draw(Wl,this.barrels.count),1)}buffer(e,a,r){let s=Math.max(16,Math.ceil(e.byteLength/4)*4),n=this.device.createBuffer({label:r,size:s,usage:a|GPUBufferUsage.COPY_DST});return e.byteLength&&this.device.queue.writeBuffer(n,0,e),n}fieldTexture(e,a,r){let s=this.device.createTexture({label:"analytic-field",size:[e,a],format:"r32float",usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST});return this.device.queue.writeTexture({texture:s},r,{bytesPerRow:e*4},[e,a]),s}makePipelines(e,a){return so(Yu(this.renderer),e,a,r=>this.device.createRenderPipeline(r))}static prewarm(e){let a=io(e),r=oo(e.device),s=r.get(a);if(s)return s.promise;let n=Yu(e),i=l=>e.device.createRenderPipelineAsync(l),o=async l=>Object.fromEntries(await Promise.all(Object.entries(l).map(async([f,u])=>[f,await u]))),c={ready:null,promise:null};return c.promise=Promise.all([o(so(n,e.format,!1,i)),o(so(n,"rg32uint",!0,i))]).then(([l,f])=>(c.ready={color:l,pick:f},c.ready)).catch(()=>(r.delete(a),null)),r.set(a,c),c.promise}setSlices(e){this.releaseSlices();let a=new Map;this.slices=e.map(o=>this.uploadSlice(o,a)),this.makePlainSlabs(a),this.makeTwins();let r=e.map(o=>o.z),s=e.flatMap(o=>[o.bounds[0],o.bounds[2]]),n=e.flatMap(o=>[o.bounds[1],o.bounds[3]]);this.extent=e.length?[[Math.min(...s)/1e3,-Math.max(...n)/1e3,Math.min(...r)],[Math.max(...s)/1e3,-Math.min(...n)/1e3,Math.max(...r)]]:null;let i=e.filter(o=>o.skin);this.skin=i.length===2?{top:Math.max(...i.map(o=>o.z)),bottom:Math.min(...i.map(o=>o.z))}:null,this.renderer.invalidate?.()}makeTwins(){this.twinBuffers?.forEach(a=>a.destroy()),this.twinBuffers=[];let e=(a,r)=>{let s={...a,...r,uniform:this.device.createBuffer({label:`analytic-twin-${a.key}`,size:256,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),field:null};return s.bindGroup=this.bindGroup(s),s};this.twins=new Map;for(let a of this.slices){if(a.zLow===void 0||a.role!=="mask"&&a.role!=="silk")continue;let r={low:e(a,{z:a.zLow})},s=a.role==="mask"&&this.slices.find(n=>n.role==="copper"&&n.mark&&n.faceDown===a.faceDown);if(s){let n=this.uploadOpenings(s,a,a.step),i=a.faceDown?s.zTop:s.zBottom;r.foot=e(s,{role:"footprint",z:a.z,dilate:Ux,mark:!1,walls:!1,zTop:Math.max(a.z,i),zBottom:Math.min(a.z,i),...n})}this.twins.set(a,r)}}uploadOpenings(e,a,r=null){let s=r||Du(e.lowered,a.lowered),n=this.uploadEdges(s,`${e.key}-step`),i=this.buffer(s.shapes,GPUBufferUsage.STORAGE,`analytic-step-shapes-${e.key}`);return this.twinBuffers.push(i,n.edges,n.cuts),{...n,shapes:i}}uploadSlice(e,a=new Map){let{lowered:r}=e,s=GPUBufferUsage.STORAGE;a.has(r)||a.set(r,{shapes:this.buffer(r.shapes,s,`analytic-shapes-${e.key}`),covers:this.buffer(r.covers,s,`analytic-covers-${e.key}`),fans:r.fanVertices.length?this.buffer(r.fanVertices,GPUBufferUsage.VERTEX,`analytic-fans-${e.key}`):null,...this.uploadEdges(r,e.key)});let n={...e,...a.get(r),uniform:this.device.createBuffer({label:`analytic-slice-${e.key}`,size:256,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),shapeCount:r.shapes.length/20,subtractShapes:r.subtractShapes,batches:[],field:null};for(let i=0;i<r.batches.length;i+=5){let[o,c,l,f,u]=r.batches.subarray(i,i+5);n.batches.push({subtract:o===1,firstVertex:c,vertexCount:l,firstCover:f,coverCount:u})}return n.bindGroup=this.bindGroup(n),n}uploadEdges(e,a){let{edgeWords:r,cutWords:s,regionEdges:n,skirtEdges:i}=to(e);return{edges:this.buffer(r,GPUBufferUsage.STORAGE,`analytic-edges-${a}`),regionEdges:n,skirtEdges:i,cuts:this.buffer(s,GPUBufferUsage.STORAGE,`analytic-cuts-${a}`)}}bindGroup(e){return this.device.createBindGroup({layout:this.layout,entries:[{binding:0,resource:{buffer:this.globals()}},{binding:1,resource:{buffer:e.uniform}},{binding:2,resource:{buffer:e.shapes}},{binding:3,resource:{buffer:e.covers}},{binding:4,resource:{buffer:this.valuesBuffer}},{binding:5,resource:(e.field?.texture||this.emptyField).createView()},{binding:6,resource:{buffer:this.netsBuffer}},{binding:7,resource:{buffer:this.renderer.netMaskBuffer}},{binding:8,resource:{buffer:e.edges}},{binding:9,resource:{buffer:e.cuts}},{binding:10,resource:{buffer:this.palette}},{binding:11,resource:(this.boardClip?.texture||this.emptyClip).createView()}]})}setBoardClipMask(e){if(!e)return this.setBoardClip(null),null;let{data:a,width:r,height:s}=Xx(e),n=[e.originMm[0]-e.pitchMm,e.originMm[1]-e.pitchMm],i=Math.ceil(r/256)*256,o=i===r?a:new Uint8Array(i*s);if(o!==a)for(let l=0;l<s;l+=1)o.set(a.subarray(l*r,(l+1)*r),l*i);let c=this.device.createTexture({label:"analytic-clip",size:[r,s],format:"r8uint",usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST});return this.device.queue.writeTexture({texture:c},o,{bytesPerRow:i},[r,s]),this.setBoardClip({texture:c,originMm:n,pitchMm:e.pitchMm,width:r,height:s}),this.boardClip}setBoardClip(e){this.boardClip&&this.boardClip!==e&&this.boardClip.texture.destroy(),this.boardClip=e;for(let a of this.slices)a.bindGroup=this.bindGroup(a),a.plain&&(a.plain.bindGroup=this.bindGroup(a.plain));this.renderer.invalidate?.()}coversLayer(e){return this.slices.some(a=>a.role!==void 0?a.role==="copper"&&a.layerId===Number(e):a.layerId===Number(e))}coversRole(e){let a={substrate:"dielectric",soldermask:"mask",silkscreen:"silk",paste:"paste"}[e];return!!a&&this.slices.some(r=>r.role===a)}setOperationValues(e,a){this.clearOverlay(),this.valuesBuffer=this.buffer(ro(e),GPUBufferUsage.STORAGE,"analytic-values"),this.overlay={mode:1,range:a},this.rebind()}setFieldRasters(e,a,r=null){this.clearOverlay(!1),r&&(this.valuesBuffer=this.buffer(ro(r),GPUBufferUsage.STORAGE,"analytic-values"));for(let s of this.slices){let n=e.get(s.key);if(!n)continue;let i=this.fieldCache.texture(n,()=>this.fieldTexture(n.width,n.height,ro(n.values)));s.field={...n,texture:i}}this.fieldCache.trim(),this.overlay={mode:2,range:a},this.rebind()}clearOverlay(e=!0){this.valuesBuffer!==this.emptyValues&&this.valuesBuffer.destroy(),this.valuesBuffer=this.emptyValues;for(let a of this.slices)a.field=null;this.overlay={mode:0,range:[0,1]},e&&this.rebind()}setOperationNets(e){this.netsBuffer.destroy(),this.netsBuffer=this.buffer(e.length?e:new Uint32Array(1),GPUBufferUsage.STORAGE,"analytic-nets"),this.rebind()}rebind(){this.boundNetMask=this.renderer.netMaskBuffer;for(let e of this.slices)e.bindGroup=this.bindGroup(e),e.plain&&(e.plain.bindGroup=this.bindGroup(e.plain));for(let e of this.twins?.values()||[])for(let a of Object.values(e))a.bindGroup=this.bindGroup(a);this.barrels&&(this.barrels.bindGroup=this.barrelBindGroup()),this.walls&&(this.walls.bindGroup=this.wallBindGroup()),this.renderer.invalidate?.()}writeSlice(e,a,r=null){let s=new Float32Array(this.uniformScratch),n=new Uint32Array(this.uniformScratch);s.fill(0),s.set(r?.color||e.color,0);let[i,o]=e.offsetLayers||[e.layerId,e.layerId];s[4]=e.z+.5*((a?.[i]||0)+(a?.[o]||0));let c=this.context?.flat?.get(e.layerId);c&&(s[4]=e.z-c.z,s[44]=c.offset[0]||0,s[45]=c.offset[1]||0);let l=e.role===void 0||e.role==="copper";n[5]=l?this.overlay.mode:0;let u=(this.context||{}).isolateNet||!e.outer&&this.renderer.innerCopperMode==="lit";n[7]=l?2|(u?1:0):0;let g=l?e.field:null;if(n[6]=g?1:0,g){s.set(g.originMm,8);let[h,d]=Array.isArray(g.pitchMm)?g.pitchMm:[g.pitchMm,g.pitchMm];s[10]=h,s[11]=d,n[12]=g.width,n[13]=g.height}if(s.set(this.overlay.range,16),s.set(e.bounds,20),s.set([r?.metallic??0,r?.roughness??.72,e.faceDown??e.bottom?-1:1,l?1:0],24),e.zTop!==void 0){let h=s[4]-e.z;s.set([e.zBottom+h,e.zTop+h],28)}n[30]=e.subtractShapes||0,s[31]=e.dilate||0,this.eye&&s.set(this.eye,32);let p=e.role!=="dielectric"?this.boardClip:null;p&&(s.set(p.originMm,36),s[38]=p.pitchMm,s[39]=p.pitchMm,n[40]=p.width,n[41]=p.height,n[42]=1),this.device.queue.writeBuffer(e.uniform,0,this.uniformScratch)}copperLooks(){let e=new Map;for(let a of this.renderer.entries||[]){let r=Number(a.layerId);if(a.kind!=="copper"||e.has(r))continue;let s=a.color||a.material?.baseColor;e.set(r,{color:s&&s.length<4?[...s,1]:s,metallic:a.material?.metallic||0,roughness:a.material?.roughness??.72})}for(let[a,r]of this.renderer.copperColors||[])e.has(a)||e.set(a,{color:r.length<4?[...r,1]:r,metallic:0,roughness:.72});return e}boardLooks(){let e={};for(let a of this.renderer.entries||[]){if(a.kind!=="board"||e[a.boardRole])continue;let r=a.color||a.material?.baseColor;e[a.boardRole]={color:r&&r.length<4?[...r,1]:r,metallic:a.material?.metallic||0,roughness:a.material?.roughness??.72}}return Kx(e,this.renderer.stackupLooks)}laminateColor(){return this.slices.find(e=>e.role==="dielectric"&&e.color)?.color||null}lookFor(e,a,r,s){if(e.role===void 0||e.role==="copper")return a.get(e.layerId);let n=s.boardOpacity??1,i=(c,l)=>{let f=r[c];if(!f)return null;let u=f.color||[1,1,1,1];return{...f,color:[u[0],u[1],u[2],l(Number.isFinite(u[3])?u[3]:1)]}};if(e.role==="dielectric"){let c=n*(.15+.85*(s.assemblyOpacity??1));return e.color?{...r.substrate||{metallic:0,roughness:.72},color:[...e.color.slice(0,3),c]}:i("substrate",()=>c)}let o=s.assemblyOpacity??1;return e.role==="mask"?i("soldermask",c=>Math.min(c,.72)*n*o):e.role==="silk"?i("silkscreen",c=>Math.min(c,.92)*n*o):i("paste",c=>c)}encodeInto(e,a,r,s=!1,n={}){this.context=n,this.renderer.netMaskBuffer!==this.boundNetMask&&this.rebind(),n.matrix&&this.writeView(n.matrix,a,n);let i=s?this.pipelines.pick:this.pipelines.color,o=this.copperLooks(),c=this.boardLooks(),f=this.boardShown(n)&&(n.boardOpacity??1)>=.999,u=0;s||this.drawnLayers.fill(0);for(let g of this.slices){let p=g.role===void 0||g.role==="copper";(p?r&&!r.has(g.layerId):s||g.role!=="dielectric"||!f)||p&&!g.outer&&g.role!==void 0&&this.renderer.innerCopperMode==="none"||g.role==="dielectric"&&!g.skin&&this.renderer.innerCopperMode!=="all"||this.behindBoard(g,n)||(this.encodeSlice(e,i,g,"opaque",a,this.lookFor(g,o,c,n)),!s&&p&&g.face===(g.bottom?"bottom":"top")&&(this.drawnLayers[g.layerId]=1),u+=1)}return f&&!s&&(u+=this.encodeWalls(e,!1)),this.stencil&&e.setStencilReference(1),u}layerZ(e){let a=this.slices.filter(r=>(r.role===void 0||r.role==="copper")&&r.layerId===e).map(r=>r.z);return a.length?(Math.min(...a)+Math.max(...a))/2:null}boardShown(e){return(e.showBoard??!0)&&!e.panelLayer}behindBoard(e,a){if(!this.skin||!this.eye||this.renderer.innerCopperMode==="all"||!this.boardShown(a)||(a.boardOpacity??1)<.999)return!1;let[,,r,s]=this.eye,n=s?r>this.skin.top:r<0,i=s?r<this.skin.bottom:r>0;return e.faceDown?n:i}encodeBlended(e,a,r,s={}){if(!this.stencil)return 0;this.context=s;let n=this.copperLooks(),i=this.boardLooks(),o=this.boardShown(s),c=o&&(s.boardOpacity??1)<.999,l=0,f=(h,d)=>{this.behindBoard(h,s)||(this.encodeSlice(e,this.pipelines.color,h,d,a,this.lookFor(h,n,i,s)),l+=1)};for(let h of this.slices)c&&h.role==="dielectric"&&f(h,"blend");c&&(l+=this.encodeWalls(e,!0));let u=o&&(s.assemblyOpacity??1)>.01,g=h=>!Gx(s.hiddenBoardLayers,h),p=new Set;for(let h of this.slices){if(h.role!=="mask"||!u||!g(h)||this.behindBoard(h,s))continue;let d=this.twins.get(h);if(!d?.foot){f(h,"mask");continue}let m=this.slices.filter(b=>b.role==="silk"&&b.faceDown===h.faceDown&&g(b)&&!this.behindBoard(b,s));for(let b of m)p.add(b);l+=this.encodeConformal(e,h,d,m,a,b=>this.lookFor(b,n,i,s))}for(let h of this.slices)h.role==="paste"&&g(h)&&!s.hidePaste&&!s.panelLayer&&(!r||r.has(h.offsetLayers?.[0]))&&f(h,"blend");for(let h of this.slices)h.role==="silk"&&u&&g(h)&&!p.has(h)&&f(h,"blend");return e.setStencilReference(1),l}encodeSlice(e,a,r,s,n,i){let o=this.drawnSlice(r),c=a===this.pipelines.pick?void 0:this.sliceRect(o,n);c!==null&&(c&&e.setScissorRect(c.x,c.y,c.width,c.height),this.encodeSliceIn(e,a,o,s,n,i),c&&e.setScissorRect(this.viewport.x,this.viewport.y,this.viewport.width,this.viewport.height))}sliceRect(e,a){let r=this.viewport,s=this.viewMatrix;if(!r||!s||!e.bounds||this.context?.flat)return;let[n,i]=e.offsetLayers||[e.layerId,e.layerId],o=.5*((a?.[n]||0)+(a?.[i]||0)),c=[e.z,e.zBottom??e.z,e.zTop??e.z,e.zLow??e.z].map(M=>M+o),[l,f,u,g]=e.bounds,[p,h,d,m]=[1/0,1/0,-1/0,-1/0];for(let M of[l/1e3,u/1e3])for(let S of[-f/1e3,-g/1e3])for(let A of[Math.min(...c),Math.max(...c)]){let _=s[3]*M+s[7]*S+s[11]*A+s[15];if(!(_>1e-9))return;let N=r.x+((s[0]*M+s[4]*S+s[8]*A+s[12])/_+1)*.5*r.width,I=r.y+(1-(s[1]*M+s[5]*S+s[9]*A+s[13])/_)*.5*r.height;p=Math.min(p,N),d=Math.max(d,N),h=Math.min(h,I),m=Math.max(m,I)}let b=Math.max(r.x,Math.floor(p-Us)),y=Math.max(r.y,Math.floor(h-Us)),x=Math.min(r.x+r.width,Math.ceil(d+Us)),v=Math.min(r.y+r.height,Math.ceil(m+Us));return x<=b||v<=y?null:{x:b,y,width:x-b,height:v-y}}encodeSliceIn(e,a,r,s,n,i){this.writeSlice(r,n,i),e.setBindGroup(0,r.bindGroup),this.stencil?this.encodeStencilled(e,a,r,s):this.encodeAddsOnly(e,a,r),s==="opaque"&&r.walls&&this.encodeSlabWalls(e,a,r)}wallPixels(e){let a=this.viewMatrix,r=this.renderer.canvas;if(!a||!this.extent||!r)return 1/0;let[s,n]=this.extent,i=[];for(let l of[s[0],n[0]])for(let f of[s[1],n[1]])for(let u of[s[2],n[2]])i.push([l,f,u]);this.eye?.[3]&&i.push(this.eye.slice(0,3).map((l,f)=>Math.min(n[f],Math.max(s[f],l/this.eye[3]))));let o=([l,f,u])=>{let g=[0,1,2,3].map(p=>a[p]*l+a[4+p]*f+a[8+p]*u+a[12+p]);return g[3]>1e-9?[g[0]/g[3],g[1]/g[3]]:null},c=0;for(let l of i){let f=o(l),u=o([l[0],l[1],l[2]+e]);if(!f||!u)return 1/0;c=Math.max(c,Math.hypot((u[0]-f[0])*r.width/2,(u[1]-f[1])*r.height/2))}return c}encodeSlabWalls(e,a,r){this.stencil&&e.setStencilReference(0),r.regionEdges&&(e.setPipeline(a.regionWall),e.draw(6,r.regionEdges,0,0)),r.skirtEdges&&this.wallPixels(r.zTop-r.zBottom)>=Wu&&(e.setPipeline(a.skirt),e.draw(12,r.skirtEdges,0,r.regionEdges))}encodeAddsOnly(e,a,r){let s=r.shapeCount-r.subtractShapes;s&&(e.setPipeline(a.shapeAdd),e.draw(6,s,0,r.subtractShapes))}encodeStencilled(e,a,r,s="opaque"){let n=(i,o=cs[i].reference)=>{e.setPipeline(a[i]),e.setStencilReference(o)};this.encodeFill(e,r,n,s),s==="mask"&&(n("tintCovered"),e.draw(6),n("tintPlain"),e.draw(6)),n("clear"),e.draw(6)}encodeFill(e,a,r,s){let n=s==="footprint";a.subtractShapes&&!n&&(r("shapeMask"),e.draw(6,a.subtractShapes,0,0)),n||this.encodeBatches(e,a,!0,r,s);let i=a.shapeCount-a.subtractShapes;i&&(s==="opaque"?r("shapeAdd",a.mark?33:32):r({mask:"shapeLay",blend:"shapeBlend",footprint:"footShape",onFoot:"shapeOnFoot",offFoot:"shapeOffFoot"}[s]),e.draw(6,i,0,a.subtractShapes)),this.encodeBatches(e,a,!1,r,s)}encodeConformal(e,a,{low:r,foot:s},n,i,o){let c=[a,r,s,...n,...n.map(u=>this.twins.get(u)?.low).filter(Boolean)],l=$x(c.map(u=>this.sliceRect(u,i)));if(l===null)return 0;l&&e.setScissorRect(l.x,l.y,l.width,l.height);let f=this.encodeConformalIn(e,a,{low:r,foot:s},n,i,o);return l&&e.setScissorRect(this.viewport.x,this.viewport.y,this.viewport.width,this.viewport.height),f}encodeConformalIn(e,a,{low:r,foot:s},n,i,o){let c=this.pipelines.color,l=p=>cs[p==="step"||p==="regionStep"?"coat":p],f=(p,h=l(p).reference)=>{e.setPipeline(c[p]),e.setStencilReference(h)},u=(p,h)=>{this.writeSlice(p,i,h),e.setBindGroup(0,p.bindGroup)},g=o(a);u(s,g),this.encodeFill(e,s,f,"footprint"),u(a,g),this.encodeFill(e,a,f,"mask"),f("tintHigh"),e.draw(6),e.setBindGroup(0,s.bindGroup),s.regionEdges&&(f("regionStep"),e.draw(6,s.regionEdges,0,0)),s.skirtEdges&&this.wallPixels(s.zTop-s.zBottom)>=Wu&&(f("step"),e.draw(12,s.skirtEdges,0,s.regionEdges)),e.setBindGroup(0,a.bindGroup),f("clearLay"),e.draw(6),u(r,g),this.encodeFill(e,r,f,"mask"),f("tintLow"),e.draw(6),f("clearLay"),e.draw(6);for(let p of n){let h=o(p);u(p,h),this.encodeFill(e,p,f,"onFoot"),f("clear"),e.draw(6);let d=this.twins.get(p)?.low;d&&(u(d,h),this.encodeFill(e,d,f,"offFoot"),f("clear"),e.draw(6))}return e.setBindGroup(0,a.bindGroup),f("clearFoot"),e.draw(6),e.setStencilReference(1),1+n.length}encodeBatches(e,a,r,s,n="opaque"){let i=a.batches.findLast(o=>!o.subtract);for(let o of a.batches){if(o.subtract!==r||!a.fans)continue;s("fan"),e.setVertexBuffer(0,a.fans),e.draw(o.vertexCount,1,o.firstVertex,0),!r&&n==="opaque"&&(a.mark||a.role==="dielectric")&&(s("coverMark",a.mark?65:64),e.draw(6,o.coverCount,0,o.firstCover));let c={opaque:"coverAdd",blend:"coverBlend",mask:"coverLay",footprint:"footCover",onFoot:"coverOnFoot",offFoot:"coverOffFoot"}[n];s(r?"coverSubtract":c),e.draw(6,o.coverCount,0,o.firstCover),!r&&(o!==i||n==="footprint")&&(s("coverClear"),e.draw(6,o.coverCount,0,o.firstCover))}}gpuMemoryBytes(){let e=this.valuesBuffer===this.emptyValues?0:this.valuesBuffer.size;this.barrels&&(e+=this.barrels.count*ql),this.walls&&(e+=this.walls.count*Hl);let a=new Set;for(let r of this.slices.flatMap(s=>s.plain?[s,s.plain]:[s]))for(let s of[r.shapes,r.covers,r.fans,r.uniform,r.edges,r.cuts])s&&a.add(s);for(let r of a)e+=r.size;return e+this.fieldCache.bytes()}stats(){return{slices:this.slices.map(e=>({key:e.key,role:e.role||"copper",face:e.face,layerId:e.layerId,z:e.z,shapes:e.shapeCount,subtractShapes:e.subtractShapes,regionBatches:e.batches.length,fanVertices:e.lowered.fanVertices.length/2,covers:e.lowered.covers.length/6,approximations:e.lowered.stats})),overlay:this.overlay.mode,barrels:this.barrels?{count:this.barrels.count,skipped:this.barrels.skipped}:null,walls:this.walls?.count||0,gpuMemoryBytes:this.gpuMemoryBytes(),degraded:!this.stencil}}makePlainSlabs(e){let a=new Map;for(let r of this.slices){if(r.role!=="dielectric"||!r.lowered)continue;a.has(r.lowered)||a.set(r.lowered,zu(r.lowered));let s=a.get(r.lowered);s&&(r.plain=this.uploadSlice({...r,lowered:s,plain:null},e))}}drawnSlice(e){return this.separated&&e.plain?e.plain:e}releaseSlices(){for(let a of this.twins?.values()||[])for(let r of Object.values(a))r.uniform.destroy();this.twinBuffers?.forEach(a=>a.destroy()),this.twinBuffers=[],this.twins=new Map;let e=new Set;for(let a of this.slices.flatMap(r=>r.plain?[r,r.plain]:[r]))for(let r of[a.shapes,a.covers,a.fans,a.uniform,a.edges,a.cuts])r&&e.add(r);for(let a of e)a.destroy();this.fieldCache?.clear(),this.slices=[]}destroy(){this.releaseSlices(),this.barrels?.buffer.destroy(),this.walls?.buffer.destroy(),this.arrows?.buffer.destroy(),this.drawnLayersBuffer.destroy(),this.palette.destroy(),this.netsBuffer.destroy(),this.barrelView.destroy(),this.layerOffsets.destroy(),this.valuesBuffer!==this.emptyValues&&this.valuesBuffer.destroy(),this.emptyValues.destroy(),this.emptyField.destroy(),this.boardClip?.texture.destroy(),this.emptyClip.destroy()}};function Xx({data:t,width:e,height:a}){let r=e+2,s=a+2,n=new Uint8Array(r*s);for(let i=0;i<a;i+=1)for(let o=0;o<e;o+=1)if(t[i*e+o])for(let c=0;c<3;c+=1)n.fill(1,(i+c)*r+o,(i+c)*r+o+3);return{data:n,width:r,height:s}}function $x(t){let e=null;for(let a of t){if(a===void 0)return;if(!a)continue;if(!e){e={...a};continue}let r=Math.min(e.x,a.x),s=Math.min(e.y,a.y);e={x:r,y:s,width:Math.max(e.x+e.width,a.x+a.width)-r,height:Math.max(e.y+e.height,a.y+a.height)-s}}return e}function Yx(t){let e=Jx(Array.from(t,Number));if(!e)return[0,0,-1,0];let a=l=>[0,1,2,3].map(f=>e[f]*l[0]+e[4+f]*l[1]+e[8+f]*l[2]+e[12+f]*l[3]),r=a([0,0,1,0]),s=Math.hypot(r[0],r[1],r[2]);if(Math.abs(r[3])>1e-9*Math.max(s,1e-30))return[r[0]/r[3],r[1]/r[3],r[2]/r[3],1];let n=a([0,0,1,1]),i=a([0,0,0,1]),o=[0,1,2].map(l=>i[l]/i[3]-n[l]/n[3]),c=Math.hypot(...o)||1;return[...o.map(l=>l/c),0]}function Jx(t){let e=new Array(16);e[0]=t[5]*t[10]*t[15]-t[5]*t[11]*t[14]-t[9]*t[6]*t[15]+t[9]*t[7]*t[14]+t[13]*t[6]*t[11]-t[13]*t[7]*t[10],e[4]=-t[4]*t[10]*t[15]+t[4]*t[11]*t[14]+t[8]*t[6]*t[15]-t[8]*t[7]*t[14]-t[12]*t[6]*t[11]+t[12]*t[7]*t[10],e[8]=t[4]*t[9]*t[15]-t[4]*t[11]*t[13]-t[8]*t[5]*t[15]+t[8]*t[7]*t[13]+t[12]*t[5]*t[11]-t[12]*t[7]*t[9],e[12]=-t[4]*t[9]*t[14]+t[4]*t[10]*t[13]+t[8]*t[5]*t[14]-t[8]*t[6]*t[13]-t[12]*t[5]*t[10]+t[12]*t[6]*t[9],e[1]=-t[1]*t[10]*t[15]+t[1]*t[11]*t[14]+t[9]*t[2]*t[15]-t[9]*t[3]*t[14]-t[13]*t[2]*t[11]+t[13]*t[3]*t[10],e[5]=t[0]*t[10]*t[15]-t[0]*t[11]*t[14]-t[8]*t[2]*t[15]+t[8]*t[3]*t[14]+t[12]*t[2]*t[11]-t[12]*t[3]*t[10],e[9]=-t[0]*t[9]*t[15]+t[0]*t[11]*t[13]+t[8]*t[1]*t[15]-t[8]*t[3]*t[13]-t[12]*t[1]*t[11]+t[12]*t[3]*t[9],e[13]=t[0]*t[9]*t[14]-t[0]*t[10]*t[13]-t[8]*t[1]*t[14]+t[8]*t[2]*t[13]+t[12]*t[1]*t[10]-t[12]*t[2]*t[9],e[2]=t[1]*t[6]*t[15]-t[1]*t[7]*t[14]-t[5]*t[2]*t[15]+t[5]*t[3]*t[14]+t[13]*t[2]*t[7]-t[13]*t[3]*t[6],e[6]=-t[0]*t[6]*t[15]+t[0]*t[7]*t[14]+t[4]*t[2]*t[15]-t[4]*t[3]*t[14]-t[12]*t[2]*t[7]+t[12]*t[3]*t[6],e[10]=t[0]*t[5]*t[15]-t[0]*t[7]*t[13]-t[4]*t[1]*t[15]+t[4]*t[3]*t[13]+t[12]*t[1]*t[7]-t[12]*t[3]*t[5],e[14]=-t[0]*t[5]*t[14]+t[0]*t[6]*t[13]+t[4]*t[1]*t[14]-t[4]*t[2]*t[13]-t[12]*t[1]*t[6]+t[12]*t[2]*t[5],e[3]=-t[1]*t[6]*t[11]+t[1]*t[7]*t[10]+t[5]*t[2]*t[11]-t[5]*t[3]*t[10]-t[9]*t[2]*t[7]+t[9]*t[3]*t[6],e[7]=t[0]*t[6]*t[11]-t[0]*t[7]*t[10]-t[4]*t[2]*t[11]+t[4]*t[3]*t[10]+t[8]*t[2]*t[7]-t[8]*t[3]*t[6],e[11]=-t[0]*t[5]*t[11]+t[0]*t[7]*t[9]+t[4]*t[1]*t[11]-t[4]*t[3]*t[9]-t[8]*t[1]*t[7]+t[8]*t[3]*t[5],e[15]=t[0]*t[5]*t[10]-t[0]*t[6]*t[9]-t[4]*t[1]*t[10]+t[4]*t[2]*t[9]+t[8]*t[1]*t[6]-t[8]*t[2]*t[5];let a=t[0]*e[0]+t[1]*e[4]+t[2]*e[8]+t[3]*e[12];return a?e.map(r=>r/a):null}function Qu(t,e=1536){if(!t||t.length<12)return null;let[a,r,s,n]=[1/0,1/0,-1/0,-1/0];for(let p=0;p+3<t.length;p+=4)a=Math.min(a,t[p],t[p+2]),s=Math.max(s,t[p],t[p+2]),r=Math.min(r,t[p+1],t[p+3]),n=Math.max(n,t[p+1],t[p+3]);let i=1;[a,r,s,n]=[a-i,r-i,s+i,n+i];let o=Math.max(Math.max(s-a,n-r)/e,.02),c=Math.max(1,Math.ceil((s-a)/o)),l=Math.max(1,Math.ceil((n-r)/o)),f=new Uint8Array(c*l),u=Array.from({length:l},()=>[]);for(let p=0;p+3<t.length;p+=4){let[h,d,m,b]=[t[p],t[p+1],t[p+2],t[p+3]];if(d===b)continue;let y=Math.max(0,Math.ceil((Math.min(d,b)-r)/o-.5)),x=Math.min(l-1,Math.floor((Math.max(d,b)-r)/o-.5));for(let v=y;v<=x;v+=1)u[v].push(p)}let g=[];for(let p=0;p<l;p+=1){let h=r+(p+.5)*o;g.length=0;for(let d of u[p]){let[m,b,y,x]=[t[d],t[d+1],t[d+2],t[d+3]];b<=h!=x<=h&&g.push(m+(h-b)/(x-b)*(y-m))}g.sort((d,m)=>d-m);for(let d=0;d+1<g.length;d+=2){let m=Math.max(0,Math.ceil((g[d]-a)/o-.5)),b=Math.min(c-1,Math.floor((g[d+1]-a)/o-.5));b>=m&&f.fill(1,p*c+m,p*c+b+1)}}return{data:f,width:c,height:l,originMm:[a,r],pitchMm:o}}function Qx(t,e,a=0){let r=new Map((e||[]).map(s=>[Number(s.id),s]));for(let s of t||[]){let n=r.get(Number(s.layerId));if(s.kind!=="copper"||!n||!s.quantMin||!s.quantSize)continue;let i=s.quantSize[2]===1;return s.quantMin[2]+(i?0:s.quantSize[2]/2)-Number(n.z_mm||0)/1e3}return Number(a||0)/1e3}async function lo({renderer:t,layers:e,colorFor:a,bytes:r,wasm:s,toleranceNm:n,nets:i=[],features:o=[],boardZOffsetMm:c=0,pack:l=null,cache:f=null,pool:u=null,netIds:g=null}){let p={},h=performance.now(),d=L=>{let ne=performance.now();p[L]=Math.round(ne-h),h=ne},m=l||await ur(r,{wasm:s}),b=m.lowerSlice?m:null,y=async()=>b??=await ur(r,{wasm:s});d("open");let x=Qx(t.entries,e,c),{planned:v,unmatched:M}=ku(m.header,e,x),S=new Map(e.map(L=>[Number(L.id),L])),A=performance.now(),_=[...new Set(v.map(L=>L.key))],N=n??ra,I=new Map,C=f?{cacheKey:f.cacheKey,wasmKey:Sa(),toleranceNm:N}:null;if(C){let L=_.filter(ne=>!I.has(ne));for(let[ne,Ye]of await hr(f.store,C,L))I.set(ne,Ye);p.cached=_.filter(ne=>I.has(ne)).length}let B=_.filter(L=>!I.has(L)),R=Cu(m.header),j=new Set,q=C&&typeof f.store.adopt=="function"&&f.store.enabled!==!1?{identity:C,writes:[],adopt(L,ne){f.store.adopt(Fs(C.cacheKey,C.wasmKey,C.toleranceNm,L),ne),j.add(L)}}:null,$=B.length?u?await u.lower(B,N,R,q):await Fu(r,B,N,s??Bs(),{weights:R}):new Map;p.lowerIn=B.length?$?"workers":"main":"none";let Z=new Map;for(let L of B){let ne=$?.get(L);Z.set(L,ne||(await y()).lowerSlice(L,n)),I.set(L,ne?Ps(ne):Z.get(L))}let me=v.map(L=>({...L,color:L.role==="copper"?a(S.get(L.layerId)):L.color||[1,1,1,1],lowered:I.get(L.key)})),se=Uu(me),ge=se.map(([L,ne])=>Ds(L,ne)),Se=C?await hr(f.store,C,ge):new Map,be=se.filter((L,ne)=>!Se.has(ge[ne])),Te=be.length&&u?await u.steps(be.map(([L,ne])=>[ne.lowered,L.lowered]),q,be.map(([L,ne])=>Ds(L,ne))):[],ye=new Map;be.forEach(([L,ne],Ye)=>{Te[Ye]&&ye.set(Ds(L,ne),Te[Ye])}),se.forEach(([L],ne)=>{let Ye=ye.get(ge[ne]);L.step=Se.get(ge[ne])||Ye&&Ps(Ye)||null}),p.steps=`${Se.size} cached, ${ye.size} in workers, ${se.length-Se.size-ye.size} here`;let Ce=L=>!!$?.get(L)||ye.has(L),Ae=new Map([...Z,...ye].filter(([L])=>!(q&&Ce(L)))),Pa=C&&Ae.size?Ji(f.store,C,Ae):Promise.resolve(),ua=performance.now()-A;d("lower"),await $t.prewarm(t);let T=new $t(t);T.setSlices(me),d("slices");let P=me.find(L=>L.role==="dielectric"&&L.lowered?.contourEdges?.length)?.lowered.contourEdges,D=Qu(P),Y=await m.barrels();T.setBarrels(Mu(m.header,Y,me,P)),T.setBoardClipMask(D),d("barrels");let pe=new Set;for(let L=0;L<Y.words.length;L+=Cs)pe.add(Y.words[L]);T.edgePlated=!!m.header.stack?.edge_plating,T.setWalls(Su(me,I,e,x)),d("walls");let we=g?null:await m.netIndices?.(),nt=g||Tu(we?{header:m.header,netIndices:()=>we}:m,i);T.setOperationNets(nt),d("nets");let fa=Promise.resolve();if(C){let L=we?Ji(f.store,C,new Map([[fr,_u(m.header,Y,we)]])):Promise.resolve(),ne=q?[...Z.keys(),...ye.keys()].filter(Ce):[];fa=Promise.all([Pa,L,...q?.writes||[]]).then(()=>{if(ne.every(Ye=>j.has(Ye)))return Nu(f.store,C)})}let bt=new Map;for(let L of o||[])L?.sourceUid&&(bt.has(L.sourceUid)||bt.set(L.sourceUid,[]),bt.get(L.sourceUid).push(L));return d("features"),b&&b!==m&&b.free(),{cacheWrites:fa,pack:m,analytic:T,unmatched:M,lowerMs:ua,timings:p,zOffset:x,operations:Ta(m.header),overlay:null,netIds:nt,featuresBySource:bt,barrelOperations:pe,lowered:I}}async function Gs(t,e){let a=(await t.pack.binding(e))?.source_uid,r=a?t.featuresBySource?.get(a)||[]:[],s=t.netIds?.[e]||0,n=r.find(i=>Number(i.netId)===s)||r[0];return n?Number(n.id):0}async function uo(t,e,a){let r=Wo+e;if(a.features.has(r))return r;let s=await t.pack.binding(e);if(!s)return 0;let n=String(s.refdes||""),i=String(s.pad_number||"");if(n&&!i)return Number(a.componentFeatures.get(n)?.featureId||0);let o=Number(t.netIds?.[e]||0);return!i&&!o?0:(a.features.set(r,{id:r,kind:String(s.source_kind||"copper"),...n?{designator:n}:{},...i?{padNumber:i}:{},netId:o,sourceUid:String(s.source_uid||""),bounds:null}),r)}function tf(t,e){if(!e)return t.analytic.clearOverlay(),t.overlay=null,null;if(e.kind==="operation_values"){let a=Yi(e.values,t.operations),r=e.range||Aa(a);t.analytic.setOperationValues(a,r),t.overlay={...e,values:a,range:r}}else if(e.kind==="field_tiles"){let a=Eu(e.tiles),r=e.range||Aa([...a.values()].flatMap(s=>[...Aa(s.values)]));t.analytic.setFieldRasters(a,r),t.overlay={...e,range:r,slices:[...a.keys()]}}else if(e.kind==="field_grid"){let a=Os(e.grid),r=e.range||Aa([...a.values()].flatMap(n=>[...Aa(n.values)])),s=e.values?Yi(e.values,t.operations):null;t.analytic.setFieldRasters(a,r,s),t.overlay={kind:e.kind,quantity:e.quantity,units:e.units,range:r,slices:[...a.keys()],barrels:s,net:e.grid?.net??null}}else throw new TypeError(`unknown analytic overlay kind ${e.kind}`);return{kind:e.kind,range:t.overlay.range}}function co(t,e,a=!1){let[r,s]=Array.isArray(t.pitchMm)?t.pitchMm:[t.pitchMm,t.pitchMm],n=(e[0]-t.originMm[0])/r-.5,i=(e[1]-t.originMm[1])/s-.5,o=(m,b)=>m<0||b<0||m>=t.width||b>=t.height?NaN:t.values[b*t.width+m],[c,l]=[Math.floor(n),Math.floor(i)],[f,u]=[n-c,i-l],g=o(c,l),p=o(c+1,l),h=o(c,l+1),d=o(c+1,l+1);return[g,p,h,d].every(Number.isFinite)?(g*(1-f)+p*f)*(1-u)+(h*(1-f)+d*f)*u:a?NaN:o(Math.floor(n+.5),Math.floor(i+.5))}function Zx(t,e,a){let[r,s]=Array.isArray(t.pitchMm)?t.pitchMm:[t.pitchMm,t.pitchMm],n=(e[0]-t.originMm[0])/r-.5,i=(e[1]-t.originMm[1])/s-.5,o=NaN,c=1/0;for(let l=Math.floor(i)-a+1;l<=Math.floor(i)+a;l+=1)for(let f=Math.floor(n)-a+1;f<=Math.floor(n)+a;f+=1){if(f<0||l<0||f>=t.width||l>=t.height)continue;let u=t.values[l*t.width+f],g=(f-n)**2+(l-i)**2;Number.isFinite(u)&&g<c&&([o,c]=[u,g])}return o}function af(t){let e=new Map;for(let a of t.analytic.slices){if(!a.field||!(a.role===void 0||a.role==="copper"))continue;let r=e.get(a.layerId);(!r||a.z>r.z)&&e.set(a.layerId,a)}return[...e.values()].map(a=>({slice:a,key:a.key,layerId:a.layerId,cells:a.field.values.reduce((r,s)=>r+(Number.isFinite(s)?1:0),0)}))}function rf(t,e){if(!e)return 0;let a=(t||[]).find(r=>r?.name===e)||(t||[]).find(r=>(r?.aliases||[]).includes(e));return a&&Number(a.id)||0}var Zu=48,ew=70,ef=2e-6,tw=.95;function aw(t,e,a,{spacingMm:r=null,floor:s=.001,density:n=ew,width:i=.07,minLength:o=.3}={}){let c=t.filter(x=>x.role==="copper"&&e.has(x.key)&&a.has(x.key)&&x.face===(x.bottom?"bottom":"top"));if(!c.length)return{data:new ArrayBuffer(0),count:0,spacingMm:0,max:0,reference:0};let l=c.reduce((x,v)=>[Math.min(x[0],v.bounds[0]),Math.min(x[1],v.bounds[1]),Math.max(x[2],v.bounds[2]),Math.max(x[3],v.bounds[3])],[1/0,1/0,-1/0,-1/0]),f=r||Math.max(l[2]-l[0],l[3]-l[1])/n,u=[];for(let x of c){let[v,M]=[e.get(x.key),a.get(x.key)],[S,A,_,N]=x.bounds;for(let I=l[0]+Math.ceil((S-l[0])/f)*f+f/2;I<=_;I+=f)for(let C=l[1]+Math.ceil((A-l[1])/f)*f+f/2;C<=N;C+=f){let B=co(v,[I,C],!0),R=co(M,[I,C],!0),j=Math.hypot(B,R);j>0&&u.push({face:x,x:I,y:C,jx:B,jy:R,size:j})}}let g=u.map(x=>x.size).sort((x,v)=>x-v),p=g.length?g[g.length-1]:0,h=g.length?g[Math.min(g.length-1,Math.floor(tw*g.length))]:0,d=u.filter(x=>x.size>=s*h),m=new ArrayBuffer(d.length*Zu),b=new Float32Array(m),y=new Uint32Array(m);return d.forEach((x,v)=>{let M=v*(Zu/4),[S,A]=x.face.offsetLayers||[x.face.layerId,x.face.layerId],_=x.face.bottom?-ef:ef,N=Math.min(1,x.size/h),I=.9*f*(o+(1-o)*Math.sqrt(N))/1e3;b.set([x.x/1e3,-x.y/1e3,x.face.z+_,i*f/1e3,x.jx/x.size,-x.jy/x.size,I,N],M),y.set([S,A,0,0],M+8)}),{data:m,count:d.length,spacingMm:f,max:p,reference:h}}function fo(t,e){if(!e)return t.analytic.setArrows(null),t.vectors=null,t.vectorInput=null,null;let a=t.analytic.style,r=aw(t.analytic.slices,Os(e.x),Os(e.y),{density:a.arrowDensity,width:a.arrowWidth,minLength:a.arrowMinLength});return t.analytic.setArrows(r),t.vectorInput=e,t.vectors={quantity:e.quantity,units:e.units,max:r.max,reference:r.reference,spacingMm:r.spacingMm},{count:r.count,max:r.max,reference:r.reference,spacingMm:r.spacingMm}}function sf(t,e){let a=t.analytic.style,r=t.analytic.setStyle(e);return["arrowDensity","arrowWidth","arrowMinLength"].some(n=>a[n]!==r[n])&&t.vectorInput&&fo(t,t.vectorInput),r}function nf(t,e){for(let a of t?.chunks||[]){let r=Number(a.first_operation_index);if(e>=r&&e<r+Number(a.operation_count||0))return a.slice_key}return null}function Ks(t,e,a,r=null,s=null,n=0){let i=null;for(let o of t.analytic.slices){if(!o.field||Math.abs(e.direction[2])<1e-12||r&&o.key!==r||s&&!s.has(Number(o.layerId)))continue;let[c,l]=o.offsetLayers||[o.layerId,o.layerId],f=o.z+.5*((a?.[c]||0)+(a?.[l]||0)),u=(f-e.origin[2])/e.direction[2];if(!r&&!(u>0)||i&&u>=i.t)continue;let g=[e.origin[0]+u*e.direction[0],e.origin[1]+u*e.direction[1],f],p=[g[0]*1e3,-g[1]*1e3],h=co(o.field,p);!Number.isFinite(h)&&n>0&&(h=Zx(o.field,p,n)),Number.isFinite(h)&&(i={t:u,value:h,sliceKey:o.key,boardMm:p,world:g})}return i&&{value:i.value,sliceKey:i.sliceKey,boardMm:i.boardMm,world:i.world}}async function ho(t,e,a=null){let r=t.overlay,s=r?.kind==="operation_values"?r.values[e]:r?.barrels?.[e],n=r?.kind!=="operation_values"&&Number.isFinite(s)&&(!t.barrelOperations||t.barrelOperations.has(e)),i=r?.kind==="operation_values"||n?s:a?.value;return n&&(a={...a,sliceKey:"via barrel"}),{operationIndex:e,featureId:await Gs(t,e)||null,binding:await t.pack.binding(e),...Number.isFinite(i)?{value:i,quantity:r.quantity,units:r.units}:{},...a?{sliceKey:a.sliceKey,boardMm:a.boardMm,world:a.world}:{}}}var rw=2048,sw=.22,of=2,cf=1024,lf=160;function nw(t,e,a){let r=Float32Array.from(t,o=>Number.isFinite(o)?o:NaN),s=new Int32Array(e*a),n=0,i=0;for(let o=0;o<r.length;o+=1)Number.isFinite(r[o])&&(s[i++]=o);for(;n<i;){let o=s[n++],c=o%e,l=(o-c)/e;for(let[f,u]of[[c-1,l],[c+1,l],[c,l-1],[c,l+1]]){if(f<0||u<0||f>=e||u>=a)continue;let g=u*e+f;Number.isFinite(r[g])||(r[g]=r[o],s[i++]=g)}}return r}function iw(t,e,a){let[r,s,n,i]=t,o=(n-r)/1e3,c=(i-s)/1e3,l=(r+n)/2e3,f=-(s+i)/2e3,u=a-e||1;return new Float32Array([2/o,0,0,0,0,2/c,0,0,0,0,1/u,0,-2*l/o,-2*f/c,-e/u,1])}function ow(t,e=rw){let a=t[2]-t[0],r=t[3]-t[1],s=e/Math.max(a,r,1e-9);return[Math.max(1,Math.round(a*s)),Math.max(1,Math.round(r*s))]}var cw=`
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
`,Vs=`
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

// The grid is drawn in patches of PATCH x PATCH quads, instanced, from one
// shared index buffer. Each point's height and normal were computed once per
// field (cs_grid in GRID_SHADER, as (z, normal)): a vertex reads one entry.
@group(0) @binding(5) var<storage, read> patchGrid: array<vec4f>;
const PATCH = PATCH_SIZEu;

@vertex fn vs_relief_patch(@builtin(vertex_index) vertex: u32, @builtin(instance_index) patchIndex: u32) -> ReliefOut {
  let cells = relief.grid - vec2u(1u);
  let patches = (cells + vec2u(PATCH - 1u)) / PATCH;
  let local = vec2u(vertex % (PATCH + 1u), vertex / (PATCH + 1u));
  // Past the grid's last point a patch folds onto it: zero-area triangles.
  let at = min(vec2u(patchIndex % patches.x, patchIndex / patches.x) * PATCH + local, cells);
  let t = vec2f(at) / vec2f(cells);
  let board = mix(relief.bounds.xy, relief.bounds.zw, t);
  let point = patchGrid[at.y * relief.grid.x + at.x];
  var out: ReliefOut;
  out.position = relief.viewProjection * vec4f(board.x * 0.001, -board.y * 0.001, point.x, 1.0);
  out.board = board;
  out.normal = point.yzw;
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
`,dt=64,lw=`
struct Relief {
  viewProjection: mat4x4f,
  bounds: vec4f,
  fieldOrigin: vec2f,
  fieldPitch: vec2f,
  fieldSize: vec2u,
  grid: vec2u,
  range: vec2f,
  base: f32,
  height: f32,
  light: vec4f,
};
@group(0) @binding(0) var<uniform> relief: Relief;
@group(0) @binding(1) var field: texture_2d<f32>;
@group(0) @binding(2) var<storage, read_write> outGrid: array<vec4f>;
const ABSENT = 3e38;
fn present(value: f32) -> bool { return value < 1e38; }
${Vs.slice(Vs.indexOf("fn cell("),Vs.indexOf("struct ReliefOut"))}
@compute @workgroup_size(8, 8) fn cs_grid(@builtin(global_invocation_id) id: vec3u) {
  if (id.x >= relief.grid.x || id.y >= relief.grid.y) { return; }
  let cells = relief.grid - vec2u(1u);
  let t = vec2f(id.xy) / vec2f(cells);
  let board = mix(relief.bounds.xy, relief.bounds.zw, t);
  let z = lift(board);
  let step = (relief.bounds.zw - relief.bounds.xy) / vec2f(cells);
  let dx = (lift(board + vec2f(step.x, 0.0)) - lift(board - vec2f(step.x, 0.0))) / (0.002 * step.x);
  let dy = (lift(board + vec2f(0.0, step.y)) - lift(board - vec2f(0.0, step.y))) / (0.002 * step.y);
  outGrid[id.y * relief.grid.x + id.x] = vec4f(z, normalize(vec3f(-dx, dy, 1.0)));
}
`,dw=`
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
`,qs=class{constructor(e){this.analytic=e,this.renderer=e.renderer,this.device=e.device,this.uniform=this.device.createBuffer({label:"relief",size:lf,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),this.scratch=new ArrayBuffer(lf),this.sampler=this.device.createSampler({magFilter:"linear",minFilter:"linear"}),this.layer=null,this.vertexCount=0}get ready(){return this.vertexCount>0}pipeline(){if(this.reliefPipeline)return this.reliefPipeline;let e=this.device.createShaderModule({label:"relief",code:Vs.replace("PALETTE",dw).replace("PATCH_SIZE",String(dt))});return this.reliefPipeline=this.device.createRenderPipeline({label:"relief",layout:"auto",vertex:{module:e,entryPoint:"vs_relief_patch"},fragment:{module:e,entryPoint:"fs_relief",targets:[{format:this.renderer.format}]},primitive:{topology:"triangle-list",cullMode:"none"},depthStencil:{format:this.renderer.depthFormat,depthWriteEnabled:!0,depthCompare:"greater"},multisample:{count:this.renderer.sampleCount||1}}),this.reliefPipeline}gridPipeline(){if(this.gridComputePipeline)return this.gridComputePipeline;let e=this.device.createShaderModule({label:"relief-grid",code:lw});return this.gridComputePipeline=this.device.createComputePipeline({label:"relief-grid",layout:"auto",compute:{module:e,entryPoint:"cs_grid"}}),this.gridComputePipeline}patchIndices(){if(this.patchIndexBuffer)return this.patchIndexBuffer;let e=dt+1,a=new Uint16Array(dt*dt*6),r=0;for(let s=0;s<dt;s+=1)for(let n=0;n<dt;n+=1){let i=s*e+n;a.set([i,i+1,i+e,i+e,i+1,i+e+1],r),r+=6}return this.patchIndexBuffer=this.device.createBuffer({label:"relief-patch-indices",size:a.byteLength,usage:GPUBufferUsage.INDEX|GPUBufferUsage.COPY_DST}),this.device.queue.writeBuffer(this.patchIndexBuffer,0,a),this.patchIndexBuffer}computeGrid(){let[e,a]=this.grid;this.points=this.device.createBuffer({label:"relief-points",size:e*a*16,usage:GPUBufferUsage.STORAGE}),this.writeUniform(new Float32Array(16));let r=this.gridPipeline(),s=this.device.createBindGroup({layout:r.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:this.uniform}},{binding:1,resource:this.field.createView()},{binding:2,resource:{buffer:this.points}}]}),n=this.device.createCommandEncoder(),i=n.beginComputePass({label:"relief-grid"});i.setPipeline(r),i.setBindGroup(0,s),i.dispatchWorkgroups(Math.ceil(e/8),Math.ceil(a/8)),i.end(),this.device.queue.submit([n.finish()])}netPipeline(){if(this.netMaskPipeline)return this.netMaskPipeline;let e=this.device.createShaderModule({label:"relief-net-mask",code:cw});return this.netMaskPipeline=this.device.createRenderPipeline({label:"relief-net-mask",layout:"auto",vertex:{module:e,entryPoint:"vs_full"},fragment:{module:e,entryPoint:"fs_net",targets:[{format:"r8unorm"}]},primitive:{topology:"triangle-list"}}),this.netMaskPipeline}build(e,{range:a,netId:r=0,heightShare:s=sw}={}){let n=this.maskKey,i=this.mask&&n?.slices===this.analytic.slices&&n.nets===this.analytic.netsBuffer&&n.layer===e?.layerId&&n.net===r,o=i?this.mask:null;i&&(this.mask=null),this.release();let c=e?.field;if(!c)return o?.destroy(),!1;let l=this.boundsOf(e),[f,u]=ow(l);if(o)this.mask=o;else{let y=this.renderMask(e.layerId,l,f,u);this.mask=this.filterMask(y,f,u,r),y.destroy(),this.maskKey={slices:this.analytic.slices,nets:this.analytic.netsBuffer,layer:e.layerId,net:r}}let g=nw(c.values,c.width,c.height),p=Float32Array.from(g,y=>Number.isFinite(y)?y:3e38);this.field=this.device.createTexture({label:"relief-field",size:[c.width,c.height],format:"r32float",usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST}),this.device.queue.writeTexture({texture:this.field},p,{bytesPerRow:c.width*4},[c.width,c.height]);let[h,d]=Array.isArray(c.pitchMm)?c.pitchMm:[c.pitchMm,c.pitchMm],m=Math.max(l[2]-l[0],l[3]-l[1])/1e3,b=[Math.min(cf,Math.max(2,Math.ceil((l[2]-l[0])/h*of)+1)),Math.min(cf,Math.max(2,Math.ceil((l[3]-l[1])/d*of)+1))];return this.layer=e.layerId,this.sliceKey=e.key,this.boundsMm=l,this.base=e.z,this.height=m*s,this.grid=b,this.vertexCount=(b[0]-1)*(b[1]-1)*6,this.params={field:c,pitch:[h,d],range:a||[0,1]},this.computeGrid(),this.patches=Math.ceil((b[0]-1)/dt)*Math.ceil((b[1]-1)/dt),this.bindGroup=this.device.createBindGroup({layout:this.pipeline().getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:this.uniform}},{binding:1,resource:this.field.createView()},{binding:2,resource:this.mask.createView()},{binding:3,resource:this.sampler},{binding:4,resource:{buffer:this.analytic.palette}},{binding:5,resource:{buffer:this.points}}]}),this.renderer.invalidate?.(),!0}boundsOf(e){let a=this.analytic.slices.filter(n=>n.layerId===e.layerId&&(n.role===void 0||n.role==="copper")),r=(a.length?a:[e]).map(n=>n.bounds),s=.05;return[Math.min(...r.map(n=>n[0]))-s,Math.min(...r.map(n=>n[1]))-s,Math.max(...r.map(n=>n[2]))+s,Math.max(...r.map(n=>n[3]))+s]}renderMask(e,a,r,s){let{analytic:n,renderer:i,device:o}=this,c=n.extent,l=(c?.[0][2]??-.01)-.001,f=(c?.[1][2]??.01)+.001,u=iw(a,l,f),g=o.createTexture({label:"relief-pick",size:[r,s],format:"rg32uint",usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.TEXTURE_BINDING}),p=o.createTexture({label:"relief-pick-depth",size:[r,s],format:i.depthFormat,usage:GPUTextureUsage.RENDER_ATTACHMENT}),h={view:p.createView(),depthClearValue:0,depthLoadOp:"clear",depthStoreOp:"discard"};i.stencil&&Object.assign(h,{stencilClearValue:0,stencilLoadOp:"clear",stencilStoreOp:"discard"});let d=o.createCommandEncoder(),m=d.beginRenderPass({colorAttachments:[{view:g.createView(),clearValue:{r:0,g:0,b:0,a:0},loadOp:"clear",storeOp:"store"}],depthStencilAttachment:h}),b=i.innerCopperMode;i.innerCopperMode="all";try{i.writeGlobals(u,0,0,0,0),i.stencil&&m.setStencilReference(1),n.encodeInto(m,null,new Set([e]),!0,{matrix:u,showBoard:!1})}finally{i.innerCopperMode=b}return m.end(),o.queue.submit([d.finish()]),p.destroy(),g}filterMask(e,a,r,s){let{device:n}=this,i=n.createTexture({label:"relief-mask",size:[a,r],format:"r8unorm",usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.TEXTURE_BINDING}),o=n.createBuffer({label:"relief-net",size:16,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});n.queue.writeBuffer(o,0,new Uint32Array([s>>>0,0,0,0]));let c=this.netPipeline(),l=n.createBindGroup({layout:c.getBindGroupLayout(0),entries:[{binding:0,resource:e.createView()},{binding:1,resource:{buffer:this.analytic.netsBuffer}},{binding:2,resource:{buffer:o}}]}),f=n.createCommandEncoder(),u=f.beginRenderPass({colorAttachments:[{view:i.createView(),clearValue:{r:0,g:0,b:0,a:0},loadOp:"clear",storeOp:"store"}]});return u.setPipeline(c),u.setBindGroup(0,l),u.draw(3),u.end(),n.queue.submit([f.finish()]),o.destroy(),i}encode(e,a){return this.ready?(this.writeUniform(a),e.setPipeline(this.pipeline()),e.setBindGroup(0,this.bindGroup),e.setIndexBuffer(this.patchIndices(),"uint16"),e.drawIndexed(dt*dt*6,this.patches),1):0}writeUniform(e){let a=new Float32Array(this.scratch),r=new Uint32Array(this.scratch);a.set(e,0),a.set(this.boundsMm,16),a.set(this.params.field.originMm,20),a.set(this.params.pitch,22),r[24]=this.params.field.width,r[25]=this.params.field.height,r[26]=this.grid[0],r[27]=this.grid[1],a.set(this.params.range,28),a[30]=this.base,a[31]=this.height,a.set([.35,.45,.82,0],32),this.device.queue.writeBuffer(this.uniform,0,this.scratch)}worldBounds(){if(!this.ready)return null;let[e,a,r,s]=this.boundsMm;return[e/1e3,-s/1e3,this.base,r/1e3,-a/1e3,this.base+this.height]}release(){this.mask?.destroy(),this.field?.destroy(),this.points?.destroy(),this.points=null,this.mask=null,this.field=null,this.bindGroup=null,this.vertexCount=0,this.layer=null}destroy(){this.release(),this.uniform.destroy(),this.patchIndexBuffer?.destroy()}};var Hs=Object.freeze({restricted:{color:[.55,.57,.6,1],label:"Restricted"},loading:{color:[.7,.76,.82,1],label:"Loading\u2026"},building:{color:[.62,.72,.84,1],label:"Building 3D view\u2026"},missing:{color:[.78,.76,.7,1],label:"No 3D view"},failed:{color:[.86,.6,.56,1],label:"3D view failed"},unknown:{color:[.78,.76,.7,1],label:""}}),df=Object.freeze([.001,0,0,0,0,.001,0,0,0,0,.001,0,0,0,0,1]);function gr(t,e){let a=new Array(16);for(let r=0;r<4;r+=1)for(let s=0;s<4;s+=1)a[r*4+s]=t[s]*e[r*4]+t[4+s]*e[r*4+1]+t[8+s]*e[r*4+2]+t[12+s]*e[r*4+3];return a}function uw([t,e,a]){return[1,0,0,0,0,1,0,0,0,0,1,0,t,e,a,1]}function fw([t,e,a]){return[t,0,0,0,0,e,0,0,0,0,a,0,0,0,0,1]}function uf(t,e){return gr(df,gr(t,e))}function ff(t,e){let a=e.minMm,r=e.maxMm.map((s,n)=>Math.max(s-a[n],.2));return gr(df,gr(t,gr(uw(a),fw(r))))}function hf(t){let e=Number(t?.[2])||0,a=Number(t?.[5])||0;return[1e3,0,0,0,0,1e3,0,0,0,0,1e3,0,0,0,-1e3*(e+a)/2+0,1]}function bf(t,e,a){return t.restricted?"restricted":!t.assetId||!e?"missing":a==="loaded"?null:a==="failed"?"failed":e.status==="ready"?e.bundleUrl?"loading":"building":Hs[e.status]?e.status:"unknown"}function bo(t){return!!(t&&t.status==="ready"&&t.bundleUrl)}function pf(t,e){return!t||t.bundleUrl!==e.bundleUrl||t.loadState==="failed"?"create":t.loadState==="waiting"&&bo(e)?"load":"keep"}function gf(t){return(t?.occurrences||[]).filter(e=>e.kind==="board"||e.restricted)}function hw(t,e){if(!t)return[0,0,0];let a=Number(t.depth)||0,r=t.axis||[0,0,0],s=a*Math.max(0,Math.min(1,Number(e)||0))*30;return[0,1,2].map(n=>(Number(r[n])||0)*s)}function mf(t,e,a){let r=hw(e,a);if(!r[0]&&!r[1]&&!r[2])return t;let s=[...t];return s[12]+=r[0],s[13]+=r[1],s[14]+=r[2],s}var PS=512*1024*1024;var Of=230,vo=document,wt,z,Pe,en,tn,an,pn,gn,ft,$s,mr,rt,Me,ze,bw,rn,yr,Fe,re,mn,yn,Ue,_a,ca,ut,xt,ee=t=>vo.querySelector(t),oa=t=>vo.querySelectorAll(t);function Ff(t=document){vo=t,wt=ee("#app"),z=ee("#viewport"),Pe=ee("#schematic-viewport"),en=ee("#schematic-dom-layer"),tn=ee("#schematic-flow-overlay"),an=ee("#bom-view"),pn=ee("#status")||{set textContent(e){}},gn=ee("#viewer-kind")||{set textContent(e){}},ft=ee("#selection")||{set textContent(e){}},$s=ee("#diagnostics")||{set innerHTML(e){}},mr=ee("#scene-stats"),rt=ee("#layers"),Me=ee("#search-controls"),ze=ee("#view-controls"),Ue=ee("#stackup-workspace-view"),bw=ee("#fallback"),rn=ee("#panel-labels"),yr=ee("#schematic-labels"),Fe=ee("#axis-gizmo"),re=ee("#selection-card"),mn=ee("#primary-heading"),yn=ee("#primary-description"),_a=ee("#mode-switch"),ca=ee("#system-labels"),ut=ee("#move-gizmo"),xt=ee("#system-help"),wt.classList.add("workspace-pcb")}var pw=Object.freeze([{role:"soldermask",side:"front",name:"F.Mask"},{role:"soldermask",side:"back",name:"B.Mask"},{role:"silkscreen",side:"front",name:"F.SilkS"},{role:"silkscreen",side:"back",name:"B.SilkS"},{role:"paste",side:"front",name:"F.Paste"},{role:"paste",side:"back",name:"B.Paste"}]),gw={soldermask:"#1f6b45",silkscreen:"#f2f2f2",paste:"#a0a3a8"};function Pf(){return{workspace:"pcb",clickSelect:!0,mode:"3d",activeNetId:0,selectedFeatureId:0,selectedOccurrence:0,selectionAnchor:null,showBoard:!0,showComponents:!0,showPlaceholders:!0,realisticColors:!0,hiddenBoardLayers:[],isolateNet:!1,savedShowBoard:!0,savedShowComponents:!0,preIsolationShowBoard:null,separation:0,dragging:!1,dragMode:"orbit",lastX:0,lastY:0,pointerStartX:0,pointerStartY:0,frameCpuMs:0,frameCpuP95Ms:0,frameIntervalMs:0,frameIntervalP95Ms:0,frameSamples:[],fps:0,frames:0,fpsAt:performance.now(),activeTab:"layers",selectedPageId:"",selectedSchematicFeature:null,schematicDragging:!1,schematicLastX:0,schematicLastY:0,schematicStartX:0,schematicStartY:0}}function Mr(t={}){return{key:t.key??"board",topology:t.topology||window.__TOPOLOGY__||{},semanticGeometry:t.semanticGeometry||window.__SEMANTIC_GEOMETRY__||{},viewerReadiness:t.readiness||{stage:"semantic-ready",progress:100},assetCache:t.assetCache||null,deferComponents:!!t.deferComponents,scene:mw(),renderer:null,compareLayers:new Set,desiredCompareLayers:new Set,visible3dLayers:new Set,preIsolation3dLayers:null,preIsolationCompareLayers:null,highlightedNetIds:new Set,hiddenComponents:new Set,hiddenComponentRequest:null,loadedBytes:0,triangles:0,residentTileBytes:0,residentTileGpuBytes:0,residentTileTriangles:0,tileLoads:0,tileEvictions:0,tileSchedulerMs:0,lastTileScheduleAt:0,visibleTileIds:new Set,gpuBytes:0,analytic:null,analyticSource:null,analyticGeneration:0,asset:null,bundleUrl:"",loadState:"",abort:null}}function mw(){return{manifest:null,manifestUrl:"",layers:[],copperLayers:[],nets:[],features:new Map,tiles:new Map,loaded:new Set,loading:new Map,failed:new Map,residentTiles:new Map,componentFeatures:new Map,componentModelCounts:new Map,componentTier:"idle",componentEntries:[],componentsWantedAt:0,componentEvictions:0,runtimeBounds:null,layerZOffsets:new Float32Array(256),layerZOffsetSignature:""}}function jf(){return{key:"",started:0,from:new Map,current:new Map}}function Lf(){return{phase:"idle",previous:new Set,target:new Set,previousOffsets:new Map,started:0}}function Df(){return{manifest:null,manifestUrl:"",pages:[],byId:new Map,activeNetUid:"",visiblePages:[],fitted:!1,rendererMode:new URLSearchParams(location.search).get("schematicRenderer")||"svg-dom",domFallbackReason:""}}var w=Pf(),k=Mr(),E=null,Re=jf(),Q=Lf(),U=Df(),sn=[],yw=5e3;var O,te,st,H,he,Jt=new Map,Yt=performance.now(),je=0,Ys=0,Sr=null,nn=null,on=null,po=!1,qe=!1,yo=null,xn=()=>!0,xr=!0;function Uf(t){let e=new Map((t.components||[]).map(r=>[r.uid,r])),a={};for(let r of t.terminals||[]){let s=r.net_uid;if(!s)continue;let n=e.get(r.component_uid)||{},i={designator:r.designator||n.designator||"",pin:r.pin||"",value:n.value||"",pcb_pad_id:r.pcb_pad_id||"",pcb_pad_source_uid:r.pcb_pad_source_uid||""};a[s]||(a[s]={terminals:[]});let o=a[s].terminals;o.some(c=>c.designator===i.designator&&c.pin===i.pin)||o.push(i)}return a}function xw(t,e=k){if(!t||!e.scene?.features)return 0;let a=t.pcb_pad_source_uid||"";if(!a&&t.pcb_pad_id&&(a=(e.topology?.physical_objects||[]).find(s=>s.uid===t.pcb_pad_id)?.source_ids?.[0]||""),!a)return 0;for(let[r,s]of e.scene.features.entries())if(s.sourceUid===a&&s.kind==="pad")return r;return 0}function ko(t,e=k){return!t||!e.topology||!e.topology.components?null:e.topology.components.find(a=>a.designator===t)}function Ws(t,e){for(let a of Object.keys(t))delete t[a];Object.assign(t,e)}function zf(){if(Ys&&(cancelAnimationFrame(Ys),Ys=0),window.removeEventListener("keydown",Qh),E){for(let t of E.boards.values())t.abort?.abort(),vr(t);E.scene.dispose(),E=null,k.renderer=null}vr(),k.renderer?.dispose?.(),k.renderer=null,O=null,te?.dispose?.(),te=null,st=null,Sr=null,xn=()=>!0,xr=!0}function Gf(){return je+=1,zf(),Ws(w,Pf()),k=Mr(),Ws(Re,jf()),Ws(Q,Lf()),Ws(U,Df()),sn=[],H=null,he=null,Jt=new Map,Yt=performance.now(),je}function Kf(t){t===je&&(je+=1,zf())}function wr(t){t===je&&(Ys=requestAnimationFrame(e=>kv(e,t)))}function Ne(t){return t===je}async function Vf(t={}){let e=Gf(),a={};if(k.topology=t.topology||window.__TOPOLOGY__||{},k.topology&&!k.topology.net_details&&(k.topology.net_details=Uf(k.topology)),k.semanticGeometry=t.semanticGeometry||window.__SEMANTIC_GEOMETRY__||{},k.viewerReadiness=t.readiness||k.semanticGeometry.readiness||{stage:"semantic-ready",progress:100},Sr=typeof t.onSelectionChange=="function"?t.onSelectionChange:null,on=typeof t.onContextMenu=="function"?t.onContextMenu:null,nn=typeof t.onViewStateChange=="function"?t.onViewStateChange:null,xn=typeof t.isActive=="function"?t.isActive:()=>!0,xr=t.workspaceScope!=="3d",k.assetCache=t.assetCache||null,w.gpuBudgetBytes=_s,Ff(t.root||document),!wt||!z)throw new Error("Semantic viewer shell is missing required DOM nodes");return await ov(e,a,t.onPerformanceEvent),{performance:a,...uh(),selectOccurrence:iv,setHighlightedNetIds(r){k.highlightedNetIds=r,k.renderer?.setEmphasizedNetIds(r)},resize(){k.renderer?.resize(),O?.resize(),w.workspace==="pcb"&&w.mode==="layer"&&Co()},setWorkspace(r){let s=r==="stackup"?"stackup":"pcb";w.workspace!==s&&Wh(s)},setHiddenComponents:qh,getComponentReferences(){return[...k.scene.componentFeatures.keys()]},async loadAnalyticPack(r,s={}){if(!k.renderer)return null;let n=performance.now();vr();let i=Math.round(performance.now()-n),o=++k.analyticGeneration,c=await lo({renderer:k.renderer,layers:k.scene.layers,colorFor:f=>{let u=ln(f,k);return u.length>=4?u.slice(0,4):[...u,1]},bytes:r,wasm:s.wasm,toleranceNm:s.toleranceNm,nets:k.scene.manifest?.nets,features:k.scene.manifest?.objectFeatures,boardZOffsetMm:k.scene.manifest?.boardZOffsetMm});if(o!==k.analyticGeneration||!k.renderer)return c.analytic.destroy(),c.pack.free(),null;let l=performance.now();return k.renderer.setAnalytic(c.analytic),c.timings.attach=Math.round(performance.now()-l),k.analytic=c,k.analytic.timings={release:i,...k.analytic.timings},yf()},setAnalyticOverlay(r){if(!k.analytic)return null;let s=tf(k.analytic,r);return k.reliefOptions&&xf(!1),s},setAnalyticRelief(r){return k.reliefOptions=r||null,xf(!0)},setAnalyticVectors(r){return k.analytic?fo(k.analytic,r):null},setAnalyticStyle(r){return k.analytic?sf(k.analytic,r):null},analyticColormaps(){return{colormaps:Gi,defaults:tr}},setClickSelect(r){w.clickSelect=r!==!1},analyticProbe(r,s){if(!k.analytic?.overlay||k.analytic.overlay.kind==="operation_values")return null;let n=Rf(r,s);if(!n)return null;let i=w.mode==="3d"?k.visible3dLayers:null,o=Ks(k.analytic,n,fn(),null,i,1);if(!o)return null;let{quantity:c,units:l}=k.analytic.overlay;return{value:o.value,quantity:c,units:l,sliceKey:o.sliceKey,boardMm:o.boardMm,world:o.world,marker:If(o.world)}},async analyticAt(r,s){if(!k.analytic)return null;let n=await Yh(r,s);if(n?.kind!=="analytic")return null;let i=Rf(r,s);if(!i||k.analytic.overlay?.kind==="operation_values")return ho(k.analytic,n.operationIndex);let o=fn(),c=nf(k.analytic.pack.header,n.operationIndex),l=c&&Ks(k.analytic,i,o,c)||Ks(k.analytic,i,o),f=await ho(k.analytic,n.operationIndex,l);return l?{...f,marker:If(l.world)}:f},analyticStats:yf,unloadAnalyticPack(){k.analyticGeneration+=1,vr()},setLodOverride(r){k.renderer?.setLodOverride(r)},projectComponent(r){return Jh(k,r,s=>ia(s,et))},projectPoint(r){return ia(r,et)},setViewMode:jh,renderInset:Mv,insetReady:Ch,releaseInset(r){dn.release(r)},insetBoard:()=>({scene:k.scene,topology:k.topology}),onSceneChange(r){return un.add(r),()=>un.delete(r)},insetStats(){return{...Js,views:dn.size,targets:[oe.width,oe.height]}},insetSettings(r){return Object.assign(Af,r||{}),{...Af}},gpuIdle(){return k.renderer?.device.queue.onSubmittedWorkDone()??Promise.resolve()},dispose(){nv(),Kf(e)}}}function yf(){let t=k.analytic;return t?{operations:t.operations,lowerMs:t.lowerMs,timings:t.timings,zOffset:t.zOffset,unmatched:t.unmatched,...t.analytic.stats()}:null}function xf(t){let e=k.renderer;if(!e)return null;let a=k.reliefOptions,r=k.analytic?.overlay;if(!a||!r||r.kind==="operation_values"){let i=e.relief?.ready;return e.relief?.release(),i&&t&&H.frame(Qt()),e.invalidate?.(),null}let s=af(k.analytic).sort((i,o)=>o.cells-i.cells),n=s.find(i=>i.key===a.sliceKey)||s[0];return n?(e.relief??=new qs(k.analytic.analytic),e.relief.build(n.slice,{range:r.range,netId:rf(k.scene.manifest?.nets,r.net),heightShare:a.heightShare}),t&&H.frame(e.relief.worldBounds()),e.invalidate?.(),{sliceKey:n.key,slices:s.map(i=>({key:i.key,layerId:i.layerId,cells:i.cells}))}):(e.relief?.release(),e.invalidate?.(),{sliceKey:null,slices:[]})}async function ww(t,e=k){return E?.boards.get(e.key)===e?(await vw(t,e)).slice():qf(t,e)}function vw(t,e){let a=E.downloads.get(t);return a||(a=qf(t,e),E.downloads.set(t,a),a.then(()=>E?.downloads.delete(t),()=>E?.downloads.delete(t))),a}async function qf(t,e){let a=Th(e);if(a)return new Uint8Array(await a(t));let r=await fetch(t,{cache:"default"});if(!r.ok)throw new Error(`Failed to load ${t}: ${r.status}`);return new Uint8Array(await r.arrayBuffer())}async function kw(t,e,a){let r=t.semanticGeometry.assets||{};if(!r.analytic_pack)throw new Error("The analytic bundle names no pack");let s=performance.now(),[n,i]=await Promise.all([ww(r.analytic_pack,t),r.stackup?yh(r.stackup,t).catch(()=>null):null]);if(a.analytic_pack_fetch_ms=performance.now()-s,a.analytic_pack_bytes=n.byteLength,t.loadedBytes+=n.byteLength,!Ne(e))return!1;let o=t.semanticGeometry.cache_key||"",c=t.assetCache&&o?await Ru(t.assetCache,{cacheKey:o,wasmKey:Sa(),toleranceNm:ra}):!1;a.analytic_lowering_cached=c;let l=br.start(n,Bs(),c?1:Ls(js));s=performance.now();let f=c?(await hr(t.assetCache,{cacheKey:o,wasmKey:Sa(),toleranceNm:ra},[fr])).get(fr):null,u=f&&Ou(f,l)||l&&await Bu(l)||await ur(n);return a.analytic_pack_from_cache=!!f,a.analytic_pack_open_ms=performance.now()-s,a.analytic_pack_hosted=!!u.hosted,Ne(e)?(t.analyticSource={bytes:n,pack:u,stackup:i,pool:l},t.scene.manifest=Xo(u.header,i),!0):(u.free(),l?.close(),!1)}async function Hf(t,e,a){let r=e.analyticSource,s=++e.analyticGeneration;e.renderer.stackupLooks=$o(r.stackup);let n=e.semanticGeometry.cache_key||"",i={renderer:e.renderer,layers:e.scene.layers,colorFor:f=>{let u=ln(f,e);return u.length>=4?u.slice(0,4):[...u,1]},bytes:r.bytes,pack:r.pack,nets:e.scene.nets,cache:e.assetCache&&n?{store:e.assetCache,cacheKey:n}:null,pool:r.pool},o=performance.now(),c=await lo(i),l=r.pool;return l&&c.pack.hosted?c.cacheWrites.then(()=>l.release()):l?.close(),r.pool=null,s!==e.analyticGeneration||!Ne(t)||!e.renderer?(c.analytic.destroy(),c.pack.free(),null):(e.renderer.setAnalytic(c.analytic),e.analytic=c,a.analytic_board_ms=performance.now()-o,a.analytic_board=c.timings,La(e.scene.manifest.bbox))}function vr(t=k){t.renderer?.relief?.destroy(),t.renderer&&(t.renderer.relief=null),t.renderer?.setAnalytic(null),t.analytic?.pack.free(),t.analytic=null}var Ew="prism.system_scene.a0";function Ge(){return E?[...E.boards.values()].filter(t=>t.renderer&&t.loadState==="loaded"):[]}async function Wf(t={}){let e=Gf();if(Sr=typeof t.onSelectionChange=="function"?t.onSelectionChange:null,on=typeof t.onContextMenu=="function"?t.onContextMenu:null,nn=typeof t.onViewStateChange=="function"?t.onViewStateChange:null,xn=typeof t.isActive=="function"?t.isActive:()=>!0,xr=!1,w.gpuBudgetBytes=_s,Ff(t.root||document),!wt||!z)throw new Error("Semantic viewer shell is missing required DOM nodes");if(typeof t.loadBundle!="function")throw new Error("A system scene needs a bundle loader");let a=await ps.create(z);return Ne(e)?($t.prewarm(a.host),E={scene:a,loadBundle:t.loadBundle,onEmphasis:typeof t.onEmphasis=="function"?t.onEmphasis:null,onMove:typeof t.onMove=="function"?t.onMove:null,baseDescriptor:null,descriptor:null,move:Vw(),gizmo:null,standInKey:null,showLabels:!0,explode:0,boards:new Map,downloads:new Map,groups:new Map,placed:[],placements:new Map,hiddenLayers:new Map,separation:new Map,bounds:null,framed:!1,snapped:!1,boardSelected:!1,inputs:new Map,emphasisSets:[],emphasisBounds:new Map,emphasisReport:null},k=Mr({key:""}),H=new Da([-.1,-.1,-.01,.1,.1,.01]),Bo(),Hh(),Kh(),eb(),pn.textContent="System scene",wr(e),{...uh(),focusPlacement:_w,selectBoardContext:Qf,setEmphasisSets:jw,setSystemScene:Mw,frameNetEmphasis:Lw,frameAll:Dw,setMoveAllowed:qw,setMoveMode:cn,setMoveSpace:oh,previewPose:Hw,cancelMove:_o,getMoveState:()=>E?ih():null,setAssemblyExplode:Ow,setMoveSnap:Fw,setLabelsVisible:tv,setHelpVisible:dh,isHelpVisible:()=>!!(xt&&!xt.hidden),frameBoard:Uw,frameParts:zw,resize(){E?.scene.resize()},setLodOverride(r){for(let s of Ge())s.renderer.setLodOverride(r)},viewAxis(r,s=!1){!E||!["x","y","z"].includes(r)||(H.setAxis(r,!!s),E.bounds&&H.frame(E.bounds))},projectPoint(r,s){return kf(r,s)},projectComponent(r,s){let n=E?.placements.get(String(s));return n?.board?Jh(n.board,r,i=>kf(i,s)):null},dispose(){Kf(e)}}):(a.dispose(),null)}function Mw(t){if(!E)return;if(t?.schema!==Ew)throw new Error(`Unsupported system scene schema: ${t?.schema||"missing"}`);E.baseDescriptor=t;let e=E.move.target?(t.occurrences||[]).find(r=>r.path===E.move.target):null;e?!E.move.drag&&sh(E.move.preview,e.pose)&&(E.move.preview=null):(E.move.drag=null,E.move.preview=null,E.move.target=null),E.descriptor=nh();let a=new Set;for(let r of t.assets||[]){a.add(r.assetId);let s=E.boards.get(r.assetId),n=pf(s,r);if(n!=="create"){s.asset=r,n==="load"&&vf(s,je);continue}s&&wf(r.assetId);let i=Mr({key:r.assetId,topology:{},semanticGeometry:{},deferComponents:!0});Object.assign(i,{asset:r,bundleUrl:r.bundleUrl,loadState:"waiting",abort:null}),E.boards.set(r.assetId,i),bo(r)&&vf(i,je)}for(let r of[...E.boards.keys()])a.has(r)||wf(r);kr(),E.move.enabled&&(vn({quiet:!0}),ht("sync"))}function wf(t){let e=E.boards.get(t);e?.abort?.abort(),E.boards.delete(t),E.scene.removeAsset(t),e&&(vr(e),e.renderer=null),k===e&&Eo()}async function vf(t,e){t.loadState="loading",t.abort=new AbortController;let a=()=>Ne(e)&&E?.boards.get(t.key)===t&&!t.abort.signal.aborted;try{let r=await E.loadBundle(t.bundleUrl,t.abort.signal);if(!a())return;t.topology=r.topology||{},t.topology.net_details||(t.topology.net_details=Uf(t.topology)),t.semanticGeometry=r.semanticGeometry||{},t.viewerReadiness=r.readiness||t.semanticGeometry.readiness||{stage:"semantic-ready",progress:100},t.assetCache=r.assetCache||null;let s={};if(!await mh(t,e,s)||!a())return;t.renderer=E.scene.asset(t.key),t.renderer.setBarrels(hi(t.scene.manifest.barrels,t.scene.manifest.layers)),t.renderer.setHiddenBoardLayers(w.hiddenBoardLayers),t.renderer.setPlaceholdersVisible(w.showPlaceholders),Ir(t);let n=await Hf(e,t,s);if(!a())return;t.scene.runtimeBounds=n||La(t.scene.manifest.bbox),t.renderer.setBoardBounds(t.scene.runtimeBounds),t.bundleToBoard=hf(t.scene.runtimeBounds),t.loadState="loaded",t.performance=s,kr(),No(e,t).catch(i=>console.warn("Failed to load components",i))}catch(r){if(!a())return;console.warn(`[prism-semantic-viewer] system board ${t.key} failed to load`,r),t.loadState="failed",t.error=r?.message||String(r),E.scene.removeAsset(t.key),t.renderer=null,k===t&&Eo(),kr()}}function kr({relabel:t=!0}={}){let e=E?.descriptor;if(!e)return;let a=Er(),r=new Map((e.assets||[]).map(o=>[o.assetId,o])),s=new Map,n=[];for(let o of gf(e)){let c=o.assetId?r.get(o.assetId):null,l=o.assetId?E.boards.get(o.assetId):null,f=bf(o,c,l?.loadState),u=mf(o.worldMatrix,o.explode,E.explode),g,p,h,d=c?.bundleToBoard??l?.bundleToBoard;if(!f&&l?.renderer&&d)g=l.key,p=uf(u,d),h=xa(p,l.scene.runtimeBounds);else{if(!o.boundsMm)continue;let b=f||"loading";g=`stand-in:${b}`,E.scene.standIn(g,Hs[b].color),p=ff(u,o.boundsMm),h=xa(p,[0,0,0,1,1,1])}s.has(g)||s.set(g,[]);let m=f?[]:[...E.hiddenLayers.get(o.path)||[]];s.get(g).push({matrix:p,key:o.path,hiddenLayers:m,explode:f?null:So(l,E.separation.get(o.path)||0)}),n.push({occurrence:o,rendererId:g,board:f?null:l,matrix:p,worldBounds:h,standIn:f})}for(let o of E.scene.assets.keys())s.has(o)||s.set(o,[]);E.scene.setOccurrences(s),E.groups=s;let i=E.placements;if(E.placed=n,E.placements=new Map(n.map(o=>[o.occurrence.path,o])),E.standInKey&&!E.placements.has(E.standInKey)&&(E.standInKey=null),t||!i)av();else for(let o of n)o.label=i.get(o.occurrence.path)?.label;E.bounds=ba(n.map(o=>o.worldBounds)),E.bounds&&(H.sceneRadius=Et(E.bounds),E.framed||(H.frame(E.bounds),E.snapped||H.snap(),E.snapped=!0,n.some(o=>o.standIn==="loading")||(E.framed=!0)));for(let o of Ge())wn(o);a!=null&&(E.placements.get(a)?.board===k?w.selectedOccurrence=k.renderer.occurrenceKeys.indexOf(a):Eo()),ah(),kt()}function Er(){return!E||!k.renderer||!Xf()?null:k.renderer.occurrenceKeys[w.selectedOccurrence]??null}function Xf(){return!!(w.selectedFeatureId||w.activeNetId||E?.boardSelected)}function $f(t){if(k===t)return;let e=qe;qe=!0;try{He()}finally{qe=e}k=t,Le()}function Eo(){He(),k=Mr({key:""}),Le()}function Sw(t,e){let a=performance.now(),r=Math.max(0,t-Yt),s=Math.min(.05,(t-Yt)/1e3);if(Yt=t,!H)return;H.update(s),E.scene.resize(),he={layerId:0,viewport:{x:0,y:0,width:z.width,height:z.height},matrix:H.matrix(z.width,z.height,!1),lod:kh(z.height/Math.min(devicePixelRatio||1,2),!1)};let n=Oa(),i=new Map;for(let o of Ge()){let c=o.analytic?th(o):0,l=o.analytic?Nw(o,c):eh(o);o.scene.copperRealism!==Na(o)&&Ir(o),o.renderer.setInnerCopperMode(xh(!w.showBoard||Cw(o),Zf(o).size>0)),o.renderer.dimCopper=n;let f=o===k;i.set(o.renderer,{activeNetId:f?w.activeNetId:0,selectedFeatureId:f?w.selectedFeatureId:0,time:t/1e3,layerOffsets:l,visibleLayers:o.visible3dLayers,showBoard:w.showBoard,showComponents:w.showComponents,showPaste:c===0,componentOpacity:de(1-c/.1,0,1),boardOpacity:n?.34:1-c*.72,isolateNet:w.isolateNet,compareMode:!1,compareOffsets:new Map,layerAlphas:null,visibleTileIds:o.visibleTileIds})}E.inputs=i,E.scene.setSelectedOccurrence(k.renderer&&Xf()?k.renderer.occurrenceBase+w.selectedOccurrence:-1),sv(t,i,n)&&(E.scene.render(he,o=>i.get(o)||Yf(t)),Zh(),rv()),Xw();for(let o of Ge())Ah(t,o);xo(r,performance.now()-a),wo(t),wr(e)}function Yf(t){return{activeNetId:0,selectedFeatureId:0,time:t/1e3,visibleLayers:new Set,showBoard:!0,showComponents:!1,componentOpacity:1,boardOpacity:1,isolateNet:!1}}function Tw(t,e){let a=performance.now();return E.scene.pick(he,t,e,r=>E.inputs.get(r)||Yf(a))}function Aw(t){let e=t.occurrenceKey!=null?E.placements.get(t.occurrenceKey):null;if(!e)return He();if(e.standIn)return Jf(e);let a=e.board;if(w.isolateNet&&!Iw(a,e.occurrence.path,t.featureId))return He();$f(a),w.selectedOccurrence=a.renderer.occurrenceKeys.indexOf(e.occurrence.path),t.featureId&&!E.move.enabled?da(t.featureId,!0):Qf()}function _w(t){let e=t!=null?E?.placements.get(String(t)):null;return e?e.standIn?(Jf(e),"stand-in"):($f(e.board),w.selectedOccurrence=k.renderer.occurrenceKeys.indexOf(e.occurrence.path),"board"):null}function Jf(t){let e=qe;qe=!0;try{He()}finally{qe=e}E.standInKey=t.occurrence.path,E.move.enabled&&vn(),qe||Sr?.({kind:"board",sourceContext:"3D",occurrence:t.occurrence.path,standIn:t.standIn})}function Qf(){let t=w.selectedOccurrence,e=qe;qe=!0;try{He()}finally{qe=e}w.selectedOccurrence=t,E&&(E.boardSelected=!0),kn({kind:"board",sourceContext:"3D"})}function Iw(t,e,a){let r=Number(t.scene.features.get(Number(a))?.netId)||0;if(!r)return!1;let s=t.renderer.occurrenceKeys.indexOf(e);return s<0?!1:t.renderer.occurrenceEmphasis?.[s]?.has(r)?!0:t===k&&s===w.selectedOccurrence&&r===Number(w.activeNetId)}function kf(t,e){let a=E?.placements.get(String(e));return a?ia(t,a.matrix):null}function Zf(t=k){if(!E)return Ra();let e=new Set(t===k?Ra():[]);for(let a of t.renderer?.occurrenceEmphasis||[])if(a)for(let r of a.keys())e.add(Number(r));return e}function wn(t){let e=E.groups.get(t.key)||[],a=new Set;for(let r of t.scene.copperLayers){let s=Number(r.id);e.some(n=>!E.hiddenLayers.get(n.key)?.has(s))&&a.add(s)}if(w.isolateNet){let r=new Set;for(let s of Zf(t))for(let n of Oo(s,t))r.add(n);t.visible3dLayers=r.size?new Set([...a].filter(s=>r.has(s))):a}else t.visible3dLayers=a}function Mo(t,e){let a=t??(E.groups.get(k.key)||[]).map(r=>r.key);for(let r of a){let s=new Set(E.hiddenLayers.get(String(r))||[]);e(s,E.placements.get(String(r))?.board),E.hiddenLayers.set(String(r),s)}for(let r of Ge()){let s=E.groups.get(r.key)||[];for(let n of s)n.hiddenLayers=[...E.hiddenLayers.get(n.key)||[]];r.renderer.setOccurrenceHiddenLayers(s.map(n=>n.hiddenLayers)),wn(r)}Le(),kt()}function Rw(){let t=Er();if(t==null||!w.activeNetId)return;let e=Oo(w.activeNetId,k);e.size&&Mo([t],a=>{a.clear();for(let r of k.scene.copperLayers)e.has(Number(r.id))||a.add(Number(r.id))})}function eh(t){if(t.scene.layerSteps)return t.scene.layerSteps;let e=new Float32Array(256),a=(t.scene.copperLayers.length-1)/2;return t.scene.copperLayers.forEach((r,s)=>{e[Number(r.id)]=a-s}),t.scene.layerSteps=e,e}function th(t){let e=(E.groups.get(t.key)||[])[0]?.key;return e==null?0:E.separation.get(e)||0}function Nw(t,e){let a=So(t,e)[0],r=`${a}:${t.scene.copperLayers.length}`;if(t.scene.analyticOffsets??=new Float32Array(256),t.scene.analyticOffsetSignature===r)return t.scene.analyticOffsets;let s=eh(t);for(let n=0;n<s.length;n+=1)t.scene.analyticOffsets[n]=s[n]*a;return t.scene.analyticOffsetSignature=r,t.scene.analyticOffsets}function So(t,e){let a=t?.scene.runtimeBounds,r=a?Math.hypot((a[3]-a[0])*1e3,(a[4]-a[1])*1e3):0;return[e*e*de(r*.12,8,25)/1e3,e<.0999?1:0,1-e*.72,1]}function Cw(t){return(E.groups.get(t.key)||[]).some(e=>(E.separation.get(e.key)||0)>.001)}function Bw(t,e){let a=e!=null?[String(e)]:(E.groups.get(k.key)||[]).map(r=>r.key);for(let r of a)E.separation.set(r,t);for(let r of Ge()){let s=E.groups.get(r.key)||[];r.renderer.setOccurrenceExplode(s.map(n=>So(r,E.separation.get(n.key)||0)))}kt()}function Ow(t){if(!E)return;let e=de(Number(t)||0,0,1);e!==E.explode&&(E.explode=e,kr({relabel:!1}))}function Fw(t){E&&(E.move.snap=as(t,E.move.snap))}function Pw(){return E.placed.map(t=>{let e=E.hiddenLayers.get(t.occurrence.path)||new Set,a=t.board;return{key:t.occurrence.path,name:t.occurrence.label||t.occurrence.displayPath||t.occurrence.path,standIn:t.standIn||null,separation:E.separation.get(t.occurrence.path)||0,layers:a?a.scene.copperLayers.map(r=>({id:Number(r.id),name:String(r.name),color:Mn(En(r,a)),visible:!e.has(Number(r.id))})):[]}})}function jw(t){return E?(E.emphasisSets=t,ah()):null}function ah(){if(!E)return[];let t=new Map;for(let[n,i]of E.groups)t.set(n,i.map(()=>null));let e=new Map;for(let n of E.groups.values())n.forEach((i,o)=>e.set(i.key,o));E.emphasisBounds=new Map;let a=E.emphasisSets.map(n=>{let i={key:n.key,color:n.color,lit:0,unresolved:[]},o=[];E.emphasisBounds.set(n.key,o);for(let c of n.members){let l=E.placements.get(c.occurrence),f=l?.board;if(!f){let m=l?l.standIn==="loading"||l.standIn==="building"?"loading":l.standIn==="restricted"?"restricted":"not-drawn":"not-drawn";i.unresolved.push({occurrence:c.occurrence,net:c.net,reason:m});continue}let u=Zt(f.scene.nets,c.net),g=Number(u?.id)||0;if(!g){i.unresolved.push({occurrence:c.occurrence,net:c.net,reason:"unknown-net"});continue}let p=t.get(f.key),h=e.get(c.occurrence);if(!p||h==null)continue;p[h]=p[h]||new Map,p[h].has(g)||p[h].set(g,n.mark),i.lit+=1;let d=ha(u.boundsMm);d&&o.push({occurrence:c.occurrence,box:xa(l.matrix,d)})}return i}),r=E.emphasisSets.length>0;for(let n of Ge())n.renderer.setOccurrenceEmphasis(r&&t.get(n.key)||null,{dimCopper:r});if(w.isolateNet)for(let n of Ge())wn(n);let s=JSON.stringify(a)!==JSON.stringify(E.emphasisReport);return E.emphasisReport=a,s&&E.onEmphasis?.(a),a}function Lw(t=null,e=null){let a=[];for(let[s,n]of E?.emphasisBounds||[])if(!(t!=null&&s!==String(t)))for(let i of n)(e==null||i.occurrence===e)&&a.push(i.box);let r=ba(a);return r?(H.frame(r),!0):!1}function Dw(){E?.bounds&&H.frame(E.bounds)}function Uw(t){let e=E?.placements.get(String(t));return e&&H.frame(e.worldBounds),!!e}function zw(t){let e=[];for(let r of Array.isArray(t)?t:[]){let s=E?.placements.get(String(r?.occurrence));if(s&&!r?.reference){s.worldBounds&&e.push(s.worldBounds);continue}let n=s?.board?.scene.componentFeatures.get(String(r?.reference)),i=n?s.board.scene.features.get(Number(n.featureId))?.bounds:null;i&&e.push(xa(s.matrix,i))}let a=ba(e);return a?(H.frame(a),!0):!1}var rh=.001,Gw=90,Ef=["#e5484d","#30a46c","#3e63dd"],go=["X","Y","Z"],Kw="http://www.w3.org/2000/svg";function sh(t,e){if(!t||!e)return!1;let a=qt(t),r=qt(e),s=[...a.translationMm,...a.rotation],n=[...r.translationMm,...r.rotation];return s.every((i,o)=>Math.abs(i-n[o])<1e-6)}function Vw(){return{allowed:!1,enabled:!1,space:"world",target:null,preview:null,drag:null,snap:{...Vt}}}function nh(){let t=E.baseDescriptor;return!t||!E.move.target||!E.move.preview?t:Tl(t,E.move.target,E.move.preview)}function Tr(){E.baseDescriptor&&(E.descriptor=nh(),kr({relabel:!1}))}function To(){let t=E.move.target;return t?E.baseDescriptor?.occurrences.find(e=>e.path===t)??null:null}function ih(){let t=E.move,e=To();return{allowed:t.allowed,enabled:t.enabled,space:t.space,snap:{...t.snap},dragging:!!t.drag,target:e?{occurrence:e.path,instanceId:e.instanceId,displayPath:e.displayPath,label:e.label,kind:e.kind,restricted:!!e.restricted,pose:qt(t.preview??e.pose),source:t.preview?"manual":e.pose?.source??"default",unsaved:!!t.preview}:null}}function ht(t){E.onMove?.({phase:t,...ih()})}function qw(t){E.move.allowed=!!t,!E.move.allowed&&E.move.enabled&&cn(!1)}function cn(t,{space:e}={}){let a=!!t&&E.move.allowed;a!==E.move.enabled&&(a||ch(),E.move.enabled=a,e&&(E.move.space=e==="local"?"local":"world"),a&&(E.boardSelected=!0,vn({quiet:!0})),ht("mode"))}function oh(t){E.move.space=t==="local"?"local":"world",ht("mode")}function Ao(){return E.standInKey??Er()}function vn({quiet:t=!1}={}){if(!E)return;let e=Ao(),a=E.move.enabled&&e!=null?Sl(E.baseDescriptor,e):null,r=a?.movable===!0?a.path:null;r!==E.move.target&&(ch(),E.move.target=r,t||ht("target"))}function ch(){let t=!!E.move.preview;E.move.drag=null,E.move.preview=null,E.move.target=null,t&&Tr()}function Hw(t){E?.move.target&&(E.move.preview=t?qt(t):null,Tr(),ht("preview"))}function _o(){!E||!E.move.preview&&!E.move.drag||(E.move.drag=null,E.move.preview=null,Tr(),ht("cancel"))}function Ww(){let t=`${E.move.target}/`,e=ba(E.placed.filter(a=>a.occurrence.path===E.move.target||a.occurrence.path.startsWith(t)).map(a=>a.worldBounds));return e?[0,1,2].map(a=>(e[a]+e[a+3])/2/rh):null}function Xs(t){if(!he)return null;let e=ss(he.matrix,Ke(t,rh),he.viewport);if(!e)return null;let a=z.getBoundingClientRect();return[e.x*a.width/z.width,e.y*a.height/z.height]}function Xw(){let t=ut;if(!t)return;let e=E?.move.enabled?To():null,a=e&&typeof e.move=="object"?e.move:null,r=a?E.move.preview??e.pose:null,s=E?.move.enabled&&e&&he?a?.pivot==="origin"?[...r.translationMm]:Ww():null,n=s?Xs(s):null;if(!n){t.toggleAttribute("hidden",!0),E&&(E.gizmo=null);return}t.toggleAttribute("hidden",!1),t.firstChild||$w(t);let{right:i,back:o}=H.basis(),c=Xs(Je(s,i)),l=c?Math.hypot(c[0]-n[0],c[1]-n[1]):0;if(!(l>1e-6)){t.toggleAttribute("hidden",!0);return}let f=Gw/l,u=e?E.move.preview??e.pose:null,g=u&&(a||E.move.space==="local")?kl(u):ti,p=[];g.forEach((d,m)=>{let b=Xs(Je(s,Ke(d,f))),y=t.querySelector(`[data-part="t${m}"]`),x=b&&Math.hypot(b[0]-n[0],b[1]-n[1])>12&&(!a||(a.translate||[]).includes(m));if(y.style.display=x?"":"none",x){let _=y.querySelector("line");_.setAttribute("x1",n[0]),_.setAttribute("y1",n[1]),_.setAttribute("x2",b[0]),_.setAttribute("y2",b[1]),y.querySelector("circle").setAttribute("cx",b[0]),y.querySelector("circle").setAttribute("cy",b[1]),y.querySelector("text").setAttribute("x",b[0]+9),y.querySelector("text").setAttribute("y",b[1]-7)}let v=Al(d),M=pt(d,v),S=[];for(let _=0;_<=64;_+=1){let N=_/64*Math.PI*2,I=Xs(Je(s,Ke(Je(Ke(v,Math.cos(N)),Ke(M,Math.sin(N))),f*.7)));I&&S.push(`${I[0].toFixed(1)},${I[1].toFixed(1)}`)}let A=t.querySelector(`[data-part="r${m}"]`);A.setAttribute("points",S.join(" ")),A.style.display=a&&!(a.rotate||[]).includes(m)?"none":"",p.push({axis:d,pxPerMm:b?[(b[0]-n[0])/f,(b[1]-n[1])/f]:[0,0]})});let h=t.querySelector('[data-part="pivot"]');h.setAttribute("cx",n[0]),h.setAttribute("cy",n[1]),E.gizmo={center:n,pivot:s,handles:p,back:o,limits:a}}function $w(t){let e=(a,r)=>{let s=document.createElementNS(Kw,a);for(let[n,i]of Object.entries(r))s.setAttribute(n,i);return s};Ef.forEach((a,r)=>{let s=e("polyline",{"data-part":`r${r}`,class:"ring",stroke:a,fill:"none"}),n=e("title",{});n.textContent=`Rotate about ${go[r]}`,s.append(n),t.append(s)}),Ef.forEach((a,r)=>{let s=e("g",{"data-part":`t${r}`,class:"arrow",stroke:a,fill:a}),n=e("title",{});n.textContent=`Move along ${go[r]}`;let i=e("text",{stroke:"none"});i.textContent=go[r],s.append(n,e("line",{}),e("circle",{r:6}),i),t.append(s)}),t.append(e("circle",{"data-part":"pivot",r:4,class:"pivot"})),t.append(e("text",{"data-part":"readout",class:"readout"})),t.addEventListener("pointerdown",Yw),t.addEventListener("pointermove",Jw),t.addEventListener("pointerup",Zw),t.addEventListener("pointercancel",()=>lh())}function Yw(t){let e=t.target.closest?.("[data-part]")?.dataset.part;if(!E||!e||!E.gizmo||!/^[tr][012]$/.test(e))return;let a=To();if(!a)return;t.preventDefault(),t.stopPropagation();let r=E.gizmo.limits;if(r&&!((e[0]==="t"?r.translate:r.rotate)||[]).includes(Number(e[1])))return;let s=ut.getBoundingClientRect();E.move.drag={kind:e[0]==="t"?"translate":"rotate",snapDeg:r?.rotateSnapDeg??null,handle:E.gizmo.handles[Number(e[1])],start:[t.clientX-s.left,t.clientY-s.top],startPose:qt(E.move.preview??a.pose),hadPreview:!!E.move.preview,center:E.gizmo.center,pivot:E.gizmo.pivot,back:E.gizmo.back,changed:!1};try{ut.setPointerCapture(t.pointerId)}catch{}}function Jw(t){let e=E?.move.drag;if(!e)return;let a=ut.getBoundingClientRect(),r=[t.clientX-a.left,t.clientY-a.top],s=t.shiftKey,n=ai(E.move.snap),i,o;if(e.kind==="translate"){let c=s?n.fineMm:n.mm,l=ri(xl([r[0]-e.start[0],r[1]-e.start[1]],e.handle.pxPerMm),c);i=El(e.startPose,e.handle.axis,l),o=`${l>=0?"+":""}${l.toFixed(s||c<1?1:0)} mm`}else{let c=vl(e.handle.axis,e.back,wl(e.center,e.start,r))*180/Math.PI,l=e.snapDeg??(s?n.fineDeg:n.deg),f=ri(c,l);i=Ml(e.startPose,e.handle.axis,f*Math.PI/180,e.pivot),o=`${f>=0?"+":""}${f.toFixed(0)}\xB0`}e.changed=e.changed||!sh(i,e.startPose),E.move.preview=qt(i),Qw(o,r),Tr(),ht("preview")}function Qw(t,e){let a=ut.querySelector('[data-part="readout"]');a.textContent=t,a.setAttribute("x",e[0]+14),a.setAttribute("y",e[1]-10)}function Zw(t){let e=E?.move.drag;e&&(ut.hasPointerCapture?.(t.pointerId)&&ut.releasePointerCapture(t.pointerId),E.move.drag=null,ut.querySelector('[data-part="readout"]').textContent="",e.changed?ht("commit"):e.hadPreview||_o())}function lh(){let t=E?.move.drag;return t?(E.move.drag=null,E.move.preview=t.hadPreview?t.startPose:null,ut.querySelector('[data-part="readout"]').textContent="",Tr(),ht("cancel"),!0):!1}function ev(t,e){let a=E.move;if(e==="escape"){if(xt&&!xt.hidden)xt.hidden=!0;else if(!lh())if(a.preview)_o();else if(a.enabled)cn(!1);else return!1;return!0}if(e==="m"&&a.allowed)cn(!a.enabled);else if(e==="l"&&a.enabled)oh(a.space==="world"?"local":"world");else if(e==="enter"&&a.preview&&!a.drag)ht("commit");else if(t.key==="?")dh(!!xt?.hidden);else if(e==="a")H.frame(E.bounds||Qt());else return!1;return!0}function dh(t){xt&&(xt.hidden=!t)}function tv(t){E&&(E.showLabels=!!t,ca&&(ca.hidden=!E.showLabels))}function av(){ca&&(E.labelsDrawn=null,ca.replaceChildren(...E.placed.map(t=>{let e=document.createElement("div");e.className=`scene-label${t.standIn?` stand-in ${t.standIn}`:""}`;let a=document.createElement("strong");a.textContent=t.occurrence.label||t.occurrence.displayPath||t.occurrence.path,e.append(a);let r=t.standIn?Hs[t.standIn]?.label:"";if(r){let s=document.createElement("span");s.textContent=r,e.append(s)}return t.label=e,e})))}function rv(){if(!ca||!he)return;if(ca.hidden=!E.showLabels,!E.showLabels){E.labelsDrawn=null;return}let t=z.getBoundingClientRect(),e=Ao(),a=`${e}|${t.width}x${t.height}|${Array.prototype.join.call(he.matrix,",")}`;if(E.labelsDrawn?.placed===E.placed&&E.labelsDrawn.key===a)return;E.labelsDrawn={placed:E.placed,key:a};let r=t.width/Math.max(1,z.width),s=t.height/Math.max(1,z.height);for(let n of E.placed){if(!n.label)continue;let[i,o,,c,l,f]=n.worldBounds,u=ss(he.matrix,[(i+c)/2,(o+l)/2,f],he.viewport),g=u&&u.x>=0&&u.y>=0&&u.x<=z.width&&u.y<=z.height;n.label.hidden=!g,g&&(n.label.style.transform=`translate(${(u.x*r).toFixed(1)}px, ${(u.y*s).toFixed(1)}px) translate(-50%, -100%)`),n.label.classList.toggle("selected",e===n.occurrence.path)}}var tt={scene:null,key:"",matrix:new Float32Array(16),at:0};function sv(t,e,a){let r=he.matrix,s=!1;for(let u=0;u<16;u+=1)if(r[u]!==tt.matrix[u]){s=!0;break}if(tt.scene!==E.scene&&(tt.scene=E.scene,s=!0),s)return tt.matrix.set(r),tt.key="",tt.at=t,!0;let n=[z.width,z.height,w.showBoard,w.showComponents,w.isolateNet,w.activeNetId,w.selectedFeatureId,w.selectedOccurrence,E.showLabels,E.explode,a,Na(),Ao()];for(let u of E.scene.renderers){let g=e.get(u);n.push(u.version,u.occurrenceCount,u.selectedOccurrence,u.dimCopper,u.standIn?u.boxColor.join(","):"",g?[...g.visibleLayers].join(","):"",g?.layerOffsets?Array.prototype.join.call(g.layerOffsets,","):"")}let i=n.join("|"),o=!!(a||w.activeNetId||w.selectedFeatureId),c=i!==tt.key,l=o&&t-tt.at>=Nh;return c||l||t-tt.at>Rh?(tt.key=i,tt.at=t,!0):!1}function uh(){return{nets:()=>k.scene.nets,quietly(t){qe=!0;try{t()}finally{qe=!1}},takeEcho(t){let e=nu(t,yo);return yo=null,e},selectNet:Po,selectFeature:da,selectComponent:jo,clearSelection:He,anyEmphasis:Oa,showNetProbe:Ro,restoreVisibility:gh,isolating:()=>w.isolateNet,isolateLitNets:Ca,setNetIsolation:Fa,setGpuBudget(t){w.gpuBudgetBytes=t;for(let e of E?E.boards.values():[k])e.tiersCheckedAt=0},setStatsOverlay:Mh,stats:Eh,pickAt(t,e){return Yh(t,e)},getViewState:fh,setLayerVisible:Lh,applyLayerPreset:Dh,setShowBoard:Uh,setShowComponents:zh,setShowPlaceholders:Lv,setRealisticColors:zv,setBoardLayerVisible:Uv,setSeparation:Gh,showNetLayers:Fo}}function nv(){oe.depth?.destroy(),Object.assign(oe,{canvas:null,context:null,depth:null,depthView:null,width:0,height:0}),dn.clear(),un.clear(),Ia=null}function kt(){!nn||po||(po=!0,queueMicrotask(()=>{po=!1,nn?.(fh())}))}function fh(){let t=w.mode==="3d"?k.visible3dLayers:k.desiredCompareLayers;return{mode:w.mode,layers:k.scene.copperLayers.map(e=>({id:Number(e.id),name:String(e.name),color:Mn(En(e)),visible:t.has(Number(e.id))})),boardLayers:Dv(),showBoard:w.showBoard,showComponents:w.showComponents,showPlaceholders:w.showPlaceholders,realisticColors:w.realisticColors,separation:E?E.separation.get(Er())||0:w.separation,isolateNet:w.isolateNet,hasNet:!!w.activeNetId||Oa(),...E?{boards:Pw(),selectedBoard:Er()}:{}}}function kn(t){if(E?.move.enabled&&vn(),qe)return;yo=t;let e=k.renderer&&!k.renderer.identityOnly?k.renderer.occurrenceKeys[w.selectedOccurrence]:null;Sr?.(t&&e!=null?{...t,occurrence:e}:t)}function iv(t){let e=k.renderer?.occurrenceKeys.indexOf(String(t))??-1;e>=0&&(w.selectedOccurrence=e)}function Io(t){if(!t||!k.renderer||k.renderer.identityOnly)return t;let e=k.renderer.occurrenceMatrices[w.selectedOccurrence];return e?xa(e,t):t}function hh(t,e=null){return t?{kind:"net",sourceContext:"3D",netName:String(t.name||""),netUid:String(t.uid||"")||void 0,netCode:Number(t.id||0)||void 0,featureId:Number(e?.id||0)||void 0,uuid:String(e?.sourceUid||"")||void 0}:null}function bh(t,e=k){if(!t)return null;let a=Ba(t),r=String(t.padNumber||t.pin||t.pinNumber||""),s=e.scene.nets.find(n=>Number(n.id)===Number(t.netId||0));if(a&&r)return{kind:"terminal",sourceContext:"3D",reference:a,pin:r,netUid:s?.uid,netName:s?.name,netCode:s?Number(s.id):void 0,uuid:String(t.sourceUid||"")||void 0,featureId:Number(t.id||0)||void 0};if(a){let n=ko(a,e);return{kind:"component",sourceContext:"3D",reference:a,componentUid:n?.uid,uuid:String(t.sourceUid||"")||void 0,featureId:Number(t.id||0)||void 0}}return hh(s,t)}function ph(){w.showBoard=!0,w.showComponents=!0,la(),typeof Le=="function"&&Le()}function Oa(){return Ra().size>0||!!E?.emphasisSets.length}function Ra(){let t=new Set(k.highlightedNetIds);return w.activeNetId&&t.add(Number(w.activeNetId)),t}function Ro(){(w.showBoard||w.showComponents)&&(w.savedShowBoard=w.showBoard,w.savedShowComponents=w.showComponents),w.showBoard=!1,w.showComponents=!1,la(),typeof Le=="function"&&Le()}function gh(){w.showBoard=w.savedShowBoard!==!1,w.showComponents=w.savedShowComponents!==!1,la(),typeof Le=="function"&&Le()}async function mh(t,e,a={}){let r=t.semanticGeometry.assets?.scene_manifest||t.semanticGeometry.semantic_gltf?.path,s=performance.now();if(t.semanticGeometry.analytic){if(!await kw(t,e,a))return!1}else if(r){if(t.scene.manifestUrl=new URL(r,location.href).toString(),t.scene.manifest=await yh(t.scene.manifestUrl,t),a.scene_manifest_fetch_parse_ms=performance.now()-s,!Ne(e))return!1;if(t.scene.manifest.schema!=="prism.semantic_gltf_a0")throw new Error(`Unsupported scene schema: ${t.scene.manifest.schema}`)}else t.scene.manifest={schema:"prism.semantic_gltf_partial.a0",bbox:null,layers:[],nets:[],objectFeatures:[],components:[],tiles:[],barrels:[]},a.scene_manifest_fetch_parse_ms=0;s=performance.now(),t.scene.layers=t.scene.manifest.layers||[],t.scene.copperLayers=t.scene.layers.filter(i=>i.role==="copper"||String(i.name).endsWith(".Cu")),t.scene.nets=t.scene.manifest.nets||[];for(let i of t.scene.manifest.objectFeatures||[])t.scene.features.set(Number(i.id),{...i,bounds:ha(i.boundsMm)});for(let i of t.scene.manifest.components||[])t.scene.componentFeatures.set(i.designator,i),t.scene.features.set(Number(i.featureId),{...i,kind:"component",sourceUid:i.uid,netId:0,bounds:ha(i.boundsMm)});for(let i of t.scene.manifest.tiles||[])t.scene.tiles.set(i.id,i);a.scene_manifest_index_ms=performance.now()-s;let n=vh(t);for(let i of n)t.compareLayers.add(i),t.desiredCompareLayers.add(i);for(let i of t.scene.copperLayers)t.visible3dLayers.add(Number(i.id));return!0}async function ov(t,e={},a=null){let r=performance.now(),s=k.semanticGeometry.analytic?Xt.create(z).then(c=>($t.prewarm(c),c)):null;if(!await mh(k,t,e)){s&&s.then(c=>c?.dispose?.()).catch(()=>{});return}let n=performance.now();if(k.renderer=s?await s:await Xt.create(z),e.webgpu_renderer_create_ms=performance.now()-n,!Ne(t)){k.renderer?.dispose?.(),k.renderer=null;return}k.renderer.setBarrels(hi(k.scene.manifest.barrels,k.scene.manifest.layers)),Ir(),n=performance.now();let i=await Hf(t,k,e);if(e.board_fetch_parse_upload_ms=performance.now()-n,!Ne(t)||(k.scene.runtimeBounds=i||La(k.scene.manifest.bbox),H=new Da(k.scene.runtimeBounds),xr&&(await cv(t),!Ne(t)||(await lv(t),!Ne(t)))))return;n=performance.now(),Bo(),Hh(),xr&&(Yv(),$v()),Kh(),eb(),e.controls_and_bindings_ms=performance.now()-n;let o={"board-ready":"Board ready \xB7 components and semantic layers are still generating","components-ready":"Board and components ready \xB7 semantic layers are still generating","semantic-ready":"WebGPU semantic glTF active"};if(pn.textContent=o[k.viewerReadiness.stage]||"Loading 3D assets",k.semanticGeometry.assets?.components_glb&&!k.deferComponents){let c=performance.now(),l=No(t);k.analytic&&await l.catch(()=>{}),l.then(()=>{Ne(t)&&(Tf(i),a?.({schema:"prism.semantic_viewer_performance.a0",milestone:"components-loaded",readiness_stage:k.viewerReadiness.stage,elapsed_ms:performance.now()-c,bytes_loaded:k.loadedBytes}))})}else Tf(i);wr(t),n=performance.now(),await new Promise(c=>requestAnimationFrame(c)),e.first_frame_wait_ms=performance.now()-n,e.boot_total_ms=performance.now()-r}async function cv(t=je){let e=k.semanticGeometry.assets?.schematic_native_manifest||k.semanticGeometry.schematic_vector?.path||k.semanticGeometry.schematic_scene?.path,a=k.semanticGeometry.assets?.schematic_manifest||k.semanticGeometry.schematic_world?.path,r=ee("[data-workspace=schematic]");if(!e&&!a){r.disabled=!0,r.title="No schematic world assets are available";return}let s=[e,a].filter(Boolean),n=null;for(let o of s)try{U.manifestUrl=new URL(o,location.href).toString();let c=await ws.create(Pe,U.manifestUrl);if(!Ne(t))return;O=c,O.setFlowOverlayCanvas(tn);break}catch(c){if(n=c,O=null,o===a)throw c}if(!O)throw n||new Error("Failed to load schematic viewer assets");U.manifest=O.manifest,U.pages=O.pages,U.byId=new Map(U.pages.map(o=>[o.id,o])),w.selectedPageId=U.pages[0]?.id||"",O.selectedPageId=w.selectedPageId,!["native","legacy","webgpu"].includes(String(U.rendererMode).toLowerCase())&&(te=Es.create(en,U.manifestUrl,U.manifest,O.featuresByPage,{onSelect:Fv,onBlank:_r,onHighlightNet:Fh,onOpenPage:Bv,onFallback:o=>{U.domFallbackReason=o,console.warn(o)}}),te.preloadPages(U.pages)),O.preloadOverview()}async function lv(t=je){let e=k.semanticGeometry.assets?.bom||k.semanticGeometry.bom?.path,a=ee("[data-workspace=bom]");if(!e){a&&(a.disabled=!0,a.title="No BoM artifact is available");return}try{let r=await Lr.create(an,new URL(e,location.href).toString(),{onSelectReference:s=>jo(s,!0)});if(!Ne(t))return;st=r}catch(r){if(!Ne(t))return;console.warn(r),a&&(a.disabled=!0,a.title=r?.message||"BoM artifact could not be loaded")}}async function yh(t,e=k){if(e.assetCache)return e.assetCache.fetchJson(String(t));let a=await fetch(t,{cache:"default"});if(!a.ok)throw new Error(`Failed to load ${t}: ${a.status}`);return a.json()}var dv=24*1024*1024,na={bytes:0,waiting:null};async function uv(t){for(;;){if(na.bytes===0||na.bytes+t<=dv){na.bytes+=t,na.waiting??=new Promise(e=>requestAnimationFrame(()=>{na.bytes=0,na.waiting=null,e()}));return}await na.waiting}}function fv(t){return _d(t.position.length/3,t.indices.length)}function xh(t,e){return t?"all":e?"lit":"none"}function wh(){return w.mode!=="layer"?k.visible3dLayers:Q.phase==="reveal"?bv(Q.previous,Q.target):k.compareLayers}function vh(t=k){let e=t.scene.copperLayers.map(a=>Number(a.id)).filter(Number.isFinite);return e.length?e.length===1?new Set([e[0]]):new Set([e[0],e[e.length-1]]):new Set}function hv(){let t=k.desiredCompareLayers.size?k.desiredCompareLayers:k.compareLayers;return t.size?new Set([...t].map(Number)):vh()}function bv(...t){let e=new Set;for(let a of t)for(let r of a||[])e.add(Number(r));return e}function Qt(t=k){return t.scene.runtimeBounds||La(t.scene.manifest?.bbox)}function kh(t,e){let{back:a}=H.basis();return{eye:Je(H.focus,Ke(a,H.distance)),orthographic:e,pixelScale:e?t/Math.max(1e-9,H.orthoScale):t/2/Math.tan(H.fov/2)}}function Eh(){if(E)return pv();let t=k.renderer?.cullCounts||{full:0,board:0,body:0,box:0,culled:0},e=!k.renderer||k.renderer.identityOnly;return{occurrences:k.renderer?.occurrenceMatrices.length||0,lod:e?{full:1,board:0,body:0,box:0,culled:0}:{...t},triangles:k.renderer?.frameStats.triangles||0,draws:k.renderer?.frameStats.draws||0,gpuMemoryBytes:k.renderer?.gpuMemoryBytes()||0,gpuBreakdown:k.renderer?.gpuMemoryBreakdown()||null,gpuBudgetBytes:w.gpuBudgetBytes,componentTier:k.scene.componentTier,componentEvictions:k.scene.componentEvictions,tileEvictions:k.tileEvictions,visibleTileMisses:k.visibleTileMisses||0,cache:k.assetCache?k.assetCache.summary():{enabled:!1},frameIntervalMs:w.frameIntervalMs,frameIntervalP95Ms:w.frameIntervalP95Ms,frameCpuMs:w.frameCpuMs,frameCpuP95Ms:w.frameCpuP95Ms,fps:w.fps}}function pv(){let t=Ge(),e=t.map(a=>a.scene.componentTier);return{occurrences:E.scene.occurrenceCount||0,lod:E.scene.cullCounts(),triangles:E.scene.frameStats.triangles,draws:E.scene.frameStats.draws,gpuMemoryBytes:E.scene.gpuMemoryBytes(),gpuBreakdown:E.scene.gpuMemoryBreakdown(),gpuBudgetBytes:w.gpuBudgetBytes,componentTier:`${e.filter(a=>a==="loaded").length}/${t.length} loaded`,componentEvictions:t.reduce((a,r)=>a+r.scene.componentEvictions,0),tileEvictions:t.reduce((a,r)=>a+r.tileEvictions,0),visibleTileMisses:t.reduce((a,r)=>a+(r.visibleTileMisses||0),0),cache:t.find(a=>a.assetCache)?.assetCache.summary()||{enabled:!1},frameIntervalMs:w.frameIntervalMs,frameIntervalP95Ms:w.frameIntervalP95Ms,frameCpuMs:w.frameCpuMs,frameCpuP95Ms:w.frameCpuP95Ms,fps:w.fps}}function Mh(t){w.showStats=!!t,mr&&(mr.hidden=!w.showStats),Sh()}function Sh(){if(!mr||!w.showStats)return;let t=Eh(),{full:e,board:a,body:r,box:s,culled:n}=t.lod,i=[["Occurrences",`${t.occurrences} (${e+a+r+s} visible)`],["Detail",`${e} full \xB7 ${a} board \xB7 ${r} body \xB7 ${s} box \xB7 ${n} culled`],["Triangles",t.triangles.toLocaleString()],["Draws",t.draws.toLocaleString()],["GPU memory",`${(t.gpuMemoryBytes/1048576).toFixed(1)} / ${(t.gpuBudgetBytes/1048576).toFixed(0)} MB`],["Components",`${t.componentTier}${t.componentEvictions?` \xB7 ${t.componentEvictions} evicted`:""}`],["Cache",t.cache.enabled?`${t.cache.hits} hits \xB7 ${t.cache.misses} misses \xB7 ${(t.cache.bytes/1048576).toFixed(0)} MB`:"off"],["Frame",`${t.frameIntervalMs.toFixed(1)} ms \xB7 p95 ${t.frameIntervalP95Ms.toFixed(1)}`],["CPU",`${t.frameCpuMs.toFixed(2)} ms \xB7 p95 ${t.frameCpuP95Ms.toFixed(2)}`],["FPS",t.fps.toFixed(0)]];mr.innerHTML=i.map(([o,c])=>`<dt>${o}</dt><dd>${c}</dd>`).join("")}async function No(t=je,e=k){let a=e.semanticGeometry.assets?.components_glb;if(!a||e.scene.componentTier!=="idle")return;e.scene.componentTier="loading";let r;try{r=await gl(new URL(a,location.href).toString(),{componentFeatures:e.scene.componentFeatures,fetchBytes:Th(e),zOffset:Number(e.scene.manifest?.componentsZOffsetMm||0)/1e3})}catch(i){throw Ne(t)&&(e.scene.componentTier="idle"),i}if(!Ne(t)||!e.renderer)return;let s=bc(r.models);if(await uv([...s.instanced.map(i=>i.primitive),...s.baked].reduce((i,o)=>i+fv(o),0)),!Ne(t)||!e.renderer)return;e.scene.componentTier="loaded",e.loadedBytes+=r.byteLength;for(let i of r.models)for(let o of i.placements){let c=e.scene.componentFeatures.get(o.designator);c&&yv(c.featureId,o.bounds,e)}for(let[i,o]of r.componentNodeCounts||[])e.scene.componentModelCounts.set(i,o);e.hiddenComponentRequest&&qh(e.hiddenComponentRequest);let n=i=>({kind:"component",layerId:0,material:i.material,color:i.material.baseColor});e.scene.componentEntries=[...e.renderer.addInstancedPrimitives(s.instanced.map(i=>({primitive:i.primitive,placements:i.placements,metadata:n(i.primitive)}))),...s.baked.map(i=>e.renderer.addPrimitive(i,n(i)))]}function Th(t=k){return t.assetCache?e=>t.assetCache.fetchBytes(e):void 0}function Ah(t,e=k){if(!e.renderer||t-(e.tiersCheckedAt||0)<250)return;e.tiersCheckedAt=t;let a=e.renderer.cullCounts,r=a.board+a.body>0,s=e.renderer.identityOnly&&!e.deferComponents||!e.renderer.identityOnly&&(a.full>0||r);s&&(e.scene.componentsWantedAt=t),s&&e.scene.componentTier==="idle"&&e.semanticGeometry.assets?.components_glb&&No(je,e).catch(i=>console.warn("Failed to load components",i));let n=()=>e.renderer.gpuMemoryBytes();e.gpuBytes=n(),!(e.gpuBytes<=w.gpuBudgetBytes)&&e.scene.componentTier==="loaded"&&t-e.scene.componentsWantedAt>yw&&(e.renderer.removeEntries(e.scene.componentEntries),e.scene.componentEntries=[],e.scene.componentTier="idle",e.scene.componentEvictions+=1,e.gpuBytes=n())}var Mf=4e-4,Sf=5e-5,gv={baseColor:[.62,.7,.8,1],metallic:0,roughness:.8,emissive:[0,0,0]};function Tf(t,e=k){if(!e.renderer)return;let a=new Map;for(let i of e.topology.physical_objects||[])i.kind==="footprint_body"&&i.designator&&i.bbox_mm?.length===4&&a.set(i.designator,i);let r=(t?.[5]??8e-4)+Sf,s=(t?.[2]??-8e-4)-Sf,n=[];for(let i of e.scene.componentFeatures.values()){let o=Number(i.featureId),c=e.scene.features.get(o),l=a.get(i.designator);if(!c||c.bounds||!l)continue;let[f,u,g,p]=l.bbox_mm.map(Number),h=String(l.layer||"").startsWith("B."),d=[f/1e3,-p/1e3,h?s-Mf:r,g/1e3,-u/1e3,h?s:r+Mf];c.bounds=d,c.placeholder=!0,n.push(mv(d,o))}if(n.length)for(let i of Nr(n))e.renderer.addPrimitive(i,{kind:"component",layerId:0,material:i.material,color:i.material.baseColor,opacityScale:.3,translucent:!0,placeholder:!0})}function mv([t,e,a,r,s,n],i){let o=[[[0,0,1],[[t,e,n],[r,e,n],[r,s,n],[t,s,n]]],[[0,0,-1],[[t,s,a],[r,s,a],[r,e,a],[t,e,a]]],[[1,0,0],[[r,e,a],[r,s,a],[r,s,n],[r,e,n]]],[[-1,0,0],[[t,s,a],[t,e,a],[t,e,n],[t,s,n]]],[[0,1,0],[[r,s,a],[t,s,a],[t,s,n],[r,s,n]]],[[0,-1,0],[[t,e,a],[r,e,a],[r,e,n],[t,e,n]]]],c=new Float32Array(72),l=new Float32Array(72),f=new Uint32Array(36);return o.forEach(([u,g],p)=>{g.forEach((d,m)=>{c.set(d,(p*4+m)*3),l.set(u,(p*4+m)*3)});let h=p*4;f.set([h,h+1,h+2,h,h+2,h+3],p*6)}),{position:c,normal:l,netId:new Uint32Array(24),objectFeatureId:new Uint32Array(24).fill(i),indices:f,material:gv,bounds:[t,e,a,r,s,n]}}function yv(t,e,a=k){let r=a.scene.features.get(Number(t));if(!r||!e.length)return;let s=[1/0,1/0,1/0,-1/0,-1/0,-1/0];for(let n=0;n<e.length;n+=3)s[0]=Math.min(s[0],e[n]),s[1]=Math.min(s[1],e[n+1]),s[2]=Math.min(s[2],e[n+2]),s[3]=Math.max(s[3],e[n]),s[4]=Math.max(s[4],e[n+1]),s[5]=Math.max(s[5],e[n+2]);r.bounds=r.bounds?[Math.min(r.bounds[0],s[0]),Math.min(r.bounds[1],s[1]),Math.min(r.bounds[2],s[2]),Math.max(r.bounds[3],s[3]),Math.max(r.bounds[4],s[4]),Math.max(r.bounds[5],s[5])]:s}function En(t,e=k){return Go(t,e.scene.copperLayers)}var xv=[.55,.35,.16,.78];function _h(t=k){return Ko(t.topology?.board?.stackup?.copper_finish)}function wv(t,e=k){return Vo(t,e.scene.copperLayers)}var vv=.25;function Na(t=k){if(!w.realisticColors||w.mode==="layer"||!w.showBoard)return 0;let e=E&&E.boards.get(t.key)===t?th(t):w.separation;return 1-de(e/vv,0,1)}function ln(t,e=k){let a=wv(t,e)?_h(e):ja.copper;return Ih(En(t,e),a,Na(e))}function Ih(t,e,a){return t.map((r,s)=>r+(e[s]-r)*a)}function kv(t,e=je){if(e===je&&E&&H){Sw(t,e);return}if(e!==je||!k.renderer||!H)return;let a=performance.now(),r=Math.max(0,t-Yt);if(w.workspace==="schematic"&&O){Yt=t;let l=O.visiblePages(),f=te?_v(l):[];O.setDomDetailPageIds(f.map(u=>u.id)),U.visiblePages=O.render(),te?.syncWorldPages(f,O,{activeNetUid:U.activeNetUid}),tb(),xo(r,performance.now()-a),wo(t),wr(e);return}let s=Math.min(.05,(t-Yt)/1e3);Yt=t,H.update(s),k.renderer.resize();let n=fn();k.scene.copperRealism!==Na()&&Ir();for(let l of k.renderer.entries)l.layerOffset=n[l.layerId]||0;Iv(t),Jt=Bh(t);let i=Rv(t);he={layerId:0,viewport:{x:0,y:0,width:z.width,height:z.height},matrix:H.matrix(z.width,z.height,w.mode==="layer"),lod:kh(z.height,w.mode==="layer")},k.renderer.selectedOccurrence=w.selectedFeatureId||w.activeNetId?w.selectedOccurrence:-1,k.renderer.setInnerCopperMode(xh(!w.showBoard||w.separation>.001,Ra().size>0));let o=w.mode==="3d"?k.visible3dLayers:wh(),c={panels:[he],activeNetId:w.activeNetId,selectedFeatureId:w.selectedFeatureId,time:t/1e3,layerOffsets:n,visibleLayers:o,showBoard:w.showBoard,showComponents:w.showComponents,showPaste:w.separation===0,componentOpacity:de(1-w.separation/.1,0,1),boardOpacity:Ra().size?.34:1-w.separation*.72,isolateNet:w.isolateNet,compareMode:w.mode==="layer",compareOffsets:Jt,layerAlphas:i,visibleTileIds:w.mode==="3d"?k.visibleTileIds:null};if(Ia=c,Sv(t,c)){k.renderer.render(c),Zh(),Zv();for(let l of un)l()}Ah(t),xo(r,performance.now()-a),wo(t),wr(e)}var Rh=1e3,Nh=1e3/30,at={key:"",matrix:new Float32Array(16),tiles:null,at:0},Ia=null,oe={canvas:null,context:null,depth:null,depthView:null,width:0,height:0},dn=new Ms(3e3),un=new Set,Js={frames:0,cpuMs:0,gpuMs:0,lastTriangles:0},Af={cullTiles:!0};function Ev(t,e){let a=k.renderer;oe.canvas||(oe.canvas=document.createElement("canvas"),oe.context=oe.canvas.getContext("webgpu")),!(oe.width>=t&&oe.height>=e&&oe.depth)&&(oe.width=Math.max(oe.width,t),oe.height=Math.max(oe.height,e),oe.canvas.width=oe.width,oe.canvas.height=oe.height,oe.context.configure({device:a.device,format:a.format,alphaMode:"opaque"}),oe.depth?.destroy(),oe.depth=a.device.createTexture({label:"inset-depth",size:[oe.width,oe.height],format:a.depthFormat,sampleCount:a.sampleCount,usage:GPUTextureUsage.RENDER_ATTACHMENT}),oe.depthView=oe.depth.createView())}function Ch(){return!!(k.renderer&&Ia&&w.workspace==="pcb")}function Mv(t,e,a="inset"){if(!Ch())return!1;let r=t.clientWidth,s=t.clientHeight;if(!r||!s)return!1;let n=performance.now(),i=Math.min(devicePixelRatio||1,2),o=Math.round(r*i),c=Math.round(s*i);Ev(o,c);let l=Et(k.scene.runtimeBounds),f=ji(e,r,s,l,e.focusZ??0);dn.record(a,f,n);let u={layerId:0,viewport:{x:0,y:0,width:o,height:c},matrix:f,lod:Ia.panels[0].lod},g=Ia.visibleTileIds,p=k.renderer.renderInto({colorView:oe.context.getCurrentTexture().createView(),depthView:oe.depthView,width:oe.width,height:oe.height},u,{...Ia,panels:[u],visibleTileIds:g});return t.width!==o&&(t.width=o),t.height!==c&&(t.height=c),t.getContext("2d").drawImage(oe.canvas,0,0,o,c,0,0,o,c),Js.frames+=1,Js.cpuMs+=performance.now()-n,Js.lastTriangles=p.triangles,!0}function Sv(t,e){let a=e.panels[0].matrix,r=!1;for(let c=0;c<16;c+=1)if(a[c]!==at.matrix[c]){r=!0;break}if(r)return at.matrix.set(a),at.key="",at.at=t,!0;let s=[z.width,z.height,k.renderer.version,k.renderer.selectedOccurrence,w.workspace,w.mode,e.activeNetId,e.selectedFeatureId,e.showBoard,e.showComponents,e.showPaste,e.componentOpacity,e.boardOpacity,e.isolateNet,k.scene.layerZOffsetSignature,[...e.visibleLayers].join(","),[...e.compareOffsets].map(([c,l])=>`${c}:${l}`).join(";"),e.layerAlphas?[...e.layerAlphas].join(";"):""].join("|");return!!(e.activeNetId||e.selectedFeatureId||k.renderer.emphasizedNetIds.size)&&t-at.at>=Nh||s!==at.key||!Tv(e.visibleTileIds,at.tiles)||t-at.at>Rh?(at.key=s,at.tiles=e.visibleTileIds,at.at=t,!0):!1}function Tv(t,e){if(!t||!e)return t===e;if(t.size!==e.size)return!1;for(let a of t)if(!e.has(a))return!1;return!0}function Av(t){if(!O||!t)return{widthPx:0,heightPx:0,sourcePxPerMm:0,area:0};let e=O.pagePixelWidth(t),a=t.heightMm/Math.max(1e-6,O.scale),r=O.pageSourcePixelsPerMm(t);return{widthPx:e,heightPx:a,sourcePxPerMm:r,area:e*a}}function _v(t){if(!te||!O)return[];let e=t||[],a=Math.max(1,Pe.clientWidth*Pe.clientHeight);return e.map(n=>({page:n,...Av(n)})).filter(n=>n.widthPx>=760&&n.heightPx>=520&&n.area>=a*.36&&n.sourcePxPerMm>=1.25).sort((n,i)=>i.area-n.area).slice(0,1).map(n=>n.page)}function fn(t=k){let e=Qt(t),a=Math.hypot((e[3]-e[0])*1e3,(e[4]-e[1])*1e3),r=w.separation*w.separation*de(a*.12,8,25)/1e3,s=`${w.separation}:${r}:${t.scene.copperLayers.length}`;if(t.scene.layerZOffsetSignature===s)return t.scene.layerZOffsets;let n=t.scene.layerZOffsets;n.fill(0);let i=(t.scene.copperLayers.length-1)/2;return t.scene.copperLayers.forEach((o,c)=>{n[Number(o.id)]=(i-c)*r}),t.scene.layerZOffsetSignature=s,n}function Bh(t){if(w.mode!=="layer")return Re.key="3d",Re.current.clear(),new Map;let e=k.scene.copperLayers.filter(m=>k.compareLayers.has(Number(m.id))),a=Math.max(1,e.length),r=z.width/Math.max(1,z.height),s=1;a===2?s=r>=1?2:1:a===3||a===4?s=2:a>4&&(s=Math.ceil(Math.sqrt(a*r)));let n=Math.ceil(a/s),i=Qt(),o=i[3]-i[0],c=i[4]-i[1],l=o*1.18,f=c*1.22,u=e.map((m,b)=>{let y=b%s,x=Math.floor(b/s);return{layer:m,layerId:Number(m.id),column:y,row:x,offset:[(y-(s-1)/2)*l,((n-1)/2-x)*f,0]}}),g=`${s}x${n}:${u.map(m=>m.layerId).join(",")}`;if(g!==Re.key){Re.key=g,Re.started=t,Re.from=new Map(Re.current);let m=s*o+(s-1)*(l-o),b=n*c+(n-1)*(f-c);H.targetFocus=[(i[0]+i[3])/2,(i[1]+i[4])/2,(i[2]+i[5])/2],H.targetOrthoScale=Math.max(b,m/r)*1.08}let p=de((t-Re.started)/420,0,1),h=1-Math.pow(1-p,3),d=new Map;for(let m of u){let b=Re.from.get(m.layerId)||[0,0,0],y=m.offset.map((x,v)=>b[v]+(x-b[v])*h);d.set(m.layerId,y),Re.current.set(m.layerId,y)}if(Q.phase==="reveal")for(let m of Q.previous)d.has(Number(m))||d.set(Number(m),Q.previousOffsets.get(Number(m))||[0,0,0]);for(let m of[...Re.current.keys()])u.some(b=>b.layerId===m)||Re.current.delete(m);return d}function Ar(t){let e=new Set([...t].map(Number));if(!(_f(e,k.desiredCompareLayers)&&Q.phase!=="idle")){if(k.desiredCompareLayers=e,_f(e,k.compareLayers)){Q.phase="idle",Q.previous.clear(),Q.target.clear();return}Q.phase="preload",Q.previous=new Set(k.compareLayers),Q.target=new Set(e),Q.previousOffsets=new Map(Re.current),Q.started=performance.now()}}function Co({snap:t=!0}={}){w.mode="layer";let e=hv();k.desiredCompareLayers=new Set(e),!k.compareLayers.size&&e.size&&(k.compareLayers=new Set(e)),Q.phase="idle",Q.previous.clear(),Q.target.clear(),Re.key="",H.setAxis("z",!1),k.renderer?.resize(),Jt=Bh(performance.now()),t&&H.snap()}function Iv(t){if(!(w.mode!=="layer"||Q.phase==="idle")){if(Q.phase==="preload"){Q.phase="reveal",Q.started=t,Q.previousOffsets=new Map(Re.current),k.compareLayers=new Set(Q.target),Re.key="";return}Q.phase==="reveal"&&t-Q.started>=Of&&(k.compareLayers=new Set(Q.target),Q.phase="idle",Q.previous.clear(),Q.target.clear(),Q.previousOffsets.clear())}}function Rv(t){if(w.mode!=="layer"||Q.phase!=="reveal")return null;let e=de((t-Q.started)/Of,0,1),a=e*e*(3-2*e),r=new Map;for(let s of Q.previous)r.set(Number(s),Q.target.has(Number(s))?1:1-a);for(let s of Q.target)r.set(Number(s),Q.previous.has(Number(s))?1:a);return r}function _f(t,e){if(t.size!==e.size)return!1;for(let a of t)if(!e.has(a))return!1;return!0}function Bo(){if(w.workspace==="schematic"){Cv();return}if(w.workspace==="bom"){Nv();return}if(w.workspace==="stackup")return;gn.textContent=k.viewerReadiness.stage==="semantic-ready"?"Semantic GLTF A0":"Prism staged 3D",mn.textContent="Layers",yn.textContent="Visibility and compare",ee('[data-panel="search"] .section-heading span').textContent="Nets, components and pins",ee('[data-panel="view"] .section-heading span').textContent="Camera and stackup";let t=`
    <div class="mode-toolbar">
      <button data-mode="layer">PCB</button>
      <button data-mode="3d">3D</button>
    </div>`;_a&&(_a.innerHTML=t),rt.innerHTML=`
    ${_a?"":t}
    <div class="layer-presets">
      <button data-preset="all">All</button><button data-preset="none">None</button>
      <button data-preset="outer">Outer</button><button data-preset="inner">Inner</button>
    </div>
    <div class="layer-list"></div>`,Me.innerHTML=`
    <label class="control-field"><span>Search</span>
      <input id="entity-search" class="layer-select" type="search" placeholder="Net, component or pin">
      <div id="search-results" class="search-results"></div>
    </label>
    <div class="quick-actions">
      <button id="frame-selection">Frame</button>
      <button id="show-net-layers">Net layers</button>
      <button id="isolate-net" aria-keyshortcuts="I" title="Toggle isolated net view (I)">Isolate</button>
      <button id="clear-selection">Clear</button>
    </div>`,ze.innerHTML=`
    <div class="toggle-list">
      <label class="toggle-row"><input id="show-board" type="checkbox"><span>Board substrate</span></label>
      <label class="toggle-row"><input id="show-components" type="checkbox"><span>Components</span></label>
    </div>
    <label class="control-field range-field"><span>Stackup separation</span>
      <input id="separation" type="range" min="0" max="1" step="0.002">
    </label>`,Le(),Gv()}function Nv(){gn.textContent="BoM A0",mn.textContent="Bill of Materials",yn.textContent="Grouped procurement view",ee('[data-panel="search"] .section-heading span').textContent="Search inside the BoM table",ee('[data-panel="view"] .section-heading span').textContent="BoM actions";let t=st?.payload?.counts||{};rt.innerHTML=`
    <div class="selection-properties">
      <div class="selection-property"><small>Rows</small><strong>${t.rows||0}</strong></div>
      <div class="selection-property"><small>Components</small><strong>${t.components||0}</strong></div>
      <div class="selection-property"><small>DNP</small><strong>${t.dnpComponents||0}</strong></div>
    </div>
    <div class="selection-section">
      <span class="selection-section-title">Columns</span>
      <div class="selection-empty">Primary procurement and thermal columns are shown first. Additional symbol and footprint metadata is available in the row detail panel.</div>
    </div>`,Me.innerHTML=`
    <div class="selection-empty">Use the BoM search box in the main view. Reference chips update the shared PCB and schematic selection without changing workspaces.</div>
    <div class="quick-actions">
      <button id="clear-selection">Clear</button>
    </div>`,ze.innerHTML=`
    <div class="selection-section">
      <span class="selection-section-title">Cross-probing</span>
      <div class="selection-table">
        <div class="selection-row"><span><strong>PCB/Schematic</strong></span><span>Select component</span><span>Highlights matching BoM row</span></div>
        <div class="selection-row"><span><strong>BoM reference</strong></span><span>Click chip</span><span>Holds component selection for PCB and schematic</span></div>
      </div>
    </div>`,Me.querySelector("#clear-selection")?.addEventListener("click",He)}function Cv(){gn.textContent=te?"Schematic SVG DOM":U.manifest?.schema==="prism.schematic_vector_a0"?"Schematic Vector A0":"Schematic World A0",mn.textContent="Pages",yn.textContent=`${U.pages.length} hierarchy instances`,ee('[data-panel="search"] .section-heading span').textContent="Pages, nets and components",ee('[data-panel="view"] .section-heading span').textContent="World navigation",rt.innerHTML=`
    <div class="layer-presets">
      <button data-page-action="world">Fit world</button>
      <button data-page-action="parent">Parent</button>
      <button data-page-action="previous">Previous</button>
      <button data-page-action="next">Next</button>
    </div>
    <div class="page-list">${U.pages.map(t=>`
      <button class="page-row ${t.id===w.selectedPageId?"active":""}" data-page="${t.id}">
        <span>${t.sheetNumber}</span>
        <strong>${V(t.name)}</strong>
        <small>L${t.depth}</small>
      </button>`).join("")}</div>`,Me.innerHTML=`
    <label class="control-field"><span>Search</span>
      <input id="entity-search" class="layer-select" type="search" placeholder="Page, net or component">
      <div id="search-results" class="search-results"></div>
    </label>
    <div class="quick-actions">
      <button id="frame-selection">Frame</button>
      <button id="clear-selection">Clear</button>
    </div>`,ze.innerHTML=`
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
    </div>`,rt.querySelectorAll("[data-page]").forEach(t=>{t.addEventListener("click",()=>vt(t.dataset.page,!0))}),rt.querySelectorAll("[data-page-action]").forEach(t=>{t.addEventListener("click",()=>Qs(t.dataset.pageAction))}),Me.querySelector("#entity-search").addEventListener("input",t=>{Ov(t.target.value)}),Me.querySelector("#frame-selection").addEventListener("click",Ph),Me.querySelector("#clear-selection").addEventListener("click",_r),ze.querySelector("#show-hierarchy").checked=O?.showHierarchy??!0,ze.querySelector("#show-hierarchy").addEventListener("change",t=>{O.showHierarchy=t.target.checked})}function vt(t,e){let a=U.byId.get(t);!a||!O||(w.selectedPageId=a.id,w.selectedSchematicFeature=null,O.selectedPageId=a.id,O.selectedFeatureId=0,ft.textContent=JSON.stringify(a,null,2),e&&O.framePage(a),rt.querySelectorAll("[data-page]").forEach(r=>{r.classList.toggle("active",r.dataset.page===a.id)}))}function Qs(t){if(!O)return;if(t==="world"){O.frameWorld();return}let e=Math.max(0,U.pages.findIndex(r=>r.id===w.selectedPageId)),a=null;t==="previous"?a=U.pages[(e-1+U.pages.length)%U.pages.length]:t==="next"?a=U.pages[(e+1)%U.pages.length]:t==="parent"&&(a=U.byId.get(U.pages[e]?.parentId)),a&&vt(a.id,!0)}function Bv(t){if(!t||!O)return;if(_r(),t.kind==="page"&&t.pageId){vt(t.pageId,!0);return}if(t.kind!=="sheet")return;let e=U.pages.find(n=>n.sheetInstancePath===t.sheetInstancePath)||U.byId.get(w.selectedPageId),a=String(t.sheetFile||t.feature?.sheet_file||"").replace(/\\/g,"/"),r=String(t.sheetName||t.feature?.sheet_name||t.feature?.objectId||""),s=U.pages.find(n=>{if(e&&n.parentId&&n.parentId!==e.id)return!1;let i=String(n.sourcePath||"").replace(/\\/g,"/");return a&&i.endsWith(a)||r&&n.name===r})||U.pages.find(n=>{let i=String(n.sourcePath||"").replace(/\\/g,"/");return a&&i.endsWith(a)||r&&n.name===r});s&&vt(s.id,!0)}function Ov(t){let e=Me.querySelector("#search-results"),a=t.trim().toLowerCase();if(!a){e.innerHTML="";return}let r=U.pages.filter(n=>`${n.name} ${n.sheetPath}`.toLowerCase().includes(a)).slice(0,8),s=k.scene.nets.filter(n=>String(n.name).toLowerCase().includes(a)).slice(0,8);e.innerHTML=[...r.map(n=>`<button data-page="${n.id}"><b>${V(n.name)}</b><span>Page ${n.sheetNumber}</span></button>`),...s.map(n=>`<button data-schematic-net="${n.id}"><b>${V(n.name)}</b><span>${(U.manifest.netToPages?.[n.uid]||[]).length} pages</span></button>`)].join(""),e.querySelectorAll("[data-page]").forEach(n=>{n.addEventListener("click",()=>vt(n.dataset.page,!0))}),e.querySelectorAll("[data-schematic-net]").forEach(n=>{n.addEventListener("click",()=>Oh(Number(n.dataset.schematicNet),!0))})}function Oh(t,e){let a=k.scene.nets.find(s=>Number(s.id)===t);if(!a||!O)return;w.activeNetId=t,w.selectedFeatureId=0,w.selectedSchematicFeature=null,O.selectedFeatureId=0,O.selectedFeatureKey="",O.selectedSourceId="",U.activeNetUid=a.uid,O.activeNetUid=a.uid,te?.setHighlightedNet(a.uid),ft.textContent=JSON.stringify(a,null,2),$e();let r=U.manifest.netToPages?.[a.uid]||[];e&&r.length&&vt(r[0],!0)}function Fh(t,e=null){let a=k.scene.nets.find(r=>r.uid===t);a&&(w.activeNetId=Number(a.id),U.activeNetUid=a.uid,O&&(O.activeNetUid=a.uid,O.selectedFeatureId=Number(e?.feature?.id||e?.featureId||0),O.selectedFeatureKey=e?.feature?.stableKey||e?.featureKey||"",O.selectedSourceId=e?.feature?.sourceId||e?.sourceId||""),te?.setHighlightedNet(a.uid),e&&(w.selectedSchematicFeature={...e,pageId:w.selectedPageId}),ft.textContent=JSON.stringify(e?{...e,net:a}:a,null,2),$e())}function _r(){w.activeNetId=0,w.selectedFeatureId=0,w.selectedSchematicFeature=null,U.activeNetUid="",O&&(O.activeNetUid="",O.selectedFeatureId=0,O.selectedFeatureKey="",O.selectedSourceId=""),te?.setSelection(null),te?.setHighlightedNet(""),ft.textContent="No object selected",$e()}function Ph(){let t=U.byId.get(w.selectedPageId);t?O.framePage(t):O.frameWorld()}function Fv(t){w.selectedPageId=t.sheetInstancePath&&U.pages.find(r=>r.sheetInstancePath===t.sheetInstancePath)?.id||w.selectedPageId,w.selectedFeatureId=0,w.selectedSchematicFeature={...t,pageId:w.selectedPageId},t.anchor&&(w.selectionAnchor=t.anchor),O&&(O.selectedPageId=w.selectedPageId,O.selectedFeatureId=Number(t.feature?.id||0));let e=t.netUid?k.scene.nets.find(r=>r.uid===t.netUid):null,a=t.reference?k.scene.componentFeatures.get(t.reference):null;a&&(w.selectedFeatureId=Number(a.featureId||0),st?.setSelectionByReference(t.reference,{scroll:w.workspace==="bom"})),ft.textContent=JSON.stringify({...t,net:e,component:a},null,2),$e()}function Pv(t){let{page:e,feature:a}=t;if(!a){w.selectedSchematicFeature=null,O.selectedFeatureId=0,vt(e.id,!1),$e();return}let r=Number(a.id||0);if(w.selectedPageId=e.id,O.selectedPageId=e.id,O.selectedFeatureId=r,w.selectedSchematicFeature={...a,pageId:e.id},w.selectionAnchor=null,a.netUid){let s=k.scene.nets.find(n=>n.uid===a.netUid);if(s){Oh(Number(s.id),!1),w.selectedSchematicFeature={...a,pageId:e.id},O.selectedFeatureId=r;return}}if(a.reference){let s=k.scene.componentFeatures.get(a.reference);if(s){da(Number(s.featureId),!1),w.selectedSchematicFeature={...a,pageId:e.id},O.selectedFeatureId=r;return}}w.activeNetId=0,w.selectedFeatureId=0,O.activeNetUid="",ft.textContent=JSON.stringify({page:e.name,...a},null,2),$e()}function la(){let t=w.isolateNet,e=Me?.querySelector?.("#isolate-net");e?.classList.toggle("active",t),e?.setAttribute("aria-pressed",String(t));let a=re?.querySelector?.("[data-action=isolate]");a?.classList.toggle("active",t),a?.setAttribute("aria-pressed",String(t));let r=ze?.querySelector?.("#show-board");r&&(r.checked=w.showBoard);let s=ze?.querySelector?.("#show-components");s&&(s.checked=w.showComponents),kt()}function jv(){let t=new Set;for(let e of Ra())for(let a of Oo(e))t.add(a);return t}function Oo(t,e=k){let a=new Set,r=e.scene.nets.find(n=>Number(n.id)===Number(t)),s=new Set(e.scene.copperLayers.map(n=>Number(n.id)));for(let n of Object.keys(r?.layerBoundsMm||{})){let i=Number(n);s.has(i)&&a.add(i)}if(!a.size){let n=new Map(e.scene.copperLayers.map(i=>[i.name,Number(i.id)]));for(let i of r?.metrics?.layers||[]){let o=n.get(i);o!=null&&a.add(o)}}return a}function Ca(){if(E){for(let e of Ge())wn(e);return}let t=jv();t.size&&(k.visible3dLayers=new Set(t),w.mode==="layer"?Ar(t):(k.compareLayers=new Set(t),k.desiredCompareLayers=new Set(t)))}function Fa(t){let e=!!(t&&Oa()),a=w.isolateNet;if(e&&!w.isolateNet&&!E&&(k.preIsolation3dLayers=new Set(k.visible3dLayers),k.preIsolationCompareLayers=new Set(k.desiredCompareLayers.size?k.desiredCompareLayers:k.compareLayers)),w.isolateNet=e,E)Ca();else if(w.isolateNet)Ca();else if(k.preIsolation3dLayers||k.preIsolationCompareLayers){if(k.preIsolation3dLayers&&(k.visible3dLayers=new Set(k.preIsolation3dLayers)),k.preIsolationCompareLayers){let r=new Set(k.preIsolationCompareLayers);w.mode==="layer"?Ar(r):(k.compareLayers=r,k.desiredCompareLayers=new Set(r))}k.preIsolation3dLayers=null,k.preIsolationCompareLayers=null}e&&!a?(w.preIsolationShowBoard=w.showBoard,w.showBoard=!1):!e&&a&&(typeof w.preIsolationShowBoard=="boolean"&&(w.showBoard=w.preIsolationShowBoard),w.preIsolationShowBoard=null),la(),Le()}function Le(){(_a||rt).querySelectorAll("[data-mode]").forEach(a=>{let r=a.dataset.mode===w.mode;a.classList.toggle("active",r),a.setAttribute("aria-pressed",String(r))}),ze.querySelector("#show-board").checked=w.showBoard,ze.querySelector("#show-components").checked=w.showComponents,ze.querySelector("#separation").value=w.separation;let t=rt.querySelector(".layer-list"),e=w.mode==="3d"?k.visible3dLayers:k.desiredCompareLayers;t.innerHTML=k.scene.copperLayers.map((a,r)=>`
    <label class="layer-row">
      <input type="checkbox" data-layer="${a.id}" ${e.has(Number(a.id))?"checked":""}>
      <span class="swatch" style="background:${Mn(En(a))}"></span>
      <span>${V(a.name)}</span><small>${r+1}</small>
    </label>`).join(""),t.querySelectorAll("[data-layer]").forEach(a=>a.addEventListener("change",()=>{Lh(Number(a.dataset.layer),a.checked)})),la()}function jh(t){t==="layer"?Co():(w.mode="3d",H.frame(Qt()),H.snap(),k.visibleTileIds=new Set),Le()}function Lh(t,e,a=null){if(E){let r=Number(t);Mo(a==null?null:[a],s=>e?s.delete(r):s.add(r));return}if(w.mode==="3d")e?k.visible3dLayers.add(t):k.visible3dLayers.delete(t);else{let r=new Set(k.desiredCompareLayers);e?r.add(t):r.delete(t),Ar(r)}Le()}function Dh(t,e=null){if(E){Mo(e==null?null:[e],(r,s)=>{let n=s?.scene.copperLayers||[];r.clear(),n.forEach((i,o)=>{t==="all"||t==="outer"&&(o===0||o===n.length-1)||t==="inner"&&o>0&&o<n.length-1||r.add(Number(i.id))})});return}let a=w.mode==="3d"?k.visible3dLayers:new Set;a.clear();for(let[r,s]of k.scene.copperLayers.entries())(t==="all"||t==="outer"&&(r===0||r===k.scene.copperLayers.length-1)||t==="inner"&&r>0&&r<k.scene.copperLayers.length-1)&&a.add(Number(s.id));w.mode!=="3d"&&Ar(a),Le()}function Uh(t){w.showBoard=!!t,w.savedShowBoard=w.showBoard,w.showBoard&&w.isolateNet?Fa(!1):la()}function zh(t){w.showComponents=!!t,w.savedShowComponents=w.showComponents,la()}function Lv(t){w.showPlaceholders=!!t;for(let e of E?Ge():[k])e.renderer?.setPlaceholdersVisible(w.showPlaceholders);kt()}function Dv(){let t=new Set((k.scene?.layers||[]).map(r=>String(r.name))),e=new Set(w.hiddenBoardLayers),a=r=>{let s=(k.renderer?.entries||[]).find(i=>i.kind==="board"&&i.boardRole===r),n=s?.color||s?.material?.baseColor;return n?Mn(n):gw[r]};return pw.filter(r=>!t.size||t.has(r.name)).map(r=>({...r,color:a(r.role),visible:!e.has(`${r.role}:${r.side}`)}))}function Uv(t,e,a){let r=`${t}:${e}`,s=new Set(w.hiddenBoardLayers);a?s.delete(r):s.add(r),w.hiddenBoardLayers=[...s];for(let n of E?Ge():[k])n.renderer?.setHiddenBoardLayers(w.hiddenBoardLayers);kt()}function zv(t){w.realisticColors=!!t;for(let e of E?Ge():[k])Ir(e);kt()}function Ir(t=k){if(!t.renderer)return;let e=new Map(t.scene.layers.map(a=>[Number(a.id),a]));for(let a of t.renderer.entries)a.kind==="copper"&&(a.color=ln(e.get(Number(a.layerId)),t));t.renderer.copperColors=new Map([...e].map(([a,r])=>[a,ln(r,t)])),t.renderer.invalidate?.(),t.renderer.setBarrelColor(Ih(xv,[..._h(t).slice(0,3),.78],Na(t))),t.scene.copperRealism=Na(t)}function Gh(t,e=null){if(E){Bw(de(Number(t)||0,0,1),e);return}w.separation=de(Number(t)||0,0,1),kt()}function Gv(){(_a||rt).querySelectorAll("[data-mode]").forEach(e=>e.addEventListener("click",()=>{jh(e.dataset.mode)})),rt.querySelectorAll("[data-preset]").forEach(e=>e.addEventListener("click",()=>{Dh(e.dataset.preset)})),ze.querySelector("#show-board").addEventListener("change",e=>{Uh(e.target.checked)}),ze.querySelector("#show-components").addEventListener("change",e=>{zh(e.target.checked)}),ze.querySelector("#separation").addEventListener("input",e=>{Gh(e.target.value)}),Me.querySelector("#clear-selection").addEventListener("click",He),Me.querySelector("#isolate-net").addEventListener("click",()=>{Fa(!w.isolateNet)}),Me.querySelector("#frame-selection").addEventListener("click",Uo),Me.querySelector("#show-net-layers").addEventListener("click",Fo);let t=Me.querySelector("#entity-search");t.addEventListener("input",()=>Vh(t.value))}function Kh(){oa(".rail-tab").forEach(t=>t.addEventListener("click",()=>{let e=t.dataset.tab,a=w.activeTab===e&&!wt.classList.contains("panel-collapsed");w.activeTab=e,wt.classList.toggle("panel-collapsed",a),oa(".rail-tab").forEach(r=>{r.classList.toggle("active",!a&&r.dataset.tab===e)}),oa(".tab-panel").forEach(r=>{r.classList.toggle("active",!a&&r.dataset.panel===e)})}))}function Fo(){if(E){Rw();return}let t=k.scene.nets.find(r=>Number(r.id)===w.activeNetId);if(!t)return;let e=new Set(t.metrics?.layers||[]),a=w.mode==="3d"?k.visible3dLayers:new Set;a.clear();for(let r of k.scene.copperLayers)e.has(r.name)&&a.add(Number(r.id));w.mode!=="3d"&&Ar(a),Le()}function Vh(t){let e=Me.querySelector("#search-results"),a=t.trim().toLowerCase();if(!a){e.innerHTML="";return}let r=k.scene.nets.filter(n=>String(n.name).toLowerCase().includes(a)).slice(0,8),s=[...k.scene.componentFeatures.values()].filter(n=>!k.hiddenComponents.has(String(n.designator||""))&&`${n.designator} ${n.value} ${n.footprint}`.toLowerCase().includes(a)).slice(0,6);e.innerHTML=[...r.map(n=>`<button data-net="${n.id}"><b>${V(n.name)}</b><span>${V(n.netClass||"")}</span></button>`),...s.map(n=>`<button data-feature="${n.featureId}"><b>${V(n.designator)}</b><span>${V(n.value)}</span></button>`)].join(""),e.querySelectorAll("[data-net]").forEach(n=>{n.addEventListener("click",()=>Po(Number(n.dataset.net),!0))}),e.querySelectorAll("[data-feature]").forEach(n=>{n.addEventListener("click",()=>da(Number(n.dataset.feature),!0))})}function Po(t,e){e&&(w.selectionAnchor=null),w.activeNetId=t,w.selectedFeatureId=0;let a=k.scene.nets.find(r=>Number(r.id)===t);w.workspace==="schematic"&&a&&O&&(U.activeNetUid=a.uid,O.activeNetUid=a.uid),Ro(),ft.textContent=JSON.stringify(a||{},null,2),$e(),w.isolateNet&&Ca(),e&&a?.boundsMm&&H.frame(Lo(Io(ha(a.boundsMm)))),kn(hh(a))}function da(t,e=!1){let a=k.scene.features.get(t);if(a?.kind==="component"&&Dr(Ba(a),k.hiddenComponents))return;e&&(w.selectionAnchor=null),w.selectedFeatureId=t,w.activeNetId=Number(a?.netId||0);let r=Ba(a);r&&st?.setSelectionByReference(r,{scroll:w.workspace==="bom"});let s=bh(a);s?.kind==="net"||s?.kind==="terminal"&&w.activeNetId?Ro():ph(),ft.textContent=a?JSON.stringify(a,null,2):"No object selected",$e(),w.isolateNet&&w.activeNetId&&Ca(),e&&a?.bounds&&Do(a),kn(s)}function jo(t,e=!1){if(Dr(t,k.hiddenComponents))return;let a=k.scene.componentFeatures.get(t);if(st?.setSelectionByReference(t,{scroll:w.workspace==="bom"}),!a?.featureId)return;ph(),da(Number(a.featureId),!1);let r=Vv(t);if(r){let{page:s,feature:n}=r;w.selectedPageId=s.id,w.selectedSchematicFeature={...n,pageId:s.id},O&&(O.selectedPageId=s.id,O.selectedFeatureId=Number(n.id||0)),te?.setSelection?.({kind:"component",featureKey:n.stableKey||"",sheetInstancePath:n.sheetInstancePath||s.sheetInstancePath||"",sourceId:n.sourceId||n.uuid||"",reference:t,feature:n,pageId:s.id}),e&&w.workspace==="schematic"&&(vt(s.id,!0),te?.frameSelection?.())}if(e&&w.workspace==="pcb"){let s=k.scene.features.get(Number(a.featureId));s?.bounds&&Do(s,!0)}$e()}function Ba(t){return t?.designator||t?.reference||t?.componentDesignator||""}function Kv(t=k){return sc(t.scene.manifest?.components||[],t.scene.componentModelCounts)}function qh(t){k.hiddenComponentRequest=t;let e=nc(t,Kv());k.hiddenComponents=e.hiddenReferences,k.renderer?.setHiddenFeatureIds(e.hiddenFeatureIds),e.ambiguous.length&&console.warn(`[prism-semantic-viewer] keeping ambiguous components visible: ${e.ambiguous.join(", ")}`),e.unknown.length&&console.warn(`[prism-semantic-viewer] ignoring unknown components: ${e.unknown.join(", ")}`);let a=Ba(k.scene.features.get(w.selectedFeatureId));Dr(a,k.hiddenComponents)&&He();let r=Me.querySelector("input");return r?.value&&Vh(r.value),e}function Lo(t,e=[...Jt.keys()]){if(w.mode!=="layer"||!t)return t;let a=[];for(let r of e){let s=Jt.get(Number(r));s&&a.push([t[0]+s[0],t[1]+s[1],0,t[3]+s[0],t[4]+s[1],0])}return a.length?ba(a):t}function Do(t,e=!1){if(!t?.bounds)return;let a=Io(t.bounds),r=e||t.kind==="component"||!!Ba(t);if(w.mode==="layer"){let s=k.scene.copperLayers,n=(a[2]+a[5])*.5<0?s[s.length-1]:s[0];H.frame(Lo(a,r&&n?[Number(n.id)]:void 0));return}if(r){let n=(a[2]+a[5])*.5<0,i=H.isBelow();n!==i&&H.setAxis("z",n)}H.frame(a)}function Vv(t){if(!t||!O?.featuresByPage)return null;let e=U.byId.get(w.selectedPageId),a=[...e?[e]:[],...(U.pages||[]).filter(s=>s.id!==e?.id)],r=s=>{let n=String(s.kind||"").toLowerCase();return n==="component"||n==="symbol_body"||n==="symbol_instance"?0:n==="symbol_reference"?1:n.startsWith("pin")?2:3};for(let s of a){let n=(O.featuresByPage[s.id]||[]).filter(i=>String(i.reference||i.designator||i.componentDesignator||"")===t).sort((i,o)=>r(i)-r(o));if(n.length)return{page:s,feature:n[0]}}return null}function He(){w.activeNetId=0,w.selectedFeatureId=0,w.selectedSchematicFeature=null,w.selectionAnchor=null;let t=Oa(),e=w.isolateNet;e&&!t?Fa(!1):t?e&&Ca():w.isolateNet=!1,t||gh(),U.activeNetUid="",O&&(O.activeNetUid=""),te?.setSelection(null),te?.setHighlightedNet(""),ft.textContent="No object selected",st?.clearSelection?.(),$e(),kn(null)}function Zs(t){return`<div class="selection-properties">${t.map(([e,a])=>`
    <div class="selection-property">
      <small>${V(e)}</small>
      <strong title="${V(String(a))}">${V(String(a))}</strong>
    </div>`).join("")}</div>`}function hn(t,e,a){return`
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
      <div class="selection-card-title"><small>${V(t)}</small><strong>${V(e)}</strong></div>
      <button class="selection-card-close" type="button" aria-label="Clear selection">&times;</button>
    </div>`}function qv(t){let a=(k.topology.net_details?.[t.uid]||{}).terminals||[],r=t.metrics||{},s=Number(r.traceLengthMm||0).toFixed(2),n=r.objectCounts?.via||0,i=a.length,c=/^(VCC|VDD|GND|3V3|5V|12V|VIN|POWER)/i.test(t.name)?"#10b981":"#8b5cf6",l=t.netClass||"Default",f=a.length?a.map(u=>`
      <div class="selection-row pin-row-interactive" data-ref="${V(u.designator)}" data-pin="${V(u.pin)}">
        <span class="refdes-col"><strong>${V(u.designator)}</strong></span>
        <span class="pin-col">Pin ${V(u.pin)}</span>
        <span class="val-col" title="${V(u.value||"")}">${V(u.value||"-")}</span>
      </div>`).join(""):'<div class="selection-empty">No connected pin metadata is available.</div>';return`
    ${hn("Net",t.name,c)}
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
          <strong title="${V(l)}">${V(l)}</strong>
        </div>
      </div>
      
      <div class="selection-section">
        <span class="selection-section-title">Layers</span>
        <div class="net-layers-badges">
          ${(r.layers||[]).length?r.layers.map(u=>`<span class="layer-badge">${V(u)}</span>`).join(""):'<span class="layer-badge unknown">None</span>'}
        </div>
      </div>

      <div class="selection-section">
        <span class="selection-section-title">Connected Pins</span>
        <div class="selection-table compact-scroll" style="max-height: 120px;">
          ${f}
        </div>
      </div>
    </div>`}function Hv(t,e=null){let a=ko(t.designator),r=a?a.value:t.value||"Not specified",s=a?a.footprint:t.footprint||"Not specified",n=a?.parameters||{},i=n.Manufacturer||n.Mfr||"",o=n["Manufacturer Part Number"]||n.MPN||n["Part Number"]||"",c=n.kicad_dnp==="true"||n.DNP==="true"||n.kicad_in_bom==="false",l="";(i||o)&&(l=`
      <div class="selection-section">
        <span class="selection-section-title">Component details</span>
        <div class="selection-table">
          <div class="selection-row">
            <span><strong>Manufacturer</strong></span>
            <span title="${V(i)}">${V(i||"-")}</span>
          </div>
          <div class="selection-row">
            <span><strong>Part Number</strong></span>
            <span title="${V(o)}">${V(o||"-")}</span>
          </div>
        </div>
      </div>`);let f="";return e&&(f=`
      <div class="selection-section">
        <span class="selection-section-title">Selected Pin</span>
        <div class="selection-table">
          <div class="selection-row">
            <span><strong>Pin</strong></span>
            <span>Pin ${V(e.pinNumber||e.pin||"")}</span>
            <span title="${V(e.pinName||"")}">${V(e.pinName||"No name")}</span>
          </div>
          <div class="selection-row">
            <span><strong>Net</strong></span>
            <span class="net-ref-interactive" data-net-name="${V(e.netName||"")}">${V(e.netName||"Not connected")}</span>
          </div>
        </div>
      </div>`),`
    ${hn("Component",t.designator||"Unknown","#3b82f6")}
    <div class="selection-component-dashboard">
      ${c?'<div class="dnp-banner" style="background:#b45309;color:#fff;font-size:9px;font-weight:750;text-align:center;padding:3px;margin-bottom:8px;border-radius:2px;text-transform:uppercase;letter-spacing:0.05em;">DNP (Do Not Populate)</div>':""}
      ${Zs([["Value",r],["Footprint",s.split(":").pop()||s]])}
      ${l}
      ${f}
    </div>`}function Wv(t,e){let a=String(t.kind||"").toLowerCase(),r=a.startsWith("pin");if(a==="component"||a.includes("symbol"))return`
      ${hn("Component",t.reference||t.componentDesignator||"Unknown","#3b82f6")}
      ${Zs([["Value",t.value||t.componentValue||"Not specified"],["Footprint",t.componentFootprint||t.footprint||"Not specified"],["Library",t.libraryRef||"Not specified"],["UID",t.componentUid||t.uuid||t.sourceId||"Not resolved"]])}
      <div class="selection-section">
        <span class="selection-section-title">Schematic placement</span>
        ${Zs([["Page",e?.name||"Unknown"],["Sheet",t.sheetInstancePath||"/"]])}
      </div>`;let n=r?[["Symbol",t.reference||t.designator||"Unknown"],["Value",t.value||t.componentValue||"Not specified"],["Pin",`${t.pinNumber||"-"}${t.pinName?` ${t.pinName}`:""}`],["Net",t.netName||"Not connected"],["PCB Pad",t.pcbPadId||"Not resolved"],["Component UID",t.componentUid||"Not resolved"]]:[["Page",e?.name||"Unknown"],["Kind",t.kind.replaceAll("_"," ")],["Net",t.netName||"Not connected"]];return`
    ${hn(t.kind.replaceAll("_"," "),t.pinName||t.reference||t.designator||t.text||t.netName||"Schematic object","#3b82f6")}
    ${Zs(n)}
    <div class="selection-section">
      <span class="selection-section-title">Source identity</span>
      <div class="selection-table">
        <div class="selection-row">
          <span><strong>${r?"Pin UUID":"UUID"}</strong></span>
          <span title="${V(t.uuid||t.sourceId||"")}">${V(t.uuid||t.sourceId||"-")}</span>
          <span title="${V(t.objectId||"")}">${V(t.objectId||"No object ID")}</span>
        </div>
        <div class="selection-row">
          <span><strong>Sheet</strong></span>
          <span>${V(e?.name||"Unknown")}</span>
          <span title="${V(t.sheetInstancePath||"")}">${V(t.sheetInstancePath||"/")}</span>
        </div>
      </div>
    </div>`}function $e(){if(kt(),w.workspace==="bom"){re.hidden=!0,re.innerHTML="";return}let t=k.scene.features.get(w.selectedFeatureId),e=t?.kind==="component"?t:null,a=w.workspace==="schematic"?w.selectedSchematicFeature:null,r=a?U.byId.get(a.pageId):null,s=w.activeNetId?k.scene.nets.find(u=>Number(u.id)===w.activeNetId):null;if(!s&&a&&(a.netUid?s=k.scene.nets.find(u=>u.uid===a.netUid):a.netName&&(s=Zt(k.scene.nets,a.netName))),!e&&a){let u=a.reference||a.componentDesignator||a.designator;u&&(e=k.scene.componentFeatures.get(u)||{designator:u})}if(!e&&!s&&!a){re.hidden=!0,re.innerHTML="";return}let n="";if(s)n=qv(s);else if(e){let u=a?.kind?.startsWith("pin")?a:null;n=Hv(e,u)}else a&&(n=Wv(a,r));re.innerHTML=`
    ${n}
    <div class="selection-card-actions">
      ${s?`
        <button type="button" data-action="isolate" aria-keyshortcuts="I" title="Toggle isolated net view (I)" class="${w.isolateNet?"active":""}">Isolate</button>
        <button type="button" data-action="net-layers">Layers</button>
      `:""}
      <button type="button" data-action="frame">Frame selection</button>
    </div>`,re.hidden=!1;let i=w.workspace==="schematic"?Pe:z,o=w.selectionAnchor,c=re.offsetWidth||360,l=re.offsetHeight||330;if(o){let u=Math.max(16,i.clientWidth-c-24),g=Math.max(16,i.clientHeight-l-24);re.style.left=`${de(o.x+18,16,u)}px`,re.style.top=`${de(o.y+18,16,g)}px`}else re.style.left="20px",re.style.top="20px";if(re.querySelector(".selection-card-close").addEventListener("click",He),re.querySelector("[data-action=frame]").addEventListener("click",Uo),s){let u=re.querySelector("[data-action=isolate]");u&&u.addEventListener("click",()=>{Fa(!w.isolateNet)});let g=re.querySelector("[data-action=net-layers]");g&&g.addEventListener("click",Fo),re.querySelectorAll(".pin-row-interactive").forEach(p=>{p.addEventListener("click",()=>{let h=p.dataset.ref,d=p.dataset.pin;if(!h)return;let y=((k.topology.net_details?.[s.uid]||{}).terminals||[]).find(v=>v.designator===h&&v.pin===d),x=xw(y);x?da(x,!0):jo(h,!0)})})}let f=re.querySelector(".net-ref-interactive");f&&f.addEventListener("click",()=>{let u=f.dataset.netName;if(!u)return;let g=Zt(k.scene.nets,u);g&&Po(Number(g.id),!0)})}function Uo(){if(w.workspace==="schematic"){Ph();return}let t=k.scene.features.get(w.selectedFeatureId);if(t?.bounds)Do(t);else{let e=k.scene.nets.find(a=>Number(a.id)===w.activeNetId);e?.boundsMm&&H.frame(Lo(Io(ha(e.boundsMm))))}}function Hh(){z.addEventListener("contextmenu",t=>t.preventDefault()),z.addEventListener("pointerdown",t=>{E&&(E.framed=!0),w.dragging=!0,w.lastX=t.clientX,w.lastY=t.clientY,w.pointerStartX=t.clientX,w.pointerStartY=t.clientY,w.dragMode=w.mode==="layer"||t.shiftKey||t.button!==0?"pan":"orbit",z.setPointerCapture(t.pointerId)}),z.addEventListener("pointermove",t=>{if(!w.dragging)return;let e=t.clientX-w.lastX,a=t.clientY-w.lastY;w.lastX=t.clientX,w.lastY=t.clientY,w.dragMode==="pan"?H.pan(e,a,z.clientHeight,w.mode==="layer"):H.orbit(e,a)}),z.addEventListener("pointerup",async t=>{w.dragging=!1,z.releasePointerCapture(t.pointerId),!(Math.hypot(t.clientX-w.pointerStartX,t.clientY-w.pointerStartY)>=3)&&w.clickSelect&&(t.button===0?await Cf(t):t.button===2&&await Jv(t))}),z.addEventListener("dblclick",async t=>{w.clickSelect&&(await Cf(t),Uo())}),z.addEventListener("wheel",t=>{E&&(E.framed=!0),t.preventDefault(),Math.abs(t.deltaX)>Math.abs(t.deltaY)*.4?H.pan(-t.deltaX,0,z.clientHeight,w.mode==="layer"):H.dolly(t.deltaY,w.mode==="layer")},{passive:!1}),window.addEventListener("keydown",Qh),Xv()}function Xv(){let t=!1,e,a,r=0,s=0;re.addEventListener("pointerdown",n=>{if(!n.target.closest(".selection-card-head")||n.target.closest(".selection-card-close"))return;t=!0,re.classList.add("dragging");let o=re.getBoundingClientRect();r=o.left,s=o.top,e=n.clientX,a=n.clientY,re.setPointerCapture(n.pointerId),n.stopPropagation()}),re.addEventListener("pointermove",n=>{if(!t)return;let i=n.clientX-e,o=n.clientY-a,c=w.workspace==="schematic"?Pe:z,l=re.offsetWidth||360,f=re.offsetHeight||330,u=Math.max(16,c.clientWidth-l-24),g=Math.max(16,c.clientHeight-f-24),p=de(r+i,16,u),h=de(s+o,16,g);re.style.left=`${p}px`,re.style.top=`${h}px`,w.selectionAnchor={x:p-18,y:h-18},n.stopPropagation()}),re.addEventListener("pointerup",n=>{t&&(t=!1,re.classList.remove("dragging"),re.releasePointerCapture(n.pointerId),n.stopPropagation())})}function $v(){oa("[data-workspace]").forEach(t=>{t.addEventListener("click",()=>Wh(t.dataset.workspace))})}function Wh(t){if(t==="schematic"&&!O||t==="bom"&&!st)return;w.workspace=t,wt.classList.remove("workspace-pcb","workspace-schematic","workspace-bom","workspace-stackup"),wt.classList.add(`workspace-${t}`),(t==="schematic"&&(w.activeTab==="view"||w.activeTab==="inspect"||w.activeTab==="stats")||t==="bom"||t==="stackup")&&bn("layers");let e=ee('.rail-tab[data-tab="layers"]');e&&(t==="schematic"?(e.textContent="Pages",e.title="Schematic pages"):t==="bom"?(e.textContent="Summary",e.title="BoM summary"):(e.textContent="Layers",e.title="Layers and compare"));let a=t==="schematic",r=t==="bom",s=t==="stackup";if(z.hidden=a||r||s,Pe&&(Pe.hidden=!a),en&&(en.hidden=!a||!te),tn&&(tn.hidden=!a),an&&(an.hidden=!r),Ue&&(Ue.hidden=!s),Fe.hidden=a||r||s,rn.hidden=a||r||s,yr&&(yr.hidden=!a),oa("[data-workspace]").forEach(n=>{n.classList.toggle("active",n.dataset.workspace===t)}),pn.textContent=r?"Semantic BoM active":a?te?"SVG DOM + WebGPU schematic world active":"WebGPU schematic world active":s?"Layer Stackup active":"WebGPU semantic glTF active",a&&!U.fitted&&(O.resize(),O.frameWorld(),U.fitted=!0),!a&&!r&&!s&&(k.renderer?.resize(),w.mode==="layer"&&Co()),s)try{a1()}catch(n){console.error("Failed to render stackup workspace",n),Ue&&(Ue.innerHTML=`
          <div class="selection-empty" style="padding:40px;text-align:center;">
            Stackup view failed to render. ${V(n?.message||String(n))}
          </div>
        `)}Bo(),$e()}function Yv(){Pe.addEventListener("pointerdown",t=>{te?.worldActive||te?.active||(w.schematicDragging=!0,w.schematicLastX=t.clientX,w.schematicLastY=t.clientY,w.schematicStartX=t.clientX,w.schematicStartY=t.clientY,Pe.setPointerCapture(t.pointerId))}),Pe.addEventListener("pointermove",t=>{if(te?.worldActive||te?.active||!w.schematicDragging||!O)return;let e=t.clientX-w.schematicLastX,a=t.clientY-w.schematicLastY;w.schematicLastX=t.clientX,w.schematicLastY=t.clientY,O.pan(e,a)}),Pe.addEventListener("pointerup",async t=>{if(!(te?.worldActive||te?.active)&&(w.schematicDragging=!1,Pe.releasePointerCapture(t.pointerId),Math.hypot(t.clientX-w.schematicStartX,t.clientY-w.schematicStartY)<3)){let e=await O.pickFeature(t.clientX,t.clientY);e?Pv(e):_r()}}),Pe.addEventListener("dblclick",t=>{if(te?.worldActive||te?.active)return;let e=O.hitPage(t.clientX,t.clientY);e&&vt(e.id,!0)}),Pe.addEventListener("wheel",t=>{te?.worldActive||te?.active||(t.preventDefault(),O.zoom(t.deltaY,t.clientX,t.clientY))},{passive:!1})}function If(t,e=11,a=32){let r=ia(t,et),s=ia([t[0]+1e-4,t[1],t[2]],et),n=ia([t[0],t[1]+1e-4,t[2]],et);if(!r||!s||!n)return null;let i=Math.max(Math.hypot(s.x-r.x,s.y-r.y),Math.hypot(n.x-r.x,n.y-r.y))/1e-4;if(!(i>0))return null;let o=e/i,c=[];for(let l=0;l<a;l++){let f=2*Math.PI*l/a,u=ia([t[0]+o*Math.cos(f),t[1]+o*Math.sin(f),t[2]],et);if(!u)return null;c.push(u)}return{centre:r,ring:c}}function Rf(t,e){if(!he||!z)return null;let a=z.getBoundingClientRect(),r=(t-a.left)/a.width*2-1,s=1-(e-a.top)/a.height*2;return Zd(he.matrix,r,s)}var Nf=0;async function Cf(t){if(!he)return;let e=++Nf,a=z.getBoundingClientRect();w.selectionAnchor={x:t.clientX-a.left,y:t.clientY-a.top};let r=await Xh(t);if(e===Nf){if(E){Aw(r);return}(r.kind==="feature"||r.kind==="board")&&(w.selectedOccurrence=r.occurrenceIndex),r.featureId?da(r.featureId,!0):He()}}async function Jv(t){if(!he||!on)return;let e=await Xh(t),a=E?E.placements.get(e.occurrenceKey)?.board:k;if(!a)return;let r=a.scene.features.get(e.featureId),s=Ba(r),n=s?ko(s,a):null;on({clientX:t.clientX,clientY:t.clientY,reference:s||void 0,value:String(n?.value||r?.value||"")||void 0})}function Xh(t){let e=z.getBoundingClientRect();return $h((t.clientX-e.left)*z.width/e.width,(t.clientY-e.top)*z.height/e.height)}async function $h(t,e){if(E){let r=await Tw(t,e);if(r?.kind!=="analytic"||!r.renderer)return r;let s=Ge().find(i=>i.renderer===r.renderer);if(!s?.analytic)return r;let n=await Gs(s.analytic,r.operationIndex)||await uo(s.analytic,r.operationIndex,s.scene);return{...r,featureId:n||null}}let a=await Qv(t,e);if(a?.kind==="analytic"&&k.analytic){let r=await Gs(k.analytic,a.operationIndex)||await uo(k.analytic,a.operationIndex,k.scene);return{...a,featureId:r||null}}return a}function Qv(t,e){return k.renderer.pick(he,t,e,{activeNetId:w.activeNetId,selectedFeatureId:w.selectedFeatureId,layerOffsets:fn(),visibleLayers:w.mode==="3d"?k.visible3dLayers:k.compareLayers,showBoard:w.showBoard,showComponents:w.showComponents,componentOpacity:de(1-w.separation/.1,0,1),boardOpacity:1-w.separation*.72,isolateNet:w.isolateNet,compareMode:w.mode==="layer",compareOffsets:Jt,visibleTileIds:w.mode==="3d"?k.visibleTileIds:null})}async function Yh(t,e){if(!he||!(E||k.renderer))return null;let a=z.getBoundingClientRect(),r=await $h((t-a.left)*z.width/a.width,(e-a.top)*z.height/a.height),s=E?E.placements.get(r.occurrenceKey)?.board:k,n=r.featureId&&s?bh(s.scene.features.get(r.featureId),s):null;return{...r,renderer:void 0,selection:n}}function Jh(t,e,a){let r=t.scene.componentFeatures.get(String(e)),s=r?t.scene.features.get(Number(r.featureId))?.bounds:null;if(!s)return null;let n=s[2]+s[5]>=0;return a([(s[0]+s[3])/2,(s[1]+s[4])/2,n?s[5]:s[2]])}function ia(t,e){if(!he)return null;let a=ss(he.matrix,si(e,t),he.viewport);if(!a)return null;let r=z.getBoundingClientRect();return{x:r.left+a.x*r.width/z.width,y:r.top+a.y*r.height/z.height}}function Qh(t){if(!xn())return;if(fc(t)){t.key==="Escape"&&t.target instanceof HTMLInputElement&&t.target.blur();return}if(hc(t))return;let e=t.key.toLowerCase();if(w.workspace==="schematic"){if(e==="/")t.preventDefault(),bn("search"),Me.querySelector("#entity-search")?.focus();else if(e==="escape")U.activeNetUid?(U.activeNetUid="",w.activeNetId=0,O.activeNetUid="",te?.setHighlightedNet(""),$e()):_r();else if(e==="~"||t.key==="~"){t.preventDefault();let a=w.selectedSchematicFeature?.netUid;a&&(U.activeNetUid===a?(U.activeNetUid="",w.activeNetId=0,O.activeNetUid="",te?.setHighlightedNet("")):Fh(a,w.selectedSchematicFeature))}else if(e==="home")O?.frameWorld();else if(e==="[")Qs("previous");else if(e==="]")Qs("next");else if(e==="n"){t.preventDefault();let a=O?.cycleNetIntrasheetLink(t.shiftKey?-1:1);a?.pageId&&(w.selectedPageId=a.pageId,O.selectedPageId=a.pageId,tb())}else if(t.altKey&&e==="arrowup")Qs("parent");else if(t.key.startsWith("Arrow")){t.preventDefault();let a=t.key==="ArrowRight"?32:t.key==="ArrowLeft"?-32:0,r=t.key==="ArrowDown"?32:t.key==="ArrowUp"?-32:0;O?.pan(a,r)}return}if(E&&ev(t,e)){t.preventDefault();return}if(e==="/")t.preventDefault(),bn("search"),Me.querySelector("#entity-search").focus();else if(e==="escape")He();else if(e==="i"&&w.workspace==="pcb"&&Oa())t.preventDefault(),Fa(!w.isolateNet);else if(e==="home")H.frame(E&&E.bounds||Qt());else if(e==="`")Mh(!w.showStats);else if(["x","y","z"].includes(e))H.setAxis(e,t.shiftKey);else if(e==="f")H.flip();else if(e==="r")H.rotateZ(t.shiftKey?-1:1);else if(e===" "){t.preventDefault();let a=k.scene.features.get(w.selectedFeatureId);a?.bounds&&H.setFocus([(a.bounds[0]+a.bounds[3])/2,(a.bounds[1]+a.bounds[4])/2,(a.bounds[2]+a.bounds[5])/2])}else if(t.key.startsWith("Arrow")){t.preventDefault();let a=t.key==="ArrowRight"?32:t.key==="ArrowLeft"?-32:0,r=t.key==="ArrowDown"?32:t.key==="ArrowUp"?-32:0;H.pan(a,r,z.clientHeight,w.mode==="layer")}}function bn(t){w.activeTab=t,wt.classList.remove("panel-collapsed"),oa(".rail-tab").forEach(e=>{e.classList.toggle("active",e.dataset.tab===t)}),oa(".tab-panel").forEach(e=>{e.classList.toggle("active",e.dataset.panel===t)})}function Zh(){let t=Fe.getContext("2d");t.clearRect(0,0,Fe.width,Fe.height);let e=[Fe.width/2,Fe.height/2],a=H.basis(),r=[{axis:"x",label:"X",color:"#e23838",vector:[1,0,0]},{axis:"y",label:"Y",color:"#2dbd50",vector:[0,1,0]},{axis:"z",label:"Z",color:"#3157d5",vector:[0,0,1]}],s=[];for(let n of r)for(let i of[-1,1]){let o=n.vector.map(l=>l*i),c=[mo(o,a.right),-mo(o,a.up),mo(o,a.back)];s.push({...n,sign:i,depth:c[2],point:[e[0]+c[0]*34,e[1]+c[1]*34]})}for(let n of r){let i=s.find(o=>o.axis===n.axis&&o.sign===1);t.strokeStyle=n.color,t.lineWidth=2.4,t.beginPath(),t.moveTo(...e),t.lineTo(...i.point),t.stroke()}sn=[];for(let n of s.sort((i,o)=>o.depth-i.depth)){let i=n.sign===1,o=i?13:9;t.beginPath(),t.arc(n.point[0],n.point[1],o,0,Math.PI*2),t.fillStyle=i?n.color:`${n.color}66`,t.fill(),t.lineWidth=2,t.strokeStyle=t1(n.color,i?.45:.58),t.stroke(),i&&(t.fillStyle="#07101c",t.font="700 13px system-ui",t.textAlign="center",t.textBaseline="middle",t.fillText(n.label,n.point[0],n.point[1]+.5)),sn.push({...n,radius:o+5})}}function eb(){!Fe||Fe.dataset.bound==="true"||(Fe.dataset.bound="true",Fe.addEventListener("click",t=>{let e=Fe.width/Fe.clientWidth,a=Fe.height/Fe.clientHeight,r=[t.offsetX*e,t.offsetY*a],s=sn.map(n=>({item:n,distance:Math.hypot(r[0]-n.point[0],r[1]-n.point[1])})).filter(({item:n,distance:i})=>i<=n.radius).sort((n,i)=>n.distance-i.distance)[0]?.item;s&&H.setAxis(s.axis,s.sign<0)}))}function Zv(){if(w.mode!=="layer"||!he){rn.innerHTML="";return}let t=Qt(),e=wh();rn.innerHTML=k.scene.copperLayers.filter(a=>e.has(Number(a.id))).map(a=>{let r=Jt.get(Number(a.id))||[0,0,0],s=e1([t[0]+r[0],t[4]+r[1],0],he.matrix,z.clientWidth,z.clientHeight);return!s||s[0]<-100||s[0]>z.clientWidth+100||s[1]<-100||s[1]>z.clientHeight+100?"":`<span style="left:${s[0]}px;top:${s[1]}px">${V(a.name)}</span>`}).join("")}function tb(){if(w.workspace!=="schematic"||!O){yr.innerHTML="";return}yr.innerHTML=U.visiblePages.filter(t=>O.pagePixelWidth(t)>120).map(t=>{let[e,a]=O.worldToScreen(t.worldX+8*O.scale,t.worldY-6*O.scale),r=t.id===w.selectedPageId,n=U.activeNetUid&&t.netUids.includes(U.activeNetUid)?"#18ef52":r?"#3b82f6":"#4b8de8";return`<div class="schematic-page-label" style="left:${e}px;top:${a}px;border-left-color:${n}">
        <strong>${V(t.name)}</strong>
        <small>Page ${t.sheetNumber} &middot; ${t.featureCount.toLocaleString()} features</small>
      </div>`}).join("")}function e1(t,e,a,r){let s=t[0],n=t[1],i=t[2],o=e[0]*s+e[4]*n+e[8]*i+e[12],c=e[1]*s+e[5]*n+e[9]*i+e[13],l=e[3]*s+e[7]*n+e[11]*i+e[15];return Math.abs(l)<1e-8?null:[(o/l*.5+.5)*a,(.5-c/l*.5)*r]}function mo(t,e){return t[0]*e[0]+t[1]*e[1]+t[2]*e[2]}function t1(t,e){let a=t.replace("#","");return`#${[0,2,4].map(r=>Math.round(parseInt(a.slice(r,r+2),16)*e).toString(16).padStart(2,"0")).join("")}`}function xo(t,e){w.frameSamples.push({intervalMs:t,cpuMs:e}),w.frameSamples.length>180&&w.frameSamples.shift()}function Bf(t,e){if(!t.length)return 0;let a=[...t].sort((r,s)=>r-s);return a[Math.min(a.length-1,Math.floor((a.length-1)*e))]}function wo(t){if(!$s||(w.frames+=1,t-w.fpsAt<=500))return;w.fps=w.frames*1e3/(t-w.fpsAt);let e=w.frameSamples;if(w.frameIntervalMs=e.length?e.reduce((n,i)=>n+i.intervalMs,0)/e.length:0,w.frameCpuMs=e.length?e.reduce((n,i)=>n+i.cpuMs,0)/e.length:0,w.frameIntervalP95Ms=Bf(e.map(n=>n.intervalMs),.95),w.frameCpuP95Ms=Bf(e.map(n=>n.cpuMs),.95),w.frames=0,w.fpsAt=t,Sh(),w.workspace==="bom"){let n=st?.payload?.counts||{},i=[["Renderer","BoM DOM table"],["Schema",st?.payload?.schema||"-"],["Grouped rows",n.rows||0],["Components",n.components||0],["DNP components",n.dnpComponents||0],["Extra columns",st?.payload?.extraColumns?.length||0],["Frame interval",`${w.frameIntervalMs.toFixed(2)} ms avg / ${w.frameIntervalP95Ms.toFixed(2)} p95`],["CPU frame",`${w.frameCpuMs.toFixed(2)} ms avg / ${w.frameCpuP95Ms.toFixed(2)} p95`],["FPS",w.fps.toFixed(1)]];$s.innerHTML=i.map(([o,c])=>`<dt>${o}</dt><dd>${c}</dd>`).join("");return}let a=w.workspace==="schematic"&&O?O.stats():null,r=w.workspace==="schematic"&&te?te.stats():null,s=w.workspace==="schematic"&&O?te?.active?[["Renderer","SVG DOM schematic detail"],["Pages",U.pages.length],["Mounted pages",r.mountedPages],["Active page",r.activePage],["DOM nodes",r.domNodes.toLocaleString()],["Indexed features",r.indexedFeatures.toLocaleString()],["Indexed nets",r.indexedNets.toLocaleString()],["SVG cache",`${r.cachedSvgPages} pages / ${(r.cachedSvgBytes/1048576).toFixed(1)} MB`],["Selection",`${r.selectionMs.toFixed(1)} ms`],["Active net",k.scene.nets.find(n=>n.uid===U.activeNetUid)?.name||"-"],["Tracking links",`${a.netFlowSegments} total / ${a.netFlowIntrasheetSegments} local`],["Tracking verts",a.netFlowVertices.toLocaleString()],["Mount",`${r.mountMs.toFixed(1)} ms`],["Highlight",`${r.highlightMs.toFixed(1)} ms`],["Fallback",r.fallbackReason||"-"],["Frame interval",`${w.frameIntervalMs.toFixed(2)} ms avg / ${w.frameIntervalP95Ms.toFixed(2)} p95`],["CPU frame",`${w.frameCpuMs.toFixed(2)} ms avg / ${w.frameCpuP95Ms.toFixed(2)} p95`],["FPS",w.fps.toFixed(1)]]:[["Renderer",te?"SVG DOM + WebGPU world":"WebGPU schematic world"],["Pages",U.pages.length],["Visible pages",U.visiblePages.length],["DOM pages",r?r.mountedPages:0],["DOM nodes",r?r.domNodes.toLocaleString():"0"],["Indexed SVG features",r?r.indexedFeatures.toLocaleString():"0"],["SVG cache",r?`${r.cachedSvgPages} pages / ${(r.cachedSvgBytes/1048576).toFixed(1)} MB`:"0 pages"],["JS heap",r?.heapMb?`${r.heapMb.toFixed(1)} MB`:"-"],["Hierarchy links",U.manifest.edges?.length||0],["Selected page",U.byId.get(w.selectedPageId)?.name||"-"],["Active net",k.scene.nets.find(n=>n.uid===U.activeNetUid)?.name||"-"],["Tracking links",`${a.netFlowSegments} total / ${a.netFlowIntrasheetSegments} local`],["Downloaded",`${(O.downloadedBytes/1048576).toFixed(1)} MB`],["Resident vectors",`${(a.residentVectorBytes/1048576).toFixed(1)} MB`],["Vector pages",`${a.vectorChunks} loaded / ${a.vectorLoads} loading`],["Vector draw",`${a.vectorVertices.toLocaleString()} verts / ${a.vectorDrawChunks} chunks`],["Native detail",`${a.nativeDetailPages} pages @ ${a.nativePxPerMm} / ${a.nativeThresholdPxPerMm} px/mm`],["Vector failures",a.failedVectorChunks],["Truncated",a.truncatedVectors],["Frame interval",`${w.frameIntervalMs.toFixed(2)} ms avg / ${w.frameIntervalP95Ms.toFixed(2)} p95`],["CPU frame",`${w.frameCpuMs.toFixed(2)} ms avg / ${w.frameCpuP95Ms.toFixed(2)} p95`],["FPS",w.fps.toFixed(1)]]:[["Renderer","WebGPU semantic glTF"],["Mode",w.mode==="3d"?"3D":"Layer Compare"],["Visible layers",w.mode==="3d"?k.visible3dLayers.size:k.compareLayers.size],["Resident tiles",k.scene.loaded.size],["Loading tiles",k.scene.loading.size],["Failed tiles",k.scene.failed.size],["Triangles",Math.round(k.triangles).toLocaleString()],["Downloaded",`${(k.loadedBytes/1048576).toFixed(1)} MB`],["Resident GLB",`${(k.residentTileBytes/1048576).toFixed(1)} MB`],["Resident GPU",`${(k.residentTileGpuBytes/1048576).toFixed(1)} MB`],["Tile loads",k.tileLoads.toLocaleString()],["Tile evictions",k.tileEvictions.toLocaleString()],["Tile scheduler",`${k.tileSchedulerMs.toFixed(2)} ms`],["Active net",k.scene.nets.find(n=>Number(n.id)===w.activeNetId)?.name||"-"],["Frame interval",`${w.frameIntervalMs.toFixed(2)} ms avg / ${w.frameIntervalP95Ms.toFixed(2)} p95`],["CPU frame",`${w.frameCpuMs.toFixed(2)} ms avg / ${w.frameCpuP95Ms.toFixed(2)} p95`],["FPS",w.fps.toFixed(1)]];$s.innerHTML=s.map(([n,i])=>`<dt>${n}</dt><dd>${i}</dd>`).join("")}function Mn(t){return`rgb(${t.slice(0,3).map(e=>Math.round(e*255)).join(" ")})`}function a1(){if(!Ue)return;let t=k.scene.layers||[];if(!t.length){Ue.innerHTML='<div class="selection-empty" style="padding:40px;text-align:center;">No stackup information available for this board.</div>';return}let e=t.filter(T=>["copper","dielectric","paste","silkscreen","soldermask"].includes(T.role)),a=k.topology.board?.stackup||{},r=T=>{if(T==null||T==="")return"None";let P=String(T);return V(P.includes(".")?P.split(".").pop():P)},s=(T,P=4)=>{let D=Number(T);return Number.isFinite(D)&&D>0?D.toFixed(P):"-"},n=(T,P=3)=>{let D=Number(T);return Number.isFinite(D)?D.toFixed(P):"-"},i=T=>{if(T==null||T==="")return"No";if(typeof T=="boolean")return T?"Yes":"No";let P=String(T).trim().toLowerCase(),D=P.includes(".")?P.split(".").pop():P;return["0","false","no","n","off","none"].includes(D)?"No":(["1","true","yes","y","on"].includes(D),"Yes")},o=T=>({copper:"Copper",dielectric:"Dielectric",paste:"Paste",silkscreen:"Silkscreen",soldermask:"Solder mask"})[T]||String(T||"Layer"),c=T=>T.role!=="dielectric"?"":T.type==="core"?"Core":T.type==="prepreg"||(T.material||"").toLowerCase().includes("prepreg")?"Prepreg":"Core",l=(T,P=4)=>{let D=Number(T.thickness_mm);return Number.isFinite(D)&&D>0?`${D.toFixed(P)} mm`:"Not specified"},f=T=>{let P=o(T.role),D=String(T.material||"").trim(),Y=D&&D.toLowerCase()!==String(T.role||"").toLowerCase();if(T.role==="dielectric"){let pe=[Y?D:"",s(T.epsilon_r,3)!=="-"?`\u03B5r ${s(T.epsilon_r,3)}`:"",s(T.loss_tangent,4)!=="-"?`tan \u03B4 ${s(T.loss_tangent,4)}`:""].filter(Boolean).join(" \xB7 ");return{primary:`${T.name} \xB7 ${c(T)}`,secondary:pe}}return{primary:[T.name,P,Y?D:""].filter(Boolean).join(" \xB7 "),secondary:""}},u=0,g=0,p=0,h=0;e.forEach(T=>{h+=T.thickness_mm||0,T.role==="copper"?T.name.toLowerCase().includes("gnd")||T.name.toLowerCase().includes("pwr")||T.name.toLowerCase().includes("plane")?g++:u++:T.role==="dielectric"&&p++});let d=k.scene.copperLayers||[],m=0,b=0,y=0,x=[...(k.scene.manifest?.barrels||[]).filter(T=>T.kind==="via"),...[...k.scene.features.values()].filter(T=>T.kind==="via")],v=Kd(d,x);m=v.counts.thru,b=v.counts.blind,y=v.counts.buried;let M=v.spans,S=30,A=S,_=[],N=new Map(e.map((T,P)=>[T,P])),I=r1(e),C=(T,P)=>{let D=I.get(T.name);if(D!==void 0)return D;let Y=Number(T.stack_index);return Number.isFinite(Y)?Y:P+1e5},B=[...e].sort((T,P)=>{let D=C(T,N.get(T)||0),Y=C(P,N.get(P)||0);return D!==Y?D-Y:(P.z_mm||0)-(T.z_mm||0)});B.forEach(T=>{let P=12;T.role==="dielectric"?P=Math.max(160,Math.min(360,(T.thickness_mm||.1)*140)):T.role==="copper"?P=22:T.role==="soldermask"&&(P=14),_.push({...T,svgY:A,svgHeight:P}),A+=P});let R=800,j=130,q=240,$=j+q+16,Z=$+84,me="";_.forEach(T=>{let P=T.color||"#7f7f7f";T.role==="copper"?P=T.color||"#f97316":T.role==="dielectric"?P="#a98d5c":T.role==="paste"?P="#cbd5e1":T.role==="soldermask"?P="#1b4332":T.role==="silkscreen"&&(P="#e2e8f0");let D=d.findIndex(ib=>ib.name===T.name),Y=f(T),pe=T.svgY+T.svgHeight/2,we=!!Y.secondary&&T.svgHeight>=38,nt=we?pe-5:pe+3,fa=V(T.id),bt=V(T.name),L=Number.isFinite(Number(T.thickness_mm))&&Number(T.thickness_mm)>0,ne=V(L?l(T):"\u2014"),Ye=V([Y.primary,Y.secondary,`Thickness ${l(T)}`].filter(Boolean).join("; "));me+=`
      <g class="stackup-svg-layer" data-layer-id="${fa}" data-layer-name="${bt}">
        <title>${Ye}</title>
        <rect x="${j}" y="${T.svgY}" width="${q}" height="${T.svgHeight}" fill="${P}" opacity="0.85" rx="1"/>
        <text x="${j-8}" y="${T.svgY+T.svgHeight/2+3}" fill="var(--muted)" font-size="9px" text-anchor="end" font-weight="700">
          ${T.role==="copper"?D+1:""}
        </text>
        <path class="stackup-layer-dimension" d="M ${$+6} ${T.svgY+1} H ${$} V ${T.svgY+T.svgHeight-1} H ${$+6}" />
        <text class="stackup-layer-thickness" x="${$+10}" y="${pe+3}" fill="var(--muted)" font-size="8.5px" font-weight="650">
          ${ne}
        </text>
        <text class="stackup-layer-name" x="${Z}" y="${nt}" fill="var(--foreground)" font-size="9px" font-weight="650">
          ${V(Y.primary)}
        </text>
        ${we?`<text class="stackup-layer-metadata" x="${Z}" y="${pe+10}" fill="var(--muted)" font-size="8px">${V(Y.secondary)}</text>`:""}
      </g>
    `});let se="",ge=_.filter(T=>T.role==="copper");M.forEach((T,P)=>{let D=_.find(L=>L.name===T.startName),Y=_.find(L=>L.name===T.endName);if(!D||!Y)return;let pe=D.svgY,we=Y.svgY+Y.svgHeight,nt=j+(P+1)*q/(M.length+1),fa=T.type==="thru"?"Thru":T.type==="blind"?"Blind":"Buried",bt=`var(--stackup-via-${T.type})`;se+=`
      <g class="stackup-svg-via" data-via-type="${T.type}">
        <title>${fa}: ${T.startName} \u2192 ${T.endName}</title>
        ${ge.map(L=>L.svgY>=D.svgY&&L.svgY<=Y.svgY?`<rect x="${nt-5}" y="${L.svgY}" width="10" height="${L.svgHeight}" fill="${bt}" rx="0.5" />`:"").join("")}
        <rect x="${nt-2}" y="${pe}" width="4" height="${we-pe}" fill="${bt}" opacity="0.95" />
        <rect x="${nt-.75}" y="${pe-1}" width="1.5" height="${we-pe+2}" fill="var(--panel)" opacity="0.9" />
      </g>
    `});let Se=`
    <svg class="stackup-visual-svg" viewBox="0 0 ${R} ${A+10}" width="${R}" height="${A+10}">
      <g class="stackup-svg-column-headings" aria-hidden="true">
        <text x="${$+10}" y="15">Thickness</text>
        <text x="${Z}" y="15">Layer / material properties</text>
      </g>
      <g class="stackup-total-dimension" aria-label="Total board thickness ${h.toFixed(4)} millimetres">
        <path d="M 76 ${S} H 68 V ${A} H 76" />
        <text x="68" y="15">Total ${h.toFixed(4)} mm</text>
      </g>
      ${me}
      ${se}
    </svg>
    <div class="stackup-via-legend" aria-label="Via span legend">
      <span><i data-via-type="thru"></i>Thru</span>
      <span><i data-via-type="blind"></i>Blind</span>
      <span><i data-via-type="buried"></i>Buried</span>
    </div>
  `,be="";B.forEach(T=>{let P="silk";T.role==="copper"?P="copper":T.role==="dielectric"?P="dielectric":T.role==="paste"?P="paste":T.role==="soldermask"&&(P="mask");let D=c(T),Y=V(T.id),pe=V(T.name),we=f(T);be+=`
      <tr data-layer-id="${Y}" data-layer-name="${pe}" tabindex="0" aria-label="${V(`${we.primary}; thickness ${l(T)}`)}">
        <td><strong>${pe}</strong></td>
        <td><span class="stackup-badge ${P}">${T.role}</span></td>
        <td>${D||"-"}</td>
        <td>${V(T.material||"-")}</td>
        <td>${T.role==="dielectric"?s(T.epsilon_r,3):"-"}</td>
        <td>${T.role==="dielectric"?s(T.loss_tangent,4):"-"}</td>
        <td>${T.thickness_mm?T.thickness_mm.toFixed(4)+" mm":"-"}</td>
      </tr>
    `});let Te="",ye=k.topology.board?.net_classes||[],Ce=T=>{let P=n(T);return P==="-"?P:`${P} mm`};ye.length?ye.forEach(T=>{Te+=`
        <tr>
          <td><strong>${T.name}</strong></td>
          <td>${Ce(T.track_width)}</td>
          <td>${Ce(T.clearance)}</td>
          <td>${Ce(T.diff_pair_width)}</td>
          <td>${Ce(T.diff_pair_gap)}</td>
          <td>${Number.isFinite(Number(T.via_diameter))?`${n(T.via_drill)}/${n(T.via_diameter)} mm`:"-"}</td>
        </tr>
      `}):Te=`
      <tr>
        <td colspan="6" class="selection-empty" style="text-align: center;">No design rules or impedance classes defined.</td>
      </tr>
    `,Ue.innerHTML=`
    <div class="stackup-header">
      <div class="stackup-header-title">
        <h1>Layer Stackup</h1>
        <p>Board cross-section profile, layer properties & design rules</p>
      </div>
    </div>

    <div class="stackup-workspace-body">
      <div class="stackup-diagram-card">
        <span class="stackup-section-title">Cross-Section Profile</span>
        ${Se}
      </div>
      <aside class="stackup-side-panel">
      <div class="stackup-summary-grid">
        <div class="stackup-summary-card">
          <label>Total Thickness</label>
          <span>${h.toFixed(4)} mm</span>
        </div>
        <div class="stackup-summary-card">
          <label>Copper Layers</label>
          <span>${d.length} (${u} Sig / ${g} Plane)</span>
        </div>
        <div class="stackup-summary-card">
          <label>Dielectrics</label>
          <span>${p} Layers</span>
        </div>
        <div class="stackup-summary-card">
          <label>Thru Vias</label>
          <span>${m}</span>
        </div>
        <div class="stackup-summary-card">
          <label>Blind Vias</label>
          <span>${b}</span>
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
          <span>${r(a.copper_finish)}</span>
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
                ${Te}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      </aside>
    </div>
  `;let Ae=(T,P)=>{Ue.querySelectorAll(".stackup-svg-layer").forEach(D=>{let Y=D.dataset.layerId===T;D.classList.toggle("active",Y&&P)}),Ue.querySelectorAll(".stackup-table tbody tr[data-layer-id]").forEach(D=>{let Y=D.dataset.layerId===T;D.classList.toggle("active",Y&&P)})},Pa=T=>{let P=Ue.querySelector(".stackup-diagram-card"),D=Ue.querySelector(`.stackup-svg-layer[data-layer-id="${CSS.escape(T)}"]`);if(!P||!D||P.scrollHeight<=P.clientHeight)return;let Y=P.getBoundingClientRect(),pe=D.getBoundingClientRect(),we=P.scrollTop+pe.top-Y.top-(P.clientHeight-pe.height)/2,nt=window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;P.scrollTo({top:Math.max(0,we),behavior:nt?"auto":"smooth"})},ua=(T,{revealDiagram:P=!1}={})=>{T.forEach(D=>{let Y=()=>{let we=D.dataset.layerId;Ae(we,!0),P&&Pa(we)},pe=()=>Ae(null,!1);D.addEventListener("mouseenter",Y),D.addEventListener("mouseleave",pe),P&&(D.addEventListener("focus",Y),D.addEventListener("blur",pe))})};ua(Ue.querySelectorAll(".stackup-svg-layer")),ua(Ue.querySelectorAll(".stackup-table tbody tr[data-layer-id]"),{revealDiagram:!0})}function r1(t){let e=t.filter(s=>s.role==="dielectric");if(!(e.length===1&&e[0]?.name==="Board"))return new Map;let r=new Map;return["F.SilkS","F.Paste","F.Mask","F.Cu","Board","B.Cu","B.Mask","B.Paste","B.SilkS"].forEach((s,n)=>r.set(s,n)),r}function ab(){let t=null;return{begin(){return t?.abort(),t=new AbortController,t},owns(e){return e!==null&&e===t&&!e.signal.aborted},cancel(){t?.abort(),t=null}}}async function rb(t,e,{owner:a,bundleUrl:r,loadBundle:s,now:n=()=>performance.now()}){let i=n(),o={},{signal:c}=e,l=()=>a.owns(e)&&t.isConnected;try{t.renderLoading();let f=n(),{bundle:u,topology:g,semanticGeometry:p,assetCache:h}=await s(r,o,c);if(o.bundle_group_total_ms=n()-f,!l())return;t.renderShell();let d=n(),m=await t.mountViewer({topology:g,semanticGeometry:p,readiness:u.readiness,assetCache:h,signal:c});if(!l()){m?.dispose?.();return}t.publishController(m),o.mount_and_first_frame_ms=n()-d,Object.assign(o,m?.performance||{}),o.reload_to_visible_ms=n()-i,t.emitReady({schema:"prism.semantic_viewer_performance.a0",milestone:"board-visible",readiness_stage:u.readiness?.stage||"semantic-ready",readiness_progress:u.readiness?.progress??100,timings:o})}catch(f){if(!l())return;t.renderError(f),t.emitError(f)}}function s1(){return`
    <style>
      ${Yo}
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
      /* System mode (SB2-31f): board labels, the move gizmo and the key list. */
      #system-labels { position: absolute; inset: 0; z-index: 2; pointer-events: none; overflow: hidden; }
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
        <div id="system-labels" hidden></div>
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
          <dt><kbd>Shift</kbd></dt><dd>While dragging: the fine steps</dd>
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
  `}function n1(t){return String(t).replace(/[&<>"']/g,e=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[e])}async function i1(t,e=null,a="fetch",r=void 0){let s=performance.now(),n=await fetch(t,{cache:"no-store",signal:r});if(!n.ok)throw new Error(`Failed to load ${t}: ${n.status}`);let i=await n.json();return e&&(e[`${a}_fetch_parse_ms`]=performance.now()-s,e[`${a}_content_length`]=Number(n.headers.get("content-length")||0)),i}async function sb(t,e,a){let r=new URL(t,document.baseURI).toString(),s=new URL(r).searchParams.get("viewer")||"",n=Br.open(),i=await n.peekJson(r).catch(()=>null),o=!!i;i||(i=await i1(r,e,"bundle",a),Nn(i)&&n.store(r,new TextEncoder().encode(JSON.stringify(i)))),e&&(e.bundle_from_cache=o);let c=Nn(i)&&n.enabled?n:null;if(i.schema!==Ho)throw new Error(`Unsupported visualizer bundle schema: ${i.schema||"missing"}`);let l={analytic:!0,cache_key:i.cache_key||"",readiness:i.readiness,assets:i.assets||{}};return{bundle:i,topology:{},semanticGeometry:Zo(l,r,i,s),assetCache:c}}var Sn=class extends HTMLElement{static get observedAttributes(){return["bundle-url","workspace","mode","move-allowed"]}constructor(){super(),this.attachShadow({mode:"open"}),this.reloadOwner=ab(),this.reloadQueued=!1,this.reloadSource=null;let e=Ui();this.modes=Object.freeze({board:new Ts(e),system:new As(e)}),this.mounted=null}get activeMode(){return this.mounted??(this.systemMode?this.modes.system:this.modes.board)}detachModes(){this.modes.board.detach(),this.modes.system.detach(),this.mounted=null}connectedCallback(){this.queueReload()}disconnectedCallback(){this.reloadOwner.cancel(),this.detachModes(),this.reloadSource=null}attributeChangedCallback(e,a,r){if(!(!this.isConnected||a===r)){if(e==="workspace"){this.modes.board.setWorkspace(this.workspace);return}if(e==="move-allowed"){this.modes.system.setMoveAllowed(r==="true");return}this.queueReload()}}get workspace(){return this.getAttribute("workspace")==="stackup"?"stackup":"pcb"}get systemMode(){return this.getAttribute("mode")==="system"}queueReload(){let e=this.systemMode?"system":this.getAttribute("bundle-url");!e||e===this.reloadSource||(this.reloadSource=e,!this.reloadQueued&&(this.reloadQueued=!0,queueMicrotask(()=>{this.reloadQueued=!1,this.isConnected&&this.reload()})))}async reload(){let e=this.getAttribute("bundle-url"),a=this.reloadOwner.begin();if(this.detachModes(),this.systemMode){await this.reloadSystem(a);return}if(!e){this.shadowRoot.innerHTML="<style>:host{display:block;height:100%;font:14px system-ui;color:#94a3b8}</style><div>Semantic bundle URL is missing.</div>";return}await rb(this,a,{owner:this.reloadOwner,bundleUrl:e,loadBundle:sb})}async reloadSystem(e){let{signal:a}=e,r=()=>this.reloadOwner.owns(e)&&this.isConnected;try{this.renderShell();let s=await Wf({root:this.shadowRoot,loadBundle:(i,o)=>sb(i,null,o),isActive:()=>this.getAttribute("active")==="true",onSelectionChange:i=>{a.aborted||this.emit("selectionchange",{selection:i})},onContextMenu:i=>{a.aborted||this.emit("contextmenu",i)},onViewStateChange:i=>{a.aborted||this.emitViewState(i)},onEmphasis:i=>{a.aborted||this.emit("emphasis",{results:i})},onMove:i=>{a.aborted||this.emit("move",i)}});if(!r()){s?.dispose?.();return}this.mounted=this.modes.system,this.mounted.attach(s,{moveAllowed:this.getAttribute("move-allowed")==="true"});let n=this.getViewState();n&&this.emitViewState(n),this.emitReady({schema:"prism.semantic_viewer_performance.a0",milestone:"system-mounted"})}catch(s){if(!r())return;this.renderError(s),this.emitError(s)}}emit(e,a){this.dispatchEvent(new CustomEvent(`prism-semantic-viewer:${e}`,{bubbles:!0,composed:!0,detail:a}))}renderLoading(){this.shadowRoot.innerHTML='<style>:host{display:block;height:100%;background:#020817;color:#e5e7eb;font:14px system-ui}</style><div style="display:grid;place-items:center;height:100%">Loading semantic visualizer...</div>'}renderShell(){this.shadowRoot.innerHTML=s1()}renderError(e){console.error(e),this.shadowRoot.innerHTML=`
      <style>
        :host{display:block;height:100%;background:#020817;color:#e5e7eb;font:14px system-ui}
        .error{height:100%;display:grid;place-items:center;padding:24px}
        pre{max-width:100%;white-space:pre-wrap;color:#fecaca;background:#111827;border:1px solid #374151;padding:16px}
      </style>
      <div class="error"><pre>${n1(e?.stack||e?.message||String(e))}</pre></div>
    `}mountViewer({topology:e,semanticGeometry:a,readiness:r,assetCache:s=null,signal:n}){return Vf({root:this.shadowRoot,topology:e,semanticGeometry:a,readiness:r,workspaceScope:"3d",assetCache:s,isActive:()=>this.getAttribute("active")==="true",onSelectionChange:i=>{n.aborted||this.dispatchEvent(new CustomEvent("prism-semantic-viewer:selectionchange",{bubbles:!0,composed:!0,detail:{selection:i}}))},onContextMenu:i=>{n.aborted||this.dispatchEvent(new CustomEvent("prism-semantic-viewer:contextmenu",{bubbles:!0,composed:!0,detail:i}))},onViewStateChange:i=>{n.aborted||this.emitViewState(i)},onPerformanceEvent:i=>{n.aborted||(console.info("[prism-3d-perf]",i),this.dispatchEvent(new CustomEvent("prism-semantic-viewer:performance",{bubbles:!0,composed:!0,detail:i})))}})}publishController(e){this.mounted=this.modes.board,this.mounted.attach(e,{workspace:this.workspace});let a=this.getViewState();a&&this.emitViewState(a)}emitViewState(e){this.dispatchEvent(new CustomEvent("prism-semantic-viewer:viewstatechange",{bubbles:!0,composed:!0,detail:e}))}emitReady(e){console.info("[prism-3d-perf]",e),this.dispatchEvent(new CustomEvent("prism-semantic-viewer:ready",{bubbles:!0,composed:!0,detail:e}))}emitError(e){this.dispatchEvent(new CustomEvent("prism-semantic-viewer:error",{bubbles:!0,detail:{error:e}}))}};cu(Sn.prototype);function nb(){customElements.get("prism-semantic-viewer")||customElements.define("prism-semantic-viewer",Sn)}window.__PRISM_SEMANTIC_VIEWER_MANUAL_BOOT__=!0;nb();
