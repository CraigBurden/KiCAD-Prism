/**
 * The system page's view in its URL (§15.1): the tab, the tab beside it, the
 * open B2B tabs and the board sheet entered, so a link reopens the same view.
 */
import { useSearchParams } from "react-router-dom";

export const TABS = ["schematic", "3d", "review"] as const;
export type FixedTab = (typeof TABS)[number];
/** A fixed tab, or a B2B mate's tab: `b2b:<mate id>`. */
export type TabId = FixedTab | `b2b:${string}`;
export const TAB_LABEL: Record<FixedTab, string> = { schematic: "Schematic", "3d": "3D", review: "Review" };

export const mateOfTab = (tab: TabId | null) => (tab?.startsWith("b2b:") ? tab.slice(4) : null);

/** The tab a URL value names, when it is fixed or an open B2B tab. */
const asTab = (value: string | null, open: readonly string[], fallback: TabId | null): TabId | null => {
  if ((TABS as readonly string[]).includes(value ?? "")) return value as TabId;
  const mate = value?.startsWith("b2b:") ? value.slice(4) : null;
  return mate && open.includes(mate) ? (value as TabId) : fallback;
};

export function useSystemView() {
  const [params, setParams] = useSearchParams();
  const openMates = (params.get("b2b") ?? "").split(",").filter(Boolean);
  const tab = asTab(params.get("tab"), openMates, "schematic") as TabId;
  const beside = asTab(params.get("beside"), openMates, null);
  const sheet = params.get("sheet");

  const openSheet = (occurrence: string | null) => {
    const out = new URLSearchParams(params);
    if (occurrence) out.set("sheet", occurrence);
    else out.delete("sheet");
    setParams(out);
  };

  const setView = (next: { tab?: TabId; beside?: TabId | null; mates?: string[] }) => {
    const out = new URLSearchParams(params);
    const nextTab = next.tab ?? tab;
    const nextBeside = next.beside === undefined ? beside : next.beside;
    const mates = next.mates ?? openMates;
    out.set("tab", nextTab);
    if (nextBeside && nextBeside !== nextTab) out.set("beside", nextBeside);
    else out.delete("beside");
    if (mates.length) out.set("b2b", mates.join(","));
    else out.delete("b2b");
    setParams(out, { replace: true });
  };

  /** Open a mate's B2B tab beside the 3D tab (mockup 04). */
  const openMate = (mate: string) => {
    const mates = openMates.includes(mate) ? openMates : [...openMates, mate];
    setView({ tab: `b2b:${mate}`, beside: "3d", mates });
  };
  const closeMate = (mate: string) => {
    const mates = openMates.filter((item) => item !== mate);
    const gone = (id: TabId | null) => id === `b2b:${mate}`;
    setView({ tab: gone(tab) ? (gone(beside) ? "schematic" : beside ?? "schematic") : tab, beside: gone(beside) || gone(tab) ? null : beside, mates });
  };

  return { openMates, tab, beside, sheet, openSheet, setView, openMate, closeMate };
}
