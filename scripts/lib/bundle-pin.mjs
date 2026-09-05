/**
 * The one place the "what to pin" pair is computed: the version being shipped,
 * and the Subresource Integrity hash of the bundle a `<script>` tag loads.
 *
 * Two scripts need it — `sync-cdn-pins.mjs` writes it into this repo's README,
 * `sync-sdk.mjs` writes it into the oauth repo's docs page — and they must
 * never disagree, so neither computes it itself.
 *
 * The hash is of the LOCAL build, which is the same value the published URL
 * will have: npm serves the tarball's files byte for byte, and jsDelivr and
 * unpkg serve what npm gave them. So a pin can be written before the release
 * exists. Note that the version is part of the bytes — the bundle reports its
 * own `version` — so bumping the version changes the hash. They are one fact,
 * not two, which is why they are returned together.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** The repo root, from this file's location — no dependency on the cwd. */
export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

/** The file both the CDN URLs and the self-hosted URL point at. */
export const BUNDLE = join(ROOT, "dist", "sarv-login.min.js");

/**
 * @returns {{name: string, version: string, integrity: string, hash: string}}
 *   `integrity` is a complete SRI value; `hash` is the same digest bare, for
 *   the places that print it without the algorithm prefix.
 */
export function readPin() {
  const { name, version } = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));

  let bytes;
  try {
    bytes = readFileSync(BUNDLE);
  } catch {
    throw new Error("dist/sarv-login.min.js is missing - run `npm run build` first.");
  }
  const hash = createHash("sha384").update(bytes).digest("base64");

  return { name, version, integrity: `sha384-${hash}`, hash };
}
