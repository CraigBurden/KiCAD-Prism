import { useEffect, useState } from "react";
import { Box, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { convertModels, listMates, listModels, modelPreviewUrl, saveModelAlignment } from "./catalog-client";
import { pollUntil } from "@/lib/server-state";

import type { MatingPart } from "./library-component-mates";

type Triple = [number, number, number];

export interface ModelAlignment {
  offsetMm: Triple;
  rotationDeg: Triple;
  scale: number;
  updatedBy?: string | null;
  updatedAt?: string | null;
}

/** A part's STEP model with its converted GLB and alignment (CONTRACTS_P2 §18.2). */
export interface CatalogModel {
  assetId: string;
  name: string;
  stepSha256: string;
  glb: { key: string; converter: string; bounds: { minMm: Triple; maxMm: Triple }; materials: number; sizeBytes: number } | null;
  alignment: ModelAlignment;
}

const VIEWS = ["front", "side", "top"] as const;
const AXES = ["X", "Y", "Z"] as const;

/** The preview URL for an unsaved alignment; the server renders it with Geometer. */
export function previewUrl(componentId: string, assetId: string, alignment: ModelAlignment, view: string, partner: string | null): string {
  const params = new URLSearchParams({
    view, offset: alignment.offsetMm.join(","), rotation: alignment.rotationDeg.join(","), scale: String(alignment.scale),
  });
  if (partner) params.set("partner", partner);
  return modelPreviewUrl(componentId, assetId, params);
}

function size(bounds: { minMm: Triple; maxMm: Triple }): string {
  return bounds.maxMm.map((max, i) => (max - bounds.minMm[i]).toFixed(2)).join(" × ");
}

function useDebounced<T>(value: T, delay: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setSettled(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return settled;
}

function AlignmentEditor({ componentId, model, partners, canMutate, onSaved }: {
  componentId: string; model: CatalogModel; partners: MatingPart[]; canMutate: boolean; onSaved: (models: CatalogModel[]) => void;
}) {
  // Only unsaved edits live here; without any, the saved alignment shows.
  const [edits, setEdits] = useState<ModelAlignment | null>(null);
  const draft = edits ?? model.alignment;
  const setDraft = (update: (current: ModelAlignment) => ModelAlignment) => setEdits((current) => update(current ?? model.alignment));
  const [view, setView] = useState<(typeof VIEWS)[number]>("front");
  const [partner, setPartner] = useState<string>("none");
  const [busy, setBusy] = useState(false);
  const settled = useDebounced(draft, 300);
  const valid = [...draft.offsetMm, ...draft.rotationDeg, draft.scale].every(Number.isFinite) && draft.scale > 0;
  const dirty = JSON.stringify([draft.offsetMm, draft.rotationDeg, draft.scale])
    !== JSON.stringify([model.alignment.offsetMm, model.alignment.rotationDeg, model.alignment.scale]);

  const setTriple = (key: "offsetMm" | "rotationDeg", index: number, text: string) =>
    setDraft((current) => {
      const next = [...current[key]] as Triple;
      next[index] = text === "" || text === "-" ? Number.NaN : Number(text);
      return { ...current, [key]: next };
    });

  const save = async () => {
    setBusy(true);
    try {
      const body = await saveModelAlignment(componentId, model.assetId, {
        offsetMm: draft.offsetMm, rotationDeg: draft.rotationDeg, scale: draft.scale,
      });
      onSaved(body.items);
      setEdits(null);
      toast.success("Alignment saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save the alignment");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-4 md:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Place the model so its mating face lies on Z = 0, it mates toward +Z, and pin 1 sits toward −X. Every harness end using this part reuses it.
        </p>
        {(["offsetMm", "rotationDeg"] as const).map((key) => (
          <fieldset key={key} className="grid grid-cols-3 gap-2">
            <legend className="mb-1 text-xs font-medium">{key === "offsetMm" ? "Offset (mm)" : "Rotation (°, X then Y then Z)"}</legend>
            {AXES.map((axis, index) => (
              <Input key={axis} aria-label={`${key === "offsetMm" ? "Offset" : "Rotation"} ${axis}`} inputMode="decimal"
                className="h-8" defaultValue={String(model.alignment[key][index])}
                onChange={(event) => setTriple(key, index, event.target.value)} />
            ))}
          </fieldset>
        ))}
        <div className="grid gap-1">
          <Label htmlFor={`scale-${model.assetId}`} className="text-xs">Scale</Label>
          <Input id={`scale-${model.assetId}`} inputMode="decimal" className="h-8 w-24" defaultValue={String(model.alignment.scale)}
            onChange={(event) => setDraft((current) => ({ ...current, scale: Number(event.target.value) }))} />
        </div>
        <div className="grid gap-1">
          <Label className="text-xs">Mate with</Label>
          <Select value={partner} onValueChange={setPartner}>
            <SelectTrigger aria-label="Preview mated with" className="h-8"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Nothing (this part alone)</SelectItem>
              {partners.map((part) => <SelectItem key={part.componentId} value={part.componentId}>{part.mpn || part.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {canMutate && (
          <Button size="sm" disabled={busy || !valid || !dirty} onClick={() => void save()}>Save alignment</Button>
        )}
        {!valid && <p className="text-xs text-destructive">Enter numbers, and a scale above 0.</p>}
      </div>
      <div className="space-y-2">
        <div className="flex gap-1" role="tablist" aria-label="Preview view">
          {VIEWS.map((name) => (
            <Button key={name} size="sm" variant={view === name ? "default" : "outline"} role="tab" aria-selected={view === name}
              onClick={() => setView(name)}>{name[0].toUpperCase() + name.slice(1)}</Button>
          ))}
        </div>
        <div className="flex aspect-[4/3] items-center justify-center border bg-muted/30">
          {valid ? (
            <img alt={`${model.name} ${view} view`} className="max-h-full max-w-full" data-testid="model-preview"
              src={previewUrl(componentId, model.assetId, settled, view, partner === "none" ? null : partner)} />
          ) : <p className="text-sm text-muted-foreground">No preview until aligned</p>}
        </div>
      </div>
    </div>
  );
}

/**
 * Queue the GLB conversion of the current revision's STEP models, or of `revisionId`'s (a revision a system
 * pins), and poll until every one has a GLB or two minutes pass (CONTRACTS_P2 §18.2). `onModels` gets each
 * listing; resolves whether every model was converted.
 */
export async function convertModelsAndWait(componentId: string, onModels: (models: CatalogModel[]) => void,
  revisionId?: string): Promise<boolean> {
  await convertModels(componentId, revisionId);
  return pollUntil(async () => {
    const body = await listModels(componentId, undefined, revisionId);
    onModels(body.items);
    return body.items.every((model) => model.glb);
  }, { intervalMs: 2000, delayFirst: true, maxTicks: 60 });
}

/**
 * A part's 3D models for System Builder: the STEP converted to GLB with Geometer (bounds, colours) and the
 * alignment that places it in the part's mating frame, previewed alone or mated to a partner (CONTRACTS_P2 §18.2).
 */
export function ModelsPanel({ componentId, canMutate }: { componentId: string; canMutate: boolean }) {
  const [state, setState] = useState<{ id: string; models: CatalogModel[]; partners: MatingPart[] } | null>(null);
  const [converting, setConverting] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      listModels(componentId, controller.signal),
      listMates(componentId, controller.signal),
    ]).then(([models, mates]) => setState({ id: componentId, models: models.items, partners: mates.items }))
      .catch(() => !controller.signal.aborted && setState({ id: componentId, models: [], partners: [] }));
    return () => controller.abort();
  }, [componentId]);

  const convert = async () => {
    setConverting(true);
    try {
      await convertModelsAndWait(componentId, (models) => setState((current) => current && { ...current, models }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not convert the models");
    } finally {
      setConverting(false);
    }
  };

  const current = state?.id === componentId ? state : null;
  if (!current || current.models.length === 0) return null;
  const pending = current.models.some((model) => !model.glb);
  return (
    <section className="space-y-4 border p-4" aria-label="3D models">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold" title="Converted from STEP for the system 3D view"><Box className="h-4 w-4" /> 3D models</h3>
        </div>
        {canMutate && pending && (
          <Button size="sm" variant="outline" disabled={converting} onClick={() => void convert()}>
            <RefreshCw className={converting ? "mr-1 h-3.5 w-3.5 animate-spin" : "mr-1 h-3.5 w-3.5"} /> {converting ? "Converting…" : "Convert"}
          </Button>
        )}
      </div>
      {current.models.map((model) => (
        <div key={model.assetId} className="space-y-3 border-t pt-3">
          <p className="text-sm">
            <span className="font-medium">{model.name}</span>
            <span className="text-muted-foreground"> · {model.glb
              ? `${size(model.glb.bounds)} mm · ${model.glb.materials} colours · ${(model.glb.sizeBytes / 1_000_000).toFixed(2)} MB GLB`
              : "not converted yet"}</span>
          </p>
          <AlignmentEditor componentId={componentId} model={model} partners={current.partners} canMutate={canMutate}
            onSaved={(models) => setState((value) => value && { ...value, models })} />
        </div>
      ))}
    </section>
  );
}
