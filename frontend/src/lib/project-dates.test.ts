import { describe, expect, it } from "vitest";

import { projectLastUpdated } from "./project-dates";

const format = (value: string) =>
    new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

describe("projectLastUpdated", () => {
    it("shows the repository sync time", () => {
        expect(projectLastUpdated({
            last_modified: "2026-09-11T08:34:47.241859+00:00",
            last_synced_at: "2026-09-25T21:20:28.872598+00:00",
        })).toBe(format("2026-09-25T21:20:28.872598+00:00"));
    });

    it("falls back to the registration time before the first sync", () => {
        expect(projectLastUpdated({ last_modified: "2026-09-11T08:34:47+00:00", last_synced_at: null }))
            .toBe(format("2026-09-11T08:34:47+00:00"));
    });

    it("passes through values that are not dates", () => {
        expect(projectLastUpdated({ last_modified: "Unknown" })).toBe("Unknown");
    });
});
