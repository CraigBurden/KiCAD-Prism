import type {
    PrismComponentSelection,
    PrismNetSelection,
    PrismSelection,
    PrismSelectionContext,
    PrismSemanticIndex,
    PrismTerminalSelection,
    SemanticComponent,
    SemanticNet,
    SemanticTerminal,
} from "@/types/prism-selection";
import type {
    CrossProbeRequest,
    EcadSemanticSelectionDetail,
} from "@/types/ecad-viewer";

export function normalizeEcadSelection(
    normalized: EcadSemanticSelectionDetail,
    sourceRevisionKey?: string,
): PrismSelection | null {
    const sourceContext = normalized.sourceContext;
    const anchor = {
        context: sourceContext,
        itemType: normalized.itemType,
        uuid: normalized.uuid,
        crossIndex: normalized.crossIndex,
        sheet: normalized.sheet,
        page: normalized.page,
        layer: normalized.layer,
        sourceRevisionKey,
    } as const;

    if (normalized.reference && normalized.pin) {
        return {
            kind: "terminal",
            sourceContext,
            sourceRevisionKey,
            reference: normalized.reference,
            pin: normalized.pin,
            netName: normalized.net,
            uuid: normalized.uuid,
            anchor,
        };
    }
    if (normalized.net) {
        return {
            kind: "net",
            sourceContext,
            sourceRevisionKey,
            netName: normalized.net,
            netCode: normalized.netCode,
            uuid: normalized.uuid,
            crossIndex: normalized.crossIndex,
            anchor,
        };
    }
    if (normalized.reference) {
        return {
            kind: "component",
            sourceContext,
            sourceRevisionKey,
            reference: normalized.reference,
            uuid: normalized.uuid,
            crossIndex: normalized.crossIndex,
            anchor,
        };
    }
    if (normalized.uuid) {
        return {
            kind: "net",
            sourceContext,
            sourceRevisionKey,
            netName: "",
            uuid: normalized.uuid,
            anchor,
        };
    }
    return null;
}

const indexed = <T>(items: T[], index: number | undefined): T | undefined =>
    index === undefined ? undefined : items[index];

function componentForSelection(
    selection: PrismComponentSelection,
    index: PrismSemanticIndex,
): SemanticComponent | undefined {
    const maps = index.indexes;
    return indexed(index.components, maps.componentByReference?.[selection.reference])
        ?? (selection.uuid
            ? indexed(
                index.components,
                selection.sourceContext === "SCH"
                    ? maps.componentBySchematicUuid?.[selection.uuid]
                    : maps.componentByPcbFootprintUuid?.[selection.uuid],
            )
            : undefined);
}

function terminalForSelection(
    selection: PrismTerminalSelection,
    index: PrismSemanticIndex,
): SemanticTerminal | undefined {
    const maps = index.indexes;
    const byPair = maps.terminalByReferencePin?.[`${selection.reference}:${selection.pin}`];
    if (byPair !== undefined) return indexed(index.terminals, byPair);
    if (!selection.uuid) return undefined;
    return indexed(
        index.terminals,
        selection.sourceContext === "SCH"
            ? maps.terminalBySchematicPinUuid?.[selection.uuid]
            : maps.terminalByPcbPadUuid?.[selection.uuid],
    );
}

function netForSelection(
    selection: PrismNetSelection,
    index: PrismSemanticIndex,
): SemanticNet | undefined {
    const maps = index.indexes;
    if (selection.netName) {
        const byName = indexed(index.nets, maps.netByName?.[selection.netName]);
        if (byName) return byName;
    }
    if (selection.netCode !== undefined) {
        const byCode = indexed(index.nets, maps.netByNetCode?.[String(selection.netCode)]);
        if (byCode) return byCode;
    }
    if (!selection.uuid) return undefined;
    return indexed(
        index.nets,
        selection.sourceContext === "SCH"
            ? maps.netBySchematicUuid?.[selection.uuid]
            : maps.netByPcbUuid?.[selection.uuid],
    );
}

