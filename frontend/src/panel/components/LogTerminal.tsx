import { useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";

interface LogTerminalProps {
  entries: string[];
  onClear: () => void;
}

export function LogTerminal({ entries, onClear }: LogTerminalProps) {
  const preRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    if (preRef.current) {
      preRef.current.scrollTop = preRef.current.scrollHeight;
    }
  }, [entries]);

  return (
    <section className="mt-4 overflow-hidden rounded-lg border border-border/50 bg-[hsl(222,60%,5%)]">
      <div className="flex items-center justify-between border-b border-border/40 px-3 py-2">
        <h2 className="text-xs font-semibold text-muted-foreground">
          Transfer Log
        </h2>
        <Button
          variant="ghost"
          size="xs"
          onClick={onClear}
          className="text-muted-foreground"
        >
          Clear
        </Button>
      </div>
      <pre
        ref={preRef}
        className="max-h-40 min-h-[5rem] overflow-auto whitespace-pre-wrap px-3 py-2 font-mono text-[11px] leading-relaxed text-muted-foreground/80"
      >
        {entries.length === 0
          ? "No transfers yet."
          : entries.join("\n")}
      </pre>
    </section>
  );
}
