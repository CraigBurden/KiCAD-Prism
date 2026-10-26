import { useMemo, useState } from "react";
import { AlertTriangle, Box, CircuitBoard, FileCode2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { blockingImportFindings, customImportProblems, importMetadataProblems, isFieldRequired } from "@/lib/catalog-field-rules";
import type { CatalogMetadataField, ImportMetadataOverrides, ProjectComponentImportProposal } from "@/types/catalog";
import { acceptExtraFields, scannedExtraFields } from "./library-import-custom-fields";

export interface ProposalRemediation {
  metadata_overrides: ImportMetadataOverrides;
  asset_selections: Record<string, string[]>;
  change_summary: string;
}

interface LibraryImportRemediationDialogProps {
  proposal: ProjectComponentImportProposal | null;
  /** Active custom metadata fields; each gets an input (D43). */
  customFields?: readonly CatalogMetadataField[];
  open: boolean;
  submitting: boolean;
  onOpenChange: (open: boolean) => void;
  onAccept: (remediation: ProposalRemediation) => void;
}

const NO_CUSTOM_FIELDS: readonly CatalogMetadataField[] = [];

const assetIcon = (assetType: string) => assetType === "symbol" ? FileCode2 : assetType === "footprint" ? CircuitBoard : Box;

function initialMetadata(
  proposal: ProjectComponentImportProposal | null,
): Record<string, string> {
  const source = (proposal?.metadata ?? {}) as Record<string, unknown>;
  return {
    value: String(source.value || ""),
    description: String(source.description || ""),
    datasheet: String(source.datasheet || ""),
    manufacturer: String(source.manufacturer || ""),
    manufacturer_part_number: String(source.manufacturer_part_number || ""),
    package_name: String(source.footprint || ""),
  };
}

// Symbols and footprints take exactly one; everything else defaults to all of
// it, because a 3D model or a datasheet is additive.
function initialSelections(
  assetsByType: Record<string, ProjectComponentImportProposal["assets"]>,
): Record<string, string[]> {
  const defaults: Record<string, string[]> = {};
  for (const [assetType, assets] of Object.entries(assetsByType)) {
    defaults[assetType] = assetType === "symbol" || assetType === "footprint"
      ? assets.slice(0, 1).map((asset) => asset.sha256)
      : assets.map((asset) => asset.sha256);
  }
  return defaults;
}

export function LibraryImportRemediationDialog({
  proposal, customFields = NO_CUSTOM_FIELDS, open, submitting, onOpenChange, onAccept,
}: LibraryImportRemediationDialogProps) {
  const assetsByType = useMemo(() => {
    const grouped: Record<string, ProjectComponentImportProposal["assets"]> = {};
    for (const asset of proposal?.assets || []) (grouped[asset.asset_type] ||= []).push(asset);
    return grouped;
  }, [proposal]);

  // Keyed on the proposal by library-import-center, so the form is built once,
  // from the proposal it is for, and edits are the reviewer's from then on.
  const [metadata, setMetadata] = useState<Record<string, string>>(
    () => initialMetadata(proposal),
  );
  const [selections, setSelections] = useState<Record<string, string[]>>(
    () => initialSelections(assetsByType),
  );
  // Only the custom values the reviewer typed; the rest come from the symbol's own fields.
  const [editedExtras, setEditedExtras] = useState<Record<string, string>>({});
  const [changeSummary, setChangeSummary] = useState(
    () => `Import ${proposal?.reference || "component"} from Prism project`,
  );

  const scannedExtras = useMemo(() => (proposal ? scannedExtraFields(proposal) : {}), [proposal]);
  const extraValue = (storageKey: string) => editedExtras[storageKey] ?? scannedExtras[storageKey] ?? "";

  // The same rules the server applies when accepting.
  const metadataProblems = [
    ...importMetadataProblems(metadata),
    ...customImportProblems(customFields, { ...scannedExtras, ...editedExtras }),
  ];
  const accept = () => {
    const extraFields = proposal ? acceptExtraFields(proposal, editedExtras) : undefined;
    onAccept({
      metadata_overrides: extraFields ? { ...metadata, extra_fields: extraFields } : metadata,
      asset_selections: selections,
      change_summary: changeSummary,
    });
  };
  const requiredAssetsComplete = ["symbol", "footprint"].every((assetType) => selections[assetType]?.length === 1);
  const unresolvable = blockingImportFindings(proposal?.findings || []);

  const setField = (field: string, value: string) => setMetadata((current) => ({ ...current, [field]: value }));
  const selectPrimary = (assetType: string, sha256: string) => setSelections((current) => ({ ...current, [assetType]: [sha256] }));
  const toggleOptional = (assetType: string, sha256: string, checked: boolean) => setSelections((current) => {
    const selected = new Set(current[assetType] || []);
    if (checked) selected.add(sha256); else selected.delete(sha256);
    return { ...current, [assetType]: [...selected] };
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Review project component</DialogTitle>
          <DialogDescription className="sr-only">Required metadata and assets for the draft revision</DialogDescription>
        </DialogHeader>

        {proposal && <div className="space-y-6">
          <section className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5"><Label htmlFor="import-value">Value</Label><Input id="import-value" value={metadata.value || ""} onChange={(event) => setField("value", event.target.value)} /></div>
            <div className="space-y-1.5"><Label htmlFor="import-manufacturer">Manufacturer</Label><Input id="import-manufacturer" value={metadata.manufacturer || ""} onChange={(event) => setField("manufacturer", event.target.value)} /></div>
            <div className="space-y-1.5"><Label htmlFor="import-mpn">Manufacturer part number</Label><Input id="import-mpn" value={metadata.manufacturer_part_number || ""} onChange={(event) => setField("manufacturer_part_number", event.target.value)} /></div>
            <div className="space-y-1.5"><Label htmlFor="import-datasheet">Datasheet</Label><Input id="import-datasheet" value={metadata.datasheet || ""} onChange={(event) => setField("datasheet", event.target.value)} /></div>
            <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="import-description">Description</Label><Textarea id="import-description" value={metadata.description || ""} onChange={(event) => setField("description", event.target.value)} /></div>
            <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="import-footprint">Footprint mapping</Label><Input id="import-footprint" value={metadata.package_name || ""} onChange={(event) => setField("package_name", event.target.value)} /></div>
            {customFields.map((field) => {
              const id = `import-custom-${field.id}`;
              const value = extraValue(field.storage_key);
              const required = isFieldRequired(field);
              return <div key={field.id} className="space-y-1.5">
                <Label htmlFor={id}>{field.label || field.key}{required ? <span className="text-destructive"> *</span> : null}</Label>
                <Input id={id} value={value} aria-invalid={required && !value.trim()} onChange={(event) => setEditedExtras((current) => ({ ...current, [field.storage_key]: event.target.value }))} />
              </div>;
            })}
          </section>

          <section>
            <h3 className="text-sm font-semibold">Revision assets</h3>
            <div className="mt-2 space-y-3">
              {Object.entries(assetsByType).map(([assetType, assets]) => {
                const Icon = assetIcon(assetType);
                const primary = assetType === "symbol" || assetType === "footprint";
                return <div key={assetType} className="border p-3">
                  <div className="mb-2 flex items-center gap-2"><Icon className="h-4 w-4 text-muted-foreground" /><span className="text-sm font-medium capitalize">{assetType}</span><span className="text-xs text-muted-foreground">{primary ? "Choose one" : "Include any number"}</span></div>
                  <div className="space-y-2">{assets.map((asset) => {
                    const checked = selections[assetType]?.includes(asset.sha256) || false;
                    return <label key={`${asset.sha256}-${asset.filename}`} className="flex cursor-pointer items-start gap-3 border bg-muted/20 p-2.5">
                      {primary ? <input type="radio" name={`asset-${assetType}`} checked={checked} onChange={() => selectPrimary(assetType, asset.sha256)} className="mt-1" /> : <Checkbox checked={checked} onCheckedChange={(value) => toggleOptional(assetType, asset.sha256, value === true)} className="mt-0.5" />}
                      <span className="min-w-0"><span className="block truncate text-sm font-medium">{asset.filename}</span><span className="block truncate font-mono text-xs text-muted-foreground">{asset.sha256.slice(0, 16)} · {asset.source_path}</span></span>
                    </label>;
                  })}</div>
                </div>;
              })}
              {Object.keys(assetsByType).length === 0 && <p className="p-3 text-sm text-muted-foreground">No assets</p>}
            </div>
          </section>

          {proposal.findings.length > 0 && <section><h3 className="text-sm font-semibold">Import findings</h3><div className="mt-2 space-y-2">{proposal.findings.map((finding) => <div key={`${finding.code}-${finding.message}`} className="flex gap-2 border p-2.5 text-sm"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" /><span>{finding.message}</span></div>)}</div></section>}
          <div className="space-y-1.5"><Label htmlFor="import-summary">Revision summary</Label><Input id="import-summary" value={changeSummary} onChange={(event) => setChangeSummary(event.target.value)} /></div>
        </div>}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
          <Button
            onClick={accept}
            title={metadataProblems.join("\n") || undefined}
            disabled={submitting || metadataProblems.length > 0 || !requiredAssetsComplete || unresolvable.length > 0 || !changeSummary.trim()}
          >
            {submitting ? "Creating revision…" : "Accept as draft revision"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
