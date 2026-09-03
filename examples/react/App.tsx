/**
 * A React app that signs in with Sarv.
 *
 * The exchange is deliberately left to the server: the code and verifier are
 * posted to your own backend, which holds the tokens. Doing it in the browser
 * is possible (`client.exchangeCode`) and documented, but a token in a page is
 * readable by every script on it.
 */
import { useEffect, useState } from "react";
import { SarvLoginButton, useSarvLogin } from "@sarv-in/login/react";

const CONFIG = {
  clientId: import.meta.env.VITE_SARV_CLIENT_ID,
  redirectUri: `${window.location.origin}/callback`,
  oauthUrl: import.meta.env.VITE_SARV_OAUTH_URL, // omit for https://oauth.sarv.com
};

export default function App() {
  return (
    <main style={{ padding: 48, fontFamily: "system-ui" }}>
      <h1>Sign in</h1>

      {/* The whole integration. */}
      <SarvLoginButton {...CONFIG} size="lg" />

      <h2>Variants</h2>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        <SarvLoginButton {...CONFIG} variant="surface" />
        <SarvLoginButton {...CONFIG} theme="dark" />
        <SarvLoginButton {...CONFIG} label="Sign in with Sarv" size="sm" />
      </div>

      <h2>Validate before redirecting</h2>
      <GatedLogin />
    </main>
  );
}

/** `onLogin` fires before the redirect; preventDefault() cancels it. */
function GatedLogin() {
  const [agreed, setAgreed] = useState(false);
  return (
    <>
      <label style={{ display: "block", marginBottom: 12 }}>
        <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />{" "}
        I accept the terms
      </label>
      <SarvLoginButton
        {...CONFIG}
        onLogin={(event) => {
          if (!agreed) {
            event.preventDefault();
            alert("Please accept the terms first.");
          }
        }}
      />
    </>
  );
}

/** The page at `redirectUri`. */
export function Callback() {
  const { handleCallback } = useSarvLogin(CONFIG);
  const [status, setStatus] = useState("Signing you in...");

  useEffect(() => {
    // Once per mount. The verifier is single-use, and handleCallback clears it,
    // so a second call would report a missing verifier - in React's dev
    // StrictMode that double-invoke is exactly what you would see.
    const result = handleCallback();
    if ("error" in result) {
      setStatus(`Could not sign you in: ${result.error}`);
      return;
    }
    fetch("/api/auth/sarv/exchange", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        code: result.code,
        codeVerifier: result.codeVerifier,
        redirectUri: result.redirectUri,
      }),
    })
      .then((response) => {
        if (!response.ok) throw new Error(String(response.status));
        setStatus("Signed in.");
      })
      .catch((error) => setStatus(`Exchange failed: ${error.message}`));
  }, [handleCallback]);

  return <p>{status}</p>;
}
