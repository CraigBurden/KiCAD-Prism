import { FileText, GitCommit, Layers3 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

import type { ProjectCommit, ReleaseConfiguration } from "../types";

export function SelectRevisionStep({
    commits,
    commitSha,
    onSelect,
    onContinue,
    loading,
    actionLabel = "Continue",
    busy = false,
    configurations,
    configKey,
    variant,
    onConfigKey,
    onVariant,
}: {
    commits: ProjectCommit[];
    commitSha: string;
    onSelect: (sha: string) => void;
    onContinue: () => void;
    loading: boolean;
    /** Label for the action. Starting a fresh run builds; revisiting the
     *  source of an existing run just moves on. */
    actionLabel?: string;
    busy?: boolean;
    configurations: ReleaseConfiguration[] | null;
    configKey: string;
    variant: string;
    onConfigKey: (key: string) => void;
    onVariant: (value: string) => void;
}) {
    const configuration = configurations?.find((item) => item.config_key === configKey)
        ?? configurations?.[0]
        ?? null;
    const variants = configuration?.variants?.length
        ? configuration.variants
        : configuration?.default_variant
          ? [configuration.default_variant]
          : [""];
    const revisionValid = /^[a-f0-9]{40}$/i.test(commitSha)
        && commits.some((commit) => commit.full_hash === commitSha);
    return (
        <div className="space-y-4">
            <div>
                <h3 className="text-lg font-semibold">New release</h3>
            </div>
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(18rem,0.75fr)]">
                <section className="space-y-2">
                    <Label htmlFor="rs-commit-paste">Revision</Label>
                    <Input
                        id="rs-commit-paste"
                        value={commitSha}
                        onChange={(event) => onSelect(event.target.value)}
                        className="font-mono text-xs"
                        placeholder="Full 40-character commit SHA"
                        aria-invalid={Boolean(commitSha) && !loading && !revisionValid}
                    />
                    {!loading && !revisionValid && (
                        <p className="text-xs text-destructive">Choose a listed immutable commit.</p>
                    )}
                    <div className="max-h-64 overflow-y-auto border">
                        {loading && <p className="p-3 text-sm text-muted-foreground">Loading revisions…</p>}
                        {!loading && commits.length === 0 && <p className="p-3 text-sm text-muted-foreground">No revisions available.</p>}
                        {commits.map((commit) => {
                            const active = commitSha === commit.full_hash;
                            return <button key={commit.full_hash} type="button" onClick={() => onSelect(commit.full_hash)} className={cn("flex w-full items-start gap-3 border-b px-3 py-2 text-left text-sm last:border-b-0", active ? "bg-muted" : "hover:bg-muted/50")}>
                                <GitCommit className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                                <span className="min-w-0 flex-1"><span className="block truncate font-medium">{commit.message.split("\n")[0]}</span><span className="text-xs text-muted-foreground"><span className="font-mono">{commit.hash}</span>{" · "}{commit.author}</span></span>
                            </button>;
                        })}
                    </div>
                </section>
                <section className="space-y-3">
                    <div className="space-y-2"><Label>Configuration</Label>
                        {configurations === null && <p className="text-sm text-muted-foreground">Loading configuration…</p>}
                        {configurations?.length === 0 && <p className="text-sm text-destructive">No release configuration at this revision.</p>}
                        <div className="grid gap-2">{configurations?.map((item) => <button key={item.config_key} type="button" onClick={() => onConfigKey(item.config_key)} aria-pressed={configuration?.config_key === item.config_key} className={cn("rounded border p-3 text-left", configuration?.config_key === item.config_key ? "border-primary bg-muted" : "hover:bg-muted/40")}><span className="flex items-center gap-2 font-medium"><Layers3 className="h-4 w-4" />{item.title}</span><span className="mt-1 block font-mono text-xs text-muted-foreground">{item.config_key}</span></button>)}</div>
                    </div>
                    <div className="space-y-2"><Label>Variant</Label><div className="flex flex-wrap gap-2">{variants.map((item) => <Button key={item || "default"} type="button" size="sm" variant={(variant || configuration?.default_variant || "") === item ? "default" : "outline"} onClick={() => onVariant(item)}>{item || "Default"}</Button>)}</div></div>
                </section>
            </div>
            <div className="flex flex-wrap items-center gap-2 rounded border bg-muted/30 px-3 py-2 text-xs"><GitCommit className="h-4 w-4" /><span className="font-mono">{revisionValid ? commitSha.slice(0, 12) : "No immutable revision"}</span><BadgeLike label={configuration?.config_key || "no config"} /><BadgeLike label={variant || configuration?.default_variant || "default"} /><BadgeLike label={`Document ${configuration?.document_number || "—"}`} /><BadgeLike label={`Rev ${configuration?.revision || "—"}`} /><FileText className="ml-auto h-4 w-4 text-muted-foreground" /></div>
            <Button onClick={onContinue} disabled={!revisionValid || busy || !configuration}>
                {actionLabel}
            </Button>
        </div>
    );
}

function BadgeLike({ label }: { label: string }) {
    return <span className="rounded border bg-background px-2 py-1">{label}</span>;
}
