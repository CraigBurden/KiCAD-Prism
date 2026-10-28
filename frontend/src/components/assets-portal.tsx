import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, File, FileText, Package, Image as ImageIcon, Folder, ChevronRight, ChevronDown, Eye, CircuitBoard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { FileItem, TreeNode, formatBytes, buildFileTree, calculateTotalSize } from "@/lib/file-utils";
import { fetchApi } from "@/lib/api";
import { FabricationDialog } from "@/components/fabrication-viewer/fabrication-dialog";
import { holdsLayers, isLayerName, outputsSource, type OutputType } from "@/components/fabrication-viewer/sources";

interface FabricationTarget {
    type: OutputType;
    /** Folder inside the output folder; its direct Gerber and drill files are shown. */
    folder: string;
    /** Open on this file's layer. */
    focusFile?: string;
}

const dirname = (path: string) => path.split("/").slice(0, -1).join("/");

const OUTPUTS_LABEL: Record<OutputType, string> = {
    design: "Design Outputs",
    manufacturing: "Manufacturing Outputs",
};

/** Opens a whole output folder as one package: Gerbers, drills, positions and BOM in their own folders. */
function OutputsViewerButton({ label, onOpen }: { label: string; onOpen: () => void }) {
    return (
        <Button
            size="sm"
            variant="ghost"
            onClick={onOpen}
            className="h-7 flex-shrink-0"
            title="Open in the Gerber viewer"
            aria-label={`Open ${label} in the Gerber viewer`}
        >
            <CircuitBoard className="h-4 w-4" />
        </Button>
    );
}

interface AssetsPortalProps {
    projectId: string;
    commit?: string | null;
}

function getFileIcon(type: string, isDir: boolean) {
    if (isDir) return Folder;

    switch (type.toLowerCase()) {
        case 'pdf':
            return FileText;
        case 'zip':
        case 'rar':
        case '7z':
            return Package;
        case 'png':
        case 'jpg':
        case 'jpeg':
        case 'webp':
            return ImageIcon;
        default:
            return File;
    }
}

