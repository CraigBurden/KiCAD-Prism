import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StackupPanel } from "./stackup-panel";

describe("StackupPanel", () => {
    it("tells the reviewer to render the PCB when no stackup could be read", () => {
        const view = render(
            <StackupPanel
                stackup={{
                    base: [],
                    head: [],
                    baseSettings: {},
                    headSettings: {},
                    changed: false,
                    present: false,
                }}
            />,
        );

        expect(view.getByText("Stackup not available yet")).toBeTruthy();
        expect(view.getByText(/Render the PCB/)).toBeTruthy();
    });

    it("shows both stackups even when they are identical", () => {
        const layers = [{ name: "F.Cu", type: "copper", thicknessNm: 35000 }];
        const view = render(
            <StackupPanel
                stackup={{
                    base: layers,
                    head: layers,
                    baseSettings: {},
                    headSettings: {},
                    changed: false,
                    present: true,
                }}
            />,
        );

        expect(view.getByText("Stackup is identical in both revisions.")).toBeTruthy();
        expect(view.getAllByText("F.Cu")).toHaveLength(2);
    });

    it("owns the available workspace when displaying changed layers", () => {
        const view = render(
            <StackupPanel
                stackup={{
                    base: [{ name: "F.Cu", type: "copper", thicknessNm: 35000 }],
                    head: [{ name: "F.Cu", type: "copper", thicknessNm: 70000 }],
                    baseSettings: {},
                    headSettings: {},
                    changed: true,
                    present: true,
                }}
            />,
        );

        expect(view.container.firstElementChild?.className).toContain("flex-1");
        expect(view.getByText(/Stackup differs between revisions/)).toBeTruthy();
    });

    it("shows fabrication finish and dielectric material evidence", () => {
        const view = render(
            <StackupPanel
                stackup={{
                    base: [{
                        name: "dielectric 1",
                        type: "core",
                        thicknessNm: 1_200_000,
                        material: "FR4",
                        epsilonR: 4.2,
                        lossTangent: 0.02,
                    }],
                    head: [{
                        name: "dielectric 1",
                        type: "core",
                        thicknessNm: 1_200_000,
                        material: "Megtron 6",
                        epsilonR: 3.6,
                        lossTangent: 0.004,
                    }],
                    baseSettings: { copperFinish: "HASL", dielectricConstraints: false },
                    headSettings: { copperFinish: "ENIG", dielectricConstraints: true },
                    changed: true,
                    present: true,
                }}
            />,
        );

        expect(view.getByText("HASL")).toBeTruthy();
        expect(view.getByText("ENIG")).toBeTruthy();
        expect(view.getByText("FR4")).toBeTruthy();
        expect(view.getByText("Megtron 6")).toBeTruthy();
        expect(view.getByText("Disabled")).toBeTruthy();
        expect(view.getByText("Enabled")).toBeTruthy();
    });
});
