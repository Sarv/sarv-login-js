/**
 * The Vue entry point: `@sarv-in/login/vue`.
 *
 * WHY THIS FILE IS A RENDER FUNCTION AND NOT AN SFC
 * ---------------------------------------------------------------------------
 * It renders the same `<sarv-login-button>` custom element the vanilla API
 * does. None of the styling, the mark, the focus ring or the flow is repeated
 * here — a second implementation is how two integrations of one product end up
 * looking different.
 *
 * `h()` instead of a template is the same decision `react.ts` makes with
 * `createElement`, and it buys something specific here: a template containing
 * `<sarv-login-button>` is compiled by the host's build, and Vue's compiler
 * treats an unknown dashed tag as a component it cannot resolve — every Vite
 * user would have to add `compilerOptions.isCustomElement` to their config to
 * silence it. A render function is never compiled by anyone, so that
 * configuration is not needed and cannot be got wrong.
 *
 * ON EVENTS: there is deliberately no `onLogin` prop. `sarv-login` is a plain
 * CustomEvent, this component renders a single root element, and Vue's
 * attribute fallthrough puts an undeclared listener straight onto it — so
 * `@sarv-login="handler"` works with no code from us. React needs a prop only
 * because its synthetic events cannot see a custom event at all.
 */
import { defineComponent, h, onMounted, ref } from "vue";
import type { PropType, VNode } from "vue";
import { defineSarvLoginButton, TAG_NAME } from "./button.js";
import type { SarvLoginButtonElement } from "./button.js";
import { SarvLoginClient } from "./flow.js";
import type {
  SarvCallbackError,
  SarvCallbackResult,
  SarvLoginConfig,
  SarvSize,
  SarvTheme,
  SarvVariant,
} from "./types.js";

/**
 * The button.
 *
 * ```vue
 * <SarvLoginButton client-id="..." :redirect-uri="`${origin}/callback`" />
 * ```
 *
 * Props are declared in camelCase, so a template may write either
 * `client-id` or `:clientId`; Vue normalises both.
 */
export const SarvLoginButton = defineComponent({
  name: "SarvLoginButton",
  props: {
    clientId: String,
    redirectUri: String,
    scopes: Array as PropType<string[]>,
    oauthUrl: String,
    label: String,
    variant: String as PropType<SarvVariant>,
    size: String as PropType<SarvSize>,
    theme: String as PropType<SarvTheme>,
    href: String,
    fullWidth: Boolean,
    disabled: Boolean,
  },
  setup(props, { expose }) {
    const element = ref<SarvLoginButtonElement | null>(null);

    // Registered on mount, not at module scope: this module is imported on the
    // server by Nuxt and anything else doing SSR, and `customElements` does not
    // exist there.
    onMounted(() => defineSarvLoginButton());

    // Exposed so a parent's `ref` reaches the ELEMENT rather than this
    // component instance — that is what makes an imperative `login()` possible
    // from the host, the same as React's `elementRef`.
    expose({
      element,
      login: () => element.value?.login(),
    });

    return (): VNode =>
      h(TAG_NAME, {
        ref: element,
        // Attributes in the element's own kebab-case. `undefined` is how Vue
        // removes an attribute, so an absent prop means the element's own
        // default rather than an empty string.
        "client-id": props.clientId,
        "redirect-uri": props.redirectUri,
        scopes: props.scopes?.length ? props.scopes.join(" ") : undefined,
        "oauth-url": props.oauthUrl,
        label: props.label,
        variant: props.variant,
        size: props.size,
        theme: props.theme,
        href: props.href,
        // Boolean attributes are present or absent. `false` would render
        // `full-width="false"`, which the element reads as present.
        "full-width": props.fullWidth ? "" : undefined,
        disabled: props.disabled ? "" : undefined,
      });
  },
});

/**
 * The flow without the button, for an app whose trigger is its own component.
 *
 * No memoization, unlike the React hook: `setup()` runs once per component
 * instance, so an inline config object is not re-read on every render and
 * there is no identity problem to work around.
 */
export function useSarvLogin(config: SarvLoginConfig): {
  login: () => Promise<void>;
  handleCallback: (search?: string) => SarvCallbackResult | SarvCallbackError;
  client: SarvLoginClient;
} {
  const client = new SarvLoginClient(config);
  return {
    client,
    login: () => client.login(),
    handleCallback: (search?: string) => client.handleCallback(search),
  };
}

export type {
  SarvButtonOptions,
  SarvCallbackError,
  SarvCallbackResult,
  SarvLoginConfig,
  SarvLogoutOptions,
  SarvTokenResponse,
} from "./types.js";
export type { SarvLoginButtonElement } from "./button.js";
export { LOGIN_EVENT, TAG_NAME } from "./button.js";
