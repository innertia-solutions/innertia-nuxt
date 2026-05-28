# innertia-nuxt: apps → contexts Rename — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename the "apps" concept to "contexts" throughout innertia-nuxt, aligning the frontend library with the already-renamed innertia-laravel backend.

**Architecture:** Pure rename — zero behavior changes. Config key `innertia.apps` → `innertia.contexts`, types `AppDefinition`/`AppMobileMode` → `ContextDefinition`/`ContextMobileMode`, composable `useApp()` merged into `useContext()`, middleware file renamed, login body field corrected. No backward-compat aliases.

**Tech Stack:** Nuxt 4, Vue 3, TypeScript, Pinia. No test suite in this repo — verification is via `grep` for stale references.

**Working directory:** `/Users/guillermofarias/Innertia/Dev/workspace/libraries/innertia-nuxt`

**Spec:** `docs/superpowers/specs/2026-05-27-nuxt-apps-to-contexts-rename-design.md`

---

## File Map

| File | Action |
|------|--------|
| `app.config.ts` | Rename type `AppDefinition` → `ContextDefinition`, `AppMobileMode` → `ContextMobileMode`, config key `innertia.apps` → `innertia.contexts` |
| `composables/useContext.js` | Absorb all logic from `useApp.ts`; now also reads from `innertia.contexts` and returns `current`, `all`, `accessible`, `canAccess`, `contexts` |
| `composables/useApp.ts` | **Delete** |
| `composables/useAuth.js` | Fix login body: `{ app: context }` → `{ context }` |
| `middleware/03.apps.global.ts` | **Rename** to `03.contexts.global.ts`; update import + internal variable references |
| `composables/useOrganization.ts` | `useApp()` → `useContext()` |
| `composables/useMobileGuard.ts` | `useApp()` → `useContext()`, `AppDefinition` → `ContextDefinition`, cookie key renamed |
| `CHANGELOG.md` | Create — document BREAKING CHANGES |

---

### Task 1: `app.config.ts` — rename types and config key

**Files:**
- Modify: `app.config.ts`

- [ ] **Step 1: Replace `innertia.apps` config key with `innertia.contexts`**

Find line (currently ~128):
```ts
    apps: {} as Record<string, AppDefinition>,
```
Replace with:
```ts
    /**
     * Declaración de contextos del producto.
     * Cada contexto define un prefijo de URL que mapea a un contexto del backend
     * (matching con `availableContexts` que devuelve `auth/me`).
     */
    contexts: {} as Record<string, ContextDefinition>,
```

Also update the comment block just above it (currently ~122–127):
```ts
    /**
     * Declaración de "apps" (contextos) del producto.
     * Cada app define un prefijo de URL que mapea a un contexto del backend
     * (matching con `availableContexts` que devuelve `auth/me`).
     */
    apps: {} as Record<string, AppDefinition>,
```

- [ ] **Step 2: Rename `AppMobileMode` type**

Find line (~147):
```ts
export type AppMobileMode = 'allow' | 'block' | 'redirect'
```
Replace with:
```ts
export type ContextMobileMode = 'allow' | 'block' | 'redirect'
```

- [ ] **Step 3: Rename `AppDefinition` interface and update its internal reference to `AppMobileMode`**

Find (~178–199):
```ts
export interface AppDefinition {
  /** Prefijo de URL — la ruta debe empezar con esto para considerarse "dentro" del app. */
  path: string
  /** Clave del contexto que matchea con `availableContexts` del backend. */
  context: string
  /** Label visible en pickers, dropdowns, etc. */
  label: string
  /** Descripción opcional para el picker mobile. */
  description?: string
  /** Nombre del icono de @tabler/icons-vue (sin "Icon"). */
  icon?: string
  /** Ruta de login del app. */
  loginPath: string
  /** Ruta home (post-login). */
  home: string
  /** Política de uso en mobile. */
  mobile: {
    mode: AppMobileMode
    /** Solo si mode === 'redirect' — adónde mandar desde mobile. */
    redirectTo?: string
  }
}
```
Replace with:
```ts
export interface ContextDefinition {
  /** Prefijo de URL — la ruta debe empezar con esto para considerarse "dentro" del contexto. */
  path: string
  /** Clave del contexto que matchea con `availableContexts` del backend. */
  context: string
  /** Label visible en pickers, dropdowns, etc. */
  label: string
  /** Descripción opcional para el picker mobile. */
  description?: string
  /** Nombre del icono de @tabler/icons-vue (sin "Icon"). */
  icon?: string
  /** Ruta de login del contexto. */
  loginPath: string
  /** Ruta home (post-login). */
  home: string
  /** Política de uso en mobile. */
  mobile: {
    mode: ContextMobileMode
    /** Solo si mode === 'redirect' — adónde mandar desde mobile. */
    redirectTo?: string
  }
}
```

