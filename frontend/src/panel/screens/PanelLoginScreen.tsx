import { useState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { startAgentSignIn, type AgentHandoff } from "@/lib/kicad-agent-signin";

interface PanelLoginScreenProps {
  onLogin: () => void;
  isLoading: boolean;
  error: string | null;
  sessionReady: boolean;
}

export function PanelLoginScreen({
  onLogin,
  isLoading,
  error,
  sessionReady,
}: PanelLoginScreenProps) {
  // Signing in with the sign-in the plugin already has. Purely an alternative to the
  // button above: it fails to the same KiCad flow, so nothing depends on it working.
  const [agentBusy, setAgentBusy] = useState(false);
  const [agentError, setAgentError] = useState<string | null>(null);
  // Set once the agent has answered. Holding it here is what makes the confirmation
  // real: the URL exists but has not been followed, so no session exists yet.
  const [handoff, setHandoff] = useState<AgentHandoff | null>(null);

  const askAgent = async () => {
    setAgentBusy(true);
    setAgentError(null);
    try {
      setHandoff(
        await startAgentSignIn(window.location.pathname + window.location.search),
      );
    } catch (err) {
      setAgentError(
        err instanceof Error ? err.message : "Couldn't use the plugin's sign-in.",
      );
    } finally {
      setAgentBusy(false);
    }
  };

  const confirmAgentSignIn = () => {
    if (!handoff) return;
    setAgentBusy(true);
    // A full navigation, so this browser keeps the session cookie the handoff URL
    // sets, then comes back here authenticated.
    window.location.href = handoff.nonceUrl;
  };

  const cancelAgentSignIn = () => {
    // The URL is simply dropped. It expires on its own and was never followed, so
    // nothing was signed in and there is nothing to undo.
    setHandoff(null);
  };

  return (
    <div className="flex min-h-[calc(100vh-3rem)] flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-5">
        {/* Branding */}
        <div className="space-y-1 text-center">
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary">
            KiCAD Prism
          </p>
          <h1 className="text-xl font-semibold tracking-tight">
            Remote Library
          </h1>
          <p className="text-xs text-muted-foreground">
            Search and place components from the Prism catalog directly into
            KiCad.
          </p>
        </div>

        {/* Login Card */}
        <Card className="border-primary/30 ring-1 ring-primary/20">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-sm">Sign In</CardTitle>
            <CardDescription className="text-xs">
              {sessionReady
                ? "Authenticate via KiCad to access the component catalog."
                : "Waiting for KiCad to establish a session…"}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-3 pb-5">
            {handoff ? (
              /* The account is named rather than assumed: the plugin may be signed in
                 as someone other than whoever is at the keyboard, and silently using
                 that account would be worse than a click. Nothing is signed in until
                 Continue is pressed. */
              <div className="space-y-3">
                <div className="rounded border bg-muted/20 px-3 py-2.5">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Signing in as
                  </p>
                  <p className="mt-0.5 break-all text-xs font-medium">{handoff.email}</p>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={cancelAgentSignIn}
                    disabled={agentBusy}
                  >
                    Cancel
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={confirmAgentSignIn}
                    disabled={agentBusy}
                  >
                    {agentBusy ? (
                      <>
                        <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                        Signing in…
                      </>
                    ) : (
                      "Continue"
                    )}
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <Button
                  className="w-full"
                  onClick={onLogin}
                  disabled={isLoading || !sessionReady}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                      Authenticating…
                    </>
                  ) : (
                    "Sign In"
                  )}
                </Button>

                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                  <span className="h-px flex-1 bg-border" />
                  <span>or</span>
                  <span className="h-px flex-1 bg-border" />
                </div>

                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => void askAgent()}
                  disabled={agentBusy || isLoading}
                >
                  {agentBusy ? (
                    <>
                      <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                      Checking…
                    </>
                  ) : (
                    "Use the plugin's sign-in"
                  )}
                </Button>
              </>
            )}

            {agentError && (
              <div className="rounded border border-destructive/30 bg-destructive/10 px-3 py-2 text-[11px] text-destructive">
                {agentError}
              </div>
            )}

            {!sessionReady && !handoff && (
              <div className="flex items-center justify-center gap-2 rounded border bg-muted/20 px-3 py-2 text-[11px] text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>Waiting for KiCad session…</span>
              </div>
            )}

            {error && (
              <div className="rounded border border-destructive/30 bg-destructive/10 px-3 py-2 text-[11px] text-destructive">
                {error}
              </div>
            )}
          </CardContent>
        </Card>

        <p className="text-center text-[10px] text-muted-foreground">
          Authentication is handled through KiCad's system browser.
        </p>
      </div>
    </div>
  );
}
