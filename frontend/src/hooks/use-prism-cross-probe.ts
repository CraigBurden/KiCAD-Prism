import { useCallback, useEffect, useRef, useState } from "react";
import { enrichPrismSelection } from "@/lib/prism-selection";
import type {
    PrismSelection,
    PrismSemanticIndex,
    PrismViewerClient,
} from "@/types/prism-selection";

interface PrismCrossProbeBus {
    selection: PrismSelection | null;
    select: (selection: PrismSelection) => void;
    clear: () => void;
    registerClient: (client: PrismViewerClient) => () => void;
    notifyClientReady: (clientId: string) => void;
}

export function usePrismCrossProbe(
    semanticIndex: PrismSemanticIndex | null,
): PrismCrossProbeBus {
    const [selection, setSelection] = useState<PrismSelection | null>(null);
    const selectionRef = useRef<PrismSelection | null>(null);
    const clientsRef = useRef(new Map<string, PrismViewerClient>());

    const dispatch = useCallback((next: PrismSelection | null, onlyClientId?: string) => {
        for (const client of clientsRef.current.values()) {
            if (onlyClientId && client.id !== onlyClientId) continue;
            if (!client.isReady()) continue;
            if (
                next
                && client.context === next.sourceContext
                && (!client.revisionKey || !next.sourceRevisionKey || client.revisionKey === next.sourceRevisionKey)
            ) {
                continue;
            }
            if (
                next?.sourceRevisionKey
                && client.revisionKey
                && next.sourceRevisionKey !== client.revisionKey
            ) {
                continue;
            }
            void client.applySelection(next);
        }
    }, []);

    const select = useCallback((next: PrismSelection) => {
        const enriched = enrichPrismSelection(next, semanticIndex);
        selectionRef.current = enriched;
        setSelection(enriched);
        dispatch(enriched);
    }, [dispatch, semanticIndex]);

    const clear = useCallback(() => {
        selectionRef.current = null;
        setSelection(null);
        dispatch(null);
    }, [dispatch]);

    const registerClient = useCallback((client: PrismViewerClient) => {
        clientsRef.current.set(client.id, client);
        const current = selectionRef.current;
        const isSourceClient = Boolean(
            current
            && client.context === current.sourceContext
            && (!client.revisionKey || !current.sourceRevisionKey || client.revisionKey === current.sourceRevisionKey),
        );
        if (client.isReady() && !isSourceClient) void client.applySelection(current);
        return () => {
            if (clientsRef.current.get(client.id) === client) {
                clientsRef.current.delete(client.id);
            }
        };
    }, []);

    const notifyClientReady = useCallback((clientId: string) => {
        dispatch(selectionRef.current, clientId);
    }, [dispatch]);

    useEffect(() => {
        if (!selectionRef.current || !semanticIndex) return;
        const enriched = enrichPrismSelection(selectionRef.current, semanticIndex);
        selectionRef.current = enriched;
        setSelection(enriched);
        dispatch(enriched);
    }, [dispatch, semanticIndex]);

    return { selection, select, clear, registerClient, notifyClientReady };
}
