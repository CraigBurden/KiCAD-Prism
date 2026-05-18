import { Blocks, ChevronRight } from "lucide-react";

interface WorkspaceAppsPlaceholderProps {
  onOpenLibraryManager: () => void;
}

export function WorkspaceAppsPlaceholder({ onOpenLibraryManager }: WorkspaceAppsPlaceholderProps) {
  return (
    <div className="p-6">
      <div className="max-w-4xl space-y-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
            Apps &amp; Integrations
          </p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">Available Apps</h2>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Open the tools that manage and publish shared workspace capabilities.
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenLibraryManager}
          className="group flex w-full items-center justify-between rounded-2xl border border-border bg-card/40 p-6 text-left transition-colors hover:bg-card/70"
        >
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Blocks className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <p className="text-lg font-semibold text-foreground">Library Manager</p>
              <p className="max-w-xl text-sm text-muted-foreground">
                Manage the central KiCad component catalog, attach reusable assets, and control release state for the Remote Symbols provider.
              </p>
            </div>
          </div>
          <span className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-foreground transition-colors group-hover:bg-secondary/70">
            Open
            <ChevronRight className="h-4 w-4" />
          </span>
        </button>
      </div>
    </div>
  );
}
