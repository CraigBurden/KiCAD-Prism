import { useState } from "react";
import { toast } from "sonner";
import { ArrowRight, CheckCircle2, GitCommitHorizontal, Layers, Pin, Wand2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { AuditEvent, Decision, ImportEntry, Review, ReviewItem, SystemDocument, SystemInstance } from "@/types/system";

import {
  DECISION_LABELS,
  KIND_LABELS,
  allowedDecisions,
  automaticEvents,
  describeValue,
  groupItems,
  progress,
} from "./review-model";
import { entrySide } from "./import-model";
import type { SystemTabProps } from "./system-tab-content";
import { shortSha, timeAgo } from "./system-format";
import { sessionReads } from "./session/session-reads";
import { useSessionRead, useSystemSession, type Edit } from "./session/use-system-session";
import { endReference } from "./subport-model";

function linkName(document: SystemDocument, linkId: string | null): string {
  const link = document.links.find((candidate) => candidate.id === linkId);
  if (link) return link.name || `${endReference(link.a) ?? "?"} ↔ ${endReference(link.b) ?? "?"}`;
  const harness = (document.harnesses ?? []).find((candidate) => candidate.id === linkId);
  return harness ? harness.name : "deleted link";
}

export function ChangesTab({ document, canEdit, onNavigate }: SystemTabProps) {
  // Reviews and recent automatic changes follow the system version.
  const changes = useSessionRead(sessionReads.changes());
  const loaded = changes.data;

  if (changes.error && !loaded) {
    return <p className="p-4 text-sm text-destructive" role="alert">{changes.error instanceof Error ? changes.error.message : "Could not load changes"}</p>;
  }
  if (!loaded) {
    return <p className="p-4 text-sm text-muted-foreground">Loading…</p>;
  }

  const instances = new Map(document.instances.map((instance) => [instance.id, instance]));
  const updates = document.instances.filter((instance) => instance.pinned && instance.updateAvailable && !instance.restricted);
  const automatic = automaticEvents(loaded.events).slice(0, 10);
  const nothing = loaded.reviews.length === 0 && updates.length === 0;

  return (
    <div className="space-y-4 p-4">
      {nothing && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground" title="Every board is at its accepted baseline">
          <CheckCircle2 className="size-4 text-success" /> Nothing to review
        </p>
      )}

      {loaded.reviews.map((review) => (
        <ReviewCard
          key={review.id}
          document={document}
          review={review}
          instance={review.instanceId ? instances.get(review.instanceId) ?? null : null}
          canEdit={canEdit}
          onOpenLink={(linkId) => onNavigate("connectivity", { link: linkId })}
        />
      ))}

      {updates.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Updates on pinned boards</h2>
          {updates.map((instance) => (
            <UpdateRow key={instance.id} instance={instance} canEdit={canEdit} />
          ))}
        </section>
      )}

      {automatic.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
            title="Changes that kept every connected pin on the same nets are applied without review">Applied automatically</h2>
          <ul className="text-sm">
            {automatic.map((event) => (
              <li key={event.id} className="flex h-8 items-center gap-2 border-b last:border-b-0">
                <Wand2 className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="shrink-0 font-medium">{event.kind.replace(/_/g, " ")}</span>
                <span className="min-w-0 flex-1 truncate text-muted-foreground">{automaticSummary(event, instances)}</span>
                <span className="shrink-0 text-xs text-muted-foreground" title={new Date(event.at).toLocaleString()}>{timeAgo(event.at)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function automaticSummary(event: AuditEvent, instances: Map<string, SystemInstance>): string {
  if (event.redacted || !event.payload) {
    return "on a restricted board";
  }
  const payload = event.payload as Record<string, unknown>;
  const board = typeof payload.instanceId === "string" ? instances.get(payload.instanceId)?.label ?? "" : "";
  if (event.kind === "baseline_auto_advanced") {
    return `${board} ${shortSha(payload.from as string)} → ${shortSha(payload.to as string)}`;
  }
  const before = payload.before as { reference?: string } | undefined;
  const after = payload.after as { reference?: string } | undefined;
  return `${board} ${before?.reference ?? ""} → ${after?.reference ?? ""}`.trim();
}

interface ReviewCardProps {
  document: SystemDocument;
  review: Review;
  instance: SystemInstance | null;
  canEdit: boolean;
  onOpenLink: (linkId: string) => void;
}

function ReviewCard({ document, review, instance, canEdit, onOpenLink }: ReviewCardProps) {
  const { busy, edit } = useSystemSession();
  const title = review.kind === "import" ? "CSV import" : review.kind === "manifest_import" ? "Repository manifest"
    : instance?.label ?? "Board";
  const { decided, total } = progress(review);
  const groups = groupItems(review.items ?? []);
  const silent = review.pendingChanges?.silent ?? [];
  const editable = canEdit && !review.redacted;

  return (
    <section className="space-y-3 rounded-lg border p-4" aria-label={`Review ${title}`}>
      <header className="flex flex-wrap items-center gap-2">
        <h2 className="text-base font-semibold">{title}</h2>
        <Badge variant="outline">{review.kind.replace(/_/g, " ")}</Badge>
        {review.kind === "child_update" && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Layers className="h-3.5 w-3.5" /> revision {instance?.catalog?.version ? `v${instance.catalog.version}` : "pinned"}
            <ArrowRight className="h-3 w-3" /> a newer revision
          </span>
        )}
        {review.kind !== "child_update" && review.fromCommit && (
          <span className="flex items-center gap-1 font-mono text-xs text-muted-foreground">
            <GitCommitHorizontal className="h-3.5 w-3.5" /> {shortSha(review.fromCommit)}
            <ArrowRight className="h-3 w-3" /> {shortSha(review.toCommit)}
          </span>
        )}
        {total > 0 && <span className="text-xs text-muted-foreground">{decided} of {total} decided</span>}
        {editable && (review.kind === "source_update" || review.kind === "child_update") && (
          <Button variant="outline" size="sm" className="ml-auto" disabled={busy !== null}
            title="Close this review, keep the current baseline and pin the board"
            onClick={() => void edit("pin", (system) => system.keepPinned(review.id), `${title} kept pinned`)}>
            <Pin className="mr-1 h-4 w-4" /> Keep pinned
          </Button>
        )}
      </header>

      {review.redacted && <p className="text-sm text-muted-foreground">This review is on a board you cannot see.</p>}

      {review.kind === "manifest_import" && (
        <ManifestImport review={review} editable={editable} />
      )}

      {review.kind === "baseline_unreachable" && instance && (
        <div className="space-y-2 text-sm">
          <p title="The branch was probably rewritten. Rebase the board onto a commit that exists to re-check its connections.">
            Baseline <span className="font-mono">{shortSha(instance.baselineCommit)}</span> is no longer in the repository.
          </p>
          {editable && <RebaseForm instance={instance} />}
        </div>
      )}

      {silent.length > 0 && (
        <Group title="Resolved automatically when applied" tone="ok">
          {silent.map((change) => (
            <li key={`${change.kind}-${change.linkId}-${change.end}`} className="px-3 py-2 text-sm">
              <span className="font-medium">{change.kind.replace(/_/g, " ")}</span>{" "}
              <span className="text-muted-foreground">
                {linkName(document, change.linkId)} end {change.end.toUpperCase()}
                {" · "}{describeValue((change.before as { reference?: string } | undefined)?.reference)}
                {" → "}{describeValue((change.after as { reference?: string } | undefined)?.reference)}
              </span>
            </li>
          ))}
        </Group>
      )}

      {groups.conflict.length > 0 && (
        <Group title="Conflicts: choose a new mapping" tone="error">
          {groups.conflict.map((item) => (
            <ItemRow key={item.id} document={document} review={review} item={item}
              editable={editable} onOpenLink={onOpenLink} />
          ))}
        </Group>
      )}
      {groups.review.length > 0 && (
        <Group title="Review required" tone="warning">
          {groups.review.map((item) => (
            <ItemRow key={item.id} document={document} review={review} item={item}
              editable={editable} onOpenLink={onOpenLink} />
          ))}
        </Group>
      )}
    </section>
  );
}

const AREAS = [["instances", "Boards and subsystems"], ["links", "Links"], ["harnesses", "Harnesses"], ["exports", "Exports"]] as const;

/** P2 §21.3: a manifest pushed outside Prism, accepted (the system becomes it) or rejected as a whole. */
function ManifestImport({ review, editable }: { review: Review; editable: boolean }) {
  const { busy, edit } = useSystemSession();
  const summary = review.pendingChanges?.summary ?? null;
  const problems = review.pendingChanges?.problems ?? [];
  const lines = summary ? AREAS.flatMap(([area, label]) => (["added", "removed", "changed"] as const)
    .filter((change) => summary[area][change].length > 0)
    .map((change) => `${label} ${change}: ${summary[area][change].join(", ")}`)) : [];
  if (summary?.system.length) lines.unshift(`System ${summary.system.join(", ")} changed`);
  if (summary?.placement) lines.push("3D placement changed");
  if (summary?.layout) lines.push("Canvas layout changed");
  const decide = (decision: "accept" | "reject") => edit(`manifest-${decision}`,
    (system) => system.decideManifestImport(review.id, decision),
    decision === "accept" ? "Repository manifest imported" : "Repository manifest rejected");
  return (
    <div className="space-y-2 text-sm">
      <p title="Snapshots wait until you decide.">prism.system.json changed on the linked branch outside Prism.</p>
      {problems.length > 0 ? (
        <Group title="It cannot be imported" tone="error">
          {problems.map((problem) => <li key={problem} className="px-3 py-2">{problem}</li>)}
        </Group>
      ) : (
        <Group title="What it changes" tone="warning">
          {(lines.length ? lines : ["Nothing Prism tracks"]).map((line) => <li key={line} className="px-3 py-2">{line}</li>)}
        </Group>
      )}
      {editable && (
        <div className="flex gap-2">
          <Button size="sm" disabled={busy !== null || problems.length > 0} onClick={() => void decide("accept")}
            title="Replace this system with that manifest, including edits not yet in a snapshot">Accept</Button>
          <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => void decide("reject")}
            title="Keep the system as it is; the next snapshot replaces the manifest on the branch">Reject</Button>
        </div>
      )}
    </div>
  );
}

function Group({ title, tone, children }: { title: string; tone: "ok" | "warning" | "error"; children: React.ReactNode }) {
  return (
    <div className={cn("rounded-md border", tone === "error" && "border-destructive/40", tone === "warning" && "border-warning/40")}>
      <h3 className={cn("border-b px-3 py-1.5 text-xs font-semibold uppercase tracking-wide",
        tone === "error" ? "text-destructive" : tone === "warning" ? "text-warning" : "text-success")}>
        {title}
      </h3>
      <ul className="divide-y">{children}</ul>
    </div>
  );
}

interface ItemRowProps {
  document: SystemDocument;
  review: Review;
  item: ReviewItem;
  editable: boolean;
  onOpenLink: (linkId: string) => void;
}

/** An import item's stored proposal: a link row, or a harness wire (§17.4). */
type ImportProposal = Pick<ImportEntry, "from" | "to" | "signal" | "linkName" | "kind" | "fromEnd" | "fromPin" | "toEnd" | "toPin">;

function ItemRow({ document, review, item, editable, onOpenLink }: ItemRowProps) {
  const { busy, edit } = useSystemSession();
  const [pad, setPad] = useState("");
  const [candidate, setCandidate] = useState(item.candidates?.[0]?.portKey ?? "");
  const [signal, setSignal] = useState("");
  const allowed = allowedDecisions(review, item.kind);
  const proposal = review.kind === "import" ? (item.observed as ImportProposal | null) : null;

  const decide = (decision: Decision, payload?: Record<string, unknown>) =>
    edit("decide", (system) => system.decideReviewItem(review.id, item.id, decision, payload),
      `${DECISION_LABELS[decision]} recorded`);

  if (item.redacted) {
    return <li className="px-3 py-2 text-sm text-muted-foreground">An item on a board you cannot see.</li>;
  }

  return (
    <li className="space-y-2 px-3 py-2 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">{KIND_LABELS[item.kind]}</span>
        {item.linkId && (document.links.some((link) => link.id === item.linkId) ? (
          <button type="button" className="text-primary hover:underline" onClick={() => onOpenLink(item.linkId as string)}>
            {linkName(document, item.linkId)}
          </button>
        ) : <span>{linkName(document, item.linkId)}</span>)}
        {item.end && <span className="text-muted-foreground">end {item.end.toUpperCase()}</span>}
        {item.pins.length > 0 && <span className="font-mono text-xs text-muted-foreground">pins {item.pins.join(", ")}</span>}
        {item.decision && (
          <Badge variant="success" className="ml-auto">
            {DECISION_LABELS[item.decision]}
            {item.decisionPayload?.pad ? ` → ${String(item.decisionPayload.pad)}` : ""}
          </Badge>
        )}
      </div>

      {proposal ? (
        <p className="font-mono text-xs">
          {proposal.kind === "wire" && `${proposal.linkName}: `}{entrySide(proposal, "from")} ↔ {entrySide(proposal, "to")}
          {" · signal "}<span className="text-warning">{proposal.signal}</span>
          {" · nets "}{describeValue((item.expected as { leaves?: string[] } | null)?.leaves)}
        </p>
      ) : item.kind !== "connector_missing" ? (
        <div className="grid gap-1 font-mono text-xs sm:grid-cols-2">
          <span className="rounded bg-destructive/10 px-2 py-1"><span className="text-muted-foreground">− </span>{describeValue(item.expected)}</span>
          <span className="rounded bg-success/10 px-2 py-1"><span className="text-muted-foreground">+ </span>{describeValue(item.observed)}</span>
        </div>
      ) : null}

      {item.kind === "connector_missing" && (item.candidates?.length ?? 0) === 0 && (
        <p className="text-xs text-muted-foreground">No candidate connector was found. Fix the board, or delete the link.</p>
      )}

      {editable && allowed.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {allowed.includes("accept") && (
            review.kind === "import" ? (
              <>
                <Input aria-label="Signal to use" className="h-8 w-40 text-xs" placeholder={proposal?.signal ?? "signal"}
                  value={signal} maxLength={200} onChange={(event) => setSignal(event.target.value)} />
                <Button size="sm" variant="outline" disabled={busy !== null}
                  onClick={() => void decide("accept", signal.trim() ? { signal: signal.trim() } : undefined)}>
                  Create row
                </Button>
              </>
            ) : (
              <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => void decide("accept")}>Accept</Button>
            )
          )}
          {allowed.includes("remap") && (
            <>
              <Input aria-label="Remap to pad" className="h-8 w-24 font-mono text-xs" placeholder="pad" value={pad}
                maxLength={100} onChange={(event) => setPad(event.target.value)} />
              <Button size="sm" variant="outline" disabled={busy !== null || !pad.trim()}
                onClick={() => void decide("remap", { pad: pad.trim() })}>
                Remap
              </Button>
            </>
          )}
          {allowed.includes("bind_candidate") && (item.candidates?.length ?? 0) > 0 && (
            <>
              <Select value={candidate} onValueChange={setCandidate}>
                <SelectTrigger aria-label="Candidate connector" className="h-8 w-auto min-w-48 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {item.candidates?.map((option) => (
                    <SelectItem key={option.portKey} value={option.portKey} className="text-xs">
                      {option.reference} · {Math.round(option.netOverlap * 100)}% nets
                      {option.libIdEqual ? " · same part" : ""}{option.pinCountEqual ? "" : " · pin count differs"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="sm" variant="outline" disabled={busy !== null || !candidate}
                onClick={() => void decide("bind_candidate", { portKey: candidate })}>
                Bind
              </Button>
            </>
          )}
          {allowed.includes("remove_rows") && (
            <Button size="sm" variant="ghost" className="text-destructive" disabled={busy !== null}
              onClick={() => void decide("remove_rows")}>
              {review.kind === "import" ? "Skip row" : "Remove rows"}
            </Button>
          )}
        </div>
      )}
    </li>
  );
}

function RebaseForm({ instance }: { instance: SystemInstance }) {
  const { busy, edit } = useSystemSession();
  const [commit, setCommit] = useState(instance.tipCommit ?? "");
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input aria-label="Commit to rebase onto" className="h-8 w-80 font-mono text-xs" value={commit} maxLength={40}
        placeholder="commit SHA" onChange={(event) => setCommit(event.target.value)} />
      <Button size="sm" variant="outline" disabled={busy !== null || commit.trim().length < 7}
        onClick={() => void rebase(instance, commit.trim(), edit)}>
        Rebase
      </Button>
    </div>
  );
}

function UpdateRow({ instance, canEdit }: { instance: SystemInstance; canEdit: boolean }) {
  const { busy, edit } = useSystemSession();
  const latest = instance.catalog?.latestReleasedRevisionId;
  if (instance.kind === "assembly") {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-md border p-3 text-sm">
        <span className="font-medium">{instance.label}</span>
        <span className="text-xs text-muted-foreground">
          {instance.catalog?.version ? `v${instance.catalog.version}` : "pinned revision"} <ArrowRight className="inline h-3 w-3" /> latest released
        </span>
        {canEdit && latest && (
          <Button size="sm" variant="outline" className="ml-auto" disabled={busy !== null}
            onClick={() => void edit("rebase", (system) => system.rebaseSubsystem(instance.id, latest)).then((result) => {
              if (result?.body.outcome === "review_opened") toast.warning(`${instance.label}: some connections need review.`);
              else if (result) toast.success(`${instance.label} moved to the latest released revision.`);
            })}>
            Take latest released
          </Button>
        )}
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-md border p-3 text-sm">
      <span className="font-medium">{instance.label}</span>
      <span className="font-mono text-xs text-muted-foreground">
        {shortSha(instance.baselineCommit)} <ArrowRight className="inline h-3 w-3" /> {shortSha(instance.tipCommit)} on {instance.trackedRef}
      </span>
      {canEdit && instance.tipCommit && (
        <Button size="sm" variant="outline" className="ml-auto" disabled={busy !== null}
          onClick={() => void rebase(instance, instance.tipCommit as string, edit)}>
          Rebase to tip
        </Button>
      )}
    </div>
  );
}

async function rebase(instance: SystemInstance, commit: string, edit: Edit) {
  const result = await edit("rebase", (system) => system.rebaseInstance(instance.id, commit));
  if (!result) {
    return;
  }
  if (result.state === "queued") {
    toast.info(`Reading ${instance.label} at ${shortSha(commit)}. Try the rebase again in a moment.`);
  } else if (result.body.outcome === "review_opened") {
    toast.warning(`${instance.label} rebased: some connections need review.`);
  } else {
    toast.success(`${instance.label} rebased to ${shortSha(commit)}.`);
  }
}
