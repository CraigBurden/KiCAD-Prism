function rs(t,e=()=>""){let a=new Map;for(let s of t){let n=`${e(s)}:${JSON.stringify(s.material)}`;a.has(n)||a.set(n,[]),a.get(n).push(s)}return[...a.values()].map(s=>{let r=s.reduce((h,d)=>h+d.position.length/3,0),n=s.reduce((h,d)=>h+d.indices.length,0),i=new Float32Array(r*3),o=new Float32Array(r*3),c=new Uint32Array(r),l=new Uint32Array(r),f=new Uint32Array(n),u=0,g=0,p=[1/0,1/0,1/0,-1/0,-1/0,-1/0];for(let h of s){let d=h.position.length/3;i.set(h.position,u*3),o.set(h.normal,u*3),c.set(h.netId,u),l.set(h.objectFeatureId,u);for(let m=0;m<h.indices.length;m+=1)f[g+m]=Number(h.indices[m])+u;h.bounds&&(p[0]=Math.min(p[0],h.bounds[0]),p[1]=Math.min(p[1],h.bounds[1]),p[2]=Math.min(p[2],h.bounds[2]),p[3]=Math.max(p[3],h.bounds[3]),p[4]=Math.max(p[4],h.bounds[4]),p[5]=Math.max(p[5],h.bounds[5])),u+=d,g+=h.indices.length}return{position:i,normal:o,netId:c,objectFeatureId:l,indices:f,material:s[0].material,groupKey:e(s[0]),bounds:Number.isFinite(p[0])?p:null}})}function ga(t){return!t||t.length!==6?null:[t[0]/1e3,-t[4]/1e3,t[2]/1e3,t[3]/1e3,-t[1]/1e3,t[5]/1e3]}function ns(t){let e=t?.min||[0,0,0],a=t?.max||[.08,.0016,.05];return[e[0],-a[2],e[1],a[0],-e[2],a[1]]}function Vi(t){let e=t.filter(a=>Array.isArray(a)&&a.length===6);return e.length?e.reduce((a,s)=>[Math.min(a[0],s[0]),Math.min(a[1],s[1]),Math.min(a[2],s[2]),Math.max(a[3],s[3]),Math.max(a[4],s[4]),Math.max(a[5],s[5])],[...e[0]]):null}function Ki(t){let e=t.replace("#","");return[0,2,4].map(a=>parseInt(e.slice(a,a+2),16)/255)}var df="#c83434",uf="#4d7fc4",ss=["#7fc87f","#ce7d2c","#4fcbcb","#db628b","#a7a5c6","#28ccd9","#e8b2a7","#f2eda1","#8dcb81","#ed7c33","#5bc3eb","#f76f8e","#a7a5c6","#28ccd9","#e8b2a7","#f2eda1","#ed7c33","#5bc3eb","#f76f8e","#a7a5c6","#28ccd9","#e8b2a7","#f2eda1","#ed7c33","#5bc3eb","#f76f8e","#a7a5c6","#28ccd9","#e8b2a7","#f2eda1"];function Lr(t,e=0){if(t==="F.Cu")return df;if(t==="B.Cu")return uf;let a=/^In(\d+)\.Cu$/.exec(String(t||""))?.[1],s=a?Number(a)-1:e;return ss[(s%ss.length+ss.length)%ss.length]}function Hi(t,e){if(typeof t?.color=="string"&&/^#[0-9a-fA-F]{6}$/.test(t.color))return[...Ki(t.color),1];let a=String(t?.name||""),s=Math.max(0,e.findIndex(r=>r.name===a)-1);return[...Ki(Lr(a,s)),1]}var pa=Object.freeze({gold:[.83,.69,.37,1],silver:[.74,.75,.77,1],copper:[.76,.47,.28,1]});function qi(t){let e=String(t||"").toLowerCase();return/hasl|hal\b|tin|silver|lead/.test(e)?pa.silver:/osp|bare|none/.test(e)?pa.copper:pa.gold}function Wi(t,e){let a=String(t?.name||"");return!!a&&(a===e[0]?.name||a===e[e.length-1]?.name)}var $i="prism.viewer_3d.analytic.a0",Ur={"F.SilkS":"#f2f2f2","B.SilkS":"#dddddd","F.Mask":"#316d4f","B.Mask":"#275840","F.Paste":"#c5cbd3","B.Paste":"#aeb7c2"},ff="#2f6b4f",hf={green:"#316d4f",red:"#a5272a",blue:"#1f4f8a",yellow:"#c9a227",white:"#e6e6e6",black:"#1a1a1a",purple:"#5b2d7a"},bf={conductor:"copper",dielectric:"dielectric",solder_mask:"soldermask",silkscreen:"silkscreen",paste:"paste"},pf={copper:"copper",dielectric:"FR4",soldermask:"soldermask",silkscreen:"ink",paste:"paste"};function gf(t,e){let a=String(t?.maskColors?.[e]||"").trim();return/^#[0-9a-f]{6}$/i.test(a)?a:hf[a.toLowerCase()]||(e==="back"?Ur["B.Mask"]:Ur["F.Mask"])}function mf(t,e=null){let a=[...t?.stack?.slices||[]].sort((c,l)=>c.order-l.order),s=c=>Number(c.thickness_nm||0)/1e6,n=a.reduce((c,l)=>c+s(l),0)/2,i=0,o=[];for(let c of a){let l=bf[c.role],f=s(c),u=n-f/2;if(n-=f,!l)continue;let g=String(c.kicad_layer||c.key),p=Ur[g];l==="copper"&&(p=Lr(g,g==="F.Cu"||g==="B.Cu"?0:i++)),l==="soldermask"&&(p=gf(e,c.side==="back"?"back":"front")),l==="dielectric"&&(p=c.color||ff),o.push({id:o.length+1,uid:`layer_${c.key}`,name:g,role:l,z_mm:+u.toFixed(6)||0,thickness_mm:+f.toFixed(6),material:c.material_name||pf[l],color:p||"#8a8a8a",visibility_group:l==="dielectric"?"board":l,stack_index:c.order,side:c.side||null,sliceKey:c.key})}return o}function yf(t){let e=t?.chunks||[],a=e.filter(r=>String(r.slice_key||"").startsWith("dielectric")),s=null;for(let r of a.length?a:e){let n=r.bounds;if(!n)continue;let i=[n.min_x_nm,n.min_y_nm,n.max_x_nm,n.max_y_nm].map(o=>Number(o)/1e6);s=s?[Math.min(s[0],i[0]),Math.min(s[1],i[1]),Math.max(s[2],i[2]),Math.max(s[3],i[3])]:i}return s}var xf=1,Yi=1073741824;function wf(t,e){let a=t?.body_bounds,s=t?.affine;if(!a||!s)return null;let[r,n,i,o]=[1/0,1/0,-1/0,-1/0];for(let[g,p]of[[a.min_x_nm,a.min_y_nm],[a.max_x_nm,a.min_y_nm],[a.min_x_nm,a.max_y_nm],[a.max_x_nm,a.max_y_nm]]){let h=(s.m11*g+s.m12*p+Number(s.tx_nm))/1e6,d=(s.m21*g+s.m22*p+Number(s.ty_nm))/1e6;[r,n,i,o]=[Math.min(r,h),Math.min(n,d),Math.max(i,h),Math.max(o,d)]}let c=t.body_height_nm?Number(t.body_height_nm)/1e6:1,l=e/2,[f,u]=t.side==="back"?[-l-c,-l]:[l,l+c];return[r,n,f,i,o,u]}function Ji(t,e=null){let a=mf(t,e),s=[{id:0,uid:"",name:"",netClass:""}];for(let c of t?.nets||[])c?.name&&s.push({id:s.length,uid:String(c.key||c.name),name:String(c.name),netClass:String(c.net_class||""),aliases:[]});let r=Number(t?.stack?.board_thickness_nm||0)/1e6,n=(t?.components||[]).map((c,l)=>({id:l+1,featureId:xf+l,uid:String(c.source_uid||""),designator:String(c.refdes||""),footprint:String(c.footprint||""),side:c.side||null,nodeIndex:null,meshNames:[],boundsMm:wf(c,r)})),i=yf(t);return{schema:"prism.analytic_scene.a0",bbox:i?{min:[i[0]/1e3,-r/2e3,i[1]/1e3],max:[i[2]/1e3,r/2e3,i[3]/1e3]}:null,componentsZOffsetMm:-r/2,layers:a,copperLayerIds:a.filter(c=>c.role==="copper").map(c=>c.id),nets:s,objectFeatures:[],components:n,tiles:[],barrels:[]}}var Dr={green:[.06,.16,.11,.83],red:[.52,.05,.05,.83],blue:[.05,.12,.42,.83],black:[.05,.05,.05,.85],white:[.9,.9,.9,.83],purple:[.3,.1,.4,.83],yellow:[.7,.62,.1,.83]},vf=[.62,.63,.65,1],kf=[.9,.9,.88,1],Ef=t=>{let e=t/255;return e<=.04045?e/12.92:((e+.055)/1.055)**2.4};function Xi(t){let e=String(t||"").trim().toLowerCase(),a=/^#([0-9a-f]{6})([0-9a-f]{2})?$/.exec(e);if(a){let s=[0,2,4].map(n=>parseInt(a[1].slice(n,n+2),16)),r=a[2]?parseInt(a[2],16)/255:Dr.green[3];return[...s.map(n=>+Ef(n).toFixed(4)),+r.toFixed(4)]}return[...Dr[e]||Dr.green]}function Qi(t){let e=t?.maskColors?.front||"";return{soldermask:{front:Xi(e),back:Xi(t?.maskColors?.back||e)},paste:[...vf],silkscreen:[...kf]}}var Zi=`:host,
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
`;var Mf=/\/api\/projects\/([^/]+)\/webgpu-3d\/assets\/([^/]+)\/([^/]+)\/(.+)$/,_f="prism-bundle-cache-a0";var zr="manifest.json",eo=720*60*60*1e3,to=2*1024*1024*1024;function Gr(t){let e;try{e=new URL(t,"http://cache.invalid/")}catch{return null}let a=Mf.exec(e.pathname);if(!a)return null;let[,s,r,n,i]=a.map(decodeURIComponent);if(i.split("/").some(c=>!c||c==="."||c===".."))return null;let o=e.searchParams.get("viewer")||"";return`${s}/${r}/${n}/${i}${o?`?viewer=${o}`:""}`}function is(t){return`a_${encodeURIComponent(t)}`}function Sf(t,e,{maxAgeMs:a=eo,maxBytes:s=to}={}){let r=new Set,n=[];for(let[o,c]of Object.entries(t))e-Number(c.lastUsed||0)<=a?n.push([o,c]):r.add(o);n.sort((o,c)=>Number(c[1].lastUsed)-Number(o[1].lastUsed));let i=0;for(let[o,c]of n)i+=Number(c.bytes||0),i>s&&r.add(o);return[...r]}var os=class t{static open(e={}){return t.shared||(t.shared=new t(e)),t.shared}constructor({maxAgeMs:e=eo,maxBytes:a=to}={}){this.maxAgeMs=e,this.maxBytes=a,this.stats={hits:0,misses:0,bypassed:0,cachedBytes:0,networkBytes:0,writeErrors:0},this.ready=this.init(),this.flushTimer=null}async init(){try{let e=globalThis.navigator?.storage;if(!e?.getDirectory)return null;let s=await(await e.getDirectory()).getDirectoryHandle(_f,{create:!0}),r=await s.getFileHandle(zr,{create:!0});if(typeof r.createWritable!="function")return null;let n={};try{let i=await(await r.getFile()).text();n=i?JSON.parse(i).entries||{}:{}}catch{n={}}return this.directory=s,this.entries=n,await this.prune(),globalThis.addEventListener?.("pagehide",()=>void this.flush()),s}catch{return null}}get enabled(){return!!this.directory}async fetchBytes(e,{store:a=!0,signal:s}={}){let r=Gr(e);if(await this.ready,r&&this.directory){let c=await this.read(r);if(c)return this.stats.hits+=1,this.stats.cachedBytes+=c.byteLength,c;this.stats.misses+=1}else this.stats.bypassed+=1;let n=await fetch(e,{cache:"no-store",signal:s});if(!n.ok)throw new Error(`Failed to load ${e}: ${n.status}`);let i=await n.arrayBuffer(),o=Number(n.headers.get("content-length")||0);return this.stats.networkBytes+=i.byteLength,a&&r&&this.directory&&(!o||o===i.byteLength)&&this.write(r,i),i}async fetchJson(e,a={}){let s=await this.fetchBytes(e,a);return JSON.parse(new TextDecoder().decode(s))}async peekJson(e){let a=Gr(e);if(await this.ready,!a||!this.directory)return null;let s=await this.read(a);return s?(this.stats.hits+=1,this.stats.cachedBytes+=s.byteLength,JSON.parse(new TextDecoder().decode(s))):null}async store(e,a){let s=Gr(e);await this.ready,s&&this.directory&&await this.write(s,a)}async read(e){let a=this.entries[e];if(!a)return null;try{let s=await(await this.directory.getFileHandle(is(e))).getFile();return s.size!==a.bytes?null:(a.lastUsed=Date.now(),this.scheduleFlush(),await s.arrayBuffer())}catch{return delete this.entries[e],null}}async write(e,a){try{let r=await(await this.directory.getFileHandle(is(e),{create:!0})).createWritable();await r.write(a),await r.close(),this.entries[e]={bytes:a.byteLength,lastUsed:Date.now()},this.scheduleFlush()}catch{this.stats.writeErrors+=1}}adopt(e,a){this.directory&&(this.entries[e]={bytes:a,lastUsed:Date.now()},this.scheduleFlush())}async prune(e=Date.now()){if(!this.directory)return[];let a=Sf(this.entries,e,{maxAgeMs:this.maxAgeMs,maxBytes:this.maxBytes});for(let r of a)delete this.entries[r],await this.directory.removeEntry(is(r)).catch(()=>{});let s=new Set(Object.keys(this.entries).map(is));for await(let r of this.directory.keys())r!==zr&&!s.has(r)&&await this.directory.removeEntry(r).catch(()=>{});return a.length&&await this.flush(),a}async clear(){await this.ready,this.directory&&(this.entries={},await this.prune(),await this.flush())}summary(){let e=Object.values(this.entries||{});return{enabled:this.enabled,files:e.length,bytes:e.reduce((a,s)=>a+Number(s.bytes||0),0),...this.stats}}scheduleFlush(){this.flushTimer||(this.flushTimer=setTimeout(()=>{this.flushTimer=null,this.flush()},1e3))}async flush(){if(this.directory)try{let a=await(await this.directory.getFileHandle(zr,{create:!0})).createWritable();await a.write(JSON.stringify({schema:"prism.bundle_cache_manifest.a0",entries:this.entries})),await a.close()}catch{this.stats.writeErrors+=1}}};function Af(t,e){if(!e)return t;let a=new URL(t);return a.searchParams.set("viewer",e),a.toString()}function ao(t,e,a,s){let r=new URL(a.asset_base||"./",e),n=structuredClone(t||{}),i=o=>!o||typeof o!="string"?o:Af(new URL(o,r).toString(),s);for(let o of["assets","semantic_gltf","schematic_world","schematic_vector","schematic_scene","bom"]){let c=n[o];if(!(!c||typeof c!="object"))for(let[l,f]of Object.entries(c))c[l]=i(f)}return n}function Kr(t){return(t?.readiness?.stage||"semantic-ready")==="semantic-ready"&&(t?.readiness?.progress??100)>=100}var he=(t,e,a)=>Math.max(e,Math.min(a,t)),ls=(t,e,a)=>t+(e-t)*a;function Ft(t,e){return[t[0]+e[0],t[1]+e[1],t[2]+e[2]]}function Rf(t,e){return[t[0]-e[0],t[1]-e[1],t[2]-e[2]]}function lt(t,e){return[t[0]*e,t[1]*e,t[2]*e]}function If(t){return Math.hypot(t[0],t[1],t[2])}function Bt(t){let e=If(t)||1;return lt(t,1/e)}function ma(t,e){return[t[1]*e[2]-t[2]*e[1],t[2]*e[0]-t[0]*e[2],t[0]*e[1]-t[1]*e[0]]}function cs(t,e){return t[0]*e[0]+t[1]*e[1]+t[2]*e[2]}function ds(t,e){let a=new Float32Array(16);for(let s=0;s<4;s+=1)for(let r=0;r<4;r+=1)a[s*4+r]=t[r]*e[s*4]+t[4+r]*e[s*4+1]+t[8+r]*e[s*4+2]+t[12+r]*e[s*4+3];return a}function us(t,e,a){let s=Bt(Rf(t,e)),r=Bt(ma(a,s)),n=ma(s,r);return new Float32Array([r[0],n[0],s[0],0,r[1],n[1],s[1],0,r[2],n[2],s[2],0,-cs(r,t),-cs(n,t),-cs(s,t),1])}function so(t,e,a,s){let r=1/Math.tan(t/2);return new Float32Array([r/e,0,0,0,0,r,0,0,0,0,a/(s-a),-1,0,0,a*s/(s-a),0])}function fs(t,e,a,s){return new Float32Array([2/t,0,0,0,0,2/e,0,0,0,0,1/(s-a),0,0,0,1,1])}function Vr(t){return[(t[0]+t[3])/2,(t[1]+t[4])/2,(t[2]+t[5])/2]}function Ot(t){return Math.max(.001,Math.hypot(t[3]-t[0],t[4]-t[1],t[5]-t[2])/2)}var hs=class{constructor(e){let a=Vr(e),s=Ot(e);this.focus=[...a],this.targetFocus=[...a],this.azimuth=-.62,this.targetAzimuth=this.azimuth,this.polar=.72,this.targetPolar=this.polar,this.distance=s*2.8,this.targetDistance=this.distance,this.orthoScale=s*2.15,this.targetOrthoScale=this.orthoScale,this.sceneRadius=s,this.fov=Math.PI/4}update(e){let a=1-Math.exp(-e*14);this.focus=this.focus.map((s,r)=>ls(s,this.targetFocus[r],a)),this.azimuth=no(this.azimuth,this.targetAzimuth,a),this.polar=no(this.polar,this.targetPolar,a),this.distance=ls(this.distance,this.targetDistance,a),this.orthoScale=ls(this.orthoScale,this.targetOrthoScale,a),this.settled()&&this.snap()}settled(){let e=Math.max(this.distance,1e-9),a=(s,r,n)=>Math.abs(s-r)<=n;return this.focus.every((s,r)=>a(s,this.targetFocus[r],1e-5*e))&&Math.abs(Math.atan2(Math.sin(this.targetAzimuth-this.azimuth),Math.cos(this.targetAzimuth-this.azimuth)))<=1e-5&&Math.abs(Math.atan2(Math.sin(this.targetPolar-this.polar),Math.cos(this.targetPolar-this.polar)))<=1e-5&&a(this.distance,this.targetDistance,1e-5*e)&&a(this.orthoScale,this.targetOrthoScale,1e-5*Math.max(this.orthoScale,1e-9))}snap(){this.focus=[...this.targetFocus],this.azimuth=this.targetAzimuth,this.polar=this.targetPolar,this.distance=this.targetDistance,this.orthoScale=this.targetOrthoScale}basis(){let e=Math.sin(this.polar),a=Math.cos(this.polar),s=Bt([e*Math.sin(this.azimuth),-e*Math.cos(this.azimuth),a]),r=Bt([Math.cos(this.azimuth),Math.sin(this.azimuth),0]),n=Bt(ma(s,r));return{right:r,up:n,back:s}}matrix(e,a,s=!1,r=1){let n=Math.max(.01,e/Math.max(1,a)),{up:i,back:o}=this.basis(),c=Ft(this.focus,lt(o,this.distance)),l=us(c,this.focus,i),f=s?fs(this.orthoScale*r*n,this.orthoScale*r,-this.sceneRadius*40,this.sceneRadius*40):so(this.fov,n,Math.max(this.sceneRadius*5e-4,this.distance-this.sceneRadius*3.5),this.distance+this.sceneRadius*4.5);return ds(f,l)}targetMatrix(e,a,s=!1,r=0){let n=(l,f)=>f+(f-l)*r,i=[this.focus,this.azimuth,this.polar,this.distance,this.orthoScale];this.focus=this.focus.map((l,f)=>n(l,this.targetFocus[f]));let o=(l,f)=>f+Math.atan2(Math.sin(f-l),Math.cos(f-l))*r;this.azimuth=o(this.azimuth,this.targetAzimuth),this.polar=o(this.polar,this.targetPolar),this.distance=Math.max(this.sceneRadius*.001,n(this.distance,this.targetDistance)),this.orthoScale=Math.max(this.sceneRadius*.001,n(this.orthoScale,this.targetOrthoScale));let c=this.matrix(e,a,s);return[this.focus,this.azimuth,this.polar,this.distance,this.orthoScale]=i,c}moving(){let e=(a,s)=>Math.abs(a-s)<=Math.max(1e-9,Math.abs(s)*1e-4);return!(this.focus.every((a,s)=>e(a,this.targetFocus[s]))&&e(this.azimuth,this.targetAzimuth)&&e(this.polar,this.targetPolar)&&e(this.distance,this.targetDistance)&&e(this.orthoScale,this.targetOrthoScale))}orbit(e,a){let s=Math.sin(this.targetPolar)<0?-1:1;this.targetAzimuth-=s*e*.006,this.targetPolar=ro(this.targetPolar-a*.006)}isBelow(){return Math.cos(this.targetPolar)<0}pan(e,a,s,r=!1){let{right:n,up:i}=this.basis(),o=r?this.targetOrthoScale/Math.max(1,s):2*this.targetDistance*Math.tan(this.fov/2)/Math.max(1,s),c=Ft(lt(n,-e*o),lt(i,a*o));this.targetFocus=Ft(this.targetFocus,c)}dolly(e,a=!1){let s=Math.exp(e*.0032);a?this.targetOrthoScale=he(this.targetOrthoScale*s,this.sceneRadius*.008,this.sceneRadius*24):this.targetDistance=he(this.targetDistance*s,this.sceneRadius*.01,this.sceneRadius*48)}frame(e){if(!e)return;let a=Ot(e);this.targetFocus=Vr(e),this.targetDistance=Math.max(a*2.8,this.sceneRadius*.02),this.targetOrthoScale=Math.max(a*2.15,this.sceneRadius*.02)}setFocus(e){this.targetFocus=[...e]}setAxis(e,a=!1){e==="z"?(this.targetAzimuth=0,this.targetPolar=a?Math.PI-.015:.015):e==="x"?(this.targetAzimuth=a?-Math.PI/2:Math.PI/2,this.targetPolar=Math.PI/2):(this.targetAzimuth=a?0:Math.PI,this.targetPolar=Math.PI/2)}rotateZ(e=1){this.targetAzimuth+=e*Math.PI/2}flip(){this.targetPolar=ro(Math.PI-this.targetPolar)}};function ro(t){return Math.atan2(Math.sin(t),Math.cos(t))}function no(t,e,a){let s=Math.atan2(Math.sin(e-t),Math.cos(e-t));return t+s*a}var bs=class t{static async create(e,a,s={}){let r=await fetch(a,{cache:"default"});if(!r.ok)throw new Error(`Failed to load BoM ${a}: ${r.status}`);let n=await r.json();if(n.schema!=="prism.bom_a0")throw new Error(`Unsupported BoM schema: ${n.schema||"missing"}`);let i=new t(e,n,s);return i.render(),i}constructor(e,a,s){this.container=e,this.payload=a,this.callbacks=s,this.query="",this.selectedRowId="",this.selectedReference="",this.rowsById=new Map((a.rows||[]).map(r=>[r.id,r])),this.componentIndex=new Map(Object.entries(a.componentIndex||{}))}setSelectionByReference(e,a={}){let s=this.componentIndex.get(e);s&&(this.selectedReference=e,this.selectedRowId=s.rowId,this.renderContent(),a.scroll&&this.container.querySelector(`[data-row-id="${Bf(s.rowId)}"]`)?.scrollIntoView({block:"center",behavior:"smooth"}))}clearSelection(){this.selectedReference="",this.selectedRowId="",this.renderContent()}render(){let e=this.filteredRows();this.container.innerHTML=`
      <section class="bom-workspace">
        <header class="bom-toolbar">
          <div>
            <p class="eyebrow">Prism BoM A0</p>
            <h2>Bill of Materials</h2>
            <span data-bom-count>${e.length} of ${(this.payload.rows||[]).length} grouped rows \xB7 ${(this.payload.components||[]).length} components</span>
          </div>
          <label class="bom-search">
            <span>Search</span>
            <input id="bom-search" type="search" value="${Ue(this.query)}" placeholder="Reference, value, footprint, manufacturer..." />
          </label>
        </header>
        <div class="bom-content" data-bom-content>
          ${this.contentHtml(e,this.payload.displayColumns||[])}
        </div>
      </section>
    `,this.bind()}renderContent(){let e=this.container.querySelector("[data-bom-content]");if(!e){this.render();return}let a=this.filteredRows();e.innerHTML=this.contentHtml(a,this.payload.displayColumns||[]);let s=this.container.querySelector("[data-bom-count]");s&&(s.textContent=`${a.length} of ${(this.payload.rows||[]).length} grouped rows \xB7 ${(this.payload.components||[]).length} components`),this.bindContent(e)}contentHtml(e,a){let s=this.rowsById.get(this.selectedRowId);return`
      <div class="bom-table-wrap">
        <table class="bom-table">
          <thead>
            <tr>${a.map(r=>`<th>${Ue(r)}</th>`).join("")}</tr>
          </thead>
          <tbody>
            ${e.map(r=>this.rowHtml(r,a)).join("")}
          </tbody>
        </table>
      </div>
      ${s?`<aside class="bom-detail">${this.detailHtml(s)}</aside>`:""}
    `}filteredRows(){let e=this.query.trim().toLowerCase(),a=this.payload.rows||[];return e?a.filter(s=>JSON.stringify(s).toLowerCase().includes(e)):a}rowHtml(e,a){return`
      <tr class="${e.id===this.selectedRowId?"selected":""}" data-row-id="${Ue(e.id)}">
        ${a.map(r=>{let n=e.fields?.[r]||"";return r==="Reference"?`<td class="bom-reference-cell">${(e.references||[]).map(i=>`
              <button class="bom-ref-chip ${i===this.selectedReference?"active":""}" data-reference="${Ue(i)}">${Ue(i)}</button>
            `).join("")}</td>`:!n&&Cf(r)?'<td><span class="bom-missing">Missing</span></td>':`<td title="${Ue(n)}">${Ue(n)}</td>`}).join("")}
      </tr>
    `}detailHtml(e){let a=Nf(e,this.payload.displayColumns||[],this.payload.extraColumns||[]);return`
      <div class="bom-detail-head">
        <p class="eyebrow">Line item</p>
        <h3>${Ue((e.references||[]).join(", "))}</h3>
        <span>${e.qty} component${e.qty===1?"":"s"}${e.dnp?" \xB7 DNP":""}</span>
      </div>
      <div class="bom-ref-list">
        ${(e.references||[]).map(s=>`
          <button class="bom-ref-chip detail ${s===this.selectedReference?"active":""}" data-reference="${Ue(s)}">${Ue(s)}</button>
        `).join("")}
      </div>
      <dl class="bom-field-list">
        ${a.map(([s,r])=>`
          <div>
            <dt>${Ue(s)}</dt>
            <dd>${Ue(r)}</dd>
          </div>
        `).join("")}
      </dl>
    `}bind(){let e=this.container.querySelector("#bom-search");e?.addEventListener("input",()=>{this.query=e.value,this.renderContent()}),this.bindContent(this.container)}bindContent(e){e.querySelectorAll("[data-row-id]").forEach(a=>{a.addEventListener("click",s=>{s.target.closest("[data-reference]")||(this.selectedRowId=a.dataset.rowId,this.selectedReference="",this.renderContent())})}),e.querySelectorAll("[data-reference]").forEach(a=>{a.addEventListener("click",s=>{s.stopPropagation();let r=a.dataset.reference;this.setSelectionByReference(r),this.callbacks.onSelectReference?.(r)})})}};function Nf(t,e,a){let s=[],r=new Set(["Reference","Qty"].map(Hr));for(let i of e){if(i==="Reference"||i==="Qty")continue;let o=t.fields?.[i]||"";o&&(s.push([i,o]),r.add(Hr(i)))}let n=t.canonicalFields||{};for(let i of a){let o=n[i]||"";if(!o)continue;let c=Hr(i);r.has(c)||(r.add(c),s.push([i,o]))}return s}function Hr(t){return String(t||"").toLowerCase().replace(/[\s_\-()[\]/]+/g,"")}function Cf(t){return["Manufacturer Part Number","Vendor Part Number","Datasheet","Footprint","Value"].includes(t)}function Ue(t){return String(t??"").replace(/[&<>"']/g,e=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[e])}function Bf(t){return String(t).replace(/["\\]/g,"\\$&")}function io(t,e=new Map){let a=new Map;for(let r of t||[]){let n=String(r?.designator||"");if(!n)continue;let i=a.get(n)||{reference:n,featureIds:new Set,modelCount:0},o=Number(r?.featureId)||0;o>0&&i.featureIds.add(o),a.set(n,i)}for(let[r,n]of e||[]){let i=a.get(String(r));i&&(i.modelCount=Math.max(i.modelCount,Number(n)||0))}let s=new Map;for(let[r,n]of a)s.set(r,{reference:r,featureIds:[...n.featureIds].sort((i,o)=>i-o),ambiguous:n.featureIds.size>1||n.modelCount>1});return s}function oo(t,e){let a=[...new Set((Array.isArray(t)?t:[]).map(c=>String(c||"")).filter(Boolean))],s=[],r=[],n=[],i=new Set,o=new Set;for(let c of a){let l=e.get(c);if(!l){n.push(c);continue}if(l.ambiguous){r.push(c);continue}s.push(c),o.add(c);for(let f of l.featureIds)i.add(f)}return{requested:a,applied:s,ambiguous:r,unknown:n,hiddenFeatureIds:i,hiddenReferences:o}}function ps(t,e){return!!t&&e.has(String(t))}var Ff={"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"};function G(t){return String(t??"").replace(/[&<>"']/g,e=>Ff[e])}var ya=`
fn netEmphasized(id: u32) -> bool {
  return id != 0u && id < arrayLength(&netMask) && netMask[id] != 0u;
}
`;function gs(t){let e=new Set;if(t==null)return e;for(let a of t){let s=Number(a);!Number.isInteger(s)||s<=0||s>4294967295||e.add(s)}return e}function co(t,e=0){let a=0;for(let r of gs(t))a=Math.max(a,r);let s=64;for(;s<a+1;)s*=2;return Math.max(s,Math.floor(e)||0)}function lo(t,e){let a=Math.max(64,Math.floor(e)||0),s=new Uint32Array(a);s.fill(0);for(let r of gs(t))r<a&&(s[r]=1);return s}function Xt(t,e){return!Array.isArray(t)||!e?null:t.find(a=>a.name===e||Array.isArray(a.aliases)&&a.aliases.includes(e))||null}function uo(t,e){let a=new Set;if(!Array.isArray(t)||!Array.isArray(e))return a;for(let s of e){if(!s)continue;let r=s.netUid&&t.find(i=>i.uid===s.netUid)||s.netName&&Xt(t,s.netName),n=Number(r?.id);Number.isInteger(n)&&n>0&&a.add(n)}return a}var Jx=Object.freeze([[.08,1,.2],[1,.72,.1],[.2,.75,1],[1,.3,.75],[.65,.45,1],[1,.45,.2],[.3,1,.85],[.95,.95,.3]]),fo=`
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
`;function ho(t){let e=1;for(let s of t)for(let r of s?.keys()||[])e=Math.max(e,r+1);let a=new Uint32Array(Math.max(64,t.length*e));return t.forEach((s,r)=>{for(let[n,i]of s||[])Number.isInteger(n)&&n>0&&(a[r*e+n]=i>>>0)}),{stride:e,data:a}}function Of(t){return(typeof t.composedPath=="function"?t.composedPath():[])[0]??t.target??null}function bo(t){let e=Of(t);if(!e||typeof e!="object")return!1;let a=typeof e.tagName=="string"?e.tagName.toUpperCase():"";return a==="INPUT"||a==="TEXTAREA"||a==="SELECT"||e.isContentEditable===!0}function po(t){return!!(t.metaKey||t.ctrlKey)}var Pf=4;function go(t,e=Pf){let a=new Map,s=[];for(let n of t){if(n.placements.length<e){for(let o of n.placements)s.push(jf(n.primitive,o));continue}let i=`${n.placements.map(o=>o.node).join(",")}|${JSON.stringify(n.primitive.material)}`;a.has(i)||a.set(i,[]),a.get(i).push(n)}return{instanced:[...a.values()].map(n=>({primitive:Lf(n.map(i=>i.primitive)),placements:n[0].placements})),baked:rs(s)}}function jf(t,e){let{rows:a,featureId:s,bounds:r}=e,n=t.position.length/3,i=new Float32Array(n*3),o=new Float32Array(n*3),c=new Uint32Array(n);for(let l=0;l<n;l+=1){let f=l*3,[u,g,p]=[t.position[f],t.position[f+1],t.position[f+2]],[h,d,m]=[t.normal[f],t.normal[f+1],t.normal[f+2]],b=0;for(let y=0;y<3;y+=1){let x=y*4;i[f+y]=a[x]*u+a[x+1]*g+a[x+2]*p+a[x+3],o[f+y]=a[x]*h+a[x+1]*d+a[x+2]*m,b+=o[f+y]**2}b=Math.sqrt(b)||1;for(let y=0;y<3;y+=1)o[f+y]/=b;c[l]=t.objectFeatureId[l]||s||0}return{position:i,normal:o,netId:t.netId,objectFeatureId:c,indices:t.indices,material:t.material,bounds:[...r]}}function Lf(t){if(t.length===1)return t[0];let e=t.reduce((u,g)=>u+g.position.length/3,0),a=t.reduce((u,g)=>u+g.indices.length,0),s=new Float32Array(e*3),r=new Float32Array(e*3),n=new Uint32Array(e),i=new Uint32Array(e),o=new Uint32Array(a),c=[1/0,1/0,1/0,-1/0,-1/0,-1/0],l=0,f=0;for(let u of t){s.set(u.position,l*3),r.set(u.normal,l*3),n.set(u.netId,l),i.set(u.objectFeatureId,l);for(let g=0;g<u.indices.length;g+=1)o[f+g]=u.indices[g]+l;for(let g=0;g<3;g+=1)c[g]=Math.min(c[g],u.bounds[g]),c[g+3]=Math.max(c[g+3],u.bounds[g+3]);l+=u.position.length/3,f+=u.indices.length}return{position:s,normal:r,netId:n,objectFeatureId:i,indices:o,material:t[0].material,bounds:c}}var mo=class{_listeners={};addEventListener(t,e){let a=this._listeners;return a[t]===void 0&&(a[t]=[]),a[t].indexOf(e)===-1&&a[t].push(e),this}removeEventListener(t,e){let a=this._listeners[t];if(a!==void 0){let s=a.indexOf(e);s!==-1&&a.splice(s,1)}return this}dispatchEvent(t){let e=this._listeners[t.type];if(e!==void 0){let a=e.slice(0);for(let s=0,r=a.length;s<r;s++)a[s].call(this,t)}return this}dispose(){for(let t in this._listeners)delete this._listeners[t]}},ut=class{_disposed=!1;_name;_parent;_child;_attributes;constructor(t,e,a,s={}){if(this._name=t,this._parent=e,this._child=a,this._attributes=s,!e.isOnGraph(a))throw new Error("Cannot connect disconnected graphs.")}getName(){return this._name}getParent(){return this._parent}getChild(){return this._child}setChild(t){return this._child=t,this}getAttributes(){return this._attributes}dispose(){this._disposed||(this._parent._destroyRef(this),this._disposed=!0)}isDisposed(){return this._disposed}},qr=class extends mo{_emptySet=new Set;_edges=new Set;_parentEdges=new Map;_childEdges=new Map;listEdges(){return Array.from(this._edges)}listParentEdges(t){return Array.from(this._childEdges.get(t)||this._emptySet)}listParents(t){let e=new Set;for(let a of this.listParentEdges(t))e.add(a.getParent());return Array.from(e)}listChildEdges(t){return Array.from(this._parentEdges.get(t)||this._emptySet)}listChildren(t){let e=new Set;for(let a of this.listChildEdges(t))e.add(a.getChild());return Array.from(e)}disconnectParents(t,e){for(let a of this.listParentEdges(t))(!e||e(a.getParent()))&&a.dispose();return this}_createEdge(t,e,a,s){let r=new ut(t,e,a,s);this._edges.add(r);let n=r.getParent();this._parentEdges.has(n)||this._parentEdges.set(n,new Set),this._parentEdges.get(n).add(r);let i=r.getChild();return this._childEdges.has(i)||this._childEdges.set(i,new Set),this._childEdges.get(i).add(r),r}_destroyEdge(t){return this._edges.delete(t),this._parentEdges.get(t.getParent()).delete(t),this._childEdges.get(t.getChild()).delete(t),this}},_e=class{list=[];constructor(t){if(t)for(let e of t)this.list.push(e)}add(t){this.list.push(t)}remove(t){let e=this.list.indexOf(t);e>=0&&this.list.splice(e,1)}removeChild(t){let e=[];for(let a of this.list)a.getChild()===t&&e.push(a);for(let a of e)this.remove(a);return e}listRefsByChild(t){let e=[];for(let a of this.list)a.getChild()===t&&e.push(a);return e}values(){return this.list}},oe=class{set=new Set;map=new Map;constructor(t){if(t)for(let e of t)this.add(e)}add(t){let e=t.getChild();this.removeChild(e),this.set.add(t),this.map.set(e,t)}remove(t){this.set.delete(t),this.map.delete(t.getChild())}removeChild(t){let e=this.map.get(t)||null;return e&&this.remove(e),e}getRefByChild(t){return this.map.get(t)||null}values(){return Array.from(this.set)}},xe=class{map={};constructor(t){t&&Object.assign(this.map,t)}set(t,e){this.map[t]=e}delete(t){delete this.map[t]}get(t){return this.map[t]||null}keys(){return Object.keys(this.map)}values(){return Object.values(this.map)}},ee=Symbol("attributes"),dt=Symbol("immutableKeys"),yo=class xo extends mo{_disposed=!1;graph;[ee];[dt];constructor(e){super(),this.graph=e,this[dt]=new Set,this[ee]=this._createAttributes()}getDefaults(){return{}}_createAttributes(){let e=this.getDefaults(),a={};for(let s in e){let r=e[s];if(r instanceof xo){let n=this.graph._createEdge(s,this,r);this[dt].add(s),a[s]=n}else a[s]=r}return a}isOnGraph(e){return this.graph===e.graph}isDisposed(){return this._disposed}dispose(){this._disposed||(this.graph.listChildEdges(this).forEach(e=>e.dispose()),this.graph.disconnectParents(this),this._disposed=!0,this.dispatchEvent({type:"dispose"}))}detach(){return this.graph.disconnectParents(this),this}swap(e,a){for(let s in this[ee]){let r=this[ee][s];if(r instanceof ut){let n=r;n.getChild()===e&&this.setRef(s,a,n.getAttributes())}else if(r instanceof _e)for(let n of r.listRefsByChild(e)){let i=n.getAttributes();this.removeRef(s,e),this.addRef(s,a,i)}else if(r instanceof oe){let n=r.getRefByChild(e);if(n){let i=n.getAttributes();this.removeRef(s,e),this.addRef(s,a,i)}}else if(r instanceof xe)for(let n of r.keys()){let i=r.get(n);i.getChild()===e&&this.setRefMap(s,n,a,i.getAttributes())}}return this}get(e){return this[ee][e]}set(e,a){return this[ee][e]=a,this.dispatchEvent({type:"change",attribute:e})}getRef(e){let a=this[ee][e];return a?a.getChild():null}setRef(e,a,s){if(this[dt].has(e))throw new Error(`Cannot overwrite immutable attribute, "${e}".`);let r=this[ee][e];if(r&&r.dispose(),!a)return this;let n=this.graph._createEdge(e,this,a,s);return this[ee][e]=n,this.dispatchEvent({type:"change",attribute:e})}listRefs(e){return this.assertRefList(e).values().map(a=>a.getChild())}addRef(e,a,s){let r=this.graph._createEdge(e,this,a,s);return this.assertRefList(e).add(r),this.dispatchEvent({type:"change",attribute:e})}removeRef(e,a){let s=this.assertRefList(e);if(s instanceof _e)for(let r of s.listRefsByChild(a))r.dispose();else{let r=s.getRefByChild(a);r&&r.dispose()}return this}assertRefList(e){let a=this[ee][e];if(a instanceof _e||a instanceof oe)return a;throw new Error(`Expected RefList or RefSet for attribute "${e}"`)}listRefMapKeys(e){return this.assertRefMap(e).keys()}listRefMapValues(e){return this.assertRefMap(e).values().map(a=>a.getChild())}getRefMap(e,a){let s=this.assertRefMap(e).get(a);return s?s.getChild():null}setRefMap(e,a,s,r){let n=this.assertRefMap(e),i=n.get(a);if(i&&i.dispose(),!s)return this;r=Object.assign(r||{},{key:a});let o=this.graph._createEdge(e,this,s,{...r,key:a});return n.set(a,o),this.dispatchEvent({type:"change",attribute:e,key:a})}assertRefMap(e){let a=this[ee][e];if(a instanceof xe)return a;throw new Error(`Expected RefMap for attribute "${e}"`)}dispatchEvent(e){return super.dispatchEvent({...e,target:this}),this.graph.dispatchEvent({...e,target:this,type:`node:${e.type}`}),this}_destroyRef(e){let a=e.getName();if(this[ee][a]===e)this[ee][a]=null,this[dt].has(a)&&e.getChild().dispose();else if(this[ee][a]instanceof _e)this[ee][a].remove(e);else if(this[ee][a]instanceof oe)this[ee][a].remove(e);else if(this[ee][a]instanceof xe){let s=this[ee][a];for(let r of s.keys())s.get(r)===e&&s.delete(r)}else return;this.graph._destroyEdge(e),this.dispatchEvent({type:"change",attribute:a})}};var _o="v4.4.2",ht="@glb.bin",F=(function(t){return t.ACCESSOR="Accessor",t.ANIMATION="Animation",t.ANIMATION_CHANNEL="AnimationChannel",t.ANIMATION_SAMPLER="AnimationSampler",t.BUFFER="Buffer",t.CAMERA="Camera",t.MATERIAL="Material",t.MESH="Mesh",t.PRIMITIVE="Primitive",t.PRIMITIVE_TARGET="PrimitiveTarget",t.NODE="Node",t.ROOT="Root",t.SCENE="Scene",t.SKIN="Skin",t.TEXTURE="Texture",t.TEXTURE_INFO="TextureInfo",t})({});var Df=(function(t){return t.ARRAY_BUFFER="ARRAY_BUFFER",t.ELEMENT_ARRAY_BUFFER="ELEMENT_ARRAY_BUFFER",t.INVERSE_BIND_MATRICES="INVERSE_BIND_MATRICES",t.OTHER="OTHER",t.SPARSE="SPARSE",t})({}),qe=(function(t){return t[t.R=4096]="R",t[t.G=256]="G",t[t.B=16]="B",t[t.A=1]="A",t})({});var Uf=class extends Float32Array{constructor(){throw super(),new Error("Unsupported typed array instantiation.")}},Ts={5120:Int8Array,5121:Uint8Array,5122:Int16Array,5123:Uint16Array,5125:Uint32Array,5131:typeof Float16Array<"u"?Float16Array:Uf,5126:Float32Array,5130:Float64Array},H=class{static createBufferFromDataURI(t){if(typeof Buffer>"u"){let e=atob(t.split(",")[1]),a=new Uint8Array(e.length);for(let s=0;s<e.length;s++)a[s]=e.charCodeAt(s);return a}else{let e=t.split(",")[1],a=t.indexOf("base64")>=0;return Buffer.from(e,a?"base64":"utf8")}}static encodeText(t){return new TextEncoder().encode(t)}static decodeText(t){return new TextDecoder().decode(t)}static concat(t){let e=0;for(let r of t)e+=r.byteLength;let a=new Uint8Array(e),s=0;for(let r of t)a.set(r,s),s+=r.byteLength;return a}static pad(t,e=0){let a=this.padNumber(t.byteLength);if(a===t.byteLength)return t;let s=new Uint8Array(a);if(s.set(t),e!==0)for(let r=t.byteLength;r<a;r++)s[r]=e;return s}static padNumber(t){return Math.ceil(t/4)*4}static equals(t,e){if(t===e)return!0;if(t.byteLength!==e.byteLength)return!1;let a=t.byteLength;for(;a--;)if(t[a]!==e[a])return!1;return!0}static toView(t,e=0,a=1/0){return new Uint8Array(t.buffer,t.byteOffset+e,Math.min(t.byteLength,a))}static assertView(t){if(t&&!ArrayBuffer.isView(t))throw new Error(`Method requires Uint8Array parameter; received "${typeof t}".`);return t}};var zf=class{match(t){return t.length>=3&&t[0]===255&&t[1]===216&&t[2]===255}getSize(t){let e=new DataView(t.buffer,t.byteOffset+4),a,s;for(;e.byteLength;){if(a=e.getUint16(0,!1),Kf(e,a),s=e.getUint8(a+1),s===192||s===193||s===194)return[e.getUint16(a+7,!1),e.getUint16(a+5,!1)];e=new DataView(t.buffer,e.byteOffset+a+2)}throw new TypeError("Invalid JPG, no size found")}getChannels(t){return 3}},Gf=class So{static PNG_FRIED_CHUNK_NAME="CgBI";match(e){return e.length>=8&&e[0]===137&&e[1]===80&&e[2]===78&&e[3]===71&&e[4]===13&&e[5]===10&&e[6]===26&&e[7]===10}getSize(e){let a=new DataView(e.buffer,e.byteOffset);return H.decodeText(e.slice(12,16))===So.PNG_FRIED_CHUNK_NAME?[a.getUint32(32,!1),a.getUint32(36,!1)]:[a.getUint32(16,!1),a.getUint32(20,!1)]}getChannels(e){return 4}},Ze=class{static impls={"image/jpeg":new zf,"image/png":new Gf};static registerFormat(t,e){this.impls[t]=e}static getMimeType(t){for(let e in this.impls)if(this.impls[e].match(t))return e;return null}static getSize(t,e){return this.impls[e]?this.impls[e].getSize(t):null}static getChannels(t,e){return this.impls[e]?this.impls[e].getChannels(t):null}static getVRAMByteLength(t,e){if(!this.impls[e])return null;if(this.impls[e].getVRAMByteLength)return this.impls[e].getVRAMByteLength(t);let a=0,s=4,r=this.getSize(t,e);if(!r)return null;for(;r[0]>1||r[1]>1;)a+=r[0]*r[1]*s,r[0]=Math.max(Math.floor(r[0]/2),1),r[1]=Math.max(Math.floor(r[1]/2),1);return a+=1*s,a}static mimeTypeToExtension(t){return t==="image/jpeg"?"jpg":t.split("/").pop()}static extensionToMimeType(t){return t==="jpg"?"image/jpeg":t?`image/${t}`:""}};function Kf(t,e){if(e>t.byteLength)throw new TypeError("Corrupt JPG, exceeded buffer limits");if(t.getUint8(e)!==255)throw new TypeError("Invalid JPG, marker table corrupted");return t}var $t=class{static basename(t){let e=t.split(/[\\/]/).pop();return e.substring(0,e.lastIndexOf("."))}static extension(t){if(t.startsWith("data:image/")){let e=t.match(/data:(image\/\w+)/)[1];return Ze.mimeTypeToExtension(e)}else{if(t.startsWith("data:model/gltf+json"))return"gltf";if(t.startsWith("data:model/gltf-binary"))return"glb";if(t.startsWith("data:application/"))return"bin"}return t.split(/[\\/]/).pop().split(/[.]/).pop()}},$r=typeof Float32Array<"u"?Float32Array:Array;Math.PI/180;180/Math.PI;function Vf(){var t=new $r(3);return $r!=Float32Array&&(t[0]=0,t[1]=0,t[2]=0),t}function Wr(t){var e=t[0],a=t[1],s=t[2];return Math.sqrt(e*e+a*a+s*s)}function Hf(t,e,a){var s=e[0],r=e[1],n=e[2],i=a[3]*s+a[7]*r+a[11]*n+a[15];return i=i||1,t[0]=(a[0]*s+a[4]*r+a[8]*n+a[12])/i,t[1]=(a[1]*s+a[5]*r+a[9]*n+a[13])/i,t[2]=(a[2]*s+a[6]*r+a[10]*n+a[14])/i,t}(function(){var t=Vf();return function(e,a,s,r,n,i){var o,c;for(a||(a=3),s||(s=0),r?c=Math.min(r*a+s,e.length):c=e.length,o=s;o<c;o+=a)t[0]=e[o],t[1]=e[o+1],t[2]=e[o+2],n(t,t,i),e[o]=t[0],e[o+1]=t[1],e[o+2]=t[2];return e}})();function Ao(t){let e=Ro(),a=t.propertyType==="Node"?[t]:t.listChildren();for(let s of a)s.traverse(r=>{let n=r.getMesh();if(!n)return;let i=qf(n,r.getWorldMatrix());i.min.every(isFinite)&&i.max.every(isFinite)&&(Yr(i.min,e),Yr(i.max,e))});return e}function qf(t,e){let a=Ro();for(let s of t.listPrimitives()){let r=s.getAttribute("POSITION"),n=s.getIndices();if(!r)continue;let i=[0,0,0],o=[0,0,0];for(let c=0,l=n?n.getCount():r.getCount();c<l;c++){let f=n?n.getScalar(c):c;i=r.getElement(f,i),o=Hf(o,i,e),Yr(o,a)}}return a}function Yr(t,e){for(let a=0;a<3;a++)e.min[a]=Math.min(t[a],e.min[a]),e.max[a]=Math.max(t[a],e.max[a])}function Ro(){return{min:[1/0,1/0,1/0],max:[-1/0,-1/0,-1/0]}}var wo="https://null.example",Xr=class{static DEFAULT_INIT={};static PROTOCOL_REGEXP=/^[a-zA-Z]+:\/\//;static dirname(t){let e=t.lastIndexOf("/");return e===-1?"./":t.substring(0,e+1)}static basename(t){return $t.basename(new URL(t,wo).pathname)}static extension(t){return $t.extension(new URL(t,wo).pathname)}static resolve(t,e){if(!this.isRelativePath(e))return e;let a=t.split("/"),s=e.split("/");a.pop();for(let r=0;r<s.length;r++)s[r]!=="."&&(s[r]===".."?a.pop():a.push(s[r]));return a.join("/")}static isAbsoluteURL(t){return this.PROTOCOL_REGEXP.test(t)}static isRelativePath(t){return!/^(?:[a-zA-Z]+:)?\//.test(t)}};function vo(t){return Object.prototype.toString.call(t)==="[object Object]"}function Pt(t){if(vo(t)===!1)return!1;let e=t.constructor;if(e===void 0)return!0;let a=e.prototype;return!(vo(a)===!1||Object.hasOwn(a,"isPrototypeOf")===!1)}var Wf=(function(t){return t[t.SILENT=4]="SILENT",t[t.ERROR=3]="ERROR",t[t.WARN=2]="WARN",t[t.INFO=1]="INFO",t[t.DEBUG=0]="DEBUG",t})({}),Ms=class Io{verbosity;static Verbosity=Wf;static DEFAULT_INSTANCE=new Io(1);constructor(e){this.verbosity=e}debug(e){this.verbosity<=0&&console.debug(e)}info(e){this.verbosity<=1&&console.info(e)}warn(e){this.verbosity<=2&&console.warn(e)}error(e){this.verbosity<=3&&console.error(e)}};function Xf(t){var e=t[0],a=t[1],s=t[2],r=t[3],n=t[4],i=t[5],o=t[6],c=t[7],l=t[8],f=t[9],u=t[10],g=t[11],p=t[12],h=t[13],d=t[14],m=t[15],b=e*i-a*n,y=e*o-s*n,x=a*o-s*i,w=l*h-f*p,E=l*d-u*p,T=f*d-u*h,_=e*T-a*E+s*w,S=n*T-i*E+o*w,N=l*x-f*y+u*b,R=p*x-h*y+d*b;return c*_-r*S+m*N-g*R}function $f(t,e,a){var s=e[0],r=e[1],n=e[2],i=e[3],o=e[4],c=e[5],l=e[6],f=e[7],u=e[8],g=e[9],p=e[10],h=e[11],d=e[12],m=e[13],b=e[14],y=e[15],x=a[0],w=a[1],E=a[2],T=a[3];return t[0]=x*s+w*o+E*u+T*d,t[1]=x*r+w*c+E*g+T*m,t[2]=x*n+w*l+E*p+T*b,t[3]=x*i+w*f+E*h+T*y,x=a[4],w=a[5],E=a[6],T=a[7],t[4]=x*s+w*o+E*u+T*d,t[5]=x*r+w*c+E*g+T*m,t[6]=x*n+w*l+E*p+T*b,t[7]=x*i+w*f+E*h+T*y,x=a[8],w=a[9],E=a[10],T=a[11],t[8]=x*s+w*o+E*u+T*d,t[9]=x*r+w*c+E*g+T*m,t[10]=x*n+w*l+E*p+T*b,t[11]=x*i+w*f+E*h+T*y,x=a[12],w=a[13],E=a[14],T=a[15],t[12]=x*s+w*o+E*u+T*d,t[13]=x*r+w*c+E*g+T*m,t[14]=x*n+w*l+E*p+T*b,t[15]=x*i+w*f+E*h+T*y,t}function Yf(t,e){var a=e[0],s=e[1],r=e[2],n=e[4],i=e[5],o=e[6],c=e[8],l=e[9],f=e[10];return t[0]=Math.sqrt(a*a+s*s+r*r),t[1]=Math.sqrt(n*n+i*i+o*o),t[2]=Math.sqrt(c*c+l*l+f*f),t}function Jf(t,e){var a=new $r(3);Yf(a,e);var s=1/a[0],r=1/a[1],n=1/a[2],i=e[0]*s,o=e[1]*r,c=e[2]*n,l=e[4]*s,f=e[5]*r,u=e[6]*n,g=e[8]*s,p=e[9]*r,h=e[10]*n,d=i+f+h,m=0;return d>0?(m=Math.sqrt(d+1)*2,t[3]=.25*m,t[0]=(u-p)/m,t[1]=(g-c)/m,t[2]=(o-l)/m):i>f&&i>h?(m=Math.sqrt(1+i-f-h)*2,t[3]=(u-p)/m,t[0]=.25*m,t[1]=(o+l)/m,t[2]=(g+c)/m):f>h?(m=Math.sqrt(1+f-i-h)*2,t[3]=(g-c)/m,t[0]=(o+l)/m,t[1]=.25*m,t[2]=(u+p)/m):(m=Math.sqrt(1+h-i-f)*2,t[3]=(o-l)/m,t[0]=(g+c)/m,t[1]=(u+p)/m,t[2]=.25*m),t}var de=class xa{static identity(e){return e}static eq(e,a,s=1e-5){if(e.length!==a.length)return!1;for(let r=0;r<e.length;r++)if(Math.abs(e[r]-a[r])>s)return!1;return!0}static clamp(e,a,s){return e<a?a:e>s?s:e}static decodeNormalizedInt(e,a){switch(a){case 5126:return e;case 5123:return e/65535;case 5121:return e/255;case 5122:return Math.max(e/32767,-1);case 5120:return Math.max(e/127,-1);default:throw new Error("Invalid component type.")}}static encodeNormalizedInt(e,a){switch(a){case 5126:return e;case 5123:return Math.round(xa.clamp(e,0,1)*65535);case 5121:return Math.round(xa.clamp(e,0,1)*255);case 5122:return Math.round(xa.clamp(e,-1,1)*32767);case 5120:return Math.round(xa.clamp(e,-1,1)*127);default:throw new Error("Invalid component type.")}}static decompose(e,a,s,r){let n=Wr([e[0],e[1],e[2]]),i=Wr([e[4],e[5],e[6]]),o=Wr([e[8],e[9],e[10]]);Xf(e)<0&&(n=-n),a[0]=e[12],a[1]=e[13],a[2]=e[14];let c=e.slice(),l=1/n,f=1/i,u=1/o;c[0]*=l,c[1]*=l,c[2]*=l,c[4]*=f,c[5]*=f,c[6]*=f,c[8]*=u,c[9]*=u,c[10]*=u,Jf(s,c),r[0]=n,r[1]=i,r[2]=o}static compose(e,a,s,r){let n=r,i=a[0],o=a[1],c=a[2],l=a[3],f=i+i,u=o+o,g=c+c,p=i*f,h=i*u,d=i*g,m=o*u,b=o*g,y=c*g,x=l*f,w=l*u,E=l*g,T=s[0],_=s[1],S=s[2];return n[0]=(1-(m+y))*T,n[1]=(h+E)*T,n[2]=(d-w)*T,n[3]=0,n[4]=(h-E)*_,n[5]=(1-(p+y))*_,n[6]=(b+x)*_,n[7]=0,n[8]=(d+w)*S,n[9]=(b-x)*S,n[10]=(1-(p+m))*S,n[11]=0,n[12]=e[0],n[13]=e[1],n[14]=e[2],n[15]=1,n}};function Qf(t,e){if(!!t!=!!e)return!1;let a=t.getChild(),s=e.getChild();return a===s||a.equals(s)}function Zf(t,e){if(!!t!=!!e)return!1;let a=t.values(),s=e.values();if(a.length!==s.length)return!1;for(let r=0;r<a.length;r++){let n=a[r],i=s[r];if(n.getChild()!==i.getChild()&&!n.getChild().equals(i.getChild()))return!1}return!0}function eh(t,e){if(!!t!=!!e)return!1;let a=t.keys(),s=e.keys();if(a.length!==s.length)return!1;for(let r of a){let n=t.get(r),i=e.get(r);if(!!n!=!!i)return!1;let o=n.getChild(),c=i.getChild();if(o!==c&&!o.equals(c))return!1}return!0}function No(t,e){if(t===e)return!0;if(!!t!=!!e||!t||!e||t.length!==e.length)return!1;for(let a=0;a<t.length;a++)if(t[a]!==e[a])return!1;return!0}function Co(t,e){if(t===e)return!0;if(!!t!=!!e)return!1;if(!Pt(t)||!Pt(e))return t===e;let a=t,s=e,r=0,n=0,i;for(i in a)r++;for(i in s)n++;if(r!==n)return!1;for(i in a){let o=a[i],c=s[i];if(ks(o)&&ks(c)){if(!No(o,c))return!1}else if(Pt(o)&&Pt(c)){if(!Co(o,c))return!1}else if(o!==c)return!1}return!0}function ks(t){return Array.isArray(t)||ArrayBuffer.isView(t)}var th="23456789abdegjkmnpqrvwxyzABDEGJKMNPQRVWXYZ",ah=999,sh=6,ko=new Set,rh=function(){let t="";for(let e=0;e<sh;e++)t+=th.charAt(Math.floor(Math.random()*42));return t},nh=function(){for(let t=0;t<ah;t++){let e=rh();if(!ko.has(e))return ko.add(e),e}return""},bt=t=>t,ih=new Set,Zr=class extends yo{constructor(t,e=""){super(t),this[ee].name=e,this.init(),this.dispatchEvent({type:"create"})}getGraph(){return this.graph}getDefaults(){return Object.assign(super.getDefaults(),{name:"",extras:{}})}set(t,e){return Array.isArray(e)&&(e=e.slice()),super.set(t,e)}getName(){return this.get("name")}setName(t){return this.set("name",t)}getExtras(){return this.get("extras")}setExtras(t){return this.set("extras",t)}clone(){let t=this.constructor;return new t(this.graph).copy(this,bt)}copy(t,e=bt){for(let a in this[ee]){let s=this[ee][a];if(s instanceof ut)this[dt].has(a)||s.dispose();else if(s instanceof _e||s instanceof oe)for(let r of s.values())r.dispose();else if(s instanceof xe)for(let r of s.values())r.dispose()}for(let a in t[ee]){let s=this[ee][a],r=t[ee][a];if(r instanceof ut)this[dt].has(a)?s.getChild().copy(e(r.getChild()),e):this.setRef(a,e(r.getChild()),r.getAttributes());else if(r instanceof oe||r instanceof _e)for(let n of r.values())this.addRef(a,e(n.getChild()),n.getAttributes());else if(r instanceof xe)for(let n of r.keys()){let i=r.get(n);this.setRefMap(a,n,e(i.getChild()),i.getAttributes())}else Pt(r)?this[ee][a]=JSON.parse(JSON.stringify(r)):Array.isArray(r)||r instanceof ArrayBuffer||ArrayBuffer.isView(r)?this[ee][a]=r.slice():this[ee][a]=r}return this}equals(t,e=ih){if(this===t)return!0;if(this.propertyType!==t.propertyType)return!1;for(let a in this[ee]){if(e.has(a))continue;let s=this[ee][a],r=t[ee][a];if(s instanceof ut||r instanceof ut){if(!Qf(s,r))return!1}else if(s instanceof oe||r instanceof oe||s instanceof _e||r instanceof _e){if(!Zf(s,r))return!1}else if(s instanceof xe||r instanceof xe){if(!eh(s,r))return!1}else if(Pt(s)||Pt(r)){if(!Co(s,r))return!1}else if(ks(s)||ks(r)){if(!No(s,r))return!1}else if(s!==r)return!1}return!0}detach(){return this.graph.disconnectParents(this,t=>t.propertyType!=="Root"),this}listParents(){return this.graph.listParents(this)}},Ie=class extends Zr{getDefaults(){return Object.assign(super.getDefaults(),{extensions:new xe})}getExtension(t){return this.getRefMap("extensions",t)}setExtension(t,e){return e&&e._validateParent(this),this.setRefMap("extensions",t,e)}listExtensions(){return this.listRefMapValues("extensions")}},z=class we extends Ie{static Type={SCALAR:"SCALAR",VEC2:"VEC2",VEC3:"VEC3",VEC4:"VEC4",MAT2:"MAT2",MAT3:"MAT3",MAT4:"MAT4"};static ComponentType={BYTE:5120,UNSIGNED_BYTE:5121,SHORT:5122,UNSIGNED_SHORT:5123,UNSIGNED_INT:5125,FLOAT:5126,FLOAT16:5131,FLOAT64:5130};init(){this.propertyType="Accessor"}getDefaults(){return Object.assign(super.getDefaults(),{array:null,type:we.Type.SCALAR,componentType:we.ComponentType.FLOAT,normalized:!1,sparse:!1,buffer:null})}static getElementSize(e){switch(e){case we.Type.SCALAR:return 1;case we.Type.VEC2:return 2;case we.Type.VEC3:return 3;case we.Type.VEC4:return 4;case we.Type.MAT2:return 4;case we.Type.MAT3:return 9;case we.Type.MAT4:return 16;default:throw new Error("Unexpected type: "+e)}}static getComponentSize(e){switch(e){case we.ComponentType.BYTE:case we.ComponentType.UNSIGNED_BYTE:return 1;case we.ComponentType.SHORT:case we.ComponentType.UNSIGNED_SHORT:return 2;case we.ComponentType.UNSIGNED_INT:case we.ComponentType.FLOAT:return 4;case we.ComponentType.FLOAT16:return 2;case we.ComponentType.FLOAT64:return 8;default:throw new Error("Unexpected component type: "+e)}}getMinNormalized(e){let a=this.getNormalized(),s=this.getElementSize(),r=this.getComponentType();if(this.getMin(e),a)for(let n=0;n<s;n++)e[n]=de.decodeNormalizedInt(e[n],r);return e}getMin(e){let a=this.getArray(),s=this.getCount(),r=this.getElementSize();for(let n=0;n<r;n++)e[n]=1/0;for(let n=0;n<s*r;n+=r)for(let i=0;i<r;i++){let o=a[n+i];Number.isFinite(o)&&(e[i]=Math.min(e[i],o))}return e}getMaxNormalized(e){let a=this.getNormalized(),s=this.getElementSize(),r=this.getComponentType();if(this.getMax(e),a)for(let n=0;n<s;n++)e[n]=de.decodeNormalizedInt(e[n],r);return e}getMax(e){let a=this.get("array"),s=this.getCount(),r=this.getElementSize();for(let n=0;n<r;n++)e[n]=-1/0;for(let n=0;n<s*r;n+=r)for(let i=0;i<r;i++){let o=a[n+i];Number.isFinite(o)&&(e[i]=Math.max(e[i],o))}return e}getCount(){let e=this.get("array");return e?e.length/this.getElementSize():0}getType(){return this.get("type")}setType(e){return this.set("type",e)}getElementSize(){return we.getElementSize(this.get("type"))}getComponentSize(){return this.get("array").BYTES_PER_ELEMENT}getComponentType(){return this.get("componentType")}getNormalized(){return this.get("normalized")}setNormalized(e){return this.set("normalized",e)}getScalar(e){let a=this.getElementSize(),s=this.getComponentType(),r=this.getArray();return this.getNormalized()?de.decodeNormalizedInt(r[e*a],s):r[e*a]}setScalar(e,a){let s=this.getElementSize(),r=this.getComponentType(),n=this.getArray();return this.getNormalized()?n[e*s]=de.encodeNormalizedInt(a,r):n[e*s]=a,this}getElement(e,a){let s=this.getNormalized(),r=this.getElementSize(),n=this.getComponentType(),i=this.getArray();for(let o=0;o<r;o++)s?a[o]=de.decodeNormalizedInt(i[e*r+o],n):a[o]=i[e*r+o];return a}setElement(e,a){let s=this.getNormalized(),r=this.getElementSize(),n=this.getComponentType(),i=this.getArray();for(let o=0;o<r;o++)s?i[e*r+o]=de.encodeNormalizedInt(a[o],n):i[e*r+o]=a[o];return this}getSparse(){return this.get("sparse")}setSparse(e){return this.set("sparse",e)}getBuffer(){return this.getRef("buffer")}setBuffer(e){return this.setRef("buffer",e)}getArray(){return this.get("array")}setArray(e){return this.set("componentType",e?oh(e):we.ComponentType.FLOAT),this.set("array",e),this}getByteLength(){let e=this.get("array");return e?e.byteLength:0}};function oh(t){switch(t.constructor){case Float32Array:return z.ComponentType.FLOAT;case Uint32Array:return z.ComponentType.UNSIGNED_INT;case Uint16Array:return z.ComponentType.UNSIGNED_SHORT;case Uint8Array:return z.ComponentType.UNSIGNED_BYTE;case Int16Array:return z.ComponentType.SHORT;case Int8Array:return z.ComponentType.BYTE;case Float64Array:return z.ComponentType.FLOAT64}if(typeof Float16Array<"u"&&t.constructor===Float16Array)return z.ComponentType.FLOAT16;throw new Error("Unknown accessor componentType.")}var Bo=class extends Ie{init(){this.propertyType="Animation"}getDefaults(){return Object.assign(super.getDefaults(),{channels:new oe,samplers:new oe})}addChannel(t){return this.addRef("channels",t)}removeChannel(t){return this.removeRef("channels",t)}listChannels(){return this.listRefs("channels")}addSampler(t){return this.addRef("samplers",t)}removeSampler(t){return this.removeRef("samplers",t)}listSamplers(){return this.listRefs("samplers")}},en=class extends Ie{static TargetPath={TRANSLATION:"translation",ROTATION:"rotation",SCALE:"scale",WEIGHTS:"weights"};init(){this.propertyType="AnimationChannel"}getDefaults(){return Object.assign(super.getDefaults(),{targetPath:null,targetNode:null,sampler:null})}getTargetPath(){return this.get("targetPath")}setTargetPath(t){return this.set("targetPath",t)}getTargetNode(){return this.getRef("targetNode")}setTargetNode(t){return this.setRef("targetNode",t)}getSampler(){return this.getRef("sampler")}setSampler(t){return this.setRef("sampler",t)}},_s=class Fo extends Ie{static Interpolation={LINEAR:"LINEAR",STEP:"STEP",CUBICSPLINE:"CUBICSPLINE"};init(){this.propertyType="AnimationSampler"}getDefaultAttributes(){return Object.assign(super.getDefaults(),{interpolation:Fo.Interpolation.LINEAR,input:null,output:null})}getInterpolation(){return this.get("interpolation")}setInterpolation(e){return this.set("interpolation",e)}getInput(){return this.getRef("input")}setInput(e){return this.setRef("input",e,{usage:"OTHER"})}getOutput(){return this.getRef("output")}setOutput(e){return this.setRef("output",e,{usage:"OTHER"})}},Oo=class extends Ie{init(){this.propertyType="Buffer"}getDefaults(){return Object.assign(super.getDefaults(),{uri:""})}getURI(){return this.get("uri")}setURI(t){return this.set("uri",t)}},Ss=class Po extends Ie{static Type={PERSPECTIVE:"perspective",ORTHOGRAPHIC:"orthographic"};init(){this.propertyType="Camera"}getDefaults(){return Object.assign(super.getDefaults(),{type:Po.Type.PERSPECTIVE,znear:.1,zfar:100,aspectRatio:null,yfov:Math.PI*2*50/360,xmag:1,ymag:1})}getType(){return this.get("type")}setType(e){return this.set("type",e)}getZNear(){return this.get("znear")}setZNear(e){return this.set("znear",e)}getZFar(){return this.get("zfar")}setZFar(e){return this.set("zfar",e)}getAspectRatio(){return this.get("aspectRatio")}setAspectRatio(e){return this.set("aspectRatio",e)}getYFov(){return this.get("yfov")}setYFov(e){return this.set("yfov",e)}getXMag(){return this.get("xmag")}setXMag(e){return this.set("xmag",e)}getYMag(){return this.get("ymag")}setYMag(e){return this.set("ymag",e)}},$=class extends Zr{static EXTENSION_NAME;_validateParent(t){if(!this.parentTypes.includes(t.propertyType))throw new Error(`Parent "${t.propertyType}" invalid for child "${this.propertyType}".`)}},le=class Jr extends Ie{static WrapMode={CLAMP_TO_EDGE:33071,MIRRORED_REPEAT:33648,REPEAT:10497};static MagFilter={NEAREST:9728,LINEAR:9729};static MinFilter={NEAREST:9728,LINEAR:9729,NEAREST_MIPMAP_NEAREST:9984,LINEAR_MIPMAP_NEAREST:9985,NEAREST_MIPMAP_LINEAR:9986,LINEAR_MIPMAP_LINEAR:9987};init(){this.propertyType="TextureInfo"}getDefaults(){return Object.assign(super.getDefaults(),{texCoord:0,magFilter:null,minFilter:null,wrapS:Jr.WrapMode.REPEAT,wrapT:Jr.WrapMode.REPEAT})}getTexCoord(){return this.get("texCoord")}setTexCoord(e){return this.set("texCoord",e)}getMagFilter(){return this.get("magFilter")}setMagFilter(e){return this.set("magFilter",e)}getMinFilter(){return this.get("minFilter")}setMinFilter(e){return this.set("minFilter",e)}getWrapS(){return this.get("wrapS")}setWrapS(e){return this.set("wrapS",e)}getWrapT(){return this.get("wrapT")}setWrapT(e){return this.set("wrapT",e)}},{R:ms,G:ys,B:xs,A:ch}=qe,Es=class jo extends Ie{static AlphaMode={OPAQUE:"OPAQUE",MASK:"MASK",BLEND:"BLEND"};init(){this.propertyType="Material"}getDefaults(){return Object.assign(super.getDefaults(),{alphaMode:jo.AlphaMode.OPAQUE,alphaCutoff:.5,doubleSided:!1,baseColorFactor:[1,1,1,1],baseColorTexture:null,baseColorTextureInfo:new le(this.graph,"baseColorTextureInfo"),emissiveFactor:[0,0,0],emissiveTexture:null,emissiveTextureInfo:new le(this.graph,"emissiveTextureInfo"),normalScale:1,normalTexture:null,normalTextureInfo:new le(this.graph,"normalTextureInfo"),occlusionStrength:1,occlusionTexture:null,occlusionTextureInfo:new le(this.graph,"occlusionTextureInfo"),roughnessFactor:1,metallicFactor:1,metallicRoughnessTexture:null,metallicRoughnessTextureInfo:new le(this.graph,"metallicRoughnessTextureInfo")})}getDoubleSided(){return this.get("doubleSided")}setDoubleSided(e){return this.set("doubleSided",e)}getAlpha(){return this.get("baseColorFactor")[3]}setAlpha(e){let a=this.get("baseColorFactor").slice();return a[3]=e,this.set("baseColorFactor",a)}getAlphaMode(){return this.get("alphaMode")}setAlphaMode(e){return this.set("alphaMode",e)}getAlphaCutoff(){return this.get("alphaCutoff")}setAlphaCutoff(e){return this.set("alphaCutoff",e)}getBaseColorFactor(){return this.get("baseColorFactor")}setBaseColorFactor(e){return this.set("baseColorFactor",e)}getBaseColorTexture(){return this.getRef("baseColorTexture")}getBaseColorTextureInfo(){return this.getRef("baseColorTexture")?this.getRef("baseColorTextureInfo"):null}setBaseColorTexture(e){return this.setRef("baseColorTexture",e,{channels:ms|ys|xs|ch,isColor:!0})}getEmissiveFactor(){return this.get("emissiveFactor")}setEmissiveFactor(e){return this.set("emissiveFactor",e)}getEmissiveTexture(){return this.getRef("emissiveTexture")}getEmissiveTextureInfo(){return this.getRef("emissiveTexture")?this.getRef("emissiveTextureInfo"):null}setEmissiveTexture(e){return this.setRef("emissiveTexture",e,{channels:ms|ys|xs,isColor:!0})}getNormalScale(){return this.get("normalScale")}setNormalScale(e){return this.set("normalScale",e)}getNormalTexture(){return this.getRef("normalTexture")}getNormalTextureInfo(){return this.getRef("normalTexture")?this.getRef("normalTextureInfo"):null}setNormalTexture(e){return this.setRef("normalTexture",e,{channels:ms|ys|xs})}getOcclusionStrength(){return this.get("occlusionStrength")}setOcclusionStrength(e){return this.set("occlusionStrength",e)}getOcclusionTexture(){return this.getRef("occlusionTexture")}getOcclusionTextureInfo(){return this.getRef("occlusionTexture")?this.getRef("occlusionTextureInfo"):null}setOcclusionTexture(e){return this.setRef("occlusionTexture",e,{channels:ms})}getRoughnessFactor(){return this.get("roughnessFactor")}setRoughnessFactor(e){return this.set("roughnessFactor",e)}getMetallicFactor(){return this.get("metallicFactor")}setMetallicFactor(e){return this.set("metallicFactor",e)}getMetallicRoughnessTexture(){return this.getRef("metallicRoughnessTexture")}getMetallicRoughnessTextureInfo(){return this.getRef("metallicRoughnessTexture")?this.getRef("metallicRoughnessTextureInfo"):null}setMetallicRoughnessTexture(e){return this.setRef("metallicRoughnessTexture",e,{channels:ys|xs})}},Lo=class extends Ie{init(){this.propertyType="Mesh"}getDefaults(){return Object.assign(super.getDefaults(),{weights:[],primitives:new oe})}addPrimitive(t){return this.addRef("primitives",t)}removePrimitive(t){return this.removeRef("primitives",t)}listPrimitives(){return this.listRefs("primitives")}getWeights(){return this.get("weights")}setWeights(t){return this.set("weights",t)}},Do=class extends Ie{init(){this.propertyType="Node"}getDefaults(){return Object.assign(super.getDefaults(),{translation:[0,0,0],rotation:[0,0,0,1],scale:[1,1,1],weights:[],camera:null,mesh:null,skin:null,children:new oe})}copy(t,e=bt){if(e===bt)throw new Error("Node cannot be copied.");return super.copy(t,e)}getTranslation(){return this.get("translation")}getRotation(){return this.get("rotation")}getScale(){return this.get("scale")}setTranslation(t){return this.set("translation",t)}setRotation(t){return this.set("rotation",t)}setScale(t){return this.set("scale",t)}getMatrix(){return de.compose(this.get("translation"),this.get("rotation"),this.get("scale"),[])}setMatrix(t){let e=this.get("translation").slice(),a=this.get("rotation").slice(),s=this.get("scale").slice();return de.decompose(t,e,a,s),this.set("translation",e).set("rotation",a).set("scale",s)}getWorldTranslation(){let t=[0,0,0];return de.decompose(this.getWorldMatrix(),t,[0,0,0,1],[1,1,1]),t}getWorldRotation(){let t=[0,0,0,1];return de.decompose(this.getWorldMatrix(),[0,0,0],t,[1,1,1]),t}getWorldScale(){let t=[1,1,1];return de.decompose(this.getWorldMatrix(),[0,0,0],[0,0,0,1],t),t}getWorldMatrix(){let t=[];for(let s=this;s!=null;s=s.getParentNode())t.push(s);let e,a=t.pop().getMatrix();for(;e=t.pop();)$f(a,a,e.getMatrix());return a}addChild(t){let e=t.getParentNode();e&&e.removeChild(t);for(let a of t.listParents())a.propertyType==="Scene"&&a.removeChild(t);return this.addRef("children",t)}removeChild(t){return this.removeRef("children",t)}listChildren(){return this.listRefs("children")}getParentNode(){for(let t of this.listParents())if(t.propertyType==="Node")return t;return null}getMesh(){return this.getRef("mesh")}setMesh(t){return this.setRef("mesh",t)}getCamera(){return this.getRef("camera")}setCamera(t){return this.setRef("camera",t)}getSkin(){return this.getRef("skin")}setSkin(t){return this.setRef("skin",t)}getWeights(){return this.get("weights")}setWeights(t){return this.set("weights",t)}traverse(t){t(this);for(let e of this.listChildren())e.traverse(t);return this}},wa=class Uo extends Ie{static Mode={POINTS:0,LINES:1,LINE_LOOP:2,LINE_STRIP:3,TRIANGLES:4,TRIANGLE_STRIP:5,TRIANGLE_FAN:6};init(){this.propertyType="Primitive"}getDefaults(){return Object.assign(super.getDefaults(),{mode:Uo.Mode.TRIANGLES,material:null,indices:null,attributes:new xe,targets:new oe})}getIndices(){return this.getRef("indices")}setIndices(e){return this.setRef("indices",e,{usage:"ELEMENT_ARRAY_BUFFER"})}getAttribute(e){return this.getRefMap("attributes",e)}setAttribute(e,a){return this.setRefMap("attributes",e,a,{usage:"ARRAY_BUFFER"})}listAttributes(){return this.listRefMapValues("attributes")}listSemantics(){return this.listRefMapKeys("attributes")}getMaterial(){return this.getRef("material")}setMaterial(e){return this.setRef("material",e)}getMode(){return this.get("mode")}setMode(e){return this.set("mode",e)}listTargets(){return this.listRefs("targets")}addTarget(e){return this.addRef("targets",e)}removeTarget(e){return this.removeRef("targets",e)}},lh=class extends Zr{init(){this.propertyType="PrimitiveTarget"}getDefaults(){return Object.assign(super.getDefaults(),{attributes:new xe})}getAttribute(t){return this.getRefMap("attributes",t)}setAttribute(t,e){return this.setRefMap("attributes",t,e,{usage:"ARRAY_BUFFER"})}listAttributes(){return this.listRefMapValues("attributes")}listSemantics(){return this.listRefMapKeys("attributes")}},zo=class extends Ie{init(){this.propertyType="Scene"}getDefaults(){return Object.assign(super.getDefaults(),{children:new oe})}copy(t,e=bt){if(e===bt)throw new Error("Scene cannot be copied.");return super.copy(t,e)}addChild(t){let e=t.getParentNode();return e&&e.removeChild(t),this.addRef("children",t)}removeChild(t){return this.removeRef("children",t)}listChildren(){return this.listRefs("children")}traverse(t){for(let e of this.listChildren())e.traverse(t);return this}},Go=class extends Ie{init(){this.propertyType="Skin"}getDefaults(){return Object.assign(super.getDefaults(),{skeleton:null,inverseBindMatrices:null,joints:new oe})}getSkeleton(){return this.getRef("skeleton")}setSkeleton(t){return this.setRef("skeleton",t)}getInverseBindMatrices(){return this.getRef("inverseBindMatrices")}setInverseBindMatrices(t){return this.setRef("inverseBindMatrices",t,{usage:"INVERSE_BIND_MATRICES"})}addJoint(t){return this.addRef("joints",t)}removeJoint(t){return this.removeRef("joints",t)}listJoints(){return this.listRefs("joints")}},Ko=class extends Ie{init(){this.propertyType="Texture"}getDefaults(){return Object.assign(super.getDefaults(),{image:null,mimeType:"",uri:""})}getMimeType(){return this.get("mimeType")||Ze.extensionToMimeType($t.extension(this.get("uri")))}setMimeType(t){return this.set("mimeType",t)}getURI(){return this.get("uri")}setURI(t){this.set("uri",t);let e=Ze.extensionToMimeType($t.extension(t));return e&&this.set("mimeType",e),this}getImage(){return this.get("image")}setImage(t){return this.set("image",H.assertView(t))}getSize(){let t=this.get("image");return t?Ze.getSize(t,this.getMimeType()):null}},tn=class extends Ie{_extensions=new Set;init(){this.propertyType="Root"}getDefaults(){return Object.assign(super.getDefaults(),{asset:{generator:`glTF-Transform ${_o}`,version:"2.0"},defaultScene:null,accessors:new oe,animations:new oe,buffers:new oe,cameras:new oe,materials:new oe,meshes:new oe,nodes:new oe,scenes:new oe,skins:new oe,textures:new oe})}constructor(t){super(t),t.addEventListener("node:create",e=>{this._addChildOfRoot(e.target)})}clone(){throw new Error("Root cannot be cloned.")}copy(t,e=bt){if(e===bt)throw new Error("Root cannot be copied.");this.set("asset",{...t.get("asset")}),this.setName(t.getName()),this.setExtras({...t.getExtras()}),this.setDefaultScene(t.getDefaultScene()?e(t.getDefaultScene()):null);for(let a of t.listRefMapKeys("extensions")){let s=t.getExtension(a);this.setExtension(a,e(s))}return this}_addChildOfRoot(t){return t instanceof zo?this.addRef("scenes",t):t instanceof Do?this.addRef("nodes",t):t instanceof Ss?this.addRef("cameras",t):t instanceof Go?this.addRef("skins",t):t instanceof Lo?this.addRef("meshes",t):t instanceof Es?this.addRef("materials",t):t instanceof Ko?this.addRef("textures",t):t instanceof Bo?this.addRef("animations",t):t instanceof z?this.addRef("accessors",t):t instanceof Oo&&this.addRef("buffers",t),this}getAsset(){return this.get("asset")}listExtensionsUsed(){return Array.from(this._extensions)}listExtensionsRequired(){return this.listExtensionsUsed().filter(t=>t.isRequired())}_enableExtension(t){return this._extensions.add(t),this}_disableExtension(t){return this._extensions.delete(t),this}listScenes(){return this.listRefs("scenes")}setDefaultScene(t){return this.setRef("defaultScene",t)}getDefaultScene(){return this.getRef("defaultScene")}listNodes(){return this.listRefs("nodes")}listCameras(){return this.listRefs("cameras")}listSkins(){return this.listRefs("skins")}listMeshes(){return this.listRefs("meshes")}listMaterials(){return this.listRefs("materials")}listTextures(){return this.listRefs("textures")}listAnimations(){return this.listRefs("animations")}listAccessors(){return this.listRefs("accessors")}listBuffers(){return this.listRefs("buffers")}},dh=class Qr{_graph=new qr;_root=new tn(this._graph);_logger=Ms.DEFAULT_INSTANCE;static _GRAPH_DOCUMENTS=new WeakMap;static fromGraph(e){return Qr._GRAPH_DOCUMENTS.get(e)||null}constructor(){Qr._GRAPH_DOCUMENTS.set(this._graph,this)}getRoot(){return this._root}getGraph(){return this._graph}getLogger(){return this._logger}setLogger(e){return this._logger=e,this}clone(){throw new Error("Use 'cloneDocument(source)' from '@gltf-transform/functions'.")}merge(e){throw new Error("Use 'mergeDocuments(target, source)' from '@gltf-transform/functions'.")}async transform(...e){let a=e.map(s=>s.name);for(let s of e)await s(this,{stack:a});return this}hasExtension(e){return this.getRoot().listExtensionsUsed().some(a=>a.extensionName===e)}createExtension(e){let a=e.EXTENSION_NAME;return this.getRoot().listExtensionsUsed().find(s=>s.extensionName===a)||new e(this)}disposeExtension(e){let a=this.getRoot().listExtensionsUsed().find(s=>s.extensionName===e);a&&a.dispose()}createScene(e=""){return new zo(this._graph,e)}createNode(e=""){return new Do(this._graph,e)}createCamera(e=""){return new Ss(this._graph,e)}createSkin(e=""){return new Go(this._graph,e)}createMesh(e=""){return new Lo(this._graph,e)}createPrimitive(){return new wa(this._graph)}createPrimitiveTarget(e=""){return new lh(this._graph,e)}createMaterial(e=""){return new Es(this._graph,e)}createTexture(e=""){return new Ko(this._graph,e)}createAnimation(e=""){return new Bo(this._graph,e)}createAnimationChannel(e=""){return new en(this._graph,e)}createAnimationSampler(e=""){return new _s(this._graph,e)}createAccessor(e="",a=null){return a||(a=this.getRoot().listBuffers()[0]),new z(this._graph,e).setBuffer(a)}createBuffer(e=""){return new Oo(this._graph,e)}},ne=class{static EXTENSION_NAME;extensionName="";prereadTypes=[];prewriteTypes=[];readDependencies=[];writeDependencies=[];document;required=!1;properties=new Set;_listener;constructor(t){this.document=t,t.getRoot()._enableExtension(this),this._listener=a=>{let s=a,r=s.target;r instanceof $&&r.extensionName===this.extensionName&&(s.type==="node:create"&&this._addExtensionProperty(r),s.type==="node:dispose"&&this._removeExtensionProperty(r))};let e=t.getGraph();e.addEventListener("node:create",this._listener),e.addEventListener("node:dispose",this._listener)}dispose(){this.document.getRoot()._disableExtension(this);let t=this.document.getGraph();t.removeEventListener("node:create",this._listener),t.removeEventListener("node:dispose",this._listener);for(let e of this.properties)e.dispose()}static register(){}isRequired(){return this.required}setRequired(t){return this.required=t,this}listProperties(){return Array.from(this.properties)}_addExtensionProperty(t){return this.properties.add(t),this}_removeExtensionProperty(t){return this.properties.delete(t),this}install(t,e){return this}preread(t,e){return this}prewrite(t,e){return this}},uh=class{jsonDoc;buffers=[];bufferViews=[];bufferViewBuffers=[];accessors=[];textures=[];textureInfos=new Map;materials=[];meshes=[];cameras=[];nodes=[];skins=[];animations=[];scenes=[];constructor(t){this.jsonDoc=t}setTextureInfo(t,e){this.textureInfos.set(t,e),e.texCoord!==void 0&&t.setTexCoord(e.texCoord),e.extras!==void 0&&t.setExtras(e.extras);let a=this.jsonDoc.json.textures[e.index];if(a.sampler===void 0)return;let s=this.jsonDoc.json.samplers[a.sampler];s.magFilter!==void 0&&t.setMagFilter(s.magFilter),s.minFilter!==void 0&&t.setMinFilter(s.minFilter),s.wrapS!==void 0&&t.setWrapS(s.wrapS),s.wrapT!==void 0&&t.setWrapT(s.wrapT)}},Eo={logger:Ms.DEFAULT_INSTANCE,extensions:[],dependencies:{}},fh=new Set(["Buffer","Texture","Material","Mesh","Primitive","Node","Scene"]),hh=class{static read(t,e=Eo){let a={...Eo,...e},{json:s}=t,r=new dh().setLogger(a.logger);this.validate(t,a);let n=new uh(t),i=s.asset,o=r.getRoot().getAsset();i.copyright&&(o.copyright=i.copyright),i.extras&&(o.extras=i.extras),s.extras!==void 0&&r.getRoot().setExtras({...s.extras});let c=s.extensionsUsed||[],l=s.extensionsRequired||[];a.extensions.sort((b,y)=>b.EXTENSION_NAME>y.EXTENSION_NAME?1:-1);for(let b of a.extensions)if(c.includes(b.EXTENSION_NAME)){let y=r.createExtension(b).setRequired(l.includes(b.EXTENSION_NAME)),x=y.prereadTypes.filter(w=>!fh.has(w));x.length&&a.logger.warn(`Preread hooks for some types (${x.join()}), requested by extension ${y.extensionName}, are unsupported. Please file an issue or a PR.`);for(let w of y.readDependencies)y.install(w,a.dependencies[w])}let f=s.buffers||[];r.getRoot().listExtensionsUsed().filter(b=>b.prereadTypes.includes("Buffer")).forEach(b=>b.preread(n,"Buffer")),n.buffers=f.map(b=>{let y=r.createBuffer(b.name);return b.extras&&y.setExtras(b.extras),b.uri&&b.uri.indexOf("__")!==0&&y.setURI(b.uri),y}),n.bufferViewBuffers=(s.bufferViews||[]).map((b,y)=>{if(!n.bufferViews[y]){let x=t.json.buffers[b.buffer],w=x.uri?t.resources[x.uri]:t.resources[ht],E=b.byteOffset||0;n.bufferViews[y]=H.toView(w,E,b.byteLength)}return n.buffers[b.buffer]});let u=s.accessors||[];n.accessors=u.map(b=>{let y=n.bufferViewBuffers[b.bufferView],x=r.createAccessor(b.name,y).setType(b.type);return b.extras&&x.setExtras(b.extras),b.normalized!==void 0&&x.setNormalized(b.normalized),b.bufferView===void 0||x.setArray(vs(b,n)),x});let g=s.images||[],p=s.textures||[];r.getRoot().listExtensionsUsed().filter(b=>b.prereadTypes.includes("Texture")).forEach(b=>b.preread(n,"Texture")),n.textures=g.map(b=>{let y=r.createTexture(b.name);if(b.extras&&y.setExtras(b.extras),b.bufferView!==void 0){let x=s.bufferViews[b.bufferView],w=t.json.buffers[x.buffer],E=w.uri?t.resources[w.uri]:t.resources[ht],T=x.byteOffset||0,_=x.byteLength,S=E.slice(T,T+_);y.setImage(S)}else b.uri!==void 0&&(y.setImage(t.resources[b.uri]),b.uri.indexOf("__")!==0&&y.setURI(b.uri));if(b.mimeType!==void 0)y.setMimeType(b.mimeType);else if(b.uri){let x=$t.extension(b.uri);y.setMimeType(Ze.extensionToMimeType(x))}return y}),r.getRoot().listExtensionsUsed().filter(b=>b.prereadTypes.includes("Material")).forEach(b=>b.preread(n,"Material")),n.materials=(s.materials||[]).map(b=>{let y=r.createMaterial(b.name);b.extras&&y.setExtras(b.extras),b.alphaMode!==void 0&&y.setAlphaMode(b.alphaMode),b.alphaCutoff!==void 0&&y.setAlphaCutoff(b.alphaCutoff),b.doubleSided!==void 0&&y.setDoubleSided(b.doubleSided);let x=b.pbrMetallicRoughness||{};if(x.baseColorFactor!==void 0&&y.setBaseColorFactor(x.baseColorFactor),b.emissiveFactor!==void 0&&y.setEmissiveFactor(b.emissiveFactor),x.metallicFactor!==void 0&&y.setMetallicFactor(x.metallicFactor),x.roughnessFactor!==void 0&&y.setRoughnessFactor(x.roughnessFactor),x.baseColorTexture!==void 0){let w=x.baseColorTexture,E=n.textures[p[w.index].source];y.setBaseColorTexture(E),n.setTextureInfo(y.getBaseColorTextureInfo(),w)}if(b.emissiveTexture!==void 0){let w=b.emissiveTexture,E=n.textures[p[w.index].source];y.setEmissiveTexture(E),n.setTextureInfo(y.getEmissiveTextureInfo(),w)}if(b.normalTexture!==void 0){let w=b.normalTexture,E=n.textures[p[w.index].source];y.setNormalTexture(E),n.setTextureInfo(y.getNormalTextureInfo(),w),b.normalTexture.scale!==void 0&&y.setNormalScale(b.normalTexture.scale)}if(b.occlusionTexture!==void 0){let w=b.occlusionTexture,E=n.textures[p[w.index].source];y.setOcclusionTexture(E),n.setTextureInfo(y.getOcclusionTextureInfo(),w),b.occlusionTexture.strength!==void 0&&y.setOcclusionStrength(b.occlusionTexture.strength)}if(x.metallicRoughnessTexture!==void 0){let w=x.metallicRoughnessTexture,E=n.textures[p[w.index].source];y.setMetallicRoughnessTexture(E),n.setTextureInfo(y.getMetallicRoughnessTextureInfo(),w)}return y}),r.getRoot().listExtensionsUsed().filter(b=>b.prereadTypes.includes("Mesh")).forEach(b=>b.preread(n,"Mesh"));let h=s.meshes||[];r.getRoot().listExtensionsUsed().filter(b=>b.prereadTypes.includes("Primitive")).forEach(b=>b.preread(n,"Primitive")),n.meshes=h.map(b=>{let y=r.createMesh(b.name);return b.extras&&y.setExtras(b.extras),b.weights!==void 0&&y.setWeights(b.weights),(b.primitives||[]).forEach(x=>{let w=r.createPrimitive();x.extras&&w.setExtras(x.extras),x.material!==void 0&&w.setMaterial(n.materials[x.material]),x.mode!==void 0&&w.setMode(x.mode);for(let[T,_]of Object.entries(x.attributes||{}))w.setAttribute(T,n.accessors[_]);x.indices!==void 0&&w.setIndices(n.accessors[x.indices]);let E=b.extras&&b.extras.targetNames||[];(x.targets||[]).forEach((T,_)=>{let S=E[_]||_.toString(),N=r.createPrimitiveTarget(S);for(let[R,I]of Object.entries(T))N.setAttribute(R,n.accessors[I]);w.addTarget(N)}),y.addPrimitive(w)}),y}),n.cameras=(s.cameras||[]).map(b=>{let y=r.createCamera(b.name).setType(b.type);if(b.extras&&y.setExtras(b.extras),b.type===Ss.Type.PERSPECTIVE){let x=b.perspective;y.setYFov(x.yfov),y.setZNear(x.znear),x.zfar!==void 0&&y.setZFar(x.zfar),x.aspectRatio!==void 0&&y.setAspectRatio(x.aspectRatio)}else{let x=b.orthographic;y.setZNear(x.znear).setZFar(x.zfar).setXMag(x.xmag).setYMag(x.ymag)}return y});let d=s.nodes||[];r.getRoot().listExtensionsUsed().filter(b=>b.prereadTypes.includes("Node")).forEach(b=>b.preread(n,"Node")),n.nodes=d.map(b=>{let y=r.createNode(b.name);if(b.extras&&y.setExtras(b.extras),b.translation!==void 0&&y.setTranslation(b.translation),b.rotation!==void 0&&y.setRotation(b.rotation),b.scale!==void 0&&y.setScale(b.scale),b.matrix!==void 0){let x=[0,0,0],w=[0,0,0,1],E=[1,1,1];de.decompose(b.matrix,x,w,E),y.setTranslation(x),y.setRotation(w),y.setScale(E)}return b.weights!==void 0&&y.setWeights(b.weights),y}),n.skins=(s.skins||[]).map(b=>{let y=r.createSkin(b.name);b.extras&&y.setExtras(b.extras),b.inverseBindMatrices!==void 0&&y.setInverseBindMatrices(n.accessors[b.inverseBindMatrices]),b.skeleton!==void 0&&y.setSkeleton(n.nodes[b.skeleton]);for(let x of b.joints)y.addJoint(n.nodes[x]);return y}),d.map((b,y)=>{let x=n.nodes[y];(b.children||[]).forEach(w=>x.addChild(n.nodes[w])),b.mesh!==void 0&&x.setMesh(n.meshes[b.mesh]),b.camera!==void 0&&x.setCamera(n.cameras[b.camera]),b.skin!==void 0&&x.setSkin(n.skins[b.skin])}),n.animations=(s.animations||[]).map(b=>{let y=r.createAnimation(b.name);b.extras&&y.setExtras(b.extras);let x=(b.samplers||[]).map(w=>{let E=r.createAnimationSampler().setInput(n.accessors[w.input]).setOutput(n.accessors[w.output]).setInterpolation(w.interpolation||_s.Interpolation.LINEAR);return w.extras&&E.setExtras(w.extras),y.addSampler(E),E});return(b.channels||[]).forEach(w=>{let E=r.createAnimationChannel().setSampler(x[w.sampler]).setTargetPath(w.target.path);w.target.node!==void 0&&E.setTargetNode(n.nodes[w.target.node]),w.extras&&E.setExtras(w.extras),y.addChannel(E)}),y});let m=s.scenes||[];return r.getRoot().listExtensionsUsed().filter(b=>b.prereadTypes.includes("Scene")).forEach(b=>b.preread(n,"Scene")),n.scenes=m.map(b=>{let y=r.createScene(b.name);return b.extras&&y.setExtras(b.extras),(b.nodes||[]).map(x=>n.nodes[x]).forEach(x=>y.addChild(x)),y}),s.scene!==void 0&&r.getRoot().setDefaultScene(n.scenes[s.scene]),r.getRoot().listExtensionsUsed().forEach(b=>b.read(n)),u.forEach((b,y)=>{let x=n.accessors[y],w=!!b.sparse,E=!b.bufferView&&!x.getArray();(w||E)&&x.setSparse(!0).setArray(ph(b,n))}),r}static validate(t,e){let a=t.json;if(a.asset.version!=="2.0")throw new Error(`Unsupported glTF version, "${a.asset.version}".`);if(a.extensionsRequired){for(let s of a.extensionsRequired)if(!e.extensions.find(r=>r.EXTENSION_NAME===s))throw new Error(`Missing required extension, "${s}".`)}if(a.extensionsUsed)for(let s of a.extensionsUsed)e.extensions.find(r=>r.EXTENSION_NAME===s)||e.logger.warn(`Missing optional extension, "${s}".`)}};function bh(t,e){let a=e.jsonDoc,s=e.bufferViews[t.bufferView],r=a.json.bufferViews[t.bufferView],n=Ts[t.componentType],i=z.getElementSize(t.type),o=n.BYTES_PER_ELEMENT,c=t.byteOffset||0,l=new n(t.count*i),f=new DataView(s.buffer,s.byteOffset,s.byteLength),u=r.byteStride;for(let g=0;g<t.count;g++)for(let p=0;p<i;p++){let h=c+g*u+p*o,d;switch(t.componentType){case z.ComponentType.FLOAT:d=f.getFloat32(h,!0);break;case z.ComponentType.UNSIGNED_INT:d=f.getUint32(h,!0);break;case z.ComponentType.UNSIGNED_SHORT:d=f.getUint16(h,!0);break;case z.ComponentType.UNSIGNED_BYTE:d=f.getUint8(h);break;case z.ComponentType.SHORT:d=f.getInt16(h,!0);break;case z.ComponentType.BYTE:d=f.getInt8(h);break;case z.ComponentType.FLOAT16:d=f.getFloat16(h,!0);break;case z.ComponentType.FLOAT64:d=f.getFloat64(h,!0);break;default:throw new Error(`Unexpected componentType "${t.componentType}".`)}l[g*i+p]=d}return l}function vs(t,e){let a=e.jsonDoc,s=e.bufferViews[t.bufferView],r=a.json.bufferViews[t.bufferView],n=Ts[t.componentType],i=z.getElementSize(t.type),o=n.BYTES_PER_ELEMENT,c=i*o;if(r.byteStride!==void 0&&r.byteStride!==c)return bh(t,e);let l=s.byteOffset+(t.byteOffset||0),f=t.count*i*o;return new n(s.buffer.slice(l,l+f))}function ph(t,e){let a=Ts[t.componentType],s=z.getElementSize(t.type),r;t.bufferView!==void 0?r=vs(t,e):r=new a(t.count*s);let n=t.sparse;if(!n)return r;let i=n.count,o={...t,...n.indices,count:i,type:"SCALAR"},c={...t,...n.values,count:i},l=vs(o,e),f=vs(c,e);for(let u=0;u<o.count;u++)for(let g=0;g<s;g++)r[l[u]*s+g]=f[u*s+g];return r}var Vo=(function(t){return t[t.ARRAY_BUFFER=34962]="ARRAY_BUFFER",t[t.ELEMENT_ARRAY_BUFFER=34963]="ELEMENT_ARRAY_BUFFER",t})(Vo||{}),ft=class{_doc;jsonDoc;options;static BufferViewTarget=Vo;static BufferViewUsage=Df;static USAGE_TO_TARGET={ARRAY_BUFFER:34962,ELEMENT_ARRAY_BUFFER:34963};accessorIndexMap=new Map;animationIndexMap=new Map;bufferIndexMap=new Map;cameraIndexMap=new Map;skinIndexMap=new Map;materialIndexMap=new Map;meshIndexMap=new Map;nodeIndexMap=new Map;imageIndexMap=new Map;textureDefIndexMap=new Map;textureInfoDefMap=new Map;samplerDefIndexMap=new Map;sceneIndexMap=new Map;imageBufferViews=[];otherBufferViews=new Map;otherBufferViewsIndexMap=new Map;extensionData={};bufferURIGenerator;imageURIGenerator;logger;_accessorUsageMap=new Map;accessorUsageGroupedByParent=new Set(["ARRAY_BUFFER"]);accessorParents=new Map;constructor(t,e,a){this._doc=t,this.jsonDoc=e,this.options=a;let s=t.getRoot(),r=s.listBuffers().length,n=s.listTextures().length;this.bufferURIGenerator=new To(r>1,()=>a.basename||"buffer"),this.imageURIGenerator=new To(n>1,i=>gh(t,i)||a.basename||"texture"),this.logger=t.getLogger()}createTextureInfoDef(t,e){let a={magFilter:e.getMagFilter()||void 0,minFilter:e.getMinFilter()||void 0,wrapS:e.getWrapS(),wrapT:e.getWrapT()},s=JSON.stringify(a);this.samplerDefIndexMap.has(s)||(this.samplerDefIndexMap.set(s,this.jsonDoc.json.samplers.length),this.jsonDoc.json.samplers.push(a));let r={source:this.imageIndexMap.get(t),sampler:this.samplerDefIndexMap.get(s)},n=JSON.stringify(r);this.textureDefIndexMap.has(n)||(this.textureDefIndexMap.set(n,this.jsonDoc.json.textures.length),this.jsonDoc.json.textures.push(r));let i={index:this.textureDefIndexMap.get(n)};return e.getTexCoord()!==0&&(i.texCoord=e.getTexCoord()),Object.keys(e.getExtras()).length>0&&(i.extras=e.getExtras()),this.textureInfoDefMap.set(e,i),i}createPropertyDef(t){let e={};return t.getName()&&(e.name=t.getName()),Object.keys(t.getExtras()).length>0&&(e.extras=t.getExtras()),e}createAccessorDef(t){let e=this.createPropertyDef(t);return e.type=t.getType(),e.componentType=t.getComponentType(),e.count=t.getCount(),this._doc.getGraph().listParentEdges(t).some(a=>a.getName()==="attributes"&&a.getAttributes().key==="POSITION"||a.getName()==="input")&&(e.max=t.getMax([]).map(Math.fround),e.min=t.getMin([]).map(Math.fround)),t.getNormalized()&&(e.normalized=t.getNormalized()),e}createImageData(t,e,a){if(this.options.format==="GLB")this.imageBufferViews.push(e),t.bufferView=this.jsonDoc.json.bufferViews.length,this.jsonDoc.json.bufferViews.push({buffer:0,byteOffset:-1,byteLength:e.byteLength});else{let s=Ze.mimeTypeToExtension(a.getMimeType());t.uri=this.imageURIGenerator.createURI(a,s),this.assignResourceURI(t.uri,e,!1)}}assignResourceURI(t,e,a){let s=this.jsonDoc.resources;if(!(t in s)){s[t]=e;return}if(e===s[t]){this.logger.warn(`Duplicate resource URI, "${t}".`);return}let r=`Resource URI "${t}" already assigned to different data.`;if(!a){this.logger.warn(r);return}throw new Error(r)}getAccessorUsage(t){let e=this._accessorUsageMap.get(t);if(e)return e;if(t.getSparse())return"SPARSE";for(let a of this._doc.getGraph().listParentEdges(t)){let{usage:s}=a.getAttributes();if(s)return s;a.getParent().propertyType!=="Root"&&this.logger.warn(`Missing attribute ".usage" on edge, "${a.getName()}".`)}return"OTHER"}addAccessorToUsageGroup(t,e){let a=this._accessorUsageMap.get(t);if(a&&a!==e)throw new Error(`Accessor with usage "${a}" cannot be reused as "${e}".`);return this._accessorUsageMap.set(t,e),this}},To=class{multiple;basename;counter={};constructor(t,e){this.multiple=t,this.basename=e}createURI(t,e){if(t.getURI())return t.getURI();if(this.multiple){let a=this.basename(t);return this.counter[a]=this.counter[a]||1,`${a}_${this.counter[a]++}.${e}`}else return`${this.basename(t)}.${e}`}};function gh(t,e){let a=t.getGraph().listParentEdges(e).find(s=>s.getParent()!==t.getRoot());return a?a.getName().replace(/texture$/i,""):""}var{BufferViewUsage:ws}=ft,{UNSIGNED_INT:mh,UNSIGNED_SHORT:yh,UNSIGNED_BYTE:xh}=z.ComponentType,wh=new Set(["Accessor","Buffer","Material","Mesh"]),vh=class{static write(t,e){let a=t.getGraph(),s=t.getRoot(),r={asset:{generator:`glTF-Transform ${_o}`,...s.getAsset()},extras:{...s.getExtras()}},n={json:r,resources:{}},i=new ft(t,n,e),o=e.logger||Ms.DEFAULT_INSTANCE,c=new Set(e.extensions.map(d=>d.EXTENSION_NAME)),l=t.getRoot().listExtensionsUsed().filter(d=>c.has(d.extensionName)).sort((d,m)=>d.extensionName>m.extensionName?1:-1),f=t.getRoot().listExtensionsRequired().filter(d=>c.has(d.extensionName)).sort((d,m)=>d.extensionName>m.extensionName?1:-1);l.length<t.getRoot().listExtensionsUsed().length&&o.warn("Some extensions were not registered for I/O, and will not be written.");for(let d of l){let m=d.prewriteTypes.filter(b=>!wh.has(b));m.length&&o.warn(`Prewrite hooks for some types (${m.join()}), requested by extension ${d.extensionName}, are unsupported. Please file an issue or a PR.`);for(let b of d.writeDependencies)d.install(b,e.dependencies[b])}function u(d,m,b,y){let x=[],w=0;for(let T of d){let _=i.createAccessorDef(T);_.bufferView=r.bufferViews.length;let S=T.getArray(),N=H.pad(H.toView(S));_.byteOffset=w,w+=N.byteLength,x.push(N),i.accessorIndexMap.set(T,r.accessors.length),r.accessors.push(_)}let E={buffer:m,byteOffset:b,byteLength:H.concat(x).byteLength};return y&&(E.target=y),r.bufferViews.push(E),{buffers:x,byteLength:w}}function g(d,m,b){let y=d[0].getCount(),x=0;for(let S of d){let N=i.createAccessorDef(S);N.bufferView=r.bufferViews.length,N.byteOffset=x;let R=S.getElementSize(),I=S.getComponentSize();x+=H.padNumber(R*I),i.accessorIndexMap.set(S,r.accessors.length),r.accessors.push(N)}let w=y*x,E=new ArrayBuffer(w),T=new DataView(E);for(let S=0;S<y;S++){let N=0;for(let R of d){let I=R.getElementSize(),C=R.getComponentSize(),A=R.getComponentType(),P=R.getArray();for(let K=0;K<I;K++){let W=S*x+N+K*C,Q=P[S*I+K];switch(A){case z.ComponentType.FLOAT:T.setFloat32(W,Q,!0);break;case z.ComponentType.BYTE:T.setInt8(W,Q);break;case z.ComponentType.SHORT:T.setInt16(W,Q,!0);break;case z.ComponentType.UNSIGNED_BYTE:T.setUint8(W,Q);break;case z.ComponentType.UNSIGNED_SHORT:T.setUint16(W,Q,!0);break;case z.ComponentType.UNSIGNED_INT:T.setUint32(W,Q,!0);break;case z.ComponentType.FLOAT16:T.setFloat16(W,Q,!0);break;case z.ComponentType.FLOAT64:T.setFloat64(W,Q,!0);break;default:throw new Error("Unexpected component type: "+A)}}N+=H.padNumber(I*C)}}let _={buffer:m,byteOffset:b,byteLength:w,byteStride:x,target:ft.BufferViewTarget.ARRAY_BUFFER};return r.bufferViews.push(_),{byteLength:w,buffers:[new Uint8Array(E)]}}function p(d,m,b){let y=[],x=0,w=new Map,E=-1/0,T=!1;for(let A of d){let P=i.createAccessorDef(A);r.accessors.push(P),i.accessorIndexMap.set(A,r.accessors.length-1);let K=[],W=[],Q=[],pe=new Array(A.getElementSize()).fill(0);for(let ue=0,Te=A.getCount();ue<Te;ue++)if(A.getElement(ue,Q),!de.eq(Q,pe,0)){E=Math.max(ue,E),K.push(ue);for(let ge=0;ge<Q.length;ge++)W.push(Q[ge])}let se=K.length,be={accessorDef:P,count:se};if(w.set(A,be),se===0)continue;se>A.getCount()/2&&(T=!0);let Ee=Ts[A.getComponentType()];be.indices=K,be.values=new Ee(W)}if(!Number.isFinite(E))return{buffers:y,byteLength:x};T&&o.warn("Some sparse accessors have >50% non-zero elements, which may increase file size.");let _=E<255?Uint8Array:E<65535?Uint16Array:Uint32Array,S=E<255?xh:E<65535?yh:mh,N={buffer:m,byteOffset:b+x,byteLength:0};for(let A of d){let P=w.get(A);if(P.count===0)continue;P.indicesByteOffset=N.byteLength;let K=H.pad(H.toView(new _(P.indices)));y.push(K),x+=K.byteLength,N.byteLength+=K.byteLength}r.bufferViews.push(N);let R=r.bufferViews.length-1,I={buffer:m,byteOffset:b+x,byteLength:0};for(let A of d){let P=w.get(A);if(P.count===0)continue;P.valuesByteOffset=I.byteLength;let K=H.pad(H.toView(P.values));y.push(K),x+=K.byteLength,I.byteLength+=K.byteLength}r.bufferViews.push(I);let C=r.bufferViews.length-1;for(let A of d){let P=w.get(A);P.count!==0&&(P.accessorDef.sparse={count:P.count,indices:{bufferView:R,byteOffset:P.indicesByteOffset,componentType:S},values:{bufferView:C,byteOffset:P.valuesByteOffset}})}return{buffers:y,byteLength:x}}if(r.accessors=[],r.bufferViews=[],r.samplers=[],r.textures=[],r.images=s.listTextures().map((d,m)=>{let b=i.createPropertyDef(d);d.getMimeType()&&(b.mimeType=d.getMimeType());let y=d.getImage();return y&&i.createImageData(b,y,d),i.imageIndexMap.set(d,m),b}),l.filter(d=>d.prewriteTypes.includes("Accessor")).forEach(d=>d.prewrite(i,"Accessor")),s.listAccessors().forEach(d=>{let m=i.accessorUsageGroupedByParent,b=i.accessorParents;if(i.accessorIndexMap.has(d))return;let y=i.getAccessorUsage(d);if(i.addAccessorToUsageGroup(d,y),m.has(y)){let x=a.listParents(d).find(w=>w.propertyType!=="Root");b.set(d,x)}}),l.filter(d=>d.prewriteTypes.includes("Buffer")).forEach(d=>d.prewrite(i,"Buffer")),(s.listAccessors().length>0||i.otherBufferViews.size>0||s.listTextures().length>0&&e.format==="GLB")&&s.listBuffers().length===0)throw new Error("Buffer required for Document resources, but none was found.");r.buffers=[],s.listBuffers().forEach((d,m)=>{let b=i.createPropertyDef(d),y=i.accessorUsageGroupedByParent,x=d.listParents().filter(R=>R instanceof z),w=new Set(x.map(R=>i.accessorParents.get(R))),E=new Map(Array.from(w).map((R,I)=>[R,I])),T={};for(let R of x){if(i.accessorIndexMap.has(R))continue;let I=i.getAccessorUsage(R),C=I;if(y.has(I)){let A=i.accessorParents.get(R);C+=`:${E.get(A)}`}T[C]||={usage:I,accessors:[]},T[C].accessors.push(R)}let _=[],S=r.buffers.length,N=0;for(let{usage:R,accessors:I}of Object.values(T))if(R===ws.ARRAY_BUFFER&&e.vertexLayout==="interleaved"){let C=g(I,S,N);N+=C.byteLength;for(let A of C.buffers)_.push(A)}else if(R===ws.ARRAY_BUFFER)for(let C of I){let A=g([C],S,N);N+=A.byteLength;for(let P of A.buffers)_.push(P)}else if(R===ws.SPARSE){let C=p(I,S,N);N+=C.byteLength;for(let A of C.buffers)_.push(A)}else if(R===ws.ELEMENT_ARRAY_BUFFER){let C=ft.BufferViewTarget.ELEMENT_ARRAY_BUFFER,A=u(I,S,N,C);N+=A.byteLength;for(let P of A.buffers)_.push(P)}else{let C=u(I,S,N);N+=C.byteLength;for(let A of C.buffers)_.push(A)}if(i.imageBufferViews.length&&m===0){for(let R=0;R<i.imageBufferViews.length;R++)if(r.bufferViews[r.images[R].bufferView].byteOffset=N,N+=i.imageBufferViews[R].byteLength,_.push(i.imageBufferViews[R]),N%8){let I=8-N%8;N+=I,_.push(new Uint8Array(I))}}if(i.otherBufferViews.has(d))for(let R of i.otherBufferViews.get(d))r.bufferViews.push({buffer:S,byteOffset:N,byteLength:R.byteLength}),i.otherBufferViewsIndexMap.set(R,r.bufferViews.length-1),N+=R.byteLength,_.push(R);if(N){let R;e.format==="GLB"?R=ht:(R=i.bufferURIGenerator.createURI(d,"bin"),b.uri=R),b.byteLength=N,i.assignResourceURI(R,H.concat(_),!0)}r.buffers.push(b),i.bufferIndexMap.set(d,m)}),s.listAccessors().find(d=>!d.getBuffer())&&o.warn("Skipped writing one or more Accessors: no Buffer assigned."),l.filter(d=>d.prewriteTypes.includes("Material")).forEach(d=>d.prewrite(i,"Material")),r.materials=s.listMaterials().map((d,m)=>{let b=i.createPropertyDef(d);if(d.getAlphaMode()!==Es.AlphaMode.OPAQUE&&(b.alphaMode=d.getAlphaMode()),d.getAlphaMode()===Es.AlphaMode.MASK&&(b.alphaCutoff=d.getAlphaCutoff()),d.getDoubleSided()&&(b.doubleSided=!0),b.pbrMetallicRoughness={},de.eq(d.getBaseColorFactor(),[1,1,1,1])||(b.pbrMetallicRoughness.baseColorFactor=d.getBaseColorFactor()),de.eq(d.getEmissiveFactor(),[0,0,0])||(b.emissiveFactor=d.getEmissiveFactor()),d.getRoughnessFactor()!==1&&(b.pbrMetallicRoughness.roughnessFactor=d.getRoughnessFactor()),d.getMetallicFactor()!==1&&(b.pbrMetallicRoughness.metallicFactor=d.getMetallicFactor()),d.getBaseColorTexture()){let y=d.getBaseColorTexture(),x=d.getBaseColorTextureInfo();b.pbrMetallicRoughness.baseColorTexture=i.createTextureInfoDef(y,x)}if(d.getEmissiveTexture()){let y=d.getEmissiveTexture(),x=d.getEmissiveTextureInfo();b.emissiveTexture=i.createTextureInfoDef(y,x)}if(d.getNormalTexture()){let y=d.getNormalTexture(),x=d.getNormalTextureInfo(),w=i.createTextureInfoDef(y,x);d.getNormalScale()!==1&&(w.scale=d.getNormalScale()),b.normalTexture=w}if(d.getOcclusionTexture()){let y=d.getOcclusionTexture(),x=d.getOcclusionTextureInfo(),w=i.createTextureInfoDef(y,x);d.getOcclusionStrength()!==1&&(w.strength=d.getOcclusionStrength()),b.occlusionTexture=w}if(d.getMetallicRoughnessTexture()){let y=d.getMetallicRoughnessTexture(),x=d.getMetallicRoughnessTextureInfo();b.pbrMetallicRoughness.metallicRoughnessTexture=i.createTextureInfoDef(y,x)}return i.materialIndexMap.set(d,m),b}),l.filter(d=>d.prewriteTypes.includes("Mesh")).forEach(d=>d.prewrite(i,"Mesh")),r.meshes=s.listMeshes().map((d,m)=>{let b=i.createPropertyDef(d),y=null;return b.primitives=d.listPrimitives().map(x=>{let w={attributes:{}};w.mode=x.getMode();let E=x.getMaterial();E&&(w.material=i.materialIndexMap.get(E)),Object.keys(x.getExtras()).length&&(w.extras=x.getExtras());let T=x.getIndices();T&&(w.indices=i.accessorIndexMap.get(T));for(let _ of x.listSemantics())w.attributes[_]=i.accessorIndexMap.get(x.getAttribute(_));for(let _ of x.listTargets()){let S={};for(let N of _.listSemantics())S[N]=i.accessorIndexMap.get(_.getAttribute(N));w.targets=w.targets||[],w.targets.push(S)}return x.listTargets().length&&!y&&(y=x.listTargets().map(_=>_.getName())),w}),d.getWeights().length&&(b.weights=d.getWeights()),y&&(b.extras=b.extras||{},b.extras.targetNames=y),i.meshIndexMap.set(d,m),b}),r.cameras=s.listCameras().map((d,m)=>{let b=i.createPropertyDef(d);if(b.type=d.getType(),b.type===Ss.Type.PERSPECTIVE){b.perspective={znear:d.getZNear(),zfar:d.getZFar(),yfov:d.getYFov()};let y=d.getAspectRatio();y!==null&&(b.perspective.aspectRatio=y)}else b.orthographic={znear:d.getZNear(),zfar:d.getZFar(),xmag:d.getXMag(),ymag:d.getYMag()};return i.cameraIndexMap.set(d,m),b}),r.nodes=s.listNodes().map((d,m)=>{let b=i.createPropertyDef(d);return de.eq(d.getTranslation(),[0,0,0])||(b.translation=d.getTranslation()),de.eq(d.getRotation(),[0,0,0,1])||(b.rotation=d.getRotation()),de.eq(d.getScale(),[1,1,1])||(b.scale=d.getScale()),d.getWeights().length&&(b.weights=d.getWeights()),i.nodeIndexMap.set(d,m),b}),r.skins=s.listSkins().map((d,m)=>{let b=i.createPropertyDef(d),y=d.getInverseBindMatrices();y&&(b.inverseBindMatrices=i.accessorIndexMap.get(y));let x=d.getSkeleton();return x&&(b.skeleton=i.nodeIndexMap.get(x)),b.joints=d.listJoints().map(w=>i.nodeIndexMap.get(w)),i.skinIndexMap.set(d,m),b}),s.listNodes().forEach((d,m)=>{let b=r.nodes[m],y=d.getMesh();y&&(b.mesh=i.meshIndexMap.get(y));let x=d.getCamera();x&&(b.camera=i.cameraIndexMap.get(x));let w=d.getSkin();w&&(b.skin=i.skinIndexMap.get(w)),d.listChildren().length>0&&(b.children=d.listChildren().map(E=>i.nodeIndexMap.get(E)))}),r.animations=s.listAnimations().map((d,m)=>{let b=i.createPropertyDef(d),y=new Map;return b.samplers=d.listSamplers().map((x,w)=>{let E=i.createPropertyDef(x);return E.input=i.accessorIndexMap.get(x.getInput()),E.output=i.accessorIndexMap.get(x.getOutput()),E.interpolation=x.getInterpolation(),y.set(x,w),E}),b.channels=d.listChannels().map(x=>{let w=i.createPropertyDef(x);return w.sampler=y.get(x.getSampler()),w.target={node:i.nodeIndexMap.get(x.getTargetNode()),path:x.getTargetPath()},w}),i.animationIndexMap.set(d,m),b}),r.scenes=s.listScenes().map((d,m)=>{let b=i.createPropertyDef(d);return b.nodes=d.listChildren().map(y=>i.nodeIndexMap.get(y)),i.sceneIndexMap.set(d,m),b});let h=s.getDefaultScene();return h&&(r.scene=s.listScenes().indexOf(h)),r.extensionsUsed=l.map(d=>d.extensionName),r.extensionsRequired=f.map(d=>d.extensionName),l.forEach(d=>d.write(i)),kh(r),n}};function kh(t){let e=[];for(let a in t){let s=t[a];(Array.isArray(s)&&s.length===0||s===null||s===""||s&&typeof s=="object"&&Object.keys(s).length===0)&&e.push(a)}for(let a of e)delete t[a]}var Eh=class{_logger=Ms.DEFAULT_INSTANCE;_extensions=new Set;_dependencies={};_vertexLayout="interleaved";_strictResources=!0;lastReadBytes=0;lastWriteBytes=0;setLogger(t){return this._logger=t,this}registerExtensions(t){for(let e of t)this._extensions.add(e),e.register();return this}registerDependencies(t){return Object.assign(this._dependencies,t),this}setVertexLayout(t){return this._vertexLayout=t,this}setStrictResources(t){return this._strictResources=t,this}async read(t){return await this.readJSON(await this.readAsJSON(t))}async readAsJSON(t){let e=await this.readURI(t,"view");this.lastReadBytes=e.byteLength;let a=Mo(e)?this._binaryToJSON(e):{json:JSON.parse(H.decodeText(e)),resources:{}};return await this._readResourcesExternal(a,this.dirname(t)),this._readResourcesInternal(a),a}async readJSON(t){return t=this._copyJSON(t),this._readResourcesInternal(t),hh.read(t,{extensions:Array.from(this._extensions),dependencies:this._dependencies,logger:this._logger})}async binaryToJSON(t){let e=this._binaryToJSON(H.assertView(t));this._readResourcesInternal(e);let a=e.json;if(a.buffers&&a.buffers.some(s=>Th(e,s)))throw new Error("Cannot resolve external buffers with binaryToJSON().");if(a.images&&a.images.some(s=>Mh(e,s)))throw new Error("Cannot resolve external images with binaryToJSON().");return e}async readBinary(t){return this.readJSON(await this.binaryToJSON(H.assertView(t)))}async writeJSON(t,e={}){if(e.format==="GLB"&&t.getRoot().listBuffers().length>1)throw new Error("GLB must have 0\u20131 buffers.");return vh.write(t,{format:e.format||"GLTF",basename:e.basename||"",logger:this._logger,vertexLayout:this._vertexLayout,dependencies:{...this._dependencies},extensions:Array.from(this._extensions)})}async writeBinary(t){let{json:e,resources:a}=await this.writeJSON(t,{format:"GLB"}),s=new Uint32Array([1179937895,2,12]),r=JSON.stringify(e),n=H.pad(H.encodeText(r),32),i=H.toView(new Uint32Array([n.byteLength,1313821514])),o=H.concat([i,n]);s[s.length-1]+=o.byteLength;let c=Object.values(a)[0];if(!c||!c.byteLength)return H.concat([H.toView(s),o]);let l=H.pad(c,0),f=H.toView(new Uint32Array([l.byteLength,5130562])),u=H.concat([f,l]);return s[s.length-1]+=u.byteLength,H.concat([H.toView(s),o,u])}async _readResourcesExternal(t,e){let a=t.json.images||[],s=t.json.buffers||[],r=[...a,...s].map(async n=>{let i=n.uri;if(!i||i.match(/data:/))return Promise.resolve();try{t.resources[i]=await this.readURI(this.resolve(e,i),"view"),this.lastReadBytes+=t.resources[i].byteLength}catch(o){if(!this._strictResources&&a.includes(n))this._logger.warn(`Failed to load image URI, "${i}". ${o}`),t.resources[i]=null;else throw o}});await Promise.all(r)}_readResourcesInternal(t){function e(a){if(a.uri){if(a.uri in t.resources){H.assertView(t.resources[a.uri]);return}if(a.uri.match(/data:/)){let s=`__${nh()}.${$t.extension(a.uri)}`;t.resources[s]=H.createBufferFromDataURI(a.uri),a.uri=s}}}(t.json.images||[]).forEach(a=>{if(a.bufferView===void 0&&a.uri===void 0)throw new Error("Missing resource URI or buffer view.");e(a)}),(t.json.buffers||[]).forEach(e)}_copyJSON(t){let{images:e,buffers:a}=t.json;return t={json:{...t.json},resources:{...t.resources}},e&&(t.json.images=e.map(s=>({...s}))),a&&(t.json.buffers=a.map(s=>({...s}))),t}_binaryToJSON(t){if(!Mo(t))throw new Error("Invalid glTF 2.0 binary.");let e=new Uint32Array(t.buffer,t.byteOffset+12,2);if(e[1]!==1313821514)throw new Error("Missing required GLB JSON chunk.");let a=20,s=e[0],r=H.decodeText(H.toView(t,a,s)),n=JSON.parse(r),i=a+s;if(t.byteLength<=i)return{json:n,resources:{}};let o=new Uint32Array(t.buffer,t.byteOffset+i,2);if(o[1]!==5130562)return{json:n,resources:{}};let c=o[0],l=H.toView(t,i+8,c);return{json:n,resources:{[ht]:l}}}};function Th(t,e){return e.uri!==void 0&&!(e.uri in t.resources)}function Mh(t,e){return e.uri!==void 0&&!(e.uri in t.resources)&&e.bufferView===void 0}function Mo(t){if(t.byteLength<3*Uint32Array.BYTES_PER_ELEMENT)return!1;let e=new Uint32Array(t.buffer,t.byteOffset,3);return e[0]===1179937895&&e[1]===2}var Ho=class extends Eh{_fetchConfig;constructor(t=Xr.DEFAULT_INIT){super(),this._fetchConfig=t}async readURI(t,e){let a=await fetch(t,this._fetchConfig);switch(e){case"view":return new Uint8Array(await a.arrayBuffer());case"text":return a.text()}}resolve(t,e){return Xr.resolve(t,e)}dirname(t){return Xr.dirname(t)}};function _h(){return{vkFormat:0,typeSize:1,pixelWidth:0,pixelHeight:0,pixelDepth:0,layerCount:0,faceCount:1,levelCount:0,supercompressionScheme:0,levels:[],dataFormatDescriptor:[{vendorId:0,descriptorType:0,versionNumber:2,colorModel:0,colorPrimaries:1,transferFunction:2,flags:0,texelBlockDimension:[0,0,0,0],bytesPlane:[0,0,0,0,0,0,0,0],samples:[]}],keyValue:{},globalData:null}}var jt=class{constructor(e,a,s,r){this._dataView=void 0,this._littleEndian=void 0,this._offset=void 0,this._dataView=new DataView(e.buffer,e.byteOffset+a,s),this._littleEndian=r,this._offset=0}_nextUint8(){let e=this._dataView.getUint8(this._offset);return this._offset+=1,e}_nextUint16(){let e=this._dataView.getUint16(this._offset,this._littleEndian);return this._offset+=2,e}_nextUint32(){let e=this._dataView.getUint32(this._offset,this._littleEndian);return this._offset+=4,e}_nextUint64(){let e=this._dataView.getUint32(this._offset,this._littleEndian),a=this._dataView.getUint32(this._offset+4,this._littleEndian),s=e+2**32*a;return this._offset+=8,s}_nextInt32(){let e=this._dataView.getInt32(this._offset,this._littleEndian);return this._offset+=4,e}_nextUint8Array(e){let a=new Uint8Array(this._dataView.buffer,this._dataView.byteOffset+this._offset,e);return this._offset+=e,a}_skip(e){return this._offset+=e,this}_scan(e,a=0){let s=this._offset,r=0;for(;this._dataView.getUint8(this._offset)!==a&&r<e;)r++,this._offset++;return r<e&&this._offset++,new Uint8Array(this._dataView.buffer,this._dataView.byteOffset+s,r)}};var Lw=new Uint8Array([0]),Ne=[171,75,84,88,32,50,48,187,13,10,26,10];function qo(t){return new TextDecoder().decode(t)}function As(t){let e=new Uint8Array(t.buffer,t.byteOffset,Ne.length);if(e[0]!==Ne[0]||e[1]!==Ne[1]||e[2]!==Ne[2]||e[3]!==Ne[3]||e[4]!==Ne[4]||e[5]!==Ne[5]||e[6]!==Ne[6]||e[7]!==Ne[7]||e[8]!==Ne[8]||e[9]!==Ne[9]||e[10]!==Ne[10]||e[11]!==Ne[11])throw new Error("Missing KTX 2.0 identifier.");let a=_h(),s=17*Uint32Array.BYTES_PER_ELEMENT,r=new jt(t,Ne.length,s,!0);a.vkFormat=r._nextUint32(),a.typeSize=r._nextUint32(),a.pixelWidth=r._nextUint32(),a.pixelHeight=r._nextUint32(),a.pixelDepth=r._nextUint32(),a.layerCount=r._nextUint32(),a.faceCount=r._nextUint32(),a.levelCount=r._nextUint32(),a.supercompressionScheme=r._nextUint32();let n=r._nextUint32(),i=r._nextUint32(),o=r._nextUint32(),c=r._nextUint32(),l=r._nextUint64(),f=r._nextUint64(),u=Math.max(a.levelCount,1)*3*8,g=new jt(t,Ne.length+s,u,!0);for(let O=0,L=Math.max(a.levelCount,1);O<L;O++)a.levels.push({levelData:new Uint8Array(t.buffer,t.byteOffset+g._nextUint64(),g._nextUint64()),uncompressedByteLength:g._nextUint64()});let p=new jt(t,n,i,!0);p._skip(4);let h=p._nextUint16(),d=p._nextUint16(),m=p._nextUint16(),b=p._nextUint16(),y=p._nextUint8(),x=p._nextUint8(),w=p._nextUint8(),E=p._nextUint8(),T=[p._nextUint8(),p._nextUint8(),p._nextUint8(),p._nextUint8()],_=[p._nextUint8(),p._nextUint8(),p._nextUint8(),p._nextUint8(),p._nextUint8(),p._nextUint8(),p._nextUint8(),p._nextUint8()],N={vendorId:h,descriptorType:d,versionNumber:m,colorModel:y,colorPrimaries:x,transferFunction:w,flags:E,texelBlockDimension:T,bytesPlane:_,samples:[]},C=(b/4-6)/4;for(let O=0;O<C;O++){let L={bitOffset:p._nextUint16(),bitLength:p._nextUint8(),channelType:p._nextUint8(),samplePosition:[p._nextUint8(),p._nextUint8(),p._nextUint8(),p._nextUint8()],sampleLower:Number.NEGATIVE_INFINITY,sampleUpper:Number.POSITIVE_INFINITY};L.channelType&64?(L.sampleLower=p._nextInt32(),L.sampleUpper=p._nextInt32()):(L.sampleLower=p._nextUint32(),L.sampleUpper=p._nextUint32()),N.samples[O]=L}a.dataFormatDescriptor.length=0,a.dataFormatDescriptor.push(N);let A=new jt(t,o,c,!0);for(;A._offset<c;){let O=A._nextUint32(),L=A._scan(O),X=qo(L);if(a.keyValue[X]=A._nextUint8Array(O-L.byteLength-1),X.match(/^ktx/i)){let ye=qo(a.keyValue[X]);a.keyValue[X]=ye.substring(0,ye.lastIndexOf("\0"))}let fe=O%4?4-O%4:0;A._skip(fe)}if(f<=0)return a;let P=new jt(t,l,f,!0),K=P._nextUint16(),W=P._nextUint16(),Q=P._nextUint32(),pe=P._nextUint32(),se=P._nextUint32(),be=P._nextUint32(),Ee=[];for(let O=0,L=Math.max(a.levelCount,1);O<L;O++)Ee.push({imageFlags:P._nextUint32(),rgbSliceByteOffset:P._nextUint32(),rgbSliceByteLength:P._nextUint32(),alphaSliceByteOffset:P._nextUint32(),alphaSliceByteLength:P._nextUint32()});let ue=l+P._offset,Te=ue+Q,ge=Te+pe,Re=ge+se,Me=new Uint8Array(t.buffer,t.byteOffset+ue,Q),ba=new Uint8Array(t.buffer,t.byteOffset+Te,pe),qt=new Uint8Array(t.buffer,t.byteOffset+ge,se),M=new Uint8Array(t.buffer,t.byteOffset+Re,be);return a.globalData={endpointCount:K,selectorCount:W,imageDescs:Ee,endpointsData:Me,selectorsData:ba,tablesData:qt,extendedData:M},a}var pt="EXT_mesh_gpu_instancing",it="EXT_mesh_features",Oe="EXT_meshopt_compression",V="EXT_structural_metadata",Rs="EXT_texture_webp",Is="EXT_texture_avif",Ch="KHR_accessor_float16",Bh="KHR_accessor_float64",me="KHR_draco_mesh_compression",nt="KHR_lights_punctual",gt="KHR_materials_anisotropy",mt="KHR_materials_clearcoat",yt="KHR_materials_diffuse_transmission",xt="KHR_materials_dispersion",wt="KHR_materials_emissive_strength",vt="KHR_materials_ior",kt="KHR_materials_iridescence",Et="KHR_materials_pbrSpecularGlossiness",Tt="KHR_materials_sheen",Mt="KHR_materials_specular",_t="KHR_materials_transmission",Yt="KHR_materials_unlit",St="KHR_materials_volume",De="KHR_materials_variants",Wo="KHR_mesh_primitive_restart",Xo="KHR_mesh_quantization",At="KHR_node_visibility",Ns="KHR_texture_basisu",Rt="KHR_texture_transform",We="KHR_xmp_json_ld",Fh=class extends ${static EXTENSION_NAME=it;init(){this.extensionName=it,this.propertyType="FeatureID",this.parentTypes=["Features"]}getDefaults(){return Object.assign(super.getDefaults(),{nullFeatureId:null,label:"",attribute:null,texture:null,propertyTable:null})}getFeatureCount(){return this.get("featureCount")}setFeatureCount(t){return this.set("featureCount",t)}getNullFeatureID(){return this.get("nullFeatureId")}setNullFeatureID(t){return this.set("nullFeatureId",t)}getLabel(){return this.get("label")}setLabel(t){return this.set("label",t)}getAttribute(){return this.get("attribute")}setAttribute(t){return this.set("attribute",t)}getTexture(){return this.getRef("texture")}setTexture(t){return this.setRef("texture",t)}getPropertyTable(){return this.getRef("propertyTable")}setPropertyTable(t){return this.setRef("propertyTable",t)}},Oh=class extends ${static EXTENSION_NAME=it;init(){this.extensionName=it,this.propertyType="FeatureIDTexture",this.parentTypes=["FeatureID"]}getDefaults(){let t=new le(this.graph,"textureInfo");return t.setMinFilter(le.MagFilter.NEAREST),t.setMagFilter(le.MagFilter.NEAREST),Object.assign(super.getDefaults(),{channels:[0],texture:null,textureInfo:t})}getChannels(){return this.get("channels")}setChannels(t){return this.set("channels",t)}getTexture(){return this.getRef("texture")}setTexture(t){return this.setRef("texture",t)}getTextureInfo(){return this.getRef("texture")?this.getRef("textureInfo"):null}},Ph=class extends ${static EXTENSION_NAME=it;init(){this.extensionName=it,this.propertyType="Features",this.parentTypes=[F.PRIMITIVE]}getDefaults(){return Object.assign(super.getDefaults(),{featureIds:new oe([])})}listFeatureIDs(){return this.listRefs("featureIds")}addFeatureID(t){return this.addRef("featureIds",t)}removeFeatureID(t){return this.removeRef("featureIds",t)}},va=it,cn=class extends ne{extensionName=it;static EXTENSION_NAME=it;createFeatures(){return new Ph(this.document.getGraph())}createFeatureID(){return new Fh(this.document.getGraph())}createFeatureIDTexture(){return new Oh(this.document.getGraph())}read(t){return(t.jsonDoc.json.meshes||[]).forEach((e,a)=>{(e.primitives||[]).forEach((s,r)=>{this._readPrimitive(t,a,s,r)})}),this}_readPrimitive(t,e,a,s){if(!a.extensions||!a.extensions[va])return;let r=this.createFeatures(),n=a.extensions[va];for(let i of n.featureIds){let o=jh(this.document,this,t,i);r.addFeatureID(o)}t.meshes[e].listPrimitives()[s].setExtension(va,r)}write(t){let e=t.jsonDoc.json.meshes;if(!e)return this;for(let a of this.document.getRoot().listMeshes()){let s=e[t.meshIndexMap.get(a)];a.listPrimitives().forEach((r,n)=>{let i=s.primitives[n];this._writePrimitive(t,r,i)})}return this}_writePrimitive(t,e,a){let s=e.getExtension(va);if(!s)return;let r={featureIds:[]};s.listFeatureIDs().forEach(n=>{r.featureIds.push(Dh(this.document,t,n))}),a.extensions=a.extensions||{},a.extensions[va]=r}};function jh(t,e,a,s){let r=e.createFeatureID().setFeatureCount(s.featureCount);s.nullFeatureId!==void 0&&r.setNullFeatureID(s.nullFeatureId),s.label!==void 0&&r.setLabel(s.label),s.attribute!==void 0&&r.setAttribute(s.attribute);let n=s.texture;if(n!==void 0){let i=Lh(e,a,n);r.setTexture(i)}if(s.propertyTable!==void 0){let i=t.getRoot().getExtension(V).listPropertyTables();r.setPropertyTable(i[s.propertyTable])}return r}function Lh(t,e,a){let s=t.createFeatureIDTexture(),{json:r}=e.jsonDoc;if(a.channels&&s.setChannels(a.channels),a.index!==void 0){let n=r.textures[a.index].source;s.setTexture(e.textures[n]),e.setTextureInfo(s.getTextureInfo(),a)}return s}function Dh(t,e,a){let s=t.getRoot(),r={featureCount:a.getFeatureCount()};if(a.getNullFeatureID()!=null&&(r.nullFeatureId=a.getNullFeatureID()),a.getLabel()&&(r.label=a.getLabel()),a.getAttribute()!=null&&(r.attribute=a.getAttribute()),a.getTexture()){let n=a.getTexture(),i=n.getTexture(),o=n.getTextureInfo();r.texture=e.createTextureInfoDef(i,o);let c=n.getChannels();de.eq(c,[0])||(r.texture.channels=c)}if(a.getPropertyTable()){let n=s.getExtension(V),i=a.getPropertyTable();r.propertyTable=n.listPropertyTables().indexOf(i)}return r}var rn="INSTANCE_ATTRIBUTE",Uh=class extends ${static EXTENSION_NAME=pt;init(){this.extensionName=pt,this.propertyType="InstancedMesh",this.parentTypes=[F.NODE]}getDefaults(){return Object.assign(super.getDefaults(),{attributes:new xe})}getAttribute(t){return this.getRefMap("attributes",t)}setAttribute(t,e){return this.setRefMap("attributes",t,e,{usage:rn})}listAttributes(){return this.listRefMapValues("attributes")}listSemantics(){return this.listRefMapKeys("attributes")}},zh=class extends ne{static EXTENSION_NAME=pt;extensionName=pt;prewriteTypes=[F.ACCESSOR];createInstancedMesh(){return new Uh(this.document.getGraph())}read(t){return(t.jsonDoc.json.nodes||[]).forEach((e,a)=>{if(!e.extensions||!e.extensions.EXT_mesh_gpu_instancing)return;let s=e.extensions[pt],r=this.createInstancedMesh();for(let n in s.attributes)r.setAttribute(n,t.accessors[s.attributes[n]]);t.nodes[a].setExtension(pt,r)}),this}prewrite(t){t.accessorUsageGroupedByParent.add(rn);for(let e of this.properties)for(let a of e.listAttributes())t.addAccessorToUsageGroup(a,rn);return this}write(t){let e=t.jsonDoc;return this.document.getRoot().listNodes().forEach(a=>{let s=a.getExtension(pt);if(s){let r=t.nodeIndexMap.get(a),n=e.json.nodes[r],i={attributes:{}};s.listSemantics().forEach(o=>{let c=s.getAttribute(o);i.attributes[o]=t.accessorIndexMap.get(c)}),n.extensions=n.extensions||{},n.extensions[pt]=i}}),this}},Gh=(function(t){return t.QUANTIZE="quantize",t.FILTER="filter",t})({});function Kh(t){return!t.extensions||!t.extensions.EXT_meshopt_compression?!1:!!t.extensions[Oe].fallback}var{BYTE:Vh,SHORT:$o,FLOAT:Hh}=z.ComponentType,{encodeNormalizedInt:Yo,decodeNormalizedInt:nn}=de;function qh(t,e,a,s){let{filter:r,bits:n}=s,i={array:t.getArray(),byteStride:t.getElementSize()*t.getComponentSize(),componentType:t.getComponentType(),normalized:t.getNormalized()};if(a!=="ATTRIBUTES")return i;if(r!=="NONE"){let o=t.getNormalized()?Wh(t):new Float32Array(i.array);switch(r){case"EXPONENTIAL":i.byteStride=t.getElementSize()*4,i.componentType=Hh,i.normalized=!1,i.array=e.encodeFilterExp(o,t.getCount(),i.byteStride,n);break;case"OCTAHEDRAL":i.byteStride=n>8?8:4,i.componentType=n>8?$o:Vh,i.normalized=!0,o=t.getElementSize()===3?$h(o):o,i.array=e.encodeFilterOct(o,t.getCount(),i.byteStride,n);break;case"QUATERNION":i.byteStride=8,i.componentType=$o,i.normalized=!0,i.array=e.encodeFilterQuat(o,t.getCount(),i.byteStride,n);break;default:throw new Error("Invalid filter.")}i.min=t.getMin([]),i.max=t.getMax([]),t.getNormalized()&&(i.min=i.min.map(c=>nn(c,t.getComponentType())),i.max=i.max.map(c=>nn(c,t.getComponentType()))),i.normalized&&(i.min=i.min.map(c=>Yo(c,i.componentType)),i.max=i.max.map(c=>Yo(c,i.componentType)))}else i.byteStride%4&&(i.array=Xh(i.array,t.getElementSize()),i.byteStride=i.array.byteLength/t.getCount());return i}function Wh(t){let e=t.getComponentType(),a=t.getArray(),s=new Float32Array(a.length);for(let r=0;r<a.length;r++)s[r]=nn(a[r],e);return s}function Xh(t,e){let a=H.padNumber(t.BYTES_PER_ELEMENT*e)/t.BYTES_PER_ELEMENT,s=t.length/e,r=new t.constructor(s*a);for(let n=0;n*e<t.length;n++)for(let i=0;i<e;i++)r[n*a+i]=t[n*e+i];return r}function $h(t){let e=new Float32Array(t.length*4/3);for(let a=0,s=t.length/3;a<s;a++)e[a*4]=t[a*3],e[a*4+1]=t[a*3+1],e[a*4+2]=t[a*3+2];return e}function Yh(t,e){return e===ft.BufferViewUsage.ELEMENT_ARRAY_BUFFER?t.listParents().some(a=>a instanceof wa&&a.getMode()===wa.Mode.TRIANGLES)?"TRIANGLES":"INDICES":"ATTRIBUTES"}function Jh(t,e){let a=e.getGraph().listParentEdges(t).filter(s=>!(s.getParent()instanceof tn));for(let s of a){let r=s.getName(),n=s.getAttributes().key||"",i=s.getParent().propertyType===F.PRIMITIVE_TARGET;if(r==="indices")return{filter:"NONE"};if(r==="attributes"){if(n==="POSITION")return{filter:"NONE"};if(n==="TEXCOORD_0")return{filter:"NONE"};if(n.startsWith("JOINTS_"))return{filter:"NONE"};if(n.startsWith("WEIGHTS_"))return{filter:"NONE"};if(n==="NORMAL"||n==="TANGENT")return i?{filter:"NONE"}:{filter:"OCTAHEDRAL",bits:8}}if(r==="output"){let o=hc(t);return o==="rotation"?{filter:"QUATERNION",bits:16}:o==="translation"?{filter:"EXPONENTIAL",bits:12}:o==="scale"?{filter:"EXPONENTIAL",bits:12}:{filter:"NONE"}}if(r==="input")return{filter:"NONE"};if(r==="inverseBindMatrices")return{filter:"NONE"}}return{filter:"NONE"}}function hc(t){for(let e of t.listParents())if(e instanceof _s){for(let a of e.listParents())if(a instanceof en)return a.getTargetPath()}return null}var Jo={method:"quantize"},ln=class extends ne{extensionName=Oe;prereadTypes=[F.BUFFER,F.PRIMITIVE];prewriteTypes=[F.BUFFER,F.ACCESSOR];readDependencies=["meshopt.decoder"];writeDependencies=["meshopt.encoder"];static EXTENSION_NAME=Oe;static EncoderMethod=Gh;_decoder=null;_decoderFallbackBufferMap=new Map;_encoder=null;_encoderOptions=Jo;_encoderFallbackBuffer=null;_encoderBufferViews={};_encoderBufferViewData={};_encoderBufferViewAccessors={};install(t,e){return t==="meshopt.decoder"&&(this._decoder=e),t==="meshopt.encoder"&&(this._encoder=e),this}setEncoderOptions(t){return this._encoderOptions={...Jo,...t},this}preread(t,e){if(!this._decoder){if(!this.isRequired())return this;throw new Error(`[${Oe}] Please install extension dependency, "meshopt.decoder".`)}if(!this._decoder.supported){if(!this.isRequired())return this;throw new Error(`[${Oe}]: Missing WASM support.`)}return e===F.BUFFER?this._prereadBuffers(t):e===F.PRIMITIVE&&this._prereadPrimitives(t),this}_prereadBuffers(t){let e=t.jsonDoc;(e.json.bufferViews||[]).forEach((a,s)=>{if(!a.extensions||!a.extensions.EXT_meshopt_compression)return;let r=a.extensions[Oe],n=r.byteOffset||0,i=r.byteLength||0,o=r.count,c=r.byteStride,l=new Uint8Array(o*c),f=e.json.buffers[r.buffer],u=f.uri?e.resources[f.uri]:e.resources[ht],g=H.toView(u,n,i);this._decoder.decodeGltfBuffer(l,o,c,g,r.mode,r.filter),t.bufferViews[s]=l})}_prereadPrimitives(t){let e=t.jsonDoc;(e.json.bufferViews||[]).forEach(a=>{if(!a.extensions||!a.extensions.EXT_meshopt_compression)return;let s=a.extensions[Oe],r=t.buffers[s.buffer],n=t.buffers[a.buffer],i=e.json.buffers[a.buffer];Kh(i)&&this._decoderFallbackBufferMap.set(n,r)})}read(t){if(!this.isRequired())return this;for(let[e,a]of this._decoderFallbackBufferMap){for(let s of e.listParents())s instanceof z&&s.swap(e,a);e.dispose()}return this}prewrite(t,e){return e===F.ACCESSOR?this._prewriteAccessors(t):e===F.BUFFER&&this._prewriteBuffers(t),this}_prewriteAccessors(t){let e=t.jsonDoc.json,a=this._encoder,s=this._encoderOptions,r=this.document.getGraph(),n=this.document.createBuffer(),i=this.document.getRoot().listBuffers().indexOf(n),o=1,c=new Map,l=f=>{for(let u of r.listParents(f)){if(u.propertyType===F.ROOT)continue;let g=c.get(f);return g===void 0&&c.set(f,g=o++),g}return-1};this._encoderFallbackBuffer=n,this._encoderBufferViews={},this._encoderBufferViewData={},this._encoderBufferViewAccessors={};for(let f of this.document.getRoot().listAccessors()){if(hc(f)==="weights"||f.getSparse())continue;let u=t.getAccessorUsage(f),g=t.accessorUsageGroupedByParent.has(u)?l(f):null,p=Yh(f,u),h=s.method==="filter"?Jh(f,this.document):{filter:"NONE"},d=qh(f,a,p,h),{array:m,byteStride:b}=d,y=f.getBuffer();if(!y)throw new Error(`${Oe}: Missing buffer for accessor.`);let x=this.document.getRoot().listBuffers().indexOf(y),w=[u,g,p,h.filter,b,x].join(":"),E=this._encoderBufferViews[w],T=this._encoderBufferViewData[w],_=this._encoderBufferViewAccessors[w];(!E||!T)&&(_=this._encoderBufferViewAccessors[w]=[],T=this._encoderBufferViewData[w]=[],E=this._encoderBufferViews[w]={buffer:i,target:ft.USAGE_TO_TARGET[u],byteOffset:0,byteLength:0,byteStride:u===ft.BufferViewUsage.ARRAY_BUFFER?b:void 0,extensions:{[Oe]:{buffer:x,byteOffset:0,byteLength:0,mode:p,filter:h.filter!=="NONE"?h.filter:void 0,byteStride:b,count:0}}});let S=t.createAccessorDef(f);S.componentType=d.componentType,S.normalized=d.normalized,S.byteOffset=E.byteLength,S.min&&d.min&&(S.min=d.min),S.max&&d.max&&(S.max=d.max),t.accessorIndexMap.set(f,e.accessors.length),e.accessors.push(S),_.push(S),T.push(new Uint8Array(m.buffer,m.byteOffset,m.byteLength)),E.byteLength+=m.byteLength,E.extensions.EXT_meshopt_compression.count+=f.getCount()}}_prewriteBuffers(t){let e=this._encoder;for(let a in this._encoderBufferViews){let s=this._encoderBufferViews[a],r=this._encoderBufferViewData[a],n=this.document.getRoot().listBuffers()[s.extensions[Oe].buffer],i=t.otherBufferViews.get(n)||[],{count:o,byteStride:c,mode:l}=s.extensions[Oe],f=H.concat(r),u=e.encodeGltfBuffer(f,o,c,l),g=H.pad(u);s.extensions[Oe].byteLength=u.byteLength,r.length=0,r.push(g),i.push(g),t.otherBufferViews.set(n,i)}}write(t){let e=0;for(let n in this._encoderBufferViews){let i=this._encoderBufferViews[n],o=this._encoderBufferViewData[n][0],c=t.otherBufferViewsIndexMap.get(o),l=this._encoderBufferViewAccessors[n];for(let p of l)p.bufferView=c;let f=t.jsonDoc.json.bufferViews[c],u=f.byteOffset||0;Object.assign(f,i),f.byteOffset=e;let g=f.extensions[Oe];g.byteOffset=u,e+=H.padNumber(i.byteLength)}let a=this._encoderFallbackBuffer,s=t.bufferIndexMap.get(a),r=t.jsonDoc.json.buffers[s];return r.byteLength=e,r.extensions={[Oe]:{fallback:!0}},a.dispose(),this}},Qh=class extends ${static EXTENSION_NAME=V;init(){this.extensionName=V,this.propertyType="StructuralMetadata",this.parentTypes=[F.ROOT]}getDefaults(){return Object.assign(super.getDefaults(),{schema:null,schemaUri:"",propertyTables:new _e,propertyTextures:new _e,propertyAttributes:new _e})}getSchema(){return this.getRef("schema")}setSchema(t){return this.setRef("schema",t)}getSchemaUri(){return this.get("schemaUri")}setSchemaUri(t){return this.set("schemaUri",t)}listPropertyTables(){return this.listRefs("propertyTables")}addPropertyTable(t){return this.addRef("propertyTables",t)}removePropertyTable(t){return this.removeRef("propertyTables",t)}listPropertyTextures(){return this.listRefs("propertyTextures")}addPropertyTexture(t){return this.addRef("propertyTextures",t)}removePropertyTexture(t){return this.removeRef("propertyTextures",t)}listPropertyAttributes(){return this.listRefs("propertyAttributes")}addPropertyAttribute(t){return this.addRef("propertyAttributes",t)}removePropertyAttribute(t){return this.removeRef("propertyAttributes",t)}},Zh=class extends ${static EXTENSION_NAME=V;init(){this.extensionName=V,this.propertyType="Schema",this.parentTypes=["StructuralMetadata"]}getDefaults(){return Object.assign(super.getDefaults(),{description:"",version:"",classes:new xe,enums:new xe})}getId(){return this.get("id")}setId(t){return this.set("id",t)}getDescription(){return this.get("description")}setDescription(t){return this.set("description",t)}getVersion(){return this.get("version")}setVersion(t){return this.set("version",t)}setClass(t,e){return this.setRefMap("classes",t,e)}getClass(t){return this.getRefMap("classes",t)}listClassKeys(){return this.listRefMapKeys("classes")}listClassValues(){return this.listRefMapValues("classes")}setEnum(t,e){return this.setRefMap("enums",t,e)}getEnum(t){return this.getRefMap("enums",t)}listEnumKeys(){return this.listRefMapKeys("enums")}listEnumValues(){return this.listRefMapValues("enums")}},eb=class extends ${static EXTENSION_NAME=V;init(){this.extensionName=V,this.propertyType="Class",this.parentTypes=["Schema"]}getDefaults(){return Object.assign(super.getDefaults(),{description:"",properties:new xe})}getDescription(){return this.get("description")}setDescription(t){return this.set("description",t)}setProperty(t,e){return this.setRefMap("properties",t,e)}getProperty(t){return this.getRefMap("properties",t)}listPropertyKeys(){return this.listRefMapKeys("properties")}listPropertyValues(){return this.listRefMapValues("properties")}},tb=class extends ${static EXTENSION_NAME=V;init(){this.extensionName=V,this.propertyType="ClassProperty",this.parentTypes=["Class"]}getDefaults(){return Object.assign(super.getDefaults(),{description:"",componentType:null,enumType:null,array:null,count:null,normalized:null,offset:null,scale:null,max:null,min:null,required:null,noData:null,default:null})}getDescription(){return this.get("description")}setDescription(t){return this.set("description",t)}getType(){return this.get("type")}setType(t){return this.set("type",t)}getComponentType(){return this.get("componentType")}setComponentType(t){return this.set("componentType",t)}getEnumType(){return this.get("enumType")}setEnumType(t){return this.set("enumType",t)}getArray(){return this.get("array")}setArray(t){return this.set("array",t)}getCount(){return this.get("count")}setCount(t){return this.set("count",t)}getNormalized(){return this.get("normalized")}setNormalized(t){return this.set("normalized",t)}getOffset(){return this.get("offset")}setOffset(t){return this.set("offset",t)}getScale(){return this.get("scale")}setScale(t){return this.set("scale",t)}getMax(){return this.get("max")}setMax(t){return this.set("max",t)}getMin(){return this.get("min")}setMin(t){return this.set("min",t)}getRequired(){return this.get("required")}setRequired(t){return this.set("required",t)}getNoData(){return this.get("noData")}setNoData(t){return this.set("noData",t)}getDefault(){return this.get("default")}setDefault(t){return this.set("default",t)}},ab=class extends ${static EXTENSION_NAME=V;init(){this.extensionName=V,this.propertyType="Enum",this.parentTypes=["Schema"]}getDefaults(){return Object.assign(super.getDefaults(),{description:"",valueType:"UINT16",values:new _e})}getDescription(){return this.get("description")}setDescription(t){return this.set("description",t)}getValueType(){return this.get("valueType")}setValueType(t){return this.set("valueType",t)}listValues(){return this.listRefs("values")}addEnumValue(t){return this.addRef("values",t)}removeEnumValue(t){return this.removeRef("values",t)}},sb=class extends ${static EXTENSION_NAME=V;init(){this.extensionName=V,this.propertyType="EnumValue",this.parentTypes=["Enum"]}getDefaults(){return Object.assign(super.getDefaults(),{description:null})}getDescription(){return this.get("description")}setDescription(t){return this.set("description",t)}getValue(){return this.get("value")}setValue(t){return this.set("value",t)}},rb=class extends ${static EXTENSION_NAME=V;init(){this.extensionName=V,this.propertyType="PropertyTable",this.parentTypes=["StructuralMetadata"]}getDefaults(){return Object.assign(super.getDefaults(),{properties:new xe})}getClass(){return this.get("class")}setClass(t){return this.set("class",t)}getCount(){return this.get("count")}setCount(t){return this.set("count",t)}setProperty(t,e){return this.setRefMap("properties",t,e)}getProperty(t){return this.getRefMap("properties",t)}listPropertyKeys(){return this.listRefMapKeys("properties")}listPropertyValues(){return this.listRefMapValues("properties")}},nb=class extends ${static EXTENSION_NAME=V;init(){this.extensionName=V,this.propertyType="PropertyTableProperty",this.parentTypes=["PropertyTable"]}getDefaults(){return Object.assign(super.getDefaults(),{arrayOffsets:null,stringOffsets:null,arrayOffsetType:null,stringOffsetType:null,offset:null,scale:null,max:null,min:null})}getValues(){return this.get("values")}setValues(t){return this.set("values",t)}getArrayOffsets(){return this.get("arrayOffsets")}setArrayOffsets(t){return this.set("arrayOffsets",t)}getStringOffsets(){return this.get("stringOffsets")}setStringOffsets(t){return this.set("stringOffsets",t)}getArrayOffsetType(){return this.get("arrayOffsetType")}setArrayOffsetType(t){return this.set("arrayOffsetType",t)}getStringOffsetType(){return this.get("stringOffsetType")}setStringOffsetType(t){return this.set("stringOffsetType",t)}getOffset(){return this.get("offset")}setOffset(t){return this.set("offset",t)}getScale(){return this.get("scale")}setScale(t){return this.set("scale",t)}getMax(){return this.get("max")}setMax(t){return this.set("max",t)}getMin(){return this.get("min")}setMin(t){return this.set("min",t)}},ib=class extends ${static EXTENSION_NAME=V;init(){this.extensionName=V,this.propertyType="PropertyTexture",this.parentTypes=["StructuralMetadata"]}getDefaults(){return Object.assign(super.getDefaults(),{properties:new xe})}getClass(){return this.get("class")}setClass(t){return this.set("class",t)}setProperty(t,e){return this.setRefMap("properties",t,e)}getProperty(t){return this.getRefMap("properties",t)}listPropertyKeys(){return this.listRefMapKeys("properties")}listPropertyValues(){return this.listRefMapValues("properties")}},ob=class extends ${static EXTENSION_NAME=V;init(){this.extensionName=V,this.propertyType="PropertyTextureProperty",this.parentTypes=["PropertyTexture"]}getDefaults(){let t=new le(this.graph,"textureInfo");return t.setMinFilter(le.MagFilter.NEAREST),t.setMagFilter(le.MagFilter.NEAREST),Object.assign(super.getDefaults(),{channels:[0],texture:null,textureInfo:t,offset:null,scale:null,max:null,min:null})}getChannels(){return this.get("channels")}setChannels(t){return this.set("channels",t)}getTexture(){return this.getRef("texture")}setTexture(t){return this.setRef("texture",t)}getTextureInfo(){return this.getRef("texture")?this.getRef("textureInfo"):null}getOffset(){return this.get("offset")}setOffset(t){return this.set("offset",t)}getScale(){return this.get("scale")}setScale(t){return this.set("scale",t)}getMax(){return this.get("max")}setMax(t){return this.set("max",t)}getMin(){return this.get("min")}setMin(t){return this.set("min",t)}},cb=class extends ${static EXTENSION_NAME=V;init(){this.extensionName=V,this.propertyType="PropertyAttribute",this.parentTypes=["StructuralMetadata"]}getDefaults(){return Object.assign(super.getDefaults(),{properties:new xe})}getClass(){return this.get("class")}setClass(t){return this.set("class",t)}setProperty(t,e){return this.setRefMap("properties",t,e)}getProperty(t){return this.getRefMap("properties",t)}listPropertyKeys(){return this.listRefMapKeys("properties")}listPropertyValues(){return this.listRefMapValues("properties")}},lb=class extends ${static EXTENSION_NAME=V;init(){this.extensionName=V,this.propertyType="PropertyAttributeProperty",this.parentTypes=["PropertyAttribute"]}getDefaults(){return Object.assign(super.getDefaults(),{offset:null,scale:null,max:null,min:null})}getAttribute(){return this.get("attribute")}setAttribute(t){return this.set("attribute",t)}getOffset(){return this.get("offset")}setOffset(t){return this.set("offset",t)}getScale(){return this.get("scale")}setScale(t){return this.set("scale",t)}getMax(){return this.get("max")}setMax(t){return this.set("max",t)}getMin(){return this.get("min")}setMin(t){return this.set("min",t)}},db=class extends ${static EXTENSION_NAME=V;init(){this.extensionName=V,this.propertyType="NodeStructuralMetadata",this.parentTypes=[F.NODE]}getDefaults(){return Object.assign(super.getDefaults(),{class:"",properties:{}})}getClass(){return this.get("class")}setClass(t){return this.set("class",t)}getProperties(){return this.get("properties")}setProperties(t){return this.set("properties",t)}},ub=class extends ${static EXTENSION_NAME=V;init(){this.extensionName=V,this.propertyType="MeshPrimitiveStructuralMetadata",this.parentTypes=[F.PRIMITIVE]}getDefaults(){return Object.assign(super.getDefaults(),{propertyTextures:new _e,propertyAttributes:new _e})}listPropertyTextures(){return this.listRefs("propertyTextures")}addPropertyTexture(t){return this.addRef("propertyTextures",t)}removePropertyTexture(t){return this.removeRef("propertyTextures",t)}listPropertyAttributes(){return this.listRefs("propertyAttributes")}addPropertyAttribute(t){return this.addRef("propertyAttributes",t)}removePropertyAttribute(t){return this.removeRef("propertyAttributes",t)}},fb=class extends ne{extensionName=V;static EXTENSION_NAME=V;prewriteTypes=[F.BUFFER];prereadTypes=[F.SCENE];createStructuralMetadata(){return new Qh(this.document.getGraph())}createSchema(){return new Zh(this.document.getGraph())}createClass(){return new eb(this.document.getGraph())}createClassProperty(){return new tb(this.document.getGraph())}createEnum(){return new ab(this.document.getGraph())}createEnumValue(){return new sb(this.document.getGraph())}createPropertyTable(){return new rb(this.document.getGraph())}createPropertyTableProperty(){return new nb(this.document.getGraph())}createPropertyTexture(){return new ib(this.document.getGraph())}createPropertyTextureProperty(){return new ob(this.document.getGraph())}createPropertyAttribute(){return new cb(this.document.getGraph())}createPropertyAttributeProperty(){return new lb(this.document.getGraph())}createNodeStructuralMetadata(){return new db(this.document.getGraph())}createMeshPrimitiveStructuralMetadata(){return new ub(this.document.getGraph())}read(t){return this}preread(t){let e=this.document.getRoot(),{json:a}=t.jsonDoc,s=a.extensions[V],r=hb(this,t,s);return e.setExtension(V,r),(a.meshes||[]).forEach((n,i)=>{let o=t.meshes[i].listPrimitives();(n.primitives||[]).forEach((c,l)=>{let f=o[l];this._readPrimitive(r,f,c)})}),(a.nodes||[]).forEach((n,i)=>{this._readNode(t.nodes[i],n)}),this}_readPrimitive(t,e,a){if(!a.extensions||!a.extensions.EXT_structural_metadata)return;let s=this.createMeshPrimitiveStructuralMetadata(),r=a.extensions[V],n=t.listPropertyTextures(),i=r.propertyTextures||[];for(let l of i){let f=n[l];s.addPropertyTexture(f)}let o=t.listPropertyAttributes(),c=r.propertyAttributes||[];for(let l of c){let f=o[l];s.addPropertyAttribute(f)}e.setExtension(V,s)}_readNode(t,e){if(!e.extensions||!e.extensions.EXT_structural_metadata)return;let a=e.extensions[V],s=this.createNodeStructuralMetadata().setClass(a.class).setProperties(a.properties);t.setExtension(V,s)}write(t){let e=this.document.getRoot(),a=e.getExtension(V);if(!a)return this;let s=t.jsonDoc.json,r=Mb(t,a);s.extensions=s.extensions||{},s.extensions[V]=r;let n=e.listMeshes(),i=s.meshes;if(i)for(let l of n){let f=i[t.meshIndexMap.get(l)];l.listPrimitives().forEach((u,g)=>{let p=f.primitives[g];this._writePrimitive(a,u,p)})}let o=e.listNodes(),c=s.nodes;if(c)for(let l of o){let f=t.nodeIndexMap.get(l);this._writeNode(l,c[f])}return this}_writePrimitive(t,e,a){let s=e.getExtension(V);if(!s)return;let r=t.listPropertyTextures(),n=t.listPropertyAttributes(),i,o,c=s.listPropertyTextures();if(c.length>0){i=[];for(let u of c){let g=r.indexOf(u);if(g>=0)i.push(g);else throw new Error(`${V}: Invalid property texture in mesh primitive`)}}let l=s.listPropertyAttributes();if(l.length>0){o=[];for(let u of l){let g=n.indexOf(u);if(g>=0)o.push(g);else throw new Error(`${V}: Invalid property attribute in mesh primitive`)}}let f={propertyTextures:i,propertyAttributes:o};a.extensions=a.extensions||{},a.extensions[V]=f}_writeNode(t,e){let a=t.getExtension("EXT_structural_metadata");a&&(e.extensions=e.extensions||{},e.extensions[V]={class:a.getClass(),properties:a.getProperties()})}prewrite(t,e){return e===F.BUFFER&&this._prewriteBuffers(t),this}_prewriteBuffers(t){let e=this.document,a=e.getRoot().getExtension(V);t.jsonDoc.json.bufferViews||=[];for(let s of a.listPropertyTables())for(let r of s.listPropertyValues()){let n=jb(e,t);n.push(r.getValues());let i=r.getArrayOffsets();i&&n.push(i);let o=r.getStringOffsets();o&&n.push(o)}}};function hb(t,e,a){let s=t.createStructuralMetadata();if(a.schema!==void 0){let o=bb(t,a.schema);s.setSchema(o)}else if(a.schemaUri){let o=a.schemaUri;s.setSchemaUri(o)}let r=a.propertyTextures||[];for(let o of r){let c=xb(t,e,o);s.addPropertyTexture(c)}let n=a.propertyTables||[];for(let o of n){let c=vb(t,e,o);s.addPropertyTable(c)}let i=a.propertyAttributes||[];for(let o of i){let c=Eb(t,o);s.addPropertyAttribute(c)}return s}function bb(t,e){let a=t.createSchema().setId(e.id);e.name!==void 0&&a.setName(e.name),e.description!==void 0&&a.setDescription(e.description),e.version!==void 0&&a.setVersion(e.version);let s=e.classes||{};for(let n of Object.keys(s)){let i=s[n];a.setClass(n,pb(t,i))}let r=e.enums||{};for(let n of Object.keys(r))a.setEnum(n,mb(t,r[n]));return a}function pb(t,e){let a=t.createClass();e.name!==void 0&&a.setName(e.name),e.description!==void 0&&a.setDescription(e.description);let s=e.properties||{};for(let r of Object.keys(s)){let n=gb(t,s[r]);a.setProperty(r,n)}return a}function gb(t,e){let a=t.createClassProperty().setType(e.type);return e.name!==void 0&&a.setName(e.name),e.description!==void 0&&a.setDescription(e.description),e.componentType!==void 0&&a.setComponentType(e.componentType),e.enumType!==void 0&&a.setEnumType(e.enumType),e.array!==void 0&&a.setArray(e.array),e.count!==void 0&&a.setCount(e.count),e.normalized!==void 0&&a.setNormalized(e.normalized),e.offset!==void 0&&a.setOffset(e.offset),e.scale!==void 0&&a.setScale(e.scale),e.max!==void 0&&a.setMax(e.max),e.min!==void 0&&a.setMin(e.min),e.required!==void 0&&a.setRequired(e.required),e.noData!==void 0&&a.setNoData(e.noData),e.default!==void 0&&a.setDefault(e.default),a}function mb(t,e){let a=t.createEnum();e.name!==void 0&&a.setName(e.name),e.description!==void 0&&a.setDescription(e.description),e.valueType!==void 0&&a.setValueType(e.valueType);let s=e.values||{};for(let r of s)a.addEnumValue(yb(t,r));return a}function yb(t,e){let a=t.createEnumValue();return e.name!==void 0&&a.setName(e.name),e.description!==void 0&&a.setDescription(e.description),e.value!==void 0&&a.setValue(e.value),a}function xb(t,e,a){let s=t.createPropertyTexture();s.setClass(a.class),a.name!==void 0&&s.setName(a.name);let r=a.properties||{};for(let n of Object.keys(r)){let i=wb(t,e,r[n]);s.setProperty(n,i)}return s}function wb(t,e,a){let s=t.createPropertyTextureProperty(),r=e.jsonDoc.json.textures||[];a.channels&&s.setChannels(a.channels);let n=r[a.index].source;if(n!==void 0){let i=e.textures[n];s.setTexture(i);let o=s.getTextureInfo();o&&e.setTextureInfo(o,a)}return a.offset!==void 0&&s.setOffset(a.offset),a.scale!==void 0&&s.setScale(a.scale),a.max!==void 0&&s.setMax(a.max),a.min!==void 0&&s.setMin(a.min),s}function vb(t,e,a){let s=t.createPropertyTable().setClass(a.class).setCount(a.count);a.name!==void 0&&s.setName(a.name);let r=a.properties||{};for(let n of Object.keys(r)){let i=kb(t,e,r[n]);s.setProperty(n,i)}return s}function kb(t,e,a){let s=t.createPropertyTableProperty(),r=an(e,a.values);if(s.setValues(r),a.arrayOffsets!==void 0){let n=an(e,a.arrayOffsets);s.setArrayOffsets(n)}if(a.stringOffsets!==void 0){let n=an(e,a.stringOffsets);s.setStringOffsets(n)}return a.arrayOffsetType!==void 0&&s.setArrayOffsetType(a.arrayOffsetType),a.stringOffsetType!==void 0&&s.setStringOffsetType(a.stringOffsetType),a.offset!==void 0&&s.setOffset(a.offset),a.scale!==void 0&&s.setScale(a.scale),a.max!==void 0&&s.setMax(a.max),a.min!==void 0&&s.setMin(a.min),s}function Eb(t,e){let a=t.createPropertyAttribute();a.setClass(e.class),e.name!==void 0&&a.setName(e.name);let s=e.properties||{};for(let r of Object.keys(s)){let n=Tb(t,s[r]);a.setProperty(r,n)}return a}function Tb(t,e){let a=t.createPropertyAttributeProperty();return a.setAttribute(e.attribute),e.offset!==void 0&&a.setOffset(e.offset),e.scale!==void 0&&a.setScale(e.scale),e.max!==void 0&&a.setMax(e.max),e.min!==void 0&&a.setMin(e.min),a}function Mb(t,e){let a={},s=e.getSchema();s&&(a.schema=_b(s));let r=e.getSchemaUri();r&&(a.schemaUri=r);let n=e.listPropertyTables();if(n.length>0){let c=[];for(let l of n){let f=Nb(t,l);c.push(f)}a.propertyTables=c}let i=e.listPropertyTextures();if(i.length>0){let c=[];for(let l of i){let f=Ob(t,l);c.push(f)}a.propertyTextures=c}let o=e.listPropertyAttributes();if(o.length>0){let c=[];for(let l of o){let f=Bb(l);c.push(f)}a.propertyAttributes=c}return a}function _b(t){let e={id:t.getId()},a=t.listClassKeys();if(a.length>0){e.classes={};for(let r of a){let n=Sb(t.getClass(r));e.classes[r]=n}}let s=t.listEnumKeys();if(s.length>0){e.enums={};for(let r of s){let n=Rb(t.getEnum(r));e.enums[r]=n}}return t.getName()&&(e.name=t.getName()),t.getDescription()&&(e.description=t.getDescription()),t.getVersion()&&(e.version=t.getVersion()),e}function Sb(t){let e={},a=t.listPropertyKeys();if(a.length>0){e.properties={};for(let s of a){let r=t.getProperty(s);e.properties[s]=Ab(r)}}return t.getName()&&(e.name=t.getName()),t.getDescription()&&(e.description=t.getDescription()),e}function Ab(t){let e={type:t.getType()};return t.getArray()&&(e.array=t.getArray()),t.getNormalized()&&(e.normalized=t.getNormalized()),t.getRequired()&&(e.required=t.getRequired()),t.getName()&&(e.name=t.getName()),t.getDescription()&&(e.description=t.getDescription()),t.getComponentType()!=null&&(e.componentType=t.getComponentType()),t.getEnumType()!=null&&(e.enumType=t.getEnumType()),t.getCount()!=null&&(e.count=t.getCount()),t.getOffset()!=null&&(e.offset=t.getOffset()),t.getScale()!=null&&(e.scale=t.getScale()),t.getMax()!=null&&(e.max=t.getMax()),t.getMin()!=null&&(e.min=t.getMin()),t.getNoData()!=null&&(e.noData=t.getNoData()),t.getDefault()!=null&&(e.default=t.getDefault()),e}function Rb(t){let e={values:t.listValues().map(Ib)};return t.getName()&&(e.name=t.getName()),t.getDescription()&&(e.description=t.getDescription()),t.getValueType()!=="UINT16"&&(e.valueType=t.getValueType()),e}function Ib(t){let e={name:t.getName(),value:t.getValue()};return t.getDescription()&&(e.description=t.getDescription()),e}function Nb(t,e){let a={class:e.getClass(),count:e.getCount()};e.getName()&&(a.name=e.getName());let s=e.listPropertyKeys();if(s.length>0){a.properties={};for(let r of s){let n=Cb(t,e.getProperty(r));a.properties[r]=n}}return a}function Cb(t,e){let a=e.getValues(),s={values:t.otherBufferViewsIndexMap.get(a)};if(e.getArrayOffsets()){let r=e.getArrayOffsets();s.arrayOffsets=t.otherBufferViewsIndexMap.get(r)}if(e.getStringOffsets()){let r=e.getStringOffsets();s.stringOffsets=t.otherBufferViewsIndexMap.get(r)}return e.getArrayOffsetType()!=null&&(s.arrayOffsetType=e.getArrayOffsetType()),e.getStringOffsetType()!=null&&(s.stringOffsetType=e.getStringOffsetType()),e.getOffset()!=null&&(s.offset=e.getOffset()),e.getScale()!=null&&(s.scale=e.getScale()),e.getMax()!=null&&(s.max=e.getMax()),e.getMin()!=null&&(s.min=e.getMin()),s}function Bb(t){let e={class:t.getClass()};t.getName()&&(e.name=t.getName());let a=t.listPropertyKeys();if(a.length>0){e.properties={};for(let s of a){let r=Fb(t.getProperty(s));e.properties[s]=r}}return e}function Fb(t){let e={attribute:t.getAttribute()};return t.getOffset()!=null&&(e.offset=t.getOffset()),t.getScale()!=null&&(e.scale=t.getScale()),t.getMax()!=null&&(e.max=t.getMax()),t.getMin()!=null&&(e.min=t.getMin()),e}function Ob(t,e){let a={class:e.getClass()};e.getName()&&(a.name=e.getName());let s=e.listPropertyKeys();if(s.length>0){a.properties={};for(let r of s){let n=Pb(t,e.getProperty(r));a.properties[r]=n}}return a}function Pb(t,e){let a=e.getTexture(),s=e.getTextureInfo(),r=e.getChannels(),n=t.createTextureInfoDef(a,s);return de.eq(r,[0])||(n.channels=r),e.getOffset()!=null&&(n.offset=e.getOffset()),e.getScale()!=null&&(n.scale=e.getScale()),e.getMax()!=null&&(n.max=e.getMax()),e.getMin()!=null&&(n.min=e.getMin()),n}function an(t,e){let a=t.jsonDoc,s=a.json.buffers||[],r=(a.json.bufferViews||[])[e],n=s[r.buffer],i=n.uri?a.resources[n.uri]:a.resources[ht],o=r.byteOffset||0,c=r.byteLength;return i.slice(o,o+c)}function jb(t,e){let a=t.getRoot().listBuffers()[0],s=e.otherBufferViews.get(a);return s||(s=[],e.otherBufferViews.set(a,s)),s}var Lb=class{match(t){return t.length>=12&&H.decodeText(t.slice(4,12))==="ftypavif"}getSize(t){if(!this.match(t))return null;let e=new DataView(t.buffer,t.byteOffset,t.byteLength),a=Qo(e,0);if(!a)return null;let s=a.end;for(;a=Qo(e,s);)if(a.type==="meta")s=a.start+4;else if(a.type==="iprp"||a.type==="ipco")s=a.start;else{if(a.type==="ispe")return[e.getUint32(a.start+4),e.getUint32(a.start+8)];if(a.type==="mdat")break;s=a.end}return null}getChannels(t){return 4}},Db=class extends ne{extensionName=Is;prereadTypes=[F.TEXTURE];static EXTENSION_NAME=Is;static register(){Ze.registerFormat("image/avif",new Lb)}preread(t){return(t.jsonDoc.json.textures||[]).forEach(e=>{e.extensions&&e.extensions.EXT_texture_avif&&(e.source=e.extensions[Is].source)}),this}read(t){return this}write(t){let e=t.jsonDoc;return this.document.getRoot().listTextures().forEach(a=>{if(a.getMimeType()==="image/avif"){let s=t.imageIndexMap.get(a);(e.json.textures||[]).forEach(r=>{r.source===s&&(r.extensions=r.extensions||{},r.extensions[Is]={source:r.source},delete r.source)})}}),this}};function Qo(t,e){if(t.byteLength<4+e)return null;let a=t.getUint32(e);return t.byteLength<a+e||a<8?null:{type:H.decodeText(new Uint8Array(t.buffer,t.byteOffset+e+4,4)),start:e+8,end:e+a}}var Ub=class{match(t){return t.length>=12&&t[8]===87&&t[9]===69&&t[10]===66&&t[11]===80}getSize(t){let e=H.decodeText(t.slice(0,4)),a=H.decodeText(t.slice(8,12));if(e!=="RIFF"||a!=="WEBP")return null;let s=new DataView(t.buffer,t.byteOffset),r=12;for(;r<s.byteLength;){let n=H.decodeText(new Uint8Array([s.getUint8(r),s.getUint8(r+1),s.getUint8(r+2),s.getUint8(r+3)])),i=s.getUint32(r+4,!0);if(n==="VP8 ")return[s.getInt16(r+14,!0)&16383,s.getInt16(r+16,!0)&16383];if(n==="VP8L"){let o=s.getUint8(r+9),c=s.getUint8(r+10),l=s.getUint8(r+11),f=s.getUint8(r+12);return[1+((c&63)<<8|o),1+((f&15)<<10|l<<2|(c&192)>>6)]}r+=8+i+i%2}return null}getChannels(t){return 4}},zb=class extends ne{extensionName=Rs;prereadTypes=[F.TEXTURE];static EXTENSION_NAME=Rs;static register(){Ze.registerFormat("image/webp",new Ub)}preread(t){return(t.jsonDoc.json.textures||[]).forEach(e=>{e.extensions&&e.extensions.EXT_texture_webp&&(e.source=e.extensions[Rs].source)}),this}read(t){return this}write(t){let e=t.jsonDoc;return this.document.getRoot().listTextures().forEach(a=>{if(a.getMimeType()==="image/webp"){let s=t.imageIndexMap.get(a);(e.json.textures||[]).forEach(r=>{r.source===s&&(r.extensions=r.extensions||{},r.extensions[Rs]={source:r.source},delete r.source)})}}),this}},Zo=Ch,Gb=class extends ne{extensionName=Zo;static EXTENSION_NAME=Zo;read(t){return this}write(t){return this}},ec=Bh,Kb=class extends ne{extensionName=ec;static EXTENSION_NAME=ec;read(t){return this}write(t){return this}},ve,bc,pc;function Vb(t,e){let a=new ve.DecoderBuffer;try{if(a.Init(e,e.length),t.GetEncodedGeometryType(a)!==ve.TRIANGULAR_MESH)throw new Error(`[${me}] Unknown geometry type.`);let s=new ve.Mesh;if(!t.DecodeBufferToMesh(a,s).ok()||s.ptr===0)throw new Error(`[${me}] Decoding failure.`);return s}finally{ve.destroy(a)}}function Hb(t,e){let a=e.num_faces()*3,s,r;if(e.num_points()<=65534){let n=a*Uint16Array.BYTES_PER_ELEMENT;s=ve._malloc(n),t.GetTrianglesUInt16Array(e,n,s),r=new Uint16Array(ve.HEAPU16.buffer,s,a).slice()}else{let n=a*Uint32Array.BYTES_PER_ELEMENT;s=ve._malloc(n),t.GetTrianglesUInt32Array(e,n,s),r=new Uint32Array(ve.HEAPU32.buffer,s,a).slice()}return ve._free(s),r}function qb(t,e,a,s){let r=pc[s.componentType],n=bc[s.componentType],i=a.num_components(),o=e.num_points()*i,c=o*n.BYTES_PER_ELEMENT,l=ve._malloc(c);t.GetAttributeDataArrayForAllPoints(e,a,r,c,l);let f=new n(ve.HEAPF32.buffer,l,o).slice();return ve._free(l),f}function Wb(t){ve=t,bc={[z.ComponentType.FLOAT]:Float32Array,[z.ComponentType.UNSIGNED_INT]:Uint32Array,[z.ComponentType.UNSIGNED_SHORT]:Uint16Array,[z.ComponentType.UNSIGNED_BYTE]:Uint8Array,[z.ComponentType.SHORT]:Int16Array,[z.ComponentType.BYTE]:Int8Array},pc={[z.ComponentType.FLOAT]:ve.DT_FLOAT32,[z.ComponentType.UNSIGNED_INT]:ve.DT_UINT32,[z.ComponentType.UNSIGNED_SHORT]:ve.DT_UINT16,[z.ComponentType.UNSIGNED_BYTE]:ve.DT_UINT8,[z.ComponentType.SHORT]:ve.DT_INT16,[z.ComponentType.BYTE]:ve.DT_INT8}}var ze,Xb=(function(t){return t[t.EDGEBREAKER=1]="EDGEBREAKER",t[t.SEQUENTIAL=0]="SEQUENTIAL",t})({}),gc={POSITION:14,NORMAL:10,COLOR:8,TEX_COORD:12,GENERIC:12},tc={decodeSpeed:5,encodeSpeed:5,method:1,quantizationBits:gc,quantizationVolume:"mesh"};function $b(t){ze=t}function Yb(t,e=tc){let a={...tc,...e};a.quantizationBits={...gc,...e.quantizationBits};let s=new ze.MeshBuilder,r=new ze.Mesh,n=new ze.ExpertEncoder(r),i={},o=new ze.DracoInt8Array,c=t.listTargets().length>0,l=!1;for(let d of t.listSemantics()){let m=t.getAttribute(d);if(m.getSparse()){l=!0;continue}let b=Jb(d),y=Qb(s,m.getComponentType(),r,ze[b],m.getCount(),m.getElementSize(),m.getArray());if(y===-1)throw new Error(`Error compressing "${d}" attribute.`);if(i[d]=y,a.quantizationVolume==="mesh"||d!=="POSITION")n.SetAttributeQuantization(y,a.quantizationBits[b]);else if(typeof a.quantizationVolume=="object"){let{quantizationVolume:x}=a,w=Math.max(x.max[0]-x.min[0],x.max[1]-x.min[1],x.max[2]-x.min[2]);n.SetAttributeExplicitQuantization(y,a.quantizationBits[b],m.getElementSize(),x.min,w)}else throw new Error("Invalid quantization volume state.")}let f=t.getIndices();if(!f)throw new on("Primitive must have indices.");s.AddFacesToMesh(r,f.getCount()/3,f.getArray()),n.SetSpeedOptions(a.encodeSpeed,a.decodeSpeed),n.SetTrackEncodedProperties(!0),a.method===0||c||l?n.SetEncodingMethod(ze.MESH_SEQUENTIAL_ENCODING):n.SetEncodingMethod(ze.MESH_EDGEBREAKER_ENCODING);let u=n.EncodeToDracoBuffer(!(c||l),o);if(u<=0)throw new on("Error applying Draco compression.");let g=new Uint8Array(u);for(let d=0;d<u;++d)g[d]=o.GetValue(d);let p=n.GetNumberOfEncodedPoints(),h=n.GetNumberOfEncodedFaces()*3;return ze.destroy(o),ze.destroy(r),ze.destroy(s),ze.destroy(n),{numVertices:p,numIndices:h,data:g,attributeIDs:i}}function Jb(t){return t==="POSITION"?"POSITION":t==="NORMAL"?"NORMAL":t.startsWith("COLOR_")?"COLOR":t.startsWith("TEXCOORD_")?"TEX_COORD":"GENERIC"}function Qb(t,e,a,s,r,n,i){switch(e){case z.ComponentType.UNSIGNED_BYTE:return t.AddUInt8Attribute(a,s,r,n,i);case z.ComponentType.BYTE:return t.AddInt8Attribute(a,s,r,n,i);case z.ComponentType.UNSIGNED_SHORT:return t.AddUInt16Attribute(a,s,r,n,i);case z.ComponentType.SHORT:return t.AddInt16Attribute(a,s,r,n,i);case z.ComponentType.UNSIGNED_INT:return t.AddUInt32Attribute(a,s,r,n,i);case z.ComponentType.FLOAT:return t.AddFloatAttribute(a,s,r,n,i);default:throw new Error(`Unexpected component type, "${e}".`)}}var on=class extends Error{},Zb=class extends ne{extensionName=me;prereadTypes=[F.PRIMITIVE];prewriteTypes=[F.ACCESSOR];readDependencies=["draco3d.decoder"];writeDependencies=["draco3d.encoder"];static EXTENSION_NAME=me;static EncoderMethod=Xb;_decoderModule=null;_encoderModule=null;_encoderOptions={};install(t,e){return t==="draco3d.decoder"&&(this._decoderModule=e,Wb(this._decoderModule)),t==="draco3d.encoder"&&(this._encoderModule=e,$b(this._encoderModule)),this}setEncoderOptions(t){return this._encoderOptions=t,this}preread(t){if(!this._decoderModule)throw new Error(`[${me}] Please install extension dependency, "draco3d.decoder".`);let e=this.document.getLogger(),a=t.jsonDoc,s=new Map;try{let r=a.json.meshes||[];for(let n of r)for(let i of n.primitives){if(!i.extensions||!i.extensions.KHR_draco_mesh_compression)continue;let o=i.extensions[me],[c,l]=s.get(o.bufferView)||[];if(!l||!c){let f=a.json.bufferViews[o.bufferView],u=a.json.buffers[f.buffer],g=u.uri?a.resources[u.uri]:a.resources[ht],p=f.byteOffset||0,h=f.byteLength,d=H.toView(g,p,h);c=new this._decoderModule.Decoder,l=Vb(c,d),s.set(o.bufferView,[c,l]),e.debug(`[${me}] Decompressed ${d.byteLength} bytes.`)}for(let f in o.attributes){let u=t.jsonDoc.json.accessors[i.attributes[f]],g=c.GetAttributeByUniqueId(l,o.attributes[f]),p=qb(c,l,g,u);t.accessors[i.attributes[f]].setArray(p)}i.indices!==void 0&&t.accessors[i.indices].setArray(Hb(c,l))}}finally{for(let[r,n]of Array.from(s.values()))this._decoderModule.destroy(r),this._decoderModule.destroy(n)}return this}read(t){return this}prewrite(t,e){if(!this._encoderModule)throw new Error(`[${me}] Please install extension dependency, "draco3d.encoder".`);let a=this.document.getLogger();a.debug(`[${me}] Compression options: ${JSON.stringify(this._encoderOptions)}`);let s=ep(this.document),r=new Map,n="mesh";this._encoderOptions.quantizationVolume==="scene"&&(this.document.getRoot().listScenes().length!==1?a.warn(`[${me}]: quantizationVolume=scene requires exactly 1 scene.`):n=Ao(this.document.getRoot().listScenes().pop()));for(let i of Array.from(s.keys())){let o=s.get(i);if(!o)throw new Error("Unexpected primitive.");if(r.has(o)){r.set(o,r.get(o));continue}let c=i.getIndices(),l=t.jsonDoc.json.accessors,f;try{f=Yb(i,{...this._encoderOptions,quantizationVolume:n})}catch(p){if(p instanceof on){a.warn(`[${me}]: ${p.message} Skipping primitive compression.`);continue}throw p}r.set(o,f);let u=t.createAccessorDef(c);u.count=f.numIndices,t.accessorIndexMap.set(c,l.length),l.push(u),f.numVertices>65534&&z.getComponentSize(u.componentType)<=2?u.componentType=z.ComponentType.UNSIGNED_INT:f.numVertices>254&&z.getComponentSize(u.componentType)<=1&&(u.componentType=z.ComponentType.UNSIGNED_SHORT);for(let p of i.listSemantics()){let h=i.getAttribute(p);if(f.attributeIDs[p]===void 0)continue;let d=t.createAccessorDef(h);d.count=f.numVertices,t.accessorIndexMap.set(h,l.length),l.push(d)}let g=i.getAttribute("POSITION").getBuffer()||this.document.getRoot().listBuffers()[0];t.otherBufferViews.has(g)||t.otherBufferViews.set(g,[]),t.otherBufferViews.get(g).push(f.data)}return a.debug(`[${me}] Compressed ${s.size} primitives.`),t.extensionData[me]={primitiveHashMap:s,primitiveEncodingMap:r},this}write(t){let e=t.extensionData[me];for(let a of this.document.getRoot().listMeshes()){let s=t.jsonDoc.json.meshes[t.meshIndexMap.get(a)];for(let r=0;r<a.listPrimitives().length;r++){let n=a.listPrimitives()[r],i=s.primitives[r],o=e.primitiveHashMap.get(n);if(!o)continue;let c=e.primitiveEncodingMap.get(o);c&&(i.extensions=i.extensions||{},i.extensions[me]={bufferView:t.otherBufferViewsIndexMap.get(c.data),attributes:c.attributeIDs})}}if(!e.primitiveHashMap.size){let a=t.jsonDoc.json;a.extensionsUsed=(a.extensionsUsed||[]).filter(s=>s!==me),a.extensionsRequired=(a.extensionsRequired||[]).filter(s=>s!==me)}return this}};function ep(t){let e=t.getLogger(),a=new Set,s=new Set,r=0,n=0;for(let u of t.getRoot().listMeshes())for(let g of u.listPrimitives())g.getIndices()?g.getMode()!==wa.Mode.TRIANGLES?(s.add(g),n++):a.add(g):(s.add(g),r++);r>0&&e.warn(`[${me}] Skipping Draco compression of ${r} non-indexed primitives.`),n>0&&e.warn(`[${me}] Skipping Draco compression of ${n} non-TRIANGLES primitives.`);let i=t.getRoot().listAccessors(),o=new Map;for(let u=0;u<i.length;u++)o.set(i[u],u);let c=new Map,l=new Set,f=new Map;for(let u of Array.from(a)){let g=ac(u,o);if(l.has(g)){f.set(u,g);continue}if(c.has(u.getIndices())){let p=u.getIndices(),h=p.clone();o.set(h,t.getRoot().listAccessors().length-1),u.swap(p,h)}for(let p of u.listAttributes())if(c.has(p)){let h=p.clone();o.set(h,t.getRoot().listAccessors().length-1),u.swap(p,h)}g=ac(u,o),l.add(g),f.set(u,g),c.set(u.getIndices(),g);for(let p of u.listAttributes())c.set(p,g)}for(let u of Array.from(c.keys())){let g=new Set(u.listParents().map(p=>p.propertyType));if(g.size!==2||!g.has(F.PRIMITIVE)||!g.has(F.ROOT))throw new Error(`[${me}] Compressed accessors must only be used as indices or vertex attributes.`)}for(let u of Array.from(a)){let g=f.get(u),p=u.getIndices();if(c.get(p)!==g||u.listAttributes().some(h=>c.get(h)!==g))throw new Error(`[${me}] Draco primitives must share all, or no, accessors.`)}for(let u of Array.from(s)){let g=u.getIndices();if(c.has(g)||u.listAttributes().some(p=>c.has(p)))throw new Error(`[${me}] Accessor cannot be shared by compressed and uncompressed primitives.`)}return f}function ac(t,e){let a=[],s=t.getIndices();a.push(e.get(s));for(let r of t.listAttributes())a.push(e.get(r));return a.sort().join("|")}var sc=class mc extends ${static EXTENSION_NAME=nt;static Type={POINT:"point",SPOT:"spot",DIRECTIONAL:"directional"};init(){this.extensionName=nt,this.propertyType="Light",this.parentTypes=[F.NODE]}getDefaults(){return Object.assign(super.getDefaults(),{color:[1,1,1],intensity:1,type:mc.Type.POINT,range:null,innerConeAngle:0,outerConeAngle:Math.PI/4})}getColor(){return this.get("color")}setColor(e){return this.set("color",e)}getIntensity(){return this.get("intensity")}setIntensity(e){return this.set("intensity",e)}getType(){return this.get("type")}setType(e){return this.set("type",e)}getRange(){return this.get("range")}setRange(e){return this.set("range",e)}getInnerConeAngle(){return this.get("innerConeAngle")}setInnerConeAngle(e){return this.set("innerConeAngle",e)}getOuterConeAngle(){return this.get("outerConeAngle")}setOuterConeAngle(e){return this.set("outerConeAngle",e)}},tp=class extends ne{extensionName=nt;static EXTENSION_NAME=nt;createLight(t=""){return new sc(this.document.getGraph(),t)}read(t){let e=t.jsonDoc;if(!e.json.extensions||!e.json.extensions.KHR_lights_punctual)return this;let a=(e.json.extensions.KHR_lights_punctual.lights||[]).map(s=>{let r=this.createLight().setName(s.name||"").setType(s.type);return s.extras&&r.setExtras(s.extras),s.color!==void 0&&r.setColor(s.color),s.intensity!==void 0&&r.setIntensity(s.intensity),s.range!==void 0&&r.setRange(s.range),s.spot?.innerConeAngle!==void 0&&r.setInnerConeAngle(s.spot.innerConeAngle),s.spot?.outerConeAngle!==void 0&&r.setOuterConeAngle(s.spot.outerConeAngle),r});return e.json.nodes.forEach((s,r)=>{if(!s.extensions||!s.extensions.KHR_lights_punctual)return;let n=s.extensions[nt];t.nodes[r].setExtension(nt,a[n.light])}),this}write(t){let e=t.jsonDoc;if(this.properties.size===0)return this;let a=[],s=new Map;for(let r of this.properties){let n=r,i=t.createPropertyDef(r);i.type=n.getType(),de.eq(n.getColor(),[1,1,1])||(i.color=n.getColor()),n.getIntensity()!==1&&(i.intensity=n.getIntensity()),n.getRange()!=null&&(i.range=n.getRange()),n.getName()&&(i.name=n.getName()),n.getType()===sc.Type.SPOT&&(i.spot={innerConeAngle:n.getInnerConeAngle(),outerConeAngle:n.getOuterConeAngle()}),a.push(i),s.set(n,a.length-1)}return this.document.getRoot().listNodes().forEach(r=>{let n=r.getExtension(nt);if(n){let i=t.nodeIndexMap.get(r),o=e.json.nodes[i];o.extensions=o.extensions||{},o.extensions[nt]={light:s.get(n)}}}),e.json.extensions=e.json.extensions||{},e.json.extensions[nt]={lights:a},this}},{R:ap,G:sp,B:rp}=qe,np=class extends ${static EXTENSION_NAME=gt;init(){this.extensionName=gt,this.propertyType="Anisotropy",this.parentTypes=[F.MATERIAL]}getDefaults(){return Object.assign(super.getDefaults(),{anisotropyStrength:0,anisotropyRotation:0,anisotropyTexture:null,anisotropyTextureInfo:new le(this.graph,"anisotropyTextureInfo")})}getAnisotropyStrength(){return this.get("anisotropyStrength")}setAnisotropyStrength(t){return this.set("anisotropyStrength",t)}getAnisotropyRotation(){return this.get("anisotropyRotation")}setAnisotropyRotation(t){return this.set("anisotropyRotation",t)}getAnisotropyTexture(){return this.getRef("anisotropyTexture")}getAnisotropyTextureInfo(){return this.getRef("anisotropyTexture")?this.getRef("anisotropyTextureInfo"):null}setAnisotropyTexture(t){return this.setRef("anisotropyTexture",t,{channels:ap|sp|rp})}},ip=class extends ne{static EXTENSION_NAME=gt;extensionName=gt;prereadTypes=[F.MESH];prewriteTypes=[F.MESH];createAnisotropy(){return new np(this.document.getGraph())}read(t){return this}write(t){return this}preread(t){let e=t.jsonDoc,a=e.json.materials||[],s=e.json.textures||[];return a.forEach((r,n)=>{if(r.extensions&&r.extensions.KHR_materials_anisotropy){let i=this.createAnisotropy();t.materials[n].setExtension(gt,i);let o=r.extensions[gt];if(o.extras&&i.setExtras(o.extras),o.anisotropyStrength!==void 0&&i.setAnisotropyStrength(o.anisotropyStrength),o.anisotropyRotation!==void 0&&i.setAnisotropyRotation(o.anisotropyRotation),o.anisotropyTexture!==void 0){let c=o.anisotropyTexture,l=t.textures[s[c.index].source];i.setAnisotropyTexture(l),t.setTextureInfo(i.getAnisotropyTextureInfo(),c)}}}),this}prewrite(t){let e=t.jsonDoc;return this.document.getRoot().listMaterials().forEach(a=>{let s=a.getExtension(gt);if(s){let r=t.materialIndexMap.get(a),n=e.json.materials[r],i=t.createPropertyDef(s);if(n.extensions=n.extensions||{},n.extensions[gt]=i,s.getAnisotropyStrength()>0&&(i.anisotropyStrength=s.getAnisotropyStrength()),s.getAnisotropyRotation()!==0&&(i.anisotropyRotation=s.getAnisotropyRotation()),s.getAnisotropyTexture()){let o=s.getAnisotropyTexture(),c=s.getAnisotropyTextureInfo();i.anisotropyTexture=t.createTextureInfoDef(o,c)}}}),this}},{R:rc,G:nc,B:op}=qe,cp=class extends ${static EXTENSION_NAME=mt;init(){this.extensionName=mt,this.propertyType="Clearcoat",this.parentTypes=[F.MATERIAL]}getDefaults(){return Object.assign(super.getDefaults(),{clearcoatFactor:0,clearcoatTexture:null,clearcoatTextureInfo:new le(this.graph,"clearcoatTextureInfo"),clearcoatRoughnessFactor:0,clearcoatRoughnessTexture:null,clearcoatRoughnessTextureInfo:new le(this.graph,"clearcoatRoughnessTextureInfo"),clearcoatNormalScale:1,clearcoatNormalTexture:null,clearcoatNormalTextureInfo:new le(this.graph,"clearcoatNormalTextureInfo")})}getClearcoatFactor(){return this.get("clearcoatFactor")}setClearcoatFactor(t){return this.set("clearcoatFactor",t)}getClearcoatTexture(){return this.getRef("clearcoatTexture")}getClearcoatTextureInfo(){return this.getRef("clearcoatTexture")?this.getRef("clearcoatTextureInfo"):null}setClearcoatTexture(t){return this.setRef("clearcoatTexture",t,{channels:rc})}getClearcoatRoughnessFactor(){return this.get("clearcoatRoughnessFactor")}setClearcoatRoughnessFactor(t){return this.set("clearcoatRoughnessFactor",t)}getClearcoatRoughnessTexture(){return this.getRef("clearcoatRoughnessTexture")}getClearcoatRoughnessTextureInfo(){return this.getRef("clearcoatRoughnessTexture")?this.getRef("clearcoatRoughnessTextureInfo"):null}setClearcoatRoughnessTexture(t){return this.setRef("clearcoatRoughnessTexture",t,{channels:nc})}getClearcoatNormalScale(){return this.get("clearcoatNormalScale")}setClearcoatNormalScale(t){return this.set("clearcoatNormalScale",t)}getClearcoatNormalTexture(){return this.getRef("clearcoatNormalTexture")}getClearcoatNormalTextureInfo(){return this.getRef("clearcoatNormalTexture")?this.getRef("clearcoatNormalTextureInfo"):null}setClearcoatNormalTexture(t){return this.setRef("clearcoatNormalTexture",t,{channels:rc|nc|op})}},lp=class extends ne{static EXTENSION_NAME=mt;extensionName=mt;prereadTypes=[F.MESH];prewriteTypes=[F.MESH];createClearcoat(){return new cp(this.document.getGraph())}read(t){return this}write(t){return this}preread(t){let e=t.jsonDoc,a=e.json.materials||[],s=e.json.textures||[];return a.forEach((r,n)=>{if(r.extensions&&r.extensions.KHR_materials_clearcoat){let i=this.createClearcoat();t.materials[n].setExtension(mt,i);let o=r.extensions[mt];if(o.extras&&i.setExtras(o.extras),o.clearcoatFactor!==void 0&&i.setClearcoatFactor(o.clearcoatFactor),o.clearcoatRoughnessFactor!==void 0&&i.setClearcoatRoughnessFactor(o.clearcoatRoughnessFactor),o.clearcoatTexture!==void 0){let c=o.clearcoatTexture,l=t.textures[s[c.index].source];i.setClearcoatTexture(l),t.setTextureInfo(i.getClearcoatTextureInfo(),c)}if(o.clearcoatRoughnessTexture!==void 0){let c=o.clearcoatRoughnessTexture,l=t.textures[s[c.index].source];i.setClearcoatRoughnessTexture(l),t.setTextureInfo(i.getClearcoatRoughnessTextureInfo(),c)}if(o.clearcoatNormalTexture!==void 0){let c=o.clearcoatNormalTexture,l=t.textures[s[c.index].source];i.setClearcoatNormalTexture(l),t.setTextureInfo(i.getClearcoatNormalTextureInfo(),c),c.scale!==void 0&&i.setClearcoatNormalScale(c.scale)}}}),this}prewrite(t){let e=t.jsonDoc;return this.document.getRoot().listMaterials().forEach(a=>{let s=a.getExtension(mt);if(s){let r=t.materialIndexMap.get(a),n=e.json.materials[r],i=t.createPropertyDef(s);if(n.extensions=n.extensions||{},n.extensions[mt]=i,i.clearcoatFactor=s.getClearcoatFactor(),i.clearcoatRoughnessFactor=s.getClearcoatRoughnessFactor(),s.getClearcoatTexture()){let o=s.getClearcoatTexture(),c=s.getClearcoatTextureInfo();i.clearcoatTexture=t.createTextureInfoDef(o,c)}if(s.getClearcoatRoughnessTexture()){let o=s.getClearcoatRoughnessTexture(),c=s.getClearcoatRoughnessTextureInfo();i.clearcoatRoughnessTexture=t.createTextureInfoDef(o,c)}if(s.getClearcoatNormalTexture()){let o=s.getClearcoatNormalTexture(),c=s.getClearcoatNormalTextureInfo();i.clearcoatNormalTexture=t.createTextureInfoDef(o,c),s.getClearcoatNormalScale()!==1&&(i.clearcoatNormalTexture.scale=s.getClearcoatNormalScale())}}}),this}},{R:dp,G:up,B:fp,A:hp}=qe,bp=class extends ${static EXTENSION_NAME=yt;init(){this.extensionName=yt,this.propertyType="DiffuseTransmission",this.parentTypes=[F.MATERIAL]}getDefaults(){return Object.assign(super.getDefaults(),{diffuseTransmissionFactor:0,diffuseTransmissionTexture:null,diffuseTransmissionTextureInfo:new le(this.graph,"diffuseTransmissionTextureInfo"),diffuseTransmissionColorFactor:[1,1,1],diffuseTransmissionColorTexture:null,diffuseTransmissionColorTextureInfo:new le(this.graph,"diffuseTransmissionColorTextureInfo")})}getDiffuseTransmissionFactor(){return this.get("diffuseTransmissionFactor")}setDiffuseTransmissionFactor(t){return this.set("diffuseTransmissionFactor",t)}getDiffuseTransmissionTexture(){return this.getRef("diffuseTransmissionTexture")}getDiffuseTransmissionTextureInfo(){return this.getRef("diffuseTransmissionTexture")?this.getRef("diffuseTransmissionTextureInfo"):null}setDiffuseTransmissionTexture(t){return this.setRef("diffuseTransmissionTexture",t,{channels:hp})}getDiffuseTransmissionColorFactor(){return this.get("diffuseTransmissionColorFactor")}setDiffuseTransmissionColorFactor(t){return this.set("diffuseTransmissionColorFactor",t)}getDiffuseTransmissionColorTexture(){return this.getRef("diffuseTransmissionColorTexture")}getDiffuseTransmissionColorTextureInfo(){return this.getRef("diffuseTransmissionColorTexture")?this.getRef("diffuseTransmissionColorTextureInfo"):null}setDiffuseTransmissionColorTexture(t){return this.setRef("diffuseTransmissionColorTexture",t,{channels:dp|up|fp})}},pp=class extends ne{extensionName=yt;static EXTENSION_NAME=yt;createDiffuseTransmission(){return new bp(this.document.getGraph())}read(t){let e=t.jsonDoc,a=e.json.materials||[],s=e.json.textures||[];return a.forEach((r,n)=>{if(r.extensions&&r.extensions.KHR_materials_diffuse_transmission){let i=this.createDiffuseTransmission();t.materials[n].setExtension(yt,i);let o=r.extensions[yt];if(o.extras&&i.setExtras(o.extras),o.diffuseTransmissionFactor!==void 0&&i.setDiffuseTransmissionFactor(o.diffuseTransmissionFactor),o.diffuseTransmissionColorFactor!==void 0&&i.setDiffuseTransmissionColorFactor(o.diffuseTransmissionColorFactor),o.diffuseTransmissionTexture!==void 0){let c=o.diffuseTransmissionTexture,l=t.textures[s[c.index].source];i.setDiffuseTransmissionTexture(l),t.setTextureInfo(i.getDiffuseTransmissionTextureInfo(),c)}if(o.diffuseTransmissionColorTexture!==void 0){let c=o.diffuseTransmissionColorTexture,l=t.textures[s[c.index].source];i.setDiffuseTransmissionColorTexture(l),t.setTextureInfo(i.getDiffuseTransmissionColorTextureInfo(),c)}}}),this}write(t){let e=t.jsonDoc;for(let a of this.document.getRoot().listMaterials()){let s=a.getExtension(yt);if(!s)continue;let r=t.materialIndexMap.get(a),n=e.json.materials[r],i=t.createPropertyDef(s);if(n.extensions=n.extensions||{},n.extensions[yt]=i,i.diffuseTransmissionFactor=s.getDiffuseTransmissionFactor(),i.diffuseTransmissionColorFactor=s.getDiffuseTransmissionColorFactor(),s.getDiffuseTransmissionTexture()){let o=s.getDiffuseTransmissionTexture(),c=s.getDiffuseTransmissionTextureInfo();i.diffuseTransmissionTexture=t.createTextureInfoDef(o,c)}if(s.getDiffuseTransmissionColorTexture()){let o=s.getDiffuseTransmissionColorTexture(),c=s.getDiffuseTransmissionColorTextureInfo();i.diffuseTransmissionColorTexture=t.createTextureInfoDef(o,c)}}return this}},gp=class extends ${static EXTENSION_NAME=xt;init(){this.extensionName=xt,this.propertyType="Dispersion",this.parentTypes=[F.MATERIAL]}getDefaults(){return Object.assign(super.getDefaults(),{dispersion:0})}getDispersion(){return this.get("dispersion")}setDispersion(t){return this.set("dispersion",t)}},mp=class extends ne{static EXTENSION_NAME=xt;extensionName=xt;prereadTypes=[F.MESH];prewriteTypes=[F.MESH];createDispersion(){return new gp(this.document.getGraph())}read(t){return this}write(t){return this}preread(t){return(t.jsonDoc.json.materials||[]).forEach((e,a)=>{if(e.extensions&&e.extensions.KHR_materials_dispersion){let s=this.createDispersion();t.materials[a].setExtension(xt,s);let r=e.extensions[xt];r.extras&&s.setExtras(r.extras),r.dispersion!==void 0&&s.setDispersion(r.dispersion)}}),this}prewrite(t){let e=t.jsonDoc;return this.document.getRoot().listMaterials().forEach(a=>{let s=a.getExtension(xt);if(s){let r=t.materialIndexMap.get(a),n=e.json.materials[r],i=t.createPropertyDef(s);n.extensions=n.extensions||{},n.extensions[xt]=i,i.dispersion=s.getDispersion()}}),this}},yp=class extends ${static EXTENSION_NAME=wt;init(){this.extensionName=wt,this.propertyType="EmissiveStrength",this.parentTypes=[F.MATERIAL]}getDefaults(){return Object.assign(super.getDefaults(),{emissiveStrength:1})}getEmissiveStrength(){return this.get("emissiveStrength")}setEmissiveStrength(t){return this.set("emissiveStrength",t)}},xp=class extends ne{static EXTENSION_NAME=wt;extensionName=wt;prereadTypes=[F.MESH];prewriteTypes=[F.MESH];createEmissiveStrength(){return new yp(this.document.getGraph())}read(t){return this}write(t){return this}preread(t){return(t.jsonDoc.json.materials||[]).forEach((e,a)=>{if(e.extensions&&e.extensions.KHR_materials_emissive_strength){let s=this.createEmissiveStrength();t.materials[a].setExtension(wt,s);let r=e.extensions[wt];r.extras&&s.setExtras(r.extras),r.emissiveStrength!==void 0&&s.setEmissiveStrength(r.emissiveStrength)}}),this}prewrite(t){let e=t.jsonDoc;return this.document.getRoot().listMaterials().forEach(a=>{let s=a.getExtension(wt);if(s){let r=t.materialIndexMap.get(a),n=e.json.materials[r],i=t.createPropertyDef(s);n.extensions=n.extensions||{},n.extensions[wt]=i,i.emissiveStrength=s.getEmissiveStrength()}}),this}},wp=class extends ${static EXTENSION_NAME=vt;init(){this.extensionName=vt,this.propertyType="IOR",this.parentTypes=[F.MATERIAL]}getDefaults(){return Object.assign(super.getDefaults(),{ior:1.5})}getIOR(){return this.get("ior")}setIOR(t){return this.set("ior",t)}},vp=class extends ne{static EXTENSION_NAME=vt;extensionName=vt;prereadTypes=[F.MESH];prewriteTypes=[F.MESH];createIOR(){return new wp(this.document.getGraph())}read(t){return this}write(t){return this}preread(t){return(t.jsonDoc.json.materials||[]).forEach((e,a)=>{if(e.extensions&&e.extensions.KHR_materials_ior){let s=this.createIOR();t.materials[a].setExtension(vt,s);let r=e.extensions[vt];r.extras&&s.setExtras(r.extras),r.ior!==void 0&&s.setIOR(r.ior)}}),this}prewrite(t){let e=t.jsonDoc;return this.document.getRoot().listMaterials().forEach(a=>{let s=a.getExtension(vt);if(s){let r=t.materialIndexMap.get(a),n=e.json.materials[r],i=t.createPropertyDef(s);n.extensions=n.extensions||{},n.extensions[vt]=i,i.ior=s.getIOR()}}),this}},{R:kp,G:Ep}=qe,Tp=class extends ${static EXTENSION_NAME=kt;init(){this.extensionName=kt,this.propertyType="Iridescence",this.parentTypes=[F.MATERIAL]}getDefaults(){return Object.assign(super.getDefaults(),{iridescenceFactor:0,iridescenceTexture:null,iridescenceTextureInfo:new le(this.graph,"iridescenceTextureInfo"),iridescenceIOR:1.3,iridescenceThicknessMinimum:100,iridescenceThicknessMaximum:400,iridescenceThicknessTexture:null,iridescenceThicknessTextureInfo:new le(this.graph,"iridescenceThicknessTextureInfo")})}getIridescenceFactor(){return this.get("iridescenceFactor")}setIridescenceFactor(t){return this.set("iridescenceFactor",t)}getIridescenceTexture(){return this.getRef("iridescenceTexture")}getIridescenceTextureInfo(){return this.getRef("iridescenceTexture")?this.getRef("iridescenceTextureInfo"):null}setIridescenceTexture(t){return this.setRef("iridescenceTexture",t,{channels:kp})}getIridescenceIOR(){return this.get("iridescenceIOR")}setIridescenceIOR(t){return this.set("iridescenceIOR",t)}getIridescenceThicknessMinimum(){return this.get("iridescenceThicknessMinimum")}setIridescenceThicknessMinimum(t){return this.set("iridescenceThicknessMinimum",t)}getIridescenceThicknessMaximum(){return this.get("iridescenceThicknessMaximum")}setIridescenceThicknessMaximum(t){return this.set("iridescenceThicknessMaximum",t)}getIridescenceThicknessTexture(){return this.getRef("iridescenceThicknessTexture")}getIridescenceThicknessTextureInfo(){return this.getRef("iridescenceThicknessTexture")?this.getRef("iridescenceThicknessTextureInfo"):null}setIridescenceThicknessTexture(t){return this.setRef("iridescenceThicknessTexture",t,{channels:Ep})}},Mp=class extends ne{static EXTENSION_NAME=kt;extensionName=kt;prereadTypes=[F.MESH];prewriteTypes=[F.MESH];createIridescence(){return new Tp(this.document.getGraph())}read(t){return this}write(t){return this}preread(t){let e=t.jsonDoc,a=e.json.materials||[],s=e.json.textures||[];return a.forEach((r,n)=>{if(r.extensions&&r.extensions.KHR_materials_iridescence){let i=this.createIridescence();t.materials[n].setExtension(kt,i);let o=r.extensions[kt];if(o.extras&&i.setExtras(o.extras),o.iridescenceFactor!==void 0&&i.setIridescenceFactor(o.iridescenceFactor),o.iridescenceIor!==void 0&&i.setIridescenceIOR(o.iridescenceIor),o.iridescenceThicknessMinimum!==void 0&&i.setIridescenceThicknessMinimum(o.iridescenceThicknessMinimum),o.iridescenceThicknessMaximum!==void 0&&i.setIridescenceThicknessMaximum(o.iridescenceThicknessMaximum),o.iridescenceTexture!==void 0){let c=o.iridescenceTexture,l=t.textures[s[c.index].source];i.setIridescenceTexture(l),t.setTextureInfo(i.getIridescenceTextureInfo(),c)}if(o.iridescenceThicknessTexture!==void 0){let c=o.iridescenceThicknessTexture,l=t.textures[s[c.index].source];i.setIridescenceThicknessTexture(l),t.setTextureInfo(i.getIridescenceThicknessTextureInfo(),c)}}}),this}prewrite(t){let e=t.jsonDoc;return this.document.getRoot().listMaterials().forEach(a=>{let s=a.getExtension(kt);if(s){let r=t.materialIndexMap.get(a),n=e.json.materials[r],i=t.createPropertyDef(s);if(n.extensions=n.extensions||{},n.extensions[kt]=i,s.getIridescenceFactor()>0&&(i.iridescenceFactor=s.getIridescenceFactor()),s.getIridescenceIOR()!==1.3&&(i.iridescenceIor=s.getIridescenceIOR()),s.getIridescenceThicknessMinimum()!==100&&(i.iridescenceThicknessMinimum=s.getIridescenceThicknessMinimum()),s.getIridescenceThicknessMaximum()!==400&&(i.iridescenceThicknessMaximum=s.getIridescenceThicknessMaximum()),s.getIridescenceTexture()){let o=s.getIridescenceTexture(),c=s.getIridescenceTextureInfo();i.iridescenceTexture=t.createTextureInfoDef(o,c)}if(s.getIridescenceThicknessTexture()){let o=s.getIridescenceThicknessTexture(),c=s.getIridescenceThicknessTextureInfo();i.iridescenceThicknessTexture=t.createTextureInfoDef(o,c)}}}),this}},{R:ic,G:oc,B:cc,A:lc}=qe,_p=class extends ${static EXTENSION_NAME=Et;init(){this.extensionName=Et,this.propertyType="PBRSpecularGlossiness",this.parentTypes=[F.MATERIAL]}getDefaults(){return Object.assign(super.getDefaults(),{diffuseFactor:[1,1,1,1],diffuseTexture:null,diffuseTextureInfo:new le(this.graph,"diffuseTextureInfo"),specularFactor:[1,1,1],glossinessFactor:1,specularGlossinessTexture:null,specularGlossinessTextureInfo:new le(this.graph,"specularGlossinessTextureInfo")})}getDiffuseFactor(){return this.get("diffuseFactor")}setDiffuseFactor(t){return this.set("diffuseFactor",t)}getDiffuseTexture(){return this.getRef("diffuseTexture")}getDiffuseTextureInfo(){return this.getRef("diffuseTexture")?this.getRef("diffuseTextureInfo"):null}setDiffuseTexture(t){return this.setRef("diffuseTexture",t,{channels:ic|oc|cc|lc,isColor:!0})}getSpecularFactor(){return this.get("specularFactor")}setSpecularFactor(t){return this.set("specularFactor",t)}getGlossinessFactor(){return this.get("glossinessFactor")}setGlossinessFactor(t){return this.set("glossinessFactor",t)}getSpecularGlossinessTexture(){return this.getRef("specularGlossinessTexture")}getSpecularGlossinessTextureInfo(){return this.getRef("specularGlossinessTexture")?this.getRef("specularGlossinessTextureInfo"):null}setSpecularGlossinessTexture(t){return this.setRef("specularGlossinessTexture",t,{channels:ic|oc|cc|lc})}},Sp=class extends ne{static EXTENSION_NAME=Et;extensionName=Et;prereadTypes=[F.MESH];prewriteTypes=[F.MESH];createPBRSpecularGlossiness(){return new _p(this.document.getGraph())}read(t){return this}write(t){return this}preread(t){let e=t.jsonDoc,a=e.json.materials||[],s=e.json.textures||[];return a.forEach((r,n)=>{if(r.extensions&&r.extensions.KHR_materials_pbrSpecularGlossiness){let i=this.createPBRSpecularGlossiness();t.materials[n].setExtension(Et,i);let o=r.extensions[Et];if(o.extras&&i.setExtras(o.extras),o.diffuseFactor!==void 0&&i.setDiffuseFactor(o.diffuseFactor),o.specularFactor!==void 0&&i.setSpecularFactor(o.specularFactor),o.glossinessFactor!==void 0&&i.setGlossinessFactor(o.glossinessFactor),o.diffuseTexture!==void 0){let c=o.diffuseTexture,l=t.textures[s[c.index].source];i.setDiffuseTexture(l),t.setTextureInfo(i.getDiffuseTextureInfo(),c)}if(o.specularGlossinessTexture!==void 0){let c=o.specularGlossinessTexture,l=t.textures[s[c.index].source];i.setSpecularGlossinessTexture(l),t.setTextureInfo(i.getSpecularGlossinessTextureInfo(),c)}}}),this}prewrite(t){let e=t.jsonDoc;return this.document.getRoot().listMaterials().forEach(a=>{let s=a.getExtension(Et);if(s){let r=t.materialIndexMap.get(a),n=e.json.materials[r],i=t.createPropertyDef(s);if(n.extensions=n.extensions||{},n.extensions[Et]=i,i.diffuseFactor=s.getDiffuseFactor(),i.specularFactor=s.getSpecularFactor(),i.glossinessFactor=s.getGlossinessFactor(),s.getDiffuseTexture()){let o=s.getDiffuseTexture(),c=s.getDiffuseTextureInfo();i.diffuseTexture=t.createTextureInfoDef(o,c)}if(s.getSpecularGlossinessTexture()){let o=s.getSpecularGlossinessTexture(),c=s.getSpecularGlossinessTextureInfo();i.specularGlossinessTexture=t.createTextureInfoDef(o,c)}}}),this}},{R:Ap,G:Rp,B:Ip,A:Np}=qe,Cp=class extends ${static EXTENSION_NAME=Tt;init(){this.extensionName=Tt,this.propertyType="Sheen",this.parentTypes=[F.MATERIAL]}getDefaults(){return Object.assign(super.getDefaults(),{sheenColorFactor:[0,0,0],sheenColorTexture:null,sheenColorTextureInfo:new le(this.graph,"sheenColorTextureInfo"),sheenRoughnessFactor:0,sheenRoughnessTexture:null,sheenRoughnessTextureInfo:new le(this.graph,"sheenRoughnessTextureInfo")})}getSheenColorFactor(){return this.get("sheenColorFactor")}setSheenColorFactor(t){return this.set("sheenColorFactor",t)}getSheenColorTexture(){return this.getRef("sheenColorTexture")}getSheenColorTextureInfo(){return this.getRef("sheenColorTexture")?this.getRef("sheenColorTextureInfo"):null}setSheenColorTexture(t){return this.setRef("sheenColorTexture",t,{channels:Ap|Rp|Ip,isColor:!0})}getSheenRoughnessFactor(){return this.get("sheenRoughnessFactor")}setSheenRoughnessFactor(t){return this.set("sheenRoughnessFactor",t)}getSheenRoughnessTexture(){return this.getRef("sheenRoughnessTexture")}getSheenRoughnessTextureInfo(){return this.getRef("sheenRoughnessTexture")?this.getRef("sheenRoughnessTextureInfo"):null}setSheenRoughnessTexture(t){return this.setRef("sheenRoughnessTexture",t,{channels:Np})}},Bp=class extends ne{static EXTENSION_NAME=Tt;extensionName=Tt;prereadTypes=[F.MESH];prewriteTypes=[F.MESH];createSheen(){return new Cp(this.document.getGraph())}read(t){return this}write(t){return this}preread(t){let e=t.jsonDoc,a=e.json.materials||[],s=e.json.textures||[];return a.forEach((r,n)=>{if(r.extensions&&r.extensions.KHR_materials_sheen){let i=this.createSheen();t.materials[n].setExtension(Tt,i);let o=r.extensions[Tt];if(o.extras&&i.setExtras(o.extras),o.sheenColorFactor!==void 0&&i.setSheenColorFactor(o.sheenColorFactor),o.sheenRoughnessFactor!==void 0&&i.setSheenRoughnessFactor(o.sheenRoughnessFactor),o.sheenColorTexture!==void 0){let c=o.sheenColorTexture,l=t.textures[s[c.index].source];i.setSheenColorTexture(l),t.setTextureInfo(i.getSheenColorTextureInfo(),c)}if(o.sheenRoughnessTexture!==void 0){let c=o.sheenRoughnessTexture,l=t.textures[s[c.index].source];i.setSheenRoughnessTexture(l),t.setTextureInfo(i.getSheenRoughnessTextureInfo(),c)}}}),this}prewrite(t){let e=t.jsonDoc;return this.document.getRoot().listMaterials().forEach(a=>{let s=a.getExtension(Tt);if(s){let r=t.materialIndexMap.get(a),n=e.json.materials[r],i=t.createPropertyDef(s);if(n.extensions=n.extensions||{},n.extensions[Tt]=i,i.sheenColorFactor=s.getSheenColorFactor(),i.sheenRoughnessFactor=s.getSheenRoughnessFactor(),s.getSheenColorTexture()){let o=s.getSheenColorTexture(),c=s.getSheenColorTextureInfo();i.sheenColorTexture=t.createTextureInfoDef(o,c)}if(s.getSheenRoughnessTexture()){let o=s.getSheenRoughnessTexture(),c=s.getSheenRoughnessTextureInfo();i.sheenRoughnessTexture=t.createTextureInfoDef(o,c)}}}),this}},{R:Fp,G:Op,B:Pp,A:jp}=qe,Lp=class extends ${static EXTENSION_NAME=Mt;init(){this.extensionName=Mt,this.propertyType="Specular",this.parentTypes=[F.MATERIAL]}getDefaults(){return Object.assign(super.getDefaults(),{specularFactor:1,specularTexture:null,specularTextureInfo:new le(this.graph,"specularTextureInfo"),specularColorFactor:[1,1,1],specularColorTexture:null,specularColorTextureInfo:new le(this.graph,"specularColorTextureInfo")})}getSpecularFactor(){return this.get("specularFactor")}setSpecularFactor(t){return this.set("specularFactor",t)}getSpecularColorFactor(){return this.get("specularColorFactor")}setSpecularColorFactor(t){return this.set("specularColorFactor",t)}getSpecularTexture(){return this.getRef("specularTexture")}getSpecularTextureInfo(){return this.getRef("specularTexture")?this.getRef("specularTextureInfo"):null}setSpecularTexture(t){return this.setRef("specularTexture",t,{channels:jp})}getSpecularColorTexture(){return this.getRef("specularColorTexture")}getSpecularColorTextureInfo(){return this.getRef("specularColorTexture")?this.getRef("specularColorTextureInfo"):null}setSpecularColorTexture(t){return this.setRef("specularColorTexture",t,{channels:Fp|Op|Pp,isColor:!0})}},Dp=class extends ne{static EXTENSION_NAME=Mt;extensionName=Mt;prereadTypes=[F.MESH];prewriteTypes=[F.MESH];createSpecular(){return new Lp(this.document.getGraph())}read(t){return this}write(t){return this}preread(t){let e=t.jsonDoc,a=e.json.materials||[],s=e.json.textures||[];return a.forEach((r,n)=>{if(r.extensions&&r.extensions.KHR_materials_specular){let i=this.createSpecular();t.materials[n].setExtension(Mt,i);let o=r.extensions[Mt];if(o.extras&&i.setExtras(o.extras),o.specularFactor!==void 0&&i.setSpecularFactor(o.specularFactor),o.specularColorFactor!==void 0&&i.setSpecularColorFactor(o.specularColorFactor),o.specularTexture!==void 0){let c=o.specularTexture,l=t.textures[s[c.index].source];i.setSpecularTexture(l),t.setTextureInfo(i.getSpecularTextureInfo(),c)}if(o.specularColorTexture!==void 0){let c=o.specularColorTexture,l=t.textures[s[c.index].source];i.setSpecularColorTexture(l),t.setTextureInfo(i.getSpecularColorTextureInfo(),c)}}}),this}prewrite(t){let e=t.jsonDoc;return this.document.getRoot().listMaterials().forEach(a=>{let s=a.getExtension(Mt);if(s){let r=t.materialIndexMap.get(a),n=e.json.materials[r],i=t.createPropertyDef(s);if(n.extensions=n.extensions||{},n.extensions[Mt]=i,s.getSpecularFactor()!==1&&(i.specularFactor=s.getSpecularFactor()),de.eq(s.getSpecularColorFactor(),[1,1,1])||(i.specularColorFactor=s.getSpecularColorFactor()),s.getSpecularTexture()){let o=s.getSpecularTexture(),c=s.getSpecularTextureInfo();i.specularTexture=t.createTextureInfoDef(o,c)}if(s.getSpecularColorTexture()){let o=s.getSpecularColorTexture(),c=s.getSpecularColorTextureInfo();i.specularColorTexture=t.createTextureInfoDef(o,c)}}}),this}},{R:Up}=qe,zp=class extends ${static EXTENSION_NAME=_t;init(){this.extensionName=_t,this.propertyType="Transmission",this.parentTypes=[F.MATERIAL]}getDefaults(){return Object.assign(super.getDefaults(),{transmissionFactor:0,transmissionTexture:null,transmissionTextureInfo:new le(this.graph,"transmissionTextureInfo")})}getTransmissionFactor(){return this.get("transmissionFactor")}setTransmissionFactor(t){return this.set("transmissionFactor",t)}getTransmissionTexture(){return this.getRef("transmissionTexture")}getTransmissionTextureInfo(){return this.getRef("transmissionTexture")?this.getRef("transmissionTextureInfo"):null}setTransmissionTexture(t){return this.setRef("transmissionTexture",t,{channels:Up})}},Gp=class extends ne{static EXTENSION_NAME=_t;extensionName=_t;prereadTypes=[F.MESH];prewriteTypes=[F.MESH];createTransmission(){return new zp(this.document.getGraph())}read(t){return this}write(t){return this}preread(t){let e=t.jsonDoc,a=e.json.materials||[],s=e.json.textures||[];return a.forEach((r,n)=>{if(r.extensions&&r.extensions.KHR_materials_transmission){let i=this.createTransmission();t.materials[n].setExtension(_t,i);let o=r.extensions[_t];if(o.extras&&i.setExtras(o.extras),o.transmissionFactor!==void 0&&i.setTransmissionFactor(o.transmissionFactor),o.transmissionTexture!==void 0){let c=o.transmissionTexture,l=t.textures[s[c.index].source];i.setTransmissionTexture(l),t.setTextureInfo(i.getTransmissionTextureInfo(),c)}}}),this}prewrite(t){let e=t.jsonDoc;return this.document.getRoot().listMaterials().forEach(a=>{let s=a.getExtension(_t);if(s){let r=t.materialIndexMap.get(a),n=e.json.materials[r],i=t.createPropertyDef(s);if(n.extensions=n.extensions||{},n.extensions[_t]=i,i.transmissionFactor=s.getTransmissionFactor(),s.getTransmissionTexture()){let o=s.getTransmissionTexture(),c=s.getTransmissionTextureInfo();i.transmissionTexture=t.createTextureInfoDef(o,c)}}}),this}},Kp=class extends ${static EXTENSION_NAME=Yt;init(){this.extensionName=Yt,this.propertyType="Unlit",this.parentTypes=[F.MATERIAL]}},Vp=class extends ne{static EXTENSION_NAME=Yt;extensionName=Yt;prereadTypes=[F.MESH];prewriteTypes=[F.MESH];createUnlit(){return new Kp(this.document.getGraph())}read(t){return this}write(t){return this}preread(t){return(t.jsonDoc.json.materials||[]).forEach((e,a)=>{e.extensions&&e.extensions.KHR_materials_unlit&&t.materials[a].setExtension(Yt,this.createUnlit())}),this}prewrite(t){let e=t.jsonDoc;return this.document.getRoot().listMaterials().forEach(a=>{if(a.getExtension("KHR_materials_unlit")){let s=t.materialIndexMap.get(a),r=e.json.materials[s];r.extensions=r.extensions||{},r.extensions[Yt]={}}}),this}},Hp=class extends ${static EXTENSION_NAME=De;init(){this.extensionName=De,this.propertyType="Mapping",this.parentTypes=["MappingList"]}getDefaults(){return Object.assign(super.getDefaults(),{material:null,variants:new oe})}getMaterial(){return this.getRef("material")}setMaterial(t){return this.setRef("material",t)}addVariant(t){return this.addRef("variants",t)}removeVariant(t){return this.removeRef("variants",t)}listVariants(){return this.listRefs("variants")}},qp=class extends ${static EXTENSION_NAME=De;init(){this.extensionName=De,this.propertyType="MappingList",this.parentTypes=[F.PRIMITIVE]}getDefaults(){return Object.assign(super.getDefaults(),{mappings:new oe})}addMapping(t){return this.addRef("mappings",t)}removeMapping(t){return this.removeRef("mappings",t)}listMappings(){return this.listRefs("mappings")}},dc=class extends ${static EXTENSION_NAME=De;init(){this.extensionName=De,this.propertyType="Variant",this.parentTypes=["MappingList"]}},Wp=class extends ne{extensionName=De;static EXTENSION_NAME=De;createMappingList(){return new qp(this.document.getGraph())}createVariant(t=""){return new dc(this.document.getGraph(),t)}createMapping(){return new Hp(this.document.getGraph())}listVariants(){return Array.from(this.properties).filter(t=>t instanceof dc)}read(t){let e=t.jsonDoc;if(!e.json.extensions||!e.json.extensions.KHR_materials_variants)return this;let a=(e.json.extensions.KHR_materials_variants.variants||[]).map(s=>this.createVariant().setName(s.name||""));return(e.json.meshes||[]).forEach((s,r)=>{let n=t.meshes[r];(s.primitives||[]).forEach((i,o)=>{if(!i.extensions||!i.extensions.KHR_materials_variants)return;let c=this.createMappingList(),l=i.extensions[De];for(let f of l.mappings){let u=this.createMapping();f.material!==void 0&&u.setMaterial(t.materials[f.material]);for(let g of f.variants||[])u.addVariant(a[g]);c.addMapping(u)}n.listPrimitives()[o].setExtension(De,c)})}),this}write(t){let e=t.jsonDoc,a=this.listVariants();if(!a.length)return this;let s=[],r=new Map;for(let n of a)r.set(n,s.length),s.push(t.createPropertyDef(n));for(let n of this.document.getRoot().listMeshes()){let i=t.meshIndexMap.get(n);n.listPrimitives().forEach((o,c)=>{let l=o.getExtension(De);if(!l)return;let f=t.jsonDoc.json.meshes[i].primitives[c],u=l.listMappings().map(g=>{let p=t.createPropertyDef(g),h=g.getMaterial();return h&&(p.material=t.materialIndexMap.get(h)),p.variants=g.listVariants().map(d=>r.get(d)),p});f.extensions=f.extensions||{},f.extensions[De]={mappings:u}})}return e.json.extensions=e.json.extensions||{},e.json.extensions[De]={variants:s},this}},{G:Xp}=qe,$p=class extends ${static EXTENSION_NAME=St;init(){this.extensionName=St,this.propertyType="Volume",this.parentTypes=[F.MATERIAL]}getDefaults(){return Object.assign(super.getDefaults(),{thicknessFactor:0,thicknessTexture:null,thicknessTextureInfo:new le(this.graph,"thicknessTexture"),attenuationDistance:1/0,attenuationColor:[1,1,1]})}getThicknessFactor(){return this.get("thicknessFactor")}setThicknessFactor(t){return this.set("thicknessFactor",t)}getThicknessTexture(){return this.getRef("thicknessTexture")}getThicknessTextureInfo(){return this.getRef("thicknessTexture")?this.getRef("thicknessTextureInfo"):null}setThicknessTexture(t){return this.setRef("thicknessTexture",t,{channels:Xp})}getAttenuationDistance(){return this.get("attenuationDistance")}setAttenuationDistance(t){return this.set("attenuationDistance",t)}getAttenuationColor(){return this.get("attenuationColor")}setAttenuationColor(t){return this.set("attenuationColor",t)}},Yp=class extends ne{static EXTENSION_NAME=St;extensionName=St;prereadTypes=[F.MESH];prewriteTypes=[F.MESH];createVolume(){return new $p(this.document.getGraph())}read(t){return this}write(t){return this}preread(t){let e=t.jsonDoc,a=e.json.materials||[],s=e.json.textures||[];return a.forEach((r,n)=>{if(r.extensions&&r.extensions.KHR_materials_volume){let i=this.createVolume();t.materials[n].setExtension(St,i);let o=r.extensions[St];if(o.extras&&i.setExtras(o.extras),o.thicknessFactor!==void 0&&i.setThicknessFactor(o.thicknessFactor),o.attenuationDistance!==void 0&&i.setAttenuationDistance(o.attenuationDistance),o.attenuationColor!==void 0&&i.setAttenuationColor(o.attenuationColor),o.thicknessTexture!==void 0){let c=o.thicknessTexture,l=t.textures[s[c.index].source];i.setThicknessTexture(l),t.setTextureInfo(i.getThicknessTextureInfo(),c)}}}),this}prewrite(t){let e=t.jsonDoc;return this.document.getRoot().listMaterials().forEach(a=>{let s=a.getExtension(St);if(s){let r=t.materialIndexMap.get(a),n=e.json.materials[r],i=t.createPropertyDef(s);if(n.extensions=n.extensions||{},n.extensions[St]=i,s.getThicknessFactor()>0&&(i.thicknessFactor=s.getThicknessFactor()),Number.isFinite(s.getAttenuationDistance())&&(i.attenuationDistance=s.getAttenuationDistance()),de.eq(s.getAttenuationColor(),[1,1,1])||(i.attenuationColor=s.getAttenuationColor()),s.getThicknessTexture()){let o=s.getThicknessTexture(),c=s.getThicknessTextureInfo();i.thicknessTexture=t.createTextureInfoDef(o,c)}}}),this}},Jp=class extends ne{extensionName=Wo;static EXTENSION_NAME=Wo;read(t){return this}write(t){return this}},dn=class extends ne{extensionName=Xo;static EXTENSION_NAME=Xo;read(t){return this}write(t){return this}},Qp=class extends ${static EXTENSION_NAME=At;init(){this.extensionName=At,this.propertyType="Visibility",this.parentTypes=[F.NODE]}getDefaults(){return Object.assign(super.getDefaults(),{visible:!0})}getVisible(){return this.get("visible")}setVisible(t){return this.set("visible",t)}},Zp=class extends ne{static EXTENSION_NAME=At;extensionName=At;createVisibility(){return new Qp(this.document.getGraph())}read(t){return(t.jsonDoc.json.nodes||[]).forEach((e,a)=>{if(e.extensions&&e.extensions.KHR_node_visibility){let s=this.createVisibility();t.nodes[a].setExtension(At,s);let r=e.extensions[At];r.visible!==void 0&&s.setVisible(r.visible)}}),this}write(t){let e=t.jsonDoc;for(let a of this.document.getRoot().listNodes()){let s=a.getExtension(At);if(!s)continue;let r=t.nodeIndexMap.get(a),n=e.json.nodes[r];n.extensions=n.extensions||{},n.extensions[At]={visible:s.getVisible()}}return this}};function eg(t){return t.vkFormat>0&&t.vkFormat<=123}function uc(t){let e=t.vkFormat===1000066e3&&t.dataFormatDescriptor[0].colorModel===167;return t.vkFormat===0||e}var tg=class{match(t){return t[0]===171&&t[1]===75&&t[2]===84&&t[3]===88&&t[4]===32&&t[5]===50&&t[6]===48&&t[7]===187&&t[8]===13&&t[9]===10&&t[10]===26&&t[11]===10}getSize(t){let e=As(t);return[e.pixelWidth,e.pixelHeight]}getChannels(t){let e=As(t),a=e.dataFormatDescriptor[0];if(eg(e))return a.samples.length;if(uc(e))switch(a.colorModel){case 163:return a.samples.length===2&&(a.samples[1].channelType&15)===15?4:3;case 166:return(a.samples[0].channelType&15)===3?4:3;default:throw new Error(`Unexpected KTX2 colorModel, "${a.colorModel}".`)}throw new Error(`Unexpected KTX2 vkFormat, "${e.vkFormat}".`)}getVRAMByteLength(t){let e=As(t),a=0;if(uc(e)){let s=this.getChannels(t)>3;for(let r=0;r<e.levels.length;r++){let n=e.levels[r];if(n.uncompressedByteLength)a+=n.uncompressedByteLength;else{let i=Math.max(1,Math.floor(e.pixelWidth/Math.pow(2,r))),o=Math.max(1,Math.floor(e.pixelHeight/Math.pow(2,r))),c=s?16:8;a+=i/4*(o/4)*c}}}else for(let s of e.levels)e.supercompressionScheme===0?a+=s.levelData.byteLength:a+=s.uncompressedByteLength;return a}},ag=class extends ne{static EXTENSION_NAME=Ns;extensionName=Ns;prereadTypes=[F.TEXTURE];static register(){Ze.registerFormat("image/ktx2",new tg)}preread(t){return t.jsonDoc.json.textures&&t.jsonDoc.json.textures.forEach(e=>{e.extensions&&e.extensions.KHR_texture_basisu&&(e.source=e.extensions[Ns].source)}),this}read(t){return this}write(t){let e=t.jsonDoc;return this.document.getRoot().listTextures().forEach(a=>{if(a.getMimeType()==="image/ktx2"){let s=t.imageIndexMap.get(a);e.json.textures.forEach(r=>{r.source===s&&(r.extensions=r.extensions||{},r.extensions[Ns]={source:r.source},delete r.source)})}}),this}},sg=class extends ${static EXTENSION_NAME=Rt;init(){this.extensionName=Rt,this.propertyType="Transform",this.parentTypes=[F.TEXTURE_INFO]}getDefaults(){return Object.assign(super.getDefaults(),{offset:[0,0],rotation:0,scale:[1,1],texCoord:null})}getOffset(){return this.get("offset")}setOffset(t){return this.set("offset",t)}getRotation(){return this.get("rotation")}setRotation(t){return this.set("rotation",t)}getScale(){return this.get("scale")}setScale(t){return this.set("scale",t)}getTexCoord(){return this.get("texCoord")}setTexCoord(t){return this.set("texCoord",t)}},rg=class extends ne{extensionName=Rt;static EXTENSION_NAME=Rt;createTransform(){return new sg(this.document.getGraph())}read(t){for(let[e,a]of Array.from(t.textureInfos.entries())){if(!a.extensions||!a.extensions.KHR_texture_transform)continue;let s=this.createTransform(),r=a.extensions[Rt];r.offset!==void 0&&s.setOffset(r.offset),r.rotation!==void 0&&s.setRotation(r.rotation),r.scale!==void 0&&s.setScale(r.scale),r.texCoord!==void 0&&s.setTexCoord(r.texCoord),e.setExtension(Rt,s)}return this}write(t){let e=Array.from(t.textureInfoDefMap.entries());for(let[a,s]of e){let r=a.getExtension(Rt);if(!r)continue;s.extensions=s.extensions||{};let n={},i=de.eq;i(r.getOffset(),[0,0])||(n.offset=r.getOffset()),r.getRotation()!==0&&(n.rotation=r.getRotation()),i(r.getScale(),[1,1])||(n.scale=r.getScale()),r.getTexCoord()!=null&&(n.texCoord=r.getTexCoord()),s.extensions[Rt]=n}return this}},ng=[F.ROOT,F.SCENE,F.NODE,F.MESH,F.MATERIAL,F.TEXTURE,F.ANIMATION],ig=class extends ${static EXTENSION_NAME=We;init(){this.extensionName=We,this.propertyType="Packet",this.parentTypes=ng}getDefaults(){return Object.assign(super.getDefaults(),{context:{},properties:{}})}getContext(){return this.get("context")}setContext(t){return this.set("context",{...t})}listProperties(){return Object.keys(this.get("properties"))}getProperty(t){let e=this.get("properties");return t in e?e[t]:null}setProperty(t,e){this._assertContext(t);let a={...this.get("properties")};return e?a[t]=e:delete a[t],this.set("properties",a)}toJSONLD(){return{"@context":sn(this.get("context")),...sn(this.get("properties"))}}fromJSONLD(t){t=sn(t);let e=t["@context"];return e&&this.set("context",e),delete t["@context"],this.set("properties",t)}_assertContext(t){if(!(t.split(":")[0]in this.get("context")))throw new Error(`${We}: Missing context for term, "${t}".`)}};function sn(t){return JSON.parse(JSON.stringify(t))}var og=class extends ne{extensionName=We;static EXTENSION_NAME=We;createPacket(){return new ig(this.document.getGraph())}listPackets(){return Array.from(this.properties)}read(t){let e=t.jsonDoc.json.extensions?.[We];if(!e||!e.packets)return this;let a=t.jsonDoc.json,s=this.document.getRoot(),r=e.packets.map(o=>this.createPacket().fromJSONLD(o)),n=[[a.asset],a.scenes,a.nodes,a.meshes,a.materials,a.images,a.animations],i=[[s],s.listScenes(),s.listNodes(),s.listMeshes(),s.listMaterials(),s.listTextures(),s.listAnimations()];for(let o=0;o<n.length;o++){let c=n[o]||[];for(let l=0;l<c.length;l++){let f=c[l];if(f.extensions&&f.extensions.KHR_xmp_json_ld){let u=f.extensions[We];i[o][l].setExtension(We,r[u.packet])}}}return this}write(t){let{json:e}=t.jsonDoc,a=[];for(let s of this.properties){a.push(s.toJSONLD());for(let r of s.listParents()){let n;switch(r.propertyType){case F.ROOT:n=e.asset;break;case F.SCENE:n=e.scenes[t.sceneIndexMap.get(r)];break;case F.NODE:n=e.nodes[t.nodeIndexMap.get(r)];break;case F.MESH:n=e.meshes[t.meshIndexMap.get(r)];break;case F.MATERIAL:n=e.materials[t.materialIndexMap.get(r)];break;case F.TEXTURE:n=e.images[t.imageIndexMap.get(r)];break;case F.ANIMATION:n=e.animations[t.animationIndexMap.get(r)];break;default:n=null,this.document.getLogger().warn(`[${We}]: Unsupported parent property, "${r.propertyType}"`);break}n&&(n.extensions=n.extensions||{},n.extensions[We]={packet:a.length-1})}}return a.length>0&&(e.extensions=e.extensions||{},e.extensions[We]={packets:a}),this}},cg=[Gb,Kb,Zb,tp,ip,lp,pp,mp,xp,vp,Mp,Sp,Dp,Bp,Gp,Vp,Wp,Yp,Jp,dn,Zp,ag,rg,og],Gw=[zh,cn,ln,fb,Db,zb,...cg];var o1=(function(){var t="b9H79Tebbbe9ok9Geueu9Geub9Gbb9Gruuuuuuueu9Gvuuuuueu9Gduueu9Gluuuueu9Gvuuuuub9Gouuuuuub9Gluuuub9Giuuueui8AYdilveoveovrrwrrDDoDrbqqbelve9Weiiviebeoweuec;G:Qdkr:nlAo9TW9T9VV95dbH9F9F939H79T9F9J9H229F9Jt9VV7bb8F9TW79O9V9Wt9FW9U9J9V9KW9wWVtW949c919M9MWV9mW4W2be8A9TW79O9V9Wt9FW9U9J9V9KW9wWVtW949c919M9MWVbd8F9TW79O9V9Wt9FW9U9J9V9KW9wWVtW949c919M9MWV9c9V919U9KbiE9TW79O9V9Wt9FW9U9J9V9KW9wWVtW949wWV79P9V9UblY9TW79O9V9Wt9FW9U9J9V9KW69U9KW949c919M9MWVbv8E9TW79O9V9Wt9FW9U9J9V9KW69U9KW949c919M9MWV9c9V919U9Kbo8A9TW79O9V9Wt9FW9U9J9V9KW69U9KW949wWV79P9V9UbrE9TW79O9V9Wt9FW9U9J9V9KW69U9KW949tWG91W9U9JWbwa9TW79O9V9Wt9FW9U9J9V9KW69U9KW949tWG91W9U9JW9c9V919U9KbDL9TW79O9V9Wt9FW9U9J9V9KWS9P2tWV9p9JtbqK9TW79O9V9Wt9FW9U9J9V9KWS9P2tWV9r919HtbkL9TW79O9V9Wt9FW9U9J9V9KWS9P2tWVT949WbxE9TW79O9V9Wt9F9V9Wt9P9T9P96W9wWVtW94J9H9J9OWbsa9TW79O9V9Wt9F9V9Wt9P9T9P96W9wWVtW94J9H9J9OW9ttV9P9Wbza9TW79O9V9Wt9F9V9Wt9P9T9P96W9wWVtW94SWt9J9O9sW9T9H9WbHK9TW79O9V9Wt9F79W9Ht9P9H29t9VVt9sW9T9H9WbOl79IV9RbCDwebcekdKLqN9OYdbk:Bhdhud9:8Jjjjjbc;qw9Rgr8KjjjjbcbhwdnaeTmbabcbyd;C:kjjbaoaocb9iEgDc:GeV86bbarc;adfcbcjdz:wjjjb8AdnaiTmbarc;adfadalz:vjjjb8Akarc;abfalfcbcbcjdal9RalcFe0Ez:wjjjb8Aarc;abfarc;adfalz:vjjjb8AarcUf9cb83ibarc8Wf9cb83ibarcyf9cb83ibarcaf9cb83ibarcKf9cb83ibarczf9cb83ibar9cb83iwar9cb83ibcj;abal9Uc;WFbGcjdalca0Ehqdnaicd6mbavcd9imbaDTmbadcefhkaqci2gxal2hmarc;alfclfhParc;qlfceVhsarc;qofclVhzarc;qofcKfhHarc;qofczfhOcbhAincdhCcbhodnavci6mbaH9cb83ibaO9cb83ibar9cb83i;yoar9cb83i;qoadaAfgoybbhXcbhQincbhwcbhLdninaoalfhKaoybbgYaX7aLVhLawcP0meaKhoaYhXawcefgwaQfai6mbkkcbhXarc;qofhwincwh8AcwhEdnaLaX93gocFeGg3cs0mbclhEa3ci0mba3cb9hcethEkdnaocw4cFeGg3cs0mbclh8Aa3ci0mba3cb9hceth8Aka8AaEfh3awydbh5cwh8AcwhEdnaocz4cFeGg8Ecs0mbclhEa8Eci0mba8Ecb9hcethEka3a5fh3dnaocFFFFb0mbclh8AaocFFF8F0mbaocFFFr0ceth8Akawa3aEfa8AfBdbawclfhwaXcefgXcw9hmbkaKhoaYhXaQczfgQai6mbkcbhocehwazhLinawaoaLydbarc;qofaocdtfydb6EhoaLclfhLawcefgwcw9hmbkcihCkcbh3arc;qlfcbcjdz:wjjjb8Aarc;alfcwfcbBdbar9cb83i;alaoclth8Fadhaaqhhakh5inarc;qlfadcba3cufgoaoa30Eal2falz:vjjjb8Aaiahaiah6Ehgdnaqaia39Ra3aqfai6EgYcsfc9WGgoaY9nmbarc;qofaYfcbaoaY9Rz:wjjjb8Akada3al2fh8Jcbh8Kina8Ka8FVcl4hQarc;alfa8Kcdtfh8LaAh8Mcbh8Nina8NaAfhwdndndndndndna8KPldebidkasa8Mc98GgLfhoa5aLfh8Aarc;qlfawc98GgLfRbbhXcwhwinaoRbbawtaXVhXaocefhoawcwfgwca9hmbkaYTmla8Ncith8Ea8JaLfhEcbhKinaERbbhLcwhoa8AhwinawRbbaotaLVhLawcefhwaocwfgoca9hmbkarc;qofaKfaLaX7aQ93a8E486bba8Aalfh8AaEalfhEaLhXaKcefgKaY9hmbxlkkaYTmia8Mc9:Ghoa8NcitcwGhEarc;qlfawceVfRbbcwtarc;qlfawc9:GfRbbVhLarc;qofhwaghXinawa5aofRbbcwtaaaofRbbVg8AaL9RgLcetaLcztcz91cs47cFFiGaE486bbaoalfhoawcefhwa8AhLa3aXcufgX9hmbxikkaYTmda8Jawfhoarc;qlfawfRbbhLarc;qofhwaghXinawaoRbbg8AaL9RgLcetaLcKtcK91cr4786bbawcefhwaoalfhoa8AhLa3aXcufgX9hmbxdkkaYTmeka8LydbhEcbhKarc;qofhoincdhLcbhwinaLaoawfRbbcb9hfhLawcefgwcz9hmbkclhXcbhwinaXaoawfRbbcd0fhXawcefgwcz9hmbkcwh8Acbhwina8AaoawfRbbcP0fh8Aawcefgwcz9hmbkaLaXaLaX6Egwa8Aawa8A6Egwczawcz6EaEfhEaoczfhoaKczfgKaY6mbka8LaEBdbka8Mcefh8Ma8Ncefg8Ncl9hmbka8Kcefg8KaC9hmbkaaamfhaahaxfhha5amfh5a3axfg3ai6mbkcbhocehwaPhLinawaoaLydbarc;alfaocdtfydb6EhoaLclfhLawcefgXhwaCaX9hmbkaraAcd4fa8FcdVaoaocdSE86bbaAclfgAal6mbkkabaefh8Kabcefhoalcd4gecbaDEhkadcefhOarc;abfceVhHcbhmdndninaiam9nmearc;qofcbcjdz:wjjjb8Aa8Kao9Rak6mdadamal2gwfhxcbh8JaOawfhzaocbakz:wjjjbghakfh5aqaiam9Ramaqfai6Egscsfgocl4cifcd4hCaoc9WGg8LThPindndndndndndndndndndnaDTmbara8Jcd4fRbbgLciGPlbedlbkasTmdaxa8Jfhoarc;abfa8JfRbbhLarc;qofhwashXinawaoRbbg8AaL9RgLcetaLcKtcK91cr4786bbawcefhwaoalfhoa8AhLaXcufgXmbxikkasTmia8JcitcwGhEarc;abfa8JceVfRbbcwtarc;abfa8Jc9:GgofRbbVhLaxaofhoarc;qofhwashXinawao8Vbbg8AaL9RgLcetaLcztcz91cs47cFFiGaE486bbawcefhwaoalfhoa8AhLaXcufgXmbxdkkaHa8Jc98GgEfhoazaEfh8Aarc;abfaEfRbbhXcwhwinaoRbbawtaXVhXaocefhoawcwfgwca9hmbkasTmbaLcl4hYa8JcitcKGh3axaEfhEcbhKinaERbbhLcwhoa8AhwinawRbbaotaLVhLawcefhwaocwfgoca9hmbkarc;qofaKfaLaX7aY93a3486bba8Aalfh8AaEalfhEaLhXaKcefgKas9hmbkkaDmbcbhoxlka8LTmbcbhodninarc;qofaofgwcwf8Pibaw8Pib:e9qTmeaoczfgoa8L9pmdxbkkdnavmbcehoxikcbhEaChKaChYinarc;qofaEfgocwf8Pibhyao8Pibh8PcdhLcbhwinaLaoawfRbbcb9hfhLawcefgwcz9hmbkclhXcbhwinaXaoawfRbbcd0fhXawcefgwcz9hmbkcwh8Acbhwina8AaoawfRbbcP0fh8Aawcefgwcz9hmbkaLaXaLaX6Egoa8Aaoa8A6Egoczaocz6EaYfhYaocucbaya8P:e9cb9sEgwaoaw6EaKfhKaEczfgEa8L9pmdxbkkaha8Jcd4fgoaoRbbcda8JcetcoGtV86bbxikdnaKas6mbaYas6mbaha8Jcd4fgoaoRbbcia8JcetcoGtV86bba8Ka59Ras6mra5arc;qofasz:vjjjbasfh5xikaKaY9phokaha8Jcd4fgwawRbbaoa8JcetcoGtV86bbka8Ka59RaC6mla5cbaCz:wjjjbgAaCfhYdndna8LmbaPhoxekdna8KaY9RcK9pmbaPhoxekaocdtc:q1jjbfcj1jjbaDEg5ydxggcetc;:FFFeGh8Fcuh3cuagtcu7cFeGhacbh8Marc;qofhLinarc;qofa8MfhQczhEdndndnagPDbeeeeeeedekcucbaQcwf8PibaQ8Pib:e9cb9sEhExekcbhoa8FhEinaEaaaLaofRbb9nfhEaocefgocz9hmbkkcih8Ecbh8Ainczhwdndndna5a8AcdtfydbgKPDbeeeeeeedekcucbaQcwf8PibaQ8Pib:e9cb9sEhwxekaKcetc;:FFFeGhwcuaKtcu7cFeGhXcbhoinawaXaLaofRbb9nfhwaocefgocz9hmbkkdndnawaE6mbaKa39hmeawaE9hmea5a8EcdtfydbcwSmeka8Ah8EawhEka8Acefg8Aci9hmbkaAa8Mco4fgoaoRbba8Ea8Mci4coGtV86bbdndndna5a8Ecdtfydbg3PDdbbbbbbbebkdncwa39Tg8ETmbcua3tcu7hwdndna3ceSmbcbh8NaLhQinaQhoa8Eh8AcbhXinaoRbbgEawcFeGgKaEaK6EaXa3tVhXaocefhoa8Acufg8AmbkaYaX86bbaQa8EfhQaYcefhYa8Na8Efg8Ncz6mbxdkkcbh8NaLhQinaQhoa8Eh8AcbhXinaoRbbgEawcFeGgKaEaK6EaXcetVhXaocefhoa8Acufg8AmbkaYaX:T9cFe:d9c:c:qj:bw9:9c:q;c1:I1e:d9c:b:c:e1z9:9ca188bbaQa8EfhQaYcefhYa8Na8Efg8Ncz6mbkkcbhoinaYaLaofRbbgX86bbaYaXawcFeG9pfhYaocefgocz9hmbxikkdna3ceSmbinaYcb86bbaYcefhYxbkkinaYcb86bbaYcefhYxbkkaYaQ8Pbb83bbaYcwfaQcwf8Pbb83bbaYczfhYka8Mczfg8Ma8L9pgomeaLczfhLa8KaY9RcK9pmbkkaoTmlaYh5aYTmlka8Jcefg8Jal9hmbkarc;abfaxascufal2falz:vjjjb8Aasamfhma5hoa5mbkcbhwxdkdna8Kao9RakalfgwcKcaaDEgLawaL0EgX9pmbcbhwxdkdnawaL9pmbaocbaXaw9Rgwz:wjjjbawfhokaoarc;adfalz:vjjjbalfhodnaDTmbaoaraez:vjjjbaefhokaoab9Rhwxekcbhwkarc;qwf8Kjjjjbawk5babaeadaialcdcbyd;C:kjjbz:bjjjbk9reduaecd4gdaefgicaaica0Eabcj;abae9Uc;WFbGcjdaeca0Egifcufai9Uae2aiadfaicl4cifcd4f2fcefkmbcbabBd;C:kjjbk:Ese5u8Jjjjjbc;ae9Rgl8Kjjjjbcbhvdnaici9UgocHfae0mbabcbyd;m:kjjbgrc;GeV86bbalc;abfcFecjez:wjjjb8AalcUfgw9cu83ibalc8WfgD9cu83ibalcyfgq9cu83ibalcafgk9cu83ibalcKfgx9cu83ibalczfgm9cu83ibal9cu83iwal9cu83ibabaefc9WfhPabcefgsaofhednaiTmbcmcsarcb9kgzEhHcbhOcbhAcbhCcbhXcbhQindnaeaP9nmbcbhvxikaQcufhvadaCcdtfgLydbhKaLcwfydbhYaLclfydbh8AcbhEdndndninalc;abfavcsGcitfgoydlh3dndndnaoydbgoaK9hmba3a8ASmekdnaoa8A9hmba3aY9hmbaEcefhExekaoaY9hmea3aK9hmeaEcdfhEkaEc870mdaXcufhvaLaEciGcx2goc;i1jjbfydbcdtfydbh3aLaoc;e1jjbfydbcdtfydbh8AaLaoc;a1jjbfydbcdtfydbhKcbhodnindnalavcsGcdtfydba39hmbaohYxdkcuhYavcufhvaocefgocz9hmbkkaOa3aOSgvaYce9iaYaH9oVgoGfhOdndndncbcsavEaYaoEgvcs9hmbarce9imba3a3aAa3cefaASgvEgAcefSmecmcsavEhvkasavaEcdtc;WeGV86bbavcs9hmea3aA9Rgvcetavc8F917hvinaeavcFb0crtavcFbGV86bbaecefheavcje6hoavcr4hvaoTmbka3hAxvkcPhvasaEcdtcPV86bba3hAkavTmiavaH9omicdhocehEaQhYxlkavcufhvaEclfgEc;ab9hmbkkdnaLceaYaOSceta8AaOSEcx2gvc;a1jjbfydbcdtfydbgKTaLavc;e1jjbfydbcdtfydbg8AceSGaLavc;i1jjbfydbcdtfydbg3cdSGaOcb9hGazGg5ce9hmbaw9cu83ibaD9cu83ibaq9cu83ibak9cu83ibax9cu83ibam9cu83ibal9cu83iwal9cu83ibcbhOkcbhEaXcufgvhodnindnalaocsGcdtfydba8A9hmbaEhYxdkcuhYaocufhoaEcefgEcz9hmbkkcbhodnindnalavcsGcdtfydba39hmbaohExdkcuhEavcufhvaocefgocz9hmbkkaOaKaOSg8EfhLdndnaYcm0mbaYcefhYxekcbcsa8AaLSgvEhYaLavfhLkdndnaEcm0mbaEcefhExekcbcsa3aLSgvEhEaLavfhLkc9:cua8EEh8FcbhvaEaYcltVgacFeGhodndndninavc:W1jjbfRbbaoSmeavcefgvcz9hmbxdkka5aKaO9havcm0VVmbasavc;WeV86bbxekasa8F86bbaeaa86bbaecefhekdna8EmbaKaA9Rgvcetavc8F917hvinaeavcFb0gocrtavcFbGV86bbavcr4hvaecefheaombkaKhAkdnaYcs9hmba8AaA9Rgvcetavc8F917hvinaeavcFb0gocrtavcFbGV86bbavcr4hvaecefheaombka8AhAkdnaEcs9hmba3aA9Rgvcetavc8F917hvinaeavcFb0gocrtavcFbGV86bbavcr4hvaecefheaombka3hAkalaXcdtfaKBdbaXcefcsGhvdndnaYPzbeeeeeeeeeeeeeebekalavcdtfa8ABdbaXcdfcsGhvkdndnaEPzbeeeeeeeeeeeeeebekalavcdtfa3BdbavcefcsGhvkcihoalc;abfaQcitfgEaKBdlaEa8ABdbaQcefcsGhYcdhEavhXaLhOxekcdhoalaXcdtfa3BdbcehEaXcefcsGhXaQhYkalc;abfaYcitfgva8ABdlava3Bdbalc;abfaQaEfcsGcitfgva3BdlavaKBdbascefhsaQaofcsGhQaCcifgCai6mbkkdnaeaP9nmbcbhvxekcbhvinaeavfavc:W1jjbfRbb86bbavcefgvcz9hmbkaeab9Ravfhvkalc;aef8KjjjjbavkZeeucbhddninadcefgdc8F0meceadtae6mbkkadcrfcFeGcr9Uci2cdfabci9U2cHfkmbcbabBd;m:kjjbk:Adewu8Jjjjjbcz9Rhlcbhvdnaicvfae0mbcbhvabcbRb;m:kjjbc;qeV86bbal9cb83iwabcefhoabaefc98fhrdnaiTmbcbhwcbhDindnaoar6mbcbskadaDcdtfydbgqalcwfawaqav9Rgvavc8F91gv7av9Rc507gwcdtfgkydb9Rgvc8E91c9:Gavcdt7awVhvinaoavcFb0gecrtavcFbGV86bbavcr4hvaocefhoaembkakaqBdbaqhvaDcefgDai9hmbkkdnaoar9nmbcbskaocbBbbaoab9RclfhvkavkBeeucbhddninadcefgdc8F0meceadtae6mbkkadcwfcFeGcr9Uab2cvfk:bvli99dui99ludnaeTmbcuadcetcuftcu7:Zhvdndncuaicuftcu7:ZgoJbbbZMgr:lJbbb9p9DTmbar:Ohwxekcjjjj94hwkcbhicbhDinalclfIdbgrJbbbbJbbjZalIdbgq:lar:lMalcwfIdbgk:lMgr:varJbbbb9BEgrNhxaqarNhrdndnakJbbbb9GTmbaxhqxekJbbjZar:l:tgqaq:maxJbbbb9GEhqJbbjZax:l:tgxax:marJbbbb9GEhrkdndnalcxfIdbgxJbbj:;axJbbj:;9GEgkJbbjZakJbbjZ9FEavNJbbbZJbbb:;axJbbbb9GEMgx:lJbbb9p9DTmbax:Ohmxekcjjjj94hmkdndnaqJbbj:;aqJbbj:;9GEgxJbbjZaxJbbjZ9FEaoNJbbbZJbbb:;aqJbbbb9GEMgq:lJbbb9p9DTmbaq:OhPxekcjjjj94hPkdndnarJbbj:;arJbbj:;9GEgqJbbjZaqJbbjZ9FEaoNJbbbZJbbb:;arJbbbb9GEMgr:lJbbb9p9DTmbar:Ohsxekcjjjj94hskdndnadcl9hmbabaifgzas86bbazcifam86bbazcdfaw86bbazcefaP86bbxekabaDfgzas87ebazcofam87ebazclfaw87ebazcdfaP87ebkalczfhlaiclfhiaDcwfhDaecufgembkkk;hlld99eud99eudnaeTmbdndncuaicuftcu7:ZgvJbbbZMgo:lJbbb9p9DTmbao:Ohixekcjjjj94hikaic;8FiGhrinabcofcicdalclfIdb:lalIdb:l9EgialcwfIdb:lalaicdtfIdb:l9EEgialcxfIdb:lalaicdtfIdb:l9EEgiarV87ebdndnJbbj:;JbbjZalaicdtfIdbJbbbb9DEgoalaicd7cdtfIdbJ;Zl:1ZNNgwJbbj:;awJbbj:;9GEgDJbbjZaDJbbjZ9FEavNJbbbZJbbb:;awJbbbb9GEMgw:lJbbb9p9DTmbaw:Ohqxekcjjjj94hqkabcdfaq87ebdndnalaicefciGcdtfIdbJ;Zl:1ZNaoNgwJbbj:;awJbbj:;9GEgDJbbjZaDJbbjZ9FEavNJbbbZJbbb:;awJbbbb9GEMgw:lJbbb9p9DTmbaw:Ohqxekcjjjj94hqkabaq87ebdndnaoalaicufciGcdtfIdbJ;Zl:1ZNNgoJbbj:;aoJbbj:;9GEgwJbbjZawJbbjZ9FEavNJbbbZJbbb:;aoJbbbb9GEMgo:lJbbb9p9DTmbao:Ohixekcjjjj94hikabclfai87ebabcwfhbalczfhlaecufgembkkk;3viDue99eu8Jjjjjbcjd9Rgo8Kjjjjbadcd4hrdndndndnavcd9hmbadcl6meaohwarhDinawc:CuBdbawclfhwaDcufgDmbkaeTmiadcl6mdarcdthqalhkcbhxinaohwakhDarhminawawydbgPcbaDIdbgs:8cL4cFeGc:cufasJbbbb9BEgzaPaz9kEBdbaDclfhDawclfhwamcufgmmbkakaqfhkaxcefgxaeSmixbkkaeTmdxekaeTmekarcdthkavce9hhqadcl6hdcbhxindndndnaqmbadmdc:CuhDalhwarhminaDcbawIdbgs:8cL4cFeGc:cufasJbbbb9BEgPaDaP9kEhDawclfhwamcufgmmbxdkkc:CuhDdndnavPleddbdkadmdaohwalhmarhPinawcbamIdbgs:8cL4cFeGgzc;:bazc;:b0Ec:cufasJbbbb9BEBdbamclfhmawclfhwaPcufgPmbxdkkadmecbhwarhminaoawfcbalawfIdbgs:8cL4cFeGgPc8AaPc8A0Ec:cufasJbbbb9BEBdbawclfhwamcufgmmbkkadmbcbhwarhPinaDhmdnavceSmbaoawfydbhmkdndnalawfIdbgscjjj;8iamai9RcefgmcLt9R::NJbbbZJbbb:;asJbbbb9GEMgs:lJbbb9p9DTmbas:Ohzxekcjjjj94hzkabawfazcFFFrGamcKtVBdbawclfhwaPcufgPmbkkabakfhbalakfhlaxcefgxae9hmbkkaocjdf8Kjjjjbk;YqdXui998Jjjjjbc:qd9Rgv8Kjjjjbavc:Sefcbc;Kbz:wjjjb8AcbhodnadTmbcbhoaiTmbdndnabaeSmbaehrxekavcuadcdtgwadcFFFFi0Ecbyd;u:kjjbHjjjjbbgrBd:SeavceBd:mdaraeawz:vjjjb8Akavc:GefcwfcbBdbav9cb83i:Geavc:Gefaradaiavc:Sefz:ojjjbavyd:GehDadci9Ugqcbyd;u:kjjbHjjjjbbheavc:Sefavyd:mdgkcdtfaeBdbavakcefgwBd:mdaecbaqz:wjjjbhxavc:SefawcdtfcuaicdtaicFFFFi0Ecbyd;u:kjjbHjjjjbbgmBdbavakcdfgPBd:mdalc;ebfhsaDheamhwinawalIdbasaeydbgzcwazcw6EcdtfIdbMUdbaeclfheawclfhwaicufgimbkavc:SefaPcdtfcuaqcdtadcFFFF970Ecbyd;u:kjjbHjjjjbbgPBdbdnadci6mbarheaPhwaqhiinawamaeydbcdtfIdbamaeclfydbcdtfIdbMamaecwfydbcdtfIdbMUdbaecxfheawclfhwaicufgimbkkakcifhoalc;ebfhHavc;qbfhOavheavyd:KehAavyd:OehCcbhzcbhwcbhXcehQinaehLcihkarawci2gKcdtfgeydbhsaeclfydbhdabaXcx2fgicwfaecwfydbgYBdbaiclfadBdbaiasBdbaxawfce86bbaOaYBdwaOadBdlaOasBdbaPawcdtfcbBdbdnazTmbcihkaLhiinaOakcdtfaiydbgeBdbakaeaY9haeas9haead9hGGfhkaiclfhiazcufgzmbkkaXcefhXcbhzinaCaAarazaKfcdtfydbcdtgifydbcdtfgYheaDaifgdydbgshidnasTmbdninaeydbawSmeaeclfheaicufgiTmdxbkkaeaYascdtfc98fydbBdbadadydbcufBdbkazcefgzci9hmbkdndnakTmbcuhwJbbbbh8Acbhdavyd:KehYavyd:OehKindndnaDaOadcdtfydbcdtgzfydbgembadcefhdxekadcs0hiamazfgsIdbhEasalcbadcefgdaiEcdtfIdbaHaecwaecw6EcdtfIdbMg3Udba3aE:th3aecdthiaKaYazfydbcdtfheinaPaeydbgzcdtfgsa3asIdbMgEUdbaEa8Aa8AaE9DgsEh8AazawasEhwaeclfheaic98fgimbkkadak9hmbkawcu9hmekaQaq9pmdindnaxaQfRbbmbaQhwxdkaqaQcefgQ9hmbxikkakczakcz6EhzaOheaLhOawcu9hmbkkaocdtavc:Seffc98fhedninaoTmeaeydbcbyd;q:kjjbH:bjjjbbaec98fheaocufhoxbkkavc:qdf8Kjjjjbk;IlevucuaicdtgvaicFFFFi0Egocbyd;u:kjjbHjjjjbbhralalyd9GgwcdtfarBdbalawcefBd9GabarBdbaocbyd;u:kjjbHjjjjbbhralalyd9GgocdtfarBdbalaocefBd9GabarBdlcuadcdtadcFFFFi0Ecbyd;u:kjjbHjjjjbbhralalyd9GgocdtfarBdbalaocefBd9GabarBdwabydbcbavz:wjjjb8Aadci9UhDdnadTmbabydbhoaehladhrinaoalydbcdtfgvavydbcefBdbalclfhlarcufgrmbkkdnaiTmbabydbhlabydlhrcbhvaihoinaravBdbarclfhralydbavfhvalclfhlaocufgombkkdnadci6mbabydlhrabydwhvcbhlinaecwfydbhoaeclfydbhdaraeydbcdtfgwawydbgwcefBdbavawcdtfalBdbaradcdtfgdadydbgdcefBdbavadcdtfalBdbaraocdtfgoaoydbgocefBdbavaocdtfalBdbaecxfheaDalcefgl9hmbkkdnaiTmbabydlheabydbhlinaeaeydbalydb9RBdbalclfhlaeclfheaicufgimbkkkQbabaeadaic;K1jjbz:njjjbkQbabaeadaic;m:jjjbz:njjjbk9DeeuabcFeaicdtz:wjjjbhlcbhbdnadTmbindnalaeydbcdtfgiydbcu9hmbaiabBdbabcefhbkaeclfheadcufgdmbkkabk:Vvioud9:du8Jjjjjbc;Wa9Rgl8Kjjjjbcbhvalcxfcbc;Kbz:wjjjb8AalcuadcitgoadcFFFFe0Ecbyd;u:kjjbHjjjjbbgrBdxalceBd2araeadaicez:tjjjbalcuaoadcjjjjoGEcbyd;u:kjjbHjjjjbbgwBdzadcdthednadTmbabhiinaiavBdbaiclfhiadavcefgv9hmbkkawaefhDalabBdwalawBdl9cbhqindnadTmbaq9cq9:hkarhvaDhiadheinaiav8Pibak1:NcFrG87ebavcwfhvaicdfhiaecufgembkkalclfaq:NceGcdtfydbhxalclfaq9ce98gq:NceGcdtfydbhmalc;Wbfcbcjaz:wjjjb8AaDhvadhidnadTmbinalc;Wbfav8VebcdtfgeaeydbcefBdbavcdfhvaicufgimbkkcbhvcbhiinalc;WbfavfgeydbhoaeaiBdbaoaifhiavclfgvcja9hmbkadhvdndnadTmbinalc;WbfaDamydbgicetf8VebcdtfgeaeydbgecefBdbaxaecdtfaiBdbamclfhmavcufgvmbkaq9cv9smdcbhvinabawydbcdtfavBdbawclfhwadavcefgv9hmbxdkkaq9cv9smekkclhvdninavc98Smealcxfavfydbcbyd;q:kjjbH:bjjjbbavc98fhvxbkkalc;Waf8Kjjjjbk:Jwliuo99iud9:cbhv8Jjjjjbca9Rgoczfcwfcbyd:8:kjjbBdbaocb8Pd:0:kjjb83izaocwfcbyd;i:kjjbBdbaocb8Pd;a:kjjb83ibaicd4hrdndnadmbJFFuFhwJFFuuhDJFFuuhqJFFuFhkJFFuuhxJFFuFhmxekarcdthPaehsincbhiinaoczfaifgzasaifIdbgwazIdbgDaDaw9EEUdbaoaifgzawazIdbgDaDaw9DEUdbaiclfgicx9hmbkasaPfhsavcefgvad9hmbkaoIdKhDaoIdwhwaoIdChqaoIdlhkaoIdzhxaoIdbhmkdnadTmbJbbbbJbFu9hJbbbbamax:tgmamJbbbb9DEgmakaq:tgkakam9DEgkawaD:tgwawak9DEgw:vawJbbbb9BEhwdnalmbarcdthoindndnaeclfIdbaq:tawNJbbbZMgk:lJbbb9p9DTmbak:Ohixekcjjjj94hikai:S9cC:ghHdndnaeIdbax:tawNJbbbZMgk:lJbbb9p9DTmbak:Ohixekcjjjj94hikaHai:S:ehHdndnaecwfIdbaD:tawNJbbbZMgk:lJbbb9p9DTmbak:Ohixekcjjjj94hikabaHai:T9cy:g:e83ibaeaofheabcwfhbadcufgdmbxdkkarcdthoindndnaeIdbax:tawNJbbbZMgk:lJbbb9p9DTmbak:Ohixekcjjjj94hikai:SgH9ca:gaH9cz:g9cjjj;4s:d:eaH9cFe:d:e9cF:bj;4:pj;ar:d9c:bd9:9c:p;G:d;4j:E;ar:d9cH9:9c;d;H:W:y:m:g;d;Hb:d9cv9:9c;j:KM;j:KM;j:Kd:dhOdndnaeclfIdbaq:tawNJbbbZMgk:lJbbb9p9DTmbak:Ohixekcjjjj94hikai:SgH9ca:gaH9cz:g9cjjj;4s:d:eaH9cFe:d:e9cF:bj;4:pj;ar:d9c:bd9:9c:p;G:d;4j:E;ar:d9cH9:9c;d;H:W:y:m:g;d;Hb:d9cq9:9cM;j:KM;j:KM;jl:daO:ehOdndnaecwfIdbaD:tawNJbbbZMgk:lJbbb9p9DTmbak:Ohixekcjjjj94hikabaOai:SgH9ca:gaH9cz:g9cjjj;4s:d:eaH9cFe:d:e9cF:bj;4:pj;ar:d9c:bd9:9c:p;G:d;4j:E;ar:d9cH9:9c;d;H:W:y:m:g;d;Hb:d9cC9:9c:KM;j:KM;j:KMD:d:e83ibaeaofheabcwfhbadcufgdmbkkk9teiucbcbyd;y:kjjbgeabcifc98GfgbBd;y:kjjbdndnabZbcztgd9nmbcuhiabad9RcFFifcz4nbcuSmekaehikaik;teeeudndnaeabVciGTmbabhixekdndnadcz9pmbabhixekabhiinaiaeydbBdbaiaeydlBdlaiaeydwBdwaiaeydxBdxaeczfheaiczfhiadc9Wfgdcs0mbkkadcl6mbinaiaeydbBdbaeclfheaiclfhiadc98fgdci0mbkkdnadTmbinaiaeRbb86bbaicefhiaecefheadcufgdmbkkabk:3eedudndnabciGTmbabhixekaecFeGc:b:c:ew2hldndnadcz9pmbabhixekabhiinaialBdxaialBdwaialBdlaialBdbaiczfhiadc9Wfgdcs0mbkkadcl6mbinaialBdbaiclfhiadc98fgdci0mbkkdnadTmbinaiae86bbaicefhiadcufgdmbkkabk9teiucbcbyd;y:kjjbgeabcrfc94GfgbBd;y:kjjbdndnabZbcztgd9nmbcuhiabad9RcFFifcz4nbcuSmekaehikaik9:eiuZbhedndncbyd;y:kjjbgdaecztgi9nmbcuheadai9RcFFifcz4nbcuSmekadhekcbabae9Rcifc98Gcbyd;y:kjjbfgdBd;y:kjjbdnadZbcztge9nmbadae9RcFFifcz4nb8Akkk;Qddbcjwk;mdbbbbdbbblbbbwbbbbbbbebbbdbbblbbbwbbbbbbbbbbbbbbbb4:h9w9N94:P:gW:j9O:ye9Pbbbbbbebbbdbbbebbbdbbbbbbbdbbbbbbbebbbbbbb:l29hZ;69:9kZ;N;76Z;rg97Z;z;o9xZ8J;B85Z;:;u9yZ;b;k9HZ:2;Z9DZ9e:l9mZ59A8KZ:r;T3Z:A:zYZ79OHZ;j4::8::Y:D9V8:bbbb9s:49:Z8R:hBZ9M9M;M8:L;z;o8:;8:PG89q;x:J878R:hQ8::M:B;e87bbbbbbjZbbjZbbjZ:E;V;N8::Y:DsZ9i;H;68:xd;R8:;h0838:;W:NoZbbbb:WV9O8:uf888:9i;H;68:9c9G;L89;n;m9m89;D8Ko8:bbbbf:8tZ9m836ZS:2AZL;zPZZ818EZ9e:lxZ;U98F8:819E;68:FFuuFFuuFFuuFFuFFFuFFFuFbc;mqkzebbbebbbdbbb9G:vbb",e=new Uint8Array([32,0,65,2,1,106,34,33,3,128,11,4,13,64,6,253,10,7,15,116,127,5,8,12,40,16,19,54,20,9,27,255,113,17,42,67,24,23,146,148,18,14,22,45,70,69,56,114,101,21,25,63,75,136,108,28,118,29,73,115]);if(typeof WebAssembly!="object")return{supported:!1};var a,s=WebAssembly.instantiate(r(t),{}).then(function(p){a=p.instance,a.exports.__wasm_call_ctors(),a.exports.meshopt_encodeVertexVersion(0),a.exports.meshopt_encodeIndexVersion(1)});function r(p){for(var h=new Uint8Array(p.length),d=0;d<p.length;++d){var m=p.charCodeAt(d);h[d]=m>96?m-97:m>64?m-39:m+4}for(var b=0,d=0;d<p.length;++d)h[b++]=h[d]<60?e[h[d]]:(h[d]-60)*64+h[++d];return h.buffer.slice(0,b)}function n(p){if(!p)throw new Error("Assertion failed")}function i(p){return new Uint8Array(p.buffer,p.byteOffset,p.byteLength)}function o(p,h,d,m){var b=a.exports.sbrk,y=b(h.length*4),x=b(d*4),w=new Uint8Array(a.exports.memory.buffer),E=i(h);w.set(E,y),m&&m(y,y,h.length,d);var T=p(x,y,h.length,d);w=new Uint8Array(a.exports.memory.buffer);var _=new Uint32Array(d);new Uint8Array(_.buffer).set(w.subarray(x,x+d*4)),E.set(w.subarray(y,y+h.length*4)),b(y-b(0));for(var S=0;S<h.length;++S)h[S]=_[h[S]];return[_,T]}function c(p,h,d,m){var b=a.exports.sbrk,y=b(d*4),x=b(d*m),w=new Uint8Array(a.exports.memory.buffer);w.set(i(h),x),p(y,x,d,m),w=new Uint8Array(a.exports.memory.buffer);var E=new Uint32Array(d);return new Uint8Array(E.buffer).set(w.subarray(y,y+d*4)),b(y-b(0)),E}function l(p,h,d,m,b){var y=a.exports.sbrk,x=y(h),w=y(m*b),E=new Uint8Array(a.exports.memory.buffer);E.set(i(d),w);var T=p(x,h,w,m,b),_=new Uint8Array(T);return _.set(E.subarray(x,x+T)),y(x-y(0)),_}function f(p){for(var h=0,d=0;d<p.length;++d){var m=p[d];h=h<m?m:h}return h}function u(p,h){if(n(h==2||h==4),h==4)return new Uint32Array(p.buffer,p.byteOffset,p.byteLength/4);var d=new Uint16Array(p.buffer,p.byteOffset,p.byteLength/2);return new Uint32Array(d)}function g(p,h,d,m,b,y,x){var w=a.exports.sbrk,E=w(d*m),T=w(d*y),_=new Uint8Array(a.exports.memory.buffer);_.set(i(h),T),p(E,d,m,b,T,x);var S=new Uint8Array(d*m);return S.set(_.subarray(E,E+d*m)),w(E-w(0)),S}return{ready:s,supported:!0,reorderMesh:function(p,h,d){var m=h?d?a.exports.meshopt_optimizeVertexCacheStrip:a.exports.meshopt_optimizeVertexCache:void 0;return o(a.exports.meshopt_optimizeVertexFetchRemap,p,f(p)+1,m)},reorderPoints:function(p,h){return n(p instanceof Float32Array),n(p.length%h==0),n(h>=3),c(a.exports.meshopt_spatialSortRemap,p,p.length/h,h*4)},encodeVertexBuffer:function(p,h,d){n(d>0&&d<=256),n(d%4==0);var m=a.exports.meshopt_encodeVertexBufferBound(h,d);return l(a.exports.meshopt_encodeVertexBuffer,m,p,h,d)},encodeIndexBuffer:function(p,h,d){n(d==2||d==4),n(h%3==0);var m=u(p,d),b=a.exports.meshopt_encodeIndexBufferBound(h,f(m)+1);return l(a.exports.meshopt_encodeIndexBuffer,b,m,h,4)},encodeIndexSequence:function(p,h,d){n(d==2||d==4);var m=u(p,d),b=a.exports.meshopt_encodeIndexSequenceBound(h,f(m)+1);return l(a.exports.meshopt_encodeIndexSequence,b,m,h,4)},encodeGltfBuffer:function(p,h,d,m){var b={ATTRIBUTES:this.encodeVertexBuffer,TRIANGLES:this.encodeIndexBuffer,INDICES:this.encodeIndexSequence};return n(b[m]),b[m](p,h,d)},encodeFilterOct:function(p,h,d,m){return n(d==4||d==8),n(m>=1&&m<=16),g(a.exports.meshopt_encodeFilterOct,p,h,d,m,16)},encodeFilterQuat:function(p,h,d,m){return n(d==8),n(m>=4&&m<=16),g(a.exports.meshopt_encodeFilterQuat,p,h,d,m,16)},encodeFilterExp:function(p,h,d,m,b){n(d>0&&d%4==0),n(m>=1&&m<=24);var y={Separate:0,SharedVector:1,SharedComponent:2,Clamped:3};return g(a.exports.meshopt_encodeFilterExp,p,h,d,m,d,b?y[b]:1)}}})();var un=(function(){var t="b9H79Tebbbe8Fv9Gbb9Gvuuuuueu9Giuuub9Geueu9Giuuueuikqbeeedddillviebeoweuec:W:Odkr;leDo9TW9T9VV95dbH9F9F939H79T9F9J9H229F9Jt9VV7bb8A9TW79O9V9Wt9F9KW9J9V9KW9wWVtW949c919M9MWVbeY9TW79O9V9Wt9F9KW9J9V9KW69U9KW949c919M9MWVbdE9TW79O9V9Wt9F9KW9J9V9KW69U9KW949tWG91W9U9JWbiL9TW79O9V9Wt9F9KW9J9V9KWS9P2tWV9p9JtblK9TW79O9V9Wt9F9KW9J9V9KWS9P2tWV9r919HtbvL9TW79O9V9Wt9F9KW9J9V9KWS9P2tWVT949Wbol79IV9Rbrq:S86qdbk;jYi5ud9:du8Jjjjjbcj;kb9Rgv8Kjjjjbc9:hodnalTmbcuhoaiRbbgrc;WeGc:Ge9hmbarcsGgwce0mbc9:hoalcufadcd4cbawEgDadfgrcKcaawEgqaraq0Egk6mbaicefhxcj;abad9Uc;WFbGcjdadca0EhmaialfgPar9Rgoadfhsavaoadz1jjjbgzceVhHcbhOdndninaeaO9nmeaPax9RaD6mdamaeaO9RaOamfgoae6EgAcsfglc9WGhCabaOad2fhXaAcethQaxaDfhiaOaeaoaeao6E9RhLalcl4cifcd4hKazcj;cbfaAfhYcbh8AazcjdfhEaHh3incbhodnawTmbaxa8Acd4fRbbhokaocFeGh5cbh8Eazcj;cbfhqinaih8Fdndndndna5a8Ecet4ciGgoc9:fPdebdkaPa8F9RaA6mrazcj;cbfa8EaA2fa8FaAz1jjjb8Aa8FaAfhixdkazcj;cbfa8EaA2fcbaAz:jjjjb8Aa8FhixekaPa8F9RaK6mva8FaKfhidnaCTmbaPai9RcK6mbaocdtc:q1jjbfcj1jjbawEhaczhrcbhlinargoc9Wfghaqfhrdndndndndndnaaa8Fahco4fRbbalcoG4ciGcdtfydbPDbedvivvvlvkar9cb83bbarcwf9cb83bbxlkarcbaiRbdai8Xbb9c:c:qj:bw9:9c:q;c1:I1e:d9c:b:c:e1z9:gg9cjjjjjz:dg8J9qE86bbaqaofgrcGfag9c8F1:NghcKtc8F91aicdfa8J9c8N1:Nfg8KRbbG86bbarcVfcba8KahcjeGcr4fghRbbag9cjjjjjl:dg8J9qE86bbarc7fcbaha8J9c8L1:NfghRbbag9cjjjjjd:dg8J9qE86bbarctfcbaha8J9c8K1:NfghRbbag9cjjjjje:dg8J9qE86bbarc91fcbaha8J9c8J1:NfghRbbag9cjjjj;ab:dg8J9qE86bbarc4fcbaha8J9cg1:NfghRbbag9cjjjja:dg8J9qE86bbarc93fcbaha8J9ch1:NfghRbbag9cjjjjz:dgg9qE86bbarc94fcbahag9ca1:NfghRbbai8Xbe9c:c:qj:bw9:9c:q;c1:I1e:d9c:b:c:e1z9:gg9cjjjjjz:dg8J9qE86bbarc95fag9c8F1:NgicKtc8F91aha8J9c8N1:NfghRbbG86bbarc96fcbahaicjeGcr4fgiRbbag9cjjjjjl:dg8J9qE86bbarc97fcbaia8J9c8L1:NfgiRbbag9cjjjjjd:dg8J9qE86bbarc98fcbaia8J9c8K1:NfgiRbbag9cjjjjje:dg8J9qE86bbarc99fcbaia8J9c8J1:NfgiRbbag9cjjjj;ab:dg8J9qE86bbarc9:fcbaia8J9cg1:NfgiRbbag9cjjjja:dg8J9qE86bbarcufcbaia8J9ch1:NfgiRbbag9cjjjjz:dgg9qE86bbaiag9ca1:NfhixikaraiRblaiRbbghco4g8Ka8KciSg8KE86bbaqaofgrcGfaiclfa8Kfg8KRbbahcl4ciGg8La8LciSg8LE86bbarcVfa8Ka8Lfg8KRbbahcd4ciGg8La8LciSg8LE86bbarc7fa8Ka8Lfg8KRbbahciGghahciSghE86bbarctfa8Kahfg8KRbbaiRbeghco4g8La8LciSg8LE86bbarc91fa8Ka8Lfg8KRbbahcl4ciGg8La8LciSg8LE86bbarc4fa8Ka8Lfg8KRbbahcd4ciGg8La8LciSg8LE86bbarc93fa8Ka8Lfg8KRbbahciGghahciSghE86bbarc94fa8Kahfg8KRbbaiRbdghco4g8La8LciSg8LE86bbarc95fa8Ka8Lfg8KRbbahcl4ciGg8La8LciSg8LE86bbarc96fa8Ka8Lfg8KRbbahcd4ciGg8La8LciSg8LE86bbarc97fa8Ka8Lfg8KRbbahciGghahciSghE86bbarc98fa8KahfghRbbaiRbigico4g8Ka8KciSg8KE86bbarc99faha8KfghRbbaicl4ciGg8Ka8KciSg8KE86bbarc9:faha8KfghRbbaicd4ciGg8Ka8KciSg8KE86bbarcufaha8KfgrRbbaiciGgiaiciSgiE86bbaraifhixdkaraiRbwaiRbbghcl4g8Ka8KcsSg8KE86bbaqaofgrcGfaicwfa8Kfg8KRbbahcsGghahcsSghE86bbarcVfa8KahfghRbbaiRbeg8Kcl4g8La8LcsSg8LE86bbarc7faha8LfghRbba8KcsGg8Ka8KcsSg8KE86bbarctfaha8KfghRbbaiRbdg8Kcl4g8La8LcsSg8LE86bbarc91faha8LfghRbba8KcsGg8Ka8KcsSg8KE86bbarc4faha8KfghRbbaiRbig8Kcl4g8La8LcsSg8LE86bbarc93faha8LfghRbba8KcsGg8Ka8KcsSg8KE86bbarc94faha8KfghRbbaiRblg8Kcl4g8La8LcsSg8LE86bbarc95faha8LfghRbba8KcsGg8Ka8KcsSg8KE86bbarc96faha8KfghRbbaiRbvg8Kcl4g8La8LcsSg8LE86bbarc97faha8LfghRbba8KcsGg8Ka8KcsSg8KE86bbarc98faha8KfghRbbaiRbog8Kcl4g8La8LcsSg8LE86bbarc99faha8LfghRbba8KcsGg8Ka8KcsSg8KE86bbarc9:faha8KfghRbbaiRbrgicl4g8Ka8KcsSg8KE86bbarcufaha8KfgrRbbaicsGgiaicsSgiE86bbaraifhixekarai8Pbb83bbarcwfaicwf8Pbb83bbaiczfhikdnaoaC9pmbalcdfhlaoczfhraPai9RcL0mekkaoaC6moaimexokaCmva8FTmvkaqaAfhqa8Ecefg8Ecl9hmbkdndndndnawTmbasa8Acd4fRbbgociGPlbedrbkaATmdaza8Afh8Fazcj;cbfhhcbh8EaEhaina8FRbbhraahocbhlinaoahalfRbbgqce4cbaqceG9R7arfgr86bbaoadfhoaAalcefgl9hmbkaacefhaa8Fcefh8FahaAfhha8Ecefg8Ecl9hmbxikkaATmeaza8Afhaazcj;cbfhhcbhoceh8EaYh8FinaEaofhlaa8Vbbhrcbhoinala8FaofRbbcwtahaofRbbgqVc;:FiGce4cbaqceG9R7arfgr87bbaladfhlaLaocefgofmbka8FaQfh8FcdhoaacdfhaahaQfhha8EceGhlcbh8EalmbxdkkaATmbcbaocl49Rh8Eaza8AfRbbhqcwhoa3hlinalRbbaotaqVhqalcefhlaocwfgoca9hmbkcbhhaEh8FaYhainazcj;cbfahfRbbhrcwhoaahlinalRbbaotarVhralaAfhlaocwfgoca9hmbkara8E93aq7hqcbhoa8Fhlinalaqao486bbalcefhlaocwfgoca9hmbka8Fadfh8FaacefhaahcefghaA9hmbkkaEclfhEa3clfh3a8Aclfg8Aad6mbkaXazcjdfaAad2z1jjjb8AazazcjdfaAcufad2fadz1jjjb8AaAaOfhOaihxaimbkc9:hoxdkcbc99aPax9RakSEhoxekc9:hokavcj;kbf8Kjjjjbaok:XseHu8Jjjjjbc;ae9Rgv8Kjjjjbc9:hodnaeci9UgrcHfal0mbcuhoaiRbbgwc;WeGc;Ge9hmbawcsGgDce0mbavc;abfcFecjez:jjjjb8AavcUf9cu83ibavc8Wf9cu83ibavcyf9cu83ibavcaf9cu83ibavcKf9cu83ibavczf9cu83ibav9cu83iwav9cu83ibaialfc9WfhqaicefgwarfhldnaeTmbcmcsaDceSEhkcbhxcbhmcbhrcbhicbhoindnalaq9nmbc9:hoxikdndnawRbbgDc;Ve0mbavc;abfaoaDcu7gPcl4fcsGcitfgsydlhzasydbhHdndnaDcsGgsak9pmbavaiaPfcsGcdtfydbaxasEhDaxasTgOfhxxekdndnascsSmbcehOasc987asamffcefhDxekalcefhDal8SbbgscFeGhPdndnascu9mmbaDhlxekalcvfhlaPcFbGhPcrhsdninaD8SbbgOcFbGastaPVhPaOcu9kmeaDcefhDascrfgsc8J9hmbxdkkaDcefhlkcehOaPce4cbaPceG9R7amfhDkaDhmkavc;abfaocitfgsaDBdbasazBdlavaicdtfaDBdbavc;abfaocefcsGcitfgsaHBdbasaDBdlaocdfhoaOaifhidnadcd9hmbabarcetfgsaH87ebasclfaD87ebascdfaz87ebxdkabarcdtfgsaHBdbascwfaDBdbasclfazBdbxekdnaDcpe0mbaxcefgOavaiaqaDcsGfRbbgscl49RcsGcdtfydbascz6gPEhDavaias9RcsGcdtfydbaOaPfgzascsGgOEhsaOThOdndnadcd9hmbabarcetfgHax87ebaHclfas87ebaHcdfaD87ebxekabarcdtfgHaxBdbaHcwfasBdbaHclfaDBdbkavaicdtfaxBdbavc;abfaocitfgHaDBdbaHaxBdlavaicefgicsGcdtfaDBdbavc;abfaocefcsGcitfgHasBdbaHaDBdlavaiaPfgicsGcdtfasBdbavc;abfaocdfcsGcitfgDaxBdbaDasBdlaocifhoaiaOfhiazaOfhxxekaxcbalRbbgHEgAaDc;:eSgDfhzaHcsGhCaHcl4hXdndnaHcs0mbazcefhOxekazhOavaiaX9RcsGcdtfydbhzkdndnaCmbaOcefhxxekaOhxavaiaH9RcsGcdtfydbhOkdndnaDTmbalcefhDxekalcdfhDal8SbegPcFeGhsdnaPcu9kmbalcofhAascFbGhscrhldninaD8SbbgPcFbGaltasVhsaPcu9kmeaDcefhDalcrfglc8J9hmbkaAhDxekaDcefhDkasce4cbasceG9R7amfgmhAkdndnaXcsSmbaDhsxekaDcefhsaD8SbbglcFeGhPdnalcu9kmbaDcvfhzaPcFbGhPcrhldninas8SbbgDcFbGaltaPVhPaDcu9kmeascefhsalcrfglc8J9hmbkazhsxekascefhskaPce4cbaPceG9R7amfgmhzkdndnaCcsSmbashlxekascefhlas8SbbgDcFeGhPdnaDcu9kmbascvfhOaPcFbGhPcrhDdninal8SbbgscFbGaDtaPVhPascu9kmealcefhlaDcrfgDc8J9hmbkaOhlxekalcefhlkaPce4cbaPceG9R7amfgmhOkdndnadcd9hmbabarcetfgDaA87ebaDclfaO87ebaDcdfaz87ebxekabarcdtfgDaABdbaDcwfaOBdbaDclfazBdbkavc;abfaocitfgDazBdbaDaABdlavaicdtfaABdbavc;abfaocefcsGcitfgDaOBdbaDazBdlavaicefgicsGcdtfazBdbavc;abfaocdfcsGcitfgDaABdbaDaOBdlavaiaHcz6aXcsSVfgicsGcdtfaOBdbaiaCTaCcsSVfhiaocifhokawcefhwaocsGhoaicsGhiarcifgrae6mbkkcbc99alaqSEhokavc;aef8Kjjjjbaok:clevu8Jjjjjbcz9Rhvdnaecvfal9nmbc9:skdnaiRbbc;:eGc;qeSmbcuskav9cb83iwaicefhoaialfc98fhrdnaeTmbdnadcdSmbcbhwindnaoar6mbc9:skaocefhlao8SbbgicFeGhddndnaicu9mmbalhoxekaocvfhoadcFbGhdcrhidninal8SbbgDcFbGaitadVhdaDcu9kmealcefhlaicrfgic8J9hmbxdkkalcefhokabawcdtfadc8Etc8F91adcd47avcwfadceGcdtVglydbfgiBdbalaiBdbawcefgwae9hmbxdkkcbhwindnaoar6mbc9:skaocefhlao8SbbgicFeGhddndnaicu9mmbalhoxekaocvfhoadcFbGhdcrhidninal8SbbgDcFbGaitadVhdaDcu9kmealcefhlaicrfgic8J9hmbxdkkalcefhokabawcetfadc8Etc8F91adcd47avcwfadceGcdtVglydbfgi87ebalaiBdbawcefgwae9hmbkkcbc99aoarSEk:Lvoeue99dud99eud99dndnadcl9hmbaeTmeindndnabcdfgd8Sbb:Yab8Sbbgi:Ygl:l:tabcefgv8Sbbgo:Ygr:l:tgwJbb;:9cawawNJbbbbawawJbbbb9GgDEgq:mgkaqaicb9iEalMgwawNakaqaocb9iEarMgqaqNMM:r:vglNJbbbZJbbb:;aDEMgr:lJbbb9p9DTmbar:Ohixekcjjjj94hikadai86bbdndnaqalNJbbbZJbbb:;aqJbbbb9GEMgq:lJbbb9p9DTmbaq:Ohdxekcjjjj94hdkavad86bbdndnawalNJbbbZJbbb:;awJbbbb9GEMgw:lJbbb9p9DTmbaw:Ohdxekcjjjj94hdkabad86bbabclfhbaecufgembxdkkaeTmbindndnabclfgd8Ueb:Yab8Uebgi:Ygl:l:tabcdfgv8Uebgo:Ygr:l:tgwJb;:FSawawNJbbbbawawJbbbb9GgDEgq:mgkaqaicb9iEalMgwawNakaqaocb9iEarMgqaqNMM:r:vglNJbbbZJbbb:;aDEMgr:lJbbb9p9DTmbar:Ohixekcjjjj94hikadai87ebdndnaqalNJbbbZJbbb:;aqJbbbb9GEMgq:lJbbb9p9DTmbaq:Ohdxekcjjjj94hdkavad87ebdndnawalNJbbbZJbbb:;awJbbbb9GEMgw:lJbbb9p9DTmbaw:Ohdxekcjjjj94hdkabad87ebabcwfhbaecufgembkkk;oiliui99iue99dnaeTmbcbhiabhlindndnJ;Zl81Zalcof8UebgvciV:Y:vgoal8Ueb:YNgrJb;:FSNJbbbZJbbb:;arJbbbb9GEMgw:lJbbb9p9DTmbaw:OhDxekcjjjj94hDkalclf8Uebhqalcdf8UebhkabaiavcefciGfcetfaD87ebdndnaoak:YNgwJb;:FSNJbbbZJbbb:;awJbbbb9GEMgx:lJbbb9p9DTmbax:OhDxekcjjjj94hDkabaiavciGfgkcd7cetfaD87ebdndnaoaq:YNgoJb;:FSNJbbbZJbbb:;aoJbbbb9GEMgx:lJbbb9p9DTmbax:OhDxekcjjjj94hDkabaiavcufciGfcetfaD87ebdndnJbbjZararN:tawawN:taoaoN:tgrJbbbbarJbbbb9GE:rJb;:FSNJbbbZMgr:lJbbb9p9DTmbar:Ohvxekcjjjj94hvkabakcetfav87ebalcwfhlaiclfhiaecufgembkkk9mbdnadcd4ae2gdTmbinababydbgecwtcw91:Yaece91cjjj98Gcjjj;8if::NUdbabclfhbadcufgdmbkkk9teiucbcbyd:K1jjbgeabcifc98GfgbBd:K1jjbdndnabZbcztgd9nmbcuhiabad9RcFFifcz4nbcuSmekaehikaik;teeeudndnaeabVciGTmbabhixekdndnadcz9pmbabhixekabhiinaiaeydbBdbaiaeydlBdlaiaeydwBdwaiaeydxBdxaeczfheaiczfhiadc9Wfgdcs0mbkkadcl6mbinaiaeydbBdbaeclfheaiclfhiadc98fgdci0mbkkdnadTmbinaiaeRbb86bbaicefhiaecefheadcufgdmbkkabk:3eedudndnabciGTmbabhixekaecFeGc:b:c:ew2hldndnadcz9pmbabhixekabhiinaialBdxaialBdwaialBdlaialBdbaiczfhiadc9Wfgdcs0mbkkadcl6mbinaialBdbaiclfhiadc98fgdci0mbkkdnadTmbinaiae86bbaicefhiadcufgdmbkkabkk81dbcjwk8Kbbbbdbbblbbbwbbbbbbbebbbdbbblbbbwbbbbc:Kwkl8WNbb",e="b9H79TebbbeKl9Gbb9Gvuuuuueu9Giuuub9Geueuikqbbebeedddilve9Weeeviebeoweuec:q:6dkr;leDo9TW9T9VV95dbH9F9F939H79T9F9J9H229F9Jt9VV7bb8A9TW79O9V9Wt9F9KW9J9V9KW9wWVtW949c919M9MWVbdY9TW79O9V9Wt9F9KW9J9V9KW69U9KW949c919M9MWVblE9TW79O9V9Wt9F9KW9J9V9KW69U9KW949tWG91W9U9JWbvL9TW79O9V9Wt9F9KW9J9V9KWS9P2tWV9p9JtboK9TW79O9V9Wt9F9KW9J9V9KWS9P2tWV9r919HtbrL9TW79O9V9Wt9F9KW9J9V9KWS9P2tWVT949Wbwl79IV9RbDq;G9Mqlbzik9:evu8Jjjjjbcz9Rhbcbheincbhdcbhiinabcwfadfaicjuaead4ceGglE86bbaialfhiadcefgdcw9hmbkaec:q:yjjbfai86bbaecitc:q1jjbfab8Piw83ibaecefgecjd9hmbkk:183lYud97dur978Jjjjjbcj;kb9Rgv8Kjjjjbc9:hodnalTmbcuhoaiRbbgrc;WeGc:Ge9hmbarcsGgwce0mbc9:hoalcufadcd4cbawEgDadfgrcKcaawEgqaraq0Egk6mbaicefhxavaialfgmar9Rgoad;8qbbcj;abad9Uc;WFbGcjdadca0EhPdndndnadTmbaoadfhscbhzinaeaz9nmdamax9RaD6miabazad2fhHaxaDfhOaPaeaz9RazaPfae6EgAcsfgocl4cifcd4hCavcj;cbfaoc9WGgXcetfhQavcj;cbfaXci2fhLavcj;cbfaXfhKcbhYaoc;ab6h8AincbhodnawTmbaxaYcd4fRbbhokaocFeGhEcbh3avcj;cbfh5indndndndnaEa3cet4ciGgoc9:fPdebdkamaO9RaX6mwavcj;cbfa3aX2faOaX;8qbbaOaAfhOxdkavcj;cbfa3aX2fcbaX;8kbxekamaO9RaC6moaoclVcbawEhraOaCfhocbhidna8Ambamao9Rc;Gb6mbcbhlina5alfhidndndndndndnaOalco4fRbbgqciGarfPDbedibledibkaipxbbbbbbbbbbbbbbbbpklbxlkaiaopbblaopbbbg8Eclp:mea8EpmbzeHdOiAlCvXoQrLg8Ecdp:mea8EpmbzeHdOiAlCvXoQrLpxiiiiiiiiiiiiiiiip9og8Fpxiiiiiiiiiiiiiiiip8Jg8Ep5b9cjF;8;4;W;G;ab9:9cU1:Ngacitc:q1jjbfpbibaac:q:yjjbfRbbgapsa8Ep5e9cjF;8;4;W;G;ab9:9cU1:Nghcitc:q1jjbfpbibp9UpmbedilvorzHOACXQLpPa8Fa8Ep9spklbaaaoclffahc:q:yjjbfRbbfhoxikaiaopbbwaopbbbg8Eclp:mea8EpmbzeHdOiAlCvXoQrLpxssssssssssssssssp9og8Fpxssssssssssssssssp8Jg8Ep5b9cjF;8;4;W;G;ab9:9cU1:Ngacitc:q1jjbfpbibaac:q:yjjbfRbbgapsa8Ep5e9cjF;8;4;W;G;ab9:9cU1:Nghcitc:q1jjbfpbibp9UpmbedilvorzHOACXQLpPa8Fa8Ep9spklbaaaocwffahc:q:yjjbfRbbfhoxdkaiaopbbbpklbaoczfhoxekaiaopbbdaoRbbgacitc:q1jjbfpbibaac:q:yjjbfRbbgapsaoRbeghcitc:q1jjbfpbibp9UpmbedilvorzHOACXQLpPpklbaaaocdffahc:q:yjjbfRbbfhokdndndndndndnaqcd4ciGarfPDbedibledibkaiczfpxbbbbbbbbbbbbbbbbpklbxlkaiczfaopbblaopbbbg8Eclp:mea8EpmbzeHdOiAlCvXoQrLg8Ecdp:mea8EpmbzeHdOiAlCvXoQrLpxiiiiiiiiiiiiiiiip9og8Fpxiiiiiiiiiiiiiiiip8Jg8Ep5b9cjF;8;4;W;G;ab9:9cU1:Ngacitc:q1jjbfpbibaac:q:yjjbfRbbgapsa8Ep5e9cjF;8;4;W;G;ab9:9cU1:Nghcitc:q1jjbfpbibp9UpmbedilvorzHOACXQLpPa8Fa8Ep9spklbaaaoclffahc:q:yjjbfRbbfhoxikaiczfaopbbwaopbbbg8Eclp:mea8EpmbzeHdOiAlCvXoQrLpxssssssssssssssssp9og8Fpxssssssssssssssssp8Jg8Ep5b9cjF;8;4;W;G;ab9:9cU1:Ngacitc:q1jjbfpbibaac:q:yjjbfRbbgapsa8Ep5e9cjF;8;4;W;G;ab9:9cU1:Nghcitc:q1jjbfpbibp9UpmbedilvorzHOACXQLpPa8Fa8Ep9spklbaaaocwffahc:q:yjjbfRbbfhoxdkaiczfaopbbbpklbaoczfhoxekaiczfaopbbdaoRbbgacitc:q1jjbfpbibaac:q:yjjbfRbbgapsaoRbeghcitc:q1jjbfpbibp9UpmbedilvorzHOACXQLpPpklbaaaocdffahc:q:yjjbfRbbfhokdndndndndndnaqcl4ciGarfPDbedibledibkaicafpxbbbbbbbbbbbbbbbbpklbxlkaicafaopbblaopbbbg8Eclp:mea8EpmbzeHdOiAlCvXoQrLg8Ecdp:mea8EpmbzeHdOiAlCvXoQrLpxiiiiiiiiiiiiiiiip9og8Fpxiiiiiiiiiiiiiiiip8Jg8Ep5b9cjF;8;4;W;G;ab9:9cU1:Ngacitc:q1jjbfpbibaac:q:yjjbfRbbgapsa8Ep5e9cjF;8;4;W;G;ab9:9cU1:Nghcitc:q1jjbfpbibp9UpmbedilvorzHOACXQLpPa8Fa8Ep9spklbaaaoclffahc:q:yjjbfRbbfhoxikaicafaopbbwaopbbbg8Eclp:mea8EpmbzeHdOiAlCvXoQrLpxssssssssssssssssp9og8Fpxssssssssssssssssp8Jg8Ep5b9cjF;8;4;W;G;ab9:9cU1:Ngacitc:q1jjbfpbibaac:q:yjjbfRbbgapsa8Ep5e9cjF;8;4;W;G;ab9:9cU1:Nghcitc:q1jjbfpbibp9UpmbedilvorzHOACXQLpPa8Fa8Ep9spklbaaaocwffahc:q:yjjbfRbbfhoxdkaicafaopbbbpklbaoczfhoxekaicafaopbbdaoRbbgacitc:q1jjbfpbibaac:q:yjjbfRbbgapsaoRbeghcitc:q1jjbfpbibp9UpmbedilvorzHOACXQLpPpklbaaaocdffahc:q:yjjbfRbbfhokdndndndndndnaqco4arfPDbedibledibkaic8Wfpxbbbbbbbbbbbbbbbbpklbxlkaic8Wfaopbblaopbbbg8Eclp:mea8EpmbzeHdOiAlCvXoQrLg8Ecdp:mea8EpmbzeHdOiAlCvXoQrLpxiiiiiiiiiiiiiiiip9og8Fpxiiiiiiiiiiiiiiiip8Jg8Ep5b9cjF;8;4;W;G;ab9:9cU1:Ngicitc:q1jjbfpbibaic:q:yjjbfRbbgipsa8Ep5e9cjF;8;4;W;G;ab9:9cU1:Ngqcitc:q1jjbfpbibp9UpmbedilvorzHOACXQLpPa8Fa8Ep9spklbaiaoclffaqc:q:yjjbfRbbfhoxikaic8Wfaopbbwaopbbbg8Eclp:mea8EpmbzeHdOiAlCvXoQrLpxssssssssssssssssp9og8Fpxssssssssssssssssp8Jg8Ep5b9cjF;8;4;W;G;ab9:9cU1:Ngicitc:q1jjbfpbibaic:q:yjjbfRbbgipsa8Ep5e9cjF;8;4;W;G;ab9:9cU1:Ngqcitc:q1jjbfpbibp9UpmbedilvorzHOACXQLpPa8Fa8Ep9spklbaiaocwffaqc:q:yjjbfRbbfhoxdkaic8Wfaopbbbpklbaoczfhoxekaic8WfaopbbdaoRbbgicitc:q1jjbfpbibaic:q:yjjbfRbbgipsaoRbegqcitc:q1jjbfpbibp9UpmbedilvorzHOACXQLpPpklbaiaocdffaqc:q:yjjbfRbbfhokalc;abfhialcjefaX0meaihlamao9Rc;Fb0mbkkdnaiaX9pmbaici4hlinamao9RcK6mwa5aifhqdndndndndndnaOaico4fRbbalcoG4ciGarfPDbedibledibkaqpxbbbbbbbbbbbbbbbbpkbbxlkaqaopbblaopbbbg8Eclp:mea8EpmbzeHdOiAlCvXoQrLg8Ecdp:mea8EpmbzeHdOiAlCvXoQrLpxiiiiiiiiiiiiiiiip9og8Fpxiiiiiiiiiiiiiiiip8Jg8Ep5b9cjF;8;4;W;G;ab9:9cU1:Ngacitc:q1jjbfpbibaac:q:yjjbfRbbgapsa8Ep5e9cjF;8;4;W;G;ab9:9cU1:Nghcitc:q1jjbfpbibp9UpmbedilvorzHOACXQLpPa8Fa8Ep9spkbbaaaoclffahc:q:yjjbfRbbfhoxikaqaopbbwaopbbbg8Eclp:mea8EpmbzeHdOiAlCvXoQrLpxssssssssssssssssp9og8Fpxssssssssssssssssp8Jg8Ep5b9cjF;8;4;W;G;ab9:9cU1:Ngacitc:q1jjbfpbibaac:q:yjjbfRbbgapsa8Ep5e9cjF;8;4;W;G;ab9:9cU1:Nghcitc:q1jjbfpbibp9UpmbedilvorzHOACXQLpPa8Fa8Ep9spkbbaaaocwffahc:q:yjjbfRbbfhoxdkaqaopbbbpkbbaoczfhoxekaqaopbbdaoRbbgacitc:q1jjbfpbibaac:q:yjjbfRbbgapsaoRbeghcitc:q1jjbfpbibp9UpmbedilvorzHOACXQLpPpkbbaaaocdffahc:q:yjjbfRbbfhokalcdfhlaiczfgiaX6mbkkaohOaoTmoka5aXfh5a3cefg3cl9hmbkdndndndnawTmbasaYcd4fRbbglciGPlbedwbkaXTmdavcjdfaYfhlavaYfpbdbhgcbhoinalavcj;cbfaofpblbg8JaKaofpblbg8KpmbzeHdOiAlCvXoQrLg8LaQaofpblbg8MaLaofpblbg8NpmbzeHdOiAlCvXoQrLgypmbezHdiOAlvCXorQLg8Ecep9Ta8Epxeeeeeeeeeeeeeeeeg8Fp9op9Hp9rg8Eagp9Uggp9Abbbaladfglaga8Ea8Epmlvorlvorlvorlvorp9Uggp9Abbbaladfglaga8Ea8EpmwDqkwDqkwDqkwDqkp9Uggp9Abbbaladfglaga8Ea8EpmxmPsxmPsxmPsxmPsp9Uggp9Abbbaladfglaga8LaypmwDKYqk8AExm35Ps8E8Fg8Ecep9Ta8Ea8Fp9op9Hp9rg8Ep9Uggp9Abbbaladfglaga8Ea8Epmlvorlvorlvorlvorp9Uggp9Abbbaladfglaga8Ea8EpmwDqkwDqkwDqkwDqkp9Uggp9Abbbaladfglaga8Ea8EpmxmPsxmPsxmPsxmPsp9Uggp9Abbbaladfglaga8Ja8KpmwKDYq8AkEx3m5P8Es8Fg8Ja8Ma8NpmwKDYq8AkEx3m5P8Es8Fg8KpmbezHdiOAlvCXorQLg8Ecep9Ta8Ea8Fp9op9Hp9rg8Ep9Uggp9Abbbaladfglaga8Ea8Epmlvorlvorlvorlvorp9Uggp9Abbbaladfglaga8Ea8EpmwDqkwDqkwDqkwDqkp9Uggp9Abbbaladfglaga8Ea8EpmxmPsxmPsxmPsxmPsp9Uggp9Abbbaladfglaga8Ja8KpmwDKYqk8AExm35Ps8E8Fg8Ecep9Ta8Ea8Fp9op9Hp9rg8Ep9Ug8Fp9Abbbaladfgla8Fa8Ea8Epmlvorlvorlvorlvorp9Ug8Fp9Abbbaladfgla8Fa8Ea8EpmwDqkwDqkwDqkwDqkp9Ug8Fp9Abbbaladfgla8Fa8Ea8EpmxmPsxmPsxmPsxmPsp9Uggp9AbbbaladfhlaoczfgoaX6mbxikkaXTmeavcjdfaYfhlavaYfpbdbhgcbhoinalavcj;cbfaofpblbg8JaKaofpblbg8KpmbzeHdOiAlCvXoQrLg8LaQaofpblbg8MaLaofpblbg8NpmbzeHdOiAlCvXoQrLgypmbezHdiOAlvCXorQLg8Ecep:nea8Epxebebebebebebebebg8Fp9op:bep9rg8Eagp:oeggp9Abbbaladfglaga8Ea8Epmlvorlvorlvorlvorp:oeggp9Abbbaladfglaga8Ea8EpmwDqkwDqkwDqkwDqkp:oeggp9Abbbaladfglaga8Ea8EpmxmPsxmPsxmPsxmPsp:oeggp9Abbbaladfglaga8LaypmwDKYqk8AExm35Ps8E8Fg8Ecep:nea8Ea8Fp9op:bep9rg8Ep:oeggp9Abbbaladfglaga8Ea8Epmlvorlvorlvorlvorp:oeggp9Abbbaladfglaga8Ea8EpmwDqkwDqkwDqkwDqkp:oeggp9Abbbaladfglaga8Ea8EpmxmPsxmPsxmPsxmPsp:oeggp9Abbbaladfglaga8Ja8KpmwKDYq8AkEx3m5P8Es8Fg8Ja8Ma8NpmwKDYq8AkEx3m5P8Es8Fg8KpmbezHdiOAlvCXorQLg8Ecep:nea8Ea8Fp9op:bep9rg8Ep:oeggp9Abbbaladfglaga8Ea8Epmlvorlvorlvorlvorp:oeggp9Abbbaladfglaga8Ea8EpmwDqkwDqkwDqkwDqkp:oeggp9Abbbaladfglaga8Ea8EpmxmPsxmPsxmPsxmPsp:oeggp9Abbbaladfglaga8Ja8KpmwDKYqk8AExm35Ps8E8Fg8Ecep:nea8Ea8Fp9op:bep9rg8Ep:oeg8Fp9Abbbaladfgla8Fa8Ea8Epmlvorlvorlvorlvorp:oeg8Fp9Abbbaladfgla8Fa8Ea8EpmwDqkwDqkwDqkwDqkp:oeg8Fp9Abbbaladfgla8Fa8Ea8EpmxmPsxmPsxmPsxmPsp:oeggp9AbbbaladfhlaoczfgoaX6mbxdkkaXTmbcbhocbalcl4gl9Rc8FGhiavcjdfaYfhravaYfpbdbh8Finaravcj;cbfaofpblbggaKaofpblbg8JpmbzeHdOiAlCvXoQrLg8KaQaofpblbg8LaLaofpblbg8MpmbzeHdOiAlCvXoQrLg8NpmbezHdiOAlvCXorQLg8Eaip:Rea8Ealp:Sep9qg8Ea8Fp9rg8Fp9Abbbaradfgra8Fa8Ea8Epmlvorlvorlvorlvorp9rg8Fp9Abbbaradfgra8Fa8Ea8EpmwDqkwDqkwDqkwDqkp9rg8Fp9Abbbaradfgra8Fa8Ea8EpmxmPsxmPsxmPsxmPsp9rg8Fp9Abbbaradfgra8Fa8Ka8NpmwDKYqk8AExm35Ps8E8Fg8Eaip:Rea8Ealp:Sep9qg8Ep9rg8Fp9Abbbaradfgra8Fa8Ea8Epmlvorlvorlvorlvorp9rg8Fp9Abbbaradfgra8Fa8Ea8EpmwDqkwDqkwDqkwDqkp9rg8Fp9Abbbaradfgra8Fa8Ea8EpmxmPsxmPsxmPsxmPsp9rg8Fp9Abbbaradfgra8Faga8JpmwKDYq8AkEx3m5P8Es8Fgga8La8MpmwKDYq8AkEx3m5P8Es8Fg8JpmbezHdiOAlvCXorQLg8Eaip:Rea8Ealp:Sep9qg8Ep9rg8Fp9Abbbaradfgra8Fa8Ea8Epmlvorlvorlvorlvorp9rg8Fp9Abbbaradfgra8Fa8Ea8EpmwDqkwDqkwDqkwDqkp9rg8Fp9Abbbaradfgra8Fa8Ea8EpmxmPsxmPsxmPsxmPsp9rg8Fp9Abbbaradfgra8Faga8JpmwDKYqk8AExm35Ps8E8Fg8Eaip:Rea8Ealp:Sep9qg8Ep9rg8Fp9Abbbaradfgra8Fa8Ea8Epmlvorlvorlvorlvorp9rg8Fp9Abbbaradfgra8Fa8Ea8EpmwDqkwDqkwDqkwDqkp9rg8Fp9Abbbaradfgra8Fa8Ea8EpmxmPsxmPsxmPsxmPsp9rg8Fp9AbbbaradfhraoczfgoaX6mbkkaYclfgYad6mbkaHavcjdfaAad2;8qbbavavcjdfaAcufad2fad;8qbbaAazfhzc9:hoaOhxaOmbxlkkaeTmbaDalfhrcbhocuhlinaralaD9RglfaD6mdaPaeao9RaoaPfae6Eaofgoae6mbkaial9Rhxkcbc99amax9RakSEhoxekc9:hokavcj;kbf8Kjjjjbaokwbz:bjjjbk:TseHu8Jjjjjbc;ae9Rgv8Kjjjjbc9:hodnaeci9UgrcHfal0mbcuhoaiRbbgwc;WeGc;Ge9hmbawcsGgDce0mbavc;abfcFecje;8kbavcUf9cu83ibavc8Wf9cu83ibavcyf9cu83ibavcaf9cu83ibavcKf9cu83ibavczf9cu83ibav9cu83iwav9cu83ibaialfc9WfhqaicefgwarfhldnaeTmbcmcsaDceSEhkcbhxcbhmcbhrcbhicbhoindnalaq9nmbc9:hoxikdndnawRbbgDc;Ve0mbavc;abfaoaDcu7gPcl4fcsGcitfgsydlhzasydbhHdndnaDcsGgsak9pmbavaiaPfcsGcdtfydbaxasEhDaxasTgOfhxxekdndnascsSmbcehOasc987asamffcefhDxekalcefhDal8SbbgscFeGhPdndnascu9mmbaDhlxekalcvfhlaPcFbGhPcrhsdninaD8SbbgOcFbGastaPVhPaOcu9kmeaDcefhDascrfgsc8J9hmbxdkkaDcefhlkcehOaPce4cbaPceG9R7amfhDkaDhmkavc;abfaocitfgsaDBdbasazBdlavaicdtfaDBdbavc;abfaocefcsGcitfgsaHBdbasaDBdlaocdfhoaOaifhidnadcd9hmbabarcetfgsaH87ebasclfaD87ebascdfaz87ebxdkabarcdtfgsaHBdbascwfaDBdbasclfazBdbxekdnaDcpe0mbaxcefgOavaiaqaDcsGfRbbgscl49RcsGcdtfydbascz6gPEhDavaias9RcsGcdtfydbaOaPfgzascsGgOEhsaOThOdndnadcd9hmbabarcetfgHax87ebaHclfas87ebaHcdfaD87ebxekabarcdtfgHaxBdbaHcwfasBdbaHclfaDBdbkavaicdtfaxBdbavc;abfaocitfgHaDBdbaHaxBdlavaicefgicsGcdtfaDBdbavc;abfaocefcsGcitfgHasBdbaHaDBdlavaiaPfgicsGcdtfasBdbavc;abfaocdfcsGcitfgDaxBdbaDasBdlaocifhoaiaOfhiazaOfhxxekaxcbalRbbgHEgAaDc;:eSgDfhzaHcsGhCaHcl4hXdndnaHcs0mbazcefhOxekazhOavaiaX9RcsGcdtfydbhzkdndnaCmbaOcefhxxekaOhxavaiaH9RcsGcdtfydbhOkdndnaDTmbalcefhDxekalcdfhDal8SbegPcFeGhsdnaPcu9kmbalcofhAascFbGhscrhldninaD8SbbgPcFbGaltasVhsaPcu9kmeaDcefhDalcrfglc8J9hmbkaAhDxekaDcefhDkasce4cbasceG9R7amfgmhAkdndnaXcsSmbaDhsxekaDcefhsaD8SbbglcFeGhPdnalcu9kmbaDcvfhzaPcFbGhPcrhldninas8SbbgDcFbGaltaPVhPaDcu9kmeascefhsalcrfglc8J9hmbkazhsxekascefhskaPce4cbaPceG9R7amfgmhzkdndnaCcsSmbashlxekascefhlas8SbbgDcFeGhPdnaDcu9kmbascvfhOaPcFbGhPcrhDdninal8SbbgscFbGaDtaPVhPascu9kmealcefhlaDcrfgDc8J9hmbkaOhlxekalcefhlkaPce4cbaPceG9R7amfgmhOkdndnadcd9hmbabarcetfgDaA87ebaDclfaO87ebaDcdfaz87ebxekabarcdtfgDaABdbaDcwfaOBdbaDclfazBdbkavc;abfaocitfgDazBdbaDaABdlavaicdtfaABdbavc;abfaocefcsGcitfgDaOBdbaDazBdlavaicefgicsGcdtfazBdbavc;abfaocdfcsGcitfgDaABdbaDaOBdlavaiaHcz6aXcsSVfgicsGcdtfaOBdbaiaCTaCcsSVfhiaocifhokawcefhwaocsGhoaicsGhiarcifgrae6mbkkcbc99alaqSEhokavc;aef8Kjjjjbaok:clevu8Jjjjjbcz9Rhvdnaecvfal9nmbc9:skdnaiRbbc;:eGc;qeSmbcuskav9cb83iwaicefhoaialfc98fhrdnaeTmbdnadcdSmbcbhwindnaoar6mbc9:skaocefhlao8SbbgicFeGhddndnaicu9mmbalhoxekaocvfhoadcFbGhdcrhidninal8SbbgDcFbGaitadVhdaDcu9kmealcefhlaicrfgic8J9hmbxdkkalcefhokabawcdtfadc8Etc8F91adcd47avcwfadceGcdtVglydbfgiBdbalaiBdbawcefgwae9hmbxdkkcbhwindnaoar6mbc9:skaocefhlao8SbbgicFeGhddndnaicu9mmbalhoxekaocvfhoadcFbGhdcrhidninal8SbbgDcFbGaitadVhdaDcu9kmealcefhlaicrfgic8J9hmbxdkkalcefhokabawcetfadc8Etc8F91adcd47avcwfadceGcdtVglydbfgi87ebalaiBdbawcefgwae9hmbkkcbc99aoarSEk:SPliuo97eue978Jjjjjbca9Rhiaec98Ghldndnadcl9hmbdnalTmbcbhvabhdinadadpbbbgocKp:RecKp:Sep;6egraocwp:RecKp:Sep;6earp;Geaoczp:RecKp:Sep;6egwp;Gep;Kep;LegDpxbbbbbbbbbbbbbbbbp:2egqarpxbbbjbbbjbbbjbbbjgkp9op9rp;Kegrpxbb;:9cbb;:9cbb;:9cbb;:9cararp;MeaDaDp;Meawaqawakp9op9rp;Kegrarp;Mep;Kep;Kep;Jep;Negwp;Mepxbbn0bbn0bbn0bbn0gqp;KepxFbbbFbbbFbbbFbbbp9oaopxbbbFbbbFbbbFbbbFp9op9qarawp;Meaqp;Kecwp:RepxbFbbbFbbbFbbbFbbp9op9qaDawp;Meaqp;Keczp:RepxbbFbbbFbbbFbbbFbp9op9qpkbbadczfhdavclfgval6mbkkalaeSmeaipxbbbbbbbbbbbbbbbbgqpklbaiabalcdtfgdaeciGglcdtgv;8qbbdnalTmbaiaipblbgocKp:RecKp:Sep;6egraocwp:RecKp:Sep;6earp;Geaoczp:RecKp:Sep;6egwp;Gep;Kep;LegDaqp:2egqarpxbbbjbbbjbbbjbbbjgkp9op9rp;Kegrpxbb;:9cbb;:9cbb;:9cbb;:9cararp;MeaDaDp;Meawaqawakp9op9rp;Kegrarp;Mep;Kep;Kep;Jep;Negwp;Mepxbbn0bbn0bbn0bbn0gqp;KepxFbbbFbbbFbbbFbbbp9oaopxbbbFbbbFbbbFbbbFp9op9qarawp;Meaqp;Kecwp:RepxbFbbbFbbbFbbbFbbp9op9qaDawp;Meaqp;Keczp:RepxbbFbbbFbbbFbbbFbp9op9qpklbkadaiav;8qbbskdnalTmbcbhvabhdinadczfgxaxpbbbgopxbbbbbbFFbbbbbbFFgkp9oadpbbbgDaopmbediwDqkzHOAKY8AEgwczp:Reczp:Sep;6egraDaopmlvorxmPsCXQL358E8FpxFubbFubbFubbFubbp9op;7eawczp:Sep;6egwp;Gearp;Gep;Kep;Legopxbbbbbbbbbbbbbbbbp:2egqarpxbbbjbbbjbbbjbbbjgmp9op9rp;Kegrpxb;:FSb;:FSb;:FSb;:FSararp;Meaoaop;Meawaqawamp9op9rp;Kegrarp;Mep;Kep;Kep;Jep;Negwp;Mepxbbn0bbn0bbn0bbn0gqp;KepxFFbbFFbbFFbbFFbbp9oaoawp;Meaqp;Keczp:Rep9qgoarawp;Meaqp;KepxFFbbFFbbFFbbFFbbp9ogrpmwDKYqk8AExm35Ps8E8Fp9qpkbbadaDakp9oaoarpmbezHdiOAlvCXorQLp9qpkbbadcafhdavclfgval6mbkkalaeSmbaiczfpxbbbbbbbbbbbbbbbbgopklbaiaopklbaiabalcitfgdaeciGglcitgv;8qbbdnalTmbaiaipblzgopxbbbbbbFFbbbbbbFFgkp9oaipblbgDaopmbediwDqkzHOAKY8AEgwczp:Reczp:Sep;6egraDaopmlvorxmPsCXQL358E8FpxFubbFubbFubbFubbp9op;7eawczp:Sep;6egwp;Gearp;Gep;Kep;Legopxbbbbbbbbbbbbbbbbp:2egqarpxbbbjbbbjbbbjbbbjgmp9op9rp;Kegrpxb;:FSb;:FSb;:FSb;:FSararp;Meaoaop;Meawaqawamp9op9rp;Kegrarp;Mep;Kep;Kep;Jep;Negwp;Mepxbbn0bbn0bbn0bbn0gqp;KepxFFbbFFbbFFbbFFbbp9oaoawp;Meaqp;Keczp:Rep9qgoarawp;Meaqp;KepxFFbbFFbbFFbbFFbbp9ogrpmwDKYqk8AExm35Ps8E8Fp9qpklzaiaDakp9oaoarpmbezHdiOAlvCXorQLp9qpklbkadaiav;8qbbkk:oDllue97euv978Jjjjjbc8W9Rhidnaec98GglTmbcbhvabhoinaiaopbbbgraoczfgwpbbbgDpmlvorxmPsCXQL358E8Fgqczp:Segkclp:RepklbaopxbbjZbbjZbbjZbbjZpx;Zl81Z;Zl81Z;Zl81Z;Zl81Zakpxibbbibbbibbbibbbp9qp;6ep;NegkaraDpmbediwDqkzHOAKY8AEgrczp:Reczp:Sep;6ep;MegDaDp;Meakarczp:Sep;6ep;Megxaxp;Meakaqczp:Reczp:Sep;6ep;Megqaqp;Mep;Kep;Kep;Lepxbbbbbbbbbbbbbbbbp:4ep;Jepxb;:FSb;:FSb;:FSb;:FSgkp;Mepxbbn0bbn0bbn0bbn0grp;KepxFFbbFFbbFFbbFFbbgmp9oaxakp;Mearp;Keczp:Rep9qgxaDakp;Mearp;Keamp9oaqakp;Mearp;Keczp:Rep9qgkpmbezHdiOAlvCXorQLgrp5baipblbpEb:T:j83ibaocwfarp5eaipblbpEe:T:j83ibawaxakpmwDKYqk8AExm35Ps8E8Fgkp5baipblbpEd:T:j83ibaocKfakp5eaipblbpEi:T:j83ibaocafhoavclfgval6mbkkdnalaeSmbaiczfpxbbbbbbbbbbbbbbbbgkpklbaiakpklbaiabalcitfgoaeciGgvcitgw;8qbbdnavTmbaiaipblbgraipblzgDpmlvorxmPsCXQL358E8Fgqczp:Segkclp:RepklaaipxbbjZbbjZbbjZbbjZpx;Zl81Z;Zl81Z;Zl81Z;Zl81Zakpxibbbibbbibbbibbbp9qp;6ep;NegkaraDpmbediwDqkzHOAKY8AEgrczp:Reczp:Sep;6ep;MegDaDp;Meakarczp:Sep;6ep;Megxaxp;Meakaqczp:Reczp:Sep;6ep;Megqaqp;Mep;Kep;Kep;Lepxbbbbbbbbbbbbbbbbp:4ep;Jepxb;:FSb;:FSb;:FSb;:FSgkp;Mepxbbn0bbn0bbn0bbn0grp;KepxFFbbFFbbFFbbFFbbgmp9oaxakp;Mearp;Keczp:Rep9qgxaDakp;Mearp;Keamp9oaqakp;Mearp;Keczp:Rep9qgkpmbezHdiOAlvCXorQLgrp5baipblapEb:T:j83ibaiarp5eaipblapEe:T:j83iwaiaxakpmwDKYqk8AExm35Ps8E8Fgkp5baipblapEd:T:j83izaiakp5eaipblapEi:T:j83iKkaoaiaw;8qbbkk;uddiue978Jjjjjbc;ab9Rhidnadcd4ae2glc98GgvTmbcbheabhdinadadpbbbgocwp:Recwp:Sep;6eaocep:SepxbbjFbbjFbbjFbbjFp9opxbbjZbbjZbbjZbbjZp:Uep;Mepkbbadczfhdaeclfgeav6mbkkdnavalSmbaic8WfpxbbbbbbbbbbbbbbbbgopklbaicafaopklbaiczfaopklbaiaopklbaiabavcdtfgdalciGgecdtgv;8qbbdnaeTmbaiaipblbgocwp:Recwp:Sep;6eaocep:SepxbbjFbbjFbbjFbbjFp9opxbbjZbbjZbbjZbbjZp:Uep;Mepklbkadaiav;8qbbkk9teiucbcbydj1jjbgeabcifc98GfgbBdj1jjbdndnabZbcztgd9nmbcuhiabad9RcFFifcz4nbcuSmekaehikaikkkebcjwklz:Dbb",a=new Uint8Array([0,97,115,109,1,0,0,0,1,4,1,96,0,0,3,3,2,0,0,5,3,1,0,1,12,1,0,10,22,2,12,0,65,0,65,0,65,0,252,10,0,0,11,7,0,65,0,253,15,26,11]),s=new Uint8Array([32,0,65,2,1,106,34,33,3,128,11,4,13,64,6,253,10,7,15,116,127,5,8,12,40,16,19,54,20,9,27,255,113,17,42,67,24,23,146,148,18,14,22,45,70,69,56,114,101,21,25,63,75,136,108,28,118,29,73,115]);if(typeof WebAssembly!="object")return{supported:!1};var r=WebAssembly.validate(a)?o(e):o(t),n,i=WebAssembly.instantiate(r,{}).then(function(b){n=b.instance,n.exports.__wasm_call_ctors()});function o(b){for(var y=new Uint8Array(b.length),x=0;x<b.length;++x){var w=b.charCodeAt(x);y[x]=w>96?w-97:w>64?w-39:w+4}for(var E=0,x=0;x<b.length;++x)y[E++]=y[x]<60?s[y[x]]:(y[x]-60)*64+y[++x];return y.buffer.slice(0,E)}function c(b,y,x,w,E,T,_){var S=b.exports.sbrk,N=w+3&-4,R=S(N*E),I=S(T.length),C=new Uint8Array(b.exports.memory.buffer);C.set(T,I);var A=y(R,w,E,I,T.length);if(A==0&&_&&_(R,N,E),x.set(C.subarray(R,R+w*E)),S(R-S(0)),A!=0)throw new Error("Malformed buffer data: "+A)}var l={NONE:"",OCTAHEDRAL:"meshopt_decodeFilterOct",QUATERNION:"meshopt_decodeFilterQuat",EXPONENTIAL:"meshopt_decodeFilterExp"},f={ATTRIBUTES:"meshopt_decodeVertexBuffer",TRIANGLES:"meshopt_decodeIndexBuffer",INDICES:"meshopt_decodeIndexSequence"},u=[],g=0;function p(b){var y={object:new Worker(b),pending:0,requests:{}};return y.object.onmessage=function(x){var w=x.data;y.pending-=w.count,y.requests[w.id][w.action](w.value),delete y.requests[w.id]},y}function h(b){for(var y="self.ready = WebAssembly.instantiate(new Uint8Array(["+new Uint8Array(r)+"]), {}).then(function(result) { result.instance.exports.__wasm_call_ctors(); return result.instance; });self.onmessage = "+m.name+";"+c.toString()+m.toString(),x=new Blob([y],{type:"text/javascript"}),w=URL.createObjectURL(x),E=u.length;E<b;++E)u[E]=p(w);for(var E=b;E<u.length;++E)u[E].object.postMessage({});u.length=b,URL.revokeObjectURL(w)}function d(b,y,x,w,E){for(var T=u[0],_=1;_<u.length;++_)u[_].pending<T.pending&&(T=u[_]);return new Promise(function(S,N){var R=new Uint8Array(x),I=++g;T.pending+=b,T.requests[I]={resolve:S,reject:N},T.object.postMessage({id:I,count:b,size:y,source:R,mode:w,filter:E},[R.buffer])})}function m(b){var y=b.data;if(!y.id)return self.close();self.ready.then(function(x){try{var w=new Uint8Array(y.count*y.size);c(x,x.exports[y.mode],w,y.count,y.size,y.source,x.exports[y.filter]),self.postMessage({id:y.id,count:y.count,action:"resolve",value:w},[w.buffer])}catch(E){self.postMessage({id:y.id,count:y.count,action:"reject",value:E})}})}return{ready:i,supported:!0,useWorkers:function(b){h(b)},decodeVertexBuffer:function(b,y,x,w,E){c(n,n.exports.meshopt_decodeVertexBuffer,b,y,x,w,n.exports[l[E]])},decodeIndexBuffer:function(b,y,x,w){c(n,n.exports.meshopt_decodeIndexBuffer,b,y,x,w)},decodeIndexSequence:function(b,y,x,w){c(n,n.exports.meshopt_decodeIndexSequence,b,y,x,w)},decodeGltfBuffer:function(b,y,x,w,E,T){c(n,n.exports[f[E]],b,y,x,w,n.exports[l[T]])},decodeGltfBufferAsync:function(b,y,x,w,E){return u.length>0?d(b,y,x,f[w],l[E]):i.then(function(){var T=new Uint8Array(b*y);return c(n,n.exports[f[w]],T,b,y,x,n.exports[l[E]]),T})}}})();var d1=(function(){var t="b9H79Tebbbetm9Geueu9Geub9Gbb9Gsuuuuuuuuuuuu99uueu9Gvuuuuub9Gruuuuuuub9Gvuuuuue999Gvuuuuueu9Gquuuuuuu99uueu9Gwuuuuuu99ueu9Giuuue999Gluuuueu9GiuuueuiOHdilvorlwiDqkbxxbelve9Weiiviebeoweuec:G:Pdkr:Tewo9TW9T9VV95dbH9F9F939H79T9F9J9H229F9Jt9VV7bbz9TW79O9V9Wt9F79P9T9W29P9M95br8E9TW79O9V9Wt9F79P9T9W29P9M959x9Pt9OcttV9P9I91tW7bwQ9TW79O9V9Wt9F79P9T9W29P9M959q9V9P9Ut7bDX9TW79O9V9Wt9F79P9T9W29P9M959t9J9H2Wbqa9TW79O9V9Wt9F9V9Wt9P9T9P96W9wWVtW94SWt9J9O9sW9T9H9Wbkl79IV9RbxDwebcekdzsq;B:xeHdbkM9Hi8Au8A99Au8Jjjjjbc;W;qb9Rgs8Kjjjjbcbhzascxfcbc;Kbz:ojjjb8AdnabaeSmbabaeadcdtz:njjjb8AkdndnamcdGmbascxfhHcbhOxekasalcrfci4gecbyd:m:jjjbHjjjjbbgABdxasceBd2aAcbaez:ojjjbhCcbhlcbhednadTmbcbhlabheadhAinaCaeydbgXci4fgQaQRbbgQceaXcrGgXtV86bbaQcu7aX4ceGalfhlaeclfheaAcufgAmbkcualcdtalcFFFFi0EhekascCfhHasaecbyd:m:jjjbHjjjjbbgOBdzascdBd2alcd4alfhXcehAinaAgecethAaeaX6mbkcdhzcbhLascuaecdtgAaecFFFFi0Ecbyd:m:jjjbHjjjjbbgXBdCasciBd2aXcFeaAz:ojjjbhKdnadTmbaecufhYcbh8AindndnaKabaLcdtfgEydbgQc:v;t;h;Ev2aYGgXcdtfgCydbgAcuSmbceheinaOaAcdtfydbaQSmdaXaefhAaecefheaKaAaYGgXcdtfgCydbgAcu9hmbkkaOa8AcdtfaQBdbaCa8ABdba8AhAa8Acefh8AkaEaABdbaLcefgLad9hmbkkaKcbyd1:jjjbH:bjjjbbascdBd2kcbh3aHcualcefgecdtaecFFFFi0Ecbyd:m:jjjbHjjjjbbg5Bdbasa5BdlasazceVgeBd2ascxfaecdtfcuadcitadcFFFFe0Ecbyd:m:jjjbHjjjjbbg8EBdbasa8EBdwasazcdfgeBd2asclfabadalcbz:cjjjbascxfaecdtfcualcdtgealcFFFFi0Eg8Fcbyd:m:jjjbHjjjjbbgABdbasazcifgXBd2ascxfaXcdtfa8Fcbyd:m:jjjbHjjjjbbgaBdbasazclVBd2aAaaaialavaOascxfz:djjjbalcbyd:m:jjjbHjjjjbbhCascxfasyd2ghcdtfaCBdbasahcefgXBd2ascxfaXcdtfa8Fcbyd:m:jjjbHjjjjbbgXBdbasahcdfgQBd2ascxfaQcdtfa8Fcbyd:m:jjjbHjjjjbbgQBdbasahcifggBd2aXcFeaez:ojjjbh8JaQcFeaez:ojjjbh8KdnalTmba8Ecwfh8Lindna5a3gQcefg3cdtfydbgKa5aQcdtgefydbgXSmbaKaX9Rhza8EaXcitfhHa8Kaefh8Ma8JaefhEcbhYindndnaHaYcitfydbg8AaQ9hmbaEaQBdba8MaQBdbxekdna5a8Acdtg8NfgeclfydbgXaeydbgeSmba8EaecitgKfydbaQSmeaXae9Rhyaecu7aXfhLa8LaKfhXcbheinaLaeSmeaecefheaXydbhKaXcwfhXaKaQ9hmbkaeay6meka8Ka8NfgeaQa8AaeydbcuSEBdbaEa8AaQaEydbcuSEBdbkaYcefgYaz9hmbkka3al9hmbkaAhXaahQa8KhKa8JhYcbheindndnaeaXydbg8A9hmbdnaeaQydbg8A9hmbaYydbh8AdnaKydbgLcu9hmba8Acu9hmbaCaefcb86bbxikaCaefhEdnaeaLSmbaea8ASmbaEce86bbxikaEcl86bbxdkdnaeaaa8AcdtgLfydb9hmbdnaKydbgEcuSmbaeaESmbaYydbgzcuSmbaeazSmba8KaLfydbgHcuSmbaHa8ASmba8JaLfydbgLcuSmbaLa8ASmbdnaAaEcdtfydbg8AaAaLcdtfydb9hmba8AaAazcdtfydbgLSmbaLaAaHcdtfydb9hmbaCaefcd86bbxlkaCaefcl86bbxikaCaefcl86bbxdkaCaefcl86bbxekaCaefaCa8AfRbb86bbkaXclfhXaQclfhQaKclfhKaYclfhYalaecefge9hmbkdnaqTmbdndnaOTmbaOheaAhXalhQindnaqaeydbfRbbTmbaCaXydbfcl86bbkaeclfheaXclfhXaQcufgQmbxdkkaAhealhXindnaqRbbTmbaCaeydbfcl86bbkaqcefhqaeclfheaXcufgXmbkkaAhealhQaChXindnaCaeydbfRbbcl9hmbaXcl86bbkaeclfheaXcefhXaQcufgQmbkkamceGTmbaChealhXindnaeRbbce9hmbaecl86bbkaecefheaXcufgXmbkkascxfagcdtfcualcx2alc;v:Q;v:Qe0Ecbyd:m:jjjbHjjjjbbg3BdbasahclfgHBd2a3aialavaOz:ejjjbh8PdndnaDmbcbhgcbh8Lxekcbh8LawhecbhXindnaeIdbJbbbb9ETmbasc;Wbfa8LcdtfaXBdba8Lcefh8LkaeclfheaDaXcefgX9hmbkascxfaHcdtfcua8Lal2gecdtaecFFFFi0Ecbyd:m:jjjbHjjjjbbggBdbasahcvfgHBd2alTmba8LTmbarcd4hEdnaOTmba8Lcdthzcbh8AaghLinaoaOa8AcdtfydbaE2cdtfhYasc;WbfheaLhXa8LhQinaXaYaeydbcdtgKfIdbawaKfIdbNUdbaeclfheaXclfhXaQcufgQmbkaLazfhLa8Acefg8Aal9hmbxdkka8Lcdthzcbh8AaghLinaoa8AaE2cdtfhYasc;WbfheaLhXa8LhQinaXaYaeydbcdtgKfIdbawaKfIdbNUdbaeclfheaXclfhXaQcufgQmbkaLazfhLa8Acefg8Aal9hmbkkascxfaHcdtfcualc8S2gealc;D;O;f8U0EgQcbyd:m:jjjbHjjjjbbgXBdbasaHcefgKBd2aXcbaez:ojjjbhqdndndna8LTmbascxfaKcdtfaQcbyd:m:jjjbHjjjjbbgvBdbasaHcdfgXBd2avcbaez:ojjjb8AascxfaXcdtfcua8Lal2gecltgXaecFFFFb0Ecbyd:m:jjjbHjjjjbbgiBdbasaHcifBd2aicbaXz:ojjjb8AadmexdkcbhvcbhiadTmekcbhYabhXindna3aXclfydbg8Acx2fgeIdba3aXydbgLcx2fgQIdbgI:tg8Ra3aXcwfydbgEcx2fgKIdlaQIdlg8S:tgRNaKIdbaI:tg8UaeIdla8S:tg8VN:tg8Wa8WNa8VaKIdwaQIdwg8X:tg8YNaRaeIdwa8X:tg8VN:tgRaRNa8Va8UNa8Ya8RN:tg8Ra8RNMM:rg8UJbbbb9ETmba8Wa8U:vh8Wa8Ra8U:vh8RaRa8U:vhRkaqaAaLcdtfydbc8S2fgeaRa8U:rg8UaRNNg8VaeIdbMUdbaea8Ra8Ua8RNg8ZNg8YaeIdlMUdlaea8Wa8Ua8WNg80Ng81aeIdwMUdwaea8ZaRNg8ZaeIdxMUdxaea80aRNgBaeIdzMUdzaea80a8RNg80aeIdCMUdCaeaRa8Ua8Wa8XNaRaINa8Sa8RNMM:mg8SNgINgRaeIdKMUdKaea8RaINg8RaeId3MUd3aea8WaINg8WaeIdaMUdaaeaIa8SNgIaeId8KMUd8Kaea8UaeIdyMUdyaqaAa8Acdtfydbc8S2fgea8VaeIdbMUdbaea8YaeIdlMUdlaea81aeIdwMUdwaea8ZaeIdxMUdxaeaBaeIdzMUdzaea80aeIdCMUdCaeaRaeIdKMUdKaea8RaeId3MUd3aea8WaeIdaMUdaaeaIaeId8KMUd8Kaea8UaeIdyMUdyaqaAaEcdtfydbc8S2fgea8VaeIdbMUdbaea8YaeIdlMUdlaea81aeIdwMUdwaea8ZaeIdxMUdxaeaBaeIdzMUdzaea80aeIdCMUdCaeaRaeIdKMUdKaea8RaeId3MUd3aea8WaeIdaMUdaaeaIaeId8KMUd8Kaea8UaeIdyMUdyaXcxfhXaYcifgYad6mbkcbhzabhLinabazcdtfh8AcbhXinaCa8AaXc;a1jjbfydbcdtfydbgQfRbbhedndnaCaLaXfydbgKfRbbgYc99fcFeGcpe0mbaec99fcFeGc;:e6mekdnaYcufcFeGce0mba8JaKcdtfydbaQ9hmekdnaecufcFeGce0mba8KaQcdtfydbaK9hmekdnaYcv2aefc:G1jjbfRbbTmbaAaQcdtfydbaAaKcdtfydb0mekJbbacJbbacJbbjZaecFeGceSEaYceSEh80dna3a8AaXc;e1jjbfydbcdtfydbcx2fgeIdwa3aKcx2fgYIdwg8S:tg8Wa3aQcx2fgEIdwa8S:tgRaRNaEIdbaYIdbg8X:tg8Ra8RNaEIdlaYIdlg8V:tg8Ua8UNMMgINa8WaRNaeIdba8X:tg81a8RNa8UaeIdla8V:tg8ZNMMg8YaRN:tg8Wa8WNa81aINa8Ya8RN:tgRaRNa8ZaINa8Ya8UN:tg8Ra8RNMM:rg8UJbbbb9ETmba8Wa8U:vh8Wa8Ra8U:vh8RaRa8U:vhRkaqaAaKcdtfydbc8S2fgeaRa80aI:rNg8UaRNNg8YaeIdbMUdbaea8Ra8Ua8RNg80Ng81aeIdlMUdlaea8Wa8Ua8WNgINg8ZaeIdwMUdwaea80aRNg80aeIdxMUdxaeaIaRNgBaeIdzMUdzaeaIa8RNg83aeIdCMUdCaeaRa8Ua8Wa8SNaRa8XNa8Va8RNMM:mg8SNgINgRaeIdKMUdKaea8RaINg8RaeId3MUd3aea8WaINg8WaeIdaMUdaaeaIa8SNgIaeId8KMUd8Kaea8UaeIdyMUdyaqaAaQcdtfydbc8S2fgea8YaeIdbMUdbaea81aeIdlMUdlaea8ZaeIdwMUdwaea80aeIdxMUdxaeaBaeIdzMUdzaea83aeIdCMUdCaeaRaeIdKMUdKaea8RaeId3MUd3aea8WaeIdaMUdaaeaIaeId8KMUd8Kaea8UaeIdyMUdykaXclfgXcx9hmbkaLcxfhLazcifgzad6mbka8LTmbcbhLinJbbbbh8Xa3abaLcdtfgeclfydbgEcx2fgXIdwa3aeydbgzcx2fgQIdwg8Z:tg8Ra8RNaXIdbaQIdbgB:tg8Wa8WNaXIdlaQIdlg83:tg8Ua8UNMMg80a3aecwfydbgHcx2fgeIdwa8Z:tgINa8Ra8RaINa8WaeIdbaB:tg8SNa8UaeIdla83:tg8VNMMgRN:tJbbbbJbbjZa80aIaINa8Sa8SNa8Va8VNMMg81NaRaRN:tg8Y:va8YJbbbb9BEg8YNhUa81a8RNaIaRN:ta8YNh85a80a8VNa8UaRN:ta8YNh86a81a8UNa8VaRN:ta8YNh87a80a8SNa8WaRN:ta8YNh88a81a8WNa8SaRN:ta8YNh89a8Wa8VNa8Sa8UN:tgRaRNa8UaINa8Va8RN:tgRaRNa8Ra8SNaIa8WN:tgRaRNMM:rJbbbZNhRagaza8L2gwcdtfhXagaHa8L2g8NcdtfhQagaEa8L2g5cdtfhKa8Z:mh8:a83:mhZaB:mhncbhYa8Lh8AJbbbbh8VJbbbbh8YJbbbbh80Jbbbbh81Jbbbbh8ZJbbbbhBJbbbbh83JbbbbhcJbbbbh9cinasc;WbfaYfgecwfaRa85aKIdbaXIdbgI:tg8UNaUaQIdbaI:tg8SNMg8RNUdbaeclfaRa87a8UNa86a8SNMg8WNUdbaeaRa89a8UNa88a8SNMg8UNUdbaecxfaRa8:a8RNaZa8WNaIana8UNMMMgINUdbaRa8Ra8WNNa81Mh81aRa8Ra8UNNa8ZMh8ZaRa8Wa8UNNaBMhBaRaIaINNa8XMh8XaRa8RaINNa8VMh8VaRa8WaINNa8YMh8YaRa8UaINNa80Mh80aRa8Ra8RNNa83Mh83aRa8Wa8WNNacMhcaRa8Ua8UNNa9cMh9caXclfhXaKclfhKaQclfhQaYczfhYa8Acufg8Ambkavazc8S2fgea9caeIdbMUdbaeacaeIdlMUdlaea83aeIdwMUdwaeaBaeIdxMUdxaea8ZaeIdzMUdzaea81aeIdCMUdCaea80aeIdKMUdKaea8YaeId3MUd3aea8VaeIdaMUdaaea8XaeId8KMUd8KaeaRaeIdyMUdyavaEc8S2fgea9caeIdbMUdbaeacaeIdlMUdlaea83aeIdwMUdwaeaBaeIdxMUdxaea8ZaeIdzMUdzaea81aeIdCMUdCaea80aeIdKMUdKaea8YaeId3MUd3aea8VaeIdaMUdaaea8XaeId8KMUd8KaeaRaeIdyMUdyavaHc8S2fgea9caeIdbMUdbaeacaeIdlMUdlaea83aeIdwMUdwaeaBaeIdxMUdxaea8ZaeIdzMUdzaea81aeIdCMUdCaea80aeIdKMUdKaea8YaeId3MUd3aea8VaeIdaMUdaaea8XaeId8KMUd8KaeaRaeIdyMUdyaiawcltfh8AcbhXa8LhKina8AaXfgeasc;WbfaXfgQIdbaeIdbMUdbaeclfgYaQclfIdbaYIdbMUdbaecwfgYaQcwfIdbaYIdbMUdbaecxfgeaQcxfIdbaeIdbMUdbaXczfhXaKcufgKmbkaia5cltfh8AcbhXa8LhKina8AaXfgeasc;WbfaXfgQIdbaeIdbMUdbaeclfgYaQclfIdbaYIdbMUdbaecwfgYaQcwfIdbaYIdbMUdbaecxfgeaQcxfIdbaeIdbMUdbaXczfhXaKcufgKmbkaia8Ncltfh8AcbhXa8LhKina8AaXfgeasc;WbfaXfgQIdbaeIdbMUdbaeclfgYaQclfIdbaYIdbMUdbaecwfgYaQcwfIdbaYIdbMUdbaecxfgeaQcxfIdbaeIdbMUdbaXczfhXaKcufgKmbkaLcifgLad6mbkkcbhQdndnamcwGgJmbJbbbbh8Vcbh9ecbhocbhhxekcbh9ea8Fcbyd:m:jjjbHjjjjbbhhascxfasyd2gecdtfahBdbasaecefgXBd2ascxfaXcdtfcuahalabadaAz:fjjjbgKcltaKcjjjjiGEcbyd:m:jjjbHjjjjbbgoBdbasaecdfBd2aoaKaha3alz:gjjjbJFFuuh8VaKTmbaoheaKhXinaeIdbgRa8Va8VaR9EEh8VaeclfheaXcufgXmbkaKh9ekasydlhTdnalTmbaTclfheaTydbhKaChXalhYcbhQincbaeydbg8AaK9RaXRbbcpeGEaQfhQaXcefhXaeclfhea8AhKaYcufgYmbkaQce4hQkcuadaQ9RcifgScx2aSc;v:Q;v:Qe0Ecbyd:m:jjjbHjjjjbbhDascxfasyd2g9hcdtfaDBdbasa9hcefgeBd2ascxfaecdtfcuaScdtaScFFFFi0Ecbyd:m:jjjbHjjjjbbgrBdbasa9hcdfgeBd2ascxfaecdtfa8Fcbyd:m:jjjbHjjjjbbgyBdbasa9hcifgeBd2ascxfaecdtfalcbyd:m:jjjbHjjjjbbg9iBdbasa9hclfg6Bd2axaxNa8PJbbjZamclGEgUaUN:vh9cJbbbbhcdnadak9nmbdnaSci6mba8Lclth9kaDcwfh0Jbbbbh83JbbbbhcinasclfabadalaAz:cjjjbabhzcbh8Ecbh8Finaba8FcdtfhHcbheindnaAazaefydbgQcdtgEfydbgYaAaHaec;q1jjbfydbcdtfydbgXcdtgwfydbg8ASmbaCaXfRbbgLcv2aCaQfRbbgKfc;G1jjbfRbbg5aKcv2aLfg8Nc;G1jjbfRbbg8MVcFeGTmbdna8AaY9nmba8Nc:G1jjbfRbbcFeGmekaKcufhYdnaKaL9hmbaYcFeGce0mba8JaEfydbaX9hmekdndnaKclSmbaLcl9hmekdnaYcFeGce0mba8JaEfydbaX9hmdkaLcufcFeGce0mba8KawfydbaQ9hmekaDa8Ecx2fgKaXaQa8McFeGgYEBdlaKaQaXaYEBdbaKaYa5Gcb9hBdwa8Ecefh8Ekaeclfgecx9hmbkdna8Fcifg8Fad9pmbazcxfhza8EcifaS9nmekka8ETmdcbhLinaqaAaDaLcx2fgKydbgYcdtgzfydbc8S2fgeIdwa3aKydlg8Acx2fgXIdwg8WNaeIdzaXIdbg8UNaeIdaMgRaRMMa8WNaeIdlaXIdlgINaeIdCa8WNaeId3MgRaRMMaINaeIdba8UNaeIdxaINaeIdKMgRaRMMa8UNaeId8KMMM:lhRJbbbbJbbjZaeIdyg8R:va8RJbbbb9BEh8RdndnaKydwgEmbJFFuuh8YxekJbbbbJbbjZaqaAa8Acdtfydbc8S2fgeIdyg8S:va8SJbbbb9BEaeIdwa3aYcx2fgXIdwg8SNaeIdzaXIdbg8XNaeIdaMg8Ya8YMMa8SNaeIdlaXIdlg8YNaeIdCa8SNaeId3Mg8Sa8SMMa8YNaeIdba8XNaeIdxa8YNaeIdKMg8Sa8SMMa8XNaeId8KMMM:lNh8Yka8RaRNh80dna8LTmbavaYc8S2fgQIdwa8WNaQIdza8UNaQIdaMgRaRMMa8WNaQIdlaINaQIdCa8WNaQId3MgRaRMMaINaQIdba8UNaQIdxaINaQIdKMgRaRMMa8UNaQId8KMMMhRaga8Aa8L2gHcdtfhXaiaYa8L2gwcltfheaQIdyh8Sa8LhQinaXIdbg8Ra8Ra8SNaecxfIdba8WaecwfIdbNa8UaeIdbNaIaeclfIdbNMMMg8Ra8RM:tNaRMhRaXclfhXaeczfheaQcufgQmbkdndnaEmbJbbbbh8Rxekava8Ac8S2fgQIdwa3aYcx2fgeIdwg8UNaQIdzaeIdbgINaQIdaMg8Ra8RMMa8UNaQIdlaeIdlg8SNaQIdCa8UNaQId3Mg8Ra8RMMa8SNaQIdbaINaQIdxa8SNaQIdKMg8Ra8RMMaINaQId8KMMMh8RagawcdtfhXaiaHcltfheaQIdyh8Xa8LhQinaXIdbg8Wa8Wa8XNaecxfIdba8UaecwfIdbNaIaeIdbNa8SaeclfIdbNMMMg8Wa8WM:tNa8RMh8RaXclfhXaeczfheaQcufgQmbka8R:lh8Rka80aR:lMh80a8Ya8RMh8YaCaYfRbbcd9hmbdna8Ka8Ja8Jazfydba8ASEaaazfydbgHcdtfydbgzcu9hmbaaa8AcdtfydbhzkavaHc8S2fgQIdwa3azcx2fgeIdwg8WNaQIdzaeIdbg8UNaQIdaMgRaRMMa8WNaQIdlaeIdlgINaQIdCa8WNaQId3MgRaRMMaINaQIdba8UNaQIdxaINaQIdKMgRaRMMa8UNaQId8KMMMhRagaza8L2gwcdtfhXaiaHa8L2g8NcltfheaQIdyh8Sa8LhQinaXIdbg8Ra8Ra8SNaecxfIdba8WaecwfIdbNa8UaeIdbNaIaeclfIdbNMMMg8Ra8RM:tNaRMhRaXclfhXaeczfheaQcufgQmbkdndnaEmbJbbbbh8Rxekavazc8S2fgQIdwa3aHcx2fgeIdwg8UNaQIdzaeIdbgINaQIdaMg8Ra8RMMa8UNaQIdlaeIdlg8SNaQIdCa8UNaQId3Mg8Ra8RMMa8SNaQIdbaINaQIdxa8SNaQIdKMg8Ra8RMMaINaQId8KMMMh8Raga8NcdtfhXaiawcltfheaQIdyh8Xa8LhQinaXIdbg8Wa8Wa8XNaecxfIdba8UaecwfIdbNaIaeIdbNa8SaeclfIdbNMMMg8Wa8WM:tNa8RMh8RaXclfhXaeczfheaQcufgQmbka8R:lh8Rka80aR:lMh80a8Ya8RMh8YkaKa80a8Ya80a8Y9FgeEUdwaKa8AaYaeaETVgeEBdlaKaYa8AaeEBdbaLcefgLa8E9hmbkasc;Wbfcbcj;qbz:ojjjb8Aa0hea8EhXinasc;WbfaeydbcA4cF8FGgQcFAaQcFA6EcdtfgQaQydbcefBdbaecxfheaXcufgXmbkcbhecbhXinasc;WbfaefgQydbhKaQaXBdbaKaXfhXaeclfgecj;qb9hmbkcbhea0hXinasc;WbfaXydbcA4cF8FGgQcFAaQcFA6EcdtfgQaQydbgQcefBdbaraQcdtfaeBdbaXcxfhXa8Eaecefge9hmbkadak9RgQci9Uh9mdnalTmbcbheayhXinaXaeBdbaXclfhXalaecefge9hmbkkcbh9na9icbalz:ojjjbh8FaQcO9Uh9oa9mce4h9pasydwh9qcbh8Mcbh5dninaDara5cdtfydbcx2fg8NIdwgRa9c9Emea8Ma9m9pmeJFFuuh8Rdna9pa8E9pmbaDara9pcdtfydbcx2fIdwJbb;aZNh8RkdnaRa8R9ETmbaRac9ETmba8Ma9o0mdkdna8FaAa8NydlgHcdtg9rfydbgKfg9sRbba8FaAa8Nydbgzcdtg9tfydbgefg9uRbbVmbaCazfRbbh9vdnaTaecdtfgXclfydbgQaXydbgXSmbaQaX9RhYa3aKcx2fhLa3aecx2fhEa9qaXcitfhecbhXcehwdnindnayaeydbcdtfydbgQaKSmbayaeclfydbcdtfydbg8AaKSmbaQa8ASmba3a8Acx2fg8AIdba3aQcx2fgQIdbg8W:tgRaEIdlaQIdlg8U:tg8XNaEIdba8W:tg8Ya8AIdla8U:tg8RN:tgIaRaLIdla8U:tg80NaLIdba8W:tg81a8RN:tg8UNa8RaEIdwaQIdwg8S:tg8ZNa8Xa8AIdwa8S:tg8WN:tg8Xa8RaLIdwa8S:tgBNa80a8WN:tg8RNa8Wa8YNa8ZaRN:tg8Sa8Wa81NaBaRN:tgRNMMaIaINa8Xa8XNa8Sa8SNMMa8Ua8UNa8Ra8RNaRaRNMMN:rJbbj8:N9FmdkaecwfheaXcefgXaY6hwaYaX9hmbkkawceGTmba9pcefh9pxekdndndndna9vc9:fPdebdkazheinayaecdtgefaHBdbaaaefydbgeaz9hmbxikkdna8Ka8Ja8Ja9tfydbaHSEaaa9tfydbgzcdtfydbgecu9hmbaaa9rfydbhekaya9tfaHBdbaehHkayazcdtfaHBdbka9uce86bba9sce86bba8NIdwgRacacaR9DEhca9ncefh9ncecda9vceSEa8Mfh8Mka5cefg5a8E9hmbkka9nTmddnalTmbcbh8AcbhEindnayaEcdtgefydbgQaESmbaAaQcdtfydbhzdnaEaAaefydb9hgHmbaqazc8S2fgeaqaEc8S2fgXIdbaeIdbMUdbaeaXIdlaeIdlMUdlaeaXIdwaeIdwMUdwaeaXIdxaeIdxMUdxaeaXIdzaeIdzMUdzaeaXIdCaeIdCMUdCaeaXIdKaeIdKMUdKaeaXId3aeId3MUd3aeaXIdaaeIdaMUdaaeaXId8KaeId8KMUd8KaeaXIdyaeIdyMUdyka8LTmbavaQc8S2fgeavaEc8S2gwfgXIdbaeIdbMUdbaeaXIdlaeIdlMUdlaeaXIdwaeIdwMUdwaeaXIdxaeIdxMUdxaeaXIdzaeIdzMUdzaeaXIdCaeIdCMUdCaeaXIdKaeIdKMUdKaeaXId3aeId3MUd3aeaXIdaaeIdaMUdaaeaXId8KaeId8KMUd8KaeaXIdyaeIdyMUdya9kaQ2hLaihXa8LhKinaXaLfgeaXa8AfgQIdbaeIdbMUdbaeclfgYaQclfIdbaYIdbMUdbaecwfgYaQcwfIdbaYIdbMUdbaecxfgeaQcxfIdbaeIdbMUdbaXczfhXaKcufgKmbkaHmbJbbbbJbbjZaqawfgeIdygR:vaRJbbbb9BEaeIdwa3azcx2fgXIdwgRNaeIdzaXIdbg8RNaeIdaMg8Wa8WMMaRNaeIdlaXIdlg8WNaeIdCaRNaeId3MgRaRMMa8WNaeIdba8RNaeIdxa8WNaeIdKMgRaRMMa8RNaeId8KMMM:lNgRa83a83aR9DEh83ka8Aa9kfh8AaEcefgEal9hmbkcbhXa8JheindnaeydbgQcuSmbdnaXayaQcdtgKfydbgQ9hmbcuhQa8JaKfydbgKcuSmbayaKcdtfydbhQkaeaQBdbkaeclfhealaXcefgX9hmbkcbhXa8KheindnaeydbgQcuSmbdnaXayaQcdtgKfydbgQ9hmbcuhQa8KaKfydbgKcuSmbayaKcdtfydbhQkaeaQBdbkaeclfhealaXcefgX9hmbkka83aca8LEh83cbhKabhecbhYindnayaeydbcdtfydbgXayaeclfydbcdtfydbgQSmbaXayaecwfydbcdtfydbg8ASmbaQa8ASmbabaKcdtfgLaXBdbaLcwfa8ABdbaLclfaQBdbaKcifhKkaecxfheaYcifgYad6mbkdndnaJTmbaKak9nmba8Va839FTmbcbhdabhecbhXindnaoahaeydbgQcdtfydbcdtfIdba839ETmbabadcdtfgYaQBdbaYclfaeclfydbBdbaYcwfaecwfydbBdbadcifhdkaecxfheaXcifgXaK6mbkJFFuuh8Va9eTmeaohea9ehXJFFuuhRinaeIdbg8RaRaRa8R9EEg8WaRa8Ra839EgQEhRa8Wa8VaQEh8VaeclfheaXcufgXmbxdkkaKhdkadak0mbxdkkasclfabadalaAz:cjjjbkdndnadak0mbadhXxekdnaJmbadhXxekdna8Va9c9FmbadhXxekina8VJbb;aZNgRa9caRa9c9DEh8WJbbbbhRdna9eTmbaohea9ehAinaeIdbg8RaRa8Ra8W9FEaRa8RaR9EEhRaeclfheaAcufgAmbkkcbhXabhecbhAindnaoahaeydbgQcdtfydbcdtfIdba8W9ETmbabaXcdtfgKaQBdbaKclfaeclfydbBdbaKcwfaecwfydbBdbaXcifhXkaecxfheaAcifgAad6mbkJFFuuh8Vdna9eTmbaohea9ehAJFFuuh8RinaeIdbg8Ua8Ra8Ra8U9EEgIa8Ra8Ua8W9EgQEh8RaIa8VaQEh8VaeclfheaAcufgAmbkkdnaXad9hmbadhXxdkaRacacaR9DEhcaXak9nmeaXhda8Va9c9FmbkkdnamcjjjjlGTmbaOmbaXTmbcbh8AabheinaCaeydbgKfRbbc3thLaecwfgEydbhAdndna8JaKcdtgHfydbaeclfgzydbgQSmbcbhYa8KaQcdtfydbaK9hmekcjjjj94hYkaeaLaYVaKVBdbaCaQfRbbc3thLdndna8JaQcdtfydbaASmbcbhYa8KaAcdtfydbaQ9hmekcjjjj94hYkazaLaYVaQVBdbaCaAfRbbc3thYdndna8JaAcdtfydbaKSmbcbhQa8KaHfydbaA9hmekcjjjj94hQkaEaYaQVaAVBdbaecxfhea8Acifg8AaX6mbkkdnaOTmbaXTmbaXheinabaOabydbcdtfydbBdbabclfhbaecufgembkkdnaPTmbaPaUac:rNUdbka9hcdtascxffcxfhednina6Tmeaeydbcbyd1:jjjbH:bjjjbbaec98fhea6cufh6xbkkasc;W;qbf8KjjjjbaXk;Yieouabydlhvabydbclfcbaicdtz:ojjjbhoadci9UhrdnadTmbdnalTmbaehwadhDinaoalawydbcdtfydbcdtfgqaqydbcefBdbawclfhwaDcufgDmbxdkkaehwadhDinaoawydbcdtfgqaqydbcefBdbawclfhwaDcufgDmbkkdnaiTmbcbhDaohwinawydbhqawaDBdbawclfhwaqaDfhDaicufgimbkkdnadci6mbinaecwfydbhwaeclfydbhDaeydbhidnalTmbalawcdtfydbhwalaDcdtfydbhDalaicdtfydbhikavaoaicdtfgqydbcitfaDBdbavaqydbcitfawBdlaqaqydbcefBdbavaoaDcdtfgqydbcitfawBdbavaqydbcitfaiBdlaqaqydbcefBdbavaoawcdtfgwydbcitfaiBdbavawydbcitfaDBdlawawydbcefBdbaecxfhearcufgrmbkkabydbcbBdbk:todDue99aicd4aifhrcehwinawgDcethwaDar6mbkcuaDcdtgraDcFFFFi0Ecbyd:m:jjjbHjjjjbbhwaoaoyd9GgqcefBd9GaoaqcdtfawBdbawcFearz:ojjjbhkdnaiTmbalcd4hlaDcufhxcbhminamhDdnavTmbavamcdtfydbhDkcbadaDal2cdtfgDydlgwawcjjjj94SEgwcH4aw7c:F:b:DD2cbaDydbgwawcjjjj94SEgwcH4aw7c;D;O:B8J27cbaDydwgDaDcjjjj94SEgDcH4aD7c:3F;N8N27axGhwamcdthPdndndnavTmbakawcdtfgrydbgDcuSmeadavaPfydbal2cdtfgsIdbhzcehqinaqhrdnadavaDcdtfydbal2cdtfgqIdbaz9CmbaqIdlasIdl9CmbaqIdwasIdw9BmlkarcefhqakawarfaxGgwcdtfgrydbgDcu9hmbxdkkakawcdtfgrydbgDcuSmbadamal2cdtfgsIdbhzcehqinaqhrdnadaDal2cdtfgqIdbaz9CmbaqIdlasIdl9CmbaqIdwasIdw9BmikarcefhqakawarfaxGgwcdtfgrydbgDcu9hmbkkaramBdbamhDkabaPfaDBdbamcefgmai9hmbkkakcbyd1:jjjbH:bjjjbbaoaoyd9GcufBd9GdnaeTmbaiTmbcbhDaehwinawaDBdbawclfhwaiaDcefgD9hmbkcbhDaehwindnaDabydbgrSmbawaearcdtfgrydbBdbaraDBdbkawclfhwabclfhbaiaDcefgD9hmbkkk;Qodvuv998Jjjjjbca9Rgvczfcwfcbyd11jjbBdbavcb8Pdj1jjb83izavcwfcbydN1jjbBdbavcb8Pd:m1jjb83ibdnadTmbaicd4hodnabmbdnalTmbcbhrinaealarcdtfydbao2cdtfhwcbhiinavczfaifgDawaifIdbgqaDIdbgkakaq9EEUdbavaifgDaqaDIdbgkakaq9DEUdbaiclfgicx9hmbkarcefgrad9hmbxikkaocdthrcbhwincbhiinavczfaifgDaeaifIdbgqaDIdbgkakaq9EEUdbavaifgDaqaDIdbgkakaq9DEUdbaiclfgicx9hmbkaearfheawcefgwad9hmbxdkkdnalTmbcbhrinabarcx2fgiaealarcdtfydbao2cdtfgwIdbUdbaiawIdlUdlaiawIdwUdwcbhiinavczfaifgDawaifIdbgqaDIdbgkakaq9EEUdbavaifgDaqaDIdbgkakaq9DEUdbaiclfgicx9hmbkarcefgrad9hmbxdkkaocdthlcbhraehwinabarcx2fgiaearao2cdtfgDIdbUdbaiaDIdlUdlaiaDIdwUdwcbhiinavczfaifgDawaifIdbgqaDIdbgkakaq9EEUdbavaifgDaqaDIdbgkakaq9DEUdbaiclfgicx9hmbkawalfhwarcefgrad9hmbkkJbbbbavIdbavIdzgk:tgqaqJbbbb9DEgqavIdlavIdCgx:tgmamaq9DEgqavIdwavIdKgm:tgPaPaq9DEhPdnabTmbadTmbJbbbbJbbjZaP:vaPJbbbb9BEhqinabaqabIdbak:tNUdbabclfgvaqavIdbax:tNUdbabcwfgvaqavIdbam:tNUdbabcxfhbadcufgdmbkkaPk:ZlewudnaeTmbcbhvabhoinaoavBdbaoclfhoaeavcefgv9hmbkkdnaiTmbcbhrinadarcdtfhwcbhDinalawaDcdtgvc;a1jjbfydbcdtfydbcdtfydbhodnabalawavfydbcdtfydbgqcdtfgkydbgvaqSmbinakabavgqcdtfgxydbgvBdbaxhkaqav9hmbkkdnabaocdtfgkydbgvaoSmbinakabavgocdtfgxydbgvBdbaxhkaoav9hmbkkdnaqaoSmbabaqaoaqao0Ecdtfaqaoaqao6EBdbkaDcefgDci9hmbkarcifgrai6mbkkdnaembcbskcbhxindnalaxcdtgvfydbax9hmbaxhodnabavfgDydbgvaxSmbaDhqinaqabavgocdtfgkydbgvBdbakhqaoav9hmbkkaDaoBdbkaxcefgxae9hmbkcbhvabhocbhkindndnavalydbgq9hmbdnavaoydbgq9hmbaoakBdbakcefhkxdkaoabaqcdtfydbBdbxekaoabaqcdtfydbBdbkaoclfhoalclfhlaeavcefgv9hmbkakk;Jiilud99duabcbaecltz:ojjjbhvdnalTmbadhoaihralhwinarcwfIdbhDarclfIdbhqavaoydbcltfgkarIdbakIdbMUdbakclfgxaqaxIdbMUdbakcwfgxaDaxIdbMUdbakcxfgkakIdbJbbjZMUdbaoclfhoarcxfhrawcufgwmbkkdnaeTmbavhraehkinarcxfgoIdbhDaocbBdbararIdbJbbbbJbbjZaD:vaDJbbbb9BEgDNUdbarclfgoaDaoIdbNUdbarcwfgoaDaoIdbNUdbarczfhrakcufgkmbkkdnalTmbinavadydbcltfgrcxfgkaicwfIdbarcwfIdb:tgDaDNaiIdbarIdb:tgDaDNaiclfIdbarclfIdb:tgDaDNMMgDakIdbgqaqaD9DEUdbadclfhdaicxfhialcufglmbkkdnaeTmbavcxfhrinabarIdbUdbarczfhrabclfhbaecufgembkkk8MbabaeadaialavcbcbcbcbcbaoarawaDz:bjjjbk8MbabaeadaialavaoarawaDaqakaxamaPz:bjjjbk:DCoDud99rue99iul998Jjjjjbc;Wb9Rgw8KjjjjbdndnarmbcbhDxekawcxfcbc;Kbz:ojjjb8Aawcuadcx2adc;v:Q;v:Qe0Ecbyd:m:jjjbHjjjjbbgqBdxawceBd2aqaeadaicbz:ejjjb8AawcuadcdtadcFFFFi0Egkcbyd:m:jjjbHjjjjbbgxBdzawcdBd2adcd4adfhmceheinaegicetheaiam6mbkcbhPawcuaicdtgsaicFFFFi0Ecbyd:m:jjjbHjjjjbbgzBdCawciBd2dndnar:ZgH:rJbbbZMgO:lJbbb9p9DTmbaO:Ohexekcjjjj94hekaicufhAc:bwhmcbhCadhXcbhQinaChLaeamgKcufaeaK9iEaPgDcefaeaD9kEhYdndnadTmbaYcuf:YhOaqhiaxheadhmindndnaiIdbaONJbbbZMg8A:lJbbb9p9DTmba8A:OhCxekcjjjj94hCkaCcCthCdndnaiclfIdbaONJbbbZMg8A:lJbbb9p9DTmba8A:OhExekcjjjj94hEkaEcqtaCVhCdndnaicwfIdbaONJbbbZMg8A:lJbbb9p9DTmba8A:OhExekcjjjj94hEkaeaCaEVBdbaicxfhiaeclfheamcufgmmbkazcFeasz:ojjjbh3cbh5cbhPindna3axaPcdtfydbgCcm4aC7c:v;t;h;Ev2gics4ai7aAGgmcdtfgEydbgecuSmbaeaCSmbcehiina3amaifaAGgmcdtfgEydbgecuSmeaicefhiaeaC9hmbkkaEaCBdba5aecuSfh5aPcefgPad9hmbxdkkazcFeasz:ojjjb8Acbh5kaDaYa5ar0giEhPaLa5aiEhCdna5arSmbaYaKaiEgmaP9Rcd9imbdndnaQcl0mbdnaX:ZgOaL:Zg8A:taY:Yg8EaD:Y:tg8Fa8EaK:Y:tgaa5:ZghaH:tNNNaOaH:taaNa8Aah:tNa8AaH:ta8FNahaO:tNM:va8EMJbbbZMgO:lJbbb9p9DTmbaO:Ohexdkcjjjj94hexekaPamfcd9Theka5aXaiEhXaQcefgQcs9hmekkdndnaCmbcihicbhDxekcbhiawakcbyd:m:jjjbHjjjjbbg5BdKawclBd2aPcuf:Yh8AdndnadTmbaqhiaxheadhmindndnaiIdba8ANJbbbZMgO:lJbbb9p9DTmbaO:OhCxekcjjjj94hCkaCcCthCdndnaiclfIdba8ANJbbbZMgO:lJbbb9p9DTmbaO:OhExekcjjjj94hEkaEcqtaCVhCdndnaicwfIdba8ANJbbbZMgO:lJbbb9p9DTmbaO:OhExekcjjjj94hEkaeaCaEVBdbaicxfhiaeclfheamcufgmmbkazcFeasz:ojjjbh3cbhDcbhYindndndna3axaYcdtgKfydbgCcm4aC7c:v;t;h;Ev2gics4ai7aAGgmcdtfgEydbgecuSmbcehiinaxaecdtgefydbaCSmdamaifheaicefhia3aeaAGgmcdtfgEydbgecu9hmbkkaEaYBdbaDhiaDcefhDxeka5aefydbhika5aKfaiBdbaYcefgYad9hmbkcuaDc32giaDc;j:KM;jb0EhexekazcFeasz:ojjjb8AcbhDcbhekawaecbyd:m:jjjbHjjjjbbgeBd3awcvBd2aecbaiz:ojjjbhEavcd4hKdnadTmbdnalTmbaKcdth3a5hCaqhealhmadhAinaEaCydbc32fgiaeIdbaiIdbMUdbaiaeclfIdbaiIdlMUdlaiaecwfIdbaiIdwMUdwaiamIdbaiIdxMUdxaiamclfIdbaiIdzMUdzaiamcwfIdbaiIdCMUdCaiaiIdKJbbjZMUdKaCclfhCaecxfheama3fhmaAcufgAmbxdkka5hmaqheadhCinaEamydbc32fgiaeIdbaiIdbMUdbaiaeclfIdbaiIdlMUdlaiaecwfIdbaiIdwMUdwaiaiIdxJbbbbMUdxaiaiIdzJbbbbMUdzaiaiIdCJbbbbMUdCaiaiIdKJbbjZMUdKamclfhmaecxfheaCcufgCmbkkdnaDTmbaEhiaDheinaiaiIdbJbbbbJbbjZaicKfIdbgO:vaOJbbbb9BEgONUdbaiclfgmaOamIdbNUdbaicwfgmaOamIdbNUdbaicxfgmaOamIdbNUdbaiczfgmaOamIdbNUdbaicCfgmaOamIdbNUdbaic3fhiaecufgembkkcbhCawcuaDcdtgYaDcFFFFi0Egicbyd:m:jjjbHjjjjbbgeBdaawcoBd2awaicbyd:m:jjjbHjjjjbbg3Bd8KaecFeaYz:ojjjbhxdnadTmbJbbjZJbbjZa8A:vaPceSEaoNgOaONh8AaKcdthPalheina8Aaec;81jjbalEgmIdwaEa5ydbgAc32fgiIdC:tgOaONamIdbaiIdx:tgOaONamIdlaiIdz:tgOaONMMNaqcwfIdbaiIdw:tgOaONaqIdbaiIdb:tgOaONaqclfIdbaiIdl:tgOaONMMMhOdndnaxaAcdtgifgmydbcuSmba3aifIdbaO9ETmekamaCBdba3aifaOUdbka5clfh5aqcxfhqaeaPfheadaCcefgC9hmbkkabaxaYz:njjjb8AcrhikaicdthiinaiTmeaic98fgiawcxffydbcbyd1:jjjbH:bjjjbbxbkkawc;Wbf8KjjjjbaDk:Ydidui99ducbhi8Jjjjjbca9Rglczfcwfcbyd11jjbBdbalcb8Pdj1jjb83izalcwfcbydN1jjbBdbalcb8Pd:m1jjb83ibdndnaembJbbjFhvJbbjFhoJbbjFhrxekadcd4cdthwincbhdinalczfadfgDabadfIdbgvaDIdbgoaoav9EEUdbaladfgDavaDIdbgoaoav9DEUdbadclfgdcx9hmbkabawfhbaicefgiae9hmbkalIdwalIdK:thralIdlalIdC:thoalIdbalIdz:thvkJbbbbavavJbbbb9DEgvaoaoav9DEgvararav9DEk9DeeuabcFeaicdtz:ojjjbhlcbhbdnadTmbindnalaeydbcdtfgiydbcu9hmbaiabBdbabcefhbkaeclfheadcufgdmbkkabk9teiucbcbyd:q:jjjbgeabcifc98GfgbBd:q:jjjbdndnabZbcztgd9nmbcuhiabad9RcFFifcz4nbcuSmekaehikaik;teeeudndnaeabVciGTmbabhixekdndnadcz9pmbabhixekabhiinaiaeydbBdbaiaeydlBdlaiaeydwBdwaiaeydxBdxaeczfheaiczfhiadc9Wfgdcs0mbkkadcl6mbinaiaeydbBdbaeclfheaiclfhiadc98fgdci0mbkkdnadTmbinaiaeRbb86bbaicefhiaecefheadcufgdmbkkabk:3eedudndnabciGTmbabhixekaecFeGc:b:c:ew2hldndnadcz9pmbabhixekabhiinaialBdxaialBdwaialBdlaialBdbaiczfhiadc9Wfgdcs0mbkkadcl6mbinaialBdbaiclfhiadc98fgdci0mbkkdnadTmbinaiae86bbaicefhiadcufgdmbkkabk9teiucbcbyd:q:jjjbgeabcrfc94GfgbBd:q:jjjbdndnabZbcztgd9nmbcuhiabad9RcFFifcz4nbcuSmekaehikaik9:eiuZbhedndncbyd:q:jjjbgdaecztgi9nmbcuheadai9RcFFifcz4nbcuSmekadhekcbabae9Rcifc98Gcbyd:q:jjjbfgdBd:q:jjjbdnadZbcztge9nmbadae9RcFFifcz4nb8Akkk:Iedbcjwk1eFFuuFFuuFFuuFFuFFFuFFFuFbbbbbbbbeeebeebebbeeebebbbbbebebbbbbbbbbebbbdbbbbbbbebbbebbbdbbbbbbbbbbbeeeeebebbebbebebbbeebbbbbbbbbbbbbbbbbbbbbc1Dkxebbbdbbb:GNbb",e=new Uint8Array([32,0,65,2,1,106,34,33,3,128,11,4,13,64,6,253,10,7,15,116,127,5,8,12,40,16,19,54,20,9,27,255,113,17,42,67,24,23,146,148,18,14,22,45,70,69,56,114,101,21,25,63,75,136,108,28,118,29,73,115]);if(typeof WebAssembly!="object")return{supported:!1};var a,s=WebAssembly.instantiate(r(t),{}).then(function(h){a=h.instance,a.exports.__wasm_call_ctors()});function r(h){for(var d=new Uint8Array(h.length),m=0;m<h.length;++m){var b=h.charCodeAt(m);d[m]=b>96?b-97:b>64?b-39:b+4}for(var y=0,m=0;m<h.length;++m)d[y++]=d[m]<60?e[d[m]]:(d[m]-60)*64+d[++m];return d.buffer.slice(0,y)}function n(h){if(!h)throw new Error("Assertion failed")}function i(h){return new Uint8Array(h.buffer,h.byteOffset,h.byteLength)}function o(h,d,m){var b=a.exports.sbrk,y=b(d.length*4),x=b(m*4),w=new Uint8Array(a.exports.memory.buffer),E=i(d);w.set(E,y);var T=h(x,y,d.length,m);w=new Uint8Array(a.exports.memory.buffer);var _=new Uint32Array(m);new Uint8Array(_.buffer).set(w.subarray(x,x+m*4)),E.set(w.subarray(y,y+d.length*4)),b(y-b(0));for(var S=0;S<d.length;++S)d[S]=_[d[S]];return[_,T]}function c(h){for(var d=0,m=0;m<h.length;++m){var b=h[m];d=d<b?b:d}return d}function l(h,d,m,b,y,x,w,E,T){var _=a.exports.sbrk,S=_(4),N=_(m*4),R=_(y*x),I=_(m*4),C=new Uint8Array(a.exports.memory.buffer);C.set(i(b),R),C.set(i(d),I);var A=h(N,I,m,R,y,x,w,E,T,S);C=new Uint8Array(a.exports.memory.buffer);var P=new Uint32Array(A);i(P).set(C.subarray(N,N+A*4));var K=new Float32Array(1);return i(K).set(C.subarray(S,S+4)),_(S-_(0)),[P,K[0]]}function f(h,d,m,b,y,x,w,E,T,_,S,N,R){var I=a.exports.sbrk,C=I(4),A=I(m*4),P=I(y*x),K=I(y*E),W=I(T.length*4),Q=I(m*4),pe=_?I(y):0,se=new Uint8Array(a.exports.memory.buffer);se.set(i(b),P),se.set(i(w),K),se.set(i(T),W),se.set(i(d),Q),_&&se.set(i(_),pe);var be=h(A,Q,m,P,y,x,K,E,W,T.length,pe,S,N,R,C);se=new Uint8Array(a.exports.memory.buffer);var Ee=new Uint32Array(be);i(Ee).set(se.subarray(A,A+be*4));var ue=new Float32Array(1);return i(ue).set(se.subarray(C,C+4)),I(C-I(0)),[Ee,ue[0]]}function u(h,d,m,b){var y=a.exports.sbrk,x=y(m*b),w=new Uint8Array(a.exports.memory.buffer);w.set(i(d),x);var E=h(x,m,b);return y(x-y(0)),E}function g(h,d,m,b,y,x,w,E){var T=a.exports.sbrk,_=T(E*4),S=T(m*b),N=T(m*x),R=new Uint8Array(a.exports.memory.buffer);R.set(i(d),S),y&&R.set(i(y),N);var I=h(_,S,m,b,N,x,w,E);R=new Uint8Array(a.exports.memory.buffer);var C=new Uint32Array(I);return i(C).set(R.subarray(_,_+I*4)),T(_-T(0)),C}var p={LockBorder:1,Sparse:2,ErrorAbsolute:4,Prune:8,_InternalDebug:1<<30};return{ready:s,supported:!0,compactMesh:function(h){n(h instanceof Uint32Array||h instanceof Int32Array||h instanceof Uint16Array||h instanceof Int16Array),n(h.length%3==0);var d=h.BYTES_PER_ELEMENT==4?h:new Uint32Array(h);return o(a.exports.meshopt_optimizeVertexFetchRemap,d,c(h)+1)},simplify:function(h,d,m,b,y,x){n(h instanceof Uint32Array||h instanceof Int32Array||h instanceof Uint16Array||h instanceof Int16Array),n(h.length%3==0),n(d instanceof Float32Array),n(d.length%m==0),n(m>=3),n(b>=0&&b<=h.length),n(b%3==0),n(y>=0);for(var w=0,E=0;E<(x?x.length:0);++E)n(x[E]in p),w|=p[x[E]];var T=h.BYTES_PER_ELEMENT==4?h:new Uint32Array(h),_=l(a.exports.meshopt_simplify,T,h.length,d,d.length/m,m*4,b,y,w);return _[0]=h instanceof Uint32Array?_[0]:new h.constructor(_[0]),_},simplifyWithAttributes:function(h,d,m,b,y,x,w,E,T,_){n(h instanceof Uint32Array||h instanceof Int32Array||h instanceof Uint16Array||h instanceof Int16Array),n(h.length%3==0),n(d instanceof Float32Array),n(d.length%m==0),n(m>=3),n(b instanceof Float32Array),n(b.length%y==0),n(y>=0),n(w==null||w instanceof Uint8Array),n(w==null||w.length==d.length/m),n(E>=0&&E<=h.length),n(E%3==0),n(T>=0),n(Array.isArray(x)),n(y>=x.length),n(x.length<=32);for(var S=0;S<x.length;++S)n(x[S]>=0);for(var N=0,S=0;S<(_?_.length:0);++S)n(_[S]in p),N|=p[_[S]];var R=h.BYTES_PER_ELEMENT==4?h:new Uint32Array(h),I=f(a.exports.meshopt_simplifyWithAttributes,R,h.length,d,d.length/m,m*4,b,y*4,new Float32Array(x),w?new Uint8Array(w):null,E,T,N);return I[0]=h instanceof Uint32Array?I[0]:new h.constructor(I[0]),I},getScale:function(h,d){return n(h instanceof Float32Array),n(h.length%d==0),n(d>=3),u(a.exports.meshopt_simplifyScale,h,h.length/d,d*4)},simplifyPoints:function(h,d,m,b,y,x){return n(h instanceof Float32Array),n(h.length%d==0),n(d>=3),n(m>=0&&m<=h.length/d),b?(n(b instanceof Float32Array),n(b.length%y==0),n(y>=3),n(h.length/d==b.length/y),g(a.exports.meshopt_simplifyPoints,h,h.length/d,d*4,b,y*4,x,m)):g(a.exports.meshopt_simplifyPoints,h,h.length/d,d*4,void 0,0,0,m)}}})();var f1=(function(){var t="b9H79TebbbeVx9Geueu9Geub9Gbb9Giuuueu9Gmuuuuuuuuuuu9999eu9Gvuuuuueu9Gwuuuuuuuub9Gxuuuuuuuuuuuueu9Gkuuuuuuuuuu99eu9Gouuuuuub9Gruuuuuuub9GluuuubiOHdilvorwDqqkbiibeilve9Weiiviebeoweuec;G:Odkr:Yewo9TW9T9VV95dbH9F9F939H79T9F9J9H229F9Jt9VV7bb8A9TW79O9V9Wt9F9I919P29K9nW79O2Wt79c9V919U9KbeX9TW79O9V9Wt9F9I919P29K9nW79O2Wt7bo39TW79O9V9Wt9F9J9V9T9W91tWJ2917tWV9c9V919U9K7br39TW79O9V9Wt9F9J9V9T9W91tW9nW79O2Wt9c9V919U9K7bDL9TW79O9V9Wt9F9V9Wt9P9T9P96W9nW79O2Wtbql79IV9RbkDwebcekdsPq;Q9BHdbkIbabaec9:fgefcufae9Ugeabci9Uadfcufad9Ugbaeab0Ek:w8KDPue99eux99dui99euo99iu8Jjjjjbc:WD9Rgm8KjjjjbdndnalmbcbhPxekamc:Cwfcbc;Kbz:njjjb8Adndnalcb9imbaoal9nmbamcuaocdtaocFFFFi0Egscbyd;y1jjbHjjjjbbgzBd:CwamceBd;8wamascbyd;y1jjbHjjjjbbgHBd:GwamcdBd;8wamcualcdtalcFFFFi0Ecbyd;y1jjbHjjjjbbgOBd:KwamciBd;8waihsalhAinazasydbcdtfcbBdbasclfhsaAcufgAmbkaihsalhAinazasydbcdtfgCaCydbcefBdbasclfhsaAcufgAmbkaihsalhCcbhXindnazasydbcdtgQfgAydbcb9imbaHaQfaXBdbaAaAydbgQcjjjj94VBdbaQaXfhXkasclfhsaCcufgCmbkalci9UhLdnalci6mbcbhsaihAinaAcwfydbhCaAclfydbhXaHaAydbcdtfgQaQydbgQcefBdbaOaQcdtfasBdbaHaXcdtfgXaXydbgXcefBdbaOaXcdtfasBdbaHaCcdtfgCaCydbgCcefBdbaOaCcdtfasBdbaAcxfhAaLascefgs9hmbkkaihsalhAindnazasydbcdtgCfgXydbgQcu9kmbaXaQcFFFFrGgQBdbaHaCfgCaCydbaQ9RBdbkasclfhsaAcufgAmbxdkkamcuaocdtgsaocFFFFi0EgAcbyd;y1jjbHjjjjbbgzBd:CwamceBd;8wamaAcbyd;y1jjbHjjjjbbgHBd:GwamcdBd;8wamcualcdtalcFFFFi0Ecbyd;y1jjbHjjjjbbgOBd:KwamciBd;8wazcbasz:njjjbhXalci9UhLaihsalhAinaXasydbcdtfgCaCydbcefBdbasclfhsaAcufgAmbkdnaoTmbcbhsaHhAaXhCaohQinaAasBdbaAclfhAaCydbasfhsaCclfhCaQcufgQmbkkdnalci6mbcbhsaihAinaAcwfydbhCaAclfydbhQaHaAydbcdtfgKaKydbgKcefBdbaOaKcdtfasBdbaHaQcdtfgQaQydbgQcefBdbaOaQcdtfasBdbaHaCcdtfgCaCydbgCcefBdbaOaCcdtfasBdbaAcxfhAaLascefgs9hmbkkaoTmbcbhsaohAinaHasfgCaCydbaXasfydb9RBdbasclfhsaAcufgAmbkkamaLcbyd;y1jjbHjjjjbbgsBd:OwamclBd;8wascbaLz:njjjbhYamcuaLcK2alcjjjjd0Ecbyd;y1jjbHjjjjbbg8ABd:SwamcvBd;8wJbbbbhEdnalci6g3mbarcd4hKaihAa8AhsaLhrJbbbbh5inavaAclfydbaK2cdtfgCIdlh8EavaAydbaK2cdtfgXIdlhEavaAcwfydbaK2cdtfgQIdlh8FaCIdwhaaXIdwhhaQIdwhgasaCIdbg8JaXIdbg8KMaQIdbg8LMJbbnn:vUdbasclfaXIdlaCIdlMaQIdlMJbbnn:vUdbaQIdwh8MaCIdwh8NaXIdwhyascxfa8EaE:tg8Eagah:tggNa8FaE:tg8Faaah:tgaN:tgEJbbbbJbbjZa8Ja8K:tg8Ja8FNa8La8K:tg8Ka8EN:tghahNaEaENaaa8KNaga8JN:tgEaENMM:rg8K:va8KJbbbb9BEg8ENUdbasczfaEa8ENUdbascCfaha8ENUdbascwfa8Maya8NMMJbbnn:vUdba5a8KMh5aAcxfhAascKfhsarcufgrmbka5aL:Z:vJbbbZNhEkamcuaLcdtalcFFFF970Ecbyd;y1jjbHjjjjbbgCBd:WwamcoBd;8waEaq:ZNhEdna3mbcbhsaChAinaAasBdbaAclfhAaLascefgs9hmbkkaE:rhhcuh8PamcuaLcltalcFFFFd0Ecbyd;y1jjbHjjjjbbgIBd:0wamcrBd;8wcbaIa8AaCaLz:djjjb8AJFFuuhyJFFuuh8RJFFuuh8Sdnalci6gXmbJFFuuh8Sa8AhsaLhAJFFuuh8RJFFuuhyinascwfIdbgEayayaE9EEhyasclfIdbgEa8Ra8RaE9EEh8RasIdbgEa8Sa8SaE9EEh8SascKfhsaAcufgAmbkkahJbbbZNhgamaocetgscuaocu9kEcbyd;y1jjbHjjjjbbgABd:4waAcFeasz:njjjbhCdnaXmbcbhAJFFuuhEa8Ahscuh8PinascwfIdbay:tghahNasIdba8S:tghahNasclfIdba8R:tghahNMM:rghaEa8PcuSahaE9DVgXEhEaAa8PaXEh8PascKfhsaLaAcefgA9hmbkkamczfcbcjwz:njjjb8Aamcwf9cb83ibam9cb83ibagaxNhRJbbjZak:th8Ncbh8UJbbbbh8VJbbbbh8WJbbbbh8XJbbbbh8YJbbbbh8ZJbbbbh80cbh81cbhPinJbbbbhEdna8UTmbJbbjZa8U:Z:vhEkJbbbbhhdna80a80Na8Ya8YNa8Za8ZNMMg8KJbbbb9BmbJbbjZa8K:r:vhhka8XaENh5a8WaENh8Fa8VaENhaa8PhQdndndndndna8UaPVTmbamydwgBTmea80ahNh8Ja8ZahNh8La8YahNh8Maeamydbcdtfh83cbh3JFFuuhEcvhXcuhQindnaza83a3cdtfydbcdtgsfydbgvTmbaOaHasfydbcdtfhAindndnaCaiaAydbgKcx2fgsclfydbgrcetf8Vebcs4aCasydbgLcetf8Vebcs4faCascwfydbglcetf8Vebcs4fgombcbhsxekcehsazaLcdtfydbgLceSmbcehsazarcdtfydbgrceSmbcehsazalcdtfydbglceSmbdnarcdSaLcdSfalcdSfcd6mbaocefhsxekaocdfhskdnasaX9kmba8AaKcK2fgLIdwa5:thhaLIdla8F:th8KaLIdbaa:th8EdndnakJbbbb9DTmba8E:lg8Ea8K:lg8Ka8Ea8K9EEg8Kah:lgha8Kah9EEag:vJbbjZMhhxekahahNa8Ea8ENa8Ka8KNMM:rag:va8NNJbbjZMJ9VO:d86JbbjZaLIdCa8JNaLIdxa8MNa8LaLIdzNMMakN:tghahJ9VO:d869DENhhkaKaQasaX6ahaE9DVgLEhQasaXaLEhXahaEaLEhEkaAclfhAavcufgvmbkka3cefg3aB9hmbkkaQcu9hmekama5Ud:ODama8FUd:KDamaaUd:GDamcuBd:qDamcFFF;7rBdjDaIcba8AaYamc:GDfakJbbbb9Damc:qDfamcjDfz:ejjjbamyd:qDhQdndnaxJbbbb9ETmba8UaD6mbaQcuSmeceh3amIdjDaR9EmixdkaQcu9hmekdna8UTmbdnamydlgza8Uci2fgsciGTmbadasfcba8Uazcu7fciGcefz:njjjb8AkabaPcltfgzam8Pib83dbazcwfamcwf8Pib83dbaPcefhPkc3hzinazc98Smvamc:Cwfazfydbcbyd;u1jjbH:bjjjbbazc98fhzxbkkcbh3a8Uaq9pmbamydwaCaiaQcx2fgsydbcetf8Vebcs4aCascwfydbcetf8Vebcs4faCasclfydbcetf8Vebcs4ffaw9nmekcbhscbhAdna81TmbcbhAamczfhXinamczfaAcdtfaXydbgLBdbaXclfhXaAaYaLfRbbTfhAa81cufg81mbkkamydwhlamydbhXam9cu83i:GDam9cu83i:ODam9cu83i:qDam9cu83i:yDaAc;8eaAclfc:bd6Eh81inamcjDfasfcFFF;7rBdbasclfgscz9hmbka81cdthBdnalTmbaeaXcdtfhocbhrindnazaoarcdtfydbcdtgsfydbgvTmbaOaHasfydbcdtfhAcuhLcuhsinazaiaAydbgKcx2fgXclfydbcdtfydbazaXydbcdtfydbfazaXcwfydbcdtfydbfgXasaXas6gXEhsaKaLaXEhLaAclfhAavcufgvmbkaLcuSmba8AaLcK2fgAIdway:tgEaENaAIdba8S:tgEaENaAIdla8R:tgEaENMM:rhEcbhAindndnasamc:qDfaAfgvydbgX6mbasaX9hmeaEamcjDfaAfIdb9FTmekavasBdbamc:GDfaAfaLBdbamcjDfaAfaEUdbxdkaAclfgAcz9hmbkkarcefgral9hmbkkamczfaBfhLcbhscbhAindnamc:GDfasfydbgXcuSmbaLaAcdtfaXBdbaAcefhAkasclfgscz9hmbkaAa81fg81TmbJFFuuhhcuhKamczfhsa81hvcuhLina8AasydbgXcK2fgAIdway:tgEaENaAIdba8S:tgEaENaAIdla8R:tgEaENMM:rhEdndnazaiaXcx2fgAclfydbcdtfydbazaAydbcdtfydbfazaAcwfydbcdtfydbfgAaL6mbaAaL9hmeaEah9DTmekaEhhaAhLaXhKkasclfhsavcufgvmbkaKcuSmbaKhQkdnamaiaQcx2fgrydbarclfydbarcwfydbaCabaeadaPawaqa3z:fjjjbTmbaPcefhPJbbbbh8VJbbbbh8WJbbbbh8XJbbbbh8YJbbbbh8ZJbbbbh80kcbhXinaOaHaraXcdtfydbcdtgAfydbcdtfgKhsazaAfgvydbgLhAdnaLTmbdninasydbaQSmeasclfhsaAcufgATmdxbkkasaKaLcdtfc98fydbBdbavavydbcufBdbkaXcefgXci9hmbka8AaQcK2fgsIdbhEasIdlhhasIdwh8KasIdxh8EasIdzh5asIdCh8FaYaQfce86bba80a8FMh80a8Za5Mh8Za8Ya8EMh8Ya8Xa8KMh8Xa8WahMh8Wa8VaEMh8Vamydxh8Uxbkkamc:WDf8KjjjjbaPk;Vvivuv99lu8Jjjjjbca9Rgv8Kjjjjbdndnalcw0mbaiydbhoaeabcitfgralcdtcufBdlaraoBdbdnalcd6mbaiclfhoalcufhwarcxfhrinaoydbhDarcuBdbarc98faDBdbarcwfhraoclfhoawcufgwmbkkalabfhrxekcbhDavczfcwfcbBdbav9cb83izavcwfcbBdbav9cb83ibJbbjZhqJbbjZhkinadaiaDcdtfydbcK2fhwcbhrinavczfarfgoawarfIdbgxaoIdbgm:tgPakNamMgmUdbavarfgoaPaxam:tNaoIdbMUdbarclfgrcx9hmbkJbbjZaqJbbjZMgq:vhkaDcefgDal9hmbkcbhoadcbcecdavIdlgxavIdwgm9GEgravIdbgPam9GEaraPax9GEgscdtgrfhzavczfarfIdbhxaihralhwinaiaocdtfgDydbhHaDarydbgOBdbaraHBdbarclfhraoazaOcK2fIdbax9Dfhoawcufgwmbkaeabcitfhrdndnaocv6mbaoalc98f6mekaraiydbBdbaralcdtcufBdlaiclfhoalcufhwarcxfhrinaoydbhDarcuBdbarc98faDBdbarcwfhraoclfhoawcufgwmbkalabfhrxekaraxUdbararydlc98GasVBdlabcefaeadaiaoz:djjjbhwararydlciGawabcu7fcdtVBdlawaeadaiaocdtfalao9Rz:djjjbhrkavcaf8Kjjjjbark:;idiud99dndnabaecitfgwydlgDciGgqciSmbinabcbaDcd4gDalaqcdtfIdbawIdb:tgkJbbbb9FEgwaecefgefadaialavaoarz:ejjjbak:larIdb9FTmdabawaD7aefgecitfgwydlgDciGgqci9hmbkkabaecitfgeclfhbdnavmbcuhwindnaiaeydbgDfRbbmbadaDcK2fgqIdwalIdw:tgkakNaqIdbalIdb:tgkakNaqIdlalIdl:tgkakNMM:rgkarIdb9DTmbarakUdbaoaDBdbkaecwfheawcefgwabydbcd46mbxdkkcuhwindnaiaeydbgDfRbbmbadaDcK2fgqIdbalIdb:t:lgkaqIdlalIdl:t:lgxakax9EEgkaqIdwalIdw:t:lgxakax9EEgkarIdb9DTmbarakUdbaoaDBdbkaecwfheawcefgwabydbcd46mbkkk;llevudnabydwgxaladcetfgm8Vebcs4alaecetfgP8Vebgscs4falaicetfgz8Vebcs4ffaD0abydxaq9pVakVgDce9hmbavawcltfgxab8Pdb83dbaxcwfabcwfgx8Pdb83dbdnaxydbgqTmbaoabydbcdtfhxaqhsinalaxydbcetfcFFi87ebaxclfhxascufgsmbkkdnabydxglci2gsabydlgxfgkciGTmbarakfcbalaxcu7fciGcefz:njjjb8Aabydxci2hsabydlhxabydwhqkab9cb83dwababydbaqfBdbabascifc98GaxfBdlaP8Vebhscbhxkdnascztcz91cu9kmbabaxcefBdwaPax87ebaoabydbcdtfaxcdtfaeBdbkdnam8Uebcu9kmbababydwgxcefBdwamax87ebaoabydbcdtfaxcdtfadBdbkdnaz8Uebcu9kmbababydwgxcefBdwazax87ebaoabydbcdtfaxcdtfaiBdbkarabydlfabydxci2faPRbb86bbarabydlfabydxci2fcefamRbb86bbarabydlfabydxci2fcdfazRbb86bbababydxcefBdxaDk8LbabaeadaialavaoarawaDaDaqJbbbbz:cjjjbk;Nkovud99euv99eul998Jjjjjbc:W;ae9Rgo8KjjjjbdndnadTmbavcd4hrcbhwcbhDindnaiaeclfydbar2cdtfgvIdbaiaeydbar2cdtfgqIdbgk:tgxaiaecwfydbar2cdtfgmIdlaqIdlgP:tgsNamIdbak:tgzavIdlaP:tgPN:tgkakNaPamIdwaqIdwgH:tgONasavIdwaH:tgHN:tgPaPNaHazNaOaxN:tgxaxNMM:rgsJbbbb9Bmbaoc:W:qefawcx2fgAakas:vUdwaAaxas:vUdlaAaPas:vUdbaoc8Wfawc8K2fgAaq8Pdb83dbaAav8Pdb83dxaAam8Pdb83dKaAcwfaqcwfydbBdbaAcCfavcwfydbBdbaAcafamcwfydbBdbawcefhwkaecxfheaDcifgDad6mbkab9cb83dbabcyf9cb83dbabcaf9cb83dbabcKf9cb83dbabczf9cb83dbabcwf9cb83dbawTmeaocbBd8Sao9cb83iKao9cb83izaoczfaoc8Wfawci2cxaoc8Sfcbcrz1jjjbaoIdKhCaoIdChXaoIdzhQao9cb83iwao9cb83ibaoaoc:W:qefawcxaoc8Sfcbciz1jjjbJbbjZhkaoIdwgPJbbbbJbbjZaPaPNaoIdbgPaPNaoIdlgsasNMM:rgx:vaxJbbbb9BEgzNhxasazNhsaPazNhzaoc:W:qefheawhvinaecwfIdbaxNaeIdbazNasaeclfIdbNMMgPakaPak9DEhkaecxfheavcufgvmbkabaCUdwabaXUdlabaQUdbabaoId3UdxdndnakJ;n;m;m899FmbJbbbbhPaoc:W:qefheaoc8WfhvinaCavcwfIdb:taecwfIdbgHNaQavIdb:taeIdbgONaXavclfIdb:taeclfIdbgLNMMaxaHNazaONasaLNMM:vgHaPaHaP9EEhPavc8KfhvaecxfheawcufgwmbkabaxUd8KabasUdaabazUd3abaCaxaPN:tUdKabaXasaPN:tUdCabaQazaPN:tUdzabJbbjZakakN:t:rgkUdydndnaxJbbj:;axJbbj:;9GEgPJbbjZaPJbbjZ9FEJbb;:9cNJbbbZJbbb:;axJbbbb9GEMgP:lJbbb9p9DTmbaP:Ohexekcjjjj94hekabae86b8UdndnasJbbj:;asJbbj:;9GEgPJbbjZaPJbbjZ9FEJbb;:9cNJbbbZJbbb:;asJbbbb9GEMgP:lJbbb9p9DTmbaP:Ohvxekcjjjj94hvkabav86bRdndnazJbbj:;azJbbj:;9GEgPJbbjZaPJbbjZ9FEJbb;:9cNJbbbZJbbb:;azJbbbb9GEMgP:lJbbb9p9DTmbaP:Ohqxekcjjjj94hqkabaq86b8SdndnaecKtcK91:YJbb;:9c:vax:t:lavcKtcK91:YJbb;:9c:vas:t:laqcKtcK91:YJbb;:9c:vaz:t:lakMMMJbb;:9cNJbbjZMgk:lJbbb9p9DTmbak:Ohexekcjjjj94hekaecFbaecFb9iEhexekabcjjj;8iBdycFbhekabae86b8Vxekab9cb83dbabcyf9cb83dbabcaf9cb83dbabcKf9cb83dbabczf9cb83dbabcwf9cb83dbkaoc:W;aef8Kjjjjbk;Iwwvul99iud99eue99eul998Jjjjjbcje9Rgr8Kjjjjbavcd4hwaicd4hDdndnaoTmbarc;abfcbaocdtgvz:njjjb8Aarc;Gbfcbavz:njjjb8AarhvarcafhiaohqinavcFFF97BdbaicFFF;7rBdbaiclfhiavclfhvaqcufgqmbkdnadTmbcbhkinaeakaD2cdtfgvIdwhxavIdlhmavIdbhPalakaw2cdtfIdbhsarc;abfhzarhiarc;GbfhHarcafhqcj1jjbhvaohOinasavcwfIdbaxNavIdbaPNavclfIdbamNMMgAMhCakhXdnaAas:tgAaqIdbgQ9DgLmbaHydbhXkaHaXBdbakhXdnaCaiIdbgK9EmbazydbhXaKhCkazaXBdbaiaCUdbaqaAaQaLEUdbavcxfhvaqclfhqaHclfhHaiclfhiazclfhzaOcufgOmbkakcefgkad9hmbkkadThkJbbbbhCcbhXarc;abfhvarc;Gbfhicbhqinalavydbgzaw2cdtfIdbalaiydbgHaw2cdtfIdbaeazaD2cdtfgzIdwaeaHaD2cdtfgHIdw:tgsasNazIdbaHIdb:tgsasNazIdlaHIdl:tgsasNMM:rMMgsaCasaC9EgzEhCaqaXazEhXaiclfhiavclfhvaoaqcefgq9hmbkaCJbbbZNhKxekadThkcbhXJbbbbhKkJbbbbhCdnaearc;abfaXcdtgifydbgqaD2cdtfgvIdwaearc;GbfaifydbgzaD2cdtfgiIdwgm:tgsasNavIdbaiIdbgY:tgAaANavIdlaiIdlgP:tgQaQNMM:rgxJbbbb9ETmbaxalaqaw2cdtfIdbMalazaw2cdtfIdb:taxaxM:vhCkasaCNamMhmaQaCNaPMhPaAaCNaYMhYdnakmbaDcdthvawcdthiindnalIdbg8AaecwfIdbam:tgCaCNaeIdbaY:tgsasNaeclfIdbaP:tgAaANMM:rgQMgEaK9ETmbJbbbbhxdnaQJbbbb9ETmbaEaK:taQaQM:vhxkaxaCNamMhmaxaANaPMhPaxasNaYMhYa8AaKaQMMJbbbZNhKkaeavfhealaifhladcufgdmbkkabaKUdxabamUdwabaPUdlabaYUdbarcjef8Kjjjjbkjeeiu8Jjjjjbcj8W9Rgr8Kjjjjbaici2hwdnaiTmbawceawce0EhDarhiinaiaeadRbbcdtfydbBdbadcefhdaiclfhiaDcufgDmbkkabarawaladaoz:hjjjbarcj8Wf8Kjjjjbk:3lequ8JjjjjbcjP9Rgl8Kjjjjbcbhvalcjxfcbaiz:njjjb8AdndnadTmbcjehoaehrincuhwarhDcuhqavhkdninawakaoalcjxfaDcefRbbfRbb9RcFeGci6aoalcjxfaDRbbfRbb9RcFeGci6faoalcjxfaDcdfRbbfRbb9RcFeGci6fgxaq9mgmEhwdnammbaxce0mdkaxaqaxaq9kEhqaDcifhDadakcefgk9hmbkkaeawci2fgDcdfRbbhqaDcefRbbhxaDRbbhkaeavci2fgDcifaDawav9Rci2z:qjjjb8Aakalcjxffaocefgo86bbaxalcjxffao86bbaDcdfaq86bbaDcefax86bbaDak86bbaqalcjxffao86bbarcifhravcefgvad9hmbkalcFeaicetz:njjjbhoadci2gDceaDce0EhqcbhxindnaoaeRbbgkcetfgw8UebgDcu9kmbawax87ebaocjlfaxcdtfabakcdtfydbBdbaxhDaxcefhxkaeaD86bbaecefheaqcufgqmbkaxcdthDxekcbhDkabalcjlfaDz:mjjjb8AalcjPf8Kjjjjbk9teiucbcbyd;C1jjbgeabcifc98GfgbBd;C1jjbdndnabZbcztgd9nmbcuhiabad9RcFFifcz4nbcuSmekaehikaik;teeeudndnaeabVciGTmbabhixekdndnadcz9pmbabhixekabhiinaiaeydbBdbaiaeydlBdlaiaeydwBdwaiaeydxBdxaeczfheaiczfhiadc9Wfgdcs0mbkkadcl6mbinaiaeydbBdbaeclfheaiclfhiadc98fgdci0mbkkdnadTmbinaiaeRbb86bbaicefhiaecefheadcufgdmbkkabk:3eedudndnabciGTmbabhixekaecFeGc:b:c:ew2hldndnadcz9pmbabhixekabhiinaialBdxaialBdwaialBdlaialBdbaiczfhiadc9Wfgdcs0mbkkadcl6mbinaialBdbaiclfhiadc98fgdci0mbkkdnadTmbinaiae86bbaicefhiadcufgdmbkkabk9teiucbcbyd;C1jjbgeabcrfc94GfgbBd;C1jjbdndnabZbcztgd9nmbcuhiabad9RcFFifcz4nbcuSmekaehikaik9:eiuZbhedndncbyd;C1jjbgdaecztgi9nmbcuheadai9RcFFifcz4nbcuSmekadhekcbabae9Rcifc98Gcbyd;C1jjbfgdBd;C1jjbdnadZbcztge9nmbadae9RcFFifcz4nb8Akk:;Deludndndnadch9pmbabaeSmdaeabadfgi9Rcbadcet9R0mekabaead;8qbbxekaeab7ciGhldndndnabae9pmbdnalTmbadhvabhixikdnabciGmbadhvabhixdkadTmiabaeRbb86bbadcufhvdnabcefgiciGmbaecefhexdkavTmiabaeRbe86beadc9:fhvdnabcdfgiciGmbaecdfhexdkavTmiabaeRbd86bdadc99fhvdnabcifgiciGmbaecifhexdkavTmiabaeRbi86biabclfhiaeclfheadc98fhvxekdnalmbdnaiciGTmbadTmlabadcufgifglaeaifRbb86bbdnalciGmbaihdxekaiTmlabadc9:fgifglaeaifRbb86bbdnalciGmbaihdxekaiTmlabadc99fgifglaeaifRbb86bbdnalciGmbaihdxekaiTmlabadc98fgdfaeadfRbb86bbkadcl6mbdnadc98fgocd4cefciGgiTmbaec98fhlabc98fhvinavadfaladfydbBdbadc98fhdaicufgimbkkaocx6mbaec9Wfhvabc9WfhoinaoadfgicxfavadfglcxfydbBdbaicwfalcwfydbBdbaiclfalclfydbBdbaialydbBdbadc9Wfgdci0mbkkadTmdadhidnadciGglTmbaecufhvabcufhoadhiinaoaifavaifRbb86bbaicufhialcufglmbkkadcl6mdaec98fhlabc98fhvinavaifgecifalaifgdcifRbb86bbaecdfadcdfRbb86bbaecefadcefRbb86bbaeadRbb86bbaic98fgimbxikkavcl6mbdnavc98fglcd4cefcrGgdTmbavadcdt9RhvinaiaeydbBdbaeclfheaiclfhiadcufgdmbkkalc36mbinaiaeydbBdbaiaeydlBdlaiaeydwBdwaiaeydxBdxaiaeydzBdzaiaeydCBdCaiaeydKBdKaiaeyd3Bd3aecafheaicafhiavc9Gfgvci0mbkkavTmbdndnavcrGgdmbavhlxekavc94GhlinaiaeRbb86bbaicefhiaecefheadcufgdmbkkavcw6mbinaiaeRbb86bbaiaeRbe86beaiaeRbd86bdaiaeRbi86biaiaeRbl86blaiaeRbv86bvaiaeRbo86boaiaeRbr86braicwfhiaecwfhealc94fglmbkkabkk9Tdbcjwk9ubbjZbbbbbbbbbbbbbbjZbbbbbbbbbbbbbbjZ86;nAZ86;nAZ86;nAZ86;nA:;86;nAZ86;nAZ86;nAZ86;nA:;86;nAZ86;nAZ86;nAZ86;nA:;bc;uwkxebbbdbbb9GNbb",e=new Uint8Array([32,0,65,2,1,106,34,33,3,128,11,4,13,64,6,253,10,7,15,116,127,5,8,12,40,16,19,54,20,9,27,255,113,17,42,67,24,23,146,148,18,14,22,45,70,69,56,114,101,21,25,63,75,136,108,28,118,29,73,115]);if(typeof WebAssembly!="object")return{supported:!1};var a,s=WebAssembly.instantiate(r(t),{}).then(function(h){a=h.instance,a.exports.__wasm_call_ctors()});function r(h){for(var d=new Uint8Array(h.length),m=0;m<h.length;++m){var b=h.charCodeAt(m);d[m]=b>96?b-97:b>64?b-39:b+4}for(var y=0,m=0;m<h.length;++m)d[y++]=d[m]<60?e[d[m]]:(d[m]-60)*64+d[++m];return d.buffer.slice(0,y)}function n(h){if(!h)throw new Error("Assertion failed")}function i(h){return new Uint8Array(h.buffer,h.byteOffset,h.byteLength)}var o=48,c=16;function l(h,d){var m=h.meshlets[d*4+0],b=h.meshlets[d*4+1],y=h.meshlets[d*4+2],x=h.meshlets[d*4+3];return{vertices:h.vertices.subarray(m,m+y),triangles:h.triangles.subarray(b,b+x*3)}}function f(h,d,m,b,y,x,w){var E=a.exports.sbrk,T=a.exports.meshopt_buildMeshletsBound(h.length,y,x),_=E(T*c),S=E(T*y*4),N=E(T*x*3),R=E(h.byteLength),I=E(d.byteLength),C=new Uint8Array(a.exports.memory.buffer);C.set(i(h),R),C.set(i(d),I);var A=a.exports.meshopt_buildMeshlets(_,S,N,R,h.length,I,m,b,y,x,w);C=new Uint8Array(a.exports.memory.buffer);for(var P=C.subarray(_,_+A*c),K=new Uint32Array(P.buffer,P.byteOffset,P.byteLength/4).slice(),W=0;W<A;++W){var Q=K[W*4+0],pe=K[W*4+1],m=K[W*4+2],se=K[W*4+3];a.exports.meshopt_optimizeMeshlet(S+Q*4,N+pe,se,m)}var be=K[(A-1)*4+0],Ee=K[(A-1)*4+1],ue=K[(A-1)*4+2],Te=K[(A-1)*4+3],ge=be+ue,Re=Ee+(Te*3+3&-4),Me={meshlets:K,vertices:new Uint32Array(C.buffer,S,ge).slice(),triangles:new Uint8Array(C.buffer,N,Re*3).slice(),meshletCount:A};return E(_-E(0)),Me}function u(h){var d=new Float32Array(a.exports.memory.buffer,h,o/4);return{centerX:d[0],centerY:d[1],centerZ:d[2],radius:d[3],coneApexX:d[4],coneApexY:d[5],coneApexZ:d[6],coneAxisX:d[7],coneAxisY:d[8],coneAxisZ:d[9],coneCutoff:d[10]}}function g(h,d,m,b){var y=a.exports.sbrk,x=[],w=y(d.byteLength),E=y(h.vertices.byteLength),T=y(h.triangles.byteLength),_=y(o),S=new Uint8Array(a.exports.memory.buffer);S.set(i(d),w),S.set(i(h.vertices),E),S.set(i(h.triangles),T);for(var N=0;N<h.meshletCount;++N){var R=h.meshlets[N*4+0],I=h.meshlets[N*4+0+1],C=h.meshlets[N*4+0+3];a.exports.meshopt_computeMeshletBounds(_,E+R*4,T+I,C,w,m,b),x.push(u(_))}return y(w-y(0)),x}function p(h,d,m,b){var y=a.exports.sbrk,x=y(o),w=y(h.byteLength),E=y(d.byteLength),T=new Uint8Array(a.exports.memory.buffer);T.set(i(h),w),T.set(i(d),E),a.exports.meshopt_computeClusterBounds(x,w,h.length,E,m,b);var _=u(x);return y(x-y(0)),_}return{ready:s,supported:!0,buildMeshlets:function(h,d,m,b,y,x){n(h.length%3==0),n(d instanceof Float32Array),n(d.length%m==0),n(m>=3),n(b<=256||b>0),n(y<=512),n(y%4==0),x=x||0;var w=h.BYTES_PER_ELEMENT==4?h:new Uint32Array(h);return f(w,d,d.length/m,m*4,b,y,x)},computeClusterBounds:function(h,d,m){n(h.length%3==0),n(h.length/3<=512),n(d instanceof Float32Array),n(d.length%m==0),n(m>=3);var b=h.BYTES_PER_ELEMENT==4?h:new Uint32Array(h);return p(b,d,d.length/m,m*4)},computeMeshletBounds:function(h,d,m){return n(h.meshletCount!=0),n(d instanceof Float32Array),n(d.length%m==0),n(m>=3),g(h,d,d.length/m,m*4)},extractMeshlet:function(h,d){return n(d>=0&&d<h.meshletCount),l(h,d)}}})();var lg=new Ho().registerExtensions([cn,ln,dn]).registerDependencies({"meshopt.decoder":un});async function yc(t,e={}){await un.ready;let a;if(e.fetchBytes)a=new Uint8Array(await e.fetchBytes(t));else{let u=await fetch(t,{cache:e.fetchCache||"no-store"});if(!u.ok)throw new Error(`Failed to load ${t}: ${u.status}`);a=new Uint8Array(await u.arrayBuffer())}let s=await lg.readBinary(a),r=e.componentFeatures||new Map,n=new Map,i=new Map,o=new Map,c=0;function l(u){if(o.has(u))return o.get(u);let g=u.getAttribute("POSITION"),p=u.getIndices()?.getArray();if(!g||!p)return o.set(u,null),null;let h=u.getAttribute("NORMAL"),d=u.getAttribute("_FEATURE_ID_0"),m=u.getAttribute("_FEATURE_ID_1"),b=g.getCount(),y=new Float32Array(b*3),x=new Float32Array(b*3),w=new Uint32Array(b),E=new Uint32Array(b),T=[];for(let I=0;I<b;I+=1)g.getElement(I,T),y.set(T.slice(0,3),I*3),h?(h.getElement(I,T),x.set(T.slice(0,3),I*3)):x.set([0,1,0],I*3),w[I]=Number(d?.getScalar(I)||0),E[I]=Number(m?.getScalar(I)||0);let _=fg(u.getMaterial(),e),S=[ka(y),ka(x),ka(w),ka(E),ka(p),b,p.length,JSON.stringify(_)].join(":"),N=i.get(S),R=N;return(!N||!hg(N.primitive,y,x,w,E,p))&&(R={primitive:{position:y,normal:x,netId:w,objectFeatureId:E,indices:Uint32Array.from(p),material:_,bounds:null},placements:[]},i.set(N?`${S}:${i.size}`:S,R)),o.set(u,R),R}function f(u,g=""){let p=r.has(u.getName());p&&n.set(u.getName(),(n.get(u.getName())||0)+1);let h=p?u.getName():g,d=u.getMesh();if(d){let m=dg(u.getWorldMatrix());m[11]+=Number(e.zOffset||0);let b=Number(r.get(h)?.featureId||e.defaultFeatureId||0),y=c++;for(let x of d.listPrimitives()){let w=l(x);if(!w)continue;let E=ug(w.primitive.position,m);w.placements.push({rows:m,featureId:b,designator:h,bounds:E,node:y});let T=w.primitive.bounds;w.primitive.bounds=T?[Math.min(T[0],E[0]),Math.min(T[1],E[1]),Math.min(T[2],E[2]),Math.max(T[3],E[3]),Math.max(T[4],E[4]),Math.max(T[5],E[5])]:[...E]}}for(let m of u.listChildren())f(m,h)}for(let u of s.getRoot().listScenes())for(let g of u.listChildren())f(g);return{byteLength:a.byteLength,models:[...i.values()],componentNodeCounts:n}}function dg(t){return[t[0],t[4],t[8],t[12],-t[2],-t[6],-t[10],-t[14],t[1],t[5],t[9],t[13]]}function ug(t,e){let a=[1/0,1/0,1/0,-1/0,-1/0,-1/0];for(let s=0;s<t.length;s+=3){let r=t[s],n=t[s+1],i=t[s+2];for(let o=0;o<3;o+=1){let c=o*4,l=e[c]*r+e[c+1]*n+e[c+2]*i+e[c+3];l<a[o]&&(a[o]=l),l>a[o+3]&&(a[o+3]=l)}}return a}function fg(t,e){return t?{name:t.getName(),baseColor:t.getBaseColorFactor(),metallic:t.getMetallicFactor(),roughness:t.getRoughnessFactor(),emissive:t.getEmissiveFactor()}:{baseColor:e.baseColor||[.55,.58,.64,1],metallic:.05,roughness:.72,emissive:[0,0,0]}}function ka(t){let e=t.BYTES_PER_ELEMENT===4?new Uint32Array(t.buffer,t.byteOffset,t.length):t,a=2166136261;for(let s=0;s<e.length;s+=1)a^=e[s],a=Math.imul(a,16777619)>>>0;return a.toString(36)}function hg(t,e,a,s,r,n){let i=(o,c)=>o.length===c.length&&o.every((l,f)=>l===c[f]);return i(t.position,e)&&i(t.normal,a)&&i(t.netId,s)&&i(t.objectFeatureId,r)&&i(t.indices,n)}var bg=Object.freeze([0,1,1,0]),Ea=`
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
`,Xe=Object.freeze([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);function pg(t){let e=t?.matrix??t;if(!e||typeof e.length!="number"||e.length!==16)throw new TypeError("An occurrence matrix must have 16 numbers (column-major)");let a=Array.from(e,Number);if(!a.every(Number.isFinite))throw new TypeError("An occurrence matrix must be finite");if(a[3]!==0||a[7]!==0||a[11]!==0||a[15]!==1)throw new TypeError("An occurrence matrix must be affine (last row 0 0 0 1)");return a}function gg(t){let[e,a,s,,r,n,i,,o,c,l]=t,f=n*l-c*i,u=c*s-a*l,g=a*i-n*s,p=o*i-r*l,h=e*l-o*s,d=r*s-e*i,m=r*c-o*n,b=o*a-e*c,y=e*n-r*a,x=e*f+r*u+o*g;if(x===0)throw new TypeError("An occurrence matrix must be invertible");let w=x<0?-1:1;return[w*f,w*p,w*m,0,w*u,w*h,w*b,0,w*g,w*d,w*y,0,0,0,0,1]}function mg(t){let e=new Uint32Array(4);for(let a of t||[]){let s=Number(a);!Number.isInteger(s)||s<0||s>=128||(e[s>>>5]|=1<<(s&31)>>>0)}return e}function Cs(t,e=[],a=[]){let s=new Float32Array(Math.max(1,t.length)*40),r=new Uint32Array(s.buffer);return t.forEach((n,i)=>{let o=i*40;s.set(n,o),s.set(gg(n),o+16),e[i]&&r.set(mg(e[i]),o+32),s.set(a[i]||bg,o+36)}),s}function fn(t,e){let[a,s,r]=e;return[t[0]*a+t[4]*s+t[8]*r+t[12],t[1]*a+t[5]*s+t[9]*r+t[13],t[2]*a+t[6]*s+t[10]*r+t[14]]}function xc(t,e){if(!e)return null;let a=[1/0,1/0,1/0,-1/0,-1/0,-1/0];for(let s=0;s<8;s+=1){let r=fn(t,[e[s&1?3:0],e[s&2?4:1],e[s&4?5:2]]);for(let n=0;n<3;n+=1)a[n]=Math.min(a[n],r[n]),a[n+3]=Math.max(a[n+3],r[n])}return a}function wc(t){return t.every((e,a)=>e===Xe[a])}var yg=0,xg=4294901759;function vc(t,e){let a=t>>>0,s=e>>>0;return a===yg?{kind:"none",occurrenceIndex:-1,featureId:0}:{kind:s?"feature":"board",occurrenceIndex:a-1,featureId:s}}function kc(t){let e=Array.from(t);if(e.length>xg)throw new RangeError("Too many occurrences for the pick target");let a=e.map(pg),s=o=>o&&!Array.isArray(o)&&!ArrayBuffer.isView(o),r=e.map((o,c)=>s(o)&&o.key!=null?String(o.key):String(c));if(new Set(r).size!==r.length)throw new TypeError("Occurrence keys must be unique");let n=e.map(o=>s(o)&&o.hiddenLayers?[...o.hiddenLayers].map(Number):[]),i=e.map(o=>s(o)&&o.explode?[...o.explode].map(Number):null);return{matrices:a,keys:r,hiddenLayers:n,explode:i}}function Ec(t,e,a){let[s,r,n]=e,i=t[0]*s+t[4]*r+t[8]*n+t[12],o=t[1]*s+t[5]*r+t[9]*n+t[13],c=t[2]*s+t[6]*r+t[10]*n+t[14],l=t[3]*s+t[7]*r+t[11]*n+t[15];return!(l>0)||c<0||c>l?null:{x:a.x+(i/l*.5+.5)*a.width,y:a.y+(.5-o/l*.5)*a.height}}var Tc=0;var hn=4,E1=Object.freeze(["full","board","body","box"]),Jt=Object.freeze({fullPx:140,boardPx:70,boxPx:18,keep:.8});function Mc(t={}){let e=(i,o)=>Number.isFinite(Number(t[i]))?Math.max(0,Number(t[i])):o,a=e("boxPx",Jt.boxPx),s=Math.max(a,e("boardPx",Jt.boardPx)),r=Math.max(s,e("fullPx",Jt.fullPx)),n=Math.min(1,Math.max(.05,e("keep",Jt.keep)));return{fullPx:r,boardPx:s,boxPx:a,keep:n}}function _c(t){let e=c=>[t[c],t[4+c],t[8+c],t[12+c]],[a,s,r,n]=[e(0),e(1),e(2),e(3)],i=(c,l)=>c.map((f,u)=>f+l[u]),o=(c,l)=>c.map((f,u)=>f-l[u]);return[i(n,a),o(n,a),i(n,s),o(n,s),r,o(n,r)]}var Ta=class{constructor(e,a,s,r=16777216){this.device=e,this.usage=a|Sc.COPY_SRC|Sc.COPY_DST,this.label=s,this.chunkBytes=r,this.chunks=[],this.usedBytes=0,this.generation=0,this.repacks=0}alloc(e){let s={buffer:null,offset:0,size:Math.max(4,Math.ceil(e/4)*4),chunk:null};return this.place(s,null),s}place(e,a){let{size:s}=e,r=null;if(s<=this.chunkBytes/2)for(let o of this.chunks)o===a||o.dedicated||o.free.forEach((c,l)=>{c.size>=s&&(!r||c.size<r.range.size)&&(r={chunk:o,index:l,range:c})});let n,i;if(r)({chunk:n}=r),i=r.range.offset,r.range.size===s?n.free.splice(r.index,1):n.free[r.index]={offset:i+s,size:r.range.size-s};else{let o=s>this.chunkBytes/2,c=o?s:this.chunkBytes;n={buffer:this.device.createBuffer({label:`${this.label}-${this.chunks.length}`,size:c,usage:this.usage}),size:c,free:c>s?[{offset:s,size:c-s}]:[],used:0,live:new Set,dedicated:o},this.chunks.push(n),i=0}n.used+=s,n.live.add(e),this.usedBytes+=s,Object.assign(e,{buffer:n.buffer,offset:i,chunk:n})}write(e,a){this.device.queue.writeBuffer(e.buffer,e.offset,a)}free(e){let{chunk:a}=e;if(!(!a||!a.live.has(e))){if(this.release(a,e),e.chunk=null,!a.live.size){this.drop(a);return}!a.dedicated&&a.used<a.size*.5&&this.chunks.length>1&&this.repack(a)}}release(e,a){e.used-=a.size,e.live.delete(a),this.usedBytes-=a.size;let s=e.free,r=s.findIndex(n=>n.offset>a.offset);r<0&&(r=s.length),s.splice(r,0,{offset:a.offset,size:a.size}),r+1<s.length&&s[r].offset+s[r].size===s[r+1].offset&&(s[r].size+=s[r+1].size,s.splice(r+1,1)),r>0&&s[r-1].offset+s[r-1].size===s[r].offset&&(s[r-1].size+=s[r].size,s.splice(r,1))}drop(e){e.buffer.destroy?.(),this.chunks.splice(this.chunks.indexOf(e),1)}repack(e){let a=this.device.createCommandEncoder({label:`${this.label}-repack`});for(let s of[...e.live]){let r={buffer:s.buffer,offset:s.offset};this.release(e,s),this.place(s,e),a.copyBufferToBuffer(r.buffer,r.offset,s.buffer,s.offset,s.size)}this.device.queue.submit([a.finish()]),this.drop(e),this.generation+=1,this.repacks+=1}reservedBytes(){return this.chunks.reduce((e,a)=>e+a.size,0)}destroy(){for(let e of this.chunks)e.buffer.destroy?.();this.chunks=[],this.usedBytes=0}},Sc=globalThis.GPUBufferUsage||{COPY_SRC:4,COPY_DST:8};var bn=Object.freeze(["decl","vs-out","vs-end","fs-begin","fs-return"]),wg={decl:"decl","vs-out":"vsOut","vs-end":"vsEnd","fs-begin":"fsBegin"},vg=/^[ \t]*\/\/ @feature:[a-z-]+\n/gm;function ce(t){if(!bn.includes(t))throw new Error(`Unknown shader hook ${t}`);return`// @feature:${t}
`}function Se(t){return t.replace(vg,"")}function pn(t){return Ma(t).map(e=>e.name).join("+")}function Ma(t=[]){let e=new Set;for(let a of t){if(!a?.name||!/^[a-z][a-z0-9-]*$/.test(a.name))throw new Error(`Bad shader feature name ${a?.name}`);if(e.has(a.name))throw new Error(`Shader feature ${a.name} given twice`);e.add(a.name)}return[...t].sort((a,s)=>a.name<s.name?-1:a.name>s.name?1:0)}function kg(t,e="shader"){for(let a of bn){let s=gn(t,a).length;if(s!==1)throw new Error(`${e}: hook ${a} appears ${s} times, expected once`)}Rc(t,e)}function Ac(t,e=[],a={}){let s=Ma(e);if(!s.length)return Se(t);let r=`${a.family||"shader"}${a.instanced?" (instanced)":""}`;kg(t,r);let n=t;for(let i of bn){if(i==="fs-return"){let{start:u,end:g,indent:p,expression:h}=Rc(n,r),d=s.reduce((m,b)=>b.fsReturn?b.fsReturn(m,a):m,h);n=`${n.slice(0,u)}${p}return ${d};
${n.slice(g)}`;continue}let o=wg[i],c=s.map(u=>u[o]?.(a)).filter(Boolean),[l]=gn(n,i),f=c.map(u=>u.endsWith(`
`)?u:`${u}
`).join("");n=`${n.slice(0,l.index)}${f}${n.slice(l.index+l[0].length)}`}return Se(n)}function gn(t,e){return[...t.matchAll(new RegExp(`^[ \\t]*// @feature:${e}\\n`,"gm"))]}function Rc(t,e){let[a]=gn(t,"fs-return"),s=a.index+a[0].length,r=t.slice(s).match(/^([ \t]*)return (.+);\n/);if(!r)throw new Error(`${e}: hook fs-return is not followed by a return line`);return{start:a.index,end:s+r[0].length,indent:r[1],expression:r[2]}}var mn=`
fn featureHidden(id: u32) -> bool {
  return id < arrayLength(&hiddenMask) && hiddenMask[id] == 0u;
}
`;function Bs(t){let e=new Set;if(t==null)return e;for(let a of t){let s=Number(a);!Number.isInteger(s)||s<=0||s>4294967295||e.add(s)}return e}function Ic(t,e=0){let a=0;for(let n of Bs(t))a=Math.max(a,n);let s=64,r=a+1;for(;s<r;)s*=2;return Math.max(s,Math.floor(e)||0)}function Nc(t,e){let a=Math.max(64,Math.floor(e)||0),s=new Uint32Array(a);s.fill(1);for(let r of Bs(t))r<a&&(s[r]=0);return s}function Eg(t){let e=Number(t.drillWidthMm)||0,a=Number(t.drillHeightMm)||e,s=Math.min(e,a),r=Math.min(Number(t.outerWidthMm)||0,Number(t.outerHeightMm)||0),n=Number.isFinite(t.platingThicknessMm)?t.platingThicknessMm:Math.max(0,(r-s)/2),i=(Number(t.rotationDeg)||0)*Math.PI/180+(a>e?Math.PI/2:0);return{x:t.centerMm[0]/1e3,y:-t.centerMm[1]/1e3,drillRadius:s/2e3,outerRadius:(s/2+n)/1e3,halfLength:Math.abs(e-a)/2e3,angle:Math.abs(e-a)>0?-i:0,startZ:t.startZMm/1e3,endZ:t.endZMm/1e3,netId:t.netId||0,objectId:t.objectFeatureId||0,startLayerId:t.startLayerId||0,endLayerId:t.endLayerId||0}}function Cc(t,e){let a=new Map((e||[]).map(s=>[Number(s.id),Number(s.thickness_mm)||0]));return(t||[]).map(s=>{let r=i=>Math.max(0,(a.get(Number(i))||0)/2-.001),n=s.startZMm>=s.endZMm?1:-1;return{...s,startZMm:s.startZMm+n*r(s.startLayerId),endZMm:s.endZMm-n*r(s.endLayerId)}})}var _a=0,yn=16,xn=24,Sa=32,Bc=48,Fc=Object.freeze({arrayStride:Bc,stepMode:"instance",attributes:Object.freeze([Object.freeze({shaderLocation:3,offset:_a,format:"float32x4"}),Object.freeze({shaderLocation:4,offset:yn,format:"float32x2"}),Object.freeze({shaderLocation:6,offset:xn,format:"float32x2"}),Object.freeze({shaderLocation:5,offset:Sa,format:"uint32x4"})])}),wn=48,Fs=`struct Input {
  @location(0) unit: vec3f,
  @location(1) normal: vec3f,
  @location(2) radiusMix: f32,
  @location(3) dimensions: vec4f,
  @location(4) span: vec2f,
  @location(5) ids: vec4u,
  @location(6) shape: vec2f,
};`,Oc=`struct Barrel {
  dimensions: vec4f,
  span: vec2f,
  shape: vec2f,
  ids: vec4u,
};
@group(0) @binding(6) var<storage, read> barrels: array<Barrel>;`;function Pc(t,e,a){let s=new ArrayBuffer(Math.max(a,t.length)*e),r=new DataView(s);return t.forEach((n,i)=>{let o=i*e,c=Eg(n);r.setFloat32(o+_a,c.x,!0),r.setFloat32(o+_a+4,c.y,!0),r.setFloat32(o+_a+8,c.drillRadius,!0),r.setFloat32(o+_a+12,c.outerRadius,!0),r.setFloat32(o+yn,c.startZ,!0),r.setFloat32(o+yn+4,c.endZ,!0),r.setFloat32(o+xn,c.halfLength,!0),r.setFloat32(o+xn+4,c.angle,!0),r.setUint32(o+Sa,c.netId,!0),r.setUint32(o+Sa+4,c.objectId,!0),r.setUint32(o+Sa+8,c.startLayerId,!0),r.setUint32(o+Sa+12,c.endLayerId,!0)}),s}function jc(t){return Pc(t,Bc,0)}function Lc(t){return Pc(t,wn,1)}var vn=t=>`
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
`,Dc=`
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

${vn(10)}
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
`,Tg={compare:"always",passOp:"keep"},Os=Object.freeze({shapeMask:{face:{compare:"always",passOp:"replace"},read:255,write:128,reference:128,color:!1,depth:!1},fan:{face:{compare:"always",passOp:"invert"},read:255,write:64,reference:0,color:!1,depth:!1},coverSubtract:{face:{compare:"not-equal",passOp:"replace",failOp:"keep"},read:64,write:192,reference:128,color:!1,depth:!1},shapeAdd:{face:{compare:"greater",passOp:"replace"},read:160,write:33,reference:32,color:!0,depth:!0},coverMark:{face:{compare:"equal",passOp:"replace",failOp:"keep"},read:192,write:1,reference:65,color:!1,depth:!1,depthTest:!0},coverAdd:{face:{compare:"equal",passOp:"invert",failOp:"keep",depthFailOp:"keep"},read:224,write:96,reference:64,color:!0,depth:!0},coverClear:{face:{compare:"always",passOp:"zero"},read:255,write:64,reference:0,color:!1,depth:!1},shapeLay:{face:{compare:"greater",passOp:"replace"},read:160,write:32,reference:32,color:!1,depth:!1,depthTest:!0},coverLay:{face:{compare:"equal",passOp:"invert",failOp:"keep",depthFailOp:"keep"},read:224,write:96,reference:64,color:!1,depth:!1,depthTest:!0},shapeBlend:{face:{compare:"greater",passOp:"replace"},read:160,write:32,reference:32,color:!0,depth:!0},coverBlend:{face:{compare:"equal",passOp:"invert",failOp:"keep",depthFailOp:"keep"},read:224,write:96,reference:64,color:!0,depth:!0},tintCovered:{face:{compare:"equal",passOp:"keep"},read:33,write:0,reference:33,color:!0,depth:!0},tintPlain:{face:{compare:"equal",passOp:"keep"},read:33,write:0,reference:32,color:!0,depth:!0},footShape:{face:{compare:"always",passOp:"replace"},read:0,write:2,reference:2,color:!1,depth:!1},footCover:{face:{compare:"equal",passOp:"replace",failOp:"keep"},read:64,write:2,reference:66,color:!1,depth:!1},tintHigh:{face:{compare:"equal",passOp:"replace"},read:34,write:4,reference:38,color:!0,depth:!0},tintLow:{face:{compare:"equal",passOp:"replace"},read:34,write:4,reference:36,color:!0,depth:!0},clearLay:{face:{compare:"always",passOp:"zero"},read:0,write:224,reference:0,color:!1,depth:!1},shapeOnFoot:{face:{compare:"equal",passOp:"invert"},read:166,write:32,reference:6,color:!0,depth:!0},shapeOffFoot:{face:{compare:"equal",passOp:"invert"},read:166,write:32,reference:4,color:!0,depth:!0},coverOnFoot:{face:{compare:"equal",passOp:"invert",failOp:"keep",depthFailOp:"keep"},read:230,write:96,reference:70,color:!0,depth:!0},coverOffFoot:{face:{compare:"equal",passOp:"invert",failOp:"keep",depthFailOp:"keep"},read:230,write:96,reference:68,color:!0,depth:!0},clearFoot:{face:{compare:"always",passOp:"zero"},read:0,write:6,reference:0,color:!1,depth:!1},coat:{face:{compare:"equal",passOp:"keep",failOp:"keep",depthFailOp:"keep"},read:2,write:0,reference:0,color:!0,depth:!0},solid:{face:Tg,read:0,write:0,reference:0,color:!0,depth:!0},clear:{face:{compare:"always",passOp:"zero"},read:255,write:224,reference:0,color:!1,depth:!1}});var Uc=64,kn=112,zc=48,Mg=.51,Gc=6,Kc=`
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
${vn(7)}
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
  return vec4f(view.color.rgb * shade, ${Mg});
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
`,Vc=`
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
`;var Hc=`
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
${vn(3)}

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
`;var _n=20,et=256,qc=112,It="rg32uint",Qt=et/4,Rg=256,Wc={compare:"always",passOp:"zero"},Ig={compare:"always",passOp:"replace"},Ng={compare:"not-equal",passOp:"keep"},Cg={compare:"equal",passOp:"keep"},Jc="fn dequant(p: vec3f) -> vec3f { return draw.quantMin.xyz + p * draw.quantSize.xyz; }",Qc=32,Zc=`  let plating = input.dimensions.w - input.dimensions.z;
  let rim = select(1.0, ${(1/Math.cos(Math.PI/Qc)).toFixed(6)}, input.radiusMix > 1.5);
  let radius = mix(max(input.dimensions.z - plating, input.dimensions.z * 0.5), input.dimensions.z, min(input.radiusMix, 1.0)) * rim;
  let turn = vec2f(cos(input.shape.y), sin(input.shape.y));
  let local = vec2f(input.unit.x * radius + select(-input.shape.x, input.shape.x, input.unit.x >= 0.0), input.unit.y * radius);
  let planar = vec2f(local.x * turn.x - local.y * turn.y, local.x * turn.y + local.y * turn.x);
  let turnedNormal = vec3f(input.normal.x * turn.x - input.normal.y * turn.y, input.normal.x * turn.y + input.normal.y * turn.x, input.normal.z);
`,js=`
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
${Jc}
@group(0) @binding(3) var<storage, read> hiddenMask: array<u32>;
@group(0) @binding(4) var<storage, read> netMask: array<u32>;
${mn}
${ya}
// Set on the pipeline that draws the solder mask over copper.
override COVERED: bool = false;

${ce("decl")}struct VertexInput {
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
${ce("vs-out")}  @location(3) world: vec3f,
};
@vertex fn vs(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  output.world = dequant(input.position) + draw.offset.xyz;
  output.position = globals.viewProjection * vec4f(output.world, 1.0);
  output.normal = normalize(input.normal);
  output.netId = input.netId;
  output.objectId = input.objectId;
${ce("vs-end")}  return output;
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
${ce("fs-begin")}  let kind = u32(draw.flags.x);
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
${ce("fs-return")}  return vec4f(aces(lit), alpha);
}
`,Bg=Se(js),Ls=`
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
${Jc}
@group(0) @binding(3) var<storage, read> hiddenMask: array<u32>;
@group(0) @binding(4) var<storage, read> netMask: array<u32>;
${mn}
${ya}
${ce("decl")}struct Input {
  @location(0) position: vec3f,
  @location(1) normal: vec3f,
  @location(2) netId: u32,
  @location(3) objectId: u32,
};
struct Output {
  @builtin(position) position: vec4f,
  @location(2) @interpolate(flat) netId: u32,
${ce("vs-out")}  @location(0) @interpolate(flat) objectId: u32,
};
@vertex fn vs(input: Input) -> Output {
  var output: Output;
  output.position = globals.viewProjection * vec4f(dequant(input.position) + draw.offset.xyz, 1.0);
  output.objectId = input.objectId;
  output.netId = input.netId;
${ce("vs-end")}  return output;
}
@fragment fn fs(input: Output) -> @location(0) vec2u {
${ce("fs-begin")}  if (u32(draw.flags.x) == 2u && featureHidden(input.objectId)) { discard; }
  // Isolated (flags.z), unlit copper is not drawn, so it is not there to pick (SB2-31e).
  let lit = netEmphasized(input.netId) || (globals.activeNet != 0u && input.netId == globals.activeNet);
  if (u32(draw.flags.x) == 1u && draw.flags.z > 0.5 && !lit) { discard; }
${ce("fs-return")}  return vec2u(1u, input.objectId);
}
`,Fg=Se(Ls),An=`
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
${ya}
${ce("decl")}${Fs}
struct Output {
  @builtin(position) position: vec4f,
  @location(0) normal: vec3f,
  @location(1) @interpolate(flat) netId: u32,
  @location(2) @interpolate(flat) objectId: u32,
${ce("vs-out")}  @location(3) @interpolate(flat) visible: u32,
};
@vertex fn vs(input: Input) -> Output {
${Zc}  let z0 = input.span.x + layerOffsets[input.ids.z];
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
${ce("vs-end")}  return output;
}
@fragment fn fs(input: Output) -> @location(0) vec4f {
${ce("fs-begin")}  if (input.visible == 0u) { discard; }
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
${ce("fs-return")}  return vec4f(lit, 1.0);
}
`,Og=Se(An),Rn=`
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
${ya}
${ce("decl")}${Fs}
struct Output {
  @builtin(position) position: vec4f,
  @location(3) @interpolate(flat) netId: u32,
  @location(0) @interpolate(flat) objectId: u32,
${ce("vs-out")}  @location(1) @interpolate(flat) visible: u32,
};
@vertex fn vs(input: Input) -> Output {
${Zc}  let world = vec3f(
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
${ce("vs-end")}  return output;
}
@fragment fn fs(input: Output) -> @location(0) vec2u {
${ce("fs-begin")}  if (input.visible == 0u) { discard; }
  let lit = netEmphasized(input.netId) || (globals.activeNet != 0u && input.netId == globals.activeNet);
  if (draw.flags.z > 0.5 && !lit) { discard; }
${ce("fs-return")}  return vec2u(1u, input.objectId);
}
`,Pg=Se(Rn);function Lt(t,e){return e.reduce((a,[s,r])=>{if(a.split(s).length!==2)throw new Error(`Shader variant anchor not found once: ${s.slice(0,60)}`);return a.replace(s,()=>r)},t)}var In=[`  padding0: u32,
  padding1: u32,`,`  selectedOccurrence: u32,
  occurrenceBase: u32,`],Ds=[["  padding2: u32,","  emphasisStride: u32,"],["fn netEmphasized(id: u32) -> bool {",`${fo}fn netEmphasized(id: u32) -> bool {`]],el="  let lit = netEmphasized(input.netId) || (globals.activeNet != 0u && input.netId == globals.activeNet);",tl=`  let lit = emphasisOf(input.occurrence, input.netId) != 0u
    || (input.occurrence == globals.selectedOccurrence && globals.activeNet != 0u && input.netId == globals.activeNet);`,Nn=Lt(js,[In,[`  @location(3) world: vec3f,
};`,`  @location(3) world: vec3f,
  @location(4) @interpolate(flat) occurrence: u32,
  // Mask and silkscreen opacity of this occurrence's own stackup separation (SB2-31f).
  @location(5) @interpolate(flat) fade: f32,
};`],[`@vertex fn vs(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  output.world = dequant(input.position) + draw.offset.xyz;
  output.position = globals.viewProjection * vec4f(output.world, 1.0);
  output.normal = normalize(input.normal);`,`${Ea}
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
  let selectedComponent = here && component && globals.selectedFeature != 0u && input.objectId == globals.selectedFeature;`],...Ds,["      base = vec3f(0.08, 1.0, 0.2) * pulse;","      base = emphasisColor(mark, vec3f(0.08, 1.0, 0.2)) * pulse;"],["  var alpha = draw.flags.y;","  var alpha = draw.flags.y * input.fade;"]]),al=Se(Nn),Cn=Lt(Ls,[In,[`  @location(0) @interpolate(flat) objectId: u32,
};`,`  @location(0) @interpolate(flat) objectId: u32,
  @location(1) @interpolate(flat) occurrence: u32,
};`],[`@vertex fn vs(input: Input) -> Output {
  var output: Output;
  output.position = globals.viewProjection * vec4f(dequant(input.position) + draw.offset.xyz, 1.0);`,`${Ea}
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
  }`],[`${ce("fs-return")}  return vec2u(1u, input.objectId);`,`  let kind = u32(draw.flags.x);
${ce("fs-return")}  return vec2u(input.occurrence, select(input.objectId, 0u, kind == 0u));`],...Ds,[el,tl]]),sl=Se(Cn),jg=`struct Placement { r0: vec4f, r1: vec4f, r2: vec4f, ids: vec4u };
@group(0) @binding(8) var<storage, read> placements: array<Placement>;
fn place(p: Placement, v: vec3f) -> vec3f {
  return vec3f(dot(p.r0.xyz, v) + p.r0.w, dot(p.r1.xyz, v) + p.r1.w, dot(p.r2.xyz, v) + p.r2.w);
}
fn turn(p: Placement, n: vec3f) -> vec3f {
  return vec3f(dot(p.r0.xyz, n), dot(p.r1.xyz, n), dot(p.r2.xyz, n));
}`,Xc="@group(0) @binding(1) var<uniform> draw: Draw;",Us=[Xc,`${Xc}
${jg}`],zs=["  output.objectId = input.objectId;","  output.objectId = select(placement.ids.x, input.objectId, input.objectId != 0u);"],rl=["  let index = listedOccurrence(u32(draw.material.w + 0.5), instance);",`  let placement = placements[draw.placement.x + instance % draw.placement.y];
  let index = listedOccurrence(u32(draw.material.w + 0.5), instance / draw.placement.y);`],nl=Lt(js,[Us,[`@vertex fn vs(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  output.world = dequant(input.position) + draw.offset.xyz;`,`@vertex fn vs(input: VertexInput, @builtin(instance_index) instance: u32) -> VertexOutput {
  let placement = placements[draw.placement.x + instance];
  var output: VertexOutput;
  output.world = place(placement, dequant(input.position)) + draw.offset.xyz;`],["  output.normal = normalize(input.normal);","  output.normal = normalize(turn(placement, input.normal));"],zs]),il=Lt(Nn,[Us,rl,["occurrence.model * vec4f(dequant(input.position) + draw.offset.xyz + lift, 1.0)","occurrence.model * vec4f(place(placement, dequant(input.position)) + draw.offset.xyz + lift, 1.0)"],["(occurrence.normal * vec4f(input.normal, 0.0))","(occurrence.normal * vec4f(turn(placement, input.normal), 0.0))"],zs]),ol=Lt(Ls,[Us,[`@vertex fn vs(input: Input) -> Output {
  var output: Output;
  output.position = globals.viewProjection * vec4f(dequant(input.position) + draw.offset.xyz, 1.0);`,`@vertex fn vs(input: Input, @builtin(instance_index) instance: u32) -> Output {
  let placement = placements[draw.placement.x + instance];
  var output: Output;
  output.position = globals.viewProjection * vec4f(place(placement, dequant(input.position)) + draw.offset.xyz, 1.0);`],zs]),cl=Lt(Cn,[Us,rl,["occurrence.model * vec4f(dequant(input.position) + draw.offset.xyz + lift, 1.0)","occurrence.model * vec4f(place(placement, dequant(input.position)) + draw.offset.xyz + lift, 1.0)"],zs]),ll=Se(nl),dl=Se(il),ul=Se(ol),fl=Se(cl),En=64,Lg=6,Dg=`${Oc}
${Ea}
struct Input {
  @location(0) unit: vec3f,
  @location(1) normal: vec3f,
  @location(2) radiusMix: f32,
};`;function hl(t,e,a=[]){return Lt(t,[In,[`@group(0) @binding(2) var<storage, read> layerOffsets: array<f32>;
`,""],[Fs,Dg],["@vertex fn vs(input: Input) -> Output {",`struct Record {
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
  output.occurrence = index + 1u + globals.occurrenceBase;`],...a])}var bl=hl(An,`  output.position = globals.viewProjection * vec4f(world, 1.0);
  output.normal = turnedNormal;`,[[`  let z0 = input.span.x + layerOffsets[input.ids.z];
  let z1 = input.span.y + layerOffsets[input.ids.w];`,`  let z0 = input.span.x + layerOffsets[input.ids.z] * spread;
  let z1 = input.span.y + layerOffsets[input.ids.w] * spread;`],[`  output.normal = turnedNormal;
  output.netId`,`  output.normal = (occurrence.normal * vec4f(turnedNormal, 0.0)).xyz;
  output.netId`],[`  @location(3) @interpolate(flat) visible: u32,
};`,`  @location(3) @interpolate(flat) visible: u32,
  @location(4) @interpolate(flat) occurrence: u32,
};`],["  let selected = netEmphasized(input.netId) || (globals.activeNet != 0u && input.netId == globals.activeNet);",`  let mark = emphasisOf(input.occurrence, input.netId);
  let selected = mark != 0u
    || (input.occurrence == globals.selectedOccurrence && globals.activeNet != 0u && input.netId == globals.activeNet);`],...Ds,["      base = vec3f(0.1, 1.0, 0.22) * (","      base = emphasisColor(mark, vec3f(0.1, 1.0, 0.22)) * ("]]),pl=hl(Rn,`  output.position = globals.viewProjection * vec4f(world, 1.0);
  output.objectId`,[["mix(input.span.x + layerOffsets[input.ids.z], input.span.y + layerOffsets[input.ids.w], input.unit.z)","mix(input.span.x + layerOffsets[input.ids.z] * spread, input.span.y + layerOffsets[input.ids.w] * spread, input.unit.z)"],[`  @location(1) @interpolate(flat) visible: u32,
};`,`  @location(1) @interpolate(flat) visible: u32,
  @location(2) @interpolate(flat) occurrence: u32,
};`],["  return vec2u(1u, input.objectId);","  return vec2u(input.occurrence, input.objectId);"],...Ds,[el,tl]]),gl=Se(bl),ml=Se(pl),yl=`
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
${Ea}
${ce("decl")}struct Input {
  @location(0) corner: vec3f,
  @location(1) normal: vec3f,
};
struct Output {
  @builtin(position) position: vec4f,
  @location(0) normal: vec3f,
${ce("vs-out")}  @location(1) @interpolate(flat) occurrence: u32,
};
@vertex fn vs(input: Input, @builtin(instance_index) instance: u32) -> Output {
  let index = listedOccurrence(LIST_BOX, instance);
  let occurrence = occurrences[index];
  let local = draw.offset.xyz + input.corner * draw.material.xyz;
  var output: Output;
  output.position = globals.viewProjection * vec4f((occurrence.model * vec4f(local, 1.0)).xyz, 1.0);
  output.normal = (occurrence.normal * vec4f(input.normal, 0.0)).xyz;
  output.occurrence = index + 1u + globals.occurrenceBase;
${ce("vs-end")}  return output;
}
`,xl=`${yl}
@fragment fn fs(input: Output) -> @location(0) vec4f {
${ce("fs-begin")}  let light = normalize(globals.lightDirection.xyz);
${ce("fs-return")}  return vec4f(draw.color.rgb * (0.45 + max(dot(normalize(input.normal), light), 0.0) * 0.55), 1.0);
}
`,wl=Se(xl),vl=`${yl}
@fragment fn fs(input: Output) -> @location(0) vec2u {
${ce("fs-begin")}${ce("fs-return")}  return vec2u(input.occurrence, 0u);
}
`,kl=Se(vl),Bn=`
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
`,$c=[{arrayStride:24,attributes:[{shaderLocation:0,offset:0,format:"float32x3"},{shaderLocation:1,offset:12,format:"float32x3"}]}],j1=Object.freeze({main:al,pick:sl,barrel:gl,barrelPick:ml,box:wl,boxPick:kl,cull:Bn,component:ll,componentInstanced:dl,componentPick:ul,componentPickInstanced:fl}),El=Object.freeze({main:{output:"color",single:js,instanced:Nn,world:["output.world","output.world"]},pick:{output:"pick",single:Ls,instanced:Cn,world:["(dequant(input.position) + draw.offset.xyz)","world"]},barrel:{output:"color",single:An,instanced:bl,world:["world","(occurrence.model * vec4f(world, 1.0)).xyz"]},barrelPick:{output:"pick",single:Rn,instanced:pl,world:["world","(occurrence.model * vec4f(world, 1.0)).xyz"]},component:{output:"color",single:nl,instanced:il,world:["output.world","output.world"]},componentPick:{output:"pick",single:ol,instanced:cl,world:["(place(placement, dequant(input.position)) + draw.offset.xyz)","world"]},box:{output:"color",single:null,instanced:xl,world:[null,"(occurrence.model * vec4f(local, 1.0)).xyz"]},boxPick:{output:"pick",single:null,instanced:vl,world:[null,"(occurrence.model * vec4f(local, 1.0)).xyz"]}}),L1=Object.freeze(Object.keys(El));function Tn(t,e,a=[]){let s=El[t],r=s?.[e?"instanced":"single"];if(!r)throw new Error(`No ${e?"instanced":"one-board"} ${t} shader`);return Ac(r,a,{family:t,instanced:e,output:s.output,world:s.world[e?1:0]})}var D1=Object.freeze({main:Bg,pick:Fg,barrel:Og,barrelPick:Pg,mainInstanced:al,pickInstanced:sl,barrelInstanced:gl,barrelPickInstanced:ml,component:ll,componentInstanced:dl,componentPick:ul,componentPickInstanced:fl,box:wl,boxPick:kl,cull:Bn}),Ug=new Float32Array(256),Aa=class t{static async create(e,{sampleCount:a=4}={}){if(!navigator.gpu)throw new Error("WebGPU is unavailable in this browser");let s=await navigator.gpu.requestAdapter({powerPreference:"high-performance"});if(!s)throw new Error("No WebGPU adapter is available");let r=s.features.has("depth32float-stencil8"),n=await s.requestDevice(r?{requiredFeatures:["depth32float-stencil8"]}:void 0);return new t(e,n,{stencil:r,sampleCount:a})}constructor(e,a,{shareFrom:s=null,stencil:r=!1,sampleCount:n=1}={}){if(this.canvas=e,this.device=a,this.shareFrom=s,this.stencil=s?s.stencil:!!r,this.sampleCount=s?s.sampleCount:n===4?4:1,this.depthFormat=this.stencil?"depth32float-stencil8":"depth32float",this.version=0,this.barrelColor=[.55,.35,.16,.78],this.alwaysInstanced=!!s,this.occurrenceBase=0,s?(this.context=s.context,this.format=s.format):(a.addEventListener("uncapturederror",i=>{console.error(`Uncaptured WebGPU error: ${i.error?.message||i.error}`)}),a.lost.then(i=>{i.reason!=="destroyed"&&console.error(`WebGPU device lost: ${i.reason}`,i.message)}),this.context=e.getContext("webgpu"),this.format=navigator.gpu.getPreferredCanvasFormat(),this.context.configure({device:a,format:this.format,alphaMode:"opaque"})),this.entries=[],this.barrels=null,this.drawSlotCapacity=Rg,this.drawSlotBuffer=this.createDrawSlotBuffer(this.drawSlotCapacity),this.drawStaging=new Float32Array(this.drawSlotCapacity*Qt),this.freeDrawSlots=[],this.nextDrawSlot=0,this.globalBuffer=a.createBuffer({size:qc,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),this.layerOffsetBuffer=a.createBuffer({size:1024,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),this.occurrenceMatrices=[[...Xe]],this.occurrenceKeys=["0"],this.occurrenceHiddenLayers=[[]],this.occurrenceExplode=[null],this.identityOnly=!0,this.occurrenceCapacity=1,this.occurrenceBuffer=this.createOccurrenceBuffer(this.occurrenceCapacity),this.device.queue.writeBuffer(this.occurrenceBuffer,0,Cs(this.occurrenceMatrices)),this.barrelRecordBuffer=a.createBuffer({label:"barrel-records",size:wn,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),this.placementBuffer=a.createBuffer({label:"component-placements",size:En,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),this.componentPipelineSets=new Map,this.instancedPipelines=null,this.shaderFeatures=[],this.shaderFeatureKey="",this.featurePipelineSets=new Map,this.pipelineSetKinds=new WeakMap,this.listBuffer=this.createListBuffer(this.occurrenceCapacity),this.slotCapacity=0,this.slotArgs=new Uint32Array(0),this.slotClasses=new Uint32Array(0),this.freeSlots=[],this.nextSlot=2,this.argsBuffer=null,this.classesBuffer=null,this.growSlots(256),this.setSlot(0,0,4),this.setSlot(1,0,4),this.cull=null,this.box=null,this.boardBounds=null,this.selectedOccurrence=-1,this.lodOverride=null,this.lodThresholds={...Jt},this.innerCopperAtFull=!0,this.innerCopperMode="all",this.cullCounts={full:0,board:0,body:0,box:0,culled:0},this.frameStats={triangles:0,draws:0},this.boxColor=[.24,.36,.28,1],s)for(let i of["bindGroupLayout","pipelineLayout","vertexBuffers","pipeline","pickPipeline","barrelPipeline","barrelPickPipeline","singlePipelines"])this[i]=s[i];else this.createSinglePipelines();this.depth=null,this.colorTarget=null,this.pickDepth=null,this.pickTexture=null,this.insetColor=null,this.pickSerial=Promise.resolve(),this.bundleCache=new Map,this.globalScratch=new ArrayBuffer(qc),this.globalScratchF32=new Float32Array(this.globalScratch),this.globalScratchView=new DataView(this.globalScratch),this.barrelDrawScratch=new Float32Array(et/4),this.nextEntryId=1,this.hiddenFeatureIds=new Set,this.showPlaceholders=!0,this.hiddenBoardLayers=new Set,this.featureMaskCapacity=64,this.featureMaskBuffer=this.createFeatureMaskBuffer(this.featureMaskCapacity),this.uploadFeatureMask(),this.emphasizedNetIds=new Set,this.occurrenceEmphasis=null,this.emphasisStride=0,this.dimCopper=!1,this.netMaskCapacity=64,this.netMaskBuffer=this.createNetMaskBuffer(this.netMaskCapacity),this.uploadNetMask(),s&&this.setOccurrences([])}createSinglePipelines(){let e=this.device;this.bindGroupLayout=e.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}},{binding:1,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}},{binding:2,visibility:GPUShaderStage.VERTEX,buffer:{type:"read-only-storage"}},{binding:3,visibility:GPUShaderStage.FRAGMENT,buffer:{type:"read-only-storage"}},{binding:4,visibility:GPUShaderStage.FRAGMENT,buffer:{type:"read-only-storage"}},{binding:5,visibility:GPUShaderStage.VERTEX,buffer:{type:"read-only-storage"}},{binding:6,visibility:GPUShaderStage.VERTEX,buffer:{type:"read-only-storage"}},{binding:7,visibility:GPUShaderStage.VERTEX,buffer:{type:"read-only-storage"}},{binding:8,visibility:GPUShaderStage.VERTEX,buffer:{type:"read-only-storage"}}]});let a=e.createPipelineLayout({bindGroupLayouts:[this.bindGroupLayout]});this.pipelineLayout=a;let s=this.vertexBuffers=[{arrayStride:_n,attributes:[{shaderLocation:0,offset:0,format:"unorm16x4"},{shaderLocation:1,offset:8,format:"snorm8x4"},{shaderLocation:2,offset:12,format:"uint32"},{shaderLocation:3,offset:16,format:"uint32"}]}];this.singlePipelines=this.makePipelineSet(!1,[]),this.pipeline=this.singlePipelines.main,this.pickPipeline=this.singlePipelines.pick,this.barrelPipeline=this.singlePipelines.barrel,this.barrelPickPipeline=this.singlePipelines.barrelPick}makeMainPipelines(e,a){let s=this.pipelineLayout,r=this.vertexBuffers,n=(c,l)=>this.makePipeline(s,e,this.format,r,`${c}${a}`,l),i=n("main",{stencil:Wc}),o=n("main-blend");return{main:i,mark:this.stencil?n("main-mark",{stencil:Ig}):i,blend:o,translucent:n("main-translucent",{depthWrite:!1,cullMode:"back"}),mask:this.stencil?n("mask",{stencil:Ng}):o,maskCovered:this.stencil?n("mask-covered",{stencil:Cg,constants:{COVERED:1}}):null}}createOccurrenceBuffer(e){return this.device.createBuffer({label:"occurrences",size:e*160,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST})}createListBuffer(e){return this.device.createBuffer({label:"visible-occurrences",size:e*4*Uint32Array.BYTES_PER_ELEMENT,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST})}growSlots(e){let a=new Uint32Array(e*5);a.set(this.slotArgs);let s=new Uint32Array(e).fill(4);s.set(this.slotClasses),this.slotArgs=a,this.slotClasses=s,this.slotCapacity=e,this.argsBuffer?.destroy?.(),this.classesBuffer?.destroy?.(),this.argsBuffer=this.device.createBuffer({label:"indirect-args",size:a.byteLength,usage:GPUBufferUsage.INDIRECT|GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),this.classesBuffer=this.device.createBuffer({label:"draw-classes",size:s.byteLength,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),this.device.queue.writeBuffer(this.argsBuffer,0,a),this.device.queue.writeBuffer(this.classesBuffer,0,s),this.cull&&(this.cull.bindGroup=this.makeCullBindGroup()),this.bundleCache?.clear()}setSlot(e,a,s){this.slotArgs.fill(0,e*5,e*5+5),this.slotArgs[e*5]=a,this.slotClasses[e]=s,this.device.queue.writeBuffer(this.argsBuffer,e*20,this.slotArgs,e*5,5),this.device.queue.writeBuffer(this.classesBuffer,e*4,this.slotClasses,e,1)}allocSlot(e,a){let s=this.freeSlots.length?this.freeSlots.pop():this.nextSlot++;return s>=this.slotCapacity&&this.growSlots(this.slotCapacity*2),this.setSlot(s,e,a),s}get occurrenceCount(){return this.occurrenceMatrices.length}setOccurrences(e){let{matrices:a,keys:s,hiddenLayers:r,explode:n}=kc(e??[Xe]);this.occurrenceMatrices=a,this.occurrenceKeys=s,this.occurrenceHiddenLayers=r,this.occurrenceExplode=n,this.identityOnly=!this.alwaysInstanced&&a.length===1&&wc(a[0]),this.identityOnly||this.ensureInstancedPipelines(),a.length>this.occurrenceCapacity&&(this.occurrenceBuffer?.destroy?.(),this.listBuffer?.destroy?.(),this.occurrenceCapacity=Math.max(a.length,this.occurrenceCapacity*2),this.occurrenceBuffer=this.createOccurrenceBuffer(this.occurrenceCapacity),this.listBuffer=this.createListBuffer(this.occurrenceCapacity),this.cull&&(this.cull.lods.destroy(),this.cull.lods=this.createLodBuffer(this.occurrenceCapacity)),this.rebindAll()),a.length&&this.device.queue.writeBuffer(this.occurrenceBuffer,0,Cs(a,r,n)),this.cull&&this.device.queue.writeBuffer(this.cull.lods,0,new Uint32Array(this.occurrenceCapacity).fill(hn)),this.selectedOccurrence>=a.length&&(this.selectedOccurrence=-1),this.bundleCache.clear(),this.invalidate()}setOccurrenceHiddenLayers(e){this.occurrenceHiddenLayers=this.occurrenceMatrices.map((a,s)=>[...e?.[s]||[]].map(Number)),this.writeOccurrenceRecords()}setOccurrenceExplode(e){this.occurrenceExplode=this.occurrenceMatrices.map((a,s)=>e?.[s]?[...e[s]].map(Number):null),this.writeOccurrenceRecords()}writeOccurrenceRecords(){this.occurrenceMatrices.length&&this.device.queue.writeBuffer(this.occurrenceBuffer,0,Cs(this.occurrenceMatrices,this.occurrenceHiddenLayers,this.occurrenceExplode)),this.invalidate()}setInnerCopperMode(e){this.setInnerCopperAtFull(!1),this.innerCopperMode!==e&&(this.innerCopperMode=e,this.invalidate())}setInnerCopperAtFull(e){if(this.innerCopperAtFull!==e){this.innerCopperAtFull=e;for(let a of this.entries)a.innerCopper&&(a.drawClass=Yc(a,e),this.setSlot(a.slot,a.indexCount,a.drawClass));this.invalidate()}}setBoardBounds(e){this.boardBounds=e?[...e]:null,this.invalidate()}setLodThresholds(e){this.lodThresholds=Mc({...this.lodThresholds,...e}),this.invalidate()}setAnalytic(e){this.analytic&&this.analytic!==e&&this.analytic.destroy(),this.analytic=e||null,this.bundleCache.clear(),this.invalidate()}setLodOverride(e){this.lodOverride=e==null?null:Number(e),this.invalidate()}createLodBuffer(e){return this.device.createBuffer({label:"occurrence-lods",size:e*Uint32Array.BYTES_PER_ELEMENT,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST})}createCull(){let e=this.device,a=this.shareFrom?.cull,s=i=>({visibility:GPUShaderStage.COMPUTE,buffer:{type:i}}),r=a?.layout||e.createBindGroupLayout({label:"cull",entries:[{binding:0,visibility:GPUShaderStage.COMPUTE,buffer:{type:"uniform"}},{binding:1,...s("read-only-storage")},{binding:2,...s("storage")},{binding:3,...s("storage")},{binding:4,...s("storage")},{binding:5,...s("storage")},{binding:6,...s("read-only-storage")}]}),n=a&&{layout:r,classify:a.classify,writeArgs:a.writeArgs};if(!n){let i=this.createShaderModule(Bn,"cull"),o=e.createPipelineLayout({bindGroupLayouts:[r]});n={layout:r,classify:e.createComputePipeline({layout:o,compute:{module:i,entryPoint:"classify"}}),writeArgs:e.createComputePipeline({layout:o,compute:{module:i,entryPoint:"writeArgs"}})}}this.cull={...n,uniform:e.createBuffer({label:"cull-params",size:192,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),lods:this.createLodBuffer(this.occurrenceCapacity),counters:e.createBuffer({label:"cull-counters",size:16,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST}),readback:e.createBuffer({label:"cull-readback",size:16,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}),scratch:new ArrayBuffer(192),reading:!1,readAt:0,bindGroup:null},e.queue.writeBuffer(this.cull.lods,0,new Uint32Array(this.occurrenceCapacity).fill(hn)),this.cull.bindGroup=this.makeCullBindGroup()}makeCullBindGroup(){return this.device.createBindGroup({layout:this.cull.layout,entries:[{binding:0,resource:{buffer:this.cull.uniform}},{binding:1,resource:{buffer:this.occurrenceBuffer}},{binding:2,resource:{buffer:this.cull.lods}},{binding:3,resource:{buffer:this.listBuffer}},{binding:4,resource:{buffer:this.cull.counters}},{binding:5,resource:{buffer:this.argsBuffer}},{binding:6,resource:{buffer:this.classesBuffer}}]})}createBox(){let e=[[[1,0,0],[[1,0,0],[1,1,0],[1,1,1],[1,0,1]]],[[-1,0,0],[[0,0,0],[0,0,1],[0,1,1],[0,1,0]]],[[0,1,0],[[0,1,0],[0,1,1],[1,1,1],[1,1,0]]],[[0,-1,0],[[0,0,0],[1,0,0],[1,0,1],[0,0,1]]],[[0,0,1],[[0,0,1],[1,0,1],[1,1,1],[0,1,1]]],[[0,0,-1],[[0,0,0],[0,1,0],[1,1,0],[1,0,0]]]],a=[],s=[];e.forEach(([l,f],u)=>{for(let p of f)a.push(...p,...l);let g=u*4;s.push(g,g+1,g+2,g,g+2,g+3)});let r=new Float32Array(a),n=new Uint16Array(s),i=this.device.createBuffer({label:"box-vertices",size:r.byteLength,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST}),o=this.device.createBuffer({label:"box-indices",size:n.byteLength,usage:GPUBufferUsage.INDEX|GPUBufferUsage.COPY_DST});this.device.queue.writeBuffer(i,0,r),this.device.queue.writeBuffer(o,0,n);let c=this.device.createBuffer({size:et,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});this.box={vertexBuffer:i,indexBuffer:o,indexCount:n.length,drawBuffer:c,bindGroup:this.makeBindGroup(c),scratch:new Float32Array(et/4)},this.setSlot(1,n.length,3)}writeBoxDraw(){let e=this.box.scratch,[a,s,r,n,i,o]=this.boardBounds;e.fill(0),e.set(this.boxColor,0),e.set([n-a,i-s,o-r,0],4),e.set([a,s,r,0],8),this.device.queue.writeBuffer(this.box.drawBuffer,0,e)}encodeCull(e,a){let s=this.cull,r=new Float32Array(s.scratch),n=new Uint32Array(s.scratch);r.fill(0),_c(a.matrix).forEach((d,m)=>r.set(d,m*4));let i=a.lod;i&&r.set([...i.eye,i.orthographic?0:1],24);let o=this.boardBounds||[-1e6,-1e6,-1e6,1e6,1e6,1e6];r.set([o[0],o[1],o[2],0,o[3],o[4],o[5],0],28);let{fullPx:c,boardPx:l,boxPx:f,keep:u}=this.lodThresholds;r.set([i?.pixelScale||0,c,f,u],36);let g=this.lodOverride!=null?this.lodOverride+1:!i||!this.boardBounds?Tc+1:0;n.set([this.occurrenceMatrices.length,this.selectedOccurrence+1,g,this.nextSlot],40),n[44]=this.barrels?.instanceCount||0,r[45]=l,this.device.queue.writeBuffer(s.uniform,0,s.scratch),e.clearBuffer(s.counters);let p=e.beginComputePass({label:"cull"});p.setBindGroup(0,s.bindGroup),p.setPipeline(s.classify),p.dispatchWorkgroups(Math.ceil(this.occurrenceMatrices.length/64)),p.setPipeline(s.writeArgs),p.dispatchWorkgroups(Math.ceil(this.nextSlot/64)),p.end();let h=performance.now();return!s.reading&&h-s.readAt>250?(e.copyBufferToBuffer(s.counters,0,s.readback,0,16),s.readAt=h,!0):!1}readCullCounts(){let e=this.cull;e.reading=!0;let a=this.occurrenceMatrices.length;e.readback.mapAsync(GPUMapMode.READ).then(()=>{let[s,r,n,i]=new Uint32Array(e.readback.getMappedRange().slice(0));e.readback.unmap(),this.cullCounts={full:s,board:r-s,body:n-r,box:i,culled:Math.max(0,a-n-i)}}).catch(()=>{}).finally(()=>{e.reading=!1})}countFor(e){if(this.identityOnly)return e===2?this.barrels?.instanceCount||0:e===3?0:1;let{full:a,board:s,body:r,box:n}=this.cullCounts;return e===5?a+s+r:e===0?a+s:e===1?a:e===2?(a+s)*(this.barrels?.instanceCount||0):n}gpuMemoryBytes(){let e=0;for(let a of this.entries)e+=(a.vertexAllocation?.size||0)+(a.indexAllocation?.size||0);this.shareFrom||(e+=this.arenaSlackBytes());for(let a of[this.barrels?.vertexBuffer,this.barrels?.indexBuffer,this.barrels?.instanceBuffer,this.barrelRecordBuffer,this.occurrenceBuffer,this.listBuffer,this.argsBuffer,this.classesBuffer,this.featureMaskBuffer,this.netMaskBuffer,this.cull?.lods])e+=a?.size||0;return e+=this.analytic?.gpuMemoryBytes()||0,e+=this.canvas.width*this.canvas.height*12,e}gpuMemoryBreakdown(){let e={},a=0,s=0;for(let c of this.entries){let l=c.vertexAllocation?.size||0,f=c.indexAllocation?.size||0;a+=l,s+=f;let u=c.kind==="copper"?`copper:${c.layerId??"?"}`:c.boardRole?`${c.kind}:${c.boardRole}`:c.kind||"other";e[u]=(e[u]||0)+l+f}let r=[this.barrels?.vertexBuffer,this.barrels?.indexBuffer,this.barrels?.instanceBuffer,this.barrelRecordBuffer].reduce((c,l)=>c+(l?.size||0),0),n=[this.occurrenceBuffer,this.listBuffer,this.argsBuffer,this.classesBuffer,this.featureMaskBuffer,this.netMaskBuffer,this.cull?.lods].reduce((c,l)=>c+(l?.size||0),0),i=this.shareFrom?null:this.arenaStats(),o=this.analytic?.gpuMemoryBytes()||0;return{vertex:a,index:s,geometry:e,barrels:r,occurrences:n,analytic:o,targets:this.canvas.width*this.canvas.height*12,entries:this.entries.length,arena:i}}ensureInstancedPipelines(){if(!this.instancedPipelines){if(this.shareFrom){this.shareFrom.ensureInstancedPipelines(),this.instancedPipelines=this.shareFrom.instancedPipelines,this.createBox(),this.createCull();return}this.instancedPipelines=this.makePipelineSet(!0,[]),this.createBox(),this.createCull()}}makePipelineSet(e,a){let s=this.pipelineLayout,r=pn(a),n=l=>Tn(l,e,a),i=r?`+${r}`:"",o=`${e?"-instanced":""}${i}`,c={...this.makeMainPipelines(n("main"),o),pick:this.makePipeline(s,n("pick"),It,this.vertexBuffers,`pick${o}`),barrel:this.makeBarrelPipeline(s,n("barrel"),this.format,`barrel${o}`,!e),barrelPick:this.makeBarrelPipeline(s,n("barrelPick"),It,`barrel-pick${o}`,!e)};return e&&(c.box=this.makePipeline(s,n("box"),this.format,$c,`box${i}`),c.boxPick=this.makePipeline(s,n("boxPick"),It,$c,`box-pick${i}`)),this.pipelineSetKinds.set(c,{instanced:e,features:Ma(a),key:r}),c}setShaderFeatures(e=[]){let a=Ma(e),s=pn(a);s!==this.shaderFeatureKey&&(this.shaderFeatures=a,this.shaderFeatureKey=s,this.bundleCache.clear(),this.invalidate())}pipelinesFor(e){let a=this.shareFrom||this;if(e&&this.ensureInstancedPipelines(),!this.shaderFeatureKey)return e?a.instancedPipelines:a.singlePipelines;let s=`${e?"instanced":"single"}|${this.shaderFeatureKey}`,r=a.featurePipelineSets.get(s);return r||(r=a.makePipelineSet(e,this.shaderFeatures),a.featurePipelineSets.set(s,r)),r}drawSet(){return this.identityOnly?{pipelines:this.pipelinesFor(!1),indirect:!1,barrelInstances:this.barrels?.instanceCount||0}:{pipelines:this.pipelinesFor(!0),indirect:!0,barrelInstances:0}}drawEntry(e,a,s){e.setBindGroup(0,a.bindGroup);let r=a.vertexAllocation,n=a.indexAllocation;e.setVertexBuffer(0,r.buffer,r.offset,r.size),e.setIndexBuffer(n.buffer,a.indexFormat,n.offset,n.size),s?e.drawIndexedIndirect(this.argsBuffer,a.slot*20):e.drawIndexed(a.indexCount,a.placementCount||1)}drawBarrels(e,a,s,r){e.setPipeline(a),e.setBindGroup(0,this.barrels.bindGroup),e.setVertexBuffer(0,this.barrels.vertexBuffer),e.setVertexBuffer(1,this.barrels.instanceBuffer),e.setIndexBuffer(this.barrels.indexBuffer,"uint16"),s?e.drawIndexedIndirect(this.argsBuffer,0):e.drawIndexed(this.barrels.indexCount,r)}drawBox(e,a){!this.box||!this.boardBounds||(this.writeBoxDraw(),e.setPipeline(a),e.setBindGroup(0,this.box.bindGroup),e.setVertexBuffer(0,this.box.vertexBuffer),e.setIndexBuffer(this.box.indexBuffer,"uint16"),e.drawIndexedIndirect(this.argsBuffer,20))}createNetMaskBuffer(e){return this.device.createBuffer({label:"net-emphasis-mask",size:e*Uint32Array.BYTES_PER_ELEMENT,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST})}uploadNetMask(){let e;if(this.occurrenceEmphasis&&!this.identityOnly){let s=ho(this.occurrenceEmphasis);this.emphasisStride=s.stride,e=s.data}else this.emphasisStride=0,e=lo(this.emphasizedNetIds,this.netMaskCapacity);if(e.length>this.netMaskCapacity){this.netMaskBuffer?.destroy?.();let s=this.netMaskCapacity;for(;s<e.length;)s*=2;this.netMaskCapacity=s,this.netMaskBuffer=this.createNetMaskBuffer(s),this.rebindAll()}let a=new Uint32Array(this.netMaskCapacity);a.set(e),this.device.queue.writeBuffer(this.netMaskBuffer,0,a)}setOccurrenceEmphasis(e,{dimCopper:a=!1}={}){let s=Array.isArray(e)&&e.some(r=>r&&r.size);this.occurrenceEmphasis=s?e.map(r=>r&&r.size?new Map(r):null):null,this.dimCopper=!!a,this.uploadNetMask(),this.invalidate()}get netHighlightActive(){return!!(this.emphasizedNetIds.size||this.occurrenceEmphasis||this.dimCopper)}setEmphasizedNetIds(e){this.emphasizedNetIds=gs(e),this.occurrenceEmphasis=null;let a=co(this.emphasizedNetIds,this.netMaskCapacity);a!==this.netMaskCapacity&&(this.netMaskBuffer?.destroy?.(),this.netMaskCapacity=a,this.netMaskBuffer=this.createNetMaskBuffer(a),this.rebindAll()),this.uploadNetMask(),this.invalidate()}rebindAll(){for(let e of this.entries)e.bindGroup=this.makeBindGroup(this.drawSlotBuffer,e.drawSlot*et);this.barrels&&(this.barrels.bindGroup=this.makeBindGroup(this.barrels.drawBuffer)),this.box&&(this.box.bindGroup=this.makeBindGroup(this.box.drawBuffer)),this.cull&&(this.cull.bindGroup=this.makeCullBindGroup()),this.bundleCache.clear()}createFeatureMaskBuffer(e){return this.device.createBuffer({label:"feature-visibility-mask",size:e*Uint32Array.BYTES_PER_ELEMENT,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST})}createDrawSlotBuffer(e){return this.device.createBuffer({label:"draw-uniforms",size:e*et,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST})}allocateDrawSlot(){if(this.freeDrawSlots.length)return this.freeDrawSlots.pop();if(this.nextDrawSlot>=this.drawSlotCapacity){let e=this.drawSlotCapacity*2,a=new Float32Array(e*Qt);a.set(this.drawStaging),this.drawSlotBuffer.destroy?.(),this.drawSlotCapacity=e,this.drawSlotBuffer=this.createDrawSlotBuffer(e),this.drawStaging=a,this.rebindAll()}return this.nextDrawSlot++}flushDraws(e){if(!e.length)return;let a=1/0,s=-1;for(let r of e)a=Math.min(a,r.drawSlot),s=Math.max(s,r.drawSlot);this.device.queue.writeBuffer(this.drawSlotBuffer,a*et,this.drawStaging,a*Qt,(s-a+1)*Qt)}invalidate(){this.version+=1}setBarrelColor(e){this.barrelColor=[...e],this.invalidate()}makeBindGroup(e,a=0){return this.device.createBindGroup({layout:this.bindGroupLayout,entries:[{binding:0,resource:{buffer:this.globalBuffer}},{binding:1,resource:{buffer:e,offset:a,size:et}},{binding:2,resource:{buffer:this.layerOffsetBuffer}},{binding:3,resource:{buffer:this.featureMaskBuffer}},{binding:4,resource:{buffer:this.netMaskBuffer}},{binding:5,resource:{buffer:this.occurrenceBuffer}},{binding:6,resource:{buffer:this.barrelRecordBuffer}},{binding:7,resource:{buffer:this.listBuffer}},{binding:8,resource:{buffer:this.placementBuffer}}]})}uploadFeatureMask(){let e=Nc(this.hiddenFeatureIds,this.featureMaskCapacity);this.device.queue.writeBuffer(this.featureMaskBuffer,0,e)}setHiddenFeatureIds(e){this.hiddenFeatureIds=Bs(e);let a=Ic(this.hiddenFeatureIds,this.featureMaskCapacity);a!==this.featureMaskCapacity&&(this.featureMaskBuffer?.destroy?.(),this.featureMaskCapacity=a,this.featureMaskBuffer=this.createFeatureMaskBuffer(a),this.rebindAll()),this.uploadFeatureMask(),this.bundleCache.clear(),this.invalidate()}depthStencilState(e=null,a=!0){let s={format:this.depthFormat,depthWriteEnabled:a,depthCompare:"greater"};return this.stencil&&e&&(s.stencilFront=e,s.stencilBack=e),s}makePipeline(e,a,s,r,n,i={}){let o=this.createShaderModule(a,n);return this.device.createRenderPipeline({layout:e,vertex:{module:o,entryPoint:"vs",buffers:r},fragment:{module:o,entryPoint:"fs",...i.constants?{constants:i.constants}:{},targets:[{format:s,blend:s===It?void 0:{color:{srcFactor:"src-alpha",dstFactor:"one-minus-src-alpha"},alpha:{srcFactor:"one",dstFactor:"one-minus-src-alpha"}}}]},primitive:{topology:"triangle-list",cullMode:i.cullMode??"none"},depthStencil:this.depthStencilState(i.stencil,i.depthWrite??!0),multisample:{count:this.samplesFor(s)}})}makeBarrelPipeline(e,a,s,r,n=!0){let i=this.createShaderModule(a,r);return this.device.createRenderPipeline({layout:e,vertex:{module:i,entryPoint:"vs",buffers:[{arrayStride:28,attributes:[{shaderLocation:0,offset:0,format:"float32x3"},{shaderLocation:1,offset:12,format:"float32x3"},{shaderLocation:2,offset:24,format:"float32"}]},...n?[Fc]:[]]},fragment:{module:i,entryPoint:"fs",targets:[{format:s,blend:s===It?void 0:{color:{srcFactor:"src-alpha",dstFactor:"one-minus-src-alpha"},alpha:{srcFactor:"one",dstFactor:"one-minus-src-alpha"}}}]},primitive:{topology:"triangle-list",cullMode:"none"},depthStencil:this.depthStencilState(),multisample:{count:this.samplesFor(s)}})}samplesFor(e){return e===It?1:this.sampleCount}createShaderModule(e,a){let s=this.device.createShaderModule({label:`pcb-${a}`,code:e});return typeof s.getCompilationInfo=="function"&&s.getCompilationInfo().then(r=>{let n=[...r.messages||[]];if(n.length){console.groupCollapsed(`WebGPU shader compilation info: pcb-${a}`);for(let i of n)console[i.type==="error"?"error":"warn"](`${i.type} ${i.lineNum}:${i.linePos} ${i.message}`);console.groupEnd()}}),s}resize(){let e=Math.min(devicePixelRatio||1,2),a=Math.max(1,Math.floor(this.canvas.clientWidth*e)),s=Math.max(1,Math.floor(this.canvas.clientHeight*e));if(this.canvas.width===a&&this.canvas.height===s)return;this.canvas.width=a,this.canvas.height=s,this.depth?.destroy(),this.colorTarget?.destroy(),this.pickDepth?.destroy(),this.pickTexture?.destroy();let r=this.sampleCount;this.depth=this.device.createTexture({label:"depth",size:[a,s],format:this.depthFormat,sampleCount:r,usage:GPUTextureUsage.RENDER_ATTACHMENT}),this.colorTarget=r>1?this.device.createTexture({label:"color-msaa",size:[a,s],format:this.format,sampleCount:r,usage:GPUTextureUsage.RENDER_ATTACHMENT}):null,this.pickDepth=r>1?this.device.createTexture({label:"pick-depth",size:[a,s],format:this.depthFormat,usage:GPUTextureUsage.RENDER_ATTACHMENT}):this.depth,this.pickTexture=this.device.createTexture({size:[a,s],format:It,usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.COPY_SRC})}addPrimitive(e,a){let s=e.position.length/3,r=new ArrayBuffer(s*_n),n=new Uint32Array(r),i=new Uint16Array(r),o=new Int8Array(r),c=Gg(e.position);for(let y=0;y<s;y+=1){let x=y*5,w=y*3;Kg(i,x*2,e.position,w,c),Vg(o,(x+2)*4,e.normal,w),n[x+3]=e.netId[y]||0,n[x+4]=e.objectFeatureId[y]||0}let l=this.arenas(),f=l.vertex.alloc(r.byteLength);l.vertex.write(f,r);let{indices:u,format:g}=Hg(e.indices,s),p=l.index.alloc(u.byteLength);l.index.write(p,u);let h=this.allocateDrawSlot(),d=this.makeBindGroup(this.drawSlotBuffer,h*et),m=Yc(a,this.innerCopperAtFull),b={...a,drawClass:m,slot:this.allocSlot(e.indices.length,a.placements?Lg|a.placements<<3:m),placementCount:a.placements||0,placementBase:0,bounds:e.bounds||a.bounds||null,id:this.nextEntryId++,vertexAllocation:f,indexAllocation:p,quantMin:c.min,quantSize:c.size,indexFormat:g,indexCount:e.indices.length,drawSlot:h,bindGroup:d};return this.entries.push(b),this.bundleCache.clear(),this.invalidate(),b}arenas(){let e=this.shareFrom||this;return e.geometryArenas??={vertex:new Ta(e.device,GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST,"geometry-vertices"),index:new Ta(e.device,GPUBufferUsage.INDEX|GPUBufferUsage.COPY_DST,"geometry-indices")},e.geometryArenas}arenaSlackBytes(){let e=this.geometryArenas;return e?e.vertex.reservedBytes()-e.vertex.usedBytes+e.index.reservedBytes()-e.index.usedBytes:0}arenaStats(){let e=this.geometryArenas;if(!e)return{chunks:0,reserved:0,used:0};let a=s=>s.chunks.reduce((r,n)=>r+n.free.filter(i=>i.offset+i.size<n.size).reduce((i,o)=>i+o.size,0),0);return{chunks:e.vertex.chunks.length+e.index.chunks.length,reserved:e.vertex.reservedBytes()+e.index.reservedBytes(),used:e.vertex.usedBytes+e.index.usedBytes,holes:a(e.vertex)+a(e.index)}}componentPipelines(e){let a=this.shareFrom||this,s=a.componentPipelineSets.get(e);if(!s){let{instanced:r,features:n,key:i}=a.pipelineSetKinds.get(e),o=a.pipelineLayout,c=a.vertexBuffers,l=Tn("component",r,n),f=Tn("componentPick",r,n),u=`${r?"-instanced":""}${i?`+${i}`:""}`;s={main:a.makePipeline(o,l,a.format,c,`component${u}`,{stencil:Wc}),blend:a.makePipeline(o,l,a.format,c,`component-blend${u}`),pick:a.makePipeline(o,f,It,c,`component-pick${u}`)},a.componentPipelineSets.set(e,s)}return s}addInstancedPrimitives(e){let a=e.map(({primitive:s,placements:r,metadata:n})=>{let i=this.addPrimitive(s,{...n,placements:r.length});return i.placementRecords=r,i});return this.writePlacements(),a}writePlacements(){let e=this.entries.filter(o=>o.placementRecords),a=e.reduce((o,c)=>o+c.placementRecords.length,0),s=new ArrayBuffer(Math.max(1,a)*En),r=new Float32Array(s),n=new Uint32Array(s),i=0;for(let o of e){o.placementBase=i;for(let c of o.placementRecords){let l=i*(En/4);r.set(c.rows,l),n[l+12]=c.featureId||0,i+=1}}this.placementBuffer.size<s.byteLength&&(this.placementBuffer.destroy?.(),this.placementBuffer=this.device.createBuffer({label:"component-placements",size:s.byteLength,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),this.rebindAll()),this.device.queue.writeBuffer(this.placementBuffer,0,s),this.invalidate()}removeEntries(e){if(!e?.length)return;let a=new Set(e.map(s=>s.id));for(let s of e){let r=this.arenas();s.vertexAllocation&&r.vertex.free(s.vertexAllocation),s.indexAllocation&&r.index.free(s.indexAllocation),this.freeDrawSlots.push(s.drawSlot),s.slot!=null&&(this.setSlot(s.slot,0,4),this.freeSlots.push(s.slot))}this.entries=this.entries.filter(s=>!a.has(s.id)),e.some(s=>s.placementRecords)&&this.writePlacements(),this.bundleCache.clear(),this.invalidate()}dispose(){this.removeEntries(this.entries),this.shareFrom||(this.geometryArenas?.vertex.destroy(),this.geometryArenas?.index.destroy(),this.geometryArenas=null),this.barrels&&(this.barrels.vertexBuffer?.destroy?.(),this.barrels.indexBuffer?.destroy?.(),this.barrels.instanceBuffer?.destroy?.(),this.barrels.drawBuffer?.destroy?.(),this.barrels=null),this.depth?.destroy(),this.colorTarget?.destroy(),this.pickDepth!==this.depth&&this.pickDepth?.destroy(),this.insetColor?.texture.destroy(),this.pickTexture?.destroy(),this.featureMaskBuffer?.destroy?.(),this.occurrenceBuffer?.destroy?.(),this.barrelRecordBuffer?.destroy?.(),this.listBuffer?.destroy?.(),this.argsBuffer?.destroy?.(),this.classesBuffer?.destroy?.();for(let e of[this.box?.vertexBuffer,this.box?.indexBuffer,this.box?.drawBuffer,this.cull?.uniform,this.cull?.lods,this.cull?.counters,this.cull?.readback])e?.destroy?.();this.box=null,this.cull=null,this.drawSlotBuffer?.destroy?.(),this.depth=null,this.colorTarget=null,this.pickDepth=null,this.insetColor=null,this.pickTexture=null,this.featureMaskBuffer=null,this.bundleCache.clear()}setBarrels(e){if(!e?.length)return;let a=Qc,s=[],r=[],n=(d,m,b)=>{let y=s.length/7;for(let x=0;x<a;x+=1){let w=Math.PI*2*(x+.5)/a,E=Math.cos(w),T=Math.sin(w),[_,S,N]=b(E,T);s.push(E,T,m,_,S,N,d)}return y},i=(d,m)=>{for(let b=0;b<a;b+=1){let y=(b+1)%a;r.push(d+b,d+y,m+y,d+b,m+y,m+b)}};for(let d of[0,1]){let m=d?(b,y)=>[-b,-y,0]:(b,y)=>[b,y,0];i(n(d,0,m),n(d,1,m))}for(let[d,m]of[[0,1],[1,-1]]){let b=()=>[0,0,m];i(n(0,d,b),n(2,d,b))}let o=new Float32Array(s),c=new Uint16Array(r),l=jc(e),f=this.device.createBuffer({size:o.byteLength,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST}),u=this.device.createBuffer({size:c.byteLength,usage:GPUBufferUsage.INDEX|GPUBufferUsage.COPY_DST}),g=this.device.createBuffer({size:l.byteLength,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST});this.device.queue.writeBuffer(f,0,o),this.device.queue.writeBuffer(u,0,c),this.device.queue.writeBuffer(g,0,l);let p=Lc(e);this.barrelRecordBuffer?.destroy?.(),this.barrelRecordBuffer=this.device.createBuffer({label:"barrel-records",size:p.byteLength,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),this.device.queue.writeBuffer(this.barrelRecordBuffer,0,p);let h=this.device.createBuffer({size:et,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});this.barrels={records:e,vertexBuffer:f,indexBuffer:u,instanceBuffer:g,indexCount:c.length,instanceCount:e.length,drawBuffer:h,bindGroup:null},this.setSlot(0,c.length,2),this.rebindAll(),this.invalidate()}render(e){let{panels:a,layerOffsets:s}=e;this.resize(),this.device.queue.writeBuffer(this.layerOffsetBuffer,0,s);let r=this.context.getCurrentTexture().createView(),n=0,i=0;a.forEach((o,c)=>{let l=this.device.createCommandEncoder(),f=!this.identityOnly&&this.encodeCull(l,o),u=l.beginRenderPass({colorAttachments:[this.colorAttachment(r,c===0,c===a.length-1)],depthStencilAttachment:this.depthAttachment()}),g=Mn(o.viewport,this.canvas.width,this.canvas.height);u.setViewport(g.x,g.y,g.width,g.height,0,1),u.setScissorRect(g.x,g.y,g.width,g.height),this.analytic&&(this.analytic.viewport=g);let p=this.encodeDraws(u,o,e);n+=p.triangles,i+=p.draws,u.end(),this.device.queue.submit([l.finish()]),f&&this.readCullCounts()}),this.frameStats={triangles:Math.round(n),draws:i}}analyticFlatLayers(e){if(!this.analytic||!e.compareMode)return[];let a=[];for(let s of e.visibleLayers||[]){let r=this.analytic.layerZ(Number(s));r!==null&&a.push({layerId:Number(s),offset:e.compareOffsets?.get(s)||e.compareOffsets?.get(Number(s))||[0,0,0],z:r})}return a}encodeFlatLayers(e,a,s,r,n){let i=new Map(s.map(l=>[l.layerId,l])),o={matrix:a,flat:i,isolateNet:r,showBoard:!1},c=this.innerCopperMode;this.innerCopperMode="all";try{return this.analytic.encodeInto(e,Ug,new Set(i.keys()),n,o)}finally{this.innerCopperMode=c}}renderInto(e,a,s){if(!this.identityOnly)throw new Error("renderInto: one-board renderer only");let r=this.device.createCommandEncoder({label:"inset"}),n={view:e.depthView,depthClearValue:0,depthLoadOp:"clear",depthStoreOp:"discard"};this.stencil&&Object.assign(n,{stencilClearValue:0,stencilLoadOp:"clear",stencilStoreOp:"discard"});let i=r.beginRenderPass({colorAttachments:[this.colorAttachment(e.colorView,!0,!0,this.insetColorView(e.width,e.height))],depthStencilAttachment:n}),o=Mn(a.viewport,e.width,e.height);i.setViewport(o.x,o.y,o.width,o.height,0,1),i.setScissorRect(o.x,o.y,o.width,o.height),this.analytic&&(this.analytic.viewport=o);let c=this.encodeDraws(i,a,s);return i.end(),this.device.queue.submit([r.finish()]),c}encodeDraws(e,a,{activeNetId:s,selectedFeatureId:r,time:n,visibleLayers:i,showBoard:o,showComponents:c,showPaste:l=!0,componentOpacity:f,boardOpacity:u,isolateNet:g,compareMode:p=!1,compareOffsets:h=new Map,layerAlphas:d=null,visibleTileIds:m=null,layerOffsets:b=null}){let y=0,x=0,w=null;if(this.stencil&&e.setStencilReference(1),this.writeGlobals(a.matrix,s,a.layerId,n,r),this.relief?.ready&&!p)return{triangles:this.relief.vertexCount/3,draws:this.relief.encode(e,a.matrix)};let{pipelines:E,indirect:T,barrelInstances:_}=this.drawSet(),S=!l||!!(s||this.netHighlightActive),N=this.entries.filter(C=>this.visible(C,a.layerId,i,o,c,f,p,m)&&!(S&&C.boardRole==="paste")&&!(C.side&&this.hiddenBoardLayers?.has(`${C.boardRole}:${C.side}`))),R=N.filter(C=>!Ps(C)).sort((C,A)=>+!!C.stencilMark-+!!A.stencilMark),I=N.filter(C=>Ps(C)).sort((C,A)=>Ps(C)-Ps(A));for(let C of N)this.writeDraw(C,s,f,u,g,p,h.get(C.layerId),d?.get(C.layerId)??1);this.flushDraws(N),R.length>64?e.executeBundles([this.renderBundle(R,a.layerId)]):this.drawEntries(e,R,E,T);for(let C of N)y+=C.indexCount/3*this.countFor(C.drawClass)*(C.placementCount||1);if(x+=N.length,this.analytic&&!p&&(w={matrix:a.matrix,showBoard:o,boardOpacity:u,hidePaste:S,isolateNet:g,panelLayer:a.layerId,assemblyOpacity:l?1:f,hiddenBoardLayers:this.hiddenBoardLayers},x+=this.analytic.encodeInto(e,b,a.layerId?new Set([a.layerId]):i,!1,w),x+=this.analytic.encodeBarrels(e,b,a.matrix),x+=this.analytic.encodeArrows(e)),this.analytic&&p){let C=this.analyticFlatLayers({compareMode:p,visibleLayers:i,compareOffsets:h});C.length&&(x+=this.encodeFlatLayers(e,a.matrix,C,g,!1))}return!p&&this.barrels&&!this.analytic?.hasBarrels()&&(a.layerId===0||i.has(a.layerId))&&(this.writeBarrelDraw(g),this.drawBarrels(e,E.barrel,T,_),y+=this.barrels.indexCount/3*this.countFor(2),x+=1),T&&!p&&(this.drawBox(e,E.box),y+=12*this.countFor(3),x+=1),w&&(x+=this.analytic.encodeGhostBarrels(e),x+=this.analytic.encodeBlended(e,b,a.layerId?new Set([a.layerId]):i,w)),this.drawBlended(e,I,E,T),{triangles:y,draws:x}}colorAttachment(e,a=!0,s=!0,r=this.colorTarget?.createView()){let n={view:e,clearValue:{r:.91,g:.93,b:.94,a:1},loadOp:a?"clear":"load",storeOp:"store"};return this.sampleCount===1?n:{...n,view:r,resolveTarget:e,storeOp:s?"discard":"store"}}insetColorView(e,a){if(this.sampleCount!==1){if(this.insetColor?.width!==e||this.insetColor?.height!==a){this.insetColor?.texture.destroy();let s=this.device.createTexture({label:"inset-msaa",size:[e,a],format:this.format,sampleCount:this.sampleCount,usage:GPUTextureUsage.RENDER_ATTACHMENT});this.insetColor={texture:s,view:s.createView(),width:e,height:a}}return this.insetColor.view}}depthAttachment(e=!1){let a={view:(e?this.pickDepth:this.depth).createView(),depthClearValue:0,depthLoadOp:"clear",depthStoreOp:"discard"};return this.stencil&&Object.assign(a,{stencilClearValue:0,stencilLoadOp:"clear",stencilStoreOp:"discard"}),a}drawEntries(e,a,s,r){let n=null;for(let i of a){let o=i.placementCount?this.componentPipelines(s).main:i.stencilMark?s.mark:s.main;o!==n&&(e.setPipeline(o),n=o),this.drawEntry(e,i,r)}}drawBlended(e,a,s,r){for(let n of a)if(n.boardRole==="soldermask"&&n.kind==="board")e.setPipeline(s.mask),this.drawEntry(e,n,r),s.maskCovered&&(e.setPipeline(s.maskCovered),this.drawEntry(e,n,r));else{let i=n.translucent?s.translucent??s.blend:s.blend;e.setPipeline(n.placementCount?this.componentPipelines(s).blend:i),this.drawEntry(e,n,r)}}setPlaceholdersVisible(e){this.showPlaceholders=!!e,this.invalidate()}setHiddenBoardLayers(e){this.hiddenBoardLayers=new Set(e||[]),this.invalidate()}visible(e,a,s,r,n,i,o=!1,c=null){return e.placeholder&&!this.showPlaceholders?!1:o?e.kind==="copper"&&s.has(e.layerId):e.kind==="copper"&&this.analytic?.coversLayer(e.layerId)||e.kind==="board"&&this.analytic?.coversRole(e.boardRole)||e.kind==="board"&&e.boardRole==="pad"||e.kind==="copper"&&c&&!c.has(e.tileId)||e.innerCopper&&this.innerCopperMode==="none"?!1:e.boardRole==="paste"?a===0&&s.has(e.layerId):e.kind==="board"?a===0&&r:e.kind==="component"?a===0&&n&&i>.001:a?e.layerId===a:s.has(e.layerId)}writeGlobals(e,a,s,r,n=0){let i=this.globalScratch,o=this.globalScratchF32;o.fill(0),o.set(e,0);let c=this.globalScratchView;c.setUint32(64,a||0,!0),c.setUint32(68,s||0,!0),c.setFloat32(72,r,!0),c.setFloat32(76,a||this.netHighlightActive?1:0,!0),c.setUint32(80,n||0,!0),c.setUint32(84,this.selectedOccurrence>=0?this.selectedOccurrence+1+this.occurrenceBase:0,!0),c.setUint32(88,this.occurrenceBase,!0),c.setUint32(92,this.emphasisStride,!0),o.set([.35,-.5,.8,0],24),this.device.queue.writeBuffer(this.globalBuffer,0,i)}writeDraw(e,a,s,r=1,n=!1,i=!1,o=null,c=1){let l=this.drawStaging.subarray(e.drawSlot*Qt,(e.drawSlot+1)*Qt);l.fill(0);let f=e.color||e.material.baseColor;l.set(f,0),l.set([e.material.metallic||0,e.material.roughness??.72,e.opacityScale!=null?s:0,zg[e.drawClass]??1],4);let u=Wg(e);l.set([o?.[0]||0,o?.[1]||0,(i?-(e.baseZ||0):e.layerOffset||0)+u,e.kind==="copper"||e.boardRole==="paste"?Number(e.layerId||0)+1:0],8);let g=Number.isFinite(f?.[3])?f[3]:1,p=e.kind==="component"?s*(e.opacityScale??1):e.kind==="board"&&e.boardRole!=="paste"?r*qg(e,g):c,h=e.kind==="copper"?1:e.kind==="component"?2:0,d=n?1:e.innerCopper&&this.innerCopperMode==="lit"?2:0;if(l.set([h,p,d,i?1:0],12),e.placementCount){let m=new Uint32Array(l.buffer,l.byteOffset+64,2);m[0]=e.placementBase,m[1]=e.placementCount}l.set(e.quantMin,20),l.set(e.quantSize,24)}writeBarrelDraw(e=!1){let a=this.barrelDrawScratch;a.fill(0),a.set(this.barrelColor,0),a.set([.75,.32,0,0],4),a.set([1,1,e?1:0,0],12),this.device.queue.writeBuffer(this.barrels.drawBuffer,0,a)}renderBundle(e,a){let{pipelines:s,indirect:r}=this.drawSet(),{vertex:n,index:i}=this.arenas(),o=`${a}:${r?"indirect":"single"}:${this.shaderFeatureKey}:${n.generation}.${i.generation}:${e.map(u=>u.id).join(",")}`,c=this.bundleCache.get(o);if(c)return c;let l=this.device.createRenderBundleEncoder({colorFormats:[this.format],depthStencilFormat:this.depthFormat,sampleCount:this.sampleCount});this.drawEntries(l,e,s,r);let f=l.finish();return this.bundleCache.set(o,f),this.bundleCache.size>32&&this.bundleCache.delete(this.bundleCache.keys().next().value),f}pick(e,a,s,r){let n=this.pickSerial.then(()=>this.performPick(e,a,s,r));return this.pickSerial=n.catch(()=>0),n}async performPick(e,a,s,r){this.resize();let n=Math.max(0,Math.min(this.canvas.width-1,Math.floor(a))),i=Math.max(0,Math.min(this.canvas.height-1,Math.floor(s)));this.device.queue.writeBuffer(this.layerOffsetBuffer,0,r.layerOffsets);let o=this.device.createCommandEncoder(),c=o.beginRenderPass({colorAttachments:[{view:this.pickTexture.createView(),clearValue:{r:0,g:0,b:0,a:0},loadOp:"clear",storeOp:"store"}],depthStencilAttachment:this.depthAttachment(!0)}),l=Mn(e.viewport,this.canvas.width,this.canvas.height);return c.setViewport(l.x,l.y,l.width,l.height,0,1),c.setScissorRect(n,i,1,1),this.analytic&&(this.analytic.viewport=l),this.encodePick(c,e,r),c.end(),this.readPick(o,n,i)}encodePick(e,a,s){if(this.relief?.ready&&!s.compareMode)return;this.writeGlobals(a.matrix,s.activeNetId,a.layerId,performance.now()/1e3,s.selectedFeatureId);let{pipelines:r,indirect:n,barrelInstances:i}=this.drawSet();e.setPipeline(r.pick);let o=[];for(let c of this.entries)this.visible(c,a.layerId,s.visibleLayers,s.showBoard,s.showComponents,s.componentOpacity,s.compareMode,s.visibleTileIds)&&(c.kind==="board"&&(this.identityOnly||c.boardRole!=="substrate")||(this.writeDraw(c,s.activeNetId,s.componentOpacity,s.boardOpacity,s.isolateNet,s.compareMode,s.compareOffsets?.get(c.layerId)),o.push(c)));this.flushDraws(o);for(let c of o)e.setPipeline(c.placementCount?this.componentPipelines(r).pick:r.pick),this.drawEntry(e,c,n);if(!s.compareMode&&this.barrels&&!this.analytic?.hasBarrels()&&(this.writeBarrelDraw(s.isolateNet),this.drawBarrels(e,r.barrelPick,n,i)),n&&!s.compareMode&&this.drawBox(e,r.boxPick),this.analytic&&!s.compareMode){let c=a.layerId?new Set([a.layerId]):s.visibleLayers;this.analytic.encodeInto(e,s.layerOffsets,c,!0,{matrix:a.matrix,panelLayer:a.layerId,isolateNet:s.isolateNet,showBoard:s.showBoard}),this.analytic.encodeBarrels(e,s.layerOffsets,a.matrix,!0)}if(this.analytic&&s.compareMode){let c=this.analyticFlatLayers(s);c.length&&this.encodeFlatLayers(e,a.matrix,c,s.isolateNet,!0)}}async readPick(e,a,s){let r=this.device.createBuffer({label:"pick-readback",size:256,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});e.copyTextureToBuffer({texture:this.pickTexture,origin:{x:a,y:s}},{buffer:r,bytesPerRow:256},{width:1,height:1}),this.device.queue.submit([e.finish()]);try{await r.mapAsync(GPUMapMode.READ);let n=new DataView(r.getMappedRange()),i=n.getUint32(0,!0),o=n.getUint32(4,!0);if(r.unmap(),this.analytic&&i&2147483648&&o)return{kind:"analytic",occurrenceIndex:-1,featureId:0,operationIndex:o-1,occurrenceKey:null};let c=vc(i,o);return{...c,occurrenceKey:c.occurrenceIndex>=0?this.occurrenceKeys[c.occurrenceIndex]??null:null}}finally{r.mapState==="mapped"&&r.unmap(),r.destroy()}}},zg=Object.freeze({0:1,1:0,5:2});function Gg(t){let e=[1/0,1/0,1/0],a=[-1/0,-1/0,-1/0];for(let s=0;s<t.length;s+=3)for(let r=0;r<3;r+=1){let n=t[s+r];n<e[r]&&(e[r]=n),n>a[r]&&(a[r]=n)}return Number.isFinite(e[0])?{min:e,size:e.map((s,r)=>a[r]>s?a[r]-s:1)}:{min:[0,0,0],size:[1,1,1]}}function Kg(t,e,a,s,r){for(let n=0;n<3;n+=1){let i=(a[s+n]-r.min[n])/r.size[n];t[e+n]=Math.max(0,Math.min(65535,Math.round(i*65535)))}t[e+3]=0}function Vg(t,e,a,s){for(let r=0;r<3;r+=1){let n=Number(a[s+r])||0;t[e+r]=Math.max(-127,Math.min(127,Math.round(n*127)))}t[e+3]=0}function Hg(t,e){if(e<=65536){let a=new Uint16Array(t.length+(t.length&1));return a.set(t),{indices:a,format:"uint16"}}return{indices:t instanceof Uint32Array?t:new Uint32Array(t),format:"uint32"}}function Tl(t,e){return t*_n+(t<=65536?(e+(e&1))*2:e*4)}function Yc(t,e){return t.kind==="component"||t.innerCopper&&e?1:t.kind==="board"&&(t.boardRole==="substrate"||t.boardRole==="soldermask")?5:0}function Ps(t){return t.translucent?3:t.kind!=="board"?0:t.boardRole==="soldermask"?1:t.boardRole==="silkscreen"?2:0}function qg(t,e){return t.kind!=="board"||t.boardRole==="substrate"?1:t.boardRole==="soldermask"?Math.min(e,.72):t.boardRole==="silkscreen"?Math.min(e,.92):e}function Wg(t){if(t.kind!=="board"||t.boardRole!=="soldermask"&&t.boardRole!=="silkscreen")return 0;let e=t.bounds,s=(e?(e[2]+e[5])*.5:0)<0?-1:1,r=t.boardRole==="silkscreen"?35e-6:18e-6;return s*r}function Mn(t,e,a){let s=Math.max(0,Math.min(e-1,Math.floor(t.x))),r=Math.max(0,Math.min(a-1,Math.floor(t.y)));return{x:s,y:r,width:Math.max(1,Math.min(e-s,Math.floor(t.width))),height:Math.max(1,Math.min(a-r,Math.floor(t.height)))}}var Xg=`
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
}`,$g=`
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
}`,Yg=`
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
}`,Jg=`
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
}`,Qg=`
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
}`,Zg=`
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
}`,em=`
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
}`,tm=6.2,am=4.6,sm=3.8,Ks=4*1024*1024,rm=Math.floor(Ks/6),Ml=rm*6,Gs=512*1024,_l=512*1024,Sl=96,nm=96,im=18,Al=96*1024*1024,om=2,qs=class t{static async create(e,a){if(!navigator.gpu)throw new Error("WebGPU is unavailable in this browser");let s=await navigator.gpu.requestAdapter({powerPreference:"high-performance"});if(!s)throw new Error("No WebGPU adapter is available");let r=await s.requestDevice(),n=await fetch(a,{cache:"default"});if(!n.ok)throw new Error(`Failed to load schematic manifest: ${n.status}`);let i=await n.json();if(!["prism.schematic_world_a0","prism.schematic_vector_a0"].includes(i.schema))throw new Error(`Unsupported schematic scene schema: ${i.schema}`);let o=i.featureTable||i.features,c=await fetch(new URL(o,a),{cache:"default"});if(!c.ok)throw new Error(`Failed to load schematic features: ${c.status}`);let l=lm(await c.json());return new t(e,r,a,i,l)}constructor(e,a,s,r,n){this.canvas=e,this.device=a,this.manifestUrl=s,this.manifest=r,this.isNativeScene=r.schema==="prism.schematic_vector_a0",this.pages=r.pages||[],this.featuresByPage=n,this.featuresById=new Map;for(let p of Object.values(n))for(let h of p)this.featuresById.set(Number(h.id),h);this.context=e.getContext("webgpu"),this.format=navigator.gpu.getPreferredCanvasFormat(),this.context.configure({device:a,format:this.format,alphaMode:"opaque"}),this.flowCanvas=null,this.flowContext=null,this.globalBuffer=a.createBuffer({size:48,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),this.bindGroupLayout=a.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}},{binding:1,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}},{binding:2,visibility:GPUShaderStage.FRAGMENT,sampler:{type:"filtering"}},{binding:3,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:"float"}}]});let i=a.createShaderModule({code:Xg});this.pagePipeline=a.createRenderPipeline({layout:a.createPipelineLayout({bindGroupLayouts:[this.bindGroupLayout]}),vertex:{module:i,entryPoint:"vs"},fragment:{module:i,entryPoint:"fs",targets:[{format:this.format}]},primitive:{topology:"triangle-list"}}),this.edgeLayout=a.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}}]});let o=a.createShaderModule({code:$g});this.edgePipeline=a.createRenderPipeline({layout:a.createPipelineLayout({bindGroupLayouts:[this.edgeLayout]}),vertex:{module:o,entryPoint:"vs",buffers:[{arrayStride:8,attributes:[{shaderLocation:0,offset:0,format:"float32x2"}]}]},fragment:{module:o,entryPoint:"fs",targets:[{format:this.format,blend:{color:{srcFactor:"src-alpha",dstFactor:"one-minus-src-alpha"},alpha:{srcFactor:"one",dstFactor:"one-minus-src-alpha"}}}]},primitive:{topology:"line-list"}}),this.edgeBindGroup=a.createBindGroup({layout:this.edgeLayout,entries:[{binding:0,resource:{buffer:this.globalBuffer}}]});let c=a.createShaderModule({code:Yg});this.highlightPipeline=a.createRenderPipeline({layout:a.createPipelineLayout({bindGroupLayouts:[this.edgeLayout]}),vertex:{module:c,entryPoint:"vs",buffers:[{arrayStride:8,attributes:[{shaderLocation:0,offset:0,format:"float32x2"}]}]},fragment:{module:c,entryPoint:"fs",targets:[{format:this.format,blend:{color:{srcFactor:"src-alpha",dstFactor:"one-minus-src-alpha"},alpha:{srcFactor:"one",dstFactor:"one-minus-src-alpha"}}}]},primitive:{topology:"line-list"}}),this.highlightBufferSize=4*1024*1024,this.highlightBuffer=a.createBuffer({size:this.highlightBufferSize,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST});let l=a.createShaderModule({code:Jg});this.netFlowPipeline=a.createRenderPipeline({layout:a.createPipelineLayout({bindGroupLayouts:[this.edgeLayout]}),vertex:{module:l,entryPoint:"vs",buffers:[{arrayStride:16,attributes:[{shaderLocation:0,offset:0,format:"float32x2"},{shaderLocation:1,offset:8,format:"float32x2"}]}]},fragment:{module:l,entryPoint:"fs",targets:[{format:this.format,blend:{color:{srcFactor:"src-alpha",dstFactor:"one-minus-src-alpha"},alpha:{srcFactor:"one",dstFactor:"one-minus-src-alpha"}}}]},primitive:{topology:"triangle-list"}}),this.netFlowBuffer=a.createBuffer({size:_l*4,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST}),this.globalUniformScratch=new Float32Array(12),this.pageUniformScratch=new Float32Array(8),this.imageUniformScratch=new Float32Array(8),this.vectorScratch=new Float32Array(Ks),this.highlightScratch=new Float32Array(this.highlightBufferSize/4),this.netFlowScratch=new Float32Array(_l),this.netTrackingCache=null,this.selectedIntrasheetLinkIndex=-1,this.truncatedHighlightCount=0,this.truncatedVectorCount=0,this.frameSerial=0,this.querySerial=0;let f=a.createShaderModule({code:Qg});this.vectorPipeline=a.createRenderPipeline({layout:a.createPipelineLayout({bindGroupLayouts:[this.edgeLayout]}),vertex:{module:f,entryPoint:"vs",buffers:[{arrayStride:24,attributes:[{shaderLocation:0,offset:0,format:"float32x2"},{shaderLocation:1,offset:8,format:"float32x4"}]}]},fragment:{module:f,entryPoint:"fs",targets:[{format:this.format,blend:{color:{srcFactor:"src-alpha",dstFactor:"one-minus-src-alpha"},alpha:{srcFactor:"one",dstFactor:"one-minus-src-alpha"}}}]},primitive:{topology:"triangle-list"}}),this.vectorBuffer=a.createBuffer({size:Ks*4,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST}),this.vectorBuffers=[this.vectorBuffer];let u=a.createShaderModule({code:Zg});this.imagePipeline=a.createRenderPipeline({layout:a.createPipelineLayout({bindGroupLayouts:[this.bindGroupLayout]}),vertex:{module:u,entryPoint:"vs"},fragment:{module:u,entryPoint:"fs",targets:[{format:this.format,blend:{color:{srcFactor:"src-alpha",dstFactor:"one-minus-src-alpha"},alpha:{srcFactor:"one",dstFactor:"one-minus-src-alpha"}}}]},primitive:{topology:"triangle-list"}});let g=a.createShaderModule({code:em});this.pickPipeline=a.createRenderPipeline({layout:a.createPipelineLayout({bindGroupLayouts:[this.edgeLayout]}),vertex:{module:g,entryPoint:"vs",buffers:[{arrayStride:12,attributes:[{shaderLocation:0,offset:0,format:"float32x2"},{shaderLocation:1,offset:8,format:"uint32"}]}]},fragment:{module:g,entryPoint:"fs",targets:[{format:"r32uint"}]},primitive:{topology:"triangle-list"}}),this.pickVertexBuffer=a.createBuffer({size:Gs*12,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST}),this.pickReadBuffer=a.createBuffer({size:256,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}),this.pickTexture=null,this.pickTextureSize=[0,0],this.pickPending=!1,this.vectorChunks=new Map,this.failedVectorChunks=new Map,this.nativeDetailState=new Map,this.domDetailPageIds=new Set,this.nativeDetailThresholds=new Map,this.residentVectorBytes=0,this.sampler=a.createSampler({magFilter:"linear",minFilter:"linear",mipmapFilter:"linear"}),this.placeholder=this.createSolidTexture([245,247,249,255]),this.pageResources=new Map,this.imageResources=new Map,this.loading=new Map,this.selectedPageId="",this.selectedFeatureId=0,this.activeNetUid="",this.showHierarchy=!0,this.downloadedBytes=0,this.world=r.worldBoundsMm,this.center=[(this.world.minX+this.world.maxX)/2,(this.world.minY+this.world.maxY)/2],this.scale=Math.max((this.world.maxX-this.world.minX)/900,(this.world.maxY-this.world.minY)/650,.1)*1.16,this.edgeBuffer=this.createEdgeBuffer();for(let p of this.pages)this.createPageResource(p)}createSolidTexture(e){let a=this.device.createTexture({size:[1,1],format:"rgba8unorm-srgb",usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST});return this.device.queue.writeTexture({texture:a},new Uint8Array(e),{bytesPerRow:4},[1,1]),a}createPageResource(e){let a=this.device.createBuffer({size:32,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),s={page:e,uniform:a,texture:this.placeholder,textureWidth:0,svgBlob:null,bindGroup:null};this.pageResources.set(e.id,s),this.updateBindGroup(s)}createImageResource(e){let a=this.device.createBuffer({size:32,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),s={path:e,uniform:a,texture:this.placeholder,loaded:!1,bindGroup:null};return this.imageResources.set(e,s),this.updateBindGroup(s),s}updateBindGroup(e){e.bindGroup=this.device.createBindGroup({layout:this.bindGroupLayout,entries:[{binding:0,resource:{buffer:this.globalBuffer}},{binding:1,resource:{buffer:e.uniform}},{binding:2,resource:this.sampler},{binding:3,resource:e.texture.createView()}]})}async loadImageTexture(e){let a=this.imageResources.get(e)||this.createImageResource(e);if(a.loaded)return a;let s=`image:${e}`;if(this.loading.has(s))return this.loading.get(s);let r=(async()=>{try{let n=await fetch(new URL(e,this.manifestUrl),{cache:"default"});if(!n.ok)throw new Error(`Failed to load schematic image ${e}: ${n.status}`);let i=await n.blob(),o=await createImageBitmap(i),c=this.device.createTexture({size:[o.width,o.height],format:"rgba8unorm-srgb",usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST|GPUTextureUsage.RENDER_ATTACHMENT});this.device.queue.copyExternalImageToTexture({source:o},{texture:c},[o.width,o.height]),o.close(),a.texture!==this.placeholder&&a.texture.destroy(),a.texture=c,a.loaded=!0,this.updateBindGroup(a)}finally{this.loading.delete(s)}return a})();return this.loading.set(s,r),r}createEdgeBuffer(){let e=new Map(this.pages.map(n=>[n.id,n])),a=[];for(let n of this.manifest.edges||[]){let i=e.get(n.source),o=e.get(n.target);!i||!o||a.push(i.worldX+i.widthMm/2,i.worldY+i.heightMm,o.worldX+o.widthMm/2,o.worldY)}let s=new Float32Array(a);if(!s.length)return null;let r=this.device.createBuffer({size:s.byteLength,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST});return this.device.queue.writeBuffer(r,0,s),{buffer:r,count:s.length/2}}resize(){let e=Math.min(devicePixelRatio||1,2),a=Math.max(1,Math.floor(this.canvas.clientWidth*e)),s=Math.max(1,Math.floor(this.canvas.clientHeight*e));(this.canvas.width!==a||this.canvas.height!==s)&&(this.canvas.width=a,this.canvas.height=s),this.flowCanvas&&(this.flowCanvas.width!==a||this.flowCanvas.height!==s)&&(this.flowCanvas.width=a,this.flowCanvas.height=s)}setFlowOverlayCanvas(e){e&&(this.flowCanvas=e,this.flowContext=e.getContext("webgpu"),this.flowContext.configure({device:this.device,format:this.format,alphaMode:"premultiplied"}))}writeGlobals(){let e=this.globalUniformScratch;e[0]=this.center[0],e[1]=this.center[1],e[2]=this.scale,e[3]=performance.now()*.001,e[4]=this.canvas.width,e[5]=this.canvas.height,this.device.queue.writeBuffer(this.globalBuffer,0,e)}pagePixelWidth(e){return e.widthMm/this.scale}pageSourcePixelsPerMm(e){let a=this.pagePixelWidth(e)/Math.max(1,e.sourceWidthMm||e.widthMm),s=e.heightMm/this.scale/Math.max(1,e.sourceHeightMm||e.heightMm);return Math.min(a,s)}pageNativeDetailThresholds(e){let a=this.nativeDetailThresholds.get(e.id);if(a)return a;let s=Math.max(1,e.sourceWidthMm||e.widthMm),r=Math.max(1,e.sourceHeightMm||e.heightMm),n=s*r,i=Math.max(0,e.featureCount||e.featureIds?.length||0)/Math.max(1,n),o=he(1-i*72,.84,1.08),c=he(Math.sqrt(Math.max(s,r)/Math.max(1,Math.min(s,r)))/1.18,.92,1.14),l=he(tm*o*c,5,7.4),f={enter:l,exit:he(Math.min(l-1.2,am*o),3.8,l-.7),prefetch:he(Math.min(l-2,sm*o),3,l-1)};return this.nativeDetailThresholds.set(e.id,f),f}pageWantsNativeDetail(e){if(!this.pageHasNativeDetail(e))return!1;let a=this.pageSourcePixelsPerMm(e),s=this.nativeDetailState.get(e.id)===!0,r=this.pageNativeDetailThresholds(e),n=s?r.exit:r.enter,i=a>=n;return i!==s&&this.nativeDetailState.set(e.id,i),i}pageNativeDetailReady(e){if(this.domDetailPageIds.has(e.id)||!this.pageWantsNativeDetail(e))return!1;let a=this.vectorChunks.get(e.id);return!a?.loaded||!a.segments?.length&&!a.fills?.length?!1:this.visibleNativeImagesReady(e,a)}visibleNativeImagesReady(e,a){if(!a?.images?.length)return!0;let s=this.sourceViewportBounds(e,4),r=!0;for(let n of a.images){if(!ot(n.bounds,s))continue;(this.imageResources.get(n.path)||this.createImageResource(n.path)).loaded||(r=!1,this.loadImageTexture(n.path).catch(()=>{}))}return r}visiblePages(){let e=this.canvas.width*this.scale/2,a=this.canvas.height*this.scale/2,s=this.center[0]-e,r=this.center[0]+e,n=this.center[1]-a,i=this.center[1]+a;return this.pages.filter(o=>o.worldX+o.widthMm>=s&&o.worldX<=r&&o.worldY+o.heightMm>=n&&o.worldY<=i)}worldViewportBounds(e=0){let a=this.canvas.width*this.scale/2,s=this.canvas.height*this.scale/2;return[this.center[0]-a-e,this.center[1]-s-e,this.center[0]+a+e,this.center[1]+s+e]}sourceViewportBounds(e,a=2.5){let s=this.worldViewportBounds(this.scale*8),r=(s[0]-e.worldX)/e.widthMm*e.sourceWidthMm-a,n=(s[1]-e.worldY)/e.heightMm*e.sourceHeightMm-a,i=(s[2]-e.worldX)/e.widthMm*e.sourceWidthMm+a,o=(s[3]-e.worldY)/e.heightMm*e.sourceHeightMm+a;return[Math.max(-a,Math.min(r,i)),Math.max(-a,Math.min(n,o)),Math.min(e.sourceWidthMm+a,Math.max(r,i)),Math.min(e.sourceHeightMm+a,Math.max(n,o))]}render(){this.frameSerial+=1,this.resize(),this.writeGlobals();let e=this.visiblePages(),a=this.device.createCommandEncoder(),s=a.beginRenderPass({colorAttachments:[{view:this.context.getCurrentTexture().createView(),clearValue:{r:.045,g:.055,b:.073,a:1},loadOp:"clear",storeOp:"store"}]});this.showHierarchy&&this.edgeBuffer&&(s.setPipeline(this.edgePipeline),s.setBindGroup(0,this.edgeBindGroup),s.setVertexBuffer(0,this.edgeBuffer.buffer),s.draw(this.edgeBuffer.count)),s.setPipeline(this.pagePipeline);for(let i of e){let o=this.pageResources.get(i.id),c=this.activeNetUid&&i.netUids.includes(this.activeNetUid),l=this.domDetailPageIds.has(i.id),f=!l&&this.pageNativeDetailReady(i),u=this.pageUniformScratch;u[0]=i.worldX,u[1]=i.worldY,u[2]=i.widthMm,u[3]=i.heightMm,u[4]=i.id===this.selectedPageId?1:0,u[5]=c?1:0,u[6]=this.activeNetUid?1:0,u[7]=f||l?1:0,this.device.queue.writeBuffer(o.uniform,0,u),s.setBindGroup(0,o.bindGroup),s.draw(6);let g=he(Math.ceil(this.pagePixelWidth(i)*1.3/512)*512,512,6144);o.textureWidth<g*.82&&this.loadPageTexture(i,g).catch(()=>{})}this.scheduleVisibleVectorLoads(e),this.drawVisibleImages(s,e),this.drawVisibleVectors(s,e);let r=this.writeNetTrackingOverlay();r&&!this.flowContext&&(s.setPipeline(this.netFlowPipeline),s.setBindGroup(0,this.edgeBindGroup),s.setVertexBuffer(0,this.netFlowBuffer),s.draw(r));let n=this.writeNetHighlights(e);return n&&(s.setPipeline(this.highlightPipeline),s.setBindGroup(0,this.edgeBindGroup),s.setVertexBuffer(0,this.highlightBuffer),s.draw(n)),s.end(),this.device.queue.submit([a.finish()]),this.renderFlowOverlay(r),this.evictVectorChunks(e),e}renderFlowOverlay(e){if(!this.flowContext)return;let a=this.device.createCommandEncoder(),s=a.beginRenderPass({colorAttachments:[{view:this.flowContext.getCurrentTexture().createView(),clearValue:{r:0,g:0,b:0,a:0},loadOp:"clear",storeOp:"store"}]});e&&(s.setPipeline(this.netFlowPipeline),s.setBindGroup(0,this.edgeBindGroup),s.setVertexBuffer(0,this.netFlowBuffer),s.draw(e)),s.end(),this.device.queue.submit([a.finish()])}drawVisibleImages(e,a){if(!this.isNativeScene)return;let s=!1;for(let r of a){if(this.domDetailPageIds.has(r.id)||!this.pageNativeDetailReady(r))continue;let n=this.vectorChunks.get(r.id);if(!n?.images?.length)continue;let i=this.sourceViewportBounds(r,4);for(let o of n.images){if(!ot(o.bounds,i))continue;let c=this.imageResources.get(o.path)||this.createImageResource(o.path);c.loaded||this.loadImageTexture(o.path).catch(()=>{});let l=o.worldOrigin||this.sourceToWorld(r,[o.xMm,o.yMm]),f=o.worldSize||this.sourceSizeToWorld(r,o.widthMm,o.heightMm),u=this.imageUniformScratch;u[0]=l[0],u[1]=l[1],u[2]=f[0],u[3]=f[1],u[4]=0,u[5]=0,u[6]=0,u[7]=0,this.device.queue.writeBuffer(c.uniform,0,u),s||(e.setPipeline(this.imagePipeline),s=!0),e.setBindGroup(0,c.bindGroup),e.draw(6)}}}drawVisibleVectors(e,a){if(!this.isNativeScene)return 0;let s=this.vectorScratch,r=0,n=0,i=0,o=0,c=!1,l=()=>{if(!r)return;let u=this.vectorBuffers[o];u||(u=this.device.createBuffer({size:Ks*4,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST}),this.vectorBuffers.push(u)),this.device.queue.writeBuffer(u,0,s,0,r),c||(e.setPipeline(this.vectorPipeline),e.setBindGroup(0,this.edgeBindGroup),c=!0);let g=Math.floor(r/6);e.setVertexBuffer(0,u),e.draw(g),i+=g,o+=1,r=0},f=u=>u>Ml||u>s.length?(n+=1,!1):((r+u>Ml||r+u>s.length)&&l(),!0);for(let u of a){if(this.domDetailPageIds.has(u.id)||!this.pageHasNativeDetail(u))continue;let g=this.vectorChunks.get(u.id);if(!g?.segments?.length&&!g?.fills?.length||!this.pageNativeDetailReady(u))continue;g.lastUsedFrame=this.frameSerial;let p=this.sourceViewportBounds(u),h=Il(g.spatial,p);for(let d of h.fills){if(!ot(d.bounds,p)||!f(18))continue;let m=this.featuresById.get(d.featureId),b=this.activeNetUid&&m?.netUid===this.activeNetUid,x=this.selectedFeatureId===d.featureId?[.24,.58,1,1]:b?[.06,1,.24,1]:this.activeNetUid&&Na(m)?Fl(m,d.kind,d.color):jn(m,d.kind,d.color),w=d.worldPoints||d.points.map(E=>this.sourceToWorld(u,E));r=_m(s,r,w[0],w[1],w[2],x)}for(let d of h.segments){if(!ot(d.bounds,p))continue;let m=this.featuresById.get(d.featureId),b=this.activeNetUid&&m?.netUid===this.activeNetUid,y=this.selectedFeatureId===d.featureId,x=y?[.24,.58,1,1]:b?[.06,1,.24,1]:this.activeNetUid&&Na(m)?Fl(m,d.kind,d.color):jn(m,d.kind,d.color),w=this.segmentWorldWidth(u,d,m,b||y);for(let E of this.visibleSegmentParts(u,d,m)){if(!f(36))continue;let T=E.worldA||this.sourceToWorld(u,E.a),_=E.worldB||this.sourceToWorld(u,E.b);r=Mm(s,r,T,_,w,x)}}}return l(),this.truncatedVectorCount=n,this.vectorTruncated=n>0,this.lastVectorVertices=i,this.lastVectorChunks=o,i}pageHasNativeDetail(e){return this.isNativeScene?e?.nativeDetail?.enabled!==!1:!1}scheduleVisibleVectorLoads(e){if(!this.isNativeScene)return;let a=[...this.vectorChunks.values()].filter(n=>n?.promise&&!n.loaded).length,s=Math.max(0,om-a);if(!s)return;let r=e.filter(n=>!this.domDetailPageIds.has(n.id)).filter(n=>this.pageHasNativeDetail(n)&&this.pageSourcePixelsPerMm(n)>=this.pageNativeDetailThresholds(n).prefetch).filter(n=>!this.vectorChunks.get(n.id)?.loaded&&!this.vectorChunks.get(n.id)?.promise).sort((n,i)=>{let o=Math.hypot(n.worldX+n.widthMm/2-this.center[0],n.worldY+n.heightMm/2-this.center[1]),c=Math.hypot(i.worldX+i.widthMm/2-this.center[0],i.worldY+i.heightMm/2-this.center[1]);return o-c});for(let n of r)if(this.loadPageVectors(n).catch(()=>{}),s-=1,!s)break}featurePrimitiveBounds(e,a){let s=this.vectorChunks.get(e.id);if(!s?.segments?.length&&!s?.fills?.length)return null;let r=[],n=[];for(let i of s.segments||[])i.featureId===a&&(r.push(i.a[0],i.b[0]),n.push(i.a[1],i.b[1]));for(let i of s.fills||[])if(i.featureId===a)for(let o of i.points||[])r.push(o[0]),n.push(o[1]);return r.length?[Math.min(...r),Math.min(...n),Math.max(...r),Math.max(...n)]:null}symbolClipBounds(e){if(this._symbolClipBounds||(this._symbolClipBounds=new Map),this._symbolClipBounds.has(e.id))return this._symbolClipBounds.get(e.id);let a=(this.featuresByPage[e.id]||[]).filter(s=>s?.kind==="symbol_body"&&s.boundsMm&&!String(s.sourceId||"").includes(":overplot")).map(s=>{let r=this.featurePrimitiveBounds(e,s.id)||s.boundsMm;return[r[0]-.02,r[1]-.02,r[2]+.02,r[3]+.02]}).filter(s=>{let r=s[2]-s[0],n=s[3]-s[1];return Math.max(r,n)<=12&&r*n<=80});return this._symbolClipBounds.set(e.id,a),a}visibleSegmentParts(e,a,s){if(a._visibleParts)return a._visibleParts;let r=String(s?.kind||""),n=String(s?.semanticRole||"");if(r!=="wire"&&n!=="wire")return a._visibleParts=[a],a._visibleParts;let i=[a];for(let o of this.symbolClipBounds(e)){let c=[];for(let l of i)c.push(...Rm(l,o));if(i=c,!i.length)break}for(let o of i)o.worldA=ea(e,o.a),o.worldB=ea(e,o.b);return a._visibleParts=i,a._visibleParts}netTrackingSegments(){if(!this.activeNetUid)return{netUid:"",anchorsByPage:new Map,segments:[],intrasheetSegments:[]};let e=Number(this.selectedFeatureId||0),a=String(this.selectedFeatureKey||""),s=String(this.selectedSourceId||"");if(this.netTrackingCache?.netUid===this.activeNetUid&&this.netTrackingCache?.selectedFeatureId===e&&this.netTrackingCache?.selectedFeatureKey===a&&this.netTrackingCache?.selectedSourceId===s)return this.netTrackingCache;this.selectedIntrasheetLinkIndex=-1;let r=new Map(this.pages.map(h=>[h.id,h])),n=this.manifest.netToPages?.[this.activeNetUid]||[],i=n.length?n.map(h=>r.get(h)).filter(Boolean):this.pages.filter(h=>h.netUids?.includes(this.activeNetUid)),o=new Map;for(let h of i.slice(0,nm)){let d=this.netTrackingAnchorsForPage(h);d.length&&o.set(h.id,d)}let c=[],l=[];for(let[h,d]of o){let m=Cl(vm(d),"intrasheet",h);c.push(...m),l.push(...m)}let f=[...o.entries()].map(([h,d])=>km(r.get(h),d,{featureId:e,stableKey:a,sourceId:s})).filter(Boolean);c.push(...Cl(f,"intersheet",""));let u=l.map((h,d)=>({...h,intrasheetIndex:d})),g=0,p=c.map((h,d)=>{if(h.type!=="intrasheet")return{...h,id:d};let m=g;return g+=1,{...h,id:d,intrasheetIndex:m}});return this.netTrackingCache={netUid:this.activeNetUid,selectedFeatureId:e,selectedFeatureKey:a,selectedSourceId:s,anchorsByPage:o,segments:p,intrasheetSegments:u},this.selectedIntrasheetLinkIndex>=this.netTrackingCache.intrasheetSegments.length&&(this.selectedIntrasheetLinkIndex=-1),this.netTrackingCache}netTrackingAnchorsForPage(e){let a=this.featuresByPage[e.id]||[],s=[];for(let r of a){if(r.netUid!==this.activeNetUid||!r.boundsMm||!xm(r))continue;let n=r.boundsMm,i=[(n[0]+n[2])/2,(n[1]+n[3])/2],o=this.sourceToWorld(e,i);s.push({pageId:e.id,featureId:Number(r.id||0),stableKey:String(r.stableKey||""),sourceId:String(r.sourceId||r.sourceUid||r.objectId||""),kind:r.kind||r.semanticRole||"",source:i,world:o,bounds:n,priority:wm(r)})}return s.sort((r,n)=>n.priority-r.priority||r.source[1]-n.source[1]||r.source[0]-n.source[0]),s}writeNetTrackingOverlay(){let e=this.netTrackingSegments();if(this.lastNetFlowSegments=e.segments.length,this.lastNetFlowIntrasheetSegments=e.intrasheetSegments.length,!e.segments.length)return this.lastNetFlowVertices=0,0;let a=this.worldViewportBounds(this.scale*96),s=this.netFlowScratch,r=0,n=0;for(let i of e.segments){if(!ot(Bl(i),a))continue;let o=i.type==="intrasheet"&&i.intrasheetIndex===this.selectedIntrasheetLinkIndex,c=o?9.5:i.type==="intersheet"?8:4.8,l=o?2:i.type==="intersheet"?1:0,f=Sm(s,r,i.a,i.b,c*this.scale,l,n,this.scale);if(f!==r&&(r=f,n+=Math.hypot(i.b[0]-i.a[0],i.b[1]-i.a[1])/Math.max(this.scale,1e-6),r+24>s.length))break}return r?(this.device.queue.writeBuffer(this.netFlowBuffer,0,s,0,r),this.lastNetFlowVertices=r/4,r/4):(this.lastNetFlowVertices=0,0)}cycleNetIntrasheetLink(e=1){let a=this.netTrackingSegments();if(!a.intrasheetSegments.length)return null;let s=a.intrasheetSegments.length;this.selectedIntrasheetLinkIndex=(this.selectedIntrasheetLinkIndex+e+s)%s;let r=a.intrasheetSegments[this.selectedIntrasheetLinkIndex];if(!r)return null;let n=Bl(r,14*this.scale);return this.center=[(n[0]+n[2])/2,(n[1]+n[3])/2],this.scale=Math.max((n[2]-n[0])/Math.max(1,this.canvas.width*.36),(n[3]-n[1])/Math.max(1,this.canvas.height*.3),this.scale*.35,.025),{pageId:r.pageId,segment:r}}writeNetHighlights(e){if(!this.activeNetUid)return 0;let a=this.highlightScratch,s=0,r=0;for(let n of e){let i=this.sourceViewportBounds(n,5);for(let o of this.featuresByPage[n.id]||[]){if(o.netUid!==this.activeNetUid||!o.boundsMm||!ot(o.boundsMm,i))continue;let c=this.featureWorldBounds(n,o.boundsMm);if(s+16>a.length){r+=1;continue}a[s++]=c[0],a[s++]=c[1],a[s++]=c[2],a[s++]=c[1],a[s++]=c[2],a[s++]=c[1],a[s++]=c[2],a[s++]=c[3],a[s++]=c[2],a[s++]=c[3],a[s++]=c[0],a[s++]=c[3],a[s++]=c[0],a[s++]=c[3],a[s++]=c[0],a[s++]=c[1]}}return this.truncatedHighlightCount=r,s?(this.device.queue.writeBuffer(this.highlightBuffer,0,a,0,s),s/2):0}featureWorldBounds(e,a){return[e.worldX+a[0]/e.sourceWidthMm*e.widthMm,e.worldY+a[1]/e.sourceHeightMm*e.heightMm,e.worldX+a[2]/e.sourceWidthMm*e.widthMm,e.worldY+a[3]/e.sourceHeightMm*e.heightMm]}sourceToWorld(e,a){return[e.worldX+a[0]/e.sourceWidthMm*e.widthMm,e.worldY+a[1]/e.sourceHeightMm*e.heightMm]}sourceSizeToWorld(e,a,s){return[a/e.sourceWidthMm*e.widthMm,s/e.sourceHeightMm*e.heightMm]}async loadPageVectors(e){if(!this.pageHasNativeDetail(e)||!e.chunks?.lod2)return null;let a=this.vectorChunks.get(e.id);if(a?.loaded)return a;if(a?.promise)return a.promise;let s=(async()=>{try{let r=await fetch(new URL(e.chunks.lod2,this.manifestUrl));if(!r.ok)throw new Error(`Failed to load schematic vector chunk ${e.id}: ${r.status}`);let n=await r.json(),i=dm(n.primitives||[]);um(e,i);let c=JSON.stringify(n).length,l={loaded:!0,segments:i.segments,fills:i.fills,images:i.images,spatial:ym(i),unsupported:n.unsupported||[],bytes:c,lastUsedFrame:this.frameSerial};return this.vectorChunks.set(e.id,l),this.failedVectorChunks.delete(e.id),this.residentVectorBytes+=c,l}catch(r){let n=this.failedVectorChunks.get(e.id)||{count:0,message:""};throw this.failedVectorChunks.set(e.id,{count:n.count+1,message:r?.message||String(r)}),this.vectorChunks.delete(e.id),r}})();return this.vectorChunks.set(e.id,{loaded:!1,promise:s,segments:[]}),s}evictVectorChunks(e){if(this.residentVectorBytes<=Al)return;let a=new Set(e.map(r=>r.id)),s=[...this.vectorChunks.entries()].filter(([,r])=>r?.loaded).filter(([r])=>!a.has(r)&&r!==this.selectedPageId).sort((r,n)=>(r[1].lastUsedFrame||0)-(n[1].lastUsedFrame||0));for(let[r,n]of s)if(this.vectorChunks.delete(r),this.residentVectorBytes=Math.max(0,this.residentVectorBytes-(n.bytes||0)),this.residentVectorBytes<=Al*.82)break}stats(){let e=this.visiblePages(),a=e.map(r=>this.pageSourcePixelsPerMm(r)),s=e.map(r=>this.pageNativeDetailThresholds(r).enter);return{residentVectorBytes:this.residentVectorBytes,vectorChunks:[...this.vectorChunks.values()].filter(r=>r?.loaded).length,vectorLoads:[...this.vectorChunks.values()].filter(r=>r?.promise&&!r.loaded).length,failedVectorChunks:this.failedVectorChunks.size,vectorVertices:this.lastVectorVertices||0,vectorDrawChunks:this.lastVectorChunks||0,truncatedVectors:this.truncatedVectorCount||0,nativeDetailPages:[...this.nativeDetailState.values()].filter(Boolean).length,nativePxPerMm:Number((Math.max(0,...a)||0).toFixed(2)),nativeThresholdPxPerMm:Number((s.length?Math.min(...s):0).toFixed(2)),domDetailPages:this.domDetailPageIds.size,netFlowSegments:this.lastNetFlowSegments||0,netFlowIntrasheetSegments:this.lastNetFlowIntrasheetSegments||0,netFlowVertices:this.lastNetFlowVertices||0}}setDomDetailPageIds(e){this.domDetailPageIds=new Set(e||[])}async loadPageTexture(e,a){let s=`${e.id}:${a}`;if(this.loading.has(s))return this.loading.get(s);let r=this.pageResources.get(e.id);if(!r||r.textureWidth>=a)return;let n=(async()=>{if(!r.svgBlob){let c=await fetch(new URL(cm(e),this.manifestUrl));if(!c.ok)throw new Error(`Failed to load schematic page ${e.name}: ${c.status}`);r.svgBlob=await c.blob(),this.downloadedBytes+=r.svgBlob.size}let i=r.svgBlob,o=URL.createObjectURL(i);try{let c=new Image;if(c.decoding="async",c.src=o,await c.decode(),r.textureWidth>=a)return;let l=Math.max(64,Math.round(a*e.heightMm/e.widthMm)),f=new OffscreenCanvas(a,l),u=f.getContext("2d",{alpha:!1});u.fillStyle="#ffffff",u.fillRect(0,0,a,l),u.drawImage(c,0,0,a,l);let g=await createImageBitmap(f),p=this.device.createTexture({size:[a,l],format:"rgba8unorm-srgb",usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST|GPUTextureUsage.RENDER_ATTACHMENT});this.device.queue.copyExternalImageToTexture({source:g},{texture:p},[a,l]),g.close(),r.texture!==this.placeholder&&r.texture.destroy(),r.texture=p,r.textureWidth=a,this.updateBindGroup(r)}finally{URL.revokeObjectURL(o),this.loading.delete(s)}})();return this.loading.set(s,n),n}preloadOverview(){let e=[...this.pages],a=async()=>{for(;e.length;){let s=e.shift();await this.loadPageTexture(s,512).catch(()=>{})}};return Promise.all(Array.from({length:Math.min(4,e.length)},a))}screenToWorld(e,a){let s=this.canvas.getBoundingClientRect(),r=(e-s.left)*this.canvas.width/s.width,n=(a-s.top)*this.canvas.height/s.height;return[this.center[0]+(r-this.canvas.width/2)*this.scale,this.center[1]+(n-this.canvas.height/2)*this.scale]}worldToScreen(e,a){let s=this.canvas.clientWidth/this.canvas.width,r=this.canvas.clientHeight/this.canvas.height;return[((e-this.center[0])/this.scale+this.canvas.width/2)*s,((a-this.center[1])/this.scale+this.canvas.height/2)*r]}hitPage(e,a){let[s,r]=this.screenToWorld(e,a);return[...this.pages].reverse().find(n=>s>=n.worldX&&s<=n.worldX+n.widthMm&&r>=n.worldY&&r<=n.worldY+n.heightMm)||null}async pickFeature(e,a){if(!this.isNativeScene)return this.hitFeature(e,a);let s=this.hitPage(e,a);if(!s)return null;if(!this.pageHasNativeDetail(s))return this.hitFeature(e,a);await this.loadPageVectors(s);let r=await this.gpuPickFeature(s,e,a);return r&&!Ia(r)?{page:s,feature:r,source:this.clientToSource(s,e,a),native:!0,gpu:!0}:this.hitFeature(e,a)}hitFeature(e,a){let s=this.hitPage(e,a);if(!s)return null;let[r,n]=this.clientToSource(s,e,a),i=Math.max(.45,5*this.scale*this.canvas.width/Math.max(1,this.canvas.clientWidth)*s.sourceWidthMm/s.widthMm),o=this.hitResidentVectorFeature(s,r,n,i);if(o)return{page:s,feature:o,source:[r,n],native:!0};let c=this.hitSymbolInterior(s,r,n);if(c)return{page:s,feature:c,source:[r,n],native:!0,interior:!0};let l=(this.featuresByPage[s.id]||[]).filter(f=>{if(Ia(f))return!1;let u=f.boundsMm;return u&&r>=u[0]-i&&r<=u[2]+i&&n>=u[1]-i&&n<=u[3]+i}).map(f=>({feature:f,priority:Ra(f),area:Math.max(1e-4,(f.boundsMm[2]-f.boundsMm[0])*(f.boundsMm[3]-f.boundsMm[1]))})).sort((f,u)=>u.priority-f.priority||f.area-u.area);return{page:s,feature:l[0]?.feature||null,source:[r,n]}}hitSymbolInterior(e,a,s){let r=null;for(let n of this.featuresByPage[e.id]||[]){let i=String(n?.kind||"");if(i!=="symbol_body"&&i!=="symbol_instance"||String(n?.sourceId||"").includes(":overplot"))continue;let o=n.boundsMm;if(!o||a<o[0]||a>o[2]||s<o[1]||s>o[3])continue;let c=Math.max(1e-4,(o[2]-o[0])*(o[3]-o[1])),l=(i==="symbol_body"?0:1e6)+c;(!r||l<r.score)&&(r={feature:n,score:l})}return r?.feature||null}clientToSource(e,a,s){let[r,n]=this.screenToWorld(a,s);return[(r-e.worldX)/e.widthMm*e.sourceWidthMm,(n-e.worldY)/e.heightMm*e.sourceHeightMm]}ensurePickTexture(){this.pickTexture&&this.pickTextureSize[0]===this.canvas.width&&this.pickTextureSize[1]===this.canvas.height||(this.pickTexture&&this.pickTexture.destroy(),this.pickTexture=this.device.createTexture({size:[this.canvas.width,this.canvas.height],format:"r32uint",usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.COPY_SRC}),this.pickTextureSize=[this.canvas.width,this.canvas.height])}writePickVectors(e){let a=new ArrayBuffer(Gs*12),s=new DataView(a),r=0,n=[];for(let i of e){let o=this.vectorChunks.get(i.id);if(!o?.segments?.length&&!o?.fills?.length&&!o?.images?.length)continue;let c=this._pickSourcePointByPage?.get(i.id),l=c?[c[0]-2.5,c[1]-2.5,c[0]+2.5,c[1]+2.5]:[0,0,i.sourceWidthMm,i.sourceHeightMm],f=Il(o.spatial,l);for(let u of f.images){if(!ot(u.bounds,l))continue;let g=this.featuresById.get(u.featureId);!g||Ia(g)||n.push({page:i,image:u,feature:g,priority:Ra(g)-5})}for(let u of f.fills){if(!ot(u.bounds,l))continue;let g=this.featuresById.get(u.featureId);!g||Ia(g)||n.push({page:i,fill:u,feature:g,priority:Ra(g)-2})}for(let u of f.segments){if(!ot(u.bounds,l))continue;let g=this.featuresById.get(u.featureId);!g||Ia(g)||n.push({page:i,segment:u,feature:g,priority:Ra(g)})}}n.sort((i,o)=>i.priority-o.priority);for(let{page:i,segment:o,fill:c,image:l,feature:f}of n){if(r+6>Gs)break;if(l){let u=this.sourceToWorld(i,[l.xMm,l.yMm]),g=this.sourceToWorld(i,[l.xMm+l.widthMm,l.yMm]),p=this.sourceToWorld(i,[l.xMm,l.yMm+l.heightMm]),h=this.sourceToWorld(i,[l.xMm+l.widthMm,l.yMm+l.heightMm]);r=Pn(s,r,u,g,p,l.featureId),r=Pn(s,r,p,g,h,l.featureId)}else if(c){let u=c.worldPoints||c.points.map(g=>this.sourceToWorld(i,g));r=Pn(s,r,u[0],u[1],u[2],c.featureId)}else{let u=Math.max(this.segmentWorldWidth(i,o,f,!1),this.scale*7);for(let g of this.visibleSegmentParts(i,o,f)){if(r+6>Gs)break;let p=g.worldA||this.sourceToWorld(i,g.a),h=g.worldB||this.sourceToWorld(i,g.b);r=Im(s,r,p,h,u,o.featureId)}}}return r?(this.device.queue.writeBuffer(this.pickVertexBuffer,0,a,0,r*12),r):0}async gpuPickFeature(e,a,s){if(this.pickPending)return null;let r=this.clientToSource(e,a,s);this._pickSourcePointByPage=new Map([[e.id,r]]);let n=this.writePickVectors([e]);if(this._pickSourcePointByPage=null,!n)return null;this.resize(),this.writeGlobals(),this.ensurePickTexture();let i=this.canvas.getBoundingClientRect(),o=Math.max(0,Math.min(this.canvas.width-1,Math.floor((a-i.left)*this.canvas.width/i.width))),c=Math.max(0,Math.min(this.canvas.height-1,Math.floor((s-i.top)*this.canvas.height/i.height))),l=this.device.createCommandEncoder(),f=l.beginRenderPass({colorAttachments:[{view:this.pickTexture.createView(),clearValue:{r:0,g:0,b:0,a:0},loadOp:"clear",storeOp:"store"}]});f.setPipeline(this.pickPipeline),f.setBindGroup(0,this.edgeBindGroup),f.setVertexBuffer(0,this.pickVertexBuffer),f.draw(n),f.end(),l.copyTextureToBuffer({texture:this.pickTexture,origin:{x:o,y:c}},{buffer:this.pickReadBuffer,bytesPerRow:256,rowsPerImage:1},{width:1,height:1,depthOrArrayLayers:1}),this.pickPending=!0,this.device.queue.submit([l.finish()]);try{await this.pickReadBuffer.mapAsync(GPUMapMode.READ);let u=new DataView(this.pickReadBuffer.getMappedRange()).getUint32(0,!0);return this.pickReadBuffer.unmap(),u&&this.featuresById.get(u)||null}finally{this.pickReadBuffer.mapState==="mapped"&&this.pickReadBuffer.unmap(),this.pickPending=!1}}hitResidentVectorFeature(e,a,s,r){if(!this.isNativeScene)return null;let n=this.vectorChunks.get(e.id);if(!n?.loaded)return null;let i=null;for(let o of n.segments){let c=this.featuresById.get(o.featureId),l=Math.max(r,(o.widthMm||0)*.5+r*.45);if(c)for(let f of this.visibleSegmentParts(e,o,c)){let u=Am([a,s],f.a,f.b);if(u>l)continue;let g=u-Ra(c)*.025+(Na(c)?0:8);(!i||g<i.score)&&(i={feature:c,score:g})}}return i?.feature||null}segmentWorldWidth(e,a,s,r){let n=(a.widthMm||.15)/Math.max(1,e.sourceWidthMm)*e.widthMm;return Math.max(n,this.scale*Tm(s,a.kind,r))}pan(e,a){let s=this.canvas.width/Math.max(1,this.canvas.clientWidth);this.center[0]-=e*this.scale*s,this.center[1]-=a*this.scale*s}zoom(e,a,s){let r=this.screenToWorld(a,s);this.scale=he(this.scale*Math.exp(e*.0015),.015,16);let n=this.screenToWorld(a,s);this.center[0]+=r[0]-n[0],this.center[1]+=r[1]-n[1]}framePage(e){e&&(this.resize(),this.center=[e.worldX+e.widthMm/2,e.worldY+e.heightMm/2],this.scale=Math.max(e.widthMm/Math.max(1,this.canvas.width*.88),e.heightMm/Math.max(1,this.canvas.height*.84)))}frameWorld(){this.resize(),this.center=[(this.world.minX+this.world.maxX)/2,(this.world.minY+this.world.maxY)/2],this.scale=Math.max((this.world.maxX-this.world.minX)/Math.max(1,this.canvas.width*.9),(this.world.maxY-this.world.minY)/Math.max(1,this.canvas.height*.88),.05)}};function cm(t){return t.thumbnail?.path||t.svg}function lm(t){if(t.schema==="prism.schematic_vector_a0.features"){let e=new Map((t.features||[]).map(s=>[Number(s.id),s])),a={};for(let[s,r]of Object.entries(t.pages||{}))a[s]=r.map(n=>e.get(Number(n))).filter(Boolean);return a}return t.pages||{}}function dm(t){let e=[],a=[],s=[];for(let r of t){let n=Number(r.featureId||0);if(!n)continue;if(r.kind==="plotimage"&&r.image?.path){let y=r.xMm||0,x=r.yMm||0,w=r.widthMm||0,E=r.heightMm||0;s.push({featureId:n,kind:r.kind,xMm:y,yMm:x,widthMm:w,heightMm:E,bounds:[y,x,y+w,x+E],path:r.image.path});continue}let i=String(r.semanticRole||""),o=r.radiusMm||r.diameterMm/2||0,c=String(r.fill||"").toUpperCase()==="FILLED_SHAPE",l=r.widthMm||r.pen_widthMm||(i==="junction"?.08:.15),f=String(r.lineStyle||r.line_style||"DEFAULT").toUpperCase(),u=r.color||r.strokeColor||r.style?.color||"",g=r.fillColor||r.color||r.style?.color||"",p=(y,x)=>gm(e,{featureId:n,kind:r.kind,widthMm:l,lineStyle:f,color:u},y,x),h=r.x1Mm,d=r.y1Mm,m=r.x2Mm,b=r.y2Mm;if(r.trianglesMm?.length){for(let y of r.trianglesMm)Array.isArray(y)&&y.length===3&&a.push({featureId:n,kind:r.kind,color:g,points:y,bounds:Ol(y)});if(r.pointsMm?.length>=2){for(let y=1;y<r.pointsMm.length;y+=1)p(r.pointsMm[y-1],r.pointsMm[y]);Nl(r)&&p(r.pointsMm[r.pointsMm.length-1],r.pointsMm[0])}}else if(r.pointsMm?.length>=2){c&&r.pointsMm.length>=3&&pm(a,n,r.kind,r.pointsMm,g);for(let y=1;y<r.pointsMm.length;y+=1)p(r.pointsMm[y-1],r.pointsMm[y]);Nl(r)&&p(r.pointsMm[r.pointsMm.length-1],r.pointsMm[0])}else if(r.polylinesMm?.length){for(let y of r.polylinesMm)if(!(!Array.isArray(y)||y.length<2))for(let x=1;x<y.length;x+=1)p(y[x-1],y[x])}else if(Number.isFinite(h)&&Number.isFinite(d)&&Number.isFinite(m)&&Number.isFinite(b))r.kind==="rect"?(c&&hm(a,n,r.kind,[h,d,m,b],g),p([h,d],[m,d]),p([m,d],[m,b]),p([m,b],[h,b]),p([h,b],[h,d])):p([h,d],[m,b]);else if(Number.isFinite(r.cxMm)&&Number.isFinite(r.cyMm)){let y=r.radiusMm||r.diameterMm/2||.4;c&&bm(a,n,r.kind,[r.cxMm,r.cyMm],y,g),mm(e,{featureId:n,kind:r.kind,widthMm:l,lineStyle:f,color:u},[r.cxMm,r.cyMm],y)}else if(r.contoursMm?.length){for(let y of r.contoursMm)if(!(!Array.isArray(y)||y.length<2)){for(let x=1;x<y.length;x+=1)p(y[x-1],y[x]);p(y[y.length-1],y[0])}}else if(Number.isFinite(r.start_xMm)&&Number.isFinite(r.start_yMm)&&Number.isFinite(r.end_xMm)&&Number.isFinite(r.end_yMm))Number.isFinite(r.mid_xMm)&&Number.isFinite(r.mid_yMm)?(p([r.start_xMm,r.start_yMm],[r.mid_xMm,r.mid_yMm]),p([r.mid_xMm,r.mid_yMm],[r.end_xMm,r.end_yMm])):p([r.start_xMm,r.start_yMm],[r.end_xMm,r.end_yMm]);else if(Number.isFinite(r.start_xMm)&&Number.isFinite(r.start_yMm)&&Number.isFinite(r.mid_xMm)&&Number.isFinite(r.mid_yMm)&&Number.isFinite(r.end_xMm)&&Number.isFinite(r.end_yMm))p([r.start_xMm,r.start_yMm],[r.mid_xMm,r.mid_yMm]),p([r.mid_xMm,r.mid_yMm],[r.end_xMm,r.end_yMm]);else if(r.boundsMm&&r.kind!=="text"){let[y,x,w,E]=r.boundsMm;p([y,x],[w,x]),p([w,x],[w,E]),p([w,E],[y,E]),p([y,E],[y,x])}}return{segments:e,fills:a,images:s}}function um(t,e){for(let a of e.segments||[])a.worldA=ea(t,a.a),a.worldB=ea(t,a.b);for(let a of e.fills||[])a.worldPoints=a.points.map(s=>ea(t,s));for(let a of e.images||[])a.worldOrigin=ea(t,[a.xMm,a.yMm]),a.worldSize=fm(t,a.widthMm,a.heightMm)}function ea(t,e){return[t.worldX+e[0]/t.sourceWidthMm*t.widthMm,t.worldY+e[1]/t.sourceHeightMm*t.heightMm]}function fm(t,e,a){return[e/t.sourceWidthMm*t.widthMm,a/t.sourceHeightMm*t.heightMm]}function hm(t,e,a,s,r){let[n,i,o,c]=s;t.push({featureId:e,kind:a,color:r,points:[[n,i],[o,i],[n,c]],bounds:[n,i,o,c]},{featureId:e,kind:a,color:r,points:[[n,c],[o,i],[o,c]],bounds:[n,i,o,c]})}function bm(t,e,a,s,r,n){for(let o=0;o<36;o+=1){let c=o/36*Math.PI*2,l=(o+1)/36*Math.PI*2;t.push({featureId:e,kind:a,color:n,points:[s,[s[0]+Math.cos(c)*r,s[1]+Math.sin(c)*r],[s[0]+Math.cos(l)*r,s[1]+Math.sin(l)*r]],bounds:[s[0]-r,s[1]-r,s[0]+r,s[1]+r]})}}function pm(t,e,a,s,r){let n=s[0],i=Ol(s);for(let o=2;o<s.length;o+=1)t.push({featureId:e,kind:a,color:r,points:[n,s[o-1],s[o]],bounds:i})}function gm(t,e,a,s){let r=Rl(a,s,e.widthMm||.15),n=e.lineStyle||"DEFAULT";if(!["DASH","DASHED","DOT","DOTTED","DASHDOT","DASH_DOT"].includes(n)){t.push({...e,a,b:s,bounds:r});return}let i=s[0]-a[0],o=s[1]-a[1],c=Math.hypot(i,o);if(c<1e-6)return;let l=i/c,f=o/c,u=Math.max(e.widthMm*4,.45),g=n.includes("DOT")?[u*.8,u*.75,u*3,u*.75]:[u*3,u*1.5],p=0,h=0;for(;p<c;){let d=Math.min(g[h%g.length],c-p);if(h%2===0){let m=[a[0]+l*p,a[1]+f*p],b=[a[0]+l*(p+d),a[1]+f*(p+d)];t.push({...e,a:m,b,bounds:Rl(m,b,e.widthMm||.15)})}p+=d,h+=1}}function mm(t,e,a,s){for(let n=0;n<32;n+=1){let i=n/32*Math.PI*2,o=(n+1)/32*Math.PI*2;t.push({...e,a:[a[0]+Math.cos(i)*s,a[1]+Math.sin(i)*s],b:[a[0]+Math.cos(o)*s,a[1]+Math.sin(o)*s],bounds:[a[0]-s,a[1]-s,a[0]+s,a[1]+s]})}}function Ol(t,e=0){let a=1/0,s=1/0,r=-1/0,n=-1/0;for(let i of t||[])a=Math.min(a,i[0]),s=Math.min(s,i[1]),r=Math.max(r,i[0]),n=Math.max(n,i[1]);return Number.isFinite(a)?[a-e,s-e,r+e,n+e]:[0,0,0,0]}function Rl(t,e,a=0){let s=Math.max(.05,a*.5);return[Math.min(t[0],e[0])-s,Math.min(t[1],e[1])-s,Math.max(t[0],e[0])+s,Math.max(t[1],e[1])+s]}function ot(t,e){return!t||!e?!0:t[0]<=e[2]&&t[2]>=e[0]&&t[1]<=e[3]&&t[3]>=e[1]}function ym(t){let e={cellSize:im,cells:new Map,segments:t.segments||[],fills:t.fills||[],images:t.images||[],queryId:0};for(let a of e.segments)Fn(e,"segments",a);for(let a of e.fills)Fn(e,"fills",a);for(let a of e.images)Fn(e,"images",a);return e}function Fn(t,e,a){let s=a.bounds;if(!s)return;let r=Math.floor(s[0]/t.cellSize),n=Math.floor(s[2]/t.cellSize),i=Math.floor(s[1]/t.cellSize),o=Math.floor(s[3]/t.cellSize);for(let c=i;c<=o;c+=1)for(let l=r;l<=n;l+=1){let f=`${l}:${c}`,u=t.cells.get(f);u||(u={segments:[],fills:[],images:[]},t.cells.set(f,u)),u[e].push(a)}}function Il(t,e){if(!t)return{segments:[],fills:[],images:[]};t.queryId=(t.queryId||0)+1;let a=t.queryId,s={segments:[],fills:[],images:[]},r=Math.floor(e[0]/t.cellSize),n=Math.floor(e[2]/t.cellSize),i=Math.floor(e[1]/t.cellSize),o=Math.floor(e[3]/t.cellSize);for(let c=i;c<=o;c+=1)for(let l=r;l<=n;l+=1){let f=t.cells.get(`${l}:${c}`);f&&(On(f.segments,s.segments,a,"segments"),On(f.fills,s.fills,a,"fills"),On(f.images,s.images,a,"images"))}return s}function On(t,e,a,s){let r=`_${s}QueryId`;for(let n of t)n[r]!==a&&(n[r]=a,e.push(n))}function Nl(t){let e=String(t.kind||"");if(String(t.fill||"").toUpperCase()==="FILLED_SHAPE"||t.closed===!0||["polygon","fill"].includes(e))return!0;let s=t.pointsMm||[];if(s.length>=3){let r=s[0],n=s[s.length-1];return Math.hypot(r[0]-n[0],r[1]-n[1])<1e-6}return!1}function Na(t){return!!t?.netUid}function xm(t){let e=String(t?.kind||""),a=String(t?.semanticRole||"");return e==="pin"||e==="pin_body"||e==="label"||e==="global_label"||e==="hierarchical_label"||e==="netclass_flag"||e==="power_symbol"||e==="power_port"||a==="label"||a==="global_label"||a==="hierarchical_label"}function wm(t){let e=String(t?.kind||""),a=String(t?.semanticRole||"");return e==="global_label"||a==="global_label"?130:e==="hierarchical_label"||a==="hierarchical_label"?125:e==="label"||a==="label"?118:e==="pin"||e==="pin_body"?106:e==="power_symbol"||e==="power_port"||e==="netclass_flag"?98:50}function vm(t){if(t.length<=Sl)return t;let e=t.slice(0,Sl);return e.sort((a,s)=>a.source[1]-s.source[1]||a.source[0]-s.source[0]),e}function km(t,e,a={}){if(!t||!e?.length)return null;let s=a.featureId||a.stableKey||a.sourceId?e.find(l=>a.featureId&&Number(l.featureId||0)===Number(a.featureId)||a.stableKey&&l.stableKey===a.stableKey||a.sourceId&&l.sourceId===a.sourceId):null;if(s)return{...s,kind:"selected-net-occurrence",priority:200};let r=e.filter(l=>l.priority>=118).slice(0,16),n=r.length?r:e.slice(0,16),i=0,o=0;for(let l of n)i+=l.world[0],o+=l.world[1];let c=[i/n.length,o/n.length];return{pageId:t.id,featureId:n[0]?.featureId||0,kind:"page-net-occurrence",source:[0,0],world:c,bounds:[c[0],c[1],c[0],c[1]],priority:1}}function Cl(t,e,a){if(!t||t.length<2)return[];let s=t.map(i=>({...i})).sort((i,o)=>i.world[1]-o.world[1]||i.world[0]-o.world[0]),r=[],n=s.shift();for(;s.length;){let i=0,o=1/0;for(let l=0;l<s.length;l+=1){let f=s[l],u=Math.hypot(f.world[0]-n.world[0],f.world[1]-n.world[1]);u<o&&(o=u,i=l)}let c=s.splice(i,1)[0];r.push({type:e,pageId:a||n.pageId||c.pageId||"",a:n.world,b:c.world,sourceFeatureIds:[n.featureId,c.featureId].filter(Boolean)}),n=c}return r}function Bl(t,e=0){return[Math.min(t.a[0],t.b[0])-e,Math.min(t.a[1],t.b[1])-e,Math.max(t.a[0],t.b[0])+e,Math.max(t.a[1],t.b[1])+e]}function Ra(t){let e=String(t?.kind||""),s=String(t?.semanticRole||"")||e;return s==="pin_number"||s==="pin_name"?120:s==="pin_body"||e==="pin"?110:s==="symbol_reference"||s==="symbol_value"?92:e==="junction"||e==="no_connect"?88:e==="wire"||e==="bus"||e==="bus_entry"?78:s==="symbol_body"||e==="symbol_body"?45:e==="symbol_instance"||e==="symbol_overplot"?30:e==="text"||String(s).includes("text")?24:10}function Ia(t){let e=String(t?.kind||""),a=String(t?.semanticRole||"");if(e==="page"||e==="sheet_header")return!0;if(e==="graphic_rect"&&a==="graphic_rect"&&!t?.netUid&&!t?.componentUid){let s=t.boundsMm||[];return s[2]-s[0]>150&&s[3]-s[1]>120}return!1}function Em(t){if(!t||typeof t!="string")return null;let a=t.trim().match(/^#([0-9a-f]{6})([0-9a-f]{2})?$/i);if(!a)return null;let s=a[1],r=a[2]??"ff";return[parseInt(s.slice(0,2),16)/255,parseInt(s.slice(2,4),16)/255,parseInt(s.slice(4,6),16)/255,parseInt(r,16)/255]}function jn(t,e,a=""){let s=Em(a||t?.color||"");return t?.kind==="dnp_marker"?s||[.86,.04,.05,.85]:t?.dnp&&["symbol_reference","symbol_value","symbol_text"].includes(String(t?.kind||""))?[.5,.52,.54,.56]:s||(t?.dnp?[.5,.52,.54,.56]:Na(t)?[.12,.56,.2,.96]:t?.kind==="pin_name"?[0,.28,.31,.96]:t?.kind==="pin_number"?[.45,.17,.16,.96]:t?.kind==="pin_body"?[.28,.18,.18,.88]:t?.kind==="symbol_body"||t?.kind==="symbol_instance"?[.42,.18,.18,.72]:t?.kind==="symbol_reference"||t?.kind==="symbol_value"?[.05,.13,.16,.94]:t?.kind==="text"||String(e||"").startsWith("text")?[.05,.13,.16,.94]:[.16,.17,.19,.7])}function Fl(t,e,a=""){let s=jn(t,e,a);return[s[0]*.72,s[1]*.72,s[2]*.72,Math.min(s[3],.38)]}function Tm(t,e,a){return a?5.5:t?.kind==="dnp_marker"?3:["pin_name","pin_number"].includes(String(t?.kind||""))?1.5:t?.kind==="pin_body"?1.7:String(e||"").startsWith("text")?1.35:e==="bus"||t?.kind==="bus"?4.2:Na(t)?2.6:t?.kind==="symbol_body"||t?.kind==="symbol_instance"||t?.kind==="sheet"?1.5:1.25}function Vs(t,e,a,s){return t[e++]=a[0],t[e++]=a[1],t[e++]=s[0],t[e++]=s[1],t[e++]=s[2],t[e++]=s[3],e}function Mm(t,e,a,s,r,n){let i=Pl(a,s,r);if(!i)return e;for(let o of i)e=Vs(t,e,o,n);return e}function _m(t,e,a,s,r,n){return e=Vs(t,e,a,n),e=Vs(t,e,s,n),e=Vs(t,e,r,n),e}function Zt(t,e,a,s,r){return t[e++]=a[0],t[e++]=a[1],t[e++]=s,t[e++]=r,e}function Sm(t,e,a,s,r,n,i,o){let c=s[0]-a[0],l=s[1]-a[1],f=Math.hypot(c,l);if(f<1e-6||e+24>t.length)return e;let u=r*.5,g=c/f,h=-(l/f)*u,d=g*u,m=[a[0]+h,a[1]+d],b=[a[0]-h,a[1]-d],y=[s[0]+h,s[1]+d],x=[s[0]-h,s[1]-d],w=i+f/Math.max(o,1e-6);return e=Zt(t,e,m,i,n),e=Zt(t,e,b,i,n),e=Zt(t,e,y,w,n),e=Zt(t,e,y,w,n),e=Zt(t,e,b,i,n),e=Zt(t,e,x,w,n),e}function Pl(t,e,a){let s=e[0]-t[0],r=e[1]-t[1],n=Math.hypot(s,r);if(n<1e-6)return null;let i=a*.5,o=s/n*i,c=r/n*i,l=-r/n*i,f=s/n*i,u=[t[0]-o,t[1]-c],g=[e[0]+o,e[1]+c],p=[u[0]+l,u[1]+f],h=[u[0]-l,u[1]-f],d=[g[0]+l,g[1]+f],m=[g[0]-l,g[1]-f];return[p,h,d,d,h,m]}function Am(t,e,a){let s=a[0]-e[0],r=a[1]-e[1],n=s*s+r*r||1,i=he(((t[0]-e[0])*s+(t[1]-e[1])*r)/n,0,1),o=e[0]+s*i,c=e[1]+r*i;return Math.hypot(t[0]-o,t[1]-c)}function Rm(t,e){let[a,s,r,n]=e,[i,o]=t.a,[c,l]=t.b,f=1e-6,u=(g,p)=>({...t,a:g,b:p});if(Math.abs(o-l)<=f){let g=o;if(g<s-f||g>n+f)return[t];let p=Math.min(i,c),h=Math.max(i,c),d=Math.max(p,a),m=Math.min(h,r);if(m<=d+f)return[t];let b=[],y=i<=c;if(p<d-f){let x=y?[p,g]:[d,g],w=y?[d,g]:[p,g];b.push(u(x,w))}if(m<h-f){let x=y?[m,g]:[h,g],w=y?[h,g]:[m,g];b.push(u(x,w))}return b}if(Math.abs(i-c)<=f){let g=i;if(g<a-f||g>r+f)return[t];let p=Math.min(o,l),h=Math.max(o,l),d=Math.max(p,s),m=Math.min(h,n);if(m<=d+f)return[t];let b=[],y=o<=l;if(p<d-f){let x=y?[g,p]:[g,d],w=y?[g,d]:[g,p];b.push(u(x,w))}if(m<h-f){let x=y?[g,m]:[g,h],w=y?[g,h]:[g,m];b.push(u(x,w))}return b}return[t]}function Hs(t,e,a,s){let r=e*12;t.setFloat32(r,a[0],!0),t.setFloat32(r+4,a[1],!0),t.setUint32(r+8,s,!0)}function Im(t,e,a,s,r,n){let i=Pl(a,s,r);if(!i)return e;for(let o of i)Hs(t,e,o,n),e+=1;return e}function Pn(t,e,a,s,r,n){return Hs(t,e,a,n),Hs(t,e+1,s,n),Hs(t,e+2,r,n),e+3}function Nm(t,e){let a=Array.isArray(t?.layerIds)?t.layerIds:[];if(a.length<2&&t?.startLayerId!=null&&t?.endLayerId!=null&&(a=[t.startLayerId,t.endLayerId]),a.length<2&&t?.layerMask!=null)try{let s=BigInt(String(t.layerMask));a=e.filter((r,n)=>(s&1n<<BigInt(n))!==0n).map(r=>r.id)}catch{a=[]}return a}function Cm(t){let e=t?.objectFeatureId??t?.id;if(e!=null&&Number.isFinite(Number(e))&&Number(e)!==0)return`feature:${Number(e)}`;let a=String(t?.sourceUid||"");return a?`source:${a}`:""}function jl(t,e){let a=new Map(t.map((o,c)=>[Number(o.id),c])),s=new Map(t.map(o=>[Number(o.id),o])),r=new Map,n=new Set,i={thru:0,blind:0,buried:0};for(let o of e){let c=Cm(o);if(c){if(n.has(c))continue;n.add(c)}let l=[...new Set(Nm(o,t).map(Number))].filter(x=>a.has(x)).sort((x,w)=>a.get(x)-a.get(w));if(l.length<2)continue;let f=l[0],u=l[l.length-1],g=a.get(f),p=a.get(u),h=g===0,d=p===t.length-1,m=h&&d?"thru":h||d?"blind":"buried";i[m]+=1;let b=`${f}:${u}:${m}`,y=r.get(b);if(y){y.count+=1;continue}r.set(b,{startId:f,endId:u,startName:s.get(f)?.name||String(f),endName:s.get(u)?.name||String(u),startIndex:g,endIndex:p,type:m,count:1})}return{counts:i,spans:[...r.values()]}}var Ca="http://www.w3.org/2000/svg";var Bm=new Set(["script","foreignobject","iframe","object","embed"]),Fm=new Set(["href","xlink:href"]),Om=1,Pm=18,jm=8,$s=class t{static create(e,a,s,r,n={}){return new t(e,a,s,r,n)}constructor(e,a,s,r,n){this.host=e,this.manifestUrl=a,this.manifest=s,this.featuresByPage=r||{},this.callbacks=n,this.activePage=null,this.activeSvgUrl="",this.container=null,this.svg=null,this.overlay=null,this.mountedPages=new Map,this.loadingPages=new Map,this.svgCache=new Map,this.serial=0,this.maxMountedWorldPages=Om,this.maxCachedSvgPages=Pm,this.worldHandlersInstalled=!1,this.worldDrag=null,this.view={scale:1,tx:0,ty:0},this.drag=null,this.selected=null,this.highlightedNetUid="",this.index=zl(),this.lastStats={mountedPages:0,domNodes:0,indexedFeatures:0,indexedNets:0,mountMs:0,coldMounts:0,warmMounts:0,highlightMs:0,selectionMs:0,cachedSvgPages:0,cachedSvgBytes:0,heapMb:null,fallbackReason:""}}get active(){return!!(this.container&&this.activePage)}get worldActive(){return this.mountedPages.size>0}stats(){return{...this.lastStats,activePage:this.activePage?.name||[...this.mountedPages.values()][0]?.page?.name||"-",mountedPages:this.active?1:this.mountedPages.size}}dispose(){this.unmountPage(),this.unmountWorldPages()}unmountPage(){this.container?.remove(),this.container=null,this.svg=null,this.overlay=null,this.activePage=null,this.activeSvgUrl="",this.index=zl(),this.host.hidden=!0}unmountWorldPages(){for(let e of this.mountedPages.values())e.container.remove();this.mountedPages.clear(),this.loadingPages.clear(),this.active||(this.host.hidden=!0)}async preloadPages(e){let a=performance.now(),s=await Promise.allSettled((e||[]).slice(0,jm).map(r=>this.loadSvgTemplate(r)));this.lastStats.preloadedPages=s.filter(r=>r.status==="fulfilled"&&r.value).length,this.lastStats.preloadMs=performance.now()-a,this.updateCacheStats()}syncWorldPages(e,a,s={}){if(!a)return;this.installWorldHandlers(a);let r=(e||[]).slice(0,s.maxMountedPages||this.maxMountedWorldPages),n=new Set(r.map(i=>i.id));for(let[i,o]of this.mountedPages)n.has(i)||(o.container.remove(),this.mountedPages.delete(i));for(let i of r){let o=this.mountedPages.get(i.id);if(o)o.lastUsed=++this.serial,this.positionWorldEntry(o,a);else if(!this.loadingPages.has(i.id)){let c=this.mountWorldPage(i).then(l=>{l&&n.has(i.id)?this.positionWorldEntry(l,a):l?.container.remove()}).finally(()=>this.loadingPages.delete(i.id));this.loadingPages.set(i.id,c)}}this.pruneMountedWorldPages(n),this.host.hidden=r.length===0&&!this.active,this.setSelection(this.selected),this.setHighlightedNet(s.activeNetUid??this.highlightedNetUid),this.lastStats.mountedPages=this.mountedPages.size,this.updateCacheStats()}async mountWorldPage(e){let a=performance.now(),s=this.hasCachedSvg(e),r=await this.loadImportedSvg(e);if(!r)return null;let n=document.createElement("div");n.className="svg-dom-page svg-dom-world-page",n.dataset.pageId=e.id,n.append(r),this.host.append(n);let i=Dl(r),o=Ul(r),c=Ll(r,e,this.featuresByPage[e.id]||[]),l={page:e,container:n,svg:r,overlay:i,selectionOverlay:o,index:c,mountMs:performance.now()-a,lastUsed:++this.serial,warm:s};return this.mountedPages.set(e.id,l),this.lastStats={...this.lastStats,mountedPages:this.mountedPages.size,domNodes:[...this.mountedPages.values()].reduce((f,u)=>f+u.svg.querySelectorAll("*").length,0),indexedFeatures:[...this.mountedPages.values()].reduce((f,u)=>f+u.index.featureToElements.size,0),indexedNets:new Set([...this.mountedPages.values()].flatMap(f=>[...f.index.netToElements.keys()])).size,mountMs:l.mountMs,coldMounts:this.lastStats.coldMounts+(l.warm?0:1),warmMounts:this.lastStats.warmMounts+(l.warm?1:0),fallbackReason:""},this.updateCacheStats(),l}async loadImportedSvg(e){let a=await this.loadSvgTemplate(e);return a?a.cloneNode(!0):null}async loadSvgTemplate(e){let a=this.svgUrlForPage(e),s=this.svgCache.get(a);if(s?.template)return s.lastUsed=++this.serial,s.template;if(s?.promise)return s.promise;let r=performance.now(),n=(async()=>{let i=await fetch(a,{cache:"default"});if(!i.ok)return this.lastStats.fallbackReason=`Failed to load SVG page ${e.id}: ${i.status}`,this.callbacks.onFallback?.(this.lastStats.fallbackReason),null;let o=await i.text(),l=new DOMParser().parseFromString(o,"image/svg+xml"),f=l.documentElement;if(!f||f.localName.toLowerCase()!=="svg"||l.querySelector("parsererror"))return this.lastStats.fallbackReason=`Invalid SVG for page ${e.id}`,this.callbacks.onFallback?.(this.lastStats.fallbackReason),null;Lm(l,a,e.id);let u=document.importNode(f,!0);u.classList.add("svg-dom-page-svg"),Vm(u);let g=this.svgCache.get(a)||{};return Object.assign(g,{template:u,promise:null,pageId:e.id,byteLength:o.length*2,loadMs:performance.now()-r,lastUsed:++this.serial}),this.svgCache.set(a,g),this.pruneSvgCache(),this.updateCacheStats(),u})();return this.svgCache.set(a,{promise:n,pageId:e.id,byteLength:0,loadMs:0,lastUsed:++this.serial}),n}svgUrlForPage(e){return new URL(e.svg||e.thumbnail?.path,this.manifestUrl).toString()}positionWorldEntry(e,a){let{page:s,container:r}=e,[n,i]=a.worldToScreen(s.worldX,s.worldY),[o,c]=a.worldToScreen(s.worldX+s.widthMm,s.worldY+s.heightMm),l=Math.max(1,o-n),f=Math.max(1,c-i);r.style.transform=`translate3d(${n}px, ${i}px, 0)`,r.style.width=`${l}px`,r.style.height=`${f}px`}installWorldHandlers(e){if(this.worldHandlersInstalled)return;this.worldHandlersInstalled=!0;let a=this.host;a.oncontextmenu=s=>s.preventDefault(),a.onpointerdown=s=>{let r=s.button===0&&!s.shiftKey&&!!s.target.closest?.("text"),i=s.target.closest?.("[data-feature-key]")?null:this.featureAtEvent(s);this.worldDrag={pointerId:s.pointerId,startX:s.clientX,startY:s.clientY,lastX:s.clientX,lastY:s.clientY,button:s.button,moved:!1,pan:!r&&(s.button===0||s.button===1||s.shiftKey),allowTextSelection:r},r||a.setPointerCapture(s.pointerId)},a.onpointermove=s=>{if(!this.worldDrag||this.worldDrag.pointerId!==s.pointerId)return;let r=s.clientX-this.worldDrag.lastX,n=s.clientY-this.worldDrag.lastY;this.worldDrag.lastX=s.clientX,this.worldDrag.lastY=s.clientY,Math.hypot(s.clientX-this.worldDrag.startX,s.clientY-this.worldDrag.startY)>3&&(this.worldDrag.moved=!0),this.worldDrag.pan&&e.pan(r,n)},a.onpointerup=s=>{if(!this.worldDrag||this.worldDrag.pointerId!==s.pointerId)return;let r=this.worldDrag;if(this.worldDrag=null,r.allowTextSelection||a.releasePointerCapture(s.pointerId),r.button!==0||r.moved)return;let n=s.target.closest?.("[data-feature-key]");if(n)this.selectElement(n,s);else{let i=this.featureAtEvent(s);i?this.selectFeature(i.entry,i.feature,s):this.callbacks.onBlank?.()}},a.ondblclick=s=>{let r=s.target.closest?.("[data-feature-key]"),n=r?null:this.featureAtEvent(s),i=n?.entry||this.entryForPoint(s.clientX,s.clientY),o=r?this.selectionFromElement(r):n?this.selectionFromFeature(n.entry,n.feature):this.selected;Gl(o)?this.callbacks.onOpenPage?.(o):o?.netUid?this.callbacks.onHighlightNet?.(o.netUid,o):!n&&i?.page&&this.callbacks.onOpenPage?.({kind:"page",pageId:i.page.id,page:i.page})},a.onwheel=s=>{s.preventDefault(),Math.abs(s.deltaX)>Math.abs(s.deltaY)*.65?e.pan(-s.deltaX,-s.deltaY):e.zoom(s.deltaY,s.clientX,s.clientY)}}async focusPage(e,a={}){if(!e)return!1;if(this.activePage?.id===e.id&&this.active)return a.frame!==!1&&this.fitPage(),!0;let s=performance.now(),r=await this.loadImportedSvg(e);if(!r)return!1;let n=document.createElement("div");return n.className="svg-dom-page",n.append(r),this.host.replaceChildren(n),this.host.hidden=!1,this.container=n,this.svg=r,this.activePage=e,this.activeSvgUrl=new URL(e.svg||e.thumbnail?.path,this.manifestUrl).toString(),this.overlay=Dl(r),this.selectionOverlay=Ul(r),this.index=Ll(r,e,this.featuresByPage[e.id]||[]),this.installPageHandlers(),this.fitPage(),this.setSelection(this.selected),this.setHighlightedNet(this.highlightedNetUid),this.lastStats={...this.lastStats,mountedPages:1,domNodes:r.querySelectorAll("*").length,indexedFeatures:this.index.featureToElements.size,indexedNets:this.index.netToElements.size,mountMs:performance.now()-s,fallbackReason:""},this.updateCacheStats(),!0}installPageHandlers(){let e=this.host;e.oncontextmenu=a=>a.preventDefault(),e.onpointerdown=a=>{if(!this.active)return;let s=a.button===0&&!a.shiftKey&&!!a.target.closest?.("text"),r=a.target.closest?.("[data-feature-key]"),n=r?null:this.featureAtEvent(a);this.drag={pointerId:a.pointerId,startX:a.clientX,startY:a.clientY,lastX:a.clientX,lastY:a.clientY,button:a.button,moved:!1,pan:!s&&(a.button===0||a.button===1||a.shiftKey),featureElement:r,allowTextSelection:s},s||e.setPointerCapture(a.pointerId)},e.onpointermove=a=>{if(!this.drag||this.drag.pointerId!==a.pointerId)return;let s=a.clientX-this.drag.lastX,r=a.clientY-this.drag.lastY;this.drag.lastX=a.clientX,this.drag.lastY=a.clientY,Math.hypot(a.clientX-this.drag.startX,a.clientY-this.drag.startY)>3&&(this.drag.moved=!0),this.drag.pan&&(this.view.tx+=s,this.view.ty+=r,this.applyTransform())},e.onpointerup=a=>{if(!this.drag||this.drag.pointerId!==a.pointerId)return;let s=this.drag;if(this.drag=null,s.allowTextSelection||e.releasePointerCapture(a.pointerId),s.button!==0||s.moved)return;let r=a.target.closest?.("[data-feature-key]");if(r)this.selectElement(r,a);else{let n=this.featureAtEvent(a);n?this.selectFeature(n.entry,n.feature,a):this.callbacks.onBlank?.()}},e.ondblclick=a=>{let s=a.target.closest?.("[data-feature-key]"),r=s?null:this.featureAtEvent(a),n=s?this.selectionFromElement(s):r?this.selectionFromFeature(r.entry,r.feature):this.selected;Gl(n)?this.callbacks.onOpenPage?.(n):n?.netUid?this.callbacks.onHighlightNet?.(n.netUid,n):!r&&this.activePage&&this.callbacks.onOpenPage?.({kind:"page",pageId:this.activePage.id,page:this.activePage})},e.onwheel=a=>{if(a.preventDefault(),!this.active)return;if(Math.abs(a.deltaX)>Math.abs(a.deltaY)*.65){this.view.tx-=a.deltaX,this.view.ty-=a.deltaY,this.applyTransform();return}let s=this.host.getBoundingClientRect(),r=a.clientX-s.left,n=a.clientY-s.top,i=this.screenToSvg(r,n),o=Math.exp(-a.deltaY*.0016);this.view.scale=Ws(this.view.scale*o,.02,80),this.view.tx=r-i[0]*this.view.scale,this.view.ty=n-i[1]*this.view.scale,this.applyTransform()}}selectElement(e,a){let s=performance.now(),r=this.selectionFromElement(e);if(this.setSelection(r),a){let n=this.host.getBoundingClientRect();r.anchor={x:a.clientX-n.left,y:a.clientY-n.top}}this.callbacks.onSelect?.(r),this.lastStats.selectionMs=performance.now()-s}selectFeature(e,a,s){let r=performance.now(),n=this.selectionFromFeature(e,a);if(this.setSelection(n),s){let i=this.host.getBoundingClientRect();n.anchor={x:s.clientX-i.left,y:s.clientY-i.top}}this.callbacks.onSelect?.(n),this.lastStats.selectionMs=performance.now()-r}selectionFromElement(e){let a=e.dataset.featureKey||"",s=this.entryForElement(e),r=s.index.featureByKey.get(a)||{};return this.selectionFromFeature(s,r,e)}selectionFromFeature(e,a,s=null){let r=a?.stableKey||s?.dataset?.featureKey||"",n=e?.page||this.activePage,i=a?.kind||s?.dataset?.role||s?.dataset?.primitive||"feature",o=a?.netUid||s?.dataset?.netUid||"",c=a?.netName||s?.dataset?.netName||"";return i==="sheet"?{kind:"sheet",featureKey:r,sheetInstancePath:a?.sheetInstancePath||n?.sheetInstancePath||"",sourceId:a?.sourceId||s?.dataset?.sourceId||s?.dataset?.objectId||s?.dataset?.uuid||"",sheetName:a?.sheet_name||a?.sheetName||s?.dataset?.sheetName||a?.objectId||"",sheetFile:a?.sheet_file||a?.sheetFile||s?.dataset?.sheetFile||"",feature:a}:i==="pin"||i==="pin_body"||i==="pin_name"||i==="pin_number"||s?.dataset?.pin?{kind:"pin",featureKey:r,sheetInstancePath:a?.sheetInstancePath||n?.sheetInstancePath||"",sourceId:a?.sourceId||s?.dataset?.sourceId||s?.dataset?.objectId||s?.dataset?.uuid||"",symbolUuid:a?.symbolUuid||s?.dataset?.symbolUuid||"",reference:a?.reference||s?.dataset?.designator||s?.dataset?.component||s?.dataset?.ref||"",pinNumber:a?.pinNumber||s?.dataset?.pin||"",pinName:a?.pinName||"",netUid:o,netName:c,feature:a}:i==="symbol_body"||i==="symbol_instance"||i==="component"||s?.dataset?.ref?{kind:"component",featureKey:r,sheetInstancePath:a?.sheetInstancePath||n?.sheetInstancePath||"",sourceId:a?.sourceId||s?.dataset?.sourceId||s?.dataset?.objectId||s?.dataset?.uuid||"",symbolUuid:a?.symbolUuid||s?.dataset?.symbolUuid||"",reference:a?.reference||s?.dataset?.designator||s?.dataset?.component||s?.dataset?.ref||"",netUid:o,netName:c,feature:a}:{kind:o?"feature":i,featureKey:r,sheetInstancePath:a?.sheetInstancePath||n?.sheetInstancePath||"",sourceId:a?.sourceId||s?.dataset?.sourceId||s?.dataset?.objectId||s?.dataset?.uuid||"",role:i,netUid:o,netName:c,feature:a}}setSelection(e){this.selected=e||null;for(let s of this.host.querySelectorAll(".prism-svg-selected"))s.classList.remove("prism-svg-selected");for(let s of this.host.querySelectorAll("[data-prism-overlay='selection']"))s.replaceChildren();let a=e?.featureKey||"";if(a){for(let s of this.entries()){for(let r of s.index.featureToElements.get(a)||[])r.classList.add("prism-svg-selected");this.drawSelectionOverlay(s,e)}for(let s of this.index.featureToElements.get(a)||[])s.classList.add("prism-svg-selected");this.drawSelectionOverlay({page:this.activePage,index:this.index,selectionOverlay:this.selectionOverlay},e)}}setHighlightedNet(e){this.highlightedNetUid=e||"";let a=performance.now();for(let s of this.entries())this.updateEntryHighlight(s);if(!this.svg||!this.overlay){this.lastStats.highlightMs=performance.now()-a;return}this.updateEntryHighlight({svg:this.svg,overlay:this.overlay,index:this.index,page:this.activePage}),this.lastStats.highlightMs=performance.now()-a}updateEntryHighlight(e){if(!e?.svg||!e?.overlay||(e.overlay.replaceChildren(),!this.highlightedNetUid))return;let a=Xs(e.svg,e.page),s=document.createElementNS(Ca,"rect");s.setAttribute("x",String(a[0])),s.setAttribute("y",String(a[1])),s.setAttribute("width",String(a[2])),s.setAttribute("height",String(a[3])),s.setAttribute("class","prism-svg-net-dimmer"),e.overlay.append(s);let n=(e.index.netToElements.get(this.highlightedNetUid)||[]).slice(0,2200);for(let i of n){let o=Hm(i);e.overlay.append(o)}}entries(){return[...this.mountedPages.values()]}entryForElement(e){let s=e.closest?.(".svg-dom-page")?.dataset.pageId||"";return this.mountedPages.get(s)||{page:this.activePage,index:this.index,svg:this.svg,overlay:this.overlay,selectionOverlay:this.selectionOverlay}}featureAtEvent(e){let a=this.entryForPoint(e.clientX,e.clientY);if(!a)return null;let s=this.clientToSvg(a,e.clientX,e.clientY);if(!s)return null;let r=Math.max(.18,5*Wm(a)),i=a.index.features.filter(o=>(o?.domBoundsMm||o?.boundsMm)&&Hl(o)).filter(o=>s[0]>=(o.domBoundsMm||o.boundsMm)[0]-r&&s[0]<=(o.domBoundsMm||o.boundsMm)[2]+r&&s[1]>=(o.domBoundsMm||o.boundsMm)[1]-r&&s[1]<=(o.domBoundsMm||o.boundsMm)[3]+r).map(o=>({feature:o,priority:$m(o),area:Math.max(1e-4,((o.domBoundsMm||o.boundsMm)[2]-(o.domBoundsMm||o.boundsMm)[0])*((o.domBoundsMm||o.boundsMm)[3]-(o.domBoundsMm||o.boundsMm)[1]))})).sort((o,c)=>c.priority-o.priority||o.area-c.area)[0]?.feature;return i?{entry:a,feature:i,point:s}:null}entryForPoint(e,a){for(let s of[...this.entries()].reverse()){let r=s.container.getBoundingClientRect();if(e>=r.left&&e<=r.right&&a>=r.top&&a<=r.bottom)return s}if(this.container){let s=this.container.getBoundingClientRect();if(e>=s.left&&e<=s.right&&a>=s.top&&a<=s.bottom)return{page:this.activePage,container:this.container,svg:this.svg,index:this.index,selectionOverlay:this.selectionOverlay}}return null}clientToSvg(e,a,s){if(!e?.container||!e?.svg||!e?.page)return null;let r=e.container.getBoundingClientRect();if(!r.width||!r.height)return null;let n=Xs(e.svg,e.page);return[n[0]+(a-r.left)/r.width*n[2],n[1]+(s-r.top)/r.height*n[3]]}drawSelectionOverlay(e,a){if(!e?.selectionOverlay||!a?.featureKey)return;let s=e.index.featureByKey.get(a.featureKey),r=s?.domBoundsMm||s?.boundsMm;if(!r)return;let[n,i,o,c]=r,l=document.createElementNS(Ca,"rect");l.setAttribute("x",String(n)),l.setAttribute("y",String(i)),l.setAttribute("width",String(Math.max(.001,o-n))),l.setAttribute("height",String(Math.max(.001,c-i))),l.setAttribute("rx","0.65"),l.setAttribute("ry","0.65"),l.setAttribute("class","prism-svg-selection-box"),e.selectionOverlay.append(l)}fitPage(){if(!this.svg||!this.activePage)return;let e=Xs(this.svg,this.activePage),a=e[2]||this.activePage.sourceWidthMm||this.activePage.widthMm||1,s=e[3]||this.activePage.sourceHeightMm||this.activePage.heightMm||1,r=this.host.getBoundingClientRect(),n=Math.min(r.width/a,r.height/s)*.92;this.view.scale=Ws(n,.02,80),this.view.tx=(r.width-a*this.view.scale)/2-e[0]*this.view.scale,this.view.ty=(r.height-s*this.view.scale)/2-e[1]*this.view.scale,this.applyTransform()}frameSelection(e=this.selected){if(!e?.featureKey||!this.active){this.fitPage();return}let a=this.index.featureToElements.get(e.featureKey)||[],s=Vl(a);if(!s)return;let r=this.host.getBoundingClientRect(),n=Math.max(1,s[2]-s[0]),i=Math.max(1,s[3]-s[1]),o=Math.min(r.width/n,r.height/i)*.36;this.view.scale=Ws(o,.04,80),this.view.tx=r.width/2-(s[0]+s[2])/2*this.view.scale,this.view.ty=r.height/2-(s[1]+s[3])/2*this.view.scale,this.applyTransform()}pan(e,a){this.active&&(this.view.tx+=e,this.view.ty+=a,this.applyTransform())}zoom(e,a,s){if(!this.active)return;let r=this.host.getBoundingClientRect(),n=(a??r.left+r.width/2)-r.left,i=(s??r.top+r.height/2)-r.top,o=this.screenToSvg(n,i),c=Math.exp(-e*.0016);this.view.scale=Ws(this.view.scale*c,.02,80),this.view.tx=n-o[0]*this.view.scale,this.view.ty=i-o[1]*this.view.scale,this.applyTransform()}screenToSvg(e,a){return[(e-this.view.tx)/Math.max(1e-6,this.view.scale),(a-this.view.ty)/Math.max(1e-6,this.view.scale)]}applyTransform(){this.container&&(this.container.style.transform=`translate3d(${this.view.tx}px, ${this.view.ty}px, 0) scale(${this.view.scale})`)}hasCachedSvg(e){return!!this.svgCache.get(this.svgUrlForPage(e))?.template}pruneMountedWorldPages(e=new Set){if(this.mountedPages.size<=this.maxMountedWorldPages)return;let a=[...this.mountedPages.entries()].filter(([s])=>!e.has(s)).sort((s,r)=>(s[1].lastUsed||0)-(r[1].lastUsed||0));for(let[s,r]of a){if(this.mountedPages.size<=this.maxMountedWorldPages)break;r.container.remove(),this.mountedPages.delete(s)}}pruneSvgCache(){let e=[...this.svgCache.entries()].filter(([,r])=>r?.template);if(e.length<=this.maxCachedSvgPages)return;let a=new Set([...this.mountedPages.values()].map(r=>this.svgUrlForPage(r.page)));this.activePage&&a.add(this.svgUrlForPage(this.activePage));let s=e.filter(([r])=>!a.has(r)).sort((r,n)=>(r[1].lastUsed||0)-(n[1].lastUsed||0));for(let[r]of s){if([...this.svgCache.values()].filter(n=>n?.template).length<=this.maxCachedSvgPages)break;this.svgCache.delete(r)}}updateCacheStats(){let e=[...this.svgCache.values()].filter(s=>s?.template);this.lastStats.cachedSvgPages=e.length,this.lastStats.cachedSvgBytes=e.reduce((s,r)=>s+(r.byteLength||0),0);let a=performance?.memory;this.lastStats.heapMb=a?.usedJSHeapSize?a.usedJSHeapSize/1048576:null}};function Lm(t,e,a){for(let n of[...t.querySelectorAll("*")]){if(Bm.has(n.localName.toLowerCase())){n.remove();continue}for(let i of[...n.attributes]){let o=i.name,c=o.toLowerCase(),l=i.value||"";if(c.startsWith("on")){n.removeAttribute(o);continue}if((c==="href"||c==="xlink:href"||c==="src")&&ql(l)){if((c==="href"||c==="xlink:href")&&n.localName.toLowerCase()==="image"&&Jm(l))continue;n.removeAttribute(o);continue}c==="style"&&n.setAttribute(o,Zm(l))}}let s=`prism-${Ln(a)}-`,r=new Map;for(let n of t.querySelectorAll("[id]")){let i=n.getAttribute("id"),o=`${s}${Ln(i)}`;r.set(i,o),n.setAttribute("id",o)}for(let n of t.querySelectorAll("*"))for(let i of[...n.attributes]){let o=i.name.toLowerCase(),c=i.value||"";Fm.has(o)&&(c.startsWith("#")&&r.has(c.slice(1))?c=`#${r.get(c.slice(1))}`:Qm(c)&&(c=new URL(c,e).toString())),c=ey(c,r),n.setAttribute(i.name,c)}}function Ll(t,e,a){let s=new Map,r=new Map,n=new Map,i=[];for(let f of a){let u=zm(f,e);i.push(u),r.set(u.stableKey,u),n.set(Number(u.id||0),u);for(let g of Gm(u))s.has(g)||s.set(g,[]),s.get(g).push(u)}let o=new Map,c=new Map,l=new Map;for(let f of i)l.set(f.stableKey,f);for(let f of t.querySelectorAll("[data-uuid], [data-element-key], [data-primitive], [data-ref], [data-pin], [data-object-id], [data-designator], [data-component]")){let u=Dm(f,s,e);if(u&&!Hl(u)||!u&&!Ym(f))continue;let g=Km(f,e),p=u?.stableKey||g,h=u?.netUid||"",d=u?.netName||"";f.classList.add("prism-feature"),f.dataset.featureKey=p,f.dataset.sourceId=u?.sourceId||f.dataset.uuid||f.dataset.elementKey||"",f.dataset.role=u?.kind||f.dataset.primitive||f.dataset.ref||"feature",u?.id&&(f.dataset.featureId=String(u.id)),h&&(f.dataset.netUid=h),d&&(f.dataset.netName=d),f.id||(f.id=`prism-feature-${Ln(p)}`),Kl(o,p,f),l.set(p,u||{id:0,stableKey:p,kind:f.dataset.role,sourceId:f.dataset.sourceId,sheetInstancePath:e.sheetInstancePath||""}),h&&Kl(c,h,f)}for(let[f,u]of o){let g=l.get(f),p=Vl(u);g&&p&&(g.domBoundsMm=qm(g.boundsMm,p))}return{featureToElements:o,netToElements:c,featureByKey:l,byId:n,bySource:s,features:i}}function Dm(t,e,a){let r=[t.dataset.uuid,t.dataset.elementKey,t.dataset.sourceId,t.dataset.objectId,t.dataset.componentUid,t.dataset.componentUuid,t.dataset.ref&&`${t.dataset.ref}:${t.dataset.pin||""}`].filter(Boolean).flatMap(i=>e.get(i)||[]);if(!r.length)return null;let n=String(t.dataset.primitive||t.dataset.ref||t.dataset.pin||"").toLowerCase();return r.map(i=>({feature:i,score:Um(i,n,a)})).sort((i,o)=>o.score-i.score)[0].feature}function Um(t,e,a){let s=0,r=String(t.kind||"").toLowerCase();return t.sheetInstancePath===a.sheetInstancePath&&(s+=20),t.netUid&&(s+=4),e&&r.includes(e)&&(s+=8),e==="symbol"&&r==="symbol_body"&&(s+=12),(e==="label"||e==="port")&&(r.includes("label")||r.includes("port"))&&(s+=12),e==="sheet"&&r==="sheet"&&(s+=12),r!=="record"&&(s+=2),r.includes("pin")&&(s+=2),s}function zm(t,e){let a=t.sourceId||t.sourceUid||t.uuid||t.objectId||t.stableKey||"";return{...t,id:Number(t.id||0),sourceId:a,stableKey:t.stableKey||`${e.sheetInstancePath||e.id}|${a}|0|${t.kind||"feature"}|0`,sheetInstancePath:t.sheetInstancePath||e.sheetInstancePath||""}}function Gm(t){let e=new Set([t.sourceId,t.sourceUid,t.uuid,t.objectId,t.stableKey].filter(Boolean).map(String));return t.reference&&t.pinNumber&&e.add(`${t.reference}:${t.pinNumber}`),t.componentDesignator&&e.add(t.componentDesignator),t.reference&&e.add(t.reference),[...e]}function Km(t,e){let a=t.dataset.uuid||t.dataset.elementKey||t.dataset.objectId||t.dataset.ref||t.id||"svg",s=t.dataset.primitive||t.dataset.role||t.localName||"feature";return`${e.sheetInstancePath||e.id}|${a}|0|${s}|0`}function Vm(t){let e=document.createElementNS(Ca,"style");e.textContent=`
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
  `,t.prepend(e)}function Dl(t){let e=document.createElementNS(Ca,"g");return e.setAttribute("class","prism-svg-net-overlay"),e.setAttribute("data-prism-overlay","net-highlight"),t.append(e),e}function Ul(t){let e=document.createElementNS(Ca,"g");return e.setAttribute("class","prism-svg-selection-overlay"),e.setAttribute("data-prism-overlay","selection"),e.style.pointerEvents="none",t.append(e),e}function Hm(t){let e=t.cloneNode(!0);e.removeAttribute("id"),e.removeAttribute("data-feature-key"),e.removeAttribute("data-net-uid"),e.removeAttribute("data-net-name"),e.classList.add("prism-svg-net-overlay-clone");for(let a of[e,...Array.from(e.querySelectorAll?.("*")||[])])a instanceof SVGElement&&(a.removeAttribute("filter"),a.style.pointerEvents="none",a.style.stroke="#18ef52",a.style.fill="none",a.style.opacity="0.98",a.style.vectorEffect="non-scaling-stroke");return e}function Vl(t){let e=null;for(let a of t)if(a.getBBox)try{let s=a.getBBox(),r=[s.x,s.y,s.x+s.width,s.y+s.height];e=e?[Math.min(e[0],r[0]),Math.min(e[1],r[1]),Math.max(e[2],r[2]),Math.max(e[3],r[3])]:r}catch{}return e}function qm(t,e){return t?e?[Math.min(t[0],e[0]),Math.min(t[1],e[1]),Math.max(t[2],e[2]),Math.max(t[3],e[3])]:t:e}function Xs(t,e){let a=t.getAttribute("viewBox");if(a){let s=a.trim().split(/[\s,]+/).map(Number);if(s.length===4&&s.every(Number.isFinite))return s}return[0,0,e.sourceWidthMm||e.widthMm||1,e.sourceHeightMm||e.heightMm||1]}function zl(){return{featureToElements:new Map,netToElements:new Map,featureByKey:new Map,byId:new Map,bySource:new Map,features:[]}}function Wm(t){let e=t?.container?.getBoundingClientRect?.();if(!t?.svg||!t?.page||!e?.width||!e?.height)return .1;let a=Xs(t.svg,t.page);return Math.max(a[2]/e.width,a[3]/e.height)}function Xm(t){let e=String(t?.kind||"").toLowerCase(),a=String(t?.semanticRole||"").toLowerCase(),s=`${t?.sourceId||""} ${t?.objectId||""} ${t?.text||""}`.toLowerCase();return e.includes("page")||a.includes("page")||e.includes("background")||a.includes("background")||s.includes("background")||s.includes("sheet_header")||s.includes("sheet header")||s.includes("drawing-sheet")}function $m(t){let e=String(t?.kind||t?.semanticRole||"").toLowerCase();return e.includes("pin")?90:e.includes("label")||e.includes("port")?78:e.includes("wire")||e.includes("bus")||e.includes("junction")?70:e.includes("symbol")||e.includes("component")?54:e.includes("image")?30:20}function Hl(t){if(!t||Xm(t))return!1;let e=String(t.kind||t.semanticRole||"").toLowerCase();return["pin","label","port","wire","bus","junction","no_connect","symbol","component","sheet","image","text"].some(a=>e.includes(a))}function Ym(t){let e=`${t?.dataset?.primitive||""} ${t?.dataset?.ref||""} ${t?.dataset?.role||""} ${t?.dataset?.objectId||""} ${t?.dataset?.text||""}`.toLowerCase();return!e||e.includes("background")||e.includes("sheet_header")||e.includes("sheet header")||e.includes("drawing-sheet")?!1:["pin","label","port","wire","bus","junction","no_connect","symbol","component","sheet","image","text"].some(a=>e.includes(a))}function Gl(t){return String(t?.kind||t?.feature?.kind||"").toLowerCase()==="sheet"}function Kl(t,e,a){t.has(e)||t.set(e,[]),t.get(e).push(a)}function ql(t){let e=String(t||"").trim().toLowerCase();return!e||e.startsWith("#")?!1:e.startsWith("javascript:")||e.startsWith("data:")||e.startsWith("http://")||e.startsWith("https://")}function Jm(t){return/^data:image\/(?:png|jpe?g|gif|webp);base64,[a-z0-9+/=\s]+$/i.test(String(t||"").trim())}function Qm(t){let e=String(t||"").trim();return e&&!e.startsWith("#")&&!/^[a-z][a-z0-9+.-]*:/i.test(e)}function Zm(t){return String(t||"").replace(/url\(([^)]+)\)/gi,(e,a)=>{let s=a.trim().replace(/^['"]|['"]$/g,"");return ql(s)?"none":e})}function ey(t,e){let a=String(t||"");return a=a.replace(/url\(#([^)]+)\)/g,(s,r)=>e.has(r)?`url(#${e.get(r)})`:s),a=a.replace(/^#(.+)$/,(s,r)=>e.has(r)?`#${e.get(r)}`:s),a}function Ln(t){return String(t||"").trim().replace(/[^a-zA-Z0-9_-]+/g,"-").replace(/^-+|-+$/g,"").slice(0,96)||"item"}function Ws(t,e,a){return Math.max(e,Math.min(a,t))}function Wl(t,e,a){let s=ty(Array.from(t,Number));if(!s)return null;let r=l=>{let f=[0,1,2,3].map(u=>s[u]*e+s[4+u]*a+s[8+u]*l+s[12+u]);return f.slice(0,3).map(u=>u/f[3])},n=r(1),o=r(0).map((l,f)=>l-n[f]),c=Math.hypot(...o);return c>0?{origin:n,direction:o.map(l=>l/c)}:null}function ty(t){let e=new Array(16);e[0]=t[5]*t[10]*t[15]-t[5]*t[11]*t[14]-t[9]*t[6]*t[15]+t[9]*t[7]*t[14]+t[13]*t[6]*t[11]-t[13]*t[7]*t[10],e[4]=-t[4]*t[10]*t[15]+t[4]*t[11]*t[14]+t[8]*t[6]*t[15]-t[8]*t[7]*t[14]-t[12]*t[6]*t[11]+t[12]*t[7]*t[10],e[8]=t[4]*t[9]*t[15]-t[4]*t[11]*t[13]-t[8]*t[5]*t[15]+t[8]*t[7]*t[13]+t[12]*t[5]*t[11]-t[12]*t[7]*t[9],e[12]=-t[4]*t[9]*t[14]+t[4]*t[10]*t[13]+t[8]*t[5]*t[14]-t[8]*t[6]*t[13]-t[12]*t[5]*t[10]+t[12]*t[6]*t[9],e[1]=-t[1]*t[10]*t[15]+t[1]*t[11]*t[14]+t[9]*t[2]*t[15]-t[9]*t[3]*t[14]-t[13]*t[2]*t[11]+t[13]*t[3]*t[10],e[5]=t[0]*t[10]*t[15]-t[0]*t[11]*t[14]-t[8]*t[2]*t[15]+t[8]*t[3]*t[14]+t[12]*t[2]*t[11]-t[12]*t[3]*t[10],e[9]=-t[0]*t[9]*t[15]+t[0]*t[11]*t[13]+t[8]*t[1]*t[15]-t[8]*t[3]*t[13]-t[12]*t[1]*t[11]+t[12]*t[3]*t[9],e[13]=t[0]*t[9]*t[14]-t[0]*t[10]*t[13]-t[8]*t[1]*t[14]+t[8]*t[2]*t[13]+t[12]*t[1]*t[10]-t[12]*t[2]*t[9],e[2]=t[1]*t[6]*t[15]-t[1]*t[7]*t[14]-t[5]*t[2]*t[15]+t[5]*t[3]*t[14]+t[13]*t[2]*t[7]-t[13]*t[3]*t[6],e[6]=-t[0]*t[6]*t[15]+t[0]*t[7]*t[14]+t[4]*t[2]*t[15]-t[4]*t[3]*t[14]-t[12]*t[2]*t[7]+t[12]*t[3]*t[6],e[10]=t[0]*t[5]*t[15]-t[0]*t[7]*t[13]-t[4]*t[1]*t[15]+t[4]*t[3]*t[13]+t[12]*t[1]*t[7]-t[12]*t[3]*t[5],e[14]=-t[0]*t[5]*t[14]+t[0]*t[6]*t[13]+t[4]*t[1]*t[14]-t[4]*t[2]*t[13]-t[12]*t[1]*t[6]+t[12]*t[2]*t[5],e[3]=-t[1]*t[6]*t[11]+t[1]*t[7]*t[10]+t[5]*t[2]*t[11]-t[5]*t[3]*t[10]-t[9]*t[2]*t[7]+t[9]*t[3]*t[6],e[7]=t[0]*t[6]*t[11]-t[0]*t[7]*t[10]-t[4]*t[2]*t[11]+t[4]*t[3]*t[10]+t[8]*t[2]*t[7]-t[8]*t[3]*t[6],e[11]=-t[0]*t[5]*t[11]+t[0]*t[7]*t[9]+t[4]*t[1]*t[11]-t[4]*t[3]*t[9]-t[8]*t[1]*t[7]+t[8]*t[3]*t[5],e[15]=t[0]*t[5]*t[10]-t[0]*t[6]*t[9]-t[4]*t[1]*t[10]+t[4]*t[2]*t[9]+t[8]*t[1]*t[6]-t[8]*t[2]*t[5];let a=t[0]*e[0]+t[1]*e[4]+t[2]*e[8]+t[3]*e[12];return Math.abs(a)<1e-30?null:e.map(s=>s/a)}function $l(t,e,a=0){return[t/1e3,-e/1e3,a]}function ay({rotation:t=0,mirror:e=!1,tilt:a=0}){let s=e?[-1,0,0]:[1,0,0],r=[0,1,0],n=e?[0,0,-1]:[0,0,1],i=Math.cos(t),o=Math.sin(t),c=s.map((h,d)=>i*h+o*r[d]),l=r.map((h,d)=>-o*s[d]+i*h),f=Math.cos(a),u=Math.sin(a),g=n.map((h,d)=>f*h-u*l[d]),p=l.map((h,d)=>u*n[d]+f*h);return{right:c,up:p,back:g}}function Un(t,e,a,s,r=0){let{up:n,back:i}=ay(t),o=$l(t.center[0],t.center[1],r),c=s*3,l=o.map((g,p)=>g+i[p]*c),f=1/(t.zoom*1e3),u=fs(e*f,a*f,-s*40,s*40);return ds(u,us(l,o,n))}function sy(t,e,a,s){let[r,n,i]=s,o=t[0]*r+t[4]*n+t[8]*i+t[12],c=t[1]*r+t[5]*n+t[9]*i+t[13],l=t[3]*r+t[7]*n+t[11]*i+t[15];return l>0?[(o/l+1)/2*e,(1-c/l)/2*a]:null}function Ba(t){let e=t[0]*1e3,a=t[3]*1e3,s=-t[4]*1e3,r=-t[1]*1e3;return{box:{x:e,y:s,w:a-e,h:r-s},bottom:t[2]+t[5]<0}}function zn(t,e){return t?e?t[2]:t[5]:0}function Yl(t,e,a,s,r){let n=Ot(t),i=Un(e,a,s,n,e.focusZ??0);return sy(i,a,s,$l(r[0],r[1],e.focusZ??0))}var ry=([t,e,a,s])=>({x:Math.min(t,a),y:Math.min(e,s),w:Math.abs(a-t),h:Math.abs(s-e)}),Dn=t=>[t.x+t.w/2,t.y+t.h/2],Xl=new WeakMap;function ny(t,e){let a=Xl.get(t);if(a)return a;let s=new Map,r=new Map;for(let c of t.features.values()){if(c.sourceUid&&s.set(String(c.sourceUid),c),c.kind!=="pad")continue;let l=/^(.*):pad:\d+:(.+)$/.exec(String(c.sourceUid||""));if(!l)continue;let f=`${l[1]}\0${l[2]}`;r.has(f)||r.set(f,[]),r.get(f).push(c)}let n=new Map;for(let c of e?.physical_objects||[])c.kind==="footprint_body"&&c.designator&&c.bbox_mm?.length===4&&n.set(c.designator,c);let i=new Map((e?.physical_objects||[]).map(c=>[c.uid,c])),o={bySource:s,padsByFootprintPin:r,bodies:n,objects:i};return Xl.set(t,o),o}function Jl({scene:t,topology:e},a,s){let r=String(a),n=t.componentFeatures.get(r);if(!n)return null;let i=ny(t,e),o=t.features.get(Number(n.featureId)),c=i.bodies.get(r),l=o?.bounds?Ba(o.bounds).box:c?ry(c.bbox_mm.map(Number)):null,f=o?.bounds?Ba(o.bounds).bottom:String(c?.layer||"").startsWith("B."),u=null;if(s!=null&&s!==""){let p=(e?.terminals||[]).find(d=>d.designator===r&&String(d.pin)===String(s)),h=p?.pcb_pad_id?i.objects.get(p.pcb_pad_id):null;if(u=h?.source_ids?.[0]&&i.bySource.get(String(h.source_ids[0]))||null,!u){let d=i.padsByFootprintPin.get(`${n.footprint}\0${s}`)||[],m=l?Dn(l):null,b=1/0;for(let y of d){let x=Dn(Ba(y.bounds).box),w=m?Math.hypot(x[0]-m[0],x[1]-m[1]):0;w<b&&([b,u]=[w,y])}}}let g=u?.bounds?Ba(u.bounds).box:null;return!l&&g&&(l=g,f=Ba(u.bounds).bottom),l?{reference:r,pin:u?String(s):null,focus:l,anchor:Dn(g||l),anchorBox:g,bottom:f,surfaceZ:zn(t.runtimeBounds,f)}:null}var Ys=class{#e=new Map;constructor(e=3e3){this.ttlMs=e}get size(){return this.#e.size}record(e,a,s){this.#e.set(e,{matrix:a,at:s})}release(e){this.#e.delete(e)}clear(){this.#e.clear()}active(e){let a=[];for(let[s,r]of this.#e)e-r.at>this.ttlMs?this.#e.delete(s):a.push(r.matrix);return a}};var Kn=1.5*1024*1024*1024;function Ql(t){let e=Number(t);return Number.isFinite(e)&&e>0?e:Kn}function iy(t,e){if(e.netName||e.netUid){let a=e.netUid&&t.find(s=>s.uid===e.netUid)||e.netName&&Xt(t,e.netName);return a?{kind:"net",id:Number(a.id)}:{kind:"unresolved"}}return e.netId?{kind:"net",id:Number(e.netId)}:e.featureId?{kind:"feature",id:Number(e.featureId)}:e.reference?{kind:"component",reference:String(e.reference)}:{kind:"board"}}function Zl(t,e){if(!t||!e||t.occurrence!=null)return!1;let a=s=>String(s??"");return t.reference||e.reference?a(t.reference)===a(e.reference)&&a(t.pin)===a(e.pin):t.featureId&&e.featureId?Number(t.featureId)===Number(e.featureId):t.netName&&e.netName?a(t.netName)===a(e.netName):t.netCode&&e.netCode?Number(t.netCode)===Number(e.netCode):!1}function oy(t,e){if(e.kind==="net")t.selectNet(e.id,!0);else if(e.kind==="feature")t.selectFeature(e.id,!0);else if(e.kind==="component")t.selectComponent(e.reference,!0);else return!1;return!0}function cy(t,e){return e&&!t?"enter":!e&&t?"leave":null}function Vn(){return{selection:null,gpuBudget:null}}var ly=Object.freeze(["setSelection","resize","getViewState","setLayerVisible","applyLayerPreset","setShowBoard","setShowComponents","setShowPlaceholders","setRealisticColors","setBoardLayerVisible","setSeparation","showNetLayers","setNetIsolation","setStatsOverlay","getStats","setLodOverride","setGpuBudget","pickAt","projectComponent","projectPoint"]),Gn=class{#e=null;constructor(e=Vn()){this.shared=e}get port(){return this.#e}attach(e){if(!e)throw new TypeError("A mode controller attaches to a mounted scene port");this.detach(),this.#e=e,this.replay(e)}detach(){let e=this.#e;this.#e=null,this.release(),e?.dispose?.()}replay(){}release(){}setSelection(e){this.shared.selection=e||null;let a=this.#e;a?.takeEcho?.(this.shared.selection)||a&&a.quietly(()=>this.applySelection(a,this.shared.selection))}setGpuBudget(e){this.shared.gpuBudget=e,this.#e?.setGpuBudget(Ql(e))}resize(){this.#e?.resize()}getViewState(){return this.#e?.getViewState()??null}setLayerVisible(e,a,s=null){this.#e?.setLayerVisible(e,a,s)}applyLayerPreset(e,a=null){this.#e?.applyLayerPreset(e,a)}setShowBoard(e){this.#e?.setShowBoard(e)}setShowComponents(e){this.#e?.setShowComponents(e)}setShowPlaceholders(e){this.#e?.setShowPlaceholders(e)}setRealisticColors(e){this.#e?.setRealisticColors(e)}setBoardLayerVisible(e,a,s){this.#e?.setBoardLayerVisible(e,a,s)}setSeparation(e,a=null){this.#e?.setSeparation(e,a)}showNetLayers(){this.#e?.showNetLayers()}setNetIsolation(e){this.#e?.setNetIsolation(e)}setStatsOverlay(e){this.#e?.setStatsOverlay(e)}getStats(){return this.#e?.stats()??null}setLodOverride(e){this.#e?.setLodOverride(e)}pickAt(e,a){return Promise.resolve(this.#e?.pickAt(e,a)??null)}projectComponent(e,a){return this.#e?.projectComponent(e,a)??null}projectPoint(e,a){return this.#e?.projectPoint(e,a)??null}},dy=Object.freeze(["setHighlightedNets","setHiddenComponents","getComponentReferences","setViewMode","renderInset","insetReady","insetSurfaceZ","releaseInset","insetTarget","projectInset","onSceneChange","insetStats","insetSettings","gpuIdle","loadAnalyticPack","setAnalyticOverlay","setAnalyticVectors","setAnalyticStyle","analyticColormaps","setAnalyticRelief","setClickSelect","analyticProbe","analyticAt","analyticStats","unloadAnalyticPack"]),Js=class extends Gn{#e=[];#a=null;#r="pcb";#n=new Set;#i=null;#t=null;#o=!0;#s=null;attach(e,{workspace:a="pcb"}={}){this.#r=a,super.attach(e)}replay(e){this.#i=e.onSceneChange?.(()=>this.#l())??null,this.#l(),e.setWorkspace(this.#r),this.#a&&e.setHiddenComponents(this.#a),this.shared.gpuBudget!=null&&e.setGpuBudget(Ql(this.shared.gpuBudget)),this.shared.selection&&e.quietly(()=>this.applySelection(e,this.shared.selection)),this.#e.length&&this.#c(e,this.#e),this.#t&&this.#d(e,this.#t),this.#o||e.setClickSelect(!1)}async#d(e,a){await e.loadAnalyticPack(a.bytes,a.options),a.overlay&&e.setAnalyticOverlay(a.overlay),this.#s&&e.setAnalyticRelief(this.#s),a.style&&e.setAnalyticStyle(a.style),a.vectors&&e.setAnalyticVectors(a.vectors)}release(){this.#i?.(),this.#i=null}applySelection(e,a){a?.occurrence!=null&&e.selectOccurrence(a.occurrence),a?oy(e,iy(e.nets(),a)):e.clearSelection()}setWorkspace(e){this.#r=e,this.port?.setWorkspace(e)}setHighlightedNets(e){this.#e=Array.isArray(e)?[...e]:[];let a=this.port;a&&this.#c(a,this.#e)}#c(e,a){let s=uo(e.nets(),a),r=e.anyEmphasis();e.setHighlightedNetIds(s);let n=e.anyEmphasis(),i=cy(r,n);i==="enter"?e.showNetProbe():i==="leave"&&e.restoreVisibility(),e.isolating()&&n&&e.isolateLitNets()}setHiddenComponents(e){this.#a=Array.isArray(e)?[...e]:[],this.port?.setHiddenComponents(this.#a)}getComponentReferences(){return this.port?.getComponentReferences()??[]}setViewMode(e){this.port?.setViewMode(e)}renderInset(e,a,s){return!!this.port?.renderInset(e,a,s)}insetReady(){return!!this.port?.insetReady()}insetSurfaceZ(e){let a=this.port;return a?zn(a.insetBoard().scene.runtimeBounds,!!e):0}releaseInset(e){this.port?.releaseInset(String(e))}insetTarget(e,a){let s=this.port;return s?Jl(s.insetBoard(),e,a):null}projectInset(e,a,s,r){let n=this.port;return n?Yl(n.insetBoard().scene.runtimeBounds,e,a,s,r):null}onSceneChange(e){return this.#n.add(e),()=>this.#n.delete(e)}#l(){for(let e of this.#n)e()}insetStats(){return this.port?.insetStats()??null}insetSettings(e){return this.port?.insetSettings(e)??null}gpuIdle(){return this.port?.gpuIdle()??Promise.resolve()}async loadAnalyticPack(e,a={}){let s=e instanceof Uint8Array?e:new Uint8Array(e);return this.#t={bytes:s,options:a,overlay:null,vectors:null,style:this.#t?.style??null},this.port?this.port.loadAnalyticPack(s,a):null}setAnalyticOverlay(e){return this.#t&&(this.#t.overlay=e),this.port?.setAnalyticOverlay(e)??null}setAnalyticVectors(e){return this.#t&&(this.#t.vectors=e),this.port?.setAnalyticVectors(e)??null}setAnalyticStyle(e){return this.#t&&(this.#t.style={...this.#t.style||{},...e}),this.port?.setAnalyticStyle(e)??null}analyticColormaps(){return this.port?.analyticColormaps()??null}setAnalyticRelief(e){return this.#s=e||null,this.port?.setAnalyticRelief(this.#s)??null}setClickSelect(e){this.#o=e!==!1,this.port?.setClickSelect(this.#o)}analyticProbe(e,a){return this.port?.analyticProbe(e,a)??null}analyticAt(e,a){return this.port?.analyticAt(e,a)??Promise.resolve(null)}analyticStats(){return this.port?.analyticStats()??null}unloadAnalyticPack(){this.#t=null,this.port?.unloadAnalyticPack()}};function ed(t){let e=(a,s)=>{for(let r of a)Object.defineProperty(t,r,{configurable:!0,writable:!0,value(...n){return s(this)[r](...n)}})};e(ly,a=>a.activeMode),e(dy,a=>a.modes.board)}var qn=Object.freeze({viridis:["#440154","#482878","#3e4989","#31688e","#26828e","#1f9e89","#35b779","#6ece58","#b5de2b","#fde725"],inferno:["#000004","#1b0c41","#4a0c6b","#781c6d","#a52c60","#cf4446","#ed6925","#fb9b06","#f7d13d","#fcffa4"],magma:["#000004","#180f3d","#440f76","#721f81","#9e2f7f","#cd4071","#f1605d","#fd9668","#feca8d","#fcfdbf"],plasma:["#0d0887","#46039f","#7201a8","#9c179e","#bd3786","#d8576b","#ed7953","#fb9f3a","#fdca26","#f0f921"],cividis:["#00224e","#123570","#3b496c","#575d6d","#707173","#8a8678","#a59c74","#c3b369","#e1cc55","#fee838"],turbo:["#30123b","#4662d7","#36aaf9","#1ae4b6","#72fe5e","#c8ef34","#faba39","#f66b19","#ca2a04","#7a0403"],coolwarm:["#3b4cc0","#6788ee","#9abbff","#c9d7f0","#edd1c2","#f7a889","#e26952","#b40426"],ember:["#e0e3ed","#ff9e1f","#db141a"],ice:["#f4f7fb","#9ecae1","#2171b5","#08306b"],white:["#fafaf5","#fafaf5"],greys:["#f7f7f7","#bdbdbd","#737373","#252525"]}),ta=256,Fa=Object.freeze({fieldColormap:"viridis",arrowColormap:"ember",arrowDensity:70,arrowWidth:.07,arrowMinLength:.3,arrowOutline:[.05,.05,.07,.85]});function td(t){let e=String(t).replace(/^#/,"");if(!/^[0-9a-fA-F]{6}$/.test(e))throw new TypeError(`colour ${t} is not #rrggbb`);return[0,2,4].map(a=>Number.parseInt(e.slice(a,a+2),16)/255)}function Hn(t){if(Array.isArray(t)){if(t.length<2)throw new TypeError("a colormap needs two or more stops");return t.forEach(td),[...t]}let e=qn[t];if(!e)throw new TypeError(`unknown colormap ${t}`);return[...e]}function Wn(t,e=ta){let a=Hn(t).map(td),s=new Float32Array(e*4);for(let r=0;r<e;r++){let n=r/(e-1)*(a.length-1),i=Math.min(a.length-2,Math.floor(n)),o=n-i;for(let c=0;c<3;c++)s[r*4+c]=a[i][c]*(1-o)+a[i+1][c]*o;s[r*4+3]=1}return s}function Xn(t={},e=Fa){let a={...e,...t||{}};Hn(a.fieldColormap),Hn(a.arrowColormap);let s=(r,n)=>{if(!(Number(a[r])>0&&Number(a[r])<=n))throw new RangeError(`${r} must be in (0, ${n}]`);a[r]=Number(a[r])};if(s("arrowDensity",400),s("arrowWidth",.5),s("arrowMinLength",1),!Array.isArray(a.arrowOutline)||a.arrowOutline.length!==4)throw new TypeError("arrowOutline is [r, g, b, a]");return a}var aa=class{__destroy_into_raw(){let e=this.__wbg_ptr;return this.__wbg_ptr=0,ad.unregister(this),e}free(){let e=this.__destroy_into_raw();U.__wbg_analyticpack_free(e,0)}barrelRecords(){let e=U.analyticpack_barrelRecords(this.__wbg_ptr);return Ua.__wrap(e)}bindingJson(e){let a,s;try{let i=U.analyticpack_bindingJson(this.__wbg_ptr,e);var r=i[0],n=i[1];if(i[3])throw r=0,n=0,Qs(i[2]);return a=r,s=n,Ga(r,n)}finally{U.__wbindgen_free(a,s,1)}}headerJson(){let e,a;try{let n=U.analyticpack_headerJson(this.__wbg_ptr);var s=n[0],r=n[1];if(n[3])throw s=0,r=0,Qs(n[2]);return e=s,a=r,Ga(s,r)}finally{U.__wbindgen_free(e,a,1)}}lowerSlice(e,a){let s=py(e,U.__wbindgen_malloc,U.__wbindgen_realloc),r=Ka,n=U.analyticpack_lowerSlice(this.__wbg_ptr,s,r,a);if(n[2])throw Qs(n[1]);return za.__wrap(n[0])}constructor(e){let a=by(e,U.__wbindgen_malloc),s=Ka,r=U.analyticpack_new(a,s);if(r[2])throw Qs(r[1]);return this.__wbg_ptr=r[0],ad.register(this,this.__wbg_ptr,this),this}operationNetIndices(e){let a=U.analyticpack_operationNetIndices(this.__wbg_ptr,e);var s=tt(a[0],a[1]).slice();return U.__wbindgen_free(a[0],a[1]*4,4),s}};Symbol.dispose&&(aa.prototype[Symbol.dispose]=aa.prototype.free);var Ua=class t{static __wrap(e){let a=Object.create(t.prototype);return a.__wbg_ptr=e,sd.register(a,a.__wbg_ptr,a),a}__destroy_into_raw(){let e=this.__wbg_ptr;return this.__wbg_ptr=0,sd.unregister(this),e}free(){let e=this.__destroy_into_raw();U.__wbg_barrelrecords_free(e,0)}floats(){let e=U.barrelrecords_floats(this.__wbg_ptr);var a=Zs(e[0],e[1]).slice();return U.__wbindgen_free(e[0],e[1]*4,4),a}skipped(){return U.barrelrecords_skipped(this.__wbg_ptr)>>>0}words(){let e=U.barrelrecords_words(this.__wbg_ptr);var a=tt(e[0],e[1]).slice();return U.__wbindgen_free(e[0],e[1]*4,4),a}};Symbol.dispose&&(Ua.prototype[Symbol.dispose]=Ua.prototype.free);var za=class t{static __wrap(e){let a=Object.create(t.prototype);return a.__wbg_ptr=e,rd.register(a,a.__wbg_ptr,a),a}__destroy_into_raw(){let e=this.__wbg_ptr;return this.__wbg_ptr=0,rd.unregister(this),e}free(){let e=this.__destroy_into_raw();U.__wbg_loweredslicerecords_free(e,0)}batches(){let e=U.loweredslicerecords_batches(this.__wbg_ptr);var a=tt(e[0],e[1]).slice();return U.__wbindgen_free(e[0],e[1]*4,4),a}contourEdgeOperations(){let e=U.loweredslicerecords_contourEdgeOperations(this.__wbg_ptr);var a=tt(e[0],e[1]).slice();return U.__wbindgen_free(e[0],e[1]*4,4),a}contourEdges(){let e=U.loweredslicerecords_contourEdges(this.__wbg_ptr);var a=Zs(e[0],e[1]).slice();return U.__wbindgen_free(e[0],e[1]*4,4),a}covers(){let e=U.loweredslicerecords_covers(this.__wbg_ptr);var a=tt(e[0],e[1]).slice();return U.__wbindgen_free(e[0],e[1]*4,4),a}cutIndices(){let e=U.loweredslicerecords_cutIndices(this.__wbg_ptr);var a=tt(e[0],e[1]).slice();return U.__wbindgen_free(e[0],e[1]*4,4),a}edgeCuts(){let e=U.loweredslicerecords_edgeCuts(this.__wbg_ptr);var a=tt(e[0],e[1]).slice();return U.__wbindgen_free(e[0],e[1]*4,4),a}fanVertices(){let e=U.loweredslicerecords_fanVertices(this.__wbg_ptr);var a=Zs(e[0],e[1]).slice();return U.__wbindgen_free(e[0],e[1]*4,4),a}outlineEdges(){let e=U.loweredslicerecords_outlineEdges(this.__wbg_ptr);var a=Zs(e[0],e[1]).slice();return U.__wbindgen_free(e[0],e[1]*4,4),a}outlineShapes(){let e=U.loweredslicerecords_outlineShapes(this.__wbg_ptr);var a=tt(e[0],e[1]).slice();return U.__wbindgen_free(e[0],e[1]*4,4),a}shapeCuts(){let e=U.loweredslicerecords_shapeCuts(this.__wbg_ptr);var a=tt(e[0],e[1]).slice();return U.__wbindgen_free(e[0],e[1]*4,4),a}shapes(){let e=U.loweredslicerecords_shapes(this.__wbg_ptr);var a=tt(e[0],e[1]).slice();return U.__wbindgen_free(e[0],e[1]*4,4),a}statsJson(){let e,a;try{let s=U.loweredslicerecords_statsJson(this.__wbg_ptr);return e=s[0],a=s[1],Ga(s[0],s[1])}finally{U.__wbindgen_free(e,a,1)}}subtractShapes(){return U.loweredslicerecords_subtractShapes(this.__wbg_ptr)>>>0}};Symbol.dispose&&(za.prototype[Symbol.dispose]=za.prototype.free);function uy(){return{__proto__:null,"./prism_kicad_analytic_bg.js":{__proto__:null,__wbg___wbindgen_throw_bb96b2010945f0bc:function(e,a){throw new Error(Ga(e,a))},__wbindgen_cast_0000000000000001:function(e,a){return Ga(e,a)},__wbindgen_init_externref_table:function(){let e=U.__wbindgen_externrefs,a=e.grow(4);e.set(0,void 0),e.set(a+0,void 0),e.set(a+1,null),e.set(a+2,!0),e.set(a+3,!1)}}}}var ad=typeof FinalizationRegistry>"u"?{register:()=>{},unregister:()=>{}}:new FinalizationRegistry(t=>U.__wbg_analyticpack_free(t,1)),sd=typeof FinalizationRegistry>"u"?{register:()=>{},unregister:()=>{}}:new FinalizationRegistry(t=>U.__wbg_barrelrecords_free(t,1)),rd=typeof FinalizationRegistry>"u"?{register:()=>{},unregister:()=>{}}:new FinalizationRegistry(t=>U.__wbg_loweredslicerecords_free(t,1));function Zs(t,e){return t=t>>>0,fy().subarray(t/4,t/4+e)}function tt(t,e){return t=t>>>0,hy().subarray(t/4,t/4+e)}var Oa=null;function fy(){return(Oa===null||Oa.byteLength===0)&&(Oa=new Float32Array(U.memory.buffer)),Oa}function Ga(t,e){return my(t>>>0,e)}var Pa=null;function hy(){return(Pa===null||Pa.byteLength===0)&&(Pa=new Uint32Array(U.memory.buffer)),Pa}var ja=null;function La(){return(ja===null||ja.byteLength===0)&&(ja=new Uint8Array(U.memory.buffer)),ja}function by(t,e){let a=e(t.length*1,1)>>>0;return La().set(t,a/1),Ka=t.length,a}function py(t,e,a){if(a===void 0){let o=Da.encode(t),c=e(o.length,1)>>>0;return La().subarray(c,c+o.length).set(o),Ka=o.length,c}let s=t.length,r=e(s,1)>>>0,n=La(),i=0;for(;i<s;i++){let o=t.charCodeAt(i);if(o>127)break;n[r+i]=o}if(i!==s){i!==0&&(t=t.slice(i)),r=a(r,s,s=i+t.length*3,1)>>>0;let o=La().subarray(r+i,r+s),c=Da.encodeInto(t,o);i+=c.written,r=a(r,s,i,1)>>>0}return Ka=i,r}function Qs(t){let e=U.__wbindgen_externrefs.get(t);return U.__externref_table_dealloc(t),e}var er=new TextDecoder("utf-8",{ignoreBOM:!0,fatal:!0});er.decode();var gy=2146435072,$n=0;function my(t,e){return $n+=e,$n>=gy&&(er=new TextDecoder("utf-8",{ignoreBOM:!0,fatal:!0}),er.decode(),$n=e),er.decode(La().subarray(t,t+e))}var Da=new TextEncoder;"encodeInto"in Da||(Da.encodeInto=function(t,e){let a=Da.encode(t);return e.set(a),{read:t.length,written:a.length}});var Ka=0,yy,xy,U;function wy(t,e){return xy=t,U=t.exports,yy=e,Oa=null,Pa=null,ja=null,U.__wbindgen_start(),U}async function vy(t,e){if(typeof Response=="function"&&t instanceof Response){if(!t.ok)throw new Error(`failed to fetch Wasm: ${t.status} ${t.statusText} fetching '${t.url}'`);if(typeof WebAssembly.instantiateStreaming=="function")try{return await WebAssembly.instantiateStreaming(t,e)}catch(r){if(a(t.type)&&t.headers.get("Content-Type")!=="application/wasm")console.warn("`WebAssembly.instantiateStreaming` failed because your server does not serve Wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n",r);else throw r}let s=await t.arrayBuffer();return await WebAssembly.instantiate(s,e)}else{let s=await WebAssembly.instantiate(t,e);return s instanceof WebAssembly.Instance?{instance:s,module:t}:s}function a(s){switch(s){case"basic":case"cors":case"default":return!0}return!1}}async function nd(t){if(U!==void 0)return U;t!==void 0&&(Object.getPrototypeOf(t)===Object.prototype?{module_or_path:t}=t:console.warn("using deprecated parameters for the initialization function; pass a single object instead")),t===void 0&&(t=new URL("prism_kicad_analytic_bg.wasm",import.meta.url));let e=uy();(typeof t=="string"||typeof Request=="function"&&t instanceof Request||typeof URL=="function"&&t instanceof URL)&&(t=fetch(t));let{instance:a,module:s}=await vy(await t,e);return wy(a,s)}var id={schema:"prism.vendored_wasm.a0",purpose:"Reads materialization packs (kicad_monkey.materialization.a0) in the browser and lowers their slices for the analytic renderer.",source:{repository:"this repository",crate:"prism-kicad-wasm",native_src_rs_tree:"5b03b10ee0e1b0c9d2449fbb47596a4065a1785d",license:"MIT"},build:{target:"wasm32-unknown-unknown",profile:"release",features:["materialization"],wasm_bindgen:"0.2.127",rustc:"rustc 1.98.0 (88d9e12ae 2026-08-18)",command:"node scripts/build-analytic-wasm.mjs"},files:{"prism_kicad_analytic.js":"c93b31ad6ad5e7bc4ef2b0e658e1f514c81a9124dfc6a42db5ea1c5fa96d5fd9","prism_kicad_analytic_bg.wasm":"8fcc4ad15c6f41bc1358b9d739faf9264a06758edf7e587afc11db6b38a3b85d"}};var od="prism-kicad-analytic.wasm",Ey="kicad_monkey.materialization.a0",Dt=1e3,Yn=null;function sa(){return String(id.files?.["prism_kicad_analytic_bg.wasm"]||"").slice(0,16)}function ud(){let t=sa();try{return new URL(`${od}?v=${t}`,import.meta.url)}catch{return`/${od}?v=${t}`}}function Ty(t=ud()){return Yn??=nd({module_or_path:t}).catch(e=>{throw Yn=null,e}),Yn}function My(t,e,a=Dt){let s=t.lowerSlice(e,a);try{return{shapes:new Uint32Array(s.shapes()),subtractShapes:s.subtractShapes(),fanVertices:new Float32Array(s.fanVertices()),covers:new Uint32Array(s.covers()),batches:new Uint32Array(s.batches()),contourEdges:new Float32Array(s.contourEdges()),contourEdgeOperations:new Uint32Array(s.contourEdgeOperations()),shapeCuts:new Uint32Array(s.shapeCuts()),edgeCuts:new Uint32Array(s.edgeCuts()),cutIndices:new Uint32Array(s.cutIndices()),outlineEdges:new Float32Array(s.outlineEdges()),outlineShapes:new Uint32Array(s.outlineShapes()),stats:JSON.parse(s.statsJson())}}finally{s.free()}}function ar(){return String(ud())}async function Va(t,{wasm:e}={}){await Ty(e);let a=new aa(t instanceof Uint8Array?t:new Uint8Array(t)),s=JSON.parse(a.headerJson());if(s.schema!==Ey)throw new Error(`unsupported materialization schema ${s.schema}`);return{header:s,lowerSlice(r,n=Dt){return My(a,r,n)},barrels(){let r=a.barrelRecords();try{return{floats:new Float32Array(r.floats()),words:new Uint32Array(r.words()),skipped:r.skipped()}}finally{r.free()}},binding(r){return JSON.parse(a.bindingJson(r))},netIndices(){return new Uint32Array(a.operationNetIndices(ra(s)))},free(){a.free()}}}function ra(t){return(t.chunks||[]).reduce((e,a)=>e+Number(a.operation_count||0),0)}function _y(t,e){let a=null;for(let s of t.chunks||[]){if(s.slice_key!==e)continue;let r=s.bounds,n=[r.min_x_nm,r.min_y_nm,r.max_x_nm,r.max_y_nm].map(i=>i/1e6);a=a?[Math.min(a[0],n[0]),Math.min(a[1],n[1]),Math.max(a[2],n[2]),Math.max(a[3],n[3])]:n}return a}var Sy={conductor:"copper",solder_mask:"mask",silkscreen:"silk",paste:"paste",dielectric:"dielectric"},fd=1e-6,hd=2e-6,cd=1e-7,ld={"fr4 natural":[109,116,75],"ptfe natural":[252,252,250],polyimide:[205,130,0],"phenolic natural":[92,17,6],aluminum:[213,213,213]};function Ay(t){let e=String(t||"").trim(),a=/^#([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(e);return[...(a?[0,2,4].map(r=>parseInt(a[1].slice(r,r+2),16)):ld[e.toLowerCase()]||ld["fr4 natural"]).map(r=>r/255),1]}function bd(t,e,a=0){let s=new Map((e||[]).map(d=>[String(d.name),d])),r=[...t.stack?.slices||[]].sort((d,m)=>d.order-m.order),n=r.filter(d=>d.role==="conductor"),i=d=>Number(s.get(String(d?.kicad_layer||""))?.id||0),o=i(n[0]),c=i(n[n.length-1]),l=[],f=[];for(let d of r){let m=Sy[d.role],b=s.get(String(d.kicad_layer||"")),y=_y(t,d.key);if(!m||!b||!y){m&&f.push(d.key);continue}let x=Number(b.z_mm||0)/1e3+a,w=(Number(b.thickness_mm)||Number(d.thickness_nm||0)/1e6)/2e3,E=d.side==="back"||m!=="dielectric"&&m!=="copper"&&x<a,T={key:d.key,role:m,layerId:Number(b.id),side:d.side||null,bounds:y};if(m==="dielectric"){T.color=Ay(b.color);let _=[...n].reverse().find(I=>I.order<d.order),S=n.find(I=>I.order>d.order),N=[i(_)||i(S),i(S)||i(_)],R={zTop:x+w,zBottom:x-w};l.push({...T,...R,face:"top",z:x+w-cd,faceDown:!1,outer:!1,offsetLayers:N}),l.push({...T,...R,face:"bottom",z:x-w+cd,faceDown:!0,outer:!1,offsetLayers:N})}else if(m==="copper"){let _=n.indexOf(d),S=_===n.length-1&&n.length>1,N=_===0||S,R={...T,bottom:S,outer:N,zTop:x+w,zBottom:x-w,offsetLayers:[Number(b.id),Number(b.id)]};l.push({...R,face:"top",z:x+w,faceDown:!1,mark:N&&!S,walls:!S}),l.push({...R,face:"bottom",z:x-w,faceDown:!0,mark:S,walls:S})}else{let _=m==="silk"?hd:m==="paste"?fd:0,S=E?c:o;l.push({...T,z:E?x-w-_:x+w+_,faceDown:E,outer:!1,thickness:w*2,offsetLayers:[S,S]})}}Ry(l);let u=l.filter(d=>d.role==="dielectric"),g=u.filter(d=>!d.faceDown).sort((d,m)=>m.z-d.z)[0],p=u.filter(d=>d.faceDown).sort((d,m)=>d.z-m.z)[0];for(let d of u)d.skin=d===g||d===p;let h={dielectric:0,copper:1,mask:2,paste:3,silk:4};return l.sort((d,m)=>h[d.role]-h[m.role]),{planned:l,unmatched:f}}function Ry(t){for(let e of t){if(e.role!=="mask"&&e.role!=="silk"&&e.role!=="paste")continue;let a=t.find(c=>c.role==="copper"&&c.mark&&c.faceDown===e.faceDown);if(!a)continue;let s=e.faceDown?-1:1,r=e.faceDown?a.zTop:a.zBottom,n=e.faceDown?a.zBottom:a.zTop,o=t.find(c=>c.role==="mask"&&c.faceDown===e.faceDown)?.thickness||0;e.role==="mask"?(e.coat=o,e.zLow=r+s*o):e.role==="silk"?e.zLow=r+s*(o+hd):e.z=n+s*fd}}function ei(t,e){let a=new Float32Array(Math.max(1,e)).fill(Number.NaN);if(ArrayBuffer.isView(t)||Array.isArray(t))for(let s=0;s<Math.min(e,t.length);s+=1)a[s]=Number(t[s]);else for(let[s,r]of Object.entries(t||{})){let n=Number(s);Number.isInteger(n)&&n>=0&&n<e&&(a[n]=Number(r))}return a}function na(t){let e=1/0,a=-1/0;for(let s of t)Number.isFinite(s)&&(e=Math.min(e,s),a=Math.max(a,s));return Number.isFinite(e)?[e,a]:[0,1]}function sr(t){let e=new Map,a=1e3;for(let s of t.slices||[]){if(!(s.nx>0&&s.ny>0)||s.values.length!==s.nx*s.ny)throw new Error(`grid field slice ${s.slice_key} has ${s.values.length} values for ${s.nx} x ${s.ny} cells`);e.set(s.slice_key,{originMm:[(t.origin_x_m+s.ix0*t.dx_m)*a,(t.origin_y_m+s.iy0*t.dy_m)*a],pitchMm:[t.dx_m*a,t.dy_m*a],width:s.nx,height:s.ny,values:s.values})}return e}function pd(t){let e=new Map;for(let s of t||[])e.has(s.slice_key)||e.set(s.slice_key,[]),e.get(s.slice_key).push(s);let a=new Map;for(let[s,r]of e){let n=Number(r[0].pitch_nm);if(!(n>0)||r.some(g=>Number(g.pitch_nm)!==n))throw new Error(`field tiles of ${s} must share one positive pitch`);let i=Math.min(...r.map(g=>g.origin_nm[0])),o=Math.min(...r.map(g=>g.origin_nm[1])),c=(g,p)=>{let h=(g-p)/n;if(!Number.isInteger(h))throw new Error(`field tile of ${s} is off its pitch grid`);return h},l=Math.max(...r.map(g=>c(g.origin_nm[0],i)+g.width)),f=Math.max(...r.map(g=>c(g.origin_nm[1],o)+g.height)),u=new Float32Array(l*f).fill(Number.NaN);for(let g of r){let p=c(g.origin_nm[0],i),h=c(g.origin_nm[1],o);for(let d=0;d<g.height;d+=1)u.set(g.values.subarray?g.values.subarray(d*g.width,(d+1)*g.width):g.values.slice(d*g.width,(d+1)*g.width),(h+d)*l+p)}a.set(s,{originMm:[i/1e6,o/1e6],pitchMm:n/1e6,width:l,height:f,values:u})}return a}var Jn=8,tr=8,dd=4294967295,Iy=Object.freeze({unplated:2,tentedFront:4,tentedBack:8,coveredFront:16,coveredBack:32,pluggedFront:64,pluggedBack:128,filled:256,capped:512,castellated:1024}),Qn=16;function Ny(t,e,a){let s=null;for(let r=0;t&&r+3<t.length;r+=4){let n=[t[r],t[r+1]],i=[t[r+2],t[r+3]],o=[i[0]-n[0],i[1]-n[1]],c=o[0]*o[0]+o[1]*o[1];if(c<=0)continue;let l=Math.max(0,Math.min(1,((e[0]-n[0])*o[0]+(e[1]-n[1])*o[1])/c)),f=Math.hypot(e[0]-n[0]-l*o[0],e[1]-n[1]-l*o[1]);if(f>a||s&&f>=s.distance)continue;let u=Math.sqrt(c),g=[o[1]/u,o[0]/u];s={distance:f,normal:g,offset:(g[0]*n[0]-g[1]*n[1])/1e3}}return s&&{normal:s.normal,offset:s.offset}}function gd(t,e,a,s=null){let r=(t.stack?.slices||[]).filter(p=>p.role==="conductor").sort((p,h)=>p.order-h.order),n=new Map((a||[]).filter(p=>p.role===void 0||p.role==="copper").map(p=>[p.key,p])),i=p=>{let h=n.get(p.key);if(!h)return null;if(h.zTop!==void 0)return{top:h.zTop,bottom:h.zBottom,layerId:h.layerId};let d=Number(p.thickness_nm||0)/1e9;return h.bottom?{top:h.z+d,bottom:h.z,layerId:h.layerId}:{top:h.z,bottom:h.z-d,layerId:h.layerId}},o=Math.floor(e.floats.length/Jn),c=new ArrayBuffer(o*Qn*4),l=new Float32Array(c),f=new Uint32Array(c),u=0,g=e.skipped||0;for(let p=0;p<o;p+=1){let h=e.floats.subarray(p*Jn,(p+1)*Jn),d=e.words.subarray(p*tr,(p+1)*tr),[m,b]=[Math.min(d[1],d[2]),Math.max(d[1],d[2])],y=r.filter(_=>_.order>=m&&_.order<=b&&(d[3]===dd||_.order>d[3])&&(d[4]===dd||_.order<d[4])),x=y.length?i(y[0]):null,w=y.length?i(y[y.length-1]):null;if(!x||!w){g+=1;continue}let E=u*Qn;l.set([h[0]/1e3,-h[1]/1e3,h[2]/1e3,-h[3],h[4]/1e3,h[5]/1e3,x.top,w.bottom],E),f.set([d[0],x.layerId,w.layerId,d[5]],E+8);let T=d[5]&Iy.castellated?Ny(s,[h[0],h[1]],h[4]+h[2]):null;l.set(T?[T.normal[0],T.normal[1],T.offset,0]:[0,0,1,0],E+12),u+=1}return{data:c.slice(0,u*Qn*4),count:u,skipped:g}}var Zn=12,Cy=0,By=1;function md(t,e,a,s=0){let r=(a||[]).filter(p=>p.role==="soldermask").map(p=>Number(p.z_mm)/1e3+s+Math.sign(Number(p.z_mm))*Number(p.thickness_mm||0)/2e3),n=r.length?Math.max(...r):null,i=r.length?Math.min(...r):null,o=t.filter(p=>p.role==="dielectric"&&p.face==="top"&&e.get(p.key)?.contourEdges?.length),c=[],l=(p,h,d,m,b,y)=>{let x=e.get(p.key).contourEdges;for(let w=0;w+3<x.length;w+=4)c.push([x[w],x[w+1],x[w+2],x[w+3],h,d,m,b,y])};for(let p of o)l(p,p.zTop,p.zBottom,p.offsetLayers[0],p.offsetLayers[1],Cy);for(let p of t.filter(h=>h.role==="copper"&&h.face==="top")){let h=w=>Math.min(Math.abs(w.zBottom-p.zTop),Math.abs(w.zTop-p.zBottom)),d=[...o].sort((w,E)=>h(w)-h(E))[0];if(!d)continue;let m=p.outer&&!p.bottom,b=p.outer&&p.bottom,y=m&&n!=null?Math.max(n,p.zTop):p.zTop,x=b&&i!=null?Math.min(i,p.zBottom):p.zBottom;l(d,y,x,p.layerId,p.layerId,By)}let f=new ArrayBuffer(c.length*Zn*4),u=new Float32Array(f),g=new Uint32Array(f);return c.forEach(([p,h,d,m,b,y,x,w,E],T)=>{u.set([p/1e3,-h/1e3,d/1e3,-m/1e3,b,y,0,0],T*Zn),g.set([x,w,E,0],T*Zn+8)}),{data:f,count:c.length}}function yd(t,e){let a=new Map;for(let o of e||[])for(let c of o?.aliases||[])a.has(String(c))||a.set(String(c),Number(o.id));for(let o of e||[])o?.name&&a.set(String(o.name),Number(o.id));let s=t.header.nets||[];if(typeof t.netIndices=="function"){let o=new Uint32Array(s.length+1);s.forEach((f,u)=>{o[u+1]=a.get(f.name??f.key)||a.get(f.key)||0});let c=t.netIndices(),l=new Uint32Array(c.length);for(let f=0;f<c.length;f+=1)l[f]=o[c[f]];return l}let r=new Map(s.map(o=>[o.key,o.name])),n=ra(t.header),i=new Uint32Array(n);for(let o=0;o<n;o+=1){let c=t.binding(o)?.net_key;c&&(i[o]=a.get(r.get(c)??c)||0)}return i}var xd={Uint32Array,Float32Array},Ha=".board";function wd(t,e,a){return{header:t,barrelFloats:e.floats,barrelWords:e.words,barrelSkipped:e.skipped,netIndices:a}}function rr(t,e,a,s){return`analytic-lowered-a1/${t}/${e}/${a}/${s}`}function Fy(t){let e=[],a=[];for(let[f,u]of Object.entries(t)){if(!ArrayBuffer.isView(u))continue;let g=u.constructor.name;if(!xd[g])throw new TypeError(`cannot cache a ${g} (${f})`);e.push({name:f,kind:g,length:u.length}),a.push(new Uint8Array(u.buffer,u.byteOffset,u.byteLength))}let s=Object.fromEntries(Object.entries(t).filter(([,f])=>!ArrayBuffer.isView(f))),r=new TextEncoder().encode(JSON.stringify({fields:e,rest:s})),n=Math.ceil(r.length/4)*4,i=8+n+a.reduce((f,u)=>f+Math.ceil(u.length/4)*4,0),o=new Uint8Array(i),c=new DataView(o.buffer);c.setUint32(0,1280527440,!0),c.setUint32(4,r.length,!0),o.set(r,8);let l=8+n;for(let f of a)o.set(f,l),l+=Math.ceil(f.length/4)*4;return o}function nr(t){let e=t instanceof Uint8Array?t:new Uint8Array(t);if(e.length<8)return null;let a=new DataView(e.buffer,e.byteOffset,e.byteLength);if(a.getUint32(0,!0)!==1280527440)return null;let s=a.getUint32(4,!0),r;try{r=JSON.parse(new TextDecoder().decode(e.subarray(8,8+s)))}catch{return null}let n={...r.rest},i=8+Math.ceil(s/4)*4;for(let{name:o,kind:c,length:l}of r.fields){let f=xd[c];if(!f)return null;let u=l*f.BYTES_PER_ELEMENT;if(i+u>e.length||(e.byteOffset+i)%f.BYTES_PER_ELEMENT)return null;n[o]=new f(e.buffer,e.byteOffset+i,l),i+=Math.ceil(u/4)*4}return n}async function qa(t,{cacheKey:e,wasmKey:a,toleranceNm:s},r){let n=new Map;return!t?.read||!e||await Promise.all(r.map(async i=>{try{let o=await t.read(rr(e,a,s,i)),c=o?nr(o):null;c&&n.set(i,c)}catch{}})),n}function ti(t,{cacheKey:e,wasmKey:a,toleranceNm:s},r){return!t?.write||!e?Promise.resolve():Promise.all([...r].map(([n,i])=>t.write(rr(e,a,s,n),i instanceof Uint8Array?i:Fy(i)).catch(()=>{}))).then(()=>{})}function vd(t,e,a){return`analytic-lowered-a1/${t}/${e}/${a}/.complete`}async function kd(t,{cacheKey:e,wasmKey:a,toleranceNm:s}){if(!t?.read||!e)return!1;try{return!!await t.read(vd(e,a,s))}catch{return!1}}async function Ed(t,{cacheKey:e,wasmKey:a,toleranceNm:s},r=Promise.resolve()){!t?.write||!e||(await r,await t.write(vd(e,a,s),new Uint8Array([1])).catch(()=>{}))}var Oy="prism-semantic-viewer-lower.js",ir=3;function Py(){if(typeof Worker>"u")return null;try{let t=new URL(import.meta.url),e=t.searchParams.get("v");return new URL(`${Oy}${e?`?v=${e}`:""}`,t)}catch{return null}}function or(t,e=globalThis.navigator?.hardwareConcurrency||4){return Math.max(1,Math.min(ir,Math.max(1,e-1),t))}function jy(t,e,a){let s=Array.from({length:Math.max(1,a)},()=>({keys:[],load:0})),r=new Map(t.map((i,o)=>[i,o])),n=[...t].sort((i,o)=>(e.get(o)||1)-(e.get(i)||1)||r.get(i)-r.get(o));for(let i of n){let o=s.reduce((c,l)=>l.load<c.load?l:c,s[0]);o.keys.push(i),o.load+=e.get(i)||1}return s.filter(i=>i.keys.length).map(i=>i.keys.sort((o,c)=>r.get(o)-r.get(c)))}function Td(t){let e=new Map;for(let a of t?.chunks||[])e.set(a.slice_key,(e.get(a.slice_key)||0)+Number(a.operation_count||0));return e}var ai=new Map;function Ly(t){if(!ai.has(t)){let e=typeof WebAssembly?.compileStreaming=="function"&&typeof fetch=="function"?WebAssembly.compileStreaming(fetch(t)).catch(()=>null):Promise.resolve(null);ai.set(t,e)}return ai.get(t)}var Wa=class t{static start(e,a,s=or(ir)){let r=Py();if(!r||typeof a!="string")return null;let n=[],i=Ly(a);for(let o=0;o<s;o+=1){let c;try{c=new Worker(r,{type:"module",name:`analytic-lower-${o}`})}catch{break}let l={worker:c,pending:new Map,alive:!0};c.onmessage=({data:u})=>{let g=l.pending.get(u.id);l.pending.delete(u.id),g?.(u)},c.onerror=u=>{u.preventDefault?.(),l.alive=!1;for(let g of l.pending.values())g({error:"worker failed"});l.pending.clear()},l.opened=new Promise(u=>l.pending.set(0,g=>u(g.error?null:g.header)));let f=(e instanceof Uint8Array?e:new Uint8Array(e)).slice();i.then(u=>c.postMessage({type:"open",bytes:f.buffer,wasmUrl:a,wasmModule:u},[f.buffer])),n.push(l)}return n.length?new t(n):null}constructor(e){this.members=e,this.nextId=1}async header(){for(let e of this.members){let a=await e.opened;if(a&&e.alive)return a}return null}async host(){for(let e of this.members)if(await e.opened&&e.alive)return e;return null}async ask(e,a={},s=[],r=null){let n=r||await this.host();if(!n)throw new Error("no lowering worker has the pack open");return new Promise((i,o)=>{let c=this.nextId++;n.pending.set(c,l=>l.error?o(new Error(l.error)):i(l)),n.worker.postMessage({type:e,id:c,...a},s)})}async steps(e,a=null,s=[]){let r=[];for(let o of this.members)await o.opened&&o.alive&&r.push(o);let n=(o,c)=>Object.fromEntries(c.map(l=>[l,ArrayBuffer.isView(o[l])?o[l].slice():o[l]])),i=["shapes","subtractShapes","contourEdges","contourEdgeOperations","outlineEdges","outlineShapes"];return Promise.all(e.map(([o,c],l)=>{if(!r.length)return null;let f={key:s[l],store:a?.identity??null,copper:n(o,i),mask:n(c,["shapes","subtractShapes"])},u=r[l%r.length];return a&&a.writes.push(this.stored(u,this.nextId,a)),this.ask("step",f,[],u).then(g=>g.step,()=>null)}))}stored(e,a,s){return new Promise(r=>e.pending.set(-a,n=>{for(let[i,o]of n.stored||[])s.adopt(i,o);r()}))}async release(){let e=await this.host();for(let a of this.members)a!==e&&a.worker.terminate();this.members=e?[e]:[]}async lower(e,a,s=new Map,r=null){if(!e.length)return new Map;let n=await Promise.all(this.members.map(f=>f.opened)),i=this.members.filter((f,u)=>n[u]&&f.alive);if(!i.length)return null;let o=jy(e,s,i.length),c=await Promise.all(o.map((f,u)=>new Promise(g=>{let p=i[u],h=this.nextId++;r&&r.writes.push(this.stored(p,h,r)),p.pending.set(h,d=>g(d.error?null:new Map(Object.entries(d.lowered)))),p.worker.postMessage({type:"lower",id:h,keys:f,toleranceNm:a,store:r?.identity??null})})));if(c.every(f=>f===null))return null;let l=new Map;for(let f of c)for(let[u,g]of f||[])l.set(u,g);return l}close(){for(let e of this.members)e.worker.terminate();this.members=[]}};async function Md(t){let e=await t.header();if(!e)return null;let a=ra(e);return{header:e,hosted:!0,async barrels(){return(await t.ask("barrels")).barrels},async netIndices(){return(await t.ask("netIndices",{count:a})).indices},async binding(s){return(await t.ask("binding",{index:s})).binding},free(){t.close()}}}function _d(t,e){return{header:t.header,hosted:!0,async barrels(){return{floats:t.barrelFloats,words:t.barrelWords,skipped:t.barrelSkipped}},async netIndices(){return t.netIndices},async binding(a){if(!e)throw new Error("no worker holds the pack");return(await e.ask("binding",{index:a})).binding},free(){e?.close()}}}async function Sd(t,e,a,s,{weights:r=new Map,workers:n}={}){if(!e.length)return new Map;let i=Wa.start(t,s,n??or(e.length));if(!i)return null;try{return await i.lower(e,a,r)}finally{i.close()}}function Ad(t,e){let a=new Float32Array(t.buffer,t.byteOffset+e*20*4,20),[s,r,n,i,o,c]=[a[4],a[5],a[6],a[7],a[8],a[9]],l=[1/0,1/0,-1/0,-1/0];for(let[f,u]of[[a[10],a[11]],[a[12],a[11]],[a[10],a[13]],[a[12],a[13]]]){let g=s*f+r*u+o,p=n*f+i*u+c;l[0]=Math.min(l[0],g),l[1]=Math.min(l[1],p),l[2]=Math.max(l[2],g),l[3]=Math.max(l[3],p)}return l}function Id(t){let e=t.contourEdges||new Float32Array(0),a=t.contourEdgeOperations||new Uint32Array(0),s=t.shapeCuts||new Uint32Array(0),r=t.edgeCuts||new Uint32Array(0),n=t.cutIndices||new Uint32Array(0),i=s.length,o=new Uint32Array(Math.max(1,i+n.length));for(let m=0;m<i;m+=2)o[m]=s[m]+i,o[m+1]=s[m+1];o.set(n,i);let c=t.outlineEdges||new Float32Array(0),l=t.outlineShapes||new Uint32Array(0),f=Math.min(e.length/4,a.length),u=new Uint32Array(Math.max(1,f+l.length)*7),g=new Uint32Array(e.buffer,e.byteOffset,e.length),p=0;for(let m=0;m<f;m+=1){if(a[m]&2147483648)continue;let b=p*7;u[b]=g[m*4],u[b+1]=g[m*4+1],u[b+2]=g[m*4+2],u[b+3]=g[m*4+3],u[b+4]=a[m],u[b+5]=(r[m*2]??0)+i,u[b+6]=r[m*2+1]??0,p+=1}let h=p,d=new Uint32Array(c.buffer,c.byteOffset,c.length);for(let m=0;m<l.length;m+=1){let b=p*7;u[b]=d[m*4],u[b+1]=d[m*4+1],u[b+2]=d[m*4+2],u[b+3]=d[m*4+3],u[b+4]=(1073741824|l[m])>>>0,p+=1}return{edgeWords:u,cutWords:o,regionEdges:h,skirtEdges:p-h}}function ni(t){return t.edgeWords?t:Object.assign(t,Id(t))}function Nd(t,e,a=.05){let s=e.shapes.subarray(0,e.subtractShapes*20),r=t.shapes.length/20,n=new Uint32Array(t.shapes.length+s.length);n.set(t.shapes),n.set(s,t.shapes.length);let i=s.length/20,o=new Float64Array(i*4),[c,l,f,u]=[1/0,1/0,-1/0,-1/0];for(let A=0;A<i;A+=1){let P=Ad(s,A);o.set(P,A*4),c=Math.min(c,P[0]),l=Math.min(l,P[1]),f=Math.max(f,P[2]),u=Math.max(u,P[3])}let[g,p]=[Math.floor(c),Math.floor(l)],h=i?Math.floor(f)-g+1:0,d=i?Math.floor(u)-p+1:0,m=(A,P,K)=>Math.min(K-1,Math.max(0,Math.floor(A)-P)),b=new Uint32Array(h*d+1),y=(A,P)=>{let[K,W]=[m(o[A*4],g,h),m(o[A*4+2],g,h)],[Q,pe]=[m(o[A*4+1],p,d),m(o[A*4+3],p,d)];for(let se=K;se<=W;se+=1)for(let be=Q;be<=pe;be+=1)P(se*d+be)};for(let A=0;A<i;A+=1)y(A,P=>{b[P+1]+=1});for(let A=0;A<h*d;A+=1)b[A+1]+=b[A];let x=new Uint32Array(b[h*d]),w=b.slice(0,h*d);for(let A=0;A<i;A+=1)y(A,P=>{x[w[P]++]=A});let E=[],T=[],_=new Uint32Array(i),S=0,N=(A,P,K,W)=>{let Q=E.length;if(S+=1,i&&Math.floor(K)>=g&&Math.floor(A)<=g+h-1&&Math.floor(W)>=p&&Math.floor(P)<=p+d-1){let[pe,se]=[m(A,g,h),m(K,g,h)],[be,Ee]=[m(P,p,d),m(W,p,d)];for(let ue=pe;ue<=se;ue+=1)for(let Te=be;Te<=Ee;Te+=1){let ge=ue*d+Te;for(let Re=b[ge];Re<b[ge+1];Re+=1){let Me=x[Re];_[Me]!==S&&(_[Me]=S,o[Me*4]<=K&&A<=o[Me*4+2]&&o[Me*4+1]<=W&&P<=o[Me*4+3]&&E.push(r+Me))}}}T.push(Q,E.length-Q)};for(let A=t.subtractShapes;A<r;A+=1){let P=Ad(t.shapes,A);N(P[0]-a,P[1]-a,P[2]+a,P[3]+a)}let R=r-t.subtractShapes,I=t.contourEdges||new Float32Array(0);for(let A=0;A+3<I.length;A+=4)N(Math.min(I[A],I[A+2])-a,Math.min(I[A+1],I[A+3])-a,Math.max(I[A],I[A+2])+a,Math.max(I[A+1],I[A+3])+a);let C=Id({...t,shapeCuts:new Uint32Array(T.slice(0,R*2)),edgeCuts:new Uint32Array(T.slice(R*2)),cutIndices:new Uint32Array(E)});return{shapes:n,...C}}function Cd(t){let e=[];for(let a of t){if(a.role!=="mask"||a.zLow===void 0)continue;let s=t.find(r=>r.role==="copper"&&r.mark&&r.faceDown===a.faceDown);s&&e.push([a,s])}return e}function cr(t,e){return`step:${t.key}:${e.key}`}function Bd(t){let e=t.contourEdges||new Float32Array(0),a=t.contourEdgeOperations||new Uint32Array(0),s=[];for(let u=0;u<a.length&&u*4+3<e.length;u+=1)a[u]&2147483648||s.push(u);if(!s.length)return null;let[r,n]=[e[s[0]*4],e[s[0]*4+1]],i=new Float32Array(s.length*6),o=[1/0,1/0,-1/0,-1/0],c=new Float32Array(s.length*4),l=new Uint32Array(s.length);s.forEach((u,g)=>{let[p,h,d,m]=e.subarray(u*4,u*4+4);i.set([r,n,p,h,d,m],g*6),c.set([p,h,d,m],g*4),l[g]=a[u],o[0]=Math.min(o[0],p,d),o[1]=Math.min(o[1],h,m),o[2]=Math.max(o[2],p,d),o[3]=Math.max(o[3],h,m)});let f=new Uint32Array(6);return f[0]=a[s[0]],f.set(new Uint32Array(Float32Array.from(o).buffer),2),ni({shapes:new Uint32Array(0),subtractShapes:0,fanVertices:i,covers:f,batches:new Uint32Array([0,0,s.length*3,0,1]),contourEdges:c,contourEdgeOperations:l})}var dr={color:{srcFactor:"src-alpha",dstFactor:"one-minus-src-alpha"},alpha:{srcFactor:"one",dstFactor:"one-minus-src-alpha"}};function oi(t){let e=Float32Array.from(t);for(let a=0;a<e.length;a+=1)Number.isFinite(e[a])||(e[a]=3e38);return e}var lr=2,Uy=5e-4,zy={mask:"soldermask",silk:"silkscreen",paste:"paste"};function Gy(t,e){let a=zy[e.role];return!!(t?.size&&a)&&t.has(Vy(a,e.faceDown?"back":"front"))}function Ky(t,e){let a=e?.soldermask?.front;return!t.soldermask&&a?.length>=3&&(t.soldermask={color:a,metallic:0,roughness:.6}),!t.paste&&e?.paste?.length>=3&&(t.paste={color:e.paste,metallic:0,roughness:.45}),!t.silkscreen&&e?.silkscreen?.length>=3&&(t.silkscreen={color:e.silkscreen,metallic:0,roughness:.8}),t}function Vy(t,e){return`${t}:${e}`}var Hy=128*1048576,li=class{constructor(e){this.budget=e,this.entries=new Map,this.generation=0}texture(e,a){let s=e.values,r=this.entries.get(s);return r?this.entries.delete(s):r={texture:a(),bytes:e.width*e.height*4},r.used=this.generation,this.entries.set(s,r),r.texture}bytes(){let e=0;for(let a of this.entries.values())e+=a.bytes;return e}trim(){let e=this.bytes();for(let[a,s]of this.entries){if(e<=this.budget)break;s.used!==this.generation&&(s.texture.destroy(),e-=s.bytes,this.entries.delete(a))}this.generation+=1}clear(){for(let e of this.entries.values())e.texture.destroy();this.entries.clear()}},Dd=.3,Ud=new WeakMap,zd=new WeakMap;function Kd(t){let e=Ud.get(t);return e||(e={layout:t.createBindGroupLayout({label:"analytic",entries:[{binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}},{binding:1,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}},{binding:2,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:"read-only-storage"}},{binding:3,visibility:GPUShaderStage.VERTEX,buffer:{type:"read-only-storage"}},{binding:4,visibility:GPUShaderStage.FRAGMENT,buffer:{type:"read-only-storage"}},{binding:5,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:"unfilterable-float"}},{binding:6,visibility:GPUShaderStage.FRAGMENT,buffer:{type:"read-only-storage"}},{binding:7,visibility:GPUShaderStage.FRAGMENT,buffer:{type:"read-only-storage"}},{binding:8,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:"read-only-storage"}},{binding:9,visibility:GPUShaderStage.FRAGMENT,buffer:{type:"read-only-storage"}},{binding:10,visibility:GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}},{binding:11,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:"uint"}}]}),module:t.createShaderModule({label:"analytic",code:Dc})},Ud.set(t,e)),e}function Gd(t){let e=Kd(t.device);return{device:t.device,depthFormat:t.depthFormat,stencil:t.stencil,samples:t.sampleCount||1,layout:e.layout,module:e.module}}function di(t){return`${t.format}|${t.sampleCount||1}|${t.depthFormat}|${t.stencil?1:0}`}function ui(t){let e=zd.get(t);return e||(e=new Map,zd.set(t,e)),e}function qy(t){return ui(t.device).get(di(t))?.ready||null}function Wy(t,e){let a=ui(t.device),s=di(t);return a.get(s)?.ready||a.set(s,{ready:e,promise:Promise.resolve(e)}),e}function ci(t,e,a,s){let r=t.device.createPipelineLayout({bindGroupLayouts:[t.layout]}),n=(o,c,l,f,u=[],g=!1,p="none")=>{let h=Os[f],d={format:t.depthFormat,depthWriteEnabled:h.depth,depthCompare:h.depth||h.depthTest?"greater":"always"};return t.stencil&&Object.assign(d,{stencilFront:h.face,stencilBack:h.face,stencilReadMask:h.read,stencilWriteMask:h.write}),s({label:`analytic-${o}${a?"-pick":""}`,layout:r,vertex:{module:t.module,entryPoint:c,buffers:u},fragment:{module:t.module,entryPoint:a?`${l}_pick`:l,...a?{}:{constants:{SAMPLES:t.samples}},targets:[{format:e,writeMask:h.color?GPUColorWrite.ALL:0,...g&&!a?{blend:dr}:{}}]},primitive:{topology:"triangle-list",cullMode:p},depthStencil:d,multisample:{count:a?1:t.samples}})},i=[{arrayStride:8,attributes:[{shaderLocation:0,offset:0,format:"float32x2"}]}];return{shapeMask:n("shape-mask","vs_shape","fs_shape_mask","shapeMask"),shapeAdd:n("shape","vs_shape","fs_shape","shapeAdd"),fan:n("fan","vs_fan","fs_plain_mask","fan",i),coverSubtract:n("cover-subtract","vs_cover","fs_plain_mask","coverSubtract"),coverMark:n("cover-mark","vs_cover","fs_plain_mask","coverMark"),coverAdd:n("cover","vs_cover","fs_cover","coverAdd"),coverClear:n("cover-clear","vs_cover","fs_plain_mask","coverClear"),clear:n("clear","vs_clear","fs_plain_mask","clear"),regionWall:n("region-wall","vs_region_wall","fs_region_wall","solid"),skirt:n("skirt","vs_skirt","fs_skirt","solid"),...a?{}:{shapeLay:n("shape-lay","vs_shape","fs_shape_mask","shapeLay"),coverLay:n("cover-lay","vs_cover","fs_cover_mask","coverLay"),shapeBlend:n("shape-blend","vs_shape","fs_shape","shapeBlend",[],!0),coverBlend:n("cover-blend","vs_cover","fs_cover","coverBlend",[],!0),tintCovered:n("tint-covered","vs_clear","fs_tint_covered","tintCovered",[],!0),tintPlain:n("tint-plain","vs_clear","fs_tint_plain","tintPlain",[],!0),footShape:n("foot-shape","vs_shape","fs_shape_mask","footShape"),footCover:n("foot-cover","vs_cover","fs_cover_mask","footCover"),tintHigh:n("tint-high","vs_clear","fs_tint_covered","tintHigh",[],!0),tintLow:n("tint-low","vs_clear","fs_tint_plain","tintLow",[],!0),regionStep:n("region-step","vs_region_step","fs_region_step","coat"),step:n("step","vs_step","fs_step","coat"),clearLay:n("clear-lay","vs_clear","fs_plain_mask","clearLay"),clearFoot:n("clear-foot","vs_clear","fs_plain_mask","clearFoot"),shapeOnFoot:n("shape-on-foot","vs_shape","fs_shape","shapeOnFoot",[],!0),shapeOffFoot:n("shape-off-foot","vs_shape","fs_shape","shapeOffFoot",[],!0),coverOnFoot:n("cover-on-foot","vs_cover","fs_cover","coverOnFoot",[],!0),coverOffFoot:n("cover-off-foot","vs_cover","fs_cover","coverOffFoot",[],!0)}}}var zt=class{constructor(e){this.renderer=e,this.device=e.device,this.stencil=e.stencil,this.samples=e.sampleCount||1,this.slices=[],this.skin=null,this.eye=null,this.viewMatrix=null,this.extent=null,this.overlay={mode:0,range:[0,1]};let a=Kd(this.device);this.layout=a.layout,this.module=a.module,this.boardClip=null,this.emptyClip=this.device.createTexture({label:"analytic-clip-none",size:[1,1],format:"r8uint",usage:GPUTextureUsage.TEXTURE_BINDING}),this.palette=this.device.createBuffer({label:"analytic-palette",size:8208,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),this.style=Xn(Fa),this.writePalette(),this.pipelines=qy(e)||Wy(e,{color:this.makePipelines(e.format,!1),pick:this.makePipelines("rg32uint",!0)}),this.emptyValues=this.buffer(new Float32Array([3e38]),GPUBufferUsage.STORAGE,"analytic-values-empty"),this.valuesBuffer=this.emptyValues,this.emptyField=this.fieldTexture(1,1,new Float32Array([3e38])),this.uniformScratch=new ArrayBuffer(256),this.netsBuffer=this.buffer(new Uint32Array(1),GPUBufferUsage.STORAGE,"analytic-nets"),this.fieldCache=new li(Hy),this.makeBarrelPipelines(),this.makeArrowPipeline()}makeArrowPipeline(){this.arrowLayout=this.device.createBindGroupLayout({label:"analytic-arrows",entries:[{binding:0,visibility:GPUShaderStage.VERTEX,buffer:{type:"uniform"}},{binding:1,visibility:GPUShaderStage.VERTEX,buffer:{type:"read-only-storage"}},{binding:2,visibility:GPUShaderStage.VERTEX,buffer:{type:"read-only-storage"}},{binding:3,visibility:GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}},{binding:4,visibility:GPUShaderStage.VERTEX,buffer:{type:"read-only-storage"}}]}),this.drawnLayers=new Uint32Array(256),this.drawnLayersBuffer=this.buffer(this.drawnLayers,GPUBufferUsage.STORAGE,"analytic-drawn-layers");let e=this.device.createShaderModule({label:"analytic-arrows",code:Hc});this.arrowPipeline=this.device.createRenderPipeline({label:"analytic-arrow",layout:this.device.createPipelineLayout({bindGroupLayouts:[this.arrowLayout]}),vertex:{module:e,entryPoint:"vs_arrow"},fragment:{module:e,entryPoint:"fs_arrow",targets:[{format:this.renderer.format,blend:dr}]},primitive:{topology:"triangle-list",cullMode:"none"},depthStencil:{format:this.renderer.depthFormat,depthWriteEnabled:!1,depthCompare:"greater-equal"},multisample:{count:this.samples}}),this.arrows=null}writePalette(){let e=new Float32Array(8208/4);e.set(Wn(this.style.fieldColormap,ta),0),e.set(Wn(this.style.arrowColormap,ta),ta*4),e.set(this.style.arrowOutline,2*ta*4),this.device.queue.writeBuffer(this.palette,0,e),this.renderer.invalidate?.()}setStyle(e){return this.style=Xn(e,this.style),this.writePalette(),this.style}setArrows(e){this.arrows?.buffer.destroy(),this.arrows=e?.count?{buffer:this.buffer(new Uint8Array(e.data),GPUBufferUsage.STORAGE,"analytic-arrows"),count:e.count}:null,this.arrows&&(this.arrows.bindGroup=this.device.createBindGroup({layout:this.arrowLayout,entries:[{binding:0,resource:{buffer:this.renderer.globalBuffer}},{binding:1,resource:{buffer:this.arrows.buffer}},{binding:2,resource:{buffer:this.layerOffsets}},{binding:3,resource:{buffer:this.palette}},{binding:4,resource:{buffer:this.drawnLayersBuffer}}]})),this.renderer.invalidate?.()}encodeArrows(e){return this.arrows?(this.device.queue.writeBuffer(this.drawnLayersBuffer,0,this.drawnLayers),e.setPipeline(this.arrowPipeline),e.setBindGroup(0,this.arrows.bindGroup),e.draw(9,2*this.arrows.count),1):0}makeBarrelPipelines(){let e=GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT;this.barrelLayout=this.device.createBindGroupLayout({label:"analytic-barrels",entries:[{binding:0,visibility:e,buffer:{type:"uniform"}},{binding:1,visibility:e,buffer:{type:"uniform"}},{binding:2,visibility:e,buffer:{type:"read-only-storage"}},{binding:3,visibility:GPUShaderStage.FRAGMENT,buffer:{type:"read-only-storage"}},{binding:4,visibility:e,buffer:{type:"read-only-storage"}},{binding:5,visibility:e,buffer:{type:"read-only-storage"}},{binding:6,visibility:e,buffer:{type:"read-only-storage"}},{binding:7,visibility:GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}}]});let a=this.device.createShaderModule({label:"analytic-barrels",code:Kc}),s=this.device.createPipelineLayout({bindGroupLayouts:[this.barrelLayout]}),r=(o,c)=>this.device.createRenderPipeline({label:`analytic-barrel${c?"-pick":""}`,layout:s,vertex:{module:a,entryPoint:"vs_barrel",constants:{PICK_PASS:c?1:0}},fragment:{module:a,entryPoint:c?"fs_barrel_pick":"fs_barrel",targets:[{format:o}],constants:{PICK_PASS:c?1:0}},primitive:{topology:"triangle-list",cullMode:"back"},depthStencil:{format:this.renderer.depthFormat,depthWriteEnabled:!0,depthCompare:"greater"},multisample:{count:c?1:this.samples}});this.barrelPipelines={color:r(this.renderer.format,!1),pick:r("rg32uint",!0)},this.ghostPipeline=this.device.createRenderPipeline({label:"analytic-ghost-barrel",layout:s,vertex:{module:a,entryPoint:"vs_ghost"},fragment:{module:a,entryPoint:"fs_ghost",targets:[{format:this.renderer.format,blend:dr}]},primitive:{topology:"triangle-list",cullMode:"none"},depthStencil:{format:this.renderer.depthFormat,depthWriteEnabled:!1,depthCompare:"greater"},multisample:{count:this.samples}}),this.barrelView=this.device.createBuffer({label:"analytic-barrel-view",size:kn,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),this.layerOffsets=this.device.createBuffer({label:"analytic-layer-offsets",size:256*4,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),this.viewScratch=new ArrayBuffer(kn),this.barrels=null;let n=this.device.createShaderModule({label:"analytic-walls",code:Vc}),i=o=>this.device.createRenderPipeline({label:`analytic-wall${o?"-blend":""}`,layout:s,vertex:{module:n,entryPoint:"vs_wall"},fragment:{module:n,entryPoint:"fs_wall",targets:[{format:this.renderer.format,...o?{blend:dr}:{}}]},primitive:{topology:"triangle-list",cullMode:"none"},depthStencil:{format:this.renderer.depthFormat,depthWriteEnabled:!0,depthCompare:"greater"},multisample:{count:this.samples}});this.wallPipelines={opaque:i(!1),blend:i(!0)},this.walls=null}setWalls({data:e,count:a}){this.walls?.buffer.destroy(),this.walls=a?{buffer:this.buffer(new Uint8Array(e),GPUBufferUsage.STORAGE,"analytic-walls"),count:a,bindGroup:null}:null,this.walls&&(this.walls.bindGroup=this.wallBindGroup()),this.renderer.invalidate?.()}wallBindGroup(){return this.device.createBindGroup({layout:this.barrelLayout,entries:[{binding:0,resource:{buffer:this.renderer.globalBuffer}},{binding:1,resource:{buffer:this.barrelView}},{binding:2,resource:{buffer:this.walls.buffer}},{binding:3,resource:{buffer:this.valuesBuffer}},{binding:4,resource:{buffer:this.layerOffsets}},{binding:5,resource:{buffer:this.netsBuffer}},{binding:6,resource:{buffer:this.renderer.netMaskBuffer}},{binding:7,resource:{buffer:this.palette}}]})}encodeWalls(e,a){return this.walls?(e.setPipeline(a?this.wallPipelines.blend:this.wallPipelines.opaque),e.setBindGroup(0,this.walls.bindGroup),e.draw(6,this.walls.count),1):0}writeView(e,a,s={}){let r=new Float32Array(256);a&&r.set(a.subarray?a.subarray(0,256):a.slice(0,256)),this.device.queue.writeBuffer(this.layerOffsets,0,r);let n=new Float32Array(this.viewScratch),i=new Uint32Array(this.viewScratch);n.fill(0),this.eye=Yy(e),this.viewMatrix=e,n.set(this.eye,0),n.set(this.renderer.barrelColor||[.55,.35,.16,1],4);let o=this.laminateColor()||this.boardLooks().substrate?.color||[.3,.32,.25,1],c=(s.boardOpacity??1)*(.15+.85*(s.assemblyOpacity??1));n.set([...o.slice(0,3),c],8);let l=this.overlay.mode===1||this.overlay.mode===2&&this.valuesBuffer!==this.emptyValues;i[12]=l?1:0,i[13]=s.isolateNet?1:0,i[14]=this.boardShown(s)?1:0,i[15]=this.boardShown(s)&&(s.boardOpacity??1)>=.999&&this.renderer.innerCopperMode!=="all"?1:0,n.set(this.overlay.range,16),this.separated=!!a&&Array.prototype.some.call(a,f=>Math.abs(f)>1e-12),i[18]=this.separated?1:0,n.set(this.edgePlated?[...(this.renderer.barrelColor||[.55,.35,.16]).slice(0,3),c]:[...o.slice(0,3),c],20),n.set([...(this.boardLooks().soldermask?.color||[.06,.16,.11]).slice(0,3),1],24),this.device.queue.writeBuffer(this.barrelView,0,this.viewScratch)}setBarrels({data:e,count:a,skipped:s=0}){this.barrels?.buffer.destroy(),this.barrels=a?{buffer:this.buffer(new Uint8Array(e),GPUBufferUsage.STORAGE,"analytic-barrels"),count:a,skipped:s,bindGroup:null}:null,this.barrels&&(this.barrels.bindGroup=this.barrelBindGroup()),this.renderer.invalidate?.()}hasBarrels(){return!!this.barrels}barrelBindGroup(){return this.device.createBindGroup({layout:this.barrelLayout,entries:[{binding:0,resource:{buffer:this.renderer.globalBuffer}},{binding:1,resource:{buffer:this.barrelView}},{binding:2,resource:{buffer:this.barrels.buffer}},{binding:3,resource:{buffer:this.valuesBuffer}},{binding:4,resource:{buffer:this.layerOffsets}},{binding:5,resource:{buffer:this.netsBuffer}},{binding:6,resource:{buffer:this.renderer.netMaskBuffer}},{binding:7,resource:{buffer:this.palette}}]})}encodeBarrels(e,a,s,r=!1){return this.barrels?(s&&this.writeView(s,a,this.context),e.setPipeline(r?this.barrelPipelines.pick:this.barrelPipelines.color),e.setBindGroup(0,this.barrels.bindGroup),e.draw(36,this.barrels.count),1):0}encodeGhostBarrels(e){return!this.barrels||!this.separated?0:(e.setPipeline(this.ghostPipeline),e.setBindGroup(0,this.barrels.bindGroup),e.draw(Gc,this.barrels.count),1)}buffer(e,a,s){let r=Math.max(16,Math.ceil(e.byteLength/4)*4),n=this.device.createBuffer({label:s,size:r,usage:a|GPUBufferUsage.COPY_DST});return e.byteLength&&this.device.queue.writeBuffer(n,0,e),n}fieldTexture(e,a,s){let r=this.device.createTexture({label:"analytic-field",size:[e,a],format:"r32float",usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST});return this.device.queue.writeTexture({texture:r},s,{bytesPerRow:e*4},[e,a]),r}makePipelines(e,a){return ci(Gd(this.renderer),e,a,s=>this.device.createRenderPipeline(s))}static prewarm(e){let a=di(e),s=ui(e.device),r=s.get(a);if(r)return r.promise;let n=Gd(e),i=l=>e.device.createRenderPipelineAsync(l),o=async l=>Object.fromEntries(await Promise.all(Object.entries(l).map(async([f,u])=>[f,await u]))),c={ready:null,promise:null};return c.promise=Promise.all([o(ci(n,e.format,!1,i)),o(ci(n,"rg32uint",!0,i))]).then(([l,f])=>(c.ready={color:l,pick:f},c.ready)).catch(()=>(s.delete(a),null)),s.set(a,c),c.promise}setSlices(e){this.releaseSlices();let a=new Map;this.slices=e.map(o=>this.uploadSlice(o,a)),this.makePlainSlabs(a),this.makeTwins();let s=e.map(o=>o.z),r=e.flatMap(o=>[o.bounds[0],o.bounds[2]]),n=e.flatMap(o=>[o.bounds[1],o.bounds[3]]);this.extent=e.length?[[Math.min(...r)/1e3,-Math.max(...n)/1e3,Math.min(...s)],[Math.max(...r)/1e3,-Math.min(...n)/1e3,Math.max(...s)]]:null;let i=e.filter(o=>o.skin);this.skin=i.length===2?{top:Math.max(...i.map(o=>o.z)),bottom:Math.min(...i.map(o=>o.z))}:null,this.renderer.invalidate?.()}makeTwins(){this.twinBuffers?.forEach(a=>a.destroy()),this.twinBuffers=[];let e=(a,s)=>{let r={...a,...s,uniform:this.device.createBuffer({label:`analytic-twin-${a.key}`,size:256,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),field:null};return r.bindGroup=this.bindGroup(r),r};this.twins=new Map;for(let a of this.slices){if(a.zLow===void 0||a.role!=="mask"&&a.role!=="silk")continue;let s={low:e(a,{z:a.zLow})},r=a.role==="mask"&&this.slices.find(n=>n.role==="copper"&&n.mark&&n.faceDown===a.faceDown);if(r){let n=this.uploadOpenings(r,a,a.step),i=a.faceDown?r.zTop:r.zBottom;s.foot=e(r,{role:"footprint",z:a.z,dilate:Uy,mark:!1,walls:!1,zTop:Math.max(a.z,i),zBottom:Math.min(a.z,i),...n})}this.twins.set(a,s)}}uploadOpenings(e,a,s=null){let r=s||Nd(e.lowered,a.lowered),n=this.uploadEdges(r,`${e.key}-step`),i=this.buffer(r.shapes,GPUBufferUsage.STORAGE,`analytic-step-shapes-${e.key}`);return this.twinBuffers.push(i,n.edges,n.cuts),{...n,shapes:i}}uploadSlice(e,a=new Map){let{lowered:s}=e,r=GPUBufferUsage.STORAGE;a.has(s)||a.set(s,{shapes:this.buffer(s.shapes,r,`analytic-shapes-${e.key}`),covers:this.buffer(s.covers,r,`analytic-covers-${e.key}`),fans:s.fanVertices.length?this.buffer(s.fanVertices,GPUBufferUsage.VERTEX,`analytic-fans-${e.key}`):null,...this.uploadEdges(s,e.key)});let n={...e,...a.get(s),uniform:this.device.createBuffer({label:`analytic-slice-${e.key}`,size:256,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),shapeCount:s.shapes.length/20,subtractShapes:s.subtractShapes,batches:[],field:null};for(let i=0;i<s.batches.length;i+=5){let[o,c,l,f,u]=s.batches.subarray(i,i+5);n.batches.push({subtract:o===1,firstVertex:c,vertexCount:l,firstCover:f,coverCount:u})}return n.bindGroup=this.bindGroup(n),n}uploadEdges(e,a){let{edgeWords:s,cutWords:r,regionEdges:n,skirtEdges:i}=ni(e);return{edges:this.buffer(s,GPUBufferUsage.STORAGE,`analytic-edges-${a}`),regionEdges:n,skirtEdges:i,cuts:this.buffer(r,GPUBufferUsage.STORAGE,`analytic-cuts-${a}`)}}bindGroup(e){return this.device.createBindGroup({layout:this.layout,entries:[{binding:0,resource:{buffer:this.renderer.globalBuffer}},{binding:1,resource:{buffer:e.uniform}},{binding:2,resource:{buffer:e.shapes}},{binding:3,resource:{buffer:e.covers}},{binding:4,resource:{buffer:this.valuesBuffer}},{binding:5,resource:(e.field?.texture||this.emptyField).createView()},{binding:6,resource:{buffer:this.netsBuffer}},{binding:7,resource:{buffer:this.renderer.netMaskBuffer}},{binding:8,resource:{buffer:e.edges}},{binding:9,resource:{buffer:e.cuts}},{binding:10,resource:{buffer:this.palette}},{binding:11,resource:(this.boardClip?.texture||this.emptyClip).createView()}]})}setBoardClipMask(e){if(!e)return this.setBoardClip(null),null;let{data:a,width:s,height:r}=Xy(e),n=[e.originMm[0]-e.pitchMm,e.originMm[1]-e.pitchMm],i=Math.ceil(s/256)*256,o=i===s?a:new Uint8Array(i*r);if(o!==a)for(let l=0;l<r;l+=1)o.set(a.subarray(l*s,(l+1)*s),l*i);let c=this.device.createTexture({label:"analytic-clip",size:[s,r],format:"r8uint",usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST});return this.device.queue.writeTexture({texture:c},o,{bytesPerRow:i},[s,r]),this.setBoardClip({texture:c,originMm:n,pitchMm:e.pitchMm,width:s,height:r}),this.boardClip}setBoardClip(e){this.boardClip&&this.boardClip!==e&&this.boardClip.texture.destroy(),this.boardClip=e;for(let a of this.slices)a.bindGroup=this.bindGroup(a),a.plain&&(a.plain.bindGroup=this.bindGroup(a.plain));this.renderer.invalidate?.()}coversLayer(e){return this.slices.some(a=>a.role!==void 0?a.role==="copper"&&a.layerId===Number(e):a.layerId===Number(e))}coversRole(e){let a={substrate:"dielectric",soldermask:"mask",silkscreen:"silk",paste:"paste"}[e];return!!a&&this.slices.some(s=>s.role===a)}setOperationValues(e,a){this.clearOverlay(),this.valuesBuffer=this.buffer(oi(e),GPUBufferUsage.STORAGE,"analytic-values"),this.overlay={mode:1,range:a},this.rebind()}setFieldRasters(e,a,s=null){this.clearOverlay(!1),s&&(this.valuesBuffer=this.buffer(oi(s),GPUBufferUsage.STORAGE,"analytic-values"));for(let r of this.slices){let n=e.get(r.key);if(!n)continue;let i=this.fieldCache.texture(n,()=>this.fieldTexture(n.width,n.height,oi(n.values)));r.field={...n,texture:i}}this.fieldCache.trim(),this.overlay={mode:2,range:a},this.rebind()}clearOverlay(e=!0){this.valuesBuffer!==this.emptyValues&&this.valuesBuffer.destroy(),this.valuesBuffer=this.emptyValues;for(let a of this.slices)a.field=null;this.overlay={mode:0,range:[0,1]},e&&this.rebind()}setOperationNets(e){this.netsBuffer.destroy(),this.netsBuffer=this.buffer(e.length?e:new Uint32Array(1),GPUBufferUsage.STORAGE,"analytic-nets"),this.rebind()}rebind(){this.boundNetMask=this.renderer.netMaskBuffer;for(let e of this.slices)e.bindGroup=this.bindGroup(e),e.plain&&(e.plain.bindGroup=this.bindGroup(e.plain));for(let e of this.twins?.values()||[])for(let a of Object.values(e))a.bindGroup=this.bindGroup(a);this.barrels&&(this.barrels.bindGroup=this.barrelBindGroup()),this.walls&&(this.walls.bindGroup=this.wallBindGroup()),this.renderer.invalidate?.()}writeSlice(e,a,s=null){let r=new Float32Array(this.uniformScratch),n=new Uint32Array(this.uniformScratch);r.fill(0),r.set(s?.color||e.color,0);let[i,o]=e.offsetLayers||[e.layerId,e.layerId];r[4]=e.z+.5*((a?.[i]||0)+(a?.[o]||0));let c=this.context?.flat?.get(e.layerId);c&&(r[4]=e.z-c.z,r[44]=c.offset[0]||0,r[45]=c.offset[1]||0);let l=e.role===void 0||e.role==="copper";n[5]=l?this.overlay.mode:0;let u=(this.context||{}).isolateNet||!e.outer&&this.renderer.innerCopperMode==="lit";n[7]=l?2|(u?1:0):0;let g=l?e.field:null;if(n[6]=g?1:0,g){r.set(g.originMm,8);let[h,d]=Array.isArray(g.pitchMm)?g.pitchMm:[g.pitchMm,g.pitchMm];r[10]=h,r[11]=d,n[12]=g.width,n[13]=g.height}if(r.set(this.overlay.range,16),r.set(e.bounds,20),r.set([s?.metallic??0,s?.roughness??.72,e.faceDown??e.bottom?-1:1,l?1:0],24),e.zTop!==void 0){let h=r[4]-e.z;r.set([e.zBottom+h,e.zTop+h],28)}n[30]=e.subtractShapes||0,r[31]=e.dilate||0,this.eye&&r.set(this.eye,32);let p=e.role!=="dielectric"?this.boardClip:null;p&&(r.set(p.originMm,36),r[38]=p.pitchMm,r[39]=p.pitchMm,n[40]=p.width,n[41]=p.height,n[42]=1),this.device.queue.writeBuffer(e.uniform,0,this.uniformScratch)}copperLooks(){let e=new Map;for(let a of this.renderer.entries||[]){let s=Number(a.layerId);if(a.kind!=="copper"||e.has(s))continue;let r=a.color||a.material?.baseColor;e.set(s,{color:r&&r.length<4?[...r,1]:r,metallic:a.material?.metallic||0,roughness:a.material?.roughness??.72})}for(let[a,s]of this.renderer.copperColors||[])e.has(a)||e.set(a,{color:s.length<4?[...s,1]:s,metallic:0,roughness:.72});return e}boardLooks(){let e={};for(let a of this.renderer.entries||[]){if(a.kind!=="board"||e[a.boardRole])continue;let s=a.color||a.material?.baseColor;e[a.boardRole]={color:s&&s.length<4?[...s,1]:s,metallic:a.material?.metallic||0,roughness:a.material?.roughness??.72}}return Ky(e,this.renderer.stackupLooks)}laminateColor(){return this.slices.find(e=>e.role==="dielectric"&&e.color)?.color||null}lookFor(e,a,s,r){if(e.role===void 0||e.role==="copper")return a.get(e.layerId);let n=r.boardOpacity??1,i=(c,l)=>{let f=s[c];if(!f)return null;let u=f.color||[1,1,1,1];return{...f,color:[u[0],u[1],u[2],l(Number.isFinite(u[3])?u[3]:1)]}};if(e.role==="dielectric"){let c=n*(.15+.85*(r.assemblyOpacity??1));return e.color?{...s.substrate||{metallic:0,roughness:.72},color:[...e.color.slice(0,3),c]}:i("substrate",()=>c)}let o=r.assemblyOpacity??1;return e.role==="mask"?i("soldermask",c=>Math.min(c,.72)*n*o):e.role==="silk"?i("silkscreen",c=>Math.min(c,.92)*n*o):i("paste",c=>c)}encodeInto(e,a,s,r=!1,n={}){this.context=n,this.renderer.netMaskBuffer!==this.boundNetMask&&this.rebind(),n.matrix&&this.writeView(n.matrix,a,n);let i=r?this.pipelines.pick:this.pipelines.color,o=this.copperLooks(),c=this.boardLooks(),f=this.boardShown(n)&&(n.boardOpacity??1)>=.999,u=0;r||this.drawnLayers.fill(0);for(let g of this.slices){let p=g.role===void 0||g.role==="copper";(p?s&&!s.has(g.layerId):r||g.role!=="dielectric"||!f)||p&&!g.outer&&g.role!==void 0&&this.renderer.innerCopperMode==="none"||g.role==="dielectric"&&!g.skin&&this.renderer.innerCopperMode!=="all"||this.behindBoard(g,n)||(this.encodeSlice(e,i,g,"opaque",a,this.lookFor(g,o,c,n)),!r&&p&&g.face===(g.bottom?"bottom":"top")&&(this.drawnLayers[g.layerId]=1),u+=1)}return f&&!r&&(u+=this.encodeWalls(e,!1)),this.stencil&&e.setStencilReference(1),u}layerZ(e){let a=this.slices.filter(s=>(s.role===void 0||s.role==="copper")&&s.layerId===e).map(s=>s.z);return a.length?(Math.min(...a)+Math.max(...a))/2:null}boardShown(e){return(e.showBoard??!0)&&!e.panelLayer}behindBoard(e,a){if(!this.skin||!this.eye||this.renderer.innerCopperMode==="all"||!this.boardShown(a)||(a.boardOpacity??1)<.999)return!1;let[,,s,r]=this.eye,n=r?s>this.skin.top:s<0,i=r?s<this.skin.bottom:s>0;return e.faceDown?n:i}encodeBlended(e,a,s,r={}){if(!this.stencil)return 0;this.context=r;let n=this.copperLooks(),i=this.boardLooks(),o=this.boardShown(r),c=o&&(r.boardOpacity??1)<.999,l=0,f=(h,d)=>{this.behindBoard(h,r)||(this.encodeSlice(e,this.pipelines.color,h,d,a,this.lookFor(h,n,i,r)),l+=1)};for(let h of this.slices)c&&h.role==="dielectric"&&f(h,"blend");c&&(l+=this.encodeWalls(e,!0));let u=o&&(r.assemblyOpacity??1)>.01,g=h=>!Gy(r.hiddenBoardLayers,h),p=new Set;for(let h of this.slices){if(h.role!=="mask"||!u||!g(h)||this.behindBoard(h,r))continue;let d=this.twins.get(h);if(!d?.foot){f(h,"mask");continue}let m=this.slices.filter(b=>b.role==="silk"&&b.faceDown===h.faceDown&&g(b)&&!this.behindBoard(b,r));for(let b of m)p.add(b);l+=this.encodeConformal(e,h,d,m,a,b=>this.lookFor(b,n,i,r))}for(let h of this.slices)h.role==="paste"&&g(h)&&!r.hidePaste&&!r.panelLayer&&(!s||s.has(h.offsetLayers?.[0]))&&f(h,"blend");for(let h of this.slices)h.role==="silk"&&u&&g(h)&&!p.has(h)&&f(h,"blend");return e.setStencilReference(1),l}encodeSlice(e,a,s,r,n,i){let o=this.drawnSlice(s),c=a===this.pipelines.pick?void 0:this.sliceRect(o,n);c!==null&&(c&&e.setScissorRect(c.x,c.y,c.width,c.height),this.encodeSliceIn(e,a,o,r,n,i),c&&e.setScissorRect(this.viewport.x,this.viewport.y,this.viewport.width,this.viewport.height))}sliceRect(e,a){let s=this.viewport,r=this.viewMatrix;if(!s||!r||!e.bounds||this.context?.flat)return;let[n,i]=e.offsetLayers||[e.layerId,e.layerId],o=.5*((a?.[n]||0)+(a?.[i]||0)),c=[e.z,e.zBottom??e.z,e.zTop??e.z,e.zLow??e.z].map(E=>E+o),[l,f,u,g]=e.bounds,[p,h,d,m]=[1/0,1/0,-1/0,-1/0];for(let E of[l/1e3,u/1e3])for(let T of[-f/1e3,-g/1e3])for(let _ of[Math.min(...c),Math.max(...c)]){let S=r[3]*E+r[7]*T+r[11]*_+r[15];if(!(S>1e-9))return;let N=s.x+((r[0]*E+r[4]*T+r[8]*_+r[12])/S+1)*.5*s.width,R=s.y+(1-(r[1]*E+r[5]*T+r[9]*_+r[13])/S)*.5*s.height;p=Math.min(p,N),d=Math.max(d,N),h=Math.min(h,R),m=Math.max(m,R)}let b=Math.max(s.x,Math.floor(p-lr)),y=Math.max(s.y,Math.floor(h-lr)),x=Math.min(s.x+s.width,Math.ceil(d+lr)),w=Math.min(s.y+s.height,Math.ceil(m+lr));return x<=b||w<=y?null:{x:b,y,width:x-b,height:w-y}}encodeSliceIn(e,a,s,r,n,i){this.writeSlice(s,n,i),e.setBindGroup(0,s.bindGroup),this.stencil?this.encodeStencilled(e,a,s,r):this.encodeAddsOnly(e,a,s),r==="opaque"&&s.walls&&this.encodeSlabWalls(e,a,s)}wallPixels(e){let a=this.viewMatrix,s=this.renderer.canvas;if(!a||!this.extent||!s)return 1/0;let[r,n]=this.extent,i=[];for(let l of[r[0],n[0]])for(let f of[r[1],n[1]])for(let u of[r[2],n[2]])i.push([l,f,u]);this.eye?.[3]&&i.push(this.eye.slice(0,3).map((l,f)=>Math.min(n[f],Math.max(r[f],l/this.eye[3]))));let o=([l,f,u])=>{let g=[0,1,2,3].map(p=>a[p]*l+a[4+p]*f+a[8+p]*u+a[12+p]);return g[3]>1e-9?[g[0]/g[3],g[1]/g[3]]:null},c=0;for(let l of i){let f=o(l),u=o([l[0],l[1],l[2]+e]);if(!f||!u)return 1/0;c=Math.max(c,Math.hypot((u[0]-f[0])*s.width/2,(u[1]-f[1])*s.height/2))}return c}encodeSlabWalls(e,a,s){this.stencil&&e.setStencilReference(0),s.regionEdges&&(e.setPipeline(a.regionWall),e.draw(6,s.regionEdges,0,0)),s.skirtEdges&&this.wallPixels(s.zTop-s.zBottom)>=Dd&&(e.setPipeline(a.skirt),e.draw(12,s.skirtEdges,0,s.regionEdges))}encodeAddsOnly(e,a,s){let r=s.shapeCount-s.subtractShapes;r&&(e.setPipeline(a.shapeAdd),e.draw(6,r,0,s.subtractShapes))}encodeStencilled(e,a,s,r="opaque"){let n=(i,o=Os[i].reference)=>{e.setPipeline(a[i]),e.setStencilReference(o)};this.encodeFill(e,s,n,r),r==="mask"&&(n("tintCovered"),e.draw(6),n("tintPlain"),e.draw(6)),n("clear"),e.draw(6)}encodeFill(e,a,s,r){let n=r==="footprint";a.subtractShapes&&!n&&(s("shapeMask"),e.draw(6,a.subtractShapes,0,0)),n||this.encodeBatches(e,a,!0,s,r);let i=a.shapeCount-a.subtractShapes;i&&(r==="opaque"?s("shapeAdd",a.mark?33:32):s({mask:"shapeLay",blend:"shapeBlend",footprint:"footShape",onFoot:"shapeOnFoot",offFoot:"shapeOffFoot"}[r]),e.draw(6,i,0,a.subtractShapes)),this.encodeBatches(e,a,!1,s,r)}encodeConformal(e,a,{low:s,foot:r},n,i,o){let c=[a,s,r,...n,...n.map(u=>this.twins.get(u)?.low).filter(Boolean)],l=$y(c.map(u=>this.sliceRect(u,i)));if(l===null)return 0;l&&e.setScissorRect(l.x,l.y,l.width,l.height);let f=this.encodeConformalIn(e,a,{low:s,foot:r},n,i,o);return l&&e.setScissorRect(this.viewport.x,this.viewport.y,this.viewport.width,this.viewport.height),f}encodeConformalIn(e,a,{low:s,foot:r},n,i,o){let c=this.pipelines.color,l=p=>Os[p==="step"||p==="regionStep"?"coat":p],f=(p,h=l(p).reference)=>{e.setPipeline(c[p]),e.setStencilReference(h)},u=(p,h)=>{this.writeSlice(p,i,h),e.setBindGroup(0,p.bindGroup)},g=o(a);u(r,g),this.encodeFill(e,r,f,"footprint"),u(a,g),this.encodeFill(e,a,f,"mask"),f("tintHigh"),e.draw(6),e.setBindGroup(0,r.bindGroup),r.regionEdges&&(f("regionStep"),e.draw(6,r.regionEdges,0,0)),r.skirtEdges&&this.wallPixels(r.zTop-r.zBottom)>=Dd&&(f("step"),e.draw(12,r.skirtEdges,0,r.regionEdges)),e.setBindGroup(0,a.bindGroup),f("clearLay"),e.draw(6),u(s,g),this.encodeFill(e,s,f,"mask"),f("tintLow"),e.draw(6),f("clearLay"),e.draw(6);for(let p of n){let h=o(p);u(p,h),this.encodeFill(e,p,f,"onFoot"),f("clear"),e.draw(6);let d=this.twins.get(p)?.low;d&&(u(d,h),this.encodeFill(e,d,f,"offFoot"),f("clear"),e.draw(6))}return e.setBindGroup(0,a.bindGroup),f("clearFoot"),e.draw(6),e.setStencilReference(1),1+n.length}encodeBatches(e,a,s,r,n="opaque"){let i=a.batches.findLast(o=>!o.subtract);for(let o of a.batches){if(o.subtract!==s||!a.fans)continue;r("fan"),e.setVertexBuffer(0,a.fans),e.draw(o.vertexCount,1,o.firstVertex,0),!s&&n==="opaque"&&(a.mark||a.role==="dielectric")&&(r("coverMark",a.mark?65:64),e.draw(6,o.coverCount,0,o.firstCover));let c={opaque:"coverAdd",blend:"coverBlend",mask:"coverLay",footprint:"footCover",onFoot:"coverOnFoot",offFoot:"coverOffFoot"}[n];r(s?"coverSubtract":c),e.draw(6,o.coverCount,0,o.firstCover),!s&&(o!==i||n==="footprint")&&(r("coverClear"),e.draw(6,o.coverCount,0,o.firstCover))}}gpuMemoryBytes(){let e=this.valuesBuffer===this.emptyValues?0:this.valuesBuffer.size;this.barrels&&(e+=this.barrels.count*Uc),this.walls&&(e+=this.walls.count*zc);let a=new Set;for(let s of this.slices.flatMap(r=>r.plain?[r,r.plain]:[r]))for(let r of[s.shapes,s.covers,s.fans,s.uniform,s.edges,s.cuts])r&&a.add(r);for(let s of a)e+=s.size;return e+this.fieldCache.bytes()}stats(){return{slices:this.slices.map(e=>({key:e.key,role:e.role||"copper",face:e.face,layerId:e.layerId,z:e.z,shapes:e.shapeCount,subtractShapes:e.subtractShapes,regionBatches:e.batches.length,fanVertices:e.lowered.fanVertices.length/2,covers:e.lowered.covers.length/6,approximations:e.lowered.stats})),overlay:this.overlay.mode,barrels:this.barrels?{count:this.barrels.count,skipped:this.barrels.skipped}:null,walls:this.walls?.count||0,gpuMemoryBytes:this.gpuMemoryBytes(),degraded:!this.stencil}}makePlainSlabs(e){let a=new Map;for(let s of this.slices){if(s.role!=="dielectric"||!s.lowered)continue;a.has(s.lowered)||a.set(s.lowered,Bd(s.lowered));let r=a.get(s.lowered);r&&(s.plain=this.uploadSlice({...s,lowered:r,plain:null},e))}}drawnSlice(e){return this.separated&&e.plain?e.plain:e}releaseSlices(){for(let a of this.twins?.values()||[])for(let s of Object.values(a))s.uniform.destroy();this.twinBuffers?.forEach(a=>a.destroy()),this.twinBuffers=[],this.twins=new Map;let e=new Set;for(let a of this.slices.flatMap(s=>s.plain?[s,s.plain]:[s]))for(let s of[a.shapes,a.covers,a.fans,a.uniform,a.edges,a.cuts])s&&e.add(s);for(let a of e)a.destroy();this.fieldCache?.clear(),this.slices=[]}destroy(){this.releaseSlices(),this.barrels?.buffer.destroy(),this.walls?.buffer.destroy(),this.arrows?.buffer.destroy(),this.drawnLayersBuffer.destroy(),this.palette.destroy(),this.netsBuffer.destroy(),this.barrelView.destroy(),this.layerOffsets.destroy(),this.valuesBuffer!==this.emptyValues&&this.valuesBuffer.destroy(),this.emptyValues.destroy(),this.emptyField.destroy(),this.boardClip?.texture.destroy(),this.emptyClip.destroy()}};function Xy({data:t,width:e,height:a}){let s=e+2,r=a+2,n=new Uint8Array(s*r);for(let i=0;i<a;i+=1)for(let o=0;o<e;o+=1)if(t[i*e+o])for(let c=0;c<3;c+=1)n.fill(1,(i+c)*s+o,(i+c)*s+o+3);return{data:n,width:s,height:r}}function $y(t){let e=null;for(let a of t){if(a===void 0)return;if(!a)continue;if(!e){e={...a};continue}let s=Math.min(e.x,a.x),r=Math.min(e.y,a.y);e={x:s,y:r,width:Math.max(e.x+e.width,a.x+a.width)-s,height:Math.max(e.y+e.height,a.y+a.height)-r}}return e}function Yy(t){let e=Jy(Array.from(t,Number));if(!e)return[0,0,-1,0];let a=l=>[0,1,2,3].map(f=>e[f]*l[0]+e[4+f]*l[1]+e[8+f]*l[2]+e[12+f]*l[3]),s=a([0,0,1,0]),r=Math.hypot(s[0],s[1],s[2]);if(Math.abs(s[3])>1e-9*Math.max(r,1e-30))return[s[0]/s[3],s[1]/s[3],s[2]/s[3],1];let n=a([0,0,1,1]),i=a([0,0,0,1]),o=[0,1,2].map(l=>i[l]/i[3]-n[l]/n[3]),c=Math.hypot(...o)||1;return[...o.map(l=>l/c),0]}function Jy(t){let e=new Array(16);e[0]=t[5]*t[10]*t[15]-t[5]*t[11]*t[14]-t[9]*t[6]*t[15]+t[9]*t[7]*t[14]+t[13]*t[6]*t[11]-t[13]*t[7]*t[10],e[4]=-t[4]*t[10]*t[15]+t[4]*t[11]*t[14]+t[8]*t[6]*t[15]-t[8]*t[7]*t[14]-t[12]*t[6]*t[11]+t[12]*t[7]*t[10],e[8]=t[4]*t[9]*t[15]-t[4]*t[11]*t[13]-t[8]*t[5]*t[15]+t[8]*t[7]*t[13]+t[12]*t[5]*t[11]-t[12]*t[7]*t[9],e[12]=-t[4]*t[9]*t[14]+t[4]*t[10]*t[13]+t[8]*t[5]*t[14]-t[8]*t[6]*t[13]-t[12]*t[5]*t[10]+t[12]*t[6]*t[9],e[1]=-t[1]*t[10]*t[15]+t[1]*t[11]*t[14]+t[9]*t[2]*t[15]-t[9]*t[3]*t[14]-t[13]*t[2]*t[11]+t[13]*t[3]*t[10],e[5]=t[0]*t[10]*t[15]-t[0]*t[11]*t[14]-t[8]*t[2]*t[15]+t[8]*t[3]*t[14]+t[12]*t[2]*t[11]-t[12]*t[3]*t[10],e[9]=-t[0]*t[9]*t[15]+t[0]*t[11]*t[13]+t[8]*t[1]*t[15]-t[8]*t[3]*t[13]-t[12]*t[1]*t[11]+t[12]*t[3]*t[9],e[13]=t[0]*t[9]*t[14]-t[0]*t[10]*t[13]-t[8]*t[1]*t[14]+t[8]*t[2]*t[13]+t[12]*t[1]*t[10]-t[12]*t[2]*t[9],e[2]=t[1]*t[6]*t[15]-t[1]*t[7]*t[14]-t[5]*t[2]*t[15]+t[5]*t[3]*t[14]+t[13]*t[2]*t[7]-t[13]*t[3]*t[6],e[6]=-t[0]*t[6]*t[15]+t[0]*t[7]*t[14]+t[4]*t[2]*t[15]-t[4]*t[3]*t[14]-t[12]*t[2]*t[7]+t[12]*t[3]*t[6],e[10]=t[0]*t[5]*t[15]-t[0]*t[7]*t[13]-t[4]*t[1]*t[15]+t[4]*t[3]*t[13]+t[12]*t[1]*t[7]-t[12]*t[3]*t[5],e[14]=-t[0]*t[5]*t[14]+t[0]*t[6]*t[13]+t[4]*t[1]*t[14]-t[4]*t[2]*t[13]-t[12]*t[1]*t[6]+t[12]*t[2]*t[5],e[3]=-t[1]*t[6]*t[11]+t[1]*t[7]*t[10]+t[5]*t[2]*t[11]-t[5]*t[3]*t[10]-t[9]*t[2]*t[7]+t[9]*t[3]*t[6],e[7]=t[0]*t[6]*t[11]-t[0]*t[7]*t[10]-t[4]*t[2]*t[11]+t[4]*t[3]*t[10]+t[8]*t[2]*t[7]-t[8]*t[3]*t[6],e[11]=-t[0]*t[5]*t[11]+t[0]*t[7]*t[9]+t[4]*t[1]*t[11]-t[4]*t[3]*t[9]-t[8]*t[1]*t[7]+t[8]*t[3]*t[5],e[15]=t[0]*t[5]*t[10]-t[0]*t[6]*t[9]-t[4]*t[1]*t[10]+t[4]*t[2]*t[9]+t[8]*t[1]*t[6]-t[8]*t[2]*t[5];let a=t[0]*e[0]+t[1]*e[4]+t[2]*e[8]+t[3]*e[12];return a?e.map(s=>s/a):null}function Vd(t,e=1536){if(!t||t.length<12)return null;let[a,s,r,n]=[1/0,1/0,-1/0,-1/0];for(let p=0;p+3<t.length;p+=4)a=Math.min(a,t[p],t[p+2]),r=Math.max(r,t[p],t[p+2]),s=Math.min(s,t[p+1],t[p+3]),n=Math.max(n,t[p+1],t[p+3]);let i=1;[a,s,r,n]=[a-i,s-i,r+i,n+i];let o=Math.max(Math.max(r-a,n-s)/e,.02),c=Math.max(1,Math.ceil((r-a)/o)),l=Math.max(1,Math.ceil((n-s)/o)),f=new Uint8Array(c*l),u=Array.from({length:l},()=>[]);for(let p=0;p+3<t.length;p+=4){let[h,d,m,b]=[t[p],t[p+1],t[p+2],t[p+3]];if(d===b)continue;let y=Math.max(0,Math.ceil((Math.min(d,b)-s)/o-.5)),x=Math.min(l-1,Math.floor((Math.max(d,b)-s)/o-.5));for(let w=y;w<=x;w+=1)u[w].push(p)}let g=[];for(let p=0;p<l;p+=1){let h=s+(p+.5)*o;g.length=0;for(let d of u[p]){let[m,b,y,x]=[t[d],t[d+1],t[d+2],t[d+3]];b<=h!=x<=h&&g.push(m+(h-b)/(x-b)*(y-m))}g.sort((d,m)=>d-m);for(let d=0;d+1<g.length;d+=2){let m=Math.max(0,Math.ceil((g[d]-a)/o-.5)),b=Math.min(c-1,Math.floor((g[d+1]-a)/o-.5));b>=m&&f.fill(1,p*c+m,p*c+b+1)}}return{data:f,width:c,height:l,originMm:[a,s],pitchMm:o}}function Qy(t,e,a=0){let s=new Map((e||[]).map(r=>[Number(r.id),r]));for(let r of t||[]){let n=s.get(Number(r.layerId));if(r.kind!=="copper"||!n||!r.quantMin||!r.quantSize)continue;let i=r.quantSize[2]===1;return r.quantMin[2]+(i?0:r.quantSize[2]/2)-Number(n.z_mm||0)/1e3}return Number(a||0)/1e3}async function hi({renderer:t,layers:e,colorFor:a,bytes:s,wasm:r,toleranceNm:n,nets:i=[],features:o=[],boardZOffsetMm:c=0,pack:l=null,cache:f=null,pool:u=null,netIds:g=null}){let p={},h=performance.now(),d=j=>{let re=performance.now();p[j]=Math.round(re-h),h=re},m=l||await Va(s,{wasm:r}),b=m.lowerSlice?m:null,y=async()=>b??=await Va(s,{wasm:r});d("open");let x=Qy(t.entries,e,c),{planned:w,unmatched:E}=bd(m.header,e,x),T=new Map(e.map(j=>[Number(j.id),j])),_=performance.now(),S=[...new Set(w.map(j=>j.key))],N=n??Dt,R=new Map,I=f?{cacheKey:f.cacheKey,wasmKey:sa(),toleranceNm:N}:null;if(I){let j=S.filter(re=>!R.has(re));for(let[re,He]of await qa(f.store,I,j))R.set(re,He);p.cached=S.filter(re=>R.has(re)).length}let C=S.filter(j=>!R.has(j)),A=Td(m.header),P=new Set,K=I&&typeof f.store.adopt=="function"&&f.store.enabled!==!1?{identity:I,writes:[],adopt(j,re){f.store.adopt(rr(I.cacheKey,I.wasmKey,I.toleranceNm,j),re),P.add(j)}}:null,W=C.length?u?await u.lower(C,N,A,K):await Sd(s,C,N,r??ar(),{weights:A}):new Map;p.lowerIn=C.length?W?"workers":"main":"none";let Q=new Map;for(let j of C){let re=W?.get(j);Q.set(j,re||(await y()).lowerSlice(j,n)),R.set(j,re?nr(re):Q.get(j))}let pe=w.map(j=>({...j,color:j.role==="copper"?a(T.get(j.layerId)):j.color||[1,1,1,1],lowered:R.get(j.key)})),se=Cd(pe),be=se.map(([j,re])=>cr(j,re)),Ee=I?await qa(f.store,I,be):new Map,ue=se.filter((j,re)=>!Ee.has(be[re])),Te=ue.length&&u?await u.steps(ue.map(([j,re])=>[re.lowered,j.lowered]),K,ue.map(([j,re])=>cr(j,re))):[],ge=new Map;ue.forEach(([j,re],He)=>{Te[He]&&ge.set(cr(j,re),Te[He])}),se.forEach(([j],re)=>{let He=ge.get(be[re]);j.step=Ee.get(be[re])||He&&nr(He)||null}),p.steps=`${Ee.size} cached, ${ge.size} in workers, ${se.length-Ee.size-ge.size} here`;let Re=j=>!!W?.get(j)||ge.has(j),Me=new Map([...Q,...ge].filter(([j])=>!(K&&Re(j)))),ba=I&&Me.size?ti(f.store,I,Me):Promise.resolve(),qt=performance.now()-_;d("lower"),await zt.prewarm(t);let M=new zt(t);M.setSlices(pe),d("slices");let O=pe.find(j=>j.role==="dielectric"&&j.lowered?.contourEdges?.length)?.lowered.contourEdges,L=Vd(O),X=await m.barrels();M.setBarrels(gd(m.header,X,pe,O)),M.setBoardClipMask(L),d("barrels");let fe=new Set;for(let j=0;j<X.words.length;j+=tr)fe.add(X.words[j]);M.edgePlated=!!m.header.stack?.edge_plating,M.setWalls(md(pe,R,e,x)),d("walls");let ye=g?null:await m.netIndices?.(),Qe=g||yd(ye?{header:m.header,netIndices:()=>ye}:m,i);M.setOperationNets(Qe),d("nets");let Wt=Promise.resolve();if(I){let j=ye?ti(f.store,I,new Map([[Ha,wd(m.header,X,ye)]])):Promise.resolve(),re=K?[...Q.keys(),...ge.keys()].filter(Re):[];Wt=Promise.all([ba,j,...K?.writes||[]]).then(()=>{if(re.every(He=>P.has(He)))return Ed(f.store,I)})}let rt=new Map;for(let j of o||[])j?.sourceUid&&(rt.has(j.sourceUid)||rt.set(j.sourceUid,[]),rt.get(j.sourceUid).push(j));return d("features"),b&&b!==m&&b.free(),{cacheWrites:Wt,pack:m,analytic:M,unmatched:E,lowerMs:qt,timings:p,zOffset:x,operations:ra(m.header),overlay:null,netIds:Qe,featuresBySource:rt,barrelOperations:fe,lowered:R}}async function bi(t,e){let a=(await t.pack.binding(e))?.source_uid,s=a?t.featuresBySource?.get(a)||[]:[],r=t.netIds?.[e]||0,n=s.find(i=>Number(i.netId)===r)||s[0];return n?Number(n.id):0}async function Wd(t,e,a){let s=Yi+e;if(a.features.has(s))return s;let r=await t.pack.binding(e);if(!r)return 0;let n=String(r.refdes||""),i=String(r.pad_number||"");if(n&&!i)return Number(a.componentFeatures.get(n)?.featureId||0);let o=Number(t.netIds?.[e]||0);return!i&&!o?0:(a.features.set(s,{id:s,kind:String(r.source_kind||"copper"),...n?{designator:n}:{},...i?{padNumber:i}:{},netId:o,sourceUid:String(r.source_uid||""),bounds:null}),s)}function Xd(t,e){if(!e)return t.analytic.clearOverlay(),t.overlay=null,null;if(e.kind==="operation_values"){let a=ei(e.values,t.operations),s=e.range||na(a);t.analytic.setOperationValues(a,s),t.overlay={...e,values:a,range:s}}else if(e.kind==="field_tiles"){let a=pd(e.tiles),s=e.range||na([...a.values()].flatMap(r=>[...na(r.values)]));t.analytic.setFieldRasters(a,s),t.overlay={...e,range:s,slices:[...a.keys()]}}else if(e.kind==="field_grid"){let a=sr(e.grid),s=e.range||na([...a.values()].flatMap(n=>[...na(n.values)])),r=e.values?ei(e.values,t.operations):null;t.analytic.setFieldRasters(a,s,r),t.overlay={kind:e.kind,quantity:e.quantity,units:e.units,range:s,slices:[...a.keys()],barrels:r,net:e.grid?.net??null}}else throw new TypeError(`unknown analytic overlay kind ${e.kind}`);return{kind:e.kind,range:t.overlay.range}}function fi(t,e,a=!1){let[s,r]=Array.isArray(t.pitchMm)?t.pitchMm:[t.pitchMm,t.pitchMm],n=(e[0]-t.originMm[0])/s-.5,i=(e[1]-t.originMm[1])/r-.5,o=(m,b)=>m<0||b<0||m>=t.width||b>=t.height?NaN:t.values[b*t.width+m],[c,l]=[Math.floor(n),Math.floor(i)],[f,u]=[n-c,i-l],g=o(c,l),p=o(c+1,l),h=o(c,l+1),d=o(c+1,l+1);return[g,p,h,d].every(Number.isFinite)?(g*(1-f)+p*f)*(1-u)+(h*(1-f)+d*f)*u:a?NaN:o(Math.floor(n+.5),Math.floor(i+.5))}function Zy(t,e,a){let[s,r]=Array.isArray(t.pitchMm)?t.pitchMm:[t.pitchMm,t.pitchMm],n=(e[0]-t.originMm[0])/s-.5,i=(e[1]-t.originMm[1])/r-.5,o=NaN,c=1/0;for(let l=Math.floor(i)-a+1;l<=Math.floor(i)+a;l+=1)for(let f=Math.floor(n)-a+1;f<=Math.floor(n)+a;f+=1){if(f<0||l<0||f>=t.width||l>=t.height)continue;let u=t.values[l*t.width+f],g=(f-n)**2+(l-i)**2;Number.isFinite(u)&&g<c&&([o,c]=[u,g])}return o}function $d(t){let e=new Map;for(let a of t.analytic.slices){if(!a.field||!(a.role===void 0||a.role==="copper"))continue;let s=e.get(a.layerId);(!s||a.z>s.z)&&e.set(a.layerId,a)}return[...e.values()].map(a=>({slice:a,key:a.key,layerId:a.layerId,cells:a.field.values.reduce((s,r)=>s+(Number.isFinite(r)?1:0),0)}))}function Yd(t,e){if(!e)return 0;let a=(t||[]).find(s=>s?.name===e)||(t||[]).find(s=>(s?.aliases||[]).includes(e));return a&&Number(a.id)||0}var Hd=48,e0=70,qd=2e-6,t0=.95;function a0(t,e,a,{spacingMm:s=null,floor:r=.001,density:n=e0,width:i=.07,minLength:o=.3}={}){let c=t.filter(x=>x.role==="copper"&&e.has(x.key)&&a.has(x.key)&&x.face===(x.bottom?"bottom":"top"));if(!c.length)return{data:new ArrayBuffer(0),count:0,spacingMm:0,max:0,reference:0};let l=c.reduce((x,w)=>[Math.min(x[0],w.bounds[0]),Math.min(x[1],w.bounds[1]),Math.max(x[2],w.bounds[2]),Math.max(x[3],w.bounds[3])],[1/0,1/0,-1/0,-1/0]),f=s||Math.max(l[2]-l[0],l[3]-l[1])/n,u=[];for(let x of c){let[w,E]=[e.get(x.key),a.get(x.key)],[T,_,S,N]=x.bounds;for(let R=l[0]+Math.ceil((T-l[0])/f)*f+f/2;R<=S;R+=f)for(let I=l[1]+Math.ceil((_-l[1])/f)*f+f/2;I<=N;I+=f){let C=fi(w,[R,I],!0),A=fi(E,[R,I],!0),P=Math.hypot(C,A);P>0&&u.push({face:x,x:R,y:I,jx:C,jy:A,size:P})}}let g=u.map(x=>x.size).sort((x,w)=>x-w),p=g.length?g[g.length-1]:0,h=g.length?g[Math.min(g.length-1,Math.floor(t0*g.length))]:0,d=u.filter(x=>x.size>=r*h),m=new ArrayBuffer(d.length*Hd),b=new Float32Array(m),y=new Uint32Array(m);return d.forEach((x,w)=>{let E=w*(Hd/4),[T,_]=x.face.offsetLayers||[x.face.layerId,x.face.layerId],S=x.face.bottom?-qd:qd,N=Math.min(1,x.size/h),R=.9*f*(o+(1-o)*Math.sqrt(N))/1e3;b.set([x.x/1e3,-x.y/1e3,x.face.z+S,i*f/1e3,x.jx/x.size,-x.jy/x.size,R,N],E),y.set([T,_,0,0],E+8)}),{data:m,count:d.length,spacingMm:f,max:p,reference:h}}function pi(t,e){if(!e)return t.analytic.setArrows(null),t.vectors=null,t.vectorInput=null,null;let a=t.analytic.style,s=a0(t.analytic.slices,sr(e.x),sr(e.y),{density:a.arrowDensity,width:a.arrowWidth,minLength:a.arrowMinLength});return t.analytic.setArrows(s),t.vectorInput=e,t.vectors={quantity:e.quantity,units:e.units,max:s.max,reference:s.reference,spacingMm:s.spacingMm},{count:s.count,max:s.max,reference:s.reference,spacingMm:s.spacingMm}}function Jd(t,e){let a=t.analytic.style,s=t.analytic.setStyle(e);return["arrowDensity","arrowWidth","arrowMinLength"].some(n=>a[n]!==s[n])&&t.vectorInput&&pi(t,t.vectorInput),s}function Qd(t,e){for(let a of t?.chunks||[]){let s=Number(a.first_operation_index);if(e>=s&&e<s+Number(a.operation_count||0))return a.slice_key}return null}function ur(t,e,a,s=null,r=null,n=0){let i=null;for(let o of t.analytic.slices){if(!o.field||Math.abs(e.direction[2])<1e-12||s&&o.key!==s||r&&!r.has(Number(o.layerId)))continue;let[c,l]=o.offsetLayers||[o.layerId,o.layerId],f=o.z+.5*((a?.[c]||0)+(a?.[l]||0)),u=(f-e.origin[2])/e.direction[2];if(!s&&!(u>0)||i&&u>=i.t)continue;let g=[e.origin[0]+u*e.direction[0],e.origin[1]+u*e.direction[1],f],p=[g[0]*1e3,-g[1]*1e3],h=fi(o.field,p);!Number.isFinite(h)&&n>0&&(h=Zy(o.field,p,n)),Number.isFinite(h)&&(i={t:u,value:h,sliceKey:o.key,boardMm:p,world:g})}return i&&{value:i.value,sliceKey:i.sliceKey,boardMm:i.boardMm,world:i.world}}async function gi(t,e,a=null){let s=t.overlay,r=s?.kind==="operation_values"?s.values[e]:s?.barrels?.[e],n=s?.kind!=="operation_values"&&Number.isFinite(r)&&(!t.barrelOperations||t.barrelOperations.has(e)),i=s?.kind==="operation_values"||n?r:a?.value;return n&&(a={...a,sliceKey:"via barrel"}),{operationIndex:e,featureId:await bi(t,e)||null,binding:await t.pack.binding(e),...Number.isFinite(i)?{value:i,quantity:s.quantity,units:s.units}:{},...a?{sliceKey:a.sliceKey,boardMm:a.boardMm,world:a.world}:{}}}var s0=2048,r0=.22,Zd=2,eu=1024,tu=160;function n0(t,e,a){let s=Float32Array.from(t,o=>Number.isFinite(o)?o:NaN),r=new Int32Array(e*a),n=0,i=0;for(let o=0;o<s.length;o+=1)Number.isFinite(s[o])&&(r[i++]=o);for(;n<i;){let o=r[n++],c=o%e,l=(o-c)/e;for(let[f,u]of[[c-1,l],[c+1,l],[c,l-1],[c,l+1]]){if(f<0||u<0||f>=e||u>=a)continue;let g=u*e+f;Number.isFinite(s[g])||(s[g]=s[o],r[i++]=g)}}return s}function i0(t,e,a){let[s,r,n,i]=t,o=(n-s)/1e3,c=(i-r)/1e3,l=(s+n)/2e3,f=-(r+i)/2e3,u=a-e||1;return new Float32Array([2/o,0,0,0,0,2/c,0,0,0,0,1/u,0,-2*l/o,-2*f/c,-e/u,1])}function o0(t,e=s0){let a=t[2]-t[0],s=t[3]-t[1],r=e/Math.max(a,s,1e-9);return[Math.max(1,Math.round(a*r)),Math.max(1,Math.round(s*r))]}var c0=`
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
`,fr=`
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
`,at=64,l0=`
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
${fr.slice(fr.indexOf("fn cell("),fr.indexOf("struct ReliefOut"))}
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
`,d0=`
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
`,hr=class{constructor(e){this.analytic=e,this.renderer=e.renderer,this.device=e.device,this.uniform=this.device.createBuffer({label:"relief",size:tu,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),this.scratch=new ArrayBuffer(tu),this.sampler=this.device.createSampler({magFilter:"linear",minFilter:"linear"}),this.layer=null,this.vertexCount=0}get ready(){return this.vertexCount>0}pipeline(){if(this.reliefPipeline)return this.reliefPipeline;let e=this.device.createShaderModule({label:"relief",code:fr.replace("PALETTE",d0).replace("PATCH_SIZE",String(at))});return this.reliefPipeline=this.device.createRenderPipeline({label:"relief",layout:"auto",vertex:{module:e,entryPoint:"vs_relief_patch"},fragment:{module:e,entryPoint:"fs_relief",targets:[{format:this.renderer.format}]},primitive:{topology:"triangle-list",cullMode:"none"},depthStencil:{format:this.renderer.depthFormat,depthWriteEnabled:!0,depthCompare:"greater"},multisample:{count:this.renderer.sampleCount||1}}),this.reliefPipeline}gridPipeline(){if(this.gridComputePipeline)return this.gridComputePipeline;let e=this.device.createShaderModule({label:"relief-grid",code:l0});return this.gridComputePipeline=this.device.createComputePipeline({label:"relief-grid",layout:"auto",compute:{module:e,entryPoint:"cs_grid"}}),this.gridComputePipeline}patchIndices(){if(this.patchIndexBuffer)return this.patchIndexBuffer;let e=at+1,a=new Uint16Array(at*at*6),s=0;for(let r=0;r<at;r+=1)for(let n=0;n<at;n+=1){let i=r*e+n;a.set([i,i+1,i+e,i+e,i+1,i+e+1],s),s+=6}return this.patchIndexBuffer=this.device.createBuffer({label:"relief-patch-indices",size:a.byteLength,usage:GPUBufferUsage.INDEX|GPUBufferUsage.COPY_DST}),this.device.queue.writeBuffer(this.patchIndexBuffer,0,a),this.patchIndexBuffer}computeGrid(){let[e,a]=this.grid;this.points=this.device.createBuffer({label:"relief-points",size:e*a*16,usage:GPUBufferUsage.STORAGE}),this.writeUniform(new Float32Array(16));let s=this.gridPipeline(),r=this.device.createBindGroup({layout:s.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:this.uniform}},{binding:1,resource:this.field.createView()},{binding:2,resource:{buffer:this.points}}]}),n=this.device.createCommandEncoder(),i=n.beginComputePass({label:"relief-grid"});i.setPipeline(s),i.setBindGroup(0,r),i.dispatchWorkgroups(Math.ceil(e/8),Math.ceil(a/8)),i.end(),this.device.queue.submit([n.finish()])}netPipeline(){if(this.netMaskPipeline)return this.netMaskPipeline;let e=this.device.createShaderModule({label:"relief-net-mask",code:c0});return this.netMaskPipeline=this.device.createRenderPipeline({label:"relief-net-mask",layout:"auto",vertex:{module:e,entryPoint:"vs_full"},fragment:{module:e,entryPoint:"fs_net",targets:[{format:"r8unorm"}]},primitive:{topology:"triangle-list"}}),this.netMaskPipeline}build(e,{range:a,netId:s=0,heightShare:r=r0}={}){let n=this.maskKey,i=this.mask&&n?.slices===this.analytic.slices&&n.nets===this.analytic.netsBuffer&&n.layer===e?.layerId&&n.net===s,o=i?this.mask:null;i&&(this.mask=null),this.release();let c=e?.field;if(!c)return o?.destroy(),!1;let l=this.boundsOf(e),[f,u]=o0(l);if(o)this.mask=o;else{let y=this.renderMask(e.layerId,l,f,u);this.mask=this.filterMask(y,f,u,s),y.destroy(),this.maskKey={slices:this.analytic.slices,nets:this.analytic.netsBuffer,layer:e.layerId,net:s}}let g=n0(c.values,c.width,c.height),p=Float32Array.from(g,y=>Number.isFinite(y)?y:3e38);this.field=this.device.createTexture({label:"relief-field",size:[c.width,c.height],format:"r32float",usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST}),this.device.queue.writeTexture({texture:this.field},p,{bytesPerRow:c.width*4},[c.width,c.height]);let[h,d]=Array.isArray(c.pitchMm)?c.pitchMm:[c.pitchMm,c.pitchMm],m=Math.max(l[2]-l[0],l[3]-l[1])/1e3,b=[Math.min(eu,Math.max(2,Math.ceil((l[2]-l[0])/h*Zd)+1)),Math.min(eu,Math.max(2,Math.ceil((l[3]-l[1])/d*Zd)+1))];return this.layer=e.layerId,this.sliceKey=e.key,this.boundsMm=l,this.base=e.z,this.height=m*r,this.grid=b,this.vertexCount=(b[0]-1)*(b[1]-1)*6,this.params={field:c,pitch:[h,d],range:a||[0,1]},this.computeGrid(),this.patches=Math.ceil((b[0]-1)/at)*Math.ceil((b[1]-1)/at),this.bindGroup=this.device.createBindGroup({layout:this.pipeline().getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:this.uniform}},{binding:1,resource:this.field.createView()},{binding:2,resource:this.mask.createView()},{binding:3,resource:this.sampler},{binding:4,resource:{buffer:this.analytic.palette}},{binding:5,resource:{buffer:this.points}}]}),this.renderer.invalidate?.(),!0}boundsOf(e){let a=this.analytic.slices.filter(n=>n.layerId===e.layerId&&(n.role===void 0||n.role==="copper")),s=(a.length?a:[e]).map(n=>n.bounds),r=.05;return[Math.min(...s.map(n=>n[0]))-r,Math.min(...s.map(n=>n[1]))-r,Math.max(...s.map(n=>n[2]))+r,Math.max(...s.map(n=>n[3]))+r]}renderMask(e,a,s,r){let{analytic:n,renderer:i,device:o}=this,c=n.extent,l=(c?.[0][2]??-.01)-.001,f=(c?.[1][2]??.01)+.001,u=i0(a,l,f),g=o.createTexture({label:"relief-pick",size:[s,r],format:"rg32uint",usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.TEXTURE_BINDING}),p=o.createTexture({label:"relief-pick-depth",size:[s,r],format:i.depthFormat,usage:GPUTextureUsage.RENDER_ATTACHMENT}),h={view:p.createView(),depthClearValue:0,depthLoadOp:"clear",depthStoreOp:"discard"};i.stencil&&Object.assign(h,{stencilClearValue:0,stencilLoadOp:"clear",stencilStoreOp:"discard"});let d=o.createCommandEncoder(),m=d.beginRenderPass({colorAttachments:[{view:g.createView(),clearValue:{r:0,g:0,b:0,a:0},loadOp:"clear",storeOp:"store"}],depthStencilAttachment:h}),b=i.innerCopperMode;i.innerCopperMode="all";try{i.writeGlobals(u,0,0,0,0),i.stencil&&m.setStencilReference(1),n.encodeInto(m,null,new Set([e]),!0,{matrix:u,showBoard:!1})}finally{i.innerCopperMode=b}return m.end(),o.queue.submit([d.finish()]),p.destroy(),g}filterMask(e,a,s,r){let{device:n}=this,i=n.createTexture({label:"relief-mask",size:[a,s],format:"r8unorm",usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.TEXTURE_BINDING}),o=n.createBuffer({label:"relief-net",size:16,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});n.queue.writeBuffer(o,0,new Uint32Array([r>>>0,0,0,0]));let c=this.netPipeline(),l=n.createBindGroup({layout:c.getBindGroupLayout(0),entries:[{binding:0,resource:e.createView()},{binding:1,resource:{buffer:this.analytic.netsBuffer}},{binding:2,resource:{buffer:o}}]}),f=n.createCommandEncoder(),u=f.beginRenderPass({colorAttachments:[{view:i.createView(),clearValue:{r:0,g:0,b:0,a:0},loadOp:"clear",storeOp:"store"}]});return u.setPipeline(c),u.setBindGroup(0,l),u.draw(3),u.end(),n.queue.submit([f.finish()]),o.destroy(),i}encode(e,a){return this.ready?(this.writeUniform(a),e.setPipeline(this.pipeline()),e.setBindGroup(0,this.bindGroup),e.setIndexBuffer(this.patchIndices(),"uint16"),e.drawIndexed(at*at*6,this.patches),1):0}writeUniform(e){let a=new Float32Array(this.scratch),s=new Uint32Array(this.scratch);a.set(e,0),a.set(this.boundsMm,16),a.set(this.params.field.originMm,20),a.set(this.params.pitch,22),s[24]=this.params.field.width,s[25]=this.params.field.height,s[26]=this.grid[0],s[27]=this.grid[1],a.set(this.params.range,28),a[30]=this.base,a[31]=this.height,a.set([.35,.45,.82,0],32),this.device.queue.writeBuffer(this.uniform,0,this.scratch)}worldBounds(){if(!this.ready)return null;let[e,a,s,r]=this.boundsMm;return[e/1e3,-r/1e3,this.base,s/1e3,-a/1e3,this.base+this.height]}release(){this.mask?.destroy(),this.field?.destroy(),this.points?.destroy(),this.points=null,this.mask=null,this.field=null,this.bindGroup=null,this.vertexCount=0,this.layer=null}destroy(){this.release(),this.uniform.destroy(),this.patchIndexBuffer?.destroy()}};var nE=512*1024*1024;var gu=230,Mi=document,Nt,q,Be,wr,vr,kr,_i,Fr,st,pr,Ja,Ye,ke,je,u0,Er,Qa,Ce,ae,Or,Pr,Pe,oa,te=t=>Mi.querySelector(t),Kt=t=>Mi.querySelectorAll(t);function f0(t=document){Mi=t,Nt=te("#app"),q=te("#viewport"),Be=te("#schematic-viewport"),wr=te("#schematic-dom-layer"),vr=te("#schematic-flow-overlay"),kr=te("#bom-view"),_i=te("#status")||{set textContent(e){}},Fr=te("#viewer-kind")||{set textContent(e){}},st=te("#selection")||{set textContent(e){}},pr=te("#diagnostics")||{set innerHTML(e){}},Ja=te("#scene-stats"),Ye=te("#layers"),ke=te("#search-controls"),je=te("#view-controls"),Pe=te("#stackup-workspace-view"),u0=te("#fallback"),Er=te("#panel-labels"),Qa=te("#schematic-labels"),Ce=te("#axis-gizmo"),ae=te("#selection-card"),Or=te("#primary-heading"),Pr=te("#primary-description"),oa=te("#mode-switch"),Nt.classList.add("workspace-pcb")}var h0=Object.freeze([{role:"soldermask",side:"front",name:"F.Mask"},{role:"soldermask",side:"back",name:"B.Mask"},{role:"silkscreen",side:"front",name:"F.SilkS"},{role:"silkscreen",side:"back",name:"B.SilkS"},{role:"paste",side:"front",name:"F.Paste"},{role:"paste",side:"back",name:"B.Paste"}]),b0={soldermask:"#1f6b45",silkscreen:"#f2f2f2",paste:"#a0a3a8"};function mu(){return{workspace:"pcb",clickSelect:!0,mode:"3d",activeNetId:0,selectedFeatureId:0,selectedOccurrence:0,selectionAnchor:null,showBoard:!0,showComponents:!0,showPlaceholders:!0,realisticColors:!0,hiddenBoardLayers:[],isolateNet:!1,savedShowBoard:!0,savedShowComponents:!0,preIsolationShowBoard:null,separation:0,dragging:!1,dragMode:"orbit",lastX:0,lastY:0,pointerStartX:0,pointerStartY:0,frameCpuMs:0,frameCpuP95Ms:0,frameIntervalMs:0,frameIntervalP95Ms:0,frameSamples:[],fps:0,frames:0,fpsAt:performance.now(),activeTab:"layers",selectedPageId:"",selectedSchematicFeature:null,schematicDragging:!1,schematicLastX:0,schematicLastY:0,schematicStartX:0,schematicStartY:0}}function yu(t={}){return{key:t.key??"board",topology:t.topology||window.__TOPOLOGY__||{},semanticGeometry:t.semanticGeometry||window.__SEMANTIC_GEOMETRY__||{},viewerReadiness:t.readiness||{stage:"semantic-ready",progress:100},assetCache:t.assetCache||null,deferComponents:!!t.deferComponents,scene:p0(),renderer:null,compareLayers:new Set,desiredCompareLayers:new Set,visible3dLayers:new Set,preIsolation3dLayers:null,preIsolationCompareLayers:null,highlightedNetIds:new Set,hiddenComponents:new Set,hiddenComponentRequest:null,loadedBytes:0,triangles:0,residentTileBytes:0,residentTileGpuBytes:0,residentTileTriangles:0,tileLoads:0,tileEvictions:0,tileSchedulerMs:0,lastTileScheduleAt:0,visibleTileIds:new Set,gpuBytes:0}}function p0(){return{manifest:null,manifestUrl:"",layers:[],copperLayers:[],nets:[],features:new Map,tiles:new Map,loaded:new Set,loading:new Map,failed:new Map,residentTiles:new Map,componentFeatures:new Map,componentModelCounts:new Map,componentTier:"idle",componentEntries:[],componentsWantedAt:0,componentEvictions:0,runtimeBounds:null,layerZOffsets:new Float32Array(256),layerZOffsetSignature:""}}function xu(){return{key:"",started:0,from:new Map,current:new Map}}function wu(){return{phase:"idle",previous:new Set,target:new Set,previousOffsets:new Map,started:0}}function vu(){return{manifest:null,manifestUrl:"",pages:[],byId:new Map,activeNetUid:"",visiblePages:[],fitted:!1,rendererMode:new URLSearchParams(location.search).get("schematicRenderer")||"svg-dom",domFallbackReason:""}}var v=mu(),k=yu(),Ae=xu(),Y=wu(),D=vu(),Tr=[],g0=5e3;var B,Z,Je,J,Le,Ct=new Map,$a=performance.now(),Ge=0,gr=0,Si=null,xi=null,wi=null,mi=!1,vi=!1,ki=null,Ai=()=>!0,Mr=!0;function m0(t){let e=new Map((t.components||[]).map(s=>[s.uid,s])),a={};for(let s of t.terminals||[]){let r=s.net_uid;if(!r)continue;let n=e.get(s.component_uid)||{},i={designator:s.designator||n.designator||"",pin:s.pin||"",value:n.value||"",pcb_pad_id:s.pcb_pad_id||"",pcb_pad_source_uid:s.pcb_pad_source_uid||""};a[r]||(a[r]={terminals:[]});let o=a[r].terminals;o.some(c=>c.designator===i.designator&&c.pin===i.pin)||o.push(i)}return a}function y0(t,e=k){if(!t||!e.scene?.features)return 0;let a=t.pcb_pad_source_uid||"";if(!a&&t.pcb_pad_id&&(a=(e.topology?.physical_objects||[]).find(r=>r.uid===t.pcb_pad_id)?.source_ids?.[0]||""),!a)return 0;for(let[s,r]of e.scene.features.entries())if(r.sourceUid===a&&r.kind==="pad")return s;return 0}function Ri(t,e=k){return!t||!e.topology||!e.topology.components?null:e.topology.components.find(a=>a.designator===t)}function br(t,e){for(let a of Object.keys(t))delete t[a];Object.assign(t,e)}function ku(){gr&&(cancelAnimationFrame(gr),gr=0),window.removeEventListener("keydown",sf),Ti(),k.renderer?.dispose?.(),k.renderer=null,B=null,Z?.dispose?.(),Z=null,Je=null,Si=null,Ai=()=>!0,Mr=!0}function x0(){return Ge+=1,ku(),br(v,mu()),k=yu(),br(Ae,xu()),br(Y,wu()),br(D,vu()),Tr=[],J=null,Le=null,Ct=new Map,$a=performance.now(),Ge}function w0(t){t===Ge&&(Ge+=1,ku())}function Ei(t){t===Ge&&(gr=requestAnimationFrame(e=>H0(e,t)))}function Fe(t){return t===Ge}async function Eu(t={}){let e=x0(),a={};if(k.topology=t.topology||window.__TOPOLOGY__||{},k.topology&&!k.topology.net_details&&(k.topology.net_details=m0(k.topology)),k.semanticGeometry=t.semanticGeometry||window.__SEMANTIC_GEOMETRY__||{},k.viewerReadiness=t.readiness||k.semanticGeometry.readiness||{stage:"semantic-ready",progress:100},Si=typeof t.onSelectionChange=="function"?t.onSelectionChange:null,wi=typeof t.onContextMenu=="function"?t.onContextMenu:null,xi=typeof t.onViewStateChange=="function"?t.onViewStateChange:null,Ai=typeof t.isActive=="function"?t.isActive:()=>!0,Mr=t.workspaceScope!=="3d",k.assetCache=t.assetCache||null,v.gpuBudgetBytes=Kn,f0(t.root||document),!Nt||!q)throw new Error("Semantic viewer shell is missing required DOM nodes");return await A0(e,a,t.onPerformanceEvent),{performance:a,...T0(),selectOccurrence:_0,setHighlightedNetIds(s){k.highlightedNetIds=s,k.renderer?.setEmphasizedNetIds(s)},resize(){k.renderer?.resize(),B?.resize(),v.workspace==="pcb"&&v.mode==="layer"&&Fi()},setWorkspace(s){let r=s==="stackup"?"stackup":"pcb";v.workspace!==r&&Zu(r)},setHiddenComponents:Qu,getComponentReferences(){return[...k.scene.componentFeatures.keys()]},async loadAnalyticPack(s,r={}){if(!k.renderer)return null;let n=performance.now();Ti();let i=Math.round(performance.now()-n),o=++Ya,c=await hi({renderer:k.renderer,layers:k.scene.layers,colorFor:f=>{let u=Ar(f,k);return u.length>=4?u.slice(0,4):[...u,1]},bytes:s,wasm:r.wasm,toleranceNm:r.toleranceNm,nets:k.scene.manifest?.nets,features:k.scene.manifest?.objectFeatures,boardZOffsetMm:k.scene.manifest?.boardZOffsetMm});if(o!==Ya||!k.renderer)return c.analytic.destroy(),c.pack.free(),null;let l=performance.now();return k.renderer.setAnalytic(c.analytic),c.timings.attach=Math.round(performance.now()-l),k.analytic=c,k.analytic.timings={release:i,...k.analytic.timings},au()},setAnalyticOverlay(s){if(!k.analytic)return null;let r=Xd(k.analytic,s);return k.reliefOptions&&su(!1),r},setAnalyticRelief(s){return k.reliefOptions=s||null,su(!0)},setAnalyticVectors(s){return k.analytic?pi(k.analytic,s):null},setAnalyticStyle(s){return k.analytic?Jd(k.analytic,s):null},analyticColormaps(){return{colormaps:qn,defaults:Fa}},setClickSelect(s){v.clickSelect=s!==!1},analyticProbe(s,r){if(!k.analytic?.overlay||k.analytic.overlay.kind==="operation_values")return null;let n=du(s,r);if(!n)return null;let i=v.mode==="3d"?k.visible3dLayers:null,o=ur(k.analytic,n,Nr(),null,i,1);if(!o)return null;let{quantity:c,units:l}=k.analytic.overlay;return{value:o.value,quantity:c,units:l,sliceKey:o.sliceKey,boardMm:o.boardMm,world:o.world,marker:lu(o.world)}},async analyticAt(s,r){if(!k.analytic)return null;let n=await af(s,r);if(n?.kind!=="analytic")return null;let i=du(s,r);if(!i||k.analytic.overlay?.kind==="operation_values")return gi(k.analytic,n.operationIndex);let o=Nr(),c=Qd(k.analytic.pack.header,n.operationIndex),l=c&&ur(k.analytic,i,o,c)||ur(k.analytic,i,o),f=await gi(k.analytic,n.operationIndex,l);return l?{...f,marker:lu(l.world)}:f},analyticStats:au,unloadAnalyticPack(){Ya+=1,Ti()},setLodOverride(s){k.renderer?.setLodOverride(s)},projectComponent(s){return Sx(k,s,r=>ia(r,Xe))},projectPoint(s){return ia(s,Xe)},setViewMode:Hu,renderInset:$0,insetReady:Du,releaseInset(s){Rr.release(s)},insetBoard:()=>({scene:k.scene,topology:k.topology}),onSceneChange(s){return Ir.add(s),()=>Ir.delete(s)},insetStats(){return{...mr,views:Rr.size,targets:[ie.width,ie.height]}},insetSettings(s){return Object.assign(ou,s||{}),{...ou}},gpuIdle(){return k.renderer?.device.queue.onSubmittedWorkDone()??Promise.resolve()},dispose(){M0(),w0(e)}}}function au(){let t=k.analytic;return t?{operations:t.operations,lowerMs:t.lowerMs,timings:t.timings,zOffset:t.zOffset,unmatched:t.unmatched,...t.analytic.stats()}:null}function su(t){let e=k.renderer;if(!e)return null;let a=k.reliefOptions,s=k.analytic?.overlay;if(!a||!s||s.kind==="operation_values"){let i=e.relief?.ready;return e.relief?.release(),i&&t&&J.frame(ua()),e.invalidate?.(),null}let r=$d(k.analytic).sort((i,o)=>o.cells-i.cells),n=r.find(i=>i.key===a.sliceKey)||r[0];return n?(e.relief??=new hr(k.analytic.analytic),e.relief.build(n.slice,{range:s.range,netId:Yd(k.scene.manifest?.nets,s.net),heightShare:a.heightShare}),t&&J.frame(e.relief.worldBounds()),e.invalidate?.(),{sliceKey:n.key,slices:r.map(i=>({key:i.key,layerId:i.layerId,cells:i.cells}))}):(e.relief?.release(),e.invalidate?.(),{sliceKey:null,slices:[]})}var Ya=0;async function v0(t,e=k){let a=Pu(e);if(a)return new Uint8Array(await a(t));let s=await fetch(t,{cache:"default"});if(!s.ok)throw new Error(`Failed to load ${t}: ${s.status}`);return new Uint8Array(await s.arrayBuffer())}async function k0(t,e,a){let s=t.semanticGeometry.assets||{};if(!s.analytic_pack)throw new Error("The analytic bundle names no pack");let r=performance.now(),[n,i]=await Promise.all([v0(s.analytic_pack,t),s.stackup?Ru(s.stackup,t).catch(()=>null):null]);if(a.analytic_pack_fetch_ms=performance.now()-r,a.analytic_pack_bytes=n.byteLength,t.loadedBytes+=n.byteLength,!Fe(e))return!1;let o=t.semanticGeometry.cache_key||"",c=t.assetCache&&o?await kd(t.assetCache,{cacheKey:o,wasmKey:sa(),toleranceNm:Dt}):!1;a.analytic_lowering_cached=c;let l=Wa.start(n,ar(),c?1:or(ir));r=performance.now();let f=c?(await qa(t.assetCache,{cacheKey:o,wasmKey:sa(),toleranceNm:Dt},[Ha])).get(Ha):null,u=f&&_d(f,l)||l&&await Md(l)||await Va(n);return a.analytic_pack_from_cache=!!f,a.analytic_pack_open_ms=performance.now()-r,a.analytic_pack_hosted=!!u.hosted,Fe(e)?(t.analyticSource={bytes:n,pack:u,stackup:i,pool:l},t.scene.manifest=Ji(u.header,i),!0):(u.free(),l?.close(),!1)}async function E0(t,e,a){let s=e.analyticSource,r=++Ya;e.renderer.stackupLooks=Qi(s.stackup);let n=e.semanticGeometry.cache_key||"",i={renderer:e.renderer,layers:e.scene.layers,colorFor:f=>{let u=Ar(f,e);return u.length>=4?u.slice(0,4):[...u,1]},bytes:s.bytes,pack:s.pack,nets:e.scene.nets,cache:e.assetCache&&n?{store:e.assetCache,cacheKey:n}:null,pool:s.pool},o=performance.now(),c=await hi(i),l=s.pool;return l&&c.pack.hosted?c.cacheWrites.then(()=>l.release()):l?.close(),s.pool=null,r!==Ya||!Fe(t)||!e.renderer?(c.analytic.destroy(),c.pack.free(),null):(e.renderer.setAnalytic(c.analytic),e.analytic=c,a.analytic_board_ms=performance.now()-o,a.analytic_board=c.timings,ns(e.scene.manifest.bbox))}function Ti(){k.renderer?.relief?.destroy(),k.renderer&&(k.renderer.relief=null),k.renderer?.setAnalytic(null),k.analytic?.pack.free(),k.analytic=null}function T0(){return{nets:()=>k.scene.nets,quietly(t){vi=!0;try{t()}finally{vi=!1}},takeEcho(t){let e=Zl(t,ki);return ki=null,e},selectNet:ji,selectFeature:ha,selectComponent:Li,clearSelection:Ht,anyEmphasis:Za,showNetProbe:Ci,restoreVisibility:Au,isolating:()=>v.isolateNet,isolateLitNets:as,setNetIsolation:fa,setGpuBudget(t){v.gpuBudgetBytes=t,k.tiersCheckedAt=0},setStatsOverlay:Bu,stats:Cu,pickAt(t,e){return af(t,e)},getViewState:Tu,setLayerVisible:qu,applyLayerPreset:Wu,setShowBoard:Xu,setShowComponents:$u,setShowPlaceholders:dx,setRealisticColors:hx,setBoardLayerVisible:fx,setSeparation:Yu,showNetLayers:Pi}}function M0(){ie.depth?.destroy(),Object.assign(ie,{canvas:null,context:null,depth:null,depthView:null,width:0,height:0}),Rr.clear(),Ir.clear(),ca=null}function da(){!xi||mi||(mi=!0,queueMicrotask(()=>{mi=!1,xi?.(Tu())}))}function Tu(){let t=v.mode==="3d"?k.visible3dLayers:k.desiredCompareLayers;return{mode:v.mode,layers:k.scene.copperLayers.map(e=>({id:Number(e.id),name:String(e.name),color:Gi(Bi(e)),visible:t.has(Number(e.id))})),boardLayers:ux(),showBoard:v.showBoard,showComponents:v.showComponents,showPlaceholders:v.showPlaceholders,realisticColors:v.realisticColors,separation:v.separation,isolateNet:v.isolateNet,hasNet:!!v.activeNetId||Za()}}function Ii(t){vi||(ki=t,Si?.(t))}function _0(t){let e=k.renderer?.occurrenceKeys.indexOf(String(t))??-1;e>=0&&(v.selectedOccurrence=e)}function Ni(t){if(!t||!k.renderer||k.renderer.identityOnly)return t;let e=k.renderer.occurrenceMatrices[v.selectedOccurrence];return e?xc(e,t):t}function Mu(t,e=null){return t?{kind:"net",sourceContext:"3D",netName:String(t.name||""),netUid:String(t.uid||"")||void 0,netCode:Number(t.id||0)||void 0,featureId:Number(e?.id||0)||void 0,uuid:String(e?.sourceUid||"")||void 0}:null}function _u(t,e=k){if(!t)return null;let a=la(t),s=String(t.padNumber||t.pin||t.pinNumber||""),r=e.scene.nets.find(n=>Number(n.id)===Number(t.netId||0));if(a&&s)return{kind:"terminal",sourceContext:"3D",reference:a,pin:s,netUid:r?.uid,netName:r?.name,netCode:r?Number(r.id):void 0,uuid:String(t.sourceUid||"")||void 0,featureId:Number(t.id||0)||void 0};if(a){let n=Ri(a,e);return{kind:"component",sourceContext:"3D",reference:a,componentUid:n?.uid,uuid:String(t.sourceUid||"")||void 0,featureId:Number(t.id||0)||void 0}}return Mu(r,t)}function Su(){v.showBoard=!0,v.showComponents=!0,Vt(),typeof Ke=="function"&&Ke()}function Za(){return _r().size>0}function _r(){let t=new Set(k.highlightedNetIds);return v.activeNetId&&t.add(Number(v.activeNetId)),t}function Ci(){(v.showBoard||v.showComponents)&&(v.savedShowBoard=v.showBoard,v.savedShowComponents=v.showComponents),v.showBoard=!1,v.showComponents=!1,Vt(),typeof Ke=="function"&&Ke()}function Au(){v.showBoard=v.savedShowBoard!==!1,v.showComponents=v.savedShowComponents!==!1,Vt(),typeof Ke=="function"&&Ke()}async function S0(t,e,a={}){let s=t.semanticGeometry.assets?.scene_manifest||t.semanticGeometry.semantic_gltf?.path,r=performance.now();if(t.semanticGeometry.analytic){if(!await k0(t,e,a))return!1}else if(s){if(t.scene.manifestUrl=new URL(s,location.href).toString(),t.scene.manifest=await Ru(t.scene.manifestUrl,t),a.scene_manifest_fetch_parse_ms=performance.now()-r,!Fe(e))return!1;if(t.scene.manifest.schema!=="prism.semantic_gltf_a0")throw new Error(`Unsupported scene schema: ${t.scene.manifest.schema}`)}else t.scene.manifest={schema:"prism.semantic_gltf_partial.a0",bbox:null,layers:[],nets:[],objectFeatures:[],components:[],tiles:[],barrels:[]},a.scene_manifest_fetch_parse_ms=0;r=performance.now(),t.scene.layers=t.scene.manifest.layers||[],t.scene.copperLayers=t.scene.layers.filter(i=>i.role==="copper"||String(i.name).endsWith(".Cu")),t.scene.nets=t.scene.manifest.nets||[];for(let i of t.scene.manifest.objectFeatures||[])t.scene.features.set(Number(i.id),{...i,bounds:ga(i.boundsMm)});for(let i of t.scene.manifest.components||[])t.scene.componentFeatures.set(i.designator,i),t.scene.features.set(Number(i.featureId),{...i,kind:"component",sourceUid:i.uid,netId:0,bounds:ga(i.boundsMm)});for(let i of t.scene.manifest.tiles||[])t.scene.tiles.set(i.id,i);a.scene_manifest_index_ms=performance.now()-r;let n=Nu(t);for(let i of n)t.compareLayers.add(i),t.desiredCompareLayers.add(i);for(let i of t.scene.copperLayers)t.visible3dLayers.add(Number(i.id));return!0}async function A0(t,e={},a=null){let s=performance.now(),r=k.semanticGeometry.analytic?Aa.create(q).then(c=>(zt.prewarm(c),c)):null;if(!await S0(k,t,e)){r&&r.then(c=>c?.dispose?.()).catch(()=>{});return}let n=performance.now();if(k.renderer=r?await r:await Aa.create(q),e.webgpu_renderer_create_ms=performance.now()-n,!Fe(t)){k.renderer?.dispose?.(),k.renderer=null;return}k.renderer.setBarrels(Cc(k.scene.manifest.barrels,k.scene.manifest.layers)),Oi(),n=performance.now();let i=await E0(t,k,e);if(e.board_fetch_parse_upload_ms=performance.now()-n,!Fe(t)||(k.scene.runtimeBounds=i||ns(k.scene.manifest.bbox),J=new hs(k.scene.runtimeBounds),Mr&&(await R0(t),!Fe(t)||(await I0(t),!Fe(t)))))return;n=performance.now(),zu(),vx(),Mr&&(Tx(),Ex()),px(),Rx(),e.controls_and_bindings_ms=performance.now()-n;let o={"board-ready":"Board ready \xB7 components and semantic layers are still generating","components-ready":"Board and components ready \xB7 semantic layers are still generating","semantic-ready":"WebGPU semantic glTF active"};if(_i.textContent=o[k.viewerReadiness.stage]||"Loading 3D assets",k.semanticGeometry.assets?.components_glb&&!k.deferComponents){let c=performance.now(),l=Ou(t);k.analytic&&await l.catch(()=>{}),l.then(()=>{Fe(t)&&(iu(i),a?.({schema:"prism.semantic_viewer_performance.a0",milestone:"components-loaded",readiness_stage:k.viewerReadiness.stage,elapsed_ms:performance.now()-c,bytes_loaded:k.loadedBytes}))})}else iu(i);Ei(t),n=performance.now(),await new Promise(c=>requestAnimationFrame(c)),e.first_frame_wait_ms=performance.now()-n,e.boot_total_ms=performance.now()-s}async function R0(t=Ge){let e=k.semanticGeometry.assets?.schematic_native_manifest||k.semanticGeometry.schematic_vector?.path||k.semanticGeometry.schematic_scene?.path,a=k.semanticGeometry.assets?.schematic_manifest||k.semanticGeometry.schematic_world?.path,s=te("[data-workspace=schematic]");if(!e&&!a){s.disabled=!0,s.title="No schematic world assets are available";return}let r=[e,a].filter(Boolean),n=null;for(let o of r)try{D.manifestUrl=new URL(o,location.href).toString();let c=await qs.create(Be,D.manifestUrl);if(!Fe(t))return;B=c,B.setFlowOverlayCanvas(vr);break}catch(c){if(n=c,B=null,o===a)throw c}if(!B)throw n||new Error("Failed to load schematic viewer assets");D.manifest=B.manifest,D.pages=B.pages,D.byId=new Map(D.pages.map(o=>[o.id,o])),v.selectedPageId=D.pages[0]?.id||"",B.selectedPageId=v.selectedPageId,!["native","legacy","webgpu"].includes(String(D.rendererMode).toLowerCase())&&(Z=$s.create(wr,D.manifestUrl,D.manifest,B.featuresByPage,{onSelect:ix,onBlank:ts,onHighlightNet:Ku,onOpenPage:rx,onFallback:o=>{D.domFallbackReason=o,console.warn(o)}}),Z.preloadPages(D.pages)),B.preloadOverview()}async function I0(t=Ge){let e=k.semanticGeometry.assets?.bom||k.semanticGeometry.bom?.path,a=te("[data-workspace=bom]");if(!e){a&&(a.disabled=!0,a.title="No BoM artifact is available");return}try{let s=await bs.create(kr,new URL(e,location.href).toString(),{onSelectReference:r=>Li(r,!0)});if(!Fe(t))return;Je=s}catch(s){if(!Fe(t))return;console.warn(s),a&&(a.disabled=!0,a.title=s?.message||"BoM artifact could not be loaded")}}async function Ru(t,e=k){if(e.assetCache)return e.assetCache.fetchJson(String(t));let a=await fetch(t,{cache:"default"});if(!a.ok)throw new Error(`Failed to load ${t}: ${a.status}`);return a.json()}var N0=24*1024*1024,Gt={bytes:0,waiting:null};async function C0(t){for(;;){if(Gt.bytes===0||Gt.bytes+t<=N0){Gt.bytes+=t,Gt.waiting??=new Promise(e=>requestAnimationFrame(()=>{Gt.bytes=0,Gt.waiting=null,e()}));return}await Gt.waiting}}function B0(t){return Tl(t.position.length/3,t.indices.length)}function F0(t,e){return t?"all":e?"lit":"none"}function Iu(){return v.mode!=="layer"?k.visible3dLayers:Y.phase==="reveal"?P0(Y.previous,Y.target):k.compareLayers}function Nu(t=k){let e=t.scene.copperLayers.map(a=>Number(a.id)).filter(Number.isFinite);return e.length?e.length===1?new Set([e[0]]):new Set([e[0],e[e.length-1]]):new Set}function O0(){let t=k.desiredCompareLayers.size?k.desiredCompareLayers:k.compareLayers;return t.size?new Set([...t].map(Number)):Nu()}function P0(...t){let e=new Set;for(let a of t)for(let s of a||[])e.add(Number(s));return e}function ua(t=k){return t.scene.runtimeBounds||ns(t.scene.manifest?.bbox)}function j0(t,e){let{back:a}=J.basis();return{eye:Ft(J.focus,lt(a,J.distance)),orthographic:e,pixelScale:e?t/Math.max(1e-9,J.orthoScale):t/2/Math.tan(J.fov/2)}}function Cu(){let t=k.renderer?.cullCounts||{full:0,board:0,body:0,box:0,culled:0},e=!k.renderer||k.renderer.identityOnly;return{occurrences:k.renderer?.occurrenceMatrices.length||0,lod:e?{full:1,board:0,body:0,box:0,culled:0}:{...t},triangles:k.renderer?.frameStats.triangles||0,draws:k.renderer?.frameStats.draws||0,gpuMemoryBytes:k.renderer?.gpuMemoryBytes()||0,gpuBreakdown:k.renderer?.gpuMemoryBreakdown()||null,gpuBudgetBytes:v.gpuBudgetBytes,componentTier:k.scene.componentTier,componentEvictions:k.scene.componentEvictions,tileEvictions:k.tileEvictions,visibleTileMisses:k.visibleTileMisses||0,cache:k.assetCache?k.assetCache.summary():{enabled:!1},frameIntervalMs:v.frameIntervalMs,frameIntervalP95Ms:v.frameIntervalP95Ms,frameCpuMs:v.frameCpuMs,frameCpuP95Ms:v.frameCpuP95Ms,fps:v.fps}}function Bu(t){v.showStats=!!t,Ja&&(Ja.hidden=!v.showStats),Fu()}function Fu(){if(!Ja||!v.showStats)return;let t=Cu(),{full:e,board:a,body:s,box:r,culled:n}=t.lod,i=[["Occurrences",`${t.occurrences} (${e+a+s+r} visible)`],["Detail",`${e} full \xB7 ${a} board \xB7 ${s} body \xB7 ${r} box \xB7 ${n} culled`],["Triangles",t.triangles.toLocaleString()],["Draws",t.draws.toLocaleString()],["GPU memory",`${(t.gpuMemoryBytes/1048576).toFixed(1)} / ${(t.gpuBudgetBytes/1048576).toFixed(0)} MB`],["Components",`${t.componentTier}${t.componentEvictions?` \xB7 ${t.componentEvictions} evicted`:""}`],["Cache",t.cache.enabled?`${t.cache.hits} hits \xB7 ${t.cache.misses} misses \xB7 ${(t.cache.bytes/1048576).toFixed(0)} MB`:"off"],["Frame",`${t.frameIntervalMs.toFixed(1)} ms \xB7 p95 ${t.frameIntervalP95Ms.toFixed(1)}`],["CPU",`${t.frameCpuMs.toFixed(2)} ms \xB7 p95 ${t.frameCpuP95Ms.toFixed(2)}`],["FPS",t.fps.toFixed(0)]];Ja.innerHTML=i.map(([o,c])=>`<dt>${o}</dt><dd>${c}</dd>`).join("")}async function Ou(t=Ge,e=k){let a=e.semanticGeometry.assets?.components_glb;if(!a||e.scene.componentTier!=="idle")return;e.scene.componentTier="loading";let s;try{s=await yc(new URL(a,location.href).toString(),{componentFeatures:e.scene.componentFeatures,fetchBytes:Pu(e),zOffset:Number(e.scene.manifest?.componentsZOffsetMm||0)/1e3})}catch(i){throw Fe(t)&&(e.scene.componentTier="idle"),i}if(!Fe(t)||!e.renderer)return;let r=go(s.models);if(await C0([...r.instanced.map(i=>i.primitive),...r.baked].reduce((i,o)=>i+B0(o),0)),!Fe(t)||!e.renderer)return;e.scene.componentTier="loaded",e.loadedBytes+=s.byteLength;for(let i of s.models)for(let o of i.placements){let c=e.scene.componentFeatures.get(o.designator);c&&z0(c.featureId,o.bounds,e)}for(let[i,o]of s.componentNodeCounts||[])e.scene.componentModelCounts.set(i,o);e.hiddenComponentRequest&&Qu(e.hiddenComponentRequest);let n=i=>({kind:"component",layerId:0,material:i.material,color:i.material.baseColor});e.scene.componentEntries=[...e.renderer.addInstancedPrimitives(r.instanced.map(i=>({primitive:i.primitive,placements:i.placements,metadata:n(i.primitive)}))),...r.baked.map(i=>e.renderer.addPrimitive(i,n(i)))]}function Pu(t=k){return t.assetCache?e=>t.assetCache.fetchBytes(e):void 0}function L0(t,e=k){if(!e.renderer||t-(e.tiersCheckedAt||0)<250)return;e.tiersCheckedAt=t;let a=e.renderer.cullCounts,s=a.board+a.body>0,r=e.renderer.identityOnly&&!e.deferComponents||!e.renderer.identityOnly&&(a.full>0||s);r&&(e.scene.componentsWantedAt=t),r&&e.scene.componentTier==="idle"&&e.semanticGeometry.assets?.components_glb&&Ou(Ge,e).catch(i=>console.warn("Failed to load components",i));let n=()=>e.renderer.gpuMemoryBytes();e.gpuBytes=n(),!(e.gpuBytes<=v.gpuBudgetBytes)&&e.scene.componentTier==="loaded"&&t-e.scene.componentsWantedAt>g0&&(e.renderer.removeEntries(e.scene.componentEntries),e.scene.componentEntries=[],e.scene.componentTier="idle",e.scene.componentEvictions+=1,e.gpuBytes=n())}var ru=4e-4,nu=5e-5,D0={baseColor:[.62,.7,.8,1],metallic:0,roughness:.8,emissive:[0,0,0]};function iu(t,e=k){if(!e.renderer)return;let a=new Map;for(let i of e.topology.physical_objects||[])i.kind==="footprint_body"&&i.designator&&i.bbox_mm?.length===4&&a.set(i.designator,i);let s=(t?.[5]??8e-4)+nu,r=(t?.[2]??-8e-4)-nu,n=[];for(let i of e.scene.componentFeatures.values()){let o=Number(i.featureId),c=e.scene.features.get(o),l=a.get(i.designator);if(!c||c.bounds||!l)continue;let[f,u,g,p]=l.bbox_mm.map(Number),h=String(l.layer||"").startsWith("B."),d=[f/1e3,-p/1e3,h?r-ru:s,g/1e3,-u/1e3,h?r:s+ru];c.bounds=d,c.placeholder=!0,n.push(U0(d,o))}if(n.length)for(let i of rs(n))e.renderer.addPrimitive(i,{kind:"component",layerId:0,material:i.material,color:i.material.baseColor,opacityScale:.3,translucent:!0,placeholder:!0})}function U0([t,e,a,s,r,n],i){let o=[[[0,0,1],[[t,e,n],[s,e,n],[s,r,n],[t,r,n]]],[[0,0,-1],[[t,r,a],[s,r,a],[s,e,a],[t,e,a]]],[[1,0,0],[[s,e,a],[s,r,a],[s,r,n],[s,e,n]]],[[-1,0,0],[[t,r,a],[t,e,a],[t,e,n],[t,r,n]]],[[0,1,0],[[s,r,a],[t,r,a],[t,r,n],[s,r,n]]],[[0,-1,0],[[t,e,a],[s,e,a],[s,e,n],[t,e,n]]]],c=new Float32Array(72),l=new Float32Array(72),f=new Uint32Array(36);return o.forEach(([u,g],p)=>{g.forEach((d,m)=>{c.set(d,(p*4+m)*3),l.set(u,(p*4+m)*3)});let h=p*4;f.set([h,h+1,h+2,h,h+2,h+3],p*6)}),{position:c,normal:l,netId:new Uint32Array(24),objectFeatureId:new Uint32Array(24).fill(i),indices:f,material:D0,bounds:[t,e,a,s,r,n]}}function z0(t,e,a=k){let s=a.scene.features.get(Number(t));if(!s||!e.length)return;let r=[1/0,1/0,1/0,-1/0,-1/0,-1/0];for(let n=0;n<e.length;n+=3)r[0]=Math.min(r[0],e[n]),r[1]=Math.min(r[1],e[n+1]),r[2]=Math.min(r[2],e[n+2]),r[3]=Math.max(r[3],e[n]),r[4]=Math.max(r[4],e[n+1]),r[5]=Math.max(r[5],e[n+2]);s.bounds=s.bounds?[Math.min(s.bounds[0],r[0]),Math.min(s.bounds[1],r[1]),Math.min(s.bounds[2],r[2]),Math.max(s.bounds[3],r[3]),Math.max(s.bounds[4],r[4]),Math.max(s.bounds[5],r[5])]:r}function Bi(t,e=k){return Hi(t,e.scene.copperLayers)}var G0=[.55,.35,.16,.78];function ju(t=k){return qi(t.topology?.board?.stackup?.copper_finish)}function K0(t,e=k){return Wi(t,e.scene.copperLayers)}var V0=.25;function Sr(){return!v.realisticColors||v.mode==="layer"||!v.showBoard?0:1-he(v.separation/V0,0,1)}function Ar(t,e=k){let a=K0(t,e)?ju(e):pa.copper;return Lu(Bi(t,e),a,Sr())}function Lu(t,e,a){return t.map((s,r)=>s+(e[r]-s)*a)}function H0(t,e=Ge){if(e!==Ge||!k.renderer||!J)return;let a=performance.now(),s=Math.max(0,t-$a);if(v.workspace==="schematic"&&B){$a=t;let l=B.visiblePages(),f=Z?Z0(l):[];B.setDomDetailPageIds(f.map(u=>u.id)),D.visiblePages=B.render(),Z?.syncWorldPages(f,B,{activeNetUid:D.activeNetUid}),rf(),hu(s,performance.now()-a),pu(t),Ei(e);return}let r=Math.min(.05,(t-$a)/1e3);$a=t,J.update(r),k.renderer.resize();let n=Nr();k.scene.copperRealism!==Sr()&&Oi();for(let l of k.renderer.entries)l.layerOffset=n[l.layerId]||0;ex(t),Ct=Uu(t);let i=tx(t);Le={layerId:0,viewport:{x:0,y:0,width:q.width,height:q.height},matrix:J.matrix(q.width,q.height,v.mode==="layer"),lod:j0(q.height,v.mode==="layer")},k.renderer.selectedOccurrence=v.selectedFeatureId||v.activeNetId?v.selectedOccurrence:-1,k.renderer.setInnerCopperMode(F0(!v.showBoard||v.separation>.001,_r().size>0));let o=v.mode==="3d"?k.visible3dLayers:Iu(),c={panels:[Le],activeNetId:v.activeNetId,selectedFeatureId:v.selectedFeatureId,time:t/1e3,layerOffsets:n,visibleLayers:o,showBoard:v.showBoard,showComponents:v.showComponents,showPaste:v.separation===0,componentOpacity:he(1-v.separation/.1,0,1),boardOpacity:_r().size?.34:1-v.separation*.72,isolateNet:v.isolateNet,compareMode:v.mode==="layer",compareOffsets:Ct,layerAlphas:i,visibleTileIds:v.mode==="3d"?k.visibleTileIds:null};if(ca=c,Y0(t,c)){k.renderer.render(c),Ax(),Ix();for(let l of Ir)l()}L0(t),hu(s,performance.now()-a),pu(t),Ei(e)}var q0=1e3,W0=1e3/30,$e={key:"",matrix:new Float32Array(16),tiles:null,at:0},ca=null,ie={canvas:null,context:null,depth:null,depthView:null,width:0,height:0},Rr=new Ys(3e3),Ir=new Set,mr={frames:0,cpuMs:0,gpuMs:0,lastTriangles:0},ou={cullTiles:!0};function X0(t,e){let a=k.renderer;ie.canvas||(ie.canvas=document.createElement("canvas"),ie.context=ie.canvas.getContext("webgpu")),!(ie.width>=t&&ie.height>=e&&ie.depth)&&(ie.width=Math.max(ie.width,t),ie.height=Math.max(ie.height,e),ie.canvas.width=ie.width,ie.canvas.height=ie.height,ie.context.configure({device:a.device,format:a.format,alphaMode:"opaque"}),ie.depth?.destroy(),ie.depth=a.device.createTexture({label:"inset-depth",size:[ie.width,ie.height],format:a.depthFormat,sampleCount:a.sampleCount,usage:GPUTextureUsage.RENDER_ATTACHMENT}),ie.depthView=ie.depth.createView())}function Du(){return!!(k.renderer&&ca&&v.workspace==="pcb")}function $0(t,e,a="inset"){if(!Du())return!1;let s=t.clientWidth,r=t.clientHeight;if(!s||!r)return!1;let n=performance.now(),i=Math.min(devicePixelRatio||1,2),o=Math.round(s*i),c=Math.round(r*i);X0(o,c);let l=Ot(k.scene.runtimeBounds),f=Un(e,s,r,l,e.focusZ??0);Rr.record(a,f,n);let u={layerId:0,viewport:{x:0,y:0,width:o,height:c},matrix:f,lod:ca.panels[0].lod},g=ca.visibleTileIds,p=k.renderer.renderInto({colorView:ie.context.getCurrentTexture().createView(),depthView:ie.depthView,width:ie.width,height:ie.height},u,{...ca,panels:[u],visibleTileIds:g});return t.width!==o&&(t.width=o),t.height!==c&&(t.height=c),t.getContext("2d").drawImage(ie.canvas,0,0,o,c,0,0,o,c),mr.frames+=1,mr.cpuMs+=performance.now()-n,mr.lastTriangles=p.triangles,!0}function Y0(t,e){let a=e.panels[0].matrix,s=!1;for(let c=0;c<16;c+=1)if(a[c]!==$e.matrix[c]){s=!0;break}if(s)return $e.matrix.set(a),$e.key="",$e.at=t,!0;let r=[q.width,q.height,k.renderer.version,k.renderer.selectedOccurrence,v.workspace,v.mode,e.activeNetId,e.selectedFeatureId,e.showBoard,e.showComponents,e.showPaste,e.componentOpacity,e.boardOpacity,e.isolateNet,k.scene.layerZOffsetSignature,[...e.visibleLayers].join(","),[...e.compareOffsets].map(([c,l])=>`${c}:${l}`).join(";"),e.layerAlphas?[...e.layerAlphas].join(";"):""].join("|");return!!(e.activeNetId||e.selectedFeatureId||k.renderer.emphasizedNetIds.size)&&t-$e.at>=W0||r!==$e.key||!J0(e.visibleTileIds,$e.tiles)||t-$e.at>q0?($e.key=r,$e.tiles=e.visibleTileIds,$e.at=t,!0):!1}function J0(t,e){if(!t||!e)return t===e;if(t.size!==e.size)return!1;for(let a of t)if(!e.has(a))return!1;return!0}function Q0(t){if(!B||!t)return{widthPx:0,heightPx:0,sourcePxPerMm:0,area:0};let e=B.pagePixelWidth(t),a=t.heightMm/Math.max(1e-6,B.scale),s=B.pageSourcePixelsPerMm(t);return{widthPx:e,heightPx:a,sourcePxPerMm:s,area:e*a}}function Z0(t){if(!Z||!B)return[];let e=t||[],a=Math.max(1,Be.clientWidth*Be.clientHeight);return e.map(n=>({page:n,...Q0(n)})).filter(n=>n.widthPx>=760&&n.heightPx>=520&&n.area>=a*.36&&n.sourcePxPerMm>=1.25).sort((n,i)=>i.area-n.area).slice(0,1).map(n=>n.page)}function Nr(t=k){let e=ua(t),a=Math.hypot((e[3]-e[0])*1e3,(e[4]-e[1])*1e3),s=v.separation*v.separation*he(a*.12,8,25)/1e3,r=`${v.separation}:${s}:${t.scene.copperLayers.length}`;if(t.scene.layerZOffsetSignature===r)return t.scene.layerZOffsets;let n=t.scene.layerZOffsets;n.fill(0);let i=(t.scene.copperLayers.length-1)/2;return t.scene.copperLayers.forEach((o,c)=>{n[Number(o.id)]=(i-c)*s}),t.scene.layerZOffsetSignature=r,n}function Uu(t){if(v.mode!=="layer")return Ae.key="3d",Ae.current.clear(),new Map;let e=k.scene.copperLayers.filter(m=>k.compareLayers.has(Number(m.id))),a=Math.max(1,e.length),s=q.width/Math.max(1,q.height),r=1;a===2?r=s>=1?2:1:a===3||a===4?r=2:a>4&&(r=Math.ceil(Math.sqrt(a*s)));let n=Math.ceil(a/r),i=ua(),o=i[3]-i[0],c=i[4]-i[1],l=o*1.18,f=c*1.22,u=e.map((m,b)=>{let y=b%r,x=Math.floor(b/r);return{layer:m,layerId:Number(m.id),column:y,row:x,offset:[(y-(r-1)/2)*l,((n-1)/2-x)*f,0]}}),g=`${r}x${n}:${u.map(m=>m.layerId).join(",")}`;if(g!==Ae.key){Ae.key=g,Ae.started=t,Ae.from=new Map(Ae.current);let m=r*o+(r-1)*(l-o),b=n*c+(n-1)*(f-c);J.targetFocus=[(i[0]+i[3])/2,(i[1]+i[4])/2,(i[2]+i[5])/2],J.targetOrthoScale=Math.max(b,m/s)*1.08}let p=he((t-Ae.started)/420,0,1),h=1-Math.pow(1-p,3),d=new Map;for(let m of u){let b=Ae.from.get(m.layerId)||[0,0,0],y=m.offset.map((x,w)=>b[w]+(x-b[w])*h);d.set(m.layerId,y),Ae.current.set(m.layerId,y)}if(Y.phase==="reveal")for(let m of Y.previous)d.has(Number(m))||d.set(Number(m),Y.previousOffsets.get(Number(m))||[0,0,0]);for(let m of[...Ae.current.keys()])u.some(b=>b.layerId===m)||Ae.current.delete(m);return d}function es(t){let e=new Set([...t].map(Number));if(!(cu(e,k.desiredCompareLayers)&&Y.phase!=="idle")){if(k.desiredCompareLayers=e,cu(e,k.compareLayers)){Y.phase="idle",Y.previous.clear(),Y.target.clear();return}Y.phase="preload",Y.previous=new Set(k.compareLayers),Y.target=new Set(e),Y.previousOffsets=new Map(Ae.current),Y.started=performance.now()}}function Fi({snap:t=!0}={}){v.mode="layer";let e=O0();k.desiredCompareLayers=new Set(e),!k.compareLayers.size&&e.size&&(k.compareLayers=new Set(e)),Y.phase="idle",Y.previous.clear(),Y.target.clear(),Ae.key="",J.setAxis("z",!1),k.renderer?.resize(),Ct=Uu(performance.now()),t&&J.snap()}function ex(t){if(!(v.mode!=="layer"||Y.phase==="idle")){if(Y.phase==="preload"){Y.phase="reveal",Y.started=t,Y.previousOffsets=new Map(Ae.current),k.compareLayers=new Set(Y.target),Ae.key="";return}Y.phase==="reveal"&&t-Y.started>=gu&&(k.compareLayers=new Set(Y.target),Y.phase="idle",Y.previous.clear(),Y.target.clear(),Y.previousOffsets.clear())}}function tx(t){if(v.mode!=="layer"||Y.phase!=="reveal")return null;let e=he((t-Y.started)/gu,0,1),a=e*e*(3-2*e),s=new Map;for(let r of Y.previous)s.set(Number(r),Y.target.has(Number(r))?1:1-a);for(let r of Y.target)s.set(Number(r),Y.previous.has(Number(r))?1:a);return s}function cu(t,e){if(t.size!==e.size)return!1;for(let a of t)if(!e.has(a))return!1;return!0}function zu(){if(v.workspace==="schematic"){sx();return}if(v.workspace==="bom"){ax();return}if(v.workspace==="stackup")return;Fr.textContent=k.viewerReadiness.stage==="semantic-ready"?"Semantic GLTF A0":"Prism staged 3D",Or.textContent="Layers",Pr.textContent="Visibility and compare",te('[data-panel="search"] .section-heading span').textContent="Nets, components and pins",te('[data-panel="view"] .section-heading span').textContent="Camera and stackup";let t=`
    <div class="mode-toolbar">
      <button data-mode="layer">PCB</button>
      <button data-mode="3d">3D</button>
    </div>`;oa&&(oa.innerHTML=t),Ye.innerHTML=`
    ${oa?"":t}
    <div class="layer-presets">
      <button data-preset="all">All</button><button data-preset="none">None</button>
      <button data-preset="outer">Outer</button><button data-preset="inner">Inner</button>
    </div>
    <div class="layer-list"></div>`,ke.innerHTML=`
    <label class="control-field"><span>Search</span>
      <input id="entity-search" class="layer-select" type="search" placeholder="Net, component or pin">
      <div id="search-results" class="search-results"></div>
    </label>
    <div class="quick-actions">
      <button id="frame-selection">Frame</button>
      <button id="show-net-layers">Net layers</button>
      <button id="isolate-net" aria-keyshortcuts="I" title="Toggle isolated net view (I)">Isolate</button>
      <button id="clear-selection">Clear</button>
    </div>`,je.innerHTML=`
    <div class="toggle-list">
      <label class="toggle-row"><input id="show-board" type="checkbox"><span>Board substrate</span></label>
      <label class="toggle-row"><input id="show-components" type="checkbox"><span>Components</span></label>
    </div>
    <label class="control-field range-field"><span>Stackup separation</span>
      <input id="separation" type="range" min="0" max="1" step="0.002">
    </label>`,Ke(),bx()}function ax(){Fr.textContent="BoM A0",Or.textContent="Bill of Materials",Pr.textContent="Grouped procurement view",te('[data-panel="search"] .section-heading span').textContent="Search inside the BoM table",te('[data-panel="view"] .section-heading span').textContent="BoM actions";let t=Je?.payload?.counts||{};Ye.innerHTML=`
    <div class="selection-properties">
      <div class="selection-property"><small>Rows</small><strong>${t.rows||0}</strong></div>
      <div class="selection-property"><small>Components</small><strong>${t.components||0}</strong></div>
      <div class="selection-property"><small>DNP</small><strong>${t.dnpComponents||0}</strong></div>
    </div>
    <div class="selection-section">
      <span class="selection-section-title">Columns</span>
      <div class="selection-empty">Primary procurement and thermal columns are shown first. Additional symbol and footprint metadata is available in the row detail panel.</div>
    </div>`,ke.innerHTML=`
    <div class="selection-empty">Use the BoM search box in the main view. Reference chips update the shared PCB and schematic selection without changing workspaces.</div>
    <div class="quick-actions">
      <button id="clear-selection">Clear</button>
    </div>`,je.innerHTML=`
    <div class="selection-section">
      <span class="selection-section-title">Cross-probing</span>
      <div class="selection-table">
        <div class="selection-row"><span><strong>PCB/Schematic</strong></span><span>Select component</span><span>Highlights matching BoM row</span></div>
        <div class="selection-row"><span><strong>BoM reference</strong></span><span>Click chip</span><span>Holds component selection for PCB and schematic</span></div>
      </div>
    </div>`,ke.querySelector("#clear-selection")?.addEventListener("click",Ht)}function sx(){Fr.textContent=Z?"Schematic SVG DOM":D.manifest?.schema==="prism.schematic_vector_a0"?"Schematic Vector A0":"Schematic World A0",Or.textContent="Pages",Pr.textContent=`${D.pages.length} hierarchy instances`,te('[data-panel="search"] .section-heading span').textContent="Pages, nets and components",te('[data-panel="view"] .section-heading span').textContent="World navigation",Ye.innerHTML=`
    <div class="layer-presets">
      <button data-page-action="world">Fit world</button>
      <button data-page-action="parent">Parent</button>
      <button data-page-action="previous">Previous</button>
      <button data-page-action="next">Next</button>
    </div>
    <div class="page-list">${D.pages.map(t=>`
      <button class="page-row ${t.id===v.selectedPageId?"active":""}" data-page="${t.id}">
        <span>${t.sheetNumber}</span>
        <strong>${G(t.name)}</strong>
        <small>L${t.depth}</small>
      </button>`).join("")}</div>`,ke.innerHTML=`
    <label class="control-field"><span>Search</span>
      <input id="entity-search" class="layer-select" type="search" placeholder="Page, net or component">
      <div id="search-results" class="search-results"></div>
    </label>
    <div class="quick-actions">
      <button id="frame-selection">Frame</button>
      <button id="clear-selection">Clear</button>
    </div>`,je.innerHTML=`
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
    </div>`,Ye.querySelectorAll("[data-page]").forEach(t=>{t.addEventListener("click",()=>ct(t.dataset.page,!0))}),Ye.querySelectorAll("[data-page-action]").forEach(t=>{t.addEventListener("click",()=>yr(t.dataset.pageAction))}),ke.querySelector("#entity-search").addEventListener("input",t=>{nx(t.target.value)}),ke.querySelector("#frame-selection").addEventListener("click",Vu),ke.querySelector("#clear-selection").addEventListener("click",ts),je.querySelector("#show-hierarchy").checked=B?.showHierarchy??!0,je.querySelector("#show-hierarchy").addEventListener("change",t=>{B.showHierarchy=t.target.checked})}function ct(t,e){let a=D.byId.get(t);!a||!B||(v.selectedPageId=a.id,v.selectedSchematicFeature=null,B.selectedPageId=a.id,B.selectedFeatureId=0,st.textContent=JSON.stringify(a,null,2),e&&B.framePage(a),Ye.querySelectorAll("[data-page]").forEach(s=>{s.classList.toggle("active",s.dataset.page===a.id)}))}function yr(t){if(!B)return;if(t==="world"){B.frameWorld();return}let e=Math.max(0,D.pages.findIndex(s=>s.id===v.selectedPageId)),a=null;t==="previous"?a=D.pages[(e-1+D.pages.length)%D.pages.length]:t==="next"?a=D.pages[(e+1)%D.pages.length]:t==="parent"&&(a=D.byId.get(D.pages[e]?.parentId)),a&&ct(a.id,!0)}function rx(t){if(!t||!B)return;if(ts(),t.kind==="page"&&t.pageId){ct(t.pageId,!0);return}if(t.kind!=="sheet")return;let e=D.pages.find(n=>n.sheetInstancePath===t.sheetInstancePath)||D.byId.get(v.selectedPageId),a=String(t.sheetFile||t.feature?.sheet_file||"").replace(/\\/g,"/"),s=String(t.sheetName||t.feature?.sheet_name||t.feature?.objectId||""),r=D.pages.find(n=>{if(e&&n.parentId&&n.parentId!==e.id)return!1;let i=String(n.sourcePath||"").replace(/\\/g,"/");return a&&i.endsWith(a)||s&&n.name===s})||D.pages.find(n=>{let i=String(n.sourcePath||"").replace(/\\/g,"/");return a&&i.endsWith(a)||s&&n.name===s});r&&ct(r.id,!0)}function nx(t){let e=ke.querySelector("#search-results"),a=t.trim().toLowerCase();if(!a){e.innerHTML="";return}let s=D.pages.filter(n=>`${n.name} ${n.sheetPath}`.toLowerCase().includes(a)).slice(0,8),r=k.scene.nets.filter(n=>String(n.name).toLowerCase().includes(a)).slice(0,8);e.innerHTML=[...s.map(n=>`<button data-page="${n.id}"><b>${G(n.name)}</b><span>Page ${n.sheetNumber}</span></button>`),...r.map(n=>`<button data-schematic-net="${n.id}"><b>${G(n.name)}</b><span>${(D.manifest.netToPages?.[n.uid]||[]).length} pages</span></button>`)].join(""),e.querySelectorAll("[data-page]").forEach(n=>{n.addEventListener("click",()=>ct(n.dataset.page,!0))}),e.querySelectorAll("[data-schematic-net]").forEach(n=>{n.addEventListener("click",()=>Gu(Number(n.dataset.schematicNet),!0))})}function Gu(t,e){let a=k.scene.nets.find(r=>Number(r.id)===t);if(!a||!B)return;v.activeNetId=t,v.selectedFeatureId=0,v.selectedSchematicFeature=null,B.selectedFeatureId=0,B.selectedFeatureKey="",B.selectedSourceId="",D.activeNetUid=a.uid,B.activeNetUid=a.uid,Z?.setHighlightedNet(a.uid),st.textContent=JSON.stringify(a,null,2),Ve();let s=D.manifest.netToPages?.[a.uid]||[];e&&s.length&&ct(s[0],!0)}function Ku(t,e=null){let a=k.scene.nets.find(s=>s.uid===t);a&&(v.activeNetId=Number(a.id),D.activeNetUid=a.uid,B&&(B.activeNetUid=a.uid,B.selectedFeatureId=Number(e?.feature?.id||e?.featureId||0),B.selectedFeatureKey=e?.feature?.stableKey||e?.featureKey||"",B.selectedSourceId=e?.feature?.sourceId||e?.sourceId||""),Z?.setHighlightedNet(a.uid),e&&(v.selectedSchematicFeature={...e,pageId:v.selectedPageId}),st.textContent=JSON.stringify(e?{...e,net:a}:a,null,2),Ve())}function ts(){v.activeNetId=0,v.selectedFeatureId=0,v.selectedSchematicFeature=null,D.activeNetUid="",B&&(B.activeNetUid="",B.selectedFeatureId=0,B.selectedFeatureKey="",B.selectedSourceId=""),Z?.setSelection(null),Z?.setHighlightedNet(""),st.textContent="No object selected",Ve()}function Vu(){let t=D.byId.get(v.selectedPageId);t?B.framePage(t):B.frameWorld()}function ix(t){v.selectedPageId=t.sheetInstancePath&&D.pages.find(s=>s.sheetInstancePath===t.sheetInstancePath)?.id||v.selectedPageId,v.selectedFeatureId=0,v.selectedSchematicFeature={...t,pageId:v.selectedPageId},t.anchor&&(v.selectionAnchor=t.anchor),B&&(B.selectedPageId=v.selectedPageId,B.selectedFeatureId=Number(t.feature?.id||0));let e=t.netUid?k.scene.nets.find(s=>s.uid===t.netUid):null,a=t.reference?k.scene.componentFeatures.get(t.reference):null;a&&(v.selectedFeatureId=Number(a.featureId||0),Je?.setSelectionByReference(t.reference,{scroll:v.workspace==="bom"})),st.textContent=JSON.stringify({...t,net:e,component:a},null,2),Ve()}function ox(t){let{page:e,feature:a}=t;if(!a){v.selectedSchematicFeature=null,B.selectedFeatureId=0,ct(e.id,!1),Ve();return}let s=Number(a.id||0);if(v.selectedPageId=e.id,B.selectedPageId=e.id,B.selectedFeatureId=s,v.selectedSchematicFeature={...a,pageId:e.id},v.selectionAnchor=null,a.netUid){let r=k.scene.nets.find(n=>n.uid===a.netUid);if(r){Gu(Number(r.id),!1),v.selectedSchematicFeature={...a,pageId:e.id},B.selectedFeatureId=s;return}}if(a.reference){let r=k.scene.componentFeatures.get(a.reference);if(r){ha(Number(r.featureId),!1),v.selectedSchematicFeature={...a,pageId:e.id},B.selectedFeatureId=s;return}}v.activeNetId=0,v.selectedFeatureId=0,B.activeNetUid="",st.textContent=JSON.stringify({page:e.name,...a},null,2),Ve()}function Vt(){let t=v.isolateNet,e=ke?.querySelector?.("#isolate-net");e?.classList.toggle("active",t),e?.setAttribute("aria-pressed",String(t));let a=ae?.querySelector?.("[data-action=isolate]");a?.classList.toggle("active",t),a?.setAttribute("aria-pressed",String(t));let s=je?.querySelector?.("#show-board");s&&(s.checked=v.showBoard);let r=je?.querySelector?.("#show-components");r&&(r.checked=v.showComponents),da()}function cx(){let t=new Set;for(let e of _r())for(let a of lx(e))t.add(a);return t}function lx(t,e=k){let a=new Set,s=e.scene.nets.find(n=>Number(n.id)===Number(t)),r=new Set(e.scene.copperLayers.map(n=>Number(n.id)));for(let n of Object.keys(s?.layerBoundsMm||{})){let i=Number(n);r.has(i)&&a.add(i)}if(!a.size){let n=new Map(e.scene.copperLayers.map(i=>[i.name,Number(i.id)]));for(let i of s?.metrics?.layers||[]){let o=n.get(i);o!=null&&a.add(o)}}return a}function as(){let t=cx();t.size&&(k.visible3dLayers=new Set(t),v.mode==="layer"?es(t):(k.compareLayers=new Set(t),k.desiredCompareLayers=new Set(t)))}function fa(t){let e=!!(t&&Za()),a=v.isolateNet;if(e&&!v.isolateNet&&(k.preIsolation3dLayers=new Set(k.visible3dLayers),k.preIsolationCompareLayers=new Set(k.desiredCompareLayers.size?k.desiredCompareLayers:k.compareLayers)),v.isolateNet=e,v.isolateNet)as();else if(k.preIsolation3dLayers||k.preIsolationCompareLayers){if(k.preIsolation3dLayers&&(k.visible3dLayers=new Set(k.preIsolation3dLayers)),k.preIsolationCompareLayers){let s=new Set(k.preIsolationCompareLayers);v.mode==="layer"?es(s):(k.compareLayers=s,k.desiredCompareLayers=new Set(s))}k.preIsolation3dLayers=null,k.preIsolationCompareLayers=null}e&&!a?(v.preIsolationShowBoard=v.showBoard,v.showBoard=!1):!e&&a&&(typeof v.preIsolationShowBoard=="boolean"&&(v.showBoard=v.preIsolationShowBoard),v.preIsolationShowBoard=null),Vt(),Ke()}function Ke(){(oa||Ye).querySelectorAll("[data-mode]").forEach(a=>{let s=a.dataset.mode===v.mode;a.classList.toggle("active",s),a.setAttribute("aria-pressed",String(s))}),je.querySelector("#show-board").checked=v.showBoard,je.querySelector("#show-components").checked=v.showComponents,je.querySelector("#separation").value=v.separation;let t=Ye.querySelector(".layer-list"),e=v.mode==="3d"?k.visible3dLayers:k.desiredCompareLayers;t.innerHTML=k.scene.copperLayers.map((a,s)=>`
    <label class="layer-row">
      <input type="checkbox" data-layer="${a.id}" ${e.has(Number(a.id))?"checked":""}>
      <span class="swatch" style="background:${Gi(Bi(a))}"></span>
      <span>${G(a.name)}</span><small>${s+1}</small>
    </label>`).join(""),t.querySelectorAll("[data-layer]").forEach(a=>a.addEventListener("change",()=>{qu(Number(a.dataset.layer),a.checked)})),Vt()}function Hu(t){t==="layer"?Fi():(v.mode="3d",J.frame(ua()),J.snap(),k.visibleTileIds=new Set),Ke()}function qu(t,e){if(v.mode==="3d")e?k.visible3dLayers.add(t):k.visible3dLayers.delete(t);else{let a=new Set(k.desiredCompareLayers);e?a.add(t):a.delete(t),es(a)}Ke()}function Wu(t){let e=v.mode==="3d"?k.visible3dLayers:new Set;e.clear();for(let[a,s]of k.scene.copperLayers.entries())(t==="all"||t==="outer"&&(a===0||a===k.scene.copperLayers.length-1)||t==="inner"&&a>0&&a<k.scene.copperLayers.length-1)&&e.add(Number(s.id));v.mode!=="3d"&&es(e),Ke()}function Xu(t){v.showBoard=!!t,v.savedShowBoard=v.showBoard,v.showBoard&&v.isolateNet?fa(!1):Vt()}function $u(t){v.showComponents=!!t,v.savedShowComponents=v.showComponents,Vt()}function dx(t){v.showPlaceholders=!!t,k.renderer?.setPlaceholdersVisible(v.showPlaceholders),da()}function ux(){let t=new Set((k.scene?.layers||[]).map(s=>String(s.name))),e=new Set(v.hiddenBoardLayers),a=s=>{let r=(k.renderer?.entries||[]).find(i=>i.kind==="board"&&i.boardRole===s),n=r?.color||r?.material?.baseColor;return n?Gi(n):b0[s]};return h0.filter(s=>!t.size||t.has(s.name)).map(s=>({...s,color:a(s.role),visible:!e.has(`${s.role}:${s.side}`)}))}function fx(t,e,a){let s=`${t}:${e}`,r=new Set(v.hiddenBoardLayers);a?r.delete(s):r.add(s),v.hiddenBoardLayers=[...r],k.renderer?.setHiddenBoardLayers(v.hiddenBoardLayers),da()}function hx(t){v.realisticColors=!!t,Oi(),da()}function Oi(t=k){if(!t.renderer)return;let e=new Map(t.scene.layers.map(a=>[Number(a.id),a]));for(let a of t.renderer.entries)a.kind==="copper"&&(a.color=Ar(e.get(Number(a.layerId)),t));t.renderer.copperColors=new Map([...e].map(([a,s])=>[a,Ar(s,t)])),t.renderer.invalidate?.(),t.renderer.setBarrelColor(Lu(G0,[...ju(t).slice(0,3),.78],Sr())),t.scene.copperRealism=Sr()}function Yu(t){v.separation=he(Number(t)||0,0,1),da()}function bx(){(oa||Ye).querySelectorAll("[data-mode]").forEach(e=>e.addEventListener("click",()=>{Hu(e.dataset.mode)})),Ye.querySelectorAll("[data-preset]").forEach(e=>e.addEventListener("click",()=>{Wu(e.dataset.preset)})),je.querySelector("#show-board").addEventListener("change",e=>{Xu(e.target.checked)}),je.querySelector("#show-components").addEventListener("change",e=>{$u(e.target.checked)}),je.querySelector("#separation").addEventListener("input",e=>{Yu(e.target.value)}),ke.querySelector("#clear-selection").addEventListener("click",Ht),ke.querySelector("#isolate-net").addEventListener("click",()=>{fa(!v.isolateNet)}),ke.querySelector("#frame-selection").addEventListener("click",zi),ke.querySelector("#show-net-layers").addEventListener("click",Pi);let t=ke.querySelector("#entity-search");t.addEventListener("input",()=>Ju(t.value))}function px(){Kt(".rail-tab").forEach(t=>t.addEventListener("click",()=>{let e=t.dataset.tab,a=v.activeTab===e&&!Nt.classList.contains("panel-collapsed");v.activeTab=e,Nt.classList.toggle("panel-collapsed",a),Kt(".rail-tab").forEach(s=>{s.classList.toggle("active",!a&&s.dataset.tab===e)}),Kt(".tab-panel").forEach(s=>{s.classList.toggle("active",!a&&s.dataset.panel===e)})}))}function Pi(){let t=k.scene.nets.find(s=>Number(s.id)===v.activeNetId);if(!t)return;let e=new Set(t.metrics?.layers||[]),a=v.mode==="3d"?k.visible3dLayers:new Set;a.clear();for(let s of k.scene.copperLayers)e.has(s.name)&&a.add(Number(s.id));v.mode!=="3d"&&es(a),Ke()}function Ju(t){let e=ke.querySelector("#search-results"),a=t.trim().toLowerCase();if(!a){e.innerHTML="";return}let s=k.scene.nets.filter(n=>String(n.name).toLowerCase().includes(a)).slice(0,8),r=[...k.scene.componentFeatures.values()].filter(n=>!k.hiddenComponents.has(String(n.designator||""))&&`${n.designator} ${n.value} ${n.footprint}`.toLowerCase().includes(a)).slice(0,6);e.innerHTML=[...s.map(n=>`<button data-net="${n.id}"><b>${G(n.name)}</b><span>${G(n.netClass||"")}</span></button>`),...r.map(n=>`<button data-feature="${n.featureId}"><b>${G(n.designator)}</b><span>${G(n.value)}</span></button>`)].join(""),e.querySelectorAll("[data-net]").forEach(n=>{n.addEventListener("click",()=>ji(Number(n.dataset.net),!0))}),e.querySelectorAll("[data-feature]").forEach(n=>{n.addEventListener("click",()=>ha(Number(n.dataset.feature),!0))})}function ji(t,e){e&&(v.selectionAnchor=null),v.activeNetId=t,v.selectedFeatureId=0;let a=k.scene.nets.find(s=>Number(s.id)===t);v.workspace==="schematic"&&a&&B&&(D.activeNetUid=a.uid,B.activeNetUid=a.uid),Ci(),st.textContent=JSON.stringify(a||{},null,2),Ve(),v.isolateNet&&as(),e&&a?.boundsMm&&J.frame(Di(Ni(ga(a.boundsMm)))),Ii(Mu(a))}function ha(t,e=!1){let a=k.scene.features.get(t);if(a?.kind==="component"&&ps(la(a),k.hiddenComponents))return;e&&(v.selectionAnchor=null),v.selectedFeatureId=t,v.activeNetId=Number(a?.netId||0);let s=la(a);s&&Je?.setSelectionByReference(s,{scroll:v.workspace==="bom"});let r=_u(a);r?.kind==="net"||r?.kind==="terminal"&&v.activeNetId?Ci():Su(),st.textContent=a?JSON.stringify(a,null,2):"No object selected",Ve(),v.isolateNet&&v.activeNetId&&as(),e&&a?.bounds&&Ui(a),Ii(r)}function Li(t,e=!1){if(ps(t,k.hiddenComponents))return;let a=k.scene.componentFeatures.get(t);if(Je?.setSelectionByReference(t,{scroll:v.workspace==="bom"}),!a?.featureId)return;Su(),ha(Number(a.featureId),!1);let s=mx(t);if(s){let{page:r,feature:n}=s;v.selectedPageId=r.id,v.selectedSchematicFeature={...n,pageId:r.id},B&&(B.selectedPageId=r.id,B.selectedFeatureId=Number(n.id||0)),Z?.setSelection?.({kind:"component",featureKey:n.stableKey||"",sheetInstancePath:n.sheetInstancePath||r.sheetInstancePath||"",sourceId:n.sourceId||n.uuid||"",reference:t,feature:n,pageId:r.id}),e&&v.workspace==="schematic"&&(ct(r.id,!0),Z?.frameSelection?.())}if(e&&v.workspace==="pcb"){let r=k.scene.features.get(Number(a.featureId));r?.bounds&&Ui(r,!0)}Ve()}function la(t){return t?.designator||t?.reference||t?.componentDesignator||""}function gx(t=k){return io(t.scene.manifest?.components||[],t.scene.componentModelCounts)}function Qu(t){k.hiddenComponentRequest=t;let e=oo(t,gx());k.hiddenComponents=e.hiddenReferences,k.renderer?.setHiddenFeatureIds(e.hiddenFeatureIds),e.ambiguous.length&&console.warn(`[prism-semantic-viewer] keeping ambiguous components visible: ${e.ambiguous.join(", ")}`),e.unknown.length&&console.warn(`[prism-semantic-viewer] ignoring unknown components: ${e.unknown.join(", ")}`);let a=la(k.scene.features.get(v.selectedFeatureId));ps(a,k.hiddenComponents)&&Ht();let s=ke.querySelector("input");return s?.value&&Ju(s.value),e}function Di(t,e=[...Ct.keys()]){if(v.mode!=="layer"||!t)return t;let a=[];for(let s of e){let r=Ct.get(Number(s));r&&a.push([t[0]+r[0],t[1]+r[1],0,t[3]+r[0],t[4]+r[1],0])}return a.length?Vi(a):t}function Ui(t,e=!1){if(!t?.bounds)return;let a=Ni(t.bounds),s=e||t.kind==="component"||!!la(t);if(v.mode==="layer"){let r=k.scene.copperLayers,n=(a[2]+a[5])*.5<0?r[r.length-1]:r[0];J.frame(Di(a,s&&n?[Number(n.id)]:void 0));return}if(s){let n=(a[2]+a[5])*.5<0,i=J.isBelow();n!==i&&J.setAxis("z",n)}J.frame(a)}function mx(t){if(!t||!B?.featuresByPage)return null;let e=D.byId.get(v.selectedPageId),a=[...e?[e]:[],...(D.pages||[]).filter(r=>r.id!==e?.id)],s=r=>{let n=String(r.kind||"").toLowerCase();return n==="component"||n==="symbol_body"||n==="symbol_instance"?0:n==="symbol_reference"?1:n.startsWith("pin")?2:3};for(let r of a){let n=(B.featuresByPage[r.id]||[]).filter(i=>String(i.reference||i.designator||i.componentDesignator||"")===t).sort((i,o)=>s(i)-s(o));if(n.length)return{page:r,feature:n[0]}}return null}function Ht(){v.activeNetId=0,v.selectedFeatureId=0,v.selectedSchematicFeature=null,v.selectionAnchor=null;let t=Za(),e=v.isolateNet;e&&!t?fa(!1):t?e&&as():v.isolateNet=!1,t||Au(),D.activeNetUid="",B&&(B.activeNetUid=""),Z?.setSelection(null),Z?.setHighlightedNet(""),st.textContent="No object selected",Je?.clearSelection?.(),Ve(),Ii(null)}function xr(t){return`<div class="selection-properties">${t.map(([e,a])=>`
    <div class="selection-property">
      <small>${G(e)}</small>
      <strong title="${G(String(a))}">${G(String(a))}</strong>
    </div>`).join("")}</div>`}function Cr(t,e,a){return`
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
      <div class="selection-card-title"><small>${G(t)}</small><strong>${G(e)}</strong></div>
      <button class="selection-card-close" type="button" aria-label="Clear selection">&times;</button>
    </div>`}function yx(t){let a=(k.topology.net_details?.[t.uid]||{}).terminals||[],s=t.metrics||{},r=Number(s.traceLengthMm||0).toFixed(2),n=s.objectCounts?.via||0,i=a.length,c=/^(VCC|VDD|GND|3V3|5V|12V|VIN|POWER)/i.test(t.name)?"#10b981":"#8b5cf6",l=t.netClass||"Default",f=a.length?a.map(u=>`
      <div class="selection-row pin-row-interactive" data-ref="${G(u.designator)}" data-pin="${G(u.pin)}">
        <span class="refdes-col"><strong>${G(u.designator)}</strong></span>
        <span class="pin-col">Pin ${G(u.pin)}</span>
        <span class="val-col" title="${G(u.value||"")}">${G(u.value||"-")}</span>
      </div>`).join(""):'<div class="selection-empty">No connected pin metadata is available.</div>';return`
    ${Cr("Net",t.name,c)}
    <div class="selection-net-dashboard">
      <div class="net-metric-grid">
        <div class="metric-card">
          <small>Length</small>
          <strong>${r} <span class="unit">mm</span></strong>
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
          <strong title="${G(l)}">${G(l)}</strong>
        </div>
      </div>
      
      <div class="selection-section">
        <span class="selection-section-title">Layers</span>
        <div class="net-layers-badges">
          ${(s.layers||[]).length?s.layers.map(u=>`<span class="layer-badge">${G(u)}</span>`).join(""):'<span class="layer-badge unknown">None</span>'}
        </div>
      </div>

      <div class="selection-section">
        <span class="selection-section-title">Connected Pins</span>
        <div class="selection-table compact-scroll" style="max-height: 120px;">
          ${f}
        </div>
      </div>
    </div>`}function xx(t,e=null){let a=Ri(t.designator),s=a?a.value:t.value||"Not specified",r=a?a.footprint:t.footprint||"Not specified",n=a?.parameters||{},i=n.Manufacturer||n.Mfr||"",o=n["Manufacturer Part Number"]||n.MPN||n["Part Number"]||"",c=n.kicad_dnp==="true"||n.DNP==="true"||n.kicad_in_bom==="false",l="";(i||o)&&(l=`
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
      </div>`);let f="";return e&&(f=`
      <div class="selection-section">
        <span class="selection-section-title">Selected Pin</span>
        <div class="selection-table">
          <div class="selection-row">
            <span><strong>Pin</strong></span>
            <span>Pin ${G(e.pinNumber||e.pin||"")}</span>
            <span title="${G(e.pinName||"")}">${G(e.pinName||"No name")}</span>
          </div>
          <div class="selection-row">
            <span><strong>Net</strong></span>
            <span class="net-ref-interactive" data-net-name="${G(e.netName||"")}">${G(e.netName||"Not connected")}</span>
          </div>
        </div>
      </div>`),`
    ${Cr("Component",t.designator||"Unknown","#3b82f6")}
    <div class="selection-component-dashboard">
      ${c?'<div class="dnp-banner" style="background:#b45309;color:#fff;font-size:9px;font-weight:750;text-align:center;padding:3px;margin-bottom:8px;border-radius:2px;text-transform:uppercase;letter-spacing:0.05em;">DNP (Do Not Populate)</div>':""}
      ${xr([["Value",s],["Footprint",r.split(":").pop()||r]])}
      ${l}
      ${f}
    </div>`}function wx(t,e){let a=String(t.kind||"").toLowerCase(),s=a.startsWith("pin");if(a==="component"||a.includes("symbol"))return`
      ${Cr("Component",t.reference||t.componentDesignator||"Unknown","#3b82f6")}
      ${xr([["Value",t.value||t.componentValue||"Not specified"],["Footprint",t.componentFootprint||t.footprint||"Not specified"],["Library",t.libraryRef||"Not specified"],["UID",t.componentUid||t.uuid||t.sourceId||"Not resolved"]])}
      <div class="selection-section">
        <span class="selection-section-title">Schematic placement</span>
        ${xr([["Page",e?.name||"Unknown"],["Sheet",t.sheetInstancePath||"/"]])}
      </div>`;let n=s?[["Symbol",t.reference||t.designator||"Unknown"],["Value",t.value||t.componentValue||"Not specified"],["Pin",`${t.pinNumber||"-"}${t.pinName?` ${t.pinName}`:""}`],["Net",t.netName||"Not connected"],["PCB Pad",t.pcbPadId||"Not resolved"],["Component UID",t.componentUid||"Not resolved"]]:[["Page",e?.name||"Unknown"],["Kind",t.kind.replaceAll("_"," ")],["Net",t.netName||"Not connected"]];return`
    ${Cr(t.kind.replaceAll("_"," "),t.pinName||t.reference||t.designator||t.text||t.netName||"Schematic object","#3b82f6")}
    ${xr(n)}
    <div class="selection-section">
      <span class="selection-section-title">Source identity</span>
      <div class="selection-table">
        <div class="selection-row">
          <span><strong>${s?"Pin UUID":"UUID"}</strong></span>
          <span title="${G(t.uuid||t.sourceId||"")}">${G(t.uuid||t.sourceId||"-")}</span>
          <span title="${G(t.objectId||"")}">${G(t.objectId||"No object ID")}</span>
        </div>
        <div class="selection-row">
          <span><strong>Sheet</strong></span>
          <span>${G(e?.name||"Unknown")}</span>
          <span title="${G(t.sheetInstancePath||"")}">${G(t.sheetInstancePath||"/")}</span>
        </div>
      </div>
    </div>`}function Ve(){if(da(),v.workspace==="bom"){ae.hidden=!0,ae.innerHTML="";return}let t=k.scene.features.get(v.selectedFeatureId),e=t?.kind==="component"?t:null,a=v.workspace==="schematic"?v.selectedSchematicFeature:null,s=a?D.byId.get(a.pageId):null,r=v.activeNetId?k.scene.nets.find(u=>Number(u.id)===v.activeNetId):null;if(!r&&a&&(a.netUid?r=k.scene.nets.find(u=>u.uid===a.netUid):a.netName&&(r=Xt(k.scene.nets,a.netName))),!e&&a){let u=a.reference||a.componentDesignator||a.designator;u&&(e=k.scene.componentFeatures.get(u)||{designator:u})}if(!e&&!r&&!a){ae.hidden=!0,ae.innerHTML="";return}let n="";if(r)n=yx(r);else if(e){let u=a?.kind?.startsWith("pin")?a:null;n=xx(e,u)}else a&&(n=wx(a,s));ae.innerHTML=`
    ${n}
    <div class="selection-card-actions">
      ${r?`
        <button type="button" data-action="isolate" aria-keyshortcuts="I" title="Toggle isolated net view (I)" class="${v.isolateNet?"active":""}">Isolate</button>
        <button type="button" data-action="net-layers">Layers</button>
      `:""}
      <button type="button" data-action="frame">Frame selection</button>
    </div>`,ae.hidden=!1;let i=v.workspace==="schematic"?Be:q,o=v.selectionAnchor,c=ae.offsetWidth||360,l=ae.offsetHeight||330;if(o){let u=Math.max(16,i.clientWidth-c-24),g=Math.max(16,i.clientHeight-l-24);ae.style.left=`${he(o.x+18,16,u)}px`,ae.style.top=`${he(o.y+18,16,g)}px`}else ae.style.left="20px",ae.style.top="20px";if(ae.querySelector(".selection-card-close").addEventListener("click",Ht),ae.querySelector("[data-action=frame]").addEventListener("click",zi),r){let u=ae.querySelector("[data-action=isolate]");u&&u.addEventListener("click",()=>{fa(!v.isolateNet)});let g=ae.querySelector("[data-action=net-layers]");g&&g.addEventListener("click",Pi),ae.querySelectorAll(".pin-row-interactive").forEach(p=>{p.addEventListener("click",()=>{let h=p.dataset.ref,d=p.dataset.pin;if(!h)return;let y=((k.topology.net_details?.[r.uid]||{}).terminals||[]).find(w=>w.designator===h&&w.pin===d),x=y0(y);x?ha(x,!0):Li(h,!0)})})}let f=ae.querySelector(".net-ref-interactive");f&&f.addEventListener("click",()=>{let u=f.dataset.netName;if(!u)return;let g=Xt(k.scene.nets,u);g&&ji(Number(g.id),!0)})}function zi(){if(v.workspace==="schematic"){Vu();return}let t=k.scene.features.get(v.selectedFeatureId);if(t?.bounds)Ui(t);else{let e=k.scene.nets.find(a=>Number(a.id)===v.activeNetId);e?.boundsMm&&J.frame(Di(Ni(ga(e.boundsMm))))}}function vx(){q.addEventListener("contextmenu",t=>t.preventDefault()),q.addEventListener("pointerdown",t=>{v.dragging=!0,v.lastX=t.clientX,v.lastY=t.clientY,v.pointerStartX=t.clientX,v.pointerStartY=t.clientY,v.dragMode=v.mode==="layer"||t.shiftKey||t.button!==0?"pan":"orbit",q.setPointerCapture(t.pointerId)}),q.addEventListener("pointermove",t=>{if(!v.dragging)return;let e=t.clientX-v.lastX,a=t.clientY-v.lastY;v.lastX=t.clientX,v.lastY=t.clientY,v.dragMode==="pan"?J.pan(e,a,q.clientHeight,v.mode==="layer"):J.orbit(e,a)}),q.addEventListener("pointerup",async t=>{v.dragging=!1,q.releasePointerCapture(t.pointerId),!(Math.hypot(t.clientX-v.pointerStartX,t.clientY-v.pointerStartY)>=3)&&v.clickSelect&&(t.button===0?await fu(t):t.button===2&&await Mx(t))}),q.addEventListener("dblclick",async t=>{v.clickSelect&&(await fu(t),zi())}),q.addEventListener("wheel",t=>{t.preventDefault(),Math.abs(t.deltaX)>Math.abs(t.deltaY)*.4?J.pan(-t.deltaX,0,q.clientHeight,v.mode==="layer"):J.dolly(t.deltaY,v.mode==="layer")},{passive:!1}),window.addEventListener("keydown",sf),kx()}function kx(){let t=!1,e,a,s=0,r=0;ae.addEventListener("pointerdown",n=>{if(!n.target.closest(".selection-card-head")||n.target.closest(".selection-card-close"))return;t=!0,ae.classList.add("dragging");let o=ae.getBoundingClientRect();s=o.left,r=o.top,e=n.clientX,a=n.clientY,ae.setPointerCapture(n.pointerId),n.stopPropagation()}),ae.addEventListener("pointermove",n=>{if(!t)return;let i=n.clientX-e,o=n.clientY-a,c=v.workspace==="schematic"?Be:q,l=ae.offsetWidth||360,f=ae.offsetHeight||330,u=Math.max(16,c.clientWidth-l-24),g=Math.max(16,c.clientHeight-f-24),p=he(s+i,16,u),h=he(r+o,16,g);ae.style.left=`${p}px`,ae.style.top=`${h}px`,v.selectionAnchor={x:p-18,y:h-18},n.stopPropagation()}),ae.addEventListener("pointerup",n=>{t&&(t=!1,ae.classList.remove("dragging"),ae.releasePointerCapture(n.pointerId),n.stopPropagation())})}function Ex(){Kt("[data-workspace]").forEach(t=>{t.addEventListener("click",()=>Zu(t.dataset.workspace))})}function Zu(t){if(t==="schematic"&&!B||t==="bom"&&!Je)return;v.workspace=t,Nt.classList.remove("workspace-pcb","workspace-schematic","workspace-bom","workspace-stackup"),Nt.classList.add(`workspace-${t}`),(t==="schematic"&&(v.activeTab==="view"||v.activeTab==="inspect"||v.activeTab==="stats")||t==="bom"||t==="stackup")&&Br("layers");let e=te('.rail-tab[data-tab="layers"]');e&&(t==="schematic"?(e.textContent="Pages",e.title="Schematic pages"):t==="bom"?(e.textContent="Summary",e.title="BoM summary"):(e.textContent="Layers",e.title="Layers and compare"));let a=t==="schematic",s=t==="bom",r=t==="stackup";if(q.hidden=a||s||r,Be&&(Be.hidden=!a),wr&&(wr.hidden=!a||!Z),vr&&(vr.hidden=!a),kr&&(kr.hidden=!s),Pe&&(Pe.hidden=!r),Ce.hidden=a||s||r,Er.hidden=a||s||r,Qa&&(Qa.hidden=!a),Kt("[data-workspace]").forEach(n=>{n.classList.toggle("active",n.dataset.workspace===t)}),_i.textContent=s?"Semantic BoM active":a?Z?"SVG DOM + WebGPU schematic world active":"WebGPU schematic world active":r?"Layer Stackup active":"WebGPU semantic glTF active",a&&!D.fitted&&(B.resize(),B.frameWorld(),D.fitted=!0),!a&&!s&&!r&&(k.renderer?.resize(),v.mode==="layer"&&Fi()),r)try{Bx()}catch(n){console.error("Failed to render stackup workspace",n),Pe&&(Pe.innerHTML=`
          <div class="selection-empty" style="padding:40px;text-align:center;">
            Stackup view failed to render. ${G(n?.message||String(n))}
          </div>
        `)}zu(),Ve()}function Tx(){Be.addEventListener("pointerdown",t=>{Z?.worldActive||Z?.active||(v.schematicDragging=!0,v.schematicLastX=t.clientX,v.schematicLastY=t.clientY,v.schematicStartX=t.clientX,v.schematicStartY=t.clientY,Be.setPointerCapture(t.pointerId))}),Be.addEventListener("pointermove",t=>{if(Z?.worldActive||Z?.active||!v.schematicDragging||!B)return;let e=t.clientX-v.schematicLastX,a=t.clientY-v.schematicLastY;v.schematicLastX=t.clientX,v.schematicLastY=t.clientY,B.pan(e,a)}),Be.addEventListener("pointerup",async t=>{if(!(Z?.worldActive||Z?.active)&&(v.schematicDragging=!1,Be.releasePointerCapture(t.pointerId),Math.hypot(t.clientX-v.schematicStartX,t.clientY-v.schematicStartY)<3)){let e=await B.pickFeature(t.clientX,t.clientY);e?ox(e):ts()}}),Be.addEventListener("dblclick",t=>{if(Z?.worldActive||Z?.active)return;let e=B.hitPage(t.clientX,t.clientY);e&&ct(e.id,!0)}),Be.addEventListener("wheel",t=>{Z?.worldActive||Z?.active||(t.preventDefault(),B.zoom(t.deltaY,t.clientX,t.clientY))},{passive:!1})}function lu(t,e=11,a=32){let s=ia(t,Xe),r=ia([t[0]+1e-4,t[1],t[2]],Xe),n=ia([t[0],t[1]+1e-4,t[2]],Xe);if(!s||!r||!n)return null;let i=Math.max(Math.hypot(r.x-s.x,r.y-s.y),Math.hypot(n.x-s.x,n.y-s.y))/1e-4;if(!(i>0))return null;let o=e/i,c=[];for(let l=0;l<a;l++){let f=2*Math.PI*l/a,u=ia([t[0]+o*Math.cos(f),t[1]+o*Math.sin(f),t[2]],Xe);if(!u)return null;c.push(u)}return{centre:s,ring:c}}function du(t,e){if(!Le||!q)return null;let a=q.getBoundingClientRect(),s=(t-a.left)/a.width*2-1,r=1-(e-a.top)/a.height*2;return Wl(Le.matrix,s,r)}var uu=0;async function fu(t){if(!Le)return;let e=++uu,a=q.getBoundingClientRect();v.selectionAnchor={x:t.clientX-a.left,y:t.clientY-a.top};let s=await ef(t);e===uu&&((s.kind==="feature"||s.kind==="board")&&(v.selectedOccurrence=s.occurrenceIndex),s.featureId?ha(s.featureId,!0):Ht())}async function Mx(t){if(!Le||!wi)return;let e=await ef(t),a=k,s=a.scene.features.get(e.featureId),r=la(s),n=r?Ri(r,a):null;wi({clientX:t.clientX,clientY:t.clientY,reference:r||void 0,value:String(n?.value||s?.value||"")||void 0})}function ef(t){let e=q.getBoundingClientRect();return tf((t.clientX-e.left)*q.width/e.width,(t.clientY-e.top)*q.height/e.height)}async function tf(t,e){let a=await _x(t,e);if(a?.kind==="analytic"&&k.analytic){let s=await bi(k.analytic,a.operationIndex)||await Wd(k.analytic,a.operationIndex,k.scene);return{...a,featureId:s||null}}return a}function _x(t,e){return k.renderer.pick(Le,t,e,{activeNetId:v.activeNetId,selectedFeatureId:v.selectedFeatureId,layerOffsets:Nr(),visibleLayers:v.mode==="3d"?k.visible3dLayers:k.compareLayers,showBoard:v.showBoard,showComponents:v.showComponents,componentOpacity:he(1-v.separation/.1,0,1),boardOpacity:1-v.separation*.72,isolateNet:v.isolateNet,compareMode:v.mode==="layer",compareOffsets:Ct,visibleTileIds:v.mode==="3d"?k.visibleTileIds:null})}async function af(t,e){if(!Le||!k.renderer)return null;let a=q.getBoundingClientRect(),s=await tf((t-a.left)*q.width/a.width,(e-a.top)*q.height/a.height),r=s.featureId?_u(k.scene.features.get(s.featureId),k):null;return{...s,renderer:void 0,selection:r}}function Sx(t,e,a){let s=t.scene.componentFeatures.get(String(e)),r=s?t.scene.features.get(Number(s.featureId))?.bounds:null;if(!r)return null;let n=r[2]+r[5]>=0;return a([(r[0]+r[3])/2,(r[1]+r[4])/2,n?r[5]:r[2]])}function ia(t,e){if(!Le)return null;let a=Ec(Le.matrix,fn(e,t),Le.viewport);if(!a)return null;let s=q.getBoundingClientRect();return{x:s.left+a.x*s.width/q.width,y:s.top+a.y*s.height/q.height}}function sf(t){if(!Ai())return;if(bo(t)){t.key==="Escape"&&t.target instanceof HTMLInputElement&&t.target.blur();return}if(po(t))return;let e=t.key.toLowerCase();if(v.workspace==="schematic"){if(e==="/")t.preventDefault(),Br("search"),ke.querySelector("#entity-search")?.focus();else if(e==="escape")D.activeNetUid?(D.activeNetUid="",v.activeNetId=0,B.activeNetUid="",Z?.setHighlightedNet(""),Ve()):ts();else if(e==="~"||t.key==="~"){t.preventDefault();let a=v.selectedSchematicFeature?.netUid;a&&(D.activeNetUid===a?(D.activeNetUid="",v.activeNetId=0,B.activeNetUid="",Z?.setHighlightedNet("")):Ku(a,v.selectedSchematicFeature))}else if(e==="home")B?.frameWorld();else if(e==="[")yr("previous");else if(e==="]")yr("next");else if(e==="n"){t.preventDefault();let a=B?.cycleNetIntrasheetLink(t.shiftKey?-1:1);a?.pageId&&(v.selectedPageId=a.pageId,B.selectedPageId=a.pageId,rf())}else if(t.altKey&&e==="arrowup")yr("parent");else if(t.key.startsWith("Arrow")){t.preventDefault();let a=t.key==="ArrowRight"?32:t.key==="ArrowLeft"?-32:0,s=t.key==="ArrowDown"?32:t.key==="ArrowUp"?-32:0;B?.pan(a,s)}return}if(e==="/")t.preventDefault(),Br("search"),ke.querySelector("#entity-search").focus();else if(e==="escape")Ht();else if(e==="i"&&v.workspace==="pcb"&&Za())t.preventDefault(),fa(!v.isolateNet);else if(e==="home")J.frame(ua());else if(e==="`")Bu(!v.showStats);else if(["x","y","z"].includes(e))J.setAxis(e,t.shiftKey);else if(e==="f")J.flip();else if(e==="r")J.rotateZ(t.shiftKey?-1:1);else if(e===" "){t.preventDefault();let a=k.scene.features.get(v.selectedFeatureId);a?.bounds&&J.setFocus([(a.bounds[0]+a.bounds[3])/2,(a.bounds[1]+a.bounds[4])/2,(a.bounds[2]+a.bounds[5])/2])}else if(t.key.startsWith("Arrow")){t.preventDefault();let a=t.key==="ArrowRight"?32:t.key==="ArrowLeft"?-32:0,s=t.key==="ArrowDown"?32:t.key==="ArrowUp"?-32:0;J.pan(a,s,q.clientHeight,v.mode==="layer")}}function Br(t){v.activeTab=t,Nt.classList.remove("panel-collapsed"),Kt(".rail-tab").forEach(e=>{e.classList.toggle("active",e.dataset.tab===t)}),Kt(".tab-panel").forEach(e=>{e.classList.toggle("active",e.dataset.panel===t)})}function Ax(){let t=Ce.getContext("2d");t.clearRect(0,0,Ce.width,Ce.height);let e=[Ce.width/2,Ce.height/2],a=J.basis(),s=[{axis:"x",label:"X",color:"#e23838",vector:[1,0,0]},{axis:"y",label:"Y",color:"#2dbd50",vector:[0,1,0]},{axis:"z",label:"Z",color:"#3157d5",vector:[0,0,1]}],r=[];for(let n of s)for(let i of[-1,1]){let o=n.vector.map(l=>l*i),c=[yi(o,a.right),-yi(o,a.up),yi(o,a.back)];r.push({...n,sign:i,depth:c[2],point:[e[0]+c[0]*34,e[1]+c[1]*34]})}for(let n of s){let i=r.find(o=>o.axis===n.axis&&o.sign===1);t.strokeStyle=n.color,t.lineWidth=2.4,t.beginPath(),t.moveTo(...e),t.lineTo(...i.point),t.stroke()}Tr=[];for(let n of r.sort((i,o)=>o.depth-i.depth)){let i=n.sign===1,o=i?13:9;t.beginPath(),t.arc(n.point[0],n.point[1],o,0,Math.PI*2),t.fillStyle=i?n.color:`${n.color}66`,t.fill(),t.lineWidth=2,t.strokeStyle=Cx(n.color,i?.45:.58),t.stroke(),i&&(t.fillStyle="#07101c",t.font="700 13px system-ui",t.textAlign="center",t.textBaseline="middle",t.fillText(n.label,n.point[0],n.point[1]+.5)),Tr.push({...n,radius:o+5})}}function Rx(){!Ce||Ce.dataset.bound==="true"||(Ce.dataset.bound="true",Ce.addEventListener("click",t=>{let e=Ce.width/Ce.clientWidth,a=Ce.height/Ce.clientHeight,s=[t.offsetX*e,t.offsetY*a],r=Tr.map(n=>({item:n,distance:Math.hypot(s[0]-n.point[0],s[1]-n.point[1])})).filter(({item:n,distance:i})=>i<=n.radius).sort((n,i)=>n.distance-i.distance)[0]?.item;r&&J.setAxis(r.axis,r.sign<0)}))}function Ix(){if(v.mode!=="layer"||!Le){Er.innerHTML="";return}let t=ua(),e=Iu();Er.innerHTML=k.scene.copperLayers.filter(a=>e.has(Number(a.id))).map(a=>{let s=Ct.get(Number(a.id))||[0,0,0],r=Nx([t[0]+s[0],t[4]+s[1],0],Le.matrix,q.clientWidth,q.clientHeight);return!r||r[0]<-100||r[0]>q.clientWidth+100||r[1]<-100||r[1]>q.clientHeight+100?"":`<span style="left:${r[0]}px;top:${r[1]}px">${G(a.name)}</span>`}).join("")}function rf(){if(v.workspace!=="schematic"||!B){Qa.innerHTML="";return}Qa.innerHTML=D.visiblePages.filter(t=>B.pagePixelWidth(t)>120).map(t=>{let[e,a]=B.worldToScreen(t.worldX+8*B.scale,t.worldY-6*B.scale),s=t.id===v.selectedPageId,n=D.activeNetUid&&t.netUids.includes(D.activeNetUid)?"#18ef52":s?"#3b82f6":"#4b8de8";return`<div class="schematic-page-label" style="left:${e}px;top:${a}px;border-left-color:${n}">
        <strong>${G(t.name)}</strong>
        <small>Page ${t.sheetNumber} &middot; ${t.featureCount.toLocaleString()} features</small>
      </div>`}).join("")}function Nx(t,e,a,s){let r=t[0],n=t[1],i=t[2],o=e[0]*r+e[4]*n+e[8]*i+e[12],c=e[1]*r+e[5]*n+e[9]*i+e[13],l=e[3]*r+e[7]*n+e[11]*i+e[15];return Math.abs(l)<1e-8?null:[(o/l*.5+.5)*a,(.5-c/l*.5)*s]}function yi(t,e){return t[0]*e[0]+t[1]*e[1]+t[2]*e[2]}function Cx(t,e){let a=t.replace("#","");return`#${[0,2,4].map(s=>Math.round(parseInt(a.slice(s,s+2),16)*e).toString(16).padStart(2,"0")).join("")}`}function hu(t,e){v.frameSamples.push({intervalMs:t,cpuMs:e}),v.frameSamples.length>180&&v.frameSamples.shift()}function bu(t,e){if(!t.length)return 0;let a=[...t].sort((s,r)=>s-r);return a[Math.min(a.length-1,Math.floor((a.length-1)*e))]}function pu(t){if(!pr||(v.frames+=1,t-v.fpsAt<=500))return;v.fps=v.frames*1e3/(t-v.fpsAt);let e=v.frameSamples;if(v.frameIntervalMs=e.length?e.reduce((n,i)=>n+i.intervalMs,0)/e.length:0,v.frameCpuMs=e.length?e.reduce((n,i)=>n+i.cpuMs,0)/e.length:0,v.frameIntervalP95Ms=bu(e.map(n=>n.intervalMs),.95),v.frameCpuP95Ms=bu(e.map(n=>n.cpuMs),.95),v.frames=0,v.fpsAt=t,Fu(),v.workspace==="bom"){let n=Je?.payload?.counts||{},i=[["Renderer","BoM DOM table"],["Schema",Je?.payload?.schema||"-"],["Grouped rows",n.rows||0],["Components",n.components||0],["DNP components",n.dnpComponents||0],["Extra columns",Je?.payload?.extraColumns?.length||0],["Frame interval",`${v.frameIntervalMs.toFixed(2)} ms avg / ${v.frameIntervalP95Ms.toFixed(2)} p95`],["CPU frame",`${v.frameCpuMs.toFixed(2)} ms avg / ${v.frameCpuP95Ms.toFixed(2)} p95`],["FPS",v.fps.toFixed(1)]];pr.innerHTML=i.map(([o,c])=>`<dt>${o}</dt><dd>${c}</dd>`).join("");return}let a=v.workspace==="schematic"&&B?B.stats():null,s=v.workspace==="schematic"&&Z?Z.stats():null,r=v.workspace==="schematic"&&B?Z?.active?[["Renderer","SVG DOM schematic detail"],["Pages",D.pages.length],["Mounted pages",s.mountedPages],["Active page",s.activePage],["DOM nodes",s.domNodes.toLocaleString()],["Indexed features",s.indexedFeatures.toLocaleString()],["Indexed nets",s.indexedNets.toLocaleString()],["SVG cache",`${s.cachedSvgPages} pages / ${(s.cachedSvgBytes/1048576).toFixed(1)} MB`],["Selection",`${s.selectionMs.toFixed(1)} ms`],["Active net",k.scene.nets.find(n=>n.uid===D.activeNetUid)?.name||"-"],["Tracking links",`${a.netFlowSegments} total / ${a.netFlowIntrasheetSegments} local`],["Tracking verts",a.netFlowVertices.toLocaleString()],["Mount",`${s.mountMs.toFixed(1)} ms`],["Highlight",`${s.highlightMs.toFixed(1)} ms`],["Fallback",s.fallbackReason||"-"],["Frame interval",`${v.frameIntervalMs.toFixed(2)} ms avg / ${v.frameIntervalP95Ms.toFixed(2)} p95`],["CPU frame",`${v.frameCpuMs.toFixed(2)} ms avg / ${v.frameCpuP95Ms.toFixed(2)} p95`],["FPS",v.fps.toFixed(1)]]:[["Renderer",Z?"SVG DOM + WebGPU world":"WebGPU schematic world"],["Pages",D.pages.length],["Visible pages",D.visiblePages.length],["DOM pages",s?s.mountedPages:0],["DOM nodes",s?s.domNodes.toLocaleString():"0"],["Indexed SVG features",s?s.indexedFeatures.toLocaleString():"0"],["SVG cache",s?`${s.cachedSvgPages} pages / ${(s.cachedSvgBytes/1048576).toFixed(1)} MB`:"0 pages"],["JS heap",s?.heapMb?`${s.heapMb.toFixed(1)} MB`:"-"],["Hierarchy links",D.manifest.edges?.length||0],["Selected page",D.byId.get(v.selectedPageId)?.name||"-"],["Active net",k.scene.nets.find(n=>n.uid===D.activeNetUid)?.name||"-"],["Tracking links",`${a.netFlowSegments} total / ${a.netFlowIntrasheetSegments} local`],["Downloaded",`${(B.downloadedBytes/1048576).toFixed(1)} MB`],["Resident vectors",`${(a.residentVectorBytes/1048576).toFixed(1)} MB`],["Vector pages",`${a.vectorChunks} loaded / ${a.vectorLoads} loading`],["Vector draw",`${a.vectorVertices.toLocaleString()} verts / ${a.vectorDrawChunks} chunks`],["Native detail",`${a.nativeDetailPages} pages @ ${a.nativePxPerMm} / ${a.nativeThresholdPxPerMm} px/mm`],["Vector failures",a.failedVectorChunks],["Truncated",a.truncatedVectors],["Frame interval",`${v.frameIntervalMs.toFixed(2)} ms avg / ${v.frameIntervalP95Ms.toFixed(2)} p95`],["CPU frame",`${v.frameCpuMs.toFixed(2)} ms avg / ${v.frameCpuP95Ms.toFixed(2)} p95`],["FPS",v.fps.toFixed(1)]]:[["Renderer","WebGPU semantic glTF"],["Mode",v.mode==="3d"?"3D":"Layer Compare"],["Visible layers",v.mode==="3d"?k.visible3dLayers.size:k.compareLayers.size],["Resident tiles",k.scene.loaded.size],["Loading tiles",k.scene.loading.size],["Failed tiles",k.scene.failed.size],["Triangles",Math.round(k.triangles).toLocaleString()],["Downloaded",`${(k.loadedBytes/1048576).toFixed(1)} MB`],["Resident GLB",`${(k.residentTileBytes/1048576).toFixed(1)} MB`],["Resident GPU",`${(k.residentTileGpuBytes/1048576).toFixed(1)} MB`],["Tile loads",k.tileLoads.toLocaleString()],["Tile evictions",k.tileEvictions.toLocaleString()],["Tile scheduler",`${k.tileSchedulerMs.toFixed(2)} ms`],["Active net",k.scene.nets.find(n=>Number(n.id)===v.activeNetId)?.name||"-"],["Frame interval",`${v.frameIntervalMs.toFixed(2)} ms avg / ${v.frameIntervalP95Ms.toFixed(2)} p95`],["CPU frame",`${v.frameCpuMs.toFixed(2)} ms avg / ${v.frameCpuP95Ms.toFixed(2)} p95`],["FPS",v.fps.toFixed(1)]];pr.innerHTML=r.map(([n,i])=>`<dt>${n}</dt><dd>${i}</dd>`).join("")}function Gi(t){return`rgb(${t.slice(0,3).map(e=>Math.round(e*255)).join(" ")})`}function Bx(){if(!Pe)return;let t=k.scene.layers||[];if(!t.length){Pe.innerHTML='<div class="selection-empty" style="padding:40px;text-align:center;">No stackup information available for this board.</div>';return}let e=t.filter(M=>["copper","dielectric","paste","silkscreen","soldermask"].includes(M.role)),a=k.topology.board?.stackup||{},s=M=>{if(M==null||M==="")return"None";let O=String(M);return G(O.includes(".")?O.split(".").pop():O)},r=(M,O=4)=>{let L=Number(M);return Number.isFinite(L)&&L>0?L.toFixed(O):"-"},n=(M,O=3)=>{let L=Number(M);return Number.isFinite(L)?L.toFixed(O):"-"},i=M=>{if(M==null||M==="")return"No";if(typeof M=="boolean")return M?"Yes":"No";let O=String(M).trim().toLowerCase(),L=O.includes(".")?O.split(".").pop():O;return["0","false","no","n","off","none"].includes(L)?"No":(["1","true","yes","y","on"].includes(L),"Yes")},o=M=>({copper:"Copper",dielectric:"Dielectric",paste:"Paste",silkscreen:"Silkscreen",soldermask:"Solder mask"})[M]||String(M||"Layer"),c=M=>M.role!=="dielectric"?"":M.type==="core"?"Core":M.type==="prepreg"||(M.material||"").toLowerCase().includes("prepreg")?"Prepreg":"Core",l=(M,O=4)=>{let L=Number(M.thickness_mm);return Number.isFinite(L)&&L>0?`${L.toFixed(O)} mm`:"Not specified"},f=M=>{let O=o(M.role),L=String(M.material||"").trim(),X=L&&L.toLowerCase()!==String(M.role||"").toLowerCase();if(M.role==="dielectric"){let fe=[X?L:"",r(M.epsilon_r,3)!=="-"?`\u03B5r ${r(M.epsilon_r,3)}`:"",r(M.loss_tangent,4)!=="-"?`tan \u03B4 ${r(M.loss_tangent,4)}`:""].filter(Boolean).join(" \xB7 ");return{primary:`${M.name} \xB7 ${c(M)}`,secondary:fe}}return{primary:[M.name,O,X?L:""].filter(Boolean).join(" \xB7 "),secondary:""}},u=0,g=0,p=0,h=0;e.forEach(M=>{h+=M.thickness_mm||0,M.role==="copper"?M.name.toLowerCase().includes("gnd")||M.name.toLowerCase().includes("pwr")||M.name.toLowerCase().includes("plane")?g++:u++:M.role==="dielectric"&&p++});let d=k.scene.copperLayers||[],m=0,b=0,y=0,x=[...(k.scene.manifest?.barrels||[]).filter(M=>M.kind==="via"),...[...k.scene.features.values()].filter(M=>M.kind==="via")],w=jl(d,x);m=w.counts.thru,b=w.counts.blind,y=w.counts.buried;let E=w.spans,T=30,_=T,S=[],N=new Map(e.map((M,O)=>[M,O])),R=Fx(e),I=(M,O)=>{let L=R.get(M.name);if(L!==void 0)return L;let X=Number(M.stack_index);return Number.isFinite(X)?X:O+1e5},C=[...e].sort((M,O)=>{let L=I(M,N.get(M)||0),X=I(O,N.get(O)||0);return L!==X?L-X:(O.z_mm||0)-(M.z_mm||0)});C.forEach(M=>{let O=12;M.role==="dielectric"?O=Math.max(160,Math.min(360,(M.thickness_mm||.1)*140)):M.role==="copper"?O=22:M.role==="soldermask"&&(O=14),S.push({...M,svgY:_,svgHeight:O}),_+=O});let A=800,P=130,K=240,W=P+K+16,Q=W+84,pe="";S.forEach(M=>{let O=M.color||"#7f7f7f";M.role==="copper"?O=M.color||"#f97316":M.role==="dielectric"?O="#a98d5c":M.role==="paste"?O="#cbd5e1":M.role==="soldermask"?O="#1b4332":M.role==="silkscreen"&&(O="#e2e8f0");let L=d.findIndex(lf=>lf.name===M.name),X=f(M),fe=M.svgY+M.svgHeight/2,ye=!!X.secondary&&M.svgHeight>=38,Qe=ye?fe-5:fe+3,Wt=G(M.id),rt=G(M.name),j=Number.isFinite(Number(M.thickness_mm))&&Number(M.thickness_mm)>0,re=G(j?l(M):"\u2014"),He=G([X.primary,X.secondary,`Thickness ${l(M)}`].filter(Boolean).join("; "));pe+=`
      <g class="stackup-svg-layer" data-layer-id="${Wt}" data-layer-name="${rt}">
        <title>${He}</title>
        <rect x="${P}" y="${M.svgY}" width="${K}" height="${M.svgHeight}" fill="${O}" opacity="0.85" rx="1"/>
        <text x="${P-8}" y="${M.svgY+M.svgHeight/2+3}" fill="var(--muted)" font-size="9px" text-anchor="end" font-weight="700">
          ${M.role==="copper"?L+1:""}
        </text>
        <path class="stackup-layer-dimension" d="M ${W+6} ${M.svgY+1} H ${W} V ${M.svgY+M.svgHeight-1} H ${W+6}" />
        <text class="stackup-layer-thickness" x="${W+10}" y="${fe+3}" fill="var(--muted)" font-size="8.5px" font-weight="650">
          ${re}
        </text>
        <text class="stackup-layer-name" x="${Q}" y="${Qe}" fill="var(--foreground)" font-size="9px" font-weight="650">
          ${G(X.primary)}
        </text>
        ${ye?`<text class="stackup-layer-metadata" x="${Q}" y="${fe+10}" fill="var(--muted)" font-size="8px">${G(X.secondary)}</text>`:""}
      </g>
    `});let se="",be=S.filter(M=>M.role==="copper");E.forEach((M,O)=>{let L=S.find(j=>j.name===M.startName),X=S.find(j=>j.name===M.endName);if(!L||!X)return;let fe=L.svgY,ye=X.svgY+X.svgHeight,Qe=P+(O+1)*K/(E.length+1),Wt=M.type==="thru"?"Thru":M.type==="blind"?"Blind":"Buried",rt=`var(--stackup-via-${M.type})`;se+=`
      <g class="stackup-svg-via" data-via-type="${M.type}">
        <title>${Wt}: ${M.startName} \u2192 ${M.endName}</title>
        ${be.map(j=>j.svgY>=L.svgY&&j.svgY<=X.svgY?`<rect x="${Qe-5}" y="${j.svgY}" width="10" height="${j.svgHeight}" fill="${rt}" rx="0.5" />`:"").join("")}
        <rect x="${Qe-2}" y="${fe}" width="4" height="${ye-fe}" fill="${rt}" opacity="0.95" />
        <rect x="${Qe-.75}" y="${fe-1}" width="1.5" height="${ye-fe+2}" fill="var(--panel)" opacity="0.9" />
      </g>
    `});let Ee=`
    <svg class="stackup-visual-svg" viewBox="0 0 ${A} ${_+10}" width="${A}" height="${_+10}">
      <g class="stackup-svg-column-headings" aria-hidden="true">
        <text x="${W+10}" y="15">Thickness</text>
        <text x="${Q}" y="15">Layer / material properties</text>
      </g>
      <g class="stackup-total-dimension" aria-label="Total board thickness ${h.toFixed(4)} millimetres">
        <path d="M 76 ${T} H 68 V ${_} H 76" />
        <text x="68" y="15">Total ${h.toFixed(4)} mm</text>
      </g>
      ${pe}
      ${se}
    </svg>
    <div class="stackup-via-legend" aria-label="Via span legend">
      <span><i data-via-type="thru"></i>Thru</span>
      <span><i data-via-type="blind"></i>Blind</span>
      <span><i data-via-type="buried"></i>Buried</span>
    </div>
  `,ue="";C.forEach(M=>{let O="silk";M.role==="copper"?O="copper":M.role==="dielectric"?O="dielectric":M.role==="paste"?O="paste":M.role==="soldermask"&&(O="mask");let L=c(M),X=G(M.id),fe=G(M.name),ye=f(M);ue+=`
      <tr data-layer-id="${X}" data-layer-name="${fe}" tabindex="0" aria-label="${G(`${ye.primary}; thickness ${l(M)}`)}">
        <td><strong>${fe}</strong></td>
        <td><span class="stackup-badge ${O}">${M.role}</span></td>
        <td>${L||"-"}</td>
        <td>${G(M.material||"-")}</td>
        <td>${M.role==="dielectric"?r(M.epsilon_r,3):"-"}</td>
        <td>${M.role==="dielectric"?r(M.loss_tangent,4):"-"}</td>
        <td>${M.thickness_mm?M.thickness_mm.toFixed(4)+" mm":"-"}</td>
      </tr>
    `});let Te="",ge=k.topology.board?.net_classes||[],Re=M=>{let O=n(M);return O==="-"?O:`${O} mm`};ge.length?ge.forEach(M=>{Te+=`
        <tr>
          <td><strong>${M.name}</strong></td>
          <td>${Re(M.track_width)}</td>
          <td>${Re(M.clearance)}</td>
          <td>${Re(M.diff_pair_width)}</td>
          <td>${Re(M.diff_pair_gap)}</td>
          <td>${Number.isFinite(Number(M.via_diameter))?`${n(M.via_drill)}/${n(M.via_diameter)} mm`:"-"}</td>
        </tr>
      `}):Te=`
      <tr>
        <td colspan="6" class="selection-empty" style="text-align: center;">No design rules or impedance classes defined.</td>
      </tr>
    `,Pe.innerHTML=`
    <div class="stackup-header">
      <div class="stackup-header-title">
        <h1>Layer Stackup</h1>
        <p>Board cross-section profile, layer properties & design rules</p>
      </div>
    </div>

    <div class="stackup-workspace-body">
      <div class="stackup-diagram-card">
        <span class="stackup-section-title">Cross-Section Profile</span>
        ${Ee}
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
                ${ue}
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
  `;let Me=(M,O)=>{Pe.querySelectorAll(".stackup-svg-layer").forEach(L=>{let X=L.dataset.layerId===M;L.classList.toggle("active",X&&O)}),Pe.querySelectorAll(".stackup-table tbody tr[data-layer-id]").forEach(L=>{let X=L.dataset.layerId===M;L.classList.toggle("active",X&&O)})},ba=M=>{let O=Pe.querySelector(".stackup-diagram-card"),L=Pe.querySelector(`.stackup-svg-layer[data-layer-id="${CSS.escape(M)}"]`);if(!O||!L||O.scrollHeight<=O.clientHeight)return;let X=O.getBoundingClientRect(),fe=L.getBoundingClientRect(),ye=O.scrollTop+fe.top-X.top-(O.clientHeight-fe.height)/2,Qe=window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;O.scrollTo({top:Math.max(0,ye),behavior:Qe?"auto":"smooth"})},qt=(M,{revealDiagram:O=!1}={})=>{M.forEach(L=>{let X=()=>{let ye=L.dataset.layerId;Me(ye,!0),O&&ba(ye)},fe=()=>Me(null,!1);L.addEventListener("mouseenter",X),L.addEventListener("mouseleave",fe),O&&(L.addEventListener("focus",X),L.addEventListener("blur",fe))})};qt(Pe.querySelectorAll(".stackup-svg-layer")),qt(Pe.querySelectorAll(".stackup-table tbody tr[data-layer-id]"),{revealDiagram:!0})}function Fx(t){let e=t.filter(r=>r.role==="dielectric");if(!(e.length===1&&e[0]?.name==="Board"))return new Map;let s=new Map;return["F.SilkS","F.Paste","F.Mask","F.Cu","Board","B.Cu","B.Mask","B.Paste","B.SilkS"].forEach((r,n)=>s.set(r,n)),s}function nf(){let t=null;return{begin(){return t?.abort(),t=new AbortController,t},owns(e){return e!==null&&e===t&&!e.signal.aborted},cancel(){t?.abort(),t=null}}}async function of(t,e,{owner:a,bundleUrl:s,loadBundle:r,now:n=()=>performance.now()}){let i=n(),o={},{signal:c}=e,l=()=>a.owns(e)&&t.isConnected;try{t.renderLoading();let f=n(),{bundle:u,topology:g,semanticGeometry:p,assetCache:h}=await r(s,o,c);if(o.bundle_group_total_ms=n()-f,!l())return;t.renderShell();let d=n(),m=await t.mountViewer({topology:g,semanticGeometry:p,readiness:u.readiness,assetCache:h,signal:c});if(!l()){m?.dispose?.();return}t.publishController(m),o.mount_and_first_frame_ms=n()-d,Object.assign(o,m?.performance||{}),o.reload_to_visible_ms=n()-i,t.emitReady({schema:"prism.semantic_viewer_performance.a0",milestone:"board-visible",readiness_stage:u.readiness?.stage||"semantic-ready",readiness_progress:u.readiness?.progress??100,timings:o})}catch(f){if(!l())return;t.renderError(f),t.emitError(f)}}function Ox(){return`
    <style>
      ${Zi}
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
  `}function Px(t){return String(t).replace(/[&<>"']/g,e=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[e])}async function jx(t,e=null,a="fetch",s=void 0){let r=performance.now(),n=await fetch(t,{cache:"no-store",signal:s});if(!n.ok)throw new Error(`Failed to load ${t}: ${n.status}`);let i=await n.json();return e&&(e[`${a}_fetch_parse_ms`]=performance.now()-r,e[`${a}_content_length`]=Number(n.headers.get("content-length")||0)),i}async function Lx(t,e,a){let s=new URL(t,document.baseURI).toString(),r=new URL(s).searchParams.get("viewer")||"",n=os.open(),i=await n.peekJson(s).catch(()=>null),o=!!i;i||(i=await jx(s,e,"bundle",a),Kr(i)&&n.store(s,new TextEncoder().encode(JSON.stringify(i)))),e&&(e.bundle_from_cache=o);let c=Kr(i)&&n.enabled?n:null;if(i.schema!==$i)throw new Error(`Unsupported visualizer bundle schema: ${i.schema||"missing"}`);let l={analytic:!0,cache_key:i.cache_key||"",readiness:i.readiness,assets:i.assets||{}};return{bundle:i,topology:{},semanticGeometry:ao(l,s,i,r),assetCache:c}}var jr=class extends HTMLElement{static get observedAttributes(){return["bundle-url","workspace"]}constructor(){super(),this.attachShadow({mode:"open"}),this.reloadOwner=nf(),this.reloadQueued=!1,this.reloadSource=null,this.modes=Object.freeze({board:new Js(Vn())}),this.mounted=null}get activeMode(){return this.mounted??this.modes.board}detachModes(){this.modes.board.detach(),this.mounted=null}connectedCallback(){this.queueReload()}disconnectedCallback(){this.reloadOwner.cancel(),this.detachModes(),this.reloadSource=null}attributeChangedCallback(e,a,s){if(!(!this.isConnected||a===s)){if(e==="workspace"){this.modes.board.setWorkspace(this.workspace);return}this.queueReload()}}get workspace(){return this.getAttribute("workspace")==="stackup"?"stackup":"pcb"}queueReload(){let e=this.getAttribute("bundle-url");!e||e===this.reloadSource||(this.reloadSource=e,!this.reloadQueued&&(this.reloadQueued=!0,queueMicrotask(()=>{this.reloadQueued=!1,this.isConnected&&this.reload()})))}async reload(){let e=this.getAttribute("bundle-url"),a=this.reloadOwner.begin();if(this.detachModes(),!e){this.shadowRoot.innerHTML="<style>:host{display:block;height:100%;font:14px system-ui;color:#94a3b8}</style><div>Semantic bundle URL is missing.</div>";return}await of(this,a,{owner:this.reloadOwner,bundleUrl:e,loadBundle:Lx})}emit(e,a){this.dispatchEvent(new CustomEvent(`prism-semantic-viewer:${e}`,{bubbles:!0,composed:!0,detail:a}))}renderLoading(){this.shadowRoot.innerHTML='<style>:host{display:block;height:100%;background:#020817;color:#e5e7eb;font:14px system-ui}</style><div style="display:grid;place-items:center;height:100%">Loading semantic visualizer...</div>'}renderShell(){this.shadowRoot.innerHTML=Ox()}renderError(e){console.error(e),this.shadowRoot.innerHTML=`
      <style>
        :host{display:block;height:100%;background:#020817;color:#e5e7eb;font:14px system-ui}
        .error{height:100%;display:grid;place-items:center;padding:24px}
        pre{max-width:100%;white-space:pre-wrap;color:#fecaca;background:#111827;border:1px solid #374151;padding:16px}
      </style>
      <div class="error"><pre>${Px(e?.stack||e?.message||String(e))}</pre></div>
    `}mountViewer({topology:e,semanticGeometry:a,readiness:s,assetCache:r=null,signal:n}){return Eu({root:this.shadowRoot,topology:e,semanticGeometry:a,readiness:s,workspaceScope:"3d",assetCache:r,isActive:()=>this.getAttribute("active")==="true",onSelectionChange:i=>{n.aborted||this.dispatchEvent(new CustomEvent("prism-semantic-viewer:selectionchange",{bubbles:!0,composed:!0,detail:{selection:i}}))},onContextMenu:i=>{n.aborted||this.dispatchEvent(new CustomEvent("prism-semantic-viewer:contextmenu",{bubbles:!0,composed:!0,detail:i}))},onViewStateChange:i=>{n.aborted||this.emitViewState(i)},onPerformanceEvent:i=>{n.aborted||(console.info("[prism-3d-perf]",i),this.dispatchEvent(new CustomEvent("prism-semantic-viewer:performance",{bubbles:!0,composed:!0,detail:i})))}})}publishController(e){this.mounted=this.modes.board,this.mounted.attach(e,{workspace:this.workspace});let a=this.getViewState();a&&this.emitViewState(a)}emitViewState(e){this.dispatchEvent(new CustomEvent("prism-semantic-viewer:viewstatechange",{bubbles:!0,composed:!0,detail:e}))}emitReady(e){console.info("[prism-3d-perf]",e),this.dispatchEvent(new CustomEvent("prism-semantic-viewer:ready",{bubbles:!0,composed:!0,detail:e}))}emitError(e){this.dispatchEvent(new CustomEvent("prism-semantic-viewer:error",{bubbles:!0,detail:{error:e}}))}};ed(jr.prototype);function cf(){customElements.get("prism-semantic-viewer")||customElements.define("prism-semantic-viewer",jr)}window.__PRISM_SEMANTIC_VIEWER_MANUAL_BOOT__=!0;cf();
