# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.1] - 2026-09-04

### Added

- **Vue 3 support**, at `@sarv-in/login/vue`: a `SarvLoginButton` component and a
  `useSarvLogin()` composable, rendering the same custom element as every other
  entry point. `@sarv-login` works with no `emits` declaration and no prop — the
  component has a single root element, so Vue's attribute fallthrough puts the
  listener on it — and `event.preventDefault()` in the handler still cancels the
  redirect. A parent's `ref` reaches the ELEMENT, for an imperative `login()`.
  The component is a render function rather than a template on purpose: it means
  `<sarv-login-button>` never passes through Vue's compiler, so no host needs
  `compilerOptions.isCustomElement` to use it. SSR-safe for Nuxt — the element is
  registered on mount, not at import.
- **Angular support**, at `@sarv-in/login/angular`: a `SarvLoginService` wrapping
  the flow, and `provideSarvLogin(config)` for any `providers` array. Injecting
  the service registers the custom element, so a template can use
  `<sarv-login-button (sarv-login)="...">` with `CUSTOM_ELEMENTS_SCHEMA` — or
  `service.mount(ref.nativeElement)` to keep the tag out of the template
  entirely.
  **The entry point imports nothing from `@angular/core`, not even a type.** An
  Angular library with a decorated class must be compiled by `ngtsc` into
  partial-Ivy format or a consumer's AOT build rejects it, which would mean
  shipping ng-packagr and a `@angular/core` peer range to bump every Angular
  major. An undecorated class is still a valid DI token, so the injection is
  real and the version coupling is nil — this package cannot stall an Angular
  upgrade.
- **OIDC `nonce` support.** `createAuthorizeUrl()` now mints a nonce alongside
  the verifier and state whenever `openid` is among the scopes, sends it with the
  authorization request, and `handleCallback()` returns it on the result. It is
  the ID token's equivalent of `state`: the server copies it into the token
  verbatim, and comparing the two is what refuses a token minted for a different
  login.
  **`exchangeCode()` does the comparison itself** and throws on a mismatch,
  because a nonce that travels the whole round trip and is never checked is not
  a weaker guard than none — it is no guard at all while looking exactly like
  one. If your backend does the exchange, send the returned `nonce` with the code
  and compare it there; `nonceProblem(idToken, nonce)` is exported for that and
  returns a readable reason or `null`.
  No nonce is minted without the `openid` scope, since no ID token is issued
  then and the value could never be compared against anything.
- `randomNonce()`, `decodeJwtPayload()` and `nonceProblem()` are exported, along
  with the `NONCE_KEY` storage key. `decodeJwtPayload` reads claims and
  **does not verify the signature** — it is for reading a token you already
  trust the source of, never for deciding whether to trust one.
- Signing out. `logout()` revokes the tokens you hold and then ends the Sarv
  session, in that order, because revoking a refresh token takes the access
  tokens issued under it with it. A failed revocation is reported but does not
  stop the redirect — the user pressed sign out.
- `revoke(token, hint?)` for one token at a time, and `logoutUrl(options?)` for
  an app that would rather render a link or navigate itself.
- Link mode: an `href` on `<sarv-login-button>` renders an anchor instead of a
  button and starts no flow in the page, for apps whose backend owns the OAuth
  exchange. `disabled` drops the `href` and sets `aria-disabled`, which is what
  actually makes a link inert.
- Wire-protocol reference in the README — every endpoint with its rate limit,
  the token endpoint's JSON body, the `{"detail": "..."}` error shape, the
  access token's claims, and the fact that `sub` rather than `email` is the
  identity to store.
- A backend (BFF) integration recipe, with the whole Express route pair. PKCE is
  mandatory for confidential clients here too, which is the one thing that makes
  a backend ported from another provider fail with
  `400 Missing required parameters`. It mints and compares a nonce, and reads
  `sub` from the access token for the session key.

### Changed

- The CJS sourcemaps are no longer published. They were four files totalling
  330 KB — more than a third of the installed package — mapping a build that is
  consumed by `require()` in Node and Jest, where a stack trace is read in the
  bundled file anyway. The ESM sourcemaps, which bundlers and browser devtools
  actually use, still ship. Net effect: the package installs *smaller* than it
  did before Vue and Angular support was added (545 KB unpacked, down from
  599 KB), while covering two more frameworks.
- **`extraParams.nonce` now throws.** Before nonce support it was the only way
  to send one and is what the docs suggested. It has to be reserved now: left
  through, the `extraParams` spread would overwrite the nonce in the URL while
  the store still held ours, so every login would fail its own comparison and
  it would look like a server bug. Delete the `extraParams` entry — the nonce is
  generated for you.
- The README's ID-token section said the token endpoint returns no `id_token`
  and that a conformant OIDC client library would fail against this server.
  Both were true when written and are not now: `openid` gets you an `id_token`,
  and NextAuth, Spring Security and `passport-openidconnect` work against it.
  The section now also documents how to tell an ID token from an access token —
  `typ: "at+jwt"` versus `typ: "JWT"`, and the `scope` claim that ID tokens
  deliberately do not carry — because both are signed by the same key with the
  same `iss` and `aud`, so a signature check alone does not distinguish them.
- `idTokenHint` is documented as accepted but not acted on, which remains
  true — the reason given for it ("this server does not mint ID tokens") no
  longer is. The server ends the session its cookie identifies, which a
  top-level navigation to the logout endpoint carries anyway.

## [1.0.0] - 2026-09-03

First public release.

### Added

- `<sarv-login-button>`, a custom element that renders the "Login with Sarv"
  button in a shadow root, so a host page's CSS cannot reshape it and its own
  styles cannot leak out.
- Sarv's design system baked in: brand and surface variants, three sizes matching
  `.btn-sm` / `.btn` / `.btn-lg`, a light, dark and `auto` theme that follows
  `prefers-color-scheme`, the design-system focus ring on `:focus-visible` only,
  and the brand mark inlined so it paints with the first frame.
- Per-embedder overrides through `--sarv-login-*` custom properties and
  `::part(button|mark|label)` — a documented seam instead of an `!important`
  fight.
- OAuth 2.1 authorization-code flow with PKCE (S256 only): `SarvLoginClient`
  with `createAuthorizeUrl`, `login`, `handleCallback`, `exchangeCode` and
  `fetchUser`, plus the pure helpers `buildAuthorizeUrl`, `readCallback` and the
  PKCE primitives.
- The `state` check is enforced inside `handleCallback`: a callback that does not
  match the flow this browser started returns an error and never hands back the
  authorization code.
- React entry point `@sarv-in/login/react` with `<SarvLoginButton>` and
  `useSarvLogin()`, rendering the same custom element rather than a second
  implementation of the button.
- A cancelable `sarv-login` event, for validating a form or running the flow
  yourself before the redirect.
- Distribution as ESM, CJS and a single-file IIFE for `<script src>` via jsDelivr
  and unpkg, with TypeScript types for the whole public API.
- `window.SarvAuth` compatibility shim so pages written against the 1.x
  `sarv-auth.js` keep working after swapping the script tag, including the same
  `sessionStorage` keys for visitors mid-flow during a deploy.

[Unreleased]: https://github.com/Sarv/sarv-login-js/compare/v1.0.1...HEAD
[1.0.1]: https://github.com/Sarv/sarv-login-js/releases/tag/v1.0.1
[1.0.0]: https://github.com/Sarv/sarv-login-js/releases/tag/v1.0.0
