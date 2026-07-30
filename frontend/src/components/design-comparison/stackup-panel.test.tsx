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
                    changed: false,
                    present: false,
                }}
            />,
        );

        expect(view.getByText("Stackup not available yet")).toBeTruthy();
        expect(view.getByText(/Render the PCB/)).toBeTruthy();
    });

    it("shows both stackups even when they are identical", () => {
        const layers = [{ name: "F.Cu", type: "copper", thickness: 0.035 }];
        const view = render(
            <StackupPanel
                stackup={{
                    base: layers,
                    head: layers,
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
                    base: [{ name: "F.Cu", type: "copper", thickness: 0.035 }],
                    head: [{ name: "F.Cu", type: "copper", thickness: 0.07 }],
                    changed: true,
                    present: true,
                }}
            />,
        );

        expect(view.container.firstElementChild?.className).toContain("flex-1");
        expect(view.getByText(/Stackup differs between revisions/)).toBeTruthy();
    });
});
