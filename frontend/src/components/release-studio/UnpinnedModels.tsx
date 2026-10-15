import { useId } from "react";
import { ShieldAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";

import type { UnpinnedModel } from "./types";

/**
 * The 3D models a build did not pin, with the acknowledgement approve and
 * publish need (issue #698, D3). Renders nothing when every model is pinned.
 */
export function UnpinnedModelsAck({
    models,
    checked,
    onCheckedChange,
    disabled = false,
}: {
    models: UnpinnedModel[];
    checked: boolean;
    onCheckedChange: (checked: boolean) => void;
    disabled?: boolean;
}) {
    const id = useId();
    if (models.length === 0) return null;
    return (
        <div className="space-y-1 border border-warning/40 bg-warning/10 px-2 py-1.5">
            <div className="flex items-center gap-2">
                <Checkbox
                    id={id}
                    checked={checked}
                    disabled={disabled}
                    onCheckedChange={(value) => onCheckedChange(value === true)}
                />
                <ShieldAlert className="h-3.5 w-3.5 shrink-0 text-warning" aria-hidden />
                <label htmlFor={id} className="text-xs font-medium">
                    Acknowledge {models.length} unpinned 3D model{models.length === 1 ? "" : "s"}
                </label>
            </div>
            <ul className="max-h-24 space-y-0.5 overflow-y-auto text-xs">
                {models.map((model) => (
                    <li
                        key={model.key}
                        className="flex min-w-0 items-center gap-2"
                        title={`${model.source_path}: ${model.reference}`}
                    >
                        <span className="min-w-0 flex-1 truncate font-mono">{model.reference}</span>
                        <Badge variant="outline" className="h-4 shrink-0 px-1">{model.location}</Badge>
                    </li>
                ))}
            </ul>
        </div>
    );
}

/** The keys an acknowledged approve or publish sends; empty when nothing needs one. */
export function acknowledgedModelKeys(models: UnpinnedModel[], checked: boolean): string[] {
    return checked ? models.map((model) => model.key) : [];
}

export default UnpinnedModelsAck;
