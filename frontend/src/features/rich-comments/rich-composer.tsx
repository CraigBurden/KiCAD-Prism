import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import type { EditorView } from "@tiptap/pm/view";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Paragraph from "@tiptap/extension-paragraph";
import { Placeholder } from "@tiptap/extensions";
import { Markdown } from "@tiptap/markdown";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { MentionCandidate } from "@/types/comments";
import { ATTACHMENT_SCHEME, attachmentRefFromUrl, resolveAttachmentRef } from "./attachments";
import { ComposerToolbar, MentionList } from "./composer-controls";
import { uploadIntoEditor } from "./composer-uploads";

export interface RichComposerHandle {
    clear: () => void;
    focus: () => void;
    /** Append Markdown (a quote) at the end and put the caret after it. */
    insertMarkdown: (markdown: string) => void;
}

export interface RichComposerState {
    /** Canonical Markdown, trimmed; empty when there is nothing to post. */
    markdown: string;
    /** True while a pasted or attached file is still uploading. */
    uploading: boolean;
}

interface RichComposerProps {
    projectId: string;
    onChange: (state: RichComposerState) => void;
    /** ⌘/Ctrl+Enter. */
    onSubmit?: () => void;
    /** Escape, when no mention list is open. */
    onCancel?: () => void;
    placeholder?: string;
    mentionCandidates?: MentionCandidate[];
    disabled?: boolean;
    autoFocus?: boolean;
    ariaLabel: string;
    /** Markdown the editor opens with: an edit, or a reply seeded with a quote. */
    initialMarkdown?: string;
    /** Minimum editable height, as a Tailwind class. */
    minHeightClassName?: string;
    className?: string;
}

const MENTION_BEFORE_CURSOR = /@([A-Za-z0-9._%+\-@]*)$/;
const NO_CANDIDATES: MentionCandidate[] = [];

