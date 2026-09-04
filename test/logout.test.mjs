/**
 * Signing out: `revokeToken`, `buildLogoutUrl` and `logout`.
 *
 * Its own file because it needs two things the other network tests do not: a
 * `location` to catch the end-session redirect, and a fetch stub that answers
 * each call differently so the ORDER of the two revocations is observable.
 * Order is the part with a reason behind it — revoking the refresh token takes
 * its family with it — so it has to be asserted, not assumed.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { SarvLoginClient, STATE_KEY, VERIFIER_KEY } from "../dist/index.js";

const CONFIG = {
  clientId: "demo",
  redirectUri: "https://app.example.com/auth/callback",
  oauthUrl: "https://oauth.example.com",
};

/** A store, so these tests never touch a real sessionStorage. */
function memoryStore(seed = {}) {
  const map = new Map(Object.entries(seed));
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
    removeItem: (key) => void map.delete(key),
    has: (key) => map.has(key),
  };
}

/** The parts of Response these methods touch. */
const response = ({ ok = true, status = 200, body = {} } = {}) => ({
  ok,
  status,
  json: async () => body,
  text: async () => JSON.stringify(body),
});

/**
 * Replaces fetch and location for one awaited body.
 *
 * `replies` is consumed in order, so a test can make the first revocation fail
 * and the second succeed; the last entry repeats once the queue runs dry.
 */
async function withBrowser(replies, run) {
  const originalFetch = globalThis.fetch;
  const originalLocation = globalThis.location;
  const calls = [];
  const navigations = [];
  const queue = [...replies];
  globalThis.fetch = async (url, init) => {
    calls.push({ url, body: init?.body ? JSON.parse(init.body) : undefined, init });
    const reply = queue.length > 1 ? queue.shift() : queue[0];
    if (reply instanceof Error) throw reply;
    return reply;
  };
  Object.defineProperty(globalThis, "location", {
    value: { assign: (target) => void navigations.push(target) },
    writable: true,
    configurable: true,
  });
  try {
    return { calls, navigations, result: await run() };
  } finally {
    globalThis.fetch = originalFetch;
    if (originalLocation === undefined) delete globalThis.location;
    else
      Object.defineProperty(globalThis, "location", {
        value: originalLocation,
        writable: true,
        configurable: true,
      });
  }
}

/** Captures console.error around an awaited body. */
async function withConsoleError(run) {
  const original = console.error;
  const messages = [];
  console.error = (...args) => void messages.push(args.map(String).join(" "));
  try {
    return { messages, result: await run() };
  } finally {
    console.error = original;
  }
}

test("revokeToken posts the token, the hint and the client id - and no secret", async () => {
  const client = new SarvLoginClient(CONFIG, memoryStore());
  const { calls, result } = await withBrowser([response({ body: { revoked: true } })], () =>
    client.revokeToken("the-refresh-token", "refresh_token")
  );

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://oauth.example.com/api/oauth/revoke");
  assert.equal(calls[0].init.method, "POST");
  assert.equal(calls[0].init.headers["content-type"], "application/json");
  assert.deepEqual(calls[0].body, {
    token: "the-refresh-token",
    token_type_hint: "refresh_token",
    client_id: "demo",
  });
  // Possession of the token is the proof here, as it is for PKCE at the token
  // endpoint. A secret in this body would be a secret in a browser.
  assert.equal("client_secret" in calls[0].body, false);
  assert.equal(result, true);
});

test("revokeToken omits token_type_hint when the caller does not know", async () => {
  const client = new SarvLoginClient(CONFIG, memoryStore());
  const { calls } = await withBrowser([response({ body: { revoked: true } })], () =>
    client.revokeToken("some-token")
  );
  assert.equal("token_type_hint" in calls[0].body, false);
});

test("an already-rotated token resolves false rather than throwing", async () => {
  // `{revoked: false}` is the server's normal answer for a token it could not
  // find. Nothing is wrong: sign-out has to succeed on the second click too.
  const client = new SarvLoginClient(CONFIG, memoryStore());
  const { result } = await withBrowser([response({ body: { revoked: false, message: "not found" } })], () =>
    client.revokeToken("stale", "access_token")
  );
  assert.equal(result, false);
});

test("revokeToken throws when the request itself failed, with the status", async () => {
  const client = new SarvLoginClient(CONFIG, memoryStore());
  await withBrowser([response({ ok: false, status: 401, body: { detail: "Invalid client" } })], async () => {
    await assert.rejects(
      () => client.revokeToken("t", "access_token"),
      /revoke failed \(401\).*Invalid client/s
    );
  });
});

test("buildLogoutUrl always sends both client_id and post_logout_redirect_uri", async () => {
  // With either one missing the server renders raw JSON in the browser window,
  // which is what a user who clicked "sign out" would then be looking at.
  const client = new SarvLoginClient(CONFIG, memoryStore());
  const url = new URL(client.buildLogoutUrl());

  assert.equal(url.origin + url.pathname, "https://oauth.example.com/api/oauth/logout");
  assert.equal(url.searchParams.get("client_id"), "demo");
  // The ORIGIN of the registered redirect URI - the one value that cannot fail
  // the server's origin check.
  assert.equal(url.searchParams.get("post_logout_redirect_uri"), "https://app.example.com");
  assert.equal(url.searchParams.get("state"), null, "nothing unasked-for is added");
  assert.equal(url.searchParams.get("id_token_hint"), null);
});

