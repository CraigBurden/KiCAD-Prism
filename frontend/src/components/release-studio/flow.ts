/** The stages of one run, in the order they happen.
 *
 * They are a progress rail, not a wizard: Source and Outputs stay reachable
 * after the build finishes so a designer can inspect PDFs, then publish.
 */
export const RUN_STAGES = [
    { id: "source", label: "Source" },
    { id: "build", label: "Build" },
    { id: "outputs", label: "Outputs" },
    { id: "publish", label: "Publish" },
] as const;

export const DOCUMENT_ORDER = [
    "cover",
    "fabrication",
    "assembly",
    "testpoint",
    "drill",
    "schematic",
] as const;

export function shortDigest(value: string | null | undefined): string {
    if (!value) return "—";
    return value.length > 16 ? `${value.slice(0, 12)}…` : value;
}

export function outcomeTone(outcome: string): string {
    switch (outcome) {
        case "pass":
            return "bg-success/10 text-success";
        case "blocker":
        case "failure":
            return "bg-destructive/10 text-destructive";
        case "warning":
            return "bg-warning/10 text-warning";
        case "unsupported":
            return "bg-secondary text-secondary-foreground";
        default:
            return "bg-muted text-muted-foreground";
    }
}
