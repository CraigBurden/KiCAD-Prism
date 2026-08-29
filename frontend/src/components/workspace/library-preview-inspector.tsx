import { useState } from "react";
import type { ReactNode } from "react";
import { Maximize2, Minus, Plus, RotateCcw } from "lucide-react";
import { TransformComponent, TransformWrapper } from "react-zoom-pan-pinch";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  symbolUnitLabel,
  type AssetSource,
  type RenderController,
  type RenderNavigationOptions,
} from "@/lib/ecad-renderer";
import { cn } from "@/lib/utils";

import {
  EMBEDDED_PREVIEW_NAVIGATION,
  EXPANDED_PREVIEW_NAVIGATION,
  LibraryAssetRenderer,
} from "./library-asset-renderer";
import {
  LibraryCrossProbeProvider,
  LibraryProbeBadge,
  useLibraryCrossProbe,
} from "./library-cross-probe";

/**
 * Shared pan/zoom frame for every catalog preview. Keeping this separate from
 * the preview selector lets revision comparison use the exact same viewport
 * mechanics as the catalog quick view and Assets tab.
 *
 * `wheelZoom` opts out of wheel handling so a scrolling page (e.g. the narrow
 * remote-provider panel) keeps its scroll; zoom is then available through the
 * buttons, pinch, and an expanded lightbox where wheel zoom re-enables.
 */
export function LibraryPreviewViewport({
  viewportKey,
  children,
  className,
  wheelZoom = true,
  onExpand,
}: {
  viewportKey: string;
  children: ReactNode;
  className?: string;
  wheelZoom?: boolean;
  onExpand?: () => void;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden border bg-preview-surface",
        className,
      )}
    >
      <TransformWrapper
        key={viewportKey}
        initialScale={1}
        minScale={0.5}
        maxScale={8}
        centerOnInit
        centerZoomedOut
        smooth
        wheel={
          wheelZoom ? { step: 0.12, smoothStep: 0.006 } : { disabled: true }
        }
        // Interactive controls supplied inside a preview must not start a
        // pan gesture in the transformed canvas beneath them.
        panning={{
          velocityDisabled: false,
          excluded: ["prism-preview-interaction"],
        }}
        pinch={{ step: 4 }}
        doubleClick={{ mode: "reset", animationTime: 180 }}
        zoomAnimation={{ animationTime: 180, animationType: "easeOut" }}
        alignmentAnimation={{ animationTime: 180, velocityAlignmentTime: 220 }}
      >
        {({ zoomIn, zoomOut, resetTransform }) => (
          <>
            <div className="absolute right-2 top-2 z-20 flex items-center border bg-background/90 shadow-sm">
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label="Zoom out preview"
                onClick={() => zoomOut(0.3)}
              >
                <Minus className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label="Zoom in preview"
                onClick={() => zoomIn(0.3)}
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label="Reset preview view"
                onClick={() => resetTransform()}
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </Button>
              {onExpand ? (
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label="Expand preview"
                  onClick={onExpand}
                >
                  <Maximize2 className="h-3.5 w-3.5" />
                </Button>
              ) : null}
            </div>
            <TransformComponent
              wrapperClass="!h-full !w-full"
              contentClass="!h-full !w-full"
            >
              {children}
            </TransformComponent>
          </>
        )}
      </TransformWrapper>
    </div>
  );
}

function LibraryLivePreviewViewport({
  controller,
  children,
  className,
}: {
  controller: RenderController | null;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative flex overflow-hidden border bg-preview-surface",
        className,
      )}
    >
      <div className="absolute right-2 top-2 z-20 flex items-center border bg-background/90 shadow-sm">
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label="Zoom out preview"
          disabled={!controller}
          onClick={() => controller?.zoomBy(0.8)}
        >
          <Minus className="h-3.5 w-3.5" />
        </Button>
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label="Zoom in preview"
          disabled={!controller}
          onClick={() => controller?.zoomBy(1.25)}
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label="Reset preview view"
          disabled={!controller}
          onClick={() => controller?.resetView()}
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </Button>
      </div>
      {children}
    </div>
  );
}

/**
 * The unit strip for a multi-unit symbol.
 *
 * It sits above the preview frame rather than inside it. The frame's ground is
 * the ECAD canvas white, which is the same in both themes, so a strip drawn on
 * it rendered near-white-on-white in dark mode; and the frame's top-right
 * corner already belongs to the zoom controls, which covered the tail of the
 * strip on a part with many units.
 */
function LivePreviewUnitTabs({
  label,
  units,
  unit,
  onSelect,
}: {
  label: string;
  units: number;
  unit: number;
  onSelect: (unit: number) => void;
}) {
  return (
    <div
      className="flex max-w-full shrink-0 gap-1 overflow-x-auto pb-1"
      role="tablist"
      aria-label={`${label} symbol units`}
    >
      {Array.from({ length: units }, (_, index) => index + 1).map((value) => (
        <Button
          key={value}
          size="sm"
          variant={value === unit ? "secondary" : "ghost"}
          className="h-7 shrink-0"
          role="tab"
          aria-selected={value === unit}
          onClick={() => onSelect(value)}
        >
          {symbolUnitLabel(value)}
        </Button>
      ))}
    </div>
  );
}

