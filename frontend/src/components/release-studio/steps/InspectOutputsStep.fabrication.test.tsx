/**
 * Gerber and drill members open in the Gerber viewer; the rest stay text.
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { BuildDetail } from "../types";
import { InspectOutputsStep } from "./InspectOutputsStep";

vi.mock("../api", () => ({
    listDocumentSheets: vi.fn(async () => []),
    memberObjectUrl: vi.fn(async () => ({ url: "blob:text", mediaType: "text/plain" })),
    dossierDownloadUrl: vi.fn(() => "/dossier"),
    buildEvidenceDownloadUrl: vi.fn(() => "/evidence"),
    downloadFile: vi.fn(),
    downloadUrl: vi.fn(() => "/x"),
}));

vi.mock("@/components/fabrication-viewer/fabrication-viewer", () => ({
    FabricationViewer: ({ source, focusFile }: { source: { viewUrl: string }; focusFile?: string }) => (
        <div data-testid="viewer" data-url={source.viewUrl} data-focus={focusFile ?? ""} />
    ),
}));

function member(path: string) {
    return {
        path,
        released_digest: "a".repeat(64),
        media_type: "text/plain",
        domains: ["bare_board"],
    };
}

function detailWith(paths: string[]): BuildDetail {
    return {
        build: { id: "b1" },
        members: paths.map(member),
        evidence: [],
        approvals: undefined,
        vendor_readiness: [],
    } as unknown as BuildDetail;
}

function renderStep(paths: string[]) {
    render(
        <InspectOutputsStep
            projectId="p1"
            detail={detailWith(paths)}
            profiles={[]}
            busy=""
            onContinue={vi.fn()}
            onRun={vi.fn()}
        />,
    );
}

const openMembers = () => fireEvent.mouseDown(screen.getByRole("tab", { name: /Members/ }), { button: 0 });

describe("Inspect outputs, fabrication", () => {
    it("has no Fabrication tab when the build kept no layer files", async () => {
        renderStep(["assembly/bom.csv"]);
        await waitFor(() => expect(screen.getByRole("tab", { name: /Members/ })).toBeInTheDocument());
        expect(screen.queryByRole("tab", { name: "Gerber" })).not.toBeInTheDocument();
    });

    it("offers the viewer as a tab", async () => {
        renderStep(["fabrication/gerbers/board-F_Cu.gtl"]);
        fireEvent.mouseDown(await screen.findByRole("tab", { name: "Gerber" }), { button: 0 });
        const viewer = await screen.findByTestId("viewer");
        expect(viewer).toHaveAttribute(
            "data-url",
            "/api/projects/p1/release-studio/builds/b1/fabrication-view",
        );
        expect(viewer).toHaveAttribute("data-focus", "");
    });

    it("opens a clicked Gerber member in the viewer, on that file", async () => {
        renderStep(["fabrication/gerbers/board-F_Cu.gtl", "assembly/bom.csv"]);
        openMembers();
        fireEvent.click(await screen.findByText("fabrication/gerbers/board-F_Cu.gtl"));
        const viewer = await screen.findByTestId("viewer");
        expect(viewer).toHaveAttribute("data-focus", "board-F_Cu.gtl");
    });

    it("opens a drill member in the viewer too", async () => {
        renderStep(["fabrication/drill/board.drl"]);
        openMembers();
        fireEvent.click(await screen.findByText("fabrication/drill/board.drl"));
        expect(await screen.findByTestId("viewer")).toHaveAttribute("data-focus", "board.drl");
    });

    it("keeps other members, and the Gerber job file, as text", async () => {
        renderStep(["fabrication/gerbers/board-job.gbrjob", "assembly/bom.csv"]);
        openMembers();
        fireEvent.click(await screen.findByText("assembly/bom.csv"));
        expect(screen.queryByTestId("viewer")).not.toBeInTheDocument();
        fireEvent.click(screen.getByText("fabrication/gerbers/board-job.gbrjob"));
        expect(screen.queryByTestId("viewer")).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /as text/ })).not.toBeInTheDocument();
    });

    it("still lets a layer file be read as text", async () => {
        renderStep(["fabrication/gerbers/board-F_Cu.gtl"]);
        openMembers();
        fireEvent.click(await screen.findByRole("button", { name: "View fabrication/gerbers/board-F_Cu.gtl as text" }));
        expect(screen.queryByTestId("viewer")).not.toBeInTheDocument();
        await waitFor(() => expect(screen.getAllByText("fabrication/gerbers/board-F_Cu.gtl").length).toBeGreaterThan(1));
    });
});
