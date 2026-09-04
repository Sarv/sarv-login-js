import { defineConfig } from "tsup";

export default defineConfig([
  {
    // The package build: ESM first, CJS alongside it because plenty of Node
    // toolchains still `require()`, and .d.ts because the whole API is typed.
    entry: {
      index: "src/index.ts",
      react: "src/react.ts",
      vue: "src/vue.ts",
      angular: "src/angular.ts",
    },
    format: ["esm", "cjs"],
    dts: true,
    // Emitted for both formats, but package.json's `files` publishes only the
    // ESM ones. The four .cjs.map files were 330 KB of a 874 KB package — more
    // than a third of every install — to debug a build consumed by `require()`
    // in Node and Jest, where the stack trace is read in the bundled file
    // anyway. Bundlers and browser devtools use the ESM maps, which still ship.
    sourcemap: true,
    clean: true,
    target: "es2020",
    // Frameworks are peers, never bundled: two Reacts (or two Vues) on one
    // page is a broken app. `angular` needs no entry here — it imports nothing
    // from @angular/core, by design.
    external: ["react", "vue"],
  },
  {
    // The CDN build: one file, one global, no imports. This is what a plain
    // <script src="https://cdn.jsdelivr.net/npm/@sarv-in/login"> gets, so it has
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
