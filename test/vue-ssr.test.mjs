/**
 * The Vue entry, rendered WITHOUT a DOM — which is the whole point of this file.
 *
 * Nuxt and every other Vue SSR setup imports this module on a server, where
 * `customElements`, `HTMLElement` and `document` do not exist. A registration at
 * module scope would throw here, before a single assertion ran, so the import at
 * the top of this file is itself the test.
 *
 * It is a separate file from vue.test.mjs because `vue/runtime-dom` captures
 * `document` once at module init: a process that has a DOM cannot prove the
 * no-DOM path, and one that does not cannot mount. `node --test` gives each file
 * its own process, so each gets the environment its half needs.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { createSSRApp, h } from "vue";
import { renderToString } from "vue/server-renderer";
import { SarvLoginButton, TAG_NAME, useSarvLogin } from "../dist/vue.js";

const CONFIG = { clientId: "demo", redirectUri: "https://a.example/cb" };

/** Server-renders the button with the given props. */
const ssr = (props) => renderToString(createSSRApp({ render: () => h(SarvLoginButton, props) }));

test("importing the vue entry on a server touches no DOM API", () => {
  assert.equal(typeof globalThis.window, "undefined");
  assert.equal(typeof globalThis.customElements, "undefined");
  assert.equal(typeof SarvLoginButton, "object", "defineComponent returns an options object");
  assert.equal(typeof useSarvLogin, "function");
});

test("it renders the custom element, not a second implementation of the button", async () => {
  const html = await ssr(CONFIG);
  assert.match(html, new RegExp(`^<${TAG_NAME}[ >]`), "the Vue wrapper must render the element");
  assert.doesNotMatch(html, /<button/, "a <button> here would mean the styling was duplicated");
});

test("props become the element's own kebab-case attributes", async () => {
  const html = await ssr({
    ...CONFIG,
    oauthUrl: "https://oauth.example.com",
    scopes: ["openid", "email"],
    label: "Sign in",
    variant: "surface",
    size: "lg",
    theme: "dark",
    href: "/auth/start",
  });
  assert.match(html, /client-id="demo"/);
  assert.match(html, /redirect-uri="https:\/\/a.example\/cb"/);
  assert.match(html, /oauth-url="https:\/\/oauth.example.com"/);
  assert.match(html, /scopes="openid email"/, "an array of scopes becomes one space-joined attribute");
  assert.match(html, /label="Sign in"/);
  assert.match(html, /variant="surface"/);
  assert.match(html, /size="lg"/);
  assert.match(html, /theme="dark"/);
  assert.match(html, /href="\/auth\/start"/);
});

test("kebab-case props from a template are accepted too", async () => {
  // Vue normalises `client-id` to the declared `clientId`. A template writes the
  // dashed form, so if this stopped working every SFC would break at once.
  const html = await ssr({ "client-id": "demo", "redirect-uri": "https://a.example/cb" });
  assert.match(html, /client-id="demo"/);
  assert.match(html, /redirect-uri="https:\/\/a.example\/cb"/);
});

test("boolean props render as bare attributes, and false renders nothing", async () => {
  const on = await ssr({ ...CONFIG, fullWidth: true, disabled: true });
  // Bare, not `="": Vue's SSR writes an empty attribute the way HTML spells a
  // boolean one. Either form is presence, which is what the element reads.
  assert.match(on, /\sfull-width(\s|>)/);
  assert.match(on, /\sdisabled(\s|>)/);

  const off = await ssr({ ...CONFIG, fullWidth: false, disabled: false });
  // `full-width="false"` is the bug being guarded: the element checks for the
  // attribute's PRESENCE, so a literal "false" would read as true.
  assert.doesNotMatch(off, /full-width/);
  assert.doesNotMatch(off, /disabled/);
});

test("an omitted prop is left to the element's own default", async () => {
  const html = await ssr(CONFIG);
  for (const absent of ["label", "variant", "size", "theme", "href", "oauth-url", "scopes"]) {
    assert.doesNotMatch(html, new RegExp(`${absent}=`), `${absent} must not be rendered`);
  }
});

test("an empty scopes array is omitted rather than sent as an empty attribute", async () => {
  const html = await ssr({ ...CONFIG, scopes: [] });
  assert.doesNotMatch(html, /scopes=/);
});

test("class and style fall through to the element", async () => {
  const html = await ssr({ ...CONFIG, class: "w-full", style: { marginTop: "8px" } });
  assert.match(html, /class="w-full"/);
  assert.match(html, /margin-top:8px/);
});
