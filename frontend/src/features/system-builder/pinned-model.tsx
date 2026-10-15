import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { convertModelsAndWait } from "@/components/workspace/library-component-models";

import { PINNED_MODELS_PREFIX, sessionReads } from "./session/session-reads";
import { useSessionRead, useSystemSession } from "./session/use-system-session";

/**
 * A pinned revision's models (CONTRACTS_P2 §18.2), read once per revision for every view that shows it
 * when `enabled`, and converted on request: that revision's, never the component's current one. Once the
 * conversion settles, the models and the 3D scene are read again, so the model replaces the proxy box.
 */
function usePinnedModels(componentId: string, revisionId: string, enabled: boolean) {
  const { session } = useSystemSession();
  const spec = sessionReads.pinnedModels(componentId, revisionId);
  const items = useSessionRead(enabled ? spec : null).data;
  const [converting, setConverting] = useState(false);
  const models = Array.isArray(items) ? { total: items.length, converted: items.filter((model) => model.glb).length } : null;

  const convert = async () => {
    setConverting(true);
    try {
      const done = await convertModelsAndWait(componentId, () => undefined, revisionId);
      if (!done) toast.info("Conversion still running");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not convert the models");
    } finally {
      setConverting(false);
      session.refresh(spec.key);
      session.refresh(sessionReads.scene().key);
    }
  };

  return { models, converting, convert };
}

/**
 * The scene's `modelsConverting` (conversions a scene read queued) dropped to zero: every pinned-models
 * read (inspector facts, harness ends) is read again, so none stays "Not converted".
 */
export function useConversionsSettled(converting: number) {
  const { session } = useSystemSession();
  const was = useRef(converting);
  useEffect(() => {
    if (was.current > 0 && converting === 0) session.refreshPrefix(PINNED_MODELS_PREFIX);
    was.current = converting;
  }, [converting, session]);
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
