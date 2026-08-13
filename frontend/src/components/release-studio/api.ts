import { fetchJson, fetchApi } from "@/lib/api";
import { throwIfJobFailed, watchPrismJob } from "@/lib/jobs";

import type {
    BuildDetail,
    BuildLogIndex,
    DocumentSheet,
    ReleaseCandidate,
    ReleaseConfiguration,
    ManufacturingChoices,
    VendorProfile,
    ProjectCommit,
    EditableReleaseConfiguration,
    SavedReleaseConfiguration,
    ReleaseSource,
    ForgeTarget,
} from "./types";

const base = (projectId: string) =>
    `/api/projects/${encodeURIComponent(projectId)}/release-studio`;

export async function listConfigurations(
    projectId: string,
    commitSha?: string,
): Promise<ReleaseConfiguration[]> {
    const query = commitSha ? `?commit_sha=${encodeURIComponent(commitSha)}` : "";
    const data = await fetchJson<{ configurations: ReleaseConfiguration[] }>(
        `${base(projectId)}/configurations${query}`,
        undefined,
        "Could not load release configurations",
    );
    return data.configurations ?? [];
}

export async function saveConfiguration(
    projectId: string,
    configKey: string,
    configuration: EditableReleaseConfiguration,
    baseCommitSha: string,
): Promise<SavedReleaseConfiguration> {
    const queued = await fetchJson<{ job: { job_id: string } }>(
        `${base(projectId)}/configurations/${encodeURIComponent(configKey)}`,
        {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ configuration, base_commit_sha: baseCommitSha, commit: true }),
        },
        "Could not save the release configuration",
    );
    const completed = await watchPrismJob(queued.job.job_id);
    throwIfJobFailed(completed, "Could not publish the release configuration");
    const result = completed.result_metadata as Partial<SavedReleaseConfiguration> | undefined;
    if (!result?.configuration || !result.commit_sha || !result.path) {
        throw new Error("Published configuration job returned an incomplete result");
    }
    return result as SavedReleaseConfiguration;
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
    body: {
        commit_sha: string;
        variant?: string;
        board?: string;
        schematic?: string;
        bom_preset?: string;
        identity?: { tag: string; document_name: string; date: string; notes: string };
        manufacturing?: Record<string, unknown>;
        impedance_csv?: string;
        stackup_pdf_b64?: string;
        config_key?: string;
    },
): Promise<{ job: { job_id: string } }> {
    return fetchJson(
        `${base(projectId)}/candidates`,
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ config_key: "release", ...body }),
        },
        "Could not start the build",
    );
}

export async function getSource(
    projectId: string,
    commitSha: string,
): Promise<{ source: ReleaseSource; ipc: ManufacturingChoices; forge: ForgeTarget }> {
    return fetchJson(
        `${base(projectId)}/source?commit_sha=${encodeURIComponent(commitSha)}`,
        undefined,
        "Could not discover KiCad files for this revision",
    );
}

export async function saveSourceDefaults(
    projectId: string,
    defaults: {
        board: string;
        schematic: string;
        variant: string;
        bom_preset: string;
    },
): Promise<{ defaults: { board: string; schematic: string; variant: string; bom_preset: string } }> {
    return fetchJson(
        `${base(projectId)}/source/defaults`,
        {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(defaults),
        },
        "Could not remember source picks for this project",
    );
}

export async function tagExists(projectId: string, tag: string): Promise<boolean> {
    const data = await fetchJson<{ exists: boolean }>(
        `${base(projectId)}/tags/${encodeURIComponent(tag)}`,
        undefined,
        "Could not check whether the tag already exists",
    );
    return Boolean(data.exists);
}

export function impedanceTemplateUrl(projectId: string): string {
    return `${base(projectId)}/impedance-template.csv`;
}

export async function getBuild(projectId: string, buildId: string): Promise<BuildDetail> {
    return fetchJson(
        `${base(projectId)}/builds/${encodeURIComponent(buildId)}`,
        undefined,
        "Could not load the build",
    );
}

export async function publishBuild(
    projectId: string,
    buildId: string,
    body: { tag: string; title?: string; notes?: string },
): Promise<{ release: { url: string; tag: string; forge: string }; filename: string }> {
    return fetchJson(
        `${base(projectId)}/builds/${encodeURIComponent(buildId)}/publish`,
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        },
        "Could not publish the release",
    );
}

export function downloadUrl(projectId: string, path: string): string {
    return `${base(projectId)}/${path}`;
}

export function dossierDownloadUrl(projectId: string, buildId: string): string {
    return `${base(projectId)}/builds/${encodeURIComponent(buildId)}/dossier`;
}

export function buildEvidenceDownloadUrl(projectId: string, buildId: string): string {
    return `${base(projectId)}/builds/${encodeURIComponent(buildId)}/build-evidence`;
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

export async function listVendorProfiles(projectId: string): Promise<VendorProfile[]> {
    const data = await fetchJson<{ profiles: VendorProfile[] }>(
        `${base(projectId)}/vendor-profiles`,
        undefined,
        "Could not load manufacturer profiles",
    );
    return data.profiles ?? [];
}

export function vendorPackUrl(
    projectId: string,
    buildId: string,
    vendorId: string,
): string {
    return `${base(projectId)}/builds/${encodeURIComponent(buildId)}/vendor-packs/${encodeURIComponent(vendorId)}`;
}

export async function listProjectCommits(
    projectId: string,
    limit = 50,
): Promise<ProjectCommit[]> {
    const data = await fetchJson<{ commits: ProjectCommit[] }>(
        `/api/projects/${encodeURIComponent(projectId)}/commits?limit=${limit}&include_total=false`,
        undefined,
        "Could not load commits",
    );
    return data.commits ?? [];
}

export async function listBuildLogs(
    projectId: string,
    buildId: string,
): Promise<BuildLogIndex> {
    return fetchJson<BuildLogIndex>(
        `${base(projectId)}/builds/${encodeURIComponent(buildId)}/logs`,
        undefined,
        "Could not load build logs",
    );
}

/** One step's full log, straight from build-evidence.
 *
 * Returns "" when the build predates log archiving, which is an ordinary
 * absence rather than a failure worth surfacing as an error.
 */
export async function fetchBuildLog(
    projectId: string,
    buildId: string,
    stepId: string,
): Promise<string> {
    const response = await fetch(
        `${base(projectId)}/builds/${encodeURIComponent(buildId)}/logs/${encodeURIComponent(stepId)}`,
    );
    if (response.status === 404) return "";
    if (!response.ok) throw new Error("Could not load the step log");
    return response.text();
}
