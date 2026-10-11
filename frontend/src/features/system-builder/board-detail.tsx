import { Fragment, useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Cable, Eye, EyeOff, Link2, Loader2, Lock, MoreHorizontal, Pencil, Pin, PinOff, RefreshCw, RotateCcw, Scissors, Share2, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getInstanceInterface, type updateInstance } from "@/lib/systems-api";
import { throwIfJobFailed, watchPrismJob } from "@/lib/jobs";
import { cn } from "@/lib/utils";
import type { InstanceComponent, Subport, SystemDocument, SystemInstance, SystemPort } from "@/types/system";

import { ConnectDialog } from "./connect-dialog";
import type { SystemEdits } from "./session/system-session";
import { ExportDialog, exportForPort } from "./exports-section";
import { subportLabel, subportsOf } from "./subport-model";
import { SubportDialog, SubportRows } from "./subport-section";
import { SubsystemDetail } from "./subsystem-detail";
import { boardStatus, shortSha, timeAgo } from "./system-format";
import { useSystemSession } from "./session/use-system-session";
import { InspectorFacts } from "./workspace/inspector-facts";
import { InspectorHeader } from "./workspace/inspector-header";
import { InspectorSection } from "./workspace/inspector-section";
import type { WorkspaceSelection } from "./workspace/workspace-state";

/** Ports a link uses as a whole connector or its remainder; an end on a sub-port counts under the sub-port. */
export function linkedPortKeys(document: SystemDocument, instanceId: string): Set<string> {
  const keys = new Set<string>();
  for (const link of document.links) {
    for (const end of [link.a, link.b]) {
      if (end.instanceId === instanceId && end.port && !end.subport) {
        keys.add(end.port.portKey);
        end.port.memberKeys.forEach((key) => keys.add(key));
      }
    }
  }
  return keys;
}

export function portState(port: Pick<SystemPort, "override" | "exposed">): "promoted" | "hidden" | "exposed" | "not exposed" {
  if (port.override === "promoted") return "promoted";
  if (port.override === "hidden") return "hidden";
  return port.exposed ? "exposed" : "not exposed";
}

interface BoardDetailProps {
  systemId: string;
  document: SystemDocument;
  instance: SystemInstance;
  canEdit: boolean;
  /** SB2-115: a connection made from a port's Connect…, to open. */
  onConnected?: (selection: WorkspaceSelection) => void;
}

interface EditBoardDialogProps {
  instance: SystemInstance;
  busy: boolean;
  onClose: () => void;
  onSave: (fields: { label?: string; trackedRef?: string | null }) => Promise<boolean>;
}

