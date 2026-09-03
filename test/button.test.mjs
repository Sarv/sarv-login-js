/**
 * The custom element's behaviour, in a DOM.
 *
 * Everything here is about logic, not looks: what it reads, what it renders,
 * what it dispatches, and what it stores before it navigates. Appearance is
 * verified in Chromium by `e2e/login-button.mjs` - see test/_dom.mjs.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { innerButton, loadInBrowser, mount, pause, waitFor, withConsoleError } from "./_dom.mjs";

const { window, document, module, navigations } = await loadInBrowser();
const { TAG_NAME, DEFAULT_LABEL, LOGIN_EVENT, renderButton, defineSarvLoginButton } = module;

/** Resets the page between tests.
 *
 *  It also drops the previous test's listeners, which is the one thing
 *  `innerHTML = ""` cannot do: a listener on `document` outlives the element it
 *  was watching. That was not a harmless leak here - the cancel test's listener
 *  calls preventDefault(), so it silently cancelled the clicks of every test
 *  that ran after it, and those tests failed for a reason that was not in them.
 *  Register with `on()` and the signal takes them away. */
let listeners = new AbortController();

const clear = () => {
  listeners.abort();
  listeners = new AbortController();
  navigations.length = 0;
  window.sessionStorage.clear();
  document.body.innerHTML = "";
};

/** addEventListener, scoped to the running test. */
const on = (target, type, handler) =>
  target.addEventListener(type, handler, { signal: listeners.signal });

test("importing the bundle in a browser registers the element", () => {
  assert.ok(customElements.get(TAG_NAME), `${TAG_NAME} was not defined on import`);
});

test("it renders a real button, with the mark and the default label", () => {
  clear();
  const element = mount(TAG_NAME, { "client-id": "demo", "redirect-uri": "https://a.example/cb" });
  const button = innerButton(element);

  assert.equal(button.tagName, "BUTTON");
  assert.equal(button.getAttribute("type"), "button", "must not submit a surrounding form");
  assert.equal(element.shadowRoot.querySelector(".sarv-login-label").textContent, DEFAULT_LABEL);

  const svg = element.shadowRoot.querySelector(".sarv-login-mark svg");
  assert.ok(svg, "the brand mark is missing");
  assert.equal(svg.getAttribute("aria-hidden"), "true", "the mark is decorative beside the label");
  assert.equal(svg.querySelectorAll("path").length, 4, "the mark lost paths");
});

test("a label attribute replaces the default, and updating it re-renders", () => {
  clear();
  const element = mount(TAG_NAME, { label: "Sign in to continue" });
  const labelOf = () => element.shadowRoot.querySelector(".sarv-login-label").textContent;
  assert.equal(labelOf(), "Sign in to continue");

  element.label = "Use my Sarv account";
  assert.equal(labelOf(), "Use my Sarv account", "attributeChangedCallback did not re-render");
  assert.equal(element.getAttribute("label"), "Use my Sarv account", "the property did not reflect");
});

test("a typo in variant, size or theme falls back instead of breaking the button", () => {
  clear();
  const element = mount(TAG_NAME, { variant: "outline", size: "huge", theme: "midnight" });
  assert.equal(element.variant, "brand");
  assert.equal(element.size, "md");
  assert.equal(element.theme, "auto");
  assert.ok(innerButton(element), "a bad attribute value must still render a button");
});

test("properties and attributes are two views of the same state", () => {
  clear();
  const element = mount(TAG_NAME);

  element.clientId = "client-42";
  element.redirectUri = "https://a.example/cb";
  assert.equal(element.getAttribute("client-id"), "client-42");
  assert.equal(element.getAttribute("redirect-uri"), "https://a.example/cb");

  element.scopes = ["openid", "email"];
  assert.equal(element.getAttribute("scopes"), "openid email", "scopes go on the wire space-separated");

  // Commas are accepted on the way in, because that is what people type.
  element.setAttribute("scopes", "openid, email , profile");
  assert.deepEqual(element.scopes, ["openid", "email", "profile"]);

  element.scopes = [];
  assert.equal(element.getAttribute("scopes"), null, "an empty list removes the attribute");

  element.fullWidth = true;
  element.disabled = true;
  assert.ok(element.hasAttribute("full-width"));
  assert.ok(element.hasAttribute("disabled"));
  element.fullWidth = false;
  assert.equal(element.hasAttribute("full-width"), false);
});

