import { describe, expect, it } from "vitest";

import type { FabricationLayer, LayerRole, LayerSide } from "./types";
import {
    applyPreset,
    focusedOn,
    initialState,
    LAYER_PRESETS,
    paintOrder,
    presetFor,
    sideOf,
    soloStack,
    viewerReducer,
    type LayerPreset,
} from "./viewer-state";

function layer(id: string, role: LayerRole, side: LayerSide, file = `${id}.gbr`): FabricationLayer {
    return {
        id, name: id, function: "", role, side, colour: "#fff", file,
        kind: role === "drill" ? "excellon" : "gerber", warnings: [],
    };
}

const LAYERS = [
    layer("f.silk", "silk", "top"),
    layer("f.mask", "mask", "top"),
    layer("f.cu", "copper", "top"),
    layer("in1.cu", "copper", "inner"),
    layer("b.cu", "copper", "bottom"),
    layer("b.silk", "silk", "bottom"),
    layer("edge", "outline", "both"),
    layer("drill", "drill", "both", "board.drl"),
    layer("f.fab", "other", "top"),
];

describe("presetFor", () => {
    it("shows a side's copper and legend, the profile and the holes", () => {
        expect([...presetFor(LAYERS, "top")].sort()).toEqual(["drill", "edge", "f.cu", "f.silk"]);
        expect([...presetFor(LAYERS, "bottom")].sort()).toEqual(["b.cu", "b.silk", "drill", "edge"]);
    });

    it("leaves mask, paste, inner copper and other layers off", () => {
        const top = presetFor(LAYERS, "top");
        for (const id of ["f.mask", "in1.cu", "f.fab"]) expect(top.has(id)).toBe(false);
    });
});

describe("focusedOn", () => {
    it("is the one file plus the profile", () => {
        expect([...focusedOn(LAYERS, "f.mask.gbr")].sort()).toEqual(["edge", "f.mask"]);
    });

    it("is empty for a file the package does not hold", () => {
        expect(focusedOn(LAYERS, "missing.gbr").size).toBe(0);
    });
});

describe("sideOf", () => {
    it("defaults to top", () => {
        expect(sideOf(LAYERS)).toBe("top");
    });

    it("opens on the side of a focused bottom file", () => {
        expect(sideOf(LAYERS, "b.silk.gbr")).toBe("bottom");
    });

    it("opens a bottom-only package on the bottom", () => {
        expect(sideOf([layer("b.cu", "copper", "bottom")])).toBe("bottom");
    });
});

describe("initialState", () => {
    it("uses the preset when nothing is focused", () => {
        expect([...initialState(LAYERS).visible].sort()).toEqual(["drill", "edge", "f.cu", "f.silk"]);
    });

    it("falls back to the preset when the focused file is unknown", () => {
        expect(initialState(LAYERS, "missing.gbr").visible.has("f.cu")).toBe(true);
    });

    it("shows only the focused layer and the profile", () => {
        const state = initialState(LAYERS, "b.silk.gbr");
        expect(state.side).toBe("bottom");
        expect([...state.visible].sort()).toEqual(["b.silk", "edge"]);
    });
});

describe("viewerReducer", () => {
    const start = initialState(LAYERS);

    it("flipping the side restarts from that side's preset", () => {
        const next = viewerReducer(start, { type: "side", side: "bottom", layers: LAYERS });
        expect(next.side).toBe("bottom");
        expect(next.visible.has("b.cu")).toBe(true);
        expect(next.visible.has("f.cu")).toBe(false);
    });

    it("keeps manual choices when the side does not change", () => {
        const toggled = viewerReducer(start, { type: "toggle", id: "f.mask" });
        const same = viewerReducer(toggled, { type: "side", side: "top", layers: LAYERS });
        expect(same).toBe(toggled);
        expect(same.visible.has("f.mask")).toBe(true);
    });

    it("toggles a layer on and off without mutating the old state", () => {
        const on = viewerReducer(start, { type: "toggle", id: "f.mask" });
        const off = viewerReducer(on, { type: "toggle", id: "f.mask" });
        expect(on.visible.has("f.mask")).toBe(true);
        expect(off.visible.has("f.mask")).toBe(false);
        expect(start.visible.has("f.mask")).toBe(false);
    });

    it("Front and Back turn the board to that side; other presets keep it", () => {
        const back = viewerReducer(start, { type: "preset", preset: "back", layers: LAYERS });
        expect(back.side).toBe("bottom");
        expect(viewerReducer(back, { type: "preset", preset: "copper", layers: LAYERS }).side).toBe("bottom");
        expect(viewerReducer(back, { type: "preset", preset: "front", layers: LAYERS }).side).toBe("top");
    });

    it("a menu preset replaces the selection", () => {
        const copper = viewerReducer(start, { type: "preset", preset: "copper", layers: LAYERS });
        expect([...copper.visible].sort()).toEqual(["b.cu", "f.cu", "in1.cu"]);
        const none = viewerReducer(copper, { type: "preset", preset: "none", layers: LAYERS });
        expect(none.visible.size).toBe(0);
        const all = viewerReducer(none, { type: "preset", preset: "all", layers: LAYERS });
        expect(all.visible.size).toBe(LAYERS.length);
    });

    it("highlighting a layer picks it, and picking it again lets go", () => {
        const on = viewerReducer(start, { type: "highlight", id: "f.cu" });
        expect(on.highlighted).toBe("f.cu");
        expect(viewerReducer(on, { type: "highlight", id: "b.cu" }).highlighted).toBe("b.cu");
        expect(viewerReducer(on, { type: "highlight", id: "f.cu" }).highlighted).toBeNull();
    });
});

