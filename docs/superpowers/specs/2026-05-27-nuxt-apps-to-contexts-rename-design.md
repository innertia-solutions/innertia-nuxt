# innertia-nuxt: Rename apps → contexts

**Fecha:** 2026-05-27
**Estado:** Aprobado para implementación
**Tipo:** Refactor — rename puro, sin cambios de comportamiento
**Scope:** innertia-nuxt library

## Problema

El concepto de "apps" (áreas del sistema a las que un usuario tiene acceso) colisiona semánticamente con "apps" en el contexto de frontend (aplicaciones, secciones de front). Renombrar a "contexts" elimina la ambigüedad y alinea la librería con el rename ya realizado en innertia-laravel (donde `user_apps`, `HasApps`, `appKeys()` etc. ya se renombraron a `user_contexts`, `HasContexts`, `contextKeys()`).

El backend ya devuelve `availableContexts` y `currentContext` — el frontend ya usaba esos nombres en el store. Este rename hace que la **capa de configuración y composables** sea consistente con la API que ya consume.

## Alcance

Rename puro. **Cero cambios de comportamiento.** Todo lo que hoy funciona, sigue funcionando igual — solo cambian los nombres.

**Fuera de scope:**
- `menuApps` en `app.config.ts` y `backoffice.vue` — semánticamente correcto como "secciones del menú", no relacionado con el sistema de user contexts. Se mantiene intacto.
- Lógica de organizations, mobile guard, o cualquier otra feature.

## Mapa de renombrado

### `app.config.ts` — config key + tipos

| Antes | Después |
|-------|---------|
| `innertia.apps: {}` | `innertia.contexts: {}` |
| `AppDefinition` interface | `ContextDefinition` |
| `AppMobileMode` type | `ContextMobileMode` |

`menuApps` **no se toca**.

### `composables/useContext.js` — fusión de useApp + useContext

`useApp.ts` se elimina. `useContext.js` absorbe su lógica y expone la unión completa:

```ts
const {
  // — absorbido de useApp —
  current,            // ContextDefinition | null  (contexto según URL actual)
  all,                // ContextDefinition[]        (todos los declarados en config)
  accessible,         // ContextDefinition[]        (filtrados por availableContexts del user)
  canAccess,          // (key: string) => boolean
  contexts,           // Record<string, ContextDefinition>  (dict raw del config)

  // — ya existía en useContext —
  currentContext,     // string | null
  availableContexts,  // string[]
  switchContext,      // (target: string) => Promise<{success, reason?}>
  confirmSwitch,      // (target: string) => Promise<{success}>
  hasAccessToContext, // (context: string) => boolean
} = useContext()
```

**Regla de resolución de la parte absorbida:** lee de `appConfig.innertia.contexts` (antes `appConfig.innertia.apps`). La lógica interna es idéntica a la de `useApp.ts` actual.

### `composables/useApp.ts`

**Eliminado.** Toda su funcionalidad vive en `useContext.js`.

### `composables/useAuth.js`

Login POST body:

```js
// Antes
api.post(`${context}/auth/login`, { email, password, app: context })

// Después
api.post(`${context}/auth/login`, { email, password, context })
```

El backend (innertia-laravel) ya espera el campo `context`. Este fix cierra la inconsistencia.

### `middleware/03.apps.global.ts` → `middleware/03.contexts.global.ts`

- Renombrar el archivo.
- Internamente: `apps` variables → `contexts`, `AppDefinition` import → `ContextDefinition`, `appConfig.innertia.apps` → `appConfig.innertia.contexts`.
- La lógica de los 6 escenarios (ruta pública, login path, sin auth, sin contextos, sin acceso, sync) no cambia.

### `composables/useOrganization.ts`

- `useApp()` → `useContext()`
- Las propiedades que consume (`current`, referenciada internamente como `currentApp`) siguen existiendo con el mismo nombre en el composable fusionado.

### `composables/useMobileGuard.ts`

- `useApp()` → `useContext()`
- Propiedades consumidas: `all`, `current`, `accessible` — todas disponibles en el composable fusionado sin cambios de nombre.

### `CHANGELOG.md`

Agregar entrada `[Unreleased]` con sección `### BREAKING CHANGES`.

## Archivos a modificar (8)

1. `app.config.ts` — config key + tipos
2. `composables/useContext.js` — absorber useApp + actualizar internals
3. `composables/useApp.ts` — **eliminar**
4. `composables/useAuth.js` — fix body del login
5. `middleware/03.apps.global.ts` → **renombrar** a `03.contexts.global.ts` + editar internals
6. `composables/useOrganization.ts` — `useApp()` → `useContext()`
7. `composables/useMobileGuard.ts` — `useApp()` → `useContext()`
8. `CHANGELOG.md` — BREAKING CHANGE entry

## BREAKING CHANGES para productos consumidores

- Config `innertia.contexts` en vez de `innertia.apps`
- Tipo `ContextDefinition` en vez de `AppDefinition`
- Tipo `ContextMobileMode` en vez de `AppMobileMode`
- `useApp()` eliminado → usar `useContext()` (que ahora expone también `current`, `all`, `accessible`, `canAccess`, `contexts`)
- `performLogin` body: campo `context` en vez de `app`
