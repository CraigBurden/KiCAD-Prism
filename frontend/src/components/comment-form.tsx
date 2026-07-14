import * as React from "react";
import { useEffect, useState } from "react";
import { X, Send, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CommentContext, CommentLocation } from "@/types/comments";

interface CommentFormProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (content: string) => void;
    location: CommentLocation | null;
    context: CommentContext;
    isSubmitting?: boolean;
}

/**
 * Modal dialog for adding a new design review comment.
 * Cmd/Ctrl+Enter submits; Escape closes.
 */
export function CommentForm({
    isOpen,
    onClose,
    onSubmit,
    location,
    context,
    isSubmitting = false,
}: CommentFormProps) {
    const [content, setContent] = useState("");

    useEffect(() => {
        if (isOpen) setContent("");
    }, [isOpen, location?.x, location?.y]);

    if (!isOpen || !location) return null;

    const handleSubmit = (e?: React.FormEvent) => {
        e?.preventDefault();
        if (content.trim()) {
            onSubmit(content.trim());
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Escape") {
            e.preventDefault();
            onClose();
            return;
        }
        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            handleSubmit();
        }
    };

    return (
        <div
            className="fixed inset-0 z-[120] flex items-center justify-center"
            onClick={onClose}
        >
            <div className="absolute inset-0 bg-black/50" />

            <div
                className="relative bg-background border rounded-lg shadow-xl w-full max-w-md mx-4"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between p-4 border-b">
                    <h2 className="text-lg font-semibold">Add Comment</h2>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onClose}
                        className="h-8 w-8"
                        aria-label="Close comment form"
                    >
                        <X className="h-4 w-4" />
                    </Button>
                </div>

                <div className="px-4 py-3 bg-muted/50 border-b">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
                        <MapPin className="h-4 w-4 shrink-0" />
                        <span>
                            {context} · ({location.x.toFixed(2)}, {location.y.toFixed(2)}) mm
                        </span>
                        {location.bounds && (
                            <span className="px-2 py-0.5 bg-background rounded text-xs">
                                Area {location.bounds[2].toFixed(1)}×{location.bounds[3].toFixed(1)} mm
                            </span>
                        )}
                        {location.layer && (
                            <span className="px-2 py-0.5 bg-background rounded text-xs">
                                {location.layer}
                            </span>
                        )}
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="p-4">
                    <textarea
                        autoFocus
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Describe the issue or leave a note..."
                        className="w-full h-32 p-3 border rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-ring text-foreground bg-background"
                        disabled={isSubmitting}
                    />

                    <div className="flex items-center justify-between mt-4">
                        <span className="text-xs text-muted-foreground">
                            ⌘/Ctrl + Enter to submit
                        </span>
                        <div className="flex gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={onClose}
                                disabled={isSubmitting}
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                disabled={!content.trim() || isSubmitting}
                            >
                                {isSubmitting ? (
                                    "Posting..."
                                ) : (
                                    <>
                                        <Send className="h-4 w-4 mr-2" />
                                        Post Comment
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
}
