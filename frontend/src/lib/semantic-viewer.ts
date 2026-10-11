import { useSyncExternalStore } from "react";

import type {
    PrismRendererSelection,
    PrismScenePose,
    PrismSemanticViewState,
    PrismSemanticViewerElement,
    PrismSystemSceneEmphasisResult,
    PrismSystemSceneEmphasisSet,
    PrismSystemSceneHarnessState,
    PrismSystemSceneMoveState,
    PrismSystemViewerSelection,
} from "@/types/prism-semantic-viewer";
import type { SystemScene } from "@/types/system";

/**
 * The adapter in front of `<prism-semantic-viewer mode="system">` (AC-21).
 *
 * The element's API is optional member by member, it is usable only once the
 * bundle has defined it, and it reports through untyped DOM events. This
 * module owns the element reference, waits for the definition, decodes the
 * events (typed subscriptions that survive element swaps), mirrors what the
 * viewer reports as one snapshot, and translates selections both ways --
 * including a harness pick that has to wait until its tube is drawn.
 */

/** What the viewer should show for a workspace selection (SB2-61). */
export type SemanticViewerAction =
    | { type: "board"; path: string }
    | { type: "harness"; id: string }
    | { type: "parts"; parts: { occurrence: string; reference: string | null }[] }
    | { type: "clear" };

/** A selection the host makes: a board, or a net or component on one placement. */
export type HostSelection = Extract<PrismSystemViewerSelection, { kind: "board" | "net" | "component" }>;

export interface SemanticViewerState {
    element: PrismSemanticViewerElement | null;
    /** The viewer's last pick, or the host's last `select` (the viewer does not echo those). */
    selection: PrismSystemViewerSelection | null;
    viewState: PrismSemanticViewState | null;
    /** Why the viewer could not start. */
    error: string | null;
}

export interface SemanticViewerEvents {
    selection: PrismSystemViewerSelection | null;
    emphasis: PrismSystemSceneEmphasisResult[];
    move: PrismSystemSceneMoveState;
    harness: PrismSystemSceneHarnessState;
}
type EventName = keyof SemanticViewerEvents;
type Handler<K extends EventName> = (detail: SemanticViewerEvents[K]) => void;

/** A harness tube exists only once the boards it joins are drawn: ask again this often, this many times. */
const HARNESS_RETRY_MS = 400;
const HARNESS_RETRY_ATTEMPTS = 15;

const EMPTY_STATE: SemanticViewerState = { element: null, selection: null, viewState: null, error: null };

function rendererSelection(selection: HostSelection): PrismRendererSelection {
    if (selection.kind === "board") return { occurrence: selection.occurrence };
    if (selection.kind === "net") return { occurrence: selection.occurrence, netName: selection.netName };
    return { occurrence: selection.occurrence, reference: selection.reference };
}

export class SemanticViewer {
    #element: PrismSemanticViewerElement | null = null;
    #state: SemanticViewerState = EMPTY_STATE;
    #subscribers = new Set<() => void>();
    #handlers = new Map<EventName, Set<(detail: never) => void>>();
    #unbind: (() => void) | null = null;
    #showToken = 0;

    constructor(private readonly whenDefined: () => Promise<unknown> = () => customElements.whenDefined("prism-semantic-viewer")) {}

    get element(): PrismSemanticViewerElement | null {
        return this.#element;
    }

    getSnapshot = (): SemanticViewerState => this.#state;

    subscribe = (listener: () => void): (() => void) => {
        this.#subscribers.add(listener);
        return () => {
            this.#subscribers.delete(listener);
        };
    };

    on<K extends EventName>(name: K, handler: Handler<K>): () => void {
        let set = this.#handlers.get(name);
        if (!set) {
            set = new Set();
            this.#handlers.set(name, set);
        }
        const entry = handler as (detail: never) => void;
        set.add(entry);
        return () => {
            set.delete(entry);
        };
    }

