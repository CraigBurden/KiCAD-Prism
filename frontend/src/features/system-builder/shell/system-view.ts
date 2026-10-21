/**
 * The system page's view in its URL (§15.1, §16.5): the tab, the tab beside it,
 * the open B2B and harness tabs and the board sheet entered, so a link reopens
 * the same view.
 */
import { useSearchParams } from "react-router-dom";

export const TABS = ["schematic", "3d", "review"] as const;
export type FixedTab = (typeof TABS)[number];
/** A fixed tab, a B2B mate's tab (`b2b:<mate id>`) or a harness block's (`harness:<id>`). */
export type TabId = FixedTab | `b2b:${string}` | `harness:${string}`;
export const TAB_LABEL: Record<FixedTab, string> = { schematic: "Schematic", "3d": "3D", review: "Review" };

export const mateOfTab = (tab: TabId | null) => (tab?.startsWith("b2b:") ? tab.slice(4) : null);
export const harnessOfTab = (tab: TabId | null) => (tab?.startsWith("harness:") ? tab.slice(8) : null);

const list = (value: string | null) => (value ?? "").split(",").filter(Boolean);

/** The tab a URL value names, when it is fixed or an open B2B or harness tab. */
const asTab = (value: string | null, mates: readonly string[], harnesses: readonly string[], fallback: TabId | null): TabId | null => {
  if ((TABS as readonly string[]).includes(value ?? "")) return value as TabId;
  const mate = value?.startsWith("b2b:") ? value.slice(4) : null;
  if (mate && mates.includes(mate)) return value as TabId;
  const harness = value?.startsWith("harness:") ? value.slice(8) : null;
  return harness && harnesses.includes(harness) ? (value as TabId) : fallback;
};

export function useSystemView() {
  const [params, setParams] = useSearchParams();
  const openMates = list(params.get("b2b"));
  const openHarnesses = list(params.get("harness"));
  const tab = asTab(params.get("tab"), openMates, openHarnesses, "schematic") as TabId;
  const beside = asTab(params.get("beside"), openMates, openHarnesses, null);
  const sheet = params.get("sheet");

  const openSheet = (occurrence: string | null) => {
    const out = new URLSearchParams(params);
    if (occurrence) out.set("sheet", occurrence);
    else out.delete("sheet");
    setParams(out);
  };

  const setView = (next: { tab?: TabId; beside?: TabId | null; mates?: string[]; harnesses?: string[] }) => {
    const out = new URLSearchParams(params);
    const nextTab = next.tab ?? tab;
    const nextBeside = next.beside === undefined ? beside : next.beside;
    out.set("tab", nextTab);
    if (nextBeside && nextBeside !== nextTab) out.set("beside", nextBeside);
    else out.delete("beside");
    for (const [key, items] of [["b2b", next.mates ?? openMates], ["harness", next.harnesses ?? openHarnesses]] as const) {
      if (items.length) out.set(key, items.join(","));
      else out.delete(key);
    }
    setParams(out, { replace: true });
  };

  /** Open a mate's B2B tab beside the 3D tab (mockup 04). */
  const openMate = (mate: string) => {
    const mates = openMates.includes(mate) ? openMates : [...openMates, mate];
    setView({ tab: `b2b:${mate}`, beside: "3d", mates });
  };
  /** Open a harness block's tab beside the schematic (ADR decision 12). */
  const openHarness = (harness: string) => {
    const harnesses = openHarnesses.includes(harness) ? openHarnesses : [...openHarnesses, harness];
    setView({ tab: `harness:${harness}`, beside: "schematic", harnesses });
  };
  /** Open the Route tool's 3D tab beside a harness tab (mockup 10). */
  const openRoute = (harness: string) => {
    const harnesses = openHarnesses.includes(harness) ? openHarnesses : [...openHarnesses, harness];
    setView({ tab: `harness:${harness}`, beside: "3d", harnesses });
  };
  /** Close an opened object's tab; a pane that showed it falls back to the schematic. */
  const closeTab = (id: TabId) => {
    const mates = openMates.filter((item) => `b2b:${item}` !== id);
    const harnesses = openHarnesses.filter((item) => `harness:${item}` !== id);
    const gone = (shown: TabId | null) => shown === id;
    setView({ tab: gone(tab) ? (gone(beside) ? "schematic" : beside ?? "schematic") : tab, beside: gone(beside) || gone(tab) ? null : beside, mates, harnesses });
  };

  return { openMates, openHarnesses, tab, beside, sheet, openSheet, setView, openMate, openHarness, openRoute, closeTab };
}