test("a click stores the verifier and state, then navigates to authorize", async () => {
  clear();
  const element = mount(TAG_NAME, {
    "client-id": "demo",
    "redirect-uri": "https://a.example/cb",
    "oauth-url": "https://oauth.example.com/",
    scopes: "openid email",
  });

  innerButton(element).click();
  await waitFor(() => navigations.length > 0, "a navigation to the authorize endpoint");

  assert.equal(navigations.length, 1, "the click did not navigate");
  const url = new URL(navigations[0]);
  assert.equal(url.origin + url.pathname, "https://oauth.example.com/api/oauth/authorize");
  assert.equal(url.searchParams.get("client_id"), "demo");
  assert.equal(url.searchParams.get("code_challenge_method"), "S256");
  assert.equal(url.searchParams.get("scope"), "openid email");

  const verifier = window.sessionStorage.getItem("sarv_code_verifier");
  assert.ok(verifier, "the verifier must be stored before the redirect, not after");
  assert.equal(url.searchParams.get("state"), window.sessionStorage.getItem("sarv_oauth_state"));
});

test("the sarv-login event escapes the shadow root and can cancel the redirect", async () => {
  clear();
  const element = mount(TAG_NAME, { "client-id": "demo", "redirect-uri": "https://a.example/cb" });

  const seen = [];
  on(document, LOGIN_EVENT, (event) => {
    seen.push(event);
    event.preventDefault();
  });

  innerButton(element).click();
  await waitFor(() => seen.length > 0, "the sarv-login event at the document");
  // The event is synchronous but the redirect it cancels is not, so the
  // negative assertions below need the redirect's whole window to elapse.
  await pause();

  assert.equal(seen.length, 1, "the event did not bubble to the document");
  assert.equal(seen[0].cancelable, true);
  assert.equal(seen[0].detail.config.clientId, "demo", "the listener needs the config to act on it");
  assert.equal(navigations.length, 0, "preventDefault must stop the redirect");
  assert.equal(
    window.sessionStorage.getItem("sarv_code_verifier"),
    null,
    "a cancelled click must not leave a verifier behind"
  );
});

test("a disabled button ignores clicks entirely", async () => {
  clear();
  const element = mount(TAG_NAME, {
    "client-id": "demo",
    "redirect-uri": "https://a.example/cb",
    disabled: "",
  });

  let fired = 0;
  on(document, LOGIN_EVENT, () => void (fired += 1));
  innerButton(element).click();
  await pause();

  assert.equal(fired, 0, "a disabled button must not dispatch");
  assert.equal(navigations.length, 0);
});

test("without a config it explains itself rather than failing silently", async () => {
  clear();
  const element = mount(TAG_NAME, { "client-id": "demo" }); // no redirect-uri
  const { messages } = await withConsoleError(async (live) => {
    innerButton(element).click();
    await waitFor(() => live.length > 0, "the guidance on console.error");
  });

  assert.equal(navigations.length, 0);
  assert.match(messages.join(" "), /client-id/);
  assert.match(messages.join(" "), /redirect-uri/);
});

test("a styled trigger with no config still dispatches, for hosts that own the flow", async () => {
  clear();
  const element = mount(TAG_NAME);
  let fired = 0;
  on(element, LOGIN_EVENT, (event) => {
    fired += 1;
    event.preventDefault();
  });
  innerButton(element).click();
  await waitFor(() => fired > 0, "a dispatch from the styled trigger");
  assert.equal(fired, 1, "the button is usable as a pure trigger");
});

