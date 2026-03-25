import { fetchJson } from "@/lib/api";
import type { AuthConfig, User } from "@/types/auth";

const GOOGLE_SCOPE = "openid https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email";
const AUTH_CALLBACK_PATH = "/auth/callback";

interface LoginRequest {
  code: string;
  redirectUri: string;
}

export function getGoogleAuthRedirectUri() {
  return `${window.location.origin}${AUTH_CALLBACK_PATH}`;
}

export function isAuthCallbackPath() {
  return window.location.pathname === AUTH_CALLBACK_PATH;
}

export function buildGoogleAuthUrl(googleClientId: string) {
  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.searchParams.set("client_id", googleClientId);
  authUrl.searchParams.set("redirect_uri", getGoogleAuthRedirectUri());
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", GOOGLE_SCOPE);
  return authUrl.toString();
}

export function fetchAuthConfig(signal?: AbortSignal) {
  return fetchJson<AuthConfig>(
    "/api/auth/config",
    signal ? { signal } : undefined,
    "Failed to fetch auth config"
  );
}

export function fetchCurrentUser(signal?: AbortSignal) {
  return fetchJson<User>(
    "/api/auth/me",
    signal ? { signal } : undefined,
    "Failed to fetch current user"
  );
}

export function exchangeGoogleAuthCode(code: string) {
  const payload: LoginRequest = {
    code,
    redirectUri: getGoogleAuthRedirectUri(),
  };

  return fetchJson<User>(
    "/api/auth/login",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    "Authentication failed"
  );
}
