import { useEffect, useRef, useState } from "react";
import { Boxes, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { getCollisionCheck, requestCollisionCheck } from "@/lib/systems-api";
import { cn } from "@/lib/utils";
import type { SystemDocument } from "@/types/system";

import { findingsOf } from "./findings";
import { useSystemSession } from "./session/use-system-session";
import { ToolbarButton } from "./workspace/toolbar-button";

const POLL_MS = 2000;
const POLL_LIMIT = 150; // five minutes

const STATE_TEXT = { current: "checked", stale: "placement changed since the check", not_checked: "not checked" } as const;

/** The 3D toolbar's collision check (P2 §24.2): its state, the collision count, and a run. */
export function CollisionCheckButton({ systemId, document }: { systemId: string; document: SystemDocument }) {
  const { session } = useSystemSession();
  const check = document.validation?.collisionCheck;
  const count = document.validation ? findingsOf(document.validation.findings).collisions.length : 0;
  const [running, setRunning] = useState(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true; // StrictMode mounts twice
    return () => {
      alive.current = false;
    };
  }, []);

  const run = async () => {
    const before = check?.checkedAt ?? null;
    setRunning(true);
    try {
      await requestCollisionCheck(systemId);
      for (let attempt = 0; attempt < POLL_LIMIT && alive.current; attempt += 1) {
        await new Promise((resolve) => window.setTimeout(resolve, POLL_MS));
        const latest = await getCollisionCheck(systemId);
        if (latest.checkedAt && latest.checkedAt !== before) {
          await session.reload();
          return;
        }
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The collision check failed");
    } finally {
      if (alive.current) setRunning(false);
    }
  };

  const state = check?.state ?? "not_checked";
  const skipped = check?.notEvaluated.length ?? 0;
  const title = running ? "Checking collisions…"
    : `Check collisions · ${STATE_TEXT[state]}${state === "current" ? ` · ${count} found${skipped ? ` · ${skipped} not checked` : ""}` : ""}`;
  return (
    <ToolbarButton title={title} disabled={running} onClick={() => void run()}
      className={cn(state === "current" && count > 0 && "text-warning enabled:hover:text-warning")}>
      {running ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Boxes className="size-4" aria-hidden />}
      {!running && state === "current" && count > 0 && <span className="text-[11px] tabular-nums">{count}</span>}
      {!running && state === "stale" && <span aria-hidden className="size-1.5 rounded-full bg-muted-foreground" />}
    </ToolbarButton>
  );
}
