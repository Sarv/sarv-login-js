/**
 * Inlines assets/sarv-mark.svg into src/logo.generated.ts.
 *
 * WHY GENERATE RATHER THAN TRANSCRIBE
 * ---------------------------------------------------------------------------
 * The mark is ~7KB of path data. Retyping it into a .ts file guarantees a
 * silent divergence from the theme the first time either changes, and a
 * one-character slip in a bezier is invisible in review. So the file stays a
 * verbatim copy of the asset, and the asset stays a verbatim copy of
 * sarv_theme/icons/sarv-mark.svg (which is never edited).
 *
 * WHY INLINE RATHER THAN <img src>
 * The button renders inside a shadow root on a third-party page. An <img> is a
 * second network request on somebody else's critical path, it cannot be
 * recoloured, and it flashes empty on a cold cache — under a "Continue with
 * Sarv" label that is the whole point of the button. Inline markup paints with
 * the first frame.
 *
 * Run: npm run gen:logo   (also runs as part of `npm run build`)
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = join(ROOT, "assets", "sarv-mark.svg");
const TARGET = join(ROOT, "src", "logo.generated.ts");

const raw = readFileSync(SOURCE, "utf8");

const viewBox = raw.match(/viewBox="([^"]+)"/)?.[1];
if (!viewBox) throw new Error(`${SOURCE}: no viewBox, so the mark cannot be scaled by CSS.`);

const markup = raw
  // Drop the XML prolog and any comment the export tool left behind.
  .replace(/<\?xml[\s\S]*?\?>/g, "")
  .replace(/<!--[\s\S]*?-->/g, "")
  // The intrinsic width/height would win over the CSS box. The viewBox stays,
  // so the mark scales to whatever the button's size gives it.
  .replace(/<svg\b([^>]*)>/, (_all, attrs) => {
    const kept = attrs.replace(/\s(width|height)="[^"]*"/g, "");
    // Decorative: the button's accessible name is its own text, and a second
    // announcement of the logo is noise to a screen reader.
    return `<svg${kept} aria-hidden="true" focusable="false">`;
  })
  .replace(/>\s+</g, "><")
  .trim();

const source = `/**
 * GENERATED FILE - DO NOT EDIT.
 *
 * Written by scripts/gen-logo.mjs from assets/sarv-mark.svg, which is a copy of
 * sarv_theme/icons/sarv-mark.svg. To change the mark, replace the asset and run
 * \`npm run gen:logo\`.
 */

/** The Sarv mark, inline, sized by CSS. viewBox ${viewBox}. */
export const SARV_MARK_SVG = ${JSON.stringify(markup)};
`;

writeFileSync(TARGET, source);
console.log(`gen:logo  ${markup.length} bytes of markup -> src/logo.generated.ts`);
