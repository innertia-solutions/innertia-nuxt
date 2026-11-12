# Changelog

All notable changes to `@innertia-solutions/innertia-nuxt` are documented here.

## [Unreleased]

### Added

- Passkeys (WebAuthn): composable `usePasskeys()`, componentes `Auth.PasskeyButton` (login tenant y `/platform`, con autocompletado), `Auth.PasskeyInvite`, `Auth.PasskeyManager` y `Auth.UserPasskeys`, y rutas BFF `/_auth/passkey/login` y `/_auth/platform/passkey/login` que sellan la sesión solo si hay token. Se activa y desactiva desde `/platform` con `Auth.PasskeySettings` (sin variables de entorno). Ver `docs/passkeys.md`.
- `Kanban.Standard`: reordenamiento intra-columna con drag&drop (prop `reorderEndpoint`); orden por `position`, placeholder de inserción, y persistencia vía POST. Retrocompatible: sin la prop se comporta igual que antes (solo cross-column).

### Fixed

- Sesión: renovación deslizante del JWT en el BFF. Cuando al token le quedan menos de 10 min (o menos de 1/3 de su vida), `/api/**` y el SSR lo renuevan contra `POST auth/refresh` y reescriben la cookie sellada; refrescos concurrentes se deduplican y los requests tardíos con el token viejo reciben el nuevo; un refresh fallido no se reintenta con ese token por 30 s (timeout de 5 s). Con uso activo la sesión ya no muere a los 60 min fijos. No aplica a tokens de plataforma. Configurable con `runtimeConfig.authRefresh` (`NUXT_AUTH_REFRESH_ENABLED`, `NUXT_AUTH_REFRESH_PATH`).
- `useApi`: ante un 401, las mutaciones del cliente (POST/PUT/PATCH/DELETE) ahora **lanzan** un error `{ status: 401, data: { message } }` en vez de devolver `null` (antes `useMutation` lo tomaba como éxito y mostraba "Guardado" sin guardar). GET y las llamadas SSR siguen devolviendo `null`. Override por llamada con `{ throwOnUnauthorized: true|false }`. Además muestra un aviso "Tu sesión expiró" (una vez) y, al lanzar, no espera la navegación al login para que el llamador muestre el error antes de las guardas de "cambios sin guardar".
- `useForm`: el error de un campo se borra al cambiar su valor (antes quedaba "Este campo es obligatorio" bajo un campo ya completado hasta el siguiente envío).
- `Forms.Select`: el placeholder por defecto es "Selecciona…" y siempre se pasa a Preline (antes, con `clearable`, se veía "Select..."). En modo `clearable` se activa `optionAllowEmptyOption` para que la opción vacía siga siendo seleccionable.
- `Forms.Select`: el dropdown ahora usa `dropdownScope:'window'` (Preline lo teletransporta al `<body>` y lo posiciona con floating-ui). Deja de recortarse dentro de contenedores con scroll —modales, paneles— y flota por encima (`z-[10000]`). Se expone `window.FloatingUIDOM` en el plugin de Preline y se agrega `@floating-ui/dom` como dependencia.
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
