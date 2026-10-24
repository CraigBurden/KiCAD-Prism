/**
 * #698 D3: a tick acknowledges one build's unpinned 3D models, never the next
 * build selected in the same panel.
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PublishStep } from "./PublishStep";
import type { BuildDetail, ReleaseBuild, UnpinnedModel } from "../types";

function model(reference: string): UnpinnedModel {
    return {
        key: `board.kicad_pcb::${reference}`,
        source_path: "board.kicad_pcb",
        reference,
        location: "unreadable",
    };
}

function buildDetail(buildId: string, unpinned: UnpinnedModel[]): BuildDetail {
    return {
        build: { id: buildId, status: "succeeded" } as ReleaseBuild,
        configuration: { revision: "v1.0.0" } as BuildDetail["configuration"],
        members: [],
        evidence: [],
        fingerprints: {},
        approvals: {
            designer: null,
            qa: null,
            both_approved: true,
            published: null,
            electrical_errors: [],
            can_approve_designer: false,
            can_approve_qa: false,
            can_withdraw: false,
            can_publish: true,
            blocked_reason: "",
            unpinned_models: unpinned,
        },
    };
}

function step(detail: BuildDetail) {
    return <PublishStep projectId="p1" detail={detail} canMutate busy="" onRun={vi.fn()} />;
}

const publishButton = () => screen.getByRole("button", { name: /Hold to publish/i });
const acknowledge = () => screen.getByRole("checkbox", { name: /Acknowledge/i });

describe("PublishStep acknowledgement", () => {
    afterEach(cleanup);

    it("does not carry a tick from one build to another", () => {
        const { rerender } = render(step(buildDetail("build-a", [model("a.step")])));
        expect(publishButton()).toBeDisabled();
        fireEvent.click(acknowledge());
        expect(publishButton()).not.toBeDisabled();

        rerender(step(buildDetail("build-b", [model("b.step")])));
        expect(publishButton()).toBeDisabled();
        expect(acknowledge()).not.toBeChecked();

        // The same list on another build is still another build's acknowledgement.
        rerender(step(buildDetail("build-c", [model("b.step")])));
        expect(publishButton()).toBeDisabled();
    });

    it("drops the tick when the build's list changes", () => {
        const { rerender } = render(step(buildDetail("build-a", [model("a.step")])));
        fireEvent.click(acknowledge());
        rerender(step(buildDetail("build-a", [model("a.step"), model("c.step")])));
        expect(publishButton()).toBeDisabled();
    });
});
