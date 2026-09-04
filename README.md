# @sarv-in/login

[![npm](https://img.shields.io/npm/v/@sarv-in/login?logo=npm&logoColor=white&label=npm&color=3069B0)](https://www.npmjs.com/package/@sarv-in/login)
[![ci](https://github.com/Sarv/sarv-login-js/actions/workflows/ci.yml/badge.svg)](https://github.com/Sarv/sarv-login-js/actions/workflows/ci.yml)
[![coverage](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/Sarv/sarv-login-js/badges/coverage.json)](https://github.com/Sarv/sarv-login-js/actions/workflows/ci.yml)
[![downloads](https://img.shields.io/npm/dm/@sarv-in/login?color=3069B0)](https://www.npmjs.com/package/@sarv-in/login)
[![minified + gzip](https://img.shields.io/bundlejs/size/@sarv-in/login?label=min%20%2B%20gzip&color=3069B0)](https://bundlejs.com/?q=%40sarv-in%2Flogin)
[![types](https://img.shields.io/npm/types/@sarv-in/login?logo=typescript&logoColor=white&color=3178C6)](https://www.npmjs.com/package/@sarv-in/login)
[![dependencies](https://img.shields.io/badge/dependencies-0-brightgreen)](https://www.npmjs.com/package/@sarv-in/login?activeTab=dependencies)
[![license](https://img.shields.io/npm/l/@sarv-in/login?color=6B7691)](LICENSE)

The official **Login with Sarv** button, and the OAuth 2.1 + PKCE client
behind it. One dependency-free package for plain HTML, vanilla JS, React, Vue
and Angular.

- **One renderer.** The button is a custom element, `<sarv-login-button>`. The
  React, Vue and Angular entry points and `renderButton()` are thin wrappers
  over it, so every integration looks identical — and Svelte, Solid, Astro or
  anything else that renders HTML can use the element directly today, with no
  wrapper at all.
- **Shadow DOM.** Your CSS reset, your `button {}` rule and your Tailwind
  preflight cannot reshape it — and it cannot leak styles into your page.
- **Sarv's own design system.** Colours, radius, focus ring, motion and the
  brand mark are taken from `sarv_theme`, with a light, dark and `auto` theme.
- **Zero runtime dependencies**, ~21 KB minified including the logo.
- **PKCE by default**, S256 only, with the `state` check enforced for you.

---

## What it looks like

Every image below is a screenshot of the built bundle running in Chromium - not
a mock-up, and not CSS reproduced by hand. They are regenerated from `dist/` on
release, so the picture cannot drift from what you install.

| | |
|---|---|
| <img src="https://raw.githubusercontent.com/Sarv/sarv-login-js/main/assets/screenshots/brand.png" width="197" alt="Login with Sarv button, filled brand blue"> | **The default.** No appearance attributes at all. |
| <img src="https://raw.githubusercontent.com/Sarv/sarv-login-js/main/assets/screenshots/surface.png" width="197" alt="Login with Sarv button, white with a border"> | `variant="surface"` - for a page that already has a primary action. |
| <img src="https://raw.githubusercontent.com/Sarv/sarv-login-js/main/assets/screenshots/size-sm.png" width="176" alt="small Login with Sarv button"> | `size="sm"` - 30px, the design system's `.btn-sm`. |
| <img src="https://raw.githubusercontent.com/Sarv/sarv-login-js/main/assets/screenshots/size-lg.png" width="215" alt="large Login with Sarv button"> | `size="lg"` - 44px, the design system's `.btn-lg`. |
| <img src="https://raw.githubusercontent.com/Sarv/sarv-login-js/main/assets/screenshots/label.png" width="217" alt="button reading Sign in to continue"> | `label="Sign in to continue"` - any wording you like. |
| <img src="https://raw.githubusercontent.com/Sarv/sarv-login-js/main/assets/screenshots/disabled.png" width="197" alt="dimmed Login with Sarv button"> | `disabled` - rendered, not clickable, for a form that is not valid yet. |
| <img src="https://raw.githubusercontent.com/Sarv/sarv-login-js/main/assets/screenshots/dark-brand.png" width="197" alt="Login with Sarv button on a dark background"> | `theme="dark"` - or leave it out and `auto` follows the visitor's OS. |
| <img src="https://raw.githubusercontent.com/Sarv/sarv-login-js/main/assets/screenshots/dark-surface.png" width="197" alt="bordered Login with Sarv button on a dark background"> | `theme="dark" variant="surface"` |
| <img src="https://raw.githubusercontent.com/Sarv/sarv-login-js/main/assets/screenshots/custom-colour.png" width="197" alt="Login with Sarv button in teal"> | `style="--sarv-login-brand: #0F766E"` - the one seam through the shadow boundary. |
| <img src="https://raw.githubusercontent.com/Sarv/sarv-login-js/main/assets/screenshots/full-width.png" width="452" alt="full width Login with Sarv button"> | `full-width` - stretches to the container. |

Sizes, variants and themes combine freely, and the icon is Sarv's own brand mark
inlined into the bundle - there is no image request to make it appear.
`examples/vanilla.html` renders all of the above on a page whose CSS is
deliberately hostile, if you want to poke at them.

---

## Install

```bash
npm install @sarv-in/login
```

### Or a single script tag — no build step

```html
<script
  src="https://cdn.jsdelivr.net/npm/@sarv-in/login@1.0.0/dist/sarv-login.min.js"
  integrity="sha384-mCXp3KveOj2R6Z8xU4GXstQn/9cA95o7wd1xlLIZAmaKQdJSih0YKzfC+q+cm3SO"
  crossorigin="anonymous"
></script>

<sarv-login-button
  client-id="YOUR_CLIENT_ID"
  redirect-uri="https://yourapp.com/callback"
></sarv-login-button>
```

The version is pinned and the `integrity` hash is the published file's, so the
browser refuses the script if a single byte of it ever differs — that is what
makes loading a login button from someone else's CDN acceptable. Both are worth
copying exactly; an unpinned URL means a release of ours can change your page
without you shipping anything, and without the hash a compromised CDN could
serve a button that redirects elsewhere.

unpkg serves the identical bytes, so the same hash works there:
`https://unpkg.com/@sarv-in/login@1.0.0/dist/sarv-login.min.js`. The hash for
any release is reproducible from the published tarball:

```bash
curl -sL https://cdn.jsdelivr.net/npm/@sarv-in/login@1.0.0/dist/sarv-login.min.js \
  | openssl dgst -sha384 -binary | openssl base64 -A
# mCXp3KveOj2R6Z8xU4GXstQn/9cA95o7wd1xlLIZAmaKQdJSih0YKzfC+q+cm3SO
```

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
<script
  src="https://cdn.jsdelivr.net/npm/@sarv-in/login@1.0.0/dist/sarv-login.min.js"
  integrity="sha384-mCXp3KveOj2R6Z8xU4GXstQn/9cA95o7wd1xlLIZAmaKQdJSih0YKzfC+q+cm3SO"
  crossorigin="anonymous"
></script>
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
import { SarvLoginButton, useSarvLogin } from "@sarv-in/login/react";

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

### Vue

```vue
<script setup lang="ts">
import { SarvLoginButton } from "@sarv-in/login/vue";

const config = {
  clientId: import.meta.env.VITE_SARV_CLIENT_ID,
  redirectUri: `${window.location.origin}/callback`,
};
</script>

<template>
  <SarvLoginButton v-bind="config" size="lg" @sarv-login="onBeforeRedirect" />
</template>
```

`@sarv-login` needs no `emits` declaration and no prop: the component renders a
single custom element, so Vue's attribute fallthrough puts your listener
straight onto it. Call `event.preventDefault()` in the handler to cancel the
redirect.

The callback page uses the composable:

```vue
<script setup lang="ts">
import { onMounted } from "vue";
import { useSarvLogin } from "@sarv-in/login/vue";

const { handleCallback } = useSarvLogin(config);
onMounted(() => {
  const result = handleCallback();
  if (!("error" in result)) postToYourBackend(result);
});
</script>
```

No `compilerOptions.isCustomElement` needed. The component is a render function
rather than a template, so `<sarv-login-button>` never passes through Vue's
template compiler and there is nothing to configure. Nuxt: the module is
SSR-safe — it registers the element on mount, not at import.

### Angular

```ts
import { CUSTOM_ELEMENTS_SCHEMA, Component } from "@angular/core";
import { provideSarvLogin, SarvLoginService } from "@sarv-in/login/angular";

// main.ts — one instance for the app
bootstrapApplication(AppComponent, {
  providers: [
    provideSarvLogin({
      clientId: environment.sarvClientId,
      redirectUri: `${location.origin}/callback`,
    }),
  ],
});

@Component({
  selector: "app-sign-in",
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA], // teaches Angular the dashed tag
  template: `
    <sarv-login-button
      [attr.client-id]="clientId"
      [attr.redirect-uri]="redirectUri"
      size="lg"
      (sarv-login)="onBeforeRedirect($event)"
    ></sarv-login-button>
  `,
})
export class SignInComponent {
  constructor(private sarv: SarvLoginService) {}   // registers the element
  signInImperatively() { return this.sarv.login(); }
}
```

`(sarv-login)` is Angular's ordinary DOM event binding — nothing about it is
special-cased for custom elements. If you would rather not declare
`CUSTOM_ELEMENTS_SCHEMA`, `sarv.mount(ref.nativeElement)` renders the same
button into an `ElementRef` instead.

The callback route:

```ts
const result = this.sarv.handleCallback();
if (!isCallbackError(result)) this.api.completeLogin(result);
```

**This entry point imports nothing from `@angular/core`** — not even a type.
That is deliberate. An Angular library containing a decorated class has to be
compiled by `ngtsc` into partial-Ivy format or a consumer's AOT build rejects
it, which would mean shipping ng-packagr and a `@angular/core` peer range to
bump on every Angular major. `SarvLoginService` is an undecorated class, and
Angular's DI takes a class as a token whether or not it carries `@Injectable`,
so you get real dependency injection with no version coupling at all. The
practical consequence: this package cannot be the reason your Angular upgrade
stalls.

### Vanilla JS, imperatively

```js
import { renderButton } from "@sarv-in/login";

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
| `href`         | `href`        | any URL                         | —                    |

`client-id` and `redirect-uri` are optional: leave them off and the button is a
styled trigger that only fires the `sarv-login` event, which is what you want
when your app starts the flow itself.

### Link mode, for a backend-driven flow

Give the button an `href` and it renders an `<a>` instead of a `<button>`: the
browser simply follows the link, and the page starts no flow of its own. That is
the shape you want when your **server** owns the OAuth exchange — point it at
your own start-of-flow route and nothing about PKCE ever happens in the browser.

```html
<sarv-login-button href="/auth/sarv/start"></sarv-login-button>
```

The `sarv-login` event still fires, so you can track the click or cancel it with
`preventDefault()`. `disabled` drops the `href` and sets `aria-disabled="true"`,
which is what actually makes a link inert. See
[When your backend owns the flow](#when-your-backend-owns-the-flow) for the
route on the other end.

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
  .createAuthorizeUrl()   -> stores a fresh verifier + state + nonce, returns the URL
  .login()                -> the above, then navigates
  .handleCallback(search?) -> verifies state, returns { code, codeVerifier, nonce, ... }
  .exchangeCode(result)   -> tokens, IN THE BROWSER (read the warning below)
  .fetchUser(accessToken) -> the OIDC userinfo profile
  .revokeToken(token, hint?) -> kills one token
  .buildLogoutUrl(options?)  -> the end-session URL
  .logout(options?)          -> revokes, then ends the Sarv session
```

Pure helpers, if you would rather assemble it yourself:
`buildAuthorizeUrl`, `readCallback`, `resolveConfig`, `randomVerifier`,
`randomState`, `randomNonce`, `deriveChallenge`, `base64url`,
`decodeJwtPayload`, `nonceProblem`.

### The nonce, and the one thing you must do with it

`createAuthorizeUrl()` mints a `nonce` alongside the verifier and state whenever
`openid` is in your scopes, and `handleCallback()` hands it back on the result.
It is the ID token's equivalent of `state`: the server copies it into the token
verbatim, and **whoever holds that token has to compare the two and refuse a
mismatch.**

- **`exchangeCode()` does it for you.** It holds the ID token itself, so it
  checks the claim and throws rather than returning a token minted for a
  different login.
- **If your backend exchanges the code** — the recommended path — send the
  `nonce` along with `code` and `codeVerifier`, and compare it there after the
  exchange. `nonceProblem(idToken, nonce)` is exported for exactly that, and
  returns a readable reason or `null`.

A nonce that is generated, sent and returned but never compared is not a weaker
guard than none. It is no guard at all, and it looks like one. If you are not
going to check it, at least know that you are not.

For an authorization-code flow this is defence in depth: `state` and PKCE
already bind the *code* to this browser and this flow. The nonce binds the *ID
token*, which matters the moment a backend will accept an ID token from anywhere
other than its own token-endpoint response — and it is what OIDC requires of a
client that sent one.

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

## Signing out

Two things have to end, and they have different lifetimes:

- **the tokens your app holds**, which keep working until they expire or are
  revoked;
- **the Sarv session cookie**, which is why the next click on "Login with Sarv"
  signs the same person back in without asking for a password.

Ending only the first leaves a live session at Sarv. Ending only the second
leaves working tokens in your app. `logout()` does both:

```js
const login = createLogin({ clientId: "your-client-id", redirectUri: "https://app.example.com/auth/callback" });

await login.logout({
  tokens: { accessToken, refreshToken },     // omit what you do not hold
  postLogoutRedirectUri: "https://app.example.com/signed-out",
  state: "came-from-billing",                // echoed back as ?state=
});
```

It revokes the refresh token, then the access token, then navigates to Sarv's
end-session endpoint, which clears the session and sends the browser to your
landing page.

**The refresh token goes first, on purpose.** Revoking it takes its whole family
with it, including access tokens issued under it, so the other order can leave a
freshly-refreshed access token alive.

**A failed revocation does not stop the redirect.** The user pressed sign out;
stranding them on a page that still looks signed in because one network call
failed is worse than a token that outlives its session and expires on its own.
Failures go to `console.error`.

| Option                  | Default                        | Notes |
| ----------------------- | ------------------------------ | ----- |
| `postLogoutRedirectUri` | the **origin** of `redirectUri` | Validated against the origins of your registered redirect URIs, so any path on a registered origin is accepted |
| `state`                 | —                              | Opaque, echoed back on the landing page |
| `idTokenHint`           | —                              | Accepted, not acted on; see [ID tokens](#id-tokens) |
| `tokens`                | none                           | `{ accessToken?, refreshToken? }` |

Both `client_id` and `post_logout_redirect_uri` are always sent, whatever you
pass. With either one missing the server renders a JSON document in the browser
window instead of redirecting, and a user who clicked "sign out" would be
looking at it.

### One token at a time

```js
await login.revoke(refreshToken, "refresh_token");   // -> true | false
```

`false` means the server found nothing to revoke — an already-expired or
already-rotated token, which is the normal answer on a second click, not an
error. It throws only when the request itself failed.

**Revoking from a browser requires a public client.** Public clients authenticate
to this endpoint by possession of the token; a confidential client must present
its `client_secret`, which has no place in a page, so revoke from your backend
instead. Revocation is rate limited to 10 requests per minute per IP, and one
`logout()` with both tokens spends two of them.

### If you would rather navigate yourself

```js
window.location.assign(login.logoutUrl({ state: "s-1" }));
// or render it: <a href="...">Sign out</a>
```

---

## When your backend owns the flow

If your server holds the tokens and sets its own session cookie — the "backend
for frontend" shape — then the browser's only job is to start the flow. Use the
button in [link mode](#link-mode-for-a-backend-driven-flow) and put the OAuth
work behind your own routes:

```html
<sarv-login-button href="/auth/sarv/start"></sarv-login-button>
<!-- ...and for signing out -->
<a href="/auth/sarv/logout">Sign out</a>
```

**PKCE is mandatory here too.** This is the one thing that catches a backend
ported from another provider: Sarv requires `code_challenge` at `/authorize` and
`code_verifier` at `/token` from **every** client, confidential ones included. A
server that sends only `client_id` + `client_secret` + `code` gets
`400 {"detail":"Missing required parameters for authorization_code grant"}`.
Generate the verifier on the server, keep it in the session, send it back at
exchange time.

```js
import { createHash, randomBytes } from "node:crypto";
import express from "express";

const OAUTH = "https://oauth.sarv.com";
const CLIENT_ID = process.env.SARV_CLIENT_ID;
const CLIENT_SECRET = process.env.SARV_CLIENT_SECRET;      // server only
const REDIRECT_URI = "https://app.example.com/auth/sarv/callback";

const base64url = (buffer) => buffer.toString("base64url");
const challengeOf = (verifier) => base64url(createHash("sha256").update(verifier).digest());

const app = express();

// 1. Start: mint state + verifier + nonce, keep them in the session, redirect.
app.get("/auth/sarv/start", (req, res) => {
  const verifier = base64url(randomBytes(32));
  const state = base64url(randomBytes(16));
  const nonce = base64url(randomBytes(16));                // distinct from state, on purpose
  req.session.sarv = { verifier, state, nonce };           // never in a cookie the page can read
  const params = new URLSearchParams({
    response_type: "code",
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    scope: "openid email profile",
    state,
    nonce,                                                 // comes back inside the id_token
    code_challenge: challengeOf(verifier),
    code_challenge_method: "S256",                         // the only method accepted
  });
  res.redirect(`${OAUTH}/api/oauth/authorize?${params}`);
});

// 2. Callback: check state, exchange with BOTH the secret and the verifier.
app.get("/auth/sarv/callback", async (req, res, next) => {
  try {
    const pending = req.session.sarv;
    delete req.session.sarv;                               // single use
    if (!pending || req.query.state !== pending.state) return res.status(400).send("bad state");

    const response = await fetch(`${OAUTH}/api/oauth/token`, {
      method: "POST",
      // JSON, not form encoding - see The wire protocol below.
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        grant_type: "authorization_code",
        code: req.query.code,
        redirect_uri: REDIRECT_URI,                        // verbatim, same string as above
        code_verifier: pending.verifier,                   // required, even with a secret
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,                      // confidential clients only
      }),
    });
    if (!response.ok) throw new Error(`token exchange failed (${response.status}): ${await response.text()}`);
    const tokens = await response.json();

    // 3. Check the nonce. Not optional: we sent one, so OIDC requires us to
    //    compare it, and an id_token whose nonce is not ours was minted for a
    //    different login. Reading the claim without verifying the signature is
    //    fine HERE and only here — this token came straight back from the token
    //    endpoint over TLS, not from something a browser handed us.
    if (tokens.id_token) {
      const idClaims = JSON.parse(Buffer.from(tokens.id_token.split(".")[1], "base64url"));
      if (idClaims.nonce !== pending.nonce) return res.status(400).send("bad nonce");
    }

    // 4. Your session, your cookie. The page never sees a token.
    req.session.tokens = tokens;
    const claims = JSON.parse(Buffer.from(tokens.access_token.split(".")[1], "base64url"));
    req.session.userId = claims.sub;                       // the stable identity key
    res.redirect("/");
  } catch (error) {
    next(error);
  }
});

// 5. Sign out: revoke, drop your session, then end the Sarv session.
app.get("/auth/sarv/logout", async (req, res, next) => {
  try {
    const { access_token, refresh_token } = req.session.tokens ?? {};
    for (const [token, hint] of [[refresh_token, "refresh_token"], [access_token, "access_token"]]) {
      if (!token) continue;
      await fetch(`${OAUTH}/api/oauth/revoke`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, token_type_hint: hint, client_id: CLIENT_ID, client_secret: CLIENT_SECRET }),
      }).catch((error) => console.error("revoke failed, signing out anyway", error));
    }
    req.session.destroy(() => {
      const params = new URLSearchParams({
        client_id: CLIENT_ID,
        post_logout_redirect_uri: "https://app.example.com/signed-out",
      });
      res.redirect(`${OAUTH}/api/oauth/logout?${params}`);
    });
  } catch (error) {
    next(error);
  }
});
```

Refreshing is the same endpoint with `grant_type: "refresh_token"` and a
`refresh_token` instead of the code. **Rotation is enforced:** each refresh
returns a new refresh token and invalidates the one you used, and replaying a
used one revokes the whole authorization. Refresh in one place, one request in
flight at a time — which is exactly why this shape is easier to get right than
refreshing across a visitor's five open tabs.

---

## The wire protocol

For a backend, a mobile app, or a resource server that is not using this
package. Everything below is what the server does today, not what the spec says
it should.

### Endpoints

Base: `https://oauth.sarv.com`. Discovery is live, so read it rather than
hard-coding this table:

```
GET /.well-known/openid-configuration
GET /.well-known/jwks.json
```

| Endpoint | Method | Body | Authentication | Rate limit |
| -------- | ------ | ---- | -------------- | ---------- |
| `/api/oauth/authorize` | GET | query string | — | 20/min |
| `/api/oauth/token` | POST | **JSON** | PKCE, plus `client_secret` if confidential | 20/min |
| `/api/oauth/userinfo` | GET | — | `Authorization: Bearer` | 30/min |
| `/api/oauth/revoke` | POST | **JSON** | the token itself, plus `client_secret` if confidential | 10/min |
| `/api/oauth/introspect` | POST | **JSON** | as revoke | 30/min |
| `/api/oauth/logout` | GET | query string | `client_id` + `post_logout_redirect_uri` | 20/min |

Limits are per IP, and a `429` is a rate limit rather than anything about your
credentials.

### Two deviations worth knowing before you write the client

**1. The token endpoint takes JSON.** RFC 6749 says
`application/x-www-form-urlencoded`; this server parses a JSON body. Most OAuth
libraries form-encode by default and will fail here — check yours, or make the
call by hand as in the recipe above.

**2. Errors are `{"detail": "..."}`.** Not the RFC's
`{"error": "...", "error_description": "..."}` — the OpenAPI schema advertises
that shape but the running code answers with FastAPI's, so branch on the HTTP
status and treat `detail` as human-readable text, never as a machine code:

```json
400 {"detail": "Missing required parameters for authorization_code grant"}
401 {"detail": "Invalid client credentials"}
```

### Authorization request

| Parameter | Required | Notes |
| --------- | -------- | ----- |
| `response_type` | yes | `code` — the only one supported |
| `client_id` | yes | |
| `redirect_uri` | yes | Compared as a whole string against the client's registered URIs; a trailing slash is a different URI. A client may register several |
| `scope` | yes | space separated |
| `state` | yes | |
| `code_challenge` | yes | 43-128 characters, for every client type |
| `code_challenge_method` | yes | `S256`; `plain` is rejected |
| `nonce` | no | Echoed into the `id_token` verbatim, up to 255 characters. Survives the consent screen and the KYC verification detour. Omit it rather than sending it empty |

### Token response

```json
{
  "access_token": "eyJ...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "refresh_token": "...",
  "id_token": "eyJ...",
  "scope": "openid email profile"
}
```

Refresh tokens come back on the authorization-code grant without asking for
`offline_access`. `id_token` is present when `openid` was granted, on the code
exchange and on every refresh.

### Access tokens are verifiable offline

The access token is an RS256 JWT with a `kid` in its header, so a resource server
can verify it against `jwks.json` and skip a network call per request. Cache the
keys; verify `iss`, `exp`, the signature, and then pin the audience yourself.

```json
{
  "iss": "https://oauth.sarv.com",
  "sub": "9f1c...",             // the user - stable, opaque, your join key
  "aud": "your-client-id",
  "exp": 1767225600,
  "iat": 1767222000,
  "jti": "…",                   // unique per token
  "scope": "openid email profile",
  "client_id": "your-client-id",
  "email": "person@example.com", // with scope email or openid
  "email_verified": true,
  "name": "A Person"             // with scope profile or openid
}
```

There is no `azp` claim: the client is in `aud` and in `client_id`. Revocation is
not visible in the token, so a token that must be checked against revocation has
to go through `/api/oauth/introspect` — which is the trade a self-contained token
always makes.

### Identity

`sub` is the key to store. It is stable for a user across every client, and it
does not change when they change their email or their name — so joining on
`email` will one day merge or split two accounts that were never the same person.

`GET /api/oauth/userinfo` with a bearer token returns `sub`, `email`,
`email_verified`, `name`, `profile`, `phone_number`, `phone_number_verified`.

**No roles, groups or permissions are exposed** — not in the token, not in
userinfo. Sarv says who someone is; what they may do in your app is your app's
to decide.

### ID tokens

`openid` in your scopes gets you an `id_token` beside the access token, on the
code exchange and on every refresh. It is an RS256 JWT carrying `iss`, `sub`,
`aud`, `exp`, `iat`, `jti`, `at_hash`, `auth_time`, your `nonce` if you sent
one, and `email` / `email_verified` / `name` by scope. Conformant OIDC client
libraries — NextAuth's `openid` provider, Spring Security's OIDC login,
`passport-openidconnect` — work against it.

**An ID token is not a credential.** It is a signed statement to *you* that a
user just authenticated, meant to be read once and discarded. Never send it to
an API as a bearer token, and if you build an API, never accept one:

- Access tokens carry `typ: "at+jwt"` in the header; ID tokens carry `typ: "JWT"`.
- Access tokens carry a `scope` claim. **ID tokens deliberately carry none**, so
  an API that requires a scope cannot be talked into accepting one.

Both are signed by the same key with the same `iss` and the same `aud`, so a
signature check alone does not tell them apart. Those two differences are what
does.

`id_token_hint` at the logout endpoint is still accepted and not acted on: the
server ends the session it finds from the session cookie, which is the session
a top-level navigation to the logout endpoint carries anyway.

### Scopes

`openid`, `email`, `profile` and `phone` are the identity scopes, and are what
discovery lists. Product scopes exist as well and are granted per client — the
mail relay's `email:send` is one — so a client's real allow-list is what the
developer console shows for that client, which can be wider than
`scopes_supported`. Ask for what you will use: the consent screen names every
scope, and a long list is the most common reason people decline.

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

`e2e/login-button-shots.mjs`, beside it, regenerates the gallery images at the
top of this file into `assets/screenshots/`. They come out of the same built
bundle, so a change to the button shows up in the README as soon as the images
are regenerated - which is a release step, not something to remember.

The brand mark is generated into `src/logo.generated.ts` from
`assets/sarv-mark.svg` by `npm run gen:logo`; the asset is a copy of
`sarv_theme/icons/sarv-mark.svg`. To change the mark, replace the asset and
regenerate — never edit the generated file, and never edit `sarv_theme`.

Tests run against `dist/`, not `src/`: what an integrator downloads is the
bundle, and a green suite over the TypeScript sources would not catch a build
that shipped the wrong exports.

`npm run test:coverage` (Node 22.8+) reports the same suite with a floor CI
enforces, so the number cannot quietly regress. The floors are integers on
purpose: node silently truncates a fractional `--test-coverage-lines`, so a
floor written as `97.5` is a gate that never fires.

The suite covers the DOM code too, in a synthetic DOM
([happy-dom](https://github.com/capricorn86/happy-dom)) rather than by mocking
it: the custom element is mounted, clicked and read back, and the React wrapper
is rendered both through `react-dom/server` for the prop-to-attribute mapping
and through `createRoot` for the effects, the ref and the listener cleanup.
That is what a synthetic DOM is good for - what the button *does*.

The Vue wrapper is split across two files for a reason worth knowing if you add
to them: `vue/runtime-dom` captures `document` once at module load, so a process
that has a DOM cannot prove the no-DOM path and one that has none cannot mount.
`vue-ssr.test.mjs` runs with no DOM at all — its import is itself the SSR
assertion — and `vue.test.mjs` installs one first. The Angular suite uses no
Angular: the entry point ships an undecorated class and a plain provider object,
so the tests call the factory the way Angular's injector would and assert the
build stays free of decorator metadata.

It is not what the button *looks like*, and no coverage number will ever say
anything about that. Appearance is verified separately, in real Chromium, by
`e2e/login-button.mjs`. Both matter, and neither substitutes for the other.

Publishing to npm and the CDNs is written up in
[RELEASING.md](RELEASING.md) - the registry setup, the tag-driven workflow, and
why the CDN URLs in this README are pinned to an exact version.

## License

MIT (c) Sarv