- [ ] **Step 4: Verify no remaining `AppDefinition` or `AppMobileMode` references in `app.config.ts`**

Run:
```bash
grep -n "AppDefinition\|AppMobileMode" app.config.ts
```
Expected: no output (zero matches).

- [ ] **Step 5: Commit**

```bash
git add app.config.ts
git commit -m "refactor(contexts): rename AppDefinition→ContextDefinition, AppMobileMode→ContextMobileMode, innertia.apps→innertia.contexts in app.config"
```

---

### Task 2: `useContext.js` — absorb `useApp` logic

**Files:**
- Modify: `composables/useContext.js`

The current `useContext.js` handles runtime context switching. We extend it to also expose the config-level definitions (previously in `useApp.ts`), reading from `appConfig.innertia.contexts`.

- [ ] **Step 1: Replace the full contents of `composables/useContext.js`**

```js
// useAuthStore, useApi, useAuth auto-imported
import { computed } from 'vue'
import type { ContextDefinition } from '../app.config'

export function useContext() {
  const route = useRoute()
  const authStore = useAuthStore()
  const appConfig = useAppConfig()
  const api = useApi()
  const { fetchMe } = useAuth()

  // ── Config-level: definiciones declaradas en appConfig.innertia.contexts ───

  /** Diccionario de contextos declarados por el producto. */
  const contexts = computed<Record<string, ContextDefinition>>(() =>
    (appConfig.innertia?.contexts ?? {}) as Record<string, ContextDefinition>
  )

  /** Todos los contextos declarados, en orden de declaración. */
  const all = computed<ContextDefinition[]>(() => Object.values(contexts.value))

  /** Contexto actual según URL. `null` si la URL no cae en ningún contexto declarado. */
  const current = computed<ContextDefinition | null>(() => {
    return all.value.find(ctx =>
      route.path === ctx.path || route.path.startsWith(ctx.path + '/')
    ) ?? null
  })

  /** Contextos a los que el usuario autenticado tiene acceso (filtrado por `availableContexts`). */
  const accessible = computed<ContextDefinition[]>(() => {
    const ctxs = (authStore.availableContexts ?? []) as string[]
    return all.value.filter(ctx => ctxs.includes(ctx.context))
  })

  /** Helper: ¿el usuario puede acceder a este contexto (por clave de config)? */
  function canAccess(key: string): boolean {
    const ctx = contexts.value[key]
    if (!ctx) return false
    return ((authStore.availableContexts ?? []) as string[]).includes(ctx.context)
  }

  // ── Runtime: contexto activo + switching ───────────────────────────────────

  const currentContext = computed(() => authStore.currentContext)
  const availableContexts = computed(() => authStore.availableContexts)

  /**
   * Check whether user has permission to switch to targetContext.
   * Returns:
   *   { success: false, reason: 'no_permission' }  — user cannot switch
   *   { success: true, requiresConfirmation: true } — show confirmation UI
   */
  async function switchContext(targetContext) {
    const data = await api.get(`auth/context/${targetContext}/check`)
    if (!data.hasAccess) {
      return { success: false, reason: 'no_permission' }
    }
    return { success: true, requiresConfirmation: true }
  }

  /**
   * Execute the context switch after user confirmation.
   * Updates store and reloads permissions via fetchMe.
   */
  async function confirmSwitch(targetContext) {
    authStore.setCurrentContext(targetContext)
    await fetchMe()
    return { success: true }
  }

  /**
   * Quick synchronous check — is this context in the available list?
   */
  function hasAccessToContext(context) {
    return authStore.availableContexts.includes(context)
  }

  return {
    // config-level
    contexts,
    all,
    current,
    accessible,
    canAccess,
    // runtime
    currentContext,
    availableContexts,
    switchContext,
    confirmSwitch,
    hasAccessToContext,
  }
}
```

