import type { Editor } from "@tiptap/react";
import { ATTACHMENT_SCHEME, uploadCommentAttachment } from "./attachments";

let uploadSequence = 0;

function findUploadPos(editor: Editor, uploadId: string): number | null {
    let found: number | null = null;
    editor.state.doc.descendants((node, pos) => {
        if (found !== null) return false;
        if (node.type.name === "image" && node.attrs.uploadId === uploadId) found = pos;
        return true;
    });
    return found;
}

/**
 * Show a pasted image immediately from a local preview, then point it at the
 * stored attachment once the upload lands. The preview URL lives exactly as
 * long as the upload does.
 */
async function uploadImage(editor: Editor, projectId: string, file: File, at?: number): Promise<void> {
    const uploadId = `upload-${++uploadSequence}`;
    const preview = URL.createObjectURL(file);
    try {
        // A trailing paragraph keeps the caret after the image; otherwise the
        // image stays selected and the reviewer's next keystroke replaces it.
        const content = [
            { type: "image", attrs: { src: preview, alt: file.name || "image", uploadId } },
            { type: "paragraph" },
        ];
        const chain = editor.chain().focus();
        (at !== undefined ? chain.insertContentAt(at, content) : chain.insertContent(content)).run();
        try {
            const uploaded = await uploadCommentAttachment(projectId, file);
            const pos = editor.isDestroyed ? null : findUploadPos(editor, uploadId);
            if (pos === null) return; // removed while uploading
            editor.view.dispatch(editor.state.tr.setNodeMarkup(pos, undefined, {
                ...editor.state.doc.nodeAt(pos)!.attrs,
                src: `${ATTACHMENT_SCHEME}${uploaded.id}`,
                alt: uploaded.filename,
                uploadId: null,
            }));
        } catch (error) {
            const pos = editor.isDestroyed ? null : findUploadPos(editor, uploadId);
            if (pos !== null) editor.view.dispatch(editor.state.tr.delete(pos, pos + 1));
            throw error;
        }
    } finally {
        URL.revokeObjectURL(preview);
    }
}

/** Other files become a named link that the thread renders as a download. */
async function uploadFile(editor: Editor, projectId: string, file: File): Promise<void> {
    const uploaded = await uploadCommentAttachment(projectId, file);
    if (editor.isDestroyed) return;
    editor.chain().focus().insertContent([
        {
            type: "text",
            text: uploaded.filename,
            marks: [{ type: "link", attrs: { href: `${ATTACHMENT_SCHEME}${uploaded.id}` } }],
        },
        { type: "text", text: " " },
    ]).run();
}

export function uploadIntoEditor(editor: Editor, projectId: string, file: File, at?: number): Promise<void> {
    return file.type.startsWith("image/")
        ? uploadImage(editor, projectId, file, at)
        : uploadFile(editor, projectId, file);
}
