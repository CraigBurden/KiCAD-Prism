import { beforeEach, describe, expect, it, vi } from "vitest";

import { fetchJson } from "@/lib/api";
import { throwIfJobFailed, watchPrismJob } from "@/lib/jobs";

import { saveConfiguration } from "./api";
import type { EditableReleaseConfiguration } from "./types";

vi.mock("@/lib/api", () => ({
    fetchJson: vi.fn(),
    fetchApi: vi.fn(),
}));

vi.mock("@/lib/jobs", () => ({
    watchPrismJob: vi.fn(),
    throwIfJobFailed: vi.fn(),
}));

const configuration: EditableReleaseConfiguration = {
    schema: "prism.release-studio.configuration/1",
    title: "Production",
    board: "board.kicad_pcb",
    schematic: "board.kicad_sch",
    jobset: "Outputs.kicad_jobset",
    default_variant: "",
    fields: {},
    notes: {},
    variants: [],
    vendors: [],
};

describe("Release Studio configuration publication", () => {
    beforeEach(() => {
        vi.mocked(fetchJson).mockReset();
        vi.mocked(watchPrismJob).mockReset();
        vi.mocked(throwIfJobFailed).mockReset();
    });

    it("binds the publish to the displayed base and returns the remote-backed commit", async () => {
        const base = "a".repeat(40);
        const published = "b".repeat(40);
        vi.mocked(fetchJson).mockResolvedValue({ job: { job_id: "job-publish" } });
        vi.mocked(watchPrismJob).mockResolvedValue({
            job_id: "job-publish",
            kind: "release_studio_configuration_publish",
            status: "completed",
            stage: "completed",
            message: "Published",
            percent: 100,
            result_metadata: {
                configuration: {
                    config_key: "default",
                    title: "Production",
                    board_rel: "board.kicad_pcb",
                    schematic_rel: "board.kicad_sch",
                    jobset_rel: "Outputs.kicad_jobset",
                    default_variant: "",
                },
                commit_sha: published,
                path: ".prism/release-studio/configurations/default.yaml",
            },
        });

        const result = await saveConfiguration("project", "default", configuration, base);

        expect(fetchJson).toHaveBeenCalledWith(
            "/api/projects/project/release-studio/configurations/default",
            expect.objectContaining({
                method: "PUT",
                body: JSON.stringify({
                    configuration,
                    base_commit_sha: base,
                    commit: true,
                }),
            }),
            "Could not save the release configuration",
        );
        expect(watchPrismJob).toHaveBeenCalledWith("job-publish");
        expect(throwIfJobFailed).toHaveBeenCalled();
        expect(result.commit_sha).toBe(published);
    });
});
