/**
 * The authorization-code + PKCE flow, split so the decisions are testable.
 *
 * `buildAuthorizeUrl` and `readCallback` are pure functions of their inputs —
 * no storage, no navigation, no clock. The side effects (sessionStorage, the
 * redirect, fetch) live in `SarvLoginClient`, at the edge, where a test can
 * hand in a fake store instead of a real one.
 */
import { deriveChallenge, randomNonce, randomState, randomVerifier } from "./pkce.js";
import type {
  SarvCallbackError,
  SarvCallbackResult,
  SarvLoginConfig,
  SarvLogoutOptions,
  SarvTokenResponse,
} from "./types.js";

export const DEFAULT_OAUTH_URL = "https://oauth.sarv.com";
export const DEFAULT_SCOPES = ["openid", "email", "profile"];

/** sessionStorage keys. The names match the 1.x browser SDK on purpose, so a
 *  page mid-flow when the bundle is swapped still finds its verifier. */
export const VERIFIER_KEY = "sarv_code_verifier";
export const STATE_KEY = "sarv_oauth_state";
/** The OIDC nonce. A new key rather than one of the two above: the 1.x SDK never
 *  wrote it, so there is no legacy name to match, and a page mid-flow across a
 *  bundle swap simply has no nonce to check — which `readCallback` treats as
 *  "not requested" rather than as a failure. */
export const NONCE_KEY = "sarv_oidc_nonce";

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
  // Reserved as of the release that added nonce support. Before it, passing one
  // through `extraParams` was the only way to get a nonce and is what the docs
  // suggested; that now throws, deliberately and loudly. Left unreserved, the
  // `...config.extraParams` spread below would overwrite the nonce in the URL
  // while the store still held ours — every login would fail the comparison,
  // and it would look like a server bug.
  "nonce",
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
 * `state`, `codeChallenge` and `nonce` are arguments rather than generated
 * inside, because the caller has to persist the values that match them —
 * generating any of them here would hide half a pair inside a pure function.
 *
 * `nonce` is optional and omitted from the URL when absent, rather than sent
 * empty. An empty `nonce` claim fails a client's comparison instead of skipping
 * it, so a blank one is worse than none at all.
 */
export function buildAuthorizeUrl(
  config: ResolvedConfig,
  state: string,
  codeChallenge: string,
  nonce?: string
): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    scope: config.scopes.join(" "),
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    ...(nonce ? { nonce } : {}),
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
  redirectUri: string,
  // Last, and optional, so the four-argument calls that predate nonce support
  // keep compiling and keep meaning what they meant.
  storedNonce?: string | null
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
  return {
    code,
    state,
    codeVerifier: storedVerifier,
    redirectUri,
    // Absent when the flow did not ask for `openid`, so there is no ID token to
    // check it against. Undefined rather than null: it is "not applicable", and
    // the type says optional.
    ...(storedNonce ? { nonce: storedNonce } : {}),
  };
}

/**
 * Reads a JWT's payload. **DOES NOT VERIFY THE SIGNATURE.**
 *
 * That is not a shortcut, it is the boundary of what a browser can usefully do.
 * Verifying would mean fetching JWKS and doing RSA in the page, and a browser
 * that verified an ID token itself would still be trusting a token it was
 * handed. Use this to READ claims you already trust the source of — the ID
 * token in a token-endpoint response over TLS — and never to decide whether to
 * trust a token that arrived some other way. That decision belongs on a server,
 * against the JWKS document.
 *
 * Returns null for anything that is not a three-part JWT with a JSON object
 * payload, so a caller never has to guard the parse.
 */
