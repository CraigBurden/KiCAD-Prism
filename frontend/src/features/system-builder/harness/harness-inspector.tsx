/**
 * The harness tab's inspector (CONTRACTS §16.5, mockup 09): the selected wire,
 * end, node or physical object; with nothing selected, the block's label,
 * counts and every finding. Its width is the reviewer's, and it folds to a
 * strip when the canvas needs the room.
 */
import type { ReactNode } from "react";
import { PanelRightClose, PanelRightOpen } from "lucide-react";

import { ResizablePanel } from "@/components/ui/resizable-panel";

import { countsLine, endHousing, partRefText } from "./harness-format";
import { PartName } from "./part-name";
import type { HarnessView, WireView } from "./harness-view";
import { WireInspector, type WireChange } from "./harness-wire-inspector";
import { useInspectorCollapse } from "./use-inspector-collapse";

interface Props {
  view: HarnessView;
  selected: ReadonlySet<string>;
  canEdit: boolean;
  busy: boolean;
  onSetWire: (id: string, changes: WireChange) => void;
  onConfirmWire: (id: string) => void;
  onRemove: (id: string) => void;
  onEditEnd: (id: string) => void;
}

const ghost = "rounded-md border border-white/15 px-2.5 py-1 text-xs text-zinc-200 hover:bg-white/10 disabled:pointer-events-none disabled:opacity-40";
const icon = "rounded-md p-1 text-zinc-400 hover:bg-white/10 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-cyan-700";

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[86px_1fr] gap-1.5 py-[3px]">
      <span className="text-zinc-500">{label}</span>
      <span className="min-w-0 break-words text-zinc-200">{children}</span>
    </div>
  );
}

function Section({ title }: { title: string }) {
  return <h4 className="mb-1 mt-2 text-[11px] uppercase tracking-wide text-zinc-500">{title}</h4>;
}

function EndInspector({ view, endId, onEditEnd }: { view: HarnessView; endId: string; onEditEnd: (id: string) => void }) {
  const end = view.ends.find((item) => item.id === endId);
  if (!end) return null;
  const housing = endHousing(end);
  const contacts = Object.entries(end.contacts);
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <b className="text-sm">{end.title}</b>
        <span className="text-[11.5px] text-zinc-400">{end.side} end</span>
      </div>
      <p className="mb-2 text-[11.5px] text-zinc-400">{end.subtitle}</p>
      <Row label="Housing">
        <span className={housing ? "text-emerald-300" : "text-amber-300"}>{housing ? <PartName part={housing} /> : "Housing not chosen"}</span>
      </Row>
      <Row label="Occurrence">{end.occurrence ?? "not attached"}</Row>
      <Section title="Contacts" />
      {contacts.length === 0 && <p className="text-[11.5px] text-zinc-500">No contacts chosen.</p>}
      {contacts.map(([cavity, part]) => (
        <Row key={cavity} label={`Cavity ${cavity}`}>
          <PartName part={part} />
        </Row>
      ))}
      <Section title="Pin map" />
      {end.pinMap.length === 0 && <p className="text-[11.5px] text-zinc-500">Cavity n is pad n.</p>}
      {end.pinMap.map((pair) => (
        <Row key={`${pair.cavity}\u0000${pair.pad}`} label={`Cavity ${pair.cavity}`}>
          {`pad ${pair.pad}`}
        </Row>
      ))}
      <Section title="Pins" />
      {end.pins.map((pin) => (
        <div key={`${pin.cavity}\u0000${pin.pad}`} className="grid grid-cols-[34px_1fr_auto] gap-1.5 py-[2px] text-[11.5px]">
          <span className="font-mono text-zinc-500">{pin.pad}</span>
          <span className="truncate font-mono text-zinc-200">{pin.name}</span>
          <span className={pin.open ? "text-amber-300" : pin.wired ? "text-emerald-300" : "text-zinc-500"}>{pin.open ? "open" : pin.wired ? "wired" : ""}</span>
        </div>
      ))}
      <div className="mt-2">
        <button type="button" className={ghost} onClick={() => onEditEnd(end.id)}>
          Edit end…
        </button>
      </div>
      <p className="mt-2 text-[10.5px] text-zinc-600">Ends are made by links on the schematic; the tab never adds one.</p>
    </div>
  );
}

interface ObjectRows {
  title: string;
  subtitle: string;
  rows: [string, string][];
}

function nodeText(view: HarnessView, node: { kind: "end"; end: string } | { kind: "branch-point"; branchPoint: string }): string {
  if (node.kind === "branch-point") return `branch point ${node.branchPoint}`;
  const end = view.ends.find((item) => item.id === node.end);
  return end ? end.title : `end ${node.end}`;
}

