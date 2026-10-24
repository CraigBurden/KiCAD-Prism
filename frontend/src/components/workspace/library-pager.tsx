import { useState } from "react";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * The library lists' footer: the shown range and first/previous/next/last
 * buttons. With `jump`, a page number field (type it, press Enter), for lists
 * long enough that stepping to page 173 one click at a time is not a workflow.
 */
export function LibraryPager({
  label,
  page,
  pages,
  first,
  last,
  total,
  disabled = false,
  jump = false,
  onPage,
}: {
  label: string;
  page: number;
  pages: number;
  first: number;
  last: number;
  total: number;
  disabled?: boolean;
  jump?: boolean;
  onPage: (page: number) => void;
}) {
  const [typed, setTyped] = useState("");
  const step = (target: number) => onPage(Math.min(pages, Math.max(1, target)));
  return (
    <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t bg-muted/20 px-3 py-1.5">
      <span className="text-xs tabular-nums text-muted-foreground" aria-live="polite">
        {first.toLocaleString()}–{last.toLocaleString()} of {total.toLocaleString()}
      </span>
      <nav className="flex items-center gap-1" aria-label={label}>
        <Button size="icon-sm" variant="ghost" aria-label="First page" title="First page" disabled={disabled || page <= 1} onClick={() => step(1)}><ChevronsLeft className="h-3.5 w-3.5" /></Button>
        <Button size="icon-sm" variant="ghost" aria-label="Previous page" title="Previous page" disabled={disabled || page <= 1} onClick={() => step(page - 1)}><ChevronLeft className="h-3.5 w-3.5" /></Button>
        {jump ? (
          <form
            className="flex items-center gap-1 px-1"
            onSubmit={(event) => {
              event.preventDefault();
              const requested = Number(typed);
              if (!typed || !Number.isFinite(requested)) return;
              step(Math.trunc(requested));
              setTyped("");
            }}
          >
            <Input
              className="h-7 w-14 text-center text-xs"
              inputMode="numeric"
              disabled={disabled || pages <= 1}
              value={typed}
              placeholder={String(page)}
              onChange={(event) => setTyped(event.target.value.replace(/[^0-9]/g, ""))}
              aria-label={`Go to page, ${pages} pages available`}
            />
            <span className="text-xs tabular-nums text-muted-foreground">/ {pages.toLocaleString()}</span>
          </form>
        ) : (
          <span className="px-1 text-xs tabular-nums text-muted-foreground">{page.toLocaleString()} / {pages.toLocaleString()}</span>
        )}
        <Button size="icon-sm" variant="ghost" aria-label="Next page" title="Next page" disabled={disabled || page >= pages} onClick={() => step(page + 1)}><ChevronRight className="h-3.5 w-3.5" /></Button>
        <Button size="icon-sm" variant="ghost" aria-label="Last page" title="Last page" disabled={disabled || page >= pages} onClick={() => step(pages)}><ChevronsRight className="h-3.5 w-3.5" /></Button>
      </nav>
    </div>
  );
}
