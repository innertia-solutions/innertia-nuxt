# Changelog

All notable changes to `@innertia-solutions/innertia-nuxt` are documented here.

## [Unreleased]

### Fixed

- `Forms.Select`: el dropdown ahora usa `dropdownScope:'window'` (Preline lo teletransporta al `<body>` y lo posiciona con floating-ui). Deja de recortarse dentro de contenedores con scroll —modales, paneles— y flota por encima (`z-[10000]`). Se expone `window.FloatingUIDOM` en el plugin de Preline y se agrega `@floating-ui/dom` como dependencia.

### Fixed

- `Kanban.Standard`: en modo `bordered=false`, el `ring` de highlight al arrastrar sobre una columna se recortaba por arriba (el contenedor `overflow-x-auto` sin padding clippeaba los 2px del ring). Se agrega `p-1` al scroll container en ese modo.

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
