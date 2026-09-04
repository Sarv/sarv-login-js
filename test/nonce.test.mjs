/**
 * The OIDC nonce.
 *
 * Two things are being asserted here, and the second matters more than the
 * first. One: the value is generated, sent, stored and returned. Two: a
 * MISMATCH IS REFUSED — because a nonce that travels the whole round trip and
 * is never compared is not a weaker guard than none, it is no guard at all
 * while looking exactly like one.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildAuthorizeUrl,
  decodeJwtPayload,
  NONCE_KEY,
  nonceProblem,
  randomNonce,
  readCallback,
  resolveConfig,
  SarvLoginClient,
  STATE_KEY,
  VERIFIER_KEY,
} from "../dist/index.js";

const BASE = { clientId: "app-123", redirectUri: "https://app.example.com/callback" };

function fakeStore(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    map,
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
    removeItem: (key) => void map.delete(key),
  };
}

/** An unsigned JWT with the given payload. Enough for the claim reader, which
 *  deliberately does not verify — see decodeJwtPayload's docstring. */
function fakeJwt(payload) {
  const b64 = (obj) =>
    Buffer.from(JSON.stringify(obj))
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  return `${b64({ alg: "RS256", typ: "JWT" })}.${b64(payload)}.c2ln`;
}

// ── the primitive ──────────────────────────────────────────────────────────

test("randomNonce is 16 bytes of base64url, and not the same twice", () => {
  const nonce = randomNonce();
  assert.equal(nonce.length, 22, "16 bytes base64url-encode to 22 chars");
  assert.match(nonce, /^[A-Za-z0-9_-]+$/, "base64url only: it travels in a URL");
  assert.notEqual(randomNonce(), randomNonce());
});

test("randomNonce takes an injected generator, so a test need not stub globals", () => {
  assert.equal(randomNonce(() => new Uint8Array(16)), "AAAAAAAAAAAAAAAAAAAAAA");
});

// ── the request ────────────────────────────────────────────────────────────

test("buildAuthorizeUrl sends the nonce when given one", () => {
  const url = new URL(buildAuthorizeUrl(resolveConfig(BASE), "st4te", "ch4llenge", "n0nce"));
  assert.equal(url.searchParams.get("nonce"), "n0nce");
});

test("buildAuthorizeUrl omits the nonce entirely rather than sending it empty", () => {
  // An empty `nonce` claim fails a client's comparison instead of skipping it,
  // so a blank one is worse than none.
  for (const absent of [undefined, "", null]) {
    const url = new URL(buildAuthorizeUrl(resolveConfig(BASE), "s", "c", absent));
    assert.equal(url.searchParams.has("nonce"), false);
  }
});

test("nonce is reserved, so extraParams cannot overwrite the one we stored", () => {
  // Left unreserved, the extraParams spread would win in the URL while the
  // store still held ours: every login would fail its own comparison, and it
  // would look like a server bug.
  assert.throws(() => resolveConfig({ ...BASE, extraParams: { nonce: "mine" } }), /nonce/);
});

test("createAuthorizeUrl mints a nonce, stores it, and sends the same one", async () => {
  const store = fakeStore();
  const url = new URL(await new SarvLoginClient(BASE, store).createAuthorizeUrl());
  const stored = store.getItem(NONCE_KEY);
  assert.equal(stored?.length, 22);
  assert.equal(url.searchParams.get("nonce"), stored, "a stored/sent mismatch fails every login");
  assert.notEqual(stored, store.getItem(STATE_KEY), "state and nonce must be distinct values");
});

test("no openid scope means no nonce anywhere", async () => {
  // Without `openid` the server mints no ID token, so a nonce would be a value
  // nothing could ever be compared against.
  const store = fakeStore();
  const client = new SarvLoginClient({ ...BASE, scopes: ["email"] }, store);
  const url = new URL(await client.createAuthorizeUrl());
  assert.equal(url.searchParams.has("nonce"), false);
  assert.equal(store.getItem(NONCE_KEY), null);
});

