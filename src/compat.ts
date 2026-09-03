/**
 * A drop-in stand-in for the 1.x browser SDK (`/sdk/sarv-auth.js`).
 *
 * Pages already integrated against `SarvAuth.init(...)` should be able to swap
 * the script tag for this bundle and keep working — otherwise "we published a
 * package" turns into a migration every existing client has to schedule. The
 * shape below is the old global's, implemented on top of the new client, with
 * the same sessionStorage keys so a page that is mid-flow across the swap still
 * finds its verifier.
 *
 * It is a compatibility layer, not the API to build on: `SarvLogin` is.
 */
import { isCallbackError, SarvLoginClient } from "./flow.js";
import { renderButton } from "./button.js";
import type { SarvButtonOptions, SarvLoginConfig } from "./types.js";

export interface LegacyConfig {
  client_id: string;
  redirect_uri: string;
  oauth_url?: string;
  scope?: string;
}

/** The old global's surface. Every method throws the same "call init() first"
 *  error the original did, because that is what existing code catches. */
export interface LegacySarvAuth {
  init(config: LegacyConfig): void;
  login(): Promise<void>;
  handleCallback(): { code: string; state: string; code_verifier: string } | null;
  getCodeVerifier(): string | null;
  renderButton(selector: string, options?: SarvButtonOptions): unknown;
  version: string;
}

export function createLegacyApi(version: string): LegacySarvAuth {
  let client: SarvLoginClient | null = null;
  let config: SarvLoginConfig | null = null;

  const require = (): SarvLoginClient => {
    if (!client) throw new Error("SarvAuth: call SarvAuth.init({ client_id, redirect_uri }) first.");
    return client;
  };

  return {
    init(legacy: LegacyConfig): void {
      config = {
        clientId: legacy.client_id,
        redirectUri: legacy.redirect_uri,
        oauthUrl: legacy.oauth_url,
        // The old config took one space-separated string, the new one an array.
        scopes: legacy.scope?.trim().split(/\s+/).filter(Boolean),
      };
      client = new SarvLoginClient(config);
    },

    login(): Promise<void> {
      return require().login();
    },

    handleCallback() {
      const result = require().handleCallback();
      // The old SDK returned null on an error and logged it. Kept, so existing
      // `if (!result) return` branches still fire — but the reason is logged,
      // because a silent null was the worst part of that API.
      if (isCallbackError(result)) {
        console.error(`SarvAuth: ${result.error}. ${result.error_description ?? ""}`);
        return null;
      }
      return { code: result.code, state: result.state, code_verifier: result.codeVerifier };
    },

    getCodeVerifier(): string | null {
      try {
        return globalThis.sessionStorage?.getItem("sarv_code_verifier") ?? null;
      } catch {
        return null;
      }
    },

    renderButton(selector: string, options: SarvButtonOptions = {}) {
      if (!config) throw new Error("SarvAuth: call SarvAuth.init(...) before renderButton().");
      return renderButton(selector, { ...config, ...options });
    },

    version,
  };
}
