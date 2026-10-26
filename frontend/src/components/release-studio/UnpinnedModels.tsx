import { useId, useState } from "react";
import { ChevronRight, ShieldAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Label } from "@/components/ui/label";

import type { UnpinnedModel } from "./types";

/**
 * The 3D models a build did not pin, with the acknowledgement approve and
 * publish need (issue #698, D3). Renders nothing when every model is pinned.
 * ``collapsible`` folds the list behind its count; the tick stays in view,
 * because approving waits on it.
 */
export function UnpinnedModelsAck({
    models,
    checked,
    onCheckedChange,
    disabled = false,
    collapsible = false,
}: {
    models: UnpinnedModel[];
    checked: boolean;
    onCheckedChange: (checked: boolean) => void;
    disabled?: boolean;
    collapsible?: boolean;
}) {
    const id = useId();
    if (models.length === 0) return null;
    const list = (
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
    );
    if (collapsible) {
        return (
            <Collapsible className="space-y-1">
                <div className="flex min-w-0 items-center gap-2">
                    <Checkbox
                        id={id}
                        checked={checked}
                        disabled={disabled}
                        onCheckedChange={(value) => onCheckedChange(value === true)}
                    />
                    <Label htmlFor={id} className="min-w-0 flex-1 truncate font-normal">
                        Acknowledge {models.length} unpinned 3D model{models.length === 1 ? "" : "s"}
                    </Label>
                    <CollapsibleTrigger
                        className="group flex shrink-0 items-center text-muted-foreground"
                        aria-label="Show unpinned models"
                        title="Show unpinned models"
                    >
                        <ChevronRight className="h-4 w-4 transition-transform group-data-[state=open]:rotate-90" />
                    </CollapsibleTrigger>
                </div>
                <CollapsibleContent>{list}</CollapsibleContent>
            </Collapsible>
        );
    }
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
                <Label htmlFor={id} className="font-medium">
                    Acknowledge {models.length} unpinned 3D model{models.length === 1 ? "" : "s"}
                </Label>
            </div>
            {list}
        </div>
    );
}

function sameKeys(left: string[], right: string[]): boolean {
    if (left.length !== right.length) return false;
    const sorted = [...right].sort();
    return [...left].sort().every((key, index) => key === sorted[index]);
}

/**
 * The acknowledgement of *this* build's unpinned models. A tick names the
 * build and the exact keys it covered, so selecting another build, or a
 * changed list, reads as unacknowledged rather than carrying the tick over.
 */
export function useModelAcknowledgement(buildId: string, models: UnpinnedModel[]) {
    const [given, setGiven] = useState<{ buildId: string; keys: string[] } | null>(null);
    const keys = models.map((model) => model.key);
    const acknowledged = Boolean(given && given.buildId === buildId && sameKeys(given.keys, keys));
    return {
        acknowledged,
        /** Whether approve/publish may proceed: nothing to acknowledge, or acknowledged. */
        satisfied: keys.length === 0 || acknowledged,
        setAcknowledged: (checked: boolean) => setGiven(checked ? { buildId, keys } : null),
        /** The keys the request sends; empty when not acknowledged. */
        keys: acknowledged ? keys : [],
    };
}

export default UnpinnedModelsAck;
