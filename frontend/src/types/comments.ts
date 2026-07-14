/**
 * Comment Types for KiCAD-Prism Collaboration Feature
 *
 * These types match the PostgreSQL-backed comments API and optional
 * .comments/comments.json export artifact.
 */

export type CommentStatus = "OPEN" | "RESOLVED";

export type CommentContext = "PCB" | "SCH";

export interface CommentLocation {
    /** X coordinate in board/schematic units (mm) */
    x: number;
    /** Y coordinate in board/schematic units (mm) */
    y: number;
    /** Layer name (e.g., "F.Cu", "B.Cu") */
    layer: string;
    /** Schematic page identifier (filename or path) */
    page?: string;
    /** Optional area bounds [x, y, w, h] for rectangle comments */
    bounds?: [number, number, number, number];
}

export interface CommentReply {
    author: string;
    timestamp: string;
    content: string;
}

export interface Comment {
    id: string;
    author: string;
    timestamp: string;
    status: CommentStatus;
    context: CommentContext;
    location: CommentLocation;
    content: string;
    replies: CommentReply[];
    elementRef?: string;
    elementType?: string;
    elementId?: string;
}

export interface CommentsMeta {
    version: string;
    generator: string;
}

export interface CommentsFile {
    meta: CommentsMeta;
    comments: Comment[];
}

export interface CreateCommentRequest {
    context: CommentContext;
    location: CommentLocation;
    content: string;
    author?: string;
    elementId?: string;
    elementRef?: string;
    elementType?: string;
}

export interface CreateReplyRequest {
    content: string;
    author?: string;
}

export interface UpdateCommentRequest {
    status?: CommentStatus;
}
