/**
 * Copies the built CDN bundle into the oauth repo's `sdk/js/`, which nginx
 * already serves publicly at `/sdk/` with `Access-Control-Allow-Origin: *`.
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
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
// Sibling checkout by default: both repos live under openSource/.
const oauthRepo = resolve(process.argv[2] ?? join(ROOT, "..", "oauth"));
const target = join(oauthRepo, "sdk", "js");

if (!existsSync(join(oauthRepo, "docker-compose.yml"))) {
  throw new Error(
    `sync:sdk: ${oauthRepo} does not look like the oauth repo (no docker-compose.yml). ` +
      `Pass the path explicitly: npm run sync:sdk -- /path/to/oauth`
  );
}

const bundle = join(ROOT, "dist", "sarv-login.min.js");
if (!existsSync(bundle)) throw new Error("sync:sdk: run `npm run build` first.");

mkdirSync(target, { recursive: true });
for (const name of ["sarv-login.min.js", "sarv-login.min.js.map"]) {
  copyFileSync(join(ROOT, "dist", name), join(target, name));
  console.log(`sync:sdk  -> ${join(target, name)}`);
}
