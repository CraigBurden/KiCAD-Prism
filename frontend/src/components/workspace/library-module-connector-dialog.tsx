import { useEffect, useMemo, useState } from "react";
import { RotateCcw, RotateCw, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { deleteModuleConnector, getConnectorGeometry, listComponents, saveModuleConnector } from "./catalog-client";
import type { ConnectorGeometry, MatingAxis, Vec3 } from "@/features/system-builder/placement/frames";
import type { ModulePlacement } from "@/features/system-builder/placement/module-ports";

import type { MatingPart } from "./library-component-mates";
import { ModuleFacePicker, type PickerConnector, type PickerModel } from "./module-face-picker";

/** A unit of a module's symbol with its placed connector (CONTRACTS_P2 §3.6). */
export interface ModuleConnectorUnit {
  key: string;
  name: string;
  pads: string[];
  connector: {
    /** At the revision the placement recorded; `currentRevisionId` is the part's current one (#698). */
    part: MatingPart & { revisionId?: string | null; currentRevisionId?: string | null };
    placement: ModulePlacement;
    geometry: ConnectorGeometry | null;
    footprintPose: unknown;
    model: PickerModel | null;
    missingPads: string[];
  } | null;
}

export interface ModuleConnectors {
  units: ModuleConnectorUnit[];
  orphans: string[];
  complete: boolean;
}

interface PartChoice extends MatingPart {
  geometry: ConnectorGeometry | null;
  model: PickerModel | null;
}

const AXES: (MatingAxis | "auto")[] = ["auto", "top", "bottom", "+x", "-x", "+y", "-y"];

/** A face label for a stored normal: "+Z face" for an axis, else the vector. */
export function faceLabel(normal: Vec3): string {
  const axis = normal.findIndex((c) => Math.abs(Math.abs(c) - 1) < 1e-9);
  if (axis >= 0) return `${normal[axis] > 0 ? "+" : "−"}${"XYZ"[axis]} face`;
  return `face (${normal.map((c) => c.toFixed(3)).join(", ")})`;
}

const turned = (turns: number, delta: number) => (((turns + delta) % 4) + 4) % 4;

/**
 * SB2-48b: place one unit's connector part on the module. The connector is drawn in green on the
 * module's model with its pin 1 in red; the module's other placed connectors are grey.
 */
export function ModuleConnectorDialog({ componentId, moduleModel, unit, units, canMutate, onClose, onSaved }: {
  componentId: string;
  moduleModel: PickerModel;
  unit: ModuleConnectorUnit;
  units: ModuleConnectorUnit[];
  canMutate: boolean;
  onClose: () => void;
  onSaved: (connectors: ModuleConnectors) => void;
}) {
  const placed = unit.connector;
  const [part, setPart] = useState<PartChoice | null>(placed && placed.geometry
    ? { ...placed.part, geometry: placed.geometry, model: placed.model } : null);
  const [placement, setPlacement] = useState<ModulePlacement | null>(placed?.placement ?? null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MatingPart[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const text = query.trim();
    if (text.length < 2) return undefined;
    const controller = new AbortController();
    const params = new URLSearchParams({ q: text, page: "1", page_size: "8", lightweight: "true", kind: "part" });
    const timer = window.setTimeout(() => {
      listComponents(params, controller.signal)
        .then((body) => setResults(body.items.map((item) => ({
          componentId: item.id, name: item.value || item.description || item.mpn, mpn: item.mpn, manufacturer: item.manufacturer,
        }))))
        .catch(() => undefined);
    }, 200);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const choose = async (choice: MatingPart) => {
    setBusy(true);
    try {
      const detail = await getConnectorGeometry(choice.componentId);
      if (!detail.geometry) {
        toast.error(`${choice.mpn || choice.name} has no footprint with pads`);
        return;
      }
      setPart({ ...choice, geometry: detail.geometry, model: detail.model });
      setQuery("");
      setResults([]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not read the part's footprint");
    } finally {
      setBusy(false);
    }
  };

  const active: PickerConnector | null = useMemo(() => (part?.geometry && placement
    ? { key: unit.key, placement, geometry: part.geometry, model: part.model } : null), [part, placement, unit.key]);
  const others: PickerConnector[] = useMemo(() => units.flatMap((other) => (
    other.key !== unit.key && other.connector?.geometry
      ? [{ key: other.key, placement: other.connector.placement, geometry: other.connector.geometry, model: other.connector.model }]
      : [])), [units, unit.key]);
  const missing = part?.geometry
    ? unit.pads.filter((pad) => !part.geometry!.pads.some((p) => p.pad === pad)) : [];

  const place = (originMm: Vec3, normal: Vec3) =>
    setPlacement((current) => ({ originMm, normal, quarterTurns: current?.quarterTurns ?? 0, axis: current?.axis ?? null }));
  const turn = (delta: 1 | -1) =>
    setPlacement((current) => (current ? { ...current, quarterTurns: turned(current.quarterTurns, delta) } : current));
  const setOrigin = (index: number, text: string) => {
    const value = Number(text);
    if (!Number.isFinite(value)) return;
    setPlacement((current) => {
      if (!current) return current;
      const originMm = [...current.originMm] as Vec3;
      originMm[index] = value;
      return { ...current, originMm };
    });
  };

  const send = async (method: "PUT" | "DELETE") => {
    setBusy(true);
    try {
      const body = await (method === "PUT"
        ? saveModuleConnector(componentId, unit.key, { partId: part!.componentId, ...placement })
        : deleteModuleConnector(componentId, unit.key));
      onSaved(body);
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save the connector");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[92vh] max-w-6xl flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>Connector {unit.key}{unit.name ? ` · ${unit.name}` : ""}</DialogTitle>
          <DialogDescription>
            Choose the catalog part that is this connector, then click the face of the module it sits on. Pads {unit.pads.join(", ")}.
          </DialogDescription>
        </DialogHeader>
        <div className="grid min-h-0 flex-1 gap-4 md:grid-cols-[1fr_18rem]">
          <ModuleFacePicker module={moduleModel} active={active} others={others} onPlace={place} onMoved={setPlacement} onTurn={turn} />
          <div className="space-y-4 overflow-y-auto text-sm">
            <section className="space-y-2" aria-label="Connector part">
              <Label>Connector part</Label>
              {part ? (
                <p className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate font-medium">{part.mpn || part.name}</span>
                  {canMutate ? <Button variant="ghost" size="sm" onClick={() => setPart(null)}>Change</Button> : null}
                </p>
              ) : null}
              {canMutate && !part ? (
                <>
                  <Input aria-label="Find the connector part" placeholder="Find a part by MPN or name" value={query}
                    onChange={(event) => setQuery(event.target.value)} />
                  {query.trim().length >= 2 && results.length > 0 ? (
                    <ul className="divide-y border">
                      {results.map((result) => (
                        <li key={result.componentId}>
                          <button type="button" className="w-full px-3 py-2 text-left hover:bg-muted" disabled={busy}
                            onClick={() => void choose(result)}>
                            {result.mpn || result.name} <span className="text-muted-foreground">· {result.manufacturer}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </>
              ) : null}
              {missing.length > 0 ? (
                <p className="text-xs text-destructive">This footprint lacks pad{missing.length > 1 ? "s" : ""} {missing.join(", ")} of the unit.</p>
              ) : null}
            </section>
            {part && !placement ? <p className="text-muted-foreground">Click a face of the model to place the connector.</p> : null}
            {placement ? (
              <section className="space-y-3" aria-label="Placement">
                <p><span className="text-muted-foreground">On the</span> {faceLabel(placement.normal)}</p>
                <div className="grid grid-cols-3 gap-2">
                  {(["X", "Y", "Z"] as const).map((axis, index) => (
                    <div key={axis} className="space-y-1">
                      <Label htmlFor={`origin-${axis}`} className="text-xs">{axis} mm</Label>
                      <Input id={`origin-${axis}`} type="number" step="0.1" value={placement.originMm[index]} disabled={!canMutate}
                        onChange={(event) => setOrigin(index, event.target.value)} />
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <span className="flex-1">Turn {placement.quarterTurns * 90}°</span>
                  <Button variant="outline" size="icon" className="h-8 w-8" aria-label="Turn a quarter back" disabled={!canMutate}
                    onClick={() => turn(-1)}><RotateCcw className="h-4 w-4" /></Button>
                  <Button variant="outline" size="icon" className="h-8 w-8" aria-label="Turn a quarter" disabled={!canMutate}
                    onClick={() => turn(1)}><RotateCw className="h-4 w-4" /></Button>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Mating direction of the part</Label>
                  <Select value={placement.axis ?? "auto"} disabled={!canMutate}
                    onValueChange={(value) => setPlacement({ ...placement, axis: value === "auto" ? null : (value as MatingAxis) })}>
                    <SelectTrigger aria-label="Mating direction"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {AXES.map((axis) => <SelectItem key={axis} value={axis}>{axis === "auto" ? "From the footprint" : axis}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">The part's mating side faces out of the module. Pin 1 is the red dot.</p>
                </div>
              </section>
            ) : null}
          </div>
        </div>
        <DialogFooter className="gap-2">
          {canMutate && placed ? (
            <Button variant="ghost" className="mr-auto" disabled={busy} onClick={() => void send("DELETE")}>
              <Trash2 className="mr-1 h-4 w-4" /> Remove
            </Button>
          ) : null}
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          {canMutate ? (
            <Button disabled={busy || !part || !placement || missing.length > 0} onClick={() => void send("PUT")}>Save</Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
