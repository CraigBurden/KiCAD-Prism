import { useState } from "react";

/**
 * A side panel's collapsed state, remembered per viewer under `storageKey`.
 *
 * Below `collapseBelow` (a window width) the panel always starts collapsed, so
 * a narrow window keeps its room for the content; the remembered choice only
 * applies where there is space for it. Storage can be unavailable; the panel
 * then simply forgets on reload.
 */
export function useCollapsed(
    storageKey: string,
    collapseBelow: number,
): [boolean, (next: boolean) => void] {
    const [collapsed, setCollapsed] = useState(() => {
        if (window.innerWidth < collapseBelow) return true;
        try {
            return window.localStorage.getItem(storageKey) === "true";
        } catch {
            return false;
        }
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
