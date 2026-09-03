/**
 * Keeps `version` in src/index.ts equal to package.json's.
 *
 * The bundle reports its own version (`SarvLogin.version`) because that is the
 * first thing anyone asks for when debugging a client integration: "which build
 * is on the page?". Importing package.json to get it would either need a JSON
 * import assertion in every consumer's bundler or ship package.json to the
 * browser, so the literal is written in instead — by a script, at build time,
 * so it cannot drift from the published version.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const { version } = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
const target = join(ROOT, "src", "index.ts");

const source = readFileSync(target, "utf8");
const next = source.replace(
  /(export const version = ")[^"]*(";)/,
  (all, head, tail) => `${head}${version}${tail}`
);
if (next === source) {
  if (!source.includes(`export const version = "${version}"`)) {
    throw new Error("sync-version: no `export const version = \"...\"` line in src/index.ts.");
  }
  console.log(`gen:version  already ${version}`);
} else {
  writeFileSync(target, next);
  console.log(`gen:version  src/index.ts -> ${version}`);
}
