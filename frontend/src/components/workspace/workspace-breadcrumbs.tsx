import { ChevronRight } from "lucide-react";

import { FolderTreeItem } from "@/types/project";
import { Button } from "@/components/ui/button";

interface WorkspaceBreadcrumbsProps {
  isSearching: boolean;
  breadcrumbs: FolderTreeItem[];
  onGoRoot: () => void;
  onSelectFolder: (folderId: string) => void;
}

export function WorkspaceBreadcrumbs({
  isSearching,
  breadcrumbs,
  onGoRoot,
  onSelectFolder,
}: WorkspaceBreadcrumbsProps) {
  if (isSearching || breadcrumbs.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      {breadcrumbs.length > 0 && (
        <Button variant="ghost" size="sm" onClick={onGoRoot}>
          Projects
        </Button>
      )}
      {breadcrumbs.map((folder) => (
        <div key={folder.id} className="flex items-center gap-2">
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
          <Button variant="ghost" size="sm" onClick={() => onSelectFolder(folder.id)}>
            {folder.name}
          </Button>
        </div>
      ))}
    </div>
  );
}
