/**
 * Tests run against dist/, not src/.
 *
 * That is deliberate: the thing an integrator downloads is the bundle, and a
 * green suite over the TypeScript sources says nothing about whether the build
 * shipped the exports it claims in package.json. Run `npm run build` first —
 * `npm run check` does.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { base64url, deriveChallenge, randomState, randomVerifier } from "../dist/index.js";

test("base64url uses the URL alphabet and drops padding", () => {
  // 0xFB 0xFF 0xBE is "+/++" in standard base64 - i.e. every character that
  // differs between the two alphabets, in one input.
  assert.equal(base64url(new Uint8Array([0xfb, 0xff, 0xbe])), "-_--");
  // One byte of input pads to "==" in standard base64; both must be gone.
  assert.equal(base64url(new Uint8Array([0x00])), "AA");
  assert.equal(base64url(new Uint8Array([])), "");
});

test("randomVerifier is 43 characters of the RFC 7636 alphabet", () => {
  const verifier = randomVerifier();
  assert.equal(verifier.length, 43, "256 bits of entropy, base64url");
  assert.match(verifier, /^[A-Za-z0-9\-._~]{43}$/);
});

test("randomVerifier and randomState take an injected generator", () => {
  // The point of the injection: a test can pin the bytes without stubbing a
  // global, and a caller with a seeded RNG can reproduce a flow.
  const zeros = (n) => new Uint8Array(n);
  assert.equal(randomVerifier(zeros), "A".repeat(43));
  assert.equal(randomState(zeros), "A".repeat(22));
});

test("randomVerifier does not repeat itself", () => {
  const seen = new Set(Array.from({ length: 200 }, () => randomVerifier()));
  assert.equal(seen.size, 200, "a collision here would mean the CSPRNG is not being used");
});

test("deriveChallenge matches the RFC 7636 appendix B vector", async () => {
  // The published vector, so a refactor of the encoding cannot quietly produce
  // a challenge the server will reject.
  const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
  assert.equal(await deriveChallenge(verifier), "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
});

test("deriveChallenge is deterministic and differs per verifier", async () => {
  const [a, b, again] = await Promise.all([
    deriveChallenge("alpha"),
    deriveChallenge("beta"),
    deriveChallenge("alpha"),
  ]);
  assert.equal(a, again);
  assert.notEqual(a, b);
});