- [ ] **Step 2: Verify the file saved correctly**

```bash
grep -n "innertia.contexts\|ContextDefinition\|contexts\|current\|accessible" composables/useContext.js | head -20
```
Expected: lines showing `innertia.contexts`, `ContextDefinition`, and all the returned properties.

- [ ] **Step 3: Commit**

```bash
git add composables/useContext.js
git commit -m "refactor(contexts): useContext absorbs useApp — exposes current, all, accessible, canAccess, contexts from innertia.contexts config"
```

---

### Task 3: Delete `useApp.ts`

**Files:**
- Delete: `composables/useApp.ts`

- [ ] **Step 1: Delete the file**

```bash
git rm composables/useApp.ts
```

- [ ] **Step 2: Commit**

```bash
git commit -m "refactor(contexts): remove useApp.ts — functionality merged into useContext"
```

---

### Task 4: `useAuth.js` — fix login body field

**Files:**
- Modify: `composables/useAuth.js`

The `performLogin` function currently sends `app: context` in the POST body. The backend (innertia-laravel) now expects the field to be named `context`.

- [ ] **Step 1: Fix the `performLogin` call**

Find line (~17):
```js
    const data = await api.post(`${context}/auth/login`, { email, password, app: context })
```
Replace with:
```js
    const data = await api.post(`${context}/auth/login`, { email, password, context })
```

- [ ] **Step 2: Verify**

```bash
grep -n "app:" composables/useAuth.js
```
Expected: no output (zero matches — the old `app: context` field is gone).

- [ ] **Step 3: Commit**

```bash
git add composables/useAuth.js
git commit -m "fix(contexts): send context field instead of app in performLogin body"
```

---

### Task 5: Rename and update middleware

**Files:**
- Delete: `middleware/03.apps.global.ts`
- Create: `middleware/03.contexts.global.ts`

- [ ] **Step 1: Create `middleware/03.contexts.global.ts` with updated content**

```ts
/**
 * Middleware global que se ejecuta en cada navegación.
 *
 * Lee la declaración de contextos desde `appConfig.innertia.contexts`. Si el
 * producto no declara contextos, este middleware no hace nada (feature inactivo).
 *
 * Cuando hay contextos declarados, resuelve qué contexto está intentando acceder
 * el usuario según el prefijo de URL y:
 *   1. Si la URL no cae en ningún contexto declarado → pasa (deja seguir)
 *   2. Si la URL es la ruta de login del contexto → pasa (sin chequeo de permisos)
 *   3. Si el usuario no está autenticado → deja que el middleware `auth` redirija
 *   4. Si `availableContexts` está vacío (SSR sin hidratar) → intenta fetchMe()
 *      y si falla, pasa sin redirigir (mejor renderizar que redirigir mal)
 *   5. Si el usuario está autenticado pero NO tiene acceso al contexto →
 *      redirige al primer contexto accesible (o a su loginPath si no tiene ninguno)
 *   6. Si todo OK pero `currentContext !== targetContext.context` → sincroniza el
 *      contexto en el authStore y recarga permisos vía fetchMe()
 *
 * Esto es lo que permite el "cambio de contexto implícito por URL" sin botón.
 *
 * Numeración 03. para correr DESPUÉS de los middlewares saas
 * (01.detect-subdomain, 02.validate-tenant).
 */
import type { ContextDefinition } from '../app.config'

export default defineNuxtRouteMiddleware(async (to) => {
  const appConfig = useAppConfig()
  const contexts = (appConfig.innertia?.contexts ?? {}) as Record<string, ContextDefinition>
  const list = Object.values(contexts)

  // Si el producto no declaró contextos, el feature está inactivo
  if (list.length === 0) return

  // ¿La ruta cae bajo algún contexto?
  const targetContext = list.find(ctx =>
    to.path === ctx.path || to.path.startsWith(ctx.path + '/')
  )

  if (!targetContext) return  // ruta pública / fuera de contextos

  // La ruta de login del propio contexto no requiere permisos
  if (to.path === targetContext.loginPath) return

  const authStore = useAuthStore()

  // Si no está autenticado, deja que el middleware `auth` de la página haga el redirect
  if (!authStore.isAuthenticated()) return

  // ── Hidratación defensiva ─────────────────────────────────────────────────
  // `availableContexts` se persiste en localStorage, que NO se lee en SSR.
  // El plugin auth-init hace fetchMe en SSR pero puede fallar silenciosamente
  // (ej. tenant no resuelto). Si llegamos con token válido pero array vacío,
  // intentamos cargar los contextos antes de decidir el redirect.
  if ((authStore.availableContexts ?? []).length === 0) {
    try {
      const { fetchMe } = useAuth()
      await fetchMe()
    } catch {
      // no podemos resolver — pasamos: mejor renderizar la página que redirigir mal
      return
    }
  }

  const userContexts = (authStore.availableContexts ?? []) as string[]

  // Si tras hidratar seguimos sin contextos, NO redirigimos.
  if (userContexts.length === 0) return

  // ¿Tiene acceso al contexto?
  if (!userContexts.includes(targetContext.context)) {
    const fallback = list.find(ctx => userContexts.includes(ctx.context))
    if (fallback) {
      return navigateTo(fallback.home, { replace: true })
    }
    return navigateTo(list[0]?.loginPath ?? '/', { replace: true })
  }

  // Sincronizar currentContext silenciosamente si cambia
  if (authStore.currentContext !== targetContext.context) {
    authStore.setCurrentContext(targetContext.context)
    try {
      const { fetchMe } = useAuth()
      await fetchMe()
    } catch {
      // best-effort
    }
  }
})
```

