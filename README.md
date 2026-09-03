# @sarv/login

The official **Login with Sarv** button, and the OAuth 2.1 + PKCE client
behind it. One dependency-free package for plain HTML, vanilla JS and React.

- **One renderer.** The button is a custom element, `<sarv-login-button>`. The
  React component and `renderButton()` are thin wrappers over it, so every
  integration looks identical.
- **Shadow DOM.** Your CSS reset, your `button {}` rule and your Tailwind
  preflight cannot reshape it — and it cannot leak styles into your page.
- **Sarv's own design system.** Colours, radius, focus ring, motion and the
  brand mark are taken from `sarv_theme`, with a light, dark and `auto` theme.
- **Zero runtime dependencies**, ~21 KB minified including the logo.
- **PKCE by default**, S256 only, with the `state` check enforced for you.

---

## Install

```bash
npm install @sarv/login
```

### Or a single script tag — no build step

```html
<script src="https://cdn.jsdelivr.net/npm/@sarv/login/dist/sarv-login.min.js"></script>

<sarv-login-button
  client-id="YOUR_CLIENT_ID"
  redirect-uri="https://yourapp.com/callback"
></sarv-login-button>
```

unpkg works the same: `https://unpkg.com/@sarv/login/dist/sarv-login.min.js`.
Pin a version in production — `@sarv/login@1.0.0` — so a release cannot change
your page without you shipping anything.

Self-hosted alternative, on the same origin as the authorization server — for
a network that blocks public CDNs, or a security review that forbids them:
`https://oauth.sarv.com/sdk/sarv-login.min.js`.

---

## Quick start

### Plain HTML

The script registers the element, so markup alone is a working integration:

```html
<sarv-login-button
  client-id="YOUR_CLIENT_ID"
  redirect-uri="https://yourapp.com/callback"
  scopes="openid email profile"
  size="lg"
></sarv-login-button>
```

On your callback page:

```html
<script src="https://cdn.jsdelivr.net/npm/@sarv/login/dist/sarv-login.min.js"></script>
<script>
  const login = SarvLogin.createLogin({
    clientId: "YOUR_CLIENT_ID",
    redirectUri: "https://yourapp.com/callback",
  });

  const result = login.handleCallback();
  if (SarvLogin.isCallbackError(result)) {
    // Usually the visitor declining consent. `state_mismatch` means the
    // callback did not match the flow this browser started - no code is
    // returned in that case, by design.
    console.error(result.error, result.error_description);
  } else {
    // Send BOTH to your own backend, which exchanges them for tokens.
    await fetch("/api/auth/sarv/exchange", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(result), // { code, state, codeVerifier, redirectUri }
    });
  }
</script>
```

### React

```tsx
import { SarvLoginButton, useSarvLogin } from "@sarv/login/react";

const config = {
  clientId: import.meta.env.VITE_SARV_CLIENT_ID,
  redirectUri: `${window.location.origin}/callback`,
};

export function SignIn() {
  return <SarvLoginButton {...config} size="lg" />;
}

export function Callback() {
  const { handleCallback } = useSarvLogin(config);
  useEffect(() => {
    const result = handleCallback();
    if (!("error" in result)) postToYourBackend(result);
  }, [handleCallback]);
  return <p>Signing you in...</p>;
}
```

Server components: the component is a client component (it renders a custom
element and registers it in an effect). In Next.js App Router put `"use client"`
at the top of the file that imports it.

### Vanilla JS, imperatively

```js
import { renderButton } from "@sarv/login";

const button = renderButton("#sign-in", {
  clientId: "YOUR_CLIENT_ID",
  redirectUri: `${location.origin}/callback`,
  variant: "surface",
  size: "md",
});

button.addEventListener("sarv-login", (event) => {
  if (!formIsValid()) event.preventDefault(); // cancels the redirect
});
```

---

## The button

### Attributes

| Attribute      | Property      | Values                          | Default              |
| -------------- | ------------- | ------------------------------- | -------------------- |
| `client-id`    | `clientId`    | your public client id           | —                    |
| `redirect-uri` | `redirectUri` | an exact registered redirect    | —                    |
| `scopes`       | `scopes`      | space-separated                 | `openid email profile` |
| `oauth-url`    | `oauthUrl`    | authorization server origin     | `https://oauth.sarv.com` |
| `label`        | `label`       | any text                        | `Login with Sarv` |
| `variant`      | `variant`     | `brand`, `surface`              | `brand`              |
| `size`         | `size`        | `sm` (30px), `md` (38px), `lg` (44px) | `md`           |
| `theme`        | `theme`       | `light`, `dark`, `auto`         | `auto`               |
| `full-width`   | `fullWidth`   | boolean attribute               | off                  |
| `disabled`     | `disabled`    | boolean attribute               | off                  |

`client-id` and `redirect-uri` are optional: leave them off and the button is a
styled trigger that only fires the `sarv-login` event, which is what you want
when your app starts the flow itself.

### The `sarv-login` event

