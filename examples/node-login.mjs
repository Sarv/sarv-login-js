/**
 * The smallest "Login with Sarv" there is: run it, sign in in the browser,
 * and the redirect lands on a local page showing the signed-in user.
 *
 *   SARV_CLIENT_SECRET=<secret> node examples/node-login.mjs
 *
 * Written for a public PKCE client, where the code verifier is the proof and
 * there is no secret. For a confidential client, pass its secret in
 * SARV_CLIENT_SECRET; never write it into this file. The default client is
 * confidential, hence the variable above. Needs Node 18+ (global fetch and
 * Web Crypto) and a build of this repo (`npm run build`); in your own project, import from
 * "@sarv-in/login" instead of the dist path.
 *
 * Defaults to production. Point it at another server with:
 *
 *   SARV_OAUTH_URL=http://localhost:3100 SARV_CLIENT_ID=<id> node examples/node-login.mjs
 */
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { SarvLoginClient, decodeJwtPayload, isCallbackError, nonceProblem } from "../dist/index.js";

const CLIENT_ID = process.env.SARV_CLIENT_ID ?? "client_uW_Df37wVtNAAkQpfGpnbA";
/** Undefined falls through to the SDK's default, https://oauth.sarv.com. */
const OAUTH_URL = process.env.SARV_OAUTH_URL;
/** Only for a confidential (private) client. The SDK's exchangeCode sends no
 *  secret, since it is built for public PKCE clients, so with a secret set the
 *  exchange below is done here instead. */
const CLIENT_SECRET = process.env.SARV_CLIENT_SECRET;
/** Space-separated, like the `scope` parameter. Each one must be allowed on the client. */
const SCOPES = (process.env.SARV_SCOPES ?? "openid email profile sarv-cai:audio.read sarv-cai:audio.write").split(/\s+/).filter(Boolean);
/** The redirect URIs registered on the client. The server compares the whole
 *  string, so the host is 127.0.0.1 (not localhost) and the path is /cb. */
const PORTS = [51823, 51824, 51825];
const CALLBACK_PATH = "/cb";
const TIMEOUT_MS = 5 * 60 * 1000;

console.log("scopes :", SCOPES);

const redirectUriFor = (port) => `http://127.0.0.1:${port}${CALLBACK_PATH}`;

/** Resolves on the first port that will bind, so a second run (or anything
 *  else squatting on 51823) falls through to the next registered one. */
const listenOnFirstFree = async (server, ports) => {
  for (const port of ports) {
    try {
      await new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(port, "127.0.0.1", () => {
          server.off("error", reject);
          resolve();
        });
      });
      return port;
    } catch (error) {
      if (error.code !== "EADDRINUSE") throw error;
    }
  }
  throw new Error(`All registered ports are busy: ${ports.join(", ")}`);
};

/** Best effort: the URL is printed too, for when no browser opens. */
const openBrowser = (url) => {
  const [command, args] =
    process.platform === "darwin" ? ["open", [url]]
    : process.platform === "win32" ? ["cmd", ["/c", "start", "", url]]
    : ["xdg-open", [url]];
  spawn(command, args, { stdio: "ignore", detached: true }).on("error", () => {}).unref();
};

const escapeHtml = (text) =>
  String(text).replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);

/** Unstyled on purpose: the page proves the redirect, nothing more. */
const renderPage = (title, sections) => `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>${escapeHtml(title)}</title></head>
<body style="font-family: system-ui, sans-serif; max-width: 720px; margin: 40px auto; padding: 0 16px">
  <h1>${escapeHtml(title)}</h1>
  ${sections
    .map(({ heading, body }) => `<h2>${escapeHtml(heading)}</h2><pre>${escapeHtml(body)}</pre>`)
    .join("\n  ")}
</body>
</html>`;

const toJson = (value) => JSON.stringify(value, null, 2);

/** exchangeCode plus `client_secret`, for a confidential client. */
const exchangeCodeWithSecret = async (client, result, clientSecret) => {
  const response = await fetch(`${client.config.oauthUrl}/api/oauth/token`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      grant_type: "authorization_code",
      code: result.code,
      redirect_uri: result.redirectUri,
      code_verifier: result.codeVerifier,
      client_id: client.config.clientId,
      client_secret: clientSecret,
    }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`token exchange failed (${response.status}). ${detail.slice(0, 300)}`);
  }
  const tokens = await response.json();
  const problem = result.nonce ? nonceProblem(tokens.id_token, result.nonce) : null;
  if (problem) throw new Error(problem);
  return tokens;
};

/** Waits for the one request to /cb. Resolves with the query string and the
 *  still-open response, so the page can be written once the tokens are in. */
const waitForCallback = (server) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Timed out waiting for the login.")), TIMEOUT_MS);
    server.on("request", (request, response) => {
      const url = new URL(request.url, "http://127.0.0.1");
      if (url.pathname !== CALLBACK_PATH) {
        response.writeHead(404).end();
        return;
      }
      clearTimeout(timer);
      resolve({ search: url.search, response });
    });
  });

const main = async () => {
  const server = createServer();
  let page;
  try {
    const port = await listenOnFirstFree(server, PORTS);
    // No store passed: outside a browser the client keeps the verifier,
    // state and nonce in memory, which is exactly this process's lifetime.
    const client = new SarvLoginClient({
      clientId: CLIENT_ID,
      redirectUri: redirectUriFor(port),
      oauthUrl: OAUTH_URL,
      scopes: SCOPES,
    });

    const callback = waitForCallback(server);
    const authorizeUrl = await client.createAuthorizeUrl();
    console.log(`Opening the browser to sign in. If it does not open, visit:\n\n  ${authorizeUrl}\n`);
    openBrowser(authorizeUrl);

    const { search, response } = await callback;
    page = response;
    const result = client.handleCallback(search);
    if (isCallbackError(result)) {
      throw new Error(`${result.error}${result.error_description ? `: ${result.error_description}` : ""}`);
    }

    // exchangeCode also checks the ID token's nonce against this flow's.
    const tokens = CLIENT_SECRET
      ? await exchangeCodeWithSecret(client, result, CLIENT_SECRET)
      : await client.exchangeCode(result);
    console.log(`Requested scope: ${SCOPES.join(" ")}\nGranted scope:   ${tokens.scope ?? "(none in the token response)"}`);
    const user = await client.fetchUser(tokens.access_token);

    page.writeHead(200, { "content-type": "text/html; charset=utf-8" }).end(
      renderPage(`Signed in as ${user.email ?? user.name ?? user.sub}`, [
        { heading: "Granted scope (token response)", body: tokens.scope ?? "(none)" },
        { heading: `Redirected to`, body: `${client.config.redirectUri}${search}` },
        { heading: "User (userinfo)", body: toJson(user) },
        { heading: "ID token claims", body: tokens.id_token ? toJson(decodeJwtPayload(tokens.id_token)) : "(none)" },
      ])
    );
    console.log("Signed in. The details are on the page the browser was redirected to.");
  } catch (error) {
    console.error(`Login failed: ${error.message}`);
    page
      ?.writeHead(500, { "content-type": "text/html; charset=utf-8" })
      .end(renderPage("Login failed", [{ heading: "Error", body: error.message }]));
    process.exitCode = 1;
  } finally {
    server.close();
  }
};

main();
