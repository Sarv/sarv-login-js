/**
 * The Vue entry, mounted in a DOM.
 *
 * SSR proves the prop -> attribute mapping (see vue-ssr.test.mjs). This half
 * proves the things SSR cannot see: that the element gets registered and
 * upgrades, that `@sarv-login` reaches it through Vue's attribute fallthrough,
 * and that the exposed handle is the ELEMENT rather than the component instance.
 *
 * The DOM is installed before `vue` is imported, because vue/runtime-dom
 * captures `document` at module init and a copy imported without one can never
 * mount afterwards.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { loadInBrowser, waitFor } from "./_dom.mjs";

const { document, navigations } = await loadInBrowser();
const { createApp, h, ref } = await import("vue");
const { SarvLoginButton, useSarvLogin, TAG_NAME, LOGIN_EVENT } = await import("../dist/vue.js");

const CONFIG = { clientId: "demo", redirectUri: "https://a.example/cb" };

/** Mounts a render function into a fresh container and returns the pieces. */
function mount(render) {
  const container = document.createElement("div");
  document.body.append(container);
  const app = createApp({ render });
  app.mount(container);
  return {
    container,
    element: container.querySelector(TAG_NAME),
    unmount: () => app.unmount(),
  };
}

test("mounting registers the element and upgrades it", () => {
  const { element, unmount } = mount(() => h(SarvLoginButton, CONFIG));
  assert.ok(element, "the wrapper must render the custom element");
  assert.ok(element.shadowRoot, "no shadow root means the element never upgraded");
  assert.equal(typeof element.login, "function", "the upgraded element exposes login()");
  unmount();
});

test("@sarv-login sees the cancelable event and can stop the redirect", async () => {
  navigations.length = 0;
  const events = [];
  // `onSarvLogin` is what a template's `@sarv-login` compiles to. Vue hyphenates
  // it back and, because this component has a single root element and declares
  // no `emits`, attribute fallthrough puts the listener on the element itself.
  const { element, unmount } = mount(() =>
    h(SarvLoginButton, {
      ...CONFIG,
      onSarvLogin: (event) => {
        events.push(event);
        event.preventDefault();
      },
    })
  );

  element.shadowRoot.querySelector(".sarv-login-btn").click();
  await waitFor(() => events.length > 0, "the @sarv-login handler");

  assert.equal(events[0].type, LOGIN_EVENT);
  assert.equal(events[0].cancelable, true);
  assert.equal(events[0].detail.config.clientId, "demo");
  assert.equal(navigations.length, 0, "preventDefault must stop the redirect");
  unmount();
});

test("a parent's ref reaches the element, not the component instance", () => {
  const handle = ref(null);
  const { element, unmount } = mount(() => h(SarvLoginButton, { ...CONFIG, ref: handle }));

  assert.ok(handle.value, "the ref must be populated");
  assert.equal(handle.value.element, element, "`element` must be the custom element");
  assert.equal(typeof handle.value.login, "function", "the handle exists for imperative login()");
  unmount();
});

test("the exposed login() starts the flow on the element", async () => {
  navigations.length = 0;
  const handle = ref(null);
  const { unmount } = mount(() => h(SarvLoginButton, { ...CONFIG, ref: handle }));

  await handle.value.login();
  await waitFor(() => navigations.length > 0, "a navigation from the exposed login()");
  assert.match(navigations[0], /\/api\/oauth\/authorize\?/);
  unmount();
});

test("useSarvLogin gives a working client without the button", async () => {
  navigations.length = 0;
  let api;
  const { unmount } = mount(() => {
    api ??= useSarvLogin(CONFIG);
    return h("span");
  });

  assert.ok(api.client, "the composable must expose the client");
  await api.login();
  await waitFor(() => navigations.length > 0, "a navigation from the composable");

  const url = new URL(navigations[0]);
  assert.equal(url.searchParams.get("client_id"), "demo");
  assert.equal(url.searchParams.get("code_challenge_method"), "S256");
  assert.ok(url.searchParams.get("nonce"), "openid is a default scope, so a nonce must be sent");
  unmount();
});

test("handleCallback from the composable reports a state mismatch rather than throwing", () => {
  let api;
  const { unmount } = mount(() => {
    api ??= useSarvLogin(CONFIG);
    return h("span");
  });

  const result = api.handleCallback("?code=abc&state=forged");
  assert.equal(result.error, "state_mismatch");
  unmount();
});