- [ ] **Step 2: Remove the old middleware file**

```bash
git rm middleware/03.apps.global.ts
```

- [ ] **Step 3: Stage and commit**

```bash
git add middleware/03.contexts.global.ts
git commit -m "refactor(contexts): rename 03.apps.global→03.contexts.global, innertia.apps→innertia.contexts, AppDefinition→ContextDefinition"
```

---

### Task 6: `useOrganization.ts` + `useMobileGuard.ts` — swap `useApp()` for `useContext()`

**Files:**
- Modify: `composables/useOrganization.ts`
- Modify: `composables/useMobileGuard.ts`

- [ ] **Step 1: Update `useOrganization.ts` — change `useApp()` to `useContext()`**

Find line 13:
```ts
  const { current: currentApp } = useApp()
```
Replace with:
```ts
  const { current: currentApp } = useContext()
```

(The local alias `currentApp` is kept — it's used on line 23 as `currentApp.value?.context`. No other changes needed in this file.)

- [ ] **Step 2: Verify `useOrganization.ts` — no remaining `useApp` references**

```bash
grep -n "useApp" composables/useOrganization.ts
```
Expected: no output.

- [ ] **Step 3: Update `useMobileGuard.ts` — full replacement**

Replace the full file with:

```ts
import { useMediaQuery } from '@vueuse/core'
import type { ContextDefinition } from '../app.config'

const PICKER_CHOICE_COOKIE = 'innertia_mobile_context_choice'
const PICKER_COOKIE_MAX_AGE = 60 * 60 * 24 * 30  // 30 días

/**
 * Detección reactiva de viewport mobile + lógica de landing.
 *
 * Reglas para `landing` (qué mostrar cuando el usuario entra a `/` en mobile):
 *   - 0 contextos mobile-friendly  → blocker "abre en escritorio"
 *   - 1 contexto mobile-friendly   → redirect directo al login de ese contexto
 *   - 2+ contextos mobile-friendly → picker (con cookie para recordar última elección)
 *
 * El breakpoint se lee desde `appConfig.innertia.mobile.breakpoint` (default 1024).
 */
export function useMobileGuard() {
  const { all, current, accessible } = useContext()
  const authStore = useAuthStore()
  const appConfig = useAppConfig()

  const breakpoint: number = appConfig.innertia?.mobile?.breakpoint ?? 1024
  const isMobile = useMediaQuery(`(max-width: ${breakpoint - 1}px)`)

  /** Contextos con mode 'allow' en mobile. */
  const mobileApps = computed<ContextDefinition[]>(() =>
    all.value.filter(a => a.mobile?.mode === 'allow')
  )

  /** Contextos mobile-friendly + accesibles para el usuario autenticado. */
  const mobileAccessibleApps = computed<ContextDefinition[]>(() =>
    accessible.value.filter(a => a.mobile?.mode === 'allow')
  )

  /** ¿El contexto actual está bloqueado en mobile? */
  const isCurrentAppBlocked = computed<boolean>(() => {
    if (!isMobile.value) return false
    if (!current.value) return false
    return current.value.mobile?.mode === 'block'
  })

  /**
   * Para el blocker: si el usuario está autenticado y tiene OTRO contexto mobile-friendly,
   * lo ofrecemos como fallback ("continuar en X").
   */
  const mobileFallbackApp = computed<ContextDefinition | null>(() => {
    if (!authStore.isAuthenticated()) return null
    return mobileAccessibleApps.value[0] ?? null
  })

  // ── Cookie helpers para recordar última elección del picker ─────────────────
  function rememberPickerChoice(contextKey: string) {
    if (!(appConfig.innertia?.mobile?.rememberChoice ?? true)) return
    const cookie = useCookie<string | null>(PICKER_CHOICE_COOKIE, {
      maxAge: PICKER_COOKIE_MAX_AGE,
      sameSite: 'lax',
    })
    cookie.value = contextKey
  }

  function getRememberedPickerChoice(): string | null {
    const cookie = useCookie<string | null>(PICKER_CHOICE_COOKIE)
    return cookie.value ?? null
  }

  function clearRememberedPickerChoice() {
    const cookie = useCookie<string | null>(PICKER_CHOICE_COOKIE)
    cookie.value = null
  }

  return {
    isMobile,
    mobileApps,
    mobileAccessibleApps,
    isCurrentAppBlocked,
    mobileFallbackApp,
    rememberPickerChoice,
    getRememberedPickerChoice,
    clearRememberedPickerChoice,
  }
}
```

- [ ] **Step 4: Verify no remaining `useApp` or `AppDefinition` references in both files**

```bash
grep -n "useApp\|AppDefinition\|AppMobileMode" composables/useOrganization.ts composables/useMobileGuard.ts
```
Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add composables/useOrganization.ts composables/useMobileGuard.ts
git commit -m "refactor(contexts): useOrganization + useMobileGuard — useApp()→useContext(), AppDefinition→ContextDefinition"
```

---

### Task 7: Docs — CHANGELOG + final verification

**Files:**
- Create: `CHANGELOG.md`

- [ ] **Step 1: Create `CHANGELOG.md`**

```bash
cat > CHANGELOG.md << 'EOF'
# Changelog

All notable changes to `@innertia-solutions/innertia-nuxt` are documented here.

## [Unreleased]

### BREAKING CHANGES

#### apps → contexts rename

Aligns frontend with innertia-laravel which already renamed the concept.

**Config (`app.config.ts` / `nuxt.config.ts` in your product):**
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
# useContext() now also returns: contexts (dict), currentContext, availableContexts,
# switchContext(), confirmSwitch(), hasAccessToContext()
```

`useApp()` has been removed. Use `useContext()` for all context/app logic.

**Login body field:**

The `performLogin()` function in `useAuth` now sends `context` instead of `app` in
the POST body — matching what innertia-laravel now expects.
EOF
```

- [ ] **Step 2: Final grep — verify no stale references remain in the entire library**

```bash
grep -r "innertia\.apps\|AppDefinition\|AppMobileMode\|useApp()\|'app:'\|\"app:\"" \
  --include="*.ts" --include="*.js" --include="*.vue" \
  --exclude-dir=".nuxt" --exclude-dir="node_modules" \
  .
```
Expected: **no output**. If any matches appear, fix them before committing.

- [ ] **Step 3: Commit**

```bash
git add CHANGELOG.md
git commit -m "docs(contexts): add CHANGELOG with apps→contexts BREAKING CHANGE"
```
EOF
