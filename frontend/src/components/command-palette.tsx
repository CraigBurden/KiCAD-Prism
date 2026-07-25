import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { useNavigate } from "react-router-dom";
import Fuse from "fuse.js";
import {
  CircuitBoard,
  Database,
  DownloadCloud,
  Keyboard,
  LogOut,
  PackageCheck,
  Search,
  Table2,
} from "lucide-react";

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { fetchJson } from "@/lib/api";
import {
  getPaletteCommands,
  subscribeToPaletteCommands,
  type PaletteCommand,
} from "@/lib/command-registry";
import { canOpenLibraryManager } from "@/lib/roles";
import { shortcutKeys } from "@/lib/shortcuts";
import { cn } from "@/lib/utils";
import type { User } from "@/types/auth";
import type { Project } from "@/types/project";

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User | null;
  onShowShortcuts: () => void;
  onLogout: () => void;
}

interface BootstrapResponse {
  projects: Project[];
}

const LIBRARY_VIEWS = [
  { view: "catalog", label: "Catalog", icon: Database },
  { view: "bulk-edit", label: "Bulk Edit", icon: Table2 },
  { view: "imports", label: "Import Center", icon: DownloadCloud },
  { view: "releases", label: "Release Queue", icon: PackageCheck },
] as const;

/**
 * ⌘K palette.
 *
 * It offers three kinds of entry: navigation that is always valid, the
 * project list (fetched the first time the palette opens rather than at app
 * start, so it costs nothing for users who never press ⌘K), and whatever the
 * mounted screen has published to the command registry.
 */
export function CommandPalette({ open, onOpenChange, user, onShowShortcuts, onLogout }: CommandPaletteProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [projects, setProjects] = useState<Project[]>([]);
  const projectsLoadedRef = useRef(false);
  const listRef = useRef<HTMLDivElement>(null);

  const screenCommands = useSyncExternalStore(subscribeToPaletteCommands, getPaletteCommands);

  useEffect(() => {
    if (!open || projectsLoadedRef.current) return;
    projectsLoadedRef.current = true;
    void fetchJson<BootstrapResponse>("/api/workspace/bootstrap", undefined, "Failed to load projects")
      .then((data) => setProjects(data.projects ?? []))
      // A palette without the project list is still useful, so a failure here
      // stays silent rather than throwing a toast at someone who just pressed ⌘K.
      .catch(() => {
        projectsLoadedRef.current = false;
      });
  }, [open]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
    }
  }, [open]);

  const close = useCallback(() => onOpenChange(false), [onOpenChange]);

  const commands = useMemo<PaletteCommand[]>(() => {
    const run = (action: () => void) => () => {
      close();
      action();
    };

    const goToWorkspace = (params: string) => run(() => navigate(`/${params}`));

    const items: PaletteCommand[] = [
      {
        id: "go:projects",
        label: "Projects",
        group: "Go to",
        icon: CircuitBoard,
        keywords: "workspace home boards",
        run: goToWorkspace(""),
      },
    ];

    if (canOpenLibraryManager(user?.role)) {
      for (const entry of LIBRARY_VIEWS) {
        items.push({
          id: `go:library:${entry.view}`,
          label: `Library Manager — ${entry.label}`,
          group: "Go to",
          icon: entry.icon,
          keywords: `components parts ${entry.label}`,
          run: goToWorkspace(`?section=library-manager&libraryView=${entry.view}`),
        });
      }
    }

    for (const project of projects) {
      items.push({
        id: `project:${project.id}`,
        label: project.display_name || project.name,
        group: "Projects",
        icon: CircuitBoard,
        detail: project.description || undefined,
        keywords: `${project.name} ${project.path}`,
        run: run(() => navigate(`/project/${project.id}`)),
      });
    }

    items.push(...screenCommands.map((command) => ({ ...command, run: run(command.run) })));

    items.push({
      id: "help:shortcuts",
      label: "Keyboard shortcuts",
      group: "Help",
      icon: Keyboard,
      detail: shortcutKeys("shift+/").join(" "),
      run: run(onShowShortcuts),
    });

    if (user && user.email !== "guest@local") {
      items.push({
        id: "session:logout",
        label: "Log out",
        group: "Help",
        icon: LogOut,
        run: run(onLogout),
      });
    }

    return items;
  }, [close, navigate, onLogout, onShowShortcuts, projects, screenCommands, user]);

  const fuse = useMemo(
    () =>
      new Fuse(commands, {
        keys: [
          { name: "label", weight: 3 },
          { name: "keywords", weight: 1 },
          { name: "group", weight: 0.5 },
        ],
        threshold: 0.4,
        ignoreLocation: true,
      }),
    [commands],
  );

  const results = useMemo(() => {
    const trimmed = query.trim();
    if (!trimmed) return commands;
    return fuse.search(trimmed).map((match) => match.item);
  }, [commands, fuse, query]);

  useEffect(() => {
    setActiveIndex((current) => (current < results.length ? current : 0));
  }, [results.length]);

  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, results]);

  // Rows carry their group heading with them so grouping survives ranked search
  // results, where a group's entries are no longer contiguous by construction.
  const rows = useMemo(() => {
    let lastGroup = "";
    return results.map((command) => {
      const heading = command.group === lastGroup ? null : command.group;
      lastGroup = command.group;
      return { command, heading };
    });
  }, [results]);

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowDown" || (event.key === "n" && event.ctrlKey)) {
      event.preventDefault();
      setActiveIndex((current) => (results.length ? (current + 1) % results.length : 0));
      return;
    }
    if (event.key === "ArrowUp" || (event.key === "p" && event.ctrlKey)) {
      event.preventDefault();
      setActiveIndex((current) => (results.length ? (current - 1 + results.length) % results.length : 0));
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      results[activeIndex]?.run();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="top-[15%] max-w-xl translate-y-0 gap-0 p-0 [&>button]:hidden"
        onKeyDown={handleKeyDown}
      >
        <DialogTitle className="sr-only">Command palette</DialogTitle>
        <DialogDescription className="sr-only">
          Search for a project, a library view, or an action. Use the arrow keys to choose and Enter to run.
        </DialogDescription>
        <div className="flex items-center gap-2 border-b px-3">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            autoFocus
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActiveIndex(0);
            }}
            placeholder="Search projects, views, and actions…"
            aria-label="Search commands"
            aria-controls="command-palette-results"
            className="h-11 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        <div id="command-palette-results" ref={listRef} role="listbox" className="max-h-80 overflow-y-auto p-1">
          {rows.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">No matches for “{query}”</p>
          ) : null}
          {rows.map(({ command, heading }, index) => {
            const Icon = command.icon;
            const isActive = index === activeIndex;
            return (
              <div key={command.id}>
                {heading ? (
                  <p className="px-2 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {heading}
                  </p>
                ) : null}
                <button
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  data-active={isActive ? "true" : undefined}
                  onMouseMove={() => setActiveIndex(index)}
                  onClick={() => command.run()}
                  className={cn(
                    "flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm",
                    isActive ? "bg-muted text-foreground" : "text-muted-foreground",
                  )}
                >
                  {Icon ? <Icon className="h-4 w-4 shrink-0" /> : null}
                  <span className="min-w-0 flex-1 truncate text-foreground">{command.label}</span>
                  {command.detail ? (
                    <span className="max-w-[45%] shrink-0 truncate text-xs text-muted-foreground">{command.detail}</span>
                  ) : null}
                </button>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
