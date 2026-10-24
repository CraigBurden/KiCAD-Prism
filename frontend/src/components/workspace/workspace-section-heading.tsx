import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface WorkspaceSectionHeadingProps {
  icon: LucideIcon;
  title: string;
  count?: number;
  /** Controls that act on this section only, shown on the right. */
  children?: ReactNode;
}

/** The heading that separates Folders, Systems and Boards on a workspace level. */
export function WorkspaceSectionHeading({ icon: Icon, title, count, children }: WorkspaceSectionHeadingProps) {
  return (
    <div className="flex min-h-9 flex-wrap items-center justify-between gap-2 border-b pb-2">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <Icon className="h-4 w-4 text-muted-foreground" aria-hidden />
        {title}
        {count !== undefined && <span className="text-xs font-normal tabular-nums text-muted-foreground">{count}</span>}
      </h2>
      {children && <div className="flex flex-wrap items-center gap-1.5">{children}</div>}
    </div>
  );
}
