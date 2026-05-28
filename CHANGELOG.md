# Changelog

All notable changes to `@innertia-solutions/innertia-nuxt` are documented here.

## [Unreleased]

### BREAKING CHANGES

#### apps → contexts rename

Aligns frontend with innertia-laravel which already renamed the concept.

**Config (`nuxt.config.ts` in your product):**
```diff
- innertia.apps: { backoffice: { ... }, technician: { ... } }
+ innertia.contexts: { backoffice: { ... }, technician: { ... } }
```

**Types:**
```diff
- import type { AppDefinition } from '@innertia-solutions/innertia-nuxt/app.config'
+ import type { ContextDefinition } from '@innertia-solutions/innertia-nuxt/app.config'

- import type { AppMobileMode } from '@innertia-solutions/innertia-nuxt/app.config'
+ import type { ContextMobileMode } from '@innertia-solutions/innertia-nuxt/app.config'
```

**Composables:**
```diff
- const { current, all, accessible, canAccess } = useApp()
+ const { current, all, accessible, canAccess } = useContext()
```

`useApp()` has been removed. Use `useContext()` for all context/app logic. `useContext()` now also exposes: `contexts` (dict), `currentContext`, `availableContexts`, `switchContext()`, `confirmSwitch()`, `hasAccessToContext()`.

**Login body field:**

`performLogin()` now sends `context` instead of `app` in the POST body — matching what innertia-laravel now expects.
