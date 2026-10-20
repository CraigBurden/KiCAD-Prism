/**
 * The harness tab's three dialogs (CONTRACTS §16.5): the wire list (§16.3), the
 * BOM by part, and the bundle findings whose objects include the block.
 */
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import { buildBom, colourHex, terminalText } from "./harness-format";
import type { HarnessView } from "./harness-view";

export type HarnessDialogKind = "wires" | "bom" | "findings";

const TITLE: Record<HarnessDialogKind, string> = {
  wires: "Wires",
  bom: "BOM",
  findings: "Findings",
};

const DESCRIPTION: Record<HarnessDialogKind, string> = {
  wires: "Every conductor of this harness, explicit wires first, then each link's default wiring.",
  bom: "Housings, contacts, cables, coverings and wire by gauge and colour.",
  findings: "The system bundle's findings on this harness block.",
};

function WiresTable({ view }: { view: HarnessView }) {
  return (
    <table className="w-full border-collapse text-left text-xs">
      <thead>
        <tr className="text-[11px] uppercase tracking-wide text-zinc-500">
          <th className="border-b border-white/10 py-1.5 pr-2">Id</th>
          <th className="border-b border-white/10 py-1.5 pr-2">From</th>
          <th className="border-b border-white/10 py-1.5 pr-2">To</th>
          <th className="border-b border-white/10 py-1.5 pr-2">Gauge</th>
          <th className="border-b border-white/10 py-1.5 pr-2">Colour</th>
          <th className="border-b border-white/10 py-1.5 pr-2">Net</th>
          <th className="border-b border-white/10 py-1.5 pr-2">Origin</th>
          <th className="border-b border-white/10 py-1.5">Cable / conductor</th>
        </tr>
      </thead>
      <tbody>
        {view.wires.map((wire) => (
          <tr key={wire.id} className="align-top">
            <td className="border-b border-white/5 py-1.5 pr-2 font-mono text-zinc-200">{wire.id}</td>
            <td className="border-b border-white/5 py-1.5 pr-2 text-zinc-300">{terminalText(view, wire.from)}</td>
            <td className="border-b border-white/5 py-1.5 pr-2 text-zinc-300">{terminalText(view, wire.to)}</td>
            <td className="border-b border-white/5 py-1.5 pr-2 font-mono text-zinc-300">{wire.gaugeAwg ? `${wire.gaugeAwg} AWG` : "—"}</td>
            <td className="border-b border-white/5 py-1.5 pr-2 text-zinc-300">
              <span className="mr-1 inline-block h-2.5 w-2.5 rounded-[2px] border border-white/20" style={{ background: colourHex(wire.colour) }} />
              {wire.colour ?? "—"}
            </td>
            <td className="border-b border-white/5 py-1.5 pr-2 font-mono text-zinc-300">{wire.netName ?? wire.net ?? "—"}</td>
            <td className="border-b border-white/5 py-1.5 pr-2 text-zinc-300">{wire.origin}</td>
            <td className="border-b border-white/5 py-1.5 font-mono text-zinc-300">
              {wire.cable ? `${wire.cable} · ${wire.conductor ?? "—"}` : "—"}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function BomTable({ view }: { view: HarnessView }) {
  const sections = buildBom(view);
  if (!sections.length) return <p className="text-sm text-zinc-400">Nothing to list yet.</p>;
  return (
    <div className="space-y-4">
      {sections.map((section) => (
        <section key={section.title}>
          <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">{section.title}</h3>
          <ul className="divide-y divide-white/5">
            {section.rows.map((row) => (
              <li key={row.label} className="flex items-center justify-between py-1 text-xs">
                <span className="font-mono text-zinc-300">{row.label}</span>
                <span className="text-zinc-400">×{row.count}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function FindingsList({ view }: { view: HarnessView }) {
  if (!view.findings.length) return <p className="text-sm text-zinc-400">No findings on this block.</p>;
  return (
    <ul className="space-y-2">
      {view.findings.map((finding) => (
        <li key={`${finding.code}\u0000${finding.subject}`} className="rounded-md border border-white/10 px-2.5 py-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] text-zinc-500">{finding.code}</span>
            {finding.waived && <span className="text-[10px] uppercase tracking-wide text-zinc-500">waived</span>}
            {finding.severity !== "info" && !finding.waived && <span className="text-[10px] uppercase tracking-wide text-amber-400">{finding.severity}</span>}
          </div>
          <p className="mt-0.5 text-zinc-300">{finding.message}</p>
        </li>
      ))}
    </ul>
  );
}

export function HarnessDialogs({ view, open, onClose }: { view: HarnessView; open: HarnessDialogKind | null; onClose: () => void }) {
  const kind = open ?? "wires";
  return (
    <Dialog open={open !== null} onOpenChange={(value) => { if (!value) onClose(); }}>
      <DialogContent className="max-h-[80vh] w-[min(94vw,980px)] max-w-none overflow-auto border-white/10 bg-[#0b1220] text-zinc-100">
        <DialogHeader>
          <DialogTitle className="text-zinc-100">{TITLE[kind]}</DialogTitle>
          <DialogDescription className="text-zinc-400">{DESCRIPTION[kind]}</DialogDescription>
        </DialogHeader>
        {open === "wires" && <WiresTable view={view} />}
        {open === "bom" && <BomTable view={view} />}
        {open === "findings" && <FindingsList view={view} />}
      </DialogContent>
    </Dialog>
  );
}