    /** The element's callback ref. Stable for the adapter's lifetime. */
    attach = (element: PrismSemanticViewerElement | null): void => {
        if (element === this.#element) return;
        this.#unbind?.();
        this.#unbind = null;
        this.#showToken += 1;
        this.#element = element;
        this.#state = { ...EMPTY_STATE, element };
        if (element) this.#unbind = this.#bind(element);
        this.#notify();
    };

    /** Show a system once the element is defined. */
    setSystemScene(scene: SystemScene): void {
        this.#whenDefined((element) => element.setSystemScene?.(scene));
    }

    /** Light system nets once the element is defined; resolves what lit (null without the API or an element). */
    setNetEmphasis(sets: readonly PrismSystemSceneEmphasisSet[]): Promise<PrismSystemSceneEmphasisResult[] | null> {
        return this.#whenDefined((element) => element.setNetEmphasis?.(sets) ?? null).then((report) => report ?? null);
    }

    frameNetEmphasis(key: string | null, occurrence: string | null): boolean {
        return Boolean(this.#element?.frameNetEmphasis?.(key, occurrence));
    }

    frameBoard(path: string): void {
        this.#element?.frameBoard?.(path);
    }

    frameParts(parts: readonly { occurrence: string; reference: string | null }[]): void {
        this.#element?.frameParts?.(parts);
    }

    frameAll(): void {
        this.#element?.frameAll?.();
    }

    /** A host selection: the viewer shows it, and the snapshot takes it, as the viewer does not echo it. */
    select(selection: HostSelection): void {
        this.#element?.setSelection(rendererSelection(selection));
        this.#update({ selection });
    }

    /**
     * Show and frame a workspace selection once the element is defined. The
     * snapshot's selection is left alone. A harness is picked as soon as its
     * tube is drawn, while `isCurrent` holds and no later `show` replaced it.
     */
    show(action: SemanticViewerAction, isCurrent: () => boolean = () => true): void {
        const token = ++this.#showToken;
        this.#whenDefined((element) => {
            if (action.type !== "harness") element.selectHarness?.(null);
            if (action.type === "board") {
                element.setSelection({ occurrence: action.path });
                element.frameBoard?.(action.path);
            } else if (action.type === "harness") {
                const attempt = (left: number) => {
                    if (token !== this.#showToken || !isCurrent() || element.selectHarness?.(action.id) !== false || left === 0) return;
                    window.setTimeout(() => attempt(left - 1), HARNESS_RETRY_MS);
                };
                attempt(HARNESS_RETRY_ATTEMPTS);
            } else if (action.type === "parts") {
                element.setSelection(null);
                element.frameParts?.(action.parts);
            } else {
                element.setSelection(null);
            }
        });
    }

    /** Move mode (route: harness routes only) once the element is defined. */
    requestMoveMode(enabled: boolean, options?: { route?: boolean }): void {
        this.#whenDefined((element) => element.setMoveMode?.(enabled, options));
    }

    setMoveMode(enabled: boolean, options?: { route?: boolean }): void {
        this.#element?.setMoveMode?.(enabled, options);
    }

    setMoveSpace(space: "world" | "local"): void {
        this.#element?.setMoveSpace?.(space);
    }

    previewPose(pose: PrismScenePose | null): void {
        this.#element?.previewPose?.(pose);
    }

    cancelMove(): void {
        this.#element?.cancelMove?.();
    }

    targetHarnessNode(id: string | null): void {
        this.#element?.targetHarnessNode?.(id);
    }

    cancelHarnessNode(): void {
        this.#element?.cancelHarnessNode?.();
    }

    setNetIsolation(enabled: boolean): void {
        this.#element?.setNetIsolation?.(enabled);
    }

    setLabelsVisible(visible: boolean): void {
        this.#element?.setLabelsVisible?.(visible);
    }

    setHarnessesVisible(visible: boolean): void {
        this.#element?.setHarnessesVisible?.(visible);
    }

    setStatsOverlay(visible: boolean): void {
        this.#element?.setStatsOverlay?.(visible);
    }

    toggleHelp(): void {
        const element = this.#element;
        element?.setHelpVisible?.(!element.isHelpVisible?.());
    }

    /** Run `command` on the element once the bundle has defined it; undefined without an element. */
    #whenDefined<T>(command: (element: PrismSemanticViewerElement) => T): Promise<T | undefined> {
        const element = this.#element;
        if (!element) return Promise.resolve(undefined);
        return this.whenDefined().then(() => command(element));
    }

    #bind(element: PrismSemanticViewerElement): () => void {
        const offs: Array<() => void> = [];
        const listen = <K extends keyof HTMLElementEventMap>(type: K, listener: (event: HTMLElementEventMap[K]) => void) => {
            element.addEventListener(type, listener);
            offs.push(() => element.removeEventListener(type, listener));
        };
        listen("prism-semantic-viewer:selectionchange", (event) => {
            const selection = event.detail.selection;
            this.#update({ selection });
            this.#emit("selection", selection);
        });
        listen("prism-semantic-viewer:viewstatechange", (event) => this.#update({ viewState: event.detail }));
        listen("prism-semantic-viewer:emphasis", (event) => this.#emit("emphasis", event.detail.results));
        listen("prism-semantic-viewer:error", (event) => {
            const error = event.detail?.error;
            this.#update({ error: typeof error === "string" ? error : error?.message || "The 3D view could not start" });
        });
        listen("prism-semantic-viewer:move", (event) => this.#emit("move", event.detail));
        listen("prism-semantic-viewer:harness", (event) => this.#emit("harness", event.detail));
        return () => offs.forEach((off) => off());
    }

    #update(patch: Partial<SemanticViewerState>) {
        this.#state = { ...this.#state, ...patch };
        this.#notify();
    }

    #notify() {
        for (const listener of this.#subscribers) listener();
    }

    #emit<K extends EventName>(name: K, detail: SemanticViewerEvents[K]) {
        const set = this.#handlers.get(name);
        if (!set) return;
        for (const handler of set) (handler as Handler<K>)(detail);
    }
}

export function useSemanticViewer(viewer: SemanticViewer): SemanticViewerState {
    return useSyncExternalStore(viewer.subscribe, viewer.getSnapshot);
}