export function enrichPrismSelection(
    selection: PrismSelection,
    index: PrismSemanticIndex | null,
): PrismSelection {
    if (!index) return selection;
    const revisionSelection = {
        ...selection,
        sourceRevisionKey: index.sourceRevisionKey,
        anchor: selection.anchor
            ? { ...selection.anchor, sourceRevisionKey: index.sourceRevisionKey }
            : selection.anchor,
    } as PrismSelection;
    if (revisionSelection.kind === "component") {
        const component = componentForSelection(revisionSelection, index);
        return component
            ? { ...revisionSelection, reference: component.reference, componentUid: component.componentUid }
            : revisionSelection;
    }
    if (revisionSelection.kind === "terminal") {
        const terminal = terminalForSelection(revisionSelection, index);
        return terminal
            ? {
                ...revisionSelection,
                reference: terminal.reference,
                pin: terminal.pin,
                terminalUid: terminal.terminalUid,
                componentUid: terminal.componentUid,
                netUid: terminal.netUid,
                netName: terminal.netName ?? revisionSelection.netName,
            }
            : revisionSelection;
    }
    const net = netForSelection(revisionSelection, index);
    return net
        ? {
            ...revisionSelection,
            netName: net.name,
            netUid: net.netUid,
            netCode: net.netCode ?? revisionSelection.netCode,
        }
        : revisionSelection;
}

export function selectionLabel(selection: PrismSelection): string {
    if (selection.kind === "component") return selection.reference;
    if (selection.kind === "terminal") return `${selection.reference}.${selection.pin}`;
    return selection.netName || selection.netUid || selection.uuid || "Unresolved net";
}

export function contextLabel(context: PrismSelectionContext): string {
    if (context === "3D") return "3D";
    return context;
}

const semanticNetForSelection = (
    selection: PrismNetSelection,
    semanticIndex: PrismSemanticIndex | null,
): SemanticNet | undefined => {
    if (!semanticIndex) return undefined;
    if (selection.netUid) {
        const byUid = semanticIndex.nets.find((net) => net.netUid === selection.netUid);
        if (byUid) return byUid;
    }
    const index = semanticIndex.indexes.netByName?.[selection.netName];
    return index === undefined ? undefined : semanticIndex.nets[index];
};

export function crossProbeRequestForSelection(
    selection: PrismSelection,
    targetContext: "SCH" | "PCB",
    semanticIndex: PrismSemanticIndex | null,
): CrossProbeRequest {
    if (selection.kind === "component") {
        const component = semanticIndex
            ? semanticIndex.components.find((entry) =>
                entry.componentUid === selection.componentUid
                || entry.reference === selection.reference)
            : undefined;
        const targetReference = targetContext === "SCH"
            ? component?.schematicRefs?.[0]
            : component?.pcbRefs?.[0];
        const targetUuid = targetContext === "SCH"
            ? component?.schematicRefs?.[0]?.symbolUuid
            : component?.pcbRefs?.[0]?.footprintUuid;
        return {
            sourceContext: selection.sourceContext,
            targetContext,
            mode: "select",
            kind: "designator",
            value: selection.reference,
            designator: selection.reference,
            componentUid: selection.componentUid,
            uuid: targetUuid,
            crossIndex: targetReference?.crossIndex,
            page: targetContext === "SCH"
                ? component?.schematicRefs?.[0]?.page
                : undefined,
        };
    }

    if (selection.kind === "terminal") {
        const terminal = selection.terminalUid
            ? semanticIndex?.terminals.find((entry) => entry.terminalUid === selection.terminalUid)
            : semanticIndex?.terminals[
                semanticIndex.indexes.terminalByReferencePin?.[`${selection.reference}:${selection.pin}`] ?? -1
            ];
        const targetUuid = targetContext === "SCH" ? terminal?.schematicPinUuid : terminal?.pcbPadUuid;
        return {
            sourceContext: selection.sourceContext,
            targetContext,
            mode: "select",
            kind: targetUuid ? "uuid" : "designator",
            value: targetUuid || selection.reference,
            uuid: targetUuid,
            designator: selection.reference,
            pin: selection.pin,
            componentUid: selection.componentUid,
            terminalUid: selection.terminalUid,
            netUid: selection.netUid,
        };
    }

    const net = semanticNetForSelection(selection, semanticIndex);
    const uuids = targetContext === "SCH"
        ? (net?.schematicRefs || []).flatMap((reference) => [
            ...(reference.wireUuids || []),
            ...(reference.labelUuids || []),
            ...(reference.junctionUuids || []),
            ...(reference.pinUuids || []),
        ])
        : (net?.pcbRefs || []).flatMap((reference) => [
            ...(reference.trackUuids || []),
            ...(reference.arcUuids || []),
            ...(reference.viaUuids || []),
            ...(reference.zoneUuids || []),
            ...(reference.padUuids || []),
        ]);
    return {
        sourceContext: selection.sourceContext,
        targetContext,
        mode: "select",
        kind: "net",
        value: selection.netName || selection.netUid || selection.uuid || "",
        net: selection.netName,
        netCode: selection.netCode,
        netUid: selection.netUid,
        uuid: uuids[0],
        page: targetContext === "SCH"
            ? net?.schematicRefs?.[0]?.page
            : undefined,
        uuids,
    };
}
