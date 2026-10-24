import { useCallback, useMemo, useRef, useState } from "react";
import {
  AlertTriangle, ArrowDownToLine, Check, CheckCheck, Combine, Download, Loader2, Redo2, Save,
  Rows3, Undo2, Upload,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { bulkAcceptProposals, importProposalsCsv, importProposalsCsvUrl, saveProposalDrafts } from "./catalog-client";
import {
  blockingImportFindings, customImportProblems, importMetadataProblems, isFieldRequired, isImportFieldRequired,
} from "@/lib/catalog-field-rules";
import { PermissionHint } from "@/components/ui/permission-hint";
import { cn } from "@/lib/utils";
import type {
  CatalogMetadataField, ImportMetadataOverrides, ImportProposalDraft, ProjectComponentImportProposal,
} from "@/types/catalog";
import { LibraryAssetLinkPicker } from "./library-asset-link-picker";
import { acceptExtraFields, scannedExtraFields } from "./library-import-custom-fields";
import { useStagedGridEdits } from "./use-staged-grid-edits";

interface LibraryImportRemediationGridProps {
  sessionId: string;
  proposals: ProjectComponentImportProposal[];
  /** Active custom metadata fields; each gets an editable column (D43). */
  customFields?: readonly CatalogMetadataField[];
  canWrite: boolean;
  onShowDetailView: () => void;
  onRefresh: () => Promise<void> | void;
}

type EditableField =
  | "value"
  | "manufacturer"
  | "manufacturer_part_number"
  | "description"
  | "datasheet"
  | "package_name";

interface ColumnDef {
  key: EditableField;
  label: string;
  width: number;
}

/** A grid column: a remediable built-in field, or a custom field (keyed by its storage key). */
type GridColumn =
  | (ColumnDef & { kind: "builtin"; required: boolean })
  | { kind: "custom"; key: string; label: string; width: number; required: boolean };

// Which of these are required, and what a valid datasheet is, comes from the
// catalog field rules; the server applies the same rules when accepting.
const COLUMNS: ColumnDef[] = [
  { key: "value", label: "Value", width: 130 },
  { key: "manufacturer", label: "Manufacturer", width: 150 },
  { key: "manufacturer_part_number", label: "MPN", width: 170 },
  { key: "description", label: "Description", width: 240 },
  { key: "datasheet", label: "Datasheet", width: 220 },
  { key: "package_name", label: "Package", width: 170 },
];

const BUILTIN_COLUMNS: GridColumn[] = COLUMNS.map((column) => ({
  ...column, kind: "builtin", required: isImportFieldRequired(column.key),
}));

const NO_CUSTOM_FIELDS: readonly CatalogMetadataField[] = [];

function gridColumns(customFields: readonly CatalogMetadataField[]): GridColumn[] {
  return [
    ...BUILTIN_COLUMNS,
    ...customFields.map((field): GridColumn => ({
      kind: "custom", key: field.storage_key, label: field.label || field.key, width: 160,
      required: isFieldRequired(field),
    })),
  ];
}

/** Local edits keyed by proposal id; `extraFields` holds edited custom values by storage key. */
export type RowEdits = Record<
  string,
  {
    metadata: Partial<Record<EditableField, string>>;
    extraFields?: Record<string, string>;
    footprintAssetId?: string;
  }
>;

function metadataValue(proposal: ProjectComponentImportProposal, field: EditableField): string {
  const source = proposal.metadata as Record<string, unknown>;
  if (field === "package_name") return String(source.footprint ?? "");
  return String(source[field] ?? "");
}

function draftOf(proposal: ProjectComponentImportProposal): ImportProposalDraft {
  return proposal.draft ?? {};
}

/** Effective value: local edit wins, then a saved draft, then the scanned metadata. */
function effectiveValue(
  proposal: ProjectComponentImportProposal,
  field: EditableField,
  edits: RowEdits
): string {
  const local = edits[proposal.id]?.metadata?.[field];
  if (local !== undefined) return local;
  const drafted = draftOf(proposal).metadata_overrides?.[field];
  if (drafted !== undefined) return drafted;
  return metadataValue(proposal, field);
}

/** Effective custom value: local edit wins, then a saved draft, then the symbol's own field. */
function effectiveExtraValue(
  proposal: ProjectComponentImportProposal,
  storageKey: string,
  edits: RowEdits
): string {
  const local = edits[proposal.id]?.extraFields?.[storageKey];
  if (local !== undefined) return local;
  const drafted = draftOf(proposal).metadata_overrides?.extra_fields?.[storageKey];
  if (drafted !== undefined) return drafted;
  return scannedExtraFields(proposal)[storageKey] ?? "";
}

/** Custom values edited locally or in a saved draft (local wins). */
function editedExtraFields(proposal: ProjectComponentImportProposal, edits: RowEdits): Record<string, string> {
  return { ...draftOf(proposal).metadata_overrides?.extra_fields, ...edits[proposal.id]?.extraFields };
}

function cellValue(proposal: ProjectComponentImportProposal, column: GridColumn, edits: RowEdits): string {
  return column.kind === "builtin"
    ? effectiveValue(proposal, column.key, edits)
    : effectiveExtraValue(proposal, column.key, edits);
}

function effectiveFootprintLink(
  proposal: ProjectComponentImportProposal,
  edits: RowEdits
): string {
  const local = edits[proposal.id]?.footprintAssetId;
  if (local !== undefined) return local;
  return draftOf(proposal).asset_links?.footprint ?? "";
}

function hasOwnAsset(proposal: ProjectComponentImportProposal, assetType: string): boolean {
  return proposal.assets.some((asset) => asset.asset_type === assetType);
}

/**
 * Identity a row will import as.
 *
 * Scan-time dedupe only merges by MPN when the KiCad symbol already carried
 * manufacturer and MPN fields. When those are supplied during remediation instead,
 * the proposals stay separate even though the backend will resolve them to a single
 * catalog component. Grouping here shows the reviewer what will actually be created
 * and means the same part is edited once rather than once per reference.
 */
export function groupKeyFor(proposal: ProjectComponentImportProposal, edits: RowEdits): string {
  const manufacturer = effectiveValue(proposal, "manufacturer", edits).trim().toLowerCase();
  const mpn = effectiveValue(proposal, "manufacturer_part_number", edits).trim().toLowerCase();
  if (manufacturer && mpn) return `mpn:${manufacturer}\u0000${mpn}`;
  return `id:${proposal.id}`;
}

export interface ProposalGroup {
  key: string;
  /** Values are read from this member; edits are written to every member. */
  representative: ProjectComponentImportProposal;
  members: ProjectComponentImportProposal[];
  references: string[];
}

export function groupProposals(
  proposals: ProjectComponentImportProposal[],
  edits: RowEdits,
  enabled: boolean
): ProposalGroup[] {
  const groups = new Map<string, ProjectComponentImportProposal[]>();
  for (const proposal of proposals) {
    const key = enabled ? groupKeyFor(proposal, edits) : `id:${proposal.id}`;
    const bucket = groups.get(key);
    if (bucket) bucket.push(proposal);
    else groups.set(key, [proposal]);
  }

  return [...groups.entries()].map(([key, members]) => {
    const references = new Set<string>();
    for (const member of members) {
      const declared = (member.metadata as { references?: unknown }).references;
      if (Array.isArray(declared) && declared.length > 0) {
        for (const reference of declared) {
          const text = String(reference || "").trim();
          if (text) references.add(text);
        }
      } else if (member.reference) {
        references.add(member.reference);
      }
    }
    return {
      key,
      representative: members[0],
      members,
      references: [...references].sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })
      ),
    };
  });
}

