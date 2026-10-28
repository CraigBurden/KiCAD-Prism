import type { Comment, CommentAttachment } from "@/types/comments";
import { attachmentUrl } from "./attachments";

export interface GallerySnip {
    attachment: CommentAttachment;
    thread: Comment;
    author: string;
    timestamp: string;
}

/** Every image in the review, oldest first, once each, with the thread that first posted it. */
export function collectSnips(comments: Comment[]): GallerySnip[] {
    const seen = new Set<string>();
    const snips: GallerySnip[] = [];
    for (const thread of comments) {
        for (const message of [thread, ...thread.replies]) {
            for (const attachment of message.attachments ?? []) {
                if (!attachment.mediaType.startsWith("image/") || seen.has(attachment.id)) continue;
                seen.add(attachment.id);
                snips.push({ attachment, thread, author: message.author, timestamp: message.timestamp });
            }
        }
    }
    return snips.sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
}

/** A grid of the review's snips; choosing one opens its thread. */
export function SnipGallery({
    projectId, comments, onOpenThread,
}: { projectId: string; comments: Comment[]; onOpenThread: (thread: Comment) => void }) {
    const snips = collectSnips(comments);
    if (!snips.length) {
        return (
            <p className="py-8 text-center text-sm text-muted-foreground">
                No snips yet. Paste an image into a comment to attach one.
            </p>
        );
    }
    return (
        <ul className="grid grid-cols-2 gap-2" aria-label="Snips in this review">
            {snips.map(({ attachment, thread, author }) => (
                <li key={attachment.id}>
                    <button
                        type="button"
                        onClick={() => onOpenThread(thread)}
                        className="group block w-full overflow-hidden rounded-md border bg-muted/30 text-left hover:ring-2 hover:ring-primary"
                        title={`${attachment.filename} · ${author}${thread.elementRef ? ` · ${thread.elementRef}` : ""}`}
                    >
                        <img
                            src={attachmentUrl(projectId, attachment.id)}
                            alt={attachment.filename}
                            loading="lazy"
                            className="aspect-[4/3] w-full bg-background object-contain"
                        />
                        <span className="block truncate px-1.5 py-1 text-[10px] text-muted-foreground">
                            {thread.elementRef || author}
                        </span>
                    </button>
                </li>
            ))}
        </ul>
    );
}
