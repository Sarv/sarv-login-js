/**
 * The authorization-code + PKCE flow, split so the decisions are testable.
 *
 * `buildAuthorizeUrl` and `readCallback` are pure functions of their inputs —
 * no storage, no navigation, no clock. The side effects (sessionStorage, the
 * redirect, fetch) live in `SarvLoginClient`, at the edge, where a test can
 * hand in a fake store instead of a real one.
 */
import { deriveChallenge, randomState, randomVerifier } from "./pkce.js";
import type {
  SarvCallbackError,
  SarvCallbackResult,
  SarvLoginConfig,
  SarvTokenResponse,
} from "./types.js";

export const DEFAULT_OAUTH_URL = "https://oauth.sarv.com";
export const DEFAULT_SCOPES = ["openid", "email", "profile"];

/** sessionStorage keys. The names match the 1.x browser SDK on purpose, so a
 *  page mid-flow when the bundle is swapped still finds its verifier. */
export const VERIFIER_KEY = "sarv_code_verifier";
export const STATE_KEY = "sarv_oauth_state";

/** Parameters this SDK owns. A caller's `extraParams` may not set them: quietly
 *  letting one through would either break PKCE or, worse, disable the CSRF
 *  check while the flow still appeared to work. */
const RESERVED_PARAMS = new Set([
  "response_type",
  "client_id",
  "redirect_uri",
  "scope",
  "state",
  "code_challenge",
  "code_challenge_method",
]);

/** The minimum a session-storage-shaped thing has to do. */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface ResolvedConfig extends Required<Omit<SarvLoginConfig, "extraParams">> {
  extraParams: Record<string, string>;
}

/** Fills in defaults and fails loudly on the two values that have none. */
export function resolveConfig(config: SarvLoginConfig): ResolvedConfig {
  if (!config?.clientId) throw new Error("Sarv login: `clientId` is required.");
  if (!config?.redirectUri) throw new Error("Sarv login: `redirectUri` is required.");
  for (const key of Object.keys(config.extraParams ?? {})) {
    if (RESERVED_PARAMS.has(key)) {
      throw new Error(
        `Sarv login: \`extraParams.${key}\` is set by the SDK and cannot be overridden.`
      );
    }
  }
  return {
    clientId: config.clientId,
    redirectUri: config.redirectUri,
    scopes: config.scopes?.length ? config.scopes : DEFAULT_SCOPES,
    // Trailing slash trimmed so `oauthUrl` composes the same either way.
    oauthUrl: (config.oauthUrl ?? DEFAULT_OAUTH_URL).replace(/\/+$/, ""),
    extraParams: config.extraParams ?? {},
  };
}

/**
 * The authorization request URL.
 *
 * `state` and `codeChallenge` are arguments rather than generated inside,
 * because the caller has to persist the verifier that matches the challenge —
 * generating either one here would hide half a pair inside a pure function.
 */
export function buildAuthorizeUrl(
  config: ResolvedConfig,
  state: string,
  codeChallenge: string
): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    scope: config.scopes.join(" "),
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    ...config.extraParams,
  });
  return `${config.oauthUrl}/api/oauth/authorize?${params.toString()}`;
}

/**
 * Reads the redirect back from Sarv.
 *
 * Returns a discriminated result rather than throwing: an error here is
 * usually the user declining consent, which is an outcome to render, not an
 * exception to catch. `state` is compared against the stored value before the
 * code is handed back — a callback that arrives without a matching state is a
 * forged one, and the code in it must not be redeemed.
 */
export function readCallback(
  search: string,
  storedState: string | null,
  storedVerifier: string | null,
  redirectUri: string
): SarvCallbackResult | SarvCallbackError {
  const params = new URLSearchParams(search);
  const error = params.get("error");
  if (error) {
    return { error, error_description: params.get("error_description") ?? undefined };
  }
  const code = params.get("code");
  const state = params.get("state");
  if (!code) {
    return { error: "no_code", error_description: "No authorization code in the callback URL." };
  }
  if (!storedState || state !== storedState) {
    return {
      error: "state_mismatch",
      error_description:
        "The callback's state does not match the value stored when the flow started. " +
        "The authorization code was NOT used.",
    };
  }
  if (!storedVerifier) {
    return {
      error: "missing_verifier",
      error_description:
        "No PKCE verifier for this callback. It is stored in sessionStorage, so this " +
        "happens when the flow starts in one tab and finishes in another.",
    };
  }
  return { code, state, codeVerifier: storedVerifier, redirectUri };
}

/** True when a result from `readCallback` / `handleCallback` is the error shape. */
export function isCallbackError(
  result: SarvCallbackResult | SarvCallbackError | null
): result is SarvCallbackError {
  return !!result && "error" in result;
}

