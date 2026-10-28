import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RichComposer, extractMentions, type RichComposerState } from "./rich-composer";
import { composerEditor } from "./test-utils";
import { uploadCommentAttachment } from "./attachments";

vi.mock("./attachments", async (importOriginal) => ({
    ...(await importOriginal<typeof import("./attachments")>()),
    uploadCommentAttachment: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

const mockedUpload = vi.mocked(uploadCommentAttachment);
const ID = "0123456789abcdef0123456789abcdef";

function renderComposer() {
    const states: RichComposerState[] = [];
    const onSubmit = vi.fn();
    render(
        <RichComposer
            projectId="p1"
            ariaLabel="Comment"
            onChange={(state) => states.push(state)}
            onSubmit={onSubmit}
        />,
    );
    const box = screen.getByRole("textbox", { name: "Comment" });
    return { box, editor: composerEditor(box), states, onSubmit, last: () => states[states.length - 1]! };
}

function paste(box: HTMLElement, files: File[], html = "") {
    const event = new Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(event, "clipboardData", {
        value: {
            files,
            types: html ? ["text/html"] : [],
            getData: (type: string) => (type === "text/html" ? html : ""),
        },
    });
    act(() => {
        box.dispatchEvent(event);
    });
}

beforeEach(() => {
    mockedUpload.mockReset();
    URL.createObjectURL = vi.fn(() => "blob:preview");
    URL.revokeObjectURL = vi.fn();
});

afterEach(cleanup);

describe("RichComposer", () => {
    it("emits formatting as Markdown", () => {
        const { editor, last } = renderComposer();
        act(() => {
            editor.commands.setContent("<p><strong>Check</strong> <em>R12</em></p><ul><li><p>value</p></li></ul>");
        });
        expect(last().markdown).toBe("**Check** *R12*\n\n- value");
    });

    it("uploads a pasted snip and swaps in its attachment reference", async () => {
        let finish!: (value: Awaited<ReturnType<typeof uploadCommentAttachment>>) => void;
        mockedUpload.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
        const { box, last } = renderComposer();

        paste(box, [new File(["png"], "snip.png", { type: "image/png" })]);
        expect(mockedUpload).toHaveBeenCalledWith("p1", expect.any(File));
        // Submitting now would post a blob: URL nobody else can load.
        expect(last().uploading).toBe(true);
        expect(box.querySelector("img[data-uploading]")?.getAttribute("src")).toBe("blob:preview");

        await act(async () => {
            finish({ id: ID, filename: "snip.png", mediaType: "image/png", size: 3 });
        });
        await waitFor(() => expect(last().uploading).toBe(false));
        expect(last().markdown).toBe(`![snip.png](attachment:${ID})`);
        expect(box.querySelector("img")?.getAttribute("src")).toBe(`/api/projects/p1/comment-attachments/${ID}`);
    });

    it("removes the placeholder when the upload is refused", async () => {
        mockedUpload.mockRejectedValue(new Error("Attachments are limited to 10 MB."));
        const { box, last } = renderComposer();
        paste(box, [new File(["png"], "huge.png", { type: "image/png" })]);
        await waitFor(() => expect(last().uploading).toBe(false));
        expect(box.querySelector("img")).toBeNull();
        expect(last().markdown).toBe("");
    });

    it("links a non-image attachment by name", async () => {
        mockedUpload.mockResolvedValue({ id: ID, filename: "icd.pdf", mediaType: "application/pdf", size: 9 });
        const { box, last } = renderComposer();
        paste(box, [new File(["%PDF"], "icd.pdf", { type: "application/pdf" })]);
        await waitFor(() => expect(last().markdown).toBe(`[icd.pdf](attachment:${ID})`));
    });

    it("drops images pasted from anywhere but Prism", () => {
        const { editor, last } = renderComposer();
        act(() => {
            editor.commands.setContent(
                `<p>see</p><img src="https://tracker.example/pixel.gif">`
                + `<img src="/api/projects/p1/comment-attachments/${ID}" alt="ok">`,
            );
        });
        expect(last().markdown).toBe(`see\n\n![ok](attachment:${ID})`);
    });

    it("keeps the caret after a pasted image so typing does not replace it", async () => {
        mockedUpload.mockResolvedValue({ id: ID, filename: "snip.png", mediaType: "image/png", size: 3 });
        const { box, editor, last } = renderComposer();
        act(() => {
            editor.commands.insertContent("See:");
        });
        paste(box, [new File(["png"], "snip.png", { type: "image/png" })]);
        await waitFor(() => expect(last().uploading).toBe(false));
        act(() => {
            editor.commands.insertContent("after");
        });
        expect(last().markdown).toBe(`See:\n\n![snip.png](attachment:${ID})\n\nafter`);
    });

    it("keeps a paragraph that starts like a list a paragraph", () => {
        const { editor, last } = renderComposer();
        act(() => {
            editor.commands.setContent("<p>- not a list</p><p>2. nor this</p><p>&gt; nor a quote</p>");
        });
        expect(last().markdown).toBe("\\- not a list\n\n2\\. nor this\n\n&gt; nor a quote");
    });

    it("turns typed Markdown shortcuts into formatting", () => {
        const { editor, last } = renderComposer();
        const type = (text: string) => {
            for (const char of text) {
                const { from, to } = editor.state.selection;
                act(() => {
                    const handled = editor.view.someProp("handleTextInput", (f) => f(editor.view, from, to, char, () => editor.state.tr.insertText(char, from, to)));
                    if (!handled) editor.view.dispatch(editor.state.tr.insertText(char, from, to));
                });
            }
        };
        type("- item");
        expect(last().markdown).toBe("- item");
        act(() => {
            editor.commands.setContent("");
        });
        type("see `U3` now");
        expect(last().markdown).toBe("see `U3` now");
    });

    it("submits on Ctrl+Enter", () => {
        const { box, onSubmit } = renderComposer();
        act(() => {
            box.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", ctrlKey: true, bubbles: true }));
        });
        expect(onSubmit).toHaveBeenCalledTimes(1);
    });
});

describe("extractMentions", () => {
    it("reads escaped Markdown and keeps only known members", () => {
        const candidates = [{ email: "first_last@example.com", role: "viewer" }];
        expect(extractMentions("ping @first\\_last@example.com and @nobody@example.com", candidates))
            .toEqual(["first_last@example.com"]);
    });
});
