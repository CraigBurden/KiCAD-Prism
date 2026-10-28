import { useState } from "react";
import { FileSearch, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getCatalogHealth } from "./catalog-client";

/**
 * Admin-only, on-demand disk check (`GET /api/catalog/health?check_files=true`):
 * counts active components whose released revision links an asset file that is
 * no longer on disk. It stats every released file, so it runs only when asked.
 */
export function LibraryCatalogFileCheck() {
  const [checking, setChecking] = useState(false);
  const [missing, setMissing] = useState<number | null>(null);

  const runCheck = () => {
    setChecking(true);
    void getCatalogHealth({ checkFiles: true })
      .then((health) => setMissing(health.released_assets_missing_on_disk ?? 0))
      .catch((reason: unknown) => toast.error(reason instanceof Error ? reason.message : String(reason)))
      .finally(() => setChecking(false));
  };

  return (
    <div className="flex items-center gap-2">
      {missing === null ? null : missing > 0 ? (
        <Badge variant="destructive" title="Released components with a file missing on disk">
          {missing.toLocaleString()} missing
        </Badge>
      ) : (
        <Badge variant="success" title="Every released file is on disk">Files OK</Badge>
      )}
      <Button size="icon-sm" variant="outline" disabled={checking} onClick={runCheck} aria-label="Check released files" title="Check released files">
        {checking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileSearch className="h-3.5 w-3.5" />}
      </Button>
    </div>
  );
}
