// Page half of check.mjs: build the renderer's pipeline sets with test
// features on a real device, inside validation error scopes.
import { Renderer } from "../../../viewer/src/renderer.js";

// Touches every hook; reads the scene position each family exposes at vs-end.
const PROBE = {
  name: "probe",
  decl: () => "fn probeTint(c: vec4f) -> vec4f { return vec4f(c.rgb * 0.999, c.a); }",
  vsOut: () => "  @location(9) probeWorld: vec3f,",
  vsEnd: (ctx) => `  output.probeWorld = ${ctx.world};`,
  fsBegin: () => "  if (input.probeWorld.z < -1.0e9) { discard; }",
  fsReturn: (expr, ctx) => (ctx.output === "color" ? `probeTint(${expr})` : expr),
};
// A second feature, so two features compose in one shader.
const SECOND = {
  name: "second",
  decl: () => "fn secondTint(c: vec4f) -> vec4f { return c; }",
  vsOut: () => "  @location(10) @interpolate(flat) secondFlag: u32,",
  vsEnd: () => "  output.secondFlag = 1u;",
  fsBegin: () => "  if (input.secondFlag == 7u) { discard; }",
  fsReturn: (expr, ctx) => (ctx.output === "color" ? `secondTint(${expr})` : expr),
};

async function scoped(device, build) {
  device.pushErrorScope("validation");
  device.pushErrorScope("internal");
  let value = null;
  let thrown = null;
  try {
    value = build();
  } catch (error) {
    thrown = error;
  }
  const internal = await device.popErrorScope();
  const validation = await device.popErrorScope();
  const errors = [thrown?.message, validation?.message, internal?.message].filter(Boolean);
  return { value, errors };
}

const count = (set) => new Set(Object.values(set).filter(Boolean)).size;

window.__vtShaderCheck = {
  async run() {
    const renderer = await Renderer.create(document.getElementById("c"));
    const device = renderer.device;
    const adapterInfo = (await navigator.gpu.requestAdapter())?.info;
    const rows = [];
    const check = async (label, build) => {
      const { value, errors } = await scoped(device, build);
      // Compilation messages arrive asynchronously; wait for every module.
      await device.queue.onSubmittedWorkDone();
      rows.push({ set: label, pipelines: value ? count(value) : 0, ok: errors.length === 0 && Boolean(value), errors });
    };
    for (const features of [[], [PROBE], [PROBE, SECOND]]) {
      const tag = features.map((feature) => feature.name).join("+") || "none";
      renderer.setShaderFeatures(features);
      await check(`one-board ${tag}`, () => renderer.pipelinesFor(false));
      await check(`one-board components ${tag}`, () => renderer.componentPipelines(renderer.pipelinesFor(false)));
      await check(`instanced ${tag}`, () => renderer.pipelinesFor(true));
      await check(`instanced components ${tag}`, () => renderer.componentPipelines(renderer.pipelinesFor(true)));
    }
    renderer.setShaderFeatures([]);
    return { adapter: [adapterInfo?.vendor, adapterInfo?.architecture].filter(Boolean).join(" ") || "unknown adapter", rows };
  },
};
