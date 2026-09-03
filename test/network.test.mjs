/**
 * The two calls that leave the browser: `exchangeCode` and `fetchUser`.
 *
 * `fetch` is stubbed rather than mocked through a library, because what is
 * being asserted is the REQUEST — the method, the content type, the body's
 * field names — and a stub that records the arguments states that directly.
 * The server is not under test here; the wire format is.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { SarvLoginClient } from "../dist/index.js";

const CONFIG = {
  clientId: "demo",
  redirectUri: "https://a.example/cb",
  oauthUrl: "https://oauth.example.com",
};

const CALLBACK = {
  code: "the-code",
  state: "the-state",
  codeVerifier: "the-verifier",
  redirectUri: "https://a.example/cb",
};

/** Replaces fetch for one awaited body and returns what it was called with. */
async function withFetch(reply, run) {
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init });
    return reply;
  };
  try {
    return { calls, result: await run() };
  } finally {
    globalThis.fetch = original;
  }
}

/** The parts of Response these two methods actually touch. */
const response = ({ ok = true, status = 200, body = {}, text }) => ({
  ok,
  status,
  json: async () => body,
  text: async () => text ?? JSON.stringify(body),
});

test("exchangeCode posts the code, the verifier and the same redirect_uri", async () => {
  const client = new SarvLoginClient(CONFIG, memoryStore());
  const { calls, result } = await withFetch(
    response({ body: { access_token: "at", token_type: "Bearer", expires_in: 3600 } }),
    () => client.exchangeCode(CALLBACK)
  );

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://oauth.example.com/api/oauth/token");
  assert.equal(calls[0].init.method, "POST");
  assert.equal(calls[0].init.headers["content-type"], "application/json");

  const body = JSON.parse(calls[0].init.body);
  assert.deepEqual(body, {
    grant_type: "authorization_code",
    code: "the-code",
    // The token request must repeat the redirect URI verbatim; the server
    // compares it against the one in the authorization request.
    redirect_uri: "https://a.example/cb",
    code_verifier: "the-verifier",
    client_id: "demo",
  });
  assert.equal(body.client_secret, undefined, "a public client must never send a secret");
  assert.equal(result.access_token, "at");
});

test("a failed exchange reports the status and the body, not a parse error", async () => {
  const client = new SarvLoginClient(CONFIG, memoryStore());
  // An HTML error page from a proxy is the realistic failure. Parsing it as
  // JSON first would surface "Unexpected token <" and hide the 502.
  await withFetch(
    response({ ok: false, status: 502, text: "<html><body>Bad Gateway</body></html>" }),
    async () => {
      await assert.rejects(() => client.exchangeCode(CALLBACK), (error) => {
        assert.match(error.message, /token exchange failed \(502\)/);
        assert.match(error.message, /Bad Gateway/, "the body is what says why");
        return true;
      });
    }
  );
});

test("an unreadable error body still yields the status", async () => {
  const client = new SarvLoginClient(CONFIG, memoryStore());
  const broken = {
    ok: false,
    status: 500,
    text: async () => {
      throw new Error("stream already consumed");
    },
  };
  await withFetch(broken, async () => {
    await assert.rejects(() => client.exchangeCode(CALLBACK), /token exchange failed \(500\)/);
  });
});

test("a long error body is truncated rather than pasted whole into the message", async () => {
  const client = new SarvLoginClient(CONFIG, memoryStore());
  await withFetch(response({ ok: false, status: 400, text: "x".repeat(5000) }), async () => {
    await assert.rejects(() => client.exchangeCode(CALLBACK), (error) => {
      assert.ok(error.message.length < 400, `the message ran to ${error.message.length} chars`);
      return true;
    });
  });
});

test("fetchUser sends the bearer token and nothing else", async () => {
  const client = new SarvLoginClient(CONFIG, memoryStore());
  const { calls, result } = await withFetch(
    response({ body: { sub: "user-1", email: "a@b.com" } }),
    () => client.fetchUser("the-access-token")
  );

  assert.equal(calls[0].url, "https://oauth.example.com/api/oauth/userinfo");
  assert.equal(calls[0].init.headers.authorization, "Bearer the-access-token");
  assert.equal(calls[0].init.method, undefined, "userinfo is a GET");
  assert.equal(result.sub, "user-1");
});

test("a failed userinfo call names the status", async () => {
  const client = new SarvLoginClient(CONFIG, memoryStore());
  await withFetch(response({ ok: false, status: 401 }), async () => {
    await assert.rejects(() => client.fetchUser("expired"), /userinfo failed \(401\)/);
  });
});

test("a trailing slash on oauthUrl does not produce a double slash in the path", async () => {
  const client = new SarvLoginClient({ ...CONFIG, oauthUrl: "https://oauth.example.com///" }, memoryStore());
  const { calls } = await withFetch(response({}), () => client.fetchUser("t"));
  assert.equal(calls[0].url, "https://oauth.example.com/api/oauth/userinfo");
});

/** A store, so these tests never touch a real sessionStorage. */
function memoryStore() {
  const map = new Map();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
    removeItem: (key) => void map.delete(key),
  };
}
