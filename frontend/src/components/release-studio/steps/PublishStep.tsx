import { useState } from "react";
import { ExternalLink, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";

import * as api from "../api";
import type { BuildDetail } from "../types";
import type { RunFn } from "../shared";

export function PublishStep({
    projectId,
    detail,
    identity,
    canMutate,
    busy,
    onRun,
}: {
    projectId: string;
    detail: BuildDetail;
    identity: { tag: string; document_name: string; date: string; notes: string };
    canMutate: boolean;
    busy: string;
    onRun: RunFn;
}) {
    const forge = detail.forge;
    const forgeName = forge?.name || "GitHub or GitLab";
    const [publishedUrl, setPublishedUrl] = useState("");
    const ready = detail.build.status === "succeeded";
    const tag = identity.tag || String(detail.configuration?.revision || "");
    const documentName = identity.document_name || detail.configuration?.document_number || "";
    const canPublish = canMutate && ready && Boolean(tag.trim()) && busy !== "publish";
    const tokenHint = forge && !forge.token_configured ? forge.token_hint : "";

    if (publishedUrl) {
        return (
            <div className="space-y-3">
                <h3 className="text-lg font-semibold">Published to {forgeName}</h3>
                <a href={publishedUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm underline">
                    <ExternalLink className="h-3 w-3" /> {publishedUrl}
                </a>
                <p className="text-sm text-muted-foreground">Tag {tag} · {documentName || "—"}</p>
            </div>
        );
    }

    return (
        <div className="space-y-5">
            <div>
                <h3 className="text-lg font-semibold">Publish to {forgeName}</h3>
                <p className="text-sm text-muted-foreground">
                    Creates a {forgeName} Release named {tag || "this tag"} on this build&apos;s commit and attaches the zip. Nothing on this screen can change the drawings.
                </p>
            </div>
            {forge?.owner_repo && (
                <p className="font-mono text-xs text-muted-foreground">{forge.host}/{forge.owner_repo}</p>
            )}
            {tokenHint && <p className="text-sm text-destructive">{tokenHint}</p>}
            <dl className="grid gap-3 rounded-lg border p-4 text-sm sm:grid-cols-2">
                <div>
                    <dt className="text-xs uppercase text-muted-foreground">Tag</dt>
                    <dd className="font-mono">{tag || "—"}</dd>
                </div>
                <div>
                    <dt className="text-xs uppercase text-muted-foreground">Document Name</dt>
                    <dd>{documentName || "—"}</dd>
                </div>
                <div>
                    <dt className="text-xs uppercase text-muted-foreground">Date</dt>
                    <dd>{identity.date || "—"}</dd>
                </div>
                <div className="sm:col-span-2">
                    <dt className="text-xs uppercase text-muted-foreground">Notes</dt>
                    <dd className="whitespace-pre-wrap">{identity.notes || "—"}</dd>
                </div>
            </dl>
            <Button
                disabled={!canPublish || Boolean(tokenHint)}
                onClick={() => void onRun("publish", async () => {
                    const result = await api.publishBuild(projectId, detail.build.id, {
                        tag: tag.trim(),
                        title: tag.trim(),
                        notes: identity.notes,
                    });
                    setPublishedUrl(result.release.url);
                })}
            >
                <Upload className="mr-1 h-3 w-3" />
                Confirm and publish to {forgeName}
            </Button>
        </div>
    );
}

export default PublishStep;
