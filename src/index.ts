/**
 * @sarv-in/login — the "Login with Sarv" button and the PKCE flow behind it.
 *
 * Four ways in, one implementation — every one of them renders the same
 * `<sarv-login-button>` custom element:
 *   - `<sarv-login-button>` / `renderButton()` for plain HTML and JS
 *   - `@sarv-in/login/react` for React
 *   - `@sarv-in/login/vue` for Vue 3
 *   - `@sarv-in/login/angular` for Angular — a service and a provider, no
 *     Angular import anywhere in it, so no ng-packagr and no version coupling
 *
 * The IIFE build attaches `window.SarvLogin` (and `window.SarvAuth` for pages
 * written against the 1.x SDK), and registers the custom element on load so a
 * `<sarv-login-button>` already in the markup upgrades itself.
 */
export { defineSarvLoginButton, renderButton, DEFAULT_LABEL, LOGIN_EVENT, TAG_NAME } from "./button.js";
export type { SarvLoginButtonElement } from "./button.js";
export {
  buildAuthorizeUrl,
  decodeJwtPayload,
  DEFAULT_OAUTH_URL,
  DEFAULT_SCOPES,
  isCallbackError,
  NONCE_KEY,
  nonceProblem,
  readCallback,
  resolveConfig,
  SarvLoginClient,
  STATE_KEY,
  VERIFIER_KEY,
} from "./flow.js";
export type { KeyValueStore, ResolvedConfig } from "./flow.js";
export { base64url, deriveChallenge, randomNonce, randomState, randomVerifier } from "./pkce.js";
export { DARK, LIGHT, METRICS, SIZES } from "./tokens.js";
export type { Palette, SizeName } from "./tokens.js";
export { buttonCss } from "./styles.js";
export { SARV_MARK_SVG } from "./logo.generated.js";
export type {
  SarvButtonOptions,
  SarvCallbackError,
  SarvCallbackResult,
  SarvLoginConfig,
  SarvLogoutOptions,
  SarvSize,
  SarvTheme,
  SarvTokenResponse,
  SarvVariant,
} from "./types.js";

import { defineSarvLoginButton, renderButton } from "./button.js";
import { createLegacyApi } from "./compat.js";
import { isCallbackError, SarvLoginClient } from "./flow.js";
import type { SarvButtonOptions, SarvLoginConfig, SarvLogoutOptions } from "./types.js";

/** Kept in step with package.json by `npm version` (see scripts/sync-version.mjs). */
export const version = "1.2.2";

/**
 * One-call convenience for the common case: render a button that starts the
 * flow. Everything it does is available piecemeal above; this is the shape that
 * fits in a README's first code block.
 */
export function createLogin(config: SarvLoginConfig) {
  const client = new SarvLoginClient(config);
  return {
    client,
    login: () => client.login(),
    handleCallback: (search?: string) => client.handleCallback(search),
    // Signing out is two operations against two different lifetimes — your
    // tokens and the Sarv session cookie. `logout` does both in the order that
    // cannot leave one of them alive; `revoke` is the single-token version for
    // apps that manage the session themselves.
    logout: (options?: SarvLogoutOptions) => client.logout(options),
    revoke: (token: string, hint?: "access_token" | "refresh_token") =>
      client.revokeToken(token, hint),
    logoutUrl: (options?: SarvLogoutOptions) => client.buildLogoutUrl(options),
    mount: (target: string | Element, options: SarvButtonOptions = {}) =>
      renderButton(target, { ...config, ...options }),
  };
}

/** The object exposed as `window.SarvLogin` by the browser build. */
export const SarvLogin = {
  version,
  createLogin,
  renderButton,
  defineSarvLoginButton,
  SarvLoginClient,
  isCallbackError,
};

// Auto-registration, browser only. A `<sarv-login-button>` written in HTML
// before this script loads is inert until the name is defined; defining it here
// upgrades those elements without the page having to call anything. Guarded so
// importing this module during SSR is a no-op rather than a ReferenceError.
if (typeof window !== "undefined") {
  defineSarvLoginButton();
  const globalScope = window as unknown as Record<string, unknown>;
  // Never overwrite: a second copy of the bundle on the page (a host app plus a
  // widget that both depend on us) would otherwise reset a configured SarvAuth
  // and break whichever loaded first.
  globalScope.SarvLogin ??= SarvLogin;
  globalScope.SarvAuth ??= createLegacyApi(version);
}
