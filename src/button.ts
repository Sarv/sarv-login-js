/**
 * The button itself: one custom element, used by every integration.
 *
 * WHY A CUSTOM ELEMENT AND NOT TWO IMPLEMENTATIONS
 * ---------------------------------------------------------------------------
 * The package ships a vanilla API and a React component. If each rendered its
 * own markup, the two would drift — one would get a focus ring fix, the other a
 * padding fix, and "Login with Sarv" would look like two different products.
 * So there is exactly one renderer, `<sarv-login-button>`, and both entry
 * points are thin wrappers over it: `renderButton()` creates one, and the React
 * component reconciles one. Styling and behaviour live in a single place.
 */
import { SarvLoginClient } from "./flow.js";
import { SARV_MARK_SVG } from "./logo.generated.js";
import { buttonCss } from "./styles.js";
import type {
  SarvButtonOptions,
  SarvLoginConfig,
  SarvSize,
  SarvTheme,
  SarvVariant,
} from "./types.js";

export const TAG_NAME = "sarv-login-button";
export const DEFAULT_LABEL = "Login with Sarv";

/** Said by both the click path and `login()`, so the two cannot drift apart.
 *  A console error, not a thrown one: this runs from a click handler, and an
 *  exception there is swallowed by the page. The message has to name the
 *  attributes, because the symptom the developer sees is "it does nothing". */
const missingConfigMessage = (tag: string, event: string): string =>
  `<${tag}>: cannot start login without both \`client-id\` and \`redirect-uri\`. ` +
  `Listen for the "${event}" event instead if your app starts the flow itself.`;

/** The event fired on click, before the redirect. Cancelable: calling
 *  `preventDefault()` stops the navigation, which is how a host runs its own
 *  consent step, analytics gate or form validation first. */
export const LOGIN_EVENT = "sarv-login";

const VARIANTS: SarvVariant[] = ["brand", "surface"];
const SIZES: SarvSize[] = ["sm", "md", "lg"];
const THEMES: SarvTheme[] = ["light", "dark", "auto"];

/** The element's public surface, as seen by TypeScript callers. Declared as an
 *  interface because the class itself is built lazily — see `defineButton`. */
export interface SarvLoginButtonElement extends HTMLElement {
  clientId: string | null;
  redirectUri: string | null;
  scopes: string[] | null;
  oauthUrl: string | null;
  label: string | null;
  variant: SarvVariant;
  size: SarvSize;
  theme: SarvTheme;
  fullWidth: boolean;
  disabled: boolean;
  /**
   * Turns the button into a real link, for apps whose BACKEND runs the OAuth
   * flow. Set it and the element renders an `<a href>` instead of a `<button>`,
   * and starts no flow of its own — the browser just follows the link.
   *
   * This is the shape a backend-for-frontend integration wants: point it at
   * your own `/auth/login`, let your server mint state and PKCE, and no token
   * ever reaches the page. It is a genuine anchor, so middle-click, ctrl-click,
   * "open in new tab" and right-click-copy-link all behave, and it still works
   * with JavaScript disabled — none of which a click handler can imitate.
   */
  href: string | null;
  /** Starts the flow immediately, as a click would. */
  login(): Promise<void>;
}

/** Attribute names, in the kebab-case an HTML author writes. */
const OBSERVED = [
  "client-id",
  "redirect-uri",
  "scopes",
  "oauth-url",
  "label",
  "variant",
  "size",
  "theme",
  "full-width",
  "disabled",
  "href",
] as const;

/** Reads an attribute against a fixed set, falling back rather than throwing:
 *  a typo in someone else's HTML should render the default button, not nothing. */
