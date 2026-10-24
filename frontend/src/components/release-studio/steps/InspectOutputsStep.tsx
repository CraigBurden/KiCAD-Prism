import { useEffect, useMemo, useState } from "react";
import {
    CircleDot,
    CircuitBoard,
    Crosshair,
    Download,
    FileSpreadsheet,
    FileText,
    Layers3,
    PackageCheck,
    ShieldAlert,
    Workflow,
    type LucideIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FabricationViewer } from "@/components/fabrication-viewer/fabrication-viewer";
import {
    buildSource,
    isFabricationMember,
    isLayerFile,
    memberFileName,
} from "@/components/fabrication-viewer/sources";

import * as api from "../api";
import { shortDigest } from "../flow";
import {
    DocumentSheetPreview,
    MemberViewer,
    orderedSheets,
    type RunFn,
} from "../shared";
import { EvidenceWarnings } from "./outputs/Evidence";
import { ReleaseChecksRail } from "./outputs/ReleaseChecksRail";
import type {
    BuildDetail,
    DocumentSheet,
    ReleaseMember,
    VendorProfile,
} from "../types";

const SHEET_ICONS: Record<string, LucideIcon> = {
    cover: FileText,
    fabrication: Layers3,
    assembly: PackageCheck,
    testpoint: Crosshair,
    drill: CircleDot,
    schematic: Workflow,
    bom: FileSpreadsheet,
};

