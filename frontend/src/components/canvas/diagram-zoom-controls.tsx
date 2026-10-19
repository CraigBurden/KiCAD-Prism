import { useReactFlow } from "@xyflow/react";
import { Maximize, Minus, Plus } from "lucide-react";

import { FloatingToolbar } from "./floating-toolbar";
import { ToolbarButton } from "./toolbar-button";

/** The canvas's zoom, in the workspace's floating toolbar style (M9). Must sit inside ReactFlow. */
export function DiagramZoomControls() {
  const flow = useReactFlow();
  return (
    <FloatingToolbar label="Zoom">
      <ToolbarButton title="Zoom in" onClick={() => void flow.zoomIn()}><Plus className="size-4" aria-hidden /></ToolbarButton>
      <ToolbarButton title="Zoom out" onClick={() => void flow.zoomOut()}><Minus className="size-4" aria-hidden /></ToolbarButton>
      <ToolbarButton title="Fit the diagram" onClick={() => void flow.fitView({ padding: 0.15 })}><Maximize className="size-4" aria-hidden /></ToolbarButton>
    </FloatingToolbar>
  );
}