/** A grouped row stands for one component, so an edit applies to every member. */
function writeGroupCell(edits: RowEdits, group: ProposalGroup, column: GridColumn, value: string): RowEdits {
  const next = { ...edits };
  for (const member of group.members) {
    const current = next[member.id];
    next[member.id] = column.kind === "builtin"
      ? { ...current, metadata: { ...current?.metadata, [column.key]: value } }
      : { ...current, metadata: current?.metadata ?? {}, extraFields: { ...current?.extraFields, [column.key]: value } };
  }
  return next;
}

/** Every distinct problem across a group, since all its members get imported. */
export function groupProblems(
  group: ProposalGroup,
  edits: RowEdits,
  customFields: readonly CatalogMetadataField[] = NO_CUSTOM_FIELDS
): string[] {
  const problems = new Set<string>();
  for (const member of group.members) {
    for (const problem of rowProblems(member, edits, customFields)) problems.add(problem);
  }
  return [...problems];
}

export function rowProblems(
  proposal: ProjectComponentImportProposal,
  edits: RowEdits,
  customFields: readonly CatalogMetadataField[] = NO_CUSTOM_FIELDS
): string[] {
  const values = Object.fromEntries(
    COLUMNS.map((column) => [column.key, effectiveValue(proposal, column.key, edits)])
  );
  const extraValues = Object.fromEntries(
    customFields.map((field) => [field.storage_key, effectiveExtraValue(proposal, field.storage_key, edits)])
  );
  // The server's order: built-in readiness first, then custom required fields.
  const problems = [...importMetadataProblems(values), ...customImportProblems(customFields, extraValues)];

  // An "<asset_type>_not_resolved" finding means the extractor could not locate
  // that asset, which is precisely what linking an existing catalog asset
  // answers - so a supplied link clears it, here and when the server accepts.
  const footprintLink = effectiveFootprintLink(proposal, edits);
  const linkedAssetTypes = footprintLink ? ["footprint"] : [];

  if (!hasOwnAsset(proposal, "symbol")) problems.push("No symbol was extracted");
  if (!hasOwnAsset(proposal, "footprint") && !footprintLink) {
    problems.push("Link an existing footprint or re-import with one");
  }
  problems.push(
    ...blockingImportFindings(proposal.findings, linkedAssetTypes).map((finding) => finding.message)
  );
  return problems;
}

