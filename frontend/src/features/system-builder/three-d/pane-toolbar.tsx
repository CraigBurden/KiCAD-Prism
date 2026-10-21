/**
 * The 3D tab's toolbar: Select, Move, Route, the catalog adds and Fit. Its own
 * module keeps the pane's orchestration under the file-size gate.
 */
import { Box, Boxes, Maximize, Move3d, MousePointer2, Spline } from "lucide-react";

export interface PaneToolbarProps {
  moving: boolean;
  routing: boolean;
  canEdit: boolean;
  adding: "body" | "entry" | null;
  onSelect: () => void;
  onMove: () => void;
  onRoute: () => void;
  onAddBody: () => void;
  onAddEntry: () => void;
  onFit: () => void;
}

export function PaneToolbar({ moving, routing, canEdit, adding, onSelect, onMove, onRoute, onAddBody, onAddEntry, onFit }: PaneToolbarProps) {
  return (
    <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-lg border border-white/10 bg-zinc-900/95 p-1 text-zinc-100 shadow-xl" role="toolbar" aria-label="3D tools">
      <PaneButton active={!moving && !routing} onClick={onSelect} icon={MousePointer2} label="Select" />
      {canEdit && <PaneButton active={moving && !routing} onClick={onMove} icon={Move3d} label="Move (M)" />}
      {canEdit && <PaneButton active={routing} onClick={onRoute} icon={Spline} label="Route (R)" />}
      {canEdit && <PaneButton active={adding === "body"} onClick={onAddBody} icon={Box} label="Add body" />}
      {canEdit && <PaneButton active={adding === "entry"} onClick={onAddEntry} icon={Boxes} label="Place system" />}
      <PaneButton active={false} onClick={onFit} icon={Maximize} label="Fit (F)" />
    </div>
  );
}

function PaneButton({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: typeof Maximize; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1.5 text-xs ${active ? "bg-white/15 text-white" : "text-zinc-300 hover:bg-white/10"}`}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}