export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split(".");
  // Both checks earn their place: the length rejects a two- or four-segment
  // string, and the destructuring is what narrows the segment to `string` for
  // the compiler (`noUncheckedIndexedAccess` is on, so `parts[1]` alone stays
  // `string | undefined` however the length is tested).
  if (parts.length !== 3) return null;
  const [, encodedPayload] = parts;
  if (!encodedPayload) return null;
  try {
    const base64 = encodedPayload.replace(/-/g, "+").replace(/_/g, "/");
    const binary = atob(base64 + "=".repeat((4 - (base64.length % 4)) % 4));
    // Through TextDecoder rather than using atob's output directly: atob yields
    // one char per byte, so a claim like a name with a non-ASCII character
    // would come out as mojibake. Nonces are base64url and would survive
    // either way; the other claims a caller reads with this would not.
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    const payload = JSON.parse(new TextDecoder().decode(bytes));
    return payload && typeof payload === "object" && !Array.isArray(payload)
      ? (payload as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/**
 * Checks an ID token's `nonce` against the one this flow sent. Returns a
 * human-readable problem, or null when it matches.
 *
 * A missing ID token is NOT a problem here: a client can legitimately be given
 * only an access token — the server mints an ID token for the `openid` scope,
 * and a caller may have narrowed its scopes since the flow began. A missing or
 * mismatched *claim* on a token that does exist is a problem, and both are
 * reported distinctly, because they mean different things: one is a server that
 * did not echo the value, the other is a token minted for a different login.
 */
export function nonceProblem(idToken: string | undefined, expected: string): string | null {
  if (!idToken) return null;
  const payload = decodeJwtPayload(idToken);
  if (!payload) return "the id_token in the token response could not be decoded.";
  const claim = payload.nonce;
  if (typeof claim !== "string" || !claim) {
    return (
      "the id_token has no `nonce` claim, but this flow sent one. Either the " +
      "authorization server did not echo it, or this token was minted for a " +
      "different request."
    );
  }
  if (claim !== expected) {
    return (
      "the id_token's `nonce` does not match the value stored when this flow " +
      "started. The token was minted for a different login and must not be trusted."
    );
  }
  return null;
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

  /** Mints a verifier, state and nonce, stores them, and returns where to go next. */
  async createAuthorizeUrl(): Promise<string> {
    const verifier = randomVerifier();
    const state = randomState();
    // Only with `openid`. Without that scope no ID token is minted, so a nonce
    // would be a value sent, stored and returned that nothing could ever be
    // compared against — which reads like a guard while being none.
    const nonce = this.config.scopes.includes("openid") ? randomNonce() : undefined;
    const challenge = await deriveChallenge(verifier);
    // Stored BEFORE the URL is handed out: if the caller navigates the instant
    // it resolves, the verifier has to already be there.
    this.store.setItem(VERIFIER_KEY, verifier);
    this.store.setItem(STATE_KEY, state);
    if (nonce) this.store.setItem(NONCE_KEY, nonce);
    else this.store.removeItem(NONCE_KEY);
    return buildAuthorizeUrl(this.config, state, challenge, nonce);
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
      this.config.redirectUri,
      this.store.getItem(NONCE_KEY)
    );
    // Cleared whatever the outcome. The verifier is single-use by definition,
    // and leaving it behind is what makes a stale one get paired with a fresh
    // code later. The nonce goes with it: it is already on the result, and a
    // leftover one would be compared against a later flow's ID token.
    this.store.removeItem(STATE_KEY);
    this.store.removeItem(VERIFIER_KEY);
    this.store.removeItem(NONCE_KEY);
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
    const tokens = (await response.json()) as SarvTokenResponse;
    // Checked here rather than left to the caller. A nonce that is generated,
    // sent and returned but never compared is not a weaker guard than none — it
    // is no guard at all, wearing the appearance of one, and every caller who
    // forgot the comparison would believe they had it. So the one path where
    // this SDK holds the ID token itself does the check unprompted, and throws.
    if (result.nonce) {
      const problem = nonceProblem(tokens.id_token, result.nonce);
      if (problem) throw new Error(`Sarv login: ${problem}`);
    }
    return tokens;
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

  /**
   * Revokes one token.
   *
   * Resolves to whether the server found something to revoke. That is not the
   * same as success: `false` is the normal answer for a token that had already
   * expired or been rotated, which is why this does not throw on it. It throws
   * only when the request itself failed — a wrong `client_id`, or no network.
   *
   * No client secret is sent. For this endpoint the server treats possession of
   * the token as the proof, exactly as it does for PKCE at the token endpoint,
   * so a public client can revoke its own tokens and nothing else.
   */
  async revokeToken(
    token: string,
    tokenTypeHint?: "access_token" | "refresh_token"
  ): Promise<boolean> {
    const response = await fetch(`${this.config.oauthUrl}/api/oauth/revoke`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        token,
        // Sent only when known. The server uses it to look in the right table
        // first; a wrong hint costs a second lookup, a missing one costs one.
        ...(tokenTypeHint ? { token_type_hint: tokenTypeHint } : {}),
        client_id: this.config.clientId,
      }),
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(
        `Sarv login: revoke failed (${response.status}). ${detail.slice(0, 300)}`
      );
    }
    const body = (await response.json().catch(() => ({}))) as { revoked?: boolean };
    return body.revoked === true;
  }

  /**
   * Where to send the browser to end the Sarv session.
   *
   * `client_id` and `post_logout_redirect_uri` are ALWAYS both sent, and that is
   * not belt-and-braces. The server only validates the landing page when it has
   * a client to validate against; with either one missing it renders a JSON
   * document — `{"message":"Signed out of Sarv OAuth"}` — in the browser
   * window. Raw JSON shown to a user who clicked "sign out" is the failure this
   * prevents.
   */
  buildLogoutUrl(options: SarvLogoutOptions = {}): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      post_logout_redirect_uri:
        options.postLogoutRedirectUri ?? defaultPostLogoutUri(this.config.redirectUri),
    });
    if (options.state) params.set("state", options.state);
    if (options.idTokenHint) params.set("id_token_hint", options.idTokenHint);
    return `${this.config.oauthUrl}/api/oauth/logout?${params.toString()}`;
  }

  /**
   * Signs out: revokes what you hold, then ends the Sarv session.
   *
   * The refresh token goes first. Revoking it takes its whole family with it,
   * including access tokens issued under it, so the reverse order can leave a
   * fresh access token alive that the refresh revocation would have caught.
   *
   * A failed revocation does NOT stop the redirect. The user pressed sign out;
   * stranding them on a page that still looks signed in because a network call
   * failed is worse than a token that outlives its session and expires on its
   * own. Failures are reported on the console rather than thrown, since the
   * navigation makes any rejection unobservable anyway.
   */
  async logout(options: SarvLogoutOptions = {}): Promise<void> {
    const { accessToken, refreshToken } = options.tokens ?? {};
    for (const [token, hint] of [
      [refreshToken, "refresh_token"],
      [accessToken, "access_token"],
    ] as const) {
      if (!token) continue;
      try {
        await this.revokeToken(token, hint);
      } catch (error) {
        console.error(`Sarv login: could not revoke the ${hint}, signing out anyway.`, error);
      }
    }
    // Our own one-time values, in case a flow was abandoned mid-redirect.
    // Cheap, and it stops a stale verifier being paired with a later code.
    this.store.removeItem(STATE_KEY);
    this.store.removeItem(VERIFIER_KEY);
    this.store.removeItem(NONCE_KEY);
    globalThis.location?.assign(this.buildLogoutUrl(options));
  }
}

/** The origin of the registered redirect URI.
 *
 *  The server validates a post-logout landing page by comparing its origin to
 *  the origins of the client's registered redirect URIs, so the origin of the
 *  URI this client already uses cannot fail that check. A `redirectUri` that
 *  will not parse falls back to the empty string, which the server then simply
 *  declines to redirect to — a wrong-looking landing page, never an exception
 *  thrown out of a sign-out button. */
function defaultPostLogoutUri(redirectUri: string): string {
  try {
    return new URL(redirectUri).origin;
  } catch {
    return "";
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
