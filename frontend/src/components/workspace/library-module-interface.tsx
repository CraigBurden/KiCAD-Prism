import { useEffect, useState } from "react";
import { MapPin } from "lucide-react";

import { Button } from "@/components/ui/button";
import { listModels, listModuleConnectors } from "./catalog-client";
import type { CatalogComponent } from "@/types/catalog";

import {
  type ModuleConnectorUnit, type ModuleConnectors, ModuleConnectorDialog, faceLabel,
} from "./library-module-connector-dialog";
import type { PickerModel } from "./module-face-picker";

/** A module connector's pin, from its symbol (CONTRACTS_P2 §3.5): the name is the signal. */
export interface ModulePin {
  pad: string;
  name: string;
  signal: string;
  powerNet: boolean;
}

/** One unit of a module's symbol: one connector. `key` is KiCad's unit letter. */
export interface ModuleUnit {
  key: string;
  unit: number;
  name: string;
  pins: ModulePin[];
}

interface ModuleInterface {
  units?: ModuleUnit[];
  error?: string;
}

/** The module's first converted model, the surface its connectors are placed on (SB2-48b). */
function useModuleModel(componentId: string, revision: string): PickerModel | null | undefined {
  const [model, setModel] = useState<{ key: string; value: PickerModel | null } | undefined>();
  const key = `${componentId}:${revision}`;
  useEffect(() => {
    const controller = new AbortController();
    listModels(componentId, controller.signal)
      .then((body) => {
        const found = body.items.find((item) => item.glb);
        setModel({ key, value: found?.glb ? { glbKey: found.glb.key, alignment: found.alignment, boundsMm: found.glb.bounds } : null });
      })
      .catch(() => !controller.signal.aborted && setModel({ key, value: null }));
    return () => controller.abort();
  }, [componentId, key]);
  return model?.key === key ? model.value : undefined;
}

function useConnectors(componentId: string, revision: string) {
  const [connectors, setConnectors] = useState<{ key: string; value: ModuleConnectors } | null>(null);
  const key = `${componentId}:${revision}`;
  useEffect(() => {
    const controller = new AbortController();
    listModuleConnectors(componentId, controller.signal)
      .then((value) => setConnectors({ key, value }))
      .catch(() => undefined);
    return () => controller.abort();
  }, [componentId, key]);
  return [connectors?.key === key ? connectors.value : null, (value: ModuleConnectors) => setConnectors({ key, value })] as const;
}

function placementSummary(unit: ModuleConnectorUnit): string {
  const connector = unit.connector;
  if (!connector) return "Not placed";
  const part = connector.part.mpn || connector.part.name;
  if (!connector.geometry) return `${part}: the part has no footprint now`;
  if (connector.missingPads.length) return `${part}: lacks pads ${connector.missingPads.join(", ")}`;
  return `${part} on the ${faceLabel(connector.placement.normal)}`;
}

/**
 * SB2-48 (D-P2-39): a module's connectors as its symbol defines them, read-only. They are
 * derived from the symbol on every revision; edit the symbol to change them. SB2-48b (D-P2-40):
 * each one is a catalog part placed on the module's model.
 */
export function ModuleConnectorsPanel({ component, canMutate }: { component: CatalogComponent; canMutate: boolean }) {
  const derived = (component.interface ?? {}) as ModuleInterface;
  const units = Array.isArray(derived.units) ? derived.units : [];
  const hasModel = component.assets.some((asset) => asset.asset_type === "3dmodel" && /\.(step|stp)$/i.test(asset.name));
  const revision = String(component.current_revision_id ?? "");
  const moduleModel = useModuleModel(component.id, revision);
  const [connectors, setConnectors] = useConnectors(component.id, revision);
  const [editing, setEditing] = useState<string | null>(null);
  const placed = new Map((connectors?.units ?? []).map((unit) => [unit.key, unit]));
  const editingUnit = editing ? placed.get(editing) : undefined;

  return (
    <section className="space-y-3 rounded-md border p-4" aria-label="Connectors">
      <div className="flex flex-wrap items-baseline gap-2">
        <h3 className="text-sm font-semibold">Connectors</h3>
        <span className="text-xs text-muted-foreground">
          One per unit of the symbol, each a catalog part placed on the module's model. Systems link to these like a board's connectors; a pin's name is its signal.
        </span>
      </div>
      {derived.error ? <p className="text-xs text-destructive">{derived.error}: attach a multi-unit symbol whose units are the connectors.</p> : null}
      {!hasModel ? <p className="text-xs text-amber-700 dark:text-amber-300">No STEP model yet: a module can't be released without one.</p> : null}
      {hasModel && moduleModel === null ? (
        <p className="text-xs text-amber-700 dark:text-amber-300">Convert the STEP model (Models, below) to place connectors on it.</p>
      ) : null}
      {connectors && units.length > 0 && !connectors.complete ? (
        <p className="text-xs text-amber-700 dark:text-amber-300">Place every connector before releasing the module.</p>
      ) : null}
      {connectors?.orphans.length ? (
        <p className="text-xs text-muted-foreground">Placements for units the symbol no longer has: {connectors.orphans.join(", ")}.</p>
      ) : null}
      {units.map((unit) => {
        const status = placed.get(unit.key);
        return (
          <div key={unit.key} className="space-y-1">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <p className="min-w-0 flex-1"><b>{unit.name}</b> <span className="font-mono text-xs text-muted-foreground">unit {unit.key}</span>
                {status ? <span className="ml-2 text-xs text-muted-foreground">· {placementSummary(status)}</span> : null}</p>
              {status && moduleModel ? (
                <Button variant="outline" size="sm" onClick={() => setEditing(unit.key)}>
                  <MapPin className="mr-1 h-3.5 w-3.5" /> {status.connector ? (canMutate ? "Edit placement" : "View placement") : "Place connector"}
                </Button>
              ) : null}
            </div>
            <table className="w-full text-xs">
              <thead><tr className="text-left text-muted-foreground"><th className="py-1 pr-3">Pad</th><th className="pr-3">Signal</th><th>Power</th></tr></thead>
              <tbody>
                {unit.pins.map((pin) => (
                  <tr key={pin.pad} className="border-t">
                    <td className="py-1 pr-3 font-mono">{pin.pad}</td>
                    <td className="pr-3 font-mono">{pin.signal || <span className="text-muted-foreground">unnamed</span>}</td>
                    <td>{pin.powerNet ? "Yes" : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
      {editingUnit && moduleModel && connectors ? (
        <ModuleConnectorDialog componentId={component.id} moduleModel={moduleModel} unit={editingUnit} units={connectors.units}
          canMutate={canMutate} onClose={() => setEditing(null)} onSaved={setConnectors} />
      ) : null}
    </section>
  );
}
