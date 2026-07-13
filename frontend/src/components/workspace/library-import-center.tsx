import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, FolderSearch, LoaderCircle, RefreshCw, X } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fetchJson } from "@/lib/api";
import { canWriteCatalog } from "@/lib/roles";
import type { User } from "@/types/auth";
import type { ProjectComponentImportProposal, ProjectComponentImportSession } from "@/types/catalog";
import type { Project } from "@/types/project";
import { cn } from "@/lib/utils";
import { LibraryImportRemediationDialog, type ProposalRemediation } from "./library-import-remediation-dialog";

interface LibraryImportCenterProps {
  projects: Project[];
  user: User | null;
  initialSessionId?: string;
}

const sessionStatusLabel: Record<ProjectComponentImportSession["status"], string> = {
  queued: "Queued",
  scanning: "Scanning",
  staged: "Ready for review",
  failed: "Failed",
};

export function LibraryImportCenter({ projects, user, initialSessionId }: LibraryImportCenterProps) {
  const [sessions, setSessions] = useState<ProjectComponentImportSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState(initialSessionId || "");
  const [proposals, setProposals] = useState<ProjectComponentImportProposal[]>([]);
  const [projectId, setProjectId] = useState(projects[0]?.id || "");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [proposalActionId, setProposalActionId] = useState("");
  const [remediationProposal, setRemediationProposal] = useState<ProjectComponentImportProposal | null>(null);
  const canWrite = canWriteCatalog(user?.role);

  const selectedSession = useMemo(
    () => sessions.find((session) => session.id === selectedSessionId),
    [selectedSessionId, sessions]
  );

  const loadSessions = useCallback(async () => {
    const response = await fetchJson<{ items: ProjectComponentImportSession[] }>("/api/catalog/import-sessions");
    setSessions(response.items);
    setSelectedSessionId((current) => current || initialSessionId || response.items[0]?.id || "");
  }, [initialSessionId]);

  const loadProposals = useCallback(async (sessionId: string) => {
    if (!sessionId) {
      setProposals([]);
      return;
    }
    const response = await fetchJson<{ items: ProjectComponentImportProposal[] }>(
      `/api/catalog/import-sessions/${sessionId}/proposals`
    );
    setProposals(response.items);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        await loadSessions();
      } catch (error) {
        if (!cancelled) toast.error(error instanceof Error ? error.message : "Failed to load import sessions");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [loadSessions]);

  useEffect(() => {
    void loadProposals(selectedSessionId).catch((error) => {
      toast.error(error instanceof Error ? error.message : "Failed to load import proposals");
    });
  }, [loadProposals, selectedSessionId]);

  useEffect(() => {
    if (!sessions.some((session) => session.status === "queued" || session.status === "scanning")) return;
    const timer = window.setInterval(() => {
      void loadSessions().then(() => loadProposals(selectedSessionId));
    }, 2000);
    return () => window.clearInterval(timer);
  }, [loadProposals, loadSessions, selectedSessionId, sessions]);

  const createSession = async (scope: "project" | "all-projects") => {
    if (scope === "project" && !projectId) return;
    setCreating(true);
    try {
      const session = await fetchJson<ProjectComponentImportSession>("/api/catalog/import-sessions/projects", {
        method: "POST",
        body: JSON.stringify({ scope, project_id: scope === "project" ? projectId : "" }),
      });
      await loadSessions();
      setSelectedSessionId(session.id);
      toast.success(scope === "project" ? "Project component scan queued" : "All-project component scan queued");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to queue project import");
    } finally {
      setCreating(false);
    }
  };

  const resolveProposal = async (proposal: ProjectComponentImportProposal, action: "accept" | "reject", remediation?: ProposalRemediation) => {
    setProposalActionId(proposal.id);
    try {
      await fetchJson(`/api/catalog/import-proposals/${proposal.id}/${action}`, {
        method: "POST",
        body: action === "accept" ? JSON.stringify(remediation) : undefined,
      });
      await Promise.all([loadSessions(), loadProposals(proposal.session_id)]);
      toast.success(action === "accept" ? `${proposal.reference} imported as a draft revision` : `${proposal.reference} rejected`);
      if (action === "accept") setRemediationProposal(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : `Failed to ${action} proposal`);
    } finally {
      setProposalActionId("");
    }
  };

  if (loading) {
    return <div className="flex h-full items-center justify-center text-sm text-muted-foreground"><LoaderCircle className="mr-2 h-4 w-4 animate-spin" />Loading imports…</div>;
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="border-b p-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Import Center</h2>
            <p className="mt-1 text-sm text-muted-foreground">Extract, deduplicate, remediate, and review components from imported Prism projects.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={projectId} onValueChange={setProjectId} disabled={!canWrite || creating}>
              <SelectTrigger className="w-64"><SelectValue placeholder="Select a project" /></SelectTrigger>
              <SelectContent>
                {projects.map((project) => <SelectItem key={project.id} value={project.id}>{project.display_name || project.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => void createSession("project")} disabled={!canWrite || !projectId || creating}>Import project</Button>
            <Button onClick={() => void createSession("all-projects")} disabled={!canWrite || creating}>Import all projects</Button>
          </div>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-[18rem_minmax(0,1fr)]">
        <aside className="min-h-0 overflow-y-auto border-r p-2">
          <div className="mb-2 flex items-center justify-between px-2 py-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Import sessions</span>
            <Button variant="ghost" size="icon-sm" aria-label="Refresh imports" onClick={() => void loadSessions()}><RefreshCw className="h-3.5 w-3.5" /></Button>
          </div>
          {sessions.length === 0 ? (
            <p className="p-3 text-sm text-muted-foreground">No project imports yet.</p>
          ) : sessions.map((session) => (
            <button
              type="button"
              key={session.id}
              onClick={() => setSelectedSessionId(session.id)}
              className={cn("mb-1 w-full border p-3 text-left transition-colors hover:bg-muted/40", selectedSessionId === session.id && "border-primary bg-primary/5")}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-medium">{session.scope === "all-projects" ? "All projects" : projects.find((project) => project.id === session.project_id)?.display_name || projects.find((project) => project.id === session.project_id)?.name || session.project_id}</span>
                {(session.status === "queued" || session.status === "scanning") && <LoaderCircle className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
              </div>
              <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                <span>{sessionStatusLabel[session.status]}</span><span>{session.proposal_count} candidates</span>
              </div>
            </button>
          ))}
        </aside>

        <section className="min-h-0 overflow-y-auto p-4">
          {!selectedSession ? (
            <div className="flex h-full flex-col items-center justify-center text-center text-muted-foreground"><FolderSearch className="mb-3 h-8 w-8" /><p>Select or create an import session.</p></div>
          ) : selectedSession.status === "failed" ? (
            <div className="border border-destructive/40 bg-destructive/5 p-4"><h3 className="font-medium text-destructive">Import scan failed</h3><p className="mt-2 text-sm text-muted-foreground">{selectedSession.error_message}</p></div>
          ) : proposals.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">{selectedSession.status === "staged" ? "No components were discovered." : "Scanning captured project revisions…"}</div>
          ) : (
            <div className="space-y-2">
              {proposals.map((proposal) => {
                const metadata = proposal.metadata as { value?: string; manufacturer?: string; manufacturer_part_number?: string; footprint?: string; references?: string[] };
                const blocking = proposal.findings.filter((finding) => finding.severity === "error").length;
                return (
                  <article key={proposal.id} className="border bg-card p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2"><h3 className="font-mono text-sm font-semibold">{(metadata.references || [proposal.reference]).join(", ")}</h3><Badge variant="outline">{proposal.status}</Badge>{blocking > 0 && <Badge variant="destructive">{blocking} blocking</Badge>}</div>
                        <p className="mt-2 text-sm">{metadata.value || "No value"} · {metadata.manufacturer_part_number || "No MPN"}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{metadata.manufacturer || "No manufacturer"} · {metadata.footprint || "No footprint"} · {proposal.assets.length} staged assets · {proposal.provenance.length} usages</p>
                        {proposal.findings.length > 0 && <div className="mt-3 space-y-1">{proposal.findings.map((finding, index) => <p key={`${finding.code}-${index}`} className="flex items-start gap-2 text-xs text-muted-foreground"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{finding.message}</p>)}</div>}
                      </div>
                      {proposal.status === "candidate" && <div className="flex shrink-0 gap-2"><Button size="sm" variant="outline" onClick={() => void resolveProposal(proposal, "reject")} disabled={!canWrite || proposalActionId === proposal.id}><X className="mr-1.5 h-3.5 w-3.5" />Reject</Button><Button size="sm" onClick={() => setRemediationProposal(proposal)} disabled={!canWrite || proposalActionId === proposal.id}>{proposalActionId === proposal.id ? <LoaderCircle className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Check className="mr-1.5 h-3.5 w-3.5" />}Review & accept</Button></div>}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
      <LibraryImportRemediationDialog
        proposal={remediationProposal}
        open={remediationProposal !== null}
        submitting={proposalActionId === remediationProposal?.id}
        onOpenChange={(nextOpen) => { if (!nextOpen && !proposalActionId) setRemediationProposal(null); }}
        onAccept={(remediation) => { if (remediationProposal) void resolveProposal(remediationProposal, "accept", remediation); }}
      />
    </div>
  );
}
