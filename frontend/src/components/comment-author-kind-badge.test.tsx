import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { CommentAuthorKindBadge } from "./comment-author-kind-badge";

afterEach(cleanup);

describe("CommentAuthorKindBadge", () => {
    it("marks an agent and names the MCP client in the title", () => {
        render(<CommentAuthorKindBadge authorKind="agent" authorClientId="claude-code" />);
        const badge = screen.getByText("Agent");
        expect(badge.getAttribute("title")).toBe("via claude-code");
    });

    it("marks a service", () => {
        render(<CommentAuthorKindBadge authorKind="service" authorClientId="prism-worker" />);
        expect(screen.getByText("Service").getAttribute("title")).toBe("via prism-worker");
    });

    it("leaves a person unmarked", () => {
        render(<CommentAuthorKindBadge authorKind="user" authorClientId="claude-code" />);
        expect(screen.queryByText("Agent")).toBeNull();
        expect(screen.queryByText("Service")).toBeNull();
    });

    it("marks an agent without a client id and omits the title", () => {
        render(<CommentAuthorKindBadge authorKind="agent" />);
        expect(screen.getByText("Agent").hasAttribute("title")).toBe(false);
    });
});
