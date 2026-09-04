/**
 * The Angular entry point: `@sarv-in/login/angular`.
 *
 * WHY THERE IS NO COMPONENT HERE, AND WHY THAT IS THE RIGHT ANSWER
 * ---------------------------------------------------------------------------
 * Since Angular 13 every decorated class in a LIBRARY has to be compiled by
 * `ngtsc` into partial-Ivy format; a `@Component` or `@Injectable` put through
 * plain tsc is not usable by a consumer's AOT build. Shipping one would mean
 * bolting ng-packagr onto this package and pinning a `@angular/core` peer range
 * to bump on every Angular major — a whole second toolchain in service of a
 * hundred-line wrapper.
 *
 * It buys nothing, because Angular already renders the button. `<sarv-login-
 * button>` is a custom element that reads string attributes and emits a plain
 * CustomEvent, so a template does the idiomatic thing with no help:
 *
 * ```ts
 * @Component({
 *   selector: "app-signin",
 *   standalone: true,
 *   schemas: [CUSTOM_ELEMENTS_SCHEMA],   // teaches Angular the dashed tag
 *   template: `
 *     <sarv-login-button
 *       [attr.client-id]="clientId"
 *       [attr.redirect-uri]="redirectUri"
 *       (sarv-login)="onLogin($event)"
 *     ></sarv-login-button>`,
 * })
 * ```
 *
 * `(sarv-login)` is Angular's own event binding on a DOM event — nothing about
 * it is special-cased for custom elements.
 *
 * So what this module ships is the half Angular cannot supply for itself: an
 * injectable service around the flow, and the element registration done once,
 * in a place that is safe under Angular Universal. Both are plain TypeScript
 * with NO import of @angular/core, type or runtime — which is exactly why this
 * package can never be out of step with your Angular version.
 */
import { defineSarvLoginButton, renderButton, TAG_NAME } from "./button.js";
import type { SarvLoginButtonElement } from "./button.js";
import { isCallbackError, SarvLoginClient } from "./flow.js";
import type {
  SarvButtonOptions,
  SarvCallbackError,
  SarvCallbackResult,
  SarvLoginConfig,
  SarvLogoutOptions,
  SarvTokenResponse,
} from "./types.js";

/**
 * The flow, as an injectable.
 *
 * Undecorated on purpose — see the header. Angular's DI takes a class as a
 * token regardless of whether it carries `@Injectable`, so
 * `constructor(private sarv: SarvLoginService)` works once `provideSarvLogin()`
 * is in the providers array.
 */
export class SarvLoginService {
  readonly client: SarvLoginClient;

  constructor(config: SarvLoginConfig) {
    this.client = new SarvLoginClient(config);
    // Guarded rather than assumed: Angular Universal executes this constructor
    // on the server, where `customElements` does not exist. Registering here
    // means a template's <sarv-login-button> upgrades itself as soon as
    // anything injects the service, with no `ngOnInit` boilerplate in the app.
    if (typeof window !== "undefined" && typeof window.customElements !== "undefined") {
      defineSarvLoginButton();
    }
  }

  /** Starts the flow: stores the verifier, state and nonce, then redirects. */
  login(): Promise<void> {
    return this.client.login();
  }

  /**
   * Reads the callback. Use `isCallbackError()` on the result — a declined
   * consent and a state mismatch both arrive here rather than as a throw,
   * because a router's resolver should render a page, not a stack trace.
   */
  handleCallback(search?: string): SarvCallbackResult | SarvCallbackError {
    return this.client.handleCallback(search);
  }

  /** Swaps the code for tokens, verifying the ID token's nonce on the way. */
  exchangeCode(result: SarvCallbackResult): Promise<SarvTokenResponse> {
    return this.client.exchangeCode(result);
  }

  fetchUser(accessToken: string): Promise<Record<string, unknown>> {
    return this.client.fetchUser(accessToken);
  }

  revokeToken(token: string, hint?: "access_token" | "refresh_token"): Promise<boolean> {
    return this.client.revokeToken(token, hint);
  }

  /** Revokes the app's tokens, then redirects to end the Sarv session. */
  logout(options: SarvLogoutOptions = {}): Promise<void> {
    return this.client.logout(options);
  }

  logoutUrl(options: SarvLogoutOptions = {}): string {
    return this.client.buildLogoutUrl(options);
  }

  /**
   * Renders a button into an element imperatively — for a host that would
   * rather keep the tag out of its template than declare
   * `CUSTOM_ELEMENTS_SCHEMA`. Pass an `ElementRef`'s `nativeElement`.
   */
  mount(target: Element, options: SarvButtonOptions = {}): SarvLoginButtonElement {
    return renderButton(target, { ...this.configOf(), ...options });
  }

  private configOf(): SarvLoginConfig {
    const { clientId, redirectUri, scopes, oauthUrl, extraParams } = this.client.config;
    return { clientId, redirectUri, scopes, oauthUrl, extraParams };
  }
}

/**
 * The shape of an Angular factory provider, declared structurally.
 *
 * Not imported from `@angular/core`: even a type-only import would put Angular
 * in this package's devDependencies and its version range in its docs. This
 * interface is assignable to Angular's own `Provider`, which is all a consumer
 * needs.
 */
export interface SarvLoginProvider {
  provide: typeof SarvLoginService;
  useFactory: () => SarvLoginService;
}

/**
 * Drop into any `providers` array — a standalone component's, a route's, or the
 * application's:
 *
 * ```ts
 * bootstrapApplication(AppComponent, {
 *   providers: [provideSarvLogin({ clientId: "...", redirectUri: "..." })],
 * });
 * ```
 *
 * Application-level is usually right: the service holds no per-component state,
 * and one instance means one registration of the custom element.
 */
export function provideSarvLogin(config: SarvLoginConfig): SarvLoginProvider {
  return {
    provide: SarvLoginService,
    useFactory: () => new SarvLoginService(config),
  };
}

export { isCallbackError, SarvLoginClient, TAG_NAME };
export { LOGIN_EVENT } from "./button.js";
export { nonceProblem } from "./flow.js";
export type {
  SarvButtonOptions,
  SarvCallbackError,
  SarvCallbackResult,
  SarvLoginButtonElement,
  SarvLoginConfig,
  SarvLogoutOptions,
  SarvTokenResponse,
};
