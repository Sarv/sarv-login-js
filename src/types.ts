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

export type SarvTheme = "light" | "dark" | "auto";
export type SarvSize = "sm" | "md" | "lg";
export type SarvVariant = "brand" | "surface";

/** How the button looks. Nothing here changes what the flow does. */
export interface SarvButtonOptions {
  /** Button text. Defaults to "Continue with Sarv". */
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
}
