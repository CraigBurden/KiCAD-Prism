import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CommentCard } from "./comment-card";
import type { Comment } from "@/types/comments";

// Every role may comment (the server's comment policy), so the card offers
// Reply to viewers too. Resolve and Delete follow the thread's own permissions,
// which the server computes per caller.

const base: Comment = {
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

function renderCard(comment: Comment) {
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

afterEach(cleanup);

describe("CommentCard thread permissions", () => {
    it("offers reply but not resolve or delete when the server refuses them", () => {
        renderCard({ ...base, permissions: { canReply: true, canResolve: false, canDelete: false } });
        expect(screen.getByRole("button", { name: "Reply" })).toBeTruthy();
        expect(screen.queryByRole("button", { name: "Resolve comment" })).toBeNull();
        expect(screen.queryByRole("button", { name: "Delete comment" })).toBeNull();
    });

    it("offers resolve and delete when the server allows them", () => {
        renderCard({ ...base, permissions: { canReply: true, canResolve: true, canDelete: true } });
        expect(screen.getByRole("button", { name: "Resolve comment" })).toBeTruthy();
        expect(screen.getByRole("button", { name: "Delete comment" })).toBeTruthy();
    });
});
