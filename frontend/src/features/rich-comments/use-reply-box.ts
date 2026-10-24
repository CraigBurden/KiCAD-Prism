import { useRef, useState } from "react";
import type { RichComposerHandle, RichComposerState } from "./rich-composer";

const EMPTY: RichComposerState = { markdown: "", uploading: false };

/**
 * A thread's reply box: whether it is open, the draft it holds, and the
 * Markdown it opens with. `quote` appends to an open box or opens one seeded
 * with the quote, so every message's "Quote in reply" lands in the same place.
 */
export function useReplyBox() {
    const [open, setOpen] = useState(false);
    const [seed, setSeed] = useState<string | undefined>(undefined);
    const [draft, setDraft] = useState<RichComposerState>(EMPTY);
    const ref = useRef<RichComposerHandle>(null);

    const openWith = (markdown?: string) => {
        setDraft(EMPTY);
        setSeed(markdown);
        setOpen(true);
    };
    const close = () => {
        setOpen(false);
        setSeed(undefined);
        setDraft(EMPTY);
    };

    return {
        open,
        seed,
        draft,
        setDraft,
        ref,
        openWith,
        close,
        toggle: () => (open ? close() : openWith()),
        quote: (markdown: string) => {
            if (open && ref.current) ref.current.insertMarkdown(markdown);
            else openWith(markdown);
        },
    };
}
