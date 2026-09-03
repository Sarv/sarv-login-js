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
] as const;

/** Reads an attribute against a fixed set, falling back rather than throwing:
 *  a typo in someone else's HTML should render the default button, not nothing. */
function oneOf<T extends string>(value: string | null, allowed: T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

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
    private readonly button: HTMLButtonElement;
    private readonly styleTag: HTMLStyleElement;
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

      this.button = document.createElement("button");
      // A real <button type="button">, not a styled div: it must be reachable
      // by Tab, activate on Space and Enter, and be announced as a button,
      // and `type` stops it submitting a form it happens to sit inside.
      this.button.type = "button";
      this.button.className = "sarv-login-btn";
      this.button.part = "button";

      const mark = document.createElement("span");
      mark.className = "sarv-login-mark";
      mark.part = "mark";
      // Static, generated markup from our own asset — no user input reaches it.
      mark.innerHTML = SARV_MARK_SVG;

      this.labelSpan = document.createElement("span");
      this.labelSpan.className = "sarv-login-label";
      this.labelSpan.part = "label";

      this.button.append(mark, this.labelSpan);
      this.root.append(this.styleTag, this.button);
      this.button.addEventListener("click", this.onClick);
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
      if (this.disabled) return;
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
      if (!proceed) return;
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
      this.labelSpan.textContent = this.label ?? DEFAULT_LABEL;
      this.button.disabled = this.disabled;
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
  element.fullWidth = !!options.fullWidth;
  element.disabled = !!options.disabled;

  // Default is to replace the container's contents, so calling renderButton
  // twice on the same target does not stack two buttons.
  if (options.replace !== false) host.replaceChildren(element);
  else host.append(element);
  return element;
}
