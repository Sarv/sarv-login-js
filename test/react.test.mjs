/**
 * The React entry point: `@sarv-in/login/react`.
 *
 * Two halves, because the component has two jobs and they fail differently.
 *
 * SERVER: `renderToStaticMarkup` proves the prop -> attribute mapping, which is
 * the part a framework runs before any browser exists. It is also the only place
 * that can prove the SSR promise in react.ts's header comment - that importing
 * the module on a server does not touch `customElements`.
 *
 * CLIENT: `createRoot` + `act` inside happy-dom proves the two effects, the ref
 * forwarding and the listener cleanup. Those are invisible to SSR: a leaked
 * listener renders identical HTML.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { loadInBrowser, waitFor } from "./_dom.mjs";

// The DOM has to exist before react-dom/client is imported: it reads document
// at module scope, and a version imported without one stays broken afterwards.
const { document, navigations } = await loadInBrowser();
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = await import("react-dom/client");
const { act } = await import("react");
const { SarvLoginButton, useSarvLogin, TAG_NAME, LOGIN_EVENT } = await import("../dist/react.js");

const CONFIG = { clientId: "demo", redirectUri: "https://a.example/cb" };

/** Renders into a fresh container and returns it, with the root's teardown. */
async function render(element) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(element));
  return {
    container,
    element: container.querySelector(TAG_NAME),
    rerender: (next) => act(async () => root.render(next)),
    unmount: () => act(async () => root.unmount()),
  };
}

test("it renders the custom element, not a second implementation of the button", () => {
  const html = renderToStaticMarkup(createElement(SarvLoginButton, CONFIG));
  assert.match(html, new RegExp(`^<${TAG_NAME}[ >]`), "the React wrapper must render the element");
  assert.doesNotMatch(html, /<button/, "a <button> here would mean the styling was duplicated");
});

test("props become the element's own kebab-case attributes", () => {
  const html = renderToStaticMarkup(
    createElement(SarvLoginButton, {
      ...CONFIG,
      oauthUrl: "https://oauth.example.com",
      scopes: ["openid", "email"],
      label: "Sign in",
      variant: "surface",
      size: "lg",
      theme: "dark",
      className: "my-class",
    })
  );
  assert.match(html, /client-id="demo"/);
  assert.match(html, /redirect-uri="https:\/\/a.example\/cb"/);
  assert.match(html, /oauth-url="https:\/\/oauth.example.com"/);
  assert.match(html, /scopes="openid email"/, "the array is joined for the attribute");
  assert.match(html, /label="Sign in"/);
  assert.match(html, /variant="surface"/);
  assert.match(html, /size="lg"/);
  assert.match(html, /theme="dark"/);
  assert.match(html, /class="my-class"/);
});

test("boolean props are present-or-absent, never the string false", () => {
  const off = renderToStaticMarkup(
    createElement(SarvLoginButton, { ...CONFIG, fullWidth: false, disabled: false })
  );
  // `full-width="false"` is the bug this guards: the element tests for the
  // attribute's PRESENCE, so the string "false" would enable it.
  assert.doesNotMatch(off, /full-width/, "false must omit the attribute entirely");
  assert.doesNotMatch(off, /disabled/);

  const on = renderToStaticMarkup(
    createElement(SarvLoginButton, { ...CONFIG, fullWidth: true, disabled: true })
  );
  assert.match(on, /full-width=""/);
  assert.match(on, /disabled=""/);
});

test("an omitted prop is left to the element's own default", () => {
  const html = renderToStaticMarkup(createElement(SarvLoginButton, CONFIG));
  for (const attribute of ["label", "variant", "size", "theme", "scopes", "oauth-url"]) {
    assert.doesNotMatch(
      html,
      new RegExp(`${attribute}=`),
      `${attribute} must be absent, not empty - an empty value overrides the default`
    );
  }
});

test("mounting registers the element and upgrades it", async () => {
  const { element } = await render(createElement(SarvLoginButton, CONFIG));
  assert.ok(customElements.get(TAG_NAME), "the mount effect must define the element");
  assert.ok(element.shadowRoot, "the element was rendered but never upgraded");
  assert.equal(element.clientId, "demo");
});

