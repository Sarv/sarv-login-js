/**
 * The Angular entry: `@sarv-in/login/angular`.
 *
 * There is no Angular here — no @angular/core in devDependencies, no TestBed.
 * That is the design being tested, not a gap in it: the module ships an
 * undecorated class and a plain provider object precisely so it needs neither
 * Angular's compiler nor its runtime. So the tests stand in for Angular's DI
 * the way Angular itself would use it — call the factory, get an instance —
 * and assert the contract that makes that possible.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { loadInBrowser, waitFor } from "./_dom.mjs";

const { document, navigations } = await loadInBrowser();
const { SarvLoginService, provideSarvLogin, isCallbackError, TAG_NAME, nonceProblem } =
  await import("../dist/angular.js");

const CONFIG = { clientId: "demo", redirectUri: "https://a.example/cb" };

test("the service carries no Angular decorator metadata", async () => {
  // If a `@Injectable()` ever appeared here, tsup would emit its metadata and
  // a consumer's AOT build would reject the class as un-compiled. The absence
  // of these keys is what keeps the package free of ng-packagr.
  const source = await import("node:fs").then(({ readFileSync }) =>
    readFileSync(new URL("../dist/angular.js", import.meta.url), "utf8")
  );
  assert.doesNotMatch(source, /__decorate|ɵprov|ɵfac|@angular\/core/);
});

test("provideSarvLogin returns a factory provider Angular can use verbatim", () => {
  const provider = provideSarvLogin(CONFIG);
  assert.equal(provider.provide, SarvLoginService, "the class is its own DI token");
  assert.equal(typeof provider.useFactory, "function");

  // What Angular's injector does with it.
  const injected = provider.useFactory();
  assert.ok(injected instanceof SarvLoginService);
});

test("constructing the service registers the custom element for templates", () => {
  new SarvLoginService(CONFIG);
  assert.ok(
    globalThis.customElements.get(TAG_NAME),
    "a template's <sarv-login-button> cannot upgrade unless the service registered it"
  );
});

test("login() starts the flow", async () => {
  navigations.length = 0;
  await new SarvLoginService(CONFIG).login();
  await waitFor(() => navigations.length > 0, "a navigation from login()");

  const url = new URL(navigations[0]);
  assert.equal(url.searchParams.get("client_id"), "demo");
  assert.equal(url.searchParams.get("code_challenge_method"), "S256");
  assert.ok(url.searchParams.get("nonce"), "openid is a default scope, so a nonce must be sent");
});

test("handleCallback returns an error object a resolver can render", () => {
  const service = new SarvLoginService(CONFIG);
  const result = service.handleCallback("?error=access_denied");
  assert.ok(isCallbackError(result), "isCallbackError is re-exported so the guard is one import");
  assert.equal(result.error, "access_denied");
});

test("logoutUrl points at the end-session endpoint", () => {
  const url = new URL(new SarvLoginService(CONFIG).logoutUrl({ state: "s-1" }));
  assert.equal(url.pathname, "/api/oauth/logout");
  assert.equal(url.searchParams.get("state"), "s-1");
  assert.equal(url.searchParams.get("post_logout_redirect_uri"), "https://a.example");
});

test("mount() renders the button into a host element", () => {
  const host = document.createElement("div");
  document.body.append(host);
  const element = new SarvLoginService(CONFIG).mount(host, { label: "Sign in", size: "lg" });

  assert.equal(element.tagName.toLowerCase(), TAG_NAME);
  assert.equal(element.getAttribute("client-id"), "demo", "the service's own config is reused");
  assert.equal(element.getAttribute("label"), "Sign in");
  assert.equal(element.getAttribute("size"), "lg");
});

test("the flow helpers a backend-exchange app needs are re-exported", () => {
  // An app whose backend does the exchange still has to compare the nonce.
  assert.equal(typeof nonceProblem, "function");
  assert.equal(nonceProblem(undefined, "n-1"), null, "no id_token is not a nonce failure");
});

/** The parts of Response these methods touch. */
const response = ({ ok = true, status = 200, body = {} } = {}) => ({
  ok,
  status,
  json: async () => body,
  text: async () => JSON.stringify(body),
});

/** Replaces fetch for one awaited body, recording what was sent. */
async function withFetch(reply, run) {
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url, body: init?.body ? JSON.parse(init.body) : undefined });
    return reply;
  };
  try {
    return { calls, result: await run() };
  } finally {
    globalThis.fetch = original;
  }
}

/** An unsigned JWT — enough for the nonce comparison, which reads the payload. */
const fakeJwt = (payload) =>
  `header.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.signature`;

test("exchangeCode posts the code and verifies the id_token's nonce", async () => {
  const service = new SarvLoginService(CONFIG);
  const callback = {
    code: "code-1",
    state: "state-1",
    codeVerifier: "verifier-1",
    redirectUri: CONFIG.redirectUri,
    nonce: "n-1",
  };

  const { calls, result } = await withFetch(
    response({ body: { access_token: "at", token_type: "Bearer", expires_in: 900, id_token: fakeJwt({ nonce: "n-1" }) } }),
    () => service.exchangeCode(callback)
  );

  assert.match(calls[0].url, /\/api\/oauth\/token$/);
  assert.equal(calls[0].body.code, "code-1");
  assert.equal(calls[0].body.code_verifier, "verifier-1");
  assert.equal(result.access_token, "at");

  // The guard is inherited, not reimplemented: a token minted for a different
  // login must be refused here exactly as it is in the vanilla client.
  await assert.rejects(
    () =>
      withFetch(
        response({ body: { access_token: "at", token_type: "Bearer", expires_in: 900, id_token: fakeJwt({ nonce: "someone-else" }) } }),
        () => service.exchangeCode(callback)
      ),
    /does not match/
  );
});

test("fetchUser calls userinfo with the bearer token", async () => {
  const { calls, result } = await withFetch(
    response({ body: { sub: "u_1", email: "a@b.example" } }),
    () => new SarvLoginService(CONFIG).fetchUser("at-1")
  );
  assert.match(calls[0].url, /\/api\/oauth\/userinfo$/);
  assert.equal(result.sub, "u_1");
});

test("revokeToken reports whether the server found something to revoke", async () => {
  const { calls, result } = await withFetch(
    response({ body: { revoked: true } }),
    () => new SarvLoginService(CONFIG).revokeToken("rt-1", "refresh_token")
  );
  assert.equal(calls[0].body.token, "rt-1");
  assert.equal(calls[0].body.token_type_hint, "refresh_token");
  assert.equal(result, true);
});

test("logout revokes the app's tokens and then ends the Sarv session", async () => {
  navigations.length = 0;
  const { calls } = await withFetch(response({ body: { revoked: true } }), () =>
    new SarvLoginService(CONFIG).logout({ tokens: { accessToken: "at-1", refreshToken: "rt-1" } })
  );

  assert.equal(calls.length, 2, "both tokens must be revoked");
  await waitFor(() => navigations.length > 0, "the end-session redirect");
  assert.equal(new URL(navigations[0]).pathname, "/api/oauth/logout");
});
