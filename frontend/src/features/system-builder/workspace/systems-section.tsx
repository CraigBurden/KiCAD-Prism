import { Boxes } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { WorkspaceSectionHeading } from "@/components/workspace/workspace-section-heading";
import { FOLDER_GRID_CLASS, FOLDER_GRID_CLASS_COMPACT } from "@/components/workspace/workspace-types";

import { systemPath } from "../model/api";
import type { SystemSummary } from "../model/types";

/** Systems at one workspace level, or those matching a search, by name. */
export function systemsForLevel(systems: readonly SystemSummary[], folderId: string | null, searchQuery: string): SystemSummary[] {
  const query = searchQuery.trim().toLowerCase();
  const matching = query
    ? systems.filter((system) => system.name.toLowerCase().includes(query))
    : systems.filter((system) => (system.folderId ?? null) === folderId);
  return [...matching].sort((a, b) => a.name.localeCompare(b.name) || a.systemId.localeCompare(b.systemId));
}

function SystemCard({ system }: { system: SystemSummary }) {
  const navigate = useNavigate();
  const open = () => navigate(systemPath(system.systemId));
  return (
    <div
      role="link"
      tabIndex={0}
      aria-label={`Open system ${system.name}`}
      onClick={open}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          open();
        }
      }}
      className="group flex h-full cursor-pointer items-center gap-3 rounded-xl border bg-card p-4 text-left transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="shrink-0 rounded-md bg-primary/10 p-2 text-primary">
        <Boxes className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold">{system.name}</p>
        <p className="truncate text-xs text-muted-foreground">v{system.version}</p>
      </div>
    </div>
  );
}

/** The level's systems, between the folders and the boards; nothing when there are none. */
export function WorkspaceSystemsSection({ systems, dense = false }: { systems: SystemSummary[]; dense?: boolean }) {
  if (systems.length === 0) return null;
  return (
    <section className="space-y-3" aria-label="Systems">
      <WorkspaceSectionHeading icon={Boxes} title="Systems" count={systems.length} />
      <div className={dense ? FOLDER_GRID_CLASS_COMPACT : FOLDER_GRID_CLASS}>
        {systems.map((system) => (
          <SystemCard key={system.systemId} system={system} />
        ))}
      </div>
    </section>
  );
}
