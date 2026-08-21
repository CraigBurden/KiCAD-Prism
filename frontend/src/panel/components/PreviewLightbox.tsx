import { X } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";

import { LibraryPreviewViewport } from "@/components/workspace/library-preview-inspector";

interface PreviewLightboxProps {
  /** Any renderable preview URL (symbol, footprint, or 3D render). */
  url: string;
  title: string;
  subtitle?: string;
}

interface ControlledProps extends PreviewLightboxProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Fullscreen zoomable preview, assembled from raw primitives so exactly one
 * close control exists. Wheel zoom is enabled here because the lightbox has
 * no page content to scroll past.
 */
export function PreviewLightbox({ open, onOpenChange, url, title, subtitle }: ControlledProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/80" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="fixed inset-0 z-50 flex flex-col bg-background focus:outline-none"
        >
          <DialogPrimitive.Title className="sr-only">{title}</DialogPrimitive.Title>
          <div className="flex items-center gap-2 border-b py-2 pl-4 pr-2">
            <span className="min-w-0 flex-1 truncate text-xs font-semibold">{title}</span>
            {subtitle ? (
              <span className="min-w-0 truncate text-[10px] text-muted-foreground">{subtitle}</span>
            ) : null}
            <DialogPrimitive.Close
              aria-label="Close preview"
              className="shrink-0 rounded-sm p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-primary focus:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <X className="h-4 w-4" />
            </DialogPrimitive.Close>
          </div>
          <LibraryPreviewViewport viewportKey={url} className="min-h-0 flex-1 rounded-none border-0">
            <img
              src={url}
              alt={title}
              draggable={false}
              className="pointer-events-none h-full w-full select-none object-contain p-2"
            />
          </LibraryPreviewViewport>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
