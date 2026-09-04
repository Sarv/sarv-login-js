/**
 * Keeps README.md's CDN snippets pinned to this version, with the matching
 * Subresource Integrity hash.
 *
 * The npm badge at the top of the README is already live - shields.io reads the
 * registry on every page view - but a badge is not what anyone copies. What gets
 * copied is the `<script>` tag inside the code fence, and markdown cannot fetch
 * anything inside a fence. So the fence is generated instead.
 *
 * THE VERSION AND THE HASH ONLY EVER MOVE TOGETHER. A fresh version beside a
 * stale hash is worse than an old working pair: the browser refuses to run the
 * script, and the reader has no way to tell which of the two lines is wrong.
 * Both are written from the same two sources in the same pass here, so they
 * cannot disagree.
 *
 * Why the hash can be computed before publishing: npm serves the tarball's
 * files byte-for-byte, and jsDelivr and unpkg serve what npm gave them. Hashing
 * the local dist/ build therefore yields exactly the value the published URL
 * will have - verified against the published 1.0.0 file, whose hash reproduced
 * the README's pin exactly.
 *
 * Runs as `postbuild`, not `prebuild`: the hash is of tsup's output, so it only
 * exists once the build has run. `prepublishOnly` runs `check`, which builds,
 * so every published tarball carries a README pinned to the version being
 * published.
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const { name, version } = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
const BUNDLE = join(ROOT, "dist", "sarv-login.min.js");

let bytes;
try {
  bytes = readFileSync(BUNDLE);
} catch {
  throw new Error(
    "sync-cdn-pins: dist/sarv-login.min.js is missing - run `npm run build` first."
  );
}
const hash = createHash("sha384").update(bytes).digest("base64");

// Three shapes carry the pair, and all three have to be rewritten:
//   1. the version in a CDN or npm URL             @sarv-in/login@1.2.3
//   2. the integrity attribute                     sha384-<64 base64 chars>
//   3. the expected output of the reproduce command, a bare comment line
// The third is matched on the exact shape of a sha384 digest - 48 bytes is 64
// unpadded base64 characters - so an ordinary `# comment` cannot collide.
const RULES = [
  { what: "version pin", pattern: new RegExp(`(${name.replace("/", "\\/")}@)\\d+\\.\\d+\\.\\d+`, "g"), replace: (_, head) => `${head}${version}` },
  { what: "integrity attribute", pattern: /sha384-[A-Za-z0-9+/]{64}/g, replace: () => `sha384-${hash}` },
  { what: "reproduce-command output", pattern: /^(# )[A-Za-z0-9+/]{64}$/gm, replace: (_, head) => `${head}${hash}` },
];

const target = join(ROOT, "README.md");
const source = readFileSync(target, "utf8");

let next = source;
for (const { what, pattern, replace } of RULES) {
  const found = next.match(pattern);
  if (!found) {
    // Not a formatting quibble: a README that no longer carries one of these
    // is a README whose snippets have stopped being maintained by anything.
    throw new Error(`sync-cdn-pins: no ${what} found in README.md - has the snippet moved?`);
  }
  next = next.replace(pattern, replace);
}

if (next === source) {
  console.log(`gen:cdn      already ${name}@${version}`);
} else {
  writeFileSync(target, next);
  console.log(`gen:cdn      README.md -> ${name}@${version}, sha384-${hash.slice(0, 12)}...`);
}
