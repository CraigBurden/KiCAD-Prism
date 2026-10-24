import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import ReactMarkdown, { defaultUrlTransform } from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import type { Options as SanitizeSchema } from "rehype-sanitize";
import { Image as ImageIcon, Paperclip } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CommentAttachment, CommentContentFormat } from "@/types/comments";
import { attachmentIdFromRef, attachmentUrl, formatBytes } from "./attachments";

/**
 * What a review comment may render.
 *
 * Comment bodies are written by any project member and, for linked threads,
 * by anyone who can comment on the forge issue. There is no raw HTML: without
 * `rehype-raw` it never becomes DOM, and the schema below would drop it anyway.
 * Images load only from Prism's own attachment route -- a hot-linked image is
 * a tracking pixel. An image hosted elsewhere (a forge's own upload, synced
 * into a linked thread) is shown as a link instead of being fetched. Links
 * are limited to web and mail protocols.
 */
const schema: SanitizeSchema = {
    ...defaultSchema,
    protocols: {
        ...defaultSchema.protocols,
        href: ["http", "https", "mailto", "attachment"],
        src: ["attachment", "http", "https"],
    },
};

interface CommentBodyProps {
    projectId: string;
    content: string;
    contentFormat?: CommentContentFormat;
    attachments?: CommentAttachment[];
    className?: string;
}

export function CommentBody({ projectId, content, contentFormat, attachments, className }: CommentBodyProps) {
    if (contentFormat !== "md") {
        return <p className={cn("whitespace-pre-wrap text-sm", className)}>{content}</p>;
    }
    const byId = new Map((attachments ?? []).map((item) => [item.id, item]));
    return (
        <div className={cn("rich-comment", className)}>
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[[rehypeSanitize, schema]]}
                urlTransform={(url) => {
                    const id = attachmentIdFromRef(url);
                    return id ? attachmentUrl(projectId, id) : defaultUrlTransform(url);
                }}
                components={{
                    img: ({ src, alt }) => {
                        if (!src) return null;
                        const url = String(src);
                        if (url.startsWith(attachmentUrl(projectId, ""))) return <CommentImage src={url} alt={alt ?? ""} />;
                        return (
                            <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1">
                                <ImageIcon className="h-3 w-3" />
                                {alt || "External image"}
                            </a>
                        );
                    },
                    a: ({ href, children }) => {
                        const id = href ? attachmentIdFromRef(hrefToRef(projectId, href)) : null;
                        const file = id ? byId.get(id) : undefined;
                        if (id) {
                            return (
                                <a
                                    href={href}
                                    download={file?.filename ?? true}
                                    className="inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-xs no-underline"
                                >
                                    <Paperclip className="h-3 w-3" />
                                    {children}
                                    {file && <span className="text-muted-foreground">{formatBytes(file.size)}</span>}
                                </a>
                            );
                        }
                        return <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>;
                    },
                }}
            >
                {content}
            </ReactMarkdown>
        </div>
    );
}

function hrefToRef(projectId: string, href: string): string | null {
    const prefix = attachmentUrl(projectId, "");
    return href.startsWith(prefix) ? `attachment:${href.slice(prefix.length)}` : null;
}

/** Thumbnail in the thread; click opens the full-size snip in a lightbox. */
function CommentImage({ src, alt }: { src: string; alt: string }) {
    const [open, setOpen] = useState(false);
    return (
        <>
            <button
                type="button"
                className="block cursor-zoom-in"
                onClick={(event) => {
                    event.stopPropagation();
                    setOpen(true);
                }}
                aria-label={alt ? `Open image ${alt}` : "Open image"}
            >
                <img src={src} alt={alt} loading="lazy" />
            </button>
            {open && <Lightbox src={src} alt={alt} onClose={() => setOpen(false)} />}
        </>
    );
}

function Lightbox({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
    const dialog = useRef<HTMLDialogElement>(null);
    // A modal <dialog> traps focus and closes on Escape; it has to be opened
    // imperatively to get that behaviour rather than a plain open element.
    // No close() on cleanup: it fires `close`, which would call onClose and,
    // under StrictMode's remount, dismiss the lightbox as it opens. Unmounting
    // the element ends the modal state on its own.
    useEffect(() => {
        const element = dialog.current;
        if (element && !element.open) element.showModal?.();
    }, []);
    // Portalled: Markdown images sit inside <p>, where a <dialog> may not.
    return createPortal(
        <dialog
            ref={dialog}
            aria-label={alt || "Image"}
            onClose={onClose}
            className="m-0 h-full max-h-none w-full max-w-none bg-transparent p-0 backdrop:bg-black/80"
        >
            <button
                type="button"
                aria-label="Close image"
                className="flex h-full w-full cursor-zoom-out items-center justify-center p-6"
                onClick={(event) => {
                    event.stopPropagation();
                    onClose();
                }}
            >
                <img src={src} alt={alt} className="max-h-full max-w-full rounded-md object-contain" />
            </button>
        </dialog>,
        document.body,
    );
}
