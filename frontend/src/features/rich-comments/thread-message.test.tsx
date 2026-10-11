import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fetchApi, readApiError } from "@/lib/api";
import type { Comment } from "@/types/comments";
import { collectSnips } from "./snip-gallery";
import { editableMarkdown, plainToMarkdown, quoteMarkdown } from "./quote";
import { RichComposer, type RichComposerHandle, type RichComposerState } from "./rich-composer";
import { composerEditor } from "./test-utils";
import { ThreadMessage } from "./thread-message";
import { ThreadUpdateContext } from "./thread-updates";
import { latestActivity, useUnreadThreads } from "./unread";

vi.mock("@/lib/api", async (importOriginal) => ({
    ifMatch: (await importOriginal<typeof import("@/lib/api")>()).ifMatch,
    fetchApi: vi.fn(),
    readApiError: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

const mockedFetch = vi.mocked(fetchApi);
const ID = "0123456789abcdef0123456789abcdef";

function thread(overrides: Partial<Comment> = {}): Comment {
    return {
        id: "c1", author: "Ana", timestamp: "2026-09-01T10:00:00Z", status: "OPEN", context: "PCB",
        location: { x: 0, y: 0, layer: "F.Cu" }, content: "**OVP** too low", contentFormat: "md",
        replies: [], commentClass: "general", severity: "info", mentions: [], revision: 3,
        permissions: { canEdit: true, canReply: true },
        ...overrides,
    };
}

function ok(body: unknown) {
    return { ok: true, status: 200, json: async () => body } as Response;
}

beforeEach(() => {
    mockedFetch.mockReset();
    vi.mocked(readApiError).mockResolvedValue("refused");
});
afterEach(cleanup);

describe("quoting", () => {
    it("keeps a plain body's text when it becomes Markdown", () => {
        expect(plainToMarkdown("R12 = 4.7k *typ*\n- not a list\n\nnext")).toBe(
            "R12 = 4\\.7k \\*typ\\*\\\n\\- not a list\n\nnext",
        );
        expect(editableMarkdown("**x**", "md")).toBe("**x**");
    });

    it("quotes the author and every line, snips included", () => {
        expect(quoteMarkdown("Ana_B", `See\n\n![s](attachment:${ID})`, "md")).toBe(
            `> **Ana\\_B** wrote:\n>\n> See\n>\n> ![s](attachment:${ID})\n\n`,
        );
    });
});

describe("ThreadMessage", () => {
    function renderMessage(comment: Comment, extra: Partial<Parameters<typeof ThreadMessage>[0]> = {}) {
        const apply = vi.fn();
        render(
            <ThreadUpdateContext.Provider value={apply}>
                <ThreadMessage projectId="p1" thread={comment} canInteract {...extra} />
            </ThreadUpdateContext.Provider>,
        );
        return apply;
    }

    it("shows reactions and toggles the reader's own", async () => {
        const updated = thread({ reactions: [] });
        mockedFetch.mockResolvedValue(ok(updated));
        const apply = renderMessage(thread({
            reactions: [{ reaction: "eyes", count: 2, users: ["Ana", "Bo"], mine: true }],
        }));
        const chip = screen.getByRole("button", { name: /Looking: Ana, Bo\. Remove your reaction/ });
        expect(chip).toHaveAttribute("aria-pressed", "true");
        fireEvent.click(chip);
        await waitFor(() => expect(apply).toHaveBeenCalledWith(updated));
        expect(mockedFetch).toHaveBeenCalledWith("/api/projects/p1/comments/c1/reactions/eyes", { method: "DELETE" });
    });

    it("reacts to a reply by id", async () => {
        mockedFetch.mockResolvedValue(ok(thread()));
        render(
            <ThreadMessage
                projectId="p1"
                thread={thread()}
                reply={{ id: "r1", author: "Bo", timestamp: "2026-09-01T11:00:00Z", content: "ok", reactions: [
                    { reaction: "check", count: 1, users: ["Ana"], mine: false },
                ] }}
                canInteract
            />,
        );
        fireEvent.click(screen.getByRole("button", { name: /Done: Ana\. Add your reaction/ }));
        await waitFor(() => expect(mockedFetch).toHaveBeenCalledWith(
            "/api/projects/p1/comments/c1/reactions/check?replyId=r1", { method: "PUT" },
        ));
    });

    it("marks edited messages and hides actions from readers", () => {
        renderMessage(thread({ editedAt: "2026-09-02T10:00:00Z", permissions: {} }), { canInteract: false });
        expect(screen.getByText("(edited)")).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Edit message" })).toBeNull();
        expect(screen.queryByRole("button", { name: "Add reaction" })).toBeNull();
    });

    it("edits in place against the revision it opened", async () => {
        const updated = thread({ content: "**OVP** fixed", editedAt: "2026-09-02T10:00:00Z" });
        mockedFetch.mockResolvedValue(ok(updated));
        const apply = renderMessage(thread());
        fireEvent.click(screen.getByRole("button", { name: "Edit message" }));
        const box = screen.getByRole("textbox", { name: "Edit message" });
        const editor = composerEditor(box);
        expect(editor.getMarkdown()).toBe("**OVP** too low");
        act(() => {
            editor.commands.setContent("**OVP** fixed", { contentType: "markdown" });
        });
        fireEvent.click(screen.getByRole("button", { name: "Save" }));
        await waitFor(() => expect(apply).toHaveBeenCalledWith(updated));
        const [path, init] = mockedFetch.mock.calls[0]!;
        expect(path).toBe("/api/projects/p1/comments/c1");
        expect(JSON.parse(String(init?.body))).toEqual({
            content: "**OVP** fixed", contentFormat: "md", mentions: [],
        });
        expect(init?.headers).toEqual({ "If-Match": '"comment:c1:3"' });
        expect(screen.queryByRole("textbox", { name: "Edit message" })).toBeNull();
    });

    it("drops a mention the edit removed and keeps one still there", async () => {
        mockedFetch.mockResolvedValue(ok(thread()));
        renderMessage(thread({
            content: "cc @ana@example.com and @bo@example.com", mentions: ["ana@example.com", "bo@example.com"],
        }));
        fireEvent.click(screen.getByRole("button", { name: "Edit message" }));
        const editor = composerEditor(screen.getByRole("textbox", { name: "Edit message" }));
        act(() => {
            editor.commands.setContent("cc @bo@example.com only", { contentType: "markdown" });
        });
        fireEvent.click(screen.getByRole("button", { name: "Save" }));
        await waitFor(() => expect(mockedFetch).toHaveBeenCalled());
        expect(JSON.parse(String(mockedFetch.mock.calls[0]![1]?.body)).mentions).toEqual(["bo@example.com"]);
    });

    it("saving an unchanged edit sends nothing", () => {
        renderMessage(thread({ content: "plain *text*", contentFormat: "plain" }));
        fireEvent.click(screen.getByRole("button", { name: "Edit message" }));
        fireEvent.click(screen.getByRole("button", { name: "Save" }));
        expect(mockedFetch).not.toHaveBeenCalled();
        expect(screen.getByText("plain *text*")).toBeInTheDocument();
    });
});

describe("composer seeding", () => {
    it("opens with Markdown and appends a quote after it", () => {
        const states: RichComposerState[] = [];
        const ref = { current: null as RichComposerHandle | null };
        render(
            <RichComposer
                ref={ref}
                projectId="p1"
                ariaLabel="Reply"
                initialMarkdown={"> **Ana** wrote:\n>\n> hi\n\n"}
                onChange={(state) => states.push(state)}
            />,
        );
        expect(states[0]?.markdown).toBe("> **Ana** wrote:\n>\n> hi");
        act(() => ref.current?.insertMarkdown("> second"));
        expect(states[states.length - 1]?.markdown).toContain("> second");
    });
});

describe("snips and unread", () => {
    it("collects each image once, with the thread that posted it", () => {
        const image = { id: ID, filename: "scope.png", mediaType: "image/png", size: 10 };
        const pdf = { id: "f".repeat(32), filename: "icd.pdf", mediaType: "application/pdf", size: 10 };
        const snips = collectSnips([thread({
            attachments: [image, pdf],
            replies: [{ id: "r1", author: "Bo", timestamp: "2026-09-01T11:00:00Z", content: "", attachments: [image] }],
        })]);
        expect(snips.map((snip) => [snip.attachment.filename, snip.author])).toEqual([["scope.png", "Ana"]]);
    });

    it("counts replies and edits as activity", () => {
        const base = thread();
        expect(latestActivity(base)).toBe(Date.parse("2026-09-01T10:00:00Z"));
        expect(latestActivity({ ...base, replies: [
            { author: "Bo", timestamp: "2026-09-01T12:00:00Z", content: "", editedAt: "2026-09-03T00:00:00Z" },
        ] })).toBe(Date.parse("2026-09-03T00:00:00Z"));
    });

    it("flags threads with activity since the baseline until opened", () => {
        window.localStorage.setItem("prism:comments-seen:p9", JSON.stringify({
            baseline: "2026-09-01T12:00:00Z", seen: {},
        }));
        const older = thread({ id: "old" });
        const newer = thread({ id: "new", timestamp: "2026-09-02T00:00:00Z" });
        let api: ReturnType<typeof useUnreadThreads> | null = null;
        function Probe() {
            api = useUnreadThreads("p9");
            return null;
        }
        render(<Probe />);
        expect(api!.isUnread(older)).toBe(false);
        expect(api!.isUnread(newer)).toBe(true);
        act(() => api!.markSeen(newer));
        expect(api!.isUnread(newer)).toBe(false);
        const stored = JSON.parse(window.localStorage.getItem("prism:comments-seen:p9")!);
        expect(Object.keys(stored.seen)).toEqual(["new"]);
    });

    it("starts a new project with nothing unread", () => {
        window.localStorage.removeItem("prism:comments-seen:p10");
        let api: ReturnType<typeof useUnreadThreads> | null = null;
        function Probe() {
            api = useUnreadThreads("p10");
            return null;
        }
        render(<Probe />);
        expect(api!.isUnread(thread())).toBe(false);
    });
});
