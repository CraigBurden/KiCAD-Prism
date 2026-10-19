import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

import { cn } from "@/lib/utils";

interface ToolbarButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** The tooltip, and the accessible name of an icon-only button. */
  title: string;
  /** Pressed (a toggle) or the current mode. */
  active?: boolean;
  children: ReactNode;
}

/** A button on a FloatingToolbar: icon-only names itself with its title. */
export const ToolbarButton = forwardRef<HTMLButtonElement, ToolbarButtonProps>(function ToolbarButton(
  { title, active, className, children, ...rest }, ref,
) {
  return (
    <button ref={ref} type="button" title={title} aria-label={rest["aria-label"] ?? title}
      aria-pressed={active === undefined ? undefined : active} {...rest}
      className={cn("flex h-7 min-w-7 items-center justify-center gap-1 rounded px-1.5 text-xs disabled:opacity-40",
        active ? "bg-accent text-foreground" : "text-muted-foreground enabled:hover:bg-accent/60 enabled:hover:text-foreground", className)}>
      {children}
    </button>
  );
});
