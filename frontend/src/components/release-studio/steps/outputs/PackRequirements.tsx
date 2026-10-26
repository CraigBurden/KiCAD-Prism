import { FileCheck2, FileSpreadsheet, Layers3, PackageCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";

import type { VendorProfile, VendorReadiness } from "../../types";

export function PackRequirementTiles({ profile, readiness }: { profile?: VendorProfile; readiness?: VendorReadiness }) {
    const missing = new Set(readiness?.missing_requirements ?? []);
    const requirements = profile?.required_pack_artifacts ?? [];
    if (requirements.length === 0) {
        return <p className="text-sm text-muted-foreground">No pack requirements</p>;
    }
    return (
        <div className="flex flex-wrap gap-1">
            {requirements.map((requirement) => {
                const state = !readiness ? "unavailable" : missing.has(requirement) ? "missing" : "ready";
                const Icon = requirement.startsWith("bom") ? FileSpreadsheet
                    : requirement.startsWith("cpl") ? PackageCheck
                    : requirement === "drill" ? FileCheck2 : Layers3;
                return (
                    <div key={requirement} className="inline-flex items-center gap-1 border px-1.5 py-0.5 text-xs">
                        <Icon className="h-3 w-3 text-muted-foreground" />
                        <span>{requirement}</span>
                        <Badge variant={state === "ready" ? "secondary" : "outline"} className="h-4 px-1">
                            {state}
                        </Badge>
                    </div>
                );
            })}
        </div>
    );
}
