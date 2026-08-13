import { useEffect, useMemo, useState } from "react";
import { Download, FileCheck2, FileSpreadsheet, Layers3, PackageCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";

import * as api from "../api";
import { shortDigest } from "../flow";
import {
    DocumentSheetPreview,
    MemberViewer,
    VendorPackCard,
    orderedSheets,
    type RunFn,
} from "../shared";
import type { BuildDetail, DocumentSheet, ReleaseMember, VendorProfile, VendorReadiness } from "../types";

export function InspectOutputsStep({
    projectId,
    detail,
    profiles,
    busy,
    onContinue,
    onRun,
}: {
    projectId: string;
    detail: BuildDetail;
    profiles: VendorProfile[];
    busy: string;
    onContinue: () => void;
    onRun: RunFn;
}) {
    const [sheets, setSheets] = useState<DocumentSheet[]>([]);
    const [sheetKey, setSheetKey] = useState("");
    const [member, setMember] = useState<ReleaseMember | null>(null);
    const [vendorId, setVendorId] = useState("");

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
    const selectedProfile = profiles.find((profile) => profile.id === vendorId) ?? profiles[0];
    const selectedReadiness = detail.vendor_readiness?.find(
        (item) => (item.vendor_id || item.profile_id) === selectedProfile?.id,
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h3 className="text-lg font-semibold">Outputs</h3>
                </div>
                <div className="ml-auto flex flex-wrap gap-2">
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void onRun("download-dossier", () => api.downloadFile(api.dossierDownloadUrl(projectId, detail.build.id), `build-${detail.build.id}-dossier.tar.gz`))}
                    >
                        <Download className="mr-1 h-3 w-3" /> Dossier
                    </Button>
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void onRun("download-build-evidence", () => api.downloadFile(api.buildEvidenceDownloadUrl(projectId, detail.build.id), `build-${detail.build.id}-evidence.tar.gz`))}
                    >
                        <Download className="mr-1 h-3 w-3" /> Build evidence
                    </Button>
                </div>
            </div>

            <Tabs defaultValue="documents">
                <TabsList>
                    <TabsTrigger value="documents">
                        Documents{sheets.length ? ` (${sheets.length})` : ""}
                    </TabsTrigger>
                    <TabsTrigger value="members">
                        Members ({detail.members.length})
                    </TabsTrigger>
                    <TabsTrigger value="evidence">
                        Evidence ({detail.evidence.length})
                    </TabsTrigger>
                </TabsList>
                <TabsContent value="documents" className="space-y-3 pt-4">
                <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="font-medium">{selectedProfile?.title || "Manufacturer"} pack readiness</span>
                        <Badge variant={selectedReadiness?.ready ? "secondary" : "outline"}>
                            {selectedReadiness?.ready ? "ready to download" : "incomplete"}
                        </Badge>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                        <PackRequirementTiles profile={selectedProfile} readiness={selectedReadiness} />
                    </div>
                </div>
                <div className="flex flex-wrap gap-2">
                    {sheets.map((sheet) => (
                        <Button
                            key={sheet.key}
                            size="sm"
                            variant={sheet.key === selectedSheet?.key ? "default" : "outline"}
                            onClick={() => setSheetKey(sheet.key)}
                        >
                            {sheet.key}
                        </Button>
                    ))}
                </div>
                {selectedSheet && (
                    <DocumentSheetPreview
                        projectId={projectId}
                        buildId={detail.build.id}
                        sheet={selectedSheet}
                    />
                )}
                {!selectedSheet && <p className="text-sm text-muted-foreground">No composed documents for this build.</p>}
                </TabsContent>

                <TabsContent value="members" className="space-y-3 pt-4">
                {Object.entries(membersByDomain).map(([domain, members]) => (
                    <div key={domain} className="space-y-1">
                        <h5 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            {domain.replace("_", " ")}
                        </h5>
                        <div className="max-h-64 overflow-auto border">
                            {members.map((item) => (
                                <button
                                    key={item.path}
                                    type="button"
                                    className="flex w-full items-center gap-2 border-b px-3 py-1.5 text-left text-xs last:border-b-0 hover:bg-muted/40"
                                    onClick={() => setMember(item)}
                                >
                                    <span className="flex-1 font-mono">{item.path}</span>
                                    <span className="text-muted-foreground">{shortDigest(item.released_digest)}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                ))}
                {member && (
                    <MemberViewer
                        projectId={projectId}
                        buildId={detail.build.id}
                        member={member}
                        onClose={() => setMember(null)}
                    />
                )}
                </TabsContent>

                <TabsContent value="evidence" className="space-y-2 pt-4">
                {detail.evidence.length === 0 && (
                    <p className="text-sm text-muted-foreground">No DRC/ERC evidence on this build.</p>
                )}
                {detail.evidence.map((item) => (
                    <div key={item.kind} className="flex flex-wrap items-center gap-2 border px-3 py-2 text-sm">
                        <Badge variant="outline">{item.kind.toUpperCase()}</Badge>
                        {Object.entries(item.counts).map(([severity, count]) => (
                            <Badge key={severity} variant="secondary">
                                {severity}: {count}
                            </Badge>
                        ))}
                    </div>
                ))}
                </TabsContent>
            </Tabs>

            <VendorPackCard
                projectId={projectId}
                buildId={detail.build.id}
                profiles={profiles}
                busy={busy}
                readiness={detail.vendor_readiness}
                vendorId={selectedProfile?.id}
                onVendorChange={setVendorId}
            />

            <Button onClick={onContinue}>Continue to publish</Button>
        </div>
    );
}

function PackRequirementTiles({ profile, readiness }: { profile?: VendorProfile; readiness?: VendorReadiness }) {
    const missing = new Set(readiness?.missing_requirements ?? []);
    const requirements = profile?.required_pack_artifacts ?? [];
    if (requirements.length === 0) {
        return <p className="text-sm text-muted-foreground">Pack requirements are not available.</p>;
    }
    return <>{requirements.map((requirement) => {
        // Missing readiness is not a pass. Base outputs can exist while a
        // vendor pack still lacks its CSV/XLSX-specific requirement.
        const state = !readiness ? "unavailable" : missing.has(requirement) ? "missing" : "ready";
        const Icon = requirement.startsWith("bom") ? FileSpreadsheet
            : requirement.startsWith("cpl") ? PackageCheck
            : requirement === "drill" ? FileCheck2 : Layers3;
        return <div key={requirement} className="flex items-center gap-2 rounded border p-3 text-sm"><Icon className="h-4 w-4 text-muted-foreground" /><span className="flex-1">{requirement}</span><Badge variant={state === "ready" ? "secondary" : "outline"}>{state}</Badge></div>;
    })}</>;
}

function groupMembers(members: ReleaseMember[]): Record<string, ReleaseMember[]> {
    const grouped: Record<string, ReleaseMember[]> = {};
    for (const member of members) {
        const domain = member.domains[0] || "other";
        (grouped[domain] ??= []).push(member);
    }
    return grouped;
}
