import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import { FabricationViewer } from "./fabrication-viewer";
import type { FabricationSource } from "./types";

/** The viewer in a large dialog, for opening a package from a file list. */
export function FabricationDialog({ source, focusFile, title, onClose }: {
    source: FabricationSource;
    focusFile?: string;
    title: string;
    onClose: () => void;
}) {
    return (
        <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
            <DialogContent className="flex h-[85vh] max-w-6xl flex-col gap-0 p-0">
                <DialogHeader className="shrink-0 border-b px-4 py-3">
                    <DialogTitle>Gerber</DialogTitle>
                    <DialogDescription className="truncate font-mono text-xs">{title}</DialogDescription>
                </DialogHeader>
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                    <FabricationViewer key={source.key} source={source} focusFile={focusFile} />
                </div>
            </DialogContent>
        </Dialog>
    );
}
