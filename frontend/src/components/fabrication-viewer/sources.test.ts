import { describe, expect, it } from "vitest";

import { holdsLayers, isLayerName } from "./sources";

type Entry = { name: string; isDir: boolean; children: Entry[] };

const file = (name: string): Entry => ({ name, isDir: false, children: [] });
const folder = (name: string, children: Entry[]): Entry => ({ name, isDir: true, children });

describe("holdsLayers", () => {
    it("finds a layer in a subfolder within the package depth", () => {
        expect(holdsLayers([folder("drill-data", [file("board.drl")])])).toBe(true);
        expect(holdsLayers([folder("a", [folder("b", [folder("c", [folder("d", [file("board.drl")])])])])])).toBe(false);
    });

    it("skips hidden entries, as the backend does", () => {
        expect(holdsLayers([folder(".old", [file("board-F_Cu.gbr")])])).toBe(false);
        expect(holdsLayers([file(".board-F_Cu.gbr")])).toBe(false);
    });

    it("does not count a drill map or the job file as a layer", () => {
        expect(isLayerName("board-PTH-drl_map.gbr")).toBe(false);
        expect(isLayerName("board-job.gbrjob")).toBe(false);
        expect(holdsLayers([file("board-PTH-drl_map.gbr"), file("board-job.gbrjob")])).toBe(false);
    });
});
