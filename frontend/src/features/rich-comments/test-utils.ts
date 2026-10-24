import { act } from "@testing-library/react";
import type { Editor } from "@tiptap/react";

/** jsdom cannot type into contenteditable; drive the composer's editor instead. */
export function composerEditor(element: HTMLElement): Editor {
    const editor = (element as HTMLElement & { editor?: Editor }).editor;
    if (!editor) throw new Error("Element is not a rich composer");
    return editor;
}

export function typeInComposer(element: HTMLElement, text: string): void {
    act(() => {
        composerEditor(element).commands.insertContent(text);
    });
}
