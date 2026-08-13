import { useState } from "react";
import { ExternalLink, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import * as api from "../api";
import type { BuildDetail } from "../types";
import type { RunFn } from "../shared";

export function PublishStep({
    projectId,
    detail,
    canMutate,
    busy,
    onRun,
}: {
    projectId: string;
    detail: BuildDetail;
    canMutate: boolean;
    busy: string;
    onRun: RunFn;
}) {
    const forge = detail.forge;
    const forgeName = forge?.name || "GitHub or GitLab";
    const [tag, setTag] = useState("");
    const [title, setTitle] = useState("");
    const [notes, setNotes] = useState("");
    const [publishedUrl, setPublishedUrl] = useState("");
    const ready = detail.build.status === "succeeded";
    const canPublish = canMutate && ready && Boolean(tag.trim()) && busy !== "publish";
    const tokenHint = forge && !forge.token_configured ? forge.token_hint : "";

    return (
        <div className="space-y-5">
            <div>
                <h3 className="text-lg font-semibold">Publish to {forgeName}</h3>
                <p className="text-sm text-muted-foreground">
                    Creates a {forgeName} Release on this build&apos;s commit and attaches a zip of the documents and manufacturing files.
                    The workspace SSH key cannot do this — a token with write access is required.
                </p>
            </div>
            {forge?.owner_repo && (
                <p className="font-mono text-xs text-muted-foreground">{forge.host}/{forge.owner_repo}</p>
            )}
            {tokenHint && <p className="text-sm text-destructive">{tokenHint}</p>}
            {publishedUrl && (
                <a href={publishedUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm underline">
                    <ExternalLink className="h-3 w-3" /> {publishedUrl}
                </a>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                    <Label htmlFor="rs-publish-tag">Tag</Label>
                    <Input id="rs-publish-tag" value={tag} onChange={(event) => setTag(event.target.value)} placeholder="v1.0.0" disabled={!canMutate} />
                </div>
                <div className="space-y-1">
                    <Label htmlFor="rs-publish-title">Title</Label>
                    <Input id="rs-publish-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Optional" disabled={!canMutate} />
                </div>
            </div>
            <div className="space-y-1">
                <Label htmlFor="rs-publish-notes">Notes</Label>
                <Textarea id="rs-publish-notes" value={notes} onChange={(event) => setNotes(event.target.value)} rows={4} disabled={!canMutate} />
            </div>
            <Button
                disabled={!canPublish || Boolean(tokenHint)}
                onClick={() => void onRun("publish", async () => {
                    const result = await api.publishBuild(projectId, detail.build.id, {
                        tag: tag.trim(),
                        title: title.trim(),
                        notes,
                    });
                    setPublishedUrl(result.release.url);
                })}
            >
                <Upload className="mr-1 h-3 w-3" />
                Publish to {forgeName}
            </Button>
        </div>
    );
}

export default PublishStep;
