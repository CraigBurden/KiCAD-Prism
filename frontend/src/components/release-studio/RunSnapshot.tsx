import { Lock } from "lucide-react";

import type { BuildDetail, ReleaseConfiguration } from "./types";

export function LockedStage() {
    return (
        <div className="flex items-center gap-2 rounded border border-dashed p-4 text-sm text-muted-foreground" title="Opens when the build finishes">
            <Lock className="h-4 w-4" aria-hidden />
            Locked
        </div>
    );
}

export function SourceDetails({ detail }: { detail: BuildDetail }) {
    const source = detail.candidate;
    const configuration = detail.configuration;
    const rows: [string, string][] = [
        ["Commit", source?.commit_sha || "—"],
        ["Board", configuration?.board_rel || "—"],
        ["Schematic", configuration?.schematic_rel || "—"],
        ["Variant", source?.variant || configuration?.default_variant || "default"],
    ];
    return <SnapshotDetails title="Source" rows={rows} />;
}

export function IdentityDetails({ configuration }: { configuration: ReleaseConfiguration | null }) {
    return (
        <SnapshotDetails
            title="Release identity"
            rows={[
                ["Tag", configuration?.revision || "—"],
                ["Document Name", configuration?.document_number || "—"],
                ["Date", configuration?.release_date || "—"],
                ["Release notes", configuration?.release_notes || "—"],
            ]}
        />
    );
}

function snapshotSpec(configuration: ReleaseConfiguration | null, key: string): string {
    // synthesize_configuration stores IPC/finish callouts under fields[]; identity
    // stays at the document root. History must read the same shape the cover uses.
    const nested = configuration?.fields?.[key];
    const top = (configuration as Record<string, unknown> | null)?.[key];
    const value = (typeof nested === "string" && nested) || (typeof top === "string" && top) || "";
    return value.trim() || "—";
}

export function ManufacturingDetails({ configuration }: { configuration: ReleaseConfiguration | null }) {
    return (
        <SnapshotDetails
            title="Manufacturing and assembly"
            rows={[
                ["Manufacturing IPC class", snapshotSpec(configuration, "manufacturing_ipc_class")],
                ["Assembly IPC class", snapshotSpec(configuration, "assembly_ipc_class")],
                ["Solder mask colour", snapshotSpec(configuration, "solder_mask_colour")],
                ["Silkscreen colour", snapshotSpec(configuration, "silkscreen_colour")],
                ["Via treatment", snapshotSpec(configuration, "via_treatment")],
                ["Vendors", (configuration?.vendors || []).join(", ") || "—"],
            ]}
        />
    );
}

function SnapshotDetails({ title, rows }: { title: string; rows: [string, string][] }) {
    return (
        <div className="space-y-4">
            <h3 className="text-lg font-semibold">{title}</h3>
            <dl className="grid gap-3 rounded-lg border p-4 sm:grid-cols-2">
                {rows.map(([label, value]) => (
                    <div key={label} className="min-w-0 space-y-1">
                        <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
                        <dd className="truncate text-sm" title={value}>{value}</dd>
                    </div>
                ))}
            </dl>
        </div>
    );
}
