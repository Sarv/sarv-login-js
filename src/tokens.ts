/**
 * Design-system values, copied — deliberately as literals.
 *
 * WHY LITERALS HERE, WHEN A LITERAL HEX IN A COMPONENT IS NORMALLY A BUG
 * ---------------------------------------------------------------------------
 * Inside a Sarv app the rule is absolute: take the token (`var(--brand)`), never
 * the value, because the token is what re-points in dark mode. This package
 * renders on SOMEBODY ELSE'S page. There is no `design-system.css` there, so
 * `var(--brand)` resolves to nothing and the button loses its identity — which
 * is the one thing a "Login with Sarv" button may not do.
 *
 * So the values are copied out of `sarv_theme/design-system.css` (never edited
 * there) and named here, once, with the token they came from. That keeps a
 * single place to reconcile if the palette moves, and keeps every rule in
 * styles.ts reading a name rather than a hex.
 *
 * Every value below is quoted from design-system.css at the line noted. The
 * theme is the source of truth; this file is a dated copy of it.
 */

/** The eight values a surface needs. Both palettes satisfy it, so a rule in
 *  styles.ts can be written once against either one. */
export interface Palette {
  brand: string;
  brandStrong: string;
  surface: string;
  surface2: string;
  border: string;
  ink2: string;
  muted: string;
  focusRing: string;
}

/** Light surface values — design-system.css `:root`. */
export const LIGHT = {
  /** --brand / --color-brand-500 (line 13) */
  brand: "#3069B0",
  /** --brand-strong / --color-brand-600 (line 14) */
  brandStrong: "#275695",
  /** --surface (line 62) */
  surface: "#FFFFFF",
  /** --surface-2 / --color-slate-50 (lines 63, 31) */
  surface2: "#F7F8FB",
  /** --border / --color-slate-200 (line 33) */
  border: "#E6E9F1",
  /** --ink-2 / --color-slate-800 (line 39) */
  ink2: "#2A3450",
  /** --muted / --color-slate-600 (line 37) */
  muted: "#6B7691",
  /** --shadow-focus (line 132) */
  focusRing: "0 0 0 3px rgba(48, 105, 176, 0.20)",
} as const satisfies Palette;

/** Dark surface values — design-system.css `.dark`. */
export const DARK = {
  /** --brand (line 162) */
  brand: "#5B92D2",
  /** --brand-strong (line 165) */
  brandStrong: "#84B0E0",
  /** --surface (line 153) */
  surface: "#131826",
  /** --surface-2 (line 154) */
  surface2: "#181E30",
  /** --border (line 155) */
  border: "#232838",
  /** --ink-2 (line 158) */
  ink2: "#D8DDE9",
  /** --muted (line 159) */
  muted: "#9AA3BC",
  /** --shadow-focus (line 208) */
  focusRing: "0 0 0 3px rgba(91, 146, 210, 0.28)",
} as const satisfies Palette;

/** Shared, theme-independent metrics — design-system.css `:root`. */
export const METRICS = {
  /** --font-sans (line 81). The webfont is NOT pulled in: a third-party button
   *  must not add a network request to someone else's critical path, and the
   *  fallback stack is the theme's own. */
  fontSans: `"Plus Jakarta Sans", system-ui, -apple-system, "Segoe UI", sans-serif`,
  /** --r-md (line 122) */
  radius: "8px",
  /** --space-2 (line 110) */
  gap: "8px",
  /** --space-4 (line 112) */
  padX: "16px",
  /** --fw-bold (line 104) */
  weight: "700",
  /** --tracking-base (line 99) */
  tracking: "-0.005em",
  /** --t-fast (line 138) and --ease-out (line 136) */
  transition: "120ms cubic-bezier(0.22, 1, 0.36, 1)",
  /** .btn-primary's lift — design-system.css line 265. */
  primaryShadow:
    "0 6px 14px -8px rgba(48, 105, 176, 0.55), inset 0 1px 0 rgba(255, 255, 255, 0.18)",
} as const;

/** The three button heights the design system ships: .btn-sm, .btn (default),
 *  .btn-lg — design-system.css lines 233-243. The type sizes beside them are
 *  this package's own, scaled from --fs-base: 13px.
 *
 *  THE ICON SIZES ARE AS LARGE AS EACH BUTTON ALLOWS, ON PURPOSE.
 *  sarv-mark.svg is a fine-line monogram inside a thin ring; the design system
 *  itself never draws it below 32px (`.lp-brand-mark svg` is 32x32, Design
 *  System.html line 409). Below roughly 24px the interior strokes fall under a
 *  device pixel and the glyph turns to mush — measured, not assumed. So each
 *  size takes the biggest mark that fits inside its height with the padding
 *  intact, and `sm` is documented as the one where the mark is at its limit.
 *  The ring survives at every size, which is the shape people recognise, and
 *  the word "Sarv" in the label carries the rest. */
export const SIZES = {
  sm: { height: "30px", font: "12px", icon: "18px", padX: "12px" },
  md: { height: "38px", font: "13px", icon: "24px", padX: METRICS.padX },
  lg: { height: "44px", font: "14px", icon: "28px", padX: "20px" },
} as const;

export type SizeName = keyof typeof SIZES;
