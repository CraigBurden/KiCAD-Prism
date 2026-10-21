/**
 * A generated drawing's sheets, one at a time (CONTRACTS §16.7, §17): the
 * arrows, the ←/→ keys, and the sheet's SVG as an object URL revoked when the
 * sheet changes or the preview unmounts. The harness outputs dialog and the
 * ICD / Outputs tab share it.
 */
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";

const message = (error: unknown) => (error instanceof Error ? error.message : String(error));

export interface SheetNavigation {
  /** The sheet shown, clamped to `1…sheets`. */
  current: number;
  go: (sheet: number) => void;
  /** Arrow keys: the previous/next sheet. */
  onKeyDown: (event: KeyboardEvent) => void;
}

/** The sheet a preview shows and the keys that change it. */
export function useSheetNavigation(sheets: number): SheetNavigation {
  const [sheet, setSheet] = useState(1);
  const count = Math.max(sheets, 1);
  const current = Math.min(Math.max(sheet, 1), count);
  const go = (next: number) => setSheet(Math.min(Math.max(next, 1), count));
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      go(current - 1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      go(current + 1);
    }
  };
  return { current, go, onKeyDown };
}

export interface SheetPreviewProps {
  sheets: number;
  navigation: SheetNavigation;
  /** Fetch one sheet by name (e.g. `sheet-1.svg`), authenticated. */
  load: (name: string, signal: AbortSignal) => Promise<Blob>;
  /** The image's alt text prefix; the sheet number follows it. */
  alt?: string;
}

export function SheetPreview({ sheets, navigation, load, alt = "Sheet" }: SheetPreviewProps) {
  const { current } = navigation;
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  });

  // The previewed sheet: an object URL, revoked when the sheet changes or the preview unmounts.
  useEffect(() => {
    if (sheets < 1) return undefined;
    const controller = new AbortController();
    let live = true;
    let href: string | null = null;
    setPreview(null);
    setError(null);
    loadRef.current(`sheet-${current}.svg`, controller.signal)
      .then((blob) => {
        if (!live) return;
        href = URL.createObjectURL(blob);
        setPreview(href);
      })
      .catch((failure: unknown) => {
        if (live && !controller.signal.aborted) setError(message(failure));
      });
    return () => {
      live = false;
      controller.abort();
      if (href) URL.revokeObjectURL(href);
    };
  }, [sheets, current]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-center gap-3">
        <Button variant="outline" size="icon" aria-label="Previous sheet" disabled={current <= 1} onClick={() => navigation.go(current - 1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <p className="text-sm text-zinc-300" aria-live="polite">Sheet {current} of {sheets}</p>
        <Button variant="outline" size="icon" aria-label="Next sheet" disabled={current >= sheets} onClick={() => navigation.go(current + 1)}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex min-h-40 items-center justify-center overflow-auto rounded-md bg-white p-2">
        {error ? (
          <p className="text-sm text-zinc-700">{error}</p>
        ) : preview ? (
          <img src={preview} alt={`${alt} ${current} of ${sheets}`} className="block h-auto w-full" />
        ) : (
          <p className="text-sm text-zinc-600">Loading sheet {current}…</p>
        )}
      </div>
    </div>
  );
}