test("buildLogoutUrl carries a landing page, state and id_token_hint when given", async () => {
  const client = new SarvLoginClient(CONFIG, memoryStore());
  const url = new URL(
    client.buildLogoutUrl({
      postLogoutRedirectUri: "https://app.example.com/signed-out?from=menu",
      state: "back-to-billing",
      idTokenHint: "the-id-token",
    })
  );
  assert.equal(
    url.searchParams.get("post_logout_redirect_uri"),
    "https://app.example.com/signed-out?from=menu"
  );
  assert.equal(url.searchParams.get("state"), "back-to-billing");
  assert.equal(url.searchParams.get("id_token_hint"), "the-id-token");
});

test("a redirectUri that will not parse yields an empty landing page, not a throw", async () => {
  // The server then declines to redirect, which is a wrong-looking landing page
  // - never an exception thrown out of a sign-out button.
  const client = new SarvLoginClient({ ...CONFIG, redirectUri: "not a url" }, memoryStore());
  const url = new URL(client.buildLogoutUrl());
  assert.equal(url.searchParams.get("post_logout_redirect_uri"), "");
});

test("logout revokes the refresh token first, then the access token, then redirects", async () => {
  const client = new SarvLoginClient(CONFIG, memoryStore());
  const { calls, navigations } = await withBrowser([response({ body: { revoked: true } })], () =>
    client.logout({ tokens: { accessToken: "at", refreshToken: "rt" } })
  );

  assert.deepEqual(
    calls.map((call) => [call.body.token, call.body.token_type_hint]),
    [
      // Refresh first: revoking it takes the family with it, so the reverse
      // order can leave a fresh access token alive.
      ["rt", "refresh_token"],
      ["at", "access_token"],
    ]
  );
  assert.equal(navigations.length, 1);
  assert.equal(new URL(navigations[0]).pathname, "/api/oauth/logout");
});

test("logout revokes only the tokens it was given", async () => {
  const client = new SarvLoginClient(CONFIG, memoryStore());
  const { calls, navigations } = await withBrowser([response({ body: { revoked: true } })], () =>
    client.logout({ tokens: { accessToken: "at" } })
  );
  assert.equal(calls.length, 1);
  assert.equal(calls[0].body.token, "at");
  assert.equal(navigations.length, 1);
});

test("a frontend that holds no tokens signs out without a single request", async () => {
  // The BFF shape: the backend did the exchange and holds the tokens, so the
  // page has nothing to revoke and only needs the session ended.
  const client = new SarvLoginClient(CONFIG, memoryStore());
  const { calls, navigations } = await withBrowser([response()], () => client.logout());
  assert.equal(calls.length, 0);
  assert.equal(navigations.length, 1);
});

test("a failed revocation is reported but does not strand the user", async () => {
  const client = new SarvLoginClient(CONFIG, memoryStore());
  const { messages, result } = await withConsoleError(() =>
    withBrowser([new Error("offline")], () =>
      client.logout({ tokens: { refreshToken: "rt" } })
    )
  );

  assert.equal(result.navigations.length, 1, "the redirect must happen anyway");
  assert.match(messages.join(" "), /could not revoke the refresh_token/);
  assert.match(messages.join(" "), /signing out anyway/);
});

test("logout clears the one-time PKCE values it may have left behind", async () => {
  const store = memoryStore({ [STATE_KEY]: "s", [VERIFIER_KEY]: "v" });
  const client = new SarvLoginClient(CONFIG, store);
  await withBrowser([response()], () => client.logout());

  assert.equal(store.has(STATE_KEY), false);
  assert.equal(store.has(VERIFIER_KEY), false);
});

test("a body that will not read does not replace the real failure", async () => {
  // A proxy or a gateway can answer an error with no body at all. The status is
  // the useful half; losing it to a parse error thrown while reading the
  // useless half would hide what actually happened.
  const client = new SarvLoginClient(CONFIG, memoryStore());
  const unreadable = {
    ok: false,
    status: 502,
    text: async () => {
      throw new Error("body stream already read");
    },
    json: async () => {
      throw new Error("body stream already read");
    },
  };
  await withBrowser([unreadable], async () => {
    await assert.rejects(() => client.revokeToken("t"), /revoke failed \(502\)/);
  });
});

test("a success with an unparseable body counts as nothing revoked", async () => {
  // 200 with a non-JSON body means the server did not say `revoked: true`, and
  // the honest answer to "did it revoke" is no - not an exception on a path
  // whose failure mode is already benign.
  const client = new SarvLoginClient(CONFIG, memoryStore());
  const { result } = await withBrowser(
    [
      {
        ok: true,
        status: 200,
        json: async () => {
          throw new Error("not json");
        },
        text: async () => "",
      },
    ],
    () => client.revokeToken("t")
  );
  assert.equal(result, false);
});
