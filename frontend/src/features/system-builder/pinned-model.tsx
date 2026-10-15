import { useEffect, useState } from "react";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { convertModels, listModels } from "@/components/workspace/catalog-client";
import { pollUntil } from "@/lib/server-state";

/** The STEP models of a pinned catalog revision: null while unknown, else how many have a GLB. */
type ModelState = { total: number; converted: number } | null;

function counted(items: { glb: unknown }[] | undefined): ModelState {
  return Array.isArray(items) ? { total: items.length, converted: items.filter((model) => model.glb).length } : null;
}

/**
 * A pinned revision's models (CONTRACTS_P2 §18.2): read when `enabled`, and converted on request. The
 * conversion is that revision's, never the component's current one.
 */
function usePinnedModels(componentId: string, revisionId: string, enabled: boolean) {
  const key = `${componentId}@${revisionId}`;
  const [state, setState] = useState<{ key: string; models: ModelState } | null>(null);
  const [converting, setConverting] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    listModels(componentId, controller.signal, revisionId)
      .then((body) => setState({ key, models: counted(body.items) }))
      .catch(() => !controller.signal.aborted && setState({ key, models: null }));
    return () => controller.abort();
  }, [componentId, revisionId, key, enabled]);

  const convert = async () => {
    setConverting(true);
    try {
      await convertModels(componentId, revisionId);
      const done = await pollUntil(async () => {
        const models = counted((await listModels(componentId, undefined, revisionId)).items);
        setState({ key, models });
        return Boolean(models && models.converted === models.total);
      }, { intervalMs: 2000, delayFirst: true, maxTicks: 60 });
      if (!done) toast.info("Conversion still running");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not convert the models");
    } finally {
      setConverting(false);
    }
  };

  return { models: state?.key === key ? state.models : null, converting, convert };
}

function ConvertButton({ converting, onConvert }: { converting: boolean; onConvert: () => void }) {
  return (
    <Button variant="ghost" size="icon-sm" disabled={converting} onClick={onConvert}
      aria-label="Convert the pinned revision's models" title="Convert the pinned revision's models">
      <RefreshCw className={converting ? "size-3.5 animate-spin" : "size-3.5"} />
    </Button>
  );
}

/** The model state of the revision an instance pins, as an inspector fact value, with Convert for writers. */
export function PinnedModelFact({ componentId, revisionId, canConvert }: {
  componentId: string; revisionId: string; canConvert: boolean;
}) {
  const { models, converting, convert } = usePinnedModels(componentId, revisionId, true);
  if (!models) return <span className="text-muted-foreground">—</span>;
  if (models.total === 0) return <span className="text-muted-foreground">None</span>;
  const missing = models.total - models.converted;
  return (
    <span className="inline-flex items-center gap-1">
      <span className={missing ? "text-muted-foreground" : undefined}>
        {converting ? "Converting…" : missing ? "Not converted" : "Converted"}
      </span>
      {canConvert && missing > 0 && <ConvertButton converting={converting} onConvert={() => void convert()} />}
    </span>
  );
}

/** A harness end's housing part: shown only to a catalog writer, only while its pinned revision has no GLB. */
export function PinnedHousingConvert({ componentId, revisionId, canConvert }: {
  componentId: string; revisionId: string; canConvert: boolean;
}) {
  const { models, converting, convert } = usePinnedModels(componentId, revisionId, canConvert);
  if (!canConvert || !models || models.total === models.converted) return null;
  return (
    <span className="mt-1 flex items-center gap-1 text-xs text-muted-foreground" data-testid="housing-model">
      {converting ? "Converting model…" : "Model not converted"}
      <ConvertButton converting={converting} onConvert={() => void convert()} />
    </span>
  );
}
