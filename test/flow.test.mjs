import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildAuthorizeUrl,
  DEFAULT_OAUTH_URL,
  isCallbackError,
  readCallback,
  resolveConfig,
  SarvLoginClient,
  STATE_KEY,
  VERIFIER_KEY,
} from "../dist/index.js";

const BASE = { clientId: "app-123", redirectUri: "https://app.example.com/callback" };

test("resolveConfig fills defaults", () => {
  const resolved = resolveConfig(BASE);
  assert.deepEqual(resolved.scopes, ["openid", "email", "profile"]);
  assert.equal(resolved.oauthUrl, DEFAULT_OAUTH_URL);
  assert.deepEqual(resolved.extraParams, {});
});

test("resolveConfig trims a trailing slash off oauthUrl", () => {
  // Otherwise the composed URL has "//api/oauth/authorize", which some proxies
  // redirect and some reject.
  assert.equal(resolveConfig({ ...BASE, oauthUrl: "https://id.example.com/" }).oauthUrl, "https://id.example.com");
  assert.equal(resolveConfig({ ...BASE, oauthUrl: "https://id.example.com///" }).oauthUrl, "https://id.example.com");
});

test("resolveConfig demands the two values that have no default", () => {
  assert.throws(() => resolveConfig({ redirectUri: "x" }), /clientId/);
  assert.throws(() => resolveConfig({ clientId: "x" }), /redirectUri/);
});

test("resolveConfig rejects reserved extraParams instead of overwriting them", () => {
  // Silently letting `state` through would disable the CSRF check while the
  // flow still appeared to work, which is the worst possible failure mode.
  for (const key of ["state", "code_challenge", "client_id", "redirect_uri", "scope"]) {
    assert.throws(() => resolveConfig({ ...BASE, extraParams: { [key]: "x" } }), new RegExp(key));
  }
  assert.doesNotThrow(() => resolveConfig({ ...BASE, extraParams: { prompt: "login" } }));
});

test("buildAuthorizeUrl sends exactly what the server requires", () => {
  const url = new URL(buildAuthorizeUrl(resolveConfig(BASE), "st4te", "ch4llenge"));
  assert.equal(url.pathname, "/api/oauth/authorize");
  assert.equal(url.searchParams.get("response_type"), "code");
  assert.equal(url.searchParams.get("client_id"), "app-123");
  assert.equal(url.searchParams.get("redirect_uri"), BASE.redirectUri);
  assert.equal(url.searchParams.get("scope"), "openid email profile");
  assert.equal(url.searchParams.get("state"), "st4te");
  assert.equal(url.searchParams.get("code_challenge"), "ch4llenge");
  assert.equal(url.searchParams.get("code_challenge_method"), "S256");
});

test("buildAuthorizeUrl appends extraParams", () => {
  const url = new URL(
    buildAuthorizeUrl(resolveConfig({ ...BASE, extraParams: { prompt: "consent" } }), "s", "c")
  );
  assert.equal(url.searchParams.get("prompt"), "consent");
});

test("readCallback returns the code, verifier and redirect on the happy path", () => {
  const result = readCallback("?code=abc&state=s1", "s1", "v1", BASE.redirectUri);
  assert.equal(isCallbackError(result), false);
  assert.deepEqual(result, {
    code: "abc",
    state: "s1",
    codeVerifier: "v1",
    redirectUri: BASE.redirectUri,
  });
});

test("readCallback passes an OAuth error through rather than throwing", () => {
  const result = readCallback("?error=access_denied&error_description=User+said+no", "s1", "v1", "u");
  assert.equal(isCallbackError(result), true);
  assert.equal(result.error, "access_denied");
  assert.equal(result.error_description, "User said no");
});

test("readCallback refuses a callback whose state does not match", () => {
  // The security assertion of this file: a forged callback must not yield a
  // code the caller would then redeem.
  for (const [search, stored] of [
    ["?code=abc&state=wrong", "s1"],
    ["?code=abc", "s1"],
    ["?code=abc&state=s1", null],
  ]) {
    const result = readCallback(search, stored, "v1", "u");
    assert.equal(isCallbackError(result), true);
    assert.equal(result.error, "state_mismatch");
    assert.equal("code" in result, false, "no code may leak out of a failed state check");
  }
});

test("readCallback reports a missing verifier distinctly", () => {
  const result = readCallback("?code=abc&state=s1", "s1", null, "u");
  assert.equal(result.error, "missing_verifier");
});

test("readCallback reports a callback with no code at all", () => {
  assert.equal(readCallback("?state=s1", "s1", "v1", "u").error, "no_code");
});

/** A sessionStorage stand-in, which is all the client needs. */
function fakeStore(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    map,
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
    removeItem: (key) => void map.delete(key),
  };
}

test("createAuthorizeUrl stores the verifier before handing out the URL", async () => {
  const store = fakeStore();
  const client = new SarvLoginClient(BASE, store);
  const url = new URL(await client.createAuthorizeUrl());
  const verifier = store.getItem(VERIFIER_KEY);
  const state = store.getItem(STATE_KEY);
  assert.equal(verifier?.length, 43);
  assert.equal(url.searchParams.get("state"), state);
  // The challenge in the URL must be the hash of the verifier that was stored -
  // a mismatched pair is a flow that fails only at the token endpoint.
  const { deriveChallenge } = await import("../dist/index.js");
  assert.equal(url.searchParams.get("code_challenge"), await deriveChallenge(verifier));
});

test("handleCallback clears the one-time values on success and on failure", () => {
  for (const search of ["?code=abc&state=s1", "?code=abc&state=forged"]) {
    const store = fakeStore({ [STATE_KEY]: "s1", [VERIFIER_KEY]: "v1" });
    new SarvLoginClient(BASE, store).handleCallback(search);
    assert.equal(store.getItem(STATE_KEY), null);
    assert.equal(store.getItem(VERIFIER_KEY), null, "a verifier left behind gets paired with a later code");
  }
});

test("two clients on one page keep their own config", () => {
  const a = new SarvLoginClient({ ...BASE, clientId: "a" }, fakeStore());
  const b = new SarvLoginClient({ ...BASE, clientId: "b" }, fakeStore());
  assert.equal(a.config.clientId, "a");
  assert.equal(b.config.clientId, "b");
});
