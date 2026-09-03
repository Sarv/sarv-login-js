/**
 * What happens when the environment is missing something.
 *
 * Every path here is one a developer hits on their first afternoon: the page is
 * on plain http:// so there is no Web Crypto, or storage is blocked, or the
 * module was imported on a server. The message each one produces is the whole
 * value of the path, so the message is what is asserted.
 *
 * Kept in its own file because it removes globals, and node runs each test file
 * in its own process - so a botched restore here cannot leak into another file.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { deriveChallenge, randomState, randomVerifier, SarvLoginClient } from "../dist/index.js";

/** Runs `body` with `globalThis.crypto` replaced. defineProperty, because node
 *  exposes crypto as a getter and assignment throws. */
async function withCrypto(value, body) {
  const original = Object.getOwnPropertyDescriptor(globalThis, "crypto");
  Object.defineProperty(globalThis, "crypto", { value, writable: true, configurable: true });
  try {
    return await body();
  } finally {
    Object.defineProperty(globalThis, "crypto", original);
  }
}

test("without crypto.subtle it says the page needs https, not 'undefined'", async () => {
  await withCrypto(undefined, async () => {
    await assert.rejects(() => deriveChallenge("v"), (error) => {
      assert.match(error.message, /Web Crypto is unavailable/);
      // The actual cause, nine times out of ten: an http:// origin.
      assert.match(error.message, /https:\/\//);
      assert.match(error.message, /localhost/);
      return true;
    });
  });
});

test("a crypto object with no subtle is treated as no crypto at all", async () => {
  await withCrypto({ getRandomValues: (out) => out }, async () => {
    await assert.rejects(() => deriveChallenge("v"), /crypto\.subtle/);
  });
});

test("without getRandomValues the verifier refuses to be generated", async () => {
  await withCrypto({}, async () => {
    // Better a clear throw than a verifier from Math.random, which would look
    // like it worked and quietly remove PKCE's only guarantee.
    assert.throws(() => randomVerifier(), /getRandomValues is unavailable/);
    assert.throws(() => randomState(), /getRandomValues is unavailable/);
  });
});

test("with no sessionStorage the client falls back to memory instead of throwing", async () => {
  // This is the SSR / node case, and the point is that constructing a client
  // outside a browser must not be an error - the failure should come from the
  // method that actually needs a browser, if any.
  assert.equal(globalThis.sessionStorage, undefined, "this test needs a non-browser environment");
  const client = new SarvLoginClient({ clientId: "demo", redirectUri: "https://a.example/cb" });

  const url = await client.createAuthorizeUrl();
  const state = new URL(url).searchParams.get("state");
  // The verifier went somewhere the callback can still find it in-process.
  const result = client.handleCallback(`?code=abc&state=${encodeURIComponent(state)}`);
  assert.equal(result.code, "abc", "the in-memory store must round-trip the state");
  assert.ok(result.codeVerifier);
});

test("a blocked sessionStorage falls back rather than breaking the button", async () => {
  // Safari's private mode throws on access once the quota is gone.
  Object.defineProperty(globalThis, "sessionStorage", {
    get() {
      throw new Error("SecurityError: the operation is insecure");
    },
    configurable: true,
  });
  try {
    const client = new SarvLoginClient({ clientId: "demo", redirectUri: "https://a.example/cb" });
    const url = await client.createAuthorizeUrl();
    assert.match(url, /code_challenge=/, "a blocked store must not stop the flow");
  } finally {
    delete globalThis.sessionStorage;
  }
});

test("login() outside a browser resolves instead of throwing on location", async () => {
  assert.equal(globalThis.location, undefined, "this test needs a non-browser environment");
  const client = new SarvLoginClient({ clientId: "demo", redirectUri: "https://a.example/cb" });
  // `globalThis.location?.assign` - optional, so this is a no-op rather than a
  // TypeError. A framework that calls login() during hydration hits this.
  await client.login();
});
