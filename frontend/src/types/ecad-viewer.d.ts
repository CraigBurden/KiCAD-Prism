export type CrossProbeContext = "SCH" | "PCB" | "3D" | "BOM";
export type EcadCrossProbeContext = Extract<CrossProbeContext, "SCH" | "PCB">;
export type CrossProbeMode = "hover" | "select" | "focus";
export type CrossProbeKind = "designator" | "net" | "crossIndex" | "uuid";
export type CrossProbeFailureReason =
    | "cross-probe-disabled"
    | "missing-probe-value"
    | "designator-not-found"
    | "uuid-not-found"
    | "target-not-available"
    | "not-implemented"
    | "internal-error";

export interface CrossProbeRequest {
    sourceContext: CrossProbeContext;
    targetContext?: CrossProbeContext;
    mode: CrossProbeMode;
    kind: CrossProbeKind;
    value: string;
    sheet?: string;
    page?: string;
    designator?: string;
    net?: string;
    netCode?: number;
    pin?: string;
    crossIndex?: string;
    uuid?: string;
    uuids?: string[];
    componentUid?: string;
    netUid?: string;
    terminalUid?: string;
}

export interface CrossProbeTargetHint {
    context: CrossProbeContext;
    sheet?: string;
    page?: string;
    designator?: string;
    net?: string;
    crossIndex?: string;
    uuid?: string;
}

export interface CrossProbeResult {
    resolved: boolean;
    reason?: CrossProbeFailureReason;
    request: CrossProbeRequest;
    targetHint?: CrossProbeTargetHint;
}

export interface KiCanvasSelectDetail {
    item: unknown;
    previous: unknown;
    sourceContext?: CrossProbeContext;
    semantic?: EcadSemanticSelectionDetail;
}

export interface EcadSemanticSelectionDetail {
    sourceContext: "SCH" | "PCB";
    itemType: string;
    uuid?: string;
    crossIndex?: string;
    reference?: string;
    pin?: string;
    net?: string;
    netCode?: number;
    sheet?: string;
    page?: string;
    projectPath?: string;
    sheetPath?: string;
    filename?: string;
    layer?: string;
    x?: number;
    y?: number;
    bounds?: [number, number, number, number];
}

export interface EcadSchematicPageState {
    projectPath: string;
    sheetPath: string;
    filename: string;
    name?: string;
    page?: string;
    depth: number;
    active: boolean;
}

export interface EcadPcbLayerState {
    name: string;
    color: string;
    visible: boolean;
    highlighted: boolean;
}

export interface EcadPcbViewState {
    layers: EcadPcbLayerState[];
    objectOpacity: Record<"tracks" | "vias" | "pads" | "zones", number>;
    objectVisibility: Record<"references" | "values" | "footprintText" | "hiddenText", boolean>;
    highlightTracks: boolean;
}

export type EcadOverlayAnchor =
    | { kind: "world"; x: number; y: number; page?: string }
    | { kind: "bbox"; bounds: [number, number, number, number]; page?: string }
    | { kind: "source-item"; uuid: string; page?: string }
    | { kind: "entity"; reference?: string; net?: string; pin?: string; page?: string };

export interface EcadOverlayPrimitive {
    id: string;
    kind: "marker" | "bbox" | "polyline" | "polygon" | "text";
    anchor: EcadOverlayAnchor;
    sizing?: "world" | "screen";
    stroke?: string;
    fill?: string;
    opacity?: number;
    strokeWidth?: number;
    dash?: number[];
    interactive?: boolean;
    metadata?: unknown;
    accessibilityLabel?: string;
    radius?: number;
    padding?: number;
    points?: Array<[number, number]>;
    text?: string;
    size?: number;
    glyph?: "circle" | "comment";
}

export interface EcadOverlayScene {
    context: "SCH" | "PCB";
    placement: "underlay" | "content-overlay" | "foreground";
    visible: boolean;
    primitives: EcadOverlayPrimitive[];
}

export interface EcadOverlayHitDetail {
    channelId: string;
    primitiveId: string;
    context: "SCH" | "PCB";
    metadata?: unknown;
    resolvedAnchor: {
        x: number;
        y: number;
        bounds?: [number, number, number, number];
        page?: string;
    };
}

export interface EcadCommentAreaDetail {
    context: "SCH" | "PCB";
    x: number;
    y: number;
    bounds: [number, number, number, number];
    page?: string;
    layer?: string;
}

/** Value-based camera state from <ecad-viewer> (world center + zoom + rotation). */
export interface CameraState {
    x: number;
    y: number;
    zoom: number;
    rotation: number;
}