/**
 * The flow with its side effects attached: storage, navigation, network.
 *
 * One class rather than module-level state, so two clients (two different
 * client ids on one page — a rare but real thing in a console) cannot overwrite
 * each other's config. The 1.x `SarvAuth.init()` global is built on top of this
 * in `compat.ts`.
 */
export class SarvLoginClient {
  readonly config: ResolvedConfig;
  private readonly store: KeyValueStore;

  constructor(config: SarvLoginConfig, store?: KeyValueStore) {
    this.config = resolveConfig(config);
    // Resolved once at construction: in a non-browser environment (SSR, a
    // test) there is no sessionStorage, and the failure should be a clear
    // message from the method that needed it rather than a ReferenceError.
    this.store = store ?? memoryOrSession();
  }

  /** Mints a verifier and state, stores them, and returns where to go next. */
  async createAuthorizeUrl(): Promise<string> {
    const verifier = randomVerifier();
    const state = randomState();
    const challenge = await deriveChallenge(verifier);
    // Stored BEFORE the URL is handed out: if the caller navigates the instant
    // it resolves, the verifier has to already be there.
    this.store.setItem(VERIFIER_KEY, verifier);
    this.store.setItem(STATE_KEY, state);
    return buildAuthorizeUrl(this.config, state, challenge);
  }

  /**
   * Starts the flow by navigating the current tab.
   *
   * A full-page redirect rather than a popup: popups are blocked unless the
   * click that opened them is trusted, they break the back button, and on iOS
   * they are a second browser context that may not share the session.
   */
  async login(): Promise<void> {
    const url = await this.createAuthorizeUrl();
    globalThis.location?.assign(url);
  }

  /** Reads the callback in the current URL and clears the one-time values. */
  handleCallback(search?: string): SarvCallbackResult | SarvCallbackError {
    const query = search ?? globalThis.location?.search ?? "";
    const result = readCallback(
      query,
      this.store.getItem(STATE_KEY),
      this.store.getItem(VERIFIER_KEY),
      this.config.redirectUri
    );
    // Cleared whatever the outcome. The verifier is single-use by definition,
    // and leaving it behind is what makes a stale one get paired with a fresh
    // code later.
    this.store.removeItem(STATE_KEY);
    this.store.removeItem(VERIFIER_KEY);
    return result;
  }

  /**
   * Exchanges the code for tokens FROM THE BROWSER.
   *
   * READ THIS BEFORE USING IT. The default and recommended path is to post the
   * code and verifier to your own backend and exchange there, because a token
   * held in a browser is readable by any script on the page — including one
   * injected through a dependency — and because refresh tokens ROTATE on this
   * server: replaying a used one revokes the whole session. That single-flight
   * discipline is far easier to honour in one backend than across tabs.
   *
   * It exists because a static SPA with no backend has no other option, and
   * PKCE without a client secret is exactly the case the spec designed for. If
   * you use it, keep the tokens in memory, never in localStorage.
   */
  async exchangeCode(result: SarvCallbackResult): Promise<SarvTokenResponse> {
    const response = await fetch(`${this.config.oauthUrl}/api/oauth/token`, {
      method: "POST",
      // JSON, not form-encoded: this server's token endpoint takes a JSON body.
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        grant_type: "authorization_code",
        code: result.code,
        redirect_uri: result.redirectUri,
        code_verifier: result.codeVerifier,
        client_id: this.config.clientId,
      }),
    });
    if (!response.ok) {
      // The body is read as text first: an error page from a proxy is not JSON,
      // and "Unexpected token <" would hide the actual status.
      const detail = await response.text().catch(() => "");
      throw new Error(
        `Sarv login: token exchange failed (${response.status}). ${detail.slice(0, 300)}`
      );
    }
    return (await response.json()) as SarvTokenResponse;
  }

  /** The OIDC userinfo endpoint, for the profile behind an access token. */
  async fetchUser(accessToken: string): Promise<Record<string, unknown>> {
    const response = await fetch(`${this.config.oauthUrl}/api/oauth/userinfo`, {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) {
      throw new Error(`Sarv login: userinfo failed (${response.status}).`);
    }
    return (await response.json()) as Record<string, unknown>;
  }
}

/** sessionStorage when there is one, an in-memory map when there is not.
 *  sessionStorage rather than localStorage: the verifier is valid for one
 *  redirect, so it should die with the tab. It also throws in Safari's private
 *  mode when quota is exhausted, hence the try. */
function memoryOrSession(): KeyValueStore {
  try {
    const probe = globalThis.sessionStorage;
    if (probe) {
      probe.getItem(VERIFIER_KEY);
      return probe;
    }
  } catch {
    // Fall through to memory: a blocked storage API must not break the button.
  }
  const map = new Map<string, string>();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
    removeItem: (key) => void map.delete(key),
  };
}