// react-doctor-disable-next-line no-giant-component - grouped grid with per-row edit state and bulk accept flow
export function LibraryImportRemediationGrid({
  sessionId,
  proposals,
  customFields = NO_CUSTOM_FIELDS,
  canWrite,
  onShowDetailView,
  onRefresh,
}: LibraryImportRemediationGridProps) {
  const columns = useMemo(() => gridColumns(customFields), [customFields]);
  // Every cell edit, fill-down, and link change is one undo step, so a
  // mis-aimed fill-down across 300 rows is one keystroke to undo. Undo, redo,
  // and save (mod+s) stay live while a cell is focused but stand down while a
  // dialog such as the command palette is open. `saveDrafts` is declared
  // below; the binding only calls it on a key press, after render.
  const {
    edits, canUndo, canRedo, commit: commitEdits, setCell: setGroupCell, fillDown: fillGroups,
    replace: replaceEdits, reset: resetHistory, undo, redo,
  } = useStagedGridEdits({
    writeCell: writeGroupCell,
    hotkeys: { enabled: canWrite, onSave: () => void saveDrafts() },
  });
  const [rawSelected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [filter, setFilter] = useState("");
  const [onlyProblems, setOnlyProblems] = useState(false);
  // One row per component that will be created, not one per placed reference.
  const [groupByMpn, setGroupByMpn] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const candidates = useMemo(
    () => proposals.filter((proposal) => proposal.status === "candidate"),
    [proposals]
  );

  const groups = useMemo(
    () => groupProposals(candidates, edits, groupByMpn),
    [candidates, edits, groupByMpn]
  );

  const problemsByGroup = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const group of groups) map.set(group.key, groupProblems(group, edits, customFields));
    return map;
  }, [customFields, edits, groups]);

  const visibleRows = useMemo(() => {
    const term = filter.trim().toLowerCase();
    return groups.filter((group) => {
      if (onlyProblems && (problemsByGroup.get(group.key)?.length ?? 0) === 0) return false;
      if (!term) return true;
      const haystack = [
        ...group.references,
        ...columns.map((column) => cellValue(group.representative, column, edits)),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [columns, edits, filter, groups, onlyProblems, problemsByGroup]);

  const readyRows = useMemo(
    () => groups.filter((group) => (problemsByGroup.get(group.key)?.length ?? 0) === 0),
    [groups, problemsByGroup]
  );

  const mergedGroupCount = useMemo(
    () => groups.filter((group) => group.members.length > 1).length,
    [groups]
  );

  const dirtyCount = Object.keys(edits).length;

  // Group keys change when rows merge or a refresh removes accepted rows. A
  // selection is only ever read against the live rows -- the copy-down, the
  // ready count, and the header checkbox all intersect with them -- so it is
  // narrowed during render rather than pruned a commit later.
  const selected = useMemo(() => {
    const live = new Set<string>();
    for (const group of groups) if (rawSelected.has(group.key)) live.add(group.key);
    return live;
  }, [groups, rawSelected]);

  const setFootprintLink = useCallback(
    (group: ProposalGroup, assetId: string) => {
      commitEdits((current) => {
        const next = { ...current };
        for (const member of group.members) {
          next[member.id] = { ...next[member.id], footprintAssetId: assetId };
        }
        return next;
      });
    },
    [commitEdits]
  );

  /** Copy the focused row's value down every selected row - the spreadsheet staple. */
  const fillDown = useCallback(
    (source: ProposalGroup, column: GridColumn) => {
      const value = cellValue(source.representative, column, edits);
      const targetGroups =
        selected.size > 0 ? visibleRows.filter((group) => selected.has(group.key)) : visibleRows;
      fillGroups(targetGroups, column, value);
      const name = column.kind === "builtin" ? column.key.replace(/_/g, " ") : column.label;
      toast.success(`Filled ${name} into ${targetGroups.length} rows`, {
        description: "Press ⌘Z to undo",
      });
    },
    [edits, fillGroups, selected, visibleRows]
  );

  const buildDrafts = useCallback(() => {
    const drafts: Record<string, ImportProposalDraft> = {};
    const byId = new Map(proposals.map((proposal) => [proposal.id, proposal]));
    for (const [proposalId, edit] of Object.entries(edits)) {
      const draft: ImportProposalDraft = {};
      const overrides: ImportMetadataOverrides = { ...edit.metadata };
      if (edit.extraFields) {
        // A saved draft is replaced whole, so keep the custom values drafted earlier.
        const proposal = byId.get(proposalId);
        overrides.extra_fields = proposal ? editedExtraFields(proposal, edits) : edit.extraFields;
      }
      if (Object.keys(overrides).length > 0) draft.metadata_overrides = overrides;
      if (edit.footprintAssetId !== undefined) {
        draft.asset_links = edit.footprintAssetId ? { footprint: edit.footprintAssetId } : {};
      }
      drafts[proposalId] = draft;
    }
    return drafts;
  }, [edits, proposals]);

  const saveDrafts = useCallback(async () => {
    if (dirtyCount === 0) return;
    setSaving(true);
    try {
      await saveProposalDrafts(sessionId, buildDrafts());
      resetHistory();
      // Saved edits are no longer pending, so a stale selection would leave the
      // "Import selected" count disagreeing with the checkboxes.
      setSelected(new Set());
      await onRefresh();
      toast.success("Import edits saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save import edits");
    } finally {
      setSaving(false);
    }
  }, [buildDrafts, dirtyCount, onRefresh, resetHistory, sessionId]);

  const acceptRows = useCallback(
    async (rows: ProposalGroup[]) => {
      if (rows.length === 0) return;
      setAccepting(true);
      try {
        // Every member is submitted. They carry identical metadata, so the backend
        // resolves them to one component and records each reference as a usage
        // rather than creating a duplicate or an extra revision.
        const items = rows.flatMap((group) => group.members.map((proposal) => {
          const metadata_overrides: ImportMetadataOverrides = {};
          for (const column of COLUMNS) {
            metadata_overrides[column.key] = effectiveValue(proposal, column.key, edits);
          }
          const extraFields = acceptExtraFields(proposal, editedExtraFields(proposal, edits));
          if (extraFields) metadata_overrides.extra_fields = extraFields;
          const footprintAssetId = effectiveFootprintLink(proposal, edits);
          return {
            proposal_id: proposal.id,
            metadata_overrides,
            asset_links: footprintAssetId ? { footprint: footprintAssetId } : {},
            change_summary: `Import ${proposal.reference || "component"} from Prism project`,
          };
        }));

        const result = await bulkAcceptProposals(sessionId, items);

        replaceEdits((current) => {
          const next = { ...current };
          for (const entry of result.results) {
            if (entry.status === "accepted") delete next[entry.proposal_id];
          }
          return next;
        });
        setSelected(new Set());
        await onRefresh();

        // result.accepted counts proposals; a grouped row submits one per reference
        // but yields a single component, so report distinct components instead.
        const componentCount = new Set(
          result.results.flatMap((entry) => (
            entry.status === "accepted" && entry.component_id
              ? [entry.component_id]
              : []
          ))
        ).size;

        if (result.failed === 0) {
          const references = result.accepted;
          toast.success(
            `Imported ${componentCount} component${componentCount === 1 ? "" : "s"}`,
            references > componentCount
              ? { description: `${references} references linked to them` }
              : undefined
          );
        } else {
          const firstError = result.results.find((entry) => entry.status === "failed")?.error;
          toast.warning(
            `Imported ${componentCount}, ${result.failed} row${result.failed === 1 ? "" : "s"} failed. ${firstError ?? ""}`.trim()
          );
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to accept import rows");
      } finally {
        setAccepting(false);
      }
    },
    [edits, onRefresh, replaceEdits, sessionId]
  );

  const exportCsv = useCallback(() => {
    window.location.href = importProposalsCsvUrl(sessionId);
  }, [sessionId]);

  const importCsv = useCallback(
    async (file: File | undefined) => {
      if (!file) return;
      setSaving(true);
      try {
        const result = await importProposalsCsv(sessionId, file);
        replaceEdits(() => ({}));
        await onRefresh();
        toast.success(
          `Applied ${result.saved} rows` +
            (result.skipped_unknown_rows ? `, skipped ${result.skipped_unknown_rows} unknown` : "")
        );
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to import CSV");
      } finally {
        setSaving(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    },
    [onRefresh, replaceEdits, sessionId]
  );

  const toggleAll = (checked: boolean) => {
    setSelected(checked ? new Set(visibleRows.map((row) => row.key)) : new Set());
  };

  const selectedReady = groups.filter(
    (group) => selected.has(group.key) && (problemsByGroup.get(group.key)?.length ?? 0) === 0
  );

  if (candidates.length === 0) {
    return (
      <p className="border p-6 text-center text-sm text-muted-foreground">
        No components are awaiting review in this session.
      </p>
    );
  }

  // Status leads the row so a scan down the left edge shows what still needs work,
  // which matters most when the "needs attention" filter is off.
  const gridTemplate = `36px 40px 150px ${columns.map((column) => `${column.width}px`).join(" ")} 200px`;

  return (
    <div className="flex h-full min-h-0 flex-col gap-2" data-testid="import-remediation-grid">
      <div className="flex shrink-0 flex-wrap items-center gap-1.5" data-testid="import-remediation-controls">
        <Input
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          placeholder="Filter"
          aria-label="Filter rows"
          className="h-8 w-44 text-xs"
        />
        <Button
          variant={onlyProblems ? "default" : "outline"}
          size="sm"
          className="h-8 gap-1.5 px-2 text-xs"
          aria-pressed={onlyProblems}
          aria-label={`Needs attention (${groups.length - readyRows.length})`}
          title="Only rows that need attention"
          onClick={() => setOnlyProblems((current) => !current)}
        >
          <AlertTriangle className="h-3.5 w-3.5" />
          <span className="tabular-nums">{groups.length - readyRows.length}</span>
        </Button>
        <Button
          variant={groupByMpn ? "default" : "outline"}
          size="icon-sm"
          className="size-8"
          aria-pressed={groupByMpn}
          aria-label="Group by MPN"
          title={groupByMpn && mergedGroupCount > 0 ? `One row per MPN (${mergedGroupCount} merged)` : "One row per MPN"}
          onClick={() => setGroupByMpn((current) => !current)}
        >
          <Combine className="h-3.5 w-3.5" />
        </Button>
        <Separator orientation="vertical" className="mx-0.5 h-5" />
        <PermissionHint
          blocked={!canWrite}
          action="edit or accept import proposals"
          allowedRoles={["designer", "admin"]}
          className="flex min-w-0 flex-1 max-w-none"
        >
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
          <Button variant="ghost" size="icon-sm" className="size-8" aria-label="Undo" title="Undo (⌘Z)" disabled={!canWrite || !canUndo} onClick={undo}>
            <Undo2 className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon-sm" className="size-8" aria-label="Redo" title="Redo (⇧⌘Z)" disabled={!canWrite || !canRedo} onClick={redo}>
            <Redo2 className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 px-2 text-xs"
            aria-label={`Save edits${dirtyCount > 0 ? ` (${dirtyCount})` : ""}`}
            title="Save edits (⌘S)"
            disabled={!canWrite || saving || dirtyCount === 0}
            onClick={() => void saveDrafts()}
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            {dirtyCount > 0 ? <span className="tabular-nums">{dirtyCount}</span> : null}
          </Button>
          <Button variant="ghost" size="icon-sm" className="size-8" aria-label="Export CSV" title="Export CSV" onClick={exportCsv}>
            <Download className="h-3.5 w-3.5" />
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(event) => void importCsv(event.target.files?.[0])}
          />
          <Button variant="ghost" size="icon-sm" className="size-8" aria-label="Import CSV" title="Import CSV" disabled={!canWrite || saving} onClick={() => fileInputRef.current?.click()}>
            <Upload className="h-3.5 w-3.5" />
          </Button>
          <div className="ml-auto flex items-center gap-1.5">
            <Button
              size="sm"
              className="h-8 gap-1.5 text-xs"
              aria-label={`Import selected (${selectedReady.length})`}
              title="Accept the selected ready rows"
              disabled={!canWrite || accepting || selectedReady.length === 0}
              onClick={() => void acceptRows(selectedReady)}
            >
              {accepting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              Selected <span className="tabular-nums">{selectedReady.length}</span>
            </Button>
            <Button
              size="sm"
              variant="secondary"
              className="h-8 gap-1.5 text-xs"
              aria-label={`Import all ready (${readyRows.length})`}
              title="Accept every ready row"
              disabled={!canWrite || accepting || readyRows.length === 0}
              onClick={() => void acceptRows(readyRows)}
            >
              <CheckCheck className="h-3.5 w-3.5" />
              All ready <span className="tabular-nums">{readyRows.length}</span>
            </Button>
          </div>
        </div>
        </PermissionHint>
        <Button variant="ghost" size="icon-sm" className="size-8" aria-label="Detail view" title="Detail view" onClick={onShowDetailView}>
          <Rows3 className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="themed-scrollbar min-h-0 flex-1 overflow-auto border" data-testid="import-remediation-scroll-region">
        <div className="min-w-max">
          <div
            className="sticky top-0 z-20 grid items-center border-b bg-muted text-xs font-medium"
            data-testid="import-remediation-column-headings"
            style={{ gridTemplateColumns: gridTemplate }}
          >
            <div className="flex h-9 items-center justify-center border-r">
              <Checkbox
                checked={visibleRows.length > 0 && selected.size === visibleRows.length}
                onCheckedChange={(checked) => toggleAll(checked === true)}
                aria-label="Select all visible rows"
              />
            </div>
            <div className="flex h-9 items-center justify-center border-r" title="Row status">
              <span className="sr-only">Status</span>
            </div>
            <div className="flex h-9 items-center border-r px-2">References</div>
            {columns.map((column) => (
              <div key={`${column.kind}:${column.key}`} className="flex h-9 items-center gap-1 border-r px-2">
                <span className="truncate" title={column.label}>{column.label}</span>
                {column.required ? <span className="text-destructive">*</span> : null}
              </div>
            ))}
            <div className="flex h-9 items-center px-2">Footprint</div>
          </div>

          {visibleRows.map((group) => {
            const proposal = group.representative;
            const problems = problemsByGroup.get(group.key) ?? [];
            const linkedFootprint = effectiveFootprintLink(proposal, edits);
            const isSelected = selected.has(group.key);
            const referenceLabel = group.references.join(", ") || "—";
            return (
              <div
                key={group.key}
                className={cn(
                  "grid items-center border-b text-xs last:border-b-0",
                  isSelected && "bg-primary/5"
                )}
                style={{ gridTemplateColumns: gridTemplate }}
              >
                <div className="flex h-9 items-center justify-center border-r">
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={(checked) =>
                      setSelected((current) => {
                        const next = new Set(current);
                        if (checked === true) next.add(group.key);
                        else next.delete(group.key);
                        return next;
                      })
                    }
                    aria-label={`Select ${referenceLabel}`}
                  />
                </div>
                <div className="flex h-9 items-center justify-center border-r">
                  {problems.length === 0 ? (
                    <Check className="h-3.5 w-3.5 text-success" aria-label="Ready to import" />
                  ) : (
                    <span title={problems.join("\n")} className="cursor-help">
                      <AlertTriangle
                        className="h-3.5 w-3.5 text-destructive"
                        aria-label={`Needs attention: ${problems.join(", ")}`}
                      />
                    </span>
                  )}
                </div>
                <div
                  className="flex h-9 items-center gap-1.5 border-r px-2 font-medium"
                  title={
                    group.references.length > 1
                      ? `${group.references.length} references import as one component:\n${referenceLabel}`
                      : referenceLabel
                  }
                >
                  <span className="truncate">{referenceLabel}</span>
                  {group.references.length > 1 ? (
                    <Badge variant="outline" className="shrink-0 px-1 text-[10px] font-normal">
                      ×{group.references.length}
                    </Badge>
                  ) : null}
                </div>

                {columns.map((column) => {
                  const value = cellValue(proposal, column, edits);
                  const invalid = column.required && !value.trim();
                  return (
                    <div
                      key={`${column.kind}:${column.key}`}
                      className={cn("group relative h-9 border-r p-0.5", invalid && "bg-destructive/10")}
                    >
                      <input
                        className="h-full w-full bg-transparent px-1.5 text-xs outline-none focus:bg-background focus:ring-1 focus:ring-inset focus:ring-ring disabled:cursor-default"
                        value={value}
                        disabled={!canWrite}
                        aria-invalid={invalid}
                        aria-label={`${column.label} for ${referenceLabel}`}
                        onChange={(event) => setGroupCell(group, column, event.target.value)}
                      />
                      {canWrite ? (
                        <button
                          type="button"
                          title="Fill this value down into selected rows"
                          onClick={() => fillDown(group, column)}
                          className="absolute right-0.5 top-1/2 hidden -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground group-focus-within:block"
                        >
                          <ArrowDownToLine className="h-3 w-3" />
                        </button>
                      ) : null}
                    </div>
                  );
                })}

                <LibraryAssetLinkPicker
                  assetType="footprint"
                  value={linkedFootprint}
                  disabled={!canWrite}
                  placeholder={
                    group.members.every((member) => hasOwnAsset(member, "footprint"))
                      ? "Importing own footprint"
                      : "Link a footprint"
                  }
                  suggestQuery={effectiveValue(proposal, "package_name", edits)}
                  onChange={(assetId) => setFootprintLink(group, assetId)}
                />
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}
