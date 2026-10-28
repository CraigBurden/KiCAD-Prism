import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * The small floating bar over a view (PLAN M9, the user's pick): grouped icon
 * buttons on a raised card. Place it with `className` (absolute positions).
 */
export function FloatingToolbar({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <div role="toolbar" aria-label={label}
      className={cn("pointer-events-auto z-10 flex items-center gap-0.5 rounded-md border bg-background/95 p-0.5 shadow-sm backdrop-blur", className)}>
      {children}
    </div>
  );
}
