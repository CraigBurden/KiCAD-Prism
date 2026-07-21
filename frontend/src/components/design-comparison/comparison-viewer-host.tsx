import {
    useCallback,
    useEffect,
    useLayoutEffect,
    useRef,
    useState,
} from "react";
import type { ECadViewerElement } from "@/types/ecad-viewer";

type ComparisonViewerHostProps = {
    viewerKey: string;
    active: boolean;
    onViewer: (viewer: ECadViewerElement | null) => void;
    onLayoutReady: (viewerKey: string) => void;
};

export function ComparisonViewerHost({
    viewerKey,
    active,
    onViewer,
    onLayoutReady,
}: ComparisonViewerHostProps) {
    const [viewer, setViewer] = useState<ECadViewerElement | null>(null);
    const latestViewerRef = useRef<ECadViewerElement | null>(null);

    const attachViewer = useCallback(
        (node: ECadViewerElement | null) => {
            latestViewerRef.current = node;
            setViewer(node);
            onViewer(node);
        },
        [onViewer],
    );

    useLayoutEffect(() => {
        if (!viewer) return;
        let cancelled = false;
        let observer: ResizeObserver | null = null;

        const reportWhenSized = async () => {
            await customElements.whenDefined("ecad-viewer");
            if (cancelled || latestViewerRef.current !== viewer) return;
            if (viewer.clientWidth > 0 && viewer.clientHeight > 0) {
                onLayoutReady(viewerKey);
                return;
            }
            observer = new ResizeObserver(() => {
                if (
                    !cancelled
                    && latestViewerRef.current === viewer
                    && viewer.clientWidth > 0
                    && viewer.clientHeight > 0
                ) {
                    observer?.disconnect();
                    observer = null;
                    onLayoutReady(viewerKey);
                }
            });
            observer.observe(viewer);
        };

        void reportWhenSized();
        return () => {
            cancelled = true;
            observer?.disconnect();
        };
    }, [onLayoutReady, viewer, viewerKey]);

    useEffect(() => {
        if (!viewer) return;
        let cancelled = false;
        void customElements.whenDefined("ecad-viewer").then(() => {
            if (!cancelled && latestViewerRef.current === viewer) {
                viewer.setActive(active);
            }
        });
        return () => {
            cancelled = true;
        };
    }, [active, viewer]);

    return (
        <ecad-viewer
            ref={attachViewer}
            className="block h-full w-full"
            show-header="false"
            show-selection-panel="false"
            source-mode="host"
        />
    );
}
