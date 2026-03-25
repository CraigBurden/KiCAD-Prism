import { useEffect, useState } from "react";

import { readApiError } from "@/lib/api";

interface AuthCallbackPageProps {
  onLoginSuccess: () => void;
}

export function AuthCallbackPage({ onLoginSuccess }: AuthCallbackPageProps) {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get("code");
      const oauthError = urlParams.get("error");

      if (oauthError) {
        setError(`Authentication failed: ${oauthError}`);
        return;
      }

      if (!code) {
        setError("No authorization code received from Google.");
        return;
      }

      try {
        const redirectUri = `${window.location.origin}/auth/callback`;
        const response = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ code, redirectUri }),
        });

        if (!response.ok) {
          throw new Error(await readApiError(response, "Authentication failed"));
        }

        window.history.replaceState(null, "", "/");
        onLoginSuccess();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Authentication failed");
      }
    };

    void run();
  }, [onLoginSuccess]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-md rounded-xl border bg-card p-8 text-center">
        <h2 className="mb-3 text-xl font-semibold text-foreground">Authenticating...</h2>
        {error ? (
          <>
            <p className="mb-4 text-sm text-destructive">{error}</p>
            <button
              className="rounded-md border px-4 py-2 text-sm text-foreground"
              onClick={() => {
                window.history.replaceState(null, "", "/");
                window.location.reload();
              }}
            >
              Return to Login
            </button>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Exchanging Google authorization code.</p>
        )}
      </div>
    </div>
  );
}
