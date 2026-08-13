import { useEffect, useMemo, useState } from "react";
import { Check, GitCommitHorizontal, Loader2, PlayCircle, Settings2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type {
    EditableReleaseConfiguration,
    ProjectCommit,
    ReleaseConfiguration,
    VendorProfile,
} from "../types";

const emptyDocument = (): EditableReleaseConfiguration => ({
    schema: "prism.release-studio.configuration/1",
    title: "",
    board: "",
    schematic: "",
    jobset: "",
    default_variant: "",
    fields: {},
    notes: {},
    variants: [],
    vendors: [],
});

function editable(configuration: ReleaseConfiguration | null, defaultVendors: string[] = []): EditableReleaseConfiguration {
    if (!configuration) return emptyDocument();
    return {
        schema: "prism.release-studio.configuration/1",
        title: configuration.title,
        board: configuration.board_rel,
        schematic: configuration.schematic_rel,
        jobset: configuration.jobset_rel,
        default_variant: configuration.default_variant,
        fields: { ...(configuration.fields ?? {}) },
        notes: { ...(configuration.notes ?? {}) },
        variants: [...(configuration.variants ?? [])],
        vendors: [...(configuration.vendors ?? defaultVendors)],
        ...(configuration.policy !== undefined ? { policy: configuration.policy } : {}),
        ...(configuration.template ? { template: configuration.template } : {}),
        ...(configuration.sheets ? { sheets: configuration.sheets } : {}),
        ...(configuration.typography ? { typography: configuration.typography } : {}),
        ...(configuration.document_number ? { document_number: configuration.document_number } : {}),
        ...(configuration.revision ? { revision: configuration.revision } : {}),
    };
}

export function DefineConfigStep({
    configurations,
    configKey,
    variant,
    profiles,
    commits,
    commitSha,
    commitsLoading,
    canMutate,
    busy,
    onConfigKey,
    onVariant,
    onCommit,
    onSave,
    onBuild,
}: {
    configurations: ReleaseConfiguration[] | null;
    configKey: string;
    variant: string;
    profiles: VendorProfile[];
    commits: ProjectCommit[];
    commitSha: string;
    commitsLoading: boolean;
    canMutate: boolean;
    busy: string;
    onConfigKey: (key: string) => void;
    onVariant: (value: string) => void;
    onCommit: (sha: string) => void;
    onSave: (key: string, document: EditableReleaseConfiguration) => Promise<void>;
    onBuild: () => void;
}) {
    const selected = configurations?.find((item) => item.config_key === configKey) ?? configurations?.[0] ?? null;
    const vendorIds = useMemo(() => profiles.map((profile) => profile.id), [profiles]);
    const [document, setDocument] = useState<EditableReleaseConfiguration>(() => editable(selected, vendorIds));
    const [draftKey, setDraftKey] = useState(configKey);
    const [dirty, setDirty] = useState(false);

    useEffect(() => {
        setDocument(editable(selected, vendorIds));
        setDraftKey(selected?.config_key ?? configKey);
        setDirty(false);
    }, [selected, configKey, commitSha, vendorIds]);

    const update = <K extends keyof EditableReleaseConfiguration>(
        key: K,
        value: EditableReleaseConfiguration[K],
    ) => {
        setDocument((current) => ({ ...current, [key]: value }));
        setDirty(true);
    };
    const updateField = (key: string, value: string) => {
        setDocument((current) => ({
            ...current,
            fields: { ...current.fields, [key]: value },
        }));
        setDirty(true);
    };
    const complete = Boolean(
        document.title.trim()
        && document.board.trim()
        && document.schematic.trim()
        && document.jobset.trim()
        && draftKey.trim(),
    );
    const selectedCommit = commits.find((commit) => commit.full_hash === commitSha);
    const selectedIsBranchTip = Boolean(commits[0]?.full_hash && commits[0].full_hash === commitSha);

    return (
        <div className="mx-auto max-w-6xl space-y-5">
            <div className="flex flex-wrap items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-md border bg-muted/40">
                    <Settings2 className="h-4 w-4" />
                </div>
                <div>
                    <h3 className="text-lg font-semibold">Release configuration</h3>
                    <p className="font-mono text-xs text-muted-foreground">
                        .prism/release-studio/configurations/{draftKey || "default"}.yaml
                    </p>
                </div>
                <Badge variant={dirty ? "outline" : "secondary"} className="ml-auto gap-1">
                    {dirty ? <GitCommitHorizontal className="h-3 w-3" /> : <Check className="h-3 w-3" />}
                    {dirty ? "Edited" : "Published"}
                </Badge>
            </div>

            <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(20rem,0.85fr)]">
                <section className="space-y-4 rounded-lg border p-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                        <TextField label="Configuration key" value={draftKey} onChange={(value) => { setDraftKey(value); setDirty(true); }} mono />
                        <TextField label="Release title" value={document.title} onChange={(value) => update("title", value)} />
                        <TextField label="Board" value={document.board} onChange={(value) => update("board", value)} mono />
                        <TextField label="Schematic" value={document.schematic} onChange={(value) => update("schematic", value)} mono />
                        <TextField label="Jobset" value={document.jobset} onChange={(value) => update("jobset", value)} mono />
                        <TextField label="Document number" value={document.document_number ?? ""} onChange={(value) => update("document_number", value || undefined)} />
                        <TextField label="Revision" value={document.revision ?? ""} onChange={(value) => update("revision", value || undefined)} />
                        <TextField label="Variants" value={document.variants.join(", ")} onChange={(value) => update("variants", splitList(value))} />
                    </div>
                </section>

                <section className="space-y-4 rounded-lg border p-4">
                    <h4 className="text-sm font-semibold">Manufacturing &amp; assembly</h4>
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                        <TextField label="Manufacturing IPC class" value={document.fields.manufacturing_ipc_class ?? ""} onChange={(value) => updateField("manufacturing_ipc_class", value)} />
                        <TextField label="Assembly IPC class" value={document.fields.assembly_ipc_class ?? ""} onChange={(value) => updateField("assembly_ipc_class", value)} />
                        <TextField label="Solder mask colour" value={document.fields.solder_mask_colour ?? ""} onChange={(value) => updateField("solder_mask_colour", value)} />
                        <TextField label="Via treatment" value={document.fields.via_treatment ?? ""} onChange={(value) => updateField("via_treatment", value)} />
                    </div>
                    {vendorIds.length > 0 && (
                        <div className="space-y-2">
                            <Label>Manufacturer packs</Label>
                            <div className="flex flex-wrap gap-2">
                                {vendorIds.map((id) => {
                                    const active = document.vendors.includes(id);
                                    return <button key={id} type="button" aria-pressed={active} onClick={() => update("vendors", active ? document.vendors.filter((item) => item !== id) : [...document.vendors, id])} className={cn("rounded-md border px-3 py-1.5 text-xs", active ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted")}>{id}</button>;
                                })}
                            </div>
                        </div>
                    )}
                </section>
            </div>

            <section className="flex flex-wrap items-end gap-3 rounded-lg border bg-muted/20 p-4">
                <div className="min-w-64 flex-1 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                        <Label htmlFor="rs-config-revision">Build revision</Label>
                        <Badge variant={selectedIsBranchTip ? "secondary" : "outline"}>
                            {selectedIsBranchTip ? "Branch tip" : "Historical"}
                        </Badge>
                    </div>
                    <select id="rs-config-revision" value={commitSha} disabled={commitsLoading || Boolean(busy)} onChange={(event) => onCommit(event.target.value)} className="flex h-9 w-full border border-input bg-background px-3 font-mono text-xs">
                        {commits.map((commit) => <option key={commit.full_hash} value={commit.full_hash}>{commit.hash} · {commit.message}</option>)}
                    </select>
                </div>
                <div className="min-w-40 space-y-1">
                    <Label htmlFor="rs-config-select">Configuration</Label>
                    <select id="rs-config-select" value={selected?.config_key ?? configKey} disabled={!configurations?.length || Boolean(busy)} onChange={(event) => onConfigKey(event.target.value)} className="flex h-9 w-full border border-input bg-background px-3 text-sm">
                        {(configurations ?? []).map((item) => <option key={item.config_key} value={item.config_key}>{item.title}</option>)}
                    </select>
                </div>
                <div className="min-w-36 space-y-1">
                    <Label htmlFor="rs-config-variant">Variant</Label>
                    <select id="rs-config-variant" value={variant} onChange={(event) => onVariant(event.target.value)} className="flex h-9 w-full border border-input bg-background px-3 text-sm">
                        <option value="">{document.default_variant || "default"}</option>
                        {document.variants.map((item) => <option key={item} value={item}>{item}</option>)}
                    </select>
                </div>
                {canMutate && (
                    <>
                        <Button
                            variant="outline"
                            disabled={Boolean(busy) || !dirty || !complete || !selectedIsBranchTip}
                            title={selectedIsBranchTip ? "Publish configuration" : "Select the branch tip to publish"}
                            onClick={() => void onSave(draftKey.trim(), document)}
                        >
                            {busy === "save-config" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <GitCommitHorizontal className="mr-2 h-4 w-4" />}
                            {busy === "save-config" ? "Publishing…" : "Save & publish"}
                        </Button>
                        <Button disabled={Boolean(busy) || dirty || !selectedCommit || !selected} onClick={onBuild}>
                            <PlayCircle className="mr-2 h-4 w-4" />
                            Start build
                        </Button>
                    </>
                )}
            </section>
        </div>
    );
}

function splitList(value: string): string[] {
    return value.split(",").map((item) => item.trim()).filter(Boolean);
}

function TextField({ label, value, onChange, mono = false }: { label: string; value: string; onChange: (value: string) => void; mono?: boolean }) {
    const id = `rs-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
    return <div className="space-y-1"><Label htmlFor={id}>{label}</Label><Input id={id} value={value} onChange={(event) => onChange(event.target.value)} className={mono ? "font-mono text-xs" : ""} /></div>;
}
