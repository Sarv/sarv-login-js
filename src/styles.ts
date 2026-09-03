/**
 * The button's stylesheet, built from tokens.ts.
 *
 * WHY A SHADOW ROOT
 * ---------------------------------------------------------------------------
 * This renders on a page whose CSS we have never seen. A global `button { ... }`
 * rule, a Bootstrap reset, a Tailwind preflight or a stray `* { box-sizing }`
 * would each reshape the button, and there is no selector specificity that wins
 * reliably against all of them. A shadow root is the only boundary that does:
 * outside rules do not reach in (except inherited properties, which is why
 * `font`, `line-height`, `letter-spacing` and `color` are all restated below).
 *
 * WHAT AN EMBEDDER MAY STILL CHANGE
 * Custom properties DO cross the boundary, so every value a host might
 * reasonably want to align with their own design is read through a
 * `--sarv-login-*` variable with the design-system value as its fallback. That
 * gives them a documented seam instead of a `!important` fight.
 */
import { DARK, LIGHT, METRICS, SIZES } from "./tokens.js";
import type { Palette } from "./tokens.js";
import type { SarvSize, SarvTheme, SarvVariant } from "./types.js";

/** Palette-to-custom-property block, so light and dark differ in one place. */
function palette(colors: Palette): string {
  return `
    --_brand: var(--sarv-login-brand, ${colors.brand});
    --_brand-strong: var(--sarv-login-brand-strong, ${colors.brandStrong});
    --_surface: var(--sarv-login-surface, ${colors.surface});
    --_surface-2: var(--sarv-login-surface-2, ${colors.surface2});
    --_border: var(--sarv-login-border, ${colors.border});
    --_ink: var(--sarv-login-ink, ${colors.ink2});
    --_muted: var(--sarv-login-muted, ${colors.muted});
    --_focus-ring: var(--sarv-login-focus-ring, ${colors.focusRing});`;
}

/**
 * The full stylesheet for one configuration.
 *
 * Size and variant are baked in rather than expressed as `:host([size=lg])`
 * selectors: the element re-renders its stylesheet when an attribute changes,
 * and a sheet that only describes the current state is a third the size on the
 * wire — which matters for a bundle every embedder ships.
 */
export function buttonCss(options: {
  theme: SarvTheme;
  variant: SarvVariant;
  size: SarvSize;
  fullWidth: boolean;
}): string {
  const size = SIZES[options.size];
  const brand = options.variant === "brand";

  // `auto` resolves in CSS, not in JS: reading prefers-color-scheme once at
  // render time would leave the button stale when the visitor flips their OS
  // theme, and matchMedia listeners for something CSS already does are waste.
  const themeBlock =
    options.theme === "auto"
      ? `:host { ${palette(LIGHT)} }
@media (prefers-color-scheme: dark) {
  :host { ${palette(DARK)} }
}`
      : `:host { ${palette(options.theme === "dark" ? DARK : LIGHT)} }`;

  return `${themeBlock}

:host {
  /* inline-flex, not block: the button should sit in a line of text like any
     other control unless the host asks for full width. */
  display: ${options.fullWidth ? "block" : "inline-flex"};
  ${options.fullWidth ? "width: 100%;" : ""}
  /* Inherited properties pierce the shadow boundary, so the host's font-size
     would scale the whole button. Anchored here instead. */
  font-family: var(--sarv-login-font, ${METRICS.fontSans});
  font-size: ${size.font};
  line-height: 1;
  contain: layout style;
}

:host([hidden]) { display: none; }

.sarv-login-btn {
  /* Every box property restated: a host reset is not visible from in here, but
     neither are the UA defaults this replaces. */
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--sarv-login-gap, ${METRICS.gap});
  width: ${options.fullWidth ? "100%" : "auto"};
  height: var(--sarv-login-height, ${size.height});
  margin: 0;
  padding: 0 ${size.padX};
  border: 1px solid transparent;
  border-radius: var(--sarv-login-radius, ${METRICS.radius});
  font: inherit;
  font-weight: ${METRICS.weight};
  letter-spacing: ${METRICS.tracking};
  text-align: center;
  text-decoration: none;
  white-space: nowrap;
  cursor: pointer;
  appearance: none;
  -webkit-appearance: none;
  transition: background-color ${METRICS.transition}, border-color ${METRICS.transition},
    box-shadow ${METRICS.transition}, color ${METRICS.transition};
}

${
  brand
    ? `.sarv-login-btn {
  background: var(--_brand);
  border-color: var(--_brand);
  /* Fixed white, not --_surface: the label sits on the brand fill, which is the
     same blue in both themes, so it must not follow the surface palette. */
  color: #FFFFFF;
  box-shadow: ${METRICS.primaryShadow};
}
.sarv-login-btn:hover { background: var(--_brand-strong); border-color: var(--_brand-strong); }`
    : `.sarv-login-btn {
  background: var(--_surface);
  border-color: var(--_border);
  color: var(--_ink);
}
.sarv-login-btn:hover { background: var(--_surface-2); }`
}

/* :focus-visible only. A mouse click focuses the button too, and painting a
   3px ring on every click is the noise that makes people remove focus styles
   altogether. */
.sarv-login-btn:focus-visible {
  outline: none;
  box-shadow: var(--_focus-ring)${brand ? `, ${METRICS.primaryShadow}` : ""};
}

.sarv-login-btn:active { transform: translateY(1px); }

.sarv-login-btn[disabled] {
  cursor: not-allowed;
  opacity: 0.55;
  box-shadow: none;
  transform: none;
}

.sarv-login-mark {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  width: ${size.icon};
  height: ${size.icon};
  border-radius: 50%;
  /* The mark is a full-colour logo with its own white field, so on the brand
     fill it needs the white disc behind it that .lp-brand-mark gives it in the
     theme; on a surface button the page is already light enough. */
  ${brand ? "background: #FFFFFF;" : ""}
  overflow: hidden;
}

.sarv-login-mark svg {
  display: block;
  width: 100%;
  height: 100%;
}

.sarv-login-label {
  /* The label is the accessible name; nothing may clip it silently. */
  overflow: visible;
}

/* Honour a visitor who has asked for less motion: the transition is decoration,
   the state change is not. */
@media (prefers-reduced-motion: reduce) {
  .sarv-login-btn { transition: none; }
  .sarv-login-btn:active { transform: none; }
}
`;
}
