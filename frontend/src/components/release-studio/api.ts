import { fetchJson, fetchApi } from "@/lib/api";

import type {
    Approval,
    AuditEvent,
    BuildDetail,
    ReleaseCandidate,
    ReleaseConfiguration,
    ReleaseRecord,
    VerificationReport,
    Waiver,
} from "./types";

const base = (projectId: string) =>
    `/api/projects/${encodeURIComponent(projectId)}/release-studio`;

export async function listConfigurations(
    projectId: string,
): Promise<ReleaseConfiguration[]> {
    const data = await fetchJson<{ configurations: ReleaseConfiguration[] }>(
        `${base(projectId)}/configurations`,
        undefined,
        "Could not load release configurations",
    );
    return data.configurations ?? [];
}

export async function listCandidates(
    projectId: string,
    configKey?: string,
): Promise<ReleaseCandidate[]> {
    const query = configKey ? `?config_key=${encodeURIComponent(configKey)}` : "";
    const data = await fetchJson<{ candidates: ReleaseCandidate[] }>(
        `${base(projectId)}/candidates${query}`,
        undefined,
        "Could not load release candidates",
    );
    return data.candidates ?? [];
}

export async function startBuild(
    projectId: string,
    body: { config_key: string; commit_sha: string; variant: string },
): Promise<{ job: { job_id: string } }> {
    return fetchJson(
        `${base(projectId)}/candidates`,
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        },
        "Could not start the build",
    );
}

export async function getBuild(projectId: string, buildId: string): Promise<BuildDetail> {
    return fetchJson(
        `${base(projectId)}/builds/${encodeURIComponent(buildId)}`,
        undefined,
        "Could not load the build",
    );
}

export async function evaluateBuild(
    projectId: string,
    buildId: string,
    configKey: string,
): Promise<{ outcome: string }> {
    return fetchJson(
        `${base(projectId)}/builds/${encodeURIComponent(buildId)}/evaluate`,
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ config_key: configKey }),
        },
        "Could not evaluate the build",
    );
}

export async function listWaivers(projectId: string, configKey: string): Promise<Waiver[]> {
    const data = await fetchJson<{ waivers: Waiver[] }>(
        `${base(projectId)}/waivers?config_key=${encodeURIComponent(configKey)}`,
        undefined,
        "Could not load waivers",
    );
    return data.waivers ?? [];
}

export async function createWaiver(
    projectId: string,
    body: Record<string, unknown>,
): Promise<Waiver> {
    return fetchJson(
        `${base(projectId)}/waivers`,
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        },
        "Could not create the waiver",
    );
}

export async function transitionWaiver(
    projectId: string,
    waiverId: string,
    action: "approve" | "reject" | "revoke",
    reason = "",
    exception?: { exception_kind: "self_approval"; exception_reason: string },
): Promise<Waiver> {
    return fetchJson(
        `${base(projectId)}/waivers/${encodeURIComponent(waiverId)}/${action}`,
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ reason, ...(exception ?? {}) }),
        },
        "Could not update the waiver",
    );
}

export async function createApproval(
    projectId: string,
    buildId: string,
    body: Record<string, unknown>,
): Promise<Approval> {
    return fetchJson(
        `${base(projectId)}/builds/${encodeURIComponent(buildId)}/approvals`,
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        },
        "Could not record the approval",
    );
}

export async function createRelease(
    projectId: string,
    buildId: string,
    body: { release_label: string; document_number: string; revision: string },
): Promise<ReleaseRecord> {
    return fetchJson(
        `${base(projectId)}/builds/${encodeURIComponent(buildId)}/release`,
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        },
        "Could not create the release",
    );
}

export async function listRecords(projectId: string): Promise<ReleaseRecord[]> {
    const data = await fetchJson<{ records: ReleaseRecord[] }>(
        `${base(projectId)}/records`,
        undefined,
        "Could not load release records",
    );
    return data.records ?? [];
}

export async function verifyRecord(
    projectId: string,
    recordId: string,
): Promise<VerificationReport> {
    return fetchJson(
        `${base(projectId)}/records/${encodeURIComponent(recordId)}/verify`,
        { method: "POST" },
        "Could not verify the release",
    );
}

export async function listAudit(projectId: string, configKey: string): Promise<AuditEvent[]> {
    const data = await fetchJson<{ events: AuditEvent[] }>(
        `${base(projectId)}/audit?config_key=${encodeURIComponent(configKey)}`,
        undefined,
        "Could not load the audit trail",
    );
    return data.events ?? [];
}

export async function verifyAudit(
    projectId: string,
    configKey: string,
): Promise<{ ok: boolean; events: number; problems: string[] }> {
    return fetchJson(
        `${base(projectId)}/audit/verify?config_key=${encodeURIComponent(configKey)}`,
        undefined,
        "Could not verify the audit chain",
    );
}

export function downloadUrl(projectId: string, path: string): string {
    return `${base(projectId)}/${path}`;
}

/**
 * Fetch one released member as an object URL for inline display.
 *
 * The bytes go through `fetchApi` rather than a bare `<img src>`/`<iframe src>`
 * so the request carries credentials and a non-200 surfaces as an error instead
 * of a silently broken frame. Callers must revoke the URL when done.
 */
export async function memberObjectUrl(
    projectId: string,
    buildId: string,
    memberPath: string,
): Promise<{ url: string; mediaType: string }> {
    const encoded = memberPath.split("/").map(encodeURIComponent).join("/");
    const response = await fetchApi(
        `${base(projectId)}/builds/${encodeURIComponent(buildId)}/members/${encoded}`,
    );
    if (!response.ok) {
        let detail = `Could not load ${memberPath} (${response.status})`;
        try {
            const body = await response.json();
            if (body?.detail) detail = body.detail;
        } catch {
            // A non-JSON error body leaves the status-derived message in place.
        }
        throw new Error(detail);
    }
    const blob = await response.blob();
    return { url: URL.createObjectURL(blob), mediaType: blob.type };
}

export async function downloadFile(url: string, filename: string): Promise<void> {
    const response = await fetchApi(url);
    if (!response.ok) throw new Error(`Download failed (${response.status})`);
    const blob = await response.blob();
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(href);
}
