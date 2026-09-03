# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
- React entry point `@sarv/login/react` with `<SarvLoginButton>` and
  `useSarvLogin()`, rendering the same custom element rather than a second
  implementation of the button.
- A cancelable `sarv-login` event, for validating a form or running the flow
  yourself before the redirect.
- Distribution as ESM, CJS and a single-file IIFE for `<script src>` via jsDelivr
  and unpkg, with TypeScript types for the whole public API.
- `window.SarvAuth` compatibility shim so pages written against the 1.x
  `sarv-auth.js` keep working after swapping the script tag, including the same
  `sessionStorage` keys for visitors mid-flow during a deploy.

[Unreleased]: https://github.com/Sarv/sarv-login-js/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/Sarv/sarv-login-js/releases/tag/v1.0.0
