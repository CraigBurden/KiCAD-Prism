import { useEffect, useState } from "react";
import { BookOpen, ExternalLink, Layers, Lock, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fetchJson } from "@/lib/api";
import type { CatalogComponent } from "@/types/catalog";
import type { SystemDocument, SystemInstance } from "@/types/system";

import { catalogComponentHref } from "./publish-dialog";
import { releaseChain } from "./release-chain";
import { boardStatus } from "./system-format";
import { sessionReads } from "./session/session-reads";
import { useSessionRead, useSystemSession } from "./session/use-system-session";
import { InspectorFacts } from "./workspace/inspector-facts";
import { InspectorHeader } from "./workspace/inspector-header";
import { InspectorSection } from "./workspace/inspector-section";


interface SubsystemDetailProps {
  systemId: string;
  document: SystemDocument;
  instance: SystemInstance;
  canEdit: boolean;
}

/**
 * An assembly instance: the catalog revision it pins and the boards inside it (CONTRACTS_P2 §5). A module
 * instance (§5.6) shows the same revision facts and its connectors.
 */
export function SubsystemDetail({ document, instance, canEdit }: SubsystemDetailProps) {
  const { busy, edit } = useSystemSession();
  const isModule = instance.kind === "module";
  const isPart = instance.kind === "part";  // a mechanical part: revision facts only (P2 §24.1)
  const noun = isModule ? "module" : isPart ? "part" : "subsystem";
  const [removing, setRemoving] = useState(false);
  const ref = instance.catalog;
  const status = boardStatus(instance);
  const linkCount = document.links.filter((link) => link.a.instanceId === instance.id || link.b.instanceId === instance.id).length;
  const tree = useSessionRead(sessionReads.hierarchy()).data;

  const inside = (tree?.occurrences ?? [])
    .filter((occurrence) => occurrence.path.startsWith(`/${instance.id}/`));

  const updates = canEdit ? (
    <Select value={ref?.follow ?? "pinned"} disabled={busy !== null}
      onValueChange={(value) => void edit("update", (system) => system.updateInstance(instance.id,
        { follow: value as "pinned" | "latest_released" }), value === "pinned" ? "Pinned to this revision" : "Following released revisions")}>
      <SelectTrigger aria-label="Updates" className="h-7 border-0 px-0 shadow-none"><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="latest_released">Follow releases</SelectItem>
        <SelectItem value="pinned">Keep this revision</SelectItem>
      </SelectContent>
    </Select>
  ) : (ref?.follow === "pinned" ? "Keep this revision" : "Follow releases");

  return (
    <div className="space-y-5">
      <InspectorHeader kind={isModule ? "Module" : isPart ? "Part" : "Subsystem"} title={instance.label}
        subtitle={[instance.projectName, ref?.identity].filter(Boolean).join(" · ") || undefined}
        status={{ label: status.label, tone: status.tone, detail: status.detail }}
        actions={(
          <>
            {ref?.systemId && (
              <Button asChild variant="ghost" size="icon-sm">
                <a href={`/systems/${encodeURIComponent(ref.systemId)}`} aria-label="Open its system" title="Open its system"><ExternalLink className="size-4" /></a>
              </Button>
            )}
            {ref && (
              <Button asChild variant="ghost" size="icon-sm">
                <a href={catalogComponentHref(ref.componentId)} aria-label="Open in the library" title="Open in the library"><BookOpen className="size-4" /></a>
              </Button>
            )}
            {canEdit && (
              <Button variant="ghost" size="icon-sm" aria-label={`Remove ${noun}`} title={`Remove ${noun}`} onClick={() => setRemoving(true)}>
                <Trash2 className="size-4" />
              </Button>
            )}
          </>
        )} />

      <InspectorFacts rows={[
        { label: "Revision", value: releaseChain(ref).text },
        ...(!isModule && !isPart ? [{ label: "Snapshot", value: ref?.snapshotName ?? "—" }] : []),
        ...(!isModule && !isPart && ref?.findingCounts ? [{ label: "Findings inside",
          value: `${ref.findingCounts.error} ${ref.findingCounts.error === 1 ? "error" : "errors"} · ${ref.findingCounts.warning} ${ref.findingCounts.warning === 1 ? "warning" : "warnings"}` }] : []),
        { label: "Updates", value: updates },
      ]} />

      {!isPart && <InspectorSection title={isModule ? "Connectors" : "Exports"} count={(instance.ports ?? []).length}>
        {(instance.ports ?? []).length === 0 ? <p className="h-8 text-sm text-muted-foreground">None</p> : (
          <ul className="text-sm">
            {(instance.ports ?? []).map((port) => (
              <li key={port.portKey} className="flex h-8 items-center gap-2 border-b last:border-b-0">
                <span className="w-14 shrink-0 truncate font-mono text-xs font-medium" title={port.reference}>{port.reference}</span>
                <span className="min-w-0 flex-1 truncate text-muted-foreground" title={port.value ?? undefined}>{port.value ?? ""}</span>
                <span className="w-8 shrink-0 text-right text-xs tabular-nums text-muted-foreground" title={`${port.pinCount} pins`}>{port.pinCount}</span>
              </li>
            ))}
          </ul>
        )}
      </InspectorSection>}

      {!isModule && !isPart && (
        <InspectorSection title="Inside" count={inside.length}>
          {inside.length === 0 ? (
            <p className="h-8 text-sm text-muted-foreground">{tree ? "Nothing visible" : "Reading…"}</p>
          ) : (
            <ul className="text-sm" aria-label="Subsystem contents">
              {inside.map((occurrence) => (
                <li key={occurrence.path} className="flex h-7 items-center gap-2" style={{ paddingLeft: `${(occurrence.depth - 2) * 16}px` }}>
                  {occurrence.kind === "assembly" ? <Layers className="size-3.5 shrink-0 text-muted-foreground" aria-hidden /> : null}
                  {occurrence.restricted ? <Lock className="size-3 shrink-0" aria-label="restricted" /> : null}
                  <span className="truncate">{occurrence.labels[occurrence.labels.length - 1]}</span>
                </li>
              ))}
            </ul>
          )}
        </InspectorSection>
      )}

      <ConfirmDialog
        open={removing}
        onOpenChange={setRemoving}
        title={`Remove ${instance.label}?`}
        description={linkCount > 0
          ? `This ${noun} is an end of ${linkCount} ${linkCount === 1 ? "link" : "links"}. Removing it deletes those links and their rows.`
          : `The ${noun} is removed from this system. The catalog item is not touched.`}
        confirmLabel={`Remove ${noun}`}
        destructive
        busy={busy === "remove"}
        onConfirm={() => {
          void edit("remove", (system) => system.removeInstance(instance.id, linkCount > 0), `Removed ${instance.label}`)
            .then(() => setRemoving(false));
        }}
      />
    </div>
  );
}

