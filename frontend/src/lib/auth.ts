import { fetchJson } from "@/lib/api";
import type { AuthConfig, User } from "@/types/auth";

const AUTH_CALLBACK_PATH = "/auth/callback";
const AUTH_STATE_KEY = "kicad_prism_oidc_state";
const AUTH_NONCE_KEY = "kicad_prism_oidc_nonce";

interface LoginRequest {
  code: string;
  redirectUri: string;
  nonce?: string;
}

export function getOidcAuthRedirectUri() {
  return `${window.location.origin}${AUTH_CALLBACK_PATH}`;
}

export function isAuthCallbackPath() {
  return window.location.pathname === AUTH_CALLBACK_PATH;
}

function createState() {
  const state = createSecureRandomToken();
  window.sessionStorage.setItem(AUTH_STATE_KEY, state);
  return state;
}

function createNonce() {
  const nonce = createSecureRandomToken();
  window.sessionStorage.setItem(AUTH_NONCE_KEY, nonce);
  return nonce;
}

function createSecureRandomToken() {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }

  if (!window.crypto?.getRandomValues) {
    throw new Error("Secure browser crypto is required for OIDC login.");
  }

  const bytes = new Uint8Array(32);
  window.crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function consumeExpectedAuthState() {
  const state = window.sessionStorage.getItem(AUTH_STATE_KEY);
  window.sessionStorage.removeItem(AUTH_STATE_KEY);
  return state;
}

export function consumeExpectedAuthNonce() {
  const nonce = window.sessionStorage.getItem(AUTH_NONCE_KEY);
  window.sessionStorage.removeItem(AUTH_NONCE_KEY);
  return nonce;
}

export function buildOidcAuthUrl(config: AuthConfig) {
  const authUrl = new URL(config.oidc_authorization_endpoint);
  authUrl.searchParams.set("client_id", config.oidc_client_id);
  authUrl.searchParams.set("redirect_uri", getOidcAuthRedirectUri());
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", config.oidc_scopes || "openid profile email");
  authUrl.searchParams.set("state", createState());
  authUrl.searchParams.set("nonce", createNonce());
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

export function exchangeOidcAuthCode(code: string, nonce: string | null) {
  const payload: LoginRequest = {
    code,
    redirectUri: getOidcAuthRedirectUri(),
  };
  if (nonce) {
    payload.nonce = nonce;
  }

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
