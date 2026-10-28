import type { CommentContentFormat } from "@/types/comments";

const MARKDOWN_PUNCTUATION = /[\\`*_{}[\]()#+\-.!|<>~]/g;

/**
 * A legacy plain body as Markdown that renders the same text: punctuation is
 * escaped and line breaks become hard breaks, so editing or quoting it in the
 * WYSIWYG composer shows exactly what the thread showed.
 */
export function plainToMarkdown(text: string): string {
    return text
        .trim()
        .split(/\n{2,}/)
        .map((paragraph) => paragraph
            .split("\n")
            .map((line) => line.replace(MARKDOWN_PUNCTUATION, "\\$&"))
            .join("\\\n"))
        .join("\n\n");
}

export function editableMarkdown(content: string, format: CommentContentFormat | undefined): string {
    return format === "md" ? content : plainToMarkdown(content);
}

/** `> **Author** wrote:` followed by the message, then room to answer. */
export function quoteMarkdown(author: string, content: string, format: CommentContentFormat | undefined): string {
    const body = editableMarkdown(content, format).trim();
    const quoted = body.split("\n").map((line) => (line ? `> ${line}` : ">"));
    return [`> **${author.replace(MARKDOWN_PUNCTUATION, "\\$&")}** wrote:`, ">", ...quoted, "", ""].join("\n");
}