Fires on click, **before** the redirect. It bubbles, crosses the shadow
boundary, and is cancelable:

```js
button.addEventListener("sarv-login", (event) => {
  event.preventDefault();          // stop the redirect
  event.detail.config;             // { clientId, redirectUri, scopes, oauthUrl }
  event.detail.originalEvent;      // the click
});
```

### Theming

`theme="auto"` (the default) follows the visitor's `prefers-color-scheme` in
CSS, so it keeps up when they flip their OS theme.

To match your own brand, set custom properties on any ancestor — they cross the
shadow boundary, which is the supported way to restyle the button:

```css
.sign-in-card {
  --sarv-login-brand: #0F766E;
  --sarv-login-brand-strong: #115E59;
  --sarv-login-radius: 999px;
  --sarv-login-height: 48px;
  --sarv-login-font: "Inter", sans-serif;
}
```

Available: `--sarv-login-brand`, `--sarv-login-brand-strong`,
`--sarv-login-surface`, `--sarv-login-surface-2`, `--sarv-login-border`,
`--sarv-login-ink`, `--sarv-login-muted`, `--sarv-login-focus-ring`,
`--sarv-login-font`, `--sarv-login-radius`, `--sarv-login-height`,
`--sarv-login-gap`.

For structural changes, the shadow parts are exposed: `::part(button)`,
`::part(mark)`, `::part(label)`.

Please keep the mark and the word "Sarv" in the label — they are what make the
button recognisable to the people clicking it.

### Accessibility

A real `<button type="button">`: reachable by <kbd>Tab</kbd>, activated by
<kbd>Enter</kbd> and <kbd>Space</kbd>, announced as a button with its label as
its accessible name. The logo is `aria-hidden`, so it is not announced twice.
The focus ring is `:focus-visible` only, and transitions are dropped under
`prefers-reduced-motion`.

---

## The flow

```
SarvLoginClient
  .createAuthorizeUrl()   -> stores a fresh verifier + state, returns the URL
  .login()                -> the above, then navigates
  .handleCallback(search?) -> verifies state, returns { code, codeVerifier, ... }
  .exchangeCode(result)   -> tokens, IN THE BROWSER (read the warning below)
  .fetchUser(accessToken) -> the OIDC userinfo profile
```

Pure helpers, if you would rather assemble it yourself:
`buildAuthorizeUrl`, `readCallback`, `resolveConfig`, `randomVerifier`,
`randomState`, `deriveChallenge`, `base64url`.

### Where to exchange the code

**Exchange on your server.** Post `code` and `codeVerifier` to your backend and
let it call the token endpoint. Tokens in a browser are readable by every script
on the page, including one that arrives through a dependency update.

`exchangeCode()` exists for a static SPA that has no backend at all — PKCE
without a client secret is exactly that case. If you use it, keep the tokens in
memory and never in `localStorage`.

**Refresh tokens rotate.** Every refresh returns a new one and invalidates the
old, and replaying a used refresh token revokes the entire authorization. Refresh
in one place, with one request in flight at a time — much easier to guarantee in
one backend than across a visitor's five open tabs.

### Requirements

`crypto.subtle` is only exposed in a secure context, so PKCE needs
**https://** (or `http://localhost` while developing). The button says so
explicitly rather than failing silently.

---

## Migrating from the 1.x `sarv-auth.js`

The browser build defines `window.SarvAuth` with the old shape, so an existing
page keeps working after you swap the script tag — same `init` / `login` /
`handleCallback` / `renderButton`, same `sessionStorage` keys, so a visitor
mid-flow during your deploy is not stranded.

New code should use `SarvLogin` / the package exports: the modern API returns a
typed error instead of `null`, takes `scopes` as an array, and never keeps
global state.

---

## Development

```bash
npm install
npm run check     # typecheck, build, then run the tests against dist/
npm run build
open examples/vanilla.html   # after a build
```

`npm run sync:sdk` copies the built bundle into the oauth repo's `sdk/js/`,
which nginx serves at `/sdk/`. It is a build artefact, so run it on every
release — a stale copy there would serve an older button than the registry.

`e2e/login-button.mjs` in the oauth repo drives the built bundle in Chromium
against `examples/vanilla.html`, whose CSS is deliberately hostile
(`button { background: hotpink !important; padding: 30px !important }` and 20px
body text). It asserts the real computed box, both themes, the custom-property
seam, Tab and `focus()` reaching the inner button, and that the verifier stored
before the redirect hashes to the challenge that was sent.

The brand mark is generated into `src/logo.generated.ts` from
`assets/sarv-mark.svg` by `npm run gen:logo`; the asset is a copy of
`sarv_theme/icons/sarv-mark.svg`. To change the mark, replace the asset and
regenerate — never edit the generated file, and never edit `sarv_theme`.

Tests run against `dist/`, not `src/`: what an integrator downloads is the
bundle, and a green suite over the TypeScript sources would not catch a build
that shipped the wrong exports.

## License

MIT (c) Sarv
