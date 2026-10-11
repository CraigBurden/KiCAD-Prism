import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fetchJson } from "@/lib/api";
import { ProjectDetailPage } from "./ProjectDetailPage";

vi.mock("@/lib/api", () => ({
    fetchJson: vi.fn(),
    fetchApi: vi.fn(),
    readApiError: vi.fn(),
}));

vi.mock("@/features/system-builder/used-in-panel", () => ({ UsedInPanel: () => null }));
vi.mock("@/components/markdown-content", () => ({ MarkdownContent: () => null }));
vi.mock("@/components/release-studio/ReleaseStudioPanel", () => ({ ReleaseStudioPanel: () => null }));

const BRANCHES = {
    branches: [
        { name: "main", ref: "main", source: "local", is_current: true, hash: "a1", commit: "a1" },
    ],
};

function branchRequests(): number {
    return vi.mocked(fetchJson).mock.calls.filter(([url]) => String(url).endsWith("/branches")).length;
}

function renderPage() {
    return render(
        <MemoryRouter initialEntries={["/project/p1"]}>
            <Routes>
                <Route path="/project/:projectId" element={<ProjectDetailPage user={null} />} />
            </Routes>
        </MemoryRouter>,
    );
}

describe("ProjectDetailPage branch polling", () => {
    beforeEach(() => {
        vi.mocked(fetchJson).mockImplementation(async (input) => {
            const url = String(input);
            if (url.endsWith("/branches")) return BRANCHES;
            if (url.includes("/overview")) {
                return {
                    project: { id: "p1", name: "Board", description: "", path: "", last_modified: "" },
                    readme: null,
                };
            }
            throw new Error(`unrouted ${url}`);
        });
    });

    afterEach(() => {
        vi.mocked(fetchJson).mockReset();
    });

    it.fails("keeps one branch poller across section switches", async () => {
        renderPage();
        await screen.findAllByText("Board");
        await waitFor(() => expect(branchRequests()).toBe(1));

        const workflows = screen.getAllByRole("button", { name: /Workflows/ })[0];
        fireEvent.click(workflows);
        await screen.findByRole("heading", { name: "Workflows" });
        const overview = screen.getAllByRole("button", { name: /Overview/ })[0];
        fireEvent.click(overview);
        await new Promise((resolve) => setTimeout(resolve, 20));

        expect(branchRequests()).toBe(1);
    });
});