describe("applyPreset", () => {
    const ids = (preset: LayerPreset) => [...applyPreset(LAYERS, preset)].sort();

    it("front and back are a side's layers with the profile and the holes", () => {
        expect(ids("front")).toEqual(["drill", "edge", "f.cu", "f.fab", "f.mask", "f.silk"]);
        expect(ids("back")).toEqual(["b.cu", "b.silk", "drill", "edge"]);
    });

    it("copper presets split outer from inner", () => {
        expect(ids("copper")).toEqual(["b.cu", "f.cu", "in1.cu"]);
        expect(ids("outer-copper")).toEqual(["b.cu", "f.cu"]);
        expect(ids("inner-copper")).toEqual(["in1.cu"]);
    });

    it("drawings are the user layers and the profile", () => {
        expect(ids("drawings")).toEqual(["edge", "f.fab"]);
    });

    it("lists the same presets, in the same order, as the Visualizer's menu", () => {
        expect(LAYER_PRESETS.map(([, label]) => label)).toEqual([
            "Front", "Back", "All copper", "Outer copper", "Inner copper", "Drawings", "Show all", "Hide all",
        ]);
    });
});

describe("viewerReducer, parts", () => {
    const start = initialState(LAYERS);

    it("starts with markers on and nothing selected", () => {
        expect(start.showParts).toBe(true);
        expect(start.selected).toBeNull();
    });

    it("toggles the markers", () => {
        const off = viewerReducer(start, { type: "parts" });
        expect(off.showParts).toBe(false);
        expect(viewerReducer(off, { type: "parts" }).showParts).toBe(true);
    });

    it("selecting a part on the shown side keeps the layers as they are", () => {
        const custom = viewerReducer(start, { type: "toggle", id: "f.mask" });
        const next = viewerReducer(custom, { type: "select", ref: "R1", side: "top", layers: LAYERS });
        expect(next.selected).toBe("R1");
        expect(next.visible.has("f.mask")).toBe(true);
    });

    it("selecting a part on the other side turns the board over to it", () => {
        const next = viewerReducer(start, { type: "select", ref: "R9", side: "bottom", layers: LAYERS });
        expect(next.side).toBe("bottom");
        expect(next.visible.has("b.cu")).toBe(true);
        expect(next.selected).toBe("R9");
    });

    it("selecting brings the markers back, and null clears the selection", () => {
        const off = viewerReducer(start, { type: "parts" });
        const picked = viewerReducer(off, { type: "select", ref: "R1", side: "top", layers: LAYERS });
        expect(picked.showParts).toBe(true);
        expect(viewerReducer(picked, { type: "select", ref: null, layers: LAYERS }).selected).toBeNull();
    });

    it("flipping the side by hand keeps the selection", () => {
        const picked = viewerReducer(start, { type: "select", ref: "R1", side: "top", layers: LAYERS });
        expect(viewerReducer(picked, { type: "side", side: "bottom", layers: LAYERS }).selected).toBe("R1");
    });
});

describe("paintOrder", () => {
    const names = (layers: FabricationLayer[], side: "top" | "bottom") =>
        paintOrder(layers, side).map((item) => item.id);
    const board = [
        layer("b.silk", "silk", "bottom"),
        layer("b.cu", "copper", "bottom"),
        layer("b.mask", "mask", "bottom"),
        layer("in1.cu", "copper", "inner"),
        layer("f.cu", "copper", "top"),
        layer("f.mask", "mask", "top"),
        layer("f.silk", "silk", "top"),
    ];

    it("from the top, paints the far side first and the top silkscreen last", () => {
        expect(names(board, "top")).toEqual(["b.silk", "b.mask", "b.cu", "in1.cu", "f.cu", "f.mask", "f.silk"]);
    });

    it("from the bottom, the bottom side is nearest", () => {
        expect(names(board, "bottom")).toEqual(["f.silk", "f.mask", "f.cu", "in1.cu", "b.cu", "b.mask", "b.silk"]);
    });

    it("puts annotation, then the profile, then the holes over all of it, from either side", () => {
        const all = [
            layer("drill", "drill", "both"),
            layer("f.fab", "other", "top"),
            layer("edge", "outline", "both"),
            ...board,
        ];
        for (const side of ["top", "bottom"] as const) {
            expect(names(all, side).slice(-3)).toEqual(["f.fab", "edge", "drill"]);
        }
    });

    it("does not change the list it is given", () => {
        const before = board.map((item) => item.id);
        paintOrder(board, "top");
        expect(board.map((item) => item.id)).toEqual(before);
    });

    it("keeps the listed order between layers at the same depth", () => {
        const twins = [layer("a", "other", "top"), layer("b", "other", "bottom"), layer("c", "other", "both")];
        expect(names(twins, "top")).toEqual(["a", "b", "c"]);
    });
});

describe("soloStack", () => {
    it("is the picked layer with the profile over it", () => {
        const layers = [layer("f.cu", "copper", "top"), layer("edge", "outline", "both"), layer("drill", "drill", "both")];
        expect(soloStack(layers, layers[0]!).map((item) => item.id)).toEqual(["f.cu", "edge"]);
    });
});
