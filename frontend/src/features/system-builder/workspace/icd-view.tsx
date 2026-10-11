import { useCallback, useEffect, useRef, useState } from "react";
import { ExternalLink, FileSpreadsheet, ListTree, Loader2 } from "lucide-react";

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { icdUrl } from "@/lib/systems-api";

import { sessionReads } from "../session/session-reads";
import { useSessionRead } from "../session/use-system-session";
import { FloatingToolbar } from "./floating-toolbar";
import { ToolbarButton } from "./toolbar-button";

/** Narrower than this, the document is laid out at this width and scaled down to fit (D-P2-52). */
const FIT_WIDTH = 960;

/** The app's Inter, for the framed document (a frame does not inherit the page's fonts). */
function interFaces(): string {
  const rules: string[] = [];
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      for (const rule of Array.from(sheet.cssRules)) {
        if (rule instanceof CSSFontFaceRule && rule.style.getPropertyValue("font-family").includes("Inter")) rules.push(rule.cssText);
      }
    } catch {
      // A cross-origin stylesheet: its rules cannot be read, and Inter is not in it.
    }
  }
  return rules.join("\n");
}

/**
 * The live ICD as a workspace view (PLAN M8, M9). The document is read through
 * the API client and shown from `srcDoc` (a framed navigation carries no
 * credentials and some browsers refuse it). Scripts never run in the frame;
 * same-origin lets the page theme it like the app, scale it to fit the width
 * and jump to its sections. Open in a new tab gives the white, printable document.
 */
export function IcdView({ systemId }: { systemId: string }) {
  const icd = useSessionRead(sessionReads.icd());
  // The last ICD stays shown while the next version's is generated; a failure replaces it.
  const state = icd.error ? { html: null, error: icd.error instanceof Error ? icd.error.message : String(icd.error) }
    : icd.data !== undefined ? { html: icd.data, error: null } : null;
  const [sections, setSections] = useState<{ id: string; label: string }[]>([]);
  const frame = useRef<HTMLIFrameElement>(null);

  const fit = useCallback(() => {
    const element = frame.current;
    const root = element?.contentDocument?.documentElement;
    if (!element || !root) return;
    const width = element.clientWidth;
    root.style.setProperty("zoom", width > 0 && width < FIT_WIDTH ? String(width / FIT_WIDTH) : "");
  }, []);

  // Theme the document like the app, then fit it and list its sections.
  const prepare = () => {
    const doc = frame.current?.contentDocument;
    if (!doc) return;
    doc.documentElement.classList.add("prism-embed");
    doc.documentElement.classList.toggle("prism-dark", document.documentElement.classList.contains("dark"));
    const fonts = doc.createElement("style");
    fonts.textContent = interFaces();
    doc.head.appendChild(fonts);
    setSections(Array.from(doc.querySelectorAll("h2[id]")).map((heading) => ({ id: heading.id, label: heading.textContent ?? heading.id })));
    fit();
  };

  useEffect(() => {
    const element = frame.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(fit);
    observer.observe(element);
    return () => observer.disconnect();
  }, [fit, state?.html]);

  const jump = (id: string) => frame.current?.contentDocument?.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <div className="relative size-full">
      {state?.html != null ? (
        <iframe ref={frame} title="Interface control document" srcDoc={state.html} sandbox="allow-same-origin" onLoad={prepare}
          className="size-full border-0 bg-background" />
      ) : state?.error ? (
        <p className="p-6 text-sm text-destructive">{state.error}</p>
      ) : (
        <p className="flex items-center gap-2 p-6 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" aria-hidden /> Generating the ICD…</p>
      )}
      <FloatingToolbar label="ICD" className="absolute right-5 top-3">
        {state && !icd.current && !icd.error && <Loader2 className="mx-1 size-3.5 animate-spin text-muted-foreground" aria-label="Updating" />}
        {sections.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <ToolbarButton title="Sections"><ListTree className="size-4" aria-hidden /></ToolbarButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {sections.map((section) => (
                <DropdownMenuItem key={section.id} onSelect={() => jump(section.id)}>{section.label}</DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        <a href={icdUrl(systemId, "html")} target="_blank" rel="noreferrer" title="Open the printable document" aria-label="Open in a new tab"
          className="flex size-7 items-center justify-center rounded text-muted-foreground hover:bg-accent/60 hover:text-foreground">
          <ExternalLink className="size-4" aria-hidden />
        </a>
        <a href={icdUrl(systemId, "csv")} download title="Download CSV" aria-label="CSV"
          className="flex size-7 items-center justify-center rounded text-muted-foreground hover:bg-accent/60 hover:text-foreground">
          <FileSpreadsheet className="size-4" aria-hidden />
        </a>
      </FloatingToolbar>
    </div>
  );
}
