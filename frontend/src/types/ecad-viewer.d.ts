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
    layer?: string;
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
}

export interface EcadOverlayScene {
    context: "SCH" | "PCB";
    placement: "underlay" | "content-overlay" | "foreground";
    visible: boolean;
    primitives: EcadOverlayPrimitive[];
}

export interface ECadViewerElement extends HTMLElement {
    replaceSources(update: { revisionKey: string; sources: Array<{ filename: string; content: string }> }): Promise<void>;
    appendSources(update: { revisionKey: string; sources: Array<{ filename: string; content: string }> }): Promise<void>;
    setActive(active: boolean): void;
    clearSelection(): void;
    setOverlayScene(channelId: string, scene: EcadOverlayScene): void;
    clearOverlayScene(channelId: string): void;
    zoomToLocation(x: number, y: number): void;
    switchPage(pageId: string): void;
    navigateSchematicPage?(direction: -1 | 1): boolean;
    navigateSchematicParent?(): boolean;
    getActiveSchematicPage?(): {
        projectPath: string;
        sheetPath: string;
        filename: string;
        name?: string;
        page?: string;
    } | null;
    getScreenLocation(x: number, y: number): { x: number; y: number } | null;
    requestCrossProbe(request: CrossProbeRequest): boolean;
}

declare global {
    interface HTMLElementTagNameMap {
        "ecad-viewer": ECadViewerElement;
    }

    interface HTMLElementEventMap {
        "ecad-viewer:crossprobe:request": CustomEvent<CrossProbeRequest>;
        "ecad-viewer:crossprobe:result": CustomEvent<CrossProbeResult>;
        "ecad-viewer:selection": CustomEvent<EcadSemanticSelectionDetail>;
        "kicanvas:select": CustomEvent<KiCanvasSelectDetail>;
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