function EditBoardDialog({ instance, busy, onClose, onSave }: EditBoardDialogProps) {
  const [label, setLabel] = useState(instance.label);
  const [branch, setBranch] = useState(instance.trackedRef ?? "");
  const fields: { label?: string; trackedRef?: string | null } = {};
  if (label.trim() && label.trim() !== instance.label) fields.label = label.trim();
  if (branch.trim() !== (instance.trackedRef ?? "")) fields.trackedRef = branch.trim() || null;
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit {instance.label}</DialogTitle>
          <DialogDescription>
            The baseline never moves here: changing the branch only changes which commits are checked from now on.
          </DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={async (event) => {
          event.preventDefault();
          if (await onSave(fields)) onClose();
        }}>
          <div className="grid gap-2">
            <Label htmlFor="board-label">Label</Label>
            <Input id="board-label" aria-label="Board label" value={label} maxLength={100} onChange={(event) => setLabel(event.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="board-branch">Tracked branch</Label>
            <Input id="board-branch" aria-label="Tracked branch" className="font-mono" value={branch} maxLength={200}
              placeholder="Not tracking" onChange={(event) => setBranch(event.target.value)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={busy || !label.trim() || Object.keys(fields).length === 0}>{busy ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function BoardDetail(props: BoardDetailProps) {
  return props.instance.kind === "assembly" || props.instance.kind === "module" || props.instance.kind === "part"
    ? <SubsystemDetail {...props} /> : <BoardDetailBody {...props} />;
}

function BoardDetailBody({ systemId, document, instance, canEdit, onConnected }: BoardDetailProps) {
  const { busy, edit } = useSystemSession();
  const status = boardStatus(instance);
  const [dialog, setDialog] = useState<"edit" | "remove" | null>(null);
  const linkCount = document.links.filter((link) => link.a.instanceId === instance.id || link.b.instanceId === instance.id).length;
  const editable = canEdit && !instance.restricted;

  const removeDialog = (
    <ConfirmDialog
      open={dialog === "remove"}
      onOpenChange={(open) => setDialog(open ? "remove" : null)}
      title={`Remove ${instance.label}?`}
      description={linkCount > 0
        ? `This board is an end of ${linkCount} ${linkCount === 1 ? "link" : "links"}. Removing it deletes those links and their rows.`
        : "The board is removed from this system. The project itself is not touched."}
      confirmLabel="Remove board"
      destructive
      busy={busy === "remove"}
      onConfirm={() => {
        void edit("remove", (system) => system.removeInstance(instance.id, linkCount > 0), `Removed ${instance.label}`)
          .then(() => setDialog(null));
      }}
    />
  );

  if (instance.restricted) {
    return (
      <div className="space-y-4">
        <InspectorHeader kind="Board" title={instance.label} icon={<Lock className="size-4 shrink-0 text-muted-foreground" aria-hidden />}
          status={{ label: instance.projectDeleted ? "Project deleted" : "No access", tone: "muted",
            detail: instance.projectDeleted ? "Only an admin can see what the system kept of it." : "Its project is in a folder you cannot see." }}
          actions={canEdit && instance.projectDeleted && (
            <Button variant="ghost" size="icon-sm" aria-label="Remove board" title="Remove board" onClick={() => setDialog("remove")}>
              <Trash2 className="size-4" />
            </Button>
          )} />
        {removeDialog}
      </div>
    );
  }

  const save = (fields: Parameters<typeof updateInstance>[3], message: string) =>
    edit("update", (system) => system.updateInstance(instance.id, fields), message);
  // The check runs as a job; wait for it so a review it opens shows up on this page.
  const checkBranch = async (system: SystemEdits) => {
    const job = await system.checkNow(instance.id);
    throwIfJobFailed(await watchPrismJob(job.job_id), "The branch check failed");
  };

  const pinToggle = () => void (instance.pinned
    ? edit("update", async (system) => {
      await system.updateInstance(instance.id, { pinned: false });
      await checkBranch(system);
    }, "Unpinned and checked the branch")
    : save({ pinned: true }, "Pinned"));

  return (
    <div className="space-y-5">
      <InspectorHeader kind="Board" title={instance.label} subtitle={instance.projectName}
        status={{ label: status.label, tone: status.tone, detail: status.detail }}
        actions={editable && (
          <>
            {instance.trackedRef && (
              <>
                <Button variant="ghost" size="icon-sm" disabled={busy !== null} aria-label="Check now" title="Check the branch now"
                  onClick={() => void edit("check", checkBranch, "Branch checked")}>
                  <RefreshCw className="size-4" />
                </Button>
                <Button variant="ghost" size="icon-sm" disabled={busy !== null} aria-label={instance.pinned ? "Unpin" : "Pin"}
                  aria-pressed={Boolean(instance.pinned)}
                  title={instance.pinned ? "Unpin: apply or review new commits again" : "Pin: keep this baseline, only report new commits"}
                  onClick={pinToggle}>
                  {instance.pinned ? <PinOff className="size-4" /> : <Pin className="size-4" />}
                </Button>
              </>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label="Board actions"><MoreHorizontal className="size-4" /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem onSelect={() => setDialog("edit")}>
                  <Pencil className="mr-2 h-4 w-4" /> Edit board
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => setDialog("remove")}>
                  <Trash2 className="mr-2 h-4 w-4" /> Remove board
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )} />

      <InspectorFacts rows={[
        { label: "Baseline", value: <span className="font-mono">{shortSha(instance.baselineCommit)}</span>, title: instance.baselineCommit ?? undefined },
        { label: "Branch", value: instance.trackedRef
          ? <span className="font-mono">{instance.trackedRef}{instance.pinned && <Pin className="ml-1.5 inline size-3 text-muted-foreground" aria-label="pinned" />}</span>
          : <span className="text-muted-foreground">Not tracking</span>, title: instance.trackedRef ?? undefined },
        ...(instance.trackedRef ? [{
          label: "Tip",
          value: <><span className="font-mono">{shortSha(instance.tipCommit)}</span>{instance.tipCheckedAt && <span className="text-muted-foreground"> · {timeAgo(instance.tipCheckedAt)}</span>}</>,
          title: instance.tipCheckedAt ? `Checked ${new Date(instance.tipCheckedAt).toLocaleString()}` : undefined,
        }] : []),
      ]} />

      <PortsSection systemId={systemId} document={document} instance={instance} editable={editable} onConnected={onConnected} />

      {dialog === "edit" && (
        <EditBoardDialog instance={instance} busy={busy === "update"} onClose={() => setDialog(null)}
          onSave={async (fields) => Boolean(await save(fields, "Board updated"))} />
      )}

      {removeDialog}
    </div>
  );
}

interface PortsSectionProps {
  systemId: string;
  document: SystemDocument;
  instance: SystemInstance;
  editable: boolean;
  onConnected?: (selection: WorkspaceSelection) => void;
}

function PortsSection({ systemId, document, instance, editable, onConnected }: PortsSectionProps) {
  const { busy, etag, edit } = useSystemSession();
  const [showAll, setShowAll] = useState(false);
  const [exporting, setExporting] = useState<{ port: SystemPort; subport?: Subport } | null>(null);
  const [connecting, setConnecting] = useState<SystemPort | null>(null);
  const [splitting, setSplitting] = useState<{ port: SystemPort; subport?: Subport } | null>(null);
  // CONTRACTS_P2 §22.2: a connector in a board-to-board link is never split.
  const b2bMated = new Set<string>();
  for (const link of document.links) {
    if (link.type !== "b2b") continue;
    for (const end of [link.a, link.b]) {
      if (end.instanceId === instance.id && end.port) b2bMated.add(end.port.portKey);
    }
  }
  const [components, setComponents] = useState<{ key: string; items: InstanceComponent[] } | null>(null);
  const linked = linkedPortKeys(document, instance.id);
  const componentsKey = `${instance.id}:${instance.baselineCommit}:${etag}`;

  const loadComponents = useCallback(async () => {
    const result = await getInstanceInterface(systemId, instance.id);
    if (result.state === "ready") {
      setComponents({ key: componentsKey, items: result.body.components });
    } else {
      toast.info("The board interface is still being read. Try again in a moment.");
      setShowAll(false);
    }
  }, [systemId, instance.id, componentsKey]);

  // The full component list is a separate read; refresh it when the system moves on.
  useEffect(() => {
    if (showAll && components?.key !== componentsKey) {
      loadComponents().catch((error: unknown) => toast.error(error instanceof Error ? error.message : "Could not read the board"));
    }
  }, [showAll, components?.key, componentsKey, loadComponents]);

  if (instance.interface?.status !== "ready") {
    return (
      <InspectorSection title="Ports">
        <p className="flex h-8 items-center gap-2 text-sm text-muted-foreground">
          {instance.interface?.status === "failed"
            ? `Unreadable (${instance.interface.errorCode ?? "unknown error"})`
            : <><Loader2 className="size-3.5 animate-spin" aria-hidden /> Reading…</>}
        </p>
      </InspectorSection>
    );
  }

  const rows: SystemPort[] = showAll && components?.key === componentsKey
    ? components.items.map((component) => ({ ...component, pinCount: component.pins.length }))
    : instance.ports ?? [];

  const setOverride = (port: SystemPort, state: "hidden" | "promoted" | null, message: string) =>
    edit("override", (system) => system.setPortOverride(instance.id, port.portKey, state), message);

  return (
    <InspectorSection title={showAll ? "All parts" : "Ports"} count={rows.length}
      action={(
        <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" aria-pressed={showAll}
          title={showAll ? "Show the ports only" : "Show every part, to promote one to a port"} onClick={() => setShowAll((value) => !value)}>
          {showAll ? "Ports only" : "All parts"}
        </Button>
      )}>
      {rows.length === 0 ? <p className="h-8 text-sm text-muted-foreground">None</p> : (
        <ul aria-label={showAll ? "All parts" : "Ports"} className="text-sm">
          {rows.map((port) => {
            const state = portState(port);
            const isLinked = linked.has(port.portKey);
            const exported = exportForPort(document, instance.id, port.portKey);
            const subports = subportsOf(instance, port.portKey);
            return (
              <Fragment key={port.portKey}>
              <li className={cn("flex h-8 items-center gap-2 border-b last:border-b-0",
                (state === "hidden" || state === "not exposed") && "text-muted-foreground")}>
                <span className="w-14 shrink-0 truncate font-mono text-xs font-medium" title={port.libId ?? port.reference}>{port.reference}</span>
                <span className="min-w-0 flex-1 truncate text-muted-foreground" title={port.value ?? undefined}>{port.value ?? ""}</span>
                <span className="flex shrink-0 items-center gap-1 text-muted-foreground">
                  {isLinked && <Link2 className="size-3.5" aria-label="linked" />}
                  {exported && <Share2 className="size-3.5" aria-label={`exported as ${exported.name}`} />}
                  {state === "hidden" && <EyeOff className="size-3.5" aria-label="hidden" />}
                  {state === "promoted" && <Eye className="size-3.5" aria-label="promoted" />}
                </span>
                <span className="w-8 shrink-0 text-right text-xs tabular-nums text-muted-foreground" title={`${port.pinCount} pins`}>{port.pinCount}</span>
                {editable && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="size-6 shrink-0" aria-label={`Actions for ${port.reference}`} disabled={busy !== null}>
                        <MoreHorizontal className="size-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {port.exposed && onConnected && (
                        <DropdownMenuItem onSelect={() => setConnecting(port)}><Cable className="mr-2 h-4 w-4" /> Connect…</DropdownMenuItem>
                      )}
                      {port.exposed && !isLinked && !exported && (
                        <DropdownMenuItem onSelect={() => setExporting({ port })}><Share2 className="mr-2 h-4 w-4" /> Export</DropdownMenuItem>
                      )}
                      {port.exposed && !(exported && !subports.length) && (
                        <DropdownMenuItem disabled={b2bMated.has(port.portKey)} onSelect={() => setSplitting({ port })}>
                          <Scissors className="mr-2 h-4 w-4" /> {b2bMated.has(port.portKey) ? "Split (board-to-board)" : "Split"}
                        </DropdownMenuItem>
                      )}
                      {port.override !== null ? (
                        <DropdownMenuItem disabled={port.override === "promoted" && isLinked && !port.candidate}
                          onSelect={() => void setOverride(port, null, `${port.reference} reset`)}>
                          <RotateCcw className="mr-2 h-4 w-4" /> Reset
                        </DropdownMenuItem>
                      ) : port.exposed ? (
                        <DropdownMenuItem disabled={isLinked || Boolean(exported) || subports.length > 0}
                          onSelect={() => void setOverride(port, "hidden", `${port.reference} hidden`)}>
                          <EyeOff className="mr-2 h-4 w-4" /> {isLinked ? "Hide (linked)" : exported ? "Hide (exported)"
                            : subports.length ? "Hide (split)" : "Hide"}
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem onSelect={() => void setOverride(port, "promoted", `${port.reference} promoted`)}>
                          <Eye className="mr-2 h-4 w-4" /> Promote to port
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </li>
              {subports.length > 0 && (
                <SubportRows document={document} instance={instance} port={port} subports={subports} editable={editable}
                  onEdit={(subport) => setSplitting({ port, subport })} onExport={(subport) => setExporting({ port, subport })} />
              )}
              </Fragment>
            );
          })}
        </ul>
      )}
      {splitting && (
        <SubportDialog systemId={systemId} document={document} instance={instance} port={splitting.port}
          subport={splitting.subport} onClose={() => setSplitting(null)}
          others={subportsOf(instance, splitting.port.portKey).filter((other) => other.id !== splitting.subport?.id)} />
      )}
      {connecting && onConnected && (
        <ConnectDialog document={document}
          from={{ instanceId: instance.id, portKey: connecting.portKey }} onClose={() => setConnecting(null)}
          onCreated={(selection) => { setConnecting(null); onConnected(selection); }} />
      )}
      {exporting && (() => {
        const { port, subport } = exporting;
        const label = subportLabel(port.reference, subport?.name);
        return (
          <ExportDialog title={`Export ${instance.label} ${label}`}
            description="Publish this connector so a parent system can link to it. A linked port cannot be exported."
            initial={{ name: label, description: "" }} submitLabel="Export"
            existingNames={(document.exports ?? []).map((entry) => entry.name)} busy={busy === "export"}
            onClose={() => setExporting(null)}
            onSubmit={async (value) => {
              const done = await edit("export", (system) => system.createExport(
                { ...value, instanceId: instance.id, portKey: port.portKey, ...(subport ? { subportId: subport.id } : {}) }),
              `Exported ${label} as ${value.name}`);
              if (done) setExporting(null);
            }} />
        );
      })()}
    </InspectorSection>
  );
}
