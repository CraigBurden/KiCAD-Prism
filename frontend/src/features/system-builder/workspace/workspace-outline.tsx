import type { ReactNode } from "react";
import { Box, Cable, Layers, Lock, Package, Plus, RectangleHorizontal, Spline } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { Finding, SystemDocument, SystemInstance } from "@/types/system";

import { endLabel } from "../link-editor";
import { boardStatus, shortSha, type Tone } from "../system-format";
import { BLOCK_STYLE, blockKind } from "../kind-style";
import { findingsOf, worstLevel } from "../findings";
import type { WorkspaceSelection } from "./workspace-state";

export type AddKind = "board" | "module" | "part" | "subsystem";

interface OutlineProps {
  document: SystemDocument;
  findings: Finding[];
  selection: WorkspaceSelection | null;
  canEdit: boolean;
  onSelect: (selection: WorkspaceSelection) => void;
  onAdd: (kind: AddKind) => void;
  footer?: ReactNode;
}

const DOT: Partial<Record<Tone, string>> = { error: "bg-destructive", warning: "bg-warning" };

function Group({ title, count, children }: { title: string; count: number; children: ReactNode }) {
  if (count === 0) return null;
  return (
    <section className="pb-2" aria-label={title}>
      <h3 className="px-4 pb-1 pt-2 text-xs text-muted-foreground">{title} · {count}</h3>
      <ul>{children}</ul>
    </section>
  );
}

function Row({ icon, label, meta, tone, selected, onClick, mono }: {
  icon: ReactNode; label: string; meta: string; tone: Tone | null; selected: boolean; onClick: () => void; mono?: boolean;
}) {
  return (
    <li>
      <button
        type="button" onClick={onClick} aria-current={selected ? "true" : undefined}
        className={cn(
          "flex h-8 w-full items-center gap-2.5 border-l-2 pl-3.5 pr-4 text-left text-sm",
          selected ? "border-foreground bg-accent font-semibold" : "border-transparent hover:bg-accent/50",
        )}
      >
        <span className="flex size-4 shrink-0 items-center justify-center text-muted-foreground">{icon}</span>
        <span className="min-w-0 flex-1 truncate">{label}</span>
        <span className={cn("w-16 shrink-0 truncate text-right text-xs text-muted-foreground", mono && "font-mono")}>{meta}</span>
        <span className={cn("size-2 shrink-0 rounded-full", tone ? DOT[tone] : undefined)} />
      </button>
    </li>
  );
}

function instanceIcon(instance: SystemInstance) {
  if (instance.restricted) return <Lock className="size-3.5" aria-label="restricted" />;
  const kind = BLOCK_STYLE[blockKind(instance)];
  return <kind.icon className={cn("size-3.5", kind.text)} aria-label={kind.label.toLowerCase()} />;
}

function instanceMeta(instance: SystemInstance): string {
  if (instance.kind === "module" || instance.kind === "assembly" || instance.kind === "part") {
    return instance.catalog?.version ? `v${instance.catalog.version}` : "";
  }
  return instance.restricted ? "" : shortSha(instance.baselineCommit).slice(0, 7);
}

/** The workspace's left column (PLAN M8): everything in the system, grouped, with its state. */
export function WorkspaceOutline({ document, findings, selection, canEdit, onSelect, onAdd, footer }: OutlineProps) {
  const isSelected = (kind: WorkspaceSelection["kind"], id: string) => selection?.kind === kind && selection.id === id;
  const instances = (kind: SystemInstance["kind"]) => document.instances.filter((item) => (item.kind ?? "board") === kind);
  const boards = instances("board");
  const modules = instances("module");
  const parts = instances("part");
  const subsystems = instances("assembly");
  const harnesses = document.harnesses ?? [];
  const open = findingsOf(findings);
  const instanceRow = (instance: SystemInstance) => {
    const status = boardStatus(instance);
    const own = worstLevel(open.instance(instance.id));
    const tone = status.tone === "error" || status.tone === "warning" ? status.tone : own;
    return (
      <Row key={instance.id} icon={instanceIcon(instance)} label={instance.label} meta={instanceMeta(instance)}
        mono={(instance.kind ?? "board") === "board"} tone={tone}
        selected={isSelected("instance", instance.id)} onClick={() => onSelect({ kind: "instance", id: instance.id })} />
    );
  };

  return (
    <nav className="flex h-full min-h-0 flex-col" aria-label="System outline">
      <div className="flex h-10 shrink-0 items-center justify-between pl-4 pr-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Outline</h2>
        {canEdit && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 px-2 text-muted-foreground"><Plus className="size-3.5" /> Add</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => onAdd("board")}><RectangleHorizontal className="mr-2 size-4" /> Board</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onAdd("module")}><Box className="mr-2 size-4" /> Module</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onAdd("subsystem")}><Layers className="mr-2 size-4" /> Subsystem</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onAdd("part")}><Package className="mr-2 size-4" /> Part</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      <div className="relative min-h-0 flex-1 overflow-y-auto">
        {document.instances.length === 0 && (
          <p className="px-4 py-2 text-sm text-muted-foreground">Empty</p>
        )}
        <Group title="Boards" count={boards.length}>{boards.map(instanceRow)}</Group>
        <Group title="Modules" count={modules.length}>{modules.map(instanceRow)}</Group>
        <Group title="Subsystems" count={subsystems.length}>{subsystems.map(instanceRow)}</Group>
        <Group title="Parts" count={parts.length}>{parts.map(instanceRow)}</Group>
        <Group title="Harnesses" count={harnesses.length}>
          {harnesses.map((harness) => (
            <Row key={harness.id} icon={<Cable className="size-3.5 text-kind-harness" />} label={harness.name}
              meta={`${harness.ends.length} ends`} tone={worstLevel(open.harness(harness.id))}
              selected={isSelected("harness", harness.id)} onClick={() => onSelect({ kind: "harness", id: harness.id })} />
          ))}
        </Group>
        <Group title="Links" count={document.links.length}>
          {document.links.map((link) => (
            <Row key={link.id} icon={<Spline className="size-3.5" />}
              label={link.name || `${endLabel(document, link, "a")} ↔ ${endLabel(document, link, "b")}`}
              meta={`${link.rows.length} pins`} tone={worstLevel(open.link(link.id))}
              selected={isSelected("link", link.id)} onClick={() => onSelect({ kind: "link", id: link.id })} />
          ))}
        </Group>
      </div>
      {footer && <div className="shrink-0 border-t px-4 py-3">{footer}</div>}
    </nav>
  );
}
