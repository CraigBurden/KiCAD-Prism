import { useCallback, useEffect, useMemo, useState } from "react";
import { GitCompare, Layers3, Loader2, Plus, Send, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import * as api from "./api";
import type { OrganizationPolicy, RuleCatalogueEntry } from "./types";

type RuleDraft = { enabled: boolean; severity: string; params: Record<string, string> };
type ApprovalDraft = { role: string; domains: string[] };
type PolicyDiff = { path: string; change: string; before?: unknown; after?: unknown };
type InheritancePreview = Awaited<ReturnType<typeof api.previewPolicyInheritance>>;

export function PolicyAuthoringCard() {
    const [catalogue, setCatalogue] = useState<RuleCatalogueEntry[]>([]);
    const [policies, setPolicies] = useState<OrganizationPolicy[]>([]);
    const [selected, setSelected] = useState<OrganizationPolicy | null>(null);
    const [key, setKey] = useState("");
    const [title, setTitle] = useState("");
    const [drafts, setDrafts] = useState<Record<string, RuleDraft>>({});
    const [approvalRole, setApprovalRole] = useState("pcb_design");
    const [approvalDomains, setApprovalDomains] = useState("bare_board");
    const [approvals, setApprovals] = useState<ApprovalDraft[]>([]);
    const [diff, setDiff] = useState<PolicyDiff[]>([]);
    const [preview, setPreview] = useState<InheritancePreview | null>(null);
    const [busy, setBusy] = useState("");
    const [message, setMessage] = useState("");

    const refresh = useCallback(async () => {
        const [rules, rows] = await Promise.all([api.ruleCatalogue(), api.listOrganizationPolicies()]);
        setCatalogue(rules);
        setPolicies(rows);
        if (selected) setSelected(await api.getOrganizationPolicy(selected.policy_key));
    }, [selected?.policy_key]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => { void refresh().catch((error: unknown) => setMessage(error instanceof Error ? error.message : String(error))); }, [refresh]);

    const selectedRules = useMemo(() => catalogue.filter((rule) => drafts[rule.rule_id]?.enabled), [catalogue, drafts]);

    const policyDocument = (extendsReference?: string) => ({
        schema: "prism.release-studio.policy/1",
        title: selected?.title ?? "",
        ...(extendsReference ? { extends: extendsReference } : {}),
        rules: selectedRules.map((rule) => {
            const state = drafts[rule.rule_id];
            const params = Object.fromEntries(
                Object.entries(state.params)
                    .filter(([, value]) => value !== "")
                    .map(([name, value]) => {
                        const kind = rule.param_schema[name];
                        return [
                            name,
                            kind === "int"
                                ? Number(value)
                                : kind === "list[str]"
                                    ? value.split(",").map((item) => item.trim()).filter(Boolean)
                                    : value,
                        ];
                    }),
            );
            return { id: rule.rule_id, severity: state.severity, params };
        }),
        required_approvals: approvals,
    });

    const run = async (name: string, action: () => Promise<void>) => {
        setBusy(name); setMessage("");
        try { await action(); await refresh(); } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); } finally { setBusy(""); }
    };

    const createPolicy = () => run("policy", async () => {
        const created = await api.createOrganizationPolicy(key, title);
        setSelected(created); setKey(""); setTitle(""); setMessage("Policy created.");
    });

    const createDraft = () => run("draft", async () => {
        if (!selected) return;
        await api.createPolicyVersion(selected.policy_key, policyDocument());
        setMessage("Draft version created.");
    });

    const versions = selected?.versions ?? [];
    const newestDraft = versions.find((version) => version.status === "draft");
    const newestPublished = versions.find((version) => version.status === "published");
    return (
        <Card>
            <CardHeader><CardTitle className="text-base">Organization policy authoring</CardTitle></CardHeader>
            <CardContent className="space-y-5">
                <p className="text-sm text-muted-foreground">Admin-only. Rule parameters come from the server catalogue; published versions are content-immutable and project overlays pin them by version.</p>
                <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
                    <div><Label htmlFor="policy-key">Policy key</Label><Input id="policy-key" value={key} onChange={(event) => setKey(event.target.value)} placeholder="manufacturing-standard" /></div>
                    <div><Label htmlFor="policy-title">Title</Label><Input id="policy-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Manufacturing standard" /></div>
                    <Button className="self-end" onClick={createPolicy} disabled={!key || Boolean(busy)}><Plus className="mr-2 h-4 w-4" />Create</Button>
                </div>
                {policies.length > 0 && <div className="flex flex-wrap gap-2">{policies.map((policy) => <Button key={policy.id} size="sm" variant={selected?.id === policy.id ? "default" : "outline"} onClick={() => void api.getOrganizationPolicy(policy.policy_key).then(setSelected)}>{policy.policy_key} <Badge className="ml-2" variant="secondary">v{policy.latest_version ?? 0}</Badge></Button>)}</div>}
                {selected && <>
                    <div className="rounded-md border"><div className="border-b px-4 py-3"><p className="font-medium">{selected.title || selected.policy_key}</p><p className="font-mono text-xs text-muted-foreground">org:{selected.policy_key}@&lt;version&gt;</p></div>
                        <div className="divide-y">{catalogue.map((rule) => {
                            const state = drafts[rule.rule_id] ?? { enabled: false, severity: rule.default_severity, params: {} };
                            return <div key={rule.rule_id} className="space-y-3 px-4 py-3"><label className="flex items-start gap-3"><input type="checkbox" className="mt-1" checked={state.enabled} onChange={(event) => setDrafts((current) => ({ ...current, [rule.rule_id]: { ...state, enabled: event.target.checked } }))} /><span><span className="font-medium">{rule.title}</span><span className="ml-2 font-mono text-xs text-muted-foreground">{rule.rule_id}</span><span className="block text-xs text-muted-foreground">{rule.description || rule.applies_to.join(", ")}</span></span></label>{state.enabled && <div className="grid gap-3 pl-7 md:grid-cols-3"><label className="text-xs">Severity<select className="mt-1 h-9 w-full rounded-md border bg-background px-2" value={state.severity} onChange={(event) => setDrafts((current) => ({ ...current, [rule.rule_id]: { ...state, severity: event.target.value } }))}>{["warning", "failure", "blocker"].map((value) => <option key={value}>{value}</option>)}</select></label>{Object.entries(rule.param_schema).map(([name, kind]) => <label key={name} className="text-xs">{name}<Input className="mt-1" type={kind === "int" ? "number" : "text"} placeholder={kind === "list[str]" ? "comma-separated" : kind} value={state.params[name] ?? ""} onChange={(event) => setDrafts((current) => ({ ...current, [rule.rule_id]: { ...state, params: { ...state.params, [name]: event.target.value } } }))} /></label>)}</div>}</div>;
                        })}</div>
                    </div>
                    <div className="space-y-3 rounded-md border p-4">
                        <div><p className="font-medium">Required approvals</p><p className="text-xs text-muted-foreground">Each approval binds a role to one or more governed domains.</p></div>
                        <div className="grid gap-2 md:grid-cols-[1fr_2fr_auto]">
                            <Input aria-label="Approval role" value={approvalRole} onChange={(event) => setApprovalRole(event.target.value)} placeholder="manufacturing" />
                            <Input aria-label="Approval domains" value={approvalDomains} onChange={(event) => setApprovalDomains(event.target.value)} placeholder="bare_board, assembly" />
                            <Button type="button" variant="outline" onClick={() => {
                                const domains = approvalDomains.split(",").map((item) => item.trim()).filter(Boolean);
                                if (approvalRole.trim() && domains.length) {
                                    setApprovals((current) => [...current, { role: approvalRole.trim(), domains }]);
                                }
                            }}><Plus className="mr-2 h-4 w-4" />Add</Button>
                        </div>
                        {approvals.map((approval, index) => <div key={`${approval.role}-${index}`} className="flex items-center gap-2 rounded bg-muted/40 px-3 py-2 text-xs"><span className="font-mono">{approval.role}</span><span className="text-muted-foreground">→ {approval.domains.join(", ")}</span><Button type="button" size="sm" variant="ghost" className="ml-auto h-6" onClick={() => setApprovals((current) => current.filter((_, itemIndex) => itemIndex !== index))}><Trash2 className="h-3 w-3" /></Button></div>)}
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Button onClick={createDraft} disabled={(!selectedRules.length && !approvals.length) || Boolean(busy)}>{busy === "draft" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}Create draft</Button>
                        {newestDraft && <Button variant="outline" onClick={() => run("publish", async () => { await api.publishPolicyVersion(selected.policy_key, newestDraft.version); setMessage(`Published v${newestDraft.version}.`); })}><Send className="mr-2 h-4 w-4" />Publish v{newestDraft.version}</Button>}
                        {newestPublished && <Button variant="outline" onClick={() => run("preview", async () => { const result = await api.previewPolicyInheritance(policyDocument(`org:${selected.policy_key}@${newestPublished.version}`)); setPreview(result); setMessage(`Resolved ${result.rules.length} rule(s) with binding ${result.policy_binding_digest.slice(0, 12)}….`); })}><Layers3 className="mr-2 h-4 w-4" />Preview inheritance</Button>}
                        {versions.length > 1 && <Button variant="ghost" onClick={() => run("diff", async () => { const result = await api.policyVersionDiff(selected.policy_key, versions[1].version, versions[0].version); setDiff(result.changes); setMessage(`${result.changes.length} change(s) between v${versions[1].version} and v${versions[0].version}.`); })}><GitCompare className="mr-2 h-4 w-4" />Compare latest</Button>}
                    </div>
                    {diff.length > 0 && <div className="rounded-md border"><div className="border-b px-3 py-2 text-sm font-medium">Version changes</div>{diff.map((change, index) => <div key={`${change.path}-${index}`} className="grid grid-cols-[1fr_auto] gap-3 border-b px-3 py-2 text-xs last:border-0"><code>{change.path}</code><Badge variant="outline">{change.change}</Badge></div>)}</div>}
                    {preview && <div className="rounded-md border p-3 text-xs"><p className="font-medium">Resolved inheritance</p><p className="mt-1 font-mono break-all text-muted-foreground">{preview.policy_binding_digest}</p><div className="mt-2 flex flex-wrap gap-2">{preview.links.map((link) => <Badge key={link.source} variant="outline">{link.source}</Badge>)}<Badge variant="secondary">{preview.rules.length} rules</Badge><Badge variant="secondary">{preview.required_approvals.length} approvals</Badge></div></div>}
                </>}
                {message && <p className="text-sm text-muted-foreground">{message}</p>}
            </CardContent>
        </Card>
    );
}
