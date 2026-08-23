import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api", () => ({
    fetchJson: vi.fn(),
    fetchApi: vi.fn(),
    readApiError: vi.fn(async () => "error"),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import { fetchJson } from "@/lib/api";
import { LibraryComponentWorkspace } from "./library-component-workspace";

// Every tab's evidence is stored as one value carrying the component
// generation it was loaded for, and useEvidenceResource treats a result from
// an older generation as nothing loaded. Both halves matter: without the
// generation on the value the previous component's revisions stay on screen,
// and without it on the load state the status is still "loaded" so the new
// component is never fetched at all. A single reset effect used to stand in
// for both, and this is what it was protecting.

function component(id: string) {
    return {
        id, slug: id, name: id.toUpperCase(), mpn: `MPN-${id}`, value: "10k",
        workflow_stage: "draft", revision: 1, revision_id: `${id}-rev1`,
        parent_revision_id: "", version: 1, assets: [], representations: [],
        extra: {}, availability_state: "active", validation_status: "unknown",
        identity_kind: "mpn", source: "manual", preview_status: {},
        previews: [],
        validation: { status: "unknown", error_count: 0, warning_count: 0 },
    };
}

function revision(id: string, summary: string) {
    return {
        id: `${id}-rev1`, version: 1, release_status: "draft",
        created_at: "2026-08-01T00:00:00Z", created_by: "someone",
        change_summary: summary, change_kind: "metadata",
    };
}

function routeFor(id: string) {
    return (url: string) => {
        if (url === `/api/catalog/components/${id}`) return component(id);
        if (url === `/api/catalog/components/${id}/revisions`) {
            return { items: [revision(id, `history for ${id}`)] };
        }
        return { items: [] };
    };
}

function install(...ids: string[]) {
    const routes = ids.map(routeFor);
    vi.mocked(fetchJson).mockImplementation(async (input) => {
        const url = String(input);
        for (const route of routes) {
            const hit = route(url);
            if (hit) return hit as never;
        }
        // Anything this test has not taught the mock is a bug in the test, not
        // an empty response the component should have to cope with.
        throw new Error(`unrouted request: ${url}`);
    });
}

function Harness({ componentId }: { componentId: string }) {
    return (
        <MemoryRouter initialEntries={["/?section=library-manager&componentTab=revisions"]}>
            <LibraryComponentWorkspace
                componentId={componentId}
                user={{ id: "u1", email: "a@b.c", role: "admin" } as never}
                projects={[]}
                onBack={vi.fn()}
            />
        </MemoryRouter>
    );
}

function renderWorkspace(componentId: string) {
    return render(<Harness componentId={componentId} />);
}

beforeEach(() => install("comp-a", "comp-b"));
afterEach(() => vi.clearAllMocks());

describe("component evidence across generations", () => {
    it("loads the evidence for the component it is showing", async () => {
        renderWorkspace("comp-a");
        expect(await screen.findByText("history for comp-a")).toBeInTheDocument();
    });


});
