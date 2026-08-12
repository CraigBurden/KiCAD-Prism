import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Download, FileCheck2, ShieldCheck } from "lucide-react";
import { useParams } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type PublicRelease = {
    release: {
        release_label: string;
        document_number: string;
        revision: string;
        commit_sha: string;
        variant: string;
        manifest_digest: string;
        dossier_digest: string;
        attestation_digest: string;
        signing_key_id: string;
        created_at: string;
    };
    members: Array<{
        path: string;
        member_kind: string;
        media_type: string;
        size_bytes: number;
        released_digest: string;
        domains: string[];
    }>;
    verification: { ok: boolean; checks: Array<{ ok: boolean; message: string }> };
    expires_at: string | null;
};

const short = (value: string) => value.length > 18 ? `${value.slice(0, 14)}…` : value;

export function PublicReleaseView() {
    const { token = "" } = useParams<{ token: string }>();
    const [data, setData] = useState<PublicRelease | null>(null);
    const [error, setError] = useState("");
    const apiBase = useMemo(() => `/api/release-view/${encodeURIComponent(token)}`, [token]);

    useEffect(() => {
        const controller = new AbortController();
        void fetch(apiBase, { signal: controller.signal, credentials: "omit" })
            .then(async (response) => {
                if (!response.ok) throw new Error(response.status === 404
                    ? "This release link is invalid, expired, or revoked."
                    : `The release could not be loaded (${response.status}).`);
                return response.json() as Promise<PublicRelease>;
            })
            .then(setData)
            .catch((cause: unknown) => {
                if (!controller.signal.aborted) {
                    setError(cause instanceof Error ? cause.message : String(cause));
                }
            });
        return () => controller.abort();
    }, [apiBase]);

    if (error) return <main className="grid min-h-screen place-items-center bg-background p-6 text-foreground"><Card className="max-w-lg"><CardHeader><CardTitle>Release unavailable</CardTitle></CardHeader><CardContent className="text-sm text-muted-foreground">{error}</CardContent></Card></main>;
    if (!data) return <main className="grid min-h-screen place-items-center bg-background text-sm text-muted-foreground">Verifying shared release…</main>;

    const release = data.release;
    return (
        <main className="min-h-screen bg-background px-5 py-10 text-foreground">
            <div className="mx-auto max-w-5xl space-y-6">
                <header className="flex flex-wrap items-start justify-between gap-4 border-b pb-6">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">Prism Release Studio</p>
                        <h1 className="mt-2 text-3xl font-semibold tracking-tight">{release.release_label}</h1>
                        <p className="mt-1 text-sm text-muted-foreground">{release.document_number || "No document number"} · revision {release.revision || "—"}</p>
                    </div>
                    <Badge variant={data.verification.ok ? "secondary" : "destructive"} className="gap-1.5">
                        {data.verification.ok ? <ShieldCheck className="h-3.5 w-3.5" /> : <FileCheck2 className="h-3.5 w-3.5" />}
                        {data.verification.ok ? "Signature verified" : "Verification failed"}
                    </Badge>
                </header>

                <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {[["Commit", short(release.commit_sha)], ["Variant", release.variant || "default"], ["Signing key", short(release.signing_key_id)], ["Members", String(data.members.length)]].map(([label, value]) => <Card key={label}><CardContent className="p-4"><p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-1 font-mono text-sm">{value}</p></CardContent></Card>)}
                </section>

                <Card>
                    <CardHeader className="flex-row items-center justify-between"><CardTitle className="text-base">Released files</CardTitle><Button asChild size="sm"><a href={`${apiBase}/archive`}><Download className="mr-2 h-4 w-4" />Download verified archive</a></Button></CardHeader>
                    <CardContent className="divide-y p-0">
                        {data.members.map((member) => <a key={member.path} href={`${apiBase}/members/${member.path.split("/").map(encodeURIComponent).join("/")}`} className="flex items-center justify-between gap-4 px-6 py-3 text-sm hover:bg-muted/60"><span><span className="font-medium">{member.path}</span><span className="ml-2 text-xs text-muted-foreground">{member.domains.join(", ")}</span></span><span className="font-mono text-xs text-muted-foreground">{short(member.released_digest)}</span></a>)}
                    </CardContent>
                </Card>

                <Card><CardHeader><CardTitle className="text-base">Verification chain</CardTitle></CardHeader><CardContent className="space-y-2">{data.verification.checks.map((check, index) => <div key={`${index}-${check.message}`} className="flex gap-2 text-sm"><CheckCircle2 className={`mt-0.5 h-4 w-4 shrink-0 ${check.ok ? "text-emerald-500" : "text-destructive"}`} /><span>{check.message}</span></div>)}</CardContent></Card>
            </div>
        </main>
    );
}

export default PublicReleaseView;
