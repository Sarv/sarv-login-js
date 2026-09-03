/**
 * The look of the button, asserted where it can be asserted without a browser:
 * the generated stylesheet and the inlined mark are both plain strings.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { buttonCss, DARK, LIGHT, SARV_MARK_SVG, SIZES } from "../dist/index.js";

const base = { theme: "auto", variant: "brand", size: "md", fullWidth: false };

test("the mark is inline, scalable and decorative", () => {
  assert.match(SARV_MARK_SVG, /^<svg /);
  assert.match(SARV_MARK_SVG, /viewBox="0 0 86 86"/);
  // An intrinsic width would beat the CSS box and the mark would stop scaling
  // with the button's size.
  assert.doesNotMatch(SARV_MARK_SVG, /<svg[^>]*\swidth=/);
  assert.doesNotMatch(SARV_MARK_SVG, /<svg[^>]*\sheight=/);
  // The button's text is its accessible name; the logo must not be read out too.
  assert.match(SARV_MARK_SVG, /aria-hidden="true"/);
  // The brand blue from the theme survived the copy.
  assert.match(SARV_MARK_SVG, /#3069B0/);
});

test("auto theme resolves in CSS, so an OS theme flip is picked up", () => {
  const css = buttonCss(base);
  assert.match(css, /@media \(prefers-color-scheme: dark\)/);
  assert.match(css, new RegExp(LIGHT.brand));
  assert.match(css, new RegExp(DARK.brand));
});

test("a fixed theme ships only that palette", () => {
  const light = buttonCss({ ...base, theme: "light" });
  assert.doesNotMatch(light, /prefers-color-scheme/);
  assert.doesNotMatch(light, new RegExp(DARK.surface));

  const dark = buttonCss({ ...base, theme: "dark" });
  assert.match(dark, new RegExp(DARK.brand));
});

test("every colour is overridable through a --sarv-login-* property", () => {
  // The seam an embedder is documented to use. A hex with no var() around it
  // would be a value they cannot reach without !important.
  const css = buttonCss(base);
  for (const name of ["brand", "surface", "border", "focus-ring"]) {
    assert.match(css, new RegExp(`var\\(--sarv-login-${name},`));
  }
});

test("the stylesheet never reads a design-system token", () => {
  // Inside a Sarv app `var(--brand)` is correct. Here it resolves to nothing:
  // the host page has no design-system.css, and the button would lose its
  // identity - so only this package's own properties may be referenced.
  const css = buttonCss(base);
  const foreign = css.match(/var\(--(?!sarv-login-|_)[a-z-]+/g);
  assert.equal(foreign, null, `stylesheet reads host tokens: ${foreign}`);
});

test("the brand variant puts a white disc behind the mark", () => {
  // The mark is a full-colour logo with its own white field; on the blue fill it
  // needs the disc the theme gives it via .lp-brand-mark.
  const brand = buttonCss({ ...base, variant: "brand" });
  assert.match(brand, /\.sarv-login-mark \{[^}]*background: #FFFFFF/s);
  // The label sits on the brand fill, which is the same blue in both themes, so
  // it must be fixed white rather than following the surface palette.
  assert.match(brand, /color: #FFFFFF/);

  const surface = buttonCss({ ...base, variant: "surface" });
  assert.doesNotMatch(surface, /\.sarv-login-mark \{[^}]*background: #FFFFFF/s);
  assert.match(surface, /border-color: var\(--_border\)/);
});

test("each size uses the design system's own button height", () => {
  for (const [name, size] of Object.entries(SIZES)) {
    assert.match(buttonCss({ ...base, size: name }), new RegExp(`height, ${size.height}`));
    assert.match(buttonCss({ ...base, size: name }), new RegExp(`font-size: ${size.font}`));
  }
  // .btn in design-system.css is 38px; md is the default and must match it.
  assert.equal(SIZES.md.height, "38px");
});

test("fullWidth changes the host box, not just the inner button", () => {
  assert.match(buttonCss({ ...base, fullWidth: true }), /display: block/);
  assert.match(buttonCss({ ...base, fullWidth: false }), /display: inline-flex/);
});

test("the focus ring is :focus-visible only", () => {
  // A 3px ring on every mouse click is the noise that gets focus styles deleted.
  const css = buttonCss(base);
  assert.match(css, /:focus-visible \{/);
  assert.doesNotMatch(css, /\.sarv-login-btn:focus \{/);
});

test("motion is dropped for visitors who ask for less of it", () => {
  assert.match(buttonCss(base), /@media \(prefers-reduced-motion: reduce\)/);
});

test("inherited properties are re-anchored inside the shadow root", () => {
  // font-family, font-size and line-height cross the shadow boundary, so a host
  // page's 24px body text would otherwise resize the whole button.
  const css = buttonCss(base);
  assert.match(css, /font-family: var\(--sarv-login-font,/);
  assert.match(css, /line-height: 1;/);
  assert.match(css, /box-sizing: border-box/);
});
