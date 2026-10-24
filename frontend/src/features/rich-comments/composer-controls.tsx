import { useRef, useState } from "react";
import { useEditorState, type Editor } from "@tiptap/react";
import {
    Bold,
    Code,
    Italic,
    Link2,
    List,
    ListOrdered,
    Paperclip,
    Quote,
    SquareCode,
    Strikethrough,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { MentionCandidate } from "@/types/comments";

const ATTACH_ACCEPT =
    "image/png,image/jpeg,image/webp,image/gif,application/pdf,application/zip,.txt,.csv,.md,.log";

type ToolKey =
    | "bold" | "italic" | "strike" | "code" | "bulletList" | "orderedList" | "blockquote" | "codeBlock" | "link";

const TOOLS: Array<{ key: ToolKey; label: string; icon: typeof Bold; run: (editor: Editor) => void }> = [
    { key: "bold", label: "Bold", icon: Bold, run: (e) => e.chain().focus().toggleBold().run() },
    { key: "italic", label: "Italic", icon: Italic, run: (e) => e.chain().focus().toggleItalic().run() },
    { key: "strike", label: "Strikethrough", icon: Strikethrough, run: (e) => e.chain().focus().toggleStrike().run() },
    { key: "code", label: "Inline code", icon: Code, run: (e) => e.chain().focus().toggleCode().run() },
    { key: "bulletList", label: "Bulleted list", icon: List, run: (e) => e.chain().focus().toggleBulletList().run() },
    { key: "orderedList", label: "Numbered list", icon: ListOrdered, run: (e) => e.chain().focus().toggleOrderedList().run() },
    { key: "blockquote", label: "Quote", icon: Quote, run: (e) => e.chain().focus().toggleBlockquote().run() },
    { key: "codeBlock", label: "Code block", icon: SquareCode, run: (e) => e.chain().focus().toggleCodeBlock().run() },
];

export function ComposerToolbar({
    editor,
    disabled,
    onAttach,
}: {
    editor: Editor | null;
    disabled: boolean;
    onAttach: (files: File[]) => void;
}) {
    const fileInput = useRef<HTMLInputElement>(null);
    const [linkDraft, setLinkDraft] = useState<string | null>(null);
    const active = useEditorState({
        editor,
        selector: ({ editor: current }) => Object.fromEntries(
            [...TOOLS.map((tool) => tool.key), "link"].map((key) => [key, current?.isActive(key) ?? false]),
        ) as Record<ToolKey, boolean>,
    });

    const applyLink = () => {
        if (!editor || linkDraft === null) return;
        const href = linkDraft.trim();
        const chain = editor.chain().focus().extendMarkRange("link");
        if (!href) chain.unsetLink().run();
        else chain.setLink({ href: /^[a-z]+:/i.test(href) ? href : `https://${href}` }).run();
        setLinkDraft(null);
    };

    const button = (key: ToolKey, label: string, Icon: typeof Bold, run: () => void) => (
        <button
            key={key}
            type="button"
            title={label}
            aria-label={label}
            aria-pressed={active?.[key] ?? false}
            disabled={disabled || !editor}
            onMouseDown={(event) => event.preventDefault()}
            onClick={run}
            className={cn(
                "rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground",
                active?.[key] && "bg-muted text-foreground",
            )}
        >
            <Icon className="h-3.5 w-3.5" />
        </button>
    );

    return (
        <>
            <div className="flex flex-wrap items-center gap-0.5 border-b px-1 py-0.5" role="toolbar" aria-label="Formatting">
                {TOOLS.map(({ key, label, icon, run }) => button(key, label, icon, () => editor && run(editor)))}
                {button("link", "Link", Link2, () => setLinkDraft(editor?.getAttributes("link").href ?? ""))}
                <button
                    type="button"
                    title="Attach files"
                    aria-label="Attach files"
                    disabled={disabled}
                    onClick={() => fileInput.current?.click()}
                    className="ml-auto rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                    <Paperclip className="h-3.5 w-3.5" />
                </button>
                <input
                    ref={fileInput}
                    type="file"
                    multiple
                    hidden
                    accept={ATTACH_ACCEPT}
                    onChange={(event) => {
                        const files = Array.from(event.target.files ?? []);
                        event.target.value = "";
                        if (files.length) onAttach(files);
                    }}
                />
            </div>
            {linkDraft !== null && (
                <div className="flex items-center gap-1 border-b px-2 py-1">
                    <input
                        // react-doctor-disable-next-line no-autofocus - opened by an explicit toolbar click
                        autoFocus
                        aria-label="Link URL"
                        value={linkDraft}
                        placeholder="https://…"
                        onChange={(event) => setLinkDraft(event.target.value)}
                        onKeyDown={(event) => {
                            if (event.key === "Enter") {
                                event.preventDefault();
                                applyLink();
                            } else if (event.key === "Escape") {
                                event.preventDefault();
                                setLinkDraft(null);
                                editor?.commands.focus();
                            }
                        }}
                        className="h-6 flex-1 rounded border bg-background px-1.5 text-xs"
                    />
                    <button type="button" className="px-1 text-xs text-primary" onClick={applyLink}>Apply</button>
                </div>
            )}
        </>
    );
}

export function MentionList({
    matches,
    activeIndex,
    onPick,
}: {
    matches: MentionCandidate[];
    activeIndex: number;
    onPick: (email: string) => void;
}) {
    return (
        <div
            className="absolute left-0 right-0 top-full z-20 mt-1 max-h-40 overflow-auto rounded-md border bg-popover shadow-md"
            role="listbox"
            aria-label="Mention suggestions"
        >
            {matches.map((candidate, index) => (
                <button
                    key={candidate.email}
                    type="button"
                    role="option"
                    aria-selected={index === activeIndex}
                    className={cn(
                        "flex w-full items-center justify-between px-3 py-2 text-left text-sm",
                        index === activeIndex ? "bg-accent text-accent-foreground" : "hover:bg-muted",
                    )}
                    onMouseDown={(event) => {
                        event.preventDefault();
                        onPick(candidate.email);
                    }}
                >
                    <span className="truncate">{candidate.email}</span>
                    <span className="ml-2 text-[10px] uppercase text-muted-foreground">{candidate.role}</span>
                </button>
            ))}
        </div>
    );
}
