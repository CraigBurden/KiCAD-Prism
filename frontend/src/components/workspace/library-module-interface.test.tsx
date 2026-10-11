import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CatalogComponent } from "@/types/catalog";

vi.mock("./catalog-client");

import { listModels, listModuleConnectors } from "./catalog-client";
import { faceLabel } from "./library-module-connector-dialog";
import { ModuleConnectorsPanel } from "./library-module-interface";

const module = (patch: Partial<CatalogComponent>) => ({
  id: "cmp", kind: "module", assets: [], interface: {}, current_revision_id: "rev-1", ...patch,
}) as unknown as CatalogComponent;

const UNITS = [
  { key: "A", unit: 1, name: "POWER", pins: [
    { pad: "1", name: "VIN", signal: "VIN", powerNet: true }, { pad: "2", name: "", signal: "", powerNet: false }] },
  { key: "B", unit: 2, name: "AUX", pins: [{ pad: "3", name: "PPS", signal: "PPS", powerNet: false }] },
];
const HEADER = { componentId: "hdr", name: "Header", mpn: "HDR-1", manufacturer: "Test" };
const placedA = {
  part: HEADER, placement: { originMm: [0, 0, 10], normal: [0, 0, 1], quarterTurns: 0, axis: null },
  geometry: { pads: [{ pad: "1" }, { pad: "2" }] }, footprintPose: null, model: null, missingPads: [],
};

function serve(connectors: unknown, glb: boolean) {
  vi.mocked(listModels).mockResolvedValue({ items: [{ assetId: "m", name: "imu.step", glb: glb ? { key: "k".repeat(64) } : null,
    alignment: { offsetMm: [0, 0, 0], rotationDeg: [0, 0, 0], scale: 1 } }] } as never);
  vi.mocked(listModuleConnectors).mockResolvedValue(connectors as never);
}

describe("module connectors", () => {
  beforeEach(() => {
    vi.mocked(listModels).mockReset();
    vi.mocked(listModuleConnectors).mockReset();
  });

  it("lists each unit's pins with their signals", () => {
    serve({ units: [], orphans: [], complete: false }, false);
    render(<ModuleConnectorsPanel canMutate={false} component={module({
      assets: [{ asset_type: "3dmodel", name: "imu.step" }] as CatalogComponent["assets"],
      interface: { units: UNITS.slice(0, 1) },
    })} />);
    expect(screen.getByText("POWER")).toBeTruthy();
    expect(screen.getByText("unit A")).toBeTruthy();
    expect(screen.getByText("VIN")).toBeTruthy();
    expect(screen.getByText("unnamed")).toBeTruthy();
    expect(screen.queryByText(/No STEP model/)).toBeNull();
  });

  it("says what is missing", () => {
    serve({ units: [], orphans: [], complete: false }, false);
    render(<ModuleConnectorsPanel canMutate={false} component={module({ interface: { units: [], error: "the module has no symbol" } })} />);
    expect(screen.getByText(/the module has no symbol: attach a multi-unit symbol/)).toBeTruthy();
    expect(screen.getByText(/No STEP model yet/)).toBeTruthy();
  });

  it("shows where each connector is placed and offers to place the rest", async () => {
    serve({ units: [{ key: "A", name: "POWER", pads: ["1", "2"], connector: placedA },
      { key: "B", name: "AUX", pads: ["3"], connector: null }], orphans: ["C"], complete: false }, true);
    render(<ModuleConnectorsPanel canMutate component={module({
      assets: [{ asset_type: "3dmodel", name: "imu.step" }] as CatalogComponent["assets"], interface: { units: UNITS },
    })} />);
    expect(await screen.findByText(/HDR-1 on the \+Z face/)).toBeTruthy();
    expect(screen.getByRole("button", { name: /Edit placement/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Place connector/ })).toBeTruthy();
    expect(screen.getByText(/Place every connector before releasing/)).toBeTruthy();
    expect(screen.getByText(/units the symbol no longer has: C/)).toBeTruthy();
  });

  it("asks for a converted model before placing", async () => {
    serve({ units: [{ key: "A", name: "POWER", pads: ["1", "2"], connector: null }], orphans: [], complete: false }, false);
    render(<ModuleConnectorsPanel canMutate component={module({
      assets: [{ asset_type: "3dmodel", name: "imu.step" }] as CatalogComponent["assets"], interface: { units: UNITS.slice(0, 1) },
    })} />);
    expect(await screen.findByText(/Convert the STEP model/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Place connector/ })).toBeNull();
  });
});

describe("face labels", () => {
  it("names axis faces and spells out the rest", () => {
    expect(faceLabel([0, 0, 1])).toBe("+Z face");
    expect(faceLabel([-1, 0, 0])).toBe("−X face");
    expect(faceLabel([0.6, 0, 0.8])).toBe("face (0.600, 0.000, 0.800)");
  });
});
