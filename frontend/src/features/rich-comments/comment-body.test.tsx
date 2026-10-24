import { StrictMode } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it } from "vitest";

import { CommentBody } from "./comment-body";

const ID = "0123456789abcdef0123456789abcdef";

afterEach(cleanup);

// jsdom has <dialog> but not its modal API. Mirror the browser: close() fires
// `close`, which is what used to dismiss the lightbox under StrictMode.
beforeAll(() => {
    const proto = HTMLDialogElement.prototype;
    proto.showModal ??= function showModal(this: HTMLDialogElement) {
        this.setAttribute("open", "");
    };
    proto.close ??= function close(this: HTMLDialogElement) {
        if (!this.open) return;
        this.removeAttribute("open");
        this.dispatchEvent(new Event("close"));
    };
});

function body(content: string, contentFormat: "plain" | "md" = "md") {
    return render(<CommentBody projectId="p1" content={content} contentFormat={contentFormat} />).container;
}

describe("CommentBody", () => {
    it("renders legacy plain bodies verbatim", () => {
        const container = body("**not bold**\n<b>nor this</b>", "plain");
        expect(container.querySelector("strong, b")).toBeNull();
        expect(container.textContent).toBe("**not bold**\n<b>nor this</b>");
    });

    it("renders Markdown formatting", () => {
        const container = body("**bold** and `code`\n\n- one\n- two");
        expect(container.querySelector("strong")?.textContent).toBe("bold");
        expect(container.querySelector("code")?.textContent).toBe("code");
        expect(container.querySelectorAll("li")).toHaveLength(2);
    });

    it("never turns raw HTML into DOM", () => {
        const container = body('hi <script>alert(1)</script><img src="https://x.test/p.gif" onerror="alert(1)">');
        expect(container.querySelector("script")).toBeNull();
        expect(container.querySelector("img")).toBeNull();
    });

    it("loads images only from Prism attachments and links the rest", () => {
        const container = body(`![ext](https://x.test/p.gif)\n\n![snip](attachment:${ID})`);
        const images = container.querySelectorAll("img");
        expect(images).toHaveLength(1);
        expect(images[0]!.getAttribute("src")).toBe(`/api/projects/p1/comment-attachments/${ID}`);
        const external = Array.from(container.querySelectorAll("a")).find((a) => a.textContent?.includes("ext"));
        expect(external?.getAttribute("href")).toBe("https://x.test/p.gif");
        expect(external?.getAttribute("rel")).toBe("noopener noreferrer");
    });

    it("renders file attachments as downloads and external links safely", () => {
        const container = render(
            <CommentBody
                projectId="p1"
                contentFormat="md"
                content={`[icd.pdf](attachment:${ID}) [site](https://example.com) [bad](javascript:alert(1))`}
                attachments={[{ id: ID, filename: "icd.pdf", mediaType: "application/pdf", size: 2048 }]}
            />,
        ).container;
        const links = Array.from(container.querySelectorAll("a"));
        const file = links.find((a) => a.textContent?.includes("icd.pdf"))!;
        expect(file.getAttribute("href")).toBe(`/api/projects/p1/comment-attachments/${ID}`);
        expect(file.getAttribute("download")).toBe("icd.pdf");
        expect(file.textContent).toContain("2 KB");
        const site = links.find((a) => a.textContent === "site")!;
        expect(site.getAttribute("rel")).toBe("noopener noreferrer");
        const bad = links.find((a) => a.textContent === "bad");
        expect(bad?.getAttribute("href") ?? "").not.toContain("javascript");
    });

    it("opens a snip in a lightbox outside the paragraph, even under StrictMode", () => {
        render(
            <StrictMode>
                <CommentBody projectId="p1" contentFormat="md" content={`see ![snip](attachment:${ID})`} />
            </StrictMode>,
        );
        fireEvent.click(screen.getByRole("button", { name: "Open image snip" }));
        const dialog = document.querySelector("dialog");
        expect(dialog?.parentElement).toBe(document.body);
        fireEvent.click(screen.getByRole("button", { name: "Close image" }));
        expect(document.querySelector("dialog")).toBeNull();
    });
});
