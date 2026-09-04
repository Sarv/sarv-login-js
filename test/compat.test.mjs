/**
 * `createLogin` and the 1.x `SarvAuth` compatibility layer.
 *
 * The compat layer exists so pages already carrying `/sdk/sarv-auth.js` keep
 * working when the bundle is swapped underneath them. That promise is only
 * worth anything if it is tested: it is precisely the code nobody exercises by
 * hand, because everyone writing new code uses the new API.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { innerButton, loadInBrowser, pause, waitFor, withConsoleError } from "./_dom.mjs";

const { window, document, module, navigations, location } = await loadInBrowser();
const { createLogin, SarvLogin, TAG_NAME, isCallbackError, version } = module;

const LEGACY = { client_id: "legacy-app", redirect_uri: "https://legacy.example/cb" };

const clear = () => {
  navigations.length = 0;
  window.sessionStorage.clear();
  document.body.innerHTML = "";
};

test("the browser build exposes both globals, without clobbering an existing one", () => {
  assert.equal(window.SarvLogin, SarvLogin);
  assert.equal(window.SarvAuth.version, version);
  // `??=`, so a second copy of the bundle must not reset a configured SarvAuth.
  const before = window.SarvAuth;
  window.SarvAuth ??= { impostor: true };
  assert.equal(window.SarvAuth, before);
});

test("createLogin gives one client and three ways into it", async () => {
  clear();
  const login = createLogin({
    clientId: "demo",
    redirectUri: "https://a.example/cb",
    oauthUrl: "https://oauth.example.com",
  });
  assert.equal(login.client.config.clientId, "demo");
  assert.equal(login.client.config.oauthUrl, "https://oauth.example.com");

  await login.login();
  assert.equal(navigations.length, 1);
  assert.match(navigations[0], /^https:\/\/oauth\.example\.com\/api\/oauth\/authorize\?/);
});

test("createLogin().mount renders the button with the config already applied", () => {
  clear();
  const host = document.createElement("div");
  host.id = "mount-target";
  document.body.append(host);

  const login = createLogin({ clientId: "demo", redirectUri: "https://a.example/cb" });
  const element = login.mount("#mount-target", { variant: "surface", size: "lg" });

  assert.equal(element.tagName.toLowerCase(), TAG_NAME);
  assert.equal(element.clientId, "demo", "mount must not require the config twice");
  assert.equal(element.getAttribute("variant"), "surface");
  assert.equal(element.getAttribute("size"), "lg");
});

test("createLogin().handleCallback reads a callback and clears the one-time values", () => {
  clear();
  const login = createLogin({ clientId: "demo", redirectUri: "https://a.example/cb" });
  window.sessionStorage.setItem("sarv_oauth_state", "st-1");
  window.sessionStorage.setItem("sarv_code_verifier", "vf-1");

  const result = login.handleCallback("?code=abc&state=st-1");
  assert.equal(isCallbackError(result), false);
  assert.equal(result.code, "abc");
  assert.equal(result.codeVerifier, "vf-1");
  assert.equal(result.redirectUri, "https://a.example/cb");
  assert.equal(window.sessionStorage.getItem("sarv_code_verifier"), null, "the verifier is single-use");
});

test("createLogin exposes signing out as well as signing in", async () => {
  clear();
  const login = createLogin({
    clientId: "demo",
    redirectUri: "https://app.example.com/auth/callback",
    oauthUrl: "https://oauth.example.com",
  });

  // The same config that started the flow ends the session, so an integrator
  // never repeats a client id to sign someone out.
  const url = new URL(login.logoutUrl({ state: "s-1" }));
  assert.equal(url.origin + url.pathname, "https://oauth.example.com/api/oauth/logout");
  assert.equal(url.searchParams.get("client_id"), "demo");
  assert.equal(url.searchParams.get("post_logout_redirect_uri"), "https://app.example.com");
  assert.equal(url.searchParams.get("state"), "s-1");

  // `revoke` is the single-token version, for an app that manages its own
  // session and only wants one token killed.
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => ({ revoked: true }) });
  try {
    assert.equal(await login.revoke("at", "access_token"), true);
  } finally {
    globalThis.fetch = originalFetch;
  }

  await login.logout();
  assert.equal(navigations.length, 1, "logout must navigate to the end-session endpoint");
  assert.equal(new URL(navigations[0]).pathname, "/api/oauth/logout");
});

test("SarvAuth refuses to work before init, and says which call is missing", () => {
  const { SarvAuth } = window;
  assert.throws(() => SarvAuth.login(), /SarvAuth\.init/);
  assert.throws(() => SarvAuth.handleCallback(), /SarvAuth\.init/);
  assert.throws(() => SarvAuth.renderButton("#nope"), /SarvAuth\.init/);
});

test("SarvAuth.init translates the 1.x snake_case config, scope string included", async () => {
  clear();
  const { SarvAuth } = window;
  SarvAuth.init({ ...LEGACY, oauth_url: "https://oauth.example.com", scope: "openid  email " });

  await SarvAuth.login();
  await waitFor(() => navigations.length > 0, "the legacy login redirect");

  const url = new URL(navigations[0]);
  assert.equal(url.origin + url.pathname, "https://oauth.example.com/api/oauth/authorize");
  assert.equal(url.searchParams.get("client_id"), "legacy-app");
  assert.equal(url.searchParams.get("redirect_uri"), "https://legacy.example/cb");
  // One space-separated string in, an array out - and the extra whitespace in
  // the old config must not become an empty scope.
  assert.equal(url.searchParams.get("scope"), "openid email");
  assert.equal(url.searchParams.get("code_challenge_method"), "S256");
});

test("SarvAuth.init without a scope falls back to the defaults", async () => {
  clear();
  window.SarvAuth.init(LEGACY);
  await window.SarvAuth.login();
  await waitFor(() => navigations.length > 0, "the redirect");
  assert.equal(new URL(navigations[0]).searchParams.get("scope"), "openid email profile");
});

test("SarvAuth.handleCallback returns the old snake_case shape", () => {
  clear();
  window.SarvAuth.init(LEGACY);
  window.sessionStorage.setItem("sarv_oauth_state", "st-2");
  window.sessionStorage.setItem("sarv_code_verifier", "vf-2");
  location.search = "?code=xyz&state=st-2";

  const result = window.SarvAuth.handleCallback();
  assert.deepEqual(result, { code: "xyz", state: "st-2", code_verifier: "vf-2" });
});

test("SarvAuth.handleCallback returns null and logs on a failed state check", async () => {
  clear();
  window.SarvAuth.init(LEGACY);
  window.sessionStorage.setItem("sarv_oauth_state", "the-real-state");
  window.sessionStorage.setItem("sarv_code_verifier", "vf-3");
  location.search = "?code=forged&state=not-the-real-state";

  // null rather than a throw: the 1.x callers wrote `if (!result) return`.
  const { messages, result } = await withConsoleError(() => window.SarvAuth.handleCallback());
  assert.equal(result, null, "a forged callback must not come back as a usable code");
  assert.match(messages.join(" "), /state_mismatch/);
});

test("SarvAuth.getCodeVerifier reads the same key the flow writes", () => {
  clear();
  assert.equal(window.SarvAuth.getCodeVerifier(), null);
  window.sessionStorage.setItem("sarv_code_verifier", "vf-4");
  assert.equal(window.SarvAuth.getCodeVerifier(), "vf-4");
});

test("SarvAuth.renderButton uses the init config and takes appearance options", async () => {
  clear();
  const host = document.createElement("div");
  host.id = "legacy-host";
  document.body.append(host);
  window.SarvAuth.init(LEGACY);

  const element = window.SarvAuth.renderButton("#legacy-host", { label: "Sign in", theme: "dark" });
  assert.equal(element.clientId, "legacy-app");
  assert.equal(element.getAttribute("label"), "Sign in");
  assert.equal(element.getAttribute("theme"), "dark");

  innerButton(element).click();
  await waitFor(() => navigations.length > 0, "a redirect from the legacy-rendered button");
  assert.equal(new URL(navigations[0]).searchParams.get("client_id"), "legacy-app");
});

test("a second init re-points the same SarvAuth rather than keeping the old client", async () => {
  clear();
  window.SarvAuth.init(LEGACY);
  window.SarvAuth.init({ client_id: "second-app", redirect_uri: "https://second.example/cb" });
  await window.SarvAuth.login();
  await waitFor(() => navigations.length > 0, "the redirect");
  assert.equal(new URL(navigations[0]).searchParams.get("client_id"), "second-app");
});

test("SarvLogin's own surface is the documented one", () => {
  assert.deepEqual(Object.keys(SarvLogin).sort(), [
    "SarvLoginClient",
    "createLogin",
    "defineSarvLoginButton",
    "isCallbackError",
    "renderButton",
    "version",
  ]);
  assert.equal(SarvLogin.version, version);
});