export interface ECadViewerElement extends HTMLElement {
    readonly isReady: boolean;
    replaceSources(update: { revisionKey: string; sources: Array<{ filename: string; content: string }> }): Promise<void>;
    appendSources(update: { revisionKey: string; sources: Array<{ filename: string; content: string }> }): Promise<void>;
    setActive(active: boolean): void;
    clearSelection(): void;
    setCommentMode?(enabled: boolean): void;
    setOverlayScene(channelId: string, scene: EcadOverlayScene): void;
    clearOverlayScene(channelId: string): void;
    zoomToLocation(x: number, y: number): void;
    switchPage(pageId: string): void;
    /** Resolves once the project has loaded (parse + first paint). */
    readonly ready: Promise<void>;
    /** Switch schematic page and resolve once applied. Awaits readiness first. */
    showPage?(pageId: string): Promise<void>;
    /** Fit the active viewer to a world-space bbox; resolves the settled camera. */
    focusBBox?(x: number, y: number, w: number, h: number): Promise<CameraState | null>;
    /** Focus an item by uuid; resolves the settled camera or null. */
    focusItem?(uuid: string, opts?: { select?: boolean; pad?: number }): Promise<CameraState | null>;
    /** Convenience cross-probe by designator/uuid in the active viewer. Prefer requestCrossProbe. */
    crossProbe?(reference: string): Promise<CameraState | null>;
    /** Active tab's camera as a plain value, or null before load. Settable. */
    camera?: CameraState | null;
    navigateSchematicPage?(direction: -1 | 1): boolean;
    navigateSchematicParent?(): boolean;
    getSchematicPages?(): EcadSchematicPageState[];
    getActiveSchematicPage?(): {
        projectPath: string;
        sheetPath: string;
        filename: string;
        name?: string;
        page?: string;
    } | null;
    getPcbViewState?(): EcadPcbViewState | null;
    setPcbLayerVisibility?(name: string, visible: boolean): boolean;
    setPcbLayerHighlight?(name: string | null): boolean;
    applyPcbLayerPreset?(preset: "front" | "back" | "copper" | "outer-copper" | "inner-copper" | "drawings" | "all" | "none"): void;
    setPcbObjectOpacity?(kind: "tracks" | "vias" | "pads" | "zones", opacity: number): void;
    setPcbObjectVisibility?(kind: "references" | "values" | "footprintText" | "hiddenText", visible: boolean): void;
    setPcbTrackHighlight?(enabled: boolean): void;
    getScreenLocation(x: number, y: number): { x: number; y: number } | null;
    requestCrossProbe(request: CrossProbeRequest): Promise<
        | { ok: true; targetContext: "SCH" | "PCB"; generation: number }
        | {
              ok: false;
              reason: "empty-value" | "load-error" | "target-unavailable" | "not-found";
              targetContext?: "SCH" | "PCB";
              generation: number;
              message?: string;
          }
    >;
}

declare global {
    interface HTMLElementTagNameMap {
        "ecad-viewer": ECadViewerElement;
    }

    interface HTMLElementEventMap {
        "ecad-viewer:crossprobe:request": CustomEvent<CrossProbeRequest>;
        "ecad-viewer:crossprobe:result": CustomEvent<CrossProbeResult>;
        "ecad-viewer:selection": CustomEvent<EcadSemanticSelectionDetail>;
        "ecad-viewer:crossprobe": CustomEvent<EcadSemanticSelectionDetail>;
        "ecad-viewer:view-state-change": CustomEvent<void>;
        "ecad-viewer:overlay-click": CustomEvent<EcadOverlayHitDetail>;
        "ecad-viewer:overlay-hover": CustomEvent<EcadOverlayHitDetail>;
        "ecad-viewer:overlay-leave": CustomEvent<EcadOverlayHitDetail>;
        "ecad-viewer:comment-area": CustomEvent<EcadCommentAreaDetail>;
        "kicanvas:select": CustomEvent<KiCanvasSelectDetail>;
        camerachange: CustomEvent<CameraState>;
    }

    namespace JSX {
        interface IntrinsicElements {
            'ecad-viewer-embedded': React.DetailedHTMLProps<
                React.HTMLAttributes<HTMLElement> & {
                    url?: string;
                    'is-bom'?: string;
                },
                HTMLElement
            >;
            'ecad-viewer': React.DetailedHTMLProps<
                React.HTMLAttributes<ECadViewerElement> & {
                    url?: string;
                    "show-header"?: boolean | "true" | "false";
                "header-sections"?: string;
                "show-selection-panel"?: string;
                "hide-chrome"?: boolean | "true" | "false";
                "source-mode"?: "auto" | "host";
                },
                ECadViewerElement
            >;
            'ecad-source': React.DetailedHTMLProps<
                React.HTMLAttributes<HTMLElement> & {
                    src?: string;
                },
                HTMLElement
            >;
            'ecad-blob': React.DetailedHTMLProps<
                React.HTMLAttributes<HTMLElement> & {
                    filename?: string;
                    content?: string;
                },
                HTMLElement
            >;
        }
    }
}
