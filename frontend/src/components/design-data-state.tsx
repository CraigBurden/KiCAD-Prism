/**
 * The calm states every screen shows while a project's design data is built.
 *
 * A design-data route answers 202 `status: "pending"` while a bundle builds and
 * 422 `status: "failed"` when it cannot be built (`frontend/src/lib/api.ts`
 * `fetchDesignJson`/`fetchDesignText`). These are the shared pieces a screen
 * renders for those states, in the existing UI style, so they read the same on
 * the project card, the viewer, the BOM table and the catalog screens.
 */

import { AlertCircle, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

/** "Preparing design data…": a spinner and one line, inline. */
export function DesignDataPending({
  label = "Preparing design data…",
  onRetry,
  className,
}: {
  label?: string;
  /** Offered after the read stopped polling; starts it again. */
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center justify-center gap-2 text-sm text-muted-foreground", className)}>
      <Loader2 className="h-4 w-4 animate-spin text-primary" aria-hidden />
      <span>{label}</span>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="rounded-md border px-2.5 py-1 text-xs font-medium hover:bg-muted"
        >
          Check again
        </button>
      ) : null}
    </div>
  );
}

/** "Design data could not be built" plus the detail and a Retry. */
export function DesignDataFailed({
  detail,
  onRetry,
  className,
}: {
  detail?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn("flex flex-col items-center gap-2 text-center text-sm", className)}
    >
      <AlertCircle className="h-5 w-5 text-destructive" aria-hidden />
      <div>
        <p className="font-medium text-destructive">Design data could not be built</p>
        {detail ? <p className="mt-1 text-xs text-muted-foreground">{detail}</p> : null}
      </div>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="rounded-md border px-2.5 py-1 text-xs font-medium hover:bg-muted"
        >
          Retry
        </button>
      ) : null}
    </div>
  );
}

/** "Local changes are not shown": HEAD was served over a dirty checkout. */
export function WorkingTreeDirtyNotice({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex items-center gap-1.5 text-xs text-muted-foreground",
        className,
      )}
      title="The design bundle is built from the last commit; uncommitted changes in the checkout are not included."
    >
      <AlertCircle className="h-3.5 w-3.5 shrink-0 text-warning" aria-hidden />
      <span>Local changes are not shown</span>
    </div>
  );
}
