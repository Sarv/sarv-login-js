# Releasing

A release is one thing: **a git tag**. `.github/workflows/publish.yml` fires on
`v*`, and nothing else publishes. A push to `main` cannot ship a version by
accident, which is the property worth protecting — this package renders on other
people's pages, and a surprise release changes all of them at once.

Read the [First publish](#first-publish-by-hand) section once. After that,
every release is the two commands in [Every release after that](#every-release-after-that).

---

## One-time setup

### 1. An npm account that owns the scope

```bash
npm login                      # interactive: browser + OTP
npm whoami
npm org ls sarv-in             # does your account own the @sarv-in org?
```

This package publishes to the **`@sarv-in`** scope, not `@sarv`. `@sarv` on
npmjs belongs to a different account: `npm org ls sarv` lists one member named
`sarv` and no teams, and a `PUT` to `@sarv/login` as `ankursarv` comes back
`404` — npm answers a scope you cannot write to with "not found" rather than
"forbidden", so a 404 on publish is a permissions answer, not a missing-package
one. `@sarv-in` is a real org with `ankursarv` as owner, and it is where
`@sarv-in/document-editor-react` already lives.

`npm org ls sarv-in` erroring means the org does not exist under your account.
Create it at <https://npmjs.com/org/create> — free for public packages. If the
name is held by somebody else, the package has to be renamed before it can ever
be published; the name appears in `package.json`, `README.md`, the examples and
every CDN URL, so change it in one pass rather than piecemeal.

A logged-in browser is not a logged-in shell. `npm publish` reads the token in
`~/.npmrc`, and an expired one fails with a bare `401 Unauthorized` from
`whoami` — check that first when anything refuses.

### 2. Know which registry you are publishing to

Sarv runs an internal registry, and `voice_router/.npmrc` maps the whole scope
to it:

```
@sarv:registry=https://dev-npm-registry.sarv.com/
```

If that file is ever copied next to this package, `npm publish` uploads to the
intranet and **succeeds** — the public registry never sees the version, and
nothing warns you. This directory deliberately has no local `.npmrc`, but that
is not a defence, because the mapping can also come from `~/.npmrc` or from a
`NPM_CONFIG_@sarv:REGISTRY` in CI.

So the destination is pinned in `package.json` instead, where it travels with
the package and cannot be left behind:

```json
"publishConfig": {
  "access": "public",
  "registry": "https://registry.npmjs.org/"
}
```

`publishConfig.registry` beats any `@sarv:registry` mapping on any machine, so
`npm publish` from this directory goes to npmjs whoever runs it. Passing
`--registry https://registry.npmjs.org` on top of that is belt and braces and
still worth typing for a first publish.

#### Why the public scope is `@sarv-in` and the internal one is `@sarv`

npm maps registries **per scope only** — there is no per-package override. So
one `@sarv:registry` line captures *every* `@sarv/*` name at once, and there is
no way to exempt a single package from it. Publishing this package under `@sarv`
would therefore have put a public package inside the scope that is already
pointed at the intranet on every Sarv machine.

Two different scopes removes that entirely: `@sarv` stays internal, `@sarv-in`
is public, and no `.npmrc` line can confuse one for the other. `npm i
@sarv-in/login` goes to npmjs from any machine, including one with the internal
mapping, because the mapping does not match the scope. That is the whole reason
for the `-in` suffix — it is not a fallback after `@sarv` was taken, it is the
arrangement that makes the two registries independent.

**So this is the convention, not a decision about one package:**

| | scope | registry |
|---|---|---|
| Public, on npmjs | `@sarv-in/*` | `https://registry.npmjs.org/` |
| Internal only | `@sarv/*` | `https://dev-npm-registry.sarv.com/` |

Every future public package goes under `@sarv-in` for the same reason this one
does. The org already holds `@sarv-in/document-editor-react` and
`@sarv-in/login`, and `ankursarv` is its owner, so a new public package needs no
new setup — only `"name": "@sarv-in/<thing>"` and the `publishConfig` block
above. Deciding this per package is how a public name eventually lands in the
internal scope and nobody notices until an install fails on someone's laptop.

The `publishConfig.registry` pin above is now belt and braces rather than
load-bearing. Keep it: it costs nothing and it survives someone later deciding
to map `@sarv-in` too.

**The naming rule that remains.** An internal package and a public package must
never share a *fully qualified* name. Different scopes make that easy, but it is
still worth knowing what is on the other side. Internal `@sarv/*` names as of
the last check: `@sarv/deepcall-logger`, `@sarv/logger`, `@sarv/theme`,
`@sarv/workspace-shell`.

**One thing to confirm separately.** Those internal names live in a scope that
Sarv does not appear to own on public npmjs. If nobody at Sarv controls the
public `@sarv` scope, then a public `@sarv/logger` could be published by whoever
does, and any machine that resolves that name against npmjs — a laptop without
the internal `.npmrc`, a CI runner, a fresh container — would install theirs.
That is dependency confusion, and the fix is to own the scope rather than to
rename anything: claim `@sarv` on npmjs and leave it empty.

### 3. Let CI publish

On GitHub, in `Sarv/sarv-login-js`:

1. **Settings > Environments > New environment**, named exactly `npm`. The
   workflow already targets it, so the name is not a preference.
2. In that environment, add a secret named `NPM_TOKEN`: an npmjs **Granular
   Access Token** with write access limited to `@sarv-in/login`. Not a Classic
   token — a classic automation token can publish everything the account owns.

Once `1.0.0` exists on the registry, replace the secret with **Trusted
Publishing** (the package's npm settings page: repository `Sarv/sarv-login-js`,
workflow `publish.yml`). Then delete `NPM_TOKEN` and drop `NODE_AUTH_TOKEN`
from `publish.yml` — OIDC replaces the long-lived credential entirely. It can
only be configured against a package that already exists, which is why the
first publish is manual.

---

## First publish, by hand

```bash
npm run check                                     # typecheck, build, 37 tests against dist/
npm publish --dry-run --registry https://registry.npmjs.org
npm publish --access public --registry https://registry.npmjs.org --otp=<6-digit>
```

Read the dry run before the real one. It should report **22 files**, roughly
**144 kB** packed, with `README.md`, `LICENSE` and `CHANGELOG.md` present and no
`src/`, `test/` or `node_modules/`. That list comes from `files` in
`package.json`, not from `.npmignore` guesswork.

`--access public` is required for a scoped package; the registry defaults a new
scope to restricted and would publish something nobody can install.
`publishConfig.access` already sets it, so the flag is belt-and-braces.

`npm publish` runs `prepublishOnly`, which is `typecheck && build && test`. A
tree that does not build cannot be published, and the tests run against `dist/`
— the artefact an integrator actually downloads.

---

## Every release after that

```bash
npm version patch          # or minor / major
git push --follow-tags
```

That is the release. `npm version` bumps `package.json`, commits, and tags;
the push triggers `publish.yml`, which:

1. refuses if the tag and `package.json` version disagree — otherwise `v1.0.2`
   could publish `1.0.1`'s contents and the git history would stop being a
   record of what is on the registry;
2. runs `prepublishOnly` (typecheck, build, tests);
3. publishes with `--provenance`, which records in the registry which workflow
   and which commit produced the tarball.

Which of `patch` / `minor` / `major` follows from `CHANGELOG.md`, so write the
entry first. Anything that changes the button's rendered box, its default
label, an attribute name or the shape of a returned object is a **major** for
this package: hosts pin exact versions and read the size of the button as part
of their own layout.

### The version literal

`src/index.ts` exports `version`, and `exports.test.mjs` asserts it equals
`package.json`. `npm run gen:version` rewrites it, and `prebuild` runs it — so
the published bundle is always correct even if the tagged commit still carries
the old literal. To keep the repo itself in step, either run `npm run check`
after `npm version` and commit the result, or add the lifecycle hook that does
it inside the version commit:

```json
"version": "npm run gen:version && git add src/index.ts"
```

### Sync the self-hosted copy

```bash
npm run sync:sdk
```

This copies `dist/sarv-login.min.js{,.map}` into the oauth repo's `sdk/js/`,
which nginx serves at `/sdk/` with `Access-Control-Allow-Origin: *`. It is a
build artefact of *this* repo, so it has to be re-copied and committed there on
every release — a stale copy serves an older button than the registry does, and
that divergence is invisible until somebody reports a bug that was fixed weeks
ago.

---

## The CDNs

**There is nothing to publish.** unpkg and jsDelivr are npm mirrors: they fetch
a file on its first request and cache it. No account, no upload, no build hook.
The moment `npm publish` succeeds, these are live:

```
https://cdn.jsdelivr.net/npm/@sarv-in/login@1.0.0/dist/sarv-login.min.js
https://unpkg.com/@sarv-in/login@1.0.0/dist/sarv-login.min.js
```

`package.json` declares `unpkg` and `jsdelivr` as `./dist/sarv-login.min.js`, so
the bare `https://unpkg.com/@sarv-in/login` resolves to the button too. jsDelivr
also serves ESM at `https://cdn.jsdelivr.net/npm/@sarv-in/login@1.0.0/+esm`.

Three rules for the URLs that go in the docs:

- **Pin the exact version. Never `@latest`.** This is a login button on somebody
  else's page. `@latest` means every release changes every host site
  simultaneously, with no deploy on their side to correlate a breakage with.
- **Publish an SRI hash beside each pinned URL.** After a release:
  ```bash
  curl -s https://cdn.jsdelivr.net/npm/@sarv-in/login@1.0.0/dist/sarv-login.min.js \
    | openssl dgst -sha384 -binary | openssl base64 -A
  ```
  then `integrity="sha384-..." crossorigin="anonymous"`. SRI only works against
  an exact version, which is the same reason as above.
- **jsDelivr's `/gh/` path does not work for this package.** `dist/` is
  gitignored, so there is no built file in the repo to serve. npm is the only
  source. (CI enforces the other half of this: `gen:logo` must produce no diff,
  so a hand-edited generated file fails the build.)

### cdnjs (optional)

cdnjs is the only one that needs work: a pull request to
[`cdnjs/packages`](https://github.com/cdnjs/packages) adding a manifest for the
package, then human review, after which it auto-tracks npm. Worth it only if a
consumer specifically asks for cdnjs — jsDelivr and unpkg cover the same ground
with no process.

---

## Checklist

- [ ] `CHANGELOG.md` has the entry, and the bump matches what changed
- [ ] `npm run check` is green (typecheck, build, tests against `dist/`)
- [ ] `npm publish --dry-run` lists 22 files with no source or build junk
- [ ] `npm version <patch|minor|major>` and `git push --follow-tags`
- [ ] the `publish` workflow went green and `npm view @sarv-in/login version` agrees
- [ ] the pinned CDN URL responds, and the SRI hash in the docs matches it
- [ ] `npm run sync:sdk`, then commit `sdk/js/` in the oauth repo
- [ ] if the button's appearance changed: rerun `e2e/login-button-shots.mjs`
      and commit `assets/screenshots/` - the README gallery is a promise about
      what installing gets you

## When it refuses

| Message | Cause |
|---|---|
| `401 Unauthorized` from `npm whoami` | the token in `~/.npmrc` expired; `npm login` again |
| `402 Payment Required` | scoped package published without `--access public` |
| `403 Forbidden` | the account does not own the `@sarv-in` scope, or the version already exists — versions are immutable, bump instead |
| `404` on a package you just published | it went to the internal registry; check for a scope-to-registry line, and that `publishConfig.registry` is still in `package.json` |
| `404` on `PUT` when publishing | not a missing package — the account cannot write to that scope. npm returns 404 rather than 403 so it does not confirm the scope exists. Check `npm org ls <scope>` lists you |
| `ERROR: tag X does not match package.json Y` | the tag was made by hand; delete it and use `npm version` |
| the CDN 404s minutes after publishing | first-request caching; try the exact-version URL once more before assuming a bad publish |
