import { fetchApi, readApiError } from "@/lib/api";
import type { CommentAttachment } from "@/types/comments";

/** Markdown bodies reference uploads as `attachment:<32 hex>`, never by URL. */
export const ATTACHMENT_SCHEME = "attachment:";
const ATTACHMENT_REF = /^attachment:([0-9a-f]{32})$/;

export function attachmentIdFromRef(ref: string | null | undefined): string | null {
    const match = ATTACHMENT_REF.exec(ref ?? "");
    return match ? match[1]! : null;
}

export function attachmentUrl(projectId: string, attachmentId: string): string {
    return `/api/projects/${encodeURIComponent(projectId)}/comment-attachments/${attachmentId}`;
}

/** Map a body reference to the authenticated route; anything else is refused. */
export function resolveAttachmentRef(projectId: string, ref: string | null | undefined): string | null {
    const id = attachmentIdFromRef(ref);
    return id ? attachmentUrl(projectId, id) : null;
}

/** The inverse, for HTML pasted back into the editor from a rendered comment. */
export function attachmentRefFromUrl(projectId: string, url: string | null | undefined): string | null {
    if (!url) return null;
    const prefix = attachmentUrl(projectId, "");
    let path = url;
    try {
        path = new URL(url, window.location.origin).pathname;
    } catch {
        return null;
    }
    if (!path.startsWith(prefix)) return null;
    const id = path.slice(prefix.length);
    return /^[0-9a-f]{32}$/.test(id) ? `${ATTACHMENT_SCHEME}${id}` : null;
}

export async function uploadCommentAttachment(projectId: string, file: File): Promise<CommentAttachment> {
    const body = new FormData();
    body.append("file", file, file.name || "pasted-image.png");
    const response = await fetchApi(
        `/api/projects/${encodeURIComponent(projectId)}/comment-attachments`,
        { method: "POST", body },
    );
    if (!response.ok) {
        throw new Error(await readApiError(response, `Could not attach ${file.name || "file"}`));
    }
    return (await response.json()) as CommentAttachment;
}

export function formatBytes(size: number): string {
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(0)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}
