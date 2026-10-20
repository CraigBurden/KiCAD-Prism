/**
 * The system page's row of view tabs (ADR §2.7): the fixed tabs and one per
 * opened B2B mate, closable; and the side-by-side control.
 */
import { Columns2, X } from "lucide-react";

import { Button } from "@/components/ui/button";

export interface ViewTab {
  id: string;
  label: string;
  /** A B2B mate's tab: marked, and closable. */
  b2b: boolean;
  /** A count shown on the tab (Review's open findings); 0 shows none. */
  count: number;
}

export interface ViewTabsProps {
  tabs: ViewTab[];
  tab: string;
  beside: string | null;
  besideLabel: string | null;
  onPick: (id: string) => void;
  onClose: (id: string) => void;
  onCloseBeside: () => void;
  onSideBySide: () => void;
}

export function ViewTabs({ tabs, tab, beside, besideLabel, onPick, onClose, onCloseBeside, onSideBySide }: ViewTabsProps) {
  return (
    <nav className="flex h-10 shrink-0 items-end gap-1 border-b px-2" aria-label="Views">
      {tabs.map((item) => (
        <div
          key={item.id}
          className={`flex items-center rounded-t-md border border-b-0 text-sm ${item.id === tab ? "bg-muted font-medium" : item.id === beside ? "bg-muted/50" : "border-transparent text-muted-foreground hover:text-foreground"}`}
        >
          <button
            type="button"
            onClick={() => onPick(item.id)}
            className="flex items-center gap-1.5 px-3 py-1.5"
            aria-current={item.id === tab ? "page" : undefined}
          >
            {item.b2b && <span className="h-2 w-2 rounded-sm bg-zinc-400" aria-hidden />}
            {item.label}
            {item.count > 0 && <span className="rounded-full bg-amber-500/20 px-1.5 text-[11px] text-amber-600">{item.count}</span>}
          </button>
          {item.b2b && (
            <button type="button" className="mr-1.5 rounded p-0.5 hover:bg-white/10" aria-label={`Close ${item.label}`} onClick={() => onClose(item.id)}>
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      ))}
      <span className="flex-1" />
      {beside ? (
        <Button variant="ghost" size="sm" onClick={onCloseBeside}>
          <X className="mr-1 h-3.5 w-3.5" /> Close {besideLabel}
        </Button>
      ) : (
        <Button variant="ghost" size="sm" onClick={onSideBySide} title="Open another view beside this one">
          <Columns2 className="mr-1 h-3.5 w-3.5" /> Side by side
        </Button>
      )}
    </nav>
  );
}
