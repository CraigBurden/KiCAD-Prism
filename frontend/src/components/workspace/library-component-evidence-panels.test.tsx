import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AuditPanel } from "./library-component-evidence-panels";

// A revision manifest or asset file mismatch fails verification without naming
// an event, so the panel must name that record rather than print an empty id.

function failed(overrides: Record<string, unknown>) {
    return {
        valid: false, event_count: 2, verified_count: 2,
        first_invalid_event_id: "", head_hash: "abc", ...overrides,
    };
}

function renderAudit(verification: ReturnType<typeof failed>) {
    return render(<AuditPanel events={[]} verification={verification} releases={[]} reviews={[]} />);
}

describe("AuditPanel verification failure", () => {
    it("names the asset when an asset file is missing or changed", () => {
        renderAudit(failed({ reason: "asset_content_mismatch", first_invalid_asset_id: "asset-7" }));
        expect(screen.getByText("Asset file missing or changed: asset-7")).toBeInTheDocument();
        expect(screen.queryByText(/First invalid event/)).not.toBeInTheDocument();
    });

    it("names the revision when its manifest does not match", () => {
        renderAudit(failed({ reason: "revision_manifest_mismatch", first_invalid_revision_id: "rev-4" }));
        expect(screen.getByText("Revision manifest mismatch: rev-4")).toBeInTheDocument();
        expect(screen.queryByText(/First invalid event/)).not.toBeInTheDocument();
    });

    it("says no events are recorded when the chain is empty", () => {
        renderAudit(failed({ reason: "missing_audit_events", event_count: 0, verified_count: 0, head_hash: "" }));
        expect(screen.getByText("No audit events recorded")).toBeInTheDocument();
        expect(screen.queryByText(/First invalid event/)).not.toBeInTheDocument();
    });

    it("shows the anchored head when the chain head does not match it", () => {
        renderAudit(failed({ reason: "audit_head_mismatch", anchored_head_hash: "def" }));
        expect(screen.getByText("Audit head does not match the anchored head: def")).toBeInTheDocument();
        expect(screen.queryByText(/First invalid event/)).not.toBeInTheDocument();
    });

    it("names the event when an event breaks the chain", () => {
        renderAudit(failed({ reason: "audit_hash_mismatch", first_invalid_event_id: "event-3" }));
        expect(screen.getByText("First invalid event: event-3")).toBeInTheDocument();
    });
});