export function InspectOutputsStep({
    projectId,
    detail,
    profiles,
    busy,
    onContinue,
    onRun,
    onRefresh,
}: {
    projectId: string;
    detail: BuildDetail;
    profiles: VendorProfile[];
    busy: string;
    onContinue: () => void;
    onRun: RunFn;
    onRefresh?: () => Promise<unknown> | void;
}) {
    const [sheets, setSheets] = useState<DocumentSheet[]>([]);
    const [sheetKey, setSheetKey] = useState("");
    const [outputView, setOutputView] = useState("documents");
    const [member, setMember] = useState<ReleaseMember | null>(null);
    const [focusFile, setFocusFile] = useState("");

    useEffect(() => {
        let cancelled = false;
        void api.listDocumentSheets(projectId, detail.build.id).then((next) => {
            if (cancelled) return;
            const ordered = orderedSheets(next);
            setSheets(ordered);
            setSheetKey((current) => current || ordered[0]?.key || "");
        });
        return () => {
            cancelled = true;
        };
    }, [projectId, detail.build.id]);

    const selectedSheet = sheets.find((sheet) => sheet.key === sheetKey) ?? sheets[0];
    const membersByDomain = useMemo(() => groupMembers(detail.members), [detail.members]);
    const hasFabrication = detail.members.some((item) => isFabricationMember(item.path));
    const fabricationSource = useMemo(
        () => buildSource(projectId, detail.build.id),
        [projectId, detail.build.id],
    );
    // A layer file opens in the viewer; the job file and everything else stay text.
    const openMember = (item: ReleaseMember) => {
        if (isLayerFile(item.path)) {
            setFocusFile(memberFileName(item.path));
            setOutputView("fabrication");
        } else {
            setMember(item);
        }
    };

    return (
        <div className="flex h-full min-h-0 flex-1">
            <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                <Tabs value={outputView} onValueChange={setOutputView} className="min-w-0 shrink-0 gap-0">
                    <div className="flex min-w-0 items-center gap-2 border-b bg-card px-2">
                        <TabsList variant="line" className="h-10 min-w-0 gap-2 overflow-x-auto" aria-label="Output views">
                            <TabsTrigger value="documents" className="gap-2 px-2 text-sm">
                                <FileText className="h-4 w-4" />
                                Documents{sheets.length ? ` (${sheets.length})` : ""}
                            </TabsTrigger>
                            {hasFabrication && (
                                <TabsTrigger value="fabrication" className="gap-2 px-2 text-sm">
                                    <CircuitBoard className="h-4 w-4" />
                                    Gerber
                                </TabsTrigger>
                            )}
                            <TabsTrigger value="members" className="gap-2 px-2 text-sm">
                                <Layers3 className="h-4 w-4" />
                                Members ({detail.members.length})
                            </TabsTrigger>
                            <TabsTrigger value="evidence" className="gap-2 px-2 text-sm">
                                <ShieldAlert className="h-4 w-4" />
                                Evidence ({detail.evidence.length})
                            </TabsTrigger>
                        </TabsList>
                        <div className="ml-auto flex shrink-0 flex-wrap gap-1">
                            <Button
                                size="xs"
                                variant="outline"
                                onClick={() => void onRun("download-dossier", () => api.downloadFile(api.dossierDownloadUrl(projectId, detail.build.id), `build-${detail.build.id}-dossier.tar.gz`))}
                            >
                                <Download className="mr-1 h-3 w-3" /> Dossier
                            </Button>
                            <Button
                                size="xs"
                                variant="outline"
                                onClick={() => void onRun("download-build-evidence", () => api.downloadFile(api.buildEvidenceDownloadUrl(projectId, detail.build.id), `build-${detail.build.id}-evidence.tar.gz`))}
                            >
                                <Download className="mr-1 h-3 w-3" /> Build evidence
                            </Button>
                        </div>
                    </div>
                </Tabs>
                {outputView === "documents" && (
                    sheets.length > 0 ? (
                        <Tabs
                            value={selectedSheet?.key}
                            onValueChange={setSheetKey}
                            className="flex min-h-0 flex-1 flex-col gap-0 overflow-hidden"
                        >
                            <div className="flex shrink-0 items-center gap-2 border-b bg-card px-2">
                                <TabsList variant="line" className="h-10 min-w-0 flex-1 gap-2 overflow-x-auto" aria-label="Output documents">
                                    {sheets.map((sheet) => {
                                        const Icon = SHEET_ICONS[sheet.key] ?? FileText;
                                        return (
                                            <TabsTrigger key={sheet.key} value={sheet.key} className="gap-2 px-2 text-sm">
                                                <Icon className="h-4 w-4" />
                                                {sheetLabel(sheet.key)}
                                            </TabsTrigger>
                                        );
                                    })}
                                </TabsList>
                                {selectedSheet && (
                                    <Button
                                        size="xs"
                                        variant="outline"
                                        className="shrink-0"
                                        onClick={() =>
                                            void api.downloadFile(
                                                api.downloadUrl(
                                                    projectId,
                                                    `builds/${encodeURIComponent(detail.build.id)}/sheets/${encodeURIComponent(selectedSheet.key)}.pdf`,
                                                ),
                                                `${selectedSheet.key}.pdf`,
                                            )
                                        }
                                    >
                                        <Download className="mr-1 h-3 w-3" /> PDF
                                    </Button>
                                )}
                            </div>
                            {selectedSheet ? (
                                <DocumentSheetPreview
                                    projectId={projectId}
                                    buildId={detail.build.id}
                                    sheet={selectedSheet}
                                />
                            ) : null}
                        </Tabs>
                    ) : (
                        <p className="p-3 text-sm text-muted-foreground">No composed documents for this build.</p>
                    )
                )}
                {outputView === "fabrication" && hasFabrication && (
                    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                        <FabricationViewer
                            key={`${fabricationSource.key}:${focusFile}`}
                            source={fabricationSource}
                            focusFile={focusFile || undefined}
                        />
                    </div>
                )}
                {outputView === "members" && (
                    <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
                        <div className="min-h-0 flex-1 overflow-y-auto border">
                            {Object.entries(membersByDomain).map(([domain, members]) => (
                                <div key={domain}>
                                    <h5 className="sticky top-0 bg-background px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                        {domain.replace("_", " ")}
                                    </h5>
                                    {members.map((item) => (
                                        <div key={item.path} className="flex items-center border-t hover:bg-muted/40">
                                            <button
                                                type="button"
                                                className="flex min-w-0 flex-1 items-center gap-2 px-3 py-1.5 text-left text-xs"
                                                onClick={() => openMember(item)}
                                            >
                                                <span className="flex-1 truncate font-mono">{item.path}</span>
                                                <span className="text-muted-foreground">{shortDigest(item.released_digest)}</span>
                                            </button>
                                            {isLayerFile(item.path) && (
                                                <Button
                                                    size="xs"
                                                    variant="ghost"
                                                    className="mr-2 shrink-0"
                                                    aria-label={`View ${item.path} as text`}
                                                    onClick={() => setMember(item)}
                                                >
                                                    Text
                                                </Button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            ))}
                        </div>
                        {member && (
                            <MemberViewer
                                key={`${detail.build.id}:${member.path}`}
                                projectId={projectId}
                                buildId={detail.build.id}
                                member={member}
                                onClose={() => setMember(null)}
                            />
                        )}
                    </div>
                )}
                {outputView === "evidence" && (
                    <div className="min-h-0 flex-1 overflow-y-auto p-3">
                        <EvidenceWarnings
                            key={detail.build.id}
                            projectId={projectId}
                            buildId={detail.build.id}
                            members={detail.members}
                            warnings={detail.build.warnings}
                            evidence={detail.evidence}
                        />
                    </div>
                )}
            </div>

            <ReleaseChecksRail
                projectId={projectId}
                detail={detail}
                profiles={profiles}
                busy={busy}
                onContinue={onContinue}
                onRun={onRun}
                onRefresh={onRefresh}
            />
        </div>
    );
}



function sheetLabel(key: string): string {
    if (key.toLowerCase() === "bom") return "BOM";
    return key ? key.charAt(0).toUpperCase() + key.slice(1) : key;
}


function groupMembers(members: ReleaseMember[]): Record<string, ReleaseMember[]> {
    const grouped: Record<string, ReleaseMember[]> = {};
    for (const member of members) {
        const domain = member.domains[0] || "other";
        (grouped[domain] ??= []).push(member);
    }
    return grouped;
}