/** Emails mentioned as `@email` that belong to a known project member. */
export function extractMentions(markdown: string, candidates: MentionCandidate[]): string[] {
    const known = new Set(candidates.map((c) => c.email.toLowerCase()));
    // The serializer escapes Markdown punctuation such as `_`; mentions are text.
    // The editor autolinks an address, so `@a@b.c` may arrive as `@[a@b.c](mailto:a@b.c)`.
    const text = markdown
        .replace(/\\([\\`*_{}[\]()#+\-.!])/g, "$1")
        .replace(/\[([^\]]*)\]\(mailto:[^)]*\)/g, "$1");
    const found = new Set<string>();
    for (const token of text.match(/@([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/g) ?? []) {
        const email = token.slice(1).toLowerCase();
        if (known.has(email)) found.add(email);
    }
    return [...found];
}

/**
 * Images live in the document as `attachment:<id>` so the Markdown never holds
 * a host URL; only the rendered DOM points at Prism's authenticated route.
 * Pasted HTML may carry an image from anywhere -- only Prism's own
 * attachments survive the parse, everything else is dropped rather than
 * hot-linked.
 */
function commentImageExtension(projectId: string) {
    const toRef = (src: string | null) => {
        if (!src) return null;
        if (src.startsWith(ATTACHMENT_SCHEME)) return resolveAttachmentRef(projectId, src) ? src : null;
        return attachmentRefFromUrl(projectId, src);
    };
    return Image.extend({
        addAttributes() {
            return {
                ...this.parent?.(),
                src: {
                    default: null,
                    parseHTML: (element: HTMLElement) => toRef(element.getAttribute("src")),
                    renderHTML: (attributes: { src?: string | null }) => {
                        const src = attributes.src ?? "";
                        return { src: src.startsWith("blob:") ? src : resolveAttachmentRef(projectId, src) ?? "" };
                    },
                },
                uploadId: {
                    default: null,
                    parseHTML: () => null,
                    renderHTML: (attributes: { uploadId?: string | null }) =>
                        attributes.uploadId ? { "data-uploading": "" } : {},
                },
            };
        },
        parseHTML() {
            return [{ tag: "img[src]", getAttrs: (element) => (toRef(element.getAttribute("src")) ? null : false) }];
        },
    }).configure({ inline: false, allowBase64: false });
}

/**
 * A paragraph whose text begins like a block (`- x`, `1. x`, `> x`, `# x`)
 * must stay a paragraph once serialized, or the thread would render a list
 * the author never saw in the composer.
 */
const BLOCK_START = /^( {0,3})([-+*>#]|\d{1,9}[.)])(?=\s|$)/;
const renderParagraph = Paragraph.config.renderMarkdown;
const CommentParagraph = Paragraph.extend({
    renderMarkdown(node, helpers, context) {
        const rendered = String(renderParagraph?.(node, helpers, context) ?? "");
        return rendered.replace(BLOCK_START, (_match, indent: string, marker: string) =>
            /^\d/.test(marker) ? `${indent}${marker.slice(0, -1)}\\${marker.slice(-1)}` : `${indent}\\${marker}`);
    },
});

/** ProseMirror props are bound once; Tiptap hangs its editor off the view's DOM. */
function editorOf(view: EditorView): Editor | undefined {
    return (view.dom as HTMLElement & { editor?: Editor }).editor;
}

/**
 * The review composer: WYSIWYG formatting, Ctrl/⌘+V or drop to attach, and
 * `@` mentions. It emits Markdown with `attachment:` references; the parent
 * owns submission and the buttons around it.
 */
export const RichComposer = forwardRef<RichComposerHandle, RichComposerProps>(function RichComposer(
    {
        projectId,
        onChange,
        onSubmit,
        onCancel,
        placeholder = "Write a comment…",
        mentionCandidates = NO_CANDIDATES,
        disabled = false,
        autoFocus = false,
        ariaLabel,
        initialMarkdown,
        minHeightClassName = "min-h-24",
        className,
    },
    ref,
) {
    const [mentionQuery, setMentionQuery] = useState<string | null>(null);
    const [mentionIndex, setMentionIndex] = useState(0);
    const [pendingFiles, setPendingFiles] = useState<string[]>([]);
    const uploads = useRef(0);

    const mentionMatches = useMemo(() => {
        if (mentionQuery === null) return [];
        const q = mentionQuery.toLowerCase();
        return mentionCandidates
            .filter((candidate) => {
                const email = candidate.email.toLowerCase();
                return !q || email.includes(q) || email.split("@")[0]?.includes(q);
            })
            .slice(0, 8);
    }, [mentionCandidates, mentionQuery]);

    // Editor callbacks outlive renders; they read the latest props from here.
    const latest = useRef({ onChange, onSubmit, onCancel, mentionQuery, mentionIndex, mentionMatches });
    useLayoutEffect(() => {
        latest.current = { onChange, onSubmit, onCancel, mentionQuery, mentionIndex, mentionMatches };
    });

    const emit = (editor: Editor) => {
        latest.current.onChange({
            markdown: editor.isEmpty ? "" : editor.getMarkdown().trim(),
            uploading: uploads.current > 0,
        });
    };

    const refreshMention = (editor: Editor) => {
        const { $from, empty } = editor.state.selection;
        const before = empty ? $from.parent.textBetween(0, $from.parentOffset, undefined, "￼") : "";
        const match = MENTION_BEFORE_CURSOR.exec(before);
        setMentionQuery(match ? match[1] ?? "" : null);
        if (!match) setMentionIndex(0);
    };

    const insertMention = (editor: Editor, email: string) => {
        const { from } = editor.state.selection;
        const query = latest.current.mentionQuery ?? "";
        editor.chain().focus().deleteRange({ from: from - query.length - 1, to: from })
            .insertContent(`@${email} `).run();
        setMentionQuery(null);
    };

    const attachFiles = (editor: Editor, files: File[], at?: number) => {
        for (const file of files) {
            const isImage = file.type.startsWith("image/");
            uploads.current += 1;
            if (!isImage) setPendingFiles((names) => [...names, file.name]);
            emit(editor);
            uploadIntoEditor(editor, projectId, file, at)
                .catch((error: unknown) => {
                    toast.error(error instanceof Error ? error.message : `Could not attach ${file.name}`);
                })
                .finally(() => {
                    uploads.current -= 1;
                    if (!isImage) {
                        setPendingFiles((names) => {
                            const index = names.indexOf(file.name);
                            return index < 0 ? names : [...names.slice(0, index), ...names.slice(index + 1)];
                        });
                    }
                    if (!editor.isDestroyed) emit(editor);
                });
        }
    };

    const handleKeyDown = (view: EditorView, event: KeyboardEvent): boolean => {
        const { mentionQuery: query, mentionMatches: matches, mentionIndex: index } = latest.current;
        const editor = editorOf(view);
        if (query !== null && matches.length > 0 && editor) {
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                const step = event.key === "ArrowDown" ? 1 : -1;
                setMentionIndex((i) => (i + step + matches.length) % matches.length);
                return true;
            }
            if (event.key === "Enter" || event.key === "Tab") {
                insertMention(editor, (matches[index] ?? matches[0]!).email);
                return true;
            }
            if (event.key === "Escape") {
                setMentionQuery(null);
                return true;
            }
        }
        if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
            latest.current.onSubmit?.();
            return true;
        }
        if (event.key === "Escape" && latest.current.onCancel) {
            latest.current.onCancel();
            return true;
        }
        return false;
    };

    const editor = useEditor({
        editable: !disabled,
        autofocus: autoFocus ? "end" : false,
        content: initialMarkdown ?? "",
        contentType: "markdown",
        extensions: [
            StarterKit.configure({
                paragraph: false,
                heading: false,
                underline: false,
                horizontalRule: false,
                link: {
                    openOnClick: false,
                    autolink: true,
                    isAllowedUri: (url, ctx) => url.startsWith(ATTACHMENT_SCHEME) || ctx.defaultValidate(url),
                },
            }),
            CommentParagraph,
            commentImageExtension(projectId),
            Placeholder.configure({ placeholder }),
            Markdown,
        ],
        editorProps: {
            attributes: { "aria-label": ariaLabel, role: "textbox", "aria-multiline": "true" },
            handleKeyDown,
            handlePaste: (view, event) => {
                const files = Array.from(event.clipboardData?.files ?? []);
                const current = editorOf(view);
                if (!files.length || !current) return false;
                event.preventDefault();
                attachFiles(current, files);
                return true;
            },
            handleDrop: (view, event, _slice, moved) => {
                const files = Array.from(event.dataTransfer?.files ?? []);
                const current = editorOf(view);
                if (moved || !files.length || !current) return false;
                event.preventDefault();
                attachFiles(current, files, view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos);
                return true;
            },
        },
        // A seeded editor is postable as it opens, before any keystroke.
        onCreate: ({ editor: current }) => {
            if (!current.isEmpty) emit(current);
        },
        onUpdate: ({ editor: current }) => {
            emit(current);
            refreshMention(current);
        },
        onSelectionUpdate: ({ editor: current }) => refreshMention(current),
    }, [projectId]);

    // The editor instance outlives prop changes; editability is imperative.
    useEffect(() => {
        if (editor && !editor.isDestroyed) editor.setEditable(!disabled);
    }, [editor, disabled]);

    useImperativeHandle(ref, () => ({
        clear: () => {
            editor?.commands.clearContent(true);
            setMentionQuery(null);
        },
        focus: () => editor?.commands.focus("end"),
        insertMarkdown: (markdown: string) => {
            if (!editor || editor.isDestroyed) return;
            editor.chain().focus("end").insertContent(markdown, { contentType: "markdown" }).focus("end").run();
        },
    }), [editor]);

    return (
        <div
            className={cn(
                "relative rounded-md border bg-background text-foreground focus-within:ring-2 focus-within:ring-ring",
                disabled && "opacity-60",
                className,
            )}
        >
            <ComposerToolbar
                editor={editor}
                disabled={disabled}
                onAttach={(files) => editor && attachFiles(editor, files)}
            />
            <EditorContent
                editor={editor}
                className={cn("rich-comment max-h-80 overflow-y-auto px-2.5 py-2", minHeightClassName)}
            />
            {pendingFiles.length > 0 && (
                <div className="border-t px-2 py-1 text-[11px] text-muted-foreground" aria-live="polite">
                    Uploading {pendingFiles.join(", ")}…
                </div>
            )}
            {mentionQuery !== null && mentionMatches.length > 0 && (
                <MentionList
                    matches={mentionMatches}
                    activeIndex={mentionIndex}
                    onPick={(email) => editor && insertMention(editor, email)}
                />
            )}
        </div>
    );
});