interface AddSubsystemDialogProps {
  /** `module`: a bought-out catalog module (§5.6); an assembly otherwise. */
  kind?: "assembly" | "module";
  existingLabels: string[];
  busy: boolean;
  onClose: () => void;
  onSubmit: (value: { label: string; componentId: string; revisionId?: string; follow: "pinned" | "latest_released" }) => void | Promise<void>;
}

/** Pick a catalog assembly (or module) to place in this system. */
export function AddSubsystemDialog({ kind = "assembly", existingLabels, busy, onClose, onSubmit }: AddSubsystemDialogProps) {
  const isModule = kind === "module";
  const [items, setItems] = useState<CatalogComponent[] | null>(null);
  const [componentId, setComponentId] = useState("");
  const [label, setLabel] = useState("");
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchJson<{ items: CatalogComponent[] }>(`/api/catalog/components?kind=${kind}&page_size=200`)
      .then((body) => !cancelled && setItems(body.items))
      .catch((error: unknown) => !cancelled && setFailed(error instanceof Error ? error.message : "Could not read the catalog"));
    return () => {
      cancelled = true;
    };
  }, [kind]);

  const chosen = items?.find((item) => item.id === componentId);
  const released = Boolean(chosen?.released_revision_id);
  const taken = existingLabels.some((existing) => existing.toLowerCase() === label.trim().toLowerCase());
  const ready = Boolean(chosen) && label.trim().length > 0 && !taken;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isModule ? "Add a module" : "Add a subsystem"}</DialogTitle>
          <DialogDescription>
            {isModule
              ? "Place a catalog module (a bought-out unit). Its connectors are ports: link, harness and mate them like a board's."
              : "Place a published assembly in this system. Link to its exports like any other port."}
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={(event) => {
          event.preventDefault();
          if (!ready || !chosen) return;
          void onSubmit(released
            ? { label: label.trim(), componentId: chosen.id, follow: "latest_released" }
            : { label: label.trim(), componentId: chosen.id, revisionId: chosen.current_revision_id, follow: "pinned" });
        }}>
          <div className="space-y-1.5">
            <Label htmlFor="subsystem-component">{isModule ? "Module" : "Assembly"}</Label>
            {failed ? <p className="text-sm text-destructive">{failed}</p> : (
              <Select value={componentId} onValueChange={(value) => {
                setComponentId(value);
                const item = items?.find((candidate) => candidate.id === value);
                if (item && !label.trim()) setLabel(item.name);
              }}>
                <SelectTrigger id="subsystem-component" aria-label={isModule ? "Module" : "Assembly"}>
                  <SelectValue placeholder={items ? (items.length ? `Choose ${isModule ? "a module" : "an assembly"}`
                    : isModule ? "No modules in the catalog yet" : "No assemblies published yet") : "Loading…"} />
                </SelectTrigger>
                <SelectContent>
                  {(items ?? []).map((item) => (
                    <SelectItem key={item.id} value={item.id}>{item.name} · {item.value}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {chosen && !released && (
              <p className="text-xs text-warning">Not released yet: it will be pinned to its current revision, with a warning, until QA releases one.</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="subsystem-label">Label in this system</Label>
            <Input id="subsystem-label" value={label} maxLength={100} placeholder="e.g. CNDH-A" onChange={(event) => setLabel(event.target.value)} />
            {taken && <p className="text-xs text-destructive">Another instance already has this label.</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={busy || !ready}>{busy ? "Adding…" : isModule ? "Add module" : "Add subsystem"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
