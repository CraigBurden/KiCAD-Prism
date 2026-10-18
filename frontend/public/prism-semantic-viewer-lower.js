var O=class{__destroy_into_raw(){let e=this.__wbg_ptr;return this.__wbg_ptr=0,de.unregister(this),e}free(){let e=this.__destroy_into_raw();a.__wbg_analyticpack_free(e,0)}barrelRecords(){let e=a.analyticpack_barrelRecords(this.__wbg_ptr);return M.__wrap(e)}bindingJson(e){let t,o;try{let i=a.analyticpack_bindingJson(this.__wbg_ptr,e);var n=i[0],d=i[1];if(i[3])throw n=0,d=0,G(i[2]);return t=n,o=d,W(n,d)}finally{a.__wbindgen_free(t,o,1)}}headerJson(){let e,t;try{let d=a.analyticpack_headerJson(this.__wbg_ptr);var o=d[0],n=d[1];if(d[3])throw o=0,n=0,G(d[2]);return e=o,t=n,W(o,n)}finally{a.__wbindgen_free(e,t,1)}}lowerSlice(e,t){let o=Ee(e,a.__wbindgen_malloc,a.__wbindgen_realloc),n=B,d=a.analyticpack_lowerSlice(this.__wbg_ptr,o,n,t);if(d[2])throw G(d[1]);return I.__wrap(d[0])}constructor(e){let t=Ae(e,a.__wbindgen_malloc),o=B,n=a.analyticpack_new(t,o);if(n[2])throw G(n[1]);return this.__wbg_ptr=n[0],de.register(this,this.__wbg_ptr,this),this}operationNetIndices(e){let t=a.analyticpack_operationNetIndices(this.__wbg_ptr,e);var o=_(t[0],t[1]).slice();return a.__wbindgen_free(t[0],t[1]*4,4),o}};Symbol.dispose&&(O.prototype[Symbol.dispose]=O.prototype.free);var M=class r{static __wrap(e){let t=Object.create(r.prototype);return t.__wbg_ptr=e,fe.register(t,t.__wbg_ptr,t),t}__destroy_into_raw(){let e=this.__wbg_ptr;return this.__wbg_ptr=0,fe.unregister(this),e}free(){let e=this.__destroy_into_raw();a.__wbg_barrelrecords_free(e,0)}floats(){let e=a.barrelrecords_floats(this.__wbg_ptr);var t=j(e[0],e[1]).slice();return a.__wbindgen_free(e[0],e[1]*4,4),t}skipped(){return a.barrelrecords_skipped(this.__wbg_ptr)>>>0}words(){let e=a.barrelrecords_words(this.__wbg_ptr);var t=_(e[0],e[1]).slice();return a.__wbindgen_free(e[0],e[1]*4,4),t}};Symbol.dispose&&(M.prototype[Symbol.dispose]=M.prototype.free);var I=class r{static __wrap(e){let t=Object.create(r.prototype);return t.__wbg_ptr=e,ue.register(t,t.__wbg_ptr,t),t}__destroy_into_raw(){let e=this.__wbg_ptr;return this.__wbg_ptr=0,ue.unregister(this),e}free(){let e=this.__destroy_into_raw();a.__wbg_loweredslicerecords_free(e,0)}batches(){let e=a.loweredslicerecords_batches(this.__wbg_ptr);var t=_(e[0],e[1]).slice();return a.__wbindgen_free(e[0],e[1]*4,4),t}contourEdgeOperations(){let e=a.loweredslicerecords_contourEdgeOperations(this.__wbg_ptr);var t=_(e[0],e[1]).slice();return a.__wbindgen_free(e[0],e[1]*4,4),t}contourEdges(){let e=a.loweredslicerecords_contourEdges(this.__wbg_ptr);var t=j(e[0],e[1]).slice();return a.__wbindgen_free(e[0],e[1]*4,4),t}covers(){let e=a.loweredslicerecords_covers(this.__wbg_ptr);var t=_(e[0],e[1]).slice();return a.__wbindgen_free(e[0],e[1]*4,4),t}cutIndices(){let e=a.loweredslicerecords_cutIndices(this.__wbg_ptr);var t=_(e[0],e[1]).slice();return a.__wbindgen_free(e[0],e[1]*4,4),t}edgeCuts(){let e=a.loweredslicerecords_edgeCuts(this.__wbg_ptr);var t=_(e[0],e[1]).slice();return a.__wbindgen_free(e[0],e[1]*4,4),t}fanVertices(){let e=a.loweredslicerecords_fanVertices(this.__wbg_ptr);var t=j(e[0],e[1]).slice();return a.__wbindgen_free(e[0],e[1]*4,4),t}outlineEdges(){let e=a.loweredslicerecords_outlineEdges(this.__wbg_ptr);var t=j(e[0],e[1]).slice();return a.__wbindgen_free(e[0],e[1]*4,4),t}outlineShapes(){let e=a.loweredslicerecords_outlineShapes(this.__wbg_ptr);var t=_(e[0],e[1]).slice();return a.__wbindgen_free(e[0],e[1]*4,4),t}shapeCuts(){let e=a.loweredslicerecords_shapeCuts(this.__wbg_ptr);var t=_(e[0],e[1]).slice();return a.__wbindgen_free(e[0],e[1]*4,4),t}shapes(){let e=a.loweredslicerecords_shapes(this.__wbg_ptr);var t=_(e[0],e[1]).slice();return a.__wbindgen_free(e[0],e[1]*4,4),t}statsJson(){let e,t;try{let o=a.loweredslicerecords_statsJson(this.__wbg_ptr);return e=o[0],t=o[1],W(o[0],o[1])}finally{a.__wbindgen_free(e,t,1)}}subtractShapes(){return a.loweredslicerecords_subtractShapes(this.__wbg_ptr)>>>0}};Symbol.dispose&&(I.prototype[Symbol.dispose]=I.prototype.free);function ye(){return{__proto__:null,"./prism_kicad_analytic_bg.js":{__proto__:null,__wbg___wbindgen_throw_bb96b2010945f0bc:function(e,t){throw new Error(W(e,t))},__wbindgen_cast_0000000000000001:function(e,t){return W(e,t)},__wbindgen_init_externref_table:function(){let e=a.__wbindgen_externrefs,t=e.grow(4);e.set(0,void 0),e.set(t+0,void 0),e.set(t+1,null),e.set(t+2,!0),e.set(t+3,!1)}}}}var de=typeof FinalizationRegistry>"u"?{register:()=>{},unregister:()=>{}}:new FinalizationRegistry(r=>a.__wbg_analyticpack_free(r,1)),fe=typeof FinalizationRegistry>"u"?{register:()=>{},unregister:()=>{}}:new FinalizationRegistry(r=>a.__wbg_barrelrecords_free(r,1)),ue=typeof FinalizationRegistry>"u"?{register:()=>{},unregister:()=>{}}:new FinalizationRegistry(r=>a.__wbg_loweredslicerecords_free(r,1));function j(r,e){return r=r>>>0,_e().subarray(r/4,r/4+e)}function _(r,e){return r=r>>>0,xe().subarray(r/4,r/4+e)}var T=null;function _e(){return(T===null||T.byteLength===0)&&(T=new Float32Array(a.memory.buffer)),T}function W(r,e){return Oe(r>>>0,e)}var C=null;function xe(){return(C===null||C.byteLength===0)&&(C=new Uint32Array(a.memory.buffer)),C}var R=null;function D(){return(R===null||R.byteLength===0)&&(R=new Uint8Array(a.memory.buffer)),R}function Ae(r,e){let t=e(r.length*1,1)>>>0;return D().set(r,t/1),B=r.length,t}function Ee(r,e,t){if(t===void 0){let c=N.encode(r),b=e(c.length,1)>>>0;return D().subarray(b,b+c.length).set(c),B=c.length,b}let o=r.length,n=e(o,1)>>>0,d=D(),i=0;for(;i<o;i++){let c=r.charCodeAt(i);if(c>127)break;d[n+i]=c}if(i!==o){i!==0&&(r=r.slice(i)),n=t(n,o,o=i+r.length*3,1)>>>0;let c=D().subarray(n+i,n+o),b=N.encodeInto(r,c);i+=b.written,n=t(n,o,i,1)>>>0}return B=i,n}function G(r){let e=a.__wbindgen_externrefs.get(r);return a.__externref_table_dealloc(r),e}var q=new TextDecoder("utf-8",{ignoreBOM:!0,fatal:!0});q.decode();var ke=2146435072,Q=0;function Oe(r,e){return Q+=e,Q>=ke&&(q=new TextDecoder("utf-8",{ignoreBOM:!0,fatal:!0}),q.decode(),Q=e),q.decode(D().subarray(r,r+e))}var N=new TextEncoder;"encodeInto"in N||(N.encodeInto=function(r,e){let t=N.encode(r);return e.set(t),{read:r.length,written:t.length}});var B=0,Se,ze,a;function Le(r,e){return ze=r,a=r.exports,Se=e,T=null,C=null,R=null,a.__wbindgen_start(),a}async function Te(r,e){if(typeof Response=="function"&&r instanceof Response){if(!r.ok)throw new Error(`failed to fetch Wasm: ${r.status} ${r.statusText} fetching '${r.url}'`);if(typeof WebAssembly.instantiateStreaming=="function")try{return await WebAssembly.instantiateStreaming(r,e)}catch(n){if(t(r.type)&&r.headers.get("Content-Type")!=="application/wasm")console.warn("`WebAssembly.instantiateStreaming` failed because your server does not serve Wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n",n);else throw n}let o=await r.arrayBuffer();return await WebAssembly.instantiate(o,e)}else{let o=await WebAssembly.instantiate(r,e);return o instanceof WebAssembly.Instance?{instance:o,module:r}:o}function t(o){switch(o){case"basic":case"cors":case"default":return!0}return!1}}async function X(r){if(a!==void 0)return a;r!==void 0&&(Object.getPrototypeOf(r)===Object.prototype?{module_or_path:r}=r:console.warn("using deprecated parameters for the initialization function; pass a single object instead")),r===void 0&&(r=new URL("prism_kicad_analytic_bg.wasm",import.meta.url));let e=ye();(typeof r=="string"||typeof Request=="function"&&r instanceof Request||typeof URL=="function"&&r instanceof URL)&&(r=fetch(r));let{instance:t,module:o}=await Te(await r,e);return Le(t,o)}var Ce=1e3;function pe(r,e,t=Ce){let o=r.lowerSlice(e,t);try{return{shapes:new Uint32Array(o.shapes()),subtractShapes:o.subtractShapes(),fanVertices:new Float32Array(o.fanVertices()),covers:new Uint32Array(o.covers()),batches:new Uint32Array(o.batches()),contourEdges:new Float32Array(o.contourEdges()),contourEdgeOperations:new Uint32Array(o.contourEdgeOperations()),shapeCuts:new Uint32Array(o.shapeCuts()),edgeCuts:new Uint32Array(o.edgeCuts()),cutIndices:new Uint32Array(o.cutIndices()),outlineEdges:new Float32Array(o.outlineEdges()),outlineShapes:new Uint32Array(o.outlineShapes()),stats:JSON.parse(o.statsJson())}}finally{o.free()}}var Pe=Object.freeze({unplated:2,tentedFront:4,tentedBack:8,coveredFront:16,coveredBack:32,pluggedFront:64,pluggedBack:128,filled:256,capped:512,castellated:1024});var Re={Uint32Array,Float32Array};function Z(r){let e=[],t=[];for(let[w,f]of Object.entries(r)){if(!ArrayBuffer.isView(f))continue;let g=f.constructor.name;if(!Re[g])throw new TypeError(`cannot cache a ${g} (${w})`);e.push({name:w,kind:g,length:f.length}),t.push(new Uint8Array(f.buffer,f.byteOffset,f.byteLength))}let o=Object.fromEntries(Object.entries(r).filter(([,w])=>!ArrayBuffer.isView(w))),n=new TextEncoder().encode(JSON.stringify({fields:e,rest:o})),d=Math.ceil(n.length/4)*4,i=8+d+t.reduce((w,f)=>w+Math.ceil(f.length/4)*4,0),c=new Uint8Array(i),b=new DataView(c.buffer);b.setUint32(0,1280527440,!0),b.setUint32(4,n.length,!0),c.set(n,8);let h=8+d;for(let w of t)c.set(w,h),h+=Math.ceil(w.length/4)*4;return c}var ee=r=>`
struct Palette {
  ramps: array<vec4f, 512>,
  outline: vec4f,
};
@group(0) @binding(${r}) var<uniform> palette: Palette;
fn ramp(t: f32, which: u32) -> vec3f {
  let x = clamp(t, 0.0, 1.0) * 255.0;
  let i = u32(floor(x));
  let j = min(i + 1u, 255u);
  return mix(palette.ramps[which * 256u + i].rgb, palette.ramps[which * 256u + j].rgb, x - floor(x));
}
fn fieldColor(t: f32) -> vec3f {
  return ramp(t, 0u);
}
`,je=`
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

${ee(10)}
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
`,De={compare:"always",passOp:"keep"},qe=Object.freeze({shapeMask:{face:{compare:"always",passOp:"replace"},read:255,write:128,reference:128,color:!1,depth:!1},fan:{face:{compare:"always",passOp:"invert"},read:255,write:64,reference:0,color:!1,depth:!1},coverSubtract:{face:{compare:"not-equal",passOp:"replace",failOp:"keep"},read:64,write:192,reference:128,color:!1,depth:!1},shapeAdd:{face:{compare:"greater",passOp:"replace"},read:160,write:33,reference:32,color:!0,depth:!0},coverMark:{face:{compare:"equal",passOp:"replace",failOp:"keep"},read:192,write:1,reference:65,color:!1,depth:!1,depthTest:!0},coverAdd:{face:{compare:"equal",passOp:"invert",failOp:"keep",depthFailOp:"keep"},read:224,write:96,reference:64,color:!0,depth:!0},coverClear:{face:{compare:"always",passOp:"zero"},read:255,write:64,reference:0,color:!1,depth:!1},shapeLay:{face:{compare:"greater",passOp:"replace"},read:160,write:32,reference:32,color:!1,depth:!1,depthTest:!0},coverLay:{face:{compare:"equal",passOp:"invert",failOp:"keep",depthFailOp:"keep"},read:224,write:96,reference:64,color:!1,depth:!1,depthTest:!0},shapeBlend:{face:{compare:"greater",passOp:"replace"},read:160,write:32,reference:32,color:!0,depth:!0},coverBlend:{face:{compare:"equal",passOp:"invert",failOp:"keep",depthFailOp:"keep"},read:224,write:96,reference:64,color:!0,depth:!0},tintCovered:{face:{compare:"equal",passOp:"keep"},read:33,write:0,reference:33,color:!0,depth:!0},tintPlain:{face:{compare:"equal",passOp:"keep"},read:33,write:0,reference:32,color:!0,depth:!0},footShape:{face:{compare:"always",passOp:"replace"},read:0,write:2,reference:2,color:!1,depth:!1},footCover:{face:{compare:"equal",passOp:"replace",failOp:"keep"},read:64,write:2,reference:66,color:!1,depth:!1},tintHigh:{face:{compare:"equal",passOp:"replace"},read:34,write:4,reference:38,color:!0,depth:!0},tintLow:{face:{compare:"equal",passOp:"replace"},read:34,write:4,reference:36,color:!0,depth:!0},clearLay:{face:{compare:"always",passOp:"zero"},read:0,write:224,reference:0,color:!1,depth:!1},shapeOnFoot:{face:{compare:"equal",passOp:"invert"},read:166,write:32,reference:6,color:!0,depth:!0},shapeOffFoot:{face:{compare:"equal",passOp:"invert"},read:166,write:32,reference:4,color:!0,depth:!0},coverOnFoot:{face:{compare:"equal",passOp:"invert",failOp:"keep",depthFailOp:"keep"},read:230,write:96,reference:70,color:!0,depth:!0},coverOffFoot:{face:{compare:"equal",passOp:"invert",failOp:"keep",depthFailOp:"keep"},read:230,write:96,reference:68,color:!0,depth:!0},clearFoot:{face:{compare:"always",passOp:"zero"},read:0,write:6,reference:0,color:!1,depth:!1},coat:{face:{compare:"equal",passOp:"keep",failOp:"keep",depthFailOp:"keep"},read:2,write:0,reference:0,color:!0,depth:!0},solid:{face:De,read:0,write:0,reference:0,color:!0,depth:!0},clear:{face:{compare:"always",passOp:"zero"},read:255,write:224,reference:0,color:!1,depth:!1}});var $e=`
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
${ee(7)}
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
`;var He=`
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
${ee(3)}

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
`;function he(r,e){let t=new Float32Array(r.buffer,r.byteOffset+e*20*4,20),[o,n,d,i,c,b]=[t[4],t[5],t[6],t[7],t[8],t[9]],h=[1/0,1/0,-1/0,-1/0];for(let[w,f]of[[t[10],t[11]],[t[12],t[11]],[t[10],t[13]],[t[12],t[13]]]){let g=o*w+n*f+c,v=d*w+i*f+b;h[0]=Math.min(h[0],g),h[1]=Math.min(h[1],v),h[2]=Math.max(h[2],g),h[3]=Math.max(h[3],v)}return h}function re(r){let e=r.contourEdges||new Float32Array(0),t=r.contourEdgeOperations||new Uint32Array(0),o=r.shapeCuts||new Uint32Array(0),n=r.edgeCuts||new Uint32Array(0),d=r.cutIndices||new Uint32Array(0),i=o.length,c=new Uint32Array(Math.max(1,i+d.length));for(let l=0;l<i;l+=2)c[l]=o[l]+i,c[l+1]=o[l+1];c.set(d,i);let b=r.outlineEdges||new Float32Array(0),h=r.outlineShapes||new Uint32Array(0),w=Math.min(e.length/4,t.length),f=new Uint32Array(Math.max(1,w+h.length)*7),g=new Uint32Array(e.buffer,e.byteOffset,e.length),v=0;for(let l=0;l<w;l+=1){if(t[l]&2147483648)continue;let p=v*7;f[p]=g[l*4],f[p+1]=g[l*4+1],f[p+2]=g[l*4+2],f[p+3]=g[l*4+3],f[p+4]=t[l],f[p+5]=(n[l*2]??0)+i,f[p+6]=n[l*2+1]??0,v+=1}let y=v,m=new Uint32Array(b.buffer,b.byteOffset,b.length);for(let l=0;l<h.length;l+=1){let p=v*7;f[p]=m[l*4],f[p+1]=m[l*4+1],f[p+2]=m[l*4+2],f[p+3]=m[l*4+3],f[p+4]=(1073741824|h[l])>>>0,v+=1}return{edgeWords:f,cutWords:c,regionEdges:y,skirtEdges:v-y}}function we(r,e,t=.05){let o=e.shapes.subarray(0,e.subtractShapes*20),n=r.shapes.length/20,d=new Uint32Array(r.shapes.length+o.length);d.set(r.shapes),d.set(o,r.shapes.length);let i=o.length/20,c=new Float64Array(i*4),[b,h,w,f]=[1/0,1/0,-1/0,-1/0];for(let s=0;s<i;s+=1){let u=he(o,s);c.set(u,s*4),b=Math.min(b,u[0]),h=Math.min(h,u[1]),w=Math.max(w,u[2]),f=Math.max(f,u[3])}let[g,v]=[Math.floor(b),Math.floor(h)],y=i?Math.floor(w)-g+1:0,m=i?Math.floor(f)-v+1:0,l=(s,u,E)=>Math.min(E-1,Math.max(0,Math.floor(s)-u)),p=new Uint32Array(y*m+1),ae=(s,u)=>{let[E,S]=[l(c[s*4],g,y),l(c[s*4+2],g,y)],[U,V]=[l(c[s*4+1],v,m),l(c[s*4+3],v,m)];for(let z=E;z<=S;z+=1)for(let L=U;L<=V;L+=1)u(z*m+L)};for(let s=0;s<i;s+=1)ae(s,u=>{p[u+1]+=1});for(let s=0;s<y*m;s+=1)p[s+1]+=p[s];let ne=new Uint32Array(p[y*m]),be=p.slice(0,y*m);for(let s=0;s<i;s+=1)ae(s,u=>{ne[be[u]++]=s});let P=[],$=[],se=new Uint32Array(i),H=0,ie=(s,u,E,S)=>{let U=P.length;if(H+=1,i&&Math.floor(E)>=g&&Math.floor(s)<=g+y-1&&Math.floor(S)>=v&&Math.floor(u)<=v+m-1){let[V,z]=[l(s,g,y),l(E,g,y)],[L,me]=[l(u,v,m),l(S,v,m)];for(let K=V;K<=z;K+=1)for(let Y=L;Y<=me;Y+=1){let ce=K*m+Y;for(let J=p[ce];J<p[ce+1];J+=1){let k=ne[J];se[k]!==H&&(se[k]=H,c[k*4]<=E&&s<=c[k*4+2]&&c[k*4+1]<=S&&u<=c[k*4+3]&&P.push(n+k))}}}$.push(U,P.length-U)};for(let s=r.subtractShapes;s<n;s+=1){let u=he(r.shapes,s);ie(u[0]-t,u[1]-t,u[2]+t,u[3]+t)}let le=n-r.subtractShapes,x=r.contourEdges||new Float32Array(0);for(let s=0;s+3<x.length;s+=4)ie(Math.min(x[s],x[s+2])-t,Math.min(x[s+1],x[s+3])-t,Math.max(x[s],x[s+2])+t,Math.max(x[s+1],x[s+3])+t);let ve=re({...r,shapeCuts:new Uint32Array($.slice(0,le*2)),edgeCuts:new Uint32Array($.slice(le*2)),cutIndices:new Uint32Array(P)});return{shapes:d,...ve}}var ge=null,A=null,oe=null;async function Ie(r,e,t){return ge??=X({module_or_path:t||e}),await ge,A=new O(new Uint8Array(r)),JSON.parse(A.headerJson())}var We={lower({keys:r,toleranceNm:e}){let t={},o=[];for(let n of r){let d=pe(A,n,e);t[n]=Z(Object.assign(d,re(d))),o.push(t[n].buffer)}return[{lowered:t},o]},step({copper:r,mask:e}){let t=Z(we(r,e));return[{step:t},[t.buffer]]},barrels(){let r=A.barrelRecords();try{let e={floats:new Float32Array(r.floats()),words:new Uint32Array(r.words()),skipped:r.skipped()};return[{barrels:e},[e.floats.buffer,e.words.buffer]]}finally{r.free()}},netIndices({count:r}){let e=new Uint32Array(A.operationNetIndices(r));return[{indices:e},[e.buffer]]},binding({index:r}){return[{binding:JSON.parse(A.bindingJson(r))},[]]}};self.onmessage=async({data:r})=>{if(r.type==="open"){oe=Ie(r.bytes,r.wasmUrl,r.wasmModule);try{self.postMessage({id:0,header:await oe})}catch(t){self.postMessage({id:0,error:t instanceof Error?t.message:String(t)})}return}if(r.type==="close"){A?.free(),A=null;return}let{id:e}=r;try{if(r.type!=="step"&&(await oe,!A))throw new Error("no pack is open");let t=We[r.type];if(!t)throw new Error(`unknown message ${r.type}`);let[o,n]=t(r);self.postMessage({id:e,...o},n)}catch(t){self.postMessage({id:e,error:t instanceof Error?t.message:String(t)})}};
