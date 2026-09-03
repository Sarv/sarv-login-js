# React example

```bash
npm install @sarv/login react
```

`App.tsx` here is a Vite-style app (it reads `import.meta.env`); the component
itself has no build-tool requirements. Two things to set up:

1. `VITE_SARV_CLIENT_ID` — the client id from the Sarv developer console.
2. A route at `/callback` rendering the exported `Callback` component, and the
   same URL registered as a redirect URI on the client. The server compares the
   whole string, so `http://localhost:5173/callback` and
   `http://localhost:5173/callback/` are two different URIs.

`POST /api/auth/sarv/exchange` is **your** endpoint. It receives the code and
the PKCE verifier and calls the token endpoint server-side:

```js
// Your backend. The tokens stay here.
const response = await fetch(`${OAUTH_URL}/api/oauth/token`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    code_verifier: codeVerifier,
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET, // confidential clients only
  }),
});
```

Refresh tokens rotate: each refresh returns a new one and invalidates the old.
Replaying a used refresh token revokes the whole authorization, so refresh in
one place with one request in flight at a time.
