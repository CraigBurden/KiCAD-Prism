import { useState } from "react";

/**
 * A side panel's collapsed state, remembered per viewer under `storageKey`.
 * With nothing stored, `initial()` decides (a window-width rule, say). Storage
 * can be unavailable; the panel then simply forgets on reload.
 */
export function useCollapsed(storageKey: string, initial: () => boolean): [boolean, (next: boolean) => void] {
    const [collapsed, setCollapsed] = useState(() => {
        try {
            const stored = window.localStorage.getItem(storageKey);
            if (stored === "true" || stored === "false") return stored === "true";
        } catch {
            // Fall through to the default.
        }
        return initial();
    });
    const set = (next: boolean) => {
        setCollapsed(next);
        try {
            window.localStorage.setItem(storageKey, String(next));
        } catch {
            // Only lost on reload.
        }
    };
    return [collapsed, set];
}