test("renderButton replaces the container's children instead of stacking", () => {
  clear();
  const host = document.createElement("div");
  document.body.append(host);

  renderButton(host, { clientId: "demo", redirectUri: "https://a.example/cb", size: "lg" });
  renderButton(host, { clientId: "demo", redirectUri: "https://a.example/cb", size: "sm" });

  const buttons = host.querySelectorAll(TAG_NAME);
  assert.equal(buttons.length, 1, "calling it twice must not leave two buttons");
  assert.equal(buttons[0].size, "sm", "the second call's options must win");
});

test("renderButton accepts a selector, and defineSarvLoginButton is idempotent", () => {
  clear();
  const host = document.createElement("div");
  host.id = "login-slot";
  document.body.append(host);

  renderButton("#login-slot", { clientId: "demo", redirectUri: "https://a.example/cb" });
  assert.equal(host.querySelectorAll(TAG_NAME).length, 1);

  defineSarvLoginButton();
  defineSarvLoginButton();
  assert.ok(customElements.get(TAG_NAME));
});

test("the browser globals are installed without clobbering a host's own", () => {
  assert.equal(typeof window.SarvLogin.createLogin, "function");
  assert.equal(typeof window.SarvAuth.init, "function", "the 1.x global must still exist");
  assert.equal(window.SarvAuth.version, module.version);
});

test("the oauth-url property reflects, and clearing it restores the default", async () => {
  clear();
  const element = mount(TAG_NAME, { "client-id": "demo", "redirect-uri": "https://a.example/cb" });

  element.oauthUrl = "https://staging.example.com";
  assert.equal(element.getAttribute("oauth-url"), "https://staging.example.com");
  innerButton(element).click();
  await waitFor(() => navigations.length > 0, "a redirect to the staging server");
  assert.match(navigations[0], /^https:\/\/staging\.example\.com\//);

  navigations.length = 0;
  element.oauthUrl = null;
  assert.equal(element.hasAttribute("oauth-url"), false, "null must remove the attribute");
  innerButton(element).click();
  await waitFor(() => navigations.length > 0, "a redirect to the default server");
  assert.match(navigations[0], /^https:\/\/oauth\.sarv\.com\//, "it falls back to the default");
});

test("a login that cannot start says so instead of failing silently", async () => {
  clear();
  const element = mount(TAG_NAME, {
    "client-id": "demo",
    "redirect-uri": "https://a.example/cb",
  });

  // The realistic cause is an http:// page, where Web Crypto does not exist.
  // The click handler cannot throw usefully - the page swallows it - so the
  // failure has to arrive as a message a developer will actually find.
  //
  // `getRandomValues` is what it names, not `subtle`: the verifier is minted
  // before the challenge is derived from it, so that is the call that fails
  // first. Both come from the same missing `crypto`.
  const original = Object.getOwnPropertyDescriptor(globalThis, "crypto");
  Object.defineProperty(globalThis, "crypto", { value: undefined, configurable: true });
  try {
    const { messages } = await withConsoleError(async (live) => {
      innerButton(element).click();
      await waitFor(() => live.length > 0, "the failure message");
    });
    assert.match(messages.join(" "), /login failed to start/);
    assert.match(messages.join(" "), /crypto\.getRandomValues is unavailable/, "it must name the real cause");
  } finally {
    Object.defineProperty(globalThis, "crypto", original);
  }
  assert.equal(navigations.length, 0);
});

test("renderButton can append beside a container's contents instead of replacing", () => {
  clear();
  const host = document.createElement("div");
  host.innerHTML = "<p>Already here</p>";
  document.body.append(host);

  renderButton(host, {
    clientId: "demo",
    redirectUri: "https://a.example/cb",
    replace: false,
  });

  assert.ok(host.querySelector("p"), "replace: false must keep the existing content");
  assert.equal(host.lastElementChild.tagName.toLowerCase(), TAG_NAME, "the button goes last");
});
