/** Public types. Kept in one file so the generated .d.ts reads as a contract. */

/** Where the button sends people, and who it says is asking. */
export interface SarvLoginConfig {
  /** The OAuth client id from the Sarv developer console. Public value. */
  clientId: string;
  /**
   * Where Sarv sends the browser back. Must match one of the redirect URIs
   * registered for the client exactly — the server compares the whole string,
   * so a trailing slash is a different URI.
   */
  redirectUri: string;
  /**
   * Scopes to request. Defaults to `["openid", "email", "profile"]`.
   * Ask for what the app will actually use: the consent screen lists every one
   * of them, and a long list is the most common reason people decline.
   */
  scopes?: string[];
  /** The authorization server. Defaults to `https://oauth.sarv.com`. */
  oauthUrl?: string;
  /**
   * Extra query parameters to append to the authorization request — `prompt`,
   * `login_hint`, anything the server grows later. Reserved OAuth parameters
   * (`client_id`, `code_challenge`, `state`, …) are rejected rather than
   * silently overwritten, so a typo cannot break PKCE.
   */
  extraParams?: Record<string, string>;
}

/** What `handleCallback()` gives you on the redirect page. */
export interface SarvCallbackResult {
  /** The authorization code. Single-use, and short-lived. */
  code: string;
  /** The `state` echoed back, already verified against the stored value. */
  state: string;
  /**
   * The PKCE verifier that goes with this code. Send it to YOUR backend with
   * the code; the token endpoint needs both.
   */
  codeVerifier: string;
  /** The same redirect URI, which the token request must repeat verbatim. */
  redirectUri: string;
  /**
   * The OIDC nonce this flow sent, if it sent one — present whenever `openid`
   * is among the scopes, absent otherwise.
   *
   * YOU MUST COMPARE IT. Whoever ends up holding the ID token has to check that
   * its `nonce` claim equals this value, and refuse the token if it does not.
   * `exchangeCode()` does that for you, because it holds the token itself. If
   * your BACKEND does the exchange, send this along with the code and verifier
   * and compare it there — a nonce that is sent and never checked is not a
   * weaker guard, it is no guard at all.
   */
  nonce?: string;
}

/** What the token endpoint returns. Snake_case because it is the wire format. */
export interface SarvTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  id_token?: string;
  scope?: string;
}

/** An error surfaced by the callback rather than thrown. */
export interface SarvCallbackError {
  /** The OAuth error code, or one this SDK raises (`state_mismatch`). */
  error: string;
  error_description?: string;
}

/**
 * Signing out. Two separate things happen, and both are needed.
 *
 * Revoking kills the TOKENS your app holds. The end-session redirect kills the
 * SARV SESSION COOKIE, so the next visitor at the same keyboard is not silently
 * signed in. Doing only the first leaves a live session at the IdP; doing only
 * the second leaves working tokens in your app. `logout()` does both, in that
 * order, because a revoked token cannot be used while the redirect is in
 * flight.
 */
export interface SarvLogoutOptions {
  /**
   * Where Sarv sends the browser after signing out.
   *
   * Defaults to the ORIGIN of `redirectUri`, which is the one value guaranteed
   * to pass the server's check: it validates this against the origins of the
   * client's registered redirect URIs, not against a dedicated allow-list. Pass
   * a full URL to land somewhere specific — any path on a registered origin is
   * accepted, so `https://app.example.com/signed-out` works when only
   * `https://app.example.com/auth/callback` is registered.
   */
  postLogoutRedirectUri?: string;
  /** Opaque value echoed back as `?state=` on the landing page. */
  state?: string;
  /**
   * Advisory. The spec has the RP pass its ID token so the IdP can tell which
   * session to end; this server accepts the parameter but does not act on it,
   * because it ends the session it finds from the session cookie — which a
   * top-level navigation to the logout endpoint carries anyway. Kept in the
   * signature: it is a legitimate parameter, and code written against it stops
   * needing a change the day the server starts honouring it.
   */
  idTokenHint?: string;
  /**
   * Tokens to revoke before the redirect. Omit what you do not hold — a
   * frontend that let its backend do the exchange usually holds neither, and
   * should call this with no tokens and let its backend revoke.
   */
  tokens?: {
    accessToken?: string;
    refreshToken?: string;
  };
}

export type SarvTheme = "light" | "dark" | "auto";
export type SarvSize = "sm" | "md" | "lg";
export type SarvVariant = "brand" | "surface";

/** How the button looks. Nothing here changes what the flow does. */
export interface SarvButtonOptions {
  /** Button text. Defaults to "Login with Sarv". */
  label?: string;
  /**
   * `brand` is the filled blue button; `surface` is the white/dark one with a
   * border, for pages that already have a primary action of their own.
   * Defaults to `brand`.
   */
  variant?: SarvVariant;
  /** Matches the design system's .btn-sm / .btn / .btn-lg. Defaults to `md`. */
  size?: SarvSize;
  /**
   * `auto` follows the visitor's `prefers-color-scheme`, which is what a button
   * embedded in someone else's page should do unless told otherwise.
   */
  theme?: SarvTheme;
  /** Stretch to the container's width. Defaults to false. */
  fullWidth?: boolean;
  /** Rendered but not clickable — for a form that is not yet valid. */
  disabled?: boolean;
  /**
   * Turns the trigger into an `<a href>` and stops the button starting a flow
   * of its own — for an app whose BACKEND owns the OAuth exchange. Point it at
   * your own start-of-flow route; the browser just follows the link, and no
   * PKCE verifier ever exists in the page.
   *
   * The `sarv-login` event still fires, so a host can observe or cancel the
   * click. `disabled` drops the href, which is what makes an anchor inert.
   */
  href?: string;
}
