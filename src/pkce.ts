/**
 * PKCE primitives (RFC 7636), as small pure-ish functions.
 *
 * Only `randomVerifier` and `randomState` touch anything outside their
 * arguments (the CSPRNG), and both take an optional generator so a test can
 * make them deterministic without stubbing globals. Everything else — the
 * challenge derivation, the base64url encoding — is a pure function of its
 * input, which is what makes this file unit-testable without a browser.
 */

/** Base64url per RFC 4648 §5: no padding, `-` and `_` for `+` and `/`. */
export function base64url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * The code verifier: 32 random bytes, base64url-encoded to 43 characters.
 *
 * RFC 7636 §4.1 allows 43-128 characters and requires "high-entropy"; 256 bits
 * is the recommendation, not the minimum, and there is no reason to send more.
 */
export function randomVerifier(random: (n: number) => Uint8Array = randomBytes): string {
  return base64url(random(32));
}

/**
 * The `state` parameter: 16 random bytes.
 *
 * This is CSRF protection, not a secret — it only has to be unguessable by the
 * attacker who would forge a callback, and it travels in a URL that ends up in
 * browser history.
 */
export function randomState(random: (n: number) => Uint8Array = randomBytes): string {
  return base64url(random(16));
}

/**
 * The OIDC `nonce`: 16 random bytes, same size and reasoning as `state`.
 *
 * Not a secret and not a PKCE value — it is a receipt. The client sends it with
 * the authorization request, the server copies it into the ID token verbatim,
 * and the client compares the two. It only has to be unguessable by whoever
 * would supply a substitute ID token, and it never leaves the browser except in
 * a URL, exactly like `state`.
 *
 * `state` and `nonce` are separate values on purpose, even though both are
 * random and per-flow. `state` travels back in the callback URL in the clear;
 * `nonce` travels back inside the ID token. Reusing one value for both would
 * put the ID-token guard in browser history and in every proxy log that saw the
 * redirect.
 */
export function randomNonce(random: (n: number) => Uint8Array = randomBytes): string {
  return base64url(random(16));
}

/**
 * S256 challenge: base64url(SHA-256(verifier)).
 *
 * `plain` is deliberately not implemented. OAuth 2.1 removed it, and offering
 * it would let a caller downgrade their own flow to one where intercepting the
 * authorization request is enough to redeem the code.
 */
export async function deriveChallenge(verifier: string): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error(
      "Sarv login: Web Crypto is unavailable. PKCE needs crypto.subtle, which browsers " +
        "expose only in a secure context — serve the page over https:// (or http://localhost)."
    );
  }
  const digest = await subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return base64url(new Uint8Array(digest));
}

/** The default CSPRNG, isolated so the callers above stay testable. */
export function randomBytes(length: number): Uint8Array {
  const out = new Uint8Array(length);
  if (!globalThis.crypto?.getRandomValues) {
    throw new Error("Sarv login: crypto.getRandomValues is unavailable in this environment.");
  }
  globalThis.crypto.getRandomValues(out);
  return out;
}
