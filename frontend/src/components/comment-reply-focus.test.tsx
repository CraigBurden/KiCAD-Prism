import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CommentCard } from "./comment-card";
import type { Comment } from "@/types/comments";
import { typeInComposer } from "@/features/rich-comments/test-utils";

// The card is a non-modal dialog, not a Radix one, so nothing else would focus
// the reply box: revealing it has to place the caret in it, or the reviewer
// types into nothing. The rich composer autofocuses on mount.

const comment: Comment = {
    id: "c1",
    author: "reviewer@example.com",
    timestamp: "2026-08-23T00:00:00Z",
    status: "OPEN",
    context: "PCB",
    location: { x: 1, y: 2, layer: "F.Cu" },
    content: "Check this footprint.",
    replies: [],
    commentClass: "question",
    severity: "minor",
    mentions: [],
};

function renderCard() {
    render(
        <CommentCard
            projectId="p1"
            comment={comment}
            screenPosition={{ x: 10, y: 10 }}
            canModify
            onClose={vi.fn()}
            onResolve={vi.fn()}
            onReply={vi.fn().mockResolvedValue(undefined)}
            onDelete={vi.fn().mockResolvedValue(undefined)}
        />,
    );
}

const replyToggle = () => screen.getByRole("button", { name: "Reply" });
const replyBox = () => screen.getByRole("textbox", { name: "Reply" });

afterEach(cleanup);

describe("CommentCard reply focus", () => {
    it("has no reply box until the reviewer asks for one", () => {
        renderCard();
        expect(screen.queryByRole("textbox", { name: "Reply" })).toBeNull();
    });

    it("puts the caret in the reply box when it is revealed", async () => {
        renderCard();
        fireEvent.click(replyToggle());
        await waitFor(() => expect(document.activeElement).toBe(replyBox()));
    });

    it("takes typing without a second click", async () => {
        renderCard();
        fireEvent.click(replyToggle());
        await waitFor(() => expect(document.activeElement).toBe(replyBox()));
        typeInComposer(document.activeElement as HTMLElement, "looks wrong to me");
        expect(replyBox().textContent).toBe("looks wrong to me");
    });
});