test("a stale nonce from an openid flow is cleared by a later non-openid one", async () => {
  const store = fakeStore({ [NONCE_KEY]: "left-over" });
  await new SarvLoginClient({ ...BASE, scopes: ["email"] }, store).createAuthorizeUrl();
  assert.equal(store.getItem(NONCE_KEY), null, "it would be compared against a later ID token");
});

// ── the callback ───────────────────────────────────────────────────────────

test("readCallback returns the stored nonce alongside the code", () => {
  const result = readCallback("?code=abc&state=s1", "s1", "v1", BASE.redirectUri, "n1");
  assert.deepEqual(result, {
    code: "abc",
    state: "s1",
    codeVerifier: "v1",
    redirectUri: BASE.redirectUri,
    nonce: "n1",
  });
});

test("readCallback omits nonce when there was none, and still works on 4 args", () => {
  // The four-argument form predates nonce support and must keep meaning what
  // it meant, or every existing caller breaks.
  for (const args of [["?code=abc&state=s1", "s1", "v1", "u"], ["?code=abc&state=s1", "s1", "v1", "u", null]]) {
    const result = readCallback(...args);
    assert.equal("nonce" in result, false);
  }
});

test("handleCallback hands the nonce back and clears it", () => {
  const store = fakeStore({ [STATE_KEY]: "s1", [VERIFIER_KEY]: "v1", [NONCE_KEY]: "n1" });
  const result = new SarvLoginClient(BASE, store).handleCallback("?code=abc&state=s1");
  assert.equal(result.nonce, "n1");
  assert.equal(store.getItem(NONCE_KEY), null, "a leftover nonce gets compared to a later ID token");
});

test("handleCallback clears the nonce on a forged callback too", () => {
  const store = fakeStore({ [STATE_KEY]: "s1", [VERIFIER_KEY]: "v1", [NONCE_KEY]: "n1" });
  new SarvLoginClient(BASE, store).handleCallback("?code=abc&state=forged");
  assert.equal(store.getItem(NONCE_KEY), null);
});

// ── reading claims ─────────────────────────────────────────────────────────

test("decodeJwtPayload reads the claims of a well-formed JWT", () => {
  assert.deepEqual(decodeJwtPayload(fakeJwt({ sub: "u_1", nonce: "n1" })), { sub: "u_1", nonce: "n1" });
});

test("decodeJwtPayload decodes UTF-8 rather than one char per byte", () => {
  // atob's output is latin1, so a name with a non-ASCII character comes out as
  // mojibake unless it goes through TextDecoder.
  assert.equal(decodeJwtPayload(fakeJwt({ name: "Ankur Dubeyह" })).name, "Ankur Dubeyह");
});

test("decodeJwtPayload returns null for anything that is not a JWT", () => {
  for (const bad of ["", "not-a-jwt", "only.two", "a.b.c.d", "a.!!!.c", `a.${Buffer.from("[1,2]").toString("base64url")}.c`]) {
    assert.equal(decodeJwtPayload(bad), null, `should reject: ${JSON.stringify(bad)}`);
  }
});

// ── the comparison, which is the point ─────────────────────────────────────

test("nonceProblem accepts a matching claim", () => {
  assert.equal(nonceProblem(fakeJwt({ nonce: "n1" }), "n1"), null);
});

test("nonceProblem REFUSES a token minted for a different login", () => {
  const problem = nonceProblem(fakeJwt({ nonce: "someone-elses" }), "n1");
  assert.match(problem, /does not match/);
  assert.match(problem, /must not be trusted/);
});

test("nonceProblem distinguishes a missing claim from a wrong one", () => {
  // Different causes: one is a server that did not echo the value, the other is
  // a token from a different request. A caller debugging deserves to know which.
  for (const payload of [{ sub: "u_1" }, { nonce: "" }, { nonce: 42 }]) {
    assert.match(nonceProblem(fakeJwt(payload), "n1"), /no `nonce` claim/);
  }
});

