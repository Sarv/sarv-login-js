/**
 * What the published entry points actually expose.
 *
 * package.json promises `.`, `./react`, `./vue` and `./angular`; nothing else in
 * the suite would notice if a rename left one of them exporting half its API.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import * as main from "../dist/index.js";

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

test("the main entry exposes the documented API", () => {
  for (const name of [
    "renderButton",
    "defineSarvLoginButton",
    "createLogin",
    "SarvLogin",
    "SarvLoginClient",
    "buildAuthorizeUrl",
    "readCallback",
    "isCallbackError",
    "deriveChallenge",
    "buttonCss",
    "SARV_MARK_SVG",
    "TAG_NAME",
    "LOGIN_EVENT",
    "version",
  ]) {
    assert.ok(name in main, `missing export: ${name}`);
  }
  assert.equal(main.TAG_NAME, "sarv-login-button");
  assert.equal(main.LOGIN_EVENT, "sarv-login");
});

test("the reported version is the published version", () => {
  // Written into src by scripts/sync-version.mjs at build time; this is the
  // guard that it ran.
  assert.equal(main.version, pkg.version);
  assert.equal(main.SarvLogin.version, pkg.version);
});

test("importing the package outside a browser does not touch the DOM", async () => {
  // Node is the SSR case in miniature: this suite imported the module at the
  // top of the file, and a `class extends HTMLElement` or a customElements
  // call at module scope would already have thrown.
  assert.equal(typeof globalThis.window, "undefined");
  assert.equal(typeof main.renderButton, "function");
});

test("the react entry loads and exports its component and hook", async () => {
  const react = await import("../dist/react.js");
  assert.equal(typeof react.SarvLoginButton, "function");
  assert.equal(typeof react.useSarvLogin, "function");
});

test("the vue entry loads and exports its component and composable", async () => {
  const vue = await import("../dist/vue.js");
  // defineComponent returns an options object, not a function.
  assert.equal(typeof vue.SarvLoginButton, "object");
  assert.equal(vue.SarvLoginButton.name, "SarvLoginButton");
  assert.equal(typeof vue.useSarvLogin, "function");
});

test("the angular entry loads, and its service survives Angular Universal", async () => {
  const ng = await import("../dist/angular.js");
  assert.equal(typeof ng.SarvLoginService, "function");
  assert.equal(typeof ng.provideSarvLogin, "function");

  // This file has no DOM, which is the server render in miniature. Angular
  // Universal runs the provider factory there, so constructing the service must
  // not reach for `customElements` or `sessionStorage`.
  assert.equal(typeof globalThis.window, "undefined");
  const service = ng.provideSarvLogin({ clientId: "demo", redirectUri: "https://a.example/cb" })
    .useFactory();
  assert.equal(service.client.config.clientId, "demo");
  assert.equal(typeof service.logoutUrl(), "string", "a URL is buildable with no DOM at all");
});

test("the CDN bundle is a single self-contained script", async () => {
  const iife = readFileSync(new URL("../dist/sarv-login.min.js", import.meta.url), "utf8");
  // No import/require left in it: a <script src> has no module loader.
  assert.doesNotMatch(iife, /\brequire\(/);
  assert.doesNotMatch(iife, /^import[\s{]/m);
  // The mark travels with it - the button must paint on the first frame.
  assert.match(iife, /viewBox/);
  assert.ok(iife.length < 60_000, `CDN bundle is ${iife.length} bytes; it ships to every visitor`);
});

test("package.json points the CDN fields at that bundle", () => {
  assert.equal(pkg.unpkg, "./dist/sarv-login.min.js");
  assert.equal(pkg.jsdelivr, "./dist/sarv-login.min.js");
  assert.equal(pkg.exports["."].types, "./dist/index.d.ts");
  assert.equal(pkg.exports["./react"].import, "./dist/react.js");
  assert.equal(pkg.exports["./vue"].import, "./dist/vue.js");
  assert.equal(pkg.exports["./angular"].import, "./dist/angular.js");
  // Every framework entry stays optional: a plain-JS install must not be told
  // it is missing a peer it will never import.
  for (const framework of ["react", "vue"]) {
    assert.ok(pkg.peerDependencies[framework], `${framework} must be a declared peer`);
    assert.equal(pkg.peerDependenciesMeta[framework].optional, true);
  }
  assert.ok(!("@angular/core" in (pkg.peerDependencies ?? {})), "the angular entry imports no Angular");
  // The CJS sourcemaps are built but not published: four of them were a third
  // of the installed package. Dropping the negation would silently restore that.
  assert.ok(pkg.files.includes("!dist/*.cjs.map"), "CJS sourcemaps must stay unpublished");
});
