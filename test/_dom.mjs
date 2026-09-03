/**
 * A DOM for the node test suite.
 *
 * WHAT THIS DOES AND DOES NOT PROVE
 * ---------------------------------------------------------------------------
 * happy-dom implements custom elements, shadow roots and events, so the
 * element's *logic* is testable here: which attributes it reads, what it puts
 * in its shadow root, whether a click dispatches a cancelable event, whether
 * the verifier is stored before the redirect. That is real coverage of real
 * code paths.
 *
 * It says nothing about how the button LOOKS. A synthetic DOM has no layout and
 * no cascade, so "38px tall", "the host's `!important` did not win" and "the
 * focus ring is drawn" can only be answered by a real engine — which is what
 * `e2e/login-button.mjs` does in Chromium. The two suites are deliberately
 * different questions, and neither replaces the other.
 *
 * `location` is a stub rather than happy-dom's own, so a test can assert on
 * where the flow tried to navigate instead of watching a page load.
 */
import { Window } from "happy-dom";

/** The globals the bundle expects a browser to have. */
const BROWSER_GLOBALS = [
  "document",
  "customElements",
  "HTMLElement",
  "Element",
  "Node",
  "Event",
  "CustomEvent",
  "MouseEvent",
  "DocumentFragment",
  "ShadowRoot",
  "getComputedStyle",
  "requestAnimationFrame",
  "cancelAnimationFrame",
  "MutationObserver",
  "sessionStorage",
  "localStorage",
  "navigator",
];

/**
 * Installs a DOM, then imports the built bundle into it.
 *
 * The import happens after the globals are in place because `index.js`
 * registers the custom element at import time when it sees a `window` — so the
 * order is what exercises that branch.
 */
export async function loadInBrowser({ url = "https://host.example.com/app" } = {}) {
  const window = new Window({ url });
  for (const key of BROWSER_GLOBALS) {
    if (window[key] === undefined) continue;
    // `defineProperty` rather than assignment: node defines some of these
    // (`navigator`) as getter-only on globalThis, and a plain assignment
    // throws instead of replacing them.
    Object.defineProperty(globalThis, key, {
      value: window[key],
      writable: true,
      configurable: true,
    });
  }
  globalThis.window = window;

  // A location stub, because happy-dom's real one performs the navigation and
  // there is nothing to navigate to. It is installed on BOTH `globalThis` and
  // `window`: the SDK reads `globalThis.location`, a test reaches for
  // `window.location`, and two different objects there means a test can set a
  // search string the code under test never sees - which is exactly the false
  // failure this replaced.
  const navigations = [];
  const location = {
    href: url,
    search: "",
    assign: (target) => void navigations.push(target),
  };
  for (const target of [globalThis, window]) {
    Object.defineProperty(target, "location", {
      value: location,
      writable: true,
      configurable: true,
    });
  }

  const module = await import("../dist/index.js");
  return { window, document: window.document, module, navigations, location };
}

/** Appends an element with the given attributes and returns it. */
export function mount(tag, attributes = {}) {
  const element = globalThis.document.createElement(tag);
  for (const [name, value] of Object.entries(attributes)) {
    if (value !== undefined) element.setAttribute(name, value);
  }
  globalThis.document.body.append(element);
  return element;
}

/** The inner <button> a host would actually click. */
export const innerButton = (element) => element.shadowRoot.querySelector(".sarv-login-btn");

/** Waits until `predicate()` is true, polling the macrotask queue.
 *
 *  WHY POLLING AND NOT ONE `setTimeout(0)`.
 *  `login()` awaits `crypto.subtle.digest`, which in node is real asynchronous
 *  work on the threadpool, not a resolved promise. A single turn of the event
 *  loop is reliably too short: the assertion ran, failed, and the navigation
 *  then landed DURING THE NEXT TEST, where it looked like a stray extra one.
 *  Both symptoms came from the same missing wait.
 *
 *  Fails with the caller's description rather than a bare timeout, because
 *  "waited 2000ms for: a navigation" is the sentence that identifies the bug. */
export async function waitFor(predicate, description, timeoutMs = 2000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error(`waited ${timeoutMs}ms for: ${description}`);
}

/** For asserting something did NOT happen.
 *
 *  A negative assertion cannot poll — there is no state to wait for — so it has
 *  to give the thing it is forbidding enough time to have happened. 50ms is
 *  ~10x the digest's measured cost, which is the margin that keeps the test
 *  from passing merely because it looked too early. */
export const pause = (ms = 50) => new Promise((resolve) => setTimeout(resolve, ms));

/** Captures console.error around an AWAITED body.
 *
 *  The synchronous version of this restored `console.error` before the button's
 *  promise chain had reached its own error branch, so the guidance was printed
 *  to the real console and the assertion saw an empty array. `run` is awaited,
 *  and `messages` is live while it runs, so a test can `waitFor` on it. */
export async function withConsoleError(run) {
  const original = console.error;
  const messages = [];
  console.error = (...args) => void messages.push(args.map(String).join(" "));
  try {
    const result = await run(messages);
    return { messages, result };
  } finally {
    console.error = original;
  }
}
