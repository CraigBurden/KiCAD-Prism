import { fetchJson, fetchApi } from "@/lib/api";

import type {
    Approval,
    AuditEvent,
    BuildDetail,
    DocumentSheet,
    OrganizationPolicy,
    PolicyVersion,
    ReleaseCandidate,
    ReleaseConfiguration,
    ReleaseRecord,
    RuleCatalogueEntry,
    VerificationReport,
    Waiver,
    WebReleaseShare,
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

export async function listDocumentSheets(
    projectId: string,
    buildId: string,
): Promise<DocumentSheet[]> {
    const data = await fetchJson<{ sheets: DocumentSheet[] }>(
        `${base(projectId)}/builds/${encodeURIComponent(buildId)}/sheets`,
        undefined,
        "Could not load documentation sheets",
    );
    return data.sheets ?? [];
}

export async function sheetObjectUrl(
    projectId: string,
    buildId: string,
    sheetKey: string,
): Promise<string> {
    const response = await fetchApi(
        `${base(projectId)}/builds/${encodeURIComponent(buildId)}`
            + `/sheets/${encodeURIComponent(sheetKey)}.pdf`,
    );
    if (!response.ok) throw new Error(`Could not load ${sheetKey} (${response.status})`);
    return URL.createObjectURL(await response.blob());
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
    body: {
        release_label: string;
        document_number: string;
        revision: string;
        override_blockers?: boolean;
        override_reason?: string;
    },
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

export async function createWebRelease(
    projectId: string,
    recordId: string,
    expiresAt: string | null = null,
): Promise<{ share: WebReleaseShare; token: string; url: string }> {
    return fetchJson(
        `${base(projectId)}/records/${encodeURIComponent(recordId)}/web-release`,
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ expires_at: expiresAt }),
        },
        "Could not create the public release link",
    );
}

export async function listWebReleases(
    projectId: string,
    recordId: string,
): Promise<WebReleaseShare[]> {
    const data = await fetchJson<{ shares: WebReleaseShare[] }>(
        `${base(projectId)}/records/${encodeURIComponent(recordId)}/web-releases`,
        undefined,
        "Could not load public release links",
    );
    return data.shares ?? [];
}

export async function revokeWebRelease(
    projectId: string,
    shareId: string,
): Promise<WebReleaseShare> {
    return fetchJson(
        `${base(projectId)}/web-releases/${encodeURIComponent(shareId)}/revoke`,
        { method: "POST" },
        "Could not revoke the public release link",
    );
}

const policyBase = "/api/release-policies";

export async function ruleCatalogue(): Promise<RuleCatalogueEntry[]> {
    const data = await fetchJson<{ rules: RuleCatalogueEntry[] }>(
        `${policyBase}/catalogue`, undefined, "Could not load the rule catalogue",
    );
    return data.rules ?? [];
}

export async function listOrganizationPolicies(): Promise<OrganizationPolicy[]> {
    const data = await fetchJson<{ policies: OrganizationPolicy[] }>(
        policyBase, undefined, "Could not load organization policies",
    );
    return data.policies ?? [];
}

export async function getOrganizationPolicy(key: string): Promise<OrganizationPolicy> {
    return fetchJson(`${policyBase}/${encodeURIComponent(key)}`, undefined, "Could not load the policy");
}

export async function createOrganizationPolicy(
    policyKey: string,
    title: string,
): Promise<OrganizationPolicy> {
    return fetchJson(policyBase, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ policy_key: policyKey, title }),
    }, "Could not create the policy");
}

export async function createPolicyVersion(
    policyKey: string,
    document: Record<string, unknown>,
): Promise<PolicyVersion> {
    return fetchJson(`${policyBase}/${encodeURIComponent(policyKey)}/versions`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ document }),
    }, "Could not create the policy draft");
}

export async function publishPolicyVersion(policyKey: string, version: number): Promise<PolicyVersion> {
    return fetchJson(`${policyBase}/${encodeURIComponent(policyKey)}/versions/${version}/publish`, { method: "POST" }, "Could not publish the policy version");
}

export async function policyVersionDiff(policyKey: string, from: number, to: number) {
    return fetchJson<{ changes: Array<{ path: string; change: string; before?: unknown; after?: unknown }> }>(
        `${policyBase}/${encodeURIComponent(policyKey)}/diff?from=${from}&to=${to}`,
        undefined,
        "Could not compare policy versions",
    );
}

export async function previewPolicyInheritance(overlay: Record<string, unknown>) {
    return fetchJson<{ links: Array<{ source: string; content_digest: string }>; rules: Array<Record<string, unknown>>; required_approvals: Array<Record<string, unknown>>; policy_binding_digest: string }>(
        `${policyBase}/preview/inheritance`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ overlay }) },
        "Could not preview policy inheritance",
    );
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
