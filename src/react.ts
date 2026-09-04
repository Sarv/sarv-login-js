/**
 * The React entry point: `@sarv-in/login/react`.
 *
 * WHY THIS FILE IS THIN, AND WHY IT IS .ts RATHER THAN .tsx
 * ---------------------------------------------------------------------------
 * It renders the same `<sarv-login-button>` custom element the vanilla API
 * does, through a ref. None of the styling, the mark, the focus ring or the
 * flow is repeated here — a second implementation is how two integrations of
 * the same product end up looking different.
 *
 * `createElement` instead of JSX keeps the file plain TypeScript: JSX for an
 * unknown tag needs an `IntrinsicElements` augmentation whose shape differs
 * between React 18 and 19, and this way the package compiles the same against
 * both.
 */
import { createElement, useCallback, useEffect, useMemo, useRef } from "react";
import type { CSSProperties, ReactElement, Ref } from "react";
import { defineSarvLoginButton, LOGIN_EVENT, TAG_NAME } from "./button.js";
import type { SarvLoginButtonElement } from "./button.js";
import { SarvLoginClient } from "./flow.js";
import type {
  SarvButtonOptions,
  SarvCallbackError,
  SarvCallbackResult,
  SarvLoginConfig,
} from "./types.js";

export interface SarvLoginButtonProps extends SarvButtonOptions, Partial<SarvLoginConfig> {
  /**
   * Called on click, before the redirect. Call `event.preventDefault()` to stop
   * it — that is the hook for running validation or your own analytics first,
   * or for handling the whole flow yourself.
   */
  onLogin?: (event: CustomEvent) => void;
  className?: string;
  style?: CSSProperties;
  /** Forwarded to the underlying element, for imperative `login()` calls. */
  elementRef?: Ref<SarvLoginButtonElement | null>;
}

/**
 * The button.
 *
 * ```tsx
 * <SarvLoginButton clientId="..." redirectUri={`${origin}/callback`} />
 * ```
 */
export function SarvLoginButton(props: SarvLoginButtonProps): ReactElement {
  const {
    clientId,
    redirectUri,
    scopes,
    oauthUrl,
    label,
    variant,
    size,
    theme,
    fullWidth,
    disabled,
    href,
    onLogin,
    className,
    style,
    elementRef,
  } = props;

  const localRef = useRef<SarvLoginButtonElement | null>(null);

  // Registered in an effect, not at module scope: this module is imported on
  // the server by every React framework that does SSR, and `customElements`
  // does not exist there.
  useEffect(() => {
    defineSarvLoginButton();
  }, []);

  // The click listener is attached imperatively because React's synthetic
  // `onClick` cannot observe a custom event, and `sarv-login` is what carries
  // the cancelable "before redirect" moment.
  useEffect(() => {
    const element = localRef.current;
    if (!element || !onLogin) return;
    const handler = (event: Event) => onLogin(event as CustomEvent);
    element.addEventListener(LOGIN_EVENT, handler);
    return () => element.removeEventListener(LOGIN_EVENT, handler);
  }, [onLogin]);

  const attach = useCallback(
    (element: SarvLoginButtonElement | null) => {
      localRef.current = element;
      if (typeof elementRef === "function") elementRef(element);
      else if (elementRef) (elementRef as { current: unknown }).current = element;
    },
    [elementRef]
  );

  return createElement(TAG_NAME, {
    ref: attach,
    class: className,
    style,
    // Attributes, in the element's own kebab-case. `undefined` is omitted by
    // React, which is what removes the attribute — so an absent prop means the
    // element's own default rather than an empty string.
    "client-id": clientId,
    "redirect-uri": redirectUri,
    scopes: scopes?.length ? scopes.join(" ") : undefined,
    "oauth-url": oauthUrl,
    label,
    variant,
    size,
    theme,
    href,
    // Boolean attributes: present or absent. `false` would render
    // `full-width="false"`, which the element reads as present.
    "full-width": fullWidth ? "" : undefined,
    disabled: disabled ? "" : undefined,
  });
}

/**
 * The flow without the button, for an app whose trigger is its own component.
 *
 * The client is memoized on the config's values rather than its identity, so
 * an inline object literal — the way everyone writes props — does not rebuild
 * it on every render.
 */
export function useSarvLogin(config: SarvLoginConfig): {
  login: () => Promise<void>;
  handleCallback: (search?: string) => SarvCallbackResult | SarvCallbackError;
  client: SarvLoginClient;
} {
  const scopeKey = config.scopes?.join(" ") ?? "";
  const client = useMemo(
    () => new SarvLoginClient(config),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [config.clientId, config.redirectUri, config.oauthUrl, scopeKey]
  );
  return {
    client,
    login: useCallback(() => client.login(), [client]),
    handleCallback: useCallback((search?: string) => client.handleCallback(search), [client]),
  };
}

export type {
  SarvButtonOptions,
  SarvCallbackError,
  SarvCallbackResult,
  SarvLoginConfig,
  SarvLoginButtonElement,
};
export { LOGIN_EVENT, TAG_NAME };