function describeObject(view: HarnessView, id: string): ObjectRows | null {
  const splice = view.splices.find((item) => item.id === id);
  if (splice) return { title: id, subtitle: "crimp splice", rows: [["Method", splice.method], ["Confirmed", splice.confirmed ? "yes" : "no"]] };
  const loose = view.looseEnds.find((item) => item.id === id);
  if (loose) {
    return {
      title: id,
      subtitle: `${loose.kind} loose end`,
      rows: [["Kind", loose.kind], ["Length", loose.lengthNm !== undefined ? `${loose.lengthNm / 1e6} mm` : "—"]],
    };
  }
  const branch = view.branchPoints.find((item) => item.id === id);
  if (branch) return { title: id, subtitle: "branch point", rows: [["Id", branch.id]] };
  const cable = view.cables.find((item) => item.id === id);
  if (cable) {
    return {
      title: id,
      subtitle: cable.label ?? "cable",
      rows: [
        ["Part", cable.part ? partRefText(cable.part) : "—"],
        [
          "Conductors",
          cable.conductors.map((conductor) => `${conductor.name}: ${conductor.wire ?? "unbound"}${conductor.drain ? " · drain" : ""}`).join("\n") || "—",
        ],
      ],
    };
  }
  const covering = view.coverings.find((item) => item.id === id);
  if (covering) {
    return {
      title: id,
      subtitle: `${covering.kind} covering`,
      rows: [
        ["Segment", covering.segment],
        ["Kind", covering.kind],
        ["Part", covering.part ? partRefText(covering.part) : "—"],
        ["Start", covering.startNm !== undefined ? `${covering.startNm / 1e6} mm` : "—"],
        ["End", covering.endNm !== undefined ? `${covering.endNm / 1e6} mm` : "—"],
      ],
    };
  }
  const segment = view.segments.find((item) => item.id === id);
  if (segment) {
    return {
      title: id,
      subtitle: "segment",
      rows: [
        ["From", nodeText(view, segment.from)],
        ["To", nodeText(view, segment.to)],
      ],
    };
  }
  return null;
}

function ObjectInspector({ object, onRemove, onRemoveObject }: { object: ObjectRows; onRemove: (id: string) => void; onRemoveObject: boolean }) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <b className="text-sm">{object.title}</b>
        <span className="text-[11.5px] text-zinc-400">{object.subtitle}</span>
      </div>
      {object.rows.map(([label, value]) => (
        <Row key={label} label={label}>
          <span className="whitespace-pre-line">{value}</span>
        </Row>
      ))}
      {onRemoveObject && (
        <div className="mt-2">
          <button type="button" className={ghost} onClick={() => onRemove(object.title)}>
            Remove
          </button>
        </div>
      )}
    </div>
  );
}

function Overview({ view, selected }: { view: HarnessView; selected: ReadonlySet<string> }) {
  return (
    <div>
      <h3 className="text-sm font-semibold">{view.label}</h3>
      <p className="mb-2 text-[11.5px] text-zinc-400">{countsLine(view)}</p>
      {selected.size > 1 && <p className="mb-2 text-[11.5px] text-sky-300">{selected.size} objects selected</p>}
      <Section title="Findings" />
      {view.findings.length === 0 && <p className="text-[11.5px] text-zinc-500">No findings on this block.</p>}
      {view.findings.map((finding) => (
        <p key={`${finding.code}\u0000${finding.subject}`} className={`py-0.5 text-[11.5px] ${finding.waived ? "text-zinc-500" : finding.severity === "error" ? "text-red-300" : "text-amber-300"}`}>
          {finding.message}
          <span className="ml-1.5 font-mono text-[10px] text-zinc-500">{finding.code}</span>
        </p>
      ))}
    </div>
  );
}

export function HarnessInspector({ view, selected, canEdit, busy, onSetWire, onConfirmWire, onRemove, onEditEnd }: Props) {
  const { collapsed, collapse, expand } = useInspectorCollapse();
  const single = selected.size === 1 ? [...selected][0] : null;
  const wire: WireView | undefined = single ? view.wires.find((item) => item.id === single) : undefined;
  const end = single ? view.ends.find((item) => item.id === single) : undefined;
  const object = single && !wire && !end ? describeObject(view, single) : null;

  if (collapsed) {
    return (
      <div className="flex h-full w-7 shrink-0 flex-col items-center border-l border-white/10 bg-[#0b1220] py-2">
        <button type="button" className={icon} aria-label="Expand inspector" title="Expand inspector (])" onClick={expand}>
          <PanelRightOpen className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <ResizablePanel
      side="right"
      storageKey="prism.system-builder.harness-inspector.width"
      defaultWidth={360}
      minWidth={280}
      maxWidth={720}
      aria-label="Harness inspector"
      className="border-white/10 bg-[#0b1220]"
    >
      <div className="flex shrink-0 justify-end px-2 pt-2">
        <button type="button" className={icon} aria-label="Collapse inspector" title="Collapse inspector (])" onClick={collapse}>
          <PanelRightClose className="h-4 w-4" />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3.5 pt-1 text-xs text-zinc-200">
        {wire ? (
          <WireInspector
            key={`${wire.id}:${wire.origin}:${wire.gaugeAwg ?? ""}:${wire.colour ?? ""}:${wire.label ?? ""}:${wire.lengthNm ?? ""}`}
            view={view}
            wire={wire}
            canEdit={canEdit}
            busy={busy}
            onSet={(changes) => onSetWire(wire.id, changes)}
            onConfirm={() => onConfirmWire(wire.id)}
            onRemove={() => onRemove(wire.id)}
          />
        ) : end ? (
          <EndInspector view={view} endId={end.id} onEditEnd={onEditEnd} />
        ) : object ? (
          <ObjectInspector object={object} onRemove={onRemove} onRemoveObject={canEdit && !busy} />
        ) : (
          <Overview view={view} selected={selected} />
        )}
      </div>
    </ResizablePanel>
  );
}
