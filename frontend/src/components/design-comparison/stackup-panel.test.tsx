import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StackupPanel } from "./stackup-panel";

describe("StackupPanel", () => {
    it("treats two revisions without an explicit stackup as no change", () => {
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

        expect(view.getByText("No stackup changes detected")).toBeTruthy();
        expect(view.queryByText(/No stackup data available/i)).toBeNull();
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
