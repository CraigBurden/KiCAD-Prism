/**
 * The selected board's card on the 3D tab (stage 3b, mockup 06): how it is
 * placed (by which mate, or free), the stack height, its group's root, and
 * the choice of positioning mate.
 */
import type { SystemBundle, SystemDocument } from "../model/types";
import { matesOf } from "./pose-edits";

export interface OccurrenceCardProps {
  document: SystemDocument;
  bundle: SystemBundle | null;
  occurrence: string;
  projectNames: Record<string, string>;
  canEdit: boolean;
  busy: boolean;
  onPositioningMate: (mate: string | null) => void;
  /** Open a mate's B2B tab. */
  onOpenMate?: (mate: string) => void;
}

const SOURCE_TEXT = { mate: "placed by its mate", stored: "stored position", default: "default row" } as const;

export function OccurrenceCard({ document, bundle, occurrence, projectNames, canEdit, busy, onPositioningMate, onOpenMate }: OccurrenceCardProps) {
  const item = document.occurrences.find((entry) => entry.id === occurrence);
  const placed = bundle?.placement?.occurrences.find((entry) => entry.occurrence === occurrence);
  if (!item) return null;
  const source = item.source;
  const mateName = (id: string) => {
    const mate = document.mates.find((entry) => entry.id === id);
    return mate ? `${mate.a.connector} ↔ ${mate.b.connector}` : id;
  };
  const driving = placed?.positioningMate;
  const placedMate = driving ? bundle?.placement?.mates.find((entry) => entry.mate === driving) : undefined;
  const root = rootOf(document, bundle, occurrence);
  const candidates = matesOf(document, occurrence);

  return (
    <div className="w-[260px] rounded-[10px] border border-white/10 bg-zinc-900/95 p-3 text-zinc-100 shadow-xl" role="group" aria-label={`${item.label} placement`}>
      <h4 className="truncate text-[13.5px] font-semibold">{item.label}</h4>
      <p className="mb-2.5 truncate text-[11.5px] text-zinc-400">
        {source.kind === "board" ? `${projectNames[source.projectId] ?? source.projectId} @ ${source.track.commit.slice(0, 7)}` : source.kind}
      </p>
      <table className="w-full text-xs">
        <tbody>
          <tr>
            <td className="w-20 py-0.5 align-top text-zinc-500">Placed by</td>
            <td className="py-0.5">
              {driving ? <>{mateName(driving)} <span className="rounded-full border border-white/15 px-1.5 text-[11px] text-zinc-400">driving</span></> : (placed ? SOURCE_TEXT[placed.source] : "not placed yet")}
            </td>
          </tr>
          {placedMate?.stackHeightNm !== undefined && (
            <tr>
              <td className="py-0.5 text-zinc-500">Stack</td>
              <td className="py-0.5">{(placedMate.stackHeightNm / 1e6).toFixed(2)} mm <span className="text-zinc-500">{placedMate.heightSource === "clearance" ? "from clearance" : "stated"}</span></td>
            </tr>
          )}
          {root && root !== occurrence && (
            <tr>
              <td className="py-0.5 text-zinc-500">Root</td>
              <td className="py-0.5">{document.occurrences.find((entry) => entry.id === root)?.label ?? root}</td>
            </tr>
          )}
        </tbody>
      </table>
      {candidates.length > 0 && (
        <label className="mt-2.5 flex items-center gap-2 text-xs">
          <span className="text-zinc-500">Positioning mate</span>
          <select
            className="min-w-0 flex-1 rounded-md border border-white/15 bg-zinc-950 px-1.5 py-1 text-xs disabled:opacity-60"
            value={item.positioningMate ?? ""}
            disabled={!canEdit || busy}
            onChange={(event) => onPositioningMate(event.target.value || null)}
          >
            <option value="">Automatic</option>
            {candidates.map((mate) => <option key={mate.id} value={mate.id}>{mateName(mate.id)}</option>)}
          </select>
        </label>
      )}
      {driving && onOpenMate && (
        <button type="button" className="mt-2.5 rounded-md border border-white/15 bg-zinc-950 px-2.5 py-1 text-xs" onClick={() => onOpenMate(driving)}>
          Open B2B tab
        </button>
      )}
      {driving && <p className="mt-2 text-[11px] text-zinc-500">A mated board moves with its root; move {root ? document.occurrences.find((entry) => entry.id === root)?.label : "the root"} to move the stack.</p>}
    </div>
  );
}

/** The root of the group an occurrence is placed in, following positioning mates. */
function rootOf(document: SystemDocument, bundle: SystemBundle | null, occurrence: string): string | null {
  const placed = new Map((bundle?.placement?.occurrences ?? []).map((entry) => [entry.occurrence, entry]));
  const mates = new Map(document.mates.map((entry) => [entry.id, entry]));
  let current = occurrence;
  const seen = new Set<string>();
  while (!seen.has(current)) {
    seen.add(current);
    const mateId = placed.get(current)?.positioningMate;
    const mate = mateId ? mates.get(mateId) : undefined;
    if (!mate) return current;
    current = mate.a.occurrence === current ? mate.b.occurrence : mate.a.occurrence;
  }
  return null;
}