test("nonceProblem reports an undecodable token as such", () => {
  assert.match(nonceProblem("garbage", "n1"), /could not be decoded/);
});

test("nonceProblem tolerates no ID token at all", () => {
  // A client can legitimately hold only an access token; that is not a nonce
  // failure, and treating it as one would break plain-OAuth callers.
  assert.equal(nonceProblem(undefined, "n1"), null);
  assert.equal(nonceProblem("", "n1"), null);
});

// ── exchangeCode does the check itself ─────────────────────────────────────

async function withFetch(reply, run) {
  const original = globalThis.fetch;
  globalThis.fetch = async () => reply;
  try {
    return await run();
  } finally {
    if (original) globalThis.fetch = original;
    else delete globalThis.fetch;
  }
}

const okReply = (body) => ({ ok: true, status: 200, json: async () => body });

test("exchangeCode throws on a mismatched nonce instead of returning tokens", async () => {
  const result = { code: "c", state: "s", codeVerifier: "v", redirectUri: BASE.redirectUri, nonce: "n1" };
  await withFetch(
    okReply({ access_token: "at", id_token: fakeJwt({ nonce: "attacker" }), token_type: "Bearer" }),
    async () => {
      await assert.rejects(
        () => new SarvLoginClient(BASE, fakeStore()).exchangeCode(result),
        /does not match/,
        "a mismatch must not resolve — the caller would use the tokens"
      );
    }
  );
});

test("exchangeCode returns the tokens when the nonce matches", async () => {
  const result = { code: "c", state: "s", codeVerifier: "v", redirectUri: BASE.redirectUri, nonce: "n1" };
  const body = { access_token: "at", id_token: fakeJwt({ nonce: "n1" }), token_type: "Bearer" };
  await withFetch(okReply(body), async () => {
    const tokens = await new SarvLoginClient(BASE, fakeStore()).exchangeCode(result);
    assert.equal(tokens.access_token, "at");
  });
});

test("exchangeCode skips the check when the flow sent no nonce", async () => {
  // A plain-OAuth flow gets an ID token it never asked about; refusing it here
  // would break a caller who is doing nothing wrong.
  const result = { code: "c", state: "s", codeVerifier: "v", redirectUri: BASE.redirectUri };
  await withFetch(okReply({ access_token: "at", id_token: fakeJwt({ nonce: "whatever" }) }), async () => {
    const tokens = await new SarvLoginClient(BASE, fakeStore()).exchangeCode(result);
    assert.equal(tokens.access_token, "at");
  });
});

test("exchangeCode does not fail a response that carries no id_token", async () => {
  const result = { code: "c", state: "s", codeVerifier: "v", redirectUri: BASE.redirectUri, nonce: "n1" };
  await withFetch(okReply({ access_token: "at", token_type: "Bearer" }), async () => {
    const tokens = await new SarvLoginClient(BASE, fakeStore()).exchangeCode(result);
    assert.equal(tokens.access_token, "at");
  });
});

test("logout clears the nonce with the other one-time values", async () => {
  const store = fakeStore({ [STATE_KEY]: "s1", [VERIFIER_KEY]: "v1", [NONCE_KEY]: "n1" });
  const originalLocation = globalThis.location;
  Object.defineProperty(globalThis, "location", {
    value: { assign: () => {} },
    writable: true,
    configurable: true,
  });
  try {
    await new SarvLoginClient(BASE, store).logout();
    assert.equal(store.getItem(NONCE_KEY), null);
  } finally {
    if (originalLocation) {
      Object.defineProperty(globalThis, "location", {
        value: originalLocation,
        writable: true,
        configurable: true,
      });
    } else {
      delete globalThis.location;
    }
  }
});