function LivePreviewPane({
  assetId,
  kind,
  label,
  source,
  navigation,
  className,
}: {
  assetId?: string;
  kind: "symbol" | "footprint";
  label: string;
  source: AssetSource;
  navigation: RenderNavigationOptions;
  className?: string;
}) {
  const [controller, setController] = useState<RenderController | null>(null);
  const [units, setUnits] = useState(1);
  const [unit, setUnit] = useState(1);
  const clearProbe = useLibraryCrossProbe()?.clear;
  if (!assetId) {
    return (
      <div
        className={cn(
          "flex items-center justify-center border border-dashed text-xs text-muted-foreground",
          className,
        )}
      >
        No {kind}
      </div>
    );
  }
  return (
    <div className={cn("flex min-h-0 min-w-0 flex-col", className)}>
      {units > 1 ? (
        <LivePreviewUnitTabs
          label={label}
          units={units}
          unit={unit}
          onSelect={(next) => {
            // A latched pin belongs to the unit it was probed on.
            clearProbe?.();
            setUnit(next);
          }}
        />
      ) : null}
      <LibraryLivePreviewViewport
        controller={controller}
        className="min-h-0 flex-1"
      >
        <LibraryAssetRenderer
          key={assetId}
          assetId={assetId}
          kind={kind}
          label={label}
          source={source}
          navigation={navigation}
          unit={unit}
          onUnitsChange={setUnits}
          onControllerChange={setController}
        />
      </LibraryLivePreviewViewport>
    </div>
  );
}

export interface LibraryPreviewPairProps {
  label: string;
  symbolAssetId?: string;
  footprintAssetId?: string;
  source?: AssetSource;
  compact?: boolean;
  stacked?: boolean;
  symbolMeta?: string;
  footprintMeta?: string;
  className?: string;
}

export function LibraryPreviewPair({
  label,
  symbolAssetId,
  footprintAssetId,
  source = "catalog",
  compact = false,
  stacked = false,
  symbolMeta,
  footprintMeta,
  className,
}: LibraryPreviewPairProps) {
  const [expanded, setExpanded] = useState(false);
  const resetKey = `${symbolAssetId ?? "-"}:${footprintAssetId ?? "-"}`;
  const paneClassName = compact ? "h-48" : "h-80";

  const panes = (navigation: RenderNavigationOptions, expandedView = false) => (
    <div
      className={cn(
        "grid min-h-0 gap-3",
        stacked && !expandedView ? "grid-cols-1" : "sm:grid-cols-2",
        expandedView && "flex-1",
      )}
    >
      <div className="flex min-h-0 min-w-0 flex-col gap-2">
        <p className="text-xs font-medium">{symbolMeta || "Symbol"}</p>
        <LivePreviewPane
          assetId={symbolAssetId}
          kind="symbol"
          label={label}
          source={source}
          navigation={navigation}
          className={expandedView ? "min-h-0 flex-1" : paneClassName}
        />
      </div>
      <div className="flex min-h-0 min-w-0 flex-col gap-2">
        <p className="text-xs font-medium">{footprintMeta || "Footprint"}</p>
        <LivePreviewPane
          assetId={footprintAssetId}
          kind="footprint"
          label={label}
          source={source}
          navigation={navigation}
          className={expandedView ? "min-h-0 flex-1" : paneClassName}
        />
      </div>
    </div>
  );

  return (
    <LibraryCrossProbeProvider
      resetKey={resetKey}
      className={cn("space-y-2", className)}
    >
      <div className="flex min-h-7 items-center justify-between gap-2">
        <LibraryProbeBadge />
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label="Expand paired preview"
          onClick={() => setExpanded(true)}
        >
          <Maximize2 className="h-3.5 w-3.5" />
        </Button>
      </div>
      {panes(EMBEDDED_PREVIEW_NAVIGATION)}
      <Dialog open={expanded} onOpenChange={setExpanded}>
        <DialogContent className="flex h-[85vh] max-w-6xl flex-col overflow-hidden">
          <DialogHeader className="shrink-0 pr-8">
            <DialogTitle>{label} · Pin↔pad inspection</DialogTitle>
            <DialogDescription>
              Hover to preview a mapping. Click to latch it; press Escape or
              click empty space to clear.
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-7 shrink-0">
            <LibraryProbeBadge />
          </div>
          {panes(EXPANDED_PREVIEW_NAVIGATION, true)}
        </DialogContent>
      </Dialog>
    </LibraryCrossProbeProvider>
  );
}
