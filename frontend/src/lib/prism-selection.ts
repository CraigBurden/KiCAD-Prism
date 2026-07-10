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
    KiCanvasSelectDetail,
} from "@/types/ecad-viewer";

type UnknownRecord = Record<string, unknown>;

const asRecord = (value: unknown): UnknownRecord | null =>
    value !== null && typeof value === "object" ? value as UnknownRecord : null;

const stringValue = (value: unknown): string | undefined => {
    if (typeof value !== "string" && typeof value !== "number") return undefined;
    const normalized = String(value).trim();
    return normalized || undefined;
};

const numberValue = (value: unknown): number | undefined => {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value !== "string" || !value.trim()) return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
};

const normalizeReference = (value: unknown): string | undefined => {
    const normalized = stringValue(value);
    if (!normalized) return undefined;
    return /^[A-Za-z]+\d+[A-Za-z0-9._-]*$/.test(normalized) ? normalized : undefined;
};

const propertyText = (record: UnknownRecord, name: string): unknown => {
    if (typeof record.get_property_text === "function") {
        try {
            return (record.get_property_text as (key: string) => unknown)(name);
        } catch {
            return undefined;
        }
    }
    const properties = record.properties;
    if (!(properties instanceof Map)) return undefined;
    const property = asRecord(properties.get(name));
    return property?.shown_text ?? property?.text ?? property?.value;
};

const findNested = <T>(
    item: unknown,
    selector: (record: UnknownRecord) => T | undefined,
    depth = 0,
): T | undefined => {
    const record = asRecord(item);
    if (!record || depth > 4) return undefined;
    const selected = selector(record);
    if (selected !== undefined) return selected;
    for (const child of [record.parent, record.item, record.context, record.footprint]) {
        const nested = findNested(child, selector, depth + 1);
        if (nested !== undefined) return nested;
    }
    return undefined;
};

const findReference = (item: unknown): string | undefined =>
    findNested(item, (record) => {
        for (const candidate of [
            record.reference,
            record.Reference,
            record.designator,
            record.elementRef,
            record.ref,
            record.Ref,
            propertyText(record, "Reference"),
            asRecord(record.default_instance)?.reference,
        ]) {
            const reference = normalizeReference(candidate);
            if (reference) return reference;
        }
        return undefined;
    });

const findUuid = (item: unknown): string | undefined =>
    findNested(item, (record) => stringValue(record.uuid ?? record.tstamp ?? record.source_uuid));

const findPin = (item: unknown): string | undefined =>
    findNested(item, (record) => stringValue(record.pin ?? record.pinNumber ?? record.number ?? record.padNumber));

const findNet = (item: unknown): { name?: string; code?: number } => {
    const net = findNested(item, (record) => {
        const nestedNet = asRecord(record.net);
        const name = stringValue(
            record.netName ?? record.net_name ?? nestedNet?.name ?? nestedNet?.net_name,
        );
        const code = numberValue(
            record.netCode ?? record.net_code ?? nestedNet?.code ?? nestedNet?.number,
        );
        if (name || code !== undefined) return { name, code };
        if (typeof record.net === "string") return { name: stringValue(record.net) };
        if (typeof record.net === "number") return { code: record.net };
        return undefined;
    });
    return net ?? {};
};

const inferItemType = (item: unknown): string => {
    return findNested(item, (record) => {
        const explicit = stringValue(record.itemType ?? record.typeId ?? record.type ?? record.kind);
        if (explicit && explicit !== "unknown") return explicit;
        const constructorName = stringValue(record.constructor && asRecord(record.constructor)?.name);
        if (constructorName && constructorName !== "Object" && constructorName.length > 1) return constructorName;
        return undefined;
    }) ?? "unknown";
};

const normalizedDetail = (
    detail: KiCanvasSelectDetail,
    fallbackContext: "SCH" | "PCB",
): EcadSemanticSelectionDetail => {
    if (detail.semantic) {
        const inferred = inferItemType(detail.item);
        return {
            ...detail.semantic,
            sourceContext: detail.semantic.sourceContext ?? fallbackContext,
            itemType: detail.semantic.itemType && detail.semantic.itemType !== "unknown"
                ? detail.semantic.itemType
                : inferred,
        };
    }
    const item = detail.item;
    const net = findNet(item);
    return {
        sourceContext: detail.sourceContext === "PCB" ? "PCB" : fallbackContext,
        itemType: inferItemType(item),
        uuid: findUuid(item),
        reference: findReference(item),
        pin: findPin(item),
        net: net.name,
        netCode: net.code,
        rawItem: item,
    };
};

export function normalizeEcadSelection(
    detail: KiCanvasSelectDetail,
    fallbackContext: "SCH" | "PCB",
    sourceRevisionKey?: string,
): PrismSelection | null {
    const normalized = normalizedDetail(detail, fallbackContext);
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
        return {
            sourceContext: selection.sourceContext,
            targetContext,
            mode: "select",
            kind: "designator",
            value: selection.reference,
            designator: selection.reference,
            componentUid: selection.componentUid,
            uuid: selection.uuid,
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
        uuid: selection.uuid,
        uuids,
    };
}