function TreeNodeComponent({
    node,
    type,
    projectId,
    onDownload,
    onPreview,
    onViewFabrication,
    level = 0
}: {
    node: TreeNode;
    type: string;
    projectId: string;
    onDownload: (path: string, type: string) => void;
    onPreview: (path: string, type: string) => void;
    onViewFabrication: (folder: string, focusFile?: string) => void;
    level?: number;
}) {
    const [expanded, setExpanded] = useState(false);
    const Icon = getFileIcon(node.type, node.isDir);
    const hasChildren = node.children.length > 0;
    const isPdf = node.type.toLowerCase() === 'pdf';
    const isLayer = !node.isDir && isLayerName(node.name);
    const opensAsPackage = node.isDir && holdsLayers(node.children);

    return (
        <div>
            <div
                className="flex items-center gap-2 p-2 rounded-md hover:bg-muted/50 transition-colors"
                style={{ paddingLeft: `${level * 1.5 + 0.5}rem` }}
            >
                {node.isDir && hasChildren && (
                    <button
                        onClick={() => setExpanded(!expanded)}
                        className="p-0 hover:bg-transparent"
                        aria-label={`${expanded ? 'Collapse' : 'Expand'} ${node.name}`}
                    >
                        {expanded ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                    </button>
                )}
                {node.isDir && !hasChildren && <div className="w-4" />}

                <Icon className={`h-4 w-4 ${node.isDir ? 'text-warning' : 'text-primary'} flex-shrink-0`} />

                <div className="flex-1 min-w-0 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{node.name}</p>
                        {!node.isDir && (
                            <p className="text-xs text-muted-foreground">
                                {formatBytes(node.size)}
                            </p>
                        )}
                    </div>

                    {opensAsPackage && (
                        <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => onViewFabrication(node.path)}
                            className="flex-shrink-0"
                            title="Open Gerbers in the viewer"
                            aria-label={`Open ${node.name} in the Gerber viewer`}
                        >
                            <CircuitBoard className="h-4 w-4" />
                        </Button>
                    )}

                    {!node.isDir && (
                        <div className="flex items-center gap-1">
                            {isLayer && (
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => onViewFabrication(dirname(node.path), node.name)}
                                    className="flex-shrink-0"
                                    title="Open in the Gerber viewer"
                                    aria-label={`Open ${node.name} in the Gerber viewer`}
                                >
                                    <CircuitBoard className="h-4 w-4" />
                                </Button>
                            )}
                            {isPdf && (
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => onPreview(node.path, type)}
                                    className="flex-shrink-0"
                                    title="View PDF"
                                >
                                    <Eye className="h-4 w-4" />
                                </Button>
                            )}
                            <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => onDownload(node.path, type)}
                                className="flex-shrink-0"
                                title="Download"
                            >
                                <Download className="h-4 w-4" />
                            </Button>
                        </div>
                    )}
                </div>
            </div>

            {node.isDir && expanded && hasChildren && (
                <div>
                    {node.children.map((child) => (
                        <TreeNodeComponent
                            key={child.path}
                            node={child}
                            type={type}
                            projectId={projectId}
                            onDownload={onDownload}
                            onPreview={onPreview}
                            onViewFabrication={onViewFabrication}
                            level={level + 1}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

export function AssetsPortal({ projectId, commit }: AssetsPortalProps) {
    const [designFiles, setDesignFiles] = useState<FileItem[]>([]);
    const [mfgFiles, setMfgFiles] = useState<FileItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [viewing, setViewing] = useState<FabricationTarget | null>(null);

    const appendCommit = useCallback((url: string) => {
        if (!commit) return url;
        return `${url}${url.includes("?") ? "&" : "?"}commit=${encodeURIComponent(commit)}`;
    }, [commit]);

    // Fetches carry the AbortController signal and every setter is guarded by
    // `signal.aborted`; the rule cannot see those guards from outside.
    // react-doctor-disable-next-line react-doctor/no-set-state-after-await-in-effect
    useEffect(() => {
        const controller = new AbortController();
        const { signal } = controller;

        const fetchFiles = async () => {
            setLoading(true);
            try {
                const [designRes, mfgRes] = await Promise.all([
                    fetchApi(appendCommit(`/api/projects/${projectId}/files?type=design`), { signal }),
                    fetchApi(appendCommit(`/api/projects/${projectId}/files?type=manufacturing`), { signal })
                ]);

                if (signal.aborted) return;

                if (designRes.ok) {
                    const data = await designRes.json();
                    setDesignFiles(data);
                }
                if (mfgRes.ok) {
                    const data = await mfgRes.json();
                    setMfgFiles(data);
                }
            } catch (err) {
                if (err instanceof DOMException && err.name === "AbortError") return;
                console.error("Failed to fetch files", err);
            } finally {
                // The abort guard is required: an unconditional reset would let
                // the stale, aborted effect clear the replacement effect's spinner.
                // react-doctor-disable-next-line react-doctor/no-loading-flag-reset-outside-finally
                if (!signal.aborted) setLoading(false);
            }
        };

        void fetchFiles();
        return () => controller.abort();
    }, [projectId, appendCommit]);

    const handleDownload = (path: string, type: string) => {
        const url = appendCommit(`/api/projects/${projectId}/download?path=${encodeURIComponent(path)}&type=${type}`);
        window.open(url, '_blank', 'noopener,noreferrer');
    };

    const handlePreview = (path: string, type: string) => {
        // Open in new tab with inline=true to force browser display
        const url = appendCommit(`/api/projects/${projectId}/download?path=${encodeURIComponent(path)}&type=${type}&inline=true`);
        window.open(url, '_blank', 'noopener,noreferrer');
    };

    const designTree = useMemo(() => buildFileTree(designFiles), [designFiles]);
    const mfgTree = useMemo(() => buildFileTree(mfgFiles), [mfgFiles]);
    const designHasLayers = useMemo(() => holdsLayers(designTree), [designTree]);
    const mfgHasLayers = useMemo(() => holdsLayers(mfgTree), [mfgTree]);
    const designTotalSize = useMemo(() => calculateTotalSize(designFiles), [designFiles]);
    const mfgTotalSize = useMemo(() => calculateTotalSize(mfgFiles), [mfgFiles]);

    if (loading) {
        return (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {[1, 2].map((i) => (
                    <div key={i} className="space-y-4">
                        <Skeleton className="h-8 w-48" />
                        <Skeleton className="h-64 w-full" />
                    </div>
                ))}
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Design Outputs */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Design Outputs</h3>
                    <div className="flex items-center gap-2">
                        {designHasLayers && (
                            <OutputsViewerButton label="Design Outputs" onOpen={() => setViewing({ type: "design", folder: "" })} />
                        )}
                        <span className="text-xs text-muted-foreground">
                            {formatBytes(designTotalSize)} total
                        </span>
                    </div>
                </div>
                <div className="border rounded-lg p-4 max-h-[600px] overflow-y-auto">
                    {designFiles.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-8">No files found</p>
                    ) : (
                        <div className="space-y-1">
                            {designTree.map((node) => (
                                <TreeNodeComponent
                                    key={node.path}
                                    node={node}
                                    type="design"
                                    projectId={projectId}
                                    onDownload={handleDownload}
                                    onPreview={handlePreview}
                                    onViewFabrication={(folder, focusFile) => setViewing({ type: "design", folder, focusFile })}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Manufacturing Outputs */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Manufacturing Outputs</h3>
                    <div className="flex items-center gap-2">
                        {mfgHasLayers && (
                            <OutputsViewerButton label="Manufacturing Outputs" onOpen={() => setViewing({ type: "manufacturing", folder: "" })} />
                        )}
                        <span className="text-xs text-muted-foreground">
                            {formatBytes(mfgTotalSize)} total
                        </span>
                    </div>
                </div>
                <div className="border rounded-lg p-4 max-h-[600px] overflow-y-auto">
                    {mfgFiles.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-8">No files found</p>
                    ) : (
                        <div className="space-y-1">
                            {mfgTree.map((node) => (
                                <TreeNodeComponent
                                    key={node.path}
                                    node={node}
                                    type="manufacturing"
                                    projectId={projectId}
                                    onDownload={handleDownload}
                                    onPreview={handlePreview}
                                    onViewFabrication={(folder, focusFile) => setViewing({ type: "manufacturing", folder, focusFile })}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {viewing && (
                <FabricationDialog
                    source={outputsSource(projectId, viewing.type, viewing.folder, commit)}
                    focusFile={viewing.focusFile}
                    title={viewing.folder || OUTPUTS_LABEL[viewing.type]}
                    onClose={() => setViewing(null)}
                />
            )}
        </div>
    );
}
