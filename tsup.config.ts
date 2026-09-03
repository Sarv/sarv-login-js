import { defineConfig } from "tsup";

export default defineConfig([
  {
    // The package build: ESM first, CJS alongside it because plenty of Node
    // toolchains still `require()`, and .d.ts because the whole API is typed.
    entry: { index: "src/index.ts", react: "src/react.ts" },
    format: ["esm", "cjs"],
    dts: true,
    sourcemap: true,
    clean: true,
    target: "es2020",
    // React is a peer, never bundled: two Reacts on one page is a broken app.
    external: ["react"],
  },
  {
    // The CDN build: one file, one global, no imports. This is what a plain
    // <script src="https://cdn.jsdelivr.net/npm/@sarv/login"> gets, so it has
    // to work with no bundler, no module loader and no build step at all.
    entry: { "sarv-login.min": "src/index.ts" },
    format: ["iife"],
    globalName: "SarvLoginBundle",
    minify: true,
    sourcemap: true,
    dts: false,
    // Not cleaned: this config runs after the one above and would delete it.
    clean: false,
    target: "es2020",
    // tsup would otherwise name an IIFE bundle `*.global.js`; the plain name is
    // what the README, the unpkg field and every existing script tag point at.
    outExtension: () => ({ js: ".js" }),
  },
]);
