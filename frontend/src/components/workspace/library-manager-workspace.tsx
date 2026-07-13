import { useSearchParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import type { User } from "@/types/auth";
import type { Project } from "@/types/project";
import { cn } from "@/lib/utils";
import { LibraryImportCenter } from "./library-import-center";
import { LibraryComponentWorkspace } from "./library-component-workspace";
import { LibraryReleaseQueue } from "./library-release-queue";
import { LibraryCatalogWorkspace } from "./library-catalog-workspace";

type LibraryView = "catalog" | "imports" | "releases" | "connectors";

export function LibraryManagerWorkspace({ user, projects }: { user: User | null; projects: Project[] }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const componentId = searchParams.get("component") || "";
  const requestedView = searchParams.get("libraryView") as LibraryView | null;
  const view: LibraryView = requestedView && ["catalog", "imports", "releases", "connectors"].includes(requestedView) ? requestedView : "catalog";

  const setView = (next: LibraryView) => {
    setSearchParams((current) => {
      const updated = new URLSearchParams(current);
      updated.set("section", "library-manager");
      updated.set("libraryView", next);
      updated.delete("component");
      updated.delete("componentTab");
      updated.delete("revision");
      updated.delete("compare");
      return updated;
    });
  };

  const openComponent = (id: string, tab = "overview", returnView: LibraryView = "catalog") => {
    setSearchParams((current) => {
      const updated = new URLSearchParams(current);
      updated.set("section", "library-manager");
      updated.set("libraryView", returnView);
      updated.set("component", id);
      updated.set("componentTab", tab);
      updated.delete("revision");
      updated.delete("compare");
      return updated;
    });
  };

  const closeComponent = () => {
    setSearchParams((current) => {
      const updated = new URLSearchParams(current);
      updated.delete("component");
      updated.delete("componentTab");
      updated.delete("revision");
      updated.delete("compare");
      updated.set("section", "library-manager");
      if (!updated.get("libraryView")) updated.set("libraryView", "catalog");
      return updated;
    });
  };

  if (componentId) {
    return <LibraryComponentWorkspace componentId={componentId} user={user} projects={projects} onBack={closeComponent} />;
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <nav className="flex shrink-0 items-center gap-1 border-b bg-card px-3 py-2" aria-label="Library Manager sections">
        {(["catalog", "imports", "releases", "connectors"] as LibraryView[]).map((item) => (
          <Button key={item} size="sm" variant="ghost" className={cn("capitalize", view === item && "bg-secondary")} aria-current={view === item ? "page" : undefined} onClick={() => setView(item)}>{item === "imports" ? "Import Center" : item === "releases" ? "Release Queue" : item}</Button>
        ))}
      </nav>
      <div className="min-h-0 flex-1 overflow-hidden">
        {view === "catalog" && <LibraryCatalogWorkspace user={user} onOpenComponent={(id) => openComponent(id, "overview", "catalog")} />}
        {view === "imports" && <LibraryImportCenter projects={projects} user={user} initialSessionId={searchParams.get("session") || undefined} />}
        {view === "releases" && <LibraryReleaseQueue onOpenComponent={(id) => openComponent(id, "review", "releases")} />}
        {view === "connectors" && <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Connector configuration will appear here as integrations are enabled.</div>}
      </div>
    </div>
  );
}