function oneOf<T extends string>(value: string | null, allowed: T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

/** Is the trigger the anchor variant?
 *
 *  A tag test, not `instanceof HTMLAnchorElement`. Those constructors are
 *  per-realm: an element created in another document — an iframe, a template
 *  moved between documents — fails the instanceof while being exactly the right
 *  element. `tagName` is always uppercase for HTML elements and needs no global
 *  to be defined, which also keeps this working under SSR-shaped test DOMs. */
const isAnchor = (
  node: HTMLButtonElement | HTMLAnchorElement
): node is HTMLAnchorElement => node.tagName === "A";

let ButtonClass: CustomElementConstructor | undefined;

/**
 * Builds the element class.
 *
 * Deferred into a function because `class extends HTMLElement` evaluates
 * HTMLElement at definition time, and this module is imported during
 * server-side rendering where there is no DOM. Touching it at module scope
 * would make `import "@sarv-in/login"` throw in Next.js.
 */
function buildButtonClass(): CustomElementConstructor {
  if (ButtonClass) return ButtonClass;

  ButtonClass = class SarvLoginButton extends HTMLElement {
    static get observedAttributes(): string[] {
      return [...OBSERVED];
    }

    private readonly root: ShadowRoot;
    /** A <button>, or an <a> when `href` is set. Swapped in place by
     *  `ensureTrigger()`, which is why this one is not readonly. */
    private trigger: HTMLButtonElement | HTMLAnchorElement;
    private readonly styleTag: HTMLStyleElement;
    /** Held as fields so the swap can move them into the new trigger rather
     *  than rebuild the mark's SVG on every mode change. */
    private readonly mark: HTMLSpanElement;
    private readonly labelSpan: HTMLSpanElement;
    private lastCss = "";

    constructor() {
      super();
      // "closed" would hide the button from the host's own devtools and
      // testing-library queries for no security gain — the markup is public.
      //
      // `delegatesFocus` forwards focus from the host to the inner <button>.
      // Without it, Tab still reaches the button (it is focusable, and
      // sequential navigation enters the shadow tree), but
      // `element.focus()` from JS silently does nothing — so React's autoFocus,
      // "focus the login button after this error", and any focus-management
      // code a host writes would all no-op. Measured: activeElement inside the
      // shadow root stayed undefined after a focus() call.
      this.root = this.attachShadow({ mode: "open", delegatesFocus: true });
      this.styleTag = document.createElement("style");

      this.mark = document.createElement("span");
      this.mark.className = "sarv-login-mark";
      this.mark.part = "mark";
      // Static, generated markup from our own asset — no user input reaches it.
      this.mark.innerHTML = SARV_MARK_SVG;

      this.labelSpan = document.createElement("span");
      this.labelSpan.className = "sarv-login-label";
      this.labelSpan.part = "label";

      // A button by default; `render()` swaps in an anchor if `href` is set.
      // The constructor cannot decide, because attributes are not readable
      // here when the element is created by `document.createElement`.
      this.trigger = this.makeTrigger("button");
      this.root.append(this.styleTag, this.trigger);
    }

    connectedCallback(): void {
      this.render();
    }

    attributeChangedCallback(): void {
      // Only after the shadow root exists; the constructor renders nothing.
      if (this.isConnected) this.render();
    }

    /* --- properties, so JS callers never have to think in attributes --- */

    get clientId(): string | null {
      return this.getAttribute("client-id");
    }
    set clientId(value: string | null) {
      this.reflect("client-id", value);
    }

    get redirectUri(): string | null {
      return this.getAttribute("redirect-uri");
    }
    set redirectUri(value: string | null) {
      this.reflect("redirect-uri", value);
    }

    get scopes(): string[] | null {
      const raw = this.getAttribute("scopes");
      // Space-separated in the attribute, because that is how the scope
      // parameter itself is written on the wire.
      return raw ? raw.trim().split(/[\s,]+/).filter(Boolean) : null;
    }
    set scopes(value: string[] | null) {
      this.reflect("scopes", value?.length ? value.join(" ") : null);
    }

    get oauthUrl(): string | null {
      return this.getAttribute("oauth-url");
    }
    set oauthUrl(value: string | null) {
      this.reflect("oauth-url", value);
    }

    get label(): string | null {
      return this.getAttribute("label");
    }
    set label(value: string | null) {
      this.reflect("label", value);
    }

    get variant(): SarvVariant {
      return oneOf(this.getAttribute("variant"), VARIANTS, "brand");
    }
    set variant(value: SarvVariant) {
      this.reflect("variant", value);
    }

    get size(): SarvSize {
      return oneOf(this.getAttribute("size"), SIZES, "md");
    }
    set size(value: SarvSize) {
      this.reflect("size", value);
    }

    get theme(): SarvTheme {
      return oneOf(this.getAttribute("theme"), THEMES, "auto");
    }
    set theme(value: SarvTheme) {
      this.reflect("theme", value);
    }

    get fullWidth(): boolean {
      return this.hasAttribute("full-width");
    }
    set fullWidth(value: boolean) {
      this.toggleAttribute("full-width", !!value);
    }

    get href(): string | null {
      return this.getAttribute("href");
    }
    set href(value: string | null) {
      this.reflect("href", value);
    }

    get disabled(): boolean {
      return this.hasAttribute("disabled");
    }
    set disabled(value: boolean) {
      this.toggleAttribute("disabled", !!value);
    }

    /** Starts the flow. Also the click path, so both behave identically. */
    async login(): Promise<void> {
      const config = this.readConfig();
      if (!config) {
        console.error(missingConfigMessage(TAG_NAME, LOGIN_EVENT));
        return;
      }
      try {
        await new SarvLoginClient(config).login();
      } catch (error) {
        console.error(`<${TAG_NAME}>: login failed to start.`, error);
      }
    }

    private readConfig(): SarvLoginConfig | null {
      const clientId = this.clientId;
      const redirectUri = this.redirectUri;
      if (!clientId || !redirectUri) return null;
      return {
        clientId,
        redirectUri,
        scopes: this.scopes ?? undefined,
        oauthUrl: this.oauthUrl ?? undefined,
      };
    }

    private readonly onClick = (event: MouseEvent): void => {
      // preventDefault matters now that the trigger can be an anchor: without
      // it a disabled or host-handled link would still navigate.
      if (this.disabled) {
        event.preventDefault();
        return;
      }
      const proceed = this.dispatchEvent(
        new CustomEvent(LOGIN_EVENT, {
          // Crosses the shadow boundary and bubbles to the host's listeners,
          // which is the point of the event.
          bubbles: true,
          composed: true,
          cancelable: true,
          detail: { originalEvent: event, config: this.readConfig() },
        })
      );
      // preventDefault() on the event means "I will handle it".
      if (!proceed) {
        event.preventDefault();
        return;
      }
      // In link mode the anchor's own navigation IS the behaviour. The event
      // above still fires, so a host can observe or cancel the click, but this
      // element must not also start a flow of its own.
      if (this.href !== null) return;
      if (!this.readConfig()) {
        // Nothing configured at all: the element is a styled trigger and the
        // host's own listener is the whole behaviour, so silence is correct.
        //
        // HALF configured is a different thing. `client-id` without
        // `redirect-uri` is a forgotten attribute, and returning quietly there
        // gives the developer a button that does nothing with no clue why —
        // the worst failure this component can have. So it says the same thing
        // `login()` would have said.
        if (this.clientId || this.redirectUri) {
          console.error(missingConfigMessage(TAG_NAME, LOGIN_EVENT));
        }
        return;
      }
      void this.login();
    };

    /** Builds a trigger of either kind, styled identically. */
    private makeTrigger(kind: "button" | "a"): HTMLButtonElement | HTMLAnchorElement {
      const node = document.createElement(kind);
      if (kind === "button") {
        // A real <button type="button">, not a styled div: it must be reachable
        // by Tab, activate on Space and Enter, and be announced as a button,
        // and `type` stops it submitting a form it happens to sit inside.
        (node as HTMLButtonElement).type = "button";
      }
      node.className = "sarv-login-btn";
      node.part = "button";
      node.append(this.mark, this.labelSpan);
      // Cast because createElement over a union of tag names widens to the
      // base addEventListener signature, which types the argument as `Event`.
      // A click on a button or an anchor is a MouseEvent either way.
      node.addEventListener("click", this.onClick as EventListener);
      return node;
    }

    /** Swaps <button> for <a> when `href` appears, and back when it goes.
     *
     *  A swap rather than an always-anchor: an anchor with no href is not
     *  focusable and is announced as plain text, so the default button would
     *  quietly lose its keyboard behaviour if the two shared one node. */
    private ensureTrigger(): void {
      const wantsAnchor = this.href !== null;
      if (wantsAnchor === isAnchor(this.trigger)) return;
      const next = this.makeTrigger(wantsAnchor ? "a" : "button");
      // The old listener goes with the old node, but removing it explicitly
      // keeps a detached node from holding the closure if a host kept a
      // reference to it through `part`.
      this.trigger.removeEventListener("click", this.onClick as EventListener);
      this.trigger.replaceWith(next);
      this.trigger = next;
    }

    private reflect(name: string, value: string | null): void {
      if (value === null || value === undefined) this.removeAttribute(name);
      else this.setAttribute(name, value);
    }

    private render(): void {
      const css = buttonCss({
        theme: this.theme,
        variant: this.variant,
        size: this.size,
        fullWidth: this.fullWidth,
      });
      // Compared before assigning: writing the same text back re-parses the
      // sheet and drops the button's transition mid-hover.
      if (css !== this.lastCss) {
        this.styleTag.textContent = css;
        this.lastCss = css;
      }
      this.ensureTrigger();
      this.labelSpan.textContent = this.label ?? DEFAULT_LABEL;
      if (isAnchor(this.trigger)) {
        // An anchor has no `disabled`. Dropping the href is what actually makes
        // it inert: it stops being activatable AND leaves the tab order, which
        // is the behaviour a disabled control needs. `aria-disabled` then tells
        // a screen reader why it is skipped, rather than the control simply
        // vanishing from the page's semantics.
        if (this.disabled) {
          this.trigger.removeAttribute("href");
          this.trigger.setAttribute("aria-disabled", "true");
        } else {
          this.trigger.href = this.href ?? "";
          this.trigger.removeAttribute("aria-disabled");
        }
      } else {
        this.trigger.disabled = this.disabled;
      }
    }
  };

  return ButtonClass;
}

/**
 * Registers `<sarv-login-button>`. Safe to call any number of times, from any
 * number of bundles: two copies of this package on one page must not throw a
 * NotSupportedError over a name that is already the right element.
 */
export function defineSarvLoginButton(tag: string = TAG_NAME): void {
  if (typeof window === "undefined" || !window.customElements) return;
  if (window.customElements.get(tag)) return;
  window.customElements.define(tag, buildButtonClass());
}

/**
 * Creates a button imperatively — the vanilla-JS path.
 *
 * @param target A CSS selector or an element to render into.
 * @returns The element, so the caller can listen for `sarv-login` on it.
 */
export function renderButton(
  target: string | Element,
  options: SarvLoginConfig & SarvButtonOptions & { replace?: boolean }
): SarvLoginButtonElement {
  const host = typeof target === "string" ? document.querySelector(target) : target;
  if (!host) throw new Error(`Sarv login: no element matched \`${String(target)}\`.`);
  defineSarvLoginButton();

  const element = document.createElement(TAG_NAME) as SarvLoginButtonElement;
  element.clientId = options.clientId ?? null;
  element.redirectUri = options.redirectUri ?? null;
  if (options.scopes) element.scopes = options.scopes;
  if (options.oauthUrl) element.oauthUrl = options.oauthUrl;
  if (options.label) element.label = options.label;
  if (options.variant) element.variant = options.variant;
  if (options.size) element.size = options.size;
  if (options.theme) element.theme = options.theme;
  if (options.href) element.href = options.href;
  element.fullWidth = !!options.fullWidth;
  element.disabled = !!options.disabled;

  // Default is to replace the container's contents, so calling renderButton
  // twice on the same target does not stack two buttons.
  if (options.replace !== false) host.replaceChildren(element);
  else host.append(element);
  return element;
}
