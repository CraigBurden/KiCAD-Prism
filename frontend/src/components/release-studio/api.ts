import { fetchJson, fetchApi } from "@/lib/api";

import type {
    Approval,
    AuditEvent,
    BuildDetail,
    ReleaseCandidate,
    ReleaseRecord,
    VerificationReport,
    Waiver,
} from "./types";

const base = (projectId: string) =>
    `/api/projects/${encodeURIComponent(projectId)}/release-studio`;

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
): Promise<Waiver> {
    return fetchJson(
        `${base(projectId)}/waivers/${encodeURIComponent(waiverId)}/${action}`,
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ reason }),
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
