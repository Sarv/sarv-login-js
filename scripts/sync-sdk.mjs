/**
 * Pushes this build into the oauth repo: the bundle itself into `sdk/js/`,
 * which nginx already serves publicly at `/sdk/` with
 * `Access-Control-Allow-Origin: *`, and the version/hash pair into the pin the
 * developer docs fall back to.
 *
 * WHY BOTH A REGISTRY AND A SELF-HOSTED COPY
 * ---------------------------------------------------------------------------
 * jsDelivr and unpkg are the convenient path, but they are third parties: a
 * client whose security review forbids loading script from a CDN they do not
 * control, or who is behind a network that blocks one, still needs a URL. The
 * self-hosted copy is that URL, on the same origin as the authorization server
 * the button talks to.
 *
 * The copy is a build artefact, so it MUST be refreshed on every release -
 * `npm run sync:sdk` right after `npm run build`. A stale copy serving an older
 * button than the registry is the failure mode to avoid.
 *
 * Run: npm run sync:sdk [-- /path/to/oauth]
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { readPin, ROOT } from "./lib/bundle-pin.mjs";

// Sibling checkout by default: both repos live under openSource/.
const oauthRepo = resolve(process.argv[2] ?? join(ROOT, "..", "oauth"));
const target = join(oauthRepo, "sdk", "js");

if (!existsSync(join(oauthRepo, "docker-compose.yml"))) {
  throw new Error(
    `sync:sdk: ${oauthRepo} does not look like the oauth repo (no docker-compose.yml). ` +
      `Pass the path explicitly: npm run sync:sdk -- /path/to/oauth`
  );
}

let pin;
try {
  pin = readPin();
} catch (error) {
  throw new Error(`sync:sdk: ${error.message}`);
}

mkdirSync(target, { recursive: true });
for (const file of ["sarv-login.min.js", "sarv-login.min.js.map"]) {
  copyFileSync(join(ROOT, "dist", file), join(target, file));
  console.log(`sync:sdk  -> ${join(target, file)}`);
}

/**
 * The docs page reads the version and hash live from npm and jsDelivr, so a
 * reader with working network always sees the truth. `PINNED` is what it paints
 * before that lookup returns and what it keeps if the lookup fails - so a stale
 * one is a script tag with a hash that no longer matches its version, shown to
 * exactly the readers whose network is already having a bad day.
 *
 * It is the last copy of this pair that was maintained by hand, which is why it
 * is written from here: the release that changes the bundle is the release that
 * has to change the pin, and that is this script's whole job already.
 */
const pinnedFile = join(
  oauthRepo, "admin-ui", "app", "dashboard", "docs", "_components", "npm-release.ts"
);

if (!existsSync(pinnedFile)) {
  // Not fatal: an older checkout, or a branch where the docs page does not
  // exist yet, should still get the bundle. Loud, because the pin it could not
  // reach is now one release behind.
  console.warn(`sync:sdk  WARN: no ${pinnedFile} - PINNED not updated`);
} else {
  const source = readFileSync(pinnedFile, "utf8");
  // Anchored on the declaration so the two string literals can only be matched
  // inside it - `version:` and `integrity:` also appear in the Release type and
  // in the live-lookup path.
  const block = /(export const PINNED: Release = \{\s*\n\s*version: ")[^"]*(",\s*\n\s*integrity: ")[^"]*(",)/;
  if (!block.test(source)) {
    throw new Error(
      `sync:sdk: could not find the PINNED declaration in ${pinnedFile} - has it been renamed?`
    );
  }
  const next = source.replace(block, (_, a, b, c) => `${a}${pin.version}${b}${pin.integrity}${c}`);
  if (next === source) {
    console.log(`sync:sdk  PINNED already ${pin.name}@${pin.version}`);
  } else {
    writeFileSync(pinnedFile, next);
    console.log(`sync:sdk  PINNED -> ${pin.name}@${pin.version}, ${pin.integrity.slice(0, 19)}...`);
  }
}
