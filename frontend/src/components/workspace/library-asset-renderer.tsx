import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  assetContentUrl,
  loadAssetText,
  loadEcadRenderer,
  symbolUnitCount,
  symbolUnitLabel,
  type AssetSource,
  type RenderHandle,
} from "@/lib/ecad-renderer";
import { cn } from "@/lib/utils";

/**
 * Live symbol and footprint previews.
 *
 * These replace stored SVG renders. The catalog already keeps the `.kicad_sym`
 * and `.kicad_mod` files, and they are smaller than the SVG a headless KiCad
 * produced from them, because `kicad-cli` inlines every stroke-font glyph as
 * path data. Drawing from the source instead is less to store, less to send,
 * and -- the reason this exists -- something a reviewer can zoom into rather
 * than a flat image.
 *
 * Loading lives in `lib/ecad-renderer`; this component owns only the canvas.
 */

export function LibraryAssetRenderer({
  assetId,
  kind,
  label,
  source = "catalog",
  className,
  onUnitsChange,
  unit: controlledUnit,
}: {
  assetId: string;
  kind: "symbol" | "footprint";
  label: string;
  source?: AssetSource;
  className?: string;
  /** Reports the symbol's unit count so a parent can render its own tabs. */
  onUnitsChange?: (units: number) => void;
  /** Selected unit when the parent owns the tab strip. */
  unit?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const renderedRef = useRef<RenderHandle | null>(null);
  const [units, setUnits] = useState(1);
  const [localUnit, setLocalUnit] = useState(1);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState("");

  const url = useMemo(() => assetContentUrl(source, assetId), [assetId, source]);
  const activeUnit = controlledUnit ?? localUnit;

  const report = useCallback(
    (count: number) => {
      setUnits(count);
      onUnitsChange?.(count);
    },
    [onUnitsChange],
  );

  useEffect(() => {
    // A superseded render must not paint over a newer one, and the canvas
    // it drew into may already be gone. Every await below is followed by a
    // cancellation check for that reason.
    let cancelled = false;
    setState("loading");

    (async () => {
      let nextHandle: RenderHandle | null = null;
      try {
        const [renderer, text] = await Promise.all([
          loadEcadRenderer(),
          loadAssetText(url),
        ]);
        if (cancelled) return;
        const canvas = canvasRef.current;
        if (!canvas) return;

        // Disposing before the next render releases the previous
        // viewer's resources -- for a footprint that is a WebGL
        // context, and browsers evict the oldest once about a dozen
        // are live.
        renderedRef.current?.dispose();
        renderedRef.current = null;

        if (kind === "symbol") {
          const symbols = renderer.parseSymbolLibrary(text);
          const symbol = symbols[0];
          if (!symbol) throw new Error("The library file has no symbol");
          report(symbolUnitCount(symbol));
          nextHandle = await renderer.renderSymbol(symbol, {
            canvas,
            // LibraryPreviewViewport owns pan/zoom for every Prism surface.
            // Enabling the viewer's native controls as well makes both layers
            // handle the same wheel gesture, and traps scrolling in the KiCad
            // panel even when its outer viewport deliberately disables wheel
            // zoom.
            interactive: false,
            unit: activeUnit,
          });
        } else {
          report(1);
          nextHandle = await renderer.renderFootprint(
            renderer.parseFootprint(text),
            { canvas, interactive: false },
          );
        }
        if (cancelled) {
          // Keep the handle local until this effect is known to be current.
          // Otherwise a late render can overwrite the newer effect's handle,
          // dispose itself, and leave the newer WebGL context alive but
          // unreachable at unmount.
          nextHandle.dispose();
          return;
        }
        renderedRef.current = nextHandle;
        setState("ready");
      } catch (error) {
        if (cancelled) return;
        setMessage(error instanceof Error ? error.message : String(error));
        setState("error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [url, kind, activeUnit, report]);

  // Unmount is the only place the last render is torn down; the effect above
  // deliberately keeps it alive across re-renders so the canvas is not
  // cleared between a dispose and the next paint.
  useEffect(
    () => () => {
      renderedRef.current?.dispose();
      renderedRef.current = null;
    },
    [],
  );

  const showTabs = kind === "symbol" && units > 1 && controlledUnit === undefined;

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      {showTabs ? (
        <div
          className="mb-1 flex max-w-full gap-1 overflow-x-auto border-b pb-1"
          role="tablist"
          aria-label={`${label} symbol units`}
        >
          {Array.from({ length: units }, (_, index) => index + 1).map((value) => (
            <Button
              key={value}
              size="sm"
              variant={value === activeUnit ? "secondary" : "ghost"}
              className="h-7 shrink-0"
              role="tab"
              aria-selected={value === activeUnit}
              onClick={() => setLocalUnit(value)}
            >
              {symbolUnitLabel(value)}
            </Button>
          ))}
        </div>
      ) : null}
      <div className={cn("relative min-h-0 flex-1", className)}>
        <canvas
          ref={canvasRef}
          aria-label={`${label} ${kind} preview`}
          className={cn(
            "h-full w-full",
            state === "ready" ? "" : "invisible",
          )}
        />
        {state === "loading" ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : null}
        {state === "error" ? (
          <div className="absolute inset-0 flex items-center justify-center px-3 text-center text-xs text-muted-foreground">
            {message || `Could not render this ${kind}`}
          </div>
        ) : null}
      </div>
    </div>
  );
}