test("elementRef gives the host the element, as a callback and as an object", async () => {
  const seen = [];
  const objectRef = { current: null };
  await render(createElement(SarvLoginButton, { ...CONFIG, elementRef: (el) => seen.push(el) }));
  assert.equal(seen.filter(Boolean).length, 1, "the callback ref must receive the element");

  const { unmount } = await render(createElement(SarvLoginButton, { ...CONFIG, elementRef: objectRef }));
  assert.ok(objectRef.current, "the object ref must receive the element");
  assert.equal(typeof objectRef.current.login, "function", "the ref exists for imperative login()");
  await unmount();
});

test("onLogin sees the cancelable event and can stop the redirect", async () => {
  navigations.length = 0;
  const events = [];
  const { element, unmount } = await render(
    createElement(SarvLoginButton, {
      ...CONFIG,
      onLogin: (event) => {
        events.push(event);
        event.preventDefault();
      },
    })
  );

  element.shadowRoot.querySelector(".sarv-login-btn").click();
  await waitFor(() => events.length > 0, "the onLogin callback");

  assert.equal(events[0].cancelable, true);
  assert.equal(events[0].detail.config.clientId, "demo");
  assert.equal(navigations.length, 0, "preventDefault in onLogin must stop the redirect");
  await unmount();
});

test("the click listener is removed on unmount, not left on the element", async () => {
  let calls = 0;
  const { element, unmount } = await render(
    createElement(SarvLoginButton, {
      ...CONFIG,
      onLogin: (event) => {
        calls += 1;
        event.preventDefault();
      },
    })
  );
  const button = element.shadowRoot.querySelector(".sarv-login-btn");
  button.click();
  await waitFor(() => calls === 1, "the first click");

  await unmount();
  button.click();
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.equal(calls, 1, "the effect's cleanup did not run");
});

test("changing onLogin swaps the listener instead of adding a second one", async () => {
  const first = [];
  const second = [];
  const props = (sink) => ({
    ...CONFIG,
    onLogin: (event) => {
      sink.push(event);
      event.preventDefault();
    },
  });
  const { element, rerender, unmount } = await render(createElement(SarvLoginButton, props(first)));
  await rerender(createElement(SarvLoginButton, props(second)));

  element.shadowRoot.querySelector(".sarv-login-btn").click();
  await waitFor(() => second.length > 0, "the replacement handler");
  assert.equal(first.length, 0, "the old handler was still attached");
  assert.equal(second.length, 1);
  await unmount();
});

test("useSarvLogin keeps one client across renders of an inline config", async () => {
  const clients = [];
  function Host({ suffix }) {
    // A NEW object literal every render - the way props are actually written.
    const { client, login, handleCallback } = useSarvLogin({
      clientId: "demo",
      redirectUri: "https://a.example/cb",
      scopes: ["openid", "email"],
    });
    clients.push(client);
    assert.equal(typeof login, "function");
    assert.equal(typeof handleCallback, "function");
    return createElement("span", null, suffix);
  }

  const { rerender, unmount } = await render(createElement(Host, { suffix: "a" }));
  await rerender(createElement(Host, { suffix: "b" }));
  assert.ok(clients.length >= 2, "the host did not re-render");
  assert.equal(clients[0], clients.at(-1), "the client is memoized on the config's VALUES");
  assert.equal(clients[0].config.scopes.join(" "), "openid email");
  await unmount();
});

test("a changed config value does rebuild the client", async () => {
  const clients = [];
  function Host({ id }) {
    clients.push(useSarvLogin({ clientId: id, redirectUri: "https://a.example/cb" }).client);
    return null;
  }
  const { rerender, unmount } = await render(createElement(Host, { id: "one" }));
  await rerender(createElement(Host, { id: "two" }));
  assert.notEqual(clients[0], clients.at(-1), "a new client id must not reuse the old client");
  assert.equal(clients.at(-1).config.clientId, "two");
  await unmount();
});

test("the react entry re-exports the names a host needs", () => {
  assert.equal(TAG_NAME, "sarv-login-button");
  assert.equal(LOGIN_EVENT, "sarv-login");
});

test("an href prop reaches the element, so a BFF app can use the React button", async () => {
  // The attribute has to survive SSR: a Next.js page renders this on the server
  // and the link must be followable before any JavaScript arrives.
  const html = renderToStaticMarkup(
    createElement(SarvLoginButton, { href: "/auth/sarv/start" })
  );
  assert.match(html, /href="\/auth\/sarv\/start"/);

  const { element } = await render(createElement(SarvLoginButton, { href: "/auth/sarv/start" }));
  assert.equal(element.shadowRoot.querySelector(".sarv-login-btn").tagName, "A");
});
