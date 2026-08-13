import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import * as api from "../api";
import type { ReleaseIdentity } from "../types";

export function IdentityStep({
    projectId,
    identity,
    canMutate,
    busy,
    onChange,
    onContinue,
}: {
    projectId: string;
    identity: ReleaseIdentity;
    canMutate: boolean;
    busy: string;
    onChange: (next: ReleaseIdentity) => void;
    onContinue: () => void;
}) {
    const [tagError, setTagError] = useState("");
    const [checking, setChecking] = useState(false);
    const tag = identity.tag.trim();
    const ready = Boolean(tag && identity.document_name.trim() && identity.date.trim());

    useEffect(() => {
        if (!tag) {
            setTagError("");
            return;
        }
        let cancelled = false;
        setChecking(true);
        void api.tagExists(projectId, tag)
            .then((exists) => {
                if (!cancelled) setTagError(exists ? `${tag} already exists on GitHub/GitLab.` : "");
            })
            .catch(() => {
                if (!cancelled) setTagError("");
            })
            .finally(() => {
                if (!cancelled) setChecking(false);
            });
        return () => {
            cancelled = true;
        };
    }, [projectId, tag]);

    return (
        <div className="space-y-5">
            <div>
                <h3 className="text-lg font-semibold">Release identity</h3>
                <p className="text-sm text-muted-foreground">
                    The tag is printed as the drawing revision and created as the GitHub or GitLab Release. Name it before the PDFs are generated.
                </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                    <Label htmlFor="rs-identity-tag">Tag</Label>
                    <Input
                        id="rs-identity-tag"
                        value={identity.tag}
                        onChange={(event) => onChange({ ...identity, tag: event.target.value })}
                        placeholder="v1.0.0"
                        disabled={!canMutate}
                    />
                    {checking && <p className="text-xs text-muted-foreground">Checking whether this tag exists…</p>}
                    {tagError && <p className="text-sm text-destructive">{tagError}</p>}
                </div>
                <div className="space-y-2">
                    <Label htmlFor="rs-identity-doc">Document Name</Label>
                    <Input
                        id="rs-identity-doc"
                        value={identity.document_name}
                        onChange={(event) => onChange({ ...identity, document_name: event.target.value })}
                        placeholder="USBPD-100"
                        disabled={!canMutate}
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="rs-identity-date">Date</Label>
                    <Input
                        id="rs-identity-date"
                        type="date"
                        value={identity.date}
                        onChange={(event) => onChange({ ...identity, date: event.target.value })}
                        disabled={!canMutate}
                    />
                </div>
            </div>
            <div className="space-y-2">
                <Label htmlFor="rs-identity-notes">Release notes</Label>
                <Textarea
                    id="rs-identity-notes"
                    value={identity.notes}
                    onChange={(event) => onChange({ ...identity, notes: event.target.value })}
                    rows={4}
                    disabled={!canMutate}
                />
            </div>
            {canMutate && (
                <Button disabled={!ready || Boolean(tagError) || Boolean(busy)} onClick={onContinue}>
                    Continue
                </Button>
            )}
        </div>
    );
}

export default IdentityStep;
